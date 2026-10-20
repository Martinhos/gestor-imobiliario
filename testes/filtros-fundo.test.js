// O painel dos filtros da análise: o «Limpar» e o «Fechar» vivem num pé que
// fica preso ao fundo da caixa enquanto o resto rola (vistas.js:fpanelPe,
// estilos.css:.fp-pe), com a caixa a continuar a ser quem rola; todas as
// listas, no feitio dos Movimentos (vistas.js:lfCabeca), e os Movimentos têm
// o «Limpar» e o «Fechar» no topo, e nenhum pé. No telemóvel o botão do
// cabeçalho fica aceso e legível com o painel aberto (estilos.css:header.top
// #hdrFilt.primary) e diz ao leitor de ecrã se o painel está aberto
// (aria-expanded); e a rolagem da caixa sobrevive a repintar o mesmo ecrã.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, elementos, igual } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
const ANO = new Date().getFullYear();

/* um proprietário, um inquilino, um imóvel com hipoteca, um contrato, dois
   movimentos, um planeado e uma visita — o que cada ecrã com filtros precisa
   para pintar o seu painel em vez do ecrã vazio */
function semear() {
  const db = limpar(app);
  const hoje = app.pzHoje();
  db.owners.push(app.normPerson({ id: 'o1', name: 'Ana Dona' }));
  db.tenants.push(app.normPerson({ id: 't1', name: 'Rui Inquilino' }));
  const l = app.normLoan({ id: 'l1', name: 'Aquisição', bank: 'Banco Azul', outstanding: 50000, years: 20, type: 'fixa', rate: 3, start: '2020-01-10' });
  db.properties.push(app.normProp({ id: 'p1', name: 'T2 Lisboa', use: 'investimento', rentalMode: 'inteiro', ownerIds: ['o1'], value: 200000, purchase: 150000, loans: [l] }));
  db.contracts.push(app.normContract({ id: 'c1', name: 'Arrendamento', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.transactions.push(app.normTx({ id: 'x1', kind: 'income', label: 'Renda', category: 'Rendas', amount: 800, propertyId: 'p1', contractId: 'c1', date: ANO + '-01-05' }));
  db.transactions.push(app.normTx({ id: 'x2', kind: 'expense', label: 'Condomínio', category: 'Condomínio', amount: 55, propertyId: 'p1', date: ANO + '-01-12' }));
  db.recurring.push(app.normRec({ id: 'r1', name: 'Seguro', every: 'month', next: hoje, tx: { kind: 'expense', label: 'Seguro', amount: 20, propertyId: 'p1' } }));
  db.visits.push(app.normVisit({ id: 'v1', nomes: 'Bruno', propertyId: 'p1', date: hoje, start: '15:00' }));
}

/* A caixa do painel (o .card.fp-caixa) e o que vem depois do pé até ao fim
   do painel.
   Recebe: html — o HTML de um painel ou de um ecrã inteiro.
   Devolve: {pe, depois} — o HTML do pé e o que se lhe segue; null sem caixa. */
function peDaCaixa(html) {
  const i = html.indexOf('class="card fp-caixa"');
  if (i < 0) return null;
  const p = html.indexOf('<div class="fp-pe">', i);
  if (p < 0) return { pe: '', depois: html.slice(i) };
  const fim = html.indexOf('</div>', p) + 6;
  return { pe: html.slice(p, fim), depois: html.slice(fim) };
}

/* As declarações de uma regra pelo seletor exato, e as condições @media à
   volta dela (contando as chavetas para trás).
   Recebe: seletor — o seletor tal e qual na folha.
   Devolve: {decl, medias} — o texto entre chavetas e a lista dos @media que a
   contêm; null se não houver regra. */
function regra(seletor) {
  const i = css.indexOf(seletor + '{');
  if (i < 0) return null;
  const decl = css.slice(i + seletor.length + 1, css.indexOf('}', i));
  const medias = [];
  let fundo = 0;
  for (let j = i - 1; j >= 0; j--) {
    if (css[j] === '}') fundo++;
    else if (css[j] === '{') {
      if (fundo) { fundo--; continue; }
      const cab = css.slice(css.lastIndexOf('}', j) + 1, j).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      medias.push(cab.slice(cab.lastIndexOf('@')));
    }
  }
  return { decl, medias };
}

describe('o pé preso ao fundo do painel', () => {
  beforeEach(() => { semear(); app.fecharFiltros(); });

  test('anaPanel: o mesmo pé, com o anaClear e o anaApply, a seguir aos controlos', () => {
    app.tab = 'dashboard';
    const html = app.anaPanel('<p id="controlos">x</p>');
    const c = peDaCaixa(html);
    assert.ok(c && c.pe, 'a caixa tem o pé');
    assert.ok(html.indexOf('id="controlos"') < html.indexOf('class="fp-pe"'), 'os controlos vêm antes do pé');
    assert.match(c.pe, /data-click="anaClear\(\)">[\s\S]*Limpar<\/button>\s*<button class="btn primary"[^>]*data-click="anaApply\(\)">[\s\S]*Fechar<\/button>/);
    assert.match(c.depois, /^\s*<\/div><\/div><\/div>/, 'nada depois do pé dentro da caixa');
  });

  test('as análises pintam o painel aberto com o pé; as listas, todas, com o Limpar e o Fechar no topo (lfCabeca) — nunca os dois', () => {
    const listas = { properties: 'lprops', contracts: 'lcts', tenants: 'lten', owners: 'lown', visits: 'lvis', recurring: 'lrec', credits: 'lcred' };
    const fixos = elementos(app);
    const comoMovimentos = [];
    for (const t of Object.keys(listas).concat(['dashboard', 'reports', 'projections', 'fisco'])) {
      app.fecharFiltros();
      app.tab = t;
      if (listas[t]) app.lf(listas[t])._open = true; else app.anaOpen[t] = true;
      app.render();
      const html = fixos.view.innerHTML;
      if (listas[t] && /lfm-caixa/.test(html)) {
        comoMovimentos.push(t);
        const k = listas[t];
        assert.match(html, new RegExp('class="fpanel on[^"]*" id="lfp_' + k + '" role="region" aria-labelledby="lft_' + k + '">\\s*<div class="card mov-filtros-card lfm-caixa">'), t + ': o painel aberto com o cartão dos Movimentos');
        assert.match(html, new RegExp('<div class="mov-filtros-cab"><h2 class="mov-filtros-tit" id="lft_' + k + '">Filtros</h2>[\\s\\S]*?data-click="lfApply\\(\'' + k + '\'\\)">Fechar</button></div>'), t + ': o Fechar na cabeça');
        assert.ok(!/fp-caixa|fp-pe/.test(html), t + ': sem o pé');
        continue;
      }
      assert.match(html, /class="fpanel on[^"]*"><div class="card fp-caixa">/, t + ': o painel aberto com a caixa nova');
      assert.equal((html.match(/class="fp-pe"/g) || []).length, 1, t + ': um pé só');
      assert.match(peDaCaixa(html).depois, /^\s*<\/div><\/div><\/div>/, t + ': o pé é o último filho da caixa');
    }
    igual(comoMovimentos, Object.keys(listas), 'nenhuma lista ficou com o pé: todas estão no feitio dos Movimentos');
    app.fecharFiltros();
    app.tab = 'transactions';
    app.render();
    assert.ok(!/fp-caixa|fp-pe/.test(fixos.view.innerHTML), 'o painel dos Movimentos não muda');
  });

  test('a folha: a caixa continua a rolar, o pé é pegajoso em baixo com a divisória e o fundo do cartão', () => {
    const caixa = regra('.fpanel>.card');
    assert.ok(caixa, 'há a regra da caixa');
    assert.match(caixa.decl, /overflow:auto/, 'quem rola é a caixa (o cloud/filtros.js segue o scroll dela)');
    assert.match(caixa.decl, /max-height:min\(72dvh,560px\)/, 'a altura limitada, em dvh');
    const fp = regra('.fpanel>.card.fp-caixa');
    assert.ok(fp, 'há a regra da caixa com pé');
    assert.match(fp.decl, /padding:12px 12px 0(;|$)/, 'sem padding em baixo, para o pé assentar no fundo');
    assert.match(fp.decl, /scroll-padding-bottom:\d+px/, 'o Tab não deixa um campo por trás do pé');
    const pe = regra('.fp-caixa>.fp-pe');
    assert.ok(pe, 'há a regra do pé');
    for (const d of ['position:sticky', 'bottom:0', 'background:var(--card)', 'border-top:1px solid var(--line)', 'margin:12px -12px 0'])
      assert.ok(pe.decl.includes(d), 'o pé tem ' + d);
    assert.equal(pe.medias.length, 0, 'o pé é preso em todos os tamanhos');
  });

  test('no telemóvel os dois botões do pé vão a meias e têm o alvo de dedo (≥ 44px)', () => {
    const r = regra('.fp-caixa>.fp-pe .btn');
    assert.ok(r, 'há a regra dos botões do pé');
    assert.deepEqual(r.medias, ['@media(max-width:900px)']);
    assert.match(r.decl, /flex:1/);
    const h = Number((r.decl.match(/min-height:(\d+)px/) || [])[1]);
    assert.ok(h >= 44, 'min-height ' + h);
  });
});

describe('o botão dos filtros do cabeçalho com o painel aberto', () => {
  beforeEach(() => { semear(); app.fecharFiltros(); });

  test('no telemóvel, aceso é um fundo e uma cor de tokens que não são os do cabeçalho apagado', () => {
    const apagado = regra('header.top #hdrBell,header.top #hdrFilt');
    const aceso = regra('header.top #hdrFilt.primary');
    assert.ok(apagado && aceso, 'as duas regras existem');
    assert.deepEqual(aceso.medias, ['@media(max-width:900px)'], 'no bloco do telemóvel, onde o fundo sai');
    assert.deepEqual(apagado.medias, aceso.medias);
    assert.match(aceso.decl, /background:var\(--accent-soft\)/);
    assert.match(aceso.decl, /color:var\(--accent-text\)/);
    assert.ok(!/accent-ink|transparent/.test(aceso.decl), 'nem a tinta do primário nem o fundo transparente');
  });

  test('pintarBotaoFiltros acende e diz aria-expanded nas listas e na análise, e não afirma nada nos Movimentos', () => {
    const hb = elementos(app).hdrFilt;
    const atr = {}, cls = {};
    hb.setAttribute = (k, v) => { atr[k] = v; };
    hb.removeAttribute = (k) => { delete atr[k]; };
    hb.classList = { toggle: (c, v) => { cls[c] = v; }, add() {}, remove() {}, contains: () => false };
    app.tab = 'properties';
    app.pintarBotaoFiltros();
    assert.equal(atr['aria-expanded'], 'false'); assert.equal(cls.primary, false);
    app.lf('lprops')._open = true;
    app.pintarBotaoFiltros();
    assert.equal(atr['aria-expanded'], 'true'); assert.equal(cls.primary, true);
    app.tab = 'dashboard';
    app.anaOpen.dashboard = true;
    app.pintarBotaoFiltros();
    assert.equal(atr['aria-expanded'], 'true'); assert.equal(cls.primary, true);
    app.anaOpen.dashboard = false;
    app.pintarBotaoFiltros();
    assert.equal(atr['aria-expanded'], 'false');
    app.tab = 'transactions';
    app.pintarBotaoFiltros();
    assert.ok(!('aria-expanded' in atr), 'nos Movimentos o botão é o «Selecionar vários»');
  });

  test('sem a camada da seleção, o botão do cabeçalho abre e fecha o painel da lista, o mesmo do funil', () => {
    const fixos = elementos(app);
    app.tab = 'properties';
    app.hdrFiltToggle();
    assert.equal(app.lf('lprops')._open, true);
    assert.match(fixos.view.innerHTML, /class="fpanel on/);
    app.hdrFiltToggle();
    assert.equal(app.lf('lprops')._open, false);
    assert.ok(!/class="fpanel on/.test(fixos.view.innerHTML));
  });
});

describe('a rolagem da caixa ao repintar', () => {
  beforeEach(() => { semear(); app.fecharFiltros(); });

  /* O #view devolve, a cada pergunta pela caixa aberta, a próxima da fila —
     a de antes do render e depois a nova.
     Recebe: caixas — a fila de caixas falsas ({scrollTop}).
     Devolve: nada — troca o querySelector do #view. */
  function caixasEmFila(caixas) {
    const v = elementos(app).view;
    v.querySelector = (s) => (s === '.fpanel.on>.fp-caixa,.fpanel.on>.lfm-caixa' ? caixas.shift() || null : null);
  }

  test('no mesmo ecrã, a caixa nova fica onde a de antes estava rolada', () => {
    app.tab = 'properties';
    app.lf('lprops')._open = true;
    app.render();
    const nova = { scrollTop: 0 };
    caixasEmFila([{ scrollTop: 140 }, nova]);
    app.render();
    assert.equal(nova.scrollTop, 140);
  });

  test('noutro ecrã, ou sem painel aberto antes, a caixa nasce no topo', () => {
    app.tab = 'properties';
    app.render();
    app.tab = 'contracts';
    app.lf('lcts')._open = true;
    const nova = { scrollTop: 0 };
    caixasEmFila([{ scrollTop: 140 }, nova]);
    app.render();
    assert.equal(nova.scrollTop, 0, 'mudar de ecrã não leva a rolagem');
    const outra = { scrollTop: 0 };
    caixasEmFila([null, outra]);
    app.render();
    assert.equal(outra.scrollTop, 0, 'abrir o painel começa no topo');
  });
});
