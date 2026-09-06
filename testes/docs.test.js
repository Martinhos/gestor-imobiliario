// A documentacao gera-se do codigo — e o gerador tem de rebentar alto se o
// codigo perder os cabecalhos ou a formatacao do registo de comandos mudar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

/* As regras de design (docs/design.md) citam o código por símbolo —
   ficheiro.js:função, index.html:.seletor, index.html:#id,
   index.html:<tag …> — e nunca por linha, que apodrece a cada commit. Um
   símbolo que deixe de existir rebenta aqui com a citação à vista. */
const raiz = new URL('../', import.meta.url);
const existe = (p) => existsSync(new URL(p, raiz));
const PASTAS = ['web/app/', 'web/cloud/', 'web/', 'scripts/', 'testes/'];

// «componentes.js» → web/app/componentes.js. Um nome que exista em mais do
// que uma pasta (anexos.js) devolve várias e a citação tem de vir completa.
function resolveFicheiro(nome) {
  if (nome === 'index.html') return ['web/index.html'];
  if (nome.includes('/')) return existe(nome) ? [nome] : [];
  return PASTAS.map((d) => d + nome).filter(existe);
}

// o símbolo existe no ficheiro? Em JS é uma definição — function/const/let/var
// nome, ou nome= / nome: (chaves de objeto, CW.x = function). Em HTML é o
// seletor tal e qual, o id (#x ou id="x"), a variável, ou o começo da tag.
// Um número é uma linha, e só se verifica que ela existe.
function temSimbolo(src, sim, html) {
  if (/^\d+(?:-\d+)?$/.test(sim)) return Number(sim.split('-').pop()) <= src.split('\n').length;
  if (html) {
    if (sim.startsWith('<')) return src.includes(sim.slice(0, -1));
    if (sim.startsWith('#')) return src.includes(sim) || src.includes('id="' + sim.slice(1) + '"');
    if (sim.startsWith('.')) {
      const classes = sim.slice(1).split('.').map((c) => '\\b' + c + '\\b').join('[^"]*');
      return src.includes(sim) || new RegExp('class="[^"]*' + classes).test(src);
    }
    return src.includes(sim);
  }
  const id = sim.replace(/\$/g, '\\$');
  return new RegExp('\\b(?:function|const|let|var)\\s+' + id + '\\b').test(src)
    || new RegExp('(?:^|[^\\w$])' + id + '\\s*[=:](?!=)', 'm').test(src);
}

const RE_FICH = '((?:web\\/(?:app|cloud)\\/|web\\/|scripts\\/|testes\\/)?[\\w-]+(?:\\.test)?\\.(?:js|html))';
// ficheiro:símbolo — o símbolo é uma tag <…> inteira, ou uma sequência sem espaços
const RE_CIT = new RegExp('(?:^|[^\\w/.-])' + RE_FICH + ':(<[^>\\n]*>|[\\w$.#@:\\[\\]()>+-]+)', 'g');
// um ficheiro referido sem símbolo tem de existir na mesma
const RE_FICH_SOLTO = new RegExp('(?:^|[^\\w/.-])' + RE_FICH + '\\b', 'g');

// tira o que é pontuação da frase e não do símbolo: «(vistas.js:fab)», «sel,», «hoje:»
function limpaSimbolo(sim) {
  let s = sim.replace(/[.,;:]+$/, '');
  while (s.endsWith(')') && (s.match(/\(/g) || []).length < (s.match(/\)/g) || []).length) s = s.slice(0, -1);
  return s;
}

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
    // as regras de design vieram do markdown, com a mesma forma das armadilhas
    const des = DOCS.capitulos.find((c) => c.id === 'design');
    assert.ok(des, 'o capitulo de design existe');
    assert.equal(des.itens[0].nome, 'docs/design.md');
    assert.ok(des.itens[0].funcoes.length >= 8, 'as seccoes de design estao la (' + des.itens[0].funcoes.length + ')');
    assert.ok(des.itens[0].funcoes.every((f) => f.assinatura === '' && f.doc.length > 40), 'cada seccao e prosa sem assinatura');
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
    // a estrutura de cada funcao: assinatura, sumario, Recebe e Devolve
    // em blocos distintos e etiquetados
    assert.ok(/<div class="ass"><code>/.test(html), 'a assinatura tem bloco proprio');
    assert.ok(/<div class="sum">/.test(html), 'o sumario tem bloco proprio');
    assert.ok(/<span class="rot">Recebe<\/span>/.test(html), 'Recebe e etiqueta, nao prosa');
    assert.ok(/<span class="rot">Devolve<\/span>/.test(html), 'Devolve e etiqueta, nao prosa');
    assert.ok((html.match(/class="param"/g) || []).length > 500, 'cada parametro na sua linha');
    assert.ok(!/<b class="io">/.test(html), 'as etiquetas ja nao vao embutidas na prosa');
    assert.ok(html.includes('id="q"'), 'ha pesquisa');
    assert.ok(html.includes('id="nav"'), 'ha gaveta');
    assert.ok(html.includes('Armadilhas conhecidas'), 'as armadilhas na gaveta');
    assert.ok(html.includes('Regras de design'), 'o design na gaveta');
    assert.ok(!html.includes('Gerado do próprio código a cada deploy'), 'o subtitulo foi retirado');
    assert.ok(html.includes('teste.js'), 'a pagina lista os ficheiros');
  });

  test('as citações das regras de design apontam para código que existe', () => {
    const md = readFileSync(new URL('docs/design.md', raiz), 'utf8');
    const mortas = [];
    const vistas = new Set();
    let n = 0;
    for (const m of md.matchAll(RE_CIT)) {
      const nome = m[1], sim = limpaSimbolo(m[2]), cit = nome + ':' + sim;
      if (vistas.has(cit)) continue;
      vistas.add(cit); n++;
      const fich = resolveFicheiro(nome);
      if (!fich.length) { mortas.push(cit + ' — o ficheiro não existe'); continue; }
      if (fich.length > 1) { mortas.push(cit + ' — ambíguo (' + fich.join(', ') + '): escreve o caminho completo'); continue; }
      const src = readFileSync(new URL(fich[0], raiz), 'utf8');
      if (!temSimbolo(src, sim, fich[0].endsWith('.html'))) mortas.push(cit + ' — «' + sim + '» não está em ' + fich[0]);
    }
    for (const m of md.matchAll(RE_FICH_SOLTO)) {
      if (!resolveFicheiro(m[1]).length) mortas.push(m[1] + ' — o ficheiro não existe');
    }
    assert.deepEqual(mortas, [], 'citações mortas em docs/design.md');
    // se o formato do documento mudar, o teste deixa de ver citações e ficava vazio sem ninguém dar por isso
    assert.ok(n >= 200, 'o documento cita o código por símbolo (' + n + ' citações distintas)');
  });
});
