/* ===== TICKETS DE QA ===== */
/* O botão de QA do ambiente de desenvolvimento: uma pílula que se arrasta para
   a borda que estorvar menos e abre «Novo ticket» e «Ver tickets». Os tickets
   vão para a D1 do ambiente (worker/src/rotas/qa.js) com o contexto do ecrã,
   e o Claude lê-os com scripts/qa.mjs. Em produção nada disto existe: nem a
   pílula (CW.ambiente === 'producao') nem as rotas (404 sem ENV_NAME). */
'use strict';

/* O desenho (a opção C que o Martinho escolheu, 2026-10-28): a pega de pontos
   à esquerda, o ícone, «QA» e o número de abertos, num roxo (--loan) que não
   se confunde com o cobalto das ações da app. Na primeira vez, ao lado, a
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

var qaPil = null;            // o elemento da pílula (#qaPilula); null fora do dev ou sem sessão
var qaSonda = null;          // a sonda das margens seguras (#qaSonda)
var qaXY = null;             // onde a pílula está agora, {x, y} em px (o canto de cima à esquerda)
var qaArr = null;            // o arrasto em curso
var qaAnim = null;           // a animação do encaixe em curso
var qaEngoleAte = 0;         // até quando (Date.now) se engole o clique a seguir a um arrasto
var qaArrastouAqui = false;  // o mesmo que QA_LS_ARRASTOU, para quando o armazenamento está vedado
var qaPonteiro = '';         // o ponteiro do último toque na pílula: 'touch', 'mouse', 'pen' ou 'teclado'
var qaContextoGuardado = null;   // o ecrã no momento em que se abriu o menu
var qaLista = { tickets: null, falhou: false, aPedir: null };   // tickets: null quer dizer «ainda não se sabe»
var qaAbertos = null;        // quantos tickets abertos; null enquanto não se sabe
var qaRascunho = null;       // o ticket a ser escrito: {gravidade, imagem, url, id, aEnviar, contexto, camada}
var qaCamadaLista = null;    // a camada da janela «Tickets de QA», enquanto aberta
var qaCamadaTicket = null;   // a camada da janela de um ticket, enquanto aberta
var qaOcupado = {};          // id → 1: um pedido de remover ou reabrir esse ticket a caminho
var qaTamanhoPedido = 0;     // o requestAnimationFrame do reencaixe ao mudar de tamanho

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
   Recebe: n — quantos tickets abertos (null se ainda não se sabe);
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

/* As duas opções do menu da pílula.
   Recebe: n — quantos tickets abertos (null se ainda não se sabe).
   Devolve: o HTML (texto). */
function qaHtmlMenu(n) {
  return '<button type="button" data-toca="camada" data-click="closePops();qaNovoTicket()">' + ic('plus', 17) + ' Novo ticket</button>' +
    '<button type="button" class="qa-menu-ver" data-toca="camada" data-click="closePops();qaVerTickets()">' + ic('lista', 17) + ' ' + esc(qaRotuloVer(n)) + '</button>';
}

/* O número da pílula, curto: 99+ a partir de cem.
   Recebe: n — quantos tickets abertos.
   Devolve: o texto ('' sem número). */
function qaNumeroCurto(n) {
  if (!(n > 0)) return '';
  return n > 99 ? '99+' : String(n);
}

/* O nome do botão para o leitor de ecrã, com o número dito por extenso.
   Recebe: n — quantos tickets abertos (null se ainda não se sabe).
   Devolve: o texto. */
function qaRotuloDoBotao(n) {
  if (n == null) return 'Tickets de QA';
  if (n === 0) return 'Tickets de QA, nenhum aberto';
  return 'Tickets de QA, ' + n + (n === 1 ? ' aberto' : ' abertos');
}

/* O rótulo da segunda opção do menu: «Ver tickets (N)», com N os abertos.
   Recebe: n — quantos tickets abertos (null se ainda não se sabe).
   Devolve: o texto. */
function qaRotuloVer(n) {
  return n == null ? 'Ver tickets' : 'Ver tickets (' + n + ')';
}

/* Escreve o número de abertos na pílula e no menu, sem a refazer (o menu
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
  var aside = document.querySelector('aside');
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
   etiqueta e o menu abrirem para dentro do ecrã.
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
   (a origem da entrada), e pede o número de abertos.
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
   Com tudo certo fecha e avisa, e o número de abertos atualiza-se.
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

/* Vai buscar os tickets (GET /api/qa), um pedido de cada vez, e com eles o
   número de abertos; repinta a pílula, a lista e o ticket aberto. Corre ao
   aparecer a pílula, ao abrir o menu, ao abrir a lista, depois de criar,
   remover, repor e reabrir, e ao voltar à app — nunca em ciclo. A falha não
   é uma lista vazia: diz-se, com «Tentar de novo».
   Devolve: Promise que acaba quando a resposta chega (ou falha). */
function qaCarregar() {
  if (qaLista.aPedir) return qaLista.aPedir;
  var p = Promise.resolve().then(function () { return api('GET', '/api/qa'); }).then(function (r) {
    qaLista.aPedir = null;
    qaLista.falhou = false;
    qaLista.tickets = (r && Array.isArray(r.tickets) ? r.tickets : []).filter(function (t) { return t && typeof t === 'object' && t.id; });
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

/* Os tickets arrumados: os abertos agrupados por gravidade (bloqueia,
   incomoda, detalhe, sem gravidade) e em cada grupo do mais recente para o
   mais antigo, e os resolvidos, do resolvido há menos tempo para o resolvido
   há mais.
   Recebe: ts — os tickets da API.
   Devolve: {abertos, resolvidos} (arrays novos). */
function qaSeccoes(ts) {
  var lista = Array.isArray(ts) ? ts : [];
  var abertos = lista.filter(function (t) { return t.status !== 'resolvido'; })
    .sort(function (a, b) {
      return qaOrdemGravidade(a.severity) - qaOrdemGravidade(b.severity) ||
        (Number(b.created_at) || 0) - (Number(a.created_at) || 0);
    });
  var resolvidos = lista.filter(function (t) { return t.status === 'resolvido'; })
    .sort(function (a, b) { return (Number(b.resolved_at || b.updated_at) || 0) - (Number(a.resolved_at || a.updated_at) || 0); });
  return { abertos: abertos, resolvidos: resolvidos };
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

/* O corpo da lista: a espera, a falha com «Tentar de novo», o vazio, ou os
   abertos e, a seguir, os «Resolvidos». Com tickets já mostrados e uma
   atualização falhada, diz que é o que havia.
   Devolve: o HTML (texto). */
function qaHtmlLista() {
  var ts = qaLista.tickets;
  var deNovo = '<button type="button" class="btn sm" data-toca="dados" data-click="qaCarregarDeNovo()">Tentar de novo</button>';
  if (ts === null) {
    return qaLista.falhou
      ? '<div class="empty"><b>Não deu para carregar os tickets.</b>Pode ser a ligação. Tenta de novo daqui a pouco.<div>' + deNovo + '</div></div>'
      : '<div class="espera"><span class="roda" aria-hidden="true"></span><span><b>À espera do servidor.</b> Os tickets aparecem assim que chegarem.</span></div>';
  }
  var s = qaSeccoes(ts);
  var aviso = qaLista.falhou ? '<div class="qa-desatual"><span>Não deu para atualizar: isto é o que havia.</span>' + deNovo + '</div>' : '';
  if (!s.abertos.length && !s.resolvidos.length) {
    return aviso + '<div class="empty"><b>Ainda não há tickets.</b>Quando vires alguma coisa que não está bem, toca em QA e depois em Novo ticket.</div>';
  }
  return '<div class="qa-lista">' + aviso +
    '<h3 class="qa-sec">Abertos <span class="qa-sec-n">' + s.abertos.length + '</span></h3>' +
    (s.abertos.length ? qaHtmlGrupos(s.abertos) : '<p class="hint">Nenhum ticket aberto.</p>') +
    (s.resolvidos.length ? '<h3 class="qa-sec">Resolvidos <span class="qa-sec-n">' + s.resolvidos.length + '</span></h3>' +
      '<div class="qa-linhas">' + s.resolvidos.map(qaHtmlLinha).join('') + '</div>' : '') +
    '</div>';
}

/* Os abertos em grupos por gravidade, cada um com o título e quantos tem
   (os tickets já vêm arrumados por qaSeccoes).
   Recebe: abertos — os tickets abertos, pela ordem de qaSeccoes.
   Devolve: o HTML (texto). */
function qaHtmlGrupos(abertos) {
  var grupos = [];
  abertos.forEach(function (t) {
    var o = qaOrdemGravidade(t.severity);
    if (!grupos.length || grupos[grupos.length - 1].o !== o) grupos.push({ o: o, ts: [] });
    grupos[grupos.length - 1].ts.push(t);
  });
  return grupos.map(function (g) {
    var nome = g.o < QA_GRAVIDADES.length ? QA_GRAVIDADES[g.o].rotulo : 'Sem gravidade';
    return '<h4 class="qa-grupo">' + nome + ' <span class="qa-grupo-n">' + g.ts.length + '</span></h4>' +
      '<div class="qa-linhas">' + g.ts.map(qaHtmlLinha).join('') + '</div>';
  }).join('');
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
   (carregada com a sessão), a resolução e o contexto; em baixo «Remover» e
   «Reabrir» (nos resolvidos) ou «Fechar».
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

/* O corpo da janela de um ticket.
   Recebe: t — o ticket.
   Devolve: o HTML (texto). */
function qaHtmlTicket(t) {
  var resolvido = t.status === 'resolvido';
  return '<div class="form qa-ver">' +
    '<div class="qa-ver-cab">' + (resolvido ? '<span class="badge in">Resolvido</span>' : '<span class="badge">Aberto</span>') + qaSelo(t.severity) + '</div>' +
    '<p class="small qa-quem">' + esc(qaAutor(t, true)) + ' · ' + esc(qaQuando(t.created_at)) + '</p>' +
    '<p class="qa-ver-txt">' + esc(t.body) + '</p>' +
    (t.imagem ? '<div class="qa-ver-img a-carregar" aria-busy="true"><span class="qa-so-leitor">A carregar a captura</span></div>' : '') +
    (t.resolution ? '<div class="qa-resolucao' + (resolvido ? '' : ' anterior') + '"><b>' + (resolvido ? 'Resolução' : 'Resolução anterior') + '</b>' +
      '<p>' + esc(t.resolution) + '</p>' + (resolvido && t.resolved_at ? '<span class="small">' + esc(qaQuando(t.resolved_at)) + '</span>' : '') + '</div>' : '') +
    fold('qaCtx', 'Contexto', qaHtmlContexto(t.context), { icon: 'info' }) +
    '</div>';
}

/* O rodapé da janela de um ticket: «Remover» sempre (com Anular, por isso
   sem pergunta), e «Reabrir» num resolvido ou «Fechar» num aberto.
   Recebe: t — o ticket.
   Devolve: o HTML (texto). */
function qaRodapeTicket(t) {
  var id = jsq(t.id);
  return '<button type="button" class="btn qa-remover" data-toca="dados" data-risco="destroi" data-click="qaRemover(\'' + id + '\')">' + ic('trash', 16) + ' Remover</button>' +
    (t.status === 'resolvido'
      ? '<button type="button" class="btn primary" data-toca="dados" data-click="qaReabrir(\'' + id + '\')">Reabrir</button>'
      : '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>');
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

/* Reabre um ticket resolvido (POST /api/qa/:id/reabrir): volta aos abertos,
   e a resolução fica, a dizer «Resolução anterior».
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou reaberto. */
function qaReabrir(id) {
  if (qaOcupado[id]) return Promise.resolve(false);
  qaOcupado[id] = 1;
  return api('POST', '/api/qa/' + encodeURIComponent(id) + '/reabrir').then(function () {
    delete qaOcupado[id];
    toast('Ticket reaberto.');
    var t = (qaLista.tickets || []).filter(function (x) { return x.id === id; })[0];
    if (t) {
      t.status = 'aberto'; t.resolved_at = null; t.updated_at = Date.now();
      qaAbertos = qaSeccoes(qaLista.tickets).abertos.length;
      qaPintarNumero();
      qaPintarLista();
    }
    qaCarregar();
    return true;
  }, function (e) {
    delete qaOcupado[id];
    toast((e && e.message) || 'Não deu para reabrir o ticket.');
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
// voltar à app atualiza o número de abertos (sem sondar em ciclo)
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && qaPil) qaCarregar();
});
