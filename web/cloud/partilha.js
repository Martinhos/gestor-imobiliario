/* Paginas Conta e partilha (id, ligacoes, seguranca e apagar a conta) e as
   acoes delas, e Colaboradores (cargos, convites e quem colabora em cada
   imovel; as acoes destes vivem em colaboradores.js). */
'use strict';

/* ---------------- página "Conta e partilha" ---------------- */

var _vSettings = vSettings;
vSettings = function () {
  if (setPage === 'cloud') return backRow + vCloud();
  if (setPage === 'legal') return backRow + vLegal();
  if (setPage === 'ajuda') return backRow + vAjuda();
  if (setPage === 'faq') return backRow + vFaq();
  if (setPage === 'termos') return backRow + vDoc(L.termos);
  if (setPage === 'privacidade') return backRow + vDoc(L.privacidade);
  return _vSettings();
};

/* O cartão do perfil, no topo da raiz das Definições: o nome, e se o NIF já
   está preenchido — é o que os contratos levam do senhorio.
   Devolve: o HTML do cartão (texto). */
function cartaoDoPerfil() {
  var meP = CW.user && (db.owners || []).find(function (o) { return o.id === CW.user.id; });
  var psub = meP && meP.nif ? esc(meP.name) + ' · NIF preenchido' : 'Nome, NIF e contactos para os contratos';
  return '<div class="card tap u-d-flex u-ai-center u-g-13px" data-toca="camada" data-click="CW.editProfile()">' +
    '<span class="avatar">' + ic('crown', 18) + '</span>' +
    '<span class="u-fx-1 u-minw-0"><b class="u-d-block">O meu perfil</b><span class="small">' + psub + '</span></span>' +
    '<span class="u-c-v-muted u-tf-rotate-180deg">' + ic('chev', 18) + '</span></div>';
}

/* O cartão da app no telemóvel, no fim da raiz das Definições: no iPhone,
   como se instala pelo Safari (não aparece aviso nenhum sozinho); fora da
   app Android, o APK. Dentro dela não há nada a dizer. Fora de produção
   (CW.ambiente, que vem do servidor em guia.js) o APK que se descarrega é o
   de desenvolvimento — «Rendorium DEV», com outro applicationId —, e
   instala-se ao lado do de produção sem o substituir; diz-se.
   Devolve: o HTML do cartão (texto), ou '' dentro da app Android. */
function cartaoDaAppNoTelemovel() {
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  var standalone = false;
  var emDev = !!(window.CW && CW.ambiente && CW.ambiente !== 'producao');
  var notaDev = emDev
    ? '<div class="hint u-mt-9px"><b>Ambiente de desenvolvimento:</b> este APK é o <b>Rendorium DEV</b>. Instala-se ao lado da app de produção, sem a substituir, e liga-se a este ambiente.</div>'
    : '';
  try { standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; } catch (e) {}
  if (isIOS) {
    return card('App no iPhone', 'Adicionar ao ecrã principal', standalone
        ? '<div class="hint">Já estás a usar a app instalada no ecrã principal. 👍</div>'
        : '<div class="hint">No iPhone a instalação faz-se pelo Safari (não aparece nenhum aviso automático):</div>' +
          '<div class="list u-g-7px u-mt-9px">' +
          '<div class="small"><b>1.</b> Abre este site no <b>Safari</b> — se estiveres dentro de outra app (WhatsApp, Gmail, Instagram…), toca no ícone do browser para abrir no Safari a sério.</div>' +
          '<div class="small"><b>2.</b> Toca no botão <b>Partilhar</b> (quadrado com seta para cima, na barra de baixo).</div>' +
          '<div class="small"><b>3.</b> Desliza e escolhe <b>“Adicionar ao ecrã principal”</b> e confirma.</div></div>' +
          '<div class="hint u-mt-9px">No Chrome do iPhone: menu <b>⋯</b> → “Adicionar ao ecrã inicial”. A opção não existe em janelas privadas.</div>');
  }
  if (!window.Android) {
    return card('App para Android', 'A mesma app no telemóvel',
        '<div class="hint">Instala a app nativa: é o mesmo gestor, com notificações dos movimentos por confirmar e o seletor de ficheiros do Android (Google Drive incluído). Ao abrir o APK, o Android pede para autorizares a instalação de apps fora da Play Store — é normal.</div>' +
        notaDev +
        '<div class="hint u-mt-9px">Se já tinhas a app instalada de antes de setembro de 2026, <b>desinstala-a primeiro</b>: a chave de assinatura mudou e o Android recusa a instalação por cima. Antes de desinstalar, entra com a tua conta para os dados ficarem na nuvem, ou guarda uma cópia em <b>Definições → Importar e cópias</b>.</div>' +
        '<div class="toolbar u-mt-11px"><a class="btn primary u-td-none" href="/gestor-imobiliario.apk" download data-toca="nada">' + ic('down', 16) + ' Descarregar APK</a></div>');
  }
  return '';
}

/* As linhas da nuvem na raiz das Definições, que é uma só e da base
   (definicoes.js:linhaDefinicoes): o perfil e a conta, a ajuda, as perguntas
   frequentes, o aviso legal e a app no telemóvel. A nuvem escrevia a raiz
   inteira por cima da da base, e a dela tinha esquecido «IRS e dedução» e
   «Filtros comuns». */
linhaDefinicoes({ sec: 'conta', ordem: 10, html: cartaoDoPerfil });
linhaDefinicoes({ sec: 'conta', ordem: 20, page: 'cloud', label: 'Conta e partilha', icon: 'users',
  sub: function () { return CW.user ? (CW.user.name || CW.user.email) + ' · id ' + CW.user.id : 'Inicia sessão'; } });
linhaDefinicoes({ sec: 'ajuda', ordem: 10, page: 'ajuda', label: 'Ajuda e sugestões', icon: 'info', sub: 'Contar um problema ou pedir uma melhoria' });
linhaDefinicoes({ sec: 'sobre', ordem: 10, page: 'faq', label: 'Perguntas frequentes', icon: 'info', sub: 'As dúvidas mais comuns, respondidas' });
linhaDefinicoes({ sec: 'sobre', ordem: 30, page: 'legal', label: 'Aviso legal', icon: 'contract', sub: 'Termos e privacidade' });
linhaDefinicoes({ sec: 'sobre', ordem: 60, html: cartaoDaAppNoTelemovel });

// o que aceitar um convite de ligação dá — no cartão da ligação e no aviso da vista geral
var CONVITE_SE_ACEITARES = 'Se aceitares, cada um pode escolher que casas partilha com o outro.';

/* Os botões de um convite de ligação recebido: aceitar e recusar. Servem o
   cartão da ligação (connCard) e o aviso da vista geral (pedidosDashCard).
   Recebe: c — a ligação, com id.
   Devolve: o HTML dos dois botões (texto). */
function botoesConvite(c) {
  return '<button class="btn primary sm" data-toca="dados" data-click="CW.acceptConn(\'' + jsq(c.id) + '\')">Aceitar</button>' +
    '<button class="btn sm danger" data-toca="dados" data-click="CW.delConn(\'' + jsq(c.id) + '\',1)">Recusar</button>';
}

/* O cartão de uma ligação a outro utilizador, com os botões certos para o
   estado dela: convite recebido (aceitar/recusar), convite enviado (cancelar)
   ou ligação ativa, com a contagem de casas partilhadas em cada sentido.
   Recebe: c — a ligação, com id, status ('pending' ou ativa), incoming,
   peer {id, name, email} e as listas myShares/peerShares.
   Devolve: string de HTML do cartão, pronta a inserir com innerHTML. */
function connCard(c) {
  var peer = esc(c.peer.name || c.peer.email || c.peer.id);
  var lines = '';
  var btns = '';
  if (c.status === 'pending' && c.incoming) {
    lines = '<div class="small">Quer ligar-se a ti. ' + CONVITE_SE_ACEITARES + '</div>';
    btns = botoesConvite(c);
  } else if (c.status === 'pending') {
    lines = '<div class="small">À espera que aceite o convite.</div>';
    btns = '<button class="btn sm danger" data-toca="dados" data-click="CW.delConn(\'' + c.id + '\',1)">Cancelar</button>';
  } else {
    var mine = (c.myShares || []).length, theirs = (c.peerShares || []).length;
    lines = '<div class="small">Partilhas <b>' + mine + '</b> casa' + (mine === 1 ? '' : 's') +
      ' · recebe' + 's' + ' <b>' + theirs + '</b> casa' + (theirs === 1 ? '' : 's') + ' de ' + peer + '</div>';
    btns = '<button class="btn primary sm" data-toca="camada" data-click="CW.sharesModal(\'' + c.id + '\')">Escolher casas</button>' +
      '<button class="btn sm danger" data-toca="dados" data-risco="destroi" data-click="CW.delConn(\'' + c.id + '\')">Remover</button>';
  }
  // os botões ficam numa linha própria: encostados ao texto, tapavam-no em ecrãs estreitos
  return '<div class="card u-p-13px-14px">' +
    '<div class="u-minw-0"><div class="title">' + peer + '</div>' +
    '<div class="small">id ' + esc(c.peer.id) + '</div></div>' +
    lines +
    '<div class="toolbar u-mt-10px">' + btns + '</div></div>';
}

/* ---------------- colaboradores, cargos e a ligação de partilha ---------------- */

// Os imóveis que criei eu — onde gero convites e colaboradores.
// Devolve: array de imóveis de db.properties.
function cwImoveisMeus() {
  return (db.properties || []).filter(function (p) { return cwMinha(p); });
}

/* O cartão «A minha ligação de partilha»: sem ligação, o botão de a criar;
   com ela, copiar, rodar e desativar, e quantos pedidos chegaram por ali. O
   URL só se vê na criação — o «Copiar» lê o que ficou no aparelho.
   Devolve: o HTML do cartão (texto). */
function ligacaoCard() {
  if (!servicoLigado('colaboradores')) return '';   // a ligação de partilha é do serviço Colaboradores
  var sl = CW.state.shareLink;
  var ativa = !!(sl && (sl.ativo || sl.url));
  var usos = Number(sl && sl.uses) || 0;
  var corpo = ativa
    ? '<div class="stat"><span>Estado</span><b>Ativa</b></div>' +
      '<div class="stat u-b-0"><span>Pedidos chegados por aqui</span><b>' + usos + '</b></div>' +
      '<div class="toolbar u-mt-11px">' +
      '<button class="btn primary" data-toca="nada" data-click="CW.ligacaoCopiar()">Copiar ligação</button>' +
      '<button class="btn" data-toca="dados" data-click="CW.ligacaoRodar()">Rodar</button>' +
      '<button class="btn danger" data-toca="dados" data-click="CW.ligacaoDesativar()">Desativar</button></div>'
    : '<div class="toolbar"><button class="btn primary" data-toca="dados" data-click="CW.ligacaoCriar()">' + ic('key', 15) + ' Criar ligação</button></div>';
  return card('A minha ligação de partilha', 'Uma ligação tua, em vez do id',
    corpo +
    '<div class="hint u-mt-11px">Quem a abrir escolhe que imóveis partilha contigo; tu aceitas ou recusas cada pedido. ' +
    'Não tem prazo: podes rodá-la ou desativá-la quando quiseres.</div>');
}

/* A linha de um pedido de partilha recebido: quem quer partilhar o quê, o que
   aceitar implica, e os botões de aceitar e recusar. Serve o cartão dos
   pedidos (pedidosCard) e o aviso da vista geral (pedidosDashCard).
   Recebe: p — o pedido, com id, fromName e houseName.
   Devolve: o HTML da linha (texto). */
function pedidoRecebidoHtml(p) {
  return '<div class="card u-p-12px-13px"><b class="u-d-block">' + esc(p.fromName || '') + ' quer partilhar ' + esc(p.houseName || 'um imóvel') + ' contigo</b>' +
    '<span class="small">Se aceitares, passas a comproprietário desse imóvel — vês contratos, movimentos e pessoas.</span>' +
    '<div class="toolbar u-mt-9px"><button class="btn primary sm" data-toca="dados" data-click="CW.pedidoAceitar(\'' + jsq(p.id) + '\')">Aceitar</button>' +
    '<button class="btn sm danger" data-toca="dados" data-click="CW.pedidoRecusar(\'' + jsq(p.id) + '\')">Recusar</button></div></div>';
}

/* A linha de um pedido para entrar num grupo partilhado meu: quem quer
   entrar em que grupo, o que aceitar implica, e os botões de aceitar e
   recusar (cloud/grupos.js: CW.grupoAceitarPedido / CW.grupoRecusarPedido —
   ações declaradas, que só correm com o ficheiro do serviço carregado). Só
   chegam pedidos dos grupos de que sou dono: o servidor não os manda a mais
   ninguém.
   Recebe: p — o pedido, com groupId, groupName, userId e name.
   Devolve: o HTML da linha (texto). */
function pedidoDeGrupoHtml(p) {
  var gid = jsq(p.groupId), uid = jsq(p.userId);
  return '<div class="card u-p-12px-13px"><b class="u-d-block">' + esc(p.name || 'Alguém') + ' quer entrar no grupo «' + esc(p.groupName || 'sem nome') + '»</b>' +
    '<span class="small">Se aceitares, passa a comproprietário dos imóveis do grupo.</span>' +
    '<div class="toolbar u-mt-9px"><button class="btn primary sm" data-toca="dados" data-click="CW.grupoAceitarPedido(\'' + gid + '\',\'' + uid + '\')">Aceitar</button>' +
    '<button class="btn sm danger" data-toca="dados" data-click="CW.grupoRecusarPedido(\'' + gid + '\',\'' + uid + '\')">Recusar</button></div></div>';
}

/* O cartão «Pedidos por responder», para o topo da vista geral: os pedidos de
   partilha recebidos e os pedidos para entrar num grupo meu (os dois do
   serviço Colaboradores) e os convites de ligação recebidos (da partilha
   entre contas, sempre), cada um com aceitar e recusar. Os que enviei ficam
   de fora — não são para responder. Quem recebe é muitas vezes uma conta
   nova, sem imóveis: sem isto só via o vazio.
   Devolve: o HTML do cartão com o espaço até ao cartão seguinte (texto), ou
   '' sem nada por responder. */
function pedidosDashCard() {
  var st = CW.state || {};
  var colab = servicoLigado('colaboradores');
  var inc = colab ? ((st.shareRequests || {}).incoming || []) : [];
  /* o servidor só manda os pedidos dos grupos de que sou dono; um grupo que
     está na base e não é meu (um estado trocado, uma resposta estranha) não
     ganha botões de aceitar a quem não o pode fazer */
  var grupos = !colab ? [] : ((st.sharedGroupRequests || {}).incoming || []).filter(function (p) {
    var g = p && grp(p.groupId);
    return p && p.groupId && p.userId && !(g && g._partilhado && !g._meu);
  });
  var convites = (st.connections || []).filter(function (c) { return c.status === 'pending' && c.incoming; });
  var n = inc.length + grupos.length + convites.length;
  if (!n) return '';
  var linhas = inc.map(pedidoRecebidoHtml).concat(grupos.map(pedidoDeGrupoHtml), convites.map(function (c) {
    return '<div class="card u-p-12px-13px"><b class="u-d-block">' + esc(c.peer.name || c.peer.email || c.peer.id) + ' quer ligar-se a ti</b>' +
      '<span class="small">' + CONVITE_SE_ACEITARES + '</span>' +
      '<div class="toolbar u-mt-9px">' + botoesConvite(c) + '</div></div>';
  })).join('');
  /* a marca no fim é para o guia: os «Primeiros passos» entram DEPOIS dos
     pedidos (cloud/guia.js), que são a coisa mais urgente da vista geral */
  return card('Pedidos por responder', n + ' por responder', '<div class="list u-g-9px">' + linhas + '</div>') +
    '<div class="u-h-14px"></div><!--fim-pedidos-->';
}

// O cartão «Pedidos de partilha»: os recebidos, com aceitar e recusar, e os
// que enviei e ainda esperam. Vazio quando não há nenhum.
// Devolve: o HTML do cartão (texto), ou '' sem pedidos.
function pedidosCard() {
  if (!servicoLigado('colaboradores')) return '';   // os pedidos chegam pela ligação: do serviço Colaboradores
  var sr = CW.state.shareRequests || {};
  var inc = sr.incoming || [], out = sr.outgoing || [];
  if (!inc.length && !out.length) return '';
  var linhas = inc.map(pedidoRecebidoHtml).concat(out.map(function (p) {
    return '<div class="card u-p-12px-13px"><b class="u-d-block">' + esc(p.houseName || 'Imóvel') + ' · à espera de ' + esc(p.toName || '') + '</b>' +
      '<span class="small">Pediste que passasse a comproprietário. Fica pendente até responder.</span>' +
      '<div class="toolbar u-mt-9px"><button class="btn sm" data-toca="dados" data-click="CW.pedidoCancelar(\'' + jsq(p.id) + '\')">Cancelar pedido</button></div></div>';
  })).join('');
  return card('Pedidos de partilha', inc.length ? inc.length + ' por responder' : 'À espera de resposta',
    '<div class="list u-g-9px">' + linhas + '</div>');
}

// O cartão «Cargos»: um por linha com o resumo do que abre e o menu de
// editar/apagar, e o botão de criar. Sem cargos, a dica de por onde começar.
// Devolve: o HTML do cartão (texto).
function cargosCard() {
  if (!servicoLigado('colaboradores')) return '';
  var roles = CW.state.roles || [];
  var lista = roles.length
    ? '<div class="list u-g-8px">' + roles.map(function (r) {
        var n = Number(r.n) || 0;
        return '<div class="card u-p-11px-13px u-d-flex u-ai-center u-g-10px">' +
          '<span class="u-fx-1 u-minw-0"><b class="u-d-block">' + esc(r.name) + '</b>' +
          '<span class="small">' + esc(resumoPerms(r.perms)) + (n ? ' · ' + n + (n === 1 ? ' pessoa' : ' pessoas') : '') + '</span></span>' +
          menu('cargo_' + r.id, [
            { label: 'Editar cargo', icon: 'dots', act: "CW.cargoModal('" + jsq(r.id) + "')" },
            { label: 'Apagar cargo', icon: 'trash', danger: true, act: "CW.apagarCargo('" + jsq(r.id) + "')" },
          ]) + '</div>';
      }).join('') + '</div>'
    : '<div class="hint">Cria um cargo para dizeres o que um colaborador pode ver e adicionar — ou começa por um dos três prontos: Gestor de visitas, Contabilista, Ver tudo.</div>';
  return card('Cargos', 'O que cada colaborador pode fazer',
    lista + '<div class="toolbar u-mt-11px"><button class="btn" data-toca="camada" data-click="CW.cargoModal()">' + ic('plus', 15) + ' Novo cargo</button></div>');
}

/* O cartão «Convidar colaborador»: o cargo, as caixas dos meus imóveis (com o
   atalho «Escolher pelo grupo…») e o botão que cria a ligação de uso único.
   Por baixo, os convites por usar, cada um com «Revogar».
   Devolve: o HTML do cartão (texto). */
function convidarCard() {
  if (!servicoLigado('colaboradores')) return '';
  var roles = CW.state.roles || [];
  var meus = cwImoveisMeus();
  var invites = CW.state.invites || [];
  var form;
  if (!roles.length) form = '<div class="hint">Cria primeiro um cargo, no cartão «Cargos» em baixo.</div>' + saida('Novo cargo', 'CW.cargoModal()', 'camada');
  else if (!meus.length) {
    // o formulário do imóvel é do serviço dos Imóveis: desligado, a nota diz quem o liga
    form = '<div class="hint">Ainda não tens imóveis para partilhar — cria um primeiro.</div>' +
      (servicoLigado('properties') ? saida('Adicionar imóvel', 'propModal()', 'camada') : vazioServicoDesligado('properties'));
  } else {
    var grupos = typeof gOpts === 'function' ? gOpts('prop') : [];
    form = '<div class="form">' +
      '<label>Cargo <span class="req">*</span>' + sel('cw_inv_cargo', roles[0].id, roles.map(function (r) { return { v: r.id, label: r.name }; }), '', 'rascunho') + '</label>' +
      '<div><div class="flabel">Imóveis <span class="req">*</span></div><div class="list u-g-7px">' + meus.map(function (p) {
        return '<label class="check"><input type="checkbox" id="cw_inv_h_' + p.id + '"><span class="u-minw-0"><b>' + esc(p.name || 'Sem nome') + '</b>' +
          (p.address ? ' <span class="small">' + esc(p.address) + '</span>' : '') + '</span></label>';
      }).join('') + '</div>' +
      (grupos.length
        ? '<div class="u-mt-9px">' + sel('cw_inv_grupo', '', [{ v: '', label: 'Escolher pelo grupo…' }].concat(grupos), 'cwInvGrupo', 'rascunho') +
          '<div class="hint u-mt-6px">Imóveis que juntares ao grupo depois não entram — edita o colaborador.</div></div>'
        : '') + '</div>' +
      '<label>Nota para ti (opcional)<input id="cw_inv_label" maxlength="60" placeholder="Ex: Para a Ana, contabilidade" autocomplete="off"></label>' +
      '<div class="toolbar"><button class="btn primary" data-toca="dados" data-click="CW.criarConvite()">' + ic('key', 15) + ' Criar ligação de convite</button></div>' +
      '<div class="hint">Vale 7 dias e uma só utilização. Quem a abrir entra (ou cria conta) e fica com o cargo nesses imóveis — sem quota-parte.</div></div>';
  }
  var pendentes = invites.length
    ? '<div class="section-title">Convites por usar</div><div class="list u-g-8px">' + invites.map(function (i) {
        var casas = (i.houses || []).map(function (h) { return h.name || 'Sem nome'; }).join(', ');
        var expira = i.expiresAt ? new Date(Number(i.expiresAt)).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : '';
        return '<div class="card u-p-11px-13px u-d-flex u-ai-center u-g-10px">' +
          '<span class="u-fx-1 u-minw-0"><b class="u-d-block">' + esc(i.roleName || 'Cargo') + (i.label ? ' · ' + esc(i.label) : '') + '</b>' +
          '<span class="small">' + esc(casas) + (expira ? ' · expira a ' + esc(expira) : '') + '</span></span>' +
          '<button class="btn sm danger u-fx-0-0-auto" data-toca="dados" data-click="CW.revogarConvite(\'' + jsq(i.id) + '\')">Revogar</button></div>';
      }).join('') + '</div>'
    : '';
  return card('Convidar colaborador', 'Uma ligação de uso único, com um cargo', form + pendentes);
}

/* O cartão «Colaboradores»: por imóvel meu, quem colabora, com o cargo e os
   botões de mudar e remover. Só quem criou o imóvel gere colaboradores —
   nos imóveis em compropriedade fica a dica. Sem imóvel nenhum (nem meu nem
   partilhado comigo) não há cartão: o vazio dele mandava «criar uma ligação
   de convite em cima», e sem imóveis não há convite que se possa criar — o
   cartão de cima já diz que o primeiro passo é o imóvel.
   Devolve: o HTML do cartão (texto), ou '' sem imóveis. */
function colaboradoresCard() {
  if (!servicoLigado('colaboradores')) return '';
  var meus = cwImoveisMeus().filter(function (p) { return (p._colaboradores || []).length; });
  var partilhados = (db.properties || []).filter(function (p) { return p._sharedFrom && !p._cargo; });
  if (!cwImoveisMeus().length && !partilhados.length) return '';
  var corpo = meus.length
    ? meus.map(function (p) {
        return '<div class="section-title u-mt-14px">' + esc(p.name || 'Sem nome') + '</div><div class="list u-g-8px">' +
          p._colaboradores.map(function (c) {
            return '<div class="card u-p-11px-13px">' +
              '<div class="u-d-flex u-ai-center u-g-11px"><span class="avatar u-w-32px u-h-32px u-fx-0-0-32px u-fs-12px">' +
              esc(typeof initials === 'function' ? initials(c.name) : (c.name || '?').slice(0, 2)) + '</span>' +
              '<span class="u-fx-1 u-minw-0"><b class="u-d-block">' + esc(c.name || c.userId || '') + '</b>' +
              '<span class="badge grey">' + esc(c.roleName || 'Colaborador') + '</span></span></div>' +
              '<div class="toolbar u-mt-9px"><button class="btn sm" data-toca="camada" data-click="CW.mudarColaborador(\'' + jsq(c.id) + '\')">Mudar cargo ou imóveis</button>' +
              '<button class="btn sm danger" data-toca="dados" data-risco="destroi" data-click="CW.removerColaborador(\'' + jsq(c.id) + '\')">Remover</button></div></div>';
          }).join('') + '</div>';
      }).join('')
    : '<div class="hint">Ainda não tens colaboradores. Cria uma ligação de convite em cima.</div>';
  var nota = partilhados.length
    ? '<div class="hint u-mt-11px">Nos imóveis que outros partilharam contigo, só quem criou o imóvel gere colaboradores.</div>'
    : '';
  return card('Colaboradores', 'Quem colabora em cada imóvel', corpo + nota);
}

// O cartão «Imóveis onde colaboras»: um por imóvel com o dono, o cargo e o
// «Sair» (por linha de colaboração). Vazio quando não colaboro em nenhum.
// Devolve: o HTML do cartão (texto), ou '' sem imóveis de colaboração.
function colaboroCard() {
  if (!servicoLigado('colaboradores')) return '';
  var casas = (db.properties || []).filter(function (p) { return p._cargo; });
  if (!casas.length) return '';
  var linhas = casas.map(function (p) {
    return '<div class="card u-p-11px-13px u-d-flex u-ai-center u-g-10px">' +
      '<span class="u-fx-1 u-minw-0"><b class="u-d-block">' + esc(p.name || 'Sem nome') + '</b>' +
      '<span class="small">de ' + esc(p._sharedFrom || '') + ' · </span><span class="badge grey">' + esc(p._cargo) + '</span></span>' +
      (p._collabId
        ? '<button class="btn sm danger u-fx-0-0-auto" data-toca="dados" data-risco="destroi" data-click="CW.sairDeImovel(\'' + jsq(p._collabId) + '\')">Sair</button>'
        : '') + '</div>';
  }).join('');
  return card('Imóveis onde colaboras', 'Como colaborador, não como dono',
    '<div class="list u-g-8px">' + linhas + '</div>' +
    '<div class="hint u-mt-11px">Não tens quota-parte nestes imóveis nem entras nas contas entre proprietários. Ao sair, o que registaste fica com o dono.</div>');
}

/* O separador «Colaboradores» (menu, no grupo Pessoas): quem ajuda a gerir os
   meus imóveis e com que cargo. Abre com uma frase a dizer o que é um
   colaborador e depois, por esta ordem: convidar (a ligação de uso único),
   quem colabora em cada imóvel, os cargos e os imóveis onde sou eu o
   colaborador. Sem cargos, sem convites e sem colaboradores, o vazio convida
   a criar o primeiro cargo — é ele que diz o que a pessoa pode fazer. Com o
   serviço desligado nesta conta (o render já não chega aqui; um atalho
   antigo pode), fica o ecrã que diz o nome e quem o liga.
   Devolve: string de HTML da página, pronta a inserir com innerHTML. */
function vColaboradores() {
  if (!servicoLigado('colaboradores')) return servicoDesligadoHtml('colaboradores');
  if (!CW.user) {
    return card('Colaboradores', 'Sem sessão iniciada',
      '<div class="hint">Convidar quem ajuda a gerir precisa de conta: é ela que guarda os cargos e os convites.</div>' +
      '<div class="toolbar u-mt-11px"><button class="btn primary" data-toca="camada" data-click="CW.showAuth()">Iniciar sessão</button></div>');
  }
  var gap = '<div class="u-h-14px"></div>';
  var intro = '<div class="hint u-m-0-0-12px">Um colaborador entra nos imóveis que lhe deres, com um cargo que diz o que pode ver e adicionar — ' +
    'sem quota-parte e sem entrar nas contas entre proprietários.</div>';
  var colab = colaboroCard();
  var roles = CW.state.roles || [];
  var temGente = ((CW.state.collaborators || []).length + (CW.state.invites || []).length) > 0;
  /* «não tens nada» e «ainda não falámos com o servidor» são coisas
     diferentes: o CW.state não é guardado no aparelho, e num arranque sem
     rede dizer «ainda não tens colaboradores» a quem tem é mentira que
     parece perda de dados. Os imóveis onde colaboro vêm do db local e
     mostram-se na mesma. */
  if (!CW._pulled) {
    return intro + card('Cargos e colaboradores', 'À espera do servidor',
      '<div class="hint">Ainda não recebemos a lista deste dispositivo. Sem ligação, os cargos, os convites e quem colabora aparecem assim que a app voltar a sincronizar.</div>') +
      (colab ? gap + colab : '');
  }
  if (!roles.length && !temGente) {
    return intro +
      '<div class="empty"><b>Ainda não tens colaboradores</b>Começa pelo cargo: é ele que diz o que a pessoa vê e o que pode adicionar. ' +
      'Depois convida-a com uma ligação de uso único.' +
      '<div class="u-mt-10px"><button type="button" class="btn primary sm" data-toca="camada" data-click="CW.cargoModal()">' + ic('plus', 13) + ' Novo cargo</button></div></div>' +
      (colab ? gap + colab : '');
  }
  // sem imóveis o cartão «Colaboradores» não se escreve (colaboradoresCard), e o espaço dele também não
  var colaboradores = colaboradoresCard();
  return intro + convidarCard() + (colaboradores ? gap + colaboradores : '') + gap + cargosCard() + (colab ? gap + colab : '');
}

// O HTML da página "Conta e partilha": a conta e o id para dar a outros, a
// ligação de partilha e os pedidos, o campo para adicionar uma ligação, a
// lista de utilizadores ligados, uma linha que leva ao separador Grupos — os
// grupos partilhados vivem lá, ao lado dos privados (cloud/grupos.js:
// linhaDosGrupos, que carrega depois deste ficheiro — daí o typeof) —, a
// segurança e o apagar da conta. Os colaboradores vivem no menu (Pessoas →
// Colaboradores) e não têm aqui segunda porta. Sem sessão iniciada, mostra
// apenas o convite para entrar. A partilha entre contas — a ligação, os
// pedidos, os utilizadores ligados e os grupos — é do serviço Colaboradores:
// desligado nesta conta, ficam a conta, a segurança e o apagar, e uma frase
// a dizer quem o liga.
// Devolve: string de HTML da página, pronta a inserir com innerHTML.
function vCloud() {
  if (!CW.user) return card('Conta', 'Sem sessão iniciada', '<button class="btn primary" data-toca="camada" data-click="CW.showAuth()">Iniciar sessão</button>');
  var partilha = servicoLigado('colaboradores');
  var conns = (CW.state.connections || []).slice();
  var gap = '<div class="u-h-14px"></div>';
  var pedidos = pedidosCard();
  var acc = card('A minha conta', 'Sincronizada neste e noutros aparelhos',
    '<div class="stat"><span>Nome</span><b>' + esc(CW.user.name || '—') + '</b></div>' +
    '<div class="stat"><span>Email</span><b>' + esc(CW.user.email) + '</b></div>' +
    '<div class="stat u-b-0"><span>O meu id</span><b class="u-ff-monospace u-ls-2px u-fs-16px">' + esc(CW.user.id) + '</b></div>' +
    '<div class="toolbar u-mt-11px">' +
    '<button class="btn" data-toca="nada" data-click="CW.copyId()">Copiar id</button>' +
    '<button class="btn" data-toca="dados" data-click="CW.logout()">Terminar sessão</button></div>' +
    (partilha
      ? '<div class="hint u-mt-11px">Dá este id a outro utilizador para ele te adicionar — ou adiciona tu o id dele em baixo. Depois de aceite, cada um escolhe que casas quer partilhar.</div>'
      : '<div class="hint u-mt-11px">' + esc(hintServicoDesligado('colaboradores')) + ' A partilha entre contas fica disponível quando o suporte o ligar.</div>'));
  var add = !partilha ? '' : card('Ligar a outro utilizador', 'Escreve o id que ele te deu',
    '<div class="u-d-flex u-g-9px u-ai-end">' +
    '<label class="u-fx-1 u-minw-0">O id dele <span class="req">*</span>' +
    '<input id="cw_peer" class="u-tt-uppercase u-ff-monospace u-ls-2px" placeholder="Ex: A7KQ2MPX" maxlength="8" autocomplete="off"></label>' +
    '<button class="btn primary u-fx-0-0-auto" data-toca="dados" data-click="CW.addConn()">Adicionar</button></div>');
  var list = !partilha ? '' : conns.length
    ? '<div class="section-title">Utilizadores ligados</div><div class="list u-g-10px">' + conns.map(connCard).join('') + '</div>'
    : '<div class="hint">Ainda não estás ligado a ninguém.</div>';
  var seg = card('Segurança', 'Palavra-passe e sessões',
    '<div class="hint">A sessão dura 30 dias em cada aparelho. Se desconfiares que alguém entrou na tua conta, ' +
    'muda a palavra-passe ou fecha as outras sessões — em qualquer dos casos, todos os outros aparelhos passam a ' +
    'ter de entrar de novo.</div>' +
    '<div class="toolbar u-mt-11px">' +
    '<button class="btn" data-toca="camada" data-click="CW.passwordModal()">' + ic('lock', 15) + ' Mudar palavra-passe</button>' +
    '<button class="btn" data-toca="dados" data-click="CW.revokeSessions()">Terminar sessão nos outros aparelhos</button></div>');
  var danger = card('Apagar a conta', 'Não há volta atrás',
    '<div class="hint">Apaga a tua conta e <b>todos os teus dados</b>: imóveis, contratos, movimentos, pessoas e ligações. ' +
    'Nas casas de outras pessoas onde tenhas ficado registado (num movimento pago por ti, por exemplo), o teu nome passa a ' +
    'aparecer como <b>[deleted]</b>. As casas que os outros partilharam contigo deixam de estar ligadas a ti — os dados deles não são apagados.</div>' +
    '<div class="toolbar u-mt-11px"><button class="btn danger" data-toca="dados" data-risco="destroi" data-click="CW.deleteAccount()">' +
    ic('trash', 15) + ' Apagar a minha conta</button></div>');
  var ligacao = ligacaoCard();
  var grupos = partilha && typeof linhaDosGrupos === 'function' ? linhaDosGrupos() : '';
  return acc + (ligacao ? gap + ligacao : '') + (pedidos ? gap + pedidos : '') + (add ? gap + add : '') + (list ? gap + list : '') +
    (grupos ? gap + grupos : '') + '<div class="u-h-18px"></div>' + seg + gap + danger;
}

/* ---------------- ações da página "Conta e partilha" ---------------- */

// Copia o id do utilizador para a área de transferência, para o dar a quem se
// quer conectar; o toast aparece na mesma quando o clipboard não existe.
// Devolve: nada — copia o id e mostra o toast.
CW.copyId = function () {
  var done = function () { toast('Id copiado: partilha-o com o outro utilizador.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(CW.user.id).then(done, done);
  else done();
};

// Envia um convite de conexão para o id escrito no campo; fica pendente até o
// outro utilizador aceitar do lado dele.
// Devolve: nada — envia o convite à API, sincroniza e repinta.
CW.addConn = function () {
  var id = (val('cw_peer') || '').trim().toUpperCase();
  if (!id) return toast('Escreve o id do outro utilizador.');
  api('POST', '/api/connections', { peerId: id })
    .then(function () { toast('Convite enviado — falta o outro utilizador aceitar.'); return pullNow(true); })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message); });
};

// Aceita o convite de conexão id e sincroniza logo, para o que o outro já partilhou aparecer.
// Recebe: id — o id da conexão (o convite), tal como vem da API.
// Devolve: nada — aceita na API, sincroniza e repinta.
CW.acceptConn = function (id) {
  api('POST', '/api/connections/' + id + '/accept')
    .then(function () { toast('Conexão aceite. Escolhe agora que casas queres partilhar.'); return pullNow(true); })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message); });
};

/* Remove uma conexão, ou retira um convite (isPending). Convites saem sem
   perguntar; conexões feitas pedem confirmação, porque ambos deixam de ver as
   casas partilhadas do outro — os dados de cada um não se apagam.
   Recebe: id — o id da conexão ou do convite; isPending — verdadeiro quando
   ainda é só um convite (remove sem confirmar).
   Devolve: nada — remove na API, sincroniza e repinta. */
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

/* Quem entra na divisão de uma casa que se vai partilhar: os comproprietários
   atuais (como CW.proposeShares os lê, pelos ownerIds) e o par com quem se
   partilha, no fim.
   Recebe: p — o imóvel; peer — o outro utilizador da ligação {id, name, email}.
   Devolve: array de {id, nome}, com «(tu)» no meu. */
function quotasDe(p, peer) {
  var meu = CW.user ? CW.user.id : '';
  var quem = ((p && p.ownerIds) || []).map(function (u) {
    var o = owner(u) || { name: u };
    return { id: u, nome: (o.name || u) + (u === meu ? ' (tu)' : '') };
  });
  if (!quem.some(function (x) { return x.id === peer.id; })) quem.push({ id: peer.id, nome: peer.name || peer.email || peer.id });
  return quem;
}

/* O bloco das quotas de uma casa que se vai partilhar, debaixo da caixa dela
   no modal das partilhas: um campo por comproprietário mais o par, a começar
   em partes iguais, e a frase de que só entra em vigor depois de o outro
   confirmar.
   Recebe: hid — o id da casa; peer — o outro utilizador {id, name, email};
   valores (opcional) — {userId: texto} escrito antes, para repor.
   Devolve: o HTML do bloco (texto). */
function quotasHtml(hid, peer, valores) {
  var p = (db.properties || []).find(function (x) { return x.id === hid; });
  var quem = quotasDe(p, peer);
  var igual = dec(Math.round(1000 / quem.length) / 10);
  return '<div class="form u-mt-10px">' + quem.map(function (u) {
    var v = valores && valores[u.id] != null ? valores[u.id] : igual;
    return '<label>' + esc(u.nome) + ' (%)<input id="cw_q_' + hid + '_' + u.id + '" type="text" inputmode="decimal" value="' + esc(v) + '"></label>';
  }).join('') +
    '<div class="hint">A divisão só entra em vigor depois de o outro confirmar; até lá fica em partes iguais.</div></div>';
}

/* O que está escrito nos campos das quotas de uma casa no modal das partilhas.
   Recebe: hid — o id da casa; quem — os comproprietários ({id, nome}), como
   quotasDe os dá.
   Devolve: {texto: {userId: o texto tal qual}, shares: {userId: número},
   total, invalida} — invalida quando algum campo não é um número ≥ 0. */
function quotasEscritas(hid, quem) {
  var out = { texto: {}, shares: {}, total: 0, invalida: false };
  quem.forEach(function (u) {
    var t = val('cw_q_' + hid + '_' + u.id);
    var v = numTaxa(t);   // é uma percentagem: «33,3» são 33,3, não 333
    if (!isFinite(v) || v < 0) out.invalida = true;
    out.texto[u.id] = t;
    out.shares[u.id] = v;
    out.total += v;
  });
  return out;
}

/* Ao marcar ou desmarcar, no modal das partilhas, uma casa ainda não
   partilhada com este par: marcada, o bloco das quotas aparece debaixo dela
   (com o que lá estava escrito, se já tinha sido marcada); desmarcada, some,
   e o que estava escrito guarda-se para o caso de voltar.
   Recebe: hid — o id da casa.
   Devolve: nada — escreve ou esvazia o bloco das quotas dessa casa. */
CW.shareCasaMudou = function (hid) {
  var em = CW._partilha, caixa = document.getElementById('cw_sh_' + hid), bloco = document.getElementById('cw_qb_' + hid);
  if (!em || !caixa || !bloco) return;
  if (caixa.checked) { bloco.innerHTML = quotasHtml(hid, em.peer, em.escrito[hid]); return; }
  var p = (db.properties || []).find(function (x) { return x.id === hid; });
  em.escrito[hid] = quotasEscritas(hid, quotasDe(p, em.peer)).texto;
  bloco.innerHTML = '';
};

/* Modal para escolher que casas se partilham com a conexão connId. Debaixo
   de cada casa ainda não partilhada com este par, ao marcá-la aparecem as
   quotas (CW.shareCasaMudou). Ao guardar valida as quotas das casas novas,
   envia a lista à API e, para cada casa nova cuja divisão não seja em partes
   iguais, segue a proposta (enviarProposta) — sem passar pela fila
   _shareQueue, que fica para a ficha do imóvel.
   Recebe: connId — o id da conexão cujas partilhas se editam.
   Devolve: nada — abre o modal; o guardar acontece no onSave. */
CW.sharesModal = function (connId) {
  var c = (CW.state.connections || []).find(function (x) { return x.id === connId; });
  if (!c) return;
  // só os imóveis que criei eu: nunca os de colaboração nem os que outro partilhou comigo
  var myHouses = (db.properties || []).filter(function (p) { return cwMinha(p); });
  var before = (c.myShares || []).slice();
  CW._partilha = { peer: c.peer, escrito: {} };   // o que o shareCasaMudou precisa: o par, e as quotas de uma casa desmarcada
  var body = myHouses.length
    ? '<div class="form"><div class="hint">Casas que partilhas com ' + esc(c.peer.name || c.peer.id) + '. Ele passa a ver e editar tudo o que pertence a estas casas: contratos, movimentos e pessoas associadas.</div>' +
      '<div class="list u-g-8px">' + myHouses.map(function (p) {
        var on = before.indexOf(p.id) > -1;
        // uma casa já partilhada não ganha quotas por aqui: mudam-se na ficha do imóvel
        return '<div class="card u-p-12px-13px"><label class="u-d-flex u-g-11px u-ai-center u-cur-pointer">' +
          '<input type="checkbox" class="u-w-18px u-h-18px" id="cw_sh_' + p.id + '" ' +
          (on ? 'checked' : 'data-toca="rascunho" data-change="CW.shareCasaMudou(\'' + jsq(p.id) + '\')"') + '>' +
          '<span class="u-minw-0"><b class="u-d-block">' + esc(p.name || 'Sem nome') + '</b>' +
          '<span class="small">' + esc(p.address || '') + '</span></span></label>' +
          (on ? '' : '<div id="cw_qb_' + p.id + '"></div>') + '</div>';
      }).join('') + '</div></div>'
    : '<div class="hint">Ainda não tens casas para partilhar.</div>';
  openModal('Partilhar casas', body);
  onSave = function () {
    var ids = myHouses.filter(function (p) {
      var e = document.getElementById('cw_sh_' + p.id);
      return e && e.checked;
    }).map(function (p) { return p.id; });
    // as casas partilhadas agora pela primeira vez: as quotas validam-se antes de gravar o que quer que seja
    var propostas = [];
    for (var i = 0; i < ids.length; i++) {
      if (before.indexOf(ids[i]) > -1) continue;
      var p = myHouses.find(function (x) { return x.id === ids[i]; });
      var nome = p.name || 'Sem nome', quem = quotasDe(p, c.peer), q = quotasEscritas(p.id, quem);
      if (q.invalida) return toast('Percentagens inválidas em ' + nome + '.');
      if (Math.abs(q.total - 100) > 0.5) return toast('As percentagens de ' + nome + ' têm de somar 100 (agora somam ' + dec(Math.round(q.total * 100) / 100) + ').');
      // em partes iguais não há nada para o outro confirmar
      var igual = 100 / quem.length;
      var diferente = quem.some(function (u) { return Math.abs(q.shares[u.id] - igual) >= 0.1; });
      if (diferente) propostas.push({ hid: p.id, nome: nome, shares: q.shares });
    }
    var falhas = [];
    api('PUT', '/api/connections/' + connId + '/shares', { houseIds: ids })
      .then(function () { closeModal(); return pullNow(true); })
      .then(function () {
        // as propostas seguem uma a uma, já com a partilha no servidor; uma que falhe não trava as outras
        return propostas.reduce(function (seq, pr) {
          return seq.then(function () {
            return enviarProposta(pr.hid, pr.shares).catch(function (e) { falhas.push(pr.nome + ': ' + String(e.message || 'não seguiu').replace(/\.$/, '')); });
          });
        }, Promise.resolve());
      })
      .then(function () { return propostas.length > falhas.length ? pullNow(true) : null; })
      .then(function () {
        render();
        var n = propostas.length - falhas.length;
        if (falhas.length) {
          toast('Partilha atualizada, mas a proposta de divisão não seguiu — ' + falhas.join('; ') + '. Podes propô-la na ficha do imóvel.', { ms: 7000 });
        } else if (n) {
          toast('Partilha atualizada. ' + (n === 1 ? 'A proposta de divisão seguiu — falta a confirmação do outro comproprietário.'
            : n + ' propostas de divisão seguiram — falta a confirmação dos outros comproprietários.'), { ms: 5000 });
        } else toast('Partilha atualizada.');
      })
      .catch(function (e) { toast(e.message); });
  };
};

// Passa à casa seguinte na fila de propostas de quotas que a ficha do imóvel
// (CW.proposeShares) deixou; o sharesModal já não a usa.
// Devolve: nada — abre a proposta seguinte, se a houver.
function nextShareProposal() {
  var nxt = (CW._shareQueue || []).shift();
  if (nxt) CW.proposeShares(nxt, true);
}

/* Modal de mudança de palavra-passe, com os requisitos a acenderem-se à
   medida que se escreve. Quem entra com Google deixa o campo da atual vazio.
   Devolve: nada — abre o modal e liga os requisitos ao campo. */
CW.passwordModal = function () {
  var body = '<div class="form">' +
    '<div class="hint">Ao mudar a palavra-passe, todos os outros aparelhos têm de iniciar sessão de novo. ' +
    'Este continua ligado.</div>' +
    '<label>Palavra-passe atual<input id="cw_pw_cur" type="password" autocomplete="current-password" placeholder="Opcional"></label>' +
    '<div class="hint u-m-n4px-0-0">Só fica vazia se entras com o Google.</div>' +
    '<label>Nova palavra-passe <span class="req">*</span><input id="cw_pw_new" type="password" autocomplete="new-password"></label>' +
    '<div id="cw_pw_req" class="small u-m-n4px-0-0 u-d-flex u-fxw-wrap u-g-3px-12px"></div>' +
    '<label>Confirmar nova palavra-passe <span class="req">*</span><input id="cw_pw_new2" type="password" autocomplete="new-password"></label>' +
    '<div id="cw_pw_err" class="small u-c-v-danger"></div></div>';
  openModal('Mudar palavra-passe', body,
    '<button class="btn" data-click="closeModal()">Cancelar</button>' +
    '<button class="btn primary" data-click="CW.savePassword()">Guardar</button>');
  var reqs = [['8+ caracteres', function (p) { return p.length >= 8; }],
    ['maiúscula', function (p) { return /[A-Z]/.test(p); }],
    ['minúscula', function (p) { return /[a-z]/.test(p); }],
    ['número', function (p) { return /[0-9]/.test(p); }],
    ['símbolo', function (p) { return /[^A-Za-z0-9]/.test(p); }]];
  var box = document.getElementById('cw_pw_req'), inp = document.getElementById('cw_pw_new');
  var paint = function () {
    box.innerHTML = reqs.map(function (r) {
      var ok = r[1](inp.value);
      return '<span class="' + (ok ? 'u-c-v-accent u-fw-650' : 'u-c-v-muted u-fw-400') + '">' +
        (ok ? '✓ ' : '• ') + r[0] + '</span>';
    }).join('');
  };
  paint();
  inp.addEventListener('input', paint);
};

/* Valida a nova palavra-passe e envia a mudança à API; o servidor termina as
   sessões dos outros aparelhos e põe a nova deste no cookie
   (nucleo.js:sessaoRodada acerta o que o aparelho guarda). Os erros aparecem
   dentro do próprio modal — incluindo a palavra-passe atual errada, que não
   encerra a sessão (nucleo.js:sessaoCaiu).
   Devolve: nada — envia a mudança à API e fecha o modal quando corre bem. */
CW.savePassword = function () {
  var e = document.getElementById('cw_pw_err');
  e.textContent = '';
  var next = val('cw_pw_new');
  var prob = passProblem(next);
  if (prob) { e.textContent = prob; return; }
  if (next !== val('cw_pw_new2')) { e.textContent = 'As palavras-passe não coincidem.'; return; }
  api('POST', '/api/me/password', { current: val('cw_pw_cur'), next: next })
    .then(function (r) {
      sessaoRodada(r);
      closeModal();
      toast('Palavra-passe alterada. Os outros aparelhos têm de entrar de novo.');
    })
    .catch(function (err) { e.textContent = err.message || 'Não foi possível mudar a palavra-passe.'; });
};

// Depois de confirmado, termina a sessão em todos os outros aparelhos; este
// continua ligado — a sessão nova vem no cookie (nucleo.js:sessaoRodada).
// Devolve: nada — pede confirmação e chama a API.
CW.revokeSessions = function () {
  confirmModal('Terminar as outras sessões',
    'Todos os outros aparelhos onde tenhas a conta aberta passam a pedir início de sessão. Este continua ligado.',
    function () {
      api('DELETE', '/api/me/sessions')
        .then(function (r) {
          sessaoRodada(r);
          toast('Sessões terminadas nos outros aparelhos.');
        })
        .catch(function (err) { toast(err.message); });
    });
};

// Modal de confirmação para apagar a conta: diz quantos imóveis se perdem e
// exige escrever APAGAR e a palavra-passe (vazia para quem entra com Google).
// Devolve: nada — abre o modal de confirmação.
CW.deleteAccount = function () {
  var mine = (db.properties || []).filter(function (p) { return cwMinha(p); }).length;
  var body = '<div class="form">' +
    '<div class="hint u-c-v-danger"><b>Isto não se pode desfazer.</b> Vais apagar ' + mine +
    ' imóvel' + (mine === 1 ? '' : 'is') + ', com os contratos, movimentos e pessoas que lhes pertencem, ' +
    'e todas as tuas ligações a outros utilizadores.</div>' +
    '<div class="hint">Se quiseres guardar os teus registos, cancela e faz primeiro uma cópia de segurança ' +
    'em Definições → Importar e cópias → Guardar cópia.</div>' +
    '<label><span class="rotulo-txt">Escreve <b>APAGAR</b> para confirmar</span> <span class="req">*</span><input id="cw_del_c" class="u-tt-uppercase" placeholder="APAGAR" autocomplete="off"></label>' +
    '<label>Palavra-passe<input id="cw_del_p" type="password" placeholder="Opcional" autocomplete="current-password"></label>' +
    '<div class="hint u-m-n4px-0-0">Só fica vazia se entras com o Google.</div>' +
    '<div id="cw_del_e" class="small u-c-v-danger"></div></div>';
  openModal('Apagar a minha conta', body,
    '<button class="btn" data-click="closeModal()">Cancelar</button>' +
    '<button class="btn danger" data-click="CW.doDeleteAccount()">Apagar definitivamente</button>');
};

/* Apaga a conta na API (confirmação e palavra-passe validadas lá) e limpa
   este aparelho — dados locais, sessão e retrato, pelo ritual de saída
   (nucleo.js:encerrarSessao) — a acabar no ecrã de entrada. Numa conta de
   teste o servidor pode entregar logo a seguinte, e nesse caso a app
   recarrega já com ela em vez de cair no login.
   Devolve: nada — apaga a conta, limpa o aparelho e acaba no ecrã de
   entrada (ou recarrega com a conta seguinte). */
CW.doDeleteAccount = function () {
  var e = document.getElementById('cw_del_e');
  e.textContent = '';
  api('DELETE', '/api/me', { confirm: val('cw_del_c'), password: val('cw_del_p') })
    .then(function (r) {
      /* numa conta de teste, o servidor entrega logo a próxima (a irmã do
         mesmo dev, ou uma nova), já com o cookie dela: troca-se em vez de
         cair no login. O token, quando vem, é o de um fluxo de teste */
      if (r && r.proxima && r.proxima.id) {
        var nova = { id: r.proxima.id, email: r.proxima.email, name: r.proxima.name };
        if (r.proxima.token) nova.token = r.proxima.token;
        try { localStorage.setItem(LS_USER, JSON.stringify(nova)); } catch (x) {}
        location.reload();
        return;
      }
      encerrarSessao({ apagarDados: true, mensagem: 'Conta apagada. Obrigado por teres experimentado.' });
    })
    .catch(function (err) { e.textContent = err.message || 'Não foi possível apagar a conta.'; });
};

// Termina a sessão neste aparelho depois de confirmar: os dados ficam na
// conta e a app volta ao ecrã de entrada (nucleo.js:encerrarSessao).
// Devolve: nada — termina a sessão e volta ao ecrã de entrada.
CW.logout = function () {
  confirmModal('Terminar sessão', 'Os dados continuam guardados na tua conta e voltam quando iniciares sessão.', function () {
    encerrarSessao({ avisarServidor: true });
  });
};

/* ---------------- aviso legal ---------------- */

SUBPAGE.cloud = { label: 'Conta e partilha', sub: 'O teu id, ligações e imóveis partilhados' };
SUBPAGE.legal = { label: 'Aviso legal', sub: 'Condições de utilização e privacidade' };
SUBPAGE.ajuda = { label: 'Ajuda e sugestões', sub: 'Contar um problema ou pedir uma melhoria' };
SUBPAGE.termos = { label: 'Termos e Condições', sub: 'O acordo entre ti e quem opera o serviço' };
SUBPAGE.privacidade = { label: 'Política de Privacidade', sub: 'Que dados tratamos, porquê e por quanto tempo' };

var L = window.LEGAL || { version: '', termos: '', privacidade: '' };

/* A folha dos documentos legais (texto corrido, legível, sem cartões) era
   criada aqui por JavaScript e pendurada na cabeça do documento. Isso é CSS
   em linha, que a CSP sem 'unsafe-inline' em style-src recusa: as regras .lg
   passaram tal e qual para a secção «g01-partilha» do web/estilos.css, no
   mesmo lugar da cascata e com a mesma especificidade. */


SUBPAGE.faq = { label: 'Perguntas frequentes', sub: 'As dúvidas mais comuns' };

/* As perguntas que vão chegar de certeza — respondidas antes de chegarem.
   Cada resposta aponta o caminho concreto na app, não teoria.
   Devolve: string de HTML do cartão das perguntas, pronta a inserir com innerHTML. */
function vFaq() {
  var q = function (id, pergunta, resposta) {
    return fold('faq_' + id, pergunta, '<div class="hint u-fs-14px u-lh-1p6">' + resposta + '</div>', { icon: 'info', open: false });
  };
  return card('Perguntas frequentes', 'Se a tua não estiver aqui, usa a Ajuda e sugestões', `
    ${q('dados', 'Os meus dados estão seguros?', 'Ficam numa base de dados na nuvem com cópias de segurança diárias, e também no teu aparelho. Mesmo assim, mantém as tuas próprias cópias: <b>Definições → Importar e cópias → Guardar cópia</b>. Nenhuma nuvem substitui uma cópia tua.')}
    ${q('renda', 'Como registo a renda todos os meses sem trabalho?', 'Cria o contrato com a renda mensal: a app gera um <b>movimento planeado</b> que aparece todos os meses na Visão geral, no cartão «Movimentos por confirmar». Um toque em <b>Confirmar</b> regista a renda — não escreves nada.')}
    ${q('partilha', 'Como partilho as casas com o comproprietário?', 'Em <b>Definições → Conta e partilha</b> está o teu id de 8 caracteres. A outra pessoa cria conta, e um de vocês adiciona o id do outro. Depois escolhem casa a casa o que partilham — e a divisão de quotas só muda quando todos confirmarem. Há também a <b>ligação de partilha</b>: quem a abrir escolhe que imóveis partilha contigo, e tu aceitas ou recusas cada pedido.')}
    ${q('colaborador', 'Como dou acesso a um gestor sem o tornar comproprietário?', 'Convida-o como <b>colaborador</b>: no menu, em Pessoas → <b>Colaboradores</b>, crias um cargo (o que pode ver e adicionar — movimentos, visitas, contratos, documentos…) e uma ligação de convite com esse cargo e os imóveis. Quem a abrir entra (ou cria conta) e fica logo com o acesso. Não tem quota-parte, não entra nas contas entre proprietários, e só edita o que ele próprio adicionar. Podes mudar-lhe o cargo ou removê-lo quando quiseres.')}
    ${q('fotos', 'As fotografias e documentos sincronizam entre aparelhos?', 'Sim — desde que tenhas sessão iniciada, os anexos sobem para a nuvem e descem nos outros aparelhos. Se um anexo não subir (por tamanho ou falha), a app avisa e ele fica só nesse aparelho até conseguir.')}
    ${q('password', 'Esqueci-me da palavra-passe. E agora?', 'No ecrã de entrada, toca em <b>«Esqueci-me da palavra-passe»</b>: enviamos-te uma ligação por email (vale 1 hora, uma só vez) para definires uma nova. Serve também a quem sempre entrou com a Google e quer passar a ter palavra-passe.')}
    ${q('apagar', 'Apaguei uma coisa sem querer. Consigo recuperar?', 'Logo a seguir a apagar aparece um <b>«Anular»</b> no fundo do ecrã, durante seis segundos — repõe tudo, incluindo cascatas (um imóvel com os contratos e movimentos). Passado esse tempo, restaura a partir de uma cópia em <b>Importar e cópias</b>.')}
    ${q('varios', 'Como apago ou edito vários movimentos de uma vez?', 'Faz um <b>toque longo</b> num movimento, imóvel ou contrato: entra em modo de seleção. Marca o que quiseres — há caixas por mês e uma global — e usa a barra no fundo do ecrã.')}
    ${q('pdf', 'O contrato em PDF serve para assinar?', 'É uma <b>minuta genérica</b>, não validada por advogado. Usa-a como ponto de partida e pede revisão profissional antes de assinar — a lei do arrendamento muda e cada caso é um caso.')}
    ${q('tema', 'A app não muda para o modo escuro do telemóvel', 'Em <b>Definições → Tema</b>, escolhe «Automático». Em alguns browsers Samsung o sistema não passa a preferência — nesse caso escolhe «Escuro» à mão; a escolha é por aparelho.')}
    ${q('instalar', 'Como instalo a app no telemóvel?', 'Android: <b>Definições → Conta e partilha</b> tem o APK, ou usa «Adicionar ao ecrã principal» no browser. iPhone: Safari → Partilhar → <b>Adicionar ao ecrã principal</b>.')}
    ${q('conta', 'Como apago a minha conta?', 'Em <b>Definições → Conta e partilha → Apagar conta</b>. É definitivo: apaga imóveis, contratos, movimentos e ligações. Nas casas partilhadas, o teu nome passa a «[deleted]» para os outros.')}
  `);
}
