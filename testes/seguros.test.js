// A previsão dos pagamentos de um seguro. É a única razão de ser do menu:
// saber quanto sai e quando, com o prémio a subir a cada aniversário — um
// seguro raramente custa o mesmo dois anos seguidos.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar } from './arnes.js';

const app = carregarApp();
beforeEach(() => limpar(app));

const seguro = (extra = {}) => Object.assign({
  start: '2026-01-15', premium: 120, period: 'anual', increase: 0,
}, extra);

describe('as datas', () => {
  test('anual cai sempre no aniversário', () => {
    const p = app.pagamentosSeguro(seguro(), 3, '2026-01-01');
    assert.deepEqual(Array.from(p, (x) => x.date), ['2026-01-15', '2027-01-15', '2028-01-15']);
  });

  test('mensal, trimestral e semestral seguem o passo', () => {
    const m = app.pagamentosSeguro(seguro({ period: 'mensal' }), 3, '2026-01-01');
    assert.deepEqual(Array.from(m, (x) => x.date), ['2026-01-15', '2026-02-15', '2026-03-15']);
    const t = app.pagamentosSeguro(seguro({ period: 'trimestral' }), 2, '2026-01-01');
    assert.deepEqual(Array.from(t, (x) => x.date), ['2026-01-15', '2026-04-15']);
    const s = app.pagamentosSeguro(seguro({ period: 'semestral' }), 2, '2026-01-01');
    assert.deepEqual(Array.from(s, (x) => x.date), ['2026-01-15', '2026-07-15']);
  });

  test('só devolve pagamentos a partir de hoje — o passado já saiu da conta', () => {
    const p = app.pagamentosSeguro(seguro({ period: 'mensal' }), 2, '2026-03-01');
    assert.deepEqual(Array.from(p, (x) => x.date), ['2026-03-15', '2026-04-15']);
  });

  test('uma data impossível não rebenta: devolve vazio', () => {
    assert.deepEqual(Array.from(app.pagamentosSeguro(seguro({ start: 'não-é-data' }), 3, '2026-01-01')), []);
  });
});

describe('o aumento anual — a razão de os pagamentos não serem sempre iguais', () => {
  test('entra a cada aniversário da apólice, não a cada pagamento', () => {
    const p = app.pagamentosSeguro(seguro({ period: 'semestral', increase: 10 }), 4, '2026-01-01');
    // 1.º ano: 120 e 120; 2.º ano: 132 e 132
    assert.deepEqual(Array.from(p, (x) => x.value), [120, 120, 132, 132]);
  });

  test('compõe ano após ano', () => {
    const p = app.pagamentosSeguro(seguro({ increase: 10 }), 3, '2026-01-01');
    assert.deepEqual(Array.from(p, (x) => x.value), [120, 132, 145.2]);
  });

  test('sem aumento, é sempre o mesmo valor', () => {
    const p = app.pagamentosSeguro(seguro({ period: 'mensal' }), 24, '2026-01-01');
    assert.ok(p.every((x) => x.value === 120));
  });

  test('arredonda ao cêntimo', () => {
    const p = app.pagamentosSeguro(seguro({ premium: 99.99, increase: 3.7 }), 2, '2026-01-01');
    assert.equal(p[1].value, Math.round(99.99 * 1.037 * 100) / 100);
  });
});

describe('o custo dos próximos 12 meses', () => {
  test('mensal sem aumento: doze pagamentos', () => {
    assert.equal(app.custoAnualSeguro(seguro({ period: 'mensal' }), '2026-01-01'), 1440);
  });

  test('anual: um pagamento só', () => {
    assert.equal(app.custoAnualSeguro(seguro(), '2026-01-01'), 120);
  });

  test('apanha o aumento quando o aniversário cai dentro da janela', () => {
    // a 2026-07-01, a janela apanha 2026-07-15..2027-06-15: seis meses a 120
    // e seis já a 132
    const c = app.custoAnualSeguro(seguro({ period: 'mensal', increase: 10 }), '2026-07-01');
    assert.equal(c, 6 * 120 + 6 * 132);
  });
});
