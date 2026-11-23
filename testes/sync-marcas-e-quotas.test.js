// A sincronização das marcas de migração das definições e das quotas com data
// (auditoria ao IRS, vaga 1, folha 2.1.13; KAN-126). O cliente inteiro
// (carregarTudo) a falar com o servidor a sério (testes/lib/api.js, a D1 de
// testes/lib/bd.js com a migração 0030), sem espiões no meio: o que o
// pushNow manda é o que o /api/sync funde e grava.
//
// 1. As marcas das definições (irsMapaV, catsV) e os valores migrados sobem
//    à nuvem uma vez (web/cloud/nucleo.js:definicoesDaBase). Antes, a base da
//    fusão a três era a forma local já migrada: o envio nunca levava a marca,
//    e a leitura seguinte migrava outra vez — a escolha de propósito de
//    «Outros gastos» nos Seguros voltava a «a confirmar», e o IMT removido
//    voltava. Uma base por migrar que já não é fresca (um aparelho sem rede,
//    o arranque) espera pela leitura seguinte: não vai por cima do que outro
//    aparelho escolheu depois de migrar.
// 2. Os de fora e o histórico das quotas são do servidor no cliente
//    (nucleo.js:fundidoComServidor), como os donos e as quotas.
// 3. As propostas do /api/state levam fora e desde (rotas/estado.js).
// 4. Deixar de partilhar uma casa numa ligação, cortar a ligação, tirar a
//    casa de um grupo, apagar o grupo e sair dele fecham o período das quotas
//    como sair do imóvel (rotas/conexoes.js:fecharQuotasDeQuemSaiu).

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, conta, pedir, resp, estado, casa, dadoGlobal, comproprietario, cargo, darCargo } from './lib/api.js';
import { carregarTudo, repor } from './arnes.js';

/* ------------------------------ armações ------------------------------- */

afterEach(() => mock.restoreAll());

// Um valor de JSON copiado para este contexto (os objetos da app vivem noutro).
// Recebe: v — o valor. Devolve: a cópia.
const copia = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/* Põe o relógio do worker num instante fixo (o now() e o «hoje» de Lisboa).
   A app corre noutro contexto, com o relógio dela.
   Recebe: iso — 'AAAA-MM-DDTHH:MM:SSZ'.
   Devolve: nada. */
const relogio = (iso) => { const t = Date.parse(iso); mock.method(Date, 'now', () => t); };

/* As definições de uma conta de antes das migrações (catsV e irsMapaV): as
   árvores sem as categorias novas (CATS_NOVAS), o mapa com os valores antigos
   de origem das chaves que mudaram (IRS_MAPA_MIGRA), sem catIds nem marcas.
   Recebe: app — uma app carregada (de onde vêm as constantes).
   Devolve: as definições (objeto deste contexto). */
function definicoesVelhas(app) {
  const cats = copia(app.CATS0), catsIn = copia(app.CATS_IN0), novas = copia(app.CATS_NOVAS);
  for (const [tk, arv] of [['cats', cats], ['catsIn', catsIn]]) {
    for (const c of Object.keys(novas[tk])) {
      if (novas[tk][c].nova) delete arv[c];
      else arv[c] = arv[c].filter((s) => !novas[tk][c].subs.includes(s));
    }
  }
  const irsMapa = Object.assign(copia(app.IRS_MAPA0), copia(app.IRS_MAPA_MIGRA));
  return { growth: 2, inflation: 2, years: 10, capTarget: 5, quota: 100, payTax: true, stampPct: 4,
    cats, catsIn, tags: copia(app.TAGS0), irsMapa,
    irs: { conjunta: false, titulares: {}, dispensaRecibos: false, outrosRendimentos: {} } };
}

/* Um aparelho com a app inteira e a nuvem ligada ao servidor de teste: o
   fetch vai ao handleApi com a sessão de quem está na app (CW.user), e as
   operações enviadas ficam em esp.ops. O render e o buildNav não pintam.
   Recebe: env; quem — a conta com sessão; app (opcional) — uma app já
   carregada (outra conta no mesmo aparelho).
   Devolve: { app, esp }. */
function aparelho(env, quem, app) {
  app = app || carregarTudo();
  const esp = { ops: [], selos: [] };
  app.fetch = async (url, opts) => {
    opts = opts || {};
    const corpo = opts.body ? JSON.parse(opts.body) : undefined;
    if (url === '/api/sync') esp.ops.push(...corpo.ops);
    return pedir(env, { token: app.CW.user.token }, url, opts.method || 'GET', corpo);
  };
  app.toast = () => {};
  app.setSyncBadge = (s) => { esp.selos.push(s); };
  app.render = () => {};
  app.buildNav = () => {};
  app.subirPendentes = () => {};
  app.CW.user = { id: quem.id, name: quem.name, email: quem.email, token: quem.token };
  return { app, esp };
}

// O estado de GET /api/state de uma conta, sem o status.
// Recebe: env; quem. Devolve: a promessa do estado.
async function lerEstado(env, quem) {
  const st = await estado(env, quem);
  assert.equal(st.status, 200);
  delete st.status;
  return st;
}

// Lê o estado e aplica-o, sem o envio que o applyState agenda (os testes
// chamam o pushNow à mão).
// Recebe: app; env; quem. Devolve: a promessa de nada.
async function ler(app, env, quem) {
  app.applyState(await lerEstado(env, quem));
  app.clearTimeout(app.pushTimer);
}

// As operações às definições entre as enviadas.
// Recebe: esp. Devolve: a lista.
const opsDasDefinicoes = (esp) => esp.ops.filter((o) => o.scope === 'user' && o.kind === 'settings');

// As definições como estão no servidor.
// Recebe: env; quem. Devolve: a promessa do objeto.
async function definicoesNoServidor(env, quem) {
  const r = await env.DB.prepare("SELECT data FROM user_records WHERE user_id = ? AND kind = 'settings' AND id = 'main'")
    .bind(quem.id).first();
  return JSON.parse(r.data);
}

/* Uma conta antiga na nuvem: as definições de antes das migrações no servidor.
   Recebe: nada.
   Devolve: a promessa de { env, A, velhas }. */
async function contaAntiga() {
  const env = ambiente();
  const A = await conta(env, 'Ana');
  const velhas = definicoesVelhas(carregarTudo());
  await dadoGlobal(env, A, 'settings', 'main', velhas);
  return { env, A, velhas };
}

/* ---------------- 1. as marcas de migração das definições ---------------- */

describe('as marcas de migração das definições sobem à nuvem uma vez', () => {
  test('a primeira leitura de uma conta antiga migra, e o envio seguinte leva as marcas e os valores migrados', async () => {
    const { env, A } = await contaAntiga();
    const { app, esp } = aparelho(env, A);
    await ler(app, env, A);
    assert.equal(app.db.settings.irsMapa['Seguros'], 'confirmar', 'a leitura migra o mapa');
    assert.ok(app.db.settings.cats['Impostos'].includes('IMT'), 'e as categorias');
    await app.pushNow();
    const ops = opsDasDefinicoes(esp);
    assert.equal(ops.length, 1, 'as definições sobem uma vez: ' + JSON.stringify(esp.ops.map((o) => o.kind)));
    assert.equal(ops[0].base.irsMapaV, null, 'a base diz que o servidor não tinha a marca');
    assert.equal(ops[0].base.irsMapa['Seguros'], 'outros', 'e o valor de antes da migração');
    const s = await definicoesNoServidor(env, A);
    assert.equal(s.irsMapaV, 3);
    assert.equal(s.catsV, 2);
    assert.equal(s.irsMapa['Seguros'], 'confirmar');
    assert.equal(s.irsMapa['Água, luz e gás'], 'confirmar');
    assert.ok(s.cats['Impostos'].includes('IMT'));
    assert.ok(s.catsIn['Rendas'].includes('Indemnização'));
    assert.equal(s.catIds.cats['Impostos / IMI'], 'impostos/imi', 'e os ids das categorias do IRS');
    assert.equal(s.growth, 2, 'o resto fica como estava');
    // e não volta a subir: a leitura seguinte já vem migrada
    esp.ops.length = 0;
    await ler(app, env, A);
    await app.pushNow();
    assert.equal(opsDasDefinicoes(esp).length, 0, 'uma vez só');
  });

  test('a escolha de propósito numa chave migrada e a subcategoria nova removida ficam — na leitura seguinte e noutro aparelho', async () => {
    const { env, A } = await contaAntiga();
    const { app } = aparelho(env, A);
    await ler(app, env, A);
    await app.pushNow();
    // a Ana escolhe «Outros gastos» nos Seguros e remove o IMT
    app.db.settings.irsMapa['Seguros'] = 'outros';
    app.db.settings.cats['Impostos'] = app.db.settings.cats['Impostos'].filter((s) => s !== 'IMT');
    await app.pushNow();
    await ler(app, env, A);
    assert.equal(app.db.settings.irsMapa['Seguros'], 'outros', 'a escolha não volta a «a confirmar»');
    assert.ok(!app.db.settings.cats['Impostos'].includes('IMT'), 'o IMT removido não volta');
    const outro = aparelho(env, A).app;
    await ler(outro, env, A);
    assert.equal(outro.db.settings.irsMapa['Seguros'], 'outros', 'nem noutro aparelho');
    assert.ok(!outro.db.settings.cats['Impostos'].includes('IMT'));
  });

  test('uma conta já migrada no servidor não envia nada; uma de outra versão mais nova também não', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const app0 = carregarTudo();
    const s = copia(app0.blank.settings);
    delete s.theme;
    await dadoGlobal(env, A, 'settings', 'main', Object.assign(s, { catsV: 3, irsMapaV: 3 }));
    const { app, esp } = aparelho(env, A, app0);
    await ler(app, env, A);
    assert.equal(app.db.settings.catsV, 3, 'uma marca maior fica como está');
    await app.pushNow();
    assert.equal(opsDasDefinicoes(esp).length, 0);
  });

  test('duas abas leem a conta antiga ao mesmo tempo: as duas migram igual, e a segunda não muda nada', async () => {
    const { env, A } = await contaAntiga();
    const um = aparelho(env, A), dois = aparelho(env, A);
    await ler(um.app, env, A);
    await ler(dois.app, env, A);
    await um.app.pushNow();
    const depoisDaPrimeira = await definicoesNoServidor(env, A);
    await dois.app.pushNow();
    assert.deepEqual(await definicoesNoServidor(env, A), depoisDaPrimeira);
  });

  test('um aparelho que leu antes e ficou sem rede não leva a migração por cima do que outro escolheu depois; o que mudou nele fica', async () => {
    const { env, A } = await contaAntiga();
    const velho = aparelho(env, A), novo = aparelho(env, A);
    await ler(velho.app, env, A);
    await ler(novo.app, env, A);
    // o aparelho novo migra, e a Ana escolhe lá «Outros gastos» nos Seguros
    await novo.app.pushNow();
    novo.app.db.settings.irsMapa['Seguros'] = 'outros';
    await novo.app.pushNow();
    // o velho mudou o crescimento sem rede, e a leitura dele já tem dois minutos
    velho.app.db.settings.growth = 3;
    velho.app.migracoesLidasEm = Date.now() - 2 * 60000;
    await velho.app.pushNow();
    assert.equal(opsDasDefinicoes(velho.esp).length, 0, 'as definições esperam pela leitura seguinte');
    assert.equal(velho.app.migracoesPorLer, true, 'e o ciclo lê já');
    assert.equal((await definicoesNoServidor(env, A)).irsMapa['Seguros'], 'outros');
    // a leitura seguinte: a escolha do outro aparelho fica, e o crescimento daqui também
    await ler(velho.app, env, A);
    assert.equal(velho.app.db.settings.irsMapa['Seguros'], 'outros');
    assert.equal(velho.app.db.settings.growth, 3);
    await velho.app.pushNow();
    const s = await definicoesNoServidor(env, A);
    assert.equal(s.irsMapa['Seguros'], 'outros');
    assert.equal(s.growth, 3);
    assert.equal(s.irsMapaV, 3);
  });

  test('o arranque com a base por migrar guardada: espera pela primeira leitura, e só então leva a migração', async () => {
    const { env, A } = await contaAntiga();
    const { app, esp } = aparelho(env, A);
    await ler(app, env, A);
    // a app fecha antes do envio; no arranque seguinte o retrato e as bases vêm do aparelho
    app.loadSnap();
    const base = copia(app.bases['u:settings:main']);
    assert.equal(base.irsMapaV, undefined, 'a base guardada continua sem a marca');
    assert.equal(base.irsMapa['Seguros'], 'outros', 'e com o valor por migrar');
    assert.deepEqual(copia(app.definicoesDaBase(base)), base, 'definicoesDaBase é idempotente');
    await app.pushNow();
    assert.equal(opsDasDefinicoes(esp).length, 0, 'antes da primeira leitura não sobe');
    await ler(app, env, A);
    await app.pushNow();
    assert.equal(opsDasDefinicoes(esp).length, 1);
    assert.equal((await definicoesNoServidor(env, A)).irsMapaV, 3);
  });

  test('a leitura que não mudou nada (um 304) devolve a frescura à base, e as definições sobem', async () => {
    const { env, A } = await contaAntiga();
    const { app, esp } = aparelho(env, A);
    await ler(app, env, A);
    app.migracoesLidasEm = Date.now() - 2 * 60000;
    await app.pushNow();
    assert.equal(opsDasDefinicoes(esp).length, 0);
    app.estadoIgual();
    app.clearTimeout(app.pushTimer);
    assert.equal(app.migracoesPorLer, false);
    await app.pushNow();
    assert.equal(opsDasDefinicoes(esp).length, 1, 'o servidor não mudou desde a base: ela volta a valer');
  });

  test('duas contas no mesmo aparelho: cada uma com a sua base, e a da outra não sobe', async () => {
    const { env, A } = await contaAntiga();
    const B = await conta(env, 'Bruno');
    const s = copia(carregarTudo().blank.settings);
    delete s.theme;
    await dadoGlobal(env, B, 'settings', 'main', Object.assign(s, { catsV: 2, irsMapaV: 3 }));
    const { app, esp } = aparelho(env, A);
    await ler(app, env, A);
    // a Ana sai sem enviar; o Bruno entra no mesmo aparelho
    app.CW.user = { id: B.id, name: B.name, email: B.email, token: B.token };
    app.loadSnap();
    await ler(app, env, B);
    await app.pushNow();
    assert.equal(opsDasDefinicoes(esp).length, 0, 'as definições do Bruno já estão migradas');
    const guardadas = (id) => JSON.parse(app.localStorage.getItem('gi_cloud_base_' + id) || '{}');
    assert.ok(guardadas(A.id)['u:settings:main'], 'a base da Ana fica guardada na chave dela');
    assert.ok(!guardadas(B.id)['u:settings:main'], 'e não passa para a do Bruno');
    // a Ana volta: espera pela leitura, e então a migração dela sobe
    app.CW.user = { id: A.id, name: A.name, email: A.email, token: A.token };
    app.loadSnap();
    await ler(app, env, A);
    await app.pushNow();
    assert.equal((await definicoesNoServidor(env, A)).irsMapaV, 3);
    assert.equal((await definicoesNoServidor(env, B)).irsMapaV, 3);
  });
});

/* --------------- 2. os campos das quotas são do servidor --------------- */

describe('os de fora e o histórico das quotas são do servidor no cliente (fundidoComServidor)', () => {
  const app = carregarTudo();
  afterEach(() => repor(app));

  const FORA = [{ id: 'f1', nome: 'Irmão', quota: 50 }];
  const HIST_VELHO = [{ ate: '2025-12-31', ownerIds: ['EU'], ownerShares: { EU: 100 }, fora: null }];
  const HIST_NOVO = [{ ate: '2026-06-30', ownerIds: ['EU'], ownerShares: { EU: 100 }, fora: null }];

  test('sem base, a lista dos de fora não se junta à do servidor: fica a dele', () => {
    const local = app.normProp({ id: 'H1', name: 'T2 mexida aqui', comproprietariosFora: FORA, quotasHist: HIST_VELHO });
    const servidor = app.normProp({ id: 'H1', name: 'T2', comproprietariosFora: [], quotasHist: HIST_NOVO });
    const f = copia(app.fundirCasaLocal(local, servidor, undefined));
    assert.deepEqual(f.comproprietariosFora, [], 'o «não há outros» do servidor, sem o Irmão da cópia velha');
    assert.deepEqual(f.quotasHist, HIST_NOVO);
  });

  test('com base, uma cópia mexida aqui não fica por cima do que o servidor tem; o resto da casa funde-se', () => {
    const base = app.stripHouse(app.normProp({ id: 'H1', name: 'T2', comproprietariosFora: null, quotasHist: HIST_VELHO }));
    const local = app.normProp({ id: 'H1', name: 'T2 Benfica', comproprietariosFora: FORA, quotasHist: [] });
    const servidor = app.normProp({ id: 'H1', name: 'T2', comproprietariosFora: [], quotasHist: HIST_NOVO });
    const f = copia(app.fundirCasaLocal(local, servidor, base));
    assert.equal(f.name, 'T2 Benfica', 'o nome mudado aqui fica');
    assert.deepEqual(f.comproprietariosFora, []);
    assert.deepEqual(f.quotasHist, HIST_NOVO);
  });
});

/* -------------------- 3. as propostas com fora e desde -------------------- */

describe('as propostas do estado levam fora e desde', () => {
  test('quem aprova vê os de fora e a data; sem fora, a proposta não os traz; fora null é «por confirmar»', async () => {
    relogio('2026-11-17T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
    await casa(env, A, 'H1', { name: 'T2' });
    await casa(env, A, 'H2', { name: 'T3' });
    await casa(env, A, 'H3', { name: 'T4' });
    await comproprietario(env, A, B, ['H1', 'H2', 'H3']);
    const propor = (hid, corpo) => resp(pedir(env, A, '/api/houses/' + hid + '/proposal', 'POST', corpo));
    assert.equal((await propor('H1', { shares: { [A.id]: 50, [B.id]: 50 }, fora: [{ nome: 'Irmão', quota: 20 }], desde: '2026-07-01' })).status, 201);
    assert.equal((await propor('H2', { shares: { [A.id]: 60, [B.id]: 40 } })).status, 201);
    assert.equal((await propor('H3', { shares: { [A.id]: 60, [B.id]: 40 }, fora: null })).status, 201);
    const st = await lerEstado(env, B);
    const de = (hid) => st.proposals.find((p) => p.houseId === hid);
    const p1 = de('H1');
    assert.equal(p1.desde, '2026-07-01');
    assert.equal(p1.fora.length, 1);
    assert.equal(p1.fora[0].nome, 'Irmão');
    assert.equal(p1.fora[0].quota, 20);
    assert.ok(p1.fora[0].id, 'com o id que o servidor lhe deu');
    const p2 = de('H2');
    assert.ok(!('fora' in p2), 'sem fora: a proposta não mexe nos de fora');
    assert.equal(p2.desde, null, 'sem data: a partir do dia em que se aplica');
    assert.equal(de('H3').fora, null, '«por confirmar»');
  });

  test('uma proposta com o fora estragado sai do estado (como a de shares estragado), e o resto vem', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
    await casa(env, A, 'H1', { name: 'T2' });
    await comproprietario(env, A, B, ['H1']);
    await env.DB.prepare('INSERT INTO share_proposals (house_id, proposed_by, shares, approvals, created_at, fora) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('H1', A.id, JSON.stringify({ [A.id]: 50, [B.id]: 50 }), JSON.stringify([A.id]), Date.now(), '{"nome":"x"}').run();
    const st = await lerEstado(env, B);
    assert.equal(st.proposals.length, 0);
    assert.equal(st.houses.length, 1);
  });

  test('o colaborador não vê as propostas da casa onde colabora', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno'), C = await conta(env, 'Carla');
    await casa(env, A, 'H1', { name: 'T2' });
    await comproprietario(env, A, B, ['H1']);
    const rid = await cargo(env, A, 'Gestão', ['house.edit'], 'R1');
    await darCargo(env, A, C, rid, ['H1']);
    const r = await resp(pedir(env, A, '/api/houses/H1/proposal', 'POST', { shares: { [A.id]: 50, [B.id]: 50 }, fora: [], desde: '2026-01-01' }));
    assert.equal(r.status, 201);
    const st = await lerEstado(env, C);
    assert.equal(st.houses.length, 1, 'a Carla vê a casa');
    assert.equal(st.proposals.length, 0, 'mas não a proposta');
  });
});

/* -------- 4. deixar de partilhar e tirar do grupo fecham o período -------- */

// Recebe: env; hid. Devolve: a promessa do JSON da casa.
const dadosDa = async (env, hid) => JSON.parse((await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(hid).first()).data);

/* A Ana (A) cria H1 e partilha-a com o Bruno (B) numa ligação, a 60/40, com
   uma proposta pendente.
   Devolve: a promessa de { env, A, B, cid }. */
async function partilhada() {
  const env = ambiente();
  const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
  await casa(env, A, 'H1', { name: 'T2 Benfica' });
  const cid = await comproprietario(env, A, B, ['H1']);
  const d = await dadosDa(env, 'H1');
  d.ownerShares = { [A.id]: 60, [B.id]: 40 };
  d.ownerIds = [A.id, B.id];
  await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?').bind(JSON.stringify(d), 'H1').run();
  await env.DB.prepare('INSERT INTO share_proposals (house_id, proposed_by, shares, approvals, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind('H1', A.id, JSON.stringify({ [A.id]: 50, [B.id]: 50 }), JSON.stringify([A.id]), Date.now()).run();
  return { env, A, B, cid };
}

/* O Bruno deixou de ter H1 a 2026-05-10: até 9/5 valiam os 60/40, e de 10/5
   em diante a casa é toda da Ana — e a proposta pendente caiu.
   Recebe: env, A, B.
   Devolve: a promessa de nada; falha a asserção se não for assim. */
async function fechouA9DeMaio(env, A, B) {
  const d = await dadosDa(env, 'H1');
  assert.deepEqual(d.ownerIds, [A.id]);
  assert.deepEqual(d.ownerShares, { [A.id]: 100 });
  assert.equal((d.quotasHist || []).length, 1, 'um período fechado: ' + JSON.stringify(d.quotasHist));
  assert.equal(d.quotasHist[0].ate, '2026-05-09', 'até ontem, em Lisboa');
  assert.deepEqual(d.quotasHist[0].ownerShares, { [A.id]: 60, [B.id]: 40 });
  assert.deepEqual(d.quotasHist[0].ownerIds.slice().sort(), [A.id, B.id].sort());
  const prop = await env.DB.prepare('SELECT 1 AS um FROM share_proposals WHERE house_id = ?').bind('H1').first();
  assert.equal(prop, null, 'a proposta pendente cai: já não bate com os participantes');
}

// Recebe: env; quem; path; method; corpo. Devolve: a promessa de {status, ...}.
const api = (env, quem, path, method, corpo) => resp(pedir(env, quem, path, method, corpo));

/* Um grupo da Ana com o Bruno lá dentro e a H1 nele (e na ligação também,
   se comLigacao).
   Recebe: comLigacao — se a casa continua partilhada na ligação.
   Devolve: a promessa de { env, A, B, cid }. */
async function noGrupo(comLigacao) {
  const { env, A, B, cid } = await partilhada();
  assert.equal((await api(env, A, '/api/shared-groups/G1', 'PUT', { name: 'Família' })).status, 201);
  await env.DB.prepare('INSERT INTO shared_group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)').bind('G1', B.id, Date.now()).run();
  assert.equal((await api(env, A, '/api/shared-groups/G1/houses', 'PUT', { houseIds: ['H1'] })).status, 200);
  // a ligação sai depois de a casa estar no grupo: o Bruno nunca deixa de a
  // ter, e pôr a casa no grupo não é uma entrada dele (não fecha período)
  if (!comLigacao) await env.DB.prepare('DELETE FROM shares WHERE connection_id = ?').bind(cid).run();
  return { env, A, B, cid };
}

describe('deixar de partilhar ou tirar do grupo fecha o período das quotas', () => {
  test('deixar de partilhar a casa na ligação', async () => {
    relogio('2026-05-10T10:00:00Z');
    const { env, A, B, cid } = await partilhada();
    assert.equal((await api(env, A, '/api/connections/' + cid + '/shares', 'PUT', { houseIds: [] })).status, 200);
    await fechouA9DeMaio(env, A, B);
  });

  test('cortar a ligação', async () => {
    relogio('2026-05-10T10:00:00Z');
    const { env, A, B, cid } = await partilhada();
    assert.equal((await api(env, B, '/api/connections/' + cid, 'DELETE')).status, 200);
    await fechouA9DeMaio(env, A, B);
  });

  test('tirar a casa do grupo, um a um e pelo conjunto', async () => {
    relogio('2026-05-10T10:00:00Z');
    let g = await noGrupo(false);
    assert.equal((await api(g.env, g.A, '/api/shared-groups/G1/houses/H1', 'DELETE')).status, 200);
    await fechouA9DeMaio(g.env, g.A, g.B);
    g = await noGrupo(false);
    assert.equal((await api(g.env, g.A, '/api/shared-groups/G1/houses', 'PUT', { houseIds: [] })).status, 200);
    await fechouA9DeMaio(g.env, g.A, g.B);
  });

  test('apagar o grupo, sair dele e ser removido', async () => {
    relogio('2026-05-10T10:00:00Z');
    let g = await noGrupo(false);
    assert.equal((await api(g.env, g.A, '/api/shared-groups/G1', 'DELETE')).status, 200);
    await fechouA9DeMaio(g.env, g.A, g.B);
    g = await noGrupo(false);
    assert.equal((await api(g.env, g.B, '/api/shared-groups/G1/members/' + g.B.id, 'DELETE')).status, 200);
    await fechouA9DeMaio(g.env, g.A, g.B);
    g = await noGrupo(false);
    assert.equal((await api(g.env, g.A, '/api/shared-groups/G1/members/' + g.B.id, 'DELETE')).status, 200);
    await fechouA9DeMaio(g.env, g.A, g.B);
  });

  test('quem ainda tem a casa por outro caminho não sai: nada fecha, e a proposta fica', async () => {
    relogio('2026-05-10T10:00:00Z');
    const { env, A } = await noGrupo(true);
    const antes = await dadosDa(env, 'H1');
    // a Ana tira a casa do grupo, mas o Bruno continua a tê-la pela ligação
    assert.equal((await api(env, A, '/api/shared-groups/G1/houses/H1', 'DELETE')).status, 200);
    assert.deepEqual(await dadosDa(env, 'H1'), antes);
    const prop = await env.DB.prepare('SELECT 1 AS um FROM share_proposals WHERE house_id = ?').bind('H1').first();
    assert.ok(prop, 'a proposta continua');
  });

  test('uma casa ilegível não se reescreve: a partilha acaba na mesma', async () => {
    relogio('2026-05-10T10:00:00Z');
    const { env, A, cid } = await partilhada();
    await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?').bind('{estragado', 'H1').run();
    assert.equal((await api(env, A, '/api/connections/' + cid + '/shares', 'PUT', { houseIds: [] })).status, 200);
    assert.equal((await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind('H1').first()).data, '{estragado');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM shares WHERE connection_id = ?').bind(cid).first();
    assert.equal(n.n, 0);
  });

  test('cortar uma ligação ainda por aceitar não mexe em nada', async () => {
    relogio('2026-05-10T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
    await casa(env, A, 'H1', { name: 'T2' });
    const r = await api(env, A, '/api/connections', 'POST', { peerId: B.id });
    assert.ok(r.id, 'a ligação pedida: ' + JSON.stringify(r));
    await env.DB.prepare('INSERT INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)').bind(r.id, A.id, 'H1').run();
    const antes = await dadosDa(env, 'H1');
    assert.equal((await api(env, A, '/api/connections/' + r.id, 'DELETE')).status, 200);
    assert.deepEqual(await dadosDa(env, 'H1'), antes);
  });
});
