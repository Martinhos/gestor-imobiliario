/* Paginas Conta e partilha (id, ligacoes, seguranca e apagar a conta) e
   Colaboradores (cargos, convites e quem colabora em cada imovel). */
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
  if (setPage === 'tema') {
    var t = db.settings.theme;
    return backRow + card('Tema', 'Como a app se apresenta',
      '<div class="seg c3">' +
      // o subtítulo do automático diz o que ele está a resolver agora: sem
      // isso, um browser que não passa a preferência do sistema parece um
      // erro da app
      [['auto', 'auto', 'Automático', 'agora: ' + (mq().matches ? 'escuro' : 'claro')],
        ['light', 'sun', 'Claro', ''], ['dark', 'moon', 'Escuro', '']]
        .map(function (o) {
          return '<button type="button" class="opt ' + (t === o[0] ? 'on' : '') + '" data-toca="dados" onclick="setTheme(\'' + o[0] + '\')">' +
            '<span class="ic">' + ic(o[1], 18) + '</span><b>' + o[2] + '</b>' +
            (o[3] ? '<small>' + o[3] + '</small>' : '') + '</button>';
        }).join('') + '</div>' +
      '<div class="hint" style="margin-top:11px">Vale só neste aparelho.</div>' +
      (t === 'auto' && !mq().matches
        ? '<div class="hint" style="margin-top:9px">O automático segue o que o browser diz preferir, e este está a dizer <b>claro</b>. ' +
          'Se tens o aparelho em escuro, é o browser que não está a passar a preferência. No browser da Samsung há duas opções, ' +
          'e o modo escuro sozinho pode não chegar: <b>Definições → Visualização e deslocamento de página → Modo escuro</b>, e ' +
          '<b>Definições → Labs → Usar tema escuro do site</b>. Se mesmo assim ficar em claro, escolhe <b>Escuro</b> aqui — ' +
          'essa opção não depende do browser e funciona sempre.</div>'
        : ''));
  }
  var h = _vSettings();
  if (!setPage) {
    // raiz reorganizada: conta, aplicação, dados e sobre — em vez de uma
    // lista corrida de dez entradas sem hierarquia
    var meP = CW.user && (db.owners || []).find(function (o) { return o.id === CW.user.id; });
    var psub = meP && meP.nif ? esc(meP.name) + ' · NIF preenchido' : 'Nome, NIF e contactos para os contratos';
    var conta = CW.user ? (CW.user.name || CW.user.email) + ' · id ' + CW.user.id : 'Inicia sessão';
    var cs = cats(), csIn = catsIn();
    var nCats = Object.keys(cs).length + Object.keys(csIn).length;
    var sect = function (t) { return '<div class="section-title">' + t + '</div>'; };
    var gap = '<div style="height:10px"></div>';
    var tema = { auto: 'Automático', light: 'Claro', dark: 'Escuro' }[db.settings.theme] || 'Automático';

    h = sect('Conta') +
      '<div class="card tap" data-toca="camada" onclick="CW.editProfile()" style="display:flex;align-items:center;gap:13px">' +
      '<span class="avatar">' + ic('crown', 18) + '</span>' +
      '<span style="flex:1;min-width:0"><b style="display:block">O meu perfil</b><span class="small">' + psub + '</span></span>' +
      '<span style="color:var(--muted);transform:rotate(180deg)">' + ic('chev', 18) + '</span></div>' + gap +
      navRow('Conta e partilha', conta, 'users', 'cloud') +

      sect('Aplicação') +
      navRow('Tema', tema, 'sun', 'tema') + gap +
      navRow('Valores por omissão', 'Aumentos, inflação e imposto do selo', 'trend', 'defaults') +

      sect('Dados') +
      navRow('Tipos de movimento', nCats + ' categorias', 'swap', 'cats') + gap +
      navRow('Etiquetas', (db.settings.tags || []).length + ' etiquetas', 'tag', 'tags') + gap +
      navRow('Grupos', (db.groups || []).length + ' grupos', 'users', 'groups') + gap +
      navRow('Importar e cópias', 'Splitwise, cópias de segurança e recomeçar', 'down', 'dados') +

      sect('Ajuda') +
      navRow('Ajuda e sugestões', 'Contar um problema ou pedir uma melhoria', 'info', 'ajuda') +

      sect('Sobre') +
      navRow('Perguntas frequentes', 'As dúvidas mais comuns, respondidas', 'info', 'faq') + gap +
      navRow('Aviso legal', 'Termos e privacidade', 'contract', 'legal') + gap +
      card('Rendorium', 'Versão ' + VERSAO,
        '<div class="stat"><span>Imóveis · contratos</span><b>' + db.properties.length + ' · ' + db.contracts.length + '</b></div>' +
        '<div class="stat"><span>Inquilinos</span><b>' + db.tenants.length + '</b></div>' +
        '<div class="stat" style="border:0"><span>Movimentos</span><b>' + db.transactions.length + '</b></div>');
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var standalone = false;
    try { standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; } catch (e) {}
    if (isIOS) {
      h += '<div style="height:14px"></div>' +
        card('App no iPhone', 'Adicionar ao ecrã principal', standalone
          ? '<div class="hint">Já estás a usar a app instalada no ecrã principal. 👍</div>'
          : '<div class="hint">No iPhone a instalação faz-se pelo Safari (não aparece nenhum aviso automático):</div>' +
            '<div class="list" style="gap:7px;margin-top:9px">' +
            '<div class="small"><b>1.</b> Abre este site no <b>Safari</b> — se estiveres dentro de outra app (WhatsApp, Gmail, Instagram…), toca no ícone do browser para abrir no Safari a sério.</div>' +
            '<div class="small"><b>2.</b> Toca no botão <b>Partilhar</b> (quadrado com seta para cima, na barra de baixo).</div>' +
            '<div class="small"><b>3.</b> Desliza e escolhe <b>“Adicionar ao ecrã principal”</b> e confirma.</div></div>' +
            '<div class="hint" style="margin-top:9px">No Chrome do iPhone: menu <b>⋯</b> → “Adicionar ao ecrã inicial”. A opção não existe em janelas privadas.</div>');
    } else if (!window.Android) {
      h += '<div style="height:14px"></div>' +
        card('App para Android', 'A mesma app no telemóvel',
          '<div class="hint">Instala a app nativa: é o mesmo gestor, com notificações dos movimentos por confirmar e o seletor de ficheiros do Android (Google Drive incluído). Ao abrir o APK, o Android pede para autorizares a instalação de apps fora da Play Store — é normal.</div>' +
          '<div class="toolbar" style="margin-top:11px"><a class="btn primary" href="/gestor-imobiliario.apk" download style="text-decoration:none" data-toca="nada">' + ic('down', 16) + ' Descarregar APK</a></div>');
    }
  }
  return h;
};

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
    lines = '<div class="small">Quer ligar-se a ti. Se aceitares, cada um pode escolher que casas partilha com o outro.</div>';
    btns = '<button class="btn primary sm" data-toca="dados" onclick="CW.acceptConn(\'' + c.id + '\')">Aceitar</button>' +
      '<button class="btn sm danger" data-toca="dados" onclick="CW.delConn(\'' + c.id + '\',1)">Recusar</button>';
  } else if (c.status === 'pending') {
    lines = '<div class="small">À espera que aceite o convite.</div>';
    btns = '<button class="btn sm danger" data-toca="dados" onclick="CW.delConn(\'' + c.id + '\',1)">Cancelar</button>';
  } else {
    var mine = (c.myShares || []).length, theirs = (c.peerShares || []).length;
    lines = '<div class="small">Partilhas <b>' + mine + '</b> casa' + (mine === 1 ? '' : 's') +
      ' · recebe' + 's' + ' <b>' + theirs + '</b> casa' + (theirs === 1 ? '' : 's') + ' de ' + peer + '</div>';
    btns = '<button class="btn primary sm" data-toca="camada" onclick="CW.sharesModal(\'' + c.id + '\')">Escolher casas</button>' +
      '<button class="btn sm danger" data-toca="dados" data-risco="destroi" onclick="CW.delConn(\'' + c.id + '\')">Remover</button>';
  }
  // os botões ficam numa linha própria: encostados ao texto, tapavam-no em ecrãs estreitos
  return '<div class="card" style="padding:13px 14px">' +
    '<div style="min-width:0"><div class="title">' + peer + '</div>' +
    '<div class="small">id ' + esc(c.peer.id) + '</div></div>' +
    lines +
    '<div class="toolbar" style="margin-top:10px">' + btns + '</div></div>';
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
  var sl = CW.state.shareLink;
  var ativa = !!(sl && (sl.ativo || sl.url));
  var usos = Number(sl && sl.uses) || 0;
  var corpo = ativa
    ? '<div class="stat"><span>Estado</span><b>Ativa</b></div>' +
      '<div class="stat" style="border:0"><span>Pedidos chegados por aqui</span><b>' + usos + '</b></div>' +
      '<div class="toolbar" style="margin-top:11px">' +
      '<button class="btn primary" data-toca="nada" onclick="CW.ligacaoCopiar()">Copiar ligação</button>' +
      '<button class="btn" data-toca="dados" onclick="CW.ligacaoRodar()">Rodar</button>' +
      '<button class="btn danger" data-toca="dados" onclick="CW.ligacaoDesativar()">Desativar</button></div>'
    : '<div class="toolbar"><button class="btn primary" data-toca="dados" onclick="CW.ligacaoCriar()">' + ic('key', 15) + ' Criar ligação</button></div>';
  return card('A minha ligação de partilha', 'Uma ligação tua, em vez do id',
    corpo +
    '<div class="hint" style="margin-top:11px">Quem a abrir escolhe que imóveis partilha contigo; tu aceitas ou recusas cada pedido. ' +
    'Não tem prazo: podes rodá-la ou desativá-la quando quiseres.</div>');
}

// O cartão «Pedidos de partilha»: os recebidos, com aceitar e recusar, e os
// que enviei e ainda esperam. Vazio quando não há nenhum.
// Devolve: o HTML do cartão (texto), ou '' sem pedidos.
function pedidosCard() {
  var sr = CW.state.shareRequests || {};
  var inc = sr.incoming || [], out = sr.outgoing || [];
  if (!inc.length && !out.length) return '';
  var linhas = inc.map(function (p) {
    return '<div class="card" style="padding:12px 13px"><b style="display:block">' + esc(p.fromName || '') + ' quer partilhar ' + esc(p.houseName || 'um imóvel') + ' contigo</b>' +
      '<span class="small">Se aceitares, passas a comproprietário desse imóvel — vês contratos, movimentos e pessoas.</span>' +
      '<div class="toolbar" style="margin-top:9px"><button class="btn primary sm" data-toca="dados" onclick="CW.pedidoAceitar(\'' + jsq(p.id) + '\')">Aceitar</button>' +
      '<button class="btn sm danger" data-toca="dados" onclick="CW.pedidoRecusar(\'' + jsq(p.id) + '\')">Recusar</button></div></div>';
  }).concat(out.map(function (p) {
    return '<div class="card" style="padding:12px 13px"><b style="display:block">' + esc(p.houseName || 'Imóvel') + ' · à espera de ' + esc(p.toName || '') + '</b>' +
      '<span class="small">Pediste que passasse a comproprietário. Fica pendente até responder.</span>' +
      '<div class="toolbar" style="margin-top:9px"><button class="btn sm" data-toca="dados" onclick="CW.pedidoCancelar(\'' + jsq(p.id) + '\')">Cancelar pedido</button></div></div>';
  })).join('');
  return card('Pedidos de partilha', inc.length ? inc.length + ' por responder' : 'À espera de resposta',
    '<div class="list" style="gap:9px">' + linhas + '</div>');
}

// O cartão «Cargos»: um por linha com o resumo do que abre e o menu de
// editar/apagar, e o botão de criar. Sem cargos, a dica de por onde começar.
// Devolve: o HTML do cartão (texto).
function cargosCard() {
  var roles = CW.state.roles || [];
  var lista = roles.length
    ? '<div class="list" style="gap:8px">' + roles.map(function (r) {
        var n = Number(r.n) || 0;
        return '<div class="card" style="padding:11px 13px;display:flex;align-items:center;gap:10px">' +
          '<span style="flex:1;min-width:0"><b style="display:block">' + esc(r.name) + '</b>' +
          '<span class="small">' + esc(resumoPerms(r.perms)) + (n ? ' · ' + n + (n === 1 ? ' pessoa' : ' pessoas') : '') + '</span></span>' +
          menu('cargo_' + r.id, [
            { label: 'Editar cargo', icon: 'dots', act: "CW.cargoModal('" + jsq(r.id) + "')" },
            { label: 'Apagar cargo', icon: 'trash', danger: true, act: "CW.apagarCargo('" + jsq(r.id) + "')" },
          ]) + '</div>';
      }).join('') + '</div>'
    : '<div class="hint">Cria um cargo para dizeres o que um colaborador pode ver e adicionar — ou começa por um dos três prontos: Gestor de visitas, Contabilista, Ver tudo.</div>';
  return card('Cargos', 'O que cada colaborador pode fazer',
    lista + '<div class="toolbar" style="margin-top:11px"><button class="btn" data-toca="camada" onclick="CW.cargoModal()">' + ic('plus', 15) + ' Novo cargo</button></div>');
}

/* O cartão «Convidar colaborador»: o cargo, as caixas dos meus imóveis (com o
   atalho «Escolher pelo grupo…») e o botão que cria a ligação de uso único.
   Por baixo, os convites por usar, cada um com «Revogar».
   Devolve: o HTML do cartão (texto). */
function convidarCard() {
  var roles = CW.state.roles || [];
  var meus = cwImoveisMeus();
  var invites = CW.state.invites || [];
  var form;
  if (!roles.length) form = '<div class="hint">Cria primeiro um cargo, no cartão «Cargos» em baixo.</div>';
  else if (!meus.length) form = '<div class="hint">Ainda não tens imóveis para partilhar — cria um primeiro.</div>';
  else {
    var grupos = typeof gOpts === 'function' ? gOpts('prop') : [];
    form = '<div class="form">' +
      '<label>Cargo' + sel('cw_inv_cargo', roles[0].id, roles.map(function (r) { return { v: r.id, label: r.name }; })) + '</label>' +
      '<div><div class="flabel">Imóveis</div><div class="list" style="gap:7px">' + meus.map(function (p) {
        return '<label class="check"><input type="checkbox" id="cw_inv_h_' + p.id + '"><span style="min-width:0"><b>' + esc(p.name || 'Sem nome') + '</b>' +
          (p.address ? ' <span class="small">' + esc(p.address) + '</span>' : '') + '</span></label>';
      }).join('') + '</div>' +
      (grupos.length
        ? '<div style="margin-top:9px">' + sel('cw_inv_grupo', '', [{ v: '', label: 'Escolher pelo grupo…' }].concat(grupos), 'cwInvGrupo') +
          '<div class="hint" style="margin-top:6px">Imóveis que juntares ao grupo depois não entram — edita o colaborador.</div></div>'
        : '') + '</div>' +
      '<label>Nota para ti (opcional)<input id="cw_inv_label" maxlength="60" placeholder="Ex.: para a Ana, contabilidade" autocomplete="off"></label>' +
      '<div class="toolbar"><button class="btn primary" data-toca="dados" onclick="CW.criarConvite()">' + ic('key', 15) + ' Criar ligação de convite</button></div>' +
      '<div class="hint">Vale 7 dias e uma só utilização. Quem a abrir entra (ou cria conta) e fica com o cargo nesses imóveis — sem quota-parte.</div></div>';
  }
  var pendentes = invites.length
    ? '<div class="section-title">Convites por usar</div><div class="list" style="gap:8px">' + invites.map(function (i) {
        var casas = (i.houses || []).map(function (h) { return h.name || 'Sem nome'; }).join(', ');
        var expira = i.expiresAt ? new Date(Number(i.expiresAt)).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : '';
        return '<div class="card" style="padding:11px 13px;display:flex;align-items:center;gap:10px">' +
          '<span style="flex:1;min-width:0"><b style="display:block">' + esc(i.roleName || 'Cargo') + (i.label ? ' · ' + esc(i.label) : '') + '</b>' +
          '<span class="small">' + esc(casas) + (expira ? ' · expira a ' + esc(expira) : '') + '</span></span>' +
          '<button class="btn sm danger" style="flex:0 0 auto" data-toca="dados" onclick="CW.revogarConvite(\'' + jsq(i.id) + '\')">Revogar</button></div>';
      }).join('') + '</div>'
    : '';
  return card('Convidar colaborador', 'Uma ligação de uso único, com um cargo', form + pendentes);
}

/* O cartão «Colaboradores»: por imóvel meu, quem colabora, com o cargo e os
   botões de mudar e remover. Só quem criou o imóvel gere colaboradores —
   nos imóveis em compropriedade fica a dica.
   Devolve: o HTML do cartão (texto). */
function colaboradoresCard() {
  var meus = cwImoveisMeus().filter(function (p) { return (p._colaboradores || []).length; });
  var partilhados = (db.properties || []).filter(function (p) { return p._sharedFrom && !p._cargo; });
  var corpo = meus.length
    ? meus.map(function (p) {
        return '<div class="section-title" style="margin-top:14px">' + esc(p.name || 'Sem nome') + '</div><div class="list" style="gap:8px">' +
          p._colaboradores.map(function (c) {
            return '<div class="card" style="padding:11px 13px">' +
              '<div style="display:flex;align-items:center;gap:11px"><span class="avatar" style="width:32px;height:32px;flex:0 0 32px;font-size:12px">' +
              esc(typeof initials === 'function' ? initials(c.name) : (c.name || '?').slice(0, 2)) + '</span>' +
              '<span style="flex:1;min-width:0"><b style="display:block">' + esc(c.name || c.userId || '') + '</b>' +
              '<span class="badge grey">' + esc(c.roleName || 'Colaborador') + '</span></span></div>' +
              '<div class="toolbar" style="margin-top:9px"><button class="btn sm" data-toca="camada" onclick="CW.mudarColaborador(\'' + jsq(c.id) + '\')">Mudar cargo ou imóveis</button>' +
              '<button class="btn sm danger" data-toca="dados" data-risco="destroi" onclick="CW.removerColaborador(\'' + jsq(c.id) + '\')">Remover</button></div></div>';
          }).join('') + '</div>';
      }).join('')
    : '<div class="hint">Ainda não tens colaboradores. Cria uma ligação de convite em cima.</div>';
  var nota = partilhados.length
    ? '<div class="hint" style="margin-top:11px">Nos imóveis que outros partilharam contigo, só quem criou o imóvel gere colaboradores.</div>'
    : '';
  return card('Colaboradores', 'Quem colabora em cada imóvel', corpo + nota);
}

// O cartão «Imóveis onde colaboras»: um por imóvel com o dono, o cargo e o
// «Sair» (por linha de colaboração). Vazio quando não colaboro em nenhum.
// Devolve: o HTML do cartão (texto), ou '' sem imóveis de colaboração.
function colaboroCard() {
  var casas = (db.properties || []).filter(function (p) { return p._cargo; });
  if (!casas.length) return '';
  var linhas = casas.map(function (p) {
    return '<div class="card" style="padding:11px 13px;display:flex;align-items:center;gap:10px">' +
      '<span style="flex:1;min-width:0"><b style="display:block">' + esc(p.name || 'Sem nome') + '</b>' +
      '<span class="small">de ' + esc(p._sharedFrom || '') + ' · </span><span class="badge grey">' + esc(p._cargo) + '</span></span>' +
      (p._collabId
        ? '<button class="btn sm danger" style="flex:0 0 auto" data-toca="dados" data-risco="destroi" onclick="CW.sairDeImovel(\'' + jsq(p._collabId) + '\')">Sair</button>'
        : '') + '</div>';
  }).join('');
  return card('Imóveis onde colaboras', 'Como colaborador, não como dono',
    '<div class="list" style="gap:8px">' + linhas + '</div>' +
    '<div class="hint" style="margin-top:11px">Não tens quota-parte nestes imóveis nem entras nas contas entre proprietários. Ao sair, o que registaste fica com o dono.</div>');
}

/* O separador «Colaboradores» (menu, no grupo Pessoas): quem ajuda a gerir os
   meus imóveis e com que cargo. Abre com uma frase a dizer o que é um
   colaborador e depois, por esta ordem: convidar (a ligação de uso único),
   quem colabora em cada imóvel, os cargos e os imóveis onde sou eu o
   colaborador. Sem cargos, sem convites e sem colaboradores, o vazio convida
   a criar o primeiro cargo — é ele que diz o que a pessoa pode fazer.
   Devolve: string de HTML da página, pronta a inserir com innerHTML. */
function vColaboradores() {
  if (!CW.user) {
    return card('Colaboradores', 'Sem sessão iniciada',
      '<div class="hint">Convidar quem ajuda a gerir precisa de conta: é ela que guarda os cargos e os convites.</div>' +
      '<div class="toolbar" style="margin-top:11px"><button class="btn primary" data-toca="camada" onclick="CW.showAuth()">Iniciar sessão</button></div>');
  }
  var gap = '<div style="height:14px"></div>';
  var intro = '<div class="hint" style="margin:0 0 12px">Um colaborador entra nos imóveis que lhe deres, com um cargo que diz o que pode ver e adicionar — ' +
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
      '<div style="margin-top:10px"><button type="button" class="btn primary sm" data-toca="camada" onclick="CW.cargoModal()">' + ic('plus', 13) + ' Novo cargo</button></div></div>' +
      (colab ? gap + colab : '');
  }
  return intro + convidarCard() + gap + colaboradoresCard() + gap + cargosCard() + (colab ? gap + colab : '');
}

// O HTML da página "Conta e partilha": a conta e o id para dar a outros, a
// ligação de partilha e os pedidos, o campo para adicionar uma ligação, a
// lista de utilizadores ligados, a segurança e o apagar da conta. Os
// colaboradores vivem no menu (Pessoas → Colaboradores) e não têm aqui
// segunda porta. Sem sessão iniciada, mostra apenas o
// convite para entrar.
// Devolve: string de HTML da página, pronta a inserir com innerHTML.
function vCloud() {
  if (!CW.user) return card('Conta', 'Sem sessão iniciada', '<button class="btn primary" data-toca="camada" onclick="CW.showAuth()">Iniciar sessão</button>');
  var conns = (CW.state.connections || []).slice();
  var gap = '<div style="height:14px"></div>';
  var pedidos = pedidosCard();
  var acc = card('A minha conta', 'Sincronizada neste e noutros aparelhos',
    '<div class="stat"><span>Nome</span><b>' + esc(CW.user.name || '—') + '</b></div>' +
    '<div class="stat"><span>Email</span><b>' + esc(CW.user.email) + '</b></div>' +
    '<div class="stat" style="border:0"><span>O meu id</span><b style="font-family:monospace;letter-spacing:2px;font-size:16px">' + esc(CW.user.id) + '</b></div>' +
    '<div class="toolbar" style="margin-top:11px">' +
    '<button class="btn" data-toca="nada" onclick="CW.copyId()">Copiar id</button>' +
    '<button class="btn" data-toca="dados" onclick="CW.logout()">Terminar sessão</button></div>' +
    '<div class="hint" style="margin-top:11px">Dá este id a outro utilizador para ele te adicionar — ou adiciona tu o id dele em baixo. Depois de aceite, cada um escolhe que casas quer partilhar.</div>');
  var add = card('Ligar a outro utilizador', 'Escreve o id que ele te deu',
    '<div style="display:flex;gap:9px">' +
    '<input id="cw_peer" placeholder="Ex.: A7KQ2MPX" style="flex:1;text-transform:uppercase;font-family:monospace;letter-spacing:2px" maxlength="8">' +
    '<button class="btn primary" style="flex:0 0 auto" data-toca="dados" onclick="CW.addConn()">Adicionar</button></div>');
  var list = conns.length
    ? '<div class="section-title">Utilizadores ligados</div><div class="list" style="gap:10px">' + conns.map(connCard).join('') + '</div>'
    : '<div class="hint">Ainda não estás ligado a ninguém.</div>';
  var seg = card('Segurança', 'Palavra-passe e sessões',
    '<div class="hint">A sessão dura 30 dias em cada aparelho. Se desconfiares que alguém entrou na tua conta, ' +
    'muda a palavra-passe ou fecha as outras sessões — em qualquer dos casos, todos os outros aparelhos passam a ' +
    'ter de entrar de novo.</div>' +
    '<div class="toolbar" style="margin-top:11px">' +
    '<button class="btn" data-toca="camada" onclick="CW.passwordModal()">' + ic('lock', 15) + ' Mudar palavra-passe</button>' +
    '<button class="btn" data-toca="dados" onclick="CW.revokeSessions()">Terminar sessão nos outros aparelhos</button></div>');
  var danger = card('Apagar a conta', 'Não há volta atrás',
    '<div class="hint">Apaga a tua conta e <b>todos os teus dados</b>: imóveis, contratos, movimentos, pessoas e ligações. ' +
    'Nas casas de outras pessoas onde tenhas ficado registado (num movimento pago por ti, por exemplo), o teu nome passa a ' +
    'aparecer como <b>[deleted]</b>. As casas que os outros partilharam contigo deixam de estar ligadas a ti — os dados deles não são apagados.</div>' +
    '<div class="toolbar" style="margin-top:11px"><button class="btn danger" data-toca="dados" data-risco="destroi" onclick="CW.deleteAccount()">' +
    ic('trash', 15) + ' Apagar a minha conta</button></div>');
  return acc + gap + ligacaoCard() + (pedidos ? gap + pedidos : '') + gap + add + gap + list +
    '<div style="height:18px"></div>' + seg + gap + danger;
}

/* ---------------- aviso legal ---------------- */

SUBPAGE.cloud = { label: 'Conta e partilha', sub: 'O teu id, ligações e imóveis partilhados' };
SUBPAGE.legal = { label: 'Aviso legal', sub: 'Condições de utilização e privacidade' };
SUBPAGE.tema = { label: 'Tema', sub: 'Claro, escuro ou o do telemóvel' };
SUBPAGE.ajuda = { label: 'Ajuda e sugestões', sub: 'Contar um problema ou pedir uma melhoria' };
SUBPAGE.termos = { label: 'Termos e Condições', sub: 'O acordo entre ti e quem opera o serviço' };
SUBPAGE.privacidade = { label: 'Política de Privacidade', sub: 'Que dados tratamos, porquê e por quanto tempo' };

var L = window.LEGAL || { version: '', termos: '', privacidade: '' };

// folha de estilo dos documentos legais: texto corrido, legível, sem cartões
var lgCss = document.createElement('style');
lgCss.textContent =
  '.lg{max-width:70ch;line-height:1.68;font-size:14.5px;color:var(--ink)}' +
  '.lg p{margin:0 0 12px}' +
  '.lg ul{margin:0 0 14px;padding-left:20px}' +
  '.lg li{margin:0 0 7px}' +
  '.lg .lg-h{font-size:15.5px;font-weight:650;margin:26px 0 10px;letter-spacing:-.01em}' +
  '.lg b{font-weight:650}';
document.head.appendChild(lgCss);


SUBPAGE.faq = { label: 'Perguntas frequentes', sub: 'As dúvidas mais comuns' };

/* As perguntas que vão chegar de certeza — respondidas antes de chegarem.
   Cada resposta aponta o caminho concreto na app, não teoria.
   Devolve: string de HTML do cartão das perguntas, pronta a inserir com innerHTML. */
function vFaq() {
  var q = function (id, pergunta, resposta) {
    return fold('faq_' + id, pergunta, '<div class="hint" style="font-size:14px;line-height:1.6">' + resposta + '</div>', { icon: 'info', open: false });
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
    ${q('contratos', 'Porque é que não consigo criar um contrato?', 'Enquanto a fase experimental durar, consegues sempre. Quando os planos entrarem em vigor (anunciado com 30 dias de antecedência), os contratos fazem parte do plano <b>Plus</b>. O que já existir nunca é apagado nem fica inacessível.')}
    ${q('pdf', 'O contrato em PDF serve para assinar?', 'É uma <b>minuta genérica</b>, não validada por advogado. Usa-a como ponto de partida e pede revisão profissional antes de assinar — a lei do arrendamento muda e cada caso é um caso.')}
    ${q('tema', 'A app não muda para o modo escuro do telemóvel', 'Em <b>Definições → Tema</b>, escolhe «Automático». Em alguns browsers Samsung o sistema não passa a preferência — nesse caso escolhe «Escuro» à mão; a escolha é por aparelho.')}
    ${q('instalar', 'Como instalo a app no telemóvel?', 'Android: <b>Definições → Conta e partilha</b> tem o APK, ou usa «Adicionar ao ecrã principal» no browser. iPhone: Safari → Partilhar → <b>Adicionar ao ecrã principal</b>.')}
    ${q('conta', 'Como apago a minha conta?', 'Em <b>Definições → Conta e partilha → Apagar conta</b>. É definitivo: apaga imóveis, contratos, movimentos e ligações. Nas casas partilhadas, o teu nome passa a «[deleted]» para os outros.')}
  `);
}
