// Sem zoom na app, no telemóvel (pedidos de 2026-11-14: o iPhone ampliava a
// página ao tocar num campo da Ajuda e ela ficava torta; o Martinho decidiu
// que não deve ser possível fazer zoom). O viewport do index.html tira o zoom
// automático e a pinça no Android; arranque.js:travarZoom tira a pinça no
// Safari do iOS; o html{touch-action:manipulation} tira o duplo toque.
//
// O back office também (KAN-137, 2026-11-16: «O backoffice deve ser igual»):
// as páginas do /equipa (equipa-vista.js:pagina, a de entrada incluída) e a
// Documentação (docs-vista.js) com o mesmo viewport, o CSS_EQUIPA e o
// CSS_DOCS com o mesmo html{touch-action:manipulation}, e o guião
// (equipa-guiao.js:travarZoom) e o da Documentação a travar a pinça do iOS.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarTudo, repor } from './arnes.js';
import { paginaEquipa, paginaEntrada, CSS_EQUIPA } from '../worker/src/equipa-vista.js';
import { paginaDocs, CSS_DOCS, GUIAO_DOCS } from '../worker/src/docs-vista.js';
import { GUIAO } from '../worker/src/equipa-guiao.js';
import { MASTER } from './lib/equipa.js';

const ler = (f) => readFileSync(new URL('../web/' + f, import.meta.url), 'utf8');

/* Confere que o viewport de uma página não deixa ampliar.
   Recebe: html — o texto da página; onde — o nome dela, para as mensagens.
   Devolve: nada (falha a asserção). */
function semZoomNoViewport(html, onde) {
  const m = html.match(/<meta name="viewport" content="([^"]+)"/);
  assert.ok(m, onde + ' tem viewport');
  const partes = m[1].split(',').map((s) => s.trim());
  assert.ok(partes.includes('maximum-scale=1'), onde + ': maximum-scale=1 (o zoom automático dos campos no iOS)');
  assert.ok(partes.includes('user-scalable=no'), onde + ': user-scalable=no (a pinça no Android)');
}

/* Confere que um travarZoom pendura os três gestos do WebKit, não passivos, e os cancela.
   Recebe: travarZoom — a função; onde — o nome, para as mensagens.
   Devolve: nada (falha a asserção). */
function travaAPinca(travarZoom, onde) {
  assert.equal(typeof travarZoom, 'function', onde);
  const ouvintes = {};
  travarZoom({ addEventListener: (t, f, o) => { ouvintes[t] = [f, o]; } });
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
    assert.ok(ouvintes[t], onde + ': ouve ' + t);
    assert.equal(ouvintes[t][1].passive, false, onde + ': ' + t + ' não passivo');
    let cancelado = false;
    ouvintes[t][0]({ preventDefault: () => { cancelado = true; } });
    assert.ok(cancelado, onde + ': ' + t + ' cancelado');
  }
  assert.equal(ouvintes.touchmove, undefined, onde + ': nada de touchmove não passivo (atrasava o scroll)');
  assert.doesNotThrow(() => travarZoom(null), onde + ': sem alvo, nada');
}

/* Tira de um guião (texto) a função travarZoom de topo e devolve-a a correr.
   Recebe: texto — o guião; onde — o nome, para as mensagens.
   Devolve: a função. */
function travarZoomDe(texto, onde) {
  const i = texto.indexOf('\nfunction travarZoom(');
  assert.ok(i > -1, onde + ': tem a função travarZoom de topo');
  const fim = texto.indexOf('\n}', i);
  return new Function(texto.slice(i, fim + 2) + '\nreturn travarZoom;')();
}

test('o viewport da app não deixa ampliar', () => {
  semZoomNoViewport(ler('index.html'), 'o index.html');
});

test('o duplo toque não amplia: html{touch-action:manipulation}', () => {
  assert.match(ler('estilos.css'), /(^|\n)html\{touch-action:manipulation\}/);
});

test('travarZoom cancela os gestos de pinça do WebKit', () => {
  const tudo = carregarTudo({ hoje: '2026-11-14' });
  try {
    travaAPinca(tudo.travarZoom, 'a app');
  } finally { repor(tudo); }
});

test('o back office também não deixa ampliar: o viewport de todas as páginas do /equipa (KAN-137)', async () => {
  semZoomNoViewport(await paginaEquipa(MASTER, { qa: 'percurso' }).text(), 'o back office do dev');
  semZoomNoViewport(await paginaEquipa(MASTER).text(), 'o back office da produção');
  semZoomNoViewport(await paginaEquipa(null).text(), 'o ecrã sem sessão');
  semZoomNoViewport(await paginaEntrada('t'.repeat(43), { estado: 'expirou' }).text(), 'a página da ligação do Discord');
  semZoomNoViewport(await paginaDocs().text(), 'a Documentação');
});

test('o back office também não amplia no duplo toque: html{touch-action:manipulation} no CSS_EQUIPA e no CSS_DOCS', () => {
  assert.match(CSS_EQUIPA, /(^|\n)html\{[^}]*touch-action:manipulation[^}]*\}/, 'CSS_EQUIPA');
  assert.match(CSS_DOCS, /(^|\n)html\{[^}]*touch-action:manipulation[^}]*\}/, 'CSS_DOCS');
});

test('o guião do back office e o da Documentação travam a pinça do iOS, e chamam-no ao carregar', () => {
  for (const [onde, texto] of [['o guião do /equipa', GUIAO], ['o guião da Documentação', GUIAO_DOCS]]) {
    travaAPinca(travarZoomDe(texto, onde), onde);
    assert.match(texto, /\ntry \{ travarZoom\(window\); \} catch \(e\) \{[^}]*\}\n/, onde + ': corre ao carregar, sem nunca o partir');
  }
});
