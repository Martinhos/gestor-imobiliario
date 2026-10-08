// O servidor respeita os serviços desligados de uma conta (lib/servicos.js,
// tabela user_services): o GET /api/state diz quais são e não manda o que é
// deles; o /api/sync, as rotas das casas, dos colaboradores e das conexões
// recusam com 403 e a frase do serviço, sem deixar rasto na base. Cada
// recusa tem o controlo positivo ao lado: o mesmo pedido, com o serviço
// ligado, passa. Contra o SQL a sério (testes/lib/bd.js), com as armações
// de testes/lib/api.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import {
  ambiente, conta, pedir, resp, estado, sync, casa, registo, dadoGlobal, comproprietario, cargo, convidar, darCargo,
  desligar, ligarTudo, fotografia,
} from './lib/api.js';
import { FRASE_DESLIGADO } from '../worker/src/lib/servicos.js';
import { CARGOS_EXEMPLO } from '../worker/src/lib/permissoes.js';

/* ------------------------------ armações ------------------------------- */
// as de todos os testes do servidor vêm de testes/lib/api.js — a conta com
// sessão, o pedido à API, desligar (como o back office, com o fecho) e
// ligarTudo, e a fotografia das tabelas em que estas rotas escrevem: duas
// iguais provam que uma recusa não deixou rasto (nem linha nova, nem lápide,
// nem auditoria)

const kinds = (lista) => lista.map((r) => r.kind).sort();
const frase = FRASE_DESLIGADO;

/* O cenário: D é dono de H1 (partilhada com P, comproprietário) e de H2, com
   um registo de cada kind em H1 e dados globais de todos os kinds; C tem o
   cargo de contabilista em H1; D tem dois cargos, um convite por usar, a
   ligação de partilha ativa e um pedido de partilha pendente de X (dono de
   H3), que chegou por essa ligação. Tudo ligado — cada teste desliga o que
   quer. */
async function armar() {
  const env = ambiente();
  const D = await conta(env, 'Dono');
  const P = await conta(env, 'Parceiro');
  const C = await conta(env, 'Colab');
  const X = await conta(env, 'Xavier');
  await casa(env, D, 'H1', { name: 'T2 Lisboa' });
  await casa(env, D, 'H2', { name: 'T1 Porto' });
  await casa(env, X, 'H3', { name: 'T3 Faro' });
  await comproprietario(env, D, P, ['H1']);
  await registo(env, 'H1', 'contract', 'c1', { name: 'Contrato', tenantIds: ['t1'] }, D);
  await registo(env, 'H1', 'tenant', 't1', { name: 'Inês' }, D);
  await registo(env, 'H1', 'tx', 'x1', { label: 'Renda', amount: 500, paidBy: D.id }, D);
  await registo(env, 'H1', 'rec', 'r1', { label: 'Planeado' }, D);
  await registo(env, 'H1', 'visit', 'v1', { nomes: 'Zé' }, D);
  for (const [k, id] of [['profile', 'main'], ['settings', 'main'], ['tx', 'ux1'], ['rec', 'ur1'], ['tpl', 'tp1']]) {
    await dadoGlobal(env, D, k, id, { k });
  }
  const visitas = await cargo(env, D, 'Gestor de visitas', CARGOS_EXEMPLO[0].perms, 'R_VIS');
  const contab = await cargo(env, D, 'Contabilista', CARGOS_EXEMPLO[1].perms, 'R_CON');
  await darCargo(env, D, C, contab, ['H1']);
  const convite = await convidar(env, D, visitas, ['H2'], 'por usar');
  const ligacao = await resp(pedir(env, D, '/api/share-link', 'POST', {}));
  assert.equal(ligacao.status, 201, 'ligação criada: ' + JSON.stringify(ligacao));
  const tokenLig = ligacao.url.split('ligar=')[1];
  const pedido = await resp(pedir(env, X, '/api/ligar/' + tokenLig + '/pedir', 'POST', { houseIds: ['H3'] }));
  assert.equal(pedido.status, 200, 'pedido de partilha: ' + JSON.stringify(pedido));
  return { env, D, P, C, X, visitas, contab, convite, tokenLig };
}

/* ------------------------------ o estado ------------------------------- */

describe('o estado com serviços desligados', () => {
  test('estado: sem linhas em user_services vem desligados: [] e tudo o resto como antes', async () => {
    const { env, D } = await armar();
    const antes = await estado(env, D);
    assert.equal(antes.status, 200);
    assert.deepEqual(antes.servicos, { desligados: [] });
    assert.deepEqual(antes.houses.map((h) => h.id).sort(), ['H1', 'H2']);
    assert.deepEqual(kinds(antes.records), ['contract', 'rec', 'tenant', 'tx', 'visit']);
    assert.deepEqual(kinds(antes.userRecords), ['profile', 'rec', 'settings', 'tpl', 'tx']);
    assert.equal(antes.roles.length, 2);
    assert.equal(antes.collaborators.length, 1);
    assert.equal(antes.houses.find((h) => h.id === 'H1').collaborators.length, 1);
    assert.equal(antes.invites.length, 1);
    assert.equal(antes.shareLink.ativo, true);
    assert.equal(antes.shareRequests.incoming.length, 1);
    assert.equal(antes.connections.length, 1);
    // linhas com enabled = 1 (um serviço que o suporte voltou a ligar) não contam para nada
    for (const s of ['properties', 'transactions']) {
      await env.DB.prepare('INSERT INTO user_services (user_id, service, enabled, updated_at, updated_by) VALUES (?, ?, 1, 1, ?)')
        .bind(D.id, s, 's1').run();
    }
    assert.deepEqual(await estado(env, D), antes, 'o mesmo estado, campo a campo');
  });

  test('estado: desligar properties traz o fecho e tira casas, registos e as tabelas de colaboradores', async () => {
    const { env, D } = await armar();
    await desligar(env, D, 'properties');
    const st = await estado(env, D);
    assert.equal(st.status, 200);
    assert.deepEqual(st.servicos.desligados, ['properties', 'contracts', 'visits', 'colaboradores', 'credits']);
    assert.deepEqual(st.houses, []);
    assert.deepEqual(st.records, []);
    assert.deepEqual(st.roles, []);
    assert.deepEqual(st.collaborators, []);
    assert.deepEqual(st.invites, []);
    assert.equal(st.shareLink, null);
    assert.deepEqual(st.shareRequests, { incoming: [], outgoing: [] });
    assert.deepEqual(st.connections, []);
    // o que não é de nenhum destes serviços continua a vir
    assert.deepEqual(kinds(st.userRecords), ['profile', 'rec', 'settings', 'tpl', 'tx']);
    assert.equal(st.me.id, D.id);
    assert.ok(st.profiles.some((p) => p.userId === D.id && p.data), 'o meu perfil vem');
    // e na base está tudo: nada se apagou
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE deleted = 0').first()).n, 5);
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM houses WHERE deleted = 0').first()).n, 3);
  });

  test('estado: desligar transactions omite tx e rec dos registos e tx, rec e tpl dos dados globais; o resto fica', async () => {
    const { env, D } = await armar();
    await desligar(env, D, 'transactions');
    const st = await estado(env, D);
    assert.deepEqual(st.servicos.desligados, ['transactions', 'recurring']);
    assert.deepEqual(kinds(st.records), ['contract', 'tenant', 'visit']);
    assert.deepEqual(kinds(st.userRecords), ['profile', 'settings']);
    assert.deepEqual(st.houses.map((h) => h.id).sort(), ['H1', 'H2']);
    assert.equal(st.roles.length, 2);
    assert.equal(st.collaborators.length, 1);
    assert.equal(st.connections.length, 1);
  });

  test('estado: desligar colaboradores tira cargos, colaboradores, convites, ligação, pedidos e conexões; casas e registos ficam', async () => {
    const { env, D, P } = await armar();
    await desligar(env, D, 'colaboradores');
    const st = await estado(env, D);
    assert.deepEqual(st.servicos.desligados, ['colaboradores']);
    assert.deepEqual(st.roles, []);
    assert.deepEqual(st.collaborators, []);
    assert.deepEqual(st.invites, []);
    assert.equal(st.shareLink, null);
    assert.deepEqual(st.shareRequests, { incoming: [], outgoing: [] });
    assert.deepEqual(st.connections, []);
    assert.deepEqual(st.houses.map((h) => h.id).sort(), ['H1', 'H2']);
    const h1 = st.houses.find((h) => h.id === 'H1');
    assert.deepEqual(h1.collaborators, [], 'nem os colaboradores de cada casa');
    assert.deepEqual(h1.participants, [D.id, P.id], 'a compropriedade fica — não é dos Colaboradores');
    assert.deepEqual(kinds(st.records), ['contract', 'rec', 'tenant', 'tx', 'visit']);
    // quem está do outro lado não é tocado
    const stP = await estado(env, P);
    assert.deepEqual(stP.servicos.desligados, []);
    assert.equal(stP.connections.length, 1);
    assert.equal(stP.houses.find((h) => h.id === 'H1').collaborators.length, 1);
  });

  test('estado: um colaborador de outrem também não recebe os kinds desligados na conta dele', async () => {
    const { env, C } = await armar();
    const antes = await estado(env, C);
    assert.deepEqual(kinds(antes.records), ['contract', 'rec', 'tenant', 'tx'], 'o contabilista vê estes quatro');
    await desligar(env, C, 'transactions');
    const st = await estado(env, C);
    assert.deepEqual(st.servicos.desligados, ['transactions', 'recurring']);
    assert.deepEqual(kinds(st.records), ['contract', 'tenant']);
    assert.equal(st.houses.length, 1, 'a casa de colaboração continua a vir');
    assert.ok(st.houses[0].collab, 'com o cargo');
  });

  test('estado: uma linha antiga só com contracts vale como contracts desligado, e os contratos ficam de fora', async () => {
    const { env, D } = await armar();
    await env.DB.prepare('INSERT INTO user_services (user_id, service, enabled, updated_at, updated_by) VALUES (?, ?, 0, 1, ?)')
      .bind(D.id, 'contracts', '').run();
    const st = await estado(env, D);
    assert.deepEqual(st.servicos.desligados, ['contracts']);
    assert.deepEqual(kinds(st.records), ['rec', 'tenant', 'tx', 'visit']);
    assert.equal(st.houses.length, 2);
  });
});

/* ------------------------------ as recusas ----------------------------- */

describe('as escritas recusadas num serviço desligado', () => {
  test('recusa: sync de um record com kind desligado é 403 com a frase e não deixa rasto; ligado passa', async () => {
    const { env, D } = await armar();
    await desligar(env, D, 'transactions');
    const foto = await fotografia(env);
    const ops = [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x9', data: { label: 'novo' } },
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x1' },
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'rec', id: 'r9', data: { label: 'planeado' } },
    ];
    const r = await sync(env, D, ops);
    assert.deepEqual(r, [
      { ok: false, status: 403, error: frase('transactions'), servico: 'transactions' },
      { ok: false, status: 403, error: frase('transactions'), servico: 'transactions' },
      { ok: false, status: 403, error: frase('recurring'), servico: 'recurring' },
    ], 'os Planeados caem com os Movimentos, e a frase é a deles');
    assert.equal(r[0].error, 'O serviço Movimentos está desligado nesta conta.');
    assert.deepEqual(await fotografia(env), foto, 'sem rasto: nem o put entrou, nem o del deixou lápide');
    // um kind de outro serviço passa na mesma casa
    assert.deepEqual(await sync(env, D, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tenant', id: 't9', data: { name: 'Ana' } }]), [{ ok: true }]);
    // controlo positivo: ligado, as mesmas ops passam
    await ligarTudo(env, D);
    assert.deepEqual(await sync(env, D, ops), [{ ok: true }, { ok: true }, { ok: true }]);
    assert.equal((await env.DB.prepare("SELECT deleted FROM records WHERE house_id = 'H1' AND kind = 'tx' AND id = 'x1'").first()).deleted, 1);
    assert.ok(await env.DB.prepare("SELECT 1 FROM records WHERE house_id = 'H1' AND kind = 'tx' AND id = 'x9' AND deleted = 0").first());
  });

  test('recusa: sync de dados globais com userKind desligado é 403; os da base e de outros serviços passam', async () => {
    const { env, D } = await armar();
    await desligar(env, D, 'recurring');
    const foto = await fotografia(env);
    const ops = [
      { op: 'put', scope: 'user', kind: 'tpl', id: 'tp9', data: { k: 'tpl' } },
      { op: 'del', scope: 'user', kind: 'rec', id: 'ur1' },
    ];
    assert.deepEqual(await sync(env, D, ops), [
      { ok: false, status: 403, error: frase('recurring'), servico: 'recurring' },
      { ok: false, status: 403, error: frase('recurring'), servico: 'recurring' },
    ]);
    assert.deepEqual(await fotografia(env), foto);
    assert.deepEqual(await sync(env, D, [
      { op: 'put', scope: 'user', kind: 'tx', id: 'ux9', data: { k: 'tx' } },
      { op: 'put', scope: 'user', kind: 'settings', id: 'main', data: { tema: 'escuro' } },
    ]), [{ ok: true }, { ok: true }], 'os Movimentos continuam ligados; as definições são da base');
    await ligarTudo(env, D);
    assert.deepEqual(await sync(env, D, ops), [{ ok: true }, { ok: true }]);
  });

  test('recusa: sync de casa (criar, editar, apagar) e de qualquer registo com properties desligado é 403', async () => {
    const { env, D } = await armar();
    await desligar(env, D, 'properties');
    const foto = await fotografia(env);
    const ops = [
      { op: 'put', scope: 'house', houseId: 'H9', data: { name: 'Nova' } },
      { op: 'put', scope: 'house', houseId: 'H1', data: { name: 'Mudada' } },
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tenant', id: 't9', data: { name: 'Ana' } },
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'contract', id: 'c9', data: { name: 'C' } },
      { op: 'del', scope: 'house', houseId: 'H1' },
    ];
    const r = await sync(env, D, ops);
    assert.deepEqual(r, [
      { ok: false, status: 403, error: frase('properties'), servico: 'properties' },
      { ok: false, status: 403, error: frase('properties'), servico: 'properties' },
      { ok: false, status: 403, error: frase('properties'), servico: 'properties' },
      { ok: false, status: 403, error: frase('contracts'), servico: 'contracts' },
      { ok: false, status: 403, error: frase('properties'), servico: 'properties' },
    ], 'um inquilino cai com os Imóveis; um contrato, desligado por fecho, diz o serviço dele');
    assert.deepEqual(await fotografia(env), foto);
    await ligarTudo(env, D);
    assert.deepEqual(await sync(env, D, ops), ops.map(() => ({ ok: true })));
    assert.ok(await env.DB.prepare("SELECT 1 FROM houses WHERE id = 'H9' AND deleted = 0").first(), 'a casa nova entrou');
    assert.equal((await env.DB.prepare("SELECT deleted FROM houses WHERE id = 'H1'").first()).deleted, 1, 'e a H1 foi apagada');
  });

  test('recusa: as rotas diretas — PUT/DELETE /api/houses, propostas de divisão, registos e dados globais', async () => {
    const { env, D, P } = await armar();
    await desligar(env, D, 'properties');
    let foto = await fotografia(env);
    const props = frase('properties');
    const quotas = { [D.id]: 50, [P.id]: 50 };
    assert.deepEqual(await resp(pedir(env, D, '/api/houses/H9', 'PUT', { data: { name: 'Nova' } })), { status: 403, error: props });
    assert.deepEqual(await resp(pedir(env, D, '/api/houses/H1', 'PUT', { data: { name: 'Mudada' } })), { status: 403, error: props });
    assert.deepEqual(await resp(pedir(env, D, '/api/houses/H1', 'DELETE')), { status: 403, error: props });
    assert.deepEqual(await resp(pedir(env, D, '/api/houses/H1/proposal', 'POST', { shares: quotas })), { status: 403, error: props });
    assert.deepEqual(await resp(pedir(env, D, '/api/houses/H1/records/tenant/t9', 'PUT', { data: { name: 'Ana' } })), { status: 403, error: props });
    assert.deepEqual(await resp(pedir(env, D, '/api/houses/H1/records/contract/c1', 'DELETE')), { status: 403, error: frase('contracts') });
    assert.deepEqual(await fotografia(env), foto);
    // o comproprietário, com tudo ligado, propõe na mesma casa — e a proposta entra
    assert.equal((await resp(pedir(env, P, '/api/houses/H1/proposal', 'POST', { shares: quotas }))).status, 201);
    // com os Imóveis ligados mas os Movimentos desligados, só os kinds deles caem
    await ligarTudo(env, D);
    await desligar(env, D, 'transactions');
    foto = await fotografia(env);
    assert.deepEqual(await resp(pedir(env, D, '/api/houses/H1/records/tx/x9', 'PUT', { data: { label: 'x' } })), { status: 403, error: frase('transactions') });
    assert.deepEqual(await resp(pedir(env, D, '/api/houses/H1/records/rec/r1', 'DELETE')), { status: 403, error: frase('recurring') });
    assert.deepEqual(await resp(pedir(env, D, '/api/user-records/tpl/tp9', 'PUT', { data: { k: 'tpl' } })), { status: 403, error: frase('recurring') });
    assert.deepEqual(await resp(pedir(env, D, '/api/user-records/tx/ux1', 'DELETE')), { status: 403, error: frase('transactions') });
    assert.deepEqual(await fotografia(env), foto);
    assert.equal((await resp(pedir(env, D, '/api/houses/H1/records/tenant/t9', 'PUT', { data: { name: 'Ana' } }))).status, 200, 'outro kind passa');
    assert.equal((await resp(pedir(env, D, '/api/user-records/settings/main', 'PUT', { data: { tema: 'escuro' } }))).status, 200, 'a base passa');
    // controlo positivo: tudo ligado, tudo passa
    await ligarTudo(env, D);
    assert.equal((await resp(pedir(env, D, '/api/houses/H9', 'PUT', { data: { name: 'Nova' } }))).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/houses/H1', 'PUT', { data: { name: 'Mudada' } }))).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/houses/H1/records/tx/x9', 'PUT', { data: { label: 'x' } }))).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/houses/H1/records/rec/r1', 'DELETE'))).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/houses/H1/records/contract/c1', 'DELETE'))).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/user-records/tpl/tp9', 'PUT', { data: { k: 'tpl' } }))).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/user-records/tx/ux1', 'DELETE'))).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/houses/H1/proposal/accept', 'POST', {}))).status, 200, 'a proposta do comproprietário aceita-se');
    assert.equal((await resp(pedir(env, D, '/api/houses/H1', 'DELETE'))).status, 200);
  });

  test('recusa: as rotas de colaboradores com colaboradores desligado são 403 sem rasto; ligadas passam', async () => {
    const { env, D, X, visitas, tokenLig } = await armar();
    const colab = frase('colaboradores');
    const st0 = await estado(env, D);
    const idC = st0.collaborators[0].id;
    const pedidoX = st0.shareRequests.incoming[0].id;
    // um segundo convite e uma conta nova para o aceitar, com tudo ainda ligado
    const convite2 = await convidar(env, D, visitas, ['H2'], 'segundo');
    const N = await conta(env, 'Novo');
    await casa(env, N, 'HN', { name: 'Casa do Novo' });
    for (const q of [D, N, X]) await desligar(env, q, 'colaboradores');
    const foto = await fotografia(env);
    const recusado = async (quem, path, method, corpo) => {
      assert.deepEqual(await resp(pedir(env, quem, path, method, corpo)), { status: 403, error: colab }, method + ' ' + path);
    };
    // o dono: cargos, convites, colaboradores, a ligação e os pedidos que lhe chegaram
    await recusado(D, '/api/roles/R_NOVO', 'PUT', { name: 'Novo', perms: ['tx.view'] });
    await recusado(D, '/api/roles/' + visitas, 'DELETE');
    await recusado(D, '/api/collab-invites', 'POST', { roleId: visitas, houseIds: ['H2'] });
    await recusado(D, '/api/collab-invites/' + convite2.id, 'DELETE');
    await recusado(D, '/api/collaborators/' + idC, 'PUT', { roleId: visitas });
    await recusado(D, '/api/collaborators/' + idC, 'DELETE');
    await recusado(D, '/api/share-link', 'POST', {});
    await recusado(D, '/api/share-link', 'DELETE');
    await recusado(D, '/api/share-requests/' + pedidoX + '/accept', 'POST', {});
    await recusado(D, '/api/share-requests/' + pedidoX + '/reject', 'POST', {});
    // quem entra por convite ou pede pela ligação, com o serviço desligado na conta dele
    await recusado(N, '/api/convite/' + convite2.token + '/aceitar', 'POST', {});
    await recusado(N, '/api/ligar/' + tokenLig + '/pedir', 'POST', { houseIds: ['HN'] });
    await recusado(X, '/api/share-requests/' + pedidoX, 'DELETE');
    assert.deepEqual(await fotografia(env), foto, 'nem auditoria, nem convite gasto, nem pedido mexido');
    assert.equal((await resp(pedir(env, D, '/api/roles'))).roles.length, 2, 'os GET continuam a ler o que há');
    // controlo positivo: ligados, os mesmos pedidos passam
    for (const q of [D, N, X]) await ligarTudo(env, q);
    const passa = async (quem, path, method, corpo, esperado) => {
      const r = await resp(pedir(env, quem, path, method, corpo));
      assert.equal(r.status, esperado, method + ' ' + path + ' → ' + JSON.stringify(r));
      return r;
    };
    await passa(D, '/api/roles/R_NOVO', 'PUT', { name: 'Novo', perms: ['tx.view'] }, 201);
    await passa(D, '/api/roles/R_NOVO', 'DELETE', undefined, 200);
    const convite3 = await passa(D, '/api/collab-invites', 'POST', { roleId: visitas, houseIds: ['H2'] }, 201);
    await passa(D, '/api/collab-invites/' + convite3.id, 'DELETE', undefined, 200);
    await passa(N, '/api/convite/' + convite2.token + '/aceitar', 'POST', {}, 200);
    await passa(N, '/api/ligar/' + tokenLig + '/pedir', 'POST', { houseIds: ['HN'] }, 200);
    await passa(D, '/api/collaborators/' + idC, 'PUT', { roleId: visitas }, 200);
    await passa(D, '/api/collaborators/' + idC, 'DELETE', undefined, 200);
    await passa(D, '/api/share-requests/' + pedidoX + '/accept', 'POST', {}, 200);
    const pedidoN = (await estado(env, D)).shareRequests.incoming[0].id;
    await passa(N, '/api/share-requests/' + pedidoN, 'DELETE', undefined, 200);
    await passa(D, '/api/share-link', 'POST', {}, 200);
    await passa(D, '/api/share-link', 'DELETE', undefined, 200);
  });

  test('recusa: as rotas de conexões com colaboradores desligado são 403 sem rasto; ligadas passam', async () => {
    const { env, D, P, X } = await armar();
    const Y = await conta(env, 'Yara');
    // X convida D com tudo ligado; a conexão D–P (aceite, com H1) vem do cenário
    // (o corpo desta rota traz status: 'pending' — o código HTTP lê-se na Response)
    const rConv = await pedir(env, X, '/api/connections', 'POST', { peerId: D.id });
    assert.equal(rConv.status, 201);
    const conv = await rConv.json();
    const dp = (await estado(env, D)).connections.find((c) => c.peer.id === P.id).id;
    await desligar(env, D, 'colaboradores');
    const foto = await fotografia(env);
    const colab = frase('colaboradores');
    for (const [path, method, corpo] of [
      ['/api/connections', 'POST', { peerId: Y.id }],
      ['/api/connections/' + conv.id + '/accept', 'POST', {}],
      ['/api/connections/' + conv.id, 'DELETE', undefined],
      ['/api/connections/' + dp + '/shares', 'PUT', { houseIds: ['H1', 'H2'] }],
    ]) {
      assert.deepEqual(await resp(pedir(env, D, path, method, corpo)), { status: 403, error: colab }, method + ' ' + path);
    }
    assert.deepEqual(await fotografia(env), foto);
    // com os Imóveis desligados cai o mesmo, por fecho — e a frase é a dos Colaboradores
    await ligarTudo(env, D);
    await desligar(env, D, 'properties');
    assert.deepEqual(await resp(pedir(env, D, '/api/connections', 'POST', { peerId: Y.id })), { status: 403, error: colab });
    // controlo positivo
    await ligarTudo(env, D);
    assert.equal((await resp(pedir(env, D, '/api/connections/' + conv.id + '/accept', 'POST', {}))).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/connections/' + dp + '/shares', 'PUT', { houseIds: ['H1', 'H2'] }))).status, 200);
    assert.equal((await pedir(env, D, '/api/connections', 'POST', { peerId: Y.id })).status, 201);
    assert.equal((await resp(pedir(env, D, '/api/connections/' + conv.id, 'DELETE'))).status, 200);
    assert.deepEqual((await estado(env, P)).houses.map((h) => h.id).sort(), ['H1', 'H2'], 'P passou a ver a H2');
  });
});
