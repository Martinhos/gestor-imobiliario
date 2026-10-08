/* Selecionar vários — imóveis e contratos.
   ----------------------------------------
   O toque longo passou a ter UM significado na app inteira: selecionar
   vários. Nos movimentos já era assim; aqui ganha o mesmo comportamento
   para as duas listas onde apagar em massa faz sentido — e apagar um
   imóvel arrasta os contratos e movimentos dele, por isso a confirmação
   diz os números e o Anular repõe tudo.

   As opções de um cartão continuam no kebab. O toque longo deixa de abrir
   menus em qualquer lado: ou seleciona (onde há seleção) ou não faz nada.

   Vive no âmbito global, como os outros ficheiros da camada, com o
   comentário de interface em cada função: dentro de um IIFE, nem o gerador
   dos docs nem a CI as viam. A caixa de marcar é a de selecao.js. */
'use strict';

var TABS_SEL = { prop: 'properties', ct: 'contracts' };   // o tipo do cartão → o separador onde há seleção

CW.selL = { tipo: null, ids: {} };

// Entra na seleção de vários cartões de um tipo, com o tocado já marcado.
// Recebe: tipo — 'prop' ou 'ct'; id (opcional) — o id do cartão tocado.
// Devolve: nada — marca e repinta (ou nada, fora do separador desse tipo).
CW.selLEntrar = function (tipo, id) {
  if (tab !== TABS_SEL[tipo]) return;
  CW.selL = { tipo: tipo, ids: {} };
  if (id) CW.selL.ids[id] = 1;
  render();
};
// Sai da seleção de vários.
// Devolve: nada — esquece o que estava marcado e repinta.
CW.selLSair = function () { CW.selL = { tipo: null, ids: {} }; render(); };
// Marca ou desmarca um cartão.
// Recebe: id — o id do cartão.
// Devolve: nada — repinta as caixas e a contagem.
CW.selLToggle = function (id) {
  if (CW.selL.ids[id]) delete CW.selL.ids[id]; else CW.selL.ids[id] = 1;
  selLPintar();
};

// Quantos cartões estão marcados.
// Devolve: o número.
function selLN() { return Object.keys(CW.selL.ids).length; }

/* O toque longo, redirecionado de vez: tx e listas entram em seleção,
   o resto não faz nada — as opções vivem no kebab.
   Recebe: v — o data-lp tocado ('tx:<id>', 'prop:<id>', 'ct:<id>', …).
   Devolve: nada — entra em seleção onde a há. */
window.lpLongo = function (v) {
  var a = String(v || '').split(':');
  if (a[0] === 'tx' && tab === 'transactions' && CW.selEntrar) return CW.selEntrar(a[1]);
  if (TABS_SEL[a[0]]) return CW.selLEntrar(a[0], a[1]);
};

/* depois de cada render, decora os cartões e põe a barra de baixo */
var _render_sl = render;
render = function () {
  var r = _render_sl.apply(this, arguments);
  var ativo = CW.selL.tipo && tab === TABS_SEL[CW.selL.tipo];
  if (CW.selL.tipo && !ativo) CW.selL = { tipo: null, ids: {} };   // mudou de ecrã: sai
  var algum = !!ativo || (CW.selMode && tab === 'transactions');
  document.body.classList.toggle('sel-on', algum);
  if (!algum) {
    var f = document.querySelector('.sel-fundo');
    if (f) f.remove();
  }
  if (ativo) selLDecorar();
  return r;
};

// Os cartões do tipo em seleção que estão na vista.
// Devolve: array de elementos com data-lp «<tipo>:<id>».
function selLCartoes() {
  return [].slice.call(document.querySelectorAll('#view [data-lp^="' + CW.selL.tipo + ':"]'));
}

// Põe a caixa em cada cartão (um toque passa a marcar) e a barra de baixo,
// com Cancelar, a contagem e Eliminar.
// Devolve: nada — mexe no DOM já desenhado.
function selLDecorar() {
  selLCartoes().forEach(function (c) {
    var id = c.getAttribute('data-lp').split(':')[1];
    if (!c.querySelector('.selbox')) {
      var b = document.createElement('span');
      b.className = 'selbox';
      b.setAttribute('data-selbox', id);
      var alvo = c.querySelector('.row-between') || c;
      alvo.insertBefore(b, alvo.firstChild);
    }
    c.setAttribute('data-toca', 'vista');
    c.setAttribute('data-click', 'CW.selLToggle(\'' + jsqBruto(id) + '\')');
  });
  if (!document.querySelector('.sel-fundo')) {
    var f = document.createElement('div');
    f.className = 'sel-fundo';
    f.innerHTML =
      '<button type="button" class="btn" data-toca="modo" data-click="CW.selLSair()">' + ic('x', 15) + ' Cancelar</button>' +
      '<b id="selLConta" class="u-fx-1 u-ta-center"></b>' +
      '<button type="button" class="btn danger" data-toca="dados" data-risco="destroi" data-click="CW.selLApagar()">' + ic('trash', 15) + ' Eliminar</button>';
    document.body.appendChild(f);
  }
  selLPintar();
}

// Pinta as caixas (a de selecao.js) e a contagem conforme o que está marcado.
// Devolve: nada — mexe no DOM já desenhado.
function selLPintar() {
  selLCartoes().forEach(function (c) {
    var id = c.getAttribute('data-lp').split(':')[1];
    var b = c.querySelector('[data-selbox]');
    if (b) b.innerHTML = caixa(!!CW.selL.ids[id]);
    c.classList.toggle('sel-on-card', !!CW.selL.ids[id]);
  });
  var n = selLN(), conta = document.getElementById('selLConta');
  if (conta) conta.textContent = n ? n + ' selecionado' + (n === 1 ? '' : 's') : 'toca nos cartões';
}

/* Apagar em massa, com os números à vista e o Anular por baixo: um imóvel
   arrasta os contratos e os movimentos dele; um contrato deixa os movimentos,
   só desligados.
   Devolve: nada — pede confirmação; só depois apaga e oferece o Anular. */
CW.selLApagar = function () {
  var ids = Object.keys(CW.selL.ids);
  if (!ids.length) return toast('Não está nada selecionado.');
  var tipo = CW.selL.tipo;

  if (tipo === 'prop') {
    var cts = db.contracts.filter(function (c) { return ids.indexOf(c.propertyId) > -1; });
    var txs = db.transactions.filter(function (t) { return ids.indexOf(t.propertyId) > -1; });
    confirmModal('Apagar ' + ids.length + (ids.length === 1 ? ' imóvel' : ' imóveis'),
      'Vão junto ' + cts.length + ' contrato(s) e ' + txs.length + ' movimento(s).',
      function () {
        var copia = {
          ps: JSON.parse(JSON.stringify(db.properties.filter(function (p) { return ids.indexOf(p.id) > -1; }))),
          cts: JSON.parse(JSON.stringify(cts)),
          txs: JSON.parse(JSON.stringify(txs)),
        };
        db.properties = db.properties.filter(function (p) { return ids.indexOf(p.id) < 0; });
        db.contracts = db.contracts.filter(function (c) { return ids.indexOf(c.propertyId) < 0; });
        db.transactions = db.transactions.filter(function (t) { return ids.indexOf(t.propertyId) < 0; });
        if (ids.indexOf(dashProp) > -1) dashProp = '';
        if (ids.indexOf(txProp) > -1) txProp = '';
        save(); CW.selLSair(); buildNav();
        comDesfazer(ids.length + (ids.length === 1 ? ' imóvel apagado.' : ' imóveis apagados.'), function () {
          db.properties = db.properties.concat(copia.ps);
          db.contracts = db.contracts.concat(copia.cts);
          db.transactions = db.transactions.concat(copia.txs);
        }, function () {
          copia.ps.forEach(function (p) {
            (p.photos || []).forEach(function (f) { idbDel(f.id).catch(function () {}); idbDel('tn_' + f.id).catch(function () {}); });
            (p.loans || []).forEach(function (l) { (l.files || []).forEach(function (f) { idbDel(f.id).catch(function () {}); }); });
          });
        });
      });
    return;
  }

  // contratos: os movimentos ficam, só se desligam
  var recs = (db.recurring || []).filter(function (r) { return r.auto && r.tx && ids.indexOf(r.tx.contractId) > -1; });
  confirmModal('Apagar ' + ids.length + (ids.length === 1 ? ' contrato' : ' contratos'),
    'Os movimentos ficam, mas deixam de estar ligados a eles.',
    function () {
      var copia = {
        cs: JSON.parse(JSON.stringify(db.contracts.filter(function (c) { return ids.indexOf(c.id) > -1; }))),
        recs: JSON.parse(JSON.stringify(recs)),
        ligados: db.transactions.filter(function (t) { return ids.indexOf(t.contractId) > -1; })
          .map(function (t) { return { id: t.id, ct: t.contractId }; }),
      };
      db.contracts = db.contracts.filter(function (c) { return ids.indexOf(c.id) < 0; });
      db.recurring = (db.recurring || []).filter(function (r) { return !(r.auto && r.tx && ids.indexOf(r.tx.contractId) > -1); });
      db.transactions.forEach(function (t) { if (ids.indexOf(t.contractId) > -1) t.contractId = null; });
      save(); CW.selLSair(); buildNav();
      comDesfazer(ids.length + (ids.length === 1 ? ' contrato apagado.' : ' contratos apagados.'), function () {
        db.contracts = db.contracts.concat(copia.cs);
        db.recurring = (db.recurring || []).concat(copia.recs);
        copia.ligados.forEach(function (x) {
          var t = db.transactions.find(function (y) { return y.id === x.id; });
          if (t) t.contractId = x.ct;
        });
      }, function () {
        copia.cs.forEach(function (c) { (c.files || []).forEach(function (f) { idbDel(f.id).catch(function () {}); }); });
      });
    });
};

// o kebab dos cartões ganha a mesma porta que os movimentos já tinham
var _lpMenu_sl = lpMenu;
lpMenu = function (v) {
  var a = String(v || '').split(':');
  if (TABS_SEL[a[0]] && tab === TABS_SEL[a[0]] && !CW.selL.tipo) {
    // injeta "Selecionar vários" nas opções do kebab: mesma lista, mais uma
    var tipo = a[0], id = a[1];
    var r = _lpMenu_sl(v);
    setTimeout(function () {
      var m = document.querySelector('.modal.open .body .list');
      if (!m || m.querySelector('[data-sel-varios]')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card tap';
      btn.setAttribute('data-sel-varios', '1');
      btn.setAttribute('data-toca', 'modo');
      btn.style.cssText = 'padding:12px 14px;display:flex;align-items:center;gap:11px';
      btn.innerHTML = '<span class="ic u-w-34px u-h-34px u-br-10px u-d-grid u-pi-center u-bg-v-accent-soft u-c-v-accent u-fx-0-0-34px">' + ic('check', 18) + '</span>' +
        '<span class="u-fx-1 u-minw-0 u-ta-left"><b class="u-d-block u-fs-14px">Selecionar vários</b></span>';
      btn.onclick = function () { closeAllModals(); CW.selLEntrar(tipo, id); };
      m.insertBefore(btn, m.children[1] || null);
    }, 60);
    return r;
  }
  return _lpMenu_sl(v);
};

/* A folha dos cartões marcados era feita aqui, num elemento de folha criado
   por JavaScript e pendurado na cabeça do documento. Isso é CSS em linha, que
   a CSP sem 'unsafe-inline' recusa tal como recusa um atributo de estilo, por
   isso as duas regras passaram para o web/estilos.css, na secção
   «g12-novidades» das classes dos módulos — tal e qual. */
