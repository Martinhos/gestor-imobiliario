// A documentacao gera-se do codigo — e o gerador tem de rebentar alto se o
// codigo perder os cabecalhos ou a formatacao do registo de comandos mudar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

describe('gerar-docs', () => {
  test('corre, cobre o codigo todo, e a vista compila com o resultado', async () => {
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/gerar-docs.js', import.meta.url))], { stdio: 'pipe' });
    const { DOCS } = await import('../worker/src/docs-gerados.js?' + Date.now());
    const total = DOCS.capitulos.reduce((n, c) => n + c.itens.length, 0);
    assert.ok(total >= 40, 'ha ' + total + ' ficheiros documentados — o extrator perdeu coisas?');
    assert.ok(DOCS.comandos.length >= 10, 'os comandos do Discord vieram todos');
    const nomes = DOCS.comandos.map((c) => c.nome);
    for (const c of ['test', 'docs', 'entrar', 'access']) {
      assert.ok(nomes.includes(c), '/' + c + ' esta na lista');
    }
    const teste = DOCS.capitulos[0].itens.find((x) => x.nome === 'teste.js');
    assert.ok(teste && /\/test/.test(teste.texto), 'o cabecalho do teste.js veio inteiro');
    assert.match(DOCS.comandos.find((c) => c.nome === 'access').quem, /master/, 'as permissoes vieram do worker');

    const { paginaDocs } = await import('../worker/src/docs-vista.js');
    const html = await new Response(paginaDocs().body).text();
    assert.ok(html.includes('/test'), 'a pagina lista os comandos');
    assert.ok(html.includes('teste.js'), 'a pagina lista os ficheiros');
    assert.ok(!html.includes('<script'), 'pagina estatica, sem guiao');
  });
});
