/* Ecras de entrada: sessao, aviso inicial e ligacao com a Google. */
'use strict';

/* ---------------- indicador de sincronização ---------------- */

/* O selo que diz onde estão as alterações.

   Falava só quando corria mal, e ficava calado no resto do tempo. Numa app que
   guarda no aparelho e sincroniza depois, o silêncio quer dizer «está tudo
   enviado» e também «ainda não tentei» — e são coisas diferentes. Quem acabou
   de escrever alguma coisa não tinha como saber se já tinha subido.

   Três estados, e o que muda entre eles é quanto tempo ficam:
     'ok'   — «Guardado», e sai sozinho ao fim de dois segundos. É um recibo,
              não um letreiro: se ficasse, deixava de se ler.
     'pend' — «N por enviar», e FICA enquanto houver. É o estado que faltava.
     'off'  — «Sem ligação», e fica até haver.

   E saiu de cima do sino, que vive no canto direito do cabeçalho: desce para
   debaixo dele.
   Recebe: state — 'ok', 'pend' ou 'off'; n (opcional) — quantas alterações
   estão por enviar, para o 'pend' as poder contar.
   Devolve: nada — mexe só no elemento #cwSync. */
function setSyncBadge(state, n) {
  var el = document.getElementById('cwSync');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cwSync';
    el.style.cssText = 'position:fixed;z-index:59;right:14px;top:calc(var(--inset-top,0px) + 62px);' +
      'font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;pointer-events:none;' +
      'opacity:0;transition:opacity var(--medio) var(--curva);box-shadow:var(--shadow)';
    document.body.appendChild(el);
  }
  clearTimeout(setSyncBadge._t);
  var põe = function (txto, fundo, cor) {
    el.textContent = txto; el.style.background = fundo; el.style.color = cor; el.style.opacity = '1';
  };
  if (state === 'off') {
    põe('Sem ligação — sincroniza mais tarde', 'var(--warn-soft)', 'var(--warn)');
  } else if (state === 'pend') {
    var q = Number(n) || 0;
    if (!q) { el.style.opacity = '0'; return; }
    põe(q === 1 ? '1 alteração por enviar' : q + ' alterações por enviar',
      'var(--chip)', 'var(--muted)');
  } else {
    põe('Guardado', 'var(--accent-soft)', 'var(--accent)');
    /* um recibo, não um letreiro: fica o tempo de se ler e sai */
    setSyncBadge._t = setTimeout(function () { el.style.opacity = '0'; }, 2000);
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
   CW.showAuthMode — com msg como erro opcional no topo (ou como nota, quando
   quem chega vem por uma ligação de convite e ainda não errou nada). No
   registo liga a validação ao vivo do email e dos requisitos da
   palavra-passe; no fim tenta montar a entrada social (Google), se estiver
   configurada.
   Recebe: msg (opcional) — mensagem a mostrar no topo do ecrã; nota
   (opcional) — verdadeiro para a mostrar como nota e não como erro.
   Devolve: nada — redesenha o ecrã de entrada. */
function showAuth(msg, nota) {
  CW.showAuthMode = CW.showAuthMode || 'login';
  // quem chegou por uma ligação e ainda não entrou vê sempre o porquê
  if (!msg && CW._chegadaMsg) { msg = CW._chegadaMsg; nota = true; }
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
    (msg ? '<div class="hint" id="cwa_msg" style="' + (nota ? 'color:var(--ink);border-left:3px solid var(--accent);padding-left:10px' : 'color:var(--danger)') + ';margin:8px 0">' + esc(msg) + '</div>' : '') +
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
  /* O CW.state não está guardado no aparelho, mas sobrevive a uma troca de
     conta na mesma página: sem isto, quem entrava a seguir via os cargos, os
     colaboradores e as ligações de quem saiu, até o primeiro estado chegar. */
  CW.state = { connections: [], roles: [], collaborators: [], invites: [], people: [], shareLink: null, shareRequests: { incoming: [], outgoing: [] } };
  CW.cargos = {}; CW.pessoas = {}; CW._pulled = 0; CW._esperaFim = 0;
  setTimeout(function () { fimDaEspera(); }, 6000);
  hideAuth();
  tab = 'dashboard'; setPage = '';   // entrar leva sempre à visão geral
  buildNav(); render();
  showLegalGate();
  // quem entra com Google numa conta antiga também tem de aceitar
  api('GET', '/api/me').then(function (m) {
    if (m.termsCurrent && m.terms !== m.termsCurrent) showTermsGate();
  }).catch(function () {});
  startSync();
  // veio por uma ligação de convite ou de partilha: só DEPOIS de o ecrã de
  // entrada sair — um modal por baixo dele não se via (a lição do cwRepor)
  CW._chegadaMsg = '';
  CW.resgatarChegada();
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
        window.sel('cwContas', atual.id, opcoes, 'cwTrocaConta', 'dados') + '</div>';
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

/* ---------------- aterragem: ?convite=<token> e ?ligar=<token> ----------------
   A ligação de convite (uso único, com cargo) e a ligação de partilha
   (permanente) chegam pelo endereço. O token sai já do URL e fica em
   sessionStorage ('gi_convite' / 'gi_ligar'); o GET de pré-visualização não
   altera nada — só o «Aceitar» ou o «Enviar pedido» (POST, com sessão) agem.
   Sem sessão, o ecrã de entrada diz porquê e o resgate acontece depois de
   finishLogin; com sessão, no arranque, mal os avisos de entrada saiam. */

// Lê o endereço à procura de um token de convite ou de partilha (64 hex):
// parseConvite (web/app/acessos.js) quando existe, senão o mesmo à mão.
// Recebe: search — o location.search.
// Devolve: {tipo:'convite'|'ligar', token} ou null.
function chegadaNoEndereco(search) {
  try { if (typeof parseConvite === 'function') return parseConvite(search) || null; } catch (e) {}
  var m = /[?&](convite|ligar)=([a-f0-9]{64})\b/.exec(search || '');
  return m ? { tipo: m[1], token: m[2] } : null;
}

// O que ficou guardado nesta sessão do browser à espera de resgate.
// Devolve: {tipo, token} ou null.
function chegadaGuardada() {
  try {
    var c = sessionStorage.getItem('gi_convite');
    if (c) return { tipo: 'convite', token: c };
    var l = sessionStorage.getItem('gi_ligar');
    if (l) return { tipo: 'ligar', token: l };
  } catch (e) {}
  return null;
}

// Esquece o token guardado de um tipo (depois de agir, ou de «Agora não»).
// Recebe: tipo — 'convite' ou 'ligar'.
// Devolve: nada — limpa o sessionStorage.
function esquecerChegada(tipo) {
  try { sessionStorage.removeItem(tipo === 'ligar' ? 'gi_ligar' : 'gi_convite'); } catch (e) {}
}

// A pré-visualização de uma ligação (GET público): quem convida, o cargo, os imóveis.
// Recebe: ch — {tipo, token}.
// Devolve: Promise com a resposta do servidor ({ownerName, roleName, perms, houses…}).
function preverChegada(ch) {
  return api('GET', (ch.tipo === 'ligar' ? '/api/ligar/' : '/api/convite/') + encodeURIComponent(ch.token));
}

// A frase para o ecrã de entrada, a partir da pré-visualização.
// Recebe: ch — {tipo, token}; prev — a resposta da pré-visualização (pode vir null).
// Devolve: o texto da nota.
function fraseDaChegada(ch, prev) {
  if (ch.tipo === 'ligar') {
    return (prev && prev.ownerName ? prev.ownerName + ' pede que partilhes imóveis com ele. ' : '') +
      'Entra ou cria conta para responderes.';
  }
  if (!prev) return 'Entra ou cria conta para aceitares o convite.';
  var casas = (prev.houses || []).map(function (h) { return h.name; }).filter(Boolean).join(', ');
  return (prev.ownerName || 'Alguém') + ' convida-te para colaborar' + (prev.roleName ? ' como ' + prev.roleName : '') +
    (casas ? ' em ' + casas : '') + '. Entra ou cria conta para aceitares o convite.';
}

(function () {
  var ch = chegadaNoEndereco(location.search);
  if (!ch) return;
  // o token sai já do endereço: não fica no histórico nem em partilhas
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  try { sessionStorage.setItem(ch.tipo === 'ligar' ? 'gi_ligar' : 'gi_convite', ch.token); } catch (e) {}
  if (CW.user) return;   // com sessão, o arranque resgata
  CW._chegadaMsg = fraseDaChegada(ch, null);
  preverChegada(ch).then(function (prev) {
    CW._chegadaMsg = fraseDaChegada(ch, prev);
    var el = document.getElementById('cwa_msg');
    if (el) el.textContent = CW._chegadaMsg;
  }).catch(function (e) {
    // ligação que não serve: diz-se já, e não se volta a perguntar
    esquecerChegada(ch.tipo);
    CW._chegadaMsg = '';
    var el = document.getElementById('cwa_msg');
    if (el) { el.textContent = e.message || 'Essa ligação não serve.'; el.style.color = 'var(--danger)'; }
  });
})();

// «Não sou eu»: sai da conta e volta ao ecrã de entrada, sem esquecer a
// ligação — quem entrar a seguir é que responde.
// Recebe: e (opcional) — o evento do clique, para travar a navegação.
// Devolve: nada — termina a sessão e mostra o ecrã de entrada.
CW.naoSouEu = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  closeAllModals();
  api('POST', '/api/auth/logout').catch(function () {});
  CW.user = null;
  CW.tickets = null;
  try { localStorage.removeItem(LS_USER); localStorage.removeItem(LS_PAGE); } catch (x) {}
  tab = 'dashboard'; setPage = '';
  buildNav(); render();
  CW.showAuthMode = 'login';
  var ch = chegadaGuardada();
  CW._chegadaMsg = ch ? fraseDaChegada(ch, ch.tipo === 'ligar' ? CW._ligarPrev : CW._convitePrev) : '';
  showAuth();
};

// «Agora não»: fecha o modal e esquece a ligação nesta sessão (a ligação em
// si continua a valer — basta abri-la outra vez).
// Recebe: tipo — 'convite' ou 'ligar'.
// Devolve: nada — fecha e limpa.
CW.chegadaDepois = function (tipo) {
  esquecerChegada(tipo);
  CW._convitePrev = null; CW._ligarPrev = null;
  closeAllModals();
};

// Lê as caixas do modal da ligação de partilha e envia o pedido.
// Recebe: token — o token da ligação.
// Devolve: nada — o CW.pedirPartilha trata do resto.
CW.enviarPedido = function (token) {
  var ids = (db.properties || []).filter(function (p) {
    var e = document.getElementById('cw_lig_h_' + p.id);
    return e && e.checked;
  }).map(function (p) { return p.id; });
  CW.pedirPartilha(token, ids);
};

// A linha «Entras como <email>» com o «Não sou eu», para os dois modais.
// Devolve: o HTML (texto).
function entrasComo() {
  return '<div class="hint">Entras como <b>' + esc(CW.user.email || CW.user.name || '') + '</b>. ' +
    '<a href="#" onclick="CW.naoSouEu(event)" style="color:var(--accent)">Não sou eu</a></div>';
}

// O modal do convite: quem convida, o cargo, os imóveis, o que vai poder, e
// «Aceitar» / «Agora não». Só o Aceitar gasta a ligação.
// Recebe: token — o token; prev — a pré-visualização do servidor.
// Devolve: nada — abre o modal.
function modalConvite(token, prev) {
  CW._convitePrev = prev;
  var casas = (prev.houses || []).map(function (h) {
    return '<div class="card" style="padding:10px 13px"><b>' + esc(h.name || 'Sem nome') + '</b></div>';
  }).join('');
  var perms = typeof permsFechadas === 'function' ? permsFechadas(prev.perms || []) : (prev.perms || []);
  var pode = perms.map(function (p) { return typeof rotuloDe === 'function' ? rotuloDe(p) : p; })
    .map(function (t) { return t.charAt(0).toLowerCase() + t.slice(1); });
  openModal('Convite de ' + (prev.ownerName || ''),
    '<div class="form">' +
    '<div class="hint" style="font-size:14px"><b>' + esc(prev.ownerName || 'Alguém') + '</b> convida-te para colaborar como <b>' + esc(prev.roleName || 'colaborador') + '</b>.</div>' +
    (casas ? '<div><div class="flabel">Imóveis</div><div class="list" style="gap:7px">' + casas + '</div></div>' : '') +
    (pode.length ? '<div><div class="flabel">Vais poder</div><div class="hint">' + esc(pode.join(', ')) + '.</div></div>' : '') +
    '<div class="hint">Não ficas comproprietário: as quotas e as contas entre donos não te incluem. Podes sair quando quiseres no menu, em Pessoas → Colaboradores.</div>' +
    entrasComo() + '</div>',
    '<button class="btn" onclick="CW.chegadaDepois(\'convite\')">Agora não</button>' +
    '<button class="btn primary" onclick="CW.aceitarConvite(\'' + jsq(token) + '\')">Aceitar</button>');
}

// O modal da ligação de partilha: quem pede, as caixas dos meus imóveis, e
// «Enviar pedido» / «Agora não». Cada imóvel marcado vira um pedido pendente.
// Recebe: token — o token; prev — a pré-visualização ({ownerName}).
// Devolve: nada — abre o modal.
function modalLigar(token, prev) {
  CW._ligarPrev = prev;
  var dono = esc(prev.ownerName || 'Alguém');
  var meus = (db.properties || []).filter(function (p) { return cwMinha(p); });
  var caixas = meus.length
    ? '<div><div class="flabel">Escolhe quais</div><div class="list" style="gap:7px">' + meus.map(function (p) {
        return '<label class="check"><input type="checkbox" id="cw_lig_h_' + p.id + '"><span style="min-width:0"><b>' + esc(p.name || 'Sem nome') + '</b>' +
          (p.address ? ' <span class="small">' + esc(p.address) + '</span>' : '') + '</span></label>';
      }).join('') + '</div></div>'
    : '<div class="hint">Ainda não tens imóveis para partilhar — cria um primeiro e volta a abrir a ligação.</div>';
  openModal('Pedido de ' + (prev.ownerName || ''),
    '<div class="form"><div class="hint" style="font-size:14px"><b>' + dono + '</b> pede que partilhes imóveis com ele.</div>' + caixas +
    '<div class="hint">' + dono + ' passa a comproprietário dos imóveis que escolheres — vê contratos, movimentos e pessoas desses imóveis. Cada pedido fica à espera que ele aceite.</div>' +
    entrasComo() + '</div>',
    '<button class="btn" onclick="CW.chegadaDepois(\'ligar\')">Agora não</button>' +
    (meus.length ? '<button class="btn primary" onclick="CW.enviarPedido(\'' + jsq(token) + '\')">Enviar pedido</button>' : ''));
}

/* Resgata a ligação guardada, com sessão: espera que os avisos de entrada
   (aviso inicial, termos, atualização) saiam do ecrã, pede a pré-visualização
   e abre o modal certo. Uma ligação que já não serve diz-o e esquece-se.
   Devolve: nada — abre o modal quando puder (ou não faz nada sem ligação). */
CW.resgatarChegada = function () {
  var ch = chegadaGuardada();
  if (!ch || !CW.user) return;
  var ocupado = function () {
    return document.getElementById('cwLegal') || document.getElementById('cwTerms') ||
      document.getElementById('cwUpd') || (authEl && authEl.style.display !== 'none');
  };
  var tentativas = 0;
  var tentar = function () {
    if (!CW.user) return;
    if (ocupado()) { if (tentativas++ < 120) setTimeout(tentar, 800); return; }
    if (CW._chegadaEmCurso) return;
    CW._chegadaEmCurso = true;
    preverChegada(ch).then(function (prev) {
      CW._chegadaEmCurso = false;
      if (chegadaGuardada() === null) return;   // entretanto respondida noutro sítio
      if (ch.tipo === 'ligar') modalLigar(ch.token, prev || {});
      else modalConvite(ch.token, prev || {});
    }).catch(function (e) {
      CW._chegadaEmCurso = false;
      esquecerChegada(ch.tipo);
      openModal(ch.tipo === 'ligar' ? 'Esta ligação não serve' : 'Este convite já não vale',
        '<div class="hint" style="font-size:14px">' + esc(e.message || 'Essa ligação não serve.') + '</div>',
        '<button class="btn primary" onclick="closeModal()">Fechar</button>');
    });
  };
  setTimeout(tentar, 400);
};

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
    CW.resgatarChegada();   // uma ligação de convite ou de partilha à espera
  }).catch(function (e) {
    if (e && e.status === 401) sessionLost();
    else { setSyncBadge('off'); startSync(); } // offline: continua local
  });
} else {
  showAuth();
}
