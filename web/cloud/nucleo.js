/* Sessao, sincronizacao com o servidor e reconstrucao dos dados locais. */
'use strict';

var LS_USER = 'gi_cloud_user';   // sessão {id,name,email,token}
var LS_OWNER = 'gi_cloud_owner'; // id do utilizador dono da cache local
// 3 minutos entre leituras: com 90 segundos, uma app aberta o dia todo
// sozinha consumia uma fatia enorme do plano gratuito da base de dados.
var PULL_MS = 180000;

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
    .then(function () { saveSnap(); setSyncBadge('ok'); try { subirPendentes(); } catch (e) {} })
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
