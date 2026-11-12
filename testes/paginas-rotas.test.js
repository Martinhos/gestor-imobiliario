// As rotas das páginas públicas no index.js: o robots.txt e o sitemap.xml
// (na raiz abrem a montra e o guia aos motores de busca; fora dela fecham
// tudo), e a pílula do QA na montra e no guia — só fora de produção, só com
// a sessão de uma conta, com o /paginas/qa.js e o /paginas/qa.css servidos
// pela mesma regra (equipa-qa.js:pilulaDasPaginas, recursoDoQaDasPaginas).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import worker from '../worker/src/index.js';
import { ambiente, conta } from './lib/api.js';

// os ficheiros estáticos do worker, lidos de web/ como o env.ASSETS os serviria
const ASSETS = {
  fetch: async (req) => {
    const p = new URL(typeof req === 'string' ? req : req.url).pathname;
    try { return new Response(readFileSync('web' + p, 'utf8'), { status: 200 }); } catch { return new Response('', { status: 404 }); }
  },
};

/* Um pedido ao worker inteiro, como a Cloudflare o faz.
   Recebe: env; url — o endereço inteiro; token (opcional) — a sessão da
   conta, no cookie gi_session.
   Devolve: promessa da Response. */
async function pedirPaginaPublica(env, url, token) {
  const headers = token ? { Cookie: 'gi_session=' + token } : {};
  const fundo = [];
  const r = await worker.fetch(new Request(url, { headers }), env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
  return r;
}

describe('o robots.txt e o sitemap.xml', () => {
  test('na raiz o robots deixa entrar e aponta o sitemap, que tem a montra e o guia', async () => {
    const env = ambiente({ ASSETS, ENV_NAME: undefined });
    const r = await pedirPaginaPublica(env, 'https://rendorium.com/robots.txt');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('Content-Type'), /^text\/plain/);
    const t = await r.text();
    assert.match(t, /Sitemap: https:\/\/rendorium\.com\/sitemap\.xml/);
    assert.doesNotMatch(t, /Disallow: \/\s*$/m);
    const s = await pedirPaginaPublica(env, 'https://rendorium.com/sitemap.xml');
    assert.equal(s.status, 200);
    assert.match(s.headers.get('Content-Type'), /xml/);
    const x = await s.text();
    assert.match(x, /<loc>https:\/\/rendorium\.com\/<\/loc>/);
    assert.match(x, /<loc>https:\/\/rendorium\.com\/guias\/declarar-rendas<\/loc>/);
  });

  test('fora da raiz (a app, o dev) o robots fecha tudo, e nenhum dos dois é reencaminhado para a app', async () => {
    const env = ambiente({ ASSETS });
    const r = await pedirPaginaPublica(env, 'https://dev.x.pt/robots.txt');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Disallow: \/\s*$/m);
    const naRaiz = await pedirPaginaPublica(ambiente({ ASSETS, ENV_NAME: undefined }), 'https://www.rendorium.com/robots.txt');
    assert.equal(naRaiz.status, 200, 'o www também responde, sem o 302 para a app');
  });
});

describe('a pílula do QA nas páginas públicas', () => {
  for (const [nome, caminho] of [['a montra', '/montra'], ['o guia', '/guias/declarar-rendas']]) {
    test(nome + ' traz a pílula só com conta e fora de produção', async () => {
      const env = ambiente({ ASSETS });
      const eu = await conta(env, 'Maria Costa');
      const com = await (await pedirPaginaPublica(env, 'https://dev.x.pt' + caminho, eu.token)).text();
      assert.match(com, /<script src="\/paginas\/qa\.js"><\/script>\s*<\/body>/, 'com conta, o guião da pílula antes do </body>');
      assert.match(com, /<script type="application\/json" id="dados-qa">[^<]*"id":"U\d+"/, 'com os dados da conta da sessão');
      const sem = await (await pedirPaginaPublica(env, 'https://dev.x.pt' + caminho)).text();
      assert.doesNotMatch(sem, /\/paginas\/qa\.js|dados-qa/, 'sem conta, nada');
      const prod = ambiente({ ASSETS, ENV_NAME: undefined, DB: env.DB, SESSIONS: env.SESSIONS });
      const emProducao = await (await pedirPaginaPublica(prod, 'https://app.x.pt' + caminho, eu.token)).text();
      assert.doesNotMatch(emProducao, /\/paginas\/qa\.js|dados-qa/, 'em produção, nada, mesmo com conta');
    });
  }

  test('a montra da raiz nunca leva a pílula', async () => {
    const env = ambiente({ ASSETS, ENV_NAME: undefined });
    const eu = await conta(env, 'Maria Costa');
    const html = await (await pedirPaginaPublica(env, 'https://rendorium.com/', eu.token)).text();
    assert.doesNotMatch(html, /\/paginas\/qa\.js|dados-qa/);
  });

  test('o /paginas/qa.js e o /paginas/qa.css: 200 com conta, 401 sem ela, 404 em produção', async () => {
    const env = ambiente({ ASSETS });
    const eu = await conta(env, 'Maria Costa');
    const js = await pedirPaginaPublica(env, 'https://dev.x.pt/paginas/qa.js', eu.token);
    assert.equal(js.status, 200);
    assert.match(js.headers.get('Content-Type'), /javascript/);
    const css = await pedirPaginaPublica(env, 'https://dev.x.pt/paginas/qa.css', eu.token);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('Content-Type'), /text\/css/);
    assert.equal((await pedirPaginaPublica(env, 'https://dev.x.pt/paginas/qa.js')).status, 401);
    const prod = ambiente({ ASSETS, ENV_NAME: undefined, DB: env.DB, SESSIONS: env.SESSIONS });
    assert.equal((await pedirPaginaPublica(prod, 'https://app.x.pt/paginas/qa.js', eu.token)).status, 404);
  });
});
