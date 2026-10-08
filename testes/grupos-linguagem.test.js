// Nos grupos partilhados, um imóvel adiciona-se e remove-se: nunca se «põe»
// nem se «tira» — o Martinho pediu linguagem mais apropriada. Varre as frases
// entre aspas (o que a pessoa lê) da janela do grupo, da aterragem da ligação
// e das respostas do servidor, fora dos comentários.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHEIROS = ['web/cloud/grupos.js', 'worker/src/rotas/grupos.js'];
const MAU = /\b(p[ôo]r|p[õo]e|p[õo]em|pus|puseste|puseram|pusesse|pôs|puser|puseres|tir(?:ar|a|am|ou|ado|ada|ados|adas|á-l[oa]s?|e))\b/i;

// As frases entre aspas de um ficheiro, fora dos comentários de linha e de bloco.
// Recebe: src — o código.
// Devolve: [{linha, texto}].
function frases(src) {
  const out = [];
  let bloco = false;
  src.split('\n').forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('/*')) bloco = true;
    const era = bloco;
    if (t.includes('*/')) bloco = false;
    if (era || t.startsWith('//')) return;
    for (const q of l.match(/(['"`])(?:(?!\1).)*\1/g) || []) out.push({ linha: i + 1, texto: q });
  });
  return out;
}

// As frases de um ficheiro com «pôr» ou «tirar» (o «por» preposição não conta).
// Recebe: src — o código.
// Devolve: as frases más, com a linha.
function mas(src) {
  return frases(src).filter((f) => { const m = f.texto.match(MAU); return m && !/^por$/i.test(m[1]); });
}

describe('os grupos partilhados adicionam e removem', () => {
  test('a regra apanha «pôr» e «tirar» e deixa passar o «por» e os comentários', () => {
    assert.equal(mas("x = 'Pôr os meus imóveis'; y = 'Tirar'; z = 'os que puseste'").length, 3);
    assert.equal(mas("x = 'Adicionar por grupo'; // pôr isto\n/* tirar */").length, 0);
  });

  for (const f of FICHEIROS) {
    test(f + ': nenhuma frase diz «pôr» nem «tirar»', () => {
      const fora = mas(fs.readFileSync(path.join(RAIZ, f), 'utf8')).map((x) => x.linha + ': ' + x.texto.slice(0, 80));
      assert.deepEqual(fora, []);
    });
  }

  test('a aterragem da ligação do grupo (entrada.js) diz «adicionares»', () => {
    const src = fs.readFileSync(path.join(RAIZ, 'web/cloud/entrada.js'), 'utf8');
    assert.match(src, /Os imóveis que adicionares ao grupo ficam partilhados/);
    assert.doesNotMatch(src, /que puseres no grupo/);
  });
});
