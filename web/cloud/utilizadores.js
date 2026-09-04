/* Os proprietarios sao os utilizadores: perfil proprio e quotas por proposta. */
'use strict';

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

/* mete um seletor de indicativo de país à frente do campo do telefone no modal de
   perfil, separando o indicativo que já lá estiver escrito do resto do número
   (mexe no DOM: embrulha campo e seletor numa linha flex). Não faz nada se o campo
   não existir ou se o seletor já tiver sido injetado.
   Devolve: nada — injeta o seletor no DOM do modal do perfil. */
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

/* abre "O meu perfil": a ficha de proprietário do próprio utilizador (criada na hora
   se faltar, com nome e email da conta a entrarem nos campos vazios), com o seletor
   de indicativo no telefone. Embrulha o onSave do modal para juntar indicativo e
   número antes de gravar. Sem sessão iniciada, abre antes o ecrã de entrada.
   Devolve: nada — abre o modal do perfil (ou o ecrã de entrada). */
CW.editProfile = function () {
  if (!CW.user) return showAuth();
  var meP = (db.owners || []).find(function (o) { return o.id === CW.user.id; });
  if (!meP) {
    meP = normPerson({ name: CW.user.name || '' });
    meP.id = CW.user.id;
    db.owners.push(meP);
  }
  /* o que a conta já sabe não se pergunta outra vez: o email do registo ou
     do Google e o nome entram sozinhos nos campos vazios */
  if (!meP.email && CW.user.email) meP.email = CW.user.email;
  if (!meP.name && CW.user.name) meP.name = CW.user.name;
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

/* HTML da secção "Proprietários e quota-parte" do formulário do imóvel, na versão
   com contas: quotas atuais e, se houver proposta pendente, as novas percentagens
   com os botões de confirmar/rejeitar (ou cancelar, para quem já confirmou); sem
   proposta, o botão de propor. Com um só dono, apenas explica como partilhar.
   Lê o imóvel "vivo" da base, não o rascunho do formulário.
   Devolve: o HTML (texto) da secção, pronto a entrar no corpo do formulário. */
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

// se o modal do imóvel hid estiver aberto, recolhe o que está escrito e repinta-o —
// é assim que uma proposta acabada de chegar aparece sem fechar o formulário.
// Recebe: hid — o id do imóvel (a casa) cujo modal interessa.
// Devolve: nada — recolhe e repinta o modal, se for o desse imóvel.
function refreshPropModal(hid) {
  try {
    if (modalStack.length && pForm && pForm.id === hid) { collectProp(); repaintProp(); }
  } catch (e) {}
}

/* modal para propor nova divisão de quotas da casa hid: valida que as percentagens
   somam 100 e envia a proposta para a API — só entra em vigor quando todos os
   comproprietários confirmarem. Uma divisão igual à atual não gera proposta.
   fromShare ajusta o texto para o caso de a casa ter acabado de ser partilhada;
   no fim segue para a próxima proposta em fila (nextShareProposal).
   Recebe: hid — o id da casa; fromShare (opcional) — verdadeiro quando a casa
   acabou de ser partilhada (muda o texto do modal).
   Devolve: nada — abre o modal; o envio à API acontece no Guardar. */
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

/* responde à proposta de divisão pendente da casa hid: com accept confirma (e avisa
   se, sendo o último, a divisão entrou logo em vigor), sem accept rejeita — que
   serve também para quem propôs a cancelar. Fala com a API e atualiza o modal.
   Recebe: hid — o id da casa; accept — 1/verdadeiro confirma, 0/falso rejeita.
   Devolve: nada — chama a API e depois repinta o modal. */
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
