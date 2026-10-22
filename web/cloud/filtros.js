/* Faz as listas de escolha dos filtros flutuar por cima de tudo, sem cortes:
   as do painel de filtros e as dos chips dos Movimentos. */
'use strict';

/* ---------------------------------------------------------------
   Os painéis de filtros têm scroll próprio (.fpanel>.card), que
   cortava a lista de imóveis/proprietários. Dentro deles, a lista
   passa a flutuar por cima (position:fixed), ancorada ao botão.
   Os chips dos Movimentos (lista-movimentos.js:txChipsHtml) abrem a
   mesma lista a partir de um botão estreito, onde quer que a fila
   os tenha posto: flutua também, com uma largura que dê para ler as
   opções e sem sair do ecrã pelo lado.
   --------------------------------------------------------------- */

// a largura mínima de uma lista flutuante: o botão de um chip tem a largura de uma palavra
var POP_MIN = 240;

/* Prende a lista ao botão em position:fixed, por baixo ou por cima conforme
   o espaço que houver no ecrã (a altura fica entre 150 e 340px), e marca-a
   com data-float para o popRelease saber o que desfazer. A largura é a do
   botão, nunca menos de POP_MIN, e a lista encosta-se ao ecrã em vez de sair
   por ele. Mede o .selbtn irmão; sem ele não mexe em nada.
   Recebe: pop — o elemento .selpop da lista a ancorar.
   Devolve: nada — aplica os estilos inline e marca o data-float. */
function popAnchor(pop) {
  var btn = pop.parentNode && pop.parentNode.querySelector('.selbtn');
  if (!btn) return;
  var r = btn.getBoundingClientRect();
  var below = window.innerHeight - r.bottom - 14, above = r.top - 14;
  var up = below < 190 && above > below;
  var vw = window.innerWidth || document.documentElement.clientWidth || 0;
  var w = Math.min(Math.max(r.width, POP_MIN), Math.max(0, vw - 16));
  var esq = vw ? Math.max(8, Math.min(r.left, vw - w - 8)) : r.left;
  pop.style.position = 'fixed';
  pop.style.left = esq + 'px';
  pop.style.width = w + 'px';
  pop.style.right = 'auto';
  pop.style.zIndex = '120';
  pop.style.maxHeight = Math.max(150, Math.min(340, up ? above : below)) + 'px';
  if (up) { pop.style.top = 'auto'; pop.style.bottom = (window.innerHeight - r.top + 5) + 'px'; }
  else { pop.style.top = (r.bottom + 5) + 'px'; pop.style.bottom = 'auto'; }
  pop.setAttribute('data-float', '1');
}

// Desfaz o que o popAnchor pôs — os estilos inline e o data-float. Nas
// listas que nunca flutuaram não toca.
// Recebe: pop — o elemento .selpop a soltar.
// Devolve: nada — limpa os estilos inline e tira o data-float.
function popRelease(pop) {
  if (!pop.getAttribute('data-float')) return;
  ['position', 'left', 'width', 'right', 'top', 'bottom', 'maxHeight', 'zIndex'].forEach(function (k) {
    pop.style[k] = '';
  });
  pop.removeAttribute('data-float');
}

// Solta todas as listas flutuantes que entretanto fecharam; as ainda
// abertas ficam ancoradas onde estão.
// Devolve: nada — solta as que já não estão abertas.
function releaseAll() {
  [].slice.call(document.querySelectorAll('.selpop[data-float]')).forEach(function (p) {
    if (!p.classList.contains('on')) popRelease(p);
  });
}

var _selOpen = selOpen;
selOpen = function (e, id) {
  _selOpen(e, id);
  releaseAll();
  var pop = document.getElementById('pop_' + id);
  if (!pop) return;
  if (!pop.classList.contains('on')) return popRelease(pop);
  var panel = pop.closest ? pop.closest('.fpanel') : null;
  var chips = !panel && pop.closest ? pop.closest('.mov-chips') : null;
  if (!panel && !chips) return;       // fora dos painéis de filtro e dos chips nada muda
  popAnchor(pop);
  if (chips) return;                  // os chips rolam com a página: quem os segue é o ouvinte do scroll
  var scroller = panel.querySelector('.card');
  if (scroller && !scroller._cwHooked) {
    scroller._cwHooked = 1;
    scroller.addEventListener('scroll', function () {
      [].slice.call(panel.querySelectorAll('.selpop.on[data-float]')).forEach(popAnchor);
    });
  }
};

var _selPick = selPick;
selPick = function (e, id, i) {
  var pop = document.getElementById('pop_' + id);
  _selPick(e, id, i);
  if (pop) popRelease(pop);
};

var _closePops = closePops;
closePops = function (keep) {
  _closePops(keep);
  releaseAll();
};

window.addEventListener('resize', function () {
  [].slice.call(document.querySelectorAll('.selpop.on[data-float]')).forEach(popAnchor);
});
/* a lista de um chip está presa ao ecrã, e o chip rola com a página: segue-o */
window.addEventListener('scroll', function () {
  [].slice.call(document.querySelectorAll('.mov-chips .selpop.on[data-float]')).forEach(popAnchor);
}, { passive: true });
