// Os Movimentos e os Planeados como serviços: cada um rende só com a base (os
// Planeados com os Movimentos, que requerem), e nenhum rebenta quando os
// serviços que só «usam» — imóveis, contratos, proprietários, créditos,
// planeados — estão desligados nesta conta: os atalhos para eles somem, o
// resto fica como está. E o que os Movimentos acrescentam aos menus dos
// vizinhos («Registar despesa» num imóvel, «Registar renda» num contrato) vem
// por lpExtras, e some com eles.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { carregarServico, carregarTudo, limpar, igual } from './arnes.js';
// as janelas numa pilha observável, sem repintar nem gravar; o toque longo devolve os rótulos
import { janelasFalsas, menuDe } from './lib/dom.js';

/* os serviços que os Movimentos só usam, e que o G2 desliga de uma vez */
const OUTROS = ['properties', 'contracts', 'owners', 'credits'];
/* os atalhos para ecrãs de outros serviços que não podem aparecer no HTML */
const ATALHOS = /propView\(|ctView\(|mortView\(|openContract\(|openProp\(|go\('properties'\)|go\('contracts'\)|go\('credits'\)/;

/* semeia um imóvel com hipoteca e dois donos (e um segundo imóvel sem hipoteca),
   um contrato em vigor, uma renda ligada ao contrato, uma prestação ligada à
   hipoteca, uma dívida a terceiros, uma despesa, um planeado em atraso e um modelo */
function semear(app) {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana' }), app.normPerson({ id: 'O2', name: 'Rui' })];
  app.db.properties = [
    app.normProp({ id: 'P1', name: 'T2 Lisboa', ownerIds: ['O1', 'O2'], loans: [{ id: 'L1', name: 'Aquisição', outstanding: 50000, years: 20, rate: 3, start: '2020-01-10' }] }),
    app.normProp({ id: 'P2', name: 'T1 Porto', ownerIds: ['O1'] }),
  ];
  app.db.contracts = [app.normContract({ id: 'C1', name: 'Arrendamento', propertyId: 'P1', rent: 800, start: '2024-01-01' })];
  app.db.transactions = [
    app.normTx({ id: 'T1', kind: 'income', label: 'Renda', amount: 800, propertyId: 'P1', contractId: 'C1', date: '2026-03-08', periodo: '2026-03', paidBy: 'O1' }),
    app.normTx({ id: 'T2', kind: 'loan', label: 'Prestação', amount: 400, propertyId: 'P1', loanId: 'L1', date: '2026-03-10', principal: 300, interest: 90, stamp: 10 }),
    app.normTx({ id: 'T3', kind: 'owed', label: 'Emprestei', amount: 100, propertyId: 'P1', creditor: 'Pai', date: '2026-03-11' }),
    app.normTx({ id: 'T4', kind: 'expense', label: 'Condomínio', amount: 55, propertyId: 'P1', date: '2026-03-12' }),
  ];
  app.db.recurring = [app.normRec({ id: 'R1', name: 'Seguro', every: 'month', next: '2020-01-05', tx: { kind: 'expense', label: 'Seguro', amount: 20, propertyId: 'P1' } })];
  app.db.templates = [app.normTpl({ id: 'M1', name: 'Luz', tx: { kind: 'expense', label: 'Luz', amount: 30, propertyId: 'P1' } })];
  app.txFilter = ''; app.txProp = ''; app.txCat = ''; app.txSub = ''; app.txSearch = ''; app.txPaid = ''; app.txDe = ''; app.txAte = '';
}

/* a ficha devolve o corpo, o menu e o botão do rodapé em vez de abrir */
function fichaDe(app, abrir) {
  let o = null;
  app.abrirFicha = (x) => { o = x; };
  abrir();
  return o ? { corpo: o.corpo(), menu: o.menu() || '', editar: o.editar } : null;
}
/* o menu «Que movimento?» devolve os rótulos em vez de abrir */
function escolhasDe(app, f) {
  let itens = null;
  app.pickModal = (t, its) => { itens = its; };
  f();
  return itens ? itens.map((o) => o.label) : [];
}

describe('autonomia: os movimentos e os planeados rendem só com a base', () => {
  test('autonomia: transactions sozinho — lista, filtros, ficha e formulário, com a db vazia e com dados', () => {
    const app = carregarServico(['transactions']);
    assert.ok(app.servicoLigado('transactions'));
    for (const id of OUTROS.concat(['recurring'])) assert.ok(!app.servicoLigado(id), id + ' desligado');
    assert.equal(typeof app.vRecurring, 'undefined', 'os Planeados não estão carregados');
    limpar(app);
    let html = app.vTransactions();
    assert.ok(html.length > 0);
    assert.match(html, /Sem movimentos/);
    assert.ok(app.txFilterBody().length > 0);
    assert.ok(app.txFilterPainel().length > 0);
    semear(app);
    html = app.vTransactions();
    assert.match(html, /id="txLista"/);
    assert.match(html, /Dívidas a terceiros/);
    assert.equal(app.txLista.length, 4);
    /* as peças da lista viva, que o pintarListaTx monta no DOM: o mês vem do
       mesPt, que tem de viver nos movimentos e não nos planeados */
    assert.match(app.txMesHtml('2026-03'), /mar 2026/);
    for (const t of app.db.transactions) assert.match(app.txLinhaHtml(t, '2026-03'), new RegExp('data-lp="tx:' + t.id + '"'));
    assert.match(app.txFilterBody(), /id="tx_q"/);
    assert.equal(app.txFiltrosN(), 0);
    // a ficha
    const f = fichaDe(app, () => app.txView('T1'));
    assert.ok(f && f.corpo.length > 0);
    assert.match(f.corpo, /Montante/);
    assert.match(f.corpo, /mar 2026/, 'o mês da renda');
    assert.doesNotMatch(f.menu, ATALHOS);
    assert.match(app.txFicha('T2'), /Hipoteca/);
    assert.match(app.txFicha('T3'), /Conta com esta pessoa/);
    // o formulário
    const abertas = janelasFalsas(app, 'render', 'buildNav', 'save', 'toast');
    app.txModal('T1');
    assert.match(abertas[0].b, /id="t_amount"/);
    assert.doesNotMatch(abertas[0].b, /id="t_ct"/, 'sem Contratos não há seletor de contrato');
    app.txModal({ kind: 'expense', propId: 'P1' });
    assert.match(abertas[1].b, /id="t_label"/);
    assert.equal(typeof app.onSave, 'function');
    app.txModal({ kind: 'loan', propId: 'P2' });
    assert.match(abertas[2].b, /Nenhuma hipoteca associada/);
    assert.doesNotMatch(abertas[2].b, /Créditos/, 'sem Créditos não se aponta para lá');
  });

  test('autonomia: recurring com os movimentos, que requer — planeados, modelos, fichas e formulários', () => {
    const app = carregarServico(['recurring']);
    assert.ok(app.servicoLigado('recurring') && app.servicoLigado('transactions'));
    for (const id of OUTROS) assert.ok(!app.servicoLigado(id), id + ' desligado');
    limpar(app);
    let html = app.vRecurring();
    assert.match(html, /Sem movimentos recorrentes/);
    assert.match(html, /Sem modelos/);
    assert.doesNotMatch(html, /criam um sem tu fazeres nada/, 'sem Contratos nem Créditos não se promete nada');
    semear(app);
    html = app.vRecurring();
    assert.match(html, /data-lp="rec:R1"/);
    assert.match(html, /data-lp="tpl:M1"/);
    assert.match(html, /id="pendCard"/);
    assert.doesNotMatch(html, /lfsel_lrec_p/, 'sem Imóveis não há filtro por imóvel');
    assert.doesNotMatch(html, ATALHOS);
    igual(app.crachaDe('recurring'), { n: 1, aviso: false });
    const fr = fichaDe(app, () => app.recView('R1'));
    assert.match(fr.corpo, /Em atraso/);
    assert.match(fr.editar.act, /confirmRec/);
    const ft = fichaDe(app, () => app.tplView('M1'));
    assert.match(ft.corpo, /Montante/);
    assert.match(ft.editar.act, /newFromTemplate/);
    // o formulário em modo recorrente e em modo modelo
    janelasFalsas(app, 'render', 'buildNav', 'save', 'toast');
    app.editRec('R1');
    assert.match(app.txBody(), /id="t_every"/);
    app.editTpl('M1');
    assert.match(app.txBody(), /id="t_tplName"/);
  });

  test('autonomia: o registo — as vistas, o toque longo, o «depois» da lista e os lpExtras', () => {
    const app = carregarServico(['recurring']);
    assert.equal(app.vistaDoSeparador('transactions'), app.vTransactions);
    assert.equal(app.vistaDoSeparador('recurring'), app.vRecurring);
    assert.equal(app.lpDe('tx'), app.lpMovimento);
    assert.equal(app.lpDe('rec'), app.lpPlaneado);
    assert.equal(app.lpDe('tpl'), app.lpModelo);
    assert.equal(app.depoisDoSeparador('transactions'), app.pintarListaTx);
    assert.equal(app.lpDe('prop'), null, 'os imóveis não estão carregados');
    assert.equal(typeof app.analiseDe('transactions').n, 'function');
    // os movimentos contribuem para os menus dos imóveis e dos contratos (quando estes estiverem ligados)
    semear(app);
    igual(app.lpExtrasDe('prop', ['prop', 'P1']).map((o) => o.label), ['Registar despesa']);
    igual(app.lpExtrasDe('ct', ['ct', 'C1']).map((o) => o.label), [], 'com os Contratos desligados a renda não se oferece');
  });
});

describe('desligado: com os outros serviços desligados nada rebenta e os atalhos somem', () => {
  /* tudo carregado, nuvem incluída, com dados, e os serviços dados desligados */
  function semOutros(off) {
    const app = carregarTudo();
    semear(app);
    app.definirServicosDesligados(off);
    return app;
  }

  test('desligado: a lista e os filtros sem imóveis, contratos, proprietários e créditos', () => {
    const app = semOutros(OUTROS);
    for (const id of OUTROS) assert.ok(!app.servicoLigado(id), id);
    assert.ok(app.servicoLigado('transactions') && app.servicoLigado('recurring'));
    const html = app.vTransactions();
    assert.match(html, /id="txLista"/);
    assert.doesNotMatch(html, ATALHOS);
    for (const t of app.db.transactions) assert.doesNotMatch(app.txLinhaHtml(t, '2026-03'), ATALHOS);
    const filtros = app.txFilterBody();
    assert.doesNotMatch(filtros, /txPropF/, 'sem Imóveis não há filtro por imóvel');
    assert.doesNotMatch(filtros, /txOwnerF|txPaidF/, 'sem Proprietários não há filtro por proprietário');
    assert.match(filtros, /txKind/);
    assert.match(filtros, /txCatF/);
    assert.ok(app.txFilterPainel().length > 0);
    assert.equal(app.txFiltrosN(), 0);
    // o controlo positivo: com tudo ligado, os filtros estão lá
    app.definirServicosDesligados([]);
    const todos = app.txFilterBody();
    assert.match(todos, /txPropF/);
    assert.match(todos, /txOwnerF/);
    assert.match(todos, /txPaidF/);
  });

  test('desligado: a ficha e o formulário não prometem ecrãs desligados; o controlo positivo traz os três atalhos', () => {
    const app = semOutros(OUTROS);
    for (const id of ['T1', 'T2', 'T3', 'T4']) {
      const f = fichaDe(app, () => app.txView(id));
      assert.ok(f && f.corpo.length > 0, id);
      assert.doesNotMatch(f.menu, ATALHOS, id);
      assert.doesNotMatch(f.menu, /Ver imóvel|Ver contrato|Ver hipoteca/, id);
    }
    assert.match(fichaDe(app, () => app.txView('T1')).corpo, /Contrato/, 'o contrato continua a dizer-se em texto');
    assert.match(fichaDe(app, () => app.txView('T2')).corpo, /Hipoteca/, 'a hipoteca também');
    const abertas = janelasFalsas(app, 'render', 'buildNav', 'save', 'toast');
    app.txModal('T1');
    assert.doesNotMatch(abertas[0].b, /id="t_ct"/, 'sem Contratos não há seletor de contrato');
    app.txModal({ kind: 'loan', propId: 'P2' });
    assert.match(abertas[1].b, /Nenhuma hipoteca associada/);
    assert.doesNotMatch(abertas[1].b, /Créditos/, 'sem Créditos não se aponta para lá');
    // o controlo positivo
    app.definirServicosDesligados([]);
    const f1 = fichaDe(app, () => app.txView('T1'));
    assert.match(f1.menu, /Ver imóvel/);
    assert.match(f1.menu, /propView\('P1'\)/);
    assert.match(f1.menu, /Ver contrato/);
    assert.match(f1.menu, /ctView\('C1'\)/);
    const f2 = fichaDe(app, () => app.txView('T2'));
    assert.match(f2.menu, /Ver hipoteca/);
    assert.match(f2.menu, /mortView\('P1','L1'\)/);
    app.txModal('T1');
    assert.match(abertas[2].b, /id="t_ct"/);
    app.txModal({ kind: 'loan', propId: 'P2' });
    assert.match(abertas[3].b, /Finanças → Créditos/);
  });

  test('desligado: o toque longo de um movimento não traz opções de serviços desligados', () => {
    const app = semOutros([]);
    // um vizinho contribui «Ver contrato» para o menu de um movimento, como os lpExtras permitem
    vm.runInContext("function extraVerContratoDeTeste(a){return [{label:'Ver contrato',icon:'contract',act:function(){}}]}", app.__ctx);
    app.registarServico({ id: 'contracts', lpExtras: { tx: 'extraVerContratoDeTeste' } });
    const lp = app.lpDe('tx');
    assert.equal(lp, app.lpMovimento);
    const com = menuDe(app, lp, ['tx', 'T1']);
    assert.ok(com.includes('Ver contrato'), 'controlo positivo: ' + com.join(', '));
    assert.ok(com.includes('Editar movimento') && com.includes('Apagar movimento'));
    app.definirServicosDesligados(OUTROS);
    const sem = menuDe(app, app.lpDe('tx'), ['tx', 'T1']);
    igual(sem, ['Editar movimento', 'Apagar movimento']);
    // e com os Movimentos desligados o prefixo não abre nada
    app.definirServicosDesligados(['transactions']);
    assert.equal(app.lpDe('tx'), null);
  });

  test('desligado: sem Planeados a lista não tem o cartão, o «novo» não oferece modelos e o formulário não repete', () => {
    const app = semOutros(['recurring']);
    assert.ok(app.servicoLigado('transactions'));
    const html = app.vTransactions();
    assert.match(html, /id="txLista"/);
    assert.doesNotMatch(html, /id="pendCard"/);
    assert.doesNotMatch(html, /go\('recurring'\)/);
    assert.equal(app.vistaDoSeparador('recurring'), null);
    assert.equal(app.crachaDe('recurring'), null);
    janelasFalsas(app, 'render', 'buildNav', 'save', 'toast');
    const sem = escolhasDe(app, () => app.newTxPick());
    assert.ok(!sem.some((l) => /modelo/i.test(l)), sem.join(', '));
    assert.ok(sem.includes('Despesa'));
    // a secção de repetição não se pinta sem os Planeados, mesmo no modo de planeado
    app.txModal({ kind: 'expense', propId: 'P1', modo: 'rec' });
    assert.doesNotMatch(app.txBody(), /id="t_every"/);
    // o controlo positivo
    app.definirServicosDesligados([]);
    const com = escolhasDe(app, () => app.newTxPick());
    assert.ok(com.some((l) => /modelo/i.test(l)), com.join(', '));
    assert.match(app.txBody(), /id="t_every"/);
    igual(app.crachaDe('recurring'), { n: 1, aviso: false });
    assert.match(app.vRecurring(), /id="pendCard"/);
  });

  test('desligado: «Registar despesa» no imóvel e «Registar renda» no contrato vêm dos Movimentos, e somem com eles desligados', () => {
    const app = semOutros([]);
    const rotulos = (p, a) => app.lpExtrasDe(p, a).map((o) => o.label);
    assert.ok(rotulos('prop', ['prop', 'P1']).includes('Registar despesa'), rotulos('prop', ['prop', 'P1']).join(', '));
    assert.ok(rotulos('ct', ['ct', 'C1']).includes('Registar renda'), rotulos('ct', ['ct', 'C1']).join(', '));
    // as ações abrem o formulário certo
    const abertas = janelasFalsas(app, 'render', 'buildNav', 'save', 'toast');
    app.lpExtrasDe('prop', ['prop', 'P1']).find((o) => o.label === 'Registar despesa').act();
    assert.equal(app.tForm.kind, 'expense');
    assert.equal(app.tForm.propertyId, 'P1');
    app.lpExtrasDe('ct', ['ct', 'C1']).find((o) => o.label === 'Registar renda').act();
    assert.equal(app.tForm.kind, 'income');
    assert.equal(app.tForm.contractId, 'C1');
    assert.equal(app.tForm.propertyId, 'P1');
    assert.equal(abertas.length, 2);
    // um imóvel que já não existe, ou um contrato terminado, não oferecem nada
    assert.ok(!rotulos('prop', ['prop', 'PX']).includes('Registar despesa'));
    app.db.contracts[0].active = false;
    assert.ok(!rotulos('ct', ['ct', 'C1']).includes('Registar renda'));
    app.db.contracts[0].active = true;
    // com os Movimentos desligados, os menus dos vizinhos ficam sem elas
    app.definirServicosDesligados(['transactions']);
    assert.ok(!rotulos('prop', ['prop', 'P1']).includes('Registar despesa'));
    assert.ok(!rotulos('ct', ['ct', 'C1']).includes('Registar renda'));
  });
});
