// Os eventos declarados (web/app/eventos.js): a gramática das ações, a
// segurança, a semântica de um on…= e a ligação preguiçosa. E os 347 on…= que
// a app tinha antes da migração, passados pela gramática: os que não passam
// são a lista de trabalho de quem converte cada ficheiro.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { carregarApp, TUDO } from './arnes.js';
import { lerDeclaracoes } from '../eslint.config.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const CODIGO = fs.readFileSync(path.join(RAIZ, 'web', 'app', 'eventos.js'), 'utf8');
const MARCA = '\u0001';

/* Um elemento de faz-de-conta: atributos, ouvintes e um pai.
   Recebe: nome — para as mensagens; attrs (opcional) — os atributos; pai (opcional).
   Devolve: o elemento. */
function elemento(nome, attrs = {}, pai = null) {
  return {
    nome, pai, attrs: { ...attrs }, ouvintes: {}, value: '', checked: false, dataset: {}, id: nome,
    getAttribute(a) { return Object.prototype.hasOwnProperty.call(this.attrs, a) ? this.attrs[a] : null; },
    hasAttribute(a) { return Object.prototype.hasOwnProperty.call(this.attrs, a); },
    setAttribute(a, v) { this.attrs[a] = String(v); },
    removeAttribute(a) { delete this.attrs[a]; },
    addEventListener(t, fn) { const l = (this.ouvintes[t] = this.ouvintes[t] || []); if (!l.includes(fn)) l.push(fn); },
    click() {}, focus() {}, blur() {},
  };
}

/* O EventTarget e o Node de faz-de-conta do window dos testes: um objeto
   feito com Object.create(No.prototype) é, para o eventos.js, um nó do DOM. */
class EventoAlvo {}
class No extends EventoAlvo {}

/* Um window de faz-de-conta com o eventos.js carregado, e as coisas do
   browser que uma ação não pode alcançar (eval, fetch, setTimeout, Function,
   document, location) como propriedades próprias dele — como no browser.
   Recebe: app (opcional) — código da «app», corrido DEPOIS do eventos.js,
   como no index.html; extra (opcional) — mais propriedades do window, postas
   antes de o eventos.js carregar (como o browser).
   Devolve: {janela, ctx, correr(texto, el, ev), avaliar(expr)}. */
function contexto(app = '', extra = {}) {
  const capturas = {};
  const janela = {
    document: { cookie: 'segredo' },
    location: { href: 'https://teste.local/', reload() { throw new Error('não devia recarregar'); } },
    eval: globalThis.eval, Function: globalThis.Function, fetch: globalThis.fetch, setTimeout: globalThis.setTimeout,
    Math, console, EventTarget: EventoAlvo, Node: No,
    addEventListener(tipo, fn, captura) { (capturas[tipo] = capturas[tipo] || []).push({ fn, captura }); },
    scrollTo() {},
    ...extra,
  };
  janela.window = janela;
  janela.capturas = capturas;
  const ctx = vm.createContext(janela);
  vm.runInContext(CODIGO, ctx, { filename: 'eventos.js' });
  if (app) vm.runInContext(app, ctx, { filename: 'app.js' });
  return {
    janela, ctx,
    correr: (texto, el = elemento('el'), ev = eventoFalso('click', el)) => ctx.correrAcao(texto, el, ev),
    avaliar: (expr) => vm.runInContext(expr, ctx),
  };
}

/* Um evento de faz-de-conta, sem caminho (para correr uma ação à mão).
   Recebe: tipo; alvo.
   Devolve: o evento. */
function eventoFalso(tipo, alvo) {
  return { type: tipo, target: alvo, currentTarget: alvo, key: 'Enter', stopPropagation() {}, preventDefault() {}, composedPath: () => [alvo] };
}

/* Dispara um evento como o DOM: primeiro os ouvintes de captura do window,
   depois o alvo e os antepassados a borbulhar, até alguém chamar
   stopPropagation. A lista de ouvintes de cada nó lê-se quando o evento lá
   chega, como no DOM — é o que deixa o ouvinte posto pela captura disparar
   no mesmo evento.
   Recebe: janela; tipo; alvo; extra (opcional) — propriedades do evento.
   Devolve: o evento. */
function disparar(janela, tipo, alvo, extra = {}) {
  const caminho = [];
  for (let n = alvo; n; n = n.pai) caminho.push(n);
  caminho.push(janela.document, janela);
  let parado = false;
  const ev = {
    type: tipo, target: alvo, currentTarget: janela, ...extra,
    composedPath: () => caminho.slice(),
    stopPropagation() { parado = true; },
    preventDefault() { ev.defaultPrevented = true; },
  };
  for (const o of janela.capturas[tipo] || []) if (o.captura) o.fn(ev);
  for (const n of caminho.slice(0, -2)) {
    if (parado) break;
    ev.currentTarget = n;
    for (const fn of [...(n.ouvintes[tipo] || [])]) fn.call(n, ev);
  }
  return ev;
}

// o código da «app» dos testes: umas funções com espia, o CW e uma função nativa de faz-de-conta
const APP = `
var chamadas = [];
function f() { chamadas.push(['f'].concat([].slice.call(arguments))); return 'f'; }
function g() { chamadas.push(['g'].concat([].slice.call(arguments))); return 'g'; }
function falso() { chamadas.push(['falso']); return false; }
function eu() { chamadas.push(['eu', this]); }
var correu = 0;
var CW = { dados: { x: 1 }, metodo: function () { chamadas.push(['metodo', this === CW]); return 7; },
  nativa: Function.prototype.bind.call(function () { correu++; }, null) };
`;

describe('a gramática das ações', () => {
  const { ctx } = contexto();
  const a = (t, o) => JSON.parse(JSON.stringify(ctx.analisarAcao(t, o).instrucoes));

  test('as formas todas', () => {
    assert.deepEqual(a('f()'), [{ t: 'chama', f: { t: 'nome', n: 'f' }, a: [] }]);
    assert.deepEqual(a("CW.x('a', \"b\", 1, 2.5, -3, true, false, null)")[0].a,
      [{ t: 'lit', v: 'a' }, { t: 'lit', v: 'b' }, { t: 'lit', v: 1 }, { t: 'lit', v: 2.5 },
        { t: 'menos', e: { t: 'lit', v: 3 } }, { t: 'lit', v: true }, { t: 'lit', v: false }, { t: 'lit', v: null }]);
    assert.equal(ctx.analisarAcao('f(undefined)').instrucoes[0].a[0].v, undefined, 'undefined é literal');
    assert.deepEqual(a('this.value'), [{ t: 'prop', o: { t: 'este' }, n: 'value' }]);
    assert.deepEqual(a('event.key'), [{ t: 'prop', o: { t: 'evento' }, n: 'key' }]);
    assert.deepEqual(a('a()||b()&&!c()')[0].t, 'ou', 'o || junta por último');
    assert.equal(a('a()||b()&&!c()')[0].b.t, 'e');
    assert.equal(a('(a()||b())&&c()')[0].t, 'e', 'os parêntesis mandam');
    assert.equal(a('f();g();').length, 2, 'instruções com ; e um ; no fim');
    assert.equal(a('CW.a.b(1)(2)')[0].t, 'chama', 'posfixos encadeados');
    assert.equal(a("'\\\\ \\' \\\" \\n \\t'")[0].v, '\\ \' " \n \t', 'os escapes');
    assert.equal(a('CW.delete()')[0].f.n, 'delete', 'uma palavra reservada vale como propriedade');
    assert.equal(a('  f ( 1 ,\n 2 )  ;  ')[0].a.length, 2, 'espaços e quebras de linha à vontade');
  });

  test('o que fica de fora rebenta com uma mensagem clara', () => {
    const casos = [
      ['x=1', /atribuições fora da gramática/], ['CW.x=1', /atribuições/], ['const i=1', /«const» fica fora/],
      ['let i', /«let» fica fora/], ['var i', /«var» fica fora/], ['()=>f()', /setas fora/], ['function(){}', /«function» fica fora/],
      ['if(a)f()', /«if» fica fora/], ['a==b', /comparações/], ['a!==b', /comparações/], ['a<b', /comparações/],
      ['a+b', /aritmética/], ['f(a-b)', /aritmética/], ['a-b', /aritmética/], ['a*2', /aritmética/],
      ['`x`', /template strings/], ['a[0]', /índices/], ['f({a:1})', /objetos e blocos/], ['a?b:c', /\?: fica fora/],
      ['new X()', /«new» fica fora/], ['typeof x', /«typeof» fica fora/], ["'abc", /texto por fechar/], ["'\\x41'", /escape «\\x» fora/],
      ["'\\u0041'", /escape/], ['1px', /número mal escrito/], ['', /ação vazia/], ['   ', /ação vazia/], ['f() g()', /esperava «;»/],
      ['f(1,)', /não esperava «\)»/], ['f(', /acaba a meio/], ['.5', /não esperava/], ['a&b', /bits/], ['f()' + MARCA, /\$\{…\} por resolver/],
    ];
    for (const [t, re] of casos) assert.throws(() => ctx.analisarAcao(t), (e) => e && e.name === 'Error' && /^ação: /.test(e.message) && re.test(e.message), t);
  });

  test('o erro diz a ação onde falhou', () => {
    assert.throws(() => ctx.analisarAcao('go(x=1)'), /em «go\(x=1\)»/);
  });

  test('os marcadores dos ${…}: só com {marcas}, e um nome dinâmico nota-se', () => {
    const nomes = (t) => JSON.parse(JSON.stringify(ctx.nomesDaAcao(ctx.analisarAcao(t, { marcas: true }))));
    assert.deepEqual(nomes(`f('${MARCA}',${MARCA})`), [{ nome: 'f', dinamico: false }], 'no lugar de um valor não conta');
    assert.deepEqual(nomes(MARCA), [{ nome: '${…}', dinamico: true }], 'uma instrução inteira é dinâmica');
    assert.deepEqual(nomes(`closePops();${MARCA}`), [{ nome: 'closePops', dinamico: false }, { nome: '${…}', dinamico: true }]);
    assert.deepEqual(nomes(`${MARCA}txModal(1)`), [{ nome: '${…}txModal', dinamico: true }], 'um nome com um pedaço dinâmico');
    assert.deepEqual(nomes(`CW.${MARCA}()`), [{ nome: 'CW', dinamico: false }, { nome: '.${…}', dinamico: true }]);
    assert.deepEqual(nomes(`${MARCA}(this)`), [{ nome: '${…}', dinamico: true }], 'chamar um ${…} é dinâmico');
    assert.deepEqual(nomes('Math.max(1,this.value)&&CW.x()'), [{ nome: 'Math', dinamico: false }, { nome: 'CW', dinamico: false }]);
  });
});

describe('a segurança: um atributo injetado não corre código que a app não tem', () => {
  const tentativas = [
    'CW.constructor', 'CW.constructor.constructor("return 1")()', 'CW.__proto__', '__proto__', 'CW.dados.__defineGetter__',
    'CW.x.prototype', 'f.call(null,1)', 'f.apply(null)', 'f.bind(null)()', 'f.name', 'CW.metodo.call(1)',
    'this.ownerDocument.defaultView.eval("1")', 'this.parentNode', 'this.innerHTML', 'this.style', 'this.remove()', 'this.select()',
    'event.target', 'event.view', 'event.composedPath()', 'this.value.constructor', "'x'.constructor", 'this.value.toString()',
    "'x'.concat('y')", 'CW.dados.toString()', "CW.dados.hasOwnProperty('x')",
    'window.eval("1")', 'window.CW.metodo()', 'eval("1")', 'fetch("/x")', 'setTimeout("f()",0)', 'Function("return 1")()',
    'document.cookie', 'location.reload()', 'globalThis', 'CW.nativa()', 'CW.metodo(CW.nativa)', 'f(eval)', 'f(this.click)',
    'Math.random()', 'Math.constructor', 'Math.min.call(null,1)', 'f(Math.max)', 'correrAcao("f()")', 'analisarAcao("f()")',
    'ligarEventosDeclarados(this)', 'CW.nativa&&1', 'naoExiste()',
  ];

  test('cada tentativa é recusada, e nada corre', () => {
    const c = contexto(APP);
    for (const t of tentativas) {
      assert.throws(() => c.correr(t), (e) => e && e.name === 'Error' && /^ação: /.test(e.message), t);
    }
    assert.equal(c.avaliar('correu'), 0, 'a nativa de faz-de-conta nunca correu');
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [], 'nem nenhuma função da app');
  });

  test('as recusas dizem porquê', () => {
    const c = contexto(APP);
    assert.throws(() => c.correr('eval("1")'), /ação recusada: «eval» é do browser, e não da app/);
    assert.throws(() => c.correr('naoExiste()'), /ação: nome desconhecido «naoExiste»/);
    assert.throws(() => c.correr('f.call()'), /não se leem propriedades de uma função/);
    assert.throws(() => c.correr('CW.nativa()'), /a função do browser «nativa» não está na lista/);
    assert.throws(() => c.correr('f(CW.nativa)'), /só se chama/);
    assert.throws(() => c.correr('this.parentNode'), /«this\.parentNode» não está na lista/);
    assert.throws(() => c.correr('CW.dados.x()'), /«x» não é uma função/);
  });

  test('o que está na lista corre', () => {
    const c = contexto(APP);
    const el = elemento('b');
    el.value = '7';
    c.correr('f(Math.min(3,Math.max(1,2)),Math.round(2.6),Math.floor(2.6),Math.ceil(2.1),Math.abs(-4))', el);
    c.correr('this.focus();this.blur();this.click();event.preventDefault();event.stopPropagation();f(this.value,this.checked,this.id,this.dataset,this.type,this.name,this.files,this.selectedIndex,event.key)', el);
    const ch = JSON.parse(JSON.stringify(c.avaliar('chamadas')));
    assert.deepEqual(ch[0], ['f', 2, 3, 2, 3, 4]);
    assert.equal(ch[1][1], '7', 'this.value');
    assert.equal(ch[1][9], 'Enter', 'event.key');
  });

  /* A fuga que a revisão achou: um var da app que guarda um nó do DOM (o
     cssPainel, o authEl…) abria o caminho ao document e ao window
     pelo ownerDocument e pelo defaultView. */
  test('um nó do DOM numa var da app não abre o document nem o window', () => {
    const c = contexto(APP + `
var guardado = Object.assign(Object.create(Node.prototype), { value: 'v', id: 'g', nodeType: 1, ownerDocument: document, parentNode: null, remove: function () { chamadas.push(['remove']); } });
var solto = { nodeType: 1, ownerDocument: document, value: 's' };
var CW2 = { doc: document, jan: window, mapa: new Map([['a', 1]]), lista: [1, 2], no: guardado };
`);
    const fugas = ['guardado.ownerDocument.cookie', 'guardado.ownerDocument', 'guardado.parentNode', 'guardado.remove()',
      'f(guardado)', 'f(guardado||1)', 'CW2.no.ownerDocument.cookie', 'f(CW2.no)', 'solto.ownerDocument.cookie', 'f(solto)',
      'CW2.doc.cookie', 'f(CW2.doc)', 'CW2.jan.document', 'CW2.jan.CW.metodo()', 'f(CW2.jan)', 'CW2.mapa.size', 'CW2.mapa.get("a")'];
    for (const t of fugas) assert.throws(() => c.correr(t), (e) => e && e.name === 'Error' && /^ação/.test(e.message), t);
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [], 'nada correu');
    assert.throws(() => c.correr('guardado.ownerDocument.cookie'), /«ownerDocument» não se lê de um objeto do browser/);
    assert.throws(() => c.correr('CW2.doc.cookie'), /não se lê nada do window nem do document/);
    assert.throws(() => c.correr('f(guardado)'), /«guardado» é o window, o document ou um nó do DOM/);
    // o que está na lista lê-se, e o que é da app lê-se todo
    c.correr('f(guardado.value,guardado.id,CW2.lista.length,CW.dados.x)');
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['f', 'v', 'g', 2, 1]]);
  });

  test('o que aparece no window depois de a lista da app fechar não se chama', () => {
    const c = contexto(APP);
    c.ctx.fecharNomesDaApp(c.janela);
    vm.runInContext(`
var google = { accounts: { id: { cancel: function () { chamadas.push(['cancel']); } } } };
window.tarde = function () { chamadas.push(['tarde']); };
`, c.ctx);
    assert.throws(() => c.correr('google.accounts.id.cancel()'), /«google» é de um script de fora/);
    assert.throws(() => c.correr('tarde()'), /«tarde» apareceu no window depois do arranque/);
    c.correr('f(1);CW.metodo();Math.max(1,2)');
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['f', 1], ['metodo', true]], 'o que a app declarou corre');
  });

  test('os nomes dos scripts de fora recusam-se mesmo antes de a lista fechar', () => {
    const c = contexto(APP + `
var google = { accounts: { id: { cancel: function () { chamadas.push(['cancel']); } } } };
var default_gsi = { f: function () { chamadas.push(['gsi']); } };
var closure_lm_771938 = { f: function () { chamadas.push(['closure']); } };
var _F_toggles_default_gsi = function () { chamadas.push(['toggles']); };
`);
    for (const t of ['google.accounts.id.cancel()', 'default_gsi.f()', 'closure_lm_771938.f()', '_F_toggles_default_gsi()']) {
      assert.throws(() => c.correr(t), /é de um script de fora/, t);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), []);
  });

  test('a lista da app fecha no DOMContentLoaded', () => {
    const ouvintes = {};
    const documento = { cookie: 'segredo', readyState: 'loading', addEventListener(t, fn, o) { ouvintes[t] = { fn, o }; } };
    const c = contexto(APP, { document: documento });
    assert.equal(c.avaliar('ACAO_ESTADO.daApp'), null, 'enquanto a página carrega, a lista está aberta');
    assert.equal(ouvintes.DOMContentLoaded.o.once, true);
    ouvintes.DOMContentLoaded.fn();
    vm.runInContext("window.tarde = function () { chamadas.push(['tarde']); };", c.ctx);
    assert.throws(() => c.correr('tarde()'), /apareceu no window depois do arranque/);
    c.correr('f(2)');
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['f', 2]]);
    assert.equal(c.avaliar("ACAO_ESTADO.daApp.has('correrAcao')"), false, 'o mecanismo não entra na lista da app');
    assert.equal(c.avaliar("ACAO_ESTADO.daApp.has('subirAoTopo')"), true, 'o subirAoTopo entra');
    assert.equal(c.avaliar("ACAO_ESTADO.daApp.has('f')"), true, 'e o que a app declarou também');
  });

  test('nenhum nome da app tem cara de script de fora', () => {
    const c = contexto();
    const deFora = c.avaliar('ACAO_DE_FORA');
    const choques = [];
    for (const rel of TUDO) {
      for (const [nome] of lerDeclaracoes(fs.readFileSync(path.join(RAIZ, 'web', rel), 'utf8'), rel)) if (deFora.test(nome)) choques.push(rel + ':' + nome);
    }
    assert.deepEqual(choques, []);
  });

  test('no browser, as nativas da lista conferem-se por identidade', () => {
    // um Event e um HTMLElement de faz-de-conta com métodos nativos (ligados, que o toString diz nativos)
    const nativa = () => Function.prototype.bind.call(function () {}, null);
    const Event = function () {}; Event.prototype.stopPropagation = nativa(); Event.prototype.preventDefault = nativa();
    const HTMLElement = function () {}; HTMLElement.prototype.click = nativa(); HTMLElement.prototype.focus = nativa(); HTMLElement.prototype.blur = nativa();
    const capturas = {};
    const janela = { Math, Event, HTMLElement, addEventListener(t, fn, c) { (capturas[t] = capturas[t] || []).push({ fn, captura: c }); } };
    janela.window = janela;
    const ctx = vm.createContext(janela);
    vm.runInContext(CODIGO, ctx);
    const el = Object.assign(Object.create(HTMLElement.prototype), { remove: nativa() });
    const ev = Object.create(Event.prototype);
    assert.doesNotThrow(() => ctx.correrAcao('this.click();this.focus();event.stopPropagation();event.preventDefault()', el, ev));
    // a mesma função nativa, noutro sítio, com o nome da lista: recusada, porque não é a mesma
    const outro = { click: nativa() };
    vm.runInContext('var CW = {}', ctx);
    ctx.CW.alvo = outro;
    assert.throws(() => ctx.correrAcao('CW.alvo.click()', el, ev), /função do browser «click» não está na lista/);
  });

  /* A fuga da segunda revisão: o que uma chamada devolvia não passava pelo
     acaoValor, e uma função da app que devolvesse uma nativa (o
     funcaoDeTopo('fetch') de antes), o window, o document ou um nó
     entregava-o a outra: closeDrawer(funcaoDeTopo('fetch')) corria. */
  test('o que uma chamada devolve também circula: f(g()) com o g a devolver uma nativa, o window, o document ou um nó é recusado', () => {
    const c = contexto(APP + `
var guardado = Object.assign(Object.create(Node.prototype), { value: 'v', nodeType: 1 });
function daNativa() { return CW.nativa; }
function daJanela() { return window; }
function daDocumento() { return document; }
function daNo() { return guardado; }
function daApp() { return f; }
function oMesmo(x) { return x; }
`);
    const tentativas = ['f(daNativa())', 'f(daJanela())', 'f(daDocumento())', 'f(daNo())',
      'f(daNativa()||1)', 'f(1&&daNo())', 'f(daJanela()&&1)', 'daNativa()&&f()', 'daDocumento()||f()', 'f(daApp()(daNativa()))',
      'CW.metodo(daJanela())', '(daNativa())("/x")', 'daNo().click()', 'daNo().value', 'daDocumento()', 'daNativa()', 'f(1);daJanela()'];
    for (const t of tentativas) {
      assert.throws(() => c.correr(t), (e) => e && e.name === 'Error' && /^ação: ação recusada: /.test(e.message), t);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['f', 1]], 'nenhuma função recebeu o que não devia (o f(1) é da última, antes da recusa)');
    assert.throws(() => c.correr('f(daNativa())'), /a função do browser «daNativa\(\)» só se chama/);
    assert.throws(() => c.correr('f(daNo())'), /«daNo\(\)» é o window, o document ou um nó do DOM/);
    // o que é da app continua a circular: uma função da app, o this devolvido, um objeto, um texto
    const el = elemento('b');
    c.avaliar('chamadas.length = 0');
    c.correr('f(daApp(),oMesmo(this),oMesmo(CW.dados),oMesmo("t"))', el);
    const [ch] = c.avaliar('chamadas');
    assert.equal(ch[1], c.avaliar('f'));
    assert.equal(ch[2], el, 'o this pode voltar de uma função');
    assert.equal(ch[3], c.avaliar('CW.dados'));
    assert.equal(ch[4], 't');
  });

  test('o funcaoDaApp, o despacho por nome partilhado, só devolve funções da app', () => {
    // o fetch do Node é JavaScript, e não nativo: a nativa de faz-de-conta é o CW.nativa (uma função ligada)
    const c = contexto(APP + 'var guardaNativa = CW.nativa; var numero = 3;');
    const d = c.ctx.funcaoDaApp;
    assert.equal(d('f'), c.avaliar('f'));
    assert.equal(d('subirAoTopo'), c.avaliar('subirAoTopo'), 'o que o eventos.js oferece às ações também');
    const nulos = ['fetch', 'eval', 'setTimeout', 'Function', 'document', 'location', 'window', 'Math', 'guardaNativa', 'numero', 'CW',
      'naoExiste', '', '__proto__', 'constructor', 'prototype', 'correrAcao', 'funcaoDaApp', 'google', 'default_gsi', null, undefined, 3];
    for (const n of nulos) assert.equal(d(n), null, String(n));
    assert.equal(d(c.avaliar('f')), null, 'uma função no lugar do nome não é um nome');
    for (const [n, re] of [['fetch', /recusado: «fetch» é do browser, e não da app/], ['eval', /é do browser/], ['document', /é do browser/],
      ['guardaNativa', /«guardaNativa» é uma função do browser/], ['__proto__', /não se lê/], ['google', /é de um script de fora/]]) {
      assert.throws(() => d(n, true), (e) => e && e.name === 'Error' && re.test(e.message) && /o despacho por nome só chama funções da app/.test(e.message), n);
    }
    assert.equal(d('naoExiste', true), null, 'o que não existe não é recusado: é null');
    assert.equal(d('numero', true), null);
    // depois do arranque
    c.ctx.fecharNomesDaApp(c.janela);
    vm.runInContext("window.tarde = function () { chamadas.push(['tarde']); };", c.ctx);
    assert.equal(d('tarde'), null);
    assert.throws(() => d('tarde', true), /«tarde» apareceu no window depois do arranque/);
    assert.equal(d('f'), c.avaliar('f'), 'o que a app declarou continua a resolver');
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), []);
  });
});

/* A fuga grave da segunda revisão: o chamarServico(id, nome, …args) — uma
   função da app, que qualquer ação chama — resolvia o nome pelo
   funcaoDeTopo, que devolvia window[nome] sem olhar se era nativa:
   chamarServico('x','fetch','/x') fazia o pedido. O delFileConfirm e o
   selPick despachavam por nome da mesma maneira. */
describe('o despacho por nome só chega a funções da app', () => {
  /* A app no arnês com um alert e um fetch nativos de faz-de-conta (funções
     ligadas, que o toString diz nativas), postos antes do eventos.js como
     o browser os põe, e uma função de teste que conta o que apaga.
     Recebe: nada.
     Devolve: {app, disparos} — disparos() diz quantas vezes uma nativa correu. */
  function appComNativas() {
    let n = 0;
    const nativa = () => Function.prototype.bind.call(() => { n++; }, null);
    const app = carregarApp({ antes: (ctx) => { ctx.alert = nativa(); ctx.fetch = nativa(); ctx.open = nativa(); } });
    vm.runInContext('var apagados = []; var mudou = 0; var valores = []; function apagaDeTeste(id) { apagados.push(id); } ' +
      'function mudouDeTeste() { mudou++; } function somaDeValor(v) { valores.push(v); }', app.__ctx);
    return { app, disparos: () => n };
  }

  test('chamarServico, delFileConfirm e selPick recusam uma nativa ou um nome do browser, e nada corre', () => {
    const { app, disparos } = appComNativas();
    let abertas = 0;
    app.confirmModal = () => { abertas++; };
    for (const [n, a] of [['fetch', '/x'], ['alert', 'FUGA'], ['open', '/x'], ['setTimeout', 0], ['document', 1]]) {
      assert.throws(() => app.chamarServico('x', n, a), /^Error: ação: recusado: «\w+» é do browser, e não da app/, n);
    }
    assert.throws(() => app.delFileConfirm('alert', 'x', 'ficheiro'), /recusado: «alert» é do browser/);
    assert.throws(() => app.delFileConfirm('fetch', 'x', 'fotografia'), /recusado: «fetch» é do browser/);
    assert.equal(abertas, 0, 'a pergunta nem chega a abrir');
    app.__ctx.__sel.s1 = { options: [{ v: 'a', label: 'A' }], onchange: 'alert' };
    assert.throws(() => app.selPick(null, 's1', 0), /recusado: «alert» é do browser/);
    assert.equal(app.funcaoDeTopo('fetch'), null);
    assert.equal(app.funcaoDeTopo('alert'), null);
    assert.equal(disparos(), 0, 'nenhuma nativa correu');
    // e por uma ação, como um atributo injetado o faria
    for (const t of ["chamarServico('x','fetch','/x')", "chamarServico('x','setTimeout',funcaoDeTopo('alert'),0)",
      "delFileConfirm('alert','x','ficheiro')"]) {
      assert.throws(() => app.correrAcao(t, null, null), /^Error: ação: /, t);
    }
    // o closeDrawer(funcaoDeTopo('fetch')) da revisão: o funcaoDeTopo já não devolve a nativa, e o que sai é null
    app.correrAcao("somaDeValor(funcaoDeTopo('fetch'))", null, null);
    assert.deepEqual([...app.valores], [null]);
    assert.equal(disparos(), 0);
  });

  test('os usos legítimos continuam: chamar uma função da app pelo nome, apagar depois do sim, o onchange do sel', () => {
    const { app } = appComNativas();
    vm.runInContext('function somaDeTeste(a,b){return a+b}', app.__ctx);
    assert.equal(app.chamarServico('credits', 'somaDeTeste', 2, 3), 5);
    assert.equal(app.chamarServico('credits', 'naoExisteDeTeste'), undefined, 'o que não existe continua a só avisar');
    app.confirmModal = (t, x, sim) => sim();
    app.delFileConfirm('apagaDeTeste', 'F1', 'ficheiro');
    assert.deepEqual([...app.apagados], ['F1']);
    app.__ctx.__sel.s2 = { options: [{ v: 'a', label: 'A' }], onchange: 'mudouDeTeste' };
    app.selPick(null, 's2', 0);
    app.__ctx.__sel.s3 = { options: [{ v: 'a', label: 'A' }], onchange: () => { app.__ctx.mudou += 10; } };
    app.selPick(null, 's3', 0);
    assert.equal(app.mudou, 11, 'pelo nome e como função');
    // o filtro das listas vai como função, sem pendurar um onlf_… no window
    const html = app.lfSel('lprops', 'st', [{ v: '', label: 'Todos' }, { v: 'x', label: 'X' }]);
    assert.match(html, /lfsel_lprops_st/);
    assert.equal(Object.keys(app.__ctx).some((k) => k.startsWith('onlf_')), false);
    assert.equal(typeof app.__ctx.__sel.lfsel_lprops_st.onchange, 'function');
    app.document.getElementById('lfsel_lprops_st').value = 'x';
    app.selPick(null, 'lfsel_lprops_st', 1);
    assert.equal(app.lf('lprops').st, 'x', 'o filtro aplicou-se');
  });

  test('nenhuma função de topo carrega um <script> com um src vindo de fora: o loadScript vive dentro do loadSocial', () => {
    const { app } = appComNativas();
    app.fecharNomesDaApp(app.__ctx);
    assert.equal(Object.prototype.hasOwnProperty.call(app.__ctx, 'loadScript'), false, 'o loadScript não é de topo');
    assert.equal(app.ACAO_ESTADO.daApp.has('loadScript'), false);
    assert.equal(app.funcaoDeTopo('loadScript'), null);
    assert.throws(() => app.correrAcao("loadScript('/paginas/documento.js',closeDrawer)", null, null), /nome desconhecido «loadScript»/);
    assert.equal(app.chamarServico('credits', 'loadScript', '/x.js', () => {}), undefined, 'o despacho não o acha');
    // no código, o único createElement('script') da app está dentro do loadSocial, com o URL fixo do Google
    const pastaWeb = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
    const ondeHa = [];
    /* Percorre uma pasta de web/ à procura de .js que criem um <script>.
       Recebe: pasta — o caminho absoluto. Devolve: nada — enche o ondeHa. */
    const procurar = (pasta) => {
      for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
        const p = path.join(pasta, e.name);
        if (e.isDirectory()) procurar(p);
        else if (e.name.endsWith('.js') && /createElement\(\s*['"]script['"]\s*\)/i.test(fs.readFileSync(p, 'utf8'))) ondeHa.push(path.relative(pastaWeb, p).replace(/\\/g, '/'));
      }
    };
    procurar(pastaWeb);
    assert.deepEqual(ondeHa, ['cloud/entrada.js']);
    // com CRLF (é assim nesta cópia de trabalho) o recorte por '\n}\n' não achava o fim, e o «corpo» ia até ao fim do ficheiro
    const fonte = fs.readFileSync(path.join(pastaWeb, 'cloud', 'entrada.js'), 'utf8').replace(/\r\n/g, '\n');
    const corpo = fonte.slice(fonte.indexOf('function loadSocial()'), fonte.indexOf('\n}\n', fonte.indexOf('function loadSocial()')));
    assert.match(corpo, /function loadScript\(src, cb\)[\s\S]*createElement\('script'\)/, 'o loadScript está dentro do loadSocial');
    assert.match(corpo, /loadScript\('https:\/\/accounts\.google\.com\/gsi\/client'/, 'e só carrega o URL fixo do Google');
  });

  test('com a lista da app fechada: os serviços despacham, o _ok, o _pick e o _pm estão nela, e o que chega tarde é recusado', () => {
    const { app } = appComNativas();
    vm.runInContext('function somaDeTeste(a,b){return a+b}', app.__ctx);
    app.fecharNomesDaApp(app.__ctx);
    for (const n of ['_ok', '_pick', '_pm', 'chamarServico', 'funcaoDeTopo', 'delFileConfirm', 'selPick']) {
      assert.ok(app.ACAO_ESTADO.daApp.has(n), n + ' na lista da app');
    }
    assert.equal(app.chamarServico('credits', 'somaDeTeste', 2, 3), 5);
    vm.runInContext('window.tardia = function () { return 1; };', app.__ctx);
    assert.throws(() => app.chamarServico('credits', 'tardia'), /«tardia» apareceu no window depois do arranque/);
    // os nomes que cada janela troca, chamados por uma ação como o botão o faria (o DOM do arnês não abre janelas)
    app.openModal = () => {};
    app.closeModal = () => {};
    let sim = 0, escolha = null, texto = null;
    app.confirmModal('Apagar isto', 'x', () => { sim++; });
    app.correrAcao('_ok()', null, null);
    app.pickModal('Escolher', [{ label: 'A' }, { label: 'B' }], (o) => { escolha = o.label; });
    app.correrAcao('_pick(1)', null, null);
    app.promptModal('Nome', 'Nome', '', (v) => { texto = v; });
    app.document.getElementById('pm_v').value = ' Ana ';
    app.correrAcao('_pm()', null, null);
    assert.deepEqual([sim, escolha, texto], [1, 'B', 'Ana']);
  });
});

describe('a semântica de um on…=', () => {
  test('this é o elemento que tem o atributo, e event o evento', () => {
    const c = contexto(APP);
    const botao = elemento('botao', { 'data-click': 'f(this,event)' });
    const icone = elemento('icone', {}, botao);
    const ev = disparar(c.janela, 'click', icone);
    const [nome, este, evento] = c.avaliar('chamadas')[0];
    assert.equal(nome, 'f');
    assert.equal(este, botao, 'o currentTarget, e não o alvo do clique');
    assert.equal(evento, ev);
  });

  test('o this de CW.metodo() é o CW', () => {
    const c = contexto(APP);
    assert.equal(c.correr('CW.metodo()'), undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['metodo', true]]);
  });

  test('&& e || como em JavaScript, e as instruções pela ordem', () => {
    const c = contexto(APP);
    c.correr('falso()&&f(1);f(2)||g(3);falso()||g(4);!falso()&&f(5);f(-1)');
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))),
      [['falso'], ['f', 2], ['falso'], ['g', 4], ['falso'], ['f', 5], ['f', -1]]);
  });

  test('uma função da app pode ir como valor (o CW.x&&CW.x() de quem pergunta antes)', () => {
    const c = contexto(APP);
    c.correr('CW.metodo&&CW.metodo();CW.naoHa&&CW.naoHa()');
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['metodo', true]]);
  });

  test('stopPropagation numa ação trava as de cima, como antes', () => {
    const c = contexto(APP);
    const pai = elemento('pai', { 'data-click': 'g()' });
    const filho = elemento('filho', { 'data-click': 'event.stopPropagation();f()' }, pai);
    disparar(c.janela, 'click', filho);
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['f']], 'o do pai não correu');
    disparar(c.janela, 'click', pai);
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['f'], ['g']], 'e corre quando é ele o alvo');
  });

  test('o alvo primeiro, depois os antepassados', () => {
    const c = contexto(APP);
    const avo = elemento('avo', { 'data-click': 'f(3)' });
    const pai = elemento('pai', { 'data-click': 'f(2)' }, avo);
    const filho = elemento('filho', { 'data-click': 'f(1)' }, pai);
    disparar(c.janela, 'click', filho);
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['f', 1], ['f', 2], ['f', 3]]);
  });

  /* O jsq (web/app/formato.js) é o que a app usa para pôr um texto entre
     plicas dentro de um on…=: escapa \ e ' e muda as quebras de linha (\n e
     \r\n) para espaços, e depois o esc() escapa-o para o atributo. O
     analisador de HTML, ao ler o atributo, desfaz o esc e troca cada \r que
     sobre (um \r sozinho, que o jsq não toca) por \n; a gramática desfaz o
     resto. Tem de chegar à função o mesmo texto que chegava ao on…= — com uma
     diferença, que é melhoria: um \r sozinho chega como \n, onde o on…=
     rebentava («Invalid or unexpected token»). */
  test('qualquer texto passado pelo jsq chega igual à função (um \\r sozinho chega como \\n)', () => {
    const app = carregarApp();
    vm.runInContext('var recebidos = []; function espia() { recebidos.push([].slice.call(arguments)); }', app.__ctx);
    // o que o analisador de HTML faz ao valor do atributo: os fins de linha a \n, e as entidades desfeitas
    const doAtributo = (s) => s.replace(/\r\n?/g, '\n')
      .replace(/&(quot|#0?39|amp|lt|gt);/g, (_, e) => ({ quot: '"', '#039': "'", '#39': "'", amp: '&', lt: '<', gt: '>' }[e]));
    const esperado = (s) => s.replace(/\r?\n/g, ' ').replace(/\r/g, '\n');
    const fixos = ['', 'simples', "a'b", 'a\\b', "\\'", "'\\'", 'a"b', '<b>&amp;</b>', 'linha\nnova', 'crlf\r\nfim', 'só \r', 'ação € 😀',
      '${x}', '`t`', "');alert(1);('", "\\\\'", 'fim\\', '\u2028', 'tab\tx', '&#039;', '&quot;', "'); f('", '\\n', '"; x="', 'a;b', ')'];
    let semente = 7;
    const aleatorio = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
    const letras = ['a', 'Z', '9', ' ', "'", '"', '\\', '\n', '\r', '\t', '&', '<', '>', ';', '(', ')', '$', '{', '}', '`', 'ç', '€', '\u2028', '#', '='];
    const soltos = Array.from({ length: 300 }, () => Array.from({ length: Math.floor(aleatorio() * 12) }, () => letras[Math.floor(aleatorio() * letras.length)]).join(''));
    for (const s of fixos.concat(soltos)) {
      const atributo = doAtributo(`espia('${app.jsq(s)}','${app.jsq(s + '!')}')`);
      vm.runInContext('recebidos.length = 0', app.__ctx);
      app.correrAcao(atributo, null, null);
      const [r] = app.recebidos;
      assert.deepEqual([r[0], r[1]], [esperado(s), esperado(s + '!')], JSON.stringify(s));
    }
  });
});

describe('a ligação preguiçosa', () => {
  test('um ouvinte de captura em window por tipo, e só esses', () => {
    const c = contexto();
    assert.deepEqual(Object.keys(c.janela.capturas).sort(), ['change', 'click', 'input', 'keydown', 'pointerdown']);
    for (const l of Object.values(c.janela.capturas)) assert.deepEqual(l.map((o) => o.captura), [true]);
  });

  test('o elemento só se liga quando um evento lhe passa, e uma vez só', () => {
    const c = contexto(APP);
    const el = elemento('el', { 'data-click': 'f()' });
    assert.equal(el.ouvintes.click, undefined, 'antes de haver evento, nada');
    disparar(c.janela, 'click', el);
    disparar(c.janela, 'click', el);
    assert.equal(el.ouvintes.click.length, 1, 'um ouvinte');
    assert.equal(c.avaliar('chamadas').length, 2, 'e uma ação por evento');
    disparar(c.janela, 'input', el);
    assert.equal(el.ouvintes.input, undefined, 'outro tipo sem atributo não liga nada');
  });

  test('o atributo lê-se quando o evento chega: mudá-lo muda a ação, tirá-lo desliga-a', () => {
    const c = contexto(APP);
    const el = elemento('el', { 'data-click': 'f(1)' });
    disparar(c.janela, 'click', el);
    el.setAttribute('data-click', 'g(2)');
    disparar(c.janela, 'click', el);
    el.removeAttribute('data-click');
    disparar(c.janela, 'click', el);
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))), [['f', 1], ['g', 2]]);
  });

  test('um elemento acabado de nascer responde logo ao primeiro evento (o el.click() depois de um innerHTML)', () => {
    const c = contexto(APP);
    const novo = elemento('novo', { 'data-click': 'f()' });
    disparar(c.janela, 'click', novo);
    assert.equal(c.avaliar('chamadas').length, 1);
  });

  test('os cinco tipos, cada um com o seu atributo', () => {
    const c = contexto(APP);
    const el = elemento('campo', { 'data-change': "f('change',this.value)", 'data-input': "f('input')", 'data-keydown': "f('keydown',event.key)", 'data-pointerdown': "f('pointerdown')", 'data-click': "f('click')" });
    el.value = 'x';
    for (const t of ['change', 'input', 'keydown', 'pointerdown', 'click']) disparar(c.janela, t, el, { key: 'Enter' });
    assert.deepEqual(JSON.parse(JSON.stringify(c.avaliar('chamadas'))),
      [['f', 'change', 'x'], ['f', 'input'], ['f', 'keydown', 'Enter'], ['f', 'pointerdown'], ['f', 'click']]);
  });

  test('uma ação que falha rebenta com o Error dela, como o erro de um on…=', () => {
    const c = contexto(APP);
    const el = elemento('el', { 'data-click': 'naoExiste()' });
    assert.throws(() => disparar(c.janela, 'click', el), /^Error: ação: nome desconhecido «naoExiste»/);
  });

  test('o que está no caminho e não é elemento (document, window) passa ao lado', () => {
    const c = contexto(APP);
    assert.doesNotThrow(() => disparar(c.janela, 'click', elemento('solto')));
  });

  test('a árvore guarda-se por texto', () => {
    const c = contexto(APP);
    c.correr('f(1)');
    const antes = c.avaliar("ACAO_GUARDADAS.get('f(1)')");
    c.correr('f(1)');
    assert.equal(c.avaliar("ACAO_GUARDADAS.get('f(1)')"), antes, 'a mesma árvore, sem voltar a analisar');
    assert.equal(c.avaliar('ACAO_GUARDADAS.size'), 1);
  });

  test('carrega no arnês, e o arnês vê-o', () => {
    const app = carregarApp();
    assert.equal(typeof app.analisarAcao, 'function');
    assert.equal(typeof app.subirAoTopo, 'function', 'o botão do topo tem a sua função');
    assert.ok(app.ACAO_ESTADO.doBrowser.has('document'), 'o document é do browser');
    assert.ok(!app.ACAO_ESTADO.doBrowser.has('render'), 'o render é da app, que carregou depois');
    assert.ok(!app.ACAO_ESTADO.doBrowser.has('subirAoTopo'), 'e o subirAoTopo é oferecido às ações');
    assert.equal(app.ACAO_ESTADO.daApp, null, 'o document do arnês não está a carregar: a lista dos nomes fica aberta');
  });
});

/* Os textos dos on…= como estavam no código-fonte, feitos ação: cada ${…}
   (com as chavetas equilibradas) e cada concatenação ' + … + ' passa a um
   marcador, os escapes do texto JavaScript à volta desfazem-se, e as
   entidades do esc() também, como o browser as desfaz ao ler o atributo.
   Recebe: c — o texto do handlers.json.
   Devolve: a ação, com marcadores. */
function acaoDoCodigo(c) {
  let s = '';
  for (let i = 0; i < c.length;) {
    if (c[i] === '$' && c[i + 1] === '{') {
      let fundo = 1, j = i + 2;
      while (j < c.length && fundo) { if (c[j] === '{') fundo++; else if (c[j] === '}') fundo--; j++; }
      s += MARCA;
      i = j;
      continue;
    }
    s += c[i++];
  }
  s = s.replace(/(?<!\\)'\s*\+[\s\S]*?\+\s*'/g, MARCA).replace(/(?<!\\)'\s*\+[\s\S]*$/, MARCA);
  s = s.replace(/\\(['"\\])/g, '$1');
  return s.replace(/&(quot|#0?39|amp|lt|gt);/g, (_, e) => ({ quot: '"', '#039': "'", '#39': "'", amp: '&', lt: '<', gt: '>' }[e]));
}

describe('os on…= da app, pela gramática', () => {
  const HANDLERS = path.join(RAIZ, '.unlazy', 'csp', 'handlers.json');
  // o .unlazy/ não vai para o git: no CI este bloco não tem o que ler
  const temLista = fs.existsSync(HANDLERS);

  test('o texto do código faz-se ação', () => {
    assert.equal(acaoDoCodigo("CW.newTicket(\\'problema\\')"), "CW.newTicket('problema')");
    assert.equal(acaoDoCodigo("CW.guiaAbrir(\\'' + t.id + '\\')"), `CW.guiaAbrir('${MARCA}')`);
    assert.equal(acaoDoCodigo("settleModal(${pid?`'${jsq(pid)}'`:'null'})"), `settleModal(${MARCA})`);
    assert.equal(acaoDoCodigo("' + p.act + '"), MARCA);
  });

  test('cada on…= da app passa, ou fica na lista de trabalho', { skip: !temLista && 'sem o .unlazy/csp/handlers.json' }, () => {
    const handlers = JSON.parse(fs.readFileSync(HANDLERS, 'utf8').replace(/^\uFEFF/, ''));
    assert.equal(handlers.length, 347, 'os 347 on…= de antes da migração');
    // os nomes que uma ação pode usar: function, var ou window.x de topo em web/, e o Math
    const daApp = new Set(['Math']);
    for (const rel of TUDO) {
      for (const [nome, forma] of lerDeclaracoes(fs.readFileSync(path.join(RAIZ, 'web', rel), 'utf8'), rel)) {
        if (forma === 'function' || forma === 'var' || forma === 'window') daApp.add(nome);
      }
    }
    const { ctx } = contexto();
    const fora = [], dinamicos = [];
    let passam = 0;
    for (const h of handlers) {
      const f = h.f.replace(/\\/g, '/');
      const acao = acaoDoCodigo(h.c);
      let nomes;
      try {
        nomes = JSON.parse(JSON.stringify(ctx.nomesDaAcao(ctx.analisarAcao(acao, { marcas: true }))));
      } catch (e) {
        fora.push({ f, linha: h.linha, ev: h.ev, c: h.c, motivo: e.message.split(' em «')[0] });
        continue;
      }
      const desconhecidos = nomes.filter((n) => !n.dinamico && !daApp.has(n.nome)).map((n) => n.nome);
      if (desconhecidos.length) {
        fora.push({ f, linha: h.linha, ev: h.ev, c: h.c, motivo: 'nome que não é function, var nem window.x de topo em web/: ' + desconhecidos.join(', ') });
        continue;
      }
      const din = nomes.filter((n) => n.dinamico).map((n) => n.nome);
      if (din.length) dinamicos.push({ f, linha: h.linha, ev: h.ev, c: h.c, nomes: din });
      else passam++;
    }
    fs.writeFileSync(path.join(RAIZ, '.unlazy', 'csp', 'fora-da-gramatica.json'), JSON.stringify({
      nota: 'Gerado por testes/eventos.test.js a partir do handlers.json: os on…= que não passam na gramática de web/app/eventos.js ' +
        '(fora) e os que têm nomes dinâmicos, que só se verificam à mão (dinamicos). A lista de trabalho de quem converte cada ficheiro.',
      total: handlers.length, passam, fora: fora.length, dinamicos: dinamicos.length,
      listaFora: fora, listaDinamicos: dinamicos,
    }, null, 2) + '\n');
    assert.equal(passam + fora.length + dinamicos.length, handlers.length);
    assert.ok(passam > 250, 'a grande maioria passa tal como está: ' + passam);
    assert.ok(fora.length > 10 && fora.length < 60, 'uns trinta ficam de fora: ' + fora.length);
    // os que se sabe que ficam de fora, pelo que são
    const motivoDe = (c) => (fora.find((x) => x.c === c) || {}).motivo || '';
    assert.match(motivoDe("go('transactions');setTimeout(()=>{txProp='__none__';render()},0)"), /setas|atribuições|objetos/);
    assert.match(motivoDe("if(event.key==='Enter'){event.preventDefault();_pm()}"), /«if» fica fora/);
    assert.match(motivoDe("window.CW&&CW.enterEdit&&CW.enterEdit()"), /window/);
    assert.match(motivoDe("window.scrollTo({top:0,behavior:'smooth'})"), /objetos/);
    assert.ok(dinamicos.some((d) => d.c === '${addAct}'), 'o ${addAct} é dinâmico');
  });
});

/* O mesmo mecanismo, mas na app carregada pelo arnês — que é a que conta: a
   cobertura do CI só vê os módulos carregados pelo endereço file:// de cada um
   (arnes.js:carregarEm), e o contexto de vm lá de cima corre o eventos.js à
   parte, fora dessa conta. */
describe('no arnês: a leitura, os nomes, o botão do topo e a ligação preguiçosa', () => {
  test('o que uma ação lê do this, do event e de um objeto da app', () => {
    const app = carregarApp();
    vm.runInContext('var lidos = []; function leDeTeste() { lidos.push([].slice.call(arguments)); } var CWT = { dados: { x: 1 } };', app.__ctx);
    const el = elemento('campo');
    el.value = '7';
    const ev = eventoFalso('keydown', el);
    app.correrAcao('leDeTeste(this.value,this.id,event.key,CWT.dados.x)', el, ev);
    assert.deepEqual(JSON.parse(JSON.stringify(app.lidos)), [['7', 'campo', 'Enter', 1]]);
    assert.throws(() => app.correrAcao('leDeTeste(this.parentNode)', el, ev), /«this\.parentNode» não está na lista/);
    assert.throws(() => app.correrAcao('leDeTeste(document.cookie)', el, ev), /«document» é do browser/);
    assert.equal(app.lidos.length, 1, 'nenhuma das recusadas chegou à função');
  });

  test('os nomes globais que uma ação usa', () => {
    const app = carregarApp();
    assert.deepEqual(JSON.parse(JSON.stringify(app.nomesDaAcao(app.analisarAcao("closePops();go('imoveis')&&CW.f(this.value)")))),
      [{ nome: 'closePops', dinamico: false }, { nome: 'go', dinamico: false }, { nome: 'CW', dinamico: false }]);
  });

  test('o botão do topo sobe a página', () => {
    let subiu = null;
    const app = carregarApp({ antes: (ctx) => { ctx.scrollTo = (o) => { subiu = o; }; } });
    app.subirAoTopo();
    assert.deepEqual(JSON.parse(JSON.stringify(subiu)), { top: 0, behavior: 'smooth' });
  });

  test('a captura liga o elemento, a ação corre, e o DOMContentLoaded fecha a lista dos nomes', () => {
    const capturas = {};
    const doDocumento = {};
    const app = carregarApp({
      antes: (ctx) => {
        ctx.addEventListener = (tipo, fn, captura) => { (capturas[tipo] = capturas[tipo] || []).push({ fn, captura }); };
        ctx.document.readyState = 'loading';
        // o primeiro de cada tipo: é o do eventos.js, que é o primeiro módulo a carregar
        ctx.document.addEventListener = (tipo, fn, op) => { if (!doDocumento[tipo]) doDocumento[tipo] = { fn, op }; };
      },
    });
    vm.runInContext('var tocados = []; function tocaDeTeste(x) { tocados.push(x); }', app.__ctx);
    for (const t of ['click', 'change', 'input', 'keydown', 'pointerdown']) {
      assert.deepEqual((capturas[t] || []).map((o) => o.captura), [true], 'um ouvinte de captura para o ' + t);
    }
    const el = elemento('botao', { 'data-click': "tocaDeTeste('sim')" });
    const ev = eventoFalso('click', el);
    capturas.click[0].fn(ev);
    assert.equal(el.ouvintes.click.length, 1, 'a captura ligou o elemento');
    el.ouvintes.click[0](ev);
    assert.deepEqual([...app.tocados], ['sim']);
    el.removeAttribute('data-click');
    el.ouvintes.click[0](ev);
    assert.deepEqual([...app.tocados], ['sim'], 'sem atributo, a ação não corre');
    assert.equal(app.ACAO_ESTADO.daApp, null, 'enquanto a página carrega, a lista está aberta');
    assert.equal(doDocumento.DOMContentLoaded.op.once, true);
    doDocumento.DOMContentLoaded.fn();
    assert.ok(app.ACAO_ESTADO.daApp.has('tocaDeTeste'), 'o que a app declarou entra na lista');
    assert.ok(!app.ACAO_ESTADO.daApp.has('document'), 'o que é do browser não');
  });
});
