// O servidor e o back office com serviços desligados, sobre a mesma base: os
// desligados são de quem pede (o colaborador não herda os do dono, nem o dono
// os do colaborador), o sync com operações misturadas, a recusa do serviço
// antes do travão e da auditoria, o back office a ligar e a desligar (a
// cadeia do fecho, o rasto, as linhas antigas, quem pode), e o que o estado
// esconde com os Imóveis desligados.
//
// Contra o SQL a sério (testes/lib/bd.js), com as armações de
// testes/lib/api.js e testes/lib/equipa.js: a app fala pelo handleApi (sessão
// Bearer), o back office pelo rotasEquipaApi (a sessão de equipa em `eu`), os
// dois sobre a mesma base.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import {
  ambiente, conta, pedir, resp, estado, sync, casa, registo, dadoGlobal, comproprietario, cargo, convidar, darCargo,
  auditoria, desligar, ligarTudo, TABELAS, fotografia,
} from './lib/api.js';
import { chamar, corpoDe, MASTER, SUPORTE, DEV, ADMIN, ADMIN_E_DEV, SUPORTE_E_DEV, SEM_CARGO } from './lib/equipa.js';
import { guardarServico, servicosDesligados, FRASE_DESLIGADO } from '../worker/src/lib/servicos.js';
import { CARGOS_EXEMPLO } from '../worker/src/lib/permissoes.js';

/* ------------------------------ armações ------------------------------- */
// as de todos os testes do servidor e do back office vêm de testes/lib/api.js
// e testes/lib/equipa.js (a fotografia das tabelas incluída); estas são deste ficheiro

// as duas rotas dos serviços no back office, e o que se lê de uma lista devolvida
const rota = (id, servico) => '/api/equipa/pessoas/' + id + '/servicos' + (servico ? '/' + servico : '');
const listar = async (env, eu, id) => corpoDe(await chamar(env, eu, 'GET', rota(id)));
const mudar = (env, eu, id, servico, ligado) => chamar(env, eu, 'PUT', rota(id, servico), { ligado });
const desligadosDa = (lista) => lista.filter((s) => !s.ligado).map((s) => s.id);

// uma linha antiga: só o pai, sem os dependentes escritos
const linhaAntiga = (env, quem, servico) => env.DB.prepare(
  'INSERT INTO user_services (user_id, service, enabled, updated_at, updated_by) VALUES (?, ?, 0, 1, ?)'
).bind(quem.id, servico, '').run();

// (objetos simples: o node:sqlite devolve linhas sem protótipo, e o deepEqual estrito nota)
const linhasDe = async (env, quem) => (await env.DB.prepare(
  'SELECT service, enabled, updated_by FROM user_services WHERE user_id = ? ORDER BY service'
).bind(quem.id).all()).results.map((l) => ({ service: l.service, enabled: l.enabled, updated_by: l.updated_by }));
const limite = async (env, chave) => env.DB.prepare('SELECT n FROM rate_limits WHERE k = ?').bind(chave).first();

const kinds = (lista) => lista.map((r) => r.kind).sort();
const frase = FRASE_DESLIGADO;
const SEM_IMOVEIS = ['properties', 'contracts', 'visits', 'colaboradores', 'credits'];

/* O cenário (o mesmo de servicos-servidor.test.js): D é dono de H1
   (partilhada com P, comproprietário) e de H2, com um registo de cada kind
   em H1 e dados globais; C é contabilista em H1; D tem dois cargos, um
   convite por usar, a ligação de partilha ativa e um pedido pendente de X. */
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

/* ------------------- o colaborador e o dono, de cada lado ------------------ */

describe('os desligados são de quem pede: colaborador e dono não se tocam', () => {
  test('colaborador: o dono sem Imóveis não tira a casa ao contabilista, que continua a ver e a gravar — e nada se perde', async () => {
    const { env, D, C } = await armar();
    await desligar(env, D, 'properties');
    const stD = await estado(env, D);
    assert.deepEqual(stD.houses, [], 'o dono não recebe casas');
    assert.deepEqual(stD.records, []);
    const stC = await estado(env, C);
    assert.deepEqual(stC.servicos.desligados, [], 'os desligados do dono não são do colaborador');
    assert.equal(stC.houses.length, 1);
    assert.equal(stC.houses[0].id, 'H1');
    assert.ok(stC.houses[0].collab, 'com o cargo');
    assert.deepEqual(kinds(stC.records), ['contract', 'rec', 'tenant', 'tx'], 'vê o que o cargo deixa, como antes');
    // e grava na casa do dono, que tem os Imóveis desligados
    assert.deepEqual(await sync(env, C, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'xc', data: { label: 'do contabilista', amount: 10 } },
    ]), [{ ok: true }]);
    // o dono só o vê quando o suporte volta a ligar: nada se perdeu no meio
    assert.deepEqual((await estado(env, D)).records, []);
    await ligarTudo(env, D);
    const depois = await estado(env, D);
    assert.deepEqual(depois.houses.map((h) => h.id).sort(), ['H1', 'H2']);
    const xc = depois.records.find((r) => r.id === 'xc');
    assert.ok(xc, 'o movimento do contabilista chegou ao dono');
    assert.equal(xc.createdBy, C.id);
  });

  test('colaborador: o dono com Movimentos desligados não tira os movimentos ao contabilista; o inverso também não', async () => {
    const { env, D, C } = await armar();
    // o dono desliga: o contabilista continua igual
    await desligar(env, D, 'transactions');
    assert.deepEqual(kinds((await estado(env, D)).records), ['contract', 'tenant', 'visit']);
    assert.deepEqual(kinds((await estado(env, C)).records), ['contract', 'rec', 'tenant', 'tx']);
    assert.deepEqual(await sync(env, C, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'xc', data: { label: 'do contabilista' } },
    ]), [{ ok: true }], 'o contabilista grava um movimento na casa do dono');
    await ligarTudo(env, D);
    assert.ok((await estado(env, D)).records.some((r) => r.id === 'xc'), 'e o dono vê-o ao ligar');
    // o contabilista desliga: o dono continua igual, e ele deixa de ver e de gravar
    await desligar(env, C, 'transactions');
    const stC = await estado(env, C);
    assert.deepEqual(stC.servicos.desligados, ['transactions', 'recurring']);
    assert.deepEqual(kinds(stC.records), ['contract', 'tenant']);
    assert.deepEqual(await sync(env, C, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'xd', data: { label: 'outro' } },
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'rec', id: 'rd', data: { label: 'planeado' } },
    ]), [
      { ok: false, status: 403, error: frase('transactions'), servico: 'transactions' },
      { ok: false, status: 403, error: frase('recurring'), servico: 'recurring' },
    ]);
    const stD = await estado(env, D);
    assert.deepEqual(stD.servicos.desligados, []);
    assert.deepEqual(kinds(stD.records), ['contract', 'rec', 'tenant', 'tx', 'tx', 'visit'], 'x1 e xc');
    assert.equal(stD.houses.find((h) => h.id === 'H1').collaborators.length, 1, 'o contabilista continua na casa');
  });

  test('colaborador: o dono sem Colaboradores perde as tabelas mas mantém a compropriedade; colaborador e comproprietário não são tocados', async () => {
    const { env, D, P, C } = await armar();
    await desligar(env, D, 'colaboradores');
    const stD = await estado(env, D);
    assert.deepEqual(stD.servicos.desligados, ['colaboradores']);
    const h1 = stD.houses.find((h) => h.id === 'H1');
    assert.deepEqual(h1.collaborators, [], 'sem os colaboradores da casa');
    assert.deepEqual(h1.participants, [D.id, P.id], 'com a compropriedade');
    assert.deepEqual(stD.roles, []);
    assert.deepEqual(stD.collaborators, []);
    assert.deepEqual(stD.connections, []);
    assert.deepEqual(kinds(stD.records), ['contract', 'rec', 'tenant', 'tx', 'visit'], 'os registos ficam');
    // o colaborador continua a ter a casa e a escrever nela
    const stC = await estado(env, C);
    assert.equal(stC.houses.length, 1);
    assert.equal(stC.houses[0].collab.roleName, 'Contabilista');
    assert.deepEqual(await sync(env, C, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'xc', data: { label: 'do contabilista' } },
    ]), [{ ok: true }]);
    assert.ok((await estado(env, D)).records.some((r) => r.id === 'xc'), 'o dono vê o movimento — os Movimentos estão ligados');
    // o comproprietário vê quem colabora na casa comum
    const stP = await estado(env, P);
    assert.deepEqual(stP.servicos.desligados, []);
    assert.equal(stP.houses.find((h) => h.id === 'H1').collaborators.length, 1);
    assert.equal(stP.connections.length, 1);
  });

  test('colaborador: com os Colaboradores desligados na conta dele continua a ver as casas onde tem cargo, mas não sai delas', async () => {
    const { env, D, C } = await armar();
    const idC = (await estado(env, D)).collaborators[0].id;
    await desligar(env, C, 'colaboradores');
    const stC = await estado(env, C);
    assert.deepEqual(stC.servicos.desligados, ['colaboradores']);
    assert.equal(stC.houses.length, 1, 'a casa de colaboração vem — é dos Imóveis, não dos Colaboradores');
    assert.ok(stC.houses[0].collab);
    assert.deepEqual(kinds(stC.records), ['contract', 'rec', 'tenant', 'tx']);
    const foto = await fotografia(env);
    assert.deepEqual(await resp(pedir(env, C, '/api/collaborators/' + idC, 'DELETE')), { status: 403, error: frase('colaboradores') });
    assert.deepEqual(await fotografia(env), foto, 'sem rasto');
    assert.equal((await estado(env, D)).collaborators.length, 1, 'o dono continua a tê-lo');
    await ligarTudo(env, C);
    assert.equal((await resp(pedir(env, C, '/api/collaborators/' + idC, 'DELETE'))).status, 200, 'ligado, sai');
    assert.deepEqual((await estado(env, C)).houses, []);
  });

  test('estado: o comproprietário sem Imóveis não recebe a casa partilhada; o dono continua a vê-la com ele', async () => {
    const { env, D, P } = await armar();
    await desligar(env, P, 'properties');
    const stP = await estado(env, P);
    assert.deepEqual(stP.servicos.desligados, SEM_IMOVEIS);
    assert.deepEqual(stP.houses, []);
    assert.deepEqual(stP.records, []);
    assert.deepEqual(await sync(env, P, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tenant', id: 'tp', data: { name: 'Ana' } },
    ]), [{ ok: false, status: 403, error: frase('properties'), servico: 'properties' }]);
    const stD = await estado(env, D);
    assert.deepEqual(stD.houses.find((h) => h.id === 'H1').participants, [D.id, P.id]);
    assert.equal(stD.connections.length, 1);
  });
});

/* ------------------------------- o sync -------------------------------- */

describe('o sync com ops misturadas', () => {
  test('sync: no mesmo pedido as aceites gravam, as recusadas levam {ok:false, status:403, error} pela ordem, e não fica rasto delas', async () => {
    const { env, D } = await armar();
    await desligar(env, D, 'recurring');
    const antes = await fotografia(env);
    const ops = [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x9', data: { label: 'novo' } },          // passa
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'rec', id: 'r9', data: { label: 'planeado' } },     // Planeados
      { op: 'put', scope: 'user', kind: 'tpl', id: 'tp9', data: { k: 'tpl' } },                              // Planeados
      { op: 'put', scope: 'user', kind: 'settings', id: 'main', data: { tema: 'escuro' } },                  // base
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'rec', id: 'r1' },                                  // Planeados
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'tenant', id: 't1' },                               // passa
      { op: 'put', scope: 'house', houseId: 'H9', data: { name: 'Nova' } },                                  // passa
    ];
    const r = await sync(env, D, ops);
    assert.deepEqual(r, [
      { ok: true },
      { ok: false, status: 403, error: frase('recurring'), servico: 'recurring' },
      { ok: false, status: 403, error: frase('recurring'), servico: 'recurring' },
      { ok: true },
      { ok: false, status: 403, error: frase('recurring'), servico: 'recurring' },
      { ok: true },
      { ok: true },
    ]);
    // «servico» diz ao cliente qual é o serviço (web/cloud/nucleo.js:servicoRecusado distingue-o do 403 de permissão)
    for (const x of r.filter((y) => !y.ok)) assert.deepEqual(Object.keys(x).sort(), ['error', 'ok', 'servico', 'status'], 'a forma da recusa');
    const depois = await fotografia(env);
    // o que entrou
    assert.ok(await env.DB.prepare("SELECT 1 FROM records WHERE house_id = 'H1' AND kind = 'tx' AND id = 'x9' AND deleted = 0").first());
    assert.equal((await env.DB.prepare("SELECT deleted FROM records WHERE house_id = 'H1' AND kind = 'tenant' AND id = 't1'").first()).deleted, 1);
    assert.ok(await env.DB.prepare("SELECT 1 FROM houses WHERE id = 'H9' AND deleted = 0").first());
    assert.match((await env.DB.prepare("SELECT data FROM user_records WHERE user_id = ? AND kind = 'settings' AND id = 'main'").bind(D.id).first()).data, /escuro/);
    // o que não entrou: nem linha, nem lápide
    assert.equal(await env.DB.prepare("SELECT 1 FROM records WHERE house_id = 'H1' AND kind = 'rec' AND id = 'r9'").first(), null);
    assert.equal(await env.DB.prepare("SELECT 1 FROM user_records WHERE user_id = ? AND kind = 'tpl' AND id = 'tp9'").bind(D.id).first(), null);
    assert.equal((await env.DB.prepare("SELECT deleted FROM records WHERE house_id = 'H1' AND kind = 'rec' AND id = 'r1'").first()).deleted, 0);
    // e as tabelas em que nenhuma op aceite toca ficaram iguais
    for (const t of TABELAS) {
      if (['records', 'user_records', 'houses'].includes(t)) continue;
      assert.deepEqual(depois[t], antes[t], t + ' não mexeu');
    }
    // o estado concorda: o planeado r1 continua na base mas não sai; x9 sai
    const st = await estado(env, D);
    assert.ok(st.records.some((x) => x.id === 'x9'));
    assert.ok(!st.records.some((x) => x.kind === 'rec'));
    // ligado, as recusadas passam tal e qual
    await ligarTudo(env, D);
    assert.deepEqual(await sync(env, D, [ops[1], ops[2], ops[4]]), [{ ok: true }, { ok: true }, { ok: true }]);
  });

  test('sync: a recusa por serviço vem antes da regra da casa — um kind desligado numa casa alheia não revela se a casa existe', async () => {
    const { env, D } = await armar();
    await desligar(env, D, 'transactions');
    const r = await sync(env, D, [
      { op: 'put', scope: 'record', houseId: 'H3', kind: 'tx', id: 'x3', data: { label: 'na casa do X' } },
      { op: 'put', scope: 'record', houseId: 'NAO_EXISTE', kind: 'tx', id: 'x4', data: { label: 'nada' } },
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'tx', id: 'nunca_existiu' },
    ]);
    assert.deepEqual(r, [
      { ok: false, status: 403, error: frase('transactions'), servico: 'transactions' },
      { ok: false, status: 403, error: frase('transactions'), servico: 'transactions' },
      { ok: false, status: 403, error: frase('transactions'), servico: 'transactions' },
    ], 'a mesma frase para casa alheia, casa inexistente e registo que nunca existiu — nem o gone sai');
  });
});

/* ------------------------ a ordem das guardas ------------------------- */

describe('a 403 do serviço vem antes do rateLimit e da auditoria', () => {
  test('recusa: doze POST /api/collab-invites com os Colaboradores desligados são doze 403 — o contador não sobe, o rasto não cresce', async () => {
    const { env, D, visitas } = await armar();
    const chave = 'invc:' + D.id;
    const n0 = (await limite(env, chave)).n;   // as duas do cenário
    const rasto0 = (await auditoria(env)).length;
    await desligar(env, D, 'colaboradores');
    for (let i = 0; i < 12; i++) {
      assert.deepEqual(await resp(pedir(env, D, '/api/collab-invites', 'POST', { roleId: visitas, houseIds: ['H2'] })),
        { status: 403, error: frase('colaboradores') }, 'pedido ' + (i + 1) + ' — nunca 429');
    }
    assert.equal((await limite(env, chave)).n, n0, 'o contador não contou as recusas');
    assert.equal((await auditoria(env)).length, rasto0, 'nem a auditoria');
    await ligarTudo(env, D);
    assert.equal((await resp(pedir(env, D, '/api/collab-invites', 'POST', { roleId: visitas, houseIds: ['H2'] }))).status, 201);
    assert.equal((await limite(env, chave)).n, n0 + 1, 'ligado, conta');
  });

  test('recusa: doze POST /api/connections com os Colaboradores desligados são doze 403, sem contador nem rasto', async () => {
    const { env, D } = await armar();
    const Y = await conta(env, 'Yara');
    const chave = 'conn:' + D.id;
    assert.equal(await limite(env, chave), null);
    const rasto0 = (await auditoria(env)).length;
    await desligar(env, D, 'colaboradores');
    for (let i = 0; i < 12; i++) {
      assert.deepEqual(await resp(pedir(env, D, '/api/connections', 'POST', { peerId: Y.id })),
        { status: 403, error: frase('colaboradores') }, 'pedido ' + (i + 1));
    }
    assert.equal(await limite(env, chave), null, 'sem contador');
    assert.equal((await auditoria(env)).length, rasto0);
    assert.equal(await env.DB.prepare('SELECT 1 FROM connections WHERE target_id = ?').bind(Y.id).first(), null);
    await ligarTudo(env, D);
    assert.equal((await pedir(env, D, '/api/connections', 'POST', { peerId: Y.id })).status, 201);
    assert.equal((await limite(env, chave)).n, 1);
  });
});

/* ----------------------------- o back office ----------------------------- */

describe('o back office: cadeia, rasto, linhas antigas e permissões', () => {
  test('back office: desligar Imóveis em cadeia e ligar de volta um a um, com o rasto intenção/feito/falhou pela ordem e o estado da app a acompanhar', async () => {
    const { env, D } = await armar();
    const rasto0 = (await auditoria(env)).length;
    const acoes = async () => (await auditoria(env)).slice(rasto0).map((x) => x.acao);

    // desligar: o fecho escrito linha a linha, com quem mexeu
    let r = await corpoDe(await mudar(env, SUPORTE, D.id, 'properties', false));
    assert.equal(r.status, 200);
    assert.deepEqual(desligadosDa(r.servicos), SEM_IMOVEIS);
    assert.deepEqual(await acoes(), ['conta.servico.desligar', 'conta.servico.desligar.feito']);
    let ultimo = (await auditoria(env)).pop();
    assert.equal(ultimo.alvo, D.id);
    assert.equal(ultimo.quem, 's1');
    assert.match(ultimo.detalhe, /properties — desligados agora: properties, contracts, visits, colaboradores, credits/);
    const linhas = await linhasDe(env, D);
    assert.deepEqual(linhas.map((l) => l.service).sort(), [...SEM_IMOVEIS].sort());
    for (const l of linhas) { assert.equal(l.enabled, 0); assert.equal(l.updated_by, 's1'); }
    let st = await estado(env, D);
    assert.deepEqual(st.servicos.desligados, SEM_IMOVEIS);
    assert.deepEqual(st.houses, []);

    // ligar um dependente antes do pai: 400, e o rasto diz que falhou
    r = await mudar(env, MASTER, D.id, 'contracts', true);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'Para ligar Contratos é preciso ligar primeiro Imóveis.');
    assert.deepEqual((await acoes()).slice(-2), ['conta.servico.ligar', 'conta.servico.ligar.falhou']);
    ultimo = (await auditoria(env)).pop();
    assert.equal(ultimo.quem, 'm1');
    assert.match(ultimo.detalhe, /^contracts: Para ligar Contratos é preciso ligar primeiro Imóveis\.$/);
    assert.deepEqual(await servicosDesligados(env, D.id), SEM_IMOVEIS, 'nada mudou');

    // ligar o pai: só ele; os dependentes ficam à espera, um a um
    r = await corpoDe(await mudar(env, MASTER, D.id, 'properties', true));
    assert.equal(r.status, 200);
    assert.deepEqual(desligadosDa(r.servicos), ['contracts', 'visits', 'colaboradores', 'credits']);
    ultimo = (await auditoria(env)).pop();
    assert.equal(ultimo.acao, 'conta.servico.ligar.feito');
    assert.match(ultimo.detalhe, /properties — desligados agora: contracts, visits, colaboradores, credits/);
    st = await estado(env, D);
    assert.deepEqual(st.servicos.desligados, ['contracts', 'visits', 'colaboradores', 'credits']);
    assert.deepEqual(st.houses.map((h) => h.id).sort(), ['H1', 'H2'], 'as casas voltaram');
    assert.deepEqual(kinds(st.records), ['rec', 'tenant', 'tx'], 'contratos e visitas ainda não');
    assert.deepEqual(st.roles, [], 'os Colaboradores ainda não');
    const p = (await linhasDe(env, D)).find((l) => l.service === 'properties');
    assert.equal(p.enabled, 1);
    assert.equal(p.updated_by, 'm1');

    for (const s of ['contracts', 'visits', 'colaboradores', 'credits']) {
      r = await corpoDe(await mudar(env, SUPORTE, D.id, s, true));
      assert.equal(r.status, 200, s);
    }
    assert.deepEqual(desligadosDa(r.servicos), []);
    ultimo = (await auditoria(env)).pop();
    assert.match(ultimo.detalhe, /^credits — tudo ligado$/);
    st = await estado(env, D);
    assert.deepEqual(st.servicos.desligados, []);
    assert.deepEqual(kinds(st.records), ['contract', 'rec', 'tenant', 'tx', 'visit']);
    assert.equal(st.roles.length, 2);
    // cada PUT deixou a intenção e o desfecho, sempre aos pares
    const todas = await acoes();
    assert.equal(todas.length, 14, '7 PUT × (intenção + desfecho)');
    for (let i = 0; i < todas.length; i += 2) assert.ok(todas[i + 1].startsWith(todas[i] + '.'), todas[i] + ' → ' + todas[i + 1]);
  });

  test('back office: uma linha antiga só com o pai vale como fecho no GET, no estado e nas recusas — e desligar um dependente já caído não duplica nada', async () => {
    const { env, D } = await armar();
    await linhaAntiga(env, D, 'properties');
    const lista = await listar(env, SUPORTE, D.id);
    assert.equal(lista.status, 200);
    assert.deepEqual(desligadosDa(lista.servicos), SEM_IMOVEIS, 'o GET mostra o fecho, não só o pai');
    assert.deepEqual(lista.servicos.find((s) => s.id === 'contracts').requer, ['properties', 'tenants']);
    const st = await estado(env, D);
    assert.deepEqual(st.servicos.desligados, SEM_IMOVEIS);
    assert.deepEqual(st.houses, []);
    assert.deepEqual(st.roles, []);
    assert.deepEqual(await sync(env, D, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'contract', id: 'c9', data: { name: 'C' } },
      { op: 'put', scope: 'house', houseId: 'H1', data: { name: 'Mudada' } },
    ]), [
      { ok: false, status: 403, error: frase('contracts'), servico: 'contracts' },
      { ok: false, status: 403, error: frase('properties'), servico: 'properties' },
    ]);
    assert.deepEqual(await resp(pedir(env, D, '/api/roles/R_NOVO', 'PUT', { name: 'Novo', perms: ['tx.view'] })),
      { status: 403, error: frase('colaboradores') }, 'os Colaboradores caem por fecho do pai');
    // desligar um que já está caído por fecho: 200, a lista igual, e sem linha a mais
    const r = await corpoDe(await mudar(env, SUPORTE, D.id, 'visits', false));
    assert.equal(r.status, 200);
    assert.deepEqual(desligadosDa(r.servicos), SEM_IMOVEIS);
    assert.equal((await linhasDe(env, D)).length, 1, 'continua só a linha do pai');
  });

  test('back office: ligar o que já está ligado e desligar o que já está desligado não estraga nada', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    let r = await corpoDe(await mudar(env, SUPORTE, D.id, 'fisco', true));
    assert.equal(r.status, 200);
    assert.deepEqual(desligadosDa(r.servicos), []);
    assert.deepEqual(await linhasDe(env, D), [{ service: 'fisco', enabled: 1, updated_by: 's1' }]);
    await mudar(env, SUPORTE, D.id, 'fisco', false);
    r = await corpoDe(await mudar(env, MASTER, D.id, 'fisco', false));
    assert.equal(r.status, 200);
    assert.deepEqual(desligadosDa(r.servicos), ['fisco']);
    assert.deepEqual(await linhasDe(env, D), [{ service: 'fisco', enabled: 0, updated_by: 's1' }], 'a segunda vez não reescreve');
    assert.deepEqual((await estado(env, D)).servicos.desligados, ['fisco']);
    assert.equal((await auditoria(env)).filter((x) => x.acao === 'conta.servico.desligar').length, 2, 'mas fica no rasto as duas vezes');
  });

  test('back office: só suporte e master; dev, admin, admin+dev e sem cargo levam 403 antes de se olhar para a conta — e as recusas não auditam', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    for (const eu of [DEV, ADMIN, ADMIN_E_DEV, SEM_CARGO]) {
      const nome = eu.papeis.join('+') || 'sem cargo';
      assert.equal((await chamar(env, eu, 'GET', rota(D.id))).status, 403, nome + ' não lista');
      assert.equal((await chamar(env, eu, 'GET', rota('U9999999'))).status, 403, nome + ': 403 mesmo numa conta que não existe');
      assert.equal((await mudar(env, eu, D.id, 'fisco', false)).status, 403, nome + ' não desliga');
    }
    for (const eu of [SUPORTE, MASTER, SUPORTE_E_DEV]) {
      assert.equal((await listar(env, eu, D.id)).status, 200, eu.papeis.join('+') + ' lista');
      assert.equal((await chamar(env, eu, 'GET', rota('U9999999'))).status, 404, 'conta inexistente é 404');
      assert.equal((await chamar(env, eu, 'GET', rota('id%20mau'))).status, 400, 'id inválido é 400');
      assert.equal((await mudar(env, eu, D.id, 'settings', false)).status, 400, 'as Definições são a base');
      assert.equal((await chamar(env, eu, 'PUT', rota(D.id, 'fisco'))).status, 400, 'sem corpo é 400');
      // as formas que não existem não são daqui: a rota devolve null e o encaminhador dá 404
      assert.equal(await chamar(env, eu, 'GET', rota(D.id, 'fisco')), null, 'GET de um serviço não existe');
      assert.equal(await chamar(env, eu, 'PUT', rota(D.id), { ligado: false }), null, 'PUT sem serviço não existe');
    }
    assert.deepEqual(await servicosDesligados(env, D.id), []);
    assert.equal((await auditoria(env)).length, 0, 'nenhuma recusa chegou ao rasto');
  });

  test('migração: a 0015 é idempotente e a chave é (user_id, service)', async () => {
    const env = ambiente();
    const sql = readFileSync(new URL('../migrations/0015_servicos.sql', import.meta.url), 'utf8');
    assert.doesNotThrow(() => env.DB._db.exec(sql), 'correr a migração outra vez não rebenta');
    const cols = (await env.DB.prepare('PRAGMA table_info(user_services)').all()).results;
    assert.deepEqual(cols.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name), ['user_id', 'service']);
    assert.deepEqual(cols.map((c) => c.name), ['user_id', 'service', 'enabled', 'updated_at', 'updated_by']);
    // a chave impede duas linhas do mesmo serviço; o ON CONFLICT do guardarServico apanha-a
    const D = await conta(env, 'Dono');
    await guardarServico(env, D.id, 'fisco', false, 'a');
    await guardarServico(env, D.id, 'fisco', true, 'b');
    assert.deepEqual(await linhasDe(env, D), [{ service: 'fisco', enabled: 1, updated_by: 'b' }]);
  });
});

/* ----------------- o que a passagem a serviços chegou a partir ----------------- */

describe('ligar, esconder e ler os serviços de uma conta: as regressões', () => {
  // revisão dos serviços, A.2-1
  test('ligar o pai com uma linha antiga só do pai deixa os dependentes desligados, como o «um a um» promete', async () => {
    const { env, D } = await armar();
    await linhaAntiga(env, D, 'properties');
    assert.deepEqual(await servicosDesligados(env, D.id), SEM_IMOVEIS, 'antes: o fecho');
    const r = await corpoDe(await mudar(env, SUPORTE, D.id, 'properties', true));
    assert.equal(r.status, 200);
    assert.deepEqual(desligadosDa(r.servicos), ['contracts', 'visits', 'colaboradores', 'credits'],
      'os dependentes ficam desligados — o suporte liga-os um a um, como quando o fecho foi escrito');
    assert.deepEqual((await estado(env, D)).servicos.desligados, ['contracts', 'visits', 'colaboradores', 'credits']);
    assert.match((await auditoria(env)).pop().detalhe, /desligados agora: contracts, visits, colaboradores, credits/);
  });

  // revisão dos serviços, A.2-2
  test('com os Imóveis desligados não saem as propostas de quotas nem os perfis completos dos comproprietários das casas escondidas', async () => {
    const { env, D, P } = await armar();
    await dadoGlobal(env, P, 'profile', 'main', { nif: '123456789', cc: '11111111' });
    // o comproprietário, com tudo ligado, propõe uma divisão na casa comum
    const quotas = { [D.id]: 60, [P.id]: 40 };
    assert.equal((await resp(pedir(env, P, '/api/houses/H1/proposal', 'POST', { shares: quotas }))).status, 201);
    await desligar(env, D, 'properties');
    const st = await estado(env, D);
    assert.deepEqual(st.houses, []);
    assert.deepEqual(st.proposals, [], 'a proposta é da casa que não vai');
    const perfilP = st.profiles.find((p) => p.userId === P.id);
    assert.ok(perfilP, 'o nome do comproprietário continua a vir');
    assert.equal(perfilP.data, null, 'mas o perfil completo (NIF, CC) só sai com a casa comum');
    // ligado, volta tudo
    await ligarTudo(env, D);
    const depois = await estado(env, D);
    assert.equal(depois.proposals.length, 1);
    assert.equal(depois.profiles.find((p) => p.userId === P.id).data.nif, '123456789');
  });

  // revisão dos serviços, A.2-3
  test('um PUT no back office lê user_services duas vezes (antes e depois de gravar), não três', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const original = env.DB.prepare;
    let leituras = 0;
    env.DB.prepare = (sql) => {
      if (/SELECT[\s\S]*FROM user_services/.test(sql)) leituras++;
      return original.call(env.DB, sql);
    };
    const r = await corpoDe(await mudar(env, SUPORTE, D.id, 'transactions', false));
    assert.equal(r.status, 200);
    assert.ok(leituras <= 2, 'leu user_services ' + leituras + ' vezes num só PUT');
  });
});
