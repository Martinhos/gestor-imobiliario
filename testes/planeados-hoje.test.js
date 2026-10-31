// «Começar a partir de hoje» nos planeados: um planeado que começou numa data
// passada (o contrato, a hipoteca, um movimento à mão) larga todas as datas em
// falta de uma vez, sem criar movimentos, e passa para a primeira ocorrência de
// hoje em diante — com a janela next..until mantida, presa ao dia nos fins de
// mês, e a terminar quando já não há nenhuma (um «uma só vez» que passou, ou o
// fim antes). O chão fica no planeado: nem o preenchimento nem o cursor da
// renda voltam aos meses largados. A opção vive no ⋯ da linha por confirmar,
// no toque longo e na janela do preenchimento, só a quem pode recusar, e o
// Anular repõe tudo.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { ambiente, conta, casa, registo, cargo, darCargo, sync } from './lib/api.js';
import { fundirPlaneado } from '../worker/src/lib/permissoes.js';

const HOJE = '2026-10-29';
const app = carregarTudo({ hoje: HOJE });
afterEach(() => repor(app));
const base = carregarApp({ hoje: HOJE });
afterEach(() => repor(base));

/* Uma base com um imóvel meu, sem cargos, e as funções que pintam e gravam
   caladas. O Anular fica guardado em vez de ir para o toast.
   Recebe: a — o contexto (o da nuvem ou o da base).
   Devolve: {desfazer} — o último Anular armado (desfazer.fn, desfazer.msg). */
function monta(a) {
  limpar(a);
  a.definirServicosDesligados([]);
  if (a.CW) { a.CW.cargos = {}; a.CW.user = null; a.CW._fillQueue = []; }
  a.modalStack.length = 0;
  a.db.properties = [a.normProp({ id: 'P1', name: 'T2 Arroios' })];
  ['render', 'buildNav', 'save', 'toast'].forEach((n) => { a[n] = () => {}; });
  const desfazer = {};
  a.comDesfazer = (msg, fn) => { desfazer.msg = msg; desfazer.fn = fn; };
  return { desfazer };
}

/* Um contrato meu, sem rendas registadas, com o planeado da renda criado
   pela app (syncContractRec).
   Recebe: a — o contexto; extra (opcional) — campos do contrato.
   Devolve: {c, r} — o contrato e o planeado da renda. */
function contratoAntigo(a, extra = {}) {
  const c = a.normContract(Object.assign({ id: 'C1', propertyId: 'P1', rent: 700, start: '2026-07-29', payDay: 1 }, extra));
  a.db.contracts = [c];
  a.syncContractRec(c);
  return { c, r: a.ctRecOf(c) };
}

/* Um planeado à mão no imóvel P1.
   Recebe: a — o contexto; campos — o que muda no planeado.
   Devolve: o planeado, já em db.recurring. */
function planeado(a, campos) {
  const r = a.normRec(Object.assign({ id: 'R1', name: 'Limpeza', every: 'month', tx: { kind: 'expense', label: 'Limpeza', amount: 30, propertyId: 'P1' } }, campos));
  a.db.recurring.push(r);
  return r;
}

describe('recComecarHoje (pura): a primeira ocorrência de hoje em diante', () => {
  const r = (campos) => base.normRec(Object.assign({ every: 'month', tx: { kind: 'expense', amount: 1 } }, campos));

  test('mensal com três em falta: passa para o mês seguinte, ou para hoje quando o dia é hoje', () => {
    igual(base.recComecarHoje(r({ next: '2026-08-01' }), HOJE), { next: '2026-11-01', until: '' });
    igual(base.recComecarHoje(r({ next: '2026-07-29' }), HOJE), { next: '2026-10-29', until: '' }, 'o dia de hoje fica');
    igual(base.recComecarHoje(r({ next: '2026-12-05' }), HOJE), { next: '2026-12-05', until: '' }, 'um futuro fica onde está');
  });

  test('a janela next..until mantém a largura; a que está aberta hoje fica, porque ainda não está em atraso', () => {
    igual(base.recComecarHoje(r({ next: '2026-07-01', until: '2026-07-08' }), HOJE), { next: '2026-11-01', until: '2026-11-08' });
    igual(base.recComecarHoje(r({ next: '2026-07-25', until: '2026-08-02' }), HOJE), { next: '2026-10-25', until: '2026-11-02' },
      'a de outubro ainda tem a janela aberta a 29');
    igual(base.recComecarHoje(r({ next: '2026-01-30', until: '2026-02-03' }), '2026-03-02'), { next: '2026-02-28', until: '2026-03-04' },
      'a largura conta-se em dias, como no recAdvance');
  });

  test('presa ao dia nos fins de mês: o 31 não fica no 28 para sempre', () => {
    igual(base.recComecarHoje(r({ next: '2026-01-31' }), HOJE), { next: '2026-10-31', until: '' });
    igual(base.recComecarHoje(r({ next: '2026-01-31' }), '2026-11-02'), { next: '2026-11-30', until: '' });
    igual(base.recComecarHoje(r({ next: '2026-01-31' }), '2026-02-10'), { next: '2026-02-28', until: '' });
    igual(base.recComecarHoje(r({ next: '2025-11-30', every: 'quarter' }), HOJE), { next: '2026-11-30', until: '' }, 'trimestral');
  });

  test('semanal e anual', () => {
    igual(base.recComecarHoje(r({ next: '2026-10-01', every: 'week' }), HOJE), { next: '2026-10-29', until: '' });
    igual(base.recComecarHoje(r({ next: '2026-10-01', every: 'week' }), '2026-10-30'), { next: '2026-11-05', until: '' });
    igual(base.recComecarHoje(r({ next: '2026-03-29', every: 'week' }), '2026-04-01'), { next: '2026-04-05', until: '' }, 'a mudança da hora não tira um dia');
    igual(base.recComecarHoje(r({ next: '2024-02-29', every: 'year' }), HOJE), { next: '2027-02-28', until: '' });
    igual(base.recComecarHoje(r({ next: '2025-05-31', every: 'year' }), HOJE), { next: '2027-05-31', until: '' });
  });

  test('um «uma só vez» que passou, ou o fim antes da próxima, terminam', () => {
    igual(base.recComecarHoje(r({ next: '2026-09-10', every: 'once' }), HOJE), { fim: true });
    igual(base.recComecarHoje(r({ next: '2026-10-25', until: '2026-11-02', every: 'once' }), HOJE), { next: '2026-10-25', until: '2026-11-02' },
      'com a janela aberta ainda é dela');
    igual(base.recComecarHoje(r({ next: '2026-06-01', end: '2026-09-15' }), HOJE), { fim: true });
    igual(base.recComecarHoje(r({ next: '2026-06-01', end: '2026-11-01' }), HOJE), { next: '2026-11-01', until: '' }, 'o fim no próprio dia ainda conta');
    igual(base.recComecarHoje(r({ next: '' }), HOJE), { fim: true }, 'sem data não há ocorrência');
  });

  test('não mexe no planeado', () => {
    const x = r({ id: 'X', next: '2026-07-01', until: '2026-07-08', muted: true });
    const antes = JSON.stringify(x);
    base.recComecarHoje(x, HOJE);
    assert.equal(JSON.stringify(x), antes);
  });
});

describe('onde aparece', () => {
  test('sem forma de largar as em falta antes: o contrato com início há três meses fica em atraso, e o ⋯ só preenchia', () => {
    monta(base);
    base.CW = { rejectRec() {}, fillMissed() {} };
    const { r } = contratoAntigo(base);
    assert.equal(r.next, '2026-08-01');
    assert.ok(base.recIsLate(r), 'a renda está em atraso');
    igual(base.pendMenuItens(r, true, true).map((x) => x.label), ['Silenciar avisos', 'Recusar desta vez', 'Preencher 3 em falta'],
      'sem a ação da nuvem, o ⋯ fica como estava');
  });

  test('no ⋯ da linha, a seguir ao «Preencher N em falta», a quem pode recusar', () => {
    monta(app);
    const { r } = contratoAntigo(app);
    igual(app.pendMenuItens(r, true, true).map((x) => x.label),
      ['Silenciar avisos', 'Recusar desta vez', 'Preencher 3 em falta', 'Começar a partir de hoje']);
    const item = app.pendMenuItens(r, true, true)[3];
    assert.equal(item.act, `CW.startFromToday('${r.id}')`);
    assert.equal(item.toca, 'camada');
    igual(app.pendMenuItens(r, false, false).map((x) => x.label), [], 'quem não pode recusar não a tem');
    assert.match(app.pendLinha(r), new RegExp(`CW\\.startFromToday\\('${r.id}'\\)[^>]*>[\\s\\S]*?Começar a partir de hoje`));
  });

  test('com uma só data em falta aparece (o Preencher não), e sem nenhuma, ou só com a janela de hoje aberta, não', () => {
    monta(app);
    const um = planeado(app, { next: '2026-10-10' });
    igual(app.pendMenuItens(um, true, true).map((x) => x.label), ['Silenciar avisos', 'Recusar desta vez', 'Começar a partir de hoje']);
    const futuro = planeado(app, { id: 'R2', next: '2026-11-10' });
    assert.ok(!app.recPodeComecarHoje(futuro));
    const aberta = planeado(app, { id: 'R3', next: '2026-10-25', until: '2026-11-02' });
    assert.ok(!app.recIsLate(aberta));
    assert.ok(!app.recPodeComecarHoje(aberta), 'a de hoje ainda se regista: não há nada a largar');
    assert.doesNotMatch(app.pendLinha(aberta), /startFromToday/);
  });

  test('num imóvel onde colaboro: com «Adicionar e confirmar planeados» sim; só a ver, não; e terminar um alheio só quando o servidor deixa apagar', () => {
    monta(app);
    app.CW.user = { id: 'EU' };
    app.CW.cargos = { P1: { dono: false, nome: 'Gestor', perms: ['rec.add', 'tx.add'] } };
    const alheio = planeado(app, { next: '2026-08-10', _createdBy: 'DONO', _atServidor: true });
    assert.match(app.pendLinha(alheio), /CW\.startFromToday\('R1'\)/);
    const acaba = planeado(app, { id: 'R2', next: '2026-06-10', end: '2026-09-30', _createdBy: 'DONO', _atServidor: true });
    assert.ok(app.recComecarHojeResumo(acaba).fim);
    assert.ok(!app.recTermina(acaba), 'confirmar a de junho não o terminava');
    assert.doesNotMatch(app.pendLinha(acaba), /startFromToday/, 'o servidor recusava o apagar');
    const meuQueAcaba = planeado(app, { id: 'R3', next: '2026-06-10', end: '2026-09-30', _createdBy: 'EU', _atServidor: true });
    assert.match(app.pendLinha(meuQueAcaba), /CW\.startFromToday\('R3'\)/, 'o meu remove-se');
    app.CW.cargos = { P1: { dono: false, nome: 'Contabilista', perms: ['rec.view', 'tx.view'] } };
    assert.doesNotMatch(app.pendLinha(alheio), /startFromToday/);
  });

  test('a renda de um contrato que acaba antes da próxima não termina aqui (o arranque voltava a criá-la)', () => {
    monta(app);
    const { r } = contratoAntigo(app, { end: '2026-11-01', payDay: 5 });
    assert.equal(r.next, '2026-08-05');
    assert.ok(app.recComecarHojeResumo(r).fim);
    assert.ok(!app.recPodeComecarHoje(r));
  });

  test('no toque longo, junto das outras, a quem pode recusar', () => {
    monta(app);
    const { r } = contratoAntigo(app);
    const opcoes = [];
    app.menuOption = (o) => opcoes.push(o);
    app.lpShow = () => {};
    app.lpMenu('rec:' + r.id);
    igual(opcoes.map((o) => o.label), ['Preencher 3 períodos em falta', 'Começar a partir de hoje', 'Recusar desta vez']);
    assert.ok(!opcoes[1].danger, 'não destrói nada: não vai a vermelho');
    const abertas = janelasFalsas(app);
    opcoes[1].act();
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].t, 'Começar a partir de hoje', 'abre a confirmação dele');
    opcoes.length = 0;
    app.CW.user = { id: 'EU' };
    app.CW.cargos = { P1: { dono: false, nome: 'Contabilista', perms: ['rec.view'] } };
    app.lpMenu('rec:' + r.id);
    assert.ok(!opcoes.some((o) => o.label === 'Começar a partir de hoje'));
  });

  test('a janela do preenchimento tem o segundo botão, numa linha por cima do Cancelar e do Registar', () => {
    monta(app);
    const abertas = janelasFalsas(app);
    const { r } = contratoAntigo(app);
    app.CW.fillMissed(r.id);
    assert.equal(abertas.length, 1);
    assert.match(abertas[0].t, /^Preencher 3 períodos$/);
    assert.match(abertas[0].f, new RegExp(`^<button class="btn preencher-hoje" data-toca="camada" data-click="CW\\.startFromToday\\('${r.id}',1\\)">Começar a partir de hoje</button><button class="btn" data-toca="camada" data-click="CW\\.fillNext\\(\\)">Cancelar</button><button class="btn primary"[^>]*CW\\.doFillMissed`),
      'primeiro, numa linha inteira por cima do Cancelar e do Registar');
    app.CW.user = { id: 'EU' };
    app.CW.cargos = { P1: { dono: false, nome: 'Gestor', perms: ['rec.view', 'tx.add'] } };
    app.CW.fillMissed(r.id);
    assert.doesNotMatch(abertas[1].f, /startFromToday/, 'a quem não pode recusar, só o preencher');
  });
});

describe('CW.startFromToday: confirmar, aplicar, Anular', () => {
  test('a renda de um contrato antigo: diz quantas e para quando, salta sem criar movimentos, e o arranque já não a puxa para trás', () => {
    const { desfazer } = monta(app);
    const abertas = janelasFalsas(app);
    const { c, r } = contratoAntigo(app);
    app.CW.startFromToday(r.id);
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].t, 'Começar a partir de hoje');
    assert.match(abertas[0].b, /As 3 datas em falta de <b>Renda Sem inquilino<\/b>, de 01\/08\/2026 a 01\/10\/2026, ficam por registar: nenhum movimento é criado\. O próximo fica a <b>01\/11\/2026<\/b>\./);
    assert.doesNotMatch(abertas[0].b, /lançar|tirar|!/);
    assert.match(abertas[0].f, /data-click="closeModal\(\)">Cancelar<\/button><button class="btn primary"[^>]*data-click="_ok\(\)">Confirmar</);
    assert.equal(r.next, '2026-08-01', 'nada muda antes de confirmar');
    app._ok();
    assert.equal(app.modalStack.length, 0);
    assert.equal(r.next, '2026-11-01');
    assert.equal(r.desde, '2026-11-01');
    assert.equal(app.db.transactions.length, 0, 'nenhum movimento');
    assert.ok(!app.recPending().some((x) => x.id === r.id), 'sai dos por confirmar');
    assert.match(desfazer.msg, /^Começa a 01\/11\/2026: 3 datas ficam por registar\.$/);
    app.syncAllContractRecs();
    assert.equal(app.ctRecOf(c).next, '2026-11-01', 'o cursor da renda não volta aos meses largados');
    igual(app.datasEmFalta(app.ctRecOf(c)), [], 'nem o preenchimento');
    igual(app.pendMenuItens(app.ctRecOf(c), true, true).map((x) => x.label).filter((l) => /Preencher|Começar/.test(l)), []);
    app.syncContractRec(Object.assign(c, { payDay: 5 }));
    assert.equal(app.ctRecOf(c).next, '2026-11-05', 'mudar o dia de pagamento não o leva para trás');
  });

  test('o Anular repõe o next, o until, o silêncio e o chão — no planeado que está na base, mesmo depois de um sync', () => {
    const { desfazer } = monta(app);
    janelasFalsas(app);
    const r = planeado(app, { next: '2026-07-01', until: '2026-07-08', muted: true });
    app.CW.startFromToday('R1');
    assert.match(app.modalStack[0].b, /Os avisos voltam a ficar ligados\./);
    app._ok();
    igual({ next: r.next, until: r.until, muted: r.muted, desde: r.desde }, { next: '2026-11-01', until: '2026-11-08', muted: false, desde: '2026-11-01' });
    app.db.recurring = JSON.parse(JSON.stringify(app.db.recurring));
    desfazer.fn();
    const vivo = app.db.recurring.find((x) => x.id === 'R1');
    igual({ next: vivo.next, until: vivo.until, muted: vivo.muted }, { next: '2026-07-01', until: '2026-07-08', muted: true });
    assert.equal(vivo.desde, '', 'o chão sai (vazio, para o servidor também o largar num alheio)');
    assert.equal(app.recDesde(vivo), '');
  });

  test('o chão nunca passa da próxima data, e com ele a frase da compra só fala da compra', () => {
    monta(app);
    const r = planeado(app, { next: '2026-08-10', desde: '2026-11-10' });
    assert.equal(app.recDesde(r), '2026-08-10', 'quem recua a próxima à mão volta a ter o que pôs');
    igual(app.datasEmFalta(r), ['2026-08-10', '2026-09-10', '2026-10-10']);
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Arroios', purchaseDate: '2020-03-12' })];
    const { r: renda } = contratoAntigo(app, { start: '2019-01-01' });
    assert.equal(app.planoAntesDaCompra(renda), '12/03/2020');
    renda.next = '2026-08-01'; renda.desde = '2026-05-01';
    assert.equal(app.origemDoPlano(renda), '2026-05-01');
    assert.equal(app.planoAntesDaCompra(renda), '', 'as datas começam no chão, não na compra');
  });

  test('um chão de antes volta a ser o de antes', () => {
    const { desfazer } = monta(app);
    janelasFalsas(app);
    const r = planeado(app, { next: '2026-08-10', desde: '2026-05-10' });
    app.CW.startFromToday('R1');
    app._ok();
    assert.equal(r.desde, '2026-11-10');
    desfazer.fn();
    assert.equal(r.desde, '2026-05-10');
  });

  test('um «uma só vez» que passou termina e é removido; o Anular devolve-o inteiro, no mesmo sítio', () => {
    const { desfazer } = monta(app);
    const abertas = janelasFalsas(app);
    planeado(app, { id: 'R0', next: '2026-12-01' });
    const r = planeado(app, { next: '2026-09-10', every: 'once', name: 'Vistoria', notas: 'x' });
    planeado(app, { id: 'R2', next: '2026-12-02' });
    const copia = JSON.parse(JSON.stringify(r));
    app.CW.startFromToday('R1');
    assert.match(abertas[0].b, /A data em falta de <b>Vistoria<\/b>, 10\/09\/2026, fica por registar: nenhum movimento é criado\. Como não há mais nenhuma data a partir de hoje, o planeado termina e é removido\./);
    app._ok();
    igual(app.db.recurring.map((x) => x.id), ['R0', 'R2']);
    assert.match(desfazer.msg, /^Planeado removido: 1 data fica por registar\.$/);
    desfazer.fn();
    igual(app.db.recurring.map((x) => x.id), ['R0', 'R1', 'R2']);
    igual(app.db.recurring[1], copia);
  });

  test('numa hipoteca: larga as prestações de trás e as do plano já vencidas, sem abater capital nenhum', () => {
    const { desfazer } = monta(app);
    const abertas = janelasFalsas(app);
    const l = app.normLoan({ id: 'L1', name: 'Aquisição', outstanding: 100000, years: 30, type: 'fixa', rate: 3, start: '2025-01-10' });
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Arroios', loans: [l] })];
    app.syncAllLoanRecs();
    const r = app.db.recurring.find((x) => x.tx.loanId === 'L1');
    r.next = '2026-08-10';
    const s = app.recComecarHojeResumo(r);
    assert.equal(s.next, '2026-11-10');
    assert.equal(s.datas.length, 22, 'jan/2025 … out/2026');
    assert.equal(s.datas[0], '2025-01-10'); assert.equal(s.datas[21], '2026-10-10');
    app.CW.startFromToday(r.id);
    assert.match(abertas[0].b, /As 22 datas em falta de <b>[^<]+<\/b>, de 10\/01\/2025 a 10\/10\/2026, ficam por registar[\s\S]*O capital em dívida da hipoteca não muda\./);
    app._ok();
    assert.equal(r.next, '2026-11-10');
    assert.equal(app.db.transactions.length, 0);
    assert.equal(app.findLoan(app.prop('P1'), 'L1').outstanding, 100000);
    igual(app.datasEmFalta(r), [], 'o preenchimento já não as propõe');
    app.syncAllLoanRecs();
    assert.equal(r.next, '2026-11-10');
    desfazer.fn();
    assert.equal(r.next, '2026-08-10');
    assert.equal(app.datasEmFalta(r).length, 19, 'as de antes do plano voltam');
  });

  test('sem nada a largar, ou sem poder, avisa e não abre nada', () => {
    monta(app);
    const abertas = janelasFalsas(app);
    let aviso = '';
    app.toast = (m) => { aviso = m; };
    planeado(app, { next: '2026-11-10' });
    app.CW.startFromToday('R1');
    assert.equal(abertas.length, 0);
    assert.equal(aviso, 'Não há datas em falta para largar.');
    planeado(app, { id: 'R2', next: '2026-08-10', _createdBy: 'DONO', _atServidor: true });
    app.CW.user = { id: 'EU' };
    app.CW.cargos = { P1: { dono: false, nome: 'Contabilista', perms: ['rec.view'] } };
    app.CW.startFromToday('R2');
    assert.equal(abertas.length, 0);
    assert.match(aviso, /Adicionar e confirmar planeados|permiss/i);
  });

  test('vindo da janela do preenchimento: fecha-a, e confirmar ou cancelar seguem para o plano seguinte da fila', () => {
    monta(app);
    const abertas = janelasFalsas(app);
    const { r } = contratoAntigo(app);
    planeado(app, { id: 'R2', next: '2026-07-10' });
    app.CW._fillQueue = ['R2'];
    app.CW.fillMissed(r.id);
    app.CW.startFromToday(r.id, 1);
    assert.equal(app.modalStack.length, 1, 'a do preenchimento fechou');
    assert.equal(app.modalStack[0].t, 'Começar a partir de hoje');
    assert.match(app.modalStack[0].f, /data-click="CW\.fillNext\(\)">Cancelar</);
    app._ok();
    assert.equal(r.next, '2026-11-01');
    assert.equal(app.modalStack.length, 1);
    assert.match(app.modalStack[0].t, /^Preencher 4 períodos$/, 'segue para o seguinte');
    app.CW.startFromToday('R2', 1);
    app.CW.fillNext();
    assert.equal(app.modalStack.length, 0, 'cancelar fecha, e a fila acabou');
    assert.equal(app.db.recurring.find((x) => x.id === 'R2').next, '2026-07-10', 'cancelar não mexe');
    assert.equal(abertas.length, 4);
  });
});

describe('«Recusar desta vez» numa renda de contrato já não se desfaz', () => {
  test('recusar avança e fixa o chão: o arranque seguinte não puxa a renda de volta ao mês recusado', () => {
    monta(app);
    janelasFalsas(app);
    const { c, r } = contratoAntigo(app);
    app.CW.rejectRec(r.id);
    assert.match(app.modalStack[0].t, /^Recusar movimento$/);
    app._ok();
    assert.equal(r.next, '2026-09-01');
    assert.equal(r.desde, '2026-09-01');
    app.syncAllContractRecs();
    assert.equal(app.ctRecOf(c).next, '2026-09-01', 'antes voltava a 01/08 no arranque');
    igual(app.datasEmFalta(app.ctRecOf(c)), ['2026-09-01', '2026-10-01'], 'o mês recusado também sai do preencher');
    app.CW.rejectRec(r.id);
    app._ok();
    app.syncAllContractRecs();
    igual({ next: r.next, desde: r.desde }, { next: '2026-10-01', desde: '2026-10-01' }, 'e a seguinte também');
  });

  test('só nas rendas de contrato: num planeado à mão e numa hipoteca não há cursor que recue, e o chão não entra', () => {
    monta(app);
    janelasFalsas(app);
    const mao = planeado(app, { next: '2026-08-10' });
    app.CW.rejectRec('R1');
    app._ok();
    assert.equal(mao.next, '2026-09-10');
    assert.ok(!('desde' in mao));
    const l = app.normLoan({ id: 'L1', name: 'Aquisição', outstanding: 100000, years: 30, type: 'fixa', rate: 3, start: '2025-01-10' });
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Arroios', loans: [l] })];
    app.syncAllLoanRecs();
    const p = app.db.recurring.find((x) => x.tx.loanId === 'L1');
    app.CW.rejectRec(p.id);
    app._ok();
    assert.ok(!('desde' in p), 'as prestações de antes do plano continuam a ser propostas');
    assert.ok(app.datasEmFalta(p).length > 0);
  });

  test('uma renda recusada que termina sai, sem chão nenhum a guardar', () => {
    monta(app);
    const { r } = contratoAntigo(app);
    app.db.recurring = app.db.recurring.filter((x) => x.id !== r.id);
    app.recRecusadaFixa(r);
    assert.ok(!('desde' in r));
  });
});

describe('no servidor, o chão de um planeado alheio', () => {
  test('fundirPlaneado deixa entrar o desde, e um desde vazio larga-o', () => {
    const guardado = JSON.stringify({ id: 'r', name: 'Renda', every: 'month', next: '2026-08-01', until: '', muted: false, tx: { amount: 500 } });
    const f = fundirPlaneado(guardado, { id: 'r', name: 'X', next: '2026-11-01', desde: '2026-11-01', tx: { amount: 1 } });
    igual(f, { id: 'r', name: 'Renda', every: 'month', next: '2026-11-01', until: '', muted: false, tx: { amount: 500 }, desde: '2026-11-01' });
    assert.equal(fundirPlaneado(JSON.stringify(f), { next: '2026-08-01', desde: '' }).desde, '');
    assert.equal(fundirPlaneado(JSON.stringify(f), { muted: true }).desde, '2026-11-01', 'o que não vem fica');
  });

  test('um colaborador com «Adicionar e confirmar planeados» grava o desde no planeado do dono, e o resto fica do dono', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const C = await conta(env, 'Colab');
    await casa(env, D, 'H1', { name: 'T2 Arroios' });
    const dono = { name: 'Renda Ana', every: 'month', next: '2026-08-01', until: '2026-08-08', end: '', muted: true, auto: true,
      tx: { kind: 'income', label: 'Renda Ana', amount: 700, propertyId: 'H1', contractId: 'c1' } };
    await registo(env, 'H1', 'rec', 'r1', dono, D);
    await darCargo(env, D, C, await cargo(env, D, 'Gestor', ['rec.add', 'tx.add'], 'R_GES'), ['H1']);
    const r = await sync(env, C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'rec', id: 'r1',
      data: Object.assign({}, dono, { id: 'r1', next: '2026-11-01', until: '2026-11-08', muted: false, desde: '2026-11-01', name: 'Outro', tx: Object.assign({}, dono.tx, { amount: 5 }) }) }]);
    igual(r[0], { ok: true });
    const linha = await env.DB.prepare("SELECT data, created_by FROM records WHERE house_id = 'H1' AND kind = 'rec' AND id = 'r1'").first();
    const g = JSON.parse(linha.data);
    igual({ next: g.next, until: g.until, muted: g.muted, desde: g.desde }, { next: '2026-11-01', until: '2026-11-08', muted: false, desde: '2026-11-01' });
    igual({ name: g.name, amount: g.tx.amount }, { name: 'Renda Ana', amount: 700 }, 'nome e montante ficam do dono');
    assert.equal(linha.created_by, D.id);
  });
});

describe('os rótulos cabem numa linha', () => {
  test('o menu ⋯ tem a largura do texto, com um teto que não passa do ecrã; o rodapé do preenchimento parte em duas linhas', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const regra = /\n\.menupop\{([^}]*)\}/.exec(css)[1];
    assert.match(regra, /width:max-content/);
    assert.match(regra, /max-width:min\(320px,calc\(100vw - 32px\)\)/, 'a 390px sobram 16px de cada lado; nunca mais de 320px');
    assert.match(regra, /min-width:200px/, 'os menus curtos ficam como estavam');
    assert.match(css, /\.sheet \.foot:has\(>\.preencher-hoje\)\{flex-wrap:wrap\}/);
    assert.match(css, /\.sheet \.foot \.btn\.preencher-hoje\{flex:1 1 100%\}/);
  });
});
