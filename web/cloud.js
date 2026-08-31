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

  // Fora do wrapper Android, o browser já desconta a barra de estado — o
  // palpite de 28px do fitInsets() (pensado para o WebView antigo em ecrã
  // inteiro) criava um espaço a mais no topo. Travamo-lo e repomos o env().
  if (!window.Android) {
    window.__nativeInsets = 1; // fitInsets() passa a não fazer nada
    var rs = document.documentElement.style;
    ['--inset-top', '--inset-bottom', '--inset-left', '--inset-right'].forEach(function (k) {
      rs.removeProperty(k); // volta ao env(safe-area-inset-*) puro do CSS
    });
  }

  /* O tema é uma preferência do aparelho, não da conta: sincronizá-lo fazia
     um telemóvel em modo escuro herdar o "claro" escolhido noutro sítio. */
  var LS_THEME = 'gi_theme';
  function localTheme() {
    try { return localStorage.getItem(LS_THEME) || 'auto'; } catch (e) { return 'auto'; }
  }
  function applyLocalTheme() {
    db.settings.theme = localTheme();
    applyTheme();
  }
  var _setTheme = setTheme;
  setTheme = function (t) {
    try { localStorage.setItem(LS_THEME, t); } catch (e) {}
    _setTheme(t);
  };
  applyLocalTheme();

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

  // As quotas são geridas pelo servidor (propostas com confirmação): a casa
  // exportada nunca as leva, para um cliente desatualizado não as reverter.
  function stripHouse(p) {
    var c = strip(p);
    delete c.ownerIds;
    delete c.ownerShares;
    return c;
  }

  // Mapa completo do que este utilizador deve ter no servidor.
  // chave -> {scope, houseId?, kind?, id?, data}
  function exportEntities() {
    var map = {};
    var owners = db.owners || [], tenants = db.tenants || [];
    (db.properties || []).forEach(function (p) {
      map['h:' + p.id] = { scope: 'house', houseId: p.id, data: stripHouse(p) };
      var persons = {};
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
    // os "proprietários" são os utilizadores: só o meu perfil é exportado
    var meOwner = CW.user && owners.find(function (o) { return o.id === CW.user.id; });
    if (meOwner) map['u:profile:main'] = { scope: 'user', kind: 'profile', id: 'main', data: strip(meOwner) };
    tenants.forEach(function (t) { if (!t._sharedFrom) map['u:tenant:' + t.id] = { scope: 'user', kind: 'tenant', id: t.id, data: strip(t) }; });
    var st = strip(db.settings);
    delete st.theme;   // preferência do aparelho: fica de fora da sincronização
    map['u:settings:main'] = { scope: 'user', kind: 'settings', id: 'main', data: st };
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
    var sharedHouses = {};
    (CW.state.houses || []).forEach(function (h) { if (!h.mine) sharedHouses[h.id] = 1; });
    Object.keys(snap).forEach(function (k) {
      if (k in map) return;
      // o perfil nunca é apagado por diff (um restauro de cópia local não o traz)
      if (k === 'u:profile:main') { delete snap[k]; return; }
      var pk = parseKey(k);
      // proteção contra "Recomeçar"/restauros: não apagar em bloco os dados de
      // casas dos outros — só remoções pontuais (a casa continua presente)
      var houseGone = pk.houseId && !('h:' + pk.houseId in map);
      if (sharedHouses[pk.houseId] && houseGone) { delete snap[k]; return; }
      ops.push(Object.assign({ _key: k, op: 'del' }, pk));
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
    var myId = CW.user ? CW.user.id : '';
    var tenants = {};
    var myProfile = null;
    (st.userRecords || []).forEach(function (r) {
      try {
        if (r.kind === 'settings') d.settings = Object.assign({}, blank.settings, r.data, { theme: localTheme() });
        else if (r.kind === 'profile') myProfile = r.data;
        else if (r.kind === 'tx') d.transactions.push(normTx(r.data));
        else if (r.kind === 'rec') d.recurring.push(normRec(r.data));
        else if (r.kind === 'tpl') d.templates.push(normTpl(r.data));
        else if (r.kind === 'group') d.groups.push(normGroup(r.data));
        else if (r.kind === 'tenant') tenants[r.id] = normPerson(r.data);
        // kind 'owner' (modelo antigo) é ignorado: os proprietários são os utilizadores
      } catch (e) {}
    });
    var houseOwner = {};
    (st.houses || []).forEach(function (h) {
      try {
        var p = normProp(h.data);
        if (!h.mine) { p._ownerUserId = h.ownerId; p._sharedFrom = h.ownerName || h.ownerId; }
        // os donos do imóvel são os utilizadores com acesso (dono + partilhas);
        // as quotas vêm do servidor e só mudam por proposta confirmada
        var parts = h.participants || [h.ownerId];
        p.ownerIds = parts.slice();
        var rawSh = (h.data && h.data.ownerShares) || {};
        var shr = {};
        parts.forEach(function (u) { var v = Number(rawSh[u]); if (isFinite(v) && v >= 0) shr[u] = v; });
        p.ownerShares = shr;
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
        else if (r.kind === 'tenant') {
          if (!tenants[r.id]) {
            var per = normPerson(r.data);
            if (!mine) per._sharedFrom = h ? h.ownerName : '';
            tenants[r.id] = per;
          }
        }
      } catch (e) {}
    });
    // proprietários = utilizadores: eu (com o meu perfil) + os outros com perfil visível
    var ownersOut = {};
    var minePer = normPerson(myProfile || {});
    minePer.id = myId;
    if (!minePer.name) minePer.name = (CW.user && (CW.user.name || CW.user.email)) || '';
    ownersOut[myId] = minePer;
    (st.profiles || []).forEach(function (pr) {
      if (pr.userId === myId) return;
      var per = normPerson(pr.data || {});
      per.id = pr.userId;
      per._userId = pr.userId;
      if (!per.name) per.name = pr.name || pr.userId;
      ownersOut[pr.userId] = per;
    });
    d.owners = Object.keys(ownersOut).map(function (k) { return ownersOut[k]; });
    d.tenants = Object.keys(tenants).map(function (k) { return tenants[k]; });
    fillCats(d.settings);
    if (!Array.isArray(d.settings.tags)) d.settings.tags = TAGS0.slice();
    return dropUnsafe(d);
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
    // o que o servidor tem mas o cliente já não exporta (ex.: proprietários do
    // modelo antigo) fica marcado para o próximo push apagar
    Object.keys(serverKeys).forEach(function (k) {
      if (!(k in map)) snap[k] = '__obsoleto__';
    });
    saveSnap();
    try { localStorage.setItem(LS_OWNER, CW.user.id); } catch (e) {}
    rawSet(KEY, JSON.stringify(db));
    applyLocalTheme(); buildNav(); render();
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

  /* Rede de segurança contra dados envenenados: a app escreve ids em dezenas
     de atributos e handlers, por isso qualquer registo cujo id não seja o
     formato que a app gera é deitado fora à entrada — venha ele do servidor,
     de uma cópia de segurança ou de um ficheiro importado. */
  var SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
  var SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;
  var safe = function (o) { return !!o && SAFE_ID.test(String(o.id == null ? '' : o.id)); };

  function dropUnsafe(d) {
    if (!d) return d;
    ['contracts', 'transactions', 'recurring', 'templates', 'groups', 'owners', 'tenants'].forEach(function (k) {
      if (Array.isArray(d[k])) d[k] = d[k].filter(safe);
    });
    if (Array.isArray(d.properties)) {
      d.properties = d.properties.filter(safe);
      d.properties.forEach(function (p) {
        ['rooms', 'loans', 'photos'].forEach(function (k) {
          if (Array.isArray(p[k])) p[k] = p[k].filter(safe);
        });
        (p.loans || []).forEach(function (l) {
          if (Array.isArray(l.files)) l.files = l.files.filter(safe);
        });
      });
    }
    // datas entram cruas em texto: fora do formato ISO, não são datas
    (d.transactions || []).forEach(function (t) { if (t.date && !SAFE_DATE.test(t.date)) t.date = ''; });
    (d.recurring || []).forEach(function (r) {
      ['next', 'until', 'end'].forEach(function (k) { if (r[k] && !SAFE_DATE.test(r[k])) r[k] = ''; });
    });
    (d.contracts || []).forEach(function (c) {
      ['start', 'end'].forEach(function (k) { if (c[k] && !SAFE_DATE.test(c[k])) c[k] = ''; });
    });
    return d;
  }
  dropUnsafe(db);

  var _save = save;
  save = function () { dropUnsafe(db); _save(); schedulePush(); };

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

  /* ---------------- proprietários = utilizadores ---------------- */

  // a página "Proprietários" desaparece: cada utilizador gere o seu perfil
  NAV_GROUPS.forEach(function (g) { g.ids = g.ids.filter(function (id) { return id !== 'owners'; }); });
  if (tab === 'owners') tab = 'dashboard';
  buildNav();

  var _delPerson = delPerson;
  delPerson = function (kind, id) {
    if (kind === 'owner') {
      if (CW.user && id === CW.user.id) return toast('Este perfil és tu — podes editá-lo, não apagá-lo.');
      var per = (db.owners || []).find(function (x) { return x.id === id; });
      if (per && per._userId) return toast('Este proprietário é um utilizador ligado — para o remover, desfaz a partilha em Conta e partilha.');
    }
    _delPerson(kind, id);
  };

  // indicativos telefónicos para o seletor de país do perfil
  var DIAL_CODES = [
    ['+351', 'Portugal'], ['+34', 'Espanha'], ['+33', 'França'], ['+49', 'Alemanha'],
    ['+44', 'Reino Unido'], ['+41', 'Suíça'], ['+352', 'Luxemburgo'], ['+32', 'Bélgica'],
    ['+31', 'Países Baixos'], ['+353', 'Irlanda'], ['+39', 'Itália'], ['+1', 'EUA / Canadá'],
    ['+55', 'Brasil'], ['+244', 'Angola'], ['+258', 'Moçambique'], ['+238', 'Cabo Verde'],
    ['+245', 'Guiné-Bissau'], ['+239', 'São Tomé e Príncipe'], ['+670', 'Timor-Leste'], ['+853', 'Macau'],
  ];

  function injectPhoneCountry() {
    var inp = document.getElementById('pe_phone');
    if (!inp || document.getElementById('cw_cc')) return;
    var cur = String(inp.value || '').trim(), code = '+351', rest = cur;
    var byLen = DIAL_CODES.map(function (d) { return d[0]; }).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < byLen.length; i++) {
      if (cur.indexOf(byLen[i]) === 0) { code = byLen[i]; rest = cur.slice(byLen[i].length).trim(); break; }
    }
    var sel = document.createElement('select');
    sel.id = 'cw_cc';
    sel.style.cssText = 'flex:0 0 132px;min-width:0';
    DIAL_CODES.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d[0];
      o.textContent = d[0] + ' ' + d[1];
      sel.appendChild(o);
    });
    sel.value = code;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px';
    inp.parentNode.insertBefore(row, inp);
    row.appendChild(sel);
    row.appendChild(inp);
    inp.value = rest;
    inp.placeholder = '912 345 678';
    inp.style.flex = '1';
  }

  CW.editProfile = function () {
    if (!CW.user) return showAuth();
    var meP = (db.owners || []).find(function (o) { return o.id === CW.user.id; });
    if (!meP) {
      meP = normPerson({ name: CW.user.name || '' });
      meP.id = CW.user.id;
      db.owners.push(meP);
    }
    personModal('owner', CW.user.id);
    try { modalTop().el.querySelector('.head h2').textContent = 'O meu perfil'; } catch (e) {}
    injectPhoneCountry();
    // junta indicativo + número antes de o formulário recolher o campo
    var orig = onSave;
    onSave = function () {
      var inp = document.getElementById('pe_phone'), cc = document.getElementById('cw_cc');
      var n = inp ? String(inp.value || '').trim() : '';
      if (inp && cc) inp.value = n ? cc.value + ' ' + n : '';
      orig();
      // se a validação travou o fecho, repõe só o número (sem duplicar o indicativo)
      var still = document.getElementById('pe_phone');
      if (still) still.value = n;
    };
  };

  /* ---- divisão de quotas nos imóveis partilhados (com confirmação) ---- */

  // substitui a secção editável de proprietários do formulário do imóvel
  var OWN_SECT_RE = /<div><div class="flabel">Proprietários e quota-parte<\/div>[\s\S]*?id="shareHint"[\s\S]*?<\/div><\/div>/;
  var _propBody = propBody;
  propBody = function () {
    var h = _propBody();
    try {
      var blk = cwOwnersBlock();
      if (OWN_SECT_RE.test(h)) h = h.replace(OWN_SECT_RE, blk);
    } catch (e) {}
    return h;
  };

  function cwOwnersBlock() {
    var p = pForm;
    var live = (db.properties || []).find(function (x) { return x.id === p.id; }) || p;
    var parts = live.ownerIds || [];
    var myId = CW.user ? CW.user.id : '';
    if (parts.length < 2) {
      return '<div><div class="flabel">Proprietários</div><div class="hint">Este imóvel é só teu (100%). ' +
        'Para o teres em compropriedade, partilha-o com outro utilizador em <b>Definições → Conta e partilha</b>.</div></div>';
    }
    var shares = sharesOf(live);
    var prp = (CW.state.proposals || []).filter(function (x) { return x.houseId === p.id; })[0];
    var rows = parts.map(function (u) {
      var o = owner(u) || { name: u };
      var cur = pct(shares[u] || 0, 0);
      var nxt = prp ? dec(Math.round((Number(prp.shares[u]) || 0) * 100) / 100) + '%' : '';
      return '<div class="stat"><span>' + esc(o.name) + (u === myId ? ' (tu)' : '') + '</span>' +
        '<b>' + cur + (prp ? ' <span style="color:var(--warn)">→ ' + nxt + '</span>' : '') + '</b></div>';
    }).join('');
    var foot;
    if (prp) {
      var meOk = prp.approvals.indexOf(myId) > -1;
      var waiting = parts.filter(function (u) { return prp.approvals.indexOf(u) < 0; })
        .map(function (u) { return esc((owner(u) || { name: u }).name); });
      if (!meOk) {
        foot = '<div class="hint" style="margin-top:8px"><b>' + esc(prp.proposedByName) + '</b> propôs esta nova divisão. Só entra em vigor quando todos os comproprietários confirmarem.</div>' +
          '<div class="toolbar" style="margin-top:8px">' +
          '<button type="button" class="btn primary sm" onclick="CW.answerProposal(\'' + p.id + '\',1)">Confirmar nova divisão</button>' +
          '<button type="button" class="btn sm danger" onclick="CW.answerProposal(\'' + p.id + '\',0)">Rejeitar</button></div>';
      } else {
        foot = '<div class="hint" style="margin-top:8px">Nova divisão proposta — à espera de: <b>' + waiting.join(', ') + '</b>.</div>' +
          '<div class="toolbar" style="margin-top:8px"><button type="button" class="btn sm danger" onclick="CW.answerProposal(\'' + p.id + '\',0)">Cancelar proposta</button></div>';
      }
    } else {
      foot = '<div class="toolbar" style="margin-top:8px"><button type="button" class="btn sm" onclick="CW.proposeShares(\'' + p.id + '\')">Propor nova divisão</button></div>' +
        '<div class="hint" style="margin-top:6px">Mudar as percentagens só entra em vigor depois de todos os comproprietários confirmarem.</div>';
    }
    return '<div><div class="flabel">Proprietários e quota-parte</div>' + rows + foot + '</div>';
  }

  function refreshPropModal(hid) {
    try {
      if (modalStack.length && pForm && pForm.id === hid) { collectProp(); repaintProp(); }
    } catch (e) {}
  }

  CW.proposeShares = function (hid, fromShare) {
    var live = (db.properties || []).find(function (x) { return x.id === hid; });
    if (!live) return nextShareProposal();
    var parts = live.ownerIds || [];
    if (parts.length < 2) return nextShareProposal();
    var cur = sharesOf(live);
    var intro = fromShare
      ? 'Acabaste de partilhar <b>' + esc(live.name || 'esta casa') + '</b> — indica a divisão de quotas entre os comproprietários. Fica em partes iguais enquanto os outros não confirmarem a tua proposta.'
      : 'Define a percentagem de cada comproprietário. A nova divisão só entra em vigor depois de todos confirmarem.';
    var body = '<div class="form"><div class="hint">' + intro + '</div>' +
      parts.map(function (u) {
        var o = owner(u) || { name: u };
        return '<label>' + esc(o.name) + (CW.user && u === CW.user.id ? ' (tu)' : '') + ' (%)' +
          '<input id="cw_pp_' + u + '" type="text" inputmode="decimal" value="' + dec(Math.round((cur[u] || 0) * 1000) / 10) + '"></label>';
      }).join('') + '</div>';
    openModal(fromShare ? 'Divisão de quotas · ' + (live.name || '') : 'Propor nova divisão', body);
    onSave = function () {
      var shares = {}, total = 0;
      for (var i = 0; i < parts.length; i++) {
        var v = num(val('cw_pp_' + parts[i]));
        if (!isFinite(v) || v < 0) return toast('Percentagens inválidas.');
        shares[parts[i]] = v;
        total += v;
      }
      if (Math.abs(total - 100) > 0.5) return toast('As percentagens têm de somar 100 (agora somam ' + dec(Math.round(total * 100) / 100) + ').');
      // igual à divisão atual: não há nada para os outros confirmarem
      var unchanged = parts.every(function (u) { return Math.abs(shares[u] - (cur[u] || 0) * 100) < 0.1; });
      if (unchanged) {
        closeModal();
        toast('A divisão fica como está.');
        return nextShareProposal();
      }
      api('POST', '/api/houses/' + hid + '/proposal', { shares: shares })
        .then(function () { closeModal(); toast('Proposta enviada — falta a confirmação dos outros comproprietários.'); return pullNow(true); })
        .then(function () { refreshPropModal(hid); nextShareProposal(); })
        .catch(function (e) { toast(e.message); });
    };
  };

  CW.answerProposal = function (hid, accept) {
    api('POST', '/api/houses/' + hid + '/proposal/' + (accept ? 'accept' : 'reject'))
      .then(function (r) {
        toast(accept
          ? (r.applied ? 'Confirmado por todos — a nova divisão já está em vigor.' : 'Confirmado — falta a resposta dos outros.')
          : 'Proposta rejeitada.');
        return pullNow(true);
      })
      .then(function () { refreshPropModal(hid); })
      .catch(function (e) { toast(e.message); });
  };

  /* ---------------- página "Conta e partilha" ---------------- */

  var _vSettings = vSettings;
  vSettings = function () {
    if (setPage === 'cloud') return backRow + vCloud();
    if (setPage === 'legal') return backRow + vLegal();
    if (setPage === 'tema') {
      var t = db.settings.theme;
      return backRow + card('Tema', 'Como a app se apresenta',
        '<div class="seg c3">' +
        [['auto', 'auto', 'Automático', 'segue o telemóvel'], ['light', 'sun', 'Claro', ''], ['dark', 'moon', 'Escuro', '']]
          .map(function (o) {
            return '<button type="button" class="opt ' + (t === o[0] ? 'on' : '') + '" onclick="setTheme(\'' + o[0] + '\')">' +
              '<span class="ic">' + ic(o[1], 18) + '</span><b>' + o[2] + '</b>' +
              (o[3] ? '<small>' + o[3] + '</small>' : '') + '</button>';
          }).join('') + '</div>' +
        '<div class="hint" style="margin-top:11px">Vale só neste aparelho.</div>');
    }
    var h = _vSettings();
    if (!setPage) {
      // raiz reorganizada: conta, aplicação, dados e sobre — em vez de uma
      // lista corrida de dez entradas sem hierarquia
      var meP = CW.user && (db.owners || []).find(function (o) { return o.id === CW.user.id; });
      var psub = meP && meP.nif ? esc(meP.name) + ' · NIF preenchido' : 'Nome, NIF e contactos para os contratos';
      var conta = CW.user ? (CW.user.name || CW.user.email) + ' · id ' + CW.user.id : 'Inicia sessão';
      var cs = cats(), csIn = catsIn();
      var nCats = Object.keys(cs).length + Object.keys(csIn).length;
      var sect = function (t) { return '<div class="section-title">' + t + '</div>'; };
      var gap = '<div style="height:10px"></div>';
      var tema = { auto: 'Automático', light: 'Claro', dark: 'Escuro' }[db.settings.theme] || 'Automático';

      h = sect('Conta') +
        '<div class="card tap" onclick="CW.editProfile()" style="display:flex;align-items:center;gap:13px">' +
        '<span class="avatar">' + ic('crown', 18) + '</span>' +
        '<span style="flex:1;min-width:0"><b style="display:block">O meu perfil</b><span class="small">' + psub + '</span></span>' +
        '<span style="color:var(--muted);transform:rotate(180deg)">' + ic('chev', 18) + '</span></div>' + gap +
        navRow('Conta e partilha', conta, 'users', 'cloud') +

        sect('Aplicação') +
        navRow('Tema', tema, 'sun', 'tema') + gap +
        navRow('Valores por omissão', 'Aumentos, inflação e imposto do selo', 'trend', 'defaults') +

        sect('Dados') +
        navRow('Tipos de movimento', nCats + ' categorias', 'swap', 'cats') + gap +
        navRow('Etiquetas', (db.settings.tags || []).length + ' etiquetas', 'tag', 'tags') + gap +
        navRow('Grupos', (db.groups || []).length + ' grupos', 'users', 'groups') + gap +
        navRow('Importar e cópias', 'Splitwise, cópias de segurança e recomeçar', 'down', 'dados') +

        sect('Sobre') +
        navRow('Aviso legal', 'Versão de demonstração', 'info', 'legal') + gap +
        card('Gestor Imobiliário', 'Versão 23 · demonstração',
          '<div class="stat"><span>Imóveis · contratos</span><b>' + db.properties.length + ' · ' + db.contracts.length + '</b></div>' +
          '<div class="stat"><span>Inquilinos</span><b>' + db.tenants.length + '</b></div>' +
          '<div class="stat" style="border:0"><span>Movimentos</span><b>' + db.transactions.length + '</b></div>');
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      var standalone = false;
      try { standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; } catch (e) {}
      if (isIOS) {
        h += '<div style="height:14px"></div>' +
          card('App no iPhone', 'Adicionar ao ecrã principal', standalone
            ? '<div class="hint">Já estás a usar a app instalada no ecrã principal. 👍</div>'
            : '<div class="hint">No iPhone a instalação faz-se pelo Safari (não aparece nenhum aviso automático):</div>' +
              '<div class="list" style="gap:7px;margin-top:9px">' +
              '<div class="small"><b>1.</b> Abre este site no <b>Safari</b> — se estiveres dentro de outra app (WhatsApp, Gmail, Instagram…), toca no ícone do browser para abrir no Safari a sério.</div>' +
              '<div class="small"><b>2.</b> Toca no botão <b>Partilhar</b> (quadrado com seta para cima, na barra de baixo).</div>' +
              '<div class="small"><b>3.</b> Desliza e escolhe <b>“Adicionar ao ecrã principal”</b> e confirma.</div></div>' +
              '<div class="hint" style="margin-top:9px">No Chrome do iPhone: menu <b>⋯</b> → “Adicionar ao ecrã inicial”. A opção não existe em janelas privadas.</div>');
      } else if (!window.Android) {
        h += '<div style="height:14px"></div>' +
          card('App para Android', 'A mesma app no telemóvel',
            '<div class="hint">Instala a app nativa: é o mesmo gestor, com notificações dos movimentos por confirmar e o seletor de ficheiros do Android (Google Drive incluído). Ao abrir o APK, o Android pede para autorizares a instalação de apps fora da Play Store — é normal.</div>' +
            '<div class="toolbar" style="margin-top:11px"><a class="btn primary" href="/gestor-imobiliario.apk" download style="text-decoration:none">' + ic('down', 16) + ' Descarregar APK</a></div>');
      }
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
      '<button class="btn" onclick="CW.logout()">Terminar sessão</button></div>' +
      '<div class="hint" style="margin-top:11px">Dá este id a outro utilizador para ele te adicionar — ou adiciona tu o id dele em baixo. Depois de aceite, cada um escolhe que casas quer partilhar.</div>');
    var add = card('Ligar a outro utilizador', 'Escreve o id que ele te deu',
      '<div style="display:flex;gap:9px">' +
      '<input id="cw_peer" placeholder="Ex.: A7KQ2MPX" style="flex:1;text-transform:uppercase;font-family:monospace;letter-spacing:2px" maxlength="8">' +
      '<button class="btn primary" style="flex:0 0 auto" onclick="CW.addConn()">Adicionar</button></div>');
    var list = conns.length
      ? '<div class="section-title">Utilizadores ligados</div><div class="list" style="gap:10px">' + conns.map(connCard).join('') + '</div>'
      : '<div class="hint">Ainda não estás ligado a ninguém.</div>';
    var seg = card('Segurança', 'Palavra-passe e sessões',
      '<div class="hint">A sessão dura 30 dias em cada aparelho. Se desconfiares que alguém entrou na tua conta, ' +
      'muda a palavra-passe ou fecha as outras sessões — em qualquer dos casos, todos os outros aparelhos passam a ' +
      'ter de entrar de novo.</div>' +
      '<div class="toolbar" style="margin-top:11px">' +
      '<button class="btn" onclick="CW.passwordModal()">' + ic('lock', 15) + ' Mudar palavra-passe</button>' +
      '<button class="btn" onclick="CW.revokeSessions()">Terminar sessão nos outros aparelhos</button></div>');
    var danger = card('Apagar a conta', 'Não há volta atrás',
      '<div class="hint">Apaga a tua conta e <b>todos os teus dados</b>: imóveis, contratos, movimentos, pessoas e ligações. ' +
      'Nas casas de outras pessoas onde tenhas ficado registado (num movimento pago por ti, por exemplo), o teu nome passa a ' +
      'aparecer como <b>[deleted]</b>. As casas que os outros partilharam contigo deixam de estar ligadas a ti — os dados deles não são apagados.</div>' +
      '<div class="toolbar" style="margin-top:11px"><button class="btn danger" onclick="CW.deleteAccount()">' +
      ic('trash', 15) + ' Apagar a minha conta</button></div>');
    return acc + '<div style="height:14px"></div>' + add + '<div style="height:14px"></div>' + list +
      '<div style="height:18px"></div>' + seg + '<div style="height:14px"></div>' + danger;
  }

  /* ---------------- aviso legal ---------------- */

  SUBPAGE.cloud = { label: 'Conta e partilha', sub: 'O teu id, ligações e casas partilhadas' };
  SUBPAGE.legal = { label: 'Aviso legal', sub: 'Versão de demonstração · condições de utilização' };
  SUBPAGE.tema = { label: 'Tema', sub: 'Claro, escuro ou o do telemóvel' };

  var LEGAL_UPDATED = '31 de agosto de 2026';

  function vLegal() {
    var p = function (t) { return '<p style="margin:0 0 10px">' + t + '</p>'; };
    return card('Versão de demonstração', 'Lê antes de usares com dados reais',
      '<div class="hint" style="font-size:14px;line-height:1.65">' +
      p('<b>Esta aplicação é uma versão de demonstração, em desenvolvimento.</b> É um projeto pessoal, ' +
        'disponibilizado tal como está, sem qualquer garantia de funcionamento, exatidão, disponibilidade ou ' +
        'conservação dos dados. Não é um produto comercial nem um serviço contratado.') +
      p('Funcionalidades podem mudar, deixar de existir ou comportar-se de forma inesperada de um dia para o outro.') +
      '</div>') +
      '<div style="height:14px"></div>' +
      card('Os teus dados', 'Podes perdê-los',
        '<div class="hint" style="font-size:14px;line-height:1.65">' +
        p('Os dados são guardados numa base de dados na nuvem e no próprio dispositivo. Sendo uma demonstração, ' +
          '<b>podem ser apagados, repostos ou corrompidos sem aviso prévio</b>, seja por erro, manutenção ou fim do projeto.') +
        p('<b>Faz cópias de segurança regulares</b> em Definições → Dados → Guardar cópia. A responsabilidade de ' +
          'manter uma cópia dos teus registos é tua.') +
        p('Fotografias e documentos anexados ficam apenas no dispositivo onde foram adicionados: não são ' +
          'sincronizados nem incluídos nas cópias de segurança em JSON.') +
        '</div>') +
      '<div style="height:14px"></div>' +
      card('Não é aconselhamento profissional', '',
        '<div class="hint" style="font-size:14px;line-height:1.65">' +
        p('Os valores, indicadores e projeções (yield, cap rate, LTV, planos de amortização, impostos, ' +
          'rentabilidades futuras) são <b>estimativas informativas</b>, calculadas a partir do que introduzes e de ' +
          'pressupostos simplificados. Não constituem aconselhamento fiscal, jurídico, contabilístico ou financeiro ' +
          'e não substituem um contabilista certificado, um advogado ou um intermediário de crédito.') +
        p('Confirma sempre os números junto das fontes oficiais (Autoridade Tributária, banco, condomínio) antes de ' +
          'tomares decisões ou submeteres declarações.') +
        '</div>') +
      '<div style="height:14px"></div>' +
      card('Contratos gerados em PDF', 'Rever antes de assinar',
        '<div class="hint" style="font-size:14px;line-height:1.65">' +
        p('O contrato de arrendamento gerado pela aplicação é um <b>modelo genérico, não validado por advogado</b> e ' +
          'que pode não refletir a legislação em vigor nem as particularidades da tua situação.') +
        p('Deve ser revisto por um profissional antes de ser assinado. A aplicação não assume qualquer ' +
          'responsabilidade pelo conteúdo, validade ou consequências dos documentos gerados.') +
        '</div>') +
      '<div style="height:14px"></div>' +
      card('Dados de terceiros e privacidade', 'Inquilinos, proprietários e fiadores',
        '<div class="hint" style="font-size:14px;line-height:1.65">' +
        p('Ao introduzires dados de outras pessoas (nome, contactos, NIF, cartão de cidadão, documentos), ' +
          '<b>és tu o responsável pelo tratamento desses dados</b> à luz do RGPD: deves ter fundamento legítimo para ' +
          'os guardar, informar os titulares e conservá-los apenas o tempo necessário.') +
        p('Introduz o mínimo indispensável e evita dados sensíveis. Ao partilhares uma casa com outro utilizador, ' +
          'dás-lhe acesso a tudo o que essa casa contém — incluindo contratos, movimentos e fichas de pessoas.') +
        '</div>') +
      '<div style="height:14px"></div>' +
      card('Segurança e disponibilidade', '',
        '<div class="hint" style="font-size:14px;line-height:1.65">' +
        p('As palavras-passe são guardadas cifradas e a ligação é encriptada, mas <b>nenhuma medida de segurança é ' +
          'infalível</b> e esta aplicação não foi sujeita a auditoria de segurança. Usa uma palavra-passe única e forte.') +
        p('O serviço pode ficar indisponível, ser interrompido ou terminar a qualquer momento, sem aviso e sem ' +
          'direito a indemnização.') +
        '</div>') +
      '<div style="height:14px"></div>' +
      card('Limitação de responsabilidade', '',
        '<div class="hint" style="font-size:14px;line-height:1.65">' +
        p('Na medida máxima permitida por lei, o autor não se responsabiliza por quaisquer danos diretos ou ' +
          'indiretos decorrentes do uso desta aplicação — incluindo perda de dados, prejuízos financeiros, ' +
          'decisões tomadas com base nos valores apresentados ou incumprimentos legais ou fiscais.') +
        p('Ao utilizares a aplicação, aceitas estas condições. Se não concordares, não a utilizes.') +
        '</div>') +
      '<div class="hint" style="text-align:center;margin-top:16px">Última atualização: ' + LEGAL_UPDATED + '.</div>';
  }

  /* Ecrã de entrada: sempre que a app abre (depois da sessão iniciada),
     mostra-se o aviso e nada mais, até o utilizador continuar. */

  // trava a página por baixo enquanto um ecrã de entrada estiver aberto
  function lockScroll(on) {
    try {
      var h = document.documentElement;
      if (on) {
        if (h.classList.contains('noscroll')) return;
        CW._lockY = window.scrollY || 0;
        h.classList.add('noscroll');
        document.body.style.top = -CW._lockY + 'px';
      } else {
        if (!h.classList.contains('noscroll')) return;
        if (modalStack.length || document.body.classList.contains('open')) return;
        if (document.getElementById('cwLegal')) return;
        if (authEl && authEl.style.display !== 'none') return;
        h.classList.remove('noscroll');
        document.body.style.top = '';
        window.scrollTo(0, CW._lockY || 0);
      }
    } catch (e) {}
  }

  function showLegalGate() {
    if (!CW.user || CW._legalShown) return;
    CW._legalShown = true;
    var el = document.createElement('div');
    el.id = 'cwLegal';
    el.style.cssText = 'position:fixed;inset:0;z-index:195;background:var(--bg);overflow:auto;' +
      'display:flex;align-items:center;justify-content:center;padding:22px';
    var li = function (t) { return '<li style="margin-bottom:7px">' + t + '</li>'; };
    el.innerHTML =
      '<div class="card" style="max-width:460px;width:100%;padding:24px">' +
      '<div style="display:flex;gap:12px;align-items:center">' +
      '<span class="avatar" style="background:var(--warn-soft);color:var(--warn)">' + ic('info', 20) + '</span>' +
      '<div><div class="title" style="font-size:18px">Versão de demonstração</div>' +
      '<div class="small">Lê antes de continuares</div></div></div>' +
      '<div class="hint" style="font-size:14px;line-height:1.6;margin-top:14px">' +
      '<p style="margin:0 0 10px">Esta aplicação é uma <b>demonstração em desenvolvimento</b>, fornecida tal como ' +
      'está, sem garantias de funcionamento, exatidão ou disponibilidade.</p>' +
      '<ul style="margin:0 0 4px;padding-left:18px">' +
      li('<b>Os dados podem ser apagados ou repostos sem aviso.</b> Guarda cópias de segurança com regularidade.') +
      li('Os valores e projeções são estimativas: <b>não são aconselhamento fiscal, jurídico ou financeiro</b>.') +
      li('O contrato em PDF é um modelo genérico, <b>não validado por advogado</b> — revê-o antes de assinar.') +
      li('Ao guardares dados de inquilinos, <b>és tu o responsável por esses dados</b> perante o RGPD.') +
      '</ul></div>' +
      '<div class="toolbar" style="margin-top:16px;flex-direction:column;gap:8px">' +
      '<button class="btn primary" style="width:100%;justify-content:center" onclick="CW.acceptLegal()">Continuar</button>' +
      '<button class="btn" style="width:100%;justify-content:center" onclick="CW.acceptLegal(1)">Ler o aviso legal completo</button>' +
      '</div></div>';
    document.body.appendChild(el);
    lockScroll(true);
  }

  CW.acceptLegal = function (full) {
    var el = document.getElementById('cwLegal');
    if (el) el.remove();
    lockScroll(false);
    if (full) { go('settings'); goSet('legal'); }
  };

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
      var before = (c.myShares || []).slice();
      var ids = myHouses.filter(function (p) {
        var e = document.getElementById('cw_sh_' + p.id);
        return e && e.checked;
      }).map(function (p) { return p.id; });
      api('PUT', '/api/connections/' + connId + '/shares', { houseIds: ids })
        .then(function () { closeModal(); toast('Partilha atualizada.'); return pullNow(true); })
        .then(function () {
          render();
          // casas partilhadas agora pela primeira vez: pede logo a divisão de quotas
          var added = ids.filter(function (id) { return before.indexOf(id) < 0; });
          if (added.length) {
            CW._shareQueue = added.slice(1);
            CW.proposeShares(added[0], true);
          }
        })
        .catch(function (e) { toast(e.message); });
    };
  };

  function nextShareProposal() {
    var nxt = (CW._shareQueue || []).shift();
    if (nxt) CW.proposeShares(nxt, true);
  }

  CW.passwordModal = function () {
    var body = '<div class="form">' +
      '<div class="hint">Ao mudar a palavra-passe, todos os outros aparelhos têm de iniciar sessão de novo. ' +
      'Este continua ligado.</div>' +
      '<label>Palavra-passe atual<input id="cw_pw_cur" type="password" autocomplete="current-password" ' +
      'placeholder="deixa vazio se entras com Google"></label>' +
      '<label>Nova palavra-passe<input id="cw_pw_new" type="password" autocomplete="new-password"></label>' +
      '<div id="cw_pw_req" class="small" style="margin:-4px 0 0;display:flex;flex-wrap:wrap;gap:3px 12px"></div>' +
      '<label>Confirmar nova palavra-passe<input id="cw_pw_new2" type="password" autocomplete="new-password"></label>' +
      '<div id="cw_pw_err" class="small" style="color:var(--danger)"></div></div>';
    openModal('Mudar palavra-passe', body,
      '<button class="btn" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn primary" onclick="CW.savePassword()">Guardar</button>');
    var reqs = [['8+ caracteres', function (p) { return p.length >= 8; }],
      ['maiúscula', function (p) { return /[A-Z]/.test(p); }],
      ['minúscula', function (p) { return /[a-z]/.test(p); }],
      ['número', function (p) { return /[0-9]/.test(p); }],
      ['símbolo', function (p) { return /[^A-Za-z0-9]/.test(p); }]];
    var box = document.getElementById('cw_pw_req'), inp = document.getElementById('cw_pw_new');
    var paint = function () {
      box.innerHTML = reqs.map(function (r) {
        var ok = r[1](inp.value);
        return '<span style="color:' + (ok ? 'var(--accent)' : 'var(--muted)') + ';font-weight:' + (ok ? 650 : 400) + '">' +
          (ok ? '✓ ' : '• ') + r[0] + '</span>';
      }).join('');
    };
    paint();
    inp.addEventListener('input', paint);
  };

  CW.savePassword = function () {
    var e = document.getElementById('cw_pw_err');
    e.textContent = '';
    var next = val('cw_pw_new');
    var prob = passProblem(next);
    if (prob) { e.textContent = prob; return; }
    if (next !== val('cw_pw_new2')) { e.textContent = 'As palavras-passe não coincidem.'; return; }
    api('POST', '/api/me/password', { current: val('cw_pw_cur'), next: next })
      .then(function (r) {
        if (r.token) {
          CW.user.token = r.token;
          try { localStorage.setItem(LS_USER, JSON.stringify(CW.user)); } catch (x) {}
        }
        closeModal();
        toast('Palavra-passe alterada. Os outros aparelhos têm de entrar de novo.');
      })
      .catch(function (err) { e.textContent = err.message || 'Não foi possível mudar a palavra-passe.'; });
  };

  CW.revokeSessions = function () {
    confirmModal('Terminar as outras sessões',
      'Todos os outros aparelhos onde tenhas a conta aberta passam a pedir início de sessão. Este continua ligado.',
      function () {
        api('DELETE', '/api/me/sessions')
          .then(function (r) {
            if (r.token) {
              CW.user.token = r.token;
              try { localStorage.setItem(LS_USER, JSON.stringify(CW.user)); } catch (x) {}
            }
            toast('Sessões terminadas nos outros aparelhos.');
          })
          .catch(function (err) { toast(err.message); });
      });
  };

  CW.deleteAccount = function () {
    var mine = (db.properties || []).filter(function (p) { return !p._sharedFrom; }).length;
    var body = '<div class="form">' +
      '<div class="hint" style="color:var(--danger)"><b>Isto não se pode desfazer.</b> Vais apagar ' + mine +
      ' imóvel' + (mine === 1 ? '' : 'is') + ', com os contratos, movimentos e pessoas que lhes pertencem, ' +
      'e todas as tuas ligações a outros utilizadores.</div>' +
      '<div class="hint">Se quiseres guardar os teus registos, cancela e faz primeiro uma cópia de segurança ' +
      'em Definições → Dados → Guardar cópia.</div>' +
      '<label>Escreve <b>APAGAR</b> para confirmar<input id="cw_del_c" placeholder="APAGAR" autocomplete="off" style="text-transform:uppercase"></label>' +
      '<label>Palavra-passe<input id="cw_del_p" type="password" placeholder="deixa vazio se entras com Google" autocomplete="current-password"></label>' +
      '<div id="cw_del_e" class="small" style="color:var(--danger)"></div></div>';
    openModal('Apagar a minha conta', body,
      '<button class="btn" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn danger" onclick="CW.doDeleteAccount()">Apagar definitivamente</button>');
  };

  CW.doDeleteAccount = function () {
    var e = document.getElementById('cw_del_e');
    e.textContent = '';
    api('DELETE', '/api/me', { confirm: val('cw_del_c'), password: val('cw_del_p') })
      .then(function () {
        // limpa tudo o que ficou neste aparelho
        CW.user = null;
        db = JSON.parse(JSON.stringify(blank));
        rawSet(KEY, JSON.stringify(db));
        ['gi_cloud_user', 'gi_cloud_owner', 'gi_page'].forEach(function (k) {
          try { localStorage.removeItem(k); } catch (x) {}
        });
        try { localStorage.removeItem(snapKey()); } catch (x) {}
        snap = {};
        closeAllModals();
        buildNav(); render();
        CW.showAuthMode = 'login';
        showAuth('Conta apagada. Obrigado por teres experimentado.');
      })
      .catch(function (err) { e.textContent = err.message || 'Não foi possível apagar a conta.'; });
  };

  CW.logout = function () {
    confirmModal('Terminar sessão', 'Os dados continuam guardados na tua conta e voltam quando iniciares sessão.', function () {
      api('POST', '/api/auth/logout').catch(function () {});
      CW.user = null;
      try { localStorage.removeItem(LS_USER); } catch (e) {}
      showAuth();
    });
  };

  /* =====================================================================
     Painel: movimentos por trás de cada indicador, pendentes nas vistas de
     imóveis e contratos, recusa de planeados e ordem dos cartões da visão
     geral (modo de edição por toque longo).
     ===================================================================== */

  var KPI_KINDS = { income: ['income'], op: ['expense'], loan: ['loan'], cf: ['income', 'expense', 'loan'] };

  // os indicadores em euros passam a dizer que movimentos os compõem
  var _evoMoney = evoMoney;
  evoMoney = function (field, pid, fmt) {
    var d = _evoMoney(field, pid, fmt);
    if (d && KPI_KINDS[field]) d.txq = { field: field, pid: pid || null, year: YEAR };
    return d;
  };

  // mesma regra do metrics(): ano, tipo, fora-dos-totais e peso do imóvel/quota
  function kpiTxs(q) {
    var kinds = KPI_KINDS[q.field] || [];
    return (db.transactions || [])
      .filter(function (t) {
        if (String(t.date || '').indexOf(String(q.year)) !== 0) return false;
        if (kinds.indexOf(t.kind) < 0) return false;
        if ((t.kind === 'income' || t.kind === 'expense') && !countsInTotals(t)) return false;
        return txW(t, q.pid) !== 0;
      })
      .map(function (t) { return { t: t, v: t.amount * txShare(t, true) * txW(t, q.pid) }; })
      .sort(function (a, b) { return String(b.t.date).localeCompare(String(a.t.date)); });
  }

  var _kpiModal = kpiModal;
  kpiModal = function (id) {
    if (CW.editMode) return;   // a arrastar cartões, não se abrem indicadores
    var k = KPI_REG[id];
    if (!k) return;
    _kpiModal(id);
    var top = modalTop();
    if (!top) return;
    var d;
    try { d = k.evo(); } catch (e) { d = null; }
    if (!d || !d.txq) return;

    var q = d.txq, rows = kpiTxs(q), show = rows.slice(0, 50);
    var total = rows.reduce(function (a, r) { return a + r.v; }, 0);
    var html = '<div><div class="flabel">Movimentos que somam este valor</div>' +
      (rows.length
        ? '<div class="list" style="gap:7px">' + show.map(function (r) {
            var t = r.t, col = t.kind === 'income' ? 'pos' : (t.kind === 'loan' ? 'amber' : 'neg');
            return '<div class="card tap" style="padding:10px 12px" onclick="CW.openTx(\'' + t.id + '\')">' +
              '<div class="row-between" style="align-items:center;gap:10px">' +
              '<div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t.label) + '</b>' +
              '<span class="small">' + esc(t.date) + ' · ' + esc((KIND[t.kind] || {}).short || '') +
              (t.category ? ' · ' + esc(t.category) : '') +
              (t.propertyId ? ' · ' + esc(propName(t.propertyId)) : '') + '</span></div>' +
              '<b class="' + col + '" style="flex:0 0 auto">' + euro2(r.v) + '</b></div></div>';
          }).join('') + '</div>' +
          (rows.length > show.length
            ? '<div class="hint" style="margin-top:8px">A mostrar os ' + show.length + ' mais recentes de ' + rows.length + '. Vê todos em Movimentos.</div>'
            : '') +
          '<div class="stat" style="margin-top:8px"><span>Total</span><b>' + euro2(total) + '</b></div>'
        : '<div class="hint">Nenhum movimento registado em ' + q.year + '.</div>') +
      '</div>';

    var body = top.el.querySelector('.body');
    if (body) { var w = document.createElement('div'); w.innerHTML = html; body.appendChild(w.firstChild); }
    var foot = top.el.querySelector('.foot');
    if (foot) {
      foot.innerHTML =
        '<button class="btn" onclick="CW.backToDash(1)">' + ic('chev', 15) + ' Visão geral</button>' +
        '<button class="btn primary" onclick="CW.kpiToTx()">' + ic('swap', 15) + ' Ver nos movimentos</button>';
    }
    CW._kpiQ = { field: q.field, pid: q.pid, year: q.year, title: k.title };
  };

  CW.openTx = function (id) {
    if ((db.transactions || []).some(function (x) { return x.id === id; })) txModal(id);
  };

  // salta para os Movimentos já com os filtros do indicador aplicados
  CW.kpiToTx = function () {
    var q = CW._kpiQ;
    if (!q) return;
    CW._fromKpi = {
      title: q.title, year: q.year,
      prev: { f: txFilter, p: txProp, c: txCat, s: txSub, pd: txPaid, np: txNoPayer, q: txSearch },
    };
    txFilter = q.field === 'income' ? 'income' : q.field === 'op' ? 'expense' : q.field === 'loan' ? 'loan' : '';
    txProp = q.pid || '';
    txCat = ''; txSub = ''; txPaid = ''; txNoPayer = true;
    txSearch = String(q.year) + '-';   // o ano vive na data de cada movimento
    closeAllModals();
    go('transactions');
  };

  CW.backToDash = function (fromModal) {
    var f = CW._fromKpi;
    if (f && f.prev) {
      txFilter = f.prev.f; txProp = f.prev.p; txCat = f.prev.c; txSub = f.prev.s;
      txPaid = f.prev.pd; txNoPayer = f.prev.np; txSearch = f.prev.q;
    }
    CW._fromKpi = null;
    if (fromModal) closeAllModals();
    go('dashboard');
  };

  // barra de regresso quando se chega aos Movimentos vindo de um indicador
  var _vTransactions = vTransactions;
  vTransactions = function () {
    var h = _vTransactions();
    var f = CW._fromKpi;
    if (!f) return h;
    return '<div class="card" style="margin-bottom:12px;padding:11px 13px;display:flex;align-items:center;gap:11px">' +
      '<span class="small" style="flex:1;min-width:0">Movimentos de <b>' + esc(f.title) + '</b> em ' + f.year + ', vindos da visão geral.</span>' +
      '<button class="btn sm" style="flex:0 0 auto" onclick="CW.backToDash()">' + ic('chev', 14) + ' Visão geral</button></div>' + h;
  };

  /* ---------------- recusar um movimento planeado ---------------- */

  CW.rejectRec = function (id) {
    var r = (db.recurring || []).find(function (x) { return x.id === id; });
    if (!r) return;
    var once = r.every === 'once';
    confirmModal('Recusar movimento',
      'Salta “' + esc(r.name) + '” desta vez: não cria nenhum movimento' +
      (once ? ' e, como só acontecia uma vez, deixa de ser pedido.' : ' e passa à data seguinte. O plano continua ativo.'),
      function () {
        recAdvance(r);
        save(); buildNav(); render();
        toast(once ? 'Movimento recusado.' : 'Recusado — segue para a próxima data.');
      });
  };

  var REJECT_BTN = function (id) {
    return '<button class="btn sm danger" onclick="event.stopPropagation();CW.rejectRec(\'' + id + '\')">Recusar</button>';
  };

  // acrescenta "Recusar" a cada linha do cartão de pendentes
  var _pendingCard = pendingCard;
  pendingCard = function (all) {
    return _pendingCard(all).replace(/skipRec\('([^']+)'\)"[^>]*>[^<]*<\/button>/g, function (m, id) {
      return m + REJECT_BTN(id);
    });
  };

  // ... e à lista de opções do toque longo numa recorrência
  // acrescenta uma opção ao menu de toque longo que acabou de abrir
  function menuOption(opts) {
    var top = modalTop();
    var list = top && top.el.querySelector('.body .list');
    if (!list) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'card tap';
    b.style.cssText = 'padding:12px 14px;display:flex;align-items:center;gap:11px';
    b.innerHTML = '<span class="ic" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;' +
      'background:' + (opts.danger ? 'var(--danger-soft);color:var(--danger)' : 'var(--accent-soft);color:var(--accent)') +
      ';flex:0 0 34px">' + ic(opts.icon, 18) + '</span>' +
      '<span style="flex:1;min-width:0;text-align:left"><b style="display:block;font-size:14px">' + esc(opts.label) + '</b>' +
      (opts.sub ? '<span class="small">' + esc(opts.sub) + '</span>' : '') + '</span>';
    b.onclick = function () { closeAllModals(); opts.act(); };
    if (opts.first && list.firstChild) list.insertBefore(b, list.firstChild.nextSibling);
    else list.appendChild(b);
  }

  // salta para os Movimentos já filtrados por um imóvel
  CW.txOfProp = function (pid) {
    txFilter = ''; txProp = pid; txCat = ''; txSub = ''; txPaid = ''; txNoPayer = true; txSearch = '';
    CW._fromKpi = null;
    go('transactions');
  };

  var _lpMenu = lpMenu;
  lpMenu = function (v) {
    var s = String(v);
    if (s.indexOf('dash:') === 0) return CW.enterEdit(s.slice(5));
    _lpMenu(v);
    var a = s.split(':');
    if (a[0] === 'rec') {
      menuOption({ icon: 'x', danger: true, label: 'Recusar desta vez',
        sub: 'não cria o movimento e passa à data seguinte', act: function () { CW.rejectRec(a[1]); } });
    } else if (a[0] === 'prop') {
      menuOption({ icon: 'swap', label: 'Ver movimentos', sub: 'lista filtrada por este imóvel', first: true,
        act: function () { CW.txOfProp(a[1]); } });
    } else if (a[0] === 'ct') {
      var c = contract(a[1]);
      if (c && c.propertyId) {
        menuOption({ icon: 'swap', label: 'Ver movimentos', sub: 'lista filtrada pelo imóvel do contrato', first: true,
          act: function () { CW.txOfProp(c.propertyId); } });
      }
    }
  };

  /* ------- pendentes dentro de cada imóvel e de cada contrato ------- */

  function pendBlock(list) {
    return '<div class="cw-pend" style="margin-top:11px;border-top:1px solid var(--line);padding-top:10px">' +
      '<div class="small" style="font-weight:650;margin-bottom:7px">' +
      list.length + ' movimento' + (list.length === 1 ? '' : 's') + ' por confirmar</div>' +
      list.map(function (r) {
        var late = recIsLate(r);
        return '<div class="card pend ' + (late ? 'late' : '') + '" style="padding:9px 11px;margin-bottom:6px">' +
          '<div class="row-between" style="align-items:center;gap:9px">' +
          '<div style="min-width:0"><b style="display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.name) + '</b>' +
          '<span class="small">' + r.next + (late ? ' · <b class="neg">em atraso</b>' : ' · por confirmar') + '</span></div>' +
          '<b style="flex:0 0 auto">' + (r.tx.amount ? euro2(r.tx.amount) : '') + '</b></div>' +
          '<div class="toolbar" style="margin:8px 0 0">' +
          '<button class="btn sm primary" onclick="event.stopPropagation();quickConfirmRec(\'' + r.id + '\')">' + ic('check', 13) + ' Confirmar</button>' +
          '<button class="btn sm" onclick="event.stopPropagation();skipRec(\'' + r.id + '\')">Silenciar</button>' +
          REJECT_BTN(r.id) + '</div></div>';
      }).join('') + '</div>';
  }

  function decoratePending() {
    if (tab !== 'properties' && tab !== 'contracts') return;
    var pend = recActive();
    if (!pend.length) return;
    var pref = tab === 'properties' ? 'prop:' : 'ct:';
    [].slice.call(document.querySelectorAll('[data-lp^="' + pref + '"]')).forEach(function (cardEl) {
      var id = cardEl.getAttribute('data-lp').slice(pref.length);
      var mine = pend.filter(function (r) {
        return tab === 'properties' ? r.tx.propertyId === id : r.tx.contractId === id;
      });
      if (!mine.length || cardEl.querySelector('.cw-pend')) return;
      var w = document.createElement('div');
      w.innerHTML = pendBlock(mine);
      cardEl.appendChild(w.firstChild);
    });
  }

  /* ---------- ordem dos cartões da visão geral (modo de edição) ---------- */

  var DASH_TITLES = ['Entradas e saídas', 'Cashflow acumulado', 'Renda por contrato',
    'Cashflow por imóvel', 'Despesas sem imóvel', 'Contas entre proprietários'];

  function dashKey(el) {
    var kl = el.querySelector('.kpi .label');
    if (kl) return 'kpi:' + kl.textContent.trim();
    if (el.id === 'donutCard' || el.querySelector('#donutCard')) return 'despesas';
    var titles = [].slice.call(el.querySelectorAll('.title')).map(function (x) { return x.textContent.trim(); });
    for (var i = 0; i < titles.length; i++) if (DASH_TITLES.indexOf(titles[i]) > -1) return 'card:' + titles[i];
    // o cartão do portefólio muda de título com o filtro: identifica-se pelas linhas de estatística
    if (el.querySelector('.stat')) return 'portefolio';
    return titles.length ? 'card:' + titles[0] : '';
  }

  var _vDashboard = vDashboard;
  vDashboard = function () {
    var html = _vDashboard();
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var kids = [].slice.call(tmp.children), first = -1;
    for (var i = 0; i < kids.length; i++) if (kids[i].classList.contains('grid')) { first = i; break; }
    if (first < 0) return html; // estado vazio: nada para ordenar

    var fixed = kids.slice(0, first).map(function (n) { return n.outerHTML; }).join('');
    var items = [], j = first, pending = '';
    var push = function (html, full) {
      var d = document.createElement('div');
      d.innerHTML = html;
      items.push({ h: pending + html, k: dashKey(d.firstElementChild || d) || 'bloco', full: !!full });
      pending = '';
    };
    while (j < kids.length) {
      var n = kids[j];
      // um título de secção viaja com o bloco que anuncia
      if (n.classList.contains('section-title')) { pending = n.outerHTML; j++; continue; }
      if (n.classList.contains('cols')) {
        // cada cartão de um par é independente: move-se sozinho
        [].slice.call(n.children).forEach(function (c) { push(c.outerHTML); });
      } else {
        push(n.outerHTML, n.classList.contains('grid'));   // a fila de indicadores ocupa a largura toda
      }
      j++;
    }
    var seen = {};
    items.forEach(function (it) {
      if (seen[it.k]) it.k += '#' + (++seen[it.k]); else seen[it.k] = 1;
    });
    var order = (db.settings || {}).dashOrder || [];
    items.forEach(function (it, ix) {
      var at = order.indexOf(it.k);
      it._r = at < 0 ? 1000 + ix : at;   // cartões novos ficam no fim, pela ordem de origem
    });
    items.sort(function (a, b) { return a._r - b._r; });

    return fixed + '<div class="cw-dash">' + items.map(function (it) {
      return '<div class="cw-blk' + (it.full ? ' cw-full' : '') + '" data-k="' + esc(it.k) + '" data-lp="dash:' + esc(it.k) + '">' +
        it.h + '<span class="cw-h">' + ic('grip', 15) + '</span></div>';
    }).join('') + '</div>';
  };

  function blkByKey(k) {
    return [].slice.call(document.querySelectorAll('.cw-blk')).filter(function (x) {
      return x.getAttribute('data-k') === k;
    })[0];
  }

  function saveDashOrder() {
    var keys = [].slice.call(document.querySelectorAll('#view .cw-blk')).map(function (x) { return x.getAttribute('data-k'); });
    if (!keys.length) return;
    db.settings.dashOrder = keys;
    save();
  }

  CW.resetDashOrder = function () {
    delete db.settings.dashOrder;
    save(); render();
    toast('Ordem reposta.');
  };

  function editBar() {
    var v = view();
    if (!v || document.getElementById('cwEditBar')) return;
    var el = document.createElement('div');
    el.id = 'cwEditBar';
    el.className = 'card';
    el.style.cssText = 'margin-bottom:12px;padding:11px 13px;display:flex;align-items:center;gap:11px;flex-wrap:wrap';
    el.innerHTML = '<span class="small" style="flex:1;min-width:140px">Arrasta os cartões para mudar a ordem.</span>' +
      '<button class="btn sm" onclick="CW.resetDashOrder()">Repor ordem</button>' +
      '<button class="btn sm primary" onclick="CW.exitEdit()">' + ic('check', 14) + ' Concluir</button>';
    var grid = v.querySelector('.cw-dash');
    v.insertBefore(el, grid || v.firstChild);
  }

  function patchHdr() {
    var hb = document.getElementById('hdrFilt');
    if (!hb) return;
    if (CW.editMode && tab === 'dashboard') {
      hb.style.display = '';
      hb.innerHTML = ic('check', 16) + ' Concluir';
      hb.classList.add('primary');
      hb.title = 'Terminar a edição dos cartões';
    } else {
      hb.title = 'Filtros e parâmetros';
    }
  }

  CW.enterEdit = function (key) {
    if (tab !== 'dashboard' || CW.editMode) return;
    CW.editMode = true;
    var v = view();
    if (v) v.classList.add('cw-edit');
    editBar(); patchHdr();
    // se o dedo ainda está em cima do cartão, o arrasto começa já
    if (key && pointerDown) {
      var el = blkByKey(key);
      if (el) startDrag(el, lastY);
    }
  };

  CW.exitEdit = function (silent) {
    if (!CW.editMode) return;
    endDrag();
    CW.editMode = false;
    var v = view();
    if (v) v.classList.remove('cw-edit');
    var b = document.getElementById('cwEditBar');
    if (b) b.remove();
    render();   // devolve o botão de filtros ao cabeçalho
    if (!silent) toast('Ordem guardada.');
  };

  // o botão do cabeçalho fecha o modo de edição em vez de abrir os filtros
  var _hdrFiltToggle = hdrFiltToggle;
  hdrFiltToggle = function () {
    if (CW.editMode && tab === 'dashboard') return CW.exitEdit();
    _hdrFiltToggle();
  };

  var drag = null, lastY = 0, lastX = 0, pointerDown = false;

  function startDrag(el, clientY, clientX) {
    if (!el || drag) return;
    drag = { el: el, cont: el.parentNode, startY: clientY, startX: clientX == null ? lastX : clientX };
    el.classList.add('cw-drag');
    document.body.style.userSelect = 'none';
  }

  function blocks() {
    return [].slice.call(drag.cont.children).filter(function (x) { return x.classList.contains('cw-blk'); });
  }

  // troca só quando o centro do cartão segurado entra no espaço do outro
  // (ou seja, quando está maioritariamente já na nova posição)
  function shuffle(target, e) {
    var vr = drag.el.getBoundingClientRect();
    var after = !!(drag.el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (after) drag.cont.insertBefore(drag.el, target.nextElementSibling);
    else drag.cont.insertBefore(drag.el, target);
    drag.el.style.transform = '';
    var nr = drag.el.getBoundingClientRect();
    var offY = vr.top - nr.top, offX = vr.left - nr.left;
    drag.el.style.transform = 'translate(' + offX + 'px,' + offY + 'px)';
    drag.startY = e.clientY - offY;   // o cartão continua colado ao dedo
    drag.startX = e.clientX - offX;
  }

  document.addEventListener('pointermove', function (e) {
    lastY = e.clientY; lastX = e.clientX;
    if (!drag) return;
    e.preventDefault();
    drag.el.style.transform = 'translate(' + (e.clientX - drag.startX) + 'px,' + (e.clientY - drag.startY) + 'px)';
    var r = drag.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var list = blocks();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s === drag.el) continue;
      var sr = s.getBoundingClientRect();
      if (cx >= sr.left && cx <= sr.right && cy >= sr.top && cy <= sr.bottom) return shuffle(s, e);
    }
  }, { passive: false, capture: true });

  // já em modo de edição, o arrasto começa ao primeiro toque (sem esperar)
  document.addEventListener('pointerdown', function (e) {
    lastY = e.clientY; lastX = e.clientX;
    pointerDown = true;
    if (!CW.editMode || tab !== 'dashboard') return;
    var blk = e.target && e.target.closest ? e.target.closest('.cw-blk') : null;
    if (blk) startDrag(blk, e.clientY, e.clientX);
  }, true);

  function endDrag() {
    if (!drag) return;
    drag.el.classList.remove('cw-drag');
    drag.el.style.transform = '';
    drag = null;
    document.body.style.userSelect = '';
    saveDashOrder();
  }
  ['pointerup', 'pointercancel'].forEach(function (t) {
    document.addEventListener(t, function () { pointerDown = false; endDrag(); }, true);
  });

  var css = document.createElement('style');
  css.textContent =
    // cada cartão é um item independente da grelha (duas colunas em ecrã largo)
    '.cw-dash{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px;margin-top:14px;align-items:start}' +
    '.cw-dash>.cw-full{grid-column:1/-1}' +
    '.cw-blk{position:relative;min-width:0}' +
    '.cw-blk .cw-h{display:none}' +
    '#view.cw-edit .cw-blk{border:1.5px dashed var(--line2);border-radius:18px;padding:9px;' +
      'background:var(--tint);touch-action:none;cursor:grab}' +
    '#view.cw-edit .cw-blk>*{pointer-events:none}' +
    '#view.cw-edit .cw-blk .cw-h{display:grid;place-items:center;position:absolute;top:6px;right:8px;width:26px;height:26px;' +
      'border-radius:9px;background:var(--chip);color:var(--muted)}' +
    '#view.cw-edit .cw-blk.cw-drag{cursor:grabbing;box-shadow:var(--shadow);border-color:var(--accent);' +
      'position:relative;z-index:70;opacity:.97}';
  document.head.appendChild(css);

  /* ---------------------------------------------------------------
     Os painéis de filtros têm scroll próprio (.fpanel>.card), que
     cortava a lista de imóveis/proprietários. Dentro deles, a lista
     passa a flutuar por cima (position:fixed), ancorada ao botão.
     --------------------------------------------------------------- */

  function popAnchor(pop) {
    var btn = pop.parentNode && pop.parentNode.querySelector('.selbtn');
    if (!btn) return;
    var r = btn.getBoundingClientRect();
    var below = window.innerHeight - r.bottom - 14, above = r.top - 14;
    var up = below < 190 && above > below;
    pop.style.position = 'fixed';
    pop.style.left = r.left + 'px';
    pop.style.width = r.width + 'px';
    pop.style.right = 'auto';
    pop.style.zIndex = '120';
    pop.style.maxHeight = Math.max(150, Math.min(340, up ? above : below)) + 'px';
    if (up) { pop.style.top = 'auto'; pop.style.bottom = (window.innerHeight - r.top + 5) + 'px'; }
    else { pop.style.top = (r.bottom + 5) + 'px'; pop.style.bottom = 'auto'; }
    pop.setAttribute('data-float', '1');
  }

  function popRelease(pop) {
    if (!pop.getAttribute('data-float')) return;
    ['position', 'left', 'width', 'right', 'top', 'bottom', 'maxHeight', 'zIndex'].forEach(function (k) {
      pop.style[k] = '';
    });
    pop.removeAttribute('data-float');
  }

  function releaseAll() {
    [].slice.call(document.querySelectorAll('.selpop[data-float]')).forEach(function (p) {
      if (!p.classList.contains('on')) popRelease(p);
    });
  }

  var _selOpen = selOpen;
  selOpen = function (e, id) {
    _selOpen(e, id);
    releaseAll();
    var pop = document.getElementById('pop_' + id);
    if (!pop) return;
    if (!pop.classList.contains('on')) return popRelease(pop);
    var panel = pop.closest ? pop.closest('.fpanel') : null;
    if (!panel) return;                 // fora dos painéis de filtro nada muda
    popAnchor(pop);
    var scroller = panel.querySelector('.card');
    if (scroller && !scroller._cwHooked) {
      scroller._cwHooked = 1;
      scroller.addEventListener('scroll', function () {
        [].slice.call(panel.querySelectorAll('.selpop.on[data-float]')).forEach(popAnchor);
      });
    }
  };

  var _selPick = selPick;
  selPick = function (e, id, i) {
    var pop = document.getElementById('pop_' + id);
    _selPick(e, id, i);
    if (pop) popRelease(pop);
  };

  var _closePops = closePops;
  closePops = function (keep) {
    _closePops(keep);
    releaseAll();
  };

  window.addEventListener('resize', function () {
    [].slice.call(document.querySelectorAll('.selpop.on[data-float]')).forEach(popAnchor);
  });

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
  var authCfg; // /api/auth/config (ids públicos do Google/Apple), em cache

  // forte: 8+ caracteres com maiúsculas, minúsculas, números e um símbolo
  function passProblem(p) {
    p = String(p || '');
    if (p.length < 8) return 'A palavra-passe precisa de pelo menos 8 caracteres.';
    if (!/[A-Z]/.test(p)) return 'A palavra-passe precisa de uma letra maiúscula.';
    if (!/[a-z]/.test(p)) return 'A palavra-passe precisa de uma letra minúscula.';
    if (!/[0-9]/.test(p)) return 'A palavra-passe precisa de um número.';
    if (!/[^A-Za-z0-9]/.test(p)) return 'A palavra-passe precisa de um símbolo (ex.: ! ? € .).';
    return '';
  }

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
      '<input id="cwa_pass" type="password" placeholder="Palavra-passe" autocomplete="' + (login ? 'current-password' : 'new-password') + '">' +
      (login ? '' :
        '<div id="cwa_passreq" class="small" style="margin:-4px 0 0;display:flex;flex-wrap:wrap;gap:3px 12px"></div>' +
        '<input id="cwa_pass2" type="password" placeholder="Confirmar palavra-passe" autocomplete="new-password">') +
      '<div id="cwa_err" class="small" style="color:var(--danger)"></div>' +
      '<button class="btn primary" style="width:100%;justify-content:center" onclick="CW.submitAuth()">' + (login ? 'Entrar' : 'Criar conta') + '</button>' +
      '<button class="btn" style="width:100%;justify-content:center" onclick="CW.toggleAuth()">' +
      (login ? 'Ainda não tenho conta' : 'Já tenho conta') + '</button>' +
      '<div id="cwa_social" style="display:none">' +
      '<div style="display:flex;align-items:center;gap:10px;margin:4px 0"><span style="flex:1;height:1px;background:var(--line)"></span>' +
      '<span class="small">ou</span><span style="flex:1;height:1px;background:var(--line)"></span></div>' +
      '<div id="cwa_gbtn" style="display:flex;justify-content:center;margin-bottom:8px"></div>' +
      '</div></div></div>';
    lockScroll(true);
    var last = document.getElementById(login ? 'cwa_pass' : 'cwa_pass2');
    if (last) last.addEventListener('keydown', function (e) { if (e.key === 'Enter') CW.submitAuth(); });
    if (!login) {
      // email: valida o formato ao sair do campo
      var em = document.getElementById('cwa_email'), errEl = document.getElementById('cwa_err');
      em.addEventListener('blur', function () {
        var v = em.value.trim();
        if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errEl.textContent = 'Email inválido — confirma o formato (ex.: nome@exemplo.pt).';
        else if (errEl.textContent.indexOf('Email inválido') === 0) errEl.textContent = '';
      });
      em.addEventListener('input', function () {
        if (errEl.textContent.indexOf('Email inválido') === 0) errEl.textContent = '';
      });
      // palavra-passe: requisitos verificados enquanto escreve
      var reqs = [
        ['len', '8+ caracteres', function (p) { return p.length >= 8; }],
        ['up', 'maiúscula', function (p) { return /[A-Z]/.test(p); }],
        ['low', 'minúscula', function (p) { return /[a-z]/.test(p); }],
        ['num', 'número', function (p) { return /[0-9]/.test(p); }],
        ['sym', 'símbolo', function (p) { return /[^A-Za-z0-9]/.test(p); }],
      ];
      var reqBox = document.getElementById('cwa_passreq');
      reqBox.innerHTML = reqs.map(function (r) { return '<span id="cwa_rq_' + r[0] + '">• ' + r[1] + '</span>'; }).join('');
      var pw = document.getElementById('cwa_pass');
      var paintReqs = function () {
        var p = pw.value;
        reqs.forEach(function (r) {
          var el = document.getElementById('cwa_rq_' + r[0]);
          if (!el) return;
          var ok = r[2](p);
          el.textContent = (ok ? '✓ ' : '• ') + r[1];
          el.style.color = ok ? 'var(--accent)' : 'var(--muted)';
          el.style.fontWeight = ok ? '650' : '400';
        });
      };
      paintReqs();
      pw.addEventListener('input', paintReqs);
    }
    loadSocial();
  }
  CW.showAuth = function () { showAuth(); };

  CW.toggleAuth = function () {
    CW.showAuthMode = CW.showAuthMode === 'login' ? 'register' : 'login';
    showAuth();
  };

  function finishLogin(u) {
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
    showLegalGate();
    startSync();
  }

  CW.submitAuth = function () {
    var login = CW.showAuthMode !== 'register';
    var payload = { email: val('cwa_email'), password: val('cwa_pass') };
    var errEl = document.getElementById('cwa_err');
    errEl.textContent = '';
    if (!login) {
      payload.name = val('cwa_name');
      var prob = passProblem(payload.password);
      if (prob) { errEl.textContent = prob; return; }
      if (payload.password !== val('cwa_pass2')) {
        errEl.textContent = 'As palavras-passe não coincidem.';
        return;
      }
    }
    api('POST', login ? '/api/auth/login' : '/api/auth/register', payload)
      .then(finishLogin)
      .catch(function (e) { errEl.textContent = e.message || 'Não foi possível entrar.'; });
  };

  /* ---- entrada com Google / Apple (aparece quando configurada) ---- */

  function loadScript(src, cb) {
    var s = document.querySelector('script[src="' + src + '"]');
    if (s) { if (s._loaded) cb(); else s.addEventListener('load', cb); return; }
    s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = function () { s._loaded = 1; cb(); };
    document.head.appendChild(s);
  }

  function loadSocial() {
    var mount = document.getElementById('cwa_social');
    if (!mount) return;
    (authCfg !== undefined
      ? Promise.resolve(authCfg)
      : api('GET', '/api/auth/config').then(function (c) { authCfg = c; return c; }).catch(function () { return null; })
    ).then(function (cfg) {
      if (!cfg || !cfg.google) return;
      mount.style.display = '';
      loadScript('https://accounts.google.com/gsi/client', function () {
        try {
          google.accounts.id.initialize({
            client_id: cfg.google,
            callback: function (resp) { socialLogin('google', { credential: resp.credential }); },
          });
          var g = document.getElementById('cwa_gbtn');
          if (g) google.accounts.id.renderButton(g, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
        } catch (e) {}
      });
    });
  }

  function socialLogin(provider, body) {
    var errEl = document.getElementById('cwa_err');
    api('POST', '/api/auth/' + provider, body)
      .then(finishLogin)
      .catch(function (e) { if (errEl) errEl.textContent = e.message || 'Não foi possível entrar.'; });
  }


  function hideAuth() {
    if (authEl) authEl.style.display = 'none';
    lockScroll(false);
  }

  /* ---------------- PWA ---------------- */

  if ('serviceWorker' in navigator) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }

  /* ---------------- arranque ---------------- */

  if (CW.user) {
    // sessão em cache: volta à página onde estava e sincroniza em fundo
    try { restorePage(); } catch (e) {}
    showLegalGate();
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
