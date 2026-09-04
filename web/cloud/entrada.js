/* Ecras de entrada: sessao, aviso inicial e ligacao com a Google. */
'use strict';

/* ---------------- indicador de sincronização ---------------- */

// Selo fixo no canto superior direito: 'off' mostra o aviso de falta de ligação,
// qualquer outro estado esconde-o. Cria o elemento na primeira chamada.
// Recebe: state — 'off' para mostrar o aviso; qualquer outro valor esconde o selo.
// Devolve: nada — mexe só no elemento #cwSync.
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
// Recebe: p — a palavra-passe a avaliar (qualquer valor; é tratada como string).
// Devolve: a mensagem do primeiro requisito em falta, ou '' se estiver forte.
function passProblem(p) {
  p = String(p || '');
  if (p.length < 8) return 'A palavra-passe precisa de pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(p)) return 'A palavra-passe precisa de uma letra maiúscula.';
  if (!/[a-z]/.test(p)) return 'A palavra-passe precisa de uma letra minúscula.';
  if (!/[0-9]/.test(p)) return 'A palavra-passe precisa de um número.';
  if (!/[^A-Za-z0-9]/.test(p)) return 'A palavra-passe precisa de um símbolo (ex.: ! ? € .).';
  return '';
}

/* Desenha o ecrã de entrada por cima de tudo — login ou registo, conforme
   CW.showAuthMode — com msg como erro opcional no topo. No registo liga a
   validação ao vivo do email e dos requisitos da palavra-passe; no fim tenta
   montar a entrada social (Google), se estiver configurada.
   Recebe: msg (opcional) — mensagem de erro a mostrar no topo do ecrã.
   Devolve: nada — redesenha o ecrã de entrada. */
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
    '<div><div class="title" style="font-size:18px">Rendorium</div>' +
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
    (login ? '<div style="text-align:center;margin-top:2px"><a href="#" class="small" style="color:var(--muted)" onclick="CW.esqueci(event)">Esqueci-me da palavra-passe</a></div>' : '') +
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
// a versão pública, sem mensagem de erro — é a que os botões da app chamam
// Devolve: nada — redesenha o ecrã de entrada.
CW.showAuth = function () { showAuth(); };

// alterna entre "Entrar" e "Criar conta" e redesenha o ecrã
// Devolve: nada — redesenha o ecrã de entrada no modo trocado.
CW.toggleAuth = function () {
  CW.showAuthMode = CW.showAuthMode === 'login' ? 'register' : 'login';
  showAuth();
};

/* O fecho de qualquer entrada bem-sucedida (formulário, Google, ligação por
   email): guarda a sessão, descarta a cache local se pertencia a outra conta,
   volta à visão geral, mostra os portões legais que faltem e arranca o sync.
   Recebe: u — a resposta da API com a sessão: {id, name, email, token}.
   Devolve: nada — guarda a sessão, repinta a app e arranca o sync. */
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

// Valida o formulário (no registo: palavra-passe forte, confirmação igual e
// termos aceites) e envia o login ou o registo à API. Os erros ficam escritos
// no próprio ecrã, e o botão desativa-se enquanto o pedido anda.
// Devolve: nada — o desfecho aparece no próprio ecrã (e o sucesso acaba em finishLogin).
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
  /* numa rede lenta não acontecia nada visível: o segundo toque disparava
     um segundo pedido */
  var b = document.querySelector('button[onclick="CW.submitAuth()"]');
  if (b) { b.disabled = true; b._rotulo = b.textContent; b.textContent = login ? 'A entrar…' : 'A criar a conta…'; }
  var repor = function () { if (b) { b.disabled = false; b.textContent = b._rotulo; } };
  api('POST', login ? '/api/auth/login' : '/api/auth/register', payload)
    .then(finishLogin)
    .catch(function (e) { repor(); errEl.textContent = e.message || 'Não foi possível entrar.'; });
};

/* Esqueci-me da palavra-passe: pede a ligação por email e, quando a pessoa
   volta com o token no endereço, troca-a aqui mesmo. A resposta do servidor
   é sempre a mesma, exista a conta ou não.
   Recebe: e (opcional) — o evento do clique, para travar a navegação da ligação.
   Devolve: nada — pede a ligação de reposição e avisa num toast. */
CW.esqueci = function (e) {
  if (e) e.preventDefault();
  var em = val('cwa_email') || prompt('O email da tua conta:') || '';
  em = em.trim();
  if (!em) return;
  api('POST', '/api/auth/repor', { email: em })
    .then(function (r) { toast(r.msg || 'Se esse email tiver conta, enviámos uma ligação.'); })
    .catch(function () { toast('Não deu para pedir agora — tenta daqui a pouco.'); });
};

/* No ambiente de dev, numa conta de teste, a marca do topo dá lugar a um
   seletor: as contas de teste DESTE dev, trocáveis a um toque, mais a opção
   de criar uma extra. A cache local não se mistura — o sync deteta a troca
   de dono (LS_OWNER) e substitui tudo pelo estado da conta nova. */
(function () {
  var u = CW.user;
  if (!u || !/@teste\.rendorium\.com$/.test(u.email || '')) return;
  if (!/^dev\.rendorium\.com$|^gestor-imobiliario-dev\.|^localhost$|^127\./.test(location.hostname)) return;
  fetch('/api/teste/contas', { headers: { Authorization: 'Bearer ' + u.token } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.contas || !d.contas.length) return;
      var brand = document.querySelector('.brand');
      if (!brand) return;
      /* o menu de escolha da própria app (sel), não o <select> do sistema —
         que destoava aqui tanto como destoava nos formulários */
      if (typeof window.sel !== 'function') return;
      var atual = d.contas.find(function (c) { return c.atual; }) || d.contas[0];
      var rotulo = function (ct) { return '\uD83E\uDDEA ' + ct.email.split('@')[0].replace('teste-', '#'); };
      var opcoes = d.contas.map(function (ct) { return { v: ct.id, label: rotulo(ct) }; });
      opcoes.push({ div: true }, { v: '+nova', label: '\uFF0B Nova conta de teste' });
      window.cwTrocaConta = function () {
        var inp = document.getElementById('cwContas');
        var v = inp && inp.value;
        if (!v || v === atual.id || window._cwTroca) return;
        window._cwTroca = true;
        var alvo = v === '+nova' ? ['/api/teste/nova', {}] : ['/api/teste/trocar', { para: v }];
        fetch(alvo[0], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.token },
          body: JSON.stringify(alvo[1]),
        })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('troca recusada')); })
          .then(function (n) {
            try { localStorage.setItem(LS_USER, JSON.stringify({ id: n.id, email: n.email, name: n.name, token: n.token })); } catch (e) {}
            location.reload();
          })
          .catch(function () {
            window._cwTroca = false;
            if (inp) inp.value = atual.id;
            var lab = document.getElementById('lab_cwContas');
            if (lab) lab.textContent = rotulo(atual);
            toast('Não deu para trocar de conta.');
          });
      };
      brand.innerHTML = '<div style="flex:1;min-width:0">' +
        window.sel('cwContas', atual.id, opcoes, 'cwTrocaConta') + '</div>';
    })
    .catch(function () { /* sem seletor, fica a marca */ });
})();

/* Entrar com um token no endereço: é a porta do ambiente de teste (/test)
   e de qualquer ligação de sessão emitida pelo servidor. O token sai já da
   URL, valida-se contra /api/me, e a app recarrega com a sessão posta. */
(function () {
  var m = /[?&]entrar=([a-f0-9]{64})/.exec(location.search);
  if (!m) return;
  var token = m[1];
  var exemplo = /[?&]exemplo=1/.test(location.search);
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (u) {
      if (!u) { toast('Essa ligação de entrada já não vale.'); return; }
      try {
        localStorage.setItem(LS_USER, JSON.stringify({ id: u.id, email: u.email, name: u.name, token: token }));
        if (exemplo) sessionStorage.setItem('gi_exemplo', '1');
      } catch (e) {}
      location.reload();   // arranca limpo, já com a sessão posta
    })
    .catch(function () { toast('Não deu para entrar por essa ligação.'); });
})();

(function () {
  var m = /[?&]repor=([a-f0-9]{64})/.exec(location.search);
  if (!m) return;
  CW._reporToken = m[1];
  // o token sai já do endereço: não fica no histórico nem em partilhas
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  /* Uma sobreposição própria, ACIMA do portão de login (z 200): um modal
     normal (z 60) abria por baixo do ecrã de entrada e ninguém o via — a
     ligação do email parecia não fazer nada. O mesmo bug do ecrã de
     atualização, o mesmo remédio. */
  setTimeout(function () {
    var el = document.createElement('div');
    el.id = 'cwRepor';
    el.style.cssText = 'position:fixed;inset:0;z-index:230;background:var(--bg);overflow:auto;' +
      'display:flex;justify-content:center;padding:22px';
    el.innerHTML =
      '<div class="card" style="max-width:420px;width:100%;padding:24px;margin:auto">' +
      '<div class="title" style="font-size:18px;margin-bottom:12px">Palavra-passe nova</div>' +
      '<div class="form">' +
      '<label>Nova palavra-passe<input id="rp_1" type="password" autocomplete="new-password"></label>' +
      '<label>Repete-a<input id="rp_2" type="password" autocomplete="new-password"></label>' +
      '<div class="hint">8+ caracteres, com maiúscula, minúscula, número e símbolo.</div>' +
      '<div id="rp_err" class="small" style="color:var(--danger)"></div></div>' +
      '<div class="toolbar" style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn" onclick="document.getElementById(\'cwRepor\').remove()">Cancelar</button>' +
      '<button class="btn primary" onclick="CW.reporConfirmar()">Guardar</button></div></div>';
    document.body.appendChild(el);
    try { document.getElementById('rp_1').focus(); } catch (e) {}
  }, 700);
})();

// Valida a palavra-passe nova e confirma a reposição com o token da ligação de
// email; se o servidor aceitar, fecha a sobreposição e devolve o ecrã de entrada.
// Devolve: nada — os erros ficam escritos na sobreposição; o sucesso fecha-a.
CW.reporConfirmar = function () {
  var p1 = val('rp_1'), p2 = val('rp_2');
  var errEl = document.getElementById('rp_err');
  var prob = passProblem(p1);
  if (prob) { errEl.textContent = prob; return; }
  if (p1 !== p2) { errEl.textContent = 'As palavras-passe não coincidem.'; return; }
  api('POST', '/api/auth/repor/confirmar', { t: CW._reporToken, password: p1 })
    .then(function () {
      CW._reporToken = null;
      var el = document.getElementById('cwRepor');
      if (el) el.remove();
      toast('Feito — entra com a palavra-passe nova.');
      showAuth();
    })
    .catch(function (e) { errEl.textContent = e.message || 'Essa ligação já não serve.'; });
};

/* O aviso dos 30 dias: quando o master marca o fim da demonstração, toda a
   gente fica a saber — uma vez por aparelho e por data marcada, com a data
   concreta e o que muda. É este aviso que os termos prometem.
   Recebe: fim — o instante do fim da demonstração, em milissegundos (como Date.now()).
   Devolve: nada — abre o modal do aviso (ou nada, se já entrou em vigor ou já foi visto). */
function avisoFimDemo(fim) {
  if (Date.now() >= fim) return;   // já entrou em vigor: os limites falam por si
  var chave = 'gi_aviso_fim_' + fim;
  try { if (localStorage.getItem(chave)) return; } catch (e) {}
  var data = new Date(fim).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
  var dias = Math.ceil((fim - Date.now()) / 86400000);
  setTimeout(function () {
    openModal('A fase experimental termina a ' + data,
      '<div class="hint" style="font-size:14.5px;line-height:1.65">' +
      '<p style="margin:0 0 10px">Faltam <b>' + dias + ' dias</b>. A partir dessa data entram em vigor os planos ' +
      'descritos nos Termos e Condições:</p>' +
      '<ul style="margin:0 0 10px;padding-left:18px">' +
      '<li style="margin-bottom:4px"><b>Gratuito</b> — até 3 imóveis; sem criar contratos novos nem movimentos planeados.</li>' +
      '<li style="margin-bottom:4px"><b>Plus</b> — até 10 imóveis, com tudo.</li></ul>' +
      '<p style="margin:0"><b>Nada do que já criaste é apagado nem fica inacessível</b> — os limites valem só ' +
      'para criar registos novos. Podes ver os termos completos em Definições → Aviso legal.</p></div>',
      '<button class="btn primary" onclick="CW.fimDemoVisto(\'' + chave + '\')">Percebi</button>');
  }, 1200);
}
// o "Percebi" do aviso: marca-o como visto neste aparelho e fecha o modal
// Recebe: chave — a chave do localStorage que identifica este aviso (inclui a data marcada).
// Devolve: nada — grava a marca e fecha o modal.
CW.fimDemoVisto = function (chave) {
  try { localStorage.setItem(chave, '1'); } catch (e) {}
  closeModal();
};

/* ---- entrada com Google / Apple (aparece quando configurada) ---- */

// carrega um script externo uma única vez; se já estiver na página, só espera pelo load
// Recebe: src — o URL do script; cb — função chamada (sem argumentos) quando ele estiver carregado.
// Devolve: nada — o sinal de pronto chega pelo cb.
function loadScript(src, cb) {
  var s = document.querySelector('script[src="' + src + '"]');
  if (s) { if (s._loaded) cb(); else s.addEventListener('load', cb); return; }
  s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onload = function () { s._loaded = 1; cb(); };
  document.head.appendChild(s);
}

// Monta a zona "ou continua com…" do ecrã de entrada: pede /api/auth/config
// (fica em cache) e, se houver id do Google, carrega o SDK e desenha o botão.
// Sem configuração — ou sem rede — a zona simplesmente não aparece.
// Devolve: nada — mostra e preenche a zona #cwa_social quando há configuração.
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

// troca a credencial do fornecedor (ex.: Google) por uma sessão nossa e acaba como um login normal
// Recebe: provider — o nome do fornecedor no caminho da API (ex.: 'google');
// body — o corpo a enviar a /api/auth/<provider> (ex.: {credential} do Google).
// Devolve: nada — o sucesso acaba em finishLogin; o erro fica escrito no ecrã.
function socialLogin(provider, body) {
  var errEl = document.getElementById('cwa_err');
  api('POST', '/api/auth/' + provider, body)
    .then(finishLogin)
    .catch(function (e) { if (errEl) errEl.textContent = e.message || 'Não foi possível entrar.'; });
}


// esconde o ecrã de entrada e devolve o scroll à página
// Devolve: nada — só esconde o elemento e destrava o scroll.
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
    if (u.fimDemo) avisoFimDemo(u.fimDemo);
    try {
      if (sessionStorage.getItem('gi_exemplo') === '1') {
        sessionStorage.removeItem('gi_exemplo');
        // só numa conta vazia: o exemplo nunca se despeja em cima de dados
        if (!(db.properties || []).length && typeof seed === 'function') {
          seed();
          toast('Dados de exemplo carregados.');
        }
      }
    } catch (e) {}
    startSync();
  }).catch(function (e) {
    if (e && e.status === 401) sessionLost();
    else { setSyncBadge('off'); startSync(); } // offline: continua local
  });
} else {
  showAuth();
}
