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
  /* O domínio raiz é a montra, mas só o «/» passa pelo worker
     (run_worker_first no wrangler.toml): o rendorium.com/index.html e os
     /app/*.js são servidos direto dos ficheiros, portanto a app existe ali e
     o redirecionamento para o app.rendorium.com nunca chega a correr. Uma
     cache com o nome da versão da app não pode mandar num domínio onde o «/»
     é outra coisa — congelava a montra. */
  'rendorium.com', 'www.rendorium.com',
];
const hn = String(self.location.hostname || '').toLowerCase();
/* O worker de dev também tem endereço em workers.dev. Testa-se o nome como
   rótulo e não como prefixo do hostname: os endereços de pré-visualização de
   versão do Cloudflare levam-no a seguir a um prefixo
   (<versão>-gestor-imobiliario-dev.<sub>.workers.dev), e um indexOf === 0
   deixava-os cair do lado de produção — a guardar cache com o nome de uma
   versão que não é a de produção nenhuma. */
const DEV_WD = /(^|-)gestor-imobiliario-dev\./.test(hn);
const GUARDA = SEM_CACHE.indexOf(hn) < 0 && !DEV_WD;
// A app passou a viver em módulos: guardam-se todos, senão abre offline
// com metade do código.
const APP = ['dados', 'anexos', 'auxiliares', 'lista', 'continuidade', 'graficos', 'credito', 'componentes',
  'metricas', 'navegacao', 'acessos', 'vistas', 'imovel', 'pessoas', 'contrato', 'planeados', 'prazos', 'notificacoes', 'visitas', 'calendario',
  'movimento', 'creditos', 'splitwise', 'contrato-pdf', 'avaliacao', 'fisco', 'definicoes',
  'copias', 'arranque'].map((n) => '/app/' + n + '.js');
const NUVEM = ['nucleo', 'anexos', 'utilizadores', 'partilha', 'colaboradores', 'ajuda', 'painel',
  'filtros', 'entrada', 'novidades', 'selecao', 'selecao-listas', 'guia'].map((n) => '/cloud/' + n + '.js');
/* O «/» e NÃO o «/index.html». O Cloudflare responde ao /index.html com um 307
   para «/» (o tratamento de HTML dos assets), o addAll segue o
   redirecionamento, e o que ficava guardado era uma resposta marcada como
   redirecionada — que o browser recusa entregar a uma navegação. O «/» é o
   mesmo documento e responde direto. */
const SHELL = ['/', '/avisos.js', '/legal.js', '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'].concat(APP, NUVEM);

/* NÃO se chama skipWaiting() no install. Chamava-se, e foi por isso que a v31
   partiu em produção: o worker novo assumia o controlo a meio de um
   carregamento, e a mesma página ficava com os primeiros <script> servidos
   pelo worker antigo (da cache da versão anterior) e os seguintes pelo novo.
   Como os endereços dos ficheiros não levam versão no nome, nada detetava a
   troca — e um nucleo.js novo com um dados.js velho não arranca.

   O worker novo espera, e quem manda na altura de trocar é a app. Isto esteve
   escrito aqui antes de ser verdade: a app não tinha canal nenhum para o
   dizer, e um location.reload() NÃO promove um worker em espera — o documento
   antigo e o novo sobrepõem-se, o registo nunca fica sem clientes, e o passo
   de ativação não corre. O que a app fazia era apagar as caches por baixo do
   worker antigo e recarregar, e a versão nova chegava por esse efeito lateral.

   Agora pede-se, e é aqui que se atende. A diferença para o skipWaiting que
   partiu a v31 é toda: aquele acontecia a meio de um carregamento; este só
   acontece depois de a app já ter decidido recarregar, portanto não há
   carregamento nenhum para partir. Do outro lado: trocarDeWorker, em
   cloud/novidades.js. */
self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'assumir') self.skipWaiting();
});

/* Enche a shell, mas SÓ se a cache desta versão estiver vazia.
   Duas razões, uma de cada lado:

   Encher quando está vazia, porque o install corre uma vez só por worker
   — passar de espera a ativo não o repete — e o caches.open sobre um nome
   apagado devolve uma cache NOVA e vazia, sem se queixar. Quem apaga caches
   por baixo de um worker (o limparCaches da app, a rede de segurança do
   arranque) deixava-a assim para sempre, e a app abria offline com metade do
   código ou com nenhum.

   E NÃO encher quando já tem conteúdo, porque uma cache com conteúdo e este
   nome é a que o worker que está a servir tem entre mãos: o nome é a versão,
   logo a versão não mudou. Um addAll por cima sobrepõe-lhe as entradas por
   baixo, e uma página que começou a carregar com os ficheiros velhos passa a
   receber os novos a meio — a avaria da v31, pela porta do lado. O CI recusa
   publicar sem subir a versão (scripts/chegada.js), mas isto não pode depender
   de um passo do CI.

   Devolve: Promise que resolve quando a cache tiver conteúdo. Rejeita se o
   addAll falhar, e é de propósito — ver o install. */
function encherSeVazia() {
  return caches.open(CACHE).then((c) => c.keys().then((ks) => (ks.length ? null : c.addAll(SHELL))));
}

/* O mesmo, para quem não pode falhar: no activate já não há install para
   abortar, e sem rede não se enche nada — mas o worker tem de ativar na mesma.
   Devolve: Promise que resolve sempre. */
function garantirShell() {
  return encherSeVazia().catch(() => {});
}

self.addEventListener('install', (e) => {
  /* fora de produção assume-se já: não há cache a proteger, portanto não há
     carregamento a meio que se possa partir — e é isto que tira do caminho um
     worker antigo que ainda esteja a servir da cache */
  if (!GUARDA) { self.skipWaiting(); return; }
  if (VER == null) return;
  /* Sem .catch(): um addAll que falha tem de abortar o install. É isso que faz
     de «este worker chegou a estar em espera» a prova de que a versão nova está
     inteira em disco — a prova de que o trocarDeWorker (cloud/novidades.js) se
     serve para decidir trocar em vez de apagar caches. */
  e.waitUntil(encherSeVazia());
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
    ).then(garantirShell).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return; // API nunca é servida da cache
  // a resposta a "que versão é a de agora?" nunca pode vir da cache
  if (url.pathname === '/versao.json') return;

  if (url.origin !== self.location.origin) return;   // outra origem não é a app
  if (!GUARDA || VER == null) return;   // fora de produção, e sem versão, vai tudo à rede

  /* Só se serve da cache, e só se guarda, o que o install lá pôs. A regra era
     ao contrário — guardava-se tudo o que não estivesse numa lista de exclusões
     — e o Cache API não lê Cache-Control nenhum, portanto passavam por aqui
     coisas que não são a app e são feitas à medida de quem as pede: o /equipa
     com a sessão da equipa lá dentro (que depois era servida do disco sem o
     servidor ser consultado, e que ao expirar prendia a ferramenta num ciclo
     de recargas), o /equipa/entrar com o bilhete no endereço, o /termos, o
     /privacidade, a montra, o APK. E nada tinha tecto: a cache crescia até a
     quota estoirar, que é onde o install do worker seguinte deixa de caber. */
  if (SHELL.indexOf(url.pathname) < 0) return;

  /* Uma navegação guarda-se e serve-se sempre pela mesma chave, seja qual for
     o endereço que a pessoa clicou. O Cache.match compara o URL inteiro, query
     incluída, e a app manda por email e por convite endereços com parâmetros
     — ?entrar=, ?repor=, ?convite=, ?ligar=, ?criar=1. Cada um deles falhava
     sempre na cache e ia buscar o index.html à REDE, enquanto os <script src>
     que ele referencia, sendo caminhos sem query, acertavam na cache da versão
     antiga: metade de cada versão na mesma página, que é a avaria da v31, sem
     ser preciso worker nenhum trocar. E, de caminho, deixam de ficar gravados
     em disco endereços que levam segredos lá dentro.

     A chave é o «/». Foi o «/index.html» de 9 a 12 de setembro, e isso partiu
     a app em produção a quem já tinha o worker: o /index.html redireciona para
     «/», a resposta guardada vinha marcada como redirecionada, e o browser
     recusa-a numa navegação — o Chrome mostra «Não é possível aceder a este
     site», sem uma linha na consola da página. Fora de produção o worker não
     guarda nada, e por isso nem o dev nem o percurso do CI o viam. */
  const chave = e.request.mode === 'navigate' ? '/' : e.request;

  /* CACHE primeiro, e só desta versão. Era rede primeiro com a cache como
     recurso, e isso não tem atomicidade nenhuma: um ficheiro que falhasse
     vinha da cache — de QUALQUER cache, porque o caches.match sem cacheName
     procura em todas — enquanto os irmãos vinham da rede já com a versão
     nova. Uma página com metade de cada não arranca.

     Assim, um carregamento serve-se todo da mesma cache, que foi enchida de
     uma vez no install. É também mais rápido. A versão nova entra quando a
     app decidir trocar, não a meio de uma leitura. */
  e.respondWith(
    caches.open(CACHE).then((c) => c.match(chave).then((hit) => (hit ? inteira(hit) : fetch(e.request).then((res) => {
      /* status 200 e não res.ok: o ok abrange o 206, e uma resposta parcial
         guardada é uma resposta partida. O put comunica os falhanços dele
         devolvendo uma promessa rejeitada — o try/catch de antes não apanhava
         nada e ficava uma rejeição por tratar dentro do worker. */
      if (res && res.status === 200 && res.type === 'basic') {
        const grava = c.put(chave, res.clone()).catch(() => {});
        try { e.waitUntil(grava); } catch (x) { /* evento já fechado */ }
      }
      return res;
    }))))
  );
});

/* Uma resposta que o browser aceite entregar a uma navegação. Uma resposta
   marcada como redirecionada é recusada numa navegação — o pedido de navegar
   não deixa o worker seguir redirecionamentos por ele — e a página falha
   inteira. Refaz-se com o mesmo corpo, estado e cabeçalhos, já sem a marca.
   É a rede de segurança para uma cache que a tenha guardado, venha de onde
   vier; nos scripts e nas imagens não muda nada.
   Recebe: res — a resposta tirada da cache.
   Devolve: a própria, quando não vem redirecionada; senão uma cópia sem a marca. */
function inteira(res) {
  if (!res || !res.redirected) return res;
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
