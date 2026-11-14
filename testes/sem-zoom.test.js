// Sem zoom na app, no telemóvel (pedidos de 2026-11-14: o iPhone ampliava a
// página ao tocar num campo da Ajuda e ela ficava torta; o Martinho decidiu
// que não deve ser possível fazer zoom). O viewport do index.html tira o zoom
// automático e a pinça no Android; arranque.js:travarZoom tira a pinça no
// Safari do iOS; o html{touch-action:manipulation} tira o duplo toque.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarTudo, repor } from './arnes.js';

const ler = (f) => readFileSync(new URL('../web/' + f, import.meta.url), 'utf8');

test('o viewport da app não deixa ampliar', () => {
  const m = ler('index.html').match(/<meta name="viewport" content="([^"]+)"/);
  assert.ok(m, 'o index.html tem viewport');
  const partes = m[1].split(',').map((s) => s.trim());
  assert.ok(partes.includes('maximum-scale=1'), 'maximum-scale=1 (o zoom automático dos campos no iOS)');
  assert.ok(partes.includes('user-scalable=no'), 'user-scalable=no (a pinça no Android)');
});

test('o duplo toque não amplia: html{touch-action:manipulation}', () => {
  assert.match(ler('estilos.css'), /(^|\n)html\{touch-action:manipulation\}/);
});

test('travarZoom cancela os gestos de pinça do WebKit', () => {
  const tudo = carregarTudo({ hoje: '2026-11-14' });
  try {
    assert.equal(typeof tudo.travarZoom, 'function');
    const ouvintes = {};
    tudo.travarZoom({ addEventListener: (t, f, o) => { ouvintes[t] = [f, o]; } });
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
      assert.ok(ouvintes[t], 'ouve ' + t);
      assert.equal(ouvintes[t][1].passive, false, t + ' não passivo');
      let cancelado = false;
      ouvintes[t][0]({ preventDefault: () => { cancelado = true; } });
      assert.ok(cancelado, t + ' cancelado');
    }
    assert.equal(ouvintes.touchmove, undefined, 'nada de touchmove não passivo: atrasava o scroll');
  } finally { repor(tudo); }
});
