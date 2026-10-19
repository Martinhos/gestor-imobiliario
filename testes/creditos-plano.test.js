// O plano da hipoteca e as barras da dívida dos Créditos. O plano mostra o
// primeiro ano mês a mês (as doze primeiras prestações, com o mês e o ano) e
// depois uma linha por ano civil com a soma desse ano, com a coluna do que se
// paga; as somas batem com as da amortização e a dívida da última linha é
// zero (creditos.js:planoLinhas, creditos.js:credTabela), na janela «Plano» e
// no painel do computador. As barras do resumo leem-se com o dedo pela
// maquinaria dos gráficos (creditos.js:credBarrasLer, graficos.js:
// cabecaDaLeitura, graficos.js:mostrarColuna), com a leitura acesa no ano
// corrente e as cores do cartão azul-noite, sem mudar o desenho das barras.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, perto, igual, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

/* a app vive num dia fixo: o mês da primeira prestação conta-se a partir dele */
const app = carregarApp({ hoje: '2026-09-06' });
beforeEach(() => { limpar(app); app.render = () => {}; app.buildNav = () => {}; app.toast = () => {}; });
afterEach(() => repor(app))

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const loan = (id, extra = {}) => app.normLoan(Object.assign({
  id, name: id.toUpperCase(), bank: 'Banco ' + id, outstanding: 100000, years: 30, type: 'fixa', rate: 3, stampTax: true,
}, extra));
/* Um imóvel com as hipotecas dadas, e a próxima prestação de cada uma no dia pedido.
   Recebe: loans — as hipotecas; next (opcional) — {idDaHipoteca: 'AAAA-MM-DD'}.
   Devolve: o imóvel. */
function casa(loans, next = {}) {
  app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
  const p = app.normProp({ id: 'p1', name: 'Casa', ownerIds: ['o1'], loans });
  app.db.properties.push(p);
  app.syncAllLoanRecs();
  for (const [id, d] of Object.entries(next)) app.db.recurring.find((r) => r.auto && r.tx.loanId === id).next = d;
  return p;
}
const A = () => app.findLoan(app.prop('p1'), 'a');
const somaDe = (xs, k) => xs.reduce((s, x) => s + x[k], 0);

/* O que o esc da app escreveu dentro de um atributo, de volta a texto.
   Recebe: s — o texto escapado.
   Devolve: o texto original. */
const desescapar = (s) => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

describe('as linhas do plano: o primeiro ano mês a mês, depois ano a ano', () => {
  test('as doze primeiras prestações, uma por linha, com o mês e o ano a partir da primeira', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const { meses } = app.planoLinhas(A());
    assert.equal(meses.length, 12);
    igual(meses.map((m) => m.rot), ['out 2026', 'nov 2026', 'dez 2026', 'jan 2027', 'fev 2027', 'mar 2027',
      'abr 2027', 'mai 2027', 'jun 2027', 'jul 2027', 'ago 2027', 'set 2027']);
    assert.equal(meses[0].d, '2026-10');
    assert.equal(meses[11].d, '2027-09');
    meses.forEach((m) => assert.equal(m.n, 1));
  });

  test('cada mês é a sua linha da amortização, e o que se paga é a prestação com o selo', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const linhas = app.amort(A()).rows, { meses } = app.planoLinhas(A());
    meses.forEach((m, i) => {
      perto(m.cap, linhas[i].cap); perto(m.int, linhas[i].int); perto(m.st, linhas[i].st); perto(m.bal, linhas[i].bal);
      perto(m.pay, m.cap + m.int + m.st, 0.001, 'prestação = capital + juros + selo');
    });
    perto(meses[0].pay, app.loanCalc(A()).total, 0.001, 'a do primeiro mês é a do painel');
  });

  test('depois dos doze meses, um ano civil por linha: o resto do ano em que acabam é parcial, e o último é o do fim', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const { anos } = app.planoLinhas(A());
    assert.equal(anos[0].yr, 2027);
    assert.equal(anos[0].rot, '2027');
    assert.equal(anos[0].n, 3, 'out, nov e dez de 2027');
    assert.equal(anos[1].n, 12);
    anos.forEach((y, i) => assert.equal(y.yr, 2027 + i, 'cada linha com o seu ano'));
    // 360 prestações de out 2026 a set 2056: a última linha é 2056, com nove
    assert.equal(anos[anos.length - 1].yr, 2056);
    assert.equal(anos[anos.length - 1].n, 9);
    assert.equal(12 + somaDe(anos, 'n'), 360);
  });

  test('os números batem: a soma das linhas é a soma da amortização, e a dívida da última é zero', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const a = app.amort(A()), { meses, anos } = app.planoLinhas(A()), todas = [...meses, ...anos];
    perto(somaDe(todas, 'pay'), somaDe(a.rows, 'cap') + a.totInt + a.totStamp, 0.01);
    perto(somaDe(todas, 'cap'), 100000, 0.01, 'o capital todo');
    perto(somaDe(todas, 'int'), a.totInt, 0.01);
    perto(somaDe(todas, 'st'), a.totStamp, 0.01);
    assert.equal(anos[anos.length - 1].bal, 0);
  });

  test('a soma de um ano é a dos seus meses, e a dívida é a do fim do ano', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const linhas = app.amort(A()).rows, { anos } = app.planoLinhas(A());
    const ano28 = anos.find((y) => y.yr === 2028), de = 12 + 3, ate = de + 12;   // jan a dez de 2028
    perto(ano28.cap, somaDe(linhas.slice(de, ate), 'cap'));
    perto(ano28.int, somaDe(linhas.slice(de, ate), 'int'));
    perto(ano28.st, somaDe(linhas.slice(de, ate), 'st'));
    perto(ano28.pay, ano28.cap + ano28.int + ano28.st, 0.001);
    perto(ano28.bal, linhas[ate - 1].bal, 0.001, 'a dívida a 31/12/2028');
    perto(app.yearRows(A()).yrs.find((y) => y.yr === 2028).bal, ano28.bal, 0.001, 'a mesma do gráfico ano a ano');
  });

  test('quando as doze acabam em dezembro não há ano parcial; sem os Planeados, a primeira é a deste mês', () => {
    casa([loan('a')], { a: '2027-01-05' });
    let p = app.planoLinhas(A());
    assert.equal(p.meses[11].rot, 'dez 2027');
    assert.equal(p.anos[0].yr, 2028);
    assert.equal(p.anos[0].n, 12);
    app.definirServicosDesligados(['recurring']);
    try {
      p = app.planoLinhas(A());
      assert.equal(p.meses[0].rot, 'set 2026');
    } finally { app.definirServicosDesligados([]); }
  });

  test('com menos de doze prestações por pagar, só há meses', () => {
    casa([loan('a', { outstanding: 5000, years: 0.5 })], { a: '2026-10-05' });
    const p = app.planoLinhas(A());
    assert.equal(p.meses.length, 6);
    assert.equal(p.anos.length, 0);
    assert.equal(p.meses[5].bal, 0);
    const t = app.credTabela(A());
    assert.doesNotMatch(t, /Anos seguintes/, 'sem anos, sem o grupo');
    assert.equal((t.match(/<tr>/g) || []).length, 1 + 6);
  });
});

describe('a tabela: os meses, a linha «Anos seguintes» e os anos', () => {
  test('as colunas: o período, o que se paga, o capital, os juros, o selo e a dívida no fim', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const t = app.credTabela(A());
    const cab = [...t.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1]);
    assert.deepEqual(cab, ['Período', 'Prestação', 'Capital', 'Juros', 'Selo', 'Dívida no fim']);
    assert.doesNotMatch(css, /\.cred-tab-plano t[hd]:nth-child\(2\)/, 'a Prestação é um número: alinha à direita, como as outras');
    assert.match(t, /^<div class="cred-plano" role="region" aria-label="Plano de amortização: o primeiro ano mês a mês, depois ano a ano" tabindex="0">/);
  });

  test('a janela «Plano» tem a tabela inteira: doze meses com cêntimos, o grupo e um ano por linha', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const abertas = janelasFalsas(app);
    app.amortModal('p1', 'a');
    const b = abertas[0].b, { meses, anos } = app.planoLinhas(A());
    assert.equal((b.match(/<tr>/g) || []).length, 1 + 12 + anos.length);
    assert.doesNotMatch(b, /cred-tab-fim/, 'inteira, sem o «…»');
    const primeira = /<tbody><tr><td><b>out 2026<\/b>[\s\S]*?<\/tr>/.exec(b);
    assert.ok(primeira, 'a primeira linha é a de out 2026');
    assert.match(primeira[0], new RegExp('<td>' + app.euro2(meses[0].pay) + '</td>'), 'o que se paga, com os cêntimos');
    assert.ok(b.indexOf('<b>set 2027</b>') < b.indexOf('Anos seguintes'), 'os meses antes do grupo');
    assert.ok(b.indexOf('Anos seguintes') < b.indexOf('<b>2027</b>'), 'o grupo antes dos anos');
    assert.match(b, /<b>2027<\/b><span class="cred-tab-sub">3 prestações<\/span>/, 'um ano parcial diz quantas');
    assert.match(b, /<b>2028<\/b><\/td>/, 'um ano inteiro não diz nada');
    assert.match(b, /<b>2056<\/b><span class="cred-tab-sub">9 prestações<\/span>/);
    assert.match(b, new RegExp('<b>2028</b></td><td>' + app.euro(anos[1].pay) + '</td>'), 'a soma do ano, ao euro');
  });

  test('o painel do computador: os doze meses, dez anos e o ano em que acaba', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const d = app.credDetalhe({ p: app.prop('p1'), l: A() });
    assert.equal((d.match(/<tr>/g) || []).length, 1 + 12 + 10);
    assert.match(d, /Anos seguintes/);
    assert.match(d, /<b>2036<\/b>/);
    assert.doesNotMatch(d, /<b>2037<\/b>/);
    assert.match(d, /<tr class="cred-tab-fim">[\s\S]*2056: 0 €<\/td><\/tr>/);
  });

  test('a taxa vai por baixo do período na primeira linha e onde muda (a mista que passa à variável)', () => {
    casa([loan('a', { type: 'mista', rate: 2, fixedYears: 2, euribor: 3, spread: 1, start: '2026-09-05' })], { a: '2026-10-05' });
    const t = app.credTabela(A());
    const taxas = [...t.matchAll(/<b>([^<]+)<\/b><span class="cred-tab-sub">([^<]*taxa [^<]*)<\/span>/g)].map((m) => m[1] + ' ' + m[2]);
    assert.equal(taxas.length, 2, taxas.join(' | '));
    assert.match(taxas[0], /^out 2026 taxa 2%$/);
    assert.match(taxas[1], /taxa 4%$/, 'a passagem aos 4%');
  });

  test('o grupo «Anos seguintes» é um cabeçalho de grupo de linhas, e não fica preso em cima nem à direita', () => {
    casa([loan('a')], { a: '2026-10-05' });
    assert.match(app.credTabela(A()), /<\/tbody>\s*<tbody><tr class="cred-tab-grupo"><th scope="rowgroup" colspan="6"><span>Anos seguintes<\/span><\/th><\/tr>/);
    assert.match(css, /\.cred-tab-plano \.cred-tab-grupo th\{position:static;/);
    assert.match(css, /\.cred-tab-grupo th>span\{position:sticky;left:14px\}/);
  });
});

describe('as barras da dívida leem-se com o dedo', () => {
  const resumo = () => app.credResumo([{ p: app.prop('p1'), l: A() }]);

  test('o resumo leva a cabeça da leitura e a caixa do desenho, com a leitura acesa no ano corrente', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const html = resumo(), d = app.credDividaPorAno([A()]);
    assert.match(html, /<div class="cred-r-graf"><div class="chartler fixa" data-ler="0"><div class="chartcab so">/);
    assert.match(html, /<div class="chartlido uma" data-col="0"><b>2026<\/b><i data-fundo="var\(--side-text\)"><\/i><span class="lvl">/);
    assert.match(html, new RegExp('<span class="lvl">' + app.euro(d.somas[0]) + '</span></div></div></div><div class="chartbox cred-r-caixa" data-lido="'));
    assert.match(html, /<div class="cred-r-eixo num"><span>2026<\/span><span>Dívida no fim de cada ano<\/span><span>2056<\/span><\/div><\/div><\/section>$/);
  });

  test('o desenho das barras é o de sempre: uma barra por ano, a do ano corrente acesa, e a frase para quem não vê', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const html = resumo();
    assert.equal((html.match(/<rect /g) || []).length, 31);
    assert.match(html, /<svg class="cred-barras" viewBox="0 0 310 56" preserveAspectRatio="none" role="img" aria-label="Dívida no fim de cada ano, de 2026 a 2056, a descer até 0 €\. Percorre com o dedo para ler cada ano\.">/);
    assert.match(html, /<rect class="agora" x="1" /);
  });

  test('o data-lido tem um ano por barra, com a coluna no meio da barra nas unidades do leitor', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const d = JSON.parse(desescapar(/data-lido="([^"]*)"/.exec(resumo())[1])), somas = app.credDividaPorAno([A()]).somas;
    assert.equal(d.W, 360);
    assert.equal(d.rot.length, 31);
    assert.equal(d.rot[0], '2026');
    assert.equal(d.xs.length, 31);
    perto(d.xs[0], 5 / 310 * 360, 0.06);
    perto(d.xs[30], 305 / 310 * 360, 0.06);
    assert.equal(d.s.length, 1);
    assert.equal(d.s[0].n, '', 'uma série sem nome: a leitura de uma linha');
    assert.equal(d.s[0].v[1], app.euro(somas[1]));
  });

  test('o dedo sobre uma barra escolhe esse ano, e ao largar a leitura volta ao ano corrente', () => {
    casa([loan('a')], { a: '2026-10-05' });
    const dados = desescapar(/data-lido="([^"]*)"/.exec(resumo())[1]);
    const atr = {}, leitura = { _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; },
      getAttribute: (k) => (k in atr ? atr[k] : null), setAttribute: (k, v) => { atr[k] = String(v); } };
    leitura.setAttribute('data-col', '0');
    const ler = { querySelector: (s) => (s === '.chartlugar>.chartlido:not(.chartmolde)' ? leitura : null), getAttribute: (k) => (k === 'data-ler' ? '0' : null) };
    const classes = new Set(), filhos = [];
    const caixa = { style: {}, getAttribute: (k) => (k === 'data-lido' ? dados : null),
      querySelector: (s) => (s === '.chartguia' ? filhos[0] || null : null), appendChild: (x) => { filhos.push(x); return x; },
      closest: (s) => (s === '.chartler' ? ler : null), getBoundingClientRect: () => ({ left: 16, width: 310 }),
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } };
    const i = app.colunaSobODedo(caixa, JSON.parse(dados), 16 + 10 * 10 + 5);   // o meio da 11.ª barra
    assert.equal(i, 10);
    app.mostrarColuna(caixa, i);
    assert.match(leitura.innerHTML, /^<b>2036<\/b>/);
    assert.ok(classes.has('a-ler'));
    assert.equal(filhos[0].className, 'chartguia');
    assert.match(filhos[0].style.left, /%$/);
    perto(parseFloat(filhos[0].style.left), 105 / 310 * 100, 0.05, 'a guia no meio da barra');
    app.largarLeitura(caixa);
    assert.ok(!classes.has('a-ler'));
    assert.match(leitura.innerHTML, /^<b>2026<\/b>/, 'de volta ao ano corrente');
  });

  test('a leitura e a guia têm as cores da barra lateral no cartão escuro, só por tokens', () => {
    assert.match(css, /\.cred-resumo \.chartlido\{background:var\(--side-on\);color:var\(--side-ink\)\}/);
    assert.match(css, /\.cred-resumo \.chartguia\{bottom:0;width:2px;margin-left:-1px;background:var\(--side-ink\)\}/);
    const regras = css.match(/\.cred-resumo \.chart[^{]*\{[^}]*\}/g) || [];
    assert.ok(regras.length >= 3, regras.join(' '));
    regras.forEach((r) => assert.doesNotMatch(r, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'sem cores fixas: ' + r));
    assert.match(css, /\.cred-barras rect\{fill:var\(--side-text\);opacity:\.6\}/, 'as barras como eram');
    assert.match(css, /\.cred-r-caixa \.cred-barras\{height:56px\}/, 'a altura de sempre, apesar do height:auto do .chartbox svg');
  });

  test('com um ano só não há barras nem leitura', () => {
    casa([loan('a', { outstanding: 2000, years: 0.25 })], { a: '2026-10-05' });
    const html = resumo();
    assert.doesNotMatch(html, /cred-r-graf|chartler|data-lido/);
  });
});
