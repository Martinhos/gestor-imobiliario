// Sair de um imóvel que não criei — o servidor, contra o SQL a sério
// (testes/lib/bd.js) com a migração 0019. Prova o DELETE
// /api/houses/:id/participacao do colaborador (sai só dessa casa) e do
// comproprietário (sai por todos os caminhos — ligação e grupos — e a quota
// dele vai para os que ficam, na proporção), a função pura das quotas, as
// saídas por grupo respeitadas no acesso, no /api/state e na lista dos
// grupos, e desfeitas quando o criador volta a partilhar; os avisos
// (house_events) só a quem devem, o departures do /api/state, o «Deixar de
// colaborar» a avisar o dono por casa, e a limpeza ao apagar a casa e a conta.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import {
  ambiente, conta, pedir, resp, estado, casa, comproprietario, cargo, darCargo, desligar, fotografia, auditoria,
} from './lib/api.js';
import { acessoACasa, participantsOf, redistribuirQuotas, apagarCasa, purgeAccount } from '../worker/src/lib/acesso.js';
import { listarGrupos } from '../worker/src/rotas/grupos.js';

/* ------------------------------ armações ------------------------------- */

const FRASE_CRIADOR = 'Criaste este imóvel: para o tirar da tua lista, apaga-o.';
const FRASE_CASA = 'Casa não encontrada.';

// Recebe: env; quem — a conta; hid — a casa.
// Devolve: a promessa de {status, ...} do DELETE /api/houses/:id/participacao.
const sair = (env, quem, hid) => resp(pedir(env, quem, '/api/houses/' + hid + '/participacao', 'DELETE'));

// Recebe: env; sql — uma consulta; args — os parâmetros.
// Devolve: a promessa das linhas, em objetos simples (para o deepEqual).
const linhas = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results.map((r) => ({ ...r }));

// Recebe: env; hid — a casa.
// Devolve: a promessa do JSON da casa como está na base.
const dadosDa = async (env, hid) => JSON.parse((await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(hid).first()).data);

// Recebe: env; hid — a casa; quotas — o ownerShares a guardar.
// Devolve: a promessa do run (as quotas vão direto: o caminho delas é o das propostas).
async function quotas(env, hid, q) {
  const d = await dadosDa(env, hid);
  d.ownerShares = q;
  d.ownerIds = Object.keys(q);
  await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?').bind(JSON.stringify(d), hid).run();
}

/* Um grupo partilhado escrito direto na base: o dono e os membros, e as
   casas, cada uma posta pelo seu dono.
   Recebe: env; gid; dono — a conta; membros — as outras contas; casas —
   [[houseId, conta que a pôs]].
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

// Recebe: env; quem — a conta.
// Devolve: a promessa dos ids das casas que o /api/state lhe manda.
const casasDe = async (env, quem) => (await estado(env, quem)).houses.map((h) => h.id).sort();

// Recebe: env; quem — o destinatário.
// Devolve: a promessa dos avisos dele na base, [kind, house_id, actor_id].
const avisosDe = async (env, quem) => (await linhas(env,
  'SELECT kind, house_id, actor_id FROM house_events WHERE user_id = ? ORDER BY created_at, house_id', quem.id))
  .map((e) => [e.kind, e.house_id, e.actor_id]);

/* O cenário do colaborador: A (Alice) cria H1 «T2 Benfica» e H2 «T1 Porto»
   e dá ao R (Rui) um cargo nas duas, pelo convite a sério. */
async function comColaborador() {
  const env = ambiente();
  const A = await conta(env, 'Alice');
  const R = await conta(env, 'Rui');
  const X = await conta(env, 'Estranho');
  await casa(env, A, 'H1', { name: 'T2 Benfica' });
  await casa(env, A, 'H2', { name: 'T1 Porto' });
  await cargo(env, A, 'Contabilista', ['tx.add'], 'R_TX');
  await darCargo(env, A, R, 'R_TX', ['H1', 'H2']);
  return { env, A, R, X };
}

/* O cenário dos comproprietários: A cria H1 e partilha-a com B e C por
   ligação, com as quotas 50/30/20 (B tem os 30). */
async function comComproprietarios() {
  const env = ambiente();
  const A = await conta(env, 'Alice');
  const B = await conta(env, 'Bruno');
  const C = await conta(env, 'Carla');
  await casa(env, A, 'H1', { name: 'T2 Benfica' });
  await comproprietario(env, A, B, ['H1']);
  await comproprietario(env, A, C, ['H1']);
  await quotas(env, 'H1', { [A.id]: 50, [B.id]: 30, [C.id]: 20 });
  return { env, A, B, C };
}

/* ------------------------------ as quotas ------------------------------ */

describe('redistribuirQuotas: a quota de quem sai vai para os que ficam, na proporção', () => {
  test('50/30/20 e sai o dos 30 → 71,43/28,57, a somar 100', () => {
    const r = redistribuirQuotas({ a: 50, b: 30, c: 20 }, 'b', ['a', 'c']);
    assert.deepEqual(r, { a: 71.43, c: 28.57 });
    assert.equal(Math.round((r.a + r.c) * 100), 10000);
  });

  test('{60, 40} e sai o dos 60 → {100}; sem quotas, ou os que ficam a somar 0 → null', () => {
    assert.deepEqual(redistribuirQuotas({ a: 40, b: 60 }, 'b', ['a']), { a: 100 });
    assert.equal(redistribuirQuotas(undefined, 'b', ['a']), null);
    assert.equal(redistribuirQuotas(null, 'b', ['a']), null);
    assert.equal(redistribuirQuotas({ a: 0, b: 100 }, 'b', ['a']), null);
    assert.equal(redistribuirQuotas('estragado', 'b', ['a']), null);
  });

  test('o resto do arredondamento vai para a maior; só contam os que ficam e têm valor', () => {
    // 4 × 25, sai um: 33,33 + 33,33 + 33,33 = 99,99 — o cêntimo que falta vai para uma só
    const r = redistribuirQuotas({ a: 25, b: 25, c: 25, d: 25 }, 'd', ['a', 'b', 'c']);
    const soma = Object.values(r).reduce((n, v) => n + Math.round(v * 100), 0);
    assert.equal(soma, 10000);
    assert.deepEqual(Object.values(r).sort(), [33.33, 33.33, 33.34]);
    // quem já não é participante (z) e quem não tem valor (c) não entram
    assert.deepEqual(redistribuirQuotas({ a: 30, b: 50, z: 20, c: null }, 'b', ['a', 'c']), { a: 100 });
    assert.deepEqual(redistribuirQuotas({ a: 70, b: 10, c: 20 }, 'b', ['a', 'c']), { a: 77.78, c: 22.22 });
  });
});

/* ----------------------------- o colaborador ---------------------------- */

describe('o colaborador sai de uma casa e fica com as outras', () => {
  test('sai de H1: perde H1, fica com H2; o dono vê H1 sem colaboradores e H2 com ele', async () => {
    const { env, A, R } = await comColaborador();
    assert.deepEqual(await sair(env, R, 'H1'), { status: 200, ok: true, como: 'colaborador' });
    assert.equal((await acessoACasa(env, R.id, 'H1')).ok, false, 'sem acesso a H1');
    assert.ok((await acessoACasa(env, R.id, 'H2')).collab, 'H2 continua com o cargo');
    assert.deepEqual(await casasDe(env, R), ['H2']);
    const sa = await estado(env, A);
    assert.deepEqual(sa.houses.find((h) => h.id === 'H1').collaborators, [], 'do lado do dono, H1 já não é colaborada');
    assert.deepEqual(sa.houses.find((h) => h.id === 'H2').collaborators.map((c) => c.userId), [R.id]);
    assert.deepEqual(sa.collaborators.find((c) => c.userId === R.id).houses.map((h) => h.id), ['H2']);
    // não é participante de nada: nunca foi
    assert.deepEqual(await participantsOf(env, 'H1'), [A.id]);
  });

  test('a linha de colaborador que fica sem casas sai; o aviso vai só ao dono; a auditoria colab.sair', async () => {
    const { env, A, R, X } = await comColaborador();
    await sair(env, R, 'H1');
    assert.equal((await linhas(env, 'SELECT id FROM collaborators WHERE user_id = ?', R.id)).length, 1, 'ainda tem H2');
    await sair(env, R, 'H2');
    assert.deepEqual(await linhas(env, 'SELECT id FROM collaborators WHERE user_id = ?', R.id), [], 'a linha órfã saiu');
    assert.deepEqual(await casasDe(env, R), []);
    assert.deepEqual(await avisosDe(env, A), [['colab.sair', 'H1', R.id], ['colab.sair', 'H2', R.id]]);
    assert.deepEqual(await avisosDe(env, R), [], 'quem saiu não recebe nada');
    assert.deepEqual(await avisosDe(env, X), []);
    const nomes = await linhas(env, 'SELECT house_name, actor_name FROM house_events ORDER BY house_id');
    assert.deepEqual(nomes, [{ house_name: 'T2 Benfica', actor_name: 'Rui' }, { house_name: 'T1 Porto', actor_name: 'Rui' }]);
    const a = (await auditoria(env)).filter((l) => l.acao === 'colab.sair');
    assert.deepEqual(a.map((l) => [l.quem, l.alvo, l.detalhe]), [[R.id, A.id, 'H1'], [R.id, A.id, 'H2']]);
  });

  test('com os Colaboradores desligados nesta conta, o colaborador leva o 403 do serviço e nada muda', async () => {
    const { env, R } = await comColaborador();
    await desligar(env, R, 'colaboradores');
    const antes = await fotografia(env);
    const r = await sair(env, R, 'H1');
    assert.equal(r.status, 403);
    assert.equal(r.error, 'O serviço Colaboradores está desligado nesta conta.');
    assert.deepEqual(await fotografia(env), antes);
  });

  test('o «Deixar de colaborar» do próprio avisa o dono por casa, com os nomes de antes; o dono a remover não avisa', async () => {
    const { env, A, R } = await comColaborador();
    const cid = (await linhas(env, 'SELECT id FROM collaborators WHERE user_id = ?', R.id))[0].id;
    assert.equal((await resp(pedir(env, R, '/api/collaborators/' + cid, 'DELETE'))).status, 200);
    assert.deepEqual(await avisosDe(env, A), [['colab.sair', 'H1', R.id], ['colab.sair', 'H2', R.id]]);
    assert.deepEqual((await linhas(env, 'SELECT house_name FROM house_events ORDER BY house_id')).map((e) => e.house_name),
      ['T2 Benfica', 'T1 Porto']);
    // o dono a remover outro colaborador não se avisa a si mesmo
    const S = await conta(env, 'Sofia');
    await darCargo(env, A, S, 'R_TX', ['H1']);
    const sid = (await linhas(env, 'SELECT id FROM collaborators WHERE user_id = ?', S.id))[0].id;
    assert.equal((await resp(pedir(env, A, '/api/collaborators/' + sid, 'DELETE'))).status, 200);
    assert.equal((await avisosDe(env, A)).length, 2, 'nenhum aviso novo');
  });
});

/* -------------------------- o comproprietário --------------------------- */

describe('o comproprietário por ligação sai e a quota dele vai para os que ficam', () => {
  test('50/30/20, sai o Bruno → 71,43/28,57; ownerIds sem ele; a partilha dele saiu', async () => {
    const { env, A, B, C } = await comComproprietarios();
    const r = await sair(env, B, 'H1');
    assert.deepEqual(r, { status: 200, ok: true, como: 'comproprietario', ownerShares: { [A.id]: 71.43, [C.id]: 28.57 } });
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.ownerShares, { [A.id]: 71.43, [C.id]: 28.57 });
    assert.deepEqual(d.ownerIds, [A.id, C.id]);
    assert.equal(d.name, 'T2 Benfica', 'o resto da casa fica');
    assert.deepEqual(await participantsOf(env, 'H1'), [A.id, C.id]);
    assert.equal((await acessoACasa(env, B.id, 'H1')).ok, false);
    assert.deepEqual(await casasDe(env, B), []);
    const conn = (await estado(env, A)).connections.find((c) => c.peer.id === B.id);
    assert.deepEqual(conn.myShares, [], 'a ligação fica, sem a casa');
    assert.deepEqual((await estado(env, A)).houses[0].participants, [A.id, C.id]);
  });

  test('{60, 40}: sai o dos 60 → o outro fica com 100; sem quotas → ownerShares sai e a resposta diz null', async () => {
    const env = ambiente();
    const A = await conta(env, 'Alice');
    const B = await conta(env, 'Bruno');
    await casa(env, A, 'H1');
    await casa(env, A, 'H2');
    await comproprietario(env, A, B, ['H1', 'H2']);
    await quotas(env, 'H1', { [A.id]: 40, [B.id]: 60 });
    assert.deepEqual((await sair(env, B, 'H1')).ownerShares, { [A.id]: 100 });
    const r = await sair(env, B, 'H2');
    assert.equal(r.ownerShares, null);
    const d = await dadosDa(env, 'H2');
    assert.equal('ownerShares' in d, false, 'partes iguais');
    assert.deepEqual(d.ownerIds, [A.id]);
  });

  test('a proposta pendente da casa é apagada; o aviso casa.sair vai a todos os que ficam e nunca a quem saiu', async () => {
    const { env, A, B, C } = await comComproprietarios();
    assert.equal((await resp(pedir(env, A, '/api/houses/H1/proposal', 'POST', { shares: { [A.id]: 40, [B.id]: 40, [C.id]: 20 } }))).status, 201);
    await sair(env, B, 'H1');
    assert.deepEqual(await linhas(env, 'SELECT * FROM share_proposals'), []);
    assert.deepEqual(await avisosDe(env, A), [['casa.sair', 'H1', B.id]]);
    assert.deepEqual(await avisosDe(env, C), [['casa.sair', 'H1', B.id]]);
    assert.deepEqual(await avisosDe(env, B), []);
    const a = (await auditoria(env)).filter((l) => l.acao === 'casa.sair');
    assert.equal(a.length, 1);
    assert.deepEqual([a[0].quem, a[0].alvo], [B.id, 'H1']);
  });

  test('um comproprietário que também tinha um cargo na casa perde os dois', async () => {
    const env = ambiente();
    const A = await conta(env, 'Alice');
    const B = await conta(env, 'Bruno');
    await casa(env, A, 'H1');
    await casa(env, A, 'H2');
    await cargo(env, A, 'Contabilista', ['tx.add'], 'R_TX');
    await darCargo(env, A, B, 'R_TX', ['H1', 'H2']);
    await comproprietario(env, A, B, ['H1']);
    assert.equal((await acessoACasa(env, B.id, 'H1')).coowner, true);
    assert.equal((await sair(env, B, 'H1')).como, 'comproprietario');
    assert.equal((await acessoACasa(env, B.id, 'H1')).ok, false, 'a precedência não lhe devolve a casa como colaborador');
    assert.ok((await acessoACasa(env, B.id, 'H2')).collab, 'o cargo de H2 fica');
  });
});

describe('o comproprietário por grupo sai da casa e fica no grupo', () => {
  /* A cria H1 e H2 e um grupo G1 com as duas; B e C são membros. B tem H1
     também por ligação e por um segundo grupo G2 (de C, só com H1). */
  async function armar() {
    const env = ambiente();
    const A = await conta(env, 'Alice');
    const B = await conta(env, 'Bruno');
    const C = await conta(env, 'Carla');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await casa(env, A, 'H2', { name: 'T1 Porto' });
    await grupo(env, 'G1', A, [B, C], [['H1', A], ['H2', A]]);
    return { env, A, B, C };
  }

  test('sai de H1: continua no grupo e com H2; H1 não lhe chega pelo grupo; os outros continuam a vê-la', async () => {
    const { env, A, B, C } = await armar();
    const r = await sair(env, B, 'H1');
    assert.equal(r.status, 200);
    assert.equal(r.como, 'comproprietario');
    assert.deepEqual(await linhas(env, 'SELECT house_id, user_id FROM house_exits'), [{ house_id: 'H1', user_id: B.id }]);
    assert.equal((await linhas(env, 'SELECT 1 FROM shared_group_members WHERE group_id = ? AND user_id = ?', 'G1', B.id)).length, 1, 'fica no grupo');
    assert.equal((await acessoACasa(env, B.id, 'H1')).ok, false);
    assert.equal((await acessoACasa(env, B.id, 'H2')).coowner, true);
    assert.deepEqual(await casasDe(env, B), ['H2']);
    assert.deepEqual(await casasDe(env, C), ['H1', 'H2'], 'a Carla continua a ver H1');
    assert.deepEqual(await participantsOf(env, 'H1'), [A.id, C.id]);
    assert.deepEqual((await estado(env, C)).houses.find((h) => h.id === 'H1').participants, [A.id, C.id]);
    // a lista do grupo: o Bruno não vê H1 lá; a Carla e a Alice veem
    assert.deepEqual((await listarGrupos(env, B.id))[0].houses.map((h) => h.id), ['H2']);
    assert.deepEqual((await listarGrupos(env, C.id))[0].houses.map((h) => h.id), ['H1', 'H2']);
    assert.deepEqual((await estado(env, B)).sharedGroups[0].members.map((m) => m.id), [A.id, B.id, C.id]);
    assert.deepEqual(await avisosDe(env, A), [['casa.sair', 'H1', B.id]]);
    assert.deepEqual(await avisosDe(env, C), [['casa.sair', 'H1', B.id]]);
  });

  test('pela ligação e por dois grupos ao mesmo tempo: sair tira-o de todos os caminhos', async () => {
    const { env, A, B, C } = await armar();
    await comproprietario(env, A, B, ['H1']);
    await grupo(env, 'G2', C, [B], [['H1', A]]);
    await sair(env, B, 'H1');
    assert.equal((await acessoACasa(env, B.id, 'H1')).ok, false);
    assert.deepEqual(await casasDe(env, B), ['H2']);
    assert.deepEqual(await linhas(env, 'SELECT * FROM shares WHERE house_id = ?', 'H1'), []);
    for (const g of await listarGrupos(env, B.id)) assert.equal(g.houses.some((h) => h.id === 'H1'), false, g.id);
    assert.deepEqual(await participantsOf(env, 'H1'), [A.id, C.id]);
    // um segundo pedido já não acha nada
    assert.equal((await sair(env, B, 'H1')).status, 404);
  });

  test('voltar a pôr a casa no grupo desfaz a saída; regravar o mesmo conjunto não', async () => {
    const { env, A, B } = await armar();
    await sair(env, B, 'H1');
    // a Alice regrava o seu conjunto com H1 e H2 (já lá estavam): a saída fica
    assert.equal((await resp(pedir(env, A, '/api/shared-groups/G1/houses', 'PUT', { houseIds: ['H1', 'H2'] }))).status, 200);
    assert.equal((await acessoACasa(env, B.id, 'H1')).ok, false, 'a saída fica');
    // tira H1 e volta a pô-la: é partilhá-la de novo
    await resp(pedir(env, A, '/api/shared-groups/G1/houses', 'PUT', { houseIds: ['H2'] }));
    await resp(pedir(env, A, '/api/shared-groups/G1/houses', 'PUT', { houseIds: ['H2', 'H1'] }));
    assert.deepEqual(await linhas(env, 'SELECT * FROM house_exits'), []);
    assert.equal((await acessoACasa(env, B.id, 'H1')).coowner, true);
  });

  test('partilhar de novo pela ligação (PUT shares) desfaz a saída', async () => {
    const { env, A, B } = await armar();
    const cid = await comproprietario(env, A, B, []);
    await sair(env, B, 'H1');
    assert.equal((await resp(pedir(env, A, '/api/connections/' + cid + '/shares', 'PUT', { houseIds: ['H1'] }))).status, 200);
    assert.deepEqual(await linhas(env, 'SELECT * FROM house_exits'), []);
    assert.equal((await acessoACasa(env, B.id, 'H1')).coowner, true);
    assert.deepEqual(await casasDe(env, B), ['H1', 'H2']);
  });

  test('um pedido de partilha da casa aceite desfaz a saída de quem aceita', async () => {
    const { env, A, B } = await armar();
    await sair(env, B, 'H1');
    await env.DB.prepare(
      "INSERT INTO share_requests (id, from_user, to_user, house_id, status, created_at) VALUES ('P1', ?, ?, 'H1', 'pending', ?)"
    ).bind(A.id, B.id, Date.now()).run();
    assert.equal((await resp(pedir(env, B, '/api/share-requests/P1/accept', 'POST', {}))).status, 200);
    assert.deepEqual(await linhas(env, 'SELECT * FROM house_exits'), []);
    assert.equal((await acessoACasa(env, B.id, 'H1')).coowner, true);
  });
});

/* ------------------------------- recusas -------------------------------- */

describe('quem não pode sair', () => {
  test('o criador leva 400; um estranho, uma casa apagada ou que não existe, 404; um id mau, 400 — sem rasto', async () => {
    const { env, A, B } = await comComproprietarios();
    const X = await conta(env, 'Estranho');
    await casa(env, A, 'HAP', {}, 1);
    await comproprietario(env, A, X, ['HAP']);
    const antes = await fotografia(env);
    assert.deepEqual(await sair(env, A, 'H1'), { status: 400, error: FRASE_CRIADOR });
    assert.deepEqual(await sair(env, X, 'H1'), { status: 404, error: FRASE_CASA });
    assert.deepEqual(await sair(env, X, 'HAP'), { status: 404, error: FRASE_CASA });
    assert.deepEqual(await sair(env, B, 'NAO_HA'), { status: 404, error: FRASE_CASA });
    assert.equal((await sair(env, B, 'a b')).status, 400);
    assert.equal((await resp(pedir(env, null, '/api/houses/H1/participacao', 'DELETE'))).status, 401);
    assert.deepEqual(await fotografia(env), antes);
  });

  test('sem Imóveis nesta conta, o 403 das quotas e nada muda', async () => {
    const { env, B } = await comComproprietarios();
    await desligar(env, B, 'properties');
    const antes = await fotografia(env);
    const r = await sair(env, B, 'H1');
    assert.equal(r.status, 403);
    assert.equal(r.error, 'O serviço Imóveis está desligado nesta conta.');
    assert.deepEqual(await fotografia(env), antes);
  });
});

/* ----------------------------- departures ------------------------------- */

describe('o /api/state manda os avisos de quem saiu em departures', () => {
  test('os meus, com a forma do contrato, os mais recentes primeiro; nada a quem saiu', async () => {
    const { env, A, R } = await comColaborador();
    await sair(env, R, 'H1');
    await env.DB.prepare('UPDATE house_events SET created_at = created_at - 1000').run();
    await sair(env, R, 'H2');
    const d = (await estado(env, A)).departures;
    assert.equal(d.length, 2);
    assert.deepEqual(Object.keys(d[0]).sort(), ['actorId', 'actorName', 'at', 'houseId', 'houseName', 'id', 'kind']);
    assert.deepEqual(d.map((e) => [e.kind, e.houseId, e.houseName, e.actorId, e.actorName]),
      [['colab.sair', 'H2', 'T1 Porto', R.id, 'Rui'], ['colab.sair', 'H1', 'T2 Benfica', R.id, 'Rui']]);
    assert.ok(d[0].at >= d[1].at && typeof d[0].id === 'string');
    assert.deepEqual((await estado(env, R)).departures, []);
  });

  test('só os dos últimos 90 dias, até 50; os de colaborador somem com os Colaboradores desligados', async () => {
    const { env, A, B } = await comComproprietarios();
    await sair(env, B, 'H1');
    const t = Date.now();
    const ins = (id, kind, at) => env.DB.prepare(
      "INSERT INTO house_events (id, user_id, kind, house_id, house_name, actor_id, actor_name, created_at) VALUES (?, ?, ?, 'H1', 'T2', 'U9', 'Zé', ?)"
    ).bind(id, A.id, kind, at).run();
    await ins('velho', 'casa.sair', t - 91 * 86400000);
    await ins('colab', 'colab.sair', t - 5000);
    let d = (await estado(env, A)).departures;
    assert.deepEqual(d.map((e) => e.kind).sort(), ['casa.sair', 'colab.sair'], 'o de há 91 dias não vem');
    await desligar(env, A, 'colaboradores');
    d = (await estado(env, A)).departures;
    assert.deepEqual(d.map((e) => e.kind), ['casa.sair'], 'o colab.sair fica de fora');
    for (let i = 0; i < 60; i++) await ins('e' + String(i).padStart(2, '0'), 'casa.sair', t - 10000 - i);
    d = (await estado(env, A)).departures;
    assert.equal(d.length, 50);
    assert.ok(d.every((e, i) => i === 0 || d[i - 1].at >= e.at), 'por ordem, do mais recente');
  });
});

/* ------------------------------- limpeza -------------------------------- */

describe('apagar a casa e a conta limpam as saídas e os avisos', () => {
  test('apagarCasa leva as saídas da casa; purgeAccount as da conta e os avisos em que ela é destinatária ou quem saiu', async () => {
    const env = ambiente();
    const A = await conta(env, 'Alice');
    const B = await conta(env, 'Bruno');
    const C = await conta(env, 'Carla');
    await casa(env, A, 'H1');
    await casa(env, A, 'H2');
    await casa(env, C, 'HC');
    await grupo(env, 'G1', A, [B, C], [['H1', A], ['H2', A], ['HC', C]]);
    await sair(env, B, 'H1');
    await sair(env, B, 'H2');
    await sair(env, A, 'HC');
    await apagarCasa(env, 'H1', A.id);
    assert.deepEqual((await linhas(env, 'SELECT house_id, user_id FROM house_exits ORDER BY house_id')).map((x) => x.house_id), ['H2', 'HC']);
    await purgeAccount(env, B.id);
    assert.deepEqual((await linhas(env, 'SELECT house_id, user_id FROM house_exits')), [{ house_id: 'HC', user_id: A.id }]);
    assert.deepEqual((await linhas(env, 'SELECT actor_id FROM house_events')).map((e) => e.actor_id), [A.id], 'os avisos da saída do Bruno foram com ele');
    await purgeAccount(env, C.id);
    assert.deepEqual(await linhas(env, 'SELECT * FROM house_exits'), [], 'as da casa da Carla foram com ela');
    assert.deepEqual(await linhas(env, 'SELECT * FROM house_events'), [], 'e o aviso que a Carla recebeu');
  });
});
