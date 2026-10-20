// A gaveta em secções que se recolhem: os títulos de Casas, Dinheiro,
// Análise e Agenda (o canvas de 2026-10) são botões (aria-expanded,
// aria-controls) que recolhem a secção e o aparelho lembra-se
// (gi_nav_fechadas); chegar a um separador abre a secção dele; uma secção
// recolhida mostra no título a soma dos crachás; a repintura de cada render
// não recria a gaveta quando nada mudou; no rail do computador não há nada a
// recolher. E os ícones próprios da Avaliação e do IRS
// (navegacao.js:gavetaHtml, navegacao.js:gavetaAlternar). A «Pessoas» é uma
// porta que abre os Inquilinos (ou os Proprietários, ou os Colaboradores), e
// os Grupos já não estão no menu (vivem nas Definições).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, elementos, SERVICOS_FICHEIROS } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* Cada teste parte da gaveta toda aberta, na visão geral, sem crachás
   contados antes e com o aparelho vazio. O array das recolhidas é trocado
   por um novo: o gavetaAlternar mexe-lhe no sítio, e o repor devolveria o
   mesmo array já mexido. */
beforeEach(() => {
  limpar(app);
  app.localStorage.clear();
  app._gavetaFechadas = [];
  app._gavetaTabAnt = undefined;
  app._cntAnt = {};
  app.tab = 'dashboard';
});

// o HTML que o buildNav deixou no #nav
const nav = () => elementos(app).nav.innerHTML;
// a secção (div.navsec) de um rótulo, inteira, ou '' se não estiver na gaveta
const seccao = (html, rotulo) => {
  const i = html.indexOf('<span class="txt">' + rotulo + '</span>');
  if (i < 0) return '';
  const ini = html.lastIndexOf('<div class="navsec', i);
  // acaba onde começa a secção seguinte (com título ou sem ele)
  const fim = html.slice(i).search(/<div class="(?:navsec(?: fechada)?|navh)">/);
  return html.slice(ini, fim < 0 ? html.length : i + fim);
};
// o botão do título de uma secção (a abertura do <button …>)
const titulo = (html, rotulo) => (seccao(html, rotulo).match(/<button [^>]*>/) || [''])[0];
// os ids dos separadores pela ordem em que a secção os mostra
const idsDe = (html) => [...html.matchAll(/data-click="go\('([^']+)'\)"/g)].map((m) => m[1]);
// as recolhidas que ficaram no aparelho
const guardadas = () => JSON.parse(app.localStorage.getItem('gi_nav_fechadas') || 'null');
// um planeado à espera de confirmação (pendente hoje, ou em atraso há dez dias)
const planeado = (id, atrasado) => app.normRec({ id, name: 'Seguro ' + id, every: 'month',
  next: atrasado ? app.pzAddDias(app.pzHoje(), -10) : app.pzHoje(),
  tx: { kind: 'expense', label: 'Seguro', amount: 20, propertyId: 'p1' } });

describe('as secções com título são botões que recolhem', () => {
  test('quatro títulos-botão com aria-expanded e aria-controls para o contentor dos itens; as secções sem título não têm botão', () => {
    app.buildNav();
    const html = nav();
    const botoes = [...html.matchAll(/<button [^>]*class="navsec-tit"[^>]*>[\s\S]*?<span class="txt">([^<]+)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(botoes, ['Casas', 'Dinheiro', 'Análise', 'Agenda']);
    for (const r of botoes) {
      const b = titulo(html, r);
      assert.match(b, /^<button type="button"/, r + ': um <button> a sério, que o Enter e o Espaço já acionam');
      assert.match(b, /aria-expanded="true"/, r + ': aberta por omissão');
      const alvo = /aria-controls="([^"]+)"/.exec(b)[1];
      assert.match(seccao(html, r), new RegExp('<div class="navsec-corpo" id="' + alvo + '"><div class="navsec-itens">'), r + ': o aria-controls aponta para o contentor dos itens');
    }
    // a porta de cima e as Definições continuam soltas, sem título à frente (o
    // «Criar» é um botão, mas não é um título que recolhe)
    const antesDoPrimeiro = html.slice(0, html.indexOf('<div class="navsec'));
    assert.deepEqual(idsDe(antesDoPrimeiro), ['dashboard']);
    assert.doesNotMatch(antesDoPrimeiro, /navsec-tit/);
    assert.match(antesDoPrimeiro, /^<button type="button" class="btn primary nav-criar"/, 'o «Criar» abre a barra');
    const depoisDoUltimo = html.slice(html.lastIndexOf('<div class="navh">'));
    assert.deepEqual(idsDe(depoisDoUltimo), ['settings']);
    assert.doesNotMatch(depoisDoUltimo, /<button|navsec/);
    assert.equal((html.match(/class="navh"/g) || []).length, 2, 'só as duas secções sem título usam o .navh');
  });

  test('o toque no título só recolhe: família «nada», sem navegar nem fechar a gaveta, e a ação passa na gramática', () => {
    app.buildNav();
    const b = titulo(nav(), 'Dinheiro');
    assert.match(b, /data-toca="nada"/);
    const acao = /data-click="([^"]+)"/.exec(b)[1];
    assert.equal(acao, "gavetaAlternar('Dinheiro')");
    assert.doesNotThrow(() => app.analisarAcao(acao));
    assert.doesNotMatch(acao, /go\(|closeDrawer|render|buildNav/);
    let repintou = 0, fechou = 0;
    app.render = () => { repintou++; };
    app.closeDrawer = () => { fechou++; };
    app.buildNav = () => { repintou++; };
    app.gavetaAlternar('Dinheiro');
    assert.equal(app.tab, 'dashboard', 'não navegou');
    assert.equal(repintou + fechou, 0, 'nem repintou, nem fechou a gaveta');
  });

  test('recolher grava no aparelho e a pintura seguinte esconde a secção; abrir outra vez limpa', () => {
    app.buildNav();
    app.gavetaAlternar('Casas');
    assert.deepEqual(guardadas(), ['Casas']);
    app.buildNav();
    const s = seccao(nav(), 'Casas');
    assert.match(s, /^<div class="navsec fechada">/);
    assert.match(titulo(nav(), 'Casas'), /aria-expanded="false"/);
    assert.match(titulo(nav(), 'Dinheiro'), /aria-expanded="true"/, 'as outras não se mexem');
    assert.deepEqual(idsDe(s), ['properties', 'contracts', 'tenants', 'visits'], 'os itens continuam no DOM (a CSS encolhe-os e tira-os do Tab); a «Pessoas» abre os inquilinos');
    app.gavetaAlternar('Casas');
    assert.deepEqual(guardadas(), []);
    app.buildNav();
    assert.match(seccao(nav(), 'Casas'), /^<div class="navsec">/);
  });

  test('a repintura mantém a secção recolhida, e sem nada mudado não reescreve a gaveta', () => {
    app.buildNav();
    app.gavetaAlternar('Análise');
    app.buildNav();
    const el = elementos(app).nav;
    // uma marca no DOM: se o buildNav reescrever, perde-se
    el.innerHTML = 'MARCA';
    app.buildNav();
    app.buildNav();
    assert.equal(el.innerHTML, 'MARCA', 'o mesmo HTML não se escreve outra vez (nada pisca, o foco fica)');
    app.tab = 'transactions';
    app.buildNav();
    assert.notEqual(el.innerHTML, 'MARCA', 'mudou o separador: reescreve');
    assert.match(seccao(nav(), 'Análise'), /^<div class="navsec fechada">/, 'e a recolhida continua recolhida');
  });

  test('o gavetaAlternar mexe só no nó vivo (classe e aria-expanded) e deixa a próxima pintura igual', () => {
    app.buildNav();
    const el = elementos(app).nav;
    const visto = { attr: null, classe: null, seletor: '' };
    const botao = {
      setAttribute: (k, v) => { visto.attr = [k, v]; },
      parentNode: { classList: { toggle: (c, sim) => { visto.classe = [c, sim]; } } },
    };
    app.document.querySelector = (s) => { visto.seletor = s; return s.includes('aria-controls') ? botao : null; };
    app.gavetaAlternar('Dinheiro');
    assert.match(visto.seletor, /#nav \[aria-controls="gav-dinheiro"\]/);
    assert.deepEqual(visto.attr, ['aria-expanded', 'false']);
    assert.deepEqual(visto.classe, ['fechada', true]);
    // o DOM já está no estado novo: a pintura seguinte não o recria
    el.innerHTML = 'VIVO';
    app.buildNav();
    assert.equal(el.innerHTML, 'VIVO', 'o HTML guardado já é o da secção recolhida');
  });
});

describe('o separador atual abre a sua secção', () => {
  test('ir (go) para um separador de uma secção recolhida abre-a e grava', () => {
    app.render = () => {};
    app.buildNav();
    app.gavetaAlternar('Dinheiro');
    app.gavetaAlternar('Análise');
    app.go('transactions');
    assert.equal(app.tab, 'transactions');
    assert.deepEqual(guardadas(), ['Análise'], 'o Dinheiro abriu-se; a Análise fica como estava');
    assert.match(seccao(nav(), 'Dinheiro'), /^<div class="navsec">/);
    assert.match(seccao(nav(), 'Dinheiro'), /<a class="on"[^>]*aria-current="page"[^>]*data-click="go\('transactions'\)"/);
  });

  test('pela barra de baixo e pela página reposta (o tab muda antes do buildNav) também', () => {
    app.render = () => {};
    app.buildNav();
    app.gavetaAlternar('Casas');
    app.goBarra('casas');
    assert.deepEqual(guardadas(), [], 'a barra de baixo abriu as Casas');
    app.gavetaAlternar('Análise');
    // o restorePage da nuvem: escreve o tab e chama o buildNav
    app.tab = 'reports';
    app.buildNav();
    assert.deepEqual(guardadas(), []);
    assert.match(seccao(nav(), 'Análise'), /^<div class="navsec">/);
  });

  test('recolher à mão a secção onde se está vale até se sair dela', () => {
    app.render = () => {};
    app.go('credits');
    app.gavetaAlternar('Dinheiro');
    app.buildNav();
    app.buildNav();
    assert.match(seccao(nav(), 'Dinheiro'), /^<div class="navsec fechada">/, 'repintar no mesmo separador não a reabre');
    app.go('dashboard');
    assert.match(seccao(nav(), 'Dinheiro'), /^<div class="navsec fechada">/, 'sair para fora dela também não');
    app.go('recurring');
    assert.match(seccao(nav(), 'Dinheiro'), /^<div class="navsec">/, 'voltar a ela abre-a');
  });
});

describe('o crachá no título da secção recolhida', () => {
  test('a soma dos crachás da secção, na cor de aviso quando nenhum passou do prazo', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'T2' }));
    app.db.recurring.push(planeado('r1'));
    app.buildNav();
    assert.match(titulo(nav(), 'Dinheiro') + seccao(nav(), 'Dinheiro'), /<span class="cnt u-bg-v-warn">1<\/span><span class="chev">/,
      'no título, antes da seta (a CSS só o mostra com a secção recolhida)');
    assert.doesNotMatch(seccao(nav(), 'Casas'), /class="cnt/, 'as outras secções não têm');
  });

  test('vermelho quando algum passou do prazo, e soma vários', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'T2' }));
    app.db.recurring.push(planeado('r1'), planeado('r2', true));
    app.buildNav();
    const s = seccao(nav(), 'Dinheiro');
    const doTitulo = s.slice(0, s.indexOf('</button>'));
    assert.match(doTitulo, /<span class="cnt">2<\/span>/, 'o mais urgente manda na cor');
  });

  test('sem pendentes não há crachá; e a soma pulsa quando o do item pulsou, sem um terceiro cntNovo', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'T2' }));
    app.buildNav();
    assert.doesNotMatch(nav(), /class="cnt/);
    app.db.recurring.push(planeado('r1'));
    app.buildNav();
    assert.doesNotMatch(nav(), /cnt novo/, 'a primeira contagem não pulsa');
    app.db.recurring.push(planeado('r2'));
    app.buildNav();
    const s = seccao(nav(), 'Dinheiro');
    assert.match(s.slice(0, s.indexOf('</button>')), /<span class="cnt novo u-bg-v-warn">2<\/span>/);
    const fonte = readFileSync(new URL('../web/app/navegacao.js', import.meta.url), 'utf8');
    assert.equal((fonte.match(/cntNovo\(/g) || []).length, 2, 'a definição e o crachaHtml, como antes');
  });

  test('recolher não gasta o pulso de um crachá que mudou e ainda não foi pintado', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'T2' }));
    app.db.recurring.push(planeado('r1'));
    app.buildNav();
    app.db.recurring.push(planeado('r2'));
    const botao = { setAttribute() {}, parentNode: { classList: { toggle() {} } } };
    app.document.querySelector = (s) => (s.includes('aria-controls') ? botao : null);
    app.gavetaAlternar('Dinheiro');
    app.buildNav();
    assert.match(seccao(nav(), 'Dinheiro'), /data-click="go\('recurring'\)"[^>]*>[\s\S]*?<span class="cnt novo u-bg-v-warn">2<\/span>/,
      'a pintura seguinte é a primeira a ver o 2, e pulsa');
  });
});

describe('o que a gaveta mostra', () => {
  test('as Casas têm a porta «Pessoas»; o Dinheiro, a Análise e a Agenda os seus; os Grupos saíram do menu, e os Colaboradores entram pela «Pessoas»', () => {
    app.buildNav();
    const html = nav();
    assert.deepEqual(idsDe(seccao(html, 'Casas')), ['properties', 'contracts', 'tenants', 'visits']);
    assert.match(seccao(html, 'Casas'), /<span class="txt">Pessoas<\/span>/, 'uma porta para os inquilinos e os proprietários');
    assert.doesNotMatch(html, /<span class="txt">(Inquilinos|Proprietários)<\/span>/);
    assert.deepEqual(idsDe(seccao(html, 'Dinheiro')), ['transactions', 'recurring', 'credits']);
    assert.deepEqual(idsDe(seccao(html, 'Análise')), ['reports', 'projections', 'fisco']);
    assert.match(seccao(html, 'Análise'), /<span class="txt">IRS · Anexo F<\/span>/);
    assert.deepEqual(idsDe(seccao(html, 'Agenda')), ['calendar']);
    assert.doesNotMatch(html, /go\('(groups|colaboradores)'\)/, 'nem os Grupos nem os Colaboradores têm porta própria');
    assert.doesNotMatch(html, /<span class="txt">Colaboradores<\/span>/);
    app.tab = 'owners';
    app.buildNav();
    assert.match(nav(), /<a class="on"[^>]*data-click="go\('owners'\)"[^>]*>[\s\S]*?Pessoas/, 'nos proprietários a porta fica acesa e leva-os');
    // os Colaboradores só existem com sessão (acessos.js:separadoresEscondidos)
    app.window.CW = Object.assign(app.window.CW || {}, { user: { id: 'eu', name: 'Ana Silva' } });
    try {
      app.tab = 'colaboradores';
      app.buildNav();
      assert.match(nav(), /<a class="on"[^>]*data-click="go\('colaboradores'\)"[^>]*>[\s\S]*?Pessoas/, 'nos colaboradores acende a «Pessoas»');
      assert.doesNotMatch(nav(), /<a class="on"[^>]*go\('settings'\)/, 'e não as Definições');
    } finally {
      delete app.window.CW.user;
    }
  });

  test('a Ajuda do fundo acende-se a ela, e não às Definições, mesmo chegando lá sem mudar de separador', () => {
    app.window.CW = Object.assign(app.window.CW || {}, { user: { id: 'eu', name: 'Ana Silva' } });
    try {
      app.tab = 'settings';
      app.setPage = '';
      app.buildNav();
      assert.match(nav(), /<a class="on"[^>]*go\('settings'\)/, 'controlo: na raiz, as Definições acesas');
      // o abrirDefinicoes('ajuda') já nas Definições, e o «Ajuda» das Perguntas frequentes: só o goSet
      app.goSet('ajuda');
      const html = nav();
      assert.match(html, /<a class="on"[^>]*aria-current="page"[^>]*data-click="abrirDefinicoes\('ajuda'\)"/, 'a Ajuda acesa');
      assert.doesNotMatch(html, /<a class="on"[^>]*go\('settings'\)/, 'e as Definições não');
      app.goSet('faq');
      assert.doesNotMatch(nav(), /<a class="on"[^>]*abrirDefinicoes\('ajuda'\)/, 'saindo da Ajuda, apaga-se');
    } finally {
      delete app.window.CW.user;
      app.setPage = '';
    }
  });

  test('cada destino da barra, da área e do menu se anuncia como ligação (role="link"), com o aria-current no aceso', () => {
    app.window.CW = Object.assign(app.window.CW || {}, { user: { id: 'eu', name: 'Ana Silva' } });
    try {
      app.tab = 'tenants';
      app.buildNav();
      const html = nav() + elementos(app).tabbar.innerHTML + app.abasDaArea();
      const as = html.match(/<a\b[^>]*>/g) || [];
      assert.ok(as.length > 15, 'controlo: leu ' + as.length + ' destinos');
      for (const a of as) assert.match(a, /role="link"/, a);
      for (const a of as.filter((x) => /class="on"/.test(x))) assert.match(a, /aria-current="page"/, a);
    } finally {
      delete app.window.CW.user;
    }
  });

  test('o título do cabeçalho numa área leva o nome do separador e o da área (o telemóvel mostra o da área); fora delas, só o do ecrã', () => {
    app.tab = 'properties';
    assert.equal(app.tituloDoEcraHtml({ label: 'Imóveis' }), '<span class="tit-sep">Imóveis</span><span class="tit-area">Casas</span>');
    app.tab = 'recurring';
    assert.match(app.tituloDoEcraHtml({ label: 'Planeados' }), /tit-area">Dinheiro</);
    app.tab = 'dashboard';
    assert.equal(app.tituloDoEcraHtml({ label: 'Visão geral' }), 'Visão geral');
    const i = css.indexOf('@media(max-width:900px){\n  .tabbar{display:grid}');
    const bloco = css.slice(i, css.indexOf('\n}', i));
    assert.ok(i > -1, 'controlo: a media query da casca no telemóvel');
    assert.match(bloco, /header\.top #pageTitle \.tit-sep\{display:none\}/, 'no telemóvel esconde-se o do separador');
    assert.match(bloco, /header\.top #pageTitle \.tit-area\{display:inline\}/, 'e mostra-se o da área');
    assert.match(css, /\n#pageTitle \.tit-area\{display:none\}/, 'no computador esconde-se o da área');
  });

  test('o subtítulo da Visão geral diz o período dos indicadores; os outros ecrãs ficam com o seu', () => {
    app.tab = 'dashboard';
    assert.equal(app.subtituloDoEcra({ sub: 'Indicadores' }), 'Indicadores', 'sem movimentos, o fixo');
    app.db.transactions = [{ id: 't1', kind: 'income', amount: 10, date: app.today() }];
    assert.equal(app.subtituloDoEcra({ sub: 'Indicadores' }), 'Ano de ' + app.YEAR + ' · até hoje, ' + app.dPT(app.today()));
    app.tab = 'contracts';
    assert.equal(app.subtituloDoEcra({ sub: 'Renda' }), 'Renda');
  });

  test('a Avaliação e o IRS têm ícones próprios, e nenhum separador repete o de outro', () => {
    // (um array de dentro do contexto tem outro protótipo; copia-se para comparar)
    const icones = JSON.parse(JSON.stringify(app.TABS.map((t) => t.icon)));
    assert.deepEqual(icones.filter((x, i) => icones.indexOf(x) !== i), [], 'ícones repetidos em TABS');
    assert.equal(app.TABS.find((t) => t.id === 'reports').icon, 'bars');
    assert.equal(app.TABS.find((t) => t.id === 'fisco').icon, 'recibo');
    for (const n of icones) assert.match(app.ic(n), /<(path|rect|circle) /, 'o ícone «' + n + '» desenha alguma coisa');
    // no mesmo traço dos outros: só formas de contorno, sem preenchimento próprio
    for (const n of ['bars', 'recibo']) assert.doesNotMatch(app.ic(n), /fill="(?!none)/, n);
    assert.notEqual(app.ic('bars'), app.ic('file'));
    assert.notEqual(app.ic('recibo'), app.ic('shield'));
  });

  test('uma secção sem separadores à vista some com o título e o botão', () => {
    app.definirServicosDesligados(['projections', 'reports', 'fisco']);
    app.buildNav();
    const html = nav();
    assert.equal(seccao(html, 'Análise'), '');
    assert.doesNotMatch(html, /gav-analise|Análise/);
    assert.ok(titulo(html, 'Dinheiro'), 'controlo: as outras ficam');
    try {
      // tudo desligado: não fica título nenhum, só as Definições, que são da base
      app.definirServicosDesligados(SERVICOS_FICHEIROS.map((s) => s.id));
      app.buildNav();
      const tudo = nav();
      assert.deepEqual([...tudo.matchAll(/class="navsec-tit"[^>]*><span class="txt">([^<]+)/g)].map((m) => m[1]), []);
      assert.deepEqual(idsDe(tudo), ['settings']);
      assert.doesNotMatch(tudo, /Casas|Dinheiro|Análise|Agenda/);
    } finally {
      app.definirServicosDesligados([]);
    }
  });
});

describe('o aparelho, o rail e a folha de estilos', () => {
  test('um armazenamento que recusa ou traz lixo não parte a gaveta', () => {
    // só a chave da gaveta recusa: o resto da app tem as suas guardas, e não é isso que aqui se prova
    const recusa = carregarApp({ antes: (j) => {
      const { getItem, setItem } = j.localStorage;
      j.localStorage.getItem = (k) => { if (k === 'gi_nav_fechadas') throw new Error('fechado'); return getItem(k); };
      j.localStorage.setItem = (k, v) => { if (k === 'gi_nav_fechadas') throw new Error('cheio'); return setItem(k, v); };
    } });
    assert.deepEqual(JSON.parse(JSON.stringify(recusa._gavetaFechadas)), [], 'sem leitura: tudo aberto');
    assert.doesNotThrow(() => recusa.gavetaAlternar('Casas'));
    recusa.buildNav();
    assert.match(recusa.document.getElementById('nav').innerHTML, /<div class="navsec fechada"><button[^>]*aria-expanded="false"[^>]*>\s*<span class="txt">Casas/,
      'fica recolhida em memória');
    const lixo = carregarApp({ antes: (j) => { j.localStorage.setItem('gi_nav_fechadas', '{"a":1}'); } });
    assert.deepEqual(JSON.parse(JSON.stringify(lixo._gavetaFechadas)), []);
    const certa = carregarApp({ antes: (j) => { j.localStorage.setItem('gi_nav_fechadas', '["Casas",3]'); } });
    assert.deepEqual(JSON.parse(JSON.stringify(certa._gavetaFechadas)), ['Casas'], 'só rótulos');
  });

  test('a CSS: título com classe própria, altura por grid-template-rows com as variáveis da app, itens fora do Tab quando recolhidos, e o .navh de fora intacto', () => {
    assert.match(css, /\n\.navh\{font-size:10\.5px;letter-spacing:\.07em;text-transform:uppercase;color:var\(--side-muted\);padding:14px 12px 4px;opacity:\.85;white-space:nowrap\}/,
      'o .navh (também o dos «Pedidos por responder») não mudou');
    assert.match(css, /\.navsec-corpo\{display:grid;grid-template-rows:1fr;transition:grid-template-rows var\(--medio\) var\(--curva-entra\)\}/);
    assert.match(css, /\.navsec\.fechada>\.navsec-corpo\{grid-template-rows:0fr;/);
    assert.match(css, /\.navsec-itens\{[^}]*min-height:0;overflow:hidden;/);
    assert.match(css, /\.navsec\.fechada \.navsec-itens\{visibility:hidden;transition:visibility 0s var\(--medio\)\}/,
      'fora do Tab e do leitor de ecrã, no fim da transição');
    assert.match(css, /\.navsec\.fechada>\.navsec-tit \.chev\{transform:rotate\(-90deg\)\}/);
    assert.match(css, /\.navsec\.fechada>\.navsec-tit \.cnt\{display:inline-block\}/, 'o crachá do título só com a secção recolhida');
    assert.match(css, /\.navsec-tit:focus-visible\{outline:2px solid var\(--side-ink\)/, 'o anel vê-se no fundo escuro');
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important/,
      'sem movimento, a regra geral desliga as transições');
  });
});

describe('os separadores da área por cima da vista', () => {
  test('cada área tem o seu segmentado, com o separador onde se está aceso; o resto não tem', () => {
    const a = carregarApp();
    a.tab = 'transactions';
    const din = a.abasDaArea();
    assert.match(din, /<nav class="segm abas-area" aria-label="Dinheiro">/);
    assert.deepEqual([...din.matchAll(/go\('(\w+)'\)/g)].map((m) => m[1]), ['transactions', 'recurring', 'credits']);
    assert.match(din, /<a class="on" aria-current="page"[^>]*go\('transactions'\)/);
    a.tab = 'tenants';
    const cas = a.abasDaArea();
    assert.match(cas, /aria-label="Casas"/);
    assert.match(cas, /<a class="on" aria-current="page"[^>]*go\('tenants'\)">Pessoas</, 'a porta Pessoas acende nos Inquilinos');
    assert.match(cas, /abas-pessoas/, 'e por baixo o segmentado Inquilinos/Proprietários');
    assert.doesNotMatch(cas, /go\('colaboradores'\)/, 'sem sessão, os Colaboradores não entram no segmentado');
    for (const t of ['dashboard', 'calendar', 'settings']) {
      a.tab = t;
      assert.equal(a.abasDaArea(), '', t + ' não é de uma área com separadores');
    }
  });

  test('a via parcial das listas (a pesquisa) põe por cima a mesma moldura que o render', () => {
    /* uma tecla na pesquisa de uma lista refazia o ecrã sem os separadores da
       área nem a faixa do âmbito (a via parcial não os punha); o render e ela
       têm de concordar */
    const fonte = readFileSync(new URL('../web/app/vistas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const corpo = (nome) => { const i = fonte.indexOf('function ' + nome + '('); return fonte.slice(i, fonte.indexOf('\n}\n', i)); };
    for (const nome of ['render', 'refrescarListasVivas']) {
      assert.match(corpo(nome), /html=faixaDoAmbito\(\)\+abasDaArea\(\)\+html;/, nome + ' põe a moldura da casca');
    }
  });
});
