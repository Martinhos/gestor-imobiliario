/* Ecras de entrada: sessao, aviso inicial e ligacao com a Google. */
'use strict';

/* ---------------- indicador de sincronização ---------------- */

/* O selo que diz onde estão as alterações.

   Falava só quando corria mal, e ficava calado no resto do tempo. Numa app que
   guarda no aparelho e sincroniza depois, o silêncio quer dizer «está tudo
   enviado» e também «ainda não tentei» — e são coisas diferentes. Quem acabou
   de escrever alguma coisa não tinha como saber se já tinha subido.

   Quatro estados, e o que muda entre eles é quanto tempo ficam:
     'liga' — «A ligar ao servidor…», desde a abertura com sessão até a
              primeira conversa com o servidor acabar, e outra vez em cada
              nova tentativa depois de uma falha (cloud/nucleo.js:tentarLigar).
              Fica enquanto a tentativa durar — no máximo o tempo-limite do
              pedido (cloud/nucleo.js:TEMPO_API).
     'ok'   — «Guardado», e sai sozinho ao fim de dois segundos. É um recibo,
              não um letreiro: se ficasse, deixava de se ler.
     'pend' — «N por enviar», e FICA enquanto houver. É o estado que faltava.
     'off'  — «Sem ligação ao servidor», e fica até a tentativa seguinte.
   E um quinto que é não estar: '' esvazia o selo (a sessão acabou).

   Vive no cabeçalho (index.html:#hdrSync), entre o título e o sino — o
   canvas de 2026-10 põe-no lá, e deixou de ser um selo solto por cima da
   página a disputar o canto com o sino. É um ícone de nuvem com a frase ao
   lado: laranja com um relógio «A ligar», verde «Guardado», cobalto «N por
   enviar», vermelho com uma cruz «Sem ligação». No telemóvel fica só o
   ícone (a frase vai no aria-label e no title), menos o «Sem ligação», que
   desce para uma faixa por baixo do cabeçalho; no computador a frase do
   «Guardado» recolhe ao fim de dois segundos (a classe .recibo) e o ícone
   fica — o recibo lê-se e sai, o estado vê-se. A nova tentativa depois de
   uma falha (a classe .tenta) e o leitor de ecrã têm regras próprias, ditas
   lá dentro.
   Recebe: state — 'liga', 'ok', 'pend', 'off' ou '' (esvazia); n
   (opcional) — quantas alterações estão por enviar, para o 'pend' as poder
   contar.
   Devolve: nada — mexe só no elemento #hdrSync. */
function setSyncBadge(state, n) {
  var el = document.getElementById('hdrSync');
  if (!el) return;
  var q = Number(n) || 0;
  var antes = ' ' + (el.className || '') + ' ';
  if (!state || (state === 'pend' && !q)) {
    clearTimeout(setSyncBadge._t);
    el.innerHTML = ''; el.className = '';
    el.removeAttribute('title'); el.removeAttribute('aria-label'); el.setAttribute('aria-live', 'polite');
    return;
  }
  /* [classe, ícone, frase, frase à vista]. A do «Sem ligação» à vista é a
     curta: a inteira (com o «sincroniza mais tarde») tinha 340px e, no
     computador estreito, comia o título do ecrã; fica no aria-label e no
     title */
  var e = state === 'off' ? ['fora', 'nuvemFora', 'Sem ligação ao servidor — sincroniza mais tarde', 'Sem ligação ao servidor']
    : state === 'liga' ? ['liga', 'nuvemLiga', 'A ligar ao servidor…']
    : state === 'pend' ? ['pend', 'nuvemSobe', q === 1 ? '1 alteração por enviar' : q + ' alterações por enviar']
    : ['ok', 'nuvemOk', 'Guardado'];
  /* Uma tentativa depois de uma falha (o selo estava em «Sem ligação», ou
     numa tentativa anterior que ainda não acabou) leva a classe .tenta; só
     o 'liga' a leva, e só vindo de .fora ou de .tenta — nunca do 'pend'. No
     telemóvel só o «Sem ligação» desce para a faixa por baixo do cabeçalho;
     o «por enviar», o «Guardado» e o «A ligar» da abertura são só o ícone,
     porque passam por ali a cada gravação ou a cada abertura e a faixa a
     entrar e a sair fazia o cabeçalho saltar. A nova tentativa herda a
     faixa que lá está, agora laranja: sem ela, o cabeçalho encolhia e
     crescia de 30 em 30 segundos enquanto a rede não voltasse
     (estilos.css:header.top .sync.tenta). */
  var tenta = state === 'liga' && /\s(fora|tenta)\s/.test(antes);
  var classe = 'sync ' + e[0] + (tenta ? ' tenta' : '');
  // o mesmo selo outra vez (a abertura e o startSync dizem ambos «A ligar»): não se refaz nem se anuncia
  if (el.className === classe && el.title === e[2]) return;
  clearTimeout(setSyncBadge._t);
  /* O leitor de ecrã (o #hdrSync é um role=status, aria-live=polite) ouve
     as mudanças, mas não a roda das tentativas: de 30 em 30 segundos sem
     rede o selo passa a «A ligar» e volta a «Sem ligação», e anunciar isso
     era repetir a mesma frase para sempre. A tentativa e a falha repetida
     mudam o selo com o aria-live desligado; o resto anuncia-se. */
  var repete = tenta || (state === 'off' && / tenta /.test(antes));
  el.setAttribute('aria-live', repete ? 'off' : 'polite');
  el.className = classe;
  el.title = e[2];
  el.setAttribute('aria-label', e[2]);
  el.innerHTML = ic(e[1], 18) + '<span>' + (e[3] || e[2]) + '</span>';
  /* um recibo, não um letreiro: a frase fica o tempo de se ler */
  if (state === 'ok') setSyncBadge._t = setTimeout(function () { el.classList.add('recibo'); }, 2000);
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

/* Os campos do ecrã de entrada, cada um com o seu rótulo à vista. Eram só
   placeholders a fazer de rótulo («Email», «Palavra-passe»): mal se escrevia
   a primeira letra, o campo deixava de dizer o que era. O que o guardar
   recusa vazio (o email e as palavras-passe; o servidor recusa-os também)
   leva o asterisco vermelho; o nome do registo é opcional e mostra um
   exemplo. As palavras-passe não levam exemplo. Os ids, os type e os
   autocomplete ficam como estavam — é por eles que o gestor de
   palavras-passe e o submitAuth acham os campos.
   Recebe: login — verdadeiro no «Entrar», falso no «Criar conta».
   Devolve: o HTML dos campos (texto), com a caixa dos requisitos da
   palavra-passe no registo. */
function camposDaEntrada(login) {
  return (login ? '' : '<label>Nome (opcional)<input id="cwa_name" placeholder="Ex: Ana Rodrigues" autocomplete="name"></label>') +
    '<label>Email <span class="req">*</span><input id="cwa_email" type="email" placeholder="Ex: ana@exemplo.pt" autocomplete="email"></label>' +
    /* o «Mostrar» fica fora do rótulo (um rótulo com dois controlos lá
       dentro não é rótulo de nenhum), por cima do canto direito do campo */
    '<div class="ent-pw"><label>Palavra-passe <span class="req">*</span><input id="cwa_pass" type="password" autocomplete="' + (login ? 'current-password' : 'new-password') + '"' +
      (login ? '' : ' aria-describedby="cwa_passreq"') + '></label>' +
      '<button type="button" class="ent-ver" aria-controls="cwa_pass" aria-pressed="false" data-toca="nada" data-click="CW.verPalavraPasse(\'cwa_pass\')">Mostrar</button></div>' +
    (login
      ? '<a href="#" class="ent-esqueci" data-toca="dados" data-click="CW.esqueci(event)">Esqueci-me da palavra-passe</a>'
      : '<div id="cwa_passreq" class="ent-reqs"></div>' +
        '<label>Confirmar palavra-passe <span class="req">*</span><input id="cwa_pass2" type="password" autocomplete="new-password"></label>');
}

/* Os requisitos da palavra-passe no registo, cada um com o seu teste: o que
   a caixa dos requisitos mostra enquanto se escreve (e o passProblem diz
   quando se carrega em «Criar conta»). */
var REQUISITOS_DA_PALAVRA_PASSE = [
  ['len', '8+ caracteres', function (p) { return p.length >= 8; }],
  ['up', 'maiúscula', function (p) { return /[A-Z]/.test(p); }],
  ['low', 'minúscula', function (p) { return /[a-z]/.test(p); }],
  ['num', 'número', function (p) { return /[0-9]/.test(p); }],
  ['sym', 'símbolo (ex.: ! ? € .)', function (p) { return /[^A-Za-z0-9]/.test(p); }],
];

/* Pinta a caixa dos requisitos (o canvas M-CriarConta): o visto verde nos
   cumpridos e um círculo vazio nos que faltam, com o estado escrito para o
   leitor de ecrã («cumprido» / «por cumprir»), já que o desenho não se lê.
   Serve o registo e a mudança de palavra-passe (partilha.js:CW.passwordModal).
   Recebe: p — a palavra-passe escrita; caixa (opcional) — o id da caixa
   ('cwa_passreq' por omissão).
   Devolve: nada — escreve dentro da caixa. */
function pintarRequisitos(p, caixa) {
  caixa = document.getElementById(caixa || 'cwa_passreq');
  if (!caixa) return;
  caixa.innerHTML = REQUISITOS_DA_PALAVRA_PASSE.map(function (r) {
    var ok = r[2](String(p || ''));
    return '<span class="ent-req' + (ok ? ' ok' : '') + '" data-req="' + r[0] + '">' +
      (ok ? ic('check', 16) : '<span class="ent-req-circ" aria-hidden="true"></span>') +
      '<span class="ent-so-leitor">' + (ok ? 'cumprido: ' : 'por cumprir: ') + '</span>' + r[1] + '</span>';
  }).join('');
}

/* Marca um campo do ecrã de entrada com o erro por baixo, sem aviso e sem
   lhe levar o foco: é o que se faz ao sair de um campo (o email mal escrito),
   onde roubar o foco prendia a pessoa no campo. Ao enviar, os erros vão pelo
   componentes.js:falhaCampo, que faz o mesmo e leva lá o foco. Larga-se à
   primeira tecla.
   Recebe: id — o id do campo; msg — a frase do erro.
   Devolve: nada — escreve o erro junto do campo. */
function marcarCampo(id, msg) {
  var e = document.getElementById(id);
  if (!e || !e.classList) return;
  e.classList.add('err');
  if (typeof e.insertAdjacentElement !== 'function') return;
  var antes = document.getElementById(id + '-erro');
  if (antes) antes.remove();
  var p = document.createElement('p');
  p.className = 'erro-campo'; p.id = id + '-erro'; p.textContent = msg;
  e.insertAdjacentElement('afterend', p);
  e.setAttribute('aria-invalid', 'true');
  e.setAttribute('aria-describedby', p.id);
  e.addEventListener('input', function () {
    e.classList.remove('err'); e.removeAttribute('aria-invalid'); e.removeAttribute('aria-describedby'); p.remove();
  }, { once: true });
}

/* A frase da nota de quem chega por uma ligação, em HTML: quem convida e o
   cargo a negro, como no canvas (M-Entrar). Os nomes passam pelo esc.
   Recebe: ch — {tipo, token}; prev — a pré-visualização (pode vir null).
   Devolve: o HTML da frase (texto). */
function fraseDaChegadaHtml(ch, prev) {
  if (!prev || ch.tipo === 'ligar' || ch.tipo === 'grupo' || !prev.ownerName) return esc(fraseDaChegada(ch, prev));
  var casas = nomesPorExtenso(prev.houses);
  return '<b>' + esc(prev.ownerName) + '</b> convida-te para colaborar' + (prev.roleName ? ' como <b>' + esc(prev.roleName) + '</b>' : '') +
    (casas ? ' em ' + esc(casas) : '') + '. Entra ou cria conta para aceitares o convite.';
}

/* Escreve a nota da chegada no ecrã de entrada aberto: o avatar com as
   iniciais de quem convida (ou o ícone das pessoas, sem nome) e a frase. É
   o que se repinta quando a pré-visualização chega, sem tocar nos campos.
   Recebe: nada (lê a ligação guardada e CW._chegadaPrev).
   Devolve: nada — mexe no #cwa_msg e no #cwa_msg_av, se lá estiverem. */
function pintarNotaDaChegada() {
  var ch = chegadaGuardada(), prev = CW._chegadaPrev || null;
  var el = document.getElementById('cwa_msg'), av = document.getElementById('cwa_msg_av');
  if (!el || !ch) return;
  el.innerHTML = fraseDaChegadaHtml(ch, prev);
  if (av) av.innerHTML = prev && prev.ownerName ? esc(initials(prev.ownerName)) : ic('users', 20);
}

/* Desenha o ecrã de entrada por cima de tudo — login ou registo, conforme
   CW.showAuthMode —, com o desenho do canvas (M-Entrar e M-CriarConta): a
   marca (numa faixa do mosaico, quando se chega por uma ligação), o título
   do registo, a nota de quem convida, o segmentado «Entrar / Criar conta»,
   os campos com rótulo, os requisitos da palavra-passe a acenderem-se, o
   botão, o «ou» com o Google, e os documentos. msg é um erro opcional no
   topo (ou a nota, quando quem chega vem por uma ligação de convite e ainda
   não errou nada). No registo liga a validação do email ao sair do campo e
   os requisitos da palavra-passe; no fim tenta montar a entrada social
   (Google), se estiver configurada. Trocar de separador não apaga o email
   já escrito. Uma ligação que já não serve (CW._chegadaErro, posto pela
   pré-visualização que falhou) diz-se no topo como erro, sem a faixa e sem o
   «e ver o convite» — o convite já não existe —, e continua a dizer-se ao
   trocar de separador, até se entrar.
   Recebe: msg (opcional) — mensagem a mostrar no topo do ecrã; nota
   (opcional) — verdadeiro para a mostrar como nota e não como erro.
   Devolve: nada — redesenha o ecrã de entrada. */
function showAuth(msg, nota) {
  /* «Criar conta» na página de entrada traz ?criar=1: sem isto, esse botão e o
     «Já tenho conta» iam ao mesmo ecrã e a escolha era um adorno. Só vale à
     primeira — a partir daí manda o que a pessoa escolher nos separadores. */
  if (!CW.showAuthMode) {
    try { if (/[?&]criar=1\b/.test(location.search)) CW.showAuthMode = 'register'; } catch (e) {}
  }
  CW.showAuthMode = CW.showAuthMode || 'login';
  // quem chegou por uma ligação e ainda não entrou vê sempre o porquê
  if (!msg && CW._chegadaMsg) { msg = CW._chegadaMsg; nota = true; }
  else if (!msg && CW._chegadaErro) msg = CW._chegadaErro;
  if (!authEl) {
    authEl = document.createElement('div');
    authEl.id = 'cwAuth';
    authEl.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--bg);overflow:auto;' +
      'display:flex;justify-content:center';
    document.body.appendChild(authEl);
  }
  var login = CW.showAuthMode === 'login';
  var emailAntes = val('cwa_email');
  var ch = nota ? chegadaGuardada() : null;
  var depois = !ch ? '' : ch.tipo === 'ligar' ? ' e ver o pedido' : ' e ver o convite';
  var aba = function (modo, rotulo) {
    var on = CW.showAuthMode === modo;
    return '<button type="button" role="tab" id="cwaTab_' + modo + '" aria-selected="' + on + '" aria-controls="cwaPainel" tabindex="' + (on ? '0' : '-1') + '"' +
      (on ? ' class="on"' : '') + ' data-toca="ecra" data-click="CW.modoDaEntrada(\'' + modo + '\')" data-keydown="CW.teclaDaEntrada(event)">' + rotulo + '</button>';
  };
  var marca = '<span class="marca" aria-hidden="true">' + ic('home', 18) + '</span><span class="disp ent-nome">Rendorium</span>';
  authEl.style.display = 'flex';
  authEl.innerHTML =
    '<div class="ent' + (ch ? ' ent-com-faixa' : '') + '">' +
    (ch
      ? '<div class="ent-faixa imv-mosaico imv-noite"><div class="ent-chip">' + marca + '</div></div>'
      : '<div class="ent-marca">' + marca + '</div>') +
    '<div class="ent-corpo">' +
    (ch ? '' : '<h1 class="ent-tit">O teu portefólio de arrendamento, arrumado.</h1>') +
    (msg && nota
      ? '<div class="ent-convite"><span class="avatar ent-convite-av" id="cwa_msg_av" aria-hidden="true">' + ic('users', 20) + '</span>' +
        '<p id="cwa_msg">' + esc(msg) + '</p></div>'
      : msg ? '<p class="ent-msg-erro" id="cwa_msg" role="alert">' + esc(msg) + '</p>' : '') +
    '<div class="segm ent-segm" role="tablist" aria-label="Entrar ou criar conta">' + aba('login', 'Entrar') + aba('register', 'Criar conta') + '</div>' +
    '<div class="form ent-form" id="cwaPainel" role="tabpanel" aria-labelledby="cwaTab_' + CW.showAuthMode + '">' +
    camposDaEntrada(login) +
    (login ? '' :
      '<label class="check ent-termos">' +
      '<input type="checkbox" id="cwa_terms">' +
      '<span>Li e aceito os <a href="#" data-toca="camada" data-click="CW.readDoc(event,\'termos\')">Termos e Condições</a> ' +
      'e a <a href="#" data-toca="camada" data-click="CW.readDoc(event,\'privacidade\')">Política de Privacidade</a>. <span class="req">*</span></span></label>') +
    '<p id="cwa_err" class="erro-campo" role="alert"></p>' +
    '<p id="cwa_info" class="small ent-info" role="status"></p>' +
    '<button type="button" class="btn primary ent-botao" data-toca="dados" data-click="CW.submitAuth()">' + (login ? 'Entrar' : 'Criar conta') + depois + '</button>' +
    '</div>' +
    '<div id="cwa_social" class="u-d-none">' +
    '<div class="ent-ou" aria-hidden="true"><span></span>ou<span></span></div>' +
    '<div id="cwa_gbtn" class="ent-google"></div>' +
    '</div>' +
    (login
      ? '<p class="small ent-rodape"><a href="#" data-toca="camada" data-click="CW.readDoc(event,\'termos\')">Termos e Condições</a> · ' +
        '<a href="#" data-toca="camada" data-click="CW.readDoc(event,\'privacidade\')">Política de Privacidade</a></p>'
      : '<p class="small ent-rodape">Grátis, sem planos e sem limite de imóveis.</p>') +
    '</div></div>';
  lockScroll(true);
  if (ch) pintarNotaDaChegada();
  var em = document.getElementById('cwa_email');
  if (em && emailAntes) em.value = emailAntes;
  var last = document.getElementById(login ? 'cwa_pass' : 'cwa_pass2');
  if (last) last.addEventListener('keydown', function (e) { if (e.key === 'Enter') CW.submitAuth(); });
  if (!login) {
    // email: valida o formato ao sair do campo, sem roubar o foco
    if (em) em.addEventListener('blur', function () {
      var v = em.value.trim();
      if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) marcarCampo('cwa_email', 'Email inválido — confirma o formato (ex.: nome@exemplo.pt).');
    });
    // palavra-passe: requisitos verificados enquanto escreve
    var pw = document.getElementById('cwa_pass');
    pintarRequisitos(pw ? pw.value : '');
    if (pw) pw.addEventListener('input', function () { pintarRequisitos(pw.value); });
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

/* Escolhe «Entrar» ou «Criar conta» no segmentado do ecrã de entrada: só
   redesenha se mudar, e o foco fica no separador escolhido.
   Recebe: modo — 'login' ou 'register'.
   Devolve: nada — redesenha o ecrã de entrada no modo pedido. */
CW.modoDaEntrada = function (modo) {
  if (modo !== 'login' && modo !== 'register') return;
  if (CW.showAuthMode === modo) return;
  CW.showAuthMode = modo;
  showAuth();
  var t = document.getElementById('cwaTab_' + modo);
  if (t) try { t.focus(); } catch (e) {}
};

/* As setas no segmentado do ecrã de entrada passam de um separador ao outro,
   como num conjunto de separadores (role=tablist).
   Recebe: e — o evento da tecla.
   Devolve: nada — troca de modo com as setas; as outras teclas seguem. */
CW.teclaDaEntrada = function (e) {
  if (!e || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  e.preventDefault();
  CW.modoDaEntrada(CW.showAuthMode === 'login' ? 'register' : 'login');
};

/* O «Mostrar» da palavra-passe: troca o campo entre escondido e à vista, e o
   botão diz o que vai fazer a seguir (Mostrar / Esconder) e se está ligado.
   Recebe: id — o id do campo da palavra-passe.
   Devolve: nada — muda o type do campo e o botão. */
CW.verPalavraPasse = function (id) {
  var campo = document.getElementById(id);
  if (!campo) return;
  var ver = campo.type === 'password';
  campo.type = ver ? 'text' : 'password';
  var b = document.querySelector('[aria-controls="' + id + '"].ent-ver');
  if (b) { b.textContent = ver ? 'Esconder' : 'Mostrar'; b.setAttribute('aria-pressed', ver ? 'true' : 'false'); }
};

/* O fecho de qualquer entrada bem-sucedida (formulário, Google, ligação por
   email): guarda a sessão, descarta a cache local se pertencia a outra conta,
   volta à visão geral, mostra os portões legais que faltem e arranca o sync.
   A sessão vive no cookie HttpOnly que o servidor acabou de pôr; o token não
   se guarda no aparelho, venha ou não na resposta — guardado, qualquer script
   na página o lia e o levava para usar noutro sítio durante 30 dias.
   Recebe: u — a resposta da API com a sessão: {id, name, email}.
   Devolve: nada — guarda a sessão, repinta a app e arranca o sync. */
function finishLogin(u) {
  CW.user = { id: u.id, name: u.name, email: u.email };
  guardarSessao();
  var prevOwner = null;
  try { prevOwner = localStorage.getItem(LS_OWNER); } catch (e) {}
  if (prevOwner && prevOwner !== u.id) {
    // dados locais de outra conta: não misturar — nem os serviços desligados dela
    db = JSON.parse(JSON.stringify(blank));
    rawSet(KEY, JSON.stringify(db));
    try { definirServicosDesligados([]); } catch (e) {}
    /* e o retrato vai atrás. Ele é por utilizador e sobrevive a uma saída, por
       isso quem já usou este aparelho tem cá o retrato completo da conta — com
       o db em branco, o push lia a diferença como «apagou tudo». O travão do
       pushNow chega, mas sem retrato não há sequer o que comparar. */
    try { snap = {}; localStorage.removeItem(snapKey()); } catch (e) {}
    /* e as bases da sincronização (nucleo.js:bases), as da conta que sai e as
       que esta tinha cá de outra vez: eram versões de casas e registos que o
       db em branco já não tem — ocupavam o localStorage, e uma base sem o
       objeto local não serve a fusão nenhuma */
    bases = {}; basesPorEnviar = {};
    [prevOwner, u.id].forEach(function (id) { try { localStorage.removeItem(baseKey(id)); } catch (e) {} });
  }
  /* a base local passa a ser desta conta já agora, e não só quando o primeiro
     estado chegar: o que se registar antes dele (sem rede logo a seguir a
     entrar) é desta conta, e o applyState funde-o em vez de o tomar por dados
     de outra (nucleo.js:applyState) */
  try { localStorage.setItem(LS_OWNER, u.id); } catch (e) {}
  /* O CW.state não está guardado no aparelho, mas sobrevive a uma troca de
     conta na mesma página: sem isto, quem entrava a seguir via os cargos, os
     colaboradores e as ligações de quem saiu, até o primeiro estado chegar. */
  CW.state = estadoVazio();
  CW.cargos = {}; CW.pessoas = {}; CW._pulled = 0; CW._esperaFim = 0;
  seloAplicado = ''; resumoAplicado = '';   // o selo do estado era da sessão anterior
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
  CW._chegadaMsg = ''; CW._chegadaErro = '';
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
  var info = document.getElementById('cwa_info');
  if (info) info.textContent = '';
  /* o que se pode dizer antes de perguntar ao servidor diz-se junto do campo
     (componentes.js:falhaCampo); os termos dizem-se logo por baixo da caixa */
  if (!String(payload.email || '').trim()) return falhaCampo('cwa_email', 'Escreve o teu email.');
  if (!login && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(payload.email).trim())) {
    return falhaCampo('cwa_email', 'Email inválido — confirma o formato (ex.: nome@exemplo.pt).');
  }
  if (login && !payload.password) return falhaCampo('cwa_pass', 'Escreve a palavra-passe.');
  if (!login) {
    payload.name = val('cwa_name');
    var prob = passProblem(payload.password);
    if (prob) return falhaCampo('cwa_pass', prob);
    if (payload.password !== val('cwa_pass2')) return falhaCampo('cwa_pass2', 'As palavras-passe não coincidem.');
    var chk = document.getElementById('cwa_terms');
    if (!chk || !chk.checked) {
      errEl.textContent = 'Tens de aceitar os Termos e a Política de Privacidade para criar a conta.';
      return;
    }
    payload.terms = L.version;
  }
  /* numa rede lenta não acontecia nada visível: o segundo toque disparava
     um segundo pedido */
  var b = document.querySelector('button[data-click="CW.submitAuth()"]');
  if (b) { b.disabled = true; b._rotulo = b.textContent; b.textContent = login ? 'A entrar…' : 'A criar a conta…'; }
  var repor = function () { if (b) { b.disabled = false; b.textContent = b._rotulo; } };
  api('POST', login ? '/api/auth/login' : '/api/auth/register', payload)
    .then(function (u) {
      /* este é o único sítio que sabe que a conta acabou de nascer: as
         boas-vindas ficam por ver neste aparelho (apresentacao.js:aprContaNova),
         antes de o finishLogin pintar a app */
      if (!login && u && typeof aprContaNova === 'function') aprContaNova(u.id);
      finishLogin(u);
    })
    .catch(function (e) { repor(); errEl.textContent = e.message || 'Não foi possível entrar.'; });
};

/* Esqueci-me da palavra-passe: pede a ligação por email e, quando a pessoa
   volta com o token no endereço, troca-a aqui mesmo. A resposta do servidor
   é sempre a mesma, exista a conta ou não. Sem email escrito, o campo diz que
   é para lá que vai a ligação (era um prompt() do sistema). O que o servidor
   responde fica escrito no próprio ecrã (#cwa_info): um aviso em baixo
   ficava por trás do ecrã de entrada, que está por cima de tudo.
   Recebe: e (opcional) — o evento do clique, para travar a navegação da ligação.
   Devolve: nada — pede a ligação de reposição e diz o resultado no ecrã. */
CW.esqueci = function (e) {
  if (e) e.preventDefault();
  var em = String(val('cwa_email') || '').trim();
  if (!em) return falhaCampo('cwa_email', 'Escreve o email da tua conta: é para lá que vai a ligação.');
  var diz = function (t) {
    var info = document.getElementById('cwa_info');
    if (info) info.textContent = t; else toast(t);
  };
  api('POST', '/api/auth/repor', { email: em })
    .then(function (r) { diz(r.msg || 'Se esse email tiver conta, enviámos uma ligação.'); })
    .catch(function () { diz('Não deu para pedir agora — tenta daqui a pouco.'); });
};

/* No ambiente de dev, numa conta de teste, a marca do topo dá lugar a um
   seletor: as contas de teste DESTE dev, trocáveis a um toque, mais a opção
   de criar uma extra. A cache local não se mistura — o sync deteta a troca
   de dono (LS_OWNER) e substitui tudo pelo estado da conta nova. É um fluxo
   de teste: pede o token da conta nova com o X-Rendorium-Token (o servidor
   só o devolve fora de produção) e guarda-o, porque troca a sessão sem que o
   cookie seja o dela; o arranque seguinte larga-o se o cookie servir
   (nucleo.js:largarTokenAntigo). */
(function () {
  var u = CW.user;
  if (!u || !/@teste\.rendorium\.com$/.test(u.email || '')) return;
  if (!/^dev\.rendorium\.com$|^gestor-imobiliario-dev\.|^localhost$|^127\./.test(location.hostname)) return;
  var sessao = u.token ? { Authorization: 'Bearer ' + u.token } : {};   // sem token, vale o cookie
  fetch('/api/teste/contas', { headers: sessao, credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.contas || !d.contas.length) return;
      var brand = document.querySelector('.brand');
      if (!brand) return;
      /* o menu de escolha da própria app (sel), não o <select> do sistema —
         que destoava aqui tanto como destoava nos formulários */
      if (typeof window.sel !== 'function') return;
      var atual = d.contas.find(function (c) { return c.atual; }) || d.contas[0];
      var rotulo = function (ct) { return 'Teste ' + ct.email.split('@')[0].replace('teste-', '#'); };
      var opcoes = d.contas.map(function (ct) { return { v: ct.id, label: rotulo(ct) }; });
      opcoes.push({ div: true }, { v: '+nova', label: 'Nova conta de teste' });
      /* vai como função para o sel(): um window.x posto aqui, depois do
         arranque, fica fora da lista dos nomes da app (eventos.js) */
      var cwTrocaConta = function () {
        var inp = document.getElementById('cwContas');
        var v = inp && inp.value;
        if (!v || v === atual.id || window._cwTroca) return;
        window._cwTroca = true;
        var alvo = v === '+nova' ? ['/api/teste/nova', {}] : ['/api/teste/trocar', { para: v }];
        fetch(alvo[0], {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json', 'X-Rendorium-Token': '1' }, sessao),
          body: JSON.stringify(alvo[1]),
          credentials: 'same-origin',
        })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('troca recusada')); })
          .then(function (n) {
            var nova = { id: n.id, email: n.email, name: n.name };
            if (n.token) nova.token = n.token;
            try { localStorage.setItem(LS_USER, JSON.stringify(nova)); } catch (e) {}
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
      brand.innerHTML = '<div class="u-fx-1 u-minw-0">' +
        window.sel('cwContas', atual.id, opcoes, cwTrocaConta, 'dados') + '</div>';
    })
    .catch(function () { /* sem seletor, fica a marca */ });
})();

/* Entrar com um token no endereço: é a porta do ambiente de teste (/test)
   e de qualquer ligação de sessão emitida pelo servidor. O token sai já da
   URL, valida-se contra /api/me, e a app recarrega com a sessão posta — um
   fluxo de teste, que vive do token (Bearer) até o arranque confirmar que o
   cookie posto pelo /t/entrar é da mesma conta (nucleo.js:largarTokenAntigo). */
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

/* O «Cancelar» da sobreposição da palavra-passe nova: tira o #cwRepor do
   documento. Era o document.getElementById('cwRepor').remove() escrito no
   on…=, e a gramática das ações não tem o document (não é um nome da app).
   Recebe: nada.
   Devolve: nada — tira o #cwRepor do documento. */
function fecharRepor() {
  document.getElementById('cwRepor').remove();
}

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
      '<div class="card u-maxw-420px u-w-100pc u-p-24px u-m-auto">' +
      '<div class="title u-fs-18px u-mb-12px">Palavra-passe nova</div>' +
      '<div class="form">' +
      '<label>Nova palavra-passe <span class="req">*</span><input id="rp_1" type="password" autocomplete="new-password"></label>' +
      '<label>Repete-a <span class="req">*</span><input id="rp_2" type="password" autocomplete="new-password"></label>' +
      '<div class="hint">8+ caracteres, com maiúscula, minúscula, número e símbolo.</div>' +
      '<div id="rp_err" class="small u-c-v-danger"></div></div>' +
      '<div class="toolbar u-mt-14px u-d-flex u-g-8px u-jc-flex-end">' +
      '<button class="btn" data-click="fecharRepor()">Cancelar</button>' +
      '<button class="btn primary" data-click="CW.reporConfirmar()">Guardar</button></div></div>';
    document.body.appendChild(el);
    try { document.getElementById('rp_1').focus(); } catch (e) {}
  }, 700);
})();

/* ---------------- aterragem: ?convite=<token>, ?ligar=<token> e ?grupo=<token> ----------------
   A ligação de convite (uso único, com cargo), a ligação de partilha
   (permanente) e a ligação de um grupo partilhado (multi-uso, 7 dias) chegam
   pelo endereço. O token sai já do URL e fica em sessionStorage ('gi_convite'
   / 'gi_ligar' / 'gi_grupo'); o GET de pré-visualização não altera nada — só
   o «Aceitar», o «Enviar pedido» ou o «Pedir para entrar» (POST, com sessão)
   agem. Sem sessão, o ecrã de entrada diz porquê e o resgate acontece depois
   de finishLogin; com sessão, no arranque, mal os avisos de entrada saiam. */

// Lê o endereço à procura de um token de convite, de partilha ou de grupo
// (64 hex), com o parseConvite de web/app/acessos.js.
// Recebe: search — o location.search.
// Devolve: {tipo:'convite'|'ligar'|'grupo', token} ou null.
function chegadaNoEndereco(search) {
  return parseConvite(search) || null;
}

// A chave do sessionStorage onde o token de cada tipo de chegada espera.
// Recebe: tipo — 'convite', 'ligar' ou 'grupo'.
// Devolve: a chave (texto).
function chaveDaChegada(tipo) {
  return tipo === 'ligar' ? 'gi_ligar' : tipo === 'grupo' ? 'gi_grupo' : 'gi_convite';
}

// O que ficou guardado nesta sessão do browser à espera de resgate.
// Devolve: {tipo, token} ou null.
function chegadaGuardada() {
  try {
    var c = sessionStorage.getItem('gi_convite');
    if (c) return { tipo: 'convite', token: c };
    var l = sessionStorage.getItem('gi_ligar');
    if (l) return { tipo: 'ligar', token: l };
    var g = sessionStorage.getItem('gi_grupo');
    if (g) return { tipo: 'grupo', token: g };
  } catch (e) {}
  return null;
}

// Esquece o token guardado de um tipo (depois de agir, ou de «Agora não»).
// Recebe: tipo — 'convite', 'ligar' ou 'grupo'.
// Devolve: nada — limpa o sessionStorage.
function esquecerChegada(tipo) {
  try { sessionStorage.removeItem(chaveDaChegada(tipo)); } catch (e) {}
}

// A pré-visualização de uma ligação (GET público): quem convida, o cargo, os
// imóveis — num grupo, o nome, o dono, os imóveis e quantos membros tem.
// Recebe: ch — {tipo, token}.
// Devolve: Promise com a resposta do servidor ({ownerName, roleName, perms, houses…}).
function preverChegada(ch) {
  var rota = ch.tipo === 'ligar' ? '/api/ligar/' : ch.tipo === 'grupo' ? '/api/grupo/' : '/api/convite/';
  return api('GET', rota + encodeURIComponent(ch.token));
}

// A pré-visualização guardada da chegada de um tipo, para a frase do ecrã
// de entrada quando se sai com «Não sou eu».
// Recebe: tipo — 'convite', 'ligar' ou 'grupo'.
// Devolve: a pré-visualização ({ownerName, …}), ou null.
function prevDaChegada(tipo) {
  return (tipo === 'ligar' ? CW._ligarPrev : tipo === 'grupo' ? CW._grupoPrev : CW._convitePrev) || null;
}

// A frase para o ecrã de entrada, a partir da pré-visualização.
// Recebe: ch — {tipo, token}; prev — a resposta da pré-visualização (pode vir null).
// Devolve: o texto da nota.
function fraseDaChegada(ch, prev) {
  if (ch.tipo === 'ligar') {
    return (prev && prev.ownerName ? prev.ownerName + ' pede que partilhes imóveis com ele. ' : '') +
      'Entra ou cria conta para responderes.';
  }
  if (ch.tipo === 'grupo') {
    // entrar num grupo é um pedido: o dono aceita (cloud/grupos.js:CW.entrarNoGrupo)
    if (!prev) return 'Entra ou cria conta para pedires para entrar.';
    var n = (prev.houses || []).length;
    return (prev.ownerName || 'Alguém') + ' convida-te para o grupo «' + (prev.name || 'sem nome') + '» (' +
      (n === 1 ? '1 imóvel' : n + ' imóveis') + '). Entra ou cria conta para pedires para entrar.';
  }
  if (!prev) return 'Entra ou cria conta para aceitares o convite.';
  var casas = nomesPorExtenso(prev.houses);
  return (prev.ownerName || 'Alguém') + ' convida-te para colaborar' + (prev.roleName ? ' como ' + prev.roleName : '') +
    (casas ? ' em ' + casas : '') + '. Entra ou cria conta para aceitares o convite.';
}

// Os nomes dos imóveis de uma ligação numa frase: «A», «A e B», «A, B e C».
// Recebe: casas — os imóveis da pré-visualização ([{name}]).
// Devolve: o texto (sem escapar), ou '' sem nomes.
function nomesPorExtenso(casas) {
  var n = (casas || []).map(function (h) { return h && h.name; }).filter(Boolean);
  return n.length < 2 ? (n[0] || '') : n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1];
}

(function () {
  var ch = chegadaNoEndereco(location.search);
  if (!ch) return;
  // o token sai já do endereço: não fica no histórico nem em partilhas
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  try { sessionStorage.setItem(chaveDaChegada(ch.tipo), ch.token); } catch (e) {}
  if (CW.user) return;   // com sessão, o arranque resgata
  CW._chegadaMsg = fraseDaChegada(ch, null);
  preverChegada(ch).then(function (prev) {
    CW._chegadaMsg = fraseDaChegada(ch, prev);
    CW._chegadaPrev = prev || null;
    pintarNotaDaChegada();   // a nota do ecrã aberto: o avatar de quem convida e a frase
  }).catch(function (e) {
    /* ligação que não serve: diz-se já, e não se volta a perguntar. Mudar só
       o texto da nota deixava o resto a prometer o convite (o «Entrar e ver o
       convite», a faixa, o avatar), e trocar de separador apagava o erro: o
       ecrã aberto redesenha-se com ele (showAuth lê o CW._chegadaErro), e um
       ecrã que ainda não abriu mostra-o quando abrir — chamar o showAuth
       daqui abria a entrada antes de o arranque a decidir. */
    esquecerChegada(ch.tipo);
    CW._chegadaMsg = ''; CW._chegadaPrev = null;
    CW._chegadaErro = e.message || 'Essa ligação não serve.';
    if (authEl && authEl.style.display !== 'none') showAuth();
  });
})();

// «Não sou eu»: sai da conta e volta ao ecrã de entrada, sem esquecer a
// ligação — quem entrar a seguir é que responde.
// Recebe: e (opcional) — o evento do clique, para travar a navegação.
// Devolve: nada — termina a sessão e mostra o ecrã de entrada.
CW.naoSouEu = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  // a frase da ligação guardada é a nota do ecrã de entrada (showAuth sem mensagem)
  var ch = chegadaGuardada();
  CW._chegadaMsg = ch ? fraseDaChegada(ch, prevDaChegada(ch.tipo)) : '';
  CW._chegadaPrev = ch ? prevDaChegada(ch.tipo) : null;
  encerrarSessao({ avisarServidor: true });
};

// «Agora não»: fecha o modal e esquece a ligação nesta sessão (a ligação em
// si continua a valer — basta abri-la outra vez).
// Recebe: tipo — 'convite', 'ligar' ou 'grupo'.
// Devolve: nada — fecha e limpa.
CW.chegadaDepois = function (tipo) {
  esquecerChegada(tipo);
  CW._convitePrev = null; CW._ligarPrev = null; CW._grupoPrev = null;
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

// A linha «Entras como <email>» com o «Não sou eu», para os modais da chegada.
// Recebe: nada (lê CW.user).
// Devolve: o HTML (texto).
function entrasComo() {
  return '<p class="small cv-quem">Entras como <b>' + esc(CW.user.email || CW.user.name || '') + '</b> · ' +
    '<a href="#" data-toca="ecra" data-click="CW.naoSouEu(event)">Não sou eu</a></p>';
}

/* Os imóveis de uma ligação em mosaicos (o canvas M-ConviteAceitar): a capa
   de cada um (a cor estável do imóvel, lista-imoveis.js:imvMosaico, quando
   o serviço dos Imóveis está carregado) e o nome por baixo.
   Recebe: casas — os imóveis da pré-visualização ([{id, name}]).
   Devolve: o HTML dos mosaicos (texto), ou '' sem imóveis. */
function casasDaChegada(casas) {
  if (!casas || !casas.length) return '';
  return '<div class="cv-casas">' + casas.map(function (h) {
    var cor = typeof imvMosaico === 'function' ? imvMosaico(h) : 'imv-t0';
    return '<div class="cv-casa"><div class="cv-capa imv-mosaico ' + cor + '" aria-hidden="true"></div><b>' + esc(h.name || 'Sem nome') + '</b></div>';
  }).join('') + '</div>';
}

// O modal do convite (o canvas M-ConviteAceitar): quem convida e para quantos
// imóveis, com que cargo e o que isso não dá, os imóveis em mosaicos, o que
// vai poder fazer (um visto por permissão do cargo, e o cadeado no que fica
// com os donos), quem está a entrar, e «Agora não» / «Aceitar convite». Só o
// Aceitar gasta a ligação.
// Recebe: token — o token; prev — a pré-visualização do servidor.
// Devolve: nada — abre o modal.
function modalConvite(token, prev) {
  CW._convitePrev = prev;
  var n = (prev.houses || []).length;
  // os rótulos são do serviço Colaboradores (colaboradores.js); desligado, o convite não se aceita e o «Vais poder» sai
  var pode = servicoLigado('colaboradores') ? permsFechadas(prev.perms || []).map(rotuloDe) : [];
  openModal('Convite para colaborar',
    '<div class="cv">' +
    '<p class="disp cv-tit">' + esc(prev.ownerName || 'Alguém') + ' convida-te para ajudar a gerir ' +
      (n === 1 ? '1 imóvel' : n ? n + ' imóveis' : 'os seus imóveis') + '.</p>' +
    '<p class="small">Com o cargo <b>' + esc(prev.roleName || 'colaborador') + '</b>. Não entras na compropriedade: nem nas quotas nem nas contas entre donos.</p>' +
    casasDaChegada(prev.houses) +
    (pode.length
      ? '<section class="cv-pode" aria-labelledby="cvPode"><p class="lbl" id="cvPode">O que vais poder fazer</p><ul>' +
        pode.map(function (t) { return '<li>' + ic('check', 18) + '<span>' + esc(t) + '</span></li>'; }).join('') +
        '<li class="cv-nao">' + ic('lock', 18) + '<span>As quotas e as contas entre donos ficam com os donos</span></li></ul></section>'
      : '') +
    '<p class="small">Podes sair quando quiseres, em Pessoas → Colaboradores.</p>' +
    entrasComo() + '</div>',
    '<button class="btn" data-toca="camada" data-click="CW.chegadaDepois(\'convite\')">Agora não</button>' +
    '<button class="btn primary" data-toca="dados" data-click="CW.aceitarConvite(\'' + jsq(token) + '\')">Aceitar convite</button>');
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
    ? '<div><div class="flabel">Escolhe quais</div><div class="list u-g-7px">' + meus.map(function (p) {
        return '<label class="check"><input type="checkbox" id="cw_lig_h_' + p.id + '"><span class="u-minw-0"><b>' + esc(p.name || 'Sem nome') + '</b>' +
          (p.address ? ' <span class="small">' + esc(p.address) + '</span>' : '') + '</span></label>';
      }).join('') + '</div></div>'
    : '<div class="hint">Ainda não tens imóveis para partilhar — cria um primeiro e volta a abrir a ligação.</div>';
  openModal('Pedido de partilha',
    '<div class="cv"><p class="disp cv-tit">' + dono + ' pede que partilhes imóveis com ele.</p>' +
    '<p class="small">' + dono + ' passa a comproprietário dos imóveis que escolheres — vê contratos, movimentos e pessoas desses imóveis. Cada pedido fica à espera que ele aceite.</p>' +
    '<div class="form">' + caixas + '</div>' +
    entrasComo() + '</div>',
    '<button class="btn" data-toca="camada" data-click="CW.chegadaDepois(\'ligar\')">Agora não</button>' +
    (meus.length ? '<button class="btn primary" data-toca="dados" data-click="CW.enviarPedido(\'' + jsq(token) + '\')">Enviar pedido</button>' : ''));
}

/* O modal da ligação de um grupo partilhado (a família do convite,
   M-ConviteAceitar): quem convida e para que grupo, os imóveis que já lá
   estão em mosaicos, o que entrar implica — é um pedido, que o dono tem de
   aceitar; depois, comproprietário deles todos, e os que a pessoa adicionar
   ficam partilhados — e «Pedir para entrar» / «Agora não». Só o Pedir
   (POST, cloud/grupos.js:CW.entrarNoGrupo) age.
   Recebe: token — o token; prev — a pré-visualização ({name, ownerName, houses, members}).
   Devolve: nada — abre o modal. */
function modalGrupo(token, prev) {
  CW._grupoPrev = prev;
  var dono = esc(prev.ownerName || 'Alguém');
  var casas = casasDaChegada(prev.houses);
  var membros = Number(prev.members) || 0;
  openModal('Grupo de ' + (prev.ownerName || ''),
    '<div class="cv">' +
    '<p class="cv-frase"><b>' + dono + '</b> convida-te para o grupo <b>«' + esc(prev.name || 'sem nome') + '»</b>' +
    (membros ? ' (' + membros + (membros === 1 ? ' pessoa' : ' pessoas') + ')' : '') + '.</p>' +
    (casas ? '<p class="lbl">Imóveis no grupo</p>' + casas
      : '<p class="small">O grupo ainda não tem imóveis — os que os membros adicionarem passam a ser partilhados contigo.</p>') +
    '<p class="small">Ao pedires para entrar, <b>' + dono + '</b> tem de aceitar. Depois passas a comproprietário ' +
    (casas ? 'destes imóveis' : 'dos imóveis do grupo') + ' — vês contratos, movimentos e pessoas. ' +
    'Os imóveis que adicionares ao grupo ficam partilhados com todos os membros. Podes sair quando quiseres, em Casas → Grupos.</p>' +
    entrasComo() + '</div>',
    '<button class="btn" data-toca="camada" data-click="CW.chegadaDepois(\'grupo\')">Agora não</button>' +
    '<button class="btn primary" data-toca="dados" data-click="CW.entrarNoGrupo(\'' + jsq(token) + '\')">Pedir para entrar</button>');
}

/* Resgata a ligação guardada, com sessão: espera que os avisos de entrada
   (aviso inicial, termos, atualização) e a janela de uma apresentação saiam
   do ecrã, pede a pré-visualização e abre o modal certo. Uma ligação que já
   não serve diz-o e esquece-se. Enquanto a janela da ligação não abre, a
   marca CW._chegadaPorAbrir diz às boas-vindas que esperem por ela
   (apresentacao.js:aprEcraOcupado): quem chega por um convite vê primeiro o
   convite, e as boas-vindas a seguir, já com o cargo que ele deu.
   Devolve: nada — abre o modal quando puder (ou não faz nada sem ligação). */
CW.resgatarChegada = function () {
  var ch = chegadaGuardada();
  if (!ch || !CW.user) { CW._chegadaPorAbrir = false; return; }
  CW._chegadaPorAbrir = true;
  // a janela da ligação abriu, ou deixou de haver por que esperar: a apresentação já pode tentar
  var largar = function () {
    CW._chegadaPorAbrir = false;
    if (typeof aprAgendar === 'function') aprAgendar();
  };
  var ocupado = function () {
    return document.getElementById('cwLegal') || document.getElementById('cwTerms') ||
      document.getElementById('cwUpd') || (authEl && authEl.style.display !== 'none') ||
      (typeof aprAberta === 'function' && aprAberta());
  };
  var tentativas = 0;
  var tentar = function () {
    // sem sessão, ou já respondida (ou esquecida) noutro sítio: não há janela a abrir
    if (!CW.user || chegadaGuardada() === null) return largar();
    if (ocupado()) { if (tentativas++ < 120) setTimeout(tentar, 800); else largar(); return; }
    if (CW._chegadaEmCurso) return;
    CW._chegadaEmCurso = true;
    preverChegada(ch).then(function (prev) {
      CW._chegadaEmCurso = false;
      if (chegadaGuardada() === null) return largar();   // entretanto respondida noutro sítio
      if (ch.tipo === 'ligar') modalLigar(ch.token, prev || {});
      else if (ch.tipo === 'grupo') modalGrupo(ch.token, prev || {});
      else modalConvite(ch.token, prev || {});
      largar();
    }).catch(function (e) {
      CW._chegadaEmCurso = false;
      esquecerChegada(ch.tipo);
      openModal(ch.tipo === 'convite' ? 'Este convite já não vale' : 'Esta ligação não serve',
        '<div class="hint u-fs-14px">' + esc(e.message || 'Essa ligação não serve.') + '</div>',
        '<button class="btn primary" data-click="closeModal()">Fechar</button>');
      largar();
    });
  };
  setTimeout(tentar, 400);
};

/* Valida a palavra-passe nova e confirma a reposição com o token da ligação de
   email; se o servidor aceitar, fecha a sobreposição e devolve o ecrã de
   entrada, com a confirmação escrita nele (#cwa_info, role=status): o aviso
   em baixo (.toast, z 90) ficava por trás do ecrã de entrada (z 200), e quem
   acabava de mudar a palavra-passe não via confirmação nenhuma.
   Devolve: nada — os erros ficam escritos na sobreposição; o sucesso fecha-a. */
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
      showAuth();
      var info = document.getElementById('cwa_info');
      if (info) info.textContent = 'Palavra-passe mudada. Entra com a nova.';
    })
    .catch(function (e) { errEl.textContent = e.message || 'Essa ligação já não serve.'; });
};

/* ---- entrada com Google / Apple (aparece quando configurada) ---- */

// Monta a zona "ou continua com…" do ecrã de entrada: pede /api/auth/config
// (fica em cache) e, se houver id do Google, carrega o SDK e desenha o botão.
// Sem configuração — ou sem rede — a zona simplesmente não aparece.
// Devolve: nada — mostra e preenche a zona #cwa_social quando há configuração.
function loadSocial() {
  // Carrega um script externo uma única vez; se já estiver na página, só espera pelo load.
  // Fica aqui dentro, e não no topo, de propósito: uma função de topo está na
  // lista da app do eventos.js, e uma ação injetada chamá-la-ia com o src que
  // quisesse (um <script src> corre). Aqui só carrega o URL fixo do Google.
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
  var mount = document.getElementById('cwa_social');
  if (!mount) return;
  (authCfg !== undefined
    ? Promise.resolve(authCfg)
    : api('GET', '/api/auth/config').then(function (c) { authCfg = c; return c; }).catch(function () { return null; })
  ).then(function (cfg) {
    if (!cfg || !cfg.google) return;
    /* a zona nasce escondida pela classe u-d-none (era um display:none em
       linha), e por isso mostra-se tirando a classe: um mount.style.display
       = '' já não chegava para lhe ganhar */
    mount.classList.remove('u-d-none');
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

// troca a credencial do fornecedor (ex.: Google) por uma sessão nossa e acaba como um login normal.
// O servidor responde igual a quem já tinha conta e a quem a criou neste
// pedido, menos o novo:true deste (worker/src/rotas/auth.js): é o sinal das
// boas-vindas (apresentacao.js:aprContaNova).
// Recebe: provider — o nome do fornecedor no caminho da API (ex.: 'google');
// body — o corpo a enviar a /api/auth/<provider> (ex.: {credential} do Google).
// Devolve: nada — o sucesso acaba em finishLogin; o erro fica escrito no ecrã.
function socialLogin(provider, body) {
  var errEl = document.getElementById('cwa_err');
  api('POST', '/api/auth/' + provider, body)
    .then(function (u) {
      if (u && u.novo === true && typeof aprContaNova === 'function') aprContaNova(u.id);
      finishLogin(u);
    })
    .catch(function (e) { if (errEl) errEl.textContent = e.message || 'Não foi possível entrar.'; });
}


// esconde o ecrã de entrada e devolve o scroll à página
// Devolve: nada — só esconde o elemento e destrava o scroll.
function hideAuth() {
  if (authEl) authEl.style.display = 'none';
  lockScroll(false);
}

/* ---------------- PWA ---------------- */

/* O service worker serve a app toda da MESMA cache, de propósito: é isso que
   impede um carregamento de misturar versões (web/sw.js). O preço é que, num
   servidor local, uma alteração a um ficheiro só se veria depois de mudar a
   versão — e localhost não é uma publicação. No dev fica, que é onde as
   travessias entre versões a sério se exercitam antes de irem para produção. */
/* O updateViaCache: 'none' não é decorativo. Por omissão ele vale 'imports', e
   isso quer dizer que o browser vai buscar o sw.js à rede mas deixa os
   importScripts virem da cache HTTP. O sw.js não muda de bytes entre versões
   — de propósito, para não depender de alguém subir um número lá dentro — e o
   que muda é precisamente o /avisos.js que ele importa. Com o valor por
   omissão, a deteção da versão nova ficava a depender dos cabeçalhos de cache
   de um ficheiro. Uma palavra tira essa decisão do caminho. */
/* E não se regista no domínio raiz. A app existe lá — só o «/» passa pelo
   worker, portanto o rendorium.com/index.html e os /app/*.js vêm dos
   ficheiros e o redirecionamento nunca corre —, mas o «/» dali é a montra, e
   um service worker com âmbito «/» acabaria a servi-la da cache da app. */
if ('serviceWorker' in navigator &&
    !/^(localhost|127\.0\.0\.1|\[::1\]|(www\.)?rendorium\.com)$/.test(location.hostname)) {
  try { navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); } catch (e) {}
}

/* ---------------- arranque ---------------- */

if (CW.user) {
  // sessão em cache: volta à página onde estava e sincroniza em fundo
  /* uma ligação de convite à espera passa à frente das apresentações desde
     já: o estado pode chegar antes do /api/me, que é quem a resgata */
  if (chegadaGuardada()) CW._chegadaPorAbrir = true;
  try { restorePage(); } catch (e) {}
  showLegalGate();
  /* desde a abertura, a nuvem diz que está a tentar: laranja, com o relógio,
     até o /api/state responder ('ok') ou falhar ('off') no startSync */
  setSyncBadge('liga');
  /* As duas leituras do arranque partem JUNTAS. O /api/state estava dentro do
     .then do /api/me e pagava-lhe a ida e volta inteira antes de sequer sair —
     e é ele que destranca os contadores (o sabemosOEstado), portanto essa
     espera era a que se via no crachá dos movimentos por confirmar.

     O que se adianta é o PEDIDO, não a aplicação: a resposta só é tratada
     dentro do startSync, lá em baixo, no mesmo sítio de sempre. A ordem que
     interessa fica intacta — o seed() dos dados de exemplo continua a correr
     antes de o estado do servidor ser aplicado, e sem isso um servidor vazio
     apagava o exemplo acabado de criar, dentro da janela em que ele ainda não
     tinha subido.

     O .catch vazio não trata nada: quem trata é o startSync. Serve só para o
     motor não dar a promessa por órfã enquanto o /api/me não volta — uma
     rejeição sem ouvinte no mesmo instante é um unhandledrejection, e este
     projeto relata-os. */
  var pEstado = pedirEstado(false);
  pEstado.catch(function () {});
  // uma sessão guardada com o token (de antes de ele sair das respostas):
  // passa a viver do cookie, se o cookie for desta conta
  largarTokenAntigo();
  api('GET', '/api/me').then(function (u) {
    CW.user = Object.assign({}, CW.user, { id: u.id, name: u.name, email: u.email });
    guardarSessao();
    // conta anterior a estes documentos: pedir a aceitação antes de continuar
    if (u.termsCurrent && u.terms !== u.termsCurrent) showTermsGate();
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
    startSync(pEstado);
    CW.resgatarChegada();   // uma ligação de convite ou de partilha à espera
  }).catch(function (e) {
    // sem o /api/me não há resgate da ligação: as apresentações deixam de esperar por ele
    CW._chegadaPorAbrir = false;
    if (e && e.status === 401) sessionLost();
    // offline: continua local — e com a MESMA leitura já disparada, senão
    // este caminho abria um segundo /api/state, sem nada que trave dois
    // applyState a chegarem fora de ordem. O selo não se mexe aqui: quem diz
    // se há ligação é essa leitura, no startSync — pô-lo em «Sem ligação» já
    // o fazia piscar para «A ligar» e outra vez para «Sem ligação», e
    // mentia se o /api/state respondesse e só o /api/me tivesse falhado
    else startSync(pEstado);
  });
} else {
  showAuth();
}
