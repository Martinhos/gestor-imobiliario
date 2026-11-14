// O aviso do Modelo 2 e o da comunicação de fevereiro, na ficha do contrato,
// levam ao cartão «Perante a AT» (ticket de QA KAN-133): o botão «Ver na
// ficha» (contrato.js:ctPrazoDaFicha) chama o contrato.js:ctIrParaAt, que
// encontra o cartão pela classe ct-sec-at (contrato.js:ctAtDaFicha). Os
// outros avisos não o têm.

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-14' });
afterEach(() => repor(app));

test('«Ver na ficha» no Modelo 2 e em fevereiro, e só aí; o cartão da AT tem a classe por onde se encontra', () => {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'eu', name: 'Eu' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Soure', use: 'investimento', ownerIds: ['eu'] })];
  const c = app.normContract({ id: 'C1', propertyId: 'P1', rent: 500, payDay: 5, start: '2026-10-01', end: '2027-09-30' });
  app.db.contracts = [c];
  const prazo = (tipo) => app.ctPrazoDaFicha(c, { tipo, chave: tipo + ':C1', alvo: '2026-11-30', dias: 16, sub: 'Frase.' });
  assert.match(prazo('modelo2'), /data-click="ctIrParaAt\(\)">Ver na ficha<\/button>/);
  assert.match(prazo('fev15'), /Ver na ficha/);
  assert.doesNotMatch(prazo('oposicao'), /Ver na ficha/);
  assert.doesNotMatch(prazo('cessacao'), /Ver na ficha/);
  assert.match(app.ctAtDaFicha(c), /class="card ct-sec ct-sec-at"/);
});
