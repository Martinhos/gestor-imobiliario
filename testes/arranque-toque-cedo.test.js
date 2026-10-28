// Um toque durante o arranque. Os scripts do index.html correm por ordem, sem
// defer, e o botão da gaveta já está no HTML: o eventos.js (o primeiro) liga os
// data-click logo ao carregar, e um toque no botão enquanto o browser ainda lê
// os ficheiros seguintes corria o openDrawer com o navegacao.js carregado e o
// vistas.js por chegar. O closeFilterPanels lia o LFK e rebentava com
// «LFK is not defined» — e a rede de segurança do arranque (index.html) via um
// «is not defined», limpava a cache, largava o service worker e recarregava.
// Aqui a app carrega aos bocados num contexto de vm, como no browser, e o
// toque chega a meio.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { MODULOS } from './arnes.js';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

/* Um elemento de faz-de-conta, com os atributos, os ouvintes e as classes que
   a gaveta lê e escreve.
   Recebe: tag — o tagName; attrs (opcional) — os atributos.
   Devolve: o elemento. */
function elemento(tag, attrs = {}) {
  const classes = new Set();
  return {
    tagName: tag, attrs: { ...attrs }, ouvintes: {}, style: {}, dataset: {}, children: [], innerHTML: '', textContent: '',
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, f) => ((f === undefined ? !classes.has(c) : f) ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    getAttribute(a) { return Object.prototype.hasOwnProperty.call(this.attrs, a) ? this.attrs[a] : null; },
    hasAttribute(a) { return Object.prototype.hasOwnProperty.call(this.attrs, a); },
    setAttribute(a, v) { this.attrs[a] = String(v); },
    removeAttribute(a) { delete this.attrs[a]; },
    addEventListener(t, fn) { (this.ouvintes[t] = this.ouvintes[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(x) { this.children.push(x); return x; },
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    contains(x) { return x === this; },
    focus() {}, blur() {}, click() {}, remove() {}, scrollIntoView() {}, insertAdjacentHTML() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }),
  };
}

/* Um window de faz-de-conta com o documento a carregar (readyState
   'loading'), que guarda os ouvintes do window e do document para o teste os
   disparar à mão.
   Devolve: {ctx, capturas, doDocumento, body}. */
function janelaACarregar() {
  const capturas = {};
  const doDocumento = {};
  const porId = new Map();
  const body = elemento('BODY');
  const doc = {
    readyState: 'loading', body, documentElement: elemento('HTML'), head: elemento('HEAD'), activeElement: body,
    createElement: (t) => elemento(String(t).toUpperCase()),
    getElementById: (id) => { if (!porId.has(id)) porId.set(id, elemento('DIV')); return porId.get(id); },
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener(t, fn) { (doDocumento[t] = doDocumento[t] || []).push(fn); },
    removeEventListener() {},
    createDocumentFragment: () => elemento('#fragment'),
  };
  const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; };
  const janela = {
    document: doc, localStorage: memoria(), sessionStorage: memoria(),
    location: { origin: 'https://teste.local', pathname: '/', href: 'https://teste.local/', hash: '' },
    navigator: { userAgent: 'node', vibrate() {}, onLine: true },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    crypto: globalThis.crypto, fetch: () => Promise.reject(new Error('sem rede nos testes')),
    setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: (f) => setTimeout(f, 0),
    indexedDB: { open: () => ({ addEventListener() {} }) },
    URL, Blob, TextEncoder, TextDecoder, console, Math, JSON, Intl, Date,
    addEventListener(t, fn, captura) { (capturas[t] = capturas[t] || []).push({ fn, captura }); },
    removeEventListener() {},
    scrollTo() {}, innerWidth: 400, innerHeight: 800, screen: { height: 800 },
    history: { pushState() {}, back() {}, state: null },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };
  janela.window = janela;
  janela.globalThis = janela;
  janela.self = janela;
  return { ctx: vm.createContext(janela), capturas, doDocumento, body };
}

/* Corre os módulos de app/ pela ordem do index.html, como os <script src>.
   Recebe: ctx; nomes — os módulos (sem pasta nem extensão).
   Devolve: nada. */
function carregar(ctx, nomes) {
  for (const n of nomes) {
    const cheio = path.join(WEB, 'app', n + '.js');
    vm.runInContext(fs.readFileSync(cheio, 'utf8'), ctx, { filename: pathToFileURL(cheio).href });
  }
}

/* Dispara um click como o DOM: a captura do window (onde o eventos.js liga o
   elemento), depois os ouvintes do próprio botão.
   Recebe: capturas; el — o botão; extra (opcional) — propriedades do evento.
   Devolve: o evento. */
function tocar(capturas, el, extra = {}) {
  const ev = {
    type: 'click', target: el, currentTarget: el, detail: 1, pointerType: 'touch', isTrusted: true, ...extra,
    composedPath: () => [el], stopPropagation() {}, preventDefault() {},
  };
  for (const o of capturas.click || []) if (o.captura) o.fn(ev);
  for (const fn of [...(el.ouvintes.click || [])]) fn.call(el, ev);
  return ev;
}

// os módulos que já correram quando o toque chega: até ao vistas.js, exclusive
const ANTES_DO_VISTAS = MODULOS.slice(0, MODULOS.indexOf('vistas'));

/* A app a meio do arranque, com o botão da gaveta (index.html: .burger) e um
   contador à volta do openDrawer — o openDrawer de verdade corre na mesma.
   Devolve: {ctx, capturas, doDocumento, body, burger, chamadas()}. */
function aMeio() {
  const j = janelaACarregar();
  carregar(j.ctx, ANTES_DO_VISTAS);
  vm.runInContext('var gavetaAberta = 0; var gavetaOriginal = openDrawer; openDrawer = function () { gavetaAberta++; return gavetaOriginal.apply(this, arguments); };', j.ctx);
  const burger = elemento('BUTTON', { class: 'burger', 'data-click': 'openDrawer()' });
  return { ...j, burger, chamadas: () => vm.runInContext('gavetaAberta', j.ctx) };
}

describe('um toque durante o arranque', () => {
  test('o contexto é o do relato: o navegacao.js já correu e o vistas.js ainda não', () => {
    const { ctx } = aMeio();
    assert.equal(vm.runInContext('typeof closeFilterPanels', ctx), 'function');
    assert.equal(vm.runInContext('typeof LFK', ctx), 'undefined');
    assert.equal(vm.runInContext('typeof fecharFiltros', ctx), 'undefined');
  });

  test('com o documento a carregar, o toque no botão da gaveta não lança nem chama a ação', () => {
    const { capturas, burger, body, chamadas } = aMeio();
    assert.doesNotThrow(() => tocar(capturas, burger));
    assert.equal(burger.ouvintes.click.length, 1, 'o botão ficou ligado, como sempre');
    assert.equal(chamadas(), 0, 'o openDrawer não correu');
    assert.equal(body.classList.contains('open'), false, 'e a gaveta não abriu a meio da app');
  });

  test('o mesmo vale para o toque do teclado (Enter num botão: click sem ponteiro)', () => {
    const { capturas, burger, chamadas } = aMeio();
    assert.doesNotThrow(() => tocar(capturas, burger, { detail: 0, pointerType: '' }));
    assert.equal(chamadas(), 0);
  });

  test('o toque engolido larga na mesma o foco que deixou no botão', () => {
    const { ctx, capturas, burger } = aMeio();
    let largou = 0;
    burger.blur = () => { largou++; ctx.document.activeElement = ctx.document.body; };
    ctx.document.activeElement = burger;
    tocar(capturas, burger);
    assert.ok(largou >= 1, 'o foco saiu do botão');
  });

  test('um el.click() da própria app (isTrusted false) corre como antes, mesmo a carregar', () => {
    const { ctx, capturas } = aMeio();
    vm.runInContext('var tocados = 0; function tocaDeTeste() { tocados++; }', ctx);
    const el = elemento('DIV', { 'data-click': 'tocaDeTeste()' });
    tocar(capturas, el, { isTrusted: false, detail: 0, pointerType: '' });
    assert.equal(vm.runInContext('tocados', ctx), 1);
  });

  test('depois de os scripts todos correrem (DOMContentLoaded), o toque abre a gaveta', () => {
    const { ctx, capturas, doDocumento, burger, body, chamadas } = aMeio();
    tocar(capturas, burger);
    assert.equal(chamadas(), 0);
    carregar(ctx, MODULOS.slice(MODULOS.indexOf('vistas')));
    ctx.document.readyState = 'interactive';
    for (const fn of doDocumento.DOMContentLoaded || []) fn();
    vm.runInContext('render = function () {}; lockPage = function () {}; pushHist = function () {};', ctx);
    assert.doesNotThrow(() => tocar(capturas, burger));
    assert.equal(chamadas(), 1, 'agora a ação corre');
    assert.equal(body.classList.contains('open'), true, 'e a gaveta abre');
    ctx.document.readyState = 'complete';
    vm.runInContext('closeDrawer()', ctx);
    tocar(capturas, burger);
    assert.equal(chamadas(), 2, 'e com a página carregada de todo também');
  });

  test('o closeFilterPanels não rebenta sem o vistas.js', () => {
    const { ctx } = aMeio();
    assert.doesNotThrow(() => vm.runInContext('closeFilterPanels()', ctx));
  });

  test('e o openDrawer chamado sem o vistas.js também não, nem abre meia gaveta', () => {
    const { ctx, body } = aMeio();
    assert.doesNotThrow(() => vm.runInContext('openDrawer()', ctx));
    assert.equal(body.classList.contains('open'), false, 'sem o lockPage, a gaveta abria e a página não trancava');
  });

  test('sem página a carregar (sem readyState, como nos testes e no verificador), a ação corre', () => {
    const { ctx, capturas, burger, chamadas } = aMeio();
    delete ctx.document.readyState;
    vm.runInContext('closeFilterPanels = function () {}; lockPage = function () {}; pushHist = function () {};', ctx);
    tocar(capturas, burger);
    assert.equal(chamadas(), 1);
  });
});
