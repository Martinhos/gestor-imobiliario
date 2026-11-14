// As rendas antigas de um contrato que vem de trás (tickets de QA KAN-131 e
// KAN-132): um contrato já terminado não tem planeado de renda, e mesmo assim
// tem um plano (planeados.js:ctPlanoTerminado) com as rendas que lhe faltam
// (planeados.js:ctRendasEmFalta); a janela do preenchimento
// (cloud/painel.js:CW.fillContrato) abre-se para ele e regista-as; e o valor
// de cada período escreve-se na janela (cloud/painel.js:fillLista) — vazio,
// esse período não se regista.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar, repor } from './arnes.js';

const HOJE = '2026-11-14';

/* Uma casa, uma inquilina e um contrato de 500 €/mês, pago ao dia 5, de
   01/01/2025 a 30/06/2025 (já terminado); as janelas apanhadas.
   Recebe: tudo — a app inteira (carregarTudo).
   Devolve: {c, corpo} — o contrato e uma função que devolve a última janela. */
function base(tudo) {
  limpar(tudo);
  tudo.db.owners = [tudo.normPerson({ id: 'eu', name: 'Eu' })];
  tudo.db.tenants = [tudo.normPerson({ id: 'I1', name: 'Ana' })];
  tudo.db.properties = [tudo.normProp({ id: 'P1', name: 'T2 Soure', use: 'investimento', ownerIds: ['eu'] })];
  const c = tudo.normContract({ id: 'C1', propertyId: 'P1', tenantIds: ['I1'], rent: 500, payDay: 5, start: '2025-01-01', end: '2025-06-30' });
  tudo.db.contracts = [c];
  tudo.db.recurring = [];
  tudo.db.transactions = [];
  let ultima = '';
  tudo.openModal = (t, b, f) => { ultima = t + '|' + b + '|' + (f || ''); };
  ['save', 'buildNav', 'render', 'toast', 'closeModal', 'closeAllModals'].forEach((n) => { tudo[n] = () => {}; });
  tudo.CW.fillNext = () => {};
  return { c, corpo: () => ultima };
}

describe('o plano de um contrato terminado (planeados.js)', () => {
  test('não tem planeado, mas tem as seis rendas do contrato em falta, e as já registadas saem', () => {
    const tudo = carregarTudo({ hoje: HOJE });
    try {
      const { c } = base(tudo);
      tudo.syncContractRec(c);
      assert.equal(tudo.ctRecOf(c), undefined, 'um contrato terminado não ganha planeado');
      assert.deepEqual([...tudo.ctRendasEmFalta(c)], ['2025-01-05', '2025-02-05', '2025-03-05', '2025-04-05', '2025-05-05', '2025-06-05']);
      tudo.db.transactions.push(tudo.normTx({ kind: 'income', label: 'Renda', amount: 500, date: '2025-03-07', propertyId: 'P1', contractId: 'C1', category: 'Rendas' }));
      assert.equal(tudo.ctRendasEmFalta(c).length, 5);
      assert.ok(!tudo.ctRendasEmFalta(c).includes('2025-03-05'));
    } finally { repor(tudo); }
  });

  test('um contrato em vigor, sem renda ou sem início não tem este plano', () => {
    const tudo = carregarTudo({ hoje: HOJE });
    try {
      const { c } = base(tudo);
      assert.equal(tudo.ctPlanoTerminado(Object.assign({}, c, { end: '2027-01-01' })), null);
      assert.equal(tudo.ctPlanoTerminado(Object.assign({}, c, { rent: 0 })), null);
      assert.equal(tudo.ctPlanoTerminado(Object.assign({}, c, { start: '' })), null);
    } finally { repor(tudo); }
  });
});

describe('a janela do preenchimento (cloud/painel.js)', () => {
  test('abre para um contrato terminado, sem «Começar a partir de hoje», e regista as rendas ao valor do contrato', () => {
    const tudo = carregarTudo({ hoje: HOJE });
    try {
      const { corpo } = base(tudo);
      tudo.CW.fillContrato('C1');
      assert.match(corpo(), /^Preencher 6 períodos\|/);
      assert.match(corpo(), /com o valor do contrato/);
      assert.doesNotMatch(corpo(), /Começar a partir de hoje/);
      assert.match(corpo(), /CW\.doFillContrato\('C1'\)/);
      assert.equal((corpo().match(/id="fill_v_\d+"/g) || []).length, 6, 'uma linha de valor por mês');
      tudo.CW.doFillContrato('C1');
      const est = tudo.db.transactions.filter((t) => /estimativa/.test(t.label));
      assert.equal(est.length, 6);
      assert.ok(est.every((t) => t.amount === 500 && t.contractId === 'C1' && t.kind === 'income'));
      assert.equal(tudo.ctRendasEmFalta(tudo.contract('C1')).length, 0);
    } finally { repor(tudo); }
  });

  test('o valor de cada mês é o escrito na lista, e um vazio fica por registar', () => {
    const tudo = carregarTudo({ hoje: HOJE });
    try {
      base(tudo);
      const campos = ['480', '480,50', '', '0', '500', '520'].map((value) => ({ value }));
      const antes = tudo.document.querySelectorAll;
      tudo.document.querySelectorAll = (s) => (s === '#fill_lista input' ? campos : antes.call(tudo.document, s));
      try { tudo.CW.doFillContrato('C1'); } finally { tudo.document.querySelectorAll = antes; }
      const est = tudo.db.transactions.filter((t) => /estimativa/.test(t.label)).sort((a, b) => a.date.localeCompare(b.date));
      assert.deepEqual(est.map((t) => [t.date, t.amount]), [['2025-01-05', 480], ['2025-02-05', 480.5], ['2025-05-05', 500], ['2025-06-05', 520]]);
    } finally { repor(tudo); }
  });

  test('sem valor nenhum, não regista e diz o erro junto da lista', () => {
    const tudo = carregarTudo({ hoje: HOJE });
    try {
      base(tudo);
      const erros = [];
      tudo.falhaCampo = (id, msg) => { erros.push([id, msg]); };
      const vazios = [0, 1, 2, 3, 4, 5].map(() => ({ value: '' }));
      const antes = tudo.document.querySelectorAll;
      tudo.document.querySelectorAll = (s) => (s === '#fill_lista input' ? vazios : antes.call(tudo.document, s));
      try { tudo.CW.doFillContrato('C1'); } finally { tudo.document.querySelectorAll = antes; }
      assert.equal(tudo.db.transactions.length, 0);
      assert.deepEqual(erros, [['fill_v_0', 'Escreve o valor de pelo menos um período.']]);
    } finally { repor(tudo); }
  });

  test('ao adicionar um contrato já terminado, o offerFill abre-lhe a janela uma vez', () => {
    const tudo = carregarTudo({ hoje: HOJE });
    try {
      base(tudo);
      tudo.CW.user = { id: 'U1', name: 'Maria', email: 'm@x.pt' };
      tudo.modalStack.length = 0;
      const novo = tudo.db.contracts.pop();
      tudo.refreshKnown();
      tudo.db.contracts.push(novo);
      const abertos = [];
      tudo.CW.fillContrato = (id) => abertos.push(id);
      tudo.offerFill();
      tudo.offerFill();
      assert.deepEqual(abertos, ['C1']);
    } finally { repor(tudo); }
  });
});
