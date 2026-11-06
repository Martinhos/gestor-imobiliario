// Os filtros das listas, pelos tickets de QA de 2026-11-05: «Pago ou recebido
// por X» mostra só os movimentos de X, também com uma pesquisa, e a pesquisa
// junta-se a cada um dos outros filtros, nos Movimentos e nas outras listas; o
// «Limpar» aparece sempre que há alguma coisa para limpar, pesquisa incluída,
// também no telemóvel; o Enter da pesquisa aplica logo e fecha o teclado; e o
// painel arruma-se em secções sem nome, com o «De» ao lado do «Até» e o
// «Ordenar por» ao lado da «Ordem».

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, elementos, igual } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
const ANO = new Date().getFullYear();

/* Os filtros dos Movimentos todos a zero, e o painel fechado.
   Recebe: nada.
   Devolve: nada. */
function zero() {
  app.txFilter = ''; app.txProp = ''; app.txPaid = ''; app.txCat = ''; app.txSub = ''; app.txNoPayer = true;
  app.txSearch = ''; app.txDe = ''; app.txAte = ''; app.txEtiq = []; app.txSort = 'date'; app.txDir = 'desc';
  app.txFiltAberto = false; app.ownerFilter = '';
}

/* Dois proprietários, dois imóveis (o segundo num grupo), um filtro comum e
   oito movimentos: sete com «renda» na descrição, de tipos, imóveis,
   categorias, etiquetas, datas e pessoas diferentes — dois sem pessoa
   atribuída (T3 e T5) —, e um sem («Luz», T4), para cada filtro ter dentro
   da pesquisa o que deixar passar e o que cortar.
   Recebe: nada.
   Devolve: nada — enche o db. */
function semearMovimentos() {
  const db = limpar(app);
  db.owners.push(app.normPerson({ id: 'O1', name: 'Martinho' }), app.normPerson({ id: 'O2', name: 'Ana' }));
  db.properties.push(app.normProp({ id: 'P1', name: 'T2 Lisboa', ownerIds: ['O1'] }), app.normProp({ id: 'P2', name: 'Casa Porto', ownerIds: ['O2'] }));
  db.groups.push(app.normGroup({ id: 'G1', name: 'Norte', kind: 'prop', ids: ['P2'] }));
  db.settings.filters = [{ id: 'F1', name: 'Rendas de Lisboa', kind: 'income', prop: 'P1' }];
  const tx = (o) => app.normTx(o);
  db.transactions = [
    tx({ id: 'T1', kind: 'income', label: 'Renda março', amount: 800, propertyId: 'P1', date: '2026-03-08', paidBy: 'O1', category: 'Rendas', sub: 'Mensal', tags: ['Urgente'] }),
    tx({ id: 'T2', kind: 'income', label: 'Renda abril', amount: 800, propertyId: 'P2', date: '2026-04-08', paidBy: 'O2', category: 'Rendas', sub: 'Atrasada' }),
    tx({ id: 'T3', kind: 'expense', label: 'Seguro da renda', amount: 55, propertyId: 'P1', date: '2026-03-09', category: 'Seguros' }),
    tx({ id: 'T4', kind: 'expense', label: 'Luz', amount: 40, propertyId: 'P1', date: '2026-03-10', paidBy: 'O1', category: 'Serviços' }),
    tx({ id: 'T5', kind: 'owed', label: 'Renda adiantada', amount: 300, date: '2026-05-01', creditor: 'Rui' }),
    tx({ id: 'T6', kind: 'repay', label: 'Devolução da renda', amount: 100, propertyId: 'P2', date: '2026-06-01', paidBy: 'O1', tags: ['Dedutível'] }),
    tx({ id: 'T7', kind: 'expense', label: 'Limpeza da renda', amount: 60, groupId: 'G1', date: '2026-06-15', paidBy: 'O2' }),
    tx({ id: 'T8', kind: 'settle', label: 'Acerto da renda', amount: 50, propertyId: 'P1', date: '2026-07-01', paidBy: 'O2', toId: 'O1' }),
  ];
  zero();
}

/* Os movimentos que passam nos filtros, pelos dois caminhos: o juiz
   (txMatch) e as linhas que a vista pinta (txLista), por ordem de id.
   Recebe: nada.
   Devolve: array de ids; rebenta se os dois caminhos não baterem certo. */
function ids() {
  const juiz = app.db.transactions.filter(app.txMatch).map((t) => t.id).sort();
  app.vTransactions();
  const linhas = [...app.txLista].map((t) => t.id).sort();
  assert.deepEqual(linhas, juiz, 'a vista pinta o que o txMatch deixa passar');
  return juiz;
}

/* A interseção de duas listas de ids, por ordem.
   Recebe: a, b — arrays de ids.
   Devolve: array de ids. */
const juntos = (a, b) => a.filter((x) => b.includes(x)).sort();

describe('«Pago ou recebido por X» são só os movimentos de X (ea46d9cd)', () => {
  beforeEach(semearMovimentos);

  test('com uma pessoa escolhida, os movimentos sem pessoa ficam de fora, com e sem pesquisa', () => {
    app.txPaid = 'O1';
    igual(ids(), ['T1', 'T4', 'T6', 'T8'], 'pagos ou recebidos (o T8 recebido) pelo Martinho, e nenhum sem pessoa');
    app.txSearch = 'renda';
    igual(ids(), ['T1', 'T6', 'T8'], 'com a pesquisa vinham também o T3 e o T5, que não têm pessoa');
    app.txNoPayer = false;
    igual(ids(), ['T1', 'T6', 'T8'], 'o interruptor não entra na conta com uma pessoa escolhida');
    app.txPaid = 'O2'; app.txNoPayer = true;
    igual(ids(), ['T2', 'T7', 'T8'], 'a outra pessoa: o T8 pago por ela');
  });

  test('com uma pessoa escolhida o interruptor sai do painel, não conta no funil nem no «Limpar», e o chip «Só com pessoa atribuída» não aparece', () => {
    app.txNoPayer = false;
    assert.match(app.txFilterBody(), /id="txNoPayer"/, 'sem pessoa, o interruptor está no painel');
    assert.match(app.txChipsHtml(), /Só com pessoa atribuída/);
    assert.equal(app.txFilterCount(), 1);
    app.txPaid = 'O2';
    assert.doesNotMatch(app.txFilterBody(), /id="txNoPayer"|Incluir movimentos sem pessoa/, 'com uma pessoa, sai');
    assert.doesNotMatch(app.txChipsHtml(), /Só com pessoa atribuída/);
    assert.equal(app.txFilterCount(), 1, 'conta só a pessoa');
    assert.equal(app.txFiltrosN(), 1);
    assert.match(app.txBarraHtml(), /aria-label="Filtros: 1 ativo"/);
    assert.equal(app.filterSummary(), 'pago/recebido por Ana');
    // sem pessoa, o interruptor volta como estava e funciona como sempre
    app.txPaid = '';
    assert.match(app.txFilterBody(), /id="txNoPayer" role="switch" aria-checked="false"/);
    igual(ids(), ['T1', 'T2', 'T4', 'T6', 'T7', 'T8']);
    assert.equal(app.txFilterCount(), 1);
  });
});

/* Cada filtro dos Movimentos com a pesquisa «renda»: o rótulo, o que o liga e
   os ids que passam nos dois. */
const MATRIZ = [
  ['tipo: receitas', () => { app.txFilter = 'income'; }, ['T1', 'T2']],
  ['tipo: despesas', () => { app.txFilter = 'expense'; }, ['T3', 'T7']],
  ['tipo: dívidas (recebidas e pagas)', () => { app.txFilter = 'debt'; }, ['T5', 'T6']],
  ['tipo: transferências', () => { app.txFilter = 'settle'; }, ['T8']],
  ['imóvel', () => { app.txProp = 'P1'; }, ['T1', 'T3', 'T8']],
  ['grupo', () => { app.txProp = 'g:G1'; }, ['T2', 'T6', 'T7']],
  ['sem imóvel', () => { app.txProp = '__none__'; }, ['T5']],
  ['categoria', () => { app.txCat = 'Rendas'; }, ['T1', 'T2']],
  ['sem categoria', () => { app.txCat = '__none__'; }, ['T5', 'T6', 'T7', 'T8']],
  ['subcategoria', () => { app.txCat = 'Rendas'; app.txSub = 'Mensal'; }, ['T1']],
  ['sem subcategoria', () => { app.txCat = 'Seguros'; app.txSub = '__none__'; }, ['T3']],
  ['uma etiqueta', () => { app.txEtiq = ['Urgente']; }, ['T1']],
  ['duas etiquetas (basta uma)', () => { app.txEtiq = ['Urgente', 'Dedutível']; }, ['T1', 'T6']],
  ['datas, as duas pontas', () => { app.txDe = '2026-04-01'; app.txAte = '2026-05-31'; }, ['T2', 'T5']],
  ['datas, só desde', () => { app.txDe = '2026-06-01'; }, ['T6', 'T7', 'T8']],
  ['datas, só até', () => { app.txAte = '2026-03-31'; }, ['T1', 'T3']],
  ['pago ou recebido por', () => { app.txPaid = 'O1'; }, ['T1', 'T6', 'T8']],
  ['pago ou recebido por outra pessoa', () => { app.txPaid = 'O2'; }, ['T2', 'T7', 'T8']],
  ['só com pessoa atribuída', () => { app.txNoPayer = false; }, ['T1', 'T2', 'T6', 'T7', 'T8']],
  ['filtro comum', () => { app.tab = 'transactions'; app.txRerender = () => {}; app.toast = () => {}; app.aplicarFiltroComum('F1'); }, ['T1']],
];

describe('a pesquisa junta-se a cada filtro dos Movimentos', () => {
  beforeEach(semearMovimentos);

  for (const [rotulo, liga, esperado] of MATRIZ) {
    test('pesquisa + ' + rotulo, () => {
      app.txSearch = 'renda';
      const soPesquisa = ids();
      zero(); liga();
      const soFiltro = ids();
      zero(); app.txSearch = 'renda'; liga();
      assert.equal(app.txSearch, 'renda', 'ligar o filtro não larga a pesquisa');
      const os2 = ids();
      igual(os2, esperado);
      igual(os2, juntos(soPesquisa, soFiltro), 'é o que passa na pesquisa E no filtro');
    });
  }

  test('a pesquisa sozinha deixa de fora só o que não fala de renda', () => {
    app.txSearch = 'renda';
    igual(ids(), ['T1', 'T2', 'T3', 'T5', 'T6', 'T7', 'T8']);
  });
});

/* As outras listas com uma pesquisa e um filtro cada: dois proprietários
   com imóveis e dois sem, quatro imóveis (dois por quartos), quatro
   inquilinos, quatro contratos (dois em vigor, um por começar e um
   terminado), quatro visitas, três planeados e três hipotecas (uma
   liquidada). Cada filtro deixa passar um registo que a pesquisa corta, e o
   contrário.
   Recebe: nada.
   Devolve: nada — enche o db. */
function semearListas() {
  const db = limpar(app);
  for (const k of Object.keys(app.listF)) delete app.listF[k];
  app.credSel = ''; app.credPagas = true;
  const hoje = app.pzHoje();
  db.owners.push(app.normPerson({ id: 'o1', name: 'Ana Dona' }), app.normPerson({ id: 'o2', name: 'Pedro Dono' }), app.normPerson({ id: 'o3', name: 'Ana Sem Casa' }),
    app.normPerson({ id: 'o4', name: 'Rita Sem Imóveis' }));
  const l1 = app.normLoan({ id: 'l1', name: 'Aquisição', bank: 'Banco Azul', outstanding: 50000, years: 20, type: 'fixa', rate: 3, start: '2020-01-10' });
  const l2 = app.normLoan({ id: 'l2', name: 'Obras', bank: 'Banco Verde', outstanding: 0, years: 5, type: 'fixa', rate: 4, start: '2015-01-10' });
  const l3 = app.normLoan({ id: 'l3', name: 'Campo', bank: 'Banco Azul', outstanding: 30000, years: 15, type: 'variavel', rate: 3, start: '2021-01-10' });
  db.properties.push(app.normProp({ id: 'p1', name: 'T2 Lisboa', use: 'investimento', rentalMode: 'inteiro', ownerIds: ['o1'], value: 200000, loans: [l1, l2] }));
  db.properties.push(app.normProp({ id: 'p2', name: 'Casa do Campo', use: 'proprio', ownerIds: ['o2'], value: 90000, loans: [l3] }));
  db.properties.push(app.normProp({ id: 'p3', name: 'T1 Lisboa Baixa', use: 'investimento', rentalMode: 'quartos', ownerIds: ['o1'], value: 150000 }));
  db.properties.push(app.normProp({ id: 'p4', name: 'Quartos do Porto', use: 'investimento', rentalMode: 'quartos', ownerIds: ['o2'], value: 120000 }));
  db.tenants.push(app.normPerson({ id: 't1', name: 'Rui Inquilino' }), app.normPerson({ id: 't2', name: 'Sofia Lopes' }), app.normPerson({ id: 't3', name: 'Rui Sem Contrato' }),
    app.normPerson({ id: 't4', name: 'Marta Silva' }));
  db.contracts.push(app.normContract({ id: 'c1', name: 'Arrendamento', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.contracts.push(app.normContract({ id: 'c2', name: 'Futuro', propertyId: 'p1', tenantIds: ['t2'], rent: 750, start: (ANO + 2) + '-01-01', active: true }));
  db.contracts.push(app.normContract({ id: 'c3', name: 'Antigo', propertyId: 'p3', tenantIds: ['t2'], rent: 700, start: (ANO - 4) + '-01-01', end: (ANO - 3) + '-12-31', active: false }));
  db.contracts.push(app.normContract({ id: 'c4', name: 'Quarto 1', propertyId: 'p4', tenantIds: ['t1'], rent: 400, start: (ANO - 1) + '-06-01', active: true }));
  db.visits.push(app.normVisit({ id: 'v1', nomes: 'Bruno Lima', propertyId: 'p1', date: hoje, start: '15:00' }));
  db.visits.push(app.normVisit({ id: 'v2', nomes: 'Bruno Costa', propertyId: 'p1', date: '2001-01-01', start: '10:00', estado: 'realizada', resultado: 'interessado' }));
  db.visits.push(app.normVisit({ id: 'v3', nomes: 'Carla', propertyId: 'p1', date: '2999-01-01', start: '19:00' }));
  db.visits.push(app.normVisit({ id: 'v4', nomes: 'Duarte', propertyId: 'p4', date: '2002-01-01', start: '11:00', estado: 'realizada' }));
  db.recurring.push(app.normRec({ id: 'r1', name: 'Renda do Rui', every: 'month', next: '2999-01-05', tx: { kind: 'income', label: 'Renda do Rui', amount: 800, propertyId: 'p1' } }));
  db.recurring.push(app.normRec({ id: 'r2', name: 'Renda do seguro', every: 'month', next: '2999-01-05', tx: { kind: 'expense', label: 'Renda do seguro', amount: 30, propertyId: 'p1' } }));
  db.recurring.push(app.normRec({ id: 'r3', name: 'Limpeza', every: 'month', next: '2999-01-05', tx: { kind: 'income', label: 'Limpeza', amount: 30, propertyId: 'p1' } }));
}

/* Cada lista: o nome, a chave, a vista, como se leem os registos pintados, a
   pesquisa, o filtro e o que passa nos dois. */
const LISTAS = [
  ['Imóveis', 'lprops', 'vProperties', /data-lp="prop:(\w+)"/g, 'lisboa', { md: 'quartos' }, ['p3']],
  ['Contratos', 'lcts', 'vContracts', /data-lp="ct:(\w+)"/g, 'lisboa', { st: 'on' }, ['c1']],
  ['Inquilinos', 'lten', 'vTenants', /data-lp="per:tenant:(\w+)"/g, 'rui', { ct: 'sem' }, ['t3']],
  ['Proprietários', 'lown', 'vOwners', /data-lp="per:owner:(\w+)"/g, 'ana', { pr: 'sem' }, ['o3']],
  ['Visitas', 'lvis', 'vVisits', /data-lp="vis:(\w+)"/g, 'bruno', { es: 'realizada' }, ['v2']],
  ['Planeados', 'lrec', 'vRecurring', /data-lp="rec:(\w+)"/g, 'renda', { k: 'income' }, ['r1']],
  ['Créditos', 'lcred', 'vCredits', /data-lp="mort:(\w+:\w+)"/g, 'lisboa', { st: 'on' }, ['p1:l1']],
];

describe('a pesquisa junta-se a um filtro de cada lista', () => {
  beforeEach(semearListas);

  for (const [nome, k, vista, re, q, filtro, esperado] of LISTAS) {
    test(nome + ': pesquisa + ' + Object.keys(filtro).join(', '), () => {
      const pintados = () => [...new Set([...app[vista]().matchAll(re)].map((m) => m[1]))].sort();
      const repoe = () => { for (const x of Object.keys(app.lf(k))) delete app.lf(k)[x]; };
      repoe(); app.lf(k).q = q;
      const soPesquisa = pintados();
      repoe(); Object.assign(app.lf(k), filtro);
      const soFiltro = pintados();
      repoe(); app.lf(k).q = q; Object.assign(app.lf(k), filtro);
      const os2 = pintados();
      igual(os2, esperado);
      igual(os2, juntos(soPesquisa, soFiltro), 'é o que passa na pesquisa E no filtro');
      assert.ok(soPesquisa.length > os2.length && soFiltro.length > os2.length, 'cada um corta alguma coisa ao outro: ' + soPesquisa + ' / ' + soFiltro);
    });
  }
});

/* O «Limpar» da fila, se o há: as classes do botão.
   Recebe: h — o HTML da fila.
   Devolve: o atributo class do «Limpar», ou null sem ele. */
function limparDaFila(h) {
  const m = /<button type="button" class="(chip limpar[^"]*)"[^>]*>Limpar<\/button>/.exec(h || '');
  return m ? m[1] : null;
}

describe('o «Limpar» aparece sempre que há alguma coisa para limpar (aca2564c, 9d5c886e)', () => {
  beforeEach(semearMovimentos);

  test('Movimentos: um chip ligado, um filtro só do painel ou só a pesquisa, em todos os ecrãs', () => {
    assert.equal(limparDaFila(app.txChipsHtml()), null, 'sem nada, não há');
    const casos = [
      ['um chip rápido (o tipo)', () => { app.txFilter = 'income'; }],
      ['as etiquetas', () => { app.txEtiq = ['Urgente']; }],
      ['o «Pago por»', () => { app.txPaid = 'O1'; }],
      ['só com pessoa atribuída', () => { app.txNoPayer = false; }],
      ['as datas', () => { app.txDe = '2026-01-01'; }],
      ['só a pesquisa', () => { app.txSearch = 'renda'; }],
    ];
    for (const [rotulo, liga] of casos) {
      zero(); liga();
      assert.equal(limparDaFila(app.txChipsHtml()), 'chip limpar', rotulo + ': o «Limpar» à vista em todos os ecrãs');
      assert.match(app.txFilterBody(), /<button type="button" class="btn ghost" data-toca="vista" data-click="clearTxFilters\(\)">Limpar<\/button>/, rotulo + ': e no cabeçalho do painel');
    }
    zero(); app.txSearch = '   ';
    assert.equal(limparDaFila(app.txChipsHtml()), null, 'uma pesquisa só de espaços não é nada');
  });

  test('Movimentos: o «Limpar» limpa também a pesquisa e o campo dela', () => {
    const fixos = elementos(app);
    app.refrescarMovimentos = () => null;
    fixos.tx_q.value = 'renda';
    fixos.tx_q.nextElementSibling = { classList: { toggle() {} } };
    app.txSearch = 'renda'; app.txFilter = 'income';
    app.clearTxFilters();
    assert.equal(app.txSearch, '');
    assert.equal(app.txFilter, '');
    assert.equal(fixos.tx_q.value, '');
  });

  test('as listas: o «Limpar» com um chip, com um filtro só do painel e só com a pesquisa; sem chips rápidos, a fila fica só com ele', () => {
    for (const x of Object.keys(app.listF)) delete app.listF[x];
    const o = { dos: 'dos imóveis', campos: [{ chave: 'st', nome: 'Estado', rapido: true, opcoes: [{ v: '', label: 'Todos' }, { v: 'vago', label: 'Vagos' }] },
      { chave: 'g', nome: 'Grupo', opcoes: [{ v: '', label: 'Todos' }, { v: 'x', label: 'X' }] }] };
    const fila = () => app.lfChipsHtml('lprops', o, app.lfCampos('lprops', o));
    const cab = () => app.lfPainelCorpo('lprops', o, app.lfCampos('lprops', o));
    const limparCab = /<button type="button" class="btn ghost" data-toca="vista" data-click="lfClear\('lprops'\)">Limpar<\/button>/;
    assert.equal(limparDaFila(fila()), null, 'sem nada, não há');
    assert.doesNotMatch(cab(), limparCab);
    for (const [rotulo, estado] of [['um chip', { st: 'vago' }], ['um filtro só do painel', { g: 'x' }], ['só a pesquisa', { q: 'mar' }]]) {
      for (const x of Object.keys(app.lf('lprops'))) delete app.lf('lprops')[x];
      Object.assign(app.lf('lprops'), estado);
      assert.equal(limparDaFila(fila()), 'chip limpar', rotulo + ': em todos os ecrãs');
      assert.match(cab(), limparCab, rotulo + ': e no cabeçalho do painel');
    }
    // uma lista sem chips rápidos: sem nada, nenhuma fila; com a pesquisa ou um filtro, a fila só com o «Limpar»
    const semChips = { dos: 'das coisas', campos: [{ chave: 'g', nome: 'Grupo', opcoes: [{ v: '', label: 'Todos' }, { v: 'x', label: 'X' }] }] };
    const filaSem = () => app.lfChipsHtml('lown', semChips, app.lfCampos('lown', semChips));
    assert.equal(filaSem(), '');
    app.lf('lown').q = 'ana';
    assert.equal(filaSem(), '<div class="chips-fila mov-chips" role="group" aria-label="Filtros das coisas"><button type="button" class="chip limpar" data-toca="vista" data-click="lfClear(\'lown\')">Limpar</button></div>');
    app.lf('lown').q = ''; app.lf('lown').g = 'x';
    assert.equal(limparDaFila(filaSem()), 'chip limpar');
  });

  test('as listas de verdade: só com a pesquisa, o «Limpar» está na fila de cada uma', () => {
    semearListas();
    for (const [nome, k, vista, , q] of LISTAS) {
      app.lf(k).q = q;
      assert.equal(limparDaFila(app[vista]()), 'chip limpar', nome);
    }
  });

  test('a folha não esconde o «Limpar» no telemóvel', () => {
    assert.doesNotMatch(css, /\.chip\.limpar\.mov-so-largo/);
  });
});

describe('o Enter na pesquisa aplica e fecha o teclado (9d5c886e)', () => {
  beforeEach(semearMovimentos);

  test('o campo da pesquisa leva o Enter, nos Movimentos e nas listas', () => {
    assert.match(app.txBarraHtml(), /<input id="tx_q" type="search"[^>]*enterkeyhint="search"[^>]*data-keydown="txqTecla\(event,this\.value\)"/);
    assert.match(app.lfBarraHtml('lprops', {}), /<input id="lq_lprops" type="search"[^>]*enterkeyhint="search"[^>]*data-keydown="lqTecla\(event,'lprops',this\.value\)"/);
  });

  test('Movimentos, no telemóvel: o Enter aplica já o que se escreveu, sem esperar, e tira o foco ao campo', async () => {
    const fixos = elementos(app);
    let pintou = 0, largou = 0, parou = 0;
    app.refrescarMovimentos = () => { pintou++; return null; };
    fixos.tx_q.blur = () => { largou++; };
    app.onTxSearch('ren');
    app.txqTecla({ key: 'a', preventDefault() { parou++; } }, 'ren');
    assert.deepEqual([pintou, largou, parou], [0, 0, 0], 'outra tecla não faz nada');
    app.txqTecla({ key: 'Enter', preventDefault() { parou++; } }, 'renda');
    assert.equal(app.txSearch, 'renda', 'aplicou o que estava no campo');
    assert.deepEqual([pintou, largou, parou], [1, 1, 1], 'repintou, largou o foco (o teclado fecha) e travou o Enter');
    await new Promise((r) => setTimeout(r, 330));
    assert.equal(pintou, 1, 'a espera dos 280 ms morreu: não repinta outra vez');
    assert.equal(app.txSearch, 'renda', 'nem volta ao «ren» que estava à espera');
  });

  test('Movimentos, com rato e teclado: o Enter aplica e o foco fica no campo, sem se perder para a página', () => {
    const fixos = elementos(app);
    let largou = 0, focou = 0;
    app.refrescarMovimentos = () => null;
    app.matchMedia = (q) => ({ matches: /hover:\s*hover/.test(q) && /pointer:\s*fine/.test(q) });
    fixos.tx_q.blur = () => { largou++; };
    fixos.tx_q.focus = () => { focou++; };
    app.document.activeElement = fixos.tx_q;
    app.txqTecla({ key: 'Enter', preventDefault() {} }, 'luz');
    assert.equal(app.txSearch, 'luz');
    assert.deepEqual([largou, focou], [0, 0], 'o campo continua com o foco');
    // o campo foi recriado (a via parcial caiu para o render): o foco volta ao novo
    app.document.activeElement = null;
    app.txqTecla({ key: 'Enter', preventDefault() {} }, 'luz');
    assert.deepEqual([largou, focou], [0, 1]);
    // um Enter a compor (um IME) no computador é do IME
    app.txqTecla({ key: 'Enter', isComposing: true, preventDefault() { throw new Error('não'); } }, 'x');
    assert.equal(app.txSearch, 'luz');
  });

  test('as listas, no telemóvel: o Enter aplica já e tira o foco ao campo', async () => {
    semearListas();
    const fixos = elementos(app);
    let pintou = 0, largou = 0;
    app.tab = 'tenants';
    app.refrescarListasVivas = () => { pintou++; return true; };
    fixos.lq_lten.blur = () => { largou++; };
    app.lfSearch('lten', 'ru');
    app.lqTecla({ key: 'Enter', preventDefault() {} }, 'lten', 'rui');
    assert.equal(app.lf('lten').q, 'rui');
    assert.deepEqual([pintou, largou], [1, 1]);
    await new Promise((r) => setTimeout(r, 330));
    assert.equal(pintou, 1, 'a espera morreu');
    assert.equal(app.lf('lten').q, 'rui');
    app.lqTecla({ key: 'Tab', preventDefault() {} }, 'lten', 'x');
    assert.equal(app.lf('lten').q, 'rui', 'só o Enter');
  });
});

/* As secções da grelha de um painel, pela ordem: os ids dos campos de cada
   uma (os seletores pelo id do sel, os de data e de hora pelo do campo).
   Recebe: h — o HTML do corpo do painel.
   Devolve: array de arrays de ids. */
function seccoes(h) {
  return h.split('<div class="mov-grelha mov-seccao">').slice(1)
    .map((s) => [...s.matchAll(/<div class="sel" id="sel_(\w+)"|<input id="(\w+)" type="(?:date|time)"/g)].map((m) => m[1] || m[2]));
}

describe('o painel em secções sem nome (79389e90)', () => {
  beforeEach(semearMovimentos);

  test('Movimentos: os seletores, depois o «De» ao lado do «Até», depois o «Ordenar por» ao lado da «Ordem», e no fim o interruptor', () => {
    let h = app.txFilterBody();
    assert.deepEqual(seccoes(h), [['txPropF', 'txCatF', 'txPaidF'], ['txDeF', 'txAteF'], ['txSortF', 'txDirF']]);
    assert.ok(h.lastIndexOf('mov-seccao') < h.indexOf('class="mov-interr"'), 'o interruptor depois das secções');
    assert.ok(h.indexOf('id="txKind"') < h.indexOf('<div class="mov-grelha mov-seccao">'), 'o tipo e as etiquetas por cima, na sua secção');
    assert.match(h, /<div class="mov-seccao mov-seccao-campos">\s*<div class="mov-campo"><span class="lbl">Filtros comuns<\/span>[\s\S]*?id="txKindL">Tipo<\/span>[\s\S]*?id="txEtiqL">Etiquetas<\/span>/,
      'os filtros comuns, o tipo e as etiquetas numa secção');
    assert.doesNotMatch(h, /<h3|mov-seccao-tit/, 'as secções não têm nome');
    // com a categoria escolhida, a subcategoria entra nos seletores e não empurra as datas
    app.txCat = 'Rendas';
    h = app.txFilterBody();
    assert.deepEqual(seccoes(h), [['txPropF', 'txCatF', 'txSubF', 'txPaidF'], ['txDeF', 'txAteF'], ['txSortF', 'txDirF']]);
    // sem Imóveis nem Proprietários, os seletores encolhem e nenhuma secção fica vazia
    app.definirServicosDesligados(['properties', 'owners']);
    try {
      app.txCat = '';
      h = app.txFilterBody();
      assert.deepEqual(seccoes(h), [['txCatF'], ['txDeF', 'txAteF'], ['txSortF', 'txDirF']]);
      assert.doesNotMatch(h, /mov-interr/);
    } finally { app.definirServicosDesligados([]); }
  });

  test('as listas: os seletores, depois os intervalos aos pares, depois a ordenação; uma secção sem campos não aparece', () => {
    const k = 'lvis';
    for (const x of Object.keys(app.listF)) delete app.listF[x];
    const o = { campos: [{ chave: 'pr', nome: 'Imóvel', opcoes: [{ v: '', label: 'Todos' }] }, { chave: 'h1', nome: 'Hora — de', tipo: 'time', junto: 'h1' },
      { chave: 'd9', nome: 'Dia solto', tipo: 'date' }, { chave: 'h2', nome: 'Hora — até', tipo: 'time', junto: 'h1' }, { chave: 'es', nome: 'Estado', opcoes: [{ v: '', label: 'Todos' }] }],
    ordem: { opcoes: [{ v: 'nome', label: 'Nome' }] } };
    const corpo = () => app.lfPainelCorpo(k, o, app.lfCampos(k, o));
    assert.deepEqual(seccoes(corpo()), [['lfsel_lvis_pr', 'lfsel_lvis_es'], ['lfi_lvis_h1', 'lfi_lvis_h2', 'lfi_lvis_d9'], ['lfsel_lvis_sb']],
      'o par junto, lado a lado, e o solto depois dele');
    app.lf(k).sb = 'nome';
    assert.deepEqual(seccoes(corpo())[2], ['lfsel_lvis_sb', 'lfsel_lvis_sd'], 'a «Ordem» ao lado do «Ordenar por»');
    // só seletores: uma secção, sem divisórias vazias
    const so = { campos: [{ chave: 'es', nome: 'Estado', opcoes: [{ v: '', label: 'Todos' }] }] };
    assert.deepEqual(seccoes(app.lfPainelCorpo('lten', so, app.lfCampos('lten', so))), [['lfsel_lten_es']]);
    assert.doesNotMatch(app.lfPainelCorpo('lown', { campos: [] }, app.lfCampos('lown', { campos: [] })), /mov-seccao/);
  });

  test('as visitas: o imóvel, o estado e o desfecho; depois os dias e as horas, cada par numa linha', () => {
    semearListas();
    const h = app.vVisits();
    const corpo = h.slice(h.indexOf('id="lfp_lvis"'), h.indexOf('<div class="chips-fila mov-chips"'));
    assert.deepEqual(seccoes(corpo), [['lfsel_lvis_pr', 'lfsel_lvis_es', 'lfsel_lvis_rs'], ['lfi_lvis_d1', 'lfi_lvis_d2', 'lfi_lvis_h1', 'lfi_lvis_h2']]);
  });

  test('a folha separa as secções com uma linha fina e espaço, sem título', () => {
    assert.match(css, /\.mov-seccao\+\.mov-seccao\{[^}]*border-top:1px solid var\(--line\)/);
    assert.match(css, /\.mov-seccao-campos\{[^}]*flex-direction:column/);
  });
});
