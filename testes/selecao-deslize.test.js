// O entrar e o sair da seleção dos Movimentos têm a sensação das Casas: ao
// entrar, as caixas das linhas aparecem a desvanecer (a .sel-entra da folha,
// no --medio e com a curva de quem chega) e a caixa de tudo e a contagem
// entram no cabeçalho; ao sair, vão-se sem animar e sem deixar nada para trás.
// Só na ENTRADA: marcar, a caixa de tudo, a lista viva e a sincronização de
// fundo não voltam a animar; na tabela do ecrã largo, onde as caixas já se
// viam, entrar também não. O deslize do nome do mês e as caixas por mês
// saíram com o modelo das Casas. Com menos movimento pedido, a regra da folha
// desliga a animação.
//
// O DOM do arnês não tem layout nem animações: as caixas são peças feitas à
// mão, com as classes e os ouvintes que lhes põem. O que se vê de facto no
// browser prova-o a prova com o Playwright.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarTudo, limpar, repor } from './arnes.js';

const app = carregarTudo({ hoje: '2026-09-06' });
afterEach(() => repor(app));

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r/g, '');
const fonte = readFileSync(new URL('../web/cloud/selecao.js', import.meta.url), 'utf8');
// o seletor das caixas das linhas, tal como o cloud/selecao.js:selCaixasEntram as procura
const CAIXAS = '#view .txrow[data-tx]>.selbox';

/* Uma caixa de linha do ecrã falso: as classes que lhe põem e os ouvintes.
   Devolve: {classes, ouvintes, classList, addEventListener}. */
function caixaFalsa() {
  const e = { classes: new Set(), ouvintes: [] };
  e.classList = { add: (c) => e.classes.add(c), remove: (c) => e.classes.delete(c), contains: (c) => e.classes.has(c), toggle() {} };
  e.addEventListener = (tipo, f, o) => e.ouvintes.push({ tipo, f, o });
  return e;
}

/* Liga o ecrã falso: cada render (o da base) pinta caixas NOVAS, como o
   browser, se a vista estiver em seleção.
   Devolve: {atuais()} — as caixas que se veem agora. */
function ligar() {
  const estado = { caixas: [] };
  const base = app._render_sel;
  app._render_sel = function () {
    const r = base.apply(this, arguments);
    estado.caixas = app.CW.selMode ? [caixaFalsa(), caixaFalsa()] : [];
    return r;
  };
  app.document.querySelectorAll = (s) => (s === CAIXAS ? estado.caixas : []);
  return { atuais: () => estado.caixas };
}
// quantas das caixas estão a desvanecer
const comEntra = (cs) => cs.filter((c) => c.classes.has('sel-entra')).length;

beforeEach(() => {
  limpar(app);
  app.db.transactions.push(app.normTx({ id: 'A', kind: 'expense', label: 'Luz', amount: 50, date: '2026-03-12' }));
  app.db.transactions.push(app.normTx({ id: 'B', kind: 'income', label: 'Renda', amount: 500, date: '2026-03-02' }));
  app.tab = 'transactions';
  app.CW.selReset();
  app.selEntrou = false;
});

describe('entrar na seleção, como nas Casas', () => {
  test('pelo toque longo: as caixas das linhas ganham a .sel-entra e perdem-na quando a animação acaba', () => {
    const v = ligar();
    app.lpLongo('tx:A');
    const cs = v.atuais();
    assert.equal(app.CW.selMode, true);
    assert.equal(comEntra(cs), 2, 'as duas caixas desvanecem');
    for (const c of cs) {
      const o = c.ouvintes.find((x) => x.tipo === 'animationend');
      assert.ok(o && o.o && o.o.once, 'um ouvinte de uma vez, no fim da animação');
      o.f();
      assert.equal(c.classes.has('sel-entra'), false, 'a classe sai no fim: uma linha reinserida não volta a animar');
    }
  });

  test('pelo «Selecionar vários» do cabeçalho também, sem nada marcado', () => {
    const v = ligar();
    app.hdrFiltToggle();
    assert.equal(app.CW.selMode, true);
    assert.equal(app.selN(), 0);
    assert.equal(comEntra(v.atuais()), 2);
  });

  test('só ao entrar: o render seguinte, marcar, a caixa de tudo e a lista viva não voltam a animar', () => {
    const v = ligar();
    app.CW.selEntrar('A');
    app.render();                       // a sincronização de fundo: um render sem mudar de modo
    assert.equal(comEntra(v.atuais()), 0, 'as caixas novas deste render não animam');
    const cs = v.atuais();
    app.CW.selToggle('B');
    app.CW.selTodos();
    app.CW.selPintar();
    app.pintarListaTx();
    assert.equal(comEntra(cs), 0);
    assert.equal(app.selEntrou, false, 'a marca da entrada gastou-se no primeiro render');
  });

  test('já em seleção, o toque longo marca e desmarca como o toque, e não volta a entrar', () => {
    const v = ligar();
    app.lpLongo('tx:A');
    const cs = v.atuais();
    app.lpLongo('tx:B');
    assert.equal(v.atuais(), cs, 'sem render: as mesmas caixas');
    assert.deepEqual(Object.keys(app.selIds).sort(), ['A', 'B'], 'o primeiro continua marcado');
    app.lpLongo('tx:B');
    assert.deepEqual(Object.keys(app.selIds), ['A']);
  });

  test('na tabela do ecrã largo as caixas já se viam: entrar não as faz desvanecer', () => {
    app.matchMedia = (q) => ({ matches: /min-width:1100px/.test(q), addEventListener() {}, addListener() {} });
    const v = ligar();
    app.CW.selEntrar('A');
    assert.equal(app.CW.selMode, true);
    assert.equal(comEntra(v.atuais()), 0);
  });

  test('a folha: a mesma animação das Casas — veuEntra, no --medio e com a --curva-entra — e o reduced motion desliga-a', () => {
    assert.match(css, /#view \.mov-linha>\.selbox\.sel-entra\{animation:veuEntra var\(--medio\) var\(--curva-entra\) backwards\}/);
    assert.match(css, /@keyframes veuEntra\{from\{opacity:0\}\}/, 'só a opacidade');
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important/);
    assert.match(css, /\.sel-cab\{[^}]*animation:veuEntra var\(--medio\) var\(--curva-entra\) backwards\}/, 'a caixa de tudo e a contagem entram da mesma maneira');
  });
});

describe('sair da seleção, como nas Casas', () => {
  test('sai sem animar e sem restos: nenhuma animação pela API, nenhuma camada de saída, nada no style de ninguém', () => {
    const v = ligar();
    app.CW.selEntrar('A');
    const cs = v.atuais();
    app.CW.selSair();
    assert.equal(app.CW.selMode, false);
    assert.deepEqual(v.atuais(), [], 'as caixas foram-se com o render');
    assert.equal(comEntra(cs), 2, 'as velhas nem foram tocadas: saíram do documento com o render');
    assert.doesNotMatch(fonte, /\.animate\(|camadaDeSaida|semIds\(|style\.position/, 'o cloud/selecao.js não anima à mão');
  });

  test('o deslize do mês saiu: nem as funções dele, nem o que só elas usavam', () => {
    for (const n of ['selMedirDeslize', 'selAplicarDeslize', 'selFantasma', 'selFantasmas', 'selModoPintado', 'selForaAVista', 'selAntesDoDeslize', 'selDepoisDoDeslize', 'selIdsDoMes']) {
      assert.equal(typeof app[n], 'undefined', n + ' saiu');
    }
    assert.equal(typeof app.CW.selMes, 'undefined');
    assert.equal(typeof app.CW.selEntrarMes, 'undefined');
    assert.equal(typeof app.txMesExtra, 'undefined', 'o ponto de extensão do mês ficou sem quem o usasse, e saiu');
  });

  test('ir para outro separador sai da seleção, e voltar não volta a entrar', () => {
    const v = ligar();
    app.CW.selEntrar('A');
    app.tab = 'properties';
    app.render();
    assert.equal(app.CW.selMode, false);
    app.tab = 'transactions';
    app.render();
    assert.equal(app.CW.selMode, false);
    assert.deepEqual(v.atuais(), []);
  });

  test('numa lista que acaba vazia o vTransactions sai sozinho, e nada anima', () => {
    app.db.transactions.length = 0;
    const v = ligar();
    app.CW.selEntrar();
    assert.equal(app.CW.selMode, false);
    assert.deepEqual(v.atuais(), []);
  });
});

describe('o título do mês e a caixa de tudo', () => {
  test('o título do mês é o mesmo dentro e fora da seleção: sem caixa, sem marca nenhuma, e sem colar ao topo', () => {
    const fora = app.txMesHtml('2026-03');
    app.CW.selEntrar('A');
    const dentro = app.txMesHtml('2026-03');
    assert.equal(dentro, fora);
    assert.match(dentro, /<div class="section-title mov-mes">\s*<span class="txmes-nome">mar 2026<\/span><span class="txnet"><\/span><\/div>/);
    assert.doesNotMatch(dentro, /selbox|data-mes|sel-mes/);
    assert.doesNotMatch(css, /\.sel-mes\b/, 'a regra sticky do título em seleção saiu da folha');
  });

  test('a contagem e a caixa de tudo vão para o lugar do título, focáveis, e a lista não leva barra por cima que a empurre', () => {
    /* o getElementById do arnês inventa um elemento para qualquer id: aqui o
       #selCab só existe depois de o cabeçalho o inserir antes do título */
    const doc = app.document, porId = doc.getElementById;
    let cab = null, saiu = false;
    const titulo = porId('pageTitle');
    titulo.parentNode = { insertBefore: (e, antes) => { if (antes === titulo) { cab = e; e.remove = () => { saiu = true; cab = null; }; } } };
    doc.getElementById = (id) => (id === 'selCab' ? cab : porId(id));
    try {
      app.CW.selEntrar('A');
      assert.doesNotMatch(app.vTransactions(), /sel-bar|selGlobal|selConta|sel-fundo/, 'nada por cima da lista, e a barra não vem com a vista');
      assert.ok(cab, 'o #selCab nasce no cabeçalho, antes do título');
      assert.equal(cab.className, 'sel-cab');
      assert.match(cab.innerHTML, /id="selGlobal" role="checkbox" tabindex="0"[^>]*data-click="CW\.selTodos\(event\)"/, 'como o #selLTudo das Casas: chega-se-lhe pelo teclado');
      assert.match(cab.innerHTML, /<b id="selConta">nenhum movimento<\/b><span class="small u-d-block">toca para marcar tudo<\/span>/);
      app.CW.selSair();
      assert.ok(saiu, 'e sai com a seleção');
    } finally {
      doc.getElementById = porId;
      titulo.parentNode = null;
    }
  });

  test('a folha esconde o título em seleção, e não há barra por cima da lista', () => {
    assert.match(css, /body\.sel-on #pageTitle,body\.sel-on #pageSub\{display:none\}/);
    assert.doesNotMatch(css, /\.sel-bar\{/);
  });
});
