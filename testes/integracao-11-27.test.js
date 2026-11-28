// O planeado suspenso pelo inquilino e o resto de uma renda paga em parte
// também fora dos Planeados (2026-11-27, KAN-129-3 e KAN-129-4): o
// calendário não mostra as ocorrências de um encargo que o inquilino paga; o
// «Pede atenção» da vista geral conta o resto, e não a renda inteira; e a
// linha do contrato na ficha do inquilino diz as rendas por receber, com o
// resto «em dívida».
//
// O dia da app é fixo (2026-11-27).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-27' });
afterEach(() => repor(app));

/* Os espaços duros dos euros (euro2) como espaços, para os comparar com o texto. */
const N = (s) => String(s).replace(/[  ]/g, ' ');

/* Um imóvel, uma inquilina e um contrato de 800 € desde fevereiro.
   Recebe: extra (opcional) — campos do contrato.
   Devolve: o contrato guardado em db.contracts. */
function monta(extra) {
  limpar(app);
  app.CW = { user: { id: 'O1' }, _pulled: 1, _esperaFim: 1 };
  app.window.CW = app.CW;
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana', nif: '123456789' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Olivais', use: 'investimento', ownerIds: ['O1'], purchaseDate: '2019-05-06' })];
  app.db.contracts = [app.normContract(Object.assign({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'], rent: 800, payDay: 1,
    start: '2026-02-01', fisco: { estado: 'declarado', finalidade: 'hp', numero: '1234567' } }, extra || {}))];
  app.db.transactions = [];
  app.db.recurring = [];
  return app.db.contracts[0];
}
/* Uma renda do contrato C1 num mês.
   Recebe: mes — 'AAAA-MM'; valor; parcial (opcional). */
const renda = (mes, valor, parcial) => app.db.transactions.push(app.normTx({ kind: 'income', label: 'Renda', amount: valor, date: mes + '-01',
  propertyId: 'P1', contractId: 'C1', category: 'Rendas', sub: 'Renda mensal', periodo: mes, parcial: !!parcial }));

describe('KAN-129-3 · o calendário não mostra um encargo que o inquilino paga', () => {
  test('marcado o condomínio no contrato, as ocorrências do planeado saem do calendário; desmarcado, voltam', () => {
    const c = monta({ start: '2025-04-01' });
    app.db.recurring = [app.normRec({ id: 'R1', name: 'Condomínio · T2 Olivais', every: 'month', next: '2026-12-01',
      tx: { kind: 'expense', label: 'Quota do condomínio', amount: 45, propertyId: 'P1', category: 'Condomínio', sub: 'Quota mensal' } })];
    const doR1 = () => app.calPlaneados('2026-12-01', '2027-02-28').filter((o) => o.rec.id === 'R1').map((o) => o.date);
    assert.deepEqual([...doR1()], ['2026-12-01', '2027-01-01', '2027-02-01'], 'antes, três quotas');
    c.encargosInquilino = ['condominio'];
    assert.deepEqual([...doR1()], [], 'a cargo do inquilino: nenhuma');
    c.encargosInquilino = [];
    assert.equal(doR1().length, 3, 'desmarcado: voltam');
  });
});

describe('KAN-129-4 · o resto da renda paga em parte fora dos Planeados', () => {
  /* rendas de fevereiro a agosto inteiras, setembro paga com 500 €, outubro e novembro por pagar */
  function comParcial() {
    const c = monta();
    for (let m = 2; m <= 8; m++) renda('2026-' + String(m).padStart(2, '0'), 800);
    renda('2026-09', 500, true);
    app.syncAllContractRecs();
    return c;
  }

  test('o «Pede atenção» da vista geral soma o resto (300 €), e não a renda inteira', () => {
    const c = comParcial(), r = app.ctRecOf(c);
    assert.equal(app.recMontanteAPedir(r), 300);
    const h = N(app.pedeAtencao());
    assert.match(h, /300,00 €/);
    assert.doesNotMatch(h, /800,00 €/);
  });

  test('a ficha do inquilino diz as rendas por receber, com o resto em dívida', () => {
    const c = comParcial();
    const h = N(app.pesLinhaContrato(c, 'ativo'));
    assert.match(h, /Por receber: setembro 300,00 € em dívida · outubro 800,00 € · novembro 800,00 €/);
  });

  test('com a renda em dia, a linha não fala de rendas por receber', () => {
    const c = monta();
    for (let m = 2; m <= 11; m++) renda('2026-' + String(m).padStart(2, '0'), 800);
    app.syncAllContractRecs();
    assert.doesNotMatch(app.pesLinhaContrato(c, 'ativo'), /Por receber/);
  });
});
