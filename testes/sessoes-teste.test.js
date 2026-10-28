// As sessões de teste no back office (worker/src/sessoes-teste.js e a rota
// /api/equipa/operacao/sessoes-teste): a lista traz só as sessões abertas das
// contas de teste vivas com a época certa, agrupadas por quem as pediu no
// Discord (com o nome que a ligação gravou), com as sessões de antes dos
// metadados também, e sem o token; terminar uma sessão apaga-a e não apanha
// sessões de contas normais; terminar as de uma pessoa ou todas sobe a época
// e deixa as contas; apagar leva as contas; e a rota é só da Operação (master
// e admin), só fora de produção, e deixa rasto.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ambiente, conta } from './lib/api.js';
import { chamar, corpoDe, MASTER, ADMIN, DEV, SUPORTE } from './lib/equipa.js';
import { createSession, getSessionUser } from '../worker/src/auth.js';
import { sessoesDeTeste, terminarSessao, terminarSessoesDe, apagarContasDe, idDaSessao } from '../worker/src/sessoes-teste.js';

let seq = 0;
/* Uma conta de teste escrita direto na base, como o /test a cria.
   Recebe: env; dono — o id de Discord de quem a pediu (null para uma órfã).
   Devolve: a promessa do id da conta. */
async function contaDeTeste(env, dono) {
  const id = 'T' + String(++seq).padStart(7, '0');
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at, test_owner)
     VALUES (?, ?, 'Conta de teste', '', '', ?, '1', 1, ?)`
  ).bind(id, 'teste-' + id.toLowerCase() + '@teste.rendorium.com', Date.now() + seq, dono).run();
  return id;
}

// Recebe: env; token. Devolve: a promessa da conta da sessão (ou null se já não vale).
const quemE = (env, token) => getSessionUser(env, new Request('https://dev.x.pt/api/me', { headers: { Authorization: 'Bearer ' + token } }));

/* Um dev com duas contas de teste e três sessões, outro com uma, uma conta
   normal com sessão, e uma sessão antiga sem metadados.
   Devolve: a promessa de {env, ana1, ana2, rui, normal, tokens}. */
async function cenario() {
  const env = ambiente();
  const ana1 = await contaDeTeste(env, '111'), ana2 = await contaDeTeste(env, '111'), rui = await contaDeTeste(env, '222');
  const normal = await conta(env, 'Maria Costa');
  await env.SESSIONS.put('teste:nome:111', 'Ana');
  const tokens = {
    ana1a: await createSession(env, ana1, 0, 'Chrome 128 · Android 14'),
    ana1b: await createSession(env, ana1, 0, 'Samsung Internet 27 · Android 15'),
    rui: await createSession(env, rui, 0),
  };
  // uma sessão de antes dos metadados: só o valor e a validade
  tokens.antiga = 'a'.repeat(64);
  await env.SESSIONS.put('sess:' + tokens.antiga, JSON.stringify({ userId: ana2, epoch: 0 }), { expirationTtl: 3600 });
  return { env, ana1, ana2, rui, normal, tokens };
}

describe('a lista das sessões de teste', () => {
  test('só as das contas de teste, por quem as pediu, com o nome do Discord e sem o token', async () => {
    const { env, ana1, ana2, rui, normal } = await cenario();
    const d = await sessoesDeTeste(env);
    assert.equal(d.sessoes, 4, 'as três novas e a antiga; a da conta normal não');
    assert.equal(d.contas, 3);
    assert.deepEqual(d.donos.map((x) => [x.id, x.nome]), [['111', 'Ana'], ['222', '']], 'quem tem mais primeiro');
    const ana = d.donos[0];
    assert.deepEqual(ana.contas.map((c) => [c.id, c.sessoes.length]), [[ana1, 2], [ana2, 1]]);
    assert.deepEqual(ana.contas[0].sessoes.map((s) => s.agente).sort(), ['Chrome 128 · Android 14', 'Samsung Internet 27 · Android 15']);
    const antiga = ana.contas[1].sessoes[0];
    assert.ok(antiga.expira > Date.now() && antiga.criada < antiga.expira, 'a antiga tem a validade e uma hora de abertura tirada dela');
    assert.equal(d.donos[1].contas[0].id, rui);
    assert.doesNotMatch(JSON.stringify(d), /"token"|[a-f0-9]{64}/, 'nenhum token sai');
    assert.ok(!JSON.stringify(d).includes(normal.id), 'a conta normal não aparece');
  });

  test('uma sessão com a época velha não conta, e uma conta sem sessão aparece vazia', async () => {
    const { env, rui } = await cenario();
    await env.DB.prepare('UPDATE users SET sess_epoch = 1 WHERE id = ?').bind(rui).run();
    const d = await sessoesDeTeste(env);
    assert.equal(d.sessoes, 3);
    assert.deepEqual(d.donos.find((x) => x.id === '222').contas[0].sessoes, []);
  });
});

describe('terminar e apagar', () => {
  test('terminar uma sessão apaga só essa; o id de uma sessão de uma conta normal não apanha nada', async () => {
    const { env, tokens, normal } = await cenario();
    assert.equal(await terminarSessao(env, await idDaSessao(tokens.ana1a)), 1);
    assert.equal(await quemE(env, tokens.ana1a), null, 'a sessão já não entra');
    assert.ok(await quemE(env, tokens.ana1b), 'a outra sessão da mesma conta fica');
    assert.equal(await terminarSessao(env, await idDaSessao(normal.token)), 0);
    assert.ok(await quemE(env, normal.token), 'a sessão da conta normal fica');
    assert.equal(await terminarSessao(env, 'nao-e-um-id'), 0);
  });

  test('terminar as de uma pessoa sobe a época das contas dela e deixa as contas e as dos outros', async () => {
    const { env, tokens, ana1 } = await cenario();
    assert.equal(await terminarSessoesDe(env, 'dono', '111'), 2);
    assert.equal(await quemE(env, tokens.ana1a), null);
    assert.equal(await quemE(env, tokens.antiga), null);
    assert.ok(await quemE(env, tokens.rui), 'as do Rui ficam');
    const c = await env.DB.prepare('SELECT deleted_at FROM users WHERE id = ?').bind(ana1).first();
    assert.equal(c.deleted_at, null, 'a conta fica');
    assert.equal((await sessoesDeTeste(env)).sessoes, 1);
  });

  test('terminar todas e apagar todas apanham só as contas de teste', async () => {
    const { env, tokens, normal } = await cenario();
    assert.equal(await terminarSessoesDe(env, 'todas'), 3);
    assert.equal((await sessoesDeTeste(env)).sessoes, 0);
    assert.ok(await quemE(env, normal.token), 'a conta normal continua com sessão');
    assert.equal(await apagarContasDe(env, 'todas'), 3);
    const d = await sessoesDeTeste(env);
    assert.equal(d.contas, 0);
    assert.ok(await quemE(env, normal.token));
    assert.equal(await quemE(env, tokens.rui), null);
  });

  test('apagar uma conta leva só essa; uma conta normal não se apaga por aqui', async () => {
    const { env, ana1, normal } = await cenario();
    assert.equal(await apagarContasDe(env, 'conta', ana1), 1);
    assert.equal(await apagarContasDe(env, 'conta', normal.id), 0);
    const d = await sessoesDeTeste(env);
    assert.equal(d.contas, 2);
    assert.ok(!d.donos[0].contas.some((c) => c.id === ana1));
  });
});

describe('a rota da Operação', () => {
  test('só master e admin; só fora de produção; ações desconhecidas são 400 e o vazio é 404', async () => {
    const { env } = await cenario();
    assert.equal((await chamar(env, DEV, 'GET', '/api/equipa/operacao/sessoes-teste')).status, 403);
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/operacao/sessoes-teste')).status, 403);
    assert.equal((await chamar(env, ADMIN, 'GET', '/api/equipa/operacao/sessoes-teste')).status, 200);
    const d = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/operacao/sessoes-teste'));
    assert.equal(d.sessoes, 4);
    assert.equal((await chamar(env, MASTER, 'POST', '/api/equipa/operacao/sessoes-teste', { acao: 'apagar', alvo: 'sessao', id: 'x' })).status, 400);
    assert.equal((await chamar(env, MASTER, 'POST', '/api/equipa/operacao/sessoes-teste', { acao: 'terminar', alvo: 'dono', id: '999' })).status, 404);
    const prod = Object.assign({}, env, { ENV_NAME: undefined });
    assert.equal((await chamar(prod, MASTER, 'GET', '/api/equipa/operacao/sessoes-teste')).status, 404);
  });

  test('terminar as de uma pessoa pela rota deixa rasto com quem o fez', async () => {
    const { env } = await cenario();
    const r = await corpoDe(await chamar(env, MASTER, 'POST', '/api/equipa/operacao/sessoes-teste', { acao: 'terminar', alvo: 'dono', id: '111' }));
    assert.equal(r.ok, true);
    assert.equal(r.n, 2);
    const rasto = (await env.DB.prepare("SELECT quem, acao, alvo, detalhe FROM audit_log WHERE acao LIKE 'teste.%'").all()).results;
    assert.equal(rasto.length, 1);
    assert.equal(rasto[0].quem, 'm1');
    assert.equal(rasto[0].acao, 'teste.terminar');
    assert.equal(rasto[0].alvo, '111');
    assert.match(rasto[0].detalhe, /sessões terminadas em 2 contas \(as de 111\)/);
  });
});
