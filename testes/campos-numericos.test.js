// Os campos de números (valores, percentagens, dias, quantidades) não
// sugerem nada: o Samsung Internet mostrava, ao lado do montante de uma
// despesa, os valores escritos antes noutros movimentos (ticket de QA
// 2890a7d7). Cada <input> com type="number" ou inputmode decimal/numeric,
// em web/app e web/cloud, leva autocomplete="off" — como os campos de texto
// que já o levavam.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/* As etiquetas <input> de um ficheiro, cada uma até ao primeiro > que não
   está dentro de um ${…} (um > de uma comparação não a corta).
   Recebe: s — o texto do ficheiro.
   Devolve: as etiquetas (texto), sem o > final. */
function etiquetas(s) {
  const out = [];
  for (let k = s.indexOf('<input'); k >= 0; k = s.indexOf('<input', k + 6)) {
    let j = k + 6, fundo = 0;
    for (; j < s.length; j++) {
      if (s[j] === '$' && s[j + 1] === '{') { fundo++; j++; continue; }
      if (s[j] === '}' && fundo) { fundo--; continue; }
      if (s[j] === '>' && !fundo) break;
    }
    out.push(s.slice(k, j));
  }
  return out;
}

test('os campos de números não têm sugestões do browser (autocomplete="off")', () => {
  const numericos = [], sem = [];
  for (const pasta of ['web/app', 'web/cloud']) {
    for (const f of readdirSync(pasta).filter((n) => n.endsWith('.js'))) {
      for (const t of etiquetas(readFileSync(path.join(pasta, f), 'utf8'))) {
        if (!/type="number"|inputmode="(decimal|numeric)"/.test(t)) continue;
        numericos.push(t);
        if (!/autocomplete="off"/.test(t)) sem.push(f + ': ' + t.slice(0, 80));
      }
    }
  }
  assert.ok(numericos.length >= 30, 'a procura acha os campos de números (' + numericos.length + ')');
  assert.ok(numericos.some((t) => /id="t_amount"/.test(t)), 'incluindo o montante de um movimento, o do ticket');
  assert.deepEqual(sem, [], 'campos de números sem autocomplete="off"');
});
