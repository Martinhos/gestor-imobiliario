// Os Grupos são uma aba das Casas, logo a seguir aos Imóveis: a ordem das
// abas da área, da gaveta e do carrossel (navegacao.js:AREAS, NAV_GROUPS,
// vizinhoNaArea), a barra de baixo a acender as Casas, o crachá dos pedidos na
// aba e na gaveta; as Definições sem a linha dos Grupos e sem os acender; o
// goSet('groups') antigo a levar ao separador; o realce de cinco abas, que
// mede a aba acesa (navegacao.js:abasPolegarEm); e o cartão da conta, no fundo da gaveta, a
// abrir «O meu perfil» (navegacao.js:abrirOMeuPerfil).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, elementos, igual } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
afterEach(() => { if (app.window.CW) { delete app.window.CW.user; delete app.window.CW.editProfile; } });

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
// os destinos (go('…')) de um pedaço de HTML, pela ordem
const destinos = (h) => [...h.matchAll(/data-click="go\('([^']+)'\)"/g)].map((m) => m[1]);
// os rótulos das abas da área, sem os números
const rotulos = (h) => [...h.matchAll(/<a [^>]*data-click="go\('[^']+'\)">([^<]+)/g)].map((m) => m[1].trim());
// a fila das Casas (sem o segmentado das Pessoas, que vem a seguir)
const filaDasCasas = (h) => h.slice(h.indexOf('<nav class="segm abas-area"'), h.indexOf('</nav>') + 6);
// em que separador se está, com a app limpa e nada escondido
function em(id) {
  limpar(app);
  app.tab = id;
  app.setPage = '';
  app.separadoresEscondidos = () => [];
}

describe('a aba Grupos nas Casas', () => {
  test('as abas das Casas são Imóveis, Grupos, Contratos, Pessoas, Visitas — e nos Grupos a deles está acesa', () => {
    em('properties');
    const fila = filaDasCasas(app.abasDaArea());
    assert.match(fila, /^<nav class="segm abas-area" aria-label="Casas">/);
    igual(destinos(fila), ['properties', 'groups', 'contracts', 'tenants', 'visits']);
    igual(rotulos(fila), ['Imóveis', 'Grupos', 'Contratos', 'Pessoas', 'Visitas']);
    igual(app.AREAS.casas.ids, ['properties', 'groups', 'contracts', 'pessoas', 'visits']);
    app.tab = 'groups';
    const nos = filaDasCasas(app.abasDaArea());
    assert.match(nos, /<a class="on" aria-current="page" role="link" tabindex="0" data-toca="ecra" data-click="go\('groups'\)">Grupos/, 'acesa, e anunciada como a página onde se está');
    assert.equal((nos.match(/class="on"/g) || []).length, 1, 'uma só acesa');
    assert.equal(app.areaComSeparadores([]), 'casas', 'os Grupos são um ecrã de área, com as abas por cima');
    assert.equal(app.tituloDoEcraHtml({ label: 'Grupos' }), '<span class="tit-sep">Grupos</span><span class="tit-area">Casas</span>', 'o telemóvel diz «Casas», o computador «Grupos»');
  });

  test('o crachá dos pedidos para entrar nos meus grupos vai na aba e na linha da gaveta', () => {
    em('properties');
    app.crachaDe = (id) => (id === 'groups' ? { n: 2 } : null);
    assert.match(filaDasCasas(app.abasDaArea()), /data-click="go\('groups'\)">Grupos <span class="n">2<\/span><\/a>/);
    app.buildNav();
    assert.match(elementos(app).nav.innerHTML, /data-click="go\('groups'\)">.*?<span class="txt">Grupos<\/span><span class="cnt[^"]*">2<\/span><\/a>/);
  });

  test('o carrossel percorre as cinco: os Grupos entre os Imóveis e os Contratos', () => {
    em('properties');
    assert.equal(app.vizinhoNaArea(1), 'groups', 'a seguir aos Imóveis');
    app.tab = 'groups';
    igual([app.vizinhoNaArea(-1), app.vizinhoNaArea(1)], ['properties', 'contracts']);
    app.tab = 'contracts';
    assert.equal(app.vizinhoNaArea(-1), 'groups', 'antes dos Contratos');
  });

  test('a barra de baixo acende as Casas nos Grupos, e voltar às Casas volta aos Grupos', () => {
    em('dashboard');
    app.render = () => {};
    app.go('groups');
    assert.equal(app.areaDe('groups'), 'casas');
    assert.match(elementos(app).tabbar.innerHTML, /<a class="on"[^>]*data-click="goBarra\('casas'\)"/);
    app.go('dashboard');
    app.goBarra('casas');
    assert.equal(app.tab, 'groups', 'a área lembra-se do separador onde se estava');
  });
});

describe('as Definições sem os Grupos', () => {
  test('a raiz não tem a linha dos Grupos, e os Grupos não acendem as Definições', () => {
    em('settings');
    const h = app.vSettings();
    assert.ok(!h.includes("goSet('groups')") && !h.includes("go('groups')"), 'sem a porta');
    assert.ok(!/<b class="u-d-block">Grupos<\/b>/.test(h), 'nem o rótulo');
    assert.ok(!app.DEF_LINHAS.some((l) => l.page === 'groups' || l.ir === 'groups'), 'nem a linha nos dados');
    app.tab = 'groups';
    assert.equal(app.portaAtiva('settings'), false);
    assert.equal(app.portaAtiva('groups'), true);
    assert.equal(app.paginaDasDefinicoes(), '', 'a navegação lateral das Definições não acende nada nos Grupos');
  });

  test('o separador Grupos já não tem o Voltar às Definições: em cima tem as abas das Casas', () => {
    em('groups');
    const h = app.vGrupos();
    assert.ok(!h.includes('def-voltar') && !h.includes('class="def-nav"'));
    assert.match(h, /^<p class="def-intro">/);
  });

  test('o goSet(\'groups\') antigo leva ao separador, e não a uma subpágina sem porta', () => {
    em('settings');
    app.render = () => {};
    app.goSet('groups');
    assert.equal(app.tab, 'groups');
    assert.equal(app.setPage, '');
    app.go('settings');
    app.goSet('cats');
    assert.equal(app.tab, 'settings', 'controlo: as outras subpáginas continuam nas Definições');
    assert.equal(app.setPage, 'cats');
    // um caminho velho que ponha a subpágina à mão vê os grupos, com o Voltar das subpáginas
    app.setPage = 'groups';
    assert.match(app.vSettings(), /def-voltar[\s\S]*Servem de filtro em toda a app\./);
  });
});

describe('o realce de cinco abas', () => {
  test('o realce mede a quinta aba, a das Visitas, e não supõe colunas iguais', () => {
    assert.ok(!/\.abas-area\.n5>\.segm-polegar/.test(css) && !/\.abas-area>\.segm-polegar\.i4\{/.test(css), 'sem a conta das colunas iguais');
    const vars = {};
    const pol = { className: '', style: { setProperty: (k, v) => { vars[k] = v; } } };
    const as = [0, 1, 2, 3, 4].map((k) => ({ offsetLeft: 4 + k * 70, offsetWidth: 60 + k }));
    const nav = { querySelector: () => pol, querySelectorAll: () => as };
    app.abasPolegarEm(nav, 4, true);
    assert.equal(pol.className, 'segm-polegar i4');
    assert.deepEqual(vars, { '--pol-x': '284px', '--pol-w': '64px' }, 'a esquerda e a largura das Visitas');
  });
});

describe('o cartão da conta abre o perfil', () => {
  test('no fundo da gaveta diz «O meu perfil» e abre a janela do perfil, fechando primeiro a gaveta', () => {
    em('dashboard');
    const chamadas = [];
    app.window.CW = Object.assign(app.window.CW || {}, { user: { id: 'EU', name: 'Ana Silva', email: 'ana@exemplo.pt' }, editProfile: () => chamadas.push('perfil') });
    app.buildNav();
    const html = elementos(app).nav.innerHTML;
    assert.match(html, /<button type="button" class="nav-conta" data-toca="camada" data-click="abrirOMeuPerfil\(\)"><span class="avatar">AS<\/span><span class="u-minw-0"><b>Ana Silva<\/b><small>O meu perfil<\/small><\/span><\/button>/);
    assert.ok(!html.includes('Conta e partilha'), 'o nome antigo saiu');
    assert.ok(!html.includes("abrirDefinicoes('cloud')"), 'e já não leva à página da conta');
    app.closeDrawer = () => chamadas.push('gaveta');
    app.abrirOMeuPerfil();
    igual(chamadas, ['gaveta', 'perfil']);
    assert.equal(app.tab, 'dashboard', 'é uma janela: não muda de ecrã');
  });

  test('sem a janela do perfil carregada leva à raiz das Definições, onde está o cartão; sem sessão não há cartão', () => {
    em('dashboard');
    app.render = () => {};
    app.window.CW = Object.assign(app.window.CW || {}, { user: { id: 'EU', name: 'Ana Silva' } });
    app.abrirOMeuPerfil();
    assert.equal(app.tab, 'settings');
    assert.equal(app.setPage, '');
    delete app.window.CW.user;
    app.buildNav();
    assert.ok(!elementos(app).nav.innerHTML.includes('nav-conta'), 'sem sessão, nem a Ajuda nem a conta');
  });
});
