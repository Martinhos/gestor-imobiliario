// Os botões do cartão dos valores na ficha do contrato (.ct-botoes,
// contrato.js:ctValoresDaFicha): «Registar renda», «Registar as N rendas em
// falta» e «Ver movimentos». Dividiam a mesma linha em partes iguais
// (flex:1 1 0), e no telemóvel (384px) o das rendas em falta ficava com 95px e
// partia-se em quatro linhas (KAN-142). A regra: a linha parte-se entre os
// botões, nunca dentro deles — quando não cabem lado a lado, cada um desce e
// fica com a linha inteira, como as decisões do QA (.qa-decisoes).
// São verificações de texto da folha, como o testes/estilos.test.js: não
// substituem olhar para o ecrã, mas apanham sozinhas o que já partiu antes.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');

/* As declarações de uma regra de topo com exatamente este seletor.
   Recebe: sel — o seletor, tal como está na folha.
   Devolve: {propriedade: valor}, ou null se a regra não existir. */
function regra(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&');
  const m = new RegExp('(?:^|\\})\\s*' + esc + '\\{([^}]*)\\}', 'm').exec(css);
  if (!m) return null;
  const out = {};
  m[1].split(';').forEach((d) => { const i = d.indexOf(':'); if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim(); });
  return out;
}

describe('os botões da ficha do contrato numa linha cada', () => {
  test('a fila dos botões parte-se entre eles', () => {
    const r = regra('.ct-botoes');
    assert.ok(r, 'a regra .ct-botoes existe');
    assert.equal(r.display, 'flex');
    assert.equal(r['flex-wrap'], 'wrap', 'quando não cabem lado a lado, descem');
  });

  test('cada botão fica com a largura do que diz e não se parte por dentro', () => {
    const r = regra('.ct-botoes>.btn');
    assert.ok(r, 'a regra .ct-botoes>.btn existe');
    assert.equal(r['white-space'], 'nowrap', 'o texto do botão numa linha');
    const [cresce, encolhe, base] = (r.flex || '').split(/\s+/);
    assert.equal(cresce, '1', 'cresce para encher a linha');
    assert.equal(encolhe, '0', 'não encolhe abaixo do texto');
    assert.equal(base, 'auto', 'parte da largura do texto, não de zero');
  });
});
