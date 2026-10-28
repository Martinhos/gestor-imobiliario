// Uma hipoteca que começa no futuro tem a primeira prestação no mês do início,
// e não no mês de hoje (ticket de QA 234da7c3): o planeado da prestação nasce
// lá (planeados.js:syncLoanRec), um planeado que já existia e ficou antes do
// início novo anda para lá, e o plano da amortização começa nessa prestação
// (creditos.js:credPrimeiraData, creditos.js:planoLinhas). As hipotecas que
// já começaram ficam como estavam (credito.js:primeiraPrestacao).
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-10-28' });
beforeEach(() => { limpar(app); app.render = () => {}; app.buildNav = () => {}; app.toast = () => {}; });
afterEach(() => repor(app));

/* Um imóvel com uma hipoteca que começa no dia dado.
   Recebe: start — o início, 'AAAA-MM-DD'.
   Devolve: a hipoteca, já com o planeado sincronizado. */
function hipoteca(start) {
  app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
  const l = app.normLoan({ id: 'h', name: 'Casa', outstanding: 120000, years: 30, type: 'fixa', rate: 3, start });
  app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa Soure', ownerIds: ['o1'], loans: [l] }));
  app.syncAllLoanRecs();
  return app.findLoan(app.prop('p1'), 'h');
}
const proxima = () => app.db.recurring.find((r) => r.auto && r.tx.loanId === 'h').next;

describe('a hipoteca com início no futuro', () => {
  test('o planeado da prestação nasce no mês do início, no dia dele', () => {
    hipoteca('2027-01-01');
    assert.equal(proxima(), '2027-01-01');
  });

  test('o plano da amortização começa em janeiro de 2027, e não em outubro de 2026', () => {
    const l = hipoteca('2027-01-01');
    assert.equal(app.credPrimeiraData(l), '2027-01-01');
    assert.equal(app.planoLinhas(l).meses[0].rot, 'jan 2027');
    assert.equal(app.yearRows(l).yrs[0].yr, 2027);
  });

  test('mudar o início para o futuro leva o planeado que já existia', () => {
    const l = hipoteca('2020-03-15');
    assert.equal(proxima(), '2026-11-15', 'a de novembro: a de 15 de outubro já passou');
    l.start = '2027-01-15';
    app.syncAllLoanRecs();
    assert.equal(proxima(), '2027-01-15');
  });

  test('com os Planeados sem a prestação, o plano também não começa antes do início', () => {
    const l = hipoteca('2027-02-10');
    app.db.recurring = [];
    assert.equal(app.credPrimeiraData(l), '2027-02-10');
  });

  test('uma hipoteca que já começou fica como estava', () => {
    const l = hipoteca('2020-03-05');
    assert.equal(proxima(), '2026-11-05');
    assert.equal(app.credPrimeiraData(l), '2026-11-05');
    assert.equal(app.primeiraPrestacao({ start: '2020-03-30' }, '2026-10-28'), '2026-10-28', 'o dia fica preso aos 28');
    assert.equal(app.primeiraPrestacao({ start: '' }, '2026-10-28'), '2026-11-01', 'sem início, o dia 1 do mês seguinte');
  });
});
