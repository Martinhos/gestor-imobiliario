// Hipotecas: cada prestação vai parar à hipoteca certa (recorrências, prefill,
// preenchimento em bloco, apagar), e um crédito antigo introduzido com o
// capital em dívida de hoje tem o prazo restante certo pela data de início.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar } from './arnes.js';

const app = carregarApp();
const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `esperava ${b} (±${tol}), veio ${a}`);
beforeEach(() => { limpar(app); app.render = () => {}; app.buildNav = () => {}; app.toast = () => {}; });

const hoje = app.today();
const ANO = Number(hoje.slice(0, 4)), MES = Number(hoje.slice(5, 7)), DIA = Number(hoje.slice(8, 10));
const mm = (n) => String(n).padStart(2, '0');
/* Uma data há n anos cuja prestação vence hoje (dia ≤ 28) ou venceu no 28
   deste mês (hoje é 29–31): em ambos os casos há exatamente 12n vencidas. */
const haAnos = (n) => DIA <= 28 ? `${ANO - n}-${mm(MES)}-${mm(DIA)}`
  : (MES === 12 ? `${ANO - n + 1}-01-28` : `${ANO - n}-${mm(MES + 1)}-28`);

const loan = (id, extra = {}) => app.normLoan(Object.assign({
  id, name: id.toUpperCase(), bank: 'Banco ' + id, outstanding: 100000, years: 30, type: 'fixa', rate: 3, stampTax: true,
}, extra));
const casa = (loans) => {
  app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
  const p = app.normProp({ id: 'p1', name: 'Casa', ownerIds: ['o1'], loans });
  app.db.properties.push(p);
  return p;
};
const A = () => app.findLoan(app.prop('p1'), 'a'), B = () => app.findLoan(app.prop('p1'), 'b');
const recDe = (id) => app.db.recurring.find((r) => r.auto && r.tx.loanId === id);

describe('a prestação de hoje', () => {
  test('confirmar a prestação do próprio dia avança o mês do crédito', () => {
    limpar(app);
    const hoje = app.today(), dia = Math.min(28, Number(hoje.slice(8, 10)));
    const start = (Number(hoje.slice(0, 4)) - 10) + hoje.slice(4, 7) + '-' + String(dia).padStart(2, '0');
    const l = app.normLoan({ id: 'lh', outstanding: 76019.81, years: 30, type: 'fixa', rate: 3, start });
    app.db.properties.push(app.normProp({ id: 'ph', name: 'Casa', loans: [l] }));
    const antes = app.loanMes(l);
    app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'lh', propertyId: 'ph', payType: 'prestacao', amount: 421.6, principal: 200, interest: 190, stamp: 7.6, date: hoje }));
    assert.equal(app.loanMes(l), antes + 1, 'a de hoje, já registada, conta como vencida');
    assert.equal(app.amort(l).n, 360 - antes - 1, 'o prazo restante desce um mês');
  });

  test('a prestação que vence hoje não entra na reconstrução', () => {
    const hoje = app.today(), dia = Math.min(28, Number(hoje.slice(8, 10)));
    const start = (Number(hoje.slice(0, 4)) - 2) + hoje.slice(4, 7) + '-' + String(dia).padStart(2, '0');
    const l = app.normLoan({ id: 'lr', outstanding: 100000, years: 30, type: 'fixa', rate: 3, start });
    const r = app.loanPrestacoesEmFalta(l, [], hoje);
    assert.ok(r.length > 0);
    assert.ok(r[r.length - 1].date < hoje, 'a última é anterior a hoje');
    assert.equal(r.length, app.mesesDesdeInicio(l, hoje), 'tantas quantas as vencidas');
  });
});

describe('recorrências das hipotecas', () => {
  test('cada hipoteca ganha a sua recorrência com o loanId certo', () => {
    casa([loan('a', { start: haAnos(3) }), loan('b', { start: haAnos(1) })]);
    app.syncAllLoanRecs();
    assert.equal(app.db.recurring.length, 2);
    app.db.recurring.forEach((r) => {
      assert.ok(['a', 'b'].indexOf(r.tx.loanId) > -1);
      assert.equal(r.tx.propertyId, 'p1'); assert.equal(r.auto, true); assert.equal(r.tx.kind, 'loan');
      assert.ok(r.name.indexOf(r.tx.loanId.toUpperCase()) > -1, 'o nome identifica a hipoteca');
    });
    assert.notEqual(recDe('a').id, recDe('b').id);
  });

  test('confirmar a recorrência de B abate só em B', () => {
    casa([loan('a'), loan('b', { outstanding: 50000 })]);
    app.syncAllLoanRecs();
    const t = app.recTx(recDe('b'), `${ANO}-08-05`);
    app.applyLoan(t); app.db.transactions.push(t);
    assert.equal(t.loanId, 'b');
    perto(B().outstanding, 50000 - t.principal); perto(A().outstanding, 100000);
    assert.equal(app.loanPaidN(B()), 1); assert.equal(app.loanPaidN(A()), 0);
  });

  test('a recorrência traz a prestação do prazo restante, não do prazo inteiro', () => {
    casa([loan('a', { outstanding: 76019.81, start: haAnos(10) })]);
    app.syncAllLoanRecs();
    perto(recDe('a').tx.amount, 421.60 + 76019.81 * 0.03 / 12 * 0.04, 0.06);
  });
});

describe('gravar o imóvel e a hipoteca', () => {
  let perguntas;
  beforeEach(() => {
    perguntas = [];
    // o onSave da app vive na janela de cima: uma camada falsa na pilha chega
    app.openModal = () => { const L = { el: {}, onSave: null }; app.modalStack.push(L); return L; };
    app.closeModal = () => { app.modalStack.pop(); };
    app.paintThumbs = () => {};
    app.collectProp = () => {};   // o DOM falso devolve '' em tudo: o formulário já está em pForm
    app.confirmModal = (t, txt, cb) => { perguntas.push(txt); cb(); };
    app.comDesfazer = () => {};
  });

  test('guardar o imóvel cria as recorrências das hipotecas e pergunta pelas prestações antigas', () => {
    app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
    app.propModal(null);
    app.pForm = app.normProp({ id: 'p1', name: 'Casa', ownerIds: ['o1'], loans: [loan('a', { start: haAnos(2) })] });
    app.onSave();
    assert.equal(app.db.properties.length, 1);
    assert.ok(recDe('a'), 'a recorrência nasce no mesmo save');
    assert.equal(perguntas.length, 1);
    const retro = app.db.transactions.filter((t) => t.retro);
    assert.equal(retro.length, 24);
    retro.forEach((t) => assert.equal(t.loanId, 'a'));
    perto(A().outstanding, 100000);
  });

  test('com o automático desligado não há recorrência', () => {
    app.propModal(null);
    app.pForm = app.normProp({ id: 'p1', name: 'Casa', loans: [loan('a', { autoRec: false })] });
    app.onSave();
    assert.equal(app.db.recurring.length, 0);
  });

  test('uma hipoteca sem nome fica com o do banco, para a recorrência a identificar', () => {
    app.propModal(null);
    app.pForm = app.normProp({ id: 'p1', name: 'Casa', loans: [loan('a', { name: '' })] });
    app.onSave();
    assert.equal(A().name, 'Banco a');
    assert.ok(recDe('a').name.indexOf('Banco a') > -1);
  });

  test('inserir a hipoteca B pelo modal da hipoteca pergunta por B, não por A', () => {
    casa([loan('a', { start: haAnos(3) })]);
    app.syncAllLoanRecs();   // A já vive com recorrência há muito
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('p1'))));
    const b = loan('b', { name: '', start: haAnos(1), outstanding: 40000 });
    app.pForm.loans.push(b);
    app.mortOpen('b', true);
    app.onSave();
    assert.ok(recDe('a') && recDe('b'), 'as duas têm recorrência');
    assert.equal(perguntas.length, 1, 'só pergunta pela hipoteca acabada de criar');
    assert.ok(/Banco b/.test(perguntas[0]), 'e diz qual é: ' + perguntas[0]);
    const retro = app.db.transactions.filter((t) => t.retro);
    assert.equal(retro.length, 12);
    retro.forEach((t) => assert.equal(t.loanId, 'b'));
    perto(A().outstanding, 100000); perto(B().outstanding, 40000);
  });

  test('recuar o início de A no modal da hipoteca só pergunta por A', () => {
    casa([loan('a', { start: haAnos(1) }), loan('b', { start: haAnos(1) })]);
    app.syncAllLoanRecs();
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('p1'))));
    app.findLoan(app.pForm, 'a').start = haAnos(2);
    app.mortOpen('a', false);
    app.onSave();
    assert.equal(perguntas.length, 1);
    app.db.transactions.forEach((t) => assert.equal(t.loanId, 'a'));
    assert.equal(app.db.transactions.length, 24);
  });
});

describe('formulário do movimento', () => {
  const form = (extra = {}) => { app.tForm = app.normTx(Object.assign({ kind: 'loan', propertyId: 'p1' }, extra)); app.tForm._edit = false; app.prefill(); return app.tForm; };

  test('prefill não escolhe uma hipoteca ao acaso quando há várias', () => {
    casa([loan('a'), loan('b')]);
    assert.equal(form().loanId, null);
    assert.equal(form({ loanId: 'b' }).loanId, 'b');
    assert.equal(form({ loanId: 'inexistente' }).loanId, null);
  });

  test('com uma só hipoteca viva escolhe-a; uma liquidada escolhida mantém-se', () => {
    casa([loan('a'), loan('b', { outstanding: 0 })]);
    assert.equal(form().loanId, 'a');
    assert.equal(form({ loanId: 'b' }).loanId, 'b');
  });

  test('a sugestão de montante segue a hipoteca escolhida', () => {
    casa([loan('a'), loan('b', { outstanding: 50000 })]);
    const t = form({ loanId: 'b' });
    perto(t.amount, Math.round(app.loanCalc(B()).total * 100) / 100, 0.005);
    assert.ok(/Prestação B · Casa/.test(t.label));
    assert.ok(!form().amount, 'sem hipoteca escolhida não se sugere valor');
  });

  test('uma despesa não oferece a categoria dos pagamentos de crédito', () => {
    casa([loan('a')]);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1' });
    assert.ok(!/Crédito à habitação/.test(app.txBody()));
    app.tForm = app.normTx({ kind: 'loan', propertyId: 'p1', loanId: 'a' });
    assert.ok(/Crédito à habitação/.test(app.txBody()));
  });

  test('o seletor pede a escolha com várias e denuncia uma hipoteca de outro imóvel', () => {
    casa([loan('a'), loan('b')]);
    app.tForm = app.normTx({ kind: 'loan', propertyId: 'p1' });
    assert.ok(/escolhe a hipoteca/.test(app.txBody()));
    app.tForm = app.normTx({ kind: 'loan', propertyId: 'p1', loanId: 'orfa' });
    assert.ok(/Hipoteca desconhecida/.test(app.txBody()));
  });
});

describe('datas em falta de um plano', () => {
  test('num contrato partem do início e saltam os meses já registados', () => {
    casa([]);
    const c = app.normContract({ id: 'c1', propertyId: 'p1', rent: 500, start: `${ANO - 1}-09-05`, payDay: 5 });
    app.db.contracts.push(c);
    app.db.recurring.push(app.normRec({ id: 'r', auto: true, name: 'Renda', every: 'month', next: hoje, tx: { kind: 'income', amount: 500, contractId: 'c1', propertyId: 'p1' } }));
    app.db.transactions.push(app.normTx({ kind: 'income', amount: 500, contractId: 'c1', propertyId: 'p1', date: `${ANO}-01-07` }));
    const d = app.datasEmFalta(app.db.recurring[0]);
    // o dia é o do plano (o de hoje, aqui); se ainda não chegou ao 5 em setembro, começa em outubro
    assert.equal(d[0].slice(0, 7), DIA >= 5 ? `${ANO - 1}-09` : `${ANO - 1}-10`);
    assert.ok(d.every((x) => x.slice(0, 7) !== `${ANO}-01`), 'janeiro já está registado');
    assert.ok(d.every((x) => x <= hoje));
    const meses = 4 + MES - (DIA < 5 ? 1 : 0);   // set…dez do ano passado + jan…hoje
    assert.equal(d.length, meses - 1, 'um por mês, menos janeiro');
  });

  test('sem contrato nem hipoteca partem do next', () => {
    app.db.recurring.push(app.normRec({ id: 'r', name: 'Quota', every: 'month', next: `${ANO - 1}-12-01`, tx: { kind: 'expense', amount: 20 } }));
    const d = app.datasEmFalta(app.db.recurring[0]);
    assert.equal(d[0], `${ANO - 1}-12-01`);
    assert.equal(d.length, MES + 1);
  });

  test('numa hipoteca são as prestações reconstruídas: desde o início, até ao mês do primeiro registo', () => {
    casa([loan('b', { start: `${ANO - 1}-09-05` })]);
    app.db.recurring.push(app.normRec({ id: 'r', auto: true, name: 'Prestação', every: 'month', next: hoje, tx: { kind: 'loan', amount: 400, loanId: 'b', propertyId: 'p1' } }));
    app.db.transactions.push(app.normTx({ kind: 'loan', amount: 400, loanId: 'b', propertyId: 'p1', date: `${ANO}-01-07`, principal: 150 }));
    const d = app.datasEmFalta(app.db.recurring[0]);
    assert.deepEqual([...d], [`${ANO - 1}-09-05`, `${ANO - 1}-10-05`, `${ANO - 1}-11-05`, `${ANO - 1}-12-05`]);
    assert.equal(app.planoPrestacoesEmFalta(app.db.recurring[0]).length, 4);
  });
});

describe('preencher em bloco e apagar', () => {
  test('o preenchimento manual regista com o loanId do plano, retroativo, sem abater', () => {
    casa([loan('a'), loan('b', { start: haAnos(1), outstanding: 60000 })]);
    app.syncAllLoanRecs();
    app.comDesfazer = () => {};
    const r = recDe('b'), lista = app.planoPrestacoesEmFalta(r);
    assert.equal(lista.length, 12);
    app.inserirPrestacoesEmFalta(app.prop('p1'), B(), lista);
    const txs = app.db.transactions;
    assert.equal(txs.length, 12);
    txs.forEach((t) => { assert.equal(t.loanId, 'b'); assert.equal(t.retro, true); assert.ok(t.tags.indexOf('Estimativa') > -1); assert.ok(t.date < r.next); });
    perto(A().outstanding, 100000); perto(B().outstanding, 60000);
    assert.equal(app.loanPaidN(B()), 12); assert.equal(app.loanPaidN(A()), 0);
    assert.equal(app.planoPrestacoesEmFalta(r).length, 0, 'já não falta nada');
  });

  test('apagar um pagamento repõe o capital na hipoteca certa e nunca numa retroativa', () => {
    casa([loan('a'), loan('b', { outstanding: 60000 })]);
    app.syncAllLoanRecs();
    app.closeAllModals = () => {}; app.comDesfazer = () => {};
    const t = app.recTx(recDe('b')); app.applyLoan(t); app.db.transactions.push(t);
    const dep = B().outstanding; assert.ok(dep < 60000);
    app.delTx(t.id);
    perto(B().outstanding, 60000); perto(A().outstanding, 100000);
    const r = app.normTx({ kind: 'loan', loanId: 'b', propertyId: 'p1', amount: 400, principal: 150, interest: 240.38, stamp: 9.62, date: `${ANO - 1}-01-05`, retro: true });
    app.db.transactions.push(r);
    app.delTx(r.id);
    perto(B().outstanding, 60000, 0.001);
  });

  test('editar: uma retroativa não devolve capital ao amortizável; uma normal devolve', () => {
    casa([loan('b', { outstanding: 60000 })]);
    const n = app.normTx({ id: 'n', kind: 'loan', loanId: 'b', propertyId: 'p1', amount: 400, principal: 150, date: hoje });
    const r = app.normTx({ id: 'r', kind: 'loan', loanId: 'b', propertyId: 'p1', amount: 400, principal: 150, date: hoje, retro: true });
    app.db.transactions.push(n, r);
    perto(app.loanAvail(Object.assign({}, n, { _edit: true }), B()), 60150);
    perto(app.loanAvail(Object.assign({}, r, { _edit: true }), B()), 60000);
  });
});

describe('prazo restante de um crédito antigo', () => {
  test('mesesDesdeInicio conta as prestações vencidas, no dia do início limitado a 28', () => {
    const m = (start, data) => app.mesesDesdeInicio({ start }, data);
    assert.equal(m('2016-09-06', '2026-09-06'), 120, 'a de hoje ainda não venceu');
    assert.equal(m('2016-09-01', '2026-09-06'), 121, 'a deste mês já venceu');
    assert.equal(m('2016-09-30', '2026-09-06'), 120, 'dia 30 cobra-se no 28');
    assert.equal(m('2016-09-30', '2026-09-29'), 121);
    assert.equal(m('', '2026-09-06'), 0);
    assert.equal(m('2027-01-10', '2026-09-06'), 0, 'início no futuro');
    assert.equal(m('2026-09-20', '2026-09-06'), 0);
    assert.equal(m('2026-09-01', '2026-09-06'), 1);
  });

  test('100 000 € a 3 % por 30 anos há 10 anos: 240 meses e 421,60 € com 76 019,81 € em dívida', () => {
    const l = loan('a', { outstanding: 76019.81, start: haAnos(10) });
    assert.equal(app.mesesDesdeInicio(l), 120);
    const a = app.amort(l), c = app.loanCalc(l);
    assert.equal(a.n, 240); assert.equal(c.n, 240);
    perto(c.base, 421.60, 0.05);
    assert.ok(Math.abs(a.totInt - 25165) < 60, 'juros até ao fim ≈ 25 165 €: ' + a.totInt);
    perto(a.rows[239].bal, 0, 0.5);
    assert.equal(a.esgotado, false);
  });

  test('as registadas só contam quando são mais do que as vencidas pelo início', () => {
    casa([loan('a', { start: haAnos(1) })]);
    for (let i = 0; i < 6; i++) app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'a', amount: 431.6, date: `${ANO}-0${i + 1}-01` }));
    assert.equal(app.loanMes(A()), 12);
    for (let i = 0; i < 10; i++) app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'a', amount: 431.6, date: `${ANO - 1}-0${(i % 9) + 1}-01` }));
    assert.equal(app.loanMes(A()), 16);
    assert.equal(app.amort(A()).n, 344);
  });

  test('a fase da taxa e a comissão da mista seguem o início', () => {
    const l = loan('a', { type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1, start: haAnos(6), amortFeeFix: 2, amortFeeVar: 0.5 });
    assert.equal(app.loanCalc(l).rate, 4);
    assert.equal(app.amort(l).rows[0].rate, 4);
    perto(app.amortFeeRate(l), 0.005);
    perto(app.amortFeeRate(loan('x', Object.assign({}, l, { start: haAnos(2) }))), 0.02);
  });

  test('prazo esgotado pelas pagas com dívida por pagar: avisa em vez de fingir', () => {
    const l = loan('a', { years: 5, start: haAnos(7) });
    const a = app.amort(l);
    assert.equal(a.n, 1); assert.equal(a.esgotado, true);
    assert.ok(/Prazo esgotado/.test(app.loanBox(l)));
    assert.ok(!/Prazo esgotado/.test(app.loanBox(loan('b', { start: haAnos(2) }))));
    assert.ok(/prestações por pagar/.test(app.loanBox(loan('b', { start: haAnos(2) }))));
  });

  test('a caixa da mista diz quando muda a prestação, descontando o que já passou', () => {
    const l = loan('a', { type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1, start: haAnos(2) });
    const h = app.loanBox(l);
    const t0 = Number(l.start.slice(0, 4)) * 12 + Number(l.start.slice(5, 7)) - 1 + 60;
    assert.ok(h.indexOf('a partir de ' + app.MES[t0 % 12] + ' ' + Math.floor(t0 / 12)) > -1, h);
    const pos = app.loanBox(loan('b', { type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1, start: haAnos(6) }));
    assert.ok(!/Prestação a partir/.test(pos), 'já na fase variável não há linha');
  });
});
