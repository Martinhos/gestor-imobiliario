// O realce que ficava depois de um toque: um click do dedo ou da caneta num
// elemento com data-click larga o foco que lá ficou (web/app/eventos.js:
// largarFocoDoToque), o teclado e o rato não; os campos guardam o foco; a ação
// que leva o foco para uma janela fica com ele lá; e o passar por cima só
// existe com rato (web/estilos.css: @media (hover:hover) and (pointer:fine)).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const CODIGO = fs.readFileSync(path.join(RAIZ, 'web', 'app', 'eventos.js'), 'utf8');
const CSS = fs.readFileSync(path.join(RAIZ, 'web', 'estilos.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* Um documento de faz-de-conta com foco: o activeElement, o body, e nós que
   se focam, largam o foco, se contêm e procuram a janela à volta.
   Recebe: nada.
   Devolve: {doc, no(tag, attrs, pai, classes)}. */
function documento() {
  const doc = { activeElement: null, body: null, documentElement: null };
  const no = (tag, attrs = {}, pai = null, classes = []) => {
    const n = {
      tagName: tag, attrs: { ...attrs }, pai, classes: new Set(classes), ouvintes: {}, isContentEditable: false,
      getAttribute(a) { return Object.prototype.hasOwnProperty.call(this.attrs, a) ? this.attrs[a] : null; },
      hasAttribute(a) { return Object.prototype.hasOwnProperty.call(this.attrs, a); },
      removeAttribute(a) { delete this.attrs[a]; },
      addEventListener(t, fn) { const l = (this.ouvintes[t] = this.ouvintes[t] || []); if (!l.includes(fn)) l.push(fn); },
      contains(o) { for (let x = o; x; x = x.pai) if (x === this) return true; return false; },
      // só o seletor que o eventos.js pede: a .sheet com tabindex dentro de uma .modal
      closest(sel) {
        assert.equal(sel, '.modal .sheet[tabindex]');
        for (let x = this; x; x = x.pai) {
          if (x.classes.has('sheet') && x.hasAttribute('tabindex')) {
            for (let y = x.pai; y; y = y.pai) if (y.classes.has('modal')) return x;
          }
        }
        return null;
      },
      focus() { doc.activeElement = this; },
      blur() { if (doc.activeElement === this) doc.activeElement = doc.body; },
    };
    return n;
  };
  doc.documentElement = no('HTML');
  doc.body = no('BODY', {}, doc.documentElement);
  doc.activeElement = doc.body;
  return { doc, no };
}

/* Um window de faz-de-conta com o eventos.js carregado e um documento com
   foco; a «app» dos testes vem depois, como no index.html.
   Recebe: app (opcional) — código da app, corrido depois do eventos.js.
   Devolve: {janela, ctx, doc, no, disparar(tipo, alvo, extra)}. */
function contexto(app = '') {
  const capturas = {};
  const { doc, no } = documento();
  const janela = {
    document: doc, Math, console,
    addEventListener(tipo, fn, captura) { (capturas[tipo] = capturas[tipo] || []).push({ fn, captura }); },
    scrollTo() {},
  };
  janela.window = janela;
  const ctx = vm.createContext(janela);
  vm.runInContext(CODIGO, ctx, { filename: 'eventos.js' });
  if (app) vm.runInContext(app, ctx, { filename: 'app.js' });
  /* Dispara um evento como o DOM: as capturas do window, depois o alvo e os
     antepassados a borbulhar.
     Recebe: tipo; alvo; extra (opcional) — as propriedades do evento.
     Devolve: o evento. */
  const disparar = (tipo, alvo, extra = {}) => {
    const caminho = [];
    for (let n = alvo; n; n = n.pai) caminho.push(n);
    let parado = false;
    const ev = {
      type: tipo, target: alvo, currentTarget: janela, detail: 0, ...extra,
      composedPath: () => caminho.concat([doc, janela]),
      stopPropagation() { parado = true; }, preventDefault() {},
    };
    for (const o of capturas[tipo] || []) if (o.captura) o.fn(ev);
    for (const n of caminho) {
      if (parado) break;
      ev.currentTarget = n;
      for (const fn of [...(n.ouvintes[tipo] || [])]) fn.call(n, ev);
    }
    return ev;
  };
  return { janela, ctx, doc, no, disparar };
}

/* Um toque como o browser o dá: o pointerdown (que dá o foco ao elemento
   focável) e o click, com o pointerType no click (Chrome) ou só no
   pointerdown (Safari, com detail 1).
   Recebe: c — o contexto; alvo — onde o dedo cai; focavel — quem recebe o
   foco; opcoes — {tipo: 'touch'|'pen'|'mouse', semTipoNoClick}.
   Devolve: o click. */
function tocar(c, alvo, focavel, opcoes = {}) {
  const tipo = opcoes.tipo || 'touch';
  c.disparar('pointerdown', alvo, { pointerType: tipo });
  if (focavel) focavel.focus();
  return c.disparar('click', alvo, opcoes.semTipoNoClick ? { detail: 1 } : { pointerType: tipo, detail: 1 });
}

const APP = `
var corridas = [];
function marca(x) { corridas.push(x); }
var JANELA = null;
function abrirJanela() { corridas.push(['gatilho', document.activeElement && document.activeElement.tagName]); JANELA.focus(); }
function rebenta() { throw new Error('a ação falhou'); }
`;

describe('o toque não deixa foco', () => {
  test('um toque do dedo numa aba larga o foco, e a ação corre', () => {
    const c = contexto(APP);
    const abas = c.no('DIV', {}, c.doc.body);
    const aba = c.no('A', { 'data-click': "marca('contratos')", href: '#' }, abas);
    tocar(c, aba, aba);
    assert.deepEqual([...c.ctx.corridas], ['contratos']);
    assert.equal(c.doc.activeElement, c.doc.body, 'a aba tocada não fica com o foco');
  });

  test('a caneta também, e o click sem pointerType (Safari) vale o do último pointerdown', () => {
    const c = contexto(APP);
    const b = c.no('BUTTON', { 'data-click': "marca('caneta')" }, c.doc.body);
    tocar(c, b, b, { tipo: 'pen' });
    assert.equal(c.doc.activeElement, c.doc.body, 'pen');
    tocar(c, b, b, { semTipoNoClick: true });
    assert.equal(c.doc.activeElement, c.doc.body, 'o click sem pointerType depois de um pointerdown touch');
    tocar(c, b, b, { tipo: 'mouse', semTipoNoClick: true });
    assert.equal(c.doc.activeElement, b, 'depois de um pointerdown do rato, o click sem pointerType é do rato');
  });

  test('o teclado e o rato mantêm o foco (e o anel :focus-visible)', () => {
    const c = contexto(APP);
    const b = c.no('BUTTON', { 'data-click': "marca('tecla')" }, c.doc.body);
    // um toque antes, e depois o Enter no botão focado pelo Tab: o click do teclado tem detail 0 e pointerType ''
    tocar(c, b, b);
    b.focus();
    c.disparar('click', b, { pointerType: '', detail: 0 });
    assert.equal(c.doc.activeElement, b, 'Enter/Espaço não larga o foco, mesmo depois de um toque');
    b.focus();
    c.disparar('click', b, {});
    assert.equal(c.doc.activeElement, b, 'um el.click() da app não larga o foco');
    tocar(c, b, b, { tipo: 'mouse' });
    assert.equal(c.doc.activeElement, b, 'o rato não larga o foco');
    assert.deepEqual([...c.ctx.corridas], ['tecla', 'tecla', 'tecla', 'tecla']);
  });

  test('os campos nunca perdem o foco por isto', () => {
    const c = contexto(APP);
    const linha = c.no('DIV', { 'data-click': "marca('linha')", tabindex: '0' }, c.doc.body);
    const campo = c.no('INPUT', {}, linha);
    tocar(c, campo, campo);
    assert.equal(c.doc.activeElement, campo, 'o campo dentro da linha tocada');
    const caixa = c.no('INPUT', { 'data-click': "marca('caixa')", type: 'checkbox' }, c.doc.body);
    tocar(c, caixa, caixa);
    assert.equal(c.doc.activeElement, caixa, 'o próprio campo com ação');
    const area = c.no('TEXTAREA', { 'data-click': "marca('area')" }, c.doc.body);
    tocar(c, area, area);
    assert.equal(c.doc.activeElement, area);
    const sel = c.no('SELECT', { 'data-click': "marca('sel')" }, c.doc.body);
    tocar(c, sel, sel);
    assert.equal(c.doc.activeElement, sel);
    const editavel = c.no('DIV', { 'data-click': "marca('ed')", contenteditable: 'true' }, c.doc.body);
    editavel.isContentEditable = true;
    tocar(c, editavel, editavel);
    assert.equal(c.doc.activeElement, editavel);
  });

  test('a ação que abre uma janela fica com o foco na janela, e a janela não guarda o elemento tocado', () => {
    const c = contexto(APP);
    const modal = c.no('DIV', {}, c.doc.body, ['modal', 'open']);
    c.ctx.JANELA = c.no('DIV', { tabindex: '-1', role: 'dialog' }, modal, ['sheet']);
    const linha = c.no('DIV', { 'data-click': 'abrirJanela()', tabindex: '0', role: 'button' }, c.doc.body);
    tocar(c, linha, linha);
    assert.equal(c.doc.activeElement, c.ctx.JANELA, 'o foco fica onde a ação o pôs');
    assert.deepEqual(JSON.parse(JSON.stringify(c.ctx.corridas)), [['gatilho', 'BODY']],
      'a linha largou o foco antes de a ação correr: o openModal não a guarda como gatilho, e o fechar não lha devolve');
  });

  test('dentro de uma janela, o foco largado vai para a janela; o foco num antepassado sem ação fica', () => {
    const c = contexto(APP);
    const modal = c.no('DIV', {}, c.doc.body, ['modal', 'open']);
    const sheet = c.no('DIV', { tabindex: '-1' }, modal, ['sheet']);
    const chip = c.no('BUTTON', { 'data-click': "marca('chip')" }, sheet);
    tocar(c, chip, chip);
    assert.equal(c.doc.activeElement, sheet, 'o chip tocado larga o foco para a janela, e não para trás do véu');
    const texto = c.no('DIV', { 'data-click': "marca('texto')" }, sheet);
    tocar(c, texto, null);
    assert.equal(c.doc.activeElement, sheet, 'a janela focada, que não tem ação, guarda o foco');
    assert.deepEqual([...c.ctx.corridas], ['chip', 'texto']);
  });

  test('a ação que devolve o foco ao elemento tocado é largada depois; a que rebenta também', () => {
    const c = contexto(APP);
    const b = c.no('BUTTON', { 'data-click': "marca('volta');this.focus()" }, c.doc.body);
    tocar(c, b, b);
    assert.equal(c.doc.activeElement, c.doc.body, 'o this.focus() de um toque não fica');
    const r = c.no('BUTTON', { 'data-click': 'rebenta()' }, c.doc.body);
    assert.throws(() => tocar(c, r, r), /a ação falhou/, 'o erro da ação chega como chegava');
    assert.equal(c.doc.activeElement, c.doc.body, 'e o foco foi largado na mesma');
  });

  test('o toque num filho de um botão com ação larga o foco do botão; o antepassado com ação também conta', () => {
    const c = contexto(APP);
    const cartao = c.no('DIV', { 'data-click': "marca('cartao')", tabindex: '0' }, c.doc.body);
    const icone = c.no('SPAN', {}, cartao);
    tocar(c, icone, cartao);
    assert.equal(c.doc.activeElement, c.doc.body);
    const fora = c.no('BUTTON', {}, c.doc.body);
    const outro = c.no('BUTTON', { 'data-click': "marca('outro')" }, c.doc.body);
    fora.focus();
    c.disparar('pointerdown', outro, { pointerType: 'touch' });
    c.disparar('click', outro, { pointerType: 'touch', detail: 1 });
    assert.equal(c.doc.activeElement, fora, 'o foco que está noutro sítio (não no tocado) não se mexe');
  });
});

describe('passar por cima só com rato', () => {
  /* Os blocos do CSS com o que os envolve: cada seletor com a pilha dos
     @media à volta.
     Recebe: css — o CSS sem comentários.
     Devolve: [{sel, pilha}]. */
  const blocos = (css) => {
    const fora = [];
    const pilha = [];
    let buf = '';
    for (const ch of css) {
      if (ch === '{') { fora.push({ sel: buf.trim(), pilha: pilha.slice() }); pilha.push(buf.trim()); buf = ''; }
      else if (ch === '}') { pilha.pop(); buf = ''; }
      else if (ch === ';') buf = '';
      else buf += ch;
    }
    return fora;
  };
  const fino = (p) => /\(\s*hover\s*:\s*hover\s*\)/.test(p) && /\(\s*pointer\s*:\s*fine\s*\)/.test(p);

  test('todo o :hover vive dentro de um @media (hover:hover) and (pointer:fine)', () => {
    const b = blocos(CSS);
    const comHover = b.filter((x) => x.sel.includes(':hover') && !x.sel.startsWith('@'));
    assert.ok(comHover.length > 50, 'a folha tem os :hover todos: ' + comHover.length);
    const soltos = comHover.filter((x) => !x.pilha.some(fino)).map((x) => x.sel);
    assert.deepEqual(soltos, [], ':hover que um ecrã de dedo (ou um Galaxy com caneta) prende');
  });

  test('nenhum @media(hover:hover) sem o (pointer:fine), nem o da barra de seleção do ecrã largo', () => {
    const medias = blocos(CSS).filter((x) => x.sel.startsWith('@media') && /hover\s*:\s*hover/.test(x.sel)).map((x) => x.sel);
    assert.ok(medias.length > 50);
    assert.deepEqual(medias.filter((m) => !fino(m)), []);
    assert.ok(medias.includes('@media(min-width:901px) and (hover:hover) and (pointer:fine)'), 'o .sel-fundo junta o pointer:fine ao min-width');
  });
});
