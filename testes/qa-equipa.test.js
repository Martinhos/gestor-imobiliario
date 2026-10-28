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
// camada não tem crases nem cifrão com chaveta (vai num String.raw).

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
    assert.match(dev, /<script src="\/equipa\/guiao\.js"><\/script>\s*<script type="application\/json" id="dados-qa">[^<]+<\/script>\s*<script src="\/equipa\/qa\.js"><\/script>/,
      'depois do guião');
    const dados = JSON.parse(/id="dados-qa">([^<]+)</.exec(dev)[1]);
    assert.deepEqual(dados, { ambiente: 'dev', id: 'equipa:d1', nome: 'Dina' });
    for (const prod of [await paginaEquipa(DEV).text(), await paginaEquipa(DEV, { qa: '' }).text()]) {
      assert.doesNotMatch(prod, /qa\.js|qa\.css|dados-qa/);
    }
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
   Recebe: respostas — {'MÉTODO /caminho': {status, corpo}}.
   Devolve: {ctx, ouvintes, pedidos}. */
function browserFalso(respostas = {}) {
  const ouvintes = {}, pedidos = [];
  const dados = JSON.stringify({ ambiente: 'dev', id: 'equipa:d1', nome: 'Dina' });
  const document = {
    getElementById: (id) => (id === 'dados-qa' ? { textContent: dados } : null),
    addEventListener: (tipo, fn) => { (ouvintes[tipo] = ouvintes[tipo] || []).push(fn); },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, setAttribute() {}, appendChild() {}, style: {} }),
    body: { appendChild() {}, classList: { contains: () => false } },
    documentElement: { clientWidth: 1200, classList: { contains: () => false } },
    contains: () => false,
    activeElement: null,
  };
  const ctx = {
    document, console, URL, JSON, Promise, setTimeout, clearTimeout, Error, Object, Array, String, Number, Math, Date, RegExp,
    location: { href: 'https://dev.x.pt/equipa', hash: '' },
    navigator: { userAgent: 'teste' },
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1,
    addEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: () => '.2s', position: 'static' }),
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame() {},
    fetch: async (url, o) => {
      const m = ((o && o.method) || 'GET') + ' ' + url;
      pedidos.push([m, o && o.body]);
      const r = respostas[m] || { status: 200, corpo: {} };
      return new Response(JSON.stringify(r.corpo), { status: r.status });
    },
  };
  ctx.window = ctx;
  return { ctx: vm.createContext(ctx), ouvintes, pedidos };
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
