// O imóvel no que a Declaração lê dele: os comproprietários fora da app e a
// minha quota, escritos na ficha (sem nuvem, no formulário; com nuvem, pela
// proposta — «Só eu» grava [], D08); cada mudança das quotas com o dia em que
// começa (D29), e a proposta acertada a 100 antes de ir (D93); sair de uma
// casa diz que ela sai da minha Declaração e oferece o PDF e o CSV do ano;
// o imóvel vendido, com a data, fora das listas do dia a dia e da visão
// geral, e o apagar que avisa das rendas de um ano por entregar e propõe
// marcá-lo vendido (D33); o subarrendamento (D52); o IMI da ficha, que é o
// do prédio todo (D32); e a afetação da caderneta, que decide o AIMI (D71).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar, repor, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarTudo({ hoje: '2026-11-17' });
afterEach(() => repor(app));
const espera = () => new Promise((r) => setTimeout(r, 5));
const el = (id) => app.document.getElementById(id);
const escreve = (id, v) => { el(id).value = v; };

/* Sem nuvem: a Ana sozinha num T2 herdado (v1) e, com `bruno`, o Bruno com
   ela; as janelas numa pilha observável e os avisos guardados.
   Recebe: o (opcional) — {bruno, casa: campos a juntar ao imóvel}.
   Devolve: {abertas, avisos, confirmados} — as janelas, os avisos e as
   confirmações (aceites na hora). */
function local(o) {
  o = o || {};
  limpar(app);
  app.CW.user = null;
  app.db.owners = [app.normPerson({ id: 'ana', name: 'Ana' })];
  if (o.bruno) app.db.owners.push(app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants = [app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' })];
  app.db.properties = [app.normProp(Object.assign({ id: 'v1', name: 'T2 herdado', ownerIds: o.bruno ? ['ana', 'bruno'] : ['ana'],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651' }, o.casa || {}))];
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'syncPropRecs', 'syncAllLoanRecs');
  const avisos = [], confirmados = [];
  app.toast = (m) => { avisos.push(m); };
  app.confirmModal = (t, txt, sim) => { confirmados.push({ t, txt }); if (!o.naoConfirma) sim(); };
  app.comDesfazer = () => {};
  return { abertas, avisos, confirmados };
}

/* Abre o formulário do imóvel com o nome escrito (o DOM do arnês começa vazio).
   Recebe: id — o imóvel.
   Devolve: nada. */
function abrirForm(id) {
  app.propModal(id);
  escreve('p_name', app.prop(id).name);
}

/* As rendas de um contrato num ano, mês a mês (dia 5).
   Recebe: cid — o contrato; pid — o imóvel; ano; valor; meses (1..n).
   Devolve: nada. */
function rendas(cid, pid, ano, valor, meses) {
  for (let m = 1; m <= meses; m++) {
    app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', amount: valor, contractId: cid, propertyId: pid,
      date: ano + '-' + String(m).padStart(2, '0') + '-05', recibo: true }));
  }
}

describe('D08 — os comproprietários fora da app, sem nuvem', () => {
  test('o formulário pergunta se há outros donos fora da app: por confirmar fica null, «Não» grava [], e o irmão a 50 % dá à Ana metade da casa', () => {
    const { abertas } = local();
    abrirForm('v1');
    const html = abertas[0].b;
    assert.match(html, /Há outros donos fora da app\?/);
    assert.match(html, /Por confirmar/);
    app.onSave();
    assert.equal(app.prop('v1').comproprietariosFora, null, 'sem resposta, continua por confirmar');

    abrirForm('v1');
    escreve('p_foraEstado', 'nao');
    app.imvForaMudouNoForm();
    app.onSave();
    igual(app.prop('v1').comproprietariosFora, [], '«Não, mais ninguém» grava []');
    igual(app.prop('v1').quotasHist, [], 'de «por confirmar» a «não há outros» não abre período');

    app.prop('v1').comproprietariosFora = null;
    abrirForm('v1');
    escreve('p_foraEstado', 'sim');
    app.imvForaMudouNoForm();
    assert.match(app.modalBodyEl().innerHTML, /id="p_fn_0"[^>]*placeholder="Ex: Rui Costa"/, 'a linha nova, com o nome e a quota');
    escreve('p_fn_0', '  Irmão ');
    escreve('p_fq_0', '50');
    app.onSave();
    const p = app.prop('v1');
    igual(p.comproprietariosFora.map((f) => [f.nome, f.quota]), [['Irmão', 50]]);
    assert.ok(p.comproprietariosFora[0].id, 'com um id');
    assert.equal(app.quotasFiscais(p, '2026-06-01').ana, 0.5, 'a Ana fica com metade da casa (CIRS art. 19.º)');
    igual(p.quotasHist, [], 'confirmar quem mais é dono não abre período');
  });

  test('a linha dos de fora sem nome, ou com a quota fora de (0, 100), ou a somar 100, não grava e diz porquê no campo', () => {
    const { avisos } = local();
    abrirForm('v1');
    escreve('p_foraEstado', 'sim');
    app.imvForaMudouNoForm();
    escreve('p_fn_0', '');
    escreve('p_fq_0', '30');
    app.onSave();
    assert.equal(avisos.at(-1), 'Escreve o nome de quem é dono.');
    escreve('p_fn_0', 'Irmão');
    escreve('p_fq_0', '100');
    app.onSave();
    assert.equal(avisos.at(-1), 'A quota é uma percentagem entre 0 e 100.');
    escreve('p_fq_0', '60');
    app.imvForaAdicionar('p');
    escreve('p_fn_1', 'Prima');
    escreve('p_fq_1', '40');
    app.onSave();
    assert.equal(avisos.at(-1), 'As quotas de quem está fora da app têm de somar menos de 100 %.');
    assert.equal(app.prop('v1').comproprietariosFora, null, 'nada gravado');
    app.imvForaRemover('p', 1);
    escreve('p_fn_0', 'Irmão');
    escreve('p_fq_0', '60');
    app.onSave();
    assert.equal(app.quotasFiscais(app.prop('v1'), '').ana, 0.4);
  });

  test('a ficha do dono tem o cartão das quotas: os de fora, ou que estão por confirmar, e o caminho para os mudar', () => {
    local();
    let f = app.propFicha('v1');
    assert.match(f, /<h3>Quotas<\/h3>/);
    assert.match(f, /por confirmar/);
    assert.match(f, /data-click="propModal\('v1'\)"/);
    app.prop('v1').comproprietariosFora = [{ id: 'f1', nome: 'Irmão', quota: 50 }];
    f = app.propFicha('v1').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.match(f, /Ana 50%/);
    assert.match(f, /Irmão fora da app 50%/);
  });
});

describe('D93 e D29 — as quotas sem nuvem: somam 100 com os de fora, e mudam com uma data', () => {
  test('25/25 escritos sem mais ninguém não se normalizam em silêncio: o guardar recusa; com a Carla de fora a 50 %, passa', () => {
    const { avisos } = local({ bruno: true });
    abrirForm('v1');
    escreve('p_share_ana', '25');
    escreve('p_share_bruno', '25');
    app.onSave();
    assert.match(avisos.at(-1), /^As quotas somam 50 %, e têm de somar 100 %\./);
    igual(app.prop('v1').ownerShares, {}, 'nada gravado');
    escreve('p_foraEstado', 'sim');
    app.imvForaMudouNoForm();
    escreve('p_share_ana', '25');
    escreve('p_share_bruno', '25');
    escreve('p_fn_0', 'Carla');
    escreve('p_fq_0', '50');
    app.onSave();
    const p = app.prop('v1');
    assert.equal(app.quotasFiscais(p, '').ana, 0.25);
    assert.equal(app.quotasFiscais(p, '').bruno, 0.25);
  });

  test('com os de fora, quem fica em branco leva a sua parte do que sobra (e não a parte das contas)', () => {
    local({ bruno: true });
    abrirForm('v1');
    escreve('p_foraEstado', 'sim');
    app.imvForaMudouNoForm();
    escreve('p_share_ana', '20');
    escreve('p_fn_0', 'Carla');
    escreve('p_fq_0', '50');
    app.onSave();
    escreve('imv_desde', '2026-11-17');
    app.onSave();
    const q = app.quotasFiscais(app.prop('v1'), '');
    assert.ok(Math.abs(q.ana - 0.2) < 1e-9 && Math.abs(q.bruno - 0.3) < 1e-9, JSON.stringify(q));
  });

  test('mudar as quotas de uma casa que já existe pergunta desde quando; 50/50 até 30/6 e 75/25 desde 1/7', () => {
    const { abertas, avisos } = local({ bruno: true, casa: { ownerShares: { ana: 50, bruno: 50 } } });
    abrirForm('v1');
    escreve('p_share_ana', '75');
    escreve('p_share_bruno', '25');
    app.onSave();
    assert.equal(abertas.at(-1).t, 'Desde quando?');
    assert.match(abertas.at(-1).b, /Valem desde <span class="req">\*<\/span><input id="imv_desde" type="date" value="2026-11-17" max="2026-11-17"/);
    igual(app.prop('v1').ownerShares, { ana: 50, bruno: 50 }, 'ainda nada gravado');
    escreve('imv_desde', '2026-12-01');
    app.onSave();
    assert.equal(avisos.at(-1), 'As quotas novas não podem começar depois de hoje.');
    escreve('imv_desde', '2026-07-01');
    app.onSave();
    const p = app.prop('v1');
    igual(p.ownerShares, { ana: 75, bruno: 25 });
    igual(p.quotasHist, [{ ate: '2026-06-30', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, fora: null }]);
    assert.equal(app.quotasFiscais(p, '2026-06-30').ana, 0.5);
    assert.equal(app.quotasFiscais(p, '2026-07-01').ana, 0.75);
    igual(app.quotasMudaramNoAno(p, 2026), ['2026-07-01']);
  });

  test('sem mudar as quotas não pergunta; confirmar os de fora pela primeira vez vale para trás, nos períodos por confirmar', () => {
    const { abertas } = local({ casa: { quotasHist: [{ ate: '2026-03-31', ownerIds: ['ana'], ownerShares: {}, fora: null }] } });
    abrirForm('v1');
    app.onSave();
    assert.equal(abertas.length, 1, 'só o formulário');
    abrirForm('v1');
    escreve('p_foraEstado', 'sim');
    app.imvForaMudouNoForm();
    escreve('p_fn_0', 'Irmão');
    escreve('p_fq_0', '50');
    app.onSave();
    assert.ok(!abertas.some((j) => j.t === 'Desde quando?'));
    const p = app.prop('v1');
    igual(p.quotasHist.map((e) => [e.ate, (e.fora || []).map((f) => f.nome)]), [['2026-03-31', ['Irmão']]]);
    assert.equal(app.quotasFiscais(p, '2026-01-10').ana, 0.5, 'o irmão herdou a meias antes de a Ana o escrever');
  });
});

/* Com nuvem: a Minha (H1) só minha; a Dupla (H2) minha com o Rui a 50/50; a
   Tripla (H3) minha com o Rui e a Ana (50/25/25); a do Rui (H5), onde sou
   comproprietário a 50 %, com rendas de 2026. */
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1, data: { id: 'H1', name: 'Minha' } },
    { id: 'H2', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'RUI'], updatedAt: 1, data: { id: 'H2', name: 'Dupla', ownerShares: { EU: 50, RUI: 50 } } },
    { id: 'H3', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'RUI', 'ANA'], updatedAt: 1, data: { id: 'H3', name: 'Tripla', ownerShares: { EU: 50, RUI: 25, ANA: 25 } } },
    { id: 'H5', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1, data: { id: 'H5', name: 'Do Rui', ownerShares: { RUI: 50, EU: 50 } } },
  ],
  records: [1, 2, 3].map((m) => ({ houseId: 'H5', kind: 'tx', id: 'T' + m, updatedAt: 1,
    data: { id: 'T' + m, kind: 'income', category: 'Rendas', label: 'Renda', amount: 900, date: '2026-0' + m + '-05', propertyId: 'H5' } })),
  userRecords: [],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }, { userId: 'ANA', name: 'Ana', data: null }],
  connections: [], roles: [], collaborators: [], invites: [], people: [], proposals: [],
  shareLink: null, shareRequests: { incoming: [], outgoing: [] },
  sharedGroupRequests: { incoming: [], outgoing: [] }, sharedGroups: [],
});

/* A app com sessão e o estado do servidor, e os espiões.
   Devolve: {abertas, esp} — esp.api as chamadas ({m, p, b}), esp.toasts. */
function nuvem() {
  limpar(app);
  const esp = { api: [], toasts: [], confirmados: [] };
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
  const st = ESTADO();
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  app.api = (m, p, b) => { esp.api.push({ m, p, b: b === undefined ? undefined : JSON.parse(JSON.stringify(b)) }); return Promise.resolve({ ok: true, applied: true }); };
  app.pullNow = () => Promise.resolve();
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'setSyncBadge', 'subirPendentes');
  app.toast = (m) => { esp.toasts.push(m); };
  app.confirmModal = (t, txt) => { esp.confirmados.push({ t, txt }); };
  app.nextShareProposal = () => {};
  return { abertas, esp };
}

describe('D08, D29 e D93 com nuvem — a proposta leva os de fora, a data e as percentagens acertadas', () => {
  test('num imóvel só meu, as quotas abrem-se na mesma: o irmão a 50 % vai na proposta, sem data (confirmar vale para trás)', async () => {
    const { abertas, esp } = nuvem();
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('H1'))));
    const bloco = app.cwOwnersBlock();
    assert.match(bloco, /Este imóvel é só teu na app\./);
    assert.match(bloco, /Há outros donos fora da app\?/);
    assert.match(bloco, /data-click="CW\.proposeShares\('H1'\)"/);
    app.CW.proposeShares('H1');
    assert.equal(abertas.length, 1, 'com um dono só, a janela abre');
    assert.match(abertas[0].b, /Há outros donos fora da app\?/);
    escreve('cwq_foraEstado', 'sim');
    app.imvForaMudouNaProposta();
    escreve('cwq_fn_0', 'Irmão');
    escreve('cwq_fq_0', '50');
    app.onSave();
    await espera();
    igual(esp.api, [{ m: 'POST', p: '/api/houses/H1/proposal', b: { shares: { EU: 100 }, fora: [{ nome: 'Irmão', quota: 50 }] } }]);
    assert.equal(esp.toasts.at(-1), 'Quotas guardadas.');
  });

  test('«Não, mais ninguém» envia [] (o «Só eu»), sem data', async () => {
    const { esp } = nuvem();
    app.CW.proposeShares('H1');
    escreve('cwq_foraEstado', 'nao');
    app.imvForaMudouNaProposta();
    app.onSave();
    await espera();
    igual(esp.api.map((x) => x.b), [{ shares: { EU: 100 }, fora: [] }]);
  });

  test('mudar as percentagens entre as contas leva o dia em que começam; depois de hoje não vai', async () => {
    const { abertas, esp } = nuvem();
    app.CW.proposeShares('H2');
    assert.equal(abertas[0].t, 'Propor nova divisão');
    assert.match(abertas[0].b, /<input id="cwq_desde" type="date" value="2026-11-17" max="2026-11-17"/);
    escreve('cw_pp_EU', '75');
    escreve('cw_pp_RUI', '25');
    escreve('cwq_desde', '2026-12-01');
    app.onSave();
    await espera();
    igual(esp.api, [], 'depois de hoje não se envia');
    assert.equal(esp.toasts.at(-1), 'As quotas novas não podem começar depois de hoje.');
    escreve('cwq_desde', '2026-07-01');
    app.onSave();
    await espera();
    igual(esp.api.map((x) => x.b), [{ shares: { EU: 75, RUI: 25 }, desde: '2026-07-01' }]);
  });

  test('50 / 49,6 não vai, e diz quanto somam; 33,33 × 3 acerta a última e soma 100', async () => {
    const { esp } = nuvem();
    app.CW.proposeShares('H2');
    escreve('cw_pp_EU', '50');
    escreve('cw_pp_RUI', '49,6');
    escreve('cwq_desde', '2026-11-17');
    app.onSave();
    await espera();
    igual(esp.api, []);
    assert.equal(esp.toasts.at(-1), 'As percentagens têm de somar 100 (agora somam 99,6).');
    app.closeAllModals();
    app.CW.proposeShares('H3');
    for (const u of ['EU', 'RUI', 'ANA']) escreve('cw_pp_' + u, '33,33');
    escreve('cwq_desde', '2026-11-17');
    app.onSave();
    await espera();
    igual(esp.api.map((x) => x.b.shares), [{ EU: 33.33, RUI: 33.33, ANA: 33.34 }]);
  });

  test('com várias contas, as percentagens escrevem-se sobre a casa toda e os de fora abatem: 25/25 e a Carla a 50 % dão 50/50 entre as contas', async () => {
    const { esp } = nuvem();
    app.CW.proposeShares('H2');
    escreve('cw_pp_EU', '25');
    escreve('cw_pp_RUI', '25');
    escreve('cwq_foraEstado', 'sim');
    app.imvForaMudouNaProposta();
    escreve('cw_pp_EU', '25');
    escreve('cw_pp_RUI', '25');
    escreve('cwq_fn_0', 'Carla');
    escreve('cwq_fq_0', '50');
    escreve('cwq_desde', '2026-01-01');
    app.onSave();
    await espera();
    // entre as contas fica 50/50, como estava: só se confirma quem mais é dono, e isso vale para trás (sem dia)
    igual(esp.api.map((x) => x.b), [{ shares: { EU: 50, RUI: 50 }, fora: [{ nome: 'Carla', quota: 50 }] }]);
    // a Carla já confirmada, e as contas a mudar: aí vai o dia
    app.prop('H2').comproprietariosFora = [{ id: 'c1', nome: 'Carla', quota: 50 }];
    app.CW.proposeShares('H2');
    escreve('cw_pp_EU', '30');
    escreve('cw_pp_RUI', '20');
    escreve('cwq_fn_0', 'Carla');
    escreve('cwq_fq_0', '50');
    escreve('cwq_desde', '2026-01-01');
    app.onSave();
    await espera();
    igual(esp.api.at(-1).b, { shares: { EU: 60, RUI: 40 }, desde: '2026-01-01' });
  });

  test('a proposta pendente mostra os de fora e a data a quem a confirma', () => {
    nuvem();
    app.CW.state.proposals = [{ houseId: 'H2', proposedBy: 'RUI', proposedByName: 'Rui', shares: { EU: 50, RUI: 50 }, approvals: ['RUI'],
      fora: [{ id: 'x', nome: 'Carla', quota: 20 }], desde: '2026-07-01' }];
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('H2'))));
    const bloco = app.cwOwnersBlock().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.match(bloco, /Carla .*fora da app .*20%/);
    assert.match(bloco, /Valem desde 01\/07\/2026/);
    assert.match(bloco, /Eu \(tu\) 50% → 40%/);
  });

  test('sair de uma casa em compropriedade diz que ela sai da minha Declaração e oferece o PDF e o CSV do ano por entregar', () => {
    const { esp } = nuvem();
    app.delProp('H5');
    const txt = esp.confirmados[0].txt;
    assert.match(txt, /deixa de entrar na tua Declaração do IRS/);
    assert.match(txt, /data-click="imvExportarAno\('pdf',2026\)"/);
    assert.match(txt, /data-click="imvExportarAno\('csv',2026\)"/);
    assert.match(txt, /As quotas de antes ficam guardadas até ontem/);
    assert.doesNotMatch(txt, /também nos movimentos já registados\. O que/);
  });
});

describe('D33 — o imóvel vendido', () => {
  /* O cenário do Anexo A (s02): dois imóveis da Ana; o T1 Benfica vendido em
     junho de 2026, com rendas de 500 € de janeiro a junho e o IMI de 300 €. */
  function s02(o) {
    const r = local(o);
    app.db.properties.push(app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['ana'], freguesiaCodigo: '110624', tipoPredio: 'U', matrix: '999' }));
    app.db.contracts.push(
      app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 800, start: '2024-01-01', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } }),
      app.normContract({ id: 'C2', name: 'Benfica', propertyId: 'v2', tenantIds: ['t1'], rent: 500, start: '2023-01-01', end: '2026-06-30', active: false, fisco: { estado: 'declarado', numero: '2', finalidade: 'hp' } }));
    rendas('C1', 'v1', 2026, 800, 11);
    rendas('C2', 'v2', 2026, 500, 6);
    rendas('C2', 'v2', 2025, 500, 12);
    app.db.transactions.push(app.normTx({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, propertyId: 'v2', date: '2026-05-10' }));
    return r;
  }

  test('apagar um imóvel com rendas de um ano por entregar avisa, com o valor, e propõe marcá-lo vendido', () => {
    const { confirmados } = s02({ naoConfirma: true });
    app.delProp('v2');
    const txt = confirmados[0].txt;
    assert.equal(confirmados[0].t, 'Apagar imóvel');
    assert.ok(txt.includes('As rendas de 2026 deste imóvel (' + app.euro2(3000) + ') deixam de entrar na Declaração do IRS'), txt);
    assert.doesNotMatch(txt, /2025/, 'a Declaração de 2025 já se entregou (até 30 de junho)');
    assert.match(txt, /data-click="closeModal\(\);imvVendidoModal\('v2'\)">Marcar como vendido</);
    assert.ok(app.prop('v2'), 'sem o sim, nada sai');
  });

  test('os anos por entregar: o corrente, e o anterior até ao fim da entrega', () => {
    igual(app.imvAnosPorEntregar('2026-05-10'), [2025, 2026]);
    igual(app.imvAnosPorEntregar('2026-06-30'), [2025, 2026]);
    igual(app.imvAnosPorEntregar('2026-07-01'), [2026]);
  });

  test('marcar como vendido grava a data, e as rendas e o IMI ficam na Declaração dos anos em que foi da Ana', () => {
    const { abertas, avisos } = s02();
    const antes = app.resumoFiscal(2026, 'ana');
    assert.ok(app.imvMenuDaFicha('v2').some((x) => x.label === 'Marcar como vendido' && x.act === "imvVendidoModal('v2')"));
    app.imvVendidoModal('v2');
    assert.equal(abertas[0].t, 'Marcar como vendido');
    assert.match(abertas[0].b, /Data da venda <span class="req">\*<\/span><input id="imv_vendido" type="date" value="2026-11-17"/);
    escreve('imv_vendido', '');
    app.onSave();
    assert.equal(avisos.at(-1), 'Escolhe o dia da venda.');
    escreve('imv_vendido', '2026-06-30');
    app.onSave();
    assert.equal(app.prop('v2').vendido, '2026-06-30');
    assert.equal(avisos.at(-1), 'Imóvel marcado como vendido.');
    const depois = app.resumoFiscal(2026, 'ana');
    assert.equal(depois.totais.rendas, antes.totais.rendas, 'as rendas ficam: ' + antes.totais.rendas);
    assert.equal(depois.linhas.length, antes.linhas.length);
    assert.equal(app.resumoFiscal(2025, 'ana').totais.rendas, 6000);
    // o ⋯ passa a desfazer, e desfazer devolve-o às listas
    const it = app.imvMenuDaFicha('v2');
    assert.ok(it.some((x) => x.label === 'Desfazer venda') && !it.some((x) => x.label === 'Marcar como vendido'));
    app.imvDesfazerVenda('v2');
    assert.equal(app.prop('v2').vendido, '');
  });

  test('a lista dos Imóveis esconde os vendidos, com o filtro «Vendidos · N»; a ficha diz o dia da venda', () => {
    s02();
    app.prop('v2').vendido = '2026-06-30';
    app.tab = 'properties';
    let lista = app.vProperties();
    assert.ok(!lista.includes("propView('v2')"), 'o vendido não está na lista do dia a dia');
    assert.ok(lista.includes("propView('v1')"));
    assert.match(lista, /Vendidos · 1/);
    app.lf('lprops').vd = 'v';
    lista = app.vProperties();
    assert.ok(lista.includes("propView('v2')") && !lista.includes("propView('v1')"), 'o filtro mostra só os vendidos');
    assert.match(lista, /Vendido a 30\/06\/2026/);
    const ficha = app.propFicha('v2');
    assert.match(ficha, /Vendido a 30\/06\/2026/);
    assert.ok(!ficha.includes("ctModal(null,'v2')"), 'um vendido não ganha contratos novos');
    assert.ok(app.propFicha('v1').includes("ctModal(null,'v1')"));
  });

  test('a visão geral não conta o vendido no portefólio; um sem venda fica igual', () => {
    s02();
    Object.assign(app.prop('v1'), { value: 200000, purchase: 150000 });
    Object.assign(app.prop('v2'), { value: 120000, purchase: 90000, vendido: '2026-06-30' });
    const m = app.dashSemVendidos(app.metrics(2026, null, { share: true }));
    igual(m.props.map((p) => p.id), ['v1']);
    assert.equal(m.value, 200000);
    assert.equal(m.purchase, 150000);
    assert.equal(m.gain, 50000);
    app.prop('v2').vendido = '2027-01-10';
    assert.equal(app.dashSemVendidos(app.metrics(2026, null, { share: true })).props.length, 2, 'a venda marcada para depois ainda não conta');
  });

  test('apagar vários na seleção também avisa das rendas por entregar e propõe marcar cada um vendido', () => {
    const { confirmados } = s02({ naoConfirma: true });
    app.CW.selL = { tipo: 'prop', ids: { v1: 1, v2: 1 } };
    app.CW.selLApagar();
    const txt = confirmados[0].txt;
    assert.equal(confirmados[0].t, 'Apagar 2 imóveis');
    assert.ok(txt.includes('As rendas de 2026 de «T2 herdado» (' + app.euro2(8800) + ') e de «T1 Benfica» (' + app.euro2(3000) + ') deixam de entrar na Declaração do IRS'), txt);
    assert.match(txt, /data-click="closeModal\(\);CW\.selLSair\(\);imvVendidoModal\('v2'\)">Marcar «T1 Benfica» como vendido</);
    assert.ok(app.prop('v2') && app.prop('v1'), 'sem o sim, nada sai');
    // um só marcado: a frase do apagar de um
    confirmados.length = 0;
    app.CW.selL = { tipo: 'prop', ids: { v2: 1 } };
    app.CW.selLApagar();
    assert.ok(confirmados[0].txt.includes('As rendas de 2026 deste imóvel (' + app.euro2(3000) + ')'));
  });

  test('o seletor das análises deixa de fora os vendidos antes do período, menos o escolhido', () => {
    s02();
    const ids = (ops) => ops.filter((o) => !o.div && o.v && !String(o.v).startsWith('g:')).map((o) => o.v);
    app.prop('v2').vendido = '2025-06-30';
    igual(ids(app.anaOpcoesImovel()), ['v1'], 'vendido antes deste ano: fora');
    igual(ids(app.anaOpcoesImovel('v2')), ['v1', 'v2'], 'o escolhido fica sempre');
    igual(ids(app.anaOpcoesImovel('', '2025-01-01')), ['v1', 'v2'], 'num período que o apanha, entra');
    app.prop('v2').vendido = '2026-06-30';
    igual(ids(app.anaOpcoesImovel()), ['v1', 'v2'], 'vendido este ano: ainda entra');
    app.prop('v2').vendido = '2025-06-30';
    igual(ids(app.dashOpcoesImovel()), ['v1'], 'e a Visão geral também');
  });

  test('um movimento de «Todos os imóveis» não se reparte por um imóvel vendido antes da data dele', () => {
    s02();
    app.prop('v2').vendido = '2026-06-30';
    igual(app.imoveisDeTodos('2026-07-05').map((p) => p.id), ['v1']);
    igual(app.imoveisDeTodos('2026-06-30').map((p) => p.id), ['v1', 'v2'], 'no dia da venda ainda era dela');
    igual(app.imoveisDeTodos('2026-03-01').map((p) => p.id), ['v1', 'v2']);
    igual(app.imoveisDeTodos().map((p) => p.id), ['v1'], 'sem data (um planeado), os vendidos até hoje ficam de fora');
  });
});

describe('D100 — o cashflow das Projeções diz que o IRS é sobre a renda bruta', () => {
  test('o «porquê» do cashflow do último ano diz que o IMI, o condomínio e as obras baixam o IRS na declaração', () => {
    assert.match(app.WHY.cashflowFim, /IRS sobre as rendas brutas, à taxa de cada contrato: o IMI, o condomínio e as obras baixam-no na declaração, e aqui não se descontam\./);
    assert.match(app.WHY.cashflowFim, /pague no ano seguinte/);
  });
});

describe('D52, D32 e D71 — o subarrendamento, o IMI do prédio e a afetação', () => {
  test('«Arrendo este imóvel e subarrendo-o» pede o NIF do senhorio e a renda paga, e grava-os', () => {
    const { abertas, avisos } = local();
    abrirForm('v1');
    assert.match(abertas[0].b, /Arrendo este imóvel e subarrendo-o/);
    assert.doesNotMatch(abertas[0].b, /p_sub_nif/, 'desligado, sem os campos');
    el('p_sub_ativo').checked = true;
    app.imvSubMudou();
    const html = app.modalBodyEl().innerHTML;
    assert.match(html, /NIF do senhorio <span class="req">\*<\/span><input id="p_sub_nif"[^>]*placeholder="Ex: 123456789"/);
    assert.match(html, /Renda que pagas \(€\/mês\) <span class="req">\*<\/span><input id="p_sub_renda"/);
    escreve('p_name', 'T2 herdado');
    escreve('p_sub_nif', '12345');
    app.onSave();
    assert.equal(avisos.at(-1), 'Escreve o NIF do senhorio (9 algarismos).');
    escreve('p_sub_nif', '123456789');
    escreve('p_sub_renda', '');
    app.onSave();
    assert.equal(avisos.at(-1), 'Escreve a renda que pagas ao senhorio.');
    escreve('p_sub_renda', '600');
    app.onSave();
    igual(app.prop('v1').subarrendamento, { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 });
  });

  test('o IMI da ficha diz que é o do prédio todo, a soma das notas de todos', () => {
    const { abertas } = local();
    abrirForm('v1');
    assert.match(abertas[0].b, /IMI do prédio \(€\/ano\)<input id="p_imi"/);
    assert.match(abertas[0].b, /O IMI é o do prédio todo: havendo mais donos, a soma das notas de todos\./);
  });

  test('a afetação da caderneta escolhe-se no formulário, grava-se e lê-se na ficha', () => {
    const { abertas } = local();
    abrirForm('v1');
    assert.match(abertas[0].b, /Afetação \(da caderneta\)<div class="sel" id="sel_p_afetacao">/);
    escreve('p_afetacao', 'comercio');
    app.onSave();
    assert.equal(app.prop('v1').afetacao, 'comercio');
    assert.match(app.propFicha('v1'), /afetação: comércio/);
  });
});
