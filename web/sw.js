/* Service worker: a app abre offline (a API sincroniza quando voltar a rede). */

/* O nome da cache leva a versão da app, que vem de avisos.js — o mesmo
   ficheiro que diz o que mudou. Publicar novidades passa a invalidar a cache
   sozinho, em vez de depender de alguém se lembrar de subir um número aqui.

   Não se declara aqui nenhum VERSAO: o ficheiro importado traz o seu com
   `var`, e uma declaração nossa colidiria com ele — partindo o service
   worker inteiro, e com ele o arranque offline. */
try { importScripts('/avisos.js'); } catch (e) { /* sem ele, cache genérica */ }
/* Sem o avisos.js não há versão, e uma cache chamada «v0» seria pior do que
   nenhuma: o activate apagava a cache verdadeira e ficávamos sem nada offline.
   Sem versão, este worker não guarda nem apaga — deixa passar tudo à rede. */
const VER = typeof VERSAO === 'number' ? VERSAO : null;
const CACHE = 'gi-shell-v' + VER;

/* Só produção guarda. A cache leva o nome da VERSÃO, e fora de produção a
   versão não muda entre publicações — o dev publica dezenas de vezes com a
   mesma. Com a cache a responder primeiro, o ambiente congelava no primeiro
   carregamento dessa versão e atualizar a página não adiantava nada.

   Fora de produção o worker existe (o PWA instala-se, o manifesto vale), mas
   deixa passar tudo à rede: sempre fresco, e sem poder misturar versões porque
   não guarda nenhuma.

   E diz-se quem NÃO é produção, não quem é. Chegou a estar ao contrário
   (`hostname === 'app.rendorium.com'`), e isso deixava de fora gente que está
   mesmo em produção: o wrangler.toml liga o workers.dev à mão, com o
   comentário de que as instalações antigas — PWA e APK — apontam para lá e não
   podem partir. Essas perderiam o offline, em silêncio. Os ambientes que não
   são produção sabem-se todos; os endereços de produção, não. */
const SEM_CACHE = [
  'localhost', '127.0.0.1', '[::1]',
  'dev.rendorium.com',
];
const hn = String(self.location.hostname || '').toLowerCase();
// o worker de dev também tem endereço em workers.dev, e leva o nome no início
const GUARDA = SEM_CACHE.indexOf(hn) < 0 && hn.indexOf('gestor-imobiliario-dev.') !== 0;
// A app passou a viver em módulos: guardam-se todos, senão abre offline
// com metade do código.
const APP = ['dados', 'anexos', 'auxiliares', 'lista', 'continuidade', 'graficos', 'credito', 'componentes',
  'metricas', 'navegacao', 'acessos', 'vistas', 'imovel', 'pessoas', 'contrato', 'planeados', 'prazos', 'notificacoes', 'visitas', 'calendario',
  'movimento', 'creditos', 'splitwise', 'contrato-pdf', 'avaliacao', 'definicoes',
  'copias', 'arranque'].map((n) => '/app/' + n + '.js');
const NUVEM = ['nucleo', 'anexos', 'utilizadores', 'partilha', 'colaboradores', 'ajuda', 'painel',
  'filtros', 'entrada', 'novidades', 'selecao', 'selecao-listas', 'guia'].map((n) => '/cloud/' + n + '.js');
const SHELL = ['/', '/index.html', '/avisos.js', '/legal.js', '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'].concat(APP, NUVEM);

/* NÃO se chama skipWaiting(). Chamava-se, e foi por isso que a v31 partiu em
   produção: o worker novo assumia o controlo a meio de um carregamento, e a
   mesma página ficava com os primeiros <script> servidos pelo worker antigo
   (da cache da versão anterior) e os seguintes pelo novo. Como os endereços
   dos ficheiros não levam versão no nome, nada detetava a troca — e um
   nucleo.js novo com um dados.js velho não arranca.

   O worker novo espera. Quem manda na altura de trocar é a app, que já tem
   esse caminho: o verificarVersao lê o /versao.json, limpa as caches e
   recarrega uma vez, à vista (cloud/novidades.js). */
self.addEventListener('install', (e) => {
  /* fora de produção assume-se já: não há cache a proteger, portanto não há
     carregamento a meio que se possa partir — e é isto que tira do caminho um
     worker antigo que ainda esteja a servir da cache */
  if (!GUARDA) { self.skipWaiting(); return; }
  if (VER == null) return;
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  /* fora de produção limpa-se TUDO: é o que desenrasca quem ficou com uma
     cache de uma publicação anterior e não tinha como sair dela */
  if (!GUARDA) {
    e.waitUntil(caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
    return;
  }
  if (VER == null) return;
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

  if (!GUARDA || VER == null) return;   // fora de produção, e sem versão, vai tudo à rede

  /* CACHE primeiro, e só desta versão. Era rede primeiro com a cache como
     recurso, e isso não tem atomicidade nenhuma: um ficheiro que falhasse
     vinha da cache — de QUALQUER cache, porque o caches.match sem cacheName
     procura em todas — enquanto os irmãos vinham da rede já com a versão
     nova. Uma página com metade de cada não arranca.

     Assim, um carregamento serve-se todo da mesma cache, que foi enchida de
     uma vez no install. É também mais rápido. A versão nova entra quando a
     app decidir trocar, não a meio de uma leitura. */
  e.respondWith(
    caches.open(CACHE)
      .then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res && res.ok && res.type === 'basic') { try { c.put(e.request, res.clone()); } catch (x) {} }
        return res;
      })))
      .catch(() => caches.open(CACHE)
        .then((c) => c.match(e.request.mode === 'navigate' ? '/index.html' : e.request))
        .catch(() => undefined))
  );
});
