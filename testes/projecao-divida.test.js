// O cartão «Dívida por amortizar» das Projeções. Sem créditos em uso, o
// gráfico era uma linha no zero com um eixo que dizia «1, 1, 1»; agora o
// cartão dá a boa notícia (projecoes.js:livreDeDividas), e o gráfico só
// aparece quando há dívida. E um gráfico de linhas todo a zero deixa de
// inventar marcas no eixo (graficos.js:axisY).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));

/* O corpo do cartão da dívida, tirado da vista inteira.
   Recebe: html — o que o vProjections devolveu.
   Devolve: o HTML do cartão «Dívida por amortizar». */
function cartaoDaDivida(html) {
  const i = html.indexOf('Dívida por amortizar');
  assert.ok(i > 0, 'o cartão existe');
  return html.slice(i, html.indexOf('Detalhe ano a ano', i));
}

let casa;
beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  casa = app.normProp({ id: 'casa', name: 'Casa', value: 200000, ownerIds: ['ana'] });
  app.db.properties.push(casa);
  app.db.contracts.push(app.normContract({ propertyId: 'casa', rent: 1000, active: true, increase: 0 }));
});

describe('a dívida por amortizar, nas Projeções', () => {
  test('sem créditos, o cartão celebra em vez de desenhar um zero', () => {
    const c = cartaoDaDivida(app.vProjections());
    assert.match(c, /<div class="livre">/);
    assert.match(c, /Boa! Não tens dívidas registadas\./);
    assert.doesNotMatch(c, /chartbox|<svg viewBox="0 0 360/, 'nenhum gráfico');
    assert.doesNotMatch(c, /Somando os créditos em uso/, 'nem o subtítulo de quem soma créditos');
  });

  test('um crédito já pago conta como sem dívida', () => {
    casa.loans = [{ id: 'L1', name: 'Aquisição', outstanding: 0, years: 30, rate: 3, start: '2000-01-01' }];
    assert.match(cartaoDaDivida(app.vProjections()), /Boa! Não tens dívidas registadas\./);
  });

  test('com um crédito em uso, o gráfico da dívida volta', () => {
    casa.loans = [{ id: 'L1', name: 'Aquisição', outstanding: 90000, years: 20, rate: 3, type: 'fixa', start: '2020-01-10' }];
    const c = cartaoDaDivida(app.vProjections());
    assert.match(c, /Somando os créditos em uso/);
    assert.match(c, /class="chartbox"/);
    assert.doesNotMatch(c, /class="livre"/);
  });
});

describe('um gráfico de linhas todo a zero', () => {
  /* As marcas do eixo, pela ordem do desenho.
     Recebe: html — o HTML do gráfico.
     Devolve: os textos das marcas do eixo Y (as de text-anchor="end"). */
  const marcas = (html) => [...html.matchAll(/text-anchor="end"[^>]*>([^<]*)</g)].map((m) => m[1]);

  test('o eixo só tem o zero — sem «0, 0, 1, 1, 1»', () => {
    assert.deepEqual(marcas(app.cLine([{ name: 'Em dívida', values: [0, 0, 0] }], ['26', '27', '28'])), ['0']);
    assert.deepEqual(marcas(app.cLine([{ name: 'LTV', values: [0, 0] }], ['26', '27'], { fmt: (v) => v + '%' })), ['0%']);
  });

  test('com valores, o eixo continua com as cinco marcas', () => {
    assert.equal(marcas(app.cLine([{ name: 'A', values: [0, 1000, 2000] }], ['26', '27', '28'])).length, 5);
  });
});
