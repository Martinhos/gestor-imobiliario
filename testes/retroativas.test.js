// Prestações em falta quando o início de uma hipoteca recua: reconstrução do
// plano para trás sem tocar no capital em dívida de hoje, e a pergunta que
// as insere ao gravar o imóvel ou a hipoteca.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar } from './arnes.js';

const app = carregarApp();
const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `esperava ${b} (±${tol}), veio ${a}`);
beforeEach(() => { limpar(app); app.render = () => {}; app.buildNav = () => {}; app.toast = () => {}; });

const HOJE = '2026-09-06';
const fixa = (extra = {}) => app.normLoan(Object.assign({
  id: 'l1', name: 'Aquisição', outstanding: 100000, years: 30, type: 'fixa', rate: 3, stampTax: true, start: '2024-01-10',
}, extra));
const prest = (date, principal = 150, extra = {}) => app.normTx(Object.assign({
  kind: 'loan', loanId: 'l1', payType: 'prestacao', amount: 438.46, principal, interest: 250, stamp: 10, date,
}, extra));

describe('loanPrestacoesEmFalta (pura)', () => {
  test('uma por mês, no dia do início, até hoje — sem o mês ainda por vencer', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [], HOJE);
    assert.equal(r.length, 32);                       // jan/2024 … ago/2026; 2026-09-10 > hoje
    assert.equal(r[0].date, '2024-01-10'); assert.equal(r[31].date, '2026-08-10');
    assert.equal(r[0].m, 1); assert.equal(r[31].m, 32);
  });

  test('dia 31 fica preso ao 28, como na recorrência', () => {
    const r = app.loanPrestacoesEmFalta(fixa({ start: '2024-01-31' }), [], HOJE);
    assert.equal(r[0].date, '2024-01-28'); assert.equal(r[1].date, '2024-02-28');
  });

  test('Σcapital + dívida de hoje = saldo inicial reconstruído, ao cêntimo', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [], HOJE);
    const caps = r.reduce((s, x) => s + x.principal, 0);
    const b0 = r[0].bal + r[0].principal;
    perto(caps + 100000, b0, 0.005);
    perto(r[r.length - 1].bal, 100000, 0.005);        // o último saldo é a dívida de hoje
    assert.ok(b0 > 100000, 'antes de pagar devia-se mais');
    r.forEach((x, k) => { if (k) perto(r[k - 1].bal - x.principal, x.bal, 0.005); });
  });

  test('bate com o plano de amortização a partir do saldo inicial', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [], HOJE);
    const b0 = r[0].bal + r[0].principal;
    // id sem movimentos e sem início: o plano parte do mês 0
    const a = app.amort(fixa({ id: 'x', outstanding: b0, start: '' }), 32);
    a.rows.forEach((row, k) => {
      perto(r[k].interest, row.int, 0.011);
      perto(r[k].principal, row.cap, k === 31 ? 0.5 : 0.011);
      perto(r[k].amount, row.pay + row.st, 0.02);
    });
    r.forEach((x) => { perto(x.amount, x.interest + x.stamp + x.principal, 0.005); perto(x.stamp, x.interest * 0.04, 0.011); });
    assert.ok(r[0].interest > r[31].interest && r[0].principal < r[31].principal, 'juros descem, capital sobe');
  });

  test('sem selo quando stampTax é falso', () => {
    const r = app.loanPrestacoesEmFalta(fixa({ stampTax: false }), [], HOJE);
    assert.ok(r.length > 0);
    r.forEach((x) => { perto(x.stamp, 0); perto(x.amount, x.interest + x.principal, 0.005); });
  });

  test('para no mês da prestação mais antiga registada, comparando por mês', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [prest('2025-03-30')], HOJE);
    assert.equal(r.length, 14);                       // jan/2024 … fev/2025
    assert.equal(r[13].date, '2025-02-10');
  });

  test('o capital já registado entra no saldo-alvo (prestações e amortizações)', () => {
    const txs = [prest('2025-03-10', 150), prest('2025-04-10', 5000, { payType: 'amortizacao' })];
    const r = app.loanPrestacoesEmFalta(fixa(), txs, HOJE);
    const caps = r.reduce((s, x) => s + x.principal, 0), b0 = r[0].bal + r[0].principal;
    perto(caps + 100000 + 5150, b0, 0.005);
    perto(r[r.length - 1].bal, 105150, 0.005);
  });

  test('movimentos de outra hipoteca não contam', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [prest('2025-03-10', 150, { loanId: 'outra' })], HOJE);
    assert.equal(r.length, 32);
  });

  test('para em `ate` (o next da recorrência), mesmo que seja antes de hoje', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [], HOJE, '2026-03-10');
    assert.equal(r[r.length - 1].date, '2026-02-10');
  });

  test('nada a inserir: sem início, início no futuro, sem dívida, mês ainda por vencer', () => {
    assert.equal(app.loanPrestacoesEmFalta(fixa({ start: '' }), [], HOJE).length, 0);
    assert.equal(app.loanPrestacoesEmFalta(fixa({ start: '2027-01-10' }), [], HOJE).length, 0);
    assert.equal(app.loanPrestacoesEmFalta(fixa({ outstanding: 0 }), [], HOJE).length, 0);
    assert.equal(app.loanPrestacoesEmFalta(fixa({ start: '2026-09-20' }), [], HOJE).length, 0);
  });

  test('nunca esgota o prazo: deixa pelo menos um mês por pagar', () => {
    const r = app.loanPrestacoesEmFalta(fixa({ years: 2, start: '2020-01-10' }), [], HOJE);
    assert.equal(r.length, 23);
  });

  test('mista: a taxa muda dentro da janela e a reconstrução continua exata', () => {
    const l = fixa({ type: 'mista', rate: 2, fixedYears: 1, euribor: 3, spread: 1 });
    const r = app.loanPrestacoesEmFalta(l, [], HOJE);
    assert.equal(r[11].rate, 2); assert.equal(r[12].rate, 4);
    perto(r.reduce((s, x) => s + x.principal, 0) + 100000, r[0].bal + r[0].principal, 0.005);
    perto(r[r.length - 1].bal, 100000, 0.005);
    assert.ok(r[12].amount > r[11].amount, 'a prestação sobe com a taxa');
  });

  test('não mexe nos argumentos', () => {
    const l = fixa(), txs = [prest('2025-03-10')], antes = JSON.stringify([l, txs]);
    app.loanPrestacoesEmFalta(l, txs, HOJE);
    assert.equal(JSON.stringify([l, txs]), antes);
  });
});

describe('perguntar e inserir', () => {
  let perguntas, desfazer, hoje, start, p;
  beforeEach(() => {
    perguntas = []; desfazer = null; hoje = app.today();
    start = (Number(hoje.slice(0, 4)) - 2) + '-01-15';
    app.confirmModal = (t, txt, cb) => { perguntas.push(txt); cb(); };
    app.comDesfazer = (m, r) => { desfazer = r; };
    app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
    p = app.normProp({ id: 'p1', name: 'Casa', ownerIds: ['o1'], loans: [fixa({ start })] });
    app.db.properties.push(p);
    app.syncAllLoanRecs();
  });
  const l = () => app.findLoan(app.prop('p1'), 'l1');
  const retro = () => app.db.transactions.filter((t) => t.loanId === 'l1' && t.retro);

  test('hipoteca nova com início no passado: pergunta e insere sem tocar na dívida', () => {
    app.perguntarPrestacoesEmFalta(p, {});
    assert.equal(perguntas.length, 1);
    assert.ok(/Aquisição/.test(perguntas[0]) && /não alteram o capital em dívida/.test(perguntas[0]));
    const n = app.loanPrestacoesEmFalta(l(), [], hoje, app.loanRecOf(l()).next).length;
    assert.ok(n > 20);
    assert.equal(retro().length, n);
    perto(l().outstanding, 100000);
  });

  test('os movimentos têm a cara da recorrência automática', () => {
    app.perguntarPrestacoesEmFalta(p, {});
    const t = retro()[0], modelo = app.loanRecTx(app.prop('p1'), l());
    assert.equal(t.kind, 'loan'); assert.equal(t.payType, 'prestacao'); assert.equal(t.propertyId, 'p1');
    assert.equal(t.label, modelo.label); assert.equal(t.category, modelo.category); assert.equal(t.sub, modelo.sub);
    assert.equal(t.split, null); assert.equal(t.paidBy, 'o1');          // dono único, como o prefill
    assert.equal(t.retro, true); assert.equal(t.fee, 0);
    assert.deepEqual([...t.tags], ['Estimativa']);
    assert.ok(app.db.settings.tags.indexOf('Estimativa') > -1, 'a etiqueta fica nas definições');
    perto(t.amount, t.interest + t.stamp + t.principal, 0.005);
  });

  test('com dois donos o paidBy fica vazio', () => {
    app.db.owners.push(app.normPerson({ id: 'o2', name: 'Bento' })); app.prop('p1').ownerIds.push('o2');
    app.perguntarPrestacoesEmFalta(p, {});
    assert.equal(retro()[0].paidBy, null);
  });

  test('contam como pagas e batem com o início: o prazo restante e a prestação não mudam', () => {
    const antes = app.loanRecOf(l()).tx.amount, nAntes = app.amort(l()).n;
    app.perguntarPrestacoesEmFalta(p, {});
    const n = retro().length;
    assert.equal(app.loanPaidN(l()), n);
    assert.equal(app.mesesDesdeInicio(l()), n, 'as vencidas desde o início são exatamente as inseridas');
    assert.equal(app.amort(l()).n, 360 - n);
    assert.equal(nAntes, 360 - n, 'o início já contava o prazo antes de inserir');
    perto(app.loanRecOf(l()).tx.amount, Math.round(app.loanCalc(l()).total * 100) / 100, 0.005);
    perto(app.loanRecOf(l()).tx.amount, antes, 0.005);
  });

  test('a recorrência não pede esses meses: tudo o que se inseriu é anterior ao next', () => {
    app.perguntarPrestacoesEmFalta(p, {});
    const r = app.loanRecOf(l());
    assert.ok(r.next > hoje || app.recPending().some((x) => x.id === r.id));
    retro().forEach((t) => assert.ok(t.date < r.next, t.date + ' < ' + r.next));
    assert.equal(retro().filter((t) => t.date.slice(0, 7) === r.next.slice(0, 7)).length, 0);
  });

  test('início que recuou pergunta; início igual ou adiantado não', () => {
    app.perguntarPrestacoesEmFalta(p, { l1: start });                 assert.equal(perguntas.length, 0);
    app.perguntarPrestacoesEmFalta(p, { l1: '2019-01-15' });          assert.equal(perguntas.length, 0);
    app.perguntarPrestacoesEmFalta(p, { l1: '' });                    assert.equal(perguntas.length, 1);   // preenchido agora
    limpar(app); app.db.properties.push(p); app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
    app.perguntarPrestacoesEmFalta(p, { l1: (Number(hoje.slice(0, 4)) - 1) + '-01-15' }); assert.equal(perguntas.length, 2);   // recuou um ano
  });

  test('sem dívida ou com a recorrência a cobrir tudo, não pergunta', () => {
    l().outstanding = 0; app.perguntarPrestacoesEmFalta(p, {}); assert.equal(perguntas.length, 0);
    l().outstanding = 100000; app.loanRecOf(l()).next = start;   // a recorrência começa no próprio início
    app.perguntarPrestacoesEmFalta(p, {}); assert.equal(perguntas.length, 0);
  });

  test('Anular tira as prestações em bloco e repõe a recorrência', () => {
    const amt = app.loanRecOf(l()).tx.amount;
    app.perguntarPrestacoesEmFalta(p, {});
    assert.ok(retro().length > 0 && typeof desfazer === 'function');
    desfazer();
    assert.equal(retro().length, 0); assert.equal(app.db.transactions.length, 0);
    perto(l().outstanding, 100000); perto(app.loanRecOf(l()).tx.amount, amt, 0.005);
  });

  test('apagar uma retroativa não repõe capital; apagar uma normal repõe', () => {
    app.closeAllModals = () => {};
    app.perguntarPrestacoesEmFalta(p, {});
    app.delTx(retro()[0].id); perto(l().outstanding, 100000);
    const t = app.recTx(app.loanRecOf(l())); app.applyLoan(t); app.db.transactions.push(t);
    const dep = l().outstanding; assert.ok(dep < 100000);
    app.delTx(t.id); perto(l().outstanding, 100000);
  });

  test('applyLoan numa retroativa normaliza a distribuição mas não abate', () => {
    const t = app.normTx({ kind: 'loan', loanId: 'l1', propertyId: 'p1', payType: 'prestacao', amount: 500, date: start, retro: true });
    app.applyLoan(t);
    perto(t.interest + t.stamp + t.principal, 500, 0.011); perto(l().outstanding, 100000);
    assert.ok(app.loanRecOf(l()), 'a recorrência fica');
  });

  test('ao editar, uma retroativa não devolve capital ao que se pode amortizar', () => {
    app.perguntarPrestacoesEmFalta(p, {});
    const t = retro()[0];
    perto(app.loanAvail(Object.assign({}, t, { _edit: true }), l()), 100000);
    const n = app.recTx(app.loanRecOf(l())); app.applyLoan(n); app.db.transactions.push(n);
    perto(app.loanAvail(Object.assign({}, n, { _edit: true }), l()), 100000);   // a normal devolve o que abateu
  });

  test('uma segunda recuada só preenche antes das já inseridas e mantém a soma consistente', () => {
    app.perguntarPrestacoesEmFalta(p, {});
    const n1 = retro().length, primeira = retro().map((t) => t.date).sort()[0];
    l().start = (Number(hoje.slice(0, 4)) - 3) + '-01-15';
    app.perguntarPrestacoesEmFalta(p, { l1: start });
    assert.equal(retro().length, n1 + 12);
    retro().slice(n1).forEach((t) => assert.ok(t.date < primeira));
    perto(l().outstanding, 100000);
    // as novas partem de um saldo maior: o que as primeiras tinham ao começar
    const novas = retro().slice(n1), antigas = retro().slice(0, n1);
    assert.ok(novas[0].interest > antigas[0].interest, 'mais dívida, mais juros');
    assert.equal(app.loanPaidN(l()), n1 + 12);
  });
});
