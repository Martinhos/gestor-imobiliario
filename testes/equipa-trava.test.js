// A página do back office trancada por baixo da janela (KAN-96): com o
// dialog#dialogo aberto — a janela do guião (formulario) ou a do kanban
// (kbJanela, centrada ou folha de baixo) —, a página não rola, nem ao dedo,
// nem à roda, nem ao teclado, e ao fechar fica onde estava. Quem tranca é o
// travarPagina do guião (worker/src/equipa-guiao.js), como o lockPage da app:
// o html.eq-trava (overflow:hidden) e o body em position:fixed com o top a
// -scrollY, e ao soltar o scrollTo de volta. Corre o guião servido numa
// página de faz-de-conta e o do kanban na caixa dos testes dele; o gesto a
// sério prova-se no browser, no servidor isolado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { paginaEquipa, CSS_EQUIPA } from '../worker/src/equipa-vista.js';
import { recursoDePagina } from '../worker/src/paginas-recursos.js';
import { caixa } from './lib/kanban-caixa.js';
import { MASTER } from './lib/equipa.js';

const assentar = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };

/* Um elemento de faz-de-conta com as classes, o estilo e o que o dialog usa.
   Recebe: id.
   Devolve: o elemento. */
function elemento(id) {
  const classes = new Set();
  const e = {
    id, innerHTML: '', className: '', value: '', textContent: '', open: false, onclose: null, returnValue: '', style: { setProperty() {}, removeProperty() {} },
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle() {} },
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null, focus() {},
    showModal() { e.open = true; }, close() { e.open = false; if (e.onclose) e.onclose(); },
    querySelector: () => null, querySelectorAll: () => [],
  };
  return e;
}

/* Corre o guião do back office numa página de faz-de-conta, rolada a scrollY.
   Recebe: y — o scrollY da página.
   Devolve: {ctx, html, body, dialogo, rolagens} — rolagens: os scrollTo que se pediram. */
async function guiao(y) {
  const pagina = await new Response(paginaEquipa(MASTER).body).text();
  const dados = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(pagina)[1];
  const els = { 'dados-equipa': { textContent: dados } };
  const pega = (id) => els[id] || (els[id] = elemento(id));
  const rolagens = [];
  const ctx = vm.createContext({
    document: {
      title: '', readyState: 'complete', body: pega('body'), documentElement: pega('html'), getElementById: pega,
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    },
    location: { hash: '', reload() {} }, history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} },
    getComputedStyle: () => ({ position: 'sticky' }), matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}, setTimeout, clearTimeout, console, navigator: {},
    fetch: async () => new Response('{}', { status: 200 }),
    scrollY: y, scrollTo(x, yy) { rolagens.push([x, yy]); },
  });
  ctx.window = ctx;
  vm.runInContext(await (await recursoDePagina('/equipa/guiao.js', 'GET', async () => true)).text(), ctx);
  await assentar();
  // o arranque do guião rola ao cimo da secção: daqui para a frente só contam os do travão
  rolagens.length = 0;
  return { ctx, html: pega('html'), body: pega('body'), dialogo: pega('dialogo'), rolagens };
}

describe('o travão da página (o guião)', () => {
  test('travarPagina: tranca com o top a -scrollY e solta com o scrollTo de volta; repetir não muda nada', async () => {
    const g = await guiao(240);
    g.ctx.travarPagina(true);
    assert.equal(g.html.classList.contains('eq-trava'), true);
    assert.equal(g.body.style.top, '-240px');
    // trancada, o browser já não deixa a página rolar: um segundo trancar não guarda o 0 por cima dos 240
    g.ctx.scrollY = 0;
    g.ctx.travarPagina(true);
    assert.equal(g.body.style.top, '-240px');
    g.ctx.travarPagina(false);
    assert.equal(g.html.classList.contains('eq-trava'), false);
    assert.equal(g.body.style.top, '');
    assert.deepEqual(g.rolagens, [[0, 240]], 'volta onde estava, uma vez');
    g.ctx.travarPagina(false);
    assert.deepEqual(g.rolagens, [[0, 240]], 'soltar o que não está trancado não rola');
  });

  test('a janela do guião (formulario): abrir tranca, fechar solta e devolve a página ao sítio', async () => {
    const g = await guiao(120);
    g.ctx.formulario('Motivo', [{ nome: 'motivo', rotulo: 'Motivo' }], () => Promise.resolve());
    assert.equal(g.dialogo.open, true);
    assert.equal(g.html.classList.contains('eq-trava'), true, 'aberta, a página tranca');
    assert.equal(g.body.style.top, '-120px');
    g.dialogo.close();
    assert.equal(g.html.classList.contains('eq-trava'), false, 'fechada, solta');
    assert.deepEqual(g.rolagens, [[0, 120]]);
  });

  test('uma janela aberta no lugar de outra (o close chega depois, com ela aberta) não solta a página', async () => {
    const g = await guiao(80);
    g.ctx.formulario('Um', [{ nome: 'a', rotulo: 'A' }], () => Promise.resolve());
    const fecho = g.dialogo.onclose;
    g.ctx.formulario('Dois', [{ nome: 'b', rotulo: 'B' }], () => Promise.resolve());
    fecho();
    assert.equal(g.html.classList.contains('eq-trava'), true);
    assert.deepEqual(g.rolagens, []);
  });

  test('o CSS: o html.eq-trava não rola e o body fica preso, sem overflow:hidden no body (recortava a página rolada)', () => {
    const css = CSS_EQUIPA.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(css, /html\.eq-trava\{overflow:hidden\}/);
    const corpo = /html\.eq-trava body\{([^}]*)\}/.exec(css);
    assert.ok(corpo, 'a regra do body trancado');
    assert.match(corpo[1], /position:fixed/);
    assert.match(corpo[1], /left:0/);
    assert.match(corpo[1], /right:0/);
    assert.doesNotMatch(corpo[1], /overflow/);
  });
});

describe('o travão nas janelas do kanban', () => {
  /* A caixa do kanban com um dialog de mentira e o travão espiado.
     Devolve: {ctx, d, travoes}. */
  function comDialogo() {
    const ctx = caixa(), d = elemento('dialogo'), travoes = [];
    d.addEventListener = () => {};
    d.removeEventListener = () => {};
    ctx.el = (id) => (id === 'dialogo' ? d : null);
    ctx.setTimeout = setTimeout;
    ctx.clearTimeout = clearTimeout;
    ctx.travarPagina = (sim) => travoes.push(sim);
    return { ctx, d, travoes };
  }

  test('o kbJanela tranca ao abrir e solta quando a janela fecha (por qualquer caminho)', () => {
    const { ctx, d, travoes } = comDialogo();
    ctx.kbJanela('Ordenar «A fazer»', '<p>x</p>');
    assert.equal(d.open, true);
    assert.deepEqual(travoes, [true]);
    d.close();
    assert.deepEqual(travoes, [true, false]);
  });

  test('trocar o conteúdo no sítio (o ⋯ para o Editar) continua trancado: não solta pelo meio', () => {
    const { ctx, d, travoes } = comDialogo();
    ctx.kbJanela('Um', '<p>1</p>');
    ctx.kbJanela('Dois', '<p>2</p>');
    assert.equal(d.open, true);
    assert.equal(travoes.includes(false), false);
  });

  test('a saída animada (kbJanelaSai) só solta quando o dialog fecha de facto', async () => {
    const { ctx, d, travoes } = comDialogo();
    ctx.kbJanela('Um', '<p>1</p>');
    ctx.kbJanelaSai();
    assert.deepEqual(travoes, [true], 'a sair, ainda trancada');
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(d.open, false);
    assert.deepEqual(travoes, [true, false]);
  });
});
