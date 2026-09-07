// Hipotecas: cada prestação vai parar à hipoteca certa (recorrências, prefill,
// preenchimento em bloco, apagar), e um crédito antigo — introduzido com o
// capital em dívida da data de início — fica com o prazo restante certo
// depois de inseridas as prestações desde então (só as registadas contam).
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
const somaCap = (r) => r.reduce((s, x) => s + x.principal, 0);
// n prestações registadas numa hipoteca, sem mexer no capital (história que já lá estava)
const registadas = (loanId, n) => { for (let i = 0; i < n; i++) app.db.transactions.push(app.normTx({ kind: 'loan', loanId, propertyId: 'p1', amount: 431.6, date: `${ANO - 1}-${mm((i % 12) + 1)}-01` })); };

describe('o loanBox da mista', () => {
  test('«Prestação a partir de …» conta a partir da próxima por pagar, mesmo com a deste mês registada', () => {
    limpar(app);
    const hoje = app.today(), Y = Number(hoje.slice(0, 4)), M = Number(hoje.slice(5, 7));
    const start = (Y - 2) + '-' + String(M).padStart(2, '0') + '-01';
    const l = app.normLoan({ id: 'lm', outstanding: 100000, years: 30, type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1, start, stampTax: false });
    app.db.properties.push(app.normProp({ id: 'pm', name: 'Casa', loans: [l] }));
    // 24 prestações anteriores + a deste mês: a fase muda no mês 60 do crédito = mesmo mês, daqui a 3 anos
    for (let k = 0; k <= 24; k++) {
      let y = Y - 2, m = M + k; while (m > 12) { m -= 12; y++; }
      app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'lm', propertyId: 'pm', payType: 'prestacao', amount: 370, principal: 200, interest: 170, date: y + '-' + String(m).padStart(2, '0') + '-01' }));
    }
    const html = app.loanBox(l);
    assert.match(html, new RegExp('a partir de ' + app.MES[M - 1] + ' ' + (Y + 3)), 'o mês certo, não um a menos');
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

  test('a recorrência traz a prestação do prazo restante pelas registadas, não do prazo inteiro', () => {
    casa([loan('a', { outstanding: 76019.81, start: haAnos(10) })]);
    registadas('a', 120);
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
    const ins = app.db.transactions.filter((t) => (t.tags || []).indexOf('Estimativa') > -1);
    assert.equal(ins.length, 24);
    ins.forEach((t) => { assert.equal(t.loanId, 'a'); assert.equal(t.retro, undefined); });
    perto(A().outstanding, 100000 - somaCap(ins), 0.005);
    assert.ok(A().outstanding > 95000 && A().outstanding < 96000, '24 meses de 360 abatem uns 4 %: ' + A().outstanding);
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
    const ins = app.db.transactions.filter((t) => (t.tags || []).indexOf('Estimativa') > -1);
    assert.equal(ins.length, 12);
    ins.forEach((t) => assert.equal(t.loanId, 'b'));
    perto(A().outstanding, 100000, 0.001); perto(B().outstanding, 40000 - somaCap(ins), 0.005);
    assert.ok(B().outstanding < 40000, 'abateu em B');
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
    assert.ok(A().outstanding < 100000, 'abateu em A'); perto(B().outstanding, 100000, 0.001);
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

  test('numa hipoteca são as prestações do plano: desde o início, até ao mês do primeiro registo', () => {
    casa([loan('b', { start: `${ANO - 1}-09-05` })]);
    app.db.recurring.push(app.normRec({ id: 'r', auto: true, name: 'Prestação', every: 'month', next: hoje, tx: { kind: 'loan', amount: 400, loanId: 'b', propertyId: 'p1' } }));
    app.db.transactions.push(app.normTx({ kind: 'loan', amount: 400, loanId: 'b', propertyId: 'p1', date: `${ANO}-01-07`, principal: 150 }));
    const d = app.datasEmFalta(app.db.recurring[0]);
    assert.deepEqual([...d], [`${ANO - 1}-09-05`, `${ANO - 1}-10-05`, `${ANO - 1}-11-05`, `${ANO - 1}-12-05`]);
    assert.equal(app.planoPrestacoesEmFalta(app.db.recurring[0]).length, 4);
  });
});

describe('preencher em bloco e apagar', () => {
  test('o preenchimento manual regista com o loanId do plano e abate só nessa hipoteca', () => {
    casa([loan('a'), loan('b', { start: haAnos(1), outstanding: 60000 })]);
    app.syncAllLoanRecs();
    app.comDesfazer = () => {};
    const r = recDe('b'), lista = app.planoPrestacoesEmFalta(r);
    assert.equal(lista.length, 12);
    app.inserirPrestacoesEmFalta(app.prop('p1'), B(), lista);
    const txs = app.db.transactions;
    assert.equal(txs.length, 12);
    txs.forEach((t) => { assert.equal(t.loanId, 'b'); assert.equal(t.retro, undefined); assert.ok(t.tags.indexOf('Estimativa') > -1); assert.ok(t.date < r.next); });
    perto(A().outstanding, 100000, 0.001); perto(B().outstanding, 60000 - somaCap(lista), 0.005);
    perto(B().outstanding, lista[11].bal, 0.005);
    assert.equal(app.loanPaidN(B()), 12); assert.equal(app.loanPaidN(A()), 0);
    assert.equal(app.planoPrestacoesEmFalta(r).length, 0, 'já não falta nada');
    perto(recDe('b').tx.amount, Math.round(app.loanCalc(B()).total * 100) / 100, 0.005, 'a recorrência acompanha');
  });

  test('apagar um pagamento repõe o capital na hipoteca certa — também numa inserida em bloco', () => {
    casa([loan('a'), loan('b', { start: haAnos(1), outstanding: 60000 })]);
    app.syncAllLoanRecs();
    app.closeAllModals = () => {}; app.comDesfazer = () => {};
    const t = app.recTx(recDe('b')); app.applyLoan(t); app.db.transactions.push(t);
    const dep = B().outstanding; assert.ok(dep < 60000);
    app.delTx(t.id);
    perto(B().outstanding, 60000); perto(A().outstanding, 100000);
    const lista = app.planoPrestacoesEmFalta(recDe('b'));
    app.inserirPrestacoesEmFalta(app.prop('p1'), B(), lista);
    const dep2 = B().outstanding, ins = app.db.transactions.filter((x) => x.loanId === 'b')[0];
    app.delTx(ins.id);
    perto(B().outstanding, dep2 + ins.principal, 0.005); perto(A().outstanding, 100000, 0.001);
  });

  test('editar: o registo em edição devolve o seu capital ao amortizável, seja qual for a origem', () => {
    casa([loan('b', { outstanding: 60000 })]);
    const n = app.normTx({ id: 'n', kind: 'loan', loanId: 'b', propertyId: 'p1', amount: 400, principal: 150, date: hoje });
    const e = app.normTx({ id: 'e', kind: 'loan', loanId: 'b', propertyId: 'p1', amount: 400, principal: 150, date: hoje, tags: ['Estimativa'] });
    app.db.transactions.push(n, e);
    perto(app.loanAvail(Object.assign({}, n, { _edit: true }), B()), 60150);
    perto(app.loanAvail(Object.assign({}, e, { _edit: true }), B()), 60150);
    perto(app.loanAvail(Object.assign({}, n, { _edit: false }), B()), 60000);
  });
});

describe('prazo restante de um crédito antigo', () => {
  test('100 000 € a 3 % por 30 anos há 10 anos: só com as prestações inseridas dá 240 meses e 421,60 €', () => {
    casa([loan('a', { start: haAnos(10) })]);
    app.comDesfazer = () => {};
    assert.equal(app.amort(A()).n, 360, 'sem nada registado, a app só sabe o prazo inteiro');
    const lista = app.loanPrestacoesEmFalta(A(), app.db.transactions, hoje);
    assert.equal(lista.length, 120);
    app.inserirPrestacoesEmFalta(app.prop('p1'), A(), lista);
    perto(A().outstanding, 76019.81, 0.05);
    const a = app.amort(A()), c = app.loanCalc(A());
    assert.equal(a.n, 240); assert.equal(c.n, 240);
    perto(c.base, 421.60, 0.05);
    assert.ok(Math.abs(a.totInt - 25165) < 60, 'juros até ao fim ≈ 25 165 €: ' + a.totInt);
    perto(a.rows[239].bal, 0, 0.5);
    assert.equal(a.esgotado, false);
  });

  test('só as registadas contam para o prazo; a data de início, por si, não', () => {
    casa([loan('a', { start: haAnos(1) })]);
    assert.equal(app.loanMes(A()), 0); assert.equal(app.amort(A()).n, 360);
    registadas('a', 6);
    assert.equal(app.loanMes(A()), 6);
    registadas('a', 10);
    assert.equal(app.loanMes(A()), 16);
    assert.equal(app.amort(A()).n, 344);
    app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'a', propertyId: 'p1', payType: 'amortizacao', amount: 5000, date: hoje }));
    assert.equal(app.loanMes(A()), 16, 'amortizações antecipadas não contam');
  });

  test('a fase da taxa e a comissão da mista seguem as prestações registadas', () => {
    casa([loan('a', { type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1, start: haAnos(6), amortFeeFix: 2, amortFeeVar: 0.5 })]);
    assert.equal(app.loanCalc(A()).rate, 2, 'sem registadas está na fase fixa, começou quando começou');
    perto(app.amortFeeRate(A()), 0.02);
    registadas('a', 60);
    assert.equal(app.loanCalc(A()).rate, 4);
    assert.equal(app.amort(A()).rows[0].rate, 4);
    perto(app.amortFeeRate(A()), 0.005);
  });

  test('prazo esgotado pelas registadas com dívida por pagar: avisa em vez de fingir', () => {
    casa([loan('a', { years: 5, start: haAnos(7) }), loan('b', { start: haAnos(2) })]);
    registadas('a', 60); registadas('b', 24);
    const a = app.amort(A());
    assert.equal(a.n, 1); assert.equal(a.esgotado, true);
    assert.ok(/Prazo esgotado/.test(app.loanBox(A())));
    assert.ok(!/Prazo esgotado/.test(app.loanBox(B())));
    assert.ok(/336 prestações por pagar/.test(app.loanBox(B())));
  });

  test('a caixa da mista diz quando muda a prestação, descontando as registadas', () => {
    casa([loan('a', { type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1, start: haAnos(2) })]);
    registadas('a', 24);
    const h = app.loanBox(A());
    const t0 = ANO * 12 + MES - 1 + 36;   // a fase muda daqui a 60 − 24 meses
    assert.ok(h.indexOf('a partir de ' + app.MES[t0 % 12] + ' ' + Math.floor(t0 / 12)) > -1, h);
    registadas('a', 48);
    assert.ok(!/Prestação a partir/.test(app.loanBox(A())), 'já na fase variável não há linha');
  });
});
