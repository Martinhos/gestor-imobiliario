// O ambiente de teste (/test): quem entra, o que se lava, e onde é que a
// porta nem sequer existe. As regras que se provam aqui são o contrato do
// comando: produção diz sempre que não; cada ligação encontra a casa vazia;
// e sair de uma conta de teste é apagá-la.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { rotaTeste, ligacaoTeste, eContaDeTeste } from '../worker/src/teste.js';
import { handleApi } from '../worker/src/api.js';
import { createSession, hashPassword } from '../worker/src/auth.js';
import { TERMS_VERSION } from '../worker/src/lib/http.js';
import { baseDeTeste, kvFalso, r2Falso } from './lib/bd.js';

const ambiente = (extra = {}) => Object.assign({
  DB: baseDeTeste(),
  SESSIONS: kvFalso(),
  FILES: r2Falso(),
  ENV_NAME: 'teste',
  DISCORD_BOT_TOKEN: 'tok-de-teste',
}, extra);

// abre a ligação como um browser abriria: emite-a e entrega-a à rota
async function abrir(env, comDados, mexe, manter, quem) {
  let lig = await ligacaoTeste(env, 'https://dev.x.pt', comDados, manter, quem);
  if (mexe) lig = mexe(lig);
  const url = new URL(lig);
  return rotaTeste({ env, url, request: new Request(lig) });
}

const tokenDe = (r) => /entrar=([a-f0-9]{64})/.exec(r.headers.get('Location'))[1];

const contas = async (env) => (await env.DB.prepare(
  "SELECT id, email, deleted_at FROM users ORDER BY created_at"
).all()).results;

describe('a porta /t/entrar', () => {
  test('em produção não existe, nem com assinatura boa', async () => {
    const env = ambiente({ ENV_NAME: undefined });
    const r = await abrir(env, false);
    assert.equal(r.status, 404);
    assert.equal((await contas(env)).length, 0, 'produção não criou conta nenhuma');
  });

  test('assinatura errada é 403; expirada é 410; incompleta é 400', async () => {
    const env = ambiente();
    const ma = await abrir(env, false, (l) => l.replace(/sig=./, 'sig=f'));
    assert.equal(ma.status, 403);
    const velha = await abrir(env, false, (l) => l.replace(/exp=\d+/, 'exp=1700000000000'));
    assert.equal(velha.status, 410, 'a validade assinada manda — mudar o exp também mata a assinatura, mas uma ligação genuína velha morre aqui');
    const coxa = await abrir(env, false, (l) => l.replace(/&sig=.+$/, ''));
    assert.equal(coxa.status, 400);
    assert.equal((await contas(env)).length, 0);
  });

  test('mexer no exp para esticar a validade rebenta na assinatura', async () => {
    const env = ambiente();
    const r = await abrir(env, false, (l) => l.replace(/exp=(\d+)/, (m, e) => 'exp=' + (Number(e) + 86400000)));
    assert.equal(r.status, 403);
  });

  test('uma ligação boa entra: conta nova, sessão posta, e a marca de exemplo quando pedida', async () => {
    const env = ambiente();
    const r = await abrir(env, false);
    assert.equal(r.status, 302);
    const destino = r.headers.get('Location');
    const m = /\/\?entrar=([a-f0-9]{64})$/.exec(destino);
    assert.ok(m, 'sem dados de exemplo, sem marca: ' + destino);
    assert.ok(await env.SESSIONS.get('sess:' + m[1]), 'a sessão existe mesmo');
    const vivas = (await contas(env)).filter((u) => !u.deleted_at);
    assert.equal(vivas.length, 1);
    assert.ok(eContaDeTeste(vivas[0].email));

    const r2 = await abrir(env, true);
    assert.match(r2.headers.get('Location'), /&exemplo=1$/, 'com dados, a marca vai no endereço');
  });

  test('cada ligação lava as anteriores — a conta velha e a casa dela vão-se', async () => {
    const env = ambiente();
    await abrir(env, false);
    const primeira = (await contas(env)).find((u) => !u.deleted_at);
    await env.DB.prepare(
      "INSERT INTO houses (id, owner_id, data, updated_at) VALUES ('H1', ?, '{}', 1)"
    ).bind(primeira.id).run();

    await abrir(env, false);
    const todas = await contas(env);
    assert.equal(todas.filter((u) => !u.deleted_at).length, 1, 'uma viva de cada vez');
    const velha = todas.find((u) => u.id === primeira.id);
    assert.ok(velha.deleted_at, 'a anterior ficou lápide');
    const casas = await env.DB.prepare('SELECT COUNT(*) AS n FROM houses').first();
    assert.equal(casas.n, 0, 'a casa foi com a conta');
  });
});

describe('a opção manter: conta extra sem lavar', () => {
  test('duas contas vivas ao mesmo tempo — e mexer no m rebenta a assinatura', async () => {
    const env = ambiente();
    await abrir(env, false);
    const r2 = await abrir(env, false, null, true);
    assert.equal(r2.status, 302);
    const vivas = (await contas(env)).filter((u) => !u.deleted_at);
    assert.equal(vivas.length, 2, 'a primeira sobreviveu à extra');

    // promover um link "lavar" a "manter" sem assinar de novo: 403
    const mau = await abrir(env, false, (l) => l.replace('&m=0&', '&m=1&'));
    assert.equal(mau.status, 403, 'o manter está dentro do que se assina');
  });
});

describe('a assinatura antiga (sem manter) ainda vale — só como lavar', () => {
  test('uma ligação assinada à moda da produção atual entra', async () => {
    const env = ambiente();
    const exp = String(Date.now() + 300000);
    const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC',
      await crypto.subtle.importKey('raw', new TextEncoder().encode('teste:' + env.DISCORD_BOT_TOKEN),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
      new TextEncoder().encode(exp + ':0')))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const lig = 'https://dev.x.pt/t/entrar?exp=' + exp + '&dados=0&sig=' + sig;
    const r = await rotaTeste({ env, url: new URL(lig), request: new Request(lig) });
    assert.equal(r.status, 302, 'a ligação antiga ainda entra');

    // mas nunca como "manter": o m=1 com assinatura antiga é recusado
    const lig2 = 'https://dev.x.pt/t/entrar?exp=' + exp + '&dados=0&m=1&sig=' + sig;
    const r2 = await rotaTeste({ env, url: new URL(lig2), request: new Request(lig2) });
    assert.equal(r2.status, 403);
  });
});

describe('cada dev tem as suas contas', () => {
  test('o dono fica gravado, e a lavagem de um não toca nas do outro', async () => {
    const env = ambiente();
    await abrir(env, false, null, false, 'alice');
    await abrir(env, false, null, true, 'bob');   // manter: junta-se
    let vivas = (await contas(env)).filter((u) => !u.deleted_at);
    assert.equal(vivas.length, 2);

    // alice lava outra vez: a dela vai-se, a do bob fica
    await abrir(env, false, null, false, 'alice');
    vivas = (await contas(env)).filter((u) => !u.deleted_at);
    assert.equal(vivas.length, 2, 'a nova da alice e a do bob');
    const donos = await env.DB.prepare('SELECT test_owner FROM users WHERE deleted_at IS NULL ORDER BY test_owner').all();
    assert.deepEqual(donos.results.map((x) => x.test_owner), ['alice', 'bob']);
  });

  test('o seletor: lista só as do próprio, troca dentro delas, e cria extra', async () => {
    const env = ambiente();
    const tAlice = tokenDe(await abrir(env, false, null, false, 'alice'));
    const tBob = tokenDe(await abrir(env, false, null, true, 'bob'));
    const chama = (token, path, metodo, corpo) => handleApi(new Request('https://dev.x.pt' + path, {
      method: metodo || 'GET',
      headers: Object.assign({ Authorization: 'Bearer ' + token },
        corpo ? { 'Content-Type': 'application/json' } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined,
    }), env, { waitUntil() {} });

    const lista = await (await chama(tAlice, '/api/teste/contas')).json();
    assert.equal(lista.contas.length, 1, 'a alice só vê a dela');
    assert.equal(lista.contas[0].atual, true);

    const deBob = (await (await chama(tBob, '/api/teste/contas')).json()).contas[0].id;
    const roubo = await chama(tAlice, '/api/teste/trocar', 'POST', { para: deBob });
    assert.equal(roubo.status, 404, 'a conta do bob não é trocável pela alice');

    const nova = await (await chama(tAlice, '/api/teste/nova', 'POST', {})).json();
    assert.ok(nova.token, 'a extra vem com sessão');
    const lista2 = await (await chama(tAlice, '/api/teste/contas')).json();
    assert.equal(lista2.contas.length, 2, 'a alice passou a ter duas');

    const troca = await (await chama(tAlice, '/api/teste/trocar', 'POST', { para: nova.id })).json();
    assert.ok(troca.token);
    const eu = await (await chama(troca.token, '/api/me')).json();
    assert.equal(eu.id, nova.id, 'o token da troca entra mesmo na outra conta');
  });

  test('em produção o seletor nem existe; e uma conta normal não lhe toca', async () => {
    const env = ambiente();
    const t = tokenDe(await abrir(env, false, null, false, 'alice'));
    const semEnv = Object.assign({}, env, { ENV_NAME: undefined });
    const r = await handleApi(new Request('https://x.pt/api/teste/contas', {
      headers: { Authorization: 'Bearer ' + t },
    }), semEnv, { waitUntil() {} });
    assert.equal(r.status, 404);

    const pw = await hashPassword('Descartavel1!');
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at)
       VALUES ('N9', 'gente@x.pt', 'Gente', ?, ?, 1, ?, 1)`
    ).bind(pw.hash, pw.salt, TERMS_VERSION).run();
    const tNormal = await createSession(env, 'N9', 0);
    const r2 = await handleApi(new Request('https://dev.x.pt/api/teste/contas', {
      headers: { Authorization: 'Bearer ' + tNormal },
    }), env, { waitUntil() {} });
    assert.equal(r2.status, 403, 'uma conta a sério não mexe no seletor');
  });
});

describe('sair de uma conta de teste apaga-a', () => {
  const sair = (env, token) => handleApi(
    new Request('https://dev.x.pt/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    }), env, { waitUntil() {} });

  test('logout de teste purga; logout normal não toca em nada', async () => {
    const env = ambiente();
    const r = await abrir(env, false);
    const token = /entrar=([a-f0-9]{64})/.exec(r.headers.get('Location'))[1];
    const deTeste = (await contas(env)).find((u) => !u.deleted_at);

    // a conta normal, de controlo
    const pw = await hashPassword('Descartavel1!');
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at)
       VALUES ('N1', 'pessoa@x.pt', 'Pessoa', ?, ?, 1, ?, 1)`
    ).bind(pw.hash, pw.salt, TERMS_VERSION).run();
    const tokenNormal = await createSession(env, 'N1', 0);

    const s1 = await sair(env, token);
    assert.equal(s1.status, 200);
    const depois = await contas(env);
    assert.ok(depois.find((u) => u.id === deTeste.id).deleted_at, 'a de teste morreu com a sessão');

    const s2 = await sair(env, tokenNormal);
    assert.equal(s2.status, 200);
    const normal = (await contas(env)).find((u) => u.id === 'N1');
    assert.equal(normal.deleted_at, null, 'a conta normal saiu e continua cá');
    assert.equal(normal.email, 'pessoa@x.pt');
  });
});
