// O service worker a correr de verdade: o web/sw.js num contexto de vm, com
// uma cache e um fetch de faz-de-conta que se portam como os do browser e do
// Cloudflare. Os testes do avisos.test.js leem-lhe o texto; este corre-o,
// porque a avaria de setembro não estava no texto — estava no que o browser
// recebia. O /index.html responde com um 307 para «/», o addAll guardava a
// resposta marcada como redirecionada, e o browser recusa uma resposta assim
// numa navegação: «Não é possível aceder a este site», para toda a gente que
// já tinha o worker instalado.
//
// Controlo negativo (à mão, contra um sw.js antigo):
//   SW_FONTE=caminho/para/sw-antigo.js node --test testes/sw.test.js

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ler = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const FONTE = process.env.SW_FONTE ? fs.readFileSync(process.env.SW_FONTE, 'utf8') : ler('web/sw.js');
const ORIGEM = 'https://app.rendorium.com';
const DOCUMENTO = '<!doctype html><title>Rendorium</title>';

/* Uma Response de verdade com as marcas que o browser lhe poria.
   Recebe: corpo — o texto; o — {redirected, type, status} (opcional).
   Devolve: a Response. */
function resposta(corpo, o = {}) {
  const r = new Response(corpo, { status: o.status || 200, headers: { 'content-type': 'text/plain' } });
  if (o.redirected) Object.defineProperty(r, 'redirected', { value: true });
  Object.defineProperty(r, 'type', { value: o.type || 'basic' });
  return r;
}

/* O Cloudflare de faz-de-conta: o /index.html chega redirecionado (o 307 para
   «/», já seguido, como o addAll o segue), o «/» responde direto, e o resto
   devolve o próprio caminho como corpo.
   Recebe: pedido — um caminho, um URL, ou um objeto com url.
   Devolve: promessa da Response. */
async function rede(pedido) {
  const url = new URL(typeof pedido === 'string' ? pedido : pedido.url, ORIGEM);
  if (url.pathname === '/index.html') return resposta(DOCUMENTO, { redirected: true });
  if (url.pathname === '/') return resposta(DOCUMENTO);
  return resposta('/* ' + url.pathname + ' */');
}

/* Carrega o worker num contexto novo, com caches, fetch, self e importScripts.
   Recebe: nada.
   Devolve: {evento, caches, versao} — evento(tipo, extra) dispara um evento e
   espera por ele; caches é o Map nome → Map(url → entrada). */
function arrancar() {
  const caches = new Map();
  const ouvintes = {};
  const norm = (k) => (typeof k === 'string' ? new URL(k, ORIGEM).href : k.url);
  const guardar = async (m, k, r) => {
    m.set(norm(k), { corpo: await r.text(), o: { redirected: r.redirected, type: r.type, status: r.status } });
  };
  const api = {
    async open(nome) {
      if (!caches.has(nome)) caches.set(nome, new Map());
      const m = caches.get(nome);
      return {
        keys: async () => [...m.keys()],
        match: async (k) => { const e = m.get(norm(k)); return e ? resposta(e.corpo, e.o) : undefined; },
        put: (k, r) => guardar(m, k, r),
        /* como o do browser: segue os redirecionamentos e guarda o que vier, com a marca */
        addAll: async (lista) => { for (const p of lista) await guardar(m, p, await rede(p)); },
      };
    },
    keys: async () => [...caches.keys()],
    delete: async (n) => caches.delete(n),
  };
  const ctx = vm.createContext({
    self: {
      location: new URL(ORIGEM + '/sw.js'),
      addEventListener: (t, f) => { ouvintes[t] = f; },
      skipWaiting() {},
      clients: { claim: async () => {} },
    },
    caches: api, fetch: rede, Response, URL, console,
  });
  ctx.importScripts = (p) => vm.runInContext(ler('web' + p), ctx, { filename: p });
  vm.runInContext(FONTE, ctx, { filename: 'sw.js' });

  /* Dispara um evento como o browser: junta os waitUntil e o respondWith.
     Recebe: tipo — 'install', 'activate' ou 'fetch'; extra — o que o evento leva.
     Devolve: promessa da resposta (no fetch), ou undefined. */
  async function evento(tipo, extra) {
    const esperas = [];
    let dada;
    const e = Object.assign({ waitUntil: (p) => esperas.push(p), respondWith: (p) => { dada = p; } }, extra);
    ouvintes[tipo](e);
    const r = dada ? await dada : undefined;
    await Promise.all(esperas);
    return r;
  }
  return { evento, caches, versao: vm.runInContext('VERSAO', ctx) };
}

const navegar = (url) => ({ request: { url: ORIGEM + url, method: 'GET', mode: 'navigate' } });

describe('o service worker de produção, a correr', () => {
  test('com o worker instalado, uma navegação recebe o documento, e não uma resposta redirecionada', async () => {
    const sw = arrancar();
    await sw.evento('install');
    await sw.evento('activate');
    for (const url of ['/', '/?convite=abc', '/?criar=1']) {
      const r = await sw.evento('fetch', navegar(url));
      assert.ok(r, 'o worker responde a ' + url);
      assert.equal(r.redirected, false, url + ': o browser recusa uma resposta redirecionada numa navegação');
      assert.equal(r.status, 200);
      assert.equal(await r.text(), DOCUMENTO, url + ': é o documento da app');
    }
  });

  test('a shell guarda a raiz, e não o /index.html que redireciona', async () => {
    const sw = arrancar();
    await sw.evento('install');
    const shell = sw.caches.get('gi-shell-v' + sw.versao);
    assert.ok(shell && shell.size > 10, 'o install encheu a cache desta versão');
    assert.ok(shell.has(ORIGEM + '/'), 'a raiz está lá');
    assert.ok(!shell.has(ORIGEM + '/index.html'), 'o /index.html não');
    const redirecionadas = [...shell].filter(([, e]) => e.o.redirected).map(([k]) => k);
    assert.deepEqual(redirecionadas, [], 'nada do que ficou guardado vem redirecionado');
  });

  test('uma cache que já tenha uma resposta redirecionada na chave da navegação serve-a sem a marca', async () => {
    const sw = arrancar();
    const nome = 'gi-shell-v' + sw.versao;
    sw.caches.set(nome, new Map([[ORIGEM + '/', { corpo: DOCUMENTO, o: { redirected: true, type: 'basic', status: 200 } }]]));
    await sw.evento('install');            // com conteúdo, não enche por cima
    const r = await sw.evento('fetch', navegar('/'));
    assert.equal(r.redirected, false, 'refeita sem a marca');
    assert.equal(r.status, 200);
    assert.equal(await r.text(), DOCUMENTO, 'com o mesmo corpo');
  });

  test('os scripts da shell continuam a vir da cache desta versão', async () => {
    const sw = arrancar();
    await sw.evento('install');
    const r = await sw.evento('fetch', { request: { url: ORIGEM + '/app/dados.js', method: 'GET', mode: 'no-cors' } });
    assert.equal(await r.text(), '/* /app/dados.js */');
  });
});
