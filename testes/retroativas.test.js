// Prestações em falta quando o início de uma hipoteca recua: o plano simulado
// para a frente a partir do capital em dívida (que é o da data de início), a
// pergunta que as insere ao gravar o imóvel ou a hipoteca, e o abate do
// capital com elas — como se fossem confirmadas uma a uma.
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
const somaCap = (r) => r.reduce((s, x) => s + x.principal, 0);
const anuidade = (bal, taxa, n) => { const i = taxa / 100 / 12; return bal * i / (1 - Math.pow(1 + i, -n)); };

/* Uma data há n anos cuja prestação vence hoje (dia ≤ 28) ou venceu no 28
   deste mês (hoje é 29–31): em ambos os casos há exatamente 12n por inserir. */
const hoje = app.today();
const ANO = Number(hoje.slice(0, 4)), MES = Number(hoje.slice(5, 7)), DIA = Number(hoje.slice(8, 10));
const mm = (n) => String(n).padStart(2, '0');
const haAnos = (n) => DIA <= 28 ? `${ANO - n}-${mm(MES)}-${mm(DIA)}`
  : (MES === 12 ? `${ANO - n + 1}-01-28` : `${ANO - n}-${mm(MES + 1)}-28`);

describe('loanPrestacoesEmFalta (pura): as datas', () => {
  test('uma por mês, no dia do início, até hoje — sem a que vence hoje', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [], HOJE);
    assert.equal(r.length, 32);                       // jan/2024 … ago/2026; 2026-09-10 > hoje
    assert.equal(r[0].date, '2024-01-10'); assert.equal(r[31].date, '2026-08-10');
    assert.equal(r[0].m, 1); assert.equal(r[31].m, 32);
    const dia = app.loanPrestacoesEmFalta(fixa({ start: '2026-08-06' }), [], HOJE);
    assert.equal(dia.length, 1, 'a de hoje (2026-09-06) ainda está por pagar');
  });

  test('dia 31 fica preso ao 28, como na recorrência', () => {
    const r = app.loanPrestacoesEmFalta(fixa({ start: '2024-01-31' }), [], HOJE);
    assert.equal(r[0].date, '2024-01-28'); assert.equal(r[1].date, '2024-02-28');
  });

  test('para no mês da prestação mais antiga registada, comparando por mês', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [prest('2025-03-30')], HOJE);
    assert.equal(r.length, 14);                       // jan/2024 … fev/2025
    assert.equal(r[13].date, '2025-02-10');
  });

  test('movimentos de outra hipoteca não contam', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [prest('2025-03-10', 150, { loanId: 'outra' })], HOJE);
    assert.equal(r.length, 32);
  });

  test('para em `ate` (o next da recorrência), mesmo que seja antes de hoje', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [], HOJE, '2026-03-10');
    assert.equal(r[r.length - 1].date, '2026-02-10');
  });

  test('nada a inserir: sem início, início no futuro, sem dívida, mês ainda por vencer, recorrência no próprio início', () => {
    assert.equal(app.loanPrestacoesEmFalta(fixa({ start: '' }), [], HOJE).length, 0);
    assert.equal(app.loanPrestacoesEmFalta(fixa({ start: '2027-01-10' }), [], HOJE).length, 0);
    assert.equal(app.loanPrestacoesEmFalta(fixa({ outstanding: 0 }), [], HOJE).length, 0);
    assert.equal(app.loanPrestacoesEmFalta(fixa({ start: '2026-09-20' }), [], HOJE).length, 0);
    assert.equal(app.loanPrestacoesEmFalta(fixa(), [], HOJE, '2024-01-10').length, 0);
  });

  test('nunca mais do que as que cabem no prazo: as registadas ocupam o seu lugar', () => {
    const r = app.loanPrestacoesEmFalta(fixa({ years: 2, start: '2020-01-10' }), [], HOJE);
    assert.equal(r.length, 24);
    const txs = [...Array(20)].map((_, k) => prest(`2026-0${(k % 8) + 1}-10`));   // 20 registadas, todas depois da janela
    assert.equal(app.loanPrestacoesEmFalta(fixa({ years: 2, start: '2020-01-10' }), txs, HOJE).length, 4);
    assert.equal(app.loanPrestacoesEmFalta(fixa({ years: 2, start: '2020-01-10' }), txs.concat(txs.slice(0, 4)), HOJE).length, 0);
  });
});

describe('loanPrestacoesEmFalta (pura): a matemática para a frente', () => {
  test('Σcapital = dívida antes − saldo final, ao cêntimo; cada saldo é o anterior menos o capital', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [], HOJE);
    perto(somaCap(r), 100000 - r[r.length - 1].bal, 0.005);
    perto(r[0].bal, 100000 - r[0].principal, 0.005);
    r.forEach((x, k) => { if (k) perto(r[k - 1].bal - x.principal, x.bal, 0.005); });
    assert.ok(r[r.length - 1].bal < 100000 && r[r.length - 1].bal > 90000, 'abateu, mas pouco: 32 meses de 360');
  });

  test('cada linha soma juros, selo e capital; o selo é 4 % dos juros; juros descem e capital sobe', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [], HOJE);
    r.forEach((x) => { perto(x.amount, x.interest + x.stamp + x.principal, 0.005); perto(x.stamp, x.interest * 0.04, 0.011); });
    perto(r[0].interest, 250);   // 100 000 × 3 % / 12
    assert.ok(r[0].interest > r[31].interest && r[0].principal < r[31].principal, 'juros descem, capital sobe');
  });

  test('bate com o plano de amortização a partir do capital em dívida', () => {
    const r = app.loanPrestacoesEmFalta(fixa(), [], HOJE);
    const a = app.amort(fixa({ id: 'x' }), 32);   // id sem movimentos: o plano parte do mês 0
    a.rows.forEach((row, k) => {
      perto(r[k].interest, row.int, 0.011);
      perto(r[k].principal, row.cap, 0.011);
      perto(r[k].amount, row.pay + row.st, 0.02);
      perto(r[k].bal, row.bal, 0.011);
    });
  });

  test('sem selo quando stampTax é falso', () => {
    const r = app.loanPrestacoesEmFalta(fixa({ stampTax: false }), [], HOJE);
    assert.ok(r.length > 0);
    r.forEach((x) => { perto(x.stamp, 0); perto(x.amount, x.interest + x.principal, 0.005); });
  });

  test('as registadas encurtam o prazo e avançam a fase: a prestação é a do que resta', () => {
    const txs = [...Array(12)].map((_, k) => prest(`2025-${mm((k % 12) + 1)}-10`));   // 12 registadas, de 2025
    const r = app.loanPrestacoesEmFalta(fixa(), txs, HOJE);
    assert.equal(r.length, 12);                                   // jan … dez/2024
    perto(r[0].interest + r[0].principal, anuidade(100000, 3, 348), 0.011);
    const mista = fixa({ type: 'mista', rate: 2, fixedYears: 1, euribor: 3, spread: 1 });
    assert.equal(app.loanPrestacoesEmFalta(mista, txs, HOJE)[0].rate, 4, 'com 12 registadas a fase fixa já passou');
  });

  test('mista: a taxa muda na linha certa e a prestação sobe com ela', () => {
    const l = fixa({ type: 'mista', rate: 2, fixedYears: 1, euribor: 3, spread: 1 });
    const r = app.loanPrestacoesEmFalta(l, [], HOJE);
    assert.equal(r[11].rate, 2); assert.equal(r[12].rate, 4);
    perto(somaCap(r), 100000 - r[r.length - 1].bal, 0.005);
    assert.ok(r[12].amount > r[11].amount, 'a prestação sobe com a taxa');
    perto(r[12].interest + r[12].principal, anuidade(r[11].bal, 4, 348), 0.011);
  });

  test('crédito que fica liquidado: pára no saldo 0 e a última leva o resto', () => {
    const r = app.loanPrestacoesEmFalta(fixa({ years: 2, start: '2020-01-10' }), [], HOJE);
    assert.equal(r.length, 24);
    perto(r[23].bal, 0, 0.005);
    perto(somaCap(r), 100000, 0.005);
    perto(r[23].principal, r[22].bal, 0.005);
  });

  test('o exemplo de referência: 100 000 € a 3 % por 30 anos, há 10 anos → 120 prestações e 76 019,81 € em dívida', () => {
    const l = fixa({ start: haAnos(10), stampTax: false });
    const r = app.loanPrestacoesEmFalta(l, [], hoje);
    assert.equal(r.length, 120);
    perto(r[119].bal, 76019.81, 0.05);
    perto(somaCap(r), 100000 - r[119].bal, 0.005);
    perto(r[0].amount, 421.60, 0.05);
    // inseridas: o capital em dívida é o do fim da lista e o plano fica com 240 meses a 421,60 €
    app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
    app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', ownerIds: ['o1'], loans: [l] }));
    app.comDesfazer = () => {};
    const L = app.findLoan(app.prop('p1'), 'l1');
    app.inserirPrestacoesEmFalta(app.prop('p1'), L, r);
    perto(L.outstanding, 76019.81, 0.05);
    assert.equal(app.loanPaidN(L), 120);
    assert.equal(app.amort(L).n, 240);
    perto(app.loanCalc(L).base, 421.60, 0.05);
  });

  test('não mexe nos argumentos', () => {
    const l = fixa(), txs = [prest('2025-03-10')], antes = JSON.stringify([l, txs]);
    app.loanPrestacoesEmFalta(l, txs, HOJE);
    assert.equal(JSON.stringify([l, txs]), antes);
  });
});

describe('perguntar e inserir', () => {
  let perguntas, desfazer, start, p;
  beforeEach(() => {
    perguntas = []; desfazer = null;
    start = (ANO - 2) + '-01-15';
    app.confirmModal = (t, txt, cb) => { perguntas.push(txt); cb(); };
    app.comDesfazer = (m, r) => { desfazer = r; };
    app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
    p = app.normProp({ id: 'p1', name: 'Casa', ownerIds: ['o1'], loans: [fixa({ start })] });
    app.db.properties.push(p);
    app.syncAllLoanRecs();
  });
  const l = () => app.findLoan(app.prop('p1'), 'l1');
  const inseridas = () => app.db.transactions.filter((t) => t.loanId === 'l1' && (t.tags || []).indexOf('Estimativa') > -1);

  test('hipoteca nova com início no passado: pergunta, insere e abate o capital', () => {
    const lista = app.loanPrestacoesEmFalta(l(), [], hoje, app.loanRecOf(l()).next), n = lista.length;
    assert.ok(n > 20);
    app.perguntarPrestacoesEmFalta(p, {});
    assert.equal(perguntas.length, 1);
    assert.ok(/Aquisição/.test(perguntas[0]) && /desce de/.test(perguntas[0]) && !/liquidado/.test(perguntas[0]), perguntas[0]);
    assert.ok(perguntas[0].indexOf(app.euro2(lista[n - 1].bal)) > -1, 'diz para quanto desce: ' + perguntas[0]);
    assert.equal(inseridas().length, n);
    perto(l().outstanding, lista[n - 1].bal, 0.005);
    perto(l().outstanding, 100000 - somaCap(lista), 0.005);
    assert.ok(l().outstanding < 100000);
  });

  test('os movimentos têm a cara da recorrência automática e são prestações normais', () => {
    app.perguntarPrestacoesEmFalta(p, {});
    const t = inseridas()[0], modelo = app.loanRecTx(app.prop('p1'), l());
    assert.equal(t.kind, 'loan'); assert.equal(t.payType, 'prestacao'); assert.equal(t.propertyId, 'p1');
    assert.equal(t.label, modelo.label); assert.equal(t.category, modelo.category); assert.equal(t.sub, modelo.sub);
    assert.equal(t.split, null); assert.equal(t.paidBy, 'o1');          // dono único, como o prefill
    assert.equal(t.retro, undefined); assert.equal(t.fee, 0);
    assert.deepEqual([...t.tags], ['Estimativa']);
    assert.ok(app.db.settings.tags.indexOf('Estimativa') > -1, 'a etiqueta fica nas definições');
    perto(t.amount, t.interest + t.stamp + t.principal, 0.005);
    perto(t.interest, 250, 0.005);   // a primeira parte do capital da data de início
  });

  test('com dois donos o paidBy fica vazio', () => {
    app.db.owners.push(app.normPerson({ id: 'o2', name: 'Bento' })); app.prop('p1').ownerIds.push('o2');
    app.perguntarPrestacoesEmFalta(p, {});
    assert.equal(inseridas()[0].paidBy, null);
  });

  test('depois de inserir, o prazo restante e a prestação seguem as registadas — e a prestação base não muda', () => {
    const antes = app.loanCalc(l()).base;
    assert.equal(app.amort(l()).n, 360, 'sem nada registado a app só sabe o prazo inteiro');
    app.perguntarPrestacoesEmFalta(p, {});
    const n = inseridas().length;
    assert.equal(app.loanPaidN(l()), n);
    assert.equal(app.amort(l()).n, 360 - n);
    perto(app.loanRecOf(l()).tx.amount, Math.round(app.loanCalc(l()).total * 100) / 100, 0.005);
    perto(app.loanCalc(l()).base, antes, 0.02, 'menos capital sobre menos prazo: a mesma prestação (só o selo desce com os juros)');
    assert.ok(app.loanCalc(l()).stamp < 10, 'o selo desce com os juros');
  });

  test('a recorrência não pede esses meses: tudo o que se inseriu é anterior ao next', () => {
    app.perguntarPrestacoesEmFalta(p, {});
    const r = app.loanRecOf(l());
    assert.ok(r.next > hoje || app.recPending().some((x) => x.id === r.id));
    inseridas().forEach((t) => assert.ok(t.date < r.next, t.date + ' < ' + r.next));
    assert.equal(inseridas().filter((t) => t.date.slice(0, 7) === r.next.slice(0, 7)).length, 0);
  });

  test('início que recuou ou foi preenchido pergunta; início igual ou adiantado não', () => {
    app.perguntarPrestacoesEmFalta(p, { l1: start });                 assert.equal(perguntas.length, 0);
    app.perguntarPrestacoesEmFalta(p, { l1: '2019-01-15' });          assert.equal(perguntas.length, 0);
    app.perguntarPrestacoesEmFalta(p, { l1: '' });                    assert.equal(perguntas.length, 1);   // preenchido agora
    limpar(app); app.db.properties.push(p); app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
    app.perguntarPrestacoesEmFalta(p, { l1: (ANO - 1) + '-01-15' }); assert.equal(perguntas.length, 2);   // recuou um ano
  });

  test('sem dívida ou com a recorrência a começar no próprio início, não pergunta', () => {
    l().outstanding = 0; app.perguntarPrestacoesEmFalta(p, {}); assert.equal(perguntas.length, 0);
    l().outstanding = 100000; app.loanRecOf(l()).next = start;   // a recorrência começa no próprio início
    app.perguntarPrestacoesEmFalta(p, {}); assert.equal(perguntas.length, 0);
  });

  test('Anular tira as prestações em bloco e repõe o capital e a recorrência', () => {
    const amt = app.loanRecOf(l()).tx.amount;
    app.perguntarPrestacoesEmFalta(p, {});
    assert.ok(inseridas().length > 0 && typeof desfazer === 'function');
    assert.ok(l().outstanding < 100000);
    desfazer();
    assert.equal(inseridas().length, 0); assert.equal(app.db.transactions.length, 0);
    perto(l().outstanding, 100000); perto(app.loanRecOf(l()).tx.amount, amt, 0.005);
    assert.equal(app.amort(l()).n, 360);
  });

  test('apagar uma inserida repõe o capital dela, como qualquer prestação', () => {
    app.closeAllModals = () => {};
    app.perguntarPrestacoesEmFalta(p, {});
    const t = inseridas()[0], dep = l().outstanding;
    app.delTx(t.id); perto(l().outstanding, dep + t.principal, 0.005);
    const n = app.recTx(app.loanRecOf(l())); app.applyLoan(n); app.db.transactions.push(n);
    assert.ok(l().outstanding < dep + t.principal);
    app.delTx(n.id); perto(l().outstanding, dep + t.principal, 0.005);
  });

  test('ao editar, uma inserida devolve o seu capital ao que se pode amortizar', () => {
    app.perguntarPrestacoesEmFalta(p, {});
    const t = inseridas()[0];
    perto(app.loanAvail(Object.assign({}, t, { _edit: true }), l()), l().outstanding + t.principal, 0.005);
  });

  test('uma segunda recuada só preenche antes das já inseridas e volta a abater', () => {
    app.perguntarPrestacoesEmFalta(p, {});
    const n1 = inseridas().length, primeira = inseridas().map((t) => t.date).sort()[0], dep1 = l().outstanding;
    l().start = (ANO - 3) + '-01-15';
    app.perguntarPrestacoesEmFalta(p, { l1: start });
    assert.equal(inseridas().length, n1 + 12);
    const novas = inseridas().slice(n1);
    novas.forEach((t) => assert.ok(t.date < primeira));
    perto(l().outstanding, dep1 - somaCap(novas), 0.005);
    assert.equal(app.loanPaidN(l()), n1 + 12);
    assert.equal(app.amort(l()).n, 360 - n1 - 12);
  });

  test('crédito que fica liquidado: a pergunta diz, o capital vai a zero e a recorrência desaparece', () => {
    l().years = 2; l().start = (ANO - 3) + '-01-15';
    app.perguntarPrestacoesEmFalta(p, {});
    assert.equal(perguntas.length, 1);
    assert.ok(/liquidado/.test(perguntas[0]), perguntas[0]);
    assert.equal(inseridas().length, 24);
    perto(l().outstanding, 0, 0.005);
    assert.equal(app.loanRecOf(l()), undefined, 'sem dívida não há recorrência');
    desfazer();
    perto(l().outstanding, 100000); assert.ok(app.loanRecOf(l()), 'anular repõe a recorrência');
  });
});
