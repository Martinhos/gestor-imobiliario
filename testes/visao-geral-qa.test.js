// A Visão geral depois das decisões de 2026-10-28. As entradas e saídas vão
// de janeiro a dezembro: o mês corrente e os passados são o registado, e os
// seguintes mostram o que os planeados preveem, esbatidos e lidos como
// «previsto» (painel-geral.js:previstoPorMes, graficos.js:cBars). O cashflow
// acumulado continua a acabar no mês corrente, e os quatro indicadores não
// levam previsões. O seletor do topo filtra também por proprietário — «Os
// meus» e cada proprietário com quem partilho, os imóveis de que é
// comproprietário (painel-geral.js:dashOpcoesImovel, registos.js:pidProps) —,
// e as Projeções e a Avaliação continuam sem proprietários.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, igual } from './arnes.js';

const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
afterEach(() => { app.dashProp = ''; app.window.CW = undefined; });
const ANO = 2026;

/* O que o esc da app escreveu dentro de um atributo, de volta a texto.
   Recebe: s — o texto escapado.
   Devolve: o texto original. */
const desescapar = (s) => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* Os data-lido dos gráficos de um HTML, já lidos, pela ordem em que aparecem.
   Recebe: html — o HTML da vista.
   Devolve: array de {W, xs, rot, s}. */
function lidos(html) {
  return [...html.matchAll(/data-lido="([^"]*)"/g)].map((m) => JSON.parse(desescapar(m[1])));
}

/* O gráfico das entradas e saídas (o que tem a série «Receita») e o do
   acumulado (uma série sem nome) de uma Visão geral.
   Recebe: html — o HTML da vista.
   Devolve: {barras, acumulado}. */
function graficos(html) {
  const ls = lidos(html);
  const barras = ls.find((d) => d.s.some((x) => x.n === 'Receita'));
  const acumulado = ls.find((d) => d.s.length === 1 && d.s[0].n === '');
  assert.ok(barras, 'há o gráfico das entradas e saídas');
  assert.ok(acumulado, 'há o do cashflow acumulado');
  return { barras, acumulado };
}

/* Os valores escritos de uma série das barras.
   Recebe: d — o data-lido; nome — o nome da série.
   Devolve: os 12 (ou menos) valores em texto. */
const serie = (d, nome) => d.s.find((x) => x.n === nome).v;

/* Os quatro indicadores (a grelha com o aria-label do ano).
   Recebe: html — o HTML da vista.
   Devolve: o HTML da grelha. */
function indicadores(html) {
  const i = html.indexOf('aria-label="Indicadores de ' + ANO + '"');
  assert.ok(i > -1, 'há a grelha dos indicadores');
  // sem os ids dos cartões, que a app numera a cada desenho (k1, k2…)
  return html.slice(i, html.indexOf('<div class="cols">', i)).replace(/\bk\d+\b/g, 'k');
}

/* Dois proprietários: Ana (T2 Lisboa), os dois a meias (T1 Porto) e Bruno
   (T0 Faro); um contrato em Lisboa e uma renda de janeiro. Sem planeados. */
function semear() {
  const db = limpar(app);
  db.owners.push(app.normPerson({ id: 'o1', name: 'Ana Dona' }), app.normPerson({ id: 'o2', name: 'Bruno Dono' }));
  db.owners.forEach((o) => { o._userId = o.id; });
  db.tenants.push(app.normPerson({ id: 't1', name: 'Rui' }));
  db.properties.push(app.normProp({ id: 'p1', name: 'T2 Lisboa', use: 'investimento', rentalMode: 'inteiro', value: 200000, purchase: 150000, ownerIds: ['o1'] }));
  db.properties.push(app.normProp({ id: 'p2', name: 'T1 Porto', use: 'investimento', rentalMode: 'inteiro', value: 120000, purchase: 90000, ownerIds: ['o1', 'o2'] }));
  db.properties.push(app.normProp({ id: 'p3', name: 'T0 Faro', use: 'investimento', rentalMode: 'inteiro', value: 90000, purchase: 70000, ownerIds: ['o2'] }));
  db.contracts.push(app.normContract({ id: 'c1', name: 'Lisboa', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.transactions.push(app.normTx({ id: 'x1', kind: 'income', label: 'Renda Lisboa', category: 'Rendas', amount: 800, propertyId: 'p1', contractId: 'c1', date: ANO + '-01-05' }));
  db.transactions.push(app.normTx({ id: 'x2', kind: 'expense', label: 'Obra Faro', category: 'Obras', amount: 250, propertyId: 'p3', date: ANO + '-03-10' }));
  db.recurring = [];
  return db;
}

/* Os planeados: a renda de Lisboa (mensal, a partir de 8 de setembro), o
   condomínio do Porto (trimestral, a partir de 15 de outubro) e uma prestação
   em Lisboa (mensal, a partir de 20 de setembro). */
function planear() {
  app.db.recurring.push(app.normRec({ id: 'r1', name: 'Renda Lisboa', every: 'month', next: ANO + '-09-08', tx: { kind: 'income', label: 'Renda Lisboa', category: 'Rendas', amount: 800, propertyId: 'p1', contractId: 'c1' } }));
  app.db.recurring.push(app.normRec({ id: 'r2', name: 'Condomínio Porto', every: 'quarter', next: ANO + '-10-15', tx: { kind: 'expense', label: 'Condomínio Porto', category: 'Condomínio', amount: 120, propertyId: 'p2' } }));
  app.db.recurring.push(app.normRec({ id: 'r3', name: 'Prestação Lisboa', every: 'month', next: ANO + '-09-20', tx: { kind: 'loan', label: 'Prestação Lisboa', amount: 300, propertyId: 'p1' } }));
}

describe('as entradas e saídas, de janeiro a dezembro', () => {
  beforeEach(semear);

  test('doze meses; os depois do corrente (setembro) vêm dos planeados, esbatidos e lidos como previstos', () => {
    planear();
    const html = app.vDashboard();
    const { barras } = graficos(html);
    igual(barras.rot, ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out · previsto', 'nov · previsto', 'dez · previsto']);
    const e = (v) => app.euro2(v);
    igual(serie(barras, 'Receita'), [e(800), e(0), e(0), e(0), e(0), e(0), e(0), e(0), e(0), e(800), e(800), e(800)], 'o mês corrente é o registado; out, nov e dez a renda planeada');
    igual(serie(barras, 'Despesas'), [e(0), e(0), e(-250), e(0), e(0), e(0), e(0), e(0), e(0), e(-120), e(0), e(0)], 'o condomínio trimestral só cai em outubro');
    igual(serie(barras, 'Prestações'), [e(0), e(0), e(0), e(0), e(0), e(0), e(0), e(0), e(0), e(-300), e(-300), e(-300)]);
    // as colunas previstas (out, nov, dez) vão cada uma no seu <g> esbatido: 3 + 2 + 2 barras
    const esbatidas = [...html.matchAll(/<g class="gprevista">([\s\S]*?)<\/g>/g)].map((m) => (m[1].match(/<rect class="gbar/g) || []).length);
    igual(esbatidas, [3, 2, 2]);
    assert.equal((html.match(/<rect class="gbar/g) || []).length, 2 + 7, 'as registadas (jan e mar) ficam fora dos <g>');
    assert.match(html, /<div class="li  prevista"\s*><span class="dot"><\/span>\s*<span class="nm">previsto<\/span>/, 'a legenda diz «previsto»');
    assert.match(html, /<title>out · previsto · Receita: /, 'a dica também');
    assert.match(html, /aria-label="Entradas e saídas \(previsto de out em diante\), de jan a dez\./);
  });

  test('sem planeados os meses seguintes ficam a zero, mas estão lá', () => {
    const { barras } = graficos(app.vDashboard());
    assert.equal(barras.rot.length, 12);
    igual(serie(barras, 'Receita').slice(9), [app.euro2(0), app.euro2(0), app.euro2(0)]);
  });

  test('uma renda já lançada para um mês futuro conta como hoje, e o planeado não a conta outra vez', () => {
    planear();
    app.db.transactions.push(app.normTx({ id: 'x3', kind: 'income', label: 'Renda Lisboa', category: 'Rendas', amount: 800, propertyId: 'p1', contractId: 'c1', date: ANO + '-11-01' }));
    const html = app.vDashboard();
    const { barras, acumulado } = graficos(html);
    igual(serie(barras, 'Receita').slice(9), [app.euro2(800), app.euro2(800), app.euro2(800)], 'novembro tem uma renda, não duas');
    assert.equal(acumulado.rot.length, 11, 'o acumulado vai até ao último mês com movimento, como antes');
    assert.match(indicadores(html), new RegExp(app.euro2(1600).replace(/\s/g, '\\s')), 'a Receita conta a de novembro, como sempre');
  });

  test('um planeado silenciado, um que acaba antes e um de outro imóvel em foco ficam de fora', () => {
    planear();
    app.db.recurring.find((r) => r.id === 'r2').muted = true;
    app.db.recurring.find((r) => r.id === 'r3').end = ANO + '-10-31';
    const p = app.previstoPorMes(null);
    igual(p.expense.slice(9), [0, 0, 0]);
    igual(p.loan.slice(8), [0, 300, 0, 0], 'a prestação acaba em outubro; setembro é o registado');
    igual(app.previstoPorMes('p3').income, Array(12).fill(0));
    igual(app.previstoPorMes('g:o:o1').income.slice(9), [800, 800, 800], 'o proprietário de Lisboa tem a renda');
    igual(app.previstoPorMes('g:o:o2').income.slice(9), [0, 0, 0]);
  });

  test('o cashflow acumulado e os quatro indicadores são os mesmos com e sem planeados', () => {
    const antes = app.vDashboard();
    planear();
    const depois = app.vDashboard();
    assert.equal(indicadores(depois), indicadores(antes));
    igual(graficos(depois).acumulado, graficos(antes).acumulado);
    const acc = graficos(depois).acumulado;
    igual(acc.rot, ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'], 'acaba no mês corrente');
    assert.equal(acc.s[0].v[8], app.euro2(800 - 250));
  });
});

describe('o seletor da Visão geral filtra por proprietário', () => {
  beforeEach(semear);

  /* As opções do seletor da Visão geral, como o dashBar as deixou.
     Devolve: array de {v, label} ou {div}. */
  const opcoes = () => { app.dashBar(); return JSON.parse(JSON.stringify(app.window.__sel.dashPropSel.options)); };

  test('depois dos grupos, outra linha, «Os meus» e cada proprietário com quem partilho', () => {
    app.db.groups.push(app.normGroup({ id: 'G1', name: 'Norte', kind: 'prop', ids: ['p2'] }));
    const ops = opcoes();
    igual(ops.map((o) => o.div ? '—' : o.label), ['Todos os imóveis', 'T2 Lisboa', 'T1 Porto', 'T0 Faro', '—', 'Grupo · Norte', '—', 'Os meus', 'Proprietário · Ana Dona', 'Proprietário · Bruno Dono']);
    igual(ops.filter((o) => !o.div).slice(-3).map((o) => o.v), ['g:o:*', 'g:o:o1', 'g:o:o2']);
    assert.match(app.dashBar(), /id="sel_dashPropSel"/);
    assert.match(app.dashBar(), /class="fpanel /, 'o painel é o das análises (vistas.js:anaPanel)');
  });

  test('com sessão: sem mim na lista, «Os meus» são as casas de que sou dono ou comproprietário', () => {
    app.window.CW = { user: { id: 'o1' }, cargos: { p3: { dono: false, nome: 'Gestor', perms: ['tx.view', 'report.view'] } }, pessoas: {} };
    igual(app.donosComPartilha().map((o) => o.id), ['o2']);
    const ops = opcoes().filter((o) => !o.div).map((o) => o.label);
    igual(ops.slice(-2), ['Os meus', 'Proprietário · Bruno Dono']);
    igual(app.pidProps('g:o:*').map((p) => p.id), ['p1', 'p2']);
  });

  test('sem proprietários, ou sem nenhum com imóveis no âmbito, não há a secção', () => {
    app.db.owners.length = 0;
    assert.ok(!opcoes().some((o) => String(o.v || '').startsWith('g:o:')));
    assert.ok(!opcoes().some((o) => o.div), 'sem grupos nem proprietários, nenhuma linha');
    app.db.owners.push(app.normPerson({ id: 'o9', name: 'Carla Sem Casas' }));
    assert.ok(!opcoes().some((o) => String(o.v || '').startsWith('g:o:')), 'uma pessoa sem casas não abre a secção');
  });

  test('o filtro de um proprietário dá os imóveis de que é comproprietário, e a vista conta só esses', () => {
    igual(app.pidProps('g:o:o1').map((p) => p.id), ['p1', 'p2']);
    igual(app.pidProps('g:o:o2').map((p) => p.id), ['p2', 'p3']);
    igual(app.pidProps('g:o:zz'), []);
    igual(app.pidProps('g:o:'), [], 'sem conta não é ninguém');
    assert.equal(app.pidDono('g:o:o2'), 'o2');
    assert.equal(app.pidDono('g:G1'), '');
    const m = app.metrics(ANO, 'g:o:o2', { share: true });
    assert.equal(m.income, 0, 'a renda de Lisboa não é do Bruno');
    assert.equal(m.op, 250, 'a obra de Faro é');
    assert.equal(m.value, 120000 + 90000, 'por inteiro, sem quota-parte');
    app.dashProp = 'g:o:o2';
    const html = app.vDashboard();
    assert.equal(app.dashProp, 'g:o:o2');
    assert.match(html, /<h3 class="title vg-tit">Proprietário · Bruno Dono<\/h3>/, 'o Portefólio diz o proprietário');
    const i = html.indexOf('Cashflow por imóvel');
    assert.ok(i > -1, 'vários imóveis: o cashflow por imóvel aparece');
    const porImovel = html.slice(i, html.indexOf('Renda por contrato', i));
    assert.match(porImovel, /T1 Porto/);
    assert.match(porImovel, /T0 Faro/);
    assert.doesNotMatch(porImovel, /T2 Lisboa/, 'Lisboa não é do Bruno');
    app.dashProp = 'g:o:*';
    assert.match(app.vDashboard(), /<h3 class="title vg-tit">Os meus imóveis<\/h3>/);
  });

  test('um proprietário sem imóveis no âmbito larga-se, como um imóvel que saiu', () => {
    app.dashProp = 'g:o:zz';
    app.vDashboard();
    assert.equal(app.dashProp, '');
  });

  test('as Projeções e a Avaliação ficam sem proprietários', () => {
    assert.ok(!JSON.parse(JSON.stringify(app.anaOpcoesImovel())).some((o) => String(o.v || '').startsWith('g:o:')));
    for (const id of ['projSel', 'repSel']) {
      const h = app.anaChips({ id, valor: '', aplicar: 'onProjProp', limpar: 'x()', dos: 'da projeção' });
      assert.doesNotMatch(h, /Proprietário ·|Os meus|g:o:/, id);
    }
  });
});
