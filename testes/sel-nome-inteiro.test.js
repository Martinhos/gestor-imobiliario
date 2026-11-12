// O nome de uma escolha nunca se corta (ticket de QA 42fbfdf1, KAN-118): os
// programas de isenção do IRS no Editar contrato saíam com reticências, na
// lista e no botão, num telemóvel de 384px. Na lista do sel() as opções
// partem em mais linhas; num formulário o botão mostra o nome em até duas.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');

/* As declarações da regra cujo seletor é exatamente este.
   Recebe: seletor — o texto do seletor.
   Devolve: o texto entre as chavetas, ou null sem a regra. */
function regra(seletor) {
  const i = css.indexOf('\n' + seletor + '{');
  if (i < 0) return null;
  const a = css.indexOf('{', i), b = css.indexOf('}', a);
  return css.slice(a + 1, b);
}

describe('o nome de uma escolha lê-se inteiro', () => {
  test('as opções da lista partem em mais linhas, sem reticências', () => {
    const r = regra('.selopt span');
    assert.ok(r, 'a regra das opções');
    assert.doesNotMatch(r, /nowrap|ellipsis/);
  });

  test('num formulário, o botão mostra o nome em até duas linhas', () => {
    const r = regra('.form .selbtn span');
    assert.ok(r, 'a regra do botão num formulário');
    assert.match(r, /white-space:normal/);
    assert.match(r, /-webkit-line-clamp:2/);
  });

  test('os chips dos filtros continuam numa linha', () => {
    assert.match(css, /\.ana-chips \.mov-chip \.selbtn span\{[^}]*white-space:nowrap/);
  });
});
