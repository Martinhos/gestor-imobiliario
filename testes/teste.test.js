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
async function abrir(env, comDados, mexe, manter) {
  let lig = await ligacaoTeste(env, 'https://dev.x.pt', comDados, manter);
  if (mexe) lig = mexe(lig);
  const url = new URL(lig);
  return rotaTeste({ env, url, request: new Request(lig) });
}

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
