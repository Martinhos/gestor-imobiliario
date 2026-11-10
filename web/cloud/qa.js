/* ===== TICKETS DE QA ===== */
/* O botão de QA do ambiente de desenvolvimento: uma pílula que se arrasta para
   a borda que estorvar menos e abre «Novo ticket» e «Ver tickets». Os tickets
   vão para a D1 do ambiente (worker/src/rotas/qa.js) com o contexto do ecrã,
   e o Claude lê-os com scripts/qa.mjs. Em produção nada disto existe: nem a
   pílula (CW.ambiente === 'producao') nem as rotas (404 sem ENV_NAME). */
'use strict';

/* Um ticket está sempre numa coluna do kanban da equipa (as mesmas colunas,
   a decisão do Martinho, 2026-11-10): o status guarda o id da coluna onde
   está o cartão dele (migrations/0029_qa_no_kanban.sql), e mover o cartão no
   kanban move o ticket, e vice-versa. As fixas: A fazer ('a-fazer', onde
   nasce e para onde volta ao reabrir), Auto Tests ('auto-tests', quando o
   scripts/qa.mjs comecar pega nele), Human Tests ('human-tests', resolvido e
   à espera de quem testa) e Concluído ('concluido', de fim); e as que o
   master criar (Para depois, ou outras, com id uuid). O GET /api/qa traz as
   colunas pela ordem do quadro, e a lista mostra uma secção por coluna.
   «Por resolver» são os de A fazer e de Auto Tests: é esse o número da
   pílula. Resolvido é estar em Human Tests ou numa coluna de fim: aí o
   resolved_at está posto, e o ticket reabre-se.

   O desenho (a opção C que o Martinho escolheu, 2026-10-28): a pega de pontos,
   o ícone, «QA» e o número por resolver, num roxo (--loan) que não se confunde
   com o cobalto das ações da app. A pega fica do lado da borda onde a pílula
   encostou (o data-lado que o qaPor escreve; a troca é da folha), e só muda
   ao largar, nunca a meio do arrasto. Na primeira vez, ao lado, a
   etiqueta «Arrasta para mudar de sítio», até ao primeiro arrasto.

   Arrasta-se com o rato, o dedo e a caneta (pointer events; o touch-action da
   pílula entrega o gesto à app). Até o ponteiro andar QA_LIMIAR é um toque, e
   o clique abre o menu; daí em diante é um arrasto, segue o ponteiro, e o
   clique que o browser dá a seguir engole-se (qaEngoleClique). Ao largar,
   cola à borda esquerda ou direita mais perto, à altura do largar, presa às
   margens (qaEncaixe), e lembra-se neste aparelho como lado + fração da
   altura útil — sobrevive a rodar o telemóvel e a encolher a janela, que
   reencaixam. As setas fazem o mesmo sem rato.

   A altura útil acaba acima da barra de baixo do telemóvel (e da barra da
   seleção): a pílula nunca a tapa. À esquerda, no computador, começa a seguir
   à barra lateral. Fica por cima do conteúdo e por baixo do véu da gaveta, da
   barra lateral, das janelas e dos portões (estilos.css, o bloco «tickets de
   QA»). */

/* ---------------------------------------------------------------- estado */

// onde a pílula fica neste aparelho: {lado: 'esq'|'dir', y: fração da altura útil, 0 a 1}
var QA_LS_POSICAO = 'gi_qa_posicao';
// a pílula já foi arrastada (ou mudada pelas setas) neste aparelho: a etiqueta não volta
var QA_LS_ARRASTOU = 'gi_qa_arrastou';
// px que o ponteiro anda antes de o gesto passar a arrasto (os 10px de decidir do aviso e da folha)
var QA_LIMIAR = 10;
// px entre a pílula e a borda do sítio onde ela pode estar
var QA_MARGEM = 12;
// onde nasce: à direita, a 80% da altura útil — acima da barra de baixo e longe do aviso
var QA_POSICAO_INICIAL = { lado: 'dir', y: 0.8 };
// quanto anda uma seta na vertical (fração da altura útil)
var QA_PASSO_TECLA = 0.05;
// a distância (px) a partir da qual o encaixe atravessa o ecrã: --lento em vez de --medio
var QA_LONGE = 320;
// quanto tempo (ms) o clique a seguir a um arrasto se engole (o do aviso e da folha)
var QA_ENGOLE_MS = 350;
// o maior lado da captura de ecrã depois de encolhida (px)
var QA_IMAGEM_LADO = 1600;
// o teto do servidor para a captura (bytes): o PUT recusa acima disto
var QA_IMAGEM_MAX = 3 * 1024 * 1024;
// quantas entradas do rasto vão com o ticket, e com quantos caracteres cada uma
var QA_RASTO_MAX = 10;
var QA_RASTO_LETRAS = 120;
// as gravidades, pela ordem do segmentado, com o rótulo e a cor do selo
var QA_GRAVIDADES = [
  { v: 'bloqueia', rotulo: 'Bloqueia', cor: 'red' },
  { v: 'incomoda', rotulo: 'Incomoda', cor: 'amber' },
  { v: 'detalhe', rotulo: 'Detalhe', cor: 'grey' },
];
// as colunas do kanban que a pílula conhece pelo nome (worker/src/lib/kanban.js: QA_NOVO, QA_EM_CURSO, QA_RESOLVIDO)
var QA_COL_NOVO = 'a-fazer';
var QA_COL_EM_CURSO = 'auto-tests';
var QA_COL_RESOLVIDO = 'human-tests';
// para onde vão as decisões de quem testa um ticket em Human Tests: «Aceitar» e «Adiar» (qaRodapeTicket)
var QA_COL_CONCLUIDO = 'concluido';
var QA_COL_DEPOIS = 'para-depois';
// as colunas quando o servidor não as manda (um servidor de antes da 0029), pela ordem do quadro
var QA_COLUNAS_OMISSAO = [
  { id: 'a-fazer', nome: 'A fazer', fim: false },
  { id: 'auto-tests', nome: 'Auto Tests', fim: false },
  { id: 'human-tests', nome: 'Human Tests', fim: false },
  { id: 'concluido', nome: 'Concluído', fim: true },
  { id: 'para-depois', nome: 'Para depois', fim: false },
];
// a forma de um id de coluna (lib/kanban.js:ID_DE_COLUNA): os slugs das fixas e os uuid das que o master cria
var QA_ID_COLUNA = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
// as secções da lista que se tocaram neste aparelho: {chave: true (aberta) ou false (recolhida)}
var QA_LS_DOBRAS = 'gi_qa_dobras';
// as secções dos grupos de gravidade de A fazer; as das colunas têm o id da coluna como chave
var QA_DOBRAS_GRUPOS = QA_GRAVIDADES.map(function (g) { return 'g-' + g.v; }).concat(['g-sem']);
// as colunas que nascem recolhidas enquanto ninguém lhes tocou, além das de fim: o que fica para depois
var QA_DOBRAS_FECHADAS = ['para-depois'];

var qaPil = null;            // o elemento da pílula (#qaPilula); null fora do dev ou sem sessão
var qaSonda = null;          // a sonda das margens seguras (#qaSonda)
var qaXY = null;             // onde a pílula está agora, {x, y} em px (o canto de cima à esquerda)
var qaArr = null;            // o arrasto em curso
var qaAnim = null;           // a animação do encaixe em curso
var qaEngoleAte = 0;         // até quando (Date.now) se engole o clique a seguir a um arrasto
var qaArrastouAqui = false;  // o mesmo que QA_LS_ARRASTOU, para quando o armazenamento está vedado
var qaPonteiro = '';         // o ponteiro do último toque na pílula: 'touch', 'mouse', 'pen' ou 'teclado'
var qaContextoGuardado = null;   // o ecrã no momento em que se abriu o menu
var qaLista = { tickets: null, falhou: false, aPedir: null, colunas: null };   // tickets: null quer dizer «ainda não se sabe»; colunas: as do kanban (null: as de omissão)
var qaAbertos = null;        // quantos tickets por resolver (em A fazer e em Auto Tests); null enquanto não se sabe
var qaRascunho = null;       // o ticket a ser escrito: {gravidade, imagem, url, id, aEnviar, contexto, camada}
var qaCamadaLista = null;    // a camada da janela «Tickets de QA», enquanto aberta
var qaCamadaTicket = null;   // a camada da janela de um ticket, enquanto aberta
var qaOcupado = {};          // id → 1: um pedido de remover, reabrir ou mover esse ticket a caminho
var qaTamanhoPedido = 0;     // o requestAnimationFrame do reencaixe ao mudar de tamanho
var qaDobrasAqui = {};       // o mesmo que QA_LS_DOBRAS, para quando o armazenamento está vedado

/* ------------------------------------------------------ existir ou não */

/* A pílula existe aqui? Só fora de produção — o CW.ambiente chega do
   servidor depois do arranque (cloud/guia.js) e até lá vale 'producao' — e
   com sessão, porque as rotas a pedem.
   Devolve: true ou false. */
function qaDeveExistir() {
  return !!(window.CW && CW.ambiente && CW.ambiente !== 'producao' && CW.user);
}

/* Põe a pílula no ecrã ou tira-a, conforme o qaDeveExistir. Corre a cada
   render (o embrulho no fim do ficheiro): é o render que chega quando o
   ambiente é conhecido, quando se entra e quando se sai. Com a pílula já no
   ecrã, volta a encaixá-la (a barra da seleção pode ter aparecido) — menos a
   meio de um arrasto ou de um encaixe.
   Devolve: true se a pílula ficou no ecrã. */
function qaSincronizar() {
  if (!qaDeveExistir()) { qaRemoverPilula(); return false; }
  if (!qaPil) { qaCriarPilula(); qaCarregar(); }
  else if (!qaArr && !qaAnim) qaReencaixar();
  return true;
}

/* Cria a pílula e a sonda das margens seguras, pendura-as no body, liga o
   arrasto e as setas, e põe a pílula no sítio guardado.
   Devolve: nada. */
function qaCriarPilula() {
  var s = document.createElement('div');
  s.id = 'qaSonda'; s.className = 'qa-sonda';
  s.setAttribute('aria-hidden', 'true');
  document.body.appendChild(s);
  qaSonda = s;
  var p = document.createElement('div');
  p.id = 'qaPilula'; p.className = 'qa-pilula entra';
  p.innerHTML = qaHtmlPilula(qaAbertos, qaEtiquetaVisivel());
  document.body.appendChild(p);
  qaPil = p;
  p.addEventListener('pointerdown', qaPousar);
  var b = qaBotao();
  if (b && typeof b.addEventListener === 'function') b.addEventListener('keydown', qaTecla);
  qaReencaixar();
}

/* Tira a pílula e a sonda do ecrã (saiu-se da sessão, ou o ambiente é o de
   produção) e larga um arrasto ou um encaixe a meio.
   Devolve: nada. */
function qaRemoverPilula() {
  if (qaArr) qaArrastoLargar();
  qaPararAnim();
  try { if (qaPil) qaPil.remove(); } catch (e) {}
  try { if (qaSonda) qaSonda.remove(); } catch (e) {}
  qaPil = null; qaSonda = null; qaXY = null;
}

/* O botão da pílula (o que se toca e se arrasta).
   Devolve: o elemento, ou null sem pílula. */
function qaBotao() {
  return qaPil && typeof qaPil.querySelector === 'function' ? qaPil.querySelector('.qa-botao') : null;
}

/* ------------------------------------------------------------ o desenho */

/* O HTML de dentro da pílula: o botão (pega, ícone, «QA», número), o menu
   da casa (.menupop, aberto pelo menuOpen — o closePops, o Escape e o
   aria-expanded são os de todos os menus ⋯), a frase para o leitor de ecrã,
   e a etiqueta da primeira vez. O data-menu="acoes" diz ao percurso que é um
   menu de ações com nome próprio, e não a porta das opções de um registo
   (testes/ui/invariantes.js, «a porta das opções é sempre a mesma»).
   Recebe: n — quantos tickets por resolver (null se ainda não se sabe);
   comEtiqueta — true para mostrar «Arrasta para mudar de sítio».
   Devolve: o HTML (texto). */
function qaHtmlPilula(n, comEtiqueta) {
  return '<span class="menuwrap qa-envolve" data-menu="acoes">' +
      '<button type="button" class="qa-botao" data-toca="camada" data-click="menuOpen(event,\'qa\');qaMenuAbriu(event)" ' +
        'aria-expanded="false" aria-label="' + esc(qaRotuloDoBotao(n)) + '" aria-describedby="qaDica">' +
        '<span class="qa-pega" aria-hidden="true">' + ic('grip', 16) + '</span>' +
        '<span class="qa-ic" aria-hidden="true">' + ic('inseto', 16) + '</span>' +
        '<span class="qa-nome" aria-hidden="true">QA</span>' +
        '<span class="qa-n" aria-hidden="true"' + (n > 0 ? '' : ' hidden') + '>' + qaNumeroCurto(n) + '</span>' +
      '</button>' +
      '<div class="menupop qa-menu" id="menu_qa">' + qaHtmlMenu(n) + '</div>' +
    '</span>' +
    '<span class="qa-so-leitor" id="qaDica">Arrasta, ou usa as setas, para mudar o botão de sítio.</span>' +
    (comEtiqueta ? '<span class="qa-etiqueta" aria-hidden="true">Arrasta para mudar de sítio</span>' : '');
}

/* global QA_EQUIPA -- definido pela camada do back office (worker/src/equipa-qa.js:CABECA_DA_EQUIPA); só se lê depois de o qaLugar dizer 'equipa' */

/* As opções do menu da pílula, conforme o sítio (qaLugar):
   - na app: «Novo ticket», «Ver tickets», «Ver a montra» e «Back office»;
   - nas páginas públicas (a montra e o guia): «Novo ticket», «Ver tickets»,
     «Voltar à app» e «Back office»;
   - no back office: «Novo ticket» e «Ver tickets» e, quando a sessão de
     teste de quem lá está abre a app (QA_EQUIPA.app, que o worker calcula
     com a porta do dev), também «Ver a montra» e «Voltar à app» — sem
     «Back office», que é onde já se está.
   A montra fora da raiz é o /montra (worker/src/index.js), e no dev só abre
   com a sessão de uma conta de teste: a APK de dev não tem barra de
   endereços, e as ligações do /test abrem nela, não no browser — sem estas
   opções não havia como andar entre a app, a montra e o back office no
   telemóvel. No back office, quem entrou pela sessão de teste
   (equipa.js:entrarPelaSessaoDeTeste) tem o cookie dela e passa a porta do
   dev; quem entrou pelo /entrar do Discord, sem ela, levaria o 404 da
   porta, e então o menu fica só com os tickets.
   Recebe: n — quantos tickets por resolver (null se ainda não se sabe).
   Devolve: o HTML (texto). */
function qaHtmlMenu(n) {
  var lugar = qaLugar();
  var daEquipaComApp = lugar === 'equipa' && !!QA_EQUIPA && QA_EQUIPA.app === true;
  return '<button type="button" data-toca="camada" data-click="closePops();qaNovoTicket()">' + ic('plus', 17) + ' Novo ticket</button>' +
    '<button type="button" class="qa-menu-ver" data-toca="camada" data-click="closePops();qaVerTickets()">' + ic('lista', 17) + ' ' + esc(qaRotuloVer(n)) + '</button>' +
    (lugar === 'app' || daEquipaComApp ? '<button type="button" class="qa-menu-montra" data-toca="camada" data-click="closePops();qaVerMontra()">' + ic('door', 17) + ' Ver a montra</button>' : '') +
    (lugar === 'paginas' || daEquipaComApp ? '<button type="button" class="qa-menu-app" data-toca="camada" data-click="closePops();qaVoltarApp()">' + ic('home', 17) + ' Voltar à app</button>' : '') +
    (lugar === 'equipa' ? '' : '<button type="button" class="qa-menu-equipa" data-toca="camada" data-click="closePops();qaBackOffice()">' + ic('users', 17) + ' Back office</button>');
}

/* Onde está a pílula. A camada do worker (worker/src/equipa-qa.js) define,
   no mesmo âmbito que este ficheiro, o QA_PAGINAS nas páginas públicas e o
   QA_EQUIPA no back office; na app não existe nenhum dos dois.
   Devolve: 'paginas', 'equipa' ou 'app'. */
function qaLugar() {
  if (typeof QA_PAGINAS !== 'undefined') return 'paginas';
  if (typeof QA_EQUIPA !== 'undefined') return 'equipa';
  return 'app';
}

/* A pílula está no back office?
   Devolve: true ou false. */
function qaNaEquipa() {
  return qaLugar() === 'equipa';
}

/* Vai para a montra (e daí para os guias) neste separador — na APK de dev,
   no mesmo WebView, que leva o cookie da sessão de teste. O «voltar» do
   telemóvel ou do browser regressa à app.
   Devolve: nada. */
function qaVerMontra() {
  location.href = '/montra';
}

/* Das páginas públicas, volta à app (o / do dev), neste separador.
   Devolve: nada. */
function qaVoltarApp() {
  location.href = '/';
}

/* Vai para o back office (/equipa), neste separador. Lá a sessão é a da
   equipa, pelo Discord: sem ela, o /equipa diz como se entra.
   Devolve: nada. */
function qaBackOffice() {
  location.href = '/equipa';
}

/* O número da pílula, curto: 99+ a partir de cem.
   Recebe: n — quantos tickets por resolver.
   Devolve: o texto ('' sem número). */
function qaNumeroCurto(n) {
  if (!(n > 0)) return '';
  return n > 99 ? '99+' : String(n);
}

/* O nome do botão para o leitor de ecrã, com o número dito por extenso.
   Recebe: n — quantos tickets por resolver (null se ainda não se sabe).
   Devolve: o texto. */
function qaRotuloDoBotao(n) {
  if (n == null) return 'Tickets de QA';
  if (n === 0) return 'Tickets de QA, nenhum por resolver';
  return 'Tickets de QA, ' + n + ' por resolver';
}

/* O rótulo da segunda opção do menu: «Ver tickets (N)», com N os por resolver.
   Recebe: n — quantos tickets por resolver (null se ainda não se sabe).
   Devolve: o texto. */
function qaRotuloVer(n) {
  return n == null ? 'Ver tickets' : 'Ver tickets (' + n + ')';
}

/* Escreve o número por resolver na pílula e no menu, sem a refazer (o menu
   pode estar aberto). A largura muda com o número, e à direita isso muda o
   x: reencaixa.
   Devolve: nada. */
function qaPintarNumero() {
  if (!qaPil || typeof qaPil.querySelector !== 'function') return;
  var n = qaAbertos, num = qaPil.querySelector('.qa-n'), b = qaBotao(), ver = qaPil.querySelector('.qa-menu-ver');
  if (num) {
    num.textContent = qaNumeroCurto(n);
    if (n > 0) num.removeAttribute('hidden'); else num.setAttribute('hidden', '');
  }
  if (b) b.setAttribute('aria-label', qaRotuloDoBotao(n));
  if (ver) ver.innerHTML = ic('lista', 17) + ' ' + esc(qaRotuloVer(n));
  if (!qaArr && !qaAnim) qaReencaixar();
}

/* ------------------------------------------------- a etiqueta da 1.ª vez */

/* A etiqueta «Arrasta para mudar de sítio» ainda aparece? Até ao primeiro
   arrasto neste aparelho (localStorage); com o armazenamento vedado, até ao
   primeiro arrasto desta sessão.
   Devolve: true ou false. */
function qaEtiquetaVisivel() {
  if (qaArrastouAqui) return false;
  try { return localStorage.getItem(QA_LS_ARRASTOU) !== '1'; } catch (e) { return true; }
}

/* A pílula foi mudada de sítio pela primeira vez: a etiqueta desvanece
   (estilos.css, .qa-etiqueta.sai) e sai do documento, e não volta.
   Devolve: nada. */
function qaMarcarArrastado() {
  if (!qaEtiquetaVisivel()) return;
  qaArrastouAqui = true;
  try { localStorage.setItem(QA_LS_ARRASTOU, '1'); } catch (e) {}
  var et = qaPil && typeof qaPil.querySelector === 'function' ? qaPil.querySelector('.qa-etiqueta') : null;
  if (!et) return;
  if (semMovimento()) { try { et.remove(); } catch (e) {} return; }
  et.classList.add('sai');
  setTimeout(function () { try { et.remove(); } catch (e) {} }, msDoToken('--medio', 200) + 120);
}

/* --------------------------------------------------- a posição e o encaixe */

/* Onde a pílula pode estar, medido agora: a área segura (a sonda, que usa as
   --inset-* do :root) menos QA_MARGEM; à esquerda, a seguir à barra lateral
   quando ela é uma coluna (no computador); em baixo, acima da barra de baixo
   do telemóvel e da barra das ações da seleção, quando estão à vista.
   Devolve: {esq, dir, topo, fundo, pw, ph} em px — os limites e a largura e
   altura da pílula. */
function qaLimites() {
  var W = (document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 0;
  var H = window.innerHeight || 0;
  var seg = { left: 0, top: 0, right: W, bottom: H };
  if (qaSonda && typeof qaSonda.getBoundingClientRect === 'function') {
    var rs = qaSonda.getBoundingClientRect();
    if (rs && rs.width > 0 && rs.height > 0) seg = rs;
  }
  var cx = { esq: seg.left + QA_MARGEM, dir: seg.right - QA_MARGEM, topo: seg.top + QA_MARGEM, fundo: seg.bottom - QA_MARGEM };
  // nas páginas públicas um <aside> é um cartão do texto, não a barra lateral
  var aside = qaLugar() === 'paginas' ? null : document.querySelector('aside');
  if (aside && typeof aside.getBoundingClientRect === 'function') {
    var ra = aside.getBoundingClientRect(), fixo = false;
    try { fixo = getComputedStyle(aside).position === 'fixed'; } catch (e) {}
    if (!fixo && ra && ra.width > 0 && ra.right > 0 && ra.right < W / 2) cx.esq = Math.max(cx.esq, ra.right + QA_MARGEM);
  }
  [document.getElementById('tabbar'), document.querySelector('.sel-fundo')].forEach(function (barra) {
    if (!barra || typeof barra.getBoundingClientRect !== 'function') return;
    var r = barra.getBoundingClientRect();
    if (r && r.height > 0 && r.width > 0 && r.top < H && r.top > H / 2) cx.fundo = Math.min(cx.fundo, r.top - QA_MARGEM);
  });
  // com uma janela à frente (que não seja do QA), a pílula sobe acima dela e
  // fica acima do rodapé, para nunca tapar os botões que se pedem
  var janelas = document.querySelectorAll('.modal.open');
  var frente = janelas.length ? janelas[janelas.length - 1] : null;
  var pe = frente && !frente.classList.contains('qa-janela') ? frente.querySelector('.foot') : null;
  if (pe && typeof pe.getBoundingClientRect === 'function') {
    var rp = pe.getBoundingClientRect();
    if (rp && rp.height > 0 && rp.width > 0 && rp.top > H / 3) cx.fundo = Math.min(cx.fundo, rp.top - QA_MARGEM);
  }
  cx.pw = (qaPil && qaPil.offsetWidth) || 96;
  cx.ph = (qaPil && qaPil.offsetHeight) || 44;
  return cx;
}

/* O encaixe de um largar: a borda mais perto do centro da pílula, à altura
   onde ela ficou, presa entre o topo e o fundo. Geometria pura.
   Recebe: ponto — {x, y}, o canto de cima à esquerda da pílula ao largar;
   cx — os limites (qaLimites: {esq, dir, topo, fundo, pw, ph}).
   Devolve: {lado: 'esq'|'dir', fracao (0 a 1, da altura útil), x, y} — o
   sítio onde a pílula fica. */
function qaEncaixe(ponto, cx) {
  var centro = ponto.x + cx.pw / 2;
  var lado = centro < (cx.esq + cx.dir) / 2 ? 'esq' : 'dir';
  var yMax = Math.max(cx.topo, cx.fundo - cx.ph), faixa = yMax - cx.topo;
  var y = Math.min(Math.max(ponto.y, cx.topo), yMax);
  var fracao = faixa > 0 ? Math.round(((y - cx.topo) / faixa) * 10000) / 10000 : 0;
  return { lado: lado, fracao: fracao, x: lado === 'esq' ? cx.esq : cx.dir - cx.pw, y: y };
}

/* O sítio, em px, de uma posição guardada, nos limites de agora: é o que faz
   a posição sobreviver a rodar o ecrã e a encolher a janela.
   Recebe: pos — {lado, y (fração)}; cx — os limites (qaLimites).
   Devolve: {x, y} em px. */
function qaPosicaoDe(pos, cx) {
  var yMax = Math.max(cx.topo, cx.fundo - cx.ph);
  var f = Math.min(Math.max(Number(pos.y) || 0, 0), 1);
  return { x: pos.lado === 'esq' ? cx.esq : Math.max(cx.esq, cx.dir - cx.pw), y: cx.topo + (yMax - cx.topo) * f };
}

/* A posição guardada neste aparelho, validada; sem nenhuma (ou estragada), a
   inicial.
   Devolve: {lado, y}. */
function qaLerPosicao() {
  var p = null;
  try { p = JSON.parse(localStorage.getItem(QA_LS_POSICAO) || 'null'); } catch (e) { p = null; }
  if (!p || (p.lado !== 'esq' && p.lado !== 'dir') || typeof p.y !== 'number' || !isFinite(p.y)) {
    return { lado: QA_POSICAO_INICIAL.lado, y: QA_POSICAO_INICIAL.y };
  }
  return { lado: p.lado, y: Math.min(Math.max(p.y, 0), 1) };
}

/* Guarda a posição neste aparelho (sem armazenamento, fica só nesta sessão:
   a pílula está onde está).
   Recebe: pos — {lado, y}.
   Devolve: nada. */
function qaGuardarPosicao(pos) {
  try { localStorage.setItem(QA_LS_POSICAO, JSON.stringify({ lado: pos.lado, y: pos.y })); } catch (e) {}
}

/* Põe a pílula num sítio, sem animar: o transform do elemento (a CSP não
   deixa style= no HTML; o JavaScript escreve o transform direto).
   Recebe: xy — {x, y} em px; lado (opcional) — 'esq' ou 'dir', para a
   etiqueta e o menu abrirem para dentro do ecrã e a pega ficar virada para
   a borda (estilos.css, bloco «tickets de QA»). O arrasto não o passa: o
   lado só muda ao largar (qaArrastoFim), as setas e o reencaixe.
   Devolve: nada. */
function qaPor(xy, lado) {
  if (!qaPil) return;
  qaXY = { x: Math.round(xy.x), y: Math.round(xy.y) };
  qaPil.style.transform = qaTransform(qaXY);
  if (lado) qaPil.setAttribute('data-lado', lado);
}

/* O texto do transform de um sítio.
   Recebe: xy — {x, y} em px.
   Devolve: o texto 'translate3d(…)'. */
function qaTransform(xy) {
  return 'translate3d(' + Math.round(xy.x) + 'px,' + Math.round(xy.y) + 'px,0)';
}

/* Põe a pílula na posição guardada, nos limites de agora, sem animar (a
   criação, o render, mudar de tamanho, o número que muda a largura, as
   setas).
   Devolve: nada. */
function qaReencaixar() {
  if (!qaPil) return;
  var pos = qaLerPosicao();
  qaPor(qaPosicaoDe(pos, qaLimites()), pos.lado);
}

/* Onde a pílula está a ser desenhada agora, contando com a animação do
   encaixe que a estiver a levar (o transform calculado).
   Devolve: {x, y} em px. */
function qaOndeEsta() {
  var xy = qaXY || { x: 0, y: 0 };
  try {
    var t = getComputedStyle(qaPil).transform || '';
    var m3 = /matrix3d\(([^)]*)\)/.exec(t), m2 = /matrix\(([^)]*)\)/.exec(t);
    if (m3) { var a = m3[1].split(','); return { x: parseFloat(a[12]) || 0, y: parseFloat(a[13]) || 0 }; }
    if (m2) { var b = m2[1].split(','); return { x: parseFloat(b[4]) || 0, y: parseFloat(b[5]) || 0 }; }
  } catch (e) {}
  return xy;
}

/* Para a animação do encaixe onde ela estiver.
   Devolve: nada. */
function qaPararAnim() {
  var an = qaAnim;
  qaAnim = null;
  try { if (an) an.cancel(); } catch (e) {}
}

/* O encaixe ao largar: a pílula fica já no sítio final (o transform do
   elemento), e uma animação leva-a de onde o ponteiro a deixou até lá —
   pela API de animações, porque o ponto de partida só se sabe no fim do
   gesto, e pode ser apanhada a meio (qaPousar). Só o transform; o --medio na
   --curva-entra, que é a curva de quem atravessa distância, e o --lento
   quando atravessa o ecrã (mais de QA_LONGE). Sem movimento, fica logo lá.
   A pega troca de lado no primeiro fotograma deste deslizar, sem movimento
   próprio: o olho segue a pílula a andar, e uma segunda animação dentro
   dela só competiria com a do encaixe.
   Recebe: de — {x, y} onde a pílula está; para — {x, y} onde fica; lado — 'esq' ou 'dir'.
   Devolve: nada. */
function qaDeslizar(de, para, lado) {
  qaPararAnim();
  qaPor(para, lado);
  if (!qaPil || typeof qaPil.animate !== 'function' || semMovimento()) return;
  var dist = Math.sqrt(Math.pow(para.x - de.x, 2) + Math.pow(para.y - de.y, 2));
  if (dist < 1) return;
  var longe = dist > QA_LONGE, dur = longe ? msDoToken('--lento', 340) : msDoToken('--medio', 200);
  var an = qaPil.animate([{ transform: qaTransform(de) }, { transform: qaTransform(para) }],
    { duration: dur, easing: tokenTexto('--curva-entra', 'cubic-bezier(0,0,.2,1)') });
  qaAnim = an;
  var fim = function () { if (qaAnim === an) qaAnim = null; };
  an.onfinish = fim;
  // a rede de sempre: num separador escondido o onfinish não chega
  setTimeout(fim, dur + 120);
}

/* ------------------------------------------------------------- o arrasto */

/* O ponteiro pousou na pílula: fica-se à escuta do arrasto. Pegar nela a
   meio do encaixe apanha-a onde está, sem salto. Os botões do menu (dentro
   da pílula) não arrastam.
   Recebe: e — o PointerEvent do pointerdown (ouvido na pílula).
   Devolve: nada — liga os ouvintes do documento. */
function qaPousar(e) {
  if (!qaPil || qaArr || !e || e.button > 0 || e.isPrimary === false) return;
  var alvo = e.target;
  if (alvo && typeof alvo.closest === 'function' && !alvo.closest('.qa-botao')) return;
  qaPonteiro = e.pointerType || '';
  var xy = qaXY || { x: 0, y: 0 };
  if (qaAnim) { xy = qaOndeEsta(); qaPararAnim(); qaPor(xy); }
  qaArr = { id: e.pointerId, tipo: e.pointerType || '', x0: e.clientX, y0: e.clientY, ox: xy.x, oy: xy.y, ativo: false, cx: null };
  document.addEventListener('pointermove', qaArrastoMove);
  document.addEventListener('pointerup', qaArrastoFim);
  document.addEventListener('pointercancel', qaArrastoFim);
}

/* O ponteiro andou: passado o QA_LIMIAR, o gesto é um arrasto — a pílula
   segue o ponteiro (só o transform, sem transição), presa ao ecrã, o menu
   fecha-se e a etiqueta da primeira vez sai.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada. */
function qaArrastoMove(e) {
  var a = qaArr;
  if (!a || !e || e.pointerId !== a.id) return;
  var dx = e.clientX - a.x0, dy = e.clientY - a.y0;
  if (!a.ativo) {
    if (Math.sqrt(dx * dx + dy * dy) < QA_LIMIAR) return;
    a.ativo = true;
    a.cx = qaLimites();
    a.W = (document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 0;
    a.H = window.innerHeight || 0;
    try { qaPil.setPointerCapture(a.id); } catch (x) {}
    qaPil.classList.add('arrastar');
    if (typeof closePops === 'function') closePops();
    qaMarcarArrastado();
  }
  var x = Math.min(Math.max(a.ox + dx, 0), Math.max(0, a.W - a.cx.pw));
  var y = Math.min(Math.max(a.oy + dy, 0), Math.max(0, a.H - a.cx.ph));
  qaPor({ x: x, y: y });
}

/* Tira os ouvintes do documento e esquece o arrasto.
   Devolve: nada. */
function qaArrastoLargar() {
  document.removeEventListener('pointermove', qaArrastoMove);
  document.removeEventListener('pointerup', qaArrastoFim);
  document.removeEventListener('pointercancel', qaArrastoFim);
  qaArr = null;
}

/* O ponteiro saiu. Um toque (abaixo do limiar) não faz nada aqui: o clique
   que vem a seguir abre o menu. Um arrasto encaixa na borda mais perto e
   guarda a posição — também num pointercancel, para a pílula nunca ficar a
   flutuar no meio —, e o clique que o browser dá a seguir engole-se. Com o
   dedo ou a caneta, o foco que o toque deu à pílula larga-se, como no resto
   da app (eventos.js:largarFocoDoToque, que corre no clique engolido).
   Recebe: e — o PointerEvent do pointerup ou do pointercancel.
   Devolve: nada. */
function qaArrastoFim(e) {
  var a = qaArr;
  if (!a || (e && e.pointerId !== a.id)) return;
  qaArrastoLargar();
  if (!a.ativo || !qaPil) return;
  qaEngoleAte = Date.now() + QA_ENGOLE_MS;
  qaPil.classList.remove('arrastar');
  // o dedo não deixa foco (eventos.js:largarFocoDoToque): o clique que o largava foi engolido
  if (a.tipo !== 'mouse') { try { var f = document.activeElement; if (f && qaPil.contains(f)) f.blur(); } catch (x) {} }
  var cx = qaLimites(), de = qaXY || { x: a.ox, y: a.oy };
  var fim = qaEncaixe(de, cx);
  qaGuardarPosicao({ lado: fim.lado, y: fim.fracao });
  qaDeslizar(de, fim, fim.lado);
}

/* O clique que o browser dá a seguir a um arrasto da pílula não é um toque:
   não abre o menu nem carrega no que estiver por baixo. Ouvido no documento,
   na captura (corre antes da ação do botão).
   Recebe: e — o evento click.
   Devolve: true se o clique foi engolido. */
function qaEngoleClique(e) {
  if (!qaEngoleAte) return false;
  var engole = Date.now() < qaEngoleAte;
  qaEngoleAte = 0;
  if (engole && e) {
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  return engole;
}

/* As setas mudam a pílula de sítio sem rato: esquerda e direita trocam de
   borda, cima e baixo andam QA_PASSO_TECLA da altura útil. Sem animação —
   é uma ação de teclado. O Enter e o Espaço são do próprio botão (abrem o
   menu).
   Recebe: e — o evento keydown no botão da pílula.
   Devolve: true se a tecla era uma seta e mexeu na pílula. */
function qaTecla(e) {
  var k = e && e.key, pos = qaLerPosicao(), novo = null;
  if (k === 'ArrowLeft') novo = { lado: 'esq', y: pos.y };
  else if (k === 'ArrowRight') novo = { lado: 'dir', y: pos.y };
  else if (k === 'ArrowUp') novo = { lado: pos.lado, y: Math.max(0, pos.y - QA_PASSO_TECLA) };
  else if (k === 'ArrowDown') novo = { lado: pos.lado, y: Math.min(1, pos.y + QA_PASSO_TECLA) };
  if (!novo) return false;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  novo.y = Math.round(novo.y * 10000) / 10000;
  qaPonteiro = 'teclado';
  if (typeof closePops === 'function') closePops();
  qaGuardarPosicao(novo);
  qaMarcarArrastado();
  qaPararAnim();
  qaReencaixar();
  return true;
}

/* A janela mudou de tamanho (rodar o telemóvel, encolher o browser, o
   teclado do sistema): a pílula volta à posição guardada nos limites novos,
   uma vez por fotograma.
   Devolve: nada. */
function qaAoMudarTamanho() {
  if (!qaPil || qaTamanhoPedido) return;
  var faz = function () { qaTamanhoPedido = 0; if (qaPil && !qaArr) { qaPararAnim(); qaReencaixar(); } };
  qaTamanhoPedido = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(faz) : setTimeout(faz, 16);
}

/* --------------------------------------------------------------- o menu */

/* Depois do menuOpen: se o menu ficou aberto, guarda o ecrã de agora (o que
   vai com um ticket novo), marca para o CSS quando o menu se virou para cima
   (a origem da entrada), e pede o número por resolver.
   Recebe: e — o evento do clique (detail 0 quando veio do teclado).
   Devolve: nada. */
function qaMenuAbriu(e) {
  var m = document.getElementById('menu_qa');
  if (!m || !m.classList || !m.classList.contains('on')) return;
  if (e && e.detail === 0) qaPonteiro = 'teclado';
  qaContextoGuardado = qaContexto();
  try { if (m.style && m.style.bottom) m.setAttribute('data-cima', ''); else m.removeAttribute('data-cima'); } catch (x) {}
  qaCarregar();
}

/* ------------------------------------------------------------- o contexto */

/* O que vai junto com um ticket: o ecrã (separador, página das Definições,
   a ficha ou a janela de cima, o endereço), a versão, o ambiente, o tamanho
   do ecrã, o tema, o browser, o ponteiro, o rasto do que se fez antes e a
   hora. O que não se sabe fica de fora — nada se inventa. A ficha só se
   sabe quando a ficha aberta diz como se edita (o «Editar» dela chama uma
   função com o id: {tipo: o nome dessa função, id}).
   Devolve: o objeto do contexto (o do contrato C1). */
function qaContexto() {
  var c = {}, ecra = {};
  try { if (typeof tab !== 'undefined' && tab) ecra.tab = String(tab); } catch (e) {}
  try { if (typeof setPage !== 'undefined' && setPage) ecra.pagina = String(setPage); } catch (e) {}
  var L = typeof modalTop === 'function' ? modalTop() : null;
  ecra.ficha = L ? qaFichaDe(L) : null;
  ecra.modal = L && L.title ? String(L.title).slice(0, 140) : null;
  try { if (location.hash && location.hash !== '#') ecra.hash = String(location.hash).slice(0, 200); } catch (e) {}
  c.ecra = ecra;
  if (typeof VERSAO !== 'undefined' && VERSAO) c.versao = VERSAO;
  if (window.CW && CW.ambiente) c.ambiente = String(CW.ambiente);
  var w = window.innerWidth, h = window.innerHeight;
  if (w > 0 && h > 0) c.janela = { w: w, h: h, dpr: window.devicePixelRatio || 1 };
  try {
    if (typeof db !== 'undefined' && db && db.settings) {
      c.tema = { escolhido: db.settings.theme || 'auto', escuro: typeof isDark === 'function' ? !!isDark() : document.documentElement.classList.contains('dark') };
      /* o Samsung Internet escurece à força a página que se mostra clara
         (definicoes.js:notaDoSamsung): não se vê daqui, diz-se que pode */
      if (typeof eSamsungInternet === 'function' && eSamsungInternet() && !c.tema.escuro) c.tema.forcado = 'possivel';
    }
  } catch (e) {}
  try { if (navigator.userAgent) c.agente = String(navigator.userAgent).slice(0, 300); } catch (e) {}
  if (qaPonteiro) c.ponteiro = qaPonteiro;
  var rasto = window.CW && Array.isArray(CW._rasto) ? CW._rasto : [];
  if (rasto.length) c.rasto = rasto.slice(-QA_RASTO_MAX).map(function (s) { return String(s).slice(0, QA_RASTO_LETRAS); });
  c.quando = new Date().toISOString();
  return c;
}

/* A ficha que uma janela é, quando se sabe: o «Editar» de uma ficha
   (componentes.js:abrirFicha) chama uma função com o id do registo, e é daí
   que vem o par. Sem isso, null.
   Recebe: L — a camada da janela.
   Devolve: {tipo, id} ou null. */
function qaFichaDe(L) {
  var act = L && L.ficha && L.ficha.editar && L.ficha.editar.act;
  var m = typeof act === 'string' ? /^(\w+)\('([^']*)'\)$/.exec(act.trim()) : null;
  return m ? { tipo: m[1], id: m[2] } : null;
}

/* O contexto escrito para pessoas (a janela «Novo ticket», em «O que vai
   junto», e a de um ticket, em «Contexto»). Lê o que vier com cuidado: o
   contexto de um ticket foi escrito por outro aparelho, e pode trazer
   qualquer coisa.
   Recebe: c — o objeto do contexto (ou o que vier no lugar dele).
   Devolve: o HTML (texto). */
function qaHtmlContexto(c) {
  if (!c || typeof c !== 'object') return '<p class="hint">Este ticket não traz contexto.</p>';
  var e = c.ecra && typeof c.ecra === 'object' ? c.ecra : {}, linhas = [];
  var junta = function (rotulo, v) {
    if (v === undefined || v === null || v === '' || typeof v === 'object') return;
    linhas.push('<div class="stat"><span>' + esc(rotulo) + '</span><b>' + esc(String(v)) + '</b></div>');
  };
  junta('Separador', qaNomeDoSeparador(e.tab));
  junta('Página', e.pagina);
  if (e.ficha && typeof e.ficha === 'object') junta('Ficha', [e.ficha.tipo, e.ficha.id].filter(function (x) { return typeof x === 'string' && x; }).join(' · '));
  junta('Janela aberta', e.modal);
  junta('Endereço', e.hash);
  junta('Versão', c.versao);
  junta('Ambiente', c.ambiente);
  var j = c.janela;
  if (j && typeof j === 'object' && Number(j.w) > 0 && Number(j.h) > 0) junta('Ecrã', Number(j.w) + ' × ' + Number(j.h) + (Number(j.dpr) > 0 ? ' a ' + Number(j.dpr) + 'x' : ''));
  if (c.tema && typeof c.tema === 'object') junta('Tema', qaTemaLegivel(c.tema));
  junta('Ponteiro', qaPonteiroLegivel(c.ponteiro));
  junta('Browser', c.agente);
  var q = typeof c.quando === 'string' ? Date.parse(c.quando) : NaN;
  if (isFinite(q)) junta('Quando', qaQuando(q));
  var rasto = Array.isArray(c.rasto) ? c.rasto.filter(function (r) { return typeof r === 'string' && r; }) : [];
  return '<div class="form qa-ctx">' + linhas.join('') +
    (rasto.length ? '<div><div class="flabel">Últimos passos</div><ol class="qa-rasto">' +
      rasto.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ol></div>' : '') +
    (linhas.length || rasto.length ? '' : '<p class="hint">Este ticket não traz contexto.</p>') + '</div>';
}

/* O nome de um separador, como a barra o escreve (navegacao.js:TABS).
   Recebe: id — o id do separador (pode não ser texto).
   Devolve: o nome, o id se não for um separador conhecido, ou '' sem id. */
function qaNomeDoSeparador(id) {
  if (typeof id !== 'string' || !id) return '';
  var t = typeof TABS !== 'undefined' ? TABS.filter(function (x) { return x.id === id; })[0] : null;
  return t ? t.label : id;
}

/* O tema de um contexto, numa frase.
   Recebe: t — {escolhido, escuro, forcado}.
   Devolve: o texto. */
function qaTemaLegivel(t) {
  var esc0 = { light: 'Claro', dark: 'Escuro', auto: 'Automático' }[t.escolhido] || '';
  var ve = t.escuro === true ? 'a mostrar escuro' : t.escuro === false ? 'a mostrar claro' : '';
  var txt = [esc0, ve].filter(Boolean).join(', ');
  if (t.forcado) txt += (txt ? '; ' : '') + 'o Samsung Internet pode estar a escurecer a página';
  return txt;
}

/* O ponteiro de um contexto, em português.
   Recebe: p — 'touch', 'mouse', 'pen', 'teclado' ou outra coisa.
   Devolve: o texto ('' sem ponteiro). */
function qaPonteiroLegivel(p) {
  if (typeof p !== 'string' || !p) return '';
  return { touch: 'Dedo', mouse: 'Rato', pen: 'Caneta', teclado: 'Teclado' }[p] || p;
}

/* Uma hora da base (ms), como se lê em Portugal: «28/10/2026 às 14:03», na
   hora local.
   Recebe: ms — o instante em milissegundos.
   Devolve: o texto ('' se não for um instante). */
function qaQuando(ms) {
  var n = Number(ms);
  if (!isFinite(n) || n <= 0) return '';
  var d = new Date(n), p2 = function (x) { return String(x).padStart(2, '0'); };
  return dPT(d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())) + ' às ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}

/* ----------------------------------------------------------- novo ticket */

/* Abre a janela «Novo ticket de QA» (folha de baixo no telemóvel): a
   descrição obrigatória, a gravidade opcional, a captura de ecrã (escolher,
   ou colar com Ctrl+V em qualquer sítio da janela) e o que vai junto, já à
   vista. O contexto é o do ecrã de quando se abriu o menu — com a janela já
   aberta, seria o da própria janela.
   Devolve: nada — abre a janela. */
function qaNovoTicket() {
  var ctx = qaContextoGuardado || qaContexto();
  var r = { gravidade: '', imagem: null, url: '', id: '', aEnviar: false, contexto: ctx, camada: null };
  qaRascunho = r;
  var L = openModal('Novo ticket de QA', qaHtmlNovo(ctx),
    '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>' +
    '<button type="button" class="btn primary" id="qa_enviar" data-toca="dados" data-click="qaEnviar()">Enviar ticket</button>');
  r.camada = L || null;
  if (!L) return;
  qaMarcarJanela(L);
  L.aoFechar = function () {
    if (r.url) { try { URL.revokeObjectURL(r.url); } catch (e) {} r.url = ''; }
    if (qaRascunho === r) qaRascunho = null;
  };
  if (L.el && typeof L.el.addEventListener === 'function') L.el.addEventListener('paste', qaColar);
}

/* O corpo da janela «Novo ticket de QA».
   Recebe: ctx — o contexto que vai junto.
   Devolve: o HTML (texto). */
function qaHtmlNovo(ctx) {
  var opcao = function (v, rotulo) {
    return '<button type="button" role="radio" aria-checked="' + (v === '' ? 'true' : 'false') + '" data-g="' + v + '" data-toca="rascunho" data-click="qaGravidade(\'' + v + '\')">' + rotulo + '</button>';
  };
  return '<div class="form qa-form">' +
    '<div class="qa-campo"><label>Descrição <span class="req">*</span>' +
      '<textarea id="qa_desc" class="u-minh-130px" maxlength="4000" data-input="qaDescEscrita(this)" ' +
      'placeholder="Ex: Na lista dos contratos, tocar no filtro do imóvel fecha a janela em vez de a abrir."></textarea></label>' +
      '<span class="small num qa-conta" id="qa_desc_n" aria-hidden="true">0 / 4000</span>' +
      '<div class="hint">O que fizeste, o que esperavas e o que aconteceu.</div></div>' +
    '<div><div class="flabel" id="qa_grav_rot">Gravidade</div>' +
      '<div class="segm qa-gravidade" role="radiogroup" aria-labelledby="qa_grav_rot">' + opcao('', 'Nenhuma') +
        QA_GRAVIDADES.map(function (g) { return opcao(g.v, g.rotulo); }).join('') + '</div></div>' +
    '<div class="qa-captura"><div class="flabel">Captura de ecrã</div>' +
      '<div id="qa_img">' + qaHtmlImagem('') + '</div>' +
      '<p class="erro-campo" id="qa_img_erro" role="alert"></p>' +
      '<input type="file" id="qa_img_in" accept="image/png,image/jpeg,image/webp,image/gif" class="u-d-none" data-change="qaEscolheuImagem(this)">' +
      '<input type="hidden" id="qa_img_tem" value=""></div>' +
    fold('qaJunto', 'O que vai junto', '<p class="hint">Vai com o ticket, para quem o for resolver saber onde estavas. Quem o escreveu fica guardado com ele.</p>' + qaHtmlContexto(ctx), { icon: 'info' }) +
    '<div id="qa_e" class="small u-c-v-danger" role="alert"></div>' +
    '</div>';
}

/* A caixa da captura: sem imagem, o botão de escolher e a dica de colar;
   com ela, a pré-visualização e «Remover»; a preparar, a roda.
   Recebe: url — o object URL da imagem ('' sem imagem; 'a-preparar' enquanto encolhe).
   Devolve: o HTML (texto). */
function qaHtmlImagem(url) {
  if (url === 'a-preparar') return '<div class="qa-preparar"><span class="roda" aria-hidden="true"></span><span>A preparar a imagem…</span></div>';
  if (url) {
    return '<div class="qa-previa"><img src="' + esc(url) + '" alt="A captura de ecrã que vai com o ticket">' +
      '<button type="button" class="btn sm" data-toca="rascunho" data-click="qaRemoverImagem()">' + ic('trash', 14) + ' Remover</button></div>';
  }
  return '<button type="button" class="btn sm" data-toca="rascunho" data-click="abrirSeletorFicheiros(\'qa_img_in\')">' + ic('photo', 14) + ' Escolher imagem</button>' +
    '<p class="hint qa-colar">Ou cola-a aqui com Ctrl+V. Antes de subir, fica mais leve.</p>';
}

/* O contador de caracteres da descrição.
   Recebe: el — a caixa de texto (o this da ação).
   Devolve: nada. */
function qaDescEscrita(el) {
  var n = document.getElementById('qa_desc_n');
  if (n && el) n.textContent = String(el.value || '').length + ' / 4000';
}

/* Escolhe a gravidade no segmentado (vazio quer dizer nenhuma).
   Recebe: v — '', 'bloqueia', 'incomoda' ou 'detalhe'.
   Devolve: nada — marca a escolha (aria-checked) na janela. */
function qaGravidade(v) {
  if (!qaRascunho) return;
  var ok = v === '' || QA_GRAVIDADES.some(function (g) { return g.v === v; });
  if (!ok) return;
  qaRascunho.gravidade = v;
  var corpo = typeof modalBodyEl === 'function' ? modalBodyEl() : null;
  if (!corpo || typeof corpo.querySelectorAll !== 'function') return;
  [].slice.call(corpo.querySelectorAll('.qa-gravidade [role="radio"]')).forEach(function (b) {
    b.setAttribute('aria-checked', b.getAttribute('data-g') === v ? 'true' : 'false');
  });
}

/* A imagem escolhida no seletor de ficheiros.
   Recebe: input — o <input type="file"> (o this da ação).
   Devolve: nada. */
function qaEscolheuImagem(input) {
  var f = input && input.files && input.files[0];
  try { input.value = ''; } catch (e) {}
  if (f) qaReceberImagem(f);
}

/* Colar (Ctrl+V) na janela «Novo ticket»: se o que se cola traz uma imagem,
   é a captura; texto cola-se na caixa como sempre.
   Recebe: e — o ClipboardEvent do paste (ouvido na janela).
   Devolve: true se tinha uma imagem. */
function qaColar(e) {
  var dados = e && e.clipboardData;
  if (!dados || !qaRascunho) return false;
  var f = null;
  [].slice.call(dados.files || []).some(function (x) { if (x && /^image\//.test(x.type)) { f = x; return true; } return false; });
  if (!f) {
    [].slice.call(dados.items || []).some(function (it) {
      if (it && it.kind === 'file' && /^image\//.test(it.type)) { f = it.getAsFile(); return !!f; }
      return false;
    });
  }
  if (!f) return false;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  qaReceberImagem(f);
  return true;
}

/* Uma imagem chegou (escolhida ou colada): encolhe-a (qaEncolherImagem) e
   mostra-a; se não der, diz porquê junto da caixa.
   Recebe: f — o File ou Blob.
   Devolve: Promise que acaba quando a imagem está pronta (ou recusada). */
function qaReceberImagem(f) {
  var r = qaRascunho;
  if (!r || !f) return Promise.resolve(false);
  qaErroImagem('');
  if (!/^image\//.test(f.type || '')) { qaErroImagem('Isso não é uma imagem. Escolhe um PNG, um JPEG ou um WebP.'); return Promise.resolve(false); }
  qaPintarImagem('a-preparar');
  return qaEncolherImagem(f).then(function (blob) {
    if (qaRascunho !== r) return false;
    qaPorImagem(blob);
    return true;
  }, function (err) {
    if (qaRascunho !== r) return false;
    qaPintarImagem(r.url);
    qaErroImagem((err && err.message) || 'Não deu para ler esta imagem.');
    return false;
  });
}

/* Encolhe uma imagem para subir: o lado maior até QA_IMAGEM_LADO, em WebP
   (JPEG onde o browser não escreve WebP), e abaixo do teto do servidor.
   Nunca amplia. Sem o createImageBitmap, ou com uma imagem que ele não lê,
   sobe a original se for de um tipo aceite e couber.
   Recebe: f — o File ou Blob da imagem.
   Devolve: Promise com o Blob pronto; rejeita com um Error de mensagem
   para a pessoa. */
function qaEncolherImagem(f) {
  var original = function () {
    if (/^image\/(png|jpeg|webp)$/.test(f.type || '') && f.size <= QA_IMAGEM_MAX) return f;
    throw new Error(f.size > QA_IMAGEM_MAX ? 'A imagem é grande de mais. Escolhe uma até 3 MB.' : 'Esta imagem não se deixa ler. Experimenta um PNG, um JPEG ou um WebP.');
  };
  if (typeof createImageBitmap !== 'function') return Promise.resolve().then(original);
  return createImageBitmap(f).then(function (bm) {
    var k = Math.min(1, QA_IMAGEM_LADO / Math.max(bm.width || 1, bm.height || 1));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bm.width * k)); c.height = Math.max(1, Math.round(bm.height * k));
    var g = typeof c.getContext === 'function' ? c.getContext('2d') : null;
    if (!g || typeof c.toBlob !== 'function') { try { bm.close(); } catch (e) {} return original(); }
    g.drawImage(bm, 0, 0, c.width, c.height);
    try { bm.close(); } catch (e) {}
    var cabe = function (b, tipo) { return !!b && b.size > 0 && b.size <= QA_IMAGEM_MAX && (!tipo || b.type === tipo); };
    return qaCanvasBlob(c, 'image/webp', 0.85).then(function (b) {
      if (cabe(b, 'image/webp')) return b;
      return qaCanvasBlob(c, 'image/jpeg', 0.82).then(function (j) {
        if (cabe(j)) return j;
        return qaCanvasBlob(c, 'image/jpeg', 0.6).then(function (j2) { return cabe(j2) ? j2 : original(); });
      });
    });
  }, function () { return original(); });
}

/* O toBlob de um canvas, numa promessa.
   Recebe: c — o canvas; tipo — o tipo pedido; q — a qualidade.
   Devolve: Promise com o Blob (ou null se o browser não deu nenhum). */
function qaCanvasBlob(c, tipo, q) {
  return new Promise(function (ok) { try { c.toBlob(function (b) { ok(b || null); }, tipo, q); } catch (e) { ok(null); } });
}

/* A captura passa a ser esta: pré-visualiza, marca a janela como mexida (o
   fecho por abandono pergunta) e liberta a anterior.
   Recebe: blob — a imagem já encolhida.
   Devolve: nada. */
function qaPorImagem(blob) {
  var r = qaRascunho;
  if (!r) return;
  if (r.url) { try { URL.revokeObjectURL(r.url); } catch (e) {} }
  r.imagem = blob;
  r.url = '';
  try { r.url = URL.createObjectURL(blob); } catch (e) {}
  qaPintarImagem(r.url || '');
  var tem = document.getElementById('qa_img_tem');
  if (tem) tem.value = '1';
  if (r.camada) r.camada.tocado = true;
}

/* Remove a captura do ticket que se está a escrever.
   Devolve: nada. */
function qaRemoverImagem() {
  var r = qaRascunho;
  if (!r) return;
  if (r.url) { try { URL.revokeObjectURL(r.url); } catch (e) {} }
  r.imagem = null; r.url = '';
  qaPintarImagem('');
  qaErroImagem('');
  var tem = document.getElementById('qa_img_tem');
  if (tem) tem.value = '';
}

/* Repinta a caixa da captura (#qa_img).
   Recebe: url — o que o qaHtmlImagem recebe.
   Devolve: nada. */
function qaPintarImagem(url) {
  var caixa = document.getElementById('qa_img');
  if (caixa) caixa.innerHTML = qaHtmlImagem(url);
}

/* Escreve (ou apaga) o erro da captura, por baixo da caixa.
   Recebe: msg — a frase ('' apaga).
   Devolve: nada. */
function qaErroImagem(msg) {
  var p = document.getElementById('qa_img_erro');
  if (p) p.textContent = msg || '';
}

/* O botão de enviar diz o que está a acontecer: «A enviar…» (desligado)
   durante o pedido; depois de o ticket já estar guardado e só a imagem ter
   falhado, «Enviar a imagem».
   Recebe: ocupado — true durante o envio.
   Devolve: nada. */
function qaBotaoEnviar(ocupado) {
  var b = document.getElementById('qa_enviar'), r = qaRascunho;
  if (!b) return;
  b.disabled = !!ocupado;
  if (ocupado) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
  b.textContent = ocupado ? 'A enviar…' : (r && r.id ? 'Enviar a imagem' : 'Enviar ticket');
}

/* Envia o ticket: a descrição (obrigatória: componentes.js:falhaCampo), a
   gravidade e o contexto num POST, e depois a captura num PUT. Se o ticket
   ficou guardado e só a imagem falhou, a janela fica aberta, a dizê-lo, e
   «Enviar a imagem» tenta outra vez só a imagem (nunca um ticket repetido).
   Com tudo certo fecha e avisa, e o número por resolver atualiza-se.
   Devolve: Promise com true se o ticket ficou enviado por inteiro. */
function qaEnviar() {
  var r = qaRascunho;
  if (!r || r.aEnviar) return Promise.resolve(false);
  var erro = document.getElementById('qa_e');
  if (erro) erro.textContent = '';
  var texto = String(val('qa_desc') || '').trim();
  if (!r.id && !texto) { falhaCampo('qa_desc', 'Escreve o que viste.'); return Promise.resolve(false); }
  r.aEnviar = true;
  qaBotaoEnviar(true);
  var criar = r.id ? Promise.resolve({ id: r.id }) :
    api('POST', '/api/qa', { body: texto, severity: r.gravidade || null, context: r.contexto });
  return criar.then(function (res) {
    if (!res || !res.id) throw new Error('O servidor não devolveu o ticket.');
    r.id = res.id;
    var desc = document.getElementById('qa_desc');
    if (desc) desc.readOnly = true;
    if (!r.imagem) return true;
    return qaSubirImagem(r.id, r.imagem).catch(function (e) { e.daImagem = true; throw e; });
  }).then(function () {
    r.aEnviar = false;
    var aberta = r.camada && typeof modalStack !== 'undefined' && modalStack.indexOf(r.camada) > -1;
    if (aberta && modalTop() === r.camada) closeModal();
    if (qaRascunho === r) qaRascunho = null;
    toast(r.imagem ? 'Ticket enviado, com a captura.' : 'Ticket enviado.');
    qaCarregar();
    return true;
  }).catch(function (e) {
    r.aEnviar = false;
    qaBotaoEnviar(false);
    var msg = (e && e.message) || 'Não deu para enviar.';
    if (e && e.daImagem) {
      msg = 'O ticket ficou guardado, mas a captura não subiu: ' + msg + ' Toca em «Enviar a imagem» para tentar outra vez.';
      qaCarregar();
    }
    var el = document.getElementById('qa_e');
    if (el) el.textContent = msg;
    else toast(msg);
    return false;
  });
}

/* Sobe a captura de um ticket (PUT /api/qa/:id/imagem), com os bytes no
   corpo e o tipo no Content-Type, como os anexos (cloud/anexos.js:subirAnexo).
   Recebe: id — o id do ticket; blob — a imagem.
   Devolve: Promise que resolve em true; rejeita com um Error com a frase do
   servidor (ou «Sem ligação ao servidor.»). */
function qaSubirImagem(id, blob) {
  var h = typeof cabecalhosDaSessao === 'function' ? cabecalhosDaSessao() : {};
  h['Content-Type'] = blob.type || 'application/octet-stream';
  var caminho = '/api/qa/' + encodeURIComponent(id) + '/imagem';
  return fetch(caminho, { method: 'PUT', headers: h, body: blob, credentials: 'same-origin' })
    .then(function (resp) {
      if (typeof rastoPoe === 'function') rastoPoe('PUT /api/qa/…/imagem → ' + resp.status);
      if (resp.ok) return true;
      return Promise.resolve(typeof resp.json === 'function' ? resp.json() : {}).catch(function () { return {}; }).then(function (j) {
        var e = new Error((j && j.error) || ('Erro ' + resp.status + '.'));
        e.status = resp.status;
        throw e;
      });
    }, function () {
      if (typeof rastoPoe === 'function') rastoPoe('PUT /api/qa/…/imagem → sem rede');
      throw new Error('Sem ligação ao servidor.');
    });
}

/* ------------------------------------------------------------- a lista */

/* Vai buscar os tickets e as colunas do kanban (GET /api/qa), um pedido de
   cada vez, e com eles o número por resolver; repinta a pílula, a lista e o
   ticket aberto. Corre ao aparecer a pílula, ao abrir o menu, ao abrir a
   lista, depois de criar, remover, repor, reabrir e mover, e ao voltar à
   app — nunca em ciclo. A falha não é uma lista vazia: diz-se, com «Tentar
   de novo».
   Devolve: Promise que acaba quando a resposta chega (ou falha). */
function qaCarregar() {
  if (qaLista.aPedir) return qaLista.aPedir;
  var p = Promise.resolve().then(function () { return api('GET', '/api/qa'); }).then(function (r) {
    qaLista.aPedir = null;
    qaLista.falhou = false;
    qaLista.tickets = (r && Array.isArray(r.tickets) ? r.tickets : []).filter(function (t) { return t && typeof t === 'object' && t.id; });
    qaLista.colunas = qaColunasDe(r && r.colunas);
    qaAbertos = qaSeccoes(qaLista.tickets).abertos.length;
    qaPintarNumero();
    qaPintarLista();
    return true;
  }, function () {
    qaLista.aPedir = null;
    qaLista.falhou = true;
    qaPintarLista();
    return false;
  });
  qaLista.aPedir = p;
  return p;
}

/* «Tentar de novo» depois de uma falha a carregar os tickets.
   Devolve: nada. */
function qaCarregarDeNovo() {
  qaLista.falhou = false;
  qaPintarLista();
  qaCarregar();
}

/* A posição de uma gravidade na lista: bloqueia, incomoda, detalhe e, no
   fim, sem gravidade.
   Recebe: g — a gravidade do ticket.
   Devolve: o número (0 a 3). */
function qaOrdemGravidade(g) {
  for (var i = 0; i < QA_GRAVIDADES.length; i++) if (QA_GRAVIDADES[i].v === g) return i;
  return QA_GRAVIDADES.length;
}

/* As colunas do kanban que vieram do servidor, validadas: só as que têm um
   id com a forma de um id de coluna (QA_ID_COLUNA), sem repetidas, com o nome
   (o id, se vier sem nome) e o fim como true ou false. Sem nenhuma que se
   aproveite (um servidor de antes da 0029, ou uma resposta estragada), as de
   omissão.
   Recebe: cs — o que veio em r.colunas (pode não ser uma lista).
   Devolve: a lista [{id, nome, fim}] (nova). */
function qaColunasDe(cs) {
  var vistas = {}, r = [];
  (Array.isArray(cs) ? cs : []).forEach(function (c) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !QA_ID_COLUNA.test(c.id) || vistas[c.id]) return;
    vistas[c.id] = true;
    var nome = typeof c.nome === 'string' && c.nome.trim() ? c.nome.trim() : c.id;
    r.push({ id: c.id, nome: nome, fim: c.fim === true || c.fim === 1 });
  });
  return r.length ? r : QA_COLUNAS_OMISSAO.map(function (c) { return { id: c.id, nome: c.nome, fim: c.fim }; });
}

/* As colunas do kanban de agora: as da última resposta do servidor, ou as de
   omissão enquanto não houve nenhuma.
   Devolve: a lista [{id, nome, fim}]. */
function qaColunas() {
  return Array.isArray(qaLista.colunas) && qaLista.colunas.length ? qaLista.colunas : QA_COLUNAS_OMISSAO;
}

/* Uma coluna do kanban pelo id.
   Recebe: id — o id da coluna (o status de um ticket).
   Devolve: {id, nome, fim}, ou null se não é uma coluna que se conheça. */
function qaColuna(id) {
  return qaColunas().filter(function (c) { return c.id === id; })[0] || null;
}

/* O nome de uma coluna, como o kanban o escreve; de uma coluna que não se
   conhece, o próprio id (nada se perde nem se inventa).
   Recebe: id — o id da coluna.
   Devolve: o texto. */
function qaNomeDaColuna(id) {
  var c = qaColuna(id);
  return c ? c.nome : String(id == null ? '' : id);
}

/* Um ticket nesta coluna está resolvido? Em Human Tests (resolvido, à
   espera de quem testa) e nas colunas de fim, onde o servidor põe o
   resolved_at e de onde o ticket se reabre.
   Recebe: id — o id da coluna.
   Devolve: true ou false. */
function qaColunaResolvida(id) {
  if (id === QA_COL_RESOLVIDO) return true;
  var c = qaColuna(id);
  return !!(c && c.fim);
}

/* Um ticket nesta coluna está por resolver (conta no número da pílula)? Em
   A fazer e em Auto Tests.
   Recebe: id — o id da coluna.
   Devolve: true ou false. */
function qaColunaPorResolver(id) {
  return id === QA_COL_NOVO || id === QA_COL_EM_CURSO;
}

/* Os tickets arrumados pelas colunas do kanban, uma secção por coluna pela
   ordem do quadro (qaColunas), e no fim uma por cada status que não é uma
   coluna conhecida (com o próprio id como nome: o ticket nunca se perde).
   Dentro de cada uma, a ordem do servidor: nas por resolver por gravidade
   (bloqueia, incomoda, detalhe, sem gravidade) e em cada gravidade do mais
   recente para o mais antigo; nas resolvidas (qaColunaResolvida) do
   resolvido há menos tempo para o resolvido há mais.
   Recebe: ts — os tickets da API.
   Devolve: {seccoes: [{id, nome, fim, conhecida, ts}], abertos} (arrays
   novos; abertos são os por resolver — os de A fazer e os de Auto Tests,
   pela ordem das secções). */
function qaSeccoes(ts) {
  var lista = Array.isArray(ts) ? ts : [];
  var porGravidade = function (a, b) {
    return qaOrdemGravidade(a.severity) - qaOrdemGravidade(b.severity) ||
      (Number(b.created_at) || 0) - (Number(a.created_at) || 0);
  };
  var porResolucao = function (a, b) {
    return (Number(b.resolved_at || b.updated_at) || 0) - (Number(a.resolved_at || a.updated_at) || 0);
  };
  var seccoes = qaColunas().map(function (c) { return { id: c.id, nome: c.nome, fim: !!c.fim, conhecida: true, ts: [] }; });
  var porId = {};
  seccoes.forEach(function (s) { porId[s.id] = s; });
  lista.forEach(function (t) {
    var id = String(t.status == null ? '' : t.status);
    if (!Object.prototype.hasOwnProperty.call(porId, id)) {
      porId[id] = { id: id, nome: id || 'Sem coluna', fim: false, conhecida: false, ts: [] };
      seccoes.push(porId[id]);
    }
    porId[id].ts.push(t);
  });
  seccoes.forEach(function (s) { s.ts.sort(qaColunaResolvida(s.id) ? porResolucao : porGravidade); });
  var abertos = [];
  seccoes.forEach(function (s) { if (qaColunaPorResolver(s.id)) abertos = abertos.concat(s.ts); });
  return { seccoes: seccoes, abertos: abertos };
}

/* Abre a janela «Tickets de QA»: logo com o que já se sabe (ou a espera), e
   pede outra vez ao servidor.
   Devolve: nada. */
function qaVerTickets() {
  var L = openModal('Tickets de QA', qaHtmlLista(),
    '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>' +
    '<button type="button" class="btn primary" data-toca="camada" data-click="qaNovoTicket()">' + ic('plus', 16) + ' Novo ticket</button>');
  qaCamadaLista = L || null;
  qaMarcarJanela(L);
  if (L) L.aoFechar = function () { if (qaCamadaLista === L) qaCamadaLista = null; };
  qaCarregar();
}

/* O corpo da lista: a espera, a falha com «Tentar de novo», o vazio, ou uma
   secção por coluna do kanban, pela ordem do quadro (qaSeccoes), com o nome
   da coluna e quantos tem, cada uma uma secção que abre e fecha
   (qaHtmlDobra; por nascença as de fim e a Para depois recolhidas). A fazer
   está sempre à vista, mesmo vazia, e em grupos por gravidade; as outras só
   quando têm tickets. Com tickets já mostrados e uma atualização falhada,
   diz que é o que havia.
   Devolve: o HTML (texto). */
function qaHtmlLista() {
  var ts = qaLista.tickets;
  var deNovo = '<button type="button" class="btn sm" data-toca="dados" data-click="qaCarregarDeNovo()">Tentar de novo</button>';
  if (ts === null) {
    return qaLista.falhou
      ? '<div class="empty"><b>Não deu para carregar os tickets.</b>Pode ser a ligação. Tenta de novo daqui a pouco.<div>' + deNovo + '</div></div>'
      : '<div class="espera"><span class="roda" aria-hidden="true"></span><span><b>À espera do servidor.</b> Os tickets aparecem assim que chegarem.</span></div>';
  }
  var aviso = qaLista.falhou ? '<div class="qa-desatual"><span>Não deu para atualizar: isto é o que havia.</span>' + deNovo + '</div>' : '';
  if (!ts.length) {
    return aviso + '<div class="empty"><b>Ainda não há tickets.</b>Quando vires alguma coisa que não está bem, toca em QA e depois em Novo ticket.</div>';
  }
  return '<div class="qa-lista">' + aviso + qaSeccoes(ts).seccoes.map(function (s) {
    var novos = s.id === QA_COL_NOVO;
    if (!novos && !s.ts.length) return '';
    var corpo = novos
      ? (s.ts.length ? qaHtmlGrupos(s.ts) : '<p class="hint">Nenhum ticket novo.</p>')
      : '<div class="qa-linhas">' + s.ts.map(qaHtmlLinha).join('') + '</div>';
    return qaHtmlDobra(s.id, 'h3', '<span class="qa-dobra-nome">' + esc(s.nome) + '</span><span class="qa-sec-n">' + s.ts.length + '</span>', corpo);
  }).join('') + '</div>';
}

/* Os de A fazer em grupos por gravidade, cada um com o título e quantos
   tem, e cada um uma secção que abre e fecha (qaHtmlDobra; os tickets já
   vêm arrumados por qaSeccoes).
   Recebe: novos — os tickets de A fazer, pela ordem de qaSeccoes.
   Devolve: o HTML (texto). */
function qaHtmlGrupos(novos) {
  var grupos = [];
  novos.forEach(function (t) {
    var o = qaOrdemGravidade(t.severity);
    if (!grupos.length || grupos[grupos.length - 1].o !== o) grupos.push({ o: o, ts: [] });
    grupos[grupos.length - 1].ts.push(t);
  });
  return grupos.map(function (g) {
    var conhecida = g.o < QA_GRAVIDADES.length;
    var nome = conhecida ? QA_GRAVIDADES[g.o].rotulo : 'Sem gravidade';
    return qaHtmlDobra('g-' + (conhecida ? QA_GRAVIDADES[g.o].v : 'sem'), 'h4',
      '<span class="qa-dobra-nome">' + nome + '</span><span class="qa-grupo-n">' + g.ts.length + '</span>',
      '<div class="qa-linhas">' + g.ts.map(qaHtmlLinha).join('') + '</div>');
  }).join('');
}

/* Uma secção da lista que abre e fecha, como as da gaveta
   (navegacao.js:gavetaHtml): o título com um botão da largura toda — o nome,
   quantos tem e a seta —, com aria-expanded e aria-controls para o corpo; o
   corpo fica sempre no HTML e é a folha que o recolhe (estilos.css, bloco
   «tickets de QA»: .qa-dobra.fechada). Nasce como está guardado neste
   aparelho (qaDobraAberta).
   Recebe: chave — o id de uma coluna (as secções) ou uma de
   QA_DOBRAS_GRUPOS (os grupos de gravidade); nivel — 'h3' (as colunas) ou
   'h4' (os grupos de gravidade); cabeca — o HTML do nome e do número;
   corpo — o HTML de dentro.
   Devolve: o HTML (texto). */
function qaHtmlDobra(chave, nivel, cabeca, corpo) {
  var aberta = qaDobraAberta(chave), corpoId = esc('qaDobra-' + chave);
  return '<div class="qa-dobra' + (aberta ? '' : ' fechada') + '" id="' + esc('qaSec-' + chave) + '">' +
    '<' + nivel + ' class="' + (nivel === 'h3' ? 'qa-sec' : 'qa-grupo') + '">' +
      '<button type="button" class="qa-dobra-cab" id="' + esc('qaCab-' + chave) + '" data-toca="nada" data-click="qaDobrar(\'' + jsq(chave) + '\')" ' +
        'aria-expanded="' + (aberta ? 'true' : 'false') + '" aria-controls="' + corpoId + '">' +
        cabeca + '<span class="qa-dobra-seta" aria-hidden="true">' + ic('chevD', 16) + '</span></button>' +
    '</' + nivel + '>' +
    '<div class="qa-dobra-corpo" id="' + corpoId + '"><div class="qa-dobra-itens"><div class="qa-dobra-dentro">' + corpo + '</div></div></div>' +
  '</div>';
}

/* As secções que se tocaram neste aparelho, só com as chaves que têm a
   forma de uma (o id de uma coluna, ou um grupo de gravidade, que tem a
   mesma forma) e os valores que são true ou false; com o armazenamento
   vedado, as desta sessão (qaDobrasAqui); estragado, nenhuma. As chaves de
   antes das colunas ('novos', 'em-resolucao', 'resolvidos') ficam, sem
   efeito: não há coluna com esse id.
   Devolve: {chave: true (aberta) ou false (recolhida)} (um objeto novo). */
function qaLerDobras() {
  var bruto = null, d = null, limpo = {};
  try { bruto = localStorage.getItem(QA_LS_DOBRAS); } catch (e) { d = qaDobrasAqui; }
  if (!d) { try { d = JSON.parse(bruto || '{}'); } catch (e) { d = null; } }
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    Object.keys(d).forEach(function (k) { if (QA_ID_COLUNA.test(k) && typeof d[k] === 'boolean') limpo[k] = d[k]; });
  }
  return limpo;
}

/* As chaves das secções que a lista mostra agora (as mesmas de
   qaHtmlLista): A fazer, as colunas com tickets, os status dos tickets que
   não são colunas conhecidas, e os grupos de gravidade de A fazer.
   Devolve: a lista das chaves. */
function qaChavesDasDobras() {
  return qaSeccoes(qaLista.tickets || []).seccoes
    .filter(function (s) { return s.id === QA_COL_NOVO || s.ts.length; })
    .map(function (s) { return s.id; }).concat(QA_DOBRAS_GRUPOS);
}

/* A secção está aberta? A escolha guardada neste aparelho; sem nenhuma, a
   de nascença: as colunas de fim e as de QA_DOBRAS_FECHADAS recolhidas (o
   que já acabou, e o que fica para depois), o resto aberto.
   Recebe: chave — o id de uma coluna ou uma de QA_DOBRAS_GRUPOS.
   Devolve: true (aberta) ou false (recolhida). */
function qaDobraAberta(chave) {
  var d = qaLerDobras();
  if (Object.prototype.hasOwnProperty.call(d, chave)) return d[chave];
  var c = qaColuna(chave);
  return !(c && c.fim) && QA_DOBRAS_FECHADAS.indexOf(chave) < 0;
}

/* Abre ou recolhe uma secção da lista. É da família «nada», como a gaveta
   (navegacao.js:gavetaAlternar): troca a classe da secção e o aria-expanded
   do botão no nó vivo, sem repintar — a transição da altura só corre num nó
   vivo, e o foco fica no botão. Guarda neste aparelho (com o armazenamento
   vedado, só nesta sessão), e a lista que o servidor repintar nasce igual.
   Recebe: chave — o id de uma coluna ou uma de QA_DOBRAS_GRUPOS.
   Devolve: true se ficou aberta, false se ficou recolhida, null para uma chave que não existe. */
function qaDobrar(chave) {
  if (typeof chave !== 'string' || !QA_ID_COLUNA.test(chave) || qaChavesDasDobras().indexOf(chave) < 0) return null;
  var aberta = !qaDobraAberta(chave), d = qaLerDobras();
  d[chave] = aberta;
  qaDobrasAqui = d;
  try { localStorage.setItem(QA_LS_DOBRAS, JSON.stringify(d)); } catch (e) {}
  var sec = document.getElementById('qaSec-' + chave), cab = document.getElementById('qaCab-' + chave);
  if (sec && sec.classList) sec.classList.toggle('fechada', !aberta);
  if (cab) cab.setAttribute('aria-expanded', aberta ? 'true' : 'false');
  return aberta;
}

/* Uma linha da lista: o selo da gravidade, quem e quando, o sinal de que
   traz imagem e o começo do texto. Tocar abre o ticket.
   Recebe: t — o ticket.
   Devolve: o HTML (texto). */
function qaHtmlLinha(t) {
  return '<button type="button" class="qa-linha" data-toca="camada" data-click="qaAbrirTicket(\'' + jsq(t.id) + '\')">' +
    '<span class="qa-linha-cab">' + qaSelo(t.severity) +
      (t.imagem ? '<span class="qa-tem-img">' + ic('photo', 15) + '<span class="qa-so-leitor">Com captura</span></span>' : '') +
      '<span class="small qa-quem">' + esc(qaAutor(t, false)) + ' · ' + esc(qaQuando(t.created_at)) + '</span>' +
    '</span>' +
    '<span class="qa-linha-txt">' + esc(qaResumo(t.body)) + '</span>' +
  '</button>';
}

/* O selo de uma gravidade (nenhum sem gravidade).
   Recebe: g — 'bloqueia', 'incomoda', 'detalhe' ou outra coisa.
   Devolve: o HTML (texto, '' sem gravidade conhecida). */
function qaSelo(g) {
  var x = QA_GRAVIDADES.filter(function (q) { return q.v === g; })[0];
  return x ? '<span class="badge ' + x.cor + '">' + x.rotulo + '</span>' : '';
}

/* Marca uma janela como do QA. A pílula sobe acima das janelas abertas, para
   se poder escrever um ticket sobre a que está à frente, mas volta para baixo
   enquanto uma janela do próprio QA está aberta, para não tapar o formulário
   (estilos.css, bloco «tickets de QA»: .qa-janela).
   Recebe: L — a camada que o openModal devolveu (pode faltar).
   Devolve: nada. */
function qaMarcarJanela(L) {
  if (L && L.el && L.el.classList) L.el.classList.add('qa-janela');
}

/* Quem escreveu o ticket: o nome (ou o email), e «(eu)» quando fui eu; com
   o email, para a janela do ticket. Um ticket de uma conta de teste é da
   conta do Discord que pediu a ligação do /test (autor.discord): o nome dela
   no Discord, ou o id quando a ligação não trouxe o nome — mesmo depois de o
   /test limpar apagar a conta de teste. Uma conta normal que já se apagou (a
   linha de users anonimizada, ou que já nem existe depois de uma limpeza do
   dev) fica «Conta apagada»: o ticket sobrevive à conta.
   Recebe: t — o ticket; comEmail — true para juntar o email (ou o id do Discord).
   Devolve: o texto. */
function qaAutor(t, comEmail) {
  var a = t && t.autor && typeof t.autor === 'object' ? t.autor : {};
  var eu = !!(window.CW && CW.user && a.id && a.id === CW.user.id);
  var d = a.discord && typeof a.discord === 'object' && a.discord.id ? a.discord : null;
  if (d) {
    var dn = d.nome ? String(d.nome) + ' (Discord)' : 'Discord ' + String(d.id);
    if (eu) dn += ' (eu)';
    if (comEmail && d.nome) dn += ' · ' + String(d.id);
    return dn;
  }
  var apagada = !a.nome && !a.email || a.nome === '[deleted]' || /^apagado-/.test(String(a.email || ''));
  if (apagada) return 'Conta apagada';
  var nome = String(a.nome || a.email);
  if (eu) nome += ' (eu)';
  if (comEmail && a.nome && a.email) nome += ' · ' + String(a.email);
  return nome;
}

/* O começo do texto de um ticket, numa linha.
   Recebe: s — o texto.
   Devolve: até 180 caracteres, com reticências se cortou. */
function qaResumo(s) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > 180 ? t.slice(0, 179) + '…' : t;
}

/* Repinta a lista, se estiver aberta (também por baixo de um ticket aberto),
   e o ticket aberto, com o que chegou do servidor. O foco que ficou num nó
   que saiu volta à janela de cima.
   Devolve: nada. */
function qaPintarLista() {
  var pilha = typeof modalStack !== 'undefined' ? modalStack : [];
  var L = qaCamadaLista;
  if (L && pilha.indexOf(L) > -1 && L.el && typeof L.el.querySelector === 'function') {
    var corpo = L.el.querySelector('.body');
    if (corpo) {
      var html = qaHtmlLista();
      corpo.innerHTML = typeof semEtiquetasQueCorrem === 'function' ? semEtiquetasQueCorrem(html) : html;
    }
  }
  var T = qaCamadaTicket;
  if (T && pilha.indexOf(T) > -1 && qaLista.tickets) {
    var t = qaLista.tickets.filter(function (x) { return x.id === T.qaId; })[0];
    if (t && (t.status !== T.qaStatus || t.updated_at !== T.qaAtualizado)) qaRepintarTicket(T, t);
  }
  try {
    var ativo = document.activeElement, top = typeof modalTop === 'function' ? modalTop() : null;
    if (top && (!ativo || ativo === document.body) && typeof focarModal === 'function') focarModal(top.el);
  } catch (e) {}
}

/* ------------------------------------------------------------- um ticket */

/* Abre um ticket para ler, por cima da lista: o texto inteiro, a captura
   (carregada com a sessão), a resolução e o contexto; em baixo «Remover»,
   «Mover» e «Reabrir» (nos resolvidos) ou «Fechar».
   Recebe: id — o id do ticket.
   Devolve: nada — abre a janela. */
function qaAbrirTicket(id) {
  var t = (qaLista.tickets || []).filter(function (x) { return x.id === id; })[0];
  if (!t) { toast('Este ticket já não existe.'); qaCarregar(); return; }
  var L = openModal('Ticket de QA', qaHtmlTicket(t), qaRodapeTicket(t));
  if (!L) return;
  qaMarcarJanela(L);
  qaCamadaTicket = L;
  L.qaId = id; L.qaStatus = t.status; L.qaAtualizado = t.updated_at; L.qaUrl = '';
  L.aoFechar = function () {
    if (L.qaUrl) { try { URL.revokeObjectURL(L.qaUrl); } catch (e) {} L.qaUrl = ''; }
    if (qaCamadaTicket === L) qaCamadaTicket = null;
  };
  if (t.imagem) qaCarregarImagem(L, id);
}

/* O corpo da janela de um ticket: no cabeçalho, a coluna onde está, a
   gravidade e, discreta, a chave do cartão no kanban (KAN-N) quando o tem.
   Recebe: t — o ticket.
   Devolve: o HTML (texto). */
function qaHtmlTicket(t) {
  var resolvido = qaColunaResolvida(t.status);
  var cartao = typeof t.cartao === 'string' && t.cartao ? '<span class="small num qa-cartao" title="O cartão no kanban da equipa">' + esc(t.cartao) + '</span>' : '';
  return '<div class="form qa-ver">' +
    '<div class="qa-ver-cab">' + qaSeloEstado(t.status) + qaSelo(t.severity) + cartao + '</div>' +
    '<p class="small qa-quem">' + esc(qaAutor(t, true)) + ' · ' + esc(qaQuando(t.created_at)) + '</p>' +
    '<p class="qa-ver-txt">' + esc(t.body) + '</p>' +
    (t.imagem ? '<div class="qa-ver-img a-carregar" aria-busy="true"><span class="qa-so-leitor">A carregar a captura</span></div>' : '') +
    (t.resolution ? '<div class="qa-resolucao' + (resolvido ? '' : ' anterior') + '"><b>' + (resolvido ? 'Resolução' : 'Resolução anterior') + '</b>' +
      '<p>' + esc(t.resolution) + '</p>' + (resolvido && t.resolved_at ? '<span class="small">' + esc(qaQuando(t.resolved_at)) + '</span>' : '') + '</div>' : '') +
    fold('qaCtx', 'Contexto', qaHtmlContexto(t.context), { icon: 'info' }) +
    '</div>';
}

/* A cor do selo de uma coluna: Auto Tests no roxo do QA ('loan'), Human
   Tests e as de fim no verde ('in'), as outras no selo neutro ('grey'). A
   cor é a da frente e a do fundo: no escurecimento forçado do Samsung
   Internet, a da frente fica.
   Recebe: id — o id da coluna.
   Devolve: a classe do selo. */
function qaCorDaColuna(id) {
  if (id === QA_COL_EM_CURSO) return 'loan';
  if (qaColunaResolvida(id)) return 'in';
  return 'grey';
}

/* O selo do estado de um ticket: o nome da coluna do kanban onde está, na
   cor dela (qaCorDaColuna). Uma coluna que não se conhece diz o próprio id.
   Recebe: status — o do ticket (o id da coluna).
   Devolve: o HTML (texto). */
function qaSeloEstado(status) {
  return '<span class="badge ' + qaCorDaColuna(status) + '">' + esc(qaNomeDaColuna(status)) + '</span>';
}

/* O rodapé da janela de um ticket: «Remover» sempre (com Anular, por isso
   sem pergunta), «Mover» (as outras colunas do kanban, num menu de
   ações: qaHtmlMover) e, a acabar:
   - em Human Tests, as três decisões de quem testa (qaHtmlDecisoes), numa
     linha só delas por baixo do «Remover» e do «Mover»;
   - numa coluna de fim, «Reabrir» (volta a A fazer);
   - nas outras, «Fechar».
   Recebe: t — o ticket.
   Devolve: o HTML (texto). */
function qaRodapeTicket(t) {
  var id = jsq(t.id);
  var fim;
  if (t.status === QA_COL_RESOLVIDO) fim = qaHtmlDecisoes(t);
  else if (qaColunaResolvida(t.status)) fim = '<button type="button" class="btn primary" data-toca="dados" data-click="qaReabrir(\'' + id + '\')">Reabrir</button>';
  else fim = '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>';
  return '<button type="button" class="btn qa-remover" data-toca="dados" data-risco="destroi" data-click="qaRemover(\'' + id + '\')">' + ic('trash', 16) + ' Remover</button>' +
    qaHtmlMover(t) + fim;
}

/* As decisões sobre um ticket em Human Tests, numa linha própria do rodapé
   (.qa-decisoes): «Recusar» (volta a A fazer, pelo reabrir, que guarda a
   resolução como anterior: qaRecusar), «Adiar» (para Para depois: qaAdiar;
   só quando o kanban tem essa coluna, que o master pode apagar) e
   «Aceitar» (para Concluído: qaAceitar), o primário, no fim.
   Recebe: t — o ticket.
   Devolve: o HTML (texto). */
function qaHtmlDecisoes(t) {
  var id = jsq(t.id);
  return '<div class="qa-decisoes">' +
    '<button type="button" class="btn" data-toca="dados" data-click="qaRecusar(\'' + id + '\')">Recusar</button>' +
    (qaColuna(QA_COL_DEPOIS) ? '<button type="button" class="btn" data-toca="dados" data-click="qaAdiar(\'' + id + '\')">Adiar</button>' : '') +
    '<button type="button" class="btn primary" data-toca="dados" data-click="qaAceitar(\'' + id + '\')">Aceitar</button>' +
    '</div>';
}

/* «Mover»: o botão e o menu de ações da casa (.menupop, aberto pelo
   menuOpen; o data-menu="acoes" diz ao percurso que é um menu com nome
   próprio, como o da pílula) com as outras colunas do kanban, pela ordem do
   quadro. Cada uma passa o ticket para lá (qaMover). Sem outra coluna para
   onde ir, nada.
   Recebe: t — o ticket.
   Devolve: o HTML (texto, '' sem outras colunas). */
function qaHtmlMover(t) {
  var outras = qaColunas().filter(function (c) { return c.id !== t.status; });
  if (!outras.length) return '';
  var id = jsq(t.id);
  return '<span class="menuwrap qa-mover" data-menu="acoes">' +
      '<button type="button" class="btn" data-toca="camada" data-click="menuOpen(event,\'qaMover\')" aria-expanded="false">' + ic('swap', 16) + ' Mover</button>' +
      '<div class="menupop" id="menu_qaMover">' + outras.map(function (c) {
        return '<button type="button" data-toca="dados" data-click="closePops();qaMover(\'' + id + '\',\'' + jsq(c.id) + '\')">' + ic('swap', 17) + ' ' + esc(c.nome) + '</button>';
      }).join('') + '</div>' +
    '</span>';
}

/* Repinta a janela de um ticket com o que mudou (reaberto, ou resolvido
   noutro sítio), sem voltar a pedir a captura que já cá está.
   Recebe: L — a camada; t — o ticket de agora.
   Devolve: nada. */
function qaRepintarTicket(L, t) {
  if (!L || !L.el) return;
  L.qaStatus = t.status; L.qaAtualizado = t.updated_at;
  fillModal(L.el, 'Ticket de QA', qaHtmlTicket(t), qaRodapeTicket(t));
  if (L.qaUrl) qaMostrarImagem(L, L.qaUrl);
  else if (t.imagem) qaCarregarImagem(L, t.id);
}

/* Vai buscar a captura de um ticket com a sessão (GET /api/qa/:id/imagem) e
   mostra-a; falhando, diz que não deu, com «Tentar de novo».
   Recebe: L — a camada do ticket; id — o id do ticket.
   Devolve: Promise que acaba quando a imagem chega (ou falha). */
function qaCarregarImagem(L, id) {
  var h = typeof cabecalhosDaSessao === 'function' ? cabecalhosDaSessao() : {};
  return fetch('/api/qa/' + encodeURIComponent(id) + '/imagem', { headers: h, credentials: 'same-origin' })
    .then(function (resp) {
      if (!resp.ok) throw new Error('Erro ' + resp.status);
      return resp.blob();
    })
    .then(function (blob) {
      if (typeof modalStack === 'undefined' || modalStack.indexOf(L) < 0) return false;
      if (L.qaUrl) { try { URL.revokeObjectURL(L.qaUrl); } catch (e) {} }
      L.qaUrl = URL.createObjectURL(blob);
      qaMostrarImagem(L, L.qaUrl);
      return true;
    })
    .catch(function () {
      var caixa = L.el && typeof L.el.querySelector === 'function' ? L.el.querySelector('.qa-ver-img') : null;
      if (!caixa) return false;
      caixa.classList.remove('a-carregar'); caixa.classList.add('falhou'); caixa.removeAttribute('aria-busy');
      caixa.innerHTML = '<span class="small">Não deu para carregar a captura.</span>' +
        '<button type="button" class="btn sm" data-toca="vista" data-click="qaImagemDeNovo()">Tentar de novo</button>';
      return false;
    });
}

/* Põe a captura já carregada na caixa da janela do ticket.
   Recebe: L — a camada; url — o object URL.
   Devolve: nada. */
function qaMostrarImagem(L, url) {
  var caixa = L.el && typeof L.el.querySelector === 'function' ? L.el.querySelector('.qa-ver-img') : null;
  if (!caixa) return;
  caixa.classList.remove('a-carregar'); caixa.classList.remove('falhou'); caixa.removeAttribute('aria-busy');
  caixa.innerHTML = '<img src="' + esc(url) + '" alt="A captura de ecrã do ticket">';
}

/* «Tentar de novo» na captura do ticket aberto.
   Devolve: nada. */
function qaImagemDeNovo() {
  var L = qaCamadaTicket;
  if (!L) return;
  var caixa = L.el.querySelector('.qa-ver-img');
  if (caixa) { caixa.classList.remove('falhou'); caixa.classList.add('a-carregar'); caixa.innerHTML = ''; }
  qaCarregarImagem(L, L.qaId);
}

/* Remove um ticket (DELETE: remoção branda) e oferece o Anular no aviso,
   seis segundos — o Anular repõe-no (qaRepor). Por isso não pergunta antes.
   Fecha a janela do ticket, se for ele que está aberto, e a lista atualiza-se.
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou removido. */
function qaRemover(id) {
  if (qaOcupado[id]) return Promise.resolve(false);
  qaOcupado[id] = 1;
  return api('DELETE', '/api/qa/' + encodeURIComponent(id)).then(function () {
    delete qaOcupado[id];
    var T = qaCamadaTicket;
    if (T && T.qaId === id && typeof modalTop === 'function' && modalTop() === T) closeModal();
    if (qaLista.tickets) {
      qaLista.tickets = qaLista.tickets.filter(function (x) { return x.id !== id; });
      qaAbertos = qaSeccoes(qaLista.tickets).abertos.length;
      qaPintarNumero();
      qaPintarLista();
    }
    toast('Ticket removido.', { rotulo: 'Anular', ms: 6000, fn: function () { qaRepor(id); } });
    qaCarregar();
    return true;
  }, function (e) {
    delete qaOcupado[id];
    toast((e && e.message) || 'Não deu para remover o ticket.');
    if (e && e.status === 404) qaCarregar();
    return false;
  });
}

/* O Anular de um remover: o ticket volta (POST /api/qa/:id/repor).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se voltou. */
function qaRepor(id) {
  return api('POST', '/api/qa/' + encodeURIComponent(id) + '/repor').then(function () {
    toast('Ticket reposto.');
    qaCarregar();
    return true;
  }, function (e) {
    toast((e && e.message) || 'Não deu para repor o ticket.');
    return false;
  });
}

/* Reabre um ticket resolvido (POST /api/qa/:id/reabrir): volta a A fazer,
   e a resolução fica, a dizer «Resolução anterior». Otimista, como o mover
   (qaPassarDeColuna).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou reaberto. */
function qaReabrir(id) {
  return qaPassarDeColuna(id, QA_COL_NOVO, '/reabrir', undefined, 'Ticket reaberto.', 'Não deu para reabrir o ticket.');
}

/* «Aceitar» um ticket em Human Tests: passa a Concluído (POST
   /api/qa/:id/mover). Otimista (qaPassarDeColuna).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou aceite. */
function qaAceitar(id) {
  return qaPassarDeColuna(id, QA_COL_CONCLUIDO, '/mover', { coluna: QA_COL_CONCLUIDO }, 'Ticket aceite.', 'Não deu para aceitar o ticket.');
}

/* «Recusar» um ticket em Human Tests: volta a A fazer pelo reabrir (POST
   /api/qa/:id/reabrir), e a resolução fica como «Resolução anterior», para
   quem pegar nele de novo ver o que se tentou. Otimista (qaPassarDeColuna).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou recusado. */
function qaRecusar(id) {
  return qaPassarDeColuna(id, QA_COL_NOVO, '/reabrir', undefined, 'Ticket recusado.', 'Não deu para recusar o ticket.');
}

/* «Adiar» um ticket em Human Tests: passa a Para depois (POST
   /api/qa/:id/mover). Otimista (qaPassarDeColuna).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou adiado. */
function qaAdiar(id) {
  return qaPassarDeColuna(id, QA_COL_DEPOIS, '/mover', { coluna: QA_COL_DEPOIS }, 'Ticket adiado.', 'Não deu para adiar o ticket.');
}

/* «Mover» uma coluna do kanban (POST /api/qa/:id/mover {coluna}): o
   ticket e o cartão dele passam para lá. Otimista (qaPassarDeColuna).
   Recebe: id — o id do ticket; coluna — o id da coluna para onde vai.
   Devolve: Promise com true se ficou movido. */
function qaMover(id, coluna) {
  if (typeof coluna !== 'string' || !QA_ID_COLUNA.test(coluna)) return Promise.resolve(false);
  return qaPassarDeColuna(id, coluna, '/mover', { coluna: coluna },
    'Ticket movido para ' + qaNomeDaColuna(coluna) + '.', 'Não deu para mover o ticket.');
}

/* Passa um ticket para outra coluna, à maneira otimista: a lista, o número
   da pílula e o ticket aberto mudam logo (o resolved_at como o servidor o
   põe: posto ao chegar a uma coluna resolvida, null nas outras), o pedido
   segue, e no fim pede-se a lista outra vez. Falhando, o ticket volta a
   como estava e o aviso diz porquê (num 404, o ticket já não existe: pede-se
   a lista). Um pedido de cada vez por ticket (qaOcupado).
   Recebe: id — o id do ticket; coluna — o id da coluna; fim — o fim do
   caminho ('/reabrir' ou '/mover'); corpo — o corpo do POST (ou
   undefined); frase — o aviso de quando correu bem; falha — o aviso de
   quando falhou sem frase do servidor.
   Devolve: Promise com true se o servidor aceitou. */
function qaPassarDeColuna(id, coluna, fim, corpo, frase, falha) {
  if (qaOcupado[id]) return Promise.resolve(false);
  qaOcupado[id] = 1;
  var t = (qaLista.tickets || []).filter(function (x) { return x.id === id; })[0];
  var antes = t ? { status: t.status, resolved_at: t.resolved_at, updated_at: t.updated_at } : null;
  var repintar = function () {
    if (!qaLista.tickets) return;
    qaAbertos = qaSeccoes(qaLista.tickets).abertos.length;
    qaPintarNumero();
    qaPintarLista();
  };
  if (t) {
    t.status = coluna;
    t.resolved_at = qaColunaResolvida(coluna) ? (t.resolved_at || Date.now()) : null;
    t.updated_at = Date.now();
    repintar();
  }
  var caminho = '/api/qa/' + encodeURIComponent(id) + fim;
  var pedido = corpo === undefined ? api('POST', caminho) : api('POST', caminho, corpo);
  return pedido.then(function () {
    delete qaOcupado[id];
    toast(frase);
    qaCarregar();
    return true;
  }, function (e) {
    delete qaOcupado[id];
    if (t && antes) {
      t.status = antes.status; t.resolved_at = antes.resolved_at; t.updated_at = antes.updated_at;
      repintar();
    }
    toast((e && e.message) || falha);
    if (e && e.status === 404) qaCarregar();
    return false;
  });
}

/* ---------------------------------------------------------- os embrulhos */

/* A pílula segue o render, pela reatribuição da casa (cloud/nucleo.js,
   cloud/apresentacao.js): é ele que chega quando o ambiente se sabe
   (cloud/guia.js), quando se entra e quando se sai. O render do vizinho que o
   carrossel dos separadores pinta às escondidas (vistas.js:pintarVistaAParte)
   não conta. */
var qaRenderDeAntes = render;
render = function () {
  var r = qaRenderDeAntes.apply(this, arguments);
  if (!(typeof _pintarAParte !== 'undefined' && _pintarAParte)) {
    try { qaSincronizar(); } catch (e) {}
  }
  return r;
};

/* Uma janela que abre ou fecha muda os limites da pílula (qaLimites: acima do
   rodapé da janela da frente). Reencaixa-se depois de quem a abriu a marcar
   como do QA (qaMarcarJanela) e outra vez quando a saída acaba.
   Devolve: nada. */
function qaJanelaMudou() {
  if (!qaPil) return;
  setTimeout(function () { try { qaReencaixar(); } catch (e) {} }, 0);
  setTimeout(function () { try { qaReencaixar(); } catch (e) {} }, msDoToken('--medio', 200) + 120);
}
var qaOpenModalDeAntes = openModal;
openModal = function () {
  var L = qaOpenModalDeAntes.apply(this, arguments);
  qaJanelaMudou();
  return L;
};
var qaCloseModalDeAntes = closeModal;
closeModal = function () {
  var r = qaCloseModalDeAntes.apply(this, arguments);
  qaJanelaMudou();
  return r;
};
var qaCloseAllModalsDeAntes = closeAllModals;
closeAllModals = function () {
  var r = qaCloseAllModalsDeAntes.apply(this, arguments);
  qaJanelaMudou();
  return r;
};

// o clique que vem a seguir a um arrasto da pílula engole-se na captura, antes da ação do botão
document.addEventListener('click', qaEngoleClique, true);
// rodar o telemóvel ou mudar a janela de tamanho reencaixa a pílula
window.addEventListener('resize', qaAoMudarTamanho);
window.addEventListener('orientationchange', qaAoMudarTamanho);
// voltar à app atualiza o número por resolver (sem sondar em ciclo)
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && qaPil) qaCarregar();
});
