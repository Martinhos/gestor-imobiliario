/* =====================================================================
   Camada "nuvem" do Gestor Imobiliário.

   Carregada depois do script principal (mesmo escopo global): embrulha
   save()/render()/vSettings() para sincronizar os dados com a API do
   worker (Cloudflare D1) e acrescenta início de sessão, conexões entre
   utilizadores e partilha de casas.

   Modelo de sincronização:
   - cada casa (imóvel) é uma entidade no servidor; contratos, movimentos,
     recorrentes e pessoas referenciadas viajam como registos dessa casa —
     é isso que permite partilhar uma casa com outro utilizador;
   - o resto (movimentos sem imóvel, modelos, grupos, pessoas, definições)
     fica em registos do próprio utilizador;
   - em cada gravação calcula-se a diferença face ao último estado enviado
     (snapshot) e envia-se em lote para /api/sync; ao puxar, o estado do
     servidor reconstrói a db local. Última escrita ganha.
   ===================================================================== */
(function () {
  'use strict';

  var LS_USER = 'gi_cloud_user';   // sessão {id,name,email,token}
  var LS_OWNER = 'gi_cloud_owner'; // id do utilizador dono da cache local
  var PULL_MS = 90000;

  var CW = (window.CW = {});
  CW.user = null;
  CW.state = { connections: [] };

  try { CW.user = JSON.parse(localStorage.getItem(LS_USER) || 'null'); } catch (e) {}

  var snap = {};
  var snapKey = function () { return 'gi_cloud_snap_' + (CW.user ? CW.user.id : ''); };
  function loadSnap() { try { snap = JSON.parse(localStorage.getItem(snapKey()) || '{}'); } catch (e) { snap = {}; } }
  function saveSnap() { try { localStorage.setItem(snapKey(), JSON.stringify(snap)); } catch (e) {} }

  /* ---------------- API ---------------- */

  function api(method, path, data) {
    var opts = { method: method, headers: {}, credentials: 'same-origin' };
    if (CW.user && CW.user.token) opts.headers['Authorization'] = 'Bearer ' + CW.user.token;
    if (data !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && CW.user && path.indexOf('/api/auth/') !== 0) {
          sessionLost();
        }
        if (!r.ok) { var e = new Error(j.error || ('Erro ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  function sessionLost() {
    CW.user = null;
    try { localStorage.removeItem(LS_USER); } catch (e) {}
    showAuth('A sessão expirou — inicia sessão de novo.');
  }

  /* ---------------- exportação: db -> entidades do servidor ------------- */

  function strip(o) {
    var c = JSON.parse(JSON.stringify(o));
    Object.keys(c).forEach(function (k) { if (k.charAt(0) === '_') delete c[k]; });
    return c;
  }

  // Mapa completo do que este utilizador deve ter no servidor.
  // chave -> {scope, houseId?, kind?, id?, data}
  function exportEntities() {
    var map = {};
    var owners = db.owners || [], tenants = db.tenants || [];
    (db.properties || []).forEach(function (p) {
      map['h:' + p.id] = { scope: 'house', houseId: p.id, data: strip(p) };
      var persons = {};
      (p.ownerIds || []).forEach(function (oid) {
        var o = owners.find(function (x) { return x.id === oid; });
        if (o) persons['owner:' + oid] = o;
      });
      (db.contracts || []).forEach(function (c) {
        if (c.propertyId !== p.id) return;
        map['r:' + p.id + ':contract:' + c.id] = { scope: 'record', houseId: p.id, kind: 'contract', id: c.id, data: strip(c) };
        (c.tenantIds || []).forEach(function (tid) {
          var t = tenants.find(function (x) { return x.id === tid; });
          if (t) persons['tenant:' + tid] = t;
        });
      });
      (db.transactions || []).forEach(function (t) {
        if (t.propertyId !== p.id) return;
        map['r:' + p.id + ':tx:' + t.id] = { scope: 'record', houseId: p.id, kind: 'tx', id: t.id, data: strip(t) };
      });
      (db.recurring || []).forEach(function (r) {
        if (!(r.tx && r.tx.propertyId === p.id)) return;
        map['r:' + p.id + ':rec:' + r.id] = { scope: 'record', houseId: p.id, kind: 'rec', id: r.id, data: strip(r) };
      });
      Object.keys(persons).forEach(function (k) {
        var kind = k.split(':')[0], id = k.split(':')[1];
        map['r:' + p.id + ':' + kind + ':' + id] = { scope: 'record', houseId: p.id, kind: kind, id: id, data: strip(persons[k]) };
      });
    });
    (db.transactions || []).forEach(function (t) {
      if (t.propertyId) return;
      map['u:tx:' + t.id] = { scope: 'user', kind: 'tx', id: t.id, data: strip(t) };
    });
    (db.recurring || []).forEach(function (r) {
      if (r.tx && r.tx.propertyId) return;
      map['u:rec:' + r.id] = { scope: 'user', kind: 'rec', id: r.id, data: strip(r) };
    });
    (db.templates || []).forEach(function (x) { map['u:tpl:' + x.id] = { scope: 'user', kind: 'tpl', id: x.id, data: strip(x) }; });
    (db.groups || []).forEach(function (x) { map['u:group:' + x.id] = { scope: 'user', kind: 'group', id: x.id, data: strip(x) }; });
    owners.forEach(function (o) { if (!o._sharedFrom) map['u:owner:' + o.id] = { scope: 'user', kind: 'owner', id: o.id, data: strip(o) }; });
    tenants.forEach(function (t) { if (!t._sharedFrom) map['u:tenant:' + t.id] = { scope: 'user', kind: 'tenant', id: t.id, data: strip(t) }; });
    map['u:settings:main'] = { scope: 'user', kind: 'settings', id: 'main', data: strip(db.settings) };
    return map;
  }

  function parseKey(k) {
    var p = k.split(':');
    if (p[0] === 'h') return { scope: 'house', houseId: p[1] };
    if (p[0] === 'r') return { scope: 'record', houseId: p[1], kind: p[2], id: p.slice(3).join(':') };
    return { scope: 'user', kind: p[1], id: p.slice(2).join(':') };
  }

  /* ---------------- push ---------------- */

  var pushing = false, pushAgain = false, pushTimer = null;

  function schedulePush() {
    if (!CW.user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushNow(); }, 1200);
  }

  function pushNow() {
    if (!CW.user) return Promise.resolve();
    if (pushing) { pushAgain = true; return Promise.resolve(); }
    pushing = true;
    var map = exportEntities();
    var ops = [];
    // casas primeiro (os registos precisam da casa), remoções no fim
    Object.keys(map).forEach(function (k) {
      var j = JSON.stringify(map[k].data);
      if (snap[k] !== j) ops.push(Object.assign({ _key: k, _json: j, op: 'put' }, map[k]));
    });
    ops.sort(function (a, b) {
      var w = function (o) { return o.scope === 'house' ? 0 : 1; };
      return w(a) - w(b);
    });
    Object.keys(snap).forEach(function (k) {
      if (!(k in map)) ops.push(Object.assign({ _key: k, op: 'del' }, parseKey(k)));
    });
    if (!ops.length) { pushing = false; return Promise.resolve(); }

    var chain = Promise.resolve();
    for (var i = 0; i < ops.length; i += 200) {
      (function (chunk) {
        chain = chain.then(function () {
          return api('POST', '/api/sync', {
            ops: chunk.map(function (o) {
              return { op: o.op, scope: o.scope, houseId: o.houseId, kind: o.kind, id: o.id, data: o.data };
            }),
          }).then(function (res) {
            (res.results || []).forEach(function (r, idx) {
              var o = chunk[idx];
              if (!o) return;
              if (o.op === 'put' && r.ok) snap[o._key] = o._json;
              else if (o.op === 'del' && (r.ok || r.status === 403 || r.status === 404)) delete snap[o._key];
            });
          });
        });
      })(ops.slice(i, i + 200));
    }
    return chain
      .then(function () { saveSnap(); setSyncBadge('ok'); })
      .catch(function () { setSyncBadge('off'); })
      .then(function () {
        pushing = false;
        if (pushAgain) { pushAgain = false; schedulePush(); }
      });
  }

  /* ---------------- pull ---------------- */

  var lastPull = 0;

  function rebuildDb(st) {
    var d = JSON.parse(JSON.stringify(blank));
    var persons = { owner: {}, tenant: {} };
    (st.userRecords || []).forEach(function (r) {
      try {
        if (r.kind === 'settings') d.settings = Object.assign({}, blank.settings, r.data);
        else if (r.kind === 'tx') d.transactions.push(normTx(r.data));
        else if (r.kind === 'rec') d.recurring.push(normRec(r.data));
        else if (r.kind === 'tpl') d.templates.push(normTpl(r.data));
        else if (r.kind === 'group') d.groups.push(normGroup(r.data));
        else if (r.kind === 'owner') persons.owner[r.id] = normPerson(r.data);
        else if (r.kind === 'tenant') persons.tenant[r.id] = normPerson(r.data);
      } catch (e) {}
    });
    var houseOwner = {};
    (st.houses || []).forEach(function (h) {
      try {
        var p = normProp(h.data);
        if (!h.mine) { p._ownerUserId = h.ownerId; p._sharedFrom = h.ownerName || h.ownerId; }
        houseOwner[h.id] = h;
        d.properties.push(p);
      } catch (e) {}
    });
    (st.records || []).forEach(function (r) {
      try {
        var h = houseOwner[r.houseId], mine = h ? h.mine : false;
        if (r.kind === 'contract') d.contracts.push(normContract(r.data));
        else if (r.kind === 'tx') d.transactions.push(normTx(r.data));
        else if (r.kind === 'rec') d.recurring.push(normRec(r.data));
        else if (r.kind === 'owner' || r.kind === 'tenant') {
          if (!persons[r.kind][r.id]) {
            var per = normPerson(r.data);
            if (!mine) per._sharedFrom = h ? h.ownerName : '';
            persons[r.kind][r.id] = per;
          }
        }
      } catch (e) {}
    });
    d.owners = Object.keys(persons.owner).map(function (k) { return persons.owner[k]; });
    d.tenants = Object.keys(persons.tenant).map(function (k) { return persons.tenant[k]; });
    fillCats(d.settings);
    if (!Array.isArray(d.settings.tags)) d.settings.tags = TAGS0.slice();
    return d;
  }

  function applyState(st) {
    CW.state = st;
    db = rebuildDb(st);
    // snapshot = o que o servidor tem, na forma local normalizada; chaves que
    // o servidor não tem ficam de fora para serem enviadas no próximo push
    var serverKeys = {};
    (st.houses || []).forEach(function (h) { serverKeys['h:' + h.id] = 1; });
    (st.records || []).forEach(function (r) { serverKeys['r:' + r.houseId + ':' + r.kind + ':' + r.id] = 1; });
    (st.userRecords || []).forEach(function (r) { serverKeys['u:' + r.kind + ':' + r.id] = 1; });
    snap = {};
    var map = exportEntities();
    Object.keys(map).forEach(function (k) {
      if (serverKeys[k]) snap[k] = JSON.stringify(map[k].data);
    });
    saveSnap();
    try { localStorage.setItem(LS_OWNER, CW.user.id); } catch (e) {}
    rawSet(KEY, JSON.stringify(db));
    applyTheme(); buildNav(); render();
    setSyncBadge('ok');
    schedulePush(); // envia o que ainda faltar no servidor
  }

  function pullNow(force) {
    if (!CW.user) return Promise.resolve();
    if (!force && modalStack.length) return Promise.resolve(); // não pisar edições abertas
    return api('GET', '/api/state').then(function (st) {
      lastPull = Date.now();
      applyState(st);
    }).catch(function () { setSyncBadge('off'); });
  }

  function syncCycle() {
    if (!CW.user) return;
    pushNow().then(function () {
      if (Date.now() - lastPull > PULL_MS && !modalStack.length) pullNow();
    });
  }

  /* ---------------- arranque de sessão ---------------- */

  function startSync() {
    loadSnap();
    api('GET', '/api/state').then(function (st) {
      var serverEmpty = !(st.houses || []).length && !(st.userRecords || []).length && !(st.records || []).length;
      var localContent = (db.properties || []).length || (db.transactions || []).length ||
        (db.contracts || []).length || (db.tenants || []).length || (db.owners || []).length;
      var prevOwner = null;
      try { prevOwner = localStorage.getItem(LS_OWNER); } catch (e) {}
      if (serverEmpty && localContent && (!prevOwner || prevOwner === CW.user.id)) {
        // primeira sessão com dados locais: envia-os para a nuvem
        snap = {};
        pushNow().then(function () { return pullNow(true); });
      } else {
        lastPull = Date.now();
        applyState(st);
      }
    }).catch(function () { setSyncBadge('off'); });
    setInterval(syncCycle, 30000);
    window.addEventListener('online', syncCycle);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) syncCycle();
    });
  }

  /* ---------------- embrulhos sobre a app ---------------- */

  var _save = save;
  save = function () { _save(); schedulePush(); };

  var _render = render;
  render = function () { _render(); try { decorateShared(); } catch (e) {} };

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

  var _delProp = delProp;
  delProp = function (id) {
    var p = (db.properties || []).find(function (x) { return x.id === id; });
    if (p && p._sharedFrom) return toast('Esta casa é de ' + p._sharedFrom + ' — só o dono a pode apagar.');
    _delProp(id);
  };

  /* ---------------- página "Conta e partilha" ---------------- */

  var _vSettings = vSettings;
  vSettings = function () {
    if (setPage === 'cloud') return backRow + vCloud();
    var h = _vSettings();
    if (!setPage) {
      var sub = CW.user ? (CW.user.name || CW.user.email) + ' · id ' + CW.user.id : 'Inicia sessão para sincronizar';
      h = navRow('Conta e partilha', sub, 'users', 'cloud') + '<div style="height:14px"></div>' + h;
    }
    return h;
  };

  function connCard(c) {
    var peer = esc(c.peer.name || c.peer.email || c.peer.id);
    var lines = '';
    var btns = '';
    if (c.status === 'pending' && c.incoming) {
      lines = '<div class="small">Quer ligar-se a ti. Se aceitares, cada um pode escolher que casas partilha com o outro.</div>';
      btns = '<button class="btn primary sm" onclick="CW.acceptConn(\'' + c.id + '\')">Aceitar</button>' +
        '<button class="btn sm danger" onclick="CW.delConn(\'' + c.id + '\',1)">Recusar</button>';
    } else if (c.status === 'pending') {
      lines = '<div class="small">À espera que aceite o convite.</div>';
      btns = '<button class="btn sm danger" onclick="CW.delConn(\'' + c.id + '\',1)">Cancelar</button>';
    } else {
      var mine = (c.myShares || []).length, theirs = (c.peerShares || []).length;
      lines = '<div class="small">Partilhas <b>' + mine + '</b> casa' + (mine === 1 ? '' : 's') +
        ' · recebe' + 's' + ' <b>' + theirs + '</b> casa' + (theirs === 1 ? '' : 's') + ' de ' + peer + '</div>';
      btns = '<button class="btn primary sm" onclick="CW.sharesModal(\'' + c.id + '\')">Escolher casas</button>' +
        '<button class="btn sm danger" onclick="CW.delConn(\'' + c.id + '\')">Remover</button>';
    }
    return '<div class="card" style="padding:13px 14px">' +
      '<div class="row-between" style="align-items:center;gap:11px">' +
      '<div style="min-width:0"><div class="title">' + peer + '</div>' +
      '<div class="small">id ' + esc(c.peer.id) + (c.peer.email ? ' · ' + esc(c.peer.email) : '') + '</div></div>' +
      '<div style="display:flex;gap:6px;flex:0 0 auto">' + btns + '</div></div>' + lines + '</div>';
  }

  function vCloud() {
    if (!CW.user) return card('Conta', 'Sem sessão iniciada', '<button class="btn primary" onclick="CW.showAuth()">Iniciar sessão</button>');
    var conns = (CW.state.connections || []).slice();
    var acc = card('A minha conta', 'Sincronizada neste e noutros aparelhos',
      '<div class="stat"><span>Nome</span><b>' + esc(CW.user.name || '—') + '</b></div>' +
      '<div class="stat"><span>Email</span><b>' + esc(CW.user.email) + '</b></div>' +
      '<div class="stat" style="border:0"><span>O meu id</span><b style="font-family:monospace;letter-spacing:2px;font-size:16px">' + esc(CW.user.id) + '</b></div>' +
      '<div class="toolbar" style="margin-top:11px">' +
      '<button class="btn" onclick="CW.copyId()">Copiar id</button>' +
      '<button class="btn danger" onclick="CW.logout()">Terminar sessão</button></div>' +
      '<div class="hint" style="margin-top:11px">Dá este id a outro utilizador para ele te adicionar — ou adiciona tu o id dele em baixo. Depois de aceite, cada um escolhe que casas quer partilhar.</div>');
    var add = card('Ligar a outro utilizador', 'Escreve o id que ele te deu',
      '<div style="display:flex;gap:9px">' +
      '<input id="cw_peer" placeholder="Ex.: A7KQ2MPX" style="flex:1;text-transform:uppercase;font-family:monospace;letter-spacing:2px" maxlength="8">' +
      '<button class="btn primary" style="flex:0 0 auto" onclick="CW.addConn()">Adicionar</button></div>');
    var list = conns.length
      ? '<div class="section-title">Utilizadores ligados</div><div class="list" style="gap:10px">' + conns.map(connCard).join('') + '</div>'
      : '<div class="hint">Ainda não estás ligado a ninguém.</div>';
    return acc + '<div style="height:14px"></div>' + add + '<div style="height:14px"></div>' + list;
  }

  CW.copyId = function () {
    var done = function () { toast('Id copiado: partilha-o com o outro utilizador.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(CW.user.id).then(done, done);
    else done();
  };

  CW.addConn = function () {
    var id = (val('cw_peer') || '').trim().toUpperCase();
    if (!id) return toast('Escreve o id do outro utilizador.');
    api('POST', '/api/connections', { peerId: id })
      .then(function () { toast('Convite enviado — falta o outro utilizador aceitar.'); return pullNow(true); })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message); });
  };

  CW.acceptConn = function (id) {
    api('POST', '/api/connections/' + id + '/accept')
      .then(function () { toast('Conexão aceite. Escolhe agora que casas queres partilhar.'); return pullNow(true); })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message); });
  };

  CW.delConn = function (id, isPending) {
    var doDel = function () {
      api('DELETE', '/api/connections/' + id)
        .then(function () { toast(isPending ? 'Convite removido.' : 'Conexão removida.'); return pullNow(true); })
        .then(function () { render(); })
        .catch(function (e) { toast(e.message); });
    };
    if (isPending) return doDel();
    confirmModal('Remover conexão', 'Deixam ambos de ver as casas partilhadas um do outro. Os dados de cada um não são apagados.', doDel);
  };

  CW.sharesModal = function (connId) {
    var c = (CW.state.connections || []).find(function (x) { return x.id === connId; });
    if (!c) return;
    var myHouses = (db.properties || []).filter(function (p) { return !p._sharedFrom; });
    var body = myHouses.length
      ? '<div class="form"><div class="hint">Casas que partilhas com ' + esc(c.peer.name || c.peer.id) + '. Ele passa a ver e editar tudo o que pertence a estas casas: contratos, movimentos e pessoas associadas.</div>' +
        '<div class="list" style="gap:8px">' + myHouses.map(function (p) {
          var on = (c.myShares || []).indexOf(p.id) > -1;
          return '<label class="card" style="padding:12px 13px;display:flex;gap:11px;align-items:center;cursor:pointer">' +
            '<input type="checkbox" id="cw_sh_' + p.id + '" ' + (on ? 'checked' : '') + ' style="width:18px;height:18px">' +
            '<span style="min-width:0"><b style="display:block">' + esc(p.name || 'Sem nome') + '</b>' +
            '<span class="small">' + esc(p.address || '') + '</span></span></label>';
        }).join('') + '</div></div>'
      : '<div class="hint">Ainda não tens casas para partilhar.</div>';
    openModal('Partilhar casas', body);
    onSave = function () {
      var ids = myHouses.filter(function (p) {
        var e = document.getElementById('cw_sh_' + p.id);
        return e && e.checked;
      }).map(function (p) { return p.id; });
      api('PUT', '/api/connections/' + connId + '/shares', { houseIds: ids })
        .then(function () { closeModal(); toast('Partilha atualizada.'); return pullNow(true); })
        .then(function () { render(); })
        .catch(function (e) { toast(e.message); });
    };
  };

  CW.logout = function () {
    confirmModal('Terminar sessão', 'Os dados continuam guardados na tua conta e voltam quando iniciares sessão.', function () {
      api('POST', '/api/auth/logout').catch(function () {});
      CW.user = null;
      try { localStorage.removeItem(LS_USER); } catch (e) {}
      showAuth();
    });
  };

  CW.pushNow = pushNow;
  CW.pullNow = pullNow;

  /* ---------------- indicador de sincronização ---------------- */

  function setSyncBadge(state) {
    var el = document.getElementById('cwSync');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cwSync';
      el.style.cssText = 'position:fixed;z-index:60;right:14px;top:calc(var(--inset-top,0px) + 10px);' +
        'font-size:11px;padding:4px 9px;border-radius:99px;pointer-events:none;opacity:0;transition:opacity .3s';
      document.body.appendChild(el);
    }
    if (state === 'off') {
      el.textContent = 'Sem ligação — as alterações sincronizam mais tarde';
      el.style.background = 'var(--warn-soft)'; el.style.color = 'var(--warn)';
      el.style.opacity = '1';
    } else {
      el.style.opacity = '0';
    }
  }

  /* ---------------- ecrã de entrada ---------------- */

  var authEl = null;

  function showAuth(msg) {
    CW.showAuthMode = CW.showAuthMode || 'login';
    if (!authEl) {
      authEl = document.createElement('div');
      authEl.id = 'cwAuth';
      authEl.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--bg);overflow:auto;' +
        'display:flex;align-items:center;justify-content:center;padding:22px';
      document.body.appendChild(authEl);
    }
    var login = CW.showAuthMode === 'login';
    authEl.style.display = 'flex';
    authEl.innerHTML =
      '<div class="card" style="max-width:400px;width:100%;padding:24px">' +
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:6px">' +
      '<span class="avatar" style="background:var(--accent);color:var(--accent-ink)">' + (typeof ic === 'function' ? ic('building', 20) : '') + '</span>' +
      '<div><div class="title" style="font-size:18px">Gestor Imobiliário</div>' +
      '<div class="small">' + (login ? 'Inicia sessão para continuar' : 'Cria a tua conta') + '</div></div></div>' +
      (msg ? '<div class="hint" style="color:var(--danger);margin:8px 0">' + esc(msg) + '</div>' : '') +
      '<div class="form" style="margin-top:12px;display:grid;gap:10px">' +
      (login ? '' : '<input id="cwa_name" placeholder="Nome" autocomplete="name">') +
      '<input id="cwa_email" type="email" placeholder="Email" autocomplete="email">' +
      '<input id="cwa_pass" type="password" placeholder="Palavra-passe' + (login ? '' : ' (mín. 8 caracteres)') + '" autocomplete="' + (login ? 'current-password' : 'new-password') + '">' +
      '<div id="cwa_err" class="small" style="color:var(--danger)"></div>' +
      '<button class="btn primary" style="width:100%;justify-content:center" onclick="CW.submitAuth()">' + (login ? 'Entrar' : 'Criar conta') + '</button>' +
      '<button class="btn" style="width:100%;justify-content:center" onclick="CW.toggleAuth()">' +
      (login ? 'Ainda não tenho conta' : 'Já tenho conta') + '</button></div></div>';
    var pass = document.getElementById('cwa_pass');
    if (pass) pass.addEventListener('keydown', function (e) { if (e.key === 'Enter') CW.submitAuth(); });
  }
  CW.showAuth = function () { showAuth(); };

  CW.toggleAuth = function () {
    CW.showAuthMode = CW.showAuthMode === 'login' ? 'register' : 'login';
    showAuth();
  };

  CW.submitAuth = function () {
    var login = CW.showAuthMode !== 'register';
    var payload = { email: val('cwa_email'), password: val('cwa_pass') };
    if (!login) payload.name = val('cwa_name');
    var errEl = document.getElementById('cwa_err');
    errEl.textContent = '';
    api('POST', login ? '/api/auth/login' : '/api/auth/register', payload)
      .then(function (u) {
        CW.user = { id: u.id, name: u.name, email: u.email, token: u.token };
        try { localStorage.setItem(LS_USER, JSON.stringify(CW.user)); } catch (e) {}
        var prevOwner = null;
        try { prevOwner = localStorage.getItem(LS_OWNER); } catch (e) {}
        if (prevOwner && prevOwner !== u.id) {
          // dados locais de outra conta: não misturar
          db = JSON.parse(JSON.stringify(blank));
          rawSet(KEY, JSON.stringify(db));
        }
        hideAuth();
        buildNav(); render();
        startSync();
      })
      .catch(function (e) { errEl.textContent = e.message || 'Não foi possível entrar.'; });
  };

  function hideAuth() {
    if (authEl) authEl.style.display = 'none';
  }

  /* ---------------- PWA ---------------- */

  if ('serviceWorker' in navigator) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }

  /* ---------------- arranque ---------------- */

  if (CW.user) {
    // sessão em cache: confirma em fundo e começa a sincronizar
    api('GET', '/api/me').then(function (u) {
      CW.user = Object.assign({}, CW.user, { id: u.id, name: u.name, email: u.email });
      try { localStorage.setItem(LS_USER, JSON.stringify(CW.user)); } catch (e) {}
      startSync();
    }).catch(function (e) {
      if (e && e.status === 401) sessionLost();
      else { setSyncBadge('off'); startSync(); } // offline: continua local
    });
  } else {
    showAuth();
  }
})();
