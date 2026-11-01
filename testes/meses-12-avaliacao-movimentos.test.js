// A Avaliação e os Movimentos nos últimos 12 meses (a decisão do Martinho de
// 2026-11-01, ticket de QA a814718f): o «Rendas e despesas» da Avaliação (do
// portefólio e de um imóvel) mostra os últimos 12 meses de registos com a
// divisão tracejada antes de janeiro (avaliacao.js:avaGraficos); nos
// Movimentos, as séries mensais dos cartões seguem o chip Período
// (lista-movimentos.js:txJanelaDoPeriodo): um ano dá esse ano, sem período os
// últimos 12 meses, um intervalo os meses dele (no máximo 12, até ao fim dele
// ou até hoje) — e a silhueta do cartão e a janela mostram os mesmos meses.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, igual, perto } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp({ hoje: '2026-11-01' });
afterEach(() => repor(app));

const DEZ_A_NOV = ['dez 2025', 'jan 2026', 'fev 2026', 'mar 2026', 'abr 2026', 'mai 2026', 'jun 2026', 'jul 2026', 'ago 2026', 'set 2026', 'out 2026', 'nov 2026'];
const ANO_2025 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].map((m) => m + ' 2025');

const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ kind: 'income', category: 'Rendas', amount: 100, propertyId: 'p1' }, extra)));

beforeEach(() => {
  const db = limpar(app);
  app.repProp = '';
  app.txFiltrosLimpar();
  db.properties.push(app.normProp({ id: 'p1', name: 'T2', value: 200000 }), app.normProp({ id: 'p2', name: 'T3', value: 300000 }));
  mov({ id: 'a', amount: 500, date: '2025-11-05' });        // um mês antes da janela
  mov({ id: 'b', amount: 700, date: '2025-12-05' });
  mov({ id: 'c', amount: 800, date: '2026-01-05' });
  mov({ id: 'd', kind: 'expense', category: 'Obras', amount: 100, date: '2026-03-15' });
  mov({ id: 'e', kind: 'expense', category: 'Obras', amount: 200, date: '2026-06-10' });
  mov({ id: 'f', kind: 'expense', category: 'Obras', amount: 300, date: '2026-10-20' });
  mov({ id: 'g', kind: 'loan', category: 'Crédito', amount: 400, date: '2026-02-10' });
  mov({ id: 'h', amount: 400, date: '2024-05-05' });
  mov({ id: 'i', amount: 999, propertyId: 'p2', date: '2026-02-05' });
});

// o data-lido de um pedaço de HTML (o primeiro gráfico dele)
const lidoDe = (html) => JSON.parse(/data-lido="([^"]*)"/.exec(html)[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'));
// a posição x da divisão tracejada de um gráfico
const xDivisao = (html) => Number(/<line class="gdivisao" x1="([\d.]+)"/.exec(html)[1]);
// o cartão «Rendas e despesas» de um HTML da Avaliação
function rendasEDespesas(html) {
  const i = html.indexOf('<h2 class="ana-tit">Rendas e despesas</h2>');
  assert.ok(i > -1, 'o cartão «Rendas e despesas» está lá');
  return html.slice(i, html.indexOf('</section>', i));
}
const serie = (lido, nome) => lido.s.find((x) => x.n === nome).v;

describe('Avaliação: «Rendas e despesas» nos últimos 12 meses', () => {
  test('no portefólio: 12 colunas de dez 2025 a nov 2026, a divisão antes de jan e «Últimos 12 meses»', () => {
    const c = rendasEDespesas(app.portCard(null));
    assert.match(c, /<span class="small">Últimos 12 meses<\/span>/);
    assert.doesNotMatch(c, /Mês a mês em/);
    const lido = lidoDe(c);
    igual(lido.rot, DEZ_A_NOV, 'a leitura diz o mês e o ano');
    assert.match(c, />dez<\/text>/, 'o eixo só o mês');
    assert.equal((c.match(/class="gdivisao"/g) || []).length, 1);
    assert.match(c, /<line class="gdivisao" [^>]*\/><text [^>]*>2026<\/text>/, 'com o ano novo ao lado');
    perto(xDivisao(c), (lido.xs[0] + lido.xs[1]) / 2, 0.11, 'entre dez e jan');
    const r = serie(lido, 'Rendas');
    assert.equal(r[0], app.euro(700));
    assert.equal(r[1], app.euro(800));
    assert.equal(r[2], app.euro(999), 'o portefólio leva o T3');
    assert.ok(!r.includes(app.euro(500)), 'novembro de 2025 fica de fora');
    assert.equal(serie(lido, 'Despesas')[10], app.euro(-300));
    assert.equal(serie(lido, 'Prestação')[2], app.euro(-400));
  });

  test('na avaliação de um imóvel: a mesma janela, só com os movimentos dele', () => {
    const c = rendasEDespesas(app.repCard(app.db.properties[0]));
    assert.match(c, /<span class="small">Últimos 12 meses<\/span>/);
    const lido = lidoDe(c);
    igual(lido.rot, DEZ_A_NOV);
    assert.equal((c.match(/class="gdivisao"/g) || []).length, 1);
    assert.equal(serie(lido, 'Rendas')[2], app.euro(0), 'a renda do T3 não entra no T2');
    assert.equal(serie(lido, 'Rendas')[1], app.euro(800));
  });

  test('um movimento de data futura de outro imóvel não estende a janela deste', () => {
    mov({ id: 'futuro', amount: 50, propertyId: 'p2', date: '2026-12-10' });
    const port = lidoDe(rendasEDespesas(app.portCard(null))).rot;
    assert.equal(port[11], 'dez 2026', 'o portefólio vai até dezembro');
    assert.equal(port[0], 'jan 2026');
    igual(lidoDe(rendasEDespesas(app.repCard(app.db.properties[0]))).rot, DEZ_A_NOV, 'o T2 acaba em novembro');
  });

  test('a estrutura das despesas continua a ser do ano', () => {
    const html = app.portCard(null);
    assert.match(html, /<h2 class="ana-tit">Estrutura de despesas<\/h2><span class="small">Gastos do ano<\/span>/);
  });
});

describe('Movimentos: as séries mensais dos cartões pelo chip Período', () => {
  // abre a janela de cada cartão e devolve, por título, a evolução e o corpo
  function cartoes() {
    const abertas = janelasFalsas(app, 'render', 'toast');
    const html = app.vTransactions();
    const ids = (html.match(/<div class="card kpi[^"]*" id="(k\d+)"/g) || []).map((m) => /id="(k\d+)"/.exec(m)[1]);
    assert.ok(ids.length >= 4, 'os cartões estão lá');
    return ids.map((id) => {
      const evo = app.KPI_REG[id].evo();
      app.kpiModal(id);
      const j = abertas[abertas.length - 1];
      // o «Mês a mês» é o primeiro bloco com título da janela
      const blocos = j.b.split('<div class="flabel">');
      return { titulo: j.t, evo, mensal: blocos[1] };
    });
  }
  // a evolução do cartão das Receitas com o filtro de agora
  const receitas = () => cartoes().find((c) => c.titulo === 'Receitas').evo;
  const daJanela = (c) => lidoDe(c.mensal).rot;
  const pontos = (svg) => /points="([^"]*)"/.exec(svg)[1].trim().split(' ').length;

  test('sem período: cada cartão com os últimos 12 meses, a divisão, e a silhueta com os mesmos meses', () => {
    const cs = cartoes();
    for (const c of cs) {
      assert.equal(c.evo.monthly.length, 12, c.titulo);
      igual(c.evo.meses.ler, DEZ_A_NOV, c.titulo);
      igual(c.evo.divisoes, [{ i: 1, label: '2026' }], c.titulo);
      assert.equal(c.evo.mesTitulo, 'Últimos 12 meses', c.titulo);
      assert.match(c.mensal, /^Últimos 12 meses<\/div>/, c.titulo);
      igual(daJanela(c), DEZ_A_NOV, 'a janela de ' + c.titulo);
      assert.equal((c.mensal.match(/class="gdivisao"/g) || []).length, 1, c.titulo);
      const svg = app.silhuetaKpi(c.evo.monthly, c.evo.divisoes);
      assert.equal(pontos(svg), daJanela(c).length, 'a silhueta de ' + c.titulo + ' com os meses da janela');
      assert.equal((svg.match(/class="kdivisao"/g) || []).length, 1);
    }
    const rec = cs.find((c) => c.titulo === 'Receitas').evo;
    perto(rec.monthly[0], 700); perto(rec.monthly[1], 800); perto(rec.monthly[2], 999);
    perto(rec.monthly.reduce((a, b) => a + b, 0), 2499, 1e-9, 'novembro de 2025 fica de fora');
    const saldo = cs.find((c) => c.titulo === 'Saldo').evo;
    perto(saldo.monthly[2], 999 - 400, 1e-9, 'o saldo de fevereiro desconta a prestação');
    perto(saldo.monthly[10], -300);
    const anos = cs.find((c) => c.titulo === 'Receitas').evo.yearly.map((y) => y.label);
    igual(anos, [2024, 2025, 2026], 'o ano a ano fica como estava');
  });

  test('com o Período 2025: jan–dez de 2025, sem divisão, «Mês a mês em 2025»', () => {
    app.txDe = '2025-01-01'; app.txAte = '2025-12-31';
    assert.equal(app.txAnoDoFiltro(), '2025');
    for (const c of cartoes()) {
      igual(c.evo.meses.ler, ANO_2025, c.titulo);
      igual(c.evo.divisoes, [], c.titulo);
      assert.match(c.mensal, /^Mês a mês em 2025<\/div>/, c.titulo);
      igual(daJanela(c), ANO_2025, c.titulo);
      assert.doesNotMatch(c.mensal, /gdivisao/, c.titulo);
    }
    const rec = cartoes().find((c) => c.titulo === 'Receitas').evo;
    perto(rec.monthly.reduce((a, b) => a + b, 0), 1200, 1e-9, 'só 2025: a renda de 2024 fica de fora');
    perto(rec.monthly[10], 500); perto(rec.monthly[11], 700);
    assert.equal(pontos(app.silhuetaKpi(rec.monthly, rec.divisoes)), 12, 'a silhueta das Receitas com os 12 meses de 2025');
  });

  test('com o Período 2026 (o ano corrente): de janeiro até novembro', () => {
    app.txDe = '2026-01-01'; app.txAte = '2026-12-31';
    const jan = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov'].map((m) => m + ' 2026');
    for (const c of cartoes()) {
      igual(c.evo.meses.ler, jan, c.titulo);
      igual(c.evo.divisoes, [], c.titulo);
      assert.match(c.mensal, /^Mês a mês em 2026<\/div>/, c.titulo);
      igual(daJanela(c), jan, c.titulo);
    }
  });

  test('um intervalo de 2026-03-10 a 2026-06-20: de março a junho', () => {
    app.txDe = '2026-03-10'; app.txAte = '2026-06-20';
    const marJun = ['mar 2026', 'abr 2026', 'mai 2026', 'jun 2026'];
    const cs = cartoes();
    for (const c of cs) {
      igual(c.evo.meses.ler, marJun, c.titulo);
      assert.equal(c.evo.mesTitulo, 'De mar 2026 a jun 2026', c.titulo);
      igual(daJanela(c), marJun, c.titulo);
    }
    const desp = cs.find((c) => c.titulo === 'Despesas').evo.monthly;
    igual([...desp], [100, 0, 0, 200]);
  });

  test('um intervalo de 2024-01-01 a 2026-11-01: os 12 meses até novembro', () => {
    app.txDe = '2024-01-01'; app.txAte = '2026-11-01';
    for (const c of cartoes()) {
      igual(c.evo.meses.ler, DEZ_A_NOV, c.titulo);
      igual(c.evo.divisoes, [{ i: 1, label: '2026' }], c.titulo);
      assert.equal(c.evo.mesTitulo, 'De dez 2025 a nov 2026', c.titulo);
    }
  });

  test('só «até»: os 12 meses até lá; só «desde»: desde lá até hoje; um mês só diz «Em …»', () => {
    app.txAte = '2026-04-30';
    let rec = receitas();
    assert.equal(rec.meses.ler[0], 'mai 2025');
    assert.equal(rec.meses.ler[11], 'abr 2026');
    app.txAte = ''; app.txDe = '2026-09-01';
    mov({ id: 'set', amount: 10, date: '2026-09-02' });
    rec = receitas();
    igual(rec.meses.ler, ['set 2026', 'out 2026', 'nov 2026']);
    assert.equal(rec.mesTitulo, 'De set 2026 a nov 2026');
    app.txDe = '2026-03-01'; app.txAte = '2026-03-31';
    rec = receitas();
    igual(rec.meses.ler, ['mar 2026']);
    assert.equal(rec.mesTitulo, 'Em mar 2026');
  });

  test('um movimento de data futura no filtro estende o fim, e um fora do filtro não', () => {
    mov({ id: 'futuro', amount: 50, date: '2026-12-10' });
    let rec = receitas();
    assert.equal(rec.meses.ler[11], 'dez 2026', 'sem período, até dezembro');
    app.txDe = '2026-09-01';
    rec = receitas();
    igual(rec.meses.ler, ['set 2026', 'out 2026', 'nov 2026', 'dez 2026'], 'só com «desde», também');
    perto(rec.monthly[3], 50);
    app.txAte = '2026-11-30';
    rec = receitas();
    assert.equal(rec.meses.ler[rec.meses.ler.length - 1], 'nov 2026', 'o «até» corta o futuro');
  });
});
