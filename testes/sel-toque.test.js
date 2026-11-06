// O menu de escolha (componentes.js:sel, selOpen e selPick) fecha de uma vez
// quando se escolhe uma opção ao toque. Ticket de QA b0c85090: no formulário
// «Nova hipoteca», no telemóvel (Samsung Internet 30, um Chrome 143), escolher
// o tipo de um produto facultativo fazia o menu piscar e ficar aberto.
//
// Quase todos os sel() vivem dentro de um <label>, o rótulo do campo. O label
// passa o clique ao botão do sel() (o controlo dele) sempre que o clique não
// vem de um botão de dentro, e o Chromium de antes da correção de janeiro de
// 2026 decidia isso pelo DOM de DEPOIS dos ouvintes: o <span> tocado já tinha
// sido trocado pelo innerHTML do selPick, já não estava dentro de botão
// nenhum, e o label clicava no botão — o selOpen reabria o menu. O Chromium de
// agora olha para o caminho do evento guardado no início, e não o via.
//
// Aqui o DOM é de faz-de-conta mas com pais e filhos a sério (o innerHTML
// troca os nós e os de antes ficam fora do documento), e o clique corre como
// no browser: o caminho fica fixo no início, as ações dos data-click
// (eventos.js:correrAcao) correm do alvo para cima até alguém parar a
// propagação, e no fim, sem preventDefault, a ação por omissão do label — com
// a regra de antes (o DOM de agora) e com a de agora (o caminho do evento).
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, igual, repor } from './arnes.js';

const app = carregarApp();

// os elementos sem fecho
const VAZIOS = new Set(['INPUT', 'BR', 'IMG', 'HR', 'META', 'LINK']);
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };
/* Desfaz as entidades que o esc() escreve.
   Recebe: s — o texto.
   Devolve: o texto com &amp;, &lt;, &gt;, &quot; e &#39; trocados. */
const desfaz = (s) => s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m, k) => ENTIDADES[k]);

/* Um documento de faz-de-conta: a raiz (o que está no ecrã), o foco, e nós
   com pai e filhos que se procuram por seletores simples.
   Recebe: nada.
   Devolve: {raiz, doc, analisar(html)}. */
function documento() {
  const doc = { activeElement: null };
  /* Um seletor simples (tag, .classe, #id, [atributo]) casa com o nó?
     Recebe: no — o nó; s — o seletor simples.
     Devolve: true ou false; rebenta com um seletor que o faz-de-conta não sabe. */
  const casaSimples = (no, s) => {
    const m = /^([a-zA-Z][\w-]*)?((?:[.#][\w-]+|\[[\w-]+\])*)$/.exec(s);
    if (!m) throw new Error('seletor fora do faz-de-conta: ' + s);
    if (no.tagName === '#text') return false;
    if (m[1] && no.tagName !== m[1].toUpperCase()) return false;
    for (const p of m[2].match(/[.#][\w-]+|\[[\w-]+\]/g) || []) {
      if (p[0] === '.' && !no.classList.contains(p.slice(1))) return false;
      if (p[0] === '#' && no.id !== p.slice(1)) return false;
      if (p[0] === '[' && !no.hasAttribute(p.slice(1, -1))) return false;
    }
    return true;
  };
  /* Um seletor (lista com vírgulas, descendentes com espaços) casa com o nó?
     Recebe: no — o nó; sel — o seletor.
     Devolve: true ou false. */
  const casa = (no, sel) => sel.split(',').map((x) => x.trim()).some((s) => {
    const partes = s.split(/\s+/);
    if (!casaSimples(no, partes[partes.length - 1])) return false;
    let x = no.pai;
    for (let k = partes.length - 2; k >= 0; k--) {
      while (x && !casaSimples(x, partes[k])) x = x.pai;
      if (!x) return false;
      x = x.pai;
    }
    return true;
  });
  class No {
    constructor(tag, attrs) {
      this.tagName = tag; this.attrs = attrs || {}; this.filhos = []; this.pai = null; this.texto = '';
      this.style = {}; this.offsetHeight = 372; this.offsetTop = 0; this.scrollTop = 0; this.clientHeight = 260;
    }
    get parentNode() { return this.pai; }
    get parentElement() { return this.pai; }
    get isConnected() { let x = this; while (x.pai) x = x.pai; return x === raiz; }
    get id() { return this.attrs.id || ''; }
    get className() { return this.attrs.class || ''; }
    set className(v) { this.attrs.class = String(v); }
    get classList() {
      const no = this, cls = () => new Set(no.className.split(/\s+/).filter(Boolean)), poe = (s) => { no.className = [...s].join(' '); };
      return {
        contains: (c) => cls().has(c),
        add: (c) => { const s = cls(); s.add(c); poe(s); },
        remove: (c) => { const s = cls(); s.delete(c); poe(s); },
        toggle: (c, f) => { const s = cls(); const q = f === undefined ? !s.has(c) : !!f; if (q) s.add(c); else s.delete(c); poe(s); return q; },
      };
    }
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); }
    removeAttribute(k) { delete this.attrs[k]; }
    get value() { return this.valor !== undefined ? this.valor : (this.attrs.value || ''); }
    set value(v) { this.valor = String(v); }
    get textContent() { return this.tagName === '#text' ? this.texto : this.filhos.map((f) => f.textContent).join(''); }
    set textContent(v) { this.largar(); const t = new No('#text'); t.texto = String(v); this.anexar(t); }
    get innerHTML() {
      return this.filhos.map((f) => (f.tagName === '#text' ? f.texto : '<' + f.tagName.toLowerCase()
        + Object.entries(f.attrs).map(([k, v]) => ' ' + k + '="' + v + '"').join('') + '>' + f.innerHTML + (VAZIOS.has(f.tagName) ? '' : '</' + f.tagName.toLowerCase() + '>'))).join('');
    }
    // como no browser: os filhos de antes saem do documento, e entram nós novos
    set innerHTML(h) { this.largar(); analisar(h).forEach((n) => this.anexar(n)); }
    largar() { this.filhos.forEach((f) => { f.pai = null; }); this.filhos = []; }
    anexar(n) { n.pai = this; this.filhos.push(n); return n; }
    appendChild(n) { return this.anexar(n); }
    contains(o) { for (let x = o; x; x = x.pai) if (x === this) return true; return false; }
    *descendentes() { for (const f of this.filhos) { if (f.tagName !== '#text') { yield f; yield* f.descendentes(); } } }
    querySelectorAll(s) { return [...this.descendentes()].filter((n) => casa(n, s)); }
    querySelector(s) { return this.querySelectorAll(s)[0] || null; }
    closest(s) { for (let x = this; x; x = x.pai) if (x.tagName !== '#text' && casa(x, s)) return x; return null; }
    focus() { doc.activeElement = this; }
    blur() { if (doc.activeElement === this) doc.activeElement = null; }
    addEventListener() {} removeEventListener() {}
    getBoundingClientRect() { return { top: 300, bottom: 346, left: 16, right: 368, width: 352, height: 46 }; }
  }
  /* Lê HTML para nós (sem pai). Chega para o que o sel() e as linhas da
     hipoteca escrevem: etiquetas com atributos, as vazias, as fechadas com
     «/>» (os <path> dos ícones) e texto.
     Recebe: html — o texto.
     Devolve: os nós de topo (array). */
  function analisar(html) {
    const topo = new No('#frag'), pilha = [topo];
    const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(html))) {
      const cima = pilha[pilha.length - 1];
      if (m[1]) { const t = m[1].toUpperCase(); const i = pilha.map((n) => n.tagName).lastIndexOf(t); if (i > 0) pilha.length = i; continue; }
      if (m[2]) {
        const attrs = {};
        for (const a of m[3].matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]] = desfaz(a[2] ?? a[3] ?? a[4] ?? '');
        const n = cima.anexar(new No(m[2].toUpperCase(), attrs));
        if (!m[4] && !VAZIOS.has(n.tagName)) pilha.push(n);
        continue;
      }
      if (m[5]) { const t = new No('#text'); t.texto = desfaz(m[5]); cima.anexar(t); }
    }
    const nos = topo.filhos.slice();
    topo.largar();
    return nos;
  }
  const raiz = new No('BODY');
  return { raiz, doc, analisar, No };
}

// os elementos que um <label> rotula, e o conteúdo interativo (HTML, «the label element»)
const ROTULAVEL = (n) => ['BUTTON', 'SELECT', 'TEXTAREA', 'METER', 'OUTPUT', 'PROGRESS'].includes(n.tagName) || (n.tagName === 'INPUT' && n.getAttribute('type') !== 'hidden');
const INTERATIVO = (n) => ['BUTTON', 'SELECT', 'TEXTAREA', 'LABEL', 'DETAILS', 'IFRAME', 'EMBED'].includes(n.tagName)
  || (n.tagName === 'INPUT' && n.getAttribute('type') !== 'hidden') || (n.tagName === 'A' && n.hasAttribute('href'));

let d, cliques, mudou;

/* Monta um pedaço de formulário no ecrã de faz-de-conta e liga o document da
   app a ele (getElementById só acha o que está no ecrã, como o browser).
   Recebe: html — o que se põe dentro da folha da janela.
   Devolve: nada (fica em d). */
function montar(html) {
  d = documento();
  const folha = d.raiz.anexar(new d.No('DIV', { class: 'sheet', tabindex: '-1' }));
  folha.innerHTML = html;
  app.document.getElementById = (id) => d.raiz.querySelectorAll('[id]').find((n) => n.id === id) || null;
  app.document.querySelectorAll = (s) => d.raiz.querySelectorAll(s);
  app.document.querySelector = (s) => d.raiz.querySelector(s);
  /* o onchange que cada sel() registou (o nome de uma função da app) só
     conta: o que ele faz ao formulário é dos testes da hipoteca */
  for (const n of d.raiz.querySelectorAll('.sel')) {
    const cfg = app.__sel[n.id.slice(4)];
    if (cfg && typeof cfg.onchange === 'string' && cfg.onchange) app[cfg.onchange] = () => { mudou++; };
  }
}

/* A ação por omissão do <label> num click que chegou até ele sem
   preventDefault: se o clique não vem do controlo nem de conteúdo interativo
   de dentro, o label foca o controlo e clica nele.
   Recebe: rot — o label; alvo — o alvo do click; caminho — o caminho do
   evento, guardado no início; regra — 'dom' (o Chromium até à correção de
   janeiro de 2026: o DOM de agora, a partir do alvo; o alvo que saiu do
   documento já não está dentro do label) ou 'caminho' (o Chromium de agora).
   Devolve: nada. */
function acaoDoLabel(rot, alvo, caminho, regra) {
  const controlo = [...rot.descendentes()].find(ROTULAVEL);
  if (!controlo || controlo.contains(alvo)) return;
  if (regra === 'dom') {
    if (rot.contains(alvo)) for (let x = alvo; x && x !== rot; x = x.pai) if (INTERATIVO(x)) return;
  } else {
    for (const x of caminho) { if (x === rot) break; if (INTERATIVO(x)) return; }
  }
  controlo.focus();
  clicar(controlo, { detail: 1 }, regra);
}

/* Um click como o browser o dá: o caminho do alvo até à raiz fica fixo no
   início, cada data-click do caminho corre (eventos.js:correrAcao, a mesma
   que o ouvinte do window chama) do alvo para cima até um stopPropagation, e
   no fim, se ninguém fez preventDefault, a ação por omissão do label que
   estiver no caminho.
   Recebe: alvo — o nó onde o dedo (ou o teclado) cai; extra — as
   propriedades do evento; regra — a do label ('dom' ou 'caminho').
   Devolve: o evento. */
function clicar(alvo, extra, regra) {
  const caminho = [];
  for (let n = alvo; n; n = n.pai) caminho.push(n);
  let parado = false, impedido = false;
  const ev = Object.assign({ type: 'click', target: alvo, detail: 1, isTrusted: true }, extra, {
    stopPropagation() { parado = true; },
    preventDefault() { impedido = true; },
  });
  Object.defineProperty(ev, 'defaultPrevented', { get: () => impedido });
  cliques.push(alvo.id || alvo.className || alvo.tagName);
  for (const n of caminho) {
    if (parado) break;
    const t = n.getAttribute('data-click');
    if (t != null) app.correrAcao(t, n, ev);
  }
  if (!impedido) { const rot = caminho.find((n) => n.tagName === 'LABEL'); if (rot) acaoDoLabel(rot, alvo, caminho, regra); }
  return ev;
}

/* Um toque: o click do dedo (pointerType touch, detail 1) no alvo.
   Recebe: alvo — o nó; regra — a do label.
   Devolve: o evento. */
const tocar = (alvo, regra) => clicar(alvo, { pointerType: 'touch' }, regra);

/* O estado do menu de um sel(): aberto (a classe on) e o aria-expanded do botão.
   Recebe: id — o id dado ao sel().
   Devolve: [aberto, aria-expanded]. */
const menu = (id) => [app.document.getElementById('pop_' + id).classList.contains('on'), app.document.getElementById('selb_' + id).getAttribute('aria-expanded')];
/* O <span> do rótulo de uma opção: é aí que o dedo cai.
   Recebe: id — o id do sel(); rotulo — o texto da opção.
   Devolve: o nó. */
const spanDaOpcao = (id, rotulo) => app.document.getElementById('pop_' + id).querySelectorAll('.selopt').find((b) => b.textContent.trim() === rotulo).querySelector('span');

/* A linha de um produto da hipoteca, como o formulário a desenha
   (imovel.js:loanProdLinha): o sel() do tipo dentro do <label class="hip-prod-tipo">.
   Devolve: o HTML. */
const linhaDoProduto = () => '<ul class="hip-prod-lista">' + app.loanProdLinha({ id: 'h1', type: 'variavel' }, { id: 'p1', tipo: 'seguro_vida', ativo: false }, app.produtosReducoes('variavel')) + '</ul>';

beforeEach(() => {
  cliques = [];
  mudou = 0;
});
afterEach(() => repor(app));

for (const regra of ['dom', 'caminho']) {
  const quem = regra === 'dom' ? 'com o label do Chrome 143 (o Samsung Internet 30)' : 'com o label do Chromium de agora';
  describe('escolher ao toque fecha o menu de uma vez, ' + quem, () => {
    test('o tipo do produto da hipoteca: o menu fecha, o botão diz que fechou, e o label não clica no botão', () => {
      montar(linhaDoProduto());
      const id = 'l_ptipo_p1';
      tocar(app.document.getElementById('lab_' + id), regra);
      igual(menu(id), [true, 'true'], 'o toque no botão abre o menu');
      cliques.length = 0;
      const ev = tocar(spanDaOpcao(id, 'Cartão de crédito'), regra);
      igual(menu(id), [false, 'false'], 'depois da escolha, o menu está fechado');
      igual(cliques, ['SPAN'], 'só o click do dedo: o label não passou nenhum ao botão do sel()');
      assert.equal(ev.defaultPrevented, true, 'a escolha não tem ação por omissão');
      igual(app.document.getElementById(id).value, 'cartao_credito', 'o valor fica no input');
      igual(app.document.getElementById('lab_' + id).textContent, 'Cartão de crédito', 'e no botão');
      igual(mudou, 1, 'o onchange corre uma vez');
      assert.equal(d.doc.activeElement, null, 'e o foco não foi parar ao botão');
    });

    test('o indexante, e um sel() fora da hipoteca (o estado civil da ficha), também', () => {
      montar('<label>Indexante' + app.sel('l_index_h1', '3m', ['3m', '6m', '12m'].map((x) => ({ v: x, label: 'Euribor ' + x })), 'liveLoanAll', 'rascunho') + '</label>'
        + '<label>Estado civil' + app.sel('pe_marital', '', app.MARITAL.map((x) => ({ v: x, label: x || '—' })), '', 'rascunho') + '</label>');
      for (const [id, rotulo, valor] of [['l_index_h1', 'Euribor 6m', '6m'], ['pe_marital', 'Casado(a)', 'Casado(a)']]) {
        tocar(app.document.getElementById('selb_' + id), regra);
        igual(menu(id), [true, 'true'], id + ': abre');
        tocar(spanDaOpcao(id, rotulo), regra);
        igual(menu(id), [false, 'false'], id + ': fecha de uma vez');
        igual([app.document.getElementById(id).value, app.document.getElementById('lab_' + id).textContent], [valor, rotulo], id + ': o valor escolhido fica');
      }
    });

    test('o visto segue a escolha nos mesmos botões, e voltar a abrir mostra a escolhida', () => {
      montar(linhaDoProduto());
      const id = 'l_ptipo_p1', pop = app.document.getElementById('pop_' + id);
      const antes = pop.querySelectorAll('.selopt');
      tocar(app.document.getElementById('selb_' + id), regra);
      tocar(spanDaOpcao(id, 'Ordenado domiciliado'), regra);
      const opts = pop.querySelectorAll('.selopt');
      assert.ok(opts.every((o, j) => o === antes[j]), 'os botões das opções são os mesmos');
      const escolhida = (f) => opts.filter(f).map((o) => o.textContent.trim());
      igual(escolhida((o) => o.classList.contains('on')), ['Ordenado domiciliado'], 'o on');
      igual(escolhida((o) => o.getAttribute('aria-selected') === 'true'), ['Ordenado domiciliado'], 'o aria-selected');
      igual(escolhida((o) => !!o.querySelector('svg')), ['Ordenado domiciliado'], 'o visto');
      tocar(app.document.getElementById('selb_' + id), regra);
      igual(menu(id), [true, 'true'], 'reabre ao toque seguinte no botão');
    });

    test('pelo teclado (Enter numa opção, click com detail 0): fecha e o foco volta ao botão', () => {
      montar(linhaDoProduto());
      const id = 'l_ptipo_p1';
      clicar(app.document.getElementById('selb_' + id), { detail: 0 }, regra);
      igual(menu(id), [true, 'true']);
      const opt = spanDaOpcao(id, 'Débitos diretos domiciliados').pai;
      clicar(opt, { detail: 0 }, regra);
      igual(menu(id), [false, 'false']);
      assert.equal(d.doc.activeElement, app.document.getElementById('selb_' + id), 'o foco está no botão do sel()');
      igual(app.document.getElementById(id).value, 'debitos');
    });

    test('o rótulo continua a abrir o menu: tocar no texto do label passa o clique ao botão do sel()', () => {
      montar('<label>Indexante' + app.sel('l_index_h1', '3m', ['3m', '6m'].map((x) => ({ v: x, label: 'Euribor ' + x })), 'liveLoanAll', 'rascunho') + '</label>');
      const rot = app.document.querySelector('label');
      const ev = tocar(rot, regra);
      igual(menu('l_index_h1'), [true, 'true'], 'o label clicou no botão, e o menu abriu');
      assert.equal(ev.defaultPrevented, false);
    });
  });
}
