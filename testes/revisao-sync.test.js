// O fio entre o cliente e o servidor quando um serviço está
// desligado: o que o applyState faz à lista e ao separador, o que o
// exportEntities e o retrato (snap) fazem aos kinds desligados, o que o
// pushNow faz a um 403 «O serviço X está desligado nesta conta.», o que
// acontece a um registo criado localmente apanhado pelo desligar, o que
// volta ao religar, a navegação (restorePage, go pela barra de baixo) e, do
// lado do servidor, os serviços de um colaborador contra os do dono.
//
// A nuvem carrega-se inteira (carregarTudo) com o fetch trocado por um
// espião que responde o que cada teste manda; o servidor corre contra a D1
// de teste (testes/lib/bd.js), com as armações de testes/lib/api.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { carregarTudo, igual } from './arnes.js';
import { ambiente, conta, estado, sync, casa, registo, cargo, darCargo, desligar, ligarTudo } from './lib/api.js';
import { FRASE_DESLIGADO } from '../worker/src/lib/servicos.js';
import { CARGOS_EXEMPLO } from '../worker/src/lib/permissoes.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

/* ------------------------------------------------ o cliente, com a nuvem */

/* A app inteira com a nuvem por cima, e os espiões: o fetch responde o que
   esp.responde disser (por omissão, tudo ok), o toast e o selo guardam-se,
   o render e o buildNav não pintam, e há sessão (CW.user).
   Devolve: {app, esp}. */
function montar() {
  const app = carregarTudo();
  const esp = { pedidos: [], toasts: [], selos: [], deslizes: 0, responde: null };
  const tudoOk = (m, url, body) => (url === '/api/sync'
    ? { status: 200, json: { results: ((body || {}).ops || []).map(() => ({ ok: true })) } }
    : { status: 200, json: {} });
  app.fetch = (url, opts) => {
    opts = opts || {};
    const body = opts.body ? JSON.parse(opts.body) : null;
    esp.pedidos.push({ method: opts.method || 'GET', url, body });
    const r = (esp.responde || tudoOk)(opts.method || 'GET', url, body);
    return Promise.resolve({ ok: r.status < 400, status: r.status, json: () => Promise.resolve(r.json) });
  };
  app.toast = (m) => { esp.toasts.push(String(m)); };
  app.setSyncBadge = (s) => { esp.selos.push(s); };
  app.render = () => {};
  app.buildNav = () => {};
  app.subirPendentes = () => {};
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt', token: 't' };
  return { app, esp };
}

// As operações que seguiram para /api/sync, por ordem.
const opsDe = (esp) => esp.pedidos.filter((p) => p.url === '/api/sync').flatMap((p) => (p.body || {}).ops || []);

// Um servidor que recusa, com a frase do serviço, as operações de um kind.
const recusaKind = (app, kind, servico) => (m, url, body) => (url === '/api/sync'
  ? { status: 200, json: { results: body.ops.map((o) => (o.kind === kind
      ? { ok: false, status: 403, error: app.hintServicoDesligado(servico) } : { ok: true })) } }
  : { status: 200, json: {} });

// Aplica um estado e desarma o push que o applyState agenda (os testes
// chamam pushNow à mão, para verem o que sai).
function aplicar(app, st) {
  app.applyState(st);
  app.clearTimeout(app.pushTimer);
}

const CONTRATO = () => ({ houseId: 'H1', kind: 'contract', id: 'C1', updatedAt: 1, author: 'EU', createdBy: 'EU',
  data: { id: 'C1', name: 'Contrato T2', propertyId: 'H1', rent: 500, start: '2026-01-01', tenantIds: [] } });
const MOVIMENTO = () => ({ houseId: 'H1', kind: 'tx', id: 'T1', updatedAt: 1, author: 'EU', createdBy: 'EU',
  data: { id: 'T1', propertyId: 'H1', label: 'Renda', amount: 500, kind: 'income', date: '2026-01-05' } });

/* O estado de GET /api/state de uma conta com uma casa (H1), um contrato
   (C1) e um movimento (T1), e os dois dados globais da base (perfil e
   definições) — com estes dois no estado, depois do applyState não há nada
   por enviar. `o.desligados` é a lista; `o.semContrato`/`o.semTx` tiram os
   registos, como o servidor faz com o serviço desligado.
   Devolve: o estado (objeto novo). */
function ESTADO(o) {
  o = o || {};
  const records = [];
  if (!o.semContrato) records.push(CONTRATO());
  if (!o.semTx) records.push(MOVIMENTO());
  return {
    me: { id: 'EU', email: 'eu@x.pt', name: 'Eu' },
    servicos: { desligados: o.desligados || [] },
    profiles: [{ userId: 'EU', name: 'Eu', data: { id: 'EU', name: 'Eu' } }],
    people: [{ id: 'EU', name: 'Eu', kind: 'owner' }],
    proposals: [],
    houses: [{ id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], collaborators: [], updatedAt: 1,
      data: { id: 'H1', name: 'T2 Lisboa', rooms: [] } }],
    records,
    userRecords: [
      { kind: 'settings', id: 'main', updatedAt: 1, data: {} },
      { kind: 'profile', id: 'main', updatedAt: 1, data: { id: 'EU', name: 'Eu' } },
    ],
    roles: [], collaborators: [], invites: [], shareLink: null,
    shareRequests: { incoming: [], outgoing: [] }, connections: [],
  };
}

const chavesDe = (app) => Object.keys(JSON.parse(JSON.stringify(app.exportEntities())));
const retrato = (app) => JSON.parse(JSON.stringify(app.snap));

describe('o estado aplicado no cliente (applyState) com serviços desligados', () => {
  test('applyState com servicos.desligados guarda a lista no aparelho e muda para o primeiro separador ligado; sem o campo, liga tudo', () => {
    const { app } = montar();
    app.tab = 'contracts';
    aplicar(app, ESTADO({ desligados: ['contracts'], semContrato: true }));
    igual(app.servicosDesligados(), ['contracts']);
    assert.equal(app.localStorage.getItem('gi_servicos_off'), '["contracts"]');
    assert.equal(app.tab, 'dashboard', 'o separador desligado dá lugar ao primeiro que abre');
    assert.equal(app.setPage, '');
    // um separador ligado fica onde está
    app.tab = 'transactions';
    aplicar(app, ESTADO({ desligados: ['contracts'], semContrato: true }));
    assert.equal(app.tab, 'transactions');
    // o fecho aplica-se também no cliente: sem Imóveis caem os que os requerem
    aplicar(app, ESTADO({ desligados: ['properties'], semContrato: true, semTx: true }));
    igual(app.servicosDesligados(), ['properties', 'contracts', 'visits', 'colaboradores', 'credits']);
    // um estado SEM o campo servicos volta a ligar tudo
    const st = ESTADO();
    delete st.servicos;
    aplicar(app, st);
    igual(app.servicosDesligados(), []);
    assert.equal(app.localStorage.getItem('gi_servicos_off'), '[]');
    assert.ok(app.servicoLigado('contracts') && app.separadorLigado('contracts'));
  });

  test('com Contratos desligado, exportEntities não produz chaves de contratos, o retrato não marca nada obsoleto e o push não tem nada para enviar', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO({ desligados: ['contracts'], semContrato: true }));
    assert.equal(app.db.contracts.length, 0, 'o db é refeito só com o que o servidor mandou');
    const chaves = chavesDe(app);
    assert.ok(!chaves.some((k) => /:contract:/.test(k)), 'nenhuma chave r:*:contract:*: ' + chaves.join(' '));
    const snap = retrato(app);
    assert.deepEqual(Object.keys(snap).sort(), ['h:H1', 'r:H1:tx:T1', 'u:profile:main', 'u:settings:main']);
    assert.ok(!Object.values(snap).includes('__obsoleto__'), 'nada fica marcado para apagar por causa do serviço');
    await app.pushNow();
    assert.equal(esp.pedidos.filter((p) => p.url === '/api/sync').length, 0, 'nada para enviar: nenhum POST /api/sync');
  });

  test('ligar de novo: o estado traz o contrato de volta, rebuildDb não duplica, e o retrato fica coerente (nada obsoleto, nada por enviar)', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    assert.ok('r:H1:contract:C1' in retrato(app), 'com tudo ligado o contrato está no retrato');
    aplicar(app, ESTADO({ desligados: ['contracts'], semContrato: true }));
    assert.equal(app.db.contracts.length, 0);
    assert.ok(!('r:H1:contract:C1' in retrato(app)), 'desligado, o retrato esquece-o — sem o marcar para apagar');
    // o suporte liga de novo: o contrato, que sempre esteve no servidor, volta
    aplicar(app, ESTADO());
    aplicar(app, ESTADO());   // e um segundo estado igual não o duplica
    assert.equal(app.db.contracts.filter((c) => c.id === 'C1').length, 1);
    assert.equal(app.db.contracts.length, 1);
    assert.ok(app.servicoLigado('contracts'));
    const snap = retrato(app);
    // o retrato guarda o resumo do JSON (nucleo.js:resumoDeTexto), não o JSON
    assert.equal(snap['r:H1:contract:C1'], app.resumoDeTexto(JSON.stringify(JSON.parse(JSON.stringify(app.exportEntities()['r:H1:contract:C1'].data)))));
    assert.ok(!Object.values(snap).includes('__obsoleto__'));
    await app.pushNow();
    assert.equal(opsDe(esp).length, 0, 'nada por enviar depois de religar');
  });
});

describe('um registo local apanhado pelo desligar', () => {
  // revisão dos serviços, A.3-1
  test('um put de dados globais recusado com 403 por serviço desligado não volta a ser enviado no push seguinte, e a pessoa é avisada', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    app.db.transactions.push(app.normTx({ id: 'T9', label: 'Café', amount: 3, kind: 'expense', date: '2026-02-01' }));
    esp.responde = recusaKind(app, 'tx', 'transactions');
    await app.pushNow();
    assert.ok(opsDe(esp).some((o) => o.kind === 'tx' && o.id === 'T9'), 'a primeira tentativa é legítima: o cliente ainda não sabia');
    esp.pedidos.length = 0;
    await app.pushNow();
    assert.equal(opsDe(esp).filter((o) => o.kind === 'tx' && o.id === 'T9').length, 0, 'depois do 403 do serviço não se reenvia');
    assert.ok(esp.toasts.some((t) => /desligad/i.test(t)), 'e diz-se que o serviço está desligado: ' + esp.toasts.join(' | '));
    assert.notEqual(esp.selos[esp.selos.length - 1], 'off', 'o selo não finge falta de rede');
  });

  // revisão dos serviços, A.3-1
  test('com o serviço já desligado nesta conta, exportEntities não tenta subir os kinds dele (kindDesligado existe para isto e ninguém o usa)', () => {
    const { app } = montar();
    aplicar(app, ESTADO({ desligados: ['transactions'], semTx: true }));
    assert.ok(app.kindDesligado('tx') && app.kindDesligado('tx', 'user') && app.kindDesligado('rec') && app.kindDesligado('tpl', 'user'));
    // uma cópia reposta, ou o que ficou de uma sessão offline, traz movimentos do imóvel e avulsos
    app.db.transactions.push(app.normTx({ id: 'T8', propertyId: 'H1', label: 'Condomínio', amount: 40, kind: 'expense', date: '2026-02-01' }));
    app.db.transactions.push(app.normTx({ id: 'T9', label: 'Café', amount: 3, kind: 'expense', date: '2026-02-01' }));
    const chaves = chavesDe(app);
    assert.ok(!chaves.some((k) => /:tx:/.test(k)), 'nenhuma chave de um kind desligado sobe: ' + chaves.join(' '));
  });

  // revisão dos serviços, A.3-2
  test('um contrato recusado com 403 por serviço desligado não é dado como «sem permissão neste imóvel»', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    app.db.contracts.push(app.normContract({ id: 'C2', name: 'Novo', propertyId: 'H1', rent: 600, start: '2026-03-01' }));
    esp.responde = recusaKind(app, 'contract', 'contracts');
    await app.pushNow();
    assert.ok(esp.toasts.length, 'avisa');
    assert.ok(esp.toasts.every((t) => !/sem permissão neste imóvel/.test(t)), 'sem culpar as permissões: ' + esp.toasts.join(' | '));
    assert.ok(esp.toasts.some((t) => /desligad/i.test(t)), 'a razão é o serviço: ' + esp.toasts.join(' | '));
  });

  // revisão dos serviços, A.3-4
  test('um del recusado com 403 por serviço desligado não passa por feito — a pessoa fica a saber que o registo continua no servidor', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());   // C1 no db e no retrato
    app.db.contracts = app.db.contracts.filter((c) => c.id !== 'C1');   // apaguei-o, na janela antes de o desligar chegar
    esp.responde = recusaKind(app, 'contract', 'contracts');
    await app.pushNow();
    assert.ok(opsDe(esp).some((o) => o.op === 'del' && o.kind === 'contract' && o.id === 'C1'), 'a remoção seguiu');
    assert.ok(esp.toasts.some((t) => /desligad/i.test(t)) || esp.selos[esp.selos.length - 1] !== 'ok',
      'não se diz «Guardado» a uma remoção que o servidor recusou: selos ' + esp.selos.join(',') + '; toasts ' + esp.toasts.join(' | '));
  });
});

describe('os planeados automáticos com Contratos desligado e Planeados ligado', () => {
  // revisão dos serviços, A.3-3
  test('os planeados automáticos das rendas não são tomados por órfãos nem apagados no servidor quando os contratos só não vieram', async () => {
    const { app, esp } = montar();
    const st = ESTADO({ desligados: ['contracts'], semContrato: true });
    st.records.push({ houseId: 'H1', kind: 'rec', id: 'R1', updatedAt: 1, author: 'EU', createdBy: 'EU',
      data: { id: 'R1', auto: true, name: 'Renda T2', autoName: 'Renda T2', every: 'month', next: '2026-03-05', until: '', end: '',
        tx: { propertyId: 'H1', contractId: 'C1', label: 'Renda T2', amount: 500, kind: 'income' } } });
    aplicar(app, st);
    assert.ok(app.db.recurring.some((r) => r.id === 'R1'), 'o planeado veio no estado (os Planeados estão ligados)');
    assert.ok(app.servicoLigado('recurring') && !app.servicoLigado('contracts'));
    // o que derivarDoArranque (web/app/arranque.js) faz em cada arranque com os Planeados ligados
    app.syncAllContractRecs();
    assert.ok(app.db.recurring.some((r) => r.id === 'R1'), 'o planeado fica: o contrato existe, só não veio');
    await app.pushNow();
    assert.ok(!opsDe(esp).some((o) => o.op === 'del' && o.kind === 'rec'), 'e nada se apaga no servidor');
  });
});

describe('a navegação com um separador desligado', () => {
  test('restorePage não restaura um separador desligado: fica no painel; ligado, restaura', () => {
    const { app } = montar();
    app.localStorage.setItem('gi_page', JSON.stringify({ tab: 'contracts', set: '' }));
    app.definirServicosDesligados(['contracts']);
    app.tab = 'dashboard';
    app.restorePage();
    assert.equal(app.tab, 'dashboard');
    app.definirServicosDesligados([]);
    app.restorePage();
    assert.equal(app.tab, 'contracts');
  });

  test('go para um separador desligado vindo da barra de baixo (_ladoSep) fica onde está, sem deslizar, e diz porquê', () => {
    const { app, esp } = montar();
    app.deslizarPainel = (pintar) => { esp.deslizes++; pintar(); };
    app.definirServicosDesligados(['properties']);   // os Imóveis estão na barra de baixo
    app.tab = 'dashboard';
    app.goBarra('properties');
    assert.equal(app.tab, 'dashboard', 'fica');
    assert.equal(esp.deslizes, 0, 'sem deslizar');
    assert.equal(app._ladoSep, 0, 'o lado não fica armado para o toque seguinte');
    assert.deepEqual(esp.toasts, ['O serviço Imóveis está desligado nesta conta.']);
    // o mesmo pelo menu (sem lado)
    app.go('properties');
    assert.equal(app.tab, 'dashboard');
    assert.equal(esp.toasts.length, 2);
    // controlo positivo: ligado, a barra desliza e chega
    app.definirServicosDesligados([]);
    app.goBarra('properties');
    assert.equal(app.tab, 'properties');
    assert.equal(esp.deslizes, 1);
  });

  // revisão dos serviços, A.3-5
  test('acabar a sessão limpa a lista de serviços desligados do aparelho — quem entra a seguir não herda os separadores escondidos', () => {
    const { app } = montar();
    app.definirServicosDesligados(['contracts']);
    assert.ok(!app.servicoLigado('contracts'));
    app.sessionLost();
    assert.equal(app.CW.user, null);
    igual(app.servicosDesligados(), [], 'sem sessão está tudo ligado, como o catálogo promete');
    assert.ok(app.servicoLigado('contracts'));
    assert.ok(!app.localStorage.getItem('gi_servicos_off') || app.localStorage.getItem('gi_servicos_off') === '[]');
  });
});

/* -------------------------------------------------------- o servidor */

// as armações de todos os testes do servidor vêm de testes/lib/api.js
const kinds = (lista) => lista.map((r) => r.kind).sort();

/* D é dono de H1, com um contrato, um movimento e um inquilino; C é
   Contabilista em H1 (vê contratos, movimentos e planeados; adiciona
   movimentos). Tudo ligado — cada teste desliga o que quer. */
async function donoEColaborador() {
  const env = ambiente();
  const D = await conta(env, 'Dono');
  const C = await conta(env, 'Colab');
  await casa(env, D, 'H1', { name: 'T2 Lisboa' });
  await registo(env, 'H1', 'contract', 'c1', { name: 'Contrato', tenantIds: ['t1'] }, D);
  await registo(env, 'H1', 'tenant', 't1', { name: 'Inês' }, D);
  await registo(env, 'H1', 'tx', 'x1', { label: 'Renda', amount: 500, paidBy: D.id }, D);
  const contab = await cargo(env, D, 'Contabilista', CARGOS_EXEMPLO[1].perms, 'R_CON');
  await darCargo(env, D, C, contab, ['H1']);
  return { env, D, C };
}

describe('o servidor: os serviços são da conta de quem lê e de quem escreve, não de quem é dono dos dados', () => {
  test('estado: um colaborador com Contratos desligado não recebe os contratos das casas do dono, e o dono continua a vê-los; o inverso também', async () => {
    const { env, D, C } = await donoEColaborador();
    const antes = await estado(env, C);
    assert.ok(kinds(antes.records).includes('contract'), 'com tudo ligado o contabilista vê o contrato: ' + kinds(antes.records));
    await desligar(env, C, 'contracts');
    const stC = await estado(env, C);
    assert.deepEqual(stC.servicos.desligados, ['contracts']);
    assert.ok(!kinds(stC.records).includes('contract'), 'sem os contratos do dono: ' + kinds(stC.records));
    assert.ok(kinds(stC.records).includes('tx'), 'os outros kinds continuam a vir');
    assert.equal(stC.houses.length, 1, 'e a casa de colaboração também');
    const stD = await estado(env, D);
    assert.deepEqual(stD.servicos.desligados, [], 'a conta do dono não é tocada');
    assert.ok(kinds(stD.records).includes('contract'), 'o dono vê o contrato dele');
    // o inverso: o dono desliga os Contratos; o colaborador, com o serviço ligado, continua a vê-los
    await ligarTudo(env, C);
    await desligar(env, D, 'contracts');
    const stD2 = await estado(env, D);
    assert.deepEqual(stD2.servicos.desligados, ['contracts']);
    assert.ok(!kinds(stD2.records).includes('contract'));
    const stC2 = await estado(env, C);
    assert.deepEqual(stC2.servicos.desligados, []);
    assert.ok(kinds(stC2.records).includes('contract'), 'o contrato do dono chega ao contabilista: o serviço é da conta de quem lê');
  });

  test('recusa: o sync olha para os serviços de quem escreve — um colaborador com Movimentos desligado é 403 na casa do dono e o dono passa; com o dono desligado é ao contrário', async () => {
    const { env, D, C } = await donoEColaborador();
    const putC = { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x9', data: { label: 'do colaborador', amount: 1 } };
    const putD = { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x8', data: { label: 'do dono', amount: 1 } };
    await desligar(env, C, 'transactions');
    assert.deepEqual(await sync(env, C, [putC]), [{ ok: false, status: 403, error: FRASE_DESLIGADO('transactions'), servico: 'transactions' }]);
    assert.deepEqual(await sync(env, D, [putD]), [{ ok: true }]);
    assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE house_id = 'H1' AND kind = 'tx' AND deleted = 0").first()).n, 2, 'só o do dono entrou');
    await ligarTudo(env, C);
    await desligar(env, D, 'transactions');
    assert.deepEqual(await sync(env, C, [putC]), [{ ok: true }], 'o colaborador escreve na casa do dono com o serviço ligado NA CONTA DELE');
    assert.deepEqual(await sync(env, D, [Object.assign({}, putD, { id: 'x7' })]), [{ ok: false, status: 403, error: FRASE_DESLIGADO('transactions'), servico: 'transactions' }]);
    assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE house_id = 'H1' AND kind = 'tx' AND deleted = 0").first()).n, 3);
    // e o que o colaborador escreveu chega ao dono assim que o serviço religa
    await ligarTudo(env, D);
    assert.ok((await estado(env, D)).records.some((r) => r.kind === 'tx' && r.id === 'x9'));
  });
});
