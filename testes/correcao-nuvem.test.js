// Correções da camada da nuvem (avaliação de 2026-09-14, área A.3, e as
// partes de cliente de A.4-3 e A.4-7).
//
// A app carrega-se inteira (carregarTudo) com o fetch trocado por um espião
// que responde o que cada teste manda — ou que passa o pedido ao servidor a
// sério, contra a D1 de teste (testes/lib/bd.js), com o cookie da sessão posto
// como o browser o poria. Cada teste diz a regra; o achado vai no comentário.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { carregarTudo } from './arnes.js';
import { ambiente, conta, sync as syncComo, casa, cargo, darCargo } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';
import { CARGOS_EXEMPLO } from '../worker/src/lib/permissoes.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');
const HEX = 'a'.repeat(64);

/* ------------------------------------------------ o cliente, com a nuvem */

/* Uma resposta de fetch a partir de {status, json, headers}: com headers.get,
   json() e text(), e um 304 sem corpo (como o browser o entrega). */
function resposta(r) {
  const cab = r.headers || {};
  const semCorpo = r.status === 304;
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    headers: { get: (k) => (k.toLowerCase() in cab ? cab[k.toLowerCase()] : null) },
    json: () => (semCorpo ? Promise.reject(new SyntaxError('sem corpo')) : Promise.resolve(r.json === undefined ? {} : r.json)),
    text: () => Promise.resolve(semCorpo ? '' : JSON.stringify(r.json === undefined ? {} : r.json)),
  };
}

/* A app com a nuvem por cima e os espiões: o fetch responde o que
   esp.responde disser (por omissão, tudo ok), o toast e o selo guardam-se, o
   render conta-se, o ciclo de 30 s não se arma, e há sessão (sem token: a
   sessão do browser vive no cookie).
   Devolve: {app, esp}. */
function montar() {
  const app = carregarTudo();
  const esp = { pedidos: [], toasts: [], selos: [], renders: 0, relatos: [], responde: null };
  const tudoOk = (m, url, body) => (url === '/api/sync'
    ? { status: 200, json: { results: ((body || {}).ops || []).map(() => ({ ok: true })) } }
    : { status: 200, json: {} });
  app.fetch = (url, opts) => {
    opts = opts || {};
    const body = opts.body ? JSON.parse(opts.body) : null;
    const pedido = { method: opts.method || 'GET', url, body, headers: Object.assign({}, opts.headers || {}) };
    esp.pedidos.push(pedido);
    const r = (esp.responde || tudoOk)(pedido.method, url, body, pedido);
    if (r instanceof Error) return Promise.reject(r);
    if (r && typeof r.then === 'function') return r;
    return Promise.resolve(resposta(r));
  };
  app.toast = (m) => { esp.toasts.push(String(m)); };
  app.setSyncBadge = (s, n) => { esp.selos.push(n ? s + ':' + n : s); };
  app.render = () => { esp.renders++; };
  app.buildNav = () => {};
  app.subirPendentes = () => {};
  app.setInterval = () => 0;
  app.reportErr = (m, d) => { esp.relatos.push(String(m) + ' | ' + String(d || '')); };
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt' };
  return { app, esp };
}

// As operações que seguiram para /api/sync, por ordem.
const opsDe = (esp) => esp.pedidos.filter((p) => p.url === '/api/sync').flatMap((p) => (p.body || {}).ops || []);
const leituras = (esp) => esp.pedidos.filter((p) => p.url === '/api/state');
const assenta = async () => { for (let i = 0; i < 25; i++) await new Promise((r) => setImmediate(r)); };
const copia = (x) => JSON.parse(JSON.stringify(x));

// Aplica um estado e desarma o push que o applyState agenda (os testes chamam
// pushNow à mão, para verem o que sai).
function aplicar(app, st) {
  app.applyState(st);
  app.clearTimeout(app.pushTimer);
}

/* Fecha a app e abre outra no mesmo aparelho: uma sessão nova, com o que
   ficou guardado (a base, o retrato e o dono da base).
   Recebe: a — a app que «fecha»; id — o id da conta.
   Devolve: {app, esp} da app nova. */
function reabrir(a, id = 'EU') {
  const { app: b, esp } = montar();
  for (const k of [a.KEY, 'gi_cloud_snap_' + id, 'gi_cloud_owner']) {
    const v = a.localStorage.getItem(k);
    if (v !== null) b.localStorage.setItem(k, v);
  }
  b.db = b.load();
  b.CW.user = Object.assign({}, a.CW.user);
  return { app: b, esp };
}

const CONTRATO = () => ({ houseId: 'H1', kind: 'contract', id: 'C1', updatedAt: 1, author: 'EU', createdBy: 'EU',
  data: { id: 'C1', name: 'Contrato T2', propertyId: 'H1', rent: 500, start: '2026-01-01', tenantIds: [] } });
const MOVIMENTO = (label = 'Renda') => ({ houseId: 'H1', kind: 'tx', id: 'T1', updatedAt: 1, author: 'EU', createdBy: 'EU',
  data: { id: 'T1', propertyId: 'H1', label, amount: 500, kind: 'income', date: '2026-01-05' } });

/* O estado de GET /api/state de uma conta com uma casa (H1), um contrato
   (C1) e um movimento (T1), mais o perfil e as definições.
   Devolve: o estado (objeto novo). */
function ESTADO(o = {}) {
  const records = [];
  if (!o.semContrato) records.push(CONTRATO());
  if (!o.semTx) records.push(MOVIMENTO(o.label));
  return {
    me: { id: 'EU', email: 'eu@x.pt', name: 'Eu' },
    servicos: { desligados: [] },
    profiles: [{ userId: 'EU', name: 'Eu', data: { id: 'EU', name: 'Eu' } }],
    people: [{ id: 'EU', name: 'Eu', kind: 'owner' }],
    proposals: [],
    houses: o.semCasa ? [] : [{ id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], collaborators: [], updatedAt: 1,
      data: { id: 'H1', name: 'T2 Lisboa', rooms: [] } }],
    records: o.semCasa ? [] : records,
    userRecords: o.semUser ? [] : [
      { kind: 'settings', id: 'main', updatedAt: 1, data: {} },
      { kind: 'profile', id: 'main', updatedAt: 1, data: { id: 'EU', name: 'Eu' } },
    ],
    roles: [], collaborators: [], invites: [], shareLink: null,
    shareRequests: { incoming: [], outgoing: [] }, connections: [],
  };
}

// Um espião de servidor que responde este estado ao GET /api/state (com ETag) e aceita tudo no sync.
const respondeEstado = (st, etag) => (m, url, body) => {
  if (url === '/api/state') return { status: 200, json: copia(st), headers: etag ? { etag } : {} };
  if (url === '/api/sync') return { status: 200, json: { results: body.ops.map(() => ({ ok: true })) } };
  return { status: 200, json: {} };
};

/* ------------------------------------------------- o servidor a sério */

// as armações de todos os testes do servidor vêm de testes/lib/api.js

let cargos = 0;
/* Um cargo novo com estas permissões, dado pelo caminho a sério (o dono
   convida, a pessoa aceita) nestas casas.
   Recebe: env; dono; quem; perms; houseIds.
   Devolve: nada — falha a asserção se a API recusar. */
async function cargoEm(env, dono, quem, perms, houseIds) {
  await darCargo(env, dono, quem, await cargo(env, dono, 'Cargo', perms, 'R' + (++cargos)), houseIds);
}

/* O fetch da app ligado ao servidor: o pedido segue para o handleApi com o
   cookie da sessão, como o browser o mandaria (credentials: 'same-origin').
   Recebe: env — o ambiente; quem — a conta {id, token}.
   Devolve: a função para esp.responde. */
const servidor = (env, quem) => (m, url, body, p) => handleApi(new Request('https://app.x.pt' + url, {
  method: m,
  headers: Object.assign({}, p.headers, { Cookie: 'gi_session=' + quem.token }),
  body: body ? JSON.stringify(body) : undefined,
}), env, { waitUntil() {} });

// A app ligada ao servidor como esta conta, com o primeiro estado aplicado.
async function clienteDe(env, quem) {
  const { app, esp } = montar();
  app.CW.user = { id: quem.id, name: quem.name, email: quem.id.toLowerCase() + '@x.pt' };
  esp.responde = servidor(env, quem);
  await app.pullNow(true);
  app.clearTimeout(app.pushTimer);
  return { app, esp };
}

/* ======================================================== A.3-1 */

describe('o arranque não perde o que ficou por enviar', () => {
  // achado A.3-1
  test('um registo novo, uma edição e uma remoção feitos sem rede sobrevivem ao arranque seguinte e sobem', async () => {
    const { app } = montar();
    aplicar(app, ESTADO());
    app.db.transactions.push(app.normTx({ id: 'T9', propertyId: 'H1', label: 'Canalizador', amount: 80, kind: 'expense', date: '2026-02-03' }));
    app.db.transactions.find((t) => t.id === 'T1').label = 'Renda de janeiro';
    app.db.contracts = app.db.contracts.filter((c) => c.id !== 'C1');
    app.rawSet(app.KEY, JSON.stringify(app.db));   // o save() grava no aparelho; o push nunca chegou a sair
    const { app: b, esp } = reabrir(app);
    esp.responde = respondeEstado(ESTADO());
    b.startSync();
    await assenta();
    b.clearTimeout(b.pushTimer);
    await b.pushNow();
    const ops = opsDe(esp);
    assert.ok(b.db.transactions.some((t) => t.id === 'T9'), 'o movimento novo continua no aparelho');
    assert.equal(b.db.transactions.find((t) => t.id === 'T1').label, 'Renda de janeiro', 'a edição também');
    assert.ok(!b.db.contracts.some((c) => c.id === 'C1'), 'e a remoção não é desfeita pelo servidor');
    assert.ok(ops.some((o) => o.op === 'put' && o.id === 'T9'), 'o novo sobe: ' + JSON.stringify(ops.map((o) => o.op + ' ' + o.id)));
    assert.ok(ops.some((o) => o.op === 'put' && o.id === 'T1'), 'a edição sobe');
    assert.ok(ops.some((o) => o.op === 'del' && o.id === 'C1'), 'a remoção sobe');
  });

  // achado A.3-1
  test('o que não foi mexido aqui segue o servidor: uma correção feita noutro aparelho chega', async () => {
    const { app } = montar();
    aplicar(app, ESTADO());
    const { app: b, esp } = reabrir(app);
    esp.responde = respondeEstado(ESTADO({ label: 'Renda (corrigida noutro aparelho)' }));
    b.startSync();
    await assenta();
    assert.equal(b.db.transactions.find((t) => t.id === 'T1').label, 'Renda (corrigida noutro aparelho)');
    b.clearTimeout(b.pushTimer);
    await b.pushNow();
    assert.equal(opsDe(esp).length, 0, 'e nada volta a subir por cima dela');
  });

  // achado A.3-1
  test('um «Recomeçar» feito noutro aparelho não é desfeito por este: com retrato, o servidor vazio vence o que aqui não mudou', async () => {
    const { app } = montar();
    aplicar(app, ESTADO());
    const { app: b, esp } = reabrir(app);
    esp.responde = respondeEstado(ESTADO({ semCasa: true, semUser: true }));
    b.startSync();
    await assenta();
    b.clearTimeout(b.pushTimer);
    await b.pushNow();
    assert.ok(!b.db.properties.some((p) => p.id === 'H1'), 'o imóvel apagado lá sai daqui');
    assert.ok(!opsDe(esp).some((o) => o.op === 'put' && (o.scope === 'house' || o.scope === 'record')),
      'e não volta a subir: ' + JSON.stringify(opsDe(esp).map((o) => o.op + ' ' + (o.id || o.houseId))));
  });

  // achado A.3-1
  test('sem retrato (primeira sessão com dados locais) e servidor vazio, o que o aparelho tem sobe — a migração continua', async () => {
    const { app, esp } = montar();
    app.db.properties = [app.normProp({ id: 'H7', name: 'Antes da conta' })];
    app.db.transactions = [app.normTx({ id: 'T7', propertyId: 'H7', label: 'Renda', amount: 400, kind: 'income', date: '2026-01-01' })];
    esp.responde = respondeEstado(ESTADO({ semCasa: true, semUser: true }));
    app.startSync();
    await assenta();
    app.clearTimeout(app.pushTimer);
    await app.pushNow();
    assert.ok(opsDe(esp).some((o) => o.op === 'put' && o.scope === 'house' && o.houseId === 'H7'));
    assert.ok(opsDe(esp).some((o) => o.op === 'put' && o.id === 'T7'));
  });

  // achado A.3-1
  test('a base local de outra conta no mesmo aparelho não se mistura: o servidor desta conta manda e nada da outra sobe', async () => {
    const { app, esp } = montar();
    app.localStorage.setItem('gi_cloud_owner', 'OUTRA');
    app.db.properties = [app.normProp({ id: 'H9', name: 'Da outra conta' })];
    esp.responde = respondeEstado(ESTADO());
    app.startSync();
    await assenta();
    app.clearTimeout(app.pushTimer);
    await app.pushNow();
    assert.ok(!app.db.properties.some((p) => p.id === 'H9'));
    assert.ok(!opsDe(esp).some((o) => o.houseId === 'H9'));
  });

  // achado A.3-1
  test('um envio recusado com 500 seguido de uma leitura bem-sucedida não deita fora a edição que ficou por enviar', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    app.db.transactions.find((t) => t.id === 'T1').label = 'Renda editada';
    esp.responde = (m, url) => (url === '/api/sync' ? { status: 500, json: { error: 'Erro do servidor.' } } : respondeEstado(ESTADO())(m, url));
    await app.pushNow();
    await app.pullNow(true);
    app.clearTimeout(app.pushTimer);
    assert.equal(app.db.transactions.find((t) => t.id === 'T1').label, 'Renda editada');
  });

  // achado A.3-1
  test('contra o servidor a sério: o movimento feito sem rede chega à base de dados depois de reabrir a app', async () => {
    const env = ambiente();
    const EU = await conta(env, 'Eu');
    await casa(env, EU, 'H1', { name: 'T2' });
    const { app: a, esp } = await clienteDe(env, EU);
    await a.pushNow();
    esp.responde = () => new TypeError('Failed to fetch');   // sem rede
    a.db.transactions.push(a.normTx({ id: 'T9', propertyId: 'H1', label: 'Canalizador', amount: 80, kind: 'expense', date: '2026-02-03' }));
    a.rawSet(a.KEY, JSON.stringify(a.db));
    await a.pushNow();
    const { app: b, esp: eb } = reabrir(a, EU.id);
    eb.responde = servidor(env, EU);
    b.startSync();
    await assenta();
    b.clearTimeout(b.pushTimer);
    await b.pushNow();
    const linha = await env.DB.prepare("SELECT deleted FROM records WHERE house_id = 'H1' AND kind = 'tx' AND id = 'T9'").first();
    assert.ok(linha && linha.deleted === 0, 'o movimento está no servidor');
  });
});

/* ======================================================== A.3-2 */

describe('uma ficha de inquilino, uma chave', () => {
  // achado A.3-2
  test('com a ficha no servidor em duas chaves, vale a escrita mais recente e ficam as marcas do registo da casa', () => {
    const { app } = montar();
    const st = ESTADO();
    st.userRecords.push({ kind: 'tenant', id: 'P1', updatedAt: 10, data: { id: 'P1', name: 'Ana', houseId: 'H1' } });
    st.records.push({ houseId: 'H1', kind: 'tenant', id: 'P1', updatedAt: 20, author: 'COL', createdBy: 'COL',
      data: { id: 'P1', name: 'Ana Corrigida', houseId: 'H1' } });
    const d = app.rebuildDb(st);
    const p = d.tenants.find((t) => t.id === 'P1');
    assert.equal(p.name, 'Ana Corrigida', 'a correção do colaborador');
    assert.equal(p._createdBy, 'COL');
    assert.equal(p._author, 'COL');
    assert.equal(p._atServidor, 20);
  });

  // achado A.3-2
  test('uma ficha presa a um imóvel sobe só como registo desse imóvel; sem imóvel (ou com o imóvel apagado), só como minha', () => {
    const { app } = montar();
    aplicar(app, ESTADO());
    const ficha = (id, houseId) => { const t = app.normPerson({ id, name: id }); if (houseId) t.houseId = houseId; return t; };
    app.db.tenants.push(ficha('TM', 'H1'), ficha('TA', 'H9'), ficha('TU'), ficha('TC'));
    app.db.contracts[0].tenantIds = ['TC'];   // presa pelo contrato, sem houseId
    const chaves = Object.keys(copia(app.exportEntities()));
    assert.ok(chaves.includes('r:H1:tenant:TM') && !chaves.includes('u:tenant:TM'), 'presa ao meu imóvel: uma chave');
    assert.ok(chaves.includes('r:H1:tenant:TC') && !chaves.includes('u:tenant:TC'), 'presa pelo contrato: uma chave');
    assert.ok(chaves.includes('u:tenant:TA'), 'o imóvel foi apagado: continua minha');
    assert.ok(chaves.includes('u:tenant:TU'), 'sem imóvel: minha');
  });

  // achado A.3-2
  test('a cópia antiga em u:tenant de uma ficha que vive num imóvel é apagada no servidor, e a ficha fica', async () => {
    const { app, esp } = montar();
    const st = ESTADO();
    st.userRecords.push({ kind: 'tenant', id: 'P1', updatedAt: 5, data: { id: 'P1', name: 'Ana', houseId: 'H1' } });
    st.records.push({ houseId: 'H1', kind: 'tenant', id: 'P1', updatedAt: 5, author: 'EU', createdBy: 'EU',
      data: { id: 'P1', name: 'Ana', houseId: 'H1' } });
    aplicar(app, st);
    await app.pushNow();
    const ops = opsDe(esp).map((o) => o.op + ' ' + (o.scope === 'record' ? 'r:' + o.houseId : 'u') + ':' + o.kind + ':' + o.id);
    assert.ok(ops.includes('del u:tenant:P1'), 'a cópia sai: ' + ops.join(', '));
    assert.ok(!ops.some((o) => o.startsWith('put') && o.includes('tenant')), 'e a do imóvel não volta a subir');
    assert.ok(app.db.tenants.some((t) => t.id === 'P1'), 'a ficha continua no aparelho');
  });

  // achado A.3-2
  test('contra o servidor a sério: a ficha do colaborador chega corrigida ao dono e, quando ele a apaga, não ressuscita', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const C = await conta(env, 'Colab');
    await casa(env, D, 'H1', { name: 'T2' });
    await cargoEm(env, D, C, CARGOS_EXEMPLO[0].perms, ['H1']);
    const ficha = (name) => ({ op: 'put', scope: 'record', houseId: 'H1', kind: 'tenant', id: 'P1', data: { id: 'P1', name, houseId: 'H1' } });
    assert.deepEqual(await syncComo(env, C, [ficha('Ana')]), [{ ok: true }]);
    const { app: a } = await clienteDe(env, D);
    await a.pushNow();
    assert.deepEqual(await syncComo(env, C, [ficha('Ana Corrigida')]), [{ ok: true }]);
    await a.pullNow(true);
    a.clearTimeout(a.pushTimer);
    const p = a.db.tenants.find((t) => t.id === 'P1');
    assert.equal(p && p.name, 'Ana Corrigida', 'o dono vê a correção');
    assert.equal(p._createdBy, C.id, 'e sabe quem a criou');
    await a.pushNow();
    assert.deepEqual(await syncComo(env, C, [{ op: 'del', scope: 'record', houseId: 'H1', kind: 'tenant', id: 'P1' }]), [{ ok: true }]);
    await a.pullNow(true);
    a.clearTimeout(a.pushTimer);
    await a.pushNow();
    assert.ok(!a.db.tenants.some((t) => t.id === 'P1'), 'a ficha apagada sai do dono');
    const viva = await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE kind = 'tenant' AND id = 'P1' AND deleted = 0").first();
    const sua = await env.DB.prepare("SELECT COUNT(*) AS n FROM user_records WHERE kind = 'tenant' AND id = 'P1' AND deleted = 0").first();
    assert.equal(viva.n + sua.n, 0, 'e não ressuscita no servidor');
  });
});

/* ======================================================== A.3-3 */

describe('o que o cliente não reconhece não se apaga', () => {
  // achado A.3-3
  test('um kind que esta versão não conhece (de uma versão mais nova) não sai como «del» no envio seguinte', async () => {
    const { app, esp } = montar();
    const st = ESTADO();
    st.userRecords.push({ kind: 'nota', id: 'N1', updatedAt: 1, data: { id: 'N1', texto: 'nova' } });
    st.records.push({ houseId: 'H1', kind: 'inspecao', id: 'I1', updatedAt: 1, data: { id: 'I1' } });
    aplicar(app, st);
    await app.pushNow();
    assert.ok(!opsDe(esp).some((o) => o.op === 'del'), 'nada se apaga: ' + JSON.stringify(opsDe(esp)));
  });

  // achado A.3-3
  test('o que é obsoleto de propósito (os proprietários do modelo antigo) continua a ser apagado', async () => {
    const { app, esp } = montar();
    const st = ESTADO();
    st.userRecords.push({ kind: 'owner', id: 'O1', updatedAt: 1, data: { id: 'O1', name: 'Velho' } });
    aplicar(app, st);
    await app.pushNow();
    assert.ok(opsDe(esp).some((o) => o.op === 'del' && o.kind === 'owner' && o.id === 'O1'));
  });

  // achado A.3-3
  test('um registo que não se deixa ler fica congelado (sem «del») e vai no relato de erro', async () => {
    const { app, esp } = montar();
    const st = ESTADO();
    // um registo que rebenta a normalização (aqui, um campo que lança ao ser lido)
    const partido = { id: 'TX', propertyId: 'H1' };
    Object.defineProperty(partido, 'label', { enumerable: true, get() { throw new Error('partido'); } });
    st.records.push({ houseId: 'H1', kind: 'tx', id: 'TX', updatedAt: 1, data: partido });
    aplicar(app, st);
    assert.ok(!app.db.transactions.some((t) => t.id === 'TX'), 'não entrou na base');
    await app.pushNow();
    assert.ok(!opsDe(esp).some((o) => o.op === 'del' && o.id === 'TX'), 'não se apaga o que não se leu');
    assert.ok(esp.relatos.some((r) => /tx/.test(r) && /TX/.test(r)), 'e diz-se: ' + esp.relatos.join(' / '));
  });
});

/* ======================================================== A.3-4 */

describe('as chamadas à API têm tempo-limite', () => {
  // achado A.3-4
  test('um envio pendurado larga o envio ao fim do tempo-limite, e o selo diz que não houve resposta', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    app.TEMPO_API.sync = 40;
    app.db.transactions.push(app.normTx({ id: 'T9', propertyId: 'H1', label: 'x', amount: 1, kind: 'expense', date: '2026-02-01' }));
    esp.responde = () => new Promise(() => {});
    const r = await Promise.race([app.pushNow().then(() => 'acabou'), new Promise((ok) => setTimeout(() => ok('pendurado'), 1500))]);
    assert.equal(r, 'acabou');
    assert.equal(app.pushing, false, 'o envio seguinte não fica trancado');
    assert.equal(esp.selos[esp.selos.length - 1], 'off');
  });
});

/* ======================================================== A.3-5 */

describe('só um 401 de sessão encerra a sessão', () => {
  // achado A.3-5
  test('a palavra-passe atual errada não põe ninguém fora; a sessão inválida sim', async () => {
    const { app, esp } = montar();
    esp.responde = (m, url) => (url === '/api/me/password'
      ? { status: 401, json: { error: 'A palavra-passe atual está errada.' } }
      : m === 'DELETE' && url === '/api/me'
        ? { status: 401, json: { error: 'Palavra-passe errada.' } }
        : { status: 401, json: { error: 'Sessão inválida — inicia sessão de novo.' } });
    await assert.rejects(app.api('POST', '/api/me/password', { current: 'x', next: 'y' }), /atual está errada/);
    assert.ok(app.CW.user, 'continua com sessão');
    await assert.rejects(app.api('DELETE', '/api/me', { confirm: 'APAGAR', password: 'x' }));
    assert.ok(app.CW.user, 'também ao apagar a conta');
    await assert.rejects(app.api('GET', '/api/state'));
    assert.equal(app.CW.user, null, 'um 401 de sessão encerra-a');
  });
});

/* ======================================================== A.3-6 */

describe('o rasto dos relatos não leva segredos', () => {
  // achado A.3-6
  test('os tokens de 64 hexadecimais saem mascarados do rasto, e o resto fica', async () => {
    const { app } = montar();
    app.rastoPoe('GET /api/ligar/' + HEX + ' → 200');
    await app.api('POST', '/api/convite/' + 'b'.repeat(64) + '/aceitar', {});
    const rasto = app.CW._rasto.join(' | ');
    assert.ok(!/[a-f0-9]{16,}/i.test(rasto), rasto);
    assert.match(rasto, /GET \/api\/ligar\//);
    assert.match(rasto, /POST \/api\/convite\/.*\/aceitar → 200/);
  });
});

/* ======================================================== A.3-7 */

describe('a ligação de partilha guardada é da conta', () => {
  // achado A.3-7
  test('quem entra a seguir no mesmo aparelho não copia a ligação de quem saiu, e sair apaga-a', async () => {
    const { app, esp } = montar();
    app.CW.user = { id: 'ANA', name: 'Ana', email: 'ana@x.pt' };
    esp.responde = () => ({ status: 200, json: { url: 'https://app.x.pt/?ligar=' + HEX } });
    app.confirmModal = (t, txt, cb) => cb();
    app.CW.ligacaoCriar();
    await assenta();
    app.CW.user = { id: 'RUI', name: 'Rui', email: 'rui@x.pt' };
    esp.toasts.length = 0;
    app.CW.ligacaoCopiar();
    assert.ok(!esp.toasts.includes('Ligação copiada.'), 'a do Rui não existe neste aparelho: ' + esp.toasts.join(' | '));
    app.CW.user = { id: 'ANA', name: 'Ana', email: 'ana@x.pt' };
    esp.toasts.length = 0;
    app.CW.ligacaoCopiar();
    assert.ok(esp.toasts.includes('Ligação copiada.'), 'a da Ana continua a ser dela');
    app.sessionLost();
    app.CW.user = { id: 'ANA', name: 'Ana', email: 'ana@x.pt' };
    esp.toasts.length = 0;
    app.CW.ligacaoCopiar();
    assert.ok(!esp.toasts.includes('Ligação copiada.'), 'sair apaga-a do aparelho');
  });

  // achado A.3-7
  test('a ligação guardada sem dono (versões anteriores) é esquecida', () => {
    const { app } = montar();
    app.localStorage.setItem('gi_ligacao_url', 'https://app.x.pt/?ligar=' + HEX);
    app.largarLigacaoSemDono();
    assert.equal(app.localStorage.getItem('gi_ligacao_url'), null);
  });
});

/* ======================================================== A.3-8 */

describe('a Ajuda sem rede não diz que não há pedidos', () => {
  // achado A.3-8
  test('uma falha a carregar os pedidos diz que não deu, com um botão, e não repete o pedido a cada pintura', async () => {
    const { app, esp } = montar();
    app.CW.tickets = null;
    app.tab = 'settings'; app.setPage = 'ajuda';
    esp.responde = () => ({ status: 500, json: { error: 'Erro 500' } });
    app.vAjuda();
    await assenta();
    const h = app.vAjuda();
    app.vAjuda();
    assert.doesNotMatch(h, /Ainda não enviaste nenhum pedido/);
    assert.match(h, /Não deu para carregar os teus pedidos/);
    assert.match(h, /CW\.ticketsDeNovo\(\)/);
    assert.equal(esp.pedidos.filter((p) => p.url === '/api/tickets').length, 1);
  });
});

/* ======================================================== A.3-9 */

describe('trancado quer dizer trancado', () => {
  // achado A.3-9
  test('com a versão abaixo da mínima, nada escreve no servidor: nem o push, nem uma ação', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    app.db.transactions.push(app.normTx({ id: 'T9', propertyId: 'H1', label: 'x', amount: 1, kind: 'expense', date: '2026-02-01' }));
    app.schedulePush();
    assert.ok(app.pushTimer, 'o envio estava armado');
    app.document.getElementById = () => null;
    app.gateAtualizar(99);
    assert.equal(app.CW.trancado, true);
    assert.equal(app.pushTimer, null, 'o ecrã desarma o envio que estava agendado');
    await app.pushNow();
    await assert.rejects(app.api('POST', '/api/tickets', {}));
    assert.equal(esp.pedidos.filter((p) => p.method !== 'GET').length, 0, 'nenhum pedido que escreve saiu');
  });
});

/* ======================================================== A.3-10 */

describe('um ritual de saída só', () => {
  // achado A.3-10
  test('os cinco caminhos de saída passam pelo encerrarSessao, e ele limpa a lista toda das chaves da camada', () => {
    const fontes = ['nucleo', 'entrada', 'ajuda', 'partilha'].map((f) => le('web/cloud/' + f + '.js')).join('\n');
    const corpo = (nome) => {
      const i = fontes.search(new RegExp('(function ' + nome + '\\(|CW\\.' + nome + ' = function)'));
      assert.ok(i > -1, nome + ' existe');
      return fontes.slice(i, i + 1600);
    };
    for (const n of ['sessionLost', 'naoSouEu', 'logout', 'doRefuseTerms', 'doDeleteAccount']) {
      assert.match(corpo(n), /encerrarSessao\(/, n + ' usa o ritual');
    }
    assert.ok(!/removeItem\(LS_USER\)/.test(fontes), 'ninguém apaga a sessão fora do ritual');
    assert.match(corpo('encerrarSessao'), /var chaves = \[LS_USER, LS_PAGE, 'gi_est_asked', chaveDaLigacao\(\)\]/, 'que tem a lista toda');
    const fora = ['entrada', 'ajuda', 'partilha'].map((f) => le('web/cloud/' + f + '.js')).join('\n');
    assert.ok(!/'gi_cloud_user'|'gi_cloud_owner'/.test(fora), 'e ninguém escreve as chaves à mão (vivem em nucleo.js)');

    const { app } = montar();
    for (const k of ['gi_cloud_user', 'gi_page', 'gi_est_asked', 'gi_cloud_owner', 'gi_cloud_snap_EU', 'gi_ligacao_url_EU']) app.localStorage.setItem(k, 'x');
    app.CW._rasto = ['GET /api/state → 200'];
    app.encerrarSessao({ apagarDados: true, mensagem: 'Conta apagada.' });
    for (const k of ['gi_cloud_user', 'gi_page', 'gi_est_asked', 'gi_cloud_owner', 'gi_cloud_snap_EU', 'gi_ligacao_url_EU']) {
      assert.equal(app.localStorage.getItem(k), null, k + ' saiu');
    }
    assert.equal(app.CW.user, null);
    assert.equal(app.CW._rasto.length, 0);
  });
});

/* ======================================================== A.3-11 */

describe('acessos.js chama-se a direito', () => {
  // achado A.3-11
  test('a camada da nuvem não tem cópias de recurso de acessos.js, que carrega sempre antes', () => {
    const html = le('web/index.html');
    const i = html.indexOf('src="app/acessos.js"');
    assert.ok(i > -1 && i < html.indexOf('src="cloud/'), 'acessos.js vem antes de qualquer ficheiro de cloud/');
    const cloud = fs.readdirSync(path.join(AQUI, '..', 'web/cloud')).filter((f) => f.endsWith('.js'))
      .map((f) => [f, le('web/cloud/' + f)]);
    for (const [f, s] of cloud) {
      assert.ok(!/ROTULOS_LOCAL|IMPLICA_LOCAL|CARGOS_LOCAL|KIND_PERM_LOCAL|function donosDoEstado|function cwPode|function soColaborador/.test(s), f + ' sem cópias');
      assert.ok(!/typeof (souDono|souCriador|pode|casasComo|temPerm|seloCargo|seloColaboradores|souSoColaborador|parseConvite|cargosDoEstado|fechoPerms|KIND_PERM|ROTULOS|IMPLICA|CARGOS_EXEMPLO|notifPedidos)\b/.test(s),
        f + ' não pergunta se acessos.js existe');
    }
  });
});

/* ======================================================== A.3-13 */

describe('o retrato guarda resumos, não cópias', () => {
  // achado A.3-13
  test('cada entrada do retrato é um resumo curto, e o retrato fica uma fração da base', () => {
    const { app } = montar();
    const st = ESTADO();
    for (let i = 0; i < 400; i++) {
      st.records.push({ houseId: 'H1', kind: 'tx', id: 'X' + i, updatedAt: 1,
        data: { id: 'X' + i, propertyId: 'H1', label: 'Movimento número ' + i, amount: i, kind: 'expense', date: '2026-01-01', notes: 'nota '.repeat(10) } });
    }
    aplicar(app, st);
    const snap = copia(app.snap);
    assert.ok(Object.values(snap).every((v) => /^#[0-9a-z]+:[0-9a-z]+$/.test(v)), 'resumos');
    assert.ok(JSON.stringify(snap).length < JSON.stringify(app.db).length / 3,
      'retrato ' + JSON.stringify(snap).length + ' vs base ' + JSON.stringify(app.db).length);
  });

  // achado A.3-13
  test('um retrato antigo (com o JSON inteiro) lê-se sem reenviar nada, e uma falha a gravá-lo diz-se', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    const antigo = {};
    const mapa = copia(app.exportEntities());
    for (const k of Object.keys(mapa)) antigo[k] = JSON.stringify(mapa[k].data);
    app.localStorage.setItem('gi_cloud_snap_EU', JSON.stringify(antigo));
    app.loadSnap();
    await app.pushNow();
    assert.equal(opsDe(esp).length, 0, 'nada por enviar: ' + JSON.stringify(opsDe(esp)));
    const guarda = app.localStorage.setItem;
    app.localStorage.setItem = (k, v) => { if (k.startsWith('gi_cloud_snap_')) throw new Error('QuotaExceededError'); return guarda(k, v); };
    app.saveSnap();
    app.saveSnap();
    app.localStorage.setItem = guarda;
    assert.equal(esp.relatos.filter((r) => /retrato/.test(r)).length, 1, 'diz-se, uma vez: ' + esp.relatos.join(' / '));
  });
});

/* ======================================================== A.3-14 */

describe('o toque longo não abre nada no painel', () => {
  // achado A.3-14
  test('o ramo «dash:» do toque longo e o arranque do arrasto por ele saíram; o modo de edição entra pelo botão', () => {
    const { app } = montar();
    app.tab = 'dashboard';
    app.lpMenu('dash:bloco');
    assert.ok(!app.CW.editMode, 'lpMenu não entra em edição');
    const s = le('web/cloud/painel.js');
    assert.ok(!/indexOf\('dash:'\)/.test(s) && !/data-lp="dash:/.test(s), 'sem o prefixo');
    const i = s.indexOf('CW.enterEdit = function');
    assert.ok(!/pointerDown/.test(s.slice(i, s.indexOf('};', i))), 'o modo de edição não arranca arrastos');
    assert.ok(!/chega-se cá pelo toque longo/.test(s.slice(i - 400, i)), 'e o comentário não promete o gesto');
  });
});

/* ======================================================== A.3-15 */

describe('sem código morto na nuvem', () => {
  // achado A.3-15
  test('o aviso antigo, os exports sem chamador e a lista de recusados que ninguém lê saíram', async () => {
    assert.ok(!/vLegalAntigo/.test(le('web/cloud/ajuda.js')));
    for (const f of fs.readdirSync(path.join(AQUI, '..', 'web/cloud'))) {
      assert.ok(!/CW\.pushNow\s*=|CW\.pullNow\s*=/.test(le('web/cloud/' + f)), f);
    }
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    app.db.transactions.find((t) => t.id === 'T1').label = 'outra';
    esp.responde = (m, url, body) => (url === '/api/sync'
      ? { status: 200, json: { results: body.ops.map(() => ({ ok: false, status: 403, error: 'Sem permissão.' })) } } : { status: 200, json: {} });
    await app.pushNow();
    assert.equal(app.db._recusados, undefined, 'nada se guarda que ninguém lê');
    assert.ok(esp.toasts.some((t) => /sem permissão neste imóvel/.test(t)), 'e a pessoa é avisada');
  });
});

/* ======================================================== A.3-16a */

describe('cada coisa no seu ficheiro', () => {
  // achado A.3-16a
  test('os embrulhos da sincronização vivem em nucleo.js; as ações da conta e das ligações em partilha.js', () => {
    const nucleo = le('web/cloud/nucleo.js'), anexos = le('web/cloud/anexos.js');
    const ajuda = le('web/cloud/ajuda.js'), partilha = le('web/cloud/partilha.js');
    for (const w of ['var _save = save;', 'var _render = render;', 'var _go = go;', 'var _goSet = goSet;', 'function restorePage', 'function decorateShared']) {
      assert.ok(nucleo.includes(w), 'nucleo.js: ' + w);
      assert.ok(!anexos.includes(w), 'anexos.js já não: ' + w);
    }
    for (const a of ['logout', 'passwordModal', 'savePassword', 'revokeSessions', 'deleteAccount', 'doDeleteAccount',
      'copyId', 'addConn', 'acceptConn', 'delConn', 'sharesModal']) {
      assert.ok(partilha.includes('CW.' + a + ' = function'), 'partilha.js: ' + a);
      assert.ok(!ajuda.includes('CW.' + a + ' = function'), 'ajuda.js já não: ' + a);
    }
    assert.ok(partilha.includes('function nextShareProposal'));
  });
});

/* ======================================================== A.3-17 */

describe('a sincronização de fundo só repinta o que mudou', () => {
  // achado A.3-17
  test('um estado igual ao último aplicado não refaz a base nem repinta; um campo a ser escrito trava a leitura de fundo', async () => {
    const { app, esp } = montar();
    esp.responde = respondeEstado(ESTADO());
    await app.pullNow(true);
    app.clearTimeout(app.pushTimer);
    const base = app.db, n = esp.renders;
    await app.pullNow(true);
    assert.equal(app.db, base, 'a mesma base');
    assert.equal(esp.renders, n, 'sem repintar');
    app.document.activeElement = { tagName: 'INPUT', type: 'text' };
    const antes = leituras(esp).length;
    await app.pullNow();
    assert.equal(leituras(esp).length, antes, 'não se lê por baixo de quem escreve');
    app.document.activeElement = null;
  });
});

/* ======================================================== A.3-18 */

describe('um 429 não é falta de rede', () => {
  // achado A.3-18
  test('com 429 o selo fica em «por enviar» e a frase do servidor chega; sem rede, «sem ligação»', async () => {
    const { app, esp } = montar();
    aplicar(app, ESTADO());
    app.db.transactions.push(app.normTx({ id: 'T9', propertyId: 'H1', label: 'x', amount: 1, kind: 'expense', date: '2026-02-01' }));
    const frase = 'Demasiadas gravações seguidas. Espera um pouco — os dados não se perdem.';
    esp.responde = () => ({ status: 429, json: { error: frase } });
    await app.pushNow();
    assert.equal(esp.selos[esp.selos.length - 1], 'pend:1');
    assert.ok(esp.toasts.includes(frase), esp.toasts.join(' | '));
    esp.responde = () => new TypeError('Failed to fetch');
    await app.pushNow();
    assert.equal(esp.selos[esp.selos.length - 1], 'off');
  });
});

/* ======================================================== A.3-19 */

describe('selecao-listas.js dentro da regra', () => {
  // achado A.3-19
  test('tem use strict, vive no âmbito global como os outros e reutiliza a caixa de selecao.js', () => {
    const s = le('web/cloud/selecao-listas.js');
    assert.match(s, /^'use strict';$/m);
    assert.ok(!/^\(function \(\) \{/m.test(s), 'sem o IIFE');
    assert.ok(!/function caixa\(/.test(s), 'a caixa é a de selecao.js');
    const { app } = montar();
    assert.equal(typeof app.selLDecorar, 'function', 'as funções são de topo, com o comentário que o gerador lê');
  });
});

/* ======================================================== A.4-3b */

describe('a leitura do estado com selo', () => {
  // achado A.4-3b
  test('a leitura de fundo manda o If-None-Match do último estado aplicado; num 304 não se aplica nada', async () => {
    const { app, esp } = montar();
    esp.responde = (m, url, body, p) => {
      if (url !== '/api/state') return respondeEstado(ESTADO())(m, url, body);
      if (p.headers['If-None-Match'] === '"e1"') return { status: 304, headers: { etag: '"e1"' } };
      return { status: 200, json: ESTADO(), headers: { etag: '"e1"' } };
    };
    await app.pullNow(true);
    app.clearTimeout(app.pushTimer);
    assert.equal(leituras(esp)[0].headers['If-None-Match'], undefined, 'a primeira leitura da página é inteira');
    const base = app.db, n = esp.renders;
    await app.pullNow(true);
    assert.equal(leituras(esp)[1].headers['If-None-Match'], '"e1"');
    assert.equal(app.db, base, 'o 304 não chega ao applyState');
    assert.equal(esp.renders, n);
    assert.ok(!esp.selos.includes('off'), 'e conta como leitura bem-sucedida');
    app.db.transactions.push(app.normTx({ id: 'T8', propertyId: 'H1', label: 'x', amount: 1, kind: 'expense', date: '2026-02-01' }));
    await app.pushNow();
    await app.pullNow(true);
    app.clearTimeout(app.pushTimer);
    assert.equal(leituras(esp)[2].headers['If-None-Match'], undefined, 'depois de enviar, o selo antigo já não diz nada');
  });
});

/* ======================================================== A.4-7b */

describe('a sessão vive no cookie', () => {
  // achado A.4-7b
  test('entrar não guarda o token no aparelho e as chamadas seguintes não levam Bearer', async () => {
    const { app, esp } = montar();
    app.setTimeout = () => 0;
    app.CW.user = null;
    app.finishLogin({ id: 'EU', name: 'Eu', email: 'eu@x.pt', token: HEX });
    assert.equal(app.CW.user.token, undefined);
    assert.ok(!/token/.test(app.localStorage.getItem('gi_cloud_user') || ''), app.localStorage.getItem('gi_cloud_user'));
    await app.api('GET', '/api/state');
    assert.ok(esp.pedidos.length > 0 && esp.pedidos.every((p) => !p.headers.Authorization), 'nenhum Bearer');
  });

  // achado A.4-7b
  test('uma sessão antiga guardada com token passa para o cookie quando o cookie é da mesma conta; senão fica', async () => {
    const { app, esp } = montar();
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt', token: HEX };
    esp.responde = () => ({ status: 200, json: { id: 'EU' } });   // o cookie é desta conta
    await app.largarTokenAntigo();
    assert.equal(app.CW.user.token, undefined, 'o cookie serve: o token sai');
    assert.ok(!/token/.test(app.localStorage.getItem('gi_cloud_user') || ''));
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt', token: HEX };
    esp.responde = (m, url, b, p) => (p.headers.Authorization ? { status: 200, json: { id: 'EU' } } : { status: 200, json: { id: 'OUTRA' } });
    await app.largarTokenAntigo();
    assert.equal(app.CW.user.token, HEX, 'o cookie é de outra conta (o seletor de teste): o token fica');
    const perguntas = esp.pedidos.filter((p) => p.url === '/api/me');
    assert.equal(perguntas.length, 2, 'uma pergunta por cenário');
    assert.ok(perguntas.every((p) => !p.headers.Authorization), 'a pergunta vai só com o cookie');
  });

  // achado A.4-7b
  test('o Bearer só vai com um token de teste, e pede o token de volta com o cabeçalho do contrato; rodar a sessão sem token devolvido larga-o', async () => {
    const { app, esp } = montar();
    await app.api('GET', '/api/me');
    assert.equal(esp.pedidos[0].headers.Authorization, undefined);
    assert.equal(esp.pedidos[0].headers['X-Rendorium-Token'], undefined);
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt', token: HEX };
    await app.api('GET', '/api/me');
    assert.equal(esp.pedidos[1].headers.Authorization, 'Bearer ' + HEX);
    assert.equal(esp.pedidos[1].headers['X-Rendorium-Token'], '1');
    app.sessaoRodada({ ok: true });
    assert.equal(app.CW.user.token, undefined, 'em produção o servidor não o devolve: o cookie novo manda');
    app.CW.user.token = HEX;
    app.sessaoRodada({ ok: true, token: 'c'.repeat(64) });
    assert.equal(app.CW.user.token, 'c'.repeat(64), 'fora de produção, com o cabeçalho, vem o novo');
    const s = le('web/cloud/entrada.js');
    const i = s.indexOf("'/api/teste/trocar'");
    assert.ok(i > -1 && /'X-Rendorium-Token': '1'/.test(s.slice(i, i + 900)), 'o seletor de contas de teste pede o token com o cabeçalho');
  });
});
