// Métricas: o peso de cada movimento na vista por proprietário, as amortizações à parte,
// o yield sobre o mesmo conjunto, o NOI anualizado, as receitas que não são rendimento,
// o IRS sobre rendas, a projeção e os acertos globais. (A data de hoje em hora
// local prova-se no numeros.test.js, com o relógio verdadeiro.)

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, perto, repor } from './arnes.js';

// a app vive num dia fixo: o NOI anualiza-se pelos meses que já passaram do
// ano, e o que o teste prova não pode mudar com o mês em que corre
const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
const ANO = Number(app.today().slice(0, 4));
const MES = Number(app.today().slice(5, 7));
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

  test('sem taxa escrita usa a sugestão do ano; 0 é o mesmo que em branco; escrita manda', () => {
    perto(app.netRent(app.normContract({ rent: 1000 }), 2025), 750, 0.01, '2025: 25 %');
    perto(app.netRent(app.normContract({ rent: 1000, taxRate: 0 }), 2025), 750);
    perto(app.netRent(app.normContract({ rent: 1000 })), 900, 0.01, 'sem ano é o corrente (2026): renda moderada, 10 %');
    perto(app.netRent(app.normContract({ rent: 1000, taxRate: 28 })), 720);
    perto(app.netRent(app.normContract({ rent: 1000, start: '2026-01-01', end: '2036-01-01' }), 2026), 900);
    assert.equal(app.taxRateOf(app.normContract({ rent: 1000, taxRate: 28 })), 28);
    perto(app.netRentOf({ id: 'nenhum' }), 0, 0.01, 'o map já não passa o índice como ano');
  });
});

describe('projeção', () => {
  beforeEach(() => {
    app.db.contracts.push(app.normContract({ propertyId: 'casa', rent: 1000, active: true, increase: 2 }));
  });

  /* A projeção somava a renda cheia a todos os anos do horizonte, sem olhar
     às datas de cada contrato: um que só começa em 2028 rendia já em 2026, e
     um que acaba em 2027 continuava a render em 2030. Relatado em uso, e
     medido nos dados de dev: três contratos começados a meio de 2026
     contavam doze meses, e o ano vinha 8 180 € acima do que devia. */
  test('a projeção conta só os meses em que cada contrato está em vigor', () => {
    assert.equal(app.mesesEmVigor({}, ANO), 12, 'sem datas, o ano inteiro');
    assert.equal(app.mesesEmVigor({ start: (ANO - 3) + '-01-01' }, ANO), 12, 'já começado');
    assert.equal(app.mesesEmVigor({ start: (ANO + 2) + '-01-01' }, ANO), 0, 'ainda não começou');
    assert.equal(app.mesesEmVigor({ start: ANO + '-07-01' }, ANO), 6, 'começa a meio: meio ano');
    assert.equal(app.mesesEmVigor({ start: ANO + '-09-01' }, ANO), 4);
    assert.equal(app.mesesEmVigor({ end: (ANO - 1) + '-12-31' }, ANO), 0, 'já acabou');
    assert.equal(app.mesesEmVigor({ end: ANO + '-06-30' }, ANO), 6, 'acaba a meio');
    assert.equal(app.mesesEmVigor({ start: ANO + '-04-01', end: ANO + '-09-30' }, ANO), 6, 'começa e acaba no mesmo ano');

    // e na projeção a sério: um contrato que só começa daqui a dois anos
    app.db.contracts = [app.normContract({
      propertyId: 'casa', rent: 1000, active: true, increase: 0, start: (ANO + 2) + '-01-01',
    })];
    const r = app.projRows(null);
    perto(r.rows[0].rent, 0, 0.001);
    perto(r.rows[1].rent, 0, 0.001);
    perto(r.rows[2].rent, 12000, 0.001);
    // o aumento conta a partir do ano em que começa, não desde hoje
    app.db.contracts = [app.normContract({
      propertyId: 'casa', rent: 1000, active: true, increase: 10, start: (ANO + 2) + '-01-01',
    })];
    const g = app.projRows(null);
    perto(g.rows[2].rent, 12000, 0.001, 'no primeiro ano do contrato ainda não houve aumento');
    perto(g.rows[3].rent, 13200, 0.001);
  });

  /* As despesas da projeção eram o histórico (o último ano completo, ou o
     corrente anualizado). Passaram a ser os planeados de despesa levados ao
     ano: o que está marcado para se repetir, e não o que se gastou. */
  test('as despesas partem dos planeados, não do histórico', () => {
    mov({ amount: 2400, propertyId: 'casa', date: (ANO - 1) + '-06-01' });
    mov({ amount: 300, propertyId: 'casa', date: ANO + '-02-01' });
    let r = app.projRows(null);
    assert.equal(r.rows[0].exp, 0, 'o histórico não projeta despesa nenhuma');
    assert.equal(r.base.n, 0);
    perto(r.base.fora, 2400, 0.001, 'o que se gastou no último ano completo diz-se, de fora');
    assert.equal(r.base.foraAno, ANO - 1);
    app.db.recurring.push(app.normRec({ name: 'Seguro', every: 'month', next: ANO + '-10-01', tx: { kind: 'expense', amount: 100, propertyId: 'casa', category: 'Seguros' } }));
    r = app.projRows(null);
    perto(r.rows[0].exp, 1200);
    assert.equal(r.base.n, 1);
    perto(r.rows[1].exp, 1200 * 1.02, 0.001);
    perto(r.rows[1].rent, 12000 * 1.02, 0.001);
  });

  test('o IRS é a renda de cada contrato à taxa dele no ano de cada coluna, contado no ano das rendas', () => {
    // 1000 €/mês está dentro das rendas moderadas: 10 % de 2026 a 2029 (EBF art. 45.º-C), 25 % depois
    app.db.settings.years = 5;
    const r = app.projRows(null);
    assert.equal(ANO, 2026);
    perto(r.rows[0].irs, 12000 * 0.10, 1e-9, 'sem fim e renda moderada: 10 %');
    perto(r.rows[1].irs, 12000 * 1.02 * 0.10, 1e-6, 'anda com o aumento');
    perto(r.rows[4].irs, 12000 * Math.pow(1.02, 4) * 0.25, 1e-6, 'em 2030 a taxa moderada acabou: 25 %');
    perto(r.rows[0].cf, r.rows[0].rent - r.rows[0].irs - r.rows[0].exp - r.rows[0].loan, 1e-9);
    app.db.contracts[0].taxRate = 28;
    perto(app.projRows(null).rows[0].irs, 12000 * 0.28, 1e-9, 'a taxa escrita manda');
    app.db.contracts[0].taxRate = 0;
    app.db.contracts[0].rent = 2500;
    perto(app.projRows(null).rows[0].irs, 30000 * 0.25, 1e-9, 'acima de 2 300 € por mês, sem fim: 25 %');
  });

  test('as prestações param quando o crédito acaba', () => {
    casa.loans = [app.normLoan({ id: 'l1', outstanding: 1000, years: 1, rate: 3 })];
    app.db.settings.years = 3;
    const r = app.projRows('casa');
    assert.ok(r.rows[0].loan > 0);
    assert.equal(r.rows[1].loan, 0);
    perto(r.debtY[0], 0);
    assert.equal(r.rows.length, 3);
    perto(r.rows[0].cf, r.rows[0].rent - r.rows[0].irs - r.rows[0].exp - r.rows[0].loan, 1e-9);
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

  test('um acerto num imóvel conta mesmo com um só dono ou entre quem não é dono', () => {
    mov({ amount: 1000, groupId: 'G', paidBy: 'ana' });
    const alvos = app.settleTargets(null);
    assert.ok(alvos.some((x) => x.pid === 'casa2'), 'a dívida da casa2 (dono único) entra no plano');
    alvos.forEach((x) => x.plan.forEach((y) => mov({ kind: 'settle', amount: y.amount, propertyId: x.pid, paidBy: y.from, toId: y.to })));
    const b = app.ownerBalances(null);
    Object.keys(b).forEach((k) => perto(b[k], 0, 0.005));
    const c2 = app.ownerBalances('casa2');
    Object.keys(c2).forEach((k) => perto(c2[k], 0, 0.005));
    assert.equal(app.settleTargets(null).length, 0, 'depois de pagar, nada fica por pagar');
    assert.ok(app.balanceLines('casa2').some((l) => l.t.kind === 'settle'), 'o acerto aparece em «como se chega aos saldos»');
    // o acerto gravado continua editável: quem lá está fica, mesmo sem ser dono do imóvel
    app.tForm = app.normTx({ kind: 'settle', amount: 500, propertyId: 'casa2', paidBy: 'carla', toId: 'ana' });
    app.prefill();
    assert.equal(app.tForm.toId, 'ana');
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