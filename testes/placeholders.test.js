// Todo o placeholder escrito no código da app diz «Opcional» ou começa por
// «Ex: » seguido de um exemplo concreto — a regra que o Martinho pediu para
// todos os formulários. As únicas exceções são a pesquisa e a palavra a
// escrever para confirmar uma coisa que não se desfaz. Um placeholder
// calculado tem de começar por «Ex: » antes da parte calculada.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXCECOES = ['Pesquisar…', 'APAGAR'];
const RE = /placeholder\s*(?:=|:)\s*(\\?["'`])(.*?)\1/g;

// Os ficheiros .js e .html de uma pasta, recursivamente.
// Recebe: d — a pasta, relativa à raiz.
// Devolve: os caminhos relativos.
function ficheiros(d) {
  return fs.readdirSync(path.join(RAIZ, d), { withFileTypes: true }).flatMap((e) => {
    const p = d + '/' + e.name;
    if (e.isDirectory()) return ficheiros(p);
    return /\.(js|html)$/.test(e.name) ? [p] : [];
  });
}

// Os placeholders de um texto que não seguem a regra.
// Recebe: src — o código.
// Devolve: os valores maus.
function maus(src) {
  const out = [];
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(src))) {
    const v = m[2];
    if (v === 'Opcional' || v.startsWith('Ex: ') || EXCECOES.includes(v)) continue;
    out.push(v);
  }
  return out;
}

describe('os placeholders da app', () => {
  test('a regra apanha o que devia: instruções, exemplos sem «Ex: » e o «Ex.:» com ponto', () => {
    assert.deepEqual(maus('<input placeholder="T2 Lisboa"><input placeholder="Ex.: Ana"><input placeholder="Telemóvel ou email">'),
      ['T2 Lisboa', 'Ex.: Ana', 'Telemóvel ou email']);
    assert.deepEqual(maus('<input placeholder="Opcional"><input placeholder="Ex: T2 Lisboa"><input placeholder="Pesquisar…">'), []);
    assert.deepEqual(maus("{placeholder:'Escreve aqui…'} el.placeholder = '912 345 678'"), ['Escreve aqui…', '912 345 678']);
    assert.deepEqual(maus('<input placeholder="${dec(x)}"><input placeholder="Ex: ${dec(x)}">'), ['${dec(x)}']);
  });

  test('em web/, cada placeholder diz «Opcional», começa por «Ex: » ou é uma das exceções', () => {
    const fora = [];
    for (const f of ficheiros('web')) for (const v of maus(fs.readFileSync(path.join(RAIZ, f), 'utf8'))) fora.push(f + ': «' + v.slice(0, 60) + '»');
    assert.deepEqual(fora, []);
  });
});
