/* Grupos partilhados de imóveis, na camada da nuvem.
   ---------------------------------------------------
   Os cartões e as ações dos grupos partilhados: criar ou partilhar um grupo,
   a ligação de convite por onde os outros pedem para entrar, os pedidos
   (aceitar, recusar, cancelar), pôr e tirar imóveis, sair, apagar, e a
   aterragem de ?grupo=<token>. O servidor decide, o cliente esconde
   (worker/src/rotas/grupos.js).

   Um grupo partilhado chega no estado (st.sharedGroups) e o rebuildDb
   (nucleo.js:gruposPartilhadosEm) põe-no em db.groups como um grupo de
   imóveis marcado _partilhado, com _dono, _donoNome, _meu, _membros e
   _ligacao. Quem está no grupo é comproprietário de todos os imóveis dele;
   cada membro põe no grupo imóveis seus; o dono cria a ligação multi-uso
   (7 dias) por onde os outros PEDEM para entrar — só entram quando o dono
   aceita (st.sharedGroupRequests: incoming, os que me chegam como dono;
   outgoing, os que fiz) — e pode remover, rodar ou desativar. Depois de cada
   ação: pullNow(true) e render() — e a janela do grupo, se está aberta,
   repinta-se (repintarGrupo). Os cartões e as janelas escondem o que o
   servidor recusaria: «Apagar grupo», «Remover», a ligação, «Aceitar» e
   «Recusar» só ao dono; «Sair do grupo» só a quem não é; «Tirar» ao dono do
   grupo e ao dono do imóvel.

   Os movimentos não vivem no grupo: um movimento de grupo parte-se por
   imóvel ao guardar (app/movimento.js), e cada parte fica no seu imóvel.
   Apagar o grupo ou sair dele não mexe nos movimentos já registados. */
'use strict';

/* ---------------- o que é um grupo partilhado, para este ficheiro ---------------- */

// Um grupo partilhado da base, pelo id (os _partilhado que o rebuildDb pôs em db.groups).
// Recebe: id — o id do grupo.
// Devolve: o grupo (objeto de db.groups), ou null quando não existe ou é privado.
function grupoPartilhado(id) {
  var g = (db.groups || []).find(function (x) { return x.id === id; });
  return g && g._partilhado ? g : null;
}

// Os grupos partilhados em que estou, pela ordem da base.
// Devolve: array de grupos de db.groups (os _partilhado).
function gruposPartilhados() {
  return (db.groups || []).filter(function (g) { return g._partilhado; });
}

/* A chave, no aparelho, do URL da ligação de um grupo — por grupo e por
   conta, como a da ligação de partilha (colaboradores.js:guardarLigacao):
   num aparelho partilhado, a ligação de uma conta não pode ser a que a
   conta seguinte copia.
   Recebe: gid — o id do grupo.
   Devolve: a chave (texto). */
function chaveDaLigacaoDoGrupo(gid) {
  return LS_LIGACAO + '_grupo_' + gid + '_' + (CW.user ? CW.user.id : '');
}

// Guarda no aparelho o URL da ligação de um grupo (o servidor só o devolve
// na criação e na rotação); com url vazio, esquece-o.
// Recebe: gid — o id do grupo; url — a ligação (vazio apaga a guardada).
// Devolve: nada — escreve no localStorage.
function guardarLigacaoDoGrupo(gid, url) {
  try {
    if (url) localStorage.setItem(chaveDaLigacaoDoGrupo(gid), url);
    else localStorage.removeItem(chaveDaLigacaoDoGrupo(gid));
  } catch (e) {}
}

// O URL da ligação de um grupo guardado neste aparelho.
// Recebe: gid — o id do grupo.
// Devolve: o URL (texto), ou '' quando não há.
function ligacaoDoGrupoGuardada(gid) {
  try { return localStorage.getItem(chaveDaLigacaoDoGrupo(gid)) || ''; } catch (e) { return ''; }
}

/* Quem é o dono de um imóvel do grupo, para a linha dele: eu («teu») quando
   o criei, senão quem o partilhou (a marca _sharedFrom do rebuildDb, ou o
   nome pelo id). Um imóvel que já não está na base fica sem dono à vista.
   Recebe: pid — o id do imóvel.
   Devolve: {meu, nome} — nome vazio quando não se sabe. */
function donoDoImovelDoGrupo(pid) {
  var p = prop(pid);
  if (!p) return { meu: false, nome: '' };
  if (cwMinha(p)) return { meu: true, nome: 'teu' };
  return { meu: false, nome: p._sharedFrom || (p._ownerUserId ? nomeUtilizador(p._ownerUserId) : '') };
}

/* Um grupo partilhado meu, acabado de criar ou de partilhar, posto já na base
   com as marcas do rebuildDb, sem esperar pelo estado: a janela abre logo e o
   cartão diz «teu» mesmo que a leitura falhe a seguir. Num grupo privado com
   o mesmo id marca-o em vez de o substituir — o id fica, e os movimentos com
   groupId continuam a apontar para ele; o u:group antigo sai por diferença
   no envio seguinte (nucleo.js:exportEntities). O estado seguinte traz a
   versão do servidor por cima.
   Recebe: id — o id do grupo; nome — o nome; ids — os ids dos imóveis (só
   meus); expiresAt (opcional) — o fim da ligação, quando se criou uma.
   Devolve: o grupo (objeto de db.groups), já gravado. */
function grupoLocalPartilhado(id, nome, ids, expiresAt) {
  db.groups = db.groups || [];
  var g = db.groups.find(function (x) { return x.id === id; });
  if (!g) { g = normGroup({ id: id, kind: 'prop', name: nome, ids: ids }); db.groups.push(g); }
  g.name = nome; g.kind = 'prop'; g.ids = (ids || []).slice();
  g._partilhado = true; g._meu = true;
  g._dono = CW.user ? CW.user.id : ''; g._donoNome = (CW.user && (CW.user.name || CW.user.email)) || '';
  g._membros = [{ id: g._dono, name: g._donoNome }];
  g._ligacao = expiresAt ? { ativo: true, expiresAt: expiresAt, uses: 0 } : null;
  save();
  return g;
}

/* Um grupo partilhado que deixou de ser meu de ver (saí, ou apaguei-o) sai
   da base já, sem esperar pelo estado, como o delGroup das Definições faz a
   um grupo privado, e os filtros que apontavam para ele limpam-se. Os
   movimentos já partidos por imóvel não apontam para o grupo e ficam como
   estão; só um movimento antigo de grupo, ainda por partir, perde o grupo —
   fica «Sem imóvel», a contar só nos totais.
   Recebe: id — o id do grupo.
   Devolve: nada — mexe em db e grava. */
function desligarGrupoLocal(id) {
  (db.transactions || []).forEach(function (t) { if (t.groupId === id) { t.groupId = null; t.psplit = null; } });
  if (String(txProp).slice(2) === id) txProp = '';
  if (String(ownerFilter).slice(2) === id) ownerFilter = '';
  db.groups = (db.groups || []).filter(function (x) { return x.id !== id; });
  // os pedidos do grupo também (o servidor apaga-os com ele): sem isto, o cartão
  // «Pedidos por responder» oferecia os botões até à leitura seguinte
  var sr = CW.state && CW.state.sharedGroupRequests;
  if (sr) ['incoming', 'outgoing'].forEach(function (k) {
    if (Array.isArray(sr[k])) sr[k] = sr[k].filter(function (p) { return !(p && p.groupId === id); });
  });
  save();
}

/* ---------------- os pedidos para entrar ---------------- */

/* Os pedidos por responder para entrar num grupo meu. O estado trá-los em
   dois sítios, do mesmo servidor: sharedGroupRequests.incoming (os que me
   chegam como dono, de todos os meus grupos) e sharedGroups[…].pedidos (os
   de cada grupo); juntam-se sem repetir a pessoa. A quem não é dono do
   grupo, nenhum: só o dono aceita ou recusa.
   Recebe: gid — o id do grupo.
   Devolve: array de {userId, name, createdAt}, pela ordem de chegada. */
function pedidosParaEntrar(gid) {
  var g = grupoPartilhado(gid);
  if (!g || !g._meu) return [];
  var st = CW.state || {};
  var sg = (st.sharedGroups || []).find(function (x) { return x && x.id === gid; });
  var vistos = {}, out = [];
  var poe = function (p) {
    if (!p || !p.userId || vistos[p.userId]) return;
    vistos[p.userId] = 1;
    out.push({ userId: p.userId, name: p.name || '', createdAt: Number(p.createdAt) || 0 });
  };
  ((st.sharedGroupRequests || {}).incoming || []).forEach(function (p) { if (p && p.groupId === gid) poe(p); });
  ((sg && sg.pedidos) || []).forEach(poe);
  return out.sort(function (a, b) { return a.createdAt - b.createdAt; });
}

/* Um pedido para entrar que já teve resposta sai já do estado em memória,
   sem esperar pela leitura: o cartão «Pedidos por responder», o sino, a
   janela do grupo e o cartão «Grupos partilhados» deixam de oferecer os
   botões mesmo que a leitura a seguir falhe. A leitura seguinte traz a
   verdade do servidor por cima.
   Recebe: gid — o id do grupo; uid — o id de quem pediu (um pedido que me
   chegou, aceite ou recusado), ou null para o pedido que eu fiz (cancelado).
   Devolve: nada — mexe em CW.state. */
function pedidoDeGrupoResolvido(gid, uid) {
  var st = CW.state;
  if (!st) return;
  var sr = st.sharedGroupRequests;
  if (!uid) {
    if (sr && Array.isArray(sr.outgoing)) sr.outgoing = sr.outgoing.filter(function (p) { return !(p && p.groupId === gid); });
    return;
  }
  if (sr && Array.isArray(sr.incoming)) sr.incoming = sr.incoming.filter(function (p) { return !(p && p.groupId === gid && p.userId === uid); });
  var sg = (st.sharedGroups || []).find(function (x) { return x && x.id === gid; });
  if (sg && Array.isArray(sg.pedidos)) sg.pedidos = sg.pedidos.filter(function (p) { return !(p && p.userId === uid); });
}

/* Responder a um pedido para entrar num grupo meu (só o dono; o servidor
   recusa aos outros): POST /api/shared-groups/:id/requests/:uid/accept — a
   pessoa passa a membro, comproprietária dos imóveis do grupo — ou …/reject.
   É o que o «Aceitar» e o «Recusar» da janela do grupo, do cartão «Pedidos
   por responder» e do sino têm em comum. Um pedido que já não existe (404:
   a pessoa cancelou entretanto) diz-se e sai da lista na mesma.
   Recebe: gid — o id do grupo; uid — o id de quem pediu; aceitar — true
   para aceitar, false para recusar.
   Devolve: nada — chama a API, avisa, tira o pedido e sincroniza (a janela
   do grupo, se está aberta, repinta-se). */
function responderPedidoDeGrupo(gid, uid, aceitar) {
  if (!CW.user) return;
  if (!servicoLigado('colaboradores')) return toast(hintServicoDesligado('colaboradores'), { ms: 6000 });
  var g = grupoPartilhado(gid);
  var sr = (CW.state && CW.state.sharedGroupRequests) || {};
  var p = (sr.incoming || []).find(function (x) { return x && x.groupId === gid && x.userId === uid; }) ||
    pedidosParaEntrar(gid).find(function (x) { return x.userId === uid; }) || {};
  var nome = p.name || nomeUtilizador(uid), grupo = (g && g.name) || p.groupName || '';
  api('POST', '/api/shared-groups/' + encodeURIComponent(gid) + '/requests/' + encodeURIComponent(uid) + (aceitar ? '/accept' : '/reject'))
    .then(function () {
      pedidoDeGrupoResolvido(gid, uid);
      if (aceitar) toast(nome + ' entrou no grupo' + (grupo ? ' «' + grupo + '»' : '') + '.', { ms: 5000 });
      else toast('Pedido recusado.');
      return aposAcaoNoGrupo(gid);
    })
    .catch(function (e) {
      toast(e.message, { ms: 6000 });
      if (e && e.status === 404) { pedidoDeGrupoResolvido(gid, uid); return aposAcaoNoGrupo(gid); }
    });
}

// «Aceitar» um pedido para entrar num grupo meu (só o dono).
// Recebe: gid — o id do grupo; uid — o id de quem pediu.
// Devolve: nada — responderPedidoDeGrupo trata do resto.
CW.grupoAceitarPedido = function (gid, uid) { responderPedidoDeGrupo(gid, uid, true); };

// «Recusar» um pedido para entrar num grupo meu (só o dono). A pessoa pode
// voltar a pedir pela ligação, enquanto ela valer.
// Recebe: gid — o id do grupo; uid — o id de quem pediu.
// Devolve: nada — responderPedidoDeGrupo trata do resto.
CW.grupoRecusarPedido = function (gid, uid) { responderPedidoDeGrupo(gid, uid, false); };

// «Cancelar pedido»: o pedido que fiz para entrar num grupo e ainda espera
// resposta (DELETE /api/shared-groups/:id/requests/<eu>).
// Recebe: gid — o id do grupo.
// Devolve: nada — chama a API, avisa, tira o pedido e sincroniza.
CW.grupoCancelarPedido = function (gid) {
  if (!CW.user) return;
  if (!servicoLigado('colaboradores')) return toast(hintServicoDesligado('colaboradores'), { ms: 6000 });
  api('DELETE', '/api/shared-groups/' + encodeURIComponent(gid) + '/requests/' + encodeURIComponent(meuId()))
    .then(function () { pedidoDeGrupoResolvido(gid, null); toast('Pedido cancelado.'); return pullNow(true); })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message, { ms: 6000 }); });
};

/* ---------------- a janela do grupo ---------------- */

/* O corpo da janela de um grupo partilhado: de quem é e o que quer dizer
   estar nele; só para o dono, os pedidos para entrar (quem pediu, quando,
   «Aceitar» e «Recusar»); os membros (o dono marcado, eu com «(eu)»,
   «Remover» nos outros só para o dono, «Sair do grupo» para quem não é
   dono); os imóveis com o dono de cada um e «Tirar» a quem pode (o dono do
   grupo, o dono do imóvel); «Pôr os meus imóveis…» (ou a saída para criar o
   primeiro); e, só para o dono, a ligação de convite — criar, ou copiar,
   rodar e desativar, com «expira a <data> · usada N vezes». O que o servidor
   recusaria não se escreve.
   Recebe: g — o grupo (de grupoPartilhado).
   Devolve: o HTML do corpo (texto). */
function corpoDoGrupo(g) {
  var eu = meuId(), dono = !!g._meu, gid = jsq(g.id);
  var intro = '<div class="hint u-fs-14px">' + (dono ? 'Grupo <b>teu</b>' : 'Grupo de <b>' + esc(g._donoNome || '') + '</b>') +
    '. Quem está nele é comproprietário de todos os imóveis do grupo — vê e edita contratos, movimentos e pessoas. Cada membro põe no grupo imóveis seus.</div>';
  // pedidosParaEntrar já não devolve nada a quem não é dono; o «dono &&» diz a regra aqui também
  var pedidos = dono ? pedidosParaEntrar(g.id) : [];
  var pedidosHtml = !pedidos.length ? '' :
    '<div><div class="flabel">Pedidos para entrar</div><div class="list u-g-7px">' + pedidos.map(function (p) {
      var nome = p.name || nomeUtilizador(p.userId);
      var quando = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : '';
      return '<div class="card u-p-11px-13px">' +
        '<div class="u-d-flex u-ai-center u-g-10px"><span class="avatar u-w-32px u-h-32px u-fx-0-0-32px u-fs-12px">' + esc(initials(nome)) + '</span>' +
        '<span class="u-fx-1 u-minw-0"><b class="u-d-block">' + esc(nome) + '</b>' +
        '<span class="small">quer entrar' + (quando ? ' · pediu a ' + esc(quando) : '') + '</span></span></div>' +
        '<div class="toolbar u-mt-9px">' +
        '<button class="btn primary sm" data-toca="dados" data-click="CW.grupoAceitarPedido(\'' + gid + '\',\'' + jsq(p.userId) + '\')">Aceitar</button>' +
        '<button class="btn sm danger" data-toca="dados" data-click="CW.grupoRecusarPedido(\'' + gid + '\',\'' + jsq(p.userId) + '\')">Recusar</button></div></div>';
    }).join('') + '</div>' +
    '<div class="hint u-mt-6px">Se aceitares, passa a comproprietário dos imóveis do grupo — vê e edita contratos, movimentos e pessoas.</div></div>';
  var membros = (g._membros || []).map(function (m) {
    var nome = m.name || nomeUtilizador(m.id);
    return '<div class="card u-p-11px-13px u-d-flex u-ai-center u-g-10px">' +
      '<span class="avatar u-w-32px u-h-32px u-fx-0-0-32px u-fs-12px">' + esc(initials(nome)) + '</span>' +
      '<span class="u-fx-1 u-minw-0"><b class="u-d-block">' + esc(nome) + (m.id === eu ? ' (eu)' : '') + '</b>' +
      (m.id === g._dono ? '<span class="badge grey">dono</span>' : '<span class="small">membro</span>') + '</span>' +
      (dono && m.id !== eu
        ? '<button class="btn sm danger u-fx-0-0-auto" data-toca="dados" data-risco="destroi" data-click="CW.grupoRemoverMembro(\'' + gid + '\',\'' + jsq(m.id) + '\')">Remover</button>'
        : '') + '</div>';
  }).join('');
  var sair = dono ? '' :
    '<div class="toolbar u-mt-9px"><button class="btn sm danger" data-toca="dados" data-risco="destroi" data-click="CW.grupoSair(\'' + gid + '\')">Sair do grupo</button></div>' +
    '<div class="hint u-mt-6px">Ao saíres, os imóveis que puseste saem contigo. Os movimentos já registados ficam em cada imóvel.</div>';
  var casas = (g.ids || []).map(function (pid) {
    var p = prop(pid), d = donoDoImovelDoGrupo(pid);
    return '<div class="card u-p-11px-13px u-d-flex u-ai-center u-g-10px">' +
      '<span class="u-fx-1 u-minw-0"><b class="u-d-block">' + esc(p ? (p.name || 'Sem nome') : 'Imóvel') + '</b>' +
      '<span class="small">' + (d.meu ? 'teu' : d.nome ? 'de ' + esc(d.nome) : '') + '</span></span>' +
      (dono || d.meu
        ? '<button class="btn sm danger u-fx-0-0-auto" data-toca="dados" data-risco="destroi" data-click="CW.grupoTirarImovel(\'' + gid + '\',\'' + jsq(pid) + '\')">Tirar</button>'
        : '') + '</div>';
  }).join('');
  var meus = imoveisMeus().length;
  var por = meus
    ? '<div class="toolbar u-mt-9px"><button class="btn sm" data-toca="camada" data-click="CW.grupoImoveis(\'' + gid + '\')">' + ic('building', 14) + ' Pôr os meus imóveis…</button></div>'
    : '<div class="hint u-mt-9px">Ainda não tens imóveis teus para pôr no grupo.</div>' +
      (servicoLigado('properties') ? saida('Adicionar imóvel', 'propModal()', 'camada') : vazioServicoDesligado('properties'));
  var ligacao = '';
  if (dono) {
    var l = g._ligacao, ativa = !!(l && l.ativo);
    var expira = ativa && l.expiresAt ? new Date(Number(l.expiresAt)).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : '';
    // cada pedido feito pela ligação conta um uso (rotas/grupos.js); quem já estava não conta
    var usos = Number(l && l.uses) || 0;
    ligacao = '<div><div class="flabel">Ligação de convite</div>' +
      (ativa
        ? '<div class="small">Ativa' + (expira ? ' · expira a ' + esc(expira) : '') + ' · ' + (usos ? 'usada ' + usos + (usos === 1 ? ' vez' : ' vezes') : 'ainda por usar') + '</div>' +
          '<div class="toolbar u-mt-9px">' +
          '<button class="btn primary sm" data-toca="nada" data-click="CW.grupoLigacaoCopiar(\'' + gid + '\')">Copiar ligação</button>' +
          '<button class="btn sm" data-toca="dados" data-click="CW.grupoLigacaoRodar(\'' + gid + '\')">Rodar</button>' +
          '<button class="btn sm danger" data-toca="dados" data-click="CW.grupoLigacaoDesativar(\'' + gid + '\')">Desativar</button></div>'
        : '<div class="toolbar"><button class="btn primary sm" data-toca="dados" data-click="CW.grupoLigacaoCriar(\'' + gid + '\')">' + ic('plus', 14) + ' Criar ligação</button></div>') +
      '<div class="hint u-mt-8px">Quem a abrir pede para entrar, e só entra quando aceitares — os pedidos aparecem em cima. Vale 7 dias e serve para várias pessoas; podes rodá-la ou desativá-la quando quiseres.</div></div>';
  }
  return '<div class="form">' + intro + pedidosHtml +
    '<div><div class="flabel">Membros</div><div class="list u-g-7px">' + membros + '</div>' + sair + '</div>' +
    '<div><div class="flabel">Imóveis</div>' +
    (casas ? '<div class="list u-g-7px">' + casas + '</div>' : '<div class="hint">Ainda não há imóveis no grupo. Os que os membros puserem ficam partilhados com todos.</div>') +
    por + '</div>' + ligacao + '</div>';
}

/* Abre a janela de um grupo partilhado (corpoDoGrupo), com «Fechar» no
   rodapé — cada ação lá dentro grava na hora, não há Guardar — e, só para o
   dono, o menu com «Mudar o nome…» e «Apagar grupo». Guarda a camada em
   CW._grupoJanela para a repintar depois de cada ação.
   Recebe: id — o id do grupo.
   Devolve: nada — abre a janela (ou avisa, se o grupo já não está na base). */
CW.grupoModal = function (id) {
  var g = grupoPartilhado(id);
  if (!g) return toast('Esse grupo já não está na lista.');
  var m = g._meu ? menu('grupo_' + g.id, [
    { label: 'Mudar o nome…', icon: 'pen', toca: 'camada', act: "CW.grupoRenomear('" + jsq(id) + "')" },
    { label: 'Apagar grupo', icon: 'trash', danger: true, toca: 'dados', risco: 'destroi', act: "CW.grupoApagar('" + jsq(id) + "')" },
  ]) : '';
  openModal(g.name || 'Grupo partilhado', corpoDoGrupo(g),
    '<button class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>', m);
  CW._grupoJanela = { id: id, camada: modalTop() };
};

/* Repinta a janela do grupo, se está aberta, com o que a base tem agora —
   depois de uma ação e do estado que ela trouxe. Uma janela por baixo de
   outra (a da ligação acabada de criar) repinta-se na mesma; um grupo que
   deixou de existir fecha tudo.
   Recebe: id — o id do grupo.
   Devolve: nada — mexe no DOM da janela. */
function repintarGrupo(id) {
  var j = CW._grupoJanela;
  if (!j || j.id !== id || modalStack.indexOf(j.camada) < 0) return;
  var g = grupoPartilhado(id);
  if (!g) { closeAllModals(); return; }
  var b = j.camada.el.querySelector('.body');
  if (b) b.innerHTML = corpoDoGrupo(g);
  var t = j.camada.el.querySelector('.head h2');
  if (t) t.textContent = g.name || 'Grupo partilhado';
}

// O que se faz depois de cada ação num grupo: ler o estado, repintar o ecrã
// de baixo e a janela do grupo.
// Recebe: id — o id do grupo.
// Devolve: Promise que resolve quando tudo estiver repintado (nunca rejeita).
function aposAcaoNoGrupo(id) {
  return pullNow(true).then(function () { render(); repintarGrupo(id); });
}

/* ---------------- as ações do grupo ---------------- */

// «Mudar o nome…» (só o dono): pede o nome novo e envia PUT /api/shared-groups/:id {name}.
// Recebe: id — o id do grupo.
// Devolve: nada — abre o prompt; só ao guardar chama a API.
CW.grupoRenomear = function (id) {
  var g = grupoPartilhado(id);
  if (!g || !g._meu) return;
  promptModal('Mudar o nome', 'Nome do grupo', g.name, function (nome) {
    nome = nome.slice(0, 60);
    if (nome === g.name) return;
    api('PUT', '/api/shared-groups/' + encodeURIComponent(id), { name: nome })
      .then(function () { g.name = nome; toast('Grupo guardado.'); return aposAcaoNoGrupo(id); })
      .catch(function (e) { toast(e.message, { ms: 6000 }); });
  });
};

/* «Pôr os meus imóveis…»: a janela com as minhas casas (cwMinha) em caixas,
   as que já estão no grupo marcadas; guardar envia o conjunto inteiro
   (PUT …/houses {houseIds} substitui o que EU pus — os imóveis dos outros
   não se tocam por aqui).
   Recebe: id — o id do grupo.
   Devolve: nada — abre a janela e deixa a gravação em onSave. */
CW.grupoImoveis = function (id) {
  var g = grupoPartilhado(id);
  if (!g) return;
  var meus = imoveisMeus();
  if (!meus.length) return toast('Ainda não tens imóveis teus para pôr no grupo.');
  var body = '<div class="form">' +
    '<div class="hint">Os imóveis marcados ficam partilhados com todos os membros de <b>«' + esc(g.name) + '»</b> — passam a comproprietários: veem e editam contratos, movimentos e pessoas. Desmarcar tira-os do grupo.</div>' +
    '<div class="list u-g-7px">' + meus.map(function (p) {
      return '<label class="check"><input type="checkbox" id="cwg_h_' + p.id + '"' + ((g.ids || []).indexOf(p.id) > -1 ? ' checked' : '') + '>' +
        '<span class="u-minw-0"><b>' + esc(p.name || 'Sem nome') + '</b>' + (p.address ? ' <span class="small">' + esc(p.address) + '</span>' : '') + '</span></label>';
    }).join('') + '</div></div>';
  openModal('Pôr os meus imóveis', body);
  onSave = function () {
    var ids = casasMarcadas('cwg_h_');
    api('PUT', '/api/shared-groups/' + encodeURIComponent(id) + '/houses', { houseIds: ids })
      .then(function () {
        closeModal();
        toast(ids.length ? 'Imóveis no grupo atualizados.' : 'Os teus imóveis saíram do grupo.');
        return aposAcaoNoGrupo(id);
      })
      .catch(function (e) { toast(e.message, { ms: 6000 }); });
  };
};

// «Tirar» um imóvel do grupo (o dono do grupo ou o dono do imóvel):
// DELETE …/houses/:hid depois de confirmar.
// Recebe: id — o id do grupo; pid — o id do imóvel.
// Devolve: nada — pede confirmação, chama a API e repinta.
CW.grupoTirarImovel = function (id, pid) {
  var p = prop(pid), nome = (p && p.name) || 'Este imóvel';
  confirmModal('Tirar imóvel do grupo', '<b>' + esc(nome) + '</b> deixa de estar partilhado pelo grupo: os outros membros deixam de o ver por ele. Os registos ficam.', function () {
    api('DELETE', '/api/shared-groups/' + encodeURIComponent(id) + '/houses/' + encodeURIComponent(pid))
      .then(function () { toast('Imóvel tirado do grupo.'); return aposAcaoNoGrupo(id); })
      .catch(function (e) { toast(e.message, { ms: 6000 }); });
  });
};

// «Remover» um membro (só o dono): DELETE …/members/:uid depois de confirmar.
// Os imóveis que essa pessoa pôs saem com ela.
// Recebe: id — o id do grupo; uid — o id do utilizador.
// Devolve: nada — pede confirmação, chama a API e repinta.
CW.grupoRemoverMembro = function (id, uid) {
  var g = grupoPartilhado(id);
  var m = g && (g._membros || []).find(function (x) { return x.id === uid; });
  var nome = (m && m.name) || nomeUtilizador(uid);
  confirmModal('Remover do grupo', '<b>' + esc(nome) + '</b> deixa de ver os imóveis do grupo, e os que pôs saem com ele. O que registou fica.', function () {
    api('DELETE', '/api/shared-groups/' + encodeURIComponent(id) + '/members/' + encodeURIComponent(uid))
      .then(function () { toast('Membro removido.'); return aposAcaoNoGrupo(id); })
      .catch(function (e) { toast(e.message, { ms: 6000 }); });
  });
};

// «Sair do grupo» (quem não é dono): DELETE …/members/<eu> depois de confirmar.
// Os imóveis que pus saem comigo; o grupo sai já da base (desligarGrupoLocal);
// os movimentos já registados vivem em cada imóvel e não mexem.
// Recebe: id — o id do grupo.
// Devolve: nada — pede confirmação, chama a API, fecha as janelas e sincroniza.
CW.grupoSair = function (id) {
  var g = grupoPartilhado(id), nome = (g && g.name) || 'o grupo';
  confirmModal('Sair do grupo', 'Deixas de ver os imóveis de <b>«' + esc(nome) + '»</b>, e os que puseste saem contigo. Os movimentos já registados ficam em cada imóvel.', function () {
    api('DELETE', '/api/shared-groups/' + encodeURIComponent(id) + '/members/' + encodeURIComponent(meuId()))
      .then(function () {
        desligarGrupoLocal(id);
        closeAllModals();
        toast('Saíste do grupo «' + nome + '».');
        return pullNow(true);
      })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message, { ms: 6000 }); });
  });
};

/* «Apagar grupo» (só o dono): DELETE /api/shared-groups/:id depois de
   confirmar com o impacto. Os imóveis e os registos ficam com quem os criou,
   e os movimentos já registados ficam em cada imóvel (partiram-se ao
   guardar). Só um movimento antigo de grupo, que ainda não se partiu
   (app/movimento.js:migrarMovimentosDeGrupo não o pôde partir), aponta para
   o grupo — esse fica sem imóvel, e diz-se quantos.
   Recebe: id — o id do grupo.
   Devolve: nada — pede confirmação, chama a API, fecha as janelas e sincroniza. */
CW.grupoApagar = function (id) {
  var g = grupoPartilhado(id), nome = (g && g.name) || '';
  var antigos = (db.transactions || []).filter(function (t) { return t.groupId === id; }).length;
  confirmModal('Apagar grupo', 'O grupo <b>«' + esc(nome) + '»</b> desaparece para todos os membros: deixam de ver os imóveis uns dos outros por ele. Os imóveis e os registos ficam com quem os criou. Os movimentos já registados ficam em cada imóvel.' +
    (antigos ? ' ' + (antigos === 1 ? 'Um movimento antigo, ainda por dividir, fica' : antigos + ' movimentos antigos, ainda por dividir, ficam') + ' sem imóvel.' : ''), function () {
    api('DELETE', '/api/shared-groups/' + encodeURIComponent(id))
      .then(function () {
        desligarGrupoLocal(id);
        closeAllModals();
        toast('Grupo apagado.');
        return pullNow(true);
      })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message, { ms: 6000 }); });
  });
};

/* ---------------- a ligação do grupo ---------------- */

// O que a criação e a rotação da ligação têm em comum: POST …/link, guardar o
// URL no aparelho, mostrá-lo e repintar.
// Recebe: id — o id do grupo; msg — o toast a mostrar quando o servidor responder.
// Devolve: nada — abre a janela da ligação e sincroniza.
function ligacaoDoGrupoNova(id, msg) {
  var g = grupoPartilhado(id), nome = (g && g.name) || '';
  api('POST', '/api/shared-groups/' + encodeURIComponent(id) + '/link')
    .then(function (r) {
      guardarLigacaoDoGrupo(id, r.url || '');
      toast(msg);
      ligacaoModal('Ligação do grupo', r.url || '',
        'Vale 7 dias e serve para várias pessoas. Quem a abrir entra (ou cria conta) e pede para entrar no grupo <b>«' + esc(nome) +
        '»</b>; quando aceitares, passa a comproprietário dos imóveis dele. Podes rodá-la ou desativá-la quando quiseres.');
      return aposAcaoNoGrupo(id);
    })
    .catch(function (e) { toast(e.message, { ms: 6000 }); });
}

// «Criar ligação» (só o dono).
// Recebe: id — o id do grupo.
// Devolve: nada — mostra a ligação e sincroniza.
CW.grupoLigacaoCriar = function (id) { ligacaoDoGrupoNova(id, 'Ligação do grupo criada — copia-a e envia.'); };

// «Rodar»: a antiga deixa de funcionar e nasce outra; quem já entrou fica.
// Recebe: id — o id do grupo.
// Devolve: nada — pede confirmação; depois mostra a ligação nova e sincroniza.
CW.grupoLigacaoRodar = function (id) {
  confirmModal('Rodar a ligação', 'A ligação antiga deixa de funcionar e nasce uma nova, com mais 7 dias. Quem já entrou fica no grupo.', function () {
    ligacaoDoGrupoNova(id, 'Ligação nova — a antiga já não funciona.');
  });
};

// «Desativar» (DELETE …/link) depois de confirmar; quem já entrou fica.
// Recebe: id — o id do grupo.
// Devolve: nada — chama a API, esquece o URL guardado e repinta.
CW.grupoLigacaoDesativar = function (id) {
  confirmModal('Desativar a ligação', 'Quem a tiver deixa de conseguir pedir para entrar por ela. Quem já entrou fica no grupo, e podes criar outra quando quiseres.', function () {
    api('DELETE', '/api/shared-groups/' + encodeURIComponent(id) + '/link')
      .then(function () { guardarLigacaoDoGrupo(id, ''); toast('Ligação do grupo desativada.'); return aposAcaoNoGrupo(id); })
      .catch(function (e) { toast(e.message, { ms: 6000 }); });
  });
};

// «Copiar ligação»: a guardada neste aparelho. Criada noutro aparelho (ou
// antes de sair), o servidor não a volta a mostrar — diz-se como obter outra.
// Recebe: id — o id do grupo.
// Devolve: nada — copia e avisa.
CW.grupoLigacaoCopiar = function (id) {
  var url = ligacaoDoGrupoGuardada(id);
  if (!url) return toast('A ligação só se mostra quando é criada. Roda-a para teres uma nova neste aparelho.', { ms: 6000 });
  CW.copiar(url);
};

/* ---------------- criar e partilhar ---------------- */

/* «Novo grupo partilhado»: pede o nome, cria-o vazio (PUT /api/shared-groups/:id
   {name}, com um id daqui, como as casas) e abre a janela dele, para pôr
   imóveis e criar a ligação. O grupo entra já na base (grupoLocalPartilhado),
   e o estado a seguir confirma-o.
   Devolve: nada — abre o prompt; só ao guardar chama a API. */
CW.grupoNovo = function () {
  if (!CW.user) return CW.showAuth();
  if (!servicoLigado('colaboradores')) return toast(hintServicoDesligado('colaboradores'), { ms: 6000 });
  promptModal('Novo grupo partilhado', 'Nome do grupo', null, function (nome) {
    nome = nome.slice(0, 60);
    var id = uid();
    api('PUT', '/api/shared-groups/' + encodeURIComponent(id), { name: nome })
      .then(function () {
        grupoLocalPartilhado(id, nome, []);
        toast('Grupo criado — põe-lhe imóveis e cria a ligação.');
        return pullNow(true);
      })
      .then(function () { render(); CW.grupoModal(id); })
      .catch(function (e) { toast(e.message, { ms: 6000 }); });
  });
};

/* «Partilhar este grupo…», de um grupo de imóveis privado (Definições →
   Grupos): diz o que muda e, confirmado, cria o grupo no servidor com o
   MESMO id (PUT {name}), põe-lhe as casas do grupo que são minhas (PUT
   …/houses — só as que criei, cwMinha: as dos outros saem do grupo, e o
   toast diz quais), cria a ligação (POST …/link), marca o grupo local
   (grupoLocalPartilhado — o id fica, os movimentos com groupId continuam a
   apontar para ele, e o u:group antigo sai por diferença) e mostra a ligação.
   Recebe: id — o id do grupo privado.
   Devolve: nada — pede confirmação; só depois fala com a API. */
CW.grupoPartilhar = function (id) {
  var g = grp(id);
  if (!g || g.kind !== 'prop') return;
  if (g._partilhado) return CW.grupoModal(id);
  if (!CW.user) return CW.showAuth();
  if (!servicoLigado('colaboradores')) return toast(hintServicoDesligado('colaboradores'), { ms: 6000 });
  var minhas = (g.ids || []).filter(function (pid) { return cwMinha(prop(pid)); });
  var fora = (g.ids || []).filter(function (pid) { return minhas.indexOf(pid) < 0; });
  var nomesFora = nomesDeCasas(fora), nome = String(g.name || '').slice(0, 60);
  confirmModal('Partilhar este grupo',
    'O grupo <b>«' + esc(nome) + '»</b> passa a partilhado: quem pedir para entrar pela ligação, e tu aceitares, fica comproprietário dos imóveis dele — vê e edita contratos, movimentos e pessoas — e pode pôr no grupo imóveis seus. ' +
    (fora.length ? 'Só os imóveis teus entram: <b>' + esc(nomesFora) + '</b> ' + (fora.length === 1 ? 'sai' : 'saem') + ' do grupo. ' : '') +
    'Um grupo partilhado não volta a ser privado.',
    function () {
      var rota = '/api/shared-groups/' + encodeURIComponent(id);
      api('PUT', rota, { name: nome })
        .then(function () { return api('PUT', rota + '/houses', { houseIds: minhas }); })
        .then(function () { return api('POST', rota + '/link'); })
        .then(function (r) {
          var url = r.url || '';
          grupoLocalPartilhado(id, nome, minhas, r.expiresAt);
          guardarLigacaoDoGrupo(id, url);
          closeAllModals();   // a janela do grupo privado, se ainda estava aberta: o Guardar dela escrevia por cima das marcas
          toast(fora.length
            ? 'Grupo partilhado. ' + nomesFora + (fora.length === 1 ? ' ficou de fora — não é teu.' : ' ficaram de fora — não são teus.')
            : 'Grupo partilhado — copia a ligação e envia-a.', { ms: 6000 });
          ligacaoModal('Ligação do grupo', url,
            'Vale 7 dias e serve para várias pessoas. Quem a abrir entra (ou cria conta) e pede para entrar no grupo <b>«' + esc(nome) +
            '»</b>; quando aceitares, passa a comproprietário dos imóveis dele. Podes rodá-la ou desativá-la quando quiseres, na janela do grupo.');
          return pullNow(true);
        })
        .then(function () { render(); })
        .catch(function (e) { toast(e.message, { ms: 6000 }); });
    });
};

/* ---------------- aterragem: entrar num grupo ---------------- */

/* O modal do desfecho de «Pedir para entrar». Com pedido (o caso de quem
   ainda não está no grupo), «Pedido enviado»: <dono> tem de aceitar, os
   imóveis aparecem quando aceitar, e onde se vê e cancela o pedido — com
   «Fechar»; nada de «Agora estás no grupo», que ainda não está. Sem pedido
   (jaEstava: eu já era membro), «Já estás no grupo …» com os imóveis e «Ver
   os imóveis».
   Recebe: r — a resposta do servidor ({name, ownerName, houses, jaEstava,
   pedido, jaPedido}); prev — a pré-visualização guardada ({name, ownerName,
   houses}), para o que a resposta não trouxer.
   Devolve: nada — abre o modal. */
function desfechoDoGrupo(r, prev) {
  var nome = r.name || prev.name || '', dono = r.ownerName || prev.ownerName || '';
  if (r.pedido) {
    openModal('Pedido enviado',
      '<div class="form"><div class="hint u-fs-14px">' + (r.jaPedido ? 'Já tinhas pedido' : 'Pediste') + ' para entrar no grupo <b>«' + esc(nome) + '»</b>. ' +
      '<b>' + esc(dono || 'O dono do grupo') + '</b> tem de aceitar: quando aceitar, os imóveis do grupo aparecem-te e passas a comproprietário deles.</div>' +
      '<div class="hint">Vês o pedido, e podes cancelá-lo, em Definições → Conta e partilha, no cartão «Grupos partilhados».</div></div>',
      '<button class="btn primary" data-toca="camada" data-click="closeModal()">Fechar</button>');
    return;
  }
  var casas = nomesDeCasas(r.houses || prev.houses || []);
  openModal((r.jaEstava ? 'Já estás' : 'Agora estás') + ' no grupo «' + nome + '»',
    '<div class="form"><div class="hint u-fs-14px">Grupo de <b>' + esc(dono) + '</b>. ' +
    (casas ? 'És comproprietário de <b>' + esc(casas) + '</b>: vês e editas contratos, movimentos e pessoas.'
      : 'O grupo ainda não tem imóveis — os que os membros puserem passam a ser partilhados contigo.') + '</div>' +
    '<div class="hint">Podes pôr no grupo imóveis teus e sair quando quiseres, em Definições → Grupos.</div></div>',
    '<button class="btn primary" data-toca="ecra" data-click="closeAllModals();go(\'properties\')">Ver os imóveis</button>');
}

/* «Pedir para entrar» (POST /api/grupo/:token/entrar) — só aqui se usa a
   ligação. Entrar num grupo é um pedido que o dono aceita: a resposta diz
   se ficou pedido (pedido; jaPedido quando já havia um) ou se eu já era
   membro (jaEstava). Nos dois casos esquece o token guardado (entrada.js),
   fecha as janelas, sincroniza (o pedido que fiz passa a estar no cartão
   «Grupos partilhados») e mostra o desfecho (desfechoDoGrupo). Um 404 (a
   ligação não serve) ou um 400 (o grupo é meu) esquecem o token e fecham,
   para não voltar a perguntar; um erro passageiro — ou o 429 de um grupo
   com pedidos de mais por responder — deixa tudo como está, para se tentar
   outra vez.
   Recebe: token — o token da ligação (64 hex).
   Devolve: nada — o desfecho aparece num modal ou num toast. */
CW.entrarNoGrupo = function (token) {
  if (!CW.user) return CW.showAuth();
  // chega-se aqui por uma ligação, não por um botão que se esconde: com o
  // serviço desligado nesta conta, diz-se e não se entra
  if (!servicoLigado('colaboradores')) return toast(hintServicoDesligado('colaboradores'), { ms: 6000 });
  var prev = CW._grupoPrev || {};
  var esquecer = function () {
    try { sessionStorage.removeItem('gi_grupo'); } catch (e) {}
    CW._grupoPrev = null;
  };
  api('POST', '/api/grupo/' + encodeURIComponent(token) + '/entrar')
    .then(function (r) {
      esquecer();
      closeAllModals();
      return pullNow(true).then(function () { render(); return r; });
    })
    .then(function (r) { desfechoDoGrupo(r || {}, prev); })
    .catch(function (e) {
      if (e && (e.status === 404 || e.status === 400)) { esquecer(); closeAllModals(); }
      toast(e.message || 'Não deu para pedir para entrar no grupo.', { ms: 6000 });
    });
};

/* ---------------- o cartão «Grupos partilhados» ---------------- */

/* O cartão «Grupos partilhados» da página Conta e partilha (partilha.js:
   vCloud, a seguir aos utilizadores ligados): uma linha por grupo — nome ·
   N imóveis · N pessoas · «teu» ou «de <dono>», e nos meus quantos pedidos
   esperam resposta — a abrir a janela dele; depois, os pedidos que fiz para
   entrar e ainda esperam («<grupo> · à espera de <dono>», com «Cancelar
   pedido»); o botão «Novo grupo partilhado» e a nota do que é. Só com
   sessão e com o serviço Colaboradores ligado nesta conta.
   Devolve: o HTML do cartão (texto), ou '' sem sessão ou com o serviço desligado. */
function gruposCard() {
  if (!CW.user || !servicoLigado('colaboradores')) return '';
  var gs = gruposPartilhados();
  var fiz = (((CW.state && CW.state.sharedGroupRequests) || {}).outgoing || []).filter(function (p) { return p && p.groupId; });
  var linhas = gs.map(function (g) {
    var n = (g.ids || []).length, m = (g._membros || []).length, pend = pedidosParaEntrar(g.id).length;
    return '<div class="card tap u-p-11px-13px u-d-flex u-ai-center u-g-10px" data-toca="camada" data-click="CW.grupoModal(\'' + jsq(g.id) + '\')">' +
      '<span class="avatar">' + ic('users', 17) + '</span>' +
      '<span class="u-fx-1 u-minw-0"><b class="u-d-block">' + esc(g.name || 'Sem nome') + '</b>' +
      '<span class="small">' + n + (n === 1 ? ' imóvel' : ' imóveis') + ' · ' + m + (m === 1 ? ' pessoa' : ' pessoas') +
      ' · ' + (g._meu ? 'teu' : 'de ' + esc(g._donoNome || '')) +
      (pend ? ' · <b>' + pend + (pend === 1 ? ' pedido' : ' pedidos') + ' por responder</b>' : '') + '</span></span>' +
      '<span class="u-c-v-muted u-tf-rotate-180deg u-fx-0-0-auto">' + ic('chev', 17) + '</span></div>';
  }).concat(fiz.map(function (p) {
    var dono = p.ownerName ? esc(p.ownerName) : '';
    return '<div class="card u-p-12px-13px"><b class="u-d-block">' + esc(p.groupName || 'Grupo') + ' · à espera de ' + (dono || 'resposta') + '</b>' +
      '<span class="small">Pediste para entrar. Os imóveis do grupo aparecem quando ' + (dono || 'o dono') + ' aceitar.</span>' +
      '<div class="toolbar u-mt-9px"><button class="btn sm" data-toca="dados" data-click="CW.grupoCancelarPedido(\'' + jsq(p.groupId) + '\')">Cancelar pedido</button></div></div>';
  }));
  var lista = linhas.length
    ? '<div class="list u-g-8px">' + linhas.join('') + '</div>'
    : '<div class="hint">Ainda não estás em nenhum grupo partilhado. Cria um aqui, ou partilha um grupo de imóveis que já tenhas, em Definições → Grupos.</div>';
  return card('Grupos partilhados', 'Imóveis em conjunto, com quem entrar',
    lista +
    '<div class="toolbar u-mt-11px"><button class="btn" data-toca="camada" data-click="CW.grupoNovo()">' + ic('plus', 15) + ' Novo grupo partilhado</button></div>' +
    '<div class="hint u-mt-11px">Quem está num grupo é comproprietário de todos os imóveis dele. Cada membro põe no grupo imóveis seus; o dono do grupo cria a ligação por onde os outros pedem para entrar, e aceita ou recusa cada pedido.</div>');
}
