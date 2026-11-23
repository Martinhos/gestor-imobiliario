// Os planeados e o confirmar das rendas, pelo que o IRS precisa (KAN-127,
// folha 2.2.3 do plano das correções). A renda conta no ano em que se recebe:
// o «Confirmar» de uma renda cujo dia previsto é de outro ano que hoje
// pergunta o dia em que entrou, e o mês a que respeita fica o previsto (D22,
// decisão do Martinho; D88, também no «Preencher N em falta»). Com retenção
// na fonte no planeado da renda, o montante é a renda menos a retenção, e a
// retenção acompanha a renda quando ela muda (D23). O planeado da renda de um
// contrato com rendas depois do termo não se apaga (D15). Recusar uma renda,
// ou largá-la com o «Começar a partir de hoje», lembra que ela se declara se
// entrou (D04). O planeado do seguro da ficha do imóvel diz que não entra no
// Anexo F (D06). Cada defeito tem aqui pelo menos um assert que falhava antes.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor, igual, elementos } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const HOJE = '2026-01-05';
const app = carregarApp({ hoje: HOJE });
afterEach(() => repor(app));
const tudo = carregarTudo({ hoje: HOJE });
afterEach(() => repor(tudo));

/* espera que corra o que a app deixou para depois (a pergunta do dia abre
   depois de quem chamou o Confirmar acabar) */
const tique = () => new Promise((r) => setTimeout(r, 0));

/* Uma conta com um imóvel meu, um inquilino com NIF e o contrato C1
   declarado, com as janelas numa pilha observável e o que pinta e grava
   calado. Os avisos (toast) ficam em a.__avisos.
   Recebe: a — o contexto; ct (opcional) — o que muda no contrato.
   Devolve: {c, janelas} — o contrato e as janelas abertas. */
function monta(a, ct) {
  limpar(a);
  a.definirServicosDesligados([]);
  if (a.CW) { a.CW.cargos = {}; a.CW.user = null; a.CW._fillQueue = []; }
  a.modalStack.length = 0;
  const janelas = janelasFalsas(a, 'render', 'buildNav', 'save', 'avisoComVer', 'refreshDetail');
  const avisos = [];
  a.toast = (m) => { avisos.push(m); };
  a.__avisos = avisos;
  a.db.owners.push(a.normPerson({ id: 'eu', name: 'Eu' }));
  a.db.tenants.push(a.normPerson({ id: 't1', name: 'Inquilino', nif: '123456789' }));
  a.db.properties.push(a.normProp({ id: 'p1', name: 'T2 Arroios', ownerIds: ['eu'], use: 'investimento' }));
  const c = a.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'p1', tenantIds: ['t1'], rent: 800, payDay: 8,
    start: '2025-01-01', active: true, fisco: { estado: 'declarado', numero: '999', finalidade: 'hp' } }, ct || {}));
  a.db.contracts.push(c);
  return { c, janelas };
}

/* Uma renda do contrato C1 já registada.
   Recebe: a — o contexto; date — o dia; extra (opcional) — outros campos.
   Devolve: o movimento. */
function renda(a, date, extra) {
  const t = a.normTx(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 800, contractId: 'C1',
    propertyId: 'p1', date, recibo: true }, extra || {}));
  a.db.transactions.push(t);
  return t;
}

/* as rendas de janeiro a novembro de 2025, cada uma no dia 8 do seu mês */
const janANov = (a) => { for (let m = 1; m <= 11; m++) renda(a, '2025-' + String(m).padStart(2, '0') + '-08'); };

/* o total das rendas e o que vem de anos anteriores, num ano da Declaração */
function resumo(a, ano) {
  const r = a.resumoFiscal(ano, 'eu');
  return JSON.parse(JSON.stringify({ rendas: r.totais.rendas, retencoes: r.totais.retencoes,
    ant: (r.linhas[0] || {}).anosAnteriores || [] }));
}

describe('D22 · a renda de dezembro confirmada em janeiro pergunta o dia em que entrou', () => {
  test('o Confirmar não regista: abre a pergunta, e o dia dito decide o ano (d22-confirmar-data)', async () => {
    const { c, janelas } = monta(app);
    janANov(app);
    app.syncAllContractRecs();
    const r = app.ctRecOf(c);
    assert.equal(r.next, '2025-12-08', 'o planeado pede a renda de dezembro');
    const antes = app.db.transactions.length;
    app.quickConfirmRec(r.id);
    await tique();
    assert.equal(app.db.transactions.length, antes, 'sem o dia, não se regista nada');
    assert.equal(app.ctRecOf(c).next, '2025-12-08', 'e o planeado não anda');
    const q = janelas[janelas.length - 1];
    assert.ok(q, 'abriu uma janela');
    assert.equal(q.t, 'Em que dia entrou?');
    assert.match(q.b, /<input id="rec_dia" type="date" value="" max="2026-01-05">/, 'o dia, por preencher, até hoje');
    assert.match(q.b, /Dia em que entrou <span class="req">\*<\/span>/, 'obrigatório');
    assert.match(q.b, /conta no IRS do ano em que a recebeste/);
    assert.match(q.f, /data-click="recConfirmarNoDia\('[^']+'\)">Confirmar<\/button>/);

    elementos(app).rec_dia.value = '2026-01-05';
    app.recConfirmarNoDia(r.id);
    const t = app.db.transactions[app.db.transactions.length - 1];
    igual({ date: t.date, periodo: t.periodo, amount: t.amount }, { date: '2026-01-05', periodo: '2025-12', amount: 800 });
    assert.equal(app.ctRecOf(c).next, '2026-01-08', 'dezembro está lançado: o planeado passa a janeiro');
    igual(resumo(app, 2025), { rendas: 8800, retencoes: 0, ant: [] }, '2025: as 11 rendas que entraram em 2025');
    igual(resumo(app, 2026), { rendas: 800, retencoes: 0, ant: [{ ano: 2025, valor: 800, retencoes: 0 }] },
      '2026: a de dezembro, que entrou em janeiro, marcada como de 2025');
  });

  test('a renda que entrou ainda em dezembro fica em 2025', async () => {
    const { c } = monta(app);
    janANov(app);
    app.syncAllContractRecs();
    app.quickConfirmRec(app.ctRecOf(c).id);
    await tique();
    elementos(app).rec_dia.value = '2025-12-30';
    app.recConfirmarNoDia(app.ctRecOf(c).id);
    const t = app.db.transactions[app.db.transactions.length - 1];
    igual({ date: t.date, periodo: t.periodo }, { date: '2025-12-30', periodo: '2025-12' });
    assert.equal(resumo(app, 2025).rendas, 9600);
    assert.equal(resumo(app, 2026).rendas, 0);
  });

  test('o dia é obrigatório, não passa de hoje nem fica antes da compra da casa', async () => {
    const { c } = monta(app);
    app.db.properties[0].purchaseDate = '2025-01-01';
    janANov(app);
    app.syncAllContractRecs();
    const id = app.ctRecOf(c).id, n = app.db.transactions.length;
    app.quickConfirmRec(id);
    await tique();
    elementos(app).rec_dia.value = '';
    app.recConfirmarNoDia(id);
    assert.equal(app.db.transactions.length, n);
    assert.match(app.__avisos.join(' | '), /Indica o dia em que a renda entrou\./);
    elementos(app).rec_dia.value = '2026-01-06';
    app.recConfirmarNoDia(id);
    assert.equal(app.db.transactions.length, n, 'amanhã não');
    assert.match(app.__avisos.join(' | '), /não pode ser depois de hoje/);
    elementos(app).rec_dia.value = '2024-12-31';
    app.recConfirmarNoDia(id);
    assert.equal(app.db.transactions.length, n, 'antes da compra não');
    assert.match(app.__avisos.join(' | '), /O imóvel foi comprado a 01\/01\/2025/);
    assert.equal(app.modalStack.length, 1, 'a pergunta continua aberta');
  });

  test('a renda de janeiro do ano de hoje também pergunta (pode ter entrado em dezembro, N146): com o dia de hoje, regista hoje com o mês previsto', async () => {
    const { c, janelas } = monta(app, { start: '2025-12-01', payDay: 2 });
    renda(app, '2025-12-02');
    app.syncAllContractRecs();
    const r = app.ctRecOf(c);
    assert.equal(r.next, '2026-01-02');
    const n = app.db.transactions.length;
    app.quickConfirmRec(r.id);
    await tique();
    assert.equal(app.db.transactions.length, n, 'pergunta antes de registar');
    assert.equal(janelas[janelas.length - 1].t, 'Em que dia entrou?');
    elementos(app).rec_dia.value = HOJE;
    app.recConfirmarNoDia(r.id);
    const t = app.db.transactions[app.db.transactions.length - 1];
    igual({ date: t.date, periodo: t.periodo }, { date: HOJE, periodo: '2026-01' });
  });

  test('só nas rendas: a despesa e a prestação de dezembro confirmadas em janeiro registam-se logo', () => {
    monta(app);
    app.db.recurring.push(app.normRec({ id: 'R1', name: 'Limpeza', every: 'month', next: '2025-12-10',
      tx: { kind: 'expense', label: 'Limpeza', amount: 30, propertyId: 'p1' } }));
    assert.equal(app.recPedeODia(app.db.recurring[0]), false);
    app.quickConfirmRec('R1');
    const t = app.db.transactions[app.db.transactions.length - 1];
    igual({ date: t.date, periodo: t.periodo, kind: t.kind }, { date: HOJE, periodo: '2025-12', kind: 'expense' });
  });

  test('o «Pede atenção» refaz-se por baixo e a pergunta fica por cima', async () => {
    const { c, janelas } = monta(app);
    janANov(app);
    app.syncAllContractRecs();
    const id = app.ctRecOf(c).id;
    const refeitas = [];
    app.notifModal = (f) => {
      refeitas.push(f);
      const top = app.modalStack[app.modalStack.length - 1];
      if (top && top.t === 'Pede atenção') return;
      app.openModal('Pede atenção', '', '');
    };
    app.openModal('Pede atenção', '', '');
    app.modalStack[0].title = 'Pede atenção';
    // o data-click do Confirmar do «Pede atenção»: quickConfirmRec(id);notifModal(f)
    app.quickConfirmRec(id); app.notifModal('');
    await tique();
    assert.equal(janelas[janelas.length - 1].t, 'Em que dia entrou?', 'a pergunta abre por cima');
    assert.equal(app.modalStack.length, 2);
    elementos(app).rec_dia.value = HOJE;
    app.recConfirmarNoDia(id);
    assert.equal(app.modalStack.length, 1, 'fecha só a pergunta');
    assert.equal(refeitas.length, 2, 'e o «Pede atenção» refaz-se sem a linha já confirmada');
  });
});

describe('D88 · a renda guarda o mês a que respeita', () => {
  test('o planeado a pedir dezembro com janeiro já pago: o Confirmar não regista dezembro no dia de hoje às cegas (d88b-no-dia)', async () => {
    const { c } = monta(app);
    janANov(app);
    app.syncAllContractRecs();
    // a de dezembro entrou a 3 de janeiro e foi registada à mão com o mês do dia
    renda(app, '2026-01-03', { periodo: '2026-01' });
    app.syncAllContractRecs();
    const r = app.ctRecOf(c);
    assert.equal(r.next, '2025-12-08');
    const n = app.db.transactions.length;
    app.quickConfirmRec(r.id);
    await tique();
    assert.equal(app.db.transactions.length, n, 'pergunta o dia antes de registar');
    elementos(app).rec_dia.value = '2026-01-04';
    app.recConfirmarNoDia(r.id);
    const t = app.db.transactions[app.db.transactions.length - 1];
    igual({ date: t.date, periodo: t.periodo }, { date: '2026-01-04', periodo: '2025-12' }, 'o mês do previsto, não o da data');
    igual(resumo(app, 2026).ant, [{ ano: 2025, valor: 800, retencoes: 0 }], 'e vai aos anos anteriores');
  });

  test('o «Preencher N em falta» escreve o mês de cada renda', () => {
    const { c } = monta(tudo, { start: '2025-09-01', payDay: 8 });
    tudo.syncAllContractRecs();
    const r = tudo.ctRecOf(c);
    const datas = tudo.datasEmFalta(r);
    igual(datas, ['2025-09-08', '2025-10-08', '2025-11-08', '2025-12-08']);
    const n = tudo.fillCriar(r, datas);
    assert.equal(n, 4);
    igual(tudo.db.transactions.map((t) => [t.date, t.periodo]),
      [['2025-09-08', '2025-09'], ['2025-10-08', '2025-10'], ['2025-11-08', '2025-11'], ['2025-12-08', '2025-12']]);
  });
});

describe('D23 · com retenção no planeado da renda, o montante é a renda menos a retenção', () => {
  test('o 750 + 250 acertado à mão sobrevive ao arranque', () => {
    const { c } = monta(app, { rent: 1000 });
    app.syncAllContractRecs();
    const r = app.ctRecOf(c);
    r.tx.amount = 750; r.tx.retencao = 250;
    app.syncAllContractRecs();
    igual({ amount: app.ctRecOf(c).tx.amount, retencao: app.ctRecOf(c).tx.retencao }, { amount: 750, retencao: 250 });
  });

  test('o planeado que ficou com a renda inteira e a retenção por cima passa a 750 + 250', () => {
    const { c } = monta(app, { rent: 1000 });
    app.syncAllContractRecs();
    app.ctRecOf(c).tx.retencao = 250;
    app.syncAllContractRecs();
    igual({ amount: app.ctRecOf(c).tx.amount, retencao: app.ctRecOf(c).tx.retencao }, { amount: 750, retencao: 250 });
  });

  test('a renda sobe e a retenção acompanha-a', () => {
    const { c } = monta(app, { rent: 1000 });
    app.syncAllContractRecs();
    Object.assign(app.ctRecOf(c).tx, { amount: 750, retencao: 250 });
    c.rent = 1100;
    app.syncContractRec(c);
    igual({ amount: app.ctRecOf(c).tx.amount, retencao: app.ctRecOf(c).tx.retencao }, { amount: 825, retencao: 275 });
  });

  test('sem retenção o montante continua a ser a renda', () => {
    const { c } = monta(app, { rent: 1000 });
    app.syncAllContractRecs();
    c.rent = 1050;
    app.syncContractRec(c);
    igual({ amount: app.ctRecOf(c).tx.amount, retencao: app.ctRecOf(c).tx.retencao || 0 }, { amount: 1050, retencao: 0 });
  });

  test('doze rendas confirmadas: 12 000 € de renda ilíquida e 3 000 € retidos', () => {
    const { c } = monta(app, { rent: 1000, payDay: 5 });
    app.syncAllContractRecs();
    Object.assign(app.ctRecOf(c).tx, { amount: 750, retencao: 250 });
    for (let m = 1; m <= 12; m++) {
      app.syncAllContractRecs();
      app.quickConfirmRec(app.ctRecOf(c).id, '2025-' + String(m).padStart(2, '0') + '-05');
    }
    const r25 = resumo(app, 2025);
    igual({ rendas: r25.rendas, retencoes: r25.retencoes }, { rendas: 12000, retencoes: 3000 });
  });
});

describe('D15 · o planeado da renda de um contrato com rendas depois do termo fica', () => {
  const termo = { start: '2021-01-01', end: '2025-12-31', payDay: 1, rent: 2500 };

  test('com uma renda de janeiro depois do termo de 31/12/2025, o planeado continua, sem fim', () => {
    const { c } = monta(app, termo);
    renda(app, '2026-01-02', { amount: 2500 });
    app.syncAllContractRecs();
    assert.equal(app.ctEstado(c), 'terminado', 'pelo termo, a app dá-o por terminado');
    assert.equal(app.ctRendaDepoisDoTermo(c), true);
    const r = app.ctRecOf(c);
    assert.ok(r, 'o planeado da renda não se apaga');
    igual({ next: r.next, end: r.end }, { next: '2026-02-01', end: '' }, 'pede a de fevereiro, e não pára no termo');
  });

  test('sem rendas depois do termo, ou com a renda de dezembro paga em janeiro, sai como antes', () => {
    const { c } = monta(app, termo);
    app.syncAllContractRecs();
    assert.equal(app.ctRecOf(c), undefined);
    renda(app, '2026-01-03', { amount: 2500, periodo: '2025-12' });
    app.syncAllContractRecs();
    assert.equal(app.ctRendaDepoisDoTermo(c), false, 'a de dezembro é do contrato');
    assert.equal(app.ctRecOf(c), undefined);
  });

  test('terminado de propósito (o «Terminar» ou a cessação) não volta a pedir rendas', () => {
    const { c } = monta(app, termo);
    renda(app, '2026-01-02', { amount: 2500 });
    c.active = false;
    app.syncAllContractRecs();
    assert.equal(app.ctRecOf(c), undefined, 'inativo');
    c.active = true;
    c.fisco.cessacao = { data: '2025-12-31', motivo: '' };
    app.syncAllContractRecs();
    assert.equal(app.ctRecOf(c), undefined, 'com o dia da cessação');
  });
});

describe('D04 · recusar ou largar rendas lembra que se declaram', () => {
  test('o «Começar a partir de hoje» de uma renda', () => {
    const { c } = monta(tudo, { start: '2025-09-01', payDay: 8 });
    tudo.syncAllContractRecs();
    const r = tudo.ctRecOf(c);
    const s = tudo.recComecarHojeResumo(r);
    assert.ok(s.datas.length > 1);
    assert.match(tudo.comecarHojeFrase(r, s), /Se recebeste estas rendas, continuam a declarar-se no IRS/);
  });

  test('o «Recusar desta vez» de uma renda, e nada disto numa despesa', () => {
    const { c } = monta(tudo);
    tudo.syncAllContractRecs();
    const msgs = [];
    tudo.confirmModal = (t, m) => { msgs.push(m); };
    tudo.CW.rejectRec(tudo.ctRecOf(c).id);
    assert.match(msgs[0], /Se recebeste esta renda, continua a declarar-se no IRS/);
    tudo.db.recurring.push(tudo.normRec({ id: 'R1', name: 'Limpeza', every: 'month', next: '2025-12-10',
      tx: { kind: 'expense', label: 'Limpeza', amount: 30, propertyId: 'p1' } }));
    tudo.CW.rejectRec('R1');
    assert.doesNotMatch(msgs[1], /declarar-se no IRS/);
    const rl = tudo.db.recurring.find((x) => x.id === 'R1');
    assert.doesNotMatch(tudo.comecarHojeFrase(rl, tudo.recComecarHojeResumo(rl)), /IRS/);
  });
});

describe('D06 · o planeado do seguro da ficha do imóvel diz que não entra no Anexo F', () => {
  test('o multirriscos não, o IMI sim', () => {
    monta(app);
    const p = app.db.properties[0];
    p.seguro = 300; p.imi = 90;
    app.syncPropRecs(p);
    const seguro = app.propRecsOf(p, 'seguro')[0], imi = app.propRecsOf(p, 'imi')[0];
    assert.ok(seguro && imi);
    const f = app.recFicha(seguro.id);
    assert.match(f, /Não entra no Anexo F do IRS/);
    assert.match(f, /seguro obrigatório de incêndio/);
    assert.doesNotMatch(app.recFicha(imi.id), /Anexo F/);
  });

  test('um seguro que deduz (a renda garantida) não leva a frase', () => {
    monta(app);
    const p = app.db.properties[0];
    p.seguro = 300;
    app.syncPropRecs(p);
    const seguro = app.propRecsOf(p, 'seguro')[0];
    seguro.tx.sub = 'Renda garantida';
    assert.doesNotMatch(app.recFicha(seguro.id), /Anexo F/);
  });
});

describe('D33 · os planeados de um imóvel vendido param na data da venda', () => {
  test('o que é de antes da venda continua por confirmar; o de depois deixa de pedir, sem se apagar nada', () => {
    monta(app);
    app.db.properties[0].vendido = '2025-10-15';
    app.db.recurring.push(app.normRec({ id: 'R1', name: 'Condomínio', every: 'month', next: '2025-10-01',
      tx: { kind: 'expense', label: 'Condomínio', amount: 50, propertyId: 'p1', category: 'Condomínio' } }));
    const r = app.db.recurring[0];
    assert.deepEqual(app.recPending().map((x) => x.id), ['R1'], 'a de outubro é de antes da venda');
    app.quickConfirmRec('R1');
    assert.equal(app.db.transactions.length, 1);
    assert.equal(r.next, '2025-11-01');
    assert.equal(app.recPending().length, 0, 'a de novembro já não pede');
    assert.equal(app.recActive().length, 0);
    assert.equal(app.recIsLate(r), false, 'nem está em atraso');
    igual(app.datasEmFalta(r), [], 'nem o preenchimento a propõe');
    assert.equal(app.db.recurring.length, 1, 'o planeado fica');
    assert.match(app.recFicha('R1'), /Imóvel vendido a 15\/10\/2025/);
    app.quickConfirmRec('R1');
    assert.equal(app.db.transactions.length, 1, 'o Confirmar recusa');
    assert.match(app.__avisos.join(' | '), /O imóvel foi vendido a 15\/10\/2025/);
    // «Desfazer venda»
    app.db.properties[0].vendido = '';
    assert.deepEqual(app.recPending().map((x) => x.id), ['R1'], 'volta a pedir');
    assert.ok(app.datasEmFalta(r).length >= 2);
  });

  test('a renda e o preenchimento de uma casa vendida a meio do ano', () => {
    const { c } = monta(app);
    janANov(app);
    app.syncAllContractRecs();
    app.db.properties[0].vendido = '2025-11-30';
    const r = app.ctRecOf(c);
    assert.equal(r.next, '2025-12-08');
    assert.equal(app.recPending().length, 0, 'a de dezembro é de depois da venda');
    app.db.transactions = app.db.transactions.filter((t) => t.date !== '2025-03-08');
    igual(app.datasEmFalta(r), ['2025-03-08'], 'falta março, de antes da venda; dezembro não');
    app.quickConfirmRec(r.id);
    assert.equal(app.db.transactions.length, 10, 'nada registado depois da venda');
  });

  test('outro imóvel não é tocado', () => {
    monta(app);
    app.db.properties.push(app.normProp({ id: 'p2', name: 'Outro', ownerIds: ['eu'] }));
    app.db.properties[0].vendido = '2025-01-01';
    app.db.recurring.push(app.normRec({ id: 'R2', name: 'Limpeza', every: 'month', next: '2025-12-10',
      tx: { kind: 'expense', label: 'Limpeza', amount: 30, propertyId: 'p2' } }));
    assert.deepEqual(app.recPending().map((x) => x.id), ['R2']);
  });
});
