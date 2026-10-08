// A gaveta em secções que se recolhem: os títulos de Património, Pessoas,
// Finanças e Análise são botões (aria-expanded, aria-controls) que recolhem a
// secção e o aparelho lembra-se (gi_nav_fechadas); chegar a um separador abre
// a secção dele; uma secção recolhida mostra no título a soma dos crachás; a
// repintura de cada render não recria a gaveta quando nada mudou; no rail do
// computador não há nada a recolher. E os ícones próprios da Avaliação e da
// Declaração (navegacao.js:gavetaHtml, navegacao.js:gavetaAlternar).

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
    assert.deepEqual(botoes, ['Património', 'Pessoas', 'Finanças', 'Análise']);
    for (const r of botoes) {
      const b = titulo(html, r);
      assert.match(b, /^<button type="button"/, r + ': um <button> a sério, que o Enter e o Espaço já acionam');
      assert.match(b, /aria-expanded="true"/, r + ': aberta por omissão');
      const alvo = /aria-controls="([^"]+)"/.exec(b)[1];
      assert.match(seccao(html, r), new RegExp('<div class="navsec-corpo" id="' + alvo + '"><div class="navsec-itens">'), r + ': o aria-controls aponta para o contentor dos itens');
    }
    // as portas de cima e as Definições continuam soltas, sem botão à frente
    const antesDoPrimeiro = html.slice(0, html.indexOf('<div class="navsec'));
    assert.deepEqual(idsDe(antesDoPrimeiro), ['dashboard', 'calendar']);
    assert.doesNotMatch(antesDoPrimeiro, /<button/);
    const depoisDoUltimo = html.slice(html.lastIndexOf('<div class="navh">'));
    assert.deepEqual(idsDe(depoisDoUltimo), ['settings']);
    assert.doesNotMatch(depoisDoUltimo, /<button|navsec/);
    assert.equal((html.match(/class="navh"/g) || []).length, 2, 'só as duas secções sem título usam o .navh');
  });

  test('o toque no título só recolhe: família «nada», sem navegar nem fechar a gaveta, e a ação passa na gramática', () => {
    app.buildNav();
    const b = titulo(nav(), 'Finanças');
    assert.match(b, /data-toca="nada"/);
    const acao = /data-click="([^"]+)"/.exec(b)[1];
    assert.equal(acao, "gavetaAlternar('Finanças')");
    assert.doesNotThrow(() => app.analisarAcao(acao));
    assert.doesNotMatch(acao, /go\(|closeDrawer|render|buildNav/);
    let repintou = 0, fechou = 0;
    app.render = () => { repintou++; };
    app.closeDrawer = () => { fechou++; };
    app.buildNav = () => { repintou++; };
    app.gavetaAlternar('Finanças');
    assert.equal(app.tab, 'dashboard', 'não navegou');
    assert.equal(repintou + fechou, 0, 'nem repintou, nem fechou a gaveta');
  });

  test('recolher grava no aparelho e a pintura seguinte esconde a secção; abrir outra vez limpa', () => {
    app.buildNav();
    app.gavetaAlternar('Pessoas');
    assert.deepEqual(guardadas(), ['Pessoas']);
    app.buildNav();
    const s = seccao(nav(), 'Pessoas');
    assert.match(s, /^<div class="navsec fechada">/);
    assert.match(titulo(nav(), 'Pessoas'), /aria-expanded="false"/);
    assert.match(titulo(nav(), 'Finanças'), /aria-expanded="true"/, 'as outras não se mexem');
    assert.deepEqual(idsDe(s), ['visits', 'tenants', 'owners'], 'os itens continuam no DOM (a CSS encolhe-os e tira-os do Tab)');
    app.gavetaAlternar('Pessoas');
    assert.deepEqual(guardadas(), []);
    app.buildNav();
    assert.match(seccao(nav(), 'Pessoas'), /^<div class="navsec">/);
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
    app.gavetaAlternar('Finanças');
    assert.match(visto.seletor, /#nav \[aria-controls="gav-financas"\]/);
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
    app.gavetaAlternar('Finanças');
    app.gavetaAlternar('Análise');
    app.go('transactions');
    assert.equal(app.tab, 'transactions');
    assert.deepEqual(guardadas(), ['Análise'], 'a Finanças abriu-se; a Análise fica como estava');
    assert.match(seccao(nav(), 'Finanças'), /^<div class="navsec">/);
    assert.match(seccao(nav(), 'Finanças'), /<a class="on"[^>]*aria-current="page"[^>]*data-click="go\('transactions'\)"/);
  });

  test('pela barra de baixo e pela página reposta (o tab muda antes do buildNav) também', () => {
    app.render = () => {};
    app.buildNav();
    app.gavetaAlternar('Património');
    app.goBarra('properties');
    assert.deepEqual(guardadas(), [], 'a barra de baixo abriu o Património');
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
    app.gavetaAlternar('Finanças');
    app.buildNav();
    app.buildNav();
    assert.match(seccao(nav(), 'Finanças'), /^<div class="navsec fechada">/, 'repintar no mesmo separador não a reabre');
    app.go('dashboard');
    assert.match(seccao(nav(), 'Finanças'), /^<div class="navsec fechada">/, 'sair para fora dela também não');
    app.go('fisco');
    assert.match(seccao(nav(), 'Finanças'), /^<div class="navsec">/, 'voltar a ela abre-a');
  });
});

describe('o crachá no título da secção recolhida', () => {
  test('a soma dos crachás da secção, na cor de aviso quando nenhum passou do prazo', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'T2' }));
    app.db.recurring.push(planeado('r1'));
    app.buildNav();
    assert.match(titulo(nav(), 'Finanças') + seccao(nav(), 'Finanças'), /<span class="cnt u-bg-v-warn">1<\/span><span class="chev">/,
      'no título, antes da seta (a CSS só o mostra com a secção recolhida)');
    assert.doesNotMatch(seccao(nav(), 'Pessoas'), /class="cnt/, 'as outras secções não têm');
  });

  test('vermelho quando algum passou do prazo, e soma vários', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'T2' }));
    app.db.recurring.push(planeado('r1'), planeado('r2', true));
    app.buildNav();
    const s = seccao(nav(), 'Finanças');
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
    const s = seccao(nav(), 'Finanças');
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
    app.gavetaAlternar('Finanças');
    app.buildNav();
    assert.match(seccao(nav(), 'Finanças'), /data-click="go\('recurring'\)"[^>]*>[\s\S]*?<span class="cnt novo u-bg-v-warn">2<\/span>/,
      'a pintura seguinte é a primeira a ver o 2, e pulsa');
  });
});

describe('o que a gaveta mostra', () => {
  test('Grupos está no Património e a Análise tem Projeções e Avaliação', () => {
    app.buildNav();
    const html = nav();
    assert.deepEqual(idsDe(seccao(html, 'Património')), ['properties', 'groups', 'contracts']);
    assert.deepEqual(idsDe(seccao(html, 'Análise')), ['projections', 'reports']);
    assert.match(seccao(html, 'Análise'), /<span class="txt">Projeções<\/span>[\s\S]*<span class="txt">Avaliação<\/span>/);
    assert.deepEqual(idsDe(seccao(html, 'Finanças')), ['transactions', 'recurring', 'credits', 'fisco']);
  });

  test('a Avaliação e a Declaração têm ícones próprios, e nenhum separador repete o de outro', () => {
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
    app.definirServicosDesligados(['projections', 'reports']);
    app.buildNav();
    const html = nav();
    assert.equal(seccao(html, 'Análise'), '');
    assert.doesNotMatch(html, /gav-analise|Análise/);
    assert.ok(titulo(html, 'Finanças'), 'controlo: as outras ficam');
    try {
      // tudo desligado: dos títulos só fica o Património, com os Grupos, que são da base
      app.definirServicosDesligados(SERVICOS_FICHEIROS.map((s) => s.id));
      app.buildNav();
      const tudo = nav();
      assert.deepEqual([...tudo.matchAll(/class="navsec-tit"[^>]*><span class="txt">([^<]+)/g)].map((m) => m[1]), ['Património']);
      assert.deepEqual(idsDe(seccao(tudo, 'Património')), ['groups']);
      assert.doesNotMatch(tudo, /Pessoas|Finanças|Análise/);
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
    assert.doesNotThrow(() => recusa.gavetaAlternar('Pessoas'));
    recusa.buildNav();
    assert.match(recusa.document.getElementById('nav').innerHTML, /<div class="navsec fechada"><button[^>]*aria-expanded="false"[^>]*>\s*<span class="txt">Pessoas/,
      'fica recolhida em memória');
    const lixo = carregarApp({ antes: (j) => { j.localStorage.setItem('gi_nav_fechadas', '{"a":1}'); } });
    assert.deepEqual(JSON.parse(JSON.stringify(lixo._gavetaFechadas)), []);
    const certa = carregarApp({ antes: (j) => { j.localStorage.setItem('gi_nav_fechadas', '["Pessoas",3]'); } });
    assert.deepEqual(JSON.parse(JSON.stringify(certa._gavetaFechadas)), ['Pessoas'], 'só rótulos');
  });

  test('no rail do computador não há secções a recolher: os títulos são os de sempre e o toque não faz nada', () => {
    const contem = app.document.body.classList.contains;
    app.document.body.classList.contains = (c) => c === 'rail';
    try {
      app.gavetaAlternar('Finanças');
      assert.equal(guardadas(), null, 'no rail o título não recolhe');
      app.buildNav();
      const html = nav();
      assert.doesNotMatch(html, /navsec|<button/);
      assert.match(html, /<div class="navh">Finanças<\/div>/);
      assert.ok(idsDe(html).includes('fisco'), 'todos os ícones à vista');
    } finally {
      app.document.body.classList.contains = contem;
    }
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
