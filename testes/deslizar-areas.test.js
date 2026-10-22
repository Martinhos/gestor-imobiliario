// Deslizar entre os separadores de uma área, no telemóvel: o vizinho certo em
// cada área e nas pontas (navegacao.js:portaVizinha, navegacao.js:vizinhoNaArea),
// os sítios e os estados onde o arrasto de lado já tem dono e não vira nada
// (navegacao.js:sepGestoLivre, navegacao.js:sepEstadoLivre), o gesto inteiro
// — decidir o eixo, virar com 1/4 ou com um sacudir, voltar ao sítio, o
// pointercancel e a resistência das pontas (navegacao.js:sepArrastar) —, a
// viagem a partir de onde o dedo largou (navegacao.js:sepIrPara,
// continuidade.js:deslizarPainel) e o CSS da secção.

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
  app.document.body.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
});

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const nav = readFileSync(new URL('../web/app/navegacao.js', import.meta.url), 'utf8');
const cont = readFileSync(new URL('../web/app/continuidade.js', import.meta.url), 'utf8');

// um ecrã até 900px (a pergunta da largura) e, à parte, com ou sem movimento
function telemovel(a, semMov) {
  a.matchMedia = (q) => ({ matches: /max-width:900px/.test(q) || (!!semMov && /reduce/.test(q)) });
}
// em que separador se está, sem nada escondido (ou com os dados escondidos)
function em(a, id, fora) {
  limpar(a);
  a.tab = id;
  a.separadoresEscondidos = () => fora || [];
}
// os dois vizinhos de onde se está: [anterior, seguinte]
const lados = (a) => [a.vizinhoNaArea(-1), a.vizinhoNaArea(1)];

/* Um nó falso, com pais: o closest responde pelos seletores que lhe dizemos
   que casam, e a medida de rolar pelo que lhe pomos. */
function no(pai, opcoes = {}) {
  const n = {
    parentElement: pai, casa: opcoes.casa || false,
    scrollWidth: opcoes.sw || 100, clientWidth: opcoes.cw || 100, ox: opcoes.ox || 'visible',
    closest() { for (let x = n; x; x = x.parentElement) if (x.casa) return x; return null; },
  };
  return n;
}
// o #view do arnês, com largura, pai e o contains dos nós falsos
function vista(a) {
  const v = elementos(a).view;
  v.getBoundingClientRect = () => ({ top: 60, left: 0, right: 375, bottom: 812, width: 375, height: 752 });
  v.contains = (x) => { for (let y = x; y; y = y.parentElement) if (y === v) return true; return false; };
  v.parentNode = { classList: { add() {}, remove() {} } };
  // o regresso ao sítio acaba logo: o onfinish corre quando é posto
  v.animate = () => ({ set onfinish(f) { f(); } });
  return v;
}
// o gesto: pousa, anda pelos x dados (o y fica), e levanta (ou cancela)
function gesto(a, alvo, xs, fim = 'pointerup', y = 400) {
  const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
  a.sepArrastar(Object.assign({ type: 'pointerdown', clientX: xs[0], clientY: y, target: alvo }, base));
  xs.slice(1).forEach((x) => a.sepArrastoMove(Object.assign({ type: 'pointermove', clientX: x, clientY: y }, base)));
  const ia = a._sepArrasto;
  a.sepArrastoFim(Object.assign({ type: fim, clientX: xs[xs.length - 1], clientY: y }, base));
  return ia;
}
// troca o go por um registo do que lhe chegou, com o lado e o desde do momento
function apanharGo(a) {
  const idas = [];
  a.go = (id) => idas.push({ id, lado: a._ladoSep, desde: a._desdeSep });
  return idas;
}

describe('o vizinho de cada separador', () => {
  test('Casas: Imóveis, Grupos, Contratos, Pessoas, Visitas, pela ordem das abas, sem dar a volta', () => {
    em(app, 'properties');
    assert.deepEqual(lados(app), ['', 'groups']);
    em(app, 'groups');
    assert.deepEqual(lados(app), ['properties', 'contracts']);
    em(app, 'contracts');
    assert.deepEqual(lados(app), ['groups', 'tenants']);
    em(app, 'visits');
    assert.deepEqual(lados(app), ['tenants', '']);
  });

  test('as Pessoas são uma porta só: dos Inquilinos e dos Proprietários os vizinhos são os mesmos', () => {
    for (const id of ['tenants', 'owners']) {
      em(app, id);
      assert.deepEqual(lados(app), ['contracts', 'visits'], id);
    }
    // chegar às Pessoas abre nos Proprietários quando só esses se veem
    em(app, 'contracts', ['tenants']);
    assert.equal(app.vizinhoNaArea(1), 'owners');
    assert.equal(app.portaVizinha(1), 'pessoas');
  });

  test('Dinheiro: Movimentos, Planeados, Créditos; nas pontas não há vizinho', () => {
    em(app, 'transactions');
    assert.deepEqual(lados(app), ['', 'recurring']);
    em(app, 'recurring');
    assert.deepEqual(lados(app), ['transactions', 'credits']);
    em(app, 'credits');
    assert.deepEqual(lados(app), ['recurring', '']);
  });

  test('um separador escondido (cargo, serviço desligado) sai da fila e os vizinhos fecham o buraco', () => {
    em(app, 'properties', ['contracts']);
    assert.deepEqual(lados(app), ['', 'groups']);
    em(app, 'groups', ['contracts']);
    assert.deepEqual(lados(app), ['properties', 'tenants']);
    em(app, 'transactions', ['recurring']);
    assert.deepEqual(lados(app), ['', 'credits']);
  });

  test('fora de uma área com separadores não há vizinho nenhum', () => {
    for (const id of ['dashboard', 'calendar', 'settings', 'reports', 'fisco']) {
      em(app, id);
      assert.deepEqual(lados(app), ['', ''], id);
    }
    // uma área com uma porta só à vista é o ecrã inteiro, não um carrossel
    em(app, 'transactions', ['recurring', 'credits']);
    assert.deepEqual(lados(app), ['', '']);
  });
});

describe('onde o arrasto já tem dono', () => {
  test('a lista do que nunca se rouba nomeia cada dono', () => {
    const m = /const SEP_NAO_ROUBA='([^']*)'\+\s*'([^']*)'/.exec(nav);
    assert.ok(m, 'SEP_NAO_ROUBA existe');
    const lista = m[1] + m[2];
    for (const s of ['#calDias', '.chartbox[data-lido]', '.pgrab', '#view.cw-edit .cw-blk', 'input', 'textarea', 'select', '[contenteditable]', '.modal']) {
      assert.ok(lista.includes(s), 'nomeia ' + s);
    }
  });

  test('um elemento com dono, ou dentro de um, não deixa virar; um cartão qualquer deixa', () => {
    em(app, 'properties');
    const v = vista(app);
    const cartao = no(v);
    assert.equal(app.sepGestoLivre(no(cartao)), true, 'um cartão é livre');
    const grafico = no(v, { casa: true });
    assert.equal(app.sepGestoLivre(no(no(grafico))), false, 'dentro de um dono não é');
    assert.equal(app.sepGestoLivre(no(null)), false, 'fora do #view não é');
    assert.equal(app.sepGestoLivre(null), false);
  });

  test('o que rola de lado é dele; um overflow:auto que cabe inteiro é da página', () => {
    em(app, 'recurring');
    const v = vista(app);
    const fila = no(v, { sw: 437, cw: 345, ox: 'auto' });
    const cabe = no(v, { sw: 341, cw: 341, ox: 'auto' });
    const largo = no(v, { sw: 600, cw: 345, ox: 'visible' });
    app.getComputedStyle = (el) => ({ overflowX: el.ox });
    assert.equal(app.sepRolaDeLado(fila), true);
    assert.equal(app.sepGestoLivre(no(fila)), false, 'a fila de chips rola: não se rouba');
    assert.equal(app.sepGestoLivre(no(cabe)), true, 'uma fila que cabe não rola');
    assert.equal(app.sepGestoLivre(no(largo)), true, 'mais largo mas sem rolar (o overflow visível) não conta');
  });

  test('o estado: só até 900px, numa área, sem janela, gaveta, seleção nem painel em edição', () => {
    em(app, 'transactions');
    app.matchMedia = () => ({ matches: false });
    assert.equal(app.sepEstadoLivre(), false, 'no computador desliga');
    telemovel(app);
    assert.equal(app.sepEstadoLivre(), true, 'no telemóvel, nos Movimentos, liga');
    app.modalStack.push({});
    assert.equal(app.sepEstadoLivre(), false, 'com uma janela aberta');
    app.modalStack.length = 0;
    for (const classe of ['open', 'sel-on']) {
      app.document.body.classList = { contains: (c) => c === classe };
      assert.equal(app.sepEstadoLivre(), false, 'com body.' + classe);
    }
    app.window.CW = { selMode: true };
    assert.equal(app.sepEstadoLivre(), false, 'a seleção dos Movimentos');
    app.window.CW = { editMode: true };
    assert.equal(app.sepEstadoLivre(), false, 'o painel em edição');
    delete app.window.CW;
    em(app, 'dashboard');
    assert.equal(app.sepEstadoLivre(), false, 'fora de uma área');
  });
});

describe('o gesto', () => {
  test('arrastar para a esquerda além de 1/4 vira para o seguinte, a partir de onde o dedo largou', () => {
    em(app, 'properties');
    telemovel(app);
    const v = vista(app);
    const idas = apanharGo(app);
    const a = gesto(app, no(v), [300, 290, 280, 250, 200, 150]);
    assert.equal(a.ativo, true);
    assert.equal(idas.length, 1);
    assert.equal(idas[0].id, 'groups');
    assert.equal(idas[0].lado, 1, 'o novo vem da direita');
    // a folga de decidir (10px) não conta: 150px de dedo, 140 de página
    assert.equal(idas[0].desde, -140);
    assert.equal(app._ladoSep, 0, 'o lado volta a zero');
    assert.equal(app._desdeSep, 0, 'o desde volta a zero');
    assert.equal(v.style.transform, '', 'o #view sai sem o transform do dedo antes da fita');
  });

  test('para a direita vira para o anterior; um arrasto curto e lento volta ao sítio', () => {
    em(app, 'contracts');
    telemovel(app);
    const v = vista(app);
    const idas = apanharGo(app);
    gesto(app, no(v), [100, 112, 140, 220, 260]);
    assert.deepEqual(idas.map((x) => [x.id, x.lado]), [['groups', -1]]);
    idas.length = 0;
    const a = gesto(app, no(v), [200, 188, 180, 175]);
    assert.equal(a.ativo, true, 'passou dos 10px: a página seguiu o dedo');
    assert.equal(idas.length, 0, '25px não chegam a 1/4 de 375');
  });

  test('o vertical é da página: larga o gesto sem virar nem mexer', () => {
    em(app, 'contracts');
    telemovel(app);
    const v = vista(app);
    const idas = apanharGo(app);
    const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
    app.sepArrastar(Object.assign({ clientX: 200, clientY: 400, target: no(v) }, base));
    assert.ok(app._sepArrasto, 'pousou');
    app.sepArrastoMove(Object.assign({ clientX: 204, clientY: 380 }, base));
    assert.equal(app._sepArrasto, null, 'o eixo é vertical: o gesto é largado');
    assert.equal(idas.length, 0);
  });

  test('um pointercancel (o browser ficou com o gesto) nunca vira', () => {
    em(app, 'properties');
    telemovel(app);
    const idas = apanharGo(app);
    gesto(app, no(vista(app)), [300, 280, 200, 100], 'pointercancel');
    assert.equal(idas.length, 0);
  });

  test('nas pontas a página resiste e não vira', () => {
    em(app, 'properties');
    telemovel(app);
    const v = vista(app);
    const idas = apanharGo(app);
    const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
    app.sepArrastar(Object.assign({ clientX: 60, clientY: 400, target: no(v) }, base));
    [80, 160, 260, 340].forEach((x) => app.sepArrastoMove(Object.assign({ clientX: x, clientY: 400 }, base)));
    const a = app._sepArrasto;
    assert.ok(a.desl > 0 && a.desl < a.dx / 2, 'anda menos de metade do dedo (' + a.desl + ' de ' + a.dx + ')');
    app.sepArrastoFim(Object.assign({ type: 'pointerup', clientX: 340, clientY: 400 }, base));
    assert.equal(idas.length, 0);
    // a resistência cresce sempre e nunca passa de meia largura
    const r = [50, 200, 1000, 5000].map((dx) => app.sepElastico(dx, 375));
    assert.ok(r.every((x, i) => i === 0 || x > r[i - 1]), 'cresce');
    assert.ok(r.every((x) => x < 375 / 2), 'menos de meia largura');
    assert.equal(app.sepElastico(-200, 375), -r[1], 'simétrica');
  });

  test('uma janela que abre a meio (um toque longo) devolve a página e acaba o gesto', () => {
    em(app, 'properties');
    telemovel(app);
    const v = vista(app);
    const idas = apanharGo(app);
    const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
    app.sepArrastar(Object.assign({ clientX: 300, clientY: 400, target: no(v) }, base));
    app.sepArrastoMove(Object.assign({ clientX: 289, clientY: 400 }, base));
    assert.equal(app._sepArrasto.ativo, true);
    app.modalStack.push({});
    app.sepArrastoMove(Object.assign({ clientX: 150, clientY: 400 }, base));
    assert.equal(app._sepArrasto, null, 'o gesto acabou');
    assert.equal(v.style.transform, '', 'a página voltou ao sítio');
    assert.equal(idas.length, 0, 'e não virou');
  });

  test('o sacudir vira mesmo antes de 1/4', () => {
    em(app, 'transactions');
    telemovel(app);
    const v = vista(app);
    const idas = apanharGo(app);
    const agora = Date.now;
    let t = 1000;
    app.Date.now = () => t;
    try {
      const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
      app.sepArrastar(Object.assign({ clientX: 300, clientY: 400, target: no(v) }, base));
      [285, 270, 250].forEach((x) => { t += 10; app.sepArrastoMove(Object.assign({ clientX: x, clientY: 400 }, base)); });
      app.sepArrastoFim(Object.assign({ type: 'pointerup', clientX: 250, clientY: 400 }, base));
    } finally { app.Date.now = agora; }
    assert.deepEqual(idas.map((x) => x.id), ['recurring'], '40px a 1,5px/ms é um sacudir');
  });

  test('o rato, um segundo dedo, as bordas do ecrã e o computador não começam nada', () => {
    em(app, 'properties');
    telemovel(app);
    const v = vista(app);
    const base = { pointerId: 7, isPrimary: true, button: 0, clientY: 400, target: no(v) };
    app.sepArrastar(Object.assign({ pointerType: 'mouse', clientX: 200 }, base));
    assert.equal(app._sepArrasto, null, 'o rato');
    app.sepArrastar(Object.assign({}, base, { pointerType: 'touch', isPrimary: false, clientX: 200 }));
    assert.equal(app._sepArrasto, null, 'um segundo dedo');
    app.sepArrastar(Object.assign({ pointerType: 'touch', clientX: 8 }, base));
    assert.equal(app._sepArrasto, null, 'a borda esquerda é do voltar do sistema');
    app.matchMedia = () => ({ matches: false });
    app.sepArrastar(Object.assign({ pointerType: 'touch', clientX: 200 }, base));
    assert.equal(app._sepArrasto, null, 'acima de 900px');
  });

  test('sem movimento a página não segue o dedo, e troca na mesma, sem desde', () => {
    em(app, 'properties');
    telemovel(app, true);
    const v = vista(app);
    v.style.transform = '';
    const idas = apanharGo(app);
    gesto(app, no(v), [300, 280, 200, 120]);
    assert.equal(v.style.transform, '');
    assert.deepEqual(idas.map((x) => [x.id, x.desde]), [['groups', 0]]);
  });
});

describe('a viagem e o CSS', () => {
  test('o sepIrPara passa o lado e o desde ao deslizarPainel, pelo go', () => {
    em(app, 'properties');
    const chamadas = [];
    app.deslizarPainel = (pintar, d, desde) => { chamadas.push([d, desde]); };
    app.separadorLigado = () => true;
    app.sepIrPara('contracts', 1, -120);
    assert.deepEqual(chamadas, [[1, -120]]);
    assert.equal(app._ladoSep, 0);
    assert.equal(app._desdeSep, 0);
  });

  test('o deslizarPainel parte de onde o dedo largou, nos dois painéis', () => {
    const i = cont.indexOf('function deslizarPainel(');
    const corpo = cont.slice(i, cont.indexOf('\nfunction ', i + 1) > -1 ? cont.indexOf('\nfunction ', i + 1) : cont.length);
    assert.match(corpo, /^function deslizarPainel\(pintar,d,desde\)/);
    assert.match(corpo, /const o=Number\(desde\)\|\|0/);
    assert.match(corpo, /\{transform:'translateX\('\+o\+'px\)'\},\{transform:'translateX\('\+\(-d\*w\)\+'px\)'\}/, 'quem sai parte de o');
    assert.match(corpo, /\{transform:'translateX\('\+\(d\*w\+o\)\+'px\)'\},\{transform:'none'\}/, 'quem entra vem colado');
  });

  test('o CSS: pan-y com pinch-zoom só no telemóvel e numa área, o corte do pai, o nome a espreitar por tokens', () => {
    // numa área as abas estão na casa delas, por cima do #view (navegacao.js:abasAssentar)
    assert.match(css, /@media\(max-width:900px\)\{#abasArea:not\(:empty\)~#view,#view:has\(>\.abas>\.abas-area\)\{touch-action:pan-y pinch-zoom\}\}/);
    assert.match(css, /main\.sep-arrasto\{overflow-x:clip\}/);
    const espreita = (css.match(/\.sep-espreita[^{]*\{[^}]*\}/g) || []).join('');
    assert.ok(espreita.length > 0, 'a regra existe');
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(espreita), 'só tokens de cor');
    assert.match(espreita, /transition:[^;}]*var\(--rapido\)/, 'o tempo vem de um token');
    // a secção vem logo a seguir às abas
    assert.ok(css.indexOf('main.sep-arrasto') > css.indexOf('.abas>.abas-area{display:none}'));
  });
});
