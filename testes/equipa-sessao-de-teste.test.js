// O back office do dev abre com a sessão de teste (ticket de QA 68c59ce4,
// decisão do Martinho de 2026-11-09): quem entrou na app por uma ligação do
// /test e abre o /equipa sem sessão de equipa entra em nome da pessoa do
// Discord que pediu a ligação, com os cargos que o Discord lhe dá agora. É a
// porta dos dados da equipa, por isso os testes olham sobretudo para o que
// NÃO abre: fora do dev, sem cargo, com uma conta normal, pela API, de outro
// site, com o Discord em baixo. Corre o worker inteiro (index.js) contra o
// SQL a sério; o Discord é um fetch fingido.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import worker from '../worker/src/index.js';
import { ligacaoTeste } from '../worker/src/teste.js';
import { criarBilhete } from '../worker/src/equipa.js';
import { createSession } from '../worker/src/auth.js';
import { TERMS_VERSION } from '../worker/src/lib/http.js';
import { ambiente, conta } from './lib/api.js';

const ORIGEM = 'https://dev.rendorium.com';
// a pessoa do Discord que pede o /test, e os servidores onde o bot de dev está
const DONO = '123456789012345678';
const SERVIDOR = '987654321098765432';
const OUTRO_SERVIDOR = '987654321098765433';
const MIN = 60000;

const fetchReal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchReal; });

/* O ambiente do dev publicado (ENV_NAME 'dev', a porta fechada, a chave das
   ligações do /test), com o token do bot e as listas de papéis do Discord.
   Recebe: extra (opcional) — o que se troca.
   Devolve: o env. */
const dev = (extra) => ambiente(Object.assign({
  ENV_NAME: 'dev', PORTA_DEV: 'fechada', TESTE_CHAVE: 'chave-das-ligacoes', DISCORD_BOT_TOKEN: 'bot',
  DISCORD_MASTER: 'ninguem', DISCORD_SUPORTE: 'cargo-suporte', DISCORD_DEVS: 'cargo-dev',
  ASSETS: { fetch: async () => new Response('não há', { status: 404 }) },
}, extra || {}));

/* Um pedido ao worker inteiro, como chega da Cloudflare.
   Recebe: env; caminho; o (opcional) — {method, headers, body}.
   Devolve: a promessa da Response. */
async function pedirAoWorker(env, caminho, o) {
  const op = o || {};
  const fundo = [];
  const r = await worker.fetch(new Request(ORIGEM + caminho, { method: op.method || 'GET', headers: op.headers || {}, body: op.body }),
    env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
  return r;
}

// Recebe: r — uma Response. Devolve: as linhas Set-Cookie dela, uma por cookie.
const cookiesDe = (r) => r.headers.getSetCookie();
// Recebe: r — uma Response. Devolve: as linhas Set-Cookie da marca de quem saiu do back office.
const marcasDe = (r) => cookiesDe(r).filter((c) => c.startsWith('gi_equipa_saiu='));
const MARCA = 'gi_equipa_saiu=1';

/* Entra na app como um browser entra: abre a ligação do /test pelo worker
   (com o dono e o nome dele, como o bot a dá) e fica com o cookie.
   Recebe: env; quem (opcional) — o id de Discord do dono ('' para uma
   ligação sem dono); traz (opcional) — os cookies que o browser já tem.
   Devolve: a promessa do cookie «gi_session=…» (a resposta inteira dá-a o
   abrirLigacao). */
async function entrarPeloTeste(env, quem, traz) {
  return (await abrirLigacao(env, quem, traz)).cookie;
}

/* Abre uma ligação nova do /test pelo worker.
   Recebe: env; quem (opcional) — o id de Discord do dono; traz (opcional) —
   os cookies que o browser já tem.
   Devolve: a promessa de {cookie, resposta}. */
async function abrirLigacao(env, quem, traz) {
  const dono = quem === undefined ? DONO : quem;
  const lig = new URL(await ligacaoTeste(env, ORIGEM, false, false, dono, false, '', dono ? 'Martinho' : ''));
  const r = await pedirAoWorker(env, lig.pathname + lig.search, { headers: traz ? { Cookie: traz } : {} });
  const m = /gi_session=([a-f0-9]{64})/.exec(r.headers.get('Set-Cookie') || '');
  assert.ok(m, 'a ligação do /test deu sessão');
  return { cookie: 'gi_session=' + m[1], resposta: r };
}

/* O Discord fingido: a lista de servidores do bot e os cargos de cada um.
   Recebe: o — {servidores (os ids, por omissão [SERVIDOR]), cargos ({servidor:
   [ids de cargo]}; quem não está lá não é membro), rede (true: sem rede),
   estado (um estado HTTP para todas as respostas)}.
   Devolve: a lista dos URLs pedidos. */
function discord(o) {
  const vistos = [];
  const json = (corpo, estado) => new Response(JSON.stringify(corpo), { status: estado || 200 });
  globalThis.fetch = async (url) => {
    const u = String(url);
    vistos.push(u);
    if (o.rede) throw new Error('sem rede');
    if (o.estado) return json({}, o.estado);
    if (u.endsWith('/users/@me/guilds')) return json((o.servidores || [SERVIDOR]).map((id) => ({ id, name: 'S' + id })));
    const m = /\/guilds\/(\d+)\/members\/(\d+)$/.exec(u);
    if (m) {
      const c = (o.cargos || {})[m[1]];
      return c ? json({ roles: c, user: { id: m[2] } }) : json({ code: 10007, message: 'Unknown Member' }, 404);
    }
    if (/\/users\/\d+$/.test(u)) return json({ id: DONO, global_name: 'Do bot' });
    return json({ message: 'não fingido' }, 404);
  };
  return vistos;
}

// as chaves das sessões de equipa no KV de faz-de-conta
const sessoesDeEquipa = (env) => [...env.SESSIONS.m.keys()].filter((k) => k.startsWith('equipa:'));
// as entradas no back office registadas na auditoria
const entradas = async (env) => (await env.DB.prepare("SELECT * FROM audit_log WHERE acao = 'equipa.entrar' ORDER BY id").all()).results;

/* Confere que a resposta é a página de entrada de hoje (401, «Entra-se a
   partir do Discord»), sem cookie e sem sessão de equipa nenhuma criada.
   Recebe: env; r — a Response; onde — para a mensagem.
   Devolve: a promessa de nada. */
async function paginaDeEntrada(env, r, onde) {
  assert.equal(r.status, 401, onde + ': fica a página de entrada');
  assert.match(await r.text(), /Entra-se a partir do Discord/, onde);
  assert.equal(r.headers.get('Set-Cookie'), null, onde + ': sem cookie');
  assert.deepEqual(sessoesDeEquipa(env), [], onde + ': nenhuma sessão de equipa no KV');
  assert.deepEqual(await entradas(env), [], onde + ': nenhuma entrada na auditoria');
}

const DA_PILULA = { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };

describe('no dev, a sessão de teste de quem tem cargo abre o back office', () => {
  test('a pílula › «Back office»: 303 para o mesmo endereço com o cookie da equipa, a sessão no KV e a entrada na auditoria', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    const vistos = discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });

    const r = await pedirAoWorker(env, '/equipa', { headers: Object.assign({ Cookie: cookie }, DA_PILULA) });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('Location'), '/equipa', 'volta ao mesmo endereço');
    const m = /^gi_equipa=([a-f0-9]{64}); Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800$/.exec(r.headers.get('Set-Cookie') || '');
    assert.ok(m, 'o cookie da equipa, como o do /entrar: ' + r.headers.get('Set-Cookie'));
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.match(r.headers.get('Content-Security-Policy') || '', /default-src 'self'/, 'passou pelo harden');

    const s = JSON.parse(await env.SESSIONS.get('equipa:' + m[1]));
    assert.equal(s.discordId, DONO, 'em nome de quem pediu o /test');
    assert.equal(s.nome, 'Martinho', 'com o nome que a ligação trouxe');
    assert.deepEqual(s.papeis, ['suporte'], 'com os cargos de agora no Discord');
    assert.equal(s.papel, 'suporte');
    assert.equal(s.guildId, SERVIDOR, 'e o servidor onde os papéis se voltam a perguntar');
    assert.ok(s.desde > 0 && s.verificadoEm === s.desde, 'verificada agora');
    assert.ok(vistos.some((u) => u.endsWith('/users/@me/guilds')), 'perguntou ao Discord onde está o bot');
    assert.ok(vistos.some((u) => u.endsWith('/guilds/' + SERVIDOR + '/members/' + DONO)), 'e os cargos da pessoa');

    const [linha] = await entradas(env);
    const contaDeTeste = await env.DB.prepare("SELECT id FROM users WHERE test_owner = ?").bind(DONO).first();
    assert.equal(linha.quem, DONO);
    assert.equal(linha.papel, 'suporte');
    assert.equal(linha.alvo, contaDeTeste.id, 'o alvo é a conta de teste de onde veio');
    assert.match(linha.detalhe, /sessão de teste do dev/, 'e diz de onde veio');

    // daí para a frente é uma sessão como as do /entrar, sem voltar ao Discord
    const antes = vistos.length;
    const equipa = 'gi_equipa=' + m[1];
    const p = await pedirAoWorker(env, '/equipa', { headers: Object.assign({ Cookie: cookie + '; ' + equipa }, DA_PILULA) });
    assert.equal(p.status, 200, 'o back office abre');
    assert.match(await p.text(), /Martinho/);
    const eu = await pedirAoWorker(env, '/api/equipa/eu', { headers: { Cookie: equipa } });
    assert.equal(eu.status, 200);
    assert.equal((await eu.json()).discordId, DONO, 'e a API aceita a sessão criada');
    assert.equal(vistos.length, antes, 'acabada de verificar, sem perguntar outra vez');
    assert.equal(sessoesDeEquipa(env).length, 1, 'uma sessão só');
  });

  test('o /equipa/, o /equipa/docs e um endereço com query: volta-se ao próprio caminho, de uma lista fechada', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    discord({ cargos: { [SERVIDOR]: ['cargo-dev'] } });
    for (const [caminho, destino] of [['/equipa/', '/equipa/'], ['/equipa/docs', '/equipa/docs'],
      ['/equipa?depois=https://mau.example/x', '/equipa'], ['/equipa/docs?Location=//mau.example', '/equipa/docs']]) {
      const r = await pedirAoWorker(env, caminho, { headers: { Cookie: cookie } });
      assert.equal(r.status, 303, caminho);
      assert.equal(r.headers.get('Location'), destino, caminho + ': nenhum redirecionamento livre');
    }
  });

  test('o bot em dois servidores: conta o primeiro onde a pessoa tem papel, e é lá que os papéis se voltam a perguntar', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    discord({ servidores: [OUTRO_SERVIDOR, SERVIDOR], cargos: { [OUTRO_SERVIDOR]: ['cargo-qualquer'], [SERVIDOR]: ['cargo-dev', 'cargo-suporte'] } });
    const r = await pedirAoWorker(env, '/equipa', { headers: { Cookie: cookie } });
    assert.equal(r.status, 303);
    const s = JSON.parse(await env.SESSIONS.get(sessoesDeEquipa(env)[0]));
    assert.equal(s.guildId, SERVIDOR);
    assert.deepEqual(s.papeis, ['dev', 'suporte'], 'dois cargos somam, como no bot');
  });

  test('os papéis revêem-se de 15 em 15 minutos como numa entrada pelo Discord: sem o cargo, a sessão morre', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
    const r = await pedirAoWorker(env, '/equipa', { headers: { Cookie: cookie } });
    const token = /gi_equipa=([a-f0-9]{64})/.exec(r.headers.get('Set-Cookie'))[1];
    const k = 'equipa:' + token;
    const s = JSON.parse(await env.SESSIONS.get(k));
    s.desde -= 20 * MIN;
    s.verificadoEm -= 20 * MIN;
    await env.SESSIONS.put(k, JSON.stringify(s));

    const vistos = discord({ cargos: { [SERVIDOR]: [] } });   // tiraram-lhe o cargo
    const eu = await pedirAoWorker(env, '/api/equipa/eu', { headers: { Cookie: 'gi_equipa=' + token } });
    assert.equal(eu.status, 401, 'sem cargo, sem sessão');
    assert.ok(vistos.some((u) => u.endsWith('/guilds/' + SERVIDOR + '/members/' + DONO)), 'perguntou ao servidor guardado');
    assert.equal(await env.SESSIONS.get(k), null, 'e a sessão saiu do KV');
    // e a sessão de teste não a volta a abrir: o Discord diz que já não tem cargo
    await paginaDeEntradaSemEntradaNova(env, await pedirAoWorker(env, '/equipa', { headers: { Cookie: cookie } }));
  });
});

/* A página de entrada depois de já ter havido uma entrada: 401, sem cookie,
   sem sessão de equipa no KV e com uma entrada só na auditoria (a primeira).
   Recebe: env; r — a Response.
   Devolve: a promessa de nada. */
async function paginaDeEntradaSemEntradaNova(env, r) {
  assert.equal(r.status, 401);
  assert.match(await r.text(), /Entra-se a partir do Discord/);
  assert.equal(r.headers.get('Set-Cookie'), null);
  assert.deepEqual(sessoesDeEquipa(env), []);
  assert.equal((await entradas(env)).length, 1);
}

describe('o que a sessão de teste não abre', () => {
  test('sem cargo de equipa, ou sem ser membro do servidor: a página de entrada de hoje', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    const casos = [
      [{ cargos: { [SERVIDOR]: ['cargo-de-outra-coisa'] } }, 'com cargos, mas nenhum da equipa'],
      [{ cargos: { [SERVIDOR]: [] } }, 'sem cargo nenhum'],
      [{ cargos: {} }, 'não é membro do servidor (10007)'],
      [{ servidores: [], cargos: {} }, 'o bot não está em servidor nenhum'],
    ];
    for (const [o, porque] of casos) {
      const vistos = discord(o);
      await paginaDeEntrada(env, await pedirAoWorker(env, '/equipa', { headers: Object.assign({ Cookie: cookie }, DA_PILULA) }), porque);
      assert.ok(vistos.length >= 1, porque + ': perguntou ao Discord');
    }
  });

  test('uma conta normal do dev, ou uma conta de teste sem dono: a página de entrada, sem perguntar ao Discord', async () => {
    const env = dev();
    const normal = await conta(env, 'Ana');
    const semDono = await entrarPeloTeste(env, '');
    const vistos = discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
    await paginaDeEntrada(env, await pedirAoWorker(env, '/equipa', { headers: { Cookie: 'gi_session=' + normal.token } }), 'conta normal');
    await paginaDeEntrada(env, await pedirAoWorker(env, '/equipa/docs', { headers: { Cookie: 'gi_session=' + normal.token } }), 'conta normal, docs');
    await paginaDeEntrada(env, await pedirAoWorker(env, '/equipa', { headers: { Cookie: semDono } }), 'conta de teste sem dono');
    await paginaDeEntrada(env, await pedirAoWorker(env, '/equipa', { headers: { Cookie: 'gi_session=' + 'a'.repeat(64) } }), 'sessão inventada');
    await paginaDeEntrada(env, await pedirAoWorker(env, '/equipa'), 'sem sessão nenhuma');
    assert.deepEqual(vistos, [], 'o Discord nem foi perguntado');
  });

  test('em produção e no percurso, nada muda: nem o Discord nem o KV da sessão de teste', async () => {
    for (const nome of [undefined, 'percurso']) {
      const env = dev({ ENV_NAME: nome, PORTA_DEV: undefined });
      // uma conta de teste com dono, escrita direto (em produção o /t/entrar nem existe)
      await env.DB.prepare(
        `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at, test_owner)
         VALUES ('UT1', 'teste-ut1@teste.rendorium.com', 'Conta de teste', '', '', 1, ?, 1, ?)`
      ).bind(TERMS_VERSION, DONO).run();
      const token = await createSession(env, 'UT1', 0);
      const lidas = [];
      const get = env.SESSIONS.get.bind(env.SESSIONS);
      env.SESSIONS.get = async (k) => { lidas.push(k); return get(k); };
      const vistos = discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
      for (const caminho of ['/equipa', '/equipa/', '/equipa/docs']) {
        await paginaDeEntrada(env, await pedirAoWorker(env, caminho, { headers: Object.assign({ Cookie: 'gi_session=' + token }, DA_PILULA) }),
          (nome || 'produção') + ' ' + caminho);
      }
      assert.deepEqual(vistos, [], (nome || 'produção') + ': sem chamar o Discord');
      assert.deepEqual(lidas.filter((k) => k.startsWith('sess:')), [], (nome || 'produção') + ': sem ler a sessão de teste');
    }
  });

  test('a API do back office continua a pedir a sessão de equipa: com só a sessão de teste, 401', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    const vistos = discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
    for (const [method, caminho] of [['GET', '/api/equipa/eu'], ['GET', '/api/equipa/qa'], ['GET', '/api/equipa/pedidos'],
      ['POST', '/api/equipa/qa'], ['GET', '/api/equipa/sessoes-teste']]) {
      const r = await pedirAoWorker(env, caminho, { method, headers: { Cookie: cookie } });
      assert.equal(r.status, 401, method + ' ' + caminho);
      assert.equal(r.headers.get('Set-Cookie'), null, method + ' ' + caminho + ': sem cookie');
    }
    assert.deepEqual(vistos, [], 'sem perguntar ao Discord');
    assert.deepEqual(sessoesDeEquipa(env), []);
  });

  test('só a navegar: um POST ou um HEAD à página, ou uma navegação vinda de outro site, não abrem nada', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    const vistos = discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
    const casos = [
      ['POST', '/equipa', {}, 'um POST'],
      ['GET', '/equipa', { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' }, 'uma ligação de outro site'],
      ['GET', '/equipa/docs', { 'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Mode': 'navigate' }, 'um subdomínio vizinho'],
    ];
    for (const [method, caminho, h, porque] of casos) {
      await paginaDeEntrada(env, await pedirAoWorker(env, caminho, { method, headers: Object.assign({ Cookie: cookie }, h) }), porque);
    }
    const head = await pedirAoWorker(env, '/equipa', { method: 'HEAD', headers: { Cookie: cookie } });
    assert.equal(head.status, 401, 'um HEAD');
    assert.equal(head.headers.get('Set-Cookie'), null);
    assert.deepEqual(vistos, [], 'sem perguntar ao Discord');
    assert.deepEqual(sessoesDeEquipa(env), []);
    // escrito à mão na barra de endereços (Sec-Fetch-Site: none) abre
    const r = await pedirAoWorker(env, '/equipa', { headers: { Cookie: cookie, 'Sec-Fetch-Site': 'none' } });
    assert.equal(r.status, 303, 'o endereço escrito à mão abre');
  });

  test('com o Discord a falhar, ou sem token do bot: a página de entrada, nunca um 500', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    const casos = [
      [{ rede: true }, 'sem rede'],
      [{ estado: 500 }, 'o Discord responde 500'],
      [{ estado: 429 }, 'o Discord trava o bot'],
    ];
    for (const [o, porque] of casos) {
      const vistos = discord(o);
      await paginaDeEntrada(env, await pedirAoWorker(env, '/equipa', { headers: { Cookie: cookie } }), porque);
      assert.ok(vistos.length >= 1, porque + ': tentou');
    }
    // os servidores respondem, os cargos não
    globalThis.fetch = async (url) => (String(url).endsWith('/users/@me/guilds')
      ? new Response(JSON.stringify([{ id: SERVIDOR }]), { status: 200 })
      : new Response('{}', { status: 502 }));
    await paginaDeEntrada(env, await pedirAoWorker(env, '/equipa', { headers: { Cookie: cookie } }), 'os cargos falham');

    const semBot = dev({ DISCORD_BOT_TOKEN: undefined });
    const outro = await entrarPeloTeste(semBot);
    const vistos = discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
    await paginaDeEntrada(semBot, await pedirAoWorker(semBot, '/equipa', { headers: { Cookie: outro } }), 'sem token do bot');
    assert.deepEqual(vistos.filter((u) => u.includes('/guilds')), [], 'sem token não há a quem perguntar');
  });

  test('sem a linha na auditoria não há sessão: a que se gravou apaga-se', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => {
      if (/^INSERT INTO audit_log/.test(sql)) throw new Error('D1 em baixo');
      return prepare(sql);
    };
    await paginaDeEntrada(env, await pedirAoWorker(env, '/equipa', { headers: { Cookie: cookie } }), 'a auditoria falha');
  });
});

/* «Sair fica fora até novo /test» (decisão do Martinho, 2026-11-09): o sair
   do back office do dev deixa uma marca, e enquanto ela lá estiver a sessão
   de teste não volta a abrir o back office; tiram-na uma ligação nova do
   /test e o /entrar do Discord. Fora do dev não há marca nenhuma. */
describe('sair do back office do dev fica fora até um /test novo', () => {
  /* Entra pela sessão de teste e sai pelo botão «Sair» (o POST do guião).
     Recebe: env; cookie — o da sessão de teste.
     Devolve: a promessa da resposta do sair. */
  async function entrarESair(env, cookie) {
    const r = await pedirAoWorker(env, '/equipa', { headers: Object.assign({ Cookie: cookie }, DA_PILULA) });
    assert.equal(r.status, 303, 'entrou pela sessão de teste');
    const equipa = /gi_equipa=[a-f0-9]{64}/.exec(r.headers.get('Set-Cookie'))[0];
    return pedirAoWorker(env, '/api/equipa/sair', { method: 'POST', headers: { Cookie: cookie + '; ' + equipa } });
  }

  test('sair → recarregar fica na página de entrada, sem perguntar ao Discord', async () => {
    const env = dev();
    const cookie = await entrarPeloTeste(env);
    discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
    const s = await entrarESair(env, cookie);
    assert.equal(s.status, 200);
    assert.ok(cookiesDe(s).some((c) => /^gi_equipa=; .*Max-Age=0$/.test(c)), 'o cookie da equipa sai, como sempre');
    const [marca] = marcasDe(s);
    assert.match(marca || '', /^gi_equipa_saiu=1; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=\d+$/, 'e fica a marca: ' + marca);
    assert.deepEqual(sessoesDeEquipa(env), [], 'a sessão saiu do KV');

    const vistos = discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
    for (const caminho of ['/equipa', '/equipa/', '/equipa/docs']) {
      const r = await pedirAoWorker(env, caminho, { headers: Object.assign({ Cookie: cookie + '; ' + MARCA }, DA_PILULA) });
      assert.equal(r.status, 401, caminho + ': fica fora');
      assert.match(await r.text(), /Entra-se a partir do Discord/);
      assert.equal(r.headers.get('Set-Cookie'), null);
    }
    assert.deepEqual(vistos, [], 'nem pergunta ao Discord');
    assert.deepEqual(sessoesDeEquipa(env), []);
    assert.equal((await entradas(env)).length, 1, 'só a primeira entrada');
  });

  test('uma ligação nova do /test tira a marca, e a entrada pela sessão de teste volta', async () => {
    const env = dev();
    const antiga = await entrarPeloTeste(env);
    discord({ cargos: { [SERVIDOR]: ['cargo-suporte'] } });
    await entrarESair(env, antiga);

    const { cookie, resposta } = await abrirLigacao(env, DONO, antiga + '; ' + MARCA);
    assert.equal(resposta.status, 302);
    assert.deepEqual(marcasDe(resposta).map((c) => c.split(';')[0] + ' ' + /Max-Age=\d+/.exec(c)[0]), ['gi_equipa_saiu= Max-Age=0'], 'a ligação apaga a marca');
    assert.ok(cookiesDe(resposta).some((c) => c.startsWith('gi_session=')), 'e dá a sessão, como sempre');
    const r = await pedirAoWorker(env, '/equipa', { headers: Object.assign({ Cookie: cookie }, DA_PILULA) });
    assert.equal(r.status, 303, 'sem a marca, entra outra vez');

    // sem marca, a ligação não mexe em cookies que não são dela
    const limpa = await abrirLigacao(env, DONO, cookie);
    assert.deepEqual(marcasDe(limpa.resposta), []);
  });

  test('o /entrar do Discord tira a marca', async () => {
    const env = dev();
    const b = await criarBilhete(env, { discordId: DONO, nome: 'Martinho', papel: 'suporte', papeis: ['suporte'], guildId: SERVIDOR });
    const f = new FormData();
    f.set('t', b.token);
    const r = await pedirAoWorker(env, '/equipa/entrar', { method: 'POST', body: f, headers: { Cookie: MARCA } });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('Location'), '/equipa');
    assert.ok(cookiesDe(r).some((c) => /^gi_equipa=[a-f0-9]{64};/.test(c)), 'entra, como sempre');
    assert.deepEqual(marcasDe(r).map((c) => c.split(';')[0] + ' ' + /Max-Age=\d+/.exec(c)[0]), ['gi_equipa_saiu= Max-Age=0'], 'e apaga a marca');

    // sem marca, o /entrar fica como era: um cookie só
    const b2 = await criarBilhete(env, { discordId: DONO, nome: 'Martinho', papel: 'suporte', papeis: ['suporte'], guildId: SERVIDOR });
    const f2 = new FormData();
    f2.set('t', b2.token);
    assert.equal(cookiesDe(await pedirAoWorker(env, '/equipa/entrar', { method: 'POST', body: f2 })).length, 1);
  });

  test('em produção e no percurso não há marca: o sair, o /entrar e o /t/entrar ficam como eram', async () => {
    for (const nome of [undefined, 'percurso']) {
      const onde = nome || 'produção';
      const env = dev({ ENV_NAME: nome, PORTA_DEV: undefined });
      const s = await pedirAoWorker(env, '/api/equipa/sair', { method: 'POST', headers: { Cookie: MARCA } });
      assert.equal(s.status, 200, onde);
      assert.deepEqual(cookiesDe(s).map((c) => c.split('=')[0]), ['gi_equipa'], onde + ': o sair só apaga o cookie da equipa');

      const b = await criarBilhete(env, { discordId: DONO, nome: 'Martinho', papel: 'suporte', papeis: ['suporte'], guildId: SERVIDOR });
      const f = new FormData();
      f.set('t', b.token);
      const e = await pedirAoWorker(env, '/equipa/entrar', { method: 'POST', body: f, headers: { Cookie: MARCA } });
      assert.equal(e.status, 303, onde);
      assert.deepEqual(cookiesDe(e).map((c) => c.split('=')[0]), ['gi_equipa'], onde + ': o /entrar não mexe na marca');
    }
    // o /t/entrar só existe fora de produção: no percurso abre, e não mexe na marca
    const percurso = dev({ ENV_NAME: 'percurso', PORTA_DEV: undefined });
    const { resposta } = await abrirLigacao(percurso, DONO, MARCA);
    assert.equal(resposta.status, 302);
    assert.deepEqual(marcasDe(resposta), [], 'percurso: a ligação não mexe na marca');
  });
});
