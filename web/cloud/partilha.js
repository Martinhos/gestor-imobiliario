/* Pagina Conta e partilha: id, ligacoes, seguranca e apagar a conta. */
'use strict';

/* ---------------- página "Conta e partilha" ---------------- */

var _vSettings = vSettings;
vSettings = function () {
  if (setPage === 'cloud') return backRow + vCloud();
  if (setPage === 'legal') return backRow + vLegal();
  if (setPage === 'ajuda') return backRow + vAjuda();
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
          return '<button type="button" class="opt ' + (t === o[0] ? 'on' : '') + '" onclick="setTheme(\'' + o[0] + '\')">' +
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
      '<div class="card tap" onclick="CW.editProfile()" style="display:flex;align-items:center;gap:13px">' +
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
      navRow('Aviso legal', 'Termos, privacidade e demonstração', 'contract', 'legal') + gap +
      card('Gestor Imobiliário', 'Versão 23 · demonstração',
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
          '<div class="toolbar" style="margin-top:11px"><a class="btn primary" href="/gestor-imobiliario.apk" download style="text-decoration:none">' + ic('down', 16) + ' Descarregar APK</a></div>');
    }
  }
  return h;
};

function connCard(c) {
  var peer = esc(c.peer.name || c.peer.email || c.peer.id);
  var lines = '';
  var btns = '';
  if (c.status === 'pending' && c.incoming) {
    lines = '<div class="small">Quer ligar-se a ti. Se aceitares, cada um pode escolher que casas partilha com o outro.</div>';
    btns = '<button class="btn primary sm" onclick="CW.acceptConn(\'' + c.id + '\')">Aceitar</button>' +
      '<button class="btn sm danger" onclick="CW.delConn(\'' + c.id + '\',1)">Recusar</button>';
  } else if (c.status === 'pending') {
    lines = '<div class="small">À espera que aceite o convite.</div>';
    btns = '<button class="btn sm danger" onclick="CW.delConn(\'' + c.id + '\',1)">Cancelar</button>';
  } else {
    var mine = (c.myShares || []).length, theirs = (c.peerShares || []).length;
    lines = '<div class="small">Partilhas <b>' + mine + '</b> casa' + (mine === 1 ? '' : 's') +
      ' · recebe' + 's' + ' <b>' + theirs + '</b> casa' + (theirs === 1 ? '' : 's') + ' de ' + peer + '</div>';
    btns = '<button class="btn primary sm" onclick="CW.sharesModal(\'' + c.id + '\')">Escolher casas</button>' +
      '<button class="btn sm danger" onclick="CW.delConn(\'' + c.id + '\')">Remover</button>';
  }
  // os botões ficam numa linha própria: encostados ao texto, tapavam-no em ecrãs estreitos
  return '<div class="card" style="padding:13px 14px">' +
    '<div style="min-width:0"><div class="title">' + peer + '</div>' +
    '<div class="small">id ' + esc(c.peer.id) + '</div></div>' +
    lines +
    '<div class="toolbar" style="margin-top:10px">' + btns + '</div></div>';
}

function vCloud() {
  if (!CW.user) return card('Conta', 'Sem sessão iniciada', '<button class="btn primary" onclick="CW.showAuth()">Iniciar sessão</button>');
  var conns = (CW.state.connections || []).slice();
  var acc = card('A minha conta', 'Sincronizada neste e noutros aparelhos',
    '<div class="stat"><span>Nome</span><b>' + esc(CW.user.name || '—') + '</b></div>' +
    '<div class="stat"><span>Email</span><b>' + esc(CW.user.email) + '</b></div>' +
    '<div class="stat" style="border:0"><span>O meu id</span><b style="font-family:monospace;letter-spacing:2px;font-size:16px">' + esc(CW.user.id) + '</b></div>' +
    '<div class="toolbar" style="margin-top:11px">' +
    '<button class="btn" onclick="CW.copyId()">Copiar id</button>' +
    '<button class="btn" onclick="CW.logout()">Terminar sessão</button></div>' +
    '<div class="hint" style="margin-top:11px">Dá este id a outro utilizador para ele te adicionar — ou adiciona tu o id dele em baixo. Depois de aceite, cada um escolhe que casas quer partilhar.</div>');
  var add = card('Ligar a outro utilizador', 'Escreve o id que ele te deu',
    '<div style="display:flex;gap:9px">' +
    '<input id="cw_peer" placeholder="Ex.: A7KQ2MPX" style="flex:1;text-transform:uppercase;font-family:monospace;letter-spacing:2px" maxlength="8">' +
    '<button class="btn primary" style="flex:0 0 auto" onclick="CW.addConn()">Adicionar</button></div>');
  var list = conns.length
    ? '<div class="section-title">Utilizadores ligados</div><div class="list" style="gap:10px">' + conns.map(connCard).join('') + '</div>'
    : '<div class="hint">Ainda não estás ligado a ninguém.</div>';
  var seg = card('Segurança', 'Palavra-passe e sessões',
    '<div class="hint">A sessão dura 30 dias em cada aparelho. Se desconfiares que alguém entrou na tua conta, ' +
    'muda a palavra-passe ou fecha as outras sessões — em qualquer dos casos, todos os outros aparelhos passam a ' +
    'ter de entrar de novo.</div>' +
    '<div class="toolbar" style="margin-top:11px">' +
    '<button class="btn" onclick="CW.passwordModal()">' + ic('lock', 15) + ' Mudar palavra-passe</button>' +
    '<button class="btn" onclick="CW.revokeSessions()">Terminar sessão nos outros aparelhos</button></div>');
  var danger = card('Apagar a conta', 'Não há volta atrás',
    '<div class="hint">Apaga a tua conta e <b>todos os teus dados</b>: imóveis, contratos, movimentos, pessoas e ligações. ' +
    'Nas casas de outras pessoas onde tenhas ficado registado (num movimento pago por ti, por exemplo), o teu nome passa a ' +
    'aparecer como <b>[deleted]</b>. As casas que os outros partilharam contigo deixam de estar ligadas a ti — os dados deles não são apagados.</div>' +
    '<div class="toolbar" style="margin-top:11px"><button class="btn danger" onclick="CW.deleteAccount()">' +
    ic('trash', 15) + ' Apagar a minha conta</button></div>');
  return acc + '<div style="height:14px"></div>' + add + '<div style="height:14px"></div>' + list +
    '<div style="height:18px"></div>' + seg + '<div style="height:14px"></div>' + danger;
}

/* ---------------- aviso legal ---------------- */

SUBPAGE.cloud = { label: 'Conta e partilha', sub: 'O teu id, ligações e casas partilhadas' };
SUBPAGE.legal = { label: 'Aviso legal', sub: 'Versão de demonstração · condições de utilização' };
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
