// As fotos a carregar mostram um anel que roda (componentes.js:anelEnquanto):
// - numa caixa de miniatura (paintThumbs) o anel só entra se a espera passar
//   de 150 ms — a que está em memória, ou chega logo do aparelho, não pisca;
// - sai quando a miniatura chega (e entra o <img>) e quando falha (fica o
//   fundo de sempre); a caixa diz aria-busy só enquanto ele roda;
// - cada caixa ouve só a espera mais recente;
// - o carrossel abre logo, sem esperar pela foto inteira: cada lugar mostra a
//   miniatura por baixo e o anel por cima até a inteira chegar; uma que não
//   existe diz-o no palco, sem anel;
// - o anel é CSS: a roda da casa (tokens, tamanho fixo, fora do fluxo) e
//   parado com movimento reduzido.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';
import { camadaFalsa } from './lib/dom.js';

const app = carregarApp();
afterEach(() => repor(app));
afterEach(() => { for (const k of Object.keys(app.thumbCache)) delete app.thumbCache[k]; app.modalStack.length = 0; });

const espera = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const CSS = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const BLOCO = CSS.slice(CSS.indexOf('/* === fotos a carregar (folha 1.3) === */'), CSS.indexOf('/* === fim: fotos a carregar (folha 1.3) === */'));
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* Um elemento com classes e atributos observáveis.
   Devolve: o elemento, com .cls (as classes) e .at (os atributos). */
function elFalso(extra = {}) {
  const cls = new Set(), at = {};
  const el = {
    cls, at,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    setAttribute: (k, v) => { at[k] = String(v); },
    getAttribute: (k) => (k in at ? at[k] : null),
    removeAttribute: (k) => { delete at[k]; if (k === 'src') delete el.src; },
  };
  return Object.assign(el, extra);
}

/* Uma caixa th_<id> como o paintThumbs a encontra, e a raiz onde a procura.
   Devolve: {caixa, raiz}. */
function caixaDe(id) {
  const caixa = elFalso({
    innerHTML: '',
    querySelector: () => null,
    insertAdjacentHTML(onde, h) { this.innerHTML = h + this.innerHTML; },
  });
  return { caixa, raiz: { querySelector: (q) => (q === '[id="th_' + id + '"]' ? caixa : null) } };
}

/* Uma promessa que o teste cumpre quando quiser.
   Devolve: {p, cumpre, falha}. */
function adiada() {
  let cumpre, falha;
  const p = new Promise((a, b) => { cumpre = a; falha = b; });
  return { p, cumpre, falha };
}

function urlsFalsos() {
  app.URL = { createObjectURL: (b) => 'blob:' + b.etiqueta, revokeObjectURL() {} };
}

describe('o anel nas caixas das miniaturas', () => {
  beforeEach(() => { limpar(app); urlsFalsos(); });

  test('uma miniatura que demora: o anel entra depois de 150 ms e sai quando ela chega', async () => {
    const tn = adiada();
    app.idbGet = (k) => (k === 'tn_A1' ? tn.p : Promise.resolve(undefined));
    const { caixa, raiz } = caixaDe('A1');
    app.paintThumbs([{ id: 'A1' }], raiz);
    await espera(60);
    assert.ok(!caixa.cls.has('a-carregar'), 'antes do limiar, nada');
    await espera(160);
    assert.ok(caixa.cls.has('a-carregar'), 'passado o limiar, o anel');
    assert.equal(caixa.at['aria-busy'], 'true');
    tn.cumpre({ etiqueta: 'mini-A1', size: 1 });
    await espera(5);
    assert.ok(!caixa.cls.has('a-carregar'), 'chegou: o anel sai');
    assert.ok(!('aria-busy' in caixa.at));
    assert.match(caixa.innerHTML, /<img src="blob:mini-A1"/);
  });

  test('a que está em memória, ou chega logo do aparelho, não pisca', async () => {
    app.thumbCache.B1 = 'blob:mini-B1';
    app.idbGet = (k) => (k === 'tn_B2' ? Promise.resolve({ etiqueta: 'mini-B2', size: 1 }) : Promise.resolve(undefined));
    const um = caixaDe('B1'), dois = caixaDe('B2');
    const pintadas = [];
    for (const c of [um.caixa, dois.caixa]) {
      const add = c.classList.add;
      c.classList.add = (k) => { if (k === 'a-carregar') pintadas.push(k); add(k); };
    }
    app.paintThumbs([{ id: 'B1' }], um.raiz);
    app.paintThumbs([{ id: 'B2' }], dois.raiz);
    await espera(220);
    assert.equal(pintadas.length, 0, 'nenhuma das duas ganhou a classe, nem por um instante');
    assert.match(um.caixa.innerHTML, /blob:mini-B1/);
    assert.match(dois.caixa.innerHTML, /blob:mini-B2/);
  });

  test('uma miniatura que falha: o anel sai e fica o fundo de sempre', async () => {
    const tn = adiada();
    app.idbGet = (k) => (k === 'tn_C1' ? tn.p : Promise.resolve(undefined));
    const { caixa, raiz } = caixaDe('C1');
    app.paintThumbs([{ id: 'C1' }], raiz);
    await espera(200);
    assert.ok(caixa.cls.has('a-carregar'));
    tn.falha(new Error('sem rede'));
    await espera(5);
    assert.ok(!caixa.cls.has('a-carregar'), 'falhou: o anel sai');
    assert.ok(!('aria-busy' in caixa.at));
    assert.equal(caixa.innerHTML, '', 'sem <img>: o marcador');
  });

  test('sem nada em lado nenhum (null) o anel também sai', async () => {
    const tn = adiada();
    app.idbGet = (k) => (k === 'tn_C2' ? tn.p : Promise.resolve(undefined));
    const { caixa, raiz } = caixaDe('C2');
    app.paintThumbs([{ id: 'C2' }], raiz);
    await espera(200);
    tn.cumpre(undefined);
    await espera(5);
    assert.ok(!caixa.cls.has('a-carregar'));
    assert.equal(caixa.innerHTML, '');
  });

  test('um repinte a meio da espera: a caixa nova ganha o anel logo, sem o apagar', async () => {
    const tn = adiada();
    app.idbGet = (k) => (k === 'tn_D1' ? tn.p : Promise.resolve(undefined));
    const antes = caixaDe('D1');
    app.paintThumbs([{ id: 'D1' }], antes.raiz);
    await espera(200);
    assert.ok(antes.caixa.cls.has('a-carregar'));
    const nova = caixaDe('D1');
    app.paintThumbs([{ id: 'D1' }], nova.raiz);
    assert.ok(nova.caixa.cls.has('a-carregar'), 'o limiar já passou: o anel entra no mesmo instante');
    tn.cumpre({ etiqueta: 'mini-D1', size: 1 });
    await espera(5);
    assert.ok(!nova.caixa.cls.has('a-carregar') && !antes.caixa.cls.has('a-carregar'));
    assert.match(nova.caixa.innerHTML, /blob:mini-D1/);
    // uma espera nova pela mesma foto volta a contar do zero
    delete app.thumbCache.D1;
    const outra = adiada();
    app.idbGet = (k) => (k === 'tn_D1' ? outra.p : Promise.resolve(undefined));
    const terceira = caixaDe('D1');
    app.paintThumbs([{ id: 'D1' }], terceira.raiz);
    assert.ok(!terceira.caixa.cls.has('a-carregar'), 'antes do limiar, nada');
    outra.cumpre(undefined);
    await espera(5);
  });

  test('cada caixa ouve só a espera mais recente', async () => {
    const velha = adiada(), nova = adiada();
    const el = elFalso();
    app.anelEnquanto(el, velha.p);
    app.anelEnquanto(el, nova.p);
    await espera(200);
    assert.ok(el.cls.has('a-carregar'));
    velha.cumpre('x');
    await espera(5);
    assert.ok(el.cls.has('a-carregar'), 'a de antes acabou, mas a de agora ainda roda');
    nova.cumpre('y');
    await espera(5);
    assert.ok(!el.cls.has('a-carregar'));
    // e sem classList (as caixas de brincar de outros testes) não rebenta
    const p = Promise.resolve(1);
    assert.equal(app.anelEnquanto({}, p), p);
  });
});

describe('o anel no carrossel', () => {
  /* Um imóvel com três fotos e o palco do carrossel com os três lugares; as
     fotos inteiras chegam quando o teste quiser.
     Devolve: {abertas, lugar(cl), inteiras}. */
  function cenario() {
    limpar(app);
    urlsFalsos();
    const foto = (id) => ({ id, name: id + '.jpg', type: 'image/jpeg', size: 2048, added: '2026-10-25' });
    app.db.properties.push({ id: 'P1', name: 'T2 Lisboa', photos: [foto('F1'), foto('F2'), foto('F3')] });
    const inteiras = { F1: adiada(), F2: adiada(), F3: adiada() };
    app.idbGet = (k) => (inteiras[k] ? inteiras[k].p : Promise.resolve(undefined));
    // a miniatura da F2 já está em memória; a da F3 chega do aparelho; a da F1 não há
    app.thumbCache.F2 = 'blob:mini-F2';
    app.thumbSrc = (id) => Promise.resolve(id === 'F3' ? 'blob:mini-F3' : null);
    const lugares = ['fc-ant', 'fc-cur', 'fc-seg'].map((cl) => {
      const img = elFalso();
      const s = elFalso({ querySelector: (q) => (q === 'img' ? img : null), img });
      s.cls.add(cl);
      return s;
    });
    const palco = { querySelector: (q) => (q === '.fc-fita' ? null : lugares.find((s) => s.cls.has(q.slice(1))) || null) };
    const abertas = [];
    app.openModal = (t, b, f) => {
      const L = camadaFalsa();
      const doEl = L.el.querySelector;
      L.el.querySelector = (q) => (q === '.fc-palco' ? palco : doEl(q));
      L.t = t; L.b = b; L.f = f;
      app.modalStack.push(L); abertas.push(L);
      return L;
    };
    const lugar = (cl) => lugares.find((s) => s.cls.has(cl));
    return { abertas, lugar, inteiras };
  }

  test('abre logo, sem esperar pela foto inteira, com a miniatura por baixo e o anel por cima', async () => {
    const { abertas, lugar, inteiras } = cenario();
    app.openMeta('F1');
    assert.equal(abertas.length, 1, 'a janela abre no toque, antes de a foto chegar');
    const cur = lugar('fc-cur'), seg = lugar('fc-seg'), ant = lugar('fc-ant');
    assert.equal(seg.img.src, 'blob:mini-F2', 'a miniatura em memória entra já');
    await espera(5);
    assert.equal(ant.img.src, 'blob:mini-F3', 'a que vem do aparelho entra quando chega');
    assert.equal(cur.img.src, undefined, 'sem miniatura, o palco de sempre');
    assert.ok(!cur.cls.has('a-carregar'), 'antes do limiar, sem anel');
    await espera(200);
    for (const s of [cur, seg, ant]) {
      assert.ok(s.cls.has('a-carregar'), 'o anel em cada lugar à espera');
      assert.equal(s.at['aria-busy'], 'true');
    }
    inteiras.F1.cumpre({ etiqueta: 'F1' });
    await espera(5);
    assert.equal(cur.img.src, 'blob:F1', 'a inteira toma o lugar da miniatura');
    assert.ok(!cur.cls.has('a-carregar'), 'e o anel sai');
    assert.ok(!('aria-busy' in cur.at));
    assert.ok(seg.cls.has('a-carregar'), 'as outras continuam à espera');
  });

  test('uma foto que não está em lado nenhum: o anel sai e o palco diz que falta', async () => {
    const { lugar, inteiras } = cenario();
    app.openMeta('F1');
    await espera(200);
    const seg = lugar('fc-seg');
    assert.ok(seg.cls.has('a-carregar'));
    inteiras.F2.cumpre(null);
    await espera(5);
    assert.ok(!seg.cls.has('a-carregar'));
    assert.ok(seg.cls.has('fc-sem'), '«Esta foto não está neste aparelho.»');
  });

  test('uma foto que já está no aparelho entra sem anel', async () => {
    const { lugar, inteiras } = cenario();
    for (const k of Object.keys(inteiras)) inteiras[k].cumpre({ etiqueta: k });
    const marcas = [];
    app.openMeta('F2');
    for (const cl of ['fc-ant', 'fc-cur', 'fc-seg']) {
      const s = lugar(cl), add = s.classList.add;
      s.classList.add = (k) => { if (k === 'a-carregar') marcas.push(cl); add(k); };
    }
    await espera(220);
    assert.deepEqual(marcas, []);
    assert.equal(lugar('fc-cur').img.src, 'blob:F2');
    assert.equal(lugar('fc-cur').img.at['data-inteira'], '1');
  });
});

describe('a folha de estilo do anel', () => {
  test('é a roda da casa: tokens, tamanho fixo, fora do fluxo', () => {
    const b = semComentarios(BLOCO);
    assert.ok(b.length > 100, 'o bloco existe');
    const regra = (b.match(/\.a-carregar::after\{[^}]*\}/) || [''])[0];
    assert.match(regra, /position:absolute/);
    assert.match(regra, /width:22px;height:22px/);
    assert.match(regra, /border:2\.5px solid var\(--line2\)/);
    assert.match(regra, /border-top-color:var\(--accent\)/, 'o arco pela cor da frente');
    assert.match(regra, /animation:roda var\(--volta\) linear infinite,veuEntra var\(--rapido\) var\(--curva\)/);
    assert.match(regra, /pointer-events:none/);
    assert.doesNotMatch(b, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'nenhuma cor fora dos tokens');
    assert.doesNotMatch(b, /:hover/);
    assert.match(CSS, /@keyframes roda\{to\{transform:rotate\(1turn\)\}\}/);
    assert.match(CSS, /@keyframes veuEntra\{from\{opacity:0\}\}/);
  });

  test('com movimento reduzido não roda', () => {
    const b = semComentarios(BLOCO);
    assert.match(b, /@media\(prefers-reduced-motion:reduce\)\{\.a-carregar::after\{animation:none\}\}/);
    // e a regra geral da casa também o apanha
    assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important/);
  });
});
