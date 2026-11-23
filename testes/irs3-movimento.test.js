// O formulário e a ficha dos movimentos naquilo que a Declaração do IRS lê
// deles (as correções da segunda auditoria ao IRS, ronda 2):
// - a renda com «Retido na fonte» só quando conta, atrás de «O inquilino
//   reteve IRS?» (N016), e a pergunta da renda abaixo com a retenção (N081);
// - a despesa com a coluna do Anexo F numa linha com «Mudar» e o seletor só
//   quando a categoria não decide (N064), a subcategoria que decide (N133), as
//   obras dos 24 meses (N112) e o que a Declaração faz à despesa (N113);
// - o contrato de uma receita: os que acabaram (N025), os quartos (N083), o
//   imóvel de uma receita (N027), o dia em que a renda entrou (N026), a renda
//   abaixo sem planeado (N080), a renda paga antes do dia (N146);
// - os textos das receitas (N143, N144), quem paga uma cedência (N076), a
//   parte de cada dono (N041), a frase da quota (N115);
// - os Movimentos filtrados a partir de um aviso (N134) e as categorias pelo
//   id do movimento (N006).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

/* Uma conta: eu dono do T2 (de arrendamento), um inquilino particular e o
   contrato C1 declarado (1 000 € ao dia 8 desde 2025), com as janelas numa
   pilha observável e o que pinta e grava calado.
   Recebe: a — o proxy; o (opcional) — {inquilino, casa, contrato} por cima
   dos de base (contrato: false para nenhum).
   Devolve: {janelas, avisos}. */
function casa(a, o) {
  o = o || {};
  limpar(a);
  a.definirServicosDesligados([]);
  if (a.CW) { a.CW.cargos = {}; a.CW.user = null; }
  a.modalStack.length = 0;
  const janelas = janelasFalsas(a, 'render', 'buildNav', 'save', 'avisoComVer', 'refreshDetail');
  const avisos = [];
  a.toast = (m) => { avisos.push(m); };
  a.comDesfazer = (m) => { avisos.push(m); };
  a.db.owners.push(a.normPerson({ id: 'eu', name: 'Eu' }));
  a.db.tenants.push(a.normPerson(Object.assign({ id: 't1', name: 'Inquilino', nif: '123456789' }, o.inquilino || {})));
  a.db.properties.push(a.normProp(Object.assign({ id: 'p1', name: 'T2 Arroios', ownerIds: ['eu'], use: 'investimento' }, o.casa || {})));
  if (o.contrato !== false) {
    a.db.contracts.push(a.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'p1', tenantIds: ['t1'], rent: 1000, payDay: 8,
      start: '2025-01-01', active: true, fisco: { estado: 'declarado', numero: '999', finalidade: 'hp' } }, o.contrato || {})));
  }
  a.txFilter = ''; a.txCat = ''; a.txSub = ''; a.txProp = ''; a.txPaid = ''; a.txCt = '';
  a.txModo = { modo: 'tx' };
  return { janelas, avisos };
}
/* Um movimento já na base.
   Recebe: a — o proxy; t — os campos.
   Devolve: o movimento normalizado. */
function lancar(a, t) {
  const x = a.normTx(Object.assign({ propertyId: 'p1', label: 'Movimento' }, t));
  a.db.transactions.push(x);
  return x;
}
const renda = (a, data, valor, extra) => lancar(a, Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1', date: data, recibo: true, label: 'Renda' }, extra || {}));
/* Corre uma ação do formulário sem ler o ecrã (o arnês dá um elemento a cada
   id, e o collectTx leria campos vazios): o tForm é o que lá estaria.
   Recebe: a — o proxy; fn — o que correr.
   Devolve: o que fn devolver. */
function semLer(a, fn) {
  const real = a.collectTx;
  a.collectTx = () => {};
  try { return fn(); } finally { a.collectTx = real; }
}
/* O Guardar real do formulário aberto.
   Recebe: a — o proxy.
   Devolve: quantos movimentos novos entraram. */
function guardar(a) {
  const antes = a.db.transactions.length;
  semLer(a, () => a.txGuardar(null));
  return a.db.transactions.length - antes;
}
/* Os campos que o ecrã tem, para um on…Change ou um collectTx lerem.
   Recebe: a — o proxy; valores — {id: valor}; fn — o que correr com eles.
   Devolve: o que fn devolver. */
function noEcra(a, valores, fn) {
  const doc = a.document, original = doc.getElementById;
  doc.getElementById = (id) => (id in valores
    ? { value: valores[id] === true ? 'on' : String(valores[id]), checked: valores[id] === true, hidden: false, innerHTML: '', textContent: '',
        classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, removeAttribute() {}, focus() {}, scrollIntoView() {} }
    : null);
  try { return fn(); } finally { doc.getElementById = original; }
}
const texto = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const opcoes = (a, id) => a.window.__sel[id].options.filter((o) => !o.div).map((o) => o.label);
const ultimo = (a) => a.db.transactions[a.db.transactions.length - 1];
const topo = (j) => j[j.length - 1];
/* Os rótulos das escolhas de uma janela do pickModal. */
const escolhas = (j) => [...String(j.b).matchAll(/<b class="u-d-block u-fs-14px">([^<]*)<\/b>/g)].map((m) => m[1]);

describe('N016 · «Retido na fonte» só quando conta (maqueta 2)', () => {
  test('numa renda de um inquilino particular não está o campo, e está a ligação «O inquilino reteve IRS?»', () => {
    casa(app);
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
    const h = app.txBody();
    assert.doesNotMatch(h, /id="t_retencao"/);
    assert.match(h, /data-click="txAbrirRetencao\(\)">O inquilino reteve IRS\?<\/button>/);
    assert.doesNotMatch(texto(h), /comissão da gestora/, 'a frase da gestora saiu da dica');
    semLer(app, () => app.txAbrirRetencao());
    assert.match(app.txBody(), /id="t_retencao"/, 'a ligação abre o campo');
    assert.doesNotMatch(app.txBody(), /txAbrirRetencao/);
  });

  test('aparece logo com inquilino de NIF coletivo, com «Retém IRS na fonte», num não habitacional, com retenção no planeado ou no movimento', () => {
    const tem = (o, prep) => {
      casa(app, o);
      if (prep) prep();
      app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
      return /id="t_retencao"/.test(app.txBody());
    };
    assert.equal(tem({ inquilino: { nif: '503004642' } }), true, 'NIF de pessoa coletiva');
    assert.equal(tem({ inquilino: { nif: '503004642', retemVisto: true } }), false, '«confirmei: não retém»');
    assert.equal(tem({ inquilino: { retem: true } }), true, 'a ficha diz que retém');
    assert.equal(tem({ contrato: { fisco: { estado: 'declarado', numero: '999', finalidade: 'nh' } } }), true, 'contrato não habitacional');
    assert.equal(tem(null, () => { app.syncAllContractRecs(); const r = app.ctRecOf(app.db.contracts[0]); r.tx.amount = 750; r.tx.retencao = 250; }), true, 'o planeado já tem retenção');
    casa(app);
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1', preset: { retencao: 80 } });
    assert.match(app.txBody(), /id="t_retencao"[^>]*value="80"/, 'um valor já escrito nunca fica escondido');
  });
});

describe('N081 · a pergunta da renda abaixo tem a retenção na fonte', () => {
  test('com o inquilino que retém, a retenção vem à cabeça e grava o que falta no retido', () => {
    const { janelas } = casa(app, { inquilino: { retem: true } });
    for (let m = 1; m <= 10; m++) renda(app, '2026-' + String(m).padStart(2, '0') + '-08', 1000);
    app.db.recurring = [];
    app.syncAllContractRecs();
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
    app.tForm.amount = 750;
    assert.equal(guardar(app), 0, 'pergunta antes de gravar');
    assert.equal(topo(janelas).t, 'Entrou menos do que a renda: porquê?');
    assert.equal(escolhas(topo(janelas))[0], 'O inquilino reteve IRS na fonte');
    app._pick(0);
    const t = ultimo(app);
    assert.deepEqual([t.amount, t.retencao, t.parcial], [750, 250, false]);
    const r = app.resumoFiscal(2026, 'eu');
    assert.equal(r.totais.rendas, 11000, 'a renda conta inteira');
    assert.equal(r.totais.retencoes, 250);
  });

  /* em novembro de 2026 a retenção certa numa renda moderada de habitação é a de 10 % (a versão do ano: retencao.moderadaDesde) */
  test('com um particular e uma comissão (8 %), a retenção fica no fim; com a taxa certa da renda, à cabeça', () => {
    const { janelas } = casa(app);
    for (let m = 1; m <= 10; m++) renda(app, '2026-' + String(m).padStart(2, '0') + '-08', 1000);
    app.db.recurring = [];
    app.syncAllContractRecs();
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
    app.tForm.amount = 920;
    guardar(app);
    const e = escolhas(topo(janelas));
    assert.equal(e[0], 'Pagamento parcial');
    assert.equal(e[e.length - 1], 'O inquilino reteve IRS na fonte');
    app.modalStack.length = 0;
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
    app.tForm.amount = 900;
    guardar(app);
    assert.equal(escolhas(topo(janelas))[0], 'O inquilino reteve IRS na fonte');
  });

  test('abaixo do mínimo de uma retenção não se oferece', () => {
    const { janelas } = casa(app, { contrato: { rent: 80 } });
    const R = app.irsAno(2026).retencao, antes = { minimo: R.minimo, minimoDesde: R.minimoDesde };
    R.minimo = 25; R.minimoDesde = '';
    try {
      app.syncAllContractRecs();
      app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
      app.tForm.amount = 60;
      guardar(app);
      assert.ok(!escolhas(topo(janelas)).includes('O inquilino reteve IRS na fonte'), '20 € de retenção ficam abaixo dos 25 €');
    } finally { Object.assign(R, antes); }
  });
});

describe('N064 · a coluna do Anexo F numa linha com «Mudar» (maqueta 3)', () => {
  test('onde a categoria decide, a linha de leitura; onde não decide, o seletor; «Mudar» abre-o', () => {
    casa(app);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', sub: 'Quota mensal', date: '2026-03-01' });
    let h = app.txBody();
    assert.doesNotMatch(h, /id="t_irscol"/);
    assert.match(texto(h), /Conta no Anexo F como Condomínio \(pela categoria\) Mudar/);
    semLer(app, () => app.txMudarColuna());
    assert.match(app.txBody(), /id="t_irscol"/);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Seguros', date: '2026-03-01' });
    assert.match(app.txBody(), /id="t_irscol"/, 'Seguros sem subcategoria: a confirmar');
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', irsCol: 'outros', date: '2026-03-01' });
    assert.match(app.txBody(), /id="t_irscol" value="outros"/, 'a coluna escolhida à mão nunca fica escondida');
  });

  test('sem imóvel, e num imóvel de uso próprio sem contrato nesse ano, não há coluna nenhuma', () => {
    casa(app, { contrato: false });
    app.tForm = app.normTx({ kind: 'expense', propertyId: null, category: 'Outros', date: '2026-03-01' });
    assert.doesNotMatch(app.txBody(), /Anexo F|id="t_irscol"/);
    app.db.properties[0].use = 'proprio';
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', date: '2026-03-01' });
    assert.doesNotMatch(app.txBody(), /Anexo F|id="t_irscol"/);
    // de uso próprio hoje, mas arrendado nesse ano: o destino de hoje não decide
    app.db.contracts.push(app.normContract({ id: 'C0', propertyId: 'p1', tenantIds: ['t1'], rent: 700, start: '2025-01-01', end: '2026-06-30', active: false }));
    assert.match(texto(app.txBody()), /Conta no Anexo F como Condomínio/);
  });

  test('as obras dos 24 meses só se oferecem num dia sem contrato em vigor; fora dos totais diz que não conta', () => {
    casa(app);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Outros', date: '2026-03-01' });
    app.txBody();
    assert.ok(!opcoes(app, 't_irscol').includes('Obras antes do arrendamento (24 meses)'), 'com o C1 em vigor');
    app.tForm.date = '2024-06-01';
    app.txBody();
    assert.ok(opcoes(app, 't_irscol').includes('Obras antes do arrendamento (24 meses)'), 'antes do início do C1');
    app.db.settings.exclude = { 'cats:Limpeza e jardim': true };
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Limpeza e jardim', date: '2026-03-01' });
    const h = app.txBody();
    assert.match(texto(h), /Fora dos totais: não conta no Anexo F\./);
    assert.doesNotMatch(h, /Não dedutível/);
  });
});

describe('N133 · a subcategoria que decide a coluna chama-se «— escolhe —»', () => {
  test('em Impostos a opção vazia é «— escolhe —» e a dica diz que a subcategoria decide; em Condomínio é «— indiferente —»', () => {
    casa(app);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Impostos', date: '2026-05-01' });
    const h = app.txBody();
    assert.equal(opcoes(app, 't_sub')[0], '— escolhe —');
    assert.match(texto(h), /A subcategoria decide a coluna do Anexo F/);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', date: '2026-05-01' });
    app.txBody();
    assert.equal(opcoes(app, 't_sub')[0], '— indiferente —');
  });
});

describe('N112 · a dica de uma obra dos 24 meses', () => {
  test('a conservação à mão na casa vazia antes de um contrato fala das obras, e não diz «conta na Declaração»', () => {
    casa(app, { contrato: { id: 'C0', name: 'C0', start: '2025-01-01', end: '2026-06-30', active: false, fisco: { estado: 'declarado', numero: '1', finalidade: 'hp', cessacao: { data: '2026-06-30', motivo: '02' } } } });
    app.db.contracts.push(app.normContract({ id: 'C1', name: 'C1', propertyId: 'p1', tenantIds: ['t1'], rent: 1000, start: '2026-10-01', active: true }));
    renda(app, '2026-03-08', 1000, { contractId: 'C0' });
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Manutenção e reparações', irsCol: 'conservacao', date: '2026-08-15', amount: 400 });
    const d = texto(app.txDicaDaColunaHtml(app.tForm));
    assert.match(d, /obras antes do arrendamento do contrato C1/);
    assert.match(d, /esteve só à espera de inquilino/);
    assert.doesNotMatch(d, /com a coluna escolhida, conta na Declaração/);
  });
});

describe('N113 · a ficha da despesa diz o que a Declaração lhe faz', () => {
  test('uma quota paga antes do início do contrato diz que fica fora da Declaração', () => {
    casa(app, { contrato: { start: '2026-03-01' } });
    renda(app, '2026-03-08', 1000);
    const x = lancar(app, { kind: 'expense', label: 'Condomínio', amount: 60, category: 'Condomínio', date: '2026-02-08' });
    const f = texto(app.txFicha(x.id));
    assert.match(f, /Anexo F Fora da Declaração/);
    assert.doesNotMatch(f, /Anexo F Condomínio/);
    const y = lancar(app, { kind: 'expense', label: 'Condomínio', amount: 60, category: 'Condomínio', date: '2026-04-08' });
    assert.match(texto(app.txFicha(y.id)), /Anexo F Condomínio pela categoria/, 'com contrato em vigor, a coluna');
  });
});

describe('N025 · a receita de um contrato que já acabou', () => {
  test('o seletor lista o contrato terminado, a opção vazia é «Sem contrato», e a renda ligada vai à linha', () => {
    const a = carregarApp({ hoje: '2026-09-10' });
    try {
      casa(a, { contrato: { active: false, end: '2027-12-31', fisco: { estado: 'declarado', numero: '999', finalidade: 'hp', cessacao: { data: '2026-06-30', motivo: '02' } } } });
      for (let m = 1; m <= 5; m++) renda(a, '2026-0' + m + '-08', 1000);
      a.txModal({ kind: 'income', propId: 'p1' });
      a.txBody();
      const ops = opcoes(a, 't_ct');
      assert.equal(ops[0], 'Sem contrato');
      assert.ok(ops.includes('C1 · terminou a 30/06/2026'), ops.join(' | '));
      // a chamada da ficha do contrato terminado («Registar recebimento»)
      a.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
      assert.equal(a.tForm.contractId, 'C1');
      assert.equal(a.tForm.sub, 'Renda em atraso', 'depois do fim, é uma renda em atraso');
      a.tForm.periodo = '2026-06'; a.tForm.label = 'Renda de junho';
      assert.equal(guardar(a), 1);
      const r = a.resumoFiscal(2026, 'eu');
      assert.equal(r.totais.rendas, 6000);
      assert.equal((r.semContrato || []).length, 0);
    } finally { repor(a); }
  });

  test('um contrato que acabou há mais de dois anos não se oferece, a não ser que já esteja ligado', () => {
    casa(app, { contrato: { start: '2020-01-01', end: '2022-12-31', active: false } });
    app.db.contracts.push(app.normContract({ id: 'C2', name: 'C2', propertyId: 'p1', tenantIds: ['t1'], rent: 900, start: '2023-01-01', active: true }));
    app.tForm = app.normTx({ kind: 'income', propertyId: 'p1', date: '2026-11-17' });
    app.txBody();
    assert.ok(!opcoes(app, 't_ct').some((l) => /^C1/.test(l)));
    app.tForm = app.normTx({ kind: 'income', propertyId: 'p1', contractId: 'C1', date: '2026-11-17' });
    app.tForm._edit = true;
    app.txBody();
    assert.ok(opcoes(app, 't_ct').includes('C1 · terminou a 31/12/2022'), 'o já ligado aparece sempre');
  });
});

describe('N083 · num imóvel com dois contratos em vigor, o contrato escolhe-se', () => {
  test('«— escolhe o contrato —», o Guardar pede-o, «Não é de nenhum contrato» é uma escolha, e o contrato traz a categoria', () => {
    const { avisos } = casa(app);
    app.db.contracts.push(app.normContract({ id: 'C2', name: 'C2', propertyId: 'p1', tenantIds: ['t1'], rent: 400, start: '2025-01-01', active: true }));
    app.txModal({ kind: 'income', propId: 'p1' });
    app.txBody();
    const ops = opcoes(app, 't_ct');
    assert.equal(ops[0], '— escolhe o contrato —');
    assert.equal(ops[ops.length - 1], 'Não é de nenhum contrato');
    app.tForm.amount = 400; app.tForm.label = 'Renda quarto';
    assert.equal(guardar(app), 0);
    assert.ok(avisos.some((m) => /Escolhe o contrato desta receita/.test(m)), avisos.join(' | '));
    noEcra(app, { t_ct: 'C2', t_label: 'Renda quarto', t_amount: '400' }, () => app.onCtChange());
    assert.equal(app.tForm.contractId, 'C2');
    assert.deepEqual([app.tForm.category, app.tForm.sub], ['Rendas', 'Renda mensal']);
    noEcra(app, { t_ct: '__nenhum__', t_label: 'Publicidade', t_amount: '400' }, () => app.onCtChange());
    assert.equal(app.tForm.contractId, null);
    app.tForm.category = ''; app.tForm.sub = '';
    assert.equal(guardar(app), 1, 'sem contrato, de propósito');
  });
});

describe('N027 · uma receita nova numa conta com contratos em vigor pede o imóvel', () => {
  test('com duas casas o imóvel escolhe-se, e «Sem imóvel» é uma escolha', () => {
    const { avisos } = casa(app);
    app.db.properties.push(app.normProp({ id: 'p2', name: 'T1 Benfica', ownerIds: ['eu'], use: 'investimento' }));
    app.db.contracts.push(app.normContract({ id: 'C2', name: 'C2', propertyId: 'p2', tenantIds: ['t1'], rent: 700, start: '2025-01-01', active: true }));
    app.txModal({ kind: 'income' });
    assert.equal(app.tForm.propertyId, null);
    app.txBody();
    const ops = opcoes(app, 't_prop');
    assert.equal(ops[0], '— escolhe o imóvel —');
    assert.ok(ops.includes('Sem imóvel'));
    app.tForm.amount = 700; app.tForm.label = 'Renda João novembro';
    assert.equal(guardar(app), 0, 'não grava calado sem imóvel');
    assert.ok(avisos.some((m) => /Escolhe o imóvel desta receita/.test(m)), avisos.join(' | '));
    noEcra(app, { t_prop: '__sem__', t_label: 'Juros', t_amount: '700' }, () => app.collectTx());
    assert.equal(app.tForm._semImovel, true);
    assert.equal(guardar(app), 1);
    assert.equal(ultimo(app).propertyId, null);
  });

  test('sem contratos em vigor fica como sempre: «Sem imóvel» à cabeça', () => {
    casa(app, { contrato: false });
    app.db.properties.push(app.normProp({ id: 'p2', name: 'T1 Benfica', ownerIds: ['eu'], use: 'investimento' }));
    app.txModal({ kind: 'income' });
    app.txBody();
    assert.equal(opcoes(app, 't_prop')[0], 'Sem imóvel');
  });
});

describe('N026 · a renda de outro ano com a data de hoje pergunta o dia em que entrou', () => {
  function dezembro(a) {
    const r = casa(a);
    for (let m = 1; m <= 11; m++) renda(a, '2026-' + String(m).padStart(2, '0') + '-08', 1000);
    a.db.recurring = [];
    a.syncAllContractRecs();
    return r;
  }

  test('confirmar em janeiro a renda de dezembro: não grava com a data de hoje, pergunta o dia', () => {
    const a = carregarApp({ hoje: '2027-01-12' });
    try {
      const { janelas } = dezembro(a);
      const r = a.ctRecOf(a.contract('C1'));
      assert.equal(r.next, '2026-12-08');
      a.txModal({ kind: 'income', propId: 'p1', ctId: 'C1', modo: 'confirmar', recId: r.id,
        preset: Object.assign({}, JSON.parse(JSON.stringify(r.tx)), { date: '2027-01-12', periodo: '2026-12', label: 'Renda C1' }) });
      assert.equal(guardar(a), 0);
      assert.equal(topo(janelas).t, 'Em que dia entrou?');
      assert.match(topo(janelas).b, /<input id="tx_dia" type="date" value=""/);
      noEcra(a, { tx_dia: '2026-12-08' }, () => semLer(a, () => a.txConfirmarDia()));
      const t = ultimo(a);
      assert.deepEqual([t.date, t.periodo], ['2026-12-08', '2026-12']);
      assert.equal(a.resumoFiscal(2026, 'eu').totais.rendas, 12000);
    } finally { repor(a); }
  });

  test('pelo «+» com o mês sugerido também; com o dia já perguntado, ou outra data, não', () => {
    const a = carregarApp({ hoje: '2027-01-12' });
    try {
      const { janelas } = dezembro(a);
      a.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
      assert.equal(a.tForm.periodo, '2026-12');
      assert.equal(guardar(a), 0);
      assert.equal(topo(janelas).t, 'Em que dia entrou?');
      a.modalStack.length = 0;
      a.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
      a.tForm.date = '2026-12-30';
      assert.equal(guardar(a), 1, 'uma data escrita não se pergunta');
      a.db.transactions.pop();
      const r = a.ctRecOf(a.contract('C1'));
      a.txModal({ kind: 'income', propId: 'p1', ctId: 'C1', modo: 'confirmar', recId: r.id, diaPerguntado: '2027-01-12',
        preset: Object.assign({}, JSON.parse(JSON.stringify(r.tx)), { date: '2027-01-12', periodo: '2026-12', label: 'Renda C1' }) });
      assert.equal(guardar(a), 1, 'o dia já foi perguntado por quem abriu');
    } finally { repor(a); }
  });
});

describe('N080 · sem planeado nesse mês, a renda abaixo da do contrato pergunta', () => {
  test('com a renda automática desligada, e sem os Planeados, a renda deste mês pergunta; uma de há três meses não', () => {
    const { janelas } = casa(app, { contrato: { autoRec: false } });
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
    app.tForm.amount = 950;
    assert.equal(guardar(app), 0);
    assert.equal(topo(janelas).t, 'Entrou menos do que a renda: porquê?');
    app.modalStack.length = 0;
    app.definirServicosDesligados(['recurring']);
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
    app.tForm.amount = 950;
    assert.equal(guardar(app), 0, 'sem os Planeados ligados também');
    app.modalStack.length = 0;
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1', preset: { periodo: '2026-08' } });
    app.tForm.amount = 950;
    assert.equal(guardar(app), 1, 'num mês antigo a renda de hoje pode já ter a atualização');
  });

  test('o planeado escrito com o que a gestora transfere (950 €) não cala a pergunta', () => {
    const { janelas } = casa(app);
    for (let m = 1; m <= 10; m++) renda(app, '2026-' + String(m).padStart(2, '0') + '-08', 1000);
    app.db.recurring = [];
    app.syncAllContractRecs();
    const r = app.ctRecOf(app.db.contracts[0]);
    r.tx.amount = 950;
    app.txModal({ kind: 'income', propId: 'p1', ctId: 'C1', modo: 'confirmar', recId: r.id,
      preset: Object.assign({}, JSON.parse(JSON.stringify(r.tx)), { date: '2026-11-17', periodo: '2026-11', label: 'Renda C1' }) });
    assert.equal(guardar(app), 0);
    assert.equal(topo(janelas).t, 'Entrou menos do que a renda: porquê?');
    assert.match(topo(janelas).b, /faltam 50,00/);
  });
});

describe('N146 · a renda paga antes do dia previsto', () => {
  test('com o mês da data já pago e o planeado a vencer dias depois, o mês sugerido é o do planeado', () => {
    const a = carregarApp({ hoje: '2026-11-28' });
    try {
      casa(a, { contrato: { payDay: 1 } });
      for (let m = 1; m <= 11; m++) renda(a, '2026-' + String(m).padStart(2, '0') + '-01', 1000);
      a.db.recurring = [];
      a.syncAllContractRecs();
      assert.equal(a.ctRecOf(a.contract('C1')).next, '2026-12-01');
      a.txModal({ kind: 'income', propId: 'p1', ctId: 'C1' });
      assert.equal(a.tForm.periodo, '2026-12');
      assert.match(texto(a.txFiscoSect()), /O mês da data já tem a renda deste contrato: esta fica como a de dez 2026/);
      assert.equal(guardar(a), 1);
      assert.equal(a.rendaJaLancada(a.contract('C1'), '2026-12-01'), true, 'dezembro fica pago');
    } finally { repor(a); }
  });
});

describe('N143 · o formulário diz o que são a Indemnização e as Outras receitas prediais', () => {
  test('pela subcategoria (pelo id), com a natureza da versão do ano', () => {
    casa(app);
    app.tForm = app.normTx({ kind: 'income', propertyId: 'p1', contractId: 'C1', category: 'Rendas', sub: 'Indemnização', date: '2026-05-01' });
    let h = texto(app.txBody());
    assert.match(h, /Só o que compensa rendas que não recebeste/);
    assert.match(h, /natureza 05/);
    assert.match(h, /indemnização por danos no imóvel ou no recheio não é renda/);
    app.tForm = app.normTx({ kind: 'income', propertyId: 'p1', category: 'Rendas', sub: 'Outras receitas prediais', date: '2026-05-01' });
    h = texto(app.txBody());
    assert.match(h, /publicidade/);
    assert.match(h, /natureza 02/);
  });
});

describe('N144 · a ficha de uma receita diz o papel dela na Declaração', () => {
  test('a caução é renda do ano em que se recebe; a receita por classificar não conta', () => {
    casa(app);
    const c = lancar(app, { kind: 'income', label: 'Caução', amount: 2000, category: 'Rendas', sub: 'Caução', contractId: 'C1', date: '2026-01-05' });
    const f = texto(app.txFicha(c.id));
    assert.match(f, /Anexo F Caução conta como renda do ano em que a recebes/);
    assert.match(f, /No IRS conta como renda do ano em que a recebes/);
    assert.doesNotMatch(f, /uma caução ou um empréstimo recebido/);
    const o = lancar(app, { kind: 'income', label: 'Outra', amount: 50, category: 'Outras receitas', contractId: 'C1', date: '2026-01-05' });
    assert.match(texto(app.txFicha(o.id)), /Anexo F Por classificar a Declaração não a conta/);
  });
});

describe('N076 · quem paga uma cedência de uso (natureza 02)', () => {
  test('os campos «NIF de quem paga» e «N.º da cedência» numa Outras receitas prediais, e um NIF errado não passa', () => {
    const { avisos } = casa(app);
    app.tForm = app.normTx({ kind: 'income', propertyId: 'p1', category: 'Rendas', sub: 'Outras receitas prediais', amount: 200, label: 'Antena', date: '2026-05-01' });
    app.tForm._edit = false;
    let h = app.txBody();
    assert.match(h, /id="t_pagadorNif"[^>]*placeholder="Opcional"/);
    assert.match(h, /id="t_cedenciaNumero"[^>]*placeholder="Opcional"/);
    noEcra(app, { t_label: 'Antena', t_amount: '200', t_date: '2026-05-01', t_pagadorNif: '503 004 642', t_cedenciaNumero: ' CED-7 ' }, () => app.collectTx());
    assert.deepEqual([app.tForm.pagadorNif, app.tForm.cedenciaNumero], ['503004642', 'CED-7']);
    app.tForm.pagadorNif = '503004640';
    assert.equal(guardar(app), 0);
    assert.ok(avisos.some((m) => /Este NIF não bate certo/.test(m)));
    app.tForm.pagadorNif = '503004642';
    assert.equal(guardar(app), 1);
    assert.match(texto(app.txFicha(ultimo(app).id)), /NIF de quem paga 503004642/);
    app.tForm = app.normTx({ kind: 'income', propertyId: 'p1', contractId: 'C1', category: 'Rendas', sub: 'Renda mensal', date: '2026-05-01' });
    assert.doesNotMatch(app.txBody(), /t_pagadorNif/, 'numa renda não');
  });
});

describe('N077 · a cedência de uso (natureza 02) pede recibo; a indemnização não', () => {
  test('«Recibo eletrónico emitido» numa Outras receitas prediais, com ou sem contrato, e não numa Indemnização nem fora de Portugal', () => {
    casa(app);
    const tem = (t) => { app.tForm = app.normTx(Object.assign({ kind: 'income', propertyId: 'p1', category: 'Rendas', date: '2026-05-01' }, t)); return /id="t_recibo"/.test(app.txBody()); };
    assert.equal(tem({ sub: 'Outras receitas prediais', contractId: 'C1' }), true);
    assert.equal(tem({ sub: 'Outras receitas prediais' }), true, 'sem contrato de arrendamento também');
    assert.equal(tem({ sub: 'Indemnização', contractId: 'C1' }), false);
    assert.equal(tem({ sub: 'Renda mensal', contractId: 'C1' }), true, 'a renda continua a pedi-lo');
    app.db.properties[0].pais = 'Espanha';
    assert.equal(tem({ sub: 'Outras receitas prediais' }), false, 'um imóvel fora de Portugal não');
    app.db.properties[0].pais = '';
    const x = lancar(app, { kind: 'income', label: 'Antena', amount: 200, category: 'Rendas', sub: 'Outras receitas prediais', date: '2026-05-01' });
    assert.match(texto(app.txFicha(x.id)), /Recibo eletrónico Por emitir/);
  });
});

describe('N041 · numa casa com mais de um dono a despesa diz se é o total ou a minha parte', () => {
  function meias(a) {
    const r = casa(a, { casa: { comproprietariosFora: [{ id: 'f1', nome: 'Irmão', quota: 50 }] } });
    renda(a, '2026-02-08', 1000);
    return r;
  }

  test('o condomínio pergunta «É o total da casa» / «É só a minha parte», e «só a minha parte» conta inteira', () => {
    meias(app);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', amount: 300, label: 'Condomínio', date: '2026-03-01', paidBy: 'eu' });
    const h = texto(app.txBody());
    assert.match(h, /É o total da casa a Declaração conta a quota de cada dono \(a tua é 50 %\)/);
    assert.match(h, /É só a minha parte/);
    semLer(app, () => app.txParte(1));
    assert.equal(app.tForm.notaPropria, true);
    assert.equal(guardar(app), 1);
    assert.equal(app.resumoFiscal(2026, 'eu').totais.gastos.condominio, 300, 'a parte dela, sem a cortar outra vez');
  });

  test('numa nota de IMI nova não há omissão: o Guardar pede a resposta', () => {
    const { avisos } = meias(app);
    app.txModal({ kind: 'expense', propId: 'p1', preset: { category: 'Impostos', sub: 'IMI', amount: 150, label: 'IMI', date: '2026-05-01' } });
    assert.match(app.txBody(), /id="t_notaPropria" value=""/);
    assert.equal(guardar(app), 0);
    assert.ok(avisos.some((m) => /IMI do prédio todo ou a tua nota de IMI/.test(m)), avisos.join(' | '));
    semLer(app, () => app.txParte(0));
    assert.equal(guardar(app), 1);
    assert.equal(ultimo(app).notaPropria, false);
  });
});

describe('N115 · a frase da quota não cita o art. 19.º como fundamento dos gastos', () => {
  test('TX_IRS_QUOTA diz que a app conta a quota de cada dono', () => {
    assert.doesNotMatch(app.TX_IRS_QUOTA, /art\. 19/);
    assert.match(app.TX_IRS_QUOTA, /a app conta a quota de cada dono/);
  });
});

describe('N134 · os Movimentos filtrados a partir de um aviso', () => {
  test('goMovimentos põe o ano, o imóvel, a categoria pelo id, o tipo e o contrato, e o contrato sai ao deixar os Movimentos', () => {
    casa(app);
    app.db.contracts.push(app.normContract({ id: 'C2', name: 'C2', propertyId: 'p1', tenantIds: ['t1'], rent: 400, start: '2025-01-01', active: true }));
    app.txSearch = 'abc';
    app.goMovimentos('2026', 'p1', 'impostos/imposto-do-selo', 'expense', '');
    assert.deepEqual([app.tab, app.txDe, app.txAte, app.txProp, app.txCat, app.txSub, app.txFilter, app.txSearch, app.txCt],
      ['transactions', '2026-01-01', '2026-12-31', 'p1', 'Impostos', 'Imposto do selo', 'expense', '', '']);
    app.goMovimentos('2026', '', 'rendas', 'income', 'C2');
    assert.deepEqual([app.txCat, app.txSub, app.txCt, app.txProp], ['Rendas', '', 'C2', 'p1']);
    const a = renda(app, '2026-03-08', 1000), b = renda(app, '2026-03-08', 400, { contractId: 'C2' });
    assert.equal(app.txMatch(a), false);
    assert.equal(app.txMatch(b), true);
    assert.match(app.filterSummary(), /contrato C2/);
    app.newTxFromFilters('income');
    assert.equal(app.tForm.contractId, 'C2', 'uma receita nova liga-se ao contrato do filtro');
    app.goMovimentos('', '', 'Categoria que não existe', '', 'XX');
    assert.deepEqual([app.txCat, app.txCt, app.txDe], ['', '', '']);
    app.goMovimentos('', '', '', '', 'C2');
    app.go('dashboard');
    assert.equal(app.txCt, '', 'sair dos Movimentos tira o filtro do contrato');
  });

  test('txNovaDespesaCom abre a despesa já com o imóvel, a categoria pelo id, o valor e a data', () => {
    casa(app);
    app.txNovaDespesaCom('p1', 'impostos/imposto-do-selo', '38,50', '2026-02-27', 'Imposto do selo do contrato');
    assert.deepEqual([app.tForm.kind, app.tForm.propertyId, app.tForm.category, app.tForm.sub, app.tForm.amount, app.tForm.date, app.tForm.label],
      ['expense', 'p1', 'Impostos', 'Imposto do selo', 38.5, '2026-02-27', 'Imposto do selo do contrato']);
  });
});

describe('N006 · o formulário lê a categoria pelo id do movimento', () => {
  test('uma renda em atraso gravada por outra conta, com outros nomes, é renda em atraso e tem a secção do IRS', () => {
    casa(app);
    app.tForm = app.normTx({ kind: 'income', propertyId: 'p1', category: 'Arrendamento', sub: 'Em atraso', date: '2026-05-01',
      catIrs: { id: 'rendas/renda-em-atraso', cat: 'Arrendamento', sub: 'Em atraso' } });
    assert.equal(app.txRendaEmAtraso(app.tForm), true);
    assert.match(app.txBody(), /Mês a que respeita <span class="req">\*<\/span><input id="t_periodo"/);
  });
});
