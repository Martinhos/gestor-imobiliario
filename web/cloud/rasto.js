/* ===== O RASTO DAS PESSOAS ===== */
/* O rasto das pessoas: onde se toca na app, debaixo de um pseudónimo.
   -------------------------------------------------------------------
   Para perceber se as pessoas percebem a interface e os fluxos, a app guarda
   ONDE se toca, que ecrãs e janelas se abrem e fecham, os guardar e os erros
   de um campo — nunca o QUÊ: nem o texto da página, nem o que se escreve, nem
   nomes, nem ids de registos. O servidor guarda cada evento debaixo de um
   pseudónimo (P-XXXXXX), 90 dias, e o back office lê-o no Rasto
   (worker/src/rotas/rasto.js, worker/src/lib/rasto.js).

   SÓ COM O SIM
   Nada se guarda nem se envia antes de a pessoa dizer que sim. A escolha é
   da conta e lê-se do servidor (GET /api/rasto/escolha) depois de haver
   sessão e estado (CW._pulled): 'sim', 'nao' ou null (ainda não escolheu).
   Com null, a app pergunta, uma vez, numa janela da casa (rstPerguntar), e só
   com o ecrã livre: depois das boas-vindas e da apresentação do separador
   (cloud/apresentacao.js:aprEcraOcupado, aprOcupaOEcra, aprQueAbrir), dos
   termos e dos outros portões, e nunca por cima de uma janela. A linha
   «Ajudar a melhorar» das Definições mostra a escolha e muda-a
   (rstLinhaDasDefinicoes). As duas respondem pela mesma rota
   (POST /api/rasto/escolha).

   UM EVENTO
   {t, tipo, ecra, janela, alvo, x, y, vw, vh, sinal} (rstEvento):
     tipo — toque, ecra, janela-abre, janela-fecha, guardar, erro-campo, erro;
     ecra — o separador (navegacao.js:TABS), e nas Definições a subpágina
       (settings/tema);
     janela — a janela de cima (rstIdDaCamada) ou o portão no ecrã;
     alvo — o DESCRITOR do que se tocou (rstDescritor): click:<ação>,
       <tag>#<id>, <tag>.<1.ª classe>, a:<destino> ou <tag>;
     x, y — onde, em permilagem da janela; vw, vh — o tamanho dela;
     sinal — o que o cliente decide: em-vao (o toque não caiu em nada que
       responda), repetido (o 3.º toque seguido no mesmo sítio), vai-e-volta
       (uma janela ou um ecrã que abriu e fechou em 4 s sem nada feito lá
       dentro), desistencia (fechar sem guardar depois de escrever) e
       erro-campo (o guardar parou num campo, componentes.js:falhaCampo).

   COMO SE APANHA
   Um ouvinte no documento, na captura e passivo, para o pousar e o levantar
   do dedo (rstAoPousar, rstAoLevantar): um toque é um levantar a menos de
   10px do pousar, e um arrasto não conta. Os ecrãs, as janelas, o guardar e
   os erros dos campos apanham-se embrulhando as funções da casa a partir
   daqui (o render, o go, o openModal, o closeModal e o falhaCampo), como o
   cloud/ajuda.js faz com o go. Os eventos esperam numa fila em memória e vão
   em lotes de até 50, a cada 15 s e quando a página sai (pagehide, ou fica
   escondida), por navigator.sendBeacon('/api/rasto') — ou por um fetch com
   keepalive, quando o beacon não dá (rstMandar). O servidor responde 204
   sempre e a app nunca reage.

   Uma falha aqui nunca parte a app: cada ouvinte e cada embrulho vai num
   try/catch, e um embrulho chama sempre a função de antes primeiro. */

/* Os números do rasto: o envio, o lote, a fila, e as regras dos sinais. */
var rstLimites = {
  envioMs: 15000, lote: 50, fila: 500,
  toquePx: 10, repetidoPx: 24, repetidoMs: 1000, repetidoN: 3,
  vaiEVoltaMs: 4000, guardarMs: 10000, acaoMs: 1500,
  pedirDeNovoMs: 60000, perguntaMs: 1500, perguntaMax: 400, perguntaDeNovoMs: 7 * 24 * 3600 * 1000,
};
/* Os textos da pergunta e da linha das Definições (iguais aos da montra). */
var rstTextos = {
  titulo: 'Ajudas-nos a melhorar o Rendorium?',
  corpo: 'Se aceitares, guardamos onde tocas e que ecrãs abres, com um identificador sem o teu nome, ' +
    'para percebermos o que é difícil de usar. Nunca guardamos o que escreves nem os teus dados. ' +
    'Fica 90 dias e podes mudar nas Definições.',
};
/* A chave, neste aparelho, das contas que fecharam a pergunta sem responder
   (o ✕, o fundo, o voltar), com a hora: {conta: ms}. Fechar não é escolher —
   a pergunta volta numa abertura da app passados 7 dias, até haver Aceitar ou
   Recusar. Com o armazenamento vedado, volta na abertura seguinte. */
var rstChavePerguntado = 'gi_rasto_perguntado';

/* O estado. A escolha: undefined enquanto não se sabe, null por escolher,
   'sim' ou 'nao' — e de que conta é (rstEscolhaDe). */
var rstEscolha, rstEscolhaDe = '';
// o pedido da escolha: em curso, quando e para que conta foi o último
var rstAPedir = false, rstPedidoEm = 0, rstPedidoPara = '';
// a sessão deste carregamento da página, a fila, e o envio de 15 em 15 s
var rstSessao = '', rstFila = [], rstIntervalo = null;
// o dedo pousado, o último toque (para o repetido) e a ação do último toque com data-click
var rstPousado = null, rstUltimo = null, rstUltimaAcao = null;
// o ecrã em que se está: {ecra, desde, util, posto, ev, tempo}, ou null
var rstEcra = null;
// a pergunta: já feita neste carregamento, a tentativa agendada, quantas, e se o ecrã já estava livre
var rstPerguntou = false, rstPerguntaTempo = null, rstPerguntaTentativas = 0, rstLivreAntes = false;
// a linha das Definições a meio de mudar a escolha
var rstAMudar = false;

/* ------------------------------------------------------------ o básico */

/* O relógio do rasto (os testes trocam-no).
   Recebe: nada.
   Devolve: os milissegundos de agora. */
function rstAgora() { return Date.now(); }

/* Um setTimeout que não prende o processo do Node (os testes correm a app
   com os temporizadores verdadeiros): no browser é o de sempre.
   Recebe: f — a função; ms — a espera.
   Devolve: o temporizador. */
function rstTimer(f, ms) {
  var t = setTimeout(function () { try { f(); } catch (e) {} }, ms);
  try { if (t && typeof t.unref === 'function') t.unref(); } catch (e) {}
  return t;
}

/* Texto aleatório, do crypto quando há (o Math.random só de recurso).
   Recebe: n — quantos caracteres; alfabeto — de onde saem.
   Devolve: o texto. */
function rstAleatorio(n, alfabeto) {
  var out = '', bytes = null;
  try { bytes = crypto.getRandomValues(new Uint8Array(n)); } catch (e) {}
  for (var i = 0; i < n; i++) {
    var b = bytes ? bytes[i] : Math.floor(Math.random() * 256);
    out += alfabeto.charAt(b % alfabeto.length);
  }
  return out;
}

/* A sessão deste carregamento da página: 's-' e 10 letras e algarismos.
   Recebe: nada.
   Devolve: o id da sessão. */
function rstNovaSessao() { return 's-' + rstAleatorio(10, 'abcdefghijklmnopqrstuvwxyz0123456789'); }
rstSessao = rstNovaSessao();

/* A conta da sessão, se houver.
   Recebe: nada.
   Devolve: o id da conta, ou ''. */
function rstConta() { return (window.CW && CW.user && CW.user.id) ? String(CW.user.id) : ''; }

/* O rasto está a recolher? Só com a escolha 'sim' desta conta.
   Recebe: nada.
   Devolve: true/false. */
function rstLigado() { return rstEscolha === 'sim' && !!rstEscolhaDe && rstEscolhaDe === rstConta(); }

/* Há um documento a sério onde a janela caiba? Nos testes de Node o document
   do arnês não tem nada, e aí nem se pergunta pela escolha nem se abre a
   pergunta (como apresentacao.js:aprEcraOcupado).
   Recebe: nada.
   Devolve: true/false. */
function rstHaDocumento() {
  try { return !!document.querySelector('body'); } catch (e) { return false; }
}

/* ------------------------------------------------------- o descritor */

/* Um atributo, sem rebentar num nó que não os tenha.
   Recebe: el — o elemento; nome — o atributo.
   Devolve: o valor, ou null. */
function rstAttr(el, nome) {
  try { return el && typeof el.getAttribute === 'function' ? el.getAttribute(nome) : null; } catch (e) { return null; }
}

/* A etiqueta de um elemento, em minúsculas.
   Recebe: el — o elemento.
   Devolve: o texto ('' sem etiqueta). */
function rstTag(el) { return el && el.tagName ? String(el.tagName).toLowerCase() : ''; }

/* O pai de um nó (o do DOM, e o de um SVG).
   Recebe: el — o nó.
   Devolve: o pai, ou null no topo. */
function rstPai(el) {
  var p = el && (el.parentElement || el.parentNode);
  return p && p.nodeType !== 9 ? p : null;
}

/* As classes de um elemento (também num SVG, onde className não é texto).
   Recebe: el — o elemento.
   Devolve: array de classes. */
function rstClasses(el) {
  var c = rstAttr(el, 'class');
  if (c == null && el && typeof el.className === 'string') c = el.className;
  return String(c || '').split(/\s+/).filter(Boolean);
}

/* O nome da ação de um data-click, sem os argumentos (que podem ser ids de
   registos): «openProp('x7')» dá «openProp», «onSave&&onSave()» dá «onSave».
   Recebe: acao — o texto do data-click.
   Devolve: o nome, ou ''. */
function rstNomeDaAcao(acao) {
  var m = /^[\s!(]*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/.exec(String(acao || ''));
  return m ? m[1].slice(0, 60) : '';
}

/* Um id sem ids de registos: com algarismos, corta-se ao prefixo — às partes
   (separadas por _ ou -) antes da primeira que tenha um algarismo.
   «fiscoTit_k3j4» dá «fiscoTit_», «c_rent» fica, «p17» dá ''.
   Recebe: id — o id.
   Devolve: o id limpo ('' quando não sobra nada). */
function rstSemRegisto(id) {
  id = String(id || '');
  if (!/\d/.test(id)) return id.slice(0, 60);
  var partes = id.split(/([_-])/), out = '';
  for (var i = 0; i < partes.length; i += 2) {
    if (/\d/.test(partes[i])) break;
    out += partes[i] + (partes[i + 1] || '');
  }
  return out.slice(0, 60);
}

/* Para onde vai uma ligação, sem valores: o host só quando não é o da
   página, o caminho (os pedaços com algarismos — um token, um id — passam a
   «*») e as CHAVES da pesquisa, sem os valores nem o fragmento.
   «https://app.rendorium.com/?criar» dá «app.rendorium.com/?criar»,
   «/?entrar=tok» dá «/?entrar». Um mailto: ou um tel: dizem só o esquema.
   Recebe: href — o href.
   Devolve: o destino ('' sem href que se leia). */
function rstCaminho(href) {
  var u, aqui = '';
  try { aqui = (window.location && location.href) || ''; } catch (e) {}
  try { u = new URL(String(href), aqui || 'https://rendorium.com/'); } catch (e) { return ''; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return u.protocol.replace(':', '');
  var host = '';
  try { host = aqui && u.host === new URL(aqui).host ? '' : u.host; } catch (e) { host = u.host; }
  var caminho = u.pathname.split('/').map(function (s) { return /\d/.test(s) ? '*' : s; }).join('/');
  var chaves = [];
  try { u.searchParams.forEach(function (v, k) { if (chaves.indexOf(k) < 0) chaves.push(k); }); } catch (e) {}
  return (host + caminho + (chaves.length ? '?' + chaves.join('&') : '')).slice(0, 78);
}

/* O DESCRITOR de um elemento — nunca o texto, o valor, um aria-label ou um id
   de registo: click:<ação> com data-click; a:<destino> numa ligação (o host
   de fora, o caminho e as chaves da pesquisa, rstCaminho);
   <tag>#<id> com id; <tag>.<1.ª classe> com classe; e a etiqueta sozinha.
   Recebe: el — o elemento.
   Devolve: o descritor (até 80 caracteres), ou '' sem elemento. */
function rstDescritor(el) {
  if (!el) return '';
  var tag = rstTag(el), acao = rstNomeDaAcao(rstAttr(el, 'data-click'));
  if (acao) return ('click:' + acao).slice(0, 80);
  var href = tag === 'a' ? rstAttr(el, 'href') : null;
  if (href != null) return ('a:' + rstCaminho(href)).slice(0, 80);
  var id = rstSemRegisto(rstAttr(el, 'id') || (typeof el.id === 'string' ? el.id : ''));
  if (id && tag) return (tag + '#' + id).slice(0, 80);
  var c = rstClasses(el)[0];
  if (c && tag) return (tag + '.' + c).slice(0, 80);
  return tag.slice(0, 80);
}

/* O que responde a um toque, pela regra do em-vão: button, a com href,
   input, select, textarea, label, summary, data-click, os roles de botão, e
   um tabindex — menos o -1, que é o das caixas que só recebem o foco por
   código (a .sheet das janelas: com ele, nenhum toque numa janela era em vão).
   Recebe: el — o elemento.
   Devolve: true/false. */
function rstEInterativo(el) {
  var tag = rstTag(el);
  if (/^(button|input|select|textarea|label|summary)$/.test(tag)) return true;
  if (tag === 'a' && rstAttr(el, 'href') != null) return true;
  if (rstAttr(el, 'data-click') != null) return true;
  if (/^(button|tab|link|menuitem|switch)$/.test(String(rstAttr(el, 'role') || ''))) return true;
  var ti = rstAttr(el, 'tabindex');
  return ti != null && String(ti).trim() !== '-1';
}

/* O elemento que responde a um toque: o alvo ou o antepassado mais perto que
   responda (rstEInterativo).
   Recebe: el — o alvo do toque.
   Devolve: o elemento, ou null (um toque em vão). */
function rstInterativoDe(el) {
  for (var n = el, i = 0; n && i < 40; n = rstPai(n), i++) if (rstEInterativo(n)) return n;
  return null;
}

/* O alvo de um toque em vão, para o descritor: dentro de um desenho (um
   gráfico), o svg inteiro — um path diz pouco.
   Recebe: el — o alvo.
   Devolve: o elemento a descrever. */
function rstAlvoEmVao(el) {
  for (var n = el, i = 0; n && i < 40; n = rstPai(n), i++) {
    if (rstTag(n) === 'svg') {
      var acima = rstPai(n);
      return rstTag(acima) === 'svg' ? acima : n;
    }
  }
  return el;
}

/* O elemento está dentro de um destes ids (a navegação: a gaveta, a barra de
   baixo, as abas da área)?
   Recebe: el — o elemento; ids — os ids.
   Devolve: true/false. */
function rstDentroDe(el, ids) {
  for (var n = el, i = 0; n && i < 60; n = rstPai(n), i++) {
    if (ids.indexOf(String(rstAttr(n, 'id') || '')) >= 0) return true;
  }
  return false;
}

/* O elemento está no rodapé de uma janela (a .foot)?
   Recebe: el — o elemento.
   Devolve: true/false. */
function rstNoRodape(el) {
  for (var n = el, i = 0; n && i < 40; n = rstPai(n), i++) if (rstClasses(n).indexOf('foot') >= 0) return true;
  return false;
}

/* ------------------------------------------------- onde se está */

/* O ecrã de agora: o separador, e nas Definições a subpágina.
   Recebe: nada.
   Devolve: 'contracts', 'settings/tema'… ou '' sem separador. */
function rstEcraDeAgora() {
  if (typeof tab === 'undefined' || !tab) return '';
  var e = String(tab);
  if (e === 'settings' && typeof setPage !== 'undefined' && setPage) e += '/' + String(setPage);
  return e.slice(0, 40);
}

/* O portão que tapa o ecrã (a entrada, o aviso inicial, os termos, a versão,
   a palavra-passe nova, um documento legal) ou o tutorial, procurados no
   documento — é estarem lá que tapa.
   Recebe: nada.
   Devolve: o id dele, ou ''. */
function rstPortao() {
  var q = function (s) { try { return document.querySelector(s); } catch (e) { return null; } };
  var auth = q('#cwAuth');
  if (auth && !(auth.style && auth.style.display === 'none')) return 'cwAuth';
  var ids = ['cwLegal', 'cwTerms', 'cwUpd', 'cwUpd2', 'cwRepor', 'cwDoc', 'cwGuia'];
  for (var i = 0; i < ids.length; i++) if (q('#' + ids[i])) return ids[i];
  return '';
}

/* A camada de cima da pilha das janelas.
   Recebe: nada.
   Devolve: a camada, ou null. */
function rstCamadaDeCima() {
  try { return typeof modalTop === 'function' ? modalTop() : null; } catch (e) { return null; }
}

/* O id de uma janela, sem texto dela (o título pode ter um nome): o que quem
   a abriu lhe deu (L.rstJanela); a apresentação; a 1.ª classe própria da
   janela (apr-pergunta, rst-pergunta…); o «Sair sem guardar?»; a ação do
   toque que a abriu (até 1,5 s antes); o 1.º id do corpo; ou «janela».
   Fica guardado na camada quando o janela-abre entra na fila (rstJanelaAbriu):
   antes disso, quem a abriu ainda a pode estar a marcar.
   Recebe: L — a camada.
   Devolve: o id (até 40 caracteres). */
function rstIdDaCamada(L) {
  if (!L) return null;
  if (L._rstId) return L._rstId;
  var id = '', el = L.el, q = function (s) { try { return el && typeof el.querySelector === 'function' ? el.querySelector(s) : null; } catch (e) { return null; } };
  if (L.rstJanela) id = String(L.rstJanela);
  else if (L.apr && L.apr.id) id = 'apresentacao/' + rstSemRegisto(L.apr.id);
  if (!id) {
    var proprias = rstClasses(el).filter(function (c) { return !/^(modal|open|under|sai|sobre-portao)$/.test(c); });
    if (proprias.length) id = proprias[0];
  }
  if (!id && q('[data-click^="_sairSemGuardar"]')) id = 'sair-sem-guardar';
  if (!id && rstUltimaAcao && L._rstDesde - rstUltimaAcao.t <= rstLimites.acaoMs && rstUltimaAcao.nome !== 'closeModal') id = rstUltimaAcao.nome;
  if (!id) {
    var comId = q('.body [id]');
    id = comId ? rstSemRegisto(rstAttr(comId, 'id')) : '';
  }
  return (id || 'janela').slice(0, 40);
}

/* A janela de agora: a de cima da pilha, ou o portão no ecrã.
   Recebe: nada.
   Devolve: o id, ou null. */
function rstJanelaDeAgora() {
  var L = rstCamadaDeCima();
  if (L) return rstIdDaCamada(L);
  return rstPortao() || null;
}

/* ------------------------------------------------------- os eventos */

/* Um evento novo, com o ecrã, a janela e o tamanho da janela de agora.
   Recebe: tipo — o tipo; o (opcional) — os campos a mudar ({alvo, x, y, sinal, janela, t…}).
   Devolve: o evento. */
function rstEvento(tipo, o) {
  var ev = { t: rstAgora(), tipo: tipo, ecra: rstEcraDeAgora() || null, janela: rstJanelaDeAgora(), alvo: null,
    x: null, y: null, vw: null, vh: null, sinal: null };
  try { ev.vw = Math.round(window.innerWidth) || null; ev.vh = Math.round(window.innerHeight) || null; } catch (e) {}
  if (o) Object.keys(o).forEach(function (k) { if (k in ev) ev[k] = o[k]; });
  return ev;
}

/* Põe um evento na fila, pela ordem do instante (um ecrã espera até 4 s pelo
   sinal dele e entra depois de toques mais novos). Só com o rasto ligado; a
   fila não passa de rstLimites.fila (sai o mais velho).
   Recebe: ev — o evento.
   Devolve: true se entrou. */
function rstPor(ev) {
  if (!ev || !rstLigado()) return false;
  var i = rstFila.length;
  while (i > 0 && rstFila[i - 1].t > ev.t) i--;
  rstFila.splice(i, 0, ev);
  if (rstFila.length > rstLimites.fila) rstFila.splice(0, rstFila.length - rstLimites.fila);
  return true;
}

/* ---------------------------------------------------------- os toques */

/* O dedo (ou o rato) pousou: guarda-se onde, para o levantar decidir se foi
   um toque ou um arrasto.
   Recebe: e — o pointerdown.
   Devolve: nada. */
function rstAoPousar(e) {
  if (!rstLigado() || !e || e.isPrimary === false || (e.button != null && e.button !== 0)) return;
  rstPousado = { id: e.pointerId, x: e.clientX, y: e.clientY, alvo: e.target };
}

/* O gesto foi cancelado (o browser ficou com ele para rolar): não é toque.
   Recebe: nada.
   Devolve: nada. */
function rstAoCancelar() { rstPousado = null; }

/* O dedo levantou: perto de onde pousou, é um toque (rstToque).
   Recebe: e — o pointerup.
   Devolve: o evento do toque, ou null. */
function rstAoLevantar(e) {
  var p = rstPousado;
  rstPousado = null;
  if (!p || !e || !rstLigado() || (p.id != null && e.pointerId != null && p.id !== e.pointerId)) return null;
  var dx = (e.clientX || 0) - (p.x || 0), dy = (e.clientY || 0) - (p.y || 0);
  if (Math.sqrt(dx * dx + dy * dy) > rstLimites.toquePx) return null;
  return rstToque(p.alvo || e.target, e.clientX, e.clientY);
}

/* Um toque: o descritor do que responde (ou do alvo, num toque em vão), a
   posição em permilagem, e o sinal — repetido ao 3.º toque seguido a 24px e
   1 s do anterior; senão em-vao, se nada respondia. Conta também como coisa
   feita na janela ou no ecrã (para o vai-e-volta), e como tentativa de
   guardar quando é o Guardar de uma janela.
   Recebe: alvo — o elemento tocado; x, y — onde (px da janela).
   Devolve: o evento, ou null com o rasto desligado. */
function rstToque(alvo, x, y) {
  if (!rstLigado()) return null;
  var agora = rstAgora(), resp = rstInterativoDe(alvo);
  var vw = 0, vh = 0;
  try { vw = window.innerWidth || 0; vh = window.innerHeight || 0; } catch (e) {}
  var u = rstUltimo, perto = false;
  if (u) {
    var dx = x - u.x, dy = y - u.y;
    perto = agora - u.t <= rstLimites.repetidoMs && Math.sqrt(dx * dx + dy * dy) <= rstLimites.repetidoPx;
  }
  var n = perto ? u.n + 1 : 1;
  rstUltimo = { t: agora, x: x, y: y, n: n };
  var sinal = n >= rstLimites.repetidoN ? 'repetido' : (resp ? null : 'em-vao');
  var nome = resp ? rstNomeDaAcao(rstAttr(resp, 'data-click')) : '';
  if (nome) rstUltimaAcao = { t: agora, nome: nome };
  var pm = function (v, total) { return total > 0 && typeof v === 'number' ? Math.max(0, Math.min(1000, Math.round(v / total * 1000))) : null; };
  var ev = rstEvento('toque', { t: agora, alvo: rstDescritor(resp || rstAlvoEmVao(alvo)) || null,
    x: pm(x, vw), y: pm(y, vh), sinal: sinal });
  var L = rstCamadaDeCima();
  if (L && L._rst) {
    if (resp && nome !== 'closeModal' && nome !== '_sairSemGuardar') L._rst.util = true;
    if (resp && (nome === 'onSave' || (rstAttr(resp, 'data-toca') === 'dados' && rstNoRodape(resp)))) L._rst.tentou = agora;
  } else if (!L && resp && rstEcra && !rstDentroDe(alvo, ['nav', 'tabbar', 'abasArea'])) {
    rstEcra.util = true;
    rstPorEcraPendente(rstEcra);
  }
  rstPor(ev);
  return ev;
}

/* ------------------------------------------------------------ os ecrãs */

/* O ecrã mudou? Fecha o de antes — com vai-e-volta se durou até 4 s sem um
   toque útil (fora da gaveta, da barra de baixo e das abas) — e abre o novo,
   que espera até 4 s pelo sinal dele antes de entrar na fila.
   Recebe: nada.
   Devolve: nada. */
function rstVerEcra() {
  if (!rstLigado()) { rstEcra = null; return; }
  if (typeof _pintarAParte !== 'undefined' && _pintarAParte) return;
  var e = rstEcraDeAgora();
  if (!e || (rstEcra && rstEcra.ecra === e)) return;
  var agora = rstAgora(), antes = rstEcra;
  if (antes && !antes.posto) {
    if (!antes.util && agora - antes.desde <= rstLimites.vaiEVoltaMs) antes.ev.sinal = 'vai-e-volta';
    rstPorEcraPendente(antes);
  }
  var p = { ecra: e, desde: agora, util: false, posto: false, ev: rstEvento('ecra', { t: agora, ecra: e }), tempo: null };
  p.tempo = rstTimer(function () { rstPorEcraPendente(p); }, rstLimites.vaiEVoltaMs + 1);
  rstEcra = p;
}

/* O evento de um ecrã entra na fila (uma vez só).
   Recebe: p — o ecrã ({ev, posto, tempo}).
   Devolve: nada. */
function rstPorEcraPendente(p) {
  if (!p || p.posto) return;
  p.posto = true;
  try { clearTimeout(p.tempo); } catch (e) {}
  rstPor(p.ev);
}

/* ---------------------------------------------------------- as janelas */

/* Abriu uma janela: guarda-se quando, e o janela-abre entra na fila logo a
   seguir (numa microtarefa: quem a abriu marca-a depois do openModal — a
   apresentação, a pergunta das apresentações —, e o id lê essas marcas).
   Recebe: L — a camada.
   Devolve: nada. */
function rstJanelaAbriu(L) {
  if (!L || typeof L !== 'object') return;
  L._rstDesde = rstAgora();
  if (!rstLigado()) return;
  L._rst = { desde: L._rstDesde, util: false, tentou: 0, falhou: 0 };
  Promise.resolve().then(function () {
    try { L._rstId = rstIdDaCamada(L); rstPor(rstEvento('janela-abre', { t: L._rstDesde, janela: L._rstId })); } catch (e) {}
  });
}

/* Fechou uma janela: o guardar, se se carregou no Guardar há menos de 10 s e
   nenhum campo falhou depois; e o janela-fecha, com desistencia (escreveu-se
   e não se guardou) ou vai-e-volta (até 4 s, sem nada feito lá dentro).
   Recebe: L — a camada que saiu.
   Devolve: nada. */
function rstJanelaFechou(L) {
  if (!L || !L._rst) return;
  var r = L._rst, id = rstIdDaCamada(L), agora = rstAgora();
  L._rst = null;
  var guardou = !!r.tentou && !(r.falhou >= r.tentou) && agora - r.tentou <= rstLimites.guardarMs;
  if (guardou) rstPor(rstEvento('guardar', { t: agora, janela: id }));
  var sinal = null;
  if (L.tocado && !guardou) sinal = 'desistencia';
  else if (!r.util && !L.tocado && agora - r.desde <= rstLimites.vaiEVoltaMs) sinal = 'vai-e-volta';
  rstPor(rstEvento('janela-fecha', { t: agora, janela: id, sinal: sinal }));
}

/* As camadas que saíram da pilha entre dois retratos dela.
   Recebe: antes — a pilha de antes (array).
   Devolve: nada — fecha cada uma (rstJanelaFechou), a de cima primeiro. */
function rstFecharAsQueSairam(antes) {
  var agora = typeof modalStack !== 'undefined' ? modalStack : [];
  for (var i = antes.length - 1; i >= 0; i--) if (agora.indexOf(antes[i]) < 0) rstJanelaFechou(antes[i]);
}

/* Um campo falhou ao guardar (componentes.js:falhaCampo): o erro-campo, com o
   descritor do campo, e a tentativa de guardar da janela deixa de contar.
   Recebe: id — o id do campo.
   Devolve: o evento, ou null com o rasto desligado. */
function rstErroCampo(id) {
  if (!rstLigado()) return null;
  var agora = rstAgora(), L = rstCamadaDeCima();
  if (L && L._rst) L._rst.falhou = agora;
  var el = null;
  try { el = document.getElementById(id); } catch (e) {}
  var alvo = (el && rstDescritor(el)) || ('campo#' + rstSemRegisto(id));
  var ev = rstEvento('erro-campo', { t: agora, alvo: alvo, sinal: 'erro-campo' });
  rstPor(ev);
  return ev;
}

/* ------------------------------------------------------------- o envio */

/* Manda um lote: pelo sendBeacon, que sobrevive à página a sair; com um
   token no aparelho (os fluxos de teste, que vivem do Bearer), ou quando o
   beacon recusa, por um fetch com keepalive.
   Recebe: lote — {sessao, eventos}.
   Devolve: 'beacon', 'fetch' ou '' (não deu). */
function rstMandar(lote) {
  var corpo = JSON.stringify(lote), token = window.CW && CW.user && CW.user.token;
  try {
    if (!token && navigator.sendBeacon && navigator.sendBeacon('/api/rasto', new Blob([corpo], { type: 'application/json' }))) return 'beacon';
  } catch (e) {}
  try {
    var h = { 'Content-Type': 'application/json' };
    if (token) { h.Authorization = 'Bearer ' + token; h['X-Rendorium-Token'] = '1'; }
    var p = fetch('/api/rasto', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: h, body: corpo });
    if (p && typeof p.catch === 'function') p.catch(function () {});
    return 'fetch';
  } catch (e) { return ''; }
}

/* Esvazia a fila em lotes de até 50. A sair (a página a fechar ou a ficar
   escondida), o ecrã que esperava pelo sinal entra já, sem ele.
   Recebe: saida (opcional) — true quando a página sai.
   Devolve: quantos lotes saíram. */
function rstEnviar(saida) {
  if (!rstLigado()) { rstFila = []; return 0; }
  if (saida && rstEcra) rstPorEcraPendente(rstEcra);
  var n = 0;
  while (rstFila.length) {
    rstMandar({ sessao: rstSessao, eventos: rstFila.splice(0, rstLimites.lote) });
    n++;
  }
  return n;
}

/* Começa a recolher: o envio de 15 em 15 s, e o ecrã de agora.
   Recebe: nada.
   Devolve: nada. */
function rstLigar() {
  if (rstIntervalo) clearInterval(rstIntervalo);
  rstIntervalo = setInterval(function () { try { rstEnviar(); } catch (e) {} }, rstLimites.envioMs);
  try { if (rstIntervalo && typeof rstIntervalo.unref === 'function') rstIntervalo.unref(); } catch (e) {}
  rstEcra = null;
  rstVerEcra();
}

/* Para de recolher: sem envio, e a fila e o resto deitados fora.
   Recebe: nada.
   Devolve: nada. */
function rstDesligar() {
  if (rstIntervalo) clearInterval(rstIntervalo);
  rstIntervalo = null;
  if (rstEcra) { try { clearTimeout(rstEcra.tempo); } catch (e) {} }
  rstFila = []; rstEcra = null; rstPousado = null; rstUltimo = null; rstUltimaAcao = null;
}

/* ----------------------------------------------------------- a escolha */

/* Adota uma escolha (do servidor, ou a que se acabou de gravar) e liga ou
   desliga a recolha. Ligada quer dizer com o envio a correr (rstIntervalo):
   quando a conta muda, o rstLigado já diz que não antes de se chegar aqui.
   Recebe: escolha — 'sim', 'nao', null ou undefined (por saber); uid — de que conta.
   Devolve: nada. */
function rstAdotarEscolha(escolha, uid) {
  rstEscolha = escolha;
  rstEscolhaDe = uid || '';
  var agora = rstLigado();
  if (agora && !rstIntervalo) rstLigar();
  else if (!agora && rstIntervalo) rstDesligar();
}

/* Pede a escolha ao servidor (GET /api/rasto/escolha): com sessão, com o
   estado já lido e num documento a sério; sempre que a app abre, e outra vez
   quando volta a estar à vista (rstAoSair), no máximo uma vez por minuto. É
   este pedido que acerta a conta com o aparelho (a última escolha ganha, do
   lado do servidor): a escolha não se guarda neste aparelho.
   Recebe: nada.
   Devolve: a Promise do pedido, ou null quando não pede. */
function rstPedirEscolha() {
  var uid = rstConta(), agora = rstAgora();
  if (!uid || rstAPedir || !window.CW || !CW._pulled || !rstHaDocumento() || typeof api !== 'function') return null;
  if (rstPedidoPara === uid && agora - rstPedidoEm < rstLimites.pedirDeNovoMs) return null;
  rstAPedir = true; rstPedidoEm = agora; rstPedidoPara = uid;
  return api('GET', '/api/rasto/escolha').then(function (r) {
    rstAPedir = false;
    if (rstConta() !== uid) return;
    var e = r && r.escolha;
    rstAdotarEscolha(e === 'sim' || e === 'nao' ? e : null, uid);
    if (rstEscolha === null) rstAgendarPergunta();
    rstRepintarDefinicoes(false);
  }, function () { rstAPedir = false; });
}

/* Segue a sessão (a cada render): outra conta, ou nenhuma, esquece a escolha
   da de antes; a escolha por saber pede-se; por escolher, agenda-se a
   pergunta.
   Recebe: nada.
   Devolve: nada. */
function rstSincronizar() {
  var uid = rstConta();
  if (uid !== rstEscolhaDe && (rstEscolhaDe || rstEscolha !== undefined)) {
    rstAdotarEscolha(undefined, '');
    rstPerguntou = false;
  }
  if (!uid) return;
  if (rstEscolha === undefined) rstPedirEscolha();
  else if (rstEscolha === null) rstAgendarPergunta();
}

/* Grava uma escolha (POST /api/rasto/escolha) e adota-a.
   Recebe: escolha — 'sim' ou 'nao'.
   Devolve: Promise com true se gravou. */
function rstGravarEscolha(escolha) {
  var uid = rstConta();
  if (!uid || typeof api !== 'function' || (escolha !== 'sim' && escolha !== 'nao')) return Promise.resolve(false);
  return Promise.resolve(api('POST', '/api/rasto/escolha', { escolha: escolha })).then(function (r) {
    if (rstConta() !== uid) return false;
    var e = r && (r.escolha === 'sim' || r.escolha === 'nao') ? r.escolha : escolha;
    rstAdotarEscolha(e, uid);
    rstPerguntou = true;
    return true;
  }, function () { return false; });
}

/* ----------------------------------------------------------- a pergunta */

/* As horas a que cada conta fechou a pergunta sem responder, neste aparelho.
   Recebe: nada.
   Devolve: {conta: ms} ({} sem nada guardado, ou com o armazenamento vedado). */
function rstLerPerguntado() {
  try {
    var m = JSON.parse(localStorage.getItem(rstChavePerguntado) || '{}');
    return m && typeof m === 'object' ? m : {};
  } catch (e) { return {}; }
}

/* A conta fechou a pergunta sem responder há menos de 7 dias, neste
   aparelho? O valor antigo 1 (sem hora) lê-se como «agora», e passa a
   guardar a hora de agora.
   Recebe: uid — a conta.
   Devolve: true/false. */
function rstJaPerguntado(uid) {
  var m = rstLerPerguntado(), v = Number(m[uid]) || 0;
  if (!v) return false;
  if (v === 1) { rstMarcarPerguntado(uid); v = rstAgora(); }
  return rstAgora() - v < rstLimites.perguntaDeNovoMs;
}

/* Lembra, neste aparelho, a hora a que a conta fechou a pergunta sem
   responder.
   Recebe: uid — a conta.
   Devolve: nada. */
function rstMarcarPerguntado(uid) {
  try {
    var m = rstLerPerguntado();
    m[uid] = rstAgora();
    localStorage.setItem(rstChavePerguntado, JSON.stringify(m));
  } catch (e) {}
}

/* Porque é que a pergunta não pode abrir agora — ou '' com o ecrã livre:
   sem sessão ou sem estado, sem documento, um portão, uma janela, as
   boas-vindas ou a apresentação do separador por ver ou abertas, as
   novidades, o tutorial, a gaveta, um modo (a mesma régua da apresentação,
   apresentacao.js:aprEcraOcupado, mais as dela e as das novidades).
   Recebe: nada.
   Devolve: a razão, ou ''. */
function rstPorqueNaoAgora() {
  if (!window.CW || !CW.user) return 'sessao';
  if (!CW._pulled) return 'estado';
  if (!rstHaDocumento()) return 'documento';
  var p = '';
  try { p = typeof aprEcraOcupado === 'function' ? aprEcraOcupado() : ''; } catch (e) { p = 'apresentacao'; }
  if (p) return p;
  if (rstPortao()) return 'portao';
  if (typeof modalStack !== 'undefined' && modalStack.length) return 'janela';
  try {
    if (typeof aprOcupaOEcra === 'function' && aprOcupaOEcra()) return 'apresentacao';
    if (typeof aprQueAbrir === 'function' && aprQueAbrir()) return 'apresentacao';
    if (typeof ecraLivre === 'function' && !ecraLivre()) return 'novidades';
  } catch (e) { return 'apresentacao'; }
  return '';
}

/* A pergunta ainda tem de ser feita: a escolha desta conta é null, não foi
   feita neste carregamento, nem fechada neste aparelho há menos de 7 dias.
   Recebe: nada.
   Devolve: true/false. */
function rstFaltaPerguntar() {
  var uid = rstConta();
  return !!uid && rstEscolha === null && rstEscolhaDe === uid && !rstPerguntou && !rstJaPerguntado(uid);
}

/* Agenda a tentativa de perguntar (uma de cada vez).
   Recebe: nada.
   Devolve: nada. */
function rstAgendarPergunta() {
  if (rstPerguntaTempo || !rstFaltaPerguntar()) return;
  rstPerguntaTentativas = 0; rstLivreAntes = false;
  rstPerguntaTempo = rstTimer(rstTentarPergunta, rstLimites.perguntaMs);
}

/* Tenta perguntar: abre só com o ecrã livre em duas tentativas seguidas
   (1,5 s de folga: as novidades e a apresentação abrem nesse intervalo, e
   passam à frente); senão volta a tentar, até rstLimites.perguntaMax vezes.
   Recebe: nada.
   Devolve: a camada aberta, ou null. */
function rstTentarPergunta() {
  rstPerguntaTempo = null;
  if (!rstFaltaPerguntar()) return null;
  if (!rstPorqueNaoAgora()) {
    if (rstLivreAntes) return rstPerguntar();
    rstLivreAntes = true;
  } else rstLivreAntes = false;
  if (rstPerguntaTentativas++ < rstLimites.perguntaMax) rstPerguntaTempo = rstTimer(rstTentarPergunta, rstLimites.perguntaMs);
  return null;
}

/* A pergunta, numa janela da casa: o título, a frase, e Recusar e Aceitar com
   o mesmo peso (recusar é tão fácil como aceitar). Fechá-la sem responder (o
   ✕, o fundo, o voltar) não escolhe nada: volta numa abertura da app
   passados 7 dias (rstMarcarPerguntado); fechada pela app (sem origem), volta
   a perguntar mais tarde.
   Recebe: nada.
   Devolve: a camada, ou null. */
function rstPerguntar() {
  if (typeof openModal !== 'function') return null;
  var uid = rstConta();
  rstPerguntou = true; rstLivreAntes = false;
  var L = openModal(rstTextos.titulo, '<div class="hint u-fs-14px">' + rstTextos.corpo + '</div>',
    '<button type="button" class="btn" data-toca="dados" data-click="rstResponder(\'nao\')">Recusar</button>' +
    '<button type="button" class="btn" data-toca="dados" data-click="rstResponder(\'sim\')">Aceitar</button>');
  if (!L) { rstPerguntou = false; return null; }
  L.rstJanela = 'rasto-pergunta';
  L.rstPergunta = { feito: false, uid: uid };
  try { if (L.el && L.el.classList) L.el.classList.add('rst-pergunta'); } catch (e) {}
  L.aoFechar = function (origem) {
    if (L.rstPergunta.feito) return;
    if (/^(x|fundo|esc|voltar|arrasto)$/.test(String(origem || ''))) rstMarcarPerguntado(uid);
    else { rstPerguntou = false; rstAgendarPergunta(); }
  };
  return L;
}

/* A resposta à pergunta: fecha a janela e grava a escolha; o aviso diz o
   que ficou e onde se muda.
   Recebe: r — 'sim' ou 'nao'.
   Devolve: Promise com true se gravou (null sem a pergunta aberta). */
function rstResponder(r) {
  var L = rstCamadaDeCima(), p = L && L.rstPergunta;
  if (!p || p.feito || (r !== 'sim' && r !== 'nao')) return null;
  p.feito = true;
  if (typeof closeModal === 'function') closeModal();
  return rstGravarEscolha(r).then(function (ok) {
    if (typeof toast === 'function') {
      toast(!ok ? 'Não deu para guardar a tua escolha. Voltamos a perguntar noutra altura.'
        : r === 'sim' ? 'Obrigado. Podes mudar quando quiseres nas Definições.'
          : 'Não guardamos nada. Podes mudar quando quiseres nas Definições.');
    }
    rstRepintarDefinicoes(false);
    return ok;
  });
}

/* ------------------------------------------------------ as Definições */

/* A linha «Ajudar a melhorar» na raiz das Definições: a linha inteira é o
   interruptor (role=switch, um botão de 60px), com o desenho dele à direita;
   a frase diz o estado em palavras («Ligado», «Desligado», «Ainda não
   escolheste»), que é a cor da frente e não só o fundo do interruptor, e,
   ligado, que desligar apaga o que já foi registado (o servidor apaga-o logo).
   Recebe: nada.
   Devolve: o HTML (texto) da linha. */
function rstLinhaDasDefinicoes() {
  var on = rstEscolha === 'sim';
  var sub = on ? 'Ligado, sem o teu nome. Desligar apaga o que já foi registado'
    : rstEscolha === 'nao' ? 'Desligado: não guardamos onde tocas' : 'Ainda não escolheste: não guardamos nada';
  return '<button type="button" class="linha def-linha rst-def" id="rstDefinicoes" role="switch" aria-checked="' + on + '"' +
    (rstAMudar ? ' aria-busy="true" disabled' : '') + ' data-toca="dados" data-click="rstMudarNasDefinicoes()">' +
    '<span class="ic">' + (typeof ic === 'function' ? ic('wave', 20) : '') + '</span>' +
    '<span class="txt"><b class="u-d-block">Ajudar a melhorar</b><span class="small' + (on ? ' rst-def-ligado' : '') + '">' + sub + '</span></span>' +
    '<span class="interruptor" aria-hidden="true"></span></button>';
}

/* O toque na linha das Definições: muda a escolha (sim passa a não; não, ou
   por escolher, passa a sim), grava, e diz o que ficou num aviso.
   Recebe: nada.
   Devolve: Promise com true se gravou (null a meio de outra mudança). */
function rstMudarNasDefinicoes() {
  if (rstAMudar) return null;
  var nova = rstEscolha === 'sim' ? 'nao' : 'sim';
  rstAMudar = true;
  rstRepintarDefinicoes(false);
  return rstGravarEscolha(nova).then(function (ok) {
    rstAMudar = false;
    if (typeof toast === 'function') {
      toast(!ok ? 'Não deu para mudar a escolha. Tenta outra vez.'
        : nova === 'sim' ? 'Ligado. Obrigado por ajudares a melhorar o Rendorium.' : 'Desligado. Apagámos o que estava registado.');
    }
    rstRepintarDefinicoes(true);
    return ok;
  });
}

/* Repinta a raiz das Definições, se é lá que se está, e devolve o foco à
   linha (o render destrói o botão onde ele estava).
   Recebe: focar — true para devolver o foco à linha.
   Devolve: nada. */
function rstRepintarDefinicoes(focar) {
  if (typeof tab === 'undefined' || tab !== 'settings' || (typeof setPage !== 'undefined' && setPage) || typeof render !== 'function') return;
  if (!rstHaDocumento()) return;
  try { render(); } catch (e) { return; }
  if (!focar) return;
  try { var b = document.getElementById('rstDefinicoes'); if (b && b.focus) b.focus({ preventScroll: true }); } catch (e) {}
}

if (typeof linhaDefinicoes === 'function') {
  linhaDefinicoes({ sec: 'ajuda', ordem: 20, label: 'Ajudar a melhorar', linha: rstLinhaDasDefinicoes,
    se: function () { return !!rstConta() && rstEscolha !== undefined && rstEscolhaDe === rstConta(); } });
}

/* ---------------------------------------------------------- os embrulhos */

/* A pilha das janelas, num retrato (para o closeModal saber quais saíram).
   Recebe: nada.
   Devolve: array das camadas. */
function rstPilha() { return typeof modalStack !== 'undefined' && modalStack ? modalStack.slice() : []; }

/* Os embrulhos, pela reatribuição da casa (como cloud/ajuda.js faz com o go,
   e cloud/apresentacao.js com o render e o closeModal): cada um chama a
   função de antes primeiro, e o que é do rasto vai num try/catch. O render
   do vizinho que o carrossel pinta às escondidas (vistas.js:_pintarAParte)
   não conta. */
var rstRenderDeAntes = render;
render = function () {
  var r = rstRenderDeAntes.apply(this, arguments);
  if (!(typeof _pintarAParte !== 'undefined' && _pintarAParte)) {
    try { rstSincronizar(); rstVerEcra(); } catch (e) {}
  }
  return r;
};
var rstGoDeAntes = go;
go = function () {
  var r = rstGoDeAntes.apply(this, arguments);
  try { rstVerEcra(); } catch (e) {}
  return r;
};
var rstOpenModalDeAntes = typeof openModal === 'function' ? openModal : null;
if (rstOpenModalDeAntes) {
  openModal = function () {
    var L = rstOpenModalDeAntes.apply(this, arguments);
    try { rstJanelaAbriu(L); } catch (e) {}
    return L;
  };
}
var rstCloseModalDeAntes = typeof closeModal === 'function' ? closeModal : null;
if (rstCloseModalDeAntes) {
  closeModal = function () {
    var antes = rstPilha();
    var r = rstCloseModalDeAntes.apply(this, arguments);
    try { rstFecharAsQueSairam(antes); } catch (e) {}
    try { if (rstFaltaPerguntar()) rstAgendarPergunta(); } catch (e) {}
    return r;
  };
}
var rstFalhaCampoDeAntes = typeof falhaCampo === 'function' ? falhaCampo : null;
if (rstFalhaCampoDeAntes) {
  falhaCampo = function (id) {
    var r = rstFalhaCampoDeAntes.apply(this, arguments);
    try { rstErroCampo(id); } catch (e) {}
    return r;
  };
}
// a sessão a terminar leva o que está na fila antes de o cookie sair
var rstLogoutDeAntes = window.CW && typeof CW.logout === 'function' ? CW.logout : null;
if (rstLogoutDeAntes) {
  CW.logout = function () {
    try { rstEnviar(true); } catch (e) {}
    return rstLogoutDeAntes.apply(this, arguments);
  };
}

/* Um erro na página entra no rasto como tipo erro — sem a mensagem, que pode
   levar texto da página: só onde estava.
   Recebe: nada.
   Devolve: nada. */
function rstAoErro() { try { rstPor(rstEvento('erro')); } catch (e) {} }

/* A página a ficar escondida leva a fila; a voltar à vista (a app que se
   reabre sem recarregar), pede outra vez a escolha, que pode ter mudado na
   montra ou noutro aparelho.
   Recebe: nada.
   Devolve: nada. */
function rstAoSair() {
  var estado = '';
  try { estado = document.visibilityState || ''; } catch (e) {}
  if (estado === 'visible') { try { rstPedirEscolha(); } catch (e) {} return; }
  try { rstEnviar(true); } catch (e) {}
}

try {
  document.addEventListener('pointerdown', function (e) { try { rstAoPousar(e); } catch (x) {} }, { capture: true, passive: true });
  document.addEventListener('pointerup', function (e) { try { rstAoLevantar(e); } catch (x) {} }, { capture: true, passive: true });
  document.addEventListener('pointercancel', function () { rstAoCancelar(); }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', rstAoSair);
  window.addEventListener('pagehide', function () { try { rstEnviar(true); } catch (x) {} });
  window.addEventListener('error', rstAoErro);
} catch (e) {}
