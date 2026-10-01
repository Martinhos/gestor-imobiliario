// O toque longo nos Movimentos: ao entrar na seleção, o nome de cada mês
// desliza do sítio onde estava (à esquerda) até ao meio do título, o corpo das
// linhas abre espaço à caixa a deslizar, e as caixas aparecem a desvanecer; ao
// sair, o caminho inverso, com as caixas que saem a desvanecer no lugar onde
// estavam. Só na MUDANÇA de modo: marcar, a lista viva e a sincronização de
// fundo não voltam a animar. Com menos movimento pedido, nada.
//
// O DOM do arnês não tem layout nem animate(): aqui o ecrã é feito à mão, com
// as peças de antes e as de depois do render (o render troca os nós, como no
// browser) e retângulos escolhidos, e cada animate() fica registado. O que se
// vê de facto no browser prova-o o percurso com o Playwright.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarTudo, limpar, repor } from './arnes.js';

const app = carregarTudo({ hoje: '2026-09-06' });
afterEach(() => repor(app));

/* Uma peça do ecrã falso: o retângulo que se lhe dá, os atributos, o que tem
   dentro (por seletor) e as animações que lhe pedem.
   Recebe: r — {x, y, w, h}; o (opcional) — {attrs, dentro, id, pai, op}.
   Devolve: o elemento falso. */
function peca(r, o = {}) {
  const e = {
    r, anims: [], attrs: o.attrs || {}, id: o.id || '', style: {}, innerHTML: '', removido: false,
    parentNode: o.pai || null, isConnected: false,
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    getBoundingClientRect: () => ({ left: e.r.x, top: e.r.y, width: e.r.w, height: e.r.h, right: e.r.x + e.r.w, bottom: e.r.y + e.r.h }),
    getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null),
    removeAttribute: (k) => { if (k === 'id') e.id = ''; delete e.attrs[k]; },
    querySelector: (s) => (o.dentro && o.dentro[s]) || null,
    querySelectorAll: () => [],
    animate: (kf, op) => { const a = { kf, op, onfinish: null }; e.anims.push(a); return a; },
    remove: () => { e.removido = true; },
  };
  return e;
}

/* Um ecrã dos Movimentos com um mês e uma linha, sem seleção (antes) ou com
   ela (depois): o título é mais alto, o nome está ao meio e o corpo da linha
   foi empurrado pela caixa. Nós NOVOS a cada chamada, como o render faz.
   Recebe: sel — true para o ecrã em seleção.
   Devolve: {nome, titulo, linha, corpo, caixaMes, caixaLinha, barra, global, todos(seletor)}. */
function ecra(sel) {
  const titulo = peca(sel ? { x: 15, y: 364, w: 345, h: 56 } : { x: 15, y: 300, w: 345, h: 20 });
  const nome = peca(sel ? { x: 157.5, y: 384, w: 60, h: 16 } : { x: 15, y: 302, w: 60, h: 16 }, { attrs: { 'data-mes-nome': '2026-03' }, pai: titulo });
  const corpo = peca(sel ? { x: 80, y: 430, w: 200, h: 40 } : { x: 30, y: 350, w: 250, h: 40 });
  const caixaLinha = sel ? peca({ x: 30, y: 430, w: 36, h: 42 }) : null;
  const linha = peca(sel ? { x: 15, y: 420, w: 345, h: 70 } : { x: 15, y: 340, w: 345, h: 92 },
    { attrs: { 'data-tx': 'A' }, dentro: { '.txcorpo': corpo, '.selbox': caixaLinha } });
  const caixaMes = sel ? peca({ x: 15, y: 371, w: 140, h: 42 }, { attrs: { 'data-mes-box': '2026-03' } }) : null;
  titulo.querySelector = (s) => (s === '[data-mes-box]' ? caixaMes : null);
  const global = sel ? peca({ x: 15, y: 70, w: 36, h: 42 }, { id: 'selGlobal' }) : null;
  const barra = sel ? peca({ x: 15, y: 60, w: 345, h: 64 }) : null;
  const todos = (s) => {
    if (s === '#view [data-mes-nome]') return [nome];
    if (s === '#view .txrow[data-tx]') return [linha];
    if (s === '#view [data-mes-box]') return caixaMes ? [caixaMes] : [];
    if (s === '#view .selbox, #view .sel-bar') return sel ? [caixaMes, caixaLinha, barra, global] : [];
    return [];
  };
  return { nome, titulo, linha, corpo, caixaMes, caixaLinha, barra, global, todos };
}

/* Liga o ecrã falso à app: antes do render vê-se `antes`, e o render (o da
   base, que troca o #view) passa a mostrar o ecrã do modo em que ficou.
   Recebe: antes — o ecrã que está pintado agora.
   Devolve: {atual()} — o ecrã que se vê neste momento. */
function ligar(antes) {
  const estado = { atual: antes };
  const base = app._render_sel;
  app._render_sel = function () {
    const r = base.apply(this, arguments);
    estado.atual = ecra(!!app.CW.selMode);
    return r;
  };
  app.document.querySelectorAll = (s) => estado.atual.todos(s);
  app.document.querySelector = (s) => (s === '#view .sel-bar' ? estado.atual.barra : null);
  return { atual: () => estado.atual };
}

// a microtarefa em que o deslize se aplica, e mais uma volta
const depoisDoRender = () => new Promise((r) => setImmediate(r));
/* as animações de um elemento, em texto: [de, para] de cada uma — pelo JSON,
   porque os quadros nascem dentro da vm, com outro protótipo de array */
const passos = (e) => JSON.parse(JSON.stringify(e.anims.map((a) => a.kf.map((k) => k.transform || String(k.opacity)))));

beforeEach(() => {
  limpar(app);
  app.db.transactions.push(app.normTx({ id: 'A', kind: 'expense', label: 'Luz', amount: 50, date: '2026-03-12' }));
  app.tab = 'transactions';
  app.CW.selReset();
  app.selModoPintado = false;
  app.selFantasmas = [];
});

describe('entrar na seleção', () => {
  test('o nome do mês desliza de onde estava até ao meio, com o --lento e a curva de quem chega', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    const { nome } = v.atual();
    assert.deepEqual(passos(nome), [['translateX(-142.5px)', 'none']], 'da esquerda (15) para o meio (157,5)');
    assert.equal(nome.anims[0].op.duration, 340, 'o --lento: o nome atravessa mais de cem pixeis, como as linhas à volta');
    assert.equal(nome.anims[0].op.easing, 'cubic-bezier(0,0,.2,1)', 'a --curva-entra');
  });

  test('as caixas do mês e das linhas e a barra de cima aparecem a desvanecer; a caixa de tudo vai com a barra', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    const { caixaMes, caixaLinha, barra, global } = v.atual();
    for (const [nomeDaPeca, e] of [['a caixa do mês', caixaMes], ['a caixa da linha', caixaLinha], ['a barra', barra]]) {
      assert.deepEqual(passos(e), [['0', '1']], nomeDaPeca + ' aparece');
      assert.equal(e.anims[0].op.duration, 200, nomeDaPeca + ': no --medio');
    }
    assert.equal(global.anims.length, 0, 'desvanecer a caixa e a barra que a leva era desvanecer duas vezes');
  });

  test('o corpo de cada linha abre espaço à caixa a deslizar, e o título desce com as linhas pela altura do nome', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    const { corpo, titulo } = v.atual();
    assert.deepEqual(passos(corpo), [['translateX(-50px)', 'none']], 'de 30 para 80, empurrado pela caixa');
    /* o centro do nome passa de 310 para 392: é por ele que o título se
       alinha, e não pelo topo (o título em seleção é mais alto) */
    assert.deepEqual(passos(titulo), [['translateY(-82px)', 'none']]);
  });

  test('não fica nada no style de ninguém: tudo é animação, e o título sticky fica como a folha o pôs', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    const e = v.atual();
    for (const p of [e.nome, e.titulo, e.corpo, e.caixaMes, e.caixaLinha, e.barra]) {
      assert.deepEqual(Object.keys(p.style), [], 'style vazio');
      assert.ok(p.anims.every((a) => !a.op.fill), 'sem fill: no fim a animação desaparece e o sticky manda');
    }
  });
});

describe('só na mudança de modo', () => {
  test('o render a seguir (a sincronização de fundo) não anima nada', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    app.render();
    await depoisDoRender();
    const e = v.atual();
    for (const p of [e.nome, e.titulo, e.corpo, e.caixaMes, e.caixaLinha, e.barra]) assert.equal(p.anims.length, 0);
    assert.equal(app.selModoPintado, true, 'o modo pintado continua a ser a seleção');
  });

  test('marcar uma linha, marcar o mês e a lista viva repintam as marcas sem animar', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar();                 // «Selecionar vários» sem nada marcado: o toque a seguir marca
    await depoisDoRender();
    const e = v.atual();
    const antes = [e.nome, e.titulo, e.corpo, e.caixaMes, e.caixaLinha, e.barra].map((p) => p.anims.length);
    app.CW.selToggle('A');
    app.CW.selMes('2026-03');
    app.CW.selPintar();
    app.pintarListaTx();
    await depoisDoRender();
    assert.deepEqual([e.nome, e.titulo, e.corpo, e.caixaMes, e.caixaLinha, e.barra].map((p) => p.anims.length), antes);
    assert.ok(e.caixaLinha.innerHTML.includes('selck on'), 'e a marca pintou-se à mesma');
  });

  test('ir para outro separador sai sem animar, e voltar aos movimentos também não anima', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    const naSelecao = v.atual();
    app.tab = 'properties';
    app.render();
    await depoisDoRender();
    assert.equal(app.CW.selMode, false);
    assert.equal(app.selModoPintado, false, 'o ecrã que ficou não é uma seleção');
    assert.equal(naSelecao.nome.anims.length, 1, 'só a entrada');
    app.tab = 'transactions';
    app.render();
    await depoisDoRender();
    assert.equal(v.atual().nome.anims.length, 0, 'voltar não é sair da seleção');
  });

  test('numa lista que acaba vazia o vTransactions sai sozinho, e não há mudança nenhuma a mostrar', async () => {
    app.db.transactions.length = 0;
    const v = ligar(ecra(false));
    app.CW.selEntrar();
    await depoisDoRender();
    assert.equal(app.CW.selMode, false);
    assert.equal(v.atual().nome.anims.length, 0);
    assert.equal(app.selModoPintado, false);
  });
});

describe('sair da seleção', () => {
  test('o nome volta à esquerda e o corpo ao sítio, pelo caminho inverso', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    app.CW.selSair();
    await depoisDoRender();
    const { nome, corpo, titulo } = v.atual();
    assert.deepEqual(passos(nome), [['translateX(142.5px)', 'none']]);
    assert.deepEqual(passos(corpo), [['translateX(50px)', 'none']]);
    assert.deepEqual(passos(titulo), [['translateY(82px)', 'none']]);
  });

  test('as caixas que saíram desvanecem onde estavam, a ir com a linha e o título delas, sem ids, e saem no fim', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    const sel = v.atual();
    // o que cada caixa já tinha da entrada (o aparecer); o que conta é o que vem a seguir
    const daEntrada = new Map([sel.caixaMes, sel.caixaLinha, sel.barra].map((c) => [c, c.anims.length]));
    const daSaida = (c) => ({ anims: c.anims.slice(daEntrada.get(c)) });
    app.CW.selSair();
    await depoisDoRender();
    const camada = app.document.getElementById('saidas');
    for (const c of [sel.caixaMes, sel.caixaLinha, sel.barra]) {
      assert.ok(camada.children.includes(c), 'o mesmo nó, na camada de saída');
      assert.equal(c.style.position, 'fixed');
      assert.equal(c.style.pointerEvents, 'none', 'surdo ao toque');
      const op = daSaida(c).anims.find((a) => a.kf[0].opacity !== undefined);
      assert.deepEqual([op.kf[0].opacity, op.kf[1].opacity], [1, 0], 'desvanece');
      op.onfinish();
      assert.ok(c.removido, 'e sai do documento no fim');
    }
    // a caixa da linha sobe com a linha (420 → 340: 80px); a do mês com o nome (392 → 310)
    assert.deepEqual(passos(daSaida(sel.caixaLinha))[0], ['none', 'translateY(-80px)'], 'a linha sobe 80px ao sair');
    assert.deepEqual(passos(daSaida(sel.caixaMes))[0], ['none', 'translateY(-82px)']);
    assert.equal(daSaida(sel.barra).anims.length, 1, 'a barra não tem dono: só desvanece');
  });

  test('sair a meio de uma entrada e voltar a entrar: parte de onde a peça está, e os fantasmas da saída vão-se já', async () => {
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    // a meio do caminho: o getBoundingClientRect conta o transform que está a correr
    v.atual().nome.r.x = 90;
    app.CW.selSair();
    await depoisDoRender();
    assert.deepEqual(passos(v.atual().nome), [['translateX(75px)', 'none']], 'de 90, e não do meio');
    const fantasmas = app.selFantasmas.slice();
    assert.ok(fantasmas.length > 0, 'as caixas saíram como fantasmas');
    app.CW.selEntrar('A');
    await depoisDoRender();
    assert.ok(fantasmas.every((f) => f.removido), 'a mudança nova levou-as');
  });

  test('com menos movimento pedido, nada se mede nem anima, a entrar ou a sair', async () => {
    app.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, addListener() {} });
    const v = ligar(ecra(false));
    app.CW.selEntrar('A');
    await depoisDoRender();
    const sel = v.atual();
    app.CW.selSair();
    await depoisDoRender();
    const fora = v.atual();
    for (const p of [sel.nome, sel.titulo, sel.corpo, sel.caixaMes, sel.caixaLinha, sel.barra, fora.nome, fora.titulo, fora.corpo]) {
      assert.equal(p.anims.length, 0);
      assert.deepEqual(Object.keys(p.style), []);
    }
    assert.equal(app.CW.selMode, false, 'e a seleção entrou e saiu na mesma');
  });
});

describe('as peças que deslizam, na vista e na folha', () => {
  test('o nome do mês leva o mês, o corpo da linha a classe, e os indicadores vão numa peça com chave', () => {
    assert.match(app.txMesHtml('2026-03'), /<span class="txmes-nome" data-mes-nome="2026-03">mar 2026<\/span>/);
    const t = app.db.transactions[0];
    assert.match(app.txLinhaHtml(t, '2026-03'), /<div class="u-minw-0 txcorpo">/);
    assert.match(app.vTransactions(), /<div data-fk="txresumo"><div class="grid/, 'a continuidade leva os indicadores com as linhas');
  });

  test('em seleção o nome fica no centro do título: a caixa e o saldo repartem o resto por igual', () => {
    const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
    assert.match(css, /\.section-title\.sel-mes \.selbox,\.section-title\.sel-mes \.txnet\{flex:1 1 0\}/);
    assert.match(css, /\.section-title\.sel-mes \.selbox\{padding-left:0;padding-right:0\}/,
      'sem padding de lado: o flex-basis 0 não o conta e o nome ficava fora do meio');
    // e o título continua a colar-se ao topo em seleção
    assert.match(css, /\.section-title\.sel-mes\{position:sticky;/);
  });
});
