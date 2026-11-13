// O menu «Mover» da janela de um item de QA, e os outros menus que abrem a
// partir de um botão: na horizontal ficam dentro do ecrã. O .menupop
// encosta-se à direita do botão e cresce para a esquerda; num botão do lado
// esquerdo (o «Mover» de um Erro sem ticket, sozinho à esquerda do rodapé)
// saía 30px pela esquerda a 384 e 42px a 360. Os números são os medidos.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
const { encostoPop } = app;

const ECRA384 = { left: 0, right: 384 };
const ECRA360 = { left: 0, right: 360 };

describe('encostoPop: onde fica o menu na horizontal', () => {
  test('o «Mover» de um Erro sem ticket a 384: alinha-se à esquerda do botão', () => {
    // botão de 20 a 170, menu de 200px encostado à direita dele: começava em -30
    assert.equal(encostoPop({ left: 20, right: 170 }, ECRA384, 200, -30), 20);
  });

  test('o mesmo a 360: começava em -42, fica à esquerda do botão', () => {
    assert.equal(encostoPop({ left: 20, right: 158 }, ECRA360, 200, -42), 20);
  });

  test('o «Mover» de um ticket (ao meio do rodapé) já cabia: não mexe', () => {
    assert.equal(encostoPop({ left: 151.8, right: 255 }, ECRA384, 200, 55), null);
  });

  test('a sair pela direita, encosta-se à direita do botão', () => {
    // um menu encostado à esquerda (a pílula do lado esquerdo) num botão à direita
    assert.equal(encostoPop({ left: 300, right: 370 }, ECRA384, 200, 300), 170);
  });

  test('sem encosto ao botão que caiba, fica dentro do limite com a folga', () => {
    // botão estreito ao meio, menu de 300px: nem à direita (-90) nem à esquerda (100→400) cabe
    assert.equal(encostoPop({ left: 100, right: 210 }, ECRA384, 300, -90), 10);
  });

  test('mais largo do que o limite: começa na ponta da esquerda', () => {
    assert.equal(encostoPop({ left: 20, right: 170 }, ECRA360, 400, -230), 10);
  });

  test('o limite é o que corta, e não só o ecrã', () => {
    // a folha começa nos 24px: o menu à esquerda do botão (20) sairia dela
    assert.equal(encostoPop({ left: 20, right: 170 }, { left: 24, right: 384 }, 200, -30), 34);
  });
});

/* Um elemento falso com o que o ajustarPop lê.
   Recebe: o — as propriedades a pôr.
   Devolve: o elemento. */
function el(o) {
  const atr = {};
  return Object.assign({
    style: {}, clientLeft: 0, scrollLeft: 0,
    hasAttribute: (k) => k in atr, setAttribute: (k, v) => { atr[k] = v; }, removeAttribute: (k) => { delete atr[k]; },
  }, o);
}

describe('ajustarPop: o menu aberto fica dentro do ecrã', () => {
  /* O rodapé de um Erro sem ticket a 384×785, com as medidas do browser:
     o .menuwrap (20–170) com o botão, e o menu de 200×182 encostado à direita.
     Devolve: {p, btn}. */
  function montar() {
    const btn = el({ getBoundingClientRect: () => ({ top: 723, bottom: 771, left: 20, right: 170, width: 150, height: 48 }) });
    const wrap = el({ getBoundingClientRect: () => ({ top: 723, bottom: 771, left: 20, right: 170 }) });
    const folha = el({ getBoundingClientRect: () => ({ top: 173, bottom: 785, left: 0, right: 384 }), __cs: { overflow: 'hidden', overflowX: 'hidden', overflowY: 'hidden' } });
    wrap.parentElement = folha; folha.parentElement = null;
    const p = el({ parentNode: wrap, parentElement: wrap, previousElementSibling: btn, offsetParent: wrap, offsetHeight: 182, offsetWidth: 200, offsetLeft: -50 });
    wrap.querySelector = () => null;
    app.innerWidth = 384; app.innerHeight = 785;
    app.getComputedStyle = (x) => x.__cs || { overflow: 'visible', overflowX: 'visible', overflowY: 'visible' };
    return { p, btn };
  }

  test('abre para cima e alinha-se à esquerda do botão, dentro do ecrã', () => {
    const { p } = montar();
    app.ajustarPop(p);
    assert.equal(p.style.bottom, 'calc(100% + 5px)');
    assert.equal(p.style.right, 'auto');
    assert.equal(p.style.left, '0px'); // 20px no ecrã, a esquerda do botão
    assert.equal(p.style.width, '200px');
    assert.ok(p.hasAttribute('data-encosto'));
  });

  test('reaberto onde já cabe, desfaz o encosto que tinha posto', () => {
    const { p } = montar();
    app.ajustarPop(p);
    // o mesmo menu num botão ao meio do rodapé: com right:0 já cabia
    p.parentNode.getBoundingClientRect = () => ({ top: 723, bottom: 771, left: 152, right: 255 });
    p.previousElementSibling.getBoundingClientRect = () => ({ top: 723, bottom: 771, left: 152, right: 255, width: 103, height: 48 });
    p.offsetLeft = -97;
    app.ajustarPop(p);
    assert.equal(p.style.left, '');
    assert.equal(p.style.right, '');
    assert.equal(p.style.width, '');
    assert.ok(!p.hasAttribute('data-encosto'));
  });

  test('um menu solto em position:fixed (sem offsetParent) fica como está', () => {
    const { p } = montar();
    p.offsetParent = null;
    app.ajustarPop(p);
    assert.equal(p.style.left, undefined);
    assert.ok(!p.hasAttribute('data-encosto'));
  });
});
