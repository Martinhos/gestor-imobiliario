// O nome de uma foto vê-se inteiro e o arrasto leva a foto para fora da vista:
// - o nome é uma caixa de texto de uma linha que quebra a linha (até três),
//   com o placeholder e o aria-label de sempre; o Enter não abre uma linha
//   nova (acaba a escrita) e o que se cola com quebras fica com espaços;
// - a arrastar uma foto, perto do topo ou do fundo da área que rola ela rola
//   sozinha, mais depressa quanto mais perto; a foto fica debaixo do dedo e o
//   lugar de destino conta com o que rolou; pára fora da zona, no fim do que
//   há para rolar e ao largar.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));

describe('o nome da foto', () => {
  beforeEach(() => limpar(app));

  test('é uma caixa de texto de uma linha, com o placeholder e o aria-label de sempre', () => {
    const html = app.fileBlock('Fotos', [{ id: 'F1', name: 'IMG_20261025_093415_HDR.jpg', size: 10 }], 'pf', 'x', 'y', { photos: true, move: 1 });
    assert.match(html, /<textarea class="pnm" id="fn_F1" rows="1" placeholder="Ex: Sala de estar" aria-label="Nome da fotografia \(opcional\)"[^>]*enterkeyhint="done"[^>]*>IMG_20261025_093415_HDR\.jpg<\/textarea>/);
    assert.doesNotMatch(html, /<input class="pnm"/);
    assert.doesNotMatch(html, / style=| on[a-z]+=/);
  });

  test('o Enter não abre uma linha nova: acaba a escrita', () => {
    let travou = 0, saiu = 0;
    app.fotoNomeTecla({ key: 'Enter', preventDefault() { travou++; }, target: { blur() { saiu++; } } });
    assert.equal(travou, 1);
    assert.equal(saiu, 1);
  });

  test('as outras teclas, e o Enter a meio de uma composição, seguem', () => {
    let travou = 0;
    app.fotoNomeTecla({ key: 'a', preventDefault() { travou++; }, target: {} });
    app.fotoNomeTecla({ key: 'Enter', isComposing: true, preventDefault() { travou++; }, target: {} });
    assert.equal(travou, 0);
  });

  test('o que se cola com quebras fica com espaços, o cursor no sítio, e o nome guarda-se', () => {
    app.pForm = { photos: [{ id: 'F1', name: '' }] };
    let cursor = null;
    const el = { value: 'Quarto\n\ngrande  \r\n com varanda', selectionEnd: 7, setSelectionRange(a) { cursor = a; } };
    app.fotoNomeEscrito('F1', el);
    assert.equal(el.value, 'Quarto grande com varanda');
    assert.equal(app.pForm.photos[0].name, 'Quarto grande com varanda');
    assert.equal(cursor, 7);
  });

  test('um nome sem quebras não se mexe', () => {
    app.pForm = { photos: [{ id: 'F1', name: '' }] };
    let mexeu = false;
    const el = { value: 'Sala', selectionEnd: 4, setSelectionRange() { mexeu = true; } };
    app.fotoNomeEscrito('F1', el);
    assert.equal(el.value, 'Sala');
    assert.equal(mexeu, false);
    assert.equal(app.pForm.photos[0].name, 'Sala');
  });
});

/* Doze fotos a fingir o DOM que o arrasto lê, a 60px umas das outras, e a
   área que rola (o corpo da janela, de 0 a 800px, com 1200px para rolar). */
function cenario(n = 12) {
  const classes = () => { const s = new Set(); return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c) }; };
  const list = { classList: classes(), filhos: [], offsetHeight: n * 60 };
  const rows = Array.from({ length: n }, (_, i) => {
    const row = { id: 'F' + i, classList: classes(), style: { transform: '' } };
    Object.defineProperty(row, 'parentNode', { get: () => list });
    Object.defineProperty(row, 'offsetTop', { get: () => list.filhos.indexOf(row) * 60 });
    Object.defineProperty(row, 'nextSibling', { get: () => list.filhos[list.filhos.indexOf(row) + 1] || null });
    row.getBoundingClientRect = () => ({ top: row.offsetTop });
    row.closest = () => row;
    row.animate = () => ({ cancel() {} });
    return row;
  });
  list.filhos = rows.slice();
  list.querySelectorAll = (q) => (q === '.prow' ? list.filhos.slice() : []);
  list.querySelector = () => null;
  list.insertBefore = (no, ref) => { list.filhos.splice(list.filhos.indexOf(no), 1); if (ref) list.filhos.splice(list.filhos.indexOf(ref), 0, no); else list.filhos.push(no); };
  const rol = { scrollTop: 0, max: 1200, getBoundingClientRect: () => ({ top: 0, bottom: 800 }) };
  Object.defineProperty(rol, 'scrollTop', { get() { return this._s || 0; }, set(v) { this._s = Math.max(0, Math.min(this.max, v)); }, configurable: true });
  return { list, rows, rol };
}

describe('o arrasto das fotos rola a janela', () => {
  let C, ouvintes, quadros, cancelados;
  beforeEach(() => {
    limpar(app);
    ouvintes = []; quadros = []; cancelados = [];
    app.document.addEventListener = (t, f) => ouvintes.push([t, f]);
    app.document.removeEventListener = (t, f) => { ouvintes = ouvintes.filter(([a, b]) => !(a === t && b === f)); };
    app.matchMedia = () => ({ matches: false });
    app.requestAnimationFrame = (f) => { quadros.push(f); return quadros.length; };
    app.cancelAnimationFrame = (id) => cancelados.push(id);
    C = cenario();
    app.photoRolante = () => C.rol;
    app.innerHeight = 800;
    app.pForm = app.normProp({ id: 'p1', name: 'T2', photos: C.rows.map((r) => ({ id: r.id, name: r.id, type: 'image/jpeg' })) });
  });
  // um arrasto que um teste deixou a meio não passa para o seguinte
  afterEach(() => { const pd = app._pd; if (pd && pd.largar) pd.largar(); });
  const ev = (y) => ({ clientY: y, pointerId: 3, preventDefault() {}, stopPropagation() {} });
  const pega = (row) => ({ closest: () => row, setPointerCapture() {} });
  const dispara = (tipo, e) => ouvintes.filter(([t]) => t === tipo).forEach(([, f]) => f(e));
  // corre os quadros pedidos até não haver mais (ou até n)
  const correr = (n = 200) => { let k = 0; while (quadros.length && k++ < n) quadros.shift()(); return k; };

  test('perto do fundo rola para baixo, e a foto fica debaixo do dedo', () => {
    app.photoDrag(ev(30), pega(C.rows[0]), 0);
    dispara('pointermove', ev(790));
    assert.equal(quadros.length, 1, 'pediu um quadro de rolagem');
    quadros.shift()();
    const rolou = C.rol.scrollTop;
    assert.ok(rolou > 0 && rolou <= 18, 'rolou um passo (' + rolou + 'px)');
    assert.equal(C.rows[0].style.transform, 'translateY(' + (790 - 30 + rolou) + 'px)');
  });

  test('quanto mais perto da borda, mais depressa (até 18px por quadro)', () => {
    app.photoDrag(ev(30), pega(C.rows[0]), 0);
    dispara('pointermove', ev(760));
    quadros.shift()();
    const devagar = C.rol.scrollTop;
    C.rol.scrollTop = 0;
    dispara('pointermove', ev(799));
    quadros.shift()();
    assert.ok(C.rol.scrollTop > devagar, devagar + ' < ' + C.rol.scrollTop);
    assert.ok(C.rol.scrollTop <= 18);
  });

  test('perto do topo rola para cima', () => {
    C.rol.scrollTop = 600;
    app.photoDrag(ev(400), pega(C.rows[11]), 11);
    dispara('pointermove', ev(5));
    quadros.shift()();
    assert.ok(C.rol.scrollTop < 600);
  });

  test('fora da zona não rola, e voltar à zona do meio pára a rolagem', () => {
    app.photoDrag(ev(30), pega(C.rows[0]), 0);
    dispara('pointermove', ev(400));
    assert.equal(quadros.length, 0);
    dispara('pointermove', ev(790));
    quadros.shift()();
    const antes = C.rol.scrollTop;
    dispara('pointermove', ev(400));
    correr();
    assert.equal(C.rol.scrollTop, antes, 'não rolou mais');
  });

  test('pára no fim do que há para rolar', () => {
    app.photoDrag(ev(30), pega(C.rows[0]), 0);
    dispara('pointermove', ev(799));
    const passos = correr(500);
    assert.equal(C.rol.scrollTop, 1200);
    assert.ok(passos < 500, 'acabou sozinha (' + passos + ' quadros)');
    assert.equal(quadros.length, 0);
  });

  test('o lugar de destino conta com o que rolou: levada ao fundo, a 1.ª foto fica em último', () => {
    app.photoDrag(ev(30), pega(C.rows[0]), 0);
    dispara('pointermove', ev(799));
    correr(500);
    dispara('pointerup', ev(799));
    assert.equal(app.pForm.photos[11].id, 'F0');
    assert.equal(app.pForm.photos[0].id, 'F1');
  });

  test('largar a meio da rolagem cancela o quadro pedido e tira os ouvintes', () => {
    app.photoDrag(ev(30), pega(C.rows[0]), 0);
    dispara('pointermove', ev(790));
    assert.equal(quadros.length, 1);
    dispara('pointerup', ev(790));
    assert.deepEqual(cancelados, [1]);
    assert.equal(ouvintes.length, 0);
  });
});
