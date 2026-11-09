/* O kanban da equipa: o arrasto dos cartões (rato e dedo), o assentar e o
   mover otimista (equipa-kanban.js junta-o ao resto).
   ---------------------------------------------------------------------
   Um pedaço do mesmo guião: as mesmas regras do topo do equipa-kanban.js
   (String.raw sem crases nem cifrão com chaveta; nada de on…= nem style= no
   HTML — o que mexe durante o arrasto mexe por CSSOM; nomes de topo kb…, só
   function e var). Corre como parte de um único script clássico. */

export const GUIAO_KB_ARRASTO = String.raw`/* ------------------------------- arrastar -------------------------------- */
/* Com o rato arrasta-se o cartão inteiro; com o dedo, pela pega (só ela tem
   touch-action:none, e arrastar no resto do cartão continua a rolar). A
   partir de 6px o cartão levanta-se: sai do fluxo (fixo, à mesma largura)
   e segue o ponteiro por transform; no lugar de destino aparece o lugar
   tracejado da altura dele, e a coluna de destino acende. Perto das bordas
   o quadro rola de lado e a coluna rola na vertical. Largar move logo
   (otimista) e assenta o cartão do sítio onde se largou até ao novo; se o
   servidor recusar, volta. Esc e o pointercancel desfazem. No telemóvel
   arrasta-se só dentro da coluna à vista; mudar de coluna é pelo «Mover
   para…». */

/* Pousou o rato num cartão (ou o dedo na pega): fica à escuta do resto do
   gesto. O rato só prende o ponteiro quando o arrasto começa, para um
   clique simples continuar a abrir o cartão.
   Recebe: e — o PointerEvent do pointerdown.
   Devolve: nada. */
function kbPousar(e) {
  if (kbArr || (e.button != null && e.button > 0) || e.isPrimary === false) return;
  var t = e.target;
  if (!t || !t.closest) return;
  var pega = t.closest('.kb-pega'), no = t.closest('.kb-cartao');
  if (!no || !no.closest('#kbQuadro')) return;
  if (!pega && (e.pointerType !== 'mouse' || t.closest('.kb-mais'))) return;
  if (pega) e.preventDefault();
  kbArr = { no: no, chave: no.getAttribute('data-chave'), id: e.pointerId, pega: pega, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
    ativo: false, cancelado: false, lugar: null, chaveAlvo: '', colAlvo: null, raf: 0, vx: 0, vy: 0, lista: null };
  if (pega) { try { pega.setPointerCapture(e.pointerId); } catch (x) { /* sem captura, segue pelo documento */ } }
  document.addEventListener('pointermove', kbArrMove);
  document.addEventListener('pointerup', kbArrLargar);
  document.addEventListener('pointercancel', kbArrCancelar);
  window.addEventListener('keydown', kbArrTecla, true);
}
/* O ponteiro andou: passado o limiar, levanta o cartão; depois leva-o com ele.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada. */
function kbArrMove(e) {
  var a = kbArr;
  if (!a || a.cancelado || e.pointerId !== a.id) return;
  if (!a.no.isConnected) { kbArrCancelar(); return; }
  a.x = e.clientX; a.y = e.clientY;
  if (!a.ativo) {
    if (Math.abs(a.x - a.x0) < 6 && Math.abs(a.y - a.y0) < 6) return;
    kbArrComecar();
  }
  if (e.preventDefault) e.preventDefault();
  kbArrPintar();
  kbArrRolagem();
}
/* Levanta o cartão: deixa o lugar tracejado no sítio dele e passa-o a fixo,
   à mesma largura e no mesmo sítio, para o transform o levar.
   Devolve: nada. */
function kbArrComecar() {
  var a = kbArr, r = a.no.getBoundingClientRect();
  a.ativo = true;
  a.colOrigem = a.no.closest('.kb-col');
  a.lugar = document.createElement('div');
  a.lugar.className = 'kb-lugar';
  a.lugar.setAttribute('aria-hidden', 'true');
  a.lugar.style.height = Math.round(r.height) + 'px';
  a.no.parentNode.insertBefore(a.lugar, a.no);
  a.no.style.width = r.width + 'px';
  a.no.style.left = r.left + 'px';
  a.no.style.top = r.top + 'px';
  a.no.classList.add('kb-no-ar');
  var q = el('kbQuadro');
  if (q) q.classList.add('kb-a-arrastar');
  try { a.no.setPointerCapture(a.id); } catch (x) { /* segue pelo documento */ }
}
/* Leva o cartão com o ponteiro e mostra onde vai cair.
   Devolve: nada. */
function kbArrPintar() {
  var a = kbArr;
  if (!a || !a.ativo) return;
  a.no.style.transform = 'translate(' + Math.round(a.x - a.x0) + 'px,' + Math.round(a.y - a.y0) + 'px)';
  var alvo = kbArrAlvo(a.x, a.y);
  if (!alvo) return;
  var chave = alvo.lista.getAttribute('data-coluna') + '|' + (alvo.antes ? alvo.antes.getAttribute('data-chave') : '');
  if (chave === a.chaveAlvo) return;
  a.chaveAlvo = chave; a.lista = alvo.lista;
  if (alvo.antes) alvo.lista.insertBefore(a.lugar, alvo.antes); else alvo.lista.appendChild(a.lugar);
  var col = alvo.lista.closest('.kb-col');
  if (a.colAlvo !== col) {
    if (a.colAlvo) a.colAlvo.classList.remove('kb-alvo');
    a.colAlvo = col;
    if (col && col !== a.colOrigem) col.classList.add('kb-alvo');
  }
}
/* Onde vai cair o cartão com o ponteiro em (x, y): a coluna debaixo dele (a
   mais perto, dentro do que o quadro mostra; no telemóvel, sempre a da
   origem) e, nela, antes de que cartão — pelo meio de cada um.
   Recebe: x, y — o ponteiro (clientX, clientY).
   Devolve: {lista, antes} — antes é o cartão que fica a seguir (null no fim) —, ou null. */
function kbArrAlvo(x, y) {
  var a = kbArr, q = el('kbQuadro');
  if (!q) return null;
  var col = null;
  if (kbTelemovel()) col = a.colOrigem;
  else {
    var rq = q.getBoundingClientRect(), xx = Math.max(rq.left + 1, Math.min(rq.right - 1, x)), dist = Infinity;
    [].slice.call(q.querySelectorAll('.kb-col')).forEach(function (c) {
      var r = c.getBoundingClientRect();
      if (r.right < rq.left || r.left > rq.right) return;
      var d = xx < r.left ? r.left - xx : xx > r.right ? xx - r.right : 0;
      if (d < dist) { dist = d; col = c; }
    });
  }
  var lista = col && col.querySelector('.kb-col-lista');
  if (!lista) return null;
  var antes = null, cs = lista.querySelectorAll('.kb-cartao');
  for (var i = 0; i < cs.length; i++) {
    if (cs[i] === a.no) continue;
    var r2 = cs[i].getBoundingClientRect();
    if (y < r2.top + r2.height / 2) { antes = cs[i]; break; }
  }
  return { lista: lista, antes: antes };
}
/* Perto das bordas, o quadro rola de lado (no computador) e a coluna rola
   na vertical, mais depressa quanto mais perto.
   Devolve: nada — arranca ou pára o passo da auto-rolagem. */
function kbArrRolagem() {
  var a = kbArr, q = el('kbQuadro');
  if (!a || !a.ativo || !q) return;
  var zona = 56, v = function (p, lo, hi) {
    if (p < lo + zona) return -Math.ceil(16 * Math.min(1, (lo + zona - p) / zona));
    if (p > hi - zona) return Math.ceil(16 * Math.min(1, (p - (hi - zona)) / zona));
    return 0;
  };
  var rq = q.getBoundingClientRect();
  a.vx = kbTelemovel() ? 0 : v(a.x, rq.left, rq.right);
  var l = a.lista;
  if (l) { var rl = l.getBoundingClientRect(); a.vy = v(a.y, Math.max(rl.top, 0), Math.min(rl.bottom, window.innerHeight)); } else a.vy = 0;
  if ((a.vx || a.vy) && !a.raf) a.raf = requestAnimationFrame(kbArrPasso);
}
/* Um passo da auto-rolagem: rola e volta a procurar o destino debaixo do ponteiro.
   Devolve: nada. */
function kbArrPasso() {
  var a = kbArr, q = el('kbQuadro');
  if (!a) return;
  a.raf = 0;
  if (!a.ativo || !q) return;
  var mexeu = false;
  if (a.vx) { var x = q.scrollLeft; q.scrollLeft += a.vx; mexeu = q.scrollLeft !== x; }
  if (a.vy && a.lista) { var y = a.lista.scrollTop; a.lista.scrollTop += a.vy; mexeu = mexeu || a.lista.scrollTop !== y; }
  if (!mexeu) return;
  a.chaveAlvo = '';
  kbArrPintar();
  kbArrRolagem();
}
/* Tira os ouvintes, o lugar tracejado e a marca da coluna, e devolve o
   cartão ao fluxo (no sítio de onde saiu).
   Recebe: a — o estado do arrasto.
   Devolve: nada. */
function kbArrDesfazer(a) {
  if (a.raf) { cancelAnimationFrame(a.raf); a.raf = 0; }
  document.removeEventListener('pointermove', kbArrMove);
  document.removeEventListener('pointerup', kbArrLargar);
  document.removeEventListener('pointercancel', kbArrCancelar);
  window.removeEventListener('keydown', kbArrTecla, true);
  if (a.lugar && a.lugar.parentNode) a.lugar.parentNode.removeChild(a.lugar);
  if (a.colAlvo) a.colAlvo.classList.remove('kb-alvo');
  a.no.classList.remove('kb-no-ar');
  a.no.style.width = ''; a.no.style.left = ''; a.no.style.top = ''; a.no.style.transform = '';
  var q = el('kbQuadro');
  if (q) q.classList.remove('kb-a-arrastar');
  kbArr = null;
  if (a.ativo) kbArrAcabou = Date.now();
}
/* Largou: sem ter arrastado, era um clique (segue o seu caminho); arrastado,
   o cartão vai para o lugar tracejado. No mesmo lugar, só assenta de volta.
   Recebe: e — o PointerEvent do pointerup.
   Devolve: nada. */
function kbArrLargar(e) {
  var a = kbArr;
  if (!a || (e && e.pointerId !== a.id)) return;
  if (!a.ativo || a.cancelado) { kbArrDesfazer(a); return; }
  var lista = a.lugar.parentNode, coluna = lista && lista.getAttribute('data-coluna');
  var depois = kbIrmaoCartao(a.lugar, 'nextElementSibling', a.no), antes = kbIrmaoCartao(a.lugar, 'previousElementSibling', a.no);
  var rect = a.no.getBoundingClientRect();
  kbArrDesfazer(a);
  var c = kbCartao(a.chave);
  if (!c || !coluna) { kbPintarDepoisDoArrasto(); return; }
  var ordem = kbDaColuna(coluna).filter(function (x) { return x.chave !== a.chave; }).map(function (x) { return x.chave; });
  var indice = kbIndiceEntre(ordem, depois, antes);
  var agora = kbDaColuna(c.coluna_id).map(function (x) { return x.chave; }).indexOf(a.chave);
  if (coluna === c.coluna_id && indice === agora) { kbPintarDepoisDoArrasto(); kbAssentarChave(a.chave, rect); return; }
  kbPintarDepois = false;
  kbMover(a.chave, coluna, indice, rect);
}
// O repintar que ficou à espera do fim do arrasto (uma leitura que chegou a meio).
// Devolve: nada.
function kbPintarDepoisDoArrasto() {
  if (!kbPintarDepois) return;
  kbPintarDepois = false;
  kbPintarQuadro(); kbPintarChips();
}
/* O cartão vizinho do lugar tracejado (saltando o que está a ser arrastado).
   Recebe: no — o lugar; lado — 'nextElementSibling' ou 'previousElementSibling'; salta — o cartão no ar.
   Devolve: a chave do vizinho, ou ''. */
function kbIrmaoCartao(no, lado, salta) {
  for (var n = no[lado]; n; n = n[lado]) {
    if (n !== salta && n.classList && n.classList.contains('kb-cartao')) return n.getAttribute('data-chave') || '';
  }
  return '';
}
/* O indice que o servidor quer (a posição entre os cartões da coluna, sem
   o que se move), a partir dos vizinhos à vista do lugar onde se largou —
   com filtros, entre os vizinhos podem estar cartões escondidos, e é a
   ordem inteira que conta.
   Recebe: ordem — as chaves da coluna de destino, sem a do cartão; depois —
   a chave do cartão à vista a seguir ('' sem nenhum); antes — a do anterior.
   Devolve: o índice (0 = topo). */
function kbIndiceEntre(ordem, depois, antes) {
  var i = depois ? ordem.indexOf(depois) : -1;
  if (i > -1) return i;
  var j = antes ? ordem.indexOf(antes) : -1;
  if (j > -1) return j + 1;
  return depois ? 0 : ordem.length;
}
/* A ordem do quadro com um cartão movido: tira-o, muda-lhe a coluna e
   mete-o no indice da coluna de destino (maior do que o total, no fim).
   Recebe: cartoes — a lista do quadro; chave; coluna — o id de destino; indice.
   Devolve: a lista nova (a antiga fica como estava). */
function kbMoverLocal(cartoes, chave, coluna, indice) {
  var c = null, resto = [];
  cartoes.forEach(function (x) { if (x.chave === chave) c = x; else resto.push(x); });
  if (!c) return cartoes.slice();
  var novo = Object.assign({}, c, { coluna_id: coluna });
  var n = 0, pos = -1, ultimo = -1;
  for (var i = 0; i < resto.length; i++) {
    if (resto[i].coluna_id !== coluna) continue;
    if (n === indice) { pos = i; break; }
    n++; ultimo = i;
  }
  if (pos < 0) pos = ultimo > -1 ? ultimo + 1 : resto.length;
  resto.splice(pos, 0, novo);
  return resto;
}
/* Esc a meio de um arrasto desfaz-o (e não fecha nada por trás).
   Recebe: e — o KeyboardEvent.
   Devolve: nada. */
function kbArrTecla(e) {
  var a = kbArr;
  if (!a || e.key !== 'Escape') return;
  e.preventDefault(); e.stopPropagation();
  kbArrCancelar();
}
/* O browser tomou o gesto (pointercancel), ou o Esc: o cartão volta ao sítio, a assentar.
   Devolve: nada. */
function kbArrCancelar() {
  var a = kbArr;
  if (!a) return;
  var rect = a.ativo ? a.no.getBoundingClientRect() : null, chave = a.chave;
  kbArrDesfazer(a);
  kbPintarDepoisDoArrasto();
  if (rect) kbAssentarChave(chave, rect);
}

/* Assenta um cartão no sítio novo a partir de onde estava (FLIP): parte do
   retângulo antigo e desliza até ao novo com a --curva-entra. Com menos
   movimento, aparece logo no sítio.
   Recebe: no — o cartão (já no sítio novo); r0 — o retângulo de onde vem.
   Devolve: nada. */
function kbAssentar(no, r0) {
  if (!no || !r0 || kbReduzido() || !no.getBoundingClientRect) return;
  var r = no.getBoundingClientRect();
  if (!r.width) return;
  var dx = Math.round(r0.left - r.left), dy = Math.round(r0.top - r.top);
  if (!dx && !dy) return;
  no.classList.remove('kb-assenta');
  no.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  no.getBoundingClientRect();
  no.classList.add('kb-assenta');
  no.style.transform = '';
  setTimeout(function () { no.classList.remove('kb-assenta'); }, 400);
}
// Assenta o cartão desta chave, procurado no quadro.
// Recebe: chave; r0 — o retângulo de onde vem.
// Devolve: nada.
function kbAssentarChave(chave, r0) {
  var q = el('kbQuadro');
  kbAssentar(q && q.querySelector('.kb-cartao[data-chave="' + String(chave).replace(/[^\w-]/g, '') + '"]'), r0);
}

/* Move um cartão: logo no ecrã (otimista), depois no servidor; se ele
   recusar, o cartão volta para onde estava e o aviso diz porquê.
   Recebe: chave; coluna — o id de destino; indice — a posição nela (0 =
   topo, sem contar o próprio); r0 (opcional) — o retângulo de onde parte, para assentar.
   Devolve: nada. */
function kbMover(chave, coluna, indice, r0) {
  var c = kbCartao(chave);
  if (!c || !kbEstado) return;
  var origem = c.coluna_id, antes = kbEstado.cartoes;
  if (!r0) {
    var q = el('kbQuadro'), no = q && q.querySelector('.kb-cartao[data-chave="' + chave + '"]');
    r0 = no ? no.getBoundingClientRect() : null;
  }
  kbEstado.cartoes = kbMoverLocal(antes, chave, coluna, indice);
  kbPintarQuadro(); kbPintarChips();
  kbAssentarChave(chave, r0);
  kbEmVoo++;
  enviar(kbRota(chave, '/mover'), { coluna_id: coluna, indice: indice }).then(function () {
    kbEmVoo--;
    if (coluna !== origem) avisar(chave + ' passou para «' + kbNomeColuna(coluna) + '».');
    if (kbEmVoo === 0) kbRecarregar();
    if (kbAberto === chave) kbAbrir(chave, false);
  }, function (e) {
    kbEmVoo--;
    var q2 = el('kbQuadro'), no2 = q2 && q2.querySelector('.kb-cartao[data-chave="' + chave + '"]');
    var r1 = no2 ? no2.getBoundingClientRect() : null;
    if (kbEstado) kbEstado.cartoes = kbMoverLocal(kbEstado.cartoes, chave, origem, kbPosicaoEm(antes, chave, origem));
    kbPintarQuadro(); kbPintarChips();
    kbAssentarChave(chave, r1);
    avisar((e && e.message) || 'Não deu para mover o cartão.', 'erro');
    if (kbEmVoo === 0) kbRecarregar();
  });
}
// A posição de um cartão na sua coluna (sem contar com ele), numa lista do quadro.
// Recebe: cartoes — a lista; chave; coluna — o id da coluna.
// Devolve: o índice (0 = topo).
function kbPosicaoEm(cartoes, chave, coluna) {
  var i = cartoes.filter(function (x) { return x.coluna_id === coluna; }).map(function (x) { return x.chave; }).indexOf(chave);
  return i < 0 ? 0 : i;
}

/* ------------------------- as ações do arrasto -------------------------- */

// O clique que vem logo depois de um arrasto não abre nada.
// Devolve: true quando é esse clique.
function kbDepoisDeArrastar() { return Date.now() - kbArrAcabou < 400; }

ACOES.kbMover = function (d) { kbFecharJanela(); kbMover(d.arg, d.arg2, Number(d.arg3) || 0); };

// o pousar do arrasto (sai logo quando o kanban não está no ecrã)
document.addEventListener('pointerdown', kbPousar);
`;

// os estilos deste pedaço (o CSS_KANBAN do equipa-kanban.js junta-os pela ordem certa)
export const CSS_KB_ARRASTO = `/* ---- o arrasto: o cartão no ar, o lugar tracejado e o assentar ---- */
.kb-a-arrastar,.kb-a-arrastar .kb-cartao{cursor:grabbing}
.kb-cartao.kb-no-ar{position:fixed;z-index:70;margin:0;pointer-events:none;border-color:var(--accent);
  box-shadow:0 0 0 1px var(--accent),var(--shadow);will-change:transform}
.kb-lugar{flex:none;border:2px dashed var(--accent);border-radius:12px;background:var(--accent-soft)}
.kb-cartao.kb-assenta{transition:transform var(--medio) var(--curva-entra)}

/* com rato: a meio do arrasto, os cartões por baixo não acendem */
@media(hover:hover) and (pointer:fine){
  .kb-a-arrastar .kb-cartao:hover{border-color:var(--line)}
}

/* menos movimento: o cartão assenta de uma vez */
@media(prefers-reduced-motion:reduce){
  .kb-cartao.kb-assenta{transition:none}
}
`;
