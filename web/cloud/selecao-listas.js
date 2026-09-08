/* Selecionar vários — imóveis e contratos.
   ----------------------------------------
   O toque longo passou a ter UM significado na app inteira: selecionar
   vários. Nos movimentos já era assim; aqui ganha o mesmo comportamento
   para as duas listas onde apagar em massa faz sentido — e apagar um
   imóvel arrasta os contratos e movimentos dele, por isso a confirmação
   diz os números e o Anular repõe tudo.

   As opções de um cartão continuam no kebab. O toque longo deixa de abrir
   menus em qualquer lado: ou seleciona (onde há seleção) ou não faz nada. */

(function () {
  var TABS_SEL = { prop: 'properties', ct: 'contracts' };

  CW.selL = { tipo: null, ids: {} };

  CW.selLEntrar = function (tipo, id) {
    if (tab !== TABS_SEL[tipo]) return;
    CW.selL = { tipo: tipo, ids: {} };
    if (id) CW.selL.ids[id] = 1;
    render();
  };
  CW.selLSair = function () { CW.selL = { tipo: null, ids: {} }; render(); };
  CW.selLToggle = function (id) {
    if (CW.selL.ids[id]) delete CW.selL.ids[id]; else CW.selL.ids[id] = 1;
    pintar();
  };

  function nSel() { return Object.keys(CW.selL.ids).length; }

  /* O toque longo, redirecionado de vez: tx e listas entram em seleção,
     o resto não faz nada — as opções vivem no kebab. */
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
    if (ativo) decorar();
    return r;
  };

  function cartoes() {
    return [].slice.call(document.querySelectorAll('#view [data-lp^="' + CW.selL.tipo + ':"]'));
  }

  function caixa(on) {
    return '<span class="selck' + (on ? ' on' : '') + '">' + (on ? ic('check', 13) : '') + '</span>';
  }

  function decorar() {
    cartoes().forEach(function (c) {
      var id = c.getAttribute('data-lp').split(':')[1];
      if (!c.querySelector('.selbox')) {
        var b = document.createElement('span');
        b.className = 'selbox';
        b.setAttribute('data-selbox', id);
        var alvo = c.querySelector('.row-between') || c;
        alvo.insertBefore(b, alvo.firstChild);
      }
      c.setAttribute('data-toca', 'vista');
      c.setAttribute('onclick', 'CW.selLToggle(\'' + id + '\')');
    });
    if (!document.querySelector('.sel-fundo')) {
      var f = document.createElement('div');
      f.className = 'sel-fundo';
      f.innerHTML =
        '<button type="button" class="btn" data-toca="modo" onclick="CW.selLSair()">' + ic('x', 15) + ' Cancelar</button>' +
        '<b id="selLConta" style="flex:1;text-align:center"></b>' +
        '<button type="button" class="btn danger" data-toca="dados" data-risco="destroi" onclick="CW.selLApagar()">' + ic('trash', 15) + ' Eliminar</button>';
      document.body.appendChild(f);
    }
    pintar();
  }

  function pintar() {
    cartoes().forEach(function (c) {
      var id = c.getAttribute('data-lp').split(':')[1];
      var b = c.querySelector('[data-selbox]');
      if (b) b.innerHTML = caixa(!!CW.selL.ids[id]);
      c.classList.toggle('sel-on-card', !!CW.selL.ids[id]);
    });
    var n = nSel(), conta = document.getElementById('selLConta');
    if (conta) conta.textContent = n ? n + ' selecionado' + (n === 1 ? '' : 's') : 'toca nos cartões';
  }

  /* apagar em massa, com os números à vista e o Anular por baixo */
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
        btn.innerHTML = '<span class="ic" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);flex:0 0 34px">' + ic('check', 18) + '</span>' +
          '<span style="flex:1;min-width:0;text-align:left"><b style="display:block;font-size:14px">Selecionar vários</b></span>';
        btn.onclick = function () { closeAllModals(); CW.selLEntrar(tipo, id); };
        m.insertBefore(btn, m.children[1] || null);
      }, 60);
      return r;
    }
    return _lpMenu_sl(v);
  };

  var css = document.createElement('style');
  css.textContent =
    '.sel-on-card{border-color:var(--accent)!important;background:var(--tint)}' +
    '#view [data-selbox]{margin-right:10px}';
  document.head.appendChild(css);
})();
