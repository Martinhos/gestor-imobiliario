// Os dados de exemplo e a oferta de preencher os períodos em falta
// (cloud/painel.js:offerFill): os planeados que o seed() cria ficam logo
// conhecidos, e a janela «Preencher N períodos» não abre por cima dos
// Imóveis para rendas de contratos inventados. Um planeado criado depois, de
// um contrato antigo, continua a ter a oferta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo } from './arnes.js';

test('o seed() não deixa o offerFill abrir o «Preencher», e um planeado novo depois dele continua a tê-lo', () => {
  const app = carregarTudo();
  app.render = () => {}; app.buildNav = () => {}; app.toast = () => {};
  app.CW.user = { id: 'U1', name: 'Maria', email: 'm@x.pt' };
  app.CW.ambiente = 'desenvolvimento';   // o seed() recusa-se em produção
  app.refreshKnown();
  app.seed();
  app.clearTimeout(app.pushTimer);
  const abertos = [];
  app.CW.fillMissed = (id) => abertos.push(id);
  app.modalStack.length = 0;
  app.offerFill();
  assert.deepEqual(abertos, [], 'nenhum planeado do exemplo leva a oferta');

  // um contrato antigo gravado depois: o planeado dele é novo e tem meses em falta
  const ref = app.db.recurring.find((r) => r.tx && r.tx.contractId) || app.db.recurring[0];
  const novo = JSON.parse(JSON.stringify(ref));
  novo.id = 'R-NOVO';
  novo.every = 'month';
  novo.next = app.addDays(app.today(), -70);   // começou há dois meses e meio: tem meses em falta, seja que dia for
  app.db.recurring.push(novo);
  const falta = app.datasEmFalta(novo).length;
  assert.ok(falta >= 2 && !(novo.tx || {}).loanId, 'um planeado de contrato com meses em falta (' + falta + ')');
  app.offerFill();
  assert.deepEqual(abertos, ['R-NOVO'], 'o planeado novo continua a ter a oferta');
});
