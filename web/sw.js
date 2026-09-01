/* Service worker: a app abre offline (a API sincroniza quando voltar a rede). */
const CACHE = 'gi-shell-v5';
// A app passou a viver em módulos: guardam-se todos, senão abre offline
// com metade do código.
const APP = ['dados', 'anexos', 'auxiliares', 'graficos', 'credito', 'componentes',
  'metricas', 'navegacao', 'vistas', 'imovel', 'pessoas', 'contrato', 'planeados',
  'movimento', 'creditos', 'splitwise', 'contrato-pdf', 'avaliacao', 'definicoes',
  'copias', 'arranque'].map((n) => '/app/' + n + '.js');
const NUVEM = ['nucleo', 'anexos', 'utilizadores', 'partilha', 'ajuda', 'painel',
  'filtros', 'entrada'].map((n) => '/cloud/' + n + '.js');
const SHELL = ['/', '/index.html', '/legal.js', '/manifest.webmanifest',
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
