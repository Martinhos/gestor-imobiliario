/* Atualizações e novidades.
   ------------------------
   Três coisas, por esta ordem de importância:

   1. A app verifica sozinha, ao abrir, se há versão nova, e instala-a.
   2. Se a versão em uso já não for aceitável, tranca e obriga a atualizar.
   3. Havendo novidades, mostra o que mudou — só as partes que dizem
      respeito a quem está a ver. */

'use strict';

var LS_VISTO = 'gi_novidades_v';     // última versão cujas novidades já viu
var SS_RECARGA = 'gi_recarga_para';  // para não entrar em ciclo de recargas

/* Que funcionalidades esta pessoa usa.
   Hoje toda a gente tem todas — não há ainda permissões parciais. Quando
   houver, é esta função que passa a devolver só as que a pessoa tem, e tudo
   o resto (avisos, modal, secção de novidades) acompanha sem mudar. */
function funcsDoUtilizador() {
  return Object.keys(FUNCIONALIDADES);
}

function afetaMe(sec) {
  var minhas = funcsDoUtilizador();
  var toca = sec.afeta || ['app'];
  return toca.some(function (f) { return minhas.indexOf(f) > -1; });
}

// Um aviso só conta se sobrar alguma secção depois de filtrar.
function avisoParaMim(a) {
  var secs = (a.seccoes || []).filter(afetaMe);
  return secs.length ? { v: a.v, data: a.data, titulo: a.titulo, seccoes: secs } : null;
}

function avisosDesde(v) {
  return AVISOS.filter(function (a) { return a.v > v; }).map(avisoParaMim).filter(Boolean);
}

function vistoAte() {
  try { return Number(localStorage.getItem(LS_VISTO)) || 0; } catch (e) { return 0; }
}
function marcarVisto(v) {
  try { localStorage.setItem(LS_VISTO, String(v)); } catch (e) {}
}

/* ---------------------------------------------------------- o que há de novo */

var novAbertas = {};   // que secções estão abertas neste modal

function secHtml(sec, chave) {
  var aberta = novAbertas[chave] !== false;   // por omissão, abertas
  return '<div class="card" style="padding:0;overflow:hidden">' +
    '<div class="row-between tap" style="align-items:center;padding:13px 15px;cursor:pointer" ' +
      'onclick="CW.novToggle(\'' + chave + '\')">' +
      '<b style="min-width:0">' + esc(sec.titulo) + '</b>' +
      '<span style="flex:0 0 auto;display:inline-flex;color:var(--muted);' +
        'transform:rotate(' + (aberta ? '90' : '-90') + 'deg);transition:transform .15s">' +
        ic('chev', 18) + '</span></div>' +
    (aberta
      ? '<div style="padding:0 15px 14px"><ul style="margin:0;padding-left:18px;color:var(--muted);font-size:14px">' +
        sec.itens.map(function (i) { return '<li style="margin:6px 0">' + esc(i) + '</li>'; }).join('') +
        '</ul></div>'
      : '') +
    '</div>';
}

function novHtml(avisos) {
  return '<div class="form">' + avisos.map(function (a) {
    return '<div>' +
      '<div class="section-title" style="margin-top:0">' + esc(a.titulo) + '</div>' +
      '<div class="small" style="margin:-6px 0 10px">versão ' + a.v + ' · ' + esc(a.data) + '</div>' +
      '<div class="list" style="gap:9px">' +
      a.seccoes.map(function (s, i) { return secHtml(s, a.v + ':' + i); }).join('') +
      '</div></div>';
  }).join('<div style="height:16px"></div>') + '</div>';
}

CW.novToggle = function (chave) {
  novAbertas[chave] = novAbertas[chave] === false;
  var m = modalTop();
  if (!m) return;
  var body = m.el.querySelector('.body');
  if (body && CW._novAvisos) body.innerHTML = novHtml(CW._novAvisos);
};

CW.verNovidades = function (avisos, aoFechar) {
  CW._novAvisos = avisos;
  novAbertas = {};
  openModal('O que há de novo', novHtml(avisos),
    '<button class="btn primary" onclick="CW.novFechar()">Continuar</button>');
  CW._novFecho = aoFechar;
};

CW.novFechar = function () {
  closeAllModals();
  marcarVisto(VERSAO);
  var f = CW._novFecho;
  CW._novFecho = null;
  if (f) f();
};

// Mostra as novidades por ver, se sobrar alguma depois de filtrar.
function mostrarNovidadesSeHouver() {
  var visto = vistoAte();
  if (visto >= VERSAO) return false;
  var avisos = avisosDesde(visto);
  if (!avisos.length) { marcarVisto(VERSAO); return false; }   // nada que lhe diga respeito
  // quem instala de novo não leva com o histórico todo à frente
  if (!visto) { marcarVisto(VERSAO); return false; }
  CW.verNovidades(avisos);
  return true;
}

/* ------------------------------------------------------ atualização forçada */

function gateAtualizar(minima) {
  if (document.getElementById('cwUpd')) return;
  var el = document.createElement('div');
  el.id = 'cwUpd';
  el.style.cssText = 'position:fixed;inset:0;z-index:198;background:var(--bg);overflow:auto;' +
    'padding:calc(28px + var(--inset-top)) 18px calc(28px + var(--inset-bottom));display:grid;place-items:center';
  el.innerHTML = '<div style="max-width:420px;width:100%">' +
    card('Há uma versão nova', 'Esta já não pode ser usada',
      '<div class="hint">A versão que tens (' + VERSAO + ') deixou de ser aceite; a mais antiga que serve é a ' +
      minima + '. Atualizar demora um instante e não perdes nada — os teus dados estão na tua conta.</div>' +
      '<div class="toolbar" style="margin:15px 0 0">' +
      '<button class="btn primary" onclick="CW.atualizarAgora()">Atualizar agora</button></div>') +
    '</div>';
  document.body.appendChild(el);
}

CW.atualizarAgora = function () {
  limparCaches().then(function () { location.reload(); });
};

function limparCaches() {
  var p = [];
  try {
    if (window.caches && caches.keys) {
      p.push(caches.keys().then(function (ks) {
        return Promise.all(ks.map(function (k) { return caches.delete(k); }));
      }));
    }
  } catch (e) {}
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      p.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
        return Promise.all(rs.map(function (r) { return r.update().catch(function () {}); }));
      }));
    }
  } catch (e) {}
  return Promise.all(p).catch(function () {});
}

/* --------------------------------------------------- verificação ao arrancar */

// Uma recarga por versão-alvo. Se depois de recarregar continuar velha, o
// problema não é a cache — e um ciclo de recargas seria pior do que o atraso.
function jaRecarreguei(alvo) {
  try { return Number(sessionStorage.getItem(SS_RECARGA)) === alvo; } catch (e) { return true; }
}
function marcarRecarga(alvo) {
  try { sessionStorage.setItem(SS_RECARGA, String(alvo)); } catch (e) {}
}

function bannerAtualizar(v) {
  if (document.getElementById('cwUpdBar')) return;
  var el = document.createElement('div');
  el.id = 'cwUpdBar';
  el.className = 'card';
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + var(--inset-bottom));z-index:80;' +
    'display:flex;align-items:center;gap:11px;padding:11px 13px;box-shadow:var(--shadow)';
  el.innerHTML = '<span class="small" style="flex:1;min-width:0">Está disponível a versão ' + v + '.</span>' +
    '<button class="btn sm primary" style="flex:0 0 auto" onclick="CW.atualizarAgora()">Atualizar</button>' +
    '<button class="btn sm" style="flex:0 0 auto" onclick="this.parentNode.remove()">Depois</button>';
  document.body.appendChild(el);
}

CW.verificarVersao = function () {
  return fetch('/versao.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) return;
      if (Number(d.minima) > VERSAO) { gateAtualizar(Number(d.minima)); return; }
      if (!(Number(d.versao) > VERSAO)) return;
      // há versão nova: buscar sozinho e recarregar, uma vez
      if (jaRecarreguei(Number(d.versao))) { bannerAtualizar(Number(d.versao)); return; }
      marcarRecarga(Number(d.versao));
      return limparCaches().then(function () { location.reload(); });
    })
    .catch(function () { /* sem rede: fica com o que tem */ });
};

/* ------------------------------------------------- a secção nas definições */

function vNovidades() {
  var todas = AVISOS.map(avisoParaMim).filter(Boolean);
  if (!todas.length) return '<div class="hint">Ainda não há novidades que te digam respeito.</div>';
  CW._novAvisos = todas;
  return novHtml(todas);
}

var _vSettingsNov = vSettings;
vSettings = function () {
  if (setPage === 'novidades') return backRow + vNovidades();
  var h = _vSettingsNov();
  if (!setPage) {
    // entra ao lado do aviso legal, que é a outra coisa que se lê e não se mexe
    var novas = avisosDesde(vistoAte()).length;
    h = h.replace(
      navRow('Aviso legal', 'Termos, privacidade e demonstração', 'contract', 'legal'),
      navRow('Novidades', novas ? novas + ' por ler · versão ' + VERSAO : 'O que mudou · versão ' + VERSAO,
        'info', 'novidades') +
      '<div style="height:10px"></div>' +
      navRow('Aviso legal', 'Termos, privacidade e demonstração', 'contract', 'legal')
    );
  }
  return h;
};

/* ------------------------------------------------------------- o arranque */

/* As novidades entram na fila atrás dos avisos que já existem: primeiro o
   aviso de demonstração, depois os termos, e só com o ecrã livre é que se
   conta o que mudou. Três janelas empilhadas seriam pior do que nenhuma. */
function ecraLivre() {
  return !!CW.user &&
    !document.getElementById('cwLegal') &&
    !document.getElementById('cwTerms') &&
    !document.getElementById('cwUpd');
}

CW.talvezNovidades = function () {
  if (ecraLivre()) mostrarNovidadesSeHouver();
};

// quando um desses avisos se fecha, é a vez das novidades
['acceptLegal', 'acceptTerms'].forEach(function (nome) {
  var antes = CW[nome];
  if (typeof antes !== 'function') return;
  CW[nome] = function () {
    var r = antes.apply(this, arguments);
    setTimeout(CW.talvezNovidades, 80);
    return r;
  };
});

// A versão verifica-se sempre, com sessão ou sem ela: quem está preso no
// ecrã de entrada por causa de um erro já corrigido também precisa.
CW.verificarVersao();
setTimeout(CW.talvezNovidades, 500);
