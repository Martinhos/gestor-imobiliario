// O guião do /equipa é texto dentro de um template literal do servidor —
// um \n a menos e o browser recebe JavaScript partido, com a página morta
// em "A carregar…" para a equipa inteira. O node --check do ficheiro não
// apanha isto (o template é legal); só o parse do guião GERADO apanha.
// Foi exatamente assim que o back office partiu uma vez: nunca mais.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { paginaEquipa } from '../worker/src/equipa-vista.js';
import { recursoDePagina } from '../worker/src/paginas-recursos.js';

const EUS = [
  { nome: 'Mestre', discordId: 'm1', papel: 'master', papeis: ['master'] },
  { nome: 'Sofia', discordId: 's1', papel: 'suporte', papeis: ['suporte'] },
  { nome: 'Dev', discordId: 'd1', papel: 'dev', papeis: ['dev'] },
];

// o guião como o browser o recebe: pelo /equipa/guiao.js, com sessão de equipa
const guiaoServido = async () => (await recursoDePagina('/equipa/guiao.js', 'GET', async () => true)).text();

/* Com a CSP_ESTRITA o guião já não vai dentro da página: a página traz os
   dados da sessão num <script type="application/json"> e carrega o guião do
   /equipa/guiao.js. */
describe('o guião servido pelo /equipa compila', () => {
  for (const eu of EUS) {
    test('para ' + eu.papel, async () => {
      const html = await new Response(paginaEquipa(eu).body).text();
      const m = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(html);
      assert.ok(m, 'a página traz os dados da sessão');
      const dados = JSON.parse(m[1]);
      assert.equal(dados.eu.nome, eu.nome, 'que o guião lê');
      assert.ok(dados.ESTADOS && dados.CATS, 'com os estados e as categorias');
      assert.match(html, /<script src="\/equipa\/guiao\.js"><\/script>/, 'e carrega o guião à parte');
      const guiao = await guiaoServido();
      // parse only: new Function rebenta com o mesmo SyntaxError que o browser
      assert.doesNotThrow(() => new Function(guiao), 'o guião servido tem de fazer parse');
    });
  }

  /* A armadilha era o servidor cozer o guião: um \n escrito numa string do
     browser virava uma quebra verdadeira no JavaScript servido, e cada plica
     e cada quebra tinham de ir dobradas. Com o guião num String.raw, o que se
     escreve no ficheiro é o que o browser recebe — não há o que dobrar. */
  // achado A.5-8
  test('o guião servido é o texto do ficheiro tal e qual: o servidor não coze nada', async () => {
    const { GUIAO } = await import('../worker/src/equipa-guiao.js');
    const fonte = readFileSync(new URL('../worker/src/equipa-guiao.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const inicio = fonte.indexOf('String.raw`');
    assert.ok(inicio > -1, 'o guião é um String.raw');
    const texto = fonte.slice(inicio + 'String.raw`'.length, fonte.lastIndexOf('`'));
    assert.equal(GUIAO, texto, 'o que está escrito no ficheiro é o que sai');
    assert.doesNotMatch(texto, /\$\{|`/, 'sem interpolações nem crases lá dentro');
    assert.doesNotMatch(texto, /\\\\[n']/, 'e nada escrito a dobrar');
    assert.match(texto, /\\n/, 'as quebras nas mensagens escrevem-se \\n, como em qualquer JavaScript');
    assert.equal(await guiaoServido(), GUIAO, 'o /equipa/guiao.js serve o guião sem mexer numa letra');
    for (const eu of EUS) {
      const html = await new Response(paginaEquipa(eu).body).text();
      assert.ok(!html.includes(GUIAO.slice(0, 200)), 'e a página de ' + eu.papel + ' já não o leva dentro');
    }
  });
});
