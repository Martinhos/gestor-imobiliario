// A pílula do QA no back office do dev (worker/src/equipa-qa.js e as rotas
// /api/equipa/qa de worker/src/rotas/qa.js:rotasQaDaEquipa). Prova que as
// rotas da equipa gravam na mesma tabela, com a pessoa da equipa como autor
// (user_id 'equipa:<Discord>', discord_id e discord_nome da sessão), que
// qualquer cargo as usa, que a app e o back office veem os tickets uns dos
// outros, e que em produção nada disto existe (rotas e recursos com 404, a
// página sem a pílula); que o /equipa/qa.js junta a camada, o icones.js, o
// formato.js e o qa.js verdadeiros numa função só, que corre sem deixar no
// window mais do que o CW, e que as ações data-click só chamam as funções da
// tabela; que o /equipa/qa.css leva o bloco do QA do estilos.css; e que a
// camada não tem crases nem cifrão com chaveta (vai num String.raw). E a
// mesma pílula nas páginas públicas do dev (a montra e o guia): o
// pilulaDasPaginas só com o ENV_NAME e com conta, com os dados escapados num
// bloco que não corre; o recursoDoQaDasPaginas com os portões todos (404 em
// produção, 405, 401 sem conta, null noutro caminho); o /paginas/qa.js que
// compila, só deixa o CW no window e fala com /api/qa pelo cookie; o
// /paginas/qa.css com os tokens presos às caixas do QA; e o back office igual.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ambiente, conta, pedir, resp } from './lib/api.js';
import { chamar, corpoDe, DEV, SUPORTE, MARKETING } from './lib/equipa.js';
import {
  CAMADA_QA, FIM_DA_CAMADA, CSS_QA_EQUIPA, FICHEIROS_DO_QA, ACOES_DA_CAMADA, MARCA_CSS_FIM,
  montarGuiaoDoQa, montarCssDoQa, cortarCssDoQa, funcoesDeTopo, recursoDoQa,
  CAMADA_DAS_PAGINAS, FIM_DAS_PAGINAS, CSS_QA_PAGINAS, pilulaDasPaginas, recursoDoQaDasPaginas,
} from '../worker/src/equipa-qa.js';
import { autorDaEquipa } from '../worker/src/rotas/qa.js';
import { paginaEquipa } from '../worker/src/equipa-vista.js';

const WEB = fileURLToPath(new URL('../web', import.meta.url));

// Recebe: caminho — o caminho de um ficheiro de web/ ('/cloud/qa.js').
// Devolve: o texto dele.
const daWeb = (caminho) => readFileSync(WEB + caminho, 'utf8');

/* Os assets do worker a ler da pasta web/, como o env.ASSETS faria.
   Devolve: {fetch(request)} e a lista dos caminhos pedidos. */
function assetsFalsos() {
  const pedidos = [];
  return {
    pedidos,
    fetch: async (req) => {
      const p = new URL(req.url).pathname;
      pedidos.push(p);
      try { return new Response(daWeb(p)); } catch (e) { return new Response('não há', { status: 404 }); }
    },
  };
}

// Recebe: env; eu — a sessão de equipa; corpo — o do POST.
// Devolve: a promessa de {status, ...}.
const criar = async (env, eu, corpo) => corpoDe(await chamar(env, eu, 'POST', '/api/equipa/qa', corpo));
// Recebe: env; eu — a sessão de equipa.
// Devolve: a promessa da lista.
const listar = async (env, eu) => (await corpoDe(await chamar(env, eu, 'GET', '/api/equipa/qa'))).tickets;

/* ------------------------------- as rotas ------------------------------- */

describe('as rotas do QA no back office', () => {
  test('a pessoa da equipa escreve um ticket: autor pelo Discord, na mesma tabela', async () => {
    const env = ambiente();
    const r = await criar(env, DEV, { body: '  O filtro dos pedidos não guarda.  ', severity: 'incomoda', context: { ecra: { pagina: 'Back office › Pedidos' } } });
    assert.equal(r.status, 201);
    const l = await env.DB.prepare('SELECT * FROM qa_tickets WHERE id = ?').bind(r.id).first();
    assert.equal(l.user_id, 'equipa:d1');
    assert.equal(l.user_id, autorDaEquipa(DEV));
    assert.equal(l.discord_id, 'd1');
    assert.equal(l.discord_nome, 'Dina');
    assert.equal(l.body, 'O filtro dos pedidos não guarda.');
    assert.equal(l.severity, 'incomoda');
    assert.equal(l.status, 'aberto');
    const t = (await listar(env, DEV))[0];
    assert.deepEqual(t.autor, { id: 'equipa:d1', nome: '', email: '', discord: { id: 'd1', nome: 'Dina' } });
    assert.equal(t.context.ecra.pagina, 'Back office › Pedidos');
  });

  test('qualquer cargo usa a pílula, e a app e o back office veem os tickets uns dos outros', async () => {
    const env = ambiente();
    const ana = await conta(env, 'Ana');
    assert.equal((await resp(pedir(env, ana, '/api/qa', 'POST', { body: 'da app' }))).status, 201);
    assert.equal((await criar(env, MARKETING, { body: 'do marketing' })).status, 201, 'um cargo que não vê pedidos também escreve');
    assert.equal((await criar(env, SUPORTE, { body: 'do suporte' })).status, 201);
    const naApp = (await resp(pedir(env, ana, '/api/qa'))).tickets.map((t) => t.body).sort();
    const noBackOffice = (await listar(env, MARKETING)).map((t) => t.body).sort();
    assert.deepEqual(naApp, ['da app', 'do marketing', 'do suporte']);
    assert.deepEqual(noBackOffice, naApp);
  });

  test('remover, repor, reabrir e a captura também pelo caminho da equipa', async () => {
    const env = ambiente();
    const { id } = await criar(env, DEV, { body: 'x' });
    assert.equal((await chamar(env, SUPORTE, 'DELETE', '/api/equipa/qa/' + id)).status, 200);
    assert.equal((await listar(env, DEV)).length, 0);
    assert.equal((await chamar(env, DEV, 'POST', '/api/equipa/qa/' + id + '/repor')).status, 200);
    await env.DB.prepare("UPDATE qa_tickets SET status = 'resolvido', resolution = 'feito', resolved_at = 1 WHERE id = ?").bind(id).run();
    assert.equal((await chamar(env, DEV, 'POST', '/api/equipa/qa/' + id + '/reabrir')).status, 200);
    assert.equal((await listar(env, DEV))[0].status, 'aberto');
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));
    const { rotasEquipaApi } = await import('../worker/src/equipa-api.js');
    const caminho = '/api/equipa/qa/' + id + '/imagem';
    const url = new URL('https://x.pt' + caminho);
    const put = await rotasEquipaApi({ env, path: caminho, method: 'PUT', url, eu: DEV,
      request: new Request(url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png }) });
    assert.equal(put.status, 200);
    const get = await chamar(env, MARKETING, 'GET', caminho);
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('Content-Type'), 'image/png');
    assert.equal((await chamar(env, DEV, 'DELETE', '/api/equipa/qa/a%27b')).status, 404, 'um id sem forma de id');
    assert.equal((await chamar(env, DEV, 'GET', '/api/equipa/qa/' + id + '/outra')).status, 404);
  });

  test('em produção as rotas da equipa respondem 404 e nada se grava', async () => {
    const env = ambiente({ ENV_NAME: undefined });
    for (const [m, p] of [['POST', '/api/equipa/qa'], ['GET', '/api/equipa/qa'], ['DELETE', '/api/equipa/qa/x1'], ['POST', '/api/equipa/qa/x1/reabrir']]) {
      const r = await chamar(env, DEV, m, p, m === 'GET' ? undefined : { body: 'olá' });
      assert.equal(r.status, 404, m + ' ' + p);
    }
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM qa_tickets').first()).n, 0);
  });
});

/* ------------------------------ a página -------------------------------- */

describe('a página do back office', () => {
  test('no dev leva os dados da pílula, o guião e o CSS dela; em produção, nada', async () => {
    const dev = await paginaEquipa(DEV, { qa: 'dev' }).text();
    assert.match(dev, /<link rel="stylesheet" href="\/equipa\/qa\.css">/);
    assert.match(dev, /<script src="\/equipa\/guiao\.js"><\/script>\s*(?:<script src="\/equipa\/kanban\.js"><\/script>\s*)?<script type="application\/json" id="dados-qa">[^<]+<\/script>\s*<script src="\/equipa\/qa\.js"><\/script>/,
      'depois do guião (e do kanban, que no dev vem logo a seguir a ele)');
    const dados = JSON.parse(/id="dados-qa">([^<]+)</.exec(dev)[1]);
    assert.deepEqual(dados, { ambiente: 'dev', id: 'equipa:d1', nome: 'Dina' });
    for (const prod of [await paginaEquipa(DEV).text(), await paginaEquipa(DEV, { qa: '' }).text()]) {
      assert.doesNotMatch(prod, /qa\.js|qa\.css|dados-qa/);
    }
  });

  test('os dados levam "app":true só quando a opção vem (a porta do dev deixa abrir a app)', async () => {
    const lerDados = (h) => JSON.parse(/id="dados-qa">([^<]+)</.exec(h)[1]);
    const com = lerDados(await paginaEquipa(DEV, { qa: 'dev', app: true }).text());
    assert.deepEqual(com, { ambiente: 'dev', id: 'equipa:d1', nome: 'Dina', app: true });
    for (const opcoes of [{ qa: 'dev' }, { qa: 'dev', app: false }, { qa: 'dev', app: 'sim' }]) {
      assert.equal('app' in lerDados(await paginaEquipa(DEV, opcoes).text()), false, JSON.stringify(opcoes));
    }
    // sem ambiente (produção) não há dados, mesmo com o app
    assert.doesNotMatch(await paginaEquipa(DEV, { qa: '', app: true }).text(), /dados-qa/);
  });
});

/* ------------------------------ os recursos ----------------------------- */

describe('o /equipa/qa.js e o /equipa/qa.css', () => {
  const URL_JS = new URL('https://dev.x.pt/equipa/qa.js'), URL_CSS = new URL('https://dev.x.pt/equipa/qa.css');

  test('só no dev e só com sessão de equipa; outro caminho não é destes', async () => {
    const assets = assetsFalsos();
    assert.equal((await recursoDoQa({ ASSETS: assets }, URL_JS, 'GET', DEV)).status, 404, 'produção');
    assert.equal((await recursoDoQa({ ASSETS: assets, ENV_NAME: 'dev' }, URL_CSS, 'GET', null)).status, 401);
    assert.equal((await recursoDoQa({ ASSETS: assets, ENV_NAME: 'dev' }, URL_JS, 'POST', DEV)).status, 405);
    assert.equal(await recursoDoQa({ ASSETS: assets, ENV_NAME: 'dev' }, new URL('https://dev.x.pt/equipa/outro.js'), 'GET', DEV), null);
    assert.deepEqual(assets.pedidos, [], 'nada se leu dos assets');
  });

  test('o guião junta a camada e os ficheiros da app numa função, com a tabela das ações', async () => {
    const assets = assetsFalsos();
    const r = await recursoDoQa({ ASSETS: assets, ENV_NAME: 'dev' }, URL_JS, 'GET', DEV);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Content-Type'), 'text/javascript; charset=utf-8');
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(assets.pedidos, FICHEIROS_DO_QA);
    const js = await r.text();
    assert.match(js, /^\/\*[\s\S]*?\*\/\n\(function \(\) \{\n/);
    assert.ok(js.trimEnd().endsWith('})();'));
    for (const f of FICHEIROS_DO_QA) assert.ok(js.includes(daWeb(f)), f + ' entra tal e qual');
    assert.ok(js.indexOf(CAMADA_QA) < js.indexOf(daWeb('/cloud/qa.js')), 'a camada vem antes do qa.js');
    assert.ok(js.indexOf(daWeb('/cloud/qa.js')) < js.indexOf(FIM_DA_CAMADA), 'e o fim depois');
    // a tabela: as funções qa… do qa.js e as da camada, e mais nenhuma
    const tabela = /var QA_ACOES = \{([\s\S]*?)\n\};/.exec(js)[1];
    const nomes = [...tabela.matchAll(/^ {2}(\w+): function/gm)].map((m) => m[1]);
    for (const n of ['qaNovoTicket', 'qaVerTickets', 'qaEnviar', 'qaAbrirTicket', 'qaRemover', 'qaReabrir', 'qaDobrar', 'qaMenuAbriu', ...ACOES_DA_CAMADA]) {
      assert.ok(nomes.includes(n), n + ' na tabela');
    }
    assert.ok(nomes.every((n) => /^qa/.test(n) || ACOES_DA_CAMADA.includes(n)), 'só as do QA');
    // todas as ações que o qa.js escreve no HTML estão na tabela
    const qa = daWeb('/cloud/qa.js');
    for (const m of qa.matchAll(/data-(?:click|input|change)="([^"]*)"/g)) {
      // só os nomes que abrem uma instrução (o jsq(…) de dentro de uma concatenação é do JS que escreve o HTML)
      for (const chamada of m[1].matchAll(/(?:^|;)\s*([A-Za-z_$][\w$]*)\(/g)) {
        assert.ok(nomes.includes(chamada[1]), 'a ação ' + chamada[1] + ' (de «' + m[1] + '») tem de estar na tabela');
      }
    }
    new vm.Script(js, { filename: 'equipa-qa.js' });
  });

  test('o CSS leva o da camada e o bloco do QA do estilos.css, sem o resto da folha', async () => {
    const r = await recursoDoQa({ ASSETS: assetsFalsos(), ENV_NAME: 'dev' }, URL_CSS, 'GET', DEV);
    assert.equal(r.headers.get('Content-Type'), 'text/css; charset=utf-8');
    const css = await r.text();
    const estilos = daWeb('/estilos.css');
    assert.ok(css.startsWith(CSS_QA_EQUIPA));
    assert.ok(css.includes(cortarCssDoQa(estilos)));
    assert.match(css, /\.qa-pilula\{position:fixed/);
    assert.ok(css.trimEnd().endsWith(MARCA_CSS_FIM));
    assert.doesNotMatch(css, /^aside\{/m, 'o resto da folha da app não vem');
    assert.equal(montarCssDoQa(estilos), css);
    assert.throws(() => cortarCssDoQa('.x{}'), /marcadores/);
  });

  test('a camada vai num String.raw: sem crases nem cifrão com chaveta', () => {
    for (const [nome, t] of [['CAMADA_QA', CAMADA_QA], ['FIM_DA_CAMADA', FIM_DA_CAMADA], ['CSS_QA_EQUIPA', CSS_QA_EQUIPA]]) {
      assert.ok(!t.includes('`'), nome + ' sem crases');
      assert.ok(!t.includes('${'), nome + ' sem ${');
    }
  });

  test('funcoesDeTopo só lê as funções do princípio da linha', () => {
    assert.deepEqual(funcoesDeTopo('function a() {}\n  function b() {}\nfunction c (x) {}\nvar d = function () {};\nfunction a() {}'), ['a', 'c']);
    assert.throws(() => montarGuiaoDoQa({ '/app/icones.js': 'x' }), /Falta o \/app\/formato\.js/);
  });
});

/* ------------------------------- a camada ------------------------------- */

/* Um contexto de browser mínimo para a camada: o document com os dados da
   pílula, os ouvintes guardados, e um fetch que responde o que o teste
   disser.
   Recebe: respostas — {'MÉTODO /caminho': {status, corpo}}; op (opcional) —
   {dados: os da pílula, location: o endereço, elementos: true para os
   elementos criados saberem ouvir e procurar, como os de uma página}.
   Devolve: {ctx, ouvintes, pedidos, opcoes (as opções de cada fetch)}. */
function browserFalso(respostas = {}, op = {}) {
  const ouvintes = {}, pedidos = [], opcoes = [];
  const dados = JSON.stringify(op.dados || { ambiente: 'dev', id: 'equipa:d1', nome: 'Dina' });
  const elemento = () => {
    const el = { classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, setAttribute() {}, removeAttribute() {}, appendChild() {}, style: {} };
    if (op.elementos) Object.assign(el, { addEventListener() {}, querySelector: () => null, remove() {}, offsetWidth: 96, offsetHeight: 44 });
    return el;
  };
  const document = {
    getElementById: (id) => (id === 'dados-qa' ? { textContent: dados } : null),
    addEventListener: (tipo, fn) => { (ouvintes[tipo] = ouvintes[tipo] || []).push(fn); },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: elemento,
    body: { appendChild() {}, classList: { contains: () => false } },
    documentElement: { clientWidth: 1200, classList: { contains: () => false } },
    contains: () => false,
    activeElement: null,
    title: op.titulo || '',
  };
  const ctx = {
    document, console, URL, JSON, Promise, setTimeout, clearTimeout, Error, Object, Array, String, Number, Math, Date, RegExp,
    location: op.location || { href: 'https://dev.x.pt/equipa', hash: '' },
    navigator: { userAgent: 'teste' },
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1,
    addEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: () => '.2s', position: 'static' }),
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame() {},
    fetch: async (url, o) => {
      const m = ((o && o.method) || 'GET') + ' ' + url;
      pedidos.push([m, o && o.body]);
      opcoes.push(o || {});
      const r = respostas[m] || { status: 200, corpo: {} };
      return new Response(JSON.stringify(r.corpo), { status: r.status });
    },
  };
  ctx.window = ctx;
  return { ctx: vm.createContext(ctx), ouvintes, pedidos, opcoes };
}

describe('a camada no browser', () => {
  test('o guião inteiro corre e só deixa o CW no window (e o fetch com o rasto)', async () => {
    const textos = Object.fromEntries(FICHEIROS_DO_QA.map((f) => [f, daWeb(f)]));
    const { ctx } = browserFalso();
    const antes = new Set(Object.keys(ctx));
    vm.runInContext(montarGuiaoDoQa(textos), ctx);
    const novos = Object.keys(ctx).filter((k) => !antes.has(k));
    assert.deepEqual(novos, ['CW']);
    assert.equal(ctx.CW.ambiente, 'dev');
    assert.equal(ctx.CW.user.id, 'equipa:d1');
    assert.equal(ctx.fetch.qaRasto, true);
    for (const n of ['esc', 'ic', 'qaNovoTicket', 'openModal', 'api', 'toast']) assert.equal(ctx[n], undefined, n + ' não vaza');
  });

  /* A camada com uma tabela de ações de brincar, e as funções dela à mão.
     Recebe: respostas — as do fetch.
     Devolve: {t: as funções, chamadas: o que as ações chamaram, ctx, pedidos}. */
  function camada(respostas) {
    const b = browserFalso(respostas);
    b.ctx.chamadas = [];
    vm.runInContext('(function () {\n' + CAMADA_QA +
      '\nvar QA_ACOES = { qaAbrir: function () { chamadas.push(["qaAbrir"].concat([].slice.call(arguments))); },' +
      ' qaOutra: function () { chamadas.push(["qaOutra", arguments.length]); } };\n' +
      'window.t = { qaCorrerAcao: qaCorrerAcao, qaArgumentos: qaArgumentos, qaCaminho: qaCaminho, api: api, fetch: fetch, rastoPoe: rastoPoe };\n})();', b.ctx);
    return { t: b.ctx.t, chamadas: b.ctx.chamadas, ctx: b.ctx, pedidos: b.pedidos };
  }

  test('as ações: só as funções da tabela, com textos, números, this, event, true, false e null', () => {
    const { t, chamadas } = camada();
    const este = { id: 'eu' }, ev = { type: 'click' };
    t.qaCorrerAcao("qaAbrir('a\\'b', \"c\", 3, -1.5, this, event, true, false, null);qaOutra()", este, ev);
    assert.equal(chamadas.length, 2);
    // os arrays vêm do vm (outro realm): copiam-se antes de comparar
    assert.deepEqual(Array.from(chamadas[0]).slice(0, 5), ['qaAbrir', "a'b", 'c', 3, -1.5]);
    assert.equal(chamadas[0][5], este);
    assert.equal(chamadas[0][6], ev);
    assert.deepEqual(Array.from(chamadas[0]).slice(7), [true, false, null]);
    assert.deepEqual(Array.from(chamadas[1]), ['qaOutra', 0]);
    for (const mau of ['alert(1)', 'qaAbrir(x)', 'qaAbrir(1+1)', 'qaAbrir()+1', 'constructor()', 'qaAbrir(window)', 'qaAbrir();fetch("/x")']) {
      assert.throws(() => t.qaCorrerAcao(mau, este, ev), /QA:/, mau);
    }
  });

  test('os caminhos do QA vão para /api/equipa/qa, e o api() devolve o erro do servidor', async () => {
    const { t, pedidos, ctx } = camada({ 'GET /api/equipa/qa/x/imagem': { status: 404, corpo: { error: 'Este ticket não tem captura.' } } });
    assert.equal(t.qaCaminho('/api/qa'), '/api/equipa/qa');
    assert.equal(t.qaCaminho('/api/qa/x1/reabrir'), '/api/equipa/qa/x1/reabrir');
    assert.equal(t.qaCaminho('/api/qaz'), '/api/qaz');
    assert.deepEqual(await t.api('POST', '/api/qa', { body: 'olá' }), {});
    assert.deepEqual(pedidos[0], ['POST /api/equipa/qa', '{"body":"olá"}']);
    await assert.rejects(t.api('GET', '/api/qa/x/imagem'), (e) => e.message === 'Este ticket não tem captura.' && e.status === 404);
    assert.ok(ctx.CW._rasto.includes('GET /api/equipa/qa/x/imagem → 404'), 'o pedido ficou no rasto');
  });
});

/* ------------------------- as páginas públicas -------------------------- */

const CONTA = { id: 'u-1', name: 'Maria </script><script>alert(1)</script>', email: 'maria@rendorium.test' };

/* O CSS sem os blocos @media(hover:hover) and (pointer:fine), com as chavetas contadas.
   Recebe: css — o texto.
   Devolve: o texto sem esses blocos. */
function semBlocosDoRato(css) {
  const abre = '@media(hover:hover) and (pointer:fine){';
  let s = css, i;
  while ((i = s.indexOf(abre)) > -1) {
    let fundo = 1, j = i + abre.length;
    for (; j < s.length && fundo > 0; j++) fundo += s[j] === '{' ? 1 : s[j] === '}' ? -1 : 0;
    s = s.slice(0, i) + s.slice(j);
  }
  return s;
}

describe('a pílula nas páginas públicas (pilulaDasPaginas)', () => {
  test('em produção, ou sem conta, nada', async () => {
    for (const env of [{}, { ENV_NAME: '' }, { ENV_NAME: undefined }]) assert.equal(await pilulaDasPaginas(env, CONTA), '', 'produção');
    for (const conta of [null, undefined, {}, { id: '' }]) assert.equal(await pilulaDasPaginas({ ENV_NAME: 'dev' }, conta), '', 'sem conta');
  });

  test('no dev, com conta: o CSS, os dados da própria conta num bloco que não corre, e o guião da mesma origem', async () => {
    const h = await pilulaDasPaginas({ ENV_NAME: 'dev' }, CONTA);
    assert.match(h, /^<link rel="stylesheet" href="\/paginas\/qa\.css"><script type="application\/json" id="dados-qa">[^<]+<\/script><script src="\/paginas\/qa\.js"><\/script>$/);
    assert.doesNotMatch(h, /<\/script><script>alert/, 'o nome não fecha o bloco');
    const dados = JSON.parse(/id="dados-qa">([^<]+)</.exec(h)[1]);
    assert.deepEqual(dados, { ambiente: 'dev', id: 'u-1', nome: CONTA.name }, 'o nome chega igual, e o email não vai');
    const quebras = await pilulaDasPaginas({ ENV_NAME: 'dev' }, { id: 'u-2', name: 'a b' });
    assert.ok(quebras.includes('a\\u2028b'), 'as quebras de linha do JavaScript vão escapadas');
  });
});

describe('o /paginas/qa.js e o /paginas/qa.css (recursoDoQaDasPaginas)', () => {
  const URL_JS = new URL('https://dev.x.pt/paginas/qa.js'), URL_CSS = new URL('https://dev.x.pt/paginas/qa.css');

  test('só no dev, só por GET e HEAD, e só com conta; outro caminho não é destes', async () => {
    const assets = assetsFalsos(), DEV_ENV = { ASSETS: assets, ENV_NAME: 'dev' };
    assert.equal((await recursoDoQaDasPaginas({ ASSETS: assets }, URL_JS, 'GET', CONTA)).status, 404, 'produção, mesmo com conta');
    assert.equal((await recursoDoQaDasPaginas({ ASSETS: assets }, URL_CSS, 'GET', CONTA)).status, 404);
    const post = await recursoDoQaDasPaginas(DEV_ENV, URL_JS, 'POST', CONTA);
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('Allow'), 'GET, HEAD');
    for (const conta of [null, {}, { id: '' }]) assert.equal((await recursoDoQaDasPaginas(DEV_ENV, URL_CSS, 'GET', conta)).status, 401);
    for (const r of [await recursoDoQaDasPaginas(DEV_ENV, URL_JS, 'GET', null), await recursoDoQaDasPaginas({ ASSETS: assets }, URL_JS, 'GET', null)]) {
      assert.equal(r.headers.get('Cache-Control'), 'no-store');
    }
    for (const p of ['/paginas/landing.css', '/paginas/qa.jsx', '/equipa/qa.js']) {
      assert.equal(await recursoDoQaDasPaginas(DEV_ENV, new URL('https://dev.x.pt' + p), 'GET', CONTA), null, p);
    }
    assert.equal(await recursoDoQa(DEV_ENV, URL_JS, 'GET', DEV), null, 'o do back office não serve o das páginas');
    assert.deepEqual(assets.pedidos, [], 'nada se leu dos assets');
  });

  test('o guião: a camada das páginas e os ficheiros da app numa função, no-store, e nada das rotas da equipa', async () => {
    const assets = assetsFalsos();
    const r = await recursoDoQaDasPaginas({ ASSETS: assets, ENV_NAME: 'dev' }, URL_JS, 'GET', CONTA);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Content-Type'), 'text/javascript; charset=utf-8');
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(assets.pedidos, FICHEIROS_DO_QA);
    const js = await r.text();
    assert.match(js, /^\/\*[\s\S]*?\*\/\n\(function \(\) \{\n/);
    assert.ok(js.trimEnd().endsWith('})();'));
    for (const f of FICHEIROS_DO_QA) assert.ok(js.includes(daWeb(f)), f + ' entra tal e qual');
    assert.ok(js.indexOf(CAMADA_DAS_PAGINAS) > -1 && js.indexOf(CAMADA_DAS_PAGINAS) < js.indexOf(daWeb('/cloud/qa.js')), 'a camada das páginas antes do qa.js');
    assert.ok(js.indexOf(daWeb('/cloud/qa.js')) < js.indexOf(FIM_DAS_PAGINAS), 'e o fim depois');
    assert.doesNotMatch(js, /\/api\/equipa\/qa|var QA_EQUIPA/, 'nem as rotas nem a marca do back office');
    assert.match(js, /var QA_PAGINAS = QA_DADOS;/);
    // as ações que o qa.js escreve estão na tabela, como no back office
    const tabela = /var QA_ACOES = \{([\s\S]*?)\n\};/.exec(js)[1];
    for (const n of ['qaVoltarApp', 'qaBackOffice', 'qaVerMontra', 'qaNovoTicket', ...ACOES_DA_CAMADA]) assert.match(tabela, new RegExp('^ {2}' + n + ': function', 'm'), n);
    new vm.Script(js, { filename: 'paginas-qa.js' });
    const head = await recursoDoQaDasPaginas({ ASSETS: assetsFalsos(), ENV_NAME: 'dev' }, URL_JS, 'HEAD', CONTA);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '', 'o HEAD sem corpo');
  });

  test('o CSS: o do back office, o bloco do QA e os tokens presos às caixas do QA, sem tocar no :root da página', async () => {
    const r = await recursoDoQaDasPaginas({ ASSETS: assetsFalsos(), ENV_NAME: 'dev' }, URL_CSS, 'GET', CONTA);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Content-Type'), 'text/css; charset=utf-8');
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    const css = await r.text(), estilos = daWeb('/estilos.css');
    assert.ok(css.includes(cortarCssDoQa(estilos)));
    assert.ok(css.trimEnd().endsWith(CSS_QA_PAGINAS.trimEnd()), 'o das páginas no fim, para ganhar aos iguais');
    assert.equal(montarCssDoQa(estilos, 'paginas'), css);
    assert.match(css, /\.qa-pilula\{position:fixed/);
    assert.doesNotMatch(CSS_QA_PAGINAS, /:root/, 'os tokens da página ficam com ela');
    assert.match(CSS_QA_PAGINAS, /^\.qa-pilula,\.qa-sonda,\.qa-camada,\.qa-aviso\{\n {2}--bg:/m);
    assert.match(CSS_QA_PAGINAS, /@media\(prefers-color-scheme:dark\)\{\.qa-pilula,\.qa-sonda,\.qa-camada,\.qa-aviso\{/, 'e o escuro');
    assert.match(CSS_QA_PAGINAS, /\.segm>\[aria-checked="true"\]\{box-shadow:inset 0 0 0 1\.5px currentColor/, 'a gravidade escolhida na cor da frente');
    assert.doesNotMatch(semBlocosDoRato(CSS_QA_PAGINAS), /:hover/, 'o :hover só com rato');
    assert.match(CSS_QA_PAGINAS, /@media\(pointer:coarse\)\{\.qa-camada \.btn\.sm\{min-height:44px\}\}/, 'o alvo do dedo');
    assert.doesNotMatch(await (await recursoDoQa({ ASSETS: assetsFalsos(), ENV_NAME: 'dev' }, new URL('https://dev.x.pt/equipa/qa.css'), 'GET', DEV)).text(),
      /\.qa-pilula,\.qa-sonda,\.qa-camada,\.qa-aviso\{/, 'o back office não leva o das páginas');
  });

  test('as camadas novas também vão em String.raw, e uma variante que não existe não se monta', () => {
    for (const [nome, t] of [['CAMADA_DAS_PAGINAS', CAMADA_DAS_PAGINAS], ['FIM_DAS_PAGINAS', FIM_DAS_PAGINAS], ['CSS_QA_PAGINAS', CSS_QA_PAGINAS]]) {
      assert.ok(!t.includes('`'), nome + ' sem crases');
      assert.ok(!t.includes('${'), nome + ' sem ${');
    }
    const textos = Object.fromEntries(FICHEIROS_DO_QA.map((f) => [f, daWeb(f)]));
    assert.throws(() => montarGuiaoDoQa(textos, 'outra'), /variante/);
    assert.throws(() => montarGuiaoDoQa({ '/app/icones.js': 'x' }, 'paginas'), /Falta o \/app\/formato\.js para montar o \/paginas\/qa\.js/);
  });

  test('o back office continua igual: a variante por omissão é a dele', () => {
    const textos = Object.fromEntries(FICHEIROS_DO_QA.map((f) => [f, daWeb(f)]));
    const js = montarGuiaoDoQa(textos);
    assert.equal(montarGuiaoDoQa(textos, 'equipa'), js);
    assert.ok(js.includes(CAMADA_QA) && js.includes(FIM_DA_CAMADA));
    assert.doesNotMatch(js, /QA_PAGINAS =|Abriu /, 'nada das páginas');
    const estilos = daWeb('/estilos.css');
    assert.equal(montarCssDoQa(estilos, 'equipa'), montarCssDoQa(estilos));
    assert.equal(montarCssDoQa(estilos), CSS_QA_EQUIPA + '\n' + cortarCssDoQa(estilos) + '\n');
  });
});

describe('a camada das páginas no browser', () => {
  const textos = () => Object.fromEntries(FICHEIROS_DO_QA.map((f) => [f, daWeb(f)]));
  const NA_MONTRA = { dados: { ambiente: 'dev', id: 'u-1', nome: 'Maria Costa' }, elementos: true, titulo: 'Rendorium',
    location: { href: 'https://dev.x.pt/montra', pathname: '/montra', hash: '' } };

  test('o guião corre, só deixa o CW no window, e a pílula pede os tickets a /api/qa com o cookie', async () => {
    const { ctx, pedidos, opcoes } = browserFalso({}, NA_MONTRA);
    const antes = new Set(Object.keys(ctx));
    vm.runInContext(montarGuiaoDoQa(textos(), 'paginas'), ctx);
    assert.deepEqual(Object.keys(ctx).filter((k) => !antes.has(k)), ['CW']);
    assert.equal(ctx.CW.ambiente, 'dev');
    assert.deepEqual({ ...ctx.CW.user }, { id: 'u-1', name: 'Maria Costa' });
    for (const n of ['esc', 'ic', 'qaNovoTicket', 'openModal', 'api', 'toast', 'QA_PAGINAS', 'QA_EQUIPA', 'qaCaminho']) assert.equal(ctx[n], undefined, n + ' não vaza');
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(pedidos.some(([m]) => m === 'GET /api/qa'), 'a pílula apareceu e pediu os tickets: ' + JSON.stringify(pedidos));
    assert.ok(!pedidos.some(([m]) => /\/api\/equipa\//.test(m)), 'nunca as rotas da equipa');
    const o = opcoes[pedidos.findIndex(([m]) => m === 'GET /api/qa')];
    assert.equal(o.credentials, 'same-origin', 'o cookie da sessão vai');
    assert.equal(o.headers && o.headers.Authorization, undefined, 'sem Bearer: a sessão é o cookie');
    assert.ok(ctx.CW._rasto.includes('Abriu /montra'), 'a página no rasto');
    assert.ok(ctx.CW._rasto.includes('GET /api/qa → 200'), 'e o pedido');
  });

  test('o contexto de um ticket diz a página e o tema do sistema, e avisa do Samsung Internet', () => {
    const { ctx } = browserFalso({}, { titulo: 'Como declarar as rendas no IRS', location: { pathname: '/guias/declarar-rendas', hash: '' } });
    ctx.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 14) SamsungBrowser/27.0 Chrome/125';
    ctx.matchMedia = () => ({ matches: false });
    vm.runInContext('(function () {\nvar rastoPoe = function () {}, render = function () {};\n' +
      'function qaContexto() { return { ecra: { hash: "#prazos" }, ambiente: "dev" }; }\n' + FIM_DAS_PAGINAS +
      '\nwindow.contexto = qaContexto;\n})();', ctx);
    const c = JSON.parse(JSON.stringify(ctx.contexto()));
    assert.deepEqual(c.ecra, { hash: '#prazos', pagina: '/guias/declarar-rendas · Como declarar as rendas no IRS' });
    assert.deepEqual(c.tema, { escolhido: 'auto', escuro: false, forcado: 'possivel' });
    assert.equal(c.ambiente, 'dev', 'o resto do da app fica');
  });

  /* O documento e a janela de brincar, com a classe do <html>, o top do body e
     o scroll de verdade, para ver a camada travar e destravar a página.
     Recebe: b — o browserFalso; classes (opcional) — as que o <html> já tem.
     Devolve: {html, body, scrolls: os scrollTo que a camada fez}. */
  function paginaQueRola(b, classes) {
    const html = new Set(classes || []), body = { style: { top: '' } }, scrolls = [];
    const el = () => {
      const filhos = { h2: { textContent: '' }, '.body': { innerHTML: '' }, '.foot': { innerHTML: '' }, '.sheet': { focus() {} } };
      return { className: '', innerHTML: '', classList: { add() {}, remove() {}, contains: () => false }, parentNode: { removeChild() {} },
        querySelector: (q) => filhos[q.replace('.head ', '')] || null };
    };
    Object.assign(b.ctx.document.documentElement, { classList: { add: (c) => html.add(c), remove: (c) => html.delete(c), contains: (c) => html.has(c) } });
    Object.assign(b.ctx.document, { createElement: el, contains: () => false });
    Object.assign(b.ctx.document.body, { style: body.style, appendChild() {}, removeChild() {} });
    b.ctx.scrollY = 640;
    b.ctx.scrollTo = (x, y) => { scrolls.push(y); b.ctx.scrollY = y; };
    return { html, body, scrolls };
  }

  for (const [nome, camadaTexto] of [['do back office', CAMADA_QA], ['das páginas', CAMADA_DAS_PAGINAS]]) {
    test('as janelas ' + nome + ' travam o scroll da página e repõem-no ao fechar a última', () => {
      const b = browserFalso();
      const pg = paginaQueRola(b);
      vm.runInContext('(function () {\nvar ic = function () { return ""; };\n' + camadaTexto + '\nvar QA_ACOES = {};\nwindow.t = { openModal: openModal, closeModal: closeModal, closeAllModals: closeAllModals };\n})();', b.ctx);
      const t = b.ctx.t;
      assert.ok(!pg.html.has('qa-trava'), 'antes de abrir, nada travado');
      t.openModal('Novo ticket', '', '');
      assert.ok(pg.html.has('qa-trava'), 'aberta, o <html> trava');
      assert.equal(b.ctx.document.body.style.top, '-640px', 'e o body guarda o scroll de antes');
      b.ctx.scrollY = 0; // com o body fixo, o scrollY lê 0
      t.openModal('Ficha', '', '');
      assert.equal(b.ctx.document.body.style.top, '-640px', 'a segunda por cima não volta a medir o scroll');
      t.closeModal();
      assert.ok(pg.html.has('qa-trava'), 'com uma ainda aberta, continua travado');
      assert.deepEqual(pg.scrolls, []);
      t.closeModal();
      assert.ok(!pg.html.has('qa-trava'), 'fechada a última, destrava');
      assert.equal(b.ctx.document.body.style.top, '');
      assert.deepEqual(Array.from(pg.scrolls), [640], 'e repõe o scroll exato');
      t.openModal('Outra', '', ''); t.openModal('E outra', '', '');
      t.closeAllModals();
      assert.ok(!pg.html.has('qa-trava'), 'o closeAllModals também destrava');
      assert.deepEqual(Array.from(pg.scrolls), [640, 640]);
    });
  }

  test('a camada não destrava o que outra coisa travou', () => {
    const b = browserFalso();
    const pg = paginaQueRola(b, ['noscroll']);
    vm.runInContext('(function () {\nvar ic = function () { return ""; };\n' + CAMADA_QA + '\nvar QA_ACOES = {};\nwindow.t = { openModal: openModal, closeModal: closeModal };\n})();', b.ctx);
    b.ctx.t.openModal('Novo ticket', '', '');
    assert.ok(!pg.html.has('qa-trava'), 'já travado por outro: a camada não trava');
    b.ctx.t.closeModal();
    assert.ok(pg.html.has('noscroll'), 'e o que era de outro fica');
    assert.deepEqual(Array.from(pg.scrolls), [], 'sem repor scroll que não guardou');
  });

  test('o CSS da camada trava o <html> e fixa o body', () => {
    assert.match(CSS_QA_EQUIPA, /html\.qa-trava\{overflow:hidden\}/);
    assert.match(CSS_QA_EQUIPA, /html\.qa-trava body\{position:fixed;left:0;right:0;width:100%\}/);
  });

  test('os caminhos das páginas são os da app', async () => {
    const b = browserFalso({}, NA_MONTRA);
    vm.runInContext('(function () {\n' + CAMADA_DAS_PAGINAS + '\nvar QA_ACOES = {};\nwindow.t = { qaCaminho: qaCaminho, api: api };\n})();', b.ctx);
    assert.equal(b.ctx.t.qaCaminho('/api/qa/x1/reabrir'), '/api/qa/x1/reabrir');
    assert.deepEqual(await b.ctx.t.api('POST', '/api/qa', { body: 'olá' }), {});
    assert.deepEqual(b.pedidos[0], ['POST /api/qa', '{"body":"olá"}']);
    assert.equal(b.opcoes[0].credentials, 'same-origin');
  });
});
