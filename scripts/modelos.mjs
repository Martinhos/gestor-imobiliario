// Os modelos de dados do Lab, do lado do Claude (KAN-167): quando um ticket
// testa um cenário que ainda não existe, o Claude escreve-o em
// web/app/modelos-cenarios.js (com base: false, para não nascer a toda a
// gente) e cria-o, com este script, para quem escreveu o ticket — a pessoa do
// Discord por trás da conta de teste, ou a pessoa da equipa que o escreveu no
// back office. O modelo aparece-lhe na janela «Modelos de dados» do Lab
// (web/cloud/modelos.js), com o selo «Do ticket KAN-N», na tabela qa_modelos
// (migrations/0035_modelos_de_dados.sql).
//
//   node scripts/modelos.mjs criar --cenario <id> --para <KAN-N|KAN-N-X|id do ticket|discord:<id>> [--nome "…"] [--local]
//   node scripts/modelos.mjs listar --para <KAN-N|KAN-N-X|id do ticket|discord:<id>> [--json] [--local]
//
// --para diz de quem é o modelo: a chave de um cartão do kanban (um subticket
// vale pelo pai, que é o que a pessoa escreveu), o id de um ticket de QA, ou
// a pessoa direto (discord:<id>). Num cartão de um ticket de QA a pessoa é
// a do ticket (qa_tickets.discord_id, ou a conta quando não há Discord); num
// cartão criado no back office, quem o criou (o relator, um id do Discord);
// um cartão do Claude, ou de um pedido de uma pessoa, não tem a quem dar o
// modelo, e o script pede o discord:<id>. criar não duplica: se a pessoa já
// tem o cenário (de base ou de um ticket), diz que tem e não escreve.
//
// Os alvos são os do scripts/kanban.mjs: o dev na Cloudflare (a base
// gestor-imobiliario-dev, por omissão, com o wrangler.toml temporário de
// `wrangler d1 list --json`, porque o do repositório tem PLACEHOLDER nos ids)
// e a base isolada (--local: gestor-imobiliario em .wrangler/state-revisao,
// ou na pasta da variável MODELOS_PERSIST). A produção nunca: confereAlvo
// recusa-a antes de o wrangler correr. As leituras vão por --command (só
// SELECT) e as escritas por --file, numa transação; o SQL leva os valores
// escritos lá dentro (plicas dobradas), porque o d1 execute não aceita
// parâmetros.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { numeroDaChave, numeroDoPai, chaveDe } from '../worker/src/lib/kanban.js';
import { comRepeticao, erroDoWrangler, lerJsonDoWrangler, cita } from './ticket.mjs';

// o worker/src não tem "type": "module": cala-se só o aviso de o ler como ES module
const avisosDoNode = process.listeners('warning');
process.removeAllListeners('warning');
process.on('warning', (w) => { if (!(w && w.code === 'MODULE_TYPELESS_PACKAGE_JSON')) avisosDoNode.forEach((f) => f(w)); });

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = path.join(RAIZ, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const CENARIOS = path.join(RAIZ, 'web', 'app', 'modelos-cenarios.js');
const PASTA_TEMP = path.join(os.tmpdir(), 'rendorium-modelos');
// a forma do id de um cenário (a mesma das rotas: worker/src/rotas/modelos.js)
const ID_CENARIO = /^[a-z0-9][a-z0-9-]{0,47}$/;
// a forma do id de um ticket de QA, e de um id do Discord
const ID_TICKET = /^[A-Za-z0-9_-]{1,64}$/;
const ID_DISCORD = /^\d{1,20}$/;
const TETO_NOME = 80;

// os dois sítios onde o script lê e escreve, e só estes
export const ALVOS = {
  remoto: { nome: 'dev', local: false, base: 'gestor-imobiliario-dev' },
  local: { nome: 'local', local: true, base: 'gestor-imobiliario' },
};
export const COMANDOS = ['criar', 'listar'];
export const USO = [
  'Uso:',
  '  node scripts/modelos.mjs criar --cenario <id> --para <KAN-N|KAN-N-X|id do ticket|discord:<id>> [--nome "…"] [--local]',
  '  node scripts/modelos.mjs listar --para <KAN-N|KAN-N-X|id do ticket|discord:<id>> [--json] [--local]',
].join('\n');

/* Um erro dito para pessoas, que a linha de comandos escreve e sai com 1. */
export class ErroModelos extends Error {}

/* A pasta da base isolada do --local: a .wrangler/state-revisao, ou a da
   variável MODELOS_PERSIST (relativa ao app/ ou absoluta).
   Recebe: valor — o da variável (ou nada).
   Devolve: o caminho absoluto. */
export function pastaDaBaseIsolada(valor) {
  const v = String(valor == null ? '' : valor).trim();
  return v ? path.resolve(RAIZ, v) : path.join(RAIZ, '.wrangler', 'state-revisao');
}

/* Lê os argumentos da linha de comandos.
   Recebe: argv — os argumentos depois do script.
   Devolve: {comando, cenario, para, nome, local, json}; lança ErroModelos com
   o uso quando falta ou sobra alguma coisa. */
export function lerArgumentos(argv) {
  const a = Array.isArray(argv) ? argv.slice() : [];
  const o = { comando: a.shift(), cenario: null, para: null, nome: null, local: false, json: false };
  if (COMANDOS.indexOf(o.comando) < 0) throw new ErroModelos(USO);
  while (a.length) {
    const x = a.shift();
    if (x === '--local') o.local = true;
    else if (x === '--json') o.json = true;
    else if (x === '--cenario' || x === '--para' || x === '--nome') {
      const v = a.shift();
      if (v === undefined || v.startsWith('--')) throw new ErroModelos('Falta o valor de ' + x + '.\n' + USO);
      o[x.slice(2)] = v;
    } else throw new ErroModelos('Não conheço «' + x + '».\n' + USO);
  }
  if (!o.para) throw new ErroModelos('Falta o --para (de quem é o modelo).\n' + USO);
  if (o.comando === 'criar') {
    if (!o.cenario || !ID_CENARIO.test(o.cenario)) throw new ErroModelos('O --cenario tem de ser o id de um cenário (minúsculas, números e hífenes).\n' + USO);
    if (o.nome !== null) {
      o.nome = String(o.nome).replace(/\s+/g, ' ').trim();
      if (!o.nome || o.nome.length > TETO_NOME) throw new ErroModelos('O --nome tem de ter entre 1 e ' + TETO_NOME + ' caracteres.');
    }
  } else if (o.cenario || o.nome) {
    throw new ErroModelos('O listar não leva --cenario nem --nome.\n' + USO);
  }
  return o;
}

/* O que o --para é: um cartão do kanban (o número do pai, num subticket), a
   pessoa direto, ou o id de um ticket de QA.
   Recebe: texto — o valor do --para.
   Devolve: {tipo: 'cartao', numero, chave} | {tipo: 'pessoa', dono} | {tipo: 'ticket', id}; lança ErroModelos. */
export function lerPara(texto) {
  const t = String(texto || '').trim();
  const d = /^discord:(.+)$/i.exec(t);
  if (d) {
    if (!ID_DISCORD.test(d[1])) throw new ErroModelos('O discord:<id> tem de ser o número do Discord.');
    return { tipo: 'pessoa', dono: 'discord:' + d[1] };
  }
  const n = numeroDaChave(t);
  if (n !== null && /^kan-/i.test(t)) {
    const pai = numeroDoPai(n);
    return { tipo: 'cartao', numero: pai, chave: chaveDe(pai), pedida: chaveDe(n) };
  }
  if (ID_TICKET.test(t)) return { tipo: 'ticket', id: t };
  throw new ErroModelos('O --para tem de ser KAN-N, o id de um ticket de QA ou discord:<id>.');
}

/* O cenário existe no código? Procura-o pelo id no web/app/modelos-cenarios.js.
   Recebe: id — o do cenário; texto (opcional) — o do ficheiro (para os testes).
   Devolve: nada; lança ErroModelos quando o ficheiro ou o cenário não existem. */
export function confereCenario(id, texto) {
  let t = texto;
  if (t === undefined) {
    if (!existsSync(CENARIOS)) throw new ErroModelos('Não encontro o web/app/modelos-cenarios.js: o cenário escreve-se lá primeiro.');
    t = readFileSync(CENARIOS, 'utf8');
  }
  const re = new RegExp('\\bid\\s*:\\s*([\'"])' + id.replace(/-/g, '\\-') + '\\1');
  if (!re.test(t)) throw new ErroModelos('O cenário «' + id + '» não está no web/app/modelos-cenarios.js: escreve-o lá primeiro (com base: false, se for só para este ticket).');
}

/* A guarda: só o dev na Cloudflare e a base isolada, exatamente. A base
   gestor-imobiliario sem --local é a produção, e recusa-se aqui.
   Recebe: a — o alvo ({nome, local, base}).
   Devolve: o mesmo alvo; lança ErroModelos noutro. */
export function confereAlvo(a) {
  const ok = !!a && typeof a === 'object' && Object.values(ALVOS).some((b) => b.nome === a.nome && b.local === a.local && b.base === a.base);
  if (!ok) throw new ErroModelos('Recuso a base ' + (a && a.base ? a.base : '?') + (a && a.local ? ' (local)' : ' (remota)') + ': este script só fala com o dev (gestor-imobiliario-dev) ou com a base isolada (--local). A produção não se toca.');
  return a;
}

/* O SQL que lê a pessoa de um --para.
   Recebe: p — o de lerPara (cartão ou ticket).
   Devolve: o texto do SELECT. */
export function sqlDaPessoa(p) {
  if (p.tipo === 'cartao') {
    return 'SELECT c.numero, c.relator_id, c.relator_nome, c.origem_tipo, c.origem_id, q.user_id AS q_user, q.discord_id AS q_discord, q.discord_nome AS q_nome'
      + ' FROM kanban_cartoes c LEFT JOIN qa_tickets q ON c.origem_tipo = ' + cita('qa') + ' AND q.id = c.origem_id'
      + ' WHERE c.numero = ' + cita(p.numero) + ' AND c.removed_at IS NULL';
  }
  return 'SELECT id, user_id AS q_user, discord_id AS q_discord, discord_nome AS q_nome FROM qa_tickets WHERE id = ' + cita(p.id);
}

/* A pessoa de uma linha lida por sqlDaPessoa: a do ticket de QA (o Discord,
   ou a conta quando não há Discord; um ticket do back office tem o
   'equipa:<id>' no user_id); num cartão sem ticket, o relator quando é um
   id do Discord.
   Recebe: p — o --para lido; linha — a linha (ou undefined).
   Devolve: {dono, nome}; lança ErroModelos quando não há a quem dar o modelo. */
export function pessoaDaLinha(p, linha) {
  const onde = p.tipo === 'cartao' ? 'o cartão ' + p.chave : 'o ticket ' + p.id;
  if (!linha) throw new ErroModelos('Não encontro ' + onde + ' (removido, ou de outra base?).');
  if (linha.q_discord && ID_DISCORD.test(String(linha.q_discord))) return { dono: 'discord:' + linha.q_discord, nome: linha.q_nome || '' };
  const eq = /^equipa:(\d{1,20})$/.exec(String(linha.q_user || ''));
  if (eq) return { dono: 'discord:' + eq[1], nome: linha.q_nome || '' };
  if (linha.q_user) return { dono: 'conta:' + linha.q_user, nome: '' };
  if (p.tipo === 'cartao' && linha.origem_tipo !== 'pedido' && ID_DISCORD.test(String(linha.relator_id || ''))) {
    return { dono: 'discord:' + linha.relator_id, nome: linha.relator_nome || '' };
  }
  throw new ErroModelos(onde.charAt(0).toUpperCase() + onde.slice(1) + ' não tem uma pessoa a quem dar o modelo (foi criado pelo Claude, ou vem de um pedido): usa --para discord:<id>.');
}

/* O SQL que lê os modelos vivos de uma pessoa, pela ordem da lista.
   Recebe: dono — a chave da pessoa.
   Devolve: o texto do SELECT. */
export function sqlListar(dono) {
  return 'SELECT id, nome, tipo, cenario, origem, ticket, ordem, criado_em FROM qa_modelos WHERE dono = ' + cita(dono)
    + ' AND removido_em IS NULL ORDER BY ordem, criado_em, id';
}

/* As instruções que criam o modelo de cenário para a pessoa: no fim da
   ordem dela, com a origem 'ticket' e a chave do ticket — e só se ela ainda
   não o tiver (de base ou de outro ticket), para repetir não duplicar.
   Recebe: o — {id, dono, cenario, nome, ticket, agora}.
   Devolve: a lista das instruções (texto). */
export function sqlCriar(o) {
  return ['INSERT INTO qa_modelos (id, dono, nome, ordem, tipo, cenario, origem, ticket, criado_em, atualizado_em)'
    + ' SELECT ' + [cita(o.id), cita(o.dono), o.nome ? cita(o.nome) : 'NULL'].join(', ')
    + ', (SELECT COALESCE(MAX(ordem), -1) + 1 FROM qa_modelos WHERE dono = ' + cita(o.dono) + ' AND removido_em IS NULL)'
    + ', ' + cita('cenario') + ', ' + cita(o.cenario) + ', ' + cita('ticket') + ', ' + cita(o.ticket) + ', ' + cita(o.agora) + ', ' + cita(o.agora)
    + ' WHERE NOT EXISTS (SELECT 1 FROM qa_modelos WHERE dono = ' + cita(o.dono) + ' AND cenario = ' + cita(o.cenario)
    + ' AND origem IN (' + cita('base') + ', ' + cita('ticket') + ') AND removido_em IS NULL)'];
}

/* Uma lista de modelos para pessoas: um por linha, com o selo da origem.
   Recebe: dono — a chave da pessoa; linhas — as de sqlListar.
   Devolve: o texto. */
export function listaLegivel(dono, linhas) {
  if (!linhas.length) return dono + ' ainda não tem modelos (os de base nascem quando abrir a janela «Modelos de dados»).';
  return dono + ' — ' + linhas.length + (linhas.length === 1 ? ' modelo' : ' modelos') + ':\n' + linhas.map((r, i) => {
    const selo = r.origem === 'base' ? 'base' : r.origem === 'ticket' ? 'do ticket ' + (r.ticket || '?') : 'gravado';
    return '  ' + (i + 1) + '. ' + (r.nome || r.cenario || '(sem nome)') + (r.tipo === 'cenario' ? ' [cenário ' + r.cenario + ']' : ' [dados]') + ' · ' + selo;
  }).join('\n');
}

/* --------------------------- o wrangler --------------------------- */

/* Corre o wrangler do repositório, sem shell, e repete a falha passageira
   (o comRepeticao do scripts/ticket.mjs); com a sessão OAuth caducada, o
   `wrangler whoami` renova-a e repete-se uma vez.
   Recebe: args — os argumentos do wrangler.
   Devolve: { status, stdout, stderr }; lança ErroModelos sem o wrangler. */
function correWrangler(args) {
  if (!existsSync(WRANGLER)) throw new ErroModelos('Não encontro o wrangler em ' + WRANGLER + ': corre `npm install` no app/.');
  if (process.env.MODELOS_VERBOSO === '1') process.stderr.write('[modelos] wrangler ' + args.join(' ') + '\n');
  const umaVez = (a) => {
    const r = spawnSync(process.execPath, [WRANGLER].concat(a), {
      cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000, windowsHide: true,
      env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' }),
    });
    if (r.error) throw new ErroModelos('O wrangler não correu: ' + r.error.message);
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  };
  return comRepeticao(() => {
    const r = umaVez(args);
    if (r.status === 0 || erroDoWrangler(r.stdout + '\n' + r.stderr).tipo !== 'sem-sessao') return r;
    umaVez(['whoami']);
    return umaVez(args);
  });
}

let configRemota = null;

/* Os argumentos do wrangler que apontam para o alvo: --local com a pasta
   isolada, ou --remote com um wrangler.toml temporário com o id verdadeiro
   da base do dev (o do repositório tem PLACEHOLDER).
   Recebe: a — o alvo (já conferido).
   Devolve: a lista dos argumentos. */
function argsDoAlvo(a) {
  confereAlvo(a);
  if (a.local) return ['--local', '--persist-to', pastaDaBaseIsolada(process.env.MODELOS_PERSIST)];
  if (!configRemota) {
    const r = correWrangler(['d1', 'list', '--json']);
    const lista = lerJsonDoWrangler(r.stdout);
    if (r.status !== 0 || !Array.isArray(lista)) throw new ErroModelos(erroDoWrangler(r.stdout + '\n' + r.stderr).mensagem);
    const b = lista.find((d) => d && d.name === a.base);
    if (!b || !/^[0-9a-f-]{36}$/i.test(String(b.uuid || ''))) throw new ErroModelos('A conta do wrangler não tem a base ' + a.base + '.');
    mkdirSync(PASTA_TEMP, { recursive: true });
    configRemota = path.join(PASTA_TEMP, 'wrangler-dev.toml');
    writeFileSync(configRemota, ['# Temporário, escrito por scripts/modelos.mjs (lê e escreve os modelos do dev).',
      'name = "rendorium-modelos-dev"', 'compatibility_date = "2026-08-01"', '', '[[d1_databases]]', 'binding = "DB"',
      'database_name = "' + a.base + '"', 'database_id = "' + b.uuid + '"', ''].join('\n'));
  }
  return ['--remote', '-c', configRemota];
}

/* Lança o erro de uma chamada que falhou, dito para pessoas.
   Recebe: r — { status, stdout, stderr }; j — o JSON lido.
   Devolve: nada; lança ErroModelos. */
function falhaDoWrangler(r, j) {
  const erro = j && !Array.isArray(j) && j.error;
  const falhou = Array.isArray(j) && j.some((x) => x && x.success === false);
  if (r.status === 0 && !erro && Array.isArray(j) && !falhou) return;
  const t = [erro ? (erro.text || '') : '', r.stdout, r.stderr].join('\n');
  if (/no such table:?\s*qa_modelos/i.test(t)) throw new ErroModelos('A tabela qa_modelos ainda não existe nesta base: falta a migração 0035 (no dev chega com o próximo deploy do ramo dev).');
  throw new ErroModelos(erroDoWrangler(t).mensagem);
}

/* Lê no alvo (só SELECT).
   Recebe: a — o alvo; sql — um SELECT.
   Devolve: as linhas. */
function ler(a, sql) {
  if (!/^\s*SELECT\b/i.test(sql)) throw new ErroModelos('As leituras são só SELECT.');
  const r = correWrangler(['d1', 'execute', a.base].concat(argsDoAlvo(a), ['--json', '--yes', '--command', sql]));
  const j = lerJsonDoWrangler(r.stdout);
  falhaDoWrangler(r, j);
  return (j[0] && Array.isArray(j[0].results)) ? j[0].results : [];
}

/* Escreve no alvo: as instruções num ficheiro temporário, que o wrangler
   corre numa transação.
   Recebe: a — o alvo; instrucoes — o SQL.
   Devolve: nada; lança ErroModelos (e deixa o ficheiro, para se ver). */
function escrever(a, instrucoes) {
  confereAlvo(a);
  mkdirSync(PASTA_TEMP, { recursive: true });
  const f = path.join(PASTA_TEMP, 'escrita-' + randomUUID() + '.sql');
  writeFileSync(f, '-- scripts/modelos.mjs\n' + instrucoes.join(';\n') + ';\n', 'utf8');
  const r = correWrangler(['d1', 'execute', a.base].concat(argsDoAlvo(a), ['--json', '--yes', '--file', f]));
  try { falhaDoWrangler(r, lerJsonDoWrangler(r.stdout)); } catch (e) { e.message += ' (Nada ficou escrito; o SQL está em ' + f + '.)'; throw e; }
  rmSync(f, { force: true });
}

/* --------------------------- os comandos --------------------------- */

/* A pessoa de um --para, lida na base quando é preciso.
   Recebe: a — o alvo; para — o texto do --para.
   Devolve: {dono, nome, ticket} (ticket: a chave ou o id, para o selo). */
function pessoa(a, para) {
  const p = lerPara(para);
  if (p.tipo === 'pessoa') return { dono: p.dono, nome: '', ticket: null };
  const linha = ler(a, sqlDaPessoa(p))[0];
  return Object.assign(pessoaDaLinha(p, linha), { ticket: p.tipo === 'cartao' ? p.chave : p.id });
}

/* criar: o modelo do cenário para quem escreveu o ticket.
   Recebe: o — os argumentos; a — o alvo.
   Devolve: o texto do que fez. */
function cmdCriar(o, a) {
  confereCenario(o.cenario);
  const q = pessoa(a, o.para);
  const antes = ler(a, sqlListar(q.dono));
  const ja = antes.find((r) => r.cenario === o.cenario && (r.origem === 'base' || r.origem === 'ticket'));
  const quem = q.dono + (q.nome ? ' (' + q.nome + ')' : '');
  if (ja) return quem + ' já tem o cenário «' + o.cenario + '» (' + (ja.origem === 'base' ? 'de base' : 'do ticket ' + ja.ticket) + '): não escrevi nada.';
  const ticket = q.ticket || 'discord';
  escrever(a, sqlCriar({ id: randomUUID(), dono: q.dono, cenario: o.cenario, nome: o.nome, ticket, agora: Date.now() }));
  const depois = ler(a, sqlListar(q.dono));
  if (!depois.some((r) => r.cenario === o.cenario && r.origem === 'ticket')) throw new ErroModelos('O modelo não ficou escrito (outro processo criou-o entretanto?).');
  return 'Criei o modelo do cenário «' + o.cenario + '» para ' + quem + ', do ticket ' + ticket + ' (' + (a.local ? 'na base isolada' : 'no dev') + ').\n' + listaLegivel(q.dono, depois);
}

/* listar: os modelos da pessoa de um --para.
   Recebe: o — os argumentos; a — o alvo.
   Devolve: o texto (ou o JSON). */
function cmdListar(o, a) {
  const q = pessoa(a, o.para);
  const linhas = ler(a, sqlListar(q.dono));
  return o.json ? JSON.stringify({ dono: q.dono, modelos: linhas }, null, 2) : listaLegivel(q.dono, linhas);
}

/* A linha de comandos: lê os argumentos, escolhe o alvo e corre o comando.
   Recebe: argv — os argumentos.
   Devolve: o código de saída (0 a correr bem, 1 num erro). */
export function principal(argv) {
  try {
    const o = lerArgumentos(argv);
    const a = confereAlvo(Object.assign({}, o.local ? ALVOS.local : ALVOS.remoto));
    process.stdout.write((o.comando === 'criar' ? cmdCriar(o, a) : cmdListar(o, a)) + '\n');
    return 0;
  } catch (e) {
    if (e instanceof ErroModelos) { process.stderr.write('modelos: ' + e.message + '\n'); return 1; }
    process.stderr.write('modelos: falha inesperada: ' + (e && e.stack || e) + '\n');
    return 1;
  }
}

/* O caminho verdadeiro de um ficheiro, para comparar (o Windows dá nomes curtos).
   Recebe: p — o caminho.
   Devolve: o caminho resolvido, em minúsculas. */
function caminhoReal(p) {
  try { return realpathSync.native(p).toLowerCase(); } catch (e) { return path.resolve(p).toLowerCase(); }
}

// só corre a linha de comandos quando é o ponto de entrada (os testes importam as funções)
if (process.argv[1] && caminhoReal(process.argv[1]) === caminhoReal(fileURLToPath(import.meta.url))) {
  process.exitCode = principal(process.argv.slice(2));
}
