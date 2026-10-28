// A porta do dev.rendorium.com: lá, só quem entrou por uma ligação do /test
// (uma sessão de uma conta de teste, pelo cookie ou pelo Bearer) vê alguma
// coisa — a página, os ficheiros da app, a API, a montra. Sem ela, ou com a
// sessão de uma conta normal, é um 404 seco, sem marca e sem cache. Passam
// sem sessão só a própria ligação (/t/entrar), as interações do Discord, o
// back office e o /versao.json que o deploy confirma. O percurso (ENV_NAME
// 'percurso') e a produção (sem ENV_NAME) ficam como estavam. E o que o
// wrangler.toml e o scripts/entrega.js têm de dizer para isto valer lá fora.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

import worker from '../worker/src/index.js';
import { ligacaoTeste } from '../worker/src/teste.js';
import { destroySession } from '../worker/src/auth.js';
import { ambiente, conta } from './lib/api.js';

const RAIZ = new URL('../', import.meta.url);
const ler = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const ORIGEM = 'https://dev.rendorium.com';
// o scripts/entrega.js é CommonJS
const require = createRequire(import.meta.url);

/* Os assets fingidos: servem o que está em web/, com «/» a dar o index.html,
   e contam os pedidos.
   Devolve: {pedidos, fetch}. */
function assetsFalsos() {
  const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
  const pedidos = [];
  return {
    pedidos,
    fetch: async (request) => {
      pedidos.push(request);
      const rel = new URL(request.url).pathname === '/' ? '/index.html' : new URL(request.url).pathname;
      const ficheiro = new URL('web' + rel, RAIZ);
      if (!existsSync(ficheiro) || statSync(ficheiro).isDirectory()) return new Response('não há', { status: 404 });
      return new Response(readFileSync(ficheiro), { status: 200, headers: {
        'Content-Type': tipos[rel.slice(rel.lastIndexOf('.'))] || 'application/octet-stream',
        ETag: '"e-' + rel.length + '"',
      } });
    },
  };
}

/* O ambiente do dev publicado: ENV_NAME 'dev', a porta fechada (a variável
   do [env.dev.vars]), a chave das ligações do /test e os assets.
   Recebe: extra (opcional) — o que se troca.
   Devolve: o env. */
const dev = (extra) => ambiente(Object.assign(
  { ENV_NAME: 'dev', PORTA_DEV: 'fechada', TESTE_CHAVE: 'chave-das-ligacoes', ASSETS: assetsFalsos() }, extra || {}));

/* Um pedido ao worker inteiro, como chega da Cloudflare.
   Recebe: env; caminho; o (opcional) — {method, headers, body}.
   Devolve: a promessa da Response. */
async function pedirAoWorker(env, caminho, o) {
  const op = o || {};
  const fundo = [];
  const r = await worker.fetch(new Request(ORIGEM + caminho, { method: op.method || 'GET', headers: op.headers || {}, body: op.body }),
    env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
  return r;
}

/* Entra como um browser entra: abre a ligação do /test pelo worker e fica
   com o cookie que ela deixa.
   Recebe: env.
   Devolve: a promessa de {cookie, token, resposta}. */
async function entrarPeloTeste(env) {
  const lig = await ligacaoTeste(env, ORIGEM, false);
  const r = await pedirAoWorker(env, new URL(lig).pathname + new URL(lig).search);
  const m = /gi_session=([a-f0-9]{64})/.exec(r.headers.get('Set-Cookie') || '');
  return { resposta: r, token: m && m[1], cookie: m ? 'gi_session=' + m[1] : '' };
}

/* Confere que a resposta é o 404 seco da porta: curto, sem marca, sem
   cache, vestido pelo harden.
   Recebe: r — a Response; onde — para a mensagem.
   Devolve: a promessa de nada. */
async function e404Seco(r, onde) {
  assert.equal(r.status, 404, onde + ' devia dar 404');
  const corpo = await r.text();
  assert.ok(corpo.length < 40, onde + ': o corpo é curto (' + corpo.length + ')');
  assert.doesNotMatch(corpo, /rendorium|teste|dev/i, onde + ': o corpo não diz de quem é');
  assert.equal(r.headers.get('Cache-Control'), 'no-store', onde + ': não fica em cache nenhuma');
  assert.match(r.headers.get('Content-Security-Policy') || '', /default-src 'self'/, onde + ': passou pelo harden');
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff', onde);
  assert.equal(r.headers.get('Set-Cookie'), null, onde + ': não mexe em cookies');
}

// o que a porta fecha a quem não traz sessão de teste
const FECHADOS = [
  ['GET', '/'], ['HEAD', '/'], ['GET', '/?entrar=' + 'a'.repeat(64)], ['GET', '/index.html'],
  ['GET', '/cloud/nucleo.js'], ['GET', '/app/dados.js'], ['GET', '/sw.js'], ['GET', '/avisos.js'],
  ['GET', '/estilos.css'], ['GET', '/manifest.webmanifest'], ['GET', '/icon-192-dev.png'],
  ['GET', '/api/me'], ['POST', '/api/auth/register'], ['POST', '/api/auth/login'], ['POST', '/api/auth/google'],
  ['GET', '/api/qa'], ['POST', '/api/qa'], ['GET', '/montra'], ['GET', '/termos'], ['GET', '/privacidade'],
  ['GET', '/paginas/landing.css'], ['GET', '/nao-existe'],
  // os caminhos estranhos à volta das exceções
  ['POST', '/t/entrar'], ['HEAD', '/t/entrar'], ['GET', '/t/entrar/'], ['GET', '/T/entrar'],
  ['GET', '/api/discord'], ['PUT', '/api/discord'], ['GET', '/equipaX'], ['GET', '/EQUIPA'], ['GET', '/equipa.js'],
  ['GET', '/api/equipa'], ['GET', '/api/equipaX/y'], ['GET', '/equipa/%2e%2e/cloud/nucleo.js'],
  ['POST', '/versao.json'], ['GET', '//cloud/nucleo.js'],
];

const corpoDoMetodo = (metodo) => (metodo === 'POST' || metodo === 'PUT' ? '{}' : undefined);
const json = { 'Content-Type': 'application/json' };

describe('no dev, sem sessão de teste', () => {
  test('sem sessão nenhuma, tudo o que é da app dá o 404 seco', async () => {
    const env = dev();
    for (const [method, caminho] of FECHADOS) {
      await e404Seco(await pedirAoWorker(env, caminho, { method, headers: json, body: corpoDoMetodo(method) }), method + ' ' + caminho);
    }
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first()).n, 0, 'nem o registo criou conta');
  });

  test('com a sessão de uma conta normal, pelo cookie ou pelo Bearer, também', async () => {
    const env = dev();
    const maria = await conta(env, 'Maria Costa');
    for (const h of [{ Cookie: 'gi_session=' + maria.token }, { Authorization: 'Bearer ' + maria.token }]) {
      for (const [method, caminho] of [['GET', '/'], ['GET', '/cloud/nucleo.js'], ['GET', '/api/me'], ['GET', '/api/qa'], ['GET', '/montra']]) {
        await e404Seco(await pedirAoWorker(env, caminho, { method, headers: h }), Object.keys(h)[0] + ' normal ' + caminho);
      }
    }
  });

  test('uma sessão terminada, um token que nunca existiu e um cookie mal feito não abrem nada', async () => {
    const env = dev();
    const { token } = await entrarPeloTeste(env);
    await destroySession(env, token);
    for (const cookie of ['gi_session=' + token, 'gi_session=' + 'f'.repeat(64), 'gi_session=xyz', 'gi_session=' + 'A'.repeat(64)]) {
      await e404Seco(await pedirAoWorker(env, '/', { headers: { Cookie: cookie } }), cookie.slice(0, 20));
    }
    await e404Seco(await pedirAoWorker(env, '/api/me', { headers: { Authorization: 'Bearer ' + token } }), 'Bearer terminado');
  });

  test('o Bearer de uma conta normal manda sobre o cookie de teste, como na API: 404', async () => {
    const env = dev();
    const { cookie } = await entrarPeloTeste(env);
    const maria = await conta(env, 'Maria Costa');
    await e404Seco(await pedirAoWorker(env, '/api/me', { headers: { Cookie: cookie, Authorization: 'Bearer ' + maria.token } }), 'Bearer normal');
  });
});

describe('no dev, o que passa sem sessão', () => {
  test('a ligação do /test entra e deixa o cookie; uma ligação estragada dá a página dela, não o 404', async () => {
    const env = dev();
    const { resposta, token } = await entrarPeloTeste(env);
    assert.equal(resposta.status, 302);
    assert.match(resposta.headers.get('Location'), /^\/\?entrar=[a-f0-9]{64}$/);
    assert.ok(token, 'com o cookie da sessão');
    const coxa = await pedirAoWorker(env, '/t/entrar');
    assert.equal(coxa.status, 400, 'sem os parâmetros é a página «Ligação inválida»');
    assert.match(await coxa.text(), /Ligação inválida/);
    // e o que essa página pede
    for (const c of ['/paginas/teste.css', '/fonts/geist.woff2', '/fonts/bricolage-grotesque.woff2', '/icon-192.png']) {
      assert.equal((await pedirAoWorker(env, c)).status, 200, c);
    }
  });

  test('as interações do Discord chegam ao verificador da assinatura', async () => {
    const env = dev();
    const r = await pedirAoWorker(env, '/api/discord', { method: 'POST', headers: json, body: '{"type":1}' });
    assert.equal(r.status, 401, 'sem assinatura é o 401 do discord.js, não o 404 da porta');
    assert.equal(await r.text(), 'assinatura inválida');
  });

  test('o back office fica como está: a entrada da equipa, os recursos dela e a API dela', async () => {
    const env = dev();
    // sem sessão de equipa, o ecrã de entrada pelo Discord (com o 401 de sempre)
    const pagina = await pedirAoWorker(env, '/equipa');
    assert.equal(pagina.status, 401);
    assert.match(await pagina.text(), /<html/);
    assert.match(await (await pedirAoWorker(env, '/equipa/')).text(), /<html/);
    assert.equal((await pedirAoWorker(env, '/equipa/estilos.css')).status, 200);
    assert.equal((await pedirAoWorker(env, '/equipa/guiao.js')).status, 401, 'o guião continua a pedir a sessão de equipa');
    assert.equal((await pedirAoWorker(env, '/api/equipa/eu')).status, 401, 'a API da equipa responde com o 401 dela');
  });

  test('o /versao.json que o deploy confirma, em GET e HEAD', async () => {
    const env = dev();
    const v = await pedirAoWorker(env, '/versao.json?publicacao=1');
    assert.equal(v.status, 200);
    assert.deepEqual(JSON.parse(await v.text()), JSON.parse(ler('web/versao.json')));
    assert.equal((await pedirAoWorker(env, '/versao.json', { method: 'HEAD' })).status, 200);
  });
});

describe('no dev, com a sessão de uma conta de teste', () => {
  test('pelo cookie da ligação, abre tudo como hoje: a página, os ficheiros, a API, o QA e a montra', async () => {
    const env = dev();
    const { cookie } = await entrarPeloTeste(env);
    const h = { Cookie: cookie };
    const pagina = await pedirAoWorker(env, '/?entrar=x', { headers: h });
    assert.equal(pagina.status, 200);
    assert.match(await pagina.text(), /Rendorium DEV/, 'com a identidade de dev, como antes');
    for (const c of ['/cloud/nucleo.js', '/app/dados.js', '/sw.js', '/estilos.css', '/manifest.webmanifest', '/montra', '/termos']) {
      assert.equal((await pedirAoWorker(env, c, { headers: h })).status, 200, c);
    }
    assert.equal((await pedirAoWorker(env, '/', { method: 'HEAD', headers: h })).status, 200, 'HEAD');
    const eu = await pedirAoWorker(env, '/api/me', { headers: h });
    assert.equal(eu.status, 200);
    assert.match((await eu.json()).email, /@teste\.rendorium\.com$/);
    assert.notEqual((await pedirAoWorker(env, '/api/qa', { headers: h })).status, 404, 'as rotas do QA');
    assert.equal((await pedirAoWorker(env, '/nao-existe.txt', { headers: h })).status, 404, 'o que não existe continua a não existir');
  });

  test('pelo Bearer também', async () => {
    const env = dev();
    const { token } = await entrarPeloTeste(env);
    assert.equal((await pedirAoWorker(env, '/api/me', { headers: { Authorization: 'Bearer ' + token } })).status, 200);
    assert.equal((await pedirAoWorker(env, '/cloud/nucleo.js', { headers: { Authorization: 'Bearer ' + token } })).status, 200);
  });

  test('a sessão confere-se uma vez e fica lembrada uns segundos: os ficheiros de um carregamento não pagam uma leitura cada', async () => {
    const env = dev();
    const { cookie } = await entrarPeloTeste(env);
    const get = env.SESSIONS.get.bind(env.SESSIONS);
    let leituras = 0;
    env.SESSIONS.get = (k) => { if (String(k).startsWith('sess:')) leituras++; return get(k); };
    for (const c of ['/', '/estilos.css', '/cloud/nucleo.js', '/app/dados.js', '/avisos.js']) {
      assert.equal((await pedirAoWorker(env, c, { headers: { Cookie: cookie } })).status, 200, c);
    }
    assert.equal(leituras, 1, 'uma leitura do KV para os cinco');
  });

  test('as sessões de uma conta de teste terminadas pela época (o back office termina-as assim) deixam de abrir', async () => {
    const env = dev();
    const { cookie } = await entrarPeloTeste(env);
    const sem = dev();   // outro ambiente: sem a memória do anterior
    Object.assign(sem, { DB: env.DB, SESSIONS: env.SESSIONS });
    await env.DB.prepare('UPDATE users SET sess_epoch = sess_epoch + 1').run();
    await e404Seco(await pedirAoWorker(sem, '/', { headers: { Cookie: cookie } }), 'época rodada');
  });
});

describe('fora do dev publicado, nada muda', () => {
  test('o percurso (ENV_NAME percurso) e a produção (sem ENV_NAME) abrem sem sessão, mesmo com a variável da porta', async () => {
    for (const extra of [{ ENV_NAME: 'percurso' }, { ENV_NAME: undefined }, { ENV_NAME: 'teste' }]) {
      const env = dev(extra);
      const nome = String(extra.ENV_NAME);
      assert.equal((await pedirAoWorker(env, '/')).status, 200, nome + ': a página');
      assert.equal((await pedirAoWorker(env, '/cloud/nucleo.js')).status, 200, nome + ': os ficheiros');
      assert.equal((await pedirAoWorker(env, '/api/me')).status, 401, nome + ': a API responde com o 401 dela');
      const reg = await pedirAoWorker(env, '/api/auth/register', { method: 'POST', headers: json, body: '{}' });
      assert.notEqual(reg.status, 404, nome + ': o criar conta existe');
    }
  });

  test('o dev sem a variável da porta fica aberto (é ela que a fecha, e só com ENV_NAME dev)', async () => {
    const env = dev({ PORTA_DEV: undefined });
    assert.equal((await pedirAoWorker(env, '/')).status, 200);
  });
});

describe('a regra, sozinha', () => {
  test('passaNaPorta: só o dev com a porta fechada pede sessão de teste, e só fora das exceções', async () => {
    const { passaNaPorta } = await import('../worker/src/teste.js');
    // o dev publicado, com o que se trocar por cima
    const p = (caminho, metodo, sessaoDeTeste, troca) =>
      passaNaPorta(Object.assign({ caminho, metodo, envName: 'dev', porta: 'fechada', sessaoDeTeste }, troca));
    assert.equal(p('/', 'GET', false), false);
    assert.equal(p('/', 'GET', true), true);
    assert.equal(p('/api/me', 'POST', true), true);
    assert.equal(p('/', 'GET', false, { envName: 'percurso' }), true, 'o percurso');
    assert.equal(p('/', 'GET', false, { envName: undefined }), true, 'a produção');
    assert.equal(p('/', 'GET', false, { porta: undefined }), true, 'o dev sem a variável');
    assert.equal(p('/', 'GET', false, { porta: 'aberta' }), true, 'só o valor exato fecha');
    for (const [c, m] of [['/t/entrar', 'GET'], ['/api/discord', 'POST'], ['/equipa', 'GET'], ['/equipa/', 'GET'],
      ['/equipa/entrar', 'GET'], ['/equipa/x', 'POST'], ['/api/equipa/eu', 'GET'], ['/api/equipa/qa/1', 'DELETE'],
      ['/versao.json', 'GET'], ['/versao.json', 'HEAD'], ['/paginas/teste.css', 'GET'], ['/fonts/geist.woff2', 'GET'],
      ['/fonts/bricolage-grotesque.woff2', 'HEAD'], ['/icon-192.png', 'GET']]) {
      assert.equal(p(c, m, false), true, m + ' ' + c);
    }
    for (const [c, m] of [['/t/entrar', 'POST'], ['/api/discord', 'GET'], ['/equipaX', 'GET'], ['/api/equipa', 'GET'],
      ['/versao.json', 'POST'], ['/paginas/teste.css', 'POST'], ['/fonts/outra.woff2', 'GET'], ['/paginas/landing.css', 'GET'],
      ['/icon-512.png', 'GET'], ['/API/me', 'GET']]) {
      assert.equal(p(c, m, false), false, m + ' ' + c);
    }
  });
});

/* As regras do run_worker_first com o sentido que a Cloudflare lhes dá: o
   «*» apanha qualquer coisa (barras incluídas), o resto é literal.
   Recebe: regra — texto. Devolve: a RegExp. */
const regraEmRegExp = (regra) => new RegExp('^' + regra.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');

/* Os ficheiros de web/ como os assets os servem (pastas incluídas).
   Recebe: dir — a pasta relativa, com barra no fim. Devolve: os caminhos. */
function caminhosDosAssets(dir = '') {
  const out = [];
  for (const n of readdirSync(new URL('web/' + dir, RAIZ))) {
    if (n.startsWith('_') || n.startsWith('.')) continue;   // _headers e afins não se servem
    if (statSync(new URL('web/' + dir + n, RAIZ)).isDirectory()) out.push(...caminhosDosAssets(dir + n + '/'));
    else out.push('/' + dir + n);
  }
  return out;
}

describe('o wrangler.toml e o deploy', () => {
  const w = ler('wrangler.toml');
  const blocoDev = w.slice(w.indexOf('[env.dev]'));
  const regrasDev = JSON.parse(/\[env\.dev\.assets\][\s\S]*?run_worker_first = (\[[^\]]*\])/.exec(w)[1]);

  test('a porta fecha-se no [env.dev.vars] e em mais lado nenhum', () => {
    const varsDev = blocoDev.slice(blocoDev.indexOf('[env.dev.vars]'));
    assert.match(varsDev, /\nPORTA_DEV = "fechada"/);
    assert.equal((w.match(/PORTA_DEV = /g) || []).length, 1, 'nem no [vars] da produção');
  });

  test('no dev, todos os ficheiros de web/ passam pelo worker; em produção só o «/» e o manifesto', () => {
    const regras = regrasDev.map(regraEmRegExp);
    const caminhos = caminhosDosAssets();
    assert.ok(caminhos.length > 50, 'leu os assets');
    // o tratamento de HTML dos assets responde também sem a extensão e sem o index.html
    const html = caminhos.filter((c) => c.endsWith('.html')).flatMap((c) => [c.slice(0, -5), c.replace(/index\.html$/, '')]);
    // e o que só existe depois do deploy: o que ele copia para web/ e o .gitignore deixa de fora (o APK)
    const doDeploy = [...ler('.github/workflows/deploy.yml').matchAll(/\.\.\/web\/([\w./-]+)/g)].map((m) => '/' + m[1])
      .concat(ler('.gitignore').split(/\r?\n/).filter((l) => l.startsWith('web/')).map((l) => l.slice(3).trim()));
    assert.ok(doDeploy.includes('/gestor-imobiliario.apk'), 'o APK que o deploy põe em web/');
    for (const c of caminhos.concat(html, doDeploy, ['/'])) {
      assert.ok(regras.some((r) => r.test(c)), c + ' passa pelo worker no dev');
    }
    const prod = JSON.parse(/\[assets\][\s\S]*?run_worker_first = (\[[^\]]*\])/.exec(w)[1]);
    assert.deepEqual(prod, ['/', '/manifest.webmanifest']);
  });

  test('e o wrangler aceita as regras do dev: sem repetidas, sem nenhuma que torne outra redundante, até 100', () => {
    assert.ok(regrasDev.length <= 100);
    assert.equal(new Set(regrasDev).size, regrasDev.length, 'sem repetidas');
    for (const r of regrasDev) {
      assert.ok(r.startsWith('/'), r);
      if (r.endsWith('*')) {
        regrasDev.filter((o) => o !== r).forEach((o) => assert.ok(!o.startsWith(r.slice(0, -1)), r + ' torna ' + o + ' redundante'));
      }
    }
  });

  test('a confirmação da publicação: no dev a raiz tem de dar o 404 da porta; em produção continua a ter de dar 200', async () => {
    const { classificar, raizFechada, confirmarPublicacao } = require('../scripts/entrega.js');
    const esperado = { versao: 9, minima: 9, data: '2026-10-28' };
    const v = (raizStatus) => ({ versaoStatus: 200, versao: esperado, raizStatus });
    assert.equal(raizFechada('https://dev.rendorium.com'), true);
    assert.equal(raizFechada('https://dev.rendorium.com/'), true);
    assert.equal(raizFechada('https://gestor-imobiliario-dev.martinhos.workers.dev'), true);
    assert.equal(raizFechada('https://app.rendorium.com'), false);
    assert.equal(raizFechada('http://127.0.0.1:8788'), false);
    assert.equal(classificar(v(404), esperado, true), 'ok');
    assert.equal(classificar(v(200), esperado, true), 'porta-aberta');
    assert.equal(classificar(v(503), esperado, true), 'avaria');
    assert.equal(classificar(v(200), esperado, false), 'ok');
    assert.equal(classificar(v(404), esperado, false), 'sem-resposta');
    assert.equal(classificar(v(404), esperado), 'sem-resposta', 'sem dizer, é como em produção');
    const pedidos = [];
    const r = await confirmarPublicacao({
      base: 'https://dev.rendorium.com', esperado, raizFechada: true, tentativas: 1, intervalo: 0,
      dormir: async () => {}, escrever: () => {},
      pedir: async (url) => { pedidos.push(url); return url.includes('/versao.json') ? { status: 200, texto: JSON.stringify(esperado) } : { status: 404, texto: 'Não encontrado' }; },
    });
    assert.equal(r.veredicto, 'ok');
    assert.equal(pedidos.length, 2);
  });
});
