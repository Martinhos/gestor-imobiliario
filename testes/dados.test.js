// Normalização dos registos, métricas anuais e movimentos planeados.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual } from './arnes.js';

const app = carregarApp();
const perto = (a, b, tol = 0.01) =>
  assert.ok(Math.abs(a - b) <= tol, `esperava ${b} (±${tol}), veio ${a}`);

beforeEach(() => limpar(app));

describe('normalização', () => {
  test('um imóvel vazio ganha os valores por omissão', () => {
    const p = app.normProp({});
    assert.ok(p.id, 'tem id');
    assert.equal(p.use, 'investimento');
    assert.equal(p.rentalMode, 'inteiro');
    igual(p.ownerIds, []);
    assert.equal(p.value, 0);
  });

  test('campos de versões antigas são limpos — o VPT fica, que o Anexo F o pede', () => {
    const p = app.normProp({ id: 'p', name: 'X', vpt: 1000, imiRate: 0.3, monthlyRent: 500, tenant: 'alguém' });
    assert.equal(p.vpt, 1000, 'o valor patrimonial tributário é o mesmo de sempre e volta a ter uso');
    assert.equal(p.imiRate, undefined);
    assert.equal(p.monthlyRent, undefined);
    assert.equal(p.tenant, undefined);
  });

  test('quartos escritos como texto viram objetos', () => {
    const p = app.normProp({ id: 'p', name: 'X', rooms: ['Quarto 1', 'Quarto 2'] });
    assert.equal(p.rooms.length, 2);
    assert.equal(p.rooms[0].name, 'Quarto 1');
    assert.ok(p.rooms[0].id, 'cada quarto ganha id');
  });

  test('um movimento sem tipo é uma despesa', () => {
    const t = app.normTx({});
    assert.equal(t.kind, 'expense');
    assert.equal(t.amount, 0);
    igual(t.tags, []);
  });

  test('a divisão por quota-parte é o mesmo que não ter divisão', () => {
    assert.equal(app.normTx({ split: { mode: 'quota', parts: {} } }).split, null);
    assert.equal(app.normTx({ split: {} }).split, null);
  });

  test('um movimento com imóvel não pode estar num grupo', () => {
    const t = app.normTx({ propertyId: 'p1', groupId: 'g1' });
    assert.equal(t.propertyId, 'p1');
    assert.equal(t.groupId, null);
  });

  test('um contrato guarda o inventário e as chaves com quantidades', () => {
    const c = app.normContract({
      propertyId: 'p', inventory: [{ name: 'Cadeira', qty: 4 }], keys: [{ name: 'Porta' }],
    });
    assert.equal(c.inventory[0].qty, 4);
    assert.equal(c.inventory[0].state, 'usado');
    assert.equal(c.keys[0].qty, 1);
    assert.ok(c.inventory[0].id && c.keys[0].id);
  });

  test('uma hipoteca sem dados fica com o prazo habitual', () => {
    const l = app.normLoan({});
    assert.equal(l.years, 30);
    assert.equal(l.type, 'fixa');
    assert.equal(l.index, '6m');
  });

  test('uma pessoa nasce portuguesa e sem documentos', () => {
    const p = app.normPerson({ name: 'Ana' });
    assert.equal(p.nationality, 'Portuguesa');
    igual(p.files, []);
  });
});

describe('estado do imóvel', () => {
  const comContrato = (extra = {}) => {
    const p = app.normProp(Object.assign({ id: 'p1', name: 'T2' }, extra));
    app.db.properties.push(p);
    return p;
  };

  test('sem contrato está vago', () => {
    assert.equal(app.propStatus(comContrato()).key, 'vago');
  });

  test('para uso próprio nunca está vago', () => {
    assert.equal(app.propStatus(comContrato({ use: 'proprio' })).key, 'proprio');
  });

  test('com contrato ativo está arrendado', () => {
    const p = comContrato();
    app.db.contracts.push(app.normContract({ propertyId: p.id, rent: 800, active: true }));
    assert.equal(app.propStatus(p).key, 'arrendado');
  });

  test('por quartos, com um quarto ocupado de dois, está parcial', () => {
    const p = comContrato({
      rentalMode: 'quartos', rooms: [{ id: 'q1', name: 'A' }, { id: 'q2', name: 'B' }],
    });
    app.db.contracts.push(app.normContract({ propertyId: p.id, roomId: 'q1', rent: 400, active: true }));
    assert.equal(app.propStatus(p).key, 'parcial');
  });

  test('um contrato terminado não conta', () => {
    const p = comContrato();
    app.db.contracts.push(app.normContract({
      propertyId: p.id, rent: 800, active: true, end: '2020-01-01',
    }));
    assert.equal(app.propStatus(p).key, 'vago');
  });
});

describe('métricas do ano', () => {
  const ANO = new Date().getFullYear();
  const mov = (kind, amount, extra = {}) => app.db.transactions.push(app.normTx(Object.assign({
    kind, amount, propertyId: 'p1', date: ANO + '-03-15',
  }, extra)));

  beforeEach(() => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'T2', value: 200000, purchase: 150000 }));
  });

  test('soma receitas, despesas e prestações em separado', () => {
    mov('income', 1000);
    mov('expense', 300);
    mov('loan', 400);
    const m = app.metrics(ANO, 'p1', {});
    perto(m.income, 1000);
    perto(m.op, 300);
    perto(m.loan, 400);
  });

  test('o cashflow desconta tudo à receita', () => {
    mov('income', 1000);
    mov('expense', 300);
    mov('loan', 400);
    const m = app.metrics(ANO, 'p1', {});
    perto(m.noi, 700);    // receita menos despesa, sem a prestação
    perto(m.cf, 300);     // e depois de pagar o banco
  });

  test('movimentos de outros anos ficam de fora', () => {
    mov('income', 1000);
    mov('income', 9999, { date: '2019-03-15' });
    perto(app.metrics(ANO, 'p1', {}).income, 1000);
  });

  test('categorias fora dos totais não somam', () => {
    app.db.settings.exclude = { 'cats:Obras e benfeitorias': true };
    mov('expense', 300, { category: 'Obras e benfeitorias' });
    mov('expense', 100, { category: 'Seguros' });
    perto(app.metrics(ANO, 'p1', {}).op, 100);
  });

  test('as prestações contam sempre, mesmo excluindo categorias', () => {
    app.db.settings.exclude = { 'cats:Crédito à habitação': true };
    mov('loan', 400, { category: 'Crédito à habitação' });
    perto(app.metrics(ANO, 'p1', {}).loan, 400);
  });

  test('o mês a mês coloca cada movimento no seu mês', () => {
    mov('income', 100, { date: ANO + '-01-10' });
    mov('income', 250, { date: ANO + '-03-10' });
    const m = app.monthly(ANO, 'p1', 'income', false);
    assert.equal(m.length, 12);
    perto(m[0], 100);
    perto(m[2], 250);
    perto(m[1], 0);
  });

  test('o LTV é a dívida sobre o valor de mercado', () => {
    app.db.properties[0].loans = [app.normLoan({ id: 'l1', outstanding: 100000 })];
    perto(app.metrics(ANO, 'p1', {}).ltv, 0.5);   // 100k de 200k
  });

  test('despesas por categoria vêm ordenadas pelo peso', () => {
    mov('expense', 100, { category: 'Seguros' });
    mov('expense', 500, { category: 'Obras e benfeitorias' });
    const cats = app.byCategory(ANO, 'p1', false);
    assert.equal(cats[0].label, 'Obras e benfeitorias');
    perto(cats[0].value, 500);
  });
});

/* Um contrato tem três estados, e a app sabia dois: «ainda não começou» caía
   em «acabou». Além de mentir por escrito no ecrã, isso apagava a renda
   planeada de um contrato assinado para o futuro — e com ela a divisão entre
   proprietários e a categoria que a pessoa lhe tinha dado. */
describe('um contrato que ainda não começou', () => {
  const ano = Number(app.today().slice(0, 4));

  test('os três estados, e o que cada um responde', () => {
    assert.equal(app.ctEstado({}), 'ativo', 'sem datas, está em vigor');
    assert.equal(app.ctEstado({ start: (ano - 1) + '-01-01' }), 'ativo');
    assert.equal(app.ctEstado({ start: (ano + 2) + '-01-01' }), 'futuro');
    assert.equal(app.ctEstado({ end: (ano - 1) + '-12-31' }), 'terminado');
    assert.equal(app.ctEstado({ active: false }), 'terminado');
    // e o que cada predicado responde a partir daí
    const fut = { start: (ano + 2) + '-01-01' };
    assert.equal(app.isActive(fut), false, 'não está em vigor hoje: não conta para as rendas');
    assert.equal(app.ctVivo(fut), true, 'mas ainda não acabou: continua a haver o que planear');
  });

  /* Uma recorrência é um CURSOR, não um histórico: guarda uma data só. Quem
     guarda o que já aconteceu são os movimentos, registos próprios. Por isso
     o cursor pode andar nos dois sentidos — o que ele não pode é passar por
     cima de um mês que já tem movimento deste contrato. */
  test('o cursor da renda acompanha o contrato nos dois sentidos, sem passar por cima do que já foi lançado', () => {
    app.db.recurring = [];
    app.db.properties = [app.normProp({ id: 'casa', name: 'Casa' })];
    const c = app.normContract({ id: 'C1', propertyId: 'casa', rent: 800, payDay: 5, start: (ano - 1) + '-01-01' });
    app.db.contracts = [c];
    app.db.transactions = [];
    app.syncContractRec(c);
    const cursor = () => (app.ctRecOf(c) || {}).next;
    assert.equal(cursor(), (ano - 1) + '-01-05');

    // três meses confirmados: são movimentos, com registo próprio
    const rd = app.render, bn = app.buildNav, sv = app.save, ts = app.toast;
    app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {};
    for (let i = 0; i < 3; i++) app.quickConfirmRec(app.ctRecOf(c).id);
    app.render = rd; app.buildNav = bn; app.save = sv; app.toast = ts;
    assert.equal(app.db.transactions.length, 3);
    assert.equal(cursor(), (ano - 1) + '-04-05');

    // o início vai por engano para daqui a uns anos: o cursor vai com ele
    c.start = (ano + 2) + '-03-15';
    app.syncContractRec(c);
    assert.equal(cursor(), (ano + 2) + '-04-05', 'o dia 5 de março já passou quando começa a 15');
    assert.equal(app.db.transactions.length, 3, 'as confirmadas não se mexem');

    // e a correção: volta, mas PÁRA no primeiro mês por confirmar
    c.start = (ano - 1) + '-01-01';
    app.syncContractRec(c);
    assert.equal(cursor(), (ano - 1) + '-04-05', 'não volta a janeiro: janeiro, fevereiro e março já têm movimento');
    assert.equal(app.db.transactions.length, 3);
  });

  test('confirmar um mês que já tem movimento salta em vez de duplicar', () => {
    app.db.recurring = [];
    app.db.properties = [app.normProp({ id: 'casa', name: 'Casa' })];
    const c = app.normContract({ id: 'C1', propertyId: 'casa', rent: 800, payDay: 5, start: (ano - 1) + '-01-01' });
    app.db.contracts = [c];
    // a renda de janeiro foi lançada à mão
    app.db.transactions = [app.normTx({
      id: 'M1', kind: 'income', label: 'Renda de janeiro', amount: 800,
      date: (ano - 1) + '-01-20', propertyId: 'casa', contractId: 'C1',
    })];
    app.syncContractRec(c);
    // o cursor nem sequer aterra em janeiro
    assert.equal((app.ctRecOf(c) || {}).next, (ano - 1) + '-02-05');
    assert.equal(app.db.transactions.length, 1, 'e nada foi criado a mais');
  });

  /* A data de um movimento é um FACTO: diz que o dinheiro entrou naquele dia.
     Não se move com o contrato — a app aponta, e a pessoa decide. */
  test('os movimentos fora das datas do contrato são apontados, dos dois lados', () => {
    const c = app.normContract({ id: 'C1', propertyId: 'casa', rent: 800, start: ano + '-01-01', end: ano + '-01-31' });
    app.db.contracts = [c];
    app.db.transactions = [
      app.normTx({ id: 'A', kind: 'income', amount: 800, date: (ano - 1) + '-12-20', propertyId: 'casa', contractId: 'C1' }),
      app.normTx({ id: 'B', kind: 'income', amount: 800, date: ano + '-01-20', propertyId: 'casa', contractId: 'C1' }),
      app.normTx({ id: 'C', kind: 'income', amount: 800, date: ano + '-03-20', propertyId: 'casa', contractId: 'C1' }),
    ];
    const fora = app.movimentosForaDoContrato(c);
    assert.deepEqual(fora.map((t) => t.id), ['A', 'C'], 'o de dentro fica de fora da lista');
  });

  test('a renda fica planeada, e para o mês e dia em que o contrato começa', () => {
    app.limparBase ? app.limparBase() : null;
    app.db.recurring = [];
    app.db.properties = [app.normProp({ id: 'casa', name: 'Casa' })];
    const c = app.normContract({
      id: 'C1', propertyId: 'casa', rent: 800, payDay: 5, start: (ano + 2) + '-03-15',
    });
    app.db.contracts = [c];
    app.syncContractRec(c);
    const r = (app.db.recurring || []).find((x) => x.tx && x.tx.contractId === 'C1');
    assert.ok(r, 'a recorrência existe — não foi apagada por o contrato ainda não ter começado');
    assert.equal(r.next, (ano + 2) + '-04-05', 'o dia 5 de março já passou quando o contrato começa a 15');

    // e mudar o início para a frente leva a renda planeada com ele
    c.start = (ano + 3) + '-07-01';
    app.syncContractRec(c);
    const r2 = (app.db.recurring || []).find((x) => x.tx && x.tx.contractId === 'C1');
    assert.equal(r2.next, (ano + 3) + '-07-05');
  });
});

describe('movimentos planeados', () => {
  const hoje = app.today();
  const rec = (extra = {}) => app.normRec(Object.assign({
    id: 'r1', name: 'Renda', every: 'month', next: hoje,
    tx: { kind: 'income', amount: 800, label: 'Renda' },
  }, extra));

  test('vencido hoje conta como por confirmar', () => {
    app.db.recurring.push(rec());
    assert.equal(app.recPending().length, 1);
    assert.equal(app.recActive().length, 1);
  });

  test('silenciado sai dos avisos mas continua pendente', () => {
    app.db.recurring.push(rec({ muted: true }));
    assert.equal(app.recPending().length, 1);
    assert.equal(app.recActive().length, 0);
  });

  test('só fica em atraso depois de fechada a janela', () => {
    assert.equal(app.recIsLate(rec({ next: hoje, until: hoje })), false);
    assert.equal(app.recIsLate(rec({ next: '2020-01-01', until: '2020-01-05' })), true);
  });

  test('confirmar avança um mês', () => {
    const r = rec({ next: '2026-01-31' });
    app.db.recurring.push(r);
    app.recAdvance(r);
    assert.equal(r.next, '2026-02-28', 'o dia 31 encolhe para o último de fevereiro');
  });

  test('cadências diferentes avançam o intervalo certo', () => {
    const casos = [['week', '2026-01-08'], ['month', '2026-02-01'], ['quarter', '2026-04-01'], ['year', '2027-01-01']];
    casos.forEach(([every, esperado]) => {
      const r = rec({ every, next: '2026-01-01' });
      app.db.recurring = [r];
      app.recAdvance(r);
      assert.equal(r.next, esperado, 'cadência ' + every);
    });
  });

  test('um plano de uma só vez desaparece depois de confirmado', () => {
    const r = rec({ every: 'once' });
    app.db.recurring.push(r);
    app.recAdvance(r);
    assert.equal(app.db.recurring.length, 0);
  });

  test('o plano acaba quando passa a data de fim', () => {
    const r = rec({ next: '2026-01-01', end: '2026-01-15' });
    app.db.recurring.push(r);
    app.recAdvance(r);
    assert.equal(app.db.recurring.length, 0, 'fevereiro já é depois do fim');
  });

  test('a janela de confirmação acompanha a data seguinte', () => {
    const r = rec({ next: '2026-01-01', until: '2026-01-08' });
    app.db.recurring.push(r);
    app.recAdvance(r);
    assert.equal(r.next, '2026-02-01');
    assert.equal(r.until, '2026-02-08', 'a janela mantém a mesma largura');
  });
});
