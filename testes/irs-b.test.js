// Os comentários do Martinho a 2026-11-26 nos subtickets da vaga 2 do IRS
// (KAN-127), a folha irs-b do scope kanban-11-26:
//
// KAN-127-5 — com o filtro «Imóvel» do ecrã num só imóvel (os Contratos, os
//   Planeados, os Créditos, as Visitas, a Avaliação, as Projeções; os
//   Movimentos e a Visão geral já o faziam), o + › Receita nasce nesse
//   imóvel e, a partir dele, ligada ao contrato e a Rendas › Renda mensal,
//   como quando se escolhe o imóvel à mão (ambito.js:imovelDoFiltro,
//   movimento.js:txModal).
// KAN-127-6 — depois de ⋯ › Marcar como vendido, os planeados desse imóvel
//   que já só pediam depois do dia da venda (a prestação da hipoteca, a renda
//   do contrato, o IMI, o condomínio) saem da lista dos Planeados, filtrada
//   pelo imóvel ou não, e a ficha do contrato deixa de dizer «Próxima renda»
//   (planeados.js:recAcabouNaVenda). «Desfazer venda» devolve-os.
// KAN-127-7 — uma proposta de quotas igual à divisão de hoje (50/50 → 50/50)
//   não é uma mudança: o servidor não a guarda para os outros confirmarem
//   (rotas/casas.js:propostaSemMudanca), e uma que já esteja na base não se
//   mostra no cartão do imóvel nem no modal das partilhas
//   (imovel.js:imvPropostaSemMudanca).

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, conta, pedir, resp, estado, casa, comproprietario } from './lib/api.js';
import { carregarApp, carregarTudo, limpar, repor } from './arnes.js';

afterEach(() => mock.restoreAll());

/* ============================== KAN-127-5 ============================== */

/* Sem interface: as janelas não abrem e os avisos ficam numa lista.
   Recebe: a — o proxy da app.
   Devolve: a lista dos avisos (toasts). */
function semEcra(a) {
  const avisos = [];
  for (const n of ['render', 'openModal', 'closeAllModals', 'closeModal', 'save', 'buildNav']) a[n] = () => {};
  a.toast = (m) => { avisos.push(m); };
  return avisos;
}

/* Dois imóveis meus de arrendamento, cada um com o seu contrato em vigor e
   uma hipoteca no p2; um grupo com os dois.
   Recebe: a — o proxy da app.
   Devolve: nada — enche a base e limpa os filtros de todos os ecrãs. */
function doisImoveis(a) {
  const db = limpar(a);
  semEcra(a);
  db.owners.push(a.normPerson({ id: 'eu', name: 'Eu' }));
  db.tenants.push(a.normPerson({ id: 't1', name: 'Inquilino' }));
  for (const p of ['p1', 'p2']) {
    db.properties.push(a.normProp({ id: p, name: 'Casa ' + p, ownerIds: ['eu'], use: 'investimento',
      loans: p === 'p2' ? [a.normLoan({ id: 'l2', name: 'Aquisição', bank: 'B', outstanding: 50000, years: 20, type: 'fixa', rate: 3, start: '2020-01-10' })] : [] }));
    db.contracts.push(a.normContract({ id: 'C' + p, name: 'C' + p, propertyId: p, tenantIds: ['t1'], rent: p === 'p1' ? 700 : 800, payDay: 8, start: '2025-01-01', active: true }));
  }
  db.groups.push(a.normGroup({ id: 'G1', name: 'Todos', kind: 'prop', ids: ['p1', 'p2'] }));
  a.txFilter = ''; a.txCat = ''; a.txSub = ''; a.txProp = ''; a.txPaid = ''; a.txCt = '';
  a.dashProp = ''; a.repProp = ''; a.projProp = '';
  for (const k of Object.keys(a.listF)) delete a.listF[k];
}

describe('KAN-127-5 · o + com o filtro num só imóvel nasce nele, com o contrato', () => {
  const app = carregarApp({ hoje: '2026-11-17' });
  afterEach(() => repor(app));

  /* Os ecrãs com o filtro «Imóvel», e como cada um o guarda. */
  const ECRAS = [
    ['contracts', (a, v) => { a.lf('lcts').p = v; }],
    ['recurring', (a, v) => { a.lf('lrec').p = v; }],
    ['credits', (a, v) => { a.lf('lcred').p = v; }],
    ['visits', (a, v) => { a.lf('lvis').pr = v; }],
    ['reports', (a, v) => { a.repProp = v; }],
    ['projections', (a, v) => { a.projProp = v; }],
    ['transactions', (a, v) => { a.txProp = v; }],
    ['dashboard', (a, v) => { a.dashProp = v; }],
  ];

  for (const [tab, filtrar] of ECRAS) {
    test(tab + ': + › Receita com o p2 no filtro vem no p2, ligada ao Cp2 e a Rendas › Renda mensal', () => {
      doisImoveis(app);
      app.tab = tab;
      filtrar(app, 'p2');
      app.criarMovimento('income');
      assert.equal(app.tForm.propertyId, 'p2', 'o imóvel do filtro');
      assert.equal(app.tForm.contractId, 'Cp2', 'o contrato em vigor desse imóvel');
      assert.equal(app.tForm.category, 'Rendas');
      assert.equal(app.tForm.sub, 'Renda mensal');
      assert.equal(app.tForm.amount, 800, 'a renda dele');
    });
  }

  test('a Despesa também nasce no imóvel do filtro', () => {
    doisImoveis(app);
    app.tab = 'contracts';
    app.lf('lcts').p = 'p1';
    app.criarMovimento('expense');
    assert.equal(app.tForm.propertyId, 'p1');
    assert.equal(app.tForm.contractId, null, 'a despesa não liga contrato');
  });

  test('nos Créditos filtrados, o Pagamento de crédito nasce no imóvel e na hipoteca dele; sem «Editar a ficha», sem imóvel', () => {
    doisImoveis(app);
    app.tab = 'credits';
    app.lf('lcred').p = 'p2';
    app.criarMovimento('loan');
    assert.equal(app.tForm.propertyId, 'p2');
    assert.equal(app.tForm.loanId, 'l2', 'a única hipoteca viva');
    const real = app.motivoCredito;
    app.motivoCredito = () => 'Registar pagamentos de crédito precisa de poder editar a ficha do imóvel — pede ao dono.';
    try { app.txModal({ kind: 'loan' }); } finally { app.motivoCredito = real; }
    assert.equal(app.tForm.propertyId, null, 'a hipoteca não baixava: não se escolhe por ele');
  });

  test('o Movimento recorrente do + nos Planeados filtrados nasce também nesse imóvel', () => {
    doisImoveis(app);
    app.tab = 'recurring';
    app.lf('lrec').p = 'p2';
    app.txModal({ kind: 'expense', modo: 'rec', every: 'month' });
    assert.equal(app.tForm.propertyId, 'p2');
  });

  test('sem filtro, com um grupo ou com «Sem imóvel» no filtro, não se adivinha o imóvel', () => {
    doisImoveis(app);
    app.tab = 'contracts';
    app.criarMovimento('income');
    assert.equal(app.tForm.propertyId, null, 'sem filtro');
    app.lf('lcts').p = 'g:G1';
    app.criarMovimento('income');
    assert.equal(app.tForm.propertyId, null, 'um grupo é um lote: escolhe-se lá dentro');
    app.tab = 'transactions'; app.lf('lcts').p = ''; app.txProp = '__none__';
    app.newTxFromFilters('income');
    assert.equal(app.tForm.propertyId, null, '«Sem imóvel» fica sem imóvel');
  });

  test('o imóvel escolhido por quem chama ganha ao do filtro; um modelo sem imóvel fica sem imóvel', () => {
    doisImoveis(app);
    app.tab = 'contracts';
    app.lf('lcts').p = 'p2';
    app.txModal({ kind: 'income', propId: 'p1' });
    assert.equal(app.tForm.propertyId, 'p1', 'o da ficha do p1');
    assert.equal(app.tForm.contractId, 'Cp1');
    app.txModal({ kind: 'income', ctId: 'Cp1' });
    assert.equal(app.tForm.propertyId, 'p1', 'o do contrato dado');
    app.txModal({ kind: 'expense', preset: { label: 'Luz', amount: 40, propertyId: null } });
    assert.equal(app.tForm.propertyId, null, 'o molde diz «sem imóvel»');
  });

  test('um imóvel do filtro já vendido antes de hoje não entra num movimento novo', () => {
    doisImoveis(app);
    app.db.properties.find((p) => p.id === 'p2').vendido = '2026-10-31';
    app.tab = 'contracts';
    app.lf('lcts').p = 'p2';
    app.criarMovimento('income');
    assert.equal(app.tForm.propertyId, null);
  });

  test('um imóvel do filtro onde não posso adicionar movimentos não entra', () => {
    doisImoveis(app);
    app.tab = 'contracts';
    app.lf('lcts').p = 'p2';
    const real = app.casasComo;
    app.casasComo = (perm) => real(perm).filter((p) => p.id !== 'p2');
    try { app.criarMovimento('income'); } finally { app.casasComo = real; }
    assert.equal(app.tForm.propertyId, null);
  });
});

/* ============================== KAN-127-6 ============================== */

describe('KAN-127-6 · os planeados de um imóvel vendido param no dia da venda', () => {
  const app = carregarApp({ hoje: '2026-11-17' });
  afterEach(() => repor(app));

  /* O p2 dos doisImoveis com o IMI e o condomínio na ficha, a renda de
     outubro registada e os planeados automáticos sincronizados; o p1 fica
     igual (o controlo).
   Recebe: a — o proxy.
   Devolve: nada. */
  function comPlaneados(a) {
    doisImoveis(a);
    const p2 = a.db.properties.find((p) => p.id === 'p2');
    p2.imi = 300; p2.condominio = 30;
    a.db.transactions.push(a.normTx({ kind: 'income', propertyId: 'p2', contractId: 'Cp2', category: 'Rendas', sub: 'Renda mensal', amount: 800, date: '2026-10-08' }));
    a.syncAllContractRecs(); a.syncAllLoanRecs(); a.syncAllPropRecs();
  }
  const linhas = (h) => [...String(h).matchAll(/data-lp="rec:([^"]+)"/g)].map((m) => m[1]);
  const doImovel = (a, pid) => a.db.recurring.filter((r) => (r.tx || {}).propertyId === pid).map((r) => r.id);

  test('vendido a 31/10: a hipoteca, o contrato e a ficha do p2 saem da lista, filtrada pelo p2 ou não; o p1 fica', () => {
    comPlaneados(app);
    const p2 = doImovel(app, 'p2'), p1 = doImovel(app, 'p1');
    assert.ok(p2.length >= 3, 'o p2 tem planeados (hipoteca, renda, IMI, condomínio)');
    assert.ok(app.db.recurring.some((r) => r.tx.loanId === 'l2'), 'o da hipoteca');
    assert.ok(app.db.recurring.some((r) => r.tx.contractId === 'Cp2'), 'o do contrato');
    app.tab = 'recurring';
    app.lf('lrec').p = 'p2';
    assert.deepEqual(linhas(app.vRecurring()).sort(), p2.slice().sort(), 'antes da venda estão todos');
    app.db.properties.find((p) => p.id === 'p2').vendido = '2026-10-31';
    app.syncAllContractRecs(); app.syncAllLoanRecs(); app.syncAllPropRecs();
    assert.deepEqual(linhas(app.vRecurring()), [], 'filtrada pelo p2: nenhum depois da venda');
    app.lf('lrec').p = '';
    const todas = linhas(app.vRecurring());
    assert.ok(p2.every((id) => todas.indexOf(id) < 0), 'sem filtro também não');
    assert.ok(p1.every((id) => todas.indexOf(id) > -1), 'os do p1 continuam');
  });

  test('o que ainda pede antes da venda fica: vendido a 15/12 (marcado para a frente), a renda de 8/12 continua; a de 8/1 já não', () => {
    comPlaneados(app);
    app.db.properties.find((p) => p.id === 'p2').vendido = '2026-12-15';
    app.tab = 'recurring';
    app.lf('lrec').p = 'p2';
    const renda = app.db.recurring.find((r) => r.tx.contractId === 'Cp2');
    assert.ok(renda.next <= '2026-12-15', 'a próxima renda é antes da venda');
    assert.ok(linhas(app.vRecurring()).indexOf(renda.id) > -1, 'e por isso continua na lista');
    assert.equal(app.recAcabouNaVenda(renda), false);
    renda.next = '2027-01-08';
    assert.equal(app.recAcabouNaVenda(renda), true, 'a seguinte já é depois da venda');
    assert.ok(linhas(app.vRecurring()).indexOf(renda.id) < 0);
  });

  test('a ficha do contrato do vendido já não diz «Próxima renda»; a do p1 diz', () => {
    comPlaneados(app);
    app.db.properties.find((p) => p.id === 'p2').vendido = '2026-10-31';
    const texto = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.doesNotMatch(texto(app.ctValoresDaFicha(app.contract('Cp2'))), /Próxima renda/);
    assert.match(texto(app.ctValoresDaFicha(app.contract('Cp1'))), /Próxima renda|Renda em atraso/);
  });

  test('«Desfazer venda» devolve-os à lista', () => {
    comPlaneados(app);
    const p2 = app.db.properties.find((p) => p.id === 'p2');
    p2.vendido = '2026-10-31';
    app.tab = 'recurring';
    app.lf('lrec').p = 'p2';
    assert.deepEqual(linhas(app.vRecurring()), []);
    p2.vendido = '';
    assert.ok(linhas(app.vRecurring()).length >= 3);
  });
});

/* ============================== KAN-127-7 ============================== */

/* Põe o relógio do worker num instante fixo.
   Recebe: iso — 'AAAA-MM-DDTHH:MM:SSZ'.
   Devolve: nada. */
const relogio = (iso) => { const t = Date.parse(iso); mock.method(Date, 'now', () => t); };
const dadosDa = async (env, hid) => JSON.parse((await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(hid).first()).data);
const propor = (env, quem, hid, corpo) => resp(pedir(env, quem, '/api/houses/' + hid + '/proposal', 'POST', corpo));
const linhaDa = (env, hid) => env.DB.prepare('SELECT * FROM share_proposals WHERE house_id = ?').bind(hid).first();

/* A Ana cria H1 e partilha-a com o Bruno: o servidor fecha o período das
   quotas na véspera (a Ana só), com a marca de quem entrou, e a casa fica a
   50/50 (partes iguais).
   Devolve: { env, A, B }. */
async function partilhada() {
  const env = ambiente();
  const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
  await casa(env, A, 'H1', { name: 'T2 Benfica' });
  // a ligação aceite, e a partilha pela rota a sério (a que fecha o período na entrada)
  const cid = await comproprietario(env, A, B, []);
  const r = await resp(pedir(env, A, '/api/connections/' + cid + '/shares', 'PUT', { houseIds: ['H1'] }));
  assert.equal(r.status, 200, 'a partilha passou');
  return { env, A, B };
}

describe('KAN-127-7 · no servidor, quotas iguais às de hoje não são uma proposta', () => {
  test('a partilha a 50/50 «desde sempre»: aplica-se já, sem pedido ao Bruno, e o período da entrada sai', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await partilhada();
    const antes = await dadosDa(env, 'H1');
    assert.ok((antes.quotasHist || []).some((e) => Array.isArray(e.entrada)), 'a entrada fechou o período (ponto de partida)');
    const r = await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 }, desde: 'sempre' });
    assert.equal(r.status, 201);
    assert.equal(r.applied, true, 'não falta o sim de ninguém');
    assert.equal(await linhaDa(env, 'H1'), null, 'nada guardado para confirmar');
    const d = await dadosDa(env, 'H1');
    assert.ok(!(d.quotasHist || []).some((e) => Array.isArray(e.entrada)), '«desde sempre»: o Bruno já era dono');
    const st = await estado(env, B);
    assert.deepEqual(st.proposals, [], 'o Bruno não tem nada a confirmar');
  });

  test('a mesma divisão sem data: nada muda e nada fica por confirmar', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await partilhada();
    const antes = await dadosDa(env, 'H1');
    const r = await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 } });
    assert.equal(r.status, 201);
    assert.equal(r.applied, true);
    assert.equal(await linhaDa(env, 'H1'), null);
    assert.deepEqual((await dadosDa(env, 'H1')).quotasHist, antes.quotasHist, 'o histórico fica como estava');
  });

  test('49,99/50,01 é arredondamento da mesma divisão: também não se pede', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await partilhada();
    const r = await propor(env, A, 'H1', { shares: { [A.id]: 49.99, [B.id]: 50.01 } });
    assert.equal(r.applied, true);
    assert.equal(await linhaDa(env, 'H1'), null);
  });

  test('uma divisão diferente (70/30) continua a pedir o sim do Bruno', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await partilhada();
    const r = await propor(env, A, 'H1', { shares: { [A.id]: 70, [B.id]: 30 }, desde: 'sempre' });
    assert.equal(r.applied, false);
    assert.ok(await linhaDa(env, 'H1'), 'fica à espera');
    assert.equal((await estado(env, B)).proposals.length, 1);
  });

  test('os de fora que mudam são uma mudança, mesmo com as percentagens iguais', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await partilhada();
    const r = await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 }, fora: [{ nome: 'Irmão', quota: 20 }], desde: '2026-11-01' });
    assert.equal(r.applied, false);
    assert.ok(await linhaDa(env, 'H1'));
  });

  test('propor a divisão de hoje por cima de uma proposta pendente desfaz a pendente', async () => {
    relogio('2026-11-17T10:00:00Z');
    const { env, A, B } = await partilhada();
    await propor(env, A, 'H1', { shares: { [A.id]: 70, [B.id]: 30 } });
    assert.ok(await linhaDa(env, 'H1'));
    const r = await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 } });
    assert.equal(r.applied, true);
    assert.equal(await linhaDa(env, 'H1'), null, 'a divisão fica como está, sem pedido');
  });
});

describe('KAN-127-7 · no cliente, uma proposta igual à divisão de hoje não se mostra', () => {
  const app = carregarTudo({ hoje: '2026-11-17' });
  afterEach(() => repor(app));

  /* Uma casa a 50/50 entre mim e o Bruno, com a sessão da nuvem e uma
     proposta pendente com as quotas dadas.
     Recebe: shares — as da proposta.
     Devolve: o imóvel. */
  function casaCom(shares) {
    const db = limpar(app);
    semEcra(app);
    db.owners.push(app.normPerson({ id: 'eu', name: 'Eu' }), app.normPerson({ id: 'b', name: 'Bruno' }));
    const p = app.normProp({ id: 'H1', name: 'T2 Benfica', ownerIds: ['eu', 'b'], ownerShares: { eu: 50, b: 50 }, use: 'investimento' });
    db.properties.push(p);
    app.CW.user = { id: 'eu', name: 'Eu' };
    app.CW.state = { proposals: [{ houseId: 'H1', proposedBy: 'b', proposedByName: 'Bruno', shares, approvals: ['b'], createdAt: 1, desde: 'sempre' }],
      houses: [], connections: [] };
    return p;
  }
  const texto = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  test('imvPropostaSemMudanca: 50/50 → 50/50 é igual; 70/30 não; uma com os de fora a mudar não', () => {
    const p = casaCom({ eu: 50, b: 50 });
    assert.equal(app.imvPropostaSemMudanca(p, { shares: { eu: 50, b: 50 } }), true);
    assert.equal(app.imvPropostaSemMudanca(p, { shares: { eu: 49.99, b: 50.01 } }), true, 'arredondamento');
    assert.equal(app.imvPropostaSemMudanca(p, { shares: { eu: 70, b: 30 } }), false);
    assert.equal(app.imvPropostaSemMudanca(p, { shares: { eu: 50, b: 50 }, fora: [{ nome: 'Irmão', quota: 20 }] }), false);
    assert.equal(app.imvPropostaSemMudanca(p, null), false, 'sem proposta não há nada a dizer');
  });

  test('o cartão das quotas da ficha: com 50/50 → 50/50 nada de «nova divisão proposta»; com 70/30, sim', () => {
    let p = casaCom({ eu: 50, b: 50 });
    const cargo = { dono: true };
    let h = texto(app.imvQuotasCartao(p, cargo));
    assert.doesNotMatch(h, /nova divisão proposta/);
    assert.doesNotMatch(h, /Ver a proposta/);
    p = casaCom({ eu: 70, b: 30 });
    h = texto(app.imvQuotasCartao(p, cargo));
    assert.match(h, /nova divisão proposta/);
  });

  test('as linhas das quotas (a secção dos proprietários) não escrevem «→ 50 %» numa proposta igual', () => {
    const p = casaCom({ eu: 50, b: 50 });
    const h = app.imvQuotasDaProposta(p, ['eu', 'b'], app.CW.state.proposals[0], 'eu');
    assert.doesNotMatch(h, /→/);
    assert.doesNotMatch(texto(h), /para trás/);
  });

  test('o modal das partilhas: a casa a 50/50 com 50/50 → 50/50 oferece «Propor nova divisão», sem confirmar', () => {
    casaCom({ eu: 50, b: 50 });
    app.CW._partilha = { peer: { id: 'b', name: 'Bruno' }, antes: ['H1'], escrito: {}, propor: {}, quando: {}, dia: {} };
    const h = texto(app.quotasDaCasaHtml('H1'));
    assert.doesNotMatch(h, /→/);
    assert.doesNotMatch(h, /Confirmar nova divisão/);
    assert.match(h, /Propor nova divisão/);
  });

  test('o aviso da partilha só conta as propostas que ficaram à espera', () => {
    assert.equal(app.propostasAEspera([{ applied: true }, { applied: false }, null]), 1);
  });
});
