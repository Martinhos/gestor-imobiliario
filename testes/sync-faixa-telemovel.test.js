// No telemóvel a faixa sem ligação era uma frase que descia para baixo do
// cabeçalho e o fazia crescer 40px (header.top:has(>.sync.fora)) — e a faixa
// a entrar e a sair empurrava o ecrã inteiro. Desde 2026-10-29 é igual no
// telemóvel e no computador: fixa, por cima do conteúdo, sem empurrar nada, a
// 16px de cada lado no telemóvel; e o «?» da Ajuda, no sítio da nuvem, é um
// quadrado de 44px sem contorno, como o sino. Prova as regras do bloco do
// telemóvel em estilos.css.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// sem os comentários, e com as linhas normalizadas (metade da árvore é CRLF)
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/* As regras de topo e as de dentro de um @media, como [seletor, corpo, media]
   (media é o cabeçalho do @media que as contém, ou '' no topo). Anda chave a
   chave: um bloco @media tem várias regras lá dentro.
   Recebe: texto — o CSS sem comentários.
   Devolve: a lista. */
function regras(texto) {
  const out = [];
  let media = '', ini = 0;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (ch === '{') {
      const cab = texto.slice(ini, i).trim();
      if (/^@media/.test(cab)) { media = cab; ini = i + 1; continue; }
      const fim = texto.indexOf('}', i);
      out.push([cab, texto.slice(i + 1, fim), media]);
      i = fim; ini = fim + 1;
    } else if (ch === '}') { media = ''; ini = i + 1; }
  }
  return out;
}
const todas = regras(css);

describe('a faixa sem ligação no telemóvel', () => {
  test('o cabeçalho não cresce: nenhuma regra lhe muda o padding por causa da faixa', () => {
    assert.doesNotMatch(css, /header\.top:has\([^)]*(sync|faixa)/);
    todas.filter(([s]) => /^header\.top\b/.test(s)).forEach(([s, c]) => {
      assert.doesNotMatch(s, /sync|faixa/, 'nenhuma regra do cabeçalho fala da faixa: ' + s);
      void c;
    });
  });

  test('a faixa é a mesma em todos os ecrãs: fixa; o telemóvel só lhe muda as margens laterais', () => {
    const daFaixa = todas.filter(([s]) => s === '.faixa-sync');
    assert.ok(daFaixa.some(([, c, m]) => !m && /position:fixed/.test(c)), 'fixa, fora de qualquer @media');
    const tel = daFaixa.filter(([, , m]) => /max-width:900px/.test(m));
    assert.equal(tel.length, 1, 'uma regra do telemóvel');
    assert.equal(tel[0][1], 'left:calc(16px + var(--inset-left));right:calc(16px + var(--inset-right))', '16px de cada lado, mais a área segura');
    daFaixa.filter(([, , m]) => m).forEach(([, c]) => assert.doesNotMatch(c, /position|display/, 'o telemóvel não troca a forma'));
  });

  test('no telemóvel o «?» é o quadrado de 44px do sino, sem contorno', () => {
    const tel = ([, , m]) => /max-width:900px/.test(m);
    const r = todas.find((x) => tel(x) && x[0] === 'header.top #hdrAjuda');
    const sino = todas.find((x) => tel(x) && x[0].split(',').map((y) => y.trim()).includes('header.top #hdrBell'));
    assert.ok(r, 'o #hdrAjuda tem a regra dele no bloco do telemóvel');
    assert.ok(sino, 'e o sino a dele');
    assert.equal(r[1], sino[1], 'com as mesmas declarações do sino');
    assert.match(r[1], /border-color:transparent;background:transparent;width:44px;min-width:44px;padding:0/);
  });
});
