// A app não tem filtro global de proprietário: a gaveta não tem o
// «Proprietário em foco», o topo não tem a faixa do âmbito, e nenhum painel de
// filtros (Imóveis, Movimentos, Visão geral, Projeções, Avaliação, as outras
// listas) tem o campo «Proprietário» — o «Pago ou recebido por» dos Movimentos
// fica, e o seletor do imóvel da Visão geral lista também os proprietários,
// cada um como os imóveis de que é comproprietário (não é o filtro global, e
// as Projeções e a Avaliação não os têm). O ownerFilter é sempre '': nada na
// app o escreve com outra coisa — nem o IRS · Anexo F, que deixou de ter
// titular a escolher (KAN-73: a Declaração é a de quem tem a sessão) —, e um
// filtro comum guardado com proprietário aplica o resto e ignora essa parte.
// O botão do cabeçalho: a camada do painel só despe o «Concluir» que
// vestiu, e a roda dentada fica com o nome dela.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { carregarApp, carregarTudo, limpar, repor, elementos } from './arnes.js';

const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
afterEach(() => { app.fecharFiltros(); app.ownerFilter = ''; app.txFilter = ''; app.txProp = ''; app.txCat = ''; app.dashProp = ''; });
const ANO = 2026;

/* Dois proprietários com um imóvel cada (o segundo a meias), um contrato e
   um movimento em cada — o que o «Proprietário em foco» precisava para
   aparecer, e o que um filtro de proprietário deixaria de fora. */
function semear() {
  const db = limpar(app);
  db.owners.push(app.normPerson({ id: 'o1', name: 'Ana Dona' }), app.normPerson({ id: 'o2', name: 'Bruno Dono' }));
  db.tenants.push(app.normPerson({ id: 't1', name: 'Rui' }), app.normPerson({ id: 't2', name: 'Sara' }));
  db.properties.push(app.normProp({ id: 'p1', name: 'T2 Lisboa', use: 'investimento', rentalMode: 'inteiro', value: 200000, purchase: 150000, ownerIds: ['o1'] }));
  db.properties.push(app.normProp({ id: 'p2', name: 'T1 Porto', use: 'investimento', rentalMode: 'inteiro', value: 120000, purchase: 90000, ownerIds: ['o1', 'o2'], shares: { o1: 50, o2: 50 } }));
  db.contracts.push(app.normContract({ id: 'c1', name: 'Lisboa', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.contracts.push(app.normContract({ id: 'c2', name: 'Porto', propertyId: 'p2', tenantIds: ['t2'], rent: 500, start: (ANO - 1) + '-01-01', active: true }));
  db.transactions.push(app.normTx({ id: 'x1', kind: 'income', label: 'Renda Lisboa', category: 'Rendas', amount: 800, propertyId: 'p1', contractId: 'c1', paidBy: 'o1', date: ANO + '-01-05' }));
  db.transactions.push(app.normTx({ id: 'x2', kind: 'income', label: 'Renda Porto', category: 'Rendas', amount: 500, propertyId: 'p2', contractId: 'c2', paidBy: 'o2', date: ANO + '-01-06' }));
  db.groups.push(app.normGroup({ id: 'GO', name: 'Família', kind: 'owner', ids: ['o1', 'o2'] }));
  return db;
}

/* As marcas do filtro de proprietário num ecrã: o seletor das análises
   (ownerSel), o dos Movimentos (txOwnerF), o chip/campo dos Imóveis
   (lprops_own), o rótulo «Proprietário» de um campo, a faixa e a gaveta. */
const DONO = /ownerSel|txOwnerF|lprops_own|>Proprietário<|faixa-ambito|nav-ambito|Proprietário em foco|escolherAmbito|limparAmbito|quota-parte de/;

describe('a gaveta e o topo', () => {
  beforeEach(semear);

  test('com dois proprietários, a gaveta não tem «Proprietário em foco», e as funções dele saíram', () => {
    const html = app.gavetaHtml([]);
    assert.doesNotMatch(html, /nav-ambito|Proprietário em foco|escolherAmbito/);
    for (const n of ['gavetaAmbito', 'escolherAmbito', 'faixaDoAmbito', 'imvFiltroDono', 'onTxOwner', 'ownerBar']) {
      assert.equal(typeof app[n], 'undefined', n + ' saiu');
    }
  });

  test('nada na app escreve o ownerFilter a não ser para o pôr a \'\': nenhum valor de antes pode filtrar um ecrã às escondidas', () => {
    /* era o ambitoSemDono que o largava fora do IRS; com o titular do IRS fora
       (KAN-73) já não há quem o escreva, e é isso que se guarda aqui */
    const web = new URL('../web/', import.meta.url);
    const js = (d) => readdirSync(new URL(d, web), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? js(d + e.name + '/') : e.name.endsWith('.js') ? [d + e.name] : []);
    const escritas = [];
    for (const f of js('')) {
      for (const m of readFileSync(new URL(f, web), 'utf8').matchAll(/\bownerFilter\s*=(?!=)\s*([^;,)}\n]+)/g)) {
        escritas.push([f, m[1].trim()]);
      }
    }
    assert.ok(escritas.length >= 3, 'o teste vê as escritas (' + escritas.length + ')');
    assert.deepEqual(escritas.filter(([, v]) => v !== "''"), [], 'só se escreve vazio');
    for (const n of ['ambitoSemDono', 'limparAmbito', 'onOwnerFilter', 'anaSelDono']) assert.equal(typeof app[n], 'undefined', n + ' saiu');
    // e a lista, sem nada à mão, tem os dois imóveis, sem faixa
    const fixos = elementos(app);
    app.tab = 'properties';
    app.render();
    const html = fixos.view.innerHTML;
    assert.doesNotMatch(html, /faixa-ambito|Quota \d/);
    assert.match(html, /T2 Lisboa/);
    assert.match(html, /T1 Porto/);
  });

  test('o IRS · Anexo F não tem titular a escolher: o painel só tem o ano, e o ponto do funil só o conta a ele', () => {
    elementos(app);
    app.tab = 'fisco';
    app.render();
    const html = app.vFisco();
    assert.doesNotMatch(html, /ownerSel|Todos os proprietários|limparAmbito/);
    assert.match(html, /id="sel_fiscoSel"/);
    assert.equal(app.ANA_N(), 0);
    app.go('dashboard');
    assert.equal(app.ownerFilter, '');
  });
});

describe('nenhum painel de filtros tem «Proprietário»', () => {
  beforeEach(semear);

  test('as listas, os Movimentos e as análises, de painel aberto', () => {
    const fixos = elementos(app);
    const listas = { properties: 'lprops', contracts: 'lcts', visits: 'lvis', recurring: 'lrec', credits: 'lcred' };
    for (const t of Object.keys(listas).concat(['transactions', 'dashboard', 'projections', 'reports'])) {
      app.fecharFiltros();
      app.tab = t;
      if (listas[t]) app.lf(listas[t])._open = true;
      else if (t === 'transactions') app.txFiltAberto = true;
      else app.anaOpen[t] = true;
      app.render();
      assert.doesNotMatch(fixos.view.innerHTML, DONO, t);
    }
    app.txFiltAberto = false;
  });

  test('Imóveis: sem o chip nem o campo, e sem o seletor dos filtros comuns, que ali não tinha o que aplicar', () => {
    app.db.settings.filters = [{ id: 'F1', name: 'Rendas', kind: 'income', prop: '', cat: '', sub: '', de: '', ate: '' }];
    const h = app.vProperties();
    assert.doesNotMatch(h, DONO);
    assert.doesNotMatch(h, /fcAplicar/);
    assert.match(h, /id="sel_lfc_lprops_st"/, 'o chip do estado fica');
    // a pesquisa encontra-os pelo nome dos donos
    app.lf('lprops').q = 'bruno';
    const so = app.vProperties();
    assert.match(so, /T1 Porto/);
    assert.doesNotMatch(so, /T2 Lisboa/);
    app.lf('lprops').q = '';
  });

  test('Movimentos: o «Pago ou recebido por» fica; o «Proprietário» não, nem conta, nem se resume', () => {
    const corpo = app.txFilterBody();
    assert.match(corpo, /Pago ou recebido por<div class="sel" id="sel_txPaidF">/);
    assert.doesNotMatch(corpo, /txOwnerF|>Proprietário</);
    app.ownerFilter = 'o2';   // posto à mão (nada na app o escreve): não conta nem se resume
    assert.equal(app.txFilterCount(), 0);
    assert.equal(app.filterSummary(), '');
    app.ownerFilter = '';
    app.tab = 'transactions';
    assert.equal(app.db.transactions.filter(app.txMatch).length, 2);
    app.txPaid = 'o2';
    assert.equal(app.txFilterCount(), 1);
    app.clearTxFilters();
    assert.equal(app.txPaid, '');
  });

  test('Visão geral: o painel tem o imóvel (e o filtro comum), conta só o imóvel; o IRS não tem titular nem filtro comum', () => {
    app.db.settings.filters = [{ id: 'F1', name: 'Lisboa', kind: '', prop: 'p1', cat: '', sub: '', de: '', ate: '' }];
    const bar = app.dashBar();
    assert.doesNotMatch(bar, /ownerSel/);
    assert.match(bar, /id="sel_fcAplicar"/);
    assert.match(bar, /id="sel_dashPropSel"/);
    // os proprietários vão no seletor do imóvel, como os imóveis de cada um, e só aqui
    assert.match(bar, /<span>Proprietário · Bruno Dono<\/span>/);
    assert.doesNotMatch(app.anaChips({ id: 'projSel', valor: '', aplicar: 'onProjProp', limpar: 'x()', dos: 'da projeção' }), /Proprietário ·/);
    app.tab = 'dashboard';
    app.dashProp = 'g:o:o2';
    assert.equal(app.dashAnaN(), 1, 'um proprietário no seletor conta como o imóvel em foco');
    assert.equal(app.ownerFilter, '', 'e não liga o filtro global');
    app.dashProp = 'p1';
    assert.equal(app.dashAnaN(), 1);
    app.ownerFilter = 'o1';
    assert.equal(app.dashAnaN(), 1, 'um proprietário não conta');
    app.ownerFilter = '';
    assert.equal(typeof app.anaSelDono, 'undefined', 'o seletor do titular saiu com ele (KAN-73)');
    assert.doesNotMatch(app.vFisco(), /ownerSel|fcAplicar|Família/, 'a Declaração: sem titular, sem grupos, sem filtro comum');
    assert.doesNotMatch(app.anaPanel('<i></i>'), /fcAplicar/, 'sem o segundo argumento, sem filtro comum');
  });
});

describe('os filtros comuns', () => {
  beforeEach(semear);

  test('o formulário não tem o proprietário, e guardar tira o de um filtro de antes', () => {
    const abrir = app.openModal;
    let corpo = '';
    app.openModal = (t, b) => { corpo = b; };
    app.db.settings.filters = [{ id: 'F1', name: 'Do Bruno', kind: 'income', prop: '', owner: 'o2', cat: '', sub: '', de: '', ate: '' }];
    try { app.fcModal('F1'); } finally { app.openModal = abrir; }
    assert.doesNotMatch(corpo, /fc_owner|Proprietário/);
    assert.match(corpo, /<label>Categoria<div class="sel" id="sel_fc_cat">/, 'a categoria sozinha, a toda a largura');
    assert.equal(app.fcResumo(app.db.settings.filters[0]), 'Receita', 'o resumo não diz o proprietário');
    assert.equal(app.fcForm.owner, 'o2', 'a cópia em edição ainda o traz');
    app.fcColher = () => {};   // o formulário já está no fcForm; sem DOM para colher
    app.closeModal = () => {}; app.render = () => {}; app.toast = () => {}; app.save = () => {};
    app.fcGuardar();
    assert.ok(!('owner' in app.db.settings.filters[0]), 'a chave saiu');
    assert.equal(app.db.settings.filters[0].kind, 'income');
  });

  test('aplicar um filtro guardado com proprietário aplica o resto e ignora o proprietário', () => {
    app.render = () => {}; app.toast = () => {}; app.txRerender = () => {};
    app.db.settings.filters = [{ id: 'F1', name: 'Do Bruno', kind: 'income', prop: 'p2', owner: 'o2', cat: '', sub: '', de: '', ate: '' }];
    app.tab = 'transactions';
    app.aplicarFiltroComum('F1');
    assert.equal(app.txFilter, 'income');
    assert.equal(app.txProp, 'p2');
    assert.equal(app.ownerFilter, '');
    assert.ok(app.txComumLigado(app.db.settings.filters[0]), 'ligado pelo que se aplica, sem o proprietário');
    app.tab = 'dashboard';
    app.aplicarFiltroComum('F1');
    assert.equal(app.dashProp, 'p2');
    assert.equal(app.ownerFilter, '');
    app.tab = 'properties';
    app.aplicarFiltroComum('F1');
    assert.ok(!('own' in app.lf('lprops')), 'a lista dos imóveis não ganha um filtro escondido');
    // um filtro que só tinha o proprietário já não fixa nada
    const so = { id: 'F2', name: 'Só dono', kind: '', prop: '', owner: 'o2', cat: '', sub: '', de: '', ate: '' };
    assert.equal(app.fcResumo(so), '');
    app.txFilter = ''; app.txProp = '';
    assert.ok(!app.txComumLigado(so));
  });
});

describe('o botão do cabeçalho', () => {
  /* O #hdrFilt com classes, atributos e título que se leem.
     Recebe: a — a app.
     Devolve: o botão falso. */
  function cabecalho(a) {
    const hb = a.document.getElementById('hdrFilt');
    const cls = new Set(), atr = {};
    hb.classList = { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, v) => (v ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) };
    hb.setAttribute = (k, v) => { atr[k] = String(v); };
    hb.getAttribute = (k) => (k in atr ? atr[k] : null);
    hb.removeAttribute = (k) => { delete atr[k]; };
    hb.title = 'Filtros e parâmetros';
    hb.atr = atr; hb.cls = cls;
    return hb;
  }

  test('a camada do painel despe só o «Concluir» que vestiu: a roda das Projeções guarda o nome', () => {
    const nuvem = carregarTudo({ hoje: '2026-09-06' });
    limpar(nuvem);
    const hb = cabecalho(nuvem);
    nuvem.tab = 'projections';
    nuvem.pintarBotaoFiltros();
    nuvem.patchHdr();
    assert.equal(hb.title, 'Opções da projeção');
    assert.equal(hb.atr['aria-label'], 'Opções da projeção');
    // a edição da visão geral veste o «Concluir»; ao sair, despe-o
    nuvem.tab = 'dashboard';
    nuvem.CW.editMode = true;
    nuvem.patchHdr();
    assert.equal(hb.atr['aria-label'], 'Concluir a edição dos cartões');
    assert.equal(hb.title, 'Terminar a edição dos cartões');
    nuvem.CW.editMode = false;
    nuvem.patchHdr();
    assert.equal(hb.title, 'Filtros e parâmetros');
    assert.ok(!('aria-label' in hb.atr));
    // um nome que não é o dele fica
    hb.setAttribute('aria-label', 'Selecionar vários'); hb.title = 'Selecionar vários';
    nuvem.patchHdr();
    assert.equal(hb.atr['aria-label'], 'Selecionar vários');
    assert.equal(hb.title, 'Selecionar vários');
  });
});
