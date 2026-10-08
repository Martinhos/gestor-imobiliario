// O capital em dívida de uma hipoteca leva o asterisco dos obrigatórios, e
// por isso o guardar recusa-o em branco em todo o lado: na hipoteca nova, a
// editar uma hipoteca, e na ficha do imóvel (que tem as hipotecas numa dobra).
// Antes só a nova o recusava, e o campo dizia «obrigatório» e gravava-se vazio.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp();
afterEach(() => repor(app));

// um imóvel meu com uma hipoteca sem capital nem prestações registadas
// Devolve: os avisos (toasts) que a app mostrar.
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'],
    loans: [app.normLoan({ id: 'L1', name: 'Aquisição', outstanding: 0 })] })];
  janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
  const avisos = [];
  app.toast = (m) => { avisos.push(m); };
  return avisos;
}

describe('o capital da hipoteca é obrigatório', () => {
  test('a editar uma hipoteca sem capital, o guardar recusa e diz porquê', () => {
    const avisos = base();
    app.mortModal('P1', 'L1');
    app.collectProp = () => {};
    app.onSave();
    assert.deepEqual(avisos, ['Indica o capital em dívida.']);
  });

  test('a editar com o capital preenchido, guarda sem aviso', () => {
    const avisos = base();
    app.db.properties[0].loans[0].outstanding = 120000;
    app.mortModal('P1', 'L1');
    app.collectProp = () => {};
    app.onSave();
    assert.ok(!avisos.includes('Indica o capital em dívida.'), avisos.join(' | '));
  });

  test('na ficha do imóvel, uma hipoteca sem capital impede de guardar o imóvel', () => {
    const avisos = base();
    app.propModal('P1');
    app.collectProp = () => {};
    app.onSave();
    assert.deepEqual(avisos, ['Indica o capital em dívida.']);
  });

  test('na ficha do imóvel, com os Créditos desligados, as hipotecas não se julgam (não estão no ecrã)', () => {
    const avisos = base();
    app.definirServicosDesligados(['credits']);
    try {
      app.propModal('P1');
      app.collectProp = () => {};
      app.onSave();
      assert.ok(!avisos.includes('Indica o capital em dívida.'), avisos.join(' | '));
    } finally {
      app.definirServicosDesligados([]);
    }
  });
});
