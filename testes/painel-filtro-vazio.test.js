// O filtro da vista geral sem movimentos (o ticket de QA f6b36a57): o botão
// do cabeçalho acendia-se (anaOpen) e não abria nada, porque a vista vazia —
// a jornada, o «Ainda não há dados para mostrar» e o «Ainda não há nada
// registado» — não desenhava o painel do seletor. Agora abre o painel na
// mesma, com a frase que diz porquê e o «Adicionar movimento»
// (painel-geral.js:dashBarVazia). Com movimentos fica o seletor de sempre
// (painel-geral.js:dashBar). A app inteira, nuvem incluída, como no
// jornada.test.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar } from './arnes.js';

/* A app inteira, limpa, com sessão e já depois do primeiro estado, na vista
   geral.
   Devolve: o proxy da app. */
function montar() {
  const app = carregarTudo();
  limpar(app);
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
  app.CW._pulled = 1; app.CW._esperaFim = 1;
  app.tab = 'dashboard';
  return app;
}

// o painel de filtros aberto (o .fpanel.on), ou null
const painelAberto = (html) => (/<div class="fpanel on[^"]*"[\s\S]*?<div class="fp-pe">/.exec(html) || [null])[0];

/* Semeia um imóvel meu (e o registo de proprietário), para a vista vazia ser
   a da jornada ou a do «Ainda não há dados».
   Recebe: app — o proxy.
   Devolve: nada — escreve na db. */
function comImovel(app) {
  app.db.owners.push(app.normPerson({ id: 'EU', name: 'Eu', nif: '123456789' }));
  app.db.properties.push(app.normProp({ id: 'P1', name: 'T2 Arroios', use: 'investimento', value: 200000, purchase: 150000, ownerIds: ['EU'] }));
}

describe('o filtro da vista geral sem movimentos', () => {
  test('com o filtro aberto na jornada, o painel abre com a frase e o «Adicionar movimento»', () => {
    const app = montar();
    comImovel(app);
    assert.match(app.vDashboard(), /<!--jornada-->/, 'controlo: a vista é a jornada');
    assert.equal(painelAberto(app.vDashboard()), null, 'fechado, não há painel aberto');
    app.anaOpen.dashboard = true;
    const p = painelAberto(app.vDashboard());
    assert.ok(p, 'aberto, o painel está lá');
    assert.match(p, /Ainda não há movimentos/);
    assert.match(p, /Adiciona o primeiro/);
    assert.match(p, /<button type="button" class="btn primary" data-toca="camada" data-click="anaApply\(\);newTxPick\(\)">Adicionar movimento<\/button>/);
    assert.doesNotMatch(p, /dashPropSel/, 'sem o seletor, que não teria o que filtrar');
  });

  test('com a jornada dispensada (o «Ainda não há dados para mostrar») e sem imóveis, o mesmo painel', () => {
    const app = montar();
    comImovel(app);
    app.jornadaInicial = () => '';
    app.anaOpen.dashboard = true;
    let html = app.vDashboard();
    assert.match(html, /<!--sem-movimentos-->/, 'controlo: a vista do «Ainda não há dados»');
    assert.match(painelAberto(html) || '', /Ainda não há movimentos/);
    app.db.properties.length = 0;
    html = app.vDashboard();
    assert.match(html, /Ainda não há nada registado/, 'controlo: sem imóveis');
    assert.match(painelAberto(html) || '', /Ainda não há movimentos/);
  });

  test('com os Movimentos desligados nesta conta, a frase fica e o botão não', () => {
    const app = montar();
    comImovel(app);
    const ligado = app.servicoLigado;
    app.servicoLigado = (id) => id !== 'transactions' && ligado(id);
    app.anaOpen.dashboard = true;
    const p = painelAberto(app.vDashboard()) || '';
    assert.match(p, /Ainda não há movimentos/);
    assert.doesNotMatch(p, /Adicionar movimento/);
  });

  test('com movimentos, o painel é o do seletor, como antes', () => {
    const app = montar();
    comImovel(app);
    app.db.transactions.push(app.normTx ? app.normTx({ id: 'T1', kind: 'income', amount: 700, date: app.today(), propertyId: 'P1', cat: 'Renda' }) : { id: 'T1', kind: 'income', amount: 700, date: app.today(), propertyId: 'P1', cat: 'Renda' });
    app.anaOpen.dashboard = true;
    const p = painelAberto(app.vDashboard()) || '';
    assert.match(p, /dashPropSel/, 'o seletor do imóvel');
    assert.doesNotMatch(p, /Ainda não há movimentos/);
  });
});
