// Os produtos facultativos de uma hipoteca (seguro de vida, multirriscos,
// ordenado domiciliado…): cada um é uma linha guardada na hipoteca, com a
// sua redução do spread e/ou da TAN, que a pessoa liga e desliga. O spread e
// a TAN guardados são a base, sem produtos; a taxa em vigor é a base menos as
// reduções dos ligados, só as que o tipo de taxa tem, e nunca abaixo de 0
// (credito.js:spreadEmVigor, taxaFixaEmVigor). Aqui: a normalização
// (dados.js:normLoan, nucleo.js:dropUnsafe), as contas, a taxa por extenso,
// o bloco do formulário (imovel.js:loanProdSect), o collectProp, ligar,
// adicionar e remover, e a ficha da hipoteca.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-09-06' });

let repintou, gravou;

/* Uma hipoteca já normalizada, com os produtos dados. */
const hip = (extra = {}) => app.normLoan(Object.assign({ id: 'a', name: 'Aquisição', outstanding: 150000, capitalInicio: 150000, years: 30, type: 'variavel', index: '6m', euribor: 2.2, spread: 1.25, rate: 3, stampTax: true }, extra));
const seguro = (extra = {}) => Object.assign({ id: 'pv', tipo: 'seguro_vida', spread: 0.25, tan: 0.2, ativo: true }, extra);
const ordenado = (extra = {}) => Object.assign({ id: 'po', tipo: 'ordenado', spread: 0.15, tan: 0.1, ativo: true }, extra);

/* A casa p1 com a hipoteca, na base e no formulário (o formulário é uma
   cópia, como o propModal a faz). */
function casa(extra = {}) {
  const p = app.normProp({ id: 'p1', name: 'Casa', loans: [hip(extra)] });
  app.db.properties.push(p);
  app.pForm = app.normProp(JSON.parse(JSON.stringify(p)));
  return app.findLoan(app.pForm, 'a');
}
const L = () => app.findLoan(app.pForm, 'a');

beforeEach(() => {
  limpar(app);
  repintou = 0; gravou = 0;
  app.render = () => {};
  app.toast = () => {};
  app.save = () => { gravou++; };
  app.repaintProp = () => { repintou++; };
  app.pode = () => true;
});
afterEach(() => repor(app));

describe('o modelo', () => {
  test('uma hipoteca sem produtos ganha a lista vazia', () => {
    igual(app.normLoan({}).produtos, []);
    igual(app.normLoan({ produtos: 'lixo' }).produtos, []);
  });
  test('cada produto normaliza: tipo da lista, reduções em (0, 3] às milésimas, ligado só com true', () => {
    const l = app.normLoan({ produtos: [
      { id: 'x1', tipo: 'seguro_vida', spread: 0.1234, tan: 0.2, ativo: true },
      { id: 'x2', tipo: 'iate', spread: 3.5, tan: 0, ativo: 'sim' },
      { id: 'x3', tipo: 'cartao_debito', spread: '0.1', tan: -1 },
      { tipo: 'poupanca', spread: 3 },
      null, 'lixo', [1],
    ] });
    igual(l.produtos.map((p) => [p.id, p.tipo, p.spread, p.tan, p.ativo]).slice(0, 3), [
      ['x1', 'seguro_vida', 0.123, 0.2, true],
      ['x2', 'outro', null, null, false],
      ['x3', 'cartao_debito', null, null, false],
    ]);
    igual(l.produtos.length, 4, 'o que não é objeto sai');
    igual([l.produtos[3].tipo, l.produtos[3].spread], ['poupanca', 3]);
    assert.match(l.produtos[3].id, /^[A-Za-z0-9_-]{1,64}$/, 'sem id, ganha um');
  });
  test('a lista fechada é a do contrato, pela mesma ordem', () => {
    igual(app.PRODUTOS_HIPOTECA.map((p) => p.id), ['seguro_vida', 'seguro_multirriscos', 'ordenado', 'debitos', 'cartao_credito', 'cartao_debito', 'poupanca', 'conjunto', 'reducao_spread', 'outro']);
    igual(app.produtoNome('reducao_spread'), 'Redução de spread');
    igual(app.produtoNome('ordenado'), 'Ordenado domiciliado');
    igual(app.produtoNome('iate'), 'Outro produto');
  });
  test('à entrada, um produto com id fora do formato sai (nucleo.js:dropUnsafe)', () => {
    const t = carregarTudo();
    const d = { properties: [{ id: 'p1', loans: [{ id: 'a', files: [], produtos: [{ id: 'bom-1' }, { id: '"><img src=x>' }, { id: '' }, null] }] }] };
    t.dropUnsafe(d);
    igual(d.properties[0].loans[0].produtos.map((p) => p.id), ['bom-1']);
  });
});

describe('a taxa em vigor', () => {
  test('na variável, o spread baixa com os ligados e a TAN não conta', () => {
    const l = hip({ produtos: [seguro(), ordenado(), seguro({ id: 'p3', tipo: 'cartao_credito', spread: 0.5, ativo: false })] });
    igual(app.spreadEmVigor(l), 0.85);
    igual(app.taxaFixaEmVigor(l), 3, 'a variável não tem TAN');
    igual(app.rateAt(l, 0), 2.2 + 0.85);
  });
  test('na fixa, a TAN baixa e o spread não conta', () => {
    const l = hip({ type: 'fixa', rate: 3.4, produtos: [seguro(), ordenado()] });
    igual(app.taxaFixaEmVigor(l), 3.1);
    igual(app.spreadEmVigor(l), 1.25);
    igual(app.rateAt(l, 0), 3.1);
  });
  test('na mista, as duas: a taxa fixa na fase fixa e o spread depois', () => {
    const l = hip({ type: 'mista', fixedYears: 5, rate: 3, produtos: [seguro(), ordenado()] });
    igual(app.taxaFixaEmVigor(l), 2.7);
    igual(app.spreadEmVigor(l), 0.85);
    igual(app.rateAt(l, 0), 2.7);
    igual(app.rateAt(l, 60), 2.2 + 0.85);
  });
  test('na mista, um produto sem redução na taxa fixa baixa-a tanto como o spread, e a prestação de agora desce', () => {
    const so = (ativo) => hip({ type: 'mista', fixedYears: 5, rate: 3, spread: 0.95, produtos: [seguro({ spread: 0.1, tan: null, ativo }), ordenado({ spread: 0.2, tan: null, ativo })] });
    igual(app.taxaFixaEmVigor(so(true)), 2.7);
    igual(app.spreadEmVigor(so(true)), 0.65);
    assert.ok(app.loanCalc(so(true)).total < app.loanCalc(so(false)).total, 'ligar baixa a prestação da fase fixa');
    igual(app.taxaFixaEmVigor(hip({ type: 'mista', rate: 3, produtos: [seguro({ spread: 0.1, tan: 0.05 })] })), 2.95, 'com redução própria na taxa fixa, conta essa');
    igual(app.taxaFixaEmVigor(hip({ type: 'fixa', rate: 3, produtos: [seguro({ spread: 0.1, tan: null })] })), 3, 'na fixa, a do spread não conta');
    assert.match(app.loanSect(casa({ type: 'mista', produtos: [seguro()] }), 0), /Na mista, um produto sem redução na taxa fixa baixa-a tanto como o spread\./);
  });
  test('nunca abaixo de 0, e às milésimas', () => {
    const l = hip({ spread: 0.3, rate: 0.1, type: 'mista', produtos: [seguro({ spread: 0.25 }), ordenado({ spread: 0.15, tan: 0.3 })] });
    igual(app.spreadEmVigor(l), 0);
    igual(app.taxaFixaEmVigor(l), 0);
    igual(app.spreadEmVigor(hip({ spread: 1.1, produtos: [seguro({ spread: 0.3 }), ordenado({ spread: 0.15 })] })), 0.65, '1,1 − 0,45 sem restos de vírgula flutuante');
  });
  test('desligados não contam; sem produtos, a base tal e qual', () => {
    igual(app.spreadEmVigor(hip({ produtos: [seguro({ ativo: false })] })), 1.25);
    igual(app.spreadEmVigor(hip()), 1.25);
    igual(app.taxaFixaEmVigor({ rate: 2.5 }), 2.5, 'aguenta uma hipoteca crua');
    igual(app.spreadEmVigor(null), 0);
  });
  test('a prestação calculada usa a taxa em vigor', () => {
    const com = app.loanCalc(hip({ produtos: [seguro(), ordenado()] })).total;
    const igualSpread = app.loanCalc(hip({ spread: 0.85 })).total;
    assert.ok(Math.abs(com - igualSpread) < 1e-9);
  });
});

describe('a taxa por extenso (rateLabel)', () => {
  test('com os ligados que baixam, a taxa em vigor e quantos', () => {
    igual(app.rateLabel(hip({ produtos: [seguro(), ordenado()] })), 'Euribor 6m 2,2% + 0,85% = 3,05% com 2 produtos');
    igual(app.rateLabel(hip({ type: 'fixa', rate: 3.4, produtos: [seguro()] })), 'fixa 3,2% com um produto');
    igual(app.rateLabel(hip({ type: 'mista', fixedYears: 5, rate: 3, produtos: [seguro(), ordenado({ ativo: false })] })), '2,8% durante 5 anos, depois 3,2% com um produto');
  });
  test('sem ligados, ou com ligados que não baixam este tipo, como sempre', () => {
    igual(app.rateLabel(hip({ produtos: [seguro({ ativo: false })] })), 'Euribor 6m 2,2% + 1,25% = 3,45%');
    igual(app.rateLabel(hip({ type: 'fixa', rate: 3.4, produtos: [seguro({ tan: null })] })), 'fixa 3,4%');
  });
});

describe('o bloco do formulário', () => {
  test('sem produtos: o título, a dica e o «Adicionar produto»; os rótulos de sempre', () => {
    const l = casa();
    const h = app.loanSect(l, 0);
    assert.match(h, /<div class="hip-prod" id="l_prods_a" role="group" aria-labelledby="l_prods_t_a">/);
    assert.match(h, /<div class="flabel" id="l_prods_t_a">Produtos facultativos<\/div>/);
    assert.match(h, /data-click="loanProdAdicionar\('a'\)"[^>]*>[\s\S]*?Adicionar produto<\/button>/);
    assert.match(h, />Spread \(%\)<input id="l_spr_a"/);
    assert.ok(!/l_pvig_a/.test(h), 'sem produtos, não há linha da taxa em vigor');
    assert.ok(!/O custo dos produtos/.test(h));
    assert.ok(h.indexOf('l_prods_a') > h.indexOf('l_spr_a'), 'depois das taxas');
    assert.ok(h.indexOf('l_prods_a') < h.indexOf('loanBox_a'), 'antes da simulação');
  });
  test('com produtos: uma linha por produto, os rótulos «sem produtos», a taxa em vigor e a nota do custo', () => {
    const l = casa({ produtos: [seguro(), ordenado({ ativo: false })] });
    const h = app.loanSect(l, 0);
    assert.match(h, />Spread sem produtos \(%\)<input id="l_spr_a"/);
    assert.match(h, /<p class="hip-prod-vigor" id="l_pvig_a" role="status">Com os produtos ligados, o spread fica em 1 %\.<\/p>/);
    assert.match(h, /O custo dos produtos \(seguros, cartão\) não entra na hipoteca: regista-o à parte, como despesa\./);
    assert.match(h, /<li class="hip-prod-linha on" id="l_prow_pv">/);
    assert.match(h, /<li class="hip-prod-linha" id="l_prow_po">/);
    assert.match(h, /id="l_pon_pv" role="switch" aria-checked="true" aria-labelledby="lab_l_ptipo_pv" data-toca="rascunho" data-click="loanProdLigar\('a','pv'\)"/);
    assert.match(h, /id="l_pon_po" role="switch" aria-checked="false"/);
    assert.match(h, /<span class="hip-prod-estado" id="l_pest_pv">Ligado<\/span>/);
    assert.match(h, /<span class="hip-prod-estado" id="l_pest_po">Desligado<\/span>/);
    assert.match(h, /id="lab_l_ptipo_pv">Seguro de vida</, 'o tipo no sel da casa');
    assert.match(h, /aria-label="Remover produto: Seguro de vida" data-toca="rascunho" data-click="loanProdRemover\('a','pv'\)"/);
    assert.match(h, /<label>Baixa o spread em \(%\)<input id="l_pspr_pv" type="text" inputmode="decimal" value="0,25" placeholder="Ex: 0,10" autocomplete="off" data-input="liveLoan\('a'\)"><\/label>/);
    assert.ok(!/l_ptan_pv/.test(h), 'a variável não pede a redução da TAN');
    assert.ok(!/ style=| on[a-z]+=/i.test(h), 'sem style= nem on…= (a CSP)');
  });
  test('na fixa, «TAN sem produtos» e a redução da TAN; na mista, as duas', () => {
    let h = app.loanSect(casa({ type: 'fixa', rate: 3.4, produtos: [seguro()] }), 0);
    assert.match(h, />TAN sem produtos \(%\)<input id="l_rate_a"/);
    assert.match(h, /Baixa a TAN em \(%\)<input id="l_ptan_pv"[^>]*value="0,2"/);
    assert.ok(!/l_pspr_pv/.test(h));
    assert.match(h, /Com os produtos ligados, a TAN fica em 3,2 %\./);
    limpar(app);
    h = app.loanSect(casa({ type: 'mista', fixedYears: 5, rate: 3, produtos: [seguro()] }), 0);
    assert.match(h, />Taxa fixa sem produtos \(%\)<input id="l_rate_a"/);
    assert.match(h, />Spread sem produtos \(%\)<input id="l_spr_a"/);
    assert.match(h, /Baixa o spread em \(%\)<input id="l_pspr_pv"/);
    assert.match(h, /Baixa a taxa fixa em \(%\)<input id="l_ptan_pv"/);
    assert.match(h, /Com os produtos ligados, a taxa fixa fica em 2,8 % e o spread em 1 %\./);
  });
  test('sem nenhum ligado, a linha diz a taxa sem produtos', () => {
    const l = casa({ produtos: [seguro({ ativo: false })] });
    igual(app.loanProdFraseVigor(l), 'Sem produtos ligados, o spread fica em 1,25 %.');
  });
});

describe('o collectProp lê as linhas', () => {
  test('o tipo do sel e as reduções escritas (numTaxa, gama), e o ligado fica', () => {
    casa({ type: 'mista', produtos: [seguro(), ordenado({ ativo: false })] });
    const el = (id) => app.document.getElementById(id);
    el('l_ptipo_pv').value = 'cartao_credito';
    el('l_pspr_pv').value = '0,3';
    el('l_ptan_pv').value = ' ';
    el('l_ptipo_po').value = 'iate';   // fora da lista: fica o que estava
    el('l_pspr_po').value = '5';       // fora da gama: fica vazio
    el('l_ptan_po').value = '0.125';
    app.collectProp();
    igual(L().produtos.map((p) => [p.id, p.tipo, p.spread, p.tan, p.ativo]), [
      ['pv', 'cartao_credito', 0.3, null, true],
      ['po', 'ordenado', null, 0.125, false],
    ]);
    igual(gravou, 0);
  });
});

describe('ligar, adicionar e remover', () => {
  beforeEach(() => { app.collectProp = () => {}; });   // o DOM falso devolve '' em tudo: o formulário já está em pForm

  test('ligar muda só o formulário, sem repintar, e refaz a taxa em vigor', () => {
    casa({ produtos: [seguro({ ativo: false })] });
    const vig = app.document.getElementById('l_pvig_a');
    vig.textContent = app.loanProdFraseVigor(L());
    app.loanProdLigar('a', 'pv');
    igual(L().produtos[0].ativo, true);
    igual(repintou, 0, 'o foco fica no interruptor');
    igual(app.document.getElementById('l_pest_pv').textContent, 'Ligado');
    igual(vig.textContent, 'Com os produtos ligados, o spread fica em 1 %.');
    app.loanProdLigar('a', 'pv');
    igual(L().produtos[0].ativo, false);
    igual(app.document.getElementById('l_pest_pv').textContent, 'Desligado');
    igual(app.findLoan(app.prop('p1'), 'a').produtos[0].ativo, false, 'a base fica como estava');
    igual(gravou, 0, 'nada se grava sem o Guardar');
  });
  test('adicionar: uma linha desligada, o primeiro tipo ainda não usado, e repinta', () => {
    casa({ produtos: [seguro()] });
    app.loanProdAdicionar('a');
    igual(repintou, 1);
    const novo = L().produtos[1];
    igual([novo.tipo, novo.spread, novo.tan, novo.ativo], ['seguro_multirriscos', null, null, false]);
    assert.match(novo.id, /^[A-Za-z0-9_-]{1,64}$/);
    for (let i = 0; i < 8; i++) app.loanProdAdicionar('a');
    igual(L().produtos.slice(2).map((p) => p.tipo), ['ordenado', 'debitos', 'cartao_credito', 'cartao_debito', 'poupanca', 'outro', 'outro', 'outro'], 'esgotados, «Outro produto»');
    igual(app.findLoan(app.prop('p1'), 'a').produtos.length, 1, 'a base fica como estava');
    igual(gravou, 0);
  });
  test('remover tira a linha e repinta; o último volta aos rótulos de sempre', () => {
    casa({ produtos: [seguro(), ordenado()] });
    app.loanProdRemover('a', 'pv');
    igual(L().produtos.map((p) => p.id), ['po']);
    igual(repintou, 1);
    app.loanProdRemover('a', 'po');
    igual(L().produtos, []);
    assert.match(app.loanSect(L(), 0), />Spread \(%\)<input id="l_spr_a"/);
    igual(gravou, 0);
  });
});

describe('a ficha da hipoteca', () => {
  test('nomeia os produtos ligados e diz a taxa em vigor', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', loans: [hip({ produtos: [seguro(), ordenado(), seguro({ id: 'px', tipo: 'cartao_credito', ativo: false })] })] }));
    const h = app.mortFicha('p1', 'a');
    assert.match(h, /Euribor 6m 2,2% \+ 0,85% = 3,05% com 2 produtos/);
    assert.match(h, /Produtos ligados[\s\S]*Seguro de vida e Ordenado domiciliado/);
    assert.ok(!/Cartão de crédito/.test(h), 'o desligado não aparece');
    igual(app.credProdutosFrase(app.findLoan(app.prop('p1'), 'a')), 'Com Seguro de vida e Ordenado domiciliado: spread de 0,85 %.');
  });
  test('sem ligados, a ficha não fala de produtos', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', loans: [hip({ produtos: [seguro({ ativo: false })] })] }));
    assert.ok(!/Produtos ligados/.test(app.mortFicha('p1', 'a')));
    igual(app.credProdutosFrase(app.findLoan(app.prop('p1'), 'a')), '');
  });
});
