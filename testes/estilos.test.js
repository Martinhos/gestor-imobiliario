// A folha de estilo da app, nas partes onde um engano só se vê no telemóvel
// de outra pessoa. São verificações de texto, não de desenho: não substituem
// olhar para o ecrã, mas apanham sozinhas o que já partiu antes.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');

// o que está entre chavetas, regra a regra
function blocos(css) {
  return css.split('}').map((b) => b.slice(b.indexOf('{') + 1)).filter(Boolean);
}

const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join('\n');

describe('alturas em unidades de ecrã', () => {
  /* vh é a altura com as barras do browser recolhidas. Com a barra de
     endereço em cima e a de comandos em baixo à mostra — o Samsung Internet,
     o Chrome no Android — o que se vê é bem menos do que isso.

     Numa caixa encostada em baixo, uma altura em vh cresce para além do que
     se vê e o topo fica cortado, sem maneira de lá chegar. Foi o que
     aconteceu ao modal das novidades: a regra do telemóvel vinha depois da
     geral e repunha vh onde a geral já tinha dvh.

     Daí a regra: quem escreve uma altura em vh escreve logo a seguir a mesma
     em dvh. Quem não perceber vh nenhum fica com o que havia. */
  test('nenhuma altura em vh fica sem o par em dvh', () => {
    const falhas = [];
    blocos(css).forEach((b) => {
      const props = {};
      (b.match(/(?:^|;)\s*((?:max-|min-)?height)\s*:\s*([^;]*)/g) || []).forEach((d) => {
        const m = /((?:max-|min-)?height)\s*:\s*([^;]*)/.exec(d);
        if (!m) return;
        (props[m[1]] = props[m[1]] || []).push(m[2]);
      });
      Object.keys(props).forEach((p) => {
        const usaVh = props[p].some((v) => /\d(?:\.\d+)?vh\b/.test(v));
        const usaDin = props[p].some((v) => /\d(?:\.\d+)?[ds]vh\b/.test(v));
        if (usaVh && !usaDin) falhas.push(p + ': ' + props[p].join(' | '));
      });
    });
    assert.deepEqual(falhas, [], 'alturas em vh sem par em dvh');
  });

  test('a folha de baixo do modal cabe no que se vê', () => {
    // a regra do telemóvel é a que se aplica no telemóvel: é a que interessa
    const m = /@media\(max-width:520px\)\{\.sheet\{([^}]*)\}/.exec(css);
    assert.ok(m, 'a regra da folha de baixo existe');
    assert.match(m[1], /bottom:0/, 'está encostada em baixo');
    assert.match(m[1], /max-height:\d+dvh/, 'e a altura acompanha o que se vê');
  });

  test('a camada do modal também', () => {
    const m = /\.modal\{([^}]*)\}/.exec(css);
    assert.ok(m, 'a camada existe');
    assert.match(m[1], /height:100dvh/);
  });
});
