// As outras portas por onde se entra e sai de uma casa partilhada, e o que
// elas fazem às quotas — contra o SQL a sério (testes/lib/bd.js), com a
// quota de cada dia lida pela própria app (saldos.js:quotasFiscais).
//
// N018 — entrar num grupo (o dono aceita o pedido), um imóvel que entra num
//   grupo e um pedido de partilha aceite fecham o período das quotas na
//   véspera, como a partilha numa ligação: o «antes» fica com os donos de
//   então, e quem entrou não é dono nesses dias até uma proposta dizer desde
//   quando. Uma entrada que não muda a Declaração de ninguém não abre período.
//   No cliente, cada uma dessas casas abre a janela das quotas a perguntar
//   desde quando quem entrou é dono (desde sempre, ou desde um dia), como
//   depois de uma partilha numa ligação — a app inteira a falar com o
//   servidor de teste, sem espiões no meio.
// N021 — sair de um grupo, ser removido dele, um imóvel que sai de um grupo e
//   um grupo apagado avisam cada um que fica (menos quem fez a mudança) de
//   quem saiu: a quota que tinha passou para ele, desse dia em diante (D6).

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, conta, pedir, resp, estado, casa, comproprietario } from './lib/api.js';
import { participantsOf } from '../worker/src/lib/acesso.js';
import { carregarBase, carregarTudo, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

/* ------------------------------ armações ------------------------------- */

afterEach(() => mock.restoreAll());

const app = carregarBase({ hoje: '2026-11-23' });
afterEach(() => repor(app));

/* Põe o relógio do worker num instante fixo (o now() e o «hoje» de Lisboa).
   Recebe: iso — 'AAAA-MM-DDTHH:MM:SSZ'.
   Devolve: nada. */
const relogio = (iso) => { mock.restoreAll(); const t = Date.parse(iso); mock.method(Date, 'now', () => t); };

/* Uma conta da app com sessão e o email já confirmado (o relógio dos testes
   anda meses para a frente, e a graça de 7 dias do email acabava).
   Recebe: env; nome.
   Devolve: a promessa da conta ({id, token, name, ...}). */
async function pessoa(env, nome) {
  const c = await conta(env, nome);
  await env.DB.prepare('UPDATE users SET email_verified_at = 1 WHERE id = ?').bind(c.id).run();
  return c;
}

// Recebe: env; hid. Devolve: a promessa do JSON da casa como está na base.
const dadosDa = async (env, hid) => JSON.parse((await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(hid).first()).data);

/* Os avisos de um destinatário, como [kind, casa, quem agiu], por ordem da
   casa e de quem agiu (os do mesmo lote têm o mesmo instante).
   Recebe: env; quem — a conta.
   Devolve: a promessa da lista. */
const avisosDe = async (env, quem) => (await env.DB.prepare(
  'SELECT kind, house_id, actor_id FROM house_events WHERE user_id = ? ORDER BY house_id, actor_id, kind').bind(quem.id).all())
  .results.map((e) => [e.kind, e.house_id, e.actor_id]);

/* O período guardado de uma casa com os donos por ordem (a ordem do SQL não
   conta), para comparar.
   Recebe: e — um período do quotasHist.
   Devolve: a cópia com ownerIds (e entrada) ordenados. */
const ordenado = (e) => Object.assign({}, e, { ownerIds: [...e.ownerIds].sort() }, e.entrada ? { entrada: [...e.entrada].sort() } : {});

/* Os pedidos à API dos grupos e das partilhas, como a nuvem os faz.
   Recebem: env; quem — a conta que age; e o resto do caminho.
   Devolvem: a promessa de {status, ...o JSON}. */
const criarGrupo = (env, quem, gid, name) => resp(pedir(env, quem, '/api/shared-groups/' + gid, 'PUT', { name }));
const casasDoGrupo = (env, quem, gid, houseIds) => resp(pedir(env, quem, '/api/shared-groups/' + gid + '/houses', 'PUT', { houseIds }));
const tirarCasa = (env, quem, gid, hid) => resp(pedir(env, quem, '/api/shared-groups/' + gid + '/houses/' + hid, 'DELETE'));
const sairOuRemover = (env, quem, gid, uid) => resp(pedir(env, quem, '/api/shared-groups/' + gid + '/members/' + uid, 'DELETE'));
const apagarGrupo = (env, quem, gid) => resp(pedir(env, quem, '/api/shared-groups/' + gid, 'DELETE'));
const propor = (env, quem, hid, corpo) => resp(pedir(env, quem, '/api/houses/' + hid + '/proposal', 'POST', corpo));

/* Alguém entra num grupo pelo caminho a sério: a ligação, o pedido e o sim
   do dono do grupo.
   Recebe: env; dono — a conta do dono do grupo; quem — quem entra; gid.
   Devolve: nada; falha a asserção se um dos passos não passar. */
async function entrarNoGrupo(env, dono, quem, gid) {
  const lig = await resp(pedir(env, dono, '/api/shared-groups/' + gid + '/link', 'POST', {}));
  const token = (/\?grupo=([a-f0-9]{64})$/.exec(lig.url || '') || [])[1];
  assert.ok(token, JSON.stringify(lig));
  assert.equal((await resp(pedir(env, quem, '/api/grupo/' + token + '/entrar', 'POST', {}))).status, 201);
  assert.deepEqual(await resp(pedir(env, dono, '/api/shared-groups/' + gid + '/requests/' + quem.id + '/accept', 'POST', {})),
    { status: 200, ok: true });
}

/* O imóvel do cliente feito do JSON do servidor, como o nucleo.js o monta
   (os donos são os participantes), com fichas para os donos.
   Recebe: data — o JSON da casa; donos — os ids de hoje.
   Devolve: o imóvel. */
function imovelDoCliente(data, donos) {
  limpar(app);
  donos.forEach((id) => app.db.owners.push(app.normPerson({ id, name: id })));
  const p = app.normProp(JSON.parse(JSON.stringify(data)));
  p.ownerIds = donos.slice();
  return p;
}

/* As rendas de um ano que a Declaração dá a uma conta: 1 000 € no dia 5 de
   cada mês, pela quota fiscal desse dia (saldos.js:quotasFiscais).
   Recebe: p — o imóvel; ano; quem — o id da conta.
   Devolve: o total (€). */
const rendasDe = (p, ano, quem) => Math.round(Array.from({ length: 12 }, (_, m) => ano + '-' + String(m + 1).padStart(2, '0') + '-05')
  .reduce((n, dia) => n + 1000 * (app.quotasFiscais(p, dia)[quem] || 0), 0));

/* ------------------------------ N018 · as entradas ------------------------------ */

describe('N018 — entrar por um grupo ou por um pedido de partilha fecha o período das quotas na véspera', () => {
  test('a Ana aceita o Rui no grupo a 10/7 (ele comprou metade do T2 a 1/7): até 9/7 a casa é só dela; 50/50 desde 1/7 dá 9 000 € e 3 000 €, e 2025 fica com 12 000 €', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await pessoa(env, 'Ana'), R = await pessoa(env, 'Rui');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    assert.equal((await criarGrupo(env, A, 'G1', 'Família')).status, 201);
    assert.equal((await casasDoGrupo(env, A, 'G1', ['H1'])).status, 200);
    assert.equal((await dadosDa(env, 'H1')).quotasHist, undefined, 'só a Ana no grupo: ninguém entrou na casa');
    await entrarNoGrupo(env, A, R, 'G1');
    let d = await dadosDa(env, 'H1');
    assert.deepEqual(d.quotasHist, [{ ate: '2026-07-09', ownerIds: [A.id], ownerShares: {}, fora: null, entrada: [R.id] }],
      'o período fecha na véspera da entrada, com os donos de então e a marca de quem entrou');
    let p = imovelDoCliente(d, [A.id, R.id]);
    assert.equal(app.quotasFiscais(p, '2026-03-05')[A.id], 1, 'entrar no grupo já não dá metade da casa ao Rui para trás');
    assert.equal(rendasDe(p, 2025, A.id), 12000, 'o ano já entregue não muda');
    // 50/50 é a divisão de hoje: o dia em que o Rui passou a dono aplica-se já, sem pedido (KAN-127-7)
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 50, [R.id]: 50 }, desde: '2026-07-01' })).applied, true);
    d = await dadosDa(env, 'H1');
    p = imovelDoCliente(d, [A.id, R.id]);
    assert.equal(rendasDe(p, 2026, A.id), 9000);
    assert.equal(rendasDe(p, 2026, R.id), 3000);
    assert.equal(rendasDe(p, 2025, A.id), 12000);
    assert.equal(rendasDe(p, 2025, R.id), 0);
  });

  test('o casal dono desde sempre: depois de entrar no grupo, a proposta «desde sempre» tira o período, e a casa é dos dois em todos os anos', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await pessoa(env, 'Ana'), R = await pessoa(env, 'Rui');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await criarGrupo(env, A, 'G1', 'Casal');
    await casasDoGrupo(env, A, 'G1', ['H1']);
    await entrarNoGrupo(env, A, R, 'G1');
    assert.equal((await dadosDa(env, 'H1')).quotasHist.length, 1);
    // 50/50 é a divisão de hoje: o «desde sempre» aplica-se já, sem pedido (KAN-127-7)
    assert.equal((await propor(env, R, 'H1', { shares: { [A.id]: 50, [R.id]: 50 }, desde: 'sempre' })).applied, true);
    const d = await dadosDa(env, 'H1');
    assert.equal(d.quotasHist, undefined);
    const p = imovelDoCliente(d, [A.id, R.id]);
    assert.equal(rendasDe(p, 2025, A.id), 6000);
    assert.equal(rendasDe(p, 2025, R.id), 6000);
  });

  test('o Rui põe o T1 dele num grupo onde a Ana já está: a casa fecha o período com a Ana a entrar; voltar a gravar o mesmo conjunto não abre outro, e quem já lá estava por uma ligação não conta como entrada', async () => {
    relogio('2026-03-01T10:00:00Z');
    const env = ambiente();
    const A = await pessoa(env, 'Ana'), R = await pessoa(env, 'Rui'), C = await pessoa(env, 'Carla');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await casa(env, R, 'HR', { name: 'T1 Porto' });
    await casa(env, R, 'HC', { name: 'T3 Braga' });
    await comproprietario(env, R, C, ['HC']);
    await criarGrupo(env, A, 'G1', 'Família');
    await casasDoGrupo(env, A, 'G1', ['H1']);
    await entrarNoGrupo(env, A, R, 'G1');
    relogio('2026-09-15T10:00:00Z');
    assert.equal((await casasDoGrupo(env, R, 'G1', ['HR'])).status, 200);
    assert.deepEqual((await dadosDa(env, 'HR')).quotasHist,
      [{ ate: '2026-09-14', ownerIds: [R.id], ownerShares: {}, fora: null, entrada: [A.id] }]);
    const p = imovelDoCliente(await dadosDa(env, 'HR'), [R.id, A.id]);
    assert.equal(rendasDe(p, 2026, A.id), 1500, 'a Ana só conta de 15/9 em diante (partes iguais até uma proposta)');
    assert.equal(rendasDe(p, 2026, R.id), 10500);
    // o mesmo conjunto outra vez, e depois com mais uma casa: a primeira não mexe
    relogio('2026-09-20T10:00:00Z');
    assert.equal((await casasDoGrupo(env, R, 'G1', ['HR'])).status, 200);
    assert.equal((await casasDoGrupo(env, R, 'G1', ['HR', 'HC'])).status, 200);
    assert.equal((await dadosDa(env, 'HR')).quotasHist.length, 1, 'a casa que já estava no grupo não ganhou ninguém');
    assert.deepEqual((await dadosDa(env, 'HC')).quotasHist.map(ordenado),
      [{ ate: '2026-09-19', ownerIds: [C.id, R.id].sort(), ownerShares: {}, fora: null, entrada: [A.id] }],
      'a Carla já lá estava pela ligação: só a Ana entra');
  });

  test('uma entrada que não muda a Declaração de ninguém não abre período: o T1 do Rui tem «Só eu» ({Rui: 100}) e a Ana entra a 0 %', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await pessoa(env, 'Ana'), R = await pessoa(env, 'Rui');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await casa(env, R, 'HR', { name: 'T1 Porto', ownerShares: { [R.id]: 100 }, comproprietariosFora: [] });
    await criarGrupo(env, A, 'G1', 'Família');
    await casasDoGrupo(env, A, 'G1', ['H1']);
    await entrarNoGrupo(env, A, R, 'G1');
    await casasDoGrupo(env, R, 'G1', ['HR']);
    const d = await dadosDa(env, 'HR');
    assert.equal(d.quotasHist, undefined);
    assert.deepEqual(await participantsOf(env, 'HR'), [R.id, A.id]);
  });

  test('partilhar um grupo novo (só o dono, com casas dele) e criá-lo vazio não tocam nas casas', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await pessoa(env, 'Ana');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    const antes = await env.DB.prepare('SELECT data, rev FROM houses WHERE id = ?').bind('H1').first();
    assert.equal((await resp(pedir(env, A, '/api/shared-groups/G9/partilhar', 'POST', { name: 'Prédio', houseIds: ['H1'] }))).status, 201);
    assert.equal((await criarGrupo(env, A, 'G8', 'Vazio')).status, 201);
    assert.deepEqual(await env.DB.prepare('SELECT data, rev FROM houses WHERE id = ?').bind('H1').first(), antes);
  });

  test('o pedido de partilha do Bruno aceite pela Ana a 10/7: o T3 dele (já com a Carla) fecha o período na véspera, sem a Ana, e a proposta pendente cai', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await pessoa(env, 'Ana'), B = await pessoa(env, 'Bruno'), C = await pessoa(env, 'Carla');
    await casa(env, B, 'HB', { name: 'T3 Braga' });
    await comproprietario(env, B, C, ['HB']);
    assert.equal((await propor(env, B, 'HB', { shares: { [B.id]: 60, [C.id]: 40 } })).status, 201);
    const lig = await resp(pedir(env, A, '/api/share-link', 'POST', {}));
    const token = /\?ligar=([a-f0-9]{64})$/.exec(lig.url)[1];
    assert.deepEqual(await resp(pedir(env, B, '/api/ligar/' + token + '/pedir', 'POST', { houseIds: ['HB'] })),
      { status: 200, pedidos: 1, saltadas: [] });
    const rid = (await env.DB.prepare('SELECT id FROM share_requests').first()).id;
    assert.equal((await resp(pedir(env, A, '/api/share-requests/' + rid + '/accept', 'POST', {}))).status, 200);
    const d = await dadosDa(env, 'HB');
    assert.deepEqual(d.quotasHist.map(ordenado),
      [{ ate: '2026-07-09', ownerIds: [B.id, C.id].sort(), ownerShares: {}, fora: null, entrada: [A.id] }]);
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM share_proposals').first()).n, 0, 'a proposta não tinha a Ana');
    const p = imovelDoCliente(d, [B.id, C.id, A.id]);
    assert.equal(rendasDe(p, 2025, A.id), 0, 'a Ana não era dona em 2025');
    assert.equal(rendasDe(p, 2025, B.id), 6000);
  });
});

/* ------------------------------ N021 · as saídas ------------------------------ */

/* A família: a Ana (A) com o T2 (H1), partilhado também com o Pedro (P) por
   uma ligação; o Rui (R) com o T1 (HR) e a Teresa (T), todos no grupo G1 da
   Ana desde 1/3, com as duas casas lá dentro; o relógio passa a 10/7.
   Devolve: { env, A, P, R, T }. */
async function familia() {
  relogio('2026-03-01T10:00:00Z');
  const env = ambiente();
  const A = await pessoa(env, 'Ana'), P = await pessoa(env, 'Pedro'), R = await pessoa(env, 'Rui'), T = await pessoa(env, 'Teresa');
  await casa(env, A, 'H1', { name: 'T2 Benfica' });
  await casa(env, R, 'HR', { name: 'T1 Porto' });
  await comproprietario(env, A, P, ['H1']);
  await criarGrupo(env, A, 'G1', 'Família');
  await casasDoGrupo(env, A, 'G1', ['H1']);
  await entrarNoGrupo(env, A, R, 'G1');
  await entrarNoGrupo(env, A, T, 'G1');
  await casasDoGrupo(env, R, 'G1', ['HR']);
  await env.DB.prepare('DELETE FROM house_events').run();
  relogio('2026-07-10T10:00:00Z');
  return { env, A, P, R, T };
}

describe('N021 — quem sai de uma casa por um grupo deixa um aviso a cada um que fica', () => {
  test('a Teresa sai do grupo: a Ana e o Rui recebem «casa.sair» por ela nas duas casas, o Pedro no T2; ela não recebe nada', async () => {
    const { env, A, P, R, T } = await familia();
    assert.equal((await sairOuRemover(env, T, 'G1', T.id)).status, 200);
    assert.deepEqual(await avisosDe(env, A), [['casa.sair', 'H1', T.id], ['casa.sair', 'HR', T.id]].sort());
    assert.deepEqual(await avisosDe(env, P), [['casa.sair', 'H1', T.id]]);
    assert.deepEqual(await avisosDe(env, R), [['casa.sair', 'H1', T.id], ['casa.sair', 'HR', T.id]].sort());
    assert.deepEqual(await avisosDe(env, T), [], 'quem sai não se avisa a si');
    const fim = (await dadosDa(env, 'H1')).quotasHist.at(-1);
    assert.equal(fim.ate, '2026-07-09');
    assert.deepEqual(fim.nomes, { [T.id]: 'Teresa' });
  });

  test('a Ana remove o Rui: o T1 dele sai do grupo — o Rui é avisado de que a Ana e a Teresa saíram dele; o Pedro e a Teresa de que o Rui saiu do T2; a Ana, que o fez, de nada', async () => {
    const { env, A, P, R, T } = await familia();
    assert.equal((await sairOuRemover(env, A, 'G1', R.id)).status, 200);
    assert.deepEqual(await avisosDe(env, R), [['casa.sair', 'HR', A.id], ['casa.sair', 'HR', T.id]].sort());
    assert.deepEqual(await avisosDe(env, P), [['casa.sair', 'H1', R.id]]);
    assert.deepEqual(await avisosDe(env, T), [['casa.sair', 'H1', R.id]]);
    assert.deepEqual(await avisosDe(env, A), []);
  });

  test('o T1 sai do grupo: tirado pela Ana, o Rui é avisado; tirado pelo próprio Rui (que o partilha com a Carla), só a Carla', async () => {
    const { env, A, R, T } = await familia();
    assert.equal((await tirarCasa(env, A, 'G1', 'HR')).status, 200);
    assert.deepEqual(await avisosDe(env, R), [['casa.sair', 'HR', A.id], ['casa.sair', 'HR', T.id]].sort());
    assert.deepEqual(await avisosDe(env, A), []);
    // de novo no grupo, agora também com a Carla por uma ligação do Rui
    const C = await pessoa(env, 'Carla');
    await comproprietario(env, R, C, ['HR']);
    await casasDoGrupo(env, R, 'G1', ['HR']);
    await env.DB.prepare('DELETE FROM house_events').run();
    relogio('2026-08-10T10:00:00Z');
    assert.equal((await tirarCasa(env, R, 'G1', 'HR')).status, 200);
    assert.deepEqual(await avisosDe(env, C), [['casa.sair', 'HR', A.id], ['casa.sair', 'HR', T.id]].sort());
    assert.deepEqual(await avisosDe(env, R), [], 'o Rui tirou-a: não se avisa a si');
  });

  test('o Rui grava o conjunto dele sem o T1 (PUT …/houses): quem continua com a casa por outra porta é avisado; o Rui não', async () => {
    const { env, A, R, T } = await familia();
    const C = await pessoa(env, 'Carla');
    await comproprietario(env, R, C, ['HR']);
    assert.equal((await casasDoGrupo(env, R, 'G1', [])).status, 200);
    assert.deepEqual(await avisosDe(env, C), [['casa.sair', 'HR', A.id], ['casa.sair', 'HR', T.id]].sort());
    assert.deepEqual(await avisosDe(env, R), []);
  });

  test('a Ana apaga o grupo: o Pedro é avisado de que o Rui e a Teresa saíram do T2, o Rui de que a Ana e a Teresa saíram do T1; a Ana e a Teresa de nada', async () => {
    const { env, A, P, R, T } = await familia();
    assert.equal((await apagarGrupo(env, A, 'G1')).status, 200);
    assert.deepEqual(await avisosDe(env, P), [['casa.sair', 'H1', R.id], ['casa.sair', 'H1', T.id]].sort());
    assert.deepEqual(await avisosDe(env, R), [['casa.sair', 'HR', A.id], ['casa.sair', 'HR', T.id]].sort());
    assert.deepEqual(await avisosDe(env, A), []);
    assert.deepEqual(await avisosDe(env, T), []);
    // as quotas: a Ana e o Pedro ficam com o T2 desde 10/7, e o período de antes leva os nomes de quem saiu
    const fim = (await dadosDa(env, 'H1')).quotasHist.at(-1);
    assert.equal(fim.ate, '2026-07-09');
    assert.deepEqual(fim.nomes, { [R.id]: 'Rui', [T.id]: 'Teresa' });
    assert.deepEqual([...(await dadosDa(env, 'H1')).ownerIds].sort(), [A.id, P.id].sort());
  });
});

/* ------------------------------ N018 · no cliente ------------------------------ */

/* Um aparelho com a app inteira e a nuvem a falar com o servidor de teste: o
   fetch vai ao handleApi com a sessão de quem está na app; as janelas abrem
   numa pilha observável (lib/dom.js:janelasFalsas); o render, o envio e o
   selo calam-se. O estado lê-se e aplica-se já (applyState).
   Recebe: env; quem — a conta com sessão.
   Devolve: a promessa de { ap, abertas } — a app e as janelas abertas. */
async function aparelho(env, quem) {
  const ap = carregarTudo({ hoje: '2026-07-10' });
  ap.fetch = (url, opts) => {
    const o = opts || {};
    return pedir(env, { token: ap.CW.user.token }, url, o.method || 'GET', o.body ? JSON.parse(o.body) : undefined);
  };
  const abertas = janelasFalsas(ap, 'paintThumbs', 'render', 'buildNav', 'save', 'setSyncBadge', 'subirPendentes', 'schedulePush');
  ap.toast = () => {};
  ap.CW.user = { id: quem.id, name: quem.name, email: quem.email, token: quem.token };
  const st = await estado(env, quem);
  delete st.status;
  ap.applyState(st);
  return { ap, abertas };
}

/* Espera, aos bocadinhos, que uma condição se cumpra (as ações da nuvem são
   cadeias de promessas: a API, a leitura do estado, a janela).
   Recebe: cond — função sem argumentos.
   Devolve: a promessa de nada; falha a asserção se não se cumprir. */
async function ate(cond) {
  for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => setTimeout(r, 5));
  assert.ok(cond(), 'a condição não se cumpriu a tempo');
}

// As janelas das quotas abertas num aparelho (o título «Divisão de quotas · …»).
// Recebe: abertas. Devolve: a lista das camadas.
const janelasDasQuotas = (abertas) => abertas.filter((l) => /^Divisão de quotas · /.test(String(l.t || '')));

// As propostas pendentes no servidor. Recebe: env. Devolve: a promessa das linhas.
const propostas = async (env) => (await env.DB.prepare('SELECT house_id, proposed_by, desde FROM share_proposals ORDER BY house_id').all()).results
  .map((r) => ({ ...r }));

describe('N018 no cliente — a entrada por um grupo ou por um pedido abre a janela das quotas com «já era dono?»', () => {
  test('a Ana aceita o Rui no grupo: abre a janela do T2 a perguntar se o Rui já era dono; «desde sempre» segue, e aceite tira o período', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await pessoa(env, 'Ana'), R = await pessoa(env, 'Rui');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await criarGrupo(env, A, 'G1', 'Família');
    await casasDoGrupo(env, A, 'G1', ['H1']);
    const lig = await resp(pedir(env, A, '/api/shared-groups/G1/link', 'POST', {}));
    const token = /\?grupo=([a-f0-9]{64})$/.exec(lig.url)[1];
    assert.equal((await resp(pedir(env, R, '/api/grupo/' + token + '/entrar', 'POST', {}))).status, 201);
    const { ap, abertas } = await aparelho(env, A);
    ap.CW.grupoAceitarPedido('G1', R.id);
    await ate(() => janelasDasQuotas(abertas).length === 1);
    const j = janelasDasQuotas(abertas)[0];
    assert.equal(j.t, 'Divisão de quotas · T2 Benfica');
    assert.match(j.b, /Rui<\/b> já era dono antes de entrar na app\?/);
    ap.document.getElementById('cw_pp_' + A.id).value = '50';
    ap.document.getElementById('cw_pp_' + R.id).value = '50';
    ap.onSave();
    await ate(() => ap.modalStack.length === 0);
    await new Promise((r) => setTimeout(r, 30));
    // a divisão de hoje com «desde sempre»: aplica-se já, nada fica por confirmar (KAN-127-7)
    assert.deepEqual(await propostas(env), []);
    assert.equal((await dadosDa(env, 'H1')).quotasHist, undefined, 'o Rui já era dono: a casa é dos dois em todos os anos');
  });

  test('o Rui adiciona dois imóveis ao grupo: o T1 com «Só eu» ({Rui: 100}) não abre janela (a Ana entra a 0 %); o T3 abre, com a Ana a entrar', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await pessoa(env, 'Ana'), R = await pessoa(env, 'Rui');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await casa(env, R, 'HR', { name: 'T1 Porto', ownerShares: { [R.id]: 100 }, comproprietariosFora: [] });
    await casa(env, R, 'HC', { name: 'T3 Braga' });
    await criarGrupo(env, A, 'G1', 'Família');
    await casasDoGrupo(env, A, 'G1', ['H1']);
    await entrarNoGrupo(env, A, R, 'G1');
    const { ap, abertas } = await aparelho(env, R);
    ap.CW.grupoImoveis('G1');
    assert.equal(abertas[0].t, 'Adicionar os meus imóveis');
    ap.document.getElementById('cwg_h_HR').checked = true;
    ap.document.getElementById('cwg_h_HC').checked = true;
    abertas[0].onSave();
    await ate(() => janelasDasQuotas(abertas).length >= 1);
    await new Promise((r) => setTimeout(r, 30));
    const js = janelasDasQuotas(abertas);
    assert.deepEqual(js.map((l) => l.t), ['Divisão de quotas · T3 Braga'], 'só a casa em que a entrada abriu período');
    assert.match(js[0].b, /Ana<\/b> já era dono antes de entrar na app\?/);
    assert.equal(ap.CW._shareQueue.length, 0, 'e não fica nenhuma na fila');
  });

  test('a Ana aceita o pedido de partilha do Bruno: a janela pergunta-lhe se já era dona, e «desde sempre» segue em nome dela', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await pessoa(env, 'Ana'), B = await pessoa(env, 'Bruno');
    await casa(env, B, 'HB', { name: 'T3 Braga' });
    const lig = await resp(pedir(env, A, '/api/share-link', 'POST', {}));
    const token = /\?ligar=([a-f0-9]{64})$/.exec(lig.url)[1];
    await resp(pedir(env, B, '/api/ligar/' + token + '/pedir', 'POST', { houseIds: ['HB'] }));
    const rid = (await env.DB.prepare('SELECT id FROM share_requests').first()).id;
    const { ap, abertas } = await aparelho(env, A);
    ap.CW.pedidoAceitar(rid);
    await ate(() => janelasDasQuotas(abertas).length === 1);
    const j = janelasDasQuotas(abertas)[0];
    assert.equal(j.t, 'Divisão de quotas · T3 Braga');
    // quem entrou é quem aceitou: a pergunta é-lhe feita a ela
    assert.match(j.b, /Já eras dono antes de entrar na app\?|Ana \(tu\)<\/b> já era dono antes de entrar na app\?/);
    ap.document.getElementById('cw_pp_' + A.id).value = '50';
    ap.document.getElementById('cw_pp_' + B.id).value = '50';
    ap.onSave();
    await ate(() => ap.modalStack.length === 0);
    await new Promise((r) => setTimeout(r, 30));
    // a divisão de hoje com «desde sempre»: aplica-se já, nada fica por confirmar (KAN-127-7)
    assert.deepEqual(await propostas(env), []);
    assert.equal((await dadosDa(env, 'HB')).quotasHist, undefined, 'a Ana já era dona: a casa é dos dois em todos os anos');
  });
});
