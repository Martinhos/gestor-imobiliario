// O arrasto do kanban (worker/src/equipa-kanban-arrasto.js), corrido na caixa do guião
// (testes/lib/kanban-caixa.js) com um DOM a fingir: os vizinhos que dão lugar a
// deslizar (FLIP: o transform inverso e o regresso), o menos movimento (muda de uma
// vez), a borda do telemóvel que passa à coluna do lado (uma de cada vez), e o
// kbOrdemManual (numa coluna com outra ordem o arrasto não reordena).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { caixa } from './lib/kanban-caixa.js';
import { CSS_KANBAN } from '../worker/src/equipa-kanban.js';

/* Um relógio a fingir para o setTimeout da caixa.
   Devolve: {setTimeout, clearTimeout, pendentes, correr(id)}. */
function relogio() {
  let n = 0;
  const pendentes = new Map();
  return {
    pendentes,
    setTimeout: (fn, ms) => { n++; pendentes.set(n, { fn, ms }); return n; },
    clearTimeout: (id) => { pendentes.delete(id); },
    // corre o primeiro que está à espera (o mais antigo)
    correr() { const [id, t] = pendentes.entries().next().value; pendentes.delete(id); t.fn(); return t.ms; },
  };
}
/* Um cartão a fingir: o retângulo vem de uma função (muda antes e depois da
   mudança do DOM) e o style guarda a história do transform.
   Recebe: chave; ret — função que dá {left, top, width, height}.
   Devolve: o nó. */
function cartaoFalso(chave, ret) {
  const classes = new Set(['kb-cartao']);
  const historia = [];
  let transform = '';
  return {
    chave, historia,
    classList: {
      contains: (c) => classes.has(c),
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
    },
    style: {
      get transform() { return transform; },
      set transform(v) { transform = v; historia.push(v); },
    },
    getAttribute: (n) => (n === 'data-chave' ? chave : null),
    getBoundingClientRect: () => ret(),
  };
}
const listaFalsa = (nos, coluna) => ({
  querySelectorAll: () => nos.slice(),
  getAttribute: (n) => (n === 'data-coluna' ? coluna : null),
  closest: () => null,
});

describe('o FLIP dos vizinhos (kbDeslizar)', () => {
  test('cada vizinho que mudou parte do sítio antigo (o transform inverso) e desliza até ao novo', () => {
    const ctx = caixa();
    const r = relogio();
    Object.assign(ctx, { setTimeout: r.setTimeout, clearTimeout: r.clearTimeout });
    let depois = false;
    // o B desce 116px (o lugar entrou antes dele); o A não mexe
    const A = cartaoFalso('A', () => ({ left: 20, top: 100, width: 300, height: 108 }));
    const B = cartaoFalso('B', () => ({ left: 20, top: depois ? 324 : 208, width: 300, height: 108 }));
    const mexeu = ctx.kbDeslizar([listaFalsa([A, B], 'c'), null], () => { depois = true; });
    assert.equal(mexeu, true);
    assert.deepEqual(B.historia.slice(-2), ['translate(0px,-116px)', ''], 'o inverso (de onde estava), e logo o regresso a nada');
    assert.ok(B.classList.contains('kb-desliza'), 'a transição do regresso');
    assert.deepEqual(A.historia.filter(Boolean), [], 'quem não mudou não leva transform');
    assert.ok(!A.classList.contains('kb-desliza'));
    // acabado o deslize, a classe sai
    r.correr();
    assert.ok(!B.classList.contains('kb-desliza'));
  });

  test('um deslize a meio parte de onde se vê (interrompível), e a mesma lista não conta duas vezes', () => {
    const ctx = caixa();
    const r = relogio();
    Object.assign(ctx, { setTimeout: r.setTimeout, clearTimeout: r.clearTimeout });
    let fase = 0, chamadas = 0;
    // a meio de um deslize vê-se a 260; o sítio novo é 208 (o lugar voltou para trás)
    const B = cartaoFalso('B', () => { chamadas++; return { left: 20, top: fase ? 208 : 260, width: 300, height: 108 }; });
    B.classList.add('kb-desliza');
    const l = listaFalsa([B], 'c');
    ctx.kbDeslizar([l, l], () => { fase = 1; });
    assert.deepEqual(B.historia.slice(-2), ['translate(0px,52px)', ''], 'parte dos 260 onde se via, não do sítio antigo');
    assert.ok(chamadas <= 3, 'mede antes, depois, e uma vez para assentar o inverso (' + chamadas + ')');
  });

  test('o cartão no ar fica de fora', () => {
    const ctx = caixa();
    Object.assign(ctx, relogio());
    let depois = false;
    const ar = cartaoFalso('X', () => ({ left: 0, top: depois ? 0 : 500, width: 1, height: 1 }));
    ar.classList.add('kb-no-ar');
    ctx.kbDeslizar([listaFalsa([ar], 'c')], () => { depois = true; });
    assert.deepEqual(ar.historia, []);
  });

  test('com menos movimento, só muda: nem transform nem transição', () => {
    const ctx = caixa();
    Object.assign(ctx, relogio());
    ctx.matchMedia = (q) => ({ matches: /reduce/.test(q) });
    let depois = false, mudou = false;
    const B = cartaoFalso('B', () => ({ left: 20, top: depois ? 324 : 208, width: 300, height: 108 }));
    const mexeu = ctx.kbDeslizar([listaFalsa([B], 'c')], () => { depois = true; mudou = true; });
    assert.equal(mexeu, false);
    assert.ok(mudou, 'a mudança acontece');
    assert.deepEqual(B.historia.filter(Boolean), []);
    assert.ok(!B.classList.contains('kb-desliza'));
    assert.match(CSS_KANBAN, /@media\(prefers-reduced-motion:reduce\)\{[^}]*\.kb-cartao\.kb-desliza[^}]*transition:none/, 'e o CSS também desliga o deslize');
  });

  test('o inverso e a translação calculada', () => {
    const ctx = caixa();
    assert.equal(ctx.kbTransformInverso({ left: 10, top: 20 }, { left: 10, top: 20.3 }), '', 'menos de meio píxel: nada');
    assert.equal(ctx.kbTransformInverso({ left: 300, top: 20 }, { left: 10, top: 136 }), 'translate(290px,-116px)');
    assert.equal(ctx.kbTransformInverso(null, { left: 0, top: 0 }), '');
    assert.deepEqual({ ...ctx.kbTranslacao('matrix(1, 0, 0, 1, 0, -42.5)') }, { x: 0, y: -42.5 });
    assert.deepEqual({ ...ctx.kbTranslacao('none') }, { x: 0, y: 0 });
  });
});

describe('a auto-rolagem só para onde o ponteiro anda (kbArrVelocidade)', () => {
  const ctx = caixa();
  test('a pega já dentro da zona de baixo não rola enquanto o dedo não descer', () => {
    assert.equal(ctx.kbArrVelocidade(600, 610, 300, 640, 56), 0, 'subiu desde que pousou: parado');
    assert.ok(ctx.kbArrVelocidade(620, 610, 300, 640, 56) > 0, 'desceu: rola para baixo');
    assert.ok(ctx.kbArrVelocidade(310, 400, 300, 640, 56) < 0, 'subiu até ao topo: rola para cima');
    assert.equal(ctx.kbArrVelocidade(450, 400, 300, 640, 56), 0, 'no meio: parado');
  });
});

describe('a borda do telemóvel passa à coluna do lado', () => {
  test('o lado conta só para onde o dedo andou, e só havendo coluna desse lado', () => {
    const ctx = caixa();
    assert.equal(ctx.kbBordaLado(370, 290, 384, 40), 1);
    assert.equal(ctx.kbBordaLado(370, 375, 384, 40), 0, 'pousou já na zona e não andou para a direita');
    assert.equal(ctx.kbBordaLado(10, 290, 384, 40), -1);
    assert.equal(ctx.kbBordaLado(200, 290, 384, 40), 0);
    assert.equal(ctx.kbBordaDestino(2, 1, 5), 3);
    assert.equal(ctx.kbBordaDestino(4, 1, 5), -1, 'na última, a direita não leva a nada');
    assert.equal(ctx.kbBordaDestino(0, -1, 5), -1);
    assert.equal(ctx.kbBordaDestino(2, 0, 5), -1);
  });

  test('mantido na borda: passa uma coluna ao fim do instante, e a seguinte só passado mais de um segundo', () => {
    const ctx = caixa();
    const r = relogio();
    const vistas = [], avisos = [];
    Object.assign(ctx, {
      setTimeout: r.setTimeout, clearTimeout: r.clearTimeout,
      window: { addEventListener() {}, innerWidth: 384, innerHeight: 785 },
      kbArrColunas: () => [1, 2, 3, 4, 5],
      kbVerColuna: (i) => vistas.push(i),
      kbArrPintar: () => {},
      kbBordaMostrar: (a, lado, espera) => avisos.push([lado, espera]),
    });
    ctx.kbArr = { ativo: true, tel: true, x0: 290, x: 375, colIdx: 2, colIdx0: 2, bordaLado: 0, bordaTempo: 0 };
    ctx.kbArrBorda();
    assert.deepEqual(avisos.pop(), [1, ctx.KB_BORDA_ESPERA], 'o aviso acende com o instante');
    assert.equal(r.pendentes.size, 1);
    ctx.kbArrBorda(); // o dedo mexe-se dentro da borda: não recomeça a contar
    assert.equal(r.pendentes.size, 1);
    assert.equal(r.correr(), ctx.KB_BORDA_ESPERA);
    assert.deepEqual(vistas, [3], 'passou uma');
    assert.equal(ctx.kbArr.colIdx, 3);
    const [, prox] = [...r.pendentes.entries()][0];
    assert.ok(prox.ms > 1000, 'a seguinte só passado mais de um segundo (' + prox.ms + ' ms)');
    // sai da borda antes: não passa a outra
    ctx.kbArr.x = 200;
    ctx.kbArrBorda();
    assert.equal(r.pendentes.size, 0, 'fora da borda deixa de contar');
    assert.deepEqual(avisos.pop(), [0, ctx.KB_BORDA_ESPERA]);
    assert.deepEqual(vistas, [3]);
  });

  test('na última coluna o aviso apaga e não há mais passagens', () => {
    const ctx = caixa();
    const r = relogio();
    const vistas = [], avisos = [];
    Object.assign(ctx, {
      setTimeout: r.setTimeout, clearTimeout: r.clearTimeout,
      window: { addEventListener() {}, innerWidth: 384, innerHeight: 785 },
      kbArrColunas: () => [1, 2, 3, 4, 5],
      kbVerColuna: (i) => vistas.push(i),
      kbArrPintar: () => {},
      kbBordaMostrar: (a, lado) => avisos.push(lado),
    });
    ctx.kbArr = { ativo: true, tel: true, x0: 290, x: 375, colIdx: 3, colIdx0: 3, bordaLado: 0, bordaTempo: 0 };
    ctx.kbArrBorda();
    r.correr();
    assert.deepEqual(vistas, [4]);
    assert.equal(r.pendentes.size, 0, 'sem coluna à direita, não conta mais');
    assert.equal(avisos.pop(), 0, 'e o aviso apaga');
    ctx.kbArrBorda();
    assert.equal(r.pendentes.size, 0);
  });

  test('no computador a borda não passa de coluna', () => {
    const ctx = caixa();
    const r = relogio();
    Object.assign(ctx, { setTimeout: r.setTimeout, clearTimeout: r.clearTimeout, kbBordaMostrar: () => assert.fail('não acende') });
    ctx.kbArr = { ativo: true, tel: false, x0: 290, x: 1430, colIdx: 0, bordaLado: 0 };
    ctx.kbArrBorda();
    assert.equal(r.pendentes.size, 0);
  });
});

describe('o kbOrdemManual: numa coluna com outra ordem, o arrasto não reordena', () => {
  /* Um quadro a fingir com duas colunas, a de origem 'a' (A1, A2, A3) e a 'b' (B1, B2).
     Devolve: {ctx, cols, listas, nos}. */
  function quadro() {
    const ctx = caixa();
    const alturas = { A1: 0, A2: 120, A3: 240, B1: 0, B2: 120 };
    const nos = {};
    for (const k of Object.keys(alturas)) nos[k] = cartaoFalso(k, () => ({ left: 0, top: 100 + alturas[k], width: 300, height: 108 }));
    const listas = { a: listaFalsa([nos.A1, nos.A2, nos.A3], 'a'), b: listaFalsa([nos.B1, nos.B2], 'b') };
    const cols = { a: { querySelector: () => listas.a }, b: { querySelector: () => listas.b } };
    ctx.el = () => ({ getBoundingClientRect: () => ({ left: 0, right: 384, top: 0, bottom: 785 }), querySelectorAll: () => [cols.a, cols.b] });
    ctx.kbArrColunas = () => [cols.a, cols.b];
    ctx.kbEstado = { cartoes: [
      { chave: 'A1', coluna_id: 'a', prioridade: 3 }, { chave: 'A2', coluna_id: 'a', prioridade: 2 }, { chave: 'A3', coluna_id: 'a', prioridade: 1 },
      { chave: 'B1', coluna_id: 'b', prioridade: 1 }, { chave: 'B2', coluna_id: 'b', prioridade: 5 },
    ] };
    // o A3 no ar, a sair da coluna a; antes dele não havia nada (o fim)
    ctx.kbArr = { no: nos.A3, chave: 'A3', tel: true, colIdx: 0, colOrigem: cols.a, antesOrigem: null, ordenado: {} };
    return { ctx, cols, listas, nos };
  }

  test('na ordem do quadro, o ponteiro escolhe o sítio (controlo)', () => {
    const { ctx, nos } = quadro();
    ctx.kbOrdemManual = () => true;
    const alvo = ctx.kbArrAlvo(150, 120);
    assert.equal(alvo.antes, nos.A1, 'acima do meio do A1: antes dele');
  });

  test('a coluna de origem ordenada de outra forma: o lugar fica onde estava, seja onde for o ponteiro', () => {
    const { ctx, listas } = quadro();
    ctx.kbOrdemManual = (id) => id !== 'a';
    const alvo = ctx.kbArrAlvo(150, 120);
    assert.equal(alvo.lista, listas.a);
    assert.equal(alvo.antes, null, 'o sítio de origem (o fim), e não antes do A1');
  });

  test('outra coluna ordenada: o lugar fica onde o cartão vai aparecer, pela ordem dela', () => {
    const { ctx, listas, nos } = quadro();
    ctx.kbOrdemManual = (id) => id !== 'b';
    // a ordem da coluna b: por prioridade, a mais alta (número menor) primeiro
    ctx.kbVisiveis = (id) => ctx.kbEstado.cartoes.filter((c) => c.coluna_id === id).sort((x, y) => x.prioridade - y.prioridade);
    ctx.kbArr.colIdx = 1;
    const guardados = ctx.kbEstado.cartoes;
    const alvo = ctx.kbArrAlvo(150, 120);
    assert.equal(alvo.lista, listas.b);
    assert.equal(alvo.antes, nos.B2, 'prioridade 1 empatada com o B1, a seguir a ele e antes do B2 (5)');
    assert.equal(ctx.kbEstado.cartoes, guardados, 'o estado do quadro fica como estava');
    // mexer o ponteiro não muda o sítio
    assert.equal(ctx.kbArrAlvo(150, 900).antes, nos.B2);
  });

  /* Larga o A3 com o lugar entre dois cartões à vista e diz o que se pediu ao servidor.
     Recebe: coluna — onde está o lugar; manual — o kbOrdemManual; ant, seg — as chaves à volta do lugar.
     Devolve: a lista dos kbMover chamados ([chave, coluna, indice]). */
  function largar(coluna, manual, ant, seg) {
    const ctx = caixa();
    const movidos = [];
    const cartoes = [
      { chave: 'A1', coluna_id: 'a' }, { chave: 'A2', coluna_id: 'a' }, { chave: 'A3', coluna_id: 'a' },
      { chave: 'B1', coluna_id: 'b' }, { chave: 'B2', coluna_id: 'b' },
    ];
    const irmao = (k) => (k ? { classList: { contains: () => true }, getAttribute: () => k } : null);
    const lista = { getAttribute: () => coluna };
    const lugar = { parentNode: lista, nextElementSibling: irmao(seg), previousElementSibling: irmao(ant) };
    Object.assign(ctx, {
      kbOrdemManual: () => manual,
      kbArrDesfazer: () => {},
      kbCartao: (k) => cartoes.find((c) => c.chave === k),
      kbDaColuna: (id) => cartoes.filter((c) => c.coluna_id === id),
      kbMover: (k, col, i) => movidos.push([k, col, i]),
      kbAssentarChave: () => {},
      kbPintarDepoisDoArrasto: () => {},
      kbVerColuna: () => {},
    });
    ctx.kbArr = { id: 1, ativo: true, cancelado: false, lugar, chave: 'A3', no: { getBoundingClientRect: () => ({}) }, tel: false, colIdx: 0, colIdx0: 0 };
    ctx.kbArrLargar({ pointerId: 1 });
    return movidos;
  }

  test('largar: na ordem do quadro vai para entre os vizinhos; ordenada, não reordena', () => {
    assert.deepEqual(largar('a', true, '', 'A1'), [['A3', 'a', 0]], 'controlo: na ordem do quadro, para o topo');
    assert.deepEqual(largar('a', false, '', 'A1'), [], 'na mesma coluna ordenada: não se move');
    assert.deepEqual(largar('b', false, 'B1', 'B2'), [['A3', 'b', 2]], 'noutra coluna ordenada: muda de coluna, no fim da ordem do quadro');
    assert.deepEqual(largar('b', true, 'B1', 'B2'), [['A3', 'b', 1]], 'controlo: na ordem do quadro, entre o B1 e o B2');
  });
});
