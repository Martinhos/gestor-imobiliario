// Os gráficos mês a mês mostram os últimos 12 meses de registos (a decisão
// do Martinho de 2026-11-01, tickets de QA a814718f e 6d8d079c): a janela
// (metricas.js:janelaMeses), a série nela (mensalNaJanela), os rótulos com a
// divisão da passagem de ano (rotulosDaJanela, graficos.js:divisoesSvg) e os
// indicadores, que mostram na silhueta e na janela os mesmos meses
// (vistas.js:evoMoney, silhuetaKpi, kpiModal).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, igual, perto } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp({ hoje: '2026-11-01' });
afterEach(() => repor(app));

const mes = (j) => j.map((x) => x.y + '-' + String(x.m).padStart(2, '0'));

beforeEach(() => {
  const db = limpar(app);
  db.properties.push(app.normProp({ id: 'p1', name: 'T2', value: 200000 }));
  db.transactions.push(app.normTx({ id: 'a', kind: 'income', category: 'Rendas', amount: 700, propertyId: 'p1', date: '2025-12-05' }));
  db.transactions.push(app.normTx({ id: 'b', kind: 'income', category: 'Rendas', amount: 800, propertyId: 'p1', date: '2026-01-05' }));
  db.transactions.push(app.normTx({ id: 'c', kind: 'expense', category: 'Obras', amount: 300, propertyId: 'p1', date: '2026-10-20' }));
  db.transactions.push(app.normTx({ id: 'd', kind: 'income', category: 'Rendas', amount: 500, propertyId: 'p1', date: '2025-11-05' }));
});

describe('a janela de meses', () => {
  test('sem ano, os últimos 12 meses a acabar no mês corrente', () => {
    igual(mes(app.janelaMeses()), ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  });
  test('com o ano corrente, de janeiro até ao mês corrente; com outro, jan–dez', () => {
    igual(mes(app.janelaMeses(2026)), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    igual(mes(app.janelaMeses('2025')), [...Array(12)].map((_, i) => '2025-' + String(i + 1).padStart(2, '0')));
  });
  test('um movimento de data futura no ano estende o fim até ele, e só os que contam', () => {
    app.db.transactions.push(app.normTx({ id: 'f', kind: 'income', category: 'Rendas', amount: 50, propertyId: 'p1', date: '2026-12-10' }));
    igual(mes(app.janelaMeses()).slice(-2), ['2026-11', '2026-12']);
    assert.equal(app.janelaMeses().length, 12);
    igual(mes(app.janelaMeses(null, (t) => t.id !== 'f')).slice(-1), ['2026-11'], 'o filtro de quem conta manda');
  });
  test('um movimento futuro que não conta nos totais (uma caução) não estende a janela', () => {
    app.db.transactions.push(app.normTx({ id: 'g', kind: 'income', category: 'Rendas', sub: 'Caução', amount: 900, propertyId: 'p1', date: '2026-12-01' }));
    assert.equal(app.countsInTotals(app.db.transactions.at(-1)), false, 'controlo: a caução não conta nos totais');
    igual(mes(app.janelaMeses(null, () => true)).slice(-1), ['2026-11']);
  });
  test('a série na janela tem o peso do monthly, e o mês de antes da janela não entra', () => {
    const jan = app.janelaMeses();
    const inc = app.mensalNaJanela(jan, null, 'income', true);
    assert.equal(inc.length, 12);
    perto(inc[0], 700); perto(inc[1], 800);
    perto(inc.reduce((a, b) => a + b, 0), 1500, 1e-9, 'a renda de novembro de 2025 fica de fora');
    perto(app.mensalNaJanela(jan, null, 'expense', true)[10], 300);
  });
  test('os rótulos: o eixo só o mês, a leitura com o ano, e a divisão antes de janeiro', () => {
    const r = app.rotulosDaJanela(app.janelaMeses());
    assert.equal(r.eixo[0], 'dez'); assert.equal(r.eixo[1], 'jan');
    assert.equal(r.ler[0], 'dez 2025'); assert.equal(r.ler[11], 'nov 2026');
    igual(r.divisoes, [{ i: 1, label: '2026' }]);
    igual(app.rotulosDaJanela(app.janelaMeses(2025)).divisoes, [], 'um ano só não tem divisão');
  });
});

describe('a divisão nos gráficos', () => {
  const grupos = [1, 2, 3].map((v) => [{ label: 'Receita', value: v, color: '#0a0' }]);
  test('o cBars e o cLine desenham a linha tracejada com o ano, só onde pedida', () => {
    const b = app.cBars(grupos, ['nov', 'dez', 'jan'], { divisoes: [{ i: 2, label: '2026' }] });
    assert.equal((b.match(/class="gdivisao"/g) || []).length, 1);
    assert.match(b, /<line class="gdivisao" [^>]*stroke="var\(--line2\)"[^>]*stroke-dasharray="3 3"\/><text [^>]*>2026<\/text>/);
    const l = app.cLine([{ name: 'A', values: [1, 2, 3] }], ['nov', 'dez', 'jan'], { divisoes: [{ i: 2, label: '2026' }] });
    assert.equal((l.match(/class="gdivisao"/g) || []).length, 1);
    for (const d of [[], [{ i: 0, label: 'x' }], [{ i: 3, label: 'x' }]]) {
      assert.doesNotMatch(app.cBars(grupos, ['a', 'b', 'c'], { divisoes: d }), /gdivisao/, JSON.stringify(d));
    }
  });
  test('o cBars lê os rótulos por extenso, com o eixo curto', () => {
    const b = app.cBars(grupos, ['nov', 'dez', 'jan'], { rotulos: ['nov 2025', 'dez 2025', 'jan 2026'] });
    const lido = JSON.parse(/data-lido="([^"]*)"/.exec(b)[1].replace(/&quot;/g, '"'));
    igual(lido.rot, ['nov 2025', 'dez 2025', 'jan 2026']);
    assert.match(b, /<title>jan 2026 · Receita: /);
    assert.match(b, />jan<\/text>/, 'o eixo fica curto');
  });
  test('no cBars a linha fica na fronteira entre as colunas; no cLine a meio dos pontos', () => {
    const xDe = (html) => Number(/<line class="gdivisao" x1="([\d.]+)"/.exec(html)[1]);
    const b = app.cBars(grupos, ['a', 'b', 'c'], { divisoes: [{ i: 1 }] });
    const xs = JSON.parse(/data-lido="([^"]*)"/.exec(b)[1].replace(/&quot;/g, '"')).xs;
    perto(xDe(b), (xs[0] + xs[1]) / 2, 0.11);
    const l = app.cLine([{ name: 'A', values: [1, 2, 3] }], ['a', 'b', 'c'], { divisoes: [{ i: 2 }] });
    const ls = JSON.parse(/data-lido="([^"]*)"/.exec(l)[1].replace(/&quot;/g, '"')).xs;
    perto(xDe(l), (ls[1] + ls[2]) / 2, 0.11);
  });
});

describe('os indicadores: a silhueta e a janela com os mesmos meses (6d8d079c)', () => {
  test('o evoMoney dá os 12 meses da janela, com os rótulos e a divisão', () => {
    const s = app.evoMoney('income', null);
    assert.equal(s.monthly.length, 12);
    igual(s.meses.ler.slice(0, 2), ['dez 2025', 'jan 2026']);
    igual(s.divisoes, [{ i: 1, label: '2026' }]);
    perto(s.monthly[0], 700);
    const cf = app.evoMoney('cf', null);
    perto(cf.monthly[10], -300, 1e-9, 'o cashflow de outubro desconta a obra');
  });
  test('a janela do indicador desenha os mesmos meses que a silhueta, com «Últimos 12 meses»', () => {
    const html = app.vDashboard();
    const abertas = janelasFalsas(app, 'render', 'toast');
    const id = /<div class="card kpi evo vg-kpi[^"]*" id="(k\d+)"/.exec(html)[1];
    app.kpiModal(id);
    const b = abertas[0].b;
    assert.match(b, /<div class="flabel">Últimos 12 meses<\/div>/);
    const lido = JSON.parse(/data-lido="([^"]*)"/.exec(b)[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'));
    const s = app.evoMoney('income', null);
    assert.equal(lido.rot.length, s.monthly.length, 'o mesmo número de meses');
    igual(lido.rot, [...s.meses.ler]);
    assert.match(b, /class="gdivisao"/, 'a divisão antes de janeiro');
  });
  test('a silhueta tem um ponto por mês da janela e o traço da passagem de ano', () => {
    const s = app.evoMoney('income', null);
    const svg = app.silhuetaKpi(s.monthly, s.divisoes);
    const pts = /points="([^"]*)"/.exec(svg)[1].trim().split(' ');
    assert.equal(pts.length, 12);
    assert.equal((svg.match(/class="kdivisao"/g) || []).length, 1);
    assert.doesNotMatch(app.silhuetaKpi(s.monthly), /kdivisao/, 'sem divisões, sem traço');
  });
});
