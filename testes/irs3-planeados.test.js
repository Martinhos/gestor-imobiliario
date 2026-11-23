// Os planeados na ronda 2 da auditoria ao IRS: o «Confirmar e emiti o
// recibo» no Confirmar da renda (N062, D8 maqueta 4); o dia em que a renda
// entrou perguntado também no «Rever», no «Confirmar» da ficha e no toque do
// imóvel (N026), e na renda de janeiro, que pode ter entrado em dezembro
// (N146); o mês anterior com duas rendas (N146); a retenção da renda
// anterior levada ao planeado e a do inquilino que retém (N081); o planeado
// abaixo da renda do contrato (N080); a janela do «Registar estimativa» a
// dizer que são rendas da Declaração a conferir (N079); o email dos atrasos
// sem os planeados de depois da venda nem os encargos do inquilino (N147); e
// as rendas em falta de um contrato terminado contadas até à cessação (N031).
// Cada um tem aqui pelo menos um assert que falhava antes.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor, igual, elementos } from './arnes.js';
import { janelasFalsas, menuDe } from './lib/dom.js';
import { ambiente, conta as contaPorConfirmar, casa, registo } from './lib/api.js';

const app = carregarApp({ hoje: '2026-03-10' });
afterEach(() => repor(app));
const jan = carregarApp({ hoje: '2027-01-12' });
afterEach(() => repor(jan));
const dez = carregarApp({ hoje: '2026-12-02' });
afterEach(() => repor(dez));
const tudo = carregarTudo({ hoje: '2026-11-15' });
afterEach(() => repor(tudo));

/* espera que corra o que a app deixou para depois (as perguntas do Confirmar
   abrem depois de quem o chamou acabar) */
const tique = () => new Promise((r) => setTimeout(r, 0));

/* Uma conta com um imóvel meu, um inquilino e o contrato C1 declarado
   (1 000 €/mês, ao dia 8), com as janelas numa pilha observável e o que pinta
   e grava calado. Os avisos (toast) ficam em a.__avisos.
   Recebe: a — o contexto; ct (opcional) — o que muda no contrato;
   inq (opcional) — o que muda no inquilino.
   Devolve: {c, janelas} — o contrato e as janelas abertas. */
function monta(a, ct, inq) {
  limpar(a);
  a.definirServicosDesligados([]);
  if (a.CW) { a.CW.cargos = {}; a.CW.user = null; a.CW._fillQueue = []; }
  a.modalStack.length = 0;
  const janelas = janelasFalsas(a, 'render', 'buildNav', 'save', 'refreshDetail');
  const avisos = [];
  a.toast = (m) => { avisos.push(m); };
  a.avisoComVer = (m) => { avisos.push(m); };
  a.__avisos = avisos;
  a.db.owners.push(a.normPerson({ id: 'eu', name: 'Eu' }));
  a.db.tenants.push(a.normPerson(Object.assign({ id: 't1', name: 'Inquilino', nif: '123456789' }, inq || {})));
  a.db.properties.push(a.normProp({ id: 'p1', name: 'T2 Arroios', ownerIds: ['eu'], use: 'investimento' }));
  const c = a.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'p1', tenantIds: ['t1'], rent: 1000, payDay: 8,
    start: '2025-01-01', active: true, fisco: { estado: 'declarado', numero: '999', finalidade: 'hp' } }, ct || {}));
  a.db.contracts.push(c);
  return { c, janelas };
}

/* Uma renda do contrato C1 já registada.
   Recebe: a — o contexto; date — o dia; extra (opcional) — outros campos.
   Devolve: o movimento. */
function renda(a, date, extra) {
  const t = a.normTx(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1',
    propertyId: 'p1', date, recibo: true }, extra || {}));
  a.db.transactions.push(t);
  return t;
}

/* as rendas do contrato C1 de um mês a outro, cada uma no dia 8 do seu mês */
function rendas(a, de, ate, extra) {
  let [y, m] = de.split('-').map(Number);
  for (;;) {
    const mes = y + '-' + String(m).padStart(2, '0');
    if (mes > ate) break;
    renda(a, mes + '-08', extra);
    m++; if (m > 12) { m = 1; y++; }
  }
}

/* A opção de um pickModal aberto (a última janela), pelo rótulo: escolhe-a.
   Recebe: a — o contexto; janelas — a pilha; rotulo — uma expressão do rótulo.
   Devolve: nada. */
function escolher(a, janelas, rotulo) {
  const b = janelas[janelas.length - 1].b;
  const botoes = [...b.matchAll(/data-click="_pick\((\d+)\)">[\s\S]*?<b class="u-d-block u-fs-14px">([^<]*)<\/b>/g)];
  const achado = botoes.find((x) => rotulo.test(x[2]));
  assert.ok(achado, 'a opção ' + rotulo + ' não está entre: ' + botoes.map((x) => x[2]).join(' | '));
  a._pick(Number(achado[1]));
}

/* o total das rendas e das retenções num ano da Declaração */
function resumo(a, ano) {
  const r = a.resumoFiscal(ano, 'eu');
  return JSON.parse(JSON.stringify({ rendas: r.totais.rendas, retencoes: r.totais.retencoes }));
}

/* --------------------------- N062 · o recibo --------------------------- */

describe('N062 · «Confirmar e emiti o recibo» no Confirmar da renda (D8, maqueta 4)', () => {
  test('a linha por confirmar tem o segundo botão, e ele regista a renda com o recibo marcado', () => {
    const { c } = monta(app);
    rendas(app, '2025-01', '2026-02');
    app.syncAllContractRecs();
    const r = app.ctRecOf(c);
    assert.equal(r.next, '2026-03-08');
    const linha = app.pendLinha(r);
    assert.match(linha, /data-click="recConfirmarComRecibo\('[^']+'\)">Confirmar e emiti o recibo<\/button>/);
    assert.match(linha, /data-click="quickConfirmRec\('[^']+'\)">.*Confirmar<\/button>/, 'o Confirmar continua');
    app.recConfirmarComRecibo(r.id);
    const t = app.db.transactions.at(-1);
    igual({ date: t.date, periodo: t.periodo, amount: t.amount, recibo: t.recibo }, { date: '2026-03-10', periodo: '2026-03', amount: 1000, recibo: true });
    assert.equal(app.prazosDe('2026-03-10').filter((p) => p.tipo === 'recibos').length, 0, 'não nasce o prazo do recibo por emitir');
    assert.match(app.__avisos.join(' | '), /com o recibo eletrónico emitido/);
  });

  test('o «Pede atenção» também tem «Confirmar e emiti o recibo» ao lado do Confirmar', () => {
    const { c } = monta(app);
    rendas(app, '2025-01', '2026-02');
    app.syncAllContractRecs();
    const r = app.ctRecOf(c);
    const corpo = app.atencaoCorpo().corpo;
    assert.ok(corpo.includes(`data-click="recConfirmarComRecibo('${r.id}');notifModal('')">Confirmar e emiti o recibo</button>`));
    assert.ok(corpo.includes(`data-click="quickConfirmRec('${r.id}');notifModal('')">Confirmar</button>`), 'o Confirmar continua');
  });

  test('o Confirmar de sempre continua a registá-la por emitir', () => {
    const { c } = monta(app);
    rendas(app, '2025-01', '2026-02');
    app.syncAllContractRecs();
    app.quickConfirmRec(app.ctRecOf(c).id);
    assert.equal(app.db.transactions.at(-1).recibo, false);
  });

  test('só onde a renda pede o recibo: num contrato não declarado ou com a dispensa do ano, não aparece', () => {
    const { c } = monta(app, { fisco: { estado: 'naoDeclarado' } });
    app.syncAllContractRecs();
    assert.doesNotMatch(app.pendLinha(app.ctRecOf(c)), /Confirmar e emiti o recibo/, 'não declarado');
    const m = monta(app);
    app.db.settings.irs = { porAno: { 2026: { dispensaRecibos: true } } };
    app.syncAllContractRecs();
    assert.equal(app.irsSituacao(2026).dispensaRecibos, true);
    assert.doesNotMatch(app.pendLinha(app.ctRecOf(m.c)), /Confirmar e emiti o recibo/, 'com a dispensa do ano');
    app.db.settings.irs = {};
    assert.equal(app.recPedeRecibo(app.ctRecOf(m.c)), true, 'sem dispensa, pede');
    app.db.recurring.push(app.normRec({ id: 'R1', name: 'Limpeza', every: 'month', next: '2026-03-01',
      tx: { kind: 'expense', label: 'Limpeza', amount: 30, propertyId: 'p1' } }));
    assert.equal(app.recPedeRecibo(app.db.recurring.at(-1)), false, 'numa despesa nunca');
  });

  test('está no ⋯ da ficha do planeado e na folha do toque longo', () => {
    const { c } = monta(app);
    app.syncAllContractRecs();
    const r = app.ctRecOf(c);
    const opts = menuDe(app, 'lpPlaneado', ['rec', r.id]);
    assert.ok(opts.includes('Confirmar e emiti o recibo'), opts.join(' | '));
    let menuHtml = '';
    app.abrirFicha = (o) => { menuHtml = o.menu(); };
    app.recView(r.id);
    assert.match(menuHtml, /Confirmar e emiti o recibo/);
  });

  test('com a pergunta do dia (a de dezembro em janeiro), o recibo segue com a resposta', async () => {
    const { c } = monta(jan);
    rendas(jan, '2025-01', '2026-11');
    jan.syncAllContractRecs();
    const r = jan.ctRecOf(c);
    assert.equal(r.next, '2026-12-08');
    jan.recConfirmarComRecibo(r.id);
    await tique();
    elementos(jan).rec_dia.value = '2026-12-08';
    jan.recConfirmarNoDia(r.id);
    const t = jan.db.transactions.at(-1);
    igual({ date: t.date, periodo: t.periodo, recibo: t.recibo }, { date: '2026-12-08', periodo: '2026-12', recibo: true });
  });
});

/* ------------------- N026 · o dia no Rever e na ficha ------------------- */

describe('N026 · o «Rever», o «Confirmar» da ficha e o toque do imóvel perguntam o dia, como o Confirmar', () => {
  test('a renda de dezembro confirmada pelo formulário em janeiro: pergunta o dia antes de abrir, e abre com ele', async () => {
    const { c, janelas } = monta(jan);
    rendas(jan, '2025-01', '2026-11');
    jan.syncAllContractRecs();
    const r = jan.ctRecOf(c);
    assert.equal(r.next, '2026-12-08');
    jan.confirmRec(r.id);
    await tique();
    assert.equal(janelas.at(-1).t, 'Em que dia entrou?', 'a pergunta do dia, e não o formulário com a data de hoje');
    assert.notEqual(jan.txModo && jan.txModo.modo, 'confirmar');
    elementos(jan).rec_dia.value = '2026-12-08';
    jan.recConfirmarNoDia(r.id);
    assert.equal(jan.txModo.modo, 'confirmar', 'agora sim, o formulário');
    igual({ date: jan.tForm.date, periodo: jan.tForm.periodo }, { date: '2026-12-08', periodo: '2026-12' });
    jan.collectTx = () => {};
    jan.onSave();
    const t = jan.db.transactions.at(-1);
    igual({ date: t.date, periodo: t.periodo }, { date: '2026-12-08', periodo: '2026-12' });
    assert.equal(resumo(jan, 2026).rendas, 12000, '2026 com as 12 rendas que entraram em 2026');
  });

  test('o toque no «Por confirmar» do imóvel (confirmRec) também pergunta', async () => {
    const { c, janelas } = monta(jan);
    rendas(jan, '2025-01', '2026-11');
    jan.syncAllContractRecs();
    const r = jan.ctRecOf(c);
    const html = jan.imvPorConfirmar(jan.prop('p1'), jan.cargoDe('p1'));
    assert.match(html, new RegExp("data-click=\"confirmRec\\('" + r.id + "'\\)\""), 'o toque é o confirmRec');
    jan.confirmRec(r.id);
    await tique();
    assert.equal(janelas.at(-1).t, 'Em que dia entrou?');
  });

  test('no mesmo ano, fora de janeiro, o formulário abre logo com a data de hoje', () => {
    const { c } = monta(app);
    rendas(app, '2025-01', '2026-02');
    app.syncAllContractRecs();
    app.confirmRec(app.ctRecOf(c).id);
    assert.equal(app.txModo.modo, 'confirmar');
    igual({ date: app.tForm.date, periodo: app.tForm.periodo }, { date: '2026-03-10', periodo: '2026-03' });
  });
});

/* ------------- N146 · a renda paga antes do dia, e duas no mês ------------- */

describe('N146 · a renda paga antes do dia previsto', () => {
  test('a renda de janeiro confirmada em janeiro pergunta o dia: a que entrou a 30/12 fica no IRS do ano anterior', async () => {
    const { c, janelas } = monta(jan);
    rendas(jan, '2025-01', '2026-12');
    jan.syncAllContractRecs();
    const r = jan.ctRecOf(c);
    assert.equal(r.next, '2027-01-08');
    assert.equal(jan.recPedeODia(r), true);
    const n = jan.db.transactions.length;
    jan.quickConfirmRec(r.id);
    await tique();
    assert.equal(jan.db.transactions.length, n, 'sem o dia não regista');
    assert.equal(janelas.at(-1).t, 'Em que dia entrou?');
    assert.match(janelas.at(-1).b, /se entrou ainda em dezembro, é do IRS de 2026/);
    elementos(jan).rec_dia.value = '2026-12-30';
    jan.recConfirmarNoDia(r.id);
    const t = jan.db.transactions.at(-1);
    igual({ date: t.date, periodo: t.periodo }, { date: '2026-12-30', periodo: '2027-01' });
    assert.equal(jan.ctRecOf(c).next, '2027-02-08', 'janeiro está pago');
  });

  test('o mês anterior com duas rendas: «a de 28/11 é a de dezembro» não regista outra e muda o mês dela', async () => {
    const { c, janelas } = monta(dez, { payDay: 1 });
    rendas(dez, '2025-01', '2026-10');
    renda(dez, '2026-11-01');
    const cedo = renda(dez, '2026-11-28');   // a de dezembro, paga antes e registada com o mês da data
    dez.syncAllContractRecs();
    const r = dez.ctRecOf(c);
    assert.equal(r.next, '2026-12-01');
    const n = dez.db.transactions.length;
    dez.quickConfirmRec(r.id);
    await tique();
    assert.equal(dez.db.transactions.length, n, 'pergunta antes de registar');
    assert.equal(janelas.at(-1).t, 'Novembro de 2026 tem 2 rendas deste contrato');
    escolher(dez, janelas, /é a de dezembro de 2026/);
    assert.equal(dez.db.transactions.length, n, 'não regista uma renda que não entrou');
    assert.equal(cedo.periodo, '2026-12');
    assert.ok(dez.rendaJaLancada(c, '2026-12-01'));
    assert.equal(dez.ctRecOf(c).next, '2027-01-01');
    assert.equal(resumo(dez, 2026).rendas, 12000, '12 rendas em 2026, sem nenhuma a mais');
  });

  test('o mês anterior com duas rendas: «Registar a renda de dezembro» regista-a', async () => {
    const { c, janelas } = monta(dez, { payDay: 1 });
    rendas(dez, '2025-01', '2026-10');
    renda(dez, '2026-11-01');
    renda(dez, '2026-11-20', { amount: 1000 });
    dez.syncAllContractRecs();
    const r = dez.ctRecOf(c);
    const n = dez.db.transactions.length;
    dez.quickConfirmRec(r.id);
    await tique();
    escolher(dez, janelas, /^Registar a renda de dezembro de 2026$/);
    assert.equal(dez.db.transactions.length, n + 1);
    igual({ periodo: dez.db.transactions.at(-1).periodo }, { periodo: '2026-12' });
  });

  test('um pagamento parcial e o resto no mesmo mês não são duas rendas', () => {
    const { c } = monta(dez, { payDay: 1 });
    rendas(dez, '2025-01', '2026-10');
    renda(dez, '2026-11-01', { amount: 600, parcial: true });
    renda(dez, '2026-11-15', { amount: 400 });
    dez.syncAllContractRecs();
    assert.equal(dez.recDuasRendasAntes(dez.ctRecOf(c)), null);
  });
});

/* --------------------- N081 · a retenção na fonte --------------------- */

describe('N081 · a retenção na fonte chega ao planeado', () => {
  test('com janeiro e fevereiro retidos, o Confirmar de março pergunta e regista com a retenção', async () => {
    const { c, janelas } = monta(app);
    renda(app, '2026-01-08', { amount: 750, retencao: 250 });
    renda(app, '2026-02-08', { amount: 750, retencao: 250 });
    app.syncAllContractRecs();
    const r = app.ctRecOf(c);
    igual({ next: r.next, amount: r.tx.amount, retencao: r.tx.retencao }, { next: '2026-03-08', amount: 1000, retencao: 0 });
    const n = app.db.transactions.length;
    app.quickConfirmRec(r.id);
    await tique();
    assert.equal(app.db.transactions.length, n, 'não grava a renda sem retenção às cegas');
    assert.equal(janelas.at(-1).t, 'A renda de fevereiro de 2026 teve retenção na fonte');
    escolher(app, janelas, /^Também teve/);
    const t = app.db.transactions.at(-1);
    igual({ amount: t.amount, retencao: t.retencao, periodo: t.periodo }, { amount: 750, retencao: 250, periodo: '2026-03' });
    igual(resumo(app, 2026), { rendas: 3000, retencoes: 750 });
    const r2 = app.ctRecOf(c);
    igual({ amount: r2.tx.amount, retencao: r2.tx.retencao }, { amount: 750, retencao: 250 }, 'e o planeado passa a tê-la');
    app.syncAllContractRecs();
    igual({ amount: app.ctRecOf(c).tx.amount, retencao: app.ctRecOf(c).tx.retencao }, { amount: 750, retencao: 250 }, 'o arranque mantém-na');
  });

  test('«Não teve» regista a renda inteira, e a pergunta não volta no mês seguinte', async () => {
    const { c, janelas } = monta(app);
    renda(app, '2026-01-08', { amount: 750, retencao: 250 });
    app.syncAllContractRecs();
    const r = app.ctRecOf(c);
    r.next = '2026-02-08';
    app.quickConfirmRec(r.id);
    await tique();
    escolher(app, janelas, /^Não teve/);
    igual({ amount: app.db.transactions.at(-1).amount, retencao: app.db.transactions.at(-1).retencao }, { amount: 1000, retencao: 0 });
    assert.equal(app.recRetencaoProposta(app.ctRecOf(c)), null, 'a última renda já não tem retenção');
  });

  test('o «Rever» abre o formulário já com a retenção da renda anterior', () => {
    const { c } = monta(app);
    renda(app, '2026-02-08', { amount: 750, retencao: 250 });
    app.syncAllContractRecs();
    app.confirmRec(app.ctRecOf(c).id);
    igual({ amount: app.tForm.amount, retencao: app.tForm.retencao }, { amount: 750, retencao: 250 });
  });

  test('ao marcar «Retém IRS na fonte», propõe a retenção do ano no planeado da renda, com Anular', () => {
    const { c, janelas } = monta(app, {}, { nif: '501234567', retem: true });
    app.syncAllContractRecs();
    assert.equal(app.recPropoeRetencaoDoInquilino('t1'), true);
    assert.equal(janelas.at(-1).t, 'O inquilino retém IRS: e a renda planeada?');
    assert.match(janelas.at(-1).b, /Reter 25 %/);
    let anular = null;
    app.comDesfazer = (m, f) => { anular = f; };
    escolher(app, janelas, /^Reter 25 %$/);
    igual({ amount: app.ctRecOf(c).tx.amount, retencao: app.ctRecOf(c).tx.retencao }, { amount: 750, retencao: 250 });
    anular();
    igual({ amount: app.ctRecOf(c).tx.amount, retencao: app.ctRecOf(c).tx.retencao }, { amount: 1000, retencao: 0 });
    app.ctRecOf(c).tx.retencao = 250; app.ctRecOf(c).tx.amount = 750;
    assert.equal(app.recPropoeRetencaoDoInquilino('t1'), false, 'com a retenção já no planeado, não pergunta');
  });
});

/* -------------- N080 · o planeado abaixo da renda do contrato -------------- */

describe('N080 · o planeado abaixo da renda do contrato pergunta', () => {
  /* um planeado meu da renda do C1 com o que a gestora transfere (950 €), sem o automático */
  function gestora(a) {
    const m = monta(a, { autoRec: false });
    rendas(a, '2025-01', '2026-02');
    a.db.recurring.push(a.normRec({ id: 'RG', name: 'Renda C1', every: 'month', next: '2026-03-08',
      tx: { kind: 'income', label: 'Renda C1', amount: 950, contractId: 'C1', propertyId: 'p1', category: 'Rendas', sub: 'Renda mensal' } }));
    return m;
  }

  test('o Confirmar não regista 950 € calado: pergunta, e «a renda é a do contrato» regista 1 000 €', async () => {
    const { janelas } = gestora(app);
    const n = app.db.transactions.length;
    app.quickConfirmRec('RG');
    await tique();
    assert.equal(app.db.transactions.length, n, 'não grava a renda líquida às cegas');
    assert.equal(janelas.at(-1).t, 'O planeado está abaixo da renda do contrato');
    escolher(app, janelas, /^A renda é a do contrato/);
    igual({ amount: app.db.transactions.at(-1).amount, periodo: app.db.transactions.at(-1).periodo }, { amount: 1000, periodo: '2026-03' });
    assert.equal(app.db.recurring.find((x) => x.id === 'RG').tx.amount, 1000, 'e o planeado passa a pedir a renda do contrato');
  });

  test('«Entraram 950 €» abre a renda no formulário, para dizer porquê', async () => {
    const { janelas } = gestora(app);
    app.quickConfirmRec('RG');
    await tique();
    escolher(app, janelas, /^Entraram 950,00/);
    igual({ modo: app.txModo.modo, recId: app.txModo.recId, amount: app.tForm.amount }, { modo: 'confirmar', recId: 'RG', amount: 950 });
  });

  test('depois de 950 € como pagamento parcial, o Confirmar regista o resto da renda do contrato (50 €), e não outra renda', () => {
    gestora(app);
    renda(app, '2026-03-09', { amount: 950, parcial: true, periodo: '2026-03' });
    const n = app.db.transactions.length;
    app.quickConfirmRec('RG');
    assert.equal(app.db.transactions.length, n + 1, 'regista logo, sem pergunta');
    igual({ amount: app.db.transactions.at(-1).amount, periodo: app.db.transactions.at(-1).periodo }, { amount: 50, periodo: '2026-03' });
  });

  test('a renda do contrato num mês: desde o início sem atualização; com ela, desde o último aniversário', () => {
    const c = app.normContract({ id: 'X', rent: 1000, start: '2024-07-01' });
    assert.equal(app.recRendaDoContrato(c, '2024-06'), 0, 'antes do início');
    assert.equal(app.recRendaDoContrato(c, '2024-07'), 1000);
    const ca = app.normContract({ id: 'Y', rent: 1022, start: '2024-07-01', increase: 2.2 });
    assert.equal(app.recRendaDoContrato(ca, '2025-06'), 0, 'antes da última atualização (julho de 2025) não se sabe');
    assert.equal(app.recRendaDoContrato(ca, '2025-07'), 1022);
    assert.equal(app.recRendaDoContrato(ca, '2026-03'), 1022);
  });
});

/* ---------------- N079 · o «Registar estimativa» das rendas ---------------- */

describe('N079 · as rendas por estimativa dizem que são da Declaração e que se conferem', () => {
  test('a janela das rendas de um contrato diz que entram na Declaração e que a etiqueta se tira depois de conferir', () => {
    monta(tudo, { start: '2026-07-01', increase: 2 });
    tudo.syncAllContractRecs();
    const r = tudo.ctRecOf(tudo.contract('C1'));
    let corpo = '';
    tudo.openModal = (t, b) => { corpo = t + '|' + b; };
    tudo.CW.fillMissed(r.id);
    assert.match(corpo, /entra na Declaração do IRS como rendas recebidas/);
    assert.match(corpo, /Confere-as com os recibos: o valor \(antes da última atualização a renda era outra\), o dia em que entrou e os meses que não foram pagos/);
    assert.match(corpo, /tira-a de cada uma depois de a conferires/);
    tudo.contract('C1').increase = null;
    tudo.CW.fillMissed(r.id);
    assert.match(corpo, /Confere-as com os recibos: o valor, o dia em que entrou/, 'sem atualização anual, sem a frase dela');
    const datas = tudo.datasEmFalta(r);
    assert.ok(datas.length >= 2);
    tudo.fillCriar(r, datas);
    assert.ok(tudo.db.transactions.every((t) => (t.tags || []).includes('Estimativa')), 'com a etiqueta que a Declaração lê');
  });

  test('num planeado que não é renda fica o texto de sempre', () => {
    monta(tudo);
    tudo.db.recurring.push(tudo.normRec({ id: 'R1', name: 'Limpeza', every: 'month', next: '2026-08-10',
      tx: { kind: 'expense', label: 'Limpeza', amount: 30, propertyId: 'p1' } }));
    let corpo = '';
    tudo.openModal = (t, b) => { corpo = b; };
    tudo.CW.fillMissed('R1');
    assert.match(corpo, /<b>Isto é uma estimativa\.<\/b>/);
    assert.doesNotMatch(corpo, /Declaração/);
  });
});

/* ---------- N031 · as rendas em falta de um terminado: até à cessação ---------- */

describe('N031 · «Registar as rendas em falta» de um contrato terminado conta até à cessação', () => {
  test('acabou a 30/06/2026 com o termo em 2029: não pede as rendas de julho em diante', () => {
    monta(tudo, { start: '2026-01-01', end: '2029-12-31', payDay: 1, active: false,
      fisco: { estado: 'declarado', numero: '999', finalidade: 'hp', cessacao: { data: '2026-06-30', motivo: '02' } } });
    const c = tudo.contract('C1');
    assert.equal(tudo.ctEstado(c), 'terminado');
    const em = tudo.ctRendasEmFalta(c);
    igual(em, ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01']);
    assert.equal(tudo.ctPlanoTerminado(c).end, '2026-06-30');
  });
});

/* ------------- N147 · o email dos atrasos (worker, SQL a sério) ------------- */

describe('N147 · o email dos atrasos salta o que a app já não pede', () => {
  const HOJE = '2026-11-06';
  /* Uma conta com o email já confirmado (os avisos só vão para esses).
     Recebe: env; nome. Devolve: a promessa da conta. */
  async function contaConfirmada(env, nome) {
    const c = await contaPorConfirmar(env, nome);
    await env.DB.prepare('UPDATE users SET email_verified_at = created_at WHERE id = ?').bind(c.id).run();
    return c;
  }
  /* Os atrasos de uma conta, como «casa/planeado/data». */
  const doMapa = (mapa, quem) => [...((mapa.get(quem.id) || new Map()).values())].map((a) => a.casaId + '/' + a.recId + '/' + a.data).sort();
  /* um planeado do condomínio da ficha (propRec) ou feito à mão */
  const condominio = (extra) => Object.assign({ name: 'Condomínio', every: 'month', next: '2026-11-05', until: '', muted: false,
    tx: { kind: 'expense', amount: 50, label: 'Condomínio', category: 'Condomínio', sub: 'Quota mensal', propertyId: 'h1' } }, extra || {});
  const ct = (extra) => Object.assign({ propertyId: 'h1', rent: 800, start: '2025-01-01', end: '2030-12-31', active: true,
    encargosInquilino: ['condominio'] }, extra || {});

  test('o condomínio que um contrato em vigor põe a cargo do inquilino não vai no email; o de outra casa vai', async () => {
    const { atrasosPorPessoa } = await import('../worker/src/lib/avisos-atraso.js');
    const env = ambiente();
    const D = await contaConfirmada(env, 'Dona');
    await casa(env, D, 'h1');
    await casa(env, D, 'h2');
    await registo(env, 'h1', 'rec', 'cond', condominio(), D);
    await registo(env, 'h1', 'rec', 'condFicha', condominio({ tx: { kind: 'expense', amount: 50, label: 'Condomínio', propRec: 'condominio', propertyId: 'h1' } }), D);
    await registo(env, 'h1', 'rec', 'limpeza', condominio({ tx: { kind: 'expense', amount: 30, label: 'Limpeza', category: 'Limpeza', propertyId: 'h1' } }), D);
    await registo(env, 'h1', 'contract', 'C1', ct(), D);
    await registo(env, 'h2', 'rec', 'cond2', condominio({ tx: { kind: 'expense', amount: 50, label: 'Condomínio', category: 'Condomínio', propertyId: 'h2' } }), D);
    const m = await atrasosPorPessoa(env, HOJE);
    assert.deepEqual(doMapa(m, D), ['h1/limpeza/2026-11-05', 'h2/cond2/2026-11-05']);
  });

  test('com o contrato terminado antes desse mês (cessação), o condomínio volta a ser do senhorio e vai', async () => {
    const { atrasosPorPessoa } = await import('../worker/src/lib/avisos-atraso.js');
    const env = ambiente();
    const D = await contaConfirmada(env, 'Dona');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'cond', condominio(), D);
    await registo(env, 'h1', 'contract', 'C1', ct({ active: false, fisco: { cessacao: { data: '2026-09-30', motivo: '02' } } }), D);
    const m = await atrasosPorPessoa(env, HOJE);
    assert.deepEqual(doMapa(m, D), ['h1/cond/2026-11-05']);
  });

  test('o contrato que continua depois do termo (com rendas depois dele) ainda suspende; sem elas, não', async () => {
    const { atrasosPorPessoa } = await import('../worker/src/lib/avisos-atraso.js');
    for (const comRenda of [true, false]) {
      const env = ambiente();
      const D = await contaConfirmada(env, 'Dona');
      await casa(env, D, 'h1');
      await registo(env, 'h1', 'rec', 'cond', condominio(), D);
      await registo(env, 'h1', 'contract', 'C1', ct({ end: '2026-06-30' }), D);
      if (comRenda) await registo(env, 'h1', 'tx', 'T1', { kind: 'income', amount: 800, contractId: 'C1', date: '2026-10-08', category: 'Rendas' }, D);
      const m = await atrasosPorPessoa(env, HOJE);
      assert.deepEqual(doMapa(m, D), comRenda ? [] : ['h1/cond/2026-11-05'], comRenda ? 'continua: é do inquilino' : 'acabou no termo');
    }
  });

  test('a renda planeada de depois da venda da casa não vai no email; a de antes vai', async () => {
    const { atrasosPorPessoa } = await import('../worker/src/lib/avisos-atraso.js');
    const env = ambiente();
    const D = await contaConfirmada(env, 'Dona');
    await casa(env, D, 'h1', { vendido: '2026-09-30' });
    const renda = (next) => ({ name: 'Renda', every: 'month', next, until: '', muted: false, tx: { kind: 'income', amount: 800, label: 'Renda', contractId: 'C1', propertyId: 'h1' } });
    await registo(env, 'h1', 'rec', 'depois', renda('2026-10-01'), D);
    await registo(env, 'h1', 'rec', 'antes', renda('2026-09-01'), D);
    const m = await atrasosPorPessoa(env, HOJE);
    assert.deepEqual(doMapa(m, D), ['h1/antes/2026-09-01']);
  });
});
