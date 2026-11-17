// Confirmar um planeado regista o dinheiro no dia em que se confirma (ticket
// de QA e8ec9555, KAN-141). O movimento nascia com a data prevista (r.next):
// um planeado em atraso confirmado a 15 de novembro ficava com a data de
// outubro, e o registo do dinheiro mentia. Agora o «Confirmar» e o «Rever»
// (o valor inicial do formulário) usam o dia de hoje, para todos os tipos — a
// renda, a despesa, a prestação. A renda de um contrato guarda o mês a que
// respeita em periodo (o mês de r.next): a de outubro confirmada a 15 de
// novembro continua a ser a de outubro, para o cursor (rendaJaLancada) e para
// o IRS; a despesa e a prestação também o guardam, para o jaRegistado.
// O «Preencher N em falta» não é confirmar: fica com a data de cada mês.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const HOJE = '2026-11-15';
const app = carregarApp({ hoje: HOJE });
afterEach(() => repor(app));
const tudo = carregarTudo({ hoje: HOJE });
afterEach(() => repor(tudo));

/* Uma base com um imóvel meu, sem cargos, e as funções que pintam e gravam
   caladas.
   Recebe: a — o contexto.
   Devolve: nada. */
function monta(a) {
  limpar(a);
  a.definirServicosDesligados([]);
  if (a.CW) { a.CW.cargos = {}; a.CW.user = null; a.CW._fillQueue = []; }
  a.modalStack.length = 0;
  a.db.properties = [a.normProp({ id: 'P1', name: 'T2 Arroios' })];
  ['render', 'buildNav', 'save', 'toast', 'avisoComVer', 'refreshDetail'].forEach((n) => { a[n] = () => {}; });
}

/* Um contrato meu, sem rendas registadas, com o planeado da renda criado pela
   app (syncContractRec), em atraso desde 1 de outubro.
   Recebe: a — o contexto.
   Devolve: {c, r} — o contrato e o planeado da renda. */
function contrato(a) {
  const c = a.normContract({ id: 'C1', propertyId: 'P1', rent: 700, start: '2026-10-01', payDay: 1 });
  a.db.contracts = [c];
  a.syncContractRec(c);
  return { c, r: a.ctRecOf(c) };
}

/* Um planeado à mão no imóvel P1, em atraso.
   Recebe: a — o contexto; campos — o que muda no planeado.
   Devolve: o planeado, já em db.recurring. */
function planeado(a, campos) {
  const r = a.normRec(Object.assign({ id: 'R1', name: 'Limpeza', every: 'month', next: '2026-09-10',
    tx: { kind: 'expense', label: 'Limpeza', amount: 30, propertyId: 'P1' } }, campos));
  a.db.recurring.push(r);
  return r;
}

describe('«Confirmar» (sem rever): o movimento tem a data de hoje', () => {
  test('a renda de outubro confirmada a 15 de novembro: data de hoje, periodo de outubro, e o cursor segue', () => {
    monta(app);
    const { c, r } = contrato(app);
    assert.equal(r.next, '2026-10-01');
    app.quickConfirmRec(r.id);
    assert.equal(app.db.transactions.length, 1);
    const t = app.db.transactions[0];
    igual({ date: t.date, periodo: t.periodo, amount: t.amount, contractId: t.contractId },
      { date: HOJE, periodo: '2026-10', amount: 700, contractId: 'C1' });
    assert.equal(app.mesDaRenda(t), '2026-10', 'é a renda de outubro');
    assert.equal(app.ctRecOf(c).next, '2026-11-01', 'o cursor passa a novembro');
    assert.ok(app.rendaJaLancada(c, '2026-10-01'), 'outubro já está lançado');
    assert.ok(!app.rendaJaLancada(c, '2026-11-01'), 'novembro ainda não: a data de hoje não o tapa');
    app.quickConfirmRec(r.id);
    const t2 = app.db.transactions[1];
    igual({ date: t2.date, periodo: t2.periodo }, { date: HOJE, periodo: '2026-11' }, 'a de novembro, no mesmo dia, é a de novembro');
    assert.equal(app.ctRecOf(c).next, '2026-12-01');
  });

  test('um mês já lançado continua a ver-se pelo mês previsto: salta sem criar nada', () => {
    monta(app);
    const { c, r } = contrato(app);
    app.db.transactions.push(app.normTx({ id: 'T0', kind: 'income', amount: 700, propertyId: 'P1', contractId: 'C1',
      category: 'Rendas', date: '2026-11-03', periodo: '2026-10' }));
    let dito = '';
    app.toast = (m) => { dito = m; };
    app.quickConfirmRec(r.id);
    assert.equal(app.db.transactions.length, 1, 'não duplica a renda de outubro');
    assert.match(dito, /^Já havia a renda deste contrato de /);
    assert.equal(app.ctRecOf(c).next, '2026-11-01');
  });

  test('uma despesa à mão: a data de hoje, e o mês previsto no periodo', () => {
    monta(app);
    const r = planeado(app, {});
    app.quickConfirmRec(r.id);
    const t = app.db.transactions[0];
    igual({ date: t.date, periodo: t.periodo, label: t.label }, { date: HOJE, periodo: '2026-09', label: 'Limpeza' });
    assert.equal(r.next, '2026-10-10', 'o cursor avança como antes');
    assert.ok(app.jaRegistado(r, '2026-09-10'), 'setembro tem o movimento dele');
    assert.ok(!app.jaRegistado(r, '2026-11-10'), 'e novembro não: o «Preencher N em falta» continua a pedi-lo');
  });

  test('uma prestação de hipoteca: a data de hoje, e abate o capital', () => {
    monta(app);
    const l = app.normLoan({ id: 'L1', name: 'Aquisição', outstanding: 100000, years: 30, type: 'fixa', rate: 3, start: '2025-01-10' });
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Arroios', loans: [l] })];
    app.syncAllLoanRecs();
    const r = app.db.recurring.find((x) => x.tx.loanId === 'L1');
    r.next = '2026-10-10';
    app.quickConfirmRec(r.id);
    assert.equal(app.db.transactions.length, 1);
    const t = app.db.transactions[0];
    igual({ date: t.date, loanId: t.loanId, periodo: t.periodo }, { date: HOJE, loanId: 'L1', periodo: '2026-10' });
    assert.ok(app.findLoan(app.prop('P1'), 'L1').outstanding < 100000, 'abate capital');
    assert.equal(r.next, '2026-11-10');
  });
});

describe('«Rever»: o formulário abre com a data de hoje, e continua editável', () => {
  test('a renda: data de hoje e o mês da renda de outubro no campo; gravar regista assim', () => {
    monta(app);
    janelasFalsas(app);
    const { c, r } = contrato(app);
    app.confirmRec(r.id);
    assert.equal(app.txModo.modo, 'confirmar');
    igual({ date: app.tForm.date, periodo: app.tForm.periodo }, { date: HOJE, periodo: '2026-10' });
    assert.match(app.modalStack.at(-1).b, /id="t_periodo" type="month" value="2026-10"/, 'o mês vê-se e corrige-se no campo');
    app.collectTx = () => {};
    app.onSave();
    const t = app.db.transactions.at(-1);
    igual({ date: t.date, periodo: t.periodo }, { date: HOJE, periodo: '2026-10' });
    assert.equal(app.ctRecOf(c).next, '2026-11-01');
  });

  test('a data escolhida no formulário é a que fica', () => {
    monta(app);
    janelasFalsas(app);
    const r = planeado(app, {});
    app.confirmRec(r.id);
    igual({ date: app.tForm.date, periodo: app.tForm.periodo || '' }, { date: HOJE, periodo: '2026-09' }, 'o mês previsto vai com ele');
    app.collectTx = () => { app.tForm.date = '2026-11-02'; };
    app.onSave();
    assert.equal(app.db.transactions.at(-1).date, '2026-11-02');
    assert.equal(r.next, '2026-10-10');
  });
});

describe('o que não é confirmar fica como estava', () => {
  test('o recTx com uma data (a do «Preencher N em falta») usa essa data, e sem ela a prevista', () => {
    monta(app);
    const r = planeado(app, {});
    assert.equal(app.recTx(r, '2026-08-10').date, '2026-08-10');
    assert.equal(app.recTx(r).date, '2026-09-10');
  });

  test('o «Preencher N em falta» regista cada renda na data do seu mês', () => {
    monta(tudo);
    janelasFalsas(tudo);
    const { r } = contrato(tudo);
    tudo.CW.doFillMissed(r.id);
    igual(tudo.db.transactions.map((t) => t.date), ['2026-10-01', '2026-11-01']);
    assert.equal(tudo.ctRecOf(tudo.contract('C1')).next, '2026-12-01');
  });
});
