// O toque no back office (os tickets de QA 3459ffbf e 451b2793): tocar num botão
// deixava o retângulo azul do browser — o realce nativo do toque, que o CSS_EQUIPA
// não desligava, e o foco aceso no botão tocado, que o despachar não largava. A
// app resolveu os dois (web/estilos.css e web/app/eventos.js:largarFocoDoToque);
// aqui provam-se o CSS e o largar do foco do guião principal.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { CSS_EQUIPA } from '../worker/src/equipa-vista.js';
import { GUIAO } from '../worker/src/equipa-guiao.js';

/* Tira uma função de topo do guião pelo nome (até à chaveta que fecha na coluna zero).
   Recebe: nome — o nome da função.
   Devolve: o texto da função. */
function funcao(nome) {
  const i = GUIAO.indexOf('\nfunction ' + nome + '(');
  assert.ok(i > -1, 'o guião tem a função ' + nome);
  const fim = GUIAO.indexOf('\n}', i + 1);
  return GUIAO.slice(i + 1, fim + 2);
}

/* Um elemento de faz-de-conta que sabe se tem o foco.
   Recebe: doc — o documento; tag — o nome da etiqueta; filhos (opcional).
   Devolve: o elemento. */
function no(doc, tag, filhos) {
  const e = {
    tagName: tag, dataset: {}, filhos: filhos || [],
    getAttribute: (k) => (k === 'data-acao' ? 'carregar' : null),
    closest: (sel) => (sel === '[data-acao]' ? e : null),
    contains: (x) => x === e || e.filhos.includes(x),
    focus() { doc.activeElement = e; },
    blur() { if (doc.activeElement === e) doc.activeElement = doc.body; },
  };
  return e;
}

/* O despachar e o largarFocoDoToque do guião numa caixa com um documento e uma ação.
   Recebe: acao (opcional) — o que a ação faz ao correr.
   Devolve: {ctx, doc}. */
function caixa(acao) {
  const doc = { body: { tagName: 'BODY' }, documentElement: { tagName: 'HTML' }, activeElement: null };
  const ctx = vm.createContext({ document: doc, ACOES: { carregar: acao || (() => {}) } });
  vm.runInContext(funcao('despachar') + '\n' + funcao('largarFocoDoToque'), ctx);
  return { ctx, doc };
}

describe('o realce do toque no back office', () => {
  test('o CSS_EQUIPA desliga o realce nativo do toque em tudo', () => {
    assert.match(CSS_EQUIPA, /(^|\n)\*\{-webkit-tap-highlight-color:transparent\}/);
  });

  test('os chips e as linhas que se tocam dão sinal no :active (o realce nativo já não o dá)', () => {
    assert.match(CSS_EQUIPA, /\.btn:active\{/);
    assert.match(CSS_EQUIPA, /\.chip:active\{/);
    assert.match(CSS_EQUIPA, /\.linha\.tocavel:active\{/);
  });
});

describe('o foco que o toque deixa', () => {
  test('um toque num botão: a ação corre e o foco sai do botão', () => {
    let correu = false;
    const { ctx, doc } = caixa(() => { correu = true; });
    const b = no(doc, 'BUTTON');
    b.focus();
    ctx.despachar({ target: b, pointerType: 'touch' }, 'acao');
    assert.equal(correu, true);
    assert.equal(doc.activeElement, doc.body);
  });

  test('a caneta também; o rato e o teclado ficam com o foco (o anel do Tab continua)', () => {
    for (const [ponteiro, larga] of [['pen', true], ['mouse', false], ['', false], [undefined, false]]) {
      const { ctx, doc } = caixa();
      const b = no(doc, 'BUTTON');
      b.focus();
      ctx.despachar({ target: b, pointerType: ponteiro }, 'acao');
      assert.equal(doc.activeElement === doc.body, larga, 'pointerType ' + ponteiro);
    }
  });

  test('uma ação que leva o foco para outro sítio manda ela; um campo nunca perde o foco', () => {
    const r1 = caixa();
    const b = no(r1.doc, 'BUTTON'), campo = no(r1.doc, 'INPUT');
    r1.ctx.ACOES.carregar = () => campo.focus();
    b.focus();
    r1.ctx.despachar({ target: b, pointerType: 'touch' }, 'acao');
    assert.equal(r1.doc.activeElement, campo);

    const r2 = caixa();
    const c2 = no(r2.doc, 'INPUT');
    c2.focus();
    r2.ctx.despachar({ target: c2, pointerType: 'touch' }, 'acao');
    assert.equal(r2.doc.activeElement, c2);
  });

  test('o Enter num campo (data-enter) não mexe no foco, e uma ação que rebenta larga o foco na mesma', () => {
    const { ctx, doc } = caixa(() => { throw new Error('a ação falhou'); });
    const b = no(doc, 'BUTTON');
    b.focus();
    assert.throws(() => ctx.despachar({ target: b, pointerType: 'touch' }, 'acao'), /a ação falhou/);
    assert.equal(doc.activeElement, doc.body);
    const r = caixa();
    const c = no(r.doc, 'INPUT');
    c.getAttribute = (k) => (k === 'data-enter' ? 'carregar' : null);
    c.closest = (sel) => (sel === '[data-enter]' ? c : null);
    c.focus();
    r.ctx.despachar({ target: c, key: 'Enter', preventDefault() {} }, 'enter');
    assert.equal(r.doc.activeElement, c);
  });
});
