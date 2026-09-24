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
// Recebe: id — o id do anexo (o mesmo que o IndexedDB usa).
// Devolve: o id da casa que o refere, ou null quando ninguém o refere.
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

/* Sobe um anexo para o servidor (PUT /api/files/:id), a indicar a casa a que pertence
   para quem recebe a partilha o poder ler. Ignora miniaturas e uploads já em curso.
   Sem rede fica tudo local e tenta-se de novo na próxima sincronização; uma recusa do
   servidor (grande de mais, sem permissão) avisa por toast, mas só uma vez por sessão.
   Recebe: id — o id do anexo; blob — o conteúdo, como Blob (o tipo MIME segue
   no cabeçalho).
   Devolve: nada — o PUT segue em fundo. */
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
  }).then(function (r) {
    delete subindo[id];
    /* o PUT podia falhar com resposta (grande de mais, sem permissão) e
       ninguém sabia: parecia anexado, nunca chegava ao outro aparelho */
    if (r && !r.ok && !subirAnexo._avisado) {
      subirAnexo._avisado = 1;
      try { toast('Um anexo não subiu (' + (meta.name || 'ficheiro') + '). Fica neste aparelho; tentamos de novo.'); } catch (e) {}
    }
  }).catch(function () { delete subindo[id]; });   // sem rede: fica local; sobe na próxima
}

// Vai buscar ao servidor um anexo que falta neste aparelho; guarda-o no IndexedDB para
// a próxima vez e devolve o blob — ou null sem sessão, sem rede ou sem o ficheiro lá.
// Recebe: id — o id do anexo que falta.
// Devolve: promessa do Blob — ou de null sem sessão, sem rede ou sem o
// ficheiro no servidor.
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
// Devolve: nada — dispara os uploads (até 20 de cada vez) em fundo.
function subirPendentes() {
  if (!CW.user) return;
  var metas = (typeof allFileMetas === 'function' ? allFileMetas() : []);
  metas.slice(0, 20).forEach(function (m) {
    if (subindo[m.id]) return;
    _idbGet(m.id).then(function (b) { if (b) subirAnexo(m.id, b); });
  });
}

// Os embrulhos de save, render, go e goSet — os que ligam a base à
// sincronização — vivem em cloud/nucleo.js, com ela.

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

// A guarda de «só o dono apaga o imóvel» vive agora em web/app/imovel.js
// (delProp com souDono): o embrulho que aqui havia saiu, para não haver duas.
