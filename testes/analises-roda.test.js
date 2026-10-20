// As Projeções e a Avaliação filtram só pela fila de chips, no sítio da barra
// das listas: o chip «Imóvel» (um imóvel ou um grupo), sem pesquisa, sem funil,
// sem painel e sem o chip do proprietário. O botão do cabeçalho delas é a roda
// dentada, que abre a janela das opções — o horizonte, o aumento e a inflação
// nas Projeções, o yield exigido na Avaliação —, e cada campo grava ao mexer.
// A Visão geral e a Declaração ficam com o funil e o painel de sempre.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, elementos } from './arnes.js';

const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
afterEach(() => { app.fecharFiltros(); app.projProp = ''; app.repProp = ''; });
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
const ANO = 2026;

/* Dois proprietários, dois imóveis com um contrato cada e um grupo com o
   primeiro: o que o chip precisa para ter o que escolher e a projeção para
   ter uma coluna por contrato. */
function semear() {
  const db = limpar(app);
  db.owners.push(app.normPerson({ id: 'o1', name: 'Ana Dona' }), app.normPerson({ id: 'o2', name: 'Bruno Dono' }));
  db.tenants.push(app.normPerson({ id: 't1', name: 'Rui' }), app.normPerson({ id: 't2', name: 'Sara' }));
  db.properties.push(app.normProp({ id: 'p1', name: 'T2 Lisboa', value: 200000, purchase: 150000, ownerIds: ['o1'] }));
  db.properties.push(app.normProp({ id: 'p2', name: 'T1 Porto', value: 120000, purchase: 90000, ownerIds: ['o2'] }));
  db.contracts.push(app.normContract({ id: 'c1', name: 'Lisboa', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.contracts.push(app.normContract({ id: 'c2', name: 'Porto', propertyId: 'p2', tenantIds: ['t2'], rent: 500, start: (ANO - 1) + '-01-01', active: true }));
  db.groups.push(app.normGroup({ id: 'G', name: 'Centro', kind: 'prop', ids: ['p1'] }));
  db.settings.years = 5; db.settings.growth = 2; db.settings.inflation = 2; db.settings.capTarget = 5;
}

/* O #hdrFilt com classes, atributos e título que se leem.
   Devolve: o botão falso, com .atr (os atributos) e .cls (as classes). */
function cabecalho() {
  const hb = app.document.getElementById('hdrFilt');
  const cls = new Set(), atr = {};
  hb.classList = { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, v) => (v ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) };
  hb.setAttribute = (k, v) => { atr[k] = String(v); };
  hb.getAttribute = (k) => (k in atr ? atr[k] : null);
  hb.removeAttribute = (k) => { delete atr[k]; };
  hb.title = 'Filtros e parâmetros';
  hb.atr = atr; hb.cls = cls;
  return hb;
}

/* Abre a janela das opções do separador sem DOM, pelo botão do cabeçalho.
   Recebe: t — o separador.
   Devolve: {titulo, corpo, pe} — o que foi pedido ao openModal. */
function abrirOpcoes(t) {
  const abrir = app.openModal, r = {};
  app.openModal = (titulo, corpo, pe) => { Object.assign(r, { titulo, corpo, pe }); return null; };
  try { app.tab = t; app.hdrFiltToggle(); } finally { app.openModal = abrir; }
  return r;
}

/* Um campo falso da janela, com o valor escrito.
   Recebe: v — o texto do campo.
   Devolve: {value}. */
const campo = (v) => ({ value: v });

describe('a fila de chips no sítio dos filtros', () => {
  beforeEach(semear);

  test('Projeções: só a fila de chips — sem pesquisa, sem funil, sem painel, sem os campos e sem o «Âmbito»', () => {
    const h = app.vProjections();
    assert.match(h, /^<div class="chips-fila mov-chips ana-chips" role="group" aria-label="Filtros da projeção"><span class="mov-chip"><div class="sel" id="sel_projSel">/);
    assert.doesNotMatch(h, /type="search"|mov-barra|mov-filt|class="fwrap|fpanel|fp-pe/, 'nem pesquisa, nem funil, nem painel');
    assert.doesNotMatch(h, /ana-pin|prjHorizonte|prjAumento|prjInflacao|Âmbito/, 'os números saíram da página');
    assert.match(h, /Entradas e saídas por ano|Entradas, saídas e cashflow por ano/, 'a projeção continua');
  });

  test('Avaliação: o mesmo, com as ações da página na mesma linha', () => {
    const h = app.vReports();
    assert.match(h, /^<div class="ana-topo"><div class="chips-fila mov-chips ana-chips" role="group" aria-label="Filtros da avaliação"><span class="mov-chip"><div class="sel" id="sel_repSel">/);
    assert.match(h, /<\/div><div class="ana-acoes"><button type="button" class="btn" data-toca="nada" data-click="shareReport\(\)">/);
    assert.doesNotMatch(h, /type="search"|mov-barra|mov-filt|class="fwrap|fpanel|fp-pe|ana-pin|avaYield|Âmbito/);
  });

  test('o proprietário não tem chip, mesmo com proprietários e um filtro de proprietário posto', () => {
    app.ownerFilter = 'o1';
    try {
      for (const h of [app.vProjections(), app.vReports()]) {
        assert.doesNotMatch(h, /Proprietário|limparAmbito|ownerSel/);
      }
    } finally { app.ownerFilter = ''; }
  });

  test('desligado, o chip diz «Imóvel» com a seta, e escolhe entre todos, cada imóvel e os grupos', () => {
    const h = app.vProjections();
    assert.match(h, /<button type="button" class="selbtn" aria-label="Imóvel" id="selb_projSel"[^>]*><span id="lab_projSel">Imóvel<\/span><svg/);
    assert.ok(!/mov-chip-x/.test(h), 'sem o ×');
    const ops = [...h.matchAll(/role="option"[^>]*>\s*<span>([^<]*)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(ops, ['Todos os imóveis', 'T2 Lisboa', 'T1 Porto', 'Grupo · Centro']);
    assert.match(h, /data-toca="vista" data-click="selPick\(event,'projSel',1\)"/, 'cada escolha é um filtro da vista');
  });

  test('ligado, diz o nome no cobalto, com o × que volta a todos e deixa o foco no chip', () => {
    app.projProp = 'p1';
    const h = app.vProjections();
    assert.match(h, /<span class="mov-chip on"><div class="sel" id="sel_projSel">/);
    assert.match(h, /aria-label="Imóvel: T2 Lisboa" id="selb_projSel"[^>]*><span id="lab_projSel">T2 Lisboa<\/span>/);
    assert.match(h, /<button type="button" class="mov-chip-x" aria-label="Voltar a todos os imóveis" data-toca="vista" data-click="projAnaLimpar\(\);render\(\);anaChipFocar\('projSel'\)">/);
    app.repProp = 'g:G';
    assert.match(app.vReports(), /<span id="lab_repSel">Grupo · Centro<\/span>/, 'um grupo diz-se como no seletor');
  });

  test('escolher no chip filtra a projeção, e o × devolve-a ao âmbito todo', () => {
    let pintou = 0;
    app.render = () => { pintou++; };
    const todos = app.vProjections();
    assert.match(todos, /<th>Lisboa<\/th><th>Porto<\/th>/, 'controlo: uma coluna por contrato');
    app.document.getElementById('projSel').value = 'p2';
    app.onProjProp();
    assert.equal(app.projProp, 'p2');
    assert.equal(pintou, 1, 'escolher repinta');
    const um = app.vProjections();
    assert.match(um, /<th>Porto<\/th>/);
    assert.doesNotMatch(um, /<th>Lisboa<\/th>/, 'só o imóvel em foco');
    app.projAnaLimpar();
    assert.match(app.vProjections(), /<th>Lisboa<\/th><th>Porto<\/th>/);
  });

  test('na Avaliação, escolher no chip põe o imóvel em foco e a página passa a ser a dele', () => {
    app.render = () => {};
    app.document.getElementById('repSel').value = 'p2';
    app.onRepSel();
    assert.equal(app.repProp, 'p2');
    assert.match(app.vReports(), /<h2 class="ava-nome">T1 Porto<\/h2>/);
  });

  test('o × leva o foco ao chip refeito; sem o chip no ecrã não rebenta', () => {
    const fixos = elementos(app);
    let focou = 0;
    fixos.selb_projSel.focus = () => { focou++; };
    app.anaChipFocar('projSel');
    assert.equal(focou, 1);
    app.document.getElementById = () => null;
    try { assert.doesNotThrow(() => app.anaChipFocar('projSel')); } finally { repor(app); }
  });

  test('sem imóveis o chip não tem o que escolher e não se escreve; as ações ficam na linha delas', () => {
    limpar(app);
    assert.doesNotMatch(app.vProjections(), /ana-chips/);
    assert.equal(app.anaChips({ id: 'x', valor: '', aplicar: 'f', limpar: 'g()', dos: 'de x' }), '');
    assert.equal(app.anaChips({ id: 'x', valor: '', aplicar: 'f', limpar: 'g()', dos: 'de x', acoes: '<b>A</b>' }), '<div class="ana-topo"><b>A</b></div>');
  });
});

describe('a roda dentada no cabeçalho', () => {
  beforeEach(semear);

  test('nas Projeções e na Avaliação o botão é a roda, com o nome das opções, que abre um diálogo', () => {
    const hb = cabecalho();
    for (const [t, nome] of [['projections', 'Opções da projeção'], ['reports', 'Opções da avaliação']]) {
      app.tab = t;
      app.pintarBotaoFiltros();
      assert.equal(hb.innerHTML, app.ic('roda', 18), t + ': a roda, sem o ponto dos filtros');
      assert.equal(hb.atr['aria-label'], nome);
      assert.equal(hb.title, nome);
      assert.equal(hb.atr['aria-haspopup'], 'dialog');
      assert.ok(!('aria-expanded' in hb.atr), 'abre uma janela, não um painel: não diz aberto nem fechado');
      assert.ok(!hb.cls.has('primary'), 'nunca acende');
      assert.notEqual(hb.style.display, 'none');
    }
  });

  test('com um filtro posto, a roda continua sem o ponto: o chip já o mostra na página', () => {
    const hb = cabecalho();
    app.projProp = 'p1';
    app.tab = 'projections';
    assert.equal(app.hdrFiltN(), 1, 'a contagem continua a contar');
    app.pintarBotaoFiltros();
    assert.doesNotMatch(hb.innerHTML, /class="dot"/);
  });

  test('ao sair para a Visão geral, o funil volta e a roda despe o que vestiu', () => {
    const hb = cabecalho();
    app.tab = 'reports';
    app.pintarBotaoFiltros();
    app.tab = 'dashboard';
    app.pintarBotaoFiltros();
    assert.match(hb.innerHTML, /^<svg/);
    assert.notEqual(hb.innerHTML, app.ic('roda', 18));
    assert.ok(!('aria-haspopup' in hb.atr) && !('aria-label' in hb.atr));
    assert.equal(hb.title, 'Filtros e parâmetros');
    assert.equal(hb.atr['aria-expanded'], 'false', 'o painel da visão geral diz aberto ou fechado, como dantes');
  });

  test('o nome fica escrito logo, e volta depois da cadeia dos embrulhos, onde a seleção vinda de uma lista o tira', async () => {
    const hb = cabecalho();
    app.tab = 'projections';
    app.pintarBotaoFiltros();
    assert.equal(hb.title, 'Opções da projeção');
    assert.equal(hb.atr['aria-label'], 'Opções da projeção');
    // o que a camada da seleção faz a seguir, vinda dos Imóveis (cloud/selecao-listas.js:selLCabecalho)
    hb.title = 'Filtros e parâmetros'; hb.removeAttribute('aria-label');
    await Promise.resolve();
    assert.equal(hb.title, 'Opções da projeção');
    assert.equal(hb.atr['aria-label'], 'Opções da projeção');
  });

  test('com o serviço desligado não há botão', () => {
    const hb = cabecalho();
    app.definirServicosDesligados(['projections']);
    try {
      app.tab = 'projections';
      app.pintarBotaoFiltros();
      assert.equal(hb.style.display, 'none');
    } finally { app.definirServicosDesligados([]); }
  });

  test('a Visão geral e a Declaração ficam com o funil e o painel de sempre', () => {
    const hb = cabecalho();
    for (const t of ['dashboard', 'fisco']) {
      app.tab = t;
      app.pintarBotaoFiltros();
      assert.notEqual(hb.innerHTML, app.ic('roda', 18), t);
      assert.ok(!('aria-haspopup' in hb.atr), t);
    }
    assert.deepEqual(Object.keys(app.ANA_RODA).sort(), ['projections', 'reports']);
    app.tab = 'dashboard';
    app.anaOpen.dashboard = true;
    assert.match(app.dashBar(), /class="fpanel on[^"]*"><div class="card fp-caixa">[\s\S]*id="sel_dashPropSel"[\s\S]*class="fp-pe"/);
  });
});

describe('a janela das opções', () => {
  beforeEach(semear);

  test('Projeções: o horizonte, o aumento e a inflação, com unidades, «Opcional» e só o «Fechar»', () => {
    let pintou = 0;
    app.render = () => { pintou++; };
    const j = abrirOpcoes('projections');
    assert.equal(j.titulo, 'Opções da projeção');
    assert.equal(pintou, 0, 'abrir não repinta a página');
    assert.ok(!app.anaOpen.projections, 'nem abre o painel da base');
    assert.match(j.corpo, /^<section class="card def-lista ana-opcoes" aria-label="Opções da projeção">/);
    for (const [id, k, un, v] of [['prjHorizonte', 'years', 'anos', '5'], ['prjAumento', 'growth', '%', '2'], ['prjInflacao', 'inflation', '%', '2']]) {
      assert.match(j.corpo, new RegExp(`<input id="${id}" type="text" inputmode="(numeric|decimal)" value="${v}" placeholder="Opcional" autocomplete="off" data-input="prjOpcao\\(this,'${k}'\\)" data-change="prjOpcao\\(this,'${k}',1\\)"><span class="def-unidade">${un}</span>`), id);
    }
    assert.match(j.corpo, /<b>Horizonte<\/b>[\s\S]*<b>Aumento das rendas<\/b>[\s\S]*<b>Inflação das despesas<\/b>/);
    assert.match(j.corpo, /Em branco: 1 ano, e 0 % de aumento e de inflação\./);
    assert.equal(j.pe, '<button type="button" class="btn primary" data-toca="camada" data-click="closeModal()">Fechar</button>');
  });

  test('Avaliação: o yield exigido', () => {
    const j = abrirOpcoes('reports');
    assert.equal(j.titulo, 'Opções da avaliação');
    assert.match(j.corpo, /<b>Yield exigido<\/b>[\s\S]*<input id="avaYield" type="text" inputmode="decimal" value="5" placeholder="Opcional"[^>]*><span class="def-unidade">%<\/span>/);
    assert.match(j.corpo, /em branco volta aos 5 %/);
  });

  test('mudar o horizonte grava ao escrever, muda a projeção e, ao sair, o campo diz o que ficou', async () => {
    let pintou = 0;
    app.render = () => { pintou++; };
    const c = campo('3');
    app.prjOpcao(c, 'years');
    assert.equal(app.db.settings.years, 3);
    assert.equal(c.value, '3');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(pintou, 1, 'a projeção por trás redesenha-se');
    assert.equal(app.projRows(null).rows.length, 3, 'e passa a ter três anos');
    assert.equal((app.vProjections().match(/<tr><td><b>20\d\d<\/b><\/td>/g) || []).length, 3, 'a tabela também');
    app.prjOpcao(c, 'years');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(pintou, 1, 'o mesmo valor não redesenha');
    c.value = '';
    app.prjOpcao(c, 'years');
    assert.equal(app.db.settings.years, 1, 'em branco é 1 ano');
    assert.equal(c.value, '', 'a escrever, o campo fica como está');
    app.prjOpcao(c, 'years', 1);
    assert.equal(c.value, '1', 'ao sair, diz o que ficou gravado');
    c.value = '45';
    app.prjOpcao(c, 'years', 1);
    assert.equal(app.db.settings.years, 30);
    assert.equal(c.value, '30');
  });

  test('o aumento e a inflação aceitam a vírgula; um nome desconhecido não grava nada', () => {
    app.render = () => {};
    const c = campo('2,5');
    app.prjOpcao(c, 'growth', 1);
    assert.equal(app.db.settings.growth, 2.5);
    assert.equal(c.value, app.dec(2.5));
    app.prjOpcao(campo(''), 'inflation');
    assert.equal(app.db.settings.inflation, 0);
    const antes = JSON.stringify(app.db.settings);
    app.prjOpcao(campo('9'), 'capTarget');
    app.prjOpcao(null, 'years');
    assert.equal(JSON.stringify(app.db.settings), antes);
  });

  test('o yield exigido grava ao escrever, e em branco volta aos 5 %', () => {
    app.render = () => {};
    const c = campo('6,5');
    app.avaOpcaoYield(c);
    assert.equal(app.db.settings.capTarget, 6.5);
    c.value = '';
    app.avaOpcaoYield(c, 1);
    assert.equal(app.db.settings.capTarget, 5);
    assert.equal(c.value, '5');
    c.value = '-3';
    app.avaOpcaoYield(c, 1);
    assert.equal(app.db.settings.capTarget, 0.1, 'nunca zero nem negativo');
  });

  test('depois de gravar, fechar pelo X não pergunta «Sair sem guardar?»: o retrato da janela é o de agora', () => {
    app.render = () => {};
    const inp = { type: 'text', value: '7' };
    const L = { el: { querySelectorAll: () => [inp] }, snap: '5', tocado: true };
    app.modalStack.push(L);
    try {
      app.avaOpcaoYield(inp);
      assert.equal(L.snap, app.modalSnap(L.el));
      assert.equal(L.snap, '7');
    } finally { app.modalStack.pop(); }
  });
});

describe('a folha', () => {
  test('a secção da folha: as ações à direita na linha dos chips, e o nome comprido com reticências', () => {
    const i = css.indexOf('/* ===== ajustes-v40c: 1.5'), f = css.indexOf('/* ===== fim: ajustes-v40c 1.5 ===== */');
    assert.ok(i > -1 && f > i, 'a secção existe');
    const sec = css.slice(i, f);
    assert.match(sec, /\.ana-topo\{display:flex;flex-wrap:wrap;/);
    assert.match(sec, /\.ana-topo>\.ana-acoes\{margin-left:auto\}/);
    assert.match(sec, /\.ana-chips \.mov-chip \.selbtn span\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
    assert.doesNotMatch(sec, /#[0-9a-f]{3,6}\b|rgb\(/i, 'cores só por tokens');
  });
});
