/* A pílula do QA no back office do dev (/equipa).
   ----------------------------------------------
   A app tem a pílula «QA» (web/cloud/qa.js) e o Martinho quis a mesma no back
   office, com as mesmas funções, a reaproveitar o próprio qa.js (a decisão
   dele, 2026-10-28). O back office é outra página, com outra sessão, outro
   CSS e o seu guião (equipa-guiao.js), que tem um esc e um ic globais com
   outras assinaturas. Por isso o qa.js não entra solto: o worker serve um
   /equipa/qa.js que embrulha, numa função só, a camada daqui (CAMADA_QA:
   o que o qa.js usa da app — as janelas, o aviso, o menu, a API, o
   despacho das ações data-click), o web/app/icones.js, o web/app/formato.js
   e o web/cloud/qa.js, lidos dos assets tal e qual. Os nomes ficam todos
   dentro da função e não chocam com os do guião; para o window só vai o CW,
   que o qa.js lê de lá.

   As ações que o qa.js escreve no HTML (data-click="qaEnviar()", …) não
   correm pelo eventos.js da app: a camada lê-as com uma gramática pequena
   (nome(argumentos);…) e só chama as funções da tabela QA_ACOES, que a
   montagem escreve no fim com as funções do qa.js e as da camada.

   O /equipa/qa.css junta o que falta ao back office: os tokens que ele não
   tem, os componentes que a camada desenha (CSS_QA_EQUIPA) e o bloco do QA
   do web/estilos.css, cortado pelos seus marcadores.

   Só existe no dev (env.ENV_NAME) e só para quem tem sessão de equipa; as
   rotas que a pílula chama são as /api/equipa/qa (rotas/qa.js:rotasQaDaEquipa).

   As páginas públicas (a montra e o guia, que o worker escreve) também a
   levam no dev, para quem lá chega com a sessão de uma conta (a decisão do
   Martinho, 2026-11-08). A mesma montagem, noutra variante: o
   /paginas/qa.js leva a CAMADA_DAS_PAGINAS (o mesmo núcleo, com o
   QA_PAGINAS no lugar do QA_EQUIPA e as rotas da app, /api/qa, com o
   cookie da sessão da conta) e o FIM_DAS_PAGINAS (o contexto diz a página);
   o /paginas/qa.css leva, além do do back office, os tokens e os
   componentes da app presos às classes do QA (CSS_QA_PAGINAS), para não
   mexer nos da página. O HTML que as páginas recebem é o pilulaDasPaginas.

   As camadas são String.raw, como o guião: nem crases nem cifrão com
   chaveta cá dentro (testes/qa-equipa.test.js guarda-o). */

const JS = 'text/javascript; charset=utf-8';
const CSS = 'text/css; charset=utf-8';

// os ficheiros da app que entram no /equipa/qa.js, pela ordem
export const FICHEIROS_DO_QA = ['/app/icones.js', '/app/formato.js', '/cloud/qa.js'];
// os marcadores do bloco do QA no web/estilos.css
export const MARCA_CSS_INICIO = '/* === tickets de QA:';
export const MARCA_CSS_FIM = '/* === fim: tickets de QA === */';
// as funções da camada que as ações do qa.js chamam (as do qa.js juntam-se na montagem)
export const ACOES_DA_CAMADA = ['closePops', 'closeModal', 'menuOpen', 'abrirSeletorFicheiros', 'toggleFold'];

/* O começo da camada, igual nos dois sítios: os dados que a página traz. */
const DADOS_DA_CAMADA = String.raw`
/* os dados da página: o <script type="application/json" id="dados-qa"> que o
   equipa-vista.js:htmlDoQa (back office) ou o pilulaDasPaginas (montra e guia) escrevem */
var QA_DADOS = (function () {
  try { return JSON.parse(document.getElementById('dados-qa').textContent); } catch (e) { return null; }
})();
`;

/* O que só o back office tem: o QA_EQUIPA, por onde o qa.js sabe que está
   lá (qa.js:qaLugar), e as rotas da equipa. */
const CABECA_DA_EQUIPA = String.raw`
var QA_EQUIPA = QA_DADOS;

/* O caminho do QA no back office: o qa.js pede /api/qa…, aqui é /api/equipa/qa….
   Recebe: p — o caminho que o qa.js pediu.
   Devolve: o caminho a pedir. */
function qaCaminho(p) {
  return String(p).replace(/^\/api\/qa(?=\/|$)/, '/api/equipa/qa');
}
`;

/* O que só as páginas públicas têm: o QA_PAGINAS (qa.js:qaLugar) e as
   rotas da app, as mesmas /api/qa, com a sessão da conta no cookie. */
const CABECA_DAS_PAGINAS = String.raw`
var QA_PAGINAS = QA_DADOS;

/* O caminho do QA nas páginas públicas: o mesmo que o qa.js pediu (as
   rotas da app, rotas/qa.js:rotasQa, que leem a sessão do cookie).
   Recebe: p — o caminho que o qa.js pediu.
   Devolve: o caminho a pedir. */
function qaCaminho(p) {
  return String(p);
}
`;

/* O que o qa.js usa da app, igual no back office e nas páginas. Corre
   depois da cabeça de cada sítio e antes do icones.js, do formato.js e do
   qa.js, dentro da mesma função. */
const NUCLEO_DA_CAMADA = String.raw`
// o CW que o qa.js lê do window: o ambiente, quem está (o mesmo id que o autor dos tickets) e o rasto
window.CW = window.CW || {};
CW.ambiente = QA_DADOS && QA_DADOS.ambiente ? String(QA_DADOS.ambiente) : 'producao';
CW.user = QA_DADOS && QA_DADOS.id ? { id: String(QA_DADOS.id), name: String(QA_DADOS.nome || '') } : null;
CW._rasto = Array.isArray(CW._rasto) ? CW._rasto : [];
// quantos passos o rasto guarda (o qa.js leva os últimos dez)
var QA_RASTO_GUARDA = 30;
// quanto tempo o aviso fica, por omissão (ms)
var QA_AVISO_MS = 2800;

/* Um passo no rasto que vai com os tickets.
   Recebe: s — o passo, em texto.
   Devolve: nada. */
function rastoPoe(s) {
  CW._rasto.push(String(s));
  if (CW._rasto.length > QA_RASTO_GUARDA) CW._rasto.splice(0, CW._rasto.length - QA_RASTO_GUARDA);
}

/* O fetch que o qa.js vê, cá dentro: o do browser, com o caminho do sítio
   (qaCaminho, da cabeça). Os pedidos da página ficam no rasto pelo ouvinte de baixo.
   Recebe: url — o endereço; o — as opções do fetch.
   Devolve: a promessa da Response. */
var fetch = function (url, o) {
  return window.fetch(typeof url === 'string' ? qaCaminho(url) : url, o);
};

// os pedidos da página também entram no rasto (método, caminho e estado)
(function () {
  var doBrowser = window.fetch;
  if (typeof doBrowser !== 'function' || doBrowser.qaRasto) return;
  var comRasto = function (url, o) {
    var metodo = String((o && o.method) || 'GET').toUpperCase(), caminho = '';
    try { caminho = new URL(typeof url === 'string' ? url : url.url, location.href).pathname; } catch (e) { caminho = String(url); }
    return doBrowser.apply(this, arguments).then(function (r) {
      rastoPoe(metodo + ' ' + caminho + ' → ' + r.status);
      return r;
    }, function (e) {
      rastoPoe(metodo + ' ' + caminho + ' → sem rede');
      throw e;
    });
  };
  comRasto.qaRasto = true;
  window.fetch = comRasto;
})();

/* O api() da app para as rotas do QA: JSON de ida e volta, e o erro com a
   frase do servidor e o estado.
   Recebe: method — o método; path — o caminho (/api/qa…); data (opcional) — o corpo.
   Devolve: promessa do JSON; rejeita com um Error com .status. */
function api(method, path, data) {
  var o = { method: method, headers: {}, credentials: 'same-origin' };
  if (data !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(data); }
  return fetch(path, o).then(function (r) {
    return r.text().then(function (t) {
      var j = {};
      try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; }
      if (!r.ok) { var e = new Error((j && j.error) || ('Erro ' + r.status + '.')); e.status = r.status; throw e; }
      return j;
    });
  });
}

/* A sessão vai no cookie (a da equipa no back office, a da conta nas
   páginas públicas), que um pedido à mesma origem leva sozinho: não há
   cabeçalhos a juntar (o Bearer e o X-Rendorium-Token são da app).
   Devolve: um objeto vazio. */
function cabecalhosDaSessao() { return {}; }

/* Quem pediu menos movimento (o continuidade.js:semMovimento da app, que
   o qa.js chama ao encaixar a pílula e ao tirar a etiqueta).
   Devolve: true ou false. */
function semMovimento() {
  try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}

/* O render da app: aqui não pinta nada, mas o qa.js embrulha-o para pôr a
   pílula, e a montagem chama-o uma vez no fim.
   Devolve: nada. */
function render() {}

/* O que a app tira do HTML antes de o pôr no ecrã (a CSP já não corre
   nada escrito lá dentro; isto é a segunda tranca, como na app).
   Recebe: h — o HTML.
   Devolve: o HTML sem etiquetas de script, de estilo nem de iframe. */
function semEtiquetasQueCorrem(h) {
  return String(h == null ? '' : h).replace(/<\/?(script|style|iframe|object|embed)\b[^>]*>/gi, '');
}

/* Um token de tempo do CSS em ms (--medio: .2s → 200).
   Recebe: nome — o token; porOmissao — os ms se não houver.
   Devolve: os ms. */
function msDoToken(nome, porOmissao) {
  var v = '';
  try { v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); } catch (e) {}
  if (/ms$/.test(v)) return parseFloat(v) || porOmissao;
  if (/s$/.test(v)) return (parseFloat(v) || 0) * 1000 || porOmissao;
  return porOmissao;
}

/* O valor de um campo pelo id.
   Recebe: id — o id do campo.
   Devolve: o valor (texto), ou '' sem campo. */
function val(id) {
  var e = document.getElementById(id);
  return e ? e.value : '';
}

/* Abre o seletor de ficheiros escondido.
   Recebe: id — o id do <input type="file">.
   Devolve: nada. */
function abrirSeletorFicheiros(id) {
  var e = document.getElementById(id);
  if (e) e.click();
}

/* ------------------------------------------------------------- o aviso */

/* O aviso de baixo, como o da app: a frase e, com op.rotulo e op.fn, um
   botão (o Anular), que some ao fim de op.ms.
   Recebe: m — a frase; op (opcional) — {rotulo, fn, ms}.
   Devolve: nada. */
function toast(m, op) {
  var t = document.getElementById('qaAviso');
  if (!t) {
    t = document.createElement('div');
    t.id = 'qaAviso';
    t.className = 'qa-aviso';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = '';
  var txt = document.createElement('span');
  txt.textContent = String(m == null ? '' : m);
  t.appendChild(txt);
  if (op && op.rotulo && typeof op.fn === 'function') {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'qa-aviso-btn';
    b.textContent = op.rotulo;
    b.addEventListener('click', function () { clearTimeout(t.qaFim); t.classList.remove('on'); op.fn(); });
    t.appendChild(b);
  }
  t.classList.add('on');
  clearTimeout(t.qaFim);
  t.qaFim = setTimeout(function () { t.classList.remove('on'); }, (op && op.ms) || QA_AVISO_MS);
}

/* O erro de um campo, junto dele (e no aviso), como o da app; larga-se à
   primeira tecla.
   Recebe: id — o id do campo; msg — a frase.
   Devolve: nada. */
function falhaCampo(id, msg) {
  toast(msg);
  var e = document.getElementById(id);
  if (!e) return;
  var idErro = id + '-erro', antes = document.getElementById(idErro);
  if (antes) antes.remove();
  var p = document.createElement('p');
  p.className = 'erro-campo';
  p.id = idErro;
  p.textContent = msg;
  e.insertAdjacentElement('afterend', p);
  e.classList.add('err');
  e.setAttribute('aria-invalid', 'true');
  e.setAttribute('aria-describedby', idErro);
  try { e.focus({ preventScroll: false }); } catch (x) {}
  e.addEventListener('input', function () {
    e.classList.remove('err'); e.removeAttribute('aria-invalid'); e.removeAttribute('aria-describedby'); p.remove();
  }, { once: true });
}

/* -------------------------------------------------------------- o menu */

/* Fecha os menus abertos da pílula.
   Devolve: nada. */
function closePops() {
  [].slice.call(document.querySelectorAll('.qa-pilula .menupop.on')).forEach(function (p) {
    p.classList.remove('on');
    var b = p.parentNode && p.parentNode.querySelector('[aria-expanded]');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}

/* Abre (ou fecha) o menu de um botão, como o menuOpen da app: para baixo,
   ou para cima quando não cabe (o bottom escrito, que o qa.js lê).
   Recebe: e — o evento do clique; id — o fim do id do menu (menu_<id>).
   Devolve: nada. */
function menuOpen(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  var p = document.getElementById('menu_' + id), era = !!(p && p.classList.contains('on'));
  closePops();
  if (!p || era) return;
  p.classList.add('on');
  var b = p.parentNode && p.parentNode.querySelector('[aria-expanded]');
  if (b) b.setAttribute('aria-expanded', 'true');
  p.style.top = ''; p.style.bottom = '';
  var r = b ? b.getBoundingClientRect() : null, alto = p.offsetHeight || 0;
  if (r && r.bottom + 6 + alto > window.innerHeight && r.top - 6 - alto > 0) {
    p.style.top = 'auto';
    p.style.bottom = 'calc(100% + 6px)';
  }
}

/* -------------------------------------------------------------- a dobra */

// as dobras abertas enquanto a janela está aberta
var qaDobrasAbertas = {};

/* Uma secção que abre e fecha, como o fold da app.
   Recebe: id — o id; title — o HTML do título; body — o HTML de dentro;
   o (opcional) — {open, icon}.
   Devolve: o HTML (texto). */
function fold(id, title, body, o) {
  o = o || {};
  var aberta = id in qaDobrasAbertas ? qaDobrasAbertas[id] : !!o.open;
  return '<div class="sect fold' + (aberta ? ' open' : '') + '" id="fold_' + esc(id) + '">' +
    '<button type="button" class="fold-head" aria-expanded="' + (aberta ? 'true' : 'false') + '" data-click="toggleFold(\'' + jsq(id) + '\')">' +
      '<span class="ic">' + ic(o.icon || 'info', 17) + '</span><b>' + title + '</b><span class="chev">' + ic('chevD', 16) + '</span></button>' +
    '<div class="fold-body">' + body + '</div></div>';
}

/* Abre ou fecha uma secção no nó vivo.
   Recebe: id — o id dado ao fold.
   Devolve: nada. */
function toggleFold(id) {
  var el = document.getElementById('fold_' + id);
  if (!el) return;
  var on = !el.classList.contains('open');
  el.classList.toggle('open', on);
  qaDobrasAbertas[id] = on;
  var b = el.querySelector('.fold-head');
  if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
}

/* ----------------------------------------------------------- as janelas */

// as janelas abertas, de baixo para cima (a de cima é a última)
var modalStack = [];
// para os ids dos títulos
var qaJanelasN = 0;

/* A janela de cima.
   Devolve: a camada, ou null. */
function modalTop() {
  return modalStack.length ? modalStack[modalStack.length - 1] : null;
}

/* O corpo da janela de cima.
   Devolve: o elemento .body, ou null. */
function modalBodyEl() {
  var L = modalTop();
  return L && L.el ? L.el.querySelector('.body') : null;
}

/* Abre uma janela por cima do que houver, com o desenho das da app (folha
   de baixo no telemóvel): o título, o corpo, o rodapé e o X.
   Recebe: title — o título; body — o HTML do corpo; foot — o HTML do rodapé.
   Devolve: a camada {el, title, gatilho, tocado}. */
function openModal(title, body, foot) {
  closePops();
  var el = document.createElement('div'), n = ++qaJanelasN;
  el.className = 'modal qa-camada open';
  el.innerHTML = '<div class="bg" data-click="closeModal()"></div>' +
    '<div class="sheet" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="qaJanelaTit' + n + '">' +
      '<div class="head"><h2 id="qaJanelaTit' + n + '"></h2><span></span>' +
        '<button type="button" class="qa-x" aria-label="Fechar" data-click="closeModal()">' + ic('x', 20) + '</button></div>' +
      '<div class="body"></div><div class="foot"></div></div>';
  modalStack.forEach(function (L) { if (L.el) L.el.classList.add('under'); });
  document.body.appendChild(el);
  var L = { el: el, title: title, gatilho: document.activeElement, tocado: false };
  modalStack.push(L);
  fillModal(el, title, body, foot);
  focarModal(el);
  return L;
}

/* Põe o título, o corpo e o rodapé numa janela.
   Recebe: el — a janela; title; body; foot (HTML).
   Devolve: nada. */
function fillModal(el, title, body, foot) {
  el.querySelector('.head h2').textContent = title;
  el.querySelector('.body').innerHTML = semEtiquetasQueCorrem(body);
  el.querySelector('.foot').innerHTML = semEtiquetasQueCorrem(foot || '');
}

/* Leva o foco para a janela.
   Recebe: el — a janela.
   Devolve: nada. */
function focarModal(el) {
  try { el.querySelector('.sheet').focus(); } catch (e) {}
}

/* Fecha a janela de cima: corre o aoFechar dela, devolve o foco a quem a
   abriu e a de baixo volta a ser a da frente.
   Recebe: origem (opcional) — de onde veio o fecho.
   Devolve: nada. */
function closeModal(origem) {
  var L = modalStack.pop();
  if (!L) return;
  if (typeof L.aoFechar === 'function') { try { L.aoFechar(origem || ''); } catch (e) {} }
  if (L.el && L.el.parentNode) L.el.parentNode.removeChild(L.el);
  var top = modalTop();
  if (top && top.el) { top.el.classList.remove('under'); }
  try { if (L.gatilho && document.contains(L.gatilho)) L.gatilho.focus(); else if (top) focarModal(top.el); } catch (e) {}
}

/* Fecha todas as janelas.
   Devolve: nada. */
function closeAllModals() {
  while (modalStack.length) closeModal();
}

/* ------------------------------------------------------------ as ações */

/* Os argumentos de uma ação: textos entre plicas ou aspas (com os escapes
   \\ \' \" \n \t), números, this, event, true, false e null.
   Recebe: s — o que está entre os parênteses; este — o elemento; ev — o evento.
   Devolve: a lista dos valores; lança um Error com um argumento que não conhece. */
function qaArgumentos(s, este, ev) {
  var r = [], re = /\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?|this|event|true|false|null)\s*(?:,|$)/y, m;
  s = String(s || '');
  if (!s.trim()) return r;
  re.lastIndex = 0;
  while (re.lastIndex < s.length && (m = re.exec(s))) {
    var a = m[1], c = a.charAt(0);
    if (c === '\'' || c === '"') {
      r.push(a.slice(1, -1).replace(/\\(.)/g, function (x, k) { return k === 'n' ? '\n' : k === 't' ? '\t' : k; }));
    } else if (a === 'this') r.push(este);
    else if (a === 'event') r.push(ev);
    else if (a === 'true' || a === 'false') r.push(a === 'true');
    else if (a === 'null') r.push(null);
    else r.push(Number(a));
  }
  if (re.lastIndex < s.length) throw new Error('QA: argumentos que não conheço: ' + s);
  return r;
}

/* Corre uma ação do qa.js (nome(args);nome(args)…), só com as funções da
   tabela QA_ACOES: nada de eval, e nada que não seja do QA.
   Recebe: texto — a ação; este — o elemento que a tem; ev — o evento.
   Devolve: nada; lança um Error com uma ação que não conhece. */
function qaCorrerAcao(texto, este, ev) {
  var re = /\s*([A-Za-z_$][\w$]*)\s*\(((?:[^()'"]|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")*)\)\s*(?:;|$)/y, m, s = String(texto || '');
  re.lastIndex = 0;
  while (re.lastIndex < s.length && (m = re.exec(s))) {
    if (!Object.prototype.hasOwnProperty.call(QA_ACOES, m[1])) throw new Error('QA: ação que não conheço: ' + m[1]);
    QA_ACOES[m[1]].apply(este, qaArgumentos(m[2], este, ev));
  }
  if (s.slice(re.lastIndex).trim()) throw new Error('QA: não sei correr «' + s + '»');
}

/* Um clique, uma tecla ou uma mudança num elemento do QA (a pílula, as
   janelas e o aviso dele): corre a ação data-<tipo> do elemento mais perto.
   As do guião (data-acao) não passam por aqui.
   Recebe: ev — o evento; tipo — 'click', 'input' ou 'change'.
   Devolve: nada. */
function qaDespachar(ev, tipo) {
  var t = ev.target;
  if (!t || typeof t.closest !== 'function') return;
  var el = t.closest('[data-' + tipo + ']');
  if (!el || !el.closest('.qa-pilula, .qa-camada')) return;
  if (tipo === 'click' && el.disabled) return;
  qaCorrerAcao(el.getAttribute('data-' + tipo), el, ev);
}

document.addEventListener('click', function (e) {
  // um clique fora dos menus fecha-os
  if (!(e.target && e.target.closest && e.target.closest('.qa-pilula .menuwrap'))) closePops();
  qaDespachar(e, 'click');
});
document.addEventListener('input', function (e) { qaDespachar(e, 'input'); });
document.addEventListener('change', function (e) { qaDespachar(e, 'change'); });
// o Escape fecha primeiro o menu, depois a janela de cima
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (document.querySelector('.qa-pilula .menupop.on')) { closePops(); e.preventDefault(); return; }
  if (modalStack.length) { closeModal('escape'); e.preventDefault(); }
});
`;

// a camada do back office: os dados, o QA_EQUIPA com as rotas da equipa, e o núcleo
export const CAMADA_QA = DADOS_DA_CAMADA + CABECA_DA_EQUIPA + NUCLEO_DA_CAMADA;
// a camada das páginas públicas: os dados, o QA_PAGINAS com as rotas da app, e o mesmo núcleo
export const CAMADA_DAS_PAGINAS = DADOS_DA_CAMADA + CABECA_DAS_PAGINAS + NUCLEO_DA_CAMADA;

/* O fim do /equipa/qa.js, depois do qa.js: o contexto passa a dizer a
   secção do back office, e a pílula aparece. */
export const FIM_DA_CAMADA = String.raw`
/* O contexto de um ticket do back office: o da app, com a secção onde se
   estava (o nome do separador ativo, sem o número de por tratar que vai ao
   lado: equipa-guiao.js, o primeiro <span> do botão) no lugar do
   separador, e o tema do sistema (o back office não tem interruptor).
   Devolve: o objeto do contexto. */
var qaContextoDaApp = qaContexto;
qaContexto = function () {
  var c = qaContextoDaApp();
  var ativo = document.querySelector('#nav [aria-current="page"] > span');
  c.ecra = c.ecra || {};
  c.ecra.pagina = 'Back office' + (ativo && ativo.textContent ? ' › ' + ativo.textContent.trim() : '');
  try { c.tema = { escolhido: 'auto', escuro: !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) }; } catch (e) {}
  return c;
};
render();
`;

/* O fim do /paginas/qa.js, depois do qa.js: o contexto passa a dizer a
   página pública onde se estava, a abertura dela entra no rasto, e a
   pílula aparece. */
export const FIM_DAS_PAGINAS = String.raw`
/* O contexto de um ticket de uma página pública: o da app, com a página (o
   caminho e o título) no lugar do separador, e o tema do sistema (a montra
   e o guia seguem o prefers-color-scheme; o Samsung Internet pode escurecer
   à força a que se mostra clara, e diz-se que pode, como na app).
   Devolve: o objeto do contexto. */
var qaContextoDaApp = qaContexto;
qaContexto = function () {
  var c = qaContextoDaApp(), caminho = '', titulo = '';
  try { caminho = String(location.pathname || ''); } catch (e) {}
  try { titulo = String(document.title || '').trim(); } catch (e) {}
  c.ecra = c.ecra || {};
  c.ecra.pagina = (caminho + (titulo ? ' · ' + titulo : '')).slice(0, 200);
  try {
    var escuro = !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    c.tema = { escolhido: 'auto', escuro: escuro };
    if (!escuro && /SamsungBrowser/i.test(String(navigator.userAgent || ''))) c.tema.forcado = 'possivel';
  } catch (e) {}
  return c;
};
try { rastoPoe('Abriu ' + location.pathname); } catch (e) {}
render();
`;

/* O CSS da camada no back office: os tokens que o CSS_EQUIPA não tem e os
   componentes da app que o qa.js usa, desenhados como na app (a janela, a
   folha de baixo no telemóvel, o menu, o aviso, o formulário, o
   segmentado, a dobra, os selos), tudo preso às classes do QA para não
   mexer no resto do back office. */
export const CSS_QA_EQUIPA = String.raw`/* Os tokens da app que o back office não tem */
:root{--loan:#6845c2;--loan-soft:#efeafb;--lento:.34s;--curva-sai:cubic-bezier(.4,0,1,1);
  --inset-top:env(safe-area-inset-top,0px);--inset-bottom:env(safe-area-inset-bottom,0px);
  --inset-left:env(safe-area-inset-left,0px);--inset-right:env(safe-area-inset-right,0px)}
@media(prefers-color-scheme:dark){:root{--loan:#b49bff;--loan-soft:#2a2247}}
@keyframes popEntra{from{opacity:0;transform:scale(.96)}}
@keyframes qaVeuEntra{from{opacity:0}}
@keyframes qaFolhaEntra{from{opacity:0;transform:translate(-50%,-50%) translateY(14px) scale(.98)}}
@keyframes qaFolhaSobe{from{transform:translateY(100%)}}
/* O menu da pílula (o .menupop da app) */
.qa-pilula .menuwrap{position:relative}
.qa-pilula .menupop{display:none;position:absolute;right:0;top:calc(100% + 6px);z-index:30;background:var(--card);
  border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:6px;min-width:200px}
.qa-pilula .menupop.on{display:block;animation:popEntra var(--medio) var(--curva);transform-origin:top right}
.qa-pilula .menupop button{width:100%;display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 12px;border:0;background:transparent;
  border-radius:10px;cursor:pointer;text-align:left;font:inherit;font-size:15px;color:var(--ink)}
@media(hover:hover) and (pointer:fine){.qa-pilula .menupop button:hover{background:var(--chip)}}
.qa-pilula .menupop button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.qa-pilula svg,.qa-camada svg{flex:0 0 auto}
/* As janelas (o .modal e a .sheet da app): ao centro no computador, folha de baixo no telemóvel */
.qa-camada{position:fixed;inset:0;height:100dvh;z-index:70}
.qa-camada .bg{position:absolute;inset:0;background:var(--veu);animation:qaVeuEntra var(--lento) var(--curva-entra)}
.qa-camada.under .bg{background:rgba(9,14,28,.3)}
.qa-camada.under .sheet{pointer-events:none}
.qa-camada .sheet{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(580px,calc(100vw - 28px));
  max-height:min(88vh,880px);max-height:min(88dvh,880px);background:var(--card);color:var(--ink);border-radius:20px;display:flex;flex-direction:column;
  overflow:hidden;box-shadow:var(--shadow);outline:0;animation:qaFolhaEntra var(--lento) var(--curva-entra)}
.qa-camada .head{padding:12px 12px 12px 20px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line)}
.qa-camada .head h2{margin:0;flex:1;min-width:0;font-family:var(--letra-titulo);font-size:20px;line-height:1.2}
.qa-camada .head>span:empty{display:none}
.qa-x{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:12px;background:transparent;color:var(--muted);cursor:pointer}
@media(hover:hover) and (pointer:fine){.qa-x:hover{background:var(--chip);color:var(--ink)}}
.qa-x:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.qa-camada .body{overscroll-behavior:contain;padding:18px 20px;overflow:auto}
.qa-camada .foot{padding:14px 20px calc(14px + var(--inset-bottom));border-top:1px solid var(--line);display:flex;gap:10px}
.qa-camada .foot .btn{flex:1;justify-content:center;min-height:48px}
@media(max-width:520px){
  .qa-camada .sheet{top:auto;bottom:0;left:0;transform:none;width:100%;max-height:93vh;max-height:93dvh;border-radius:20px 20px 0 0;animation:qaFolhaSobe var(--lento) var(--curva-entra)}
}
/* O formulário, os campos e os textos pequenos da app */
.qa-camada .form{display:grid;gap:13px}
.qa-camada .form>*{min-width:0}
.qa-camada label{font-size:14px;color:var(--ink);display:grid;gap:6px;font-weight:600}
.qa-camada .flabel{font-size:14px;color:var(--ink);font-weight:600;margin-bottom:7px}
/* o asterisco dos obrigatórios na linha do rótulo, como na app (estilos.css, folha 2.2) */
.qa-camada .req{font-weight:700;margin-left:3px}
.qa-camada label:has(>.req){grid-template-columns:minmax(0,max-content) 1fr;column-gap:4px}
.qa-camada label:has(>.req)>:not(.req){grid-column:1/-1}
.qa-camada textarea{width:100%;min-height:90px;max-height:60vh;max-height:60dvh;resize:vertical;field-sizing:content;padding:11px 14px;
  border:1px solid var(--line2);border-radius:12px;background:var(--field);color:var(--ink);font:inherit;font-size:15px;font-weight:400;line-height:1.35}
.qa-camada textarea:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.qa-camada textarea.err{border-color:var(--danger)}
.qa-camada .hint{margin:0;font-size:13px;color:var(--muted);line-height:1.5;font-weight:400}
.qa-camada .small{font-size:13px;color:var(--muted)}
.qa-camada .num{font-variant-numeric:tabular-nums}
.qa-camada .erro-campo{color:var(--danger);font-size:13px;font-weight:600;margin:0}
.qa-camada .stat{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:14.5px}
.qa-camada .stat:last-child{border-bottom:0}
.qa-camada .stat b{font-weight:600}
.qa-camada .empty{padding:18px;color:var(--muted);border:1px dashed var(--line2);border-radius:14px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;font-size:14px}
.qa-camada .empty b{display:block;color:var(--ink);font-weight:600;font-size:15px}
.qa-camada .u-d-none{display:none}
.qa-camada .u-minh-130px{min-height:130px}
.qa-camada .u-c-v-danger{color:var(--danger)}
/* O segmentado da gravidade */
.qa-camada .segm{display:flex;gap:2px;padding:4px;border-radius:12px;background:var(--chip);border:1px solid var(--line);min-width:0}
.qa-camada .segm>button{flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 8px;border:0;border-radius:9px;
  background:transparent;color:var(--muted);font:inherit;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.qa-camada .segm>[aria-checked="true"]{background:var(--card);color:var(--ink);font-weight:600;box-shadow:0 1px 2px rgba(16,24,40,.14)}
.qa-camada .segm>button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
/* A dobra («O que vai junto», «Contexto») */
.qa-camada .fold{border:1px solid var(--line);border-radius:14px}
.qa-camada .fold-head{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:10px 14px;border:0;background:transparent;cursor:pointer;
  text-align:left;font:inherit;font-size:15px;color:var(--ink);border-radius:14px}
.qa-camada .fold-head .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent-text);flex:0 0 34px}
.qa-camada .fold-head b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.qa-camada .fold-head .chev{margin-left:auto;display:flex;color:var(--muted);transition:transform var(--medio) var(--curva)}
.qa-camada .fold.open>.fold-head .chev{transform:rotate(180deg)}
.qa-camada .fold-head:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.qa-camada .fold-body{display:none;padding:2px 14px 14px;gap:13px}
.qa-camada .fold.open>.fold-body{display:grid}
/* Os selos da app (o back office tem outros nomes para as mesmas cores) */
.qa-camada .badge,.qa-pilula .badge{border-radius:6px}
.qa-camada .badge.red{background:var(--danger-soft);color:var(--danger)}
.qa-camada .badge.amber{background:var(--warn-soft);color:var(--warn)}
.qa-camada .badge.grey{background:var(--chip);color:var(--muted)}
.qa-camada .badge.in{background:var(--in-soft);color:var(--in)}
.qa-camada .badge.loan{background:var(--loan-soft);color:var(--loan)}
/* O aviso do QA (o .toast da app), com o Anular */
.qa-aviso{position:fixed;left:50%;bottom:calc(22px + var(--inset-bottom));transform:translateX(-50%) translateY(80px);z-index:90;display:flex;align-items:center;gap:12px;
  max-width:90vw;width:max-content;padding:10px 16px;border-radius:14px;background:var(--toast);color:var(--toast-ink);font-size:14.5px;font-weight:500;
  box-shadow:0 10px 30px rgba(16,24,40,.22);opacity:0;pointer-events:none;transition:opacity var(--medio) var(--curva-sai),transform var(--medio) var(--curva-sai)}
.qa-aviso.on{opacity:1;transform:translateX(-50%);pointer-events:auto;transition:opacity var(--medio) var(--curva),transform var(--medio) var(--curva)}
.qa-aviso-btn{min-height:44px;padding:0 6px;border:0;background:transparent;color:inherit;font:inherit;font-weight:700;text-decoration:underline;cursor:pointer}
@media(prefers-reduced-motion:reduce){.qa-camada .bg,.qa-camada .sheet,.qa-pilula .menupop.on{animation:none}.qa-aviso{transition:none}}
`;

/* O que as páginas públicas (a montra e o guia) pedem a mais, depois do
   CSS do back office e do bloco do QA: os tokens da app presos às caixas
   do QA (e não ao :root, que é da página: a montra tem os seus, com os
   mesmos nomes e outro conjunto), os componentes da app que o back office
   tem e a página não (o botão, o selo, o asterisco, a roda) e o que a folha
   da página mudava nos títulos. A pílula (60), as janelas (70) e o aviso
   (90) ficam por cima do cabeçalho pegajoso da montra (20). No escurecimento
   forçado do Samsung Internet o fundo muda e a frente fica: a gravidade
   escolhida leva também um contorno da cor da frente. */
export const CSS_QA_PAGINAS = String.raw`/* Os tokens da app, só dentro do QA */
.qa-pilula,.qa-sonda,.qa-camada,.qa-aviso{
  --bg:#f2f3f6;--card:#ffffff;--field:#ffffff;--chip:#f6f7f9;--tint:#f6f7f9;--press:#e9ecf2;
  --ink:#121826;--muted:#4f586b;--line:#e2e5eb;--line2:#cdd2db;
  --accent:#2952d9;--accent-ink:#ffffff;--accent-soft:#e9eefc;--accent-text:#1d3fb0;--accent-press:#1d3fb0;
  --in:#16775a;--in-soft:#e2f3eb;--loan:#6845c2;--loan-soft:#efeafb;
  --danger:#b42318;--danger-soft:#fde8e6;--warn:#8f5600;--warn-soft:#fff1d1;
  --toast:#121826;--toast-ink:#ffffff;--shadow:0 16px 40px rgba(16,24,40,.16);--veu:rgba(9,14,28,.55);
  --letra:'Geist',system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --letra-titulo:'Bricolage Grotesque','Geist',system-ui,-apple-system,"Segoe UI",sans-serif;
  --rapido:.12s;--medio:.2s;--lento:.34s;--volta:.9s;
  --curva:cubic-bezier(.22,1,.36,1);--curva-entra:cubic-bezier(0,0,.2,1);--curva-sai:cubic-bezier(.4,0,1,1);
  --inset-top:env(safe-area-inset-top,0px);--inset-bottom:env(safe-area-inset-bottom,0px);
  --inset-left:env(safe-area-inset-left,0px);--inset-right:env(safe-area-inset-right,0px)}
@media(prefers-color-scheme:dark){.qa-pilula,.qa-sonda,.qa-camada,.qa-aviso{
  --bg:#0b111e;--card:#141c2c;--field:#141c2c;--chip:#1a2335;--tint:#1a2335;--press:#253049;
  --ink:#e9edf5;--muted:#aeb7c9;--line:#253049;--line2:#33405c;
  --accent:#7c9bff;--accent-ink:#0b111e;--accent-soft:#1e2a4d;--accent-text:#b5c6ff;--accent-press:#9db3ff;
  --in:#4cc79a;--in-soft:#123327;--loan:#b49bff;--loan-soft:#2a2247;
  --danger:#ff8a80;--danger-soft:#3d1a1a;--warn:#f2c25a;--warn-soft:#352a12;
  --toast:#e9edf5;--toast-ink:#121826;--shadow:0 24px 60px rgba(0,0,0,.6);--veu:rgba(2,5,12,.66)}}
@media(prefers-contrast:more){.qa-pilula,.qa-sonda,.qa-camada,.qa-aviso{--line:#8a93a5;--line2:#6b7385;--muted:#384152}}
@media(prefers-contrast:more) and (prefers-color-scheme:dark){.qa-pilula,.qa-sonda,.qa-camada,.qa-aviso{--line:#56627d;--line2:#6e7a96;--muted:#c9d0dd}}
.qa-pilula,.qa-camada,.qa-aviso{font-family:var(--letra);line-height:1.45}
/* Os títulos das janelas: a folha do guia põe os h2 em linha flexível */
.qa-camada .head h2{display:block;letter-spacing:normal}
/* O botão da app (o .btn), com o premido e o rato à parte */
.qa-camada .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;border-radius:12px;
  border:1px solid var(--line2);background:var(--card);color:var(--ink);font:inherit;font-weight:600;font-size:15px;line-height:1.2;
  text-decoration:none;white-space:nowrap;cursor:pointer;transition:background-color var(--rapido) var(--curva),border-color var(--rapido) var(--curva)}
.qa-camada .btn:active{background:var(--press)}
.qa-camada .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.qa-camada .btn.primary:active{background:var(--accent-press);border-color:var(--accent-press)}
.qa-camada .btn.sm{min-height:36px;padding:0 12px;font-size:14px;border-radius:10px}
.qa-camada .btn.qa-remover{color:var(--danger)}
.qa-camada .btn:disabled{opacity:.5;cursor:not-allowed}
.qa-camada .btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(hover:hover) and (pointer:fine){
  .qa-camada .btn:not(:disabled):hover{background:var(--tint)}
  .qa-camada .btn.primary:not(:disabled):hover{background:var(--accent-press);border-color:var(--accent-press)}
}
@media(pointer:coarse){.qa-camada .btn.sm{min-height:44px}}
/* O selo, o asterisco dos obrigatórios, a roda e a espera */
.qa-camada .badge,.qa-pilula .badge{display:inline-flex;align-items:center;gap:5px;min-height:22px;padding:2px 8px;background:var(--accent-soft);
  color:var(--accent-text);font-size:12px;font-weight:600;line-height:1.3;white-space:nowrap}
.qa-camada .req{color:var(--danger)}
@keyframes qaRoda{to{transform:rotate(1turn)}}
.qa-camada .roda{display:inline-block;flex:0 0 18px;width:18px;height:18px;border-radius:50%;border:2.5px solid var(--line2);
  border-top-color:var(--accent);animation:qaRoda var(--volta) linear infinite}
.qa-camada .espera{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:var(--chip);font-size:14px;color:var(--muted)}
.qa-camada .espera b{color:var(--ink);font-weight:600}
.qa-camada .qa-ver-img.a-carregar::after{content:"";position:absolute;inset:0;width:22px;height:22px;margin:auto;border-radius:50%;
  border:2.5px solid var(--line2);border-top-color:var(--accent);animation:qaRoda var(--volta) linear infinite}
/* A gravidade escolhida também na cor da frente (o escurecimento forçado muda os fundos) */
.qa-camada .segm>[aria-checked="true"]{box-shadow:inset 0 0 0 1.5px currentColor,0 1px 2px rgba(16,24,40,.14)}
@media(prefers-reduced-motion:reduce){.qa-camada .roda{animation-duration:2.4s}.qa-camada .qa-ver-img.a-carregar::after{animation:none}}
`;

/* O bloco do QA do web/estilos.css, cortado pelos marcadores (com eles).
   Recebe: estilos — o texto do web/estilos.css.
   Devolve: o bloco (texto); lança um Error se os marcadores não estiverem
   lá, para nunca se servir meia folha. */
export function cortarCssDoQa(estilos) {
  const s = String(estilos || '');
  const i = s.indexOf(MARCA_CSS_INICIO), f = s.indexOf(MARCA_CSS_FIM);
  if (i < 0 || f < i) throw new Error('O bloco do QA não está no web/estilos.css (os marcadores mudaram?).');
  return s.slice(i, f + MARCA_CSS_FIM.length);
}

/* Os nomes das funções declaradas no topo de um ficheiro (function nome(),
   ao princípio da linha) — os do qa.js entram na tabela das ações.
   Recebe: src — o código.
   Devolve: a lista dos nomes, sem repetidos. */
export function funcoesDeTopo(src) {
  const nomes = [];
  for (const m of String(src || '').matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    if (!nomes.includes(m[1])) nomes.push(m[1]);
  }
  return nomes;
}

/* As duas variantes da montagem: o back office (/equipa/qa.js e
   /equipa/qa.css) e as páginas públicas (/paginas/qa.js e /paginas/qa.css). */
const VARIANTES = {
  equipa: {
    camada: CAMADA_QA, fim: FIM_DA_CAMADA, js: '/equipa/qa.js', css: '/equipa/qa.css',
    cabeca: '/* A pílula do QA no back office (worker/src/equipa-qa.js): a camada, o\n'
      + '   icones.js, o formato.js e o qa.js da app, numa função só. */\n',
  },
  paginas: {
    camada: CAMADA_DAS_PAGINAS, fim: FIM_DAS_PAGINAS, js: '/paginas/qa.js', css: '/paginas/qa.css',
    cabeca: '/* A pílula do QA nas páginas públicas do dev (worker/src/equipa-qa.js): a\n'
      + '   camada, o icones.js, o formato.js e o qa.js da app, numa função só. */\n',
  },
};

/* A variante pedida, com o back office por omissão.
   Recebe: variante — 'equipa', 'paginas' ou nada.
   Devolve: o objeto da variante; lança um Error com outro nome. */
function varianteDe(variante) {
  const v = variante == null ? 'equipa' : variante;
  if (!Object.prototype.hasOwnProperty.call(VARIANTES, v)) throw new Error('Não há a variante «' + v + '» da pílula do QA.');
  return VARIANTES[v];
}

/* O guião da pílula inteiro (o /equipa/qa.js ou o /paginas/qa.js): a camada
   do sítio, os ficheiros da app e o fim, dentro de uma função só, e a
   tabela QA_ACOES com as funções do qa.js e as da camada (cada entrada
   chama o nome no momento: o qa.js troca o openModal e o closeModal por
   embrulhos dele, e é o de agora que tem de correr).
   Recebe: textos — {'/app/icones.js': …, '/app/formato.js': …, '/cloud/qa.js': …};
   variante (opcional) — 'equipa' (por omissão) ou 'paginas'.
   Devolve: o JavaScript (texto). */
export function montarGuiaoDoQa(textos, variante) {
  const v = varianteDe(variante);
  const partes = FICHEIROS_DO_QA.map((f) => {
    const t = textos && textos[f];
    if (typeof t !== 'string' || !t) throw new Error('Falta o ' + f + ' para montar o ' + v.js + '.');
    return '/* ---- ' + f + ' ---- */\n' + t;
  });
  const nomes = funcoesDeTopo(textos['/cloud/qa.js']).filter((n) => /^qa/.test(n)).concat(ACOES_DA_CAMADA);
  const tabela = 'var QA_ACOES = {\n' + nomes.map((n) => '  ' + n + ': function () { return ' + n + '.apply(this, arguments); }').join(',\n') + '\n};\n';
  return v.cabeca + '(function () {\n' + v.camada + '\n' + tabela + partes.join('\n') + '\n' + v.fim + '\n})();\n';
}

/* O CSS da pílula inteiro: o da camada e o bloco do QA da app (o
   /equipa/qa.css) e, nas páginas públicas, o CSS_QA_PAGINAS no fim (o
   /paginas/qa.css).
   Recebe: estilos — o texto do web/estilos.css; variante (opcional) —
   'equipa' (por omissão) ou 'paginas'.
   Devolve: o CSS (texto). */
export function montarCssDoQa(estilos, variante) {
  const base = CSS_QA_EQUIPA + '\n' + cortarCssDoQa(estilos) + '\n';
  return varianteDe(variante) === VARIANTES.paginas ? base + CSS_QA_PAGINAS + '\n' : base;
}

/* Lê um ficheiro dos assets (a pasta web/), como o browser o receberia.
   Recebe: env — o ambiente do worker (env.ASSETS); base — o URL do pedido;
   caminho — o caminho do ficheiro.
   Devolve: promessa do texto; lança um Error se não vier. */
async function lerAsset(env, base, caminho) {
  const r = await env.ASSETS.fetch(new Request(new URL(caminho, base).toString()));
  if (!r.ok) throw new Error('O asset ' + caminho + ' respondeu ' + r.status + '.');
  return r.text();
}

/* Serve o guião e o CSS de uma variante da pílula: só no dev (sem
   env.ENV_NAME, 404 como se não existissem), só por GET ou HEAD (405), e só
   com sessão (401 sem ela); nunca em cache.
   Recebe: env — o ambiente do worker; url — o URL do pedido; metodo — o
   método HTTP; comSessao — true quando o pedido traz a sessão que a
   variante pede; variante — 'equipa' ou 'paginas'; semSessao — a frase do 401.
   Devolve: promessa da Response, ou de null quando o caminho não é desta variante. */
async function servirDoQa(env, url, metodo, comSessao, variante, semSessao) {
  const v = varianteDe(variante);
  const caminho = (typeof url === 'string' ? new URL(url) : url).pathname;
  const js = caminho === v.js, css = caminho === v.css;
  if (!js && !css) return null;
  const texto = (status, t, extra) => new Response(t, { status, headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, extra) });
  if (!env || !env.ENV_NAME) return texto(404, 'Não encontrado');
  if (metodo !== 'GET' && metodo !== 'HEAD') return texto(405, 'Método não permitido.', { Allow: 'GET, HEAD' });
  if (!comSessao) return texto(401, semSessao);
  let corpo;
  if (js) {
    const textos = {};
    for (const f of FICHEIROS_DO_QA) textos[f] = await lerAsset(env, url, f);
    corpo = montarGuiaoDoQa(textos, variante);
  } else {
    corpo = montarCssDoQa(await lerAsset(env, url, '/estilos.css'), variante);
  }
  return new Response(metodo === 'HEAD' ? null : corpo, { headers: { 'Content-Type': js ? JS : CSS, 'Cache-Control': 'no-store' } });
}

/* Serve o /equipa/qa.js e o /equipa/qa.css: só no dev e só com sessão de equipa.
   Recebe: env — o ambiente do worker; url — o URL do pedido; metodo — o
   método HTTP; eu — a sessão de equipa (ou null).
   Devolve: promessa da Response, ou de null quando o caminho não é destes. */
export async function recursoDoQa(env, url, metodo, eu) {
  return servirDoQa(env, url, metodo, !!eu, 'equipa', 'Sem sessão de equipa.');
}

/* Serve o /paginas/qa.js e o /paginas/qa.css, a pílula da montra e do guia:
   só no dev (404 sem env.ENV_NAME), só por GET ou HEAD (405) e só com a
   sessão de uma conta (401 sem ela), sempre no-store.
   Recebe: env — o ambiente do worker; url — o URL do pedido; metodo — o
   método HTTP; conta — a conta da sessão, {id, name, email} (o
   auth.js:getSessionUser), ou null.
   Devolve: promessa da Response, ou de null quando o caminho não é destes. */
export async function recursoDoQaDasPaginas(env, url, metodo, conta) {
  return servirDoQa(env, url, metodo, !!(conta && conta.id), 'paginas', 'Sem sessão.');
}

/* Um valor posto dentro de um <script> (o bloco application/json dos dados
   da pílula): o JSON dele, com o < trocado pelo escape, e as quebras U+2028 e
   U+2029 também (o mesmo que o equipa-vista.js:paraScript). Um </script>
   num nome fechava o bloco; o escape lê-se < no JSON.parse da camada.
   Recebe: v — o valor (qualquer coisa que o JSON aceite).
   Devolve: o texto JSON, seguro dentro de um <script>. */
function jsonParaScript(v) {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));
}

/* O HTML da pílula nas páginas públicas (a montra e o guia), escrito tal e
   qual antes do </body> (o op.qa do landing.js e do guia-vista.js): o CSS,
   os dados da conta da própria sessão num bloco de dados (que não corre) e
   o guião, da mesma origem (a CSP_ESTRITA só deixa script-src 'self').
   Recebe: env — o ambiente do worker (env.ENV_NAME só existe fora de
   produção); conta — a conta da sessão, {id, name, email}, ou null.
   Devolve: promessa do HTML (texto); '' em produção ou sem conta. */
export async function pilulaDasPaginas(env, conta) {
  if (!env || !env.ENV_NAME || !conta || !conta.id) return '';
  const dados = { ambiente: String(env.ENV_NAME), id: String(conta.id), nome: String(conta.name || '') };
  return '<link rel="stylesheet" href="/paginas/qa.css">'
    + '<script type="application/json" id="dados-qa">' + jsonParaScript(dados) + '</script>'
    + '<script src="/paginas/qa.js"></script>';
}
