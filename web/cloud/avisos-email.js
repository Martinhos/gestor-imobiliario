/* ===== OS AVISOS POR EMAIL ===== */
/* Os avisos por email dos planeados em atraso, do lado da app.
   ------------------------------------------------------------
   O servidor manda, no cron diário, um resumo por pessoa nos dias em que um
   planeado entra em atraso (worker/src/lib/avisos-atraso.js). Está ligado
   por omissão, e a escolha é da conta: lê-se e grava-se em
   /api/conta/avisos (GET → {email}, POST {email} → {email}).

   A LINHA DAS DEFINIÇÕES
   «Avisos por email», na secção Conta, a seguir à Segurança
   (aveLinhaDasDefinicoes). Como a «Ajudar a melhorar» do rasto
   (cloud/rasto.js:rstLinhaDasDefinicoes): a linha inteira é o interruptor,
   um botão role=switch com o aria-checked, e o estado diz-se em palavras e
   na cor da letra — o Samsung Internet escurece à força e só a frente
   sobrevive. Só aparece com sessão (e com o serviço dos Planeados ligado,
   que sem ele não há avisos). A escolha pede-se ao servidor quando a raiz
   das Definições se pinta e ainda não se sabe (aveSincronizar); enquanto
   não chega, ou se falhar, a frase di-lo, e tocar pede outra vez. Tocar
   com a escolha sabida grava a contrária e diz o que ficou num aviso; uma
   falha não muda nada e diz-o. A meio de um pedido a linha fica ocupada
   (aria-busy e aria-disabled, e não disabled: um botão desativado perde o
   foco, e quem chega pela ligação do email tem o foco nela).

   AS LIGAÇÕES DO EMAIL
   /?avisos abre a raiz das Definições com esta linha à vista e com o foco;
   /?planeados abre os Planeados (ou a Visão geral, com o serviço
   desligado). O destino lê-se do endereço quando este ficheiro carrega
   (aveApanharDoEndereco), sai logo do endereço (só a chave dele: os outros
   parâmetros ficam a quem os lê) e espera em sessionStorage. Com sessão,
   cumpre-se quando a página acaba de carregar; sem ela, depois de entrar
   (o embrulho do entrada.js:finishLogin). */

/* A chave, nesta sessão do browser, do destino que veio pelo endereço. */
var aveChaveDestino = 'gi_ave_destino';
/* Os destinos que o endereço pode trazer. */
var aveDestinos = ['avisos', 'planeados'];
/* Os textos da linha e dos avisos. */
var aveTextos = {
  rotulo: 'Avisos por email',
  ligado: 'Ligado: um email no dia em que um planeado fica em atraso',
  desligado: 'Desligado: não te mandamos estes avisos',
  aLer: 'A ler a tua escolha…',
  falhouLer: 'Não deu para ler a tua escolha. Toca para tentar outra vez',
  avisoLigado: 'Avisos ligados. Mandamos-te um email no dia em que um planeado ficar em atraso.',
  avisoDesligado: 'Avisos desligados. Deixamos de te mandar emails dos planeados em atraso.',
  avisoFalhou: 'Não deu para mudar os avisos. Tenta outra vez.',
};

/* O estado. A escolha: undefined enquanto não se sabe, true ou false — e de
   que conta é (aveEmailDe). */
var aveEmail, aveEmailDe = '';
// o GET em curso, e se o último falhou (não se repete sozinho: tocar repete)
var aveAPedir = false, aveFalhouLer = false;
// o POST em curso (um segundo toque a meio não faz nada)
var aveAMudar = false;
// o destino que veio pelo endereço, enquanto espera ('' sem nenhum)
var aveDestino = '';
/* até quando (ms de época) a linha guarda o foco que o /?avisos lhe deu: os
   renders que vêm logo a seguir (o primeiro estado, a escolha lida) refazem
   o botão e o foco caía; 0 quando não guarda */
var aveFocoAte = 0;

/* ------------------------------------------------------------ o básico */

/* A conta com sessão.
   Recebe: nada.
   Devolve: o id da conta (texto), ou '' sem sessão. */
function aveConta() { return (window.CW && CW.user && CW.user.id) ? String(CW.user.id) : ''; }

/* A escolha que se sabe, desta conta.
   Recebe: nada.
   Devolve: true ou false, ou null quando ainda não se sabe. */
function aveSabido() {
  var uid = aveConta();
  return uid && aveEmailDe === uid && typeof aveEmail === 'boolean' ? aveEmail : null;
}

/* Está-se na raiz das Definições?
   Recebe: nada.
   Devolve: true se o separador é o das Definições e sem subpágina. */
function aveNaRaiz() {
  return typeof tab !== 'undefined' && tab === 'settings' && !(typeof setPage !== 'undefined' && setPage);
}

/* ----------------------------------------------------------- a escolha */

/* Segue a sessão (a cada render): outra conta, ou nenhuma, esquece a escolha
   da de antes; na raiz das Definições, uma escolha por saber pede-se — uma
   vez: depois de uma falha, só o toque na linha pede outra vez.
   Recebe: nada.
   Devolve: nada. */
function aveSincronizar() {
  var uid = aveConta();
  if (aveEmailDe !== uid) { aveEmail = undefined; aveFalhouLer = false; aveEmailDe = uid; }
  if (uid && aveNaRaiz() && aveSabido() === null && !aveAPedir && !aveFalhouLer) aveLer();
}

/* Pede a escolha ao servidor (GET /api/conta/avisos) e repinta a linha.
   Recebe: nada.
   Devolve: a Promise do pedido, ou null quando não pede (sem sessão, já a
   pedir, ou sem a API). */
function aveLer() {
  var uid = aveConta();
  if (!uid || aveAPedir || typeof api !== 'function') return null;
  aveAPedir = true;
  var p;
  try { p = Promise.resolve(api('GET', '/api/conta/avisos')); } catch (e) { p = Promise.reject(e); }
  return p.then(function (r) {
    aveAPedir = false;
    if (aveConta() === uid) {
      if (r && typeof r.email === 'boolean') { aveEmail = r.email; aveEmailDe = uid; aveFalhouLer = false; } else aveFalhouLer = true;
    }
    aveRepintar(false);
  }, function () {
    aveAPedir = false;
    if (aveConta() === uid) aveFalhouLer = true;
    aveRepintar(false);
  });
}

/* Grava a escolha (POST /api/conta/avisos) e adota a que o servidor devolve.
   Recebe: email — true para ligar, false para desligar.
   Devolve: Promise com true se gravou, false se falhou, e null se a conta
   mudou entretanto (a resposta já não é de quem está). */
function aveGravar(email) {
  var uid = aveConta();
  if (!uid || typeof api !== 'function' || typeof email !== 'boolean') return Promise.resolve(false);
  var p;
  try { p = Promise.resolve(api('POST', '/api/conta/avisos', { email: email })); } catch (e) { p = Promise.reject(e); }
  return p.then(function (r) {
    if (aveConta() !== uid) return null;
    aveEmail = r && typeof r.email === 'boolean' ? r.email : email;
    aveEmailDe = uid; aveFalhouLer = false;
    return true;
  }, function () { return aveConta() === uid ? false : null; });
}

/* ------------------------------------------------- a linha das Definições */

/* A linha «Avisos por email» na raiz das Definições: a linha inteira é o
   interruptor (role=switch, um botão com a altura da .linha), com o desenho
   dele à direita; a frase diz o estado em palavras, e ligado na cor da
   frente, não só no fundo do interruptor. Por saber, diz que está a ler ou
   que não deu, e o aria-checked fica false.
   Recebe: nada.
   Devolve: o HTML (texto) da linha. */
function aveLinhaDasDefinicoes() {
  var sabido = aveSabido(), ligado = sabido === true;
  var ocupado = aveAMudar || (sabido === null && aveAPedir);
  var sub = sabido === true ? aveTextos.ligado : sabido === false ? aveTextos.desligado
    : aveFalhouLer && !aveAPedir ? aveTextos.falhouLer : aveTextos.aLer;
  var classe = ligado ? ' ave-def-ligado' : sabido === null && aveFalhouLer && !aveAPedir ? ' ave-def-falhou' : '';
  var escapar = typeof esc === 'function' ? esc : function (s) { return String(s); };
  return '<button type="button" class="linha def-linha ave-def" id="aveDefinicoes" role="switch" aria-checked="' + ligado + '"' +
    (ocupado ? ' aria-busy="true" aria-disabled="true"' : '') + ' data-toca="dados" data-click="aveMudarNasDefinicoes()">' +
    '<span class="ic">' + (typeof ic === 'function' ? ic('bell', 20) : '') + '</span>' +
    '<span class="txt"><b class="u-d-block">' + escapar(aveTextos.rotulo) + '</b><span class="small' + classe + '">' + escapar(sub) + '</span></span>' +
    '<span class="interruptor" aria-hidden="true"></span></button>';
}

/* O toque na linha das Definições. Com a escolha sabida, grava a contrária e
   diz o que ficou num aviso (uma falha não muda nada e diz-o); por saber,
   pede-a outra vez. A meio de um pedido, não faz nada.
   Recebe: nada.
   Devolve: Promise com true se gravou e false se falhou (null quando não
   gravou nada: a meio de outro pedido, sem sessão, ou só a ler). */
function aveMudarNasDefinicoes() {
  if (aveAMudar || !aveConta()) return null;
  var sabido = aveSabido();
  if (sabido === null) {
    if (aveAPedir) return null;
    aveFalhouLer = false;
    var p = aveLer();
    aveRepintar(true);
    return p ? p.then(function () { aveRepintar(true); return null; }) : null;
  }
  var nova = !sabido;
  aveAMudar = true;
  aveRepintar(true);
  return aveGravar(nova).then(function (ok) {
    aveAMudar = false;
    if (ok !== null && typeof toast === 'function') {
      toast(!ok ? aveTextos.avisoFalhou : aveEmail ? aveTextos.avisoLigado : aveTextos.avisoDesligado);
    }
    aveRepintar(true);
    return ok;
  });
}

/* Repinta a raiz das Definições, se é lá que se está, e devolve o foco à
   linha quando o tinha (o render destrói o botão onde ele estava).
   Recebe: focar — true para lhe dar o foco na mesma.
   Devolve: nada. */
function aveRepintar(focar) {
  if (!aveNaRaiz() || typeof render !== 'function') return;
  var tinha = !!focar;
  try { var a = document.activeElement; if (a && a.id === 'aveDefinicoes') tinha = true; } catch (e) {}
  try { render(); } catch (e) { return; }
  if (tinha) aveFocarLinha(false);
}

/* Dá o foco à linha e, se pedido, rola até ela.
   Recebe: rolar — true para a trazer ao meio do ecrã.
   Devolve: true se a linha estava lá. */
function aveFocarLinha(rolar) {
  var b = null;
  try { b = document.getElementById('aveDefinicoes'); } catch (e) {}
  if (!b) return false;
  try { if (rolar && typeof b.scrollIntoView === 'function') b.scrollIntoView({ block: 'center' }); } catch (e) {}
  try { if (typeof b.focus === 'function') b.focus({ preventScroll: true }); } catch (e) {}
  return true;
}

/* A linha aparece só com sessão, e com o serviço dos Planeados ligado. */
if (typeof linhaDefinicoes === 'function') {
  linhaDefinicoes({ sec: 'conta', ordem: 30, label: aveTextos.rotulo, linha: aveLinhaDasDefinicoes,
    se: function () { return !!aveConta() && (typeof servicoLigado !== 'function' || servicoLigado('recurring')); } });
}

/* ------------------------------------------------ as ligações do email */

/* Separa do endereço o destino do email (?avisos ou ?planeados, com ou sem
   valor, entre outros parâmetros).
   Recebe: search — o location.search (com ou sem o «?»).
   Devolve: {destino, resto} — destino é 'avisos', 'planeados' ou '', e resto
   a pesquisa sem essas chaves (texto sem o «?», '' sem nada). */
function aveDestinoDoEndereco(search) {
  var partes = String(search || '').replace(/^\?/, '').split('&').filter(Boolean);
  var destino = '', resto = [];
  partes.forEach(function (p) {
    var k = p.split('=')[0];
    try { k = decodeURIComponent(k); } catch (e) {}
    if (aveDestinos.indexOf(k) >= 0) { if (!destino) destino = k; } else resto.push(p);
  });
  return { destino: destino, resto: resto.join('&') };
}

/* O destino que espera (o desta página, ou o guardado nesta sessão do
   browser, que sobrevive a um recarregar).
   Recebe: nada.
   Devolve: 'avisos', 'planeados' ou ''. */
function aveDestinoGuardado() {
  if (aveDestino) return aveDestino;
  var d = '';
  try { d = sessionStorage.getItem(aveChaveDestino) || ''; } catch (e) {}
  return aveDestinos.indexOf(d) >= 0 ? d : '';
}

/* Guarda o destino, ou esquece-o.
   Recebe: d — 'avisos', 'planeados', ou '' para o esquecer.
   Devolve: nada. */
function aveGuardarDestino(d) {
  aveDestino = d || '';
  try {
    if (aveDestino) sessionStorage.setItem(aveChaveDestino, aveDestino);
    else sessionStorage.removeItem(aveChaveDestino);
  } catch (e) {}
}

/* Lê o destino do endereço, guarda-o e tira a chave dele do endereço (os
   outros parâmetros ficam, e o resto do endereço também).
   Recebe: nada (lê o location).
   Devolve: o destino lido ('' sem nenhum). */
function aveApanharDoEndereco() {
  var search = '';
  try { search = location.search || ''; } catch (e) {}
  var r = aveDestinoDoEndereco(search);
  if (!r.destino) return '';
  aveGuardarDestino(r.destino);
  try {
    history.replaceState(null, '', (location.pathname || '/') + (r.resto ? '?' + r.resto : '') + (location.hash || ''));
  } catch (e) {}
  return r.destino;
}

/* O ecrã de entrada está à vista? (o authEl do entrada.js, como o
   entrada.js:CW.resgatarChegada o lê)
   Recebe: nada.
   Devolve: true com o ecrã de entrada mostrado. */
function aveEntradaAberta() {
  try { return typeof authEl !== 'undefined' && !!authEl && !!authEl.style && authEl.style.display !== 'none'; } catch (e) { return false; }
}

/* Cumpre o destino que veio pelo endereço, se há sessão: as Definições com
   a linha à vista e o foco nela, ou os Planeados (a Visão geral, com o
   serviço desligado, e o aviso a dizer porquê). Sem sessão, espera: corre
   outra vez depois de entrar.
   Recebe: nada.
   Devolve: o destino cumprido, ou '' quando não havia ou ficou à espera. */
function aveTentarDestino() {
  var d = aveDestinoGuardado();
  if (!d || !aveConta() || aveEntradaAberta() || typeof go !== 'function') return '';
  aveGuardarDestino('');
  if (d === 'avisos') {
    go('settings');
    aveSegurarFoco();
    if (!aveFocarLinha(true) && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { aveFocarLinha(true); });
    }
    return d;
  }
  if (typeof separadorLigado !== 'function' || separadorLigado('recurring')) go('recurring');
  else {
    go('dashboard');
    if (typeof toast === 'function' && typeof hintServicoDesligado === 'function') toast(hintServicoDesligado('recurring'));
  }
  return d;
}

/* Segura o foco na linha durante os renders dos próximos 5 segundos (o
   primeiro estado e a escolha lida chegam depois do /?avisos e refazem o
   botão), e larga-o ao primeiro toque ou tecla da pessoa, que manda.
   Recebe: nada.
   Devolve: nada. */
function aveSegurarFoco() {
  aveFocoAte = Date.now() + 5000;
  try {
    var largar = function () {
      aveFocoAte = 0;
      document.removeEventListener('pointerdown', largar, true);
      document.removeEventListener('keydown', largar, true);
    };
    document.addEventListener('pointerdown', largar, true);
    document.addEventListener('keydown', largar, true);
  } catch (e) {}
}

/* Depois de um render, devolve o foco à linha enquanto o /?avisos o segura
   e ainda se está na raiz das Definições; fora dela, deixa de segurar.
   Recebe: nada.
   Devolve: nada. */
function aveReporFoco() {
  if (!aveFocoAte) return;
  if (Date.now() > aveFocoAte || !aveNaRaiz()) { aveFocoAte = 0; return; }
  var b = null;
  try { b = document.getElementById('aveDefinicoes'); } catch (e) {}
  if (b && document.activeElement !== b) aveFocarLinha(false);
}

/* ---------------------------------------------------------- os embrulhos */

/* O render segue a sessão e pede a escolha quando a raiz das Definições se
   pinta; o render do vizinho que o carrossel pinta às escondidas
   (vistas.js:_pintarAParte) não conta. O finishLogin, depois de entrar,
   cumpre o destino que esperava. Cada embrulho chama a função de antes
   primeiro, e o que é daqui vai num try/catch. */
var aveRenderDeAntes = render;
render = function () {
  var r = aveRenderDeAntes.apply(this, arguments);
  if (!(typeof _pintarAParte !== 'undefined' && _pintarAParte)) {
    try { aveSincronizar(); } catch (e) {}
    try { aveReporFoco(); } catch (e) {}
  }
  return r;
};
var aveFinishLoginDeAntes = typeof finishLogin === 'function' ? finishLogin : null;
if (aveFinishLoginDeAntes) {
  finishLogin = function () {
    var r = aveFinishLoginDeAntes.apply(this, arguments);
    try { aveTentarDestino(); } catch (e) {}
    return r;
  };
}

try { aveApanharDoEndereco(); } catch (e) {}
try {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { aveTentarDestino(); } catch (e) {} });
  else setTimeout(function () { try { aveTentarDestino(); } catch (e) {} }, 0);
} catch (e) {}
