// Sem zoom na app, no telemóvel (pedidos de 2026-11-14: o iPhone ampliava a
// página ao tocar num campo da Ajuda e ela ficava torta; o Martinho decidiu
// que não deve ser possível fazer zoom). O viewport do index.html tira o zoom
// automático e a pinça no Android (quando o browser o respeita); o
// html{touch-action:pan-x pan-y} tira a pinça e o duplo toque ao compositor;
// arranque.js:travarZoom trava a pinça dos browsers que passam por cima dos
// dois — no Safari do iOS pelos eventos de gesto do WebKit, nos outros pelo
// touchmove com dois ou mais dedos (KAN-137, 2026-11-17: o Samsung Internet
// com o «Zoom manual» ampliava o back office com a pinça).
//
// O back office também (KAN-137, 2026-11-16: «O backoffice deve ser igual»):
// as páginas do /equipa (equipa-vista.js:pagina, a de entrada incluída) e a
// Documentação (docs-vista.js) com o mesmo viewport, o CSS_EQUIPA e o
// CSS_DOCS com o mesmo touch-action no html, e o guião
// (equipa-guiao.js:travarZoom) e o da Documentação a travar a pinça.

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

/* Corre um travarZoom sobre um alvo de mentira e devolve os ouvintes que ele pendurou.
   Recebe: travarZoom — a função; extra — as propriedades do alvo (ongesturestart no iOS, Android na APK).
   Devolve: {tipo: [função, opções]}. */
function ouvintesDe(travarZoom, extra) {
  const ouvintes = {};
  travarZoom({ ...extra, addEventListener: (t, f, o) => { ouvintes[t] = [f, o]; } });
  return ouvintes;
}

/* Um touchmove de mentira e se ficou cancelado.
   Recebe: f — o ouvinte; dedos — quantos; cancelavel — o ev.cancelable.
   Devolve: true se o ouvinte chamou o preventDefault. */
function cancela(f, dedos, cancelavel = true) {
  let cancelado = false;
  f({ touches: Array.from({ length: dedos }, () => ({})), cancelable: cancelavel, preventDefault: () => { cancelado = true; } });
  return cancelado;
}

/* Confere que um travarZoom trava a pinça: os três gestos do WebKit, não passivos e cancelados, em todo o lado;
   fora do iOS, o touchmove não passivo que cancela os de dois ou mais dedos e deixa os de um (a rolagem);
   no iOS (que tem os gestos) nada de touchmove, que atrasava o começo da rolagem.
   Recebe: travarZoom — a função; onde — o nome, para as mensagens.
   Devolve: nada (falha a asserção). */
function travaAPinca(travarZoom, onde) {
  assert.equal(typeof travarZoom, 'function', onde);
  const android = ouvintesDe(travarZoom, {});
  const ios = ouvintesDe(travarZoom, { ongesturestart: null });
  for (const [ouvintes, qual] of [[android, 'Android'], [ios, 'iOS']]) {
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
      assert.ok(ouvintes[t], `${onde} (${qual}): ouve ${t}`);
      assert.equal(ouvintes[t][1].passive, false, `${onde} (${qual}): ${t} não passivo`);
      let cancelado = false;
      ouvintes[t][0]({ preventDefault: () => { cancelado = true; } });
      assert.ok(cancelado, `${onde} (${qual}): ${t} cancelado`);
    }
  }
  assert.equal(ios.touchmove, undefined, onde + ': no iOS, nada de touchmove não passivo (os gestos chegam)');
  assert.ok(android.touchmove, onde + ': fora do iOS, ouve o touchmove (o Samsung Internet passa por cima do viewport)');
  assert.equal(android.touchmove[1].passive, false, onde + ': o touchmove não é passivo (senão não se cancela)');
  const f = android.touchmove[0];
  assert.ok(cancela(f, 2), onde + ': dois dedos — a pinça — cancelados');
  assert.ok(cancela(f, 3), onde + ': três dedos cancelados');
  assert.ok(!cancela(f, 1), onde + ': um dedo passa — é a rolagem');
  assert.ok(!cancela(f, 2, false), onde + ': um touchmove que já não se cancela (a rolagem começou) fica como está');
  assert.doesNotThrow(() => f(null), onde + ': sem evento, nada');
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

test('a pinça e o duplo toque saem do compositor: html{touch-action:pan-x pan-y}', () => {
  assert.match(ler('estilos.css'), /(^|\n)html\{touch-action:pan-x pan-y\}/);
  assert.doesNotMatch(ler('estilos.css'), /(^|\n)html\{[^}]*touch-action:manipulation/, 'o manipulation deixava a pinça');
});

test('travarZoom da app trava a pinça no iOS e nos browsers do Android, e não na APK', () => {
  const tudo = carregarTudo({ hoje: '2026-11-17' });
  try {
    travaAPinca(tudo.travarZoom, 'a app');
    const apk = ouvintesDe(tudo.travarZoom, { Android: {} });
    assert.ok(apk.gesturestart, 'na APK os gestos continuam (não fazem mal)');
    assert.equal(apk.touchmove, undefined, 'na APK nada de touchmove: o WebView tem o zoom desligado (MainActivity.java)');
  } finally { repor(tudo); }
});

test('o back office também não deixa ampliar: o viewport de todas as páginas do /equipa (KAN-137)', async () => {
  semZoomNoViewport(await paginaEquipa(MASTER, { qa: 'percurso' }).text(), 'o back office do dev');
  semZoomNoViewport(await paginaEquipa(MASTER).text(), 'o back office da produção');
  semZoomNoViewport(await paginaEquipa(null).text(), 'o ecrã sem sessão');
  semZoomNoViewport(await paginaEntrada('t'.repeat(43), { estado: 'expirou' }).text(), 'a página da ligação do Discord');
  semZoomNoViewport(await paginaDocs().text(), 'a Documentação');
});

test('o back office também: html{touch-action:pan-x pan-y} no CSS_EQUIPA e no CSS_DOCS', () => {
  assert.match(CSS_EQUIPA, /(^|\n)html\{[^}]*touch-action:pan-x pan-y[^}]*\}/, 'CSS_EQUIPA');
  assert.match(CSS_DOCS, /(^|\n)html\{[^}]*touch-action:pan-x pan-y[^}]*\}/, 'CSS_DOCS');
});

test('o guião do back office e o da Documentação travam a pinça (iOS e Samsung Internet), e chamam-no ao carregar', () => {
  for (const [onde, texto] of [['o guião do /equipa', GUIAO], ['o guião da Documentação', GUIAO_DOCS]]) {
    travaAPinca(travarZoomDe(texto, onde), onde);
    assert.match(texto, /\ntry \{ travarZoom\(window\); \} catch \(e\) \{[^}]*\}\n/, onde + ': corre ao carregar, sem nunca o partir');
  }
});
