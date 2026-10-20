// As outras listas filtram como os Movimentos (vistas.js:lfCabeca): os
// Inquilinos, os Proprietários, as Visitas, os Planeados e os Créditos têm a
// pesquisa à vista com o funil ao lado, os chips rápidos (cada um um seletor
// com o × que o limpa, com quantos há em cada escolha) e o painel com o
// «Limpar» e o «Fechar» no topo. Nenhuma lista fica com o painel antigo do
// pé, e nestas cinco o botão do cabeçalho sai (não há seleção de vários). Os
// chips de estado próprios dos Planeados e dos Créditos passaram a ser o
// campo do estado, o mesmo lf(k).st; as visitas têm os intervalos de dia e
// de hora na grelha, que contam como um filtro cada, e o «Dias e horas» que
// leva até eles.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, elementos, igual } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
const ANO = new Date().getFullYear();

/* Dois proprietários, dois imóveis (um com hipoteca viva e uma liquidada,
   outro com uma viva), três inquilinos (um com contrato em vigor, um por
   começar, um sem), três visitas, dois planeados (um da hipoteca, um à mão e
   silenciado) e um modelo; os filtros das listas a zero.
   Recebe: a — o proxy da app.
   Devolve: nada — enche o db. */
function semear(a) {
  const db = limpar(a);
  for (const k of Object.keys(a.listF)) delete a.listF[k];
  a.credSel = ''; a.credPagas = false;
  const hoje = a.pzHoje();
  db.owners.push(a.normPerson({ id: 'o1', name: 'Ana Dona' }), a.normPerson({ id: 'o2', name: 'Pedro Dono' }));
  const viva = a.normLoan({ id: 'l1', name: 'Aquisição', bank: 'Banco Azul', outstanding: 50000, years: 20, type: 'fixa', rate: 3, start: '2020-01-10' });
  const paga = a.normLoan({ id: 'l2', name: 'Obras', bank: 'Banco Verde', outstanding: 0, years: 5, type: 'fixa', rate: 4, start: '2015-01-10' });
  const outra = a.normLoan({ id: 'l3', name: 'Casa do campo', bank: 'Banco Azul', outstanding: 30000, years: 15, type: 'variavel', rate: 3, start: '2021-01-10' });
  db.properties.push(a.normProp({ id: 'p1', name: 'T2 Lisboa', use: 'investimento', rentalMode: 'inteiro', ownerIds: ['o1'], value: 200000, loans: [viva, paga] }));
  db.properties.push(a.normProp({ id: 'p2', name: 'Casa do Campo', use: 'proprio', ownerIds: ['o1'], value: 90000, loans: [outra] }));
  db.tenants.push(a.normPerson({ id: 't1', name: 'Rui Inquilino' }), a.normPerson({ id: 't2', name: 'Sofia Lopes' }), a.normPerson({ id: 't3', name: 'Marta Silva' }));
  db.contracts.push(a.normContract({ id: 'c1', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.contracts.push(a.normContract({ id: 'c2', propertyId: 'p1', tenantIds: ['t2'], rent: 750, start: (ANO + 2) + '-01-01', active: true }));
  db.visits.push(a.normVisit({ id: 'v1', nomes: 'Bruno', propertyId: 'p1', date: hoje, start: '15:00' }));
  db.visits.push(a.normVisit({ id: 'v2', nomes: 'Carla', propertyId: 'p1', date: '2999-01-01', start: '19:00' }));
  db.visits.push(a.normVisit({ id: 'v3', nomes: 'Duarte', propertyId: 'p1', date: '2001-01-01', start: '10:00', estado: 'realizada', resultado: 'interessado' }));
  db.recurring.push(a.normRec({ id: 'r1', name: 'Prestação', every: 'month', next: '2999-01-05', auto: true, tx: { kind: 'loan', label: 'Prestação', amount: 300, propertyId: 'p1' } }));
  db.recurring.push(a.normRec({ id: 'r2', name: 'Limpeza', every: 'month', next: '2999-01-05', muted: true, tx: { kind: 'expense', label: 'Limpeza', amount: 30, propertyId: 'p1' } }));
  db.templates.push(a.normTpl({ id: 'm1', name: 'Luz', tx: { kind: 'expense', label: 'Luz', amount: 40, propertyId: 'p1' } }));
}

// as cinco listas desta passagem: o separador, a chave do estado e a vista
const LISTAS = [['tenants', 'lten', 'vTenants'], ['owners', 'lown', 'vOwners'], ['visits', 'lvis', 'vVisits'], ['recurring', 'lrec', 'vRecurring'], ['credits', 'lcred', 'vCredits']];

describe('as cinco listas usam o componente dos Movimentos', () => {
  beforeEach(() => semear(app));

  test('cada uma tem a pesquisa à vista com o funil, o painel com o «Limpar» e o «Fechar» no topo e a contagem, e nenhum pé', () => {
    const nomes = { lten: 'inquilinos', lown: 'proprietários', lvis: 'visitas', lrec: 'planeados', lcred: 'hipotecas' };
    for (const [, k, v] of LISTAS) {
      const h = app[v]();
      assert.match(h, new RegExp('<div class="mov-barra lfm-barra">\\s*<label class="mov-busca">[\\s\\S]*?<input id="lq_' + k + '" type="search"[^>]*aria-label="Pesquisar ' + nomes[k] + ': '), k + ': a pesquisa à vista');
      assert.match(h, new RegExp('id="lfb_' + k + '" aria-expanded="false" aria-controls="lfp_' + k + '"[\\s\\S]*?data-click="lfToggle\\(\'' + k + '\'\\)"'), k + ': o funil');
      assert.match(h, new RegExp('<div class="mov-filtros-cab"><h2 class="mov-filtros-tit" id="lft_' + k + '">Filtros</h2>[\\s\\S]*?data-click="lfApply\\(\'' + k + '\'\\)">Fechar</button></div>\\s*<p class="small mov-filtros-n">Aplicam-se ao mexer · \\d+ ' + nomes[k] + '</p>'), k + ': o painel');
      assert.match(h, new RegExp('<div class="chips-fila mov-chips" role="group" aria-label="Filtros d'), k + ': os chips');
      assert.doesNotMatch(h, /fp-caixa|fp-pe|class="qwrap"/, k + ': nem o pé nem a pesquisa dentro do painel');
    }
  });

  test('o render de cada separador pinta o painel aberto no feitio dos Movimentos, e o funil abre-o e fecha-o', () => {
    const fixos = elementos(app);
    for (const [t, k] of LISTAS) {
      app.fecharFiltros();
      app.tab = t;
      app.lfToggle(k);
      assert.equal(app.lf(k)._open, true, t);
      assert.match(fixos.view.innerHTML, new RegExp('class="fpanel on[^"]*" id="lfp_' + k + '"[^>]*>\\s*<div class="card mov-filtros-card lfm-caixa">'), t + ': aberto');
      assert.match(fixos.view.innerHTML, new RegExp('id="lfb_' + k + '" aria-expanded="true"'), t + ': o funil diz que abriu');
      app.lfApply(k);
      assert.equal(app.lf(k)._open, false, t + ': o «Fechar» fecha');
    }
  });

  test('sem registos não há barra: fica o vazio com o seu botão', () => {
    app.db.tenants.length = 0; app.db.owners.length = 0; app.db.visits.length = 0; app.db.recurring.length = 0; app.db.templates.length = 0;
    for (const p of app.db.properties) p.loans = [];
    for (const [, k, v] of LISTAS) assert.doesNotMatch(app[v](), new RegExp('lq_' + k + '|lfm-barra'), v);
  });

  test('a pesquisa escreve no lf(k).q e filtra: nos inquilinos, nas visitas, nos planeados e nos créditos', () => {
    app.lf('lten').q = 'sofia';
    assert.deepEqual([...app.vTenants().matchAll(/data-lp="per:tenant:(\w+)"/g)].map((m) => m[1]), ['t2']);
    app.lf('lvis').q = 'carla';
    assert.deepEqual([...app.vVisits().matchAll(/data-lp="vis:(\w+)"/g)].map((m) => m[1]), ['v2']);
    app.lf('lrec').q = 'limpeza';
    assert.deepEqual([...app.vRecurring().matchAll(/data-lp="rec:(\w+)"/g)].map((m) => m[1]), ['r2']);
    app.lf('lcred').q = 'verde';
    const h = app.vCredits();
    assert.match(h, /<input id="lq_lcred" type="search" value="verde"/);
    assert.match(h, /mort:p1:l2/);
    assert.doesNotMatch(h, /mort:p1:l1|mort:p2:l3/);
  });
});

describe('o botão do cabeçalho sai destas listas', () => {
  beforeEach(() => semear(app));

  test('pintarBotaoFiltros esconde-o nas cinco e deixa-o nos Imóveis, nos Contratos, nos Movimentos e na análise', () => {
    const hb = elementos(app).hdrFilt;
    for (const [t] of LISTAS) {
      app.tab = t;
      app.pintarBotaoFiltros();
      assert.equal(hb.style.display, 'none', t);
    }
    for (const t of ['properties', 'contracts', 'transactions', 'dashboard']) {
      app.tab = t;
      app.pintarBotaoFiltros();
      assert.notEqual(hb.style.display, 'none', t);
    }
    assert.deepEqual([...app.LF_COM_CABECALHO], ['properties', 'contracts'], 'as listas com a seleção de vários');
  });
});

describe('as pessoas', () => {
  beforeEach(() => semear(app));

  test('inquilinos: o chip do contrato, com quantos há em cada escolha; ligado diz o valor curto e o × limpa-o', () => {
    let h = app.vTenants();
    assert.match(h, /aria-label="Filtros dos inquilinos"><span class="mov-chip"><div class="sel" id="sel_lfc_lten_ct">[\s\S]*?<span id="lab_lfc_lten_ct">Contrato<\/span>/);
    assert.match(h, /id="pop_lfc_lten_ct"[\s\S]*?<span>Com contrato ativo · 1<\/span>[\s\S]*?<span>Com contrato por começar · 1<\/span>[\s\S]*?<span>Sem contrato · 1<\/span>/);
    assert.match(h, /<span class="mov-chip mov-so-largo"><div class="sel" id="sel_lfc_lten_sb">/, 'a ordenação, só no ecrã largo');
    app.render = () => {};
    app.lfMudar('lten', 'ct', 'fut');
    assert.equal(app.lf('lten').ct, 'fut', 'aplica pelo pesFiltroRapido');
    h = app.vTenants();
    assert.deepEqual([...h.matchAll(/data-lp="per:tenant:(\w+)"/g)].map((m) => m[1]), ['t2']);
    assert.match(h, /<span class="mov-chip on"><div class="sel" id="sel_lfc_lten_ct">[\s\S]*?aria-label="Contrato: Por começar"[\s\S]*?<span id="lab_lfc_lten_ct">Por começar<\/span>/);
    assert.match(h, /<button type="button" class="mov-chip-x" aria-label="Limpar contrato" data-toca="vista" data-click="lfLimparCampo\('lten','ct'\)">/);
    assert.match(h, /aria-label="Filtros: 1 ativo"/, 'o funil conta-o');
    app.lfLimparCampo('lten', 'ct');
    assert.equal(app.lf('lten').ct, '');
  });

  test('proprietários: o chip dos imóveis e, no ecrã largo, o do imóvel de que é dono, que filtra', () => {
    let h = app.vOwners();
    assert.match(h, /id="pop_lfc_lown_pr"[\s\S]*?<span>Com imóveis · 1<\/span>[\s\S]*?<span>Sem imóveis · 1<\/span>/);
    assert.match(h, /<span class="mov-chip mov-so-largo"><div class="sel" id="sel_lfc_lown_p">/);
    app.lf('lown').p = 'p2';
    h = app.vOwners();
    assert.deepEqual([...h.matchAll(/data-lp="per:owner:(\w+)"/g)].map((m) => m[1]), ['o1']);
    assert.match(h, /<span class="mov-chip on"><div class="sel" id="sel_lfc_lown_p">[\s\S]*?aria-label="Dono de Casa do Campo"[\s\S]*?<span id="lab_lfc_lown_p">Dono de Casa do Campo<\/span>/, 'ligado, em todos os ecrãs, e diz de que é dono (o nome uma vez só)');
    assert.match(h, /<label class="mov-ligado">Dono de<div class="sel" id="sel_lfsel_lown_p">/, 'na grelha, com o cobalto');
  });
});

describe('as visitas', () => {
  beforeEach(() => semear(app));

  test('os intervalos estão na grelha, aplicam ao mudar, e o «de» e o «até» contam como um filtro', () => {
    let h = app.vVisits();
    assert.match(h, /<label>Dia — de<input id="lfi_lvis_d1" type="date" value="" data-change="lfMudar\('lvis','d1',this\.value\)"><\/label>/);
    assert.match(h, /<label>Hora de início — até<input id="lfi_lvis_h2" type="time" value=""/);
    app.render = () => {};
    app.lfMudar('lvis', 'd1', '2990-01-01');
    app.lfMudar('lvis', 'd2', '2999-12-31');
    app.vVisits();
    assert.equal(app.lfNFiltros('lvis'), 1, 'um intervalo, um filtro');
    app.lfMudar('lvis', 'h1', '18:00');
    h = app.vVisits();
    assert.equal(app.lfNFiltros('lvis'), 2);
    assert.deepEqual([...h.matchAll(/data-lp="vis:(\w+)"/g)].map((m) => m[1]), ['v2']);
    assert.match(h, /<input id="lfi_lvis_d1" type="date" value="2990-01-01"/);
  });

  test('o «Dias e horas» abre o painel nos intervalos; ligado diz o intervalo e o × limpa os quatro', () => {
    const fixos = elementos(app);
    app.tab = 'visits';
    app.render();
    app.lfAbrirEm('lvis', 'lfi_lvis_d1');
    assert.equal(app.lf('lvis')._open, true);
    assert.match(fixos.view.innerHTML, /class="fpanel on[^"]*" id="lfp_lvis"/);
    app.lfAbrirEm('lvis', 'lfi_lvis_d1');
    assert.equal(app.lf('lvis')._open, true, 'já aberto, não fecha');
    app.lf('lvis').h1 = '18:00';
    const h = app.vVisits();
    assert.match(h, /<span class="mov-chip on lfm-chip-abre"><button type="button" class="mov-chip-txt" aria-label="Dias e horas: desde 18:00\. Mudar nos filtros" data-toca="vista" data-click="lfAbrirEm\('lvis','lfi_lvis_d1'\)">desde 18:00<\/button>/);
    assert.match(h, /<button type="button" class="chip limpar mov-so-largo" data-toca="vista" data-click="lfClear\('lvis'\)">Limpar<\/button>/, 'um só filtro, com o seu ×: o «Limpar» da fila só no ecrã largo');
  });
});

describe('os Planeados', () => {
  beforeEach(() => semear(app));

  test('o estado é um chip só (o lf(\'lrec\').st), com quantos há em cada escolha, e aplica pelo recChip', () => {
    const h = app.vRecurring();
    assert.doesNotMatch(h, /plan-chips|recChip\(/, 'a fila antiga saiu');
    assert.match(h, /aria-label="Filtros dos planeados"><span class="mov-chip"><div class="sel" id="sel_lfc_lrec_st">/);
    assert.match(h, /id="pop_lfc_lrec_st"[\s\S]*?<span>Todos os estados · 2<\/span>[\s\S]*?<span>Automáticos \(contratos, hipotecas e imóveis\) · 1<\/span>[\s\S]*?<span>Criados à mão · 1<\/span>[\s\S]*?<span>Silenciados · 1<\/span>[\s\S]*?<span>Por confirmar · 0<\/span>[\s\S]*?<span>Em dia · 2<\/span>/);
    assert.match(h, /<span class="mov-chip"><div class="sel" id="sel_lfc_lrec_k">/, 'o tipo');
    assert.match(h, /<span class="mov-chip mov-so-largo"><div class="sel" id="sel_lfc_lrec_p">/, 'o imóvel, no ecrã largo');
    let pintou = 0;
    app.render = () => { pintou++; };
    app.lfMudar('lrec', 'st', 'muted');
    assert.equal(app.lf('lrec').st, 'muted');
    assert.equal(pintou, 1);
    app.recChip('xpto');
    assert.equal(app.lf('lrec').st, '', 'um valor que não é um estado limpa o filtro');
  });

  test('os filtros ficam por cima do que filtram: depois do cartão dos por confirmar, antes da lista; com um estado os Modelos saem', () => {
    let h = app.vRecurring();
    assert.ok(h.indexOf('lfm-barra') < h.indexOf('plan-lista') && h.indexOf('plan-lista') < h.indexOf('<h2>Modelos</h2>'));
    app.lf('lrec').st = 'muted';
    h = app.vRecurring();
    assert.deepEqual([...h.matchAll(/data-lp="rec:(\w+)"/g)].map((m) => m[1]), ['r2']);
    assert.doesNotMatch(h, /<h2>Modelos<\/h2>/);
    assert.match(h, /<span id="lab_lfc_lrec_st">Silenciados<\/span>/);
    app.lf('lrec').st = 'manual';
    assert.match(app.vRecurring(), /<h2>Modelos<\/h2>[\s\S]*tplView\('m1'\)/);
  });

  test('a ordenação diz a de sempre, a próxima data', () => {
    const h = app.vRecurring();
    assert.match(h, /<label>Ordenar por<div class="sel" id="sel_lfsel_lrec_sb">[\s\S]*?<span id="lab_lfsel_lrec_sb">Próxima data<\/span>/);
    const cs = app.lfCampos('lrec', { ordem: { omissao: 'Próxima data', opcoes: [{ v: 'valor', label: 'Valor' }] } });
    assert.equal(cs[0].limpa, 'Voltar a ordenar por próxima data');
    assert.equal(app.lfCampos('lrec', { ordem: { opcoes: [{ v: 'valor', label: 'Valor' }] } })[0].limpa, 'Voltar à ordem original');
  });
});

describe('os Créditos', () => {
  beforeEach(() => semear(app));

  test('o estado é o chip, com as ativas e as liquidadas contadas; os chips do computador saíram e as liquidadas abrem por baixo', () => {
    const h = app.vCredits();
    assert.doesNotMatch(h, /cred-chips|credVerPagas\(/);
    assert.match(h, /id="pop_lfc_lcred_st"[\s\S]*?<span>Ativas e liquidadas<\/span>[\s\S]*?<span>Ativas · 2<\/span>[\s\S]*?<span>Liquidadas · 1<\/span>/);
    assert.match(h, /<span class="mov-chip"><div class="sel" id="sel_lfc_lcred_p">/, 'dois imóveis com hipotecas: o chip do imóvel');
    assert.match(h, /<button type="button" class="btn cred-liq" aria-expanded="false"[^>]*data-click="credPagasAlternar\(\)">/);
    assert.match(h, /<div class="cred-corpo">/, 'fechadas');
    assert.ok(h.indexOf('cred-resumo') < h.indexOf('lfm-barra') && h.indexOf('lfm-barra') < h.indexOf('cred-corpo'), 'o resumo, os filtros, as hipotecas');
    app.credPagas = true;
    assert.match(app.vCredits(), /<div class="cred-corpo abertas">/);
  });

  test('o estado aplica pelo credVerPagas, que larga a hipoteca escolhida; «Liquidadas» mostra só as pagas, abertas', () => {
    app.render = () => {};
    app.credSel = 'p1:l1';
    app.lfMudar('lcred', 'st', 'off');
    assert.equal(app.lf('lcred').st, 'off');
    assert.equal(app.credSel, '');
    const h = app.vCredits();
    assert.match(h, /<div class="cred-corpo abertas">/);
    assert.match(h, /<h2>Liquidadas<\/h2>/);
    assert.match(h, /mort:p1:l2/);
    assert.doesNotMatch(h, /mort:p1:l1|cred-liq/);
    app.credVerPagas('xpto');
    assert.equal(app.lf('lcred').st, '');
  });

  test('a folha: as liquidadas abertas veem-se, e no computador o título e o botão voltam à coluna', () => {
    assert.match(css, /\.cred-corpo\.abertas \.cred-pagas\{display:flex;flex-direction:column;gap:12px\}/);
    const i = css.indexOf('/* ===== ajustes-v40b: 1.2');
    const sec = css.slice(i, css.indexOf('/* ===== fim: ajustes-v40b 1.2', i));
    assert.match(sec, /@media\(min-width:901px\)\{\s*\.cred-corpo>\.cred-col>\.plan-cab\{display:flex\}\s*\.cred-corpo>\.cred-col>\.btn\.cred-liq\{display:flex\}\s*\.cred-corpo \.cred-cab>\.btn\.plan-novo\{display:none\}/);
    assert.match(sec, /@media\(pointer:coarse\)\{\.lfm-chip-abre \.mov-chip-txt::after\{content:"";position:absolute;inset:-5px 0\}\}/, 'o chip que abre o painel tem 44px no dedo');
  });
});

describe('o componente: o que esta passagem lhe juntou', () => {
  beforeEach(() => semear(app));

  test('lfCount conta os campos juntos como um, e sem a declaração conta-os um a um', () => {
    Object.assign(app.lf('lvis'), { d1: '2026-01-01', d2: '2026-02-01', es: 'agendada', sb: 'x', _open: true });
    delete app._lfCampos.lvis;
    assert.equal(app.lfCount('lvis'), 3);
    app.lfCampos('lvis', { campos: [{ chave: 'd1', nome: 'De', tipo: 'date', junto: 'd' }, { chave: 'd2', nome: 'Até', tipo: 'date', junto: 'd' }] });
    assert.equal(app.lfCount('lvis'), 2);
  });

  test('os chips juntos pela lista vêm depois dos dos campos e antes do «Limpar»; um campo de data nunca é chip', () => {
    const o = { dos: 'das visitas', campos: [{ chave: 'es', nome: 'Estado', rapido: true, opcoes: [{ v: '', label: 'Todos' }] }, { chave: 'd1', nome: 'De', tipo: 'date', rapido: true }],
      chips: [{ html: '<span class="mov-chip on" id="extra"></span>', x: true }] };
    app.lf('lvis').d1 = '2026-01-01';
    const h = app.lfChipsHtml('lvis', o, app.lfCampos('lvis', o));
    assert.ok(h.indexOf('sel_lfc_lvis_es') < h.indexOf('id="extra"') && h.indexOf('id="extra"') < h.indexOf('chip limpar'));
    assert.doesNotMatch(h, /lfc_lvis_d1/);
    assert.match(h, /class="chip limpar mov-so-largo"/, 'o filtro ligado tem o × do chip junto');
    igual(app.lfChipsHtml('lvis', { campos: [] }, []), '');
  });
});
