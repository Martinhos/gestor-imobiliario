// O cartão «Por confirmar» da Agenda: por baixo do dia, os mesmos planeados
// que o crachá da Agenda conta (vencidos e não silenciados), nas linhas do
// cartão dos Planeados, fechado por omissão e com a contagem no cabeçalho;
// sem nada, ou com os Planeados desligados, não aparece. Abrir e fechar troca
// a classe num nó vivo e guarda a escolha no aparelho, sem repintar; abrir
// rola, no fim da dobra, só o que falta para o ver. Confirmar um planeado
// tira-o do cartão e do crachá. E a dobra é uma transição com os tokens da
// casa.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carregarApp, repor, limpar } from './arnes.js';

const HOJE = '2026-10-20';
const app = carregarApp({ hoje: HOJE });
afterEach(() => repor(app));

/* Uma base com um imóvel e três planeados: um que vence hoje, um em atraso
   (a janela fechou dia 12) e um silenciado. Ao abrir o cartão fica fechado
   (sem escolha guardada no aparelho).
   Recebe: extra (opcional) — mais planeados.
   Devolve: nada. */
function monta(extra = []) {
  limpar(app);
  app.localStorage.removeItem('gi_agenda_pend_shut');
  app.calMes = ''; app.calDiaSel = '';
  app.definirServicosDesligados([]);
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 <Arroios>' })];
  app.db.recurring = [
    app.normRec({ id: 'R1', name: 'Renda Ana', next: HOJE, every: 'month', tx: { kind: 'income', amount: 800, propertyId: 'P1', category: 'Rendas' } }),
    app.normRec({ id: 'R2', name: 'Condomínio', next: '2026-10-08', until: '2026-10-12', every: 'month', tx: { kind: 'expense', amount: 85, propertyId: 'P1', category: 'Condomínio' } }),
    app.normRec({ id: 'R3', name: 'Seguro', next: '2026-10-01', every: 'year', muted: true, tx: { kind: 'expense', amount: 120, propertyId: 'P1' } }),
    ...extra.map((r) => app.normRec(r)),
  ];
}

/* O HTML do cartão dentro da página do calendário.
   Devolve: o texto do <section id="calPendCard">, ou '' sem ele. */
function cartao() {
  const m = /<section class="card cal-pend[\s\S]*?<\/section>/.exec(app.vCalendar());
  return m ? m[0] : '';
}

/* Um cartão falso no ecrã, com as classes e os atributos que o alternar mexe.
   Recebe: fechado — se nasce com a classe .fechado; rect (opcional) — o
   retângulo do cartão.
   Devolve: {card, corpo, classes, attrs, ouvintes}. */
function cartaoFalso(fechado, rect = { top: 0, bottom: 0, height: 0 }) {
  const classes = new Set(['card', 'cal-pend'].concat(fechado ? ['fechado'] : []));
  const attrs = {}, ouvintes = [];
  const classList = {
    add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
    toggle: (c, f) => { if (f === undefined ? !classes.has(c) : f) classes.add(c); else classes.delete(c); },
  };
  const cab = { setAttribute: (k, v) => { attrs[k] = v; } };
  const corpo = {
    addEventListener: (t, f) => ouvintes.push(f), removeEventListener: (t, f) => { const i = ouvintes.indexOf(f); if (i > -1) ouvintes.splice(i, 1); },
    getBoundingClientRect: () => ({ height: 0 }),
  };
  const card = { classList, getBoundingClientRect: () => rect,
    querySelector: (s) => (s === '.cal-pend-corpo' ? corpo : s === '.cal-pend-cab' ? cab : null) };
  return { card, corpo, classes, attrs, ouvintes };
}

describe('o cartão e o crachá contam o mesmo', () => {
  test('com dois vencidos que avisam, o crachá é 2 e o cartão diz 2; o silenciado fica de fora', () => {
    monta();
    assert.equal(app.calCracha().n, 2, 'o crachá conta os vencidos não silenciados');
    const html = cartao();
    assert.ok(html, 'há cartão');
    assert.match(html, /<span class="cal-pend-n num" aria-hidden="true">2<\/span>/, 'a contagem no cabeçalho');
    assert.match(html, /2 planeados à espera/);
    assert.doesNotMatch(html, /Seguro/, 'o silenciado não avisa nem conta');
    assert.deepEqual(Array.from(app.calPendentes(), (r) => r.id), ['R2', 'R1'], 'os em atraso primeiro');
    assert.match(html, /<span class="badge red">1 em atraso<\/span>/);
  });

  test('sem nada por confirmar não há cartão, e o crachá é 0', () => {
    monta();
    app.db.recurring = app.db.recurring.filter((r) => r.muted);
    assert.equal(cartao(), '');
    assert.equal(app.calCracha().n, 0);
    assert.match(app.vCalendar(), /id="calDiaPanel"/, 'o resto da Agenda continua');
  });

  test('com os Planeados desligados não há cartão nem crachá, e a Agenda pinta na mesma', () => {
    monta();
    app.definirServicosDesligados(['recurring']);
    assert.equal(app.calCracha().n, 0);
    const html = app.vCalendar();
    assert.doesNotMatch(html, /calPendCard|quickConfirmRec/);
    assert.match(html, /id="calDiaPanel"/);
  });

  test('antes de se saber o estado do servidor não anuncia nada', () => {
    monta();
    app.haSessao = () => true;   // há sessão e a espera ainda não acabou
    assert.equal(cartao(), '');
    assert.equal(app.calCracha().n, 0);
  });
});

describe('o cabeçalho, as linhas e o sítio', () => {
  test('fechado por omissão: um botão dentro de um título, recolhido, «toca para ver»; o «0» guardado abre-o', () => {
    monta();
    let html = cartao();
    assert.match(html, /class="card cal-pend fechado"/);
    assert.match(html, /<h2 class="cal-pend-h"><button type="button" class="cal-pend-cab" id="calPendCab" data-toca="nada" data-click="calPendAlternar\(\)" aria-expanded="false" aria-controls="calPendCorpo">/);
    assert.match(html, /id="calPendCorpo"/, 'o corpo que o botão controla');
    assert.match(html, /toca para ver/);
    app.localStorage.setItem('gi_agenda_pend_shut', '0');
    html = cartao();
    assert.match(html, /class="card cal-pend"/);
    assert.match(html, /aria-expanded="true"/);
  });

  test('as linhas são as do cartão dos Planeados: Confirmar, Rever, a ficha e o ⋯, numa lista viva', () => {
    monta();
    const html = cartao();
    for (const id of ['R1', 'R2']) {
      assert.match(html, new RegExp(`quickConfirmRec\\('${id}'\\)`), 'Confirmar ' + id);
      assert.match(html, new RegExp(`confirmRec\\('${id}'\\)`), 'Rever ' + id);
      assert.match(html, new RegExp(`recView\\('${id}'\\)`), 'tocar no texto lê a ficha');
      assert.match(html, new RegExp(`data-fk="rec:${id}"`));
    }
    assert.match(html, /class="plan-pend-linha"/);
    assert.match(html, /data-listaviva="agendaPendentes"/);
    assert.match(html, /T2 &lt;Arroios&gt;/, 'o nome do imóvel vai escapado');
    assert.match(html, /número da Agenda, na barra de baixo/, 'a dica diz de onde vem o crachá');
  });

  test('o cartão vai na coluna do dia, por baixo do painel com Marcar visita e Recorrente, e fora dele', () => {
    monta();
    const html = app.vCalendar();
    const coluna = html.indexOf('<div class="cal-coluna">'), painel = html.indexOf('id="calDiaPanel"');
    const recorrente = html.indexOf('calNovoPlaneado('), card = html.indexOf('id="calPendCard"');
    assert.ok(coluna > -1 && coluna < painel && painel < recorrente && recorrente < card, 'coluna › painel › Recorrente › cartão');
    assert.doesNotMatch(app.calDiaPanel(HOJE), /calPendCard/, 'o calSel não o refaz a cada dia');
  });
});

describe('confirmar na Agenda', () => {
  test('confirmar tira-o do cartão e do crachá, e repinta a vista e a barra', () => {
    monta();
    app.db.recurring = app.db.recurring.filter((r) => r.id !== 'R2');
    let pintou = 0, barra = 0;
    app.render = () => { pintou++; };
    app.buildNav = () => { barra++; };
    app.toast = () => {};
    assert.equal(app.calCracha().n, 1);
    assert.match(cartao(), /cal-pend-n num" aria-hidden="true">1</);
    app.quickConfirmRec('R1');
    assert.equal(app.db.transactions.length, 1, 'o movimento ficou registado');
    assert.equal(app.calCracha().n, 0, 'o crachá passa a 0');
    assert.equal(cartao(), '', 'e o cartão sai');
    assert.ok(pintou >= 1 && barra >= 1, 'a Agenda e a barra de baixo repintam-se');
  });
});

describe('abrir e fechar', () => {
  test('troca a classe e o aria-expanded no nó vivo e guarda a escolha, sem repintar', () => {
    monta();
    let pintou = 0;
    app.render = () => { pintou++; };
    const f = cartaoFalso(true);
    app.document.getElementById = (id) => (id === 'calPendCard' ? f.card : null);
    app.calPendAlternar();
    assert.equal(f.classes.has('fechado'), false, 'abriu');
    assert.equal(f.attrs['aria-expanded'], 'true');
    assert.equal(app.localStorage.getItem('gi_agenda_pend_shut'), '0', 'a escolha fica no aparelho');
    assert.equal(app.calPendShut(), false);
    app.calPendAlternar();
    assert.equal(f.classes.has('fechado'), true, 'fechou');
    assert.equal(f.attrs['aria-expanded'], 'false');
    assert.equal(app.localStorage.getItem('gi_agenda_pend_shut'), '1');
    assert.equal(pintou, 0, 'não repinta: é uma transição no nó vivo');
  });

  test('o corte só dura a viagem: o .viagem sai no fim da transição do grid-template-rows', () => {
    monta();
    const f = cartaoFalso(true);
    app.document.getElementById = (id) => (id === 'calPendCard' ? f.card : null);
    app.calPendAlternar();
    assert.ok(f.classes.has('viagem'), 'a viajar, corta');
    f.ouvintes.slice().forEach((h) => h({ target: f.corpo, propertyName: 'opacity' }));
    assert.ok(f.classes.has('viagem'), 'o fim do desvanecer não é o fim da dobra');
    f.ouvintes.slice().forEach((h) => h({ target: f.corpo, propertyName: 'grid-template-rows' }));
    assert.ok(!f.classes.has('viagem'), 'parado, os menus ⋯ abrem para fora');
    assert.equal(f.ouvintes.length, 0, 'e o ouvinte sai');
  });

  test('sem movimento não há viagem nenhuma: a classe troca e pronto', () => {
    monta();
    app.semMovimento = () => true;
    app.localStorage.setItem('gi_agenda_pend_shut', '0');   // estava aberto
    const f = cartaoFalso(false);
    app.document.getElementById = (id) => (id === 'calPendCard' ? f.card : null);
    app.calPendAlternar();
    assert.ok(f.classes.has('fechado'));
    assert.ok(!f.classes.has('viagem'));
  });

  test('sem o cartão no ecrã, repinta a vista', () => {
    monta();
    let pintou = 0;
    app.render = () => { pintou++; };
    app.document.getElementById = () => null;
    app.calPendAlternar();
    assert.equal(pintou, 1);
  });

  test('abrir rola, no fim da dobra, só o que falta para o cartão ficar à vista, e nunca passa o cabeçalho do topo', () => {
    monta();
    const rolou = [];
    app.scrollBy = (o) => rolou.push(o);
    /* abre um cartão falso com o retângulo final dado e acaba a dobra */
    const abre = (rect) => {
      app.localStorage.setItem('gi_agenda_pend_shut', '1');
      const f = cartaoFalso(true, rect);
      app.document.getElementById = () => f.card;
      app.calPendAlternar();
      assert.deepEqual(rolou, [], 'a meio da dobra a página ainda não tem a altura nova: não rola');
      f.ouvintes.slice().forEach((h) => h({ target: f.corpo, propertyName: 'grid-template-rows' }));
      return f;
    };
    abre({ top: 700, bottom: 1060, height: 360 });
    assert.deepEqual(rolou.map((o) => o.top), [1060 - (900 - 12)], 'o que falta, acima do fundo do ecrã');
    assert.equal(rolou[0].behavior, 'smooth');
    rolou.length = 0;
    abre({ top: 100, bottom: 2160, height: 2060 });
    assert.deepEqual(rolou.map((o) => o.top), [100 - 12], 'um cartão enorme só sobe até 12px do topo (sem cabeçalho pegajoso no arnês)');
    rolou.length = 0;
    const f = abre({ top: 100, bottom: 360, height: 260 });
    assert.deepEqual(rolou, [], 'cabe: não rola');
    app.calPendAlternar();
    f.ouvintes.slice().forEach((h) => h({ target: f.corpo, propertyName: 'grid-template-rows' }));
    assert.deepEqual(rolou, [], 'fechar não rola');
  });

  test('um segundo toque a meio da dobra não rola, e sem movimento rola de uma vez', () => {
    monta();
    const rolou = [];
    app.scrollBy = (o) => rolou.push(o);
    app.localStorage.setItem('gi_agenda_pend_shut', '1');
    const f = cartaoFalso(true, { top: 700, bottom: 1060, height: 360 });
    app.document.getElementById = () => f.card;
    app.calPendAlternar();   // abre
    app.calPendAlternar();   // e fecha antes de acabar
    f.ouvintes.slice().forEach((h) => h({ target: f.corpo, propertyName: 'grid-template-rows' }));
    assert.deepEqual(rolou, [], 'interrompida, a abertura não rola');
    assert.ok(!f.classes.has('viagem'));
    app.semMovimento = () => true;
    app.calPendAlternar();   // abre de uma vez
    assert.deepEqual(rolou.map((o) => [o.top, o.behavior]), [[1060 - 888, 'auto']]);
  });
});

describe('a dobra no CSS', () => {
  test('uma transição com os tokens da casa, o corte só fechado ou a viajar, e o visibility no fim', () => {
    const css = fs.readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const ini = css.indexOf('/* ===== ajustes-v40c: 1.4'), fim = css.indexOf('/* ===== fim: ajustes-v40c 1.4 ===== */');
    assert.ok(ini > -1 && fim > ini, 'a secção da folha existe');
    const sec = css.slice(ini, fim);
    assert.match(sec, /\.cal-pend-corpo\{display:grid;grid-template-rows:1fr;transition:grid-template-rows var\(--medio\) var\(--curva-entra\)\}/);
    assert.match(sec, /\.cal-pend\.fechado>\.cal-pend-corpo\{grid-template-rows:0fr\}/);
    assert.match(sec, /\.cal-pend\.fechado \.cal-pend-dentro\{opacity:0;visibility:hidden;transition:opacity var\(--medio\) var\(--curva-entra\),visibility 0s var\(--medio\)\}/);
    assert.match(sec, /\.cal-pend\.fechado \.cal-pend-dentro,\.cal-pend\.viagem \.cal-pend-dentro\{overflow:hidden\}/);
    assert.doesNotMatch(sec.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,6}\b|cubic-bezier|\d+ms|\.\d+s\b/i, 'só tokens: nem cores nem tempos nem curvas à mão');
    assert.match(sec, /@media\(hover:hover\)\{\.cal-pend-cab:hover/);
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important/, 'sem movimento, a regra geral desliga a dobra');
  });
});
