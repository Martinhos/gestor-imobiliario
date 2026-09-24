/* Sessao, sincronizacao com o servidor e reconstrucao dos dados locais — e,
   no fim, os embrulhos que ligam a base a isto (save, render, go, goSet). */
'use strict';

// sessão {id,name,email} — a chave vive em app/dados.js. A sessão em si vive no
// cookie HttpOnly; um token só fica cá nos fluxos de teste (api, largarTokenAntigo)
var LS_USER = LS_SESSAO;
var LS_OWNER = 'gi_cloud_owner'; // id do utilizador dono da cache local
var LS_LIGACAO = 'gi_ligacao_url';   // + '_<id>': o URL da ligação permanente, por conta (chaveDaLigacao)
// 3 minutos entre leituras: com 90 segundos, uma app aberta o dia todo
// sozinha consumia uma fatia enorme do plano gratuito da base de dados.
var PULL_MS = 180000;

// O CW.state de quem ainda não recebeu nenhum estado: as listas todas com forma, vazias.
// Devolve: um objeto novo com a forma do estado.
function estadoVazio() {
  return { connections: [], roles: [], collaborators: [], invites: [], people: [], shareLink: null, shareRequests: { incoming: [], outgoing: [] } };
}

var CW = (window.CW = {});
CW.user = null;
CW.state = estadoVazio();
CW.cargos = {};    // por imóvel: {dono, nome, perms} — vem de cargosDoEstado (web/app/acessos.js)
CW.pessoas = {};   // por id de utilizador: {name, kind, roleName} — quem não é proprietário mas tem nome

try { CW.user = JSON.parse(localStorage.getItem(LS_USER) || 'null'); } catch (e) {}
/* O tecto da espera arma-se AQUI, e não no startSync: o startSync só corre
   depois de o GET /api/me responder (cloud/entrada.js), e um pedido pendurado
   nunca chegava a armá-lo — a app ficava calada sem limite sobre o que já
   sabia. Com sessão, o primeiro estado tem seis segundos; passados eles, o que
   está no aparelho é o que há, e diz-se. */
if (CW.user) setTimeout(function () { fimDaEspera(); }, 6000);

// Fora do wrapper Android, o browser já desconta a barra de estado — o
// palpite de 28px do fitInsets() (pensado para o WebView antigo em ecrã
// inteiro) criava um espaço a mais no topo. Travamo-lo e repomos o env().
if (!window.Android) {
  window.__nativeInsets = 1; // fitInsets() passa a não fazer nada
  var rs = document.documentElement.style;
  ['--inset-top', '--inset-bottom', '--inset-left', '--inset-right'].forEach(function (k) {
    rs.removeProperty(k); // volta ao env(safe-area-inset-*) puro do CSS
  });
}

/* O tema é uma preferência do aparelho, não da conta: sincronizá-lo fazia
   um telemóvel em modo escuro herdar o "claro" escolhido noutro sítio. */
var LS_THEME = 'gi_theme';
// Tema guardado neste aparelho; 'auto' se nada houver ou se o localStorage falhar.
// Devolve: o tema em texto (o guardado, ou 'auto' na falta dele).
function localTheme() {
  try { return localStorage.getItem(LS_THEME) || 'auto'; } catch (e) { return 'auto'; }
}
// Sobrepõe o tema do aparelho ao que estiver em db.settings e aplica-o.
// Devolve: nada — escreve db.settings.theme e chama applyTheme().
function applyLocalTheme() {
  db.settings.theme = localTheme();
  applyTheme();
}
var _setTheme = setTheme;
setTheme = function (t) {
  try { localStorage.setItem(LS_THEME, t); } catch (e) {}
  _setTheme(t);
};
applyLocalTheme();

/* O retrato do servidor: chave -> resumo do JSON do que já lá está (ou
   '__obsoleto__', para o push seguinte apagar). É a base da diferença que o
   pushNow envia e da fusão que o applyState faz. Guardava o JSON inteiro — o
   localStorage levava tudo duas vezes (110 % da base, medido com 5000
   movimentos), e quando a quota rebentava o retrato vinha vazio no arranque
   seguinte: subia tudo outra vez e as remoções deixavam de se propagar. Para
   saber se uma entidade mudou chega a igualdade, e para isso chega o resumo. */
var snap = {};
var snapKey = function () { return 'gi_cloud_snap_' + (CW.user ? CW.user.id : ''); };

/* O resumo de um texto: 53 bits de mistura (duas somas multiplicativas
   entrelaçadas) mais o comprimento, com um '#' à frente para se distinguir
   do JSON dos retratos antigos. Duas versões diferentes de uma entidade darem
   o mesmo resumo é da ordem de uma em 2^53.
   Recebe: s — o texto (o JSON de uma entidade, ou a resposta do estado).
   Devolve: o resumo, em texto curto ('#…:…'). */
function resumoDeTexto(s) {
  s = String(s);
  var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return '#' + ((h2 & 0x1fffff) >>> 0).toString(36) + (h1 >>> 0).toString(36) + ':' + s.length.toString(36);
}

// Carrega do aparelho o retrato do servidor. Um retrato de uma versão anterior
// (com o JSON inteiro de cada entidade) passa a resumos aqui mesmo: o resumo
// do JSON guardado é o mesmo que o do JSON atual, se nada mudou.
// Devolve: nada — preenche a variável snap ({} se nada houver ou a leitura falhar).
function loadSnap() {
  try { snap = JSON.parse(localStorage.getItem(snapKey()) || '{}') || {}; } catch (e) { snap = {}; }
  Object.keys(snap).forEach(function (k) {
    var v = snap[k];
    if (typeof v === 'string' && v !== '__obsoleto__' && v.charAt(0) !== '#') snap[k] = resumoDeTexto(v);
  });
}
// Guarda o retrato no aparelho. Se o localStorage recusar, a sincronização
// continua (o retrato vive em memória até ao fecho), mas não se cala: vai uma
// vez para o rasto e para o relato de erro — sem retrato no arranque seguinte,
// sobe tudo outra vez e as remoções feitas entretanto não se propagam.
// Sem sessão (um 401 a meio de um envio acabou com ela) não grava: a chave
// seria a de ninguém.
// Devolve: nada — grava snap no localStorage.
function saveSnap() {
  if (!CW.user) return;
  try { localStorage.setItem(snapKey(), JSON.stringify(snap)); } catch (e) {
    if (saveSnap._avisado) return;
    saveSnap._avisado = 1;
    rastoPoe('retrato por gravar: ' + ((e && e.name) || 'erro'));
    try { if (typeof reportErr === 'function') reportErr('O retrato da sincronização não coube no aparelho', String((e && e.message) || e)); } catch (x) {}
  }
}

/* ---------------- API ---------------- */

/* Quanto se espera por cada chamada, em ms. Sem tecto, um pedido pendurado (o
   wifi do hotel com portal cativo: o TCP aceita e a resposta não chega)
   trancava o envio até se recarregar a app — o pushNow só larga o `pushing`
   quando a cadeia acaba, e o syncCycle espera por ele para ler. O estado e o
   envio são os pedidos maiores (uma conta com anos de movimentos são MB, num
   telemóvel em 3G): têm mais margem — o tecto existe para largar, não para
   apressar. */
var TEMPO_API = { estado: 45000, sync: 45000, outros: 20000 };
/* O que ainda pode sair com a app trancada pela versão mínima
   (novidades.js:gateAtualizar): o relato de erro e o terminar sessão, que não
   escrevem dados. */
var LIVRES_DA_TRANCA = { '/api/reports': 1, '/api/auth/logout': 1 };

/* Chamada à API. A sessão vai no cookie HttpOnly que o servidor põe ao entrar
   (credentials: 'same-origin'), e o token não se guarda no aparelho: um script
   na página não o lê. O Bearer só segue quando há um token cá — os fluxos de
   teste (?entrar=, o seletor de contas de teste) e as sessões guardadas antes
   de o token sair das respostas (largarTokenAntigo) — e com ele o
   X-Rendorium-Token: 1, para o servidor de teste devolver o token novo quando
   roda a sessão (sessaoRodada). Serializa 'data' em JSON, tem tempo-limite
   (TEMPO_API), e com a app trancada recusa o que escreve. Um 401 de sessão
   encerra a sessão local (sessaoCaiu). Resposta não-ok rejeita com um Error
   cuja mensagem vem do servidor e com .status preenchido.
   Recebe: method — o verbo HTTP ('GET', 'POST', …); path — o caminho do pedido
   (ex.: '/api/state'); data (opcional) — corpo do pedido, serializado em JSON;
   opcoes (opcional) — {headers: cabeçalhos a juntar; comSelo: true na leitura
   do estado, que devolve o selo (ETag) e o resumo da resposta e aceita um 304}.
   Devolve: Promise com o JSON da resposta ({} se o corpo não for JSON) — com
   comSelo, {estado, selo, resumo}, ou {naoMudou: true} num 304; rejeita com
   esse Error quando a resposta não é ok, e sem .status quando não há
   resposta (sem rede, ou o tempo acabou). */
function api(method, path, data, opcoes) {
  opcoes = opcoes || {};
  if (CW.trancado && method !== 'GET' && !LIVRES_DA_TRANCA[path]) {
    var tr = new Error('Esta versão da app tem de ser atualizada antes de guardar.');
    tr.trancado = true;
    return Promise.reject(tr);
  }
  var opts = { method: method, headers: {}, credentials: 'same-origin' };
  if (CW.user && CW.user.token) {
    opts.headers['Authorization'] = 'Bearer ' + CW.user.token;
    opts.headers['X-Rendorium-Token'] = '1';
  }
  var extra = opcoes.headers || {};
  Object.keys(extra).forEach(function (k) { opts.headers[k] = extra[k]; });
  if (opcoes.comSelo) opts.cache = 'no-store';   // quem decide é o selo, não a cache HTTP do browser
  if (data !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  }
  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  if (ctl) opts.signal = ctl.signal;
  var ms = path === '/api/state' ? TEMPO_API.estado : path === '/api/sync' ? TEMPO_API.sync : TEMPO_API.outros;
  var pedido = fetch(path, opts).catch(function (e) { rastoPoe(method + ' ' + path + ' → sem rede'); throw e; }).then(function (r) {
    rastoPoe(method + ' ' + path + ' → ' + r.status);
    // um 304 não traz corpo: não há nada para ler, e nada para aplicar
    if (r.status === 304 && opcoes.comSelo) return { naoMudou: true };
    return lerCorpo(r, opcoes.comSelo).then(function (lido) {
      var j = lido.json;
      if (r.status === 401 && CW.user && sessaoCaiu(method, path, j)) sessionLost();
      if (!r.ok) { var e = new Error(j.error || ('Erro ' + r.status)); e.status = r.status; throw e; }
      if (!opcoes.comSelo) return j;
      var selo = '';
      try { selo = (r.headers && typeof r.headers.get === 'function' && r.headers.get('ETag')) || ''; } catch (x) {}
      return { estado: j, selo: selo, resumo: lido.resumo };
    });
  });
  return comTempoLimite(pedido, ms, ctl, method + ' ' + path);
}

/* O corpo de uma resposta, decomposto. Na leitura do estado lê-se o texto,
   porque é dele que sai o resumo que diz se alguma coisa mudou desde o último
   estado aplicado; nas outras, o JSON direto.
   Recebe: r — a resposta do fetch; comResumo — verdadeiro para calcular o resumo.
   Devolve: Promise com {json, resumo} — json é {} quando o corpo não é JSON. */
function lerCorpo(r, comResumo) {
  if (comResumo && typeof r.text === 'function') {
    return r.text().then(function (t) {
      var j = null;
      try { j = JSON.parse(t); } catch (e) {}
      return { json: j || {}, resumo: t ? resumoDeTexto(t) : '' };
    }, function () { return { json: {}, resumo: '' }; });
  }
  return r.json().catch(function () { return {}; }).then(function (j) { return { json: j || {}, resumo: '' }; });
}

/* Se um 401 quer dizer que a sessão acabou. Nas rotas de entrada nunca (aí é
   «email ou palavra-passe errados»); na mudança de palavra-passe e no apagar
   da conta, só com a frase da sessão — a palavra-passe atual errada também é
   um 401 (rotas/conta.js), e pôr alguém fora com «a sessão expirou» por se
   ter enganado nela era falso e deixava-o sem saber se a conta se apagou.
   Recebe: method, path — o pedido; j — o corpo da resposta.
   Devolve: true se a sessão caiu. */
function sessaoCaiu(method, path, j) {
  if (path.indexOf('/api/auth/') === 0) return false;
  var comPalavraPasse = path === '/api/me/password' || (method === 'DELETE' && path === '/api/me');
  return !comPalavraPasse || /^Sessão inválida/.test(String((j && j.error) || ''));
}

/* Dá um tecto a um pedido: passado o tempo, aborta o fetch (onde o browser
   sabe) e rejeita com um erro sem .status — que quem chama trata como falta
   de rede, porque para a pessoa é o que é. O temporizador sai assim que o
   pedido acaba.
   Recebe: pedido — a Promise do pedido; ms — o tecto; ctl — o AbortController
   (ou null); onde — 'MÉTODO caminho', para o rasto.
   Devolve: Promise que acaba como o pedido, ou rejeita no tecto. */
function comTempoLimite(pedido, ms, ctl, onde) {
  return new Promise(function (ok, falha) {
    var t = setTimeout(function () {
      rastoPoe(onde + ' → sem resposta');
      try { if (ctl) ctl.abort(); } catch (e) {}
      var e = new Error('O servidor não respondeu a tempo.');
      e.semResposta = true;
      falha(e);
    }, ms);
    pedido.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); falha(e); });
  });
}

// O rasto do que a pessoa andava a fazer: as últimas chamadas à API e
// mudanças de ecrã, num anel de 10 entradas em memória. Vai no relato de
// cada erro — «rebentou em Movimentos» diz pouco; «depois de POST /api/sync
// → 500» diz onde procurar. Os segredos saem antes: um token (64
// hexadecimais — ligação de partilha, convite, entrada) no caminho fica
// mascarado. O relato fica na base e é anunciado no canal da equipa; a
// ligação permanente é justamente o que a app não volta a mostrar, e o
// servidor já a mascara nos relatos dele.
// Recebe: s — a entrada a registar (texto; corta-se a 80 caracteres).
// Devolve: nada — acrescenta ao anel CW._rasto.
function rastoPoe(s) {
  try {
    CW._rasto = CW._rasto || [];
    CW._rasto.push(String(s).replace(/[A-Fa-f0-9]{32,}/g, '…').slice(0, 80));
    if (CW._rasto.length > 10) CW._rasto.shift();
  } catch (e) {}
}

/* ---------------- sessão ---------------- */

// Grava a sessão (CW.user) no aparelho; sem sessão não faz nada.
// Devolve: nada — escreve LS_USER (e engole a recusa do localStorage).
function guardarSessao() {
  try { if (CW.user) localStorage.setItem(LS_USER, JSON.stringify(CW.user)); } catch (e) {}
}

// A chave do URL da ligação permanente de uma conta — por utilizador, como o
// retrato: num aparelho partilhado, a ligação de uma conta não pode ser a que
// a conta seguinte copia (colaboradores.js:ligacaoCopiar).
// Recebe: id (opcional) — o id da conta; sem ele, o da sessão.
// Devolve: a chave (texto).
function chaveDaLigacao(id) {
  return LS_LIGACAO + '_' + (id || (CW.user ? CW.user.id : ''));
}

/* O único ritual de saída: expirar, «Não sou eu», terminar sessão, recusar
   os termos e apagar a conta passam todos por aqui. Eram cinco listas de
   limpeza diferentes, e cada chave nova tinha de ser lembrada em cinco sítios
   — já faltava em dois (a ligação de partilha, os planeados perguntados).
   Sai sempre: a sessão, a página guardada, os planeados já perguntados, a
   ligação desta conta, o rasto, o estado em memória e os serviços desligados
   (eram desta conta). A base local e o retrato ficam, de propósito
   (docs/design.md, «A app não afirma nem decide antes de saber»): quem volta a entrar encontra o que
   deixou, e o finishLogin larga-os quando entra outra conta. Com apagarDados
   (a conta deixou de existir) vão também a base, o dono dela e o retrato.
   Recebe: o (opcional) — {avisarServidor: chamar o logout, que apaga o
   cookie; apagarDados: ver acima; mensagem: o que o ecrã de entrada diz}.
   Devolve: nada — limpa a sessão e mostra o ecrã de entrada. */
function encerrarSessao(o) {
  o = o || {};
  if (o.avisarServidor && CW.user) api('POST', '/api/auth/logout').catch(function () {});
  clearTimeout(pushTimer);
  pushTimer = null;
  // 'gi_est_asked' é o LS_ASKED de painel.js (os planeados por que já se perguntou)
  var chaves = [LS_USER, LS_PAGE, 'gi_est_asked', chaveDaLigacao()];
  if (o.apagarDados) chaves.push(LS_OWNER, snapKey());
  chaves.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
  if (o.apagarDados) {
    db = JSON.parse(JSON.stringify(blank));
    rawSet(KEY, JSON.stringify(db));
    snap = {};
  }
  CW.user = null;
  CW.tickets = null; CW._ticketsFalhou = false;
  CW._rasto = [];
  CW.state = estadoVazio(); CW.cargos = {}; CW.pessoas = {}; CW._pulled = 0;
  seloAplicado = ''; resumoAplicado = '';
  try { definirServicosDesligados([]); } catch (e) {}
  try { closeAllModals(); } catch (e) {}
  // a próxima entrada começa na visão geral, não onde se saiu
  tab = 'dashboard'; setPage = '';
  try { buildNav(); render(); } catch (e) {}
  CW.showAuthMode = 'login';
  showAuth(o.mensagem);
}

// Deita fora a sessão local e volta ao ecrã de entrada, com aviso de expiração.
// Devolve: nada — o encerrarSessao limpa e mostra o ecrã de entrada.
function sessionLost() {
  encerrarSessao({ mensagem: 'A sessão expirou — inicia sessão de novo.' });
}

/* Depois de o servidor rodar a sessão (palavra-passe nova, terminar as
   outras sessões), o cookie já traz a nova. Um token no aparelho só se mantém
   se a sessão era de token e o servidor devolveu o novo (fora de produção,
   pedido com o X-Rendorium-Token); senão sai — o antigo deixou de valer e, com
   o Bearer à frente do cookie no servidor, punha a pessoa fora.
   Recebe: r — a resposta do servidor ({ok, token?}).
   Devolve: nada — acerta CW.user e grava-o. */
function sessaoRodada(r) {
  if (!CW.user) return;
  if (CW.user.token && r && r.token) CW.user.token = r.token;
  else delete CW.user.token;
  guardarSessao();
}

/* As sessões guardadas antes de o token sair das respostas trazem-no no
   aparelho, legível por qualquer script da página. No arranque pergunta-se
   ao servidor, só com o cookie, quem somos: se o cookie é da mesma conta, o
   token sai e a sessão passa a viver dele. Se não for (o seletor de contas de
   teste troca a sessão sem trocar o cookie) ou se não houver resposta, fica.
   Devolve: Promise com true quando o token saiu (nunca rejeita). */
function largarTokenAntigo() {
  if (!CW.user || !CW.user.token) return Promise.resolve(false);
  var id = CW.user.id;
  return fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (u) {
      if (!u || u.id !== id || !CW.user || CW.user.id !== id) return false;
      delete CW.user.token;
      guardarSessao();
      return true;
    })
    .catch(function () { return false; });
}

/* ---------------- exportação: db -> entidades do servidor ------------- */

// Cópia profunda sem as chaves de trabalho (as que começam por '_'):
// é esta a forma que segue para o servidor.
// Recebe: o — o objeto a limpar (tem de ser serializável em JSON).
// Devolve: cópia profunda do objeto, sem as chaves que começam por '_'.
function strip(o) {
  var c = JSON.parse(JSON.stringify(o));
  Object.keys(c).forEach(function (k) { if (k.charAt(0) === '_') delete c[k]; });
  return c;
}

// As quotas são geridas pelo servidor (propostas com confirmação): a casa
// exportada nunca as leva, para um cliente desatualizado não as reverter.
// Recebe: p — o imóvel (um objeto de db.properties).
// Devolve: cópia limpa (via strip) e ainda sem ownerIds nem ownerShares.
function stripHouse(p) {
  var c = strip(p);
  delete c.ownerIds;
  delete c.ownerShares;
  return c;
}

/* Um imóvel que é meu de raiz (criei-o eu): nem partilhado por outro nem de
   colaboração. É o critério de quem gere partilha, colaboradores, quotas e
   apagar — a decisão pura (souCriador) vive em web/app/acessos.js, que o
   index.html carrega sempre antes desta camada.
   Recebe: p — o imóvel (objeto de db.properties; aguenta null).
   Devolve: true se o imóvel é meu de raiz; false caso contrário. */
function cwMinha(p) {
  if (!p || p._sharedFrom || p._cargo) return false;
  return !!souCriador(p.id);
}

/* Se este utilizador pode enviar esta entidade ao servidor. Nos imóveis
   próprios ou em compropriedade, tudo; nos de colaboração, a ficha do imóvel
   só com house.edit e os registos só dos tipos cujo cargo dá «.add» (pode e
   KIND_PERM, de web/app/acessos.js) — o servidor recusava na mesma, mas
   poupa-se o pedido. Um tipo sem família de permissões nunca sobe dali.
   Recebe: houseId — o id do imóvel; kind (opcional) — o tipo do registo
   ('contract', 'tx', …); sem ele avalia-se a ficha do imóvel.
   Devolve: true se pode subir; false se não. */
function podeExportar(houseId, kind) {
  var p = (db.properties || []).find(function (x) { return x.id === houseId; });
  if (!p || !p._cargo) return true;
  if (!kind) return !!pode(houseId, 'house.edit');
  var fam = KIND_PERM[kind];
  return !!fam && !!pode(houseId, fam + '.add');
}

/* O imóvel a que uma ficha de inquilino está presa: o campo houseId, que a
   app grava na ficha (criada a partir de uma visita, ou num imóvel de
   colaboração), ou a marca _houseId que o servidor põe ao vir de um registo
   de casa. Uma ficha só minha não tem nenhum dos dois.
   Recebe: t — a ficha do inquilino (aguenta null).
   Devolve: o id do imóvel (texto), ou '' quando a ficha não está presa a nenhum. */
function casaDaFicha(t) {
  return (t && (t.houseId || t._houseId)) || '';
}

/* Mapa completo do que este utilizador deve ter no servidor.
   chave -> {scope, houseId?, kind?, id?, data}
   Uma ficha de inquilino tem uma chave só. Presa a um imóvel (casaDaFicha, ou
   ligada por contrato) é um registo desse imóvel — r:<casa>:tenant:<id> — e é
   assim que a ficha que um colaborador com tenant.add cria («Converter em
   inquilino») chega ao dono, e as correções dele também. Sem imóvel, ou presa
   a um que já não está em db.properties (apagado — a ficha fica), é minha:
   u:tenant. Subia também como u:tenant quando presa a um imóvel meu, para não
   se perder ao apagar o imóvel; mas a cópia ganhava ao registo da casa no
   rebuildDb — o dono via sempre a versão velha do que o colaborador corrigia,
   e o que o colaborador apagava voltava a subir. Apagar o imóvel já a passa a
   u:tenant pela regra do imóvel que não existe.
   Devolve: esse mapa (objeto), montado a partir do db local já limpo por strip. */
function exportEntities() {
  var map = {};
  var owners = db.owners || [], tenants = db.tenants || [];
  var emImovel = {};   // as fichas que já sobem como registo de um imóvel
  (db.properties || []).forEach(function (p) {
    // num imóvel de colaboração só sobe o que o cargo deixa (podeExportar)
    if (podeExportar(p.id)) map['h:' + p.id] = { scope: 'house', houseId: p.id, data: stripHouse(p) };
    var persons = {};
    (db.contracts || []).forEach(function (c) {
      if (c.propertyId !== p.id) return;
      if (podeExportar(p.id, 'contract')) map['r:' + p.id + ':contract:' + c.id] = { scope: 'record', houseId: p.id, kind: 'contract', id: c.id, data: strip(c) };
      (c.tenantIds || []).forEach(function (tid) {
        var t = tenants.find(function (x) { return x.id === tid; });
        if (t) persons['tenant:' + tid] = t;
      });
    });
    // as fichas presas a este imóvel, mesmo sem contrato (podeExportar decide abaixo)
    tenants.forEach(function (t) {
      if (casaDaFicha(t) === p.id) persons['tenant:' + t.id] = t;
    });
    (db.transactions || []).forEach(function (t) {
      if (t.propertyId !== p.id || !podeExportar(p.id, 'tx')) return;
      map['r:' + p.id + ':tx:' + t.id] = { scope: 'record', houseId: p.id, kind: 'tx', id: t.id, data: strip(t) };
    });
    (db.recurring || []).forEach(function (r) {
      if (!(r.tx && r.tx.propertyId === p.id) || !podeExportar(p.id, 'rec')) return;
      map['r:' + p.id + ':rec:' + r.id] = { scope: 'record', houseId: p.id, kind: 'rec', id: r.id, data: strip(r) };
    });
    (db.visits || []).forEach(function (v) {
      if (v.propertyId !== p.id || !podeExportar(p.id, 'visit')) return;
      map['r:' + p.id + ':visit:' + v.id] = { scope: 'record', houseId: p.id, kind: 'visit', id: v.id, data: strip(v) };
    });
    Object.keys(persons).forEach(function (k) {
      var kind = k.split(':')[0], id = k.split(':')[1];
      if (!podeExportar(p.id, kind)) return;
      map['r:' + p.id + ':' + kind + ':' + id] = { scope: 'record', houseId: p.id, kind: kind, id: id, data: strip(persons[k]) };
      emImovel[id] = 1;
    });
  });
  (db.transactions || []).forEach(function (t) {
    if (t.propertyId) return;
    map['u:tx:' + t.id] = { scope: 'user', kind: 'tx', id: t.id, data: strip(t) };
  });
  (db.recurring || []).forEach(function (r) {
    if (r.tx && r.tx.propertyId) return;
    map['u:rec:' + r.id] = { scope: 'user', kind: 'rec', id: r.id, data: strip(r) };
  });
  (db.templates || []).forEach(function (x) { map['u:tpl:' + x.id] = { scope: 'user', kind: 'tpl', id: x.id, data: strip(x) }; });
  (db.groups || []).forEach(function (x) { map['u:group:' + x.id] = { scope: 'user', kind: 'group', id: x.id, data: strip(x) }; });
  // os "proprietários" são os utilizadores: só o meu perfil é exportado
  var meOwner = CW.user && owners.find(function (o) { return o.id === CW.user.id; });
  if (meOwner) map['u:profile:main'] = { scope: 'user', kind: 'profile', id: 'main', data: strip(meOwner) };
  // as fichas minhas sobem como registo de utilizador — as que já subiram
  // como registo de um imóvel não (uma ficha, uma chave), nem as presas a um
  // imóvel de colaboração cujo cargo não as deixa subir: não são minhas. Uma
  // presa a um imóvel que já não está em db.properties (apagado) sobe aqui
  tenants.forEach(function (t) {
    if (t._sharedFrom || emImovel[t.id]) return;
    var h = casaDaFicha(t);
    if (h && !souDono(h) && prop(h)) return;
    map['u:tenant:' + t.id] = { scope: 'user', kind: 'tenant', id: t.id, data: strip(t) };
  });
  var st = strip(db.settings);
  delete st.theme;   // preferência do aparelho: fica de fora da sincronização
  map['u:settings:main'] = { scope: 'user', kind: 'settings', id: 'main', data: st };
  /* um serviço desligado nesta conta congela as chaves dele: nem sobem (o
     servidor recusava-as) nem se apagam (o pushNow salta-as também) — o
     estado do servidor manda, e volta a trazê-las quando o serviço religar */
  Object.keys(map).forEach(function (k) { if (chaveCongelada(map[k])) delete map[k]; });
  return map;
}

/* Uma entidade (ou uma chave do retrato, decomposta) de um serviço desligado
   nesta conta? Sem os Imóveis, as casas e os registos delas todos; senão, os
   kinds do serviço (web/app/servicos.js:kindDesligado).
   Recebe: e — {scope, kind} (uma entrada do mapa ou o resultado de parseKey).
   Devolve: true se está congelada, false se pode seguir. */
function chaveCongelada(e) {
  if (typeof kindDesligado !== 'function' || !e) return false;
  if (e.scope === 'house') return !servicoLigado('properties');
  if (e.scope === 'record') return !servicoLigado('properties') || kindDesligado(e.kind, 'record');
  return kindDesligado(e.kind, 'user');
}

// Decompõe uma chave do retrato ('h:...', 'r:...', 'u:...') em {scope, houseId?,
// kind?, id?} — o inverso das chaves que exportEntities() constrói.
// Recebe: k — a chave em texto ('h:casa', 'r:casa:tipo:id' ou 'u:tipo:id').
// Devolve: objeto {scope, houseId?, kind?, id?} com as partes da chave.
function parseKey(k) {
  var p = k.split(':');
  if (p[0] === 'h') return { scope: 'house', houseId: p[1] };
  if (p[0] === 'r') return { scope: 'record', houseId: p[1], kind: p[2], id: p.slice(3).join(':') };
  return { scope: 'user', kind: p[1], id: p.slice(2).join(':') };
}

/* ---------------- push ---------------- */

var pushing = false, pushAgain = false, pushTimer = null;
/* O selo (ETag) e o resumo do último estado aplicado nesta página. Dizem
   «o servidor está como estava quando o apliquei» — e deixam de o dizer
   assim que se envia alguma coisa, ou quando a sessão muda: aí a leitura
   seguinte é inteira. Não se guardam no aparelho: o CW.state (cargos,
   ligações, pedidos) só vive em memória, e a primeira leitura da página tem
   de o trazer. */
var seloAplicado = '', resumoAplicado = '';
var semLigacao = false;   // a última conversa com o servidor falhou por falta de rede

// Agenda um envio daqui a 1,2s, juntando alterações seguidas num só push.
// Com a app trancada pela versão mínima não arma nada.
// Devolve: nada — (re)arma o temporizador que chama pushNow.
function schedulePush() {
  if (!CW.user || CW.trancado) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(function () { pushTimer = null; pushNow(); }, 1200);
}

// Manda já o envio que estava agendado — a app vai para segundo plano, e os
// 1,2 s podiam não chegar. O que não sair fica na base e no arranque seguinte
// sobe (o applyState funde-o), por isso isto é pressa, não rede de segurança.
// Devolve: nada — dispara o pushNow se havia um envio à espera.
function despacharJa() {
  if (!pushTimer) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  pushNow();
}

// A descrição curta de um registo, para os avisos («Renda de março», «T2 — Ana»).
// Recebe: kind — o tipo ('tx', 'contract', 'rec', 'visit', 'tenant'); data — o registo.
// Devolve: um texto curto; o tipo por extenso quando o registo não tem nome.
function descricaoDe(kind, data) {
  var d = data || {};
  var nomes = { tx: 'O movimento', contract: 'O contrato', rec: 'O planeado', visit: 'A visita', tenant: 'A ficha de inquilino' };
  var t = kind === 'tx' ? (d.label || d.category) : kind === 'visit' ? d.nomes : (d.name || d.label);
  return t ? String(t).slice(0, 60) : (nomes[kind] || 'O registo');
}

/* O servidor recusou um registo por falta de permissão (403 num put de
   registo, num imóvel onde sou colaborador): sai da base local e diz-se na
   hora. Sem isto a pessoa via o registo «guardado» e ele nunca subia. Sai
   também do retrato: o que falta cá não é uma remoção por enviar, e o
   próximo estado traz a versão do servidor, se existir.
   Recebe: o — a operação do push ({kind, id, houseId, data, _key}); erro — a
   frase do servidor (pode vir vazia; o toast diz a razão pela sua voz).
   Devolve: nada — mexe em db e junta a descrição à lista para o toast. */
function recusaRegisto(o, erro) {
  var lista = listaDe(o) || [];
  var i = -1;
  for (var k = 0; k < lista.length; k++) if (lista[k].id === o.id) { i = k; break; }
  var reg = i > -1 ? lista.splice(i, 1)[0] : null;
  delete snap[o._key];
  pushNow._recusadosAgora = (pushNow._recusadosAgora || []).concat([descricaoDe(o.kind, reg || o.data)]);
}

/* O 403 de um serviço desligado nesta conta, distinguido do 403 de permissão
   num imóvel de colaboração: o servidor manda `servico` (rotas/sync.js), e a
   frase serve de rede para uma resposta sem ele.
   Recebe: r — o resultado de uma op do /api/sync ({ok, status, error, servico?}).
   Devolve: o id do serviço (string), ou '' quando não é uma recusa de serviço. */
function servicoRecusado(r) {
  if (!r || r.ok || r.status !== 403 || typeof servicoDe !== 'function') return '';
  if (r.servico && servicoDe(r.servico)) return r.servico;
  var frase = String(r.error || '');
  if (frase.indexOf('está desligado nesta conta') < 0) return '';
  var s = SERVICOS.find(function (x) { return frase.indexOf('O serviço ' + x.nome + ' ') > -1; });
  return s ? s.id : '';
}

/* A lista onde vive uma entidade do push (ou de uma chave do retrato,
   decomposta), pelo scope e pelo kind.
   Recebe: o — a operação do push, ou o resultado de parseKey ({scope, kind});
   d (opcional) — a base onde procurar (db por omissão).
   Devolve: o array da base (ou null para o que não é lista, como as definições). */
function listaDe(o, d) {
  d = d || db;
  if (o.scope === 'house') return d.properties;
  var listas = { contract: 'contracts', tx: 'transactions', rec: 'recurring', visit: 'visits', tenant: 'tenants', tpl: 'templates', group: 'groups' };
  return listas[o.kind] ? (d[listas[o.kind]] = d[listas[o.kind]] || []) : null;
}

/* O servidor recusou uma operação porque o serviço dela está desligado nesta
   conta — a pessoa escreveu (ou apagou) na janela entre o suporte desligar e
   o estado chegar. Um «put» sai da base local (o servidor nunca o teria;
   deixá-lo ficar era reenviá-lo a cada gravação e perdê-lo em silêncio no
   estado seguinte); um «del» não passa por feito — o registo continua no
   servidor, e volta ao aparelho com o estado em que o serviço religar (o
   retrato guarda resumos, não o registo, para o repor já). Em ambos, o
   serviço fica desligado já no aparelho (o estado seguinte confirma) e
   diz-se a razão certa, uma vez por serviço, no fim do envio.
   Recebe: o — a operação do push ({op, scope, kind, id, houseId, data, _key});
   sid — o id do serviço desligado.
   Devolve: nada — mexe em db e junta o aviso à lista do fim do envio. */
function recusaPorServico(o, sid) {
  var lista = listaDe(o);
  var i = -1;
  var id = o.scope === 'house' ? o.houseId : o.id;
  if (lista) for (var k = 0; k < lista.length; k++) if (lista[k].id === id) { i = k; break; }
  var nome;
  if (o.op === 'put') {
    var reg = i > -1 ? lista.splice(i, 1)[0] : null;
    delete snap[o._key];
    nome = o.scope === 'house' ? (((reg || o.data) || {}).name || 'O imóvel') : descricaoDe(o.kind, reg || o.data);
  } else {
    nome = o.scope === 'house' ? 'O imóvel' : descricaoDe(o.kind, {});
  }
  pushNow._servicoAgora = (pushNow._servicoAgora || []).concat([{ servico: sid, nome: nome, op: o.op }]);
}

/* Quantas operações de um envio ainda não chegaram ao servidor: os «put»
   cujo resumo o retrato ainda não tem, e os «del» que ainda lá estão.
   Recebe: ops — as operações do envio.
   Devolve: o número (para o selo «N por enviar»). */
function porEnviar(ops) {
  return ops.filter(function (o) { return o.op === 'put' ? snap[o._key] !== o._res : (o._key in snap); }).length;
}

/* Diz a frase do servidor quando ele recusou o envio inteiro (429: demasiadas
   gravações seguidas; 5xx) — a mesma frase uma vez em cada cinco minutos: o
   ciclo volta a tentar de 30 em 30 segundos, e repeti-la era ruído.
   Recebe: msg — a frase (pode vir vazia).
   Devolve: nada — mostra o toast, ou não. */
function avisoDoServidor(msg) {
  var m = String(msg || ''), agora = Date.now();
  if (avisoDoServidor._m === m && agora - (avisoDoServidor._t || 0) < 300000) return;
  avisoDoServidor._m = m; avisoDoServidor._t = agora;
  try { toast(m || 'O servidor não aceitou o envio agora. Fica neste aparelho e segue depois.', { ms: 6000 }); } catch (e) {}
}

/* Envia ao servidor a diferença entre o estado local e o retrato: 'put' do que
   mudou (casas primeiro, que os registos dependem delas) e 'del' do que
   desapareceu, em lotes de 200. Atualiza o retrato à medida que o servidor
   aceita e acerta o selo de sincronização. Reentrante: se já está a enviar, fica marcado um novo
   envio para o fim. Com a app trancada pela versão mínima não envia nada — uma
   versão velha demais para se usar é velha demais para escrever, e este é o
   ponto único de escrita dos dados. A Promise devolvida nunca rejeita.
   Devolve: Promise que resolve quando o envio terminar (nunca rejeita). */
function pushNow() {
  if (!CW.user || CW.trancado) return Promise.resolve();
  if (pushing) { pushAgain = true; return Promise.resolve(); }
  pushing = true;
  var map = exportEntities();
  var ops = [];
  // casas primeiro (os registos precisam da casa), remoções no fim
  Object.keys(map).forEach(function (k) {
    var rs = resumoDeTexto(JSON.stringify(map[k].data));
    if (snap[k] !== rs) ops.push(Object.assign({ _key: k, _res: rs, op: 'put' }, map[k]));
  });
  ops.sort(function (a, b) {
    var w = function (o) { return o.scope === 'house' ? 0 : 1; };
    return w(a) - w(b);
  });
  var sharedHouses = {};
  (CW.state.houses || []).forEach(function (h) { if (!h.mine) sharedHouses[h.id] = 1; });
  /* o que vai subir agora e o que a pessoa tem por enviar: diz-se, em vez de
     ficar em silencio ate correr mal */
  if (ops.length) setSyncBadge('pend', ops.length);
  /* As remoções por diferença esperam pelo primeiro estado. O retrato é por
     utilizador e não se apaga ao sair; o db é apagado no finishLogin quando
     quem entra é outra conta. Base vazia mais retrato cheio dava um «del»
     para tudo o que a conta tem no servidor — e bastava um save() na janela
     entre entrar e o estado chegar (o notifPartilha grava a marca de leitura
     logo na primeira contagem) para o push partir. Os «put» seguem: o que
     desapareceu espera pelo applyState, que refaz o retrato por inteiro. */
  var sabeOServidor = !!CW._pulled;
  Object.keys(snap).forEach(function (k) {
    if (k in map) return;
    if (!sabeOServidor) return;
    // o perfil nunca é apagado por diff (um restauro de cópia local não o traz)
    if (k === 'u:profile:main') { delete snap[k]; return; }
    var pk = parseKey(k);
    // uma chave de um serviço desligado nesta conta está congelada: não é o
    // cliente que a apaga — o applyState refaz o retrato pelo que o servidor tem
    if (chaveCongelada(pk)) return;
    // proteção contra "Recomeçar"/restauros: não apagar em bloco os dados de
    // casas dos outros — só remoções pontuais (a casa continua presente)
    var houseGone = pk.houseId && !('h:' + pk.houseId in map);
    if (sharedHouses[pk.houseId] && houseGone) { delete snap[k]; return; }
    ops.push(Object.assign({ _key: k, op: 'del' }, pk));
  });
  if (!ops.length) { pushing = false; return Promise.resolve(); }
  // enviar muda o servidor (ou tenta): o selo do último estado deixa de valer
  seloAplicado = ''; resumoAplicado = '';

  var chain = Promise.resolve();
  for (var i = 0; i < ops.length; i += 200) {
    (function (chunk) {
      chain = chain.then(function () {
        return api('POST', '/api/sync', {
          ops: chunk.map(function (o) {
            return { op: o.op, scope: o.scope, houseId: o.houseId, kind: o.kind, id: o.id, data: o.data };
          }),
        }).then(function (res) {
          (res.results || []).forEach(function (r, idx) {
            var o = chunk[idx];
            if (!o) return;
            var sid = servicoRecusado(r);
            if (o.op === 'put' && r.ok) snap[o._key] = o._res;
            // um serviço desligado nesta conta: diz-se a razão certa, e não se insiste
            else if (sid) recusaPorServico(o, sid);
            else if (o.op === 'del' && (r.ok || r.status === 403 || r.status === 404)) delete snap[o._key];
            // sem permissão num imóvel de colaboração: o registo não fica a fingir que subiu
            else if (o.op === 'put' && o.scope === 'record' && r.status === 403) recusaRegisto(o, r.error);
            else pushNow._recusadas = (pushNow._recusadas || 0) + 1;
          });
        });
      });
    })(ops.slice(i, i + 200));
  }
  return chain
    .then(function () {
      saveSnap();
      semLigacao = false;
      /* um 200 com operações recusadas lá dentro ficava 'ok' para sempre,
         com o selo verde e os dados sem subir — e «Sem ligação» também não
         é: o servidor respondeu. Ficam por enviar, e o ciclo volta a tentar */
      var recusadas = pushNow._recusadas || 0; pushNow._recusadas = 0;
      setSyncBadge(recusadas ? 'pend' : 'ok', recusadas);
      var fora = pushNow._recusadosAgora || []; pushNow._recusadosAgora = [];
      if (fora.length) {
        try { rawSet(KEY, JSON.stringify(db)); render(); } catch (e) {}
        try {
          toast(fora[0] + ' não foi guardado: sem permissão neste imóvel.' +
            (fora.length > 1 ? ' E mais ' + (fora.length - 1) + '.' : ''), { ms: 6000 });
        } catch (e) {}
      }
      /* o que um serviço desligado recusou: o serviço fica desligado já no
         aparelho (o separador some, e não se volta a tentar), a base local
         acompanha, e diz-se a razão — uma vez por serviço */
      var porServico = pushNow._servicoAgora || []; pushNow._servicoAgora = [];
      if (porServico.length) {
        var ids = porServico.map(function (x) { return x.servico; });
        try { definirServicosDesligados(servicosDesligados().concat(ids)); } catch (e) {}
        try { if (!separadorLigado(tab)) { tab = primeiroSeparadorLigado(); setPage = ''; } } catch (e) {}
        try { rawSet(KEY, JSON.stringify(db)); buildNav(); render(); } catch (e) {}
        ids.filter(function (id, n) { return ids.indexOf(id) === n; }).forEach(function (id) {
          var dele = porServico.filter(function (x) { return x.servico === id; });
          var verbo = dele[0].op === 'del' ? ' não foi apagado' : ' não foi guardado';
          try {
            toast(dele[0].nome + verbo + ': o serviço ' + nomeDoServico(id) + ' está desligado nesta conta.' +
              (dele.length > 1 ? ' E mais ' + (dele.length - 1) + '.' : ''), { ms: 7000 });
          } catch (e) {}
        });
      }
      try { subirPendentes(); } catch (e) {}
    })
    .catch(function (e) {
      pushNow._recusadas = 0;
      saveSnap();   // o que um lote anterior já fez subir fica marcado
      if (e && e.status) {
        /* o servidor respondeu e recusou o envio inteiro — 429 («Demasiadas
           gravações seguidas… os dados não se perdem»), 5xx. Não é falta de
           rede: o selo fica em «N por enviar» e a frase dele chega à pessoa */
        semLigacao = false;
        setSyncBadge('pend', porEnviar(ops));
        avisoDoServidor(e.message);
      } else {
        semLigacao = true;   // sem rede, ou sem resposta a tempo
        setSyncBadge('off');
      }
    })
    .then(function () {
      pushing = false;
      if (pushAgain) { pushAgain = false; schedulePush(); }
    });
}

/* ---------------- pull ---------------- */

var lastPull = 0;

// Se um id está num conjunto que pode vir como Set, array ou objeto (a forma
// de ownersIds depende de quem o montou).
// Recebe: conj — o conjunto (Set, array ou objeto {id: true}; aguenta null); id — o id.
// Devolve: true se está lá.
function temId(conj, id) {
  if (!conj) return false;
  if (typeof conj.has === 'function') return conj.has(id);
  if (Array.isArray(conj)) return conj.indexOf(id) > -1;
  return !!conj[id];
}

// Os colaboradores de um imóvel meu, lidos de st.collaborators (que só o dono recebe).
// Recebe: st — o estado; houseId — o id do imóvel.
// Devolve: array de {id, userId, name, roleId, roleName} (vazio quando não há).
function colaboradoresDe(st, houseId) {
  return (st.collaborators || []).filter(function (c) {
    return (c.houses || []).some(function (h) { return h.id === houseId; });
  }).map(function (c) {
    return { id: c.id, userId: c.userId, name: c.name || '', roleId: c.roleId, roleName: c.roleName || '' };
  });
}

/* Quem colabora num imóvel onde sou dono ou comproprietário: a lista que o
   servidor manda na própria casa (h.collaborators — vem também nas casas em
   compropriedade, para o comproprietário ver quem lá entra) ou, num servidor
   que ainda não a manda, a lista global do dono (só nas minhas).
   Recebe: st — o estado; h — a casa do estado ({id, mine, collaborators?}).
   Devolve: array de {id, userId, name, roleId, roleName} (vazio quando não há). */
function colaboradoresDaCasa(st, h) {
  if (Array.isArray(h.collaborators)) {
    return h.collaborators.map(function (c) {
      return { id: c.id, userId: c.userId, name: c.name || '', roleId: c.roleId || '', roleName: c.roleName || '' };
    });
  }
  return h.mine ? colaboradoresDe(st, h.id) : [];
}

/* Se este utilizador é um colaborador puro: tem cargo em imóveis meus e
   nenhuma casa em comum comigo (é o kind 'collab' de st.people). É o único
   que nunca vira ficha em db.owners.
   Recebe: uid — o id do utilizador.
   Devolve: true se é colaborador puro; false para donos, comproprietários e desconhecidos. */
function colaboradorPuro(uid) {
  var pe = CW.pessoas && CW.pessoas[uid];
  return !!(pe && pe.kind === 'collab');
}

/* Reconstrói a base local inteira a partir do estado do servidor: casas com
   donos e quotas vindas de lá, registos por casa, dados do utilizador e
   perfis — os "proprietários" passam a ser os utilizadores com acesso.
   Os imóveis onde sou colaborador levam _cargo (e _sharedFrom); os meus e os
   em compropriedade levam _colaboradores; um colaborador nunca entra em
   ownerIds nem em db.owners — fica em CW.pessoas, só com o nome. Quem vem
   em profiles sem ser colaborador (comproprietário de outrora, conta apagada
   «[deleted]» referida num movimento) continua a virar ficha, só com o nome.
   Devolve o db novo, normalizado e filtrado por dropUnsafe; não toca no
   db global.
   Recebe: st — o estado vindo de GET /api/state ({houses, records, userRecords,
   profiles, collaborators, people, …}).
   Devolve: o db novo (objeto com a forma de blank), pronto a substituir o local. */
function rebuildDb(st) {
  var d = JSON.parse(JSON.stringify(blank));
  var myId = CW.user ? CW.user.id : '';
  var tenants = {}, tenantsAt = {}, tenantsMeus = {};
  var myProfile = null;
  // quem é o quê em cada imóvel: a parte pura vive em web/app/acessos.js
  var acessos = cargosDoEstado(st, myId);
  CW.cargos = acessos.cargos;
  CW.pessoas = acessos.pessoas;
  var ownersIds = acessos.ownersIds;
  (st.userRecords || []).forEach(function (r) {
    try {
      if (r.kind === 'settings') d.settings = Object.assign({}, blank.settings, r.data, { theme: localTheme() });
      else if (r.kind === 'profile') myProfile = r.data;
      else if (r.kind === 'tx') d.transactions.push(normTx(r.data));
      else if (r.kind === 'rec') d.recurring.push(normRec(r.data));
      else if (r.kind === 'tpl') d.templates.push(normTpl(r.data));
      else if (r.kind === 'group') d.groups.push(normGroup(r.data));
      else if (r.kind === 'tenant') { tenants[r.id] = normPerson(r.data); tenantsAt[r.id] = r.updatedAt || 0; tenantsMeus[r.id] = 1; }
      // kind 'owner' (modelo antigo) é ignorado: os proprietários são os utilizadores
    } catch (e) { relatarIlegivel('u', r, e); }
  });
  var houseOwner = {};
  (st.houses || []).forEach(function (h) {
    try {
      var p = normProp(h.data);
      if (!h.mine) { p._ownerUserId = h.ownerId; p._sharedFrom = h.ownerName || h.ownerId; }
      // colaborador: o cargo (para o selo e as decisões) e a linha de
      // colaboração (para o «Sair»); dono: quem colabora neste imóvel
      if (h.collab) {
        p._cargo = h.collab.roleName || 'Colaborador';
        if (h.collab.id) p._collabId = h.collab.id;
      }
      if (!h.collab) p._colaboradores = colaboradoresDaCasa(st, h);
      // os donos do imóvel são os utilizadores com acesso (dono + partilhas);
      // as quotas vêm do servidor e só mudam por proposta confirmada. Um
      // colaborador nunca está aqui — nem eu, num imóvel onde o sou.
      var parts = (h.participants || [h.ownerId]).filter(function (u) { return !(h.collab && u === myId); });
      p.ownerIds = parts.slice();
      var rawSh = (h.data && h.data.ownerShares) || {};
      var shr = {};
      parts.forEach(function (u) { var v = Number(rawSh[u]); if (isFinite(v) && v >= 0) shr[u] = v; });
      p.ownerShares = shr;
      houseOwner[h.id] = h;
      d.properties.push(p);
    } catch (e) { relatarIlegivel('h', h, e); }
  });
  (st.records || []).forEach(function (r) {
    try {
      var h = houseOwner[r.houseId], mine = h ? h.mine : false;
      // quem escreveu e quando, para o sino das notificações; os campos com
      // _ nunca voltam ao servidor (o strip tira-os no export)
      var marca = function (x) {
        if (r.author) x._author = r.author;
        if (r.updatedAt) x._atServidor = r.updatedAt;
        if (r.createdBy) x._createdBy = r.createdBy;   // quem criou: só ele (ou o dono) edita
        return x;
      };
      if (r.kind === 'contract') d.contracts.push(marca(normContract(r.data)));
      else if (r.kind === 'tx') d.transactions.push(marca(normTx(r.data)));
      else if (r.kind === 'rec') d.recurring.push(marca(normRec(r.data)));
      else if (r.kind === 'visit') d.visits.push(marca(normVisit(r.data)));
      else if (r.kind === 'tenant') {
        var per = marca(normPerson(r.data));
        // de outro dono — a menos que a ficha seja minha (criei-a eu, ou está
        // também nos meus registos): «Ficha de …» numa ficha minha era falso
        if (!mine && !tenantsMeus[r.id] && !(myId && r.createdBy === myId)) per._sharedFrom = h ? h.ownerName : '';
        // o imóvel da ficha: é por ele que se decide quem a edita e onde
        // se mostra. Fica na ficha (houseId, sobe com ela) e na marca do
        // servidor (_houseId), para o dono e o colaborador a verem no
        // imóvel certo
        per.houseId = r.houseId;
        per._houseId = r.houseId;
        /* A mesma ficha pode vir em mais do que uma chave: em dois imóveis
           (ligada por contratos nos dois), ou em u:tenant e aqui — a dupla que
           as versões anteriores faziam subir e que o push seguinte desfaz
           (exportEntities, applyState). Vale a escrita mais recente; quando é
           a cópia u:tenant, ficam nela as marcas do registo da casa (quem a
           criou, quem a escreveu), que a cópia não tem. */
        var antes = tenants[r.id], at = r.updatedAt || 0;
        if (!antes || at >= (tenantsAt[r.id] || 0)) { tenants[r.id] = per; tenantsAt[r.id] = at; }
        else ['_author', '_atServidor', '_createdBy'].forEach(function (k) { if (per[k] !== undefined && antes[k] === undefined) antes[k] = per[k]; });
      }
    } catch (e) { relatarIlegivel('r', r, e); }
  });
  // proprietários = utilizadores: eu (com o meu perfil) + os outros com perfil visível
  var ownersOut = {};
  var minePer = normPerson(myProfile || {});
  minePer.id = myId;
  if (!minePer.name) minePer.name = (CW.user && (CW.user.name || CW.user.email)) || '';
  ownersOut[myId] = minePer;
  // quem é referido em «pago por» ou num acerto de algum movimento (das
  // casas ou meu): ganha ficha mesmo que o servidor o marque colaborador —
  // o ex-comproprietário que pagou o condomínio e hoje só colabora
  var referidos = {};
  d.transactions.forEach(function (t) {
    if (t.paidBy) referidos[t.paidBy] = true;
    if (t.toId) referidos[t.toId] = true;
  });
  (st.profiles || []).forEach(function (pr) {
    if (pr.userId === myId) return;
    // um colaborador puro que nenhum movimento refere nunca vira ficha de
    // proprietário — fica em CW.pessoas, com o nome. Todos os outros
    // (comproprietários, ligações aceites e quem é referido em paidBy/toId
    // de movimentos: contas apagadas «[deleted]», ex-comproprietários, mesmo
    // que hoje sejam colaboradores) viram ficha só com o nome, para «Pago
    // por …», os acertos e o CSV continuarem legíveis
    if (!temId(ownersIds, pr.userId) && !referidos[pr.userId] && colaboradorPuro(pr.userId)) return;
    var per = normPerson(pr.data || {});
    per.id = pr.userId;
    per._userId = pr.userId;
    if (!per.name) per.name = pr.name || (CW.pessoas[pr.userId] || {}).name || pr.userId;
    ownersOut[pr.userId] = per;
  });
  d.owners = Object.keys(ownersOut).map(function (k) { return ownersOut[k]; });
  d.tenants = Object.keys(tenants).map(function (k) { return tenants[k]; });
  fillCats(d.settings);
  if (!Array.isArray(d.settings.tags)) d.settings.tags = TAGS0.slice();
  return dropUnsafe(d);
}

/* Acabou a espera pelo primeiro estado do servidor.

   Enquanto ela dura, a app não afirma nada que o servidor possa desmentir a
   seguir: sem isto, o sino contava rendas já confirmadas noutro aparelho e o
   cartão dos «por confirmar» anunciava-as, tudo a desaparecer um segundo
   depois (espera.js:sabemosOEstado). Mas a espera tem de ACABAR, e não só
   quando o servidor responde: sem rede, o que está no aparelho é tudo o que
   há, e calar o sino para sempre era trocar um erro de um segundo por um
   silêncio permanente.

   Distinto do CW._pulled de propósito: esse continua a dizer «o servidor
   falou», que é o que a página dos cargos precisa de saber para não confundir
   «não tens colaboradores» com «ainda não sabemos».
   Devolve: nada — levanta a espera e repinta, uma vez só. */
function fimDaEspera() {
  if (CW._esperaFim) return;
  CW._esperaFim = 1;
  try { buildNav(); render(); } catch (e) {}
}
/* Um registo do servidor que não se deixa ler (a normalização rebentou): não
   entra na base — nem, por isso, na exportação —, fica congelado no servidor
   (o applyState não o dá por obsoleto) e vai no relato de erro, com a chave e
   sem os dados. Um catch vazio engolia-o, e o push seguinte apagava-o.
   Recebe: onde — 'h', 'r' ou 'u' (casa, registo de casa, registo meu); r —
   o registo tal como veio; e — o erro.
   Devolve: nada — relata (e nunca lança). */
function relatarIlegivel(onde, r, e) {
  try {
    if (typeof reportErr !== 'function') return;
    r = r || {};
    var chave = onde === 'h' ? 'h:' + r.id : onde === 'r' ? 'r:' + r.houseId + ':' + r.kind + ':' + r.id : 'u:' + r.kind + ':' + r.id;
    reportErr('Um registo do servidor não se deixou ler (' + (onde === 'h' ? 'house' : r.kind) + ')',
      chave + ' · ' + String((e && e.message) || e));
  } catch (x) {}
}

/* Os kinds que o cliente reconhece e decidiu deixar de exportar: o que o
   servidor ainda tem deles é apagado pelo push seguinte. 'owner' são os
   proprietários do modelo antigo — hoje os proprietários são os utilizadores. */
var KINDS_RETIRADOS = ['owner'];

// A identidade da entidade por trás de uma chave: a casa pelo id, e os
// registos pelo tipo e pelo id — o mesmo movimento é a mesma entidade em
// r:<casa>:tx e em u:tx, porque vivem na mesma lista da base.
// Recebe: pk — o resultado de parseKey.
// Devolve: um texto ('h:<id>' ou '<kind>:<id>').
function entidadeDe(pk) {
  return pk.scope === 'house' ? 'h:' + pk.houseId : pk.kind + ':' + pk.id;
}

// O objeto da base que uma chave exporta: a casa, o registo, as definições,
// o meu perfil.
// Recebe: d — a base; pk — o resultado de parseKey.
// Devolve: o objeto, ou null se não estiver lá.
function objetoDaChave(d, pk) {
  if (pk.scope === 'user' && pk.kind === 'settings') return d.settings || null;
  var perfil = pk.scope === 'user' && pk.kind === 'profile';
  var lista = perfil ? d.owners : listaDe(pk, d);
  var id = pk.scope === 'house' ? pk.houseId : perfil ? (CW.user ? CW.user.id : '') : pk.id;
  return (lista || []).find(function (x) { return x && x.id === id; }) || null;
}

/* O que este aparelho tem e o servidor ainda não: a diferença entre a
   exportação local e o retrato — a conta do pushNow, feita ANTES de o estado
   novo substituir o db. Uma chave que o retrato não tem é nova daqui só se o
   servidor também não a tiver (senão, é do servidor: um registo de um imóvel
   de colaboração que o cargo não deixa subir não está no retrato, e a
   exportação do arranque, ainda sem os cargos em memória, mostra-o). Uma
   chave do retrato que a exportação já não tem só conta como remoção se a
   entidade desapareceu mesmo (não passou para outra chave — a ficha que
   passou de r: a u:, o movimento que mudou de imóvel), se não está congelada
   por um serviço desligado, e se não é de uma casa de outro dono que sumiu
   daqui (a proteção do pushNow contra «Recomeçar» e restauros). E sem nenhum
   registo na base, nenhuma remoção conta: base vazia com retrato cheio não é
   «apaguei tudo» (o travão do pushNow, testes/pre-pull.test.js).
   Recebe: st — o estado que vai ser aplicado; noServidor — {chave: 1} das
   chaves que ele traz.
   Devolve: {puts: {chave: cópia do objeto local}, dels: {chave: 1}, n}. */
function pendentesLocais(st, noServidor) {
  var map = exportEntities();
  var puts = {}, dels = {}, n = 0, registos = 0, vivas = {};
  Object.keys(map).forEach(function (k) {
    var pk = parseKey(k);
    vivas[entidadeDe(pk)] = 1;
    if (k !== 'u:settings:main' && k !== 'u:profile:main') registos++;
    if (!(k in snap) && noServidor[k]) return;
    if (snap[k] === resumoDeTexto(JSON.stringify(map[k].data))) return;
    var obj = objetoDaChave(db, pk);
    if (obj) { puts[k] = JSON.parse(JSON.stringify(obj)); n++; }
  });
  if (!registos) return { puts: puts, dels: dels, n: n };
  var partilhadas = {};
  (st.houses || []).forEach(function (h) { if (!h.mine) partilhadas[h.id] = 1; });
  Object.keys(snap).forEach(function (k) {
    if (k in map || snap[k] === '__obsoleto__' || k === 'u:profile:main') return;
    var pk = parseKey(k);
    if (chaveCongelada(pk) || vivas[entidadeDe(pk)]) return;
    if (pk.houseId && partilhadas[pk.houseId] && !(('h:' + pk.houseId) in map)) return;
    dels[k] = 1; n++;
  });
  return { puts: puts, dels: dels, n: n };
}

/* O objeto local com o que é do servidor: as marcas (os campos com '_' —
   quem escreveu e quando, o cargo, de quem é) e, numa casa, os donos e as
   quotas, que só mudam por proposta confirmada. O resto é o que foi escrito
   aqui e ainda não subiu.
   Recebe: local — o objeto deste aparelho; servidor — a versão da base refeita.
   Devolve: um objeto novo. */
function fundidoComServidor(local, servidor) {
  var doServidor = function (k) { return k.charAt(0) === '_' || k === 'ownerIds' || k === 'ownerShares'; };
  var c = JSON.parse(JSON.stringify(local));
  Object.keys(c).forEach(function (k) { if (doServidor(k)) delete c[k]; });
  Object.keys(servidor || {}).forEach(function (k) { if (doServidor(k)) c[k] = servidor[k]; });
  return c;
}

/* Volta a pôr por cima da base refeita a partir do servidor o que ainda não
   lhe chegou (pendentesLocais): primeiro as remoções, depois o que é novo ou
   foi mexido aqui — o objeto local, com as marcas do servidor quando ele já o
   tem.
   Recebe: d — a base refeita (rebuildDb); pend — o resultado de pendentesLocais.
   Devolve: nada — mexe em d. */
function reporPendentes(d, pend) {
  Object.keys(pend.dels).forEach(function (k) {
    var pk = parseKey(k), lista = listaDe(pk, d);
    var id = pk.scope === 'house' ? pk.houseId : pk.id;
    if (!lista) return;
    for (var i = lista.length - 1; i >= 0; i--) if (lista[i] && lista[i].id === id) lista.splice(i, 1);
  });
  Object.keys(pend.puts).forEach(function (k) {
    var pk = parseKey(k), local = pend.puts[k];
    if (pk.scope === 'user' && pk.kind === 'settings') {
      d.settings = Object.assign({}, local, { theme: localTheme() });
      return;
    }
    var lista = pk.scope === 'user' && pk.kind === 'profile' ? d.owners : listaDe(pk, d);
    if (!lista) return;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].id === local.id) { lista[i] = fundidoComServidor(local, lista[i]); return; }
    }
    lista.push(local);
  });
}

/* Adota o estado do servidor sem perder o que este aparelho ainda não lhe
   enviou. É uma fusão a três, com o retrato como base: o que aqui está igual
   ao retrato (não foi mexido desde a última conversa) passa a ser o que o
   servidor tem — incluindo desaparecer, se ele o apagou; o que é novo, foi
   editado ou foi apagado aqui (pendentesLocais) fica por cima, e o push
   seguinte envia-o. Substituía o db inteiro pelo do servidor: uma despesa
   registada sem rede na cave do prédio, o que se gravou nos 1,2 s antes de
   fechar a app, ou um envio que falhou com 429 ou 5xx desapareciam no
   arranque (ou na leitura seguinte), com o selo a dizer «Guardado». Numa
   edição dos dois lados ganha a daqui, que é a última a subir.
   Duas exceções, onde a base local não tem este retrato por base: se é de
   outra conta (LS_OWNER), o servidor manda e nada dela sobe; sem retrato (a
   primeira sessão desta conta no aparelho), os dados locais só sobem se o
   servidor estiver vazio — a migração de quem já usava a app sem conta —,
   senão manda o servidor, como sempre. Com retrato e o servidor vazio, o
   servidor vence o que aqui não mudou: é um «Recomeçar» feito noutro
   aparelho, que não se desfaz a partir deste.
   O retrato novo é o que o servidor tem, na forma local. O que o servidor tem
   e o cliente decidiu deixar de exportar fica marcado para o push apagar: os
   kinds retirados (KINDS_RETIRADOS) e as chaves antigas de uma entidade que
   vive noutra chave (a cópia u:tenant de uma ficha de imóvel). O que o
   cliente não sabe ler — um kind de uma versão mais nova, um registo que não
   normaliza — nunca: fica congelado, para a versão que o sabe ler. Nem o que
   não sobe por falta de permissão num imóvel de colaboração: isso é do dono.
   Grava tudo no aparelho e redesenha.
   Recebe: st — o estado vindo de GET /api/state (o mesmo que rebuildDb
   recebe); selo, resumoSt (opcionais) — o ETag e o resumo da resposta, que a
   leitura seguinte usa para saber se mudou alguma coisa.
   Devolve: nada — substitui db e snap, grava no aparelho e redesenha. */
function applyState(st, selo, resumoSt) {
  var quem = CW.user ? CW.user.id : '';
  var dono = null;
  try { dono = localStorage.getItem(LS_OWNER); } catch (e) {}
  var serverKeys = {};
  (st.houses || []).forEach(function (h) { serverKeys['h:' + h.id] = 1; });
  (st.records || []).forEach(function (r) { serverKeys['r:' + r.houseId + ':' + r.kind + ':' + r.id] = 1; });
  (st.userRecords || []).forEach(function (r) { serverKeys['u:' + r.kind + ':' + r.id] = 1; });
  var vazio = !Object.keys(serverKeys).length;
  var comBase = Object.keys(snap).length > 0;
  // o que fica deste aparelho — antes de o estado novo mudar os cargos, os
  // serviços e o CW.state com que a exportação local se fez
  var pend = (dono && dono !== quem) || (!comBase && !vazio) ? null : pendentesLocais(st, serverKeys);
  CW._pulled = 1;   // já falámos com o servidor: o que estiver vazio está mesmo vazio
  CW._esperaFim = 1;   // e por isso a app já pode afirmar o que sabe
  // os campos novos do estado (cargos, colaboradores, convites, ligação,
  // pedidos, pessoas) ficam sempre com forma, venham ou não do servidor
  ['roles', 'collaborators', 'invites', 'people', 'connections'].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
  if (!st.shareLink || typeof st.shareLink !== 'object') st.shareLink = null;
  if (!st.shareRequests || typeof st.shareRequests !== 'object') st.shareRequests = {};
  if (!Array.isArray(st.shareRequests.incoming)) st.shareRequests.incoming = [];
  if (!Array.isArray(st.shareRequests.outgoing)) st.shareRequests.outgoing = [];
  CW.state = st;
  /* os serviços desligados nesta conta vêm no estado (servicos.desligados);
     sem o campo, está tudo ligado — e o separador onde estávamos, se ficou
     desligado, dá lugar ao primeiro que abre */
  if (typeof definirServicosDesligados === 'function') {
    definirServicosDesligados(st.servicos && Array.isArray(st.servicos.desligados) ? st.servicos.desligados : []);
    if (!separadorLigado(tab)) { tab = primeiroSeparadorLigado(); setPage = ''; }
  }
  db = rebuildDb(st);
  // o retrato novo: o que o servidor tem, na forma local normalizada
  snap = {};
  var map = exportEntities();
  var vivas = {};
  Object.keys(map).forEach(function (k) {
    vivas[entidadeDe(parseKey(k))] = 1;
    if (serverKeys[k]) snap[k] = resumoDeTexto(JSON.stringify(map[k].data));
  });
  // o que o servidor tem e o cliente decidiu deixar de exportar fica marcado
  // para o próximo push apagar; o que ele não sabe ler, e o que não sobe por
  // falta de permissão num imóvel de colaboração (é do dono), não
  Object.keys(serverKeys).forEach(function (k) {
    if (k in map) return;
    var pk = parseKey(k);
    if (pk.houseId && !podeExportar(pk.houseId, pk.kind)) return;
    var retirado = pk.scope !== 'house' && KINDS_RETIRADOS.indexOf(pk.kind) > -1;
    if (!retirado && !vivas[entidadeDe(pk)]) return;
    snap[k] = '__obsoleto__';
  });
  // e por cima, o que este aparelho ainda não enviou
  if (pend && pend.n) { reporPendentes(db, pend); dropUnsafe(db); }
  /* O capital em dívida das hipotecas deriva-se do capital do início e dos
     pagamentos (credito.js:acertarCreditos), e sobre a base já fundida: uma
     casa gravada por cima noutro aparelho traz o outstanding de antes da
     prestação que um terceiro registou. O retrato fica com o que o servidor
     tem, e por isso a casa corrigida sobe no envio seguinte — o servidor
     também fica certo. */
  acertarCreditos(db);
  seloAplicado = selo || ''; resumoAplicado = resumoSt || '';
  semLigacao = false;
  saveSnap();
  try { localStorage.setItem(LS_OWNER, quem); } catch (e) {}
  rawSet(KEY, JSON.stringify(db));
  /* os lembretes do telemóvel foram agendados no arranque, com o que estava
     no aparelho: uma renda confirmada noutro lado ainda avisava no dia certo,
     porque isto grava com rawSet e não com save(). Refazem-se com o estado
     que acabou de chegar (é adiado 400 ms lá dentro, não custa nada). */
  try { scheduleReminders(); } catch (e) {}
  applyLocalTheme(); buildNav(); render();
  setSyncBadge('ok');
  schedulePush(); // envia o que ainda faltar no servidor
}

// Se a pessoa está a escrever num campo (de texto, uma área de texto, algo
// editável): a leitura de fundo não repinta por baixo dela — um campo das
// Definições, que só grava ao sair, era refeito a meio da frase.
// Devolve: true/false.
function aEscreverNumCampo() {
  try {
    var el = document.activeElement;
    if (!el || el === document.body) return false;
    if (el.isContentEditable) return true;
    var t = String(el.tagName || '').toUpperCase();
    if (t === 'TEXTAREA') return true;
    return t === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|file|color|image|hidden)$/i.test(el.type || '');
  } catch (e) { return false; }
}

/* Pede o estado ao servidor. Com condicional, manda o selo do último estado
   aplicado (If-None-Match): se nada mudou, o servidor responde 304 sem corpo
   e poupa a leitura de todas as linhas — a maior despesa do plano, de três em
   três minutos por aparelho aberto. A primeira leitura da página nunca é
   condicional: o CW.state (cargos, ligações, pedidos) só vive em memória.
   Recebe: condicional — verdadeiro para mandar o selo, se o houver.
   Devolve: Promise com {estado, selo, resumo}, ou {naoMudou: true} num 304. */
function pedirEstado(condicional) {
  var cab = {};
  if (condicional && seloAplicado) cab['If-None-Match'] = seloAplicado;
  return api('GET', '/api/state', undefined, { headers: cab, comSelo: true });
}

// O servidor está como estava no último estado aplicado: não há nada para
// refazer nem para repintar. Se a última conversa tinha falhado por falta de
// rede, o «Sem ligação» deixou de ser verdade — e vê-se se há por enviar.
// Devolve: nada.
function estadoIgual() {
  if (!semLigacao) return;
  semLigacao = false;
  setSyncBadge('ok');
  schedulePush();
}

// Lê o estado do servidor e adota-o. Com um modal aberto, ou alguém a
// escrever num campo, não faz nada (para não pisar uma edição a meio), salvo
// com force. Se nada mudou — um 304 ao selo, ou a mesma resposta que o
// último estado aplicado —, não refaz a base nem repinta: conta como leitura.
// Falhas põem o selo a 'off'.
// Recebe: force (opcional) — verdadeiro para ler mesmo com um modal aberto.
// Devolve: Promise que resolve quando a leitura acabar (nunca rejeita).
function pullNow(force) {
  if (!CW.user) return Promise.resolve();
  if (!force && (modalStack.length || aEscreverNumCampo())) return Promise.resolve();
  var quem = CW.user.id;
  return pedirEstado(true).then(function (x) {
    if (!CW.user || CW.user.id !== quem) return;   // a sessão mudou entretanto: o estado já não é de ninguém
    lastPull = Date.now();
    if (x.naoMudou || (x.resumo && x.resumo === resumoAplicado)) return estadoIgual();
    applyState(x.estado, x.selo, x.resumo);
  }).catch(function () { semLigacao = true; setSyncBadge('off'); fimDaEspera(); });
}

// Um ciclo: envia o que houver e, se a última leitura já passou PULL_MS e
// nada está a ser editado, volta a ler.
// Devolve: nada — dispara o push (e talvez o pull) e segue.
function syncCycle() {
  if (!CW.user) return;
  // trancado pelo ecrã de atualização forçada: uma versão velha demais para
  // se usar é velha demais para escrever (cloud/novidades.js:gateAtualizar)
  if (CW.trancado) return;
  pushNow().then(function () {
    if (Date.now() - lastPull > PULL_MS && !modalStack.length && !aEscreverNumCampo()) pullNow();
  });
}

/* ---------------- arranque de sessão ---------------- */

/* Arranque da sessão: a primeira leitura ao servidor, fundida com o que o
   aparelho tem (applyState: o que ficou por enviar da sessão anterior fica
   por cima do servidor e sobe a seguir; a migração de quem usava a app sem
   conta, com o servidor vazio, sobe o que tinha). Liga, uma vez por página,
   o ciclo de 30s, as sincronizações ao voltar online ou à frente, e o envio
   imediato do que estava agendado quando a app vai para segundo plano.

   O `pedido` é a leitura já em curso, quando quem chama a mandou adiantar (o
   entrada.js dispara-a ao mesmo tempo que o /api/me, em vez de esperar por
   ele). Adianta-se o PEDIDO e não a APLICAÇÃO: o corpo do .then continua a
   correr onde sempre correu, depois do /api/me e depois do seed() dos dados
   de exemplo. É essa distinção que torna isto seguro — aplicar mais cedo
   apanhava o exemplo por gravar, e a migração do applyState (servidor vazio,
   dados locais) decidia com uma fotografia do db anterior ao seed.
   Recebe: pedido (opcional) — a promessa do pedirEstado já disparada; sem
   ela, pede aqui.
   Devolve: nada — dispara a primeira leitura e deixa os ciclos armados. */
function startSync(pedido) {
  loadSnap();
  var quem = CW.user ? CW.user.id : '';
  (pedido || pedirEstado(false)).then(function (x) {
    if (!CW.user || CW.user.id !== quem || !x || x.naoMudou) return;
    lastPull = Date.now();
    applyState(x.estado, x.selo, x.resumo);
  }).catch(function () { semLigacao = true; setSyncBadge('off'); fimDaEspera(); });
  if (startSync._armado) return;   // entrar de novo na mesma página não arma um segundo ciclo
  startSync._armado = 1;
  setInterval(syncCycle, 30000);
  window.addEventListener('online', syncCycle);
  window.addEventListener('pagehide', despacharJa);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) despacharJa(); else syncCycle();
  });
}

/* ---------------- rede de segurança à entrada ---------------- */

/* Rede de segurança contra dados envenenados: a app escreve ids em dezenas
   de atributos e handlers, por isso qualquer registo cujo id não seja o
   formato que a app gera é deitado fora à entrada — venha ele do servidor,
   de uma cópia de segurança ou de um ficheiro importado. */
var SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
var SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;
var safe = function (o) { return !!o && SAFE_ID.test(String(o.id == null ? '' : o.id)); };

/* Deita fora, à entrada, tudo o que tenha id fora do formato que a app gera —
   registos e sub-listas das casas — e limpa as datas fora do ISO. Altera e
   devolve o próprio objeto.
   Recebe: d — a base de dados (com a forma de db) a filtrar; aguenta null.
   Devolve: o mesmo objeto d, já filtrado (ou o que veio, se vier vazio). */
function dropUnsafe(d) {
  if (!d) return d;
  ['contracts', 'transactions', 'recurring', 'templates', 'groups', 'owners', 'tenants'].forEach(function (k) {
    if (Array.isArray(d[k])) d[k] = d[k].filter(safe);
  });
  if (Array.isArray(d.properties)) {
    d.properties = d.properties.filter(safe);
    d.properties.forEach(function (p) {
      ['rooms', 'loans', 'photos'].forEach(function (k) {
        if (Array.isArray(p[k])) p[k] = p[k].filter(safe);
      });
      (p.loans || []).forEach(function (l) {
        if (Array.isArray(l.files)) l.files = l.files.filter(safe);
      });
    });
  }
  // datas entram cruas em texto: fora do formato ISO, não são datas
  (d.transactions || []).forEach(function (t) { if (t.date && !SAFE_DATE.test(t.date)) t.date = ''; });
  (d.recurring || []).forEach(function (r) {
    ['next', 'until', 'end'].forEach(function (k) { if (r[k] && !SAFE_DATE.test(r[k])) r[k] = ''; });
  });
  (d.contracts || []).forEach(function (c) {
    ['start', 'end'].forEach(function (k) { if (c[k] && !SAFE_DATE.test(c[k])) c[k] = ''; });
  });
  return d;
}
dropUnsafe(db);

/* ---------------- embrulhos da base ----------------
   A base não sabe da nuvem: a nuvem embrulha-a por reatribuição (guarda a
   função anterior e põe outra no nome, que os onclick e o registo dos
   serviços resolvem na hora). Os que ligam a base à sincronização vivem aqui,
   no ficheiro dela: gravar agenda o envio, pintar pendura as decorações, e
   mudar de página lembra-a. */

// Cada gravação da base filtra os ids à entrada, grava e agenda o envio.
var _save = save;
save = function () {
  dropUnsafe(db);
  _save();
  schedulePush();
  // um contrato ou hipoteca que já vem de trás deixa meses por registar —
  // é dos Planeados (cloud/painel.js), e só com esse serviço ligado nesta conta
  clearTimeout(save._est);
  save._est = setTimeout(function () { try { if (servicoLigado('recurring') && typeof offerFill === 'function') offerFill(); } catch (e) {} }, 700);
};

var _render = render;
render = function () {
  _render();
  try { decorateShared(); } catch (e) {}
  // os pendentes e a barra do painel vivem em cloud/painel.js (dos Planeados)
  try { if (servicoLigado('recurring') && typeof decoratePending === 'function') decoratePending(); } catch (e) {}
  try {
    if (CW.editMode && tab === 'dashboard' && typeof editBar === 'function') { view().classList.add('cw-edit'); editBar(); }
    if (typeof patchHdr === 'function') patchHdr();
  } catch (e) {}
};

/* Depois de cada render, pendura o selo «de <dono>» nos cartões dos imóveis
   que outra pessoa partilhou comigo (mexe no DOM já desenhado, sem
   re-render). Os selos do cargo («de <dono> · <cargo>», onde sou
   colaborador) e dos colaboradores («N colaboradores», nos meus) desenha-os
   a própria vista, com seloCargo e seloColaboradores (web/app/acessos.js).
   Devolve: nada — só acrescenta os selos ao DOM. */
function decorateShared() {
  (db.properties || []).forEach(function (p) {
    if (p._cargo || !p._sharedFrom) return;
    var texto = 'de ' + p._sharedFrom, titulo = 'Imóvel partilhado por ' + p._sharedFrom;
    var cards = document.querySelectorAll('[data-lp="prop:' + p.id + '"] .title');
    [].slice.call(cards).forEach(function (el) {
      if (el.querySelector('.cw-shared')) return;
      var b = document.createElement('span');
      b.className = 'badge grey cw-shared';
      b.style.marginLeft = '7px';
      b.textContent = texto;
      b.title = titulo;
      el.appendChild(b);
    });
  });
}

// Mudar de página no menu deve fechar qualquer modal aberto (imóvel,
// movimento, ...) em vez de o deixar por cima da página nova.
var _go = go;
go = function (id) {
  try { if (modalStack.length) closeAllModals(); } catch (e) {}
  try { if (CW.editMode && id !== 'dashboard') CW.exitEdit(true); } catch (e) {}
  // a barra de regresso só faz sentido enquanto se está nos Movimentos
  if (id !== 'transactions') CW._fromKpi = null;
  _go(id);
  rememberPage();
};

// recarregar a página devolve o utilizador ao sítio onde estava
var LS_PAGE = 'gi_page';
// Guarda em localStorage o separador atual (e a sub-página das definições), para o restorePage.
// Devolve: nada — grava no localStorage (e engole o erro, se ele não deixar).
function rememberPage() {
  try { localStorage.setItem(LS_PAGE, JSON.stringify({ tab: tab, set: setPage || '' })); } catch (e) {}
}
var _goSet = goSet;
goSet = function (p) { _goSet(p); rememberPage(); };

// No arranque, devolve o utilizador ao separador onde estava; ignora estados
// guardados que já não existem e não faz nada quando era só o painel inicial.
// Devolve: nada — repõe o separador e repinta (ou não mexe em nada).
function restorePage() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem(LS_PAGE) || 'null'); } catch (e) {}
  if (!s || !s.tab || s.tab === 'dashboard' && !s.set) return;
  if (!TABS.some(function (t) { return t.id === s.tab; })) return;
  // um separador de um serviço desligado nesta conta não se restaura: fica-se no painel
  if (typeof separadorLigado === 'function' && !separadorLigado(s.tab)) return;
  tab = s.tab;
  setPage = s.tab === 'settings' ? (s.set || '') : '';
  buildNav(); render();
}
