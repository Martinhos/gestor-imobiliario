/* Anexos: sobem para o servidor e voltam de la quando faltam no aparelho. */
'use strict';

/* ---------------------------------------------------------------------
   Anexos na nuvem. O armazenamento local continua a ser a primeira
   paragem — é o que faz a app abrir depressa e funcionar sem rede — mas
   tudo o que entra sobe também para o servidor, e o que falta localmente
   é buscado de lá. É assim que uma foto carregada no telemóvel aparece
   no computador, e que quem recebe uma casa partilhada vê os documentos.
   --------------------------------------------------------------------- */

var subindo = {};      // uploads em curso, para não repetir
var baixando = {};     // downloads em curso, para não pedir duas vezes

// a que casa pertence um anexo, procurando quem o refere
function casaDoAnexo(id) {
  var casa = null;
  (db.properties || []).some(function (p) {
    var seu = (p.photos || []).some(function (f) { return f.id === id; }) ||
      (p.loans || []).some(function (l) { return (l.files || []).some(function (f) { return f.id === id; }); });
    if (seu) { casa = p.id; return true; }
    return false;
  });
  if (casa) return casa;
  (db.contracts || []).some(function (c) {
    if ((c.files || []).some(function (f) { return f.id === id; })) { casa = c.propertyId; return true; }
    return false;
  });
  return casa;
}

function subirAnexo(id, blob) {
  if (!CW.user || subindo[id] || String(id).indexOf('tn_') === 0) return;
  subindo[id] = 1;
  var meta = (typeof allFileMetas === 'function' ? allFileMetas() : [])
    .find(function (f) { return f.id === id; }) || {};
  var casa = casaDoAnexo(id);
  var h = {
    'X-Ficheiro-Tipo': blob.type || 'application/octet-stream',
    'X-Ficheiro-Nome': encodeURIComponent(meta.name || ''),
  };
  if (CW.user.token) h['Authorization'] = 'Bearer ' + CW.user.token;
  fetch('/api/files/' + encodeURIComponent(id) + (casa ? '?casa=' + encodeURIComponent(casa) : ''), {
    method: 'PUT', headers: h, body: blob, credentials: 'same-origin',
  }).then(function () { delete subindo[id]; })
    .catch(function () { delete subindo[id]; });   // fica local; sobe na próxima
}

function baixarAnexo(id) {
  if (!CW.user) return Promise.resolve(null);
  if (baixando[id]) return baixando[id];
  var h = {};
  if (CW.user.token) h['Authorization'] = 'Bearer ' + CW.user.token;
  baixando[id] = fetch('/api/files/' + encodeURIComponent(id), { headers: h, credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.blob() : null; })
    .then(function (b) {
      delete baixando[id];
      if (b) _idbPut(id, b);   // guarda para a próxima vez
      return b;
    })
    .catch(function () { delete baixando[id]; return null; });
  return baixando[id];
}

var _idbPut = idbPut, _idbGet = idbGet, _idbDel = idbDel;

idbPut = function (id, blob) {
  return _idbPut(id, blob).then(function (r) {
    try { subirAnexo(id, blob); } catch (e) {}
    return r;
  });
};

idbGet = function (id) {
  return _idbGet(id).then(function (b) {
    if (b) return b;
    if (String(id).indexOf('tn_') === 0) return b;   // miniaturas refazem-se
    return baixarAnexo(id);
  });
};

idbDel = function (id) {
  if (CW.user && String(id).indexOf('tn_') !== 0) {
    var h = {};
    if (CW.user.token) h['Authorization'] = 'Bearer ' + CW.user.token;
    fetch('/api/files/' + encodeURIComponent(id), { method: 'DELETE', headers: h, credentials: 'same-origin' })
      .catch(function () {});
  }
  return _idbDel(id);
};

// Depois de sincronizar, sobe o que ainda só existe neste aparelho.
function subirPendentes() {
  if (!CW.user) return;
  var metas = (typeof allFileMetas === 'function' ? allFileMetas() : []);
  metas.slice(0, 20).forEach(function (m) {
    if (subindo[m.id]) return;
    _idbGet(m.id).then(function (b) { if (b) subirAnexo(m.id, b); });
  });
}

var _save = save;
save = function () {
  dropUnsafe(db);
  _save();
  schedulePush();
  // um contrato ou hipoteca que já vem de trás deixa meses por registar
  clearTimeout(save._est);
  save._est = setTimeout(function () { try { offerFill(); } catch (e) {} }, 700);
};

var _render = render;
render = function () {
  _render();
  try { decorateShared(); } catch (e) {}
  try { decoratePending(); } catch (e) {}
  try {
    if (CW.editMode && tab === 'dashboard') { view().classList.add('cw-edit'); editBar(); }
    patchHdr();
  } catch (e) {}
};

function decorateShared() {
  (db.properties || []).forEach(function (p) {
    if (!p._sharedFrom) return;
    var cards = document.querySelectorAll('[data-lp="prop:' + p.id + '"] .title');
    [].slice.call(cards).forEach(function (el) {
      if (el.querySelector('.cw-shared')) return;
      var b = document.createElement('span');
      b.className = 'badge grey cw-shared';
      b.style.marginLeft = '7px';
      b.textContent = 'de ' + p._sharedFrom;
      b.title = 'Casa partilhada por ' + p._sharedFrom;
      el.appendChild(b);
    });
  });
}

// Na web "Abrir cópia" deve abrir o seletor de ficheiros (o original só
// tinha o picker nativo do Android e caía para "colar texto" no browser).
var _driveOpen = driveOpen;
driveOpen = function () {
  if (window.Android && window.Android.openFile) return _driveOpen();
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,.csv,application/json,text/csv';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = function () {
    var f = inp.files && inp.files[0];
    inp.remove();
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { window.__fileLoaded(f.name, String(r.result)); };
    r.onerror = function () { toast('Não foi possível ler o ficheiro.'); };
    r.readAsText(f, 'utf-8');
  };
  inp.click();
};

// Mudar de página no menu deve fechar qualquer modal aberto (imóvel,
// movimento, ...) em vez de o deixar por cima da página nova.
var _go = go;
go = function (id) {
  try { if (modalStack.length) closeAllModals(); } catch (e) {}
  try { if (CW.editMode && id !== 'dashboard') CW.exitEdit(true); } catch (e) {}
  // a barra de regresso só faz sentido enquanto se está nos Movimentos
  if (id !== 'transactions') CW._fromKpi = null;
  _go(id);
  rememberPage();
};

// recarregar a página devolve o utilizador ao sítio onde estava
var LS_PAGE = 'gi_page';
function rememberPage() {
  try { localStorage.setItem(LS_PAGE, JSON.stringify({ tab: tab, set: setPage || '' })); } catch (e) {}
}
var _goSet = goSet;
goSet = function (p) { _goSet(p); rememberPage(); };

function restorePage() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem(LS_PAGE) || 'null'); } catch (e) {}
  if (!s || !s.tab || s.tab === 'dashboard' && !s.set) return;
  if (!TABS.some(function (t) { return t.id === s.tab; })) return;
  tab = s.tab;
  setPage = s.tab === 'settings' ? (s.set || '') : '';
  buildNav(); render();
}

var _delProp = delProp;
delProp = function (id) {
  var p = (db.properties || []).find(function (x) { return x.id === id; });
  if (p && p._sharedFrom) return toast('Esta casa é de ' + p._sharedFrom + ' — só o dono a pode apagar.');
  _delProp(id);
};
