// Os movimentos do mesmo dia pela hora a que foram adicionados (ticket de QA
// 15f6d530): do mais recente para o mais antigo, o adicionado depois fica em
// cima, e não pela ordem em que a lista veio do servidor. O movimento novo
// nasce com o carimbo `criado` (dados.js:normTx, num objeto sem id); um que
// já existe não ganha um carimbo inventado. O comparador é um só
// (dados.js:txPorDataECriacao), na lista dos Movimentos
// (lista-movimentos.js:vTransactions) e na lista de um indicador
// (cloud/painel.js:kpiTxs). Os modelos e os planeados não levam o carimbo.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar, repor, igual } from './arnes.js';

const app = carregarTudo({ hoje: '2026-10-28' });
beforeEach(() => {
  limpar(app);
  app.render = () => {}; app.buildNav = () => {}; app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.properties.push(app.normProp({ id: 'casa', name: 'T2', ownerIds: ['ana'] }));
  app.txFilter = ''; app.txProp = ''; app.txPaid = ''; app.txCat = ''; app.txSub = ''; app.txSearch = '';
  app.txDe = ''; app.txAte = ''; app.txSort = 'date'; app.txDir = 'desc'; app.txNoPayer = true;
});
afterEach(() => repor(app));

/* Um movimento novo, como o formulário o faz: um normTx de um objeto sem id,
   com o relógio da app (o Date.now() dela) parado no instante dado só
   durante essa chamada.
   Recebe: ms — quando foi adicionado; extra — os campos que mudam.
   Devolve: o movimento (ainda fora da base). */
function novo(ms, extra) {
  const Antes = app.Date;
  app.Date = class extends Antes { static now() { return ms; } };
  try {
    return app.normTx(Object.assign({ kind: 'expense', label: 'Luz', amount: 50, date: '2026-10-20', paidBy: 'ana', propertyId: 'casa' }, extra));
  } finally {
    app.Date = Antes;
  }
}

/* Os rótulos das linhas da última pintura dos Movimentos. */
const rotulos = () => { app.vTransactions(); return app.txLista.map((t) => t.label); };

describe('o carimbo de quando o movimento foi adicionado', () => {
  test('um movimento novo (sem id) nasce com criado = Date.now()', () => {
    const t = novo(1700000000000);
    assert.equal(t.criado, 1700000000000);
    assert.ok(t.id, 'e com um id novo');
  });

  test('um movimento que ja existe (com id) nao ganha um criado inventado', () => {
    const t = app.normTx({ id: 'velho', kind: 'income', amount: 10, date: '2026-01-01' });
    assert.equal(Object.prototype.hasOwnProperty.call(t, 'criado'), false, 'sem o campo: não sobe ao servidor por isso');
  });

  test('o criado que ja vem fica; um que nao e numero positivo sai', () => {
    assert.equal(app.normTx({ id: 'a', criado: 1234 }).criado, 1234);
    assert.equal(app.normTx({ id: 'a', criado: '1234' }).criado, 1234, 'o número em texto (de um JSON antigo) conta');
    for (const mau of [0, -5, 'x', NaN, Infinity, null, true]) {
      assert.equal(Object.prototype.hasOwnProperty.call(app.normTx({ id: 'a', criado: mau }), 'criado'), false, String(mau));
    }
  });

  test('editar (normTx de uma copia com id) mantem o criado', () => {
    const t = novo(5000);
    const editado = app.normTx(Object.assign(JSON.parse(JSON.stringify(t)), { amount: 99 }));
    assert.equal(editado.criado, 5000);
    assert.equal(editado.id, t.id);
  });

  test('os modelos e os planeados nao levam o criado', () => {
    const t = novo(5000);
    assert.equal('criado' in app.txSnapshot(t), false, 'txSnapshot');
    assert.equal(app.TX_TPL_KEYS.includes('criado'), false, 'TX_TPL_KEYS');
    assert.equal('criado' in app.normTpl({ name: 'M', tx: t }).tx, false, 'normTpl');
    assert.equal('criado' in app.normRec({ name: 'P', next: '2026-11-01', tx: t }).tx, false, 'normRec');
    assert.equal('criado' in app.normRec({ name: 'P', next: '2026-11-01', tx: { kind: 'expense' } }).tx, false, 'normRec de um tx sem id');
  });
});

describe('txPorDataECriacao', () => {
  const c = (a, b) => Math.sign(app.txPorDataECriacao(a, b));
  test('a data manda, ascendente', () => {
    assert.equal(c({ date: '2026-01-01', criado: 9 }, { date: '2026-01-02', criado: 1 }), -1);
    assert.equal(c({ date: '2026-01-02' }, { date: '2026-01-01' }), 1);
  });
  test('no mesmo dia, o adicionado antes primeiro; o sem criado conta como 0', () => {
    assert.equal(c({ date: '2026-01-01', criado: 1 }, { date: '2026-01-01', criado: 2 }), -1);
    assert.equal(c({ date: '2026-01-01', criado: 2 }, { date: '2026-01-01', criado: 1 }), 1);
    assert.equal(c({ date: '2026-01-01' }, { date: '2026-01-01', criado: 1 }), -1);
    assert.equal(c({ date: '2026-01-01' }, { date: '2026-01-01' }), 0, 'dois antigos empatam, como antes');
  });
});

describe('a lista dos Movimentos', () => {
  test('no mesmo dia, em desc o adicionado depois fica em cima; em asc o primeiro', () => {
    const cedo = novo(1000, { label: 'Primeiro' });
    const tarde = novo(2000, { label: 'Segundo' });
    const outro = novo(500, { label: 'Outro dia', date: '2026-10-19' });
    app.db.transactions.push(tarde, outro, cedo);   // a ordem do array não explica o resultado
    igual(rotulos(), ['Segundo', 'Primeiro', 'Outro dia']);
    app.db.transactions = [cedo, outro, tarde];
    igual(rotulos(), ['Segundo', 'Primeiro', 'Outro dia'], 'nem a outra ordem');
    app.txDir = 'asc';
    igual(rotulos(), ['Outro dia', 'Primeiro', 'Segundo']);
  });

  test('pelo valor, o empate de valor e de data vai pelo criado', () => {
    const cedo = novo(1000, { label: 'Primeiro' });
    const tarde = novo(2000, { label: 'Segundo' });
    app.db.transactions.push(tarde, cedo);
    app.txSort = 'amount';
    igual(rotulos(), ['Primeiro', 'Segundo']);
    app.txDir = 'asc';
    igual(rotulos(), ['Primeiro', 'Segundo']);
  });
});

describe('a lista de um indicador (kpiTxs)', () => {
  test('do mais recente para o mais antigo, e no mesmo dia o adicionado depois primeiro', () => {
    const cedo = novo(1000, { label: 'Primeiro', kind: 'income' });
    const tarde = novo(2000, { label: 'Segundo', kind: 'income' });
    const outro = novo(500, { label: 'Outro dia', kind: 'income', date: '2026-10-19' });
    app.db.transactions.push(tarde, outro, cedo);
    const ver = () => app.kpiTxs({ field: 'income', pid: null, year: 2026 }).map((x) => x.t.label);
    igual(ver(), ['Segundo', 'Primeiro', 'Outro dia']);
    app.db.transactions = [cedo, outro, tarde];
    igual(ver(), ['Segundo', 'Primeiro', 'Outro dia']);
  });
});
