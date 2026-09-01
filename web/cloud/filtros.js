/* Faz a lista de imoveis flutuar por cima do painel de filtros, sem cortes. */
'use strict';

/* ---------------------------------------------------------------
   Os painéis de filtros têm scroll próprio (.fpanel>.card), que
   cortava a lista de imóveis/proprietários. Dentro deles, a lista
   passa a flutuar por cima (position:fixed), ancorada ao botão.
   --------------------------------------------------------------- */

function popAnchor(pop) {
  var btn = pop.parentNode && pop.parentNode.querySelector('.selbtn');
  if (!btn) return;
  var r = btn.getBoundingClientRect();
  var below = window.innerHeight - r.bottom - 14, above = r.top - 14;
  var up = below < 190 && above > below;
  pop.style.position = 'fixed';
  pop.style.left = r.left + 'px';
  pop.style.width = r.width + 'px';
  pop.style.right = 'auto';
  pop.style.zIndex = '120';
  pop.style.maxHeight = Math.max(150, Math.min(340, up ? above : below)) + 'px';
  if (up) { pop.style.top = 'auto'; pop.style.bottom = (window.innerHeight - r.top + 5) + 'px'; }
  else { pop.style.top = (r.bottom + 5) + 'px'; pop.style.bottom = 'auto'; }
  pop.setAttribute('data-float', '1');
}

function popRelease(pop) {
  if (!pop.getAttribute('data-float')) return;
  ['position', 'left', 'width', 'right', 'top', 'bottom', 'maxHeight', 'zIndex'].forEach(function (k) {
    pop.style[k] = '';
  });
  pop.removeAttribute('data-float');
}

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
  if (!panel) return;                 // fora dos painéis de filtro nada muda
  popAnchor(pop);
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

CW.pushNow = pushNow;
CW.pullNow = pullNow;
