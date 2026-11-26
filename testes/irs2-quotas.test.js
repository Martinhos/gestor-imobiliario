// As quotas dos comproprietários na segunda auditoria ao IRS: partilhar uma
// casa, entrar, sair, apagar e a pergunta dos donos de fora. Contra o SQL a
// sério (testes/lib/bd.js) e com a app inteira no arnês.
//
// N017 — juntar um comproprietário parte da divisão real e segue sempre uma
//   proposta; com quotas escritas ou donos de fora abre a janela das quotas.
// N018 — a entrada fecha o período das quotas na véspera; «já era dono?»
//   (desde sempre, ou desde um dia) diz o resto.
// N019 — a primeira resposta com donos de fora pergunta desde quando é assim,
//   e o dia escolhido segue.
// N021 — quem fica é avisado no sino quando um dono sai (também quando a
//   conta dele é apagada), e o período leva o nome de quem saiu.
// N136 — a conta apagada passa a quota pelos que ficam, como uma saída.
// N059 — com conta, um imóvel só meu responde à pergunta dos de fora no
//   formulário; a data só aparece quando a divisão muda.
// N067 — apagar um imóvel partilhado (ou a conta do criador) avisa os outros,
//   e a confirmação diz quem o perde e propõe transferir o controlo.
// N137 — a dica dos donos de fora fala do usufruto.
// N139 — uma casa nova sobe com os de fora e o histórico, validados.

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, conta, pedir, resp, estado, casa, comproprietario } from './lib/api.js';
import * as acesso from '../worker/src/lib/acesso.js';

const { purgeAccount, aplicarQuotas, preserveOwnership } = acesso;
import { carregarTudo, limpar, repor, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

/* ------------------------------ armações ------------------------------- */

afterEach(() => mock.restoreAll());

const app = carregarTudo({ hoje: '2026-11-17' });
afterEach(() => repor(app));

const espera = () => new Promise((r) => setTimeout(r, 5));
const el = (id) => app.document.getElementById(id);
const escreve = (id, v) => { el(id).value = v; };

/* Põe o relógio do worker num instante fixo (o now() e o «hoje» de Lisboa).
   Recebe: iso — 'AAAA-MM-DDTHH:MM:SSZ'.
   Devolve: nada. */
const relogio = (iso) => { const t = Date.parse(iso); mock.method(Date, 'now', () => t); };

// Recebe: env; hid. Devolve: a promessa do JSON da casa como está na base.
const dadosDa = async (env, hid) => JSON.parse((await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(hid).first()).data);

// Recebe: env; hid; d — o JSON a escrever direto (monta o ponto de partida).
// Devolve: a promessa do run.
const escreverCasa = (env, hid, d) => env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?').bind(JSON.stringify(d), hid).run();

// Recebe: env; quem; hid; corpo. Devolve: a promessa de {status, ...} da proposta.
const propor = (env, quem, hid, corpo) => resp(pedir(env, quem, '/api/houses/' + hid + '/proposal', 'POST', corpo));
// Recebe: env; quem; hid. Devolve: a promessa do aceitar.
const aceitarP = (env, quem, hid) => resp(pedir(env, quem, '/api/houses/' + hid + '/proposal/accept', 'POST', {}));
// Recebe: env; quem; cid; houseIds. Devolve: a promessa do PUT das partilhas.
const partilhar = (env, quem, cid, houseIds) => resp(pedir(env, quem, '/api/connections/' + cid + '/shares', 'PUT', { houseIds }));

// Recebe: env; quem — o destinatário. Devolve: a promessa dos avisos dele, [kind, house_id, actor_id].
const avisosDe = async (env, quem) => (await env.DB.prepare(
  'SELECT kind, house_id, actor_id FROM house_events WHERE user_id = ? ORDER BY created_at, kind').bind(quem.id).all())
  .results.map((e) => [e.kind, e.house_id, e.actor_id]);

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

/* A Ana (A) com o T2 Benfica (H1) sozinha, e o Bruno (B) ligado a ela,
   ainda sem a casa.
   Recebe: dados (opcional) — o que se junta ao JSON da casa.
   Devolve: { env, A, B, cid }. */
async function anaEBruno(dados) {
  const env = ambiente();
  const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
  await casa(env, A, 'H1', Object.assign({ name: 'T2 Benfica' }, dados || {}));
  const cid = await comproprietario(env, A, B, []);
  return { env, A, B, cid };
}

/* ------------------------------ N018 · a entrada ------------------------------ */

describe('N018 — a entrada de um dono fecha o período, e «já era dono?» diz o resto', () => {
  test('casa sem quotas, partilhada a 10/7: até 9/7 a Ana é dona de tudo (sem proposta nenhuma); 50/50 desde 1/7 dá 9 000 € e 3 000 €, e 2025 fica com 12 000 €', async () => {
    relogio('2026-07-10T10:00:00Z');
    const { env, A, B, cid } = await anaEBruno();
    assert.equal((await partilhar(env, A, cid, ['H1'])).status, 200);
    let d = await dadosDa(env, 'H1');
    assert.deepEqual(d.quotasHist, [{ ate: '2026-07-09', ownerIds: [A.id], ownerShares: {}, fora: null, entrada: [B.id] }],
      'o período fecha na véspera da entrada, com a marca de quem entrou');
    let p = imovelDoCliente(d, [A.id, B.id]);
    assert.equal(app.quotasFiscais(p, '2026-03-05')[A.id], 1, 'só partilhar já não dá metade da casa ao Bruno para trás');
    assert.equal(rendasDe(p, 2025, A.id), 12000, 'o ano já entregue não muda');
    // a divisão de hoje (partes iguais) com o dia em que o Bruno passou a dono:
    // não é uma divisão nova, aplica-se já, sem pedir o sim dele (KAN-127-7)
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 }, desde: '2026-07-01' })).applied, true);
    assert.equal(await env.DB.prepare('SELECT 1 FROM share_proposals').first(), null, 'nada por confirmar');
    d = await dadosDa(env, 'H1');
    assert.deepEqual(d.quotasHist, [{ ate: '2026-06-30', ownerIds: [A.id], ownerShares: {}, fora: null }], 'encurtado, sem a marca');
    p = imovelDoCliente(d, [A.id, B.id]);
    assert.equal(rendasDe(p, 2026, A.id), 9000);
    assert.equal(rendasDe(p, 2026, B.id), 3000);
    assert.equal(rendasDe(p, 2025, A.id), 12000);
  });

  test('«desde sempre» (o casal dono desde sempre): o período da entrada sai, e a casa é dos dois em todos os anos', async () => {
    relogio('2026-07-10T10:00:00Z');
    const { env, A, B, cid } = await anaEBruno();
    await partilhar(env, A, cid, ['H1']);
    // 50/50 é a divisão de hoje: o «desde sempre» aplica-se já (KAN-127-7)
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 }, desde: 'sempre' })).applied, true);
    assert.equal(await env.DB.prepare('SELECT 1 FROM share_proposals').first(), null, 'nada por confirmar');
    const d = await dadosDa(env, 'H1');
    assert.equal(d.quotasHist, undefined);
    const p = imovelDoCliente(d, [A.id, B.id]);
    assert.equal(rendasDe(p, 2025, A.id), 6000);
    assert.equal(rendasDe(p, 2026, B.id), 6000);
  });

  test('o Bruno era «dono fora da app» a 50 %: entra, deixa de ser de fora «desde sempre», e tem 6 000 € em 2026 sem período nenhum como de fora', async () => {
    relogio('2026-09-10T10:00:00Z');
    const { env, A, B, cid } = await anaEBruno({ ownerShares: {}, comproprietariosFora: [{ id: 'f1', nome: 'Bruno', quota: 50 }] });
    const ana = await dadosDa(env, 'H1');
    ana.ownerShares = { [A.id]: 100 };
    await escreverCasa(env, 'H1', ana);
    await partilhar(env, A, cid, ['H1']);
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 }, fora: [], desde: 'sempre' })).status, 201);
    assert.equal((await aceitarP(env, B, 'H1')).applied, true);
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.comproprietariosFora, []);
    assert.equal(d.quotasHist, undefined, 'nenhum período com o Bruno de fora');
    const p = imovelDoCliente(d, [A.id, B.id]);
    assert.equal(rendasDe(p, 2026, B.id), 6000);
    assert.equal(rendasDe(p, 2026, A.id), 6000);
  });

  test('fecharQuotasNaEntrada e o «desde sempre»: a entrada que não muda nada não abre período; o «sempre» só tira as entradas de quem agora é dono, e as saídas ficam', () => {
    const t = Date.parse('2026-07-10T10:00:00Z');
    const so = { ownerShares: { a: 100 } };
    assert.equal(acesso.fecharQuotasNaEntrada(so, ['a'], ['a', 'b'], t), false, '100/0: o Bruno entra a 0 % e ninguém muda');
    assert.equal(so.quotasHist, undefined);
    const d = { quotasHist: [{ ate: '2025-12-31', ownerIds: ['a', 'c'], ownerShares: {}, fora: null, nomes: { c: 'Carla' } }] };
    assert.equal(acesso.fecharQuotasNaEntrada(d, ['a'], ['a', 'b'], t), true);
    assert.deepEqual(d.quotasHist.map((e) => [e.ate, e.entrada]), [['2025-12-31', undefined], ['2026-07-09', ['b']]]);
    // outra entrada no mesmo dia junta-se à marca
    assert.equal(acesso.fecharQuotasNaEntrada(d, ['a', 'b'], ['a', 'b', 'e'], t), true);
    assert.deepEqual(d.quotasHist[1].entrada, ['b', 'e']);
    aplicarQuotas(d, ['a', 'b'], { a: 50, b: 50 }, undefined, acesso.DESDE_SEMPRE);
    assert.deepEqual(d.quotasHist.map((e) => e.ate), ['2025-12-31'], 'a saída da Carla fica; a entrada do Bruno sai');
    assert.deepEqual(d.ownerShares, { a: 50, b: 50 });
  });
});

/* ------------------------------ N017 · partilhar ------------------------------ */

describe('N017 — juntar um comproprietário com conta', () => {
  test('a Ana respondeu «Só eu» ({Ana: 100}); partilha com o Bruno e propõe 50/50 «desde sempre»: aceite, cada um tem 6 000 €', async () => {
    relogio('2026-09-10T10:00:00Z');
    const { env, A, B, cid } = await anaEBruno();
    assert.equal((await propor(env, A, 'H1', { fora: [] })).applied, true, 'o «Só eu» grava {Ana: 100}');
    assert.deepEqual((await dadosDa(env, 'H1')).ownerShares, { [A.id]: 100 });
    await partilhar(env, A, cid, ['H1']);
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 50, [B.id]: 50 }, desde: 'sempre' })).status, 201);
    assert.equal((await aceitarP(env, B, 'H1')).applied, true);
    const p = imovelDoCliente(await dadosDa(env, 'H1'), [A.id, B.id]);
    assert.equal(rendasDe(p, 2026, A.id), 6000);
    assert.equal(rendasDe(p, 2026, B.id), 6000);
  });

  test('a entrada deita fora a proposta pendente (não tem quem entrou)', async () => {
    relogio('2026-09-10T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno'), C = await conta(env, 'Carla');
    await casa(env, A, 'H1', { name: 'T2' });
    await comproprietario(env, A, B, ['H1']);
    assert.equal((await propor(env, A, 'H1', { shares: { [A.id]: 60, [B.id]: 40 } })).status, 201);
    const cid = await comproprietario(env, A, C, []);
    await partilhar(env, A, cid, ['H1']);
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM share_proposals').first()).n, 0);
  });
});

/* -------------------------- N021, N136, N067 · sair e apagar -------------------------- */

describe('N021 e N136 — quem fica é avisado, e a conta apagada passa a quota como uma saída', () => {
  test('o Bruno sai: o período leva o nome dele; a ligação cortada pelo Bruno avisa a Ana', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await casa(env, A, 'H2', { name: 'T1 Porto' });
    const cid = await comproprietario(env, A, B, ['H1', 'H2']);
    assert.equal((await resp(pedir(env, B, '/api/houses/H1/participacao', 'DELETE'))).status, 200);
    assert.deepEqual((await dadosDa(env, 'H1')).quotasHist[0].nomes, { [B.id]: 'Bruno' });
    assert.equal((await resp(pedir(env, B, '/api/connections/' + cid, 'DELETE'))).status, 200);
    assert.deepEqual(await avisosDe(env, A), [['casa.sair', 'H1', B.id], ['casa.sair', 'H2', B.id]], 'também quando a ligação deixa de lhe dar a casa');
    assert.deepEqual(await avisosDe(env, B), [], 'quem age não se avisa a si');
    assert.deepEqual((await dadosDa(env, 'H2')).quotasHist[0].nomes, { [B.id]: 'Bruno' });
  });

  test('a conta do Bruno apagada: a Ana recebe o aviso «casa.sair_conta» e as quotas de 40/30/30 passam a somar 100 pelos que ficam', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno'), C = await conta(env, 'Carla');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await comproprietario(env, A, B, ['H1']);
    await comproprietario(env, A, C, ['H1']);
    const d0 = await dadosDa(env, 'H1');
    d0.ownerShares = { [A.id]: 40, [B.id]: 30, [C.id]: 30 };
    d0.ownerIds = [A.id, B.id, C.id];
    await escreverCasa(env, 'H1', d0);
    await purgeAccount(env, C.id);
    const d = await dadosDa(env, 'H1');
    assert.deepEqual(d.ownerShares, { [A.id]: 57.14, [B.id]: 42.86 }, 'na proporção, como numa saída (N136)');
    assert.equal(d.quotasHist[0].nomes, undefined, 'sem o nome dela: a identidade sai com a conta');
    assert.deepEqual(await avisosDe(env, A), [['casa.sair_conta', 'H1', C.id]]);
    assert.deepEqual(await avisosDe(env, B), [['casa.sair_conta', 'H1', C.id]]);
    const dep = (await estado(env, A)).departures;
    assert.equal(dep[0].actorName, '', 'o aviso fica, sem o nome');
  });

  test('a conta apagada leva o nome dela dos períodos de saídas antigas e dos avisos que deu; os avisos ficam com quem os recebeu', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await comproprietario(env, A, B, ['H1']);
    await resp(pedir(env, B, '/api/houses/H1/participacao', 'DELETE'));
    assert.deepEqual((await dadosDa(env, 'H1')).quotasHist[0].nomes, { [B.id]: 'Bruno' });
    await purgeAccount(env, B.id);
    assert.equal((await dadosDa(env, 'H1')).quotasHist[0].nomes, undefined);
    assert.deepEqual((await dadosDa(env, 'H1')).quotasHist[0].ownerIds, [A.id, B.id], 'o id fica: a Declaração de 2026 continua certa');
    const dep = (await estado(env, A)).departures;
    assert.deepEqual(dep.map((x) => [x.kind, x.actorName]), [['casa.sair', '']], 'o aviso da saída fica com a Ana, sem o nome');
  });
});

describe('N067 — o criador apaga o imóvel ou a conta: os outros donos são avisados', () => {
  test('a Ana apaga o T2 partilhado: o Bruno recebe «casa.apagada»; a conta da Ana apagada: o Bruno recebe «casa.apagada_conta» pela outra', async () => {
    relogio('2026-07-10T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
    await casa(env, A, 'H1', { name: 'T2 Benfica' });
    await casa(env, A, 'H2', { name: 'T1 Porto' });
    await comproprietario(env, A, B, ['H1', 'H2']);
    assert.equal((await resp(pedir(env, A, '/api/houses/H1', 'DELETE'))).status, 200);
    assert.deepEqual(await avisosDe(env, B), [['casa.apagada', 'H1', A.id]]);
    assert.deepEqual(await avisosDe(env, A), [], 'quem apaga não é avisado');
    await purgeAccount(env, A.id);
    assert.deepEqual((await avisosDe(env, B)).map((x) => x.slice(0, 2)), [['casa.apagada', 'H1'], ['casa.apagada_conta', 'H2']]);
    const dep = (await estado(env, B)).departures.find((x) => x.kind === 'casa.apagada_conta');
    assert.equal(dep.actorName, '', 'sem o nome de quem apagou a conta');
    assert.equal(dep.houseName, 'T1 Porto');
  });
});

/* ------------------------------ N139 · a primeira subida ------------------------------ */

describe('N139 — uma casa nova sobe com os de fora e o histórico', () => {
  test('pela API, uma casa nova guarda os de fora validados; numa que já existe continuam ignorados', async () => {
    relogio('2026-11-17T10:00:00Z');
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const r = await resp(pedir(env, A, '/api/houses/H9', 'PUT', { data: { id: 'H9', name: 'T3', rooms: [],
      comproprietariosFora: [{ id: 'f1', nome: 'Rui', quota: 50 }], ownerShares: { [A.id]: 10 } } }));
    assert.equal(r.status, 200, JSON.stringify(r));
    const d = await dadosDa(env, 'H9');
    assert.deepEqual(d.comproprietariosFora, [{ id: 'f1', nome: 'Rui', quota: 50 }]);
    assert.equal(d.ownerShares, undefined, 'as percentagens entre as contas nunca vêm do cliente');
    await resp(pedir(env, A, '/api/houses/H9', 'PUT', { data: { id: 'H9', name: 'T3', rooms: [], comproprietariosFora: [] } }));
    assert.deepEqual((await dadosDa(env, 'H9')).comproprietariosFora, [{ id: 'f1', nome: 'Rui', quota: 50 }]);
    // o histórico de uma casa nova (o Rui desde 1/7) entra com a conta de quem a cria
    await resp(pedir(env, A, '/api/houses/H8', 'PUT', { data: { id: 'H8', name: 'T4', rooms: [],
      comproprietariosFora: [{ id: 'f2', nome: 'Rui', quota: 50 }],
      quotasHist: [{ ate: '2026-06-30', ownerIds: ['ficha-ana'], ownerShares: { 'ficha-ana': 100 }, fora: null }] } }));
    const h8 = await dadosDa(env, 'H8');
    assert.deepEqual(h8.quotasHist, [{ ate: '2026-06-30', ownerIds: [A.id], ownerShares: {}, fora: null }]);
    const p = imovelDoCliente(h8, [A.id]);
    assert.equal(rendasDe(p, 2026, A.id), 9000, 'a mudança a meio do ano que estava no histórico não se perde');
  });

  test('preserveOwnership numa casa nova: o histórico entra com a conta de quem cria; lixo, datas de hoje em diante e de fora inválidos caem', () => {
    relogio('2026-11-17T10:00:00Z');
    const c = preserveOwnership('', {
      name: 'T3', ownerIds: ['x'], ownerShares: { x: 1 }, comproprietariosFora: [{ nome: 'Rui', quota: 50 }],
      quotasHist: [{ ate: '2026-06-30', ownerIds: ['ficha1'], ownerShares: { ficha1: 100 }, fora: null },
        { ate: '2026-11-17', ownerIds: [], fora: [] }, { ate: '2026-02-30' }, 'lixo',
        { ate: '2025-12-31', fora: [{ nome: '', quota: 10 }] }],
    }, 'U1');
    assert.equal(c.ownerIds, undefined);
    assert.equal(c.ownerShares, undefined);
    assert.equal(c.comproprietariosFora[0].nome, 'Rui');
    assert.deepEqual(c.quotasHist, [
      { ate: '2025-12-31', ownerIds: ['U1'], ownerShares: {}, fora: null },
      { ate: '2026-06-30', ownerIds: ['U1'], ownerShares: {}, fora: null },
    ]);
    assert.equal(acesso.quotasDaCriacao({ quotasHist: [{ ate: '2026-01-01' }] }).quotasHist, undefined, 'sem quem cria, o histórico não entra');
    assert.equal(preserveOwnership('{"name":"T3"}', { comproprietariosFora: [] }).comproprietariosFora, undefined, 'numa que já existe, nada');
  });
});

/* ------------------------------ o cliente ------------------------------ */

/* Com nuvem: a Minha (H1) só minha; a Dupla (H2) minha com o Rui, sem quotas;
   a Fora (H4) minha com o Bruno de fora a 50 % e o «Só eu»; a ligação com o Rui. */
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1, data: { id: 'H1', name: 'Minha' } },
    { id: 'H2', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'RUI'], updatedAt: 1, data: { id: 'H2', name: 'Dupla' } },
    { id: 'H4', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1,
      data: { id: 'H4', name: 'Fora', ownerShares: { EU: 100 }, comproprietariosFora: [{ id: 'f1', nome: 'Rui', quota: 50 }] } },
  ],
  records: [], userRecords: [],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }],
  connections: [{ id: 'K1', status: 'active', incoming: false, peer: { id: 'RUI', name: 'Rui', email: 'rui@x.pt' }, myShares: ['H2'], peerShares: [] }],
  roles: [], collaborators: [], invites: [], people: [], proposals: [],
  shareLink: null, shareRequests: { incoming: [], outgoing: [] },
  sharedGroupRequests: { incoming: [], outgoing: [] }, sharedGroups: [], departures: [],
  transfers: { incoming: [], outgoing: [] },
});

/* A app com sessão, o estado do servidor e os espiões.
   Recebe: muda (opcional) — função que altera o estado antes de o usar.
   Devolve: {abertas, esp} — esp.api as chamadas, esp.toasts, esp.janelas (o
   CW.proposeShares pedido por quem). */
function nuvem(muda) {
  limpar(app);
  const esp = { api: [], toasts: [], confirmados: [], janelas: [] };
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt' };
  const st = ESTADO();
  if (muda) muda(st);
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  app.api = (m, p, b) => { esp.api.push({ m, p, b: b === undefined ? undefined : JSON.parse(JSON.stringify(b)) }); return Promise.resolve({ ok: true, applied: false }); };
  app.pullNow = () => Promise.resolve();
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'setSyncBadge', 'subirPendentes');
  app.toast = (m) => { esp.toasts.push(m); };
  app.confirmModal = (t, txt) => { esp.confirmados.push({ t, txt }); };
  return { abertas, esp };
}

describe('N017 e N018 no cliente — o modal das partilhas e a janela «Divisão de quotas»', () => {
  test('uma casa com quotas escritas e donos de fora vai pela janela: a fila enche-se e a janela abre com quem entrou e «já era dono?»', async () => {
    const { abertas, esp } = nuvem();
    app.CW.sharesModal('K1');
    const caixa = el('cw_sh_H4'); caixa.checked = true; app.CW.shareCasaMudou('H4');
    el('cw_sh_H2').checked = true;
    const b = el('cw_qb_H4').innerHTML;
    assert.match(b, /abre-se a janela das quotas com a divisão de agora/);
    assert.ok(!b.includes('cw_q_H4_'), 'sem os campos entre as contas, que não mostram os de fora');
    // o servidor já tem o Rui na casa quando a janela abre
    app.pullNow = () => { app.prop('H4').ownerIds = ['EU', 'RUI']; return Promise.resolve(); };
    abertas[0].onSave();
    await espera();
    igual(esp.api.map((x) => x.m + ' ' + x.p), ['PUT /api/connections/K1/shares'], 'sem proposta do modal');
    const j = abertas.at(-1);
    assert.equal(j.t, 'Divisão de quotas · Fora');
    assert.match(j.b, /Acabaste de partilhar <b>Fora<\/b> com <b>Rui<\/b>/);
    assert.match(j.b, /<b>Rui<\/b> já era dono antes de entrar na app\?/);
    assert.match(j.b, /Rui era um dos donos fora da app\?/);
    assert.match(j.b, /id="cw_pp_EU" [^>]*value="50"/, 'a divisão real: Eu 50 %, o Rui com 0 % e o Rui de fora com 50 %');
    assert.match(j.b, /id="cw_pp_RUI" [^>]*value="0"/);
    // o que o browser lê dos campos (o DOM do arnês não lê o value do HTML)
    escreve('cw_pp_EU', '50'); escreve('cw_pp_RUI', '0'); escreve('cwq_fn_0', 'Rui'); escreve('cwq_fq_0', '50');
    // «Sim, era Rui»: sai dos de fora e a quota passa para a conta
    app.imvPropostaForaEConta(0);
    assert.match(app.modalBodyEl().innerHTML, /id="cw_pp_RUI" type="text" inputmode="decimal" value="50"/);
    escreve('cw_pp_EU', '50'); escreve('cw_pp_RUI', '50');
    app.enviarProposta = (hid, shares, extra) => { esp.api.push({ m: 'PROPOSTA', p: hid, b: { shares: JSON.parse(JSON.stringify(shares)), extra: JSON.parse(JSON.stringify(extra)) } }); return Promise.resolve({}); };
    app.onSave();
    await espera();
    igual(esp.api.at(-1).b, { shares: { EU: 50, RUI: 50 }, extra: { fora: [], desde: 'sempre' } });
  });

  test('a janela depois de uma partilha segue mesmo com a divisão igual à de agora, e «desde um dia» leva o dia', async () => {
    const { abertas, esp } = nuvem();
    app.enviarProposta = (hid, shares, extra) => { esp.api.push({ hid, shares: JSON.parse(JSON.stringify(shares)), extra: JSON.parse(JSON.stringify(extra)) }); return Promise.resolve({}); };
    app.CW.proposeShares('H2', { entrou: ['RUI'] });
    assert.match(abertas[0].b, /Rui<\/b> já era dono antes de entrar na app\?/);
    escreve('cw_pp_EU', '50'); escreve('cw_pp_RUI', '50');   // a divisão de agora, sem mexer
    escreve('cwq_quando', 'dia');
    app.imvPropostaQuandoMudou();
    escreve('cwq_desde', '2026-07-01');
    app.onSave();
    await espera();
    igual(esp.api, [{ hid: 'H2', shares: { EU: 50, RUI: 50 }, extra: { desde: '2026-07-01' } }]);
  });
});

describe('N019 — a primeira resposta com donos de fora diz desde quando, e o dia segue', () => {
  test('com várias contas: a Carla de fora «desde um dia» leva o dia na proposta (o campo dele está à vista só aí)', async () => {
    const { esp } = nuvem();
    app.enviarProposta = (hid, shares, extra) => { esp.api.push({ hid, extra: JSON.parse(JSON.stringify(extra)) }); return Promise.resolve({}); };
    app.CW.proposeShares('H2');
    escreve('cw_pp_EU', '25'); escreve('cw_pp_RUI', '25');
    escreve('cwq_foraEstado', 'sim');
    app.imvForaMudouNaProposta();
    let b = app.modalBodyEl().innerHTML;
    assert.match(b, /Desde quando é assim\?/);
    assert.match(b, /<div id="cwq_quando" class="u-d-none">/, 'o «Desde quando valem?» geral fica escondido: não se usava');
    escreve('cwq_foraQuando', 'dia');
    app.imvForaQuandoNaProposta();
    b = app.modalBodyEl().innerHTML;
    assert.match(b, /<input id="cwq_foraDia" type="date"/);
    escreve('cwq_fn_0', 'Carla');
    escreve('cwq_fq_0', '50');
    escreve('cwq_foraDia', '2026-07-01');
    app.onSave();
    await espera();
    igual(esp.api.map((x) => x.extra.desde), ['2026-07-01']);
  });

  test('sem nuvem: «Sim, Rui 50 %» desde 1/7 guarda a Ana a 100 % até 30/6 — 9 000 € em 2026 e 12 000 € em 2025', () => {
    limpar(app);
    app.CW.user = null;
    app.db.owners = [app.normPerson({ id: 'ana', name: 'Ana' })];
    app.db.properties = [app.normProp({ id: 'v1', name: 'T2', ownerIds: ['ana'] })];
    janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'syncPropRecs', 'syncAllLoanRecs');
    app.toast = () => {};
    app.propModal('v1');
    escreve('p_name', 'T2');
    escreve('p_foraEstado', 'sim');
    app.imvForaMudouNoForm();
    escreve('p_foraQuando', 'dia');
    app.imvForaQuandoNoForm();
    escreve('p_fn_0', 'Rui');
    escreve('p_fq_0', '50');
    escreve('p_foraDia', '2026-07-01');
    app.onSave();
    const p = app.prop('v1');
    igual(p.quotasHist.map((e) => [e.ate, e.fora]), [['2026-06-30', null]]);
    assert.equal(rendasDe(p, 2026, 'ana'), 9000);
    assert.equal(rendasDe(p, 2025, 'ana'), 12000);
  });
});

describe('N059 — com conta, a pergunta dos de fora de um imóvel só meu está no formulário', () => {
  test('o imóvel novo tem a pergunta e não o botão morto; a janela de uma casa com os de fora por confirmar não tem campo de data', () => {
    const { abertas } = nuvem();
    app.propModal();
    assert.match(abertas[0].b, /id="p_foraEstado"/);
    assert.doesNotMatch(abertas[0].b, /CW\.proposeShares/);
    app.closeAllModals();
    app.CW.proposeShares('H1');
    assert.doesNotMatch(abertas.at(-1).b, /cwq_desde/);
  });

  test('o imvAbrirQuotas: a casa só minha abre o formulário; a de várias contas, a janela', () => {
    const { abertas } = nuvem();
    app.imvAbrirQuotas('H1');
    assert.equal(abertas.at(-1).t, 'Editar imóvel');
    app.imvAbrirQuotas('H2');
    assert.equal(abertas.at(-1).t, 'Propor nova divisão');
  });
});

describe('N021 e N067 no cliente — o sino e as confirmações', () => {
  test('as frases do sino: quem saiu, quem apagou a conta, o imóvel apagado', () => {
    nuvem();
    const at = new Date(2026, 6, 10, 15, 0).getTime();
    const f = (kind) => app.notifFraseDoAviso({ kind, houseId: 'H2', houseName: 'Dupla', actorId: 'RUI', actorName: 'Rui', at }).titulo;
    assert.equal(f('casa.sair'), 'Rui saiu de Dupla a 10/07/2026: a quota que tinha passou para ti, desse dia em diante.');
    assert.equal(f('casa.sair_conta'), 'Rui apagou a conta e deixou de ser dono de Dupla a 10/07/2026: a quota que tinha passou para ti, desse dia em diante.');
    assert.equal(f('casa.apagada'), 'Rui apagou Dupla: o imóvel saiu da tua lista e da tua Declaração do IRS, também nos meses em que foste dono.');
    // a conta apagada já não traz o nome: diz-se o papel
    const sem = (kind) => app.notifFraseDoAviso({ kind, houseId: 'H2', houseName: 'Dupla', actorId: 'RUI', actorName: '', at }).titulo;
    assert.equal(sem('casa.sair_conta'), 'Um comproprietário apagou a conta e deixou de ser dono de Dupla a 10/07/2026: a quota que tinha passou para ti, desse dia em diante.');
    assert.equal(sem('casa.apagada_conta'), 'Quem criou Dupla apagou a conta, e o imóvel foi com ela: saiu da tua lista e da tua Declaração do IRS, também nos meses em que foste dono.');
  });

  test('apagar um imóvel com outro dono diz quem o perde e propõe transferir o controlo', () => {
    const { esp } = nuvem();
    app.imvPossoTransferir = () => true;
    app.delProp('H2');
    const txt = esp.confirmados[0].txt;
    assert.match(txt, /O imóvel desaparece também para <b>Rui<\/b>, que deixa de o ter na lista e na Declaração do IRS/);
    assert.match(txt, /data-click="closeModal\(\);imvTransferir\('H2'\)">Transferir o controlo</);
  });

  test('apagar a conta diz o que acontece aos imóveis com outros donos', () => {
    const { abertas } = nuvem();
    app.CW.deleteAccount();
    assert.match(abertas.at(-1).b, /Um dos teus imóveis, <b>Dupla<\/b>, tem outros donos na app \(<b>Rui<\/b>\)/);
  });
});

describe('N137 — o usufruto na pergunta dos donos de fora', () => {
  test('a dica diz que contam os usufrutuários e já não manda copiar da caderneta', () => {
    nuvem();
    app.imvForaIniciar('p', [{ id: 'f', nome: 'Filho', quota: 50 }], '');
    const h = app.imvForaHtml('p');
    assert.match(h, /havendo usufruto, os usufrutuários \(quem tem só a nua-propriedade não conta\)/);
    assert.doesNotMatch(h, /escritura ou na caderneta/);
  });
});
