/* Service worker: a app abre offline (a API sincroniza quando voltar a rede). */

/* O nome da cache leva a versão da app, que vem de avisos.js — o mesmo
   ficheiro que diz o que mudou. Publicar novidades passa a invalidar a cache
   sozinho, em vez de depender de alguém se lembrar de subir um número aqui.

   Não se declara aqui nenhum VERSAO: o ficheiro importado traz o seu com
   `var`, e uma declaração nossa colidiria com ele — partindo o service
   worker inteiro, e com ele o arranque offline. */
try { importScripts('/avisos.js'); } catch (e) { /* sem ele, cache genérica */ }
const CACHE = 'gi-shell-v' + (typeof VERSAO === 'number' ? VERSAO : 0);
// A app passou a viver em módulos: guardam-se todos, senão abre offline
// com metade do código.
const APP = ['dados', 'anexos', 'auxiliares', 'continuidade', 'graficos', 'credito', 'componentes',
  'metricas', 'navegacao', 'acessos', 'vistas', 'imovel', 'pessoas', 'contrato', 'planeados', 'prazos', 'notificacoes', 'visitas', 'calendario',
  'movimento', 'creditos', 'splitwise', 'contrato-pdf', 'avaliacao', 'definicoes',
  'copias', 'arranque'].map((n) => '/app/' + n + '.js');
const NUVEM = ['nucleo', 'anexos', 'utilizadores', 'partilha', 'colaboradores', 'ajuda', 'painel',
  'filtros', 'entrada', 'novidades', 'selecao', 'selecao-listas', 'guia'].map((n) => '/cloud/' + n + '.js');
const SHELL = ['/', '/index.html', '/avisos.js', '/legal.js', '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'].concat(APP, NUVEM);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return; // API nunca é servida da cache
  // a resposta a "que versão é a de agora?" nunca pode vir da cache
  if (url.pathname === '/versao.json') return;

  // rede primeiro (para apanhar versões novas), cache como recurso offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('/index.html') : undefined))
      )
  );
});
