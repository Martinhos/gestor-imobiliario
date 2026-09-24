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
import { ambiente as ambienteDoWorker } from './lib/api.js';

/* O ambiente de testes/lib/api.js, com o token do bot que o /test usa.
   Recebe: extra (opcional) — o que se troca (ENV_NAME: undefined é produção).
   Devolve: o env. */
const ambienteDoTeste = (extra = {}) => ambienteDoWorker(Object.assign({ DISCORD_BOT_TOKEN: 'tok-de-teste' }, extra));

// abre a ligação como um browser abriria: emite-a e entrega-a à rota
async function abrir(env, comDados, mexe, manter, quem, limpar, email) {
  let lig = await ligacaoTeste(env, 'https://dev.x.pt', comDados, manter, quem, limpar, email);
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
    const env = ambienteDoTeste({ ENV_NAME: undefined });
    const r = await abrir(env, false);
    assert.equal(r.status, 404);
    assert.equal((await contas(env)).length, 0, 'produção não criou conta nenhuma');
  });

  test('assinatura errada é 403; expirada é 410; incompleta é 400', async () => {
    const env = ambienteDoTeste();
    // trocar o primeiro caracter por um DIFERENTE — substituir por um fixo
    // deixava o link intacto 1 vez em 16, e o teste falhava aleatoriamente
    const ma = await abrir(env, false, (l) => l.replace(/sig=(.)/, (m, c) => 'sig=' + (c === 'f' ? '0' : 'f')));
    assert.equal(ma.status, 403);
    const velha = await abrir(env, false, (l) => l.replace(/exp=\d+/, 'exp=1700000000000'));
    assert.equal(velha.status, 410, 'a validade assinada manda — mudar o exp também mata a assinatura, mas uma ligação genuína velha morre aqui');
    const coxa = await abrir(env, false, (l) => l.replace(/&sig=.+$/, ''));
    assert.equal(coxa.status, 400);
    assert.equal((await contas(env)).length, 0);
  });

  test('mexer no exp para esticar a validade rebenta na assinatura', async () => {
    const env = ambienteDoTeste();
    const r = await abrir(env, false, (l) => l.replace(/exp=(\d+)/, (m, e) => 'exp=' + (Number(e) + 86400000)));
    assert.equal(r.status, 403);
  });

  test('uma ligação boa entra: conta nova, sessão posta, e a marca de exemplo quando pedida', async () => {
    const env = ambienteDoTeste();
    const r = await abrir(env, false);
    assert.equal(r.status, 302);
    const destino = r.headers.get('Location');
    const m = /\/\?entrar=([a-f0-9]{64})$/.exec(destino);
    assert.ok(m, 'sem dados de exemplo, sem marca: ' + destino);
    assert.ok(await env.SESSIONS.get('sess:' + m[1]), 'a sessão existe mesmo');
    const vivas = (await contas(env)).filter((u) => !u.deleted_at);
    assert.equal(vivas.length, 1);
    assert.ok(eContaDeTeste(vivas[0].email));

    const env2 = ambienteDoTeste();
    const r2 = await abrir(env2, true);
    assert.match(r2.headers.get('Location'), /&exemplo=1$/, 'com dados, a marca vai no endereço ao criar');
  });

  test('por omissão retoma-se a conta com os dados intactos; limpar é que apaga', async () => {
    const env = ambienteDoTeste();
    await abrir(env, false, null, false, 'alice');
    const primeira = (await contas(env)).find((u) => !u.deleted_at);
    await env.DB.prepare(
      "INSERT INTO houses (id, owner_id, data, updated_at) VALUES ('H1', ?, '{}', 1)"
    ).bind(primeira.id).run();

    // no dia seguinte: a ligação nova retoma a MESMA conta, casa e tudo
    const r = await abrir(env, true, null, false, 'alice');
    assert.equal(r.status, 302);
    assert.ok(!/exemplo=1/.test(r.headers.get('Location')), 'retomar nunca semeia por cima');
    const vivas = (await contas(env)).filter((u) => !u.deleted_at);
    assert.equal(vivas.length, 1, 'não se criou outra');
    assert.equal(vivas[0].id, primeira.id, 'é a mesma conta');
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM houses').first()).n, 1, 'a casa ficou');

    // limpar: aí sim, tudo fora e conta nova
    await abrir(env, false, null, false, 'alice', true);
    const todas = await contas(env);
    assert.equal(todas.filter((u) => !u.deleted_at).length, 1);
    assert.ok(todas.find((u) => u.id === primeira.id).deleted_at, 'a antiga ficou lápide');
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM houses').first()).n, 0, 'a casa foi com ela');
  });
});

describe('a opção manter: conta extra sem lavar', () => {
  test('duas contas vivas ao mesmo tempo — e mexer no m rebenta a assinatura', async () => {
    const env = ambienteDoTeste();
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

describe('a TESTE_CHAVE partilhada manda sobre o token do bot', () => {
  test('dois ambientes com tokens diferentes mas a mesma chave entendem-se', async () => {
    const prod = ambienteDoTeste({ DISCORD_BOT_TOKEN: 'tok-prod', TESTE_CHAVE: 'chave-comum' });
    const dev = ambienteDoTeste({ DISCORD_BOT_TOKEN: 'tok-dev', TESTE_CHAVE: 'chave-comum' });
    const lig = await ligacaoTeste(prod, 'https://dev.x.pt', false, false, 'alice');
    const r = await rotaTeste({ env: dev, url: new URL(lig), request: new Request(lig) });
    assert.equal(r.status, 302, 'a ligação de um vale no outro');

    const semChave = ambienteDoTeste({ DISCORD_BOT_TOKEN: 'tok-dev' });
    const r2 = await rotaTeste({ env: semChave, url: new URL(lig), request: new Request(lig) });
    assert.equal(r2.status, 403, 'sem a chave comum, tokens diferentes não se entendem');
  });
});

describe('a assinatura antiga (sem manter) ainda vale — só como lavar', () => {
  test('uma ligação assinada à moda da produção atual entra', async () => {
    const env = ambienteDoTeste();
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

describe('o email do dev viaja assinado na ligação', () => {
  test('abrir a ligação grava o registo no KV; mexer no email rebenta a assinatura', async () => {
    const env = ambienteDoTeste();
    await abrir(env, false, null, false, 'alice', false, 'Alice@Gmail.com');
    assert.equal(await env.SESSIONS.get('teste:email:alice'), 'alice@gmail.com', 'guardado, normalizado');

    const mau = await abrir(env, false, (l) => l.replace('alice%40gmail.com', 'ladrao%40mal.com'),
      false, 'alice', false, 'alice@gmail.com');
    assert.equal(mau.status, 403, 'o destino do correio não se troca sem assinar');
  });
});

describe('cada dev tem as suas contas', () => {
  test('o dono fica gravado, e a lavagem de um não toca nas do outro', async () => {
    const env = ambienteDoTeste();
    await abrir(env, false, null, false, 'alice');
    await abrir(env, false, null, true, 'bob');   // manter: junta-se
    let vivas = (await contas(env)).filter((u) => !u.deleted_at);
    assert.equal(vivas.length, 2);

    // alice limpa: a dela vai-se, a do bob fica
    await abrir(env, false, null, false, 'alice', true);
    vivas = (await contas(env)).filter((u) => !u.deleted_at);
    assert.equal(vivas.length, 2, 'a nova da alice e a do bob');
    const donos = await env.DB.prepare('SELECT test_owner FROM users WHERE deleted_at IS NULL ORDER BY test_owner').all();
    assert.deepEqual(donos.results.map((x) => x.test_owner), ['alice', 'bob']);
  });

  test('uma conta órfã é adotada pela primeira ligação com dono — não se cria outra ao lado', async () => {
    const env = ambienteDoTeste();
    // ligação à moda antiga (sem dono): nasce órfã, com uma casa
    await abrir(env, false);
    const orfa = (await contas(env)).find((u) => !u.deleted_at);
    await env.DB.prepare("INSERT INTO houses (id, owner_id, data, updated_at) VALUES ('H3', ?, '{}', 1)")
      .bind(orfa.id).run();

    const r = await abrir(env, false, null, false, 'alice');
    assert.equal(r.status, 302);
    const vivas = (await contas(env)).filter((u) => !u.deleted_at);
    assert.equal(vivas.length, 1, 'adotou em vez de criar');
    assert.equal(vivas[0].id, orfa.id);
    const dona = await env.DB.prepare('SELECT test_owner FROM users WHERE id = ?').bind(orfa.id).first();
    assert.equal(dona.test_owner, 'alice', 'a órfã passou a ter dono');
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM houses').first()).n, 1, 'com os dados que lá estavam');
  });

  test('o seletor: lista só as do próprio, troca dentro delas, e cria extra', async () => {
    const env = ambienteDoTeste();
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
    const env = ambienteDoTeste();
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

describe('apagar uma conta de teste entrega logo a próxima', () => {
  const apagar = (env, token) => handleApi(new Request('https://dev.x.pt/api/me', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ confirm: 'APAGAR' }),
  }), env, { waitUntil() {} });

  test('com irmã, troca para ela; sem nenhuma, cria e entra — sem pedir palavra-passe', async () => {
    const env = ambienteDoTeste();
    tokenDe(await abrir(env, false, null, false, 'alice'));   // a principal: só tem de entrar
    const a1 = (await contas(env)).find((u) => !u.deleted_at);
    const tB = tokenDe(await abrir(env, false, null, true, 'alice'));   // extra

    // apagar a extra: aterra na irmã (a primeira), sem password nenhuma
    const r1 = await (await apagar(env, tB)).json();
    assert.ok(r1.proxima, 'veio a próxima');
    assert.equal(r1.proxima.id, a1.id, 'a irmã mais recente do mesmo dono');
    assert.ok(r1.proxima.token);

    // apagar a última: cria-se uma nova na hora, do mesmo dono
    const r2 = await (await apagar(env, r1.proxima.token)).json();
    assert.ok(r2.proxima, 'mesmo sem irmãs há próxima');
    assert.notEqual(r2.proxima.id, a1.id);
    const nova = await env.DB.prepare('SELECT test_owner, pass_hash FROM users WHERE id = ?')
      .bind(r2.proxima.id).first();
    assert.equal(nova.test_owner, 'alice');
    assert.equal(nova.pass_hash, '', 'sem palavra-passe de todo');
    const eu = await (await handleApi(new Request('https://dev.x.pt/api/me', {
      headers: { Authorization: 'Bearer ' + r2.proxima.token },
    }), env, { waitUntil() {} })).json();
    assert.equal(eu.id, r2.proxima.id, 'o token da próxima entra mesmo');
  });

  test('uma conta normal continua a exigir a palavra-passe para se apagar', async () => {
    const env = ambienteDoTeste();
    const pw = await hashPassword('Descartavel1!');
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at)
       VALUES ('N7', 'gente@x.pt', 'G', ?, ?, 1, ?, 1)`
    ).bind(pw.hash, pw.salt, TERMS_VERSION).run();
    const t = await createSession(env, 'N7', 0);
    const r = await apagar(env, t);
    assert.equal(r.status, 401, 'sem palavra-passe não se apaga');
  });
});

describe('sair de uma conta de teste NÃO apaga nada', () => {
  const sair = (env, token) => handleApi(
    new Request('https://dev.x.pt/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    }), env, { waitUntil() {} });

  test('logout fecha a sessão e a conta fica — a ligação do dia seguinte retoma-a', async () => {
    const env = ambienteDoTeste();
    const r = await abrir(env, false, null, false, 'alice');
    const token = /entrar=([a-f0-9]{64})/.exec(r.headers.get('Location'))[1];
    const deTeste = (await contas(env)).find((u) => !u.deleted_at);
    await env.DB.prepare(
      "INSERT INTO houses (id, owner_id, data, updated_at) VALUES ('H2', ?, '{}', 1)"
    ).bind(deTeste.id).run();

    // a conta normal, de controlo
    const pw = await hashPassword('Descartavel1!');
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at)
       VALUES ('N1', 'pessoa@x.pt', 'Pessoa', ?, ?, 1, ?, 1)`
    ).bind(pw.hash, pw.salt, TERMS_VERSION).run();
    const tokenNormal = await createSession(env, 'N1', 0);

    const s1 = await sair(env, token);
    assert.equal(s1.status, 200);
    assert.equal(await env.SESSIONS.get('sess:' + token), null, 'a sessão morreu');
    const depois = await contas(env);
    assert.equal(depois.find((u) => u.id === deTeste.id).deleted_at, null, 'a conta fica');

    // no dia seguinte: retomada, com a casa lá dentro
    const volta = await abrir(env, false, null, false, 'alice');
    assert.match(volta.headers.get('Location'), /entrar=/);
    const vivas = (await contas(env)).filter((u) => !u.deleted_at && u.email.includes('@teste.'));
    assert.equal(vivas.length, 1);
    assert.equal(vivas[0].id, deTeste.id, 'a mesma conta de ontem');
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM houses').first()).n, 1, 'os dados intactos');

    const s2 = await sair(env, tokenNormal);
    assert.equal(s2.status, 200);
    const normal = (await contas(env)).find((u) => u.id === 'N1');
    assert.equal(normal.deleted_at, null, 'a conta normal saiu e continua cá');
    assert.equal(normal.email, 'pessoa@x.pt');
  });
});
