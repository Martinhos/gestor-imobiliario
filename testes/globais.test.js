// Os 43 ficheiros que o index.html carrega partilham o mesmo âmbito global —
// é a arquitetura, e é de propósito. O preço é que dois ficheiros a declarar o
// mesmo nome não se veem um ao outro até estarem os dois na mesma página: com
// var ou function, o segundo substitui o primeiro em silêncio; com const, let
// ou class, a página rebenta ao carregar. Nada apanhava nenhum dos dois casos.
//
// Havia uma colisão real quando isto entrou: «var css» em três ficheiros de
// cloud/, precisamente a parte que o arnês não carregava. Por ser var não
// rebentava — no dia em que alguém escrevesse const ali, rebentava.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TUDO, carregarTudo } from './arnes.js';

const ler = (rel) => readFileSync(new URL('../web/' + rel, import.meta.url), 'utf8');

const FICHEIROS = TUDO;

/* As declarações de topo de um ficheiro, lidas do texto. Só o que começa na
   coluna zero: o que está dentro de uma função é local e não colide com nada.
   Os comentários saem primeiro, com as linhas no sítio, para um exemplo num
   comentário não contar como declaração.
   Recebe: rel — o caminho relativo a web/.
   Devolve: lista de nomes declarados no topo desse ficheiro. */
function declaracoesDeTopo(rel) {
  const semComentarios = ler(rel)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, '');
  const nomes = [];
  for (const linha of semComentarios.split('\n')) {
    const m = /^(?:var|let|const|function|class|async function)\s+([A-Za-z_$][\w$]*)/.exec(linha);
    if (m) nomes.push(m[1]);
  }
  return nomes;
}

describe('os nomes globais', () => {
  test('a lista cobre o index.html inteiro, sem repetir ficheiros', () => {
    const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
    const srcs = (html.match(/src="([^"]+\.js)"/g) || []).map((s) => s.slice(5, -1));
    assert.deepEqual([...srcs].sort(), [...FICHEIROS].sort(),
      'o que se verifica tem de ser exatamente o que o browser carrega');
  });

  test('nenhum nome é declarado no topo de dois ficheiros', () => {
    const onde = new Map();
    for (const rel of FICHEIROS) {
      for (const nome of declaracoesDeTopo(rel)) {
        if (!onde.has(nome)) onde.set(nome, []);
        if (!onde.get(nome).includes(rel)) onde.get(nome).push(rel);
      }
    }
    const repetidos = [...onde].filter(([, fs]) => fs.length > 1);
    assert.deepEqual(repetidos, [],
      'declarado em mais do que um ficheiro — com var ou function o segundo ' +
      'substitui o primeiro em silêncio; com const, let ou class a página não abre');
    // um número que desce muito é a leitura a falhar, não o código a encolher
    assert.ok(onde.size > 1000, 'leu ' + onde.size + ' nomes — a expressão deixou de reconhecer as declarações?');
  });

  /* A metade que a leitura do texto não dá: com tudo no mesmo contexto, uma
     redeclaração de const/let/class entre dois ficheiros quaisquer rebenta ao
     carregar — como no browser. É o único sítio onde a app inteira, nuvem
     incluída, é avaliada de uma vez. */
  test('a app inteira carrega no mesmo âmbito sem rebentar', () => {
    const app = carregarTudo();
    assert.equal(typeof app.render, 'function', 'a base está lá');
    assert.equal(typeof app.CW, 'object', 'e a nuvem também');
  });
});
