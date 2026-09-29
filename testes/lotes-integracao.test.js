// Os lotes (movimento.js) vistos de fora do formulário: apagar um imóvel
// acerta os lotes que tinham uma parte nele
// (imovel.js:acertarLotesSemImovel), o preenchimento por estimativa de um
// planeado de grupo entra partido por imóvel (cloud/painel.js:CW.doFillMissed,
// pelo registarMolde), e uma despesa de «Todos os imóveis» ainda por partir
// não conta como «sem imóvel» (painel-geral.js:orphanExpenses).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-09-15' });
afterEach(() => repor(app));

/* Três imóveis meus e um lote de 300 € dividido por eles (três partes de 100 €),
   e um lote de 80 € só pelos dois primeiros.
   Recebe: a — a app.
   Devolve: nada — escreve na base. */
function tresImoveis(a) {
  limpar(a);
  a.db.owners = [a.normPerson({ id: 'eu', name: 'Eu' })];
  a.db.properties = ['P1', 'P2', 'P3'].map((id) => a.normProp({ id, name: 'Casa ' + id, ownerIds: ['eu'] }));
  const lote = (id, n, total, partes) => ({ id, n, total, alvo: 'todos', modo: 'equal', partes: partes || {} });
  a.db.transactions = [
    ...['P1', 'P2', 'P3'].map((p) => a.normTx({ id: 'L_' + p, kind: 'expense', label: 'Condomínio', amount: 100, date: '2026-03-01', propertyId: p, lote: lote('L', 3, 300) })),
    ...['P1', 'P2'].map((p) => a.normTx({ id: 'M_' + p, kind: 'expense', label: 'Seguro', amount: 40, date: '2026-03-01', propertyId: p, lote: lote('M', 2, 80) })),
  ];
}

/* O delProp com a confirmação a dizer sim e o Anular guardado para o teste o
   poder chamar.
   Recebe: a — a app; id — o imóvel a apagar.
   Devolve: a função do Anular. */
function apagarImovel(a, id) {
  let anular = null;
  a.confirmModal = (t, x, cb) => cb();
  a.comDesfazer = (msg, repor1) => { anular = repor1; };
  a.save = () => {}; a.render = () => {}; a.closeAllModals = () => {};
  a.delProp(id);
  return anular;
}

describe('apagar um imóvel acerta os lotes que tinham uma parte nele', () => {
  test('as partes que ficam passam a ser o lote inteiro, e uma só que sobre passa a movimento normal', () => {
    tresImoveis(app);
    apagarImovel(app, 'P3');
    const cond = app.db.transactions.filter((t) => t.label === 'Condomínio');
    assert.deepEqual(cond.map((t) => t.propertyId).sort(), ['P1', 'P2']);
    assert.ok(cond.every((t) => t.lote && t.lote.n === 2 && t.lote.total === 200), JSON.stringify(cond.map((t) => t.lote)));
    assert.equal(app.loteCompleto(cond[0]), true, 'o lote volta a estar inteiro e a poder editar-se');
    // o seguro não tinha parte no P3: fica como estava
    const seg = app.db.transactions.filter((t) => t.label === 'Seguro');
    assert.ok(seg.every((t) => t.lote.n === 2 && t.lote.total === 80));
    // apagar o P2 deixa o seguro com uma parte só: é um movimento normal
    apagarImovel(app, 'P2');
    const so = app.db.transactions.filter((t) => t.label === 'Seguro');
    assert.equal(so.length, 1);
    assert.equal(so[0].lote, null);
    assert.equal(so[0].propertyId, 'P1');
  });

  test('o Anular repõe o imóvel, a parte dele e as outras partes como eram', () => {
    tresImoveis(app);
    const anular = apagarImovel(app, 'P1');
    assert.equal(typeof anular, 'function');
    anular();
    const cond = app.db.transactions.filter((t) => t.label === 'Condomínio');
    assert.equal(cond.length, 3);
    assert.ok(cond.every((t) => t.lote.n === 3 && t.lote.total === 300), JSON.stringify(cond.map((t) => t.lote)));
    assert.equal(app.db.transactions.filter((t) => t.label === 'Seguro').length, 2);
    assert.ok(app.db.properties.some((p) => p.id === 'P1'));
  });

  test('com uma parte que fica num imóvel onde não posso adicionar, o lote não se mexe', () => {
    tresImoveis(app);
    app.window.CW = { user: { id: 'eu' }, cargos: { P2: { dono: false, perms: ['tx.view'] } }, pessoas: {} };
    try {
      apagarImovel(app, 'P3');
      const cond = app.db.transactions.filter((t) => t.label === 'Condomínio');
      assert.ok(cond.every((t) => t.lote.n === 3 && t.lote.total === 300), 'fica como estava, incompleto');
    } finally { app.window.CW = undefined; }
  });
});

describe('«Todos os imóveis» ainda por partir não é «sem imóvel»', () => {
  test('orphanExpenses deixa de fora a despesa de «Todos» e conta a sem imóvel', () => {
    tresImoveis(app);
    app.db.transactions.push(app.normTx({ id: 'T', kind: 'expense', label: 'Contabilista', amount: 50, date: '2026-04-01', todos: true, psplit: { mode: 'equal', parts: {} } }));
    app.db.transactions.push(app.normTx({ id: 'S', kind: 'expense', label: 'Banco', amount: 5, date: '2026-04-01' }));
    const ids = app.orphanExpenses(2026).map((t) => t.id);
    assert.deepEqual(ids, ['S']);
  });
});

describe('o preenchimento por estimativa de um planeado de grupo entra partido', () => {
  test('três meses em falta de um condomínio de grupo dão três lotes de duas partes', () => {
    const tudo = carregarTudo({ hoje: '2026-09-15' });
    try {
      limpar(tudo);
      tudo.db.owners = [tudo.normPerson({ id: 'eu', name: 'Eu' })];
      tudo.db.properties = ['P1', 'P2'].map((id) => tudo.normProp({ id, name: 'Casa ' + id, ownerIds: ['eu'] }));
      tudo.db.groups = [tudo.normGroup({ id: 'G', kind: 'prop', name: 'Bloco', ids: ['P1', 'P2'] })];
      tudo.db.recurring = [tudo.normRec({ id: 'R', name: 'Condomínio', every: 'month', next: '2026-07-01',
        tx: { kind: 'expense', label: 'Condomínio', amount: 100, groupId: 'G', psplit: { mode: 'equal', parts: {} } } })];
      ['save', 'buildNav', 'render', 'toast', 'closeModal', 'closeAllModals'].forEach((n) => { tudo[n] = () => {}; });
      tudo.CW.fillNext = () => {};
      tudo.CW.doFillMissed('R');
      const est = tudo.db.transactions.filter((t) => /estimativa/.test(t.label));
      assert.ok(est.length >= 4 && est.length % 2 === 0, 'duas partes por mês (' + est.length + ')');
      assert.ok(est.every((t) => t.propertyId && t.lote && t.lote.n === 2 && t.lote.total === 100 && t.amount === 50), JSON.stringify(est.map((t) => [t.propertyId, t.amount, t.lote && t.lote.n])));
      assert.ok(!tudo.db.transactions.some((t) => t.groupId), 'nenhum registo de grupo inteiro');
    } finally { repor(tudo); }
  });
});
