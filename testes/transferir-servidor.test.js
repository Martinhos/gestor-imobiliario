// Passar o controlo de casas a um comproprietário — o servidor, contra o SQL
// a sério (testes/lib/bd.js) com a migração 0021. Prova o pedido (só a quem
// já é comproprietário de todas as casas, pela ligação ou por um grupo; as
// recusas: não-criador, ligado mas não comproprietário, pendente repetido;
// ficar e shares ignorados), o cancelar e o recusar com os avisos, e o
// aceitar: só o criador muda, e os participantes, as quotas, o acesso de
// cada um, os grupos, os anexos e a proposta pendente ficam iguais em todos
// os caminhos (quem recebe por ligação, por grupo ou pelos dois; um terceiro
// por ligação a quem pediu, ligado ou não a quem recebe, ou por grupo; quem
// pediu sem caminho próprio); quem pediu fica comproprietário; os
// colaboradores de quem pediu passam para a equipa de quem recebe com o
// mesmo cargo (copiado ou reutilizado) e são avisados, e nas outras casas
// de quem pediu nada muda; o que o novo criador gere a seguir (as partilhas,
// os grupos); uma casa que deixou de valer falha só essa; uma escrita
// cruzada; o /api/state; e as limpezas (apagar a casa, cortar a ligação,
// sair da casa, apagar a conta).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import {
  ambiente, conta, pedir, resp, estado, casa, comproprietario, cargo, darCargo, desligar,
} from './lib/api.js';
import { acessoACasa, participantsOf, purgeAccount, casaMudou } from '../worker/src/lib/acesso.js';
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

// Recebe: env; de — quem pede; para — quem recebe; casas — os ids.
// Devolve: a promessa da resposta do aceitar (o pedido tem de passar).
async function passar(env, de, para, casas) {
  const p = await pedirT(env, de, { houseIds: casas, toUserId: para.id });
  assert.equal(p.status, 200, JSON.stringify(p));
  return aceitarT(env, para, p.lote);
}

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

// Recebe: env; cid — a ligação; dono — quem partilha; hid — a casa.
// Devolve: a promessa do run.
const partilhar = (env, cid, dono, hid) =>
  env.DB.prepare('INSERT INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)').bind(cid, dono.id, hid).run();

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

/* O retrato de uma casa: os participantes (como conjunto) e o grau de cada
   pessoa, com o cargo e as permissões de um colaborador.
   Recebe: env; hid; pessoas — as contas a olhar.
   Devolve: a promessa de { parts, grau: { nome: texto } }. */
async function retrato(env, hid, pessoas) {
  const parts = ((await participantsOf(env, hid)) || []).slice().sort();
  const grau = {};
  for (const p of pessoas) {
    const a = await acessoACasa(env, p.id, hid);
    grau[p.name] = !a.ok ? 'nada' : a.owner ? 'dono' : a.coowner ? 'comproprietario'
      : 'colaborador ' + a.collab.roleName + ' ' + [...a.collab.perms].sort().join(',');
  }
  return { parts, grau };
}

/* O retrato esperado depois de passar o controlo: o mesmo, com o dono e o
   comproprietário trocados entre quem pediu e quem recebe.
   Recebe: r — o retrato de antes; A, B — as contas.
   Devolve: o retrato esperado. */
function trocado(r, A, B) {
  assert.equal(r.grau[A.name], 'dono');
  assert.equal(r.grau[B.name], 'comproprietario');
  return { parts: r.parts, grau: { ...r.grau, [A.name]: 'comproprietario', [B.name]: 'dono' } };
}

/* O cenário de base: Alice (A) cria H1 «T2 Benfica» e H2 «T1 Porto»; com
   ligado, está ligada ao Bruno (B) sem casas partilhadas.
   Recebe: ligado (true).
   Devolve: { env, A, B, cAB }. */
async function base(ligado = true) {
  const env = ambiente();
  const A = await conta(env, 'Alice');
  const B = await conta(env, 'Bruno');
  await casa(env, A, 'H1', { name: 'T2 Benfica' });
  await casa(env, A, 'H2', { name: 'T1 Porto' });
  const cAB = ligado ? await ligar(env, A, B) : null;
  return { env, A, B, cAB };
}

/* ------------------------------- pedir --------------------------------- */

describe('pedir para passar o controlo', () => {
  test('a um comproprietário pela ligação: a linha pendente, o aviso e o /api/state dos dois lados', async () => {
    const { env, A, B, cAB } = await base();
    await partilhar(env, cAB, A, 'H1');
    const r = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: true, shares: { H1: { [A.id]: 100 } } });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.ok, true);
    assert.ok(r.lote);
    const rows = await linhas(env, 'SELECT house_id, from_user, to_user, ficar, shares, status FROM house_transfers');
    assert.deepEqual(rows, [{ house_id: 'H1', from_user: A.id, to_user: B.id, ficar: 0, shares: null, status: 'pending' }],
      'ficar e shares ignorados');
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
    assert.equal(sa.transfers.outgoing[0].ficar, false);
    assert.equal(sa.transfers.outgoing[0].shares, null);
  });

  test('a um comproprietário só por um grupo, sem ligação: passa; várias casas, um lote', async () => {
    const { env, A, B } = await base(false);
    await grupo(env, 'G1', A, [B], [['H1', A], ['H2', A]]);
    const r = await pedirT(env, A, { houseIds: ['H1', 'H2'], toUserId: B.id });
    assert.equal(r.status, 200, JSON.stringify(r));
    const rows = await linhas(env, 'SELECT lote, house_id FROM house_transfers ORDER BY house_id');
    assert.deepEqual(rows.map((x) => x.house_id), ['H1', 'H2']);
    assert.ok(rows.every((x) => x.lote === r.lote));
    assert.deepEqual((await estado(env, A)).transfers.outgoing[0].houses.map((h) => h.name), ['T2 Benfica', 'T1 Porto']);
  });

  test('só a um comproprietário: ligado sem a casa, estranho, eu próprio, ou comproprietário só de algumas → 400', async () => {
    const { env, A, B, cAB } = await base();
    const X = await conta(env, 'Estranho');
    const frase = { status: 400, error: 'Só podes passar o imóvel a um comproprietário dele.' };
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id }), frase, 'ligado mas sem a casa');
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1'], toUserId: X.id }), frase);
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1'], toUserId: A.id }), frase);
    await partilhar(env, cAB, A, 'H1');
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1', 'H2'], toUserId: B.id }), frase, 'tem de ser de todas');
    assert.equal((await linhas(env, 'SELECT * FROM house_transfers')).length, 0, 'nada fica escrito');
    assert.equal((await pedirT(env, A, { houseIds: [], toUserId: B.id })).status, 400, 'sem casas é corpo inválido');
    assert.equal((await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id, ficar: 'sim' })).status, 200, 'ficar ignora-se');
  });

  test('só o criador: o comproprietário leva 403, quem não vê a casa e a casa que não existe levam 404', async () => {
    const { env, A, B, cAB } = await base();
    const C = await conta(env, 'Carla');
    await comproprietario(env, A, C, ['H1']);
    await partilhar(env, cAB, A, 'H1');
    assert.deepEqual(await pedirT(env, C, { houseIds: ['H1'], toUserId: B.id }),
      { status: 403, error: 'Só quem criou o imóvel o pode transferir.' });
    assert.deepEqual(await pedirT(env, B, { houseIds: ['H2'], toUserId: A.id }), { status: 404, error: 'Casa não encontrada.' });
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H1', 'NAO'], toUserId: B.id }), { status: 404, error: 'Casa não encontrada.' });
    assert.equal((await linhas(env, 'SELECT * FROM house_transfers')).length, 0);
  });

  test('uma casa com pedido pendente → 409, e o lote inteiro não entra', async () => {
    const { env, A, B, cAB } = await base();
    const C = await conta(env, 'Carla');
    await partilhar(env, cAB, A, 'H1');
    await comproprietario(env, A, C, ['H1', 'H2']);
    assert.equal((await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id })).status, 200);
    assert.deepEqual(await pedirT(env, A, { houseIds: ['H2', 'H1'], toUserId: C.id }),
      { status: 409, error: 'Este imóvel já tem uma transferência pendente.' });
    assert.equal((await linhas(env, "SELECT * FROM house_transfers WHERE house_id = 'H2'")).length, 0);
    assert.throws(() => env.DB._db.prepare(
      "INSERT INTO house_transfers (id, lote, house_id, from_user, to_user, created_at) VALUES ('x', 'l', 'H1', 'a', 'b', 1)").run(), /UNIQUE/);
  });
});

/* -------------------------- cancelar e recusar -------------------------- */

describe('cancelar e recusar', () => {
  test('quem pediu cancela: as casas ficam canceladas, quem recebia é avisado, e nada mudou', async () => {
    const { env, A, B } = await base(false);
    await grupo(env, 'G1', A, [B], [['H1', A], ['H2', A]]);
    const { lote } = await pedirT(env, A, { houseIds: ['H1', 'H2'], toUserId: B.id });
    assert.deepEqual(await cancelarT(env, B, lote), { status: 404, error: 'Esta transferência já não está pendente.' }, 'quem recebe não cancela');
    assert.deepEqual(await cancelarT(env, A, lote), { status: 200, ok: true });
    assert.deepEqual((await linhas(env, 'SELECT status FROM house_transfers')).map((x) => x.status), ['cancelled', 'cancelled']);
    assert.deepEqual((await avisosDe(env, B)).filter((a) => a[0] === 'transf.cancelada').map((a) => a[1]).sort(), ['H1', 'H2']);
    assert.equal((await cancelarT(env, A, lote)).status, 404, 'cancelar outra vez');
    assert.equal((await aceitarT(env, B, lote)).status, 404, 'e já não se aceita');
    assert.deepEqual((await estado(env, B)).transfers, { incoming: [], outgoing: [] });
    assert.equal((await daBase(env, 'H1')).owner, A.id);
  });

  test('quem recebe recusa: quem pediu é avisado; um terceiro e quem pediu não recusam', async () => {
    const { env, A, B, cAB } = await base();
    const X = await conta(env, 'Estranho');
    await partilhar(env, cAB, A, 'H1');
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    assert.equal((await recusarT(env, A, lote)).status, 404);
    assert.equal((await recusarT(env, X, lote)).status, 404);
    assert.deepEqual(await recusarT(env, B, lote), { status: 200, ok: true });
    assert.equal((await env.DB.prepare('SELECT status FROM house_transfers').first()).status, 'rejected');
    assert.deepEqual(await avisosDe(env, A), [['transf.recusada', 'H1', B.id]]);
    assert.throws(() => env.DB._db.prepare("UPDATE house_transfers SET status = 'accepted'").run(), /transf-decidida/);
    assert.equal((await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id })).status, 200, 'pode haver um pedido novo');
  });
});

/* --------------------- aceitar: só o criador muda ----------------------- */

describe('aceitar muda só o criador', () => {
  test('B pela ligação, C pela ligação à Alice, D por grupo, Rui colaborador: tudo igual, menos o dono', async () => {
    const { env, A, B, cAB } = await base();
    const C = await conta(env, 'Carla');
    const D = await conta(env, 'Duarte');
    const R = await conta(env, 'Rui');
    await partilhar(env, cAB, A, 'H1');
    const cAC = await comproprietario(env, A, C, ['H1']);
    await grupo(env, 'G1', D, [A], [['H1', A]]);
    await cargo(env, A, 'Contabilista', ['tx.add', 'rec.view'], 'R_A');
    await darCargo(env, A, R, 'R_A', ['H1']);
    await quotas(env, 'H1', { [A.id]: 40, [B.id]: 30, [C.id]: 20, [D.id]: 10 });
    const antes = await retrato(env, 'H1', [A, B, C, D, R]);
    assert.equal(antes.grau.Rui.startsWith('colaborador Contabilista'), true);
    const dadosAntes = (await daBase(env, 'H1')).data;

    assert.deepEqual(await passar(env, A, B, ['H1']), { status: 200, ok: true, aceites: ['H1'], falhadas: [] });
    assert.equal((await daBase(env, 'H1')).owner, B.id);
    assert.deepEqual(await retrato(env, 'H1', [A, B, C, D, R]), trocado(antes, A, B));
    assert.deepEqual((await daBase(env, 'H1')).data, dadosAntes, 'quotas, ownerIds e o resto do JSON iguais');
    // a partilha da ligação A–B passou a ser do Bruno (dá a casa à Alice); a da Carla fica onde estava
    assert.deepEqual(await linhas(env, "SELECT connection_id, owner_id FROM shares WHERE house_id = 'H1' ORDER BY connection_id"),
      [{ connection_id: cAB, owner_id: B.id }, { connection_id: cAC, owner_id: A.id }].sort((x, y) => x.connection_id.localeCompare(y.connection_id)));
    assert.equal((await env.DB.prepare('SELECT status FROM house_transfers').first()).status, 'accepted');
    // avisos: aceite a quem pediu, o dono novo aos outros participantes e ao colaborador
    assert.deepEqual(await avisosDe(env, A), [['transf.aceite', 'H1', B.id]]);
    assert.deepEqual(await avisosDe(env, C), [['casa.novo_dono', 'H1', B.id]]);
    assert.deepEqual(await avisosDe(env, D), [['casa.novo_dono', 'H1', B.id]]);
    assert.deepEqual(await avisosDe(env, R), [['colab.novo_dono', 'H1', B.id]]);
    assert.deepEqual((await avisosDe(env, B)).map((a) => a[0]), ['transf.pedido']);
  });

  test('B só por grupo e sem ligação à Alice: a Alice continua pelo grupo', async () => {
    const { env, A, B } = await base(false);
    const C = await conta(env, 'Carla');
    await comproprietario(env, A, C, ['H1']);
    await grupo(env, 'G1', A, [B], [['H1', A]]);
    const antes = await retrato(env, 'H1', [A, B, C]);
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    assert.deepEqual(await retrato(env, 'H1', [A, B, C]), trocado(antes, A, B));
    assert.deepEqual(await linhas(env, "SELECT group_id, added_by FROM shared_group_houses WHERE house_id = 'H1'"),
      [{ group_id: 'G1', added_by: B.id }]);
  });

  test('B pela ligação e pelo grupo: a Alice fica pelos dois caminhos', async () => {
    const { env, A, B, cAB } = await base();
    await partilhar(env, cAB, A, 'H1');
    await grupo(env, 'G1', A, [B], [['H1', A]]);
    const antes = await retrato(env, 'H1', [A, B]);
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    assert.deepEqual(await retrato(env, 'H1', [A, B]), trocado(antes, A, B));
    assert.deepEqual(await linhas(env, "SELECT owner_id FROM shares WHERE house_id = 'H1'"), [{ owner_id: B.id }]);
    // sem o grupo, a partilha chega: a Alice continua
    await env.DB.prepare('DELETE FROM shared_group_houses').run();
    assert.ok((await acessoACasa(env, A.id, 'H1')).coowner);
  });

  test('C ligado aos dois: a partilha dele muda-se para a ligação B–C, e o Bruno passa a geri-la', async () => {
    const { env, A, B, cAB } = await base();
    const C = await conta(env, 'Carla');
    await partilhar(env, cAB, A, 'H1');
    const cAC = await comproprietario(env, A, C, ['H1']);
    const cBC = await ligar(env, B, C);
    const antes = await retrato(env, 'H1', [A, B, C]);
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    assert.deepEqual(await retrato(env, 'H1', [A, B, C]), trocado(antes, A, B));
    assert.deepEqual(await linhas(env, 'SELECT connection_id, owner_id FROM shares WHERE house_id = ? AND connection_id IN (?, ?)', 'H1', cAC, cBC),
      [{ connection_id: cBC, owner_id: B.id }]);
    const kb = (await estado(env, B)).connections.find((c) => c.id === cBC);
    assert.deepEqual(kb.myShares, ['H1']);
    // o Bruno deixa de a partilhar com a Carla: ela sai, e mais ninguém
    assert.equal((await resp(pedir(env, B, '/api/connections/' + cBC + '/shares', 'PUT', { houseIds: [] }))).status, 200);
    assert.equal((await acessoACasa(env, C.id, 'H1')).ok, false);
    assert.ok((await acessoACasa(env, A.id, 'H1')).coowner);
  });

  test('C só ligado à Alice: a partilha herdada fica e o PUT das partilhas dela já não a apaga', async () => {
    const { env, A, B, cAB } = await base();
    const C = await conta(env, 'Carla');
    await partilhar(env, cAB, A, 'H1');
    const cAC = await comproprietario(env, A, C, ['H1', 'H2']);
    const antes = await retrato(env, 'H1', [A, B, C]);
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    assert.deepEqual(await retrato(env, 'H1', [A, B, C]), trocado(antes, A, B));
    const ka = (await estado(env, A)).connections.find((c) => c.id === cAC);
    assert.deepEqual(ka.myShares, ['H2'], 'a herdada não vem nas minhas partilhas');
    const kc = (await estado(env, C)).connections.find((c) => c.id === cAC);
    assert.deepEqual(kc.peerShares.slice().sort(), ['H1', 'H2']);
    // a Alice regrava as partilhas com a Carla só com as casas dela (como o cliente faz)
    assert.equal((await resp(pedir(env, A, '/api/connections/' + cAC + '/shares', 'PUT', { houseIds: [] }))).status, 200);
    assert.equal((await acessoACasa(env, C.id, 'H2')).ok, false, 'a H2 deixou de estar partilhada');
    assert.ok((await acessoACasa(env, C.id, 'H1')).coowner, 'a H1, do Bruno, continua');
    // e a Alice a sair da H1 não a tira à Carla
    assert.equal((await resp(pedir(env, A, '/api/houses/H1/participacao', 'DELETE'))).status, 200);
    assert.equal((await acessoACasa(env, A.id, 'H1')).ok, false);
    assert.ok((await acessoACasa(env, C.id, 'H1')).coowner);
  });

  test('passar duas vezes: quem pediu sem caminho próprio ganha a partilha na ligação a quem recebe', async () => {
    const env = ambiente();
    const X = await conta(env, 'Xavier');
    const A = await conta(env, 'Alice');
    const B = await conta(env, 'Bruno');
    await casa(env, X, 'H', { name: 'Loja' });
    await grupo(env, 'G1', X, [B], [['H', X]]);
    await comproprietario(env, X, A, ['H']);
    const r0 = await retrato(env, 'H', [X, A, B]);
    // o Xavier passa à Alice (comproprietária pela ligação)
    assert.deepEqual((await passar(env, X, A, ['H'])).aceites, ['H']);
    const r1 = await retrato(env, 'H', [X, A, B]);
    assert.deepEqual(r1, trocado(r0, X, A));
    // a Alice não é do grupo e não tem partilha que lhe dê a casa: ao passar ao Bruno, ganha uma na ligação aos dois
    const cAB = await ligar(env, A, B);
    assert.deepEqual((await passar(env, A, B, ['H'])).aceites, ['H']);
    assert.deepEqual(await retrato(env, 'H', [X, A, B]), trocado(r1, A, B));
    assert.deepEqual(await linhas(env, "SELECT owner_id FROM shares WHERE house_id = 'H' AND connection_id = ?", cAB), [{ owner_id: B.id }]);
  });

  test('os grupos ficam com a casa e os mesmos membros; quem pediu já não a leva ao regravar nem ao sair', async () => {
    const { env, A, B, cAB } = await base();
    const D = await conta(env, 'Duarte');
    const F = await conta(env, 'Filipa');
    await partilhar(env, cAB, A, 'H1');
    await grupo(env, 'G1', A, [B, D], [['H1', A]]);
    await grupo(env, 'G2', D, [A, F], [['H1', A], ['H2', A]]);
    const antes = await retrato(env, 'H1', [A, B, D, F]);
    const gAntes = (await listarGrupos(env, F.id)).map((g) => [g.id, g.houses.map((h) => h.id)]);
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    assert.deepEqual(await retrato(env, 'H1', [A, B, D, F]), trocado(antes, A, B));
    assert.deepEqual((await listarGrupos(env, F.id)).map((g) => [g.id, g.houses.map((h) => h.id)]), gAntes);
    const g2 = (await listarGrupos(env, F.id)).find((g) => g.id === 'G2');
    assert.deepEqual(g2.houses.map((h) => [h.id, h.ownerId]), [['H1', B.id], ['H2', A.id]]);
    assert.deepEqual(await linhas(env, "SELECT group_id, added_by FROM shared_group_houses WHERE house_id = 'H1' ORDER BY group_id"),
      [{ group_id: 'G1', added_by: B.id }, { group_id: 'G2', added_by: B.id }]);
    // a Alice regrava o conjunto dela no G1 sem a casa, e sai do G2: a H1 fica nos dois
    assert.equal((await resp(pedir(env, A, '/api/shared-groups/G1/houses', 'PUT', { houseIds: [] }))).status, 200);
    assert.equal((await resp(pedir(env, A, '/api/shared-groups/G2/members/' + A.id, 'DELETE'))).status, 200);
    assert.ok((await acessoACasa(env, F.id, 'H1')).coowner, 'a Filipa continua pelo G2');
    assert.ok(!(await listarGrupos(env, F.id)).find((g) => g.id === 'G2').houses.some((h) => h.id === 'H2'), 'a H2 da Alice saiu com ela');
    // o Bruno, criador e membro do G1, regrava o conjunto dele com a casa
    assert.equal((await resp(pedir(env, B, '/api/shared-groups/G1/houses', 'PUT', { houseIds: ['H1'] }))).status, 200);
    // no G2, de que não é membro, não lhe mexe (as rotas do grupo são dos membros); o dono do grupo remove-a
    assert.equal((await resp(pedir(env, B, '/api/shared-groups/G2/houses/H1', 'DELETE'))).status, 404);
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G2/houses/H1', 'DELETE'))).status, 200);
  });

  test('os anexos e a proposta de quotas pendente ficam como estão', async () => {
    const { env, A, B, cAB } = await base();
    const C = await conta(env, 'Carla');
    await partilhar(env, cAB, A, 'H1');
    await comproprietario(env, A, C, ['H1']);
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/proposal', 'POST',
      { shares: { [A.id]: 50, [B.id]: 30, [C.id]: 20 } }))).status, 201);
    for (const [id, dono, hid] of [['F1', A, 'H1'], ['F2', C, 'H1'], ['F3', A, 'H2']]) {
      await env.DB.prepare('INSERT INTO files (id, owner_id, house_id, name, type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, dono.id, hid, id, 'image/png', 10, 1).run();
    }
    const fAntes = await linhas(env, 'SELECT * FROM files ORDER BY id');
    const pAntes = await linhas(env, 'SELECT * FROM share_proposals');
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    assert.deepEqual(await linhas(env, 'SELECT * FROM files ORDER BY id'), fAntes);
    assert.deepEqual(await linhas(env, 'SELECT * FROM share_proposals'), pAntes);
    // e a proposta continua a aplicar-se: os participantes são os mesmos
    for (const q of [A, B]) assert.equal((await resp(pedir(env, q, '/api/houses/H1/proposal/accept', 'POST', {}))).status, 200);
    assert.deepEqual((await daBase(env, 'H1')).data.ownerShares, { [A.id]: 50, [B.id]: 30, [C.id]: 20 });
  });
});

/* ------------------------- aceitar: colaboradores ------------------------ */

describe('os colaboradores de quem pediu', () => {
  test('passam para a equipa de quem recebe com o mesmo cargo; nas outras casas da Alice nada muda', async () => {
    const { env, A, B, cAB } = await base();
    const R = await conta(env, 'Rui');
    const T = await conta(env, 'Tiago');
    const S = await conta(env, 'Sara');
    await partilhar(env, cAB, A, 'H1');
    await casa(env, B, 'H9', { name: 'Casa do Bruno' });
    await cargo(env, A, 'Contabilista', ['tx.add'], 'R_A');
    await darCargo(env, A, R, 'R_A', ['H1', 'H2']);
    await darCargo(env, A, T, 'R_A', ['H2']);
    await cargo(env, B, 'Gestor', ['tx.add', 'rec.add'], 'R_B');
    await darCargo(env, B, S, 'R_B', ['H9']);
    const antes1 = await retrato(env, 'H1', [A, B, R, T, S]);
    const antes2 = await retrato(env, 'H2', [A, B, R, T, S]);
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    assert.deepEqual(await retrato(env, 'H1', [A, B, R, T, S]), trocado(antes1, A, B));
    assert.deepEqual(await retrato(env, 'H2', [A, B, R, T, S]), antes2, 'a H2 da Alice fica igual');
    // o cargo copiou-se para o Bruno, com as mesmas permissões
    const cargosB = await linhas(env, "SELECT id, name, perms FROM roles WHERE owner_id = ? AND deleted = 0 ORDER BY name", B.id);
    const rA = await env.DB.prepare("SELECT perms FROM roles WHERE id = 'R_A'").first();
    assert.deepEqual(cargosB.map((r) => r.name), ['Contabilista', 'Gestor']);
    assert.deepEqual(JSON.parse(cargosB[0].perms), JSON.parse(rA.perms));
    assert.notEqual(cargosB[0].id, 'R_A');
    // o Rui tem uma linha do Bruno com a H1 e a da Alice só com a H2
    const linhasR = await linhas(env, `SELECT c.owner_id, ch.house_id FROM collaborators c JOIN collaborator_houses ch ON ch.collaborator_id = c.id
      WHERE c.user_id = ? ORDER BY ch.house_id`, R.id);
    assert.deepEqual(linhasR, [{ owner_id: B.id, house_id: 'H1' }, { owner_id: A.id, house_id: 'H2' }]);
    // os do Bruno e o /api/state dele
    const cb = (await estado(env, B)).houses.find((x) => x.id === 'H1');
    assert.deepEqual(cb.collaborators.map((x) => [x.userId, x.roleName]), [[R.id, 'Contabilista']]);
    assert.ok((await estado(env, B)).collaborators.some((x) => x.userId === R.id));
    assert.deepEqual(await avisosDe(env, R), [['colab.novo_dono', 'H1', B.id]]);
    assert.deepEqual(await avisosDe(env, T), []);
    assert.deepEqual(await avisosDe(env, S), []);
    const dr = (await estado(env, R)).departures[0];
    assert.equal(dr.kind, 'colab.novo_dono');
    assert.equal(dr.actorName, 'Bruno');
    assert.equal(dr.houseName, 'T2 Benfica');
    assert.ok((await estado(env, R)).houses.some((h) => h.id === 'H1'), 'o Rui continua a ver a H1');
  });

  test('um cargo do Bruno com o mesmo nome e as mesmas permissões reutiliza-se; o mesmo nome com outras não', async () => {
    const { env, A, B, cAB } = await base();
    const R = await conta(env, 'Rui');
    const T = await conta(env, 'Tiago');
    await partilhar(env, cAB, A, 'H1');
    await cargo(env, A, 'Contabilista', ['tx.add'], 'R_A1');
    await cargo(env, A, 'Gestor', ['tx.add'], 'R_A2');
    await darCargo(env, A, R, 'R_A1', ['H1']);
    await darCargo(env, A, T, 'R_A2', ['H1']);
    await cargo(env, B, 'Contabilista', ['tx.view', 'tx.add'], 'R_B1');  // as mesmas, na forma canónica
    await cargo(env, B, 'Gestor', ['rec.view'], 'R_B2');
    const antes = await retrato(env, 'H1', [A, B, R, T]);
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    assert.deepEqual(await retrato(env, 'H1', [A, B, R, T]), trocado(antes, A, B));
    assert.equal((await acessoACasa(env, R.id, 'H1')).collab.roleId, 'R_B1', 'reutilizado');
    const gt = (await acessoACasa(env, T.id, 'H1')).collab;
    assert.notEqual(gt.roleId, 'R_B2', 'o Gestor do Bruno tem outras permissões: o da Alice copia-se');
    assert.equal(gt.roleName, 'Gestor');
    assert.equal((await linhas(env, 'SELECT * FROM roles WHERE owner_id = ?', B.id)).length, 3);
  });

  test('quem recebe deixa de ser colaborador da Alice nessa casa; um participante com cargo não leva o aviso do colaborador', async () => {
    const { env, A, B, cAB } = await base();
    const C = await conta(env, 'Carla');
    await partilhar(env, cAB, A, 'H1');
    await comproprietario(env, A, C, ['H1']);
    await cargo(env, A, 'Contabilista', ['tx.add'], 'R_A');
    await darCargo(env, A, B, 'R_A', ['H1', 'H2']);
    await darCargo(env, A, C, 'R_A', ['H1']);
    const antes = await retrato(env, 'H1', [A, B, C]);
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    assert.deepEqual(await retrato(env, 'H1', [A, B, C]), trocado(antes, A, B));
    assert.equal((await linhas(env, 'SELECT * FROM collaborators WHERE owner_id = ? AND user_id = ?', B.id, B.id)).length, 0);
    assert.ok((await acessoACasa(env, B.id, 'H2')).collab, 'na H2 o Bruno continua colaborador da Alice');
    assert.deepEqual(await avisosDe(env, C), [['casa.novo_dono', 'H1', B.id]]);
  });
});

/* -------------------------- aceitar: o que falha -------------------------- */

describe('o que já não vale ao aceitar', () => {
  test('falha só a casa que deixou de valer: apagada, com outro dono, ou quem recebe já não é comproprietário', async () => {
    const { env, A, B, cAB } = await base();
    const C = await conta(env, 'Carla');
    await casa(env, A, 'H3', { name: 'Loja' });
    await casa(env, A, 'H4', { name: 'Garagem' });
    for (const h of ['H1', 'H2', 'H3', 'H4']) await partilhar(env, cAB, A, h);
    const { lote } = await pedirT(env, A, { houseIds: ['H1', 'H2', 'H3', 'H4'], toUserId: B.id });
    // por fora das rotas (que cancelariam o pedido)
    await env.DB.prepare("UPDATE houses SET deleted = 1 WHERE id = 'H2'").run();
    await env.DB.prepare('UPDATE houses SET owner_id = ? WHERE id = ?').bind(C.id, 'H3').run();
    await env.DB.prepare("DELETE FROM shares WHERE house_id = 'H4'").run();
    const r = await aceitarT(env, B, lote);
    assert.equal(r.status, 200);
    assert.deepEqual(r.aceites, ['H1']);
    assert.deepEqual(r.falhadas.sort((x, y) => x.houseId.localeCompare(y.houseId)), [
      { houseId: 'H2', error: 'Casa não encontrada.' },
      { houseId: 'H3', error: 'Quem pediu já não é o dono deste imóvel.' },
      { houseId: 'H4', error: 'Já não és comproprietário deste imóvel.' },
    ]);
    assert.equal((await daBase(env, 'H1')).owner, B.id);
    assert.equal((await daBase(env, 'H4')).owner, A.id);
    assert.deepEqual(await linhas(env, 'SELECT house_id, status FROM house_transfers ORDER BY house_id'), [
      { house_id: 'H1', status: 'accepted' }, { house_id: 'H2', status: 'cancelled' },
      { house_id: 'H3', status: 'cancelled' }, { house_id: 'H4', status: 'cancelled' },
    ]);
  });

  test('uma gravação da ficha a meio do aceitar não se perde nem desfaz a passagem', async () => {
    const { env, A, B, cAB } = await base();
    await partilhar(env, cAB, A, 'H1');
    await quotas(env, 'H1', { [A.id]: 60, [B.id]: 40 });
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
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

  test('sem Imóveis, quem recebe não aceita nem pede (403); recusar passa', async () => {
    const { env, A, B, cAB } = await base();
    await partilhar(env, cAB, A, 'H1');
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    await desligar(env, B, 'properties');
    assert.equal((await aceitarT(env, B, lote)).status, 403);
    assert.equal((await pedirT(env, B, { houseIds: ['H9'], toUserId: A.id })).status, 403);
    assert.equal((await recusarT(env, B, lote)).status, 200);
  });
});

/* ------------------------------ o estado --------------------------------- */

describe('o /api/state depois de aceitar', () => {
  test('a casa é do Bruno, a Alice vê-a como comproprietária com os mesmos participantes, e o Bruno gere a partilha com ela', async () => {
    const { env, A, B, cAB } = await base();
    const C = await conta(env, 'Carla');
    await partilhar(env, cAB, A, 'H1');
    await comproprietario(env, A, C, ['H1']);
    const pAntes = (await estado(env, A)).houses.find((x) => x.id === 'H1').participants.slice().sort();
    assert.deepEqual((await passar(env, A, B, ['H1'])).aceites, ['H1']);
    const sb = await estado(env, B);
    const cb = sb.houses.find((x) => x.id === 'H1');
    assert.equal(cb.mine, true);
    assert.equal(cb.ownerId, B.id);
    assert.deepEqual(cb.participants.slice().sort(), pAntes);
    assert.deepEqual(sb.transfers, { incoming: [], outgoing: [] });
    const sa = await estado(env, A);
    const ca = sa.houses.find((x) => x.id === 'H1');
    assert.equal(ca.mine, false);
    assert.deepEqual(ca.participants.slice().sort(), pAntes);
    const da = sa.departures.find((x) => x.kind === 'transf.aceite');
    assert.equal(da.actorId, B.id);
    assert.equal(da.houseName, 'T2 Benfica');
    // a partilha na ligação A–B é agora do Bruno: está nas dele, e ele pode retirá-la
    assert.deepEqual(sb.connections.find((c) => c.id === cAB).myShares, ['H1']);
    assert.deepEqual(sa.connections.find((c) => c.id === cAB).peerShares, ['H1']);
    assert.equal((await resp(pedir(env, B, '/api/connections/' + cAB + '/shares', 'PUT', { houseIds: [] }))).status, 200);
    assert.equal((await acessoACasa(env, A.id, 'H1')).ok, false);
  });
});

/* ------------------------------ limpezas -------------------------------- */

describe('o que leva os pedidos pendentes', () => {
  test('apagar a casa cancela o pedido dela', async () => {
    const { env, A, B, cAB } = await base();
    await partilhar(env, cAB, A, 'H1');
    const { lote } = await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    assert.equal((await resp(pedir(env, A, '/api/houses/H1', 'DELETE'))).status, 200);
    assert.equal((await env.DB.prepare('SELECT status FROM house_transfers WHERE lote = ?').bind(lote).first()).status, 'cancelled');
    assert.deepEqual((await estado(env, B)).transfers.incoming, []);
  });

  test('cortar a ligação só cancela se quem recebe deixa de ser comproprietário', async () => {
    const { env, A, B, cAB } = await base();
    await partilhar(env, cAB, A, 'H1');
    await partilhar(env, cAB, A, 'H2');
    await grupo(env, 'G1', A, [B], [['H2', A]]);
    await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    await pedirT(env, A, { houseIds: ['H2'], toUserId: B.id });
    assert.equal((await resp(pedir(env, B, '/api/connections/' + cAB, 'DELETE'))).status, 200);
    assert.deepEqual(await linhas(env, 'SELECT house_id, status FROM house_transfers ORDER BY house_id'), [
      { house_id: 'H1', status: 'cancelled' }, { house_id: 'H2', status: 'pending' },
    ], 'a H2 continua a chegar ao Bruno pelo grupo');
    assert.deepEqual((await estado(env, A)).transfers.outgoing.map((l) => l.houses.map((h) => h.id)), [['H2']]);
  });

  test('quem recebe sair da casa cancela o pedido dela', async () => {
    const { env, A, B, cAB } = await base();
    await partilhar(env, cAB, A, 'H1');
    await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    assert.equal((await resp(pedir(env, B, '/api/houses/H1/participacao', 'DELETE'))).status, 200);
    assert.equal((await env.DB.prepare('SELECT status FROM house_transfers').first()).status, 'cancelled');
    assert.deepEqual((await estado(env, A)).transfers.outgoing, []);
  });

  test('apagar a conta leva os pedidos dela', async () => {
    const { env, A, B, cAB } = await base();
    await partilhar(env, cAB, A, 'H1');
    await pedirT(env, A, { houseIds: ['H1'], toUserId: B.id });
    await purgeAccount(env, B.id);
    assert.equal((await linhas(env, 'SELECT * FROM house_transfers')).length, 0);
    assert.deepEqual((await estado(env, A)).transfers.outgoing, []);
  });
});
