// Os tickets de QA do ambiente de desenvolvimento, do lado de quem os
// resolve. Quem testa a app no dev escreve-os no próprio ecrã (web/cloud/qa.js,
// gravados por worker/src/rotas/qa.js na tabela qa_tickets e, a captura, no R2
// em qa/<id>); o Claude lê-os e fecha-os daqui, quando o Martinho pede
// «resolve os tickets de QA» (a skill .claude/skills/qa/SKILL.md, fora do app/).
//
//   node scripts/qa.mjs listar [--local] [--todos] [--json]
//   node scripts/qa.mjs imagem <id> [--local] [--para <pasta>]
//   node scripts/qa.mjs comecar <id> [<id>…] [--local]
//   node scripts/qa.mjs resolver <id> --nota "o que se fez" [--commit <sha>] [--local]
//   node scripts/qa.mjs reabrir <id> [--local]
//
// Um ticket tem três estados: novo (status 'aberto', como nasce e como volta
// ao reabrir), em resolução ('em_resolucao', marcado com comecar logo que se
// pega nele) e resolvido. A app mostra-os nesta ordem, e o listar também.
//
// listar mostra os por resolver — os novos e os em resolução (com --todos,
// também os resolvidos) —, cada um com
// tudo o que é preciso para o resolver sem abrir a app: a descrição inteira,
// a gravidade, quem e quando, o contexto do ecrã e se tem imagem. --json dá o
// mesmo na forma do GET /api/qa, para máquinas.
// imagem descarrega a captura para os.tmpdir()/rendorium-qa (ou --para) e
// diz o caminho, com a extensão do tipo verdadeiro (png, jpg ou webp).
// comecar passa os tickets dados a em resolução (recusa um resolvido: esse
// reabre-se primeiro). resolver marca resolvido, com a nota (e o commit) como
// resolução; reabrir devolve-o aos novos e guarda a resolução, como a rota da app.
// Remover não existe aqui de propósito: é do Martinho, na app.
//
// Sem --local, a base é a do dev na Cloudflare (gestor-imobiliario-dev, e o
// bucket gestor-imobiliario-dev). O wrangler.toml do repositório tem
// PLACEHOLDER nos ids (o CI troca-os no deploy), por isso o script pede o id a
// `wrangler d1 list --json` e escreve um wrangler.toml temporário só com o dev,
// passado com -c. Com --local, é a base isolada do servidor 8788
// (.wrangler/state-revisao, base e bucket gestor-imobiliario do topo do
// wrangler.toml). A produção nunca: confereAlvo recusa qualquer outro par
// antes de o wrangler correr, e não há opção que o mude.
//
// Os valores do SQL entram escapados (cita: plicas dobradas) e os ids e o
// sha passam por um molde antes — o wrangler d1 execute não aceita parâmetros
// ligados, e o texto das notas é livre.
// Com QA_VERBOSO=1, cada chamada ao wrangler é escrita no stderr antes de
// correr (a prova usa-o para mostrar que o listar remoto só lê).

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = path.join(RAIZ, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const PERSIST = path.join(RAIZ, '.wrangler', 'state-revisao');
const PASTA_TEMP = path.join(os.tmpdir(), 'rendorium-qa');

export const COMANDOS = ['listar', 'imagem', 'comecar', 'resolver', 'reabrir'];
// os dois sítios onde o script pode ir, e só estes: o dev na Cloudflare e a base isolada
export const ALVOS = {
  remoto: { local: false, base: 'gestor-imobiliario-dev', bucket: 'gestor-imobiliario-dev' },
  local: { local: true, base: 'gestor-imobiliario', bucket: 'gestor-imobiliario' },
};
const GRAVIDADES = ['bloqueia', 'incomoda', 'detalhe'];
const TETO_NOTA = 4000;

export const USO = [
  'Uso:',
  '  node scripts/qa.mjs listar [--local] [--todos] [--json]',
  '  node scripts/qa.mjs imagem <id> [--local] [--para <pasta>]',
  '  node scripts/qa.mjs comecar <id> [<id>…] [--local]',
  '  node scripts/qa.mjs resolver <id> --nota "o que se fez" [--commit <sha>] [--local]',
  '  node scripts/qa.mjs reabrir <id> [--local]',
  '',
  'Sem --local é a base do dev na Cloudflare; com --local, a base isolada do 8788 (.wrangler/state-revisao).',
].join('\n');

// O erro que a linha de comandos mostra sem pilha: a mensagem chega para agir.
export class ErroQa extends Error {
  /* Recebe: mensagem — o que correu mal, em português, já com o que fazer;
     codigo (opcional) — o código de saída (1 por omissão, 2 nos argumentos).
     Devolve: o erro, com .codigo. */
  constructor(mensagem, codigo = 1) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/* ------------------------- argumentos ----------------------------------- */

// as opções de cada comando: as que levam valor e as que são só um sinal
const OPCOES = {
  listar: { sinais: ['--local', '--todos', '--json'], valores: [] },
  imagem: { sinais: ['--local'], valores: ['--para'] },
  comecar: { sinais: ['--local'], valores: [] },
  resolver: { sinais: ['--local'], valores: ['--nota', '--commit'] },
  reabrir: { sinais: ['--local'], valores: [] },
};

/* Lê a linha de comandos: o comando, o id (nos que o pedem) e as opções,
   aceitando «--nota texto» e «--nota=texto». Recusa o que não conhece em vez
   de o ignorar: uma opção mal escrita (--loca) ia ao dev em vez da base local.
   Recebe: argv — os argumentos depois do script (array de texto).
   Devolve: { comando, id, ids, local, todos, json, para, nota, commit } —
   ids só no comecar, que aceita vários (id é o primeiro); lança
   ErroQa (código 2) com a razão e o uso. */
export function lerArgumentos(argv) {
  const lista = Array.isArray(argv) ? argv.slice() : [];
  const comando = lista.shift();
  const falha = (porque) => { throw new ErroQa(porque + '\n\n' + USO, 2); };
  if (!comando) falha('Falta o comando.');
  if (!COMANDOS.includes(comando)) falha('Não conheço o comando «' + comando + '».');
  const { sinais, valores } = OPCOES[comando];
  const r = { comando, id: null, ids: null, local: false, todos: false, json: false, para: null, nota: null, commit: null };
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
        if (v === undefined || String(v).startsWith('--')) falha('A opção ' + nome + ' precisa de um valor.');
      }
      r[nome.slice(2)] = String(v);
    } else falha('O comando ' + comando + ' não aceita a opção ' + nome + '.');
  }
  const pedeId = comando !== 'listar';
  if (pedeId) {
    if (!soltos.length) falha('Falta o id do ticket (vê-se no listar).');
    r.id = confereId(soltos.shift());
  }
  if (comando === 'comecar') {
    r.ids = [r.id].concat(soltos.splice(0).map(confereId)).filter((id, i, todos) => todos.indexOf(id) === i);
  }
  if (soltos.length) falha('Não sei o que fazer com «' + soltos.join(' ') + '».');
  if (comando === 'resolver') {
    r.nota = r.nota == null ? '' : r.nota.trim();
    if (!r.nota) falha('O resolver precisa de --nota com o que se fez (é o que o Martinho lê na app).');
    if (r.nota.length > TETO_NOTA) falha('A nota passa dos ' + TETO_NOTA + ' caracteres.');
    if (r.commit != null) r.commit = confereCommit(r.commit);
  }
  if (comando === 'imagem' && r.para != null && !r.para.trim()) falha('O --para precisa de uma pasta.');
  return r;
}

/* Um id de ticket com a forma dos que a rota cria (uuid), antes de chegar ao
   SQL: um id com plicas ou espaços é um engano de cópia, e diz-se.
   Recebe: id — o texto dado na linha de comandos.
   Devolve: o id aparado; lança ErroQa (código 2) se não tiver a forma. */
export function confereId(id) {
  const t = String(id == null ? '' : id).trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(t)) throw new ErroQa('O id «' + t + '» não tem a forma de um id de ticket (letras, algarismos e hífenes, como no listar).', 2);
  return t;
}

/* Um sha de commit (7 a 40 algarismos hexadecimais), em minúsculas.
   Recebe: sha — o texto do --commit.
   Devolve: o sha aparado em minúsculas; lança ErroQa (código 2) se não o for. */
export function confereCommit(sha) {
  const t = String(sha == null ? '' : sha).trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(t)) throw new ErroQa('O --commit «' + t + '» não é um sha (7 a 40 algarismos hexadecimais; git log --oneline mostra-o).', 2);
  return t;
}

/* ------------------------- o alvo: dev ou local, nunca a produção -------- */

/* O alvo de um pedido: o dev na Cloudflare ou a base isolada do 8788.
   Recebe: local — true para a base isolada (--local).
   Devolve: uma cópia do alvo ({ local, base, bucket }). */
export function alvoDe(local) {
  return Object.assign({}, local ? ALVOS.local : ALVOS.remoto);
}

/* A guarda da produção: só passam os dois pares de ALVOS, exatamente. A base
   gestor-imobiliario sem --local É a produção (o mesmo nome, outro sítio), e
   recusa-se aqui, antes de qualquer chamada ao wrangler.
   Recebe: a — o alvo ({ local, base, bucket }).
   Devolve: o mesmo alvo; lança ErroQa se não for o dev nem a base local. */
export function confereAlvo(a) {
  const ok = a && Object.values(ALVOS).some((b) => b.local === a.local && b.base === a.base && b.bucket === a.bucket);
  if (!ok) {
    const onde = a ? (a.local ? 'local ' : 'remota ') + (a.base || '?') + ' / ' + (a.bucket || '?') : 'nenhuma';
    throw new ErroQa('Recuso a base ' + onde + ': este script só lê e escreve na base do dev (gestor-imobiliario-dev) ou na isolada (--local). A produção não se toca.');
  }
  return a;
}

/* O wrangler.toml temporário do dev: só a base e o bucket do dev, com o id
   verdadeiro (o do repositório tem PLACEHOLDER). Recusa um id vazio.
   Recebe: uuid — o id da base gestor-imobiliario-dev (de wrangler d1 list).
   Devolve: o texto do ficheiro. */
export function configDoDev(uuid) {
  if (!/^[0-9a-f-]{36}$/i.test(String(uuid || ''))) throw new ErroQa('O id da base do dev veio estranho do wrangler («' + uuid + '»).');
  return [
    '# Temporário, escrito por scripts/qa.mjs para ler/escrever os tickets de QA do dev.',
    'name = "gestor-imobiliario-dev"',
    'compatibility_date = "2026-08-01"',
    '',
    '[[d1_databases]]',
    'binding = "DB"',
    'database_name = "' + ALVOS.remoto.base + '"',
    'database_id = "' + uuid + '"',
    '',
    '[[r2_buckets]]',
    'binding = "FILES"',
    'bucket_name = "' + ALVOS.remoto.bucket + '"',
    '',
  ].join('\n');
}

/* ------------------------- SQL ------------------------------------------ */

/* Um valor como literal SQL: NULL, número tal e qual, texto entre plicas com
   as plicas dobradas (e sem o carácter nulo, que o SQLite corta).
   Recebe: v — null/undefined, número ou texto.
   Devolve: o literal (texto), pronto a entrar no SQL. */
export function cita(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.trunc(v)) : 'NULL';
  return "'" + String(v).replace(/\u0000/g, '').replace(/'/g, "''") + "'";
}

/* O SELECT do listar: os tickets não removidos, com o nome e o email de quem
   os escreveu, na ordem do GET /api/qa (os novos e depois os em resolução,
   cada parte agrupada por gravidade — bloqueia, incomoda, detalhe, sem
   gravidade — e em cada grupo do mais recente para o mais antigo, e no fim
   os resolvidos pela data da resolução), teto de 200.
   Recebe: todos — true para juntar os resolvidos.
   Devolve: o SQL (texto, uma linha). */
export function sqlListar(todos) {
  return 'SELECT q.id, q.user_id, q.discord_id, q.discord_nome, q.body, q.severity, q.context, q.image_key, q.status, q.resolution,'
    + ' q.resolved_at, q.created_at, q.updated_at, u.name AS autor_nome, u.email AS autor_email'
    + ' FROM qa_tickets q LEFT JOIN users u ON u.id = q.user_id'
    + ' WHERE q.removed_at IS NULL' + (todos ? '' : " AND q.status <> 'resolvido'")
    + " ORDER BY CASE q.status WHEN 'aberto' THEN 0 WHEN 'em_resolucao' THEN 1 ELSE 2 END,"
    + " CASE WHEN q.status = 'resolvido' THEN 0 WHEN q.severity = 'bloqueia' THEN 0 WHEN q.severity = 'incomoda' THEN 1"
    + " WHEN q.severity = 'detalhe' THEN 2 ELSE 3 END,"
    + " CASE q.status WHEN 'resolvido' THEN COALESCE(q.resolved_at, q.updated_at) ELSE q.created_at END DESC,"
    + ' q.created_at DESC LIMIT 200';
}

/* O SELECT de um ticket só, para saber se existe e em que estado está antes
   de lhe mexer (inclui os removidos, para o dizer em vez de «não existe»).
   Recebe: id — o id já conferido.
   Devolve: o SQL (texto). */
export function sqlUm(id) {
  return 'SELECT id, status, resolution, resolved_at, image_key, removed_at FROM qa_tickets WHERE id = ' + cita(id);
}

/* A resolução que fica no ticket: a nota e, havendo, o commit numa linha
   própria (a app mostra-a tal e qual).
   Recebe: nota — o que se fez; commit (opcional) — o sha.
   Devolve: o texto da resolução. */
export function notaDaResolucao(nota, commit) {
  const n = String(nota || '').trim();
  return commit ? n + '\n\nCommit: ' + commit : n;
}

/* O UPDATE do resolver: status resolvido, a resolução, resolved_at e
   updated_at. Só em tickets não removidos.
   Recebe: id — o id conferido; resolucao — o texto (notaDaResolucao);
   agora — o instante em ms (Date.now()).
   Devolve: o SQL (texto). */
export function sqlResolver(id, resolucao, agora) {
  return "UPDATE qa_tickets SET status = 'resolvido', resolution = " + cita(resolucao)
    + ', resolved_at = ' + cita(agora) + ', updated_at = ' + cita(agora)
    + ' WHERE id = ' + cita(id) + ' AND removed_at IS NULL';
}

/* O UPDATE do comecar: um ticket novo passa a em resolução. Só os novos
   (status 'aberto') e não removidos: um resolvido não volta por aqui.
   Recebe: id — o id conferido; agora — o instante em ms.
   Devolve: o SQL (texto). */
export function sqlComecar(id, agora) {
  return "UPDATE qa_tickets SET status = 'em_resolucao', updated_at = " + cita(agora)
    + ' WHERE id = ' + cita(id) + " AND status = 'aberto' AND removed_at IS NULL";
}

/* O UPDATE do reabrir: volta a novo (status 'aberto') e larga o resolved_at; a resolução
   fica (o próximo a pegar no ticket vê o que já se tentou — o contrato da rota).
   Recebe: id — o id conferido; agora — o instante em ms.
   Devolve: o SQL (texto). */
export function sqlReabrir(id, agora) {
  return "UPDATE qa_tickets SET status = 'aberto', resolved_at = NULL, updated_at = " + cita(agora)
    + ' WHERE id = ' + cita(id) + ' AND removed_at IS NULL';
}

/* ------------------------- o texto do listar ---------------------------- */

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

/* «1 aberto», «3 abertos»: o plural certo.
   Recebe: n — a contagem; um — a forma singular; varios — a forma plural.
   Devolve: o texto com o número. */
function conta(n, um, varios) {
  return n + ' ' + (n === 1 ? um : varios);
}

/* Uma linha de uma linha só: um valor qualquer como texto curto (objetos em
   JSON), sem quebras.
   Recebe: v — o valor.
   Devolve: o texto. */
function curto(v) {
  if (v == null) return '';
  return (typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/\s*\n\s*/g, ' ');
}

/* O contexto que a app junta ao ticket, escrito para quem vai resolver: onde
   estava (separador, página, ficha, janela aberta, hash), a versão e o
   ambiente, o ecrã, o tema, o ponteiro, o agente, o rasto dos últimos passos
   e quando. Só o que lá está (nada se inventa); o que não se conhece sai no
   fim em JSON, para não se perder.
   Recebe: ctx — o objeto do contexto (ou nada, ou texto por ler).
   Devolve: array de linhas (texto), vazio sem contexto. */
export function contextoLegivel(ctx) {
  if (ctx == null || ctx === '') return [];
  if (typeof ctx !== 'object' || Array.isArray(ctx)) return ['Por ler (não é um objeto): ' + curto(ctx)];
  const linhas = [];
  const resto = Object.assign({}, ctx);
  const tira = (k) => { const v = resto[k]; delete resto[k]; return v; };
  const ecra = tira('ecra');
  if (ecra && typeof ecra === 'object') {
    const e = Object.assign({}, ecra);
    const partes = [];
    if (e.tab != null) partes.push('separador «' + curto(e.tab) + '»');
    if (e.pagina != null && e.pagina !== '') partes.push('página «' + curto(e.pagina) + '»');
    if (e.ficha && typeof e.ficha === 'object') partes.push('ficha ' + [e.ficha.tipo, e.ficha.id].filter((x) => x != null && x !== '').map(curto).join(' '));
    if (e.modal != null && e.modal !== '') partes.push('janela aberta «' + curto(e.modal) + '»');
    if (e.hash != null && e.hash !== '') partes.push('endereço ' + curto(e.hash));
    ['tab', 'pagina', 'ficha', 'modal', 'hash'].forEach((k) => delete e[k]);
    Object.keys(e).forEach((k) => partes.push(k + ' ' + curto(e[k])));
    if (partes.length) linhas.push('Ecrã: ' + partes.join(', '));
  } else if (ecra != null) linhas.push('Ecrã: ' + curto(ecra));
  const versao = tira('versao'), ambiente = tira('ambiente');
  if (versao != null || ambiente != null) {
    linhas.push('Versão: ' + (versao != null ? curto(versao) : '?') + (ambiente != null ? ' (ambiente ' + curto(ambiente) + ')' : ''));
  }
  const janela = tira('janela');
  if (janela && typeof janela === 'object') {
    const t = (janela.w != null && janela.h != null ? janela.w + '×' + janela.h + ' px' : '') + (janela.dpr != null ? ' a ' + janela.dpr + 'x' : '');
    linhas.push('Janela: ' + (t.trim() || curto(janela)));
  } else if (janela != null) linhas.push('Janela: ' + curto(janela));
  const tema = tira('tema');
  if (tema && typeof tema === 'object') {
    const partes = [];
    if (tema.escolhido != null) partes.push('escolhido «' + curto(tema.escolhido) + '»');
    if (tema.escuro != null) partes.push(tema.escuro ? 'a ver escuro' : 'a ver claro');
    if (tema.forcado) partes.push('escurecido à força pelo browser');
    linhas.push('Tema: ' + (partes.join(', ') || curto(tema)));
  } else if (tema != null) linhas.push('Tema: ' + curto(tema));
  const ponteiro = tira('ponteiro');
  if (ponteiro != null) linhas.push('Ponteiro: ' + curto(ponteiro));
  const agente = tira('agente');
  if (agente != null) linhas.push('Agente: ' + curto(agente));
  const momento = tira('quando');
  if (momento != null) {
    const ms = Date.parse(momento);
    linhas.push('No aparelho: ' + (Number.isFinite(ms) ? quando(ms) + ' (' + curto(momento) + ')' : curto(momento)));
  }
  const rasto = tira('rasto');
  if (Array.isArray(rasto) && rasto.length) {
    linhas.push('Rasto (do mais antigo para o último):');
    rasto.forEach((p) => linhas.push('  - ' + curto(p)));
  } else if (rasto != null && !Array.isArray(rasto)) linhas.push('Rasto: ' + curto(rasto));
  Object.keys(resto).forEach((k) => linhas.push(k + ': ' + curto(resto[k])));
  return linhas;
}

/* Uma linha da base na forma do GET /api/qa: context como objeto (ou o texto,
   se não se ler), imagem como booleano e o autor junto.
   Recebe: l — a linha do SELECT de sqlListar.
   Devolve: o ticket ({ id, body, severity, context, imagem, status,
   resolution, resolved_at, created_at, updated_at, autor }). */
export function ticketDaLinha(l) {
  let context = null;
  if (l.context != null && l.context !== '') {
    try { context = JSON.parse(l.context); } catch (e) { context = String(l.context); }
  }
  return {
    id: l.id, body: l.body, severity: GRAVIDADES.includes(l.severity) ? l.severity : null,
    context, imagem: !!l.image_key, status: l.status, resolution: l.resolution == null ? null : l.resolution,
    resolved_at: l.resolved_at == null ? null : l.resolved_at, created_at: l.created_at, updated_at: l.updated_at,
    autor: {
      id: l.user_id == null ? null : l.user_id, nome: l.autor_nome || '', email: l.autor_email || '',
      discord: l.discord_id ? { id: String(l.discord_id), nome: l.discord_nome || '' } : null,
    },
  };
}

/* Indenta um texto de várias linhas.
   Recebe: t — o texto; margem — o que vai à frente de cada linha.
   Devolve: o texto indentado. */
function indenta(t, margem) {
  return String(t).replace(/\r\n/g, '\n').split('\n').map((l) => margem + l).join('\n');
}

/* O estado de um ticket como se diz: novo, em resolução ou resolvido.
   Recebe: status — o da base ('aberto', 'em_resolucao', 'resolvido').
   Devolve: o texto (um estado que não conhece sai tal e qual). */
export function estadoLegivel(status) {
  return { aberto: 'novo', em_resolucao: 'em resolução', resolvido: 'resolvido' }[status] || String(status);
}

/* Um ticket por extenso, como o listar o escreve: tudo o que é preciso para
   o resolver sem abrir a app.
   Recebe: t — o ticket (ticketDaLinha); local — true se veio da base isolada
   (para o comando da imagem sair certo).
   Devolve: o texto (várias linhas). */
export function textoDoTicket(t, local) {
  const linhas = [];
  const grav = t.severity ? t.severity.toUpperCase() : 'sem gravidade';
  linhas.push('== ' + t.id + ' · ' + grav + ' · ' + estadoLegivel(t.status));
  // numa conta de teste, o autor é a conta do Discord que pediu o /test; no
  // back office (user_id 'equipa:…', rotas/qa.js:autorDaEquipa), a pessoa da equipa
  const d = t.autor && t.autor.discord;
  const doBackOffice = /^equipa:/.test(String((t.autor && t.autor.id) || ''));
  const quem = d
    ? (d.nome ? d.nome + ' (Discord ' + d.id + ')' : 'Discord ' + d.id) + (doBackOffice ? ', no back office' : ', com uma conta de teste')
    : [t.autor && t.autor.nome, t.autor && t.autor.email ? '<' + t.autor.email + '>' : ''].filter(Boolean).join(' ');
  linhas.push('Quem: ' + (quem || 'conta desconhecida' + (t.autor && t.autor.id ? ' (' + t.autor.id + ')' : '')));
  linhas.push('Quando: ' + (quando(t.created_at) || '?') + (t.updated_at && t.updated_at !== t.created_at ? ' (atualizado a ' + quando(t.updated_at) + ')' : ''));
  linhas.push('Gravidade: ' + (t.severity || 'nenhuma escolhida'));
  linhas.push('Imagem: ' + (t.imagem ? 'sim — node scripts/qa.mjs imagem ' + t.id + (local ? ' --local' : '') : 'não'));
  linhas.push('Descrição:');
  linhas.push(indenta(t.body == null ? '' : t.body, '  '));
  const ctx = contextoLegivel(t.context);
  linhas.push('Contexto:' + (ctx.length ? '' : ' nenhum'));
  ctx.forEach((l) => linhas.push('  ' + l));
  if (t.status === 'resolvido') {
    linhas.push('Resolvido a ' + (quando(t.resolved_at) || '?') + ':');
    linhas.push(indenta(t.resolution || '(sem nota)', '  '));
  } else if (t.resolution) {
    linhas.push('Resolução anterior (foi reaberto — o que já se tentou):');
    linhas.push(indenta(t.resolution, '  '));
  }
  return linhas.join('\n');
}

/* O texto inteiro do listar: o cabeçalho com a base e as contagens, os
   novos e os em resolução, cada parte em grupos por gravidade, e (com
   --todos) os resolvidos, por extenso.
   Recebe: tickets — os tickets (ticketDaLinha), na ordem da base;
   opcoes — { local, todos }.
   Devolve: o texto. */
export function textoDaLista(tickets, opcoes = {}) {
  const onde = opcoes.local ? 'na base isolada (--local)' : 'no dev (gestor-imobiliario-dev)';
  const resolvidos = tickets.filter((t) => t.status === 'resolvido');
  const emResolucao = tickets.filter((t) => t.status === 'em_resolucao');
  // um estado que não se conhece fica com os novos: por resolver, e à vista
  const novos = tickets.filter((t) => t.status !== 'resolvido' && t.status !== 'em_resolucao');
  const partes = [];
  if (!tickets.length) {
    return 'Não há tickets de QA ' + (opcoes.todos ? '' : 'por resolver ') + onde + '.';
  }
  partes.push('Tickets de QA ' + onde + ': ' + conta(novos.length, 'novo', 'novos')
    + ', ' + emResolucao.length + ' em resolução'
    + (opcoes.todos ? ', ' + conta(resolvidos.length, 'resolvido', 'resolvidos') : '') + '.'
    + (tickets.length >= 200 ? ' (Só os primeiros 200.)' : ''));
  [['Novos', novos], ['Em resolução', emResolucao]].forEach(([titulo, ts]) => {
    if (!ts.length) return;
    partes.push('\n#### ' + titulo + ' (' + ts.length + ')');
    // em grupos por gravidade, pela ordem em que a base os deu (sqlListar)
    let grupo;
    ts.forEach((t) => {
      const g = t.severity || null;
      if (g !== grupo) {
        grupo = g;
        const n = ts.filter((x) => (x.severity || null) === g).length;
        partes.push('\n##### ' + (g ? g.charAt(0).toUpperCase() + g.slice(1) : 'Sem gravidade') + ' (' + n + ')');
      }
      partes.push('\n' + textoDoTicket(t, opcoes.local));
    });
  });
  if (opcoes.todos && resolvidos.length) {
    partes.push('\n#### Resolvidos (' + resolvidos.length + ')');
    resolvidos.forEach((t) => partes.push('\n' + textoDoTicket(t, opcoes.local)));
  }
  return partes.join('\n');
}

/* ------------------------- a imagem ------------------------------------- */

/* O tipo de uma imagem pelos primeiros bytes (não pelo nome, que não há).
   Recebe: b — os bytes (Buffer ou Uint8Array).
   Devolve: 'png', 'jpg', 'webp', ou null se não for nenhum destes. */
export function tipoDaImagem(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  const txt = (i, j) => String.fromCharCode.apply(null, Array.from(b.slice(i, j)));
  if (txt(0, 4) === 'RIFF' && txt(8, 12) === 'WEBP') return 'webp';
  return null;
}

/* ------------------------- o wrangler ----------------------------------- */

/* Diz, em português e com o que fazer, porque é que o wrangler falhou.
   Recebe: texto — o que o wrangler escreveu (stdout + stderr).
   Devolve: { tipo, mensagem }, com tipo 'por-migrar', 'sem-sessao', 'rede',
   'sem-objeto' ou 'outro'. */
export function erroDoWrangler(texto) {
  const t = String(texto || '');
  if (/no such table:?\s*qa_tickets/i.test(t)) {
    return { tipo: 'por-migrar', mensagem: 'A tabela qa_tickets ainda não existe nesta base (falta a migração 0023).' };
  }
  if (/not (?:logged in|authenticated)|wrangler login|Authentication error|code:?\s*10000|CLOUDFLARE_API_TOKEN|Invalid access token/i.test(t)) {
    return { tipo: 'sem-sessao', mensagem: 'O wrangler não tem sessão na Cloudflare: corre `npx wrangler login` (ou define CLOUDFLARE_API_TOKEN) e repete.' };
  }
  if (/The specified key does not exist|object not found|NoSuchKey|not found in bucket/i.test(t)) {
    return { tipo: 'sem-objeto', mensagem: 'A imagem não está no R2 (o ticket diz que tem, mas o objeto não existe).' };
  }
  if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|getaddrinfo|network/i.test(t)) {
    return { tipo: 'rede', mensagem: 'Sem ligação à Cloudflare (rede): repete daqui a pouco.' };
  }
  // a linha [ERROR] do wrangler, se houver; senão as primeiras que não são avisos, banners nem o «Logs were written»
  const linhas = t.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const doErro = linhas.filter((l) => /\[ERROR\]/.test(l)).map((l) => l.replace(/^.*?\[ERROR\]\s*/, ''));
  const resto = linhas.filter((l) => !/^[▲⛅─╭╰│🪵]|\[WARNING\]|Logs were written|^\[qa\]/u.test(l));
  const linha = (doErro.length ? doErro : resto).slice(0, 3).join(' ');
  return { tipo: 'outro', mensagem: 'O wrangler falhou: ' + (linha || 'sem mensagem') };
}

/* O que dizer quando a tabela ainda não existe, conforme o sítio: o dev só
   a recebe com o deploy (e daqui não se migra o dev); a base isolada migra-se
   à mão, com o execute (o migrations apply com o 8788 de pé mata-o).
   Recebe: local — true para a base isolada.
   Devolve: a mensagem (texto). */
export function mensagemPorMigrar(local) {
  return local
    ? 'A tabela qa_tickets ainda não existe na base isolada: aplica a migração com `npx wrangler d1 execute gestor-imobiliario --local --persist-to .wrangler/state-revisao --file migrations/0023_qa_tickets.sql` (nunca o migrations apply com o 8788 de pé).'
    : 'A tabela qa_tickets ainda não existe no dev: a migração 0023 chega lá com o próximo deploy do ramo dev. Até lá não há tickets no dev para ler.';
}

/* Corre o wrangler do repositório (node_modules), sem shell: os argumentos
   vão tal e qual, com plicas, ponto e vírgula e quebras de linha das notas.
   Recebe: args — os argumentos do wrangler (array de texto).
   Devolve: { status, stdout, stderr }; lança ErroQa se o wrangler não estiver instalado. */
function correWrangler(args) {
  if (!existsSync(WRANGLER)) throw new ErroQa('Não encontro o wrangler em ' + WRANGLER + ': corre `npm install` no app/.');
  if (process.env.QA_VERBOSO === '1') process.stderr.write('[qa] wrangler ' + args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ') + '\n');
  const r = spawnSync(process.execPath, [WRANGLER].concat(args), {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 180000, windowsHide: true,
    env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' }),
  });
  if (r.error) throw new ErroQa('O wrangler não correu: ' + r.error.message);
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/* Lê o JSON que o wrangler escreve com --json, mesmo com avisos à volta.
   Recebe: texto — o stdout.
   Devolve: o valor lido, ou undefined se não houver JSON. */
export function lerJsonDoWrangler(texto) {
  const t = String(texto || '').trim();
  if (!t) return undefined;
  try { return JSON.parse(t); } catch (e) { /* há texto à volta: procura-se o JSON */ }
  const i = t.search(/[[{]/);
  if (i < 0) return undefined;
  try { return JSON.parse(t.slice(i)); } catch (e) { return undefined; }
}

let configTemp = null;

/* Os argumentos do wrangler que apontam para o alvo: --local com a pasta
   isolada (e o wrangler.toml do repositório), ou --remote com o wrangler.toml
   temporário do dev. Passa sempre pela guarda da produção.
   Recebe: a — o alvo.
   Devolve: array de argumentos. */
function argsDoAlvo(a) {
  confereAlvo(a);
  if (a.local) return ['--local', '--persist-to', PERSIST];
  if (!configTemp) {
    const r = correWrangler(['d1', 'list', '--json']);
    const lista = lerJsonDoWrangler(r.stdout);
    if (r.status !== 0 || !Array.isArray(lista)) throw new ErroQa(erroDoWrangler(r.stdout + '\n' + r.stderr).mensagem);
    const dev = lista.find((d) => d && d.name === ALVOS.remoto.base);
    if (!dev) throw new ErroQa('A conta do wrangler não tem a base ' + ALVOS.remoto.base + ' (wrangler d1 list não a mostra): é a conta certa?');
    mkdirSync(PASTA_TEMP, { recursive: true });
    configTemp = path.join(PASTA_TEMP, 'wrangler-dev.toml');
    writeFileSync(configTemp, configDoDev(dev.uuid));
  }
  return ['--remote', '-c', configTemp];
}

/* Corre um comando SQL no alvo e devolve o primeiro resultado.
   Recebe: a — o alvo; sql — o comando (uma instrução).
   Devolve: { results, meta } do wrangler; lança ErroQa (com .tipo) se falhar. */
function executar(a, sql) {
  const args = ['d1', 'execute', a.base].concat(argsDoAlvo(a), ['--json', '--yes', '--command', sql]);
  const r = correWrangler(args);
  const j = lerJsonDoWrangler(r.stdout);
  const erro = j && !Array.isArray(j) && j.error;
  if (r.status !== 0 || erro || !Array.isArray(j)) {
    const e = erroDoWrangler([erro ? (erro.text || '') + ' ' + JSON.stringify(erro.notes || '') : '', r.stdout, r.stderr].join('\n'));
    const x = new ErroQa(e.tipo === 'por-migrar' ? mensagemPorMigrar(a.local) : e.mensagem);
    x.tipo = e.tipo;
    throw x;
  }
  const res = j[0] || {};
  return { results: Array.isArray(res.results) ? res.results : [], meta: res.meta || {} };
}

/* ------------------------- os comandos ---------------------------------- */

/* O ticket tal como está, antes de lhe mexer: existe? foi removido?
   Recebe: a — o alvo; id — o id conferido.
   Devolve: a linha (id, status, resolution, resolved_at, image_key); lança
   ErroQa se não existir ou estiver removido. */
function umTicket(a, id) {
  const l = executar(a, sqlUm(id)).results[0];
  if (!l) throw new ErroQa('Não há nenhum ticket com o id ' + id + (a.local ? ' na base isolada.' : ' no dev.') + ' (Confirma com o listar; é --local?)');
  if (l.removed_at != null) throw new ErroQa('O ticket ' + id + ' foi removido na app (' + quando(l.removed_at) + '): não se mexe nele. Remover e repor é do Martinho, na app.');
  return l;
}

/* listar: os tickets em texto ou em JSON. Sem a tabela (o dev antes do
   deploy da 0023) não é um erro: diz-se e sai bem.
   Recebe: o — as opções lidas (lerArgumentos).
   Devolve: o texto a escrever no stdout. */
function cmdListar(o) {
  const a = alvoDe(o.local);
  let linhas;
  try {
    linhas = executar(a, sqlListar(o.todos)).results;
  } catch (e) {
    if (e.tipo !== 'por-migrar') throw e;
    return o.json ? JSON.stringify({ tickets: [], porMigrar: true, aviso: e.message }, null, 2) : 'Tabela por migrar. ' + e.message;
  }
  const tickets = linhas.map(ticketDaLinha);
  return o.json ? JSON.stringify({ tickets }, null, 2) : textoDaLista(tickets, o);
}

/* imagem: descarrega a captura do R2 e dá-lhe a extensão do tipo verdadeiro.
   Recebe: o — as opções lidas.
   Devolve: o texto com o caminho do ficheiro. */
function cmdImagem(o) {
  const a = alvoDe(o.local);
  const l = umTicket(a, o.id);
  if (!l.image_key) throw new ErroQa('O ticket ' + o.id + ' não tem imagem.');
  const chave = String(l.image_key);
  if (!/^qa\/[A-Za-z0-9_-]+$/.test(chave)) throw new ErroQa('A chave da imagem («' + chave + '») não é do espaço qa/: não a descarrego.');
  const pasta = path.resolve(o.para || PASTA_TEMP);
  mkdirSync(pasta, { recursive: true });
  const temp = path.join(pasta, o.id + '.descarregar');
  rmSync(temp, { force: true });
  const r = correWrangler(['r2', 'object', 'get', a.bucket + '/' + chave].concat(argsDoAlvo(a), ['--file', temp]));
  // o wrangler deixa um ficheiro vazio quando falha (medido: «The specified key does not exist.»)
  const bytes = existsSync(temp) ? readFileSync(temp) : null;
  if (r.status !== 0 || !bytes || !bytes.length) {
    rmSync(temp, { force: true });
    const e = erroDoWrangler(r.stdout + '\n' + r.stderr);
    throw new ErroQa(r.status === 0 ? 'A imagem veio vazia do R2.' : e.mensagem);
  }
  const tipo = tipoDaImagem(bytes);
  const final = path.join(pasta, o.id + '.' + (tipo || 'bin'));
  rmSync(final, { force: true });
  renameSync(temp, final);
  const kb = Math.max(1, Math.round(bytes.length / 1024));
  return 'Imagem do ticket ' + o.id + ': ' + final + ' (' + (tipo || 'tipo desconhecido') + ', ' + kb + ' KB).'
    + (tipo ? '' : ' Os primeiros bytes não são de png, jpg nem webp.');
}

/* comecar: passa a em resolução os tickets dados, logo que se pega neles —
   o Martinho vê-os na app em «Em resolução». Confere todos antes de mexer
   em algum: um resolvido (reabre-se primeiro) ou um removido param tudo. Um
   que já estava em resolução fica como está, e diz-se.
   Recebe: o — as opções lidas (o.ids, um ou mais).
   Devolve: o texto com o que ficou em cada um. */
function cmdComecar(o) {
  const a = alvoDe(o.local);
  const antes = o.ids.map((id) => umTicket(a, id));
  const resolvido = antes.find((l) => l.status === 'resolvido');
  if (resolvido) throw new ErroQa('O ticket ' + resolvido.id + ' está resolvido: reabre-o primeiro (node scripts/qa.mjs reabrir ' + resolvido.id + (a.local ? ' --local' : '') + '). Não mexi em nenhum.');
  const onde = a.local ? ' na base isolada' : ' no dev';
  return antes.map((l) => {
    if (l.status === 'em_resolucao') return 'O ticket ' + l.id + ' já estava em resolução.';
    executar(a, sqlComecar(l.id, Date.now()));
    const depois = umTicket(a, l.id);
    if (depois.status !== 'em_resolucao') throw new ErroQa('O ticket ' + l.id + ' não ficou em resolução (está ' + estadoLegivel(depois.status) + ').');
    return 'Ticket ' + l.id + ' em resolução' + onde + '.';
  }).join('\n');
}

/* resolver: marca resolvido com a nota (e o commit) e confirma o que ficou.
   Recebe: o — as opções lidas.
   Devolve: o texto com o novo estado. */
function cmdResolver(o) {
  const a = alvoDe(o.local);
  umTicket(a, o.id);
  const resolucao = notaDaResolucao(o.nota, o.commit);
  executar(a, sqlResolver(o.id, resolucao, Date.now()));
  const depois = umTicket(a, o.id);
  if (depois.status !== 'resolvido') throw new ErroQa('O ticket ' + o.id + ' não ficou resolvido (está ' + estadoLegivel(depois.status) + ').');
  return 'Ticket ' + o.id + ' resolvido' + (a.local ? ' na base isolada' : ' no dev') + ' a ' + quando(depois.resolved_at) + '. Resolução:\n' + indenta(depois.resolution, '  ');
}

/* reabrir: devolve o ticket aos novos, com a resolução guardada.
   Recebe: o — as opções lidas.
   Devolve: o texto com o novo estado. */
function cmdReabrir(o) {
  const a = alvoDe(o.local);
  const antes = umTicket(a, o.id);
  if (antes.status === 'aberto') return 'O ticket ' + o.id + ' já está nos novos.';
  executar(a, sqlReabrir(o.id, Date.now()));
  const depois = umTicket(a, o.id);
  if (depois.status !== 'aberto') throw new ErroQa('O ticket ' + o.id + ' não voltou aos novos (está ' + estadoLegivel(depois.status) + ').');
  return 'Ticket ' + o.id + (antes.status === 'resolvido' ? ' reaberto' : ' de volta aos novos') + (a.local ? ' na base isolada' : ' no dev') + '.' + (depois.resolution ? ' A resolução anterior fica à vista.' : '');
}

/* Corre a linha de comandos e devolve o código de saída; os erros conhecidos
   saem numa linha clara no stderr, sem pilha.
   Recebe: argv — os argumentos depois do script.
   Devolve: o código de saída (0 bem, 1 falhou, 2 argumentos). */
export function principal(argv) {
  try {
    const o = lerArgumentos(argv);
    const fazer = { listar: cmdListar, imagem: cmdImagem, comecar: cmdComecar, resolver: cmdResolver, reabrir: cmdReabrir }[o.comando];
    process.stdout.write(fazer(o) + '\n');
    return 0;
  } catch (e) {
    if (e instanceof ErroQa) {
      process.stderr.write('qa: ' + e.message + '\n');
      return e.codigo;
    }
    process.stderr.write('qa: falha inesperada: ' + (e && e.stack || e) + '\n');
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
