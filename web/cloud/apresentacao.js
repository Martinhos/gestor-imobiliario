/* ===== APRESENTAÇÃO ===== */
/* A apresentação da app.
   ----------------------
   Quem cria conta vê as boas-vindas: uma janela por cima de tudo, com um
   carrossel de imagens que diz o que a app faz e por onde se começa. E na
   primeira vez que uma conta chega a um separador, a mesma janela mostra
   como ele está arrumado. Cada uma abre uma vez por conta, e a Ajuda
   reabre-as.

   Este ficheiro tem a janela, o carrossel, o kit das maquetes, as
   boas-vindas e o estado («já visto», em db.settings). As apresentações
   dos separadores vivem nos apresentacao-*.js, que as registam aqui ao
   carregar. A Ajuda reabre-as (cloud/ajuda.js:apresentacoesNaAjuda), sem
   mexer no estado.

   COMO SE ESCREVE A APRESENTAÇÃO DE UM SEPARADOR

   1. Regista-se ao carregar o ficheiro, com o id do separador
      (navegacao.js:TABS):

        registarApresentacao('contracts', {
          nome: 'Contratos',
          imagens: [
            { titulo: 'Um contrato junta a casa e quem lá mora',
              texto: 'Em <b>Casas → Contratos</b>, cada contrato liga um imóvel aos inquilinos.',
              maquete: aprCContratosLista },
            …
          ],
        });

      nome — o título da janela e o nome do mosaico na Ajuda.
      imagens — 2 a 4 (as boas-vindas têm 7). Cada imagem:
        titulo — texto simples e curto (passa pelo esc);
        texto — HTML de confiança, só <b> e <i>, uma ou duas frases;
        maquete — uma function de topo do ficheiro, sem argumentos, que
          devolve o HTML da imagem, feito com o kit (abaixo);
        quando (opcional) — uma função sem argumentos: a imagem só entra se
          devolver verdade (lida quando a janela abre — o cargo, um serviço).
        O titulo e o texto podem também ser funções sem argumentos que
        devolvem o texto, lidas quando a janela abre (o nome da conta,
        quantos imóveis já tem).
      Opcionais da definição:
        resumo — o que a Ajuda escreve no mosaico (por omissão o sub do
          separador em navegacao.js:TABS);
        marcaTambem — ids que ficam vistos também quando esta fecha (as
          boas-vindas marcam a Visão geral e os Imóveis);
        fim — {rotulo, acao, toca}, ou uma função que o devolve (ou null,
          para o de omissão): o botão da última imagem, o que faz (acao é
          uma função) e a família do toque (data-toca); por omissão
          «Percebi», que fecha a janela.
   2. Desenha-se com o kit das maquetes («O kit das maquetes», abaixo):
      aprCena é a imagem inteira, com o fundo e o mosaico da marca, e dentro
      dela vão as peças — aprTela (o ecrã do telemóvel: o cabeçalho, as abas
      e a barra de baixo), aprPar e aprColuna (como se arrumam duas ou mais
      peças), aprCartao, aprFolha, aprLinha, aprCartaoImovel, aprSelo,
      aprBotao, aprCampo, aprSegmentado, aprChips, aprPesquisa, aprSecao,
      aprAvatar, aprIcone, aprCapa, aprBarras, aprProgresso, aprValor,
      aprMais, aprBarra e aprAviso. Os nomes e os números vêm do
      APR_EXEMPLO, o portefólio inventado que fecha entre si; as datas, das
      aprData (contadas a partir de hoje, para não envelhecerem).
   3. O CSS próprio, se fizer falta, vai na secção da folha em
      web/estilos.css, com o prefixo dela (.apr-c- as Casas, .apr-d- o
      Dinheiro, .apr-a- a Análise), e os nomes de topo novos começam por
      aprC, aprD ou aprA seguidos de maiúscula: os do kit são estes, e não
      se reusam.

   QUANDO ABRE

   A de um separador abre na primeira chegada a ele, por qualquer caminho
   (o go, a barra de baixo, a página reposta ao recarregar): quem repara é o
   render, embrulhado aqui, e nunca o render do vizinho que o carrossel dos
   separadores pinta às escondidas (vistas.js:_pintarAParte). Só abre com o
   ecrã livre (aprEcraOcupado) e depois de o servidor ter respondido
   (CW._pulled): num aparelho novo as definições chegam vazias até lá, e a
   app não decide antes de saber. Se se sair do separador antes de a janela
   poder abrir, não abre — fica para a próxima chegada. Nas Definições, só na
   raiz. As boas-vindas passam à frente: enquanto estiverem por ver, nenhum
   separador abre a sua, e fechá-las conta também a Visão geral e os Imóveis
   como vistos, para não abrirem duas janelas seguidas. */

'use strict';

/* ------------------------------------------------------------- o registo */

/* As apresentações registadas, pelo id do separador (navegacao.js:TABS) —
   e 'boas-vindas' para a de quem cria conta. A forma de cada uma está no
   topo do ficheiro. */
var APRESENTACOES = {};

/* Regista a apresentação de um separador; os apresentacao-*.js chamam-na
   ao carregar. Uma segunda com o mesmo id substitui a primeira; uma sem
   lista de imagens não entra.
   Recebe: id — o id do separador (ou 'boas-vindas'); def — {nome, imagens,
   e os opcionais resumo, marcaTambem e fim}, com a forma descrita no topo
   do ficheiro.
   Devolve: nada. */
function registarApresentacao(id, def) {
  if (!id || !def || !Array.isArray(def.imagens)) return;
  APRESENTACOES[id] = def;
}

/* Um campo que pode ser texto ou uma função sem argumentos que o devolve.
   Recebe: v — o valor (texto, função, ou nada).
   Devolve: o texto ('' sem nada, ou se a função rebentar). */
function aprTexto(v) {
  if (typeof v === 'function') { try { v = v(); } catch (e) { v = ''; } }
  return v == null ? '' : String(v);
}

/* As imagens de uma apresentação que esta conta vê agora: as que o quando
   deixa (uma que rebente fica de fora), por escrever.
   Recebe: id — o id da apresentação.
   Devolve: as definições das imagens (array; vazio sem apresentação). */
function aprImagensVisiveis(id) {
  var def = APRESENTACOES[id];
  if (!def || !Array.isArray(def.imagens)) return [];
  return def.imagens.filter(function (im) {
    if (!im) return false;
    if (typeof im.quando !== 'function') return true;
    try { return !!im.quando(); } catch (e) { return false; }
  });
}

/* As imagens de uma apresentação para esta conta, já escritas: o título, o
   texto e o HTML da maquete. Uma maquete que rebente deixa a imagem vazia —
   a janela abre na mesma, com o texto.
   Recebe: id — o id da apresentação.
   Devolve: [{titulo, texto, html}] (vazio sem apresentação). */
function aprImagensDe(id) {
  return aprImagensVisiveis(id).map(function (im) {
    var html = '';
    if (typeof im.maquete === 'function') { try { html = String(im.maquete() || ''); } catch (e) { html = ''; } }
    return { titulo: aprTexto(im.titulo), texto: aprTexto(im.texto), html: html };
  });
}

/* O botão da última imagem: o fim que a definição pede, ou «Percebi», que
   fecha a janela.
   Recebe: id — o id da apresentação.
   Devolve: {rotulo, acao, toca} — acao é uma função, toca a família do toque. */
function aprFimDe(id) {
  var def = APRESENTACOES[id] || {}, f = def.fim;
  if (typeof f === 'function') { try { f = f(); } catch (e) { f = null; } }
  if (!f || !f.rotulo || typeof f.acao !== 'function') {
    return { rotulo: 'Percebi', acao: function () { closeModal(); }, toca: 'camada' };
  }
  return { rotulo: String(f.rotulo), acao: f.acao, toca: f.toca || 'camada' };
}

/* -------------------------------------------------------------- o estado */

/* A chave das apresentações vistas, em db.settings: {id: 1}. Sem «_» à
   frente, para subir com o resto das definições (nucleo.js:strip) e chegar
   aos outros aparelhos. É um objeto e não uma lista de propósito: a fusão a
   três junta-o chave a chave (nucleo.js:fundirTres, o mesmo bloco que o
   servidor corre), e dois aparelhos que marcam separadores diferentes ficam
   com as duas marcas — numa lista, o último a chegar levava a sua. */
var APR_CHAVE = 'apresentacoes';
/* No aparelho onde a conta se criou: o id dela, enquanto as boas-vindas
   estão por ver (aprContaNova). */
var LS_APR_NOVA = 'gi_apr_nova';

/* As apresentações que esta conta já viu.
   Devolve: o objeto {id: 1} de db.settings (vazio sem nada). */
function aprVistas() {
  var s = typeof db !== 'undefined' && db && db.settings;
  var v = s && s[APR_CHAVE];
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

/* Esta conta já viu esta apresentação?
   Recebe: id — o id.
   Devolve: true/false. */
function aprVista(id) { return !!aprVistas()[id]; }

/* Marca apresentações como vistas e grava (sobem com as definições).
   Recebe: ids — um id ou uma lista deles.
   Devolve: nada. */
function aprMarcarVista(ids) {
  if (typeof db === 'undefined' || !db || !db.settings) return;
  var v = db.settings[APR_CHAVE];
  if (!v || typeof v !== 'object' || Array.isArray(v)) v = {};
  var mudou = false;
  [].concat(ids || []).forEach(function (id) { if (id && !v[id]) { v[id] = 1; mudou = true; } });
  db.settings[APR_CHAVE] = v;
  if (mudou) save();
}

/* O sinal de conta nova: quem acabou de criar a conta neste aparelho — o
   registo por email (entrada.js:CW.submitAuth) ou a primeira entrada com o
   Google, que o servidor marca com novo:true (entrada.js:socialLogin) — tem
   as boas-vindas por ver. Nasce no aparelho e não nas definições: chega antes
   de o servidor responder, e um recarregar a meio (com o aviso inicial ainda
   por aceitar) não o perde; depois de o servidor responder passa também para
   as definições (aprGuardarPorVer), para valer noutro aparelho. Quem já tinha
   conta nunca o recebe.
   Recebe: uid — o id da conta criada.
   Devolve: nada. */
function aprContaNova(uid) {
  if (!uid || !window.CW) return;
  CW._aprNova = String(uid);
  try { localStorage.setItem(LS_APR_NOVA, String(uid)); } catch (e) {}
}

/* A conta com sessão tem o sinal de conta nova neste aparelho?
   Devolve: true/false. */
function aprSinalDeContaNova() {
  var uid = window.CW && CW.user && CW.user.id;
  if (!uid) return false;
  var g = CW._aprNova || '';
  try { g = localStorage.getItem(LS_APR_NOVA) || g; } catch (e) {}
  return g === String(uid);
}

/* As boas-vindas estão por ver: estão registadas, esta conta ainda não as
   viu — aqui ou noutro aparelho, que as definições trazem — e há o sinal de
   conta nova neste aparelho ou a marca «por ver» que ele deixou nas
   definições (aprGuardarPorVer), para quem fechou a app antes de as ver e
   volta noutro aparelho.
   Devolve: true/false. */
function aprBoasVindasPorVer() {
  if (!APRESENTACOES['boas-vindas'] || aprVista('boas-vindas')) return false;
  return aprSinalDeContaNova() || aprVistas()['boas-vindas'] === 0;
}

/* Passa o sinal de conta nova para as definições, como «por ver» (o 0 na
   chave das boas-vindas; vistas, a marca passa a 1 e a fusão a três fica
   com a mudança). Só depois de o servidor responder: escrita antes, num
   aparelho sem base, a fusão desfazia-a.
   Devolve: nada. */
function aprGuardarPorVer() {
  if (!window.CW || !CW._pulled || !aprSinalDeContaNova()) return;
  if (typeof db === 'undefined' || !db || !db.settings) return;
  var v = db.settings[APR_CHAVE];
  if (!v || typeof v !== 'object' || Array.isArray(v)) v = {};
  if ('boas-vindas' in v) return;
  v['boas-vindas'] = 0;
  db.settings[APR_CHAVE] = v;
  save();
}

/* Larga o sinal de conta nova: as boas-vindas foram vistas, aqui ou noutro
   aparelho.
   Devolve: nada. */
function aprLargarContaNova() {
  if (window.CW) CW._aprNova = '';
  try { localStorage.removeItem(LS_APR_NOVA); } catch (e) {}
}

/* ------------------------------------------------- quando a janela abre */

/* O que tapa o ecrã e sai sem ninguém avisar: um portão que o servidor
   fecha (os termos aceites), a ligação de convite por abrir, uma leitura do
   estado a meio. Com estes, a janela volta a tentar sozinha (APR_INSISTE);
   com os outros, espera pelo sinal de quem os fecha (os embrulhos no fim do
   ficheiro). */
var APR_SOZINHAS = { portao: 1, chegada: 1, leitura: 1 };
/* Quanto se espera antes de abrir (o ecrã assenta depois de uma mudança),
   de quanto em quanto se volta a tentar com uma espera das que saem
   sozinhas, e quantas vezes (APR_INSISTE × APR_INSISTE_MAX: quatro minutos). */
var APR_ESPERA = 250, APR_INSISTE = 800, APR_INSISTE_MAX = 300;
// a tentativa agendada, quantas vezes já se insistiu, e as leituras do estado em curso (pullNow)
var _aprTempo = null, _aprInsistiu = 0, _aprLeituras = 0;

/* Um setTimeout que não prende o processo do Node (os testes correm a app
   com os temporizadores verdadeiros): no browser é o de sempre.
   Recebe: f — a função; ms — a espera.
   Devolve: o temporizador. */
function aprTimer(f, ms) {
  var t = setTimeout(f, ms);
  try { if (t && typeof t.unref === 'function') t.unref(); } catch (e) {}
  return t;
}

/* Porque é que a janela não pode abrir agora — ou '' com o ecrã livre. Faz a
   pergunta da chegada por convite (entrada.js:CW.resgatarChegada) e a das
   novidades (novidades.js:ecraLivre), e mais o que é desta janela: o estado
   do servidor, uma janela aberta, a ligação de convite por abrir, uma
   leitura do estado a meio (aceitar um convite lê o estado e só depois abre
   a confirmação), o tutorial, a gaveta e os modos (a seleção, a edição do
   painel). Os portões procuram-se no documento (querySelector): é estarem lá
   que tapa o ecrã.
   Sem documento onde a janela caiba (a app corrida fora de um browser, nos
   testes de Node, onde o document não tem nada), também não abre.
   Devolve: 'sessao', 'estado', 'documento', 'entrada', 'portao', 'janela',
   'chegada', 'leitura', 'tutorial', 'gaveta', 'modo', ou '' com o ecrã livre. */
function aprEcraOcupado() {
  if (!window.CW || !CW.user) return 'sessao';
  if (!CW._pulled) return 'estado';
  var ha = function (s) { try { return document.querySelector(s); } catch (e) { return null; } };
  if (!ha('body')) return 'documento';
  var auth = ha('#cwAuth');
  if (auth && auth.style && auth.style.display !== 'none') return 'entrada';
  if (CW.trancado || ha('#cwLegal') || ha('#cwTerms') || ha('#cwUpd') || ha('#cwUpd2') || ha('#cwRepor') || ha('#cwDoc')) return 'portao';
  if (typeof modalStack !== 'undefined' && modalStack.length) return 'janela';
  if (CW._chegadaPorAbrir || CW._chegadaEmCurso) return 'chegada';
  if (_aprLeituras > 0) return 'leitura';
  if (ha('#cwGuia')) return 'tutorial';
  var b = document.body, cl = b && b.classList;
  if (cl && cl.contains('open')) return 'gaveta';
  if (CW.editMode || CW.selMode || (cl && cl.contains('sel-on'))) return 'modo';
  return '';
}

/* A apresentação do ecrã onde se está: o separador, e nas Definições só a
   raiz (uma subpágina não é o separador).
   Devolve: o id, ou '' sem separador. */
function aprIdDoEcra() {
  if (typeof tab === 'undefined' || !tab) return '';
  if (tab === 'settings' && typeof setPage !== 'undefined' && setPage) return '';
  return String(tab);
}

/* O ecrã onde as boas-vindas (ou as novidades) fecharam, enquanto não se sai
   dele: a apresentação dele fica para a chegada seguinte. As boas-vindas
   abrem quase sempre na Visão geral, que elas marcam como vista; mas um
   recarregar a meio devolve a pessoa ao separador onde estava, e fechar uma
   janela para logo abrir outra é o que «nada de duas janelas seguidas» quer
   evitar. E o último ecrã que o render pintou, para saber quando se saiu. */
var _aprAdiado = '', _aprUltimoEcra = '';

/* Deixa a apresentação do ecrã onde se está para a chegada seguinte: quem
   acabou de fechar outra janela grande (as boas-vindas, as novidades,
   novidades.js:CW.novFechar) não leva logo com mais uma.
   Devolve: nada. */
function aprAdiarOEcra() { _aprAdiado = aprIdDoEcra(); _aprUltimoEcra = _aprAdiado; }

/* O que abrir agora, se o ecrã estivesse livre: as boas-vindas, se estão por
   ver; senão a do separador onde se está, se tem apresentação registada,
   com imagens para esta conta, ainda não foi vista, e não ficou para a
   próxima chegada (_aprAdiado).
   Devolve: o id, ou '' sem nada para abrir. */
function aprQueAbrir() {
  if (aprBoasVindasPorVer()) return 'boas-vindas';
  var id = aprIdDoEcra();
  if (!id || id === 'boas-vindas' || id === _aprAdiado || !APRESENTACOES[id] || aprVista(id)) return '';
  return aprImagensVisiveis(id).length ? id : '';
}

/* Tenta abrir a apresentação que falta: com o ecrã livre abre-a e marca-a
   como vista ao fechar; com uma espera das que saem sozinhas, volta a
   tentar daqui a pouco. Um sinal de conta nova que o servidor já desmentiu
   (as boas-vindas vistas noutro aparelho) larga-se aqui.
   Devolve: nada. */
function aprTentar() {
  _aprTempo = null;
  var porque = aprEcraOcupado();
  if (porque === 'sessao' || porque === 'estado') return;
  if (aprSinalDeContaNova() && aprVista('boas-vindas')) aprLargarContaNova();
  aprGuardarPorVer();
  var id = aprQueAbrir();
  if (!id) return;
  if (porque) {
    if (APR_SOZINHAS[porque] && _aprInsistiu++ < APR_INSISTE_MAX) _aprTempo = aprTimer(aprTentar, APR_INSISTE);
    return;
  }
  _aprInsistiu = 0;
  aprAbrir(id, { marcar: true });
}

/* Agenda uma tentativa para daqui a pouco (APR_ESPERA), com o ecrã já
   assente: corre a cada render e sempre que alguma coisa que tapa o ecrã
   sai. Uma segunda chamada adia a primeira.
   Devolve: nada. */
function aprAgendar() {
  if (_aprTempo) clearTimeout(_aprTempo);
  _aprInsistiu = 0;
  _aprTempo = aprTimer(aprTentar, APR_ESPERA);
}

/* A janela de uma apresentação está aberta (em cima ou por baixo de outra)?
   Devolve: true/false. */
function aprAberta() {
  return typeof modalStack !== 'undefined' && modalStack.some(function (L) { return !!(L && L.apr && !L.apr.fechado); });
}

/* A apresentação ocupa o ecrã para quem também espera por ele — as
   novidades (novidades.js:ecraLivre) e a chegada por convite: está aberta,
   ou as boas-vindas estão por ver (antes de o servidor responder conta só o
   sinal deste aparelho).
   Devolve: true/false. */
function aprOcupaOEcra() {
  if (aprAberta()) return true;
  if (!APRESENTACOES['boas-vindas']) return false;
  return window.CW && CW._pulled ? aprBoasVindasPorVer() : aprSinalDeContaNova();
}

/* ------------------------------------------------------------- a janela */

/* A janela é um openModal: o ✕ da cabeça, o Esc, o voltar do sistema e o
   arrasto da folha fecham-na como a qualquer outra, e é o aoFechar da camada
   que marca a apresentação como vista — por qualquer caminho. No corpo, o
   palco com as imagens lado a lado numa fita (cada imagem é a maquete e,
   por baixo, o título e o texto: as duas viajam juntas), a fita dos pontos e
   o texto para o leitor de ecrã; no rodapé, Anterior (sem ele na primeira) e
   Seguinte, e na última o botão do fim. As imagens estão todas no HTML e a
   fita tem a altura da maior: a janela não salta de tamanho entre elas.

   O gesto é o do carrossel das fotos (web/app/anexos.js:fotoArrastar, o
   padrão copiado, sem o chamar — esse vive preso às fotos): o eixo decide-se
   aos 10px e a folga de decidir não conta; um gesto que começa na vertical é
   do corpo da janela, que rola (o touch-action:pan-y do palco); largar
   depois de um quarto da largura, ou com um sacudir, passa à vizinha; nas
   pontas a fita resiste (navegacao.js:sepElastico) e não dá a volta; o
   clique que vem a seguir a um arrasto engole-se (navegacao.js:sepEngolirToque).
   Os botões correm a fita parada no --lento e na --curva-fita; largada por
   um dedo, já vem a andar, e acaba no --medio e na --curva-entra. Um toque,
   uma tecla ou um dedo a meio de uma viagem apanham-na onde ela está. As
   setas do teclado passam sem fita (um atalho de teclado não anima), e sem
   movimento (prefers-reduced-motion) a fita não segue o dedo e a troca é de
   uma vez. */
var _aprArrasto;   // o arrasto em curso: {c, palco, fita, id, x0, y0, base, desl, ativo, mexe, w, vx, xa, ta}, ou null

/* Abre a janela de uma apresentação na primeira imagem.
   Recebe: id — o id da apresentação; o (opcional) — {marcar}: verdade para
   a marcar como vista ao fechar (a abertura sozinha). A Ajuda abre sem
   marcar, e aí o fim é sempre o «Percebi»: quem revê fica na Ajuda, e não é
   levado para outro ecrã (onde a apresentação dele abriria logo a seguir).
   Devolve: a camada aberta (com L.apr, o estado do carrossel), ou null sem
   apresentação nem imagens. */
function aprAbrir(id, o) {
  var def = APRESENTACOES[id];
  if (!def) return null;
  var imagens = aprImagensDe(id);
  if (!imagens.length) return null;
  var marcar = !!(o && o.marcar);
  var c = { id: id, nome: aprTexto(def.nome) || 'Apresentação', imagens: imagens, i: 0, fim: marcar ? aprFimDe(id) : aprFimDe(''),
    marcar: marcar, uid: (window.CW && CW.user && CW.user.id) || '', anim: null, fechado: false, L: null };
  var L = openModal(c.nome, aprCorpo(c), aprRodape(c));
  if (!L) return null;
  c.L = L;
  L.apr = c;
  if (L.el && L.el.classList) {
    L.el.classList.add('apr-janela');
    if (id === 'boas-vindas') L.el.classList.add('apr-boas-vindas');
    // qual é, para quem a procura de fora (as provas, o percurso)
    if (typeof L.el.setAttribute === 'function') L.el.setAttribute('data-apr', id);
  }
  L.aoFechar = function () { aprAoFechar(c); };
  aprPintar(c);
  return L;
}

/* O que acontece quando a janela sai, por qualquer caminho (o aoFechar da
   camada, que o closeModal corre): larga o gesto e a viagem; aberta
   sozinha, marca-a como vista — e as que ela também marca —, e, sendo as
   boas-vindas, larga o sinal de conta nova; e dá a vez às novidades, que
   esperaram por ela (novidades.js:ecraLivre). Só marca na conta que a viu
   abrir: sair da sessão com ela aberta não escreve nas definições de outra.
   Recebe: c — o estado do carrossel.
   Devolve: nada. */
function aprAoFechar(c) {
  if (!c || c.fechado) return;
  c.fechado = true;
  if (_aprArrasto && _aprArrasto.c === c) aprArrastoLargar();
  if (c.anim) { var an = c.anim; c.anim = null; try { an.cancel(); } catch (e) {} }
  if (c.marcar && window.CW && CW.user && CW.user.id === c.uid) {
    var def = APRESENTACOES[c.id] || {};
    aprMarcarVista([c.id].concat(Array.isArray(def.marcaTambem) ? def.marcaTambem : []));
    if (c.id === 'boas-vindas') { aprLargarContaNova(); aprAdiarOEcra(); }
  }
  aprTimer(function () { if (window.CW && typeof CW.talvezNovidades === 'function') CW.talvezNovidades(); }, 80);
}

/* O corpo da janela: o palco com as imagens numa fita (só a primeira à
   vista do leitor de ecrã e do Tab; as outras inertes), os pontos — um por
   imagem, só desenho, que o número vai escrito para o leitor de ecrã — e a
   frase que o leitor de ecrã lê a cada passagem. A primeira imagem leva a
   estreia (estilos.css:.apr-estreia), a entrada das peças dela ao abrir.
   Recebe: c — o estado do carrossel ({nome, imagens}).
   Devolve: o HTML (texto). */
function aprCorpo(c) {
  var n = c.imagens.length, pontos = '';
  var folhas = c.imagens.map(function (im, k) {
    return '<section class="apr-folha' + (k === 0 ? ' apr-estreia' : '') + '" role="group" aria-roledescription="imagem" aria-label="' +
        (k + 1) + ' de ' + n + '"' + (k ? ' aria-hidden="true" inert' : '') + '>' +
      '<div class="apr-imagem" aria-hidden="true">' + im.html + '</div>' +
      '<div class="apr-texto"><h3 class="apr-tit">' + esc(im.titulo) + '</h3>' +
        (im.texto ? '<p class="apr-txt">' + im.texto + '</p>' : '') + '</div>' +
    '</section>';
  }).join('');
  for (var k = 0; k < n; k++) pontos += '<span' + (k === 0 ? ' class="on"' : '') + '></span>';
  return '<div class="apr">' +
    '<div class="apr-palco" role="region" aria-roledescription="carrossel" aria-label="' + esc(c.nome) + '" data-pointerdown="aprArrastar(event,this)">' +
      '<div class="apr-fita">' + folhas + '</div></div>' +
    (n > 1 ? '<div class="apr-pontos" aria-hidden="true">' + pontos + '</div>' : '') +
    '<p class="apr-so-leitor" aria-live="polite" aria-atomic="true"></p>' +
  '</div>';
}

/* O rodapé: Anterior e Seguinte. O aprPintar esconde o Anterior na primeira
   imagem (o Seguinte fica com a largura toda) e, na última, dá ao Seguinte
   o rótulo do fim.
   Recebe: c — o estado do carrossel.
   Devolve: o HTML (texto). */
function aprRodape(c) {
  return '<button type="button" class="btn apr-ant' + (c && c.i ? '' : ' u-d-none') + '" data-toca="vista" data-click="aprPassar(-1)">Anterior</button>' +
    '<button type="button" class="btn primary apr-seg" data-toca="vista" data-click="aprSeguinte()">Seguinte</button>';
}

/* Uma peça da janela de um carrossel, se for um elemento a sério.
   Recebe: c — o estado do carrossel; s — o seletor.
   Devolve: o elemento, ou null. */
function aprPeca(c, s) {
  var el = c && c.L && c.L.el;
  if (!el || typeof el.querySelector !== 'function') return null;
  var x = el.querySelector(s);
  return x && typeof x.setAttribute === 'function' ? x : null;
}

/* Escreve o lugar de agora em tudo o que o diz: a imagem à vista (as outras
   ficam inertes e escondidas do leitor de ecrã), o ponto aceso, o Anterior
   (sem ele na primeira imagem — e o foco que lá estava passa ao Seguinte), o
   rótulo e a família do Seguinte (o do fim na última), e a frase do leitor
   de ecrã, «Imagem 2 de 7: …». A estreia das peças é só da abertura: sai na
   primeira passagem.
   Recebe: c — o estado do carrossel.
   Devolve: nada. */
function aprPintar(c) {
  var el = c && c.L && c.L.el, n = c.imagens.length, ultima = c.i >= n - 1;
  var folhas = el && typeof el.querySelectorAll === 'function' ? [].slice.call(el.querySelectorAll('.apr-folha')) : [];
  folhas.forEach(function (f, k) {
    if (!f || typeof f.setAttribute !== 'function') return;
    if (k === c.i) {
      f.removeAttribute('aria-hidden'); f.removeAttribute('inert');
      try { f.inert = false; } catch (e) {}
    } else {
      f.setAttribute('aria-hidden', 'true'); f.setAttribute('inert', '');
    }
    if (c.i !== 0 && f.classList) f.classList.remove('apr-estreia');
  });
  var pontos = aprPeca(c, '.apr-pontos');
  if (pontos && pontos.children) [].slice.call(pontos.children).forEach(function (p, k) { if (p.classList) p.classList.toggle('on', k === c.i); });
  var ant = aprPeca(c, '.apr-ant'), seg = aprPeca(c, '.apr-seg');
  if (ant && ant.classList) {
    var focado = typeof document !== 'undefined' && document.activeElement === ant;
    ant.classList.toggle('u-d-none', c.i === 0);
    if (c.i === 0 && focado && seg && typeof seg.focus === 'function') seg.focus();
  }
  if (seg) {
    seg.textContent = ultima ? c.fim.rotulo : 'Seguinte';
    seg.setAttribute('data-toca', ultima ? c.fim.toca : 'vista');
  }
  var vivo = aprPeca(c, '.apr-so-leitor');
  if (vivo) vivo.textContent = 'Imagem ' + (c.i + 1) + ' de ' + n + ': ' + c.imagens[c.i].titulo;
}

/* O carrossel da janela de cima, se a de cima for uma apresentação.
   Devolve: o estado do carrossel ({id, imagens, i, L, …}), ou null. */
function aprAtual() {
  var t = typeof modalTop === 'function' ? modalTop() : null;
  return t && t.apr && !t.apr.fechado ? t.apr : null;
}

/* A largura de um passo da fita: o palco e a folga entre imagens (--apr-folga).
   Recebe: c — o estado do carrossel.
   Devolve: px (0 sem palco). */
function aprPasso(c) {
  var palco = aprPeca(c, '.apr-palco');
  if (!palco || typeof palco.getBoundingClientRect !== 'function') return 0;
  var folga = 0;
  try { folga = parseFloat(getComputedStyle(palco).getPropertyValue('--apr-folga')) || 0; } catch (e) {}
  return (palco.getBoundingClientRect().width || 0) + folga;
}

/* Onde a fita está agora, contando com a viagem que a estiver a levar.
   Recebe: c — o estado do carrossel.
   Devolve: px (0 na primeira imagem; negativo para as seguintes). */
function aprPosicao(c) {
  var fita = aprPeca(c, '.apr-fita');
  if (!fita) return 0;
  try { return new DOMMatrixReadOnly(getComputedStyle(fita).transform).m41 || 0; } catch (e) { return 0; }
}

/* Põe a fita no sítio do lugar de agora, em percentagem da largura (vale
   depois de a janela mudar de tamanho).
   Recebe: c — o estado do carrossel.
   Devolve: nada. */
function aprPousar(c) {
  var fita = aprPeca(c, '.apr-fita');
  if (!fita || !fita.style) return;
  fita.style.transform = c.i ? 'translateX(calc(' + (-100 * c.i) + '% - ' + c.i + ' * var(--apr-folga)))' : '';
}

/* Pára a viagem em curso onde ela vai (um botão tocado a meio de outra, um
   dedo que apanha a fita a andar) e deixa a fita parada ali.
   Recebe: c — o estado do carrossel.
   Devolve: px a que a fita ficou. */
function aprParar(c) {
  var fita = aprPeca(c, '.apr-fita');
  if (!fita) return 0;
  var x = aprPosicao(c);
  if (c.anim) { var an = c.anim; c.anim = null; try { an.cancel(); } catch (e) {} }
  if (fita.style) fita.style.transform = 'translateX(' + x + 'px)';
  return x;
}

/* Leva a fita até à imagem j, de onde ela estiver. O lugar muda logo (o
   ponto, os botões e o leitor de ecrã dizem-no ao toque) e a fita fica já
   escrita no sítio de chegada: a viagem é a animação por cima, e acabar —
   ou ser cancelada — deixa-a no sítio sem fotograma nenhum pelo meio.
   Recebe: c — o estado do carrossel; j — a imagem (presa às pontas);
   largado — verdade quando foi um dedo a largá-la (vem a andar).
   Devolve: nada. */
function aprCorrer(c, j, largado) {
  var n = c.imagens.length;
  j = Math.max(0, Math.min(n - 1, j));
  var fita = aprPeca(c, '.apr-fita'), w = aprPasso(c);
  var desde = fita ? aprParar(c) : 0;
  c.i = j;
  aprPintar(c);
  aprPousar(c);
  if (!fita || typeof fita.animate !== 'function' || !w || semMovimento()) return;
  var para = -j * w;
  if (Math.abs(desde - para) < 1) return;
  var dur = largado ? msDoToken('--medio', 200) : msDoToken('--lento', 340);
  var curva = largado ? tokenTexto('--curva-entra', 'cubic-bezier(0,0,.2,1)') : tokenTexto('--curva-fita', 'cubic-bezier(.4,0,.2,1)');
  var an = fita.animate([{ transform: 'translateX(' + desde + 'px)' }, { transform: 'translateX(' + para + 'px)' }],
    { duration: dur, easing: curva });
  c.anim = an;
  var fim = function () { if (c.anim !== an) return; c.anim = null; try { an.cancel(); } catch (e) {} };
  an.onfinish = fim;
  // a rede de sempre: num separador escondido o onfinish não chega
  aprTimer(fim, dur + 120);
}

/* Passa à imagem j de uma vez, sem fita (o teclado).
   Recebe: c — o estado do carrossel; j — a imagem (presa às pontas).
   Devolve: nada. */
function aprIr(c, j) {
  aprParar(c);
  c.i = Math.max(0, Math.min(c.imagens.length - 1, j));
  aprPintar(c);
  aprPousar(c);
}

/* O Anterior (e o Seguinte antes da última): a vizinha, com fita.
   Recebe: d — 1 (a seguinte) ou -1 (a anterior).
   Devolve: nada. */
function aprPassar(d) {
  var c = aprAtual();
  if (!c) return;
  aprCorrer(c, c.i + (d > 0 ? 1 : -1), false);
}

/* O Seguinte: a imagem seguinte, ou, na última, o fim (fechar, ou levar ao
   ecrã que a apresentação pede).
   Devolve: nada. */
function aprSeguinte() {
  var c = aprAtual();
  if (!c) return;
  if (c.i < c.imagens.length - 1) return aprCorrer(c, c.i + 1, false);
  c.fim.acao();
}

/* ← e → passam de imagem, sem fita. Não mexe num campo de texto nem com uma
   tecla de modo carregada, nem a meio de um arrasto.
   Recebe: e — o evento keydown.
   Devolve: nada. */
function aprTecla(e) {
  if (!e || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  var c = aprAtual();
  if (!c || _aprArrasto) return;
  var t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable)) return;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  aprIr(c, c.i + (e.key === 'ArrowRight' ? 1 : -1));
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', aprTecla);

/* De quem é o gesto, pelo que o dedo andou (o web/app/anexos.js:fotoEixo):
   horizontal é do carrossel, vertical é do corpo da janela, que rola; antes
   dos 10px ainda não se sabe.
   Recebe: dx, dy — px que o dedo andou desde que pousou.
   Devolve: 'x', 'y' ou '' (ainda por decidir). */
function aprEixo(dx, dy) {
  if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) return 'y';
  return Math.abs(dx) >= 10 ? 'x' : '';
}

/* Largar passa à vizinha? Depois de um quarto da largura, ou com um sacudir
   para o mesmo lado (o web/app/anexos.js:fotoDecide) — e só se houver
   vizinha desse lado: nas pontas não dá a volta.
   Recebe: desl — px a que a fita está do sítio; w — a largura de um passo;
   vx — a velocidade do dedo, em px/ms; i — a imagem de agora; n — quantas são.
   Devolve: 1 (a seguinte: arrastou-se para a esquerda), -1 (a anterior) ou 0 (volta ao sítio). */
function aprDecide(desl, w, vx, i, n) {
  var vira = Math.abs(desl) > w / 4 || (Math.abs(desl) > 30 && Math.abs(vx) > 0.4 && (vx < 0) === (desl < 0));
  var d = vira ? (desl < 0 ? 1 : -1) : 0;
  return i + d < 0 || i + d > n - 1 ? 0 : d;
}

/* Começa (talvez) um arrasto: guarda onde o dedo pousou e fica à escuta. Só
   passa a arrastar no aprArrastoMove, quando o dedo andou na horizontal. Um
   dedo que pousa na fita a meio de uma viagem apanha-a onde ela está, e o
   lugar passa a ser o da imagem mais perto.
   Recebe: e — o PointerEvent do pointerdown; palco — o .apr-palco.
   Devolve: nada — liga os ouvintes do documento. */
function aprArrastar(e, palco) {
  var c = aprAtual();
  if (!c || c.imagens.length < 2 || _aprArrasto || !e || e.button > 0 || e.isPrimary === false || !palco) return;
  var fita = typeof palco.querySelector === 'function' ? palco.querySelector('.apr-fita') : null;
  if (!fita) return;
  var w = aprPasso(c), base = -c.i * w;
  if (c.anim) {
    base = aprParar(c);
    if (w) c.i = Math.max(0, Math.min(c.imagens.length - 1, Math.round(-base / w)));
    aprPintar(c);
  }
  _aprArrasto = { c: c, palco: palco, fita: fita, id: e.pointerId, x0: e.clientX, y0: e.clientY, base: base, desl: base + c.i * w,
    ativo: false, mexe: false, w: w, vx: 0, xa: e.clientX, ta: Date.now() };
  document.addEventListener('pointermove', aprArrastoMove);
  document.addEventListener('pointerup', aprArrastoFim);
  document.addEventListener('pointercancel', aprArrastoFim);
}

/* O dedo andou: decide se o gesto é do carrossel (horizontal) ou do corpo da
   janela (vertical) e, sendo do carrossel, leva a fita com ele — no máximo
   uma imagem para cada lado, e a resistir nas pontas.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada — mexe no transform da fita. */
function aprArrastoMove(e) {
  var a = _aprArrasto;
  if (!a || e.pointerId !== a.id) return;
  var dx = e.clientX - a.x0, dy = e.clientY - a.y0;
  if (!a.ativo) {
    var eixo = aprEixo(dx, dy);
    // o dedo foi para cima ou para baixo: é o corpo da janela a rolar, não é connosco
    if (eixo === 'y') return aprArrastoFim({ type: 'pointercancel', pointerId: a.id });
    if (!eixo) return;
    // entretanto a janela pode ter fechado (o voltar do sistema): o gesto deixou de ser nosso
    if (aprAtual() !== a.c) return aprArrastoLargar();
    a.ativo = true;
    a.w = aprPasso(a.c) || 1;
    a.mexe = !semMovimento();
    // a folga de decidir não conta: a fita arranca colada ao dedo, sem salto
    a.x0 += dx < 0 ? -10 : 10;
    dx = e.clientX - a.x0;
    if (a.palco.classList) a.palco.classList.add('arrasta');
  }
  var agora = Date.now(), dt = agora - a.ta;
  // a velocidade dos últimos instantes, alisada: é ela que diz se o gesto foi um sacudir
  if (dt > 0) a.vx = 0.6 * ((e.clientX - a.xa) / dt) + 0.4 * a.vx;
  a.xa = e.clientX; a.ta = agora;
  var sitio = -a.c.i * a.w, bruto = a.base + dx - sitio, n = a.c.imagens.length;
  var ponta = (bruto > 0 && a.c.i === 0) || (bruto < 0 && a.c.i === n - 1);
  a.desl = ponta ? (typeof sepElastico === 'function' ? sepElastico(bruto, a.w) : bruto / 4) : Math.max(-a.w, Math.min(a.w, bruto));
  if (a.mexe) a.fita.style.transform = 'translateX(' + (sitio + a.desl) + 'px)';
}

/* Tira os ouvintes do documento e esquece o arrasto.
   Devolve: nada. */
function aprArrastoLargar() {
  document.removeEventListener('pointermove', aprArrastoMove);
  document.removeEventListener('pointerup', aprArrastoFim);
  document.removeEventListener('pointercancel', aprArrastoFim);
  if (_aprArrasto && _aprArrasto.palco && _aprArrasto.palco.classList) _aprArrasto.palco.classList.remove('arrasta');
  _aprArrasto = null;
}

/* O dedo saiu: passa à vizinha, se o gesto chegou para isso, ou devolve a
   fita ao sítio, de onde o dedo a deixou. Um pointercancel (o browser ficou
   com o gesto, para rolar) nunca vira. Um toque sem arrasto numa fita que
   andava deixa-a acabar de assentar. O clique que vem a seguir engole-se.
   Recebe: e — o PointerEvent do pointerup ou do pointercancel.
   Devolve: nada — corre a fita. */
function aprArrastoFim(e) {
  var a = _aprArrasto;
  if (!a || (e && e.pointerId !== a.id)) return;
  aprArrastoLargar();
  if (a.c.fechado) return;
  if (!a.ativo) { if (Math.abs(a.desl) >= 1) aprCorrer(a.c, a.c.i, true); return; }
  if (typeof sepEngolirToque === 'function') sepEngolirToque();
  var d = e && e.type === 'pointercancel' ? 0 : aprDecide(a.desl, a.w, a.vx, a.c.i, a.c.imagens.length);
  aprCorrer(a.c, a.c.i + d, true);
}

/* Reabre uma apresentação a partir da Ajuda: a mesma janela, sem marcar
   nada (cloud/ajuda.js:apresentacoesNaAjuda).
   Recebe: id — o id da apresentação.
   Devolve: nada. */
function aprRever(id) {
  if (!APRESENTACOES[id]) return;
  aprAbrir(id, { marcar: false });
}

/* As apresentações que esta conta vê, pela ordem da navegação: as
   boas-vindas e depois cada separador com apresentação registada, com
   imagens para esta conta e à vista (acessos.js:separadoresEscondidos) — é a
   lista da Ajuda.
   Devolve: os ids (array). */
function aprDaConta() {
  var fora = separadoresEscondidos();
  var ordem = ['boas-vindas'];
  NAV_GROUPS.forEach(function (g) {
    g.ids.forEach(function (p) { idsDaPorta(p).forEach(function (id) { ordem.push(id); }); });
  });
  return ordem.filter(function (id, i) {
    return ordem.indexOf(id) === i && !!APRESENTACOES[id] && fora.indexOf(id) < 0 && aprImagensVisiveis(id).length > 0;
  });
}

/* --------------------------------------------------- o kit das maquetes */

/* As peças com que se desenham as imagens: a app em miniatura, com os
   tokens (segue o claro, o escuro e o escurecimento forçado do Samsung —
   um estado diz-se pela cor da frente, o contorno, e não só pelo fundo),
   sem style= (a CSP), e sem nada que se toque: uma imagem não tem botões, e
   a janela esconde-a do leitor de ecrã (o título e o texto dizem o que ela
   mostra). Cada função devolve HTML; o texto que recebe passa pelo esc, e o
   que se chama «html» (o corpo de um cartão, de uma folha) é de confiança.
   Os números escrevem-se como a app os escreve (formato.js:money).

   Uma imagem é uma aprCena com as peças dentro. Por exemplo, o ecrã dos
   Contratos com um cartão:

     function aprCContratos() {
       var ct = APR_EXEMPLO.contrato('c4');
       return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Contratos', barra: 'casas',
         corpo: aprSecao('Os meus contratos', APR_EXEMPLO.contratos.length) +
           aprCartao(aprLinha({ titulo: ct.inquilino, sub: ct.parte + ' · desde ' + ct.desde,
             valor: aprDinheiro(ct.renda) })) }), { tom: 't2', arranjo: 'tela' });
     }

   E duas peças sobrepostas — o formulário atrás, o resultado à frente:
     aprCena(aprPar(aprFolha('Novo contrato', campos), aprCartao(linha, { flutua: true })), { tom: 't1', arranjo: 'par' }) */

// as abas das áreas, como navegacao.js:abasDaArea as escreve
var APR_ABAS_CASAS = ['Imóveis', 'Grupos', 'Contratos', 'Pessoas', 'Visitas'];
var APR_ABAS_DINHEIRO = ['Movimentos', 'Planeados', 'Créditos'];
var APR_ABAS_PESSOAS = ['Inquilinos', 'Proprietários', 'Colaboradores'];

/* A imagem inteira: o palco, com o fundo da superfície e o mosaico da marca
   atrás das peças (estilos.css:.imv-mosaico, nas quatro cores das capas, ou
   o azul-noite).
   Recebe: html — as peças; o (opcional) — {tom: 't0' cobalto, 't1' âmbar,
   't2' verde, 't3' ardósia ou 'noite' (o palco todo azul-noite); arranjo:
   'centro' (por omissão: as peças ao meio), 'tela' (um ecrã do telemóvel
   que sai pelo fundo), 'par' (aprPar), 'coluna' (aprColuna) ou 'heroi'}.
   Devolve: o HTML da imagem. */
function aprCena(html, o) {
  o = o || {};
  var tom = /^(t[0-3]|noite)$/.test(o.tom || '') ? o.tom : 't0';
  var arranjo = /^(centro|tela|par|coluna|heroi)$/.test(o.arranjo || '') ? o.arranjo : 'centro';
  return '<div class="apr-cena apr-cena-' + arranjo + (tom === 'noite' ? ' apr-cena-noite' : '') + '">' +
    '<span class="apr-fundo imv-mosaico imv-' + tom + '"></span>' + (html || '') + '</div>';
}

/* Duas peças sobrepostas: uma atrás, em cima à esquerda, e outra à frente,
   em baixo à direita — o antes e o depois, o formulário e o que ele dá.
   Recebe: atras, frente — o HTML de cada uma.
   Devolve: o HTML. */
function aprPar(atras, frente) {
  return '<div class="apr-par"><div class="apr-atras">' + (atras || '') + '</div><div class="apr-frente">' + (frente || '') + '</div></div>';
}

/* Peças umas por baixo das outras, ao meio.
   Recebe: pecas — o HTML de cada uma (array).
   Devolve: o HTML. */
function aprColuna(pecas) {
  return '<div class="apr-coluna">' + (pecas || []).join('') + '</div>';
}

/* O ecrã do telemóvel, que sai pelo fundo da imagem: o cabeçalho, as abas
   da área, o corpo e a barra de baixo.
   Recebe: o — {titulo (o do cabeçalho: 'Casas', 'Dinheiro'…), abas (os
   nomes) e aba (a acesa), corpo (HTML), barra (o destino aceso da barra de
   baixo: 'inicio', 'casas', 'dinheiro' ou 'agenda'; sem ela, não há
   barra), mais (verdade: o + da barra em destaque)}.
   Devolve: o HTML. */
function aprTela(o) {
  o = o || {};
  return '<div class="apr-tela' + (o.barra ? ' com-barra' : '') + '">' +
    (o.titulo ? aprCabeca(o.titulo) : '') +
    (o.abas ? aprAbas(o.abas, o.aba) : '') +
    '<div class="apr-tela-corpo">' + (o.corpo || '') + '</div>' +
    (o.barra ? aprBarra(o.barra, { mais: o.mais }) : '') +
  '</div>';
}

/* O cabeçalho de um ecrã: o título e, à direita, o sino e o selecionar.
   Recebe: titulo — o texto; o (opcional) — {direita: HTML no lugar dos ícones}.
   Devolve: o HTML. */
function aprCabeca(titulo, o) {
  var dir = o && o.direita != null ? o.direita : ic('bell', 14) + ic('caixaVisto', 14);
  return '<div class="apr-m-cab"><span class="apr-m-cab-menu">' + ic('menu', 14) + '</span><b>' + esc(titulo) + '</b><span class="apr-m-cab-dir">' + dir + '</span></div>';
}

/* As abas de uma área, com a acesa (contorno e texto no --accent).
   Recebe: nomes — os rótulos (array); atual — o da acesa.
   Devolve: o HTML. */
function aprAbas(nomes, atual) {
  return '<div class="apr-m-abas">' + (nomes || []).map(function (n) {
    return '<span' + (n === atual ? ' class="on"' : '') + '>' + esc(n) + '</span>';
  }).join('') + '</div>';
}

/* A pesquisa de uma lista, com o funil dos filtros ao lado.
   Recebe: o (opcional) — {texto: o que está escrito (por omissão o
   «Pesquisar…» por preencher), alvo: verdade para o funil em destaque}.
   Devolve: o HTML. */
function aprPesquisa(o) {
  o = o || {};
  return '<div class="apr-m-pesq"><span class="apr-m-pesq-campo' + (o.texto ? '' : ' vazio') + '">' +
      esc(o.texto || 'Pesquisar…') + '</span>' +
    '<span class="apr-m-funil' + (o.alvo ? ' apr-alvo' : '') + '">' + ic('filter', 13) + '</span></div>';
}

/* Uma fila de chips (os filtros, os modelos): os ligados com o contorno e o
   texto no --accent.
   Recebe: nomes — os rótulos (array); ligados (opcional) — os índices
   ligados (array); alvo (opcional) — o índice do chip em destaque.
   Devolve: o HTML. */
function aprChips(nomes, ligados, alvo) {
  var on = ligados || [];
  return '<div class="apr-m-chips">' + (nomes || []).map(function (n, k) {
    var cl = (on.indexOf(k) > -1 ? ' on' : '') + (alvo === k ? ' apr-alvo' : '');
    return '<span class="apr-m-chip' + cl + '">' + esc(n) + '</span>';
  }).join('') + '</div>';
}

/* O título de uma secção de uma lista («Os meus imóveis»), com quantos tem.
   Recebe: titulo — o texto; n (opcional) — a contagem.
   Devolve: o HTML. */
function aprSecao(titulo, n) {
  return '<div class="apr-m-secao"><b>' + esc(titulo) + '</b>' + (n != null ? '<span>' + esc(n) + '</span>' : '') + '</div>';
}

/* Um cartão: a superfície com contorno.
   Recebe: html — o que leva dentro; o (opcional) — {flutua: verdade para a
   sombra das peças que sobem, alvo: verdade para o contorno de destaque,
   classe: classes a somar (as da folha que o usa)}.
   Devolve: o HTML. */
function aprCartao(html, o) {
  o = o || {};
  return '<div class="apr-m-cartao' + (o.flutua ? ' apr-flutua' : '') + (o.alvo ? ' apr-alvo' : '') +
    (o.classe ? ' ' + esc(o.classe) : '') + '">' + (html || '') + '</div>';
}

/* Uma janela em miniatura (a folha de baixo do telemóvel): o título, o ✕ e
   o corpo.
   Recebe: titulo — o texto; html — o corpo; o (opcional) — {flutua, alvo,
   classe}, como no aprCartao.
   Devolve: o HTML. */
function aprFolha(titulo, html, o) {
  o = o || {};
  return '<div class="apr-m-folha' + (o.flutua ? ' apr-flutua' : '') + (o.alvo ? ' apr-alvo' : '') + (o.classe ? ' ' + esc(o.classe) : '') + '">' +
    '<div class="apr-m-folha-cab"><b>' + esc(titulo) + '</b>' + ic('x', 12) + '</div>' +
    '<div class="apr-m-folha-corpo">' + (html || '') + '</div></div>';
}

/* Uma linha de uma lista: à esquerda o avatar, um ícone ou uma capa; o
   título, por baixo o sub (e o sub2) e os selos; à direita o valor.
   Recebe: o — {titulo, sub, sub2, valor (texto já escrito, ex.
   aprDinheiro(950)), tom ('pos' o que entra, 'neg' o que sai, 'prest' a
   prestação; sem tom é a tinta), selos ([[texto, tom]], tons do aprSelo),
   avatar (o nome, de onde saem as iniciais), icone (o nome no icones.js:ic),
   capa (o tom do mosaico), seta (verdade: o › de «abre»), alvo (verdade:
   em destaque), botao (HTML por baixo do valor, na coluna da direita: um
   aprBotao, ou um aprSelo para a linha ficar com duas linhas só)}.
   Devolve: o HTML. */
function aprLinha(o) {
  o = o || {};
  var lado = o.avatar ? aprAvatar(o.avatar) : o.icone ? aprIcone(o.icone, { tom: o.tomIcone }) : o.capa ? aprCapa(o.capa) : '';
  var selos = (o.selos || []).map(function (s) { return aprSelo(s[0], s[1]); }).join('');
  var valor = o.valor != null && o.valor !== '' ? '<b class="apr-m-valor' + (o.tom ? ' ' + esc(o.tom) : '') + '">' + esc(o.valor) + '</b>' : '';
  return '<div class="apr-m-linha' + (lado ? ' com-lado' : '') + (o.alvo ? ' apr-alvo' : '') + '">' + lado +
    '<span class="apr-m-linha-txt"><b>' + esc(o.titulo || '') + '</b>' +
      (o.sub ? '<span class="apr-m-sub">' + esc(o.sub) + '</span>' : '') +
      (o.sub2 ? '<span class="apr-m-sub">' + esc(o.sub2) + '</span>' : '') +
      (selos ? '<span class="apr-m-selos">' + selos + '</span>' : '') + '</span>' +
    // o botão vai por baixo do valor, na coluna da direita (o «Confirmar» de um por confirmar)
    (o.botao ? '<span class="apr-m-linha-dir">' + valor + o.botao + '</span>' : valor) +
    (o.seta ? '<span class="apr-m-seta">' + ic('chevR', 12) + '</span>' : '') +
  '</div>';
}

/* Um selo (o .badge da app em ponto pequeno).
   Recebe: texto — o que diz; tom (opcional) — 'in' (verde), 'out'
   (laranja), 'loan' (roxo), 'amber' (aviso), 'red' (perigo), 'grey'
   (neutro); sem tom é o cobalto.
   Devolve: o HTML. */
function aprSelo(texto, tom) {
  var t = /^(in|out|loan|amber|red|grey)$/.test(tom || '') ? ' ' + tom : '';
  return '<span class="apr-m-selo' + t + '">' + esc(texto) + '</span>';
}

/* Um botão desenhado (não se toca: é uma imagem).
   Recebe: texto — o rótulo; o (opcional) — {primario, pequeno, icone (o
   nome no icones.js:ic, à esquerda), alvo (em destaque: o que a imagem
   ensina a tocar)}.
   Devolve: o HTML. */
function aprBotao(texto, o) {
  o = o || {};
  return '<span class="apr-m-botao' + (o.primario ? ' primario' : '') + (o.pequeno ? ' pequeno' : '') + (o.alvo ? ' apr-alvo' : '') + '">' +
    (o.icone ? ic(o.icone, 12) : '') + esc(texto) + '</span>';
}

/* Um campo de formulário: o rótulo (com o * vermelho do obrigatório) e a
   caixa com o valor — ou o exemplo, apagado, por preencher.
   Recebe: rotulo — o texto; valor — o que está escrito ('' por preencher);
   o (opcional) — {obrigatorio, vazio (o texto apagado de um campo por
   preencher: «Opcional», «Ex: …»), alvo}.
   Devolve: o HTML. */
function aprCampo(rotulo, valor, o) {
  o = o || {};
  var tem = valor != null && valor !== '';
  return '<div class="apr-m-campo' + (o.alvo ? ' apr-alvo' : '') + '"><span class="apr-m-rot">' + esc(rotulo) +
      (o.obrigatorio ? '<span class="apr-m-req">*</span>' : '') + '</span>' +
    '<span class="apr-m-caixa' + (tem ? '' : ' vazio') + '">' + esc(tem ? valor : (o.vazio || 'Opcional')) + '</span></div>';
}

/* Um segmentado (o destino do imóvel, o tipo de arrendamento): a escolha
   acesa com o contorno e o texto no --accent.
   Recebe: opcoes — os rótulos (array); atual — o aceso.
   Devolve: o HTML. */
function aprSegmentado(opcoes, atual) {
  return '<div class="apr-m-seg">' + (opcoes || []).map(function (n) {
    return '<span' + (n === atual ? ' class="on"' : '') + '>' + esc(n) + '</span>';
  }).join('') + '</div>';
}

/* O avatar de uma pessoa: as iniciais num círculo.
   Recebe: nome — o nome (formato.js:initials tira as duas primeiras).
   Devolve: o HTML. */
function aprAvatar(nome) {
  return '<span class="apr-m-avatar">' + esc(initials(nome)) + '</span>';
}

/* Um ícone num quadrado de cor suave (as linhas da folha «Criar», os
   avisos).
   Recebe: nome — o nome no icones.js:ic; o (opcional) — {tom: 'in', 'out',
   'loan', 'amber', 'red' ou 'grey'; sem tom é o cobalto}.
   Devolve: o HTML. */
function aprIcone(nome, o) {
  var t = o && /^(in|out|loan|amber|red|grey)$/.test(o.tom || '') ? ' ' + o.tom : '';
  return '<span class="apr-m-ico' + t + '">' + ic(nome, 13) + '</span>';
}

/* A capa de um imóvel sem fotografia: o mosaico, na cor do imóvel.
   Recebe: tom — 't0' a 't3' (o tom de cada imóvel do APR_EXEMPLO).
   Devolve: o HTML. */
function aprCapa(tom) {
  var t = /^t[0-3]$/.test(tom || '') ? tom : 't0';
  return '<span class="apr-m-capa"><i class="imv-mosaico imv-' + t + '"></i></span>';
}

/* O cartão de um imóvel, como na lista dos Imóveis
   (lista-imoveis.js:imvCartao): a capa, o nome e a morada, o estado, os
   três números e os selos.
   Recebe: im — um imóvel do APR_EXEMPLO; o (opcional) — {estado: [texto,
   tom] (por omissão o que o exemplo diz), nums: [[rótulo, valor]] (por
   omissão a renda, a yield e a dívida), selos: [[texto, tom]], alvo, flutua}.
   Devolve: o HTML. */
function aprCartaoImovel(im, o) {
  o = o || {};
  im = im || {};
  var ex = typeof APR_EXEMPLO !== 'undefined' ? APR_EXEMPLO : null;
  var renda = ex ? ex.rendaDe(im.id) : 0, divida = ex ? ex.dividaDe(im.id) : 0;
  var estado = o.estado || (!renda ? ['Vago', 'amber'] : im.modo === 'quartos'
    ? [ex.contratosDe(im.id).length + '/' + im.quartos + ' quartos', ''] : ['Arrendado', 'in']);
  var nums = o.nums || [['Renda', renda ? money(renda) : '—'], ['Yield', renda ? pct(renda * 12 / im.valor, 1) : '—'],
    ['Dívida', divida ? money(divida) : '—']];
  var selos = (o.selos || []).map(function (s) { return aprSelo(s[0], s[1]); }).join('');
  return '<div class="apr-m-imv' + (o.alvo ? ' apr-alvo' : '') + (o.flutua ? ' apr-flutua' : '') + '">' + aprCapa(im.tom) +
    '<span class="apr-m-imv-corpo"><span class="apr-m-imv-topo"><span><b>' + esc(im.nome) + '</b><span class="apr-m-sub">' + esc(im.morada || '') + '</span></span>' +
      aprSelo(estado[0], estado[1]) + '</span>' +
      '<span class="apr-m-nums">' + nums.map(function (x) { return '<span><span class="apr-m-sub">' + esc(x[0]) + '</span>' + esc(x[1]) + '</span>'; }).join('') + '</span>' +
      (selos ? '<span class="apr-m-selos">' + selos + '</span>' : '') +
    '</span></div>';
}

/* Barras de um gráfico em miniatura (a receita mês a mês): cada uma com a
   altura em décimos do maior valor, por classe (estilos.css:.apr-a0 a
   .apr-a10) — a CSP não deixa escrever a altura no HTML.
   Recebe: valores — os números (array); o (opcional) — {max (por omissão o
   maior), tom: 'in', 'out' ou 'loan' (sem tom, o cobalto), aceso: o índice
   da barra em destaque}.
   Devolve: o HTML. */
function aprBarras(valores, o) {
  o = o || {};
  var vs = (valores || []).map(function (v) { return Math.abs(Number(v) || 0); });
  var max = o.max || Math.max.apply(null, vs.concat([1]));
  var t = /^(in|out|loan)$/.test(o.tom || '') ? ' ' + o.tom : '';
  return '<span class="apr-m-barras' + t + '">' + vs.map(function (v, k) {
    return '<span class="apr-a' + Math.max(0, Math.min(10, Math.round(v / max * 10))) + (o.aceso === k ? ' on' : '') + '"></span>';
  }).join('') + '</span>';
}

/* Uma barra de progresso (quanto falta de um crédito, quantos passos já
   feitos): a largura por data-largura (web/app/estilos-calculados.js).
   Recebe: pct — de 0 a 100; o (opcional) — {tom: 'in', 'out' ou 'loan'}.
   Devolve: o HTML. */
function aprProgresso(pct, o) {
  var p = Math.max(0, Math.min(100, Number(pct) || 0));
  var t = o && /^(in|out|loan)$/.test(o.tom || '') ? ' ' + o.tom : '';
  return '<span class="apr-m-prog' + t + '"><i data-largura="' + p.toFixed(1) + '"></i></span>';
}

/* Um valor em euros com a cor do que é: o que entra, o que sai, a
   prestação.
   Recebe: v — o valor (número); o (opcional) — {tom: 'pos', 'neg' ou
   'prest' (por omissão pelo sinal), inteiro: verdade para arredondar ao euro}.
   Devolve: o HTML. */
function aprValor(v, o) {
  o = o || {};
  var n = Number(v) || 0, tom = o.tom || (n < 0 ? 'neg' : 'pos');
  return '<b class="apr-m-valor ' + esc(tom) + '">' + esc(money(n, !o.inteiro)) + '</b>';
}

/* O + da barra de baixo, sozinho.
   Recebe: o (opcional) — {alvo: verdade para o destaque}.
   Devolve: o HTML. */
function aprMais(o) {
  return '<span class="apr-m-mais' + (o && o.alvo ? ' apr-alvo' : '') + '">' + ic('plus', 14) + '</span>';
}

/* A barra de baixo do telemóvel: Início, Casas, o +, Dinheiro e Agenda, com
   o destino aceso.
   Recebe: ativo — 'inicio', 'casas', 'dinheiro' ou 'agenda'; o (opcional)
   — {mais: verdade para o + em destaque}.
   Devolve: o HTML. */
function aprBarra(ativo, o) {
  var item = function (id, icone, rotulo) {
    return '<span class="apr-m-barra-i' + (ativo === id ? ' on' : '') + '">' + ic(icone, 13) + '<span>' + rotulo + '</span></span>';
  };
  return '<div class="apr-m-barra">' + item('inicio', 'painel', 'Início') + item('casas', 'building', 'Casas') +
    aprMais({ alvo: o && o.mais }) + item('dinheiro', 'carteira', 'Dinheiro') + item('agenda', 'cal', 'Agenda') + '</div>';
}

/* Um aviso em cartão: um ícone num quadrado de cor, o título e o sub — o
   que a app lembra (uma renda que chegou, um prazo).
   Recebe: titulo, sub — os textos; o (opcional) — {icone (por omissão o
   sino), tom (os do aprIcone)}.
   Devolve: o HTML. */
function aprAviso(titulo, sub, o) {
  o = o || {};
  return '<div class="apr-m-aviso">' + aprIcone(o.icone || 'bell', { tom: o.tom }) +
    '<span><b>' + esc(titulo) + '</b>' + (sub ? '<span class="apr-m-sub">' + esc(sub) + '</span>' : '') + '</span></div>';
}

/* Uma peça que entra quando a janela abre, se estiver na primeira imagem
   (estilos.css:.apr-estreia): sobe e aparece, umas a seguir às outras, a
   60 ms de distância (a mesma escada do graficos.js:atrasoEntrada, pelo
   data-atraso de web/app/estilos-calculados.js). Sem movimento, já lá está.
   Recebe: html — a peça; k — a ordem (0, 1, 2…); classe (opcional) —
   classes a somar (o sítio dela na cena).
   Devolve: o HTML. */
function aprSurge(html, k, classe) {
  var n = Math.max(0, Math.min(6, Number(k) || 0));
  return '<div class="apr-surge' + (classe ? ' ' + esc(classe) : '') + '"' + (n ? ' data-atraso="' + (n * 60) + '"' : '') + '>' + (html || '') + '</div>';
}

/* Um dia contado a partir de hoje, em AAAA-MM-DD (formato.js:addDays): as
   datas das maquetes não envelhecem.
   Recebe: dias — quantos dias somar (negativo para trás).
   Devolve: a data em ISO. */
function aprDia(dias) { return addDays(today(), Number(dias) || 0); }

/* Uma data das maquetes como a app a escreve nas listas, dd/mm.
   Recebe: iso — a data em AAAA-MM-DD (aprDia, aprProximoDia).
   Devolve: o texto, ex.: «08/11». */
function aprData(iso) { return dPT(iso).slice(0, 5); }

/* A próxima vez que um dia do mês chega, a partir de amanhã — a data de um
   planeado mensal (formato.js:dayInMonth prende ao último dia do mês).
   Recebe: dia — o dia do mês (1 a 31).
   Devolve: a data em AAAA-MM-DD. */
function aprProximoDia(dia) {
  var hoje = today(), y = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7)) - 1;
  var d = dayInMonth(y, m, dia);
  return d > hoje ? d : dayInMonth(m === 11 ? y + 1 : y, (m + 1) % 12, dia);
}

/* Um valor em euros com as duas casas, como os fluxos (formato.js:money).
   Recebe: v — o valor.
   Devolve: o texto, ex.: «950,00 €». */
function aprDinheiro(v) { return money(v, true); }

/* O portefólio inventado das maquetes: quatro imóveis no Porto, cinco
   contratos, uma hipoteca, as despesas fixas e um ano de movimentos, com
   números que fecham entre si. As rendas em vigor somam 2 425 €/mês (3 ×
   350 € nos quartos do T3 Bonfim, 950 € no T2 Paranhos, 425 € no T0
   Campanhã; o T1 Cedofeita está vago desde setembro, e até lá rendia 690 €
   — daí os 3 115 € dos meses de antes). A prestação da hipoteca do T3 Bonfim
   é 1 106,40 €. Os meses são os da montra (worker/src/landing.js:RECEITA_MES,
   DESPESA_MES), para a montra e a app contarem a mesma história. Os nomes são
   de pessoas inventadas; os emails, do exemplo.pt que a app usa nos exemplos.
   Lê-se pelas funções dele (imovel, contrato, inquilino, rendaDe,
   contratosDe, dividaDe) ou pelas listas. */
var APR_EXEMPLO = {
  imoveis: [
    { id: 'bonfim', nome: 'T3 Bonfim', morada: 'Rua do Bonfim, Porto', tom: 't0', destino: 'Arrendamento', modo: 'quartos', quartos: 4,
      valor: 310000, aquisicao: 262000, imi: 386.4, condominio: 45, seguro: 214.8 },
    { id: 'paranhos', nome: 'T2 Paranhos', morada: 'Rua de Costa Cabral, Porto', tom: 't2', destino: 'Arrendamento', modo: 'inteiro',
      valor: 235000, aquisicao: 198500, imi: 284, condominio: 38, seguro: 186.4 },
    { id: 'campanha', nome: 'T0 Campanhã', morada: 'Rua do Heroísmo, Porto', tom: 't1', destino: 'Arrendamento', modo: 'inteiro',
      valor: 98000, aquisicao: 84000, imi: 96, condominio: 22, seguro: 0 },
    { id: 'cedofeita', nome: 'T1 Cedofeita', morada: 'Rua de Cedofeita, Porto', tom: 't3', destino: 'Arrendamento', modo: 'inteiro',
      valor: 165000, aquisicao: 141000, imi: 172, condominio: 30, seguro: 0 },
  ],
  inquilinos: [
    { id: 'ana', nome: 'Ana Ribeiro', email: 'ana.ribeiro@exemplo.pt', imovel: 'bonfim', parte: 'Quarto 1' },
    { id: 'tomas', nome: 'Tomás Matos', email: 'tomas.matos@exemplo.pt', imovel: 'bonfim', parte: 'Quarto 2' },
    { id: 'ines', nome: 'Inês Costa', email: 'ines.costa@exemplo.pt', imovel: 'bonfim', parte: 'Quarto 3' },
    { id: 'sousa', nome: 'Marta Sousa', email: 'marta.sousa@exemplo.pt', imovel: 'paranhos', parte: 'Imóvel inteiro' },
    { id: 'tiago', nome: 'Tiago Lopes', email: 'tiago.lopes@exemplo.pt', imovel: 'campanha', parte: 'Imóvel inteiro' },
  ],
  /* dia — o dia de pagamento; desde e ate — dd/mm/aaaa; terminaEm — dias que
     faltam (o da Inês acaba daqui a pouco, e é o prazo que a app avisa);
     atraso — a renda deste mês ficou por confirmar */
  contratos: [
    { id: 'c1', imovel: 'bonfim', inquilino: 'Ana Ribeiro', parte: 'Quarto 1', renda: 350, dia: 1, desde: '01/09/2025', ate: '31/08/2027' },
    { id: 'c2', imovel: 'bonfim', inquilino: 'Tomás Matos', parte: 'Quarto 2', renda: 350, dia: 1, desde: '01/09/2025', ate: '31/08/2027', atraso: true },
    { id: 'c3', imovel: 'bonfim', inquilino: 'Inês Costa', parte: 'Quarto 3', renda: 350, dia: 1, desde: '01/12/2025', terminaEm: 25 },
    { id: 'c4', imovel: 'paranhos', inquilino: 'Marta Sousa', parte: 'Imóvel inteiro', renda: 950, dia: 8, desde: '01/03/2025', ate: '29/02/2028' },
    { id: 'c5', imovel: 'campanha', inquilino: 'Tiago Lopes', parte: 'Imóvel inteiro', renda: 425, dia: 5, desde: '01/10/2024', ate: '30/09/2027' },
  ],
  // a hipoteca do T3 Bonfim: o capital pedido, o que falta, a prestação e o dia
  creditos: [
    { id: 'h1', imovel: 'bonfim', nome: 'Caixa', banco: 'Caixa Geral de Depósitos', capital: 248000, divida: 231800, prestacao: 1106.4,
      taxa: 'Variável', dia: 15 },
  ],
  // os planeados criados à mão (os outros saem dos contratos, da hipoteca e das despesas fixas)
  aMao: [
    { nome: 'Limpeza das escadas', imovel: 'bonfim', valor: -35, dia: 1 },
  ],
  // os modelos: um movimento guardado para copiar, sem data (o valor pode ficar em branco)
  modelos: [
    { nome: 'Limpeza de fim de contrato', tipo: 'Despesa', valor: 90, imovel: 'bonfim', categoria: 'Limpeza e jardim', sub: 'Limpeza' },
    { nome: 'Reparação da caldeira', tipo: 'Despesa', valor: null, imovel: 'paranhos', categoria: 'Manutenção e reparações', sub: 'Caldeira / AVAC' },
    { nome: 'Chaves novas', tipo: 'Despesa', valor: 18.5, imovel: '', categoria: 'Manutenção e reparações', sub: 'Chaves e fechaduras' },
  ],
  // outro proprietário (uma conta com quem se partilha): metade do T3 Bonfim
  proprietarios: [{ nome: 'Helena Moreira', imoveis: ['bonfim'], quota: 50 }],
  // os meses deste ano, de janeiro até ao último fechado: receita, despesas e a prestação de cada mês
  receitaMes: [3115, 3115, 3255, 3115, 3115, 3115, 3115, 3115, 2425, 2425],
  despesaMes: [420, 380, 610, 350, 1180, 410, 395, 870, 1012, 685],
  prestacaoMes: 1106.4,
  /* O imóvel com este id.
     Recebe: id — 'bonfim', 'paranhos', 'campanha' ou 'cedofeita'.
     Devolve: o imóvel, ou null. */
  imovel: function (id) { return this.imoveis.filter(function (x) { return x.id === id; })[0] || null; },
  /* O contrato com este id.
     Recebe: id — 'c1' a 'c5'.
     Devolve: o contrato, ou null. */
  contrato: function (id) { return this.contratos.filter(function (x) { return x.id === id; })[0] || null; },
  /* O inquilino com este id.
     Recebe: id — 'ana', 'tomas', 'ines', 'sousa' ou 'tiago'.
     Devolve: o inquilino, ou null. */
  inquilino: function (id) { return this.inquilinos.filter(function (x) { return x.id === id; })[0] || null; },
  /* Os contratos de um imóvel.
     Recebe: id — o id do imóvel.
     Devolve: os contratos (array). */
  contratosDe: function (id) { return this.contratos.filter(function (x) { return x.imovel === id; }); },
  /* A renda do mês de um imóvel: a soma dos contratos dele.
     Recebe: id — o id do imóvel.
     Devolve: euros (0 num imóvel vago). */
  rendaDe: function (id) { return this.contratosDe(id).reduce(function (a, x) { return a + x.renda; }, 0); },
  /* O que falta pagar das hipotecas de um imóvel.
     Recebe: id — o id do imóvel.
     Devolve: euros (0 sem hipoteca). */
  dividaDe: function (id) { return this.creditos.filter(function (x) { return x.imovel === id; }).reduce(function (a, x) { return a + x.divida; }, 0); },
};

/* -------------------------------------------------------- as boas-vindas */

/* Quem só colabora (acessos.js:souSoColaborador): vê os imóveis de outros,
   e só cria o que o cargo deixa.
   Devolve: true/false. */
function aprSoColabora() { return souSoColaborador(); }

/* Esta conta pode criar isto? O serviço tem de estar ligado; quem tem
   imóveis seus (ou nenhum ainda) pode tudo, e quem só colabora só o que o
   cargo abre nalgum imóvel (acessos.js:casasComo) — a regra do «Criar»
   (acessos.js:ACOES_DE_ADICIONAR). As boas-vindas de quem só colabora não
   mostram como se cria o que não pode criar.
   Recebe: servico — o id do serviço; perm (opcional) — a permissão do cargo
   (sem ela, quem só colabora não pode).
   Devolve: true/false. */
function aprPodeCriar(servico, perm) {
  if (!servicoLigado(servico)) return false;
  if (!aprSoColabora()) return true;
  return !!perm && casasComo(perm).length > 0;
}

/* O primeiro nome da conta, para os parabéns.
   Devolve: o nome (texto, por escapar), ou '' sem nome. */
function aprPrimeiroNome() {
  var n = String((window.CW && CW.user && CW.user.name) || '').trim();
  return n ? n.split(/\s+/)[0] : '';
}

/* A frase dos parabéns, com o primeiro nome da conta (sem nome, só
   «Parabéns.»): a que o Martinho escolheu.
   Devolve: o texto. */
function aprBVParabensTitulo() {
  var nome = aprPrimeiroNome();
  return 'Parabéns' + (nome ? ', ' + nome : '') + '. A partir de hoje, nenhuma renda te passa despercebida.';
}

/* A imagem dos parabéns: o azul-noite da marca, a casa do ícone ao meio e,
   a entrar uma a uma, três coisas que a app lembra — a renda que chegou, o
   IMI que aí vem e o contrato a acabar.
   Devolve: o HTML da imagem. */
function aprBVParabens() {
  var ex = APR_EXEMPLO, p = ex.imovel('paranhos'), ines = ex.contrato('c3');
  var imi = aprProximoIMI();
  return aprCena('<div class="apr-heroi">' +
    aprSurge('<span class="apr-marca">' + ic('home', 30) + '</span>', 0, 'apr-heroi-marca') +
    aprSurge(aprAviso('Renda confirmada', p.nome + ' · ' + aprDinheiro(ex.rendaDe('paranhos')), { icone: 'check', tom: 'in' }), 1, 'apr-heroi-a') +
    aprSurge(aprAviso('IMI a ' + aprData(imi), aprDinheiro(p.imi / 2) + ' · ' + p.nome, { icone: 'cal', tom: 'out' }), 2, 'apr-heroi-b') +
    aprSurge(aprAviso('Contrato a terminar', ines.inquilino + ' · faltam ' + ines.terminaEm + ' dias', { icone: 'clock', tom: 'amber' }), 3, 'apr-heroi-c') +
    '</div>', { tom: 'noite', arranjo: 'heroi' });
}

/* O próximo fim de prestação do IMI de 100 a 500 € (no fim de maio e no fim
   de novembro, imovel.js:imvImiFrase): a data do aviso dos parabéns e dos
   planeados.
   Devolve: a data em AAAA-MM-DD. */
function aprProximoIMI() {
  var hoje = today(), y = Number(hoje.slice(0, 4));
  return [y + '-05-31', y + '-11-30', (y + 1) + '-05-31'].filter(function (d) { return d > hoje; })[0];
}

/* A imagem do imóvel: o formulário «Novo imóvel» atrás (o nome, a morada e
   o destino) e, à frente, as despesas fixas que viram planeados.
   Devolve: o HTML da imagem. */
function aprBVImovel() {
  var p = APR_EXEMPLO.imovel('paranhos');
  return aprCena(aprPar(
    aprFolha('Novo imóvel', aprCampo('Nome', p.nome, { obrigatorio: true }) + aprCampo('Morada', p.morada) +
      '<span class="apr-m-rot">Destino do imóvel</span>' + aprSegmentado(['Arrendamento', 'Uso próprio'], 'Arrendamento')),
    aprCartao('<span class="apr-m-cartao-cab"><b>Despesas fixas</b><span class="apr-m-sub">viram planeados</span></span>' +
      aprLinha({ titulo: 'IMI', sub: 'maio e novembro', valor: aprDinheiro(p.imi) + '/ano' }) +
      aprLinha({ titulo: 'Condomínio', sub: 'dia 1', valor: aprDinheiro(p.condominio) + '/mês' }) +
      aprLinha({ titulo: 'Seguro', sub: 'uma vez por ano', valor: aprDinheiro(p.seguro) + '/ano' }), { flutua: true })
  ), { tom: 't0', arranjo: 'par' });
}

/* A imagem do inquilino: a lista dos Inquilinos atrás e, à frente, a ficha
   de um deles.
   Devolve: o HTML da imagem. */
function aprBVInquilino() {
  var ex = APR_EXEMPLO, s = ex.inquilino('sousa'), ct = ex.contrato('c4');
  var linha = function (id, alvo) {
    var t = ex.inquilino(id), im = ex.imovel(t.imovel);
    return aprLinha({ avatar: t.nome, titulo: t.nome, sub: im.nome + ' · ' + t.parte, alvo: alvo });
  };
  return aprCena(aprPar(
    aprCartao(aprSecao('Inquilinos', ex.inquilinos.length) + linha('ana') + linha('ines') + linha('sousa', true)),
    aprFolha(s.nome, '<span class="apr-m-ficha">' + aprAvatar(s.nome) + '<span><b>' + esc(s.nome) + '</b><span class="apr-m-sub">' +
        esc(ex.imovel('paranhos').nome + ' · ' + s.parte) + '</span></span></span>' +
      aprLinha({ titulo: 'Email', valor: s.email }) +
      aprLinha({ titulo: 'Contrato', valor: 'desde ' + ct.desde }) +
      aprLinha({ titulo: 'Documentos', valor: '2' }), { flutua: true })
  ), { tom: 't2', arranjo: 'par' });
}

/* A imagem do contrato: o imóvel e o inquilino, juntos num contrato, e por
   baixo a renda que ele deixa planeada.
   Devolve: o HTML da imagem. */
function aprBVContrato() {
  var ex = APR_EXEMPLO, ct = ex.contrato('c4'), p = ex.imovel('paranhos');
  var prox = aprProximoDia(ct.dia);
  return aprCena(aprColuna([
    '<div class="apr-m-junta">' + aprCartao(aprLinha({ capa: p.tom, titulo: p.nome, sub: 'Imóvel' })) +
      '<span class="apr-m-mais-sinal">' + ic('plus', 12) + '</span>' +
      aprCartao(aprLinha({ avatar: ct.inquilino, titulo: ct.inquilino, sub: 'Inquilinos' })) + '</div>',
    '<span class="apr-m-desce">' + ic('down', 13) + '</span>',
    aprCartao(aprLinha({ titulo: ct.inquilino, sub: ct.parte + ' · desde ' + ct.desde, valor: aprDinheiro(ct.renda) }) +
      aprLinha({ icone: 'repetir', titulo: 'Renda ' + ct.inquilino, sub: 'mensal, dia ' + ct.dia + ' · próxima ' + aprData(prox),
        selos: [['do contrato']], valor: aprDinheiro(ct.renda), tom: 'pos' }), { flutua: true }),
  ]), { tom: 't1', arranjo: 'coluna' });
}

/* A imagem dos planeados: o ecrã do Dinheiro → Planeados, com a renda por
   confirmar e o Confirmar em destaque, e o que vem a seguir das outras três
   origens — a hipoteca, as despesas fixas do imóvel e à mão
   (planeados.js:recOrigem).
   Devolve: o HTML da imagem. */
function aprBVPlaneados() {
  var ex = APR_EXEMPLO, ct = ex.contrato('c4'), p = ex.imovel('paranhos'), b = ex.imovel('bonfim'), h = ex.creditos[0], m = ex.aMao[0];
  var imi = aprProximoIMI();
  // sem o ecrã à volta (só as abas, para dizer onde é): as quatro origens têm de caber à vista
  return aprCena(aprColuna([
    aprAbas(APR_ABAS_DINHEIRO, 'Planeados'),
    aprCartao('<span class="apr-m-cartao-cab"><b>Por confirmar</b>' + aprSelo('hoje') + '</span>' +
      aprLinha({ titulo: 'Renda ' + ct.inquilino, sub: p.nome + ' · ' + aprData(aprDia(0)), selos: [['do contrato']],
        valor: aprDinheiro(ct.renda), tom: 'pos', botao: aprBotao('Confirmar', { primario: true, pequeno: true, icone: 'check', alvo: true }) }),
      { flutua: true }),
    aprCartao(
      aprLinha({ titulo: 'Prestação ' + h.nome + ' · ' + b.nome, sub: 'mensal, dia ' + h.dia + ' · ' + aprData(aprProximoDia(h.dia)),
        botao: aprSelo('da hipoteca', 'loan'), valor: aprDinheiro(-h.prestacao), tom: 'prest' }) +
      aprLinha({ titulo: 'IMI · ' + p.nome, sub: 'maio e novembro · ' + aprData(imi), botao: aprSelo('do imóvel', 'grey'),
        valor: aprDinheiro(-p.imi / 2), tom: 'neg' }) +
      aprLinha({ titulo: m.nome, sub: 'mensal, dia ' + m.dia + ' · ' + aprData(aprProximoDia(m.dia)), botao: aprSelo('à mão', 'grey'),
        valor: aprDinheiro(m.valor), tom: 'neg' })),
  ]), { tom: 't0', arranjo: 'coluna' });
}

/* A imagem dos modelos: a secção «A partir de um modelo» do «Criar», com um
   modelo em destaque, e por baixo a despesa que ele deixa preenchida.
   Devolve: o HTML da imagem. */
function aprBVModelos() {
  var ex = APR_EXEMPLO, md = ex.modelos[0], b = ex.imovel(md.imovel);
  return aprCena(aprColuna([
    aprCartao('<span class="apr-m-rot apr-m-maiusc">A partir de um modelo</span>' +
      aprChips([md.nome + ' · ' + b.nome, ex.modelos[1].nome, ex.modelos[2].nome], [], 0)),
    '<span class="apr-m-desce">' + ic('down', 12) + '</span>',
    aprFolha('Nova despesa', '<span class="apr-m-grelha">' + aprCampo('Descrição', md.nome, { obrigatorio: true }) +
      aprCampo('Montante (€)', dec(Number(md.valor).toFixed(2))) + aprCampo('Imóvel', b.nome) +
      aprCampo('Categoria', md.categoria) + aprCampo('Subcategoria', md.sub) + '</span>', { flutua: true }),
  ]), { tom: 't3', arranjo: 'coluna' });
}

/* A imagem do fim: sem imóveis, o vazio dos Imóveis com o «Adicionar
   imóvel» em destaque; com eles, dois cartões à espera.
   Devolve: o HTML da imagem. */
function aprBVFim() {
  var ex = APR_EXEMPLO, tem = typeof db !== 'undefined' && db && (db.properties || []).length > 0;
  var corpo = tem
    ? aprCartaoImovel(ex.imovel('paranhos')) + aprCartaoImovel(ex.imovel('bonfim'))
    : '<div class="apr-m-vazio"><b>Sem imóveis</b><span class="apr-m-sub">Adiciona o primeiro para começares a acompanhar o investimento.</span>' +
      aprBotao('Adicionar imóvel', { primario: true, alvo: true }) + '</div>';
  return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Imóveis', barra: 'casas', corpo: aprPesquisa() + corpo }),
    { tom: 't0', arranjo: 'tela' });
}

/* O título do fim, que se adapta a quem chega: sem imóveis, criar o
   primeiro; com imóveis seus (por uma partilha, por um grupo), os teus
   imóveis; quem só colabora, os imóveis (não são dele).
   Devolve: o texto. */
function aprBVFimTitulo() {
  if (aprSoColabora()) return 'Os imóveis já estão à tua espera';
  return typeof db !== 'undefined' && db && (db.properties || []).length ? 'Os teus imóveis já estão à tua espera' : 'Cria o teu primeiro imóvel';
}

/* O texto do fim, como o título: quem dá acesso e com que cargo
   (acessos.js:resumoColaborador), quantos imóveis já há, ou por onde se
   começa.
   Devolve: o HTML (de confiança: os nomes passam pelo esc). */
function aprBVFimTexto() {
  var n = typeof db !== 'undefined' && db ? (db.properties || []).length : 0;
  var quantos = n === 1 ? '1 imóvel' : n + ' imóveis';
  if (aprSoColabora()) {
    var r = resumoColaborador();
    return (r.donos.length ? '<b>' + esc(listaE(r.donos)) + '</b> deu-te acesso a ' : 'Tens acesso a ') + quantos +
      (r.cargos.length ? (r.cargos.length === 1 ? ', com o cargo <b>' : ', com os cargos <b>') + esc(listaE(r.cargos)) + '</b>' : '') +
      '. Estão em <b>Casas → Imóveis</b>.';
  }
  if (n) return 'Tens ' + quantos + ' em <b>Casas → Imóveis</b>. Toca num para veres a ficha: os contratos, os movimentos e as fotos.';
  return 'Basta o nome para começar. É dele que saem os contratos, as rendas e as contas.';
}

/* O botão do fim das boas-vindas: «Ir para os imóveis», que fecha e leva ao
   separador (sem abrir o formulário). Com os Imóveis desligados nesta
   conta, fica o «Percebi».
   Devolve: {rotulo, acao, toca}, ou null para o de omissão. */
function aprBVBotaoDoFim() {
  if (!servicoLigado('properties')) return null;
  return { rotulo: 'Ir para os imóveis', acao: aprIrParaOsImoveis, toca: 'ecra' };
}

/* «Ir para os imóveis»: fecha as boas-vindas (o aoFechar marca-as, e à Visão
   geral e aos Imóveis, como vistas) e leva aos Imóveis.
   Devolve: nada. */
function aprIrParaOsImoveis() {
  closeAllModals();
  go('properties');
}

registarApresentacao('boas-vindas', {
  nome: 'Boas-vindas',
  resumo: 'O essencial da app, e por onde começar',
  marcaTambem: ['dashboard', 'properties'],
  fim: aprBVBotaoDoFim,
  imagens: [
    { titulo: aprBVParabensTitulo,
      texto: 'Cada imóvel, cada contrato e cada euro no sítio certo, e a app a lembrar-te do que vem a seguir.',
      maquete: aprBVParabens },
    { titulo: 'Tudo começa num imóvel',
      texto: 'Em <b>Casas → Imóveis</b>, cada casa que tens é um imóvel, e o nome chega para começar. O IMI, o condomínio e o seguro que lhe juntares passam a ser lembrados na data.',
      maquete: aprBVImovel, quando: function () { return aprPodeCriar('properties'); } },
    { titulo: 'Uma ficha por inquilino',
      texto: 'Em <b>Casas → Pessoas → Inquilinos</b>, cada pessoa tem a sua ficha: os contactos, o NIF, os documentos e as notas. Só o nome é obrigatório.',
      maquete: aprBVInquilino, quando: function () { return aprPodeCriar('tenants', 'tenant.add'); } },
    { titulo: 'O contrato junta tudo',
      texto: 'Em <b>Casas → Contratos</b>, um contrato liga o imóvel aos inquilinos, com a renda e as datas. Ao guardares, a renda de cada mês fica planeada.',
      maquete: aprBVContrato, quando: function () { return aprPodeCriar('contracts', 'contract.add'); } },
    { titulo: 'O que se repete fica planeado',
      texto: 'Em <b>Dinheiro → Planeados</b> chega a renda dos contratos, a prestação das hipotecas, o IMI, o condomínio e o seguro, e o que crias à mão. Na data, <b>Confirmar</b> regista o movimento e agenda o seguinte.',
      maquete: aprBVPlaneados, quando: function () { return aprPodeCriar('recurring', 'rec.add'); } },
    { titulo: 'Modelos para o que não tem data',
      texto: 'Um modelo é um movimento guardado para copiar. Depois de o criares (<b>Criar → Modelo</b>), um toque em <b>Criar → A partir de um modelo</b> preenche o tipo, o valor, o imóvel e a categoria: escreves uma vez, e das outras só revês e guardas.',
      maquete: aprBVModelos, quando: function () { return aprPodeCriar('recurring', 'rec.add'); } },
    { titulo: aprBVFimTitulo, texto: aprBVFimTexto, maquete: aprBVFim },
  ],
});

/* ---------------------------------------------------------- os embrulhos */

/* Quem avisa que o ecrã pode ter ficado livre, pela reatribuição da casa
   (a nuvem embrulha a base assim: cloud/nucleo.js, cloud/guia.js): o render
   (a chegada a um separador, por qualquer caminho, e o estado do servidor
   adotado), o fecho de uma janela e da gaveta, o aviso inicial e os termos
   aceites, e o tutorial fechado. O render do vizinho que o carrossel dos
   separadores pinta às escondidas (vistas.js:pintarVistaAParte) não conta. */
var aprRenderDeAntes = render;
render = function () {
  var r = aprRenderDeAntes.apply(this, arguments);
  if (!(typeof _pintarAParte !== 'undefined' && _pintarAParte)) {
    // saiu-se do ecrã onde as boas-vindas fecharam: a apresentação dele já pode abrir na próxima chegada
    var ecra = aprIdDoEcra();
    if (ecra !== _aprUltimoEcra) { _aprUltimoEcra = ecra; if (ecra !== _aprAdiado) _aprAdiado = ''; }
    aprAgendar();
  }
  return r;
};
['closeModal', 'closeAllModals', 'closeDrawer'].forEach(function (nome) {
  var antes = window[nome];
  if (typeof antes !== 'function') return;
  window[nome] = function () {
    var r = antes.apply(this, arguments);
    aprAgendar();
    return r;
  };
});
['acceptLegal', 'acceptTerms', 'guiaFechar'].forEach(function (nome) {
  var antes = window.CW && CW[nome];
  if (typeof antes !== 'function') return;
  CW[nome] = function () {
    var r = antes.apply(this, arguments);
    aprAgendar();
    return r;
  };
});
/* Uma leitura do estado a meio tapa o ecrã: aceitar um convite lê o estado
   (pullNow) e só depois abre a confirmação, e as boas-vindas não podem
   passar-lhe à frente nesse intervalo. Conta-se ao entrar e ao sair, e
   sair avisa — o estado igual (sem repintura) também. */
var aprPullDeAntes = typeof pullNow === 'function' ? pullNow : null;
if (aprPullDeAntes) {
  pullNow = function () {
    _aprLeituras++;
    var fim = function () { _aprLeituras = Math.max(0, _aprLeituras - 1); aprAgendar(); };
    var p = aprPullDeAntes.apply(this, arguments);
    return Promise.resolve(p).then(function (v) { fim(); return v; }, function (e) { fim(); throw e; });
  };
}
