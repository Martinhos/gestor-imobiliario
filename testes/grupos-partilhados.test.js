// Grupos partilhados de imóveis — o servidor, de ponta a ponta contra o SQL a
// sério (testes/lib/bd.js): as migrações 0017 e 0018, a regra «membro de um
// grupo vivo que contém a casa ⇒ comproprietário» em lib/acesso.js, o
// /api/state com as casas por grupo, a lista sharedGroups e os pedidos em
// sharedGroupRequests, e as rotas de rotas/grupos.js. Entrar pela ligação é
// um PEDIDO que o dono aceita ou recusa. Como nos colaboradores, os testes
// olham sobretudo para o que NÃO se pode: quem só pediu e quem não é membro
// não veem nem escrevem, só o dono decide quem entra, ninguém põe no grupo
// casas alheias, o dono não sai, o token nunca fica em claro, e o 404 da
// ligação não diz porquê.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import {
  ambiente, conta, pedir, resp, estado, sync, casa, registo, comproprietario, cargo, darCargo, desligar, fotografia, auditoria,
} from './lib/api.js';
import { handleApi } from '../worker/src/api.js';
import { canAccessHouse, acessoACasa, participantsOf, purgeAccount } from '../worker/src/lib/acesso.js';
import { pedidosDeGrupo } from '../worker/src/rotas/grupos.js';

/* ------------------------------ armações ------------------------------- */

const FRASE_LIGACAO = 'Esta ligação não serve.';
const FRASE_GRUPO = 'Grupo não encontrado.';
const FRASE_PEDIDO = 'Pedido não encontrado.';
const FRASE_TECTO = 'Este grupo já tem demasiados pedidos por responder. Tenta mais tarde.';
const FRASE_COLAB = 'O serviço Colaboradores está desligado nesta conta.';

// Recebe: env; sql — uma consulta com COUNT(*) AS n; args — os parâmetros.
// Devolve: a promessa do n (0 sem linha).
const conta1 = async (env, sql, ...args) => ((await env.DB.prepare(sql).bind(...args).first()) || {}).n || 0;

// Recebe: env; quem — a conta; id — o id do grupo; name — o nome.
// Devolve: a promessa de {status, ...} do PUT /api/shared-groups/:id.
const criar = (env, quem, id, name) => resp(pedir(env, quem, '/api/shared-groups/' + id, 'PUT', { name }));

// Recebe: env; quem — a conta; id — o id do grupo.
// Devolve: a promessa de {status, url, expiresAt, token} do POST …/link (token tirado do url).
async function ligacao(env, quem, id) {
  const r = await resp(pedir(env, quem, '/api/shared-groups/' + id + '/link', 'POST', {}));
  r.token = r.url ? (/\?grupo=([a-f0-9]{64})$/.exec(r.url) || [])[1] : undefined;
  return r;
}

// Recebe: env; quem — a conta (ou null); token — o da ligação.
// Devolve: a promessa de {status, ...} do POST /api/grupo/:token/entrar.
const entrar = (env, quem, token) => resp(pedir(env, quem, '/api/grupo/' + token + '/entrar', 'POST', {}));

// Recebe: env; quem — a conta que decide; gid — o grupo; uid — quem pediu;
// acao — 'accept' ou 'reject'.
// Devolve: a promessa de {status, ...} do POST …/requests/:uid/:acao.
const decidir = (env, quem, gid, uid, acao) =>
  resp(pedir(env, quem, '/api/shared-groups/' + gid + '/requests/' + uid + '/' + acao, 'POST', {}));

// Recebe: env; quem — a conta; gid — o grupo; uid — o pedido de quem.
// Devolve: a promessa de {status, ...} do DELETE …/requests/:uid.
const cancelar = (env, quem, gid, uid) => resp(pedir(env, quem, '/api/shared-groups/' + gid + '/requests/' + uid, 'DELETE'));

/* Pedir pela ligação e o dono aceitar: o caminho inteiro para alguém entrar.
   Recebe: env; dono — a conta do dono; quem — quem entra; token — o da
   ligação; gid — o grupo.
   Devolve: nada; falha a asserção se um dos passos não passar. */
async function juntar(env, dono, quem, token, gid) {
  const e = await entrar(env, quem, token);
  assert.equal(e.status, 201, JSON.stringify(e));
  assert.equal(e.pedido, true);
  assert.deepEqual(await decidir(env, dono, gid, quem.id, 'accept'), { status: 200, ok: true });
}

// Recebe: env; gid — o grupo; uid — quem pediu.
// Devolve: a promessa da linha do pedido (ou null).
const linhaDoPedido = (env, gid, uid) =>
  env.DB.prepare('SELECT * FROM shared_group_requests WHERE group_id = ? AND user_id = ?').bind(gid, uid).first();

// Recebe: env; gid — o grupo.
// Devolve: a promessa dos usos da ligação do grupo.
const usos = async (env, gid) => (await env.DB.prepare('SELECT uses FROM shared_group_links WHERE group_id = ?').bind(gid).first()).uses;

// Recebe: env; quem — a conta; id — o id do grupo; houseIds — as casas.
// Devolve: a promessa de {status, ...} do PUT …/houses.
const porCasas = (env, quem, id, houseIds) => resp(pedir(env, quem, '/api/shared-groups/' + id + '/houses', 'PUT', { houseIds }));

// Recebe: env; token — o da ligação.
// Devolve: a promessa de {status, ...} do GET /api/grupo/:token, sem sessão.
const prever = (env, token) => resp(pedir(env, null, '/api/grupo/' + token));

// Recebe: env; id — o id do grupo.
// Devolve: a promessa de {membros, casas, ligacoes, pedidos} — as linhas do grupo nas quatro tabelas.
async function linhasDoGrupo(env, id) {
  const q = (t) => env.DB.prepare('SELECT * FROM ' + t + ' WHERE group_id = ?').bind(id).all().then((r) => r.results);
  return {
    membros: await q('shared_group_members'), casas: await q('shared_group_houses'),
    ligacoes: await q('shared_group_links'), pedidos: await q('shared_group_requests'),
  };
}

/* O cenário de base: D é dono de H1 (partilhada com P por ligação, à moda de
   sempre) e de H2; M é quem vai entrar no grupo, e tem a sua casa HM; X é um
   estranho com a sua HX, nunca no grupo. H1 tem um movimento do dono. */
async function armar() {
  const env = ambiente();
  const D = await conta(env, 'Dono');
  const M = await conta(env, 'Membro');
  const P = await conta(env, 'Parceiro');
  const X = await conta(env, 'Estranho');
  await casa(env, D, 'H1', { name: 'T2 Lisboa' });
  await casa(env, D, 'H2', { name: 'T1 Porto' });
  await casa(env, M, 'HM', { name: 'Casa do Membro' });
  await casa(env, X, 'HX', { name: 'Casa do Estranho' });
  await comproprietario(env, D, P, ['H1']);
  await registo(env, 'H1', 'tx', 'x1', { label: 'Renda', amount: 500, paidBy: D.id }, D);
  return { env, D, M, P, X };
}

/* O cenário com o grupo já a andar: D cria G1 com H1, faz a ligação, M pede
   para entrar e D aceita.
   Recebe: o que armar() devolve.
   Devolve: {token} — o token da ligação, em claro. */
async function grupoPronto({ env, D, M }) {
  assert.equal((await criar(env, D, 'G1', 'Prédio da Rua A')).status, 201);
  assert.equal((await porCasas(env, D, 'G1', ['H1'])).status, 200);
  const lig = await ligacao(env, D, 'G1');
  assert.equal(lig.status, 201, JSON.stringify(lig));
  await juntar(env, D, M, lig.token, 'G1');
  return { token: lig.token };
}

/* O cenário do pedido por responder: D cria G1 com H1 e H2 e faz a ligação;
   ninguém pediu ainda.
   Recebe: o que armar() devolve.
   Devolve: {token} — o token da ligação, em claro. */
async function grupoComLigacao({ env, D }) {
  assert.equal((await criar(env, D, 'G1', 'Prédio da Rua A')).status, 201);
  assert.equal((await porCasas(env, D, 'G1', ['H1', 'H2'])).status, 200);
  const lig = await ligacao(env, D, 'G1');
  assert.equal(lig.status, 201, JSON.stringify(lig));
  return { token: lig.token };
}

/* ------------------------------ as migrações --------------------------- */

describe('as migrações 0017 e 0018', () => {
  test('cria as quatro tabelas, cada uma com o seu índice, e a ligação guarda o hash único', async () => {
    const env = ambiente();
    const nomes = (await env.DB.prepare("SELECT name, type FROM sqlite_master WHERE name LIKE 'shared_group%' OR name LIKE 'idx_shared_group%'").all()).results;
    const tabelas = nomes.filter((n) => n.type === 'table' && n.name !== 'shared_group_requests').map((n) => n.name).sort();
    assert.deepEqual(tabelas, ['shared_group_houses', 'shared_group_links', 'shared_group_members', 'shared_groups']);
    const indices = nomes.filter((n) => n.type === 'index' && n.name.startsWith('idx_') && !n.name.includes('requests')).map((n) => n.name).sort();
    assert.deepEqual(indices, ['idx_shared_group_houses_house', 'idx_shared_group_members_user', 'idx_shared_groups_owner']);
    await env.DB.prepare("INSERT INTO shared_group_links (group_id, token_hash, created_at, expires_at) VALUES ('A', 'h', 1, 2)").run();
    await assert.rejects(
      env.DB.prepare("INSERT INTO shared_group_links (group_id, token_hash, created_at, expires_at) VALUES ('B', 'h', 1, 2)").run(),
      /UNIQUE/, 'o mesmo hash não serve dois grupos');
  });

  test('a 0018 cria shared_group_requests: um pedido por pessoa e grupo, pendente por omissão, e os dois índices', async () => {
    const env = ambiente();
    const colunas = (await env.DB.prepare("SELECT name, pk, [notnull] AS nn, dflt_value FROM pragma_table_info('shared_group_requests')").all()).results;
    assert.deepEqual(colunas.map((c) => c.name), ['group_id', 'user_id', 'status', 'created_at', 'decided_at']);
    assert.deepEqual(colunas.filter((c) => c.pk).map((c) => c.name), ['group_id', 'user_id'], 'a chave é (grupo, pessoa)');
    assert.deepEqual(colunas.filter((c) => c.nn).map((c) => c.name), ['group_id', 'user_id', 'status', 'created_at']);
    assert.equal(colunas.find((c) => c.name === 'status').dflt_value, "'pending'");
    const indices = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'shared_group_requests' AND name LIKE 'idx_%' ORDER BY name").all()).results;
    assert.deepEqual(indices.map((i) => i.name), ['idx_shared_group_requests_group', 'idx_shared_group_requests_user']);
    const porGrupo = (await env.DB.prepare("SELECT name FROM pragma_index_info('idx_shared_group_requests_group') ORDER BY seqno").all()).results;
    assert.deepEqual(porGrupo.map((c) => c.name), ['group_id', 'status'], 'o tecto conta os pendentes de um grupo pelo índice');
    await env.DB.prepare("INSERT INTO shared_group_requests (group_id, user_id, created_at) VALUES ('G', 'U', 1)").run();
    assert.equal((await env.DB.prepare('SELECT status FROM shared_group_requests').first()).status, 'pending');
    await assert.rejects(
      env.DB.prepare("INSERT INTO shared_group_requests (group_id, user_id, created_at) VALUES ('G', 'U', 2)").run(),
      /UNIQUE|PRIMARY/, 'a mesma pessoa não tem dois pedidos no mesmo grupo');
  });
});

/* ------------------------------ criar e renomear ------------------------ */

describe('PUT /api/shared-groups/:id', () => {
  test('cria (201) com o dono como membro, renomeia (200), e o nome tem de ter 1 a 60 caracteres', async () => {
    const { env, D } = await armar();
    const foto = await fotografia(env);
    for (const name of ['', '   ', 'x'.repeat(61), undefined]) {
      const r = await criar(env, D, 'G1', name);
      assert.equal(r.status, 400, JSON.stringify(name));
      assert.equal(r.error, 'Dá um nome ao grupo (até 60 caracteres).');
    }
    assert.deepEqual(await fotografia(env), foto, 'as recusas não deixaram rasto');
    const c = await criar(env, D, 'G1', '  Prédio  ');
    assert.deepEqual(c, { status: 201, ok: true, id: 'G1', name: 'Prédio' }, 'o nome vem aparado');
    const g = await env.DB.prepare("SELECT * FROM shared_groups WHERE id = 'G1'").first();
    assert.equal(g.owner_id, D.id);
    assert.equal(g.deleted, 0);
    assert.deepEqual((await linhasDoGrupo(env, 'G1')).membros.map((m) => m.user_id), [D.id], 'o dono tem linha de membro');
    const r = await criar(env, D, 'G1', 'x'.repeat(60));
    assert.equal(r.status, 200, 'renomear');
    assert.equal((await env.DB.prepare("SELECT name FROM shared_groups WHERE id = 'G1'").first()).name, 'x'.repeat(60));
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shared_group_members'), 1, 'renomear não repete o membro');
    const acoes = (await auditoria(env)).map((x) => x.acao);
    assert.deepEqual(acoes, ['grupo.criar', 'grupo.renomear']);
    const st = await estado(env, D);
    assert.equal(st.sharedGroups.length, 1);
    assert.equal(st.sharedGroups[0].mine, true);
    assert.deepEqual(st.sharedGroups[0].members, [{ id: D.id, name: 'Dono' }]);
    assert.deepEqual(st.sharedGroups[0].houses, []);
    assert.deepEqual(st.sharedGroups[0].link, { ativo: false, expiresAt: null, uses: 0 }, 'sem ligação ainda');
  });

  test('um grupo de outro, ou apagado, dá 404 no PUT e no DELETE; um id mau dá 400', async () => {
    const { env, D, M } = await armar();
    await criar(env, D, 'G1', 'Prédio');
    let r = await criar(env, M, 'G1', 'Roubado');
    assert.equal(r.status, 404); assert.equal(r.error, FRASE_GRUPO);
    assert.equal((await resp(pedir(env, M, '/api/shared-groups/G1', 'DELETE'))).status, 404);
    assert.equal((await env.DB.prepare("SELECT name FROM shared_groups WHERE id = 'G1'").first()).name, 'Prédio');
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1', 'DELETE'))).status, 200);
    r = await criar(env, D, 'G1', 'De novo');
    assert.equal(r.status, 404, 'um id apagado não se reutiliza');
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1', 'DELETE'))).status, 404, 'nem se apaga duas vezes');
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/a b', 'PUT', { name: 'x' }))).status, 400);
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/' + 'x'.repeat(65), 'PUT', { name: 'x' }))).status, 400);
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1'))).status, 404, 'não há GET: o estado traz os grupos');
  });
});

/* ------------------------------ a ligação -------------------------------- */

describe('a ligação de convite do grupo', () => {
  test('nasce com ?grupo=<64 hex>, expira em 7 dias, e na base fica só o hash', async () => {
    const { env, D } = await armar();
    await criar(env, D, 'G1', 'Prédio');
    const lig = await ligacao(env, D, 'G1');
    assert.equal(lig.status, 201);
    assert.match(lig.token, /^[a-f0-9]{64}$/);
    assert.equal(lig.url, 'https://app.x.pt/?grupo=' + lig.token);
    assert.ok(Math.abs(lig.expiresAt - Date.now() - 7 * 86400000) < 60000, 'vale 7 dias');
    const r = await pedir(env, D, '/api/shared-groups/G1/link', 'POST', {});
    assert.equal(r.headers.get('Referrer-Policy'), 'no-referrer');
    const l = await env.DB.prepare("SELECT * FROM shared_group_links WHERE group_id = 'G1'").first();
    assert.equal(l.token_hash.length, 64);
    assert.notEqual(l.token_hash, lig.token, 'só o hash');
    assert.equal(l.uses, 0);
    assert.equal(l.revoked_at, null);
    const st = await estado(env, D);
    assert.ok(!JSON.stringify(st).includes(lig.token), 'o url só sai na criação');
    assert.ok(st.sharedGroups[0].link.ativo);
    assert.equal(typeof st.sharedGroups[0].link.expiresAt, 'number');
  });

  test('rodar muda o token e repõe os usos; DELETE revoga; só o dono', async () => {
    const { env, D, M, X } = await armar();
    await criar(env, D, 'G1', 'Prédio');
    const t1 = (await ligacao(env, D, 'G1')).token;
    assert.equal((await entrar(env, M, t1)).status, 201, 'um pedido');
    assert.equal((await estado(env, D)).sharedGroups[0].link.uses, 1);
    const r2 = await ligacao(env, D, 'G1');
    assert.equal(r2.status, 200, 'rodar');
    assert.notEqual(r2.token, t1);
    assert.equal((await prever(env, t1)).status, 404, 'o antigo deixou de servir');
    assert.equal((await prever(env, r2.token)).status, 200);
    assert.equal((await estado(env, D)).sharedGroups[0].link.uses, 0, 'a ligação nova começa do zero');
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM shared_group_links WHERE group_id = 'G1'"), 1, 'uma ligação por grupo');
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1/link', 'DELETE'))).status, 200);
    assert.equal((await prever(env, r2.token)).status, 404);
    assert.equal((await entrar(env, X, r2.token)).status, 404);
    const link = (await estado(env, D)).sharedGroups[0].link;
    assert.equal(link.ativo, false);
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1/link', 'DELETE'))).status, 200, 'revogar duas vezes não faz mal');
    assert.equal((await ligacao(env, D, 'G1')).status, 201, 'depois de revogada, a seguinte é criar');
    // M só pediu, X não é nada: nenhum dos dois toca na ligação
    for (const quem of [M, X]) {
      assert.equal((await ligacao(env, quem, 'G1')).status, 404);
      assert.equal((await resp(pedir(env, quem, '/api/shared-groups/G1/link', 'DELETE'))).status, 404);
    }
    const acoes = (await auditoria(env)).map((x) => x.acao);
    for (const a of ['grupo.ligacao.criar', 'grupo.ligacao.rodar', 'grupo.ligacao.revogar']) assert.ok(acoes.includes(a), a);
    assert.equal(acoes.filter((a) => a === 'grupo.ligacao.revogar').length, 1, 'a segunda revogação não audita nada');
  });
});

/* ------------------------------ a pré-visualização ---------------------- */

describe('GET /api/grupo/:token, sem sessão', () => {
  test('dá o nome, o dono, as casas e o número de membros — e não escreve nada', async () => {
    const a = await armar();
    const { env } = a;
    const { token } = await grupoPronto(a);
    const foto = await fotografia(env);
    const v = await prever(env, token);
    assert.deepEqual(v, { status: 200, name: 'Prédio da Rua A', ownerName: 'Dono', houses: [{ name: 'T2 Lisboa' }], members: 2 });
    assert.ok(!('id' in v) && !JSON.stringify(v).includes('H1'), 'sem ids: só o que a pessoa precisa de ver antes de entrar');
    const r = await pedir(env, null, '/api/grupo/' + token);
    assert.equal(r.headers.get('Referrer-Policy'), 'no-referrer');
    await prever(env, token); await prever(env, token);
    assert.deepEqual(await fotografia(env), foto, 'ver não gasta nem escreve');
    assert.equal(await usos(env, 'G1'), 1, 'só o pedido contou (aceitar não é outro uso)');
  });

  test('o 404 uniforme: token inválido, revogado, expirado, grupo apagado e dono suspenso', async () => {
    const a = await armar();
    const { env, D, X } = a;
    const { token } = await grupoPronto(a);
    const mesmo = async (t, porque) => {
      const v = await prever(env, t);
      assert.equal(v.status, 404, porque);
      assert.equal(v.error, FRASE_LIGACAO, porque);
      const e = await entrar(env, X, t);
      assert.equal(e.status, 404, porque + ' (entrar)');
      assert.equal(e.error, FRASE_LIGACAO, porque + ' (entrar)');
    };
    await mesmo('nao-hex', 'sem a forma de um token');
    await mesmo('b'.repeat(64), 'um token que não existe');
    await env.DB.prepare('UPDATE users SET suspended_at = 1 WHERE id = ?').bind(D.id).run();
    await mesmo(token, 'dono suspenso');
    await env.DB.prepare('UPDATE users SET suspended_at = NULL WHERE id = ?').bind(D.id).run();
    assert.equal((await prever(env, token)).status, 200, 'controlo: volta a servir');
    await env.DB.prepare("UPDATE shared_group_links SET expires_at = ? WHERE group_id = 'G1'").bind(Date.now() - 1).run();
    await mesmo(token, 'expirada');
    const t2 = (await ligacao(env, D, 'G1')).token;
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1/link', 'DELETE'))).status, 200);
    await mesmo(t2, 'revogada');
    const t3 = (await ligacao(env, D, 'G1')).token;
    assert.equal((await prever(env, t3)).status, 200, 'controlo');
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1', 'DELETE'))).status, 200);
    await mesmo(t3, 'grupo apagado');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shared_group_members WHERE user_id = ?', X.id), 0, 'X nunca entrou');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shared_group_requests WHERE user_id = ?', X.id), 0, 'nem ficou com um pedido');
  });

  test('a D1 a falhar na pré-visualização: o mesmo 404, e o relato sem o token', async () => {
    const env = ambiente();
    await conta(env, 'Alguém');   // uma conta viva, que o relato anónimo não pode levar (fica na do sistema)
    const token = 'a'.repeat(64);
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => {
      if (/shared_group_links/.test(sql)) throw new Error('D1 em baixo');
      return prepare(sql);
    };
    const pendentes = [];
    const r = await resp(handleApi(new Request('https://app.x.pt/api/grupo/' + token), env, { waitUntil(p) { pendentes.push(p); } }));
    env.DB.prepare = prepare;
    await Promise.all(pendentes);
    assert.equal(r.status, 404);
    assert.equal(r.error, FRASE_LIGACAO);
    const tickets = (await env.DB.prepare('SELECT * FROM tickets').all()).results;
    assert.equal(tickets.length, 1, 'ficou um relato para quem programa');
    assert.ok(!JSON.stringify(tickets).includes(token), 'sem o token em claro');
    assert.ok(tickets[0].body.startsWith('GET /api/grupo/…'), tickets[0].body);
    assert.equal((await prever(env, 'b'.repeat(64))).status, 404, 'um token que não existe não é um erro');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM tickets'), 1, 'e não deixa relato');
  });
});

/* ------------------------------ entrar ----------------------------------- */

describe('POST /api/grupo/:token/entrar — um pedido que o dono aceita', () => {
  test('cria um pedido pendente (201) e conta um uso, sem dar acesso: nem casas, nem grupo, nem ids na resposta; sem sessão 401', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoComLigacao(a);
    assert.equal((await entrar(env, null, token)).status, 401, 'pedir exige sessão');
    const e = await entrar(env, M, token);
    assert.deepEqual(e, { status: 201, id: 'G1', name: 'Prédio da Rua A', ownerName: 'Dono',
      houses: [{ name: 'T2 Lisboa' }, { name: 'T1 Porto' }], jaEstava: false, pedido: true });
    assert.ok(!/H1|H2/.test(JSON.stringify(e)), 'os ids das casas não saem a quem ainda não é membro');
    const p = await linhaDoPedido(env, 'G1', M.id);
    assert.equal(p.status, 'pending');
    assert.equal(p.decided_at, null);
    assert.ok(Math.abs(p.created_at - Date.now()) < 60000);
    assert.equal(await usos(env, 'G1'), 1, 'o pedido é um uso da ligação');
    assert.deepEqual((await linhasDoGrupo(env, 'G1')).membros.map((m) => m.user_id), [D.id], 'ainda não é membro');
    // nenhum acesso: nem pela regra, nem no estado, nem a escrever
    for (const h of ['H1', 'H2']) {
      assert.equal((await canAccessHouse(env, M.id, h)).ok, false, h);
      assert.equal((await acessoACasa(env, M.id, h)).ok, false, h);
    }
    assert.deepEqual(await participantsOf(env, 'H1'), [D.id, a.P.id]);
    assert.deepEqual(await participantsOf(env, 'H2'), [D.id]);
    const st = await estado(env, M);
    assert.deepEqual(st.houses.map((h) => h.id), ['HM']);
    assert.deepEqual(st.sharedGroups, [], 'o grupo não aparece a quem só pediu');
    assert.ok(!/"H1"|"H2"/.test(JSON.stringify(st)), 'nada das casas do grupo no estado de quem só pediu');
    assert.deepEqual(st.sharedGroupRequests, {
      incoming: [],
      outgoing: [{ groupId: 'G1', groupName: 'Prédio da Rua A', ownerName: 'Dono', createdAt: p.created_at }],
    });
    const foto = await fotografia(env);
    const put = { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x9', data: { label: 'antes de tempo' } };
    assert.equal((await sync(env, M, [put]))[0].status, 403);
    assert.equal((await resp(pedir(env, M, '/api/houses/H2', 'PUT', { data: { id: 'H2', name: 'Minha' } }))).status, 403);
    // nem nas rotas do grupo: quem só pediu leva o 404 de quem não é membro
    for (const [path, method, corpo] of [
      ['/api/shared-groups/G1/houses', 'PUT', { houseIds: ['HM'] }],
      ['/api/shared-groups/G1/houses/H1', 'DELETE'],
      ['/api/shared-groups/G1/members/' + M.id, 'DELETE'],
      ['/api/shared-groups/G1/link', 'POST', {}],
      ['/api/shared-groups/G1/requests/' + M.id + '/accept', 'POST', {}],
    ]) {
      assert.deepEqual(await resp(pedir(env, M, path, method, corpo)), { status: 404, error: FRASE_GRUPO }, method + ' ' + path);
    }
    assert.deepEqual(await fotografia(env), foto, 'quem só pediu não escreveu nada');
    const r = await pedir(env, M, '/api/grupo/' + token + '/entrar', 'POST', {});
    assert.equal(r.headers.get('Referrer-Policy'), 'no-referrer');
    const criados = (await auditoria(env)).filter((x) => x.acao === 'grupo.pedido.criar');
    assert.equal(criados.length, 1);
    assert.equal(criados[0].quem, M.id);
    assert.equal(criados[0].alvo, 'G1');
    assert.ok(criados[0].detalhe.startsWith(D.id + ' · '), criados[0].detalhe);
    assert.ok(!criados[0].detalhe.includes(token), 'a auditoria leva o prefixo do hash, não o token');
  });

  test('pedir outra vez com o pedido pendente dá o mesmo pedido (jaPedido): nem outra linha, nem outro uso, nem rasto', async () => {
    const a = await armar();
    const { env, M } = a;
    const { token } = await grupoComLigacao(a);
    assert.equal((await entrar(env, M, token)).status, 201);
    const foto = await fotografia(env);
    const e2 = await entrar(env, M, token);
    assert.deepEqual(e2, { status: 200, id: 'G1', name: 'Prédio da Rua A', ownerName: 'Dono',
      houses: [{ name: 'T2 Lisboa' }, { name: 'T1 Porto' }], jaEstava: false, pedido: true, jaPedido: true });
    assert.deepEqual(await fotografia(env), foto, 'nada foi escrito: a mesma linha, os mesmos usos, nenhuma auditoria');
    assert.equal(await usos(env, 'G1'), 1);
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM shared_group_requests WHERE group_id = 'G1'"), 1);
  });

  test('um membro que entra outra vez recebe jaEstava sem escrever nada; o dono leva 400 «O grupo é teu.»', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoPronto(a);
    const foto = await fotografia(env);
    assert.deepEqual(await entrar(env, M, token), { status: 200, id: 'G1', name: 'Prédio da Rua A', ownerName: 'Dono',
      houses: [{ name: 'T2 Lisboa' }], jaEstava: true, pedido: false });
    assert.deepEqual(await entrar(env, D, token), { status: 400, error: 'O grupo é teu.' });
    assert.deepEqual(await fotografia(env), foto, 'nem o membro nem o dono gastaram um uso ou deixaram rasto');
    assert.equal((await linhaDoPedido(env, 'G1', M.id)).status, 'accepted', 'o pedido aceite fica como estava');
    assert.equal(await linhaDoPedido(env, 'G1', D.id), null, 'o dono não pede no seu grupo');
  });

  test('o dono vê os pedidos em sharedGroupRequests.incoming e em sharedGroups[].pedidos; um membro não os vê; quem pediu vê o seu', async () => {
    const a = await armar();
    const { env, D, M, P, X } = a;
    const { token } = await grupoPronto(a);   // M já é membro
    assert.equal((await entrar(env, X, token)).status, 201);
    assert.equal((await entrar(env, P, token)).status, 201);
    // as horas escritas à mão: a ordem de chegada é a da lista
    await env.DB.prepare('UPDATE shared_group_requests SET created_at = ? WHERE user_id = ?').bind(1000, X.id).run();
    await env.DB.prepare('UPDATE shared_group_requests SET created_at = ? WHERE user_id = ?').bind(2000, P.id).run();
    const stD = await estado(env, D);
    assert.deepEqual(stD.sharedGroups[0].pedidos, [
      { userId: X.id, name: 'Estranho', createdAt: 1000 },
      { userId: P.id, name: 'Parceiro', createdAt: 2000 },
    ], 'pela ordem em que chegaram');
    assert.deepEqual(stD.sharedGroupRequests, {
      incoming: [
        { groupId: 'G1', groupName: 'Prédio da Rua A', userId: X.id, name: 'Estranho', createdAt: 1000 },
        { groupId: 'G1', groupName: 'Prédio da Rua A', userId: P.id, name: 'Parceiro', createdAt: 2000 },
      ],
      outgoing: [],
    });
    const stM = await estado(env, M);
    assert.deepEqual(stM.sharedGroups[0].pedidos, [], 'um membro não vê quem pediu: só o dono decide');
    assert.deepEqual(stM.sharedGroupRequests, { incoming: [], outgoing: [] });
    assert.deepEqual((await estado(env, X)).sharedGroupRequests, {
      incoming: [], outgoing: [{ groupId: 'G1', groupName: 'Prédio da Rua A', ownerName: 'Dono', createdAt: 1000 }],
    });
    assert.deepEqual((await estado(env, P)).sharedGroupRequests.outgoing.map((p) => p.createdAt), [2000]);
  });

  test('pedidosDeGrupo: só os pendentes de grupos vivos — os que chegaram aos meus e os que fiz —, por ordem de chegada', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const B = await conta(env, 'Bruno');
    const C = await conta(env, 'Carla');
    const E = await conta(env, 'Eva');
    // direto na base: A é dona de GA e de GB (apagado); B é dono de GX
    for (const [id, dono, nome, apagado] of [['GA', A, 'Grupo A', 0], ['GB', A, 'Grupo B', 1], ['GX', B, 'Grupo X', 0]]) {
      await env.DB.prepare('INSERT INTO shared_groups (id, owner_id, name, created_at, updated_at, deleted) VALUES (?, ?, ?, 1, 1, ?)')
        .bind(id, dono.id, nome, apagado).run();
    }
    const pede = (gid, quem, status, t) => env.DB.prepare(
      'INSERT INTO shared_group_requests (group_id, user_id, status, created_at) VALUES (?, ?, ?, ?)'
    ).bind(gid, quem.id, status, t).run();
    await pede('GA', C, 'pending', 30);
    await pede('GA', B, 'pending', 10);
    await pede('GA', E, 'rejected', 5);
    await pede('GB', C, 'pending', 1);
    await pede('GX', A, 'pending', 20);
    await pede('GX', C, 'accepted', 2);
    assert.deepEqual(await pedidosDeGrupo(env, A.id), {
      incoming: [
        { groupId: 'GA', groupName: 'Grupo A', userId: B.id, name: 'Bruno', createdAt: 10 },
        { groupId: 'GA', groupName: 'Grupo A', userId: C.id, name: 'Carla', createdAt: 30 },
      ],
      outgoing: [{ groupId: 'GX', groupName: 'Grupo X', ownerName: 'Bruno', createdAt: 20 }],
    });
    assert.deepEqual(await pedidosDeGrupo(env, B.id), {
      incoming: [{ groupId: 'GX', groupName: 'Grupo X', userId: A.id, name: 'Ana', createdAt: 20 }],
      outgoing: [{ groupId: 'GA', groupName: 'Grupo A', ownerName: 'Ana', createdAt: 10 }],
    });
    assert.deepEqual(await pedidosDeGrupo(env, C.id), {
      incoming: [], outgoing: [{ groupId: 'GA', groupName: 'Grupo A', ownerName: 'Ana', createdAt: 30 }],
    }, 'nem o do grupo apagado nem o aceite');
    assert.deepEqual(await pedidosDeGrupo(env, E.id), { incoming: [], outgoing: [] }, 'nem o recusado');
  });
});

/* ------------------------------ os pedidos ------------------------------- */

describe('o dono aceita ou recusa; quem pediu cancela', () => {
  test('aceitar mete o membro: acesso, participantsOf, o estado com as casas e o grupo; o pedido sai das listas', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoComLigacao(a);
    assert.equal((await entrar(env, M, token)).status, 201);
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 200, ok: true });
    assert.deepEqual(await canAccessHouse(env, M.id, 'H1'), { ok: true, owner: false });
    assert.ok((await acessoACasa(env, M.id, 'H2')).coowner);
    assert.deepEqual(await participantsOf(env, 'H1'), [D.id, a.P.id, M.id]);
    const p = await linhaDoPedido(env, 'G1', M.id);
    assert.equal(p.status, 'accepted');
    assert.ok(p.decided_at >= p.created_at);
    const stM = await estado(env, M);
    assert.deepEqual(stM.houses.map((h) => h.id).sort(), ['H1', 'H2', 'HM']);
    assert.ok(stM.records.some((r) => r.houseId === 'H1' && r.id === 'x1'), 'os registos da casa vêm');
    assert.deepEqual(stM.sharedGroups.map((g) => g.id), ['G1']);
    assert.deepEqual(stM.sharedGroupRequests, { incoming: [], outgoing: [] });
    const stD = await estado(env, D);
    assert.deepEqual(stD.sharedGroups[0].pedidos, []);
    assert.deepEqual(stD.sharedGroups[0].members.map((m) => m.id), [D.id, M.id]);
    assert.deepEqual(stD.sharedGroupRequests, { incoming: [], outgoing: [] });
    assert.equal(await usos(env, 'G1'), 1, 'aceitar não gasta a ligação');
    const foto = await fotografia(env);
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 404, error: FRASE_PEDIDO }, 'já não está pendente');
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'reject'), { status: 404, error: FRASE_PEDIDO }, 'nem se recusa depois de aceite');
    assert.deepEqual(await fotografia(env), foto);
    const aceites = (await auditoria(env)).filter((x) => x.acao === 'grupo.pedido.aceitar');
    assert.equal(aceites.length, 1);
    assert.ok(aceites[0].quem === D.id && aceites[0].alvo === M.id && aceites[0].detalhe === 'G1', JSON.stringify(aceites[0]));
  });

  test('recusar marca rejected e não dá acesso; pedir outra vez reabre o mesmo pedido, e conta outro uso', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoComLigacao(a);
    await entrar(env, M, token);
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'reject'), { status: 200, ok: true });
    let p = await linhaDoPedido(env, 'G1', M.id);
    assert.equal(p.status, 'rejected');
    assert.equal(typeof p.decided_at, 'number');
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false);
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM shared_group_members WHERE group_id = 'G1'"), 1, 'só o dono');
    const stM = await estado(env, M);
    assert.deepEqual(stM.houses.map((h) => h.id), ['HM']);
    assert.deepEqual(stM.sharedGroups, []);
    assert.deepEqual(stM.sharedGroupRequests, { incoming: [], outgoing: [] }, 'um recusado sai das listas');
    assert.deepEqual((await estado(env, D)).sharedGroups[0].pedidos, []);
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 404, error: FRASE_PEDIDO }, 'um recusado não se aceita sem pedir outra vez');
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false);
    // pedir outra vez reabre-o: pendente, sem decisão, e é outro uso da ligação
    const e = await entrar(env, M, token);
    assert.equal(e.status, 201);
    assert.equal(e.pedido, true);
    assert.ok(!('jaPedido' in e));
    p = await linhaDoPedido(env, 'G1', M.id);
    assert.equal(p.status, 'pending');
    assert.equal(p.decided_at, null);
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM shared_group_requests WHERE group_id = 'G1'"), 1, 'a mesma linha');
    assert.equal(await usos(env, 'G1'), 2);
    assert.equal((await estado(env, D)).sharedGroupRequests.incoming.length, 1);
    const acoes = await auditoria(env);
    const criados = acoes.filter((x) => x.acao === 'grupo.pedido.criar');
    assert.equal(criados.length, 2);
    assert.ok(criados[1].detalhe.endsWith(' · reaberto'), criados[1].detalhe);
    assert.ok(acoes.some((x) => x.acao === 'grupo.pedido.recusar' && x.quem === D.id && x.alvo === M.id && x.detalhe === 'G1'));
    // e agora o dono aceita
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 200, ok: true });
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, true);
  });

  test('só o dono aceita e recusa: a um membro, a um estranho e a quem pediu, o 404 do grupo, sem rasto', async () => {
    const a = await armar();
    const { env, D, M, X } = a;
    const { token } = await grupoPronto(a);   // M é membro
    const T = await conta(env, 'Terceiro');
    assert.equal((await entrar(env, T, token)).status, 201);
    const foto = await fotografia(env);
    for (const quem of [M, X, T]) {
      for (const acao of ['accept', 'reject']) {
        assert.deepEqual(await decidir(env, quem, 'G1', T.id, acao), { status: 404, error: FRASE_GRUPO }, quem.name + ' ' + acao);
      }
    }
    assert.deepEqual(await decidir(env, T, 'G1', T.id, 'accept'), { status: 404, error: FRASE_GRUPO }, 'ninguém se aceita a si mesmo');
    // o dono: um id mau, alguém sem pedido, um membro, um grupo que não existe, uma ação que não existe
    assert.equal((await decidir(env, D, 'G1', 'a b', 'accept')).status, 400);
    assert.deepEqual(await decidir(env, D, 'G1', X.id, 'accept'), { status: 404, error: FRASE_PEDIDO });
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 404, error: FRASE_PEDIDO }, 'um membro não tem pedido pendente');
    assert.deepEqual(await decidir(env, D, 'G9', T.id, 'accept'), { status: 404, error: FRASE_GRUPO });
    assert.notEqual((await decidir(env, D, 'G1', T.id, 'aprovar')).status, 200);
    assert.deepEqual(await fotografia(env), foto, 'nada foi escrito');
    assert.equal((await canAccessHouse(env, T.id, 'H1')).ok, false);
    assert.equal((await linhaDoPedido(env, 'G1', T.id)).status, 'pending');
  });

  test('quem pediu cancela o seu pedido pendente (a linha sai); o de outra pessoa dá 403; sem pedido, 404', async () => {
    const a = await armar();
    const { env, D, M, X } = a;
    const { token } = await grupoComLigacao(a);
    await entrar(env, M, token);
    await entrar(env, X, token);
    const foto = await fotografia(env);
    const r = await cancelar(env, X, 'G1', M.id);
    assert.equal(r.status, 403);
    assert.equal(r.error, 'Só quem pediu pode cancelar o pedido.');
    assert.equal((await cancelar(env, D, 'G1', M.id)).status, 403, 'o dono recusa, não cancela');
    assert.equal((await cancelar(env, M, 'G1', 'a b')).status, 400);
    assert.deepEqual(await cancelar(env, D, 'G1', D.id), { status: 404, error: FRASE_PEDIDO });
    assert.deepEqual(await cancelar(env, M, 'G9', M.id), { status: 404, error: FRASE_PEDIDO }, 'um grupo que não existe dá o mesmo');
    assert.deepEqual(await fotografia(env), foto, 'as recusas não deixaram rasto');
    assert.deepEqual(await cancelar(env, M, 'G1', M.id), { status: 200, ok: true });
    assert.equal(await linhaDoPedido(env, 'G1', M.id), null, 'a linha saiu');
    assert.equal((await linhaDoPedido(env, 'G1', X.id)).status, 'pending', 'o de X fica');
    assert.deepEqual(await cancelar(env, M, 'G1', M.id), { status: 404, error: FRASE_PEDIDO }, 'cancelar duas vezes');
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 404, error: FRASE_PEDIDO }, 'o dono já não o aceita');
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false);
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM shared_group_members WHERE group_id = 'G1'"), 1);
    assert.deepEqual((await estado(env, M)).sharedGroupRequests.outgoing, []);
    assert.deepEqual((await estado(env, D)).sharedGroupRequests.incoming.map((p) => p.userId), [X.id]);
    assert.ok((await auditoria(env)).some((x) => x.acao === 'grupo.pedido.cancelar' && x.quem === M.id && x.alvo === 'G1' && x.detalhe === D.id));
    // um recusado já não se cancela; e quem cancelou pode pedir de novo
    assert.deepEqual(await decidir(env, D, 'G1', X.id, 'reject'), { status: 200, ok: true });
    assert.deepEqual(await cancelar(env, X, 'G1', X.id), { status: 404, error: FRASE_PEDIDO });
    assert.equal((await entrar(env, M, token)).status, 201, 'depois de cancelar, pede-se de novo');
  });

  test('quem pediu e tem um cargo numa casa do grupo continua colaborador até o dono aceitar (a precedência)', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const ver = await cargo(env, D, 'Ver movimentos', ['tx.view'], 'R_VER');
    await darCargo(env, D, M, ver, ['H1']);
    const { token } = await grupoComLigacao(a);
    assert.equal((await entrar(env, M, token)).status, 201);
    let ac = await acessoACasa(env, M.id, 'H1');
    assert.ok(ac.collab && !ac.coowner, 'o pedido não sobe o grau: ' + JSON.stringify(ac));
    let h1 = (await estado(env, M)).houses.find((h) => h.id === 'H1');
    assert.ok(h1.collab, 'H1 continua a vir despida, pelo cargo');
    assert.equal((await acessoACasa(env, M.id, 'H2')).ok, false, 'H2, sem cargo, nada');
    const put = { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x9', data: { label: 'x' } };
    assert.equal((await sync(env, M, [put]))[0].status, 403, 'o cargo só vê');
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 200, ok: true });
    ac = await acessoACasa(env, M.id, 'H1');
    assert.ok(ac.coowner && !ac.collab, 'aceite, o grau mais alto manda');
    h1 = (await estado(env, M)).houses.find((h) => h.id === 'H1');
    assert.ok(!h1.collab);
    assert.deepEqual(await sync(env, M, [put]), [{ ok: true }]);
  });

  test('rodar ou desativar a ligação não mexe nos pedidos: o dono ainda os aceita ou recusa', async () => {
    const a = await armar();
    const { env, D, M, X } = a;
    const { token } = await grupoComLigacao(a);
    await entrar(env, M, token);
    await entrar(env, X, token);
    const t2 = (await ligacao(env, D, 'G1')).token;
    assert.equal((await entrar(env, M, token)).status, 404, 'o token antigo deixou de servir');
    assert.equal((await entrar(env, M, t2)).jaPedido, true, 'pela nova, o mesmo pedido');
    assert.equal(await usos(env, 'G1'), 0, 'e a nova não gastou nada');
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1/link', 'DELETE'))).status, 200);
    assert.equal((await estado(env, D)).sharedGroupRequests.incoming.length, 2);
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 200, ok: true });
    assert.deepEqual(await decidir(env, D, 'G1', X.id, 'reject'), { status: 200, ok: true });
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, true);
    assert.equal((await canAccessHouse(env, X.id, 'H1')).ok, false);
    assert.deepEqual(await entrar(env, X, t2), { status: 404, error: FRASE_LIGACAO }, 'com a ligação desativada, o recusado não volta a pedir');
  });

  test('apagar o grupo leva os pedidos (pendentes e decididos); quem pediu deixa de ver o seu', async () => {
    const a = await armar();
    const { env, D, M, X } = a;
    const { token } = await grupoComLigacao(a);
    await entrar(env, M, token);
    await entrar(env, X, token);
    await decidir(env, D, 'G1', X.id, 'reject');
    assert.equal((await linhasDoGrupo(env, 'G1')).pedidos.length, 2);
    assert.deepEqual(await resp(pedir(env, D, '/api/shared-groups/G1', 'DELETE')), { status: 200, ok: true });
    assert.deepEqual((await linhasDoGrupo(env, 'G1')).pedidos, []);
    assert.deepEqual((await estado(env, M)).sharedGroupRequests, { incoming: [], outgoing: [] });
    assert.deepEqual((await estado(env, D)).sharedGroupRequests, { incoming: [], outgoing: [] });
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 404, error: FRASE_GRUPO });
    assert.deepEqual(await cancelar(env, M, 'G1', M.id), { status: 404, error: FRASE_PEDIDO });
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false);
  });

  test('purgeAccount leva os pedidos que a conta fez e os que chegaram aos grupos dela', async () => {
    const a = await armar();
    const { env, D, M, X } = a;
    const { token } = await grupoComLigacao(a);
    // M pede no G1 de D; M tem o seu GM, onde X pede; X pede também no G1
    await entrar(env, M, token);
    await criar(env, M, 'GM', 'Grupo do membro');
    await entrar(env, X, (await ligacao(env, M, 'GM')).token);
    await entrar(env, X, token);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shared_group_requests'), 3);
    await purgeAccount(env, M.id);
    assert.equal(await linhaDoPedido(env, 'G1', M.id), null, 'o pedido que M fez');
    assert.deepEqual((await linhasDoGrupo(env, 'GM')).pedidos, [], 'e os que chegaram ao grupo de M');
    assert.equal((await linhaDoPedido(env, 'G1', X.id)).status, 'pending', 'o de X no grupo de D fica');
    assert.deepEqual((await estado(env, D)).sharedGroupRequests.incoming.map((p) => p.userId), [X.id]);
    assert.deepEqual((await estado(env, X)).sharedGroupRequests.outgoing.map((p) => p.groupId), ['G1']);
    await purgeAccount(env, D.id);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shared_group_requests'), 0, 'o dono apagado leva os do seu grupo');
  });

  test('o tecto: com 20 pedidos por responder, o 21.º leva 429 sem rasto; quem já está à espera não; responder abre lugar', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoComLigacao(a);
    const gente = [];
    for (let i = 0; i < 20; i++) {
      const q = await conta(env, 'Pessoa ' + i);
      assert.equal((await entrar(env, q, token)).status, 201, 'pedido ' + (i + 1));
      gente.push(q);
    }
    const foto = await fotografia(env);
    assert.deepEqual(await entrar(env, M, token), { status: 429, error: FRASE_TECTO });
    assert.equal((await entrar(env, gente[0], token)).jaPedido, true, 'quem já está à espera não leva 429');
    assert.deepEqual(await fotografia(env), foto, 'a recusa não deixou rasto nem gastou um uso');
    assert.equal(await usos(env, 'G1'), 20);
    // o dono responde a um: há lugar outra vez, e o recusado conta quando reabre
    assert.deepEqual(await decidir(env, D, 'G1', gente[0].id, 'reject'), { status: 200, ok: true });
    assert.equal((await entrar(env, M, token)).status, 201);
    assert.deepEqual(await entrar(env, gente[0], token), { status: 429, error: FRASE_TECTO });
    assert.deepEqual(await decidir(env, D, 'G1', gente[1].id, 'accept'), { status: 200, ok: true });
    assert.equal((await entrar(env, gente[0], token)).status, 201, 'aceitar também abre lugar');
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM shared_group_requests WHERE group_id = 'G1' AND status = 'pending'"), 20);
  });

  test('o /api/state não faz uma consulta por grupo nem por pedido, e com mais de 50 grupos os pedidos vêm todos', async () => {
    /* D é dono de n grupos, cada um com 3 pedidos, e pediu para entrar em n
       grupos de outra pessoa — tudo escrito direto na base.
       Recebe: n — quantos grupos de cada lado.
       Devolve: quantas consultas o estado de D preparou. */
    const consultas = async (n) => {
      const env = ambiente();
      const D = await conta(env, 'Dono');
      const O = await conta(env, 'Outra');
      const quem = [await conta(env, 'P0'), await conta(env, 'P1'), await conta(env, 'P2')];
      const sql = (s, ...args) => env.DB.prepare(s).bind(...args).run();
      for (let g = 0; g < n; g++) {
        for (const [gid, dono] of [['G' + g, D], ['O' + g, O]]) {
          await sql('INSERT INTO shared_groups (id, owner_id, name, created_at, updated_at, deleted) VALUES (?, ?, ?, 1, 1, 0)', gid, dono.id, gid);
          await sql('INSERT INTO shared_group_members (group_id, user_id, joined_at) VALUES (?, ?, 1)', gid, dono.id);
        }
        for (const q of quem) await sql("INSERT INTO shared_group_requests (group_id, user_id, status, created_at) VALUES (?, ?, 'pending', ?)", 'G' + g, q.id, g);
        await sql("INSERT INTO shared_group_requests (group_id, user_id, status, created_at) VALUES (?, ?, 'pending', ?)", 'O' + g, D.id, g);
      }
      let preparadas = 0;
      const prepare = env.DB.prepare.bind(env.DB);
      env.DB.prepare = (s) => { preparadas++; return prepare(s); };
      const st = await estado(env, D);
      env.DB.prepare = prepare;
      assert.equal(st.status, 200);
      assert.equal(st.sharedGroups.length, n);
      assert.ok(st.sharedGroups.every((g) => g.pedidos.length === 3), 'cada grupo com os seus 3 pedidos');
      assert.equal(st.sharedGroupRequests.incoming.length, 3 * n);
      assert.equal(st.sharedGroupRequests.outgoing.length, n);
      return preparadas;
    };
    const um = await consultas(1);
    assert.equal(await consultas(12), um, 'doze grupos, as mesmas consultas que um');
    assert.ok(await consultas(55) <= um + 4, 'passar os 50 só junta um bloco a cada uma das quatro listas por grupo');
  });
});

/* ------------------------------ membro ⇒ comproprietário ----------------- */

describe('quem está no grupo é comproprietário das casas dele', () => {
  test('depois de entrar: canAccessHouse ok, acessoACasa coowner, participantsOf com o dono primeiro, sem repetidos e junto com a partilha por ligação', async () => {
    const a = await armar();
    const { env, D, M, P } = a;
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false, 'antes: nada');
    const { token } = await grupoPronto(a);
    assert.deepEqual(await canAccessHouse(env, M.id, 'H1'), { ok: true, owner: false });
    const ac = await acessoACasa(env, M.id, 'H1');
    assert.ok(ac.ok && ac.coowner && !ac.owner && !ac.collab, JSON.stringify(ac));
    assert.equal(ac.ownerId, D.id);
    assert.deepEqual(await participantsOf(env, 'H1'), [D.id, P.id, M.id], 'dono, partilha por ligação, membros do grupo');
    assert.equal((await canAccessHouse(env, M.id, 'H2')).ok, false, 'H2 não está no grupo');
    // P, que já é comproprietário por ligação, entra no grupo: continua um só
    await juntar(env, D, P, token, 'G1');
    assert.deepEqual(await participantsOf(env, 'H1'), [D.id, P.id, M.id], 'sem repetidos');
    assert.ok((await acessoACasa(env, P.id, 'H1')).coowner);
    // o dono põe H2: M passa a lá entrar também
    await porCasas(env, D, 'G1', ['H1', 'H2']);
    assert.equal((await canAccessHouse(env, M.id, 'H2')).ok, true);
    assert.deepEqual(await participantsOf(env, 'H2'), [D.id, M.id, P.id]);
    assert.deepEqual(await canAccessHouse(env, D.id, 'H1'), { ok: true, owner: true }, 'o dono continua dono');
  });

  test('o estado do membro traz as casas do grupo com participants e sharedGroups com mine false e link null; o dono vê link com ativo e uses', async () => {
    const a = await armar();
    const { env, D, M, P } = a;
    await grupoPronto(a);
    const stM = await estado(env, M);
    assert.deepEqual(stM.houses.map((h) => h.id).sort(), ['H1', 'HM']);
    const h1 = stM.houses.find((h) => h.id === 'H1');
    assert.equal(h1.mine, false);
    assert.equal(h1.ownerName, 'Dono');
    assert.deepEqual(h1.participants, [D.id, P.id, M.id]);
    assert.ok(!h1.collab, 'inteira, não despida por cargo');
    assert.equal(h1.data.name, 'T2 Lisboa');
    assert.ok(stM.records.some((r) => r.houseId === 'H1' && r.kind === 'tx' && r.id === 'x1'), 'os registos da casa vêm');
    assert.equal(stM.sharedGroups.length, 1);
    const g = stM.sharedGroups[0];
    assert.deepEqual(g, { id: 'G1', name: 'Prédio da Rua A', ownerId: D.id, ownerName: 'Dono', mine: false,
      members: [{ id: D.id, name: 'Dono' }, { id: M.id, name: 'Membro' }],
      houses: [{ id: 'H1', name: 'T2 Lisboa', ownerId: D.id }], link: null, pedidos: [] });
    assert.ok(stM.people.some((p) => p.id === D.id && p.name === 'Dono' && p.kind === 'owner'));
    assert.ok(stM.profiles.some((p) => p.userId === P.id), 'o outro comproprietário de H1 também vem');
    const stD = await estado(env, D);
    assert.deepEqual(stD.houses.find((h) => h.id === 'H1').participants, [D.id, P.id, M.id]);
    const gD = stD.sharedGroups[0];
    assert.equal(gD.mine, true);
    assert.equal(gD.link.ativo, true);
    assert.equal(gD.link.uses, 1);
    assert.ok(gD.link.expiresAt > Date.now());
    assert.ok(stD.people.some((p) => p.id === M.id && p.name === 'Membro'));
    // o parceiro por ligação, que não está no grupo, vê M como participante de H1 mas nenhum grupo
    const stP = await estado(env, P);
    assert.deepEqual(stP.houses.find((h) => h.id === 'H1').participants, [D.id, P.id, M.id]);
    assert.deepEqual(stP.sharedGroups, []);
  });

  test('um membro com cargo numa casa do grupo é comproprietário, não colaborador (a precedência)', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const ver = await cargo(env, D, 'Ver movimentos', ['tx.view'], 'R_VER');
    await darCargo(env, D, M, ver, ['H1', 'H2']);
    assert.ok((await acessoACasa(env, M.id, 'H1')).collab, 'antes do grupo: colaborador');
    await grupoPronto(a);
    const ac = await acessoACasa(env, M.id, 'H1');
    assert.ok(ac.coowner && !ac.collab, 'o grau mais alto manda');
    assert.ok((await acessoACasa(env, M.id, 'H2')).collab, 'em H2, fora do grupo, continua colaborador');
    const st = await estado(env, M);
    const h1 = st.houses.find((h) => h.id === 'H1');
    assert.ok(!h1.collab && h1.data.name === 'T2 Lisboa');
    assert.ok(st.houses.find((h) => h.id === 'H2').collab, 'H2 vem pelo cargo');
    assert.deepEqual(await participantsOf(env, 'H2'), [D.id], 'e lá não é participante');
  });

  test('um não-membro nunca vê nem escreve numa casa do grupo', async () => {
    const a = await armar();
    const { env, X } = a;
    await grupoPronto(a);
    assert.equal((await canAccessHouse(env, X.id, 'H1')).ok, false);
    assert.equal((await acessoACasa(env, X.id, 'H1')).ok, false);
    const st = await estado(env, X);
    assert.deepEqual(st.houses.map((h) => h.id), ['HX']);
    assert.deepEqual(st.sharedGroups, []);
    assert.ok(!st.records.some((r) => r.houseId === 'H1'));
    const foto = await fotografia(env);
    const r = await sync(env, X, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x9', data: { label: 'intruso' } }]);
    assert.equal(r[0].status, 403);
    for (const [path, method, corpo] of [
      ['/api/shared-groups/G1/houses', 'PUT', { houseIds: ['HX'] }],
      ['/api/shared-groups/G1/houses/H1', 'DELETE'],
      ['/api/shared-groups/G1/members/' + X.id, 'DELETE'],
      ['/api/shared-groups/G1/link', 'POST', {}],
      ['/api/shared-groups/G1', 'PUT', { name: 'Meu' }],
      ['/api/shared-groups/G1', 'DELETE'],
    ]) {
      const s = await resp(pedir(env, X, path, method, corpo));
      assert.equal(s.status, 404, method + ' ' + path);
      assert.equal(s.error, FRASE_GRUPO, method + ' ' + path);
    }
    assert.deepEqual(await fotografia(env), foto, 'nada ficou escrito');
  });
});

/* ------------------------------ as casas do grupo ----------------------- */

describe('as casas do grupo', () => {
  test('PUT houses só aceita casas minhas vivas: 403 numa alheia ou apagada, 404 a quem não é membro, 400 com uma lista má', async () => {
    const a = await armar();
    const { env, D, M, X } = a;
    await grupoPronto(a);
    await casa(env, M, 'HMD', { name: 'Apagada' }, 1);
    const foto = await fotografia(env);
    for (const ids of [['H1'], ['HM', 'H2'], ['HX'], ['HMD'], ['NAO']]) {
      const r = await porCasas(env, M, 'G1', ids);
      assert.equal(r.status, 403, JSON.stringify(ids));
      assert.equal(r.error, 'Só podes pôr no grupo imóveis teus.');
    }
    assert.equal((await porCasas(env, X, 'G1', ['HX'])).status, 404, 'quem não é membro');
    assert.equal((await porCasas(env, M, 'G9', ['HM'])).status, 404, 'um grupo que não existe');
    for (const mau of [undefined, 'HM', ['a b'], Array.from({ length: 201 }, (_, i) => 'H' + i)]) {
      assert.equal((await porCasas(env, M, 'G1', mau)).status, 400, JSON.stringify(mau));
    }
    assert.deepEqual(await fotografia(env), foto, 'as recusas não deixaram rasto');
    assert.equal((await porCasas(env, M, 'G1', ['HM'])).status, 200);
    const casas = (await linhasDoGrupo(env, 'G1')).casas;
    assert.deepEqual(casas.map((c) => [c.house_id, c.added_by]).sort(), [['H1', D.id], ['HM', M.id]]);
    assert.ok((await auditoria(env)).some((x) => x.acao === 'grupo.imoveis' && x.quem === M.id && x.alvo === 'G1' && x.detalhe === 'HM'));
  });

  test('PUT houses substitui o MEU conjunto sem tocar nas dos outros; a lista vazia tira as minhas; os outros passam a ver', async () => {
    const a = await armar();
    const { env, D, M } = a;
    await grupoPronto(a);
    assert.equal((await porCasas(env, M, 'G1', ['HM'])).status, 200);
    const stD = await estado(env, D);
    const hm = stD.houses.find((h) => h.id === 'HM');
    assert.ok(hm, 'o dono do grupo passou a ver a casa do membro');
    assert.equal(hm.mine, false);
    assert.deepEqual(hm.participants, [M.id, D.id]);
    assert.deepEqual(stD.sharedGroups[0].houses, [{ id: 'H1', name: 'T2 Lisboa', ownerId: D.id }, { id: 'HM', name: 'Casa do Membro', ownerId: M.id }]);
    // D troca H1 por H2: a HM do membro fica
    assert.equal((await porCasas(env, D, 'G1', ['H2'])).status, 200);
    let casas = (await linhasDoGrupo(env, 'G1')).casas.map((c) => c.house_id).sort();
    assert.deepEqual(casas, ['H2', 'HM']);
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false, 'H1 saiu do grupo');
    assert.equal((await canAccessHouse(env, M.id, 'H2')).ok, true);
    // a lista vazia tira as minhas, e só as minhas
    assert.equal((await porCasas(env, M, 'G1', [])).status, 200);
    casas = (await linhasDoGrupo(env, 'G1')).casas.map((c) => c.house_id);
    assert.deepEqual(casas, ['H2']);
    assert.equal((await canAccessHouse(env, D.id, 'HM')).ok, false);
    assert.equal((await porCasas(env, D, 'G1', [])).status, 200);
    assert.deepEqual((await linhasDoGrupo(env, 'G1')).casas, []);
    assert.deepEqual((await estado(env, M)).sharedGroups[0].houses, [], 'um grupo sem casas continua a existir');
  });

  test('DELETE houses/:hid: o dono do grupo tira qualquer casa, o dono da casa a sua, um terceiro membro leva 403, e 404 se não está no grupo', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoPronto(a);
    const T = await conta(env, 'Terceiro');
    await juntar(env, D, T, token, 'G1');
    await porCasas(env, M, 'G1', ['HM']);
    const tirar = (quem, hid) => resp(pedir(env, quem, '/api/shared-groups/G1/houses/' + hid, 'DELETE'));
    const foto = await fotografia(env);
    let r = await tirar(T, 'HM');
    assert.equal(r.status, 403); assert.equal(r.error, 'Só o dono do grupo ou o dono do imóvel o tiram.');
    r = await tirar(M, 'H1');
    assert.equal(r.status, 403, 'a casa do dono do grupo não é do membro');
    r = await tirar(D, 'H9');
    assert.equal(r.status, 404); assert.equal(r.error, 'Esse imóvel não está no grupo.');
    assert.equal((await tirar(D, 'HX')).status, 404, 'uma casa que existe mas não está no grupo');
    assert.equal((await tirar(D, 'a b')).status, 400);
    assert.deepEqual(await fotografia(env), foto);
    assert.deepEqual(await tirar(D, 'HM'), { status: 200, ok: true }, 'o dono do grupo tira a casa de um membro');
    assert.equal((await canAccessHouse(env, D.id, 'HM')).ok, false);
    assert.equal((await porCasas(env, M, 'G1', ['HM'])).status, 200, 'o membro volta a pô-la');
    assert.deepEqual(await tirar(M, 'HM'), { status: 200, ok: true }, 'e tira a sua');
    assert.deepEqual(await tirar(D, 'H1'), { status: 200, ok: true });
    assert.deepEqual((await linhasDoGrupo(env, 'G1')).casas, []);
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM houses WHERE deleted = 0 AND id IN ('H1', 'HM')"), 2, 'as casas em si ficam');
    assert.equal((await auditoria(env)).filter((x) => x.acao === 'grupo.tirar-imovel').length, 3);
  });
});

/* ------------------------------ escritas, sair, apagar ------------------ */

describe('escrever, sair, ser removido, apagar', () => {
  test('um membro escreve (sync put de um tx) numa casa do grupo; removido pelo dono, leva 403 e deixa de ver a casa', async () => {
    const a = await armar();
    const { env, D, M } = a;
    await grupoPronto(a);
    const put = { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x2', data: { label: 'Água', amount: 30 } };
    let r = await sync(env, M, [put]);
    assert.deepEqual(r, [{ ok: true }]);
    const linha = await env.DB.prepare("SELECT * FROM records WHERE house_id = 'H1' AND kind = 'tx' AND id = 'x2'").first();
    assert.equal(linha.created_by, M.id);
    assert.equal((await resp(pedir(env, M, '/api/houses/H1', 'PUT', { data: { id: 'H1', name: 'Renomeada pelo membro' } }))).status, 200, 'a ficha também');
    assert.equal((await resp(pedir(env, M, '/api/houses/H1', 'DELETE'))).status, 403, 'apagar a casa continua a ser só do dono');
    assert.equal((await resp(pedir(env, M, '/api/shared-groups/G1/members/' + D.id, 'DELETE'))).status, 403, 'o membro não remove o dono');
    assert.deepEqual(await resp(pedir(env, D, '/api/shared-groups/G1/members/' + M.id, 'DELETE')), { status: 200, ok: true });
    r = await sync(env, M, [Object.assign({}, put, { id: 'x3' })]);
    assert.equal(r[0].status, 403);
    assert.deepEqual(await sync(env, M, [{ op: 'del', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x2' }]), [{ ok: true, gone: true }], 'apagar o que já não se vê é «já não existe»');
    const st = await estado(env, M);
    assert.deepEqual(st.houses.map((h) => h.id), ['HM']);
    assert.deepEqual(st.sharedGroups, []);
    assert.ok(!st.records.some((x) => x.houseId === 'H1'));
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false);
    assert.deepEqual(await participantsOf(env, 'H1'), [D.id, a.P.id]);
    assert.ok((await auditoria(env)).some((x) => x.acao === 'grupo.remover' && x.quem === D.id && x.alvo === M.id && x.detalhe === 'G1'));
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1/members/' + M.id, 'DELETE'))).status, 404, 'já não está');
  });

  test('sair leva as casas que pus; o dono não sai (400); um membro não remove outro (403); remover quem não está dá 404', async () => {
    const a = await armar();
    const { env, D, M, X } = a;
    const { token } = await grupoPronto(a);
    const T = await conta(env, 'Terceiro');
    await juntar(env, D, T, token, 'G1');
    await porCasas(env, M, 'G1', ['HM']);
    assert.equal((await canAccessHouse(env, T.id, 'HM')).ok, true, 'controlo: o terceiro vê a casa do membro');
    const sair = (quem, uid) => resp(pedir(env, quem, '/api/shared-groups/G1/members/' + uid, 'DELETE'));
    const foto = await fotografia(env);
    assert.deepEqual(await sair(D, D.id), { status: 400, error: 'O dono não sai do grupo — apaga-o.' });
    let r = await sair(T, M.id);
    assert.equal(r.status, 403); assert.equal(r.error, 'Só o dono do grupo remove membros.');
    assert.deepEqual(await sair(D, X.id), { status: 404, error: 'Essa pessoa não está no grupo.' });
    assert.equal((await sair(D, 'a b')).status, 400);
    assert.deepEqual(await fotografia(env), foto, 'as recusas não deixaram rasto');
    assert.deepEqual(await sair(M, M.id), { status: 200, ok: true });
    const { membros, casas } = await linhasDoGrupo(env, 'G1');
    assert.deepEqual(membros.map((m) => m.user_id).sort(), [D.id, T.id].sort());
    assert.deepEqual(casas.map((c) => c.house_id), ['H1'], 'a HM saiu com quem a pôs');
    assert.equal((await canAccessHouse(env, T.id, 'HM')).ok, false);
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false);
    assert.ok(!(await estado(env, D)).houses.some((h) => h.id === 'HM'));
    assert.ok((await auditoria(env)).some((x) => x.acao === 'grupo.sair' && x.quem === M.id && x.alvo === 'G1'));
    // pela ligação volta a pedir: o pedido aceite de antes reabre, e só entra
    // quando o dono voltar a aceitar — sem as casas que tinha posto
    const e = await entrar(env, M, token);
    assert.equal(e.status, 201, JSON.stringify(e));
    assert.equal((await linhaDoPedido(env, 'G1', M.id)).status, 'pending');
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false, 'sair é sair: voltar é outro pedido');
    assert.deepEqual(await decidir(env, D, 'G1', M.id, 'accept'), { status: 200, ok: true });
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, true);
    assert.deepEqual((await linhasDoGrupo(env, 'G1')).casas.map((c) => c.house_id), ['H1']);
  });

  test('apagar o grupo (só o dono) esvazia membros, casas e ligação e deixa as casas; a ligação deixa de servir', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoPronto(a);
    await porCasas(env, M, 'G1', ['HM']);
    assert.equal((await resp(pedir(env, M, '/api/shared-groups/G1', 'DELETE'))).status, 404, 'um membro não apaga');
    assert.deepEqual(await resp(pedir(env, D, '/api/shared-groups/G1', 'DELETE')), { status: 200, ok: true });
    const g = await env.DB.prepare("SELECT * FROM shared_groups WHERE id = 'G1'").first();
    assert.equal(g.deleted, 1, 'lápide');
    assert.deepEqual(await linhasDoGrupo(env, 'G1'), { membros: [], casas: [], ligacoes: [], pedidos: [] });
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM houses WHERE deleted = 0 AND id IN ('H1', 'HM')"), 2, 'as casas em si ficam');
    assert.equal((await prever(env, token)).status, 404);
    assert.equal((await entrar(env, M, token)).status, 404);
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false);
    assert.equal((await canAccessHouse(env, D.id, 'HM')).ok, false);
    assert.deepEqual((await estado(env, M)).sharedGroups, []);
    assert.deepEqual((await estado(env, D)).sharedGroups, []);
    assert.deepEqual((await estado(env, M)).houses.map((h) => h.id), ['HM']);
    assert.ok((await auditoria(env)).some((x) => x.acao === 'grupo.apagar' && x.quem === D.id && x.alvo === 'G1'));
  });

  test('apagarCasa tira a casa do grupo', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoPronto(a);
    await porCasas(env, D, 'G1', ['H1', 'H2']);
    assert.equal((await resp(pedir(env, D, '/api/houses/H1', 'DELETE'))).status, 200);
    assert.deepEqual((await linhasDoGrupo(env, 'G1')).casas.map((c) => c.house_id), ['H2']);
    assert.deepEqual((await prever(env, token)).houses, [{ name: 'T1 Porto' }]);
    const st = await estado(env, M);
    assert.deepEqual(st.houses.map((h) => h.id).sort(), ['H2', 'HM']);
    assert.deepEqual(st.sharedGroups[0].houses.map((h) => h.id), ['H2']);
    // o desfazer da app volta a gravar a casa: fica viva, mas fora do grupo — o dono volta a pô-la se quiser
    assert.deepEqual(await sync(env, D, [{ op: 'put', scope: 'house', houseId: 'H1', data: { id: 'H1', name: 'T2 Lisboa' } }]), [{ ok: true }]);
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false);
  });

  test('purgeAccount do dono apaga o grupo inteiro; o de um membro só a membership, as casas dele e a sua quota', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoPronto(a);
    const T = await conta(env, 'Terceiro');
    await juntar(env, D, T, token, 'G1');
    await porCasas(env, M, 'G1', ['HM']);
    await criar(env, M, 'GM', 'Grupo do membro');
    await porCasas(env, M, 'GM', ['HM']);
    // as quotas de H1 contam com M (escritas direto, como as propostas as escrevem)
    await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?')
      .bind(JSON.stringify({ id: 'H1', name: 'T2 Lisboa', rooms: [], ownerIds: [D.id, M.id], ownerShares: { [D.id]: 50, [M.id]: 50 } }), 'H1').run();

    await purgeAccount(env, M.id);
    let l = await linhasDoGrupo(env, 'G1');
    assert.deepEqual(l.membros.map((m) => m.user_id).sort(), [D.id, T.id].sort(), 'só a linha de M saiu');
    assert.deepEqual(l.casas.map((c) => c.house_id), ['H1'], 'e a casa que M pôs');
    assert.equal(l.ligacoes.length, 1, 'a ligação do dono fica');
    assert.equal((await env.DB.prepare("SELECT deleted FROM shared_groups WHERE id = 'G1'").first()).deleted, 0, 'o grupo de D continua');
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM shared_groups WHERE id = 'GM'"), 0, 'o grupo de que M era dono foi inteiro');
    assert.deepEqual(await linhasDoGrupo(env, 'GM'), { membros: [], casas: [], ligacoes: [], pedidos: [] });
    const h1 = JSON.parse((await env.DB.prepare("SELECT data FROM houses WHERE id = 'H1'").first()).data);
    assert.deepEqual(h1.ownerIds, [D.id], 'a quota de M saiu de H1');
    assert.deepEqual(h1.ownerShares, { [D.id]: 50 });
    assert.equal((await prever(env, token)).members, 2);
    assert.equal((await canAccessHouse(env, T.id, 'H1')).ok, true, 'o terceiro continua no grupo');

    await purgeAccount(env, D.id);
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM shared_groups WHERE id = 'G1'"), 0);
    l = await linhasDoGrupo(env, 'G1');
    assert.deepEqual(l, { membros: [], casas: [], ligacoes: [], pedidos: [] });
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shared_group_members WHERE user_id = ?', T.id), 0, 'o terceiro deixou de estar em lado nenhum');
    assert.equal((await prever(env, token)).status, 404);
  });

  test('uma proposta de quotas numa casa do grupo exige todos os membros', async () => {
    const a = await armar();
    const { env, D, M, P, X } = a;
    await grupoPronto(a);
    const propor = (quem, shares) => resp(pedir(env, quem, '/api/houses/H1/proposal', 'POST', { shares }));
    const aceitar = (quem) => resp(pedir(env, quem, '/api/houses/H1/proposal/accept', 'POST', {}));
    assert.equal((await propor(D, { [D.id]: 50, [X.id]: 50 })).status, 400, 'só os comproprietários entram na divisão');
    assert.equal((await propor(X, { [D.id]: 100 })).status, 403, 'um estranho não propõe');
    assert.equal((await propor(D, { [D.id]: 50, [P.id]: 50 })).status, 201, 'uma divisão só com dois é válida, mas quem aprova são os três');
    assert.deepEqual(await aceitar(P), { status: 200, ok: true, applied: false }, 'falta o membro do grupo');
    assert.deepEqual(await aceitar(M), { status: 200, ok: true, applied: true });
    let h1 = JSON.parse((await env.DB.prepare("SELECT data FROM houses WHERE id = 'H1'").first()).data);
    assert.deepEqual(h1.ownerIds, [D.id, P.id, M.id], 'os participantes ficam escritos na casa');
    // o membro também propõe: é participante
    assert.equal((await propor(M, { [D.id]: 40, [P.id]: 30, [M.id]: 30 })).status, 201);
    assert.deepEqual(await aceitar(D), { status: 200, ok: true, applied: false });
    assert.deepEqual(await aceitar(P), { status: 200, ok: true, applied: true });
    h1 = JSON.parse((await env.DB.prepare("SELECT data FROM houses WHERE id = 'H1'").first()).data);
    assert.deepEqual(h1.ownerShares, { [D.id]: 40, [P.id]: 30, [M.id]: 30 });
    const st = await estado(env, M);
    assert.equal(st.houses.find((h) => h.id === 'H1').data.ownerShares[M.id], 30);
  });

  test('uma casa em dois grupos: participantsOf sem repetidos, e sair de um mantém o acesso pelo outro', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoPronto(a);
    await criar(env, D, 'G2', 'Outro grupo');
    await porCasas(env, D, 'G2', ['H1']);
    const t2 = (await ligacao(env, D, 'G2')).token;
    assert.notEqual(t2, token);
    await juntar(env, D, M, t2, 'G2');
    assert.deepEqual(await participantsOf(env, 'H1'), [D.id, a.P.id, M.id]);
    const st = await estado(env, M);
    assert.deepEqual(st.houses.find((h) => h.id === 'H1').participants, [D.id, a.P.id, M.id]);
    assert.deepEqual(st.sharedGroups.map((g) => g.id), ['G1', 'G2']);
    assert.equal(st.houses.filter((h) => h.id === 'H1').length, 1, 'a casa vem uma vez');
    assert.equal((await resp(pedir(env, M, '/api/shared-groups/G1/members/' + M.id, 'DELETE'))).status, 200);
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, true, 'ainda está no G2');
    assert.equal((await resp(pedir(env, M, '/api/shared-groups/G2/members/' + M.id, 'DELETE'))).status, 200);
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false);
  });

  test('um grupo de outrem no estado tem o dono e as casas com o dono de cada uma; um grupo sem casas aparece na mesma e os seus membros têm nome em people', async () => {
    const { env, D, M } = await armar();
    await criar(env, D, 'G1', 'Vazio por agora');
    const { token } = await ligacao(env, D, 'G1');
    assert.deepEqual(await prever(env, token), { status: 200, name: 'Vazio por agora', ownerName: 'Dono', houses: [], members: 1 });
    await juntar(env, D, M, token, 'G1');
    const stM = await estado(env, M);
    assert.deepEqual(stM.houses.map((h) => h.id), ['HM'], 'nenhuma casa entrou');
    assert.equal(stM.sharedGroups.length, 1);
    assert.equal(stM.sharedGroups[0].ownerName, 'Dono');
    assert.deepEqual(stM.sharedGroups[0].houses, []);
    assert.ok(stM.people.some((p) => p.id === D.id && p.name === 'Dono'), 'o dono do grupo tem nome, mesmo sem casa comum');
    assert.equal(stM.profiles.find((p) => p.userId === D.id).data, null, 'mas sem casa comum a ficha não vem');
    const stD = await estado(env, D);
    assert.ok(stD.people.some((p) => p.id === M.id && p.name === 'Membro'));
    await porCasas(env, M, 'G1', ['HM']);
    const g = (await estado(env, D)).sharedGroups[0];
    assert.deepEqual(g.houses, [{ id: 'HM', name: 'Casa do Membro', ownerId: M.id }]);
    assert.ok((await estado(env, M)).profiles.find((p) => p.userId === D.id), 'agora há casa comum');
  });
});

/* ------------------------------ serviços --------------------------------- */

describe('com os Colaboradores desligados', () => {
  test('as escritas dão 403 com a frase e não deixam rasto; sharedGroups vem vazio; a casa do grupo continua no estado e aceita escritas', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoPronto(a);
    await desligar(env, M, 'colaboradores');
    const foto = await fotografia(env);
    for (const [path, method, corpo] of [
      ['/api/shared-groups/GN', 'PUT', { name: 'Novo' }],
      ['/api/shared-groups/G1/houses', 'PUT', { houseIds: ['HM'] }],
      ['/api/shared-groups/G1/houses/H1', 'DELETE'],
      ['/api/shared-groups/G1/members/' + M.id, 'DELETE'],
      ['/api/shared-groups/G1/link', 'POST', {}],
      ['/api/grupo/' + token + '/entrar', 'POST', {}],
    ]) {
      const r = await resp(pedir(env, M, path, method, corpo));
      assert.equal(r.status, 403, method + ' ' + path);
      assert.equal(r.error, FRASE_COLAB, method + ' ' + path);
    }
    assert.deepEqual(await fotografia(env), foto, 'nada ficou escrito');
    const st = await estado(env, M);
    assert.deepEqual(st.servicos.desligados, ['colaboradores']);
    assert.deepEqual(st.sharedGroups, []);
    assert.deepEqual(st.sharedGroupRequests, { incoming: [], outgoing: [] });
    const h1 = st.houses.find((h) => h.id === 'H1');
    assert.ok(h1, 'a casa do grupo continua a vir');
    assert.deepEqual(h1.participants, [D.id, a.P.id, M.id]);
    assert.deepEqual(await sync(env, M, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x2', data: { label: 'Luz' } }]), [{ ok: true }], 'o acesso mantém-se');
    assert.equal((await prever(env, token)).status, 200, 'a pré-visualização não tem conta');
    // do lado do dono, o mesmo: a ligação e o grupo não se tocam, mas o estado continua a dar a casa do membro
    await porCasas(env, D, 'G1', ['H1', 'H2']);
    await desligar(env, D, 'colaboradores');
    assert.deepEqual(await ligacao(env, D, 'G1'), { status: 403, error: FRASE_COLAB, token: undefined });
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1', 'DELETE'))).status, 403);
    assert.deepEqual((await estado(env, D)).sharedGroups, []);
    assert.equal((await canAccessHouse(env, M.id, 'H2')).ok, true);
  });

  test('os pedidos: pedir, cancelar, aceitar e recusar dão 403 sem rasto, sharedGroupRequests vem vazio, e o pedido continua sem dar acesso', async () => {
    const a = await armar();
    const { env, D, M, X } = a;
    const { token } = await grupoComLigacao(a);
    assert.equal((await entrar(env, M, token)).status, 201);
    await desligar(env, M, 'colaboradores');
    await desligar(env, X, 'colaboradores');
    const foto = await fotografia(env);
    assert.deepEqual(await entrar(env, X, token), { status: 403, error: FRASE_COLAB });
    assert.deepEqual(await cancelar(env, M, 'G1', M.id), { status: 403, error: FRASE_COLAB });
    assert.deepEqual((await estado(env, M)).sharedGroupRequests, { incoming: [], outgoing: [] }, 'o pedido fica na base, mas não sai');
    assert.deepEqual(await fotografia(env), foto);
    // do lado do dono: vê-o enquanto tem o serviço; desligado, não o vê nem decide
    assert.equal((await estado(env, D)).sharedGroupRequests.incoming.length, 1);
    assert.equal((await estado(env, D)).sharedGroups[0].pedidos.length, 1);
    await desligar(env, D, 'colaboradores');
    for (const acao of ['accept', 'reject']) {
      assert.deepEqual(await decidir(env, D, 'G1', M.id, acao), { status: 403, error: FRASE_COLAB }, acao);
    }
    assert.deepEqual(await fotografia(env), foto, 'nada ficou escrito');
    const stD = await estado(env, D);
    assert.deepEqual(stD.sharedGroupRequests, { incoming: [], outgoing: [] });
    assert.deepEqual(stD.sharedGroups, []);
    assert.equal((await linhaDoPedido(env, 'G1', M.id)).status, 'pending');
    assert.equal((await canAccessHouse(env, M.id, 'H1')).ok, false, 'e o pedido continua sem dar acesso');
    assert.ok(!(await estado(env, M)).houses.some((h) => h.id === 'H1'));
  });
});

/* ------------------------------ rasto e travões -------------------------- */

describe('rasto e travões', () => {
  test('cada escrita deixa rasto no audit_log, e uma recusa não deixa (fotografia)', async () => {
    const a = await armar();
    const { env, D, M, X } = a;
    const { token } = await grupoPronto(a);
    await criar(env, D, 'G1', 'Renomeado');
    await ligacao(env, D, 'G1');
    await porCasas(env, M, 'G1', ['HM']);
    await resp(pedir(env, D, '/api/shared-groups/G1/houses/HM', 'DELETE'));
    await resp(pedir(env, M, '/api/shared-groups/G1/members/' + M.id, 'DELETE'));
    const t1 = (await ligacao(env, D, 'G1')).token;
    await entrar(env, M, t1);
    await cancelar(env, M, 'G1', M.id);
    await entrar(env, M, t1);
    await decidir(env, D, 'G1', M.id, 'reject');
    await juntar(env, D, M, t1, 'G1');
    await resp(pedir(env, D, '/api/shared-groups/G1/members/' + M.id, 'DELETE'));
    await resp(pedir(env, D, '/api/shared-groups/G1/link', 'DELETE'));
    await resp(pedir(env, D, '/api/shared-groups/G1', 'DELETE'));
    const acoes = (await auditoria(env)).map((x) => x.acao);
    for (const acao of ['grupo.criar', 'grupo.renomear', 'grupo.apagar', 'grupo.ligacao.criar', 'grupo.ligacao.rodar',
      'grupo.ligacao.revogar', 'grupo.pedido.criar', 'grupo.pedido.aceitar', 'grupo.pedido.recusar', 'grupo.pedido.cancelar',
      'grupo.imoveis', 'grupo.tirar-imovel', 'grupo.sair', 'grupo.remover']) {
      assert.ok(acoes.includes(acao), acao);
    }
    assert.ok(!acoes.includes('grupo.entrar'), 'entrar já não é uma escrita: é um pedido');
    assert.equal(acoes.filter((x) => x === 'grupo.pedido.criar').length, 4, 'um por pedido: o do grupoPronto e os três daqui');
    assert.ok((await auditoria(env)).every((x) => x.papel === 'utilizador' && x.nome), 'assinado por quem age');
    // as recusas, todas de seguida, sem uma linha nova em tabela nenhuma
    await criar(env, D, 'G2', 'Vivo');
    const t2 = (await ligacao(env, D, 'G2')).token;
    assert.equal((await entrar(env, M, t2)).status, 201, 'um pedido por responder, para as recusas à volta dele');
    const foto = await fotografia(env);
    const recusas = [
      [X, '/api/shared-groups/G2', 'PUT', { name: 'Meu' }],
      [X, '/api/shared-groups/G2/houses', 'PUT', { houseIds: ['HX'] }],
      [D, '/api/shared-groups/G2/houses', 'PUT', { houseIds: ['HX'] }],
      [D, '/api/shared-groups/G2/members/' + D.id, 'DELETE'],
      [D, '/api/grupo/' + t2 + '/entrar', 'POST', {}],
      [M, '/api/grupo/' + token + '/entrar', 'POST', {}],
      [X, '/api/grupo/' + 'c'.repeat(64) + '/entrar', 'POST', {}],
      [D, '/api/shared-groups/G2', 'PUT', { name: '' }],
      [X, '/api/shared-groups/G2/requests/' + M.id + '/accept', 'POST', {}],
      [M, '/api/shared-groups/G2/requests/' + M.id + '/accept', 'POST', {}],
      [D, '/api/shared-groups/G2/requests/' + X.id + '/accept', 'POST', {}],
      [D, '/api/shared-groups/G2/requests/' + X.id + '/reject', 'POST', {}],
      [X, '/api/shared-groups/G2/requests/' + M.id, 'DELETE'],
      [D, '/api/shared-groups/G2/requests/' + M.id, 'DELETE'],
      [X, '/api/shared-groups/G2/requests/' + X.id, 'DELETE'],
    ];
    for (const [quem, path, method, corpo] of recusas) {
      const r = await resp(pedir(env, quem, path, method, corpo));
      assert.ok(r.status >= 400, method + ' ' + path + ' → ' + r.status);
    }
    assert.deepEqual(await fotografia(env), foto);
  });

  test('o token nunca fica em claro: nem na base, nem na auditoria, nem no estado', async () => {
    const a = await armar();
    const { env, D, M } = a;
    const { token } = await grupoPronto(a);
    const tudo = JSON.stringify(await fotografia(env));
    assert.ok(!tudo.includes(token), 'em nenhuma tabela');
    assert.ok(tudo.includes('token_hash'), 'controlo: a fotografia inclui a ligação');
    for (const quem of [D, M]) assert.ok(!JSON.stringify(await estado(env, quem)).includes(token), 'nem no estado de ' + quem.name);
    assert.ok(!JSON.stringify(await prever(env, token)).includes(token), 'nem na pré-visualização');
    assert.ok(!JSON.stringify(await auditoria(env)).includes(token));
  });

  test('o 31.º GET de pré-visualização do mesmo IP leva 429; a 11.ª entrada por conta numa hora também', async () => {
    const env = ambiente();
    const A = await conta(env, 'A');
    const ip = { 'CF-Connecting-IP': '203.0.113.7' };
    for (let i = 0; i < 30; i++) {
      assert.equal((await resp(pedir(env, null, '/api/grupo/' + 'c'.repeat(64), 'GET', undefined, ip))).status, 404);
    }
    assert.equal((await resp(pedir(env, null, '/api/grupo/' + 'c'.repeat(64), 'GET', undefined, ip))).status, 429);
    assert.equal((await resp(pedir(env, null, '/api/grupo/' + 'c'.repeat(64), 'GET', undefined, { 'CF-Connecting-IP': '203.0.113.8' }))).status, 404, 'outro IP segue');
    for (let i = 0; i < 10; i++) assert.equal((await entrar(env, A, 'c'.repeat(64))).status, 404);
    assert.equal((await entrar(env, A, 'c'.repeat(64))).status, 429);
    for (let i = 0; i < 20; i++) assert.equal((await criar(env, A, 'G' + i, 'Grupo ' + i)).status, 201);
    assert.equal((await criar(env, A, 'G20', 'Grupo 20')).status, 429, 'o 21.º grupo numa hora');
    for (let i = 0; i < 10; i++) assert.equal((await ligacao(env, A, 'G0')).status, i ? 200 : 201);
    assert.equal((await ligacao(env, A, 'G0')).status, 429, 'a 11.ª ligação numa hora');
  });
});
