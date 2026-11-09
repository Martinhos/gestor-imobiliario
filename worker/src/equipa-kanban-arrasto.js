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
   tracejado da altura dele, e a coluna de destino acende. Quando o lugar
   muda de sítio, os cartões à volta deslizam do sítio antigo para o novo
   (FLIP, kbDeslizar), em vez de saltarem. Perto das bordas a coluna rola na
   vertical e, no computador, o quadro rola de lado — só depois de o
   ponteiro andar para esse lado (a pega pode estar já perto de uma borda).
   No telemóvel, que mostra uma coluna de cada vez, levar o cartão à borda
   esquerda ou direita do ecrã e mantê-lo lá passa o quadro à coluna do
   lado, uma de cada vez (kbArrBorda); larga-se na coluna à vista. Largar
   move logo (otimista) e assenta o cartão do sítio onde se largou até ao
   novo; se o servidor recusar, volta. Esc e o pointercancel desfazem. Numa
   coluna fora da ordem do quadro (kbOrdemManual), o arrasto não reordena:
   o lugar fica onde o cartão vai aparecer. O «Mover para…» continua a ser
   o caminho do teclado e do leitor de ecrã. */

// a borda do telemóvel: a largura da zona, o instante até passar, e a espera até à seguinte
var KB_BORDA_ZONA = 40, KB_BORDA_ESPERA = 450, KB_BORDA_DE_NOVO = 1100;

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
    ativo: false, cancelado: false, lugar: null, chaveAlvo: '', colAlvo: null, raf: 0, vx: 0, vy: 0, lista: null,
    tel: false, colIdx: 0, colIdx0: 0, bordaLado: 0, bordaTempo: 0, borda: null, antesOrigem: null, ordenado: {} };
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
  a.lista = a.no.parentNode;
  a.antesOrigem = kbCartaoSeguinte(a.no);
  a.chaveAlvo = (a.lista.getAttribute('data-coluna') || '') + '|' + (a.antesOrigem ? a.antesOrigem.getAttribute('data-chave') : '');
  a.no.classList.remove('kb-desliza', 'kb-assenta');
  a.tel = kbTelemovel();
  if (a.tel) {
    var cols = kbArrColunas();
    a.colIdx = a.colIdx0 = Math.max(0, cols.indexOf(a.colOrigem));
  }
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
/* Leva o cartão com o ponteiro e mostra onde vai cair: quando o sítio muda,
   o lugar tracejado passa para lá e os cartões à volta deslizam.
   Devolve: nada. */
function kbArrPintar() {
  var a = kbArr;
  if (!a || !a.ativo) return;
  a.no.style.transform = 'translate(' + Math.round(a.x - a.x0) + 'px,' + Math.round(a.y - a.y0) + 'px)';
  var alvo = kbArrAlvo(a.x, a.y);
  if (!alvo) return;
  var chave = alvo.lista.getAttribute('data-coluna') + '|' + (alvo.antes ? alvo.antes.getAttribute('data-chave') : '');
  if (chave === a.chaveAlvo) return;
  a.chaveAlvo = chave;
  var lugar = a.lugar, de = a.lista;
  lugar.classList.remove('kb-lugar-abre');
  var mexeu = kbDeslizar([de, alvo.lista], function () {
    if (alvo.antes) alvo.lista.insertBefore(lugar, alvo.antes); else alvo.lista.appendChild(lugar);
  });
  // noutra coluna, o lugar aparece (os cartões de lá abrem-lhe espaço a deslizar)
  if (mexeu && de !== alvo.lista) lugar.classList.add('kb-lugar-abre');
  a.lista = alvo.lista;
  var col = alvo.lista.closest('.kb-col');
  if (a.colAlvo !== col) {
    if (a.colAlvo) a.colAlvo.classList.remove('kb-alvo');
    a.colAlvo = col;
    if (col && col !== a.colOrigem) col.classList.add('kb-alvo');
  }
}
/* Os cartões das listas dadas mudam de sítio sem saltar (FLIP): mede onde
   estão (a meio de um deslize, onde se veem), faz a mudança, mede onde
   ficam, põe cada um de volta onde estava com um transform e deixa-o
   deslizar até ao sítio novo. Um deslize a meio parte de onde está. Com
   menos movimento, só muda. O cartão no ar fica de fora.
   Recebe: listas — as .kb-col-lista que a mudança mexe (repetidas e nulas
   não contam); mudar — a função que muda o DOM.
   Devolve: true quando houve cartões a deslizar. */
function kbDeslizar(listas, mudar) {
  var nos = [], vistas = [];
  (listas || []).forEach(function (l) {
    if (!l || vistas.indexOf(l) > -1) return;
    vistas.push(l);
    var cs = l.querySelectorAll('.kb-cartao');
    for (var i = 0; i < cs.length; i++) if (!cs[i].classList.contains('kb-no-ar')) nos.push(cs[i]);
  });
  if (!nos.length || kbReduzido()) {
    nos.forEach(function (n) { n.classList.remove('kb-desliza'); n.style.transform = ''; });
    mudar();
    return false;
  }
  var r0 = nos.map(function (n) { return n.getBoundingClientRect(); });
  mudar();
  nos.forEach(function (n) { n.classList.remove('kb-desliza'); n.style.transform = ''; });
  var vao = [];
  nos.forEach(function (n, i) {
    var t = kbTransformInverso(r0[i], n.getBoundingClientRect());
    if (t) { n.style.transform = t; vao.push(n); }
  });
  if (!vao.length) return false;
  // o browser assenta o transform inverso antes de a transição começar
  vao[0].getBoundingClientRect();
  vao.forEach(function (n) {
    n.classList.add('kb-desliza');
    n.style.transform = '';
    clearTimeout(n.kbDeslizaFim);
    n.kbDeslizaFim = setTimeout(function () { if (!n.style.transform) n.classList.remove('kb-desliza'); }, 400);
  });
  return true;
}
/* O transform que põe um cartão de volta onde estava (o I do FLIP).
   Recebe: r0 — o retângulo de antes (onde se via); r1 — o de agora.
   Devolve: 'translate(dx,dy)', ou '' quando não mudou (menos de meio píxel). */
function kbTransformInverso(r0, r1) {
  if (!r0 || !r1) return '';
  var dx = Math.round((r0.left - r1.left) * 10) / 10, dy = Math.round((r0.top - r1.top) * 10) / 10;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return '';
  return 'translate(' + dx + 'px,' + dy + 'px)';
}
/* A translação de um transform calculado ('matrix(a,b,c,d,x,y)' ou 'none').
   Recebe: t — o texto do getComputedStyle(…).transform.
   Devolve: {x, y} (0 sem translação). */
function kbTranslacao(t) {
  var m = /matrix\(([^)]*)\)/.exec(String(t || ''));
  if (!m) return { x: 0, y: 0 };
  var p = m[1].split(',');
  return { x: parseFloat(p[4]) || 0, y: parseFloat(p[5]) || 0 };
}
/* O topo e a altura de um cartão no sítio onde vai ficar: a meio de um
   deslize, o que se vê ainda não é o sítio dele, e é pelo sítio que se
   decide onde cai o cartão no ar (senão o lugar dançava).
   Recebe: no — o cartão.
   Devolve: {top, height}. */
function kbArrSitio(no) {
  var r = no.getBoundingClientRect(), dy = 0;
  if (no.classList.contains('kb-desliza') && typeof getComputedStyle === 'function') dy = kbTranslacao(getComputedStyle(no).transform).y;
  return { top: r.top - dy, height: r.height };
}
// O cartão (à vista) que vem a seguir a um nó, na mesma lista.
// Recebe: no — o nó.
// Devolve: o cartão, ou null no fim.
function kbCartaoSeguinte(no) {
  for (var n = no && no.nextElementSibling; n; n = n.nextElementSibling) {
    if (n.classList && n.classList.contains('kb-cartao')) return n;
  }
  return null;
}
// As colunas do quadro, por ordem.
// Devolve: a lista das .kb-col ([] sem quadro).
function kbArrColunas() {
  var q = el('kbQuadro');
  return q ? [].slice.call(q.querySelectorAll('.kb-col')) : [];
}
/* Onde vai cair o cartão com o ponteiro em (x, y): a coluna debaixo dele (no
   computador, a mais perto dentro do que o quadro mostra; no telemóvel, a
   que está à vista) e, nela, antes de que cartão — pelo meio de cada um, no
   sítio onde fica. Numa coluna fora da ordem do quadro, não se escolhe: na
   de origem o lugar fica onde estava, noutra fica onde o cartão vai aparecer.
   Recebe: x, y — o ponteiro (clientX, clientY).
   Devolve: {lista, antes} — antes é o cartão que fica a seguir (null no fim) —, ou null. */
function kbArrAlvo(x, y) {
  var a = kbArr, q = el('kbQuadro');
  if (!q) return null;
  var col = null;
  if (a.tel) col = kbArrColunas()[a.colIdx] || a.colOrigem;
  else {
    var rq = q.getBoundingClientRect(), xx = Math.max(rq.left + 1, Math.min(rq.right - 1, x)), dist = Infinity;
    kbArrColunas().forEach(function (c) {
      var r = c.getBoundingClientRect();
      if (r.right < rq.left || r.left > rq.right) return;
      var d = xx < r.left ? r.left - xx : xx > r.right ? xx - r.right : 0;
      if (d < dist) { dist = d; col = c; }
    });
  }
  var lista = col && col.querySelector('.kb-col-lista');
  if (!lista) return null;
  var id = lista.getAttribute('data-coluna');
  if (!kbOrdemManual(id)) {
    if (col === a.colOrigem) return { lista: lista, antes: a.antesOrigem };
    if (!(id in a.ordenado)) a.ordenado[id] = kbArrAntesOrdenado(lista, id);
    return { lista: lista, antes: a.ordenado[id] };
  }
  var antes = null, cs = lista.querySelectorAll('.kb-cartao');
  for (var i = 0; i < cs.length; i++) {
    if (cs[i] === a.no) continue;
    var s = kbArrSitio(cs[i]);
    if (y < s.top + s.height / 2) { antes = cs[i]; break; }
  }
  return { lista: lista, antes: antes };
}
/* Numa coluna com outra ordem: o cartão que vai ficar a seguir ao que se
   arrasta quando ele lá chegar (a ordem da coluna diz onde aparece).
   Recebe: lista — a .kb-col-lista; id — o id da coluna.
   Devolve: o cartão (nó), ou null no fim. */
function kbArrAntesOrdenado(lista, id) {
  var a = kbArr;
  if (!kbEstado || !a) return null;
  var guardados = kbEstado.cartoes, vis;
  kbEstado.cartoes = kbMoverLocal(guardados, a.chave, id, Infinity);
  try { vis = kbVisiveis(id).map(function (c) { return c.chave; }); } finally { kbEstado.cartoes = guardados; }
  var i = vis.indexOf(a.chave), seg = i > -1 ? vis[i + 1] : '';
  if (!seg) return null;
  var cs = lista.querySelectorAll('.kb-cartao');
  for (var j = 0; j < cs.length; j++) if (cs[j].getAttribute('data-chave') === seg) return cs[j];
  return null;
}
/* A velocidade da auto-rolagem num eixo: perto de uma borda, mais depressa
   quanto mais perto, mas só depois de o ponteiro ter andado para esse lado
   desde que pousou (a pega pode começar já dentro da zona).
   Recebe: p — o ponteiro; p0 — onde pousou; lo, hi — as bordas; zona — px.
   Devolve: px por passo (negativo para trás, 0 parado). */
function kbArrVelocidade(p, p0, lo, hi, zona) {
  if (p < lo + zona && p < p0) return -Math.ceil(16 * Math.min(1, (lo + zona - p) / zona));
  if (p > hi - zona && p > p0) return Math.ceil(16 * Math.min(1, (p - (hi - zona)) / zona));
  return 0;
}
/* Perto das bordas, a coluna rola na vertical e o quadro rola de lado (no
   computador); no telemóvel, a borda do ecrã passa à coluna do lado.
   Devolve: nada — arranca ou pára o passo da auto-rolagem. */
function kbArrRolagem() {
  var a = kbArr, q = el('kbQuadro');
  if (!a || !a.ativo || !q) return;
  var rq = q.getBoundingClientRect();
  a.vx = a.tel ? 0 : kbArrVelocidade(a.x, a.x0, rq.left, rq.right, 56);
  var l = a.lista;
  if (l) { var rl = l.getBoundingClientRect(); a.vy = kbArrVelocidade(a.y, a.y0, Math.max(rl.top, 0), Math.min(rl.bottom, window.innerHeight), 56); } else a.vy = 0;
  if (a.tel) kbArrBorda();
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
  kbArrPintar();
  kbArrRolagem();
}

/* -------------------- o telemóvel: a borda passa de coluna ------------------- */

/* De que lado do ecrã está o dedo, para passar de coluna: só conta a borda
   para onde o dedo andou desde que pousou (a pega fica perto da direita).
   Recebe: x — o ponteiro; x0 — onde pousou; largura — a do ecrã; zona — px.
   Devolve: -1 (esquerda), 1 (direita) ou 0. */
function kbBordaLado(x, x0, largura, zona) {
  if (x < zona && x < x0) return -1;
  if (x > largura - zona && x > x0) return 1;
  return 0;
}
/* A coluna para onde a borda leva, se houver uma desse lado.
   Recebe: i — a coluna à vista; lado — -1, 0 ou 1; n — quantas colunas.
   Devolve: o índice dela, ou -1 (sem lado, ou sem coluna desse lado). */
function kbBordaDestino(i, lado, n) {
  var j = i + lado;
  return lado && j >= 0 && j < n ? j : -1;
}
/* O dedo chegou a uma borda do ecrã, ou saiu dela: acende o aviso e conta o
   instante até passar; fora dela, apaga e deixa de contar.
   Devolve: nada. */
function kbArrBorda() {
  var a = kbArr;
  if (!a || !a.ativo || !a.tel) return;
  var lado = kbBordaLado(a.x, a.x0, window.innerWidth, KB_BORDA_ZONA);
  if (kbBordaDestino(a.colIdx, lado, kbArrColunas().length) < 0) lado = 0;
  if (lado === a.bordaLado) return;
  clearTimeout(a.bordaTempo); a.bordaTempo = 0;
  a.bordaLado = lado;
  kbBordaMostrar(a, lado, KB_BORDA_ESPERA);
  if (lado) a.bordaTempo = setTimeout(kbArrPassarColuna, KB_BORDA_ESPERA);
}
/* Passou o instante na borda: o quadro desliza para a coluna do lado (o
   segmentado acompanha) e o lugar vai para ela. Ainda na borda, a seguinte
   só passado mais um bocado — uma coluna de cada vez.
   Devolve: nada. */
function kbArrPassarColuna() {
  var a = kbArr;
  if (!a || !a.ativo || !a.bordaLado) return;
  a.bordaTempo = 0;
  var n = kbArrColunas().length, j = kbBordaDestino(a.colIdx, a.bordaLado, n);
  if (j < 0) { a.bordaLado = 0; kbBordaMostrar(a, 0, 0); return; }
  a.colIdx = j;
  kbVerColuna(j);
  kbArrPintar();
  if (kbBordaDestino(j, a.bordaLado, n) < 0) { a.bordaLado = 0; kbBordaMostrar(a, 0, 0); return; }
  kbBordaMostrar(a, a.bordaLado, KB_BORDA_DE_NOVO);
  a.bordaTempo = setTimeout(kbArrPassarColuna, KB_BORDA_DE_NOVO);
}
/* O aviso da borda: uma faixa na borda do ecrã, à altura do quadro, com o
   contorno e a seta na cor da ação (o Samsung escurece os fundos à força) e
   um enchimento que diz quanto falta para passar. Sai pelo lado por onde
   entrou.
   Recebe: a — o estado do arrasto; lado — -1, 1, ou 0 para apagar; espera — ms até passar.
   Devolve: nada. */
function kbBordaMostrar(a, lado, espera) {
  var b = a.borda;
  if (!lado) { if (b) b.classList.remove('kb-on', 'kb-a-passar'); return; }
  if (!b) {
    b = a.borda = document.createElement('div');
    b.className = 'kb-borda';
    b.setAttribute('aria-hidden', 'true');
    document.body.appendChild(b);
  }
  var q = el('kbQuadro'), r = q ? q.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  var topo = Math.max(0, r.top), fundo = Math.min(window.innerHeight, r.bottom);
  var era = b.getAttribute('data-lado'), novo = lado < 0 ? 'esq' : 'dir';
  if (era !== novo) {
    b.innerHTML = ic(lado < 0 ? 'voltar' : 'seta') + '<span class="kb-borda-enche"></span>';
    b.setAttribute('data-lado', novo);
    b.classList.remove('kb-on');
  }
  b.style.top = Math.round(topo) + 'px';
  b.style.height = Math.max(0, Math.round(fundo - topo)) + 'px';
  b.style.setProperty('--kb-espera', Math.max(0, espera || 0) + 'ms');
  // o enchimento recomeça do zero
  b.classList.remove('kb-a-passar');
  b.getBoundingClientRect();
  b.classList.add('kb-on', 'kb-a-passar');
}
/* Tira os ouvintes, o lugar tracejado e a marca da coluna, e devolve o
   cartão ao fluxo (no sítio de onde saiu).
   Recebe: a — o estado do arrasto.
   Devolve: nada. */
function kbArrDesfazer(a) {
  if (a.raf) { cancelAnimationFrame(a.raf); a.raf = 0; }
  clearTimeout(a.bordaTempo); a.bordaTempo = 0; a.bordaLado = 0;
  if (a.borda) {
    var b = a.borda;
    a.borda = null;
    b.classList.remove('kb-on', 'kb-a-passar');
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 200);
  }
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
  var agora = kbDaColuna(c.coluna_id).map(function (x) { return x.chave; }).indexOf(a.chave);
  // numa coluna com outra ordem, a posição não é do arrasto: na mesma fica, noutra vai para o fim da ordem do quadro
  var manual = kbOrdemManual(coluna);
  var indice = manual ? kbIndiceEntre(ordem, depois, antes) : coluna === c.coluna_id ? agora : ordem.length;
  if (coluna === c.coluna_id && indice === agora) { kbPintarDepoisDoArrasto(); kbAssentarChave(a.chave, rect); kbArrVoltarColuna(a, a.colIdx0); return; }
  kbPintarDepois = false;
  kbMover(a.chave, coluna, indice, rect);
  kbArrVoltarColuna(a, a.colIdx);
}
/* No telemóvel, depois de largar ou desfazer: o quadro acaba na coluna
   certa (a repintura a meio de um deslize podia deixá-lo a meio caminho).
   Recebe: a — o estado do arrasto (já desfeito); i — a coluna onde acabar.
   Devolve: nada. */
function kbArrVoltarColuna(a, i) {
  if (!a.tel || a.colIdx === a.colIdx0) return;
  kbVerColuna(i);
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
/* O browser tomou o gesto (pointercancel), ou o Esc: o cartão volta ao
   sítio, a assentar, e os cartões à volta deslizam de volta (no telemóvel,
   o quadro volta à coluna de onde ele saiu).
   Devolve: nada. */
function kbArrCancelar() {
  var a = kbArr;
  if (!a) return;
  var rect = a.ativo ? a.no.getBoundingClientRect() : null, chave = a.chave;
  if (a.ativo && !kbPintarDepois) {
    kbDeslizar([a.lista, a.colOrigem && a.colOrigem.querySelector('.kb-col-lista')], function () { kbArrDesfazer(a); });
  } else kbArrDesfazer(a);
  kbPintarDepoisDoArrasto();
  if (rect) kbAssentarChave(chave, rect);
  kbArrVoltarColuna(a, a.colIdx0);
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
/* os vizinhos dão lugar a deslizar (FLIP): só o transform, interrompível */
.kb-cartao.kb-desliza{transition:transform var(--medio) var(--curva),border-color var(--rapido) var(--curva),box-shadow var(--rapido) var(--curva)}
/* o lugar que aparece noutra coluna abre-se: só a opacidade */
.kb-lugar.kb-lugar-abre{animation:kbLugarAbre var(--rapido) var(--curva-entra) both}
@keyframes kbLugarAbre{from{opacity:0}}

/* ---- o telemóvel: a borda que passa à coluna do lado ---- */
/* uma faixa na borda do ecrã, à altura do quadro e por cima do cartão no ar
   (o dedo leva-o para lá e ele tapava a seta): o contorno e a seta na cor
   da ação (o Samsung escurece os fundos à força), e o enchimento conta o
   instante até passar (linear: é um tempo, não um movimento) */
.kb-borda{position:fixed;z-index:71;width:40px;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;
  color:var(--accent);background:var(--accent-soft);border:2px solid var(--accent);opacity:0;
  transition:opacity var(--rapido) var(--curva),transform var(--rapido) var(--curva)}
.kb-borda[data-lado="esq"]{left:0;border-left-width:0;border-radius:0 14px 14px 0;transform:translateX(-12px)}
.kb-borda[data-lado="dir"]{right:0;border-right-width:0;border-radius:14px 0 0 14px;transform:translateX(12px)}
.kb-borda.kb-on{opacity:1;transform:none}
.kb-borda .i{position:relative;z-index:1;width:24px;height:24px;stroke-width:2.8}
.kb-borda-enche{position:absolute;inset:0;background:color-mix(in srgb,var(--accent) 24%,transparent);transform:scaleY(0);transform-origin:50% 100%}
.kb-borda.kb-a-passar .kb-borda-enche{transform:none;transition:transform var(--kb-espera) linear}

/* com rato: a meio do arrasto, os cartões por baixo não acendem */
@media(hover:hover) and (pointer:fine){
  .kb-a-arrastar .kb-cartao:hover{border-color:var(--line)}
}

/* menos movimento: o cartão assenta de uma vez, os vizinhos mudam de uma vez,
   o lugar aparece logo, e o aviso da borda só aparece e apaga (sem deslizar
   nem encher) */
@media(prefers-reduced-motion:reduce){
  .kb-cartao.kb-assenta,.kb-cartao.kb-desliza{transition:none}
  .kb-lugar.kb-lugar-abre{animation:none}
  .kb-borda,.kb-borda[data-lado]{transform:none;transition:opacity var(--rapido) var(--curva)}
  .kb-borda .kb-borda-enche{display:none}
}
`;
