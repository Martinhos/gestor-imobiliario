// Filtrar os Movimentos pelas etiquetas. Escolhem-se várias, e um movimento
// passa se tiver PELO MENOS UMA delas. As etiquetas que se oferecem são as da
// lista mestra (db.settings.tags) e as que os movimentos usam; sem nenhuma na
// conta, a linha não aparece no painel. Contam como um filtro no funil, dizem-se
// no resumo, têm chip rápido na fila (com o × que as limpa) e saem com o
// «Limpar». Um filtro comum não guarda etiquetas.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));

/* A base de cada teste: quatro movimentos — um «Urgente», um «Dedutível», um
   com as duas e um sem nenhuma — e os filtros todos na origem.
   Devolve: nada — escreve na db e repõe os filtros. */
function monta() {
  limpar(app);
  app.db.settings.tags = ['Urgente', 'A reembolsar', 'Dedutível'];
  app.db.transactions = [
    app.normTx({ id: 'T1', kind: 'expense', label: 'Canalizador', amount: 120, date: '2026-03-02', tags: ['Urgente'] }),
    app.normTx({ id: 'T2', kind: 'expense', label: 'IMI', amount: 300, date: '2026-04-02', tags: ['Dedutível'] }),
    app.normTx({ id: 'T3', kind: 'expense', label: 'Telhado', amount: 900, date: '2026-05-02', tags: ['Urgente', 'Dedutível'] }),
    app.normTx({ id: 'T4', kind: 'income', label: 'Renda', amount: 800, date: '2026-05-08' }),
  ];
  app.txFilter = ''; app.txProp = ''; app.txPaid = ''; app.txCat = ''; app.txSub = ''; app.txSearch = '';
  app.txDe = ''; app.txAte = ''; app.txNoPayer = true; app.ownerFilter = ''; app.txEtiq = [];
  app.tab = 'dashboard';   // fora da vista: a repintura cai no render, que se cala
  janelasFalsas(app, 'render', 'toast');
}

// os ids dos movimentos que passam nos filtros de agora
const passam = () => app.db.transactions.filter((t) => app.txMatch(t)).map((t) => t.id);

describe('o filtro das etiquetas na lista', () => {
  beforeEach(monta);

  test('sem etiquetas escolhidas passam todos, mesmo os que não têm nenhuma', () => {
    igual(passam(), ['T1', 'T2', 'T3', 'T4']);
  });

  test('uma etiqueta: passam os movimentos que a têm, sozinha ou com outras', () => {
    app.txEtiq = ['Urgente'];
    igual(passam(), ['T1', 'T3']);
  });

  test('duas etiquetas: basta UMA — passa quem tem uma ou a outra, e o sem etiquetas fica de fora', () => {
    app.txEtiq = ['Urgente', 'Dedutível'];
    igual(passam(), ['T1', 'T2', 'T3']);
    app.txEtiq = ['A reembolsar'];
    igual(passam(), [], 'uma etiqueta que ninguém usa não deixa passar nada');
  });

  test('soma-se aos outros filtros: as etiquetas e as datas têm de bater as duas', () => {
    app.txEtiq = ['Urgente', 'Dedutível'];
    app.txDe = '2026-04-01';
    igual(passam(), ['T2', 'T3']);
  });
});

describe('as etiquetas que se oferecem', () => {
  beforeEach(monta);

  test('as da lista mestra pela ordem de lá, depois as usadas fora dela por ordem alfabética, sem repetidas', () => {
    app.db.transactions.push(app.normTx({ id: 'T5', kind: 'expense', label: 'Obras', amount: 10, date: '2026-05-02', tags: ['Obras', 'Urgente', 'Aquecimento'] }));
    igual(app.txEtiquetasDisponiveis(), ['Urgente', 'A reembolsar', 'Dedutível', 'Aquecimento', 'Obras']);
  });

  test('uma escolhida que já não existe em lado nenhum continua lá, para se poder desligar', () => {
    app.txEtiq = ['Apagada'];
    igual(app.txEtiquetasDisponiveis(), ['Urgente', 'A reembolsar', 'Dedutível', 'Apagada']);
  });

  test('sem etiquetas na conta, a linha não aparece no painel', () => {
    app.db.settings.tags = [];
    app.db.transactions.forEach((t) => { t.tags = []; });
    assert.equal(app.txEtiquetasHtml(), '');
    assert.doesNotMatch(app.txFilterBody(), /id="txEtiq"/);
  });
});

describe('a linha «Etiquetas» do painel', () => {
  beforeEach(monta);

  test('cada etiqueta é um chip que se liga e desliga (aria-pressed), com o visto e no grupo com rótulo', () => {
    app.txEtiq = ['Dedutível'];
    const h = app.txFilterBody();
    assert.match(h, /<span class="flabel" id="txEtiqL">Etiquetas<\/span>/);
    assert.match(h, /id="txEtiq" role="group" aria-labelledby="txEtiqL"/);
    const chips = h.match(/<button[^>]*data-etiq="[^"]*"[^>]*>/g) || [];
    assert.equal(chips.length, 3);
    assert.match(h, /class="chip on" aria-pressed="true" data-etiq="Dedutível"/);
    assert.match(h, /class="chip" aria-pressed="false" data-etiq="Urgente"/);
    assert.match(h, /data-click="txPorEtiqueta\('Urgente'\)"/);
    // fica a seguir ao tipo e antes da grelha dos seletores
    assert.ok(h.indexOf('id="txKind"') < h.indexOf('id="txEtiq"') && h.indexOf('id="txEtiq"') < h.indexOf('mov-grelha'));
  });

  test('tocar liga a etiqueta, tocar outra junta-a, tocar de novo desliga-a', () => {
    app.txPorEtiqueta('Urgente');
    igual(app.txEtiq, ['Urgente']);
    app.txPorEtiqueta('Dedutível');
    igual(app.txEtiq, ['Urgente', 'Dedutível']);
    app.txPorEtiqueta('Urgente');
    igual(app.txEtiq, ['Dedutível']);
  });

  test('um nome com aspas, plica ou < sai escapado: o HTML não parte e não leva style= nem on…=', () => {
    app.db.settings.tags = ['D\'Ana "<b>"'];
    app.db.transactions = [];
    const h = app.txEtiquetasHtml();
    assert.doesNotMatch(h, /<b>/);
    assert.match(h, /data-etiq="D&#039;Ana &quot;&lt;b&gt;&quot;"/);
    assert.match(h, /txPorEtiqueta\('D\\&#039;Ana &quot;&lt;b&gt;&quot;'\)/);
    assert.doesNotMatch(h, /\sstyle=|\son[a-z]+=/);
  });
});

describe('contadas, ditas, com chip rápido e limpas', () => {
  beforeEach(monta);

  test('contam como UM filtro no funil, sejam uma ou várias, e a pesquisa soma-se à parte', () => {
    assert.equal(app.txFilterCount(), 0);
    app.txEtiq = ['Urgente'];
    assert.equal(app.txFilterCount(), 1);
    app.txEtiq = ['Urgente', 'Dedutível'];
    assert.equal(app.txFilterCount(), 1);
    app.txSearch = 'telhado';
    assert.equal(app.txFiltrosN(), 2);
    assert.match(app.txBarraHtml(), /aria-label="Filtros: 1 ativo"/);
  });

  test('o resumo diz as etiquetas, juntas por «ou»', () => {
    app.txEtiq = ['Urgente'];
    assert.equal(app.filterSummary(), 'etiqueta Urgente');
    app.txEtiq = ['Urgente', 'Dedutível'];
    assert.equal(app.filterSummary(), 'etiquetas Urgente ou Dedutível');
  });

  test('o chip rápido só aparece com etiquetas escolhidas: o texto abre o painel e o × limpa-as', () => {
    assert.doesNotMatch(app.txChipsHtml(), /mov-chip-etiq/);
    app.txEtiq = ['Urgente', 'Dedutível', 'A reembolsar'];
    const h = app.txChipsHtml();
    assert.match(h, /<span class="mov-chip on mov-chip-etiq">/);
    assert.match(h, /<span class="mov-chip-etiq-t">Urgente \+2<\/span>/);
    assert.match(h, /aria-label="Etiquetas: Urgente ou Dedutível ou A reembolsar\. Mudar nos filtros"[^>]*data-click="txEtiqAbrir\(\)"/);
    assert.match(h, /aria-label="Limpar as etiquetas"[^>]*data-click="txLimparFiltro\('etiq'\)"/);
    // com as etiquetas há dois filtros ou mais? Não: um só — o «Limpar» da fila fica só no ecrã largo
    assert.match(h, /class="chip limpar mov-so-largo"/);
  });

  test('o × do chip, o «Limpar» e o limpar dos estados vazios tiram as etiquetas', () => {
    app.txEtiq = ['Urgente'];
    app.txLimparFiltro('etiq');
    igual(app.txEtiq, []);
    app.txEtiq = ['Urgente']; app.txFilter = 'expense';
    app.clearTxFilters();
    igual(app.txEtiq, []);
    assert.equal(app.txFilter, '');
    app.txEtiq = ['Dedutível'];
    app.txFiltrosLimpar();
    igual(app.txEtiq, []);
  });

  test('um filtro comum não está ligado com etiquetas escolhidas, que ele não guarda', () => {
    const f = { id: 'F1', name: 'Despesas', kind: 'expense' };
    app.txFilter = 'expense';
    assert.equal(app.txComumLigado(f), true);
    app.txEtiq = ['Urgente'];
    assert.equal(app.txComumLigado(f), false);
  });
});
