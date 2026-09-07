// Colaboradores com cargos, convites de uso único e a ligação de partilha —
// de ponta a ponta contra o SQL a sério (testes/lib/bd.js). É a parte onde
// um engano mostra a hipoteca do dono a quem só marca visitas, ou mete um
// colaborador nas quotas; por isso os testes olham sobretudo para o que
// NÃO se pode: o que não se vê, o que não se escreve, o que não se gasta.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { baseDeTeste, kvFalso, r2Falso } from './lib/bd.js';
import { handleApi } from '../worker/src/api.js';
import { createSession } from '../worker/src/auth.js';
import {
  acessoACasa, podeNaCasa, casasDeColaborador, participantsOf, canAccessHouse, purgeAccount,
} from '../worker/src/lib/acesso.js';
import {
  PERMS, IMPLICA, KIND_PERM, CARGOS_EXEMPLO, normalizarPerms, projetarCasa, projetarRegisto,
  fundirCasa, podeVerKind, podeAddKind, kindsVisiveis,
} from '../worker/src/lib/permissoes.js';
import { definirDemo, esquecerCache } from '../worker/src/lib/planos.js';
import { mascararTokens } from '../worker/src/lib/relatos.js';

/* ------------------------------ armações ------------------------------- */

const ambiente = () => ({ DB: baseDeTeste(), SESSIONS: kvFalso(), FILES: r2Falso(), ENV_NAME: 'teste' });

let seq = 0;
// uma conta com sessão; o plano por omissão é free
async function conta(env, nome, plan) {
  const id = 'U' + String(++seq).padStart(7, '0');
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at, plan)
     VALUES (?, ?, ?, 'h', 's', ?, '2026-09-04', 1, ?)`
  ).bind(id, id.toLowerCase() + '@x.pt', nome, Date.now(), plan || 'free').run();
  return { id, token: await createSession(env, id, 0), name: nome };
}

// chama a API como o index.js chama: caminho, método, sessão (Bearer) e corpo JSON
function pedir(env, quem, path, method = 'GET', corpo, headers = {}) {
  const h = Object.assign({}, headers);
  if (quem) h.Authorization = 'Bearer ' + quem.token;
  if (corpo !== undefined) h['Content-Type'] = 'application/json';
  return handleApi(new Request('https://app.x.pt' + path, {
    method, headers: h, body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  }), env, { waitUntil() {} });
}
async function resp(p) {
  const r = await p;
  let j = null;
  try { j = await r.json(); } catch (e) {}
  return Object.assign({ status: r.status }, j || {});
}
const estado = (env, quem) => resp(pedir(env, quem, '/api/state'));
const sync = async (env, quem, ops) => (await resp(pedir(env, quem, '/api/sync', 'POST', { ops }))).results;

const casa = (env, dono, id, data) => env.DB.prepare(
  'INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)'
).bind(id, dono.id, JSON.stringify(Object.assign({ id, rooms: [] }, data)), Date.now()).run();

const registo = (env, houseId, kind, id, data, autor) => env.DB.prepare(
  `INSERT INTO records (house_id, kind, id, data, updated_at, deleted, author, created_by)
   VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
).bind(houseId, kind, id, JSON.stringify(Object.assign({ id }, data)), Date.now(), autor.id, autor.id).run();

const linha = (env, houseId, kind, id) => env.DB.prepare(
  'SELECT * FROM records WHERE house_id = ? AND kind = ? AND id = ?'
).bind(houseId, kind, id).first();

const perfil = (env, quem, data) => env.DB.prepare(
  `INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted) VALUES (?, 'profile', 'main', ?, ?, 0)`
).bind(quem.id, JSON.stringify(Object.assign({ id: quem.id, name: quem.name }, data)), Date.now()).run();

async function ficheiro(env, id, dono, houseId, kind, recordId) {
  await env.FILES.put(id, new Uint8Array([1, 2, 3]));
  await env.DB.prepare(
    `INSERT INTO files (id, owner_id, house_id, name, type, size, created_at, record_kind, record_id)
     VALUES (?, ?, ?, 'f.txt', 'text/plain', 3, ?, ?, ?)`
  ).bind(id, dono.id, houseId, Date.now(), kind, recordId).run();
}

// compropriedade à moda de sempre: conexão aceite + share
async function comproprietario(env, dono, outro, houseIds) {
  const cid = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO connections (id, requester_id, target_id, status, created_at) VALUES (?, ?, ?, 'accepted', ?)"
  ).bind(cid, dono.id, outro.id, Date.now()).run();
  for (const h of houseIds) {
    await env.DB.prepare('INSERT INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)')
      .bind(cid, dono.id, h).run();
  }
  return cid;
}

async function cargo(env, dono, name, perms, id) {
  const r = await resp(pedir(env, dono, '/api/roles/' + id, 'PUT', { name, perms }));
  assert.ok(r.status === 200 || r.status === 201, 'cargo criado: ' + JSON.stringify(r));
  return id;
}
async function convidar(env, dono, roleId, houseIds, label) {
  const r = await resp(pedir(env, dono, '/api/collab-invites', 'POST', { roleId, houseIds, label }));
  assert.equal(r.status, 201, 'convite criado: ' + JSON.stringify(r));
  return r;
}
const aceitar = (env, quem, token) => resp(pedir(env, quem, '/api/convite/' + token + '/aceitar', 'POST', {}));
async function darCargo(env, dono, quem, roleId, houseIds) {
  const inv = await convidar(env, dono, roleId, houseIds);
  const r = await aceitar(env, quem, inv.token);
  assert.equal(r.status, 200, 'aceite: ' + JSON.stringify(r));
  return r;
}

const H1 = {
  name: 'T2 Lisboa', address: 'Rua A', value: 250000, purchase: 200000, notes: 'privado', listing: 'anúncio',
  photos: [{ id: 'f_p' }], loans: [{ id: 'l1', bank: 'BCP', outstanding: 90000, files: [{ id: 'f_l' }] }],
  registry: '123/Lx',
};

/* O cenário de base: D é dono de H1 (partilhada com P, comproprietário) e
   de H2; C é a pessoa que vai receber cargos; H1 tem um registo de cada
   kind e anexos de contrato, inquilino, foto e hipoteca. */
async function armar(planoDono, planoColab) {
  const env = ambiente();
  const D = await conta(env, 'Dono', planoDono);
  const P = await conta(env, 'Parceiro');
  const C = await conta(env, 'Colab', planoColab);
  await casa(env, D, 'H1', H1);
  await casa(env, D, 'H2', { name: 'T1 Porto', address: 'Rua B' });
  await comproprietario(env, D, P, ['H1']);
  // as quotas escrevem-se pelo caminho das propostas; aqui vão direto
  await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?')
    .bind(JSON.stringify(Object.assign({ id: 'H1', rooms: [] }, H1, { ownerIds: [D.id, P.id], ownerShares: { [D.id]: 60, [P.id]: 40 } })), 'H1').run();
  await registo(env, 'H1', 'contract', 'c1', { name: 'Contrato', iban: 'PT50', tenantIds: ['t1'], files: [{ id: 'f_c' }] }, D);
  await registo(env, 'H1', 'tenant', 't1', { name: 'Inês', nif: '123', cc: '456', files: [{ id: 'f_t' }] }, D);
  await registo(env, 'H1', 'tx', 'x1', { label: 'Renda', amount: 500, paidBy: D.id }, D);
  await registo(env, 'H1', 'rec', 'r1', { label: 'Planeado' }, D);
  await registo(env, 'H1', 'visit', 'v1', { nomes: 'Zé' }, D);
  await ficheiro(env, 'f_c', D, 'H1', 'contract', 'c1');
  await ficheiro(env, 'f_t', D, 'H1', 'tenant', 't1');
  await ficheiro(env, 'f_p', D, 'H1', 'house.photos', 'H1');
  await ficheiro(env, 'f_l', D, 'H1', 'house.loans', 'H1');
  await perfil(env, D, { nif: '111' });
  await perfil(env, P, { nif: '222' });
  await perfil(env, C, { nif: '333' });
  const visitas = await cargo(env, D, 'Gestor de visitas', CARGOS_EXEMPLO[0].perms, 'R_VIS');
  const contab = await cargo(env, D, 'Contabilista', CARGOS_EXEMPLO[1].perms, 'R_CON');
  const vertudo = await cargo(env, D, 'Ver tudo', CARGOS_EXEMPLO[2].perms, 'R_VER');
  return { env, D, P, C, visitas, contab, vertudo };
}

const auditoria = async (env) => (await env.DB.prepare('SELECT * FROM audit_log ORDER BY id').all()).results;
const conta1 = async (env, sql, ...args) => ((await env.DB.prepare(sql).bind(...args).first()) || {}).n || 0;

/* ------------------------------ permissões ------------------------------ */

describe('as permissões (lista canónica, igual à do cliente)', () => {
  test('normalizarPerms aplica as implicações transitivamente e deita fora o lixo', () => {
    const p = normalizarPerms(['contract.add', 'x', 42, 'house.edit', 'contract.add']);
    assert.deepEqual(p, ['rec.view', 'rec.add', 'contract.view', 'contract.add', 'loan.view', 'file.view', 'house.edit']);
    assert.deepEqual(normalizarPerms(null), []);
    assert.deepEqual(normalizarPerms('tx.view'), [], 'uma string não é uma lista');
  });

  test('a ordem é a de PERMS e cada implicação aponta para permissões que existem', () => {
    Object.keys(IMPLICA).forEach((k) => {
      assert.ok(PERMS.includes(k), k);
      IMPLICA[k].forEach((v) => assert.ok(PERMS.includes(v), k + ' ⇒ ' + v));
    });
    PERMS.filter((p) => p.endsWith('.add')).forEach((p) => {
      assert.ok(normalizarPerms([p]).includes(p.replace('.add', '.view')), p + ' ⇒ view');
    });
  });

  test('os cargos de exemplo são válidos e KIND_PERM cobre os kinds do cliente', () => {
    CARGOS_EXEMPLO.forEach((c) => {
      assert.ok(c.nome && c.sub, c.nome);
      assert.deepEqual(normalizarPerms(c.perms), c.perms, c.nome + ' já vem normalizado');
    });
    assert.ok(CARGOS_EXEMPLO[2].perms.every((p) => p.endsWith('.view')), '«Ver tudo» não tem nenhum add');
    assert.deepEqual(Object.keys(KIND_PERM).sort(), ['contract', 'rec', 'tenant', 'tx', 'visit']);
    assert.equal(podeVerKind(new Set(['tx.view']), 'constructor'), false, 'kinds do protótipo não passam');
    assert.equal(podeAddKind(['tx.add'], 'tx'), true);
    assert.deepEqual(kindsVisiveis(['contract.view']), ['contract', 'tenant'], 'contract.view traz os inquilinos (despidos)');
  });

  test('projetarCasa despe conforme o cargo e nunca deixa passar as quotas', () => {
    const data = Object.assign({ ownerShares: { A: 50 }, ownerIds: ['A'] }, H1);
    const nada = projetarCasa(data, new Set());
    ['loans', 'photos', 'value', 'purchase', 'notes', 'listing', 'ownerShares'].forEach((k) => assert.ok(!(k in nada), k));
    assert.equal(nada.name, 'T2 Lisboa');
    assert.equal(nada.registry, '123/Lx', 'os dados registais ficam');
    const tudo = projetarCasa(data, new Set(['loan.view', 'file.view', 'report.view', 'house.edit']));
    ['loans', 'photos', 'value', 'purchase', 'notes', 'listing'].forEach((k) => assert.ok(k in tudo, k));
    assert.ok(!('ownerShares' in tudo), 'as quotas nunca');
    assert.ok('ownerShares' in data, 'o original não foi tocado');
  });

  test('projetarRegisto: inquilino só de contrato fica em {id, name}', () => {
    const t = { id: 't1', name: 'Inês', nif: '123' };
    assert.deepEqual(projetarRegisto('tenant', t, ['contract.view']), { id: 't1', name: 'Inês' });
    assert.equal(projetarRegisto('tenant', t, ['tenant.view']), t);
    assert.equal(projetarRegisto('tenant', t, ['tx.view']), null);
    assert.equal(projetarRegisto('tx', { id: 'x' }, ['tx.view']).id, 'x');
  });

  test('fundirCasa só deixa entrar o que o cargo vê', () => {
    const base = JSON.stringify(Object.assign({ ownerShares: { A: 60 }, ownerIds: ['A'] }, H1));
    const f = fundirCasa(base, { name: 'Novo', value: 0, ownerShares: { C: 100 }, ownerIds: ['C'], loans: [], notes: 'x' },
      new Set(normalizarPerms(['house.edit'])));
    assert.equal(f.name, 'Novo');
    assert.equal(f.value, 250000, 'sem report.view o valor fica o do dono');
    assert.deepEqual(f.ownerShares, { A: 60 });
    assert.deepEqual(f.ownerIds, ['A']);
    assert.deepEqual(f.loans, [], 'house.edit ⇒ loan.view: as hipotecas entram');
    assert.equal(f.notes, 'x');
    const semLoans = fundirCasa(base, { loans: [] }, new Set(['tx.view']));
    assert.equal(semLoans.loans.length, 1, 'sem loan.view as hipotecas não se tocam');
  });
});

/* ------------------------------ acesso ---------------------------------- */

describe('acesso por precedência: dono > comproprietário > colaborador', () => {
  test('os três graus, e o colaborador nunca em participants', async () => {
    const { env, D, P, C, visitas } = await armar();
    await darCargo(env, D, C, visitas, ['H1', 'H2']);
    const d = await acessoACasa(env, D.id, 'H1');
    assert.ok(d.ok && d.owner && !d.coowner && !d.collab);
    const p = await acessoACasa(env, P.id, 'H1');
    assert.ok(p.ok && !p.owner && p.coowner && !p.collab);
    assert.equal(p.ownerId, D.id);
    const c = await acessoACasa(env, C.id, 'H1');
    assert.ok(c.ok && !c.owner && !c.coowner && c.collab);
    assert.equal(c.collab.roleName, 'Gestor de visitas');
    assert.ok(c.collab.perms instanceof Set && c.collab.perms.has('visit.add'));
    assert.equal(podeNaCasa(c, 'visit.add'), true);
    assert.equal(podeNaCasa(c, 'tx.add'), false);
    assert.equal(podeNaCasa(p, 'tx.add'), true, 'comproprietário pode tudo');
    assert.equal(podeNaCasa(await acessoACasa(env, C.id, 'NAO'), 'visit.view'), false);

    assert.deepEqual(await participantsOf(env, 'H1'), [D.id, P.id], 'participants é dono + comproprietários');
    assert.equal((await canAccessHouse(env, C.id, 'H1')).ok, false, 'canAccessHouse não muda de significado');
    const mapa = await casasDeColaborador(env, C.id);
    assert.deepEqual([...mapa.keys()].sort(), ['H1', 'H2']);
    assert.equal(mapa.get('H2').ownerId, D.id);
  });

  test('quem já é comproprietário não vira colaborador por ter um cargo', async () => {
    const { env, D, P, visitas } = await armar();
    // a atribuição existe na base (por engano ou por ordem inversa)
    await env.DB.prepare("INSERT INTO collaborators (id, owner_id, user_id, role_id, created_at) VALUES ('CX', ?, ?, ?, 1)")
      .bind(D.id, P.id, visitas).run();
    await env.DB.prepare("INSERT INTO collaborator_houses (collaborator_id, house_id) VALUES ('CX', 'H1')").run();
    const p = await acessoACasa(env, P.id, 'H1');
    assert.ok(p.coowner && !p.collab, 'o grau mais alto manda');
    const st = await estado(env, P);
    const h = st.houses.find((x) => x.id === 'H1');
    assert.ok(!h.collab, 'no estado vem como casa partilhada, inteira');
    assert.ok(h.data.loans, 'com hipotecas');
  });
});

/* ------------------------------ o estado -------------------------------- */

describe('o estado de um colaborador é despido pelo cargo', () => {
  test('gestor de visitas: casa nua, só visitas e fichas, sem perfis nem propostas', async () => {
    const { env, D, P, C, visitas } = await armar();
    await env.DB.prepare("INSERT INTO share_proposals (house_id, proposed_by, shares, approvals, created_at) VALUES ('H1', ?, '{}', '[]', 1)").bind(D.id).run();
    await darCargo(env, D, C, visitas, ['H1']);
    const st = await estado(env, C);
    assert.equal(st.houses.length, 1);
    const h = st.houses[0];
    assert.equal(h.id, 'H1');
    assert.equal(h.mine, false);
    assert.deepEqual(h.participants, [D.id, P.id], 'os participantes reais — nunca eu');
    assert.ok(typeof h.collab.id === 'string' && h.collab.id, 'o id da linha de colaborador vem no estado (é por ele que se sai)');
    assert.deepEqual({ roleId: h.collab.roleId, roleName: h.collab.roleName, perms: h.collab.perms }, { roleId: visitas, roleName: 'Gestor de visitas', perms: CARGOS_EXEMPLO[0].perms });
    assert.equal(h.data.name, 'T2 Lisboa');
    ['loans', 'photos', 'value', 'purchase', 'notes', 'listing', 'ownerShares'].forEach((k) => assert.ok(!(k in h.data), k + ' não sai'));
    assert.deepEqual(st.records.map((r) => r.kind).sort(), ['tenant', 'visit'], 'só os kinds do cargo');
    const t = st.records.find((r) => r.kind === 'tenant');
    assert.equal(t.data.nif, '123', 'com tenant.view a ficha vem inteira');
    assert.equal(t.createdBy, D.id, 'cada registo leva o criador');
    assert.deepEqual(st.proposals, [], 'propostas nunca a colaboradores');
    const perfilD = st.profiles.find((p) => p.userId === D.id);
    assert.ok(perfilD && perfilD.name === 'Dono', 'o nome do dono vem');
    assert.equal(perfilD.data, null, 'o perfil (NIF, CC) não');
    assert.equal(st.profiles.find((p) => p.userId === P.id).data, null);
    assert.equal(st.profiles.find((p) => p.userId === C.id).data.nif, '333', 'o meu próprio vem');
    assert.ok(st.people.some((x) => x.id === D.id && x.kind === 'owner'));
    assert.deepEqual(st.roles, []);
    assert.deepEqual(st.collaborators, []);
    assert.deepEqual(st.shareLink, { ativo: false, uses: 0, createdAt: null });
  });

  test('contabilista: hipotecas, valor e fotos vêm; inquilinos só com id e nome; sem notas', async () => {
    const { env, D, C, contab } = await armar();
    await darCargo(env, D, C, contab, ['H1']);
    const st = await estado(env, C);
    const h = st.houses[0];
    assert.equal(h.data.loans[0].bank, 'BCP');
    assert.equal(h.data.value, 250000);
    assert.equal(h.data.photos.length, 1);
    assert.ok(!('notes' in h.data) && !('listing' in h.data) && !('ownerShares' in h.data));
    assert.deepEqual(st.records.map((r) => r.kind).sort(), ['contract', 'rec', 'tenant', 'tx']);
    assert.deepEqual(st.records.find((r) => r.kind === 'tenant').data, { id: 't1', name: 'Inês' });
    assert.equal(st.records.find((r) => r.kind === 'contract').data.iban, 'PT50');
  });

  test('o dono vê os colaboradores e as pessoas; o comproprietário vê o perfil do dono', async () => {
    const { env, D, P, C, visitas } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    const st = await estado(env, D);
    const h = st.houses.find((x) => x.id === 'H1');
    assert.deepEqual(h.participants, [D.id, P.id], 'o colaborador não entra em participants');
    assert.ok(!h.collab);
    assert.equal(st.collaborators.length, 1);
    assert.equal(st.collaborators[0].userId, C.id);
    assert.equal(st.collaborators[0].roleName, 'Gestor de visitas');
    assert.deepEqual(st.collaborators[0].houses, [{ id: 'H1', name: 'T2 Lisboa' }]);
    assert.equal(st.roles.length, 3);
    assert.equal(st.roles.find((r) => r.id === visitas).n, 1);
    const pessoaC = st.people.find((x) => x.id === C.id);
    assert.deepEqual(pessoaC, { id: C.id, name: 'Colab', kind: 'collab', roleName: 'Gestor de visitas' });
    assert.equal(st.profiles.find((p) => p.userId === C.id).data, null, 'o perfil do colaborador não vem ao dono');
    assert.equal(st.profiles.find((p) => p.userId === P.id).data.nif, '222', 'o do comproprietário sim');
    const stP = await estado(env, P);
    assert.equal(stP.profiles.find((p) => p.userId === D.id).data.nif, '111');
    assert.equal(stP.people.find((x) => x.id === C.id).kind, 'collab', 'o comproprietário sabe quem é colaborador');
    assert.deepEqual(stP.roles, [], 'mas os cargos são do dono');
  });

  test('cada casa minha ou partilhada comigo traz os seus colaboradores, em leitura', async () => {
    const { env, D, P, C, visitas, contab } = await armar();
    await darCargo(env, D, C, visitas, ['H1', 'H2']);
    const C2 = await conta(env, 'Colab 2');
    await darCargo(env, D, C2, contab, ['H2']);
    const stD = await estado(env, D);
    const idC = stD.collaborators.find((c) => c.userId === C.id).id;
    // o comproprietário de H1 fica a saber quem vê os movimentos — só não os gere
    const stP = await estado(env, P);
    const h1 = stP.houses.find((h) => h.id === 'H1');
    assert.deepEqual(h1.collaborators, [{ id: idC, userId: C.id, name: 'Colab', roleName: 'Gestor de visitas' }]);
    assert.deepEqual(stP.collaborators, [], 'a lista para gerir continua a ser só do dono');
    // o dono, por casa
    assert.deepEqual(stD.houses.find((h) => h.id === 'H1').collaborators.map((x) => x.userId), [C.id]);
    assert.deepEqual(stD.houses.find((h) => h.id === 'H2').collaborators.map((x) => [x.userId, x.roleName]).sort(),
      [[C.id, 'Gestor de visitas'], [C2.id, 'Contabilista']].sort());
    // um colaborador não vê os outros colaboradores da casa
    const stC = await estado(env, C);
    assert.ok(!('collaborators' in stC.houses.find((h) => h.id === 'H2')));
  });

  test('uma conexão aceite sem casa comum não dá o perfil', async () => {
    const env = ambiente();
    const A = await conta(env, 'A');
    const B = await conta(env, 'B');
    await perfil(env, B, { nif: '999' });
    await comproprietario(env, A, B, []);
    const st = await estado(env, A);
    const b = st.profiles.find((p) => p.userId === B.id);
    assert.ok(b, 'o nome vem — a conexão está na lista');
    assert.equal(b.data, null, 'o NIF não');
  });
});

/* ------------------------------ escritas -------------------------------- */

describe('POST /api/sync com cargo', () => {
  test('adiciona só os kinds permitidos; a casa é 403 sem house.edit', async () => {
    const { env, D, C, visitas } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    const r = await sync(env, C, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v2', data: { nomes: 'Ana' } },
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x2', data: { label: 'x' } },
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'zzz', id: 'z1', data: { a: 1 } },
      { op: 'put', scope: 'house', houseId: 'H1', data: { name: 'Roubada' } },
      { op: 'del', scope: 'house', houseId: 'H1' },
      { op: 'put', scope: 'record', houseId: 'H2', kind: 'visit', id: 'v9', data: { nomes: 'Fora' } },
    ]);
    assert.deepEqual(r[0], { ok: true });
    assert.equal(r[1].status, 403);
    assert.equal(r[1].error, 'Sem permissão para adicionar movimentos neste imóvel.');
    assert.equal(r[2].status, 403);
    assert.equal(r[3].status, 403);
    assert.equal(r[3].error, 'Sem permissão para editar a ficha deste imóvel.');
    assert.equal(r[4].status, 403);
    assert.equal(r[5].status, 403, 'H2 não está no cargo');
    const v2 = await linha(env, 'H1', 'visit', 'v2');
    assert.equal(v2.created_by, C.id);
    assert.equal(v2.author, C.id);
    assert.equal(await linha(env, 'H1', 'tx', 'x2'), null);
    assert.equal(JSON.parse((await env.DB.prepare("SELECT data FROM houses WHERE id = 'H1'").first()).data).name, 'T2 Lisboa');
  });

  test('edita e apaga só o que criou; created_by sobrevive à edição do dono', async () => {
    const { env, D, C, visitas } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    await sync(env, C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v2', data: { nomes: 'Ana' } }]);
    let r = await sync(env, C, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v1', data: { nomes: 'Mudei' } },
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v1' },
    ]);
    assert.equal(r[0].status, 403);
    assert.equal(r[0].error, 'Só podes alterar ou apagar o que tu criaste neste imóvel.');
    assert.equal(r[1].status, 403);
    assert.equal((await linha(env, 'H1', 'visit', 'v1')).deleted, 0);

    // o dono edita a visita do colaborador: author muda, created_by não
    r = await sync(env, D, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v2', data: { nomes: 'Ana B' } }]);
    assert.equal(r[0].ok, true);
    let v2 = await linha(env, 'H1', 'visit', 'v2');
    assert.equal(v2.author, D.id);
    assert.equal(v2.created_by, C.id);
    r = await sync(env, C, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v2', data: { nomes: 'Ana C' } },
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v2' },
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'visit', id: 'nunca' },
    ]);
    assert.equal(r[0].ok, true, 'continua a ser dele');
    assert.equal(r[1].ok, true);
    assert.deepEqual(r[2], { ok: true, gone: true });
    v2 = await linha(env, 'H1', 'visit', 'v2');
    assert.equal(v2.deleted, 1);
    // o dono e o comproprietário continuam a poder tudo, incluindo apagar o dos outros
  });

  test('o dono e o comproprietário continuam com tudo', async () => {
    const { env, D, P, C, visitas } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    await sync(env, C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v2', data: { nomes: 'Ana' } }]);
    const r = await sync(env, P, [
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x2', data: { label: 'ok' } },
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'zzz', id: 'z', data: { a: 1 } },
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v2' },
      { op: 'put', scope: 'house', houseId: 'H1', data: Object.assign({ id: 'H1' }, H1, { name: 'Mudada', ownerShares: { X: 1 } }) },
    ]);
    assert.ok(r.every((x) => x.ok), JSON.stringify(r));
    const h = JSON.parse((await env.DB.prepare("SELECT data FROM houses WHERE id = 'H1'").first()).data);
    assert.equal(h.name, 'Mudada');
    assert.deepEqual(h.ownerShares, { [D.id]: 60, [P.id]: 40 }, 'as quotas continuam a ser do servidor');
    assert.equal((await linha(env, 'H1', 'tx', 'x2')).created_by, P.id);
  });

  test('house.edit funde a ficha sem tocar no que o cargo não vê', async () => {
    const { env, D, P, C } = await armar();
    const editor = await cargo(env, D, 'Editor', ['house.edit'], 'R_EDT');
    await darCargo(env, D, C, editor, ['H1']);
    const st = await estado(env, C);
    assert.ok(!('value' in st.houses[0].data), 'não vê o valor');
    assert.ok(st.houses[0].data.loans, 'house.edit ⇒ loan.view');
    const r = await sync(env, C, [{
      op: 'put', scope: 'house', houseId: 'H1',
      data: { id: 'H1', name: 'Renomeada', value: 0, purchase: 0, ownerShares: { [C.id]: 100 }, ownerIds: [C.id], notes: 'do colab' },
    }]);
    assert.deepEqual(r[0], { ok: true });
    const h = JSON.parse((await env.DB.prepare("SELECT data FROM houses WHERE id = 'H1'").first()).data);
    assert.equal(h.name, 'Renomeada');
    assert.equal(h.notes, 'do colab');
    assert.equal(h.value, 250000, 'o valor não foi a zero');
    assert.equal(h.loans.length, 1, 'as hipotecas ficaram (não vinham no pedido)');
    assert.deepEqual(h.ownerIds, [D.id, P.id], 'ownerIds intactos');
    assert.equal(h.ownerShares[D.id], 60);
    assert.ok(!(C.id in h.ownerShares), 'o colaborador nunca ganha quota');
    // pela rota unitária, a mesma regra
    const put = await resp(pedir(env, C, '/api/houses/H1', 'PUT', { data: { id: 'H1', name: 'Outra vez', value: 1 } }));
    assert.equal(put.status, 200);
    const h2 = JSON.parse((await env.DB.prepare("SELECT data FROM houses WHERE id = 'H1'").first()).data);
    assert.equal(h2.name, 'Outra vez');
    assert.equal(h2.value, 250000);
  });

  test('PUT/DELETE /api/houses/:id/records aplicam as mesmas regras', async () => {
    const { env, D, C, visitas } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/records/tx/x9', 'PUT', { data: { label: 'x' } }))).status, 403);
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/records/visit/v1', 'PUT', { data: { nomes: 'x' } }))).status, 403);
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/records/visit/v1', 'DELETE'))).status, 403);
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/records/visit/v3', 'PUT', { data: { nomes: 'ok' } }))).status, 200);
    assert.equal((await linha(env, 'H1', 'visit', 'v3')).created_by, C.id);
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/records/visit/v3', 'DELETE'))).status, 200);
    assert.equal((await resp(pedir(env, C, '/api/houses/H1', 'PUT', { data: { name: 'x' } }))).status, 403);
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/proposal', 'POST', { shares: {} }))).status, 403, 'propostas nunca');
    assert.equal((await resp(pedir(env, C, '/api/houses/H1', 'DELETE'))).status, 403);
  });

  test('rec.add confirma o planeado do dono (put), mas não o apaga', async () => {
    const { env, D, C, visitas, contab } = await armar();
    await darCargo(env, D, C, contab, ['H1']);
    const rec = (op, data) => ({ op, scope: 'record', houseId: 'H1', kind: 'rec', id: 'r1', data });
    let r = await sync(env, C, [
      rec('put', { label: 'Planeado', next: '2026-10-01' }),   // confirmar avança o next
      rec('del'),
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x1', data: { label: 'Renda', amount: 1 } },
    ]);
    assert.deepEqual(r[0], { ok: true }, 'confirmar é um put do planeado do dono');
    assert.equal(r[1].status, 403);
    assert.equal(r[1].error, 'Só podes alterar ou apagar o que tu criaste neste imóvel.');
    assert.equal(r[2].status, 403, 'nos outros kinds a regra do criador mantém-se');
    const row = await linha(env, 'H1', 'rec', 'r1');
    assert.equal(JSON.parse(row.data).next, '2026-10-01');
    assert.equal(row.deleted, 0);
    assert.equal(row.created_by, D.id, 'o criador não muda');
    assert.equal(row.author, C.id, 'o último a escrever sim');
    // pela rota unitária, o mesmo (silenciar mexe em muted)
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/records/rec/r1', 'PUT', { data: { label: 'Planeado', muted: true } }))).status, 200);
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/records/rec/r1', 'DELETE'))).status, 403);
    assert.equal((await linha(env, 'H1', 'rec', 'r1')).deleted, 0);
    // sem rec.add, nem confirmar
    await darCargo(env, D, C, visitas, ['H1']);
    r = await sync(env, C, [rec('put', { label: 'Planeado', next: '2026-11-01' })]);
    assert.equal(r[0].status, 403);
    assert.equal(r[0].error, 'Sem permissão para adicionar planeados neste imóvel.');
  });
});

describe('o plano do dono da casa é o que manda', () => {
  test('dono free + colaborador pro → 402; dono plus + colaborador free → ok (fora de demo)', async () => {
    const a = await armar('free', 'pro');
    try {
      await definirDemo(a.env, false, 0);
      esquecerCache();
      // o contabilista de exemplo só VÊ contratos; para o plano contar é preciso um cargo que os crie
      const contratos = await cargo(a.env, a.D, 'Contratos', ['contract.add'], 'R_CTR');
      await darCargo(a.env, a.D, a.C, contratos, ['H1']);
      let r = await sync(a.env, a.C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'contract', id: 'c2', data: { name: 'novo' } }]);
      assert.equal(r[0].status, 402, JSON.stringify(r));
      assert.equal(await linha(a.env, 'H1', 'contract', 'c2'), null);
      r = await sync(a.env, a.C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'contract', id: 'c1', data: { name: 'existe' } }]);
      assert.equal(r[0].status, 403, 'editar o do dono continua a ser 403 — não é o plano que o trava');
      const rest = await resp(pedir(a.env, a.C, '/api/houses/H1/records/contract/c3', 'PUT', { data: { name: 'x' } }));
      assert.equal(rest.status, 402, 'a rota unitária também aplica o plano');
      // o comproprietário pro também esbarra no plano do dono
      const p = await resp(pedir(a.env, a.P, '/api/houses/H1/records/rec/r9', 'PUT', { data: { label: 'x' } }));
      assert.equal(p.status, 402);

      const b = await armar('plus', 'free');
      await definirDemo(b.env, false, 0);
      esquecerCache();
      await darCargo(b.env, b.D, b.C, await cargo(b.env, b.D, 'Contratos', ['contract.add'], 'R_CTR'), ['H1']);
      r = await sync(b.env, b.C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'contract', id: 'c2', data: { name: 'novo' } }]);
      assert.deepEqual(r[0], { ok: true });
    } finally {
      await definirDemo(a.env, true);
      esquecerCache();
    }
  });

  test('PUT /api/houses/:id de casa nova respeita o plano, como o sync (fora de demo)', async () => {
    const env = ambiente();
    const A = await conta(env, 'A', 'free');
    for (let i = 1; i <= 3; i++) await casa(env, A, 'HA' + i, { name: 'A' + i });
    try {
      await definirDemo(env, false, 0);
      esquecerCache();
      const r = await resp(pedir(env, A, '/api/houses/HA4', 'PUT', { data: { name: 'quarta' } }));
      assert.equal(r.status, 402);
      assert.equal(r.error, 'O plano free vai até 3 imóveis. O que criaste fica neste aparelho até mudares de plano.');
      assert.equal(await env.DB.prepare("SELECT 1 FROM houses WHERE id = 'HA4'").first(), null, 'a 4.ª casa não ficou');
      const s = await sync(env, A, [{ op: 'put', scope: 'house', houseId: 'HA4', data: { name: 'quarta' } }]);
      assert.equal(s[0].status, 402);
      assert.equal(s[0].error, r.error, 'a mesma frase pelos dois caminhos');
      // só a criação é travada: editar e reativar o que existe passa
      assert.equal((await resp(pedir(env, A, '/api/houses/HA1', 'PUT', { data: { name: 'editada' } }))).status, 200);
      await resp(pedir(env, A, '/api/houses/HA1', 'DELETE'));
      assert.equal((await resp(pedir(env, A, '/api/houses/HA1', 'PUT', { data: { name: 'de volta' } }))).status, 200, 'reativar');
      assert.equal((await resp(pedir(env, A, '/api/houses/HA4', 'PUT', { data: { name: 'quarta' } }))).status, 402, 'e continua a contar 3');
      // com plano plus, a 4.ª entra
      await env.DB.prepare("UPDATE users SET plan = 'plus' WHERE id = ?").bind(A.id).run();
      const Ap = { id: A.id, token: await createSession(env, A.id, 0) };
      assert.equal((await resp(pedir(env, Ap, '/api/houses/HA4', 'PUT', { data: { name: 'quarta' } }))).status, 200);
    } finally {
      await definirDemo(env, true);
      esquecerCache();
    }
  });
});

/* ------------------------------ anexos ---------------------------------- */

describe('anexos por permissão', () => {
  const ver = (env, quem, id) => pedir(env, quem, '/api/files/' + id).then((r) => r.status);

  test('ver segue o kind do registo, as fotos file.view e as hipotecas loan.view', async () => {
    const { env, D, C, visitas, contab, vertudo } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    for (const f of ['f_c', 'f_t', 'f_p', 'f_l']) assert.equal(await ver(env, C, f), 404, f + ' sem file.view');
    await darCargo(env, D, C, contab, ['H1']);   // substitui o cargo
    assert.equal(await ver(env, C, 'f_c'), 200, 'contrato');
    assert.equal(await ver(env, C, 'f_l'), 200, 'hipoteca com loan.view');
    assert.equal(await ver(env, C, 'f_p'), 200, 'foto com file.view');
    assert.equal(await ver(env, C, 'f_t'), 404, 'a ficha do inquilino não é do contabilista');
    await darCargo(env, D, C, vertudo, ['H1']);
    for (const f of ['f_c', 'f_t', 'f_p', 'f_l']) assert.equal(await ver(env, C, f), 200, f + ' com «Ver tudo»');
    const X = await conta(env, 'Estranho');
    assert.equal(await ver(env, X, 'f_c'), 404);
  });

  test('carregar exige file.add; apagar só o próprio', async () => {
    const { env, D, C, visitas, contab } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    const put = (quem, id) => handleApi(new Request('https://app.x.pt/api/files/' + id + '?casa=H1', {
      method: 'PUT', body: new Uint8Array([9, 9]),
      headers: { Authorization: 'Bearer ' + quem.token, 'X-Ficheiro-Tipo': 'text/plain', 'Content-Length': '2' },
    }), env, { waitUntil() {} });
    assert.equal((await put(C, 'novo1')).status, 403, 'visitas não tem file.add');
    await darCargo(env, D, C, contab, ['H1']);
    assert.equal((await put(C, 'novo1')).status, 200);
    // o anexo fica preso ao movimento quando o movimento é gravado
    await sync(env, C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x2', data: { label: 'recibo', files: [{ id: 'novo1' }] } }]);
    const f = await env.DB.prepare("SELECT * FROM files WHERE id = 'novo1'").first();
    assert.equal(f.record_kind, 'tx');
    assert.equal(f.record_id, 'x2');
    assert.equal(f.house_id, 'H1');
    // apagar o do dono: ok silencioso, mas fica
    assert.equal((await resp(pedir(env, C, '/api/files/f_c', 'DELETE'))).status, 200);
    assert.ok(await env.DB.prepare("SELECT 1 FROM files WHERE id = 'f_c'").first(), 'o anexo do dono ficou');
    assert.equal((await resp(pedir(env, C, '/api/files/novo1', 'DELETE'))).status, 200);
    assert.equal(await env.DB.prepare("SELECT 1 FROM files WHERE id = 'novo1'").first(), null, 'o próprio foi');
    assert.equal((await resp(pedir(env, D, '/api/files/f_c', 'DELETE'))).status, 200);
    assert.equal(await env.DB.prepare("SELECT 1 FROM files WHERE id = 'f_c'").first(), null, 'o dono apaga');
  });

  test('linkFiles não rouba anexos de outras contas', async () => {
    const { env, D, C, contab } = await armar();
    const X = await conta(env, 'Outra');
    await casa(env, X, 'H3', { name: 'Da X' });
    await ficheiro(env, 'f_x', X, 'H3', 'tx', 'tx1');
    await darCargo(env, D, C, contab, ['H1']);
    await sync(env, C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x5', data: { label: 'r', files: [{ id: 'f_x' }] } }]);
    const f = await env.DB.prepare("SELECT house_id FROM files WHERE id = 'f_x'").first();
    assert.equal(f.house_id, 'H3');
    assert.equal(await pedir(env, C, '/api/files/f_x').then((r) => r.status), 404);
  });

  test('um anexo sem kind (anterior à migração 0014) só sai para o dono e o comproprietário', async () => {
    const { env, D, P, C, vertudo } = await armar();
    await ficheiro(env, 'f_nulo', D, 'H1', null, null);   // carregado antes de haver record_kind
    await ficheiro(env, 'f_zzz', D, 'H1', 'zzz', 'z1');    // um kind que o servidor não conhece
    await darCargo(env, D, C, vertudo, ['H1']);
    assert.equal(await ver(env, C, 'f_nulo'), 404, 'com todos os .view — mas sem kind não se sabe que permissão o abre');
    assert.equal(await ver(env, C, 'f_zzz'), 404, 'kind desconhecido, o mesmo');
    assert.equal(await ver(env, D, 'f_nulo'), 200, 'o dono vê');
    assert.equal(await ver(env, P, 'f_nulo'), 200, 'o comproprietário também');
    // o dono volta a gravar a ficha: o anexo ganha kind e passa a seguir a regra dele
    await sync(env, D, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tenant', id: 't1', data: { name: 'Inês', files: [{ id: 'f_t' }, { id: 'f_nulo' }] } }]);
    assert.equal((await env.DB.prepare("SELECT record_kind FROM files WHERE id = 'f_nulo'").first()).record_kind, 'tenant');
    assert.equal(await ver(env, C, 'f_nulo'), 200, '«Ver tudo» tem tenant.view');
  });

  test('gravar um registo não re-etiqueta o anexo de outro registo da casa', async () => {
    const { env, D, C, contab } = await armar();
    await darCargo(env, D, C, contab, ['H1']);   // tx.add e file.add, sem tenant.view
    assert.equal(await ver(env, C, 'f_t'), 404, 'o CC do inquilino não é do contabilista');
    const r = await sync(env, C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x9', data: { label: 'r', files: [{ id: 'f_t' }] } }]);
    assert.deepEqual(r[0], { ok: true }, 'a gravação passa — é o anexo que fica onde estava');
    let f = await env.DB.prepare("SELECT record_kind, record_id FROM files WHERE id = 'f_t'").first();
    assert.equal(f.record_kind, 'tenant');
    assert.equal(f.record_id, 't1');
    assert.equal(await ver(env, C, 'f_t'), 404, 'e continua sem o ver');
    assert.equal((await resp(pedir(env, C, '/api/houses/H1/records/tx/x9', 'PUT', { data: { label: 'r', files: [{ id: 'f_t' }] } }))).status, 200);
    f = await env.DB.prepare("SELECT record_kind, record_id FROM files WHERE id = 'f_t'").first();
    assert.equal(f.record_id, 't1', 'pela rota unitária, o mesmo');
    // o dono, esse, move o que é dele
    await sync(env, D, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x1', data: { label: 'Renda', files: [{ id: 'f_t' }] } }]);
    f = await env.DB.prepare("SELECT record_kind, record_id FROM files WHERE id = 'f_t'").first();
    assert.equal(f.record_kind, 'tx');
    assert.equal(f.record_id, 'x1');
  });

  test('juntar anexos a um registo exige file.add — também pelo caminho do anexo solto', async () => {
    const { env, D, C } = await armar();
    const frase = 'Sem permissão para adicionar fotos e documentos neste imóvel.';
    const soTx = await cargo(env, D, 'Só movimentos', ['tx.add'], 'R_TX');
    const txAnexos = await cargo(env, D, 'Movimentos e anexos', ['tx.add', 'file.add'], 'R_TXF');
    await darCargo(env, D, C, soTx, ['H1']);
    // carregar solto (sem ?casa=) passa sempre — ainda não está em casa nenhuma
    const solto = (id) => handleApi(new Request('https://app.x.pt/api/files/' + id, {
      method: 'PUT', body: new Uint8Array([9]),
      headers: { Authorization: 'Bearer ' + C.token, 'X-Ficheiro-Tipo': 'text/plain', 'Content-Length': '1' },
    }), env, { waitUntil() {} });
    const anexo = (id) => env.DB.prepare('SELECT house_id, record_kind, record_id FROM files WHERE id = ?').bind(id).first();
    const tx = (data) => ({ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x10', data });
    assert.equal((await solto('solto1')).status, 200);
    let r = await sync(env, C, [tx({ label: 'recibo', files: [{ id: 'solto1' }] })]);
    assert.equal(r[0].status, 403);
    assert.equal(r[0].error, frase);
    assert.equal(await linha(env, 'H1', 'tx', 'x10'), null, 'o registo não se gravou');
    assert.equal((await anexo('solto1')).house_id, null, 'e o anexo continua solto');
    const u = await resp(pedir(env, C, '/api/houses/H1/records/tx/x10', 'PUT', { data: { label: 'recibo', files: [{ id: 'solto1' }] } }));
    assert.equal(u.status, 403, 'a rota unitária também');
    assert.equal(u.error, frase);
    r = await sync(env, C, [tx({ label: 'sem anexos' })]);
    assert.deepEqual(r[0], { ok: true }, 'sem anexos, tx.add chega');
    // com file.add passa, e o anexo fica preso ao registo
    await darCargo(env, D, C, txAnexos, ['H1']);
    r = await sync(env, C, [tx({ label: 'recibo', files: [{ id: 'solto1' }] })]);
    assert.deepEqual(r[0], { ok: true });
    let f = await anexo('solto1');
    assert.equal(f.house_id, 'H1');
    assert.equal(f.record_kind, 'tx');
    assert.equal(f.record_id, 'x10');
    // de volta ao cargo sem file.add: editar o registo sem juntar anexos novos passa; um novo, não
    await darCargo(env, D, C, soTx, ['H1']);
    r = await sync(env, C, [tx({ label: 'editado', amount: 1, files: [{ id: 'solto1' }] })]);
    assert.deepEqual(r[0], { ok: true }, 'o anexo já estava preso a este registo');
    assert.equal((await solto('solto2')).status, 200);
    r = await sync(env, C, [tx({ label: 'com mais um', files: [{ id: 'solto1' }, { id: 'solto2' }] })]);
    assert.equal(r[0].status, 403);
    assert.equal(r[0].error, frase);
    assert.equal(JSON.parse((await linha(env, 'H1', 'tx', 'x10')).data).label, 'editado', 'a edição recusada não ficou');
    f = await anexo('solto2');
    assert.equal(f.house_id, null);
  });
});

/* ------------------------------ convites -------------------------------- */

describe('o convite de uso único', () => {
  test('criar → ver sem sessão (não gasta) → aceitar → nunca mais', async () => {
    const { env, D, C, visitas } = await armar();
    const inv = await convidar(env, D, visitas, ['H1', 'H2'], 'Para a Ana');
    assert.match(inv.token, /^[a-f0-9]{64}$/);
    assert.equal(inv.url, 'https://app.x.pt/?convite=' + inv.token);
    assert.ok(Math.abs(inv.expiresAt - Date.now() - 7 * 86400000) < 60000, 'vale 7 dias');
    const guardado = await env.DB.prepare('SELECT token_hash FROM collab_invites').first();
    assert.notEqual(guardado.token_hash, inv.token, 'na base só o hash');

    const lista = await resp(pedir(env, D, '/api/collab-invites'));
    assert.equal(lista.invites.length, 1);
    assert.equal(lista.invites[0].id.length, 12);
    assert.equal(lista.invites[0].label, 'Para a Ana');
    assert.equal(lista.invites[0].roleName, 'Gestor de visitas');
    assert.deepEqual(lista.invites[0].houses.map((h) => h.name), ['T2 Lisboa', 'T1 Porto']);
    assert.ok(!JSON.stringify(lista).includes(inv.token), 'nunca o token');
    assert.equal((await estado(env, D)).invites.length, 1, 'e no estado do dono');

    const ver = () => resp(pedir(env, null, '/api/convite/' + inv.token));
    const v = await ver();
    assert.equal(v.status, 200);
    assert.deepEqual(v, { status: 200, ownerName: 'Dono', roleName: 'Gestor de visitas', perms: CARGOS_EXEMPLO[0].perms,
      houses: [{ name: 'T2 Lisboa' }, { name: 'T1 Porto' }], expiresAt: inv.expiresAt });
    await ver(); await ver();
    assert.equal((await env.DB.prepare('SELECT used_at FROM collab_invites').first()).used_at, null, 'ver não gasta');

    assert.equal((await aceitar(env, null, inv.token)).status, 401, 'aceitar exige sessão');
    const ok = await aceitar(env, C, inv.token);
    assert.equal(ok.status, 200);
    assert.equal(ok.ownerName, 'Dono');
    assert.equal(ok.roleName, 'Gestor de visitas');
    assert.deepEqual(ok.houses, [{ id: 'H1', name: 'T2 Lisboa' }, { id: 'H2', name: 'T1 Porto' }]);
    assert.deepEqual(ok.saltadas, []);
    assert.equal((await env.DB.prepare('SELECT used_by FROM collab_invites').first()).used_by, C.id);

    const C2 = await conta(env, 'Segunda');
    const outra = await aceitar(env, C2, inv.token);
    assert.equal(outra.status, 404);
    assert.equal(outra.error, 'Essa ligação já foi usada, expirou, ou não existe. Pede outra a quem te convidou.');
    assert.equal((await ver()).status, 404, 'e a pré-visualização também já não mostra');
    assert.equal((await resp(pedir(env, D, '/api/collab-invites'))).invites.length, 0, 'saiu da lista');
    assert.ok((await auditoria(env)).some((x) => x.acao === 'colab.entrar' && x.quem === C.id && x.alvo === D.id));
    assert.ok((await auditoria(env)).some((x) => x.acao === 'colab.convite.criar' && x.quem === D.id));
  });

  test('dois cliques ao mesmo tempo: só um entra', async () => {
    const { env, D, visitas } = await armar();
    const inv = await convidar(env, D, visitas, ['H1']);
    const A = await conta(env, 'A'), B = await conta(env, 'B');
    const rs = await Promise.all([aceitar(env, A, inv.token), aceitar(env, B, inv.token), aceitar(env, A, inv.token)]);
    assert.equal(rs.filter((r) => r.status === 200).length, 1);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM collaborators'), 1);
  });

  test('expirado, revogado, cargo apagado, token inventado: o mesmo 404', async () => {
    const { env, D, C, visitas, contab } = await armar();
    const frase = 'Essa ligação já foi usada, expirou, ou não existe. Pede outra a quem te convidou.';
    const velho = await convidar(env, D, visitas, ['H1']);
    await env.DB.prepare('UPDATE collab_invites SET expires_at = ? WHERE token_hash = (SELECT token_hash FROM collab_invites LIMIT 1)').bind(Date.now() - 1).run();
    let r = await aceitar(env, C, velho.token);
    assert.equal(r.status, 404); assert.equal(r.error, frase);
    assert.equal((await resp(pedir(env, null, '/api/convite/' + velho.token))).status, 404);

    const rev = await convidar(env, D, visitas, ['H2']);
    const X = await conta(env, 'Estranha');
    assert.equal((await resp(pedir(env, X, '/api/collab-invites/' + rev.id, 'DELETE'))).status, 404, 'só o dono revoga');
    assert.equal((await resp(pedir(env, D, '/api/collab-invites/' + rev.id, 'DELETE'))).status, 200);
    r = await aceitar(env, C, rev.token);
    assert.equal(r.status, 404); assert.equal(r.error, frase);
    assert.ok((await auditoria(env)).some((x) => x.acao === 'colab.convite.revogar'));

    const semCargo = await convidar(env, D, contab, ['H1']);
    assert.equal((await resp(pedir(env, D, '/api/roles/' + contab, 'DELETE'))).status, 200);
    r = await aceitar(env, C, semCargo.token);
    assert.equal(r.status, 404); assert.equal(r.error, frase);

    r = await aceitar(env, C, 'a'.repeat(64));
    assert.equal(r.status, 404); assert.equal(r.error, frase);
    assert.equal((await resp(pedir(env, null, '/api/convite/nao-hex'))).status, 404);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM collaborators'), 0, 'nada entrou');
  });

  test('a D1 a falhar na pré-visualização: o mesmo 404, e o relato sem o token', async () => {
    const env = ambiente();
    await conta(env, 'Alguém');   // o relato pendura-se no primeiro utilizador
    const token = 'a'.repeat(64);
    assert.equal(mascararTokens('/api/convite/' + token), '/api/convite/…');
    assert.equal(mascararTokens('POST /api/ligar/' + token + '/pedir'), 'POST /api/ligar/…/pedir');
    assert.equal(mascararTokens('https://app.x.pt/?convite=' + token + '&x=1'), 'https://app.x.pt/?convite=…&x=1');
    assert.equal(mascararTokens(null), '');
    assert.equal(mascararTokens('/api/convite/nao-hex'), '/api/convite/nao-hex', 'só o que tem forma de token');
    // a D1 cai a meio da consulta do convite
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => {
      if (/collab_invites/.test(sql)) throw new Error('D1 em baixo');
      return prepare(sql);
    };
    const pendentes = [];
    const r = await resp(handleApi(new Request('https://app.x.pt/api/convite/' + token), env, { waitUntil(p) { pendentes.push(p); } }));
    env.DB.prepare = prepare;
    await Promise.all(pendentes);
    assert.equal(r.status, 404);
    assert.equal(r.error, 'Essa ligação já foi usada, expirou, ou não existe. Pede outra a quem te convidou.');
    const tickets = (await env.DB.prepare('SELECT * FROM tickets').all()).results;
    assert.equal(tickets.length, 1, 'ficou um relato para quem programa');
    assert.ok(!JSON.stringify(tickets).includes(token), 'sem o token em claro');
    assert.ok(tickets[0].body.startsWith('GET /api/convite/…'), tickets[0].body);
    // um token que não existe não é um erro: o mesmo 404 e nenhum relato
    assert.equal((await resp(pedir(env, null, '/api/convite/' + 'b'.repeat(64)))).status, 404);
    assert.equal((await resp(pedir(env, null, '/api/ligar/' + 'b'.repeat(64)))).status, 404);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM tickets'), 1);
  });

  test('o dono não aceita o seu; o comproprietário salta as casas onde já está; o cargo substitui-se', async () => {
    const { env, D, P, C, visitas, contab } = await armar();
    const inv = await convidar(env, D, visitas, ['H1', 'H2']);
    const self = await aceitar(env, D, inv.token);
    assert.equal(self.status, 400);
    assert.equal(self.error, 'A ligação é tua — envia-a a quem vai colaborar.');
    assert.equal((await env.DB.prepare('SELECT used_at FROM collab_invites').first()).used_at, null, 'sem gastar');

    const p = await aceitar(env, P, inv.token);
    assert.equal(p.status, 200);
    assert.deepEqual(p.houses, [{ id: 'H2', name: 'T1 Porto' }]);
    assert.deepEqual(p.saltadas, [{ name: 'T2 Lisboa' }]);
    assert.deepEqual(await participantsOf(env, 'H1'), [D.id, P.id], 'em H1 continua comproprietário e só');
    assert.equal((await acessoACasa(env, P.id, 'H2')).collab.roleName, 'Gestor de visitas');

    // C entra como visitas em H1 e H2; depois como contabilista só em H1
    await darCargo(env, D, C, visitas, ['H1', 'H2']);
    await darCargo(env, D, C, contab, ['H1']);
    const mapa = await casasDeColaborador(env, C.id);
    assert.equal(mapa.get('H1').roleName, 'Contabilista', 'o cargo novo substitui na mesma casa');
    assert.equal(mapa.get('H2').roleName, 'Gestor de visitas', 'a outra casa fica como estava');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM collaborators WHERE user_id = ?', C.id), 2, 'uma linha por cargo');
    const st = await estado(env, D);
    assert.equal(st.collaborators.filter((c) => c.userId === C.id).length, 2);
  });

  test('só o dono das casas cria, com cargo seu, e até 20 por usar', async () => {
    const { env, D, P, C, visitas } = await armar();
    const tenta = (quem, corpo) => resp(pedir(env, quem, '/api/collab-invites', 'POST', corpo));
    assert.equal((await tenta(P, { roleId: visitas, houseIds: ['H1'] })).status, 404, 'o cargo não é do comproprietário');
    const dele = await cargo(env, P, 'Meu', ['tx.view'], 'R_P');
    assert.equal((await tenta(P, { roleId: dele, houseIds: ['H1'] })).status, 403, 'a casa não é dele');
    assert.equal((await tenta(D, { roleId: visitas, houseIds: [] })).status, 400);
    assert.equal((await tenta(D, { roleId: visitas, houseIds: ['NAO'] })).status, 403);
    assert.equal((await tenta(D, { roleId: 'nao-existe', houseIds: ['H1'] })).status, 404);
    for (let i = 0; i < 20; i++) {
      await env.DB.prepare('INSERT INTO collab_invites (token_hash, owner_id, role_id, house_ids, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('h' + i, D.id, visitas, '["H1"]', Date.now(), Date.now() + 1e6).run();
    }
    assert.equal((await tenta(D, { roleId: visitas, houseIds: ['H1'] })).status, 429);
    void C;
  });
});

/* ------------------------------ colaboradores --------------------------- */

describe('remover, sair e mudar o cargo', () => {
  test('remover pelo dono ou sair pelo próprio corta o acesso no ato', async () => {
    const { env, D, P, C, visitas } = await armar();
    await darCargo(env, D, C, visitas, ['H1', 'H2']);
    const id = (await estado(env, D)).collaborators[0].id;
    assert.equal((await resp(pedir(env, P, '/api/collaborators/' + id, 'DELETE'))).status, 404, 'o comproprietário não gere');
    assert.equal((await resp(pedir(env, D, '/api/collaborators/' + id, 'DELETE'))).status, 200);
    assert.equal((await estado(env, C)).houses.length, 0);
    assert.equal((await sync(env, C, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v5', data: {} }]))[0].status, 403);
    assert.deepEqual(await sync(env, C, [{ op: 'del', scope: 'record', houseId: 'H1', kind: 'visit', id: 'v1' }]), [{ ok: true, gone: true }]);

    await darCargo(env, D, C, visitas, ['H1']);
    const id2 = (await estado(env, D)).collaborators[0].id;
    assert.equal((await resp(pedir(env, C, '/api/collaborators/' + id2, 'DELETE'))).status, 200, 'sair');
    assert.equal((await estado(env, C)).houses.length, 0);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM collaborator_houses'), 0);
    const acoes = (await auditoria(env)).map((x) => x.acao);
    assert.ok(acoes.includes('colab.remover') && acoes.includes('colab.sair'));
  });

  test('o dono muda o cargo e as casas; o comproprietário não', async () => {
    const { env, D, P, C, visitas, contab } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    const id = (await estado(env, D)).collaborators[0].id;
    assert.equal((await resp(pedir(env, P, '/api/collaborators/' + id, 'PUT', { roleId: contab }))).status, 404);
    assert.equal((await resp(pedir(env, D, '/api/collaborators/' + id, 'PUT', { roleId: 'R_P' }))).status, 404, 'cargo que não existe');
    assert.equal((await resp(pedir(env, D, '/api/collaborators/' + id, 'PUT', { houseIds: [] }))).status, 400);
    assert.equal((await resp(pedir(env, D, '/api/collaborators/' + id, 'PUT', { houseIds: ['NAO'] }))).status, 403);
    const r = await resp(pedir(env, D, '/api/collaborators/' + id, 'PUT', { roleId: contab, houseIds: ['H1', 'H2'] }));
    assert.equal(r.status, 200);
    const mapa = await casasDeColaborador(env, C.id);
    assert.equal(mapa.get('H1').roleName, 'Contabilista');
    assert.equal(mapa.get('H2').roleName, 'Contabilista');
    const st = await estado(env, C);
    assert.deepEqual(st.records.map((x) => x.kind).sort(), ['contract', 'rec', 'tenant', 'tx']);
  });
});

describe('cargos', () => {
  test('são do próprio; em uso não se apagam; mudar as permissões reflete-se no estado', async () => {
    const { env, D, C, visitas } = await armar();
    assert.equal((await resp(pedir(env, C, '/api/roles'))).roles.length, 0);
    assert.equal((await resp(pedir(env, D, '/api/roles'))).roles.length, 3);
    assert.equal((await resp(pedir(env, C, '/api/roles/' + visitas, 'PUT', { name: 'Meu', perms: ['tx.view'] }))).status, 404, 'o id de outro não se toca');
    assert.equal((await resp(pedir(env, C, '/api/roles/' + visitas, 'DELETE'))).status, 404);
    assert.equal((await resp(pedir(env, D, '/api/roles/R_X', 'PUT', { name: 'x'.repeat(41), perms: ['tx.view'] }))).status, 400);
    assert.equal((await resp(pedir(env, D, '/api/roles/R_X', 'PUT', { name: 'Vazio', perms: [] }))).status, 400);
    const novo = await resp(pedir(env, D, '/api/roles/R_X', 'PUT', { name: ' Só somar ', perms: ['tx.add', 'lixo'] }));
    assert.equal(novo.status, 201);
    assert.deepEqual(novo.role, { id: 'R_X', name: 'Só somar', perms: ['tx.view', 'tx.add'] });

    await darCargo(env, D, C, visitas, ['H1']);
    const del = await resp(pedir(env, D, '/api/roles/' + visitas, 'DELETE'));
    assert.equal(del.status, 409);
    assert.equal(del.error, 'Este cargo está atribuído a 1 pessoa — troca-lhes o cargo primeiro.');
    // mais permissões no cargo: o colaborador passa a ver movimentos
    assert.equal((await estado(env, C)).records.some((r) => r.kind === 'tx'), false);
    const upd = await resp(pedir(env, D, '/api/roles/' + visitas, 'PUT', { name: 'Gestor de visitas', perms: [...CARGOS_EXEMPLO[0].perms, 'tx.view'] }));
    assert.equal(upd.status, 200);
    const st = await estado(env, C);
    assert.equal(st.records.some((r) => r.kind === 'tx'), true);
    assert.ok(st.houses[0].collab.perms.includes('tx.view'));
    const id = (await estado(env, D)).collaborators[0].id;
    await resp(pedir(env, D, '/api/collaborators/' + id, 'DELETE'));
    assert.equal((await resp(pedir(env, D, '/api/roles/' + visitas, 'DELETE'))).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/roles'))).roles.length, 3, 'dois de origem + o novo');
  });
});

/* ------------------------------ a ligação -------------------------------- */

describe('a ligação de partilha', () => {
  const pedirPartilha = (env, quem, token, houseIds) => resp(pedir(env, quem, '/api/ligar/' + token + '/pedir', 'POST', { houseIds }));

  test('criar → ver → pedir → o dono aceita e fica comproprietário; recusar; cancelar', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const B = await conta(env, 'Bruno');
    await perfil(env, D, { nif: '111' });
    await perfil(env, B, { nif: '222' });
    await casa(env, B, 'HB1', { name: 'Casa B1' });
    await casa(env, B, 'HB2', { name: 'Casa B2' });
    await casa(env, B, 'HB3', { name: 'Casa B3' });
    await registo(env, 'HB1', 'tx', 'x1', { label: 'renda' }, B);

    assert.deepEqual(await resp(pedir(env, D, '/api/share-link')), { status: 200, ativo: false, uses: 0, createdAt: null });
    const lig = await resp(pedir(env, D, '/api/share-link', 'POST', {}));
    assert.equal(lig.status, 201);
    const token = /\?ligar=([a-f0-9]{64})$/.exec(lig.url)[1];
    assert.ok(!token.includes(D.id), 'não deriva do id');
    assert.equal((await env.DB.prepare('SELECT token_hash FROM share_links').first()).token_hash.length, 64);
    assert.notEqual((await env.DB.prepare('SELECT token_hash FROM share_links').first()).token_hash, token, 'só o hash');
    const g = await resp(pedir(env, D, '/api/share-link'));
    assert.equal(g.ativo, true); assert.equal(g.uses, 0); assert.ok(!g.url, 'o url só sai na criação');

    const pre = await resp(pedir(env, null, '/api/ligar/' + token));
    assert.deepEqual(pre, { status: 200, ownerName: 'Dono' }, 'só o nome');
    assert.equal((await resp(pedir(env, null, '/api/ligar/' + 'b'.repeat(64)))).error, 'Esta ligação não serve.');
    assert.equal((await pedirPartilha(env, null, token, ['HB1'])).status, 401);
    assert.deepEqual(await pedirPartilha(env, D, token, ['HB1']), { status: 400, error: 'A ligação é tua.' });
    assert.equal((await pedirPartilha(env, B, token, ['NAO'])).status, 403);
    assert.equal((await pedirPartilha(env, B, token, [])).status, 400);

    const p = await pedirPartilha(env, B, token, ['HB1', 'HB2']);
    assert.deepEqual(p, { status: 200, pedidos: 2, saltadas: [] });
    assert.equal((await resp(pedir(env, D, '/api/share-link'))).uses, 1);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM connections'), 0, 'um pedido não é uma conexão');

    let stD = await estado(env, D);
    assert.equal(stD.houses.length, 0, 'nada entrou');
    assert.equal(stD.records.length, 0);
    assert.equal(stD.shareRequests.incoming.length, 2);
    assert.equal(stD.shareRequests.incoming[0].fromName, 'Bruno');
    assert.ok(['Casa B1', 'Casa B2'].includes(stD.shareRequests.incoming[0].houseName));
    assert.equal((stD.profiles.find((x) => x.userId === B.id) || {}).data, undefined, 'nem sequer o perfil');
    let stB = await estado(env, B);
    assert.equal(stB.shareRequests.outgoing.length, 2);
    assert.equal(stB.shareRequests.outgoing[0].toName, 'Dono');
    assert.equal((stB.profiles.find((x) => x.userId === D.id) || {}).data, undefined);

    const [r1, r2] = stD.shareRequests.incoming.map((x) => x.id);
    assert.equal((await resp(pedir(env, B, '/api/share-requests/' + r1 + '/accept', 'POST', {}))).status, 403, 'só o destinatário aceita');
    const ac = await resp(pedir(env, D, '/api/share-requests/' + r1 + '/accept', 'POST', {}));
    assert.equal(ac.status, 200);
    const casaAceite = stD.shareRequests.incoming.find((x) => x.id === r1).houseId;
    assert.equal((await canAccessHouse(env, D.id, casaAceite)).ok, true, 'o dono da ligação passou a comproprietário');
    assert.deepEqual(await participantsOf(env, casaAceite), [B.id, D.id]);
    const conn = await env.DB.prepare('SELECT * FROM connections').first();
    assert.equal(conn.status, 'accepted');
    assert.equal(conn.requester_id, B.id);
    stD = await estado(env, D);
    assert.equal(stD.houses.length, 1);
    assert.equal(stD.houses[0].mine, false);
    assert.deepEqual(stD.houses[0].participants, [B.id, D.id]);
    assert.equal(stD.profiles.find((x) => x.userId === B.id).data.nif, '222', 'agora há casa comum: o perfil vem');
    assert.equal(stD.shareRequests.incoming.length, 1);
    assert.equal((await resp(pedir(env, D, '/api/share-requests/' + r1 + '/accept', 'POST', {}))).status, 409, 'já respondido');

    assert.equal((await resp(pedir(env, D, '/api/share-requests/' + r2 + '/reject', 'POST', {}))).status, 200);
    assert.equal((await env.DB.prepare('SELECT status FROM share_requests WHERE id = ?').bind(r2).first()).status, 'rejected');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shares'), 1, 'recusar não cria nada');
    // depois de recusado, pode pedir-se de novo (e o pedido volta a pendente)
    assert.equal((await pedirPartilha(env, B, token, ['HB2'])).pedidos, 1);
    const r2b = (await estado(env, D)).shareRequests.incoming[0].id;
    assert.equal(r2b, r2, 'a mesma linha, de volta a pendente');
    assert.equal((await resp(pedir(env, D, '/api/share-requests/' + r2b, 'DELETE'))).status, 403, 'só quem pediu cancela');
    assert.equal((await resp(pedir(env, B, '/api/share-requests/' + r2b, 'DELETE'))).status, 200);
    assert.equal((await estado(env, D)).shareRequests.incoming.length, 0);
    // a casa já partilhada salta-se
    assert.deepEqual(await pedirPartilha(env, B, token, [casaAceite]), { status: 200, pedidos: 0, saltadas: [{ id: casaAceite, name: casaAceite === 'HB1' ? 'Casa B1' : 'Casa B2' }] });

    const acoes = (await auditoria(env)).map((x) => x.acao);
    ['partilha.link.criar', 'partilha.pedido.criar', 'partilha.pedido.aceitar', 'partilha.pedido.recusar', 'partilha.pedido.cancelar']
      .forEach((a) => assert.ok(acoes.includes(a), a));
  });

  test('rodar invalida o antigo; revogar fecha a porta; os pedidos pendentes ficam', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const B = await conta(env, 'B');
    await casa(env, B, 'HB1', { name: 'B1' });
    const t1 = /ligar=(\w+)/.exec((await resp(pedir(env, D, '/api/share-link', 'POST', {}))).url)[1];
    await pedirPartilha(env, B, t1, ['HB1']);
    const r2 = await resp(pedir(env, D, '/api/share-link', 'POST', {}));
    assert.equal(r2.status, 200, 'rodar');
    const t2 = /ligar=(\w+)/.exec(r2.url)[1];
    assert.notEqual(t1, t2);
    assert.equal((await resp(pedir(env, null, '/api/ligar/' + t1))).status, 404);
    assert.equal((await resp(pedir(env, null, '/api/ligar/' + t2))).status, 200);
    assert.equal((await pedirPartilha(env, B, t1, ['HB1'])).status, 404);
    assert.equal((await resp(pedir(env, D, '/api/share-link'))).uses, 0, 'a ligação nova começa do zero');
    assert.equal((await resp(pedir(env, D, '/api/share-link', 'DELETE'))).status, 200);
    assert.equal((await resp(pedir(env, null, '/api/ligar/' + t2))).status, 404);
    assert.equal((await estado(env, D)).shareLink.ativo, false);
    assert.equal((await estado(env, D)).shareRequests.incoming.length, 1, 'quem já pediu continua à espera');
    const acoes = (await auditoria(env)).map((x) => x.acao);
    assert.ok(acoes.includes('partilha.link.rodar') && acoes.includes('partilha.link.revogar'));
  });

  test('uma partilha aceite e depois cortada pode pedir-se de novo pela ligação', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const B = await conta(env, 'B');
    await casa(env, B, 'HB1', { name: 'B1' });
    const t = /ligar=(\w+)/.exec((await resp(pedir(env, D, '/api/share-link', 'POST', {}))).url)[1];
    await pedirPartilha(env, B, t, ['HB1']);
    const id = (await estado(env, D)).shareRequests.incoming[0].id;
    assert.equal((await resp(pedir(env, D, '/api/share-requests/' + id + '/accept', 'POST', {}))).status, 200);
    assert.equal((await canAccessHouse(env, D.id, 'HB1')).ok, true);
    // B corta a ligação entre os dois: a partilha vai-se, a linha do pedido fica 'accepted'
    const conn = await env.DB.prepare('SELECT id FROM connections').first();
    assert.equal((await resp(pedir(env, B, '/api/connections/' + conn.id, 'DELETE'))).status, 200);
    assert.equal((await canAccessHouse(env, D.id, 'HB1')).ok, false);
    assert.equal((await env.DB.prepare('SELECT status FROM share_requests WHERE id = ?').bind(id).first()).status, 'accepted');
    // pedir de novo: a mesma linha volta a pendente e o dono vê o pedido
    assert.deepEqual(await pedirPartilha(env, B, t, ['HB1']), { status: 200, pedidos: 1, saltadas: [] });
    const row = await env.DB.prepare('SELECT status, decided_at FROM share_requests WHERE id = ?').bind(id).first();
    assert.equal(row.status, 'pending');
    assert.equal(row.decided_at, null);
    const incoming = (await estado(env, D)).shareRequests.incoming;
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0].id, id);
    assert.equal((await resp(pedir(env, D, '/api/share-link'))).uses, 2);
    // e aceitar outra vez volta a dar a partilha
    assert.equal((await resp(pedir(env, D, '/api/share-requests/' + id + '/accept', 'POST', {}))).status, 200);
    assert.equal((await canAccessHouse(env, D.id, 'HB1')).ok, true);
  });

  test('tectos: 5 casas por dia por remetente e 20 pedidos por responder por dono', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const B = await conta(env, 'B');
    for (let i = 1; i <= 6; i++) await casa(env, B, 'HB' + i, { name: 'B' + i });
    const t = /ligar=(\w+)/.exec((await resp(pedir(env, D, '/api/share-link', 'POST', {}))).url)[1];
    assert.equal((await pedirPartilha(env, B, t, ['HB1', 'HB2', 'HB3', 'HB4', 'HB5', 'HB6'])).status, 429);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM share_requests'), 0, 'tudo ou nada');
    assert.equal((await pedirPartilha(env, B, t, ['HB1', 'HB2', 'HB3', 'HB4', 'HB5'])).pedidos, 5);
    assert.equal((await pedirPartilha(env, B, t, ['HB6'])).status, 429);

    const E = await conta(env, 'Outro dono');
    const tE = /ligar=(\w+)/.exec((await resp(pedir(env, E, '/api/share-link', 'POST', {}))).url)[1];
    for (let i = 0; i < 20; i++) {
      await env.DB.prepare("INSERT INTO share_requests (id, from_user, to_user, house_id, status, created_at) VALUES (?, ?, ?, ?, 'pending', 1)")
        .bind('p' + i, 'X' + i, E.id, 'HX' + i).run();
    }
    const F = await conta(env, 'F');
    await casa(env, F, 'HF', { name: 'F' });
    assert.equal((await pedirPartilha(env, F, tE, ['HF'])).status, 429);
  });

  test('o dono apagado ou suspenso deixa de resolver, e um pedido de casa apagada não se aceita', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const B = await conta(env, 'B');
    await casa(env, B, 'HB1', { name: 'B1' });
    const t = /ligar=(\w+)/.exec((await resp(pedir(env, D, '/api/share-link', 'POST', {}))).url)[1];
    await pedirPartilha(env, B, t, ['HB1']);
    await env.DB.prepare('UPDATE users SET suspended_at = 1 WHERE id = ?').bind(D.id).run();
    assert.equal((await resp(pedir(env, null, '/api/ligar/' + t))).status, 404);
    await env.DB.prepare('UPDATE users SET suspended_at = NULL WHERE id = ?').bind(D.id).run();
    const id = (await estado(env, D)).shareRequests.incoming[0].id;
    await resp(pedir(env, B, '/api/houses/HB1', 'DELETE'));
    assert.equal((await estado(env, D)).shareRequests.incoming.length, 0, 'apagar a casa leva o pedido');
    assert.equal((await resp(pedir(env, D, '/api/share-requests/' + id + '/accept', 'POST', {}))).status, 404);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shares'), 0);
  });
});

/* ------------------------------ limpezas -------------------------------- */

describe('limpezas', () => {
  test('apagar a casa leva atribuições, pedidos e as casas dos convites', async () => {
    const { env, D, C, visitas } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    const so = await convidar(env, D, visitas, ['H1']);
    const dois = await convidar(env, D, visitas, ['H1', 'H2']);
    const B = await conta(env, 'B');
    await casa(env, B, 'HB', { name: 'B' });
    await env.DB.prepare("INSERT INTO share_requests (id, from_user, to_user, house_id, status, created_at) VALUES ('p1', ?, ?, 'H1', 'pending', 1)").bind(B.id, D.id).run();
    assert.equal((await resp(pedir(env, D, '/api/houses/H1', 'DELETE'))).status, 200);
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM collaborator_houses WHERE house_id = 'H1'"), 0);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM collaborators'), 0, 'o colaborador sem casas some');
    assert.equal(await conta1(env, "SELECT COUNT(*) AS n FROM share_requests WHERE house_id = 'H1'"), 0);
    assert.equal((await resp(pedir(env, null, '/api/convite/' + so.token))).status, 404, 'o convite só de H1 ficou revogado');
    const v = await resp(pedir(env, null, '/api/convite/' + dois.token));
    assert.deepEqual(v.houses, [{ name: 'T1 Porto' }], 'o outro perdeu só a H1');
    assert.equal((await estado(env, C)).houses.length, 0);
  });

  test('purgeAccount limpa tudo — do dono e do colaborador', async () => {
    const { env, D, C, visitas } = await armar();
    await darCargo(env, D, C, visitas, ['H1']);
    await convidar(env, D, visitas, ['H2']);
    await resp(pedir(env, D, '/api/share-link', 'POST', {}));
    await env.DB.prepare("INSERT INTO share_requests (id, from_user, to_user, house_id, status, created_at) VALUES ('p1', ?, ?, 'H1', 'pending', 1)").bind(C.id, D.id).run();
    // C também é dono de cargos e colaborador de outrem
    const E = await conta(env, 'E');
    await casa(env, E, 'HE', { name: 'E' });
    const cargoE = await cargo(env, E, 'X', ['tx.view'], 'R_E');
    await darCargo(env, E, C, cargoE, ['HE']);

    await purgeAccount(env, C.id);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM collaborators WHERE user_id = ?', C.id), 0);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM collaborator_houses'), 0, 'C era o único colaborador');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM share_requests'), 0);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM roles WHERE owner_id = ?', D.id), 3, 'os cargos do dono ficam');

    await purgeAccount(env, D.id);
    for (const t of ['roles', 'collaborators', 'collab_invites', 'share_links']) {
      assert.equal(await conta1(env, `SELECT COUNT(*) AS n FROM ${t} WHERE owner_id = ?`, D.id), 0, t);
    }
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM houses WHERE owner_id = ?', D.id), 0);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM roles WHERE owner_id = ?', E.id), 1, 'os de outros ficam');
  });
});

/* ------------------------------ travões --------------------------------- */

describe('rate limits', () => {
  test('o 31.º GET de pré-visualização do mesmo IP leva 429', async () => {
    const env = ambiente();
    const ip = { 'CF-Connecting-IP': '203.0.113.7' };
    for (let i = 0; i < 30; i++) {
      assert.equal((await resp(pedir(env, null, '/api/convite/' + 'c'.repeat(64), 'GET', undefined, ip))).status, 404);
    }
    assert.equal((await resp(pedir(env, null, '/api/convite/' + 'c'.repeat(64), 'GET', undefined, ip))).status, 429);
    assert.equal((await resp(pedir(env, null, '/api/convite/' + 'c'.repeat(64), 'GET', undefined, { 'CF-Connecting-IP': '203.0.113.8' }))).status, 404, 'outro IP segue');
    for (let i = 0; i < 30; i++) await resp(pedir(env, null, '/api/ligar/' + 'c'.repeat(64), 'GET', undefined, ip));
    assert.equal((await resp(pedir(env, null, '/api/ligar/' + 'c'.repeat(64), 'GET', undefined, ip))).status, 429);
  });

  test('o 11.º convite por id numa hora leva 429', async () => {
    const env = ambiente();
    const A = await conta(env, 'A');
    for (let i = 0; i < 10; i++) {
      const r = await resp(pedir(env, A, '/api/connections', 'POST', { peerId: 'NAOEXIST' }));
      assert.equal(r.status, 404);
    }
    assert.equal((await resp(pedir(env, A, '/api/connections', 'POST', { peerId: 'NAOEXIST' }))).status, 429);
  });
});
