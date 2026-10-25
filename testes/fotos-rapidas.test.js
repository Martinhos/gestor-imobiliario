// Renomear e reordenar fotos no telemóvel é imediato:
// - a miniatura em memória é a de 220px (makeThumb), nunca o original da
//   câmara; até ela chegar a caixa fica com o marcador; um pedido a caminho
//   serve quem pedir a mesma foto, e fazem-se no máximo duas de cada vez;
// - o arrasto das fotos ouve o pointermove num sítio só (corre uma vez por
//   movimento); largar troca a linha e limpa os transforms com a transição
//   desligada, a largada assenta de onde o dedo a deixou, e só os nomes das
//   fotos se leem do formulário (sem as contas das hipotecas);
// - o foco num campo à vista não rola nem põe a folga do teclado; um campo
//   tapado vem para a vista de uma vez, e a folga só entra se for precisa;
// - o touchmove não-passivo da janela só existe quando a folha se pode
//   agarrar pelo corpo (com a barra e o corpo no topo).
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, igual } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
afterEach(() => { for (const k of Object.keys(app.thumbCache)) delete app.thumbCache[k]; });

const espera = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const lerWeb = (f) => readFileSync(new URL('../web/' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/* Os object URLs dizem de que blob vieram: blob:<etiqueta>. */
function urlsFalsos() {
  const feitos = [];
  app.URL = { createObjectURL: (b) => { const u = 'blob:' + b.etiqueta; feitos.push(u); return u; }, revokeObjectURL() {} };
  return feitos;
}
const original = (etiqueta, size = 4 * 1048576) => ({ etiqueta, size, type: 'image/jpeg', name: etiqueta + '.jpg' });

describe('a miniatura em memória', () => {
  beforeEach(() => limpar(app));

  test('o takeFiles nunca guarda o original: a miniatura em memória é a do makeThumb', async () => {
    urlsFalsos();
    const guardadas = [];
    const guardar = app.guardarMiniatura;
    app.guardarMiniatura = (id, url) => { guardadas.push(url); return guardar(id, url); };
    app.idbPut = () => Promise.resolve();
    app.makeThumb = (b) => Promise.resolve({ etiqueta: 'mini-' + b.etiqueta, size: 9000 });
    const ms = await app.takeFiles({ files: [original('IMG_1'), original('IMG_2')], value: 'x' });
    assert.equal(ms.length, 2);
    await espera(5);
    igual(guardadas.sort(), ['blob:mini-IMG_1', 'blob:mini-IMG_2']);
    assert.ok(Object.values(app.thumbCache).every((u) => /^blob:mini-/.test(u)), 'o thumbCache só tem miniaturas');
  });

  test('a miniatura pedida a meio é a mesma: o repinte logo a seguir ao takeFiles não faz outra', async () => {
    urlsFalsos();
    let feitas = 0, solta;
    app.idbPut = () => Promise.resolve();
    app.idbGet = () => Promise.resolve(undefined);
    app.makeThumb = (b) => { feitas++; return new Promise((r) => { solta = () => r({ etiqueta: 'mini-' + b.etiqueta, size: 1 }); }); };
    const a = app.fazerMiniatura('F1', original('IMG_1'));
    const b = app.thumbSrc('F1');
    await espera();
    solta();
    assert.equal(await a, 'blob:mini-IMG_1');
    assert.equal(await b, 'blob:mini-IMG_1');
    assert.equal(feitas, 1, 'um makeThumb só');
  });

  test('até a miniatura chegar a caixa fica com o marcador (sem <img>), depois entra a pequena', async () => {
    urlsFalsos();
    let solta;
    app.idbPut = () => Promise.resolve();
    app.makeThumb = (b) => new Promise((r) => { solta = () => r({ etiqueta: 'mini-' + b.etiqueta, size: 1 }); });
    app.fazerMiniatura('F1', original('IMG_1'));
    const caixa = { innerHTML: '', querySelector: () => null, insertAdjacentHTML(onde, h) { this.innerHTML = h + this.innerHTML; } };
    app.paintThumbs([{ id: 'F1' }], { querySelector: (q) => (q === '[id="th_F1"]' ? caixa : null) });
    await espera();
    assert.equal(caixa.innerHTML, '', 'o marcador: a caixa vazia, com o fundo dela');
    solta();
    await espera(5);
    assert.match(caixa.innerHTML, /<img src="blob:mini-IMG_1"/);
  });

  test('dez fotos escolhidas juntas: no máximo duas miniaturas a fazer ao mesmo tempo', async () => {
    urlsFalsos();
    let agora = 0, maximo = 0;
    app.idbPut = () => Promise.resolve();
    app.makeThumb = (b) => { agora++; maximo = Math.max(maximo, agora); return espera(3).then(() => { agora--; return { etiqueta: 'mini-' + b.etiqueta, size: 1 }; }); };
    const todas = Array.from({ length: 10 }, (_, i) => app.fazerMiniatura('G' + i, original('IMG_' + i)));
    const urls = await Promise.all(todas);
    assert.equal(maximo, app.MINIATURAS_A_PAR);
    assert.equal(app.MINIATURAS_A_PAR, 2);
    assert.ok(urls.every((u, i) => u === 'blob:mini-IMG_' + i));
  });

  test('sem miniatura possível, o original só entra se for leve; um pesado deixa o marcador', async () => {
    urlsFalsos();
    app.idbPut = () => Promise.resolve();
    app.makeThumb = () => Promise.reject(new Error('não é imagem legível'));
    assert.equal(await app.fazerMiniatura('S1', original('planta.svg', 30000)), 'blob:planta.svg');
    assert.equal(await app.fazerMiniatura('S2', original('IMG_9', 6 * 1048576)), null);
    assert.equal(app.thumbCache.S2, undefined);
  });
});

/* Uma lista de fotos a fingir o DOM que o arrasto lê: cada linha a 60px da
   anterior, com o transform somado ao topo, a etiqueta da capa na primeira,
   e o insertBefore a mudar a ordem. As animações ficam registadas. */
function listaDeFotos(n) {
  const classes = () => { const s = new Set(); return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c) }; };
  const list = { classList: classes(), filhos: [], limpasComPousar: [], offsetHeight: 600 };
  const rows = Array.from({ length: n }, (_, i) => {
    const row = { id: 'F' + i, classList: classes(), capa: i === 0, animacoes: [] };
    let tf = '';
    row.style = {};
    Object.defineProperty(row.style, 'transform', {
      get: () => tf,
      set: (v) => { if (v === '' && tf !== '') list.limpasComPousar.push(list.classList.contains('pousar')); tf = v; },
    });
    Object.defineProperty(row, 'parentNode', { get: () => list });
    Object.defineProperty(row, 'offsetTop', { get: () => 100 + list.filhos.indexOf(row) * 60 });
    Object.defineProperty(row, 'nextSibling', { get: () => list.filhos[list.filhos.indexOf(row) + 1] || null });
    row.getBoundingClientRect = () => { const m = /translateY\((-?[\d.]+)px\)/.exec(tf); return { top: row.offsetTop + (m ? Number(m[1]) : 0) }; };
    row.closest = () => row;
    row.animate = (k, o) => { const an = { k, o, cancel() { this.cancelada = true; if (this.oncancel) this.oncancel(); } }; row.animacoes.push(an); return an; };
    return row;
  });
  list.filhos = rows.slice();
  list.querySelectorAll = (q) => (q === '.prow' ? list.filhos.slice() : q === '.capa' ? list.filhos.filter((r) => r.capa).map((r) => ({ remove() { r.capa = false; } })) : []);
  list.querySelector = (q) => (q === '.prow .pth' && list.filhos[0] ? { insertAdjacentHTML() { list.filhos[0].capa = true; } } : null);
  list.insertBefore = (no, ref) => { list.filhos.splice(list.filhos.indexOf(no), 1); if (ref) list.filhos.splice(list.filhos.indexOf(ref), 0, no); else list.filhos.push(no); };
  return { list, rows };
}

describe('o arrasto das fotos', () => {
  let ouvintes, L;
  beforeEach(() => {
    limpar(app);
    ouvintes = [];
    app.document.addEventListener = (t, f) => ouvintes.push([t, f]);
    app.document.removeEventListener = (t, f) => { ouvintes = ouvintes.filter(([a, b]) => !(a === t && b === f)); };
    app.matchMedia = () => ({ matches: false });
    L = listaDeFotos(4);
    app.pForm = app.normProp({ id: 'p1', name: 'T2', photos: L.rows.map((r) => ({ id: r.id, name: r.id, type: 'image/jpeg' })) });
  });
  const ev = (y, id = 7) => ({ clientY: y, pointerId: id, preventDefault() {}, stopPropagation() {} });
  const pega = (row) => ({ closest: () => row, setPointerCapture() {} });
  const dispara = (tipo, e) => ouvintes.filter(([t]) => t === tipo).forEach(([, f]) => f(e));

  test('o move ouve-se num sítio só: um pointermove corre-o uma vez', () => {
    let chamadas = 0;
    const move = app.photoDragMove;
    app.photoDragMove = (e) => { chamadas++; return move(e); };
    const h = pega(L.rows[0]);
    app.photoDrag(ev(130), h, 0);
    assert.equal(h.onpointermove, undefined, 'o puxador já não tem o seu próprio onpointermove');
    assert.equal(ouvintes.filter(([t]) => t === 'pointermove').length, 1);
    dispara('pointermove', ev(150));
    assert.equal(chamadas, 1);
    assert.equal(L.rows[0].style.transform, 'translateY(20px)');
    dispara('pointerup', ev(150));
    assert.equal(ouvintes.length, 0, 'largar tira os ouvintes todos');
  });

  test('largar troca a linha e limpa os transforms com a transição desligada; ninguém salta', () => {
    app.photoDrag(ev(130), pega(L.rows[0]), 0);
    // o dedo pára a 1,7 passos: a linha cai no 3.º lugar
    dispara('pointermove', ev(130 + 102));
    const antes = Object.fromEntries(L.rows.map((r) => [r.id, r.getBoundingClientRect().top]));
    dispara('pointerup', ev(232));
    igual(app.pForm.photos.map((f) => f.id), ['F1', 'F2', 'F0', 'F3']);
    igual(L.list.filhos.map((r) => r.id), ['F1', 'F2', 'F0', 'F3']);
    assert.ok(L.list.limpasComPousar.length >= 3 && L.list.limpasComPousar.every(Boolean), 'cada transform limpou-se com o .pousar na lista');
    assert.equal(L.list.classList.contains('pousar'), false, 'e a transição volta no fim');
    for (const r of L.rows) if (r.id !== 'F0') assert.equal(r.getBoundingClientRect().top, antes[r.id], r.id + ' fica onde estava');
    assert.ok(L.rows[0].capa === false && L.rows[1].capa === true, 'a capa passa para a nova 1.ª');
  });

  test('a largada assenta de onde o dedo a deixou (--rapido, --curva-entra) e só no fim perde o .drag', () => {
    app.photoDrag(ev(130), pega(L.rows[0]), 0);
    dispara('pointermove', ev(232));
    dispara('pointerup', ev(232));
    const [an] = L.rows[0].animacoes;
    assert.ok(an, 'anima');
    // estava a 102px do sítio velho, e o lugar novo fica a 120: parte 18px acima
    igual(an.k, [{ transform: 'translateY(-18px)' }, { transform: 'none' }]);
    assert.equal(an.o.duration, 120);
    assert.equal(an.o.easing, 'cubic-bezier(0,0,.2,1)');
    assert.ok(L.rows[0].classList.contains('drag'), 'com a sombra enquanto pousa');
    an.onfinish();
    assert.equal(L.rows[0].classList.contains('drag'), false);
  });

  test('um dedo novo a meio do assentar apanha a linha no sítio; sem movimento pousa logo', () => {
    app.photoDrag(ev(130), pega(L.rows[0]), 0);
    dispara('pointermove', ev(232));
    dispara('pointerup', ev(232));
    const an = L.rows[0].animacoes[0];
    app.photoDrag(ev(250), pega(L.rows[0]), 2);
    assert.ok(an.cancelada, 'o assentar de antes acabou');
    dispara('pointerup', ev(250));
    app.matchMedia = (q) => ({ matches: /reduce/.test(q) });
    const n = L.rows[1].animacoes.length;
    app.photoDrag(ev(100), pega(L.rows[1]), 0);
    dispara('pointermove', ev(170));
    dispara('pointerup', ev(170));
    assert.equal(L.rows[1].animacoes.length, n, 'sem movimento não anima');
    assert.equal(L.rows[1].classList.contains('drag'), false);
  });

  test('largar só lê os nomes das fotos: nem o collectProp nem as contas das hipotecas', () => {
    let contas = 0;
    app.collectProp = () => { contas++; };
    app.saldoEmDivida = () => { contas++; return 0; };
    app.document.getElementById = (id) => (id === 'fn_F2' ? { value: 'Cozinha' } : null);
    app.photoDrag(ev(130), pega(L.rows[0]), 0);
    dispara('pointermove', ev(250));
    dispara('pointerup', ev(250));
    assert.equal(contas, 0);
    assert.equal(app.pForm.photos.find((f) => f.id === 'F2').name, 'Cozinha', 'o nome escrito vai com a foto');
  });
});

describe('o foco num campo e o teclado', () => {
  beforeEach(() => limpar(app));
  /* Um campo dentro do corpo de uma janela: o corpo vai de 100 a 800 no
     ecrã, rola 1000px, e o campo está à altura `top` (relativa ao ecrã). */
  function campo(top, opcoes = {}) {
    const classes = new Set();
    const sheet = { classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) } };
    const corpo = { scrollTop: opcoes.scrollTop ?? 200, scrollHeight: opcoes.scrollHeight ?? 1700, clientHeight: 700,
      getBoundingClientRect: () => ({ top: 100, bottom: 800 }), contains: () => true };
    sheet.querySelector = (q) => (q === '.body' ? corpo : null);
    const t = { getBoundingClientRect: () => ({ top: top - (corpo.scrollTop - (opcoes.scrollTop ?? 200)), bottom: top + 44 - (corpo.scrollTop - (opcoes.scrollTop ?? 200)) }),
      closest: (q) => (q === '.sheet' ? sheet : null), scrollIntoView() { t.rolou = true; } };
    app.document.activeElement = t;
    return { t, corpo, sheet, kb: () => classes.has('kb') };
  }

  test('um campo à vista não rola nem ganha a folga do teclado', () => {
    app.visualViewport = { offsetTop: 0, height: 844, addEventListener() {}, removeEventListener() {} };
    const c = campo(400);
    assert.equal(app.campoAVista(c.t), false);
    assert.equal(c.corpo.scrollTop, 200);
    assert.equal(c.kb(), false);
  });

  test('tapado pelo teclado: vem para o meio do que se vê, de uma vez, sem a folga se o corpo chega lá', () => {
    app.visualViewport = { offsetTop: 0, height: 450, addEventListener() {}, removeEventListener() {} };
    const c = campo(600);
    assert.equal(app.campoAVista(c.t), true);
    // o que se vê é 100..450: o meio é 275; o campo (600..644) tinha o meio em 622
    assert.equal(c.corpo.scrollTop, 200 + 347);
    assert.equal(c.kb(), false);
    const r = c.t.getBoundingClientRect();
    assert.ok(r.top >= 112 && r.bottom <= 438, 'à vista');
  });

  test('no fundo do formulário, sem para onde rolar, entra a folga .kb', () => {
    app.visualViewport = { offsetTop: 0, height: 450, addEventListener() {}, removeEventListener() {} };
    const c = campo(740, { scrollTop: 1000, scrollHeight: 1700 });
    assert.equal(app.campoAVista(c.t), true);
    assert.equal(c.kb(), true);
  });

  test('um campo que já perdeu o foco não se mexe', () => {
    app.visualViewport = { offsetTop: 0, height: 450, addEventListener() {}, removeEventListener() {} };
    const c = campo(600);
    app.document.activeElement = null;
    assert.equal(app.campoAVista(c.t), false);
    assert.equal(c.corpo.scrollTop, 200);
  });

  test('espera o teclado assentar: o último resize da janela visível é o que conta', async () => {
    const ouv = {};
    const vv = app.visualViewport = { offsetTop: 0, height: 844, addEventListener: (t, f) => { ouv[t] = f; }, removeEventListener: (t) => { delete ouv[t]; } };
    const c = campo(600);
    app.campoAVistaQuandoAssentar(c.t);
    assert.equal(c.corpo.scrollTop, 200, 'no foco, nada se mexe');
    vv.height = 600; ouv.resize();
    vv.height = 450; ouv.resize();
    await espera(120);
    assert.equal(c.corpo.scrollTop, 547, 'depois do teclado assentar, o campo vem para a vista');
    await espera(1300);
    assert.equal(ouv.resize, undefined, 'e o ouvinte sai');
  });

  test('o focusin do arranque já não centra com scroll suave nem põe o .kb a todos os campos', () => {
    const arr = lerWeb('app/arranque.js');
    const foco = arr.slice(arr.indexOf("document.addEventListener('focusin'"), arr.indexOf("document.addEventListener('focusin'") + 300);
    assert.match(foco, /campoAVistaQuandoAssentar\(t\)/);
    assert.doesNotMatch(foco, /smooth|classList\.add\('kb'\)/);
  });
});

describe('o touchmove não-passivo da janela', () => {
  let estreito;
  beforeEach(() => { estreito = true; app.matchMedia = (q) => ({ matches: /520px/.test(q) ? estreito : false }); });
  function modal(scrollTop) {
    const corpo = { scrollTop };
    const m = { regs: [], querySelector: (q) => (q === '.body' ? corpo : null),
      addEventListener(t, f, o) { this.regs.push([t, f, o]); }, removeEventListener(t, f) { this.regs = this.regs.filter(([a, b]) => !(a === t && b === f)); } };
    return { m, corpo };
  }

  test('só com a barra e o corpo no topo; a rolar sai, ao voltar ao topo entra; acima dos 520px nunca', () => {
    const { m, corpo } = modal(0);
    assert.equal(app.folhaOuvirToque(m), true);
    assert.equal(m.regs.length, 1);
    assert.equal(m.regs[0][0], 'touchmove');
    assert.equal(m.regs[0][1], app.folhaToqueMove);
    assert.equal(m.regs[0][2].passive, false);
    app.folhaOuvirToque(m);
    assert.equal(m.regs.length, 1, 'sem mudança, não se volta a ligar');
    corpo.scrollTop = 80;
    assert.equal(app.folhaOuvirToque(m), false);
    assert.equal(m.regs.length, 0, 'com o corpo rolado os toques não esperam por ele');
    corpo.scrollTop = 0;
    app.folhaOuvirToque(m);
    assert.equal(m.regs.length, 1);
    estreito = false;
    const outra = modal(0);
    assert.equal(app.folhaOuvirToque(outra.m), false);
    assert.equal(outra.m.regs.length, 0);
  });

  test('a janela liga-o pelo folhaOuvirToque e reavalia a cada scroll do corpo; a folha não rola por fora do corpo', () => {
    const comp = lerWeb('app/componentes.js');
    const camada = comp.slice(comp.indexOf('function modalLayer('), comp.indexOf('function modalSnap('));
    assert.doesNotMatch(camada, /addEventListener\('touchmove'/, 'o modalLayer já não o liga sempre');
    assert.match(camada, /addEventListener\('scroll',\(\)=>folhaOuvirToque\(m\),\{passive:true\}\)/);
    const css = lerWeb('estilos.css');
    const bloco = css.slice(css.indexOf('/* === fotos rápidas (folha 1.3) === */'), css.indexOf('/* === fim: fotos rápidas (folha 1.3) === */'));
    assert.match(bloco, /@media\(max-width:520px\)\{\.sheet\{touch-action:pinch-zoom\}\}/);
    assert.match(bloco, /\.pousar>\.prow\{transition:none\}/);
  });
});
