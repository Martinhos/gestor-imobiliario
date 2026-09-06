// Crédito à habitação: prestações, plano de amortização e comissões.
// É a matemática que decide números que vão parar ao IRS de alguém.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar } from './arnes.js';

const app = carregarApp();
const perto = (a, b, tol = 0.01) =>
  assert.ok(Math.abs(a - b) <= tol, `esperava ${b} (±${tol}), veio ${a}`);

beforeEach(() => limpar(app));

const fixa = (extra = {}) => Object.assign({
  id: 'l1', outstanding: 100000, years: 30, type: 'fixa', rate: 3, stampTax: true,
}, extra);

describe('prestação mensal', () => {
  test('segue a fórmula francesa', () => {
    // 100 000 € a 3% em 30 anos: 421,60 € de capital+juros
    const c = app.loanCalc(fixa());
    perto(c.base, 421.60, 0.05);
  });

  test('o imposto do selo entra por cima dos juros', () => {
    const com = app.loanCalc(fixa({ stampTax: true }));
    const sem = app.loanCalc(fixa({ stampTax: false }));
    perto(sem.stamp, 0);
    perto(com.stamp, com.interest * 0.04);
    perto(com.total, com.base + com.stamp);
    perto(sem.total, sem.base);
  });

  test('o primeiro mês é quase todo juros', () => {
    const c = app.loanCalc(fixa());
    perto(c.interest, 100000 * 0.03 / 12);   // 250 €
    perto(c.principal, c.base - c.interest);
    assert.ok(c.interest > c.principal, 'no início os juros pesam mais que o capital');
  });

  test('taxa a zero divide o capital pelos meses', () => {
    const c = app.loanCalc(fixa({ rate: 0 }));
    perto(c.base, 100000 / 360);
    perto(c.interest, 0);
  });

  test('prazo mais curto sobe a prestação', () => {
    const curto = app.loanCalc(fixa({ years: 15 })).base;
    const longo = app.loanCalc(fixa({ years: 30 })).base;
    assert.ok(curto > longo, 'quinze anos custa mais por mês do que trinta');
  });
});

describe('taxa aplicada em cada mês', () => {
  test('fixa não muda', () => {
    const l = fixa({ rate: 3.5 });
    assert.equal(app.rateAt(l, 0), 3.5);
    assert.equal(app.rateAt(l, 200), 3.5);
  });

  test('variável é o indexante mais o spread', () => {
    const l = fixa({ type: 'variavel', euribor: 2.1, spread: 1 });
    perto(app.rateAt(l, 0), 3.1);
    perto(app.rateAt(l, 300), 3.1);
  });

  test('mista troca de taxa no fim da fase fixa', () => {
    const l = fixa({ type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1 });
    assert.equal(app.rateAt(l, 0), 2);
    assert.equal(app.rateAt(l, 59), 2);      // último mês da fase fixa
    assert.equal(app.rateAt(l, 60), 4);      // primeiro da variável
  });
});

describe('plano de amortização', () => {
  test('a dívida chega a zero no fim do prazo', () => {
    const a = app.amort(fixa());
    assert.equal(a.rows.length, 360);
    perto(a.rows[359].bal, 0, 0.5);
  });

  test('o capital cresce e os juros descem ao longo do tempo', () => {
    const a = app.amort(fixa());
    assert.ok(a.rows[0].cap < a.rows[359].cap, 'o capital amortizado cresce');
    assert.ok(a.rows[0].int > a.rows[359].int, 'os juros descem');
  });

  test('a soma do capital devolve o empréstimo', () => {
    const a = app.amort(fixa());
    const capital = a.rows.reduce((t, r) => t + r.cap, 0);
    perto(capital, 100000, 1);
  });

  test('o custo total são juros mais selo', () => {
    const l = fixa();
    const a = app.amort(l);
    perto(app.loanCost(l), a.totInt + a.totStamp, 0.5);
    // a 3% em 30 anos pagam-se cerca de 51 800 € de juros
    assert.ok(a.totInt > 50000 && a.totInt < 54000, 'juros totais na ordem esperada: ' + a.totInt);
  });

  test('maxMonths corta o plano sem alterar as contas', () => {
    const a = app.amort(fixa(), 12);
    assert.equal(a.rows.length, 12);
    perto(a.rows[0].pay, app.loanCalc(fixa()).base, 0.05);
  });

  test('prestações já registadas encurtam o prazo restante', () => {
    const l = fixa();
    const p = app.normProp({ id: 'p1', name: 'Casa', loans: [l] });
    app.db.properties.push(p);
    for (let i = 0; i < 12; i++) {
      app.db.transactions.push(app.normTx({
        kind: 'loan', loanId: 'l1', payType: 'prestacao', amount: 431.6, date: '2025-01-01',
      }));
    }
    assert.equal(app.amort(l).n, 348, 'trinta anos menos doze prestações');
  });

  test('amortizações antecipadas não encurtam o prazo', () => {
    const l = fixa();
    app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', loans: [l] }));
    app.db.transactions.push(app.normTx({
      kind: 'loan', loanId: 'l1', payType: 'amortizacao', amount: 5000, date: '2025-01-01',
    }));
    assert.equal(app.amort(l).n, 360);
  });

  test('a mista recalcula a prestação com o prazo restante quando a taxa muda', () => {
    const a = app.amort(fixa({ outstanding: 150000, type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1 }));
    perto(a.rows[0].pay, 554.43, 0.05);
    perto(a.rows[59].bal, 130806.54, 1);
    perto(a.rows[60].pay, 690.45, 0.1);
    perto(a.rows[359].bal, 0, 0.5);
  });

  test('a taxa devolvida por loanCalc é a do mês em que se está', () => {
    const l = fixa({ type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1 });
    app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', loans: [l] }));
    assert.equal(app.loanCalc(l).rate, 2);
    for (let i = 0; i < 72; i++) app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'l1', amount: 500, date: '2025-01-01' }));
    assert.equal(app.loanCalc(l).rate, 4);
    assert.equal(app.amort(l).rows[0].rate, 4);
  });

  test('prazo esgotado pelas registadas: fica um mês e avisa', () => {
    const l = fixa({ years: 1, outstanding: 5000 });
    app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', loans: [l] }));
    for (let i = 0; i < 12; i++) app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'l1', amount: 500, date: '2025-01-01' }));
    const a = app.amort(l);
    assert.equal(a.n, 1); assert.equal(a.esgotado, true);
    assert.equal(app.amort(fixa({ years: 1, outstanding: 5000, id: 'outro' })).esgotado, false);
  });
});

describe('efeito do pagamento na hipoteca (applyLoan)', () => {
  // normProp copia a hipoteca: a que conta é a que fica na db
  const monta = () => { app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', loans: [fixa()] })); return app.findLoan(app.prop('p1'), 'l1'); };
  const pag = (extra) => app.normTx(Object.assign({ kind: 'loan', loanId: 'l1', propertyId: 'p1', date: '2026-01-10' }, extra));

  test('a distribuição sugerida bate com a prestação e abate o capital', () => {
    const l = monta(), t = pag({ amount: 431.6 });
    app.applyLoan(t);
    perto(t.interest, 250); perto(t.stamp, 10); perto(t.principal, 171.60);
    perto(l.outstanding, 99828.40);
  });

  test('juros+selo+capital somam sempre o montante, mesmo abaixo dos juros', () => {
    const l = monta();
    [100, 7, 0.5, 13, 260.01, 1000].forEach((amt) => {
      const t = pag({ amount: amt });
      app.applyLoan(t);
      perto(t.interest + t.stamp + t.principal, amt, 0.005);
      assert.ok(t.principal >= 0 && t.interest >= 0 && t.stamp >= 0, 'nada negativo com ' + amt);
      assert.ok(t.interest <= 250.005, 'os juros nunca passam os da prestação');
    });
    perto(l.outstanding, 100000 - 740 - 0.01, 0.02);   // só o de 1000 € e o de 260,01 abateram capital
  });

  test('amortização antecipada: capital e comissão somam o montante', () => {
    const l = monta(), t = pag({ payType: 'amortizacao', amount: 10000 });
    app.applyLoan(t);
    perto(t.principal, 9803.92); perto(t.fee, 196.08); perto(t.interest, 0); perto(t.stamp, 0);
    perto(l.outstanding, 90196.08);
  });

  test('o selo é 4% por omissão e configurável', () => {
    app.db.settings.stampPct = 0; perto(app.loanCalc(fixa()).stamp, 0);
    app.db.settings.stampPct = 4; perto(app.loanCalc(fixa()).stamp, 10);
  });

  test('a comissão de amortização segue a mesma fase que o plano', () => {
    const l = fixa({ type: 'mista', fixedYears: 5, amortFeeFix: 2, amortFeeVar: 0.5 });   // sem data de início
    app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', loans: [l] }));
    perto(app.amortFeeRate(l, '2026-01-01'), 0.02);
    for (let i = 0; i < 72; i++) app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'l1', amount: 500, date: '2025-01-01' }));
    perto(app.amortFeeRate(l, '2026-01-01'), 0.005);
    assert.equal(app.amort(l).rows[0].rate, app.rateAt(l, 72));
  });
});

describe('comissão de amortização antecipada', () => {
  test('taxa fixa paga a comissão da fase fixa', () => {
    perto(app.amortFeeRate(fixa({ amortFeeFix: 2 }), '2026-01-01'), 0.02);
  });

  test('taxa variável paga a comissão mais baixa', () => {
    perto(app.amortFeeRate(fixa({ type: 'variavel', amortFeeVar: 0.5 }), '2026-01-01'), 0.005);
  });

  test('mista muda de comissão quando muda de taxa', () => {
    const l = fixa({ type: 'mista', fixedYears: 5, start: '2020-01-01', amortFeeFix: 2, amortFeeVar: 0.5 });
    perto(app.amortFeeRate(l, '2023-01-01'), 0.02);    // dentro dos cinco anos
    perto(app.amortFeeRate(l, '2026-01-01'), 0.005);   // já depois
  });

  test('sem valores definidos usa os limites legais', () => {
    const l = app.normLoan({ type: 'fixa' });
    perto(app.amortFeeRate(l, '2026-01-01'), 0.02);
    perto(app.amortFeeRate(app.normLoan({ type: 'variavel' }), '2026-01-01'), 0.005);
  });
});
