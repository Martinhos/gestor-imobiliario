/* A pagina Seguranca (palavra-passe, sessoes e apagar a conta), a partilha
   entre contas por baixo dos Proprietarios (o meu id, as ligacoes, os
   pedidos e a ligacao de partilha) e as acoes delas, e Colaboradores
   (cargos, convites e quem colabora em cada imovel; as acoes destes vivem em
   colaboradores.js). */
'use strict';

/* ---------------- página "Segurança" ---------------- */

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
        ? '<div class="hint">Já estás a usar a app instalada no ecrã principal.</div>'
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
   (definicoes.js:linhaDefinicoes): o perfil e a segurança, a ajuda, as
   perguntas frequentes, o aviso legal e a app no telemóvel. A nuvem escrevia
   a raiz inteira por cima da da base, e a dela tinha esquecido «IRS e
   dedução» e «Filtros comuns». A linha da segurança já não diz o id: ele
   vive nas Pessoas › Proprietários, ao lado do campo de ligar
   (comproprietariosCorpo). */
linhaDefinicoes({ sec: 'conta', ordem: 10, html: cartaoDoPerfil });
linhaDefinicoes({ sec: 'conta', ordem: 20, page: 'cloud', label: 'Segurança', icon: 'lock',
  sub: function () { return CW.user ? 'Palavra-passe, sessões e apagar a conta' : 'Inicia sessão'; } });
linhaDefinicoes({ sec: 'ajuda', ordem: 10, page: 'ajuda', label: 'Ajuda e sugestões', icon: 'ajuda', sub: 'Como se faz, apresentações e pedidos' });
linhaDefinicoes({ sec: 'sobre', ordem: 10, page: 'faq', label: 'Perguntas frequentes', icon: 'info', sub: 'As dúvidas mais comuns, respondidas' });
linhaDefinicoes({ sec: 'sobre', ordem: 30, page: 'legal', label: 'Aviso legal', icon: 'contract', sub: 'Termos e privacidade' });
linhaDefinicoes({ sec: 'sobre', ordem: 60, html: cartaoDaAppNoTelemovel });

// o que aceitar um convite de ligação dá — no cartão da ligação e no aviso da vista geral
var CONVITE_SE_ACEITARES = 'Se aceitares, cada um pode escolher que casas partilha com o outro.';

/* Os botões de um convite de ligação recebido: aceitar e recusar. Servem o
   cartão da ligação (connCard) e o aviso da vista geral (pedidosDashCard).
   Recusar não destrói nada (o outro pode voltar a pedir), por isso é o
   botão secundário, e não o vermelho cheio do que apaga.
   Recebe: c — a ligação, com id.
   Devolve: o HTML dos dois botões (texto). */
function botoesConvite(c) {
  return '<button class="btn primary sm" data-toca="dados" data-click="CW.acceptConn(\'' + jsq(c.id) + '\')">Aceitar</button>' +
    '<button class="btn sm" data-toca="dados" data-click="CW.delConn(\'' + jsq(c.id) + '\',1)">Recusar</button>';
}

/* Uma ligação a outro utilizador, como linha do cartão da partilha entre
   contas (comproprietariosCorpo; o canvas M-Partilha): o avatar com as iniciais, o nome, o que se passa e
   os botões certos para o estado dela — convite recebido (aceitar/recusar),
   convite enviado (cancelar, que só retira o convite) ou ligação ativa, com a
   contagem de casas partilhadas em cada sentido, «Casas partilhadas» (o
   modal onde se adiciona e remove casas e se propõe quotas) e, no ⋯,
   «Remover ligação» (que pergunta antes, CW.delConn).
   Recebe: c — a ligação, com id, status ('pending' ou ativa), incoming,
   peer {id, name, email} e as listas myShares/peerShares.
   Devolve: string de HTML da linha, pronta a inserir com innerHTML. */
function connCard(c) {
  var nome = c.peer.name || c.peer.email || c.peer.id;
  var peer = esc(nome);
  var titulo = peer, sub = '', btns = '', menuHtml = '';
  if (c.status === 'pending' && c.incoming) {
    titulo = peer + ' quer ligar-se a ti';
    sub = CONVITE_SE_ACEITARES;
    btns = botoesConvite(c);
  } else if (c.status === 'pending') {
    sub = 'À espera que aceite o convite.';
    btns = '<button class="btn sm" data-toca="dados" data-click="CW.delConn(\'' + jsq(c.id) + '\',1)">Cancelar</button>';
  } else {
    var mine = (c.myShares || []).length, theirs = (c.peerShares || []).length;
    sub = 'Partilhas ' + mine + ' casa' + (mine === 1 ? '' : 's') + ' · recebes ' + theirs;
    btns = '<button class="btn sm" data-toca="camada" data-click="CW.sharesModal(\'' + jsq(c.id) + '\')">Casas partilhadas</button>';
    menuHtml = menu('cw_conn_' + c.id, [
      { label: 'Remover ligação', icon: 'trash', danger: true, toca: 'camada', risco: 'destroi', act: "CW.delConn('" + jsq(c.id) + "')" },
    ]);
  }
  return '<div class="pt-linha' + (c.status === 'pending' && c.incoming ? ' pt-convite' : '') + '">' +
    '<span class="avatar pt-av" aria-hidden="true">' + esc(initials(nome)) + '</span>' +
    '<span class="pt-txt"><b class="u-d-block">' + titulo + '</b>' +
      '<span class="small num">' + sub + '</span>' +
      '<span class="small pt-id">id ' + esc(c.peer.id) + '</span></span>' +
    '<span class="pt-acoes">' + btns + menuHtml + '</span></div>';
}

/* ---------------- colaboradores, cargos e a ligação de partilha ---------------- */

// Os imóveis que criei eu — onde gero convites e colaboradores.
// Devolve: array de imóveis de db.properties.
function cwImoveisMeus() {
  return (db.properties || []).filter(function (p) { return cwMinha(p); });
}

/* O cartão «A minha ligação de partilha» (o canvas M-Partilha): o título
   com o selo «Ativa», o que a ligação faz, quantos pedidos chegaram por ali,
   e copiar, rodar e desativar; sem ligação, o botão de a criar. O URL só se
   vê na criação — o «Copiar» lê o que ficou no aparelho. Desativar não
   apaga nada que se perca (cria-se outra quando se quiser), por isso é um
   botão como os outros, e não o vermelho do que destrói.
   Recebe: nada (lê CW.state.shareLink).
   Devolve: o HTML do cartão (texto), ou '' com o serviço desligado. */
function ligacaoCard() {
  if (!servicoLigado('colaboradores')) return '';   // a ligação de partilha é do serviço Colaboradores
  var sl = CW.state.shareLink;
  var ativa = !!(sl && (sl.ativo || sl.url));
  var usos = Number(sl && sl.uses) || 0;
  return '<section class="card pt-ligacao" aria-labelledby="ptLigacao">' +
    '<div class="pt-ligacao-cab"><h3 id="ptLigacao">A minha ligação de partilha</h3>' +
      (ativa ? '<span class="badge in">Ativa</span>' : '<span class="badge grey">Sem ligação</span>') + '</div>' +
    '<p class="small">Quem a abre pede-te para seres comproprietário das casas que escolher. Aceitas ou recusas cada pedido. ' +
      'Não tem prazo: podes rodá-la ou desativá-la quando quiseres.</p>' +
    (ativa
      ? '<p class="small num">Pedidos chegados por aqui: <b>' + usos + '</b></p>' +
        '<div class="pt-botoes">' +
        '<button class="btn sm" data-toca="nada" data-click="CW.ligacaoCopiar()">Copiar</button>' +
        '<button class="btn sm" data-toca="dados" data-click="CW.ligacaoRodar()">Rodar</button>' +
        '<button class="btn sm" data-toca="dados" data-click="CW.ligacaoDesativar()">Desativar</button></div>'
      : '<div class="pt-botoes"><button class="btn primary sm" data-toca="dados" data-click="CW.ligacaoCriar()">' + ic('key', 15) + ' Criar ligação</button></div>') +
    '</section>';
}

/* Uma linha de pedido (o .it do canvas, na coluna «Pedidos e atividade» da
   Visão geral e na partilha entre contas): a frase de quem pede o quê, o que
   aceitar implica, e os botões. Linhas soltas com um traço por cima, e não
   cartões dentro de um cartão — assim juntam-se a outras linhas (a
   atividade) num cartão só.
   Recebe: frase — o HTML da frase (já escapado); nota — o texto do que
   aceitar implica (de confiança); botoes — o HTML dos botões.
   Devolve: o HTML da linha (texto). */
function linhaDePedido(frase, nota, botoes) {
  return '<div class="pd-linha"><b class="u-d-block">' + frase + '</b>' +
    '<span class="small">' + nota + '</span>' +
    '<div class="pd-botoes">' + botoes + '</div></div>';
}

/* A linha de um pedido de partilha recebido: quem quer partilhar o quê, o que
   aceitar implica, e os botões de aceitar e recusar. Serve o cartão dos
   pedidos (pedidosCard) e o aviso da vista geral (pedidosDashCard).
   Recebe: p — o pedido, com id, fromName e houseName.
   Devolve: o HTML da linha (texto). */
function pedidoRecebidoHtml(p) {
  return linhaDePedido(esc(p.fromName || '') + ' quer partilhar ' + esc(p.houseName || 'um imóvel') + ' contigo',
    'Se aceitares, passas a comproprietário desse imóvel — vês contratos, movimentos e pessoas.',
    '<button class="btn primary sm" data-toca="dados" data-click="CW.pedidoAceitar(\'' + jsq(p.id) + '\')">Aceitar</button>' +
    '<button class="btn sm" data-toca="dados" data-click="CW.pedidoRecusar(\'' + jsq(p.id) + '\')">Recusar</button>');
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
  return linhaDePedido(esc(p.name || 'Alguém') + ' quer entrar no grupo «' + esc(p.groupName || 'sem nome') + '»',
    'Se aceitares, passa a comproprietário dos imóveis do grupo.',
    '<button class="btn primary sm" data-toca="dados" data-click="CW.grupoAceitarPedido(\'' + gid + '\',\'' + uid + '\')">Aceitar</button>' +
    '<button class="btn sm" data-toca="dados" data-click="CW.grupoRecusarPedido(\'' + gid + '\',\'' + uid + '\')">Recusar</button>');
}

/* A linha de um pedido para transferir o controlo a que me falta responder (a
   todos os comproprietários, e não só a quem recebe): quem quer passar o
   controlo de que imóveis a quem («… a Bruno» ou «… a ti»), o que aceitar
   implica e, com um imóvel, quem já aceitou e quem falta
   (notificacoes.js:notifTransfTitulo e notifTransfSub), e os botões.
   Aceitar não está na linha: transferir o controlo lê-se antes, e o «Ver» abre
   a folha com o que muda, o progresso e o Aceitar
   (notificacoes.js:notifTransfVer). Recusar é o secundário, como nos outros
   pedidos: quem pediu pode voltar a pedir; não está quando já aceitei e só
   falta concluir (notificacoes.js:notifTransfSoConcluir).
   Recebe: t — o pedido do CW.state.transfers.incoming ({lote, from, to,
   houses, porResponder}).
   Devolve: o HTML da linha (texto). */
function pedidoDeTransferenciaHtml(t) {
  var l = jsq(t.lote);
  return linhaDePedido(esc(notifTransfTitulo(t)), esc(notifTransfSub(t)),
    '<button class="btn primary sm" data-toca="camada" data-click="notifTransfVer(\'' + l + '\')">Ver</button>' +
    (notifTransfSoConcluir(t) ? '' : '<button class="btn sm" data-toca="dados" data-click="notifTransfRecusar(\'' + l + '\')">Recusar</button>'));
}

/* O que está por responder, por tipo: os pedidos de partilha recebidos e os
   pedidos para entrar num grupo meu (os dois do serviço Colaboradores), os
   pedidos para transferir o controlo a que me falta responder (da base:
   CW.state.transfers, que um servidor de antes não manda —
   notificacoes.js:notifTransfPorResponder aguenta a falta; os que já aceitei
   esperam no sino, não aqui) e os convites de ligação recebidos (da partilha entre
   contas, sempre). Os que enviei ficam de fora — não são para responder.
   Recebe: nada (lê CW.state e os serviços ligados).
   Devolve: {inc, grupos, transf, convites, n} — as quatro listas e quantos são ao todo. */
function pedidosParaResponder() {
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
  var transf = notifTransfPorResponder();
  return { inc: inc, grupos: grupos, transf: transf, convites: convites, n: inc.length + grupos.length + transf.length + convites.length };
}

/* Só as LINHAS dos pedidos por responder, sem cartão nem contentor: as de
   partilha, as de transferir o controlo (com Ver e Recusar), as de grupo e os
   convites de ligação, por esta ordem, cada uma uma .pd-linha com os botões
   dela. É o que o cartão «Pedidos por
   responder» leva por dentro (pedidosDashCard), e o que a Visão geral pode
   juntar a outras linhas — a atividade nas casas partilhadas — num cartão só
   («Pedidos e atividade», o canvas Main).
   Recebe: nada.
   Devolve: o HTML das linhas seguidas (texto), ou '' sem nada por responder. */
function linhasDosPedidos() {
  var r = pedidosParaResponder();
  if (!r.n) return '';
  return r.inc.map(pedidoRecebidoHtml).concat(r.transf.map(pedidoDeTransferenciaHtml), r.grupos.map(pedidoDeGrupoHtml), r.convites.map(function (c) {
    return linhaDePedido(esc(c.peer.name || c.peer.email || c.peer.id) + ' quer ligar-se a ti', CONVITE_SE_ACEITARES, botoesConvite(c));
  })).join('');
}

/* O cartão «Pedidos por responder», para o topo da vista geral: as linhas
   de linhasDosPedidos num cartão, com quantos são. Quem recebe é muitas
   vezes uma conta nova, sem imóveis: sem isto só via o vazio.
   Recebe: nada.
   Devolve: o HTML do cartão com o espaço até ao cartão seguinte (texto), ou
   '' sem nada por responder. */
function pedidosDashCard() {
  var n = pedidosParaResponder().n;
  if (!n) return '';
  /* a marca no fim é para o guia: os «Primeiros passos» entram DEPOIS dos
     pedidos (cloud/guia.js), que são a coisa mais urgente da vista geral */
  return card('Pedidos por responder', n + ' por responder', '<div class="pd-lista">' + linhasDosPedidos() + '</div>') +
    '<div class="u-h-14px"></div><!--fim-pedidos-->';
}

// O cartão «Pedidos de partilha»: os recebidos, com aceitar e recusar, e os
// que enviei e ainda esperam (com «Cancelar pedido»), em linhas como as da
// Visão geral. Vazio quando não há nenhum.
// Recebe: nada (lê CW.state.shareRequests).
// Devolve: o HTML do cartão (texto), ou '' sem pedidos.
function pedidosCard() {
  if (!servicoLigado('colaboradores')) return '';   // os pedidos chegam pela ligação: do serviço Colaboradores
  var sr = CW.state.shareRequests || {};
  var inc = sr.incoming || [], out = sr.outgoing || [];
  if (!inc.length && !out.length) return '';
  var linhas = inc.map(pedidoRecebidoHtml).concat(out.map(function (p) {
    return linhaDePedido(esc(p.houseName || 'Imóvel') + ' · à espera de ' + esc(p.toName || ''),
      'Pediste que passasse a comproprietário. Fica pendente até responder.',
      '<button class="btn sm" data-toca="dados" data-click="CW.pedidoCancelar(\'' + jsq(p.id) + '\')">Cancelar pedido</button>');
  })).join('');
  return card('Pedidos de partilha', inc.length ? inc.length + ' por responder' : 'À espera de resposta',
    '<div class="pd-lista">' + linhas + '</div>');
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

var FRASE_DA_PARTILHA = 'Partilhar uma casa dá acesso a tudo o que ela tem: contratos, movimentos e pessoas.';

/* O corpo da partilha entre contas: o cartão com as ligações (connCard), o
   meu id com «Copiar» (CW.copyId) e, logo por baixo, o campo para escrever o
   do outro — dar o meu e escrever o do outro lado a lado, no mesmo cartão —,
   e por baixo os pedidos de partilha e a minha ligação de partilha. Nos
   Proprietários as ligações ativas já estão na lista de cima
   (pessoas.js:donosComPartilha), com «Editar casas partilhadas» e «Remover
   ligação» na ficha de cada um: o cartão fica só com os convites por
   responder, nos dois sentidos, e uma ligação ativa não aparece duas vezes.
   Sem o separador dos Proprietários (partilha.js:vCloud, a página Segurança)
   não há lista de cima, e o cartão leva-as todas. O vazio só se diz quando
   é verdade: sem ligação nenhuma, «Ainda não tens ligações.»; com
   ativas e sem convites, nada (o cartão começa no id); antes do primeiro sync, uma
   lista vazia não quer dizer que não haja ligações: diz-se que ainda não
   chegaram.
   Recebe: comAtivas — true para levar também as ligações ativas (onde não
   há a lista dos Proprietários por cima); lê CW.state.
   Devolve: o HTML (texto). */
function comproprietariosCorpo(comAtivas) {
  var todas = CW.state.connections || [];
  var conns = todas.filter(function (c) { return comAtivas || c.status === 'pending'; });
  var haAtivas = todas.some(function (c) { return c.status !== 'pending'; });
  var vazio = !CW._pulled ? 'Ainda não recebemos as ligações deste aparelho — aparecem quando a app sincronizar.'
    : (haAtivas ? '' : 'Ainda não tens ligações.');
  var linhas = conns.length ? conns.map(connCard).join('')
    : (vazio ? '<div class="pt-linha pt-vazio"><span class="small">' + vazio + '</span></div>' : '');
  /* o meu id, para o dar ao outro; o «Copiar» diz ao leitor de ecrã o que copia */
  var meu = CW.user && CW.user.id ? '<div class="pt-linha pt-meu"><span class="pt-txt"><span class="small">O teu id</span>' +
    '<b class="u-d-block pt-meuid">' + esc(CW.user.id) + '</b></span>' +
    '<span class="pt-acoes"><button type="button" class="btn sm" data-toca="nada" aria-label="Copiar o teu id" data-click="CW.copyId()">Copiar</button></span></div>' : '';
  var add = meu + '<div class="pt-linha pt-ligar"><div class="pt-ligar-campo">' +
    '<label class="u-fx-1 u-minw-0">O id do outro utilizador <span class="req">*</span>' +
    '<input id="cw_peer" class="u-tt-uppercase u-ff-monospace u-ls-2px" placeholder="Ex: A7KQ2MPX" maxlength="8" autocomplete="off"></label>' +
    '<button class="btn primary u-fx-0-0-auto" data-toca="dados" data-click="CW.addConn()">Ligar</button></div>' +
    '<p class="small">Ligar a outro utilizador: escreve o id que o outro utilizador te deu. Depois de aceite, cada um escolhe que casas partilha.</p></div>';
  var pedidos = pedidosCard();
  var ligacao = ligacaoCard();
  return '<div class="card pt-cartao">' + linhas + add + '</div>' +
    (pedidos ? '<div class="pt-mais">' + pedidos + '</div>' : '') +
    (ligacao ? '<div class="pt-mais">' + ligacao + '</div>' : '');
}

/* A partilha entre contas no separador Proprietários (lista-pessoas.js:
   partilhaDosDonos), por baixo da lista: a secção «Partilhar com outras
   contas» com o corpo de comproprietariosCorpo — o meu id e o campo de
   ligar —, sem as ligações ativas (estão na lista, por cima). Só com sessão
   e com o serviço Colaboradores, que é o da partilha entre contas: com ele
   desligado nesta conta fica, no lugar da secção, a frase que diz porquê e
   quem o liga (vivia na página da conta, que passou a ser só a Segurança;
   é aqui que se vem procurar o id).
   Recebe: nada.
   Devolve: o HTML da secção (texto), a nota sem o serviço, ou '' sem sessão. */
function comproprietariosHtml() {
  if (!CW.user) return '';
  if (!servicoLigado('colaboradores')) {
    return '<div class="pt-pagina pes-partilha"><p class="hint pt-nota">' + esc(hintServicoDesligado('colaboradores')) +
      ' A partilha entre contas fica disponível quando o suporte o ligar.</p></div>';
  }
  return '<div class="pt-pagina pes-partilha"><section class="pt-seccao" aria-labelledby="ptPartilha"><div class="pt-seccao-cab">' +
    '<h2 id="ptPartilha">Partilhar com outras contas</h2><p class="small">' + FRASE_DA_PARTILHA +
    ' Na ficha de cada um, em «Editar casas partilhadas», adicionas e removes casas e propões as quotas.</p></div>' +
    comproprietariosCorpo(false) + '</section></div>';
}
partilhaDosDonos = comproprietariosHtml;

/* Como partilho com outro proprietário com conta (pessoas.js:partilhaComDono):
   com uma ligação ativa, a ação abre «Casas partilhadas» dela
   (CW.sharesModal); sem ligação mas num grupo partilhado com ele, abre os
   meus imóveis do grupo (cloud/grupos.js:CW.casasDoGrupoCom, que carrega
   depois deste ficheiro — daí o typeof). Uma ligação por aceitar ainda não
   partilha nada. Com a ligação ativa vai também o id dela, para a ficha ter
   «Remover ligação» no ⋯ (pessoas.js:removerLigacaoDaFicha, que chama o
   CW.delConn). Só com sessão e com o serviço Colaboradores.
   Recebe: id — o id da conta do outro.
   Devolve: {act} (texto para o data-click), mais {ligacao} — o id da ligação
   ativa — quando há uma; ou null. */
function partilhaComDonoDaNuvem(id) {
  if (!CW.user || !servicoLigado('colaboradores') || !id) return null;
  var c = (CW.state.connections || []).find(function (x) { return x.status !== 'pending' && x.peer && x.peer.id === id; });
  if (c) return { act: "CW.sharesModal('" + jsq(c.id) + "')", ligacao: c.id };
  if (typeof gruposComDono === 'function' && gruposComDono(id).length) return { act: "CW.casasDoGrupoCom('" + jsq(id) + "')" };
  return null;
}
partilhaComDono = partilhaComDonoDaNuvem;

/* O HTML da página «Segurança» (a subpágina 'cloud' das Definições; o nome e
   o subtítulo vêm de SUBPAGE.cloud): só a segurança — mudar a palavra-passe,
   terminar sessão nos outros aparelhos, terminar sessão (com o email da
   conta, para se saber de qual se sai) e apagar a conta —, sem título por
   dentro, que o da página já o diz. O resto que aqui vivia mudou-se: o perfil
   está no cartão do topo das Definições (cartaoDoPerfil), o id e a partilha
   entre contas nas Pessoas › Proprietários (comproprietariosHtml), e os
   grupos partilhados no separador Grupos. Sem o separador dos Proprietários
   nesta conta (servicoLigado('owners') falso), a partilha entre contas fica
   aqui, numa secção à parte por baixo da segurança, que é o único sítio onde
   se chega a ela — com o id, as ligações todas, o campo de ligar, os pedidos
   e a ligação de partilha (comproprietariosCorpo); e, com o serviço
   Colaboradores desligado, a frase que diz porquê. Sem sessão iniciada,
   mostra apenas o convite para entrar.
   Recebe: nada; lê CW.user e CW.state.
   Devolve: string de HTML da página, pronta a inserir com innerHTML. */
function vCloud() {
  if (!CW.user) {
    return card('Segurança', 'Sem sessão iniciada',
      '<div class="hint">A palavra-passe, as sessões e o apagar da conta precisam de sessão iniciada.</div>' +
      '<div class="toolbar u-mt-11px"><button class="btn primary" data-toca="camada" data-click="CW.showAuth()">Iniciar sessão</button></div>');
  }
  /* uma linha que abre alguma coisa: botão de verdade, com a seta */
  var linhaQueAbre = function (rotulo, sub, act, extra) {
    return '<button type="button" class="pt-linha pt-abre' + (extra || '') + '" data-toca="camada"' +
      (extra ? ' data-risco="destroi"' : '') + ' data-click="' + act + '">' +
      '<span class="pt-txt"><b class="u-d-block">' + rotulo + '</b>' + (sub ? '<span class="small">' + sub + '</span>' : '') + '</span>' +
      '<span class="seta">' + ic('chevR', 20) + '</span></button>';
  };
  var conta = CW.user.email ? 'Entraste como ' + esc(CW.user.email) + '. Os dados ficam na conta' : 'Os dados ficam na conta';
  var seg = '<section class="pt-seccao" aria-label="Segurança"><div class="pt-seccao-cab"><p class="small">' +
      'A sessão dura 30 dias em cada aparelho. Mudar a palavra-passe ou fechar as outras sessões obriga os outros aparelhos a entrar de novo.</p></div>' +
    '<div class="card pt-cartao">' +
      linhaQueAbre('Mudar a palavra-passe', '', 'CW.passwordModal()') +
      linhaQueAbre('Terminar sessão nos outros aparelhos', '', 'CW.revokeSessions()') +
      linhaQueAbre('Terminar sessão', conta, 'CW.logout()') +
      linhaQueAbre('Apagar a conta', 'Apaga a conta e todos os teus dados. Não há volta atrás.', 'CW.deleteAccount()', ' pt-perigo') +
    '</div></section>';
  /* sem os Proprietários nesta conta, a partilha entre contas não tem outra casa */
  var partilha = '';
  if (!servicoLigado('owners')) {
    partilha = servicoLigado('colaboradores')
      ? '<section class="pt-seccao" aria-labelledby="ptPartilhaConta"><div class="pt-seccao-cab"><h2 id="ptPartilhaConta">Partilhar com outras contas</h2>' +
          '<p class="small">' + FRASE_DA_PARTILHA + '</p></div>' + comproprietariosCorpo(true) + '</section>'
      : '<p class="hint pt-nota">' + esc(hintServicoDesligado('colaboradores')) + ' A partilha entre contas fica disponível quando o suporte o ligar.</p>';
  }
  return '<div class="pt-pagina">' + seg + partilha + '</div>';
}

/* ---------------- ações da Segurança e da partilha entre contas ---------------- */

// Copia o id do utilizador para a área de transferência, para o dar a quem se
// quer ligar (o «O teu id» por baixo dos Proprietários), e o toast diz o que
// fazer com ele. Sem clipboard, ou com a cópia recusada pelo browser, não diz
// que copiou: diz o id, para se dar à mão (dizia «copiado» na mesma).
// Recebe: nada; lê CW.user.id.
// Devolve: nada — copia o id e mostra o toast.
CW.copyId = function () {
  var id = CW.user.id;
  var done = function () { toast('Id copiado. Dá-o ao outro utilizador para ele te ligar.'); };
  var falhou = function () { toast('Não deu para copiar. O teu id é ' + id + ': dá-o ao outro utilizador.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(done, falhou);
  else falhou();
};

/* Envia um convite de ligação para o id escrito no campo; fica pendente até
   o outro utilizador aceitar do lado dele. O campo vazio e o que o servidor
   recusa (o próprio id, um id que não existe) dizem-se junto do campo
   (componentes.js:falhaCampo), como no Entrar e no Novo pedido — era só um
   aviso em baixo, longe do campo e sem o marcar.
   Devolve: nada — envia o convite à API, sincroniza e repinta. */
CW.addConn = function () {
  var id = (val('cw_peer') || '').trim().toUpperCase();
  if (!id) return falhaCampo('cw_peer', 'Escreve o id que o outro utilizador te deu.');
  api('POST', '/api/connections', { peerId: id })
    .then(function () { toast('Convite enviado — falta o outro utilizador aceitar.'); return pullNow(true); })
    .then(function () { render(); })
    .catch(function (e) { falhaCampo('cw_peer', e.message || 'Não deu para enviar o convite.'); });
};

// Aceita o convite de ligação id e sincroniza logo, para o que o outro já partilhou aparecer.
// Recebe: id — o id da ligação (o convite), tal como vem da API.
// Devolve: nada — aceita na API, sincroniza e repinta.
CW.acceptConn = function (id) {
  api('POST', '/api/connections/' + id + '/accept')
    .then(function () { toast('Ligação aceite. Escolhe agora que casas queres partilhar.'); return pullNow(true); })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message); });
};

/* O que remover uma ligação leva, dito com números (contrato §4, a janela de
   confirmação): as casas que deixo de partilhar com o outro e as que recebo
   dele e deixam de aparecer, sem «casa(s)» e sem género (a app não sabe o
   de ninguém). Sem casas nenhuma, sai só a ligação.
   Recebe: c — a ligação ({peer, myShares, peerShares}).
   Devolve: o HTML da frase (texto, com o nome escapado). */
function fraseRemoverLigacao(c) {
  var nome = esc(c.peer.name || c.peer.email || c.peer.id);
  var mine = (c.myShares || []).length, theirs = (c.peerShares || []).length;
  var partes = [];
  if (mine) partes.push('deixas de partilhar ' + (mine === 1 ? '1 casa' : mine + ' casas') + ' com ' + nome);
  if (theirs) {
    var de = mine ? '' : ' de ' + nome;
    partes.push(theirs === 1 ? 'a casa que recebes' + de + ' deixa de aparecer' : 'as ' + theirs + ' casas que recebes' + de + ' deixam de aparecer');
  }
  var frase = partes.length ? partes.join(', e ') : 'ainda não partilham casas um com o outro: sai só a ligação';
  return frase.charAt(0).toUpperCase() + frase.slice(1) + '. Os dados de cada um não são apagados.';
}

/* Depois de remover uma ligação: se a janela de cima é a ficha do outro
   (pessoas.js:personView marca-a com o id dele) e ele já não está na lista
   dos Proprietários (pessoas.js:donosComPartilha — sem casa, ligação nem
   grupo em comum), a ficha fecha: ficava aberta sobre quem já não está na
   lista. Se ele fica (um grupo partilhado, uma casa em comum), o render já a
   repintou, sem o «Remover ligação» no ⋯.
   Recebe: peerId — o id da conta do outro.
   Devolve: nada. */
function fecharFichaDeQuemSaiu(peerId) {
  var top = peerId && typeof modalTop === 'function' ? modalTop() : null;
  if (!top || !top.ficha || top.ficha.dono !== peerId) return;
  if (typeof donosComPartilha === 'function' && donosComPartilha().some(function (o) { return o.id === peerId; })) return;
  closeModal();
}

/* Remove uma ligação, ou retira um convite (isPending). Convites saem sem
   perguntar; ligações feitas pedem confirmação, com o nome do outro e as
   casas que vão junto (fraseRemoverLigacao) — os dados de cada um não se
   apagam. O nome é «ligação», como no ⋯ e no resto da página («conexão» era
   o do Brasil). Removida a partir da ficha do outro (o ⋯ dela,
   pessoas.js:removerLigacaoDaFicha), a ficha fecha se ele saiu da lista
   (fecharFichaDeQuemSaiu).
   Recebe: id — o id da ligação ou do convite; isPending — verdadeiro quando
   ainda é só um convite (remove sem confirmar).
   Devolve: nada — remove na API, sincroniza e repinta. */
CW.delConn = function (id, isPending) {
  var c = ((CW.state && CW.state.connections) || []).find(function (x) { return x.id === id; });
  var peerId = c && c.peer ? c.peer.id : '';
  var doDel = function () {
    api('DELETE', '/api/connections/' + id)
      .then(function () { toast(isPending ? 'Convite removido.' : 'Ligação removida.'); return pullNow(true); })
      .then(function () { render(); if (!isPending) fecharFichaDeQuemSaiu(peerId); })
      .catch(function (e) { toast(e.message); });
  };
  if (isPending) return doDel();
  /* o confirmModal tira o rótulo do botão da primeira palavra do título:
     «Remover», vermelho cheio */
  if (!c || !c.peer) return confirmModal('Remover a ligação', 'Deixam ambos de ver as casas partilhadas um do outro. Os dados de cada um não são apagados.', doDel);
  confirmModal('Remover a ligação a ' + (c.peer.name || c.peer.email || c.peer.id), fraseRemoverLigacao(c), doDel);
};

/* Sair de um imóvel que não criei (DELETE /api/houses/:id/participacao): o
   colaborador deixa de colaborar nele, o comproprietário deixa de o ser e a
   quota dele vai para os restantes (o servidor decide qual dos dois sou). É
   o «Apagar imóvel» de quem não o criou (imovel.js:imvSair e
   cloud/selecao-listas.js:selLApagarImoveis). Não pergunta nada nem
   sincroniza: a confirmação e o pullNow são de quem chama.
   Recebe: houseId — o id do imóvel.
   Devolve: a promessa da resposta ({ok, como, ownerShares?}); rejeita com o erro do servidor. */
CW.sairDaCasa = function (houseId) {
  return api('DELETE', '/api/houses/' + encodeURIComponent(houseId) + '/participacao');
};

/* Pedir para transferir o controlo de uma ou várias casas que criei a um
   comproprietário delas (POST /api/transfers): só muda quem as gere na app,
   e nada muda até todos os comproprietários aceitarem. Não pergunta nem sincroniza: a folha
   (imovel.js:imvTransferir) valida, e o pullNow é de quem chama.
   Recebe: o — {houseIds: [...], toUserId}.
   Devolve: a promessa da resposta ({ok, lote}); rejeita com o erro do servidor. */
CW.pedirTransferencia = function (o) {
  o = o || {};
  return api('POST', '/api/transfers', { houseIds: (o.houseIds || []).slice(), toUserId: o.toUserId });
};

/* Pergunta ao servidor, sem pedir nada, quem fica ligado a esta pessoa se
   lhe transferir o controlo destas casas (POST /api/transfers/check): os
   comproprietários que chegam às casas por uma partilha e ainda não estão
   ligados a ela ficam ligados quando aceitarem. A folha
   (imovel.js:imvTrfVerificar) pergunta ao escolher quem recebe, e di-lo
   numa linha informativa.
   Recebe: o — {houseIds: [...], toUserId}.
   Devolve: a promessa de {ok, semLigacao: [{id, name}]}; rejeita com o erro do servidor. */
CW.verificarTransferencia = function (o) {
  o = o || {};
  return api('POST', '/api/transfers/check', { houseIds: (o.houseIds || []).slice(), toUserId: o.toUserId });
};

/* Cancelar um pedido para transferir o controlo que fiz (DELETE /api/transfers/:lote):
   saem todos os pendentes do lote. Não pergunta nem sincroniza.
   Recebe: lote — o id do lote (o pedido).
   Devolve: a promessa da resposta ({ok}); rejeita com o erro do servidor. */
CW.cancelarTransferencia = function (lote) {
  return api('DELETE', '/api/transfers/' + encodeURIComponent(lote));
};

/* Recusar um pedido para transferir o controlo que me chegou
   (POST /api/transfers/:lote/reject; qualquer comproprietário): o pedido
   cai nas casas de que sou comproprietário, e o servidor avisa quem pediu e
   os outros. Não pergunta nem sincroniza.
   Recebe: lote — o id do lote.
   Devolve: a promessa da resposta ({ok}); rejeita com o erro do servidor. */
CW.recusarTransferencia = function (lote) {
  return api('POST', '/api/transfers/' + encodeURIComponent(lote) + '/reject');
};

/* Aceitar um pedido para transferir o controlo que me chegou
   (POST /api/transfers/:lote/accept; qualquer comproprietário): regista o
   meu sim nas casas do lote de que sou comproprietário; cada casa com o sim
   de todos passa (aceites), as outras esperam por quem falta (aguardam), e
   a que já não vale vem em falhadas. Não pergunta nem sincroniza.
   Recebe: lote — o id do lote.
   Devolve: a promessa da resposta ({ok, aceites: [houseId], aguardam:
   [{houseId, faltam: [{id, name}]}], falhadas: [{houseId, error}]});
   rejeita com o erro do servidor. */
CW.aceitarTransferencia = function (lote) {
  return api('POST', '/api/transfers/' + encodeURIComponent(lote) + '/accept');
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

/* O bloco das quotas em campos, debaixo de uma casa no modal das partilhas,
   com as linhas do canvas (M-Quotas): «Pessoa» e «Quota» por cima, e uma
   linha por comproprietário mais o par — o nome à esquerda, o campo estreito
   com o % à direita. Serve a casa que se vai partilhar (a começar em partes
   iguais) e a nova divisão proposta para uma casa já partilhada (a começar
   na divisão atual), cada uma com a sua frase por baixo.
   Recebe: hid — o id da casa; peer — o outro utilizador {id, name, email};
   valores (opcional) — {userId: texto} escrito antes, ou a divisão de
   partida; nota (opcional) — a frase por baixo (por omissão, a da casa
   nova).
   Devolve: o HTML do bloco (texto). */
function quotasHtml(hid, peer, valores, nota) {
  var p = (db.properties || []).find(function (x) { return x.id === hid; });
  var quem = quotasDe(p, peer);
  var igual = dec(Math.round(1000 / quem.length) / 10);
  return '<div class="pt-quotas"><div class="pt-quotas-cab small" aria-hidden="true"><span>Pessoa</span><span>Quota</span></div>' + quem.map(function (u) {
    var v = valores && valores[u.id] != null ? valores[u.id] : igual;
    return '<label class="pt-quota"><span class="pt-quota-nome">' + esc(u.nome) + '</span>' +
      '<input id="cw_q_' + hid + '_' + u.id + '" type="text" inputmode="decimal" value="' + esc(v) + '" aria-label="' + esc(u.nome) + ', quota em %" autocomplete="off">' +
      '<span class="pt-pct" aria-hidden="true">%</span></label>';
  }).join('') +
    '<p class="hint">' + (nota || 'A divisão só entra em vigor depois de o outro confirmar; até lá fica em partes iguais.') + '</p></div>';
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

/* A divisão de uma casa já partilhada, no modal das partilhas: cada
   comproprietário com a quota em vigor e, havendo proposta por responder, a
   nova à frente (→ 60 %), como na ficha do imóvel (utilizadores.js:
   cwOwnersBlock). Por baixo, o que se pode fazer: a proposta que é minha (ou
   que já confirmei) diz de quem se espera e cancela-se; a de outro confirma-se
   ou rejeita-se, ali mesmo; sem proposta, «Propor nova divisão» abre os
   campos (quotasHtml) com a divisão atual, e o Guardar do modal envia-a.
   Recebe: hid — o id da casa.
   Devolve: o HTML (texto), ou '' numa casa que já não está partilhada. */
function quotasDaCasaHtml(hid) {
  var em = CW._partilha || {};
  var p = (db.properties || []).find(function (x) { return x.id === hid; });
  var parts = (p && p.ownerIds) || [];
  if (parts.length < 2) return '';
  var cur = sharesOf(p);
  var j = jsq(hid);
  if (em.propor && em.propor[hid]) {
    var partida = em.escrito[hid] || {};
    if (!em.escrito[hid]) parts.forEach(function (u) { partida[u] = dec(Math.round((cur[u] || 0) * 1000) / 10); });
    return quotasHtml(hid, em.peer, partida, 'A nova divisão só entra em vigor depois de todos os comproprietários confirmarem.') +
      '<div class="pt-botoes"><button type="button" class="btn sm" data-toca="rascunho" data-click="CW.shareProporFechar(\'' + j + '\')">Não propor</button></div>';
  }
  var myId = CW.user ? CW.user.id : '';
  var prp = ((CW.state && CW.state.proposals) || []).filter(function (x) { return x.houseId === hid; })[0];
  var nome = function (u) { return esc((owner(u) || { name: u }).name || u) + (u === myId ? ' (tu)' : ''); };
  var linhas = parts.map(function (u) {
    var novo = prp ? ' <span class="u-c-v-warn">→ ' + dec(Math.round((Number(prp.shares[u]) || 0) * 100) / 100) + '%</span>' : '';
    return '<div class="pt-quota"><span class="pt-quota-nome">' + nome(u) + '</span><b class="num">' + pct(cur[u] || 0, 0) + novo + '</b></div>';
  }).join('');
  var pe;
  if (prp && (prp.approvals || []).indexOf(myId) < 0) {
    pe = '<p class="hint"><b>' + esc(prp.proposedByName || 'Outro comproprietário') + '</b> propôs esta nova divisão. Só entra em vigor quando todos confirmarem.</p>' +
      '<div class="pt-botoes"><button type="button" class="btn primary sm" data-toca="dados" data-click="CW.shareResponder(\'' + j + '\',1)">Confirmar nova divisão</button>' +
      '<button type="button" class="btn sm" data-toca="dados" data-click="CW.shareResponder(\'' + j + '\',0)">Rejeitar</button></div>';
  } else if (prp) {
    var falta = parts.filter(function (u) { return (prp.approvals || []).indexOf(u) < 0; }).map(nome);
    pe = '<p class="hint">Nova divisão proposta — à espera de: <b>' + falta.join(', ') + '</b>.</p>' +
      '<div class="pt-botoes"><button type="button" class="btn sm" data-toca="dados" data-click="CW.shareResponder(\'' + j + '\',0)">Cancelar proposta</button></div>';
  } else {
    pe = '<div class="pt-botoes"><button type="button" class="btn sm" data-toca="rascunho" data-click="CW.shareProporAbrir(\'' + j + '\')">Propor nova divisão</button></div>';
  }
  return '<div class="pt-quotas"><div class="pt-quotas-cab small" aria-hidden="true"><span>Pessoa</span><span>Quota</span></div>' + linhas + pe + '</div>';
}

/* Repinta, no modal das partilhas, o bloco debaixo de uma casa: a casa nova
   marcada leva os campos das quotas (com o que lá estava escrito, se já
   tinha sido marcada); a já partilhada e marcada, a divisão
   (quotasDaCasaHtml); a já partilhada e desmarcada, a frase de que o outro
   deixa de a ver; a nova desmarcada, nada. As casas do outro não têm caixa
   e levam sempre a divisão.
   Recebe: hid — o id da casa.
   Devolve: nada — escreve o bloco #cw_qb_<hid>. */
function pintarBlocoDaCasa(hid) {
  var em = CW._partilha, bloco = document.getElementById('cw_qb_' + hid);
  if (!em || !bloco) return;
  var caixa = document.getElementById('cw_sh_' + hid);
  var ja = em.antes.indexOf(hid) > -1;
  if (!caixa || caixa.checked) { bloco.innerHTML = ja || !caixa ? quotasDaCasaHtml(hid) : quotasHtml(hid, em.peer, em.escrito[hid]); return; }
  bloco.innerHTML = ja
    ? '<p class="hint pt-sai">Ao guardar, ' + esc(em.peer.name || em.peer.email || em.peer.id) + ' deixa de ver esta casa e de ter quota nela.</p>'
    : '';
}

/* Guarda o que está escrito nos campos das quotas de uma casa, antes de os
   tirar do modal, para voltarem iguais se a pessoa mudar de ideias.
   Recebe: hid — o id da casa.
   Devolve: nada — guarda em CW._partilha.escrito. */
function guardarEscrito(hid) {
  var em = CW._partilha;
  var p = (db.properties || []).find(function (x) { return x.id === hid; });
  em.escrito[hid] = quotasEscritas(hid, quotasDe(p, em.peer)).texto;
}

/* Ao marcar ou desmarcar uma casa minha no modal das partilhas: a nova
   ganha (ou perde) os campos das quotas; a já partilhada perde a divisão e
   ganha a frase de que o outro deixa de a ver (ou volta ao que era). O que
   estava escrito guarda-se para o caso de voltar.
   Recebe: hid — o id da casa.
   Devolve: nada — repinta o bloco dessa casa. */
CW.shareCasaMudou = function (hid) {
  var em = CW._partilha, caixa = document.getElementById('cw_sh_' + hid);
  if (!em || !caixa) return;
  var ja = em.antes.indexOf(hid) > -1;
  if (!caixa.checked && (!ja || em.propor[hid])) guardarEscrito(hid);
  pintarBlocoDaCasa(hid);
};

/* «Propor nova divisão» numa casa já partilhada, no modal das partilhas:
   abre os campos com a divisão atual; o Guardar do modal envia a proposta.
   Recebe: hid — o id da casa.
   Devolve: nada — repinta o bloco dessa casa. */
CW.shareProporAbrir = function (hid) {
  if (!CW._partilha) return;
  CW._partilha.propor[hid] = true;
  pintarBlocoDaCasa(hid);
};

/* «Não propor»: fecha os campos da nova divisão sem enviar nada — o que lá
   estava escrito fica guardado, se se voltar a abrir.
   Recebe: hid — o id da casa.
   Devolve: nada — repinta o bloco dessa casa. */
CW.shareProporFechar = function (hid) {
  if (!CW._partilha) return;
  guardarEscrito(hid);
  CW._partilha.propor[hid] = false;
  pintarBlocoDaCasa(hid);
};

/* Confirmar, rejeitar ou cancelar a proposta de divisão de uma casa, sem
   sair do modal das partilhas (utilizadores.js:CW.answerProposal fala com a
   API); depois repinta o bloco da casa com o que o servidor diz.
   Recebe: hid — o id da casa; accept — 1 confirma, 0 rejeita ou cancela.
   Devolve: a promessa (resolve depois de repintar). */
CW.shareResponder = function (hid, accept) {
  return Promise.resolve(CW.answerProposal(hid, accept)).then(function () { pintarBlocoDaCasa(hid); });
};

/* A divisão escrita nos campos de uma casa, validada.
   Recebe: p — a casa; peer — o par da ligação.
   Devolve: {erro} com a frase do que está mal, ou {quem, q} com os
   comproprietários e o que está escrito (quotasEscritas). */
function divisaoEscrita(p, peer) {
  var nome = p.name || 'Sem nome', quem = quotasDe(p, peer), q = quotasEscritas(p.id, quem);
  if (q.invalida) return { erro: 'Percentagens inválidas em ' + nome + '.' };
  if (Math.abs(q.total - 100) > 0.5) return { erro: 'As percentagens de ' + nome + ' têm de somar 100 (agora somam ' + dec(Math.round(q.total * 100) / 100) + ').' };
  return { quem: quem, q: q };
}

/* O modal da partilha com a ligação connId: o que partilho com o outro e o
   que ele partilha comigo. Nas minhas casas, a caixa adiciona ou remove a
   casa da partilha — a nova traz as quotas ao marcá-la, a que deixa de ser
   partilhada diz que o outro deixa de a ver —, e cada casa partilhada (as
   minhas e as dele) mostra a divisão em vigor, com a proposta por responder
   e o «Propor nova divisão» (quotasDaCasaHtml). Ao guardar valida as quotas
   escritas antes de gravar o que quer que seja, envia a lista à API e segue
   as propostas (enviarProposta): a das casas novas cuja divisão não seja em
   partes iguais e a das partilhadas onde se abriu uma nova divisão diferente
   da atual — sem passar pela fila _shareQueue, que fica para a ficha do
   imóvel.
   Recebe: connId — o id da ligação.
   Devolve: nada — abre o modal; o guardar acontece no onSave. */
CW.sharesModal = function (connId) {
  var c = (CW.state.connections || []).find(function (x) { return x.id === connId; });
  if (!c) return;
  var nomePar = c.peer.name || c.peer.email || c.peer.id;
  // só os imóveis que criei eu: nunca os de colaboração nem os que outro partilhou comigo
  var myHouses = (db.properties || []).filter(function (p) { return cwMinha(p); });
  var dele = (c.peerShares || []).map(function (id) { return (db.properties || []).find(function (p) { return p.id === id; }); }).filter(Boolean);
  var before = (c.myShares || []).slice();
  // o que os blocos precisam: o par, as casas que já partilhava, o escrito de cada casa e as divisões abertas
  CW._partilha = { peer: c.peer, antes: before, escrito: {}, propor: {} };
  var cartao = function (p, caixa) {
    return '<div class="card u-p-12px-13px">' + (caixa
      ? '<label class="u-d-flex u-g-11px u-ai-center u-cur-pointer">' +
        '<input type="checkbox" class="u-w-18px u-h-18px" id="cw_sh_' + p.id + '" ' + (before.indexOf(p.id) > -1 ? 'checked ' : '') +
        'data-toca="rascunho" data-change="CW.shareCasaMudou(\'' + jsq(p.id) + '\')">'
      : '<div class="u-minw-0">') +
      '<span class="u-minw-0"><b class="u-d-block">' + esc(p.name || 'Sem nome') + '</b>' +
      '<span class="small">' + esc(p.address || '') + '</span></span>' + (caixa ? '</label>' : '</div>') +
      '<div id="cw_qb_' + p.id + '">' + (caixa && before.indexOf(p.id) < 0 ? '' : quotasDaCasaHtml(p.id)) + '</div></div>';
  };
  var minhas = myHouses.length
    ? '<div class="hint">Casas que partilhas com ' + esc(nomePar) + ': passa a ver e editar tudo o que lhes pertence — contratos, movimentos e pessoas. ' +
      'Marca para adicionar, desmarca para remover.</div>' +
      '<div class="list u-g-8px">' + myHouses.map(function (p) { return cartao(p, true); }).join('') + '</div>'
    : '<div class="hint">Ainda não tens casas para partilhar.</div>';
  var recebidas = dele.length
    ? '<div class="section-title">O que ' + esc(nomePar) + ' partilha contigo</div>' +
      '<div class="list u-g-8px">' + dele.map(function (p) { return cartao(p, false); }).join('') + '</div>'
    : '';
  openModal('Partilha com ' + nomePar, '<div class="form">' + minhas + recebidas + '</div>');
  onSave = function () {
    var ids = myHouses.filter(function (p) {
      var e = document.getElementById('cw_sh_' + p.id);
      return e && e.checked;
    }).map(function (p) { return p.id; });
    var em = CW._partilha;
    // as quotas validam-se todas antes de gravar o que quer que seja
    var propostas = [];
    var casas = ids.map(function (id) { return myHouses.find(function (x) { return x.id === id; }); }).concat(dele);
    for (var i = 0; i < casas.length; i++) {
      var p = casas[i], nova = dele.indexOf(p) < 0 && before.indexOf(p.id) < 0;
      if (!nova && !em.propor[p.id]) continue;
      var d = divisaoEscrita(p, c.peer);
      if (d.erro) return toast(d.erro);
      var cur = sharesOf(p);
      var partida = function (u) { return nova ? 100 / d.quem.length : (cur[u] || 0) * 100; };
      // igual ao ponto de partida (partes iguais na nova, a divisão atual na partilhada): não há nada para confirmar
      var diferente = d.quem.some(function (u) { return Math.abs(d.q.shares[u.id] - partida(u.id)) >= 0.1; });
      if (diferente) propostas.push({ hid: p.id, nome: p.name || 'Sem nome', shares: d.q.shares });
    }
    var mudou = ids.length !== before.length || ids.some(function (id) { return before.indexOf(id) < 0; });
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
          toast((mudou ? 'Partilha atualizada, mas a proposta de divisão não seguiu — ' : 'A proposta de divisão não seguiu — ') +
            falhas.join('; ') + '. Podes propô-la na ficha do imóvel.', { ms: 7000 });
        } else if (n) {
          toast((mudou ? 'Partilha atualizada. ' : '') + (n === 1 ? 'A proposta de divisão seguiu — falta a confirmação do outro comproprietário.'
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
   medida que se escreve — a mesma caixa do registo (entrada.js:pintarRequisitos:
   o visto verde e o círculo vazio, desenhados pelo ic e não por caracteres).
   Quem entra com Google deixa o campo da atual vazio.
   Recebe: nada.
   Devolve: nada — abre o modal e liga os requisitos ao campo. */
CW.passwordModal = function () {
  var body = '<div class="form">' +
    '<div class="hint">Ao mudar a palavra-passe, todos os outros aparelhos têm de iniciar sessão de novo. ' +
    'Este continua ligado.</div>' +
    '<label>Palavra-passe atual<input id="cw_pw_cur" type="password" autocomplete="current-password" placeholder="Opcional"></label>' +
    '<div class="hint u-m-n4px-0-0">Só fica vazia se entras com o Google.</div>' +
    '<label>Nova palavra-passe <span class="req">*</span><input id="cw_pw_new" type="password" autocomplete="new-password" aria-describedby="cw_pw_req"></label>' +
    '<div id="cw_pw_req" class="ent-reqs"></div>' +
    '<label>Confirmar nova palavra-passe <span class="req">*</span><input id="cw_pw_new2" type="password" autocomplete="new-password"></label>' +
    '<div id="cw_pw_err" class="small u-c-v-danger" role="alert"></div></div>';
  openModal('Mudar palavra-passe', body,
    '<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>' +
    '<button class="btn primary" data-toca="dados" data-click="CW.savePassword()">Guardar</button>');
  var inp = document.getElementById('cw_pw_new');
  if (typeof pintarRequisitos !== 'function' || !inp) return;
  pintarRequisitos('', 'cw_pw_req');
  inp.addEventListener('input', function () { pintarRequisitos(inp.value, 'cw_pw_req'); });
};

/* O erro da palavra-passe nova junto do campo (componentes.js:falhaCampo),
   sem lhe tirar a ligação à caixa dos requisitos: o falhaCampo troca o
   aria-describedby pelo id do erro, e aqui fica com os dois enquanto o erro
   está à vista, e volta só aos requisitos à primeira tecla.
   Recebe: msg — a frase do erro.
   Devolve: nada — marca o campo #cw_pw_new com o erro por baixo. */
function falhaPalavraNova(msg) {
  falhaCampo('cw_pw_new', msg);
  var e = document.getElementById('cw_pw_new');
  if (!e || typeof e.insertAdjacentElement !== 'function') return;
  e.setAttribute('aria-describedby', 'cw_pw_new-erro cw_pw_req');
  e.addEventListener('input', function () { e.setAttribute('aria-describedby', 'cw_pw_req'); }, { once: true });
}

/* Valida a nova palavra-passe e envia a mudança à API; o servidor termina as
   sessões dos outros aparelhos e põe a nova deste no cookie
   (nucleo.js:sessaoRodada acerta o que o aparelho guarda). O que se pode
   dizer antes de perguntar ao servidor diz-se junto do campo (a palavra-passe
   fraca na nova, o desencontro na confirmação); o que o servidor responde
   fica no fundo do modal — incluindo a palavra-passe atual errada, que não
   encerra a sessão (nucleo.js:sessaoCaiu).
   Devolve: nada — envia a mudança à API e fecha o modal quando corre bem. */
CW.savePassword = function () {
  var e = document.getElementById('cw_pw_err');
  e.textContent = '';
  var next = val('cw_pw_new');
  var prob = passProblem(next);
  if (prob) return falhaPalavraNova(prob);
  if (next !== val('cw_pw_new2')) return falhaCampo('cw_pw_new2', 'As palavras-passe não coincidem.');
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
    '<div class="hint">Nas casas de outras pessoas onde tenhas ficado registado (num movimento pago por ti, por exemplo), o teu nome ' +
    'passa a aparecer como <b>[deleted]</b>. As casas que os outros partilharam contigo deixam de estar ligadas a ti — os dados deles não são apagados.</div>' +
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

SUBPAGE.cloud = { label: 'Segurança', sub: 'Palavra-passe, sessões e apagar a conta' };
SUBPAGE.legal = { label: 'Aviso legal', sub: 'Condições de utilização e privacidade' };
SUBPAGE.ajuda = { label: 'Ajuda e sugestões', sub: 'Como se faz, apresentações e pedidos' };
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
   Cada resposta aponta o caminho concreto na app, não teoria. Ficam numa
   lista só, e não escritas na página: a Ajuda mostra as que estão em
   destaque (cloud/ajuda.js:vAjuda) e a página das perguntas mostra-as
   todas (vFaq). A resposta é HTML de confiança, escrito aqui. */
var PERGUNTAS_FREQUENTES = [
  { id: 'apagar', destaque: true, pergunta: 'Apaguei uma coisa por engano. Consigo recuperar?', resposta: 'Logo a seguir a apagar aparece um <b>«Anular»</b> no fundo do ecrã, durante seis segundos — repõe tudo, incluindo cascatas (um imóvel com os contratos e movimentos). Passado esse tempo, só repondo uma cópia de segurança que tenhas guardado em <b>Definições → Importar e cópias</b>.' },
  { id: 'renda', destaque: true, pergunta: 'Como faço para a renda aparecer sozinha todos os meses?', resposta: 'Cria o contrato com a renda mensal: a app gera um <b>movimento planeado</b> que aparece todos os meses na Visão geral, no cartão «Por confirmar». Um toque em <b>Confirmar</b> regista a renda — não escreves nada.' },
  { id: 'partilha', destaque: true, pergunta: 'Como partilho as casas com o comproprietário?', resposta: 'A outra pessoa cria conta. Em <b>Pessoas → Proprietários</b>, por baixo da lista, cada um tem o seu id de 8 caracteres, com «Copiar», e logo por baixo o campo para o id do outro: um de vocês escreve lá o id do outro, e o outro aceita. Depois, em «Casas partilhadas», cada um adiciona e remove as casas que partilha e propõe as quotas — a divisão só muda quando todos confirmarem. Há também a <b>ligação de partilha</b>: quem a abrir escolhe que imóveis partilha contigo, e tu aceitas ou recusas cada pedido.' },
  { id: 'colaborador', destaque: true, pergunta: 'Como dou acesso a um gestor sem o tornar comproprietário?', resposta: 'Convida-o como <b>colaborador</b>: em <b>Pessoas → Colaboradores</b>, crias um cargo (o que pode ver e adicionar — movimentos, visitas, contratos, documentos…) e uma ligação de convite com esse cargo e os imóveis. Quem a abrir entra (ou cria conta) e fica logo com o acesso. Não tem quota-parte, não entra nas contas entre proprietários, e só edita o que ele próprio adicionar. Podes mudar-lhe o cargo ou removê-lo quando quiseres.' },
  { id: 'dados', pergunta: 'Os meus dados estão seguros?', resposta: 'Ficam numa base de dados na nuvem com cópias de segurança diárias, e também no teu aparelho. Mesmo assim, mantém as tuas próprias cópias: <b>Definições → Importar e cópias → Guardar cópia</b>. Nenhuma nuvem substitui uma cópia tua.' },
  { id: 'fotos', pergunta: 'As fotografias e documentos sincronizam entre aparelhos?', resposta: 'Sim — desde que tenhas sessão iniciada, os anexos sobem para a nuvem e descem nos outros aparelhos. Se um anexo não subir (por tamanho ou falha), a app avisa e ele fica só nesse aparelho até conseguir.' },
  { id: 'password', pergunta: 'Esqueci-me da palavra-passe. E agora?', resposta: 'No ecrã de entrada, toca em <b>«Esqueci-me da palavra-passe»</b>: enviamos-te uma ligação por email (vale 1 hora, uma só vez) para definires uma nova. Serve também a quem sempre entrou com a Google e quer passar a ter palavra-passe.' },
  { id: 'varios', pergunta: 'Como apago ou edito vários movimentos de uma vez?', resposta: 'Faz um <b>toque longo</b> num movimento, imóvel ou contrato: entra em modo de seleção. Marca o que quiseres — há caixas por mês e uma global — e usa a barra no fundo do ecrã.' },
  { id: 'pdf', pergunta: 'O contrato em PDF serve para assinar?', resposta: 'É uma <b>minuta genérica</b>, não validada por advogado. Usa-a como ponto de partida e pede revisão profissional antes de assinar — a lei do arrendamento muda e cada caso é um caso.' },
  { id: 'tema', pergunta: 'A app não muda para o modo escuro do telemóvel', resposta: 'Em <b>Definições → Tema</b>, escolhe «Automático». No Samsung Internet, o browser escurece as páginas à força e a app pode aparecer clara: em <b>Samsung Internet → Definições → Labs → Usar o tema escuro do site</b>, o Automático passa a seguir o telemóvel; ou escolhe «Escuro» aqui. A escolha é por aparelho.' },
  { id: 'instalar', pergunta: 'Como instalo a app no telemóvel?', resposta: 'Android: no fim das <b>Definições</b> está o APK, ou usa «Adicionar ao ecrã principal» no browser. iPhone: Safari → Partilhar → <b>Adicionar ao ecrã principal</b>.' },
  { id: 'conta', pergunta: 'Como apago a minha conta?', resposta: 'Em <b>Definições → Segurança → Apagar a conta</b>. É definitivo: apaga imóveis, contratos, movimentos e ligações. Nas casas partilhadas, o teu nome passa a «[deleted]» para os outros.' },
];

var perguntasAbertas = {};   // que perguntas estão abertas (vale enquanto a app está aberta)

/* Uma pergunta que abre e fecha (o .fq do canvas M-Ajuda): a pergunta num
   botão da largura toda, com a seta, e a resposta por baixo, escondida
   enquanto está fechada. O botão diz se está aberto (aria-expanded) e qual
   é a resposta (aria-controls).
   Recebe: q — a pergunta ({id, pergunta, resposta}).
   Devolve: o HTML da pergunta (texto). */
function perguntaHtml(q) {
  var aberta = !!perguntasAbertas[q.id];
  return '<button type="button" class="aj-fq" id="aj_fq_' + q.id + '" aria-expanded="' + aberta + '" aria-controls="aj_fr_' + q.id + '" ' +
    'data-toca="nada" data-click="CW.perguntaAbrir(\'' + q.id + '\')"><span>' + esc(q.pergunta) + '</span>' + ic('chevD', 18) + '</button>' +
    '<div class="aj-fr" id="aj_fr_' + q.id + '"' + (aberta ? '' : ' hidden') + '>' + q.resposta + '</div>';
}

/* Abre ou fecha uma pergunta, onde quer que ela esteja à vista (a Ajuda ou
   a página das perguntas), sem repintar a página — o scroll fica onde está.
   Recebe: id — o id da pergunta em PERGUNTAS_FREQUENTES.
   Devolve: nada — muda o aria-expanded do botão e o hidden da resposta. */
CW.perguntaAbrir = function (id) {
  perguntasAbertas[id] = !perguntasAbertas[id];
  var b = document.getElementById('aj_fq_' + id), r = document.getElementById('aj_fr_' + id);
  if (b) b.setAttribute('aria-expanded', perguntasAbertas[id] ? 'true' : 'false');
  if (r) r.hidden = !perguntasAbertas[id];
};

/* A página das perguntas frequentes: todas, num cartão, cada uma a abrir e
   fechar; por baixo, a porta para a Ajuda, para quem não encontrar a sua.
   Recebe: nada.
   Devolve: string de HTML da página, pronta a inserir com innerHTML. */
function vFaq() {
  return '<div class="card aj-perguntas">' + PERGUNTAS_FREQUENTES.map(perguntaHtml).join('') + '</div>' +
    '<p class="small aj-rodape">Se a tua não estiver aqui, conta-nos em <a href="#" data-toca="ecra" data-click="event.preventDefault();goSet(\'ajuda\')">Ajuda e sugestões</a>.</p>';
}
