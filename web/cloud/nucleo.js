/* Sessao, sincronizacao com o servidor e reconstrucao dos dados locais. */
'use strict';

var LS_USER = 'gi_cloud_user';   // sessão {id,name,email,token}
var LS_OWNER = 'gi_cloud_owner'; // id do utilizador dono da cache local
// 3 minutos entre leituras: com 90 segundos, uma app aberta o dia todo
// sozinha consumia uma fatia enorme do plano gratuito da base de dados.
var PULL_MS = 180000;

var CW = (window.CW = {});
CW.user = null;
CW.state = { connections: [], roles: [], collaborators: [], invites: [], people: [], shareLink: null, shareRequests: { incoming: [], outgoing: [] } };
CW.cargos = {};    // por imóvel: {dono, nome, perms} — vem de cargosDoEstado (web/app/acessos.js)
CW.pessoas = {};   // por id de utilizador: {name, kind, roleName} — quem não é proprietário mas tem nome

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
// Tema guardado neste aparelho; 'auto' se nada houver ou se o localStorage falhar.
// Devolve: o tema em texto (o guardado, ou 'auto' na falta dele).
function localTheme() {
  try { return localStorage.getItem(LS_THEME) || 'auto'; } catch (e) { return 'auto'; }
}
// Sobrepõe o tema do aparelho ao que estiver em db.settings e aplica-o.
// Devolve: nada — escreve db.settings.theme e chama applyTheme().
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
// Carrega do aparelho o retrato do servidor (chave -> JSON do que já lá está).
// Devolve: nada — preenche a variável snap ({} se nada houver ou a leitura falhar).
function loadSnap() { try { snap = JSON.parse(localStorage.getItem(snapKey()) || '{}'); } catch (e) { snap = {}; } }
// Guarda o retrato no aparelho; se o localStorage falhar, refaz-se no próximo pull.
// Devolve: nada — grava snap no localStorage.
function saveSnap() { try { localStorage.setItem(snapKey(), JSON.stringify(snap)); } catch (e) {} }

/* ---------------- API ---------------- */

/* Chamada à API: junta o token da sessão, serializa 'data' em JSON e devolve
   a resposta já decomposta. Um 401 fora de /api/auth/ encerra a sessão local
   (sessionLost). Resposta não-ok rejeita com um Error cuja mensagem vem do
   servidor e com .status preenchido.
   Recebe: method — o verbo HTTP ('GET', 'POST', …); path — o caminho do pedido
   (ex.: '/api/state'); data (opcional) — corpo do pedido, serializado em JSON.
   Devolve: Promise com o JSON da resposta ({} se o corpo não for JSON); rejeita
   com esse Error quando a resposta não é ok. */
function api(method, path, data) {
  var opts = { method: method, headers: {}, credentials: 'same-origin' };
  if (CW.user && CW.user.token) opts.headers['Authorization'] = 'Bearer ' + CW.user.token;
  if (data !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  }
  return fetch(path, opts).catch(function (e) { rastoPoe(method + ' ' + path + ' → sem rede'); throw e; }).then(function (r) {
    rastoPoe(method + ' ' + path + ' → ' + r.status);
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (r.status === 401 && CW.user && path.indexOf('/api/auth/') !== 0) {
        sessionLost();
      }
      if (!r.ok) { var e = new Error(j.error || ('Erro ' + r.status)); e.status = r.status; throw e; }
      return j;
    });
  });
}

// O rasto do que a pessoa andava a fazer: as últimas chamadas à API e
// mudanças de ecrã, num anel de 10 entradas em memória. Vai no relato de
// cada erro — «rebentou em Movimentos» diz pouco; «depois de POST /api/sync
// → 500» diz onde procurar.
// Recebe: s — a entrada a registar (texto; corta-se a 80 caracteres).
// Devolve: nada — acrescenta ao anel CW._rasto.
function rastoPoe(s) {
  try {
    CW._rasto = CW._rasto || [];
    CW._rasto.push(String(s).slice(0, 80));
    if (CW._rasto.length > 10) CW._rasto.shift();
  } catch (e) {}
}

// Deita fora a sessão local e volta ao ecrã de entrada, com aviso de expiração.
// Devolve: nada — limpa CW.user e mostra o ecrã de entrada.
function sessionLost() {
  CW.user = null;
  try { localStorage.removeItem(LS_USER); } catch (e) {}
  showAuth('A sessão expirou — inicia sessão de novo.');
}

/* ---------------- exportação: db -> entidades do servidor ------------- */

// Cópia profunda sem as chaves de trabalho (as que começam por '_'):
// é esta a forma que segue para o servidor.
// Recebe: o — o objeto a limpar (tem de ser serializável em JSON).
// Devolve: cópia profunda do objeto, sem as chaves que começam por '_'.
function strip(o) {
  var c = JSON.parse(JSON.stringify(o));
  Object.keys(c).forEach(function (k) { if (k.charAt(0) === '_') delete c[k]; });
  return c;
}

// As quotas são geridas pelo servidor (propostas com confirmação): a casa
// exportada nunca as leva, para um cliente desatualizado não as reverter.
// Recebe: p — o imóvel (um objeto de db.properties).
// Devolve: cópia limpa (via strip) e ainda sem ownerIds nem ownerShares.
function stripHouse(p) {
  var c = strip(p);
  delete c.ownerIds;
  delete c.ownerShares;
  return c;
}

/* Um imóvel que é meu de raiz (criei-o eu): nem partilhado por outro nem de
   colaboração. É o critério de quem gere partilha, colaboradores, quotas e
   apagar — a decisão pura (souCriador) vive em web/app/acessos.js; sem ela,
   valem as marcas.
   Recebe: p — o imóvel (objeto de db.properties; aguenta null).
   Devolve: true se o imóvel é meu de raiz; false caso contrário. */
function cwMinha(p) {
  if (!p || p._sharedFrom || p._cargo) return false;
  if (typeof souCriador === 'function') return !!souCriador(p.id);
  return typeof souDono === 'function' ? !!souDono(p.id) : true;
}

// Os tipos de registo com uma família de permissões (a cópia de recurso de
// KIND_PERM, em web/app/acessos.js); o que não está aqui nunca sobe de um
// imóvel de colaboração.
var KIND_PERM_LOCAL = { contract: 'contract', tx: 'tx', rec: 'rec', visit: 'visit', tenant: 'tenant' };

/* Se este utilizador pode enviar esta entidade ao servidor. Nos imóveis
   próprios ou em compropriedade, tudo; nos de colaboração, a ficha do imóvel
   só com house.edit e os registos só dos tipos cujo cargo dá «.add». Sem a
   função pode() (acessos.js por carregar), nada sobe desses imóveis — o
   servidor recusava na mesma, mas poupa-se o pedido.
   Recebe: houseId — o id do imóvel; kind (opcional) — o tipo do registo
   ('contract', 'tx', …); sem ele avalia-se a ficha do imóvel.
   Devolve: true se pode subir; false se não. */
function podeExportar(houseId, kind) {
  var p = (db.properties || []).find(function (x) { return x.id === houseId; });
  if (!p || !p._cargo) return true;
  if (typeof pode !== 'function') return false;
  if (!kind) return !!pode(houseId, 'house.edit');
  var fam = null;
  try { if (typeof KIND_PERM !== 'undefined' && KIND_PERM) fam = KIND_PERM[kind]; } catch (e) {}
  if (!fam) fam = KIND_PERM_LOCAL[kind];
  return !!fam && !!pode(houseId, fam + '.add');
}

/* O imóvel a que uma ficha de inquilino está presa: o campo houseId, que a
   app grava na ficha (criada a partir de uma visita, ou num imóvel de
   colaboração), ou a marca _houseId que o servidor põe ao vir de um registo
   de casa. Uma ficha só minha não tem nenhum dos dois.
   Recebe: t — a ficha do inquilino (aguenta null).
   Devolve: o id do imóvel (texto), ou '' quando a ficha não está presa a nenhum. */
function casaDaFicha(t) {
  return (t && (t.houseId || t._houseId)) || '';
}

/* Mapa completo do que este utilizador deve ter no servidor.
   chave -> {scope, houseId?, kind?, id?, data}
   Uma ficha de inquilino presa a um imóvel (casaDaFicha) é um registo desse
   imóvel — r:<casa>:tenant:<id> — com ou sem contrato, tal como as ligadas por
   contrato. Presa a um imóvel de colaboração, é só isso: é assim que a ficha
   que um colaborador com tenant.add cria («Converter em inquilino») chega ao
   dono. Presa a um imóvel meu, ou a um que já não existe, sobe também como
   u:tenant — uma ficha do dono nunca fica sem chave (era assim que se perdia
   ao apagar o imóvel).
   Devolve: esse mapa (objeto), montado a partir do db local já limpo por strip. */
function exportEntities() {
  var map = {};
  var owners = db.owners || [], tenants = db.tenants || [];
  (db.properties || []).forEach(function (p) {
    // num imóvel de colaboração só sobe o que o cargo deixa (podeExportar)
    if (podeExportar(p.id)) map['h:' + p.id] = { scope: 'house', houseId: p.id, data: stripHouse(p) };
    var persons = {};
    (db.contracts || []).forEach(function (c) {
      if (c.propertyId !== p.id) return;
      if (podeExportar(p.id, 'contract')) map['r:' + p.id + ':contract:' + c.id] = { scope: 'record', houseId: p.id, kind: 'contract', id: c.id, data: strip(c) };
      (c.tenantIds || []).forEach(function (tid) {
        var t = tenants.find(function (x) { return x.id === tid; });
        if (t) persons['tenant:' + tid] = t;
      });
    });
    // as fichas presas a este imóvel, mesmo sem contrato (podeExportar decide abaixo)
    tenants.forEach(function (t) {
      if (casaDaFicha(t) === p.id) persons['tenant:' + t.id] = t;
    });
    (db.transactions || []).forEach(function (t) {
      if (t.propertyId !== p.id || !podeExportar(p.id, 'tx')) return;
      map['r:' + p.id + ':tx:' + t.id] = { scope: 'record', houseId: p.id, kind: 'tx', id: t.id, data: strip(t) };
    });
    (db.recurring || []).forEach(function (r) {
      if (!(r.tx && r.tx.propertyId === p.id) || !podeExportar(p.id, 'rec')) return;
      map['r:' + p.id + ':rec:' + r.id] = { scope: 'record', houseId: p.id, kind: 'rec', id: r.id, data: strip(r) };
    });
    (db.visits || []).forEach(function (v) {
      if (v.propertyId !== p.id || !podeExportar(p.id, 'visit')) return;
      map['r:' + p.id + ':visit:' + v.id] = { scope: 'record', houseId: p.id, kind: 'visit', id: v.id, data: strip(v) };
    });
    Object.keys(persons).forEach(function (k) {
      var kind = k.split(':')[0], id = k.split(':')[1];
      if (!podeExportar(p.id, kind)) return;
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
  // as fichas minhas sobem como registo de utilizador; as presas a um imóvel
  // de colaboração já subiram (ou não podem subir) como registo dessa casa.
  // Uma presa a um imóvel meu sobe também aqui, e uma presa a um imóvel que
  // já não está em db.properties (apagado) só aqui — nunca fica sem chave
  tenants.forEach(function (t) {
    if (t._sharedFrom) return;
    var h = casaDaFicha(t);
    if (h && !souDono(h) && prop(h)) return;
    map['u:tenant:' + t.id] = { scope: 'user', kind: 'tenant', id: t.id, data: strip(t) };
  });
  var st = strip(db.settings);
  delete st.theme;   // preferência do aparelho: fica de fora da sincronização
  map['u:settings:main'] = { scope: 'user', kind: 'settings', id: 'main', data: st };
  return map;
}

// Decompõe uma chave do retrato ('h:...', 'r:...', 'u:...') em {scope, houseId?,
// kind?, id?} — o inverso das chaves que exportEntities() constrói.
// Recebe: k — a chave em texto ('h:casa', 'r:casa:tipo:id' ou 'u:tipo:id').
// Devolve: objeto {scope, houseId?, kind?, id?} com as partes da chave.
function parseKey(k) {
  var p = k.split(':');
  if (p[0] === 'h') return { scope: 'house', houseId: p[1] };
  if (p[0] === 'r') return { scope: 'record', houseId: p[1], kind: p[2], id: p.slice(3).join(':') };
  return { scope: 'user', kind: p[1], id: p.slice(2).join(':') };
}

/* ---------------- push ---------------- */

var pushing = false, pushAgain = false, pushTimer = null;

// Agenda um envio daqui a 1,2s, juntando alterações seguidas num só push.
// Devolve: nada — (re)arma o temporizador que chama pushNow.
function schedulePush() {
  if (!CW.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(function () { pushNow(); }, 1200);
}

/* O que o plano recusou (402) fica marcado e não se reenvia: sem isto, a
   mesma operação voltava a cada 30 segundos para sempre, a queimar quota.
   A marca vive só nesta sessão — mudar de plano ou o master desligar o
   modo demo e recarregar volta a tentar tudo. */
var _plano402 = {};
var _avisosPlano = {};
// Cada aviso de limite do plano aparece uma única vez por sessão (toast de 6s).
// Recebe: msg — o texto do aviso vindo do servidor (vazio: não faz nada).
// Devolve: nada — mostra o toast à primeira e ignora as repetições.
function avisoPlano(msg) {
  if (!msg || _avisosPlano[msg]) return;
  _avisosPlano[msg] = 1;
  try { toast(msg, { ms: 6000 }); } catch (e) {}
}

// A descrição curta de um registo, para os avisos («Renda de março», «T2 — Ana»).
// Recebe: kind — o tipo ('tx', 'contract', 'rec', 'visit', 'tenant'); data — o registo.
// Devolve: um texto curto; o tipo por extenso quando o registo não tem nome.
function descricaoDe(kind, data) {
  var d = data || {};
  var nomes = { tx: 'O movimento', contract: 'O contrato', rec: 'O planeado', visit: 'A visita', tenant: 'A ficha de inquilino' };
  var t = kind === 'tx' ? (d.label || d.category) : kind === 'visit' ? d.nomes : (d.name || d.label);
  return t ? String(t).slice(0, 60) : (nomes[kind] || 'O registo');
}

/* O servidor recusou um registo por falta de permissão (403 num put de
   registo, num imóvel onde sou colaborador): sai da base local — o próximo
   pull traz a versão dele, se existir —, fica em db._recusados para
   consulta, e diz-se na hora. Sem isto a pessoa via o registo «guardado» e
   ele nunca subia.
   Recebe: o — a operação do push ({kind, id, houseId, data, _key}); erro — a
   frase do servidor (pode vir vazia).
   Devolve: nada — mexe em db e junta a descrição à lista para o toast. */
function recusaRegisto(o, erro) {
  var listas = { contract: 'contracts', tx: 'transactions', rec: 'recurring', visit: 'visits', tenant: 'tenants' };
  var lista = db[listas[o.kind]] || [];
  var i = -1;
  for (var k = 0; k < lista.length; k++) if (lista[k].id === o.id) { i = k; break; }
  var reg = i > -1 ? lista.splice(i, 1)[0] : null;
  db._recusados = db._recusados || [];
  db._recusados.push({ kind: o.kind, id: o.id, houseId: o.houseId, erro: erro || '', data: reg || o.data, at: Date.now() });
  if (db._recusados.length > 50) db._recusados.shift();
  pushNow._recusadosAgora = (pushNow._recusadosAgora || []).concat([descricaoDe(o.kind, reg || o.data)]);
}

/* Envia ao servidor a diferença entre o estado local e o retrato: 'put' do que
   mudou (casas primeiro, que os registos dependem delas) e 'del' do que
   desapareceu, em lotes de 200. Atualiza o retrato à medida que o servidor
   aceita, marca as recusas do plano (402) para não reinsistir e acerta o selo
   de sincronização. Reentrante: se já está a enviar, fica marcado um novo
   envio para o fim. A Promise devolvida nunca rejeita.
   Devolve: Promise que resolve quando o envio terminar (nunca rejeita). */
function pushNow() {
  if (!CW.user) return Promise.resolve();
  if (pushing) { pushAgain = true; return Promise.resolve(); }
  pushing = true;
  var map = exportEntities();
  var ops = [];
  // casas primeiro (os registos precisam da casa), remoções no fim
  Object.keys(map).forEach(function (k) {
    if (_plano402[k]) return;   // o plano já disse que não; não se insiste
    var j = JSON.stringify(map[k].data);
    if (snap[k] !== j) ops.push(Object.assign({ _key: k, _json: j, op: 'put' }, map[k]));
  });
  ops.sort(function (a, b) {
    var w = function (o) { return o.scope === 'house' ? 0 : 1; };
    return w(a) - w(b);
  });
  var sharedHouses = {};
  (CW.state.houses || []).forEach(function (h) { if (!h.mine) sharedHouses[h.id] = 1; });
  /* o que vai subir agora e o que a pessoa tem por enviar: diz-se, em vez de
     ficar em silencio ate correr mal */
  if (ops.length) setSyncBadge('pend', ops.length);
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
            else if (r.status === 402) { _plano402[o._key] = 1; avisoPlano(r.error); }
            // sem permissão num imóvel de colaboração: o registo não fica a fingir que subiu
            else if (o.op === 'put' && o.scope === 'record' && r.status === 403) recusaRegisto(o, r.error);
            else pushNow._recusadas = (pushNow._recusadas || 0) + 1;
          });
        });
      });
    })(ops.slice(i, i + 200));
  }
  return chain
    .then(function () {
      saveSnap();
      /* um 200 com operações recusadas lá dentro ficava 'ok' para sempre,
         com o selo verde e os dados sem subir */
      var recusadas = pushNow._recusadas || 0; pushNow._recusadas = 0;
      setSyncBadge(recusadas ? 'off' : 'ok');
      var fora = pushNow._recusadosAgora || []; pushNow._recusadosAgora = [];
      if (fora.length) {
        try { rawSet(KEY, JSON.stringify(db)); render(); } catch (e) {}
        try {
          toast(fora[0] + ' não foi guardado: sem permissão neste imóvel.' +
            (fora.length > 1 ? ' E mais ' + (fora.length - 1) + '.' : ''), { ms: 6000 });
        } catch (e) {}
      }
      try { subirPendentes(); } catch (e) {}
    })
    .catch(function () { pushNow._recusadas = 0; setSyncBadge('off'); })
    .then(function () {
      pushing = false;
      if (pushAgain) { pushAgain = false; schedulePush(); }
    });
}

/* ---------------- pull ---------------- */

var lastPull = 0;

// Se um id está num conjunto que pode vir como Set, array ou objeto (a forma
// de ownersIds depende de quem o montou).
// Recebe: conj — o conjunto (Set, array ou objeto {id: true}; aguenta null); id — o id.
// Devolve: true se está lá.
function temId(conj, id) {
  if (!conj) return false;
  if (typeof conj.has === 'function') return conj.has(id);
  if (Array.isArray(conj)) return conj.indexOf(id) > -1;
  return !!conj[id];
}

/* Quem conta como proprietário para a base local: eu, quem está em
   participants de algum imóvel e quem tem ligação aceite comigo. É a cópia
   de recurso do ownersIds de cargosDoEstado (web/app/acessos.js), para o
   rebuildDb nunca meter um colaborador em db.owners.
   Recebe: st — o estado de GET /api/state; myId — o meu id.
   Devolve: objeto {id: true} com os ids. */
function donosDoEstado(st, myId) {
  var out = {};
  if (myId) out[myId] = true;
  (st.houses || []).forEach(function (h) {
    (h.participants || [h.ownerId]).forEach(function (u) { if (u) out[u] = true; });
  });
  (st.connections || []).forEach(function (c) {
    if (c.status === 'accepted' && c.peer && c.peer.id) out[c.peer.id] = true;
  });
  return out;
}

// Os colaboradores de um imóvel meu, lidos de st.collaborators (que só o dono recebe).
// Recebe: st — o estado; houseId — o id do imóvel.
// Devolve: array de {id, userId, name, roleId, roleName} (vazio quando não há).
function colaboradoresDe(st, houseId) {
  return (st.collaborators || []).filter(function (c) {
    return (c.houses || []).some(function (h) { return h.id === houseId; });
  }).map(function (c) {
    return { id: c.id, userId: c.userId, name: c.name || '', roleId: c.roleId, roleName: c.roleName || '' };
  });
}

/* Quem colabora num imóvel onde sou dono ou comproprietário: a lista que o
   servidor manda na própria casa (h.collaborators — vem também nas casas em
   compropriedade, para o comproprietário ver quem lá entra) ou, num servidor
   que ainda não a manda, a lista global do dono (só nas minhas).
   Recebe: st — o estado; h — a casa do estado ({id, mine, collaborators?}).
   Devolve: array de {id, userId, name, roleId, roleName} (vazio quando não há). */
function colaboradoresDaCasa(st, h) {
  if (Array.isArray(h.collaborators)) {
    return h.collaborators.map(function (c) {
      return { id: c.id, userId: c.userId, name: c.name || '', roleId: c.roleId || '', roleName: c.roleName || '' };
    });
  }
  return h.mine ? colaboradoresDe(st, h.id) : [];
}

/* Se este utilizador é um colaborador puro: tem cargo em imóveis meus e
   nenhuma casa em comum comigo (é o kind 'collab' de st.people). É o único
   que nunca vira ficha em db.owners.
   Recebe: uid — o id do utilizador.
   Devolve: true se é colaborador puro; false para donos, comproprietários e desconhecidos. */
function colaboradorPuro(uid) {
  var pe = CW.pessoas && CW.pessoas[uid];
  return !!(pe && pe.kind === 'collab');
}

/* Reconstrói a base local inteira a partir do estado do servidor: casas com
   donos e quotas vindas de lá, registos por casa, dados do utilizador e
   perfis — os "proprietários" passam a ser os utilizadores com acesso.
   Os imóveis onde sou colaborador levam _cargo (e _sharedFrom); os meus e os
   em compropriedade levam _colaboradores; um colaborador nunca entra em
   ownerIds nem em db.owners — fica em CW.pessoas, só com o nome. Quem vem
   em profiles sem ser colaborador (comproprietário de outrora, conta apagada
   «[deleted]» referida num movimento) continua a virar ficha, só com o nome.
   Devolve o db novo, normalizado e filtrado por dropUnsafe; não toca no
   db global.
   Recebe: st — o estado vindo de GET /api/state ({houses, records, userRecords,
   profiles, collaborators, people, …}).
   Devolve: o db novo (objeto com a forma de blank), pronto a substituir o local. */
function rebuildDb(st) {
  var d = JSON.parse(JSON.stringify(blank));
  var myId = CW.user ? CW.user.id : '';
  var tenants = {};
  var myProfile = null;
  // quem é o quê em cada imóvel: a parte pura vive em web/app/acessos.js
  var acessos = null;
  try { if (typeof cargosDoEstado === 'function') acessos = cargosDoEstado(st, myId); } catch (e) { acessos = null; }
  CW.cargos = (acessos && acessos.cargos) || {};
  CW.pessoas = (acessos && acessos.pessoas) || {};
  var ownersIds = (acessos && acessos.ownersIds) || donosDoEstado(st, myId);
  if (!acessos) {
    (st.people || []).forEach(function (u) { if (u && u.id) CW.pessoas[u.id] = { name: u.name || '', kind: u.kind || '', roleName: u.roleName || '' }; });
  }
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
      // colaborador: o cargo (para o selo e as decisões) e a linha de
      // colaboração (para o «Sair»); dono: quem colabora neste imóvel
      if (h.collab) {
        p._cargo = h.collab.roleName || 'Colaborador';
        if (h.collab.id) p._collabId = h.collab.id;
        if (!acessos) CW.cargos[h.id] = { dono: false, nome: p._cargo, perms: h.collab.perms || [] };
      } else if (!acessos) CW.cargos[h.id] = { dono: true };
      if (!h.collab) p._colaboradores = colaboradoresDaCasa(st, h);
      // os donos do imóvel são os utilizadores com acesso (dono + partilhas);
      // as quotas vêm do servidor e só mudam por proposta confirmada. Um
      // colaborador nunca está aqui — nem eu, num imóvel onde o sou.
      var parts = (h.participants || [h.ownerId]).filter(function (u) { return !(h.collab && u === myId); });
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
      // quem escreveu e quando, para o sino das notificações; os campos com
      // _ nunca voltam ao servidor (o strip tira-os no export)
      var marca = function (x) {
        if (r.author) x._author = r.author;
        if (r.updatedAt) x._atServidor = r.updatedAt;
        if (r.createdBy) x._createdBy = r.createdBy;   // quem criou: só ele (ou o dono) edita
        return x;
      };
      if (r.kind === 'contract') d.contracts.push(marca(normContract(r.data)));
      else if (r.kind === 'tx') d.transactions.push(marca(normTx(r.data)));
      else if (r.kind === 'rec') d.recurring.push(marca(normRec(r.data)));
      else if (r.kind === 'visit') d.visits.push(marca(normVisit(r.data)));
      else if (r.kind === 'tenant') {
        if (!tenants[r.id]) {
          var per = marca(normPerson(r.data));
          if (!mine) per._sharedFrom = h ? h.ownerName : '';
          // o imóvel da ficha: é por ele que se decide quem a edita e onde
          // se mostra. Fica na ficha (houseId, sobe com ela) e na marca do
          // servidor (_houseId), para o dono e o colaborador a verem no
          // imóvel certo
          per.houseId = r.houseId;
          per._houseId = r.houseId;
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
  // quem é referido em «pago por» ou num acerto de algum movimento (das
  // casas ou meu): ganha ficha mesmo que o servidor o marque colaborador —
  // o ex-comproprietário que pagou o condomínio e hoje só colabora
  var referidos = {};
  d.transactions.forEach(function (t) {
    if (t.paidBy) referidos[t.paidBy] = true;
    if (t.toId) referidos[t.toId] = true;
  });
  (st.profiles || []).forEach(function (pr) {
    if (pr.userId === myId) return;
    // um colaborador puro que nenhum movimento refere nunca vira ficha de
    // proprietário — fica em CW.pessoas, com o nome. Todos os outros
    // (comproprietários, ligações aceites e quem é referido em paidBy/toId
    // de movimentos: contas apagadas «[deleted]», ex-comproprietários, mesmo
    // que hoje sejam colaboradores) viram ficha só com o nome, para «Pago
    // por …», os acertos e o CSV continuarem legíveis
    if (!temId(ownersIds, pr.userId) && !referidos[pr.userId] && colaboradorPuro(pr.userId)) return;
    var per = normPerson(pr.data || {});
    per.id = pr.userId;
    per._userId = pr.userId;
    if (!per.name) per.name = pr.name || (CW.pessoas[pr.userId] || {}).name || pr.userId;
    ownersOut[pr.userId] = per;
  });
  d.owners = Object.keys(ownersOut).map(function (k) { return ownersOut[k]; });
  d.tenants = Object.keys(tenants).map(function (k) { return tenants[k]; });
  fillCats(d.settings);
  if (!Array.isArray(d.settings.tags)) d.settings.tags = TAGS0.slice();
  return dropUnsafe(d);
}

/* Acabou a espera pelo primeiro estado do servidor.

   Enquanto ela dura, a app não afirma nada que o servidor possa desmentir a
   seguir: sem isto, o sino contava rendas já confirmadas noutro aparelho e o
   cartão dos «por confirmar» anunciava-as, tudo a desaparecer um segundo
   depois (auxiliares.js:sabemosOEstado). Mas a espera tem de ACABAR, e não só
   quando o servidor responde: sem rede, o que está no aparelho é tudo o que
   há, e calar o sino para sempre era trocar um erro de um segundo por um
   silêncio permanente.

   Distinto do CW._pulled de propósito: esse continua a dizer «o servidor
   falou», que é o que a página dos cargos precisa de saber para não confundir
   «não tens colaboradores» com «ainda não sabemos».
   Devolve: nada — levanta a espera e repinta, uma vez só. */
function fimDaEspera() {
  if (CW._esperaFim) return;
  CW._esperaFim = 1;
  try { buildNav(); render(); } catch (e) {}
}
/* Adota o estado do servidor: substitui o db local, refaz o retrato (o que o
   servidor não tem fica de fora, para o próximo push o enviar; o que só ele
   tem fica marcado para apagar), grava tudo no aparelho e redesenha a app.
   Recebe: st — o estado vindo de GET /api/state (o mesmo que rebuildDb recebe).
   Devolve: nada — substitui db e snap, grava no aparelho e redesenha. */
function applyState(st) {
  CW._pulled = 1;   // já falámos com o servidor: o que estiver vazio está mesmo vazio
  CW._esperaFim = 1;   // e por isso a app já pode afirmar o que sabe
  // os campos novos do estado (cargos, colaboradores, convites, ligação,
  // pedidos, pessoas) ficam sempre com forma, venham ou não do servidor
  ['roles', 'collaborators', 'invites', 'people', 'connections'].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
  if (!st.shareLink || typeof st.shareLink !== 'object') st.shareLink = null;
  if (!st.shareRequests || typeof st.shareRequests !== 'object') st.shareRequests = {};
  if (!Array.isArray(st.shareRequests.incoming)) st.shareRequests.incoming = [];
  if (!Array.isArray(st.shareRequests.outgoing)) st.shareRequests.outgoing = [];
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
  // modelo antigo) fica marcado para o próximo push apagar — menos o que
  // não sobe por falta de permissão num imóvel de colaboração: isso não é
  // obsoleto, é do dono
  Object.keys(serverKeys).forEach(function (k) {
    if (k in map) return;
    var pk = parseKey(k);
    if (pk.houseId && !podeExportar(pk.houseId, pk.kind)) return;
    snap[k] = '__obsoleto__';
  });
  saveSnap();
  try { localStorage.setItem(LS_OWNER, CW.user.id); } catch (e) {}
  rawSet(KEY, JSON.stringify(db));
  applyLocalTheme(); buildNav(); render();
  setSyncBadge('ok');
  schedulePush(); // envia o que ainda faltar no servidor
}

// Lê o estado do servidor e adota-o. Com um modal aberto não faz nada (para
// não pisar uma edição a meio), salvo com force. Falhas põem o selo a 'off'.
// Recebe: force (opcional) — verdadeiro para ler mesmo com um modal aberto.
// Devolve: Promise que resolve quando a leitura acabar (nunca rejeita).
function pullNow(force) {
  if (!CW.user) return Promise.resolve();
  if (!force && modalStack.length) return Promise.resolve(); // não pisar edições abertas
  return api('GET', '/api/state').then(function (st) {
    lastPull = Date.now();
    applyState(st);
  }).catch(function () { setSyncBadge('off'); fimDaEspera(); });
}

// Um ciclo: envia o que houver e, se a última leitura já passou PULL_MS e
// nada está a ser editado, volta a ler.
// Devolve: nada — dispara o push (e talvez o pull) e segue.
function syncCycle() {
  if (!CW.user) return;
  pushNow().then(function () {
    if (Date.now() - lastPull > PULL_MS && !modalStack.length) pullNow();
  });
}

/* ---------------- arranque de sessão ---------------- */

/* Arranque da sessão: primeira leitura ao servidor. Se ele está vazio e há
   dados locais deste utilizador (primeira sessão de quem já usava a app sem
   conta), sobem primeiro; caso contrário o servidor manda. Liga o ciclo de
   30s e as sincronizações ao voltar online ou ao regressar à frente.
   Devolve: nada — dispara a primeira leitura e deixa os ciclos armados. */
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
  }).catch(function () { setSyncBadge('off'); fimDaEspera(); });
  /* e se o pedido nem falhar nem responder — uma rede que fica pendurada —, a
     espera acaba na mesma: o que está no aparelho é o que há */
  setTimeout(fimDaEspera, 6000);
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

/* Deita fora, à entrada, tudo o que tenha id fora do formato que a app gera —
   registos e sub-listas das casas — e limpa as datas fora do ISO. Altera e
   devolve o próprio objeto.
   Recebe: d — a base de dados (com a forma de db) a filtrar; aguenta null.
   Devolve: o mesmo objeto d, já filtrado (ou o que veio, se vier vazio). */
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
