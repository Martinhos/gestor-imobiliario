// Métricas: o peso de cada movimento na vista por proprietário, as amortizações à parte,
// o yield sobre o mesmo conjunto, o NOI anualizado, as receitas que não são rendimento,
// o IRS sobre rendas, a projeção, os acertos globais e a data de hoje em hora local.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual } from './arnes.js';

const app = carregarApp();
const perto = (a, b, tol = 0.01) =>
  assert.ok(Math.abs(a - b) <= tol, `esperava ${b} (±${tol}), veio ${a}`);
const ANO = new Date().getFullYear();
const MES = new Date().getMonth() + 1;
const soma = (a) => a.reduce((x, y) => x + y, 0);

let casa, casa2;
beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }), app.normPerson({ id: 'carla', name: 'Carla' }));
  casa = app.normProp({ id: 'casa', name: 'Casa', value: 200000, purchase: 150000, ownerIds: ['ana', 'bruno'] });
  casa2 = app.normProp({ id: 'casa2', name: 'Casa 2', value: 100000, ownerIds: ['carla'] });
  app.db.properties.push(casa, casa2);
  app.db.groups.push(app.normGroup({ id: 'G', name: 'Grupo', kind: 'prop', ids: ['casa', 'casa2'] }));
});
const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ kind: 'expense', amount: 100, date: ANO + '-03-15' }, extra)));

describe('pesos na vista por proprietário', () => {
  test('movimento de grupo entra na quota do dono filtrado', () => {
    mov({ amount: 1000, groupId: 'G' });          // 500 por casa; a Ana tem metade da casa
    app.ownerFilter = 'ana';
    perto(app.metrics(ANO, null, { share: true }).op, 250);
    perto(soma(app.monthly(ANO, null, 'expense', true)), 250);
    perto(app.byCategory(ANO, null, true)[0].value, 250);
  });

  test('grupo em foco não puxa imóveis de outros donos', () => {
    mov({ amount: 1000, groupId: 'G' });
    app.ownerFilter = 'ana';
    const m = app.metrics(ANO, 'g:G', { share: true });
    perto(m.op, 250);
    assert.equal(m.value, 100000, 'só a quota da Ana na casa; a casa 2 é da Carla');
    igual(app.pidProps('g:G').map((p) => p.id), ['casa']);
  });

  test('divisão própria do movimento manda dentro do grupo', () => {
    mov({ amount: 1000, groupId: 'G', split: { mode: 'pct', parts: { ana: 100 } } });
    app.ownerFilter = 'ana';
    perto(app.metrics(ANO, null, { share: true }).op, 500);
    app.ownerFilter = 'bruno';
    perto(app.metrics(ANO, null, { share: true }).op, 0);
  });

  test('metrics e monthly batem certo em todas as combinações', () => {
    mov({ kind: 'income', amount: 1000, propertyId: 'casa', date: ANO + '-02-10' });
    mov({ kind: 'income', amount: 600, groupId: 'G', date: ANO + '-04-10' });
    mov({ kind: 'income', amount: 300, date: ANO + '-05-10' });   // sem imóvel nem grupo
    for (const of of ['', 'ana']) for (const pid of [null, 'casa', 'g:G']) {
      app.ownerFilter = of;
      perto(soma(app.monthly(ANO, pid, 'income', true)), app.metrics(ANO, pid, { share: true }).income, 0.001);
    }
    app.ownerFilter = '';
    perto(app.metrics(ANO, null, { share: true }).income, 1900, 0.001);
    app.ownerFilter = 'ana';
    perto(app.metrics(ANO, null, { share: true }).income, 650, 0.001);   // 500 da casa + 150 do grupo; o global fica de fora
  });

  test('sem filtro, os totais não mudam com o refactor', () => {
    mov({ amount: 100, propertyId: 'casa' });
    mov({ amount: 200, groupId: 'G' });
    mov({ amount: 50 });
    perto(app.metrics(ANO, null, {}).op, 350);
    perto(app.metrics(ANO, 'casa', {}).op, 200);
    perto(app.metrics(ANO, 'g:G', {}).op, 300);
  });
});

describe('prestações e amortizações', () => {
  test('amortização antecipada não é prestação, mas sai do cashflow', () => {
    mov({ kind: 'income', amount: 12000, propertyId: 'casa', date: ANO + '-01-05' });
    mov({ kind: 'expense', amount: 2000, propertyId: 'casa', date: ANO + '-02-05' });
    mov({ kind: 'loan', amount: 600, propertyId: 'casa', payType: 'prestacao', date: ANO + '-06-05' });
    mov({ kind: 'loan', amount: 30000, propertyId: 'casa', payType: 'amortizacao', date: ANO + '-06-20' });
    const m = app.metrics(ANO, 'casa', {});
    perto(m.loan, 600);
    perto(m.amort, 30000);
    perto(m.noi, 10000);
    perto(m.cf, 10000 - 600 - 30000);
    perto(m.coc, m.cf / 150000, 1e-9);
    perto(app.monthly(ANO, 'casa', 'loan')[5], 600, 0.001);
    perto(app.monthly(ANO, 'casa', 'amort')[5], 30000, 0.001);
  });
});

describe('yield bruto', () => {
  test('uso próprio com quarto arrendado entra nas duas bases', () => {
    casa2.use = 'proprio'; casa2.rentalMode = 'quartos'; casa2.rooms = [{ id: 'q1', name: 'Quarto' }];
    app.db.contracts.push(app.normContract({ propertyId: 'casa2', roomId: 'q1', rent: 400, active: true }));
    app.db.contracts.push(app.normContract({ propertyId: 'casa', rent: 1000, active: true }));
    const esperado = (1400 * 12) / 300000;
    perto(app.metrics(ANO, null, {}).grossYield, esperado, 1e-9);
    perto(app.evoRatio('grossYield', null).yearly[0].value, esperado, 1e-9);
  });

  test('sem imóveis arrendados o yield é «—»', () => {
    assert.equal(app.pct(app.metrics(ANO, 'casa', {}).grossYield), '—');
  });
});

describe('anos com dados e evolução', () => {
  test('grupo em foco vê os anos históricos', () => {
    mov({ kind: 'income', amount: 500, propertyId: 'casa', date: (ANO - 2) + '-05-01' });
    mov({ kind: 'income', amount: 500, propertyId: 'casa', date: (ANO - 1) + '-05-01' });
    mov({ kind: 'expense', amount: 80, groupId: 'G', date: (ANO - 3) + '-05-01' });
    igual(app.yearsWithData('g:G'), [ANO - 3, ANO - 2, ANO - 1, ANO]);
    igual(app.yearsWithData('casa'), [ANO - 3, ANO - 2, ANO - 1, ANO], 'o movimento de grupo pesa no imóvel');
    igual(app.yearsWithData('casa2'), [ANO - 3, ANO], 'as receitas da casa não pesam na casa 2');
    igual(app.yearsWithData(null), [ANO - 3, ANO - 2, ANO - 1, ANO]);
  });

  test('projeção de LTV para um grupo não é NaN', () => {
    const l = app.normLoan({ id: 'l1', outstanding: 100000, years: 30, rate: 3 });
    casa.loans = [l];
    const v = app.evoRatio('ltv', 'g:G').yearly[0].value;
    assert.ok(Number.isFinite(v));
    perto(v, app.amort(l, 12).rows[11].bal / 300000, 1e-9);
  });
});

describe('NOI anualizado e receitas fora do resultado', () => {
  test('o ano corrente anualiza-se pelos meses decorridos; os passados não', () => {
    for (let i = 1; i <= 8; i++) mov({ kind: 'income', amount: 1000, propertyId: 'casa', date: `${ANO}-0${i}-05` });
    mov({ kind: 'expense', amount: 1000, propertyId: 'casa', date: ANO + '-02-10' });
    const m = app.metrics(ANO, 'casa', {});
    perto(m.noi, 7000);
    perto(m.noiAnual, 7000 * 12 / MES, 1e-6);
    perto(m.cap, m.noiAnual / 200000, 1e-9);
    mov({ kind: 'income', amount: 12000, propertyId: 'casa', date: (ANO - 1) + '-01-05' });
    const p = app.metrics(ANO - 1, 'casa', {});
    perto(p.noiAnual, p.noi, 1e-9);
    assert.equal(app.anualFator(ANO - 1), 1);
    perto(app.anualFator(ANO), 12 / MES, 1e-9);
  });

  test('cauções e empréstimos recebidos não entram no resultado; reembolsos sim', () => {
    mov({ kind: 'income', amount: 8000, propertyId: 'casa', category: 'Rendas', sub: 'Renda mensal' });
    const antes = app.metrics(ANO, 'casa', {});
    mov({ kind: 'income', amount: 2000, propertyId: 'casa', category: 'Rendas', sub: 'Caução' });
    mov({ kind: 'income', amount: 10000, propertyId: 'casa', category: 'Empréstimos recebidos', sub: 'Família' });
    const depois = app.metrics(ANO, 'casa', {});
    perto(depois.income, antes.income);
    perto(depois.noi, antes.noi);
    perto(depois.cf, antes.cf);
    perto(soma(app.monthly(ANO, 'casa', 'income')), antes.income);
    mov({ kind: 'income', amount: 100, propertyId: 'casa', category: 'Reembolsos', sub: 'Seguro' });
    perto(app.metrics(ANO, 'casa', {}).income, antes.income + 100);
    assert.equal(app.countsInTotals(app.normTx({ kind: 'income', category: 'Rendas', sub: 'Caução' })), false);
  });
});

describe('IRS sobre rendas', () => {
  test('a taxa sugerida segue a duração do contrato', () => {
    const r = (start, end) => app.irsRate({ start, end });
    assert.equal(r('2026-01-01', '2028-01-01'), 25);
    assert.equal(r('2026-01-01', '2031-01-01'), 15);
    assert.equal(r('2026-01-01', '2030-12-31'), 15, 'o fim é inclusive: 1 jan a 31 dez são 5 anos');
    assert.equal(r('2026-01-01', '2030-12-30'), 25);
    assert.equal(r('2026-03-15', '2036-03-14'), 10);
    assert.equal(r('2026-01-01', '2046-01-01'), 5);
    assert.equal(r('2026-01-01', ''), 25, 'sem fim vale a taxa base');
    assert.equal(app.irsRate(null), 25);
  });

  test('sem taxa escrita usa a sugestão; 0 é o mesmo que em branco; escrita manda', () => {
    perto(app.netRent(app.normContract({ rent: 1000 })), 750);
    perto(app.netRent(app.normContract({ rent: 1000, taxRate: 0 })), 750);
    perto(app.netRent(app.normContract({ rent: 1000, taxRate: 28 })), 720);
    perto(app.netRent(app.normContract({ rent: 1000, start: '2026-01-01', end: '2036-01-01' })), 900);
    assert.equal(app.taxRateOf(app.normContract({ rent: 1000, taxRate: 28 })), 28);
  });
});

describe('projeção', () => {
  beforeEach(() => {
    app.db.contracts.push(app.normContract({ propertyId: 'casa', rent: 1000, active: true, increase: 2 }));
  });

  test('as despesas partem do último ano completo com despesas', () => {
    mov({ amount: 2400, propertyId: 'casa', date: (ANO - 1) + '-06-01' });
    mov({ amount: 300, propertyId: 'casa', date: ANO + '-02-01' });
    const r = app.projRows(null);
    perto(r.rows[0].exp, 2400);
    assert.equal(r.base.year, ANO - 1);
    assert.equal(r.base.anualizado, false);
    perto(r.rows[1].exp, 2400 * 1.02, 0.001);
    perto(r.rows[1].rent, 12000 * 1.02, 0.001);
  });

  test('um ano só com receitas não serve de base — vai-se ao anterior', () => {
    mov({ amount: 1800, propertyId: 'casa', date: (ANO - 2) + '-06-01' });
    mov({ kind: 'income', amount: 12000, propertyId: 'casa', date: (ANO - 1) + '-06-01' });
    const r = app.projRows(null);
    perto(r.rows[0].exp, 1800);
    assert.equal(r.base.year, ANO - 2);
  });

  test('sem ano completo, anualiza o ano corrente', () => {
    mov({ amount: 300, propertyId: 'casa', date: ANO + '-02-01' });
    const r = app.projRows(null);
    perto(r.rows[0].exp, 300 * 12 / MES, 1e-6);
    assert.equal(r.base.anualizado, true);
    assert.equal(r.base.year, ANO);
  });

  test('as prestações param quando o crédito acaba', () => {
    casa.loans = [app.normLoan({ id: 'l1', outstanding: 1000, years: 1, rate: 3 })];
    app.db.settings.years = 3;
    const r = app.projRows('casa');
    assert.ok(r.rows[0].loan > 0);
    assert.equal(r.rows[1].loan, 0);
    perto(r.debtY[0], 0);
    assert.equal(r.rows.length, 3);
    perto(r.rows[0].cf, r.rows[0].rent - r.rows[0].exp - r.rows[0].loan, 1e-9);
  });
});

describe('contas entre proprietários (grupo e global)', () => {
  test('despesa de grupo reparte-se por imóvel e por dono', () => {
    mov({ amount: 1000, groupId: 'G', paidBy: 'ana' });
    const b = app.ownerBalances(null);
    perto(b.ana, 750); perto(b.bruno, -250); perto(b.carla, -500);
    perto(soma(Object.values(b)), 0);
    const c2 = app.ownerBalances('casa2');
    perto(c2.ana, 500); perto(c2.carla, -500);
    igual(app.ownerBalances('g:G'), JSON.parse(JSON.stringify(b)), 'o grupo em foco tem os mesmos saldos');
  });

  test('movimento sem imóvel divide por todos os donos', () => {
    mov({ amount: 90, paidBy: 'ana' });
    const b = app.ownerBalances(null);
    perto(b.ana, 60); perto(b.bruno, -30); perto(b.carla, -30);
  });

  test('as dívidas globais são liquidáveis', () => {
    mov({ amount: 90, paidBy: 'ana' });
    mov({ amount: 100, propertyId: 'casa', paidBy: 'ana' });
    const alvos = app.settleTargets(null);
    igual(alvos.map((x) => [x.pid, x.name]), [['casa', 'Casa'], [null, 'Todos os imóveis']]);
    igual(alvos[0].plan, [{ from: 'bruno', to: 'ana', amount: 50 }]);
    igual(alvos[1].plan, [{ from: 'bruno', to: 'ana', amount: 30 }, { from: 'carla', to: 'ana', amount: 30 }]);
    igual(app.settleTargets('casa').map((x) => x.pid), ['casa'], 'num imóvel não há resto global');
    alvos.forEach((x) => x.plan.forEach((y) => mov({ kind: 'settle', amount: y.amount, propertyId: x.pid, paidBy: y.from, toId: y.to })));
    const b = app.ownerBalances(null);
    Object.keys(b).forEach((k) => perto(b[k], 0, 0.005));
    assert.equal(app.settleTargets(null).length, 0);
  });

  test('balanceLines e ownerBalances contam a mesma coisa', () => {
    mov({ amount: 1000, groupId: 'G', paidBy: 'ana' });
    mov({ amount: 90, paidBy: 'bruno' });
    mov({ kind: 'income', amount: 500, propertyId: 'casa', paidBy: 'bruno' });
    mov({ kind: 'settle', amount: 30, propertyId: null, paidBy: 'carla', toId: 'bruno' });
    const eff = {};
    app.balanceLines(null).forEach((l) => l.os.forEach((o) => { eff[o] = (eff[o] || 0) + (l.eff[o] || 0) / 100; }));
    const b = app.ownerBalances(null);
    igual(Object.keys(eff).sort(), Object.keys(b).sort());
    Object.keys(b).forEach((k) => perto(eff[k], b[k], 0.001));
  });
});

describe('a data de hoje', () => {
  test('é a data local, não a UTC', () => {
    const d = new Date();
    const local = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    assert.match(app.today(), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(app.today(), local);
  });
});
