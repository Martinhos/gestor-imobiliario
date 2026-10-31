// Nada começa antes da compra do imóvel (decisão do Martinho, ticket de QA
// a3a6d2d4): o servidor recusa, por operação, um contrato, um movimento de
// uma casa e um crédito da casa com data anterior à data de compra
// (worker/src/lib/escritas.js:recusaPelaCompra) — só quando são novos ou a
// data mudou; e o cliente, com essa recusa, não fica a reenviar para sempre
// (web/cloud/nucleo.js:recusaPorValidacao).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { carregarTudo } from './arnes.js';
import { ambiente, conta, casa, registo, sync, pedir, resp } from './lib/api.js';
import { recusaPelaCompra } from '../worker/src/lib/escritas.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const COMPRA = '2020-03-12';
const FRASE_CONTRATO = 'O contrato começa antes da compra do imóvel (12/03/2020).';
const FRASE_RECEITA = 'A receita tem data antes da compra do imóvel (12/03/2020).';

// Um contrato da casa H1, como o cliente o manda.
// Recebe: id; start; extra (opcional).
// Devolve: a operação.
const contrato = (id, start, extra) => ({
  op: 'put', scope: 'record', houseId: 'H1', kind: 'contract', id,
  data: Object.assign({ id, name: 'Contrato ' + id, propertyId: 'H1', rent: 500, start }, extra || {}),
});

// Um movimento da casa H1.
// Recebe: id; date; extra (opcional).
// Devolve: a operação.
const movimento = (id, date, extra) => ({
  op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id,
  data: Object.assign({ id, label: 'Renda', amount: 500, kind: 'income', date, propertyId: 'H1' }, extra || {}),
});

// A ficha da casa H1 com os créditos dados.
// Recebe: loans; extra (opcional).
// Devolve: a operação.
const ficha = (loans, extra) => ({
  op: 'put', scope: 'house', houseId: 'H1',
  data: Object.assign({ id: 'H1', name: 'T2', rooms: [], purchaseDate: COMPRA, loans }, extra || {}),
});

// O JSON de um registo da casa H1 na base.
// Recebe: env; kind; id.
// Devolve: a promessa do objeto, ou null.
async function naBase(env, kind, id) {
  const r = await env.DB.prepare('SELECT data, deleted FROM records WHERE house_id = ? AND kind = ? AND id = ?').bind('H1', kind, id).first();
  return r && !r.deleted ? JSON.parse(r.data) : null;
}

// Uma conta com a casa H1 comprada a 12/03/2020 (sem data, com semData).
// Recebe: semData (opcional).
// Devolve: a promessa de { env, D }.
async function comprada(semData) {
  const env = ambiente();
  const D = await conta(env, 'Dona');
  await casa(env, D, 'H1', semData ? {} : { purchaseDate: COMPRA });
  return { env, D };
}

describe('o servidor recusa datas antes da compra do imóvel', () => {
  test('contrato e receita novos antes da compra: recusa por operação, com a frase; o resto do pedido passa', async () => {
    const { env, D } = await comprada();
    const r = await sync(env, D, [
      contrato('c1', '1870-01-01'),
      movimento('t1', '2019-12-31'),
      movimento('t2', COMPRA),            // no próprio dia, passa
      movimento('t3', '1870-01-01', { kind: 'expense' }),   // uma despesa grava com qualquer data
      movimento('t4', '1870-01-01', { kind: 'settle' }),
      contrato('c2', '2021-01-01'),
    ]);
    assert.deepEqual(r[0], { ok: false, status: 422, error: FRASE_CONTRATO });
    assert.deepEqual(r[1], { ok: false, status: 422, error: FRASE_RECEITA });
    assert.deepEqual(r.slice(2), [{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
    assert.equal(await naBase(env, 'contract', 'c1'), null, 'o recusado não fica na base');
    assert.equal(await naBase(env, 'tx', 't1'), null);
    assert.ok(await naBase(env, 'tx', 't2'));
    assert.ok(await naBase(env, 'contract', 'c2'));
  });

  test('um registo antigo já antes da compra, sem mudar de data, continua a gravar; mudar a data para antes é recusado', async () => {
    const { env, D } = await comprada();
    await registo(env, 'H1', 'contract', 'c1', { name: 'Antigo', propertyId: 'H1', start: '1999-01-01' }, D);
    await registo(env, 'H1', 'tx', 't1', { label: 'Antigo', amount: 1, kind: 'income', date: '1999-02-01', propertyId: 'H1' }, D);
    const r = await sync(env, D, [
      Object.assign(contrato('c1', '1999-01-01', { name: 'Mudei o nome' }), { base: { name: 'Antigo' } }),
      movimento('t1', '1999-02-01', { label: 'Mudei' }),
    ]);
    assert.deepEqual(r, [{ ok: true }, { ok: true }]);
    assert.equal((await naBase(env, 'contract', 'c1')).name, 'Mudei o nome');
    const r2 = await sync(env, D, [contrato('c1', '1998-01-01'), movimento('t1', '2026-01-01')]);
    assert.deepEqual(r2[0], { ok: false, status: 422, error: FRASE_CONTRATO }, 'recuou para outra data antes da compra');
    assert.deepEqual(r2[1], { ok: true }, 'para depois da compra passa');
    assert.equal((await naBase(env, 'contract', 'c1')).start, '1999-01-01', 'ficou como estava');
  });

  test('uma despesa antiga antes da compra edita-se à vontade; passá-la a receita é uma receita nova, e recusa-se', async () => {
    const { env, D } = await comprada();
    await registo(env, 'H1', 'tx', 't1', { label: 'Obras', amount: 9, kind: 'expense', date: '2019-05-01', propertyId: 'H1' }, D);
    assert.deepEqual(await sync(env, D, [movimento('t1', '2018-01-01', { kind: 'expense', label: 'Obras grandes' })]), [{ ok: true }]);
    assert.deepEqual(await sync(env, D, [movimento('t1', '2018-01-01')]), [{ ok: false, status: 422, error: FRASE_RECEITA }]);
    assert.equal((await naBase(env, 'tx', 't1')).kind, 'expense');
  });

  test('sem data de compra não há limite; e um movimento sem imóvel também não', async () => {
    const { env, D } = await comprada(true);
    const r = await sync(env, D, [
      contrato('c1', '1870-01-01'), movimento('t1', '1870-02-01'),
      { op: 'put', scope: 'user', kind: 'tx', id: 'u1', data: { id: 'u1', label: 'Café', amount: 2, date: '1870-01-01' } },
    ]);
    assert.deepEqual(r, [{ ok: true }, { ok: true }, { ok: true }]);
  });

  test('a data de compra que conta é a mais recente, mesmo a que chega no próprio pedido', async () => {
    const { env, D } = await comprada(true);
    const r = await sync(env, D, [ficha([]), contrato('c1', '2019-01-01')]);
    assert.deepEqual(r, [{ ok: true }, { ok: false, status: 422, error: FRASE_CONTRATO }]);
  });

  test('um crédito novo (ou que recuou) antes da compra recusa a ficha; um antigo que não mudou deixa gravar, e mudar a compra para depois não é recusado', async () => {
    const { env, D } = await comprada();
    const frase = 'O crédito «Aquisição» começa antes da compra do imóvel (12/03/2020).';
    let r = await sync(env, D, [ficha([{ id: 'L1', name: 'Aquisição', start: '2010-01-01', outstanding: 1 }])]);
    assert.deepEqual(r, [{ ok: false, status: 422, error: frase }]);
    // um crédito que já lá estava antes da compra (dados de hoje)
    await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?').bind(JSON.stringify({
      id: 'H1', name: 'T2', rooms: [], purchaseDate: COMPRA, loans: [{ id: 'L1', name: 'Aquisição', start: '2010-01-01' }],
    }), 'H1').run();
    r = await sync(env, D, [ficha([{ id: 'L1', name: 'Aquisição', start: '2010-01-01' }], { name: 'T2 renovado' })]);
    assert.deepEqual(r, [{ ok: true }]);
    r = await sync(env, D, [ficha([{ id: 'L1', name: 'Aquisição', start: '2009-01-01' }])]);
    assert.deepEqual(r, [{ ok: false, status: 422, error: frase }], 'a data do crédito recuou');
    // a compra passa para depois dos registos que já lá estão: não se recusa
    await registo(env, 'H1', 'contract', 'c1', { name: 'X', start: '2021-01-01' }, D);
    r = await sync(env, D, [ficha([{ id: 'L1', name: 'Aquisição', start: '2010-01-01' }], { purchaseDate: '2024-01-01' })]);
    assert.deepEqual(r, [{ ok: true }]);
    // e o contrato antigo continua a gravar, mas um novo antes dela não entra
    r = await sync(env, D, [contrato('c1', '2021-01-01', { name: 'Y' }), contrato('c2', '2023-01-01')]);
    assert.deepEqual(r[0], { ok: true });
    assert.equal(r[1].status, 422);
    assert.match(r[1].error, /\(01\/01\/2024\)\.$/);
  });

  test('uma casa nova com um crédito antes da compra: recusada', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    const r = await sync(env, D, [{ op: 'put', scope: 'house', houseId: 'H2',
      data: { id: 'H2', name: 'Nova', rooms: [], purchaseDate: COMPRA, loans: [{ id: 'L1', bank: 'Banco X', start: '2000-01-01' }] } }]);
    assert.equal(r[0].status, 422);
    assert.match(r[0].error, /^O crédito «Banco X» começa antes da compra/);
  });

  test('a lápide que volta com a mesma data (o «desfazer») passa', async () => {
    const { env, D } = await comprada();
    await registo(env, 'H1', 'contract', 'c1', { name: 'Antigo', start: '1999-01-01' }, D);
    await env.DB.prepare("UPDATE records SET deleted = 1 WHERE id = 'c1'").run();
    assert.deepEqual(await sync(env, D, [contrato('c1', '1999-01-01')]), [{ ok: true }]);
  });

  test('pelo REST, o mesmo 422 com a frase', async () => {
    const { env, D } = await comprada();
    const r = await resp(pedir(env, D, '/api/houses/H1/records/contract/c9', 'PUT', { data: contrato('c9', '1870-01-01').data }));
    assert.equal(r.status, 422);
    assert.equal(r.error, FRASE_CONTRATO);
  });

  test('recusaPelaCompra: os kinds sem data de compra a respeitar passam, e as datas com horas contam pelo dia', () => {
    assert.equal(recusaPelaCompra('visit', { date: '1870-01-01' }, null, COMPRA), null);
    assert.equal(recusaPelaCompra('rec', { next: '1870-01-01' }, null, COMPRA), null);
    assert.equal(recusaPelaCompra('tx', { kind: 'income', date: '' }, null, COMPRA), null, 'sem data');
    assert.equal(recusaPelaCompra('tx', { kind: 'income', date: '1870-01-01' }, null, 'lixo'), null, 'compra ilegível é sem limite');
    assert.equal(recusaPelaCompra('tx', { kind: 'income', date: '2020-03-11T23:00:00Z' }, null, COMPRA).status, 422);
    assert.equal(recusaPelaCompra('tx', { kind: 'income', date: '2020-03-12T08:00:00Z' }, null, COMPRA), null);
  });
});

/* ------------------------------------------------- o cliente, com a nuvem */

/* A app inteira com a nuvem por cima e os espiões (o mesmo de
   testes/revisao-sync.test.js): o fetch responde o que esp.responde disser,
   o toast e o selo guardam-se, e há sessão.
   Devolve: {app, esp}. */
function montar() {
  const app = carregarTudo();
  const esp = { pedidos: [], toasts: [], selos: [], responde: null };
  const tudoOk = (m, url, body) => (url === '/api/sync'
    ? { status: 200, json: { results: ((body || {}).ops || []).map(() => ({ ok: true })) } }
    : { status: 200, json: {} });
  app.fetch = (url, opts) => {
    opts = opts || {};
    const body = opts.body ? JSON.parse(opts.body) : null;
    esp.pedidos.push({ method: opts.method || 'GET', url, body });
    const r = (esp.responde || tudoOk)(opts.method || 'GET', url, body);
    return Promise.resolve({ ok: r.status < 400, status: r.status, json: () => Promise.resolve(r.json) });
  };
  app.toast = (m) => { esp.toasts.push(String(m)); };
  app.setSyncBadge = (s) => { esp.selos.push(s); };
  app.render = () => {};
  app.buildNav = () => {};
  app.subirPendentes = () => {};
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt', token: 't' };
  return { app, esp };
}

// As operações que seguiram para /api/sync, por ordem.
const opsDe = (esp) => esp.pedidos.filter((p) => p.url === '/api/sync').flatMap((p) => (p.body || {}).ops || []);

// Um servidor que recusa com 422 as operações que `recusa(o)` disser.
const recusaCom = (recusa, frase) => (m, url, body) => (url === '/api/sync'
  ? { status: 200, json: { results: body.ops.map((o) => (recusa(o) ? { ok: false, status: 422, error: frase } : { ok: true })) } }
  : { status: 200, json: {} });

/* O estado de uma conta com a casa H1 (comprada a 12/03/2020, com o crédito
   L1 de 2021) e os dois dados globais da base.
   Devolve: o estado. */
function ESTADO() {
  return {
    me: { id: 'EU', email: 'eu@x.pt', name: 'Eu' },
    servicos: { desligados: [] },
    profiles: [{ userId: 'EU', name: 'Eu', data: { id: 'EU', name: 'Eu' } }],
    people: [{ id: 'EU', name: 'Eu', kind: 'owner' }],
    proposals: [],
    houses: [{ id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], collaborators: [], updatedAt: 1,
      data: { id: 'H1', name: 'T2 Lisboa', rooms: [], purchaseDate: COMPRA, loans: [{ id: 'L1', name: 'Aquisição', start: '2021-01-01', outstanding: 1000 }] } }],
    records: [],
    userRecords: [
      { kind: 'settings', id: 'main', updatedAt: 1, data: {} },
      { kind: 'profile', id: 'main', updatedAt: 1, data: { id: 'EU', name: 'Eu' } },
    ],
    roles: [], collaborators: [], invites: [], shareLink: null,
    shareRequests: { incoming: [], outgoing: [] }, connections: [],
  };
}

// Aplica um estado e desarma o push que o applyState agenda.
function aplicar(app, st) {
  app.applyState(st);
  app.clearTimeout(app.pushTimer);
}

describe('o cliente com uma recusa de validação (422)', () => {
  test('um contrato recusado sai do aparelho, diz-se a frase uma vez, e não se reenvia', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    app.db.contracts.push(app.normContract({ id: 'C9', name: 'De 1870', propertyId: 'H1', rent: 10, start: '1870-01-01' }));
    esp.responde = recusaCom((o) => o.kind === 'contract', FRASE_CONTRATO);
    await app.pushNow();
    assert.ok(opsDe(esp).some((o) => o.kind === 'contract' && o.id === 'C9'), 'a primeira tentativa segue');
    assert.ok(!app.db.contracts.some((c) => c.id === 'C9'), 'saiu do aparelho');
    assert.deepEqual(esp.toasts.filter((t) => t.includes(FRASE_CONTRATO)), [FRASE_CONTRATO + ' Não foi guardado.']);
    assert.ok(esp.toasts.every((t) => !/sem permissão/.test(t)), 'não se culpa as permissões');
    assert.equal(esp.selos[esp.selos.length - 1], 'ok', 'o selo não fica em «por enviar»');
    esp.pedidos.length = 0; esp.toasts.length = 0;
    await app.pushNow();
    assert.equal(opsDe(esp).filter((o) => o.kind === 'contract').length, 0, 'não se reenvia');
    assert.equal(esp.toasts.length, 0, 'nem se volta a avisar');
  });

  test('um crédito novo antes da compra sai da ficha (o imóvel fica), e a ficha seguinte sobe sem ele', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    const p = app.db.properties.find((x) => x.id === 'H1');
    p.loans.push(app.normLoan({ id: 'L2', name: 'Obras', start: '2015-01-01', outstanding: 5 }));
    p.loans[0].start = '2019-01-01';   // e o L1 recuou para antes da compra
    const frase = 'O crédito «Obras» começa antes da compra do imóvel (12/03/2020).';
    esp.responde = recusaCom((o) => o.scope === 'house' && o.data.loans.some((l) => l.start < COMPRA), frase);
    await app.pushNow();
    const depois = app.db.properties.find((x) => x.id === 'H1');
    assert.ok(depois, 'o imóvel fica');
    assert.deepEqual(depois.loans.map((l) => [l.id, l.start]), [['L1', '2021-01-01']], 'o novo sai, o que recuou volta à data do servidor');
    assert.ok(esp.toasts.some((t) => t === frase + ' Não foi guardado.'), esp.toasts.join(' | '));
    esp.pedidos.length = 0; esp.toasts.length = 0;
    await app.pushNow();
    const casas = opsDe(esp).filter((o) => o.scope === 'house');
    assert.ok(casas.every((o) => o.data.loans.every((l) => l.start >= COMPRA)), 'a ficha seguinte não leva o crédito recusado');
    assert.equal(esp.toasts.length, 0);
  });
});
