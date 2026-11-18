// A renda que entra abaixo da do planeado, e os encargos do imóvel a cargo do
// inquilino (a auditoria ao IRS, KAN-129, folha 2.4.3 do plano das correções).
// O IRS conta a renda do recibo, antes da retenção, da comissão e de
// descontos. Sem campo «Descontado» (decisão do Martinho): no Guardar e no
// Confirmar de uma renda ligada a um contrato, abaixo do planeado desse mês, a
// app pergunta «Entrou menos do que a renda: porquê?», com duas saídas —
// pagamento parcial (o resto fica em dívida e o planeado não avança, D115) ou
// um desconto (a renda inteira e a despesa do desconto proposta na categoria
// certa: a comissão da gestora em Outros, D112; a obra pela regra dela, D113;
// o encargo do imóvel, com o planeado dele saltado nesse mês, D114). Os
// encargos que o contrato põe a cargo do inquilino (c.encargosInquilino, o
// Q13) não se pedem nos meses em que ele está em vigor (D114). A dica do
// «Retido na fonte» diz o que é retenção (D116) e a renda pelo recibo (D112).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const HOJE = '2026-03-10';
const app = carregarApp({ hoje: HOJE });
afterEach(() => repor(app));

const PERGUNTA = 'Entrou menos do que a renda: porquê?';
/* a ordem das escolhas da pergunta */
const PARCIAL = 0, COMISSAO = 1, CONSERVACAO = 2, MELHORIA = 3, ENCARGO = 4;

/* Uma conta com um imóvel meu, um inquilino e o contrato C1 declarado (renda
   de 1 000 € ao dia 8 desde 2025), com as rendas de janeiro de 2025 a
   fevereiro de 2026 registadas, as janelas numa pilha observável e o que
   pinta e grava calado. Os avisos ficam em a.__avisos.
   Recebe: a — o contexto; ct (opcional) — o que muda no contrato; casa
   (opcional) — o que muda no imóvel; rendas (opcional) — false para não
   registar as rendas.
   Devolve: {c, janelas}. */
function monta(a, ct, casa, rendas) {
  limpar(a);
  a.definirServicosDesligados([]);
  if (a.CW) { a.CW.cargos = {}; a.CW.user = null; }
  a.modalStack.length = 0;
  const janelas = janelasFalsas(a, 'render', 'buildNav', 'save', 'avisoComVer', 'refreshDetail');
  const avisos = [];
  a.toast = (m) => { avisos.push(m); };
  a.__avisos = avisos;
  a.collectTx = () => {};
  a.db.owners.push(a.normPerson({ id: 'eu', name: 'Eu' }));
  a.db.tenants.push(a.normPerson({ id: 't1', name: 'Inquilino', nif: '123456789' }));
  a.db.properties.push(a.normProp(Object.assign({ id: 'p1', name: 'T2', ownerIds: ['eu'], use: 'investimento' }, casa || {})));
  const c = a.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'p1', tenantIds: ['t1'], rent: 1000, payDay: 8,
    start: '2025-01-01', active: true, fisco: { estado: 'declarado', numero: '999', finalidade: 'hp' } }, ct || {}));
  a.db.contracts.push(c);
  if (rendas !== false) {
    for (let k = 0; k < 14; k++) {
      const y = 2025 + Math.floor(k / 12), m = String((k % 12) + 1).padStart(2, '0');
      renda(a, y + '-' + m + '-08', 1000);
    }
  }
  return { c, janelas };
}

/* Uma renda do C1 já registada.
   Recebe: a — o contexto; date — o dia; amount — o montante; extra (opcional).
   Devolve: o movimento. */
function renda(a, date, amount, extra) {
  const t = a.normTx(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount, contractId: 'C1',
    propertyId: 'p1', date, recibo: true, label: 'Renda C1' }, extra || {}));
  a.db.transactions.push(t);
  return t;
}

/* O Guardar real do formulário aberto (o tForm é o que lá estaria).
   Recebe: a — o contexto.
   Devolve: nada. */
const guardar = (a) => a.txGuardar(null);
/* a última janela aberta */
const topo = (j) => j[j.length - 1];
const rendasDoMes = (a, mes) => a.db.transactions.filter((t) => t.contractId === 'C1' && a.mesDaRenda(t) === mes);
const despesas = (a) => a.db.transactions.filter((t) => t.kind === 'expense');
/* o resumo de 2026: as rendas e os gastos que contam */
function resumo(a) {
  const r = a.resumoFiscal(2026, 'eu'), g = {};
  Object.keys(r.totais.gastos).forEach((k) => { if (r.totais.gastos[k]) g[k] = r.totais.gastos[k]; });
  return JSON.parse(JSON.stringify({ rendas: r.totais.rendas, retencoes: r.totais.retencoes, gastos: g, liquido: r.totais.liquido }));
}

/* Confirma o planeado da renda de março pelo formulário (Rever), com o
   montante dado, e carrega no Guardar.
   Recebe: a — o contexto; montante — o que se escreve; retencao (opcional).
   Devolve: o planeado. */
function confirmarCom(a, montante, retencao) {
  a.syncAllContractRecs();
  const r = a.ctRecOf(a.db.contracts[0]);
  assert.equal(r.next, '2026-03-08', 'o planeado pede a renda de março');
  a.confirmRec(r.id);
  assert.equal(a.tForm.amount, 1000, 'o formulário abre com a renda do planeado');
  a.tForm.amount = montante;
  if (retencao != null) a.tForm.retencao = retencao;
  guardar(a);
  return r;
}

describe('D112 · a renda da gestora: a renda inteira e a comissão como gasto, uma vez', () => {
  test('confirmar 920 € pergunta porquê, e não grava nada antes da resposta', () => {
    const { janelas } = monta(app);
    const antes = app.db.transactions.length;
    const r = confirmarCom(app, 920);
    assert.equal(topo(janelas).t, PERGUNTA, 'abre a pergunta por cima do formulário');
    assert.match(topo(janelas).b, /faltam 80,00/);
    assert.match(topo(janelas).b, /renda do recibo, antes da retenção, da comissão e de descontos/);
    assert.equal(app.db.transactions.length, antes, 'nada gravado ainda');
    assert.equal(r.next, '2026-03-08', 'nem o planeado avançou');
  });

  test('«Comissão da gestora»: a renda grava-se com 1 000 € e a despesa de 80 € vem proposta em Outros (r2-rendas-liquidas-de-comissao A1/A2)', () => {
    const { janelas } = monta(app);
    const r = confirmarCom(app, 920);
    app._pick(COMISSAO);
    const mar = rendasDoMes(app, '2026-03');
    assert.equal(mar.length, 1);
    assert.equal(mar[0].amount, 1000, 'a renda do recibo, inteira');
    assert.equal(mar[0].parcial, false);
    assert.equal(r.next, '2026-04-08', 'o mês fica pago: o planeado avança');
    assert.equal(app.tForm.kind, 'expense', 'abre a despesa do desconto para conferir');
    assert.equal(app.tForm.amount, 80);
    assert.equal(app.tForm.category, 'Gestão e mediação');
    assert.equal(app.tForm.sub, 'Gestão do imóvel');
    assert.equal(app.irsColunaDe(app.tForm).col, 'outros');
    assert.equal(topo(janelas).t, 'Nova despesa');
    guardar(app);
    assert.deepEqual(resumo(app), { rendas: 3000, retencoes: 0, gastos: { outros: 80 }, liquido: 2920 },
      'rendas pelo recibo e a comissão deduzida uma vez');
  });

  test('a categoria renomeada nesta conta: a comissão vai na mesma a Outros (a coluna fixa-se no movimento)', () => {
    monta(app);
    const s = app.db.settings;
    s.cats['Gestora'] = s.cats['Gestão e mediação']; delete s.cats['Gestão e mediação'];
    confirmarCom(app, 920);
    app._pick(COMISSAO);
    assert.equal(app.tForm.category, '');
    assert.equal(app.tForm.irsCol, 'outros');
    assert.equal(app.irsColunaDe(app.tForm).col, 'outros');
  });

  test('com retenção: 670 € e 250 € retidos de uma renda de 1 000 € perguntam pelos 80 € que faltam', () => {
    const { janelas } = monta(app, { rent: 1000 });
    app.syncAllContractRecs();
    const r = app.ctRecOf(app.db.contracts[0]);
    r.tx.amount = 750; r.tx.retencao = 250;
    app.confirmRec(r.id);
    app.tForm.amount = 670;
    guardar(app);
    assert.equal(topo(janelas).t, PERGUNTA);
    assert.match(topo(janelas).b, /faltam 80,00/);
    app._pick(COMISSAO);
    const mar = rendasDoMes(app, '2026-03')[0];
    assert.equal(mar.amount, 750, 'o montante sobe o que faltava');
    assert.equal(mar.retencao, 250, 'e a retenção fica a do recibo');
  });

  test('«Outro desconto»: a renda inteira e a despesa sem categoria, para a pessoa escolher', () => {
    monta(app);
    confirmarCom(app, 950);
    app._pick(5);
    assert.equal(rendasDoMes(app, '2026-03')[0].amount, 1000);
    assert.equal(app.tForm.kind, 'expense');
    assert.equal(app.tForm.amount, 50);
    assert.equal(app.tForm.category, '');
    assert.match(app.tForm.label, /^Desconto na renda · /);
  });

  test('controlo: a renda inteira grava-se sem perguntar', () => {
    const { janelas } = monta(app);
    const r = confirmarCom(app, 1000);
    assert.notEqual(topo(janelas) && topo(janelas).t, PERGUNTA);
    assert.equal(rendasDoMes(app, '2026-03')[0].amount, 1000);
    assert.equal(r.next, '2026-04-08');
  });
});

describe('D115 · a renda paga só em parte fica em dívida, e o planeado continua a pedi-la', () => {
  test('«Pagamento parcial»: grava 550 € com parcial, o planeado não avança, e o Confirmar seguinte regista o resto', () => {
    monta(app, { rent: 850 }, null, false);
    for (let k = 0; k < 14; k++) renda(app, (2025 + Math.floor(k / 12)) + '-' + String((k % 12) + 1).padStart(2, '0') + '-08', 850);
    app.syncAllContractRecs();
    const r = app.ctRecOf(app.db.contracts[0]);
    app.confirmRec(r.id);
    app.tForm.amount = 550;
    guardar(app);
    app._pick(PARCIAL);
    const mar = rendasDoMes(app, '2026-03');
    assert.equal(mar.length, 1);
    assert.equal(mar[0].amount, 550);
    assert.equal(mar[0].parcial, true, 'a resposta grava-se no movimento (t.parcial)');
    assert.equal(r.next, '2026-03-08', 'o planeado não avança');
    assert.equal(app.rendaJaLancada(app.db.contracts[0], '2026-03-08'), false, 'o mês não está pago');
    app.syncAllContractRecs();
    assert.equal(r.next, '2026-03-08', 'nem depois do arranque');
    app.quickConfirmRec(r.id);
    const depois = rendasDoMes(app, '2026-03');
    assert.equal(depois.length, 2);
    assert.equal(depois[1].amount, 300, 'o Confirmar regista o resto, e não a renda outra vez');
    assert.equal(r.next, '2026-04-08', 'e o mês fecha');
  });

  test('o resto pelo formulário abre com o que falta e não volta a perguntar', () => {
    const { janelas } = monta(app);
    const r = confirmarCom(app, 600);
    app._pick(PARCIAL);
    app.confirmRec(r.id);
    assert.equal(app.tForm.amount, 400, 'abre com o resto');
    guardar(app);
    assert.notEqual(topo(janelas) && topo(janelas).t, PERGUNTA);
    assert.equal(rendasDoMes(app, '2026-03').length, 2);
    assert.equal(r.next, '2026-04-08');
  });

  test('registada à mão (o +): a renda de março abaixo do planeado também pergunta', () => {
    const { janelas } = monta(app);
    app.syncAllContractRecs();
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
    assert.equal(app.tForm.periodo, '2026-03');
    app.tForm.amount = 920;
    guardar(app);
    assert.equal(topo(janelas).t, PERGUNTA);
  });

  test('a renda em vigor nesse mês, nunca a de hoje: uma renda de janeiro (antes da atualização) não pergunta', () => {
    const { janelas } = monta(app, { rent: 1050 });
    app.db.transactions = app.db.transactions.filter((t) => app.mesDaRenda(t) !== '2026-01');
    app.syncAllContractRecs();
    const r = app.ctRecOf(app.db.contracts[0]);
    assert.equal(r.next, '2026-03-08', 'o planeado está em março');
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1', preset: { periodo: '2026-01', amount: 1000, label: 'Renda de janeiro' } });
    guardar(app);
    assert.notEqual(topo(janelas) && topo(janelas).t, PERGUNTA, 'sem planeado nesse mês não há com que comparar');
  });

  test('sem planeado da renda (automático desligado) não pergunta', () => {
    const { janelas } = monta(app, { autoRec: false });
    app.syncAllContractRecs();
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
    app.tForm.amount = 500;
    guardar(app);
    assert.notEqual(topo(janelas) && topo(janelas).t, PERGUNTA);
  });

  test('a caução não é a renda do mês: não pergunta', () => {
    const { janelas } = monta(app);
    app.syncAllContractRecs();
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1', preset: { category: 'Rendas', sub: 'Caução', amount: 500, label: 'Caução' } });
    guardar(app);
    assert.notEqual(topo(janelas) && topo(janelas).t, PERGUNTA);
  });

  test('a ficha diz que foi um pagamento parcial', () => {
    monta(app);
    const t = renda(app, '2026-03-08', 550, { parcial: true });
    assert.match(app.txFicha(t.id), /Parcial: o resto fica em dívida/);
  });
});

describe('D113 · a obra paga pelo inquilino segue a regra dela', () => {
  test('obra de reparação: renda inteira, a obra em Conservação e manutenção', () => {
    monta(app);
    confirmarCom(app, 700);
    app._pick(CONSERVACAO);
    assert.equal(rendasDoMes(app, '2026-03')[0].amount, 1000);
    assert.equal(app.tForm.amount, 300);
    assert.equal(app.irsColunaDe(app.tForm).col, 'conservacao');
    assert.match(app.txDicaDosAnexos(app.tForm), /fatura/);
  });

  test('obra de melhoria (beneficiação): renda inteira, a obra não dedutível', () => {
    monta(app);
    confirmarCom(app, 700);
    app._pick(MELHORIA);
    assert.equal(app.tForm.amount, 300);
    assert.equal(app.tForm.category, 'Obras e benfeitorias');
    assert.equal(app.irsColunaDe(app.tForm).col, 'nao');
    guardar(app);
    assert.deepEqual(resumo(app), { rendas: 3000, retencoes: 0, gastos: {}, liquido: 3000 }, 'o rendimento omitido volta');
  });
});

describe('D114 · o encargo descontado na renda: a despesa uma vez, e o planeado dele saltado nesse mês', () => {
  test('o condomínio descontado: oferece saltar o planeado de março, e a despesa vem no Condomínio', () => {
    const { janelas } = monta(app, null, { condominio: 50 });
    app.syncAllPropRecs();
    const cond = app.db.recurring.find((x) => x.tx.propRec === 'condominio');
    cond.next = '2026-03-01';
    confirmarCom(app, 950);
    app._pick(ENCARGO);
    assert.equal(topo(janelas).t, 'Que encargo pagou o inquilino?');
    app._pick(0);           // o condomínio
    assert.match(topo(janelas).t, /^Condomínio de mar 2026: está nos planeados$/);
    app._pick(0);           // saltar
    assert.equal(cond.next, '2026-04-01', 'o planeado do condomínio de março saltou');
    assert.equal(app.db.transactions.filter((t) => t.kind === 'expense').length, 0, 'sem confirmar o condomínio');
    assert.equal(rendasDoMes(app, '2026-03')[0].amount, 1000);
    assert.equal(app.tForm.category, 'Condomínio');
    assert.equal(app.tForm.amount, 50);
    guardar(app);
    assert.deepEqual(resumo(app).gastos, { condominio: 50 }, 'o condomínio deduz-se uma vez');
  });

  test('«Manter o planeado» não o salta', () => {
    monta(app, null, { condominio: 50 });
    app.syncAllPropRecs();
    const cond = app.db.recurring.find((x) => x.tx.propRec === 'condominio');
    cond.next = '2026-03-01';
    confirmarCom(app, 950);
    app._pick(ENCARGO);
    app._pick(0);
    app._pick(1);
    assert.equal(cond.next, '2026-03-01');
  });

  test('o IMI descontado sem planeado nesse mês vai direto à despesa no IMI', () => {
    monta(app);
    confirmarCom(app, 900);
    app._pick(ENCARGO);
    app._pick(1);           // o IMI
    assert.equal(app.tForm.kind, 'expense');
    assert.equal(app.irsColunaDe(app.tForm).col, 'imi');
    assert.equal(app.tForm.amount, 100);
  });
});

describe('Q13 / D114 · o encargo a cargo do inquilino não se pede enquanto o contrato está em vigor', () => {
  test('o condomínio da ficha: não fica por confirmar nem em atraso, e o arranque passa-o à frente', () => {
    monta(app, { encargosInquilino: ['condominio'], end: '2027-12-31' }, { condominio: 50 });
    app.syncAllPropRecs();
    const cond = app.db.recurring.find((x) => x.tx.propRec === 'condominio');
    cond.next = '2026-01-01';
    assert.equal(app.recPorConfirmar(cond), false, 'não se pede');
    assert.equal(app.recIsLate(cond), false, 'nem fica em atraso');
    assert.equal(app.recActive().some((x) => x.id === cond.id), false);
    assert.deepEqual(JSON.parse(JSON.stringify(app.datasEmFalta(cond))), [], 'nem no «Preencher»');
    app.syncAllPropRecs();
    assert.equal(cond.next, '2026-04-01', 'as ocorrências vencidas passam à frente; a de abril espera pelo dia dela');
  });

  test('o Confirmar recusa e diz porquê', () => {
    monta(app, { encargosInquilino: ['condominio'] }, { condominio: 50 });
    app.syncAllPropRecs();
    const cond = app.db.recurring.find((x) => x.tx.propRec === 'condominio');
    cond.next = '2026-03-01';
    app.quickConfirmRec(cond.id);
    assert.equal(despesas(app).length, 0);
    assert.match(app.__avisos.join(' | '), /encargo é do inquilino enquanto o contrato C1 estiver em vigor/);
    const ficha = app.recFicha(cond.id);
    assert.match(ficha, /Pago pelo inquilino/, 'a ficha do planeado diz porque não se pede');
    assert.doesNotMatch(ficha, /Por confirmar/);
  });

  test('quando o contrato acaba, volta a pedir-se ao senhorio', () => {
    monta(app, { encargosInquilino: ['condominio'], end: '2026-01-31', active: false }, { condominio: 50 });
    app.syncAllPropRecs();
    const cond = app.db.recurring.find((x) => x.tx.propRec === 'condominio');
    cond.next = '2026-01-01';
    app.syncAllPropRecs();
    assert.equal(cond.next, '2026-02-01', 'janeiro era do inquilino; fevereiro já não');
    assert.equal(app.recPorConfirmar(cond), true);
  });

  test('o IMI e o condomínio feitos à mão reconhecem-se pela categoria do IRS, e o seguro da ficha pelo planeado', () => {
    monta(app, { encargosInquilino: ['imi', 'condominio', 'seguro'] }, { seguro: 200, seguroMes: 2 });
    const imi = app.normRec({ name: 'IMI', every: 'year', next: '2026-03-01', tx: { kind: 'expense', propertyId: 'p1', category: 'Impostos', sub: 'IMI', amount: 300, label: 'IMI' } });
    const cond = app.normRec({ name: 'Cond', every: 'month', next: '2026-03-01', tx: { kind: 'expense', propertyId: 'p1', category: 'Condomínio', sub: 'Quota mensal', amount: 40, label: 'Cond' } });
    const luz = app.normRec({ name: 'Luz', every: 'month', next: '2026-03-01', tx: { kind: 'expense', propertyId: 'p1', category: 'Limpeza e jardim', amount: 40, label: 'Luz' } });
    app.db.recurring.push(imi, cond, luz);
    app.syncAllPropRecs();
    const seg = app.db.recurring.find((x) => x.tx.propRec === 'seguro');
    assert.equal(app.recEncargoDoInquilino(imi), 'imi');
    assert.equal(app.recEncargoDoInquilino(cond), 'condominio');
    assert.equal(app.recEncargoDoInquilino(seg), 'seguro');
    assert.equal(app.recEncargoDoInquilino(luz), '');
    assert.equal(app.recPorConfirmar(luz), true, 'o que não é encargo do inquilino continua a pedir-se');
    assert.equal(imi.next, '2027-03-01');
    assert.equal(cond.next, '2026-04-01');
  });

  test('um contrato sem o campo, ou com outro encargo, não suspende nada', () => {
    monta(app, { encargosInquilino: ['imi'] }, { condominio: 50 });
    app.db.contracts[0].encargosInquilino = undefined;
    app.syncAllPropRecs();
    const cond = app.db.recurring.find((x) => x.tx.propRec === 'condominio');
    cond.next = '2026-03-01';
    assert.equal(app.recPorConfirmar(cond), true);
    app.db.contracts[0].encargosInquilino = ['imi'];
    assert.equal(app.recPorConfirmar(cond), true);
  });

  test('numa casa onde só colaboro não mexe nos planeados do dono, mas também não mos pede', () => {
    monta(app, { encargosInquilino: ['condominio'] }, { condominio: 50 });
    app.syncAllPropRecs();
    const cond = app.db.recurring.find((x) => x.tx.propRec === 'condominio');
    cond.next = '2026-01-01';
    app.CW = { cargos: { p1: { dono: false } } };
    app.recSaltarEncargosDoInquilino('p1');
    assert.equal(cond.next, '2026-01-01');
    assert.equal(app.recPorConfirmar(cond), false);
  });
});

describe('D116 e D112 · os textos dos campos da renda', () => {
  test('o «Retido na fonte» diz o que é retenção, e a renda conta pelo recibo', () => {
    monta(app);
    app.syncAllContractRecs();
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
    const h = app.txFiscoSect().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.match(h, /só o IRS que o inquilino reteve e entregou à AT por ti/);
    assert.match(h, /a comissão da gestora e os descontos não são retenção/);
    assert.match(h, /O montante é a renda do recibo menos o retido na fonte/);
    assert.doesNotMatch(h, /a renda bruta é o montante mais isto/, 'a dica que convidava a escrever ali a comissão');
  });
});
