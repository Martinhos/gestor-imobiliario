// O formulário e a ficha do imóvel, terceira ronda da v40:
// - a caixa que cresce (continuidade.js:crescerEmAltura) encosta as linhas ao
//   topo durante a viagem, guarda o scroll de quem rola, desvanece o que sai
//   no sítio onde estava, desvanece o que chega e faz deslizar o que mudou de
//   sítio — e sem movimento só pinta;
// - o formulário dá chave (data-parte) às peças do primeiro grupo;
// - o realce do segmentado tem 1.5:1 ou mais contra a pista nos dois temas;
// - a capa da ficha com fotos abre a galeria por um botão irmão do «N fotos»;
// - o «Marcar visita» de um quarto livre abre a visita com esse quarto.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp();
afterEach(() => repor(app));

const CSS = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const SECCAO = CSS.slice(CSS.indexOf('/* ===== ajustes-v40c: 1.1'), CSS.indexOf('/* ===== fim: ajustes-v40c 1.1 ===== */'));

/* ---- um DOM de brincar, só com o que o crescerEmAltura usa ---- */
const casa = (e, sel) => (sel === '[data-parte]' ? 'data-parte' in e.attrs
  : sel === '.a-sair' ? e.classes.has('a-sair') : sel === '[id]' ? 'id' in e.attrs : false);
const descendentes = (e) => e.filhos.flatMap((f) => [f, ...descendentes(f)]);
/* Um elemento: atributos, retângulo (top, height, relativos ao ecrã) e filhos.
   Recebe: attrs — os atributos; r — {top, height}; filhos — elementos.
   Devolve: o elemento, que regista as animações em .anims. */
function no(attrs, r, filhos = []) {
  const e = {
    attrs: { ...attrs }, r, filhos: [], parentElement: null, anims: [], style: {}, isConnected: true, classes: new Set(), clientTop: 1, clientLeft: 1,
    classList: { add: (c) => e.classes.add(c), remove: (c) => e.classes.delete(c), contains: (c) => e.classes.has(c) },
    getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null),
    setAttribute: (k, v) => { e.attrs[k] = String(v); },
    removeAttribute: (k) => { delete e.attrs[k]; },
    getBoundingClientRect: () => ({ top: e.r.top, left: 0, width: 300, height: e.r.height || 40, bottom: e.r.top + (e.r.height || 40) }),
    animate: (k, o) => { const a = { k, o, onfinish: null }; e.anims.push(a); return a; },
    appendChild: (c) => { c.parentElement = e; e.filhos.push(c); },
    remove: () => { e.isConnected = false; },
    contains: (x) => { for (let p = x; p; p = p.parentElement) if (p === e) return true; return false; },
    closest: (sel) => { for (let p = e; p; p = p.parentElement) if (casa(p, sel)) return p; return null; },
    querySelectorAll: (sel) => descendentes(e).filter((d) => casa(d, sel)),
    querySelector: (sel) => descendentes(e).find((d) => casa(d, sel)) || null,
  };
  filhos.forEach((f) => e.appendChild(f));
  return e;
}
/* o primeiro grupo do formulário, com ou sem quartos, dentro do corpo que rola */
function grupo(quartos, extra = {}) {
  const partes = [no({ 'data-parte': 'nome' }, { top: 110 }), no({ 'data-parte': 'morada' }, { top: 170 }), no({ 'data-parte': 'seg-setUse' }, { top: 230 })];
  if (quartos) {
    const linhas = quartos.map((k, i) => no({ 'data-parte': k, id: 'p_room_' + k }, { top: 330 + i * 54 }));
    partes.push(no({ 'data-parte': 'quartos' }, { top: 300, height: 30 + quartos.length * 54 }, linhas));
  }
  const g = no({}, { top: 100, height: extra.altura || 300 }, partes);
  g.parentElement = extra.corpo || null;
  return g;
}
/* põe o crescerEmAltura a trocar a caixa a por b (como o repaintProp troca o corpo) */
function trocar(a, b, depois) {
  let atual = a;
  app.crescerEmAltura(() => atual, () => { atual = b; descendentes(a).forEach((f) => { f.isConnected = false; }); if (depois) depois(); });
  return b;
}
const anim = (e, prop) => e.anims.find((x) => prop in x.k[0]);

describe('a caixa que cresce: o que fica fica, o que sai desvanece, o scroll guarda-se', () => {
  test('a encolher (Por quartos → Imóvel inteiro): a altura anima numa caixa encostada ao topo, os quartos desvanecem onde estavam, o resto não se mexe', () => {
    app.semMovimento = () => false;
    const a = grupo(['q-1', 'q-2'], { altura: 450 }), velhos = a.filhos[3];
    const b = trocar(a, grupo(null, { altura: 280 }));
    const h = anim(b, 'height');
    assert.ok(h, 'a altura da caixa anima');
    assert.equal(h.k.map((x) => x.height).join(' → '), '450px → 280px', 'da altura antiga para a nova');
    assert.ok(b.classes.has('a-crescer'), 'durante a viagem as linhas encostam-se ao topo (estilos.css:.a-crescer)');
    assert.equal(b.style.overflow, 'hidden');
    h.onfinish();
    assert.ok(!b.classes.has('a-crescer'), 'e no fim a classe sai');
    // os quartos são o próprio nó antigo, posto de volta dentro da caixa, a desvanecer
    assert.equal(velhos.parentElement, b, 'o que saiu volta para dentro da caixa nova');
    assert.ok(velhos.classes.has('a-sair') && b.classes.has('tem-saidas'));
    assert.equal(velhos.style.position, 'absolute');
    assert.equal(velhos.style.top, (300 - 100 - 1) + 'px', 'no sítio onde estava, medido da caixa (sem o contorno)');
    assert.equal(velhos.style.pointerEvents, 'none');
    assert.equal(velhos.getAttribute('aria-hidden'), 'true');
    assert.ok(velhos.attrs.inert !== undefined, 'inerte: o Tab não lá entra');
    assert.ok(!('id' in velhos.filhos[0].attrs), 'sem ids: o getElementById não o apanha');
    assert.equal(anim(velhos, 'opacity').k.map((x) => x.opacity).join(' → '), '1 → 0');
    assert.ok(anim(velhos, 'opacity').o.duration <= 200, 'some depressa, antes de a caixa acabar');
    assert.ok(!velhos.filhos.some((f) => f.anims.length), 'os quartos de dentro saem com ele, não cada um por si');
    for (const f of b.filhos.filter((x) => !x.classes.has('a-sair'))) assert.equal(f.anims.length, 0, f.attrs['data-parte'] + ' fica parado');
  });

  test('a crescer (Imóvel inteiro → Por quartos): os quartos desvanecem a entrar, as linhas deles vêm com eles', () => {
    app.semMovimento = () => false;
    const b = trocar(grupo(null, { altura: 280 }), grupo(['q-1', 'q-2'], { altura: 450 }));
    const quartos = b.filhos[3];
    assert.equal(anim(quartos, 'opacity').k.map((x) => x.opacity).join(' → '), '0 → 1');
    assert.ok(quartos.filhos.every((f) => !f.anims.length), 'as linhas não desvanecem duas vezes');
    assert.equal(anim(b, 'height').k.map((x) => x.height).join(' → '), '280px → 450px');
  });

  test('remover um quarto: os de baixo sobem a deslizar desde onde estavam, o removido desvanece, a caixa encolhe', () => {
    app.semMovimento = () => false;
    const a = grupo(['q-1', 'q-2', 'q-3'], { altura: 500 }), q2 = a.filhos[3].filhos[1];
    const b = trocar(a, grupo(['q-1', 'q-3'], { altura: 446 }));
    const q3 = b.filhos[3].filhos[1];
    const t = anim(q3, 'transform');
    assert.ok(t, 'o terceiro desliza');
    assert.equal(t.k[0].transform, 'translate(0px,54px)', 'parte de onde estava');
    assert.equal(t.k[1].transform, 'none');
    assert.equal(b.filhos[3].filhos[0].anims.length, 0, 'o primeiro não se mexeu');
    assert.equal(b.filhos[3].anims.length, 0, 'a caixa dos quartos também não');
    assert.ok(q2.classes.has('a-sair') && q2.parentElement === b, 'o segundo desvanece no sítio dele');
  });

  test('o scroll de quem rola guarda-se: repõe-se depois de a animação pôr a altura antiga', () => {
    app.semMovimento = () => false;
    const corpo = Object.assign(no({}, { top: 0, height: 700 }), { scrollTop: 1546, scrollHeight: 3000, clientHeight: 700 });
    app.getComputedStyle = (e) => ({ overflowY: e === corpo ? 'auto' : 'visible', getPropertyValue: () => '' });
    const a = grupo(null, { altura: 300, corpo });
    // o layout com o conteúdo já curto prende o scroll ao fundo novo
    trocar(a, grupo(['q-1'], { altura: 600, corpo }), () => { corpo.scrollTop = 1243; });
    assert.equal(corpo.scrollTop, 1546, 'o scroll volta a ser o de antes');
  });

  test('sem movimento, só pinta: nem altura, nem classe, nem nada a sair', () => {
    app.semMovimento = () => true;
    const a = grupo(['q-1'], { altura: 400 });
    let vezes = 0;
    const b = grupo(null, { altura: 280 });
    app.crescerEmAltura(() => (vezes ? b : a), () => { vezes++; });
    assert.equal(vezes, 1, 'pintou uma vez');
    assert.equal(b.anims.length + b.filhos.reduce((n, f) => n + f.anims.length, 0), 0);
    assert.ok(!b.classes.has('a-crescer') && !b.classes.has('tem-saidas'));
  });

  test('uma peça que continua no documento (a mesma caixa, só mudou por dentro) não é posta a sair', () => {
    app.semMovimento = () => false;
    const g = grupo(['q-1', 'q-2'], { altura: 400 }), q2 = g.filhos[3].filhos[1];
    app.crescerEmAltura(() => g, () => { g.filhos[3].filhos.pop(); q2.parentElement = null; g.r.height = 346; });
    assert.ok(!q2.classes.has('a-sair'), 'continua ligado: não há saída a encenar');
  });
});

describe('o formulário dá chave às peças do primeiro grupo', () => {
  test('o nome, a morada, cada segmentado, os quartos, cada quarto e o «Adicionar quarto» — uma chave cada', () => {
    limpar(app);
    app.pForm = app.normProp({ id: 'p1', name: 'T3', use: 'investimento', rentalMode: 'quartos', rooms: [{ id: 'r1', name: 'Quarto 1' }, { id: 'r2', name: 'Quarto 2' }] });
    let html = app.propBody();
    const chaves = (h) => [...h.matchAll(/data-parte="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(chaves(html), ['nome', 'morada', 'seg-setUse', 'seg-setMode', 'quartos', 'q-r1', 'q-r2', 'q-mais']);
    app.pForm.use = 'proprio';
    html = app.propBody();
    assert.deepEqual(chaves(html), ['nome', 'morada', 'seg-setUse'], 'em uso próprio sai o tipo e os quartos');
    assert.match(html, /<label data-parte="nome">Nome <span class="req">\*<\/span><input id="p_name"/);
  });
});

describe('o foco do teclado sobrevive à repintura do segmentado', () => {
  test('se estava no segmentado, fica na escolha nova (sem rolar); se estava noutro lado, não se mexe', () => {
    limpar(app);
    app.pForm = app.normProp({ id: 'p1', name: 'T3', use: 'investimento', rentalMode: 'inteiro' });
    const focados = [], dentro = {}, botao = { focus: (o) => focados.push(o) };
    const seg = { contains: (x) => x === dentro, querySelector: () => null };
    const doc = app.document;
    doc.getElementById = (id) => (id === 'imv_segm_setMode' ? seg : null);
    doc.querySelector = (s) => (s === '#imv_segm_setMode [aria-checked="true"]' ? botao : null);
    doc.activeElement = dentro;
    app.setMode('quartos');
    assert.equal(app.pForm.rentalMode, 'quartos');
    assert.equal(focados.length, 1, 'o foco volta ao botão aceso');
    assert.equal(focados[0].preventScroll, true);
    doc.activeElement = {};
    app.setMode('inteiro');
    assert.equal(focados.length, 1, 'o foco estava noutro lado: fica lá');
  });
});

describe('o realce do segmentado vê-se nos dois temas', () => {
  /* o valor de um token num bloco (:root ou :root.dark) */
  const token = (bloco, nome) => {
    const i = CSS.indexOf(bloco + '{');
    const m = CSS.slice(i, CSS.indexOf('}', i)).match(new RegExp(nome + ':(#[0-9a-f]{6})'));
    return m[1];
  };
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  test('no escuro o realce é o --line2 sobre a pista, em todos os segmentados, com 1.5:1 ou mais; no claro, o branco com a sombra de sempre', () => {
    assert.match(SECCAO, /:root\.dark \.segm\.desliza>\.segm-polegar,\r?\n:root\.dark \.segm>\.on,[^{]*\{background:var\(--line2\);box-shadow:none\}/);
    assert.match(CSS, /\.segm-polegar\{[^}]*background:var\(--card\);box-shadow:/, 'o realce do claro é o cartão com a sombra');
    assert.doesNotMatch(SECCAO, /\n\.segm\.desliza\{background/, 'a pista do claro é a de todos os segmentados');
    const escuro = contraste(token(':root.dark', '--line2'), token(':root.dark', '--chip'));
    assert.ok(escuro >= 1.5, 'escuro ' + escuro.toFixed(2));
  });

  test('a viagem e as saídas têm as regras delas; o passar por cima da capa só com rato', () => {
    assert.match(SECCAO, /\n\.a-crescer\{align-content:start\}/);
    assert.match(SECCAO, /\n\.tem-saidas\{position:relative\}/);
    assert.match(SECCAO, /@media\(hover:hover\)\{\.imv-capa-abre:hover::after/);
    assert.doesNotMatch(SECCAO.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,6}\b/i, 'cores só por tokens');
    assert.doesNotMatch(SECCAO, /transition:all/);
  });
});

describe('a capa da ficha abre a galeria', () => {
  const foto = () => app.normFile({ id: 'f1', name: 'Sala', type: 'image/jpeg', size: 10 });

  test('com fotos: um botão a cobrir a capa, irmão do «N fotos», fora do Tab e com nome; os dois abrem a galeria', () => {
    limpar(app);
    const p = app.normProp({ id: 'p1', name: 'T2', photos: [foto(), app.normFile({ id: 'f2', name: 'Quarto', type: 'image/jpeg', size: 10 })] });
    const h = app.imvCapaDaFicha(p, true);
    assert.match(h, /<button type="button" class="imv-capa-abre" tabindex="-1" aria-label="Ver as fotos" data-toca="camada" data-click="imvGaleria\('p1'\)"><\/button>/);
    assert.match(h, /<button type="button" class="imv-fotos-btn" data-toca="camada" data-click="imvGaleria\('p1'\)">.*2 fotos<\/button>/s);
    // nenhum botão dentro de outro: cada <button fecha antes do seguinte abrir
    const botoes = h.split('<button').slice(1);
    assert.equal(botoes.length, 2);
    assert.ok(botoes.every((b) => b.includes('</button>')), 'cada botão fecha antes do seguinte');
    assert.ok(h.indexOf('imv-capa-abre') < h.indexOf('imv-fotos-btn'), 'o da capa vem antes: fica por baixo do «N fotos»');
    assert.match(h, /id="th_f1"/, 'a capa continua a receber a primeira foto');
  });

  test('sem fotos, ou sem poder ver os ficheiros, a capa é só o mosaico', () => {
    limpar(app);
    assert.doesNotMatch(app.imvCapaDaFicha(app.normProp({ id: 'p1', name: 'T2' }), true), /<button/);
    assert.doesNotMatch(app.imvCapaDaFicha(app.normProp({ id: 'p1', name: 'T2', photos: [foto()] }), false), /<button/);
  });
});

describe('marcar visita num quarto livre traz esse quarto', () => {
  function semear() {
    limpar(app);
    app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana Silva' }));
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Rui Costa' }));
    app.db.properties.push(app.normProp({ id: 'p2', name: 'T3 Coimbra', ownerIds: ['o1'], use: 'investimento', rentalMode: 'quartos',
      rooms: [{ id: 'q1', name: 'Quarto 1' }, { id: 'q4', name: 'Quarto 4' }, { id: 'q5', name: 'Quarto 5' }] }));
    app.db.contracts.push(app.normContract({ id: 'c1', propertyId: 'p2', roomId: 'q1', rent: 350, tenantIds: ['t1'], start: '2024-01-01' }));
  }

  test('cada quarto livre leva o seu id no «Marcar visita»; o arrendado não tem botão', () => {
    semear();
    const h = app.imvQuartos(app.prop('p2'), true);
    assert.match(h, /data-click="marcarVisitaNoImovel\('p2','q4'\)">Marcar visita/);
    assert.match(h, /data-click="marcarVisitaNoImovel\('p2','q5'\)">Marcar visita/);
    assert.doesNotMatch(h, /marcarVisitaNoImovel\('p2','q1'\)/);
    assert.equal((h.match(/marcarVisitaNoImovel\('p2'\)/g) || []).length, 0, 'nenhum fica com a casa inteira');
  });

  test('o formulário da visita abre com o imóvel e o quarto; sem quarto, como antes', () => {
    semear();
    const abertas = janelasFalsas(app, 'render', 'buildNav', 'save', 'paintThumbs');
    app.marcarVisitaNoImovel('p2', 'q5');
    assert.equal(abertas.at(-1).t, 'Marcar visita');
    assert.equal(app.visForm.propertyId, 'p2');
    assert.equal(app.visForm.roomId, 'q5');
    assert.match(abertas.at(-1).b, /<input type="hidden" id="vi_room" value="q5">/);
    assert.match(abertas.at(-1).b, /<span id="lab_vi_room">Quarto 5<\/span>/);
    app.marcarVisitaNoImovel('p2');
    assert.equal(app.visForm.propertyId, 'p2');
    assert.equal(app.visForm.roomId, '', 'sem quarto, a casa inteira');
  });

  test('o que chega ao serviço das visitas: o imóvel e, havendo, o quarto — nada mais', () => {
    semear();
    const chamadas = [];
    app.chamarServico = (...a) => { chamadas.push(JSON.parse(JSON.stringify(a))); };
    app.marcarVisitaNoImovel('p2', 'q4');
    app.marcarVisitaNoImovel('p2');
    assert.deepEqual(chamadas, [['visits', 'visitModal', null, { propertyId: 'p2', roomId: 'q4' }], ['visits', 'visitModal', null, { propertyId: 'p2' }]]);
  });
});
