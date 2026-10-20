// As listas filtram como os Movimentos (vistas.js:lfCabeca): a pesquisa
// sempre à vista com o funil ao lado, que conta os filtros ligados e abre o
// painel completo; os chips rápidos, cada um um seletor com o × que o limpa,
// e o «Limpar»; o painel com o «Limpar» e o «Fechar» no topo, a linha
// «Aplicam-se ao mexer · N imóveis» e a grelha, com a ordenação. A pesquisa
// escreve no lf(k).q e a via parcial guarda o nó da barra. Os Imóveis e os
// Contratos usam-no; o botão do cabeçalho dos dois é o «Selecionar vários»,
// que entra na seleção de vários sem nada marcado; as análises continuam com
// o painel do pé (vistas.js:fpanelPe).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, carregarTudo, limpar, repor, elementos } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
const nuvem = carregarTudo();
afterEach(() => repor(nuvem));
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
const ANO = new Date().getFullYear();

/* Dois proprietários, dois imóveis (um arrendado, um de uso próprio), um
   inquilino e dois contratos (um em vigor, um terminado), e os filtros das
   listas a zero.
   Recebe: a — o proxy da app.
   Devolve: nada — enche o db. */
function semear(a) {
  const db = limpar(a);
  for (const k of Object.keys(a.listF)) delete a.listF[k];
  db.owners.push(a.normPerson({ id: 'o1', name: 'Ana Dona' }), a.normPerson({ id: 'o2', name: 'Pedro Dono' }));
  db.tenants.push(a.normPerson({ id: 't1', name: 'Rui Inquilino' }));
  db.properties.push(a.normProp({ id: 'p1', name: 'T2 Lisboa', address: 'Rua do Mar 1', use: 'investimento', rentalMode: 'inteiro', ownerIds: ['o1'], value: 200000 }));
  db.properties.push(a.normProp({ id: 'p2', name: 'Casa do Campo', address: 'Estrada 2', use: 'proprio', ownerIds: ['o2'], value: 90000 }));
  db.contracts.push(a.normContract({ id: 'c1', name: 'Arrendamento', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.contracts.push(a.normContract({ id: 'c2', name: 'Antigo', propertyId: 'p1', tenantIds: ['t1'], rent: 700, start: (ANO - 4) + '-01-01', end: (ANO - 3) + '-12-31', active: false }));
}

/* Um campo de exemplo para o componente, com a chave, o nome e três escolhas.
   Recebe: o (opcional) — o que mudar no campo.
   Devolve: o campo. */
function campo(o) {
  return Object.assign({ chave: 'st', nome: 'Estado', curto: 'Todos', rapido: true,
    opcoes: [{ v: '', label: 'Todos os estados' }, { v: 'vago', label: 'Vagos', n: 2 }, { v: 'arrendado', label: 'Arrendados', n: 1 }] }, o || {});
}

describe('o componente: a barra, os chips e o painel', () => {
  beforeEach(() => semear(app));

  test('a barra tem a pesquisa à vista e o funil com quantos filtros estão ligados; depois vêm o painel e os chips', () => {
    const h = app.lfCabeca('lprops', { nome: ['imóvel', 'imóveis'], dos: 'dos imóveis', n: 2, campos: [campo()] });
    assert.match(h, /^<div class="mov-barra lfm-barra">\s*<label class="mov-busca"><span class="mov-lupa" aria-hidden="true"><\/span>/);
    assert.match(h, /<input id="lq_lprops" type="search" value="" placeholder="Pesquisar…" aria-label="Pesquisar imóveis: palavras soltas ou uma frase entre aspas"[^>]*data-input="lfSearch\('lprops',this\.value\);lqMostrarLimpar\(this\)">/);
    assert.match(h, /<button type="button" class="qclear u-d-none" aria-label="Limpar a pesquisa" data-toca="vista" data-click="lqLimpar\(this,'lprops'\)"><svg/, 'o ✕ é o ícone da casa, com nome');
    assert.match(h, /<button type="button" class="btn so-icone mov-filt" id="lfb_lprops" aria-expanded="false" aria-controls="lfp_lprops"\s+aria-label="Filtros" data-toca="vista" data-click="lfToggle\('lprops'\)">/);
    assert.ok(h.indexOf('lfm-barra') < h.indexOf('mov-fwrap') && h.indexOf('mov-fwrap') < h.indexOf('mov-chips'), 'a barra, o painel, os chips');
    app.lf('lprops').st = 'vago';
    app.lf('lprops')._open = true;
    const l = app.lfCabeca('lprops', { nome: ['imóvel', 'imóveis'], n: 2, campos: [campo()] });
    assert.match(l, /class="btn so-icone mov-filt on" id="lfb_lprops" aria-expanded="true"[\s\S]*?aria-label="Filtros: 1 ativo"[\s\S]*?<span class="mov-filt-n" aria-hidden="true">1<\/span><\/button>/);
  });

  test('o funil conta os filtros sem a pesquisa, que está à vista ao lado', () => {
    app.lf('lprops').q = 'mar';
    assert.equal(app.lfNFiltros('lprops'), 0);
    assert.equal(app.lfCount('lprops'), 1, 'o ponto do cabeçalho continua a contar a pesquisa');
    const h = app.lfBarraHtml('lprops', { nome: ['imóvel', 'imóveis'] });
    assert.match(h, /value="mar"/);
    assert.match(h, /class="qclear" aria-label="Limpar a pesquisa"/, 'com texto, o ✕ vê-se');
    assert.doesNotMatch(h, /mov-filt-n/);
    app.lf('lprops').md = 'quartos';
    assert.equal(app.lfNFiltros('lprops'), 1);
  });

  test('um chip desligado diz o nome e abre a escolha; ligado diz o valor, veste o cobalto e leva o × que o limpa', () => {
    const cs = app.lfCampos('lprops', { campos: [campo()] });
    let h = app.lfChip('lprops', cs[0]);
    assert.match(h, /^<span class="mov-chip"><div class="sel" id="sel_lfc_lprops_st">/);
    assert.match(h, /class="selbtn" aria-label="Estado" id="selb_lfc_lprops_st"[^>]*><span id="lab_lfc_lprops_st">Estado<\/span>/);
    assert.match(h, /<span>Vagos · 2<\/span>/, 'a escolha diz quantos há');
    assert.doesNotMatch(h, /mov-chip-x/);
    app.lf('lprops').st = 'vago';
    h = app.lfChip('lprops', cs[0]);
    assert.match(h, /^<span class="mov-chip on">/);
    assert.match(h, /aria-label="Estado: Vagos"[^>]*><span id="lab_lfc_lprops_st">Vagos<\/span>/, 'o valor sem a contagem, e o nome uma vez para o leitor de ecrã');
    assert.match(h, /<button type="button" class="mov-chip-x" aria-label="Limpar estado" data-toca="vista" data-click="lfLimparCampo\('lprops','st'\)"><svg/);
    let pintou = 0;
    app.render = () => { pintou++; };
    app.lfLimparCampo('lprops', 'st');
    assert.equal(app.lf('lprops').st, '', 'o × limpa só esse');
    assert.equal(pintou, 1);
  });

  test('o chip só do ecrã largo, e o «Limpar» da fila: no telemóvel sai quando a única coisa ligada já tem o seu ×', () => {
    const o = { dos: 'dos imóveis', campos: [campo(), campo({ chave: 'md', nome: 'Arrendamento', rapido: 'largo' }), campo({ chave: 'g', nome: 'Grupo', rapido: false })] };
    let h = app.lfChipsHtml('lprops', o, app.lfCampos('lprops', o));
    assert.match(h, /^<div class="chips-fila mov-chips" role="group" aria-label="Filtros dos imóveis">/);
    assert.match(h, /<span class="mov-chip mov-so-largo"><div class="sel" id="sel_lfc_lprops_md">/, 'desligado, só no ecrã largo');
    assert.doesNotMatch(h, /lfc_lprops_g/, 'o que não é rápido fica só no painel');
    assert.doesNotMatch(h, /chip limpar/, 'sem filtros não há «Limpar»');
    app.lf('lprops').md = 'quartos';
    h = app.lfChipsHtml('lprops', o, app.lfCampos('lprops', o));
    assert.match(h, /<span class="mov-chip on"><div class="sel" id="sel_lfc_lprops_md">/, 'ligado, em todos os ecrãs');
    assert.match(h, /<button type="button" class="chip limpar mov-so-largo" data-toca="vista" data-click="lfClear\('lprops'\)">Limpar<\/button>/, 'um só, com o seu ×');
    app.lf('lprops').q = 'mar';
    h = app.lfChipsHtml('lprops', o, app.lfCampos('lprops', o));
    assert.match(h, /<button type="button" class="chip limpar" data-toca="vista"/, 'dois: o «Limpar» em todos os ecrãs');
    app.lf('lprops').q = ''; app.lf('lprops').md = ''; app.lf('lprops').g = 'x';
    h = app.lfChipsHtml('lprops', o, app.lfCampos('lprops', o));
    assert.match(h, /<button type="button" class="chip limpar" data-toca="vista"/, 'um só, mas escondido no painel: o «Limpar» fica à vista');
  });

  test('o painel tem o «Limpar» e o «Fechar» no topo, a contagem e a grelha — e nenhum pé', () => {
    const o = { nome: ['imóvel', 'imóveis'], n: 1, campos: [campo()] };
    let h = app.lfPainelHtml('lprops', o, app.lfCampos('lprops', o));
    assert.match(h, /^<div class="fwrap u-h-0 mov-fwrap"><div class="fpanel  u-t-0" id="lfp_lprops" role="region" aria-labelledby="lft_lprops">\s*<div class="card mov-filtros-card lfm-caixa">/);
    assert.match(h, /<div class="mov-filtros-cab"><h2 class="mov-filtros-tit" id="lft_lprops">Filtros<\/h2>\s*<button type="button" class="btn" data-toca="camada" data-click="lfApply\('lprops'\)">Fechar<\/button><\/div>/, 'sem filtros, só o «Fechar»');
    assert.match(h, /<p class="small mov-filtros-n">Aplicam-se ao mexer · 1 imóvel<\/p>/);
    assert.ok(h.indexOf('mov-filtros-cab') < h.indexOf('mov-filtros-n') && h.indexOf('mov-filtros-n') < h.indexOf('mov-grelha'), 'a cabeça, a contagem, a grelha');
    assert.doesNotMatch(h, /fp-pe|fp-caixa/);
    app.lf('lprops').st = 'vago';
    o.n = 3;
    h = app.lfPainelHtml('lprops', o, app.lfCampos('lprops', o));
    assert.match(h, /<h2 class="mov-filtros-tit" id="lft_lprops">Filtros<\/h2>\s*<button type="button" class="btn ghost" data-toca="vista" data-click="lfClear\('lprops'\)">Limpar<\/button>\s*<button type="button" class="btn" data-toca="camada" data-click="lfApply\('lprops'\)">Fechar<\/button>/);
    assert.match(h, /Aplicam-se ao mexer · 3 imóveis/);
  });

  test('a grelha: o nome por cima, a opção vazia curta, o cobalto com o filtro posto, e a ordenação no fim com o sentido só depois de escolhida', () => {
    const o = { campos: [campo()], ordem: { opcoes: [{ v: 'nome', label: 'Nome' }, { v: 'renda', label: 'Renda' }] } };
    let cs = app.lfCampos('lprops', o);
    assert.deepEqual(cs.map((c) => c.chave), ['st', 'sb']);
    let g = app.lfCampoNaGrelha('lprops', cs[0]);
    assert.match(g, /^<label>Estado<div class="sel" id="sel_lfsel_lprops_st">/);
    assert.match(g, /<span id="lab_lfsel_lprops_st">Todos<\/span>/, 'na grelha o nome já está por cima');
    app.lf('lprops').st = 'vago';
    assert.match(app.lfCampoNaGrelha('lprops', cs[0]), /^<label class="mov-ligado">Estado/);
    assert.match(app.lfCampoNaGrelha('lprops', cs[1]), /^<label>Ordenar por[\s\S]*<span id="lab_lfsel_lprops_sb">Ordem original<\/span>/);
    app.lf('lprops').sb = 'renda';
    cs = app.lfCampos('lprops', o);
    assert.deepEqual(cs.map((c) => c.chave), ['st', 'sb', 'sd'], 'com a ordenação escolhida, o sentido');
    assert.equal(app.lfRotulo(cs[1], 'renda'), 'Ordenar: renda');
    assert.equal(app.lfCount('lprops'), 1, 'a ordenação não é um filtro');
    app.render = () => {};
    app.lf('lprops').sd = 'desc';
    app.lfMudar('lprops', 'sb', '');
    assert.equal(app.lf('lprops').sd, '', 'tirar a ordenação tira o sentido');
  });

  test('a pesquisa escreve no lf(k).q (com o atraso de sempre) e filtra a lista', async () => {
    app.tab = 'properties';
    elementos(app);
    app.lfSearch('lprops', 'campo');
    assert.equal(app.lf('lprops').q, undefined, 'ainda à espera');
    await new Promise((r) => setTimeout(r, 330));
    assert.equal(app.lf('lprops').q, 'campo');
    const h = app.vProperties();
    assert.match(h, /Casa do Campo/);
    assert.doesNotMatch(h, /T2 Lisboa/);
    assert.match(h, /<input id="lq_lprops" type="search" value="campo"/);
  });

  test('a via parcial guarda o nó vivo da barra e troca só o funil, quando mudou; com outra lista, não guarda nada', () => {
    const no = (id, funil) => {
      const f = { outerHTML: funil, trocadoPor: null, replaceWith(x) { this.trocadoPor = x; } };
      return { classList: { contains: (c) => c === 'lfm-barra' }, querySelector: (s) => (s === 'input' ? { id } : s === '.mov-filt' ? f : null), funil: f };
    };
    const vivo = no('lq_lprops', '<button>0</button>'), novo = no('lq_lprops', '<button>1</button>');
    const r = app.lfBarraViva({ children: [{ classList: { contains: () => false } }, vivo] }, { children: [novo] });
    assert.equal(r.vivo, vivo);
    assert.equal(r.novo, novo);
    assert.equal(vivo.funil.trocadoPor, novo.funil, 'o funil conta outra coisa: troca-se');
    const igual = no('lq_lprops', '<button>1</button>');
    app.lfBarraViva({ children: [igual] }, { children: [no('lq_lprops', '<button>1</button>')] });
    assert.equal(igual.funil.trocadoPor, null, 'o mesmo funil fica');
    assert.equal(app.lfBarraViva({ children: [no('lq_lcts', '')] }, { children: [no('lq_lprops', '')] }), null);
    assert.equal(app.lfBarraViva({ children: [] }, { children: [novo] }), null);
  });

  test('«Limpar» tira os filtros e a pesquisa, deixa a ordenação e o painel, e nos imóveis larga o proprietário global', () => {
    app.render = () => {};
    Object.assign(app.lf('lprops'), { _open: true, st: 'vago', q: 'mar', own: 'o1', sb: 'renda', sd: 'desc' });
    app.ownerFilter = 'o1';
    app.lfClear('lprops');
    assert.deepEqual(JSON.parse(JSON.stringify(app.lf('lprops'))), { _open: true, sb: 'renda', sd: 'desc' });
    assert.equal(app.ownerFilter, '');
  });
});

describe('os Imóveis e os Contratos usam o componente', () => {
  beforeEach(() => semear(app));

  test('Imóveis: a pesquisa à vista, os chips do estado (com quantos) e do proprietário, o do arrendamento só no ecrã largo, e o painel com a ordenação', () => {
    const h = app.vProperties();
    assert.match(h, /^<div class="mov-barra lfm-barra">[\s\S]*id="lq_lprops"/);
    assert.match(h, /<div class="chips-fila mov-chips" role="group" aria-label="Filtros dos imóveis"><span class="mov-chip"><div class="sel" id="sel_lfc_lprops_st">/);
    assert.match(h, /<span>Todos os estados · 2<\/span>[\s\S]*?<span>Arrendados · 1<\/span>[\s\S]*?<span>Uso próprio · 1<\/span>/);
    assert.match(h, /<span class="mov-chip"><div class="sel" id="sel_lfc_lprops_own">/);
    assert.match(h, /<span class="mov-chip mov-so-largo"><div class="sel" id="sel_lfc_lprops_md">/);
    assert.match(h, /<label>Ordenar por<div class="sel" id="sel_lfsel_lprops_sb">/);
    assert.doesNotMatch(h, /imv-filtros|fp-caixa|fp-pe/, 'nem a fila antiga nem o pé');
    assert.match(h, /Aplicam-se ao mexer · 2 imóveis/);
  });

  test('Imóveis: o chip do proprietário é o filtro global, e escolher um espelha-o', () => {
    app.render = () => {};
    app.lfCabeca('lprops', { campos: [{ chave: 'own', nome: 'Proprietário', rapido: true, aplicar: app.imvFiltroDono, opcoes: [{ v: '', label: 'Todos' }] }] });
    app.lfMudar('lprops', 'own', 'o2');
    assert.equal(app.ownerFilter, 'o2');
    const h = app.vProperties();
    assert.match(h, /Casa do Campo/);
    assert.doesNotMatch(h, /T2 Lisboa/);
    assert.match(h, /<span class="mov-chip on"><div class="sel" id="sel_lfc_lprops_own">[\s\S]*?aria-label="Proprietário: Pedro Dono"/);
  });

  test('Contratos: a pesquisa à vista, o estado com as contagens, o imóvel e a ordenação no ecrã largo; sem o «Selecionar» na fila', () => {
    app.db.properties.push(app.normProp({ id: 'p3', name: 'T1 Porto', use: 'investimento', ownerIds: ['o1'] }));
    app.db.contracts.push(app.normContract({ id: 'c3', propertyId: 'p3', tenantIds: ['t1'], rent: 500, start: (ANO - 1) + '-01-01', active: true }));
    const h = app.vContracts();
    assert.match(h, /^<div class="mov-barra lfm-barra">[\s\S]*id="lq_lcts"[^>]*aria-label="Pesquisar contratos/);
    assert.match(h, /aria-label="Filtros dos contratos"><span class="mov-chip"><div class="sel" id="sel_lfc_lcts_st">/);
    assert.match(h, /<span>Em vigor · 2<\/span>[\s\S]*?<span>Terminados · 1<\/span>/);
    assert.match(h, /<span class="mov-chip"><div class="sel" id="sel_lfc_lcts_p">/, 'com mais de um imóvel com contratos, o chip do imóvel');
    assert.match(h, /<span class="mov-chip mov-so-largo"><div class="sel" id="sel_lfc_lcts_sb">/);
    assert.doesNotMatch(h, /ct-selecionar|ct-filtros|fp-pe/);
    app.render = () => {};
    app.lfMudar('lcts', 'st', 'off');
    assert.equal(app.lf('lcts').st, 'off', 'o estado aplica-se pelo ctFiltroRapido');
    assert.equal((app.vContracts().match(/class="ct-linha"/g) || []).length, 1);
  });

  test('as análises continuam com o painel de sempre, com o pé', () => {
    app.tab = 'dashboard';
    app.anaOpen.dashboard = true;
    const h = app.anaPanel('<p>x</p>');
    assert.match(h, /class="card fp-caixa"/);
    assert.match(h, /<div class="fp-pe">[\s\S]*anaClear\(\)[\s\S]*anaApply\(\)/);
    assert.doesNotMatch(h, /mov-filtros|lfm-/);
  });
});

describe('o cabeçalho dos Imóveis e dos Contratos é o «Selecionar vários»', () => {
  /* O #hdrFilt com classes, atributos e estilo que se leem, e um #view com
     um cartão do tipo (ou sem nenhum).
     Recebe: tipo — 'prop', 'ct' ou '' (sem cartões).
     Devolve: o botão falso. */
  function cabecalho(tipo) {
    const hb = nuvem.document.getElementById('hdrFilt');
    const cls = new Set(), atr = {};
    hb.classList = { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, v) => (v === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : v ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) };
    hb.setAttribute = (k, v) => { atr[k] = String(v); };
    hb.getAttribute = (k) => (k in atr ? atr[k] : null);
    hb.removeAttribute = (k) => { delete atr[k]; };
    hb.atr = atr; hb.cls = cls;
    nuvem.document.querySelector = (s) => (tipo && s === '#view [data-lp^="' + tipo + ':"]' ? {} : null);
    return hb;
  }
  beforeEach(() => { semear(nuvem); nuvem.CW.selL = { tipo: null, ids: {} }; });

  test('nos Imóveis: o visto, o nome «Selecionar vários», sem aria-expanded nem aceso; some sem cartões', () => {
    const hb = cabecalho('prop');
    nuvem.tab = 'properties';
    nuvem.pintarBotaoFiltros();
    assert.equal(hb.atr['aria-expanded'], 'false', 'a base pinta o funil');
    nuvem.patchHdrSel();
    assert.ok(hb.cls.has('lst-hdr-sel'));
    assert.ok(!hb.cls.has('primary'));
    assert.equal(hb.title, 'Selecionar vários');
    assert.equal(hb.atr['aria-label'], 'Selecionar vários');
    assert.ok(!('aria-expanded' in hb.atr), 'não é um painel: não diz aberto nem fechado');
    assert.match(hb.innerHTML, /^<svg/);
    assert.equal(hb.style.display, '');
    cabecalho('');
    nuvem.CW.selCabecalho();
    assert.equal(nuvem.document.getElementById('hdrFilt').style.display, 'none', 'sem cartões não há o que marcar');
  });

  test('o «Selecionar vários» entra na seleção sem nada marcado, e de lá sai; nos Contratos o mesmo', () => {
    cabecalho('prop');
    nuvem.tab = 'properties';
    nuvem.hdrFiltToggle();
    assert.equal(nuvem.CW.selL.tipo, 'prop');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), [], 'nada marcado: o toque a seguir marca');
    nuvem.hdrFiltToggle();
    assert.equal(nuvem.CW.selL.tipo, null);
    cabecalho('ct');
    nuvem.tab = 'contracts';
    nuvem.hdrFiltToggle();
    assert.equal(nuvem.CW.selL.tipo, 'ct');
    nuvem.CW.selLSair();
    assert.equal(nuvem.lf('lcts')._open, undefined, 'o painel dos filtros não se mexeu');
  });

  test('em seleção, a caixa de tudo do cabeçalho marca os cartões à vista e conta-os; com todos marcados, desmarca', () => {
    const marcas = {};
    const cartao = (id) => ({ getAttribute: () => 'prop:' + id, querySelector: () => null, classList: { toggle: (c, v) => { marcas[id] = v; } } });
    const cartoes = [cartao('p1'), cartao('p2')];
    nuvem.document.querySelectorAll = (s) => (s === '#view [data-lp^="prop:"]' ? cartoes : []);
    const tudo = nuvem.document.getElementById('selLTudo'), conta = nuvem.document.getElementById('selLCabConta');
    const atr = {};
    tudo.setAttribute = (k, v) => { atr[k] = v; };
    nuvem.CW.selL = { tipo: 'prop', ids: { p1: 1 } };
    nuvem.selLPintar();
    assert.equal(atr['aria-checked'], 'mixed', 'parte marcada, a caixa a meio');
    assert.equal(conta.textContent, '1 imóvel');
    nuvem.CW.selLTodos();
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids).sort(), ['p1', 'p2']);
    assert.equal(atr['aria-checked'], 'true');
    assert.equal(conta.textContent, '2 imóveis');
    assert.deepEqual(marcas, { p1: true, p2: true });
    nuvem.CW.selLTodos();
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), [], 'todos marcados: a caixa desmarca');
    assert.equal(conta.textContent, 'nenhum imóvel');
    nuvem.CW.selL = { tipo: null, ids: {} };
  });

  test('noutro separador o botão volta a ser de quem o pinta; nos Movimentos continua o deles; a folha esconde-o em seleção', () => {
    const hb = cabecalho('prop');
    nuvem.tab = 'properties';
    nuvem.patchHdrSel();
    assert.ok(hb.cls.has('lst-hdr-sel'));
    nuvem.tab = 'dashboard';
    nuvem.patchHdrSel();
    assert.ok(!hb.cls.has('lst-hdr-sel'));
    assert.ok(!('aria-label' in hb.atr));
    nuvem.tab = 'transactions';
    nuvem.patchHdrSel();
    assert.ok(hb.cls.has('mov-hdr-sel') && !hb.cls.has('lst-hdr-sel'));
    nuvem.tab = 'dashboard';
    nuvem.patchHdrSel();
    assert.match(css, /body\.sel-on #hdrFilt\.lst-hdr-sel\{display:none\}/);
    assert.match(css, /@media\(min-width:1100px\)\{\s*body\.sel-on \.sel-cab\.lst-sel-cab\{display:flex\}/, 'no ecrã largo a caixa de tudo fica, que estas listas não têm caixas na tabela');
  });
});
