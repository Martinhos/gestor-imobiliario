// O carrossel dos separadores de uma área: as abas da área saem da cabeça da
// vista para a casa delas, por cima do #view (navegacao.js:abasAssentar), e
// ficam o MESMO nó de pintura para pintura — só trocam o aceso, os números e
// os destinos —; o realce (o polegar) assenta na aba acesa pela classe e
// segue o dedo em fração de aba (navegacao.js:abasPolegarEm); a meio do
// arrasto o vizinho é pintado uma vez por lado, colado à página que sai
// (navegacao.js:sepVizinho, vistas.js:pintarVistaAParte), e sai com ela no
// regresso; largar acaba a viagem com o realce a chegar com o painel; sem
// movimento nada segue o dedo; de área para área as abas novas entram com o
// conteúdo (continuidade.js:abasNaFita); e o CSS e o index.html da casa.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, elementos } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
afterEach(() => {
  app.sepArrastoLargar();
  app.modalStack.length = 0;
  delete app.window.CW;
});

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');

/* Um elemento mínimo, com o que estas funções usam: classes, atributos (o
   class incluído, como no browser), filhos com pai, os seletores «:scope>…»
   de um nível, o polegar que o insertAdjacentHTML acrescenta, e o estilo. */
function el(tag, classes = [], attrs = {}, texto = '') {
  const n = {
    tagName: tag.toUpperCase(), children: [], parentNode: null, style: {}, innerHTML: texto, ligado: true,
    _a: new Map(Object.entries(attrs)), _c: new Set(classes),
    classList: {
      add: (...c) => c.forEach((x) => n._c.add(x)), remove: (...c) => c.forEach((x) => n._c.delete(x)),
      contains: (c) => n._c.has(c), toggle: (c, f) => ((f === undefined ? !n._c.has(c) : f) ? n._c.add(c) : n._c.delete(c)),
    },
    get className() { return [...n._c].join(' '); },
    set className(v) { n._c = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get firstElementChild() { return n.children[0] || null; },
    get attributes() { return (n._c.size ? [{ name: 'class', value: n.className }] : []).concat([...n._a].map(([name, value]) => ({ name, value }))); },
    getAttribute: (k) => (k === 'class' ? (n._c.size ? n.className : null) : n._a.has(k) ? n._a.get(k) : null),
    setAttribute: (k, v) => { if (k === 'class') n.className = v; else n._a.set(k, String(v)); },
    hasAttribute: (k) => (k === 'class' ? n._c.size > 0 : n._a.has(k)),
    removeAttribute: (k) => { if (k === 'class') n._c.clear(); else n._a.delete(k); },
    get outerHTML() { return '<' + tag + ' ' + n.attributes.map((x) => x.name + '="' + x.value + '"').join(' ') + '>' + n.innerHTML; },
    appendChild: (c) => { c.remove(); c.parentNode = n; n.children.push(c); return c; },
    remove: () => { const p = n.parentNode; if (p) { p.children = p.children.filter((x) => x !== n); n.parentNode = null; } },
    replaceChildren: (...cs) => { n.children.slice().forEach((c) => c.remove()); cs.forEach((c) => n.appendChild(c)); },
    insertAdjacentHTML: (onde, h) => {
      const m = /class="([^"]+)"/.exec(h);
      const p = el('span', m ? m[1].split(' ') : []);
      p.parentNode = n; n.children.unshift(p);
    },
    querySelectorAll: (s) => {
      const m = /^:scope>(.+)$/.exec(s); if (!m) return [];
      const [t, ...cs] = m[1].split('.');
      return n.children.filter((c) => (!t || c.tagName === t.toUpperCase()) && cs.every((x) => c._c.has(x)));
    },
    querySelector: (s) => n.querySelectorAll(s)[0] || null,
    getBoundingClientRect: () => ({ top: 60, left: 0, right: 375, bottom: 812, width: 375, height: 752 }),
  };
  return n;
}
// uma fila de abas como o abasDaArea a escreve, com a acesa em i
function fila(rotulo, nomes, i, destinos) {
  const nav = el('nav', ['segm', 'abas-area'], { 'aria-label': rotulo });
  nomes.forEach((nome, k) => {
    const a = el('a', k === i ? ['on'] : [], Object.assign(k === i ? { 'aria-current': 'page' } : {},
      { role: 'link', tabindex: '0', 'data-click': "go('" + (destinos ? destinos[k] : nome) + "')" }), nome);
    nav.appendChild(a);
  });
  return nav;
}
// o #view com a moldura .abas à cabeça (a fila e, nas Pessoas, o segmentado delas)
function vistaCom(nav, pessoas) {
  const v = el('div', ['wrap'], { id: 'view' });
  const m = el('div', ['abas']);
  if (nav) m.appendChild(nav);
  if (pessoas) m.appendChild(el('nav', ['segm', 'abas-pessoas']));
  v.appendChild(m);
  v.appendChild(el('div', ['card']));
  return v;
}
// o document passa a dar estes elementos pelo id (os outros, os do arnês)
function montar(a, porId) {
  const antes = a.document.getElementById;
  a.document.getElementById = (id) => (id in porId ? porId[id] : antes(id));
}
function emCasas(a, t = 'properties') {
  limpar(a);
  a.tab = t;
  a.separadoresEscondidos = () => [];
}
const CASAS = ['Imóveis', 'Grupos', 'Contratos', 'Pessoas', 'Visitas'];

describe('as abas vão para a casa delas, e ficam o mesmo nó', () => {
  test('a primeira pintura leva a fila para a casa, com o polegar na aba acesa; a moldura fica, vazia', () => {
    emCasas(app);
    const casa = el('div', [], { id: 'abasArea' });
    const nav = fila('Casas', CASAS, 0);
    const v = vistaCom(nav);
    montar(app, { view: v, abasArea: casa });
    app.abasAssentar();
    assert.equal(casa.firstElementChild, nav, 'a fila está na casa');
    const m = v.querySelector(':scope>.abas');
    assert.ok(m && m.children.length === 0, 'e a moldura fica vazia no #view (no computador dá os 14px de sempre)');
    assert.ok(nav.classList.contains('desliza') && nav.classList.contains('n5'), 'segmentado que desliza, de cinco');
    const pol = nav.querySelector(':scope>.segm-polegar');
    assert.ok(pol, 'com o polegar');
    assert.equal(pol.className, 'segm-polegar i0');
  });

  test('nas Pessoas a fila sai e o segmentado delas fica no #view, a correr com o conteúdo', () => {
    emCasas(app, 'tenants');
    const casa = el('div', [], { id: 'abasArea' });
    const v = vistaCom(fila('Casas', CASAS, 3), true);
    montar(app, { view: v, abasArea: casa });
    app.abasAssentar();
    const m = v.querySelector(':scope>.abas');
    assert.ok(m, 'a moldura fica');
    assert.equal(m.querySelectorAll(':scope>.abas-pessoas').length, 1);
    assert.equal(m.querySelectorAll(':scope>.abas-area').length, 0);
  });

  test('a mesma fila na pintura seguinte: fica o nó vivo, e só o aceso, o destino e o número mudam', () => {
    emCasas(app);
    const casa = el('div', [], { id: 'abasArea' });
    const viva = fila('Casas', CASAS, 0);
    montar(app, { view: vistaCom(viva), abasArea: casa });
    app.abasAssentar();
    const pol = viva.querySelector(':scope>.segm-polegar');
    pol.style.transform = 'translateX(calc(0.4 * (100% + 2px)))';   // um arrasto a meio
    app.tab = 'contracts';
    const nova = fila('Casas', ['Imóveis', 'Grupos', 'Contratos <span class="n">2</span>', 'Pessoas', 'Visitas'], 2,
      ['properties', 'groups', 'contracts', 'owners', 'visits']);
    const v2 = vistaCom(nova);
    montar(app, { view: v2, abasArea: casa });
    app.abasAssentar();
    assert.equal(casa.firstElementChild, viva, 'o mesmo nó (o foco do teclado fica onde estava)');
    assert.equal(nova.parentNode, null, 'a fila nova não entra em lado nenhum');
    const as = viva.querySelectorAll(':scope>a');
    assert.equal(as[0].getAttribute('aria-current'), null, 'Imóveis apagou-se');
    assert.ok(!as[0].classList.contains('on'));
    assert.ok(as[2].classList.contains('on') && as[2].getAttribute('aria-current') === 'page', 'Contratos acendeu');
    assert.equal(as[2].innerHTML, 'Contratos <span class="n">2</span>', 'com o número');
    assert.equal(as[3].getAttribute('data-click'), "go('owners')", 'as Pessoas abrem onde se ficou');
    assert.equal(pol.className, 'segm-polegar i2', 'o polegar vai para Contratos');
    assert.equal(pol.style.transform, '', 'e larga o transform do dedo (a transição da folha leva-o)');
  });

  test('outra área troca a fila inteira; fora das áreas a casa esvazia; a meio de uma viagem não se mexe', () => {
    emCasas(app);
    const casa = el('div', [], { id: 'abasArea' });
    const casas = fila('Casas', CASAS, 0);
    montar(app, { view: vistaCom(casas), abasArea: casa });
    app.abasAssentar();
    app.tab = 'transactions';
    const din = fila('Dinheiro', ['Movimentos', 'Planeados', 'Créditos'], 0);
    montar(app, { view: vistaCom(din), abasArea: casa });
    app.abasAssentar();
    assert.equal(casa.firstElementChild, din, 'a fila do Dinheiro');
    assert.ok(din.classList.contains('n3'));
    // um #view sem abas numa área (o painel a meio da fita, ainda sem a vista nova)
    montar(app, { view: el('div', ['wrap'], { id: 'view' }), abasArea: casa });
    app.abasAssentar();
    assert.equal(casa.firstElementChild, din, 'numa área, um #view sem abas não apaga a casa');
    app.tab = 'calendar';
    app.abasAssentar();
    assert.equal(casa.children.length, 0, 'na Agenda a casa fica vazia (o :empty esconde-a)');
  });

  test('o vizinho pintado à parte não toca na casa: as abas dele só saem da vista dele', () => {
    emCasas(app);
    const casa = el('div', [], { id: 'abasArea' });
    const viva = fila('Casas', CASAS, 0);
    montar(app, { view: vistaCom(viva), abasArea: casa });
    app.abasAssentar();
    const dele = vistaCom(fila('Casas', CASAS, 1));
    montar(app, { view: dele, abasArea: casa });
    app._pintarAParte = true;
    app.abasAssentar();
    app._pintarAParte = false;
    assert.equal(casa.firstElementChild, viva);
    assert.ok(viva.querySelectorAll(':scope>a')[0].classList.contains('on'), 'a aba acesa continua a de onde se está');
    assert.equal(dele.querySelector(':scope>.abas').querySelectorAll(':scope>.abas-area').length, 0, 'e a fila do vizinho saiu dele');
  });
});

describe('o polegar', () => {
  test('a meio de um arrasto vai em fração de aba; assente, pela classe; sem aba acesa, escondido', () => {
    const nav = fila('Casas', CASAS, 0);
    nav.insertAdjacentHTML('afterbegin', '<span class="segm-polegar"></span>');
    const pol = nav.querySelector(':scope>.segm-polegar');
    app.abasPolegarEm(nav, 0.3726);
    assert.equal(pol.style.transform, 'translateX(calc(0.373 * (100% + 2px)))');
    app.abasPolegarEm(nav, 2, true);
    assert.equal(pol.className, 'segm-polegar i2');
    app.abasPolegarEm(nav, 4, true);
    assert.equal(pol.className, 'segm-polegar i4', 'a quinta aba, a das Visitas');
    assert.equal(pol.style.transform, '');
    app.abasPolegarEm(nav, -1, true);
    assert.equal(pol.className, 'segm-polegar fora');
  });
});

/* O gesto inteiro, com o #view, as abas e o pintor do vizinho falsos. */
function palco(a) {
  const v = elementos(a).view;
  v.className = 'wrap entra';
  v.getBoundingClientRect = () => ({ top: 110, left: 0, right: 375, bottom: 812, width: 375, height: 702 });
  v.contains = (x) => { for (let y = x; y; y = y.parentElement) if (y === v) return true; return false; };
  v.parentNode = { classList: { add() {}, remove() {} } };
  v.animate = () => ({ set onfinish(f) { f(); } });
  const nav = fila('Casas', CASAS, 2);
  nav.insertAdjacentHTML('afterbegin', '<span class="segm-polegar"></span>');
  a.document.querySelector = (s) => (s === '#abasArea>.abas-area' ? nav : null);
  const criados = [];
  a.document.createElement = (t) => { const n = el(t); n.animate = () => ({}); criados.push(n); return n; };
  const pintados = [];
  a.pintarVistaAParte = (id, caixa) => { pintados.push(id); caixa.innerHTML = 'vista de ' + id; return true; };
  return { v, nav, pol: nav.querySelector(':scope>.segm-polegar'), pintados, criados };
}
const BASE = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
const pousa = (a, x, alvo) => a.sepArrastar(Object.assign({ type: 'pointerdown', clientX: x, clientY: 400, target: alvo }, BASE));
const anda = (a, x) => a.sepArrastoMove(Object.assign({ type: 'pointermove', clientX: x, clientY: 400 }, BASE));
const larga = (a, x, tipo = 'pointerup') => a.sepArrastoFim(Object.assign({ type: tipo, clientX: x, clientY: 400 }, BASE));
const dentro = (v) => ({ parentElement: v, closest: () => null, scrollWidth: 10, clientWidth: 10 });

describe('o arrasto', () => {
  test('o vizinho pinta-se uma vez por lado, colado à página; o polegar segue o dedo sem transição', () => {
    emCasas(app, 'contracts');
    app.matchMedia = (q) => ({ matches: /max-width:900px/.test(q) });
    const { v, nav, pol, pintados } = palco(app);
    app.go = () => {};
    pousa(app, 300, dentro(v));
    [290, 260, 220, 180, 150].forEach((x) => anda(app, x));
    const a = app._sepArrasto;
    assert.deepEqual([...pintados], ['tenants'], 'só o da direita, e uma vez só em cinco movimentos');
    assert.ok(nav.classList.contains('arrasta'), 'a fila larga a transição enquanto o dedo leva o polegar');
    const viz = a.vizP[1];
    assert.ok(viz && /sep-vizinho/.test(viz.className) && /wrap/.test(viz.className) && !/entra/.test(viz.className),
      'a caixa do vizinho tem as classes do #view, menos o entra (' + (viz && viz.className) + ')');
    assert.equal(viz.style.transform, 'translateX(' + (375 + a.desl) + 'px)', 'colado à borda direita da página');
    assert.equal(viz.getAttribute('inert'), '', 'e não se toca nem se lê');
    const p = 2 + Math.abs(a.desl) / 375;
    assert.equal(pol.style.transform, 'translateX(calc(' + Math.round(p * 1000) / 1000 + ' * (100% + 2px)))', 'o polegar entre Contratos e Pessoas');
    // o dedo volta para trás do ponto de partida: o outro vizinho, uma vez
    [260, 320, 360, 380].forEach((x) => anda(app, x));
    assert.deepEqual([...pintados], ['tenants', 'groups'], 'à esquerda dos Contratos, os Grupos');
    [300, 380].forEach((x) => anda(app, x));
    assert.equal(pintados.length, 2, 'voltar a cada lado não pinta outra vez');
    larga(app, 380);
  });

  test('largar cedo: a página e o vizinho voltam juntos, e o polegar volta à aba de partida', () => {
    emCasas(app, 'contracts');
    app.matchMedia = (q) => ({ matches: /max-width:900px/.test(q) });
    const { v, nav, pol } = palco(app);
    const idas = [];
    app.go = (id) => idas.push(id);
    pousa(app, 300, dentro(v));
    [295, 285, 270, 260].forEach((x) => anda(app, x));
    const a = app._sepArrasto;
    const viz = a.vizP[1];
    let anim = null;
    viz.animate = (k, o) => { anim = { k, o }; return {}; };
    larga(app, 260);
    assert.equal(idas.length, 0, 'não virou');
    assert.ok(anim, 'o vizinho anima de volta');
    assert.equal(anim.k[1].transform, 'translateX(375px)', 'para fora, à direita');
    assert.equal(anim.k[0].transform, 'translateX(' + (375 + a.desl) + 'px)', 'a partir de onde estava');
    assert.ok(nav.classList.contains('volta') && !nav.classList.contains('arrasta'), 'o polegar volta com a curva do regresso');
    assert.equal(pol.className, 'segm-polegar i2');
    assert.equal(pol.style.transform, '');
    assert.equal(a.palco, null, 'o palco saiu no fim do regresso');
  });

  test('largar depois de 1/4: o palco sai antes da fita e o polegar chega com o painel', () => {
    emCasas(app, 'contracts');
    app.matchMedia = (q) => ({ matches: /max-width:900px/.test(q) });
    const { v, nav, pol } = palco(app);
    let estado = null;
    app.go = (id) => { estado = { id, palco: !!app._sepArrasto, viaja: nav.classList.contains('viaja'), desde: app._desdeSep }; };
    pousa(app, 300, dentro(v));
    [290, 250, 200, 150, 100].forEach((x) => anda(app, x));
    const a = app._sepArrasto;
    const removido = [];
    a.palco.remove = () => removido.push('palco');
    larga(app, 100);
    assert.equal(estado.id, 'tenants');
    assert.deepEqual(removido, ['palco'], 'o vizinho pintado sai no mesmo instante em que a fita põe o verdadeiro');
    assert.ok(estado.viaja, 'o polegar já está na duração da fita quando a repintura o muda');
    assert.equal(estado.desde, -190);
    assert.equal(pol.style.transform, '', 'e larga o transform do dedo');
  });

  test('sem movimento: nada segue o dedo, não se pinta vizinho nenhum, e o nome espreita à beira', () => {
    emCasas(app, 'contracts');
    app.matchMedia = (q) => ({ matches: /max-width:900px/.test(q) || /reduce/.test(q) });
    const { v, pol, pintados, criados } = palco(app);
    app.go = () => {};
    app.camadaDeSaida = () => ({ appendChild() {} });
    pousa(app, 300, dentro(v));
    [290, 250, 150].forEach((x) => anda(app, x));
    const a = app._sepArrasto;
    assert.equal(a.mexe, false);
    assert.equal(pintados.length, 0, 'sem vizinho pintado');
    assert.ok(!a.palco, 'nem palco');
    assert.equal(v.style.transform || '', '', 'a página fica');
    assert.equal(pol.style.transform || '', '', 'o polegar fica');
    assert.ok(criados.some((n) => n.classList.contains('sep-espreita') && n.classList.contains('on')), 'o nome do vizinho espreita');
    larga(app, 150);
  });
});

describe('o vizinho pintado à parte', () => {
  test('o render de sempre pinta na caixa, com o id do #view emprestado; depois volta tudo, mesmo se rebentar', () => {
    emCasas(app, 'properties');
    const real = el('div', ['wrap'], { id: 'view' });
    real.id = 'view';
    const caixa = el('div', ['wrap', 'sep-vizinho']);
    const titulo = { innerHTML: '', textContent: '' };
    app.document.getElementById = (id) => (id === 'view' ? [real, caixa].find((x) => x.id === 'view') || null
      : id === 'pageTitle' || id === 'pageSub' ? titulo : null);
    real.removeAttribute = (k) => { if (k === 'id') real.id = ''; };
    caixa.removeAttribute = (k) => { if (k === 'id') caixa.id = ''; };
    caixa.querySelectorAll = () => [];
    app._ecraPintado = 'properties|';
    let dentroDoRender = null;
    app.render = () => { dentroDoRender = { tab: app.tab, view: app.view(), aParte: app._pintarAParte, entrar: app._entrar }; };
    assert.equal(app.pintarVistaAParte('contracts', caixa), true);
    assert.equal(dentroDoRender.tab, 'contracts', 'pinta o vizinho');
    assert.equal(dentroDoRender.view, caixa, 'no contentor à parte (o view() é ele)');
    assert.equal(dentroDoRender.aParte, true);
    assert.equal(dentroDoRender.entrar, 0, 'sem entrar em cena');
    assert.equal(app.tab, 'properties', 'e volta ao separador onde se está');
    assert.equal(app.view(), real, 'com o #view de volta');
    assert.equal(app._pintarAParte, false);
    assert.equal(app._ecraPintado, 'properties|', 'o ecrã pintado é o de antes (a continuidade da próxima pintura conta com ele)');
    app.render = () => { throw new Error('rebentou'); };
    assert.equal(app.pintarVistaAParte('contracts', caixa), false);
    assert.equal(app.tab, 'properties');
    assert.equal(app.view(), real);
  });

  test('quem chega pelo dedo não volta a entrar em cena; pela barra de baixo, entra', () => {
    emCasas(app, 'properties');
    app.separadorLigado = () => true;
    let entrar = null;
    app.render = () => { entrar = app._entrar; };
    app.buildNav = () => {};
    app._entrar = 0;
    app.deslizarPainel = (pintar) => pintar();
    app.sepIrPara('contracts', 1, -150);
    assert.equal(entrar, 0, 'o carrossel já o mostrou: os gráficos não se redesenham nem os números contam');
    app.tab = 'properties';
    app._ladoSep = 1;
    app.go('contracts');
    assert.equal(entrar, 1, 'a fita da barra de baixo é uma chegada');
  });
});

describe('a travessia entre áreas', () => {
  test('a mesma fila fica parada; outra fila entra com o conteúdo e a velha sai no sítio dela', () => {
    const casa = el('div', [], { id: 'abasArea' });
    const viva = fila('Casas', CASAS, 0);
    casa.appendChild(viva);
    let animou = null;
    casa.animate = (k) => { animou = k; return {}; };
    assert.equal(app.abasNaFita(casa, viva, { top: 60, left: 0, width: 390, height: 56, bottom: 116 }, 1, 390, 0, 340, 'x'), null);
    assert.equal(animou, null, 'na mesma área as abas não viajam');
    const din = fila('Dinheiro', ['Movimentos', 'Planeados', 'Créditos'], 0);
    viva.remove();
    casa.appendChild(din);
    const criados = [];
    app.document.createElement = (t) => { const n = el(t); n.animate = (k) => { n.anim = k; return {}; }; criados.push(n); return n; };
    app.camadaDeSaida = () => ({ appendChild() {} });
    const cx = app.abasNaFita(casa, viva, { top: 60, left: 0, width: 390, height: 56, bottom: 116 }, 1, 390, 0, 340, 'x');
    assert.ok(cx, 'a caixa de quem sai');
    assert.equal(animou[0].transform, 'translateX(390px)', 'as abas novas entram da direita, com o conteúdo');
    const saida = criados.find((n) => n.className === 'abas-saida');
    assert.ok(saida && saida.children[0] === viva, 'a fila velha sai com o espaçamento da casa');
    assert.equal(saida.anim[1].transform, 'translateX(-390px)');
  });
});

describe('a casa, na página e na folha', () => {
  test('o index.html tem a casa entre o cabeçalho e o #view', () => {
    assert.match(html, /<\/header>[\s\S]*?<div id="abasArea"><\/div>\s*<div class="wrap" id="view"><\/div>/);
  });

  test('o CSS: a casa escondida vazia e no computador, a rolar de lado, a grelha, o polegar por tokens', () => {
    assert.match(css, /#abasArea:empty\{display:none\}/);
    assert.match(css, /@media\(max-width:900px\)\{\.abas:empty\{display:none\}\}/, 'a moldura vazia só se esconde no telemóvel');
    assert.match(css, /@media\(min-width:901px\)\{#abasArea,\.abas>\.abas-area\{display:none\}\}/);
    assert.match(css, /#abasArea\{overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none\}/);
    assert.match(css, /#abasArea>\.segm\.abas-area,\.abas-saida>\.segm\.abas-area\{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;width:max-content;min-width:100%\}/);
    assert.match(css, /\.abas-area\.n3>\.segm-polegar\{width:calc\(\(100% - 12px\) \/ 3\)\}/);
    assert.match(css, /\.abas-area\.n4>\.segm-polegar\{width:calc\(\(100% - 14px\) \/ 4\)\}/);
    assert.match(css, /\.abas-area>\.segm-polegar\.i3\{transform:translateX\(calc\(300% \+ 6px\)\)\}/);
    assert.match(css, /\.abas-area>\.segm-polegar\{transition:transform var\(--medio\) var\(--curva-fita\)\}/);
    assert.match(css, /\.abas-area\.viaja>\.segm-polegar\{transition-duration:var\(--lento\)\}/);
    assert.match(css, /\.abas-area\.volta>\.segm-polegar\{transition-timing-function:var\(--curva-entra\)\}/);
    assert.match(css, /\.abas-area\.arrasta>\.segm-polegar\{transition:none\}/);
    // sem movimento pedido, a regra geral tira-lhe a transição
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important/);
    assert.match(css, /#abasArea:not\(:empty\)~#view/, 'o pan-y passa ao #view por baixo da casa');
    assert.match(css, /\.sep-vizinho\{position:absolute;left:0;box-sizing:border-box;max-width:none;margin:0\}/);
  });

  test('numa área com abas o #view enche até ao fundo do main: uma lista curta ou vazia também vira com o dedo no vazio', () => {
    assert.match(css, /main\{flex:1;min-width:0;display:flex;flex-direction:column\}/, 'o main é flex em coluna');
    assert.match(css, /@media\(max-width:900px\)\{#abasArea:not\(:empty\)~#view\{flex:1 0 auto\}\}/);
  });
});
