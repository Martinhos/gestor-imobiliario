// O rasto das pessoas no servidor, contra o SQL a sério (testes/lib/bd.js)
// com a migração 0025: os cookies do consentimento (HttpOnly, Secure, Lax,
// 180 dias, a escolha com a hora, e o Domain só em produção e nos três hosts
// dela); o /consentimento antes do reencaminhamento da raiz, com o caminho de
// volta seguro e recusado a outro site; a recolha da montra e da app recusada
// sem sim, com o lote limpo (tamanhos, tipos e campos desconhecidos, sinais,
// as ligações com o host e as chaves da query, nunca os valores), cortado a
// 50 e travado acima do limite; a escolha na API; recusar depois de aceitar
// apaga logo, no aparelho e na conta; a última escolha ganha entre o
// aparelho e a conta; a ligação do visitante à conta ao criar conta, ao
// entrar e na ligação do /test, nas duas formas (o pid passa à conta, ou os
// eventos juntam-se ao dela), num aparelho de outra conta e numa conta que
// disse não, e sem partir a entrada quando falha; o travão do IP antes de um
// aparelho novo criar linhas; a poda dos 90 dias pelo cron diário; o apagar
// da conta; a cópia diária sem o rasto; as contas de teste fora em produção
// e marcadas no dev; e quem vê no back office — master e admin todas as
// pessoas, o suporte só o autor de um pedido que vê, quem programa nada, e a
// auditoria da equipa ainda só do master.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../worker/src/index.js';
import { ambiente, conta, pedir, resp } from './lib/api.js';
import { chamar, corpoDe, MASTER, ADMIN, SUPORTE, DEV, SUPORTE_E_DEV } from './lib/equipa.js';
import { TERMS_VERSION } from '../worker/src/lib/http.js';
import { CRON_DIARIO } from '../worker/src/lib/auditoria.js';
import { purgeAccount } from '../worker/src/lib/acesso.js';
import { rotaTeste, ligacaoTeste } from '../worker/src/teste.js';
import { tabelasDaBase } from '../worker/src/salvaguarda.js';
import {
  cookieDoRasto, dominioDoCookie, lerCookiesDoRasto, caminhoDeVolta, limparLote, novoPid, novoVid,
  podarRasto, PID_RE, MAX_EVENTOS, descritorDeLigacao,
} from '../worker/src/lib/rasto.js';

/* ------------------------------ armações ------------------------------- */

const DIA = 86400000;
const SESSAO = 's-abcde12345';

// Recebe: extra (opcional). Devolve: um env sem ENV_NAME (produção).
const producao = (extra) => { const e = ambiente(extra); delete e.ENV_NAME; return e; };

/* O worker inteiro, como a Cloudflare o chama, à espera do que ficou em fundo.
   Recebe: env; url — o endereço completo; op (opcional) — {method, headers, body}.
   Devolve: a promessa da Response. */
async function peloWorker(env, url, op) {
  const o = op || {};
  const fundo = [];
  const r = await worker.fetch(new Request(url, { method: o.method || 'GET', headers: o.headers || {}, body: o.body }),
    env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
  return r;
}

/* O formulário da faixa da montra, como o browser o envia.
   Recebe: env; host — a origem ('https://rendorium.com'); escolha; volta;
   headers (opcional) — Cookie, Origin, Authorization.
   Devolve: a promessa da Response. */
const consentir = (env, host, escolha, volta, headers) => peloWorker(env, host + '/consentimento', {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, headers || {}),
  body: new URLSearchParams({ escolha, volta: volta == null ? '/' : volta }).toString(),
});

// Recebe: r — a Response. Devolve: a lista dos Set-Cookie dela.
const cookiesDe = (r) => r.headers.getSetCookie();

/* Os cookies de uma resposta como os mandaria o browser de volta.
   Recebe: r — a Response.
   Devolve: o valor do cabeçalho Cookie (só os que ficam vivos). */
const comoCookie = (r) => cookiesDe(r).filter((c) => !/Max-Age=0/.test(c)).map((c) => c.split(';')[0]).join('; ');

/* Um evento da forma do contrato.
   Recebe: extra (opcional) — o que se junta ou troca.
   Devolve: o evento. */
const ev = (extra) => Object.assign({ t: Date.now(), tipo: 'toque', ecra: 'casas', janela: null, alvo: 'click:abrirCasa',
  x: 500, y: 300, vw: 390, vh: 844, sinal: null }, extra || {});

/* O sendBeacon da montra.
   Recebe: env; cookie — o cabeçalho Cookie; lote — {sessao, eventos}; extra (opcional) — cabeçalhos.
   Devolve: a promessa da Response. */
const beacon = (env, cookie, lote, extra) => peloWorker(env, 'https://rendorium.com/rasto', {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'text/plain;charset=UTF-8' }, cookie ? { Cookie: cookie } : {}, extra || {}),
  body: typeof lote === 'string' ? lote : JSON.stringify(lote),
});

// Recebe: env; sql; ...args. Devolve: a promessa das linhas.
const linhas = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results.map((r) => ({ ...r }));
// Recebe: env; sql; ...args. Devolve: a promessa do primeiro número da primeira linha.
const um = async (env, sql, ...args) => Object.values((await env.DB.prepare(sql).bind(...args).first()) || { n: 0 })[0];

/* Um visitante da montra que disse sim, com eventos já guardados.
   Recebe: env; n (opcional) — quantos eventos (2).
   Devolve: {cookie, vid, pid}. */
async function visitanteComEventos(env, n = 2) {
  const r = await consentir(env, 'https://rendorium.com', 'sim', '/');
  const cookie = comoCookie(r);
  const { vid } = lerCookiesDoRasto(new Request('https://x', { headers: { Cookie: cookie } }));
  assert.equal((await beacon(env, cookie, { sessao: SESSAO, eventos: Array.from({ length: n }, () => ev({ tipo: 'pagina', ecra: '/' })) })).status, 204);
  const pid = (await env.DB.prepare('SELECT pid FROM rasto_visitantes WHERE vid = ?').bind(vid).first()).pid;
  return { cookie, vid, pid };
}

/* Eventos escritos direto na base.
   Recebe: env; pid; lista — [{at, sinal, ecra, alvo, origem, sessao}].
   Devolve: a promessa do último run. */
async function eventos(env, pid, lista) {
  for (const e of lista) {
    await env.DB.prepare(
      'INSERT INTO rasto_eventos (pid, sessao, at, origem, tipo, ecra, alvo, sinal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(pid, e.sessao || SESSAO, e.at || Date.now(), e.origem || 'app', e.tipo || 'toque', e.ecra || 'casas',
      e.alvo || 'click:x', e.sinal || null).run();
  }
}

/* Um pid ligado a uma conta, escrito direto na base.
   Recebe: env; uid (ou null para anónimo); pid (opcional).
   Devolve: a promessa do pid. */
async function pidDe(env, uid, pid) {
  const p = pid || novoPid();
  await env.DB.prepare('INSERT INTO rasto_ids (pid, user_id, criado) VALUES (?, ?, ?)').bind(p, uid, Date.now()).run();
  return p;
}

/* Um pedido de uma pessoa (ou um erro) escrito direto na base.
   Recebe: env; id; uid — o autor; categoria ('user').
   Devolve: a promessa do run. */
const ticket = (env, id, uid, categoria = 'user') => env.DB.prepare(
  `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, created_at, updated_at)
   VALUES (?, ?, 'problema', 'Assunto', 'Corpo', 'criado', ?, ?, ?)`
).bind(id, uid, categoria, Date.now(), Date.now()).run();

// Recebe: env; quem — a conta; escolha. Devolve: a promessa do run.
const escolher = (env, quem, escolha) => env.DB.prepare('UPDATE users SET rasto_escolha = ? WHERE id = ?').bind(escolha, quem.id).run();
// Recebe: env; quem — a conta; escolha; hora — ms de época. Devolve: a promessa do run.
const escolherEm = (env, quem, escolha, hora) => env.DB.prepare('UPDATE users SET rasto_escolha = ?, rasto_escolha_at = ? WHERE id = ?')
  .bind(escolha, hora, quem.id).run();

/* -------------------------------- cookies ------------------------------- */

describe('os cookies do consentimento', () => {
  test('HttpOnly, Secure, SameSite=Lax, Path=/ e 180 dias; o Domain só em produção e nos três hosts dela', () => {
    const prod = {}, dev = { ENV_NAME: 'dev' }, percurso = { ENV_NAME: 'percurso' };
    for (const h of ['rendorium.com', 'www.rendorium.com', 'app.rendorium.com']) {
      assert.equal(dominioDoCookie(h, prod), 'rendorium.com', h);
      assert.match(cookieDoRasto('rd_escolha', 'sim.1', h, prod), /; Domain=rendorium\.com$/);
      // o wrangler dev reescreve o host para app.rendorium.com: fora de produção, nunca Domain
      assert.equal(dominioDoCookie(h, percurso), null, h + ' no percurso');
      assert.equal(dominioDoCookie(h, dev), null, h + ' no dev');
    }
    for (const h of ['dev.rendorium.com', '127.0.0.1', 'gestor-imobiliario.x.workers.dev', 'localhost', 'evilrendorium.com']) {
      assert.equal(dominioDoCookie(h, prod), null, h);
      assert.doesNotMatch(cookieDoRasto('rd_vis', 'a'.repeat(32), h, prod), /Domain/i, h + ' fica host-only');
    }
    const c = cookieDoRasto('rd_vis', 'f'.repeat(32), 'app.rendorium.com', prod);
    for (const parte of ['rd_vis=' + 'f'.repeat(32), 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=15552000']) {
      assert.ok(c.split('; ').includes(parte), parte + ' em ' + c);
    }
    assert.match(cookieDoRasto('rd_vis', '', 'rendorium.com', prod), /^rd_vis=; .*Max-Age=0; Domain=rendorium\.com$/, 'apagar leva o mesmo Domain');
  });

  test('só se leem valores com a forma certa; a escolha leva a hora, e a antiga sem hora é hora 0', () => {
    const ler = (c) => lerCookiesDoRasto(new Request('https://x', { headers: { Cookie: c } }));
    assert.deepEqual(ler('a=1; rd_escolha=sim.1761720000000; rd_vis=' + 'ab'.repeat(16)), { escolha: 'sim', hora: 1761720000000, vid: 'ab'.repeat(16) });
    assert.deepEqual(ler('rd_escolha=nao'), { escolha: 'nao', hora: 0, vid: null });
    assert.deepEqual(ler('rd_escolha=talvez; rd_vis=xyz'), { escolha: null, hora: 0, vid: null });
    assert.deepEqual(ler('rd_escolha=simm; rd_vis=' + 'a'.repeat(33)), { escolha: null, hora: 0, vid: null });
    assert.deepEqual(ler('rd_escolha=sim.12x'), { escolha: null, hora: 0, vid: null });
    assert.deepEqual(ler('xrd_escolha=sim'), { escolha: null, hora: 0, vid: null });
  });

  test('o pid e o vid são aleatórios, com a forma do contrato', () => {
    const pids = new Set(Array.from({ length: 300 }, novoPid));
    assert.ok(pids.size > 295, 'não se repetem');
    for (const p of pids) assert.match(p, PID_RE);
    assert.match(novoVid(), /^[a-f0-9]{32}$/);
    assert.notEqual(novoVid(), novoVid());
  });
});

/* ----------------------------- /consentimento ---------------------------- */

describe('POST /consentimento', () => {
  test('na raiz trata-se antes do reencaminhamento para a app: sim cria o vid e o pid e volta com 303', async () => {
    const env = producao();
    const r = await consentir(env, 'https://rendorium.com', 'sim', '/#planos');
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('Location'), '/#planos');
    const ck = cookiesDe(r);
    assert.equal(ck.length, 2);
    assert.ok(ck.every((c) => /HttpOnly/.test(c) && /Secure/.test(c) && /SameSite=Lax/.test(c) && /Domain=rendorium\.com/.test(c)));
    const { vid, escolha } = lerCookiesDoRasto(new Request('https://x', { headers: { Cookie: comoCookie(r) } }));
    assert.equal(escolha, 'sim');
    const v = await env.DB.prepare('SELECT v.pid, i.user_id FROM rasto_visitantes v JOIN rasto_ids i ON i.pid = v.pid WHERE v.vid = ?').bind(vid).first();
    assert.ok(v && PID_RE.test(v.pid), 'o aparelho aponta para um pid');
    assert.equal(v.user_id, null, 'ainda sem conta');
    // de novo, com o mesmo aparelho: o mesmo vid, nenhum pid novo
    const r2 = await consentir(env, 'https://rendorium.com', 'sim', '/', { Cookie: comoCookie(r) });
    assert.match(cookiesDe(r2).join(' '), new RegExp('rd_vis=' + vid));
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids'), 1);
  });

  test('não apaga o rd_vis e põe rd_escolha=nao; a escolha desconhecida e outro site não mudam nada', async () => {
    const env = producao();
    const r = await consentir(env, 'https://rendorium.com', 'nao', '/');
    const ck = cookiesDe(r);
    assert.ok(ck.some((c) => /^rd_escolha=nao\.\d{13};/.test(c)), 'com a hora');
    assert.ok(ck.some((c) => /^rd_vis=;.*Max-Age=0/.test(c)), 'o rd_vis apaga-se');
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids'), 0);
    assert.deepEqual(cookiesDe(await consentir(env, 'https://rendorium.com', 'talvez', '/')), []);
    const fora = await consentir(env, 'https://rendorium.com', 'sim', '/', { Origin: 'https://outro.pt' });
    assert.equal(fora.status, 303);
    assert.deepEqual(cookiesDe(fora), [], 'um formulário de outro site não aceita por ninguém');
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_visitantes'), 0);
    const mesmo = await consentir(env, 'https://rendorium.com', 'sim', '/', { Origin: 'https://rendorium.com' });
    assert.equal(cookiesDe(mesmo).length, 2, 'o da própria montra sim');
  });

  test('o caminho de volta é só um caminho deste site', () => {
    for (const ok of ['/', '/montra', '/#planos', '/privacidade?x=1']) assert.equal(caminhoDeVolta(ok), ok);
    for (const mau of ['//evil.pt', '/\\evil.pt', 'https://evil.pt', 'evil', '', null, '/a b', '/' + 'a'.repeat(400), '/\\/x']) {
      assert.equal(caminhoDeVolta(mau), '/', String(mau));
    }
  });

  test('fora de produção fica host-only; com sessão guarda na conta e o aparelho aponta para o pid dela', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const r = await consentir(env, 'https://app.x.pt', 'sim', '/montra', { Cookie: 'gi_session=' + A.token });
    assert.equal(r.status, 303);
    assert.ok(cookiesDe(r).every((c) => !/Domain/i.test(c)));
    const u = await env.DB.prepare('SELECT rasto_escolha, rasto_escolha_at FROM users WHERE id = ?').bind(A.id).first();
    assert.equal(u.rasto_escolha, 'sim');
    assert.ok(u.rasto_escolha_at > 0);
    const { vid } = lerCookiesDoRasto(new Request('https://x', { headers: { Cookie: comoCookie(r) } }));
    const pid = (await env.DB.prepare('SELECT pid FROM rasto_ids WHERE user_id = ?').bind(A.id).first()).pid;
    assert.equal((await env.DB.prepare('SELECT pid FROM rasto_visitantes WHERE vid = ?').bind(vid).first()).pid, pid);
  });
});

/* ------------------------------ a recolha ------------------------------- */

describe('POST /rasto (a montra)', () => {
  test('sem sim, ou sem rd_vis, 204 e nada guardado', async () => {
    const env = producao();
    for (const c of [null, 'rd_escolha=nao; rd_vis=' + 'a'.repeat(32), 'rd_escolha=sim', 'rd_vis=' + 'a'.repeat(32)]) {
      const r = await beacon(env, c, { sessao: SESSAO, eventos: [ev()] });
      assert.equal(r.status, 204, String(c));
    }
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids'), 0, 'nem pid criado');
  });

  test('com sim guarda com origem montra, o lote limpo', async () => {
    const env = producao();
    const { cookie, pid } = await visitanteComEventos(env, 1);
    await env.DB.prepare('DELETE FROM rasto_eventos').run();
    const r = await beacon(env, cookie, {
      sessao: SESSAO,
      intruso: 'x',
      eventos: [
        ev({ tipo: 'toque', ecra: '/' + 'e'.repeat(60), janela: 'j'.repeat(60), alvo: 'button.' + 'c'.repeat(100), x: 2000, y: -3, sinal: 'raiva', email: 'a@b.pt' }),
        ev({ tipo: 'secao', ecra: '#planos', alvo: 'a:/entrar?entrar=' + 'f'.repeat(50) + '#x', sinal: 'em-vao' }),
        ev({ tipo: 'pagina', ecra: '/montra?utm=1', alvo: null, x: 'muito', vw: 1280.4, t: 1 }),
        ev({ tipo: 'teclou', alvo: 'input#nome' }),
        'nada', null, [1],
      ],
    });
    assert.equal(r.status, 204);
    const rows = await linhas(env, 'SELECT * FROM rasto_eventos ORDER BY id');
    assert.equal(rows.length, 3, 'o tipo desconhecido e o que não é evento saem');
    assert.ok(rows.every((x) => x.pid === pid && x.origem === 'montra' && x.sessao === SESSAO));
    assert.equal(rows[0].ecra.length, 40);
    assert.equal(rows[0].janela.length, 40);
    assert.equal(rows[0].alvo.length, 80);
    assert.equal(rows[0].x, null, 'fora de 0–1000');
    assert.equal(rows[0].y, null);
    assert.equal(rows[0].sinal, null, 'sinal desconhecido');
    assert.equal(rows[1].alvo, 'a:/entrar?entrar', 'uma ligação fica com as chaves da query, nunca os valores');
    assert.equal(rows[1].ecra, '#planos');
    assert.equal(rows[1].sinal, 'em-vao');
    assert.equal(rows[2].ecra, '/montra', 'sem a query');
    assert.equal(rows[2].x, null);
    assert.equal(rows[2].vw, 1280);
    assert.ok(Math.abs(rows[2].at - Date.now()) < 60000, 'uma hora absurda passa a ser a do servidor');
    assert.ok(!Object.keys(rows[0]).includes('email'));
  });

  test('um lote com mais de 50 fica nos 50; uma sessão sem a forma certa ou um corpo que não é JSON não guardam nada', async () => {
    const env = producao();
    const { cookie } = await visitanteComEventos(env, 1);
    await env.DB.prepare('DELETE FROM rasto_eventos').run();
    await beacon(env, cookie, { sessao: SESSAO, eventos: Array.from({ length: 80 }, () => ev()) });
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), MAX_EVENTOS);
    await env.DB.prepare('DELETE FROM rasto_eventos').run();
    for (const mau of [{ sessao: 'S-ABC', eventos: [ev()] }, { sessao: SESSAO, eventos: 'x' }, '{oops', { sessao: SESSAO, eventos: [] }]) {
      assert.equal((await beacon(env, cookie, mau)).status, 204);
    }
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), 0);
    assert.equal(limparLote({ sessao: SESSAO, eventos: Array.from({ length: 51 }, () => ev()) }).eventos.length, 50);
  });

  test('acima do limite (120 em 10 min por pid) responde 204 sem guardar; de outro site também', async () => {
    const env = producao();
    const { cookie, pid } = await visitanteComEventos(env, 1);
    const antes = await um(env, 'SELECT COUNT(*) FROM rasto_eventos');
    await env.DB.prepare('UPDATE rate_limits SET n = 120 WHERE k = ?').bind('rasto:' + pid).run();
    assert.equal((await beacon(env, cookie, { sessao: SESSAO, eventos: [ev()] })).status, 204);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), antes, 'travado');
    await env.DB.prepare('DELETE FROM rate_limits').run();
    assert.equal((await beacon(env, cookie, { sessao: SESSAO, eventos: [ev()] }, { Origin: 'https://outro.pt' })).status, 204);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), antes, 'de fora não entra');
    await beacon(env, cookie, { sessao: SESSAO, eventos: [ev()] });
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), antes + 1, 'depois do travão volta a entrar');
  });

  test('um aparelho novo cria linhas só dentro do travão do IP, na recolha e no consentimento', async () => {
    const env = producao();
    await env.DB.prepare("INSERT INTO rate_limits (k, n, expires_at) VALUES ('rasto:1.2.3.4', 120, ?)").bind(Date.now() + 600000).run();
    const ip = { 'CF-Connecting-IP': '1.2.3.4' };
    await beacon(env, 'rd_escolha=sim; rd_vis=' + novoVid(), { sessao: SESSAO, eventos: [ev()] }, ip);
    const r = await consentir(env, 'https://rendorium.com', 'sim', '/', ip);
    assert.equal(r.status, 303);
    assert.deepEqual(cookiesDe(r), [], 'acima do travão o sim não muda nada');
    assert.ok(cookiesDe(await consentir(env, 'https://rendorium.com', 'nao', '/', ip)).length, 'o não passa sempre');
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids'), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), 0);
  });

  test('um aparelho que disse sim e que a base já não conhece ganha um pid anónimo novo', async () => {
    const env = producao();
    const vid = novoVid();
    await beacon(env, 'rd_escolha=sim; rd_vis=' + vid, { sessao: SESSAO, eventos: [ev()] });
    const v = await env.DB.prepare('SELECT v.pid, i.user_id FROM rasto_visitantes v JOIN rasto_ids i ON i.pid = v.pid WHERE v.vid = ?').bind(vid).first();
    assert.ok(v && v.user_id === null);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', v.pid), 1);
  });
});

describe('a recolha e a escolha na API da app', () => {
  test('POST /api/rasto só guarda com a conta em sim, com o pid dela (criado à primeira) e origem app; 204 sempre', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const lote = { sessao: SESSAO, eventos: [ev({ ecra: 'casas/imoveis', janela: 'casa' }), ev({ tipo: 'guardar' })] };
    assert.equal((await pedir(env, A, '/api/rasto', 'POST', lote)).status, 204, 'sem escolha');
    await escolher(env, A, 'nao');
    assert.equal((await pedir(env, A, '/api/rasto', 'POST', lote)).status, 204, 'com não');
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids'), 0);
    await escolher(env, A, 'sim');
    assert.equal((await pedir(env, A, '/api/rasto', 'POST', JSON.stringify(lote), { 'Content-Type': 'text/plain' })).status, 204);
    const pid = (await env.DB.prepare('SELECT pid FROM rasto_ids WHERE user_id = ?').bind(A.id).first()).pid;
    const rows = await linhas(env, 'SELECT pid, origem, ecra, janela, tipo FROM rasto_eventos ORDER BY id');
    assert.deepEqual(rows, [
      { pid, origem: 'app', ecra: 'casas/imoveis', janela: 'casa', tipo: 'toque' },
      { pid, origem: 'app', ecra: 'casas', janela: null, tipo: 'guardar' },
    ]);
    assert.equal((await pedir(env, null, '/api/rasto', 'POST', lote)).status, 401, 'sem sessão é a API de sempre');
  });

  test('GET /api/rasto/escolha: a da conta; sem ela, adota a do aparelho e liga-o', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    assert.deepEqual(await resp(pedir(env, A, '/api/rasto/escolha')), { status: 200, escolha: null });
    const { cookie, pid } = await visitanteComEventos(env, 2);
    assert.deepEqual(await resp(pedir(env, A, '/api/rasto/escolha', 'GET', undefined, { Cookie: cookie })), { status: 200, escolha: 'sim' });
    assert.equal(await um(env, 'SELECT rasto_escolha FROM users WHERE id = ?', A.id), 'sim');
    assert.equal(await um(env, 'SELECT user_id FROM rasto_ids WHERE pid = ?', pid), A.id, 'o visitante passou a ser a conta');
    // uma conta que já escolheu fica com a dela
    const B = await conta(env, 'Berta');
    await escolher(env, B, 'nao');
    assert.equal((await resp(pedir(env, B, '/api/rasto/escolha', 'GET', undefined, { Cookie: 'rd_escolha=sim' }))).escolha, 'nao');
  });

  test('POST /api/rasto/escolha guarda na conta e põe ou tira os cookies; uma escolha desconhecida é 400', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const sim = await pedir(env, A, '/api/rasto/escolha', 'POST', { escolha: 'sim' });
    assert.equal(sim.status, 200);
    assert.deepEqual(await sim.json(), { escolha: 'sim' });
    const ck = cookiesDe(sim);
    assert.ok(ck.some((c) => /^rd_escolha=sim\.\d{13};/.test(c)) && ck.some((c) => /^rd_vis=[a-f0-9]{32};/.test(c)));
    assert.equal(await um(env, 'SELECT rasto_escolha FROM users WHERE id = ?', A.id), 'sim');
    const { vid } = lerCookiesDoRasto(new Request('https://x', { headers: { Cookie: comoCookie(sim) } }));
    const pid = await um(env, 'SELECT pid FROM rasto_ids WHERE user_id = ?', A.id);
    assert.equal(await um(env, 'SELECT pid FROM rasto_visitantes WHERE vid = ?', vid), pid);
    const nao = await pedir(env, A, '/api/rasto/escolha', 'POST', { escolha: 'nao' }, { Cookie: comoCookie(sim) });
    assert.ok(cookiesDe(nao).some((c) => /^rd_vis=;.*Max-Age=0/.test(c)));
    assert.equal(await um(env, 'SELECT rasto_escolha FROM users WHERE id = ?', A.id), 'nao');
    assert.equal((await pedir(env, A, '/api/rasto/escolha', 'POST', { escolha: 'talvez' })).status, 400);
  });
});

describe('recusar depois de aceitar apaga logo', () => {
  test('o não da faixa apaga os eventos e o pid deste aparelho', async () => {
    const env = producao();
    const { cookie, vid, pid } = await visitanteComEventos(env, 3);
    const outro = await visitanteComEventos(env, 1);
    const r = await consentir(env, 'https://rendorium.com', 'nao', '/', { Cookie: cookie });
    assert.ok(cookiesDe(r).some((c) => /^rd_vis=;.*Max-Age=0/.test(c)));
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', pid), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids WHERE pid = ?', pid), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_visitantes WHERE vid = ?', vid), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', outro.pid), 1, 'os dos outros ficam');
  });

  test('com sessão, o não apaga também os da conta, e a ligação cai com eles', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await escolher(env, A, 'sim');
    const daConta = await pidDe(env, A.id);
    await eventos(env, daConta, [{}, {}]);
    const ap = await visitanteComEventos(env, 2);
    const r = await pedir(env, A, '/api/rasto/escolha', 'POST', { escolha: 'nao' }, { Cookie: ap.cookie });
    assert.equal(r.status, 200);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids'), 0, 'o pid da conta e o do aparelho saem');
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_visitantes'), 0);
    const u = await env.DB.prepare('SELECT rasto_escolha, rasto_escolha_at FROM users WHERE id = ?').bind(A.id).first();
    assert.equal(u.rasto_escolha, 'nao');
    const hora = Number(/rd_escolha=nao\.(\d+)/.exec(cookiesDe(r).join(' '))[1]);
    assert.equal(u.rasto_escolha_at, hora, 'a conta e o cookie com a mesma hora');
    // aceitar de novo começa do zero, com um pid novo
    await pedir(env, A, '/api/rasto/escolha', 'POST', { escolha: 'sim' });
    const novo = await um(env, 'SELECT pid FROM rasto_ids WHERE user_id = ?', A.id);
    assert.ok(novo && novo !== daConta);
  });

  test('o /consentimento com sessão também apaga os da conta', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await escolher(env, A, 'sim');
    await eventos(env, await pidDe(env, A.id), [{}]);
    await consentir(env, 'https://app.x.pt', 'nao', '/montra', { Cookie: 'gi_session=' + A.token });
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), 0);
    assert.equal(await um(env, 'SELECT rasto_escolha FROM users WHERE id = ?', A.id), 'nao');
  });
});

describe('a última escolha ganha, quando a app abre', () => {
  const T = Date.now();
  // Recebe: env; quem; cookie. Devolve: a promessa da Response do GET /api/rasto/escolha.
  const abrir = (env, quem, cookie) => pedir(env, quem, '/api/rasto/escolha', 'GET', undefined, cookie ? { Cookie: cookie } : {});

  test('o não do aparelho, mais recente, passa para a conta e apaga o rasto dela', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await escolherEm(env, A, 'sim', T - 5000);
    await eventos(env, await pidDe(env, A.id), [{}, {}]);
    const r = await abrir(env, A, 'rd_escolha=nao.' + (T - 1000));
    assert.deepEqual(await r.json(), { escolha: 'nao' });
    const u = await env.DB.prepare('SELECT rasto_escolha, rasto_escolha_at FROM users WHERE id = ?').bind(A.id).first();
    assert.deepEqual({ ...u }, { rasto_escolha: 'nao', rasto_escolha_at: T - 1000 });
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids'), 0);
  });

  test('o não da conta, mais recente, passa para o aparelho (cookies) e apaga o rasto dele', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const ap = await visitanteComEventos(env, 2);
    const hora = Date.now() + 1000;
    await escolherEm(env, A, 'nao', hora);
    const r = await abrir(env, A, ap.cookie);
    assert.deepEqual(await r.json(), { escolha: 'nao' });
    const ck = cookiesDe(r);
    assert.ok(ck.some((c) => c.startsWith('rd_escolha=nao.' + hora + ';')), ck.join(' | '));
    assert.ok(ck.some((c) => /^rd_vis=;.*Max-Age=0/.test(c)));
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', ap.pid), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_visitantes WHERE vid = ?', ap.vid), 0);
  });

  test('o sim da conta, mais recente, passa para o aparelho com um rd_vis ligado a ela', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await escolherEm(env, A, 'sim', T);
    const r = await abrir(env, A, 'rd_escolha=nao.' + (T - 60000));
    assert.deepEqual(await r.json(), { escolha: 'sim' });
    assert.ok(cookiesDe(r).some((c) => c.startsWith('rd_escolha=sim.' + T + ';')));
    const { vid } = lerCookiesDoRasto(new Request('https://x', { headers: { Cookie: comoCookie(r) } }));
    assert.ok(vid, 'um aparelho novo');
    assert.equal(await um(env, 'SELECT pid FROM rasto_visitantes WHERE vid = ?', vid), await um(env, 'SELECT pid FROM rasto_ids WHERE user_id = ?', A.id));
    // sem cookie nenhum, também
    const r2 = await abrir(env, A, null);
    assert.ok(cookiesDe(r2).some((c) => c.startsWith('rd_escolha=sim.' + T + ';')));
  });

  test('o sim do aparelho, mais recente, passa para a conta e liga-o; o cookie antigo, sem hora, perde', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await escolherEm(env, A, 'nao', T - 100000);
    const ap = await visitanteComEventos(env, 1);
    assert.deepEqual(await (await abrir(env, A, ap.cookie)).json(), { escolha: 'sim' });
    assert.equal(await um(env, 'SELECT rasto_escolha FROM users WHERE id = ?', A.id), 'sim');
    assert.equal(await um(env, 'SELECT user_id FROM rasto_ids WHERE pid = ?', ap.pid), A.id);
    const B = await conta(env, 'Berta');
    await escolherEm(env, B, 'nao', 5);
    const r = await abrir(env, B, 'rd_escolha=sim; rd_vis=' + novoVid());
    assert.deepEqual(await r.json(), { escolha: 'nao' }, 'sem hora é hora 0');
  });
});

describe('as ligações e a cópia de segurança', () => {
  test('o descritor de uma ligação guarda o host e as chaves da query, nunca os valores', () => {
    const casos = {
      '/privacidade': '/privacidade',
      'app.rendorium.com/?criar': 'app.rendorium.com/?criar',
      ['/?entrar=' + 'a'.repeat(30) + '&exemplo=1']: '/?entrar&exemplo',
      'https://ana:segredo@App.Rendorium.com:8443/x?t=1#y': 'app.rendorium.com/x?t',
      '//evil.pt/a?b=c': 'evil.pt/a?b',
      'mailto:ana@x.pt?subject=ola': 'mailto:',
      'tel:+351912345678': 'tel:',
      '#planos': '#planos',
      '/a#segredo=1': '/a',
      '/x?=v&k': '/x?k',
    };
    for (const [entra, sai] of Object.entries(casos)) assert.equal(descritorDeLigacao(entra), sai, entra);
    const lote = limparLote({ sessao: SESSAO, eventos: [ev({ alvo: 'a:app.rendorium.com/?repor=' + 'f'.repeat(40) })] });
    assert.equal(lote.eventos[0].alvo, 'a:app.rendorium.com/?repor');
  });

  test('a cópia diária não leva as tabelas rasto_*', async () => {
    const env = ambiente();
    const tabelas = await tabelasDaBase(env);
    assert.ok(tabelas.includes('users'));
    assert.deepEqual(tabelas.filter((t) => t.startsWith('rasto_')), []);
  });
});

/* ------------------------- a ligação à conta ---------------------------- */

describe('o visitante da montra liga-se à conta ao entrar', () => {
  test('ao criar conta: o pid do visitante passa a ser dela, com os eventos de antes', async () => {
    const env = ambiente();
    const { cookie, pid } = await visitanteComEventos(env, 3);
    const r = await resp(pedir(env, null, '/api/auth/register', 'POST',
      { email: 'nova@x.pt', password: 'Forte#123', terms: TERMS_VERSION }, { Cookie: cookie }));
    assert.equal(r.status, 201);
    assert.equal(await um(env, 'SELECT user_id FROM rasto_ids WHERE pid = ?', pid), r.id);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', pid), 3);
  });

  test('ao entrar numa conta que já tinha pid: os eventos juntam-se ao dela e o aparelho aponta para ele', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana', { pass: 'Forte#123' });
    const daConta = await pidDe(env, A.id);
    await eventos(env, daConta, [{ origem: 'app' }]);
    const { cookie, vid, pid } = await visitanteComEventos(env, 2);
    assert.notEqual(pid, daConta);
    const r = await resp(pedir(env, null, '/api/auth/login', 'POST', { email: A.email, password: 'Forte#123' }, { Cookie: cookie }));
    assert.equal(r.status, 200);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', daConta), 3);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', pid), 0);
    assert.equal(await um(env, 'SELECT pid FROM rasto_visitantes WHERE vid = ?', vid), daConta);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids WHERE pid = ?', pid), 0, 'o pid anónimo sai');
  });

  test('sem sim no aparelho não liga; numa conta que disse não, também não', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana', { pass: 'Forte#123' });
    const { cookie, pid } = await visitanteComEventos(env, 1);
    await pedir(env, null, '/api/auth/login', 'POST', { email: A.email, password: 'Forte#123' },
      { Cookie: cookie.replace('rd_escolha=sim', 'rd_escolha=nao') });
    assert.equal(await um(env, 'SELECT user_id FROM rasto_ids WHERE pid = ?', pid), null);
    await escolher(env, A, 'nao');
    await pedir(env, null, '/api/auth/login', 'POST', { email: A.email, password: 'Forte#123' }, { Cookie: cookie });
    assert.equal(await um(env, 'SELECT user_id FROM rasto_ids WHERE pid = ?', pid), null);
  });

  test('um aparelho que já é de outra conta passa a apontar para esta, e os eventos ficam com a outra', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana', { pass: 'Forte#123' });
    const B = await conta(env, 'Berta', { pass: 'Forte#456' });
    const { cookie, vid, pid } = await visitanteComEventos(env, 2);
    await pedir(env, null, '/api/auth/login', 'POST', { email: A.email, password: 'Forte#123' }, { Cookie: cookie });
    assert.equal(await um(env, 'SELECT user_id FROM rasto_ids WHERE pid = ?', pid), A.id);
    await pedir(env, null, '/api/auth/login', 'POST', { email: B.email, password: 'Forte#456' }, { Cookie: cookie });
    const daB = await um(env, 'SELECT pid FROM rasto_ids WHERE user_id = ?', B.id);
    assert.ok(daB && daB !== pid);
    assert.equal(await um(env, 'SELECT pid FROM rasto_visitantes WHERE vid = ?', vid), daB);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', pid), 2, 'os da Ana ficam com a Ana');
  });

  test('na ligação do /test também', async () => {
    const env = ambiente({ TESTE_CHAVE: 'chave' });
    const { cookie, pid } = await visitanteComEventos(env, 1);
    const lig = await ligacaoTeste(env, 'https://dev.x.pt', false, false, 'dev1');
    const r = await rotaTeste({ env, url: new URL(lig), request: new Request(lig, { headers: { Cookie: cookie } }) });
    assert.equal(r.status, 302);
    const uid = await um(env, 'SELECT user_id FROM rasto_ids WHERE pid = ?', pid);
    assert.ok(uid && (await um(env, 'SELECT test_owner FROM users WHERE id = ?', uid)) === 'dev1', 'a conta de teste ficou com o pid');
  });

  test('uma falha do rasto não parte a entrada', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana', { pass: 'Forte#123' });
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => { if (/rasto_/.test(sql)) throw new Error('D1 em baixo'); return prepare(sql); };
    const r = await resp(pedir(env, null, '/api/auth/login', 'POST', { email: A.email, password: 'Forte#123' },
      { Cookie: 'rd_escolha=sim; rd_vis=' + novoVid() }));
    env.DB.prepare = prepare;
    assert.equal(r.status, 200);
  });
});

/* ---------------------- a poda e o apagar da conta ---------------------- */

describe('90 dias, e sai com a conta', () => {
  test('o cron diário poda os eventos com mais de 90 dias e os pids anónimos vazios, e deixa uma linha no op_log', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const daConta = await pidDe(env, A.id);
    const anonVelho = await pidDe(env, null);
    const anonNovo = await pidDe(env, null);
    await env.DB.prepare('UPDATE rasto_ids SET criado = ? WHERE pid IN (?, ?)').bind(Date.now() - 100 * DIA, anonVelho, daConta).run();
    await env.DB.prepare("INSERT INTO rasto_visitantes (vid, pid, criado) VALUES ('v1', ?, 1)").bind(anonVelho).run();
    await eventos(env, daConta, [{ at: Date.now() - 91 * DIA }, { at: Date.now() - 89 * DIA }]);
    await eventos(env, anonVelho, [{ at: Date.now() - 95 * DIA }]);
    await eventos(env, anonNovo, [{ at: Date.now() - 120 * DIA }]);
    const fundo = [];
    await worker.scheduled({ cron: CRON_DIARIO }, env, { waitUntil(p) { fundo.push(p); } });
    await Promise.all(fundo);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos'), 1, 'só o de 89 dias fica');
    const pids = (await linhas(env, 'SELECT pid FROM rasto_ids ORDER BY pid')).map((r) => r.pid).sort();
    assert.deepEqual(pids, [daConta, anonNovo].sort(), 'o anónimo velho e vazio sai; o da conta e o recente ficam');
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_visitantes'), 0, 'e o aparelho dele');
    const op = await env.DB.prepare("SELECT ok, detalhe FROM op_log WHERE op = 'rasto'").first();
    assert.equal(op.ok, 1);
    assert.match(op.detalhe, /^3 eventos/);
  });

  test('a poda nunca lança', async () => {
    const env = ambiente();
    env.DB.batch = async () => { throw new Error('D1 em baixo'); };
    const r = await podarRasto(env);
    assert.equal(r.ok, false);
  });

  test('apagar a conta apaga o pid dela, os aparelhos e os eventos; os dos outros ficam', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const B = await conta(env, 'Berta');
    const pa = await pidDe(env, A.id), pb = await pidDe(env, B.id);
    await env.DB.prepare("INSERT INTO rasto_visitantes (vid, pid, criado) VALUES ('va', ?, 1), ('vb', ?, 1)").bind(pa, pb).run();
    await eventos(env, pa, [{}, {}]);
    await eventos(env, pb, [{}]);
    await escolher(env, A, 'sim');
    await purgeAccount(env, A.id);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_ids WHERE pid = ?', pa), 0);
    assert.equal(await um(env, "SELECT COUNT(*) FROM rasto_visitantes WHERE vid = 'va'"), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', pa), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM rasto_eventos WHERE pid = ?', pb), 1);
    assert.equal(await um(env, "SELECT COUNT(*) FROM rasto_visitantes WHERE vid = 'vb'"), 1);
    assert.equal(await um(env, 'SELECT rasto_escolha FROM users WHERE id = ?', A.id), null);
  });
});

/* ---------------------------- o back office ----------------------------- */

/* Um cenário do back office: três pessoas com conta (uma de teste por dono,
   outra com email da casa) e um visitante só da montra, com eventos e sinais.
   Recebe: env.
   Devolve: {A, pa, pteste, pcasa, panon}. */
async function cenario(env) {
  const A = await conta(env, 'Ana');
  const T = await conta(env, 'Teste');
  await env.DB.prepare("UPDATE users SET test_owner = 'dev1' WHERE id = ?").bind(T.id).run();
  const C = await conta(env, 'Casa');
  await env.DB.prepare("UPDATE users SET email = 'qa@teste.rendorium.com' WHERE id = ?").bind(C.id).run();
  const pa = await pidDe(env, A.id), pteste = await pidDe(env, T.id), pcasa = await pidDe(env, C.id), panon = await pidDe(env, null);
  const t = Date.now();
  await eventos(env, pa, [
    { at: t - 5000, sessao: 's-aaaaaaaaa1', sinal: 'em-vao', ecra: 'casas', alvo: 'div.cartao' },
    { at: t - 4000, sessao: 's-aaaaaaaaa1', sinal: 'em-vao', ecra: 'casas', alvo: 'div.cartao' },
    { at: t - 3000, sessao: 's-aaaaaaaaa2', sinal: 'repetido', ecra: 'contratos', alvo: 'click:guardar' },
    { at: t - 40 * DIA, sessao: 's-aaaaaaaaa0', origem: 'montra', ecra: '/' },
  ]);
  await eventos(env, panon, [{ at: t - 1000, origem: 'montra', sessao: 's-bbbbbbbbb1', sinal: 'em-vao', ecra: 'casas', alvo: 'div.cartao' }]);
  await eventos(env, pteste, [{ at: t - 100, sinal: 'desistencia', ecra: 'testes', alvo: 'click:x' }]);
  await eventos(env, pcasa, [{ at: t - 200, ecra: 'casa' }]);
  return { A, pa, pteste, pcasa, panon };
}

describe('o back office: as listas e a linha do tempo', () => {
  test('/pessoas: por pid, da mais recente, com sessões, eventos, origens e sinais, sem nome nem email; os 7/30/90 dias', async () => {
    const env = ambiente();
    const { pa, pteste, pcasa, panon } = await cenario(env);
    const r = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/rasto/pessoas'));
    assert.equal(r.status, 200);
    assert.deepEqual(r.pessoas.map((p) => p.pid), [pteste, pcasa, panon, pa], 'pela última vez');
    const a = r.pessoas.find((p) => p.pid === pa);
    assert.deepEqual(a, { pid: pa, conta: true, teste: false, ultimo: a.ultimo, sessoes: 2, eventos: 3, origens: ['app'],
      sinais: { 'em-vao': 2, repetido: 1, 'vai-e-volta': 0, desistencia: 0, 'erro-campo': 0 } }, 'a de 40 dias fica fora dos 30');
    assert.deepEqual(r.pessoas.find((p) => p.pid === panon).origens, ['montra']);
    assert.equal(r.pessoas.find((p) => p.pid === panon).conta, false);
    assert.equal(r.pessoas.find((p) => p.pid === pteste).teste, true, 'no dev entram marcadas');
    assert.equal(r.pessoas.find((p) => p.pid === pcasa).teste, true);
    assert.ok(!/@|Ana/.test(JSON.stringify(r)), 'nem email nem nome');
    const r90 = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/rasto/pessoas', null, '?dias=90'));
    assert.equal(r90.pessoas.find((p) => p.pid === pa).eventos, 4);
    assert.deepEqual(r90.pessoas.find((p) => p.pid === pa).origens, ['app', 'montra']);
  });

  test('/pessoa/<pid>: as sessões da mais recente para a mais antiga, os eventos pela ordem; 404 e 400', async () => {
    const env = ambiente();
    const { A, pa } = await cenario(env);
    const r = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/rasto/pessoa/' + pa));
    assert.equal(r.pid, pa);
    assert.equal(r.userId, A.id);
    assert.equal(r.teste, false);
    assert.deepEqual(r.sessoes.map((s) => s.sessao), ['s-aaaaaaaaa2', 's-aaaaaaaaa1', 's-aaaaaaaaa0']);
    const s1 = r.sessoes[1];
    assert.ok(s1.inicio < s1.fim);
    assert.deepEqual(s1.origens, ['app']);
    assert.equal(s1.eventos.length, 2);
    assert.ok(s1.eventos[0].at < s1.eventos[1].at);
    assert.deepEqual(Object.keys(s1.eventos[0]).sort(), ['alvo', 'at', 'ecra', 'janela', 'origem', 'sinal', 'tipo', 'vh', 'vw', 'x', 'y']);
    assert.equal((await chamar(env, MASTER, 'GET', '/api/equipa/rasto/pessoa/' + novoPid())).status, 404);
    assert.equal((await chamar(env, MASTER, 'GET', '/api/equipa/rasto/pessoa/' + encodeURIComponent("P-1'; --"))).status, 400);
    assert.equal((await chamar(env, MASTER, 'GET', '/api/equipa/rasto/pessoa/%E0%A4%A')).status, 400, 'um % mal formado não é um 500');
    assert.equal((await chamar(env, MASTER, 'GET', '/api/equipa/rasto/ticket/%E0%A4%A')).status, 400);
    const audit = await env.DB.prepare("SELECT * FROM audit_log WHERE acao = 'rasto.ver'").first();
    assert.equal(audit.alvo, pa, 'quem viu quem fica registado');
  });

  test('/resumo: por ecrã e alvo, só com sinais, do maior para o menor', async () => {
    const env = ambiente();
    await cenario(env);
    const r = await corpoDe(await chamar(env, ADMIN, 'GET', '/api/equipa/rasto/resumo', null, '?dias=7'));
    assert.deepEqual(r.linhas[0], { ecra: 'casas', alvo: 'div.cartao',
      sinais: { 'em-vao': 3, repetido: 0, 'vai-e-volta': 0, desistencia: 0, 'erro-campo': 0 }, total: 3, pessoas: 2 });
    assert.ok(r.linhas.every((l) => l.total > 0));
    assert.ok(!r.linhas.some((l) => l.ecra === 'casa'), 'sem sinais não entra');
  });

  test('em produção as contas de teste ficam de fora; os pids sem conta entram', async () => {
    const env = producao();
    const { pa, pteste, pcasa, panon } = await cenario(env);
    const r = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/rasto/pessoas'));
    assert.deepEqual(r.pessoas.map((p) => p.pid), [panon, pa]);
    assert.ok(r.pessoas.every((p) => p.teste === false));
    const res = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/rasto/resumo'));
    assert.ok(!res.linhas.some((l) => l.ecra === 'testes'));
    for (const p of [pteste, pcasa]) assert.equal((await chamar(env, MASTER, 'GET', '/api/equipa/rasto/pessoa/' + p)).status, 404, p);
    const T = await um(env, 'SELECT user_id FROM rasto_ids WHERE pid = ?', pteste);
    assert.deepEqual(await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/rasto/conta/' + T)), { status: 200, pid: null });
  });
});

describe('o back office: quem vê', () => {
  test('a lista, o resumo e a ida da ficha ao pid: master e admin; os outros 403', async () => {
    const env = ambiente();
    const { A, pa } = await cenario(env);
    for (const eu of [MASTER, ADMIN]) {
      for (const p of ['/api/equipa/rasto/pessoas', '/api/equipa/rasto/resumo']) {
        assert.equal((await chamar(env, eu, 'GET', p)).status, 200, eu.papel + ' ' + p);
      }
      assert.deepEqual(await corpoDe(await chamar(env, eu, 'GET', '/api/equipa/rasto/conta/' + A.id)), { status: 200, pid: pa });
      assert.equal((await chamar(env, eu, 'GET', '/api/equipa/rasto/pessoa/' + pa)).status, 200);
    }
    const B = await conta(env, 'Berta');
    assert.deepEqual(await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/rasto/conta/' + B.id)), { status: 200, pid: null });
    for (const eu of [SUPORTE, DEV, SUPORTE_E_DEV]) {
      for (const p of ['/api/equipa/rasto/pessoas', '/api/equipa/rasto/resumo', '/api/equipa/rasto/conta/' + A.id]) {
        assert.equal((await chamar(env, eu, 'GET', p)).status, 403, eu.papel + ' ' + p);
      }
    }
  });

  test('o suporte vê só o pid de quem lhe escreveu um pedido, e chega lá pelo pedido; quem programa não vê', async () => {
    const env = ambiente();
    const { A, pa, panon } = await cenario(env);
    const B = await conta(env, 'Berta');
    const pb = await pidDe(env, B.id);
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/rasto/pessoa/' + pa)).status, 403, 'sem pedido');
    await ticket(env, 'T1', A.id, 'user');
    await ticket(env, 'T2', B.id, 'client');
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/rasto/pessoa/' + pa)).status, 200, 'com um pedido dela');
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/rasto/pessoa/' + pb)).status, 403, 'um erro apanhado não é um pedido do suporte');
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/rasto/pessoa/' + panon)).status, 403, 'nem um visitante');
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/rasto/pessoa/' + novoPid())).status, 403, 'nem diz se existe');
    assert.deepEqual(await corpoDe(await chamar(env, SUPORTE, 'GET', '/api/equipa/rasto/ticket/T1')), { status: 200, pid: pa });
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/rasto/ticket/T2')).status, 403, 'a regra do detalhe do pedido');
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/rasto/ticket/T9')).status, 404);
    // quem programa vê o erro, mas não o rasto
    assert.deepEqual(await corpoDe(await chamar(env, DEV, 'GET', '/api/equipa/rasto/ticket/T2')), { status: 200, pid: null });
    assert.equal((await chamar(env, DEV, 'GET', '/api/equipa/rasto/pessoa/' + pb)).status, 403);
    assert.equal((await chamar(env, DEV, 'GET', '/api/equipa/rasto/ticket/T1')).status, 403);
    // o master vê os dois pedidos, e o pid de quem não tem rasto é null
    assert.deepEqual(await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/rasto/ticket/T2')), { status: 200, pid: pb });
    const C = await conta(env, 'Carla');
    await ticket(env, 'T3', C.id, 'user');
    assert.deepEqual(await corpoDe(await chamar(env, SUPORTE, 'GET', '/api/equipa/rasto/ticket/T3')), { status: 200, pid: null });
  });

  test('a auditoria da equipa continua só do master', async () => {
    const env = ambiente();
    assert.equal((await chamar(env, MASTER, 'GET', '/api/equipa/auditoria')).status, 200);
    for (const eu of [ADMIN, SUPORTE, DEV]) assert.equal((await chamar(env, eu, 'GET', '/api/equipa/auditoria')).status, 403, eu.papel);
  });
});
