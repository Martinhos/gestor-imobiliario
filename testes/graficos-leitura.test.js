// A leitura de um gráfico com o dedo, no canto inferior direito do cartão.
// O cLine e o cBars devolvem o desenho e, por baixo, um pé em grelha: a
// legenda à esquerda e o lugar da leitura à direita, guardado desde a
// primeira pintura por um molde escondido — a leitura nunca fica por cima do
// desenho e o cartão não muda de altura por alguém lhe tocar
// (graficos.js:peDaLeitura, graficos.js:mostrarColuna). Verificações do HTML
// que sai, do gesto com um DOM a fingir, e das regras do CSS que fazem o
// resto; o desenho no ecrã vê-se no browser.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, repor } from './arnes.js';

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
   se pedido, o contentor e o pé onde mora a leitura.
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

describe('o pé do gráfico: a legenda à esquerda, o lugar da leitura no canto', () => {
  test('o cBars devolve o contentor com a caixa do desenho e, por baixo, o pé com a legenda antes do lugar', () => {
    const html = tres();
    assert.match(html, /^<div class="chartler"><div class="chartbox"/, 'o contentor junta a caixa e o pé');
    const fimDesenho = html.indexOf('</svg></div>');
    const pe = html.indexOf('<div class="chartpe');
    assert.ok(fimDesenho > 0 && pe > fimDesenho, 'o pé vem depois do desenho, fora da caixa');
    assert.ok(html.indexOf('<div class="legend">') > pe, 'a legenda vive no pé');
    assert.ok(html.indexOf('<div class="chartlugar">') > html.indexOf('<div class="legend">'), 'e o lugar da leitura à direita dela');
    assert.doesNotMatch(html.slice(0, fimDesenho), /chartlido/, 'nada da leitura dentro da caixa do desenho');
  });

  test('o lugar existe antes de alguém tocar: o molde e a leitura vazia por cima', () => {
    const html = tres();
    assert.match(html, /<div class="chartlugar"><div class="chartlido chartmolde" aria-hidden="true">[\s\S]*?<\/div><div class="chartlido"><\/div><\/div>/);
  });

  test('o molde tem as linhas que a leitura vai ter: o rótulo e uma por série, com o valor mais comprido de cada uma', () => {
    const m = molde(tres());
    assert.equal((m.match(/<b>/g) || []).length, 1, 'um rótulo');
    assert.equal((m.match(/class="lnm"/g) || []).length, 3, 'três séries, três linhas');
    assert.match(m, /<span class="lnm">Despesas<\/span><span class="lvl">−12\u202F080\u202F€<\/span>/,
      'a linha das despesas guarda o lugar do valor mais comprido, e não o do primeiro mês');
    assert.match(m, /<span class="lnm">Receita<\/span><span class="lvl">950\u202F€<\/span>/);
  });

  test('o molde e o data-lido escrevem os valores com a mesma função — o molde mede o que vai aparecer', () => {
    const fmt = (v) => (v * 100).toFixed(1).replace('.', ',') + '%';
    const html = app.cLine([{ name: 'LTV', values: [0.42, 0.389, 0.1] }, { name: 'Alvo', values: [0.6, 0.6, 0.6] }], ['2026', '2027', '2028'], { fmt });
    const d = lido(html);
    assert.deepEqual([...d.s[0].v], ['42,0%', '38,9%', '10,0%']);
    assert.match(molde(html), /<span class="lnm">LTV<\/span><span class="lvl">42,0%<\/span>/);
    assert.doesNotMatch(molde(html), /€/, 'nada de euros num rácio');
  });

  test('uma série só: sem legenda, o lugar sozinho no canto, e a leitura numa linha (rótulo, bolinha, valor)', () => {
    const html = app.cLine([{ name: 'Acumulado', values: [100, 2538, 900], color: '#2f7d5b' }], ['jan', 'fev', 'mar'], { h: 200 });
    assert.match(html, /<div class="chartpe so"><div class="chartlugar">/, 'sem legenda, o pé é só o lugar');
    assert.doesNotMatch(html, /class="legend"/);
    assert.match(html, /<div class="chartlido chartmolde uma" aria-hidden="true"><b>jan<\/b><i data-fundo="#2f7d5b"><\/i><span class="lvl">2\u202F538\u202F€<\/span><\/div><div class="chartlido uma"><\/div>/);
    assert.doesNotMatch(molde(html), /Acumulado/, 'o nome da série é o do cartão: a leitura não o repete');
  });

  test('um nome de série comprido (60 letras): o pé empilha — a legenda com o nome inteiro, a leitura por baixo', () => {
    const longo = 'Hipoteca do T2 da Rua Ferreira Borges em Campo de Ourique, C';
    assert.equal(longo.length, 60);
    const html = app.cLine([{ name: longo, values: [180000, 170000] }, { name: 'Total', values: [180000, 170000] }], ['2026', '2027']);
    assert.match(html, /<div class="chartpe empilhado">/);
    assert.match(html, new RegExp('<span class="nm">' + longo + '</span>'), 'a legenda leva o nome inteiro');
    assert.match(molde(html), new RegExp('<span class="lnm">' + longo + '</span>'), 'a leitura também — o CSS é que o corta com reticências');
  });

  test('com quatro séries de nomes curtos o pé fica lado a lado; com cinco empilha, e a leitura mostra as cinco', () => {
    const serie = (n) => ({ name: n, values: [1, 2] });
    const quatro = app.cLine(['A', 'B', 'C', 'D'].map(serie), ['2026', '2027']);
    assert.match(quatro, /<div class="chartpe">/, 'quatro cabem ao lado da leitura');
    const cinco = app.cLine(['A', 'B', 'C', 'D', 'Total'].map(serie), ['2026', '2027']);
    assert.match(cinco, /<div class="chartpe empilhado">/);
    assert.equal((molde(cinco).match(/class="lnm"/g) || []).length, 5, 'todas as séries, sem «+N»');
    assert.doesNotMatch(molde(cinco), /\+\d/);
  });

  test('o que se escreve na leitura vai escapado', () => {
    const html = app.cLine([{ name: '<b>x</b>', values: [1] }, { name: 'A & B', values: [2] }], ['<i>']);
    assert.doesNotMatch(molde(html), /<b>x<\/b>|<i><\/b>/);
    assert.match(molde(html), /&lt;b&gt;x&lt;\/b&gt;/);
    assert.match(molde(html), /A &amp; B/);
  });

  test('sem nada para ler não há lugar nenhum: barras sem segmentos não ganham pé', () => {
    const html = app.cBars([[], []], ['jan', 'fev']);
    assert.doesNotMatch(html, /data-lido|chartler|chartlugar|chartlido/);
  });

  test('o donut e as barras horizontais ficam como eram: sem pé nem leitura', () => {
    const d = app.cDonut([{ label: 'Obras', value: 300 }, { label: 'IMI', value: 200 }]);
    const h = app.cHBars([{ label: 'Obras', value: 300 }]);
    for (const html of [d, h]) assert.doesNotMatch(html, /chartler|chartpe|chartlido|data-lido/);
  });
});

describe('o gesto: a leitura aparece no pé do mesmo gráfico', () => {
  test('mostrarColuna procura a leitura pelo contentor e escreve-lhe o rótulo e os valores da coluna', () => {
    const { caixa, leitura, seletores } = caixaDe(tres());
    app.mostrarColuna(caixa, 2);
    assert.deepEqual(seletores, ['.chartlugar>.chartlido:not(.chartmolde)'], 'a leitura que se vê, e não o molde');
    assert.match(leitura.innerHTML, /^<b>mar<\/b>/);
    assert.match(leitura.innerHTML, /<span class="lnm">Despesas<\/span><span class="lvl">−12\u202F080\u202F€<\/span>/);
    assert.equal(leitura.getAttribute('data-col'), '2');
    assert.ok(caixa.classes.has('a-ler'), 'a caixa fica a ler (o CSS acende a leitura do pé irmão)');
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

  test('num gráfico sem pé a guia anda, mas a leitura nunca volta para dentro da caixa do desenho', () => {
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

  test('maisComprido escolhe o texto mais comprido e aguenta o que não é texto', () => {
    assert.equal(app.maisComprido(['jan', 'fevereiro', 'mar']), 'fevereiro');
    assert.equal(app.maisComprido([null, 12345, '7']), '12345');
    assert.equal(app.maisComprido([]), '');
    assert.equal(app.maisComprido(undefined), '');
  });
});

describe('o CSS do pé e da leitura', () => {
  test('o pé é uma grelha: a legenda com o resto, a leitura com a largura do molde até 58%', () => {
    assert.match(css, /\.chartpe\{display:grid;grid-template-columns:minmax\(0,1fr\) fit-content\(58%\)/);
    assert.match(css, /\.chartlugar\{[^}]*grid-column:2[^}]*align-self:end/, 'o lugar no canto inferior direito');
  });

  test('a leitura acende-se pela caixa irmã, e não por estar dentro dela', () => {
    assert.match(css, /\.chartbox\.a-ler\+\.chartpe \.chartlido\{opacity:1\}|,\.chartbox\.a-ler\+\.chartpe \.chartlido\{opacity:1\}/);
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
    assert.match(css, /\.chartpe\.empilhado>\.legend \.nm\{white-space:normal/);
    assert.match(css, /\.chartpe\.empilhado \.chartlugar\{[^}]*justify-self:end/, 'a leitura continua encostada à direita');
  });

  test('a leitura usa as cores do tema (sem cores fixas), para o tema escuro', () => {
    const regras = css.match(/\.chart(?:lido|pe|lugar|molde)[^{]*\{[^}]*\}/g) || [];
    assert.ok(regras.length >= 6);
    for (const r of regras) assert.doesNotMatch(r, /#[0-9a-f]{3,8}\b|rgba?\(/i, r);
  });
});
