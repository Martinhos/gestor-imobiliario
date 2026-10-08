// A PWA de dev identifica-se como dev: fora de produção o worker reescreve o
// manifesto e a página «/» com «Rendorium DEV» e os ícones âmbar
// (worker/src/lib/identidade.js); em produção não muda um byte. Os ícones de
// dev existem, são o que o scripts/make-icons.js desenha, e diferem dos de
// produção. O cartão das Definições diz, em dev, que o APK é o de
// desenvolvimento. É isto que deixa ter as duas apps instaladas ao lado uma
// da outra sem as confundir.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { inflateSync } from 'node:zlib';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import worker from '../worker/src/index.js';
import { manifestoDeDev, paginaDeDev, identidadeDeDev, etiquetaDeDev, trazEtiqueta, NOME_DEV, CAMINHOS_DE_IDENTIDADE } from '../worker/src/lib/identidade.js';
import { ambiente } from './lib/api.js';

const require = createRequire(import.meta.url);
const { makeIcon, ICONES } = require('../scripts/make-icons.js');

const RAIZ = new URL('../', import.meta.url);
// Recebe: p — caminho relativo à raiz. Devolve: o texto do ficheiro, tal e qual.
const ler = (p) => readFileSync(new URL(p, RAIZ), 'utf8');
// Recebe: p — caminho relativo à raiz. Devolve: os bytes do ficheiro.
const bytes = (p) => readFileSync(new URL(p, RAIZ));

const INDEX = ler('web/index.html');
const MANIFESTO = ler('web/manifest.webmanifest');

// Recebe: p — caminho relativo à raiz. Devolve: a etiqueta que o assetsFalsos põe a esse ficheiro.
const etiquetaDe = (p) => '"' + createHash('sha256').update(bytes(p)).digest('hex').slice(0, 16) + '"';

/* Os assets como a Cloudflare os serve: os ficheiros de web/ pelo caminho,
   com um tipo e uma etiqueta, 404 para o que não existe — e 304 sem corpo a
   quem traz a etiqueta certa no If-None-Match, que é o que a Cloudflare faz e
   o que deixava a PWA de dev com a cara de produção.
   Devolve: um objeto com fetch(request), como o binding ASSETS, e a lista
   `pedidos` dos Request que recebeu, pela ordem. */
function assetsFalsos() {
  const tipos = { '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css' };
  const pedidos = [];
  return {
    pedidos,
    fetch: async (request) => {
      pedidos.push(request);
      const url = new URL(request.url);
      const rel = url.pathname === '/' ? '/index.html' : url.pathname;
      if (!existsSync(new URL('web' + rel, RAIZ))) return new Response('Não encontrado', { status: 404 });
      const corpo = bytes('web' + rel);
      const etag = etiquetaDe('web' + rel);
      if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
      const ext = rel.slice(rel.lastIndexOf('.'));
      return new Response(corpo, { status: 200, headers: {
        'Content-Type': tipos[ext] || 'application/octet-stream',
        'Content-Length': String(corpo.length),
        'Content-Encoding': 'identity',
        ETag: etag,
      } });
    },
  };
}

/* Um pedido ao worker inteiro, no domínio de dev, passando pelo harden.
   Recebe: env; caminho — o pathname a pedir; cabecalhos — os do pedido (opcional).
   Devolve: promessa da Response. */
async function pedirAoWorker(env, caminho, cabecalhos) {
  const fundo = [];
  const r = await worker.fetch(new Request('https://dev.x.pt' + caminho, { headers: cabecalhos || {} }), env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
  return r;
}

// Recebe: html — uma página. Devolve: os sha256 dos scripts em linha, no formato da CSP, pela ordem.
const hashesEmLinha = (html) => [...html.replace(/\r\n/g, '\n').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => "'sha256-" + createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");

describe('o manifesto de dev', () => {
  const dev = JSON.parse(manifestoDeDev(MANIFESTO));
  const prod = JSON.parse(MANIFESTO);

  test('chama-se Rendorium DEV, no nome e no nome curto', () => {
    assert.equal(dev.name, NOME_DEV);
    assert.equal(dev.short_name, NOME_DEV);
    assert.notEqual(prod.name, NOME_DEV, 'o ficheiro de web/ continua a ser o de produção');
  });

  test('aponta para os ícones -dev, um por cada ícone de produção, com os mesmos tamanhos e fins', () => {
    assert.equal(dev.icons.length, prod.icons.length);
    dev.icons.forEach((i, k) => {
      assert.match(i.src, /-dev\.png$/, i.src);
      assert.equal(i.src, prod.icons[k].src.replace(/\.png$/, '-dev.png'));
      assert.equal(i.sizes, prod.icons[k].sizes);
      assert.equal(i.purpose, prod.icons[k].purpose);
      assert.ok(existsSync(new URL('web/' + i.src, RAIZ)), i.src + ' existe em web/');
    });
  });

  test('o id fica «/» — resolve contra a origem, e é isso que separa as duas apps para o browser', () => {
    assert.equal(dev.id, '/');
    assert.equal(dev.id, prod.id);
    assert.equal(new URL(dev.id, 'https://dev.rendorium.com').href, 'https://dev.rendorium.com/');
    assert.notEqual(new URL(dev.id, 'https://dev.rendorium.com').href, new URL(prod.id, 'https://app.rendorium.com').href);
    for (const k of ['start_url', 'scope', 'display', 'lang', 'theme_color', 'background_color', 'description']) {
      assert.equal(dev[k], prod[k], k + ' não muda');
    }
  });

  test('reescrever duas vezes dá o mesmo — o sufixo não se acumula', () => {
    assert.equal(manifestoDeDev(manifestoDeDev(MANIFESTO)), manifestoDeDev(MANIFESTO));
  });

  test('um texto que não é JSON sai como entrou', () => {
    assert.equal(manifestoDeDev('isto não é json'), 'isto não é json');
  });
});

describe('a página de dev', () => {
  const dev = paginaDeDev(INDEX);

  test('o título, o nome no iPhone, o favicon e o apple-touch-icon passam a ser os de dev', () => {
    assert.ok(dev.includes('<title>' + NOME_DEV + '</title>'), 'o título');
    assert.ok(dev.includes('<meta name="apple-mobile-web-app-title" content="' + NOME_DEV + '">'), 'o nome debaixo do ícone no iPhone');
    assert.ok(dev.includes('<link rel="icon" href="icon-192-dev.png"'), 'o favicon');
    assert.ok(dev.includes('href="apple-touch-icon-dev.png"'), 'o apple-touch-icon');
    assert.ok(!dev.includes('<title>Rendorium</title>'), 'o título de produção saiu');
  });

  test('só mudam quatro linhas do <head>; o resto da página é igual, byte a byte', () => {
    const a = INDEX.split('\n'), b = dev.split('\n');
    assert.equal(a.length, b.length, 'o mesmo número de linhas');
    const diferentes = a.map((l, i) => (l === b[i] ? null : i)).filter((i) => i !== null);
    assert.equal(diferentes.length, 4, 'linhas diferentes: ' + diferentes.join(', '));
    const fimDoHead = a.findIndex((l) => l.includes('</head>'));
    assert.ok(fimDoHead > 0, 'o </head> encontra-se');
    diferentes.forEach((i) => assert.ok(i < fimDoHead, 'a linha ' + (i + 1) + ' é do <head>'));
  });

  test('os scripts em linha não mudam: os sha256 da CSP continuam a bater', () => {
    const hashes = hashesEmLinha(dev);
    assert.equal(hashes.length, 2);
    assert.deepEqual(hashes, hashesEmLinha(INDEX));
    const src = ler('worker/src/index.js');
    for (const h of hashes) assert.ok(src.includes(h), 'o worker/src/index.js tem ' + h);
  });
});

describe('o worker, de ponta a ponta', () => {
  test('fora de produção a página e o manifesto saem com a identidade de dev, vestidos pelo harden', async () => {
    const env = ambiente({ ENV_NAME: 'dev', ASSETS: assetsFalsos() });
    const pagina = await pedirAoWorker(env, '/');
    assert.equal(pagina.status, 200);
    const html = await pagina.text();
    assert.ok(html.includes('<title>' + NOME_DEV + '</title>'), 'a página é a de dev');
    assert.equal(html, paginaDeDev(INDEX), 'e é exatamente o que o paginaDeDev dá');
    assert.match(pagina.headers.get('Content-Security-Policy') || '', /script-src 'self'/, 'passou pelo harden');
    assert.equal(pagina.headers.get('Content-Length'), null, 'o tamanho do corpo antigo não fica');
    assert.equal(pagina.headers.get('ETag'), etiquetaDeDev(etiquetaDe('web/index.html')), 'a etiqueta é a de dev, derivada da do ficheiro');
    assert.equal(pagina.headers.get('Content-Encoding'), null, 'nem a codificação dele — o corpo novo vai em claro');
    assert.match(pagina.headers.get('Content-Type') || '', /text\/html/, 'o tipo fica');

    const man = await pedirAoWorker(env, '/manifest.webmanifest');
    assert.equal(man.status, 200);
    const m = JSON.parse(await man.text());
    assert.equal(m.name, NOME_DEV);
    assert.equal(m.icons[0].src, 'icon-192-dev.png');
    assert.match(man.headers.get('Content-Type') || '', /manifest/);
  });

  test('em produção não muda um byte, e a etiqueta dos assets segue', async () => {
    const env = ambiente({ ENV_NAME: undefined, ASSETS: assetsFalsos() });
    const pagina = await pedirAoWorker(env, '/');
    assert.equal(await pagina.text(), INDEX);
    assert.ok(pagina.headers.get('ETag'), 'a etiqueta dos assets fica');
    const man = await pedirAoWorker(env, '/manifest.webmanifest');
    assert.equal(await man.text(), MANIFESTO);
    assert.ok(!(await man.text().catch(() => '')).includes(NOME_DEV));
  });

  test('em dev, o resto dos ficheiros e um 404 saem como os assets os dão', async () => {
    const env = ambiente({ ENV_NAME: 'dev', ASSETS: assetsFalsos() });
    const css = await pedirAoWorker(env, '/estilos.css');
    assert.equal(await css.text(), ler('web/estilos.css'));
    assert.ok(css.headers.get('ETag'));
    const nada = await pedirAoWorker(env, '/nao-existe.txt');
    assert.equal(nada.status, 404);
    const icone = await pedirAoWorker(env, '/icon-192-dev.png');
    assert.equal(icone.status, 200);
    assert.equal(icone.headers.get('Content-Type'), 'image/png');
  });

  test('um browser que traz a etiqueta de produção no If-None-Match recebe o manifesto de dev inteiro, e não um 304 — era isto que deixava a PWA de dev «Rendorium»', async () => {
    const assets = assetsFalsos();
    const env = ambiente({ ENV_NAME: 'dev', ASSETS: assets });
    const deProducao = etiquetaDe('web/manifest.webmanifest');
    const man = await pedirAoWorker(env, '/manifest.webmanifest', { 'If-None-Match': deProducao });
    assert.equal(man.status, 200, 'o 304 dos assets não pode sair: não há corpo para reescrever');
    assert.equal(JSON.parse(await man.text()).name, NOME_DEV);
    assert.notEqual(man.headers.get('ETag'), deProducao, 'a etiqueta de dev não é a de produção');
    const aosAssets = assets.pedidos[assets.pedidos.length - 1];
    assert.equal(aosAssets.headers.get('If-None-Match'), null, 'o pedido aos assets vai sem condição');
    assert.equal(aosAssets.headers.get('If-Modified-Since'), null);
    const pagina = await pedirAoWorker(env, '/', { 'If-None-Match': etiquetaDe('web/index.html') });
    assert.equal(pagina.status, 200);
    assert.ok((await pagina.text()).includes('<title>' + NOME_DEV + '</title>'));
  });

  test('quem já tem o de dev revalida de graça: o If-None-Match com a etiqueta de dev dá 304, com a mesma etiqueta', async () => {
    const env = ambiente({ ENV_NAME: 'dev', ASSETS: assetsFalsos() });
    const primeiro = await pedirAoWorker(env, '/manifest.webmanifest');
    const deDev = primeiro.headers.get('ETag');
    assert.ok(deDev, 'a resposta de dev leva etiqueta');
    const segundo = await pedirAoWorker(env, '/manifest.webmanifest', { 'If-None-Match': deDev });
    assert.equal(segundo.status, 304);
    assert.equal(segundo.headers.get('ETag'), deDev);
    assert.equal(await segundo.text(), '');
    assert.match(segundo.headers.get('Content-Security-Policy') || '', /script-src/, 'passou pelo harden na mesma');
    const fraco = await pedirAoWorker(env, '/manifest.webmanifest', { 'If-None-Match': 'W/"outra", ' + deDev });
    assert.equal(fraco.status, 304, 'numa lista, e com W/, também');
  });

  test('em produção o If-None-Match com a etiqueta dos assets segue para eles e volta 304 — nada muda', async () => {
    const env = ambiente({ ENV_NAME: undefined, ASSETS: assetsFalsos() });
    const man = await pedirAoWorker(env, '/manifest.webmanifest', { 'If-None-Match': etiquetaDe('web/manifest.webmanifest') });
    assert.equal(man.status, 304);
  });

  test('o identidadeDeDev deixa passar o que não é dos dois caminhos, tal e qual, e o que não vem inteiro', async () => {
    const assets = assetsFalsos();
    const css = new Request('https://dev.x.pt/estilos.css', { headers: { 'If-None-Match': etiquetaDe('web/estilos.css') } });
    const r = await identidadeDeDev(assets, css);
    assert.equal(r.status, 304, 'o css revalida nos assets, com a condição que trazia');
    assert.equal(assets.pedidos[0], css, 'o mesmo Request, sem cópia');
    const nada = await identidadeDeDev(assets, new Request('https://dev.x.pt/nao-existe.webmanifest'));
    assert.equal(nada.status, 404);
    assert.deepEqual(CAMINHOS_DE_IDENTIDADE, ['/', '/manifest.webmanifest']);
  });

  test('a etiqueta de dev deriva da do ficheiro, e o If-None-Match lê-se como uma lista', () => {
    assert.equal(etiquetaDeDev('"abc"'), '"abc-dev"');
    assert.equal(etiquetaDeDev('W/"abc"'), 'W/"abc-dev"');
    assert.equal(etiquetaDeDev(null), null);
    assert.equal(etiquetaDeDev(''), null);
    assert.equal(etiquetaDeDev('"abc-dev"'), '"abc-dev-dev"', 'deriva sempre, sem adivinhar');
    assert.ok(trazEtiqueta('"abc-dev"', '"abc-dev"'));
    assert.ok(trazEtiqueta('"x", "abc-dev"', '"abc-dev"'));
    assert.ok(trazEtiqueta('W/"abc-dev"', '"abc-dev"'));
    assert.ok(trazEtiqueta('*', '"abc-dev"'));
    assert.ok(!trazEtiqueta('"abc"', '"abc-dev"'));
    assert.ok(!trazEtiqueta(null, '"abc-dev"'));
  });

  test('o index.js só reescreve com ENV_NAME e só nos caminhos da identidade, e entrega o pedido inteiro; o wrangler.toml passa o manifesto pelo worker nos dois ambientes', () => {
    const src = ler('worker/src/index.js');
    assert.match(src, /env\.ENV_NAME && CAMINHOS_DE_IDENTIDADE\.indexOf\(url\.pathname\) > -1/);
    assert.match(src, /identidadeDeDev\(env\.ASSETS, request\)/);
    const w = ler('wrangler.toml');
    const blocos = w.match(/run_worker_first = \[[^\]]*\]/g) || [];
    assert.equal(blocos.length, 2, 'um por ambiente');
    blocos.forEach((b) => assert.ok(b.includes('"/manifest.webmanifest"'), b));
  });
});

/* Lê a largura e a altura do IHDR de um PNG.
   Recebe: buf — os bytes do ficheiro.
   Devolve: [largura, altura]. */
function medidasDoPng(buf) {
  assert.equal(buf.toString('latin1', 1, 4), 'PNG', 'é um PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

/* O RGB do pixel (0, 0) de um PNG como o make-icons os escreve: um IHDR e um
   só IDAT, RGBA de 8 bits, filtro None em cada linha.
   Recebe: buf — os bytes do ficheiro.
   Devolve: [r, g, b] do primeiro pixel. */
function pixelDeCima(buf) {
  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), tipo = buf.toString('latin1', pos + 4, pos + 8);
    if (tipo === 'IDAT') {
      const cru = inflateSync(buf.subarray(pos + 8, pos + 8 + len));
      assert.equal(cru[0], 0, 'a primeira linha tem o filtro None');
      return [cru[1], cru[2], cru[3]];
    }
    pos += 12 + len;
  }
  throw new Error('sem IDAT');
}

describe('os ícones de dev', () => {
  test('os seis ficheiros do make-icons existem em web/, com as medidas certas, e são o que o desenho dá hoje', () => {
    assert.equal(ICONES.filter((i) => i.dev).length, 3, 'três de dev');
    assert.equal(ICONES.filter((i) => !i.dev).length, 3, 'três de produção');
    for (const i of ICONES) {
      const disco = bytes('web/' + i.nome);
      assert.deepEqual(medidasDoPng(disco), [i.size, i.size], i.nome);
      assert.ok(disco.equals(makeIcon(i.size, i.dev)), i.nome + ' está em dia com o scripts/make-icons.js (corre: node scripts/make-icons.js)');
    }
  });

  test('o de dev não é o de produção com outro nome', () => {
    for (const s of [192, 512]) {
      assert.ok(!bytes('web/icon-' + s + '.png').equals(bytes('web/icon-' + s + '-dev.png')), s);
    }
    assert.ok(!bytes('web/apple-touch-icon.png').equals(bytes('web/apple-touch-icon-dev.png')));
  });

  test('a variante de dev tem fundo âmbar e a de produção verde — medido no pixel do canto de cima', () => {
    assert.deepEqual(pixelDeCima(bytes('web/icon-192-dev.png')), [0xd9, 0x77, 0x06], 'dev: o âmbar claro do make-icons');
    assert.deepEqual(pixelDeCima(bytes('web/icon-192.png')), [0x2f, 0x7d, 0x5b], 'produção: o verde claro do ic_launcher_background.xml');
  });

  test('a página de dev aponta só para ícones que existem', () => {
    const dev = paginaDeDev(INDEX);
    for (const m of dev.matchAll(/href="([^"]+-dev\.png)"/g)) {
      assert.ok(existsSync(new URL('web/' + m[1], RAIZ)), m[1]);
    }
  });
});

describe('o cartão das Definições', () => {
  test('fora de produção diz que o APK é o Rendorium DEV e que se instala ao lado; em produção não', () => {
    const src = ler('web/cloud/partilha.js');
    const ini = src.indexOf('function cartaoDaAppNoTelemovel()');
    const fim = src.indexOf('\n}\n', ini);
    const corpo = src.slice(ini, fim);
    assert.match(corpo, /CW\.ambiente !== 'producao'/, 'decide pelo ambiente que o servidor diz');
    assert.match(corpo, /Rendorium DEV/);
    assert.match(corpo, /ao lado da app de produção/);
    assert.match(corpo, /notaDev \+/, 'a nota entra no cartão do Android');
    assert.match(corpo, /: ''/, 'e em produção é vazia');
  });
});
