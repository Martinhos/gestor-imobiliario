// A Visão geral depois das decisões de 2026-11-01. As entradas e saídas e o
// cashflow acumulado mostram os últimos 12 meses de registos, a acabar no mês
// corrente (ou no de um movimento de data futura do ano), com a divisão entre
// dezembro e janeiro (metricas.js:janelaMeses, painel-geral.js:vgSeriesDaJanela).
// Só o registado: os previstos dos planeados saíram, e nenhum mês fica aceso —
// a leitura começa no mês corrente, mesmo vazio no dia 1. O acumulado recomeça
// em janeiro e acaba no valor do cartão Cashflow; os quatro indicadores são do
// ano corrente. O seletor do topo filtra também por proprietário — «Os meus»
// e cada proprietário com quem partilho, os imóveis de que é comproprietário
// (painel-geral.js:dashOpcoesImovel, registos.js:pidProps) —, e as Projeções e
// a Avaliação continuam sem proprietários.

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

/* O cartão de um gráfico mês a mês da Visão geral, pelo título: o subtítulo,
   a coluna que a leitura mostra antes de alguém tocar (data-ler), o data-lido
   e o HTML do cartão até ao fim do desenho.
   Recebe: html — o HTML da vista; titulo — o título do cartão.
   Devolve: {sub, ler, lido, parte}. */
function cartao(html, titulo) {
  const i = html.indexOf('>' + titulo + '</h3>');
  assert.ok(i > -1, 'o cartão ' + titulo);
  const resto = html.slice(i);
  const parte = resto.slice(0, resto.indexOf('</svg>'));
  const sub = /^>[^<]*<\/h3>(?:<span class="small">([^<]*)<\/span>)?/.exec(resto)[1] || '';
  const m = /<div class="chartler fixa" data-ler="(\d+)">/.exec(parte);
  return { sub, ler: m ? Number(m[1]) : -1, lido: lidos(parte)[0], parte };
}

/* Os rótulos do eixo X de um desenho, pela ordem (os <text> ao meio).
   Recebe: parte — o HTML do cartão.
   Devolve: array de texto. */
const eixo = (parte) => [...parte.matchAll(/text-anchor="middle">([^<]*)<\/text>/g)].map((m) => m[1]);

const MESES_DA_JANELA = ['out 2025', 'nov 2025', 'dez 2025', 'jan 2026', 'fev 2026', 'mar 2026', 'abr 2026', 'mai 2026', 'jun 2026', 'jul 2026', 'ago 2026', 'set 2026'];

describe('as entradas e saídas e o acumulado, nos últimos 12 meses', () => {
  beforeEach(semear);

  test('doze meses, de out 2025 a set 2026, com a divisão antes de janeiro e o subtítulo «últimos 12 meses»', () => {
    const html = app.vDashboard();
    const b = cartao(html, 'Entradas e saídas'), a = cartao(html, 'Cashflow acumulado');
    igual(b.lido.rot, MESES_DA_JANELA, 'a leitura diz o mês com o ano');
    igual(a.lido.rot, MESES_DA_JANELA, 'o acumulado tem os mesmos meses');
    assert.equal(b.sub, 'últimos 12 meses');
    for (const c of [b, a]) {
      assert.equal((c.parte.match(/<line class="gdivisao"/g) || []).length, 1, 'uma divisão, a da passagem de ano');
      assert.match(c.parte, /<line class="gdivisao" [^>]*\/><text [^>]*>2026<\/text>/, 'com o ano novo ao lado');
      const ex = eixo(c.parte);
      assert.equal(ex[0], 'out');
      assert.ok(ex.includes('jan') && !ex.some((x) => /\d/.test(x)), 'o eixo leva só o mês');
    }
    const e = (v) => app.euro2(v);
    igual(serie(b.lido, 'Receita'), [0, 0, 0, 800, 0, 0, 0, 0, 0, 0, 0, 0].map(e), 'a renda de janeiro na quarta coluna');
    igual(serie(b.lido, 'Despesas'), [0, 0, 0, 0, 0, -250, 0, 0, 0, 0, 0, 0].map(e));
  });

  test('só o registado: com planeados, nada previsto, e os gráficos e os quatro indicadores iguais', () => {
    const antes = app.vDashboard();
    planear();
    const depois = app.vDashboard();
    assert.equal(indicadores(depois), indicadores(antes));
    igual(graficos(depois), graficos(antes));
    assert.doesNotMatch(depois, /gprevista|· previsto|class="li  prevista"|previsto de /, 'nem colunas esbatidas, nem «previsto» na leitura, na legenda ou na descrição');
    assert.equal(typeof app.previstoPorMes, 'undefined', 'a função dos previstos saiu');
  });

  test('nenhum mês aceso: a leitura das duas começa no mês corrente, mesmo sem movimentos nele', () => {
    const html = app.vDashboard();
    assert.doesNotMatch(html, /gdestaque/);
    for (const t of ['Entradas e saídas', 'Cashflow acumulado']) {
      const c = cartao(html, t);
      assert.equal(c.ler, 11, t + ': setembro, o último da janela, e não março, o último com movimento');
      assert.equal(c.lido.rot[c.ler], 'set 2026');
      assert.match(c.parte, /data-col="11"><b>set 2026<\/b>/, t);
    }
  });

  test('o acumulado recomeça em janeiro: dez 2025 é o ano 2025 inteiro, e o fim bate com o cartão Cashflow', () => {
    app.db.transactions.push(app.normTx({ id: 'x4', kind: 'income', label: 'Renda Lisboa', category: 'Rendas', amount: 1000, propertyId: 'p1', date: (ANO - 1) + '-02-10' }));
    app.db.transactions.push(app.normTx({ id: 'x5', kind: 'expense', label: 'Obra Lisboa', category: 'Obras', amount: 100, propertyId: 'p1', date: (ANO - 1) + '-11-20' }));
    app.db.transactions.push(app.normTx({ id: 'x6', kind: 'loan', label: 'Amortização', amount: 300, propertyId: 'p1', payType: 'amortizacao', date: (ANO - 1) + '-12-10' }));
    const html = app.vDashboard();
    const a = cartao(html, 'Cashflow acumulado');
    const e = (v) => app.euro2(v);
    igual(a.lido.s[0].v, [1000, 900, 600, 800, 800, 550, 550, 550, 550, 550, 550, 550].map(e),
      'out 2025 já leva a renda de fevereiro de 2025 (antes da janela); jan 2026 recomeça do zero');
    assert.equal(a.lido.s[0].v[11], e(app.metrics(ANO, null, { share: true }).cf), 'o último ponto é o do cartão Cashflow');
    assert.equal(a.sub, app.esc('Em dez 2025: amortização de ' + e(300)), 'a nota escreve o mês com o ano');
  });

  test('um movimento de data futura no ano leva a janela até ele (jan–dez, sem divisão)', () => {
    app.db.transactions.push(app.normTx({ id: 'x3', kind: 'income', label: 'Renda Lisboa', category: 'Rendas', amount: 800, propertyId: 'p1', contractId: 'c1', date: ANO + '-12-01' }));
    const html = app.vDashboard();
    const b = cartao(html, 'Entradas e saídas'), a = cartao(html, 'Cashflow acumulado');
    for (const c of [b, a]) {
      assert.equal(c.lido.rot.length, 12);
      assert.equal(c.lido.rot[0], 'jan 2026');
      assert.equal(c.lido.rot[11], 'dez 2026');
      assert.equal(c.ler, 8, 'a leitura continua em setembro');
    }
    assert.doesNotMatch(html, /gdivisao/, 'um ano só não tem divisão');
    assert.equal(a.lido.s[0].v[11], app.euro2(800 + 800 - 250));
    assert.match(indicadores(html), new RegExp(app.euro2(1600).replace(/\s/g, '\\s')), 'a Receita conta a de dezembro, como sempre');
  });

  test('com um proprietário em foco, a janela e o acumulado são os dele', () => {
    app.db.transactions.push(app.normTx({ id: 'x3', kind: 'income', label: 'Renda Lisboa', category: 'Rendas', amount: 800, propertyId: 'p1', contractId: 'c1', date: ANO + '-12-01' }));
    app.dashProp = 'g:o:o2';
    let a = cartao(app.vDashboard(), 'Cashflow acumulado');
    igual(a.lido.rot, MESES_DA_JANELA, 'a renda de dezembro é de Lisboa, que não é do Bruno: a janela acaba no mês corrente');
    assert.equal(a.lido.s[0].v[11], app.euro2(app.metrics(ANO, 'g:o:o2', { share: true }).cf));
    app.dashProp = 'g:o:o1';
    a = cartao(app.vDashboard(), 'Cashflow acumulado');
    assert.equal(a.lido.rot[11], 'dez 2026', 'a da Ana vai até dezembro');
    assert.equal(a.lido.s[0].v[11], app.euro2(app.metrics(ANO, 'g:o:o1', { share: true }).cf));
  });
});

/* No dia 1 o mês corrente ainda está vazio: a leitura ficava no mês anterior,
   e a coluna dele acesa (o ticket de QA 64aeede6, a 1 de novembro). */
const app2 = carregarApp({ hoje: '2026-11-01' });
afterEach(() => repor(app2));

describe('no dia 1 de novembro', () => {
  beforeEach(() => {
    const db = limpar(app2);
    db.properties.push(app2.normProp({ id: 'p1', name: 'T2 Lisboa', use: 'investimento', rentalMode: 'inteiro', value: 200000 }));
    db.transactions.push(app2.normTx({ id: 'a', kind: 'income', label: 'Renda', category: 'Rendas', amount: 700, propertyId: 'p1', date: '2025-12-05' }));
    db.transactions.push(app2.normTx({ id: 'b', kind: 'income', label: 'Renda', category: 'Rendas', amount: 800, propertyId: 'p1', date: '2026-10-05' }));
    db.transactions.push(app2.normTx({ id: 'c', kind: 'expense', label: 'Obra', category: 'Obras', amount: 120, propertyId: 'p1', date: '2026-10-12' }));
    db.recurring = [];
  });

  test('de dez 2025 a nov 2026, nenhum mês aceso e a leitura em «nov 2026», com novembro vazio', () => {
    const html = app2.vDashboard();
    assert.doesNotMatch(html, /gdestaque/, 'outubro não fica aceso');
    for (const t of ['Entradas e saídas', 'Cashflow acumulado']) {
      const c = cartao(html, t);
      assert.equal(c.lido.rot[0], 'dez 2025', t);
      assert.equal(c.ler, 11, t + ': novembro, e não outubro');
      assert.equal(c.lido.rot[c.ler], 'nov 2026', t);
      assert.match(c.parte, /data-col="11"><b>nov 2026<\/b>/, t);
      assert.match(c.parte, /<line class="gdivisao" [^>]*\/><text [^>]*>2026<\/text>/, t + ': a divisão antes de janeiro');
    }
    const b = cartao(html, 'Entradas e saídas');
    assert.equal(serie(b.lido, 'Receita')[11], app2.euro2(0), 'novembro ainda vazio');
    assert.equal(serie(b.lido, 'Receita')[10], app2.euro2(800));
    const a = cartao(html, 'Cashflow acumulado');
    igual(a.lido.s[0].v.slice(0, 2), [app2.euro2(700), app2.euro2(0)], 'dez 2025 é o ano 2025; jan 2026 recomeça');
    assert.equal(a.lido.s[0].v[11], app2.euro2(app2.metrics(2026, null, { share: true }).cf));
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
