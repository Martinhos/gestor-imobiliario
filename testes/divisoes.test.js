// Divisão de despesas entre comproprietários e contas a acertar.
// Aqui um cêntimo a mais ou a menos é uma discussão entre pessoas.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, vazio } from './arnes.js';

const app = carregarApp();
const perto = (a, b, tol = 0.005) =>
  assert.ok(Math.abs(a - b) <= tol, `esperava ${b} (±${tol}), veio ${a}`);

let ana, bruno, carla, casa;

beforeEach(() => {
  limpar(app);
  ana = app.normPerson({ id: 'ana', name: 'Ana' });
  bruno = app.normPerson({ id: 'bruno', name: 'Bruno' });
  carla = app.normPerson({ id: 'carla', name: 'Carla' });
  app.db.owners.push(ana, bruno, carla);
  casa = app.normProp({ id: 'casa', name: 'T2', ownerIds: ['ana', 'bruno'] });
  app.db.properties.push(casa);
});

describe('quota-parte', () => {
  test('sem percentagens, partes iguais', () => {
    const s = app.sharesOf(casa);
    perto(s.ana, 0.5);
    perto(s.bruno, 0.5);
  });

  test('percentagens definidas mandam', () => {
    casa.ownerShares = { ana: 70, bruno: 30 };
    const s = app.sharesOf(casa);
    perto(s.ana, 0.7);
    perto(s.bruno, 0.3);
  });

  test('quem não tem percentagem fica com o que sobra', () => {
    casa.ownerIds = ['ana', 'bruno', 'carla'];
    casa.ownerShares = { ana: 50 };
    const s = app.sharesOf(casa);
    perto(s.ana, 0.5);
    perto(s.bruno, 0.25);
    perto(s.carla, 0.25);
  });

  test('percentagens que não somam 100 são normalizadas', () => {
    casa.ownerShares = { ana: 30, bruno: 30 };
    const s = app.sharesOf(casa);
    perto(s.ana, 0.5);
    perto(s.bruno, 0.5);
  });

  test('as quotas somam sempre um', () => {
    casa.ownerIds = ['ana', 'bruno', 'carla'];
    casa.ownerShares = { ana: 33, bruno: 33, carla: 34 };
    const s = app.sharesOf(casa);
    perto(Object.values(s).reduce((a, b) => a + b, 0), 1);
  });

  test('imóvel sem donos não devolve quotas', () => {
    vazio(app.sharesOf(app.normProp({ id: 'x', name: 'Sem donos' })), 'sem donos, sem quotas');
  });
});

describe('divisão ao cêntimo', () => {
  test('soma exatamente o total, mesmo sem divisão certa', () => {
    // 100 cêntimos por três: 34+33+33, nunca 33+33+33
    const p = app.splitShares(100, [1 / 3, 1 / 3, 1 / 3]);
    assert.equal(p.reduce((a, b) => a + b, 0), 100);
    igual(p.slice().sort(), [33, 33, 34]);
  });

  test('mantém-se exata em valores grandes', () => {
    const p = app.splitShares(1000001, [0.3333, 0.3333, 0.3334]);
    assert.equal(p.reduce((a, b) => a + b, 0), 1000001);
  });

  test('respeita quotas desiguais', () => {
    igual(app.splitShares(1000, [0.7, 0.3]), [700, 300]);
  });

  test('total zero dá zeros', () => {
    igual(app.splitShares(0, [0.5, 0.5]), [0, 0]);
  });
});

describe('divisão de um movimento', () => {
  const os = ['ana', 'bruno'];
  const desp = (extra = {}) => app.normTx(Object.assign({
    kind: 'expense', amount: 100, propertyId: 'casa', paidBy: 'ana', date: '2026-01-10',
  }, extra));

  test('por omissão segue a quota-parte', () => {
    casa.ownerShares = { ana: 70, bruno: 30 };
    igual(app.txSplitCents(desp(), casa, os), [7000, 3000]);
  });

  test('modo igual ignora a quota-parte', () => {
    casa.ownerShares = { ana: 70, bruno: 30 };
    const t = desp({ split: { mode: 'equal', parts: {} } });
    igual(app.txSplitCents(t, casa, os), [5000, 5000]);
  });

  test('modo percentagem usa os pesos indicados', () => {
    const t = desp({ split: { mode: 'pct', parts: { ana: 25, bruno: 75 } } });
    igual(app.txSplitCents(t, casa, os), [2500, 7500]);
  });

  test('modo valor certo distribui o resto pelos outros', () => {
    const t = desp({ split: { mode: 'amount', parts: { ana: 60, bruno: 0 } } });
    const r = app.txSplitCents(t, casa, os);
    assert.equal(r.reduce((a, b) => a + b, 0), 10000);
    assert.equal(r[0], 8000);   // 60 seus mais metade dos 40 que sobram
  });

  test('a soma das partes é sempre o total, em qualquer modo', () => {
    [
      { mode: 'equal', parts: {} },
      { mode: 'pct', parts: { ana: 1, bruno: 2 } },
      { mode: 'adjust', parts: { ana: 10 } },
      null,
    ].forEach((split) => {
      const r = app.txSplitCents(desp({ amount: 33.33, split }), casa, os);
      assert.equal(r.reduce((a, b) => a + b, 0), 3333, 'modo ' + (split ? split.mode : 'quota'));
    });
  });
});

describe('contas entre proprietários', () => {
  test('quem paga fica a crédito da parte dos outros', () => {
    app.db.transactions.push(app.normTx({
      kind: 'expense', amount: 100, propertyId: 'casa', paidBy: 'ana', date: '2026-01-10',
    }));
    const b = app.ownerBalances('casa');
    perto(b.ana, 50);
    perto(b.bruno, -50);
  });

  test('quem recebe fica a dever a parte dos outros', () => {
    app.db.transactions.push(app.normTx({
      kind: 'income', amount: 100, propertyId: 'casa', paidBy: 'ana', date: '2026-01-10',
    }));
    const b = app.ownerBalances('casa');
    perto(b.ana, -50);
    perto(b.bruno, 50);
  });

  test('os saldos somam sempre zero', () => {
    casa.ownerShares = { ana: 70, bruno: 30 };
    [['expense', 137.45, 'ana'], ['income', 900, 'bruno'], ['loan', 431.6, 'ana']]
      .forEach(([kind, amount, paidBy]) => {
        app.db.transactions.push(app.normTx({
          kind, amount, paidBy, propertyId: 'casa', date: '2026-02-01',
        }));
      });
    const b = app.ownerBalances('casa');
    perto(Object.values(b).reduce((a, x) => a + x, 0), 0);
  });

  test('movimentos sem pessoa indicada não inventam dívidas', () => {
    app.db.transactions.push(app.normTx({
      kind: 'expense', amount: 100, propertyId: 'casa', paidBy: null, date: '2026-01-10',
    }));
    const b = app.ownerBalances('casa');
    perto(b.ana || 0, 0);
    perto(b.bruno || 0, 0);
  });

  test('dívidas a terceiros ficam de fora', () => {
    app.db.transactions.push(app.normTx({
      kind: 'owed', amount: 500, propertyId: 'casa', paidBy: 'ana', creditor: 'Banco', date: '2026-01-10',
    }));
    perto(app.ownerBalances('casa').ana || 0, 0);
  });

  test('imóvel com um só dono não gera contas', () => {
    app.db.properties.push(app.normProp({ id: 'solo', name: 'Só minha', ownerIds: ['ana'] }));
    app.db.transactions.push(app.normTx({
      kind: 'expense', amount: 100, propertyId: 'solo', paidBy: 'ana', date: '2026-01-10',
    }));
    vazio(app.ownerBalances('solo'), 'um dono so nao gera contas');
  });

  test('uma transferência entre donos salda a conta', () => {
    app.db.transactions.push(app.normTx({
      kind: 'expense', amount: 100, propertyId: 'casa', paidBy: 'ana', date: '2026-01-10',
    }));
    app.db.transactions.push(app.normTx({
      kind: 'settle', amount: 50, propertyId: 'casa', paidBy: 'bruno', toId: 'ana', date: '2026-01-20',
    }));
    const b = app.ownerBalances('casa');
    perto(b.ana, 0);
    perto(b.bruno, 0);
  });
});

describe('plano de acerto', () => {
  test('liga quem deve a quem tem a receber', () => {
    const plano = app.settlePlan({ ana: 100, bruno: -60, carla: -40 });
    assert.equal(plano.length, 2);
    perto(plano.reduce((t, p) => t + p.amount, 0), 100);
    assert.ok(plano.every((p) => p.to === 'ana'));
  });

  test('usa o menor número de transferências', () => {
    const plano = app.settlePlan({ ana: 50, bruno: -50 });
    assert.equal(plano.length, 1);
    assert.deepEqual(
      { from: plano[0].from, to: plano[0].to, amount: plano[0].amount },
      { from: 'bruno', to: 'ana', amount: 50 }
    );
  });

  test('contas saldadas não geram transferências', () => {
    assert.equal(app.settlePlan({ ana: 0, bruno: 0 }).length, 0);
    assert.equal(app.settlePlan({ ana: 0.001, bruno: -0.001 }).length, 0);
  });
});
