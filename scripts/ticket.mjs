// Os pedidos e os erros da tabela tickets, do lado de quem os resolve: os
// pedidos que as pessoas escrevem na Ajuda da app (worker/src/rotas/tickets.js,
// categoria 'user') e os erros que a app e o servidor apanham sozinhos
// (worker/src/lib/relatos.js: categorias client, server, infra e seguranca). O
// Claude lê-os e trata-os daqui, na produção e no dev, quando o Martinho pede
// «resolve os tickets» (a skill .claude/skills/ticket/SKILL.md, fora do app/).
// É o par do scripts/qa.mjs, que faz o mesmo aos tickets de QA do dev.
//
//   node scripts/ticket.mjs listar [--prod|--dev|--local] [--todos] [--json]
//   node scripts/ticket.mjs comecar <id> [<id>…] --prod|--dev|--local
//   node scripts/ticket.mjs nota <id> --texto "…" [--commit <sha>] --prod|--dev|--local
//   node scripts/ticket.mjs publicado <sha> --prod|--dev
//   node scripts/ticket.mjs propor <id> --resposta "…" --nota "…" (--commit <sha> | --sem-commit) --prod|--dev|--local
//   node scripts/ticket.mjs concluir <id> --nota "…" (--commit <sha> | --sem-commit) --prod|--dev|--local
//   node scripts/ticket.mjs reabrir <id> --prod|--dev|--local
//
// Um ticket tem três estados: recebido (status 'criado', como nasce), em
// resolução ('resolucao', marcado com comecar logo que se pega nele) e
// concluído ('concluido'). Um pedido de uma pessoa só se implementa depois de
// alguém da equipa o aceitar no back office (migração 0024: accepted_*), e
// o Claude nunca lhe responde nem o fecha: escreve a resposta proposta
// (propor, draft_reply), que a equipa lê, altera se for preciso e envia — é
// esse envio que fecha o pedido. Os erros não precisam de aceitação e fecham
// com o concluir (um erro que volta depois de concluído reabre-se sozinho).
// Fechar (propor e concluir com --commit) só depois de a correção estar
// publicada no ramo certo: o publicado diz-o — produção pela etiqueta
// `publicado`, que o deploy de produção só move depois de o worker novo
// responder; dev pelo CI do ramo dev (Testes e Deploy verdes, e a Interface
// mais recente verde).
//
// Os alvos são três, e só estes: a produção (a base remota gestor-imobiliario),
// o dev (a remota gestor-imobiliario-dev) e a base isolada do servidor 8788
// (--local, .wrangler/state-revisao). confereAlvo recusa qualquer outro par
// antes de o wrangler correr. listar sem alvo lê a produção e depois o dev;
// qualquer escrita exige o alvo dito. O wrangler.toml do repositório tem
// PLACEHOLDER nos ids (o CI troca-os no deploy), por isso o script pede o id a
// `wrangler d1 list --json` e escreve um wrangler.toml temporário só com a
// base do alvo, passado com -c.
//
// Os valores do SQL entram escapados (cita: plicas dobradas) e os ids e o
// sha passam por um molde antes — o wrangler d1 execute não aceita parâmetros
// ligados, e o texto das notas e das respostas é livre. As escritas de um
// comando vão numa só chamada ao wrangler, e cada uma deixa uma linha no
// audit_log (quem 'claude'), como as ações do back office.
// Com TICKET_VERBOSO=1, cada chamada ao wrangler, ao git e ao gh é escrita no
// stderr antes de correr (a prova usa-o para mostrar que o listar remoto só lê).

import { spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = path.join(RAIZ, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const PERSIST = path.join(RAIZ, '.wrangler', 'state-revisao');
const PASTA_TEMP = path.join(os.tmpdir(), 'rendorium-ticket');

export const COMANDOS = ['listar', 'comecar', 'nota', 'publicado', 'propor', 'concluir', 'reabrir'];
// os três sítios onde o script pode ir, e só estes
export const ALVOS = {
  prod: { nome: 'prod', local: false, base: 'gestor-imobiliario' },
  dev: { nome: 'dev', local: false, base: 'gestor-imobiliario-dev' },
  local: { nome: 'local', local: true, base: 'gestor-imobiliario' },
};
// as colunas da migração 0024 (a decisão sobre os pedidos e a resposta proposta)
export const COLUNAS_0024 = ['accepted_at', 'accepted_by', 'accepted_by_nome', 'accepted_changes',
  'refused_at', 'refused_by', 'refused_by_nome', 'draft_reply', 'draft_at'];
const TETO_NOTA = 4000;
const TETO_RESPOSTA = 2000;   // o mesmo do back office (equipa-api.js corta a 2000)
const TETO_LISTA = 200;
// Reabrir um pedido em resolução larga a resposta proposta (deixou de ser
// verdade), que fica no fio numa nota. false para a guardar na coluna.
export const LARGA_PROPOSTA_AO_REABRIR = true;
// quem age, no fio e no audit_log
const EU = { autor: 'claude', nome: 'Claude', papel: 'script' };

export const USO = [
  'Uso:',
  '  node scripts/ticket.mjs listar [--prod|--dev|--local] [--todos] [--json]',
  '  node scripts/ticket.mjs comecar <id> [<id>…] --prod|--dev|--local',
  '  node scripts/ticket.mjs nota <id> --texto "…" [--commit <sha>] --prod|--dev|--local',
  '  node scripts/ticket.mjs publicado <sha> --prod|--dev',
  '  node scripts/ticket.mjs propor <id> --resposta "…" --nota "…" (--commit <sha> | --sem-commit) --prod|--dev|--local',
  '  node scripts/ticket.mjs concluir <id> --nota "…" (--commit <sha> | --sem-commit) --prod|--dev|--local',
  '  node scripts/ticket.mjs reabrir <id> --prod|--dev|--local',
  '',
  '--prod é a base de produção (gestor-imobiliario), --dev a do dev (gestor-imobiliario-dev), as duas na Cloudflare;',
  '--local é a base isolada do 8788 (.wrangler/state-revisao). O listar sem alvo lê a produção e o dev; as escritas pedem o alvo.',
].join('\n');

// O erro que a linha de comandos mostra sem pilha: a mensagem chega para agir.
export class ErroTicket extends Error {
  /* Recebe: mensagem — o que correu mal, em português, já com o que fazer;
     codigo (opcional) — o código de saída (1 por omissão, 2 nos argumentos).
     Devolve: o erro, com .codigo. */
  constructor(mensagem, codigo = 1) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/* ------------------------- argumentos ----------------------------------- */

const SINAIS_ALVO = ['--prod', '--dev', '--local'];
// as opções de cada comando: as que levam valor e as que são só um sinal
const OPCOES = {
  listar: { sinais: SINAIS_ALVO.concat(['--todos', '--json']), valores: [] },
  comecar: { sinais: SINAIS_ALVO, valores: [] },
  nota: { sinais: SINAIS_ALVO, valores: ['--texto', '--commit'] },
  // o --local entra para o recusar com a razão certa, e não como opção desconhecida
  publicado: { sinais: SINAIS_ALVO, valores: [] },
  propor: { sinais: SINAIS_ALVO.concat(['--sem-commit']), valores: ['--resposta', '--nota', '--commit'] },
  concluir: { sinais: SINAIS_ALVO.concat(['--sem-commit']), valores: ['--nota', '--commit'] },
  reabrir: { sinais: SINAIS_ALVO, valores: [] },
};

/* Um texto obrigatório e com teto: aparado, não vazio, sem passar do teto.
   Recebe: v — o valor lido (ou null); opcao — o nome da opção, para a
   mensagem; teto — o máximo de caracteres; falha — a função que recusa.
   Devolve: o texto aparado (ou não volta: falha lança). */
function textoObrigatorio(v, opcao, teto, falha) {
  const t = v == null ? '' : String(v).replace(/\r\n/g, '\n').trim();
  if (!t) falha('Falta o ' + opcao + ' (um texto que não pode ficar vazio).');
  if (t.length > teto) falha('O ' + opcao + ' passa dos ' + teto + ' caracteres.');
  return t;
}

/* Lê a linha de comandos: o comando, os ids (ou o sha) e as opções,
   aceitando «--nota texto» e «--nota=texto». Recusa o que não conhece em vez
   de o ignorar: uma opção mal escrita (--loca) ia a outra base.
   Recebe: argv — os argumentos depois do script (array de texto).
   Devolve: { comando, id, ids, sha, alvo, todos, json, texto, resposta, nota,
   commit, semCommit } — alvo é 'prod', 'dev', 'local' ou null (só o listar
   o pode deixar por dizer); lança ErroTicket (código 2) com a razão e o uso. */
export function lerArgumentos(argv) {
  const lista = Array.isArray(argv) ? argv.slice() : [];
  const comando = lista.shift();
  const falha = (porque) => { throw new ErroTicket(porque + '\n\n' + USO, 2); };
  if (!comando) falha('Falta o comando.');
  if (!COMANDOS.includes(comando)) falha('Não conheço o comando «' + comando + '».');
  const { sinais, valores } = OPCOES[comando];
  const r = {
    comando, id: null, ids: null, sha: null, alvo: null, todos: false, json: false,
    texto: null, resposta: null, nota: null, commit: null, semCommit: false,
  };
  const alvos = [];
  const soltos = [];
  for (let i = 0; i < lista.length; i++) {
    const a = String(lista[i]);
    if (!a.startsWith('--')) { soltos.push(a); continue; }
    const igual = a.indexOf('=');
    const nome = igual > 0 ? a.slice(0, igual) : a;
    if (sinais.includes(nome)) {
      if (igual > 0) falha('A opção ' + nome + ' não leva valor.');
      if (SINAIS_ALVO.includes(nome)) alvos.push(nome.slice(2));
      else if (nome === '--sem-commit') r.semCommit = true;
      else r[nome.slice(2)] = true;
    } else if (valores.includes(nome)) {
      let v;
      if (igual > 0) v = a.slice(igual + 1);
      else {
        v = lista[++i];
        if (v === undefined || String(v).startsWith('--')) falha('A opção ' + nome + ' precisa de um valor.');
      }
      if (r[nome.slice(2)] != null) falha('A opção ' + nome + ' vem duas vezes.');
      r[nome.slice(2)] = String(v);
    } else falha('O comando ' + comando + ' não aceita a opção ' + nome + '.');
  }
  const unicos = alvos.filter((x, i) => alvos.indexOf(x) === i);
  if (unicos.length > 1) falha('Só um alvo de cada vez: ' + unicos.map((x) => '--' + x).join(' e ') + '.');
  r.alvo = unicos[0] || null;
  if (comando === 'publicado') {
    if (r.alvo === 'local') falha('O publicado só existe para --prod e --dev: a base isolada não tem deploy.');
    if (!r.alvo) falha('O publicado precisa do ramo: --prod (a etiqueta publicado) ou --dev (o CI do ramo dev).');
    if (!soltos.length) falha('Falta o sha do commit (git log --oneline mostra-o).');
    r.sha = confereCommit(soltos.shift());
  } else if (comando !== 'listar') {
    if (!r.alvo) falha('O ' + comando + ' escreve: diz em que base, com --prod, --dev ou --local.');
    if (!soltos.length) falha('Falta o id do ticket (vê-se no listar).');
    r.id = confereId(soltos.shift());
    if (comando === 'comecar') {
      r.ids = [r.id].concat(soltos.splice(0).map(confereId)).filter((id, i, todos) => todos.indexOf(id) === i);
    }
  }
  if (soltos.length) falha('Não sei o que fazer com «' + soltos.join(' ') + '».');
  if (comando === 'nota') r.texto = textoObrigatorio(r.texto, '--texto', TETO_NOTA, falha);
  if (comando === 'propor') r.resposta = textoObrigatorio(r.resposta, '--resposta', TETO_RESPOSTA, falha);
  if (comando === 'propor' || comando === 'concluir') {
    r.nota = textoObrigatorio(r.nota, '--nota', TETO_NOTA, falha);
    if (r.commit != null && r.semCommit) falha('Ou --commit ou --sem-commit, não os dois.');
    if (r.commit == null && !r.semCommit) falha('O ' + comando + ' precisa de --commit <sha> (a correção) ou de --sem-commit (não houve código a mudar).');
  }
  if (r.commit != null) r.commit = confereCommit(r.commit);
  return r;
}

/* Um id de ticket com a forma dos que a app cria (uuid), antes de chegar ao
   SQL: um id com plicas ou espaços é um engano de cópia, e diz-se.
   Recebe: id — o texto dado na linha de comandos.
   Devolve: o id aparado; lança ErroTicket (código 2) se não tiver a forma. */
export function confereId(id) {
  const t = String(id == null ? '' : id).trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(t)) throw new ErroTicket('O id «' + t + '» não tem a forma de um id de ticket (letras, algarismos e hífenes, como no listar).\n\n' + USO, 2);
  return t;
}

/* Um sha de commit (7 a 40 algarismos hexadecimais), em minúsculas.
   Recebe: sha — o texto do --commit ou do publicado.
   Devolve: o sha aparado em minúsculas; lança ErroTicket (código 2) se não o for. */
export function confereCommit(sha) {
  const t = String(sha == null ? '' : sha).trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(t)) throw new ErroTicket('O sha «' + t + '» não é um commit (7 a 40 algarismos hexadecimais; git log --oneline mostra-o).\n\n' + USO, 2);
  return t;
}

/* ------------------------- o alvo: produção, dev ou a base isolada ------- */

/* O alvo pelo nome.
   Recebe: nome — 'prod', 'dev' ou 'local'.
   Devolve: uma cópia do alvo ({ nome, local, base }); lança ErroTicket se
   não for nenhum dos três. */
export function alvoDe(nome) {
  if (!Object.prototype.hasOwnProperty.call(ALVOS, nome)) throw new ErroTicket('Não conheço o alvo «' + nome + '».');
  return Object.assign({}, ALVOS[nome]);
}

/* A guarda: só passam os três pares de ALVOS, exatamente. A base
   gestor-imobiliario com --local é a isolada; sem --local é a produção, e só
   com o nome prod — uma mistura (o dev com o nome da produção, a isolada sem
   --local) recusa-se aqui, antes de qualquer chamada ao wrangler.
   Recebe: a — o alvo ({ nome, local, base }).
   Devolve: o mesmo alvo; lança ErroTicket se não for um dos três. */
export function confereAlvo(a) {
  const ok = a && typeof a === 'object' && Object.values(ALVOS).some((b) => b.nome === a.nome && b.local === a.local && b.base === a.base);
  if (!ok) {
    const onde = a && typeof a === 'object' ? (a.local ? 'local ' : 'remota ') + (a.base || '?') + ' (' + (a.nome || 'sem nome') + ')' : 'nenhuma';
    throw new ErroTicket('Recuso a base ' + onde + ': este script só vai à produção (gestor-imobiliario, remota), ao dev (gestor-imobiliario-dev, remota) ou à base isolada (--local).');
  }
  return a;
}

/* Onde fica o alvo, dito para pessoas.
   Recebe: a — o alvo.
   Devolve: «na produção (gestor-imobiliario)», «no dev (…)» ou «na base isolada (--local)». */
export function ondeFica(a) {
  return { prod: 'na produção (gestor-imobiliario)', dev: 'no dev (gestor-imobiliario-dev)', local: 'na base isolada (--local)' }[a.nome] || '?';
}

/* Quando chega a migração 0024 a uma base que ainda não a tem, conforme o
   sítio: à produção com o «promove», ao dev com o deploy do ramo dev; a
   isolada migra-se à mão, com o execute (o migrations apply com o 8788 de pé mata-o).
   Recebe: a — o alvo.
   Devolve: a frase (texto). */
export function quandoChega0024(a) {
  if (a.nome === 'prod') return 'falta a migração 0024, que só chega à produção com o «promove»';
  if (a.nome === 'dev') return 'falta a migração 0024, que chega ao dev com o próximo deploy do ramo dev';
  return 'falta a migração 0024: aplica-a com `npx wrangler d1 execute gestor-imobiliario --local --persist-to .wrangler/state-revisao --file migrations/0024_pedidos_aceites.sql`';
}

/* O wrangler.toml temporário de uma base remota: só essa base, com o id
   verdadeiro (o do repositório tem PLACEHOLDER). Recusa um id estranho e um
   alvo local.
   Recebe: a — o alvo remoto (prod ou dev); uuid — o id da base (de wrangler d1 list).
   Devolve: o texto do ficheiro. */
export function configDoAlvo(a, uuid) {
  confereAlvo(a);
  if (a.local) throw new ErroTicket('A base isolada usa o wrangler.toml do repositório, não um temporário.');
  if (!/^[0-9a-f-]{36}$/i.test(String(uuid || ''))) throw new ErroTicket('O id da base ' + a.base + ' veio estranho do wrangler («' + uuid + '»).');
  return [
    '# Temporário, escrito por scripts/ticket.mjs para ler/escrever os tickets ' + (a.nome === 'prod' ? 'da produção' : 'do dev') + '.',
    'name = "rendorium-ticket-' + a.nome + '"',
    'compatibility_date = "2026-08-01"',
    '',
    '[[d1_databases]]',
    'binding = "DB"',
    'database_name = "' + a.base + '"',
    'database_id = "' + uuid + '"',
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

/* Um texto curto para o detalhe do audit_log: numa linha, com reticências.
   Recebe: s — o texto; n — o máximo de caracteres.
   Devolve: o texto cortado. */
export function cortar(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/* O texto que fica no fio: a nota e, havendo, o commit numa linha própria.
   Recebe: texto — a nota; commit (opcional) — o sha.
   Devolve: o texto da nota. */
export function textoComCommit(texto, commit) {
  const n = String(texto || '').trim();
  return commit ? n + '\n\nCommit: ' + commit : n;
}

/* As colunas do listar: as do pedido, quem o escreveu, quantas pessoas
   apanharam o erro, e as da 0024 — ou, numa base sem ela (a produção antes
   do «promove»), NULL com o mesmo nome, para as linhas terem sempre a mesma
   forma.
   Recebe: com0024 — se a base já tem as colunas da 0024.
   Devolve: a lista de colunas do SELECT (texto). */
function colunasDaLista(com0024) {
  const novas = COLUNAS_0024.map((c) => (com0024 ? 't.' + c : 'NULL AS ' + c));
  return ['t.id', 't.user_id', 't.kind', 't.subject', 't.body', 't.status', 't.reply', 't.context', 't.category',
    't.fingerprint', 't.n', 't.versao', 't.assignee', 't.assignee_nome', 't.created_at', 't.updated_at']
    .concat(novas, ['u.name AS autor_nome', 'u.email AS autor_email', 'u.deleted_at AS autor_apagado',
      '(SELECT COUNT(*) FROM ticket_users x WHERE x.fingerprint = t.fingerprint) AS pessoas'])
    .join(', ');
}

/* O SELECT dos tickets do listar, na ordem em que se escrevem: os abertos
   primeiro — os pedidos aceites (os que se resolvem), os por decidir, e os
   erros (por pessoas, depois ocorrências, depois o mais recente); em cada
   parte os recebidos antes dos em resolução —, e com todos os concluídos no
   fim, do mais recente para o mais antigo. Teto de 200.
   Recebe: todos — true para juntar os concluídos; com0024 — se a base tem as
   colunas da 0024 (false: o SELECT de recurso, sem elas).
   Devolve: o SQL (texto, uma instrução). */
export function sqlTicketsLista(todos, com0024 = true) {
  const aceite = com0024 ? '(t.accepted_at IS NOT NULL AND t.refused_at IS NULL)' : '0';
  const aberto = "t.status <> 'concluido'";
  return 'SELECT ' + colunasDaLista(com0024)
    + ' FROM tickets t LEFT JOIN users u ON u.id = t.user_id'
    + (todos ? '' : ' WHERE ' + aberto)
    + ' ORDER BY CASE WHEN ' + aberto + ' THEN 0 ELSE 1 END,'
    + " CASE WHEN NOT (" + aberto + ") THEN 0 WHEN t.category = 'user' AND " + aceite + " THEN 0 WHEN t.category = 'user' THEN 1 ELSE 2 END,"
    + " CASE WHEN NOT (" + aberto + ") THEN 0 WHEN t.status = 'criado' THEN 0 WHEN t.status = 'resolucao' THEN 1 ELSE 2 END,"
    + " CASE WHEN NOT (" + aberto + ") OR t.category = 'user' THEN 0 ELSE pessoas END DESC,"
    + " CASE WHEN NOT (" + aberto + ") OR t.category = 'user' THEN 0 ELSE t.n END DESC,"
    + ' t.updated_at DESC, t.id LIMIT ' + TETO_LISTA;
}

/* O SELECT do fio (ticket_msgs) dos tickets que o listar mostra: os mesmos
   200, pela mesma consulta, cada fio pela ordem do tempo.
   Recebe: todos e com0024 — como em sqlTicketsLista.
   Devolve: o SQL (texto, uma instrução). */
export function sqlFioLista(todos, com0024 = true) {
  return 'SELECT m.ticket_id, m.id, m.tipo, m.texto, m.autor, m.nome, m.papel, m.at FROM ticket_msgs m'
    + ' WHERE m.ticket_id IN (SELECT id FROM (' + sqlTicketsLista(todos, com0024) + '))'
    + ' ORDER BY m.ticket_id, m.at, m.id';
}

/* O listar numa só chamada ao wrangler: os tickets e o fio.
   Recebe: todos e com0024 — como em sqlTicketsLista.
   Devolve: as duas instruções (array de texto). */
export function sqlListar(todos, com0024 = true) {
  return [sqlTicketsLista(todos, com0024), sqlFioLista(todos, com0024)];
}

/* O SELECT dos tickets a que se vai mexer, com todas as colunas que a base
   tiver (é por elas que se sabe se a base já tem a 0024).
   Recebe: ids — os ids já conferidos (array, um ou mais).
   Devolve: o SQL (texto). */
export function sqlUns(ids) {
  return 'SELECT * FROM tickets WHERE id IN (' + ids.map(cita).join(', ') + ') ORDER BY id';
}

/* A linha do audit_log de uma escrita, só se a escrita pegou: um INSERT …
   SELECT com a condição do estado que a escrita deixou (sem linha, sem
   rasto — e um rasto sem escrita não engana ninguém).
   Recebe: acao — 'pedido.comecar', …; id — o ticket; detalhe — texto curto
   (ou null); agora — o instante em ms; condicao — o SQL que confirma que a
   escrita pegou (ex.: «FROM tickets WHERE …»).
   Devolve: a instrução (texto). */
function sqlAuditoria(acao, id, detalhe, agora, condicao) {
  return 'INSERT INTO audit_log (at, quem, nome, papel, acao, alvo, detalhe) SELECT '
    + [cita(agora), cita(EU.autor), cita(EU.nome), cita(EU.papel), cita(acao), cita(id), cita(detalhe == null ? null : cortar(detalhe, 500))].join(', ')
    + ' ' + condicao;
}

/* Uma nota no fio (ticket_msgs, tipo 'nota': só a equipa a vê), também só
   se a condição se cumprir.
   Recebe: uuid — o id da mensagem; id — o ticket; texto — a nota; agora — o
   instante em ms; condicao — o resto do INSERT … SELECT (ex.: «FROM tickets WHERE …»).
   Devolve: a instrução (texto). */
function sqlNotaNoFio(uuid, id, texto, agora, condicao) {
  return 'INSERT INTO ticket_msgs (id, ticket_id, tipo, texto, autor, nome, papel, at) SELECT '
    + [cita(uuid), cita(id), cita('nota'), cita(texto), cita(EU.autor), cita(EU.nome), cita(EU.papel), cita(agora)].join(', ')
    + ' ' + condicao;
}

/* O comecar: cada ticket recebido passa a em resolução — um erro sempre, um
   pedido só se aceite e não recusado (a condição está no próprio UPDATE,
   para um pedido que alguém recusou entretanto não passar). Numa base sem a
   0024 só os erros (os pedidos ainda não se decidem lá).
   Recebe: ids — os ids conferidos; agora — o instante em ms; com0024 — se a
   base tem as colunas da 0024.
   Devolve: as instruções (array de texto), um UPDATE e um rasto por ticket. */
export function sqlComecar(ids, agora, com0024 = true) {
  const pode = com0024 ? "(category <> 'user' OR (accepted_at IS NOT NULL AND refused_at IS NULL))" : "category <> 'user'";
  const out = [];
  ids.forEach((id) => {
    out.push("UPDATE tickets SET status = 'resolucao', updated_at = " + cita(agora)
      + ' WHERE id = ' + cita(id) + " AND status = 'criado' AND " + pode);
    out.push(sqlAuditoria('pedido.comecar', id, 'em resolução', agora,
      'FROM tickets WHERE id = ' + cita(id) + " AND status = 'resolucao' AND updated_at = " + cita(agora)));
  });
  return out;
}

/* O nota: uma nota no fio (com o commit numa linha própria) e o rasto.
   Recebe: id — o ticket; texto — a nota; commit — o sha ou null; agora — o
   instante em ms; uuid — o id da mensagem.
   Devolve: as instruções (array de texto). */
export function sqlNota(id, texto, commit, agora, uuid) {
  const t = textoComCommit(texto, commit);
  return [
    sqlNotaNoFio(uuid, id, t, agora, 'FROM tickets WHERE id = ' + cita(id)),
    sqlAuditoria('pedido.nota', id, cortar(t, 120), agora, 'FROM ticket_msgs WHERE id = ' + cita(uuid)),
  ];
}

/* O propor: a resposta proposta num pedido aceite e por concluir — draft_reply,
   draft_at, em resolução — e a nota do que se fez (com o commit) no fio. Nunca
   toca no reply (a resposta que a pessoa vê) nem fecha: é a equipa que envia.
   Recebe: id — o pedido; resposta — o texto que a pessoa vai receber; nota —
   o que se fez; commit — o sha ou null; agora — o instante em ms; uuid — o id
   da nota.
   Devolve: as instruções (array de texto). */
export function sqlPropor(id, resposta, nota, commit, agora, uuid) {
  const pegou = 'FROM tickets WHERE id = ' + cita(id) + ' AND draft_at = ' + cita(agora);
  return [
    'UPDATE tickets SET draft_reply = ' + cita(resposta) + ', draft_at = ' + cita(agora)
      + ", status = 'resolucao', updated_at = " + cita(agora)
      + ' WHERE id = ' + cita(id) + " AND category = 'user' AND accepted_at IS NOT NULL AND refused_at IS NULL AND status <> 'concluido'",
    sqlNotaNoFio(uuid, id, textoComCommit(nota, commit), agora, pegou),
    sqlAuditoria('pedido.propor', id, 'proposta: ' + cortar(resposta, 120) + (commit ? ' · commit ' + commit : ' · sem commit'), agora, pegou),
  ];
}

/* O concluir: um erro fica concluído, com a nota (e o commit) no fio. Só os
   erros: um pedido fecha-se quando a equipa envia a resposta.
   Recebe: id — o erro; nota — o que se fez; commit — o sha ou null; agora —
   o instante em ms; uuid — o id da nota.
   Devolve: as instruções (array de texto). */
export function sqlConcluir(id, nota, commit, agora, uuid) {
  const pegou = 'FROM tickets WHERE id = ' + cita(id) + " AND status = 'concluido' AND updated_at = " + cita(agora);
  return [
    "UPDATE tickets SET status = 'concluido', updated_at = " + cita(agora)
      + ' WHERE id = ' + cita(id) + " AND category <> 'user' AND status <> 'concluido'",
    sqlNotaNoFio(uuid, id, textoComCommit(nota, commit), agora, pegou),
    sqlAuditoria('pedido.fechar', id, commit ? 'concluído · commit ' + commit : 'concluído · sem commit', agora, pegou),
  ];
}

/* O reabrir: de volta aos recebidos. Um erro de em resolução ou de concluído;
   um pedido só se aceite, não recusado e em resolução — e, com
   LARGA_PROPOSTA_AO_REABRIR, larga a resposta proposta, que antes fica no
   fio numa nota (para não se perder o texto).
   Recebe: id — o ticket; pedido — true se é um pedido de uma pessoa; agora —
   o instante em ms; uuid — o id da nota da proposta largada.
   Devolve: as instruções (array de texto). */
export function sqlReabrir(id, pedido, agora, uuid) {
  const out = [];
  if (pedido) {
    const quais = 'WHERE id = ' + cita(id) + " AND category = 'user' AND accepted_at IS NOT NULL AND refused_at IS NULL AND status = 'resolucao'";
    if (LARGA_PROPOSTA_AO_REABRIR) {
      out.push('INSERT INTO ticket_msgs (id, ticket_id, tipo, texto, autor, nome, papel, at) SELECT '
        + [cita(uuid), cita(id), cita('nota'), cita('Resposta proposta largada ao reabrir (não chegou a ser enviada):\n\n') + ' || draft_reply',
          cita(EU.autor), cita(EU.nome), cita(EU.papel), cita(agora)].join(', ')
        + ' FROM tickets ' + quais + ' AND draft_reply IS NOT NULL');
    }
    out.push("UPDATE tickets SET status = 'criado', updated_at = " + cita(agora)
      + (LARGA_PROPOSTA_AO_REABRIR ? ', draft_reply = NULL, draft_at = NULL' : '') + ' ' + quais);
  } else {
    out.push("UPDATE tickets SET status = 'criado', updated_at = " + cita(agora)
      + ' WHERE id = ' + cita(id) + " AND category <> 'user' AND status IN ('resolucao', 'concluido')");
  }
  out.push(sqlAuditoria('pedido.reabrir', id, 'de volta aos recebidos', agora,
    'FROM tickets WHERE id = ' + cita(id) + " AND status = 'criado' AND updated_at = " + cita(agora)));
  return out;
}

/* ------------------------- as regras: o que se pode fazer a cada um ----- */

/* Se a linha veio de uma base com a 0024 (o SELECT * traz as colunas).
   Recebe: l — a linha de tickets (SELECT *).
   Devolve: true se tem as colunas da 0024. */
export function tem0024(l) {
  return !!l && Object.prototype.hasOwnProperty.call(l, 'accepted_at');
}

/* A decisão sobre um pedido: 'aceite', 'recusado', 'por-decidir', ou
   'sem-0024' numa base que ainda não a tem; null num erro.
   Recebe: l — a linha de tickets.
   Devolve: o texto da decisão (ou null). */
export function decisaoDe(l) {
  if (!l || l.category !== 'user') return null;
  if (!tem0024(l)) return 'sem-0024';
  if (l.refused_at != null) return 'recusado';
  if (l.accepted_at != null) return 'aceite';
  return 'por-decidir';
}

/* A frase de quando um pedido não se pode implementar (por decidir,
   recusado, ou a base ainda sem a 0024).
   Recebe: l — a linha de tickets (um pedido); a — o alvo.
   Devolve: a frase (texto). */
function porqueNaoSeImplementa(l, a) {
  const d = decisaoDe(l);
  if (d === 'sem-0024') return 'A base ' + ondeFica(a) + ' ainda não tem a aceitação dos pedidos (' + quandoChega0024(a) + '): nenhum pedido de pessoa se implementa lá ainda (o ' + l.id + ' é um).';
  if (d === 'recusado') return 'O pedido ' + l.id + ' foi recusado no back office' + (l.refused_by_nome ? ' por ' + l.refused_by_nome : '') + ': não se implementa.';
  return 'O pedido ' + l.id + ' ainda não foi aceite no back office: só se implementam os aceites.';
}

/* O que o comecar faz a cada ticket, conferido antes de mexer em algum: um
   pedido por decidir, recusado ou numa base sem a 0024, um concluído ou um
   id que não existe param tudo.
   Recebe: ids — os ids pedidos; linhas — as linhas da base (sqlUns); a — o alvo.
   Devolve: { mexer: [linhas recebidas], jaEstavam: [linhas em resolução] };
   lança ErroTicket com o primeiro que impede. */
export function confereComecar(ids, linhas, a) {
  const porId = new Map((linhas || []).map((l) => [l.id, l]));
  const falta = ids.filter((id) => !porId.has(id));
  if (falta.length) throw new ErroTicket('Não há nenhum ticket com ' + (falta.length === 1 ? 'o id ' : 'os ids ') + falta.join(', ') + ' ' + ondeFica(a) + ' (confirma com o listar; é o alvo certo?). Não mexi em nenhum.');
  const mexer = [], jaEstavam = [];
  ids.forEach((id) => {
    const l = porId.get(id);
    if (l.status === 'concluido') {
      throw new ErroTicket(l.category === 'user'
        ? 'O pedido ' + id + ' está concluído: reabrir um pedido é da equipa, no back office. Não mexi em nenhum.'
        : 'O erro ' + id + ' está concluído: reabre-o primeiro (node scripts/ticket.mjs reabrir ' + id + ' --' + a.nome + '). Não mexi em nenhum.');
    }
    if (l.category === 'user' && decisaoDe(l) !== 'aceite') throw new ErroTicket(porqueNaoSeImplementa(l, a) + ' Não mexi em nenhum.');
    (l.status === 'resolucao' ? jaEstavam : mexer).push(l);
  });
  return { mexer, jaEstavam };
}

/* Se o propor pode escrever a resposta proposta neste ticket: só num pedido,
   aceite, não recusado e por concluir.
   Recebe: l — a linha (ou undefined); id — o id pedido; a — o alvo.
   Devolve: nada; lança ErroTicket com a razão. */
export function conferePropor(l, id, a) {
  if (!l) throw new ErroTicket('Não há nenhum ticket com o id ' + id + ' ' + ondeFica(a) + ' (confirma com o listar; é o alvo certo?).');
  if (l.category !== 'user') throw new ErroTicket('O ' + id + ' é um erro, não um pedido de uma pessoa: não leva resposta. Fecha-se com o concluir.');
  if (l.status === 'concluido') throw new ErroTicket('O pedido ' + id + ' já está concluído (a resposta foi enviada, ou foi recusado): não se propõe outra.');
  if (decisaoDe(l) !== 'aceite') throw new ErroTicket(porqueNaoSeImplementa(l, a));
}

/* Se o concluir pode fechar este ticket: só um erro. Um concluído não é
   erro: devolve-se o aviso, e não se escreve nada.
   Recebe: l — a linha (ou undefined); id — o id pedido; a — o alvo.
   Devolve: null para seguir, ou o texto «já está concluído»; lança ErroTicket com a razão. */
export function confereConcluir(l, id, a) {
  if (!l) throw new ErroTicket('Não há nenhum ticket com o id ' + id + ' ' + ondeFica(a) + ' (confirma com o listar; é o alvo certo?).');
  if (l.category === 'user') throw new ErroTicket('O ' + id + ' é um pedido de uma pessoa: não se fecha daqui. Usa o propor (node scripts/ticket.mjs propor ' + id + ' --resposta "…" --nota "…" --' + a.nome + '): a equipa lê a resposta e envia-a no back office, e é isso que o fecha.');
  if (l.status === 'concluido') return 'O erro ' + id + ' já está concluído.';
  return null;
}

/* Se o reabrir pode devolver este ticket aos recebidos: um erro em resolução
   ou concluído; um pedido aceite em resolução. Um pedido por decidir,
   recusado ou concluído é decisão da equipa, no back office.
   Recebe: l — a linha (ou undefined); id — o id pedido; a — o alvo.
   Devolve: null para seguir, ou o texto «já está nos recebidos»; lança ErroTicket com a razão. */
export function confereReabrir(l, id, a) {
  if (!l) throw new ErroTicket('Não há nenhum ticket com o id ' + id + ' ' + ondeFica(a) + ' (confirma com o listar; é o alvo certo?).');
  if (l.category !== 'user') return l.status === 'criado' ? 'O erro ' + id + ' já está nos recebidos.' : null;
  const d = decisaoDe(l);
  if (d === 'sem-0024') throw new ErroTicket(porqueNaoSeImplementa(l, a));
  if (d === 'recusado') throw new ErroTicket('O pedido ' + id + ' foi recusado' + (l.refused_by_nome ? ' por ' + l.refused_by_nome : '') + ': reabri-lo é decisão da equipa, no back office.');
  if (d === 'por-decidir') throw new ErroTicket('O pedido ' + id + ' está por decidir: reabrir e decidir é da equipa, no back office.');
  if (l.status === 'concluido') throw new ErroTicket('O pedido ' + id + ' está concluído: reabrir um pedido é da equipa, no back office.');
  if (l.status === 'criado') return 'O pedido ' + id + ' já está nos recebidos.';
  return null;
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
  return ms == null || ms === '' || !Number.isFinite(n) ? '' : DATA.format(new Date(n));
}

/* «1 erro», «3 erros»: o plural certo.
   Recebe: n — a contagem; um — a forma singular; varios — a forma plural.
   Devolve: o texto com o número. */
function conta(n, um, varios) {
  return n + ' ' + (n === 1 ? um : varios);
}

/* Indenta um texto de várias linhas.
   Recebe: t — o texto; margem — o que vai à frente de cada linha.
   Devolve: o texto indentado. */
function indenta(t, margem) {
  return String(t).replace(/\r\n/g, '\n').split('\n').map((l) => margem + l).join('\n');
}

/* O tipo de um ticket como se diz: pedido de uma pessoa (problema ou
   sugestão) ou o erro, pela categoria.
   Recebe: l — a linha (category e kind).
   Devolve: o texto. */
export function tipoLegivel(l) {
  if (l.category === 'user') return 'pedido de uma pessoa: ' + (l.kind === 'sugestao' ? 'sugestão' : l.kind === 'problema' ? 'problema' : String(l.kind || '?'));
  return { client: 'erro do browser', server: 'erro do servidor', infra: 'erro da infraestrutura', seguranca: 'erro de segurança' }[l.category]
    || 'erro (' + String(l.category) + ')';
}

/* O estado de um ticket como se diz.
   Recebe: status — o da base ('criado', 'resolucao', 'concluido').
   Devolve: recebido, em resolução ou concluído (um estado que não conhece sai tal e qual). */
export function estadoLegivel(status) {
  return { criado: 'recebido', resolucao: 'em resolução', concluido: 'concluído' }[status] || String(status);
}

/* A decisão de um pedido por extenso, como o listar a escreve.
   Recebe: l — a linha de um pedido.
   Devolve: array de linhas (texto). */
export function decisaoLegivel(l) {
  if (l.accepted_at === undefined) return ['Decisão: a aceitação ainda não chegou a esta base (falta a 0024): não se implementa.'];
  if (l.refused_at != null) return ['Decisão: recusado' + (l.refused_by_nome ? ' por ' + l.refused_by_nome : '') + ' a ' + (quando(l.refused_at) || '?') + ' (a justificação é a última resposta à pessoa).'];
  if (l.accepted_at != null) {
    const linhas = ['Decisão: aceite' + (l.accepted_by_nome ? ' por ' + l.accepted_by_nome : '') + ' a ' + (quando(l.accepted_at) || '?')
      + (l.accepted_changes ? ', com alterações:' : ', sem alterações.')];
    if (l.accepted_changes) {
      linhas.push(indenta(l.accepted_changes, '  '));
      linhas.push('  (As alterações de quem aceitou mandam mais do que o texto do pedido.)');
    }
    return linhas;
  }
  return ['Decisão: por decidir (espera pelo Aceitar no back office; não se mexe nele).'];
}

/* Quem escreveu o ticket, como se diz: nome <email>; «Sem utilizador» na
   conta do sistema (os erros sem pessoa); e se a conta foi apagada.
   Recebe: l — a linha (user_id, autor_nome, autor_email, autor_apagado).
   Devolve: o texto. */
function quemLegivel(l) {
  if (l.user_id === 'SISTEMA') return 'Sem utilizador';
  const t = [l.autor_nome, l.autor_email ? '<' + l.autor_email + '>' : ''].filter(Boolean).join(' ');
  return (t || 'conta desconhecida (' + (l.user_id || '?') + ')') + (l.autor_apagado != null ? ' (conta apagada)' : '');
}

/* Um ticket por extenso, como o listar o escreve: tudo o que é preciso para
   o resolver sem abrir o back office.
   Recebe: l — a linha (sqlTicketsLista, numa base sem a 0024 sem as colunas
   dela) com .msgs (o fio, juntaFio).
   Devolve: o texto (várias linhas). */
export function textoDoTicket(l) {
  const erro = l.category !== 'user';
  const linhas = ['== ' + l.id + ' · ' + tipoLegivel(l) + ' · ' + estadoLegivel(l.status)];
  linhas.push('Assunto: ' + String(l.subject == null ? '' : l.subject).replace(/\s*\n\s*/g, ' '));
  linhas.push('Quem: ' + quemLegivel(l));
  linhas.push('Quando: criado a ' + (quando(l.created_at) || '?')
    + (l.updated_at != null && l.updated_at !== l.created_at ? '; última vez a ' + quando(l.updated_at) : ''));
  if (l.versao != null && l.versao !== '') linhas.push('Versão: ' + l.versao);
  if (erro) linhas.push('Ocorrências: ' + (l.n == null ? '?' : l.n) + ' · ' + conta(Number(l.pessoas) || 0, 'pessoa', 'pessoas'));
  if (l.context != null && String(l.context).trim()) linhas.push('Contexto: ' + String(l.context).replace(/\s*\n\s*/g, ' '));
  if (l.assignee_nome || l.assignee) linhas.push('Tomado por: ' + (l.assignee_nome || l.assignee));
  if (!erro) decisaoLegivel(l).forEach((x) => linhas.push(x));
  linhas.push('Descrição:');
  linhas.push(indenta(l.body == null ? '' : l.body, '  '));
  if (l.reply) {
    linhas.push('Última resposta à pessoa:');
    linhas.push(indenta(l.reply, '  '));
  }
  if (l.draft_reply) {
    linhas.push('Resposta proposta, por enviar' + (l.draft_at ? ' (desde ' + quando(l.draft_at) + ')' : '') + ':');
    linhas.push(indenta(l.draft_reply, '  '));
  }
  const fio = Array.isArray(l.msgs) ? l.msgs : [];
  linhas.push('Fio:' + (fio.length ? ' (' + fio.length + ')' : ' nenhum'));
  fio.forEach((m) => {
    linhas.push('  ' + (quando(m.at) || '?') + ' · ' + (m.tipo === 'resposta' ? 'resposta' : m.tipo === 'nota' ? 'nota' : String(m.tipo)) + ' · ' + (m.nome || m.autor || '?') + ':');
    linhas.push(indenta(m.texto == null ? '' : m.texto, '    '));
  });
  return linhas.join('\n');
}

/* Junta a cada ticket o seu fio, e tira as colunas da 0024 das linhas de
   uma base sem ela (o SELECT de recurso dá-as a NULL; tirá-las é o que
   diz ao texto que a aceitação ainda lá não chegou).
   Recebe: tickets — as linhas de sqlTicketsLista; msgs — as de sqlFioLista;
   com0024 — se a base tem a 0024.
   Devolve: os tickets (cópias), cada um com .msgs (array). */
export function juntaFio(tickets, msgs, com0024 = true) {
  const porTicket = new Map();
  (msgs || []).forEach((m) => {
    if (!porTicket.has(m.ticket_id)) porTicket.set(m.ticket_id, []);
    porTicket.get(m.ticket_id).push(m);
  });
  return (tickets || []).map((t) => {
    const c = Object.assign({}, t, { msgs: porTicket.get(t.id) || [] });
    if (!com0024) COLUNAS_0024.forEach((k) => delete c[k]);
    return c;
  });
}

/* O texto de um alvo no listar: o cabeçalho com as contagens (e o aviso da
   0024, se faltar), e as secções — «Pedidos aceites», «Pedidos por decidir»,
   «Erros» e, com --todos, «Concluídos» —, cada ticket por extenso.
   Recebe: a — o alvo; tickets — os de juntaFio, na ordem da base; opcoes —
   { todos, sem0024 }.
   Devolve: o texto. */
export function textoDoAlvo(a, tickets, opcoes = {}) {
  const titulo = { prod: 'Produção', dev: 'Dev', local: 'Base isolada' }[a.nome] + ' (' + (a.local ? '--local' : a.base) + ')';
  const aviso = opcoes.sem0024
    ? '\nAtenção: a aceitação dos pedidos ainda não chegou a esta base (' + quandoChega0024(a) + '): nenhum pedido de pessoa se implementa aqui; os erros sim.'
    : '';
  const abertos = tickets.filter((t) => t.status !== 'concluido');
  const concluidos = tickets.filter((t) => t.status === 'concluido');
  const aceites = abertos.filter((t) => t.category === 'user' && decisaoDe(t) === 'aceite');
  const porDecidir = abertos.filter((t) => t.category === 'user' && decisaoDe(t) !== 'aceite');
  const erros = abertos.filter((t) => t.category !== 'user');
  if (!tickets.length) return '### ' + titulo + ': não há tickets' + (opcoes.todos ? '' : ' abertos') + '.' + aviso;
  const recebidos = abertos.filter((t) => t.status === 'criado').length;
  const partes = ['### ' + titulo + ': ' + conta(aceites.length, 'pedido aceite', 'pedidos aceites')
    + ', ' + conta(porDecidir.length, 'pedido por decidir', 'pedidos por decidir')
    + ', ' + conta(erros.length, 'erro', 'erros')
    + ' (' + conta(recebidos, 'recebido', 'recebidos') + ', ' + (abertos.length - recebidos) + ' em resolução)'
    + (opcoes.todos ? '; ' + conta(concluidos.length, 'concluído', 'concluídos') : '') + '.'
    + (tickets.length >= TETO_LISTA ? ' (Só os primeiros ' + TETO_LISTA + '.)' : '') + aviso];
  [
    ['Pedidos aceites (' + aceites.length + '): os que se resolvem, com as alterações de quem aceitou a mandar', aceites],
    ['Pedidos por decidir (' + porDecidir.length + '): NÃO se mexe neles, esperam pelo Aceitar no back office', porDecidir],
    ['Erros (' + erros.length + '): por pessoas, depois ocorrências, depois o mais recente', erros],
    ['Concluídos (' + concluidos.length + ')', opcoes.todos ? concluidos : []],
  ].forEach(([cabeca, ts]) => {
    if (!ts.length) return;
    partes.push('\n#### ' + cabeca);
    ts.forEach((t) => partes.push('\n' + textoDoTicket(t)));
  });
  return partes.join('\n');
}

/* ------------------------- o wrangler ----------------------------------- */

/* Se a falha do wrangler é a passageira (7403, «The given account is not
   valid or is not authorized»: medida a meio de leituras boas), que se repete.
   Recebe: texto — o que o wrangler escreveu.
   Devolve: true se for a passageira. */
export function ehPassageiro(texto) {
  // só a frase ou o código dito como código: um «at offset 7403» de um erro de SQL não é isto
  return /The given account is not valid or is not authorized|\[code:\s*7403\]|"code"\s*:\s*7403\b/i.test(String(texto || ''));
}

/* Diz, em português e com o que fazer, porque é que o wrangler falhou.
   Recebe: texto — o que o wrangler escreveu (stdout + stderr).
   Devolve: { tipo, mensagem, coluna? }, com tipo 'passageiro', 'coluna'
   (coluna: o nome da que falta), 'sem-sessao', 'rede' ou 'outro'. */
export function erroDoWrangler(texto) {
  const t = String(texto || '');
  if (ehPassageiro(t)) {
    return { tipo: 'passageiro', mensagem: 'A Cloudflare recusou a conta (7403, «The given account is not valid or is not authorized») várias vezes seguidas: costuma ser passageiro, repete daqui a pouco.' };
  }
  const col = /no such column:?\s*([A-Za-z0-9_.]+)/i.exec(t);
  if (col) {
    const nome = col[1].replace(/^\w+\./, '');
    return { tipo: 'coluna', coluna: nome, mensagem: 'A base não tem a coluna ' + nome + (COLUNAS_0024.includes(nome) ? ' (falta a migração 0024: à produção chega com o «promove», ao dev com o próximo deploy do ramo dev).' : ' (falta uma migração).') };
  }
  if (/not (?:logged in|authenticated)|wrangler login|Authentication error|code:?\s*10000|Invalid access token|CLOUDFLARE_API_TOKEN/i.test(t)) {
    return { tipo: 'sem-sessao', mensagem: 'O wrangler não tem sessão na Cloudflare: corre `npx wrangler login` (ou define CLOUDFLARE_API_TOKEN) e repete.' };
  }
  if (/fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|getaddrinfo|socket hang up|network/i.test(t)) {
    return { tipo: 'rede', mensagem: 'Sem ligação à Cloudflare (rede): repete daqui a pouco.' };
  }
  // a linha [ERROR] do wrangler, se houver; senão as primeiras que não são avisos, banners nem o «Logs were written»
  const linhas = t.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const doErro = linhas.filter((l) => /\[ERROR\]/.test(l)).map((l) => l.replace(/^.*?\[ERROR\]\s*/, ''));
  const resto = linhas.filter((l) => !/^[▲⛅─╭╰│🪵]|\[WARNING\]|Logs were written|^\[ticket\]/u.test(l));
  const linha = (doErro.length ? doErro : resto).slice(0, 3).join(' ');
  return { tipo: 'outro', mensagem: 'O wrangler falhou: ' + (linha || 'sem mensagem') };
}

/* Espera sem gastar o processador (o script é síncrono de ponta a ponta).
   Recebe: ms — quanto.
   Devolve: nada, depois de passar o tempo. */
function dorme(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/* Corre uma chamada e repete-a enquanto a falha for a passageira (7403), até
   três vezes depois da primeira. Repetir é seguro: o 7403 chega antes de a
   base executar, e as escritas são condicionais (um UPDATE que já pegou não
   volta a pegar, e o INSERT da nota tem o id fixo).
   Recebe: correr — a função que faz a chamada e devolve { status, stdout,
   stderr }; opcoes — { repeticoes (3), pausa (ms entre tentativas, 1500),
   dormir (para os testes) }.
   Devolve: o resultado da última tentativa, com .tentativas. */
export function comRepeticao(correr, opcoes = {}) {
  const repeticoes = opcoes.repeticoes == null ? 3 : opcoes.repeticoes;
  const pausa = opcoes.pausa == null ? 1500 : opcoes.pausa;
  const dormir = opcoes.dormir || dorme;
  let r;
  for (let i = 0; ; i++) {
    r = correr();
    const falhou = r.status !== 0;
    if (!falhou ||!ehPassageiro((r.stdout || '') + '\n' + (r.stderr || '')) || i >= repeticoes) {
      return Object.assign({}, r, { tentativas: i + 1 });
    }
    dormir(pausa * (i + 1));
  }
}

/* Escreve no stderr a chamada que vai correr, com TICKET_VERBOSO=1.
   Recebe: quem — 'wrangler', 'git' ou 'gh'; args — os argumentos.
   Devolve: nada. */
function mostraChamada(quem, args) {
  if (process.env.TICKET_VERBOSO === '1') process.stderr.write('[ticket] ' + quem + ' ' + args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ') + '\n');
}

/* Corre o wrangler do repositório (node_modules), sem shell: os argumentos
   vão tal e qual, com plicas, ponto e vírgula e quebras de linha das notas.
   Repete a falha passageira (comRepeticao).
   Recebe: args — os argumentos do wrangler (array de texto).
   Devolve: { status, stdout, stderr }; lança ErroTicket se o wrangler não estiver instalado. */
function correWrangler(args) {
  if (!existsSync(WRANGLER)) throw new ErroTicket('Não encontro o wrangler em ' + WRANGLER + ': corre `npm install` no app/.');
  mostraChamada('wrangler', args);
  return comRepeticao(() => {
    const r = spawnSync(process.execPath, [WRANGLER].concat(args), {
      cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 180000, windowsHide: true,
      env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' }),
    });
    if (r.error) throw new ErroTicket('O wrangler não correu: ' + r.error.message);
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  });
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

const configs = {};
let basesDaConta = null;

/* Os argumentos do wrangler que apontam para o alvo: --local com a pasta
   isolada (e o wrangler.toml do repositório), ou --remote com o wrangler.toml
   temporário da base (os.tmpdir()/rendorium-ticket/wrangler-<alvo>.toml).
   Passa sempre pela guarda.
   Recebe: a — o alvo.
   Devolve: array de argumentos. */
function argsDoAlvo(a) {
  confereAlvo(a);
  if (a.local) return ['--local', '--persist-to', PERSIST];
  if (!configs[a.nome]) {
    if (!basesDaConta) {
      const r = correWrangler(['d1', 'list', '--json']);
      const lista = lerJsonDoWrangler(r.stdout);
      if (r.status !== 0 || !Array.isArray(lista)) throw new ErroTicket(erroDoWrangler(r.stdout + '\n' + r.stderr).mensagem);
      basesDaConta = lista;
    }
    const b = basesDaConta.find((d) => d && d.name === a.base);
    if (!b) throw new ErroTicket('A conta do wrangler não tem a base ' + a.base + ' (wrangler d1 list não a mostra): é a conta certa?');
    mkdirSync(PASTA_TEMP, { recursive: true });
    const f = path.join(PASTA_TEMP, 'wrangler-' + a.nome + '.toml');
    writeFileSync(f, configDoAlvo(a, b.uuid));
    configs[a.nome] = f;
  }
  return ['--remote', '-c', configs[a.nome]];
}

/* Corre as instruções no alvo, numa só chamada ao wrangler (separadas por
   «;» e uma quebra de linha: o wrangler divide-as respeitando as plicas).
   Recebe: a — o alvo; instrucoes — o SQL (array de texto, uma ou mais).
   Devolve: um array com as linhas de cada instrução (array de arrays);
   lança ErroTicket (com .tipo e .coluna) se falhar. */
function executarNoWrangler(a, instrucoes) {
  const sql = instrucoes.join(';\n');
  const args = ['d1', 'execute', a.base].concat(argsDoAlvo(a), ['--json', '--yes', '--command', sql]);
  const r = correWrangler(args);
  const j = lerJsonDoWrangler(r.stdout);
  const erro = j && !Array.isArray(j) && j.error;
  if (r.status !== 0 || erro || !Array.isArray(j)) {
    const e = erroDoWrangler([erro ? (erro.text || '') + ' ' + JSON.stringify(erro.notes || '') : '', r.stdout, r.stderr].join('\n'));
    const x = new ErroTicket(e.mensagem);
    x.tipo = e.tipo;
    x.coluna = e.coluna;
    throw x;
  }
  return instrucoes.map((s, i) => (j[i] && Array.isArray(j[i].results) ? j[i].results : []));
}

/* ------------------------- o git e o gh --------------------------------- */

/* Corre um programa do sistema (git ou gh), sem shell, na raiz do repositório.
   Recebe: programa — 'git' ou 'gh'; args — os argumentos.
   Devolve: { status, stdout, stderr }; lança ErroTicket se não estiver instalado. */
function correPrograma(programa, args) {
  mostraChamada(programa, args);
  const r = spawnSync(programa, args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000, windowsHide: true });
  if (r.error) {
    throw new ErroTicket(r.error.code === 'ENOENT'
      ? 'Não encontro o ' + programa + ' no PATH' + (programa === 'gh' ? ' (o GitHub CLI: https://cli.github.com).' : '.')
      : 'O ' + programa + ' não correu: ' + r.error.message);
  }
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/* Diz porque é que o gh falhou.
   Recebe: texto — o que o gh escreveu.
   Devolve: a mensagem (texto). */
export function erroDoGh(texto) {
  const t = String(texto || '');
  if (/gh auth login|not logged in|authentication|HTTP 401|Bad credentials|GH_TOKEN/i.test(t)) return 'O gh não tem sessão no GitHub: corre `gh auth login` e repete.';
  if (/could not resolve|dial tcp|connection|timeout|ENOTFOUND|no such host|network/i.test(t)) return 'Sem ligação ao GitHub (rede): repete daqui a pouco.';
  return 'O gh falhou: ' + (t.trim().split(/\r?\n/).slice(0, 2).join(' ') || 'sem mensagem');
}

/* O sha inteiro de um commit (o gh só casa o inteiro; o curto não devolve nada).
   Recebe: git — o executor do git; sha — o sha conferido.
   Devolve: o sha de 40 algarismos, ou null se o repositório não o conhecer. */
function shaInteiro(git, sha) {
  const r = git(['rev-parse', '--verify', '--quiet', sha + '^{commit}']);
  const t = String(r.stdout || '').trim().toLowerCase();
  return r.status === 0 && /^[0-9a-f]{40}$/.test(t) ? t : null;
}

/* Se um commit é antepassado de outro (ou o mesmo).
   Recebe: git — o executor; de — o sha que se procura; em — a ponta.
   Devolve: true, false; lança ErroTicket se o git não souber responder (um
   ref que não existe dá false). */
function contido(git, de, em) {
  if (de === em) return true;
  const r = git(['merge-base', '--is-ancestor', de, em]);
  if (r.status === 0) return true;
  if (r.status === 1 || /not a valid|unknown revision|bad object|Not a valid commit/i.test(r.stderr || '')) return false;
  throw new ErroTicket('O git merge-base falhou: ' + String(r.stderr || '').trim().split(/\r?\n/)[0]);
}

/* A avaliação das corridas do CI do ramo dev, sem rede: entre as corridas
   cujo headSha contém o commit, tem de haver um headSha com o Testes E o
   Deploy concluídos com sucesso, e a Interface mais recente desses headSha
   (se houver: ela só corre quando a web, o worker ou as migrações mudam) tem
   de ter sucesso. Em cada headSha conta a corrida mais recente de cada
   workflow.
   Recebe: corridas — as do gh run list ({ workflowName, headSha, status,
   conclusion, createdAt }); contem — o predicado (headSha → se contém o commit).
   Devolve: { publicado, razao, headSha?, quando? } — razao começa por «em
   curso», «falhou», «sem corrida» ou «sem Deploy» quando não está publicado. */
export function avaliaCorridas(corridas, contem) {
  const minhas = (Array.isArray(corridas) ? corridas : []).filter((c) => c && c.headSha && contem(c.headSha));
  if (!minhas.length) return { publicado: false, razao: 'sem corrida: nenhuma corrida de push no ramo dev tem este commit (ainda não arrancou, ou é mais antiga do que as últimas 40).' };
  const ultima = (lista) => lista.slice().sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)))[0] || null;
  const verde = (c) => !!c && c.status === 'completed' && c.conclusion === 'success';
  const curto = (h) => String(h).slice(0, 7);
  const heads = minhas.map((c) => c.headSha).filter((h, i, todos) => todos.indexOf(h) === i);
  const atuais = [];   // a corrida mais recente de cada workflow em cada headSha
  let bom = null;
  heads.forEach((h) => {
    const dele = minhas.filter((c) => c.headSha === h);
    const t = ultima(dele.filter((c) => c.workflowName === 'Testes'));
    const d = ultima(dele.filter((c) => c.workflowName === 'Deploy'));
    [t, d].forEach((c) => { if (c) atuais.push(c); });
    if (verde(t) && verde(d)) {
      const q = String(d.createdAt) > String(t.createdAt) ? d.createdAt : t.createdAt;
      if (!bom || String(q) > String(bom.quando)) bom = { headSha: h, quando: q };
    }
  });
  const interfaceRecente = ultima(minhas.filter((c) => c.workflowName === 'Interface'));
  if (interfaceRecente && !verde(interfaceRecente)) atuais.push(interfaceRecente);
  if (bom && (!interfaceRecente || verde(interfaceRecente))) {
    return { publicado: true, headSha: bom.headSha, quando: bom.quando, interface: interfaceRecente ? 'verde' : 'não correu',
      razao: 'Testes e Deploy verdes em ' + curto(bom.headSha) + '; ' + (interfaceRecente ? 'a Interface mais recente (' + curto(interfaceRecente.headSha) + ') verde.' : 'a Interface não correu (nada na web, no worker nem nas migrações).') };
  }
  const emCurso = atuais.filter((c) => c.status !== 'completed');
  const diz = (c) => c.workflowName + ' em ' + curto(c.headSha);
  if (emCurso.length) return { publicado: false, razao: 'em curso: ' + emCurso.map(diz).join(', ') + '.' };
  const falhadas = atuais.filter((c) => c.status === 'completed' && c.conclusion !== 'success' && c.conclusion !== 'skipped');
  if (bom && interfaceRecente) return { publicado: false, razao: 'falhou a Interface em ' + curto(interfaceRecente.headSha) + ' (' + (interfaceRecente.conclusion || '?') + '), a mais recente com este commit.' };
  if (falhadas.length) return { publicado: false, razao: 'falhou: ' + falhadas.map((c) => diz(c) + ' (' + (c.conclusion || '?') + ')').join(', ') + '.' };
  return { publicado: false, razao: 'sem Deploy: nenhuma corrida com este commit tem o Testes e o Deploy verdes no mesmo commit.' };
}

/* Se um commit está em produção: dentro da etiqueta publicado, que o deploy
   de produção só move depois de o worker novo responder (deploy.yml, «Marcar
   o que está em produção»).
   Recebe: sha — o sha conferido; git — o executor do git (args → { status, stdout, stderr }).
   Devolve: { publicado, razao, sha }; lança ErroTicket se o git fetch falhar. */
export function publicadoProd(sha, git) {
  const f = git(['fetch', 'origin', '--tags', '--force', '--quiet']);
  if (f.status !== 0) throw new ErroTicket('O git fetch das etiquetas falhou: ' + (String(f.stderr || '').trim().split(/\r?\n/)[0] || 'sem mensagem') + '.');
  const inteiro = shaInteiro(git, sha);
  if (!inteiro) return { publicado: false, sha, razao: 'fora do ramo: o commit ' + sha + ' não existe neste repositório, nem depois do git fetch (falta o push?).' };
  const etiqueta = shaInteiro(git, 'refs/tags/publicado');
  if (!etiqueta) return { publicado: false, sha: inteiro, razao: 'a etiqueta publicado não existe: a produção ainda não foi marcada por nenhum deploy.' };
  if (contido(git, inteiro, etiqueta)) return { publicado: true, sha: inteiro, razao: 'dentro da etiqueta publicado (' + etiqueta.slice(0, 7) + ').' };
  return { publicado: false, sha: inteiro, razao: 'ainda não está em produção: a etiqueta publicado está em ' + etiqueta.slice(0, 7) + ' e não o contém (falta o «promove», ou o deploy de produção ainda não acabou bem).' };
}

/* Se um commit está publicado no dev: no origin/dev (senão falta o push) e
   com o CI do ramo dev verde (avaliaCorridas).
   Recebe: sha — o sha conferido; execs — { git, gh }, os executores (args →
   { status, stdout, stderr }).
   Devolve: { publicado, razao, sha, headSha? }; lança ErroTicket se o git ou o gh falharem. */
export function publicadoDev(sha, execs) {
  const { git, gh } = execs;
  const f = git(['fetch', 'origin', 'dev', '--quiet']);
  if (f.status !== 0) throw new ErroTicket('O git fetch do dev falhou: ' + (String(f.stderr || '').trim().split(/\r?\n/)[0] || 'sem mensagem') + '.');
  const inteiro = shaInteiro(git, sha);
  if (!inteiro) return { publicado: false, sha, razao: 'fora do ramo: o commit ' + sha + ' não existe neste repositório, nem depois do git fetch (falta o push?).' };
  const ponta = shaInteiro(git, 'refs/remotes/origin/dev');
  if (!ponta || !contido(git, inteiro, ponta)) return { publicado: false, sha: inteiro, razao: 'fora do ramo: o commit não está no origin/dev (falta o push).' };
  const r = gh(['run', 'list', '--branch', 'dev', '--event', 'push', '--limit', '40', '--json', 'workflowName,headSha,status,conclusion,createdAt']);
  if (r.status !== 0) throw new ErroTicket(erroDoGh(r.stderr + '\n' + r.stdout));
  let corridas;
  try { corridas = JSON.parse(r.stdout); } catch (e) { throw new ErroTicket('O gh run list não deu JSON: ' + String(r.stdout).slice(0, 120)); }
  const sabidos = new Map();
  const contem = (h) => {
    const k = String(h).toLowerCase();
    if (!sabidos.has(k)) sabidos.set(k, /^[0-9a-f]{40}$/.test(k) && contido(git, inteiro, k));
    return sabidos.get(k);
  };
  return Object.assign({ sha: inteiro }, avaliaCorridas(corridas, contem));
}

/* O publicado do alvo, para o comando e para a guarda do propor e do concluir.
   Recebe: nome — 'prod' ou 'dev'; sha — o sha conferido; execs — { git, gh }.
   Devolve: { publicado, razao, sha, headSha? }. */
function verPublicado(nome, sha, execs) {
  return nome === 'prod' ? publicadoProd(sha, execs.git) : publicadoDev(sha, execs);
}

/* ------------------------- os comandos ---------------------------------- */

/* As dependências de fora (wrangler, git, gh, o relógio e os ids), com as
   verdadeiras por omissão: os testes trocam-nas para correr sem rede.
   Recebe: deps — as que se querem trocar ({ executar, git, gh, agora, uuid }).
   Devolve: as dependências completas. */
function dependencias(deps = {}) {
  return {
    executar: deps.executar || executarNoWrangler,
    git: deps.git || ((args) => correPrograma('git', args)),
    gh: deps.gh || ((args) => correPrograma('gh', args)),
    agora: deps.agora || (() => Date.now()),
    uuid: deps.uuid || (() => randomUUID()),
  };
}

/* Corre as instruções no alvo, depois de a guarda o conferir (também com
   um executor de testes).
   Recebe: d — as dependências; a — o alvo; instrucoes — o SQL (array).
   Devolve: as linhas de cada instrução (array de arrays). */
function executar(d, a, instrucoes) {
  confereAlvo(a);
  return d.executar(a, instrucoes);
}

/* Um alvo do listar: o SELECT com a 0024 e, numa base sem ela, o de recurso.
   Recebe: d — as dependências; a — o alvo; todos — com os concluídos.
   Devolve: { tickets (juntaFio), sem0024 }. */
function listarAlvo(d, a, todos) {
  try {
    const [ts, ms] = executar(d, a, sqlListar(todos, true));
    return { tickets: juntaFio(ts, ms, true), sem0024: false };
  } catch (e) {
    if (!(e && e.tipo === 'coluna' && COLUNAS_0024.includes(e.coluna))) throw e;
    const [ts, ms] = executar(d, a, sqlListar(todos, false));
    return { tickets: juntaFio(ts, ms, false), sem0024: true };
  }
}

/* listar: os tickets de cada alvo (sem alvo, a produção e depois o dev), em
   texto ou em JSON. Um alvo que falha não impede o outro: diz-se e sai com 1.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: { texto, codigo }. */
function cmdListar(o, d) {
  const nomes = o.alvo ? [o.alvo] : ['prod', 'dev'];
  const json = {};
  const textos = [];
  let codigo = 0;
  nomes.forEach((nome) => {
    const a = alvoDe(nome);
    try {
      const r = listarAlvo(d, a, o.todos);
      json[nome] = r.sem0024 ? { tickets: r.tickets, sem0024: true } : { tickets: r.tickets };
      textos.push(textoDoAlvo(a, r.tickets, { todos: o.todos, sem0024: r.sem0024 }));
    } catch (e) {
      if (!(e instanceof ErroTicket)) throw e;
      codigo = 1;
      json[nome] = { erro: e.message };
      textos.push('### Não consegui ler ' + ondeFica(a) + ': ' + e.message);
    }
  });
  return { texto: o.json ? JSON.stringify(json, null, 2) : textos.join('\n\n'), codigo };
}

/* Os tickets como estão na base.
   Recebe: d — as dependências; a — o alvo; ids — os ids.
   Devolve: as linhas (SELECT *). */
function lerUns(d, a, ids) {
  return executar(d, a, [sqlUns(ids)])[0];
}

/* comecar: passa a em resolução os tickets dados, logo que se pega neles.
   Confere todos antes de mexer em algum (confereComecar), escreve tudo numa
   chamada e confirma a seguir.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto com o que ficou em cada um. */
function cmdComecar(o, d) {
  const a = alvoDe(o.alvo);
  const antes = lerUns(d, a, o.ids);
  const { mexer, jaEstavam } = confereComecar(o.ids, antes, a);
  const frase = new Map(jaEstavam.map((l) => [l.id, 'O ' + l.id + ' já estava em resolução.']));
  if (mexer.length) {
    executar(d, a, sqlComecar(mexer.map((l) => l.id), d.agora(), tem0024(mexer[0])));
    const depois = new Map(lerUns(d, a, mexer.map((l) => l.id)).map((l) => [l.id, l]));
    mexer.forEach((l) => {
      const n = depois.get(l.id);
      if (!n || n.status !== 'resolucao') throw new ErroTicket('O ' + l.id + ' não ficou em resolução (está ' + (n ? estadoLegivel(n.status) : 'desaparecido') + '): alguém lhe mexeu entretanto? Vê o listar.');
      frase.set(l.id, (l.category === 'user' ? 'Pedido ' : 'Erro ') + l.id + ' em resolução ' + ondeFica(a) + '.'
        + (l.category === 'user' && l.accepted_changes ? ' Foi aceite com alterações: são elas que mandam.' : ''));
    });
  }
  return o.ids.map((id) => frase.get(id)).join('\n');
}

/* nota: uma nota no fio (só a equipa a vê), com o commit se houver.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto. */
function cmdNota(o, d) {
  const a = alvoDe(o.alvo);
  if (!lerUns(d, a, [o.id])[0]) throw new ErroTicket('Não há nenhum ticket com o id ' + o.id + ' ' + ondeFica(a) + ' (confirma com o listar; é o alvo certo?).');
  const uuid = d.uuid();
  executar(d, a, sqlNota(o.id, o.texto, o.commit, d.agora(), uuid));
  const ficou = executar(d, a, ['SELECT id FROM ticket_msgs WHERE id = ' + cita(uuid)])[0];
  if (!ficou.length) throw new ErroTicket('A nota não ficou no fio do ' + o.id + ': repete.');
  return 'Nota escrita no fio do ' + o.id + ' ' + ondeFica(a) + ' (só a equipa a vê).';
}

/* A guarda do propor e do concluir: com --commit na produção ou no dev, o
   commit tem de estar publicado nesse alvo antes de se escrever.
   Recebe: o — as opções lidas; a — o alvo; d — as dependências.
   Devolve: nada; lança ErroTicket com a razão se não estiver publicado. */
function exigePublicado(o, a, d) {
  if (!o.commit || a.local) return;
  const p = verPublicado(a.nome, o.commit, d);
  if (!p.publicado) throw new ErroTicket('O commit ' + o.commit + ' ainda não está publicado ' + (a.nome === 'prod' ? 'em produção' : 'no dev') + ', e não mexi no ' + o.id + '. POR PUBLICAR: ' + p.razao);
}

/* propor: a resposta proposta num pedido aceite, que a equipa lê e envia.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto. */
function cmdPropor(o, d) {
  const a = alvoDe(o.alvo);
  const l = lerUns(d, a, [o.id])[0];
  conferePropor(l, o.id, a);
  exigePublicado(o, a, d);
  executar(d, a, sqlPropor(o.id, o.resposta, o.nota, o.commit, d.agora(), d.uuid()));
  const n = lerUns(d, a, [o.id])[0];
  if (!n || n.draft_reply !== o.resposta.replace(/\u0000/g, '') || n.status !== 'resolucao') {
    throw new ErroTicket('A resposta proposta não ficou no pedido ' + o.id + ' (está ' + (n ? estadoLegivel(n.status) : 'desaparecido') + '): alguém lhe mexeu entretanto? Vê o listar.');
  }
  return 'Resposta proposta escrita no pedido ' + o.id + ' ' + ondeFica(a) + ', que fica em resolução. A pessoa só a recebe quando alguém da equipa a enviar no back office (como está ou alterada); é esse envio que fecha o pedido.';
}

/* concluir: um erro fica concluído, com a nota (e o commit) no fio.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto. */
function cmdConcluir(o, d) {
  const a = alvoDe(o.alvo);
  const l = lerUns(d, a, [o.id])[0];
  const ja = confereConcluir(l, o.id, a);
  if (ja) return ja;
  exigePublicado(o, a, d);
  executar(d, a, sqlConcluir(o.id, o.nota, o.commit, d.agora(), d.uuid()));
  const n = lerUns(d, a, [o.id])[0];
  if (!n || n.status !== 'concluido') throw new ErroTicket('O erro ' + o.id + ' não ficou concluído (está ' + (n ? estadoLegivel(n.status) : 'desaparecido') + '). Vê o listar.');
  return 'Erro ' + o.id + ' concluído ' + ondeFica(a) + '. Se voltar a acontecer, reabre-se sozinho.';
}

/* reabrir: de volta aos recebidos (confereReabrir diz o que pode).
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: o texto. */
function cmdReabrir(o, d) {
  const a = alvoDe(o.alvo);
  const l = lerUns(d, a, [o.id])[0];
  const ja = confereReabrir(l, o.id, a);
  if (ja) return ja;
  const pedido = l.category === 'user';
  executar(d, a, sqlReabrir(o.id, pedido, d.agora(), d.uuid()));
  const n = lerUns(d, a, [o.id])[0];
  if (!n || n.status !== 'criado') throw new ErroTicket('O ' + o.id + ' não voltou aos recebidos (está ' + (n ? estadoLegivel(n.status) : 'desaparecido') + '). Vê o listar.');
  return (pedido ? 'Pedido ' : 'Erro ') + o.id + ' de volta aos recebidos ' + ondeFica(a) + '.'
    + (pedido && l.draft_reply && LARGA_PROPOSTA_AO_REABRIR ? ' A resposta proposta foi largada (o texto fica no fio, numa nota).' : '');
}

/* publicado: se o commit está publicado no ramo do alvo.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: { texto, codigo } — 0 com «PUBLICADO …», 1 com «POR PUBLICAR: …». */
function cmdPublicado(o, d) {
  const p = verPublicado(o.alvo, o.sha, d);
  const onde = o.alvo === 'prod' ? 'em produção' : 'no dev';
  if (p.publicado) return { texto: 'PUBLICADO ' + onde + ': ' + String(p.sha).slice(0, 7) + ' — ' + p.razao, codigo: 0 };
  return { texto: 'POR PUBLICAR: ' + p.razao, codigo: 1 };
}

/* Corre a linha de comandos e devolve o código de saída; os erros conhecidos
   saem numa linha clara no stderr, sem pilha.
   Recebe: argv — os argumentos depois do script; deps (opcional) — as
   dependências a trocar ({ executar, git, gh, agora, uuid }), para os testes;
   saida (opcional) — { out, err }, onde escrever (o stdout e o stderr por omissão).
   Devolve: o código de saída (0 bem, 1 falhou ou por publicar, 2 argumentos). */
export function principal(argv, deps, saida) {
  const out = (saida && saida.out) || ((t) => process.stdout.write(t));
  const err = (saida && saida.err) || ((t) => process.stderr.write(t));
  try {
    const o = lerArgumentos(argv);
    const d = dependencias(deps);
    const fazer = { listar: cmdListar, comecar: cmdComecar, nota: cmdNota, publicado: cmdPublicado, propor: cmdPropor, concluir: cmdConcluir, reabrir: cmdReabrir }[o.comando];
    const r = fazer(o, d);
    const texto = typeof r === 'string' ? r : r.texto;
    out(texto + '\n');
    return typeof r === 'string' ? 0 : r.codigo;
  } catch (e) {
    if (e instanceof ErroTicket) {
      err('ticket: ' + e.message + '\n');
      return e.codigo;
    }
    err('ticket: falha inesperada: ' + (e && e.stack || e) + '\n');
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
