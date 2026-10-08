// A documentacao gera-se do codigo — e o gerador tem de rebentar alto se o
// codigo perder os cabecalhos ou a formatacao do registo de comandos mudar.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/* As regras de design (docs/design.md), o diário das decisões
   (docs/decisoes.md) e as armadilhas (docs/armadilhas.md) citam o código por
   símbolo — ficheiro.js:função, estilos.css:.seletor (o CSS da app saiu do
   <style> do index.html para o web/estilos.css), index.html:#id,
   index.html:<tag …> — e nunca por linha, que apodrece a cada commit. Um
   símbolo que deixe de existir rebenta aqui com a citação à vista. */
const raiz = new URL('../', import.meta.url);
const existe = (p) => existsSync(new URL(p, raiz));
// o texto de um ficheiro, com os fins de linha da casa (nesta máquina os docs saem com CRLF)
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8').replace(/\r\n/g, '\n');
/* Um nome sem pasta procura-se primeiro no cliente, nos scripts e nos
   testes, e só no worker quando lá não há nenhum: o servicos.js das regras é
   o catálogo do cliente (web/app/servicos.js), e o do worker cita-se com o
   caminho inteiro (worker/src/lib/servicos.js). */
const PASTAS = ['web/app/', 'web/cloud/', 'web/', 'scripts/', 'testes/'];
const PASTAS_DO_WORKER = ['worker/src/', 'worker/src/lib/', 'worker/src/rotas/'];

// «componentes.js» → web/app/componentes.js; «cloud/nucleo.js» → web/cloud/nucleo.js.
// Um nome que exista em mais do que uma pasta (anexos.js) devolve várias e a
// citação tem de vir completa.
function resolveFicheiro(nome) {
  if (nome === 'index.html') return ['web/index.html'];
  if (/^(?:app|cloud)\//.test(nome)) nome = 'web/' + nome;
  if (nome.includes('/')) return existe(nome) ? [nome] : [];
  const noCliente = PASTAS.map((d) => d + nome).filter(existe);
  return noCliente.length ? noCliente : PASTAS_DO_WORKER.map((d) => d + nome).filter(existe);
}

// o símbolo existe no ficheiro? Em JS é uma definição — function/const/let/var
// nome, ou nome= / nome: (chaves de objeto, CW.x = function) —, ou, com # ou .
// à frente, o id ou a classe que o ficheiro escreve. Em HTML é o seletor tal e
// qual, o id (#x ou id="x"), a variável, ou o começo da tag. Em CSS é o
// seletor, a variável, a animação ou a @media tal e qual, com o nome inteiro:
// o .pos não se acha dentro de um .post, nem o --curva dentro do --curva-entra.
// Um número é uma linha, e só se verifica que ela existe.
// Recebe: src — o texto do ficheiro; sim — o símbolo citado; tipo — a
// extensão do ficheiro ('js', 'html' ou 'css').
// Devolve: true se o símbolo está no ficheiro.
function temSimbolo(src, sim, tipo) {
  if (/^\d+(?:-\d+)?$/.test(sim)) return Number(sim.split('-').pop()) <= src.split('\n').length;
  if (tipo === 'css') {
    const tal = sim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp((/^[\w-]/.test(sim) ? '(?<![\\w-])' : '') + tal + '(?![\\w-])').test(src);
  }
  if (tipo === 'html') {
    if (sim.startsWith('<')) return src.includes(sim.slice(0, -1));
    if (sim.startsWith('#')) return src.includes(sim) || src.includes('id="' + sim.slice(1) + '"');
    if (sim.startsWith('.')) {
      const classes = sim.slice(1).split('.').map((c) => '\\b' + c + '\\b').join('[^"]*');
      return src.includes(sim) || new RegExp('class="[^"]*' + classes).test(src);
    }
    return src.includes(sim);
  }
  if (/^[#.]/.test(sim)) return src.includes(sim.slice(1));
  const id = sim.replace(/\$/g, '\\$');
  return new RegExp('\\b(?:function|const|let|var)\\s+' + id + '\\b').test(src)
    || new RegExp('(?:^|[^\\w$])' + id + '\\s*[=:](?!=)', 'm').test(src);
}

const RE_FICH = '((?:web\\/(?:app|cloud)\\/|web\\/|app\\/|cloud\\/|scripts\\/|testes\\/(?:ui\\/|lib\\/)?|worker\\/src\\/(?:lib\\/|rotas\\/)?)?[\\w-]+(?:\\.test)?\\.(?:js|html|css))';
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

// as secções «## » de um markdown, com o título e o corpo de cada uma
function seccoes(md) {
  return md.split(/\n## /).slice(1).map((p) => {
    const [titulo, ...resto] = p.split('\n');
    return { titulo: titulo.trim(), corpo: resto.join('\n') };
  });
}
// o que vem antes da primeira secção: o título, o que o ficheiro é e o índice
const introDe = (md) => md.split(/\n## /)[0];

// os markdowns que os docs servem, um capítulo cada, e quantas citações distintas cada um tem pelo menos
const DOCS_MD = [
  { f: 'docs/design.md', cap: 'design', min: 200 },
  { f: 'docs/decisoes.md', cap: 'decisoes', min: 15 },
  { f: 'docs/armadilhas.md', cap: 'armadilhas', min: 0 },
];

/* Corre o gerador num processo à parte, com texto acrescentado a alguns
   ficheiros só lá dentro — e o que ele escreveria vai para lado nenhum. É
   assim que se prova que ele RECUSA, sem tocar nos ficheiros verdadeiros nem
   no módulo gerado que os outros testes leem. */
function gerarCom(acrescentos) {
  const gerador = fileURLToPath(new URL('../scripts/gerar-docs.js', import.meta.url));
  const codigo = [
    "const fs = require('node:fs');",
    "const { syncBuiltinESMExports } = require('node:module');",
    "const { pathToFileURL } = require('node:url');",
    'const mais = ' + JSON.stringify(acrescentos) + ';',
    'const lerOriginal = fs.readFileSync;',
    'fs.readFileSync = function (p, ...resto) {',
    '  const s = lerOriginal.call(this, p, ...resto);',
    '  const nome = String(p && p.href ? p.href : p);',
    '  for (const k of Object.keys(mais)) if (nome.endsWith("/" + k)) return s + mais[k];',
    '  return s;',
    '};',
    'fs.writeFileSync = function () {};',
    'syncBuiltinESMExports();',
    'import(pathToFileURL(' + JSON.stringify(gerador) + ').href);',
  ].join('\n');
  return spawnSync(process.execPath, ['-e', codigo], { encoding: 'utf8' });
}

/* Dentro da sandbox do Stryker (npm run test:mutacao) os ficheiros mutados
   levam funções auxiliares injetadas (stryMutAct_…, stryCov_…) sem comentário
   nenhum, e o gerador acusá-las-ia como nuas. Isto é um guarda sobre o texto,
   não sobre comportamento: salta-se lá, e só lá. */
const NA_SANDBOX = /\.stryker-tmp/.test(import.meta.url);
describe('gerar-docs', { skip: NA_SANDBOX ? 'lê o texto dos ficheiros, e na sandbox do Stryker ele está instrumentado' : false }, () => {
  // o módulo gerado não está no git: gera-se aqui, antes de qualquer teste o ler
  before(() => {
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/gerar-docs.js', import.meta.url))], { stdio: 'pipe' });
  });

  test('corre, cobre o codigo todo, e a vista compila com o resultado', async () => {
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

  // achado A.7-17
  test('as opções de cada comando chegam aos docs tal como estão nos dados do registo, escritas como forem', async () => {
    const { DOCS } = await import('../worker/src/docs-gerados.js?' + Date.now());
    const { comandos } = require('../scripts/discord-comandos-lista.js');
    assert.equal(DOCS.comandos.length, comandos.length, 'um comando nos docs por comando registado');
    let opcoes = 0;
    for (const c of comandos) {
      const d = DOCS.comandos.find((x) => x.nome === c.name);
      assert.ok(d, '/' + c.name + ' está nos docs');
      assert.equal(d.descricao, c.description);
      assert.deepEqual(
        d.opcoes.map((o) => [o.nome, o.descricao, o.obrigatoria, o.escolhas]),
        (c.options || []).map((o) => [o.name, o.description, o.required === true, (o.choices || []).map((e) => e.name)]),
        '/' + c.name + ': as opções, pela ordem, com a descrição, se é obrigatória e as escolhas');
      assert.ok(d.opcoes.every((o) => ['texto', 'número', 'sim/não', 'utilizador'].includes(o.tipo)), '/' + c.name + ': tipos com nome');
      opcoes += d.opcoes.length;
    }
    assert.ok(opcoes >= 14, 'viu as opções todas (' + opcoes + ')');
    // um sítio só: o registo usa a mesma lista, e o gerador já não lê o código do registo
    assert.match(readFileSync(new URL('scripts/discord-register.js', raiz), 'utf8'), /require\('\.\/discord-comandos-lista\.js'\)/);
    assert.doesNotMatch(readFileSync(new URL('scripts/gerar-docs.js', raiz), 'utf8'), /scripts\/discord-register\.js'\)/);
  });

  // achado A.7-7
  test('as citações ficheiro:símbolo das regras, do diário e das armadilhas apontam para código que existe', () => {
    for (const { f, min } of DOCS_MD) {
      const md = ler(f);
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
        if (!temSimbolo(ler(fich[0]), sim, fich[0].split('.').pop())) mortas.push(cit + ' — «' + sim + '» não está em ' + fich[0]);
      }
      for (const m of md.matchAll(RE_FICH_SOLTO)) {
        if (!resolveFicheiro(m[1]).length) mortas.push(m[1] + ' — o ficheiro não existe');
      }
      assert.deepEqual(mortas, [], 'citações mortas em ' + f);
      // se o formato do documento mudar, o teste deixa de ver citações e ficava vazio sem ninguém dar por isso
      assert.ok(n >= min, f + ' cita o código por símbolo (' + n + ' citações distintas)');
    }
  });

  // achado A.7-7
  test('as regras vivas e o diário datado são dois ficheiros, cada um com o índice das suas secções e o seu capítulo nos docs', async () => {
    const design = ler('docs/design.md'), diario = ler('docs/decisoes.md');
    // cada ficheiro abre com um índice que lista as secções dele, pela ordem
    for (const [f, md] of [['docs/design.md', design], ['docs/decisoes.md', diario]]) {
      const titulos = seccoes(md).map((s) => s.titulo);
      const indice = introDe(md).split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2).trim());
      assert.deepEqual(indice, titulos, f + ': o índice do topo lista as secções, pela ordem');
    }
    // o diário: cada entrada começa pela data, e as datas não recuam
    const datas = seccoes(diario).map((s) => (s.titulo.match(/^(\d{4}-\d{2}-\d{2}) · \S/) || [])[1]);
    assert.ok(datas.length >= 10 && datas.every(Boolean), 'cada entrada do diário começa pela data: ' + seccoes(diario).map((s) => s.titulo).join(' | '));
    assert.deepEqual([...datas].sort(), datas, 'o diário corre por ordem de data');
    // as regras: nada datado, nenhuma correção de uma correção, nenhuma dívida paga
    assert.ok(seccoes(design).every((s) => !/^\d{4}-\d{2}-\d{2}/.test(s.titulo)), 'nenhuma secção datada nas regras');
    assert.doesNotMatch(design, /estava errado quando se escreveu|^Resolvida \(/m, 'o que é história vive no diário');
    // um capítulo por ficheiro, com todas as secções servidas
    const { DOCS } = await import('../worker/src/docs-gerados.js?' + Date.now());
    for (const { f, cap } of DOCS_MD) {
      const c = DOCS.capitulos.find((x) => x.id === cap);
      assert.ok(c && c.itens.length === 1 && c.itens[0].nome === f, 'o capítulo «' + cap + '» é o ' + f);
      assert.equal(c.itens[0].funcoes.length, seccoes(ler(f)).length, f + ': cada secção é uma entrada servida');
      assert.ok(c.itens[0].texto.length > 40, f + ': o capítulo abre com o que o ficheiro é');
    }
  });

  // achado A.7-9
  // achado A.1-13b
  test('a lista das dívidas só tem dívidas abertas, e a das formas dos gráficos cita exatamente as que ainda têm toque', () => {
    const div = seccoes(ler('docs/design.md')).find((s) => s.titulo === 'Dívidas de design conhecidas');
    assert.ok(div, 'a secção das dívidas existe');
    assert.doesNotMatch(div.corpo, /^Resolvid/m, 'uma dívida que fecha sai da lista (e vai para o diário, com a data)');
    /* o que tem toque nos gráficos, lido do código: as funções de topo cujo
       HTML leva a ação declarada (o data-click tomou o lugar do onclick=, que
       a CSP sem 'unsafe-inline' deixou de correr — web/app/eventos.js) */
    const src = ler('web/app/graficos.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const comToque = src.split(/\n(?=function \w+\()/)
      .map((p) => [(/^function (\w+)\(/.exec(p) || [])[1], /data-click=/.test(p)])
      .filter(([nome, tem]) => nome && tem).map(([nome]) => nome).sort();
    assert.deepEqual(comToque, ['cDonut', 'legend'], 'controlo: só as fatias do donut e os itens da legenda têm toque');
    const entrada = div.corpo.split(/\n\s*\n/).find((p) => /tornarFocavel/.test(p));
    assert.ok(entrada, 'a dívida das formas com toque continua na lista, com o que resta dela');
    const citados = [...new Set([...entrada.matchAll(/graficos\.js:(\w+)/g)].map((m) => m[1]))].sort();
    assert.deepEqual(citados, comToque, 'a dívida cita as formas que ainda têm toque, e só essas');
    assert.doesNotMatch(entrada, /cada barra/, 'as barras e os pontos já não têm toque');
  });

  // achado A.7-14
  test('cada secção do comandos.md é de um comando registado, o gerador recusa uma que não seja, e as rotas dos serviços de uma conta estão numa página servida', async () => {
    const { comandos } = require('../scripts/discord-comandos-lista.js');
    const titulos = seccoes(ler('docs/comandos.md')).map((s) => s.titulo).sort();
    assert.deepEqual(titulos, comandos.map((c) => c.name).sort(), 'uma secção por comando, e nenhuma a mais');
    const r = gerarCom({ 'docs/comandos.md': '\n## fantasma\nNão é um comando do Discord, e o gerador não a pode deitar fora calado.\n' });
    assert.notEqual(r.status, 0, 'o gerador falha com uma secção sem comando');
    assert.match(r.stderr, /fantasma/, 'e diz qual é');
    const { DOCS } = await import('../worker/src/docs-gerados.js?' + Date.now());
    const servidas = DOCS.capitulos.flatMap((c) => c.itens.flatMap((i) => (i.funcoes || []).map((f) => f.doc)));
    assert.ok(servidas.some((d) => d.includes('/api/equipa/pessoas/:id/servicos')), 'as rotas dos serviços de uma conta vêm na documentação servida');
  });

  // achado A.1-11c
  test('o gerador vê as funções escritas «const x = y =>» e «export const x = (…) =>», e recusa-as sem comentário', async () => {
    const r = gerarCom({ 'worker/src/lib/http.js': '\nexport const semNadaPorCima = (a) => a;\nconst nemEsta = b => b;\n' });
    assert.notEqual(r.status, 0, 'o gerador falha');
    assert.match(r.stderr, /semNadaPorCima/, 'a forma com export');
    assert.match(r.stderr, /nemEsta/, 'a forma de um parâmetro sem parênteses');
    const ok = gerarCom({ 'worker/src/lib/http.js': '\n// Um exemplo com o comentário da casa.\n// Recebe: b — um valor.\n// Devolve: o mesmo valor.\nconst comEsta = b => b;\n' });
    assert.equal(ok.status, 0, 'com o comentário passa: ' + ok.stderr);
    // a assinatura sai com o parâmetro, como as outras
    const { DOCS } = await import('../worker/src/docs-gerados.js?' + Date.now());
    const fn = (fich, nome) => DOCS.capitulos.flatMap((c) => c.itens).find((i) => i.nome === fich).funcoes.find((f) => f.nome === nome);
    assert.equal(fn('web/app/formato.js', 'dPT').assinatura, 'dPT (iso)');
    assert.equal(fn('worker/src/lib/papeis.js', 'comoLista').assinatura, 'comoLista (p)');
    assert.match(fn('worker/src/lib/http.js', 'badId').doc, /Recebe:[\s\S]*Devolve:/);
  });

  // achado A.1-9b
  // achado A.2-20
  test('a Escrita do design.md tem a regra dos nomes: os novos em português, os antigos mudam quando se lhes toca, e o que não muda diz porquê', () => {
    const escrita = seccoes(ler('docs/design.md')).find((s) => s.titulo === 'Escrita');
    assert.ok(escrita, 'a secção Escrita existe');
    assert.match(escrita.corpo, /[Nn]omes\s+novos[^.]*em\s+português/);
    assert.match(escrita.corpo, /os\s+antigos\s+mudam\s+quando\s+se\s+lhes\s+toca/);
    // o caso que a motivou: dois nomes para o mesmo gesto, e o antigo passou a chamar o novo
    assert.match(escrita.corpo, /navegacao\.js:closeFilterPanels/);
    assert.match(escrita.corpo, /vistas\.js:fecharFiltros/);
    // o que não se renomeia de passagem, com o sítio de onde se prende
    assert.match(escrita.corpo, /servicos\.js:SERVICOS/);
    assert.match(escrita.corpo, /db\.transactions/);
  });

  // achado A.5-7b
  test('o comandos.md diz o que o /uso mostra de facto, e quem descarrega uma cópia e quem vê um pedido', async () => {
    const { LIMITS } = await import('../worker/src/notify.js');
    const cs = Object.fromEntries(seccoes(ler('docs/comandos.md')).map((s) => [s.titulo, s.corpo]));
    for (const fam of new Set(Object.keys(LIMITS).map((k) => k.split(' · ')[0]))) {
      assert.match(cs.uso, new RegExp('\\b' + fam + '\\b'), 'o /uso mede ' + fam + ' e o comandos.md di-lo');
    }
    assert.match(cs.uso, /sem medida/, 'o que a API não devolve aparece, e diz-se como');
    assert.match(cs.uso, /24 horas/); assert.match(cs.uso, /dia UTC/); assert.match(cs.uso, /dia 1 do mês/);
    assert.match(cs.copias, /descarreg[^.]*master/i, 'descarregar uma cópia é só do master');
    assert.match(cs.pedido, /privad/i, 'a resposta do /pedido é privada');
  });

  test('as armadilhas dizem o que o código e o deploy fazem hoje', () => {
    const arm = ler('docs/armadilhas.md');
    // cada passo de workflow que as armadilhas nomeiam existe com esse nome
    const pasta = new URL('.github/workflows/', raiz);
    const nomes = new Set(readdirSync(pasta).filter((f) => /\.ya?ml$/.test(f))
      .flatMap((f) => [...ler('.github/workflows/' + f).matchAll(/^\s*- name: *['"]?(.+?)['"]?\s*$/gm)].map((m) => m[1])));
    const citados = [...arm.matchAll(/passos? «([^»]+)»(?: e «([^»]+)»)?/g)].flatMap((m) => m.slice(1).filter(Boolean));
    assert.ok(citados.length >= 3, 'as armadilhas nomeiam os passos: ' + citados.join(', '));
    for (const p of citados) assert.ok(nomes.has(p), '«' + p + '» é um passo de um workflow');
    // o guião do /equipa é um String.raw no ficheiro dele, e as regras que sobram são essas
    assert.match(ler('worker/src/equipa-guiao.js'), /export const GUIAO = String\.raw`/, 'controlo');
    assert.doesNotMatch(arm, /template literal do servidor|Escreve `\\\\n`/, 'já não se escreve \\\\n no guião');
    assert.match(arm, /equipa-guiao\.js/);
    // os cliques do back office vão por data-acao e pela tabela ACOES, sem on…= (a CSP_ESTRITA não os corre)
    assert.match(ler('worker/src/equipa-guiao.js'), /var ACOES = \{/, 'controlo');
    assert.match(arm, /comAcao\(/);
    assert.match(arm, /ACOES/);
    assert.match(arm, /CSP_ESTRITA/);
    assert.doesNotMatch(arm, /jsq\(\)/, 'o guião já não tem jsq(): a regra antiga mandava escrever um on…=');
    // sem a TESTE_CHAVE, o ambiente de teste recusa em vez de assinar com uma chave conhecida
    assert.match(ler('worker/src/teste.js'), /SEM_CHAVE/, 'controlo');
    assert.match(arm, /TESTE_CHAVE[\s\S]{0,400}503/);
    // as armadilhas que as correções de 2026-09-15 criaram
    assert.match(arm, /PASS_PEPPER/);
    assert.match(arm, /HttpOnly/);
    assert.match(arm, /migrations apply/);
  });
});
