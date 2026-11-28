/* ===== MODELOS DE DADOS (o Lab) ===== */
/* Os modelos de dados do dev (KAN-167): cenários prontos a carregar na conta
   de teste em que se está, para cada teste ter os dados de que precisa. A
   janela «Modelos de dados» abre-se do menu da pílula do Lab (cloud/qa.js),
   pela mdlAbrir, e lista os modelos da pessoa: os de base, escritos em código
   (web/app/modelos-cenarios.js:MODELOS_CENARIOS, que nascem a cada pessoa na
   primeira vez), os que o Claude cria para um ticket (scripts/modelos.mjs) e
   os que ela gravou da conta («Guardar como modelo novo»). Tocar num usa-o
   (KAN-167-2), e o ⋯ tem «Renomear» e, nos que não são de base, «Remover»
   (com o Anular). A lista ordena-se pela ordem personalizada (arrastando pela pega,
   ou com as setas nela), pelo nome ou pela data de criação; a escolha é do
   aparelho, a ordem personalizada é do servidor.

   Usar substitui os dados da conta pelos do modelo, depois da confirmação que
   diz o que se perde, e só numa conta de teste (o servidor recusa as outras:
   worker/src/rotas/modelos.js:usarModelo). Fica a mesma conta e a mesma
   sessão. Antes, o que estiver por enviar sobe (mdlEnviarPendentes): o que
   se perde é o que o servidor tem. Um cenário constrói-se aqui, com as datas
   de hoje (mdlEntidadesDoCenario); um modelo gravado vem do servidor, com as
   datas tal como estavam. Depois lê-se o estado, como se outro aparelho
   tivesse mudado os dados (cloud/nucleo.js:pullNow).

   No back office do dev a mesma janela fala com /api/equipa/modelos
   (mdlCaminho): lista, renomeia, ordena e remove; usar e gravar pedem uma
   conta, e lá não há. */
'use strict';

/* global QA_EQUIPA, QA_PAGINAS -- definidos pela camada do worker/src/equipa-qa.js (o back office e as páginas públicas); só se leem depois de um typeof */

/* ---------------------------------------------------------------- estado */

// a ordem da lista neste aparelho: 'personalizada', 'nome' ou 'criacao'
var MDL_LS_ORDEM = 'gi_mdl_ordem';
// as ordens que existem, pela ordem do segmentado
var MDL_ORDENS = [
  { v: 'personalizada', rotulo: 'Personalizada' },
  { v: 'nome', rotulo: 'Nome' },
  { v: 'criacao', rotulo: 'Criação' },
];
// o domínio das contas de teste (o do worker/src/teste.js:eContaDeTeste)
var MDL_DOMINIO_TESTE = '@teste.rendorium.com';
// a confirmação que o servidor pede para substituir os dados (rotas/modelos.js:CONFIRMAR)
var MDL_CONFIRMAR = 'substituir';
// o arrasto: até onde o ponteiro anda antes de ser um arrasto (px), e quanto tempo se engole o clique a seguir
var MDL_LIMIAR = 6;
var MDL_ENGOLE_MS = 350;
// quanto tempo (ms) se espera pelo envio do que está por enviar, antes de desistir
var MDL_ESPERA_ENVIO = 15000;

var mdlLista = { modelos: null, falhou: false, aPedir: null };   // modelos: null quer dizer «ainda não se sabe»
var mdlCamada = null;        // a camada da janela «Modelos de dados», enquanto aberta
var mdlOrdemAqui = '';       // a ordem escolhida, para quando o armazenamento está vedado
var mdlArr = null;           // o arrasto em curso
var mdlEngoleAte = 0;        // até quando (Date.now) se engole o clique a seguir a um arrasto
var mdlOcupado = false;      // um usar ou um gravar a caminho

/* ------------------------------------------------------------- caminhos */

/* A pílula está no back office? (a camada do worker define o QA_EQUIPA)
   Devolve: true ou false. */
function mdlNaEquipa() {
  return typeof QA_EQUIPA !== 'undefined';
}

/* O caminho de uma rota dos modelos: /api/modelos… na app e nas páginas, e
   /api/equipa/modelos… no back office.
   Recebe: p — o caminho na forma da app ('/api/modelos', '/api/modelos/x/usar').
   Devolve: o caminho a pedir. */
function mdlCaminho(p) {
  return mdlNaEquipa() ? String(p).replace(/^\/api\/modelos(?=\/|$|\?)/, '/api/equipa/modelos') : String(p);
}

/* Esta conta é de teste (as do /test)? Só nelas se usa um modelo.
   Devolve: true ou false. */
function mdlContaDeTeste() {
  var u = window.CW && CW.user;
  return !!(u && String(u.email || '').slice(-MDL_DOMINIO_TESTE.length) === MDL_DOMINIO_TESTE);
}

/* A pílula está numa página pública (a montra, o guia)? A camada das
   páginas (worker/src/equipa-qa.js) define o QA_PAGINAS.
   Devolve: true ou false. */
function mdlNasPaginas() {
  return typeof QA_PAGINAS !== 'undefined';
}

/* Aqui há os dados de uma conta da app, para usar um modelo ou gravá-la? Só
   na app: no back office não há conta, e nas páginas públicas há a sessão
   mas não os dados (nem a sincronização). Lá só se organizam os modelos.
   Devolve: true ou false. */
function mdlComConta() {
  return !mdlNaEquipa() && !mdlNasPaginas() && !!(window.CW && CW.user);
}

/* ------------------------------------------------------------- cenários */

/* Os cenários de base do código (web/app/modelos-cenarios.js), ou nenhum
   onde o ficheiro não está (o back office).
   Devolve: a lista [{id, nome, descricao, construir, base?}]. */
function mdlCenarios() {
  var l = typeof MODELOS_CENARIOS !== 'undefined' && Array.isArray(MODELOS_CENARIOS) ? MODELOS_CENARIOS : [];
  return l.filter(function (c) { return c && typeof c.id === 'string'; });
}

/* Um cenário do código pelo id.
   Recebe: id — o do cenário.
   Devolve: o cenário, ou null quando esta versão não o tem. */
function mdlCenario(id) {
  return mdlCenarios().filter(function (c) { return c.id === id; })[0] || null;
}

/* Os ids dos cenários que nascem a cada pessoa (os de base: todos menos os
   que o Claude criou para um ticket, com base: false), para o ?base= do GET.
   Devolve: a lista dos ids. */
function mdlIdsDeBase() {
  return mdlCenarios().filter(function (c) { return c.base !== false; }).map(function (c) { return c.id; });
}

/* O nome de um modelo: o que a pessoa lhe deu, ou o do cenário.
   Recebe: m — o modelo (o do GET /api/modelos).
   Devolve: o texto. */
function mdlNome(m) {
  if (m.nome) return m.nome;
  var c = m.cenario ? mdlCenario(m.cenario) : null;
  return c ? String(c.nome || c.id) : (m.cenario || 'Modelo');
}

/* A data de um momento em ms, à portuguesa (26/11/2026).
   Recebe: ms — o momento.
   Devolve: o texto ('' sem data). */
function mdlData(ms) {
  if (!ms) return '';
  var d = new Date(Number(ms));
  if (isNaN(d.getTime())) return '';
  var dois = function (n) { return (n < 10 ? '0' : '') + n; };
  return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear();
}

/* Uma contagem por extenso, no singular ou no plural.
   Recebe: n — o número; um — a palavra no singular; varios — no plural.
   Devolve: o texto («1 imóvel», «3 imóveis»). */
function mdlConta(n, um, varios) {
  return n + ' ' + (n === 1 ? um : varios);
}

/* Uma lista de partes à portuguesa: «a», «a e b», «a, b e c».
   Recebe: partes — os textos.
   Devolve: o texto. */
function mdlJuntar(partes) {
  if (partes.length < 2) return partes.join('');
  return partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
}

/* O que um resumo de contagens diz, por extenso (só o que não é zero).
   Recebe: r — {imoveis, contratos, pessoas, movimentos, planeados}.
   Devolve: o texto, ou 'sem dados'. */
function mdlResumoLegivel(r) {
  r = r || {};
  var partes = [];
  if (r.imoveis) partes.push(mdlConta(r.imoveis, 'imóvel', 'imóveis'));
  if (r.contratos) partes.push(mdlConta(r.contratos, 'contrato', 'contratos'));
  if (r.pessoas) partes.push(mdlConta(r.pessoas, 'inquilino', 'inquilinos'));
  if (r.movimentos) partes.push(mdlConta(r.movimentos, 'movimento', 'movimentos'));
  if (r.planeados) partes.push(mdlConta(r.planeados, 'planeado', 'planeados'));
  return partes.length ? mdlJuntar(partes) : 'sem dados';
}

/* A linha que diz o que um modelo permite testar: a descrição do cenário,
   ou, num gravado, quando e o que tem.
   Recebe: m — o modelo.
   Devolve: o texto. */
function mdlDescricao(m) {
  if (m.tipo === 'cenario') {
    var c = mdlCenario(m.cenario);
    if (!c) return mdlNaEquipa() ? 'Cenário do código: ' + m.cenario + '.' : 'Este cenário já não existe nesta versão da app.';
    return String(c.descricao || '');
  }
  return 'Gravado a ' + mdlData(m.criadoEm) + ': ' + mdlResumoLegivel(m.resumo) + '.';
}

/* O selo da origem: «Base», «Do ticket KAN-N» ou «Gravado».
   Recebe: m — o modelo.
   Devolve: o texto. */
function mdlOrigemLegivel(m) {
  if (m.origem === 'base') return 'Base';
  if (m.origem === 'ticket') return m.ticket ? 'Do ticket ' + m.ticket : 'De um ticket';
  return 'Gravado';
}

/* Pode usar-se este modelo aqui? Numa conta de teste, com o cenário
   conhecido desta versão (num de cenário).
   Recebe: m — o modelo.
   Devolve: true ou false. */
function mdlPodeUsar(m) {
  if (!mdlComConta() || !mdlContaDeTeste()) return false;
  return m.tipo !== 'cenario' || !!mdlCenario(m.cenario);
}

/* ---------------------------------------------------------------- ordem */

/* A ordem da lista neste aparelho (a última escolhida; a personalizada sem nenhuma).
   Devolve: 'personalizada', 'nome' ou 'criacao'. */
function mdlOrdem() {
  var v = mdlOrdemAqui;
  try { v = localStorage.getItem(MDL_LS_ORDEM) || v; } catch (e) {}
  return MDL_ORDENS.some(function (o) { return o.v === v; }) ? v : 'personalizada';
}

/* Os modelos pela ordem escolhida: a personalizada (a do servidor), pelo
   nome (à portuguesa, sem olhar a maiúsculas nem a acentos) ou pela data de
   criação (os mais recentes primeiro).
   Recebe: ms — os modelos; ordem — a ordem.
   Devolve: uma lista nova. */
function mdlOrdenados(ms, ordem) {
  var l = (ms || []).slice();
  if (ordem === 'nome') {
    l.sort(function (a, b) { return mdlNome(a).localeCompare(mdlNome(b), 'pt', { sensitivity: 'base' }) || a.ordem - b.ordem; });
  } else if (ordem === 'criacao') {
    l.sort(function (a, b) { return (b.criadoEm || 0) - (a.criadoEm || 0) || a.ordem - b.ordem; });
  } else {
    l.sort(function (a, b) { return a.ordem - b.ordem || (a.criadoEm || 0) - (b.criadoEm || 0); });
  }
  return l;
}

/* Escolhe a ordem da lista (o segmentado) e repinta só a lista.
   Recebe: v — 'personalizada', 'nome' ou 'criacao'.
   Devolve: nada. */
function mdlOrdenar(v) {
  if (!MDL_ORDENS.some(function (o) { return o.v === v; })) return;
  mdlOrdemAqui = v;
  try { localStorage.setItem(MDL_LS_ORDEM, v); } catch (e) {}
  mdlPintar();
}

/* ---------------------------------------------------------------- janela */

/* Abre a janela «Modelos de dados» e pede a lista. É a função que o menu da
   pílula do Lab chama.
   Devolve: nada. */
function mdlAbrir() {
  var foot = '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>' +
    (mdlComConta() ? '<button type="button" class="btn primary" data-toca="camada" data-click="mdlGuardarNovo()">' + ic('plus', 16) + ' Guardar como modelo novo</button>' : '');
  var L = openModal('Modelos de dados', mdlHtmlJanela(), foot);
  mdlCamada = L || null;
  if (L && typeof qaMarcarJanela === 'function') qaMarcarJanela(L);
  if (L && L.el && L.el.classList) L.el.classList.add('mdl-janela');
  if (L) L.aoFechar = function () { mdlLargarArrasto(); if (mdlCamada === L) mdlCamada = null; };
  mdlCarregar();
}

/* O corpo da janela: a frase do que é (só onde se pode usar), o aviso da
   conta normal (ou de onde só se organiza), o
   segmentado da ordem e a lista.
   Devolve: o HTML (texto). */
function mdlHtmlJanela() {
  var aviso = '';
  if (mdlNaEquipa() || mdlNasPaginas()) aviso ='<p class="hint mdl-aviso">Aqui organizas os teus modelos. Para usar um, ou gravar a conta, abre a app numa conta de teste.</p>';
  else if (!mdlContaDeTeste()) aviso = '<p class="hint mdl-aviso">Esta conta não é de teste: podes gravar e organizar os teus modelos, mas usar um só numa conta do /test.</p>';
  var ordem = mdlOrdem();
  return '<div class="mdl">' +
    (mdlComConta() && mdlContaDeTeste() ? '<p class="hint">Carrega um cenário pronto nesta conta de teste. Usar um modelo substitui os dados da conta pelos dele.</p>' : '') + aviso +
    '<div class="segm mdl-ordem" role="radiogroup" aria-label="Ordenar os modelos">' + MDL_ORDENS.map(function (o) {
      return '<button type="button" role="radio" data-o="' + o.v + '" aria-checked="' + (o.v === ordem ? 'true' : 'false') + '" data-toca="vista" data-click="mdlOrdenar(\'' + o.v + '\')">' + o.rotulo + '</button>';
    }).join('') + '</div>' +
    '<div id="mdlLista" class="mdl-lista-caixa">' + mdlHtmlLista() + '</div>' +
    '<p class="small mdl-so-leitor" id="mdlAnuncio" aria-live="polite"></p>' +
    '</div>';
}

/* A lista: a espera, a falha com «Tentar de novo», o vazio, ou os modelos
   pela ordem escolhida, com a dica do arrasto na ordem personalizada.
   Devolve: o HTML (texto). */
function mdlHtmlLista() {
  var ms = mdlLista.modelos;
  if (ms === null) {
    if (mdlLista.falhou) return '<div class="mdl-estado"><p class="hint">Não foi possível carregar os modelos.</p><button type="button" class="btn sm" data-toca="dados" data-click="mdlCarregar()">Tentar de novo</button></div>';
    return '<div class="mdl-estado"><p class="hint">A carregar os modelos…</p></div>';
  }
  if (!ms.length) return '<div class="mdl-estado"><p class="hint">Ainda não tens modelos.</p></div>';
  var ordem = mdlOrdem(), arrasta = ordem === 'personalizada' && ms.length > 1;
  return (arrasta ? '<p class="small mdl-dica">Arrasta pela pega para mudar a ordem.</p>' : '') +
    '<ul class="mdl-lista' + (arrasta ? ' arrasta' : '') + '">' + mdlOrdenados(ms, ordem).map(function (m) { return mdlHtmlLinha(m, arrasta); }).join('') + '</ul>';
}

/* Uma linha da lista: a pega (na ordem personalizada), o nome, o selo da
   origem, a linha do que permite testar e o ⋯. Onde há uma conta (a app),
   tocar na linha é usar o modelo (KAN-167-2: «o clicar no cartão conta como
   selecionar o modelo de dados»): o texto é um botão (.mdl-usar) cujo alvo
   cresce para a linha inteira (estilos.css, o bloco dos modelos de dados),
   com a pega e o ⋯ por cima, alvos à parte. Num modelo que aqui não se usa
   (uma conta normal, um cenário que esta versão não tem) o botão fica
   aria-disabled e o toque diz porquê (mdlUsar). No back office e nas
   páginas, onde não há conta, o texto é só texto.
   Recebe: m — o modelo; arrasta — true com a pega.
   Devolve: o HTML (texto). */
function mdlHtmlLinha(m, arrasta) {
  var nome = mdlNome(m), id = String(m.id);
  var conta = mdlComConta(), pode = mdlPodeUsar(m), descId = 'mdlDesc-' + id;
  var texto = '<span class="mdl-cima"><b class="mdl-nome">' + esc(nome) + '</b><span class="mdl-selo" data-origem="' + esc(m.origem) + '">' + esc(mdlOrigemLegivel(m)) + '</span></span>' +
    '<span class="small mdl-desc"' + (conta ? ' id="' + esc(descId) + '"' : '') + '>' + esc(mdlDescricao(m)) + '</span>';
  return '<li class="mdl-linha' + (conta ? ' mdl-toca' : '') + '" data-id="' + esc(id) + '">' +
    (arrasta ? '<button type="button" class="mdl-pega" data-toca="dados" aria-label="' + esc('Mudar a ordem: ' + nome) + '" aria-describedby="mdlDicaPega">' + ic('grip', 18) + '</button>' : '') +
    (conta
      ? '<button type="button" class="mdl-texto mdl-usar" data-toca="camada"' + (pode ? '' : ' aria-disabled="true"') +
        ' aria-label="' + esc('Usar o modelo ' + nome) + '" aria-describedby="' + esc(descId) + '" data-click="mdlUsar(\'' + jsq(id) + '\')">' + texto + '</button>'
      : '<div class="mdl-texto">' + texto + '</div>') +
    mdlHtmlOpcoes(m) +
    '</li>';
}

/* O ⋯ de uma linha: «Renomear» e, nos que não são de base, «Remover». É o
   menu de opções da casa (componentes.js:menu, o mesmo HTML), escrito aqui
   para a janela correr igual no back office e nas páginas públicas, onde o
   componentes.js não está (worker/src/equipa-qa.js).
   Recebe: m — o modelo.
   Devolve: o HTML (texto). */
function mdlHtmlOpcoes(m) {
  var id = String(m.id), q = jsq(id);
  return '<span class="menuwrap"><button type="button" class="iconbtn opcoes mdl-opcoes" data-toca="camada" data-click="menuOpen(event,\'mdl_' + q + '\')" aria-label="Opções" aria-expanded="false">' + ic('dots', 18) + '</button>' +
    '<div class="menupop" id="menu_mdl_' + esc(id) + '">' +
      '<button type="button" data-toca="camada" data-click="closePops();mdlRenomear(\'' + q + '\')">' + ic('pen', 17) + ' Renomear</button>' +
      (m.origem !== 'base' ? '<button type="button" class="danger" data-toca="dados" data-risco="destroi" data-click="closePops();mdlRemover(\'' + q + '\')">' + ic('trash', 17) + ' Remover</button>' : '') +
    '</div></span>';
}

/* Repinta só a lista (e o segmentado), na janela aberta, e liga o arrasto.
   Devolve: nada. */
function mdlPintar() {
  var L = mdlCamada;
  if (!L || !L.el) return;
  mdlLargarArrasto();
  var caixa = L.el.querySelector('#mdlLista');
  if (caixa) caixa.innerHTML = mdlHtmlLista();
  var ordem = mdlOrdem();
  [].slice.call(L.el.querySelectorAll('.mdl-ordem>[data-o]')).forEach(function (b) {
    b.setAttribute('aria-checked', b.getAttribute('data-o') === ordem ? 'true' : 'false');
  });
  [].slice.call(L.el.querySelectorAll('.mdl-pega')).forEach(function (p) {
    p.addEventListener('pointerdown', mdlPousar);
    p.addEventListener('keydown', mdlTecla);
    p.addEventListener('click', mdlPegaClique);
  });
  if (!L.el.querySelector('#mdlDicaPega')) {
    var s = document.createElement('span');
    s.id = 'mdlDicaPega'; s.className = 'mdl-so-leitor';
    s.textContent = 'Arrasta, ou usa as setas para cima e para baixo, para mudar a ordem.';
    L.el.appendChild(s);
  }
}

/* Pede a lista dos modelos ao servidor (com os ids dos cenários de base, que
   o servidor semeia na primeira vez) e repinta-a.
   Devolve: a promessa do pedido (nunca rejeita). */
function mdlCarregar() {
  if (mdlLista.aPedir) return mdlLista.aPedir;
  mdlLista.falhou = false;
  if (mdlLista.modelos === null) mdlPintar();
  var base = mdlIdsDeBase();
  var p = api('GET', mdlCaminho('/api/modelos' + (base.length ? '?base=' + encodeURIComponent(base.join(',')) : '')))
    .then(function (j) { mdlLista.modelos = Array.isArray(j && j.modelos) ? j.modelos : []; })
    .catch(function () { mdlLista.falhou = true; mdlLista.modelos = mdlLista.modelos && mdlLista.modelos.length ? mdlLista.modelos : null; })
    .then(function () { mdlLista.aPedir = null; mdlPintar(); });
  mdlLista.aPedir = p;
  return p;
}

/* Um modelo da lista pelo id.
   Recebe: id — o do modelo.
   Devolve: o modelo, ou null. */
function mdlDe(id) {
  return (mdlLista.modelos || []).filter(function (m) { return m.id === id; })[0] || null;
}

/* Diz uma frase ao leitor de ecrã (a ordem que mudou).
   Recebe: t — o texto.
   Devolve: nada. */
function mdlAnunciar(t) {
  var el = mdlCamada && mdlCamada.el ? mdlCamada.el.querySelector('#mdlAnuncio') : null;
  if (el) el.textContent = t;
}

/* ----------------------------------------------------------------- usar */

/* O que esta conta tem de seu e se perde ao usar um modelo: as casas de que
   é dona (não as que outras contas partilham com ela) e o que pende delas,
   os movimentos e planeados sem imóvel, e as fichas de inquilino.
   Devolve: {resumo: {imoveis, contratos, pessoas, movimentos, planeados}, partilhadas}. */
function mdlOQueSePerde() {
  var d = typeof db !== 'undefined' && db ? db : {};
  var minhas = {}, r = { imoveis: 0, contratos: 0, pessoas: 0, movimentos: 0, planeados: 0 }, partilhadas = 0;
  (d.properties || []).forEach(function (p) {
    if (p._sharedFrom || p._cargo) { partilhadas++; return; }
    minhas[p.id] = 1; r.imoveis++;
  });
  var meu = function (pid) { return !pid || !!minhas[pid]; };
  (d.contracts || []).forEach(function (c) { if (meu(c.propertyId)) r.contratos++; });
  (d.tenants || []).forEach(function (t) { if (!t._sharedFrom) r.pessoas++; });
  (d.transactions || []).forEach(function (t) { if (meu(t.propertyId)) r.movimentos++; });
  (d.recurring || []).forEach(function (x) { if (meu(x.tx && x.tx.propertyId)) r.planeados++; });
  return { resumo: r, partilhadas: partilhadas };
}

/* Usar um modelo: a janela da confirmação, que diz o nome do modelo e o que
   a conta perde (mdlOQueSePerde), com o botão de perigo «Substituir os
   dados». Numa conta normal não chega a abrir: o toque na linha diz que só
   se usa numa conta de teste (e o servidor recusa na mesma).
   Recebe: id — o do modelo.
   Devolve: nada. */
function mdlUsar(id) {
  var m = mdlDe(id);
  if (!m) return;
  if (!mdlPodeUsar(m)) {
    toast(mdlContaDeTeste() ? 'Este cenário não existe nesta versão da app.' : 'Só se usa um modelo numa conta de teste.');
    return;
  }
  var perde = mdlOQueSePerde();
  var tem = mdlResumoLegivel(perde.resumo);
  var texto = tem === 'sem dados'
    ? 'Esta conta ainda não tem dados: não se perde nada.'
    : 'Perdes o que esta conta tem: ' + tem + ', com as fotos e os anexos. Não se desfaz.';
  var corpo = '<div class="mdl-confirmar">' +
    '<p>Substituir os dados desta conta pelo modelo «' + esc(mdlNome(m)) + '»?</p>' +
    '<p class="hint">' + esc(texto) + '</p>' +
    (perde.partilhadas ? '<p class="hint">' + esc(mdlConta(perde.partilhadas, 'imóvel partilhado', 'imóveis partilhados')) + ' por outras contas ' + (perde.partilhadas === 1 ? 'fica' : 'ficam') + ' como está.</p>' : '') +
    '<p class="hint">Ficas na mesma conta e na mesma sessão.</p>' +
    '<p class="erro-campo" id="mdl_usar_e" role="alert"></p></div>';
  var L = openModal('Substituir os dados?', corpo,
    '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>' +
    '<button type="button" class="btn danger" id="mdl_usar_ok" data-toca="dados" data-risco="destroi" data-click="mdlConfirmarUsar(\'' + jsq(id) + '\')">Substituir os dados</button>');
  if (L && typeof qaMarcarJanela === 'function') qaMarcarJanela(L);
}

/* O botão da confirmação a trabalhar (ou de volta).
   Recebe: id — o id do botão; ocupado — true enquanto o pedido anda; texto — o rótulo de repouso.
   Devolve: nada. */
function mdlBotaoOcupado(id, ocupado, texto) {
  var b = document.getElementById(id);
  if (!b) return;
  b.disabled = !!ocupado;
  b.textContent = ocupado ? 'Um momento…' : texto;
}

/* Quantas entidades deste aparelho o servidor ainda não tem (as que mudaram
   desde o retrato, e as que saíram).
   Devolve: o número. */
function mdlPorEnviar() {
  var map = exportEntities(), n = 0;
  Object.keys(map).forEach(function (k) { if (snap[k] !== resumoDeTexto(JSON.stringify(map[k].data))) n++; });
  Object.keys(snap).forEach(function (k) { if (!(k in map) && snap[k] !== '__obsoleto__' && k !== 'u:profile:main' && !chaveCongelada(parseKey(k))) n++; });
  return n;
}

/* Envia já o que estiver por enviar e espera que acabe: o que um modelo
   substitui, e o que se grava como modelo, é o que o servidor tem.
   Devolve: promessa de true quando nada ficou por enviar, false quando ficou
   (sem rede, ou o servidor recusou). */
function mdlEnviarPendentes() {
  var ate = Date.now() + MDL_ESPERA_ENVIO;
  var espera = function () {
    return new Promise(function (ok) {
      var olha = function () {
        if (!pushing || Date.now() > ate) return ok();
        setTimeout(olha, 120);
      };
      olha();
    });
  };
  if (typeof pushTimer !== 'undefined' && pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  return espera().then(function () { return pushNow(); }).then(espera).then(function () { return mdlPorEnviar() === 0; });
}

/* As entidades de um cenário, na forma do /api/sync: constrói-o como o seed
   faz (o cenário com as datas de hoje, os planeados automáticos das rendas,
   das prestações e das despesas da ficha), num db à parte com as definições
   e as fichas das pessoas desta conta, e exporta-o como a sincronização
   exporta (cloud/nucleo.js:exportEntities). O db da app fica como estava: a
   troca é do servidor, e chega pelo estado lido a seguir.
   Recebe: c — o cenário ({construir}).
   Devolve: a lista [{scope, houseId?, kind?, id?, data}]; lança se o cenário falhar. */
function mdlEntidadesDoCenario(c) {
  var antes = db;
  var d = JSON.parse(JSON.stringify(blank));
  d.settings = JSON.parse(JSON.stringify(antes.settings || blank.settings));
  d.owners = JSON.parse(JSON.stringify(antes.owners || []));
  try {
    db = d;
    var r = c.construir() || {};
    // as fichas das pessoas: a da conta funde-se por cima da que já lá está (o que o seed faz)
    (Array.isArray(r.owners) ? r.owners : []).forEach(function (o) {
      if (!o || !o.id) return;
      var ja = d.owners.filter(function (x) { return x.id === o.id; })[0];
      if (ja) Object.assign(ja, o); else d.owners.push(o);
    });
    ['properties', 'tenants', 'contracts', 'transactions', 'templates', 'recurring', 'groups', 'visits'].forEach(function (k) {
      if (Array.isArray(r[k])) d[k] = r[k];
    });
    if (r.settings && typeof r.settings === 'object') Object.assign(d.settings, r.settings);
    if (servicoLigado('recurring')) { syncAllContractRecs(); syncAllLoanRecs(); syncAllPropRecs(); }
    var map = exportEntities();
    return Object.keys(map).map(function (k) { return map[k]; });
  } finally {
    db = antes;
  }
}

/* «Substituir os dados»: envia o que está por enviar, constrói o cenário (num
   de cenário), pede ao servidor a troca e lê o estado novo. Fecha as janelas
   e diz que acabou (ou, se a leitura do estado falhou, que a app os mostra
   quando a ligação voltar); uma recusa (a conta normal, o travão, a rede) fica escrita
   na janela, com o botão de volta.
   Recebe: id — o do modelo.
   Devolve: a promessa do trabalho (nunca rejeita). */
function mdlConfirmarUsar(id) {
  var m = mdlDe(id);
  var erro = function (t) { var e = document.getElementById('mdl_usar_e'); if (e) e.textContent = t; mdlBotaoOcupado('mdl_usar_ok', false, 'Substituir os dados'); };
  if (!m || mdlOcupado) return Promise.resolve();
  mdlOcupado = true;
  mdlBotaoOcupado('mdl_usar_ok', true);
  var corpo = { confirmar: MDL_CONFIRMAR };
  return mdlEnviarPendentes().then(function (limpo) {
    if (!limpo) throw Object.assign(new Error('Há alterações desta conta por enviar ao servidor. Espera pela ligação e tenta de novo.'), { local: true });
    if (m.tipo === 'cenario') {
      var c = mdlCenario(m.cenario);
      if (!c) throw Object.assign(new Error('Este cenário não existe nesta versão da app.'), { local: true });
      corpo.entidades = mdlEntidadesDoCenario(c);
    }
    return api('POST', mdlCaminho('/api/modelos/' + encodeURIComponent(id) + '/usar'), corpo);
  }).then(function () {
    var seloAntes = seloAplicado;
    return pullNow(true).then(function () { return seloAplicado !== seloAntes; });
  }).then(function (leu) {
    if (typeof refreshKnown === 'function') refreshKnown();   // os planeados do modelo não são «novos» (cloud/painel.js:offerFill)
    mdlOcupado = false;
    if (typeof closeAllModals === 'function') closeAllModals(); else closeModal();
    toast(leu ? 'Os dados desta conta são agora os do modelo «' + mdlNome(m) + '».'
      : 'Os dados foram trocados no servidor. A app mostra-os quando a ligação voltar.');
  }).catch(function (e) {
    mdlOcupado = false;
    erro((e && e.message) || 'Não foi possível substituir os dados. Tenta de novo.');
  });
}

/* --------------------------------------------------------------- gravar */

/* «Guardar como modelo novo»: a janela que pede o nome.
   Devolve: nada. */
function mdlGuardarNovo() {
  if (!mdlComConta()) return;
  var L = openModal('Guardar como modelo novo', mdlHtmlNome('', 'Dois contratos com redução'),
    '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>' +
    '<button type="button" class="btn primary" id="mdl_nome_ok" data-toca="dados" data-click="mdlGravar()">Guardar modelo</button>');
  if (L && typeof qaMarcarJanela === 'function') qaMarcarJanela(L);
  var i = document.getElementById('mdl_nome');
  if (i) { i.setAttribute('data-acao', 'gravar'); i.addEventListener('keydown', mdlNomeTecla); try { i.focus(); } catch (e) {} }
}

/* O campo do nome (gravar e renomear), com o erro junto dele e, ao gravar, o
   que vai no modelo.
   Recebe: valor — o nome de agora ('' num novo); exemplo — o exemplo do placeholder, sem o «Ex: ».
   Devolve: o HTML (texto). */
function mdlHtmlNome(valor, exemplo) {
  return '<div class="form mdl-form">' +
    '<label>Nome <span class="req">*</span><input type="text" id="mdl_nome" maxlength="80" autocomplete="off" value="' + esc(valor) + '" placeholder="Ex: ' + esc(exemplo) + '"></label>' +
    '<p class="erro-campo" id="mdl_nome_e" role="alert"></p>' +
    (valor ? '' : '<p class="hint">Vão os imóveis, os contratos, as pessoas, os movimentos e os planeados desta conta, com as datas como estão. As fotos e os anexos não vão.</p>') +
    '</div>';
}

/* O Enter no campo do nome faz o que o botão primário da janela faz (um
   ouvinte posto ao abrir a janela, e não um data-keydown: a camada do back
   office só despacha cliques).
   Recebe: e — o keydown.
   Devolve: nada. */
function mdlNomeTecla(e) {
  if (!e || e.key !== 'Enter') return;
  e.preventDefault();
  var i = document.getElementById('mdl_nome');
  var acao = i ? i.getAttribute('data-acao') : '';
  if (acao === 'gravar') mdlGravar();
  else if (acao) mdlGuardarNome(acao);
}

/* O nome escrito no campo, aparado; com o erro junto dele quando falta.
   Devolve: o texto, ou '' (e o erro escrito). */
function mdlNomeEscrito() {
  var i = document.getElementById('mdl_nome'), e = document.getElementById('mdl_nome_e');
  var v = i ? String(i.value || '').replace(/\s+/g, ' ').trim() : '';
  if (e) e.textContent = v ? '' : 'Escreve o nome do modelo.';
  if (!v && i) { try { i.focus(); } catch (x) {} }
  return v;
}

/* Grava a conta como modelo novo: envia o que está por enviar e pede ao
   servidor que a grave (worker/src/rotas/modelos.js:gravarConta). O modelo
   novo entra na lista, no fim.
   Devolve: a promessa do trabalho (nunca rejeita). */
function mdlGravar() {
  var nome = mdlNomeEscrito();
  if (!nome || mdlOcupado) return Promise.resolve();
  mdlOcupado = true;
  mdlBotaoOcupado('mdl_nome_ok', true);
  return mdlEnviarPendentes().then(function (limpo) {
    if (!limpo) throw new Error('Há alterações desta conta por enviar ao servidor. Espera pela ligação e tenta de novo.');
    return api('POST', mdlCaminho('/api/modelos'), { nome: nome });
  }).then(function (j) {
    mdlOcupado = false;
    if (j && j.modelo && Array.isArray(mdlLista.modelos)) mdlLista.modelos.push(j.modelo);
    closeModal();
    mdlPintar();
    toast('Modelo «' + nome + '» guardado.');
  }).catch(function (e) {
    mdlOcupado = false;
    var el = document.getElementById('mdl_nome_e');
    if (el) el.textContent = (e && e.message) || 'Não foi possível guardar o modelo.';
    mdlBotaoOcupado('mdl_nome_ok', false, 'Guardar modelo');
  });
}

/* ----------------------------------------------------- renomear, remover */

/* «Renomear»: a janela com o nome de agora.
   Recebe: id — o do modelo.
   Devolve: nada. */
function mdlRenomear(id) {
  var m = mdlDe(id);
  if (!m) return;
  var L = openModal('Renomear modelo', mdlHtmlNome(mdlNome(m), 'IRS com prejuízo'),
    '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>' +
    '<button type="button" class="btn primary" id="mdl_nome_ok" data-toca="dados" data-click="mdlGuardarNome(\'' + jsq(id) + '\')">Guardar</button>');
  if (L && typeof qaMarcarJanela === 'function') qaMarcarJanela(L);
  var i = document.getElementById('mdl_nome');
  if (i) { i.setAttribute('data-acao', id); i.addEventListener('keydown', mdlNomeTecla); try { i.focus(); i.select(); } catch (e) {} }
}

/* Guarda o nome novo (PATCH) e repinta a lista.
   Recebe: id — o do modelo.
   Devolve: a promessa do pedido (nunca rejeita). */
function mdlGuardarNome(id) {
  var nome = mdlNomeEscrito();
  if (!nome) return Promise.resolve();
  mdlBotaoOcupado('mdl_nome_ok', true);
  return api('PATCH', mdlCaminho('/api/modelos/' + encodeURIComponent(id)), { nome: nome }).then(function () {
    var m = mdlDe(id);
    if (m) m.nome = nome;
    closeModal();
    mdlPintar();
    toast('Nome guardado.');
  }).catch(function (e) {
    var el = document.getElementById('mdl_nome_e');
    if (el) el.textContent = (e && e.message) || 'Não foi possível guardar o nome.';
    mdlBotaoOcupado('mdl_nome_ok', false, 'Guardar');
  });
}

/* «Remover» (só os que não são de base): sai logo da lista, e o aviso traz o
   Anular, que o repõe no sítio. Se o servidor recusar, volta.
   Recebe: id — o do modelo.
   Devolve: a promessa do pedido (nunca rejeita). */
function mdlRemover(id) {
  var m = mdlDe(id);
  if (!m || !Array.isArray(mdlLista.modelos)) return Promise.resolve();
  var i = mdlLista.modelos.indexOf(m);
  mdlLista.modelos.splice(i, 1);
  mdlPintar();
  var volta = function () {
    if (!mdlDe(id)) mdlLista.modelos.splice(Math.min(i, mdlLista.modelos.length), 0, m);
    mdlPintar();
  };
  return api('DELETE', mdlCaminho('/api/modelos/' + encodeURIComponent(id))).then(function () {
    toast('Modelo «' + mdlNome(m) + '» removido.', { rotulo: 'Anular', ms: 6000, fn: function () {
      api('POST', mdlCaminho('/api/modelos/' + encodeURIComponent(id) + '/repor')).then(volta).catch(function (e) {
        toast((e && e.message) || 'Não foi possível repor o modelo.');
      });
    } });
  }).catch(function (e) {
    volta();
    toast((e && e.message) || 'Não foi possível remover o modelo.');
  });
}

/* ------------------------------------------------------ a ordem, arrastada */

/* Os ids pela ordem em que as linhas estão no ecrã.
   Devolve: a lista dos ids. */
function mdlIdsNoEcra() {
  var L = mdlCamada;
  if (!L || !L.el) return [];
  return [].slice.call(L.el.querySelectorAll('.mdl-linha')).map(function (li) { return li.getAttribute('data-id'); });
}

/* Guarda a ordem personalizada nova: a lista local passa a essa ordem logo, e
   o servidor recebe-a (PUT /api/modelos/ordem). Se recusar, a ordem de antes
   volta e o aviso diz porquê.
   Recebe: ids — os ids pela ordem nova.
   Devolve: a promessa do pedido (nunca rejeita). */
function mdlGuardarOrdem(ids) {
  var antes = (mdlLista.modelos || []).map(function (m) { return { m: m, o: m.ordem }; });
  ids.forEach(function (id, i) { var m = mdlDe(id); if (m) m.ordem = i; });
  return api('PUT', mdlCaminho('/api/modelos/ordem'), { ids: ids }).then(function (j) {
    if (j && Array.isArray(j.modelos)) {
      j.modelos.forEach(function (n) { var m = mdlDe(n.id); if (m) m.ordem = n.ordem; });
    }
  }).catch(function (e) {
    antes.forEach(function (x) { x.m.ordem = x.o; });
    mdlPintar();
    toast((e && e.message) || 'Não foi possível guardar a ordem.');
  });
}

/* O dedo, o rato ou a caneta pousa na pega: começa o arrasto da linha (a
   linha segue o ponteiro e as outras abrem o lugar, como as fotos do imóvel:
   imovel.js:photoDrag). Até MDL_LIMIAR px é um toque.
   Recebe: e — o pointerdown na pega.
   Devolve: nada. */
function mdlPousar(e) {
  if (e.button !== undefined && e.button !== 0) return;
  var pega = e.currentTarget, li = pega && pega.closest ? pega.closest('.mdl-linha') : null;
  if (!li) return;
  mdlLargarArrasto();
  var lista = li.parentNode, linhas = [].slice.call(lista.querySelectorAll('.mdl-linha'));
  linhas.forEach(mdlAssentaPara);
  var idx = linhas.indexOf(li);
  var passo = (linhas.length > 1 && linhas[1].offsetTop - linhas[0].offsetTop) || li.offsetHeight + 8 || 64;
  var rol = mdlRolante(li);
  mdlArr = { li: li, pega: pega, lista: lista, linhas: linhas, idx: idx, para: idx, passo: passo, y0: e.clientY, y: e.clientY,
    id: e.pointerId, rol: rol, topo0: rol ? rol.scrollTop : 0, vai: false, vel: 0, raf: 0 };
  try { pega.setPointerCapture(e.pointerId); } catch (x) {}
  document.addEventListener('pointermove', mdlArrastoMove);
  document.addEventListener('pointerup', mdlArrastoFim);
  document.addEventListener('pointercancel', mdlArrastoFim);
  document.addEventListener('keydown', mdlArrastoEsc, true);
}

/* A caixa que rola por baixo da lista (o corpo da janela).
   Recebe: el — a linha.
   Devolve: o elemento que rola, ou null. */
function mdlRolante(el) {
  for (var p = el && el.parentElement; p && p !== document.body; p = p.parentElement) {
    var o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (el && el.closest && el.closest('.body')) || null;
}

/* O ponteiro anda: passado o limiar, a linha levanta e segue-o, e as
   vizinhas abrem o lugar onde ela vai cair; perto das bordas a caixa rola.
   Recebe: e — o pointermove.
   Devolve: nada. */
function mdlArrastoMove(e) {
  var a = mdlArr;
  if (!a || (e.pointerId != null && a.id != null && e.pointerId !== a.id)) return;
  a.y = e.clientY;
  if (!a.vai) {
    if (Math.abs(a.y - a.y0) < MDL_LIMIAR) return;
    a.vai = true;
    a.li.classList.add('a-levar');
    a.lista.classList.add('a-arrastar');
  }
  if (e.cancelable) e.preventDefault();
  mdlArrastoPintar();
  mdlArrastoRolagem();
}

/* Põe a linha agarrada debaixo do ponteiro (com o que a caixa rolou desde
   que se pegou nela) e as outras a abrir o lugar.
   Devolve: nada. */
function mdlArrastoPintar() {
  var a = mdlArr;
  if (!a) return;
  var dy = a.y - a.y0 + (a.rol ? a.rol.scrollTop : 0) - a.topo0;
  a.li.style.transform = 'translateY(' + dy + 'px)';
  var para = Math.max(0, Math.min(a.linhas.length - 1, a.idx + Math.round(dy / a.passo)));
  if (para === a.para) return;
  a.para = para;
  a.linhas.forEach(function (r, i) {
    if (r === a.li) return;
    var d = 0;
    if (a.idx < para && i > a.idx && i <= para) d = -a.passo;
    else if (a.idx > para && i >= para && i < a.idx) d = a.passo;
    r.style.transform = d ? 'translateY(' + d + 'px)' : '';
  });
}

/* Perto da borda de cima ou de baixo da caixa que rola, ela rola sozinha,
   mais depressa quanto mais perto (no máximo 18px por quadro, como as fotos
   e as tarefas). É o dedo que manda: vale também com o movimento reduzido.
   Devolve: nada. */
function mdlArrastoRolagem() {
  var a = mdlArr;
  if (!a || !a.rol) return;
  var r = a.rol.getBoundingClientRect(), zona = 56, v = 0;
  if (a.y < r.top + zona) v = -Math.ceil(14 * (r.top + zona - a.y) / zona);
  else if (a.y > r.bottom - zona) v = Math.ceil(14 * (a.y - (r.bottom - zona)) / zona);
  a.vel = Math.max(-18, Math.min(18, v));
  if (a.vel && !a.raf) a.raf = requestAnimationFrame(mdlArrastoPasso);
}

/* Um passo da rolagem sozinha: rola, repõe a linha debaixo do dedo e
   continua enquanto houver para onde.
   Devolve: nada. */
function mdlArrastoPasso() {
  var a = mdlArr;
  if (!a) return;
  a.raf = 0;
  if (!a.vel || !a.rol) return;
  var antes = a.rol.scrollTop;
  a.rol.scrollTop += a.vel;
  if (a.rol.scrollTop === antes) return;
  mdlArrastoPintar();
  a.raf = requestAnimationFrame(mdlArrastoPasso);
}

/* O Esc a meio de um arrasto desfaz o arrasto (a linha volta ao sítio) e não
   fecha a janela: a tecla fica por aqui.
   Recebe: e — o keydown.
   Devolve: nada. */
function mdlArrastoEsc(e) {
  if (!mdlArr || e.key !== 'Escape') return;
  e.preventDefault(); e.stopPropagation();
  mdlArrastoFim({ type: 'pointercancel', pointerId: mdlArr.id });
}

/* Larga os ouvintes e a rolagem de um arrasto (acabado ou desfeito).
   Devolve: o arrasto que estava em curso (ou null). */
function mdlLargarArrasto() {
  var a = mdlArr;
  document.removeEventListener('pointermove', mdlArrastoMove);
  document.removeEventListener('pointerup', mdlArrastoFim);
  document.removeEventListener('pointercancel', mdlArrastoFim);
  document.removeEventListener('keydown', mdlArrastoEsc, true);
  if (a && a.raf) cancelAnimationFrame(a.raf);
  mdlArr = null;
  return a;
}

/* O ponteiro levanta (ou o browser cancela): a linha troca de sítio no DOM e
   os transforms limpam-se de uma vez, sem transição (.pousar), e as vizinhas
   não se mexem; a largada parte de onde o dedo a deixou e assenta no lugar
   novo (mdlAssenta). Um cancelamento devolve tudo ao sítio. A ordem nova
   guarda-se (mdlGuardarOrdem).
   Recebe: e — o pointerup ou o pointercancel.
   Devolve: nada. */
function mdlArrastoFim(e) {
  var a = mdlArr;
  if (!a || (e && e.pointerId != null && a.id != null && e.pointerId !== a.id)) return;
  mdlLargarArrasto();
  if (!a.vai) return;   // foi um toque: o clique a seguir é o da pega
  mdlEngoleAte = Date.now() + MDL_ENGOLE_MS;
  var cancelou = e && e.type === 'pointercancel';
  var para = cancelou ? a.idx : a.para;
  var de = a.li.getBoundingClientRect().top;
  a.lista.classList.add('pousar');
  a.linhas.forEach(function (r) { r.style.transform = ''; });
  if (para !== a.idx) {
    var ref = a.linhas[para];
    if (para > a.idx) a.lista.insertBefore(a.li, ref.nextSibling); else a.lista.insertBefore(a.li, ref);
  }
  void a.lista.offsetHeight;   // o estilo sem transform fica assente antes de a transição voltar
  a.lista.classList.remove('pousar', 'a-arrastar');
  mdlAssenta(a.li, de - a.li.getBoundingClientRect().top);
  if (para !== a.idx) {
    var ids = mdlIdsNoEcra();
    mdlAnunciar(mdlNome(mdlDe(a.li.getAttribute('data-id')) || {}) + ': posição ' + (para + 1) + ' de ' + ids.length + '.');
    mdlGuardarOrdem(ids);
  }
  try { a.pega.focus({ preventScroll: true }); } catch (x) {}
}

/* A linha largada desliza de onde o dedo a deixou para o lugar dela
   (--rapido, --curva-entra) e só no fim perde a sombra do arrasto. Sem
   movimento pedido, ou já no sítio, pousa logo.
   Recebe: li — a linha; desl — px entre onde estava e o lugar novo.
   Devolve: nada. */
function mdlAssenta(li, desl) {
  var an = null;
  var pousa = function () { if (li._assenta !== an) return; li._assenta = null; li.classList.remove('a-levar'); };
  if (!desl || Math.abs(desl) < 0.5 || semMovimento() || typeof li.animate !== 'function') { li.classList.remove('a-levar'); return; }
  an = li.animate([{ transform: 'translateY(' + desl + 'px)' }, { transform: 'none' }],
    { duration: msDoToken('--rapido', 120), easing: typeof tokenTexto === 'function' ? tokenTexto('--curva-entra', 'cubic-bezier(0,0,.2,1)') : 'cubic-bezier(0,0,.2,1)' });
  li._assenta = an;
  an.onfinish = pousa; an.oncancel = pousa;
  setTimeout(pousa, msDoToken('--rapido', 120) + 120);   // num separador escondido o onfinish não chega
}

/* Uma linha que ainda assenta fica já no sítio (um dedo novo pega nela a meio).
   Recebe: li — a linha.
   Devolve: nada. */
function mdlAssentaPara(li) {
  var an = li && li._assenta;
  if (!an) return;
  li._assenta = null;
  try { an.cancel(); } catch (e) {}
  li.classList.remove('a-levar');
}

/* O clique na pega: o que vem logo a seguir a um arrasto engole-se; um
   toque sem arrasto diz como se muda a ordem.
   Recebe: e — o click.
   Devolve: nada. */
function mdlPegaClique(e) {
  if (Date.now() < mdlEngoleAte) { e.preventDefault(); e.stopPropagation(); return; }
  toast('Arrasta pela pega para mudar a ordem, ou usa as setas.');
}

/* As setas na pega sobem ou descem o modelo um lugar, sem animação (um
   atalho de teclado não anima), e o foco fica na pega dele.
   Recebe: e — o keydown na pega.
   Devolve: nada. */
function mdlTecla(e) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  var li = e.currentTarget.closest('.mdl-linha');
  var ids = mdlIdsNoEcra(), id = li && li.getAttribute('data-id'), i = ids.indexOf(id);
  var j = e.key === 'ArrowUp' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  ids.splice(i, 1); ids.splice(j, 0, id);
  mdlGuardarOrdem(ids);
  mdlPintar();
  var pega = mdlCamada && mdlCamada.el ? mdlCamada.el.querySelector('.mdl-linha[data-id="' + id + '"] .mdl-pega') : null;
  if (pega) { try { pega.focus(); } catch (x) {} }
  mdlAnunciar(mdlNome(mdlDe(id) || {}) + ': posição ' + (j + 1) + ' de ' + ids.length + '.');
}
