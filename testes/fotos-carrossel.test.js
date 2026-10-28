// As fotos de um imóvel em carrossel (anexos.js:fotoCarrossel), e o teclado
// e o aria-expanded dos menus ⋯ (componentes.js:menuEscape, menuExpandido):
// - a volta, o eixo aos 10px e a regra de largar (um quarto, ou um sacudir);
// - só as fotos de um imóvel abrem em carrossel, pela ordem dele (ou do
//   formulário); os outros anexos de imagem abrem como sempre;
// - o «3 de 8», o título, as setas, o arrasto e o teclado passam de foto;
// - fechar a janela solta os object URLs;
// - o Escape com um menu ⋯ aberto fecha o menu e não a janela por baixo;
// - o botão do menu diz aria-expanded ao abrir e ao fechar.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp();
afterEach(() => repor(app));

const CSS = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const SECCAO = CSS.slice(CSS.indexOf('/* ===== ajustes-v40d: 1.2'), CSS.indexOf('/* ===== fim: ajustes-v40d 1.2 ===== */'));

const foto = (id, name, type = 'image/png') => ({ id, name, type, size: 2048, added: '2026-10-20' });
const espera = () => new Promise((r) => setTimeout(r, 0));

/* Um imóvel com três fotos (e um PDF pelo meio, que não entra), um contrato
   com uma imagem anexada, e um imóvel com uma foto só. Os blobs vêm de um
   idbGet de brincar, e as janelas são a pilha observável do arnês.
   Devolve: as janelas abertas. */
function cenario() {
  limpar(app);
  app.db.properties.push({ id: 'P1', name: 'T2 Lisboa', photos: [foto('F1', 'sala.png'), foto('D1', 'planta.pdf', 'application/pdf'), foto('F2', ''), foto('F3', 'quarto.png')] });
  app.db.properties.push({ id: 'P2', name: 'Loja', photos: [foto('G1', 'montra.png')] });
  app.db.contracts.push({ id: 'C1', files: [foto('K1', 'cc.png')] });
  app.idbGet = () => Promise.resolve(new Blob(['x'], { type: 'image/png' }));
  return janelasFalsas(app, 'toast', 'render', 'save');
}
/* Abre a foto fid como a galeria abre (componentes.js:openMeta) e espera o blob.
   Devolve: a janela de cima. */
async function abrirFoto(fid, doFormulario) {
  app.openMeta(fid, doFormulario);
  await espera();
  return app.modalStack[app.modalStack.length - 1];
}
const pos = (L) => L.el.querySelector('.fc-pos').textContent;

describe('as contas do gesto', () => {
  test('a volta: depois da última vem a primeira, e antes da primeira a última', () => {
    assert.equal(app.fotoVolta(2, 1, 3), 0);
    assert.equal(app.fotoVolta(0, -1, 3), 2);
    assert.equal(app.fotoVolta(1, 1, 3), 2);
    assert.equal(app.fotoVolta(0, -1, 2), 1);
    assert.equal(app.fotoVolta(0, 1, 0), 0, 'uma fila vazia não rebenta');
  });

  test('o eixo decide-se aos 10px; o vertical é do corpo da janela', () => {
    assert.equal(app.fotoEixo(9, 2), '');
    assert.equal(app.fotoEixo(-10, 3), 'x');
    assert.equal(app.fotoEixo(5, 12), 'y');
    assert.equal(app.fotoEixo(11, 11), 'y', 'num empate depois dos 10px, ganha a página');
  });

  test('largar vira depois de um quarto da largura, ou com um sacudir para o mesmo lado', () => {
    assert.equal(app.fotoDecide(-80, 300, 0), 1, 'para a esquerda, a seguinte');
    assert.equal(app.fotoDecide(80, 300, 0), -1, 'para a direita, a anterior');
    assert.equal(app.fotoDecide(-60, 300, 0), 0, 'antes de um quarto volta ao sítio');
    assert.equal(app.fotoDecide(-40, 300, -0.6), 1, 'um sacudir curto passa');
    assert.equal(app.fotoDecide(-40, 300, 0.6), 0, 'um sacudir para o outro lado não');
    assert.equal(app.fotoDecide(-25, 300, -1), 0, 'menos de 30px nunca é sacudir');
  });
});

describe('que fotos entram', () => {
  test('as de um imóvel, só as imagens e pela ordem dele; um anexo de contrato não', () => {
    cenario();
    const f = app.fotosDoImovel('F2');
    igual(f.lista.map((x) => x.id), ['F1', 'F2', 'F3']);
    assert.equal(f.nome, 'T2 Lisboa');
    assert.equal(app.fotosDoImovel('K1'), null);
  });

  test('vindo do formulário, a ordem e as fotos por gravar do formulário', () => {
    cenario();
    app.pForm = { name: 'T2 Lisboa', photos: [foto('F3', 'quarto.png'), foto('N1', 'nova.png'), foto('F1', 'sala.png')] };
    igual(app.fotosDoImovel('F1', true).lista.map((x) => x.id), ['F3', 'N1', 'F1']);
    igual(app.fotosDoImovel('F1').lista.map((x) => x.id), ['F1', 'F2', 'F3'], 'da galeria, a do imóvel gravado');
    igual(app.fotosDoImovel('N1').lista.map((x) => x.id), ['F3', 'N1', 'F1'], 'uma foto só do formulário encontra-se lá');
  });
});

describe('a janela do carrossel', () => {
  test('uma foto de um imóvel abre em carrossel no lugar dela, com setas e «2 de 3»', async () => {
    const abertas = cenario();
    const L = await abrirFoto('F2');
    assert.equal(abertas.length, 1);
    assert.match(L.b, /class="fc-palco"[^>]*data-pointerdown="fotoArrastar\(event,this\)"/);
    assert.match(L.b, /aria-roledescription="carrossel" aria-label="Fotos de T2 Lisboa"/);
    assert.match(L.b, /aria-label="Foto anterior" data-click="fotoPassar\(-1\)"/);
    assert.match(L.b, /aria-label="Foto seguinte" data-click="fotoPassar\(1\)"/);
    assert.match(L.b, /class="fc-pos" aria-live="polite"/);
    assert.match(L.b, /draggable="false"/);
    assert.match(L.f, /data-click="fotoDescarregar\(\)"/);
    assert.equal(pos(L), '2 de 3');
    assert.equal(L.el.querySelector('.head h2').textContent, 'Foto 2', 'sem nome, «Foto 2»');
    assert.ok(L.fotos && L.fotos.lista.length === 3);
  });

  test('os outros anexos de imagem, e um imóvel com uma foto só, abrem como sempre', async () => {
    const abertas = cenario();
    await abrirFoto('K1');
    await abrirFoto('G1');
    assert.equal(abertas.length, 2);
    abertas.forEach((L) => {
      assert.ok(!/fc-palco/.test(L.b), 'sem carrossel');
      assert.match(L.b, /<img src="blob:/);
      assert.match(L.f, /downloadMeta\(/);
    });
  });

  test('as setas e o teclado passam de foto, com volta, e mudam o título', async () => {
    cenario();
    const L = await abrirFoto('F3');
    app.fotoPassar(1);
    assert.equal(pos(L), '1 de 3');
    assert.equal(L.el.querySelector('.head h2').textContent, 'sala.png');
    app.fotoPassar(-1);
    assert.equal(pos(L), '3 de 3');
    const tecla = (key, extra = {}) => { let parou = false; app.fotoTecla({ key, target: { tagName: 'DIV' }, preventDefault() { parou = true; }, ...extra }); return parou; };
    assert.ok(tecla('ArrowRight'));
    assert.equal(pos(L), '1 de 3');
    assert.ok(tecla('ArrowLeft'));
    assert.equal(pos(L), '3 de 3');
    assert.ok(!tecla('ArrowLeft', { target: { tagName: 'INPUT' } }), 'num campo de texto, a seta é do campo');
    assert.ok(!tecla('ArrowLeft', { ctrlKey: true }), 'com uma tecla de modo, não');
    assert.equal(pos(L), '3 de 3');
  });

  test('o arrasto: curto volta ao sítio, um quarto passa, o vertical não é connosco', async () => {
    cenario();
    const L = await abrirFoto('F1');
    const fita = { style: {} };
    const classes = new Set();
    const palco = {
      querySelector: (s) => (s === '.fc-fita' ? fita : null),
      getBoundingClientRect: () => ({ width: 300 }),
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    };
    const doEl = L.el.querySelector;
    L.el.querySelector = (s) => (s === '.fc-palco' ? palco : doEl(s));
    const gesto = (x0, pontos) => {
      app.fotoArrastar({ button: 0, pointerId: 7, clientX: x0, clientY: 100 }, palco);
      for (const [x, y] of pontos) app.fotoArrastoMove({ pointerId: 7, clientX: x, clientY: y });
      app.fotoArrastoFim({ type: 'pointerup', pointerId: 7 });
    };
    /* 25px para a esquerda: a folga dos 10px não conta, e a fita vai colada ao
       dedo; abaixo dos 30px nem um sacudir rápido passa, seja qual for o relógio */
    app.fotoArrastar({ button: 0, pointerId: 7, clientX: 200, clientY: 100 }, palco);
    app.fotoArrastoMove({ pointerId: 7, clientX: 175, clientY: 101 });
    assert.equal(fita.style.transform, 'translateX(-15px)');
    assert.ok(classes.has('arrasta'));
    app.fotoArrastoFim({ type: 'pointerup', pointerId: 7 });
    assert.equal(pos(L), '1 de 3', 'menos de um quarto volta ao sítio');
    assert.ok(!classes.has('arrasta'));
    gesto(250, [[200, 100], [150, 100], [100, 100]]);
    assert.equal(pos(L), '2 de 3', 'mais de um quarto passa à seguinte');
    gesto(100, [[103, 140], [250, 140]]);
    assert.equal(pos(L), '2 de 3', 'um gesto que começou na vertical não passa');
    gesto(100, [[150, 100], [250, 100]]);
    assert.equal(pos(L), '1 de 3', 'para a direita, a anterior');
    gesto(100, [[150, 100], [250, 100]]);
    assert.equal(pos(L), '3 de 3', 'e da primeira para trás, a última');
    app.fotoArrastar({ button: 0, pointerId: 7, clientX: 250, clientY: 100 }, palco);
    app.fotoArrastoMove({ pointerId: 7, clientX: 50, clientY: 100 });
    app.fotoArrastoFim({ type: 'pointercancel', pointerId: 7 });
    assert.equal(pos(L), '3 de 3', 'um pointercancel nunca vira');
  });

  test('fechar a janela solta os object URLs e o carrossel deixa de responder', async () => {
    cenario();
    const L = await abrirFoto('F1');
    await espera();
    const urls = Object.values(L.fotos.urls);
    assert.ok(urls.length >= 1 && urls.every((u) => /^blob:/.test(u)));
    const soltos = [];
    const revogar = URL.revokeObjectURL;
    URL.revokeObjectURL = (u) => { soltos.push(u); };
    try { L.aoFechar(); } finally { URL.revokeObjectURL = revogar; }
    igual(soltos.sort(), urls.sort());
    assert.equal(app.fotoAtual(), null);
  });
});

describe('a folha de estilo do carrossel', () => {
  test('o palco deixa o vertical ao browser, tem altura em dvh e a folga num token', () => {
    assert.ok(SECCAO.length > 200, 'a secção existe');
    assert.match(SECCAO, /\.fc-palco\{--fc-folga:\d+px;[^}]*touch-action:pan-y/);
    assert.match(SECCAO, /max-height:60vh;max-height:60dvh/);
    assert.match(SECCAO, /\.fc-slide\.fc-seg\{transform:translateX\(calc\(100% \+ var\(--fc-folga\)\)\)\}/);
  });

  test('as setas têm 44px, o hover só com rato, e no dedo ficam só para o leitor de ecrã', () => {
    assert.match(SECCAO, /\.fc-seta\{[^}]*width:44px;height:44px/);
    assert.match(SECCAO, /@media\(hover:hover\) and \(pointer:fine\)\{\.fc-seta:hover/);
    assert.ok(!/(^|\})\s*\.fc-seta:hover/.test(SECCAO.replace(/\/\*[\s\S]*?\*\//g, '')), 'nenhum :hover fora do @media');
    assert.match(SECCAO, /@media\(hover:none\),\(pointer:coarse\)\{\.fc-seta:not\(:focus-visible\)\{[^}]*clip-path:inset\(50%\)/);
    assert.match(SECCAO, /transition:transform var\(--rapido\) var\(--curva\)/, 'o premido com os tokens da casa');
  });
});

describe('os menus ⋯', () => {
  /* Um menu ⋯ e o botão dele, num .menuwrap de brincar. */
  function menuFalso() {
    const attrs = {};
    const btn = { focado: false, setAttribute: (k, v) => { attrs[k] = v; }, focus() { btn.focado = true; } };
    const wrap = { querySelector: (s) => (s === '[data-click^="menuOpen("]' ? btn : null) };
    const cls = new Set();
    const p = {
      id: 'menu_x', parentNode: wrap, contains: () => false,
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => (c === 'menupop' ? true : cls.has(c)) },
    };
    app.document.getElementById = (id) => (id === 'menu_x' ? p : null);
    app.document.querySelectorAll = (s) => (/menupop\.on/.test(s) && cls.has('on') ? [p] : []);
    app.ajustarPop = () => {};
    return { p, btn, attrs, cls };
  }

  test('o botão diz aria-expanded: false no HTML, true ao abrir e false ao fechar', () => {
    assert.match(app.menu('x', [{ label: 'Editar', act: 'f()' }]), /data-click="menuOpen\(event,'x'\)" aria-label="Opções" aria-expanded="false"/);
    const m = menuFalso();
    app.menuOpen(null, 'x');
    assert.ok(m.cls.has('on'));
    assert.equal(m.attrs['aria-expanded'], 'true');
    app.closePops();
    assert.ok(!m.cls.has('on'));
    assert.equal(m.attrs['aria-expanded'], 'false');
    app.menuOpen(null, 'x');
    app.menuOpen(null, 'x');
    assert.equal(m.attrs['aria-expanded'], 'false', 'tocar outra vez no ⋯ fecha, e diz que fechou');
  });

  test('o Escape com um menu aberto fecha o menu, devolve o foco ao botão e não chega à janela', () => {
    const m = menuFalso();
    let parou = false;
    const ev = { key: 'Escape', target: { closest: () => null }, preventDefault() { parou = true; } };
    assert.equal(app.selTecla(ev), false, 'sem menu aberto, o Escape segue para a janela');
    app.menuOpen(null, 'x');
    assert.equal(app.selTecla(ev), true, 'com o menu aberto, o Escape fica no menu');
    assert.ok(parou && !m.cls.has('on') && m.btn.focado);
    assert.equal(m.attrs['aria-expanded'], 'false');
    assert.equal(app.selTecla({ key: 'Enter', target: { closest: () => null } }), false, 'as outras teclas seguem');
  });
});
