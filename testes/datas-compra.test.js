// Nada de uma casa começa antes de ela ser comprada: o início de um contrato,
// a data de uma receita de uma casa só (as despesas e os outros tipos entram
// com qualquer data) e o início de uma hipoteca recusam-se
// antes da data de compra da ficha, com o erro junto do campo e a data como
// se escreve em Portugal. Sem data de compra não há limite; um registo antigo
// que já estava antes grava-se quando se mexe noutro campo. E o preenchimento
// das rendas em falta (planeados.js:datasEmFalta, o cursor da renda e a
// janela do cloud/painel.js) nunca começa antes da compra — um contrato
// «desde 1870» numa casa comprada em 2020 propunha as 600 rendas de 1870 a
// 1919 — e, havendo teto, fica com as mais recentes até hoje.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const HOJE = '2026-10-29';
const COMPRA = '2020-03-12';
const ERRO_CT = 'O imóvel foi comprado a 12/03/2020: o contrato não pode começar antes.';
const ERRO_TX = 'O imóvel foi comprado a 12/03/2020: uma receita não pode ser de antes.';
const ERRO_HIP = 'O imóvel foi comprado a 12/03/2020: a hipoteca não pode começar antes.';

const app = carregarApp({ hoje: HOJE });
afterEach(() => repor(app));

/* Uma proprietária, uma inquilina e duas casas de arrendamento: a P1 comprada
   a 12/03/2020 e a P2 sem data de compra; um grupo com as duas. As janelas
   numa pilha, o falhaCampo apanhado e o que grava calado.
   Devolve: {abertas, erros} — as janelas abertas e os [campo, frase] dos erros. */
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'eu', name: 'Eu' })];
  app.db.tenants = [app.normPerson({ id: 'I1', name: 'Ana' })];
  app.db.properties = [
    app.normProp({ id: 'P1', name: 'T2 Soure', use: 'investimento', ownerIds: ['eu'], purchaseDate: COMPRA }),
    app.normProp({ id: 'P2', name: 'T1 Porto', use: 'investimento', ownerIds: ['eu'] }),
  ];
  app.db.groups = [app.normGroup({ id: 'G', name: 'Bloco', kind: 'prop', ids: ['P1', 'P2'] })];
  app.modalStack.length = 0;
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'refreshDetail', 'toast');
  const erros = [];
  app.falhaCampo = (id, msg) => { erros.push([id, msg]); };
  return { abertas, erros };
}

const el = (id) => app.document.getElementById(id);

describe('a regra, num só sítio (imovel.js:antesDaCompra)', () => {
  test('antes da compra devolve a data de compra em DD/MM/AAAA; igual, depois, sem data ou sem compra, nada', () => {
    base();
    assert.equal(app.dataDeCompra('P1'), COMPRA);
    assert.equal(app.dataDeCompra(app.prop('P1')), COMPRA, 'aceita o imóvel do formulário');
    assert.equal(app.dataDeCompra('P2'), '');
    assert.equal(app.dataDeCompra(null), '');
    assert.equal(app.antesDaCompra('P1', '1870-01-01'), '12/03/2020');
    assert.equal(app.antesDaCompra('P1', '2020-03-11'), '12/03/2020');
    assert.equal(app.antesDaCompra('P1', COMPRA), '', 'no próprio dia vale');
    assert.equal(app.antesDaCompra('P1', '2024-01-01'), '');
    assert.equal(app.antesDaCompra('P1', ''), '', 'sem data não se confere');
    assert.equal(app.antesDaCompra('P2', '1870-01-01'), '', 'sem data de compra não há limite');
    assert.equal(app.antesDaCompra('', '1870-01-01'), '', 'sem imóvel não há limite');
  });
});

describe('o início do contrato', () => {
  /* Abre o formulário de um contrato novo na casa, com a renda escrita.
     Recebe: casa — o id do imóvel; inicio — o que se escreve no início.
     Devolve: quantas vezes o contrato se gravou depois do Guardar. */
  function guardarNovo(casa, inicio) {
    let gravou = 0;
    app.ctGravar = () => { gravou++; };
    app.ctModal(null, casa, 'I1');
    el('c_prop').value = casa;
    el('c_rent').value = '400';
    el('c_start').value = inicio;
    el('c_end').value = '';
    app.onSave();
    return gravou;
  }

  test('antes da compra recusa-se, com o erro junto do início; no dia da compra ou depois grava', () => {
    const { erros } = base();
    assert.equal(guardarNovo('P1', '1870-01-01'), 0);
    assert.deepEqual(erros, [['c_start', ERRO_CT]]);
    erros.length = 0;
    assert.equal(guardarNovo('P1', COMPRA), 1, 'no próprio dia');
    assert.equal(guardarNovo('P1', '2023-09-01'), 1, 'depois');
    assert.deepEqual(erros, []);
  });

  test('sem data de compra na casa não há limite', () => {
    const { erros } = base();
    assert.equal(guardarNovo('P2', '1870-01-01'), 1);
    assert.deepEqual(erros, []);
  });

  test('num quarto, a casa é a do quarto', () => {
    const { erros } = base();
    Object.assign(app.db.properties[0], { rentalMode: 'quartos', rooms: [{ id: 'Q1', name: 'Quarto 1' }] });
    let gravou = 0;
    app.ctGravar = () => { gravou++; };
    app.ctModal(null, 'P1', 'I1');
    el('c_prop').value = 'P1'; el('c_rent').value = '300'; el('c_room').value = 'Q1'; el('c_start').value = '2019-12-01';
    app.onSave();
    assert.equal(gravou, 0);
    assert.deepEqual(erros, [['c_start', ERRO_CT]]);
  });

  test('um contrato antigo, já antes da compra, grava-se quando se mexe noutro campo; mudar-lhe o início confere', () => {
    const { erros } = base();
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', tenantIds: ['I1'], rent: 500, start: '1870-01-01' })];
    let gravou = 0;
    app.ctGravar = () => { gravou++; };
    app.ctModal('C1');
    el('c_prop').value = 'P1'; el('c_rent').value = '550'; el('c_start').value = '1870-01-01'; el('c_end').value = '';
    app.onSave();
    assert.equal(gravou, 1, 'a renda mudou, o início não');
    assert.deepEqual(erros, []);
    app.ctModal('C1');
    el('c_prop').value = 'P1'; el('c_rent').value = '550'; el('c_start').value = '1880-01-01';
    app.onSave();
    assert.equal(gravou, 1);
    assert.deepEqual(erros, [['c_start', ERRO_CT]], 'o início mudou e continua antes');
  });

  test('o calendário do início não oferece os dias de antes da compra (min), a não ser num contrato que já lá estava', () => {
    const { abertas } = base();
    app.ctModal(null, 'P1', 'I1');
    assert.match(abertas.at(-1).b, /<input id="c_start" type="date" value="[^"]*" data-change="ctInicioMudou\(\)" min="2020-03-12">/);
    app.ctModal(null, 'P2', 'I1');
    assert.match(abertas.at(-1).b, /<input id="c_start" type="date" value="[^"]*" data-change="ctInicioMudou\(\)">/, 'sem compra, sem min');
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', tenantIds: ['I1'], rent: 500, start: '1870-01-01' })];
    app.ctModal('C1');
    assert.match(abertas.at(-1).b, /<input id="c_start" type="date" value="1870-01-01" data-change="ctInicioMudou\(\)">/, 'o campo não nasce inválido');
  });
});

describe('a data de um movimento', () => {
  /* Abre o formulário de um movimento (o collectTx calado: o tForm é o que se escreve).
     Recebe: o — o que o txModal recebe; campos — o que se escreve no tForm.
     Devolve: o id do movimento do formulário. */
  function escrever(o, campos) {
    app.collectTx = () => {};
    app.txModal(o);
    Object.assign(app.tForm, campos);
    return app.tForm.id;
  }
  const gravado = (id) => app.db.transactions.some((t) => t.id === id);

  test('uma receita de uma casa antes da compra recusa-se junto da data; no dia ou depois grava', () => {
    const { erros } = base();
    let id = escrever({ kind: 'income', propId: 'P1' }, { label: 'Renda', amount: 500, date: '2019-06-01' });
    app.onSave();
    assert.equal(gravado(id), false);
    assert.deepEqual(erros, [['t_date', ERRO_TX]]);
    erros.length = 0;
    id = escrever({ kind: 'income', propId: 'P1' }, { label: 'Renda', amount: 500, date: COMPRA });
    app.onSave();
    assert.equal(gravado(id), true);
    assert.deepEqual(erros, []);
  });

  test('as despesas, as prestações e os outros tipos entram com qualquer data («Despesas podem»)', () => {
    const { erros } = base();
    let id = escrever({ kind: 'expense', propId: 'P1' }, { label: 'Sinal do contrato-promessa', amount: 8000, date: '2019-06-01' });
    app.onSave();
    assert.equal(gravado(id), true, 'despesa');
    id = escrever({ kind: 'owed', propId: 'P1' }, { label: 'Empréstimo da família', amount: 5000, date: '2019-06-01', creditor: 'Pai' });
    app.onSave();
    assert.equal(gravado(id), true, 'dívida a terceiros');
    assert.deepEqual(erros, []);
  });

  test('mudar de despesa para receita com a data antes da compra recusa-se', () => {
    const { erros } = base();
    const id = escrever({ kind: 'expense', propId: 'P1' }, { label: 'Renda', amount: 500, date: '2019-06-01' });
    app.setKind('income');
    Object.assign(app.tForm, { label: 'Renda', amount: 500, date: '2019-06-01' });
    app.onSave();
    assert.equal(gravado(id), false);
    assert.deepEqual(erros, [['t_date', ERRO_TX]]);
  });

  test('sem data de compra, sem imóvel, ou de um grupo: não se confere', () => {
    const { erros } = base();
    let id = escrever({ kind: 'income', propId: 'P2' }, { label: 'Renda', amount: 500, date: '1990-01-01' });
    app.onSave();
    assert.equal(gravado(id), true, 'casa sem data de compra');
    id = escrever({ kind: 'income' }, { label: 'Juros', amount: 80, date: '1990-01-01', propertyId: null, groupId: null, todos: false });
    app.onSave();
    assert.equal(gravado(id), true, 'sem imóvel');
    id = escrever({ kind: 'income' }, { label: 'Subsídio', amount: 90, date: '2019-01-01', propertyId: null, groupId: 'G', todos: false, psplit: { mode: 'equal', parts: {} } });
    app.onSave();
    assert.equal(app.partesDoLote(id).length, 2, 'o de um grupo parte-se e grava');
    assert.deepEqual(erros, []);
  });

  test('uma receita antiga, já antes da compra, grava-se ao mexer no montante; mudar-lhe a data confere', () => {
    const { erros } = base();
    app.db.transactions = [app.normTx({ id: 'M1', kind: 'income', label: 'Renda', amount: 80, date: '2010-05-01', propertyId: 'P1' })];
    app.collectTx = () => {};
    app.txModal({ id: 'M1' });
    app.tForm.amount = 90;
    app.onSave();
    assert.equal(app.db.transactions.find((t) => t.id === 'M1').amount, 90);
    assert.deepEqual(erros, []);
    app.txModal({ id: 'M1' });
    app.tForm.date = '2011-05-01';
    app.onSave();
    assert.equal(app.db.transactions.find((t) => t.id === 'M1').date, '2010-05-01', 'não gravou');
    assert.deepEqual(erros, [['t_date', ERRO_TX]]);
  });

  test('um planeado não se confere (a data é a próxima ocorrência, não um facto)', () => {
    const { erros } = base();
    app.db.recurring = [];
    escrever({ kind: 'income', propId: 'P1', modo: 'rec' }, { label: 'Renda', amount: 400, date: '2019-01-01' });
    app.onSave();
    assert.equal(app.db.recurring.length, 1);
    assert.deepEqual(erros, []);
  });

  test('o campo da data leva o min da compra numa receita de uma casa só, e acompanha o tipo', () => {
    const { abertas } = base();
    const comMin = /<input id="t_date" type="date" value="2026-10-29" data-change="txDataMudou\(\)" min="2020-03-12">/;
    const semMin = /<input id="t_date" type="date" value="2026-10-29" data-change="txDataMudou\(\)">/;
    app.txModal({ kind: 'income', propId: 'P1' });
    assert.match(abertas.at(-1).b, comMin);
    app.txModal({ kind: 'income', propId: 'P2' });
    assert.match(abertas.at(-1).b, semMin, 'sem data de compra');
    app.txModal({ kind: 'expense', propId: 'P1' });
    assert.match(abertas.at(-1).b, semMin, 'uma despesa');
    // mudar o tipo repinta o formulário, e o min vem com a receita
    let corpo = '';
    app.collectTx = () => {};   // o formulário deste DOM não tem o imóvel escolhido: o tForm é o que vale
    app.repaintTx = () => { corpo = app.txBody(); };
    app.setKind('income');
    assert.match(corpo, comMin);
  });
});

describe('o início de uma hipoteca', () => {
  test('na janela da hipoteca: antes da compra recusa-se junto do início; no dia da compra grava', () => {
    const { erros } = base();
    app.perguntarPrestacoesEmFalta = () => {};
    app.collectProp = () => {};
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('P1'))));
    const l = app.normLoan({ name: 'Aquisição', outstanding: 100000, start: '2019-05-01' });
    app.pForm.loans.push(l);
    app.mortOpen(l.id, true);
    app.onSave();
    assert.deepEqual(erros, [['l_start_' + l.id, ERRO_HIP]]);
    assert.equal(app.prop('P1').loans.length, 0, 'nada gravado');
    erros.length = 0;
    l.start = COMPRA;
    app.onSave();
    assert.deepEqual(erros, []);
    assert.equal(app.prop('P1').loans.length, 1);
  });

  test('sem data de compra não há limite; uma hipoteca antiga já antes grava-se ao mexer noutro campo', () => {
    const { erros } = base();
    app.perguntarPrestacoesEmFalta = () => {};
    app.collectProp = () => {};
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('P2'))));
    const l = app.normLoan({ name: 'Aquisição', outstanding: 100000, start: '1990-05-01' });
    app.pForm.loans.push(l);
    app.mortOpen(l.id, true);
    app.onSave();
    assert.equal(app.prop('P2').loans.length, 1, 'casa sem data de compra');
    // uma hipoteca de 2015 na casa comprada em 2020 (gravada antes da regra)
    app.db.properties[0].loans = [app.normLoan({ id: 'L0', name: 'Antiga', outstanding: 50000, start: '2015-01-10' })];
    app.mortModal('P1', 'L0');
    app.pForm.loans[0].bank = 'Banco';
    app.onSave();
    assert.equal(app.prop('P1').loans[0].bank, 'Banco');
    app.mortModal('P1', 'L0');
    app.pForm.loans[0].start = '2016-01-10';
    app.onSave();
    assert.equal(app.prop('P1').loans[0].start, '2015-01-10', 'o início mudou e continua antes: não grava');
    assert.deepEqual(erros, [['l_start_L0', ERRO_HIP]]);
  });

  test('na ficha do imóvel: a hipoteca nova antes da compra recusa-se; mudar a data de compra para depois de uma que já lá está não', () => {
    const { erros } = base();
    app.perguntarPrestacoesEmFalta = () => {};
    app.collectProp = () => {};
    app.db.properties[0].loans = [app.normLoan({ id: 'L0', name: 'Antiga', outstanding: 50000, start: '2020-04-10' })];
    app.propModal('P1');
    app.pForm.purchaseDate = '2021-01-01';
    app.onSave();
    assert.deepEqual(erros, []);
    assert.equal(app.prop('P1').purchaseDate, '2021-01-01', 'a data de compra muda sem recusar');
    app.propModal('P1');
    const l = app.normLoan({ name: 'Obras', outstanding: 20000, start: '2020-06-01' });
    app.pForm.loans.push(l);
    app.onSave();
    assert.deepEqual(erros, [['l_start_' + l.id, 'O imóvel foi comprado a 01/01/2021: a hipoteca não pode começar antes.']]);
    assert.equal(app.prop('P1').loans.length, 1);
  });

  test('o calendário do início leva o min da compra', () => {
    base();
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('P1'))));
    const l = app.normLoan({ id: 'LN', name: 'Aquisição', outstanding: 100000 });
    assert.match(app.loanSect(l, 0), /<input id="l_start_LN" type="date" value="" min="2020-03-12">/);
  });
});

describe('as rendas em falta não começam antes da compra', () => {
  /* Um contrato «desde 1870» na casa, com a renda a 5, e a recorrência dele.
     Recebe: casa — o id do imóvel.
     Devolve: {c, r} — o contrato e o planeado da renda. */
  function desde1870(casa) {
    base();
    app.db.recurring = [];
    app.db.transactions = [];
    const c = app.normContract({ id: 'C1', propertyId: casa, tenantIds: ['I1'], rent: 500, payDay: 5, start: '1870-01-01' });
    app.db.contracts = [c];
    app.syncContractRec(c);
    return { c, r: app.ctRecOf(c) };
  }

  test('o cursor da renda pára no primeiro dia de pagamento desde a compra', () => {
    const { c, r } = desde1870('P1');
    assert.equal(r.next, '2020-04-05', 'a 5 de março ainda não era dela');
    assert.equal(app.cursorDaRenda(c, '1870-01-05', '1870-01-05', 5), '2020-04-05');
    // um cursor velho, décadas atrás, salta para a compra no sync seguinte
    r.next = '1930-01-05';
    app.syncContractRec(c);
    assert.equal(app.ctRecOf(c).next, '2020-04-05');
    // comprada no dia 3: a renda do dia 5 desse mês já conta
    app.db.properties[0].purchaseDate = '2020-03-03';
    app.syncContractRec(c);
    assert.equal(app.ctRecOf(c).next, '2020-03-05');
  });

  test('as datas em falta vão da compra até hoje, nenhuma antes', () => {
    const { r } = desde1870('P1');
    const d = app.datasEmFalta(r);
    assert.equal(d[0], '2020-04-05');
    assert.equal(d.at(-1), '2026-10-05');
    assert.equal(d.length, 79, 'abr 2020 a out 2026');
    assert.ok(d.every((x) => x >= COMPRA));
    assert.equal(app.origemDoPlano(r), COMPRA);
    assert.equal(app.origemDoPlano(r, true), '1870-01-01', 'a origem crua continua a ser o início');
    assert.equal(app.planoAntesDaCompra(r), '12/03/2020');
  });

  test('sem data de compra e com um início muito antigo, o teto fica com as mais recentes, e não com as de 1870', () => {
    const { r } = desde1870('P2');
    const d = app.datasEmFalta(r);
    assert.equal(d.length, 600);
    assert.equal(d.at(-1), '2026-10-05', 'acaba hoje');
    assert.equal(d[0], '1976-11-05', 'os 600 meses que acabam hoje');
    assert.equal(app.planoAntesDaCompra(r), '');
  });

  test('as rendas já lançadas ficam de fora, como sempre', () => {
    const { r } = desde1870('P1');
    app.db.transactions = [app.normTx({ kind: 'income', label: 'Renda', amount: 500, date: '2026-09-07', propertyId: 'P1', contractId: 'C1', category: 'Rendas' })];
    const d = app.datasEmFalta(r);
    assert.equal(d.length, 78);
    assert.ok(!d.includes('2026-09-05'));
  });
});

describe('a janela do preenchimento (cloud/painel.js)', () => {
  test('propõe as rendas desde a compra, di-lo, e regista-as todas, com o planeado a passar para depois de hoje', () => {
    const tudo = carregarTudo({ hoje: HOJE });
    try {
      limpar(tudo);
      tudo.db.owners = [tudo.normPerson({ id: 'eu', name: 'Eu' })];
      tudo.db.tenants = [tudo.normPerson({ id: 'I1', name: 'Ana' })];
      tudo.db.properties = [tudo.normProp({ id: 'P1', name: 'T2 Soure', use: 'investimento', ownerIds: ['eu'], purchaseDate: COMPRA })];
      const c = tudo.normContract({ id: 'C1', propertyId: 'P1', tenantIds: ['I1'], rent: 500, payDay: 5, start: '1870-01-01' });
      tudo.db.contracts = [c];
      tudo.db.recurring = [];
      tudo.syncContractRec(c);
      const r = tudo.ctRecOf(c);
      let corpo = '';
      tudo.openModal = (t, b) => { corpo = t + '|' + b; };
      ['save', 'buildNav', 'render', 'toast', 'closeModal', 'closeAllModals'].forEach((n) => { tudo[n] = () => {}; });
      tudo.CW.fillNext = () => {};
      tudo.CW.fillMissed(r.id);
      assert.match(corpo, /^Preencher 79 períodos\|/);
      assert.match(corpo, /Vais registar <b>79<\/b> movimentos de <b>[^<]+<\/b>, de <b>05\/04\/2020<\/b> a <b>05\/10\/2026<\/b>/);
      assert.match(corpo, /O imóvel foi comprado a <b>12\/03\/2020<\/b>: antes disso não há nada a registar\./);
      tudo.CW.doFillMissed(r.id);
      const est = tudo.db.transactions.filter((t) => /estimativa/.test(t.label));
      assert.equal(est.length, 79);
      assert.ok(est.every((t) => t.date >= COMPRA));
      assert.ok(tudo.ctRecOf(c).next > HOJE, 'o planeado passa para a renda seguinte');
    } finally { repor(tudo); }
  });
});
