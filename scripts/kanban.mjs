// O kanban da equipa, do lado do Claude: o quadro onde vivem todas as tarefas
// (as que vieram do board KAN do Jira, as que nascem na conversa e as que os
// tickets de QA e os pedidos aceites criam sozinhos), nas tabelas da migração
// 0028_kanban.sql. Vive só no dev: o back office do dev mostra-o (a secção
// Kanban) e o Claude lê-o e escreve-o daqui.
//
//   node scripts/kanban.mjs listar [--coluna <id>] [--etiqueta <e>] [--todos] [--json] [--local]
//   node scripts/kanban.mjs ver <KAN-N> [--json] [--local]
//   node scripts/kanban.mjs criar --titulo "…" [--descricao "…"] [--tipo tarefa] [--etiquetas a,b]
//        [--coluna a-fazer] [--pai KAN-N] [--prioridade 3] [--prazo AAAA-MM-DD] [--local]
//   node scripts/kanban.mjs editar <KAN-N> [--titulo …] [--descricao …] [--tipo …] [--etiquetas a,b]
//        [--prioridade 1-5] [--pai KAN-N|nenhum] [--prazo AAAA-MM-DD|nenhum] [--local]
//   node scripts/kanban.mjs mover <KAN-N> <coluna> [--local]
//   node scripts/kanban.mjs comentar <KAN-N> --texto "…" [--local]
//   node scripts/kanban.mjs ligar <KAN-N> bloqueia|bloqueado|relaciona <KAN-M> [--local]
//   node scripts/kanban.mjs importar-jira <ficheiro.json> [--local]
//   node scripts/kanban.mjs sincronizar [--local]
//
// listar mostra o quadro por coluna (chave, tipo, prioridade, etiquetas e
// título de cada cartão), sem as colunas de fim (Concluído) a não ser com
// --todos ou --coluna; --json dá as colunas e os cartões na forma da rota
// GET /api/equipa/kanban. ver mostra um cartão inteiro: a descrição, a origem,
// as subtarefas, as ligações, os anexos, os comentários e o histórico. criar
// escreve a chave nova (o número a seguir ao maior, como as rotas), no topo da
// coluna; editar muda só o que se der («nenhum» remove o pai ou o prazo, e
// --etiquetas "" remove as etiquetas); mover leva o cartão para o topo da
// coluna (o id ou o nome dela) e nunca mexe no ticket de onde veio; comentar e
// ligar acrescentam. Cada escrita deixa as linhas certas no histórico do
// cartão (kanban_historico) e uma no audit_log, assinadas pelo Claude
// ({id: 'claude', nome: 'Claude'}).
// importar-jira lê a exportação do board KAN ({issues: {nodes: [{key,
// fields}]}}) e cria os cartões com as mesmas chaves, as colunas pelos
// estados, os tipos, as prioridades, as etiquetas, o pai, o prazo, a
// descrição, os comentários (do «Claude (Jira)») e as datas do Jira, numa só
// escrita; uma chave que já existe salta-se e diz-se, e o contador fica no
// maior número. Confere tudo antes de escrever: um estado, um tipo ou uma
// prioridade que não conhece param o comando sem mexer na base.
// sincronizar cria e move os cartões dos pedidos de pessoas aceites, pela
// regra de worker/src/lib/kanban.js (a mesma das rotas): lê os pedidos da
// produção e do dev e escreve os cartões no dev. Repetir não muda nada.
//
// Os alvos são dois para ler e escrever: o dev na Cloudflare (a base
// gestor-imobiliario-dev, por omissão) e a base isolada do servidor 8788
// (--local: gestor-imobiliario em .wrangler/state-revisao). A produção nunca
// para escrever: confereAlvo recusa-a antes de o wrangler correr, e não há
// opção que o mude. Só o sincronizar a lê, e só com SELECT (confereLeitura
// recusa outra coisa), pela mesma via do scripts/ticket.mjs: o wrangler.toml
// do repositório tem PLACEHOLDER nos ids, por isso o id de cada base remota
// vem de `wrangler d1 list --json` e vai num wrangler.toml temporário,
// passado com -c.
//
// O SQL leva os valores escritos lá dentro (sqlEmTexto: plicas dobradas), porque
// o wrangler d1 execute não aceita parâmetros ligados. As leituras vão por
// --command (o --file remoto só devolve contagens, não as linhas); as escritas
// vão por --file, num ficheiro temporário que o wrangler corre numa transação
// (o batch local, o import remoto): o texto do Jira não cabe numa linha de
// comandos do Windows. O wrangler corre-se com o process.execPath e os
// argumentos em lista, sem shell. Com KANBAN_VERBOSO=1, cada chamada ao
// wrangler é escrita no stderr antes de correr.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chaveDe, numeroDaChave, estadoDoPedido, cartaoDoPedido, passosDaSincronizacao, sqlEmTexto,
  TIPOS, NOMES_DOS_TIPOS, PRIORIDADES, NOMES_DAS_PRIORIDADES,
} from '../worker/src/lib/kanban.js';
import { configDoAlvo, comRepeticao, erroDoWrangler as erroDoWranglerTicket, lerJsonDoWrangler, ErroTicket } from './ticket.mjs';

// O worker/src não tem um package.json com "type": "module", e o Node avisa no
// stderr, a cada corrida, que leu a lib/kanban.js como ES module: cala-se esse
// aviso (o código MODULE_TYPELESS_PACKAGE_JSON), e só esse.
const avisosDoNode = process.listeners('warning');
process.removeAllListeners('warning');
process.on('warning', (w) => { if (!(w && w.code === 'MODULE_TYPELESS_PACKAGE_JSON')) avisosDoNode.forEach((f) => f(w)); });

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = path.join(RAIZ, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const PERSIST = path.join(RAIZ, '.wrangler', 'state-revisao');
const PASTA_TEMP = path.join(os.tmpdir(), 'rendorium-kanban');

export const COMANDOS = ['listar', 'ver', 'criar', 'editar', 'mover', 'comentar', 'ligar', 'importar-jira', 'sincronizar'];
// os dois sítios onde o script lê e escreve, e só estes
export const ALVOS = {
  remoto: { nome: 'dev', local: false, base: 'gestor-imobiliario-dev' },
  local: { nome: 'local', local: true, base: 'gestor-imobiliario' },
};
// a produção, só para o sincronizar LER os pedidos aceites (nunca para escrever)
export const PRODUCAO = { nome: 'prod', local: false, base: 'gestor-imobiliario' };
// quem assina o que o script escreve, e os comentários que vêm do Jira
export const CLAUDE = { id: 'claude', nome: 'Claude' };
export const AUTOR_JIRA = { id: 'claude', nome: 'Claude (Jira)' };
const PAPEL = 'script';

const TETO_TITULO = 200;
const TETO_TITULO_JIRA = 255;        // o do Jira: o importar guarda o título inteiro
const TETO_DESCRICAO = 20000;
const TETO_COMENTARIO = 8000;        // o mesmo da rota dos comentários
const TETO_TEXTO_JIRA = 50000;       // uma instrução da D1 não passa dos 100 KB
const TETO_ETIQUETAS = 20;
const TIPOS_DE_LIGACAO = ['bloqueia', 'bloqueado', 'relaciona'];

// os estados do board KAN e a coluna de cada um (o nome sem caixa nem acentos)
export const ESTADOS_DO_JIRA = { 'a fazer': 'a-fazer', 'auto tests': 'auto-tests', 'human tests': 'human-tests', concluido: 'concluido', 'para depois': 'para-depois' };
export const TIPOS_DO_JIRA = { tarefa: 'tarefa', task: 'tarefa', epico: 'epico', epic: 'epico', historia: 'historia', story: 'historia', subtarefa: 'subtarefa', subtask: 'subtarefa', 'sub-task': 'subtarefa', bug: 'erro', erro: 'erro' };
export const PRIORIDADES_DO_JIRA = { highest: 1, 'mais alta': 1, high: 2, alta: 2, medium: 3, media: 3, low: 4, baixa: 4, lowest: 5, 'mais baixa': 5 };

export const USO = [
  'Uso:',
  '  node scripts/kanban.mjs listar [--coluna <id>] [--etiqueta <e>] [--todos] [--json] [--local]',
  '  node scripts/kanban.mjs ver <KAN-N> [--json] [--local]',
  '  node scripts/kanban.mjs criar --titulo "…" [--descricao "…"] [--tipo tarefa] [--etiquetas a,b] [--coluna a-fazer] [--pai KAN-N] [--prioridade 3] [--prazo AAAA-MM-DD] [--local]',
  '  node scripts/kanban.mjs editar <KAN-N> [--titulo …] [--descricao …] [--tipo …] [--etiquetas a,b] [--prioridade 1-5] [--pai KAN-N|nenhum] [--prazo AAAA-MM-DD|nenhum] [--local]',
  '  node scripts/kanban.mjs mover <KAN-N> <coluna> [--local]',
  '  node scripts/kanban.mjs comentar <KAN-N> --texto "…" [--local]',
  '  node scripts/kanban.mjs ligar <KAN-N> bloqueia|bloqueado|relaciona <KAN-M> [--local]',
  '  node scripts/kanban.mjs importar-jira <ficheiro.json> [--local]',
  '  node scripts/kanban.mjs sincronizar [--local]',
  '',
  'Tipos: ' + TIPOS.join(', ') + '. Prioridades: 1 (Mais alta) a 5 (Mais baixa), 3 é a Média.',
  'Sem --local é o kanban do dev na Cloudflare (gestor-imobiliario-dev); com --local, a base isolada do 8788 (.wrangler/state-revisao).',
].join('\n');

// O erro que a linha de comandos mostra sem pilha: a mensagem chega para agir.
export class ErroKanban extends Error {
  /* Recebe: mensagem — o que correu mal, em português, já com o que fazer;
     codigo (opcional) — o código de saída (1 por omissão, 2 nos argumentos).
     Devolve: o erro, com .codigo. */
  constructor(mensagem, codigo = 1) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/* ------------------------- textos pequenos ------------------------------ */

/* Um texto sem acentos, em minúsculas e com os espaços juntos: a forma de
   comparar nomes escritos à mão («Concluído», «concluido», «CONCLUÍDO»).
   Recebe: t — o texto (qualquer valor).
   Devolve: o texto normalizado. */
export function normal(t) {
  return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/* Um texto livre pronto a guardar: sem o carácter nulo (que o SQLite corta) e
   com as quebras de linha do Windows passadas a \n.
   Recebe: t — o texto (qualquer valor).
   Devolve: o texto limpo (sem aparar). */
function limpo(t) {
  return String(t == null ? '' : t).replace(/\u0000/g, '').replace(/\r\n?/g, '\n');
}

/* «1 cartão», «3 cartões»: o plural certo.
   Recebe: n — a contagem; um — a forma singular; varios — a forma plural.
   Devolve: o texto com o número. */
function conta(n, um, varios) {
  return n + ' ' + (n === 1 ? um : varios);
}

/* Indenta um texto de várias linhas.
   Recebe: t — o texto; margem — o que vai à frente de cada linha.
   Devolve: o texto indentado. */
function indenta(t, margem) {
  return String(t).split('\n').map((l) => margem + l).join('\n');
}

const DATA = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/* Um instante em ms como data e hora de Lisboa.
   Recebe: ms — o instante (número) ou nada.
   Devolve: «28/10/2026, 14:03», ou '' sem instante. */
export function quando(ms) {
  const n = Number(ms);
  return ms == null || !Number.isFinite(n) ? '' : DATA.format(new Date(n));
}

/* Uma data do Jira em ms. O Jira escreve o fuso sem os dois pontos
   ('2026-11-08T13:00:44.217+0000'); passa-se a '+00:00' antes do Date.parse,
   e só se aceita uma data com o fuso dito (sem ele, o Date.parse leria a
   hora da máquina).
   Recebe: texto — a data do Jira.
   Devolve: o instante em ms, ou null se não for uma data com fuso. */
export function msDoJira(texto) {
  if (typeof texto !== 'string') return null;
  const t = texto.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(t)) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/* Se um texto é uma data AAAA-MM-DD que existe (o 2026-02-30 não).
   Recebe: t — o texto.
   Devolve: true ou false. */
export function dataValida(t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t == null ? '' : t));
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/* ------------------------- os valores de cada campo --------------------- */

/* Uma chave de cartão dada na linha de comandos (KAN-77, kan-77 ou 77).
   Recebe: texto — o que veio.
   Devolve: o número; lança ErroKanban (código 2) se não for uma chave. */
export function confereChave(texto) {
  const n = numeroDaChave(texto);
  if (n == null) throw new ErroKanban('«' + String(texto == null ? '' : texto) + '» não é uma chave de cartão (KAN-N, como no listar).', 2);
  return n;
}

/* O título de um cartão: uma linha só, aparada, sem o carácter nulo.
   Recebe: texto — o que veio; teto (opcional) — o máximo de caracteres.
   Devolve: o título; lança ErroKanban (código 2) se vier vazio ou comprido. */
export function confereTitulo(texto, teto = TETO_TITULO) {
  const t = limpo(texto).replace(/\s+/g, ' ').trim();
  if (!t) throw new ErroKanban('O título não pode ficar vazio.', 2);
  if (t.length > teto) throw new ErroKanban('O título passa dos ' + teto + ' caracteres.', 2);
  return t;
}

/* A descrição de um cartão (markdown, pode ficar vazia).
   Recebe: texto — o que veio.
   Devolve: a descrição aparada; lança ErroKanban (código 2) se for comprida. */
export function confereDescricao(texto) {
  const t = limpo(texto).trim();
  if (t.length > TETO_DESCRICAO) throw new ErroKanban('A descrição passa dos ' + TETO_DESCRICAO + ' caracteres.', 2);
  return t;
}

/* O texto de um comentário: de 1 a 8000 caracteres, como na rota.
   Recebe: texto — o que veio.
   Devolve: o texto aparado; lança ErroKanban (código 2) se vier vazio ou comprido. */
export function confereComentario(texto) {
  const t = limpo(texto).trim();
  if (!t) throw new ErroKanban('O comentário precisa de --texto com alguma coisa.', 2);
  if (t.length > TETO_COMENTARIO) throw new ErroKanban('O comentário passa dos ' + TETO_COMENTARIO + ' caracteres.', 2);
  return t;
}

/* O tipo de um cartão, pelo id ou pelo nome, sem caixa nem acentos
   («história», «Erro», «epico»).
   Recebe: texto — o que veio.
   Devolve: o id (de TIPOS); lança ErroKanban (código 2) com a lista se não o conhecer. */
export function confereTipo(texto) {
  const t = normal(texto);
  const id = TIPOS.find((k) => k === t || normal(NOMES_DOS_TIPOS[k]) === t);
  if (!id) throw new ErroKanban('Não conheço o tipo «' + String(texto) + '»: os tipos são ' + TIPOS.join(', ') + '.', 2);
  return id;
}

/* A prioridade de um cartão: de 1 (Mais alta) a 5 (Mais baixa), pelo número
   ou pelo nome («média», «Alta»).
   Recebe: texto — o que veio.
   Devolve: o número; lança ErroKanban (código 2) se não for uma prioridade. */
export function conferePrioridade(texto) {
  const t = normal(texto);
  const n = /^[1-5]$/.test(t) ? Number(t) : PRIORIDADES.find((p) => normal(NOMES_DAS_PRIORIDADES[p]) === t);
  if (!n) throw new ErroKanban('A prioridade «' + String(texto) + '» não existe: vai de 1 (Mais alta) a 5 (Mais baixa); 3 é a Média.', 2);
  return n;
}

/* Um prazo: uma data AAAA-MM-DD que existe, ou nada.
   Recebe: texto — o que veio; podeTirar — true para aceitar «nenhum» ou ''
   (o editar, que tira o prazo).
   Devolve: a data, ou null para tirar; lança ErroKanban (código 2) se não for uma data. */
export function conferePrazo(texto, podeTirar) {
  const t = String(texto == null ? '' : texto).trim();
  if (podeTirar && (t === '' || normal(t) === 'nenhum')) return null;
  if (!dataValida(t)) throw new ErroKanban('O prazo «' + t + '» não é uma data AAAA-MM-DD' + (podeTirar ? ' (ou «nenhum», para o remover)' : '') + '.', 2);
  return t;
}

/* O pai de um cartão: a chave, ou «nenhum» (ou '') para o remover.
   Recebe: texto — o que veio.
   Devolve: o número do pai, ou null para tirar; lança ErroKanban (código 2) se não for uma chave. */
export function conferePai(texto) {
  const t = String(texto == null ? '' : texto).trim();
  if (t === '' || normal(t) === 'nenhum') return null;
  return confereChave(t);
}

/* Uma etiqueta, normalizada como nas rotas: minúsculas, os espaços (e as
   vírgulas) passados a hífen («Em espera» → «em-espera»), até 40
   caracteres, sem caracteres de controlo.
   Recebe: texto — a etiqueta.
   Devolve: a etiqueta normalizada, ou null se não servir (vazia, comprida ou com controlo). */
export function etiquetaValida(texto) {
  const t = String(texto == null ? '' : texto).normalize('NFC').trim().toLowerCase().replace(/[\s,]+/g, '-');
  return t && t.length <= 40 && !/[\u0000-\u001f\u007f]/.test(t) ? t : null;
}

/* As etiquetas de um cartão, separadas por vírgulas («qa, design»), sem
   repetidas; '' é nenhuma.
   Recebe: texto — o que veio (ou um array).
   Devolve: as etiquetas, pela ordem do alfabeto; lança ErroKanban (código 2)
   se alguma não servir ou se passarem de 20. */
export function confereEtiquetas(texto) {
  const partes = (Array.isArray(texto) ? texto : String(texto == null ? '' : texto).split(',')).map((e) => String(e).trim()).filter(Boolean);
  const mas = partes.filter((e) => !etiquetaValida(e));
  if (mas.length) throw new ErroKanban('Etiquetas que não servem: ' + mas.map((e) => '«' + e + '»').join(', ') + ' (até 40 caracteres cada, separadas por vírgulas).', 2);
  const lista = [...new Set(partes.map(etiquetaValida))].sort();
  if (lista.length > TETO_ETIQUETAS) throw new ErroKanban('Um cartão leva até ' + TETO_ETIQUETAS + ' etiquetas.', 2);
  return lista;
}

/* ------------------------- argumentos ----------------------------------- */

const CAMPOS = ['--titulo', '--descricao', '--tipo', '--etiquetas', '--prioridade', '--pai', '--prazo'];
// as opções de cada comando (as que levam valor e as que são só um sinal) e quantos valores soltos leva
const OPCOES = {
  listar: { sinais: ['--local', '--todos', '--json'], valores: ['--coluna', '--etiqueta'], soltos: [] },
  ver: { sinais: ['--local', '--json'], valores: [], soltos: ['a chave do cartão'] },
  criar: { sinais: ['--local'], valores: CAMPOS.concat(['--coluna']), soltos: [] },
  editar: { sinais: ['--local'], valores: CAMPOS, soltos: ['a chave do cartão'] },
  mover: { sinais: ['--local'], valores: [], soltos: ['a chave do cartão', 'a coluna'] },
  comentar: { sinais: ['--local'], valores: ['--texto'], soltos: ['a chave do cartão'] },
  ligar: { sinais: ['--local'], valores: [], soltos: ['a chave do cartão', 'o tipo da ligação (bloqueia, bloqueado ou relaciona)', 'a chave do outro cartão'] },
  'importar-jira': { sinais: ['--local'], valores: [], soltos: ['o ficheiro .json da exportação'] },
  sincronizar: { sinais: ['--local'], valores: [], soltos: [] },
};

/* O id ou o nome de uma coluna dado na linha de comandos (confere-se com as
   colunas da base depois de as ler).
   Recebe: texto — o que veio.
   Devolve: o texto aparado; lança ErroKanban (código 2) se vier vazio ou estranho. */
function confereColunaDada(texto) {
  const t = limpo(texto).trim();
  if (!t || t.length > 80 || /[\u0000-\u001f]/.test(t)) throw new ErroKanban('A coluna «' + t + '» não serve: dá o id (a-fazer, human-tests, …) ou o nome.', 2);
  return t;
}

/* Lê a linha de comandos: o comando, os valores soltos (chaves, coluna, tipo
   de ligação, ficheiro) e as opções, aceitando «--titulo texto» e
   «--titulo=texto». Recusa o que não conhece em vez de o ignorar: uma opção
   mal escrita (--loca) ia ao dev em vez da base local.
   Recebe: argv — os argumentos depois do script (array de texto).
   Devolve: { comando, local, todos, json, numero, outro, coluna, etiqueta,
   ligacao, ficheiro, texto, campos } — campos tem só os campos dados (no
   criar, com os valores de omissão); lança ErroKanban (código 2) com a razão
   e o uso. */
export function lerArgumentos(argv) {
  const lista = Array.isArray(argv) ? argv.slice() : [];
  const comando = lista.shift();
  const falha = (porque) => { throw new ErroKanban(porque + '\n\n' + USO, 2); };
  if (!comando) falha('Falta o comando.');
  if (!COMANDOS.includes(comando)) falha('Não conheço o comando «' + comando + '».');
  const { sinais, valores, soltos: pedidos } = OPCOES[comando];
  const r = {
    comando, local: false, todos: false, json: false, numero: null, outro: null, coluna: null, etiqueta: null,
    ligacao: null, ficheiro: null, texto: null, campos: {},
  };
  const dados = {};
  const soltos = [];
  for (let i = 0; i < lista.length; i++) {
    const a = String(lista[i]);
    if (!a.startsWith('--')) { soltos.push(a); continue; }
    const igual = a.indexOf('=');
    const nome = igual > 0 ? a.slice(0, igual) : a;
    if (sinais.includes(nome)) {
      if (igual > 0) falha('A opção ' + nome + ' não leva valor.');
      r[nome.slice(2)] = true;
    } else if (valores.includes(nome)) {
      let v;
      if (igual > 0) v = a.slice(igual + 1);
      else {
        v = lista[++i];
        if (v === undefined || String(v).startsWith('--')) falha('A opção ' + nome + ' precisa de um valor (um valor que comece por -- escreve-se ' + nome + '=valor).');
      }
      if (Object.prototype.hasOwnProperty.call(dados, nome)) falha('A opção ' + nome + ' vem duas vezes.');
      dados[nome] = String(v);
    } else falha('O comando ' + comando + ' não aceita a opção ' + nome + '.');
  }
  if (soltos.length < pedidos.length) falha('Falta ' + pedidos[soltos.length] + '.');
  if (soltos.length > pedidos.length) falha('Não sei o que fazer com «' + soltos.slice(pedidos.length).join(' ') + '».');
  const tem = (k) => Object.prototype.hasOwnProperty.call(dados, k);

  if (['ver', 'editar', 'mover', 'comentar', 'ligar'].includes(comando)) r.numero = confereChave(soltos[0]);
  if (comando === 'mover') r.coluna = confereColunaDada(soltos[1]);
  if (comando === 'ligar') {
    const tipo = normal(soltos[1]);
    if (!TIPOS_DE_LIGACAO.includes(tipo)) falha('Não conheço a ligação «' + soltos[1] + '»: é bloqueia, bloqueado ou relaciona.');
    r.ligacao = tipo;
    r.outro = confereChave(soltos[2]);
    if (r.outro === r.numero) falha('Um cartão não se liga a si mesmo.');
  }
  if (comando === 'importar-jira') {
    r.ficheiro = soltos[0].trim();
    if (!r.ficheiro) falha('Falta o ficheiro .json da exportação.');
  }
  if (comando === 'listar') {
    if (tem('--coluna')) r.coluna = confereColunaDada(dados['--coluna']);
    if (tem('--etiqueta')) {
      r.etiqueta = etiquetaValida(dados['--etiqueta']);
      if (!r.etiqueta) falha('A etiqueta «' + dados['--etiqueta'] + '» não serve (até 40 caracteres).');
    }
  }
  if (comando === 'comentar') {
    if (!tem('--texto')) falha('O comentar precisa de --texto com o comentário.');
    r.texto = confereComentario(dados['--texto']);
  }
  if (comando === 'criar' || comando === 'editar') {
    const c = r.campos;
    if (tem('--titulo')) c.titulo = confereTitulo(dados['--titulo']);
    if (tem('--descricao')) c.descricao = confereDescricao(dados['--descricao']);
    if (tem('--tipo')) c.tipo = confereTipo(dados['--tipo']);
    if (tem('--etiquetas')) c.etiquetas = confereEtiquetas(dados['--etiquetas']);
    if (tem('--prioridade')) c.prioridade = conferePrioridade(dados['--prioridade']);
    if (tem('--pai')) c.pai = conferePai(dados['--pai']);
    if (tem('--prazo')) c.prazo = conferePrazo(dados['--prazo'], comando === 'editar');
    if (comando === 'criar') {
      if (!tem('--titulo')) falha('O criar precisa de --titulo.');
      r.coluna = tem('--coluna') ? confereColunaDada(dados['--coluna']) : 'a-fazer';
      r.campos = Object.assign({ descricao: '', tipo: 'tarefa', etiquetas: [], prioridade: 3, pai: null, prazo: null }, c);
    } else if (!Object.keys(c).length) {
      falha('O editar precisa de pelo menos um campo: ' + CAMPOS.join(', ') + '.');
    }
  }
  return r;
}

/* ------------------------- o alvo: dev ou local; a produção só a ler ---- */

/* O alvo de um comando: o dev na Cloudflare ou a base isolada do 8788.
   Recebe: local — true para a base isolada (--local).
   Devolve: uma cópia do alvo ({ nome, local, base }). */
export function alvoDe(local) {
  return Object.assign({}, local ? ALVOS.local : ALVOS.remoto);
}

/* Onde fica o alvo, dito para pessoas.
   Recebe: a — o alvo.
   Devolve: «no dev (gestor-imobiliario-dev)», «na base isolada (--local)» ou «na produção (…)». */
export function ondeFica(a) {
  return { dev: 'no dev (gestor-imobiliario-dev)', local: 'na base isolada (--local)', prod: 'na produção (gestor-imobiliario)' }[a && a.nome] || '?';
}

/* Se o alvo é, tal e qual, um dos dados.
   Recebe: a — o alvo; lista — os alvos permitidos.
   Devolve: true ou false. */
function umDe(a, lista) {
  return !!a && typeof a === 'object' && lista.some((b) => b.nome === a.nome && b.local === a.local && b.base === a.base);
}

/* A guarda das escritas: só passam os dois pares de ALVOS, exatamente. A
   base gestor-imobiliario sem --local É a produção (o mesmo nome, outro
   sítio), e recusa-se aqui, antes de qualquer chamada ao wrangler.
   Recebe: a — o alvo ({ nome, local, base }).
   Devolve: o mesmo alvo; lança ErroKanban se não for o dev nem a base isolada. */
export function confereAlvo(a) {
  if (!umDe(a, Object.values(ALVOS))) {
    const onde = a && typeof a === 'object' ? (a.local ? 'local ' : 'remota ') + (a.base || '?') + ' (' + (a.nome || 'sem nome') + ')' : 'nenhuma';
    throw new ErroKanban('Recuso escrever na base ' + onde + ': este script só escreve no kanban do dev (gestor-imobiliario-dev) ou da base isolada (--local). A produção não se toca.');
  }
  return a;
}

/* Se uma instrução só lê: um SELECT só, sem «;» nem comentários fora das
   plicas (um SELECT não escreve, e sem «;» não leva outra instrução atrás).
   Recebe: sql — a instrução (texto).
   Devolve: true se só lê. */
export function soLeitura(sql) {
  const fora = String(sql == null ? '' : sql).replace(/'(?:[^']|'')*'/g, "''");
  return /^\s*SELECT\b/i.test(fora) && !/;|--|\/\*/.test(fora);
}

/* A guarda das leituras: o dev, a base isolada ou a produção, e só SELECT.
   Recebe: a — o alvo; instrucoes — o SQL (array de texto).
   Devolve: o mesmo alvo; lança ErroKanban se o alvo não for um destes ou se
   alguma instrução não for um SELECT só. */
export function confereLeitura(a, instrucoes) {
  if (!umDe(a, Object.values(ALVOS).concat([PRODUCAO]))) {
    throw new ErroKanban('Recuso ler a base ' + (a && a.base ? a.base : '?') + ': este script só lê o dev, a base isolada (--local) e, para sincronizar, a produção.');
  }
  if (!Array.isArray(instrucoes) || !instrucoes.length) throw new ErroKanban('Nada para ler.');
  const ma = instrucoes.find((s) => !soLeitura(s));
  if (ma !== undefined) throw new ErroKanban('Recuso: as leituras são só SELECT, e isto não é: ' + String(ma).slice(0, 120));
  return a;
}

/* ------------------------- SQL ------------------------------------------ */

/* Uma instrução com os valores escritos lá dentro (plicas dobradas: a
   worker/src/lib/kanban.js:sqlEmTexto).
   Recebe: sql — o SQL com um ? por valor; params (opcional) — os valores.
   Devolve: o texto da instrução. */
export function instrucao(sql, params) {
  return sqlEmTexto({ sql, params: (params || []).map((v) => (typeof v === 'string' ? limpo(v) : v)) });
}

/* O texto que o wrangler corre: as instruções separadas por «;» e uma
   quebra de linha. O wrangler tira do texto o primeiro «BEGIN TRANSACTION;» e
   o primeiro «COMMIT;» que encontrar — mesmo dentro de um texto entre plicas
   — e recusa um segundo BEGIN TRANSACTION; um texto livre que os traga parte-se
   em dois pedaços colados com || (o valor guardado é o mesmo). Só há texto
   livre entre plicas: o SQL do script não tem estas palavras.
   Recebe: instrucoes — o SQL (array de texto).
   Devolve: o texto. */
export function paraWrangler(instrucoes) {
  return instrucoes.map((s) => String(s).replace(/BEGIN TRANSACTION/g, "BEGIN TRANS' || 'ACTION")).join(';\n');
}

/* O ficheiro de SQL de uma escrita: uma linha de comentário com a marca (o
   import remoto reconhece um ficheiro igual pelo md5, e cada escrita é outra)
   e as instruções, cada uma acabada em «;».
   Recebe: instrucoes — o SQL (array de texto); marca — o que distingue esta escrita.
   Devolve: o texto do ficheiro. */
export function textoDoFicheiro(instrucoes, marca) {
  return '-- scripts/kanban.mjs ' + String(marca).replace(/\s+/g, ' ') + '\n' + paraWrangler(instrucoes) + ';\n';
}

// as colunas de um cartão na forma curta (a CartaoCurto das rotas); c é o cartão, p o pai, k a coluna
const CURTO = 'c.id, c.numero, c.tipo, c.titulo, c.coluna_id, c.posicao, c.prioridade, c.responsavel_id, c.responsavel_nome, c.prazo,'
  + ' c.origem_tipo, c.origem_id, c.origem_estado, c.created_at, c.updated_at, c.concluido_at, c.removed_at,'
  + ' p.numero AS pai_numero, p.titulo AS pai_titulo, p.tipo AS pai_tipo,'
  + " (SELECT GROUP_CONCAT(e.etiqueta, ',') FROM kanban_etiquetas e WHERE e.cartao_id = c.id) AS etiquetas,"
  + ' (SELECT COUNT(*) FROM kanban_comentarios m WHERE m.cartao_id = c.id AND m.removed_at IS NULL) AS comentarios,'
  + ' (SELECT COUNT(*) FROM kanban_anexos x WHERE x.cartao_id = c.id) AS anexos,'
  + ' (SELECT COUNT(*) FROM kanban_cartoes f WHERE f.pai_id = c.id AND f.removed_at IS NULL) AS sub_total,'
  + ' (SELECT COUNT(*) FROM kanban_cartoes f JOIN kanban_colunas fc ON fc.id = f.coluna_id WHERE f.pai_id = c.id AND f.removed_at IS NULL AND fc.fim = 1) AS sub_feitas,'
  + ' EXISTS (SELECT 1 FROM kanban_ligacoes l JOIN kanban_cartoes b ON b.id = l.de_id LEFT JOIN kanban_colunas bc ON bc.id = b.coluna_id'
  + " WHERE l.para_id = c.id AND l.tipo = 'bloqueia' AND b.removed_at IS NULL AND COALESCE(bc.fim, 0) = 0) AS bloqueado";
const DE_CARTOES = ' FROM kanban_cartoes c LEFT JOIN kanban_cartoes p ON p.id = c.pai_id LEFT JOIN kanban_colunas k ON k.id = c.coluna_id';
const ORDEM_DO_QUADRO = ' ORDER BY COALESCE(k.ordem, 999999), c.posicao, c.numero';
// o id de um cartão pelo número, para as subconsultas
const ID_DO_NUMERO = '(SELECT id FROM kanban_cartoes WHERE numero = ?)';

/* O SELECT das colunas, pela ordem, cada uma com o total de cartões (sem filtros).
   Recebe: nada.
   Devolve: o SQL (texto). */
export function sqlColunas() {
  return 'SELECT k.id, k.nome, k.ordem, k.fim, k.fixa,'
    + ' (SELECT COUNT(*) FROM kanban_cartoes c WHERE c.coluna_id = k.id AND c.removed_at IS NULL) AS total'
    + ' FROM kanban_colunas k ORDER BY k.ordem, k.id';
}

/* O listar numa só chamada: as colunas e os cartões não removidos, por coluna
   e posição; sem todos, só os das colunas que não são de fim.
   Recebe: todos — true para juntar os das colunas de fim (Concluído).
   Devolve: as duas instruções (array de texto). */
export function sqlListar(todos) {
  return [sqlColunas(), 'SELECT ' + CURTO + DE_CARTOES + ' WHERE c.removed_at IS NULL' + (todos ? '' : ' AND COALESCE(k.fim, 0) = 0') + ORDEM_DO_QUADRO];
}

/* O ver numa só chamada: o cartão (também removido), as subtarefas, os
   comentários, o histórico, as ligações (dos dois lados), os anexos, a
   origem (o texto do ticket de QA ou o assunto do pedido) e as colunas.
   Recebe: numero — o N do cartão.
   Devolve: as oito instruções (array de texto). */
export function sqlVer(numero) {
  const id = ID_DO_NUMERO;
  return [
    instrucao('SELECT ' + CURTO + ', c.descricao, c.relator_id, c.relator_nome, c.removed_by' + DE_CARTOES + ' WHERE c.numero = ?', [numero]),
    instrucao('SELECT ' + CURTO + DE_CARTOES + ' WHERE c.pai_id = ' + id + ' AND c.removed_at IS NULL' + ORDEM_DO_QUADRO, [numero]),
    instrucao('SELECT id, autor_id, autor_nome, texto, created_at, updated_at FROM kanban_comentarios WHERE cartao_id = ' + id + ' AND removed_at IS NULL ORDER BY created_at, id', [numero]),
    instrucao('SELECT at, autor_id, autor_nome, campo, antes, depois FROM kanban_historico WHERE cartao_id = ' + id + ' ORDER BY at, id', [numero]),
    instrucao("SELECT l.id, CASE WHEN l.tipo = 'relaciona' THEN 'relaciona' WHEN l.de_id = x.id THEN 'bloqueia' ELSE 'bloqueado' END AS tipo,"
      + ' o.numero, o.titulo, o.tipo AS cartao_tipo, o.coluna_id, o.removed_at'
      + ' FROM kanban_ligacoes l JOIN (SELECT id FROM kanban_cartoes WHERE numero = ?) x ON l.de_id = x.id OR l.para_id = x.id'
      + ' JOIN kanban_cartoes o ON o.id = CASE WHEN l.de_id = x.id THEN l.para_id ELSE l.de_id END'
      + ' ORDER BY l.created_at, l.id', [numero]),
    instrucao('SELECT id, nome, tipo, tamanho, autor_id, autor_nome, created_at FROM kanban_anexos WHERE cartao_id = ' + id + ' ORDER BY created_at, id', [numero]),
    instrucao("SELECT 'qa' AS tipo, q.id, q.status AS estado, q.body AS resumo FROM qa_tickets q JOIN kanban_cartoes c ON c.origem_tipo = 'qa' AND c.origem_id = q.id WHERE c.numero = ?"
      + " UNION ALL SELECT 'pedido', t.id, t.status, t.subject FROM tickets t JOIN kanban_cartoes c ON c.origem_tipo = 'pedido' AND c.origem_id = t.id WHERE c.numero = ?", [numero, numero]),
    sqlColunas(),
  ];
}

/* O cartão, para se mexer nele: a forma curta e a descrição.
   Recebe: numero — o N.
   Devolve: o SQL (texto). */
export function sqlUmCartao(numero) {
  return instrucao('SELECT ' + CURTO + ', c.descricao' + DE_CARTOES + ' WHERE c.numero = ?', [numero]);
}

/* Todos os cartões, só com o que a árvore dos pais pede (os ciclos e os tipos).
   Recebe: nada.
   Devolve: o SQL (texto). */
export function sqlArvore() {
  return 'SELECT id, numero, tipo, titulo, pai_id, removed_at FROM kanban_cartoes';
}

/* A linha do audit_log de uma escrita do script (quem 'claude', papel
   'script'), como as rotas da equipa deixam; com condicao, só se ela se
   cumprir (um INSERT … SELECT … WHERE).
   Recebe: acao — 'kanban.criar', …; alvo — 'KAN-N' (ou outro texto); detalhe
   — texto curto (ou null); agora — o instante em ms; condicao (opcional) — o
   SQL do FROM … WHERE … que confirma que a escrita pegou, já com os valores.
   Devolve: a instrução (texto). */
export function sqlAuditoria(acao, alvo, detalhe, agora, condicao) {
  const d = detalhe == null ? null : String(detalhe).replace(/\s+/g, ' ').trim().slice(0, 500);
  return instrucao('INSERT INTO audit_log (at, quem, nome, papel, acao, alvo, detalhe) SELECT ?, ?, ?, ?, ?, ?, ?', [agora, CLAUDE.id, CLAUDE.nome, PAPEL, acao, alvo, d])
    + (condicao ? ' ' + condicao : '');
}

/* Uma linha do histórico de um cartão.
   Recebe: cartaoId — o id do cartão; agora — o instante em ms; autor —
   {id, nome}; campo — o que mudou; antes e depois — o texto (ou null).
   Devolve: a instrução (texto). */
function sqlHistorico(cartaoId, agora, autor, campo, antes, depois) {
  return instrucao('INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [cartaoId, agora, autor.id, autor.nome || '', campo, antes == null ? null : String(antes), depois == null ? null : String(depois)]);
}

/* O criar: sobe o contador (para o maior de ultimo e do maior número que
   exista, mais um), insere o cartão no topo da coluna com esse número, as
   etiquetas, o pai, a linha «criado» do histórico e o rasto. Tudo pega no
   cartão pelo uuid, numa transação.
   Recebe: c — {titulo, descricao, tipo, etiquetas, prioridade, pai (o número
   ou null), prazo}; coluna — {id, fim}; agora — ms; uuid — o id novo; autor — {id, nome}.
   Devolve: as instruções (array de texto). */
export function sqlCriar(c, coluna, agora, uuid, autor = CLAUDE) {
  const out = [
    'UPDATE kanban_contador SET ultimo = MAX(ultimo, (SELECT COALESCE(MAX(numero), 0) FROM kanban_cartoes)) + 1 WHERE id = 1',
    instrucao('INSERT INTO kanban_cartoes (id, numero, tipo, titulo, descricao, coluna_id, posicao, prioridade, relator_id, relator_nome,'
      + ' pai_id, prazo, created_at, updated_at, concluido_at)'
      + ' SELECT ?, (SELECT ultimo FROM kanban_contador WHERE id = 1), ?, ?, ?, ?,'
      + ' (SELECT COALESCE(MIN(posicao), 1024) - 1024 FROM kanban_cartoes WHERE coluna_id = ? AND removed_at IS NULL),'
      + ' ?, ?, ?, (SELECT id FROM kanban_cartoes WHERE numero = ? AND removed_at IS NULL), ?, ?, ?, ?',
    [uuid, c.tipo, c.titulo, c.descricao || '', coluna.id, coluna.id, c.prioridade, autor.id, autor.nome || '', c.pai == null ? null : c.pai,
      c.prazo || null, agora, agora, coluna.fim ? agora : null]),
  ];
  (c.etiquetas || []).forEach((e) => out.push(instrucao('INSERT OR IGNORE INTO kanban_etiquetas (cartao_id, etiqueta) VALUES (?, ?)', [uuid, e])));
  out.push(sqlHistorico(uuid, agora, autor, 'criado', null, coluna.id));
  // o alvo do rasto é a chave, que só a base sabe: lê-se do próprio cartão
  out.push(instrucao("INSERT INTO audit_log (at, quem, nome, papel, acao, alvo, detalhe) SELECT ?, ?, ?, ?, 'kanban.criar', 'KAN-' || numero, ? FROM kanban_cartoes WHERE id = ?",
    [agora, CLAUDE.id, CLAUDE.nome, PAPEL, c.titulo.slice(0, 500), uuid]));
  return out;
}

/* O editar: um UPDATE e uma linha de histórico por campo que mudou (o pai e
   o tipo pela chave e pelo id, as etiquetas como lista separada por vírgulas),
   o updated_at e o rasto.
   Recebe: cartao — o cartão como está (cartaoDaLinha, com id); mudancas — a
   lista de {campo, antes, depois, valor} (mudancasDoEditar); paiId — o id do
   pai novo (quando o pai muda); agora — ms; autor — {id, nome}.
   Devolve: as instruções (array de texto). */
export function sqlEditar(cartao, mudancas, paiId, agora, autor = CLAUDE) {
  const out = [];
  const coluna = { titulo: 'titulo', descricao: 'descricao', tipo: 'tipo', prioridade: 'prioridade', prazo: 'prazo' };
  mudancas.forEach((m) => {
    if (m.campo === 'etiquetas') {
      out.push(instrucao('DELETE FROM kanban_etiquetas WHERE cartao_id = ?', [cartao.id]));
      m.valor.forEach((e) => out.push(instrucao('INSERT OR IGNORE INTO kanban_etiquetas (cartao_id, etiqueta) VALUES (?, ?)', [cartao.id, e])));
    } else if (m.campo === 'pai') {
      out.push(instrucao('UPDATE kanban_cartoes SET pai_id = ? WHERE id = ?', [paiId, cartao.id]));
    } else {
      out.push(instrucao('UPDATE kanban_cartoes SET ' + coluna[m.campo] + ' = ? WHERE id = ?', [m.valor, cartao.id]));
    }
    out.push(sqlHistorico(cartao.id, agora, autor, m.campo, m.antes, m.depois));
  });
  if (out.length) {
    out.push(instrucao('UPDATE kanban_cartoes SET updated_at = ? WHERE id = ?', [agora, cartao.id]));
    out.push(sqlAuditoria('kanban.editar', cartao.chave, mudancas.map((m) => m.campo).join(', '), agora));
  }
  return out;
}

/* O mover: para o topo da coluna (a posição a 1024 acima do primeiro que lá
   está). Mudar de coluna deixa a linha «coluna» no histórico e acerta o
   concluido_at (posto ao chegar a uma coluna de fim, tirado ao sair); subir
   na mesma coluna não deixa linha. Nunca mexe no ticket de onde o cartão veio.
   Recebe: cartao — o cartão como está (id, chave, coluna_id); coluna — a
   coluna de destino ({id, fim}); agora — ms; autor — {id, nome}.
   Devolve: as instruções (array de texto). */
export function sqlMover(cartao, coluna, agora, autor = CLAUDE) {
  const muda = cartao.coluna_id !== coluna.id;
  const out = [];
  if (muda) out.push(sqlHistorico(cartao.id, agora, autor, 'coluna', cartao.coluna_id, coluna.id));
  out.push(instrucao('UPDATE kanban_cartoes SET coluna_id = ?,'
    + ' posicao = (SELECT COALESCE(MIN(k.posicao), 1024) - 1024 FROM kanban_cartoes k WHERE k.coluna_id = ? AND k.removed_at IS NULL AND k.id <> ?),'
    + ' concluido_at = ' + (coluna.fim ? (muda ? '?' : 'COALESCE(concluido_at, ?)') : 'NULL') + ', updated_at = ? WHERE id = ?',
  [coluna.id, coluna.id, cartao.id].concat(coluna.fim ? [agora] : [], [agora, cartao.id])));
  out.push(sqlAuditoria('kanban.mover', cartao.chave, muda ? cartao.coluna_id + ' → ' + coluna.id : 'topo de ' + coluna.id, agora));
  return out;
}

/* O comentar: o comentário, assinado pelo autor, e o updated_at do cartão.
   Recebe: cartao — o cartão (id, chave); texto — o comentário; agora — ms;
   uuid — o id do comentário; autor — {id, nome}.
   Devolve: as instruções (array de texto). */
export function sqlComentar(cartao, texto, agora, uuid, autor = CLAUDE) {
  return [
    instrucao('INSERT INTO kanban_comentarios (id, cartao_id, autor_id, autor_nome, texto, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuid, cartao.id, autor.id, autor.nome || '', texto, agora, agora]),
    instrucao('UPDATE kanban_cartoes SET updated_at = ? WHERE id = ?', [agora, cartao.id]),
    sqlAuditoria('kanban.comentar', cartao.chave, texto, agora),
  ];
}

/* O ligar: a ligação (bloqueado grava-se como bloqueia ao contrário;
   relaciona guarda-se uma vez), uma linha «ligacao» no histórico de cada um
   dos dois cartões, dita do lado dele (bloqueia KAN-9 de um lado, bloqueado
   KAN-5 do outro), o updated_at dos dois e o rasto.
   Recebe: um — o cartão dado primeiro (id, chave); tipo — 'bloqueia' |
   'bloqueado' | 'relaciona'; outro — o segundo cartão; agora — ms; uuid — o
   id da ligação; autor — {id, nome}.
   Devolve: as instruções (array de texto). */
export function sqlLigar(um, tipo, outro, agora, uuid, autor = CLAUDE) {
  const de = tipo === 'bloqueado' ? outro : um;
  const para = tipo === 'bloqueado' ? um : outro;
  const guardado = tipo === 'relaciona' ? 'relaciona' : 'bloqueia';
  const inverso = { bloqueia: 'bloqueado', bloqueado: 'bloqueia', relaciona: 'relaciona' }[tipo];
  return [
    instrucao('INSERT INTO kanban_ligacoes (id, de_id, para_id, tipo, autor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', [uuid, de.id, para.id, guardado, autor.id, agora]),
    sqlHistorico(um.id, agora, autor, 'ligacao', null, tipo + ' ' + outro.chave),
    sqlHistorico(outro.id, agora, autor, 'ligacao', null, inverso + ' ' + um.chave),
    instrucao('UPDATE kanban_cartoes SET updated_at = ? WHERE id IN (?, ?)', [agora, um.id, outro.id]),
    sqlAuditoria('kanban.ligar', um.chave, tipo + ' ' + outro.chave, agora),
  ];
}

/* ------------------------- as linhas da base ---------------------------- */

/* As etiquetas de uma linha (o GROUP_CONCAT), pela ordem do alfabeto.
   Recebe: texto — 'qa,design' ou null.
   Devolve: o array. */
function etiquetasDe(texto) {
  return texto ? String(texto).split(',').filter(Boolean).sort() : [];
}

/* Uma linha da base na forma curta das rotas (CartaoCurto), com o id.
   Recebe: l — a linha (as colunas de CURTO).
   Devolve: o cartão. */
export function cartaoDaLinha(l) {
  return {
    id: l.id, chave: chaveDe(l.numero), numero: Number(l.numero), tipo: l.tipo, titulo: l.titulo, coluna_id: l.coluna_id,
    posicao: Number(l.posicao), prioridade: Number(l.prioridade), etiquetas: etiquetasDe(l.etiquetas),
    responsavel: l.responsavel_id ? { id: l.responsavel_id, nome: l.responsavel_nome || '' } : null,
    pai: l.pai_numero != null ? { chave: chaveDe(l.pai_numero), titulo: l.pai_titulo, tipo: l.pai_tipo } : null,
    prazo: l.prazo || null,
    origem: l.origem_tipo ? { tipo: l.origem_tipo, id: l.origem_id, estado: l.origem_estado == null ? null : l.origem_estado } : null,
    comentarios: Number(l.comentarios) || 0, anexos: Number(l.anexos) || 0,
    subtarefas: { total: Number(l.sub_total) || 0, feitas: Number(l.sub_feitas) || 0 },
    bloqueado: !!Number(l.bloqueado),
    created_at: l.created_at, updated_at: l.updated_at, concluido_at: l.concluido_at == null ? null : l.concluido_at,
    removed_at: l.removed_at == null ? null : l.removed_at,
  };
}

/* Uma coluna da base, com os números como números.
   Recebe: l — a linha de sqlColunas.
   Devolve: { id, nome, ordem, fim, fixa, total }. */
function colunaDaLinha(l) {
  return { id: l.id, nome: l.nome, ordem: Number(l.ordem), fim: !!Number(l.fim), fixa: !!Number(l.fixa), total: Number(l.total) || 0 };
}

/* A coluna que um texto quer dizer: o id tal e qual, ou o id ou o nome sem
   caixa nem acentos («Human Tests», «human-tests», «concluído»).
   Recebe: colunas — as da base; texto — o que veio.
   Devolve: a coluna; lança ErroKanban com as que existem se não houver nenhuma. */
export function colunaPorTexto(colunas, texto) {
  const t = normal(texto);
  const c = colunas.find((k) => k.id === texto) || colunas.find((k) => normal(k.id) === t || normal(k.nome) === t || normal(k.nome).replace(/ /g, '-') === t);
  if (!c) throw new ErroKanban('Não há a coluna «' + texto + '». As colunas são: ' + colunas.map((k) => k.id + ' («' + k.nome + '»)').join(', ') + '.');
  return c;
}

/* ------------------------- o texto do listar e do ver ------------------- */

/* Um cartão numa linha, como o listar o escreve: a chave, o tipo, a
   prioridade, as etiquetas e o título, e entre parênteses o que houver mais
   (pai, subtarefas, bloqueado, prazo, responsável, origem, comentários, anexos).
   Recebe: k — o cartão (cartaoDaLinha).
   Devolve: o texto (uma linha). */
export function linhaDoCartao(k) {
  const partes = [k.chave, NOMES_DOS_TIPOS[k.tipo] || k.tipo, NOMES_DAS_PRIORIDADES[k.prioridade] || 'prioridade ' + k.prioridade];
  if (k.etiquetas.length) partes.push(k.etiquetas.join(', '));
  const extra = [];
  if (k.pai) extra.push('pai ' + k.pai.chave);
  if (k.subtarefas.total) extra.push('subtarefas ' + k.subtarefas.feitas + '/' + k.subtarefas.total);
  if (k.bloqueado) extra.push('bloqueado');
  if (k.prazo) extra.push('prazo ' + k.prazo);
  if (k.responsavel) extra.push('com ' + (k.responsavel.nome || k.responsavel.id));
  if (k.origem) extra.push(k.origem.tipo === 'qa' ? 'ticket de QA' : 'pedido');
  if (k.comentarios) extra.push(conta(k.comentarios, 'comentário', 'comentários'));
  if (k.anexos) extra.push(conta(k.anexos, 'anexo', 'anexos'));
  return partes.join(' · ') + ' — ' + k.titulo + (extra.length ? ' (' + extra.join('; ') + ')' : '');
}

/* O texto do listar: o cabeçalho (onde, quantos, os filtros, as colunas de fim
   escondidas) e cada coluna com os cartões dela, pela posição.
   Recebe: colunas — as da base (colunaDaLinha); cartoes — os cartões à
   vista, já filtrados (cartaoDaLinha); o — { local, todos, coluna (o id), etiqueta }.
   Devolve: o texto. */
export function textoDoQuadro(colunas, cartoes, o) {
  const vistas = o.coluna ? colunas.filter((k) => k.id === o.coluna) : colunas.filter((k) => o.todos || !k.fim);
  const escondidas = o.coluna || o.todos ? [] : colunas.filter((k) => k.fim);
  const filtro = o.etiqueta ? ', com a etiqueta «' + o.etiqueta + '»' : '';
  const quais = escondidas.map((k) => k.nome + ' (' + k.total + ')').join(', ');
  const linhas = ['Kanban ' + ondeFica(alvoDe(o.local)) + filtro + ': ' + conta(cartoes.length, 'cartão', 'cartões') + '.'
    + (escondidas.length === 1 ? ' A coluna ' + quais + ' fica escondida (--todos mostra-a).' : '')
    + (escondidas.length > 1 ? ' As colunas ' + quais + ' ficam escondidas (--todos mostra-as).' : '')];
  vistas.forEach((k) => {
    const deles = cartoes.filter((c) => c.coluna_id === k.id);
    linhas.push('');
    linhas.push('## ' + k.nome + ' (' + (o.etiqueta ? deles.length + ' de ' + k.total : k.total) + ')');
    if (!deles.length) linhas.push('  (vazia)');
    deles.forEach((c) => linhas.push('  ' + linhaDoCartao(c)));
  });
  return linhas.join('\n');
}

const NOMES_DOS_CAMPOS = {
  titulo: 'título', descricao: 'descrição', tipo: 'tipo', prioridade: 'prioridade', etiquetas: 'etiquetas', responsavel: 'responsável',
  pai: 'pai', prazo: 'prazo', ligacao: 'ligação', anexo: 'anexo', origem: 'origem', coluna: 'coluna',
};

/* Uma linha do histórico dita para pessoas.
   Recebe: h — {campo, antes, depois}; nomeDaColuna — função id → nome.
   Devolve: o texto («coluna: «A fazer» → «Auto Tests»», «criado em «A fazer»», …). */
export function textoDoHistorico(h, nomeDaColuna) {
  const col = (id) => (id == null ? '—' : '«' + nomeDaColuna(id) + '»');
  const val = (v, f) => (v == null || v === '' ? '—' : f ? f(v) : v);
  if (h.campo === 'criado') return 'criado' + (h.depois ? ' em ' + col(h.depois) : '');
  if (h.campo === 'removido' || h.campo === 'reposto') return h.campo;
  if (h.campo === 'coluna') return 'coluna: ' + col(h.antes) + ' → ' + col(h.depois);
  if (h.campo === 'descricao') return 'descrição alterada';
  if (h.campo === 'prioridade') return 'prioridade: ' + val(h.antes, (v) => NOMES_DAS_PRIORIDADES[v] || v) + ' → ' + val(h.depois, (v) => NOMES_DAS_PRIORIDADES[v] || v);
  if (h.campo === 'tipo') return 'tipo: ' + val(h.antes, (v) => NOMES_DOS_TIPOS[v] || v) + ' → ' + val(h.depois, (v) => NOMES_DOS_TIPOS[v] || v);
  if (h.campo === 'ligacao') return h.depois != null ? 'ligação adicionada: ' + h.depois : 'ligação removida: ' + val(h.antes);
  if (h.campo === 'anexo') return h.depois != null ? 'anexo adicionado: ' + h.depois : 'anexo removido: ' + val(h.antes);
  return (NOMES_DOS_CAMPOS[h.campo] || h.campo) + ': ' + val(h.antes) + ' → ' + val(h.depois);
}

/* As linhas do ver na forma do GET /api/equipa/kanban/cartoes/:chave.
   Recebe: linhas — os resultados das instruções de sqlVer, pela ordem.
   Devolve: { cartao, subtarefas, comentarios, historico, ligacoes, anexos,
   origem, colunas }, ou null se o cartão não existir. */
export function detalheDasLinhas(linhas) {
  const [cs, subs, coms, hist, ligs, anexos, origens, colunas] = linhas;
  if (!cs || !cs[0]) return null;
  const l = cs[0];
  const pessoa = (id, nome) => ({ id, nome: nome || '' });
  const o = origens && origens[0];
  return {
    cartao: Object.assign(cartaoDaLinha(l), {
      descricao: l.descricao || '', relator: pessoa(l.relator_id, l.relator_nome), removed_by: l.removed_by == null ? null : l.removed_by,
    }),
    subtarefas: (subs || []).map(cartaoDaLinha),
    comentarios: (coms || []).map((m) => ({ id: m.id, autor: pessoa(m.autor_id, m.autor_nome), texto: m.texto, created_at: m.created_at, updated_at: m.updated_at })),
    historico: (hist || []).map((h) => ({ at: h.at, autor: pessoa(h.autor_id, h.autor_nome), campo: h.campo, antes: h.antes, depois: h.depois })),
    ligacoes: (ligs || []).map((g) => ({
      id: g.id, tipo: g.tipo, cartao: { chave: chaveDe(g.numero), titulo: g.titulo, tipo: g.cartao_tipo, coluna_id: g.coluna_id, removido: g.removed_at != null },
    })),
    anexos: (anexos || []).map((a) => ({
      id: a.id, nome: a.nome, tipo: a.tipo, tamanho: Number(a.tamanho) || 0, url: '/api/equipa/kanban/anexos/' + a.id, autor: pessoa(a.autor_id, a.autor_nome), created_at: a.created_at,
    })),
    origem: l.origem_tipo ? {
      tipo: l.origem_tipo, id: l.origem_id, estado: l.origem_estado == null ? null : l.origem_estado,
      resumo: o && o.resumo != null ? String(o.resumo).slice(0, 600) : null, estado_do_ticket: o ? o.estado : null,
    } : null,
    colunas: (colunas || []).map(colunaDaLinha),
  };
}

/* Um cartão por extenso, como o ver o escreve.
   Recebe: det — o detalhe (detalheDasLinhas); local — true se veio da base isolada.
   Devolve: o texto (várias linhas). */
export function textoDoCartao(det, local) {
  const k = det.cartao;
  const nomeDaColuna = (id) => { const c = det.colunas.find((x) => x.id === id); return c ? c.nome : id; };
  const L = [];
  L.push(k.chave + ' · ' + (NOMES_DOS_TIPOS[k.tipo] || k.tipo) + ' · ' + (NOMES_DAS_PRIORIDADES[k.prioridade] || k.prioridade) + ' · «' + nomeDaColuna(k.coluna_id) + '» (' + ondeFica(alvoDe(local)) + ')');
  if (k.removed_at != null) L.push('REMOVIDO a ' + quando(k.removed_at) + (k.removed_by ? ' por ' + k.removed_by : '') + ' (repor é do master, no back office).');
  L.push('Título: ' + k.titulo);
  L.push('Etiquetas: ' + (k.etiquetas.length ? k.etiquetas.join(', ') : 'nenhuma'));
  L.push('Responsável: ' + (k.responsavel ? k.responsavel.nome + ' (' + k.responsavel.id + ')' : 'ninguém'));
  L.push('Relator: ' + (k.relator.nome || '?') + ' (' + k.relator.id + ')');
  if (k.pai) L.push('Pai: ' + k.pai.chave + ' «' + k.pai.titulo + '» (' + (NOMES_DOS_TIPOS[k.pai.tipo] || k.pai.tipo) + ')');
  if (k.prazo) L.push('Prazo: ' + k.prazo);
  if (det.origem) {
    const og = det.origem;
    L.push('Origem: ' + (og.tipo === 'qa' ? 'ticket de QA ' : 'pedido ') + og.id + ' (último estado visto: ' + (og.estado || '?') + ')'
      + (og.resumo == null ? ' — não está nesta base' + (og.tipo === 'pedido' ? ' (um pedido da produção?)' : '') : ':'));
    if (og.resumo != null) L.push(indenta(og.resumo, '  '));
  }
  L.push('Criado: ' + quando(k.created_at) + ' · atualizado: ' + quando(k.updated_at) + (k.concluido_at != null ? ' · concluído: ' + quando(k.concluido_at) : ''));
  L.push('Descrição:' + (k.descricao ? '' : ' nenhuma'));
  if (k.descricao) L.push(indenta(k.descricao, '  '));
  if (det.subtarefas.length) {
    L.push('Subtarefas (' + k.subtarefas.feitas + ' de ' + k.subtarefas.total + ' feitas):');
    det.subtarefas.forEach((s) => L.push('  ' + linhaDoCartao(s) + ' · «' + nomeDaColuna(s.coluna_id) + '»'));
  }
  if (det.ligacoes.length) {
    L.push('Ligações:');
    const frase = { bloqueia: 'bloqueia', bloqueado: 'é bloqueado por', relaciona: 'relaciona-se com' };
    det.ligacoes.forEach((g) => L.push('  ' + frase[g.tipo] + ' ' + g.cartao.chave + ' «' + g.cartao.titulo + '» (' + nomeDaColuna(g.cartao.coluna_id) + (g.cartao.removido ? ', removido' : '') + ')'));
  }
  if (det.anexos.length) {
    L.push('Anexos (' + det.anexos.length + '):');
    det.anexos.forEach((a) => L.push('  ' + (a.nome || a.id) + ' (' + a.tipo + ', ' + Math.max(1, Math.round(a.tamanho / 1024)) + ' KB) — ' + (a.autor.nome || a.autor.id) + ', ' + quando(a.created_at)));
  }
  L.push('Comentários (' + det.comentarios.length + '):' + (det.comentarios.length ? '' : ' nenhum'));
  det.comentarios.forEach((m) => {
    L.push('  ' + (m.autor.nome || m.autor.id) + ' · ' + quando(m.created_at) + (m.updated_at !== m.created_at ? ' (editado a ' + quando(m.updated_at) + ')' : ''));
    L.push(indenta(m.texto, '    '));
  });
  L.push('Histórico:');
  det.historico.forEach((h) => L.push('  ' + quando(h.at) + ' · ' + (h.autor.nome || h.autor.id) + ' · ' + textoDoHistorico(h, nomeDaColuna)));
  return L.join('\n');
}

/* ------------------------- o editar: o que muda, e se pode -------------- */

/* As mudanças de um editar: só os campos dados que ficam diferentes, cada um
   com o antes e o depois em texto (como ficam no histórico) e o valor a gravar.
   Recebe: cartao — o cartão como está (cartaoDaLinha, com descricao);
   campos — os dados (lerArgumentos); chaveDoPai — a chave do pai novo (ou null).
   Devolve: a lista de {campo, antes, depois, valor}. */
export function mudancasDoEditar(cartao, campos, chaveDoPai) {
  const out = [];
  const igual = (a, b) => (a == null ? '' : String(a)) === (b == null ? '' : String(b));
  // a descrição fica no histórico cortada aos 1000 caracteres, como nas rotas (vazia é null)
  const noHistorico = (f, v) => (v == null ? null : f === 'descricao' ? (String(v).length > 1000 ? String(v).slice(0, 999) + '…' : String(v)) || null : String(v));
  ['titulo', 'descricao', 'tipo', 'prioridade', 'prazo'].forEach((f) => {
    if (!Object.prototype.hasOwnProperty.call(campos, f)) return;
    const antes = f === 'descricao' ? cartao.descricao || '' : cartao[f];
    if (!igual(antes, campos[f])) out.push({ campo: f, antes: noHistorico(f, antes), depois: noHistorico(f, campos[f]), valor: campos[f] });
  });
  if (campos.etiquetas) {
    const antes = cartao.etiquetas.join(','), depois = campos.etiquetas.join(',');
    if (antes !== depois) out.push({ campo: 'etiquetas', antes: antes || null, depois: depois || null, valor: campos.etiquetas });
  }
  if (Object.prototype.hasOwnProperty.call(campos, 'pai')) {
    const antes = cartao.pai ? cartao.pai.chave : null;
    if (!igual(antes, chaveDoPai)) out.push({ campo: 'pai', antes, depois: chaveDoPai, valor: chaveDoPai });
  }
  return out;
}

/* As regras do pai, como na rota: um épico não tem pai; uma subtarefa tem
   pai, e não é um épico; nenhum cartão é pai de si mesmo nem de um
   antepassado; um épico não tem subtarefas por baixo (elas ficariam com um
   épico por pai); o pai existe e não foi removido.
   Recebe: eu — o cartão ({id, numero, tipo}, ou {id: null} no criar); tipo — o tipo
   com que fica; paiNumero — o número do pai com que fica (ou null); arvore —
   as linhas de sqlArvore; paiNovo (opcional, true) — false quando o pai é o
   que já lá estava (um pai removido entretanto não impede mudar o tipo).
   Devolve: a linha do pai (ou null); lança ErroKanban com a razão. */
export function conferePaiNaArvore(eu, tipo, paiNumero, arvore, paiNovo = true) {
  const porId = new Map(arvore.map((l) => [l.id, l]));
  if (tipo === 'epico' && eu.id && eu.tipo !== 'epico' && arvore.some((l) => l.pai_id === eu.id && l.removed_at == null && l.tipo === 'subtarefa')) {
    throw new ErroKanban(chaveDe(eu.numero) + ' tem subtarefas: não pode ser um épico (uma subtarefa não tem um épico por pai).');
  }
  if (paiNumero == null) {
    if (tipo === 'subtarefa') throw new ErroKanban('Uma subtarefa precisa de --pai (a tarefa de que faz parte).');
    return null;
  }
  if (tipo === 'epico') throw new ErroKanban('Um épico não tem pai.');
  const pai = arvore.find((l) => Number(l.numero) === paiNumero);
  if (!pai || (paiNovo && pai.removed_at != null)) throw new ErroKanban('O pai ' + chaveDe(paiNumero) + (pai ? ' foi removido.' : ' não existe.'));
  if (tipo === 'subtarefa' && pai.tipo === 'epico') throw new ErroKanban('O pai de uma subtarefa não pode ser um épico (' + chaveDe(paiNumero) + ' é).');
  for (let p = pai, passos = 0; p && passos <= arvore.length; p = porId.get(p.pai_id), passos++) {
    if (eu.id && p.id === eu.id) throw new ErroKanban(chaveDe(paiNumero) + ' não pode ser o pai de ' + chaveDe(eu.numero) + ': ' + (paiNumero === eu.numero ? 'é o próprio.' : 'está por baixo dele.'));
  }
  return pai;
}

/* ------------------------- o importar-jira ------------------------------ */

/* Os nodes da exportação do Jira ({issues: {nodes: […]}}, ou {issues: […]},
   como a pesquisa do Jira dá).
   Recebe: json — o objeto lido.
   Devolve: o array; lança ErroKanban se a forma não for nenhuma destas. */
function nodesDoJira(json) {
  const i = json && json.issues;
  const nodes = Array.isArray(i) ? i : i && Array.isArray(i.nodes) ? i.nodes : null;
  if (!nodes) throw new ErroKanban('O ficheiro não tem a forma da exportação do Jira ({issues: {nodes: [{key, fields}]}}).');
  return nodes;
}

/* O plano do importar-jira: confere a exportação toda antes de se escrever
   alguma coisa (chaves KAN-N, estados, tipos, prioridades, etiquetas, datas,
   pais) e separa as tarefas novas das que já existem. Um problema qualquer
   para o comando, com a lista de todos.
   Recebe: json — a exportação lida; existentes — as linhas de kanban_cartoes
   já na base ({numero, titulo, removed_at}); colunas — as da base.
   Devolve: { novos: [{numero, chave, tipo, titulo, descricao, coluna, fim,
   prioridade, etiquetas, prazo, criado, atualizado, pai, comentarios: [{texto,
   criado, atualizado}]}] (do mais recente para o mais antigo), saltados:
   [{chave, titulo, existente}] }; lança ErroKanban com os problemas. */
export function planoDoJira(json, existentes, colunas) {
  const nodes = nodesDoJira(json);
  const problemas = [];
  const desconhecidos = { estado: new Set(), tipo: new Set(), prioridade: new Set() };
  const porNumero = new Map((existentes || []).map((l) => [Number(l.numero), l]));
  const vistos = new Set();
  const todos = [];
  nodes.forEach((n, i) => {
    const key = n && typeof n.key === 'string' ? n.key.trim() : '';
    const onde = key || 'a tarefa ' + (i + 1);
    const m = /^KAN-([1-9]\d{0,8})$/.exec(key);
    if (!m) { problemas.push(onde + ': a chave não é KAN-N'); return; }
    const numero = Number(m[1]);
    if (vistos.has(numero)) { problemas.push(key + ' aparece duas vezes'); return; }
    vistos.add(numero);
    const f = n.fields || {};
    const nomeEstado = f.status && f.status.name, nomeTipo = f.issuetype && f.issuetype.name, nomePrio = f.priority && f.priority.name;
    const colunaId = ESTADOS_DO_JIRA[normal(nomeEstado)];
    if (!colunaId) desconhecidos.estado.add(String(nomeEstado));
    const coluna = colunaId && colunas.find((k) => k.id === colunaId);
    if (colunaId && !coluna) problemas.push(key + ': a coluna ' + colunaId + ' (do estado «' + nomeEstado + '») não existe nesta base');
    const tipo = TIPOS_DO_JIRA[normal(nomeTipo)];
    if (!tipo) desconhecidos.tipo.add(String(nomeTipo));
    const prioridade = nomePrio == null ? 3 : PRIORIDADES_DO_JIRA[normal(nomePrio)];
    if (!prioridade) desconhecidos.prioridade.add(String(nomePrio));
    let titulo = null;
    try { titulo = confereTitulo(f.summary, TETO_TITULO_JIRA); } catch (e) { problemas.push(key + ': ' + e.message); }
    if (f.description != null && typeof f.description !== 'string') problemas.push(key + ': a descrição não é texto (markdown)');
    const descricao = typeof f.description === 'string' ? limpo(f.description).trim() : '';
    if (descricao.length > TETO_TEXTO_JIRA) problemas.push(key + ': a descrição passa dos ' + TETO_TEXTO_JIRA + ' caracteres');
    let etiquetas = [];
    try { etiquetas = confereEtiquetas(Array.isArray(f.labels) ? f.labels : []); } catch (e) { problemas.push(key + ': ' + e.message); }
    const criado = msDoJira(f.created), atualizado = msDoJira(f.updated);
    if (criado == null) problemas.push(key + ': a data de criação «' + f.created + '» não se lê');
    if (atualizado == null) problemas.push(key + ': a data de atualização «' + f.updated + '» não se lê');
    let prazo = null;
    if (f.duedate != null && f.duedate !== '') {
      const d = String(f.duedate).slice(0, 10);
      if (dataValida(d)) prazo = d; else problemas.push(key + ': o prazo «' + f.duedate + '» não é uma data');
    }
    let pai = null;
    if (f.parent && f.parent.key != null) {
      const mp = /^KAN-([1-9]\d{0,8})$/.exec(String(f.parent.key).trim());
      if (!mp) problemas.push(key + ': o pai «' + f.parent.key + '» não é KAN-N');
      else if (Number(mp[1]) === numero) problemas.push(key + ': é pai de si mesmo');
      else pai = Number(mp[1]);
    }
    const comentarios = [];
    ((f.comment && Array.isArray(f.comment.comments)) ? f.comment.comments : []).forEach((c, j) => {
      const texto = typeof (c && c.body) === 'string' ? limpo(c.body).trim() : '';
      if (c && c.body != null && typeof c.body !== 'string') { problemas.push(key + ': o comentário ' + (j + 1) + ' não é texto (markdown)'); return; }
      if (!texto) return;
      if (texto.length > TETO_TEXTO_JIRA) problemas.push(key + ': o comentário ' + (j + 1) + ' passa dos ' + TETO_TEXTO_JIRA + ' caracteres');
      const cc = msDoJira(c.created), ca = msDoJira(c.updated == null ? c.created : c.updated);
      if (cc == null || ca == null) problemas.push(key + ': a data do comentário ' + (j + 1) + ' não se lê');
      comentarios.push({ texto, criado: cc, atualizado: ca });
    });
    todos.push({ numero, chave: key, tipo, titulo, descricao, coluna: colunaId, fim: !!(coluna && coluna.fim), prioridade, etiquetas, prazo, criado, atualizado, pai, comentarios });
  });
  if (desconhecidos.estado.size) problemas.unshift('Estados que não conheço: ' + [...desconhecidos.estado].map((e) => '«' + e + '»').join(', ') + ' (conheço: A fazer, Auto Tests, Human Tests, Concluído, Para depois)');
  if (desconhecidos.tipo.size) problemas.unshift('Tipos que não conheço: ' + [...desconhecidos.tipo].map((e) => '«' + e + '»').join(', ') + ' (conheço: Tarefa/Task, Épico/Epic, História/Story, Subtarefa/Subtask, Bug/Erro)');
  if (desconhecidos.prioridade.size) problemas.unshift('Prioridades que não conheço: ' + [...desconhecidos.prioridade].map((e) => '«' + e + '»').join(', ') + ' (conheço: Highest, High, Medium, Low, Lowest, e em português)');
  todos.forEach((t) => {
    if (t.pai != null && !vistos.has(t.pai) && !porNumero.has(t.pai)) problemas.push(t.chave + ': o pai ' + chaveDe(t.pai) + ' não está no ficheiro nem na base');
  });
  if (problemas.length) throw new ErroKanban('Não importei nada: a exportação tem problemas.\n' + problemas.map((p) => '  - ' + p).join('\n'));
  const novos = todos.filter((t) => !porNumero.has(t.numero))
    .sort((a, b) => (b.atualizado - a.atualizado) || (b.numero - a.numero));
  const saltados = todos.filter((t) => porNumero.has(t.numero)).sort((a, b) => a.numero - b.numero)
    .map((t) => { const e = porNumero.get(t.numero); return { chave: t.chave, titulo: t.titulo, existente: { titulo: e.titulo, removido: e.removed_at != null } }; });
  return { novos, saltados };
}

/* O SQL do importar-jira, numa transação: cada cartão novo (do mais recente
   para o mais antigo, cada um no fundo da sua coluna — a ordem fica a das
   datas de atualização, a mais recente em cima), as etiquetas, os
   comentários e a linha «criado» do histórico, tudo pelo uuid do cartão e só
   se o número ainda não existir; depois os pais (pela chave, já com todos
   inseridos), o contador no maior número e o rasto.
   Recebe: novos — os de planoDoJira; uuid — função que dá um id novo; agora — ms.
   Devolve: as instruções (array de texto). */
export function sqlImportar(novos, uuid, agora) {
  const out = [];
  const ids = new Map();
  novos.forEach((t) => {
    const id = uuid();
    ids.set(t.numero, id);
    out.push(instrucao('INSERT INTO kanban_cartoes (id, numero, tipo, titulo, descricao, coluna_id, posicao, prioridade, relator_id, relator_nome,'
      + ' prazo, created_at, updated_at, concluido_at)'
      + ' SELECT ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(posicao), -1024) + 1024 FROM kanban_cartoes WHERE coluna_id = ? AND removed_at IS NULL),'
      + ' ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM kanban_cartoes WHERE numero = ?)',
    [id, t.numero, t.tipo, t.titulo, t.descricao, t.coluna, t.coluna, t.prioridade, CLAUDE.id, CLAUDE.nome, t.prazo,
      t.criado, t.atualizado, t.fim ? t.atualizado : null, t.numero]));
    t.etiquetas.forEach((e) => out.push(instrucao('INSERT OR IGNORE INTO kanban_etiquetas (cartao_id, etiqueta) SELECT id, ? FROM kanban_cartoes WHERE id = ?', [e, id])));
    t.comentarios.forEach((c) => out.push(instrucao('INSERT INTO kanban_comentarios (id, cartao_id, autor_id, autor_nome, texto, created_at, updated_at)'
      + ' SELECT ?, id, ?, ?, ?, ?, ? FROM kanban_cartoes WHERE id = ?', [uuid(), AUTOR_JIRA.id, AUTOR_JIRA.nome, c.texto, c.criado, c.atualizado, id])));
    out.push(instrucao("INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'criado', NULL, coluna_id"
      + ' FROM kanban_cartoes WHERE id = ?', [t.criado, CLAUDE.id, CLAUDE.nome, id]));
  });
  novos.filter((t) => t.pai != null).forEach((t) => {
    out.push(instrucao('UPDATE kanban_cartoes SET pai_id = (SELECT p.id FROM kanban_cartoes p WHERE p.numero = ?) WHERE id = ? AND pai_id IS NULL', [t.pai, ids.get(t.numero)]));
  });
  out.push('UPDATE kanban_contador SET ultimo = MAX(ultimo, (SELECT COALESCE(MAX(numero), 0) FROM kanban_cartoes)) WHERE id = 1');
  if (novos.length) {
    const nums = novos.map((t) => t.numero).sort((a, b) => a - b);
    out.push(sqlAuditoria('kanban.importar', null, conta(novos.length, 'cartão', 'cartões') + ' do Jira (' + chaveDe(nums[0]) + ' a ' + chaveDe(nums[nums.length - 1]) + ')', agora));
  }
  return out;
}

/* ------------------------- o sincronizar -------------------------------- */

/* O SELECT dos pedidos de pessoas aceites, com o que a regra lê (estadoDoPedido
   e cartaoDoPedido), pela ordem da aceitação. Só lê.
   Recebe: nada.
   Devolve: o SQL (texto). */
export function sqlPedidosAceites() {
  return 'SELECT id, category, status, subject, body, accepted_at, refused_at, accepted_changes, draft_reply'
    + " FROM tickets WHERE category = 'user' AND accepted_at IS NOT NULL ORDER BY accepted_at, id";
}

/* O SELECT dos cartões que vieram de pedidos (também os removidos: esses não
   se mexem, e não se criam outros).
   Recebe: nada.
   Devolve: o SQL (texto). */
export function sqlCartoesDosPedidos() {
  return "SELECT id, numero, titulo, origem_id, origem_estado, coluna_id, removed_at FROM kanban_cartoes WHERE origem_tipo = 'pedido' ORDER BY numero";
}

/* Os pedidos de onde vieram, sem repetidos: um id que esteja nas duas bases
   conta o da produção (o verdadeiro).
   Recebe: daProducao e doDev — as linhas de sqlPedidosAceites (arrays).
   Devolve: { pedidos: [{...linha, de: 'prod' | 'dev' | 'local'}], repetidos: [ids] }. */
export function juntaPedidos(daProducao, doDev, nomeDoDev = 'dev') {
  const vistos = new Set();
  const repetidos = [];
  const pedidos = [];
  (daProducao || []).forEach((t) => { vistos.add(t.id); pedidos.push(Object.assign({ de: 'prod' }, t)); });
  (doDev || []).forEach((t) => {
    if (vistos.has(t.id)) { repetidos.push(t.id); return; }
    vistos.add(t.id);
    pedidos.push(Object.assign({ de: nomeDoDev }, t));
  });
  return { pedidos, repetidos };
}

/* O que o sincronizar tem de fazer: os pedidos cujo cartão falta ou ficou
   num estado antigo; os outros contam-se (em dia, sem cartão por serem
   recusados, com o cartão removido).
   Recebe: pedidos — de juntaPedidos; cartoes — as linhas de sqlCartoesDosPedidos.
   Devolve: { aMexer: [{t, estado}], emDia, recusados, removidos } (os três últimos, contagens). */
export function planoDaSincronizacao(pedidos, cartoes) {
  const porOrigem = new Map(cartoes.map((c) => [c.origem_id, c]));
  const r = { aMexer: [], emDia: 0, recusados: 0, removidos: 0 };
  pedidos.forEach((t) => {
    const estado = estadoDoPedido(t);
    if (!estado) { r.recusados++; return; }
    const c = porOrigem.get(t.id);
    if (c && c.removed_at != null) { r.removidos++; return; }
    if (c && c.origem_estado === estado) { r.emDia++; return; }
    r.aMexer.push({ t, estado });
  });
  return r;
}

/* O SQL do sincronizar: os passos da regra (worker/src/lib/kanban.js:
   passosDaSincronizacao) de cada pedido a mexer, assinados pelo Claude, com o
   cartão novo (cartaoDoPedido) para o caso de ainda não o ter, e o rasto.
   Recebe: aMexer — de planoDaSincronizacao; agora — ms; uuid — função que dá um id novo.
   Devolve: as instruções (array de texto). */
export function sqlSincronizar(aMexer, agora, uuid) {
  const out = [];
  aMexer.forEach(({ t, estado }) => {
    passosDaSincronizacao({ tipo: 'pedido', id: t.id, estado, agora, autor: CLAUDE, novo: Object.assign({ uuid: uuid() }, cartaoDoPedido(t)) })
      .forEach((p) => out.push(instrucao(p.sql, p.params)));
  });
  if (out.length) out.push(sqlAuditoria('kanban.sincronizar', null, conta(aMexer.length, 'pedido', 'pedidos') + ' a acertar', agora));
  return out;
}

/* O que mudou, comparando os cartões dos pedidos antes e depois.
   Recebe: antes e depois — as linhas de sqlCartoesDosPedidos.
   Devolve: { criados: [linha], movidos: [{linha, de}] }. */
export function mudancasDosCartoes(antes, depois) {
  const eram = new Map(antes.map((c) => [c.origem_id, c]));
  const criados = [], movidos = [];
  depois.forEach((c) => {
    const e = eram.get(c.origem_id);
    if (!e) criados.push(c);
    else if (e.coluna_id !== c.coluna_id) movidos.push({ linha: c, de: e.coluna_id });
  });
  return { criados, movidos };
}

/* ------------------------- o wrangler ----------------------------------- */

/* Diz, em português e com o que fazer, porque é que o wrangler falhou: a
   tabela que falta, e o resto como o scripts/ticket.mjs (sessão, rede, 7403).
   Recebe: texto — o que o wrangler escreveu (stdout + stderr).
   Devolve: { tipo, mensagem, tabela? }, com tipo 'por-migrar' ou um dos do ticket.mjs. */
export function erroDoWrangler(texto) {
  const t = String(texto || '');
  const m = /no such table:?\s*([A-Za-z0-9_]+)/i.exec(t);
  if (m) return { tipo: 'por-migrar', tabela: m[1], mensagem: 'A tabela ' + m[1] + ' ainda não existe nesta base.' };
  return erroDoWranglerTicket(t.split(/\r?\n/).filter((l) => !/^\[kanban\]/.test(l)).join('\n'));
}

/* O que dizer quando falta uma tabela, conforme o sítio: o dev só a recebe
   com o deploy (daqui não se migra o dev); a base isolada migra-se à mão, com
   o execute (o migrations apply com o 8788 de pé mata-o).
   Recebe: a — o alvo; tabela — a que falta.
   Devolve: a mensagem (texto). */
export function mensagemPorMigrar(a, tabela) {
  const doKanban = /^kanban_/.test(String(tabela || ''));
  if (a && a.local) {
    return 'A tabela ' + tabela + ' ainda não existe na base isolada' + (doKanban
      ? ': aplica a 0028 com `npx wrangler d1 execute gestor-imobiliario --local --persist-to .wrangler/state-revisao --file migrations/0028_kanban.sql` (nunca o migrations apply com o 8788 de pé).'
      : ' (falta uma migração).');
  }
  if (a && a.nome === 'prod') return 'A tabela ' + tabela + ' não existe na produção (só se lê de lá).';
  return 'A tabela ' + tabela + ' ainda não existe no dev' + (doKanban ? ': a migração 0028 chega lá com o próximo deploy do ramo dev.' : ' (falta uma migração).');
}

/* Escreve no stderr a chamada que vai correr, com KANBAN_VERBOSO=1.
   Recebe: args — os argumentos do wrangler.
   Devolve: nada. */
function mostraChamada(args) {
  if (process.env.KANBAN_VERBOSO === '1') process.stderr.write('[kanban] wrangler ' + args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ') + '\n');
}

/* Corre o wrangler do repositório (node_modules), sem shell: os argumentos
   vão tal e qual. A sessão é OAuth com um token de uma hora: com ele
   expirado, o `wrangler whoami` renova-o e repete-se uma vez; a falha
   passageira 7403 repete-se (comRepeticao, do scripts/ticket.mjs).
   Recebe: args — os argumentos do wrangler (array de texto).
   Devolve: { status, stdout, stderr }; lança ErroKanban se o wrangler não estiver instalado. */
function correWrangler(args) {
  if (!existsSync(WRANGLER)) throw new ErroKanban('Não encontro o wrangler em ' + WRANGLER + ': corre `npm install` no app/.');
  mostraChamada(args);
  const umaVez = (a) => {
    const r = spawnSync(process.execPath, [WRANGLER].concat(a), {
      cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 300000, windowsHide: true,
      env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' }),
    });
    if (r.error) throw new ErroKanban('O wrangler não correu: ' + r.error.message);
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  };
  return comRepeticao(() => {
    const r = umaVez(args);
    if (r.status === 0 || erroDoWrangler(r.stdout + '\n' + r.stderr).tipo !== 'sem-sessao') return r;
    mostraChamada(['whoami']);
    umaVez(['whoami']);
    return umaVez(args);
  });
}

const configs = {};
let basesDaConta = null;

/* Os argumentos do wrangler que apontam para o alvo: --local com a pasta
   isolada (e o wrangler.toml do repositório), ou --remote com o wrangler.toml
   temporário da base (os.tmpdir()/rendorium-kanban/wrangler-<alvo>.toml,
   pelo configDoAlvo do scripts/ticket.mjs). Só os três sítios conhecidos; a
   escrita já passou pela confereAlvo, que recusa a produção.
   Recebe: a — o alvo.
   Devolve: array de argumentos. */
function argsDoAlvo(a) {
  if (!umDe(a, Object.values(ALVOS).concat([PRODUCAO]))) throw new ErroKanban('Recuso a base ' + (a && a.base) + '.');
  if (a.local) return ['--local', '--persist-to', PERSIST];
  if (!configs[a.nome]) {
    if (!basesDaConta) {
      const r = correWrangler(['d1', 'list', '--json']);
      const lista = lerJsonDoWrangler(r.stdout);
      if (r.status !== 0 || !Array.isArray(lista)) throw new ErroKanban(erroDoWrangler(r.stdout + '\n' + r.stderr).mensagem);
      basesDaConta = lista;
    }
    const b = basesDaConta.find((d) => d && d.name === a.base);
    if (!b) throw new ErroKanban('A conta do wrangler não tem a base ' + a.base + ' (wrangler d1 list não a mostra): é a conta certa?');
    mkdirSync(PASTA_TEMP, { recursive: true });
    const f = path.join(PASTA_TEMP, 'wrangler-' + a.nome + '.toml');
    writeFileSync(f, configDoAlvo(a, b.uuid).replace(/^#.*\n/, '# Temporário, escrito por scripts/kanban.mjs ('
      + (a.nome === 'prod' ? 'só lê os pedidos aceites da produção' : 'lê e escreve o kanban do dev') + ').\n'));
    configs[a.nome] = f;
  }
  return ['--remote', '-c', configs[a.nome]];
}

/* Lança o erro do wrangler, se a chamada falhou (o código, o JSON com error,
   ou um JSON que não é a lista de resultados).
   Recebe: a — o alvo; r — { status, stdout, stderr }; j — o JSON lido do stdout.
   Devolve: nada; lança ErroKanban (com .tipo e .tabela). */
function falhaDoWrangler(a, r, j) {
  const erro = j && !Array.isArray(j) && j.error;
  const falhou = Array.isArray(j) && j.some((x) => x && x.success === false);
  if (r.status === 0 && !erro && Array.isArray(j) && !falhou) return;
  const e = erroDoWrangler([erro ? (erro.text || '') + ' ' + JSON.stringify(erro.notes || '') : '', r.stdout, r.stderr].join('\n'));
  const x = new ErroKanban(e.tipo === 'por-migrar' ? mensagemPorMigrar(a, e.tabela) : e.mensagem);
  x.tipo = e.tipo;
  x.tabela = e.tabela;
  throw x;
}

/* Lê no alvo: as instruções (só SELECT) numa chamada ao wrangler, por --command.
   Recebe: a — o alvo (o dev, a isolada ou a produção); instrucoes — o SQL (array).
   Devolve: as linhas de cada instrução (array de arrays); lança ErroKanban. */
function lerNoWrangler(a, instrucoes) {
  confereLeitura(a, instrucoes);
  const r = correWrangler(['d1', 'execute', a.base].concat(argsDoAlvo(a), ['--json', '--yes', '--command', paraWrangler(instrucoes)]));
  const j = lerJsonDoWrangler(r.stdout);
  falhaDoWrangler(a, r, j);
  return instrucoes.map((s, i) => (j[i] && Array.isArray(j[i].results) ? j[i].results : []));
}

/* Escreve no alvo: as instruções num ficheiro temporário, que o wrangler corre
   numa transação (--file: o batch local, o import remoto). Se falhar, o
   ficheiro fica, e o erro diz onde.
   Recebe: a — o alvo (o dev ou a isolada: a produção recusa-se aqui); instrucoes — o SQL (array).
   Devolve: nada; lança ErroKanban se falhar. */
function escreverNoWrangler(a, instrucoes) {
  confereAlvo(a);
  mkdirSync(PASTA_TEMP, { recursive: true });
  const marca = new Date().toISOString() + ' ' + randomUUID();
  const f = path.join(PASTA_TEMP, 'escrita-' + marca.replace(/[^0-9A-Za-z-]/g, '').slice(0, 40) + '.sql');
  writeFileSync(f, textoDoFicheiro(instrucoes, marca), 'utf8');
  if (process.env.KANBAN_VERBOSO === '1') process.stderr.write('[kanban] o SQL da escrita (' + instrucoes.length + ' instruções) está em ' + f + '\n');
  const r = correWrangler(['d1', 'execute', a.base].concat(argsDoAlvo(a), ['--json', '--yes', '--file', f]));
  try {
    falhaDoWrangler(a, r, lerJsonDoWrangler(r.stdout));
  } catch (e) {
    e.message += ' (Nada ficou escrito; o SQL está em ' + f + '.)';
    throw e;
  }
  rmSync(f, { force: true });
}

/* ------------------------- os comandos ---------------------------------- */

/* As dependências de fora (o wrangler, o relógio, os ids, o ficheiro), com as
   verdadeiras por omissão: os testes trocam-nas para correr sem rede.
   Recebe: deps — as que se querem trocar ({ ler, escrever, agora, uuid, lerFicheiro }).
   Devolve: as dependências completas. */
function dependencias(deps = {}) {
  return {
    ler: deps.ler || lerNoWrangler,
    escrever: deps.escrever || escreverNoWrangler,
    agora: deps.agora || (() => Date.now()),
    uuid: deps.uuid || (() => randomUUID()),
    lerFicheiro: deps.lerFicheiro || ((f) => readFileSync(path.resolve(f), 'utf8')),
  };
}

/* Lê no alvo, depois de a guarda das leituras o conferir (também com um
   executor de testes).
   Recebe: d — as dependências; a — o alvo; instrucoes — o SQL (array, só SELECT).
   Devolve: as linhas de cada instrução (array de arrays). */
function ler(d, a, instrucoes) {
  confereLeitura(a, instrucoes);
  return d.ler(a, instrucoes);
}

/* Escreve no alvo, depois de a guarda das escritas o conferir (a produção
   nunca passa). Sem instruções, não chama nada.
   Recebe: d — as dependências; a — o alvo; instrucoes — o SQL (array).
   Devolve: nada. */
function escrever(d, a, instrucoes) {
  confereAlvo(a);
  if (instrucoes.length) d.escrever(a, instrucoes);
}

/* Um cartão como está, para se mexer nele: existe e não foi removido.
   Recebe: d — as dependências; a — o alvo; numero — o N.
   Devolve: o cartão (cartaoDaLinha, com descricao); lança ErroKanban se não
   existir ou estiver removido. */
function umCartao(d, a, numero) {
  const l = ler(d, a, [sqlUmCartao(numero)])[0][0];
  if (!l) throw new ErroKanban('Não há nenhum cartão ' + chaveDe(numero) + ' ' + ondeFica(a) + ' (confirma com o listar; é --local?).');
  if (l.removed_at != null) throw new ErroKanban('O ' + chaveDe(numero) + ' foi removido a ' + quando(l.removed_at) + ': repor é do master, no back office.');
  return Object.assign(cartaoDaLinha(l), { descricao: l.descricao || '' });
}

/* listar: o quadro em texto ou em JSON. Sem as tabelas (o dev antes do
   deploy da 0028) não é um erro: diz-se e sai bem.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto a escrever no stdout. */
function cmdListar(o, d) {
  const a = alvoDe(o.local);
  let linhas;
  try {
    linhas = ler(d, a, sqlListar(o.todos || !!o.coluna));
  } catch (e) {
    if (e.tipo !== 'por-migrar') throw e;
    return o.json ? JSON.stringify({ alvo: a.nome, colunas: [], cartoes: [], porMigrar: true, aviso: e.message }, null, 2) : 'Tabelas por migrar. ' + e.message;
  }
  const colunas = linhas[0].map(colunaDaLinha);
  const coluna = o.coluna ? colunaPorTexto(colunas, o.coluna).id : null;
  const cartoes = linhas[1].map(cartaoDaLinha)
    .filter((k) => (!coluna || k.coluna_id === coluna) && (!o.etiqueta || k.etiquetas.includes(o.etiqueta)));
  if (o.json) {
    const semId = cartoes.map((k) => { const c = Object.assign({}, k); delete c.removed_at; return c; });
    return JSON.stringify({ alvo: a.nome, colunas, cartoes: semId }, null, 2);
  }
  return textoDoQuadro(colunas, cartoes, { local: o.local, todos: o.todos, coluna, etiqueta: o.etiqueta });
}

/* ver: um cartão inteiro, em texto ou em JSON (a forma da rota do detalhe).
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto. */
function cmdVer(o, d) {
  const a = alvoDe(o.local);
  const det = detalheDasLinhas(ler(d, a, sqlVer(o.numero)));
  if (!det) throw new ErroKanban('Não há nenhum cartão ' + chaveDe(o.numero) + ' ' + ondeFica(a) + ' (confirma com o listar; é --local?).');
  if (o.json) { const j = Object.assign({}, det); delete j.colunas; return JSON.stringify(j, null, 2); }
  return textoDoCartao(det, o.local);
}

/* criar: confere a coluna e o pai, cria o cartão e diz a chave dele.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto («KAN-78 criado em «A fazer» …»). */
function cmdCriar(o, d) {
  const a = alvoDe(o.local);
  const [cols, arvore] = ler(d, a, [sqlColunas(), sqlArvore()]);
  const coluna = colunaPorTexto(cols.map(colunaDaLinha), o.coluna);
  conferePaiNaArvore({ id: null }, o.campos.tipo, o.campos.pai, arvore);
  const uuid = d.uuid();
  escrever(d, a, sqlCriar(o.campos, coluna, d.agora(), uuid));
  const l = ler(d, a, [instrucao('SELECT numero, coluna_id FROM kanban_cartoes WHERE id = ?', [uuid])])[0][0];
  if (!l) throw new ErroKanban('O cartão não ficou criado ' + ondeFica(a) + ': repete, e vê o listar.');
  return chaveDe(l.numero) + ' criado em «' + coluna.nome + '» ' + ondeFica(a) + ': ' + o.campos.titulo;
}

/* editar: muda só os campos dados que ficam diferentes, com as regras do pai.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto com o que mudou. */
function cmdEditar(o, d) {
  const a = alvoDe(o.local);
  const k = umCartao(d, a, o.numero);
  const c = o.campos;
  const tipo = c.tipo || k.tipo;
  const mudaPai = Object.prototype.hasOwnProperty.call(c, 'pai');
  const paiNumero = mudaPai ? c.pai : k.pai ? numeroDaChave(k.pai.chave) : null;
  let pai = null;
  if (mudaPai || c.tipo) pai = conferePaiNaArvore(k, tipo, paiNumero, ler(d, a, [sqlArvore()])[0], mudaPai);
  const mudancas = mudancasDoEditar(k, c, paiNumero == null ? null : chaveDe(paiNumero));
  if (!mudancas.length) return 'Nada mudou no ' + k.chave + ': já estava assim.';
  escrever(d, a, sqlEditar(k, mudancas, pai ? pai.id : null, d.agora()));
  return k.chave + ' editado ' + ondeFica(a) + ': ' + mudancas.map((m) => NOMES_DOS_CAMPOS[m.campo] || m.campo).join(', ') + '.';
}

/* mover: o cartão para o topo da coluna (o id ou o nome dela).
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto com de onde para onde. */
function cmdMover(o, d) {
  const a = alvoDe(o.local);
  const [cs, cols] = ler(d, a, [sqlUmCartao(o.numero), sqlColunas()]);
  if (!cs[0]) throw new ErroKanban('Não há nenhum cartão ' + chaveDe(o.numero) + ' ' + ondeFica(a) + ' (confirma com o listar; é --local?).');
  if (cs[0].removed_at != null) throw new ErroKanban('O ' + chaveDe(o.numero) + ' foi removido: repor é do master, no back office.');
  const k = cartaoDaLinha(cs[0]);
  const colunas = cols.map(colunaDaLinha);
  const coluna = colunaPorTexto(colunas, o.coluna);
  const daqui = colunas.find((x) => x.id === k.coluna_id);
  escrever(d, a, sqlMover(k, coluna, d.agora()));
  const depois = umCartao(d, a, o.numero);
  if (depois.coluna_id !== coluna.id) throw new ErroKanban('O ' + k.chave + ' não ficou em «' + coluna.nome + '»: vê o listar.');
  return k.coluna_id === coluna.id
    ? k.chave + ' subiu ao topo de «' + coluna.nome + '» ' + ondeFica(a) + '.'
    : k.chave + ': «' + (daqui ? daqui.nome : k.coluna_id) + '» → «' + coluna.nome + '» (no topo) ' + ondeFica(a) + '.';
}

/* comentar: o comentário do Claude no cartão.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto. */
function cmdComentar(o, d) {
  const a = alvoDe(o.local);
  const k = umCartao(d, a, o.numero);
  const uuid = d.uuid();
  escrever(d, a, sqlComentar(k, o.texto, d.agora(), uuid));
  const ficou = ler(d, a, [instrucao('SELECT id FROM kanban_comentarios WHERE id = ?', [uuid])])[0];
  if (!ficou.length) throw new ErroKanban('O comentário não ficou no ' + k.chave + ': repete.');
  return 'Comentário escrito no ' + k.chave + ' ' + ondeFica(a) + ' (como ' + CLAUDE.nome + ').';
}

/* ligar: a ligação entre dois cartões, se ainda não existir.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto. */
function cmdLigar(o, d) {
  const a = alvoDe(o.local);
  const um = umCartao(d, a, o.numero);
  const outro = umCartao(d, a, o.outro);
  const existentes = ler(d, a, [instrucao('SELECT de_id, para_id, tipo FROM kanban_ligacoes WHERE (de_id = ? AND para_id = ?) OR (de_id = ? AND para_id = ?)',
    [um.id, outro.id, outro.id, um.id])])[0];
  const de = o.ligacao === 'bloqueado' ? outro : um, para = o.ligacao === 'bloqueado' ? um : outro;
  const frase = { bloqueia: um.chave + ' bloqueia ' + outro.chave, bloqueado: um.chave + ' é bloqueado por ' + outro.chave, relaciona: um.chave + ' relaciona-se com ' + outro.chave }[o.ligacao];
  const ja = o.ligacao === 'relaciona'
    ? existentes.some((l) => l.tipo === 'relaciona')
    : existentes.some((l) => l.tipo === 'bloqueia' && l.de_id === de.id && l.para_id === para.id);
  if (ja) return 'Já estava ligado: ' + frase + '.';
  const uuid = d.uuid();
  escrever(d, a, sqlLigar(um, o.ligacao, outro, d.agora(), uuid));
  const ficou = ler(d, a, [instrucao('SELECT id FROM kanban_ligacoes WHERE id = ?', [uuid])])[0];
  if (!ficou.length) throw new ErroKanban('A ligação não ficou: repete.');
  return frase + ' ' + ondeFica(a) + '.';
}

/* importar-jira: confere a exportação toda, cria numa só escrita os cartões
   que faltam e diz o que fez e o que saltou.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto. */
function cmdImportarJira(o, d) {
  const a = alvoDe(o.local);
  let json;
  try {
    json = JSON.parse(String(d.lerFicheiro(o.ficheiro)).replace(/^﻿/, ''));
  } catch (e) {
    throw new ErroKanban('Não consegui ler o JSON de ' + o.ficheiro + ': ' + e.message);
  }
  const [cols, existentes] = ler(d, a, [sqlColunas(), 'SELECT numero, titulo, removed_at FROM kanban_cartoes']);
  const colunas = cols.map(colunaDaLinha);
  const plano = planoDoJira(json, existentes, colunas);
  const L = [];
  if (plano.novos.length) {
    escrever(d, a, sqlImportar(plano.novos, d.uuid, d.agora()));
    const nums = plano.novos.map((t) => t.numero);
    const [ficaram, contador] = ler(d, a, [
      'SELECT numero FROM kanban_cartoes WHERE numero IN (' + nums.join(', ') + ')',
      'SELECT ultimo FROM kanban_contador WHERE id = 1',
    ]);
    if (ficaram.length !== nums.length) throw new ErroKanban('Só ficaram ' + ficaram.length + ' de ' + nums.length + ' cartões: vê o listar.');
    const porColuna = colunas.map((k) => [k, plano.novos.filter((t) => t.coluna === k.id).length]).filter(([, n]) => n);
    const comentarios = plano.novos.reduce((n, t) => n + t.comentarios.length, 0);
    L.push('Importei ' + conta(plano.novos.length, 'cartão', 'cartões') + ' do Jira ' + ondeFica(a) + ': ' + porColuna.map(([k, n]) => k.nome + ' ' + n).join(', ')
      + '; ' + conta(comentarios, 'comentário', 'comentários') + '. O contador ficou em ' + chaveDe((contador[0] && contador[0].ultimo) || 0) + '.');
  } else {
    const n = plano.saltados.length;
    L.push(n ? 'Nada a importar ' + ondeFica(a) + ': ' + (n === 1 ? 'a única tarefa do ficheiro já existia.' : 'as ' + n + ' tarefas já existiam.')
      : 'O ficheiro não tem tarefas: nada a importar.');
  }
  if (plano.novos.length && plano.saltados.length) L.push('Saltei ' + conta(plano.saltados.length, 'chave que já existia', 'chaves que já existiam') + ': ' + plano.saltados.map((s) => s.chave).join(', ') + '.');
  plano.saltados.filter((s) => s.existente.titulo !== s.titulo || s.existente.removido).forEach((s) => {
    L.push('Atenção: o ' + s.chave + ' que já existe ' + (s.existente.removido ? 'está removido' : 'tem outro título («' + s.existente.titulo + '»)') + '; o do Jira («' + s.titulo + '») não entrou.');
  });
  return L.join('\n');
}

/* sincronizar: os cartões dos pedidos aceites, pela regra. Sem --local lê os
   pedidos da produção (só SELECT) e do dev, e escreve no dev; com --local, só
   a base isolada. Só escreve o que está por acertar, e diz o que fez.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto. */
function cmdSincronizar(o, d) {
  const a = alvoDe(o.local);
  const daProducao = o.local ? [] : ler(d, PRODUCAO, [sqlPedidosAceites()])[0];
  const [doAlvo, antes, cols] = ler(d, a, [sqlPedidosAceites(), sqlCartoesDosPedidos(), sqlColunas()]);
  const { pedidos, repetidos } = juntaPedidos(daProducao, doAlvo, a.nome);
  const plano = planoDaSincronizacao(pedidos, antes);
  const nomeDaColuna = (id) => { const c = cols.find((x) => x.id === id); return c ? c.nome : id; };
  const origem = o.local ? '' : ' (' + daProducao.length + ' da produção, ' + doAlvo.length + ' do dev)';
  const L = ['Sincronização dos pedidos aceites ' + ondeFica(a) + ': ' + conta(pedidos.length, 'pedido lido', 'pedidos lidos') + origem + '.'];
  if (repetidos.length) L.push('Nas duas bases (conta o da produção): ' + repetidos.join(', ') + '.');
  if (plano.aMexer.length) {
    escrever(d, a, sqlSincronizar(plano.aMexer, d.agora(), d.uuid));
    const depois = ler(d, a, [sqlCartoesDosPedidos()])[0];
    const m = mudancasDosCartoes(antes, depois);
    L.push(m.criados.length ? (m.criados.length === 1 ? 'Criei 1 cartão: ' : 'Criei ' + m.criados.length + ' cartões: ')
      + m.criados.map((c) => chaveDe(c.numero) + ' «' + c.titulo + '» (' + nomeDaColuna(c.coluna_id) + ')').join(', ') + '.' : 'Não criei nenhum cartão.');
    L.push(m.movidos.length ? (m.movidos.length === 1 ? 'Movi 1 cartão: ' : 'Movi ' + m.movidos.length + ' cartões: ')
      + m.movidos.map((x) => chaveDe(x.linha.numero) + ' ' + nomeDaColuna(x.de) + ' → ' + nomeDaColuna(x.linha.coluna_id)).join(', ') + '.' : 'Não movi nenhum cartão.');
    const parados = plano.aMexer.length - m.criados.length - m.movidos.length;
    if (parados > 0) L.push(conta(parados, 'cartão mudou', 'cartões mudaram') + ' só o estado visto (estava numa coluna que a regra não desfaz, como Concluído ou Para depois).');
  } else {
    L.push('Nada a acertar: criei 0 cartões e movi 0.');
  }
  const resto = [];
  if (plano.emDia) resto.push(conta(plano.emDia, 'já em dia', 'já em dia'));
  if (plano.removidos) resto.push(conta(plano.removidos, 'com o cartão removido (fica como está)', 'com o cartão removido (ficam como estão)'));
  if (plano.recusados) resto.push(conta(plano.recusados, 'recusado (sem cartão)', 'recusados (sem cartão)'));
  if (resto.length) L.push('Os outros: ' + resto.join(', ') + '.');
  return L.join('\n');
}

/* Corre a linha de comandos e devolve o código de saída; os erros conhecidos
   saem numa linha clara no stderr, sem pilha.
   Recebe: argv — os argumentos depois do script; deps (opcional) — as
   dependências a trocar ({ ler, escrever, agora, uuid, lerFicheiro }), para os
   testes; saida (opcional) — { out, err }, onde escrever (o stdout e o stderr por omissão).
   Devolve: o código de saída (0 bem, 1 falhou, 2 argumentos). */
export function principal(argv, deps, saida) {
  const out = (saida && saida.out) || ((t) => process.stdout.write(t));
  const err = (saida && saida.err) || ((t) => process.stderr.write(t));
  try {
    const o = lerArgumentos(argv);
    const d = dependencias(deps);
    const fazer = {
      listar: cmdListar, ver: cmdVer, criar: cmdCriar, editar: cmdEditar, mover: cmdMover, comentar: cmdComentar,
      ligar: cmdLigar, 'importar-jira': cmdImportarJira, sincronizar: cmdSincronizar,
    }[o.comando];
    out(fazer(o, d) + '\n');
    return 0;
  } catch (e) {
    if (e instanceof ErroKanban || e instanceof ErroTicket) {
      err('kanban: ' + e.message + '\n');
      return e.codigo || 1;
    }
    err('kanban: falha inesperada: ' + (e && e.stack || e) + '\n');
    return 1;
  }
}

/* O caminho verdadeiro de um ficheiro, para comparar: o Windows chega a dar o
   mesmo sítio com nomes curtos (MARTIN~1) ou com outras maiúsculas.
   Recebe: p — o caminho.
   Devolve: o caminho resolvido, em minúsculas. */
function caminhoReal(p) {
  try { return realpathSync.native(p).toLowerCase(); } catch (e) { return path.resolve(p).toLowerCase(); }
}

// só corre a linha de comandos quando é o ponto de entrada (os testes importam as funções)
if (process.argv[1] && caminhoReal(process.argv[1]) === caminhoReal(fileURLToPath(import.meta.url))) {
  process.exitCode = principal(process.argv.slice(2));
}
