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
/* os anexos que esta sessão já tratou — subiram, desceram do servidor, ou
   não estão neste aparelho para subir: o subirPendentes salta-os. Antes subia os primeiros vinte
   anexos da conta inteiros a cada sincronização, os mesmos sempre — e o que
   estava para lá do vigésimo nunca era revisto */
var anexosTratados = {};

/* As miniaturas na nuvem (files.js:handleMiniatura). A de 220px que este
   aparelho faz (componentes.js:miniaturaDoBlob, guardada como tn_<id>) sobe
   para /api/files/<id>/miniatura, e noutro aparelho o thumbSrc recebe-a de
   lá em vez de descarregar o original (o idbGet embrulhado, abaixo). Sobe
   depois do original — o servidor decide tudo pela linha dele —, e uma vez
   por sessão; quem a não pode escrever (um colaborador numa foto do dono)
   não volta a tentar. */
var miniaturasNaNuvem = {
  subidas: {},     // id -> 1: no servidor (subiu, desceu, ou recusada: não se tenta mais)
  subindo: {},     // PUT em curso
  aSeguir: {},     // id -> blob: chegou a meio de um PUT, vai a seguir
  porSubir: {},    // id -> 1: tentou e não chegou; o subirPendentes tenta de novo
  baixando: {},    // GET em curso: id -> promessa
  semNoServidor: {},   // o GET deu 404 nesta sessão: vai-se ao original sem perguntar outra vez
};

// O Authorization de quem tem sessão, para os pedidos dos anexos.
// Devolve: os cabeçalhos ({} sem token; o cookie vai na mesma).
function cabecalhosDaSessao() {
  var h = {};
  if (CW.user && CW.user.token) h['Authorization'] = 'Bearer ' + CW.user.token;
  return h;
}

// a que casa pertence um anexo, procurando quem o refere: as fotos e as
// hipotecas de um imóvel, os documentos de um contrato, e os de uma ficha de
// inquilino presa a um imóvel (nucleo.js:casaDaFicha) ou a um contrato dele
// Recebe: id — o id do anexo (o mesmo que o IndexedDB usa).
// Devolve: o id da casa que o refere, ou null quando ninguém o refere.
function casaDoAnexo(id) {
  var tem = function (l) { return (l || []).some(function (f) { return f && f.id === id; }); };
  var casa = null;
  (db.properties || []).some(function (p) {
    var seu = tem(p.photos) || (p.loans || []).some(function (l) { return tem(l.files); });
    if (seu) { casa = p.id; return true; }
    return false;
  });
  if (casa) return casa;
  (db.contracts || []).some(function (c) {
    if (tem(c.files)) { casa = c.propertyId; return true; }
    return false;
  });
  if (casa) return casa;
  (db.tenants || []).some(function (t) {
    if (!tem(t.files)) return false;
    casa = (typeof casaDaFicha === 'function' && casaDaFicha(t)) || null;
    if (!casa) {
      var c = (db.contracts || []).find(function (k) { return (k.tenantIds || []).indexOf(t.id) > -1; });
      casa = (c && c.propertyId) || null;
    }
    return true;
  });
  // uma ficha presa a um imóvel que já saiu (apagado: a ficha fica) sobe solta, como antes
  var viva = casa && (db.properties || []).some(function (p) { return p.id === casa; });
  return viva ? casa : null;
}

/* Sobe um anexo para o servidor (PUT /api/files/:id), a indicar a casa a que pertence
   para quem recebe a partilha o poder ler. Ignora miniaturas e uploads já em curso.
   Sem rede fica tudo local e tenta-se de novo na próxima sincronização; uma recusa do
   servidor (grande de mais, sem permissão) avisa por toast, mas só uma vez por sessão.
   Uma foto começa a subir mal é escolhida (anexos.js:takeFiles), antes de o
   registo a referir: sobe sem casa, com o nome do ficheiro. Se, quando acaba,
   o registo já está gravado (casaDoAnexo encontra-o), pode ter chegado ao
   servidor antes dela e não a ter prendido — o prenderAnexo prende-a, sem a
   mandar outra vez. Depois do original sobe a miniatura (subirMiniatura).
   Recebe: id — o id do anexo; blob — o conteúdo, como Blob (o tipo MIME segue
   no cabeçalho).
   Devolve: nada — o PUT segue em fundo. */
function subirAnexo(id, blob) {
  if (!CW.user || subindo[id] || String(id).indexOf('tn_') === 0) return;
  subindo[id] = 1;
  var meta = (typeof allFileMetas === 'function' ? allFileMetas() : [])
    .find(function (f) { return f.id === id; }) || {};
  var casa = casaDoAnexo(id);
  var h = cabecalhosDaSessao();
  h['X-Ficheiro-Tipo'] = blob.type || 'application/octet-stream';
  // acabada de escolher ainda não há meta: o nome do ficheiro (o File traz-o)
  h['X-Ficheiro-Nome'] = encodeURIComponent(meta.name || blob.name || '');
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
    if (!r || !r.ok) return;
    anexosTratados[id] = 1;
    if (!casa) { var agora = casaDoAnexo(id); if (agora) prenderAnexo(id, agora); }
    subirMiniatura(id);
  }).catch(function () { delete subindo[id]; });   // sem rede: fica local; sobe na próxima
}

/* O anexo subiu sem casa e o registo que o refere já está gravado: pede ao
   servidor para o prender a esse registo (files.js:handlePrender), com o nome
   que tem lá. Se a gravação ainda não tiver chegado, não há nada a prender e
   é ela que o prende quando chegar (files.js:linkFiles).
   Recebe: id — o id do anexo; casa — o id da casa que o refere.
   Devolve: nada — o pedido segue em fundo; uma falha engole-se (a próxima
   gravação do registo prende-o na mesma). */
function prenderAnexo(id, casa) {
  var meta = (typeof allFileMetas === 'function' ? allFileMetas() : [])
    .find(function (f) { return f.id === id; }) || {};
  var h = cabecalhosDaSessao();
  if (meta.name) h['X-Ficheiro-Nome'] = encodeURIComponent(meta.name);
  fetch('/api/files/' + encodeURIComponent(id) + '/prender?casa=' + encodeURIComponent(casa), {
    method: 'POST', headers: h, credentials: 'same-origin',
  }).catch(function () {});
}

/* Sobe a miniatura de uma foto (PUT /api/files/:id/miniatura), uma vez por
   sessão. Espera pelo original: com ele a subir, é o fim dele que a chama
   (subirAnexo); um 404 (o original ainda não chegou ao servidor) deixa-a para
   quando ele subir. Uma recusa (403: não é dele nem da casa dele; 400/413/415)
   não se repete. Uma miniatura que chega enquanto outra tentativa corre (o
   fim do original a ler o tn_ que ainda não estava guardado) fica para logo
   a seguir, em vez de se perder; uma que não chegou (sem rede, 429, 5xx, o
   original ainda por subir) fica em porSubir, e o subirPendentes volta a
   tentá-la depois da sincronização seguinte.
   Recebe: id — o id da foto (o original); tb (opcional) — o blob da
   miniatura; sem ele lê-se o tn_<id> deste aparelho.
   Devolve: nada — o PUT segue em fundo. */
function subirMiniatura(id, tb) {
  var mn = miniaturasNaNuvem;
  if (!CW.user || subindo[id] || mn.subidas[id]) return;
  if (mn.subindo[id]) { if (tb) mn.aSeguir[id] = tb; return; }
  mn.subindo[id] = 1;
  mn.porSubir[id] = 1;
  var fim = function () {
    delete mn.subindo[id];
    var seg = mn.aSeguir[id]; delete mn.aSeguir[id];
    if (seg && !mn.subidas[id]) subirMiniatura(id, seg);
  };
  (tb ? Promise.resolve(tb) : _idbGet('tn_' + id)).then(function (b) {
    if (!b) { delete mn.porSubir[id]; return fim(); }
    var h = cabecalhosDaSessao();
    h['X-Ficheiro-Tipo'] = b.type || 'image/jpeg';
    return fetch('/api/files/' + encodeURIComponent(id) + '/miniatura', {
      method: 'PUT', headers: h, body: b, credentials: 'same-origin',
    }).then(function (r) {
      // 404: o original ainda não está lá (sobe com ele); 429 e 5xx: na próxima
      if (r.ok || (r.status !== 404 && r.status !== 429 && r.status < 500)) { mn.subidas[id] = 1; delete mn.porSubir[id]; }
      if (r.ok) delete mn.semNoServidor[id];
      fim();
    });
  }).catch(fim);   // sem rede: sobe com o original, na próxima
}

/* Vai buscar ao servidor a miniatura de uma foto que este aparelho não tem
   (GET /api/files/:id/miniatura) e guarda-a como tn_<id>, sem a voltar a
   subir. Sem ela no servidor (as fotos de antes, ou um colaborador que não a
   pôde subir) dá null, e o thumbSrc cai no original, como antes; o 404
   fica lembrado na sessão.
   Recebe: id — o id da foto (o original).
   Devolve: promessa do Blob da miniatura, ou de null. */
function baixarMiniatura(id) {
  if (!CW.user || miniaturasNaNuvem.semNoServidor[id]) return Promise.resolve(null);
  if (miniaturasNaNuvem.baixando[id]) return miniaturasNaNuvem.baixando[id];
  miniaturasNaNuvem.baixando[id] = fetch('/api/files/' + encodeURIComponent(id) + '/miniatura', {
    headers: cabecalhosDaSessao(), credentials: 'same-origin',
  }).then(function (r) {
    if (r.status === 404) miniaturasNaNuvem.semNoServidor[id] = 1;
    return r.ok ? r.blob() : null;
  }).then(function (b) {
    delete miniaturasNaNuvem.baixando[id];
    if (b && b.size) { miniaturasNaNuvem.subidas[id] = 1; _idbPut('tn_' + id, b); return b; }
    return null;
  }).catch(function () { delete miniaturasNaNuvem.baixando[id]; return null; });
  return miniaturasNaNuvem.baixando[id];
}

// Vai buscar ao servidor um anexo que falta neste aparelho; guarda-o no IndexedDB para
// a próxima vez e devolve o blob — ou null sem sessão, sem rede ou sem o ficheiro lá.
// Recebe: id — o id do anexo que falta.
// Devolve: promessa do Blob — ou de null sem sessão, sem rede ou sem o
// ficheiro no servidor.
function baixarAnexo(id) {
  if (!CW.user) return Promise.resolve(null);
  if (baixando[id]) return baixando[id];
  baixando[id] = fetch('/api/files/' + encodeURIComponent(id), { headers: cabecalhosDaSessao(), credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.blob() : null; })
    .then(function (b) {
      delete baixando[id];
      if (b) { anexosTratados[id] = 1; _idbPut(id, b); }   // guarda para a próxima vez (e não o volta a subir)
      return b;
    })
    .catch(function () { delete baixando[id]; return null; });
  return baixando[id];
}

var _idbPut = idbPut, _idbGet = idbGet, _idbDel = idbDel;

/* Guardar no aparelho é também subir: o anexo para /api/files/:id, a
   miniatura (tn_<id>) para /api/files/:id/miniatura. */
idbPut = function (id, blob) {
  return _idbPut(id, blob).then(function (r) {
    var s = String(id);
    try { if (s.indexOf('tn_') === 0) subirMiniatura(s.slice(3), blob); else subirAnexo(id, blob); } catch (e) {}
    return r;
  });
};

/* O que falta no aparelho vem do servidor: a miniatura de uma foto primeiro
   (baixarMiniatura) — e, sem ela lá, o thumbSrc pede o original a seguir —,
   qualquer outro anexo inteiro (baixarAnexo). */
idbGet = function (id) {
  return _idbGet(id).then(function (b) {
    if (b) return b;
    var s = String(id);
    if (s.indexOf('tn_') === 0) return baixarMiniatura(s.slice(3));
    return baixarAnexo(id);
  });
};

/* Apagar um anexo é apagá-lo também no servidor; a miniatura dele sai lá com
   ele (files.js:handleFiles), por isso o tn_ só sai daqui. */
idbDel = function (id) {
  if (CW.user && String(id).indexOf('tn_') !== 0) {
    fetch('/api/files/' + encodeURIComponent(id), { method: 'DELETE', headers: cabecalhosDaSessao(), credentials: 'same-origin' })
      .catch(function () {});
  }
  return _idbDel(id);
};

// Depois de sincronizar, sobe o que ainda só existe neste aparelho: os anexos
// que esta sessão ainda não tratou (anexosTratados), vinte de
// cada vez — a sincronização seguinte trata dos vinte seguintes —, e as
// miniaturas que tentaram subir e não chegaram (miniaturasNaNuvem.porSubir).
// Devolve: nada — dispara os uploads (até 20 de cada vez) em fundo.
function subirPendentes() {
  if (!CW.user) return;
  var metas = (typeof allFileMetas === 'function' ? allFileMetas() : []);
  metas.filter(function (m) { return !anexosTratados[m.id] && !subindo[m.id]; }).slice(0, 20).forEach(function (m) {
    _idbGet(m.id).then(function (b) { if (b) subirAnexo(m.id, b); else anexosTratados[m.id] = 1; });
  });
  Object.keys(miniaturasNaNuvem.porSubir).slice(0, 20).forEach(function (id) { subirMiniatura(id); });
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
