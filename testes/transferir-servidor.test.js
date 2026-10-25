// Transferir a propriedade de casas — o servidor, contra o SQL a sério
// (testes/lib/bd.js) com a migração 0021. Prova o pedido (uma e várias
// casas, as quotas de omissão e as pedidas, e as recusas: não-criador,
// não-ligado, pendente repetido, quotas erradas), o cancelar e o recusar com
// os avisos, e o aceitar: o criador novo, as quotas (somada sem «ficar»,
// as pedidas com ele), quem pediu sem acesso nenhum ou comproprietário pela
// ligação, os comproprietários que ficam (pela ligação a quem recebe ou por
// um grupo dele) e os que perdem o acesso, os grupos, os colaboradores de
// quem pediu, a proposta pendente, os anexos, uma casa que mudou entretanto
// (só essa falha), uma escrita cruzada, o /api/state dos dois lados e as
// limpezas (apagar a casa, cortar a ligação, apagar a conta).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import {
  ambiente, conta, pedir, resp, estado, casa, comproprietario, cargo, darCargo, desligar,
} from './lib/api.js';
import {
  acessoACasa, participantsOf, quotasAMeias, quotasDaTransferencia, purgeAccount, casaMudou,
} from '../worker/src/lib/acesso.js';
import { listarGrupos } from '../worker/src/rotas/grupos.js';

/* ------------------------------ armações ------------------------------- */

// Recebe: env; quem — quem pede; corpo — o do POST /api/transfers.
// Devolve: a promessa de {status, ...}.
const pedirT = (env, quem, corpo) => resp(pedir(env, quem, '/api/transfers', 'POST', corpo));
// Recebe: env; quem — quem recebe; lote.
// Devolve: a promessa de {status, ...} do aceitar.
const aceitarT = (env, quem, lote) => resp(pedir(env, quem, '/api/transfers/' + lote + '/accept', 'POST', {}));
// Recebe: env; quem — quem recebe; lote.
// Devolve: a promessa de {status, ...} do recusar.
const recusarT = (env, quem, lote) => resp(pedir(env, quem, '/api/transfers/' + lote + '/reject', 'POST', {}));
// Recebe: env; quem — quem pediu; lote.
// Devolve: a promessa de {status, ...} do cancelar.
const cancelarT = (env, quem, lote) => resp(pedir(env, quem, '/api/transfers/' + lote, 'DELETE'));

// Recebe: env; sql; args.
// Devolve: a promessa das linhas, em objetos simples.
const linhas = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results.map((r) => ({ ...r }));

// Recebe: env; hid — a casa.
// Devolve: a promessa de { owner, data } como está na base.
async function daBase(env, hid) {
  const r = await env.DB.prepare('SELECT owner_id, data FROM houses WHERE id = ?').bind(hid).first();
  return { owner: r.owner_id, data: JSON.parse(r.data) };
}

// Recebe: env; hid; q — o ownerShares a guardar (direto: o caminho delas é o das propostas).
// Devolve: a promessa do run.
async function quotas(env, hid, q) {
  const d = (await daBase(env, hid)).data;
  d.ownerShares = q;
  d.ownerIds = Object.keys(q);
  await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?').bind(JSON.stringify(d), hid).run();
}

// Uma ligação aceite sem casas partilhadas.
// Recebe: env; a, b — as contas.
// Devolve: o id da ligação.
const ligar = (env, a, b) => comproprietario(env, a, b, []);

/* Um grupo partilhado escrito direto na base.
   Recebe: env; gid; dono; membros; casas — [[houseId, conta que a pôs]].
   Devolve: nada. */
async function grupo(env, gid, dono, membros, casas) {
  const t = Date.now();
  await env.DB.prepare('INSERT INTO shared_groups (id, owner_id, name, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0)')
    .bind(gid, dono.id, 'Grupo ' + gid, t, t).run();
  let i = 0;
  for (const m of [dono, ...membros]) {
    await env.DB.prepare('INSERT INTO shared_group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)').bind(gid, m.id, t + i++).run();
  }
  for (const [hid, quem] of casas) {
    await env.DB.prepare('INSERT INTO shared_group_houses (group_id, house_id, added_by, added_at) VALUES (?, ?, ?, ?)')
      .bind(gid, hid, quem.id, t + i++).run();
  }
}

// Recebe: env; quem — o destinatário.
// Devolve: a promessa dos avisos dele, [kind, house_id, actor_id].
const avisosDe = async (env, quem) => (await linhas(env,
  'SELECT kind, house_id, actor_id FROM house_events WHERE user_id = ? ORDER BY created_at, kind, house_id', quem.id))
  .map((e) => [e.kind, e.house_id, e.actor_id]);

// Recebe: env; quem.
// Devolve: a promessa dos ids das casas que o /api/state lhe manda.
const casasDe = async (env, quem) => (await estado(env, quem)).houses.map((h) => h.id).sort();

/* O cenário de base: Alice (A) cria H1 «T2 Benfica» e H2 «T1 Porto» e está
   ligada ao Bruno (B). Devolve: { env, A, B, cAB }. */
async function base() {
  const env = ambiente();
  const A = await conta(env, 'Alice');
  const B = await conta(env, 'Bruno');
  await casa(env, A, 'H1', { name: 'T2 Benfica' });
  await casa(env, A, 'H2', { name: 'T1 Porto' });
  const cAB = await ligar(env, A, B);
  return { env, A, B, cAB };
}

/* ------------------------------ as quotas ------------------------------ */

describe('as contas das quotas', () => {
  test('quotasAMeias: a minha a meias com quem recebe, somada à dele; sem quotas, partes iguais', () => {
    assert.deepEqual(quotasAMeias({ a: 100 }, 'a', 'b', ['a']), { a: 50, b: 50 });
    assert.deepEqual(quotasAMeias({ a: 60, b: 20, c: 20 }, 'a', 'b', ['a', 'b', 'c']), { a: 30, b: 50, c: 20 });
    const iguais = quotasAMeias(null, 'a', 'b', ['a', 'c']);
    assert.deepEqual(iguais, { a: 25, c: 50, b: 25 });
  });

  test('quotasDaTransferencia: sem ficar a quota passa; com ficar valem as pedidas; quem não fica sai na proporção', () => {
    assert.deepEqual(quotasDaTransferencia({ a: 60, b: 40 }, 'a', 'b', false, null, ['b']), { b: 100 });
    assert.deepEqual(quotasDaTransferencia({ a: 50, c: 50 }, 'a', 'b', false, null, ['b', 'c']), { b: 50, c: 50 });
    assert.equal(quotasDaTransferencia(null, 'a', 'b', false, null, ['b', 'c']), null);
    assert.deepEqual(quotasDaTransferencia({ a: 100 }, 'a', 'b', true, { a: 60, b: 40 }, ['b', 'a']), { a: 60, b: 40 });
    // c perdeu o acesso: a quota dele vai para os que ficam, na proporção
    assert.deepEqual(quotasDaTransferencia({ a: 50, c: 50 }, 'a', 'b', false, null, ['b']), { b: 100 });
    assert.deepEqual(quotasDaTransferencia({}, 'a', 'b', true, { a: 40, b: 40, c: 20 }, ['b', 'a']), { a: 50, b: 50 });
  });
});

/* ------------------------------- pedir --------------------------------- */

describe('pedir a transferência', () => {
  test('uma casa: a linha pendente, o aviso a quem recebe e o /api/state dos dois lados', async () => {
    const { env, A, B } = await base();
    const r = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: false });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.ok, true);
    assert.ok(r.lote);
    const rows = await linhas(env, 'SELECT house_id, from_user, to_user, ficar, shares, status FROM house_transfers');
    assert.deepEqual(rows, [{ house_id: 'H1', from_user: A.id, to_user: B.id, ficar: 0, shares: null, status: 'pending' }]);
    assert.deepEqual(await avisosDe(env, B), [['transf.pedido', 'H1', A.id]]);
    assert.equal((await daBase(env, 'H1')).owner, A.id, 'nada muda antes de aceitar');
    const sb = await estado(env, B);
    assert.equal(sb.transfers.outgoing.length, 0);
    const inc = sb.transfers.incoming[0];
    assert.equal(inc.lote, r.lote);
    assert.deepEqual(inc.from, { id: A.id, name: 'Alice' });
    assert.deepEqual(inc.houses, [{ id: 'H1', name: 'T2 Benfica' }]);
    assert.equal(inc.ficar, false);
    assert.equal(inc.shares, null);
    assert.ok(inc.at > 0);
    const d = sb.departures.find((x) => x.kind === 'transf.pedido');
    assert.deepEqual({ ...d, id: !!d.id, at: d.at > 0 },
      { id: true, kind: 'transf.pedido', houseId: 'H1', houseName: 'T2 Benfica', actorId: A.id, actorName: 'Alice', at: true });
    const sa = await estado(env, A);
    assert.equal(sa.transfers.incoming.length, 0);
    assert.deepEqual(sa.transfers.outgoing[0].to, { id: B.id, name: 'Bruno' });
    assert.ok(!sb.houses.some((h) => h.id === 'H1'), 'quem recebe ainda não vê a casa');
  });

  test('várias casas com ficar: um lote, as quotas pedidas e as de omissão (a minha a meias)', async () => {
    const { env, A, B } = await base();
    await quotas(env, 'H2', { [A.id]: 100 });
    const r = await pedirT(env, A, { houseIds: ['H1', 'H2'], toUserId: B.id, ficar: true, shares: { H1: { [A.id]: 60, [B.id]: 40 } } });
    assert.equal(r.status, 200, JSON.stringify(r));
    const rows = await linhas(env, 'SELECT lote, house_id, ficar, shares FROM house_transfers ORDER BY house_id');
    assert.equal(rows.length, 2);
    assert.ok(rows.every((x) => x.lote === r.lote && x.ficar === 1));
    assert.deepEqual(JSON.parse(rows[0].shares), { [A.id]: 60, [B.id]: 40 });
    assert.deepEqual(JSON.parse(rows[1].shares), { [A.id]: 50, [B.id]: 50 });
    const out = (await estado(env, A)).transfers.outgoing;
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].houses.map((h) => h.name), ['T2 Benfica', 'T1 Porto']);
    assert.deepEqual(out[0].shares, { H1: { [A.id]: 60, [B.id]: 40 }, H2: { [A.id]: 50, [B.id]: 50 } });
    assert.deepEqual((await avisosDe(env, B)).map((a) => a[0] + ' ' + a[1]).sort(), ['transf.pedido H1', 'transf.pedido H2']);
  });

  test('só o criador: o comproprietário leva 403, quem não vê a casa e a casa que não existe levam 404', async () => {
    const { env, A, B } = await base();
    const C = await conta(env, 'Carla');
    await comproprietario(env, A, C, ['H1']);
    await ligar(env, C, B);
    assert.deepEqual(await pedirT(env, C, { houseIds: ['H1'], toUserId: B.id }),
      { status: 403, error: 'Só quem criou o imóvel o pode transferir.' });
    assert.deepEqual(await pedirT(env, B, { houseIds: ['H2'], toUserId: A.id }), { status: 404, error: 'Casa não encontrada.' });
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1', 'NAO'], toUserId: B.id }), { status: 404, error: 'Casa não encontrada.' });
    assert.equal((await linhas(env, 'SELECT * FROM house_transfers')).length, 0, 'nada fica escrito');
  });

  test('só para um proprietário ligado: sem ligação, ligação por aceitar ou a mim próprio → 400', async () => {
    const { env, A } = await base();
    const X = await conta(env, 'Estranho');
    const P = await conta(env, 'Pendente');
    await env.DB.prepare("INSERT INTO connections (id, requester_id, target_id, status, created_at) VALUES ('CP', ?, ?, 'pending', 1)")
      .bind(A.id, P.id).run();
    const frase = { status: 400, error: 'Só podes transferir para um proprietário ligado a ti.' };
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1'], toUserId: X.id }), frase);
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1'], toUserId: P.id }), frase);
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1'], toUserId: A.id }), frase);
    assert.equal((await pedirT(env, A, { houseIds: [], toUserId: X.id })).status, 400, 'sem casas é corpo inválido');
    assert.equal((await pedirT(env, A, { houseIds: ['H1'], toUserId: X.id, ficar: 'sim' })).status, 400);
  });

  test('uma casa com transferência pendente → 409, e o lote inteiro não entra', async () => {
    const { env, A, B } = await base();
    const C = await conta(env, 'Carla');
    await ligar(env, A, C);
    assert.equal((await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id })).status, 200);
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H2', 'H1'], toUserId: C.id }),
      { status: 409, error: 'Este imóvel já tem uma transferência pendente.' });
    assert.equal((await linhas(env, "SELECT * FROM house_transfers WHERE house_id = 'H2'")).length, 0);
    // o índice único parcial segura o mesmo ao nível da base
    assert.throws(() => env.DB._db.prepare(
      "INSERT INTO house_transfers (id, lote, house_id, from_user, to_user, created_at) VALUES ('x', 'l', 'H1', 'a', 'b', 1)").run(), /UNIQUE/);
  });

  test('com ficar, as quotas pedidas só com quem fica e a somar 100', async () => {
    const { env, A, B } = await base();
    const X = await conta(env, 'Estranho');
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: true, shares: { H1: { [A.id]: 60, [B.id]: 30 } } }),
      { status: 400, error: 'As percentagens têm de somar 100.' });
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: true, shares: { H1: { [A.id]: 50, [X.id]: 50 } } }),
      { status: 400, error: 'A divisão só pode incluir quem fica no imóvel.' });
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: true, shares: { H1: { [A.id]: -10, [B.id]: 110 } } }),
      { status: 400, error: 'Percentagens inválidas.' });
    // sem ficar, as quotas são ignoradas
    const r = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: false, shares: { H1: { [X.id]: 100 } } });
    assert.equal(r.status, 200);
    assert.equal((await env.DB.prepare('SELECT shares FROM house_transfers').first()).shares, null);
  });
});

/* -------------------------- cancelar e recusar -------------------------- */

describe('cancelar e recusar', () => {
  test('quem pediu cancela: as casas ficam canceladas, quem recebia é avisado, e nada mudou', async () => {
    const { env, A, B } = await base();
    const { lote } = await pedirT(env, A, { houseIds: ['H1', 'H2'], toUserId: B.id });
    assert.deepEqual(await cancelarT(env, B, lote), { status: 404, error: 'Esta transferência já não está pendente.' }, 'quem recebe não cancela');
    assert.deepEqual(await cancelarT(env, A, lote), { status: 200, ok: true });
    assert.deepEqual((await linhas(env, 'SELECT status FROM house_transfers')).map((x) => x.status), ['cancelled', 'cancelled']);
    assert.deepEqual((await avisosDe(env, B)).filter((a) => a[0] === 'transf.cancelada').map((a) => a[1]).sort(), ['H1', 'H2']);
    assert.ok((await avisosDe(env, B)).every((a) => a[2] === A.id));
    assert.equal((await cancelarT(env, A, lote)).status, 404, 'cancelar outra vez');
    assert.equal((await aceitarT(env, B, lote)).status, 404, 'e já não se aceita');
    assert.deepEqual((await estado(env, B)).transfers, { incoming: [], outgoing: [] });
    assert.equal((await daBase(env, 'H1')).owner, A.id);
  });

  test('quem recebe recusa: quem pediu é avisado; um terceiro e quem pediu não recusam', async () => {
    const { env, A, B } = await base();
    const X = await conta(env, 'Estranho');
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    assert.equal((await recusarT(env, A, lote)).status, 404);
    assert.equal((await recusarT(env, X, lote)).status, 404);
    assert.deepEqual(await recusarT(env, B, lote), { status: 200, ok: true });
    assert.equal((await env.DB.prepare('SELECT status FROM house_transfers').first()).status, 'rejected');
    assert.deepEqual((await avisosDe(env, A)), [['transf.recusada', 'H1', B.id]]);
    assert.deepEqual((await estado(env, A)).transfers.outgoing, []);
    // uma decisão não volta atrás: o trigger recusa
    assert.throws(() => env.DB._db.prepare("UPDATE house_transfers SET status = 'accepted'").run(), /transf-decidida/);
    // e a casa pode ter um pedido novo
    assert.equal((await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id })).status, 200);
  });
});

/* ------------------------------- aceitar -------------------------------- */

describe('aceitar', () => {
  test('sem ficar: o criador muda, a quota soma-se e quem pediu deixa de aceder a tudo', async () => {
    const { env, A, B, cAB } = await base();
    // o Bruno já era comproprietário da H1, pela ligação aos dois
    await env.DB.prepare('INSERT INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)').bind(cAB, A.id, 'H1').run();
    await quotas(env, 'H1', { [A.id]: 60, [B.id]: 40 });
    assert.ok((await acessoACasa(env, B.id, 'H1')).coowner);
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: false });
    const r = await aceitarT(env, B, lote);
    assert.deepEqual(r, { status: 200, ok: true, aceites: ['H1'], falhadas: [] });
    const h = await daBase(env, 'H1');
    assert.equal(h.owner, B.id);
    assert.deepEqual(h.data.ownerShares, { [B.id]: 100 });
    assert.deepEqual(h.data.ownerIds, [B.id]);
    assert.equal((await acessoACasa(env, A.id, 'H1')).ok, false);
    assert.deepEqual(await participantsOf(env, 'H1'), [B.id]);
    assert.deepEqual(await casasDe(env, A), ['H2']);
    const sb = await estado(env, B);
    const cb = sb.houses.find((x) => x.id === 'H1');
    assert.equal(cb.mine, true);
    assert.equal(cb.ownerId, B.id);
    assert.equal((await linhas(env, "SELECT * FROM shares WHERE house_id = 'H1'")).length, 0, 'a partilha antiga saiu');
    assert.equal((await env.DB.prepare('SELECT status FROM house_transfers').first()).status, 'accepted');
    const da = (await estado(env, A)).departures.find((x) => x.kind === 'transf.aceite');
    assert.equal(da.actorId, B.id);
    assert.equal(da.houseName, 'T2 Benfica');
    assert.deepEqual(sb.transfers, { incoming: [], outgoing: [] });
  });

  test('sem ficar e quem pediu é membro de um grupo que fica: sai também por ele (house_exits)', async () => {
    const { env, A, B } = await base();
    const D = await conta(env, 'Duarte');
    await grupo(env, 'G1', A, [B, D], [['H1', A]]);
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    assert.equal((await aceitarT(env, B, lote)).aceites.length, 1);
    assert.equal((await acessoACasa(env, A.id, 'H1')).ok, false, 'nem pelo grupo');
    assert.ok(!(await casasDe(env, A)).includes('H1'));
    assert.deepEqual(await linhas(env, "SELECT user_id FROM house_exits WHERE house_id = 'H1'"), [{ user_id: A.id }]);
    assert.deepEqual(await linhas(env, "SELECT group_id, added_by FROM shared_group_houses WHERE house_id = 'H1'"), [{ group_id: 'G1', added_by: B.id }]);
    assert.ok((await acessoACasa(env, D.id, 'H1')).coowner, 'o Duarte continua pelo grupo');
    const g = (await listarGrupos(env, D.id)).find((x) => x.id === 'G1');
    assert.deepEqual(g.houses.map((x) => [x.id, x.ownerId]), [['H1', B.id]]);
    assert.deepEqual((await avisosDe(env, D)), [['casa.novo_dono', 'H1', B.id]]);
  });

  test('com ficar 60/40: quem pediu fica comproprietário pela ligação aos dois, com as quotas certas', async () => {
    const { env, A, B, cAB } = await base();
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: true, shares: { H1: { [A.id]: 60, [B.id]: 40 } } });
    assert.deepEqual((await aceitarT(env, B, lote)).aceites, ['H1']);
    const h = await daBase(env, 'H1');
    assert.equal(h.owner, B.id);
    assert.deepEqual(h.data.ownerShares, { [A.id]: 60, [B.id]: 40 });
    assert.deepEqual(h.data.ownerIds, [B.id, A.id]);
    const ac = await acessoACasa(env, A.id, 'H1');
    assert.ok(ac.ok && ac.coowner && !ac.owner);
    assert.deepEqual(await linhas(env, "SELECT connection_id, owner_id FROM shares WHERE house_id = 'H1'"), [{ connection_id: cAB, owner_id: B.id }]);
    const ca = (await estado(env, A)).houses.find((x) => x.id === 'H1');
    assert.equal(ca.mine, false);
    assert.deepEqual(ca.participants, [B.id, A.id]);
    const kb = (await estado(env, B)).connections.find((c) => c.id === cAB);
    assert.deepEqual(kb.myShares, ['H1'], 'a partilha é agora do Bruno');
    assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM house_events WHERE kind = 'casa.novo_dono'").first()).n, 0, 'os dois não levam o aviso do dono novo');
  });

  test('o comproprietário ligado a quem recebe fica (partilha nova) e é avisado; o que não está ligado perde o acesso', async () => {
    const { env, A, B } = await base();
    const C = await conta(env, 'Carla');
    const E = await conta(env, 'Eva');
    await comproprietario(env, A, C, ['H1']);
    await comproprietario(env, A, E, ['H1']);
    const cBC = await ligar(env, B, C);
    await quotas(env, 'H1', { [A.id]: 50, [C.id]: 30, [E.id]: 20 });
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    assert.deepEqual((await aceitarT(env, B, lote)).aceites, ['H1']);
    const h = await daBase(env, 'H1');
    // a quota da Alice passa ao Bruno; a da Eva, que perdeu o acesso, vai na proporção
    assert.deepEqual(h.data.ownerShares, { [B.id]: 62.5, [C.id]: 37.5 });
    assert.deepEqual(h.data.ownerIds, [B.id, C.id]);
    assert.deepEqual(await linhas(env, "SELECT connection_id, owner_id FROM shares WHERE house_id = 'H1'"), [{ connection_id: cBC, owner_id: B.id }]);
    assert.ok((await acessoACasa(env, C.id, 'H1')).coowner);
    assert.equal((await acessoACasa(env, E.id, 'H1')).ok, false);
    assert.deepEqual(await avisosDe(env, C), [['casa.novo_dono', 'H1', B.id]]);
    assert.deepEqual(await avisosDe(env, E), [['casa.sem_acesso', 'H1', B.id]]);
    const de = (await estado(env, E)).departures[0];
    assert.equal(de.kind, 'casa.sem_acesso');
    assert.equal(de.actorName, 'Bruno');
    assert.ok(!(await casasDe(env, E)).includes('H1'));
  });

  test('os grupos: a casa fica nos de quem recebe e sai dos outros; quem só a via por esses perde-a', async () => {
    const { env, A, B } = await base();
    const D = await conta(env, 'Duarte');
    const F = await conta(env, 'Filipa');
    await grupo(env, 'G1', A, [B, D], [['H1', A]]);
    await grupo(env, 'G2', A, [F], [['H1', A], ['H2', A]]);
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: true, shares: { H1: { [A.id]: 50, [B.id]: 50 } } });
    assert.deepEqual((await aceitarT(env, B, lote)).aceites, ['H1']);
    assert.deepEqual(await linhas(env, "SELECT group_id, added_by FROM shared_group_houses WHERE house_id = 'H1'"), [{ group_id: 'G1', added_by: B.id }]);
    assert.deepEqual(await linhas(env, "SELECT house_id FROM shared_group_houses WHERE group_id = 'G2'"), [{ house_id: 'H2' }], 'a H2 fica no G2');
    assert.ok((await acessoACasa(env, D.id, 'H1')).coowner);
    assert.equal((await acessoACasa(env, F.id, 'H1')).ok, false);
    assert.ok((await acessoACasa(env, A.id, 'H1')).coowner, 'a Alice fica (ficar)');
    assert.deepEqual(await avisosDe(env, F), [['casa.sem_acesso', 'H1', B.id]]);
    // o Bruno regrava o conjunto dele no grupo: a casa é dele e fica
    assert.equal((await resp(pedir(env, B, '/api/shared-groups/G1/houses', 'PUT', { houseIds: ['H1'] }))).status, 200);
    // e a Alice regrava o dela sem a casa: não a leva
    assert.equal((await resp(pedir(env, A, '/api/shared-groups/G1/houses', 'PUT', { houseIds: [] }))).status, 200);
    assert.deepEqual(await linhas(env, "SELECT group_id FROM shared_group_houses WHERE house_id = 'H1'"), [{ group_id: 'G1' }]);
  });

  test('os colaboradores de quem pediu perdem o acesso a essa casa e são avisados; os de quem recebe não mexem', async () => {
    const { env, A, B } = await base();
    const R = await conta(env, 'Rui');
    const S = await conta(env, 'Sara');
    const T = await conta(env, 'Tiago');
    await casa(env, B, 'H9', { name: 'Casa do Bruno' });
    await cargo(env, A, 'Contabilista', ['tx.add'], 'R_A');
    await darCargo(env, A, R, 'R_A', ['H1', 'H2']);
    await darCargo(env, A, T, 'R_A', ['H1']);
    await cargo(env, B, 'Gestor', ['tx.add'], 'R_B');
    await darCargo(env, B, S, 'R_B', ['H9']);
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    assert.deepEqual((await aceitarT(env, B, lote)).aceites, ['H1']);
    assert.equal((await acessoACasa(env, R.id, 'H1')).ok, false);
    assert.ok((await acessoACasa(env, R.id, 'H2')).collab, 'o Rui fica com a H2');
    assert.equal((await acessoACasa(env, T.id, 'H1')).ok, false);
    assert.equal((await linhas(env, 'SELECT * FROM collaborators WHERE user_id = ?', T.id)).length, 0, 'a linha do Tiago ficou sem casas e saiu');
    assert.ok((await acessoACasa(env, S.id, 'H9')).collab, 'a Sara, do Bruno, não mexe');
    assert.deepEqual(await avisosDe(env, R), [['colab.removido', 'H1', A.id]]);
    assert.deepEqual(await avisosDe(env, T), [['colab.removido', 'H1', A.id]]);
    assert.deepEqual(await avisosDe(env, S), []);
    const dr = (await estado(env, R)).departures[0];
    assert.equal(dr.actorName, 'Alice');
    assert.equal(dr.houseName, 'T2 Benfica');
    assert.deepEqual((await estado(env, B)).houses.find((x) => x.id === 'H1').collaborators, []);
  });

  test('a proposta de quotas pendente cai, e os anexos da casa passam a ser de quem recebe', async () => {
    const { env, A, B } = await base();
    const C = await conta(env, 'Carla');
    await comproprietario(env, A, C, ['H1']);
    await ligar(env, B, C);
    assert.equal((await resp(pedir(env, A, '/api/houses/H1/proposal', 'POST', { shares: { [A.id]: 70, [C.id]: 30 } }))).status, 201);
    for (const [id, dono, hid] of [['F1', A, 'H1'], ['F2', C, 'H1'], ['F3', A, 'H2']]) {
      await env.DB.prepare('INSERT INTO files (id, owner_id, house_id, name, type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, dono.id, hid, id, 'image/png', 10, 1).run();
    }
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    assert.deepEqual((await aceitarT(env, B, lote)).aceites, ['H1']);
    assert.equal((await linhas(env, 'SELECT * FROM share_proposals')).length, 0);
    assert.deepEqual(await linhas(env, 'SELECT id, owner_id FROM files ORDER BY id'),
      [{ id: 'F1', owner_id: B.id }, { id: 'F2', owner_id: B.id }, { id: 'F3', owner_id: A.id }]);
  });

  test('uma casa que mudou entretanto falha só essa: apagada, ou já com outro dono', async () => {
    const { env, A, B } = await base();
    const C = await conta(env, 'Carla');
    await casa(env, A, 'H3', { name: 'Loja' });
    const { lote } = await pedirT(env, A, { houseIds: ['H1', 'H2', 'H3'], toUserId: B.id });
    // por fora das rotas (que cancelariam o pedido): uma apagada, outra com outro dono
    await env.DB.prepare("UPDATE houses SET deleted = 1 WHERE id = 'H2'").run();
    await env.DB.prepare('UPDATE houses SET owner_id = ? WHERE id = ?').bind(C.id, 'H3').run();
    const r = await aceitarT(env, B, lote);
    assert.equal(r.status, 200);
    assert.deepEqual(r.aceites, ['H1']);
    assert.deepEqual(r.falhadas.sort((x, y) => x.houseId.localeCompare(y.houseId)), [
      { houseId: 'H2', error: 'Casa não encontrada.' },
      { houseId: 'H3', error: 'Quem pediu já não é o dono deste imóvel.' },
    ]);
    assert.equal((await daBase(env, 'H1')).owner, B.id);
    assert.equal((await daBase(env, 'H3')).owner, C.id);
    assert.deepEqual(await linhas(env, 'SELECT house_id, status FROM house_transfers ORDER BY house_id'), [
      { house_id: 'H1', status: 'accepted' }, { house_id: 'H2', status: 'cancelled' }, { house_id: 'H3', status: 'cancelled' },
    ]);
  });

  test('uma gravação da ficha a meio do aceitar não se perde nem desfaz a transferência', async () => {
    const { env, A, B } = await base();
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: true, shares: { H1: { [A.id]: 60, [B.id]: 40 } } });
    // a ficha da Alice entra entre a leitura do aceitar e a escrita dele
    const db = env.DB, batch = db.batch.bind(db);
    let uma = true, recusas = 0;
    db.batch = async (stmts) => {
      if (uma && stmts.some((s) => s && s._transf)) {
        uma = false;
        assert.equal((await resp(pedir(env, A, '/api/houses/H1', 'PUT', { data: { id: 'H1', name: 'T2 Benfica (obras)', rooms: [] } }))).status, 200);
      }
      try { return await batch(stmts); } catch (e) { if (casaMudou(e)) recusas++; throw e; }
    };
    const prepare = db.prepare.bind(db);
    db.prepare = (sql) => { const q = prepare(sql); if (/UPDATE house_transfers SET status = 'accepted'/.test(sql)) q._transf = true; return q; };
    const r = await aceitarT(env, B, lote);
    assert.deepEqual(r.aceites, ['H1'], JSON.stringify(r));
    assert.equal(recusas, 1, 'a primeira escrita do aceitar foi recusada e repetida');
    const h = await daBase(env, 'H1');
    assert.equal(h.owner, B.id);
    assert.equal(h.data.name, 'T2 Benfica (obras)', 'a ficha ficou');
    assert.deepEqual(h.data.ownerShares, { [A.id]: 60, [B.id]: 40 });
  });

  test('sem Imóveis, quem recebe não aceita nem quem pede pede (403); recusar passa', async () => {
    const { env, A, B } = await base();
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    await desligar(env, B, 'properties');
    assert.equal((await aceitarT(env, B, lote)).status, 403);
    assert.equal((await pedirT(env, B, { houseIds: ['H9'], toUserId: A.id })).status, 403);
    assert.equal((await recusarT(env, B, lote)).status, 200);
  });
});

/* ------------------------------ limpezas -------------------------------- */

describe('o que leva os pedidos pendentes', () => {
  test('apagar a casa cancela o pedido dela; cortar a ligação cancela os pedidos entre os dois', async () => {
    const { env, A, B, cAB } = await base();
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    assert.equal((await resp(pedir(env, A, '/api/houses/H1', 'DELETE'))).status, 200);
    assert.equal((await env.DB.prepare('SELECT status FROM house_transfers WHERE lote = ?').bind(lote).first()).status, 'cancelled');
    assert.deepEqual((await estado(env, B)).transfers.incoming, []);
    await pedirT(env, A, { houseIds: ['H2'], toUserId: B.id });
    assert.equal((await resp(pedir(env, B, '/api/connections/' + cAB, 'DELETE'))).status, 200);
    assert.equal((await env.DB.prepare("SELECT status FROM house_transfers WHERE house_id = 'H2'").first()).status, 'cancelled');
    assert.deepEqual((await estado(env, A)).transfers.outgoing, []);
  });

  test('apagar a conta leva as transferências dela', async () => {
    const { env, A, B } = await base();
    await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    await purgeAccount(env, B.id);
    assert.equal((await linhas(env, 'SELECT * FROM house_transfers')).length, 0);
    assert.deepEqual((await estado(env, A)).transfers.outgoing, []);
  });
});
