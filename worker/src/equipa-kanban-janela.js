/* O kanban da equipa: a janela (dialog#dialogo) onde se confirma, escolhe e
   edita, e a das colunas do quadro (equipa-kanban.js junta-o ao resto).
   ---------------------------------------------------------------------
   Um pedaço do mesmo guião: as mesmas regras do topo do equipa-kanban.js
   (String.raw sem crases nem cifrão com chaveta; nada de on…= nem style= no
   HTML; nada de alert, prompt, confirm nem do seletor nativo; nomes de topo
   kb…, só function e var). Corre como parte de um único script clássico. */

export const GUIAO_KB_JANELA = String.raw`/* -------------------------------- a janela ------------------------------- */

/* Uma janela do kanban no dialog#dialogo (o mesmo do guião, com as mesmas
   regras), com a moldura da folha da app: o cabeçalho com o título, o corpo
   que rola (só ele, e só quando o que tem não cabe) e o pé fixo com os
   botões. Com aoConfirmar, Cancelar e o botão da ação — que espera enquanto
   o servidor responde e, se ele recusar, deixa a janela aberta com o
   porquê; sem aoConfirmar é uma lista de escolhas, com Fechar (ou Voltar).
   Abaixo dos 520px, o corte da app, é a folha de baixo com a barra, que se
   fecha a arrastar (kbFolhaPousar); acima, fica centrada. O dialog leva a
   classe kb-dlg enquanto é do kanban (o CSS daqui; o dialog.janela do back
   office não muda), e ao fechar esvazia-se, larga-a e devolve o foco a quem
   a abriu. Aberta a meio da saída de outra, a saída pára e o conteúdo troca
   no sítio (é o caminho do ⋯ para o Editar ou o Mover para).
   Recebe: titulo — o título (texto); corpo — o HTML (seguro); opcoes
   (opcional) — {aoConfirmar: função que lê os campos e devolve false (fica,
   com os erros marcados) ou uma promessa; botao; perigo; texto (HTML
   seguro); foco: o seletor do que recebe o foco; voltar: [ação, args…] do
   botão do pé, que passa a dizer «Voltar» em vez de «Fechar»; extra:
   {texto, acao, icone} — um segundo botão no pé de uma lista, a ação dela}.
   Devolve: nada — abre a janela. */
function kbJanela(titulo, corpo, opcoes) {
  var o = opcoes || {}, d = el('dialogo');
  if (!d) return;
  if (typeof formAberto !== 'undefined') formAberto = null;
  var antes = kbJanelaAberta;
  var origem = antes && d.open ? antes.origem : (typeof document !== 'undefined' && document.activeElement) || null;
  if (kbColmArr) kbColmDesfazer();
  kbFolhaLargar();
  // fechada há instantes, o close (que chega depois, numa tarefa) ainda não limpou: limpa-se aqui
  if (!d.open) kbJanelaLimpar(d);
  kbJanelaAberta = { aoConfirmar: o.aoConfirmar || null, botao: o.botao || 'Guardar', ocupado: false, saindo: false, vista: '', origem: origem };
  if (antes && antes.saindo && d.open) {
    // a saída da anterior pára onde está: a janela fica, com o conteúdo novo
    clearTimeout(kbJanelaSaida);
    d.classList.remove('kb-sai');
    d.classList.remove('kb-arrastada');
    d.classList.add('kb-trocou');
  }
  d.innerHTML = kbJanelaHtml(titulo, corpo, o);
  d.returnValue = '';
  d.onclose = function () {
    if (d.open) return;
    kbJanelaFechou(d);
  };
  // o Esc fecha pela saída animada; se o browser não deixar esperar, fecha já (e o onclose limpa)
  d.oncancel = function (e) {
    var j = kbJanelaAberta;
    if (!j || j.saindo || !e || e.cancelable === false) return;
    e.preventDefault();
    kbJanelaSai();
  };
  d.classList.add('kb-dlg');
  if (!d.open) d.showModal();
  if (typeof d.addEventListener === 'function') d.addEventListener('touchmove', kbFolhaToque, { passive: false });
  var f = (o.foco && d.querySelector(o.foco)) || d.querySelector('input:not([type=radio]),textarea,input:checked') || d.querySelector('.kb-opcao');
  if (f && f.focus) f.focus();
}
/* O HTML da janela: o cabeçalho (com a barra da folha, no CSS), o corpo que
   rola e o pé fixo com o erro geral e os botões.
   Recebe: titulo; corpo; o — as opcoes do kbJanela.
   Devolve: string HTML (o .kb-janela). */
function kbJanelaHtml(titulo, corpo, o) {
  var botoes;
  if (o.aoConfirmar) {
    botoes = '<button type="button" class="btn"' + comAcao('kbFecharJanela') + '>Cancelar</button>' +
      '<button type="button" id="kbJanelaOk" class="btn ' + (o.perigo ? 'danger' : 'primary') + '"' + comAcao('kbConfirmar') + '>' + esc(o.botao || 'Guardar') + '</button>';
  } else {
    botoes = (o.voltar && o.voltar.length
      ? '<button type="button" class="btn"' + comAcao(o.voltar[0], o.voltar.slice(1)) + '>Voltar</button>'
      : '<button type="button" class="btn"' + comAcao('kbFecharJanela') + '>Fechar</button>') +
      (o.extra ? '<button type="button" class="btn primary"' + comAcao(o.extra.acao) + '>' + (o.extra.icone ? ic(o.extra.icone, 'i-sm') : '') + esc(o.extra.texto) + '</button>' : '');
  }
  return '<div class="janela-corpo kb-janela"><div class="kb-j-cab"><h2 id="janelaTit">' + esc(titulo) + '</h2></div>' +
    '<div class="kb-j-corpo">' + (o.texto ? '<p class="janela-txt">' + o.texto + '</p>' : '') + corpo + '</div>' +
    '<div class="kb-j-pe"><p class="erro-txt" id="kbJanelaErro" role="alert"></p><div class="kb-j-botoes">' + botoes + '</div></div></div>';
}
/* A janela fechou (por qualquer caminho: o botão, o Esc, o arrastar, ou o
   close de fora): esvazia-a, larga as classes e os gestos do kanban, e
   devolve o foco a quem a abriu, se ele ainda existe e o foco ficou perdido.
   Recebe: d — o dialog#dialogo.
   Devolve: nada. */
function kbJanelaFechou(d) {
  var j = kbJanelaAberta;
  kbJanelaAberta = null;
  d.innerHTML = '';
  d.onclose = null;
  d.oncancel = null;
  kbJanelaLimpar(d);
  var o = j && j.origem, a = typeof document !== 'undefined' ? document.activeElement : null;
  if (o && o.isConnected && typeof o.focus === 'function' && (!a || a === document.body)) {
    try { o.focus({ preventScroll: true }); } catch (x) { /* fica onde está */ }
  }
}
/* Larga do dialog o que é do kanban: as classes (a do kanban e as do
   movimento), o transform e o véu do arrasto, o ouvinte do toque, os
   temporizadores e os arrastos a meio.
   Recebe: d — o dialog#dialogo.
   Devolve: nada. */
function kbJanelaLimpar(d) {
  clearTimeout(kbJanelaSaida);
  clearTimeout(kbFolhaVoltaT);
  if (kbColmArr) kbColmDesfazer();
  kbFolhaLargar();
  ['kb-dlg', 'kb-sai', 'kb-trocou', 'kb-arrastou', 'kb-arrastar', 'kb-arrastada', 'kb-volta', 'kb-pronto'].forEach(function (c) { d.classList.remove(c); });
  if (d.style) { d.style.transform = ''; d.style.removeProperty('--kb-veu'); }
  if (typeof d.removeEventListener === 'function') d.removeEventListener('touchmove', kbFolhaToque, { passive: false });
}
/* A duração de um token de movimento do back office (--rapido, --medio), em ms.
   Recebe: nome — o token; padrao — os ms se não der para o ler.
   Devolve: número (ms). */
function kbTokenMs(nome, padrao) {
  try {
    var v = String(getComputedStyle(document.documentElement).getPropertyValue(nome) || '').trim(), n = parseFloat(v);
    if (!isNaN(n)) return /ms$/.test(v) ? n : n * 1000;
  } catch (e) { /* fica o padrão */ }
  return padrao;
}
/* A janela do kanban está aberta e não está a sair?
   Devolve: true/false. */
function kbJanelaViva() {
  var d = el('dialogo');
  return !!(d && d.open && kbJanelaAberta && !kbJanelaAberta.saindo);
}
/* Fecha a janela do kanban pela saída: desce (folha) ou desvanece
   (centrada) em --medio, e só então fecha o dialog — que até lá não recebe
   toques. Largada pelo dedo, a saída parte de onde ele a deixou e continua
   na --curva (kb-arrastada). Sem a janela do kanban, fecha já.
   Recebe: arrastada (opcional) — true quando quem a fecha é o arrastar.
   Devolve: nada. */
function kbJanelaSai(arrastada) {
  var d = el('dialogo'), j = kbJanelaAberta;
  if (!d || !d.open) return;
  if (!j || !d.classList.contains('kb-dlg')) { d.close(); return; }
  if (j.saindo) return;
  if (kbColmArr) kbColmDesfazer();
  kbFolhaLargar();
  j.saindo = true;
  ['kb-trocou', 'kb-volta', 'kb-pronto', 'kb-arrastar'].forEach(function (c) { d.classList.remove(c); });
  if (arrastada) d.classList.add('kb-arrastada');
  d.classList.add('kb-sai');
  clearTimeout(kbJanelaSaida);
  kbJanelaSaida = setTimeout(function () { if (kbJanelaAberta === j && d.open) d.close(); }, kbTokenMs('--medio', 200) + 20);
}
/* Confirma a janela aberta: o aoConfirmar lê e confere os campos (false
   deixa-a aberta com os erros); com uma promessa, o botão espera e fecha no
   fim (a não ser que o aoConfirmar tenha aberto outra janela no lugar
   dela), ou mostra o erro do servidor ao lado do campo de que fala.
   Devolve: nada. */
function kbConfirmar() {
  var j = kbJanelaAberta;
  if (!j || j.ocupado || j.saindo || !j.aoConfirmar) return;
  var e0 = el('kbJanelaErro');
  if (e0) e0.textContent = '';
  var r = j.aoConfirmar();
  if (r === false) return;
  j.ocupado = true;
  kbJanelaOcupada(true);
  Promise.resolve(r).then(function () {
    if (kbJanelaAberta === j) kbJanelaSai();
  }, function (e) {
    if (kbJanelaAberta !== j) return;
    j.ocupado = false;
    kbJanelaOcupada(false);
    var msg = (e && e.message) || 'Não deu.', campo = e && e.campo;
    if (campo && el(campo + 'Erro')) marcarErro(campo, msg);
    else if (el('kbJanelaErro')) el('kbJanelaErro').textContent = msg;
  });
}
// O botão da janela enquanto o servidor responde: parado e a dizer que espera.
// Recebe: sim — true enquanto espera.
// Devolve: nada.
function kbJanelaOcupada(sim) {
  var b = el('kbJanelaOk');
  if (!b || !kbJanelaAberta) return;
  b.disabled = sim;
  b.textContent = sim ? 'À espera do servidor…' : kbJanelaAberta.botao;
}
/* Fecha a janela pela saída (kbJanelaSai): o Fechar e o Cancelar dela, e
   uma ação dentro dela que leve a outro sítio. Quem abre outra janela logo a
   seguir não a vê sair: a nova toma o lugar dela (kbJanela).
   Devolve: nada. */
function kbFecharJanela() {
  kbJanelaSai();
}

/* ------------------------ a folha de baixo (telemóvel) ------------------------ */

// o que nunca agarra a folha: os campos e quem tem um gesto seu (data-gesto, o contrato das folhas)
var KB_FOLHA_NAO_ARRANCA = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-gesto]';
// a resistência para cima (px: a folha nunca sobe mais de metade), o sacudir (px/ms) e o teto do limiar de fechar (px)
var KB_FOLHA_RESISTE = 48, KB_FOLHA_SACODIR = 0.4, KB_FOLHA_LIMIAR = 160;
// o arrasto da folha em curso (kbFolhaPousar), até quando se engole o clique que vem a seguir, e o fim do regresso ao sítio
var kbFolha = null, kbFolhaEngole = 0, kbFolhaVoltaT = 0;
// o temporizador da saída da janela (kbJanelaSai)
var kbJanelaSaida = 0;

/* A janela mostra a barra? A condição do CSS (o @media(max-width:520px) da folha).
   Devolve: true/false. */
function kbFolhaComBarra() {
  try { return typeof matchMedia === 'function' && matchMedia('(max-width:520px)').matches; } catch (e) { return false; }
}
/* Por onde o dedo pegou na folha: pelo cabeçalho (com a barra), ou pelo
   corpo com ele (e o que estiver entre o dedo e ele) no topo do scroll. Um
   campo, quem tem data-gesto, o pé, o que rola de lado e o corpo já rolado
   não pegam.
   Recebe: alvo — o elemento onde o dedo pousou; d — o dialog da folha.
   Devolve: 'cab', 'corpo' ou '' (não pega). */
function kbFolhaZona(alvo, d) {
  if (!alvo || !d || typeof alvo.closest !== 'function' || typeof d.querySelector !== 'function') return '';
  if (alvo.closest(KB_FOLHA_NAO_ARRANCA)) return '';
  var cab = d.querySelector('.kb-j-cab'), corpo = d.querySelector('.kb-j-corpo');
  if (cab && (alvo === cab || cab.contains(alvo))) return 'cab';
  if (!corpo || !(alvo === corpo || corpo.contains(alvo))) return '';
  for (var x = alvo; x && x !== d; x = x.parentElement) {
    if (x.scrollTop > 0) return '';
    if (x.scrollWidth > x.clientWidth + 1 && kbRolaDeLado(x)) return '';
    if (x === corpo) break;
  }
  return 'corpo';
}
/* Este elemento rola de lado (overflow-x auto ou scroll)?
   Recebe: x — o elemento.
   Devolve: true/false. */
function kbRolaDeLado(x) {
  try { return /auto|scroll/.test(getComputedStyle(x).overflowX); } catch (e) { return false; }
}
/* Para cima, a folha resiste: anda cada vez menos quanto mais se puxa, e
   nunca sobe mais de metade de KB_FOLHA_RESISTE (a curva da app,
   componentes.js:avisoElastico). Encostada em baixo, não descola do fundo.
   Recebe: dy — px que o dedo andou (negativo, para cima).
   Devolve: px a que a folha fica (com o sinal de dy). */
function kbFolhaElastico(dy) {
  var a = Math.abs(dy), l = KB_FOLHA_RESISTE;
  return (dy < 0 ? -1 : dy > 0 ? 1 : 0) * (1 - 1 / (a * 0.55 / l + 1)) * l * 0.5;
}
/* O véu por trás da folha aclara à medida que ela desce: inteiro no sítio,
   nada com a folha uma altura dela abaixo.
   Recebe: desl — px que a folha desceu; h — a altura dela.
   Devolve: a opacidade do véu, de 0 a 1. */
function kbFolhaVeu(desl, h) {
  return Math.max(0, Math.min(1, 1 - (desl > 0 ? desl : 0) / (h || 1)));
}
/* Largar agora fecha a folha? Passado o limiar — metade da altura dela, mas
   nunca mais de KB_FOLHA_LIMIAR, que uma folha alta não pede meio ecrã de
   dedo —, ou com um sacudir para baixo (uma velocidade de há mais de 100ms
   já não conta: o dedo parou antes de sair).
   Recebe: f — o arrasto ({dy, h, vy, ta}); agora — a hora do evento (kbHora).
   Devolve: true/false. */
function kbFolhaFechaAoLargar(f, agora) {
  var vy = agora - f.ta > 100 ? 0 : f.vy;
  return f.dy > Math.min((f.h || 1) / 2, KB_FOLHA_LIMIAR) || (f.dy > 0 && vy > KB_FOLHA_SACODIR);
}
/* A hora de um evento do dedo, no relógio dele (o timeStamp), para a velocidade.
   Recebe: e — o PointerEvent.
   Devolve: ms. */
function kbHora(e) {
  if (e && e.timeStamp) return e.timeStamp;
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}
/* Onde a folha está agora, na vertical, contando com a animação ou a
   transição que a estiver a levar (a entrada, o regresso ao sítio).
   Recebe: d — o dialog.
   Devolve: px (0 no sítio). */
function kbFolhaDeslocada(d) {
  try {
    var m = /matrix\(([^)]*)\)/.exec(getComputedStyle(d).transform || '');
    return m ? (parseFloat(m[1].split(',')[5]) || 0) : 0;
  } catch (e) { return 0; }
}
/* O dedo pousou: se foi na janela do kanban, com a barra, por onde ela se
   agarra (kbFolhaZona), fica-se à escuta do arrasto. Pegar na folha a meio
   do regresso apanha-a onde ela está, sem salto. Só o dedo e a caneta: o
   rato numa janela estreita não arrasta folhas.
   Recebe: e — o PointerEvent do pointerdown (ouvido no documento).
   Devolve: nada — liga os ouvintes do documento. */
function kbFolhaPousar(e) {
  if (kbFolha || !e || e.button > 0 || e.isPrimary === false || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
  var d = el('dialogo'), j = kbJanelaAberta;
  if (!d || !d.open || !j || j.saindo || !d.classList.contains('kb-dlg') || !kbFolhaComBarra()) return;
  if (!e.target || !d.contains(e.target)) return;
  var zona = kbFolhaZona(e.target, d);
  if (!zona) return;
  var f = { id: e.pointerId, d: d, j: j, zona: zona, x0: e.clientX, y0: e.clientY, base: 0, dy: 0, desl: 0, vy: 0,
    ya: e.clientY, ta: kbHora(e), ativo: false, mexe: !kbReduzido(), h: 1 };
  if (d.classList.contains('kb-volta')) {
    // a meio do regresso: fica onde a transição a tinha
    clearTimeout(kbFolhaVoltaT);
    f.base = kbFolhaDeslocada(d);
    d.classList.remove('kb-volta');
    f.h = d.getBoundingClientRect().height || 1;
    f.desl = f.dy = f.base;
    if (f.base) { d.style.transform = 'translateY(' + f.base + 'px)'; d.style.setProperty('--kb-veu', String(kbFolhaVeu(f.desl, f.h))); }
  }
  kbFolha = f;
  document.addEventListener('pointermove', kbFolhaMove);
  document.addEventListener('pointerup', kbFolhaFim);
  document.addEventListener('pointercancel', kbFolhaFim);
}
/* O dedo andou: passados os 10px de decidir, na vertical, a folha segue-o (a
   folga não conta: arranca colada ao dedo); para o lado, ou a subir pelo
   corpo, o gesto não é dela (é o scroll). Sem movimento pedido, não segue:
   só diz, desvanecendo (kb-pronto), quando largar já fecha.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada — mexe no transform do dialog e no --kb-veu do véu. */
function kbFolhaMove(e) {
  var f = kbFolha;
  if (!f || e.pointerId !== f.id) return;
  if (kbJanelaAberta !== f.j || !f.d.open) return kbFolhaDesiste(f);
  var dy = e.clientY - f.y0, dx = e.clientX - f.x0;
  if (!f.ativo) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) return kbFolhaDesiste(f);
    if (Math.abs(dy) < 10) return;
    if (f.zona === 'corpo' && dy < 0) return kbFolhaDesiste(f);
    f.ativo = true;
    f.y0 += dy < 0 ? -10 : 10;
    dy = e.clientY - f.y0;
    f.h = f.d.getBoundingClientRect().height || 1;
    // apanhada a meio da entrada: parte de onde a animação a tinha
    if (!f.base && f.mexe) f.base = kbFolhaDeslocada(f.d);
    f.d.classList.add('kb-arrastou');
    f.d.classList.add('kb-arrastar');
    try { f.d.setPointerCapture(f.id); } catch (x) { /* segue pelo documento */ }
  }
  var agora = kbHora(e), dt = agora - f.ta;
  // a velocidade dos últimos instantes, alisada: é ela que diz se o gesto foi um sacudir
  if (dt > 0) f.vy = 0.6 * ((e.clientY - f.ya) / dt) + 0.4 * f.vy;
  f.ya = e.clientY; f.ta = agora;
  f.dy = f.base + dy;
  f.desl = f.dy >= 0 ? f.dy : kbFolhaElastico(f.dy);
  if (f.mexe) {
    f.d.style.transform = 'translateY(' + f.desl + 'px)';
    f.d.style.setProperty('--kb-veu', String(kbFolhaVeu(f.desl, f.h)));
  }
  f.d.classList.toggle('kb-pronto', kbFolhaFechaAoLargar(f, agora));
}
/* O browser não pode rolar o que a folha está a levar: um toque que agarrou
   pelo cabeçalho, ou pelo corpo a descer, trava o scroll — sem isto ele
   tomava o gesto e mandava um pointercancel a meio. A subir pelo corpo é o
   scroll, e não se trava, nem o de dois dedos.
   Recebe: e — o TouchEvent do touchmove (ouvido no dialog, com passive:false).
   Devolve: nada. */
function kbFolhaToque(e) {
  var f = kbFolha;
  if (!f || !e || e.cancelable === false) return;
  var t = e.touches && e.touches.length === 1 ? e.touches[0] : null;
  if (!t) return;
  if (!f.ativo && f.zona !== 'cab') {
    var dy = t.clientY - f.y0, dx = t.clientX - f.x0;
    if (dy < 0 || dy < Math.abs(dx)) return;
  }
  e.preventDefault();
}
/* Tira os ouvintes do documento e esquece o arrasto da folha (onde ela está fica).
   Devolve: nada. */
function kbFolhaLargar() {
  if (!kbFolha) return;
  kbFolha = null;
  document.removeEventListener('pointermove', kbFolhaMove);
  document.removeEventListener('pointerup', kbFolhaFim);
  document.removeEventListener('pointercancel', kbFolhaFim);
}
/* O gesto deixou de ser da folha (foi para o lado, subiu pelo corpo, ou a
   janela mudou): larga-o e, se ela tinha saído do sítio, devolve-a.
   Recebe: f — o arrasto.
   Devolve: nada. */
function kbFolhaDesiste(f) {
  kbFolhaLargar();
  if (f.d.open && kbJanelaAberta === f.j && (f.ativo || f.base)) kbFolhaVolta(f);
}
/* O dedo saiu: fecha a janela se o gesto chegou para isso
   (kbFolhaFechaAoLargar), ou devolve a folha ao sítio. Um pointercancel
   nunca fecha. Depois de um arrasto, o clique que o browser dispara
   engole-se (não carrega no que estiver por baixo do dedo).
   Recebe: e — o PointerEvent do pointerup ou do pointercancel.
   Devolve: nada. */
function kbFolhaFim(e) {
  var f = kbFolha;
  if (!f || (e && e.pointerId !== f.id)) return;
  kbFolhaLargar();
  if (kbJanelaAberta !== f.j || !f.d.open) return;
  if (!f.ativo) { if (f.base) kbFolhaVolta(f); return; }
  kbFolhaEngole = Date.now() + 350;
  if (e && e.type !== 'pointercancel' && kbFolhaFechaAoLargar(f, kbHora(e))) {
    f.d.classList.remove('kb-pronto');
    kbJanelaSai(f.mexe);
    return;
  }
  kbFolhaVolta(f);
}
/* A folha volta ao sítio de onde o dedo a deixou, numa transição (--medio,
   --curva-entra), e o véu escurece com ela. Sem movimento, ou sem
   deslocação, só assenta.
   Recebe: f — o arrasto.
   Devolve: nada. */
function kbFolhaVolta(f) {
  var d = f.d;
  d.classList.remove('kb-arrastar');
  d.classList.remove('kb-pronto');
  clearTimeout(kbFolhaVoltaT);
  if (f.mexe && f.desl) d.classList.add('kb-volta');
  d.style.transform = '';
  d.style.removeProperty('--kb-veu');
  if (!d.classList.contains('kb-volta')) return;
  kbFolhaVoltaT = setTimeout(function () { d.classList.remove('kb-volta'); }, kbTokenMs('--medio', 200) + 40);
}

/* -------------------------------- colunas -------------------------------- */

/* «Colunas» (só o master): uma linha por coluna — a pega de arrastar, o
   nome com os selos e a contagem, e o ⋯ com as ações dela (kbColunaMenu) —
   e, no pé, Fechar e «Adicionar coluna». A ordem muda-se a arrastar pela
   pega (kbColmPousar) e, no ⋯, com Subir e Descer, o caminho do teclado e
   do leitor de ecrã. Desenhada de novo (depois de uma ação), guarda a
   rolagem do corpo e devolve o foco ao ⋯ da coluna de que se falava.
   Recebe: foco (opcional) — o id da coluna cujo ⋯ recebe o foco.
   Devolve: nada — abre a janela. */
function kbColunas(foco) {
  if (!kbEstado || !kbEu().master) return;
  var j0 = kbJanelaAberta, d = el('dialogo'), rol = 0;
  if (j0 && j0.vista === 'colunas' && d && d.open) { var c0 = d.querySelector('.kb-j-corpo'); rol = c0 ? c0.scrollTop : 0; }
  var linhas = kbEstado.colunas.map(function (c) {
    return '<li class="kb-colm" data-coluna="' + esc(c.id) + '">' +
      '<span class="kb-colm-pega" data-gesto aria-hidden="true">' + ic('kbPega') + '</span>' +
      '<span class="kb-colm-txt"><span class="kb-colm-nome">' + esc(c.nome) + '</span>' + kbColunaSelos(c) +
      '<span class="kb-colm-n">' + kbConta(kbDaColuna(c.id).length, 'cartão', 'cartões') + '</span></span>' +
      '<button type="button" class="btn ghost so-icone kb-colm-mais" aria-haspopup="dialog" aria-label="Ações da coluna ' + esc(c.nome) + '"' +
      comAcao('kbColunaMenu', [c.id]) + '>' + ic('kbMais') + '</button></li>';
  }).join('');
  kbJanela('Colunas', '<p class="sub">Arrasta pela pega para mudar a ordem. As fixas são as que a sincronização usa: renomeiam-se, mas não se removem. O que chega a uma coluna de fim conta como feito.</p>' +
    '<div class="kb-colms-caixa"><ul class="kb-colms" aria-label="As colunas, pela ordem do quadro">' + linhas + '</ul></div>',
    { extra: { texto: 'Adicionar coluna', acao: 'kbColunaNova', icone: 'mais' } });
  kbJanelaAberta.vista = 'colunas';
  var corpo = d && d.querySelector('.kb-j-corpo');
  if (rol && corpo) corpo.scrollTop = rol;
  if (foco) kbColmFocar(foco);
}
/* Os selos de uma coluna: De fim e Fixa.
   Recebe: c — a coluna.
   Devolve: string HTML. */
function kbColunaSelos(c) {
  return (c.fim ? badge('ok', 'De fim') : '') + (c.fixa ? badge('', 'Fixa') : '');
}
/* Dá o foco ao ⋯ de uma coluna na lista das Colunas.
   Recebe: id — o id da coluna.
   Devolve: nada. */
function kbColmFocar(id) {
  var d = el('dialogo');
  if (!d) return;
  [].slice.call(d.querySelectorAll('.kb-colm')).forEach(function (l) {
    var b = l.getAttribute('data-coluna') === String(id) && l.querySelector('.kb-colm-mais');
    if (b && b.focus) b.focus();
  });
}
/* O ⋯ de uma coluna: as ações dela numa lista, no lugar da lista das
   colunas (o pé diz Voltar): Subir e Descer, Renomear, Marcar de fim (ou
   Tirar de fim) e Remover, que as fixas não têm. Feita a ação, a lista volta.
   Recebe: id — o id da coluna.
   Devolve: nada — troca o conteúdo da janela. */
function kbColunaMenu(id) {
  var c = kbColuna(id);
  if (!c || !kbEstado || !kbEu().master) return;
  var ids = kbEstado.colunas.map(function (x) { return x.id; }), i = ids.indexOf(id), n = ids.length;
  var op = function (acao, args, icone, rotulo, classe) {
    return '<button type="button" class="btn lista kb-opcao' + (classe ? ' ' + classe : '') + '"' + comAcao(acao, args) + '>' + icone + rotulo + '</button>';
  };
  var opcoes = (i > 0 ? op('kbColunaOrdem', [id, -1], ic('voltar', 'i-sm kb-i-cima'), 'Subir um lugar') : '') +
    (i < n - 1 ? op('kbColunaOrdem', [id, 1], ic('voltar', 'i-sm kb-i-baixo'), 'Descer um lugar') : '') +
    op('kbColunaRenomear', [id], ic('kbEditar', 'i-sm'), 'Renomear') +
    op('kbColunaFim', [id], ic('kbVisto', 'i-sm'), c.fim ? 'Tirar de fim' : 'Marcar de fim') +
    (c.fixa ? '' : op('kbColunaRemover', [id], ic('kbRemover', 'i-sm'), 'Remover', 'texto-perigo'));
  kbJanela(c.nome, '<div class="kb-opcoes">' + opcoes + '</div>', {
    texto: kbColunaSelos(c) + ' ' + esc(kbConta(kbDaColuna(id).length, 'cartão', 'cartões')),
    voltar: ['kbColunas', id], foco: '.kb-opcao',
  });
  kbJanelaAberta.vista = 'colunas-menu';
}
/* Depois de mudar as colunas: relê o quadro, volta à lista das colunas (se
   a janela ainda é a delas, ou a janela j que fez a mudança — o renomear e
   o adicionar, que trocam para a lista em vez de fecharem) e diz o que se
   fez. Quem fechou a janela entretanto não a vê abrir-se sozinha; a meio de
   um arrasto da lista, ela não se desenha por baixo do dedo.
   Recebe: msg — a frase do aviso; j (opcional) — a janela que fez a mudança; foco (opcional) — o id da coluna.
   Devolve: Promise. */
function kbDepoisDasColunas(msg, j, foco) {
  return kbRecarregar().then(function () {
    var v = kbJanelaViva() ? kbJanelaAberta : null;
    if (v && !kbColmArr && ((j && v === j) || v.vista === 'colunas' || v.vista === 'colunas-menu')) kbColunas(foco);
    avisar(msg);
  });
}
/* Um erro do servidor dito na janela das colunas (fica aberta).
   Recebe: e — o Error.
   Devolve: nada. */
function kbErroNasColunas(e) {
  var s = kbJanelaViva() && el('kbJanelaErro');
  if (s) s.textContent = (e && e.message) || 'Não deu.';
  else avisar((e && e.message) || 'Não deu.', 'erro');
}
/* Grava uma ordem nova das colunas, à frente do servidor: o quadro fica já
   com ela (e a lista, se se veio do ⋯; a do arrasto já está pela ordem
   nova, e não se desenha outra vez por baixo da linha a assentar) e, se o
   servidor recusar, tudo volta ao que era e a janela diz porquê.
   Recebe: ids — os ids pela ordem nova; foco (opcional) — o id da coluna que mudou.
   Devolve: Promise. */
function kbColunasGravar(ids, foco) {
  var antes = kbEstado.colunas.slice(), por = {};
  antes.forEach(function (c) { por[c.id] = c; });
  var nova = ids.map(function (id) { return por[id]; }).filter(Boolean);
  if (nova.length !== antes.length) return Promise.resolve();
  kbEstado.colunas = nova;
  if (kbJanelaViva() && kbJanelaAberta.vista === 'colunas-menu') kbColunas(foco);
  return enviar('/api/equipa/kanban/colunas/ordem', { ids: ids }).then(function () {
    return kbRecarregar().then(function () { avisar('Ordem das colunas guardada.'); });
  }, function (e) {
    if (kbEstado && kbEstado.colunas === nova) kbEstado.colunas = antes;
    if (kbJanelaViva() && kbJanelaAberta.vista === 'colunas' && !kbColmArr) kbColunas(foco);
    kbErroNasColunas(e);
  });
}
/* Sobe ou desce uma coluna um lugar (o ⋯ dela).
   Recebe: id; dir — -1 sobe, 1 desce.
   Devolve: nada. */
function kbColunaOrdem(id, dir) {
  var ids = kbEstado.colunas.map(function (c) { return c.id; }), i = ids.indexOf(id), j = i + Number(dir);
  if (i < 0 || j < 0 || j >= ids.length) return;
  kbColunasGravar(kbColmOrdem(ids, i, j), id);
}
/* Marca ou tira uma coluna de fim.
   Recebe: id.
   Devolve: nada. */
function kbColunaFim(id) {
  var c = kbColuna(id);
  if (!c) return;
  pedir('/api/equipa/kanban/colunas/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fim: !c.fim }) })
    .then(function () { return kbDepoisDasColunas(c.fim ? '«' + c.nome + '» deixou de ser de fim.' : '«' + c.nome + '» passou a ser de fim.', null, id); }).catch(kbErroNasColunas);
}
/* Remove uma coluna (o servidor recusa as fixas e as que têm cartões, e diz porquê).
   Recebe: id.
   Devolve: nada. */
function kbColunaRemover(id) {
  var c = kbColuna(id);
  pedir('/api/equipa/kanban/colunas/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function () { return kbDepoisDasColunas('Coluna «' + (c ? c.nome : id) + '» removida.'); }).catch(kbErroNasColunas);
}
/* Renomeia uma coluna; feito, a janela volta à lista das colunas.
   Recebe: id.
   Devolve: nada — abre a janela. */
function kbColunaRenomear(id) {
  var c = kbColuna(id);
  if (!c) return;
  kbJanela('Renomear «' + c.nome + '»', kbCampoHtml('kbF-coluna-nome', 'Nome', true, 'text', c.nome, 'Ex: Em revisão', 60), {
    foco: '#kbF-coluna-nome',
    aoConfirmar: function () {
      var nome = valorDe('kbF-coluna-nome'), j = kbJanelaAberta;
      marcarErro('kbF-coluna-nome', nome ? '' : 'Escreve um nome.');
      if (!nome) return false;
      return pedir('/api/equipa/kanban/colunas/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome }) })
        .then(function () { return kbDepoisDasColunas('Coluna renomeada.', j, id); });
    },
  });
}
/* Adiciona uma coluna (vai para o fim do quadro); feito, a janela volta à lista das colunas.
   Devolve: nada — abre a janela. */
function kbColunaNova() {
  kbJanela('Adicionar coluna', kbCampoHtml('kbF-coluna-nome', 'Nome', true, 'text', '', 'Ex: Em revisão', 60) +
    '<label class="kb-marcar"><input type="checkbox" id="kbF-coluna-fim"> Conta como feito (coluna de fim)</label>', {
    botao: 'Adicionar', foco: '#kbF-coluna-nome',
    aoConfirmar: function () {
      var nome = valorDe('kbF-coluna-nome'), fim = !!(el('kbF-coluna-fim') && el('kbF-coluna-fim').checked), j = kbJanelaAberta;
      marcarErro('kbF-coluna-nome', nome ? '' : 'Escreve um nome.');
      if (!nome) return false;
      return enviar('/api/equipa/kanban/colunas', { nome: nome, fim: fim })
        .then(function () { return kbDepoisDasColunas('Coluna «' + nome + '» adicionada.', j); });
    },
  });
}

/* ------------------------ reordenar as colunas a arrastar ------------------------ */

// o arrasto de uma linha das Colunas (kbColmPousar); null sem nenhum
var kbColmArr = null;

/* A nova ordem: o id da posição de vai para a posição para.
   Recebe: ids — a lista; de, para — índices.
   Devolve: uma lista nova (a antiga fica como estava). */
function kbColmOrdem(ids, de, para) {
  var r = ids.slice(), x = r.splice(de, 1)[0];
  r.splice(Math.max(0, Math.min(para, r.length)), 0, x);
  return r;
}
/* Onde cai a linha agarrada: uma de cima passa para baixo dela quando a
   borda de cima da agarrada sobe além do meio dessa; uma de baixo passa
   para cima quando a borda de baixo desce além do meio dela. Pelas bordas,
   e não pelo meio da agarrada, a primeira e a última trocam-se mesmo com a
   linha presa dentro da lista.
   Recebe: meios — o meio (y) de cada linha antes do arrasto; i0 — o índice
   da agarrada; cima, baixo — as bordas dela agora (no mesmo referencial).
   Devolve: o índice onde cai (0 a n-1). */
function kbColmAlvo(meios, i0, cima, baixo) {
  var n = 0;
  for (var i = 0; i < meios.length; i++) {
    if (i < i0 && cima >= meios[i]) n++;
    else if (i > i0 && baixo > meios[i]) n++;
  }
  return n;
}
/* Quanto se afasta a linha i para abrir o lugar da agarrada: as do caminho
   entre de onde ela saiu e onde vai cair andam a altura dela para o lado
   de onde ela veio.
   Recebe: i; i0 — a agarrada; para — onde vai cair; h — a altura dela.
   Devolve: px (0 fica). */
function kbColmDesvio(i, i0, para, h) {
  if (i === i0) return 0;
  if (para > i0 && i > i0 && i <= para) return -h;
  if (para < i0 && i >= para && i < i0) return h;
  return 0;
}
/* O dedo (ou o rato) pousou na pega de uma linha das Colunas: fica-se à
   escuta; passados 5px, a linha levanta-se e segue-o.
   Recebe: e — o PointerEvent do pointerdown; pega — a .kb-colm-pega.
   Devolve: nada — liga os ouvintes do documento. */
function kbColmPousar(e, pega) {
  if (kbColmArr || (e.button != null && e.button > 0) || e.isPrimary === false) return;
  var linha = pega.closest('.kb-colm'), caixa = pega.closest('.kb-colms-caixa');
  if (!linha || !caixa || !kbJanelaViva() || kbJanelaAberta.vista !== 'colunas') return;
  e.preventDefault();
  kbColmArr = { id: e.pointerId, pega: pega, linha: linha, caixa: caixa, lista: linha.parentElement, rol: caixa.closest('.kb-j-corpo'),
    y0: e.clientY, y: e.clientY, ativo: false, cancelado: false, i0: -1, para: -1, linhas: [], tops: [], alts: [], meios: [], h: 0, yRel0: 0,
    vel: 0, raf: 0, sitio: null, mexe: !kbReduzido() };
  try { pega.setPointerCapture(e.pointerId); } catch (x) { /* segue pelo documento */ }
  document.addEventListener('pointermove', kbColmMove);
  document.addEventListener('pointerup', kbColmFim);
  document.addEventListener('pointercancel', kbColmCancelar);
  window.addEventListener('keydown', kbColmTecla, true);
}
/* O dedo andou: passado o limiar, levanta a linha; depois leva-a e procura onde vai cair.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada. */
function kbColmMove(e) {
  var a = kbColmArr;
  if (!a || e.pointerId !== a.id) return;
  if (!a.linha.isConnected) return kbColmCancelar();
  a.y = e.clientY;
  if (!a.ativo) { if (Math.abs(a.y - a.y0) < 5) return; kbColmComecar(a); }
  kbColmRolagem(a);
  kbColmPintar(a);
}
/* Levanta a linha: mede as linhas (em relação à caixa da lista, que rola
   com elas), acende a agarrada e põe o sítio onde ela vai cair.
   Recebe: a — o arrasto.
   Devolve: nada. */
function kbColmComecar(a) {
  a.ativo = true;
  a.linhas = [].slice.call(a.lista.querySelectorAll('.kb-colm'));
  a.i0 = a.para = a.linhas.indexOf(a.linha);
  var r0 = a.caixa.getBoundingClientRect();
  a.linhas.forEach(function (l) {
    var r = l.getBoundingClientRect();
    a.tops.push(r.top - r0.top); a.alts.push(r.height); a.meios.push(r.top - r0.top + r.height / 2);
  });
  a.h = a.alts[a.i0];
  a.yRel0 = a.y0 - r0.top;
  a.sitio = document.createElement('div');
  a.sitio.className = 'kb-colm-sitio';
  a.sitio.setAttribute('aria-hidden', 'true');
  a.sitio.style.height = a.h + 'px';
  a.sitio.style.transform = 'translateY(' + a.tops[a.i0] + 'px)';
  a.caixa.appendChild(a.sitio);
  a.lista.classList.add('kb-colms-a-arrastar');
  a.linha.classList.add('kb-colm-agarrada');
}
/* Leva a linha agarrada com o dedo (sem sair da lista), afasta as do
   caminho e põe o sítio onde ela vai cair. Só mexe nas outras quando o
   sítio muda.
   Recebe: a — o arrasto.
   Devolve: nada. */
function kbColmPintar(a) {
  if (!a || !a.ativo) return;
  var n = a.linhas.length, r0 = a.caixa.getBoundingClientRect();
  var min = a.tops[0] - a.tops[a.i0], max = a.tops[n - 1] + a.alts[n - 1] - a.tops[a.i0] - a.h;
  var desl = Math.max(min, Math.min(max, a.y - r0.top - a.yRel0));
  a.linha.style.transform = 'translateY(' + desl + 'px)';
  var para = kbColmAlvo(a.meios, a.i0, a.tops[a.i0] + desl, a.tops[a.i0] + desl + a.h);
  if (para === a.para) return;
  a.para = para;
  a.linhas.forEach(function (l, i) {
    if (i === a.i0) return;
    var v = kbColmDesvio(i, a.i0, para, a.h);
    l.style.transform = v ? 'translateY(' + v + 'px)' : '';
  });
  var topo = para <= a.i0 ? a.tops[para] : a.tops[para] + a.alts[para] - a.h;
  a.sitio.style.transform = 'translateY(' + topo + 'px)';
}
/* Perto da borda de cima ou de baixo do corpo da janela, ele rola sozinho,
   mais depressa quanto mais perto.
   Recebe: a — o arrasto.
   Devolve: nada — arranca ou pára o passo da auto-rolagem. */
function kbColmRolagem(a) {
  if (!a.rol) return;
  var r = a.rol.getBoundingClientRect(), zona = 48, v = 0;
  if (a.y < r.top + zona) v = -Math.ceil(12 * (r.top + zona - a.y) / zona);
  else if (a.y > r.bottom - zona) v = Math.ceil(12 * (a.y - (r.bottom - zona)) / zona);
  a.vel = Math.max(-16, Math.min(16, v));
  if (a.vel && !a.raf) a.raf = requestAnimationFrame(kbColmPasso);
}
/* Um passo da auto-rolagem: rola, volta a pôr a linha debaixo do dedo, e
   continua enquanto houver para onde rolar.
   Devolve: nada. */
function kbColmPasso() {
  var a = kbColmArr;
  if (!a) return;
  a.raf = 0;
  if (!a.vel || !a.ativo || !a.rol) return;
  var antes = a.rol.scrollTop;
  a.rol.scrollTop += a.vel;
  if (a.rol.scrollTop === antes) return;
  kbColmPintar(a);
  a.raf = requestAnimationFrame(kbColmPasso);
}
/* Tira os ouvintes e esquece o arrasto (o desenho fica: quem chama desfá-lo).
   Devolve: o arrasto que havia, ou null. */
function kbColmSoltar() {
  var a = kbColmArr;
  kbColmArr = null;
  if (!a) return null;
  if (a.raf) { cancelAnimationFrame(a.raf); a.raf = 0; }
  document.removeEventListener('pointermove', kbColmMove);
  document.removeEventListener('pointerup', kbColmFim);
  document.removeEventListener('pointercancel', kbColmCancelar);
  window.removeEventListener('keydown', kbColmTecla, true);
  return a;
}
/* Apaga o desenho do arrasto: as linhas sem transform, sem realce, sem o sítio.
   Recebe: a — o arrasto.
   Devolve: nada. */
function kbColmLimpar(a) {
  a.linhas.forEach(function (l) { l.style.transform = ''; l.classList.remove('kb-colm-agarrada'); l.classList.remove('kb-colm-assenta'); });
  if (!kbColmArr || kbColmArr.lista !== a.lista) a.lista.classList.remove('kb-colms-a-arrastar');
  if (a.sitio && a.sitio.parentNode) a.sitio.parentNode.removeChild(a.sitio);
}
/* Desfaz já o arrasto em curso, sem animar (a janela trocou ou fechou por baixo dele).
   Devolve: nada. */
function kbColmDesfazer() {
  var a = kbColmSoltar();
  if (a && a.ativo) kbColmLimpar(a);
}
/* A linha volta ao sítio de onde saiu, e as outras com ela (o Esc, o
   pointercancel, ou largar no mesmo sítio).
   Recebe: a — o arrasto.
   Devolve: nada. */
function kbColmVolta(a) {
  if (a.mexe) a.linha.classList.add('kb-colm-assenta');
  a.linhas.forEach(function (l) { l.style.transform = ''; });
  if (a.sitio) a.sitio.style.transform = 'translateY(' + a.tops[a.i0] + 'px)';
  setTimeout(function () { kbColmLimpar(a); }, a.mexe ? kbTokenMs('--rapido', 120) + 40 : 0);
}
/* Largou: no mesmo sítio, a linha volta; noutro, a lista fica já pela ordem
   nova — a linha assenta no lugar dela a partir de onde o dedo a deixou — e
   a ordem vai para o servidor (kbColunasGravar).
   Devolve: nada. */
function kbColmFim() {
  var a = kbColmSoltar();
  if (!a || !a.ativo) return;
  if (a.cancelado || a.para === a.i0 || !a.linha.isConnected) { kbColmVolta(a); return; }
  var ids = a.linhas.map(function (l) { return l.getAttribute('data-coluna'); });
  var visual = a.linha.getBoundingClientRect().top;
  // as outras já estão onde vão ficar: sem a transição, o transform sai e a ordem entra sem nada saltar
  a.lista.classList.remove('kb-colms-a-arrastar');
  a.linhas.forEach(function (l) { l.style.transform = ''; });
  if (a.sitio && a.sitio.parentNode) a.sitio.parentNode.removeChild(a.sitio);
  var resto = a.linhas.filter(function (l) { return l !== a.linha; });
  a.lista.insertBefore(a.linha, resto[a.para] || null);
  var agora = a.linha.getBoundingClientRect().top;
  if (a.mexe && visual !== agora) {
    a.linha.style.transform = 'translateY(' + (visual - agora) + 'px)';
    a.linha.getBoundingClientRect();
    a.linha.classList.add('kb-colm-assenta');
    a.linha.style.transform = '';
  }
  setTimeout(function () { kbColmLimpar(a); }, a.mexe ? kbTokenMs('--rapido', 120) + 40 : 0);
  kbColunasGravar(kbColmOrdem(ids, a.i0, a.para), ids[a.i0]);
}
/* O pointercancel (o browser tomou o gesto) desfaz o arrasto, sem mudar a ordem.
   Devolve: nada. */
function kbColmCancelar() {
  var a = kbColmSoltar();
  if (a && a.ativo) kbColmVolta(a);
}
/* O Esc a meio de um arrasto desfá-lo e não fecha a janela (apanhado antes
   do dialog, na captura, e sem o comportamento de origem).
   Recebe: e — o KeyboardEvent.
   Devolve: nada. */
function kbColmTecla(e) {
  if (!kbColmArr || e.key !== 'Escape') return;
  e.preventDefault();
  e.stopPropagation();
  kbColmCancelar();
}

/* ------------------- as ações da janela e das colunas ------------------- */

/* Uma ação que pode vir de dentro da janela (o ⋯ de um cartão): fecha-a
   antes de seguir, a menos que a própria ação reabra a janela.
   Recebe: alvo — o elemento clicado.
   Devolve: nada. */
function kbSairDaJanela(alvo) {
  if (alvo && alvo.closest && alvo.closest('#dialogo')) kbFecharJanela();
}

ACOES.kbConfirmar = function () { kbConfirmar(); };
ACOES.kbFecharJanela = function () { kbFecharJanela(); };
ACOES.kbColunas = function (d) { kbColunas(d.arg); };
ACOES.kbColunaMenu = function (d) { kbColunaMenu(d.arg); };
ACOES.kbColunaNova = function () { kbColunaNova(); };
ACOES.kbColunaRenomear = function (d) { kbColunaRenomear(d.arg); };
ACOES.kbColunaOrdem = function (d) { kbColunaOrdem(d.arg, d.arg2); };
ACOES.kbColunaFim = function (d) { kbColunaFim(d.arg); };
ACOES.kbColunaRemover = function (d) { kbColunaRemover(d.arg); };

/* Os ouvintes da janela: o dedo que pousa (na pega de uma coluna, ou na
   folha), e o clique que o browser dá a seguir a um arrasto da folha, que
   não é um toque (engolido na captura, antes das ações). Um dedo que pousa
   de novo é outro gesto: o clique dele já não se engole. */
document.addEventListener('pointerdown', function (e) {
  kbFolhaEngole = 0;
  var p = e.target && e.target.closest ? e.target.closest('#dialogo .kb-colm-pega') : null;
  if (p) kbColmPousar(e, p);
  else kbFolhaPousar(e);
});
window.addEventListener('click', function (e) {
  if (!kbFolhaEngole) return;
  if (Date.now() < kbFolhaEngole) { e.stopPropagation(); e.preventDefault(); }
  kbFolhaEngole = 0;
}, true);
`;

// os estilos deste pedaço (o CSS_KANBAN do equipa-kanban.js junta-os pela ordem certa)
export const CSS_KB_JANELA = `/* ---- a janela (formulários, escolhas, colunas): a moldura da folha da app ---- */
/* O dialog#dialogo, enquanto é do kanban (a classe kb-dlg, que o kbJanela
   põe e tira), é ele a folha: o fundo, o contorno, o raio e a sombra. Não
   rola — era o «mini scroll» do Mover para, o dialog (overflow:auto de
   origem) e a janela lá dentro a rolarem os dois —, e reparte-se em
   cabeçalho, corpo que rola (só ele, e só quando não cabe) e pé fixo com os
   botões a toda a largura, 48px, como os da app (estilos.css:.sheet .foot).
   O véu (::backdrop) segue o --kb-veu, que o arrastar da folha aclara. */
dialog.janela.kb-dlg{padding:0;overflow:hidden;overscroll-behavior:contain;background:var(--card);border:1px solid var(--line);
  border-radius:20px;box-shadow:var(--shadow)}
dialog.janela.kb-dlg[open]{display:flex;flex-direction:column}
dialog.janela.kb-dlg:focus-visible{outline:none}
dialog.janela.kb-dlg::backdrop{opacity:var(--kb-veu,1)}
.kb-janela.janela-corpo{flex:0 1 auto;min-height:0;display:flex;flex-direction:column;gap:0;padding:0;background:none;border:0;border-radius:0;box-shadow:none}
.kb-j-cab{flex:none;padding:16px 20px 14px;border-bottom:1px solid var(--line)}
.kb-j-cab h2{margin:0;font-size:18px;line-height:1.25;overflow-wrap:anywhere}
/* o corpo é o bloco de quem se posiciona lá dentro (os rádios escondidos dos
   chips, por exemplo): sem isso ficavam do dialog, fora do corte do corpo, e
   davam-lhe por onde rolar quando o foco lhes chegava */
.kb-j-corpo{position:relative;flex:0 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;padding:16px 20px 20px;
  display:flex;flex-direction:column;gap:14px}
.kb-j-pe{flex:none;display:flex;flex-direction:column;gap:10px;padding:14px 20px;border-top:1px solid var(--line)}
.kb-j-botoes{display:flex;gap:10px}
.kb-j-botoes .btn{flex:1 1 0;min-width:0;min-height:48px;justify-content:center}
.kb-janela .lbl{margin-top:4px}
/* No telemóvel, a folha de baixo (estilos.css:.sheet, abaixo dos 520px):
   encostada em baixo a toda a largura, até 93dvh (o dvh conta com as
   barras do browser à vista), a barra no cabeçalho — que é a pega: o gesto
   vertical ali é da folha (touch-action:none), como no pé, onde nada rola
   — e o pé acima da área segura. */
@media(max-width:520px){
  dialog.janela.kb-dlg{top:auto;bottom:0;left:0;right:0;margin:0;width:100%;max-width:none;max-height:93vh;max-height:93dvh;
    border-width:1px 0 0;border-radius:20px 20px 0 0}
  .kb-j-cab{padding:8px 16px 12px;touch-action:none}
  .kb-j-cab::before{content:"";display:block;width:36px;height:4px;margin:0 auto 10px;border-radius:2px;background:var(--line2)}
  .kb-j-corpo{padding:14px 16px 18px}
  .kb-j-pe{padding:12px 16px calc(12px + env(safe-area-inset-bottom));touch-action:none}
  dialog.janela.kb-dlg.kb-arrastar{-webkit-user-select:none;user-select:none}
}
/* O movimento (o /animate): abrir uma janela é ocasional, e o movimento diz
   de onde ela vem e para onde vai. Centrada, entra e sai com um desvanecer
   curto e 8px de subida (nunca do nada: 98%); folha, sobe de baixo e desce
   para baixo — a saída continua de onde o dedo a deixou, porque só declara
   o fim. Tudo em --medio, na --curva (ease-out: nada arranca devagar), e a
   entrada na --curva-entra, a de quem atravessa distância. O regresso ao
   sítio é uma transição (pode ser apanhada a meio pelo dedo); a folha que
   já se pegou, ou cujo conteúdo trocou, não volta a entrar. */
@keyframes kbJanelaEntra{from{opacity:0;transform:translateY(8px) scale(.98)}}
@keyframes kbJanelaSai{to{opacity:0;transform:translateY(8px) scale(.98)}}
@keyframes kbFolhaSobe{from{transform:translateY(100%)}}
@keyframes kbFolhaDesce{to{transform:translateY(100%)}}
@keyframes kbVeuEntra{from{opacity:0}}
@keyframes kbVeuSai{to{opacity:0}}
dialog.janela.kb-dlg[open]:not(.kb-trocou):not(.kb-arrastou):not(.kb-sai){animation:kbJanelaEntra var(--medio) var(--curva-entra)}
dialog.janela.kb-dlg[open]:not(.kb-trocou):not(.kb-arrastou):not(.kb-sai)::backdrop{animation:kbVeuEntra var(--medio) var(--curva-entra)}
dialog.janela.kb-dlg.kb-volta{transition:transform var(--medio) var(--curva-entra)}
dialog.janela.kb-dlg.kb-volta::backdrop{transition:opacity var(--medio) var(--curva-entra)}
dialog.janela.kb-dlg.kb-sai{pointer-events:none;animation:kbJanelaSai var(--medio) var(--curva) both}
dialog.janela.kb-dlg.kb-sai::backdrop{animation:kbVeuSai var(--medio) var(--curva) both}
@media(max-width:520px){
  dialog.janela.kb-dlg[open]:not(.kb-trocou):not(.kb-arrastou):not(.kb-sai){animation-name:kbFolhaSobe}
  dialog.janela.kb-dlg.kb-sai{animation-name:kbFolhaDesce}
}
/* Com menos movimento: só desvanece (entra e sai), a folha não segue o dedo
   — desvanece um pouco quando largar já a fecha —, e as colunas não deslizam. */
@media(prefers-reduced-motion:reduce){
  dialog.janela.kb-dlg[open]:not(.kb-trocou):not(.kb-arrastou):not(.kb-sai){animation-name:kbVeuEntra}
  dialog.janela.kb-dlg.kb-sai{animation-name:kbVeuSai}
  dialog.janela.kb-dlg.kb-pronto{opacity:.72}
}
.kb-opcoes{display:flex;flex-direction:column;gap:6px}
.kb-opcao[aria-pressed="true"]{border-color:var(--accent);color:var(--accent-text);background:var(--accent-soft)}
.kb-opcao .i{color:var(--accent)}
/* ---- as Colunas: uma linha cada (a pega, o nome com os selos e a contagem, o ⋯) ---- */
.kb-colms-caixa{position:relative}
.kb-colms{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:12px}
.kb-colm{position:relative;z-index:1;display:flex;align-items:center;gap:4px;min-height:52px;padding:4px 4px 4px 0;background:var(--card)}
.kb-colm+.kb-colm{border-top:1px solid var(--line)}
.kb-colm:first-child{border-top-left-radius:11px;border-top-right-radius:11px}
.kb-colm:last-child{border-bottom-left-radius:11px;border-bottom-right-radius:11px}
.kb-colm-pega{flex:none;display:grid;place-items:center;width:40px;height:44px;color:var(--faint);cursor:grab;touch-action:none;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.kb-colm-pega .i{stroke-width:2.8}
.kb-colm-txt{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px;white-space:nowrap;overflow:hidden}
.kb-colm-nome{min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:650}
.kb-colm-txt .badge{flex:none}
.kb-colm-n{flex:none;color:var(--muted);font-size:13px}
.btn.so-icone.kb-colm-mais{flex:none;width:44px;height:44px;min-height:44px;color:var(--muted)}
@media(hover:hover) and (pointer:fine){.kb-colm-pega:hover{color:var(--ink)}}
/* A arrastar (kbColmPousar): a agarrada levanta-se e segue o dedo, acesa no
   contorno e na letra (o escuro forçado do Samsung escurece os fundos); as
   do caminho abrem-lhe lugar, a deslizar em --rapido; e o sítio onde ela vai
   cair tem o contorno tracejado. Largada, assenta no lugar dela. */
.kb-colms-a-arrastar{-webkit-user-select:none;user-select:none}
.kb-colms-a-arrastar .kb-colm:not(.kb-colm-agarrada){transition:transform var(--rapido) var(--curva)}
.kb-colm.kb-colm-agarrada{z-index:3;border-radius:10px;outline:2px solid var(--accent);outline-offset:-2px;box-shadow:var(--shadow)}
.kb-colm-agarrada .kb-colm-nome,.kb-colm-agarrada .kb-colm-pega{color:var(--accent-text)}
.kb-colm-agarrada .kb-colm-pega{cursor:grabbing}
.kb-colm.kb-colm-assenta{transition:transform var(--rapido) var(--curva)}
.kb-colm-sitio{position:absolute;left:0;right:0;top:0;z-index:0;border:2px dashed var(--accent);border-radius:12px;pointer-events:none;
  transition:transform var(--rapido) var(--curva)}
.kb-i-cima{transform:rotate(90deg)}
.kb-i-baixo{transform:rotate(-90deg)}
.kb-marcar{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;cursor:pointer}
.kb-marcar input{width:20px;height:20px;accent-color:var(--accent)}
/* com menos movimento, a linha agarrada segue o dedo, mas as outras não deslizam: saltam para o lugar */
@media(prefers-reduced-motion:reduce){
  .kb-colms-a-arrastar .kb-colm:not(.kb-colm-agarrada),.kb-colm.kb-colm-assenta,.kb-colm-sitio{transition:none}
}
`;
