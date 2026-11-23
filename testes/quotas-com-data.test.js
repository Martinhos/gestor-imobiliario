// As quotas com data e os comproprietários sem conta, no servidor e no
// cliente (auditoria ao IRS, vaga 1, folha 2.1.4; KAN-126). Contra o SQL a
// sério (testes/lib/bd.js), com a migração 0030 aplicada.
//
// D29 — a quota muda com uma data: a proposta aceite diz desde quando, e sair
//   de uma casa ou apagar uma conta mudam-na a partir de hoje (em Lisboa); o
//   estado que acaba vai para o quotasHist da casa com ate = a véspera, e o
//   web/app/saldos.js:quotasFiscais dá a quota em vigor em cada data.
// D08 — os comproprietários sem conta (comproprietariosFora) abatem à casa
//   inteira; com um dono só a proposta aplica-se logo (o «Só eu»).
// D93 — a proposta acerta a última percentagem a 2 casas (33,33 × 3) e recusa
//   o que não é arredondamento (50/49,6).
// D33/D52 — o colaborador não escreve a venda nem o subarrendamento; D71 — a
//   afetação continua à vista dele. Os de fora e o histórico são quotas: o
//   colaborador nem os vê nem os escreve.

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, conta, pedir, resp, estado, casa, comproprietario, cargo, darCargo } from './lib/api.js';
import {
  purgeAccount, acertarQuotas, validarFora, quotasComHistorico, fracoesDasQuotas, quotasIguais,
  vesperaDe, diaValido, diaEmLisboa, estadoDasQuotas, preserveOwnership,
} from '../worker/src/lib/acesso.js';
import { projetarCasa, fundirCasa } from '../worker/src/lib/permissoes.js';
import { carregarApp, limpar, repor, igual } from './arnes.js';

/* ------------------------------ armações ------------------------------- */

afterEach(() => mock.restoreAll());

/* Põe o relógio do worker num instante fixo (o now() e o «hoje» de Lisboa).
   Recebe: iso — 'AAAA-MM-DDTHH:MM:SSZ'.
   Devolve: nada. */
const relogio = (iso) => { const t = Date.parse(iso); mock.method(Date, 'now', () => t); };

// Recebe: env; hid — a casa.
// Devolve: a promessa do JSON da casa como está na base.
const dadosDa = async (env, hid) => JSON.parse((await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(hid).first()).data);

// Recebe: env; hid; q — o ownerShares e os ownerIds a escrever direto (o
// caminho a sério é o das propostas: isto monta o ponto de partida).
// Devolve: a promessa do run.
async function quotasDiretas(env, hid, q) {
  const d = await dadosDa(env, hid);
  d.ownerShares = q;
  d.ownerIds = Object.keys(q);
  await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?').bind(JSON.stringify(d), hid).run();
}

// Recebe: env; quem; hid; corpo — o da proposta.
// Devolve: a promessa de {status, ...}.
const propor = (env, quem, hid, corpo) => resp(pedir(env, quem, '/api/houses/' + hid + '/proposal', 'POST', corpo));
// Recebe: env; quem; hid. Devolve: a promessa de {status, ...} do aceitar.
const aceitarP = (env, quem, hid) => resp(pedir(env, quem, '/api/houses/' + hid + '/proposal/accept', 'POST', {}));

/* A Ana (A) cria H1 e partilha-a com o Bruno (B), com as quotas dadas.
   Recebe: q — função (A, B) → ownerShares, ou nada (partes iguais).
   Devolve: { env, A, B }. */
async function doisDonos(q) {
  const env = ambiente();
  const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
  await casa(env, A, 'H1', { name: 'T2 Benfica' });
  await comproprietario(env, A, B, ['H1']);
  if (q) await quotasDiretas(env, 'H1', q(A, B));
  return { env, A, B };
}

/* O imóvel do cliente feito do JSON do servidor, como o nucleo.js o monta
   (os donos são os participantes), com as fichas dos donos na base.
   Recebe: app; data — o JSON da casa; donos — os ids de hoje.
   Devolve: o imóvel. */
function imovelDoCliente(app, data, donos) {
  donos.concat(Object.keys(data.ownerShares || {})).forEach((id) => {
    if (!app.db.owners.some((o) => o.id === id)) app.db.owners.push(app.normPerson({ id, name: id }));
  });
  const p = app.normProp(JSON.parse(JSON.stringify(data)));
  p.ownerIds = donos.slice();
  return p;
}

const app = carregarApp();
afterEach(() => repor(app));

/* ------------------------------ a migração ------------------------------ */

describe('a migração 0030', () => {
  test('aplica-se na base dos testes: as colunas fora e desde em share_proposals', async () => {
    const env = ambiente();
    const cols = env.DB._db.prepare('PRAGMA table_info(share_proposals)').all().map((c) => c.name);
    assert.ok(cols.includes('fora'), 'a coluna fora');
    assert.ok(cols.includes('desde'), 'a coluna desde');
  });

  test('uma proposta de antes da migração (fora e desde a NULL) aplica-se com as quotas a partir do dia do último sim', async () => {
    relogio('2026-04-20T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    await env.DB.prepare('INSERT INTO share_proposals (house_id, proposed_by, shares, approvals, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('H1', A.id, JSON.stringify({ [A.id]: 70, [B.id]: 30 }), JSON.stringify([A.id]), Date.now()).run();
    assert.equal((await aceitarP(env, B, 'H1')).applied, true);
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.ownerShares, { [A.id]: 70, [B.id]: 30 });
    assert.equal(d.quotasHist.length, 1);
    assert.equal(d.quotasHist[0].ate, '2026-04-19', 'até ontem, as de antes');
    assert.deepEqual(d.quotasHist[0].ownerShares, { [A.id]: 50, [B.id]: 50 });
    assert.equal(d.comproprietariosFora, undefined, 'sem fora na proposta, os de fora não se tocam');
  });
});

/* --------------------------- a proposta com data --------------------------- */

describe('a proposta com data (D29)', () => {
  test('50/50 desde 1/7 aceite por todos: o 100/0 fica no histórico até 30/6, e a quota fiscal segue a data', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 100, [b.id]: 0 }));
    const r = await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 }, desde: '2026-07-01' });
    assert.equal(r.status, 201);
    assert.equal(r.applied, false, 'falta o sim do Bruno');
    const linha = await env.DB.prepare('SELECT fora, desde FROM share_proposals WHERE house_id = ?').bind('H1').first();
    assert.equal(linha.desde, '2026-07-01');
    assert.equal(linha.fora, null, 'sem fora no corpo, a coluna fica NULL (não mexe)');
    assert.equal((await aceitarP(env, B, 'H1')).applied, true);
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.ownerShares, { [A.id]: 50, [B.id]: 50 });
    assert.deepEqual(d.quotasHist, [
      { ate: '2026-06-30', ownerIds: [A.id, B.id], ownerShares: { [A.id]: 100, [B.id]: 0 }, fora: null },
    ]);
    limpar(app);
    const p = imovelDoCliente(app, d, [A.id, B.id]);
    igual(app.quotasFiscais(p, '2026-03-01'), { [A.id]: 1, [B.id]: 0 }, 'em março, as de antes');
    igual(app.quotasFiscais(p, '2026-06-30'), { [A.id]: 1, [B.id]: 0 }, 'o último dia das de antes');
    igual(app.quotasFiscais(p, '2026-09-01'), { [A.id]: 0.5, [B.id]: 0.5 }, 'em setembro, as novas');
    igual(app.quotasFiscais(p, ''), { [A.id]: 0.5, [B.id]: 0.5 }, 'sem data, as de hoje');
    igual(app.quotasMudaramNoAno(p, 2026), ['2026-07-01']);
    igual(app.quotasMudaramNoAno(p, 2025), []);
  });

  test('o Anexo A (c4): 50/50 até 30/6 e 75/25 desde 1/7 — as rendas de 2026 da Ana dão 7 500 € e as de 2025 ficam 6 000 €', async () => {
    relogio('2027-02-01T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 75, [B.id]: 25 }, desde: '2026-07-01' })).status, 201);
    assert.equal((await aceitarP(env, B, 'H1')).applied, true);
    limpar(app);
    const p = imovelDoCliente(app, await dadosDa(env, 'H1'), [A.id, B.id]);
    const rendas = (ano, quem) => Array.from({ length: 12 }, (_, m) => ano + '-' + String(m + 1).padStart(2, '0') + '-05')
      .reduce((n, dia) => n + 1000 * app.quotasFiscais(p, dia)[quem], 0);
    assert.equal(Math.round(rendas(2026, A.id)), 7500);
    assert.equal(Math.round(rendas(2026, B.id)), 4500);
    assert.equal(Math.round(rendas(2025, A.id)), 6000, 'o ano já entregue não muda');
  });

  test('a data não pode ser depois de hoje nem inválida; sem data, as quotas valem desde o dia em que se aplicam', async () => {
    relogio('2026-05-10T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    const q = { [A.id]: 60, [B.id]: 40 };
    assert.deepEqual(await propor(env, A, 'H1', { shares: q, desde: '2026-05-11' }),
      { status: 400, error: 'A data em que as quotas mudam não pode ser depois de hoje.' });
    assert.deepEqual(await propor(env, A, 'H1', { shares: q, desde: '2026-02-30' }),
      { status: 400, error: 'A data em que as quotas mudam não é válida.' });
    assert.equal((await propor(env, A, 'H1', { shares: q, desde: '2026-05-10' })).status, 201, 'hoje passa');
    assert.equal((await propor(env, A, 'H1', { shares: q })).status, 201, 'sem data também');
    relogio('2026-05-12T10:00:00Z');
    const r = await aceitarP(env, B, 'H1');
    assert.equal(r.applied, true, JSON.stringify(r));
    assert.equal((await dadosDa(env, 'H1')).quotasHist[0].ate, '2026-05-11', 'a véspera do dia do último sim');
  });

  test('uma correção da data para trás encurta o período guardado, e voltar ao de antes desfaz o histórico', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    const passa = async (shares, desde) => {
      assert.equal((await propor(env, A, 'H1', { shares, desde })).status, 201);
      assert.equal((await aceitarP(env, B, 'H1')).applied, true);
      return dadosDa(env, 'H1');
    };
    let d = await passa({ [A.id]: 75, [B.id]: 25 }, '2026-07-01');
    assert.equal(d.quotasHist[0].ate, '2026-06-30');
    d = await passa({ [A.id]: 75, [B.id]: 25 }, '2026-06-01');
    assert.deepEqual(d.quotasHist.map((e) => e.ate), ['2026-05-31'], 'a data certa era 1/6: o 50/50 acaba a 31/5');
    assert.deepEqual(d.quotasHist[0].ownerShares, { [A.id]: 50, [B.id]: 50 });
    d = await passa({ [A.id]: 50, [B.id]: 50 }, '2026-06-01');
    assert.equal(d.quotasHist, undefined, 'de 1/6 em diante volta o 50/50 — o mesmo de antes: nada a guardar');
    d = await passa({ [A.id]: 50, [B.id]: 50 }, '2026-08-01');
    assert.equal(d.quotasHist, undefined, 'uma proposta que não muda nada não abre período');
  });
});

/* --------------------------- sair e apagar a conta --------------------------- */

describe('sair e apagar a conta fecham o período (D29)', () => {
  test('o Bruno sai a 10/5: o 50/50 fica até 9/5, e a Ana passa a 100 % só daí em diante', async () => {
    relogio('2026-05-10T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    const r = await resp(pedir(env, B, '/api/houses/H1/participacao', 'DELETE'));
    assert.equal(r.status, 200);
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.ownerShares, { [A.id]: 100 });
    assert.deepEqual(d.quotasHist, [
      { ate: '2026-05-09', ownerIds: [A.id, B.id], ownerShares: { [A.id]: 50, [B.id]: 50 }, fora: null, nomes: { [B.id]: 'Bruno' } },
    ], 'o período leva o nome de quem saiu (N021)');
    limpar(app);
    const p = imovelDoCliente(app, d, [A.id]);
    assert.equal(app.quotasFiscais(p, '2026-05-09')[A.id], 0.5, 'até à véspera, metade');
    assert.equal(app.quotasFiscais(p, '2026-05-10')[A.id], 1, 'desde o dia da saída, tudo');
    assert.equal(app.quotasFiscais(p, '2025-12-01')[A.id], 0.5, 'o ano anterior não muda');
  });

  test('em Lisboa: às 00:30 de 1/6 (23:30 UTC de 31/5, hora de verão) o período acaba a 31/5', async () => {
    relogio('2026-05-31T23:30:00Z');
    assert.equal(diaEmLisboa(), '2026-06-01');
    const { env, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    assert.equal((await resp(pedir(env, B, '/api/houses/H1/participacao', 'DELETE'))).status, 200);
    assert.equal((await dadosDa(env, 'H1')).quotasHist[0].ate, '2026-05-31');
  });

  test('sem quotas escritas (partes iguais) a saída também fecha o período', async () => {
    relogio('2026-05-10T10:00:00Z');
    const { env, A, B } = await doisDonos();
    assert.equal((await resp(pedir(env, B, '/api/houses/H1/participacao', 'DELETE'))).status, 200);
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.quotasHist, [{ ate: '2026-05-09', ownerIds: [A.id, B.id], ownerShares: {}, fora: null, nomes: { [B.id]: 'Bruno' } }]);
    limpar(app);
    const p = imovelDoCliente(app, d, [A.id]);
    assert.equal(app.quotasFiscais(p, '2026-05-01')[A.id], 0.5, 'partes iguais até à véspera');
  });

  test('o Bruno apaga a conta a 10/5: a casa da Ana guarda o 50/50 até 9/5', async () => {
    relogio('2026-05-10T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    await purgeAccount(env, B.id);
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.ownerShares, { [A.id]: 100 }, 'a quota dele passa a quem fica, como numa saída (N136)');
    assert.deepEqual(d.ownerIds, [A.id]);
    assert.deepEqual(d.quotasHist, [
      { ate: '2026-05-09', ownerIds: [A.id, B.id], ownerShares: { [A.id]: 50, [B.id]: 50 }, fora: null },
    ], 'com o id dele e sem o nome: a identidade sai com a conta');
    limpar(app);
    const p = imovelDoCliente(app, d, [A.id]);
    assert.equal(app.quotasFiscais(p, '2026-03-01')[A.id], 0.5);
    assert.equal(app.quotasFiscais(p, '2026-06-01')[A.id], 1);
  });

  test('a conta apagada sem quotas escritas (partes iguais) também fecha o período', async () => {
    relogio('2026-05-10T10:00:00Z');
    const { env, A, B } = await doisDonos();
    await purgeAccount(env, B.id);
    assert.deepEqual((await dadosDa(env, 'H1')).quotasHist, [{ ate: '2026-05-09', ownerIds: [A.id, B.id], ownerShares: {}, fora: null }]);
  });
});

/* ------------------------ os comproprietários de fora ------------------------ */

describe('os comproprietários sem conta (D08)', () => {
  test('com um dono só a proposta aplica-se logo: «Irmão 50 %» dá à Ana 0,5 da casa', async () => {
    relogio('2026-11-17T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1');
    const r = await propor(env, A, 'H1', { shares: { [A.id]: 100 }, fora: [{ nome: '  Irmão ', quota: 50 }] });
    assert.deepEqual(r, { status: 201, ok: true, applied: true });
    const d = await dadosDa(env, 'H1');
    assert.equal(d.comproprietariosFora.length, 1);
    assert.equal(d.comproprietariosFora[0].nome, 'Irmão');
    assert.equal(d.comproprietariosFora[0].quota, 50);
    assert.match(d.comproprietariosFora[0].id, /^[0-9a-f-]{36}$/, 'o id nasce no servidor');
    assert.deepEqual(d.ownerShares, { [A.id]: 100 });
    assert.equal(d.quotasHist, undefined, 'sem data, confirmar o irmão vale para trás: estava por confirmar, não mudou');
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM share_proposals').first()).n, 0, 'não fica proposta pendente');
    limpar(app);
    const p = imovelDoCliente(app, d, [A.id]);
    igual(app.quotasFiscais(p, '2026-06-01'), { [A.id]: 0.5 });
    igual(app.quotasForaNaData(p, '2026-06-01'), [{ nome: 'Irmão', quota: 50 }]);
    assert.equal(app.quotasForaConfirmados(p, '2026-06-01'), true);
  });

  test('com data, o que estava por confirmar fica assim até à véspera', async () => {
    relogio('2026-11-17T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1');
    assert.equal((await propor(env, A, 'H1', { fora: [{ nome: 'Irmão', quota: 50 }], desde: '2026-07-01' })).applied, true);
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.quotasHist, [{ ate: '2026-06-30', ownerIds: [A.id], ownerShares: {}, fora: null }]);
    limpar(app);
    const p = imovelDoCliente(app, d, [A.id]);
    assert.equal(app.quotasForaConfirmados(p, '2026-06-30'), false);
    assert.equal(app.quotasFiscais(p, '2026-06-30')[A.id], 1);
    assert.equal(app.quotasFiscais(p, '2026-07-01')[A.id], 0.5);
  });

  test('o Anexo A (c1): 12 rendas de 800 € e o IMI de 300 € com o irmão a 50 % dão 4 800 € e 150 € à Ana', async () => {
    limpar(app);
    app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
    const p = app.normProp({ id: 'c1', name: 'T2', ownerIds: ['ana'], comproprietariosFora: [{ id: 'f1', nome: 'Irmão', quota: 50 }] });
    const q = app.quotasFiscais(p, '2026-04-01').ana;
    assert.equal(12 * 800 * q, 4800);
    assert.equal(300 * q, 150);
    p.comproprietariosFora = null;
    assert.equal(app.quotasFiscais(p, '2026-04-01').ana, 1, 'por confirmar: a casa toda (o aviso é da Declaração)');
    assert.equal(app.quotasForaConfirmados(p), false);
    igual(app.quotasForaNaData(p), []);
  });

  test('«Só eu» ([]) confirma sem abrir período; a mudança dos de fora com data abre', async () => {
    relogio('2026-11-17T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1');
    assert.equal((await propor(env, A, 'H1', { fora: [] })).applied, true, 'com um dono só, o shares pode faltar');
    let d = await dadosDa(env, 'H1');
    assert.deepEqual(d.comproprietariosFora, []);
    assert.equal(d.quotasHist, undefined, 'por confirmar → só eu não muda o imposto de ninguém');
    assert.equal((await propor(env, A, 'H1', { fora: [{ nome: 'Irmão', quota: 50 }], desde: '2026-07-01' })).applied, true);
    d = await dadosDa(env, 'H1');
    assert.deepEqual(d.quotasHist, [{ ate: '2026-06-30', ownerIds: [A.id], ownerShares: { [A.id]: 100 }, fora: [] }]);
    limpar(app);
    const p = imovelDoCliente(app, d, [A.id]);
    assert.equal(app.quotasFiscais(p, '2026-06-30')[A.id], 1);
    assert.equal(app.quotasFiscais(p, '2026-07-01')[A.id], 0.5);
    igual(app.quotasForaNaData(p, '2026-06-30'), [], 'antes, ninguém de fora');
    assert.equal(app.quotasForaConfirmados(p, '2026-06-30'), true, '— e confirmado');
    igual(app.quotasMudaramNoAno(p, 2026), ['2026-07-01']);
  });

  test('com várias contas os de fora vão na proposta e esperam pelo sim de todos; sem fora, ficam', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 }, fora: [{ nome: 'Carla', quota: 20 }] })).applied, false);
    assert.equal((await dadosDa(env, 'H1')).comproprietariosFora, undefined, 'ainda não');
    assert.equal((await aceitarP(env, B, 'H1')).applied, true);
    let d = await dadosDa(env, 'H1');
    assert.equal(d.comproprietariosFora[0].quota, 20);
    limpar(app);
    igual(app.quotasFiscais(imovelDoCliente(app, d, [A.id, B.id]), ''), { [A.id]: 0.4, [B.id]: 0.4 }, '50 % de 80 %');
    // uma proposta só de percentagens (um cliente antigo) não toca nos de fora
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 60, [B.id]: 40 } })).status, 201);
    assert.equal((await aceitarP(env, B, 'H1')).applied, true);
    d = await dadosDa(env, 'H1');
    assert.equal(d.comproprietariosFora[0].nome, 'Carla');
  });

  test('os de fora com lixo, quota fora de (0, 100) ou a somar 100 são recusados', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1');
    const frase = 'Cada comproprietário de fora precisa de um nome e de uma quota entre 0 e 100.';
    for (const fora of [[{ nome: '', quota: 10 }], [{ nome: 'X', quota: 0 }], [{ nome: 'X', quota: 100 }], [{ nome: 'X', quota: 'abc' }], [null]]) {
      assert.deepEqual(await propor(env, A, 'H1', { fora }), { status: 400, error: frase }, JSON.stringify(fora));
    }
    assert.deepEqual(await propor(env, A, 'H1', { fora: [{ nome: 'X', quota: 60 }, { nome: 'Y', quota: 40 }] }),
      { status: 400, error: 'As quotas dos comproprietários de fora têm de somar menos de 100.' });
    assert.equal((await propor(env, A, 'H1', { fora: 'Irmão' })).status, 400);
    assert.equal((await dadosDa(env, 'H1')).comproprietariosFora, undefined, 'nada se gravou');
  });

  test('apagar o imóvel e Anular: os de fora e o histórico voltam com ele', async () => {
    relogio('2026-11-17T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1', { name: 'T2' });
    await propor(env, A, 'H1', { fora: [] });
    assert.equal((await propor(env, A, 'H1', { fora: [{ nome: 'Irmão', quota: 50 }], desde: '2026-07-01' })).applied, true);
    const antes = await dadosDa(env, 'H1');
    assert.equal((await resp(pedir(env, A, '/api/houses/H1', 'DELETE'))).status, 200);
    const r = await resp(pedir(env, A, '/api/houses/H1', 'PUT', { data: { id: 'H1', name: 'T2', rooms: [], comproprietariosFora: null } }));
    assert.equal(r.status, 200, JSON.stringify(r));
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.comproprietariosFora, antes.comproprietariosFora, 'sem isto, o Anular punha a casa a 100 % da Ana');
    assert.deepEqual(d.quotasHist, antes.quotasHist);
    // uma casa nova com um id novo não herda nada de ninguém; os de fora que
    // traz, escritos por quem a cria, entram validados (N139)
    assert.equal((await resp(pedir(env, A, '/api/houses/H2', 'PUT', { data: { id: 'H2', name: 'T3', comproprietariosFora: [{ nome: 'X', quota: 10 }] } }))).status, 200);
    const h2 = (await dadosDa(env, 'H2')).comproprietariosFora;
    assert.deepEqual(h2.map((f) => [f.nome, f.quota]), [['X', 10]]);
    assert.equal((await dadosDa(env, 'H2')).ownerShares, undefined, 'as percentagens entre as contas nunca vêm do cliente');
  });

  test('passar o controlo do imóvel não mexe nas quotas nem fecha período', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 60, [B.id]: 40 }, fora: [{ nome: 'Irmão', quota: 10 }], desde: '2026-07-01' })).status, 201);
    assert.equal((await aceitarP(env, B, 'H1')).applied, true);
    const antes = await dadosDa(env, 'H1');
    const p = await resp(pedir(env, A, '/api/transfers', 'POST', { houseIds: ['H1'], toUserId: B.id }));
    assert.equal(p.status, 200, JSON.stringify(p));
    assert.equal((await resp(pedir(env, B, '/api/transfers/' + p.lote + '/accept', 'POST', {}))).status, 200);
    assert.equal((await env.DB.prepare('SELECT owner_id FROM houses WHERE id = ?').bind('H1').first()).owner_id, B.id, 'passou');
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.quotasHist, antes.quotasHist);
    assert.deepEqual(d.comproprietariosFora, antes.comproprietariosFora);
    assert.deepEqual(d.ownerShares, antes.ownerShares);
  });
});

/* ------------------------------ a soma (D93) ------------------------------ */

describe('a soma das percentagens (D93)', () => {
  test('50/49,6 é recusada; 33,33 × 3 acerta a última e soma 100', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno'), C = await conta(env, 'Carla');
    await casa(env, A, 'H1');
    await comproprietario(env, A, B, ['H1']);
    await comproprietario(env, A, C, ['H1']);
    assert.deepEqual(await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 49.6, [C.id]: 0 } }),
      { status: 400, error: 'As percentagens têm de somar 100.' });
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 33.33, [B.id]: 33.33, [C.id]: 33.33 } })).status, 201);
    const guardada = JSON.parse((await env.DB.prepare('SELECT shares FROM share_proposals').first()).shares);
    assert.deepEqual(guardada, { [A.id]: 33.33, [B.id]: 33.33, [C.id]: 33.34 });
    await aceitarP(env, B, 'H1');
    assert.equal((await aceitarP(env, C, 'H1')).applied, true);
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.ownerShares, { [A.id]: 33.33, [B.id]: 33.33, [C.id]: 33.34 });
    limpar(app);
    const q = app.quotasFiscais(imovelDoCliente(app, d, [A.id, B.id, C.id]), '');
    assert.ok(Math.abs(q[A.id] + q[B.id] + q[C.id] - 1) < 1e-12, 'as três somam a casa inteira');
  });

  test('acertarQuotas: a última leva o acerto; se ficasse negativa, a maior', () => {
    assert.deepEqual(acertarQuotas({ a: 33.3, b: 33.3, c: 33.3 }), { quotas: { a: 33.3, b: 33.3, c: 33.4 } });
    assert.deepEqual(acertarQuotas({ a: 50, b: 50 }), { quotas: { a: 50, b: 50 } });
    assert.deepEqual(acertarQuotas({ a: 100.04, b: 0 }), { quotas: { a: 100, b: 0 } });
    assert.deepEqual(acertarQuotas({ a: 50, b: 49.6 }), { erro: 'As percentagens têm de somar 100.' });
    assert.deepEqual(acertarQuotas({ a: -1, b: 101 }), { erro: 'Percentagens inválidas.' });
    assert.deepEqual(acertarQuotas({ a: null, b: 100 }), { erro: 'Percentagens inválidas.' });
  });
});

/* ------------------------------ o colaborador ------------------------------ */

describe('o colaborador não vê as quotas nem escreve os campos dos donos (D33, D52, D71)', () => {
  test('projetarCasa tira os de fora e o histórico, e deixa a afetação, a venda e o subarrendamento', () => {
    const data = {
      name: 'T2', ownerShares: { a: 100 }, comproprietariosFora: [{ id: 'f', nome: 'Irmão', quota: 50 }],
      quotasHist: [{ ate: '2026-06-30', ownerIds: ['a'], ownerShares: {}, fora: null }],
      afetacao: 'habitacao', vendido: '2026-09-01', subarrendamento: { ativo: false, nifSenhorio: '', rendaMensal: 0 },
    };
    const v = projetarCasa(data, new Set(['house.edit', 'report.view', 'loan.view', 'file.view']));
    assert.equal(v.comproprietariosFora, undefined);
    assert.equal(v.quotasHist, undefined);
    assert.equal(v.ownerShares, undefined);
    assert.equal(v.afetacao, 'habitacao', 'a afetação é dado registal');
    assert.equal(v.vendido, '2026-09-01');
    assert.ok(data.quotasHist, 'o original não muda');
  });

  test('fundirCasa e preserveOwnership: o que o colaborador manda nesses campos não entra', () => {
    const base = JSON.stringify({ name: 'T2', vendido: '', subarrendamento: { ativo: false }, comproprietariosFora: [], afetacao: '' });
    const f = fundirCasa(base, {
      name: 'T2 novo', vendido: '2026-01-01', subarrendamento: { ativo: true }, comproprietariosFora: null,
      quotasHist: [{ ate: '2020-01-01' }], afetacao: 'comercio',
    }, new Set(['house.edit']));
    assert.equal(f.name, 'T2 novo');
    assert.equal(f.afetacao, 'comercio', 'a afetação escreve-se com house.edit');
    assert.equal(f.vendido, '');
    assert.deepEqual(f.subarrendamento, { ativo: false });
    assert.deepEqual(f.comproprietariosFora, []);
    assert.equal(f.quotasHist, undefined);
    const dono = preserveOwnership(base, { name: 'X', comproprietariosFora: [{ nome: 'Y', quota: 1 }], quotasHist: [] });
    assert.deepEqual(dono.comproprietariosFora, [], 'nem o dono os escreve a gravar a ficha');
    assert.equal(dono.quotasHist, undefined);
  });

  test('pela API: o colaborador com house.edit não vê nem muda as quotas, a venda e o subarrendamento; o comproprietário muda a venda', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await doisDonos((a, b) => ({ [a.id]: 50, [b.id]: 50 }));
    const C = await conta(env, 'Contabilista');
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 }, fora: [{ nome: 'Irmão', quota: 20 }], desde: '2026-07-01' })).status, 201);
    assert.equal((await aceitarP(env, B, 'H1')).applied, true);
    const roleId = await cargo(env, A, 'Gestor', ['house.edit'], 'R1');
    await darCargo(env, A, C, roleId, ['H1']);
    const vista = (await estado(env, C)).houses.find((h) => h.id === 'H1').data;
    assert.equal(vista.comproprietariosFora, undefined, 'não vê os de fora');
    assert.equal(vista.quotasHist, undefined, 'nem o histórico');
    const antes = await dadosDa(env, 'H1');
    const put = await resp(pedir(env, C, '/api/houses/H1', 'PUT', { data: Object.assign({}, vista, {
      name: 'T2 Benfica (obras)', afetacao: 'habitacao', vendido: '2026-10-01',
      subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 500 },
      comproprietariosFora: [], quotasHist: [],
    }) }));
    assert.equal(put.status, 200, JSON.stringify(put));
    let d = await dadosDa(env, 'H1');
    assert.equal(d.name, 'T2 Benfica (obras)');
    assert.equal(d.afetacao, 'habitacao');
    assert.equal(d.vendido, undefined, 'a venda é do dono');
    assert.equal(d.subarrendamento, undefined, 'o subarrendamento também');
    assert.deepEqual(d.comproprietariosFora, antes.comproprietariosFora);
    assert.deepEqual(d.quotasHist, antes.quotasHist);
    // o comproprietário grava a venda; as quotas continuam só do caminho das propostas
    const meu = (await estado(env, B)).houses.find((h) => h.id === 'H1').data;
    assert.ok(meu.quotasHist, 'o comproprietário vê o histórico');
    assert.equal((await resp(pedir(env, B, '/api/houses/H1', 'PUT', { data: Object.assign({}, meu, {
      vendido: '2026-10-01', comproprietariosFora: [], quotasHist: [],
    }) }))).status, 200);
    d = await dadosDa(env, 'H1');
    assert.equal(d.vendido, '2026-10-01');
    assert.deepEqual(d.comproprietariosFora, antes.comproprietariosFora);
    assert.deepEqual(d.quotasHist, antes.quotasHist);
  });
});

/* ------------------------------ as funções puras ------------------------------ */

describe('as funções puras, no servidor e no cliente', () => {
  test('datas: véspera, válidas', () => {
    assert.equal(vesperaDe('2026-03-01'), '2026-02-28');
    assert.equal(vesperaDe('2024-03-01'), '2024-02-29');
    assert.equal(vesperaDe('2026-01-01'), '2025-12-31');
    assert.equal(vesperaDe('lixo'), '');
    assert.equal(diaValido('2026-02-29'), '');
    assert.equal(diaValido('1899-12-31'), '');
    assert.equal(diaValido('2026-12-31'), '2026-12-31');
  });

  test('validarFora: o id seguro fica, um repetido ou estranho é trocado', () => {
    let n = 0;
    const novo = () => 'novo' + (++n);
    const r = validarFora([{ id: 'f1', nome: 'A', quota: 10.005 }, { id: 'f1', nome: 'B', quota: 5 }, { id: '<x>', nome: 'C', quota: 1 }], novo);
    assert.deepEqual(r.fora.map((f) => f.id), ['f1', 'novo1', 'novo2']);
    assert.equal(r.fora[0].quota, 10.01, 'a 2 casas');
    assert.deepEqual(validarFora(null, novo), { fora: null });
    assert.deepEqual(validarFora([], novo), { fora: [] });
  });

  test('as frações do servidor são as do cliente (fracoesDasQuotas = quotasEntre)', () => {
    const casos = [
      [['a', 'b'], {}], [['a', 'b'], { a: 70 }], [['a', 'b', 'c'], { a: 50, b: 25 }], [['a'], { a: 50 }],
      [['a', 'b'], { a: 0, b: 0 }], [['a', 'b'], { a: 60, b: 60 }], [[], {}],
    ];
    for (const [ids, raw] of casos) igual(app.quotasEntre(ids, raw), fracoesDasQuotas(ids, raw), JSON.stringify([ids, raw]));
    assert.deepEqual(fracoesDasQuotas(['a', 'b'], { a: 70 }), { a: 0.7, b: 0.3 });
  });

  test('o histórico: o servidor (quotasComHistorico) e o cliente sem nuvem (quotasFecharPeriodo) dão o mesmo', () => {
    const S = (a, b, fora) => ({ ownerIds: ['a', 'b'], ownerShares: { a, b }, fora: fora === undefined ? null : fora });
    const casos = [
      { hist: [], antes: S(50, 50), novo: S(75, 25), desde: '2026-07-01' },
      { hist: [{ ate: '2026-06-30', ...S(50, 50) }], antes: S(75, 25), novo: S(100, 0), desde: '2027-01-01' },
      { hist: [{ ate: '2026-06-30', ...S(50, 50) }], antes: S(75, 25), novo: S(75, 25), desde: '2026-06-01' },
      { hist: [{ ate: '2026-02-28', ...S(50, 50) }, { ate: '2026-06-30', ...S(60, 40) }], antes: S(75, 25), novo: S(75, 25), desde: '2026-04-01' },
    ];
    for (const c of casos) {
      const servidor = quotasComHistorico(c.hist, c.antes, c.novo, c.desde);
      limpar(app);
      const p = app.normProp({ id: 'p', ownerIds: ['a', 'b'], quotasHist: JSON.parse(JSON.stringify(c.hist)) });
      app.quotasFecharPeriodo(p, c.antes, c.desde);
      // o cliente não sabe o estado novo: o último período igual ao novo só o servidor o tira
      const cliente = JSON.parse(JSON.stringify(p.quotasHist)).filter((e, i, l) => i < l.length - 1 || !quotasIguais(e, c.novo));
      assert.deepEqual(cliente, servidor, JSON.stringify(c));
    }
    assert.deepEqual(quotasComHistorico('lixo', S(1, 1), S(1, 1), '2026-01-01'), []);
    assert.deepEqual(quotasComHistorico([], S(50, 50), S(60, 40), 'lixo'), [], 'sem data não se fecha nada');
  });

  test('quotasMudaramNoAno: uma mudança a 1/1 vale o ano todo e não parte o ano; um período igual ao seguinte não conta', () => {
    limpar(app);
    ['a', 'b'].forEach((id) => app.db.owners.push(app.normPerson({ id, name: id })));
    const p = app.normProp({ id: 'p', ownerIds: ['a', 'b'], ownerShares: { a: 50, b: 50 }, quotasHist: [
      { ate: '2025-12-31', ownerIds: ['a', 'b'], ownerShares: { a: 100, b: 0 }, fora: null },
      { ate: '2026-03-31', ownerIds: ['a', 'b'], ownerShares: { a: 50, b: 50 }, fora: [] },
    ] });
    igual(app.quotasMudaramNoAno(p, 2026), [], 'a de 1/1 não parte o ano, e a de 1/4 não muda nada');
    igual(app.quotasMudaramNoAno(p, '2025'), []);
    igual(app.quotasMudaramNoAno(null, 2026), []);
    igual(app.quotasFiscais(p, '2025-06-01'), { a: 1, b: 0 });
  });

  test('estadoDasQuotas lê só os donos e as percentagens que contam', () => {
    assert.deepEqual(estadoDasQuotas({ ownerShares: { a: '50', b: -1, c: 10 }, comproprietariosFora: [{ nome: 'X', quota: 5 }, { nome: '', quota: 1 }] }, ['a', 'b']),
      { ownerIds: ['a', 'b'], ownerShares: { a: 50 }, fora: [{ id: '', nome: 'X', quota: 5 }] });
    assert.deepEqual(estadoDasQuotas(null), { ownerIds: [], ownerShares: {}, fora: null });
  });
});
