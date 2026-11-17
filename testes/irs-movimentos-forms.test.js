// O formulário e a ficha do movimento e as fichas dos inquilinos, naquilo que
// a Declaração do IRS lê deles (a auditoria ao IRS, KAN-127):
// - o «+» de uma receita liga o contrato e a Renda mensal à renda que sugere,
//   e a sugestão desfaz-se quando a pessoa muda a descrição ou o montante (D05);
// - o mês a que a renda respeita vem do planeado por confirmar mais antigo, e
//   numa «Renda em atraso» é obrigatório e vem em branco (D54);
// - a retenção: o montante é o que entrou (D23);
// - a coluna do Anexo F: «a confirmar — escolhe a coluna» (D61, D07), o AIMI
//   sem coluna (D66), e a coluna escolhida numa altura sem contrato (D65);
// - a nota própria do IMI numa casa com mais de um dono (D32), e a quota que o
//   IRS segue numa divisão própria (D95);
// - o inquilino empresa: «Confirmei: não retém» (D58), e o número estrangeiro
//   com o país (D59);
// - o seletor do imóvel sem os vendidos (D33).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

/* Sem interface: as confirmações correm já, nada pinta, e os avisos ficam
   numa lista para se lerem.
   Recebe: a — o proxy do arnês.
   Devolve: a lista dos avisos (toasts) que a app mostrar. */
function semEcra(a) {
  const avisos = [];
  a.confirmModal = (t, m, fn) => fn();
  a.comDesfazer = (m) => { avisos.push(m); };
  for (const n of ['render', 'buildNav', 'closeAllModals', 'closeModal', 'save', 'avisoComVer', 'refreshDetail', 'openModal', 'repaintTx']) a[n] = () => {};
  a.toast = (m) => { avisos.push(m); };
  return avisos;
}

/* Uma conta: eu dono de um imóvel, com um inquilino e um contrato declarado.
   Recebe: a — o proxy; ct (opcional) — campos do contrato por cima dos de base.
   Devolve: {c, avisos} — o contrato e a lista dos avisos. */
function casa(a, ct) {
  limpar(a);
  const avisos = semEcra(a);
  a.db.owners.push(a.normPerson({ id: 'eu', name: 'Eu' }));
  a.db.tenants.push(a.normPerson({ id: 't1', name: 'Inquilino', nif: '123456789' }));
  a.db.properties.push(a.normProp({ id: 'p1', name: 'T2 Arroios', ownerIds: ['eu'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '100', use: 'investimento' }));
  const c = a.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'p1', tenantIds: ['t1'], rent: 800, payDay: 8, start: '2025-01-01', active: true,
    fisco: { estado: 'declarado', numero: '999', finalidade: 'hp' } }, ct || {}));
  a.db.contracts.push(c);
  a.txFilter = ''; a.txCat = ''; a.txSub = ''; a.txProp = ''; a.txPaid = '';
  a.txModo = { modo: 'tx' };
  return { c, avisos };
}

/* Um movimento já na base.
   Recebe: a — o proxy; t — os campos do movimento.
   Devolve: o movimento normalizado. */
function lancar(a, t) {
  const x = a.normTx(Object.assign({ propertyId: 'p1' }, t));
  a.db.transactions.push(x);
  return x;
}
const renda = (a, data, valor, extra) => lancar(a, Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1', date: data, recibo: true }, extra || {}));

/* Os campos que o ecrã tem, para o collectTx e os on…Change lerem: os ids dados
   respondem com o valor (true marca uma caixa), os outros não existem — como no
   browser, onde um campo que não está no formulário não se lê.
   Recebe: a — o proxy; valores — {id: valor}.
   Devolve: a função que repõe o getElementById. */
function camposNoEcra(a, valores) {
  const doc = a.document, original = doc.getElementById;
  doc.getElementById = (id) => (id in valores
    ? { value: valores[id] === true ? 'on' : String(valores[id]), checked: valores[id] === true, hidden: false, innerHTML: '', textContent: '',
        classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, focus() {}, scrollIntoView() {} }
    : null);
  return () => { doc.getElementById = original; };
}

/* O Guardar real do formulário, sem ler o ecrã (o tForm é o que lá estaria).
   Recebe: a — o proxy.
   Devolve: o último movimento da base. */
function guardar(a) {
  const real = a.collectTx;
  a.collectTx = () => {};
  try { a.txGuardar(null); } finally { a.collectTx = real; }
  return a.db.transactions[a.db.transactions.length - 1];
}
const texto = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('D05 · a renda do «+» liga o contrato e a Renda mensal', () => {
  test('o cenário d05-renda-pelo-mais: a renda de 30/12 entra nas rendas do ano', () => {
    const a = carregarApp({ hoje: '2027-04-10' });
    try {
      casa(a, { start: '2026-01-01' });
      for (let m = 1; m <= 12; m++) renda(a, '2026-' + String(m).padStart(2, '0') + '-08', 800);
      a.newTxFromFilters('income');
      assert.equal(a.tForm.contractId, 'C1', 'o contrato vem ligado');
      assert.equal(a.tForm.category, 'Rendas');
      assert.equal(a.tForm.sub, 'Renda mensal');
      assert.equal(a.tForm.amount, 800);
      assert.equal(a.tForm.label, 'Renda C1');
      a.tForm.date = '2026-12-30';
      const novo = guardar(a);
      assert.equal(novo.contractId, 'C1');
      assert.equal(a.ehRenda(novo), true);
      assert.equal(a.resumoFiscal(2026, 'eu').totais.rendas, 10400);
    } finally { repor(a); }
  });

  test('a categoria acha-se pelo id: com «Rendas» renomeada, vem o nome novo', () => {
    casa(app);
    const s = app.db.settings, ids = s.catIds.catsIn;
    s.catsIn.Arrendamento = s.catsIn.Rendas; delete s.catsIn.Rendas;
    for (const k of Object.keys(ids)) if (k === 'Rendas' || k.startsWith('Rendas / ')) { ids['Arrendamento' + k.slice(6)] = ids[k]; delete ids[k]; }
    app.newTxFromFilters('income');
    assert.equal(app.tForm.category, 'Arrendamento');
    assert.equal(app.tForm.sub, 'Renda mensal');
    assert.equal(app.irsReceitaDe(app.normTx(app.tForm)).papel, 'renda');
  });

  test('o keepTyped desfaz a sugestão quando a pessoa mudou o montante, e refá-la quando não mudou', () => {
    casa(app);
    const real = app.collectTx;
    app.collectTx = () => {};
    try {
      app.newTxFromFilters('income');
      app.keepTyped(); app.prefill();
      assert.equal(app.tForm.contractId, 'C1', 'nada mudado: a sugestão volta');
      assert.equal(app.tForm.sub, 'Renda mensal');
      app.tForm.amount = 1600;            // a caução, escrita à mão
      app.keepTyped(); app.prefill();
      assert.equal(app.tForm.contractId, null, 'o montante é outro: o contrato sugerido sai');
      assert.equal(app.tForm.category, '');
      assert.equal(app.tForm.sub, '');
      assert.equal(app.tForm.amount, 1600, 'o que se escreveu fica');
    } finally { app.collectTx = real; }
  });

  test('«Todos os contratos» escolhido à mão não volta a ganhar o contrato', () => {
    casa(app);
    app.newTxFromFilters('income');
    const real = app.collectTx;
    app.collectTx = () => {};
    const desfaz = camposNoEcra(app, { t_ct: '' });
    try { app.onCtChange(); } finally { desfaz(); app.collectTx = real; }
    assert.equal(app.tForm.contractId, null);
  });

  test('uma receita de outra categoria (Reembolsos › Condomínio, pelo filtro) não ganha o contrato', () => {
    casa(app);
    app.txCat = 'Reembolsos'; app.txSub = 'Condomínio';
    app.newTxFromFilters('income');
    assert.equal(app.tForm.category, 'Reembolsos');
    assert.equal(app.tForm.contractId, null, 'com o contrato passava a renda');
    assert.equal(app.irsReceitaDe(app.normTx(app.tForm)).papel, 'reembolsoGasto');
  });

  test('com dois contratos em vigor não se adivinha qual', () => {
    casa(app);
    app.db.contracts.push(app.normContract({ id: 'C2', name: 'C2', propertyId: 'p1', tenantIds: ['t1'], rent: 500, start: '2025-01-01', active: true }));
    app.newTxFromFilters('income');
    assert.equal(app.tForm.contractId, null);
    assert.equal(app.tForm.category, '');
  });
});

describe('D54 · o mês a que a renda respeita', () => {
  /* jan–nov de 2025 lançadas, e o planeado da renda refeito: o cursor fica em dezembro */
  function dezembroPorConfirmar(a) {
    const r = casa(a, { start: '2025-01-01' });
    for (let m = 1; m <= 11; m++) renda(a, '2025-' + String(m).padStart(2, '0') + '-08', 800);
    a.db.recurring = [];
    a.syncAllContractRecs();
    assert.equal(a.ctRecOf(a.contract('C1')).next, '2025-12-08');
    return r;
  }

  test('o cenário d54-mes-pre-preenchido: a renda de dezembro paga em janeiro é de dezembro', () => {
    const a = carregarApp({ hoje: '2026-01-20' });
    try {
      dezembroPorConfirmar(a);
      a.ctRegistarRenda('p1', 'C1');
      assert.equal(a.tForm.date, '2026-01-20');
      assert.equal(a.tForm.periodo, '2025-12', 'o do planeado por confirmar mais antigo, e não o da data');
      assert.match(a.txFiscoSect(), /O mês é o da renda mais antiga por confirmar deste contrato: corrige-o se esta renda é de outro\./);
      const novo = guardar(a);
      assert.equal(novo.periodo, '2025-12');
      const r = a.resumoFiscal(2026, 'eu');
      assert.deepEqual(JSON.parse(JSON.stringify(r.linhas[0].anosAnteriores)), [{ ano: 2025, valor: 800, retencoes: 0 }], 'vai ao quadro 8');
      a.syncAllContractRecs();
      assert.equal(a.ctRecOf(a.contract('C1')).next, '2026-01-08', 'o planeado de dezembro dá-se por pago');
    } finally { repor(a); }
  });

  test('numa «Renda em atraso» o mês vem em branco e é obrigatório', () => {
    const a = carregarApp({ hoje: '2026-01-20' });
    try {
      const { avisos } = dezembroPorConfirmar(a);
      a.ctRegistarRenda('p1', 'C1');
      const real = a.collectTx;
      a.collectTx = () => {};
      const desfaz = camposNoEcra(a, { t_sub: 'Renda em atraso' });
      try { a.onSubChange(); } finally { desfaz(); a.collectTx = real; }
      assert.equal(a.tForm.sub, 'Renda em atraso');
      assert.equal(a.tForm.periodo, '', 'a sugestão sai');
      assert.match(a.txFiscoSect(), /Mês a que respeita <span class="req">\*<\/span><input id="t_periodo"/);
      const antes = a.db.transactions.length;
      guardar(a);
      assert.equal(a.db.transactions.length, antes, 'sem o mês não se grava');
      assert.ok(avisos.some((m) => /mês a que a renda em atraso respeita/.test(m)), avisos.join(' | '));
      a.tForm.periodo = '2025-12';
      const novo = guardar(a);
      assert.equal(novo.sub, 'Renda em atraso');
      assert.equal(novo.periodo, '2025-12');
    } finally { repor(a); }
  });

  test('sem planeado por confirmar o mês fica em branco (é o da data), e nunca por cima do escrito', () => {
    casa(app);
    app.db.recurring = [];
    app.txModo = { modo: 'tx' };
    app.tForm = app.normTx({ kind: 'income', propertyId: 'p1', contractId: 'C1', date: '2026-09-05' });
    app.tForm._edit = false; app.prefill();
    assert.equal(app.tForm.periodo, '');
    assert.match(app.txFiscoSect(), /Mês a que respeita \(opcional\)/);
    assert.match(app.txFiscoSect(), /Mês em branco: o da data\./);
  });
});

describe('D23 · a retenção: o montante é o que entrou', () => {
  test('com a renda do contrato no montante e a retenção escrita, a conta diz o que entrou', () => {
    casa(app, { rent: 1000 });
    app.tForm = app.normTx({ kind: 'income', propertyId: 'p1', contractId: 'C1', amount: 1000, retencao: 250, date: '2026-03-08' });
    const t = texto(app.txBody());
    assert.match(t, /O montante é o que entrou: com 250,00\s€ retidos, entraram 750,00\s€\./);
    app.tForm.amount = 750;
    assert.doesNotMatch(texto(app.txBody()), /O montante é o que entrou/, 'com o que entrou no montante, nada a dizer');
    app.tForm.amount = 100; app.tForm.retencao = 900;
    assert.match(texto(app.txBody()), /O retido \(900,00\s€\) passa o que entrou \(100,00\s€\): confirma no recibo\./);
  });
});

describe('a coluna do Anexo F no formulário e na ficha', () => {
  test('D61 · D07 · o que a categoria deixa a confirmar diz «escolhe a coluna», e não conta até se escolher', () => {
    casa(app);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Outros', date: '2026-03-01' });
    let html = app.txBody();
    assert.match(html, /Pela categoria: a confirmar — escolhe a coluna</);
    assert.match(texto(html), /Até escolheres a coluna \(ou «Não dedutível»\), não conta na Declaração\./);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Manutenção e reparações', sub: 'Caldeira / AVAC', date: '2026-03-01' });
    html = texto(app.txBody());
    assert.ok(html.includes(app.IRS_MAPA_NOTAS['Manutenção e reparações / Caldeira / AVAC']), 'a nota da regra');
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', date: '2026-03-01' });
    assert.match(app.txBody(), /Pela categoria: Condomínio</);
    // a ficha
    const x = lancar(app, { kind: 'expense', label: 'Coima', amount: 150, category: 'Outros', date: '2026-03-01' });
    assert.match(texto(app.txFicha(x.id)), /Anexo F A confirmar pela categoria: escolhe a coluna/);
  });

  test('D66 · o AIMI não tem seletor da coluna: vai ao quadro 9', () => {
    casa(app);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Impostos', sub: 'AIMI', irsCol: 'outros', date: '2026-06-30' });
    const html = app.txBody();
    assert.doesNotMatch(html, /id="t_irscol"/);
    assert.match(texto(html), /O AIMI não entra nos gastos do Anexo F: vai ao quadro 9\./);
    const desfaz = camposNoEcra(app, { t_label: 'AIMI', t_amount: '2100', t_date: '2026-06-30' });
    try { app.collectTx(); } finally { desfaz(); }
    assert.equal(app.tForm.irsCol, '', 'a escolha antiga não fica gravada escondida');
  });

  test('D65 · a coluna escolhida numa altura sem contrato diz que a despesa passa a contar', () => {
    casa(app, { start: '2026-06-01' });
    renda(app, '2026-07-08', 800);
    const D65 = 'Esta despesa é de uma altura sem contrato: com a coluna escolhida, conta na Declaração.';
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', irsCol: 'condominio', date: '2026-02-10', amount: 250 });
    assert.ok(texto(app.txBody()).includes(D65));
    // e conta mesmo (a decisão de 2026-10-08: a escolha do movimento manda)
    lancar(app, Object.assign({}, app.tForm, { label: 'Condomínio' }));
    assert.equal(app.resumoFiscal(2026, 'eu').totais.gastos.condominio, 250);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', date: '2026-02-10', amount: 250 });
    assert.ok(!texto(app.txBody()).includes(D65), 'pela categoria fica fora, e não há o que dizer');
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', irsCol: 'condominio', date: '2026-07-10', amount: 250 });
    assert.ok(!texto(app.txBody()).includes(D65), 'com contrato em vigor, nada muda');
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Impostos', sub: 'IMI', irsCol: 'imi', date: '2026-02-10', amount: 250 });
    assert.ok(!texto(app.txBody()).includes(D65), 'o IMI conta sem olhar para o período');
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', irsCol: 'condominio', date: '2024-02-10', amount: 250 });
    assert.ok(!texto(app.txBody()).includes(D65), 'num ano sem contrato nenhum o imóvel não tem linha');
  });
});

describe('D32 · a nota própria do IMI, e D95 · a quota que o IRS segue', () => {
  function meias(a) {
    casa(a);
    a.db.owners.push(a.normPerson({ id: 'rui', name: 'Rui' }));
    a.db.properties[0].ownerIds = ['eu', 'rui'];
  }

  test('o interruptor só numa casa com mais de um dono, e só no IMI', () => {
    meias(app);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Impostos', sub: 'IMI', date: '2026-05-31', amount: 2000 });
    assert.match(app.txBody(), /<input type="checkbox" role="switch" class="ct-sw" id="t_notaPropria">/);
    assert.match(app.txBody(), /É a minha nota de IMI/);
    app.tForm.sub = 'Imposto do selo';
    assert.doesNotMatch(app.txBody(), /t_notaPropria/, 'só no IMI');
    app.db.properties[0].ownerIds = ['eu'];
    app.tForm.sub = 'IMI';
    assert.doesNotMatch(app.txBody(), /t_notaPropria/, 'com um dono só, a nota é a do prédio');
    app.db.properties[0].comproprietariosFora = [{ id: 'f1', nome: 'Tia', quota: 50 }];
    assert.match(app.txBody(), /id="t_notaPropria"/, 'um comproprietário fora da app também conta');
  });

  test('ligado grava-se, e a ficha di-lo; fora do IMI de vários donos não fica ligado', () => {
    meias(app);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Impostos', sub: 'IMI', date: '2026-05-31', amount: 2000, label: 'IMI' });
    let desfaz = camposNoEcra(app, { t_label: 'IMI', t_amount: '2000', t_date: '2026-05-31', t_notaPropria: true });
    try { app.collectTx(); } finally { desfaz(); }
    assert.equal(app.tForm.notaPropria, true);
    const x = guardar(app);
    assert.equal(x.notaPropria, true);
    assert.match(texto(app.txFicha(x.id)), /Nota de IMI A minha nota: conta inteira para quem a pagou/);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', category: 'Condomínio', date: '2026-05-31', amount: 50, label: 'Cond' });
    desfaz = camposNoEcra(app, { t_label: 'Cond', t_amount: '50', t_date: '2026-05-31', t_notaPropria: true });
    try { app.collectTx(); } finally { desfaz(); }
    assert.equal(app.tForm.notaPropria, false);
  });

  test('D95 · a ficha de um movimento com divisão própria diz que o IRS segue a quota', () => {
    meias(app);
    const frase = 'Para o IRS conta a quota de cada um no imóvel, não quem pagou nem a divisão escolhida aqui (CIRS art. 19.º).';
    const x = lancar(app, { kind: 'expense', label: 'Pintura', amount: 1000, category: 'Manutenção e reparações', date: '2026-04-01', paidBy: 'eu', split: { mode: 'amount', parts: { eu: 1000, rui: 0 } } });
    assert.ok(texto(app.txFicha(x.id)).includes(frase));
    const y = lancar(app, { kind: 'expense', label: 'Pintura', amount: 1000, category: 'Manutenção e reparações', date: '2026-04-01', paidBy: 'eu' });
    assert.ok(!texto(app.txFicha(y.id)).includes(frase), 'pela quota não há diferença a explicar');
    // e no formulário, por baixo da divisão
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'p1', amount: 1000, paidBy: 'eu', date: '2026-04-01', split: { mode: 'equal', parts: {} } });
    assert.ok(texto(app.txBody()).includes(frase));
  });
});

describe('o inquilino empresa e o estrangeiro', () => {
  test('D58 · «Confirmei: não retém» na ficha de um inquilino com NIF de empresa grava retemVisto', () => {
    casa(app);
    app.db.tenants.push(app.normPerson({ id: 'e1', name: 'Empresa, Lda.', nif: '503004642' }));
    let html = app.personFicha('tenant', 'e1');
    assert.match(texto(html), /Retenção na fonte por confirmar/);
    assert.match(html, /data-click="pesNaoRetem\('e1'\)"[^>]*>.*Confirmei: não retém<\/button>/);
    app.pesNaoRetem('e1');
    assert.equal(app.db.tenants.find((t) => t.id === 'e1').retemVisto, true);
    html = app.personFicha('tenant', 'e1');
    assert.match(texto(html), /Retenção na fonte confirmaste que não retém/);
    assert.doesNotMatch(html, /pesNaoRetem/);
    // um NIF de pessoa não tem a pergunta
    assert.doesNotMatch(app.personFicha('tenant', 't1'), /pesNaoRetem|Retenção na fonte/);
  });

  test('D58 · no formulário a caixa só aparece num NIF de empresa, e nunca com o «retém»', () => {
    casa(app);
    app.perKind = 'tenant';
    app.perForm = app.normPerson({ id: 'e1', name: 'Empresa', nif: '503004642' });
    assert.match(app.personBody(), /<div id="pe_retemVistoL"><label class="check"><input type="checkbox" id="pe_retemVisto" >/);
    app.perForm = app.normPerson({ id: 'p9', name: 'Ana', nif: '123456789' });
    assert.match(app.personBody(), /id="pe_retemVistoL" hidden/);
    app.perForm = app.normPerson({ id: 'e1', name: 'Empresa' });
    let desfaz = camposNoEcra(app, { pe_name: 'Empresa', pe_nif: '503004642', pe_retemVisto: true });
    try { app.collectPerson(); } finally { desfaz(); }
    assert.equal(app.perForm.retemVisto, true);
    desfaz = camposNoEcra(app, { pe_name: 'Empresa', pe_nif: '503004642', pe_retem: true, pe_retemVisto: true });
    try { app.collectPerson(); } finally { desfaz(); }
    assert.equal(app.perForm.retemVisto, false, 'quem retém não «não retém»');
  });

  test('D59 · um número estrangeiro com o país não vai na coluna do NIF', () => {
    casa(app);
    const fora = 'Um número estrangeiro não vai na coluna do NIF: no Anexo F, conta o país.';
    assert.equal(app.pessoaNifHint('X1234567L', 'Espanha'), fora);
    assert.equal(app.pessoaNifHint('123456780', 'Espanha'), 'Este NIF não bate certo: confere os dígitos. ' + fora);
    assert.equal(app.pessoaNifHint('X1234567L', ''), 'Este NIF não bate certo: confere os dígitos.');
    assert.equal(app.pessoaNifHint('123456789', 'Espanha'), '', 'um NIF português certo não tem nada a dizer');
    app.db.tenants.push(app.normPerson({ id: 'l1', name: 'Lucía', nif: 'X1234567L', pais: 'Espanha' }));
    const html = app.personFicha('tenant', 'l1');
    assert.match(texto(html), /número estrangeiro: no Anexo F conta o país/);
    assert.doesNotMatch(html, /não bate certo/);
    app.perKind = 'tenant';
    app.perForm = app.normPerson({ id: 'l1', name: 'Lucía', nif: 'X1234567L', pais: 'Espanha' });
    assert.match(app.personBody(), /id="pe_pais"[^>]*data-input="pessoaNifEscrito\(\)"/, 'o país também refaz a dica');
  });
});

describe('D33 · o seletor do imóvel sem os vendidos', () => {
  test('o vendido sai depois da data da venda, e fica antes dela, no dia, e quando já é o escolhido', () => {
    casa(app);
    app.db.properties.push(app.normProp({ id: 'p2', name: 'T1 Benfica', ownerIds: ['eu'], vendido: '2026-03-31' }));
    const rotulos = (t) => app.opcoesDoImovel(app.normTx(t)).map((o) => o.label);
    app.txModo = { modo: 'tx' };
    assert.ok(!rotulos({ kind: 'expense', date: '2026-11-17' }).includes('T1 Benfica'), 'depois da venda sai');
    assert.ok(rotulos({ kind: 'expense', date: '2026-03-15' }).includes('T1 Benfica'), 'antes da venda fica');
    assert.ok(rotulos({ kind: 'expense', date: '2026-03-31' }).includes('T1 Benfica'), 'no dia da venda fica');
    assert.ok(rotulos({ kind: 'expense', date: '2026-11-17', propertyId: 'p2' }).includes('T1 Benfica'), 'o já escolhido fica');
    assert.ok(rotulos({ kind: 'expense', date: '2026-11-17' }).includes('T2 Arroios'));
    app.txModo = { modo: 'rec' };
    assert.ok(!rotulos({ kind: 'expense', date: '2026-01-01' }).includes('T1 Benfica'), 'num planeado conta hoje');
    app.txModo = { modo: 'tx' };
    // o filtro da lista continua a tê-lo, a dizer que foi vendido
    assert.ok(app.txOpcoesImovel().some((o) => o.label === 'T1 Benfica · vendido'));
  });
});
