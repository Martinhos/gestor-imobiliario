// As categorias que o IRS lê pelo id em todo o lado, a migração das comunicações
// antigas e as datas que não existem (auditoria ao IRS de raiz, ronda 1 das
// correções, KAN-147 e KAN-148). Cada achado tem aqui pelo menos um assert que
// falhava antes:
// · N003 — a marca anual antiga depois do prazo do período fica por confirmar
//   (fisco.comunicacoesPorConfirmar), em vez de virar uma comunicação fora do
//   prazo que manda responder NÃO no 4.2A;
// · N005 — mudar o nome às Rendas ou aos Impostos leva os planeados e os modelos,
//   e o molde da renda, os planeados da ficha e o ehRenda leem pelo id;
// · N006 — o movimento leva o id do IRS (t.catIrs) quando o nome não chega: a
//   outra conta da casa lê-o pelo id, e não pela árvore dela;
// · N073 — «Repor categorias» leva as categorias do IRS renomeadas de volta ao
//   nome de origem, com os movimentos, e a confirmação di-lo;
// · N074 — a caução lê-se pelo id: renomeada continua passivo; uma «Caução» da
//   pessoa vai às receitas por classificar;
// · N043 — apagar uma subcategoria deixa escrita no movimento a coluna que ela
//   dava, e a confirmação di-lo;
// · N104 — o mês da renda, a celebração, as renovações e a data de compra só
//   com datas que existem;
// · N020 — os bens comuns do casal na situação de cada ano (D5).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

/* Um JSON que atravessa o contexto isolado (os objetos da vm têm outro protótipo). */
const copia = (o) => JSON.parse(JSON.stringify(o));

/* Tira o ecrã às ações e responde às janelas: a confirmação confirma e guarda o
   texto, o pedido de um nome responde com o que se lhe der. O save fica o de
   verdade: é ele que carimba o id do IRS (carimbarCatIrs).
   Recebe: a — a app; nome (opcional) — o que o promptModal responde.
   Devolve: {perguntas} — os textos das confirmações, por ordem. */
function janelas(a, nome) {
  const dito = { perguntas: [], toast: '' };
  a.render = () => {};
  a.buildNav = () => {};
  a.closeModal = () => {};
  a.toast = (m) => { dito.toast = m; };
  a.confirmModal = (t, txt, cb) => { dito.perguntas.push(String(txt)); cb(); };
  a.promptModal = (t, l, v, cb) => { cb(nome); };
  return dito;
}

/* Uma conta com o imóvel v1 (IMI de 300 €) e o contrato C1 de 800 €/mês desde
   janeiro de 2026, declarado; os donos e as quotas à escolha.
   Recebe: a — a app; donos (opcional) — {id: quota}.
   Devolve: nada — mexe na db. */
function casa(a, donos) {
  limpar(a);
  const ids = Object.keys(donos || { ana: 100 });
  ids.forEach((id) => a.db.owners.push(a.normPerson({ id, name: id })));
  a.db.tenants.push(a.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
  a.db.properties.push(a.normProp({ id: 'v1', name: 'T2', ownerIds: ids, ownerShares: donos || { ana: 100 }, comproprietariosFora: [],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '1', imi: 300 }));
  a.db.contracts.push(a.normContract({ id: 'C1', name: 'C1', propertyId: 'v1', tenantIds: ['t1'], rent: 800, payDay: 5,
    start: '2026-01-01', end: '2030-12-31', active: true, fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } }));
}
/* Uma renda de 800 € do C1 num mês de 2026.
   Recebe: a — a app; mes — 'MM'; extra (opcional) — campos por cima.
   Devolve: o movimento, já na base. */
function renda(a, mes, extra) {
  const t = a.normTx(Object.assign({ kind: 'income', label: 'Renda C1', amount: 800, date: '2026-' + mes + '-05', periodo: '2026-' + mes,
    propertyId: 'v1', contractId: 'C1', category: 'Rendas', sub: 'Renda mensal', recibo: true }, extra || {}));
  a.db.transactions.push(t);
  return t;
}

describe('N003 · a marca anual antiga depois do prazo do período fica por confirmar', () => {
  beforeEach(() => limpar(app));
  const ct = (com) => app.normContract({ id: 'C', start: '2021-06-01', end: '2026-05-31',
    fisco: { estado: 'declarado', finalidade: 'hp', comunicacoes: com } });

  test('o cenário do auditor: {2025: 10/02/2026} num contrato de 2021 não vira «comunicada fora do prazo»', () => {
    const c = ct({ 2025: '2026-02-10' });
    igual(c.fisco.comunicacoes, {}, 'a data antiga não é o dia da comunicação do período');
    igual(c.fisco.comunicacoesPorConfirmar, { 2021: '2026-02-10' });
    assert.equal(c.fisco.comunicacoesV, 2);
    app.db.contracts.push(c);
    const x = app.irsComunicacaoDoAno(c, 2025);
    assert.equal(x.foraDePrazo, false, 'sem afirmar NÃO no 4.2A');
    assert.ok(!x.data, 'sem data: fica por confirmar');
  });

  test('só uma data até ao prazo do período (15/02 do ano a seguir ao início) migra como feita; a mais antiga de cada lado', () => {
    igual(ct({ 2021: '2022-02-01' }).fisco.comunicacoes, { 2021: '2022-02-01' }, 'já no sentido novo e a tempo');
    const duas = ct({ 2024: '2025-02-15', 2025: '2026-02-15' });
    igual(duas.fisco.comunicacoes, {});
    igual(duas.fisco.comunicacoesPorConfirmar, { 2021: '2025-02-15' });
    const mistas = ct({ 2022: '2022-02-15', 2025: '2026-02-10' });
    igual(mistas.fisco.comunicacoes, { 2021: '2022-02-15' }, 'o 15 de fevereiro ainda é a tempo');
    assert.equal(mistas.fisco.comunicacoesPorConfirmar, undefined, 'com uma a tempo no período, não há pergunta (nem campo)');
  });

  test('uma renovação é outro período, com o prazo dela', () => {
    const c = app.normContract({ id: 'C', start: '2021-06-01', end: '2026-05-31',
      fisco: { renovacoes: [{ id: 'R', inicio: '2024-06-01', fim: '2026-05-31' }], comunicacoes: { 2024: '2025-02-01', 2025: '2026-02-10' } } });
    igual(c.fisco.comunicacoes, { 2024: '2025-02-01' }, 'a da renovação de 2024, a tempo');
    assert.equal(c.fisco.comunicacoesPorConfirmar, undefined, 'a de 2025 cai no mesmo período, já comunicado a tempo');
  });

  test('idempotente: uma segunda passagem (outro aparelho, a fusão a três) não muda nada', () => {
    const c = ct({ 2024: '2025-02-10', 2025: '2026-02-10' });
    const outra = app.normContract(copia(c));
    igual(outra.fisco, copia(c.fisco));
  });

  test('o normFisco: só anos de quatro algarismos e datas que existem; o dia escrito ganha à pergunta', () => {
    const f = app.normFisco({ comunicacoesV: 2, comunicacoes: { 2022: '2023-01-10' },
      comunicacoesPorConfirmar: { 2022: '2026-02-10', 2023: '2026-02-30', ano: '2026-02-10', 2024: '2026-02-10' } });
    igual(f.comunicacoesPorConfirmar, { 2024: '2026-02-10' });
    assert.equal('comunicacoesPorConfirmar' in app.normFisco({}), false, 'sem perguntas, sem campo: os contratos de sempre não mudam de forma');
  });

  test('resolverComunicacao: com o dia fica feita nesse dia; sem ele, a pergunta sai e fica por comunicar', () => {
    const c = ct({ 2025: '2026-02-10' });
    assert.equal(app.resolverComunicacao(c, '2021', '2022-01-20'), true);
    igual(c.fisco.comunicacoes, { 2021: '2022-01-20' });
    assert.equal(c.fisco.comunicacoesPorConfirmar, undefined);
    const d = ct({ 2025: '2026-02-10' });
    assert.equal(app.resolverComunicacao(d, '2021', ''), true);
    igual(d.fisco.comunicacoes, {});
    assert.equal(d.fisco.comunicacoesPorConfirmar, undefined);
    assert.equal(app.resolverComunicacao(d, '21', '2022-01-20'), false, 'uma chave que não é um ano');
    assert.equal(app.resolverComunicacao(d, '2021', '2022-02-30'), false, 'um dia que não existe');
  });
});

describe('N005 · mudar o nome às Rendas e aos Impostos não tira os planeados da Declaração', () => {
  beforeEach(() => casa(app));

  test('os planeados e os modelos levam o nome novo; a renda e o IMI confirmados contam', () => {
    janelas(app);
    app.syncAllContractRecs(); app.syncAllPropRecs();
    const recR = app.db.recurring.find((r) => r.tx.contractId === 'C1');
    const recI = app.db.recurring.find((r) => r.tx.propRec === 'imi');
    app.db.templates.push(app.normTpl({ id: 'M1', name: 'IMI', tx: { kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, propertyId: 'v1' } }));
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    app.renameCat('cats', 'Impostos', 'Impostos e taxas');
    app.syncAllContractRecs(); app.syncAllPropRecs();
    igual([recR.tx.category, recR.tx.sub], ['Arrendamento', 'Renda mensal']);
    igual([recI.tx.category, recI.tx.sub], ['Impostos e taxas', 'IMI']);
    assert.equal(app.db.templates[0].tx.category, 'Impostos e taxas', 'o modelo também');
    const tR = app.recTx(recR, '2026-03-05'); tR.periodo = '2026-03'; app.db.transactions.push(tR);
    const tI = app.recTx(recI, '2026-03-01'); app.db.transactions.push(tI);
    igual(app.irsReceitaDe(tR), { papel: 'renda', natureza: '07' });
    assert.equal(app.irsColunaDe(tI).col, 'imi');
    assert.equal(app.ehRenda(tR), true);
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.totais.rendas, 800);
    assert.equal(r.porClassificar.length, 0);
  });

  test('um planeado novo depois do nome mudado nasce na categoria certa (o molde da renda e o IMI da ficha pelo id)', () => {
    janelas(app);
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    app.renameCat('cats', 'Impostos', 'Impostos e taxas');
    app.syncAllContractRecs(); app.syncAllPropRecs();
    const recR = app.db.recurring.find((r) => r.tx.contractId === 'C1');
    const recI = app.db.recurring.find((r) => r.tx.propRec === 'imi');
    igual([recR.tx.category, recR.tx.sub], ['Arrendamento', 'Renda mensal']);
    igual([recI.tx.category, recI.tx.sub], ['Impostos e taxas', 'IMI']);
    igual(copia(app.ctMoldeDaRenda(app.db.contracts[0])).category, 'Arrendamento');
  });

  test('o condomínio e o seguro da ficha, sem id, seguem a subcategoria quando a categoria muda de nome', () => {
    janelas(app);
    app.db.properties[0].condominio = 40; app.db.properties[0].seguro = 120;
    app.renameCat('cats', 'Condomínio', 'Condomínios');
    app.syncAllPropRecs();
    const c = app.db.recurring.find((r) => r.tx.propRec === 'condominio');
    igual([c.tx.category, c.tx.sub], ['Condomínios', 'Quota mensal']);
    assert.equal(app.irsColunaDe(app.recTx(c, '2026-12-01')).col, 'condominio');
  });

  test('o ehRenda pelo id: os meses já pagos continuam lançados depois de mudar o nome, e as Rendas «Fora dos totais» também', () => {
    janelas(app);
    renda(app, '01'); renda(app, '02');
    const c = app.db.contracts[0];
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    assert.equal(app.rendaJaLancada(c, '2026-01-05'), true);
    assert.equal(app.rendaJaLancada(c, '2026-03-05'), false);
    app.db.settings.exclude[app.excKey('catsIn', 'Arrendamento')] = true;
    assert.equal(app.rendaJaLancada(c, '2026-02-05'), true, 'o «Fora dos totais» é dos gráficos; a renda está lançada');
  });

  test('um planeado que ficou com o nome antigo (de antes desta versão) lê-se pelo nome de origem', () => {
    janelas(app);
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    const t = renda(app, '04');   // «Rendas / Renda mensal», um nome que esta árvore já não tem
    igual(app.irsReceitaDe(t), { papel: 'renda', natureza: '07' });
    const imi = app.normTx({ kind: 'expense', amount: 300, date: '2026-04-30', propertyId: 'v1', category: 'Impostos', sub: 'IMI' });
    app.renameCat('cats', 'Impostos', 'Impostos e taxas');
    assert.equal(app.irsColunaDe(imi).col, 'imi', 'o IMI de origem cai na coluna do IMI desta conta');
  });
});

describe('N006 · numa casa partilhada, o nome que a outra conta deu não tira o movimento da Declaração', () => {
  /* A Ana muda o nome às Rendas, à Caução e aos Impostos e grava a renda, a
     caução e o IMI; a Bia, com as categorias de origem, recebe os movimentos tal
     como a Ana os gravou. */
  function daAna() {
    const ana = carregarApp({ hoje: '2026-11-17' });
    casa(ana, { ana: 50, bia: 50 });
    janelas(ana, 'Depósito');
    ana.renameCat('catsIn', 'Rendas', 'Arrendamento');
    ana.renameSub('catsIn', 'Arrendamento', 'Caução');
    ana.renameCat('cats', 'Impostos', 'Impostos e taxas');
    ana.db.transactions.push(ana.normTx({ kind: 'income', amount: 800, date: '2026-02-05', periodo: '2026-02', propertyId: 'v1', contractId: 'C1',
      category: 'Arrendamento', sub: 'Renda mensal', recibo: true }));
    ana.db.transactions.push(ana.normTx({ kind: 'income', amount: 1600, date: '2026-01-02', propertyId: 'v1', contractId: 'C1',
      category: 'Arrendamento', sub: 'Depósito', recibo: true }));
    ana.db.transactions.push(ana.normTx({ kind: 'expense', amount: 300, date: '2026-03-01', propertyId: 'v1', category: 'Impostos e taxas', sub: 'IMI' }));
    ana.save();
    return copia(ana.db.transactions);
  }

  test('a Ana grava com o id do IRS (t.catIrs) os nomes que só ela tem; os nomes de origem não ganham marca', () => {
    const txs = daAna();
    igual(txs[0].catIrs, { id: 'rendas/renda-mensal', cat: 'Arrendamento', sub: 'Renda mensal' });
    igual(txs[1].catIrs, { id: 'rendas/caucao', cat: 'Arrendamento', sub: 'Depósito' });
    igual(txs[2].catIrs, { id: 'impostos/imi', cat: 'Impostos e taxas', sub: 'IMI' });
    casa(app);
    janelas(app);
    const t = renda(app, '05');
    app.save();
    assert.equal(t.catIrs, undefined, 'quem nunca mudou um nome não ganha campo nenhum (nada muda nem sobe)');
  });

  test('a Bia lê a renda, a caução e o IMI da Ana pelo id', () => {
    const txs = daAna();
    casa(app, { ana: 50, bia: 50 });
    txs.forEach((t) => app.db.transactions.push(app.normTx(t)));
    const [tR, tC, tI] = app.db.transactions;
    igual(app.irsReceitaDe(tR), { papel: 'renda', natureza: '07' });
    assert.equal(app.irsReceitaDe(tC).papel, 'caucao');
    assert.equal(app.isPassivo(tC), true, 'a caução da Ana é passivo também para a Bia');
    igual(app.irsColunaDe(tI), { col: 'imi', origem: 'sub' });
    const r = app.resumoFiscal(2026, 'bia');
    assert.equal(r.porClassificar.length, 0);
    assert.equal(r.totais.rendas, 1200, 'metade da renda e da caução');
    assert.ok(r.totais.gastos.imi > 0, 'o IMI da Ana conta no da Bia');
  });

  test('e ao contrário: a Ana, que mudou os nomes, lê pelo nome de origem o que a Bia grava', () => {
    const ana = carregarApp({ hoje: '2026-11-17' });
    casa(ana, { ana: 50, bia: 50 });
    janelas(ana, 'Depósito');
    ana.renameCat('catsIn', 'Rendas', 'Arrendamento');
    ana.renameSub('catsIn', 'Arrendamento', 'Caução');
    const tR = renda(ana, '03'), tC = renda(ana, '01', { sub: 'Caução', amount: 1600, periodo: '' });
    igual(ana.irsReceitaDe(tR), { papel: 'renda', natureza: '07' });
    assert.equal(ana.irsReceitaDe(tC).papel, 'caucao');
    assert.equal(ana.isPassivo(tC), true);
    repor(ana);
  });

  test('a marca só vale com os nomes com que se gravou: mudar a categoria (aqui ou numa versão antiga) desliga-a', () => {
    casa(app);
    const t = app.normTx({ kind: 'income', amount: 800, date: '2026-02-05', propertyId: 'v1', contractId: 'C1',
      category: 'Outras receitas', sub: '', catIrs: { id: 'rendas', cat: 'Arrendamento', sub: '' } });
    assert.equal(app.irsReceitaDe(t).papel, 'porClassificar', 'a marca de outro nome não conta');
    janelas(app);
    app.db.transactions.push(t);
    app.save();
    assert.equal(t.catIrs, undefined, 'e o save tira-a');
  });

  test('o normTx: só uma marca bem feita, da árvore do tipo; sem ela, sem campo', () => {
    const ok = app.normTx({ kind: 'income', category: 'A', sub: 'B', catIrs: { id: 'rendas/caucao', cat: ' A ', sub: 'B', x: 1 } });
    igual(ok.catIrs, { id: 'rendas/caucao', cat: 'A', sub: 'B' });
    assert.equal('catIrs' in app.normTx({ kind: 'income', category: 'A' }), false);
    assert.equal('catIrs' in app.normTx({ kind: 'income', catIrs: { id: 'impostos/imi', cat: 'A', sub: 'B' } }), false, 'um id das despesas numa receita');
    assert.equal('catIrs' in app.normTx({ kind: 'expense', catIrs: { id: 'lixo', cat: 'A', sub: '' } }), false);
    assert.equal('catIrs' in app.normTx({ kind: 'income', catIrs: { id: 'rendas/caucao', cat: 'A', sub: '' } }), false, 'um id de subcategoria pede a subcategoria');
    assert.equal('catIrs' in app.normTx({ kind: 'loan', catIrs: { id: 'rendas', cat: 'A', sub: '' } }), false);
    const rec = app.normRec({ tx: { kind: 'income', category: 'A', sub: '', catIrs: { id: 'rendas', cat: 'A', sub: '' } } });
    igual(rec.tx.catIrs, { id: 'rendas', cat: 'A', sub: '' }, 'o planeado guarda-a e passa-a ao que se confirma');
  });

  test('catDoIdIrs: os nomes desta conta para um id do IRS', () => {
    casa(app);
    janelas(app);
    igual(copia(app.catDoIdIrs('catsIn', 'rendas/renda-mensal')), { category: 'Rendas', sub: 'Renda mensal' });
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    igual(copia(app.catDoIdIrs('income', 'rendas')), { category: 'Arrendamento', sub: '' });
    igual(copia(app.catDoIdIrs('cats', 'impostos/imi')), { category: 'Impostos', sub: 'IMI' });
    assert.equal(app.catDoIdIrs('cats', 'rendas'), null, 'o id da outra árvore');
    assert.equal(app.catDoIdIrs('cats', 'lixo'), null);
  });
});

describe('N073 · «Repor categorias» depois de mudar o nome às Rendas não as tira da Declaração', () => {
  beforeEach(() => casa(app));

  test('as rendas continuam a contar, voltam a «Rendas», e a confirmação di-lo', () => {
    const dito = janelas(app);
    for (let m = 1; m <= 11; m++) renda(app, String(m).padStart(2, '0'));
    app.syncAllContractRecs();
    app.renameCat('catsIn', 'Rendas', 'Arrendamentos');
    const antes = app.resumoFiscal(2026, 'ana').totais.rendas;
    assert.equal(antes, 8800);
    // os movimentos renomeados por uma versão antiga não têm a marca
    app.db.transactions.forEach((t) => { delete t.catIrs; });
    app.resetCats();
    assert.match(dito.perguntas.pop(), /“Arrendamentos” volta a “Rendas”/);
    assert.equal(app.resumoFiscal(2026, 'ana').totais.rendas, antes);
    assert.ok(app.db.transactions.every((t) => t.category === 'Rendas'));
    const rec = app.db.recurring.find((r) => r.tx.contractId === 'C1');
    assert.equal(rec.tx.category, 'Rendas', 'o planeado também');
    assert.equal(app.resumoFiscal(2026, 'ana').porClassificar.length, 0);
  });

  test('uma subcategoria do IRS renomeada volta ao nome de origem com os movimentos e as escolhas', () => {
    janelas(app, 'Depósito');
    const c = renda(app, '01', { sub: 'Caução', amount: 1600, periodo: '' });
    app.renameSub('catsIn', 'Rendas', 'Caução');
    app.renameCat('catsIn', 'Rendas', 'Arrendamentos');
    assert.equal(c.sub, 'Depósito');
    app.db.settings.exclude[app.excKey('catsIn', 'Arrendamentos', 'Depósito')] = true;
    app.resetCats();
    igual([c.category, c.sub], ['Rendas', 'Caução']);
    assert.equal(app.irsReceitaDe(c).papel, 'caucao');
    assert.equal(app.db.settings.exclude[app.excKey('catsIn', 'Rendas', 'Caução')], true, 'a escolha vai com ela');
  });
});

describe('N074 · a caução pelo id', () => {
  beforeEach(() => casa(app));

  test('renomeada, continua passivo e não fecha a renda do mês nos Planeados', () => {
    janelas(app, 'Depósito de garantia');
    app.db.contracts[0].start = '2026-10-01';
    const c = renda(app, '10', { sub: 'Caução', amount: 2000, date: '2026-10-01', periodo: '' });
    app.renameSub('catsIn', 'Rendas', 'Caução');
    assert.equal(c.sub, 'Depósito de garantia');
    assert.equal(app.isPassivo(c), true);
    assert.equal(app.countsInTotals(c), false);
    assert.equal(app.ehRenda(c), false);
    assert.equal(app.rendaJaLancada(app.db.contracts[0], '2026-10-05'), false);
  });

  test('uma «Caução» numa categoria da pessoa vai às receitas por classificar, com a Mensalidade', () => {
    app.db.settings.catsIn['Quartos'] = ['Mensalidade', 'Caução'];
    const m = renda(app, '03', { category: 'Quartos', sub: 'Mensalidade', amount: 400 });
    const c = renda(app, '03', { category: 'Quartos', sub: 'Caução', amount: 800, periodo: '' });
    assert.equal(app.isPassivo(c), false);
    assert.equal(app.irsReceitaDe(m).papel, 'porClassificar');
    assert.equal(app.irsReceitaDe(c).papel, 'porClassificar');
    const ids = JSON.stringify(app.resumoFiscal(2026, 'ana').porClassificar);
    assert.ok(ids.indexOf(c.id) > -1, 'a caução aparece no aviso, não sai em silêncio');
  });
});

describe('N043 · apagar uma subcategoria «Não dedutível» não passa as despesas a dedutíveis', () => {
  beforeEach(() => casa(app));
  const despesa = (category, sub, amount) => {
    const t = app.normTx({ kind: 'expense', amount, date: '2026-05-10', propertyId: 'v1', category, sub });
    app.db.transactions.push(t);
    return t;
  };

  test('o Fundo de reserva, os Eletrodomésticos e a Remodelação ficam «Não dedutível», escrito em cada despesa', () => {
    const dito = janelas(app);
    const f = despesa('Condomínio', 'Fundo de reserva', 400), e = despesa('Manutenção e reparações', 'Eletrodomésticos', 250),
      r = despesa('Obras e benfeitorias', 'Remodelação', 9000);
    const antes = copia(app.resumoFiscal(2026, 'ana').totais.gastos);
    app.delSub('cats', 'Condomínio', 'Fundo de reserva');
    assert.match(dito.perguntas.pop(), /continua em «Não dedutível» e não passa a «Condomínio»/);
    app.delSub('cats', 'Manutenção e reparações', 'Eletrodomésticos');
    app.delSub('cats', 'Obras e benfeitorias', 'Remodelação');
    for (const t of [f, e, r]) {
      assert.equal(t.sub, '');
      igual(app.irsColunaDe(t), { col: 'nao', origem: 'movimento' });
    }
    igual(app.resumoFiscal(2026, 'ana').totais.gastos, antes);
  });

  test('a que deixava a confirmar fica a confirmar; a coluna escolhida à mão não muda; os planeados também', () => {
    const dito = janelas(app);
    const q = despesa('Condomínio', 'Quota extraordinária', 500), m = despesa('Condomínio', 'Quota extraordinária', 200);
    m.irsCol = 'conservacao';
    app.db.recurring.push(app.normRec({ id: 'R1', name: 'Quota', next: '2026-12-01', tx: { kind: 'expense', amount: 50, propertyId: 'v1', category: 'Condomínio', sub: 'Quota extraordinária' } }));
    app.delSub('cats', 'Condomínio', 'Quota extraordinária');
    assert.match(dito.perguntas.pop(), /a despesa continua em «A confirmar»/, 'diz-se só a despesa que mudava');
    igual(app.irsColunaDe(q), { col: 'confirmar', origem: 'movimento' });
    igual(app.irsColunaDe(m), { col: 'conservacao', origem: 'movimento' });
    const rec = app.db.recurring[0];
    igual([rec.tx.sub, rec.tx.irsCol], ['', 'confirmar']);
  });

  test('o formulário do movimento tem a opção «A confirmar» escrita: abrir e gravar não a apaga', () => {
    janelas(app);
    const q = despesa('Condomínio', 'Quota extraordinária', 500);
    app.delSub('cats', 'Condomínio', 'Quota extraordinária');
    assert.equal(q.irsCol, 'confirmar');
    app.txColunaHtml(q);
    const ops = app.window.__sel.t_irscol.options.map((o) => o.v);
    assert.ok(ops.includes('confirmar'), 'o seletor tem a coluna escrita');
    assert.ok(!app.txColunaHtml(app.normTx({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal' })).includes('A confirmar — escolhe'), 'sem a coluna escrita, não aparece');
  });
});

describe('N104 · só datas e meses que existem nos campos que o IRS lê', () => {
  beforeEach(() => limpar(app));

  test('o mês da renda só de 01 a 12', () => {
    assert.equal(app.normTx({ kind: 'income', periodo: '2026-13' }).periodo, '');
    assert.equal(app.normTx({ kind: 'income', periodo: '2026-00' }).periodo, '');
    assert.equal(app.normTx({ kind: 'income', periodo: '2026-12' }).periodo, '2026-12');
  });

  test('a celebração e a data de compra pelo dataExiste', () => {
    assert.equal(app.normFisco({ celebracao: '2024-13-45' }).celebracao, '');
    assert.equal(app.normFisco({ celebracao: '2026-02-30' }).celebracao, '');
    assert.equal(app.normFisco({ celebracao: '2024-02-29' }).celebracao, '2024-02-29');
    assert.equal(app.normProp({ purchaseDate: '2023-02-30' }).purchaseDate, '');
    assert.equal(app.normProp({ purchaseDate: '2023-02-28' }).purchaseDate, '2023-02-28');
  });

  test('uma renovação sem início válido cai; um fim que não existe volta a vazio; a linha por preencher do formulário só cai no contrato', () => {
    igual(app.normFisco({ renovacoes: [{ inicio: 'lixo' }] }).renovacoes, []);
    igual(app.normFisco({ renovacoes: [{ id: 'R', inicio: '2027-02-30', fim: '2030-01-01' }] }).renovacoes, []);
    igual(app.normFisco({ renovacoes: [{ id: 'R', inicio: '2027-01-01', fim: '2027-99-99' }] }).renovacoes, [{ id: 'R', inicio: '2027-01-01', fim: '' }]);
    igual(app.normFisco({ renovacoes: [{ id: 'R', inicio: '', fim: '' }] }).renovacoes, [{ id: 'R', inicio: '', fim: '' }], 'o formulário edita-a');
    igual(app.normContract({ id: 'C', start: '2024-01-01', end: '2026-12-31', fisco: { renovacoes: [{ id: 'R', inicio: '', fim: '' }, null, 'x'] } }).fisco.renovacoes, []);
  });
});

describe('N020 · os bens comuns do casal na situação de cada ano (D5)', () => {
  beforeEach(() => limpar(app));

  test('o normIrsDefs guarda-os por ano (só true liga) e o irsSituacao herda-os como a conjunta', () => {
    const d = app.normIrsDefs({ porAno: { 2025: { conjunta: true, bensComuns: 'sim' }, 2026: { conjunta: true, bensComuns: true } } });
    assert.equal(d.porAno[2025].bensComuns, false);
    assert.equal(d.porAno[2026].bensComuns, true);
    app.db.settings.irs = d;
    assert.equal(app.irsSituacao(2026, 'ana').bensComuns, true);
    assert.equal(app.irsSituacao(2027, 'ana').bensComuns, true, 'herda do ano anterior mais perto');
    assert.equal(app.irsSituacao(2025, 'ana').bensComuns, false);
    app.db.settings.irs = { conjunta: true, titulares: {} };
    assert.equal(app.irsSituacao(2026, 'ana').bensComuns, false, 'nos campos antigos de topo, false');
  });
});
