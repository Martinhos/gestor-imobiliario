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
    const fns = DOCS.capitulos.reduce((n, c) => n + c.itens.reduce((m, i) => m + (i.funcoes || []).length, 0), 0);
    assert.ok(total >= 60, 'ha ' + total + ' ficheiros documentados');
    assert.ok(fns >= 400, 'ha ' + fns + ' funcoes com interface extraido');
    const nuas = DOCS.capitulos.flatMap((c) => c.itens.flatMap((i) =>
      (i.funcoes || []).filter((f) => !f.doc && f.assinatura).map((f) => i.nome + '::' + f.nome)));
    assert.deepEqual(nuas, [], 'nenhuma funcao fica sem comentario — e a regra da casa');
    assert.ok(!DOCS.capitulos.some((c) => c.id === 'outros'), 'o mapa cobre tudo — sem capitulo Outros');
    assert.ok(DOCS.comandos.length >= 10, 'os comandos do Discord vieram todos');
    for (const c of ['test', 'docs', 'entrar', 'access']) {
      assert.ok(DOCS.comandos.some((x) => x.nome === c), '/' + c + ' esta na lista');
    }
    // o interface das funcoes: o sel() dos componentes vem com assinatura e doc
    const ui = DOCS.capitulos.find((c) => c.id === 'ui');
    const comp = ui.itens.find((x) => x.nome === 'web/app/componentes.js');
    const sel = comp.funcoes.find((f) => f.nome === 'sel');
    assert.ok(sel && /sel\(id/.test(sel.assinatura), 'a assinatura do sel() foi extraida');
    assert.ok(!/[=]{4,}/.test(JSON.stringify(comp)), 'os banners ===== foram limpos');
    // as armadilhas vieram do markdown
    const arm = DOCS.capitulos.find((c) => c.id === 'armadilhas');
    assert.ok(arm.itens[0].funcoes.length >= 8, 'as armadilhas estao la');
    assert.match(DOCS.comandos.find((c) => c.nome === 'access').quem, /master/, 'as permissoes vieram do worker');
    // cada comando traz o guia (o que acontece) e as opcoes com tipo
    assert.ok(DOCS.comandos.every((c) => c.oQueFaz && c.oQueFaz.length > 40), 'todos os comandos explicam o que acontece');
    const t = DOCS.comandos.find((c) => c.nome === 'test');
    assert.equal(t.opcoes.length, 4, 'o /test traz as 4 opcoes');
    assert.ok(t.opcoes.some((o) => o.nome === 'limpar' && o.tipo === 'sim/não'), 'opcoes com nome e tipo');
    const cat = DOCS.comandos.find((c) => c.nome === 'pedidos').opcoes.find((o) => o.nome === 'categoria');
    assert.ok(cat.escolhas.length >= 4, 'as escolhas vem com a opcao');

    const { paginaDocs } = await import('../worker/src/docs-vista.js');
    const html = await new Response(paginaDocs().body).text();
    assert.ok(html.includes('id="q"'), 'ha pesquisa');
    assert.ok(html.includes('id="nav"'), 'ha gaveta');
    assert.ok(html.includes('Armadilhas conhecidas'), 'as armadilhas na gaveta');
    assert.ok(!html.includes('Gerado do próprio código a cada deploy'), 'o subtitulo foi retirado');
    assert.ok(html.includes('teste.js'), 'a pagina lista os ficheiros');
  });
});
