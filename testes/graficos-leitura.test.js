// A leitura de um gráfico com o dedo, no canto superior direito do cartão.
// O cLine e o cBars devolvem uma cabeça em grelha — a legenda à esquerda e o
// lugar da leitura à direita, guardado desde a primeira pintura por um molde
// escondido — e, por baixo dela, o desenho: a leitura nunca se sobrepõe ao
// desenho, a mão que o percorre (vem de baixo) não a tapa, e o cartão não
// muda de altura por alguém lhe tocar (graficos.js:cabecaDaLeitura,
// graficos.js:mostrarColuna). Verificações do HTML
// que sai, do gesto com um DOM a fingir, e das regras do CSS que fazem o
// resto; o desenho no ecrã vê-se no browser.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, repor, igual } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app))

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* O que o esc da app escreveu dentro de um atributo, de volta a texto.
   Recebe: s — o texto escapado.
   Devolve: o texto original. */
const desescapar = (s) => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* O data-lido de um gráfico, já lido.
   Recebe: html — o que o cLine/cBars devolveu.
   Devolve: o objeto {W, xs, rot, s}. */
function lido(html) {
  const m = /data-lido="([^"]*)"/.exec(html);
  assert.ok(m, 'o gráfico leva o data-lido');
  return JSON.parse(desescapar(m[1]));
}

/* O interior do molde (a leitura escondida que guarda o lugar).
   Recebe: html — o HTML do gráfico.
   Devolve: o HTML de dentro do molde. */
function molde(html) {
  const m = /<div class="chartlido chartmolde[^"]*" aria-hidden="true">([\s\S]*?)<\/div>/.exec(html);
  assert.ok(m, 'o lugar leva o molde, escondido do leitor de ecrã');
  return m[1];
}

const tres = () => app.cBars([0, 1, 2].map((i) => [
  { label: 'Receita', value: 950, color: '#2f7d5b' },
  { label: 'Despesas', value: -[80, 1080, 12080][i], color: '#c56b68' },
  { label: 'Prestações', value: -0, color: '#d6a34a' },
]), ['jan', 'fev', 'mar'], { h: 190 });

/* Um elemento a fingir, com o que o mostrarColuna usa e a conta das vezes
   que o interior foi reescrito.
   Recebe: nada.
   Devolve: o elemento. */
function elementoLeitura() {
  const atr = {};
  const el = { escritas: 0, _html: '', classes: new Set(), filhos: [], style: {},
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.escritas++; },
    getAttribute: (k) => (k in atr ? atr[k] : null),
    setAttribute: (k, v) => { atr[k] = String(v); },
    classList: null,
    querySelector: () => null,
    appendChild(x) { this.filhos.push(x); return x; },
    closest: () => null,
  };
  el.classList = { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c), contains: (c) => el.classes.has(c) };
  return el;
}

/* Uma caixa de gráfico a fingir, com o data-lido de um gráfico a sério e,
   se pedido, o contentor e a cabeça onde mora a leitura.
   Recebe: html — o HTML do gráfico; comPe — false para uma caixa sem contentor.
   Devolve: {caixa, leitura, seletores} — seletores regista o que se procurou. */
function caixaDe(html, comPe = true) {
  const dados = desescapar(/data-lido="([^"]*)"/.exec(html)[1]);
  const leitura = elementoLeitura();
  const seletores = [];
  const ler = { querySelector: (s) => { seletores.push(s); return s === '.chartlugar>.chartlido:not(.chartmolde)' ? leitura : null; } };
  const caixa = elementoLeitura();
  caixa.getAttribute = (k) => (k === 'data-lido' ? dados : null);
  caixa.querySelector = (s) => (s === '.chartguia' ? caixa.filhos.find((f) => f.className === 'chartguia') || null : null);
  caixa.closest = (s) => (comPe && s === '.chartler' ? ler : null);
  return { caixa, leitura, seletores };
}

describe('a cabeça do gráfico: a legenda à esquerda, o lugar da leitura no canto, o desenho por baixo', () => {
  test('o cBars devolve o contentor com a cabeça (a legenda antes do lugar) e, por baixo, a caixa do desenho', () => {
    const html = tres();
    assert.match(html, /^<div class="chartler"><div class="chartcab/, 'o contentor junta a cabeça e a caixa, a cabeça primeiro');
    const caixa = html.indexOf('<div class="chartbox"');
    const cab = html.indexOf('<div class="chartcab');
    assert.ok(caixa > cab, 'o desenho vem depois da cabeça, fora dela');
    assert.ok(html.indexOf('<div class="legend">') > cab && html.indexOf('<div class="legend">') < caixa, 'a legenda vive na cabeça');
    assert.ok(html.indexOf('<div class="chartlugar">') > html.indexOf('<div class="legend">'), 'e o lugar da leitura à direita dela');
    assert.doesNotMatch(html.slice(caixa), /chartlido/, 'nada da leitura dentro da caixa do desenho');
  });

  test('o lugar existe antes de alguém tocar: o molde e a leitura vazia por cima', () => {
    const html = tres();
    assert.match(html, /<div class="chartlugar"><div class="chartlido chartmolde" aria-hidden="true">[\s\S]*?<\/div><div class="chartlido"><\/div><\/div>/);
  });

  test('o molde tem as linhas que a leitura vai ter: o rótulo e uma por série, com todos os valores de cada uma', () => {
    const m = molde(tres());
    assert.equal((m.match(/<b>/g) || []).length, 1, 'um rótulo');
    assert.equal((m.match(/class="lnm"/g) || []).length, 3, 'três séries, três linhas');
    assert.match(m, /<b><span>jan<\/span><span>fev<\/span><span>mar<\/span><\/b>/, 'o rótulo guarda o lugar de todos os meses');
    assert.match(m, /<span class="lnm">Despesas<\/span><span class="lvl"><span>−80 €<\/span><span>−1 080 €<\/span><span>−12 080 €<\/span><\/span>/,
      'a linha das despesas guarda o lugar de todos os valores, e não só o do primeiro mês');
    assert.match(m, /<span class="lnm">Receita<\/span><span class="lvl"><span>950 €<\/span><\/span>/, 'um valor repetido conta uma vez');
  });

  /* «jan» e «mai» têm as mesmas três letras, e o molde guardava só o texto com
     mais letras — o primeiro, «jan». O «mai», mais largo, saía «m..» na
     leitura do gráfico de linhas. A largura que conta é a do mais LARGO, e só
     o browser a sabe: o molde leva-os todos, empilhados na mesma célula. */
  test('o molde guarda o lugar de todos os rótulos empilhados, e não só do que tem mais letras', () => {
    const html = app.cLine([{ name: 'Acumulado', values: [1, 2, 3, 4, 5] }], ['jan', 'fev', 'mar', 'abr', 'mai']);
    for (const m of ['jan', 'fev', 'mar', 'abr', 'mai']) assert.match(molde(html), new RegExp('<span>' + m + '</span>'));
    assert.match(css, /\.chartmolde>b,\.chartmolde>\.lvl\{display:grid\}/);
    assert.match(css, /\.chartmolde>b>span,\.chartmolde>\.lvl>span\{grid-area:1\/1\}/, 'todos na mesma célula: a largura do mais largo, a altura de uma linha');
  });

  /* As projeções encurtam o ano no eixo («30»), onde não cabem trinta anos
     por extenso; a leitura dizia «30» também, e o Martinho pediu «2030». */
  test('com rotulos, o eixo fica curto e a leitura, a descrição e as dicas dizem o rótulo por extenso', () => {
    const html = app.cLine([{ name: 'Rendas', values: [1, 2, 3] }, { name: 'Cashflow', values: [3, 2, 1] }], ['30', '31', '32'],
      { rotulos: ['2030', '2031', '2032'] });
    assert.deepEqual([...lido(html).rot], ['2030', '2031', '2032'], 'a leitura de cada coluna');
    assert.match(molde(html), /<b><span>2030<\/span><span>2031<\/span><span>2032<\/span><\/b>/, 'o molde guarda o lugar do ano inteiro');
    assert.match(html, /aria-label="Evolução, de 2030 a 2032\./);
    assert.match(html, /<title>2031 · Rendas: /);
    assert.match(html, /text-anchor="middle">31<\/text>/, 'o eixo continua curto');
    assert.doesNotMatch(html, /text-anchor="middle">2031<\/text>/);
  });

  test('sem rotulos, a leitura diz o rótulo do eixo', () => {
    assert.deepEqual([...lido(app.cLine([{ name: 'A', values: [1, 2] }], ['jan', 'fev'])).rot], ['jan', 'fev']);
  });

  test('o molde e o data-lido escrevem os valores com a mesma função — o molde mede o que vai aparecer', () => {
    const fmt = (v) => (v * 100).toFixed(1).replace('.', ',') + '%';
    const html = app.cLine([{ name: 'LTV', values: [0.42, 0.389, 0.1] }, { name: 'Alvo', values: [0.6, 0.6, 0.6] }], ['2026', '2027', '2028'], { fmt });
    const d = lido(html);
    assert.deepEqual([...d.s[0].v], ['42,0%', '38,9%', '10,0%']);
    assert.match(molde(html), /<span class="lnm">LTV<\/span><span class="lvl"><span>42,0%<\/span><span>38,9%<\/span><span>10,0%<\/span><\/span>/);
    assert.doesNotMatch(molde(html), /€/, 'nada de euros num rácio');
  });

  test('uma série só: sem legenda, o lugar sozinho no canto, e a leitura numa linha (rótulo, bolinha, valor)', () => {
    const html = app.cLine([{ name: 'Acumulado', values: [100, 2538, 900], color: '#2f7d5b' }], ['jan', 'fev', 'mar'], { h: 200 });
    assert.match(html, /<div class="chartcab so"><div class="chartlugar">/, 'sem legenda, a cabeça é só o lugar');
    assert.doesNotMatch(html, /class="legend"/);
    assert.match(html, /<div class="chartlido chartmolde uma" aria-hidden="true"><b><span>jan<\/span><span>fev<\/span><span>mar<\/span><\/b><i data-fundo="#2f7d5b"><\/i><span class="lvl"><span>100 €<\/span><span>2 538 €<\/span><span>900 €<\/span><\/span><\/div><div class="chartlido uma"><\/div>/);
    assert.doesNotMatch(molde(html), /Acumulado/, 'o nome da série é o do cartão: a leitura não o repete');
  });

  test('um nome de série comprido (60 letras): a cabeça empilha — a legenda com o nome inteiro, a leitura por baixo dela', () => {
    const longo = 'Hipoteca do T2 da Rua Ferreira Borges em Campo de Ourique, C';
    assert.equal(longo.length, 60);
    const html = app.cLine([{ name: longo, values: [180000, 170000] }, { name: 'Total', values: [180000, 170000] }], ['2026', '2027']);
    assert.match(html, /<div class="chartcab empilhado">/);
    assert.match(html, new RegExp('<span class="nm">' + longo + '</span>'), 'a legenda leva o nome inteiro');
    assert.match(molde(html), new RegExp('<span class="lnm">' + longo + '</span>'), 'a leitura também — o CSS é que o corta com reticências');
  });

  test('com quatro séries de nomes curtos a cabeça fica lado a lado; com cinco empilha, e a leitura mostra as cinco', () => {
    const serie = (n) => ({ name: n, values: [1, 2] });
    const quatro = app.cLine(['A', 'B', 'C', 'D'].map(serie), ['2026', '2027']);
    assert.match(quatro, /<div class="chartcab">/, 'quatro cabem ao lado da leitura');
    const cinco = app.cLine(['A', 'B', 'C', 'D', 'Total'].map(serie), ['2026', '2027']);
    assert.match(cinco, /<div class="chartcab empilhado">/);
    assert.equal((molde(cinco).match(/class="lnm"/g) || []).length, 5, 'todas as séries, sem «+N»');
    assert.doesNotMatch(molde(cinco), /\+\d/);
  });

  test('o que se escreve na leitura vai escapado', () => {
    const html = app.cLine([{ name: '<b>x</b>', values: [1] }, { name: 'A & B', values: [2] }], ['<i>']);
    assert.doesNotMatch(molde(html), /<b>x<\/b>|<i><\/b>/);
    assert.match(molde(html), /&lt;b&gt;x&lt;\/b&gt;/);
    assert.match(molde(html), /A &amp; B/);
  });

  test('sem nada para ler não há lugar nenhum: barras sem segmentos não ganham cabeça', () => {
    const html = app.cBars([[], []], ['jan', 'fev']);
    assert.doesNotMatch(html, /data-lido|chartler|chartlugar|chartlido/);
  });

  test('o donut e as barras horizontais ficam como eram: sem cabeça nem leitura', () => {
    const d = app.cDonut([{ label: 'Obras', value: 300 }, { label: 'IMI', value: 200 }]);
    const h = app.cHBars([{ label: 'Obras', value: 300 }]);
    for (const html of [d, h]) assert.doesNotMatch(html, /chartler|chartcab|chartlido|data-lido/);
  });
});

describe('o gesto: a leitura aparece na cabeça do mesmo gráfico', () => {
  test('mostrarColuna procura a leitura pelo contentor e escreve-lhe o rótulo e os valores da coluna', () => {
    const { caixa, leitura, seletores } = caixaDe(tres());
    app.mostrarColuna(caixa, 2);
    assert.deepEqual(seletores, ['.chartlugar>.chartlido:not(.chartmolde)'], 'a leitura que se vê, e não o molde');
    assert.match(leitura.innerHTML, /^<b>mar<\/b>/);
    assert.match(leitura.innerHTML, /<span class="lnm">Despesas<\/span><span class="lvl">−12\u202F080\u202F€<\/span>/);
    assert.equal(leitura.getAttribute('data-col'), '2');
    assert.ok(caixa.classes.has('a-ler'), 'a caixa fica a ler (o CSS acende a leitura da cabeça irmã)');
    const guia = caixa.filhos.find((f) => f.className === 'chartguia');
    assert.ok(guia, 'a guia continua no desenho');
    assert.match(guia.style.left, /%$/);
  });

  test('o dedo dentro da mesma coluna não reescreve a leitura; mudar de coluna reescreve', () => {
    const { caixa, leitura } = caixaDe(tres());
    app.mostrarColuna(caixa, 0);
    app.mostrarColuna(caixa, 0);
    app.mostrarColuna(caixa, 0);
    assert.equal(leitura.escritas, 1);
    app.mostrarColuna(caixa, 1);
    assert.equal(leitura.escritas, 2);
    assert.match(leitura.innerHTML, /^<b>fev<\/b>/);
  });

  test('num gráfico sem cabeça a guia anda, mas a leitura nunca volta para dentro da caixa do desenho', () => {
    const { caixa } = caixaDe(tres(), false);
    app.mostrarColuna(caixa, 1);
    assert.deepEqual(caixa.filhos.map((f) => f.className), ['chartguia'], 'só a guia entra na caixa');
    assert.ok(caixa.classes.has('a-ler'));
  });

  test('largar a leitura tira o estado à caixa', () => {
    const { caixa } = caixaDe(tres());
    app.mostrarColuna(caixa, 0);
    app.largarLeitura(caixa);
    assert.ok(!caixa.classes.has('a-ler'));
    assert.doesNotThrow(() => app.largarLeitura(null));
  });

  test('pilha escreve um texto só, ou todos os textos (sem repetidos) cada um no seu span, escapados', () => {
    assert.equal(app.pilha('mai'), 'mai');
    assert.equal(app.pilha(null), '');
    assert.equal(app.pilha(['jan', 'mai', 'jan', null]), '<span>jan</span><span>mai</span><span></span>');
    assert.equal(app.pilha(['<i>']), '<span>&lt;i&gt;</span>');
  });
});

/* A Visão geral do canvas de 2026-10 escreve por cima das barras o mês
   corrente («out 2026 · Receita … · Despesas …») antes de alguém tocar, e
   pinta por trás a coluna desse mês. A leitura continua a ser a do canto: o
   dedo troca-a, e ao largar volta ao mês fixo (graficos.js:cabecaDaLeitura,
   graficos.js:largarLeitura). */
describe('a leitura acesa antes de tocar, e o mês em destaque', () => {
  const comLer = (o) => app.cBars([0, 1, 2].map((i) => [
    { label: 'Receita', value: 950, color: '#2f7d5b' },
    { label: 'Despesas', value: -[80, 1080, 12080][i], color: '#c56b68' },
  ]), ['jan', 'fev', 'mar'], Object.assign({ h: 190 }, o));

  test('com ler, a leitura nasce escrita nessa coluna e o contentor fica fixo, a dizer qual', () => {
    const html = comLer({ ler: 1 });
    assert.match(html, /^<div class="chartler fixa" data-ler="1"><div class="chartcab/);
    const lida = /<div class="chartlido" data-col="1">([\s\S]*?)<\/div><\/div><\/div>/.exec(html);
    assert.ok(lida, 'a leitura que se vê já traz a coluna');
    assert.match(lida[1], /^<b>fev<\/b>/);
    assert.match(lida[1], /<span class="lnm">Despesas<\/span><span class="lvl">−1 080 €<\/span>/);
    assert.match(molde(html), /<span>mar<\/span>/, 'o molde continua a guardar o lugar de todos');
  });

  test('numa série só, a leitura acesa é a de uma linha', () => {
    const html = app.cLine([{ name: 'Acumulado', values: [100, 2538, 900], color: '#2f7d5b' }], ['jan', 'fev', 'mar'], { ler: 2 });
    assert.match(html, /<div class="chartlido uma" data-col="2"><b>mar<\/b><i data-fundo="#2f7d5b"><\/i><span class="lvl">900 €<\/span><\/div>/);
  });

  test('sem ler, ou com uma coluna que não existe, é como era: a leitura nasce vazia', () => {
    for (const o of [{}, { ler: 3 }, { ler: -1 }, { ler: 1.5 }, { ler: '1' }]) {
      const html = comLer(o);
      assert.match(html, /^<div class="chartler"><div class="chartcab/, JSON.stringify(o));
      assert.match(html, /<div class="chartlido"><\/div>/, JSON.stringify(o));
    }
  });

  test('largar a leitura volta à coluna fixa, e não fica na última que o dedo leu', () => {
    const dados = desescapar(/data-lido="([^"]*)"/.exec(comLer({ ler: 0 }))[1]);
    const leitura = elementoLeitura();
    leitura.setAttribute('data-col', '0');
    const ler = { querySelector: (s) => (s === '.chartlugar>.chartlido:not(.chartmolde)' ? leitura : null), getAttribute: (k) => (k === 'data-ler' ? '0' : null) };
    const caixa = elementoLeitura();
    caixa.getAttribute = (k) => (k === 'data-lido' ? dados : null);
    caixa.querySelector = (s) => (s === '.chartguia' ? caixa.filhos.find((f) => f.className === 'chartguia') || null : null);
    caixa.closest = (s) => (s === '.chartler' ? ler : null);
    app.mostrarColuna(caixa, 2);
    assert.match(leitura.innerHTML, /^<b>mar<\/b>/, 'o dedo leu março');
    app.largarLeitura(caixa);
    assert.ok(!caixa.classes.has('a-ler'), 'a guia sai');
    assert.equal(leitura.getAttribute('data-col'), '0');
    assert.match(leitura.innerHTML, /^<b>jan<\/b>/, 'e a leitura volta a janeiro');
  });

  test('o destaque pinta por trás de tudo a faixa suave da coluna, e só com uma coluna que existe', () => {
    const html = comLer({ destaque: 2 });
    assert.match(html, /<svg [^>]*><rect class="gdestaque" x="[\d.]+" y="4" width="[\d.]+" height="[\d.]+" rx="6" fill="var\(--accent-soft\)"\/>/,
      'é a primeira forma do desenho: a grelha e as barras pintam por cima');
    assert.equal((html.match(/gdestaque/g) || []).length, 1);
    for (const o of [{}, { destaque: 3 }, { destaque: -1 }]) assert.doesNotMatch(comLer(o), /gdestaque/, JSON.stringify(o));
    assert.doesNotMatch(html, /class="gbar[^"]*gdestaque|gdestaque[^"]*gbar/, 'a faixa não cresce com as barras');
  });

  test('as barras horizontais: o nome com a segunda parte mais apagada, e o negativo a laranja (dinheiro que sai), não a vermelho', () => {
    const html = app.cHBars([{ label: 'Ana', sub: 'T2 Lisboa', value: 1150 }, { label: '<b>Casa</b>', value: -300 }]);
    assert.match(html, /<span class="nm u-c-v-ink">Ana <span class="small">· T2 Lisboa<\/span><\/span>/);
    assert.match(html, /&lt;b&gt;Casa&lt;\/b&gt;<\/span>/, 'o nome vai escapado');
    assert.match(html, /data-fundo="var\(--out\)"/);
    assert.doesNotMatch(html, /--danger/);
  });

  test('o CSS acende a leitura fixa sem ninguém tocar', () => {
    assert.match(css, /\.chartler\.fixa \.chartlido\{opacity:1\}/);
  });
});

/* O eixo dos valores: marcas redondas com o zero, cada uma à sua altura, na
   mesma unidade em todo o eixo e com o menos tipográfico (graficos.js:axisY,
   graficos.js:marcasDoEixo). Partido em quartos exatos dizia «1,7k · 575 ·
   −529 · −1,6k», com o hífen, e o zero sem rótulo. E as barras que descem
   pela ordem inversa, quando se pede (cBars com desceAoContrario). */
describe('o eixo dos valores e a ordem do que desce', () => {
  /* As marcas do eixo, pela ordem do desenho, com o y de cada uma.
     Recebe: html — o HTML do gráfico.
     Devolve: [{t, y}] — o texto e o y da linha da grelha (o texto vai 3,2 abaixo). */
  const marcas = (html) => [...html.matchAll(/<text x="38" y="([\d.]+)" text-anchor="end"[^>]*>([^<]*)</g)].map((m) => ({ t: m[2], y: +(+m[1] - 3.2).toFixed(1) }));
  /* O y da linha do zero (a mais forte, --line2) que o cBars e o cLine desenham.
     Recebe: html. Devolve: o número. */
  const linhaDoZero = (html) => +/<line x1="44" y1="([\d.]+)" x2="354" y2="[\d.]+" stroke="var\(--line2\)"\/>/.exec(html)[1];
  const seg = (label, value) => ({ label, value, color: '#' + label.length.toString(16).padStart(6, '0') });

  test('as marcas são redondas, com o zero na linha dele, em milhares quando a maior chega aos mil, e com o «−»', () => {
    const html = app.cBars([[seg('Receita', 1700)], [seg('Despesas', -2700)]], ['jan', 'fev']);
    const m = marcas(html);
    igual(m.map((x) => x.t), ['−2k', '−1k', '0', '1k']);
    assert.equal(m.find((x) => x.t === '0').y, linhaDoZero(html), 'o zero tem rótulo, à altura da linha do zero');
    assert.doesNotMatch(html, /text-anchor="end"[^>]*>-/, 'nenhum hífen a fazer de menos');
  });

  test('abaixo dos mil, por extenso; e cada marca à sua altura, sem alargar o intervalo dos dados', () => {
    const html = app.cBars([[seg('Receita', 575)], [seg('Despesas', -529)]], ['jan', 'fev'], { h: 150 });
    const m = marcas(html);
    igual(m.map((x) => x.t), ['−400', '−200', '0', '200', '400']);
    // a altura proporcional: o desenho vai de 10 (575) a 142 (−529) com h=150
    const y = (v) => +(142 - 132 * (v + 529) / 1104).toFixed(1);
    m.forEach((x) => assert.ok(Math.abs(x.y - y(Number(x.t.replace('−', '-')))) < 0.11, x.t + ' à sua altura (' + x.y + ')'));
  });

  test('com o formatador da janela, as marcas redondas saem em euros', () => {
    const html = app.cLine([{ name: 'Receita', values: [454, 907, 1361, 1814] }], ['jan', 'fev', 'mar', 'abr'], { fmt: app.euro });
    igual(marcas(html).map((x) => x.t), [0, 500, 1000, 1500].map((v) => app.euro(v)));
  });

  test('desceAoContrario: o primeiro a descer é o último dos segmentos, sem mexer na legenda nem na leitura', () => {
    const grupo = [[seg('Receita', 100), seg('Despesas', -50), seg('Prestações', -30)]];
    const barras = (html) => Object.fromEntries([...html.matchAll(/<rect class="gbar[^"]*" x="[\d.]+" y="([\d.]+)"[^>]*fill="(#[0-9a-f]+)"/g)].map((r) => [r[2], +r[1]]));
    const normal = app.cBars(grupo, ['jan'], { h: 150 }), inverso = app.cBars(grupo, ['jan'], { h: 150, desceAoContrario: true });
    const zN = linhaDoZero(normal), zI = linhaDoZero(inverso);
    assert.equal(barras(normal)[seg('Despesas', 0).color], zN, 'sem a opção, as despesas encostam ao zero');
    assert.equal(barras(inverso)[seg('Prestações', 0).color], zI, 'com ela, as prestações encostam ao zero');
    assert.ok(barras(inverso)[seg('Despesas', 0).color] > zI, 'e as despesas vão para o fundo');
    const legenda = (html) => [...html.matchAll(/<span class="nm">([^<]+)<\/span>/g)].map((x) => x[1]);
    igual(legenda(inverso), legenda(normal), 'a legenda fica pela mesma ordem');
    igual(lido(inverso).s.map((x) => x.n), ['Receita', 'Despesas', 'Prestações'], 'e a leitura também');
  });
});

describe('o CSS da cabeça e da leitura', () => {
  test('a cabeça é uma grelha: a legenda com o resto, a leitura com a largura do molde até 58%', () => {
    assert.match(css, /\.chartcab\{display:grid;grid-template-columns:minmax\(0,1fr\) fit-content\(58%\)/);
    assert.match(css, /\.chartlugar\{[^}]*grid-column:2[^}]*align-self:end/, 'o lugar no fundo da cabeça, colado ao desenho');
  });

  /* A leitura chegou a viver num pé debaixo do eixo: no telemóvel a mão vem
     de baixo, e o dedo que percorre o gráfico tapava-a. */
  test('a cabeça fica por cima do desenho, separada dele, e não por baixo', () => {
    assert.match(css, /\.chartcab\{[^}]*margin-bottom:10px/);
    assert.doesNotMatch(css, /\.chartpe\b/, 'o pé já não existe');
  });

  test('a leitura acende-se pela caixa irmã, e não por estar dentro dela', () => {
    assert.match(css, /,\.chartler:has\(>\.chartbox\.a-ler\) \.chartlido\{opacity:1\}/);
  });

  test('os números da leitura não dançam e o valor não se corta; o nome corta com reticências', () => {
    const l = /\n\.chartlido\{([^}]*)\}/.exec(css);
    assert.ok(l);
    assert.match(l[1], /font-variant-numeric:tabular-nums/);
    assert.match(l[1], /grid-template-columns:8px minmax\(0,1fr\) auto/, 'o valor numa coluna auto, que nunca encolhe');
    assert.match(css, /\.chartlido \.lnm\{[^}]*text-overflow:ellipsis/);
    assert.doesNotMatch(css, /\.chartlido \.lvl\{[^}]*(?:overflow|ellipsis)/);
  });

  test('empilhado, a legenda parte os nomes em linhas em vez de os cortar', () => {
    assert.match(css, /\.chartcab\.empilhado>\.legend \.nm\{white-space:normal/);
    assert.match(css, /\.chartcab\.empilhado \.chartlugar\{[^}]*justify-self:end/, 'a leitura continua encostada à direita');
  });

  test('a leitura usa as cores do tema (sem cores fixas), para o tema escuro', () => {
    const regras = css.match(/\.chart(?:lido|cab|lugar|molde)[^{]*\{[^}]*\}/g) || [];
    assert.ok(regras.length >= 6);
    for (const r of regras) assert.doesNotMatch(r, /#[0-9a-f]{3,8}\b|rgba?\(/i, r);
  });
});
