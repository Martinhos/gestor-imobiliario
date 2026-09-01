/* Ecras de entrada: sessao, aviso de demonstracao e ligacao com a Google. */
'use strict';

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
      'display:flex;justify-content:center;padding:22px';
    document.body.appendChild(authEl);
  }
  var login = CW.showAuthMode === 'login';
  authEl.style.display = 'flex';
  authEl.innerHTML =
    '<div class="card" style="max-width:400px;width:100%;padding:24px;margin:auto">' +
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
      '<input id="cwa_pass2" type="password" placeholder="Confirmar palavra-passe" autocomplete="new-password">' +
      '<label class="check" style="align-items:flex-start;gap:9px;margin-top:2px">' +
      '<input type="checkbox" id="cwa_terms" style="margin-top:2px">' +
      '<span class="small">Li e aceito os <a href="#" onclick="CW.readDoc(event,\'termos\')" style="color:var(--accent)">Termos e Condições</a> ' +
      'e a <a href="#" onclick="CW.readDoc(event,\'privacidade\')" style="color:var(--accent)">Política de Privacidade</a>.</span></label>') +
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
  tab = 'dashboard'; setPage = '';   // entrar leva sempre à visão geral
  buildNav(); render();
  showLegalGate();
  // quem entra com Google numa conta antiga também tem de aceitar
  api('GET', '/api/me').then(function (m) {
    if (m.termsCurrent && m.terms !== m.termsCurrent) showTermsGate();
  }).catch(function () {});
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
    var chk = document.getElementById('cwa_terms');
    if (!chk || !chk.checked) {
      errEl.textContent = 'Tens de aceitar os Termos e a Política de Privacidade para criar a conta.';
      return;
    }
    payload.terms = L.version;
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
    CW.user = Object.assign({}, CW.user, { id: u.id, name: u.name, email: u.email, plan: u.plan });
    try { localStorage.setItem(LS_USER, JSON.stringify(CW.user)); } catch (e) {}
    // conta anterior a estes documentos: pedir a aceitação antes de continuar
    if (u.termsCurrent && u.terms !== u.termsCurrent) showTermsGate();
    startSync();
  }).catch(function (e) {
    if (e && e.status === 401) sessionLost();
    else { setSyncBadge('off'); startSync(); } // offline: continua local
  });
} else {
  showAuth();
}
