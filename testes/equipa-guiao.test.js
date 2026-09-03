// O guião do /equipa é texto dentro de um template literal do servidor —
// um \n a menos e o browser recebe JavaScript partido, com a página morta
// em "A carregar…" para a equipa inteira. O node --check do ficheiro não
// apanha isto (o template é legal); só o parse do guião GERADO apanha.
// Foi exatamente assim que o back office partiu uma vez: nunca mais.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { paginaEquipa } from '../worker/src/equipa-vista.js';

const EUS = [
  { nome: 'Mestre', discordId: 'm1', papel: 'master', papeis: ['master'] },
  { nome: 'Sofia', discordId: 's1', papel: 'suporte', papeis: ['suporte'] },
  { nome: 'Dev', discordId: 'd1', papel: 'dev', papeis: ['dev'] },
];

describe('o guião servido pelo /equipa compila', () => {
  for (const eu of EUS) {
    test('para ' + eu.papel, async () => {
      const html = await new Response(paginaEquipa(eu).body).text();
      const m = /<script>([\s\S]*)<\/script>/.exec(html);
      assert.ok(m, 'a página tem um guião');
      // parse only: new Function rebenta com o mesmo SyntaxError que o browser
      assert.doesNotThrow(() => new Function(m[1]), 'o guião gerado tem de fazer parse');
    });
  }
});
