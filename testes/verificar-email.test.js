// A confirmação do email de uma conta nova (o ticket de QA dec6f37e, com a
// decisão do Martinho de 2026-10-29: «Entra durante 7 dias»), no servidor,
// contra o SQL a sério (testes/lib/bd.js, com a migração 0027) e com o fetch
// do Resend falso: a migração (as contas que já existiam ficam confirmadas);
// o registo manda o email «Confirma o teu email» (html e texto, a ligação
// ?confirmar=) e dá 201 mesmo com o Resend a falhar; a conta de teste recebe
// o email no dev que a criou; a Google nasce confirmada e confirma uma conta
// de palavra-passe por confirmar; o POST /api/auth/confirmar (uso único e
// atómico, 410 para o repetido, o expirado e o de outro email, 400 para um
// token mal formado, só o hash na base); o reenviar (só com sessão, larga as
// ligações anteriores, 3 por hora); o /api/me com emailConfirmado e
// confirmarAte; o portão dos 7 dias (o dia 6 passa, o dia 8 dá 403
// email_por_confirmar numa rota de dados, e o /api/me, o reenviar, o sair e
// o apagar continuam a passar); e os avisos de atraso só para emails
// confirmados.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash, generateKeyPairSync, sign as assinarNode } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, conta, casa, registo } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';
import { createSession } from '../worker/src/auth.js';
import { TERMS_VERSION } from '../worker/src/lib/http.js';
import { cartaConfirmarEmail } from '../worker/src/lib/correio.js';
import { resumoDosAtrasos } from '../worker/src/lib/avisos-atraso.js';
import { GRACA_EMAIL_MS } from '../worker/src/rotas/auth.js';
import { purgeAccount } from '../worker/src/lib/acesso.js';

/* ------------------------------ armações ------------------------------- */

const DIA = 86400000;
const fetchDeAntes = globalThis.fetch;
const errosDeAntes = console.error;
afterEach(() => { globalThis.fetch = fetchDeAntes; console.error = errosDeAntes; });

// cada pedido sem sessão vem de um IP novo: o limite por IP das rotas /api/auth/ não se mete
let ips = 0;

/* Chama a API como o index.js chama, e espera pelo que o pedido deixou em
   fundo (o waitUntil), como a plataforma deixa acabar.
   Recebe: env; quem — a conta ({token}) ou null; path; method ('GET');
   corpo (opcional) — um objeto, que vai em JSON.
   Devolve: a promessa de {status, ...o JSON da resposta}. */
async function pedirComFundo(env, quem, path, method = 'GET', corpo) {
  // o X-Rendorium-Token traz o token da sessão no corpo, como fora de produção
  const h = { 'CF-Connecting-IP': '10.0.' + (++ips % 250) + '.' + ips, 'X-Rendorium-Token': '1' };
  if (quem) h.Authorization = 'Bearer ' + quem.token;
  if (corpo !== undefined) h['Content-Type'] = 'application/json';
  const fundo = [];
  const r = await handleApi(new Request('https://app.x.pt' + path, {
    method, headers: h, body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }), env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
  let j = null;
  try { j = await r.json(); } catch (e) {}
  return Object.assign({ status: r.status }, j || {});
}

/* O Resend de faz-de-conta: guarda cada email que lhe chega.
   Recebe: estado (opcional) — o código da resposta (200).
   Devolve: o array dos corpos enviados ({to, subject, html, text}). */
function resendFalso(estado = 200) {
  const enviados = [];
  globalThis.fetch = async (url, op) => {
    if (String(url).includes('api.resend.com')) {
      enviados.push(JSON.parse(op.body));
      return new Response(estado === 200 ? '{"id":"e1"}' : 'recusado', { status: estado });
    }
    return new Response('', { status: 404 });
  };
  return enviados;
}

/* O token da ligação de confirmação dentro de um email.
   Recebe: email — o corpo enviado ao Resend.
   Devolve: os 64 hex do ?confirmar=, ou null. */
const tokenDe = (email) => { const m = /[?&]confirmar=([a-f0-9]{64})/.exec(email && email.text); return m ? m[1] : null; };

/* Cria uma conta pelo registo, com o Resend falso a apanhar o email.
   Recebe: env; email (opcional).
   Devolve: a promessa de {r: a resposta do registo, enviados, token}. */
async function registar(env, email = 'nova@exemplo.pt') {
  const enviados = resendFalso();
  const r = await pedirComFundo(env, null, '/api/auth/register', 'POST',
    { email, password: 'Forte#2026x', name: 'Nova', terms: TERMS_VERSION });
  return { r, enviados, token: tokenDe(enviados[0]), conta: { id: r.id, email: r.email, token: r.token } };
}

/* Recua o nascimento de uma conta.
   Recebe: env; id; dias — quantos dias para trás.
   Devolve: a promessa do run. */
const nasceuHa = (env, id, dias) => env.DB.prepare('UPDATE users SET created_at = ? WHERE id = ?').bind(Date.now() - dias * DIA, id).run();

// Recebe: env; id. Devolve: a promessa do email_verified_at da conta.
const confirmadoEm = async (env, id) => (await env.DB.prepare('SELECT email_verified_at AS v FROM users WHERE id = ?').bind(id).first()).v;

/* ------------------------------ a migração ----------------------------- */

describe('a migração 0027', () => {
  test('as contas que já existiam ficam confirmadas, com a data em que nasceram; as novas nascem por confirmar', () => {
    const pasta = new URL('../migrations/', import.meta.url);
    const nomes = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
    assert.ok(nomes.includes('0027_verificar_email.sql'));
    const db = new DatabaseSync(':memory:');
    for (const f of nomes.filter((n) => n < '0027')) db.exec(readFileSync(new URL(f, pasta), 'utf8'));
    db.prepare("INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES ('ANTIGA1', 'a@x.pt', 'A', 'h', 's', 1700000000000)").run();
    db.exec(readFileSync(new URL('0027_verificar_email.sql', pasta), 'utf8'));
    assert.equal(db.prepare("SELECT email_verified_at AS v FROM users WHERE id = 'ANTIGA1'").get().v, 1700000000000);
    db.prepare("INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES ('NOVA1', 'n@x.pt', 'N', 'h', 's', 1800000000000)").run();
    assert.equal(db.prepare("SELECT email_verified_at AS v FROM users WHERE id = 'NOVA1'").get().v, null);
    const cols = db.prepare('PRAGMA table_info(email_verifications)').all().map((c) => c.name);
    assert.deepEqual(cols, ['token_hash', 'user_id', 'email', 'created_at', 'expires_at', 'used_at']);
    assert.ok(db.prepare('PRAGMA index_list(email_verifications)').all().some((i) => /user/.test(i.name)), 'com índice no user_id');
  });
});

/* ------------------------------- o registo ----------------------------- */

describe('o registo manda o email «Confirma o teu email»', () => {
  test('html e texto, com a ligação ?confirmar= na origem da app, e na base só o hash', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const { r, enviados, token } = await registar(env);
    assert.equal(r.status, 201);
    assert.equal(enviados.length, 1);
    const e = enviados[0];
    assert.deepEqual(e.to, ['nova@exemplo.pt']);
    assert.match(e.subject, /Confirma o teu email/);
    assert.ok(token, 'o texto leva a ligação');
    assert.ok(e.text.includes('https://app.x.pt/?confirmar=' + token));
    assert.ok(e.html.includes('https://app.x.pt/?confirmar=' + token), 'o html também');
    assert.match(e.html, />Confirmar o email</, 'o botão');
    assert.match(e.text, /7 dias/);
    const linha = await env.DB.prepare('SELECT * FROM email_verifications').first();
    assert.equal(linha.token_hash, createHash('sha256').update(token).digest('hex'), 'só o hash');
    assert.equal(linha.user_id, r.id);
    assert.equal(linha.email, 'nova@exemplo.pt');
    assert.ok(Math.abs(linha.expires_at - linha.created_at - 7 * DIA) < 1000, 'vale 7 dias');
    assert.equal(await confirmadoEm(env, r.id), null, 'nasce por confirmar');
    assert.equal([...env.SESSIONS.m.keys()].filter((k) => /confirm/.test(k)).length, 0, 'nada no KV');
  });

  test('com o Resend a falhar (ou sem chave) o registo dá 201 na mesma, e a falha fica no console.error', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    resendFalso(500);
    const erros = [];
    console.error = (...a) => { erros.push(a.join(' ')); };
    const r = await pedirComFundo(env, null, '/api/auth/register', 'POST',
      { email: 'falha@exemplo.pt', password: 'Forte#2026x', terms: TERMS_VERSION });
    assert.equal(r.status, 201);
    assert.ok(r.token, 'com sessão');
    assert.ok(erros.some((m) => /confirmar: email não enviado/.test(m) && /resend 500/.test(m)), erros.join('\n'));

    const semChave = ambiente();
    const r2 = await pedirComFundo(semChave, null, '/api/auth/register', 'POST',
      { email: 'semchave@exemplo.pt', password: 'Forte#2026x', terms: TERMS_VERSION });
    assert.equal(r2.status, 201);
  });

  test('o registo não espera pelo Resend: o envio vai para o waitUntil', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    let solta;
    const preso = new Promise((ok) => { solta = ok; });
    globalThis.fetch = async () => { await preso; return new Response('{}', { status: 200 }); };
    const fundo = [];
    const r = await handleApi(new Request('https://app.x.pt/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.9.9.9' },
      body: JSON.stringify({ email: 'pressa@exemplo.pt', password: 'Forte#2026x', terms: TERMS_VERSION }),
    }), env, { waitUntil(p) { fundo.push(p); } });
    assert.equal(r.status, 201, 'respondeu com o Resend pendurado');
    assert.equal(fundo.length >= 1, true, 'o envio ficou em fundo');
    solta();
    await Promise.all(fundo);
  });

  test('a carta: título, botão, ligação por extenso, validade e rodapé da conta', () => {
    const c = cartaConfirmarEmail('https://app.rendorium.com/?confirmar=' + 'a'.repeat(64));
    assert.equal(c.assunto, 'Confirma o teu email');
    assert.match(c.html, /<h1[^>]*>Confirma o teu email<\/h1>/);
    assert.match(c.html, /Se o botão não abrir, copia esta ligação/);
    assert.match(c.html, /tens uma conta no Rendorium/);
    assert.match(c.texto, /Confirmar o email:\nhttps:\/\/app\.rendorium\.com\/\?confirmar=a{64}/);
    assert.doesNotMatch(c.texto, /!/, 'sem pontos de exclamação');
  });
});

/* --------------------------- a conta de teste -------------------------- */

describe('a conta de teste', () => {
  test('nasce por confirmar, e o email vai para o dev que a criou (com a conta no assunto)', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const id = 'TST00001';
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at, test_owner)
       VALUES (?, 'teste-tst00001@teste.rendorium.com', 'Conta de teste', '', '', ?, ?, 1, 'dev1')`
    ).bind(id, Date.now(), TERMS_VERSION).run();
    await env.SESSIONS.put('teste:email:dev1', 'dev@exemplo.pt');
    const T = { id, token: await createSession(env, id, 0) };
    const enviados = resendFalso();
    const nova = await pedirComFundo(env, T, '/api/teste/nova', 'POST', {});
    assert.equal(nova.status, 200);
    assert.equal(await confirmadoEm(env, nova.id), null, 'por confirmar, como as outras');
    assert.equal(enviados.length, 1, 'a conta nova manda o email');
    assert.deepEqual(enviados[0].to, ['dev@exemplo.pt'], 'para o dono do /test');
    assert.match(enviados[0].subject, new RegExp('Confirma o teu email · ' + nova.email.split('@')[0]));
    assert.ok(tokenDe(enviados[0]));
    // e o reenviar de uma conta de teste também vai para o dono
    const r = await pedirComFundo(env, { token: nova.token }, '/api/me/confirmar/reenviar', 'POST');
    assert.equal(r.status, 200);
    assert.deepEqual(enviados[1].to, ['dev@exemplo.pt']);
  });
});

/* ------------------------------- a Google ------------------------------ */

describe('a entrada com a Google', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'kv', alg: 'RS256', use: 'sig' });
  /* Um ID token da Google assinado com a chave deste ficheiro.
     Recebe: sub; email.
     Devolve: o token (texto). */
  const idToken = (sub, email) => {
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const agora = Math.floor(Date.now() / 1000);
    const cab = b64u({ alg: 'RS256', kid: 'kv', typ: 'JWT' });
    const corpo = b64u({ iss: 'https://accounts.google.com', aud: 'cid', exp: agora + 600, iat: agora, sub, email, email_verified: true, name: 'G' });
    return cab + '.' + corpo + '.' + assinarNode('sha256', Buffer.from(cab + '.' + corpo), privateKey).toString('base64url');
  };
  const jwks = () => { globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }); };

  test('uma conta da Google nasce confirmada', async () => {
    const env = ambiente({ GOOGLE_CLIENT_ID: 'cid' });
    jwks();
    const r = await pedirComFundo(env, null, '/api/auth/google', 'POST', { credential: idToken('g-1', 'gnova@exemplo.pt') });
    assert.equal(r.status, 200);
    assert.ok(await confirmadoEm(env, r.id), 'confirmada ao nascer');
    const me = await pedirComFundo(env, { token: r.token }, '/api/me');
    assert.equal(me.emailConfirmado, true);
    assert.equal(me.confirmarAte, null);
  });

  test('entrar pela Google numa conta de palavra-passe por confirmar, com o mesmo email, confirma-a', async () => {
    const env = ambiente({ GOOGLE_CLIENT_ID: 'cid', RESEND_API_KEY: 'k' });
    const { conta: c } = await registar(env, 'mesma@exemplo.pt');
    assert.equal(await confirmadoEm(env, c.id), null);
    jwks();
    const r = await pedirComFundo(env, null, '/api/auth/google', 'POST', { credential: idToken('g-2', 'mesma@exemplo.pt') });
    assert.equal(r.status, 200);
    assert.equal(r.id, c.id, 'a mesma conta');
    assert.ok(await confirmadoEm(env, c.id), 'o fornecedor confirmou o email');
  });

  test('e fecha a pré-apropriação: a palavra-passe sai, as outras sessões caem, e o «Esqueci-me» continua a servir', async () => {
    const env = ambiente({ GOOGLE_CLIENT_ID: 'cid', RESEND_API_KEY: 'k' });
    const { conta: estranho } = await registar(env, 'vitima@exemplo.pt');
    assert.equal((await pedirComFundo(env, estranho, '/api/me')).status, 200, 'quem registou o email tem sessão');
    jwks();
    const dono = await pedirComFundo(env, null, '/api/auth/google', 'POST', { credential: idToken('g-3', 'vitima@exemplo.pt') });
    assert.equal(dono.status, 200);
    const u = await env.DB.prepare('SELECT pass_hash, pass_salt, sess_epoch FROM users WHERE id = ?').bind(estranho.id).first();
    assert.equal(u.pass_hash, '', 'sem palavra-passe, como uma conta só da Google');
    assert.equal(u.pass_salt, '');
    assert.equal(u.sess_epoch, 1, 'o epoch sobe');
    assert.equal((await pedirComFundo(env, estranho, '/api/me')).status, 401, 'a sessão de quem registou caiu');
    assert.equal((await pedirComFundo(env, { token: dono.token }, '/api/me')).status, 200, 'a da Google nasce com o epoch novo');
    const entrar = await pedirComFundo(env, null, '/api/auth/login', 'POST', { email: 'vitima@exemplo.pt', password: 'Forte#2026x' });
    assert.equal(entrar.status, 401, 'a palavra-passe de quem registou já não entra');
    assert.match(entrar.error, /Google/);
    // quem é dono do email e quer palavra-passe pede-a pelo «Esqueci-me»
    const enviados = resendFalso();
    assert.equal((await pedirComFundo(env, null, '/api/auth/repor', 'POST', { email: 'vitima@exemplo.pt' })).status, 200);
    const t = /repor=([a-f0-9]{64})/.exec(enviados[0].text)[1];
    assert.equal((await pedirComFundo(env, null, '/api/auth/repor/confirmar', 'POST', { t, password: 'Nova#2026xy' })).status, 200);
    assert.equal((await pedirComFundo(env, null, '/api/auth/login', 'POST', { email: 'vitima@exemplo.pt', password: 'Nova#2026xy' })).status, 200);
  });

  test('numa conta já confirmada, entrar pela Google não mexe na palavra-passe nem nas sessões', async () => {
    const env = ambiente({ GOOGLE_CLIENT_ID: 'cid', RESEND_API_KEY: 'k' });
    const { conta: c, token } = await registar(env, 'confirmada@exemplo.pt');
    assert.equal((await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: token })).status, 200);
    jwks();
    assert.equal((await pedirComFundo(env, null, '/api/auth/google', 'POST', { credential: idToken('g-4', 'confirmada@exemplo.pt') })).status, 200);
    const u = await env.DB.prepare('SELECT pass_hash, sess_epoch FROM users WHERE id = ?').bind(c.id).first();
    assert.notEqual(u.pass_hash, '');
    assert.equal(u.sess_epoch || 0, 0);
    assert.equal((await pedirComFundo(env, c, '/api/me')).status, 200);
  });
});

/* ------------------------------ confirmar ------------------------------ */

describe('POST /api/auth/confirmar', () => {
  test('confirma a conta, uma vez: repetido dá 410, e o /api/me passa a dizê-lo', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const { conta: c, token } = await registar(env);
    let me = await pedirComFundo(env, c, '/api/me');
    assert.equal(me.emailConfirmado, false);
    assert.ok(Math.abs(me.confirmarAte - (Date.now() + GRACA_EMAIL_MS)) < 5000, 'confirmarAte é o nascimento mais 7 dias');
    assert.deepEqual(await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: token }), { status: 200, ok: true });
    assert.ok(await confirmadoEm(env, c.id));
    const outra = await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: token });
    assert.equal(outra.status, 410, 'uso único');
    assert.match(outra.error, /Reenviar/, 'a frase diz o que fazer');
    me = await pedirComFundo(env, c, '/api/me');
    assert.equal(me.emailConfirmado, true);
    assert.equal(me.confirmarAte, null);
  });

  test('um token que não existe responde igual a um usado; expirado também 410; mal formado 400', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const { conta: c, token } = await registar(env);
    const inventado = await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: 'c'.repeat(64) });
    assert.equal(inventado.status, 410);
    await env.DB.prepare('UPDATE email_verifications SET expires_at = ?').bind(Date.now() - 1).run();
    const expirado = await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: token });
    assert.equal(expirado.status, 410);
    assert.equal(expirado.error, inventado.error, 'a mesma frase: não se diz o que há do outro lado');
    assert.equal(await confirmadoEm(env, c.id), null);
    for (const t of ['', 'abc', 'Z'.repeat(64), 'a'.repeat(63), null]) {
      assert.equal((await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t })).status, 400, String(t));
    }
    assert.equal((await pedirComFundo(env, null, '/api/auth/confirmar', 'POST')).status, 400, 'sem corpo');
  });

  test('uma ligação enviada para um email que já não é o da conta não confirma (410)', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const { conta: c, token } = await registar(env, 'velho@exemplo.pt');
    await env.DB.prepare("UPDATE users SET email = 'novo@exemplo.pt' WHERE id = ?").bind(c.id).run();
    assert.equal((await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: token })).status, 410);
    assert.equal(await confirmadoEm(env, c.id), null);
  });

  test('duas chamadas ao mesmo tempo com o mesmo token: só uma confirma', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const { token } = await registar(env);
    const rs = await Promise.all([
      pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: token }),
      pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: token }),
    ]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 410]);
  });

  test('confirmar larga as outras ligações por usar da mesma conta', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const { conta: c, token } = await registar(env);
    await env.DB.prepare(
      "INSERT INTO email_verifications (token_hash, user_id, email, created_at, expires_at) VALUES ('h2', ?, ?, ?, ?)"
    ).bind(c.id, c.email, Date.now(), Date.now() + DIA).run();
    assert.equal((await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: token })).status, 200);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM email_verifications WHERE user_id = ? AND used_at IS NULL').bind(c.id).first();
    assert.equal(n.n, 0);
  });
});

/* ------------------------------- reenviar ------------------------------ */

describe('POST /api/me/confirmar/reenviar', () => {
  test('só com sessão', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    assert.equal((await pedirComFundo(env, null, '/api/me/confirmar/reenviar', 'POST')).status, 401);
  });

  test('manda uma ligação nova e larga as anteriores; teto de 3 por hora (429)', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const { conta: c, token: primeiro } = await registar(env);
    const enviados = resendFalso();
    const r = await pedirComFundo(env, c, '/api/me/confirmar/reenviar', 'POST');
    assert.equal(r.status, 200);
    assert.match(r.msg, /nova@exemplo\.pt/);
    const segundo = tokenDe(enviados[0]);
    assert.ok(segundo && segundo !== primeiro);
    assert.equal((await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: primeiro })).status, 410, 'a anterior deixou de valer');
    const vivas = await env.DB.prepare('SELECT COUNT(*) AS n FROM email_verifications WHERE user_id = ? AND used_at IS NULL').bind(c.id).first();
    assert.equal(vivas.n, 1, 'só a última vale');
    assert.equal((await pedirComFundo(env, c, '/api/me/confirmar/reenviar', 'POST')).status, 200);
    assert.equal((await pedirComFundo(env, c, '/api/me/confirmar/reenviar', 'POST')).status, 200);
    const quarto = await pedirComFundo(env, c, '/api/me/confirmar/reenviar', 'POST');
    assert.equal(quarto.status, 429);
    assert.equal(enviados.length, 3, 'o quarto não sai');
    assert.equal((await pedirComFundo(env, null, '/api/auth/confirmar', 'POST', { t: tokenDe(enviados[2]) })).status, 200, 'a última confirma');
  });

  test('numa conta já confirmada não manda nada; com o Resend a falhar diz-se (502)', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const A = await conta(env, 'Ana');
    await env.DB.prepare('UPDATE users SET email_verified_at = 1 WHERE id = ?').bind(A.id).run();
    const enviados = resendFalso();
    const r = await pedirComFundo(env, A, '/api/me/confirmar/reenviar', 'POST');
    assert.equal(r.status, 200);
    assert.equal(r.emailConfirmado, true);
    assert.equal(enviados.length, 0);

    const B = await conta(env, 'Bruno');
    resendFalso(500);
    console.error = () => {};
    assert.equal((await pedirComFundo(env, B, '/api/me/confirmar/reenviar', 'POST')).status, 502);
  });
});

/* ------------------------------ o portão ------------------------------- */

describe('o portão dos 7 dias', () => {
  test('ao 6.º dia sem confirmar passa tudo; ao 8.º, uma rota de dados dá 403 email_por_confirmar', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'h1');
    await nasceuHa(env, A.id, 6);
    assert.equal((await pedirComFundo(env, A, '/api/state')).status, 200, 'dia 6');
    await nasceuHa(env, A.id, 8);
    const r = await pedirComFundo(env, A, '/api/state');
    assert.equal(r.status, 403, 'dia 8');
    assert.equal(r.erro, 'email_por_confirmar');
    assert.match(r.error, /Confirma o teu email/);
    const escrita = await pedirComFundo(env, A, '/api/sync', 'POST', { ops: [] });
    assert.equal(escrita.status, 403, 'as escritas também');
    // com o email confirmado, passa outra vez
    await env.DB.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').bind(Date.now(), A.id).run();
    assert.equal((await pedirComFundo(env, A, '/api/state')).status, 200);
  });

  test('ao 8.º dia continuam a passar o /api/me, o reenviar, os termos, o sair e o apagar da conta', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    resendFalso();
    const A = await conta(env, 'Ana');
    await nasceuHa(env, A.id, 8);
    const me = await pedirComFundo(env, A, '/api/me');
    assert.equal(me.status, 200);
    assert.equal(me.emailConfirmado, false);
    assert.ok(me.confirmarAte < Date.now(), 'o prazo já passou: a app abre o ecrã');
    assert.equal((await pedirComFundo(env, A, '/api/me/confirmar/reenviar', 'POST')).status, 200);
    assert.equal((await pedirComFundo(env, A, '/api/me/terms', 'POST', { accept: true })).status, 200);
    assert.equal((await pedirComFundo(env, A, '/api/auth/logout', 'POST')).status, 200);
    assert.equal((await pedirComFundo(env, A, '/api/me')).status, 401, 'saiu');
    const B = await conta(env, 'Bruno', { pass: 'Forte#2026x' });
    await nasceuHa(env, B.id, 8);
    assert.equal((await pedirComFundo(env, B, '/api/me', 'DELETE', { confirm: 'APAGAR', password: 'Forte#2026x' })).status, 200, 'apagar a conta passa');
    const u = await env.DB.prepare('SELECT deleted_at FROM users WHERE id = ?').bind(B.id).first();
    assert.ok(u.deleted_at, 'apagada');
  });

  test('ao 8.º dia passam os pedidos de ajuda da própria conta (criar e ler), e o resto continua travado', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    resendFalso();
    const A = await conta(env, 'Ana');
    await nasceuHa(env, A.id, 8);
    const criado = await pedirComFundo(env, A, '/api/tickets', 'POST', { kind: 'problema', subject: 'Não recebo o email', body: 'Já pedi duas vezes.' });
    assert.equal(criado.status, 201, 'criar um pedido passa');
    const lidos = await pedirComFundo(env, A, '/api/tickets');
    assert.equal(lidos.status, 200, 'ler os seus passa');
    assert.deepEqual(lidos.tickets.map((t) => t.subject), ['Não recebo o email']);
    for (const [m, p] of [['GET', '/api/state'], ['POST', '/api/sync'], ['GET', '/api/conta/avisos'], ['POST', '/api/me/password'], ['DELETE', '/api/me/sessions'], ['GET', '/api/qa']]) {
      const r = await pedirComFundo(env, A, p, m, m === 'GET' || m === 'DELETE' ? undefined : {});
      assert.equal(r.status, 403, m + ' ' + p + ' continua travado');
      assert.equal(r.erro, 'email_por_confirmar');
    }
  });

  test('o portão lê o estado da sessão, sem outra consulta à base', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await nasceuHa(env, A.id, 8);
    const sqls = [];
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (s) => { sqls.push(s); return prepare(s); };
    assert.equal((await pedirComFundo(env, A, '/api/state')).status, 403);
    assert.equal(sqls.filter((s) => /FROM users/.test(s)).length, 1, 'só a da sessão: ' + sqls.join(' | '));
    assert.match(sqls.find((s) => /FROM users/.test(s)), /created_at, email_verified_at/);
  });

  test('uma conta antiga (confirmada pela migração) ou da Google nunca é travada', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await nasceuHa(env, A.id, 400);
    await env.DB.prepare('UPDATE users SET email_verified_at = created_at WHERE id = ?').bind(A.id).run();
    assert.equal((await pedirComFundo(env, A, '/api/state')).status, 200);
  });
});

/* --------------------------- apagar a conta ---------------------------- */

describe('apagar a conta', () => {
  test('leva as ligações por email da conta (confirmação e repor), e só as dela', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const { conta: c } = await registar(env, 'sai@exemplo.pt');
    const { conta: outra } = await registar(env, 'fica@exemplo.pt');
    resendFalso();
    for (const email of ['sai@exemplo.pt', 'fica@exemplo.pt']) {
      assert.equal((await pedirComFundo(env, null, '/api/auth/repor', 'POST', { email })).status, 200);
    }
    const contar = async (tabela, id) => (await env.DB.prepare('SELECT COUNT(*) AS n FROM ' + tabela + ' WHERE user_id = ?').bind(id).first()).n;
    assert.equal(await contar('email_verifications', c.id), 1);
    assert.equal(await contar('password_resets', c.id), 1);
    await purgeAccount(env, c.id);
    assert.equal(await contar('email_verifications', c.id), 0, 'a confirmação (com o email) saiu');
    assert.equal(await contar('password_resets', c.id), 0, 'o repor saiu');
    assert.equal(await contar('email_verifications', outra.id), 1, 'as da outra conta ficam');
    assert.equal(await contar('password_resets', outra.id), 1);
  });
});

/* ------------------------- os avisos de atraso ------------------------- */

describe('os avisos de atraso', () => {
  test('só vão para emails confirmados; o repor da palavra-passe vai sempre', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1', { name: 'Casa Soure' });
    const ontem = new Date(Date.now() - 3 * DIA).toISOString().slice(0, 10);
    await registo(env, 'h1', 'rec', 'r1', { name: 'Condomínio', every: 'monthly', next: ontem, until: '', muted: false,
      tx: { kind: 'expense', amount: 40, label: '', category: 'Condomínio' } }, D);
    let r = await resumoDosAtrasos(env, Date.now(), { pausa: 0 });
    assert.equal(r.enviados, 0, 'por confirmar: nada');
    assert.equal(enviados.length, 0);
    assert.equal((await pedirComFundo(env, null, '/api/auth/repor', 'POST', { email: D.email })).status, 200);
    assert.equal(enviados.length, 1, 'o repor vai mesmo por confirmar');
    assert.match(enviados[0].text, /repor=/);
    await env.DB.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').bind(Date.now(), D.id).run();
    r = await resumoDosAtrasos(env, Date.now(), { pausa: 0 });
    assert.equal(r.enviados, 1, 'confirmado: recebe');
    assert.deepEqual(enviados[1].to, [D.email]);
  });
});
