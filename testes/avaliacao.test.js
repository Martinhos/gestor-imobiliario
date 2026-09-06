// Avaliação: NOI anualizado, valor por rendimento, diferença sem valor de mercado,
// yield exigido, equity projetado, o relatório em texto e onde vive a rentabilidade.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual } from './arnes.js';

const app = carregarApp();
const perto = (a, b, tol = 0.01) =>
  assert.ok(Math.abs(a - b) <= tol, `esperava ${b} (±${tol}), veio ${a}`);
const ANO = new Date().getFullYear();
const MES = new Date().getMonth() + 1;

let p;
beforeEach(() => {
  limpar(app);
  app.repProp = '';
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  p = app.normProp({ id: 'v1', name: 'T2', value: 220000, purchase: 150000, ownerIds: ['ana', 'bruno'], ownerShares: { ana: 60, bruno: 40 } });
  app.db.properties.push(p);
});
const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ kind: 'income', amount: 1000, propertyId: 'v1', date: ANO + '-03-05' }, extra)));
const oitoRendas = () => {
  for (let i = 1; i <= 8; i++) mov({ date: `${ANO}-0${i}-05` });
  mov({ kind: 'expense', amount: 1000, date: ANO + '-02-10' });
};

describe('avaliação por rendimento', () => {
  test('anualiza o ano corrente e os cartões e o relatório mostram o mesmo valor', () => {
    oitoRendas();
    const m = app.metrics(ANO, 'v1', {});
    perto(m.noiAnual, 7000 * 12 / MES, 1e-6);
    const { valuation, diff } = app.valuationOf(m.noiAnual, 220000);
    perto(valuation, m.noiAnual / 0.05, 1e-6);
    perto(diff, valuation / 220000 - 1, 1e-9);
    const v = app.euro(valuation);
    assert.ok(app.repCard(p).includes(v), 'o cartão do imóvel');
    assert.ok(app.portCard(null).includes(v), 'o cartão do portefólio');
    assert.ok(app.reportText().includes(v), 'o relatório em texto');
  });

  test('anos completos usam o NOI real', () => {
    for (let i = 1; i <= 12; i++) mov({ date: `${ANO - 1}-${String(i).padStart(2, '0')}-05` });
    mov({ kind: 'expense', amount: 1000, date: (ANO - 1) + '-06-10' });
    const y = app.evoValuation(p, 'val').yearly.find((x) => x.label === ANO - 1);
    perto(y.value, 11000 / 0.05);
    const d = app.evoValuation(p, 'diff').yearly.find((x) => x.label === ANO - 1);
    perto(d.value, 0, 1e-9);
  });

  test('cauções e empréstimos recebidos não entram no NOI', () => {
    oitoRendas();
    const antes = app.metrics(ANO, 'v1', {}).noiAnual;
    mov({ amount: 2000, category: 'Rendas', sub: 'Caução' });
    mov({ amount: 10000, category: 'Empréstimos recebidos', sub: 'Família' });
    perto(app.metrics(ANO, 'v1', {}).noiAnual, antes, 1e-9);
  });

  test('o yield exigido não aceita zero nem negativo', () => {
    app.render = () => {};
    app.capTargetSet('-5');
    assert.equal(app.db.settings.capTarget, 0.1);
    app.capTargetSet('');
    assert.equal(app.db.settings.capTarget, 5);
    app.capTargetSet('0');
    assert.equal(app.db.settings.capTarget, 5);
    app.capTargetSet('6,5');
    assert.equal(app.db.settings.capTarget, 6.5);
    app.db.settings.capTarget = -5;      // dados antigos
    perto(app.capTargetFrac(), 0.001, 1e-12);
    assert.ok(app.valuationOf(11000, 220000).valuation > 0);
  });

  test('sem valor de mercado a diferença é «—», sem cor nem juízo', () => {
    assert.ok(Number.isNaN(app.valuationOf(11000, 0).diff));
    igual(app.diffKpi(NaN), { v: '—', c: '', f: 'sem valor de mercado' });
    igual(app.diffKpi(0.05), { v: '+5,0%', c: 'pos', f: 'as rendas justificam mais' });
    assert.equal(app.diffKpi(-0.1).c, 'neg');
    p.value = 0;
    oitoRendas();
    const html = app.repCard(p);
    assert.match(html, /sem valor de mercado/);
    assert.doesNotMatch(html, /\+0,0%/);
  });

  test('o equity projetado bate com o plano da hipoteca', () => {
    const l = app.normLoan({ id: 'l1', outstanding: 100000, years: 30, rate: 3 });
    p.loans = [l];
    p.value = 200000;
    const e = app.evoValuation(p, 'equity').yearly[0];
    perto(e.value, 200000 - app.amort(l, 12).rows[11].bal);
    assert.equal(app.debtOf(p), 100000);
    perto(app.payOf(p), 431.6, 0.01);
  });

  test('debtOf e payOf ignoram hipotecas liquidadas', () => {
    const viva = app.normLoan({ id: 'l2', outstanding: 50000, years: 20, rate: 3 });
    p.loans = [app.normLoan({ id: 'l1', outstanding: 0, years: 30, rate: 3 }), viva];
    assert.equal(app.debtOf(p), 50000);
    perto(app.payOf(p), app.loanCalc(viva).total, 1e-9);
  });
});

describe('o relatório em texto', () => {
  test('usa os mesmos números que os cartões, na quota do proprietário filtrado', () => {
    app.db.contracts.push(app.normContract({ propertyId: 'v1', rent: 1000, active: true }));
    oitoRendas();
    app.ownerFilter = 'ana';
    const t = app.reportText();
    assert.ok(t.includes('Renda contratada ' + app.euro(600) + '/mês'), 'cabeçalho a 60 %');
    assert.ok(t.includes('Renda ' + app.euro(600) + '/mês'), 'bloco do imóvel a 60 %');
    assert.ok(t.includes('Valor ' + app.euro(132000)), 'valor de mercado a 60 %');
    assert.ok(t.includes('quota-parte 60%'));
    const m = app.metrics(ANO, 'v1', { share: true });
    assert.ok(t.includes('avaliação por rendimento ' + app.euro(app.valuationOf(m.noiAnual, m.value).valuation)));
    assert.match(t, /sobre a aquisição/);
    assert.doesNotMatch(t, /cash-on-cash/);
    assert.match(t, /Valor por rendimento .* · diferença/);
    assert.ok(app.repCard(p).includes(app.euro(132000)), 'o cartão do imóvel também entra na quota');
  });
});

describe('onde vive a rentabilidade', () => {
  test('saiu da visão geral', () => {
    oitoRendas();
    const html = app.vDashboard();
    assert.doesNotMatch(html, /Rentabilidade|Yield bruto|Cap rate|Sobre a aquisição|>LTV</);
    assert.match(html, /Cashflow/, 'os KPIs do ano ficam');
    assert.match(html, /Renda líquida de impostos \(estim\.\)/);
  });

  test('a avaliação mostra os quatro rácios como KPI com explicação e evolução', () => {
    oitoRendas();
    const html = app.vReports();
    for (const r of ['Yield bruto', 'Cap rate', 'Sobre a aquisição', 'LTV']) {
      assert.ok((html.match(new RegExp('class="label">' + r + '<', 'g')) || []).length >= 2, r + ' no portefólio e no imóvel');
    }
    assert.ok((html.match(/class="card kpi evo"/g) || []).length >= 8, 'oito KPIs com evolução (4+4)');
    assert.doesNotMatch(html, /Yield líquido \(cap rate\)/);
    assert.match(html, /Renda anual contratada/);
    assert.match(html, /anualizado/);
  });

  test('evoRatio aceita o âmbito todo, um imóvel e um grupo', () => {
    p.loans = [app.normLoan({ id: 'l1', outstanding: 100000, years: 30, rate: 3 })];
    app.db.groups.push(app.normGroup({ id: 'G', name: 'Grupo', kind: 'prop', ids: ['v1'] }));
    const todo = app.evoRatio('ltv', null), um = app.evoRatio('ltv', 'v1'), g = app.evoRatio('ltv', 'g:G');
    assert.ok(todo.yearly.length >= 2 && Number.isFinite(todo.yearly[0].value));
    const vals = (d) => JSON.parse(JSON.stringify(d.yearly.map((y) => y.value)));
    igual(vals(todo), vals(um), 'com um só imóvel, o âmbito é o imóvel');
    igual(vals(g), vals(um), 'o grupo já não dá NaN');
    assert.equal(typeof app.rentGrid, 'function');
  });

  test('a amortização antecipada aparece à parte', () => {
    oitoRendas();
    mov({ kind: 'loan', amount: 600, payType: 'prestacao', date: ANO + '-04-05' });
    mov({ kind: 'loan', amount: 30000, payType: 'amortizacao', date: ANO + '-04-20' });
    assert.match(app.repCard(p), /Amortizações antecipadas/);
    assert.ok(app.vDashboard().includes('+' + app.euro(30000) + ' amortizados'));
    assert.ok(app.vDashboard().includes('>' + app.euro(600) + '<'), 'as prestações não levam a amortização');
  });
});
