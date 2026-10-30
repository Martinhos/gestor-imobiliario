// Os tickets de segurança: um limite da API atingido (o 429 do rateLimit)
// abre, ou engorda, um ticket na fila do back office, e nenhum se trata sem
// alguém da equipa escrever a resolução proposta (Decidir) — ou arquivá-lo,
// com a justificação. Contra o SQL a sério (testes/lib/bd.js): conta-se o
// que o rateLimit escreve, porque uma força bruta não pode virar uma escrita
// na D1 por pedido, e os pedidos das pessoas têm de continuar exatamente como
// estavam.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, novaConta, auditoria } from './lib/api.js';
import { chamar, corpoDe, MASTER, SUPORTE, DEV, ADMIN } from './lib/equipa.js';
import { rateLimit, relatoDoLimite, LIMITES, detalheDoLimite, ESPERA_DO_AVISO_MS } from '../worker/src/lib/limites.js';
import { avisoDeHoje, limiteEmbed } from '../worker/src/notify.js';

/* ------------------------------ armações ------------------------------- */

// Recebe: env.
// Devolve: os tickets de segurança, do mais antigo para o mais recente.
async function deSeguranca(env) {
  return (await env.DB.prepare("SELECT * FROM tickets WHERE category = 'seguranca' ORDER BY created_at, id").all()).results;
}

// Recebe: env; k — a chave do contador.
// Devolve: o n do contador (ou null sem linha).
async function contador(env, k) {
  const r = await env.DB.prepare('SELECT n FROM rate_limits WHERE k = ?').bind(k).first();
  return r ? r.n : null;
}

// Põe a base a contar as instruções que podem escrever (cada run(), também
// as de um batch); as leituras (first, all) não contam.
// Recebe: env — troca-se-lhe o DB por um que conta.
// Devolve: { escritas } — o contador, vivo.
function aContar(env) {
  const real = env.DB;
  const c = { escritas: 0 };
  env.DB = {
    _db: real._db,
    batch: (stmts) => real.batch(stmts),
    prepare(sql) {
      const q = real.prepare(sql);
      const run = q.run;
      q.run = async () => { c.escritas++; return run(); };
      return q;
    },
  };
  return c;
}

// Esgota a chave até à primeira recusa (inclusive).
// Recebe: env; k — a chave; limite; janela (s).
// Devolve: os valores que o rateLimit devolveu, por ordem.
async function ateRecusar(env, k, limite, janela = 900) {
  const out = [];
  for (let i = 0; i <= limite; i++) out.push(await rateLimit(env, k, limite, janela));
  return out;
}

// A janela acabou: a seguinte começa do zero.
// Recebe: env; k — a chave.
// Devolve: promessa de nada.
async function acabarJanela(env, k) {
  await env.DB.prepare('UPDATE rate_limits SET expires_at = 1 WHERE k = ?').bind(k).run();
}

const fetchReal = globalThis.fetch;
let emails = [];
// O Resend de faz-de-conta: cada email que sairia fica em emails.
// Devolve: nada.
function armarCorreio() {
  emails = [];
  globalThis.fetch = async (url, opts) => {
    emails.push({ url: String(url), corpo: JSON.parse(opts.body) });
    return new Response('{"id":"x"}', { status: 200 });
  };
}
afterEach(() => { globalThis.fetch = fetchReal; });

const url = (id, acao) => '/api/equipa/pedidos/' + id + (acao ? '/' + acao : '');

/* ------------------------- o relato do limite --------------------------- */

describe('um limite atingido abre um ticket de segurança', () => {
  test('a primeira recusa abre-o, com a conta como dona, a mensagem estável e o detalhe', async () => {
    const env = ambiente();
    const uid = await novaConta(env);
    assert.deepEqual(await ateRecusar(env, 'w:' + uid, 3), [true, true, true, false]);
    const ts = await deSeguranca(env);
    assert.equal(ts.length, 1);
    const t = ts[0];
    assert.equal(t.subject, 'Limite atingido: gravações de dados · conta ' + uid);
    assert.equal(t.fingerprint, 'seguranca:Limite atingido: gravações de dados · conta ' + uid);
    assert.deepEqual([t.user_id, t.status, t.n, t.accepted_at, t.refused_at], [uid, 'criado', 1, null, null]);
    assert.match(t.body, /^Chave: w:U\d+\nLimite: 3 em 15 min, a contar do primeiro pedido\nJanela: até \d\d\/\d\d\/\d{4}, \d\d:\d\d:\d\d \(hora de Lisboa\)\nHora: \d\d\/\d\d\/\d{4}, \d\d:\d\d:\d\d \(hora de Lisboa\), a primeira recusa\n/);
    assert.equal(await contador(env, 'w:' + uid), 4, 'a primeira recusa leva o contador a limit + 1');
    const pessoas = await env.DB.prepare('SELECT COUNT(*) AS n FROM ticket_users WHERE fingerprint = ?').bind(t.fingerprint).first();
    assert.equal(pessoas.n, 1);
  });

  test('por IP: sem conta, o dono é a conta do sistema', async () => {
    const env = ambiente();
    assert.equal((await ateRecusar(env, 'auth:203.0.113.77', 5)).at(-1), false);
    const [t] = await deSeguranca(env);
    assert.equal(t.subject, 'Limite atingido: registos, Google e recuperações de conta · IP 203.0.113.77');
    assert.equal(t.user_id, 'SISTEMA');
    assert.match(t.body, /^Chave: auth:203\.0\.113\.77\nLimite: 5 em 15 min/);
  });

  test('a segunda recusa na mesma janela não escreve nada: nem o contador, nem o ticket', async () => {
    const env = ambiente();
    const uid = await novaConta(env);
    await ateRecusar(env, 'tk:' + uid, 2, 3600);
    const c = aContar(env);
    for (let i = 0; i < 25; i++) assert.equal(await rateLimit(env, 'tk:' + uid, 2, 3600), false);
    assert.equal(c.escritas, 0, 'uma força bruta não vira uma escrita por pedido');
    assert.equal(await contador(env, 'tk:' + uid), 3);
    const ts = await deSeguranca(env);
    assert.deepEqual([ts.length, ts[0].n], [1, 1]);
  });

  test('a janela seguinte soma n no mesmo ticket', async () => {
    const env = ambiente();
    for (let janela = 1; janela <= 3; janela++) {
      assert.equal((await ateRecusar(env, 'login:198.51.100.4', 10)).at(-1), false);
      await acabarJanela(env, 'login:198.51.100.4');
    }
    const ts = await deSeguranca(env);
    assert.equal(ts.length, 1, 'o mesmo limite e o mesmo IP juntam-se');
    assert.equal(ts[0].n, 3);
    // outro IP, outro ticket
    await ateRecusar(env, 'login:198.51.100.5', 10);
    assert.equal((await deSeguranca(env)).length, 2);
  });

  test('aviso:, rp: e rpa: recusam como sempre: sem ticket e sem escrever', async () => {
    const env = ambiente();
    const uid = await novaConta(env);
    assert.equal(await rateLimit(env, 'aviso:D1 · leituras', 1, 86400), true);
    await ateRecusar(env, 'rp:' + uid, 2, 3600);
    await ateRecusar(env, 'rpa:192.0.2.1', 2, 3600);
    const c = aContar(env);
    assert.equal(await rateLimit(env, 'aviso:D1 · leituras', 1, 86400), false);
    assert.equal(await rateLimit(env, 'rp:' + uid, 2, 3600), false);
    assert.equal(await rateLimit(env, 'rpa:192.0.2.1', 2, 3600), false);
    assert.equal(c.escritas, 0);
    assert.equal(await contador(env, 'rp:' + uid), 2, 'o contador fica no limite, como antes');
    assert.equal((await deSeguranca(env)).length, 0);
    assert.equal(relatoDoLimite('aviso:x'), null);
    assert.equal(relatoDoLimite('rp:U1'), null);
    assert.equal(relatoDoLimite('rpa:1.2.3.4'), null);
  });

  test('um prefixo desconhecido também relata, com a chave crua', async () => {
    const env = ambiente();
    await ateRecusar(env, 'novo:qualquer-coisa', 1);
    const [t] = await deSeguranca(env);
    assert.equal(t.subject, 'Limite atingido: chave novo:qualquer-coisa');
    assert.equal(t.user_id, 'SISTEMA');
  });

  test('um relato que falha não muda o false, e um contador em baixo continua a deixar passar', async () => {
    const env = ambiente();
    await ateRecusar(env, 'pw:U9', 2);   // a conta não existe: o ticket não entra (chave estrangeira), o 429 fica
    assert.equal((await deSeguranca(env)).length, 0);
    assert.equal(await contador(env, 'pw:U9'), 3, 'a recusa contou-se na mesma');
    const real = env.DB;
    // a tabela dos tickets em baixo: o relato rebenta lá dentro, o 429 fica
    const semTickets = {
      prepare(sql) { if (/tickets/.test(sql)) throw new Error('tickets em baixo'); return real.prepare(sql); },
    };
    assert.deepEqual(await ateRecusar({ DB: semTickets }, 'grpc:U7', 2, 3600), [true, true, false]);
    assert.equal(await rateLimit({ DB: semTickets }, 'grpc:U7', 2, 3600), false);
    // a escrita condicionada do contador em baixo: recusa na mesma, sem lançar
    const semUpdate = {
      prepare(sql) {
        if (/UPDATE rate_limits SET n = n \+ 1 WHERE k = \? AND n = \?/.test(sql)) throw new Error('em baixo');
        return real.prepare(sql);
      },
    };
    assert.deepEqual(await ateRecusar({ DB: semUpdate }, 'up:U6', 2, 3600), [true, true, false]);
    // a base inteira em baixo: deixa passar, como sempre
    assert.equal(await rateLimit({ DB: { prepare() { throw new Error('em baixo'); } } }, 'w:U5', 1, 900), true);
  });

  test('o mapa: cada prefixo diz o que conta e de quem é; a mensagem cabe na assinatura', () => {
    for (const p of ['login:', 'auth:', 'acct:', 'pw:', 'verif:', 'w:', 'conv:', 'lig:', 'invc:', 'invp:', 'ligc:', 'ligp:',
      'grp:', 'grpe:', 'grpc:', 'grpl:', 'conn:', 'up:', 'tn:', 'tk:', 'qa:', 'rasto:']) {
      assert.ok(LIMITES[p] && !LIMITES[p].fora, p);
      // o id de uma conta (36) ou um IPv6 inteiro (45) ainda cabem nos 120 da assinatura
      const m = relatoDoLimite(p + 'f'.repeat(45)).mensagem;
      assert.ok(m.length <= 120, p + ' tem ' + m.length);
    }
    assert.equal(LIMITES['verif:'].o, 'reenvios do email de confirmação');
    assert.deepEqual(relatoDoLimite('acct:U1'), { mensagem: 'Limite atingido: tentativas de entrada numa conta · conta U1', userId: 'U1' });
    assert.deepEqual(relatoDoLimite('qa:equipa:123'), { mensagem: 'Limite atingido: tickets de QA · equipa 123', userId: null });
    assert.deepEqual(relatoDoLimite('rasto:p_abc'), { mensagem: 'Limite atingido: lotes do rasto · pseudónimo p_abc', userId: null });
    assert.deepEqual(relatoDoLimite('rasto:2001:db8::1'), { mensagem: 'Limite atingido: lotes do rasto · IP 2001:db8::1', userId: null });
    assert.match(detalheDoLimite('k:x', 30, 3600, 0, 3600000), /Limite: 30 em 1 h, a contar do primeiro pedido/);
  });
});

/* ------------------------- decidir e arquivar --------------------------- */

// Recebe: env.
// Devolve: o id de um ticket de segurança a sério (um limite atingido por uma conta).
async function umTicket(env) {
  const uid = await novaConta(env);
  await ateRecusar(env, 'w:' + uid, 2);
  return { id: (await deSeguranca(env))[0].id, uid };
}

describe('Decidir: a resolução proposta é obrigatória', () => {
  test('sem proposta 400; com ela grava quem, quando e a proposta, e deixa a nota interna', async () => {
    const env = ambiente();
    const { id } = await umTicket(env);
    for (const texto of [undefined, '', '   ']) {
      const r = await chamar(env, MASTER, 'POST', url(id, 'aceitar'), texto === undefined ? {} : { texto });
      assert.equal(r.status, 400);
      assert.match((await r.json()).error, /resolução proposta/);
    }
    const r = await corpoDe(await chamar(env, DEV, 'POST', url(id, 'aceitar'), { texto: 'Subir o limite das gravações para 120 em 15 min.' }));
    assert.equal(r.status, 200);
    assert.deepEqual([r.pedido.accepted_by, r.pedido.accepted_by_nome, r.pedido.accepted_changes, r.pedido.status],
      ['d1', 'Dina', 'Subir o limite das gravações para 120 em 15 min.', 'criado']);
    assert.ok(r.pedido.accepted_at > 0);
    assert.deepEqual(r.msgs.map((m) => [m.tipo, m.texto, m.nome]), [['nota', 'Resolução proposta: Subir o limite das gravações para 120 em 15 min.', 'Dina']]);
    assert.deepEqual((await auditoria(env)).map((x) => [x.acao, x.alvo]), [['pedido.decidir', id]]);
    // decidido, não se decide outra vez
    const outra = await chamar(env, ADMIN, 'POST', url(id, 'aceitar'), { texto: 'Bloquear.' });
    assert.equal(outra.status, 409);
    assert.match((await outra.json()).error, /já foi decidido por Dina/);
  });

  test('quem não vê a segurança não decide (o suporte)', async () => {
    const env = ambiente();
    const { id } = await umTicket(env);
    assert.equal((await chamar(env, SUPORTE, 'POST', url(id, 'aceitar'), { texto: 'x' })).status, 403);
  });

  test('por decidir não se conclui pelo Responder e concluir; decidido, sim', async () => {
    const env = ambiente();
    const { id } = await umTicket(env);
    const r = await chamar(env, MASTER, 'POST', url(id, 'fechar'), {});
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /decide-o, ou arquiva-o/);
    await chamar(env, MASTER, 'POST', url(id, 'aceitar'), { texto: 'Contactar a pessoa.' });
    const f = await corpoDe(await chamar(env, MASTER, 'POST', url(id, 'fechar'), { texto: 'Contactada.' }));
    assert.equal(f.pedido.status, 'concluido');
  });
});

describe('Arquivar: a justificação é obrigatória, e não vai nada para ninguém', () => {
  test('sem justificação 400; com ela conclui, sem reply e sem email, com a nota interna', async () => {
    const env = ambiente({ RESEND_API_KEY: 'chave' });
    armarCorreio();
    const { id } = await umTicket(env);
    assert.equal((await chamar(env, MASTER, 'POST', url(id, 'recusar'), { texto: '  ' })).status, 400);
    await chamar(env, MASTER, 'POST', url(id, 'aceitar'), { texto: 'Bloquear a conta.' });
    const r = await corpoDe(await chamar(env, MASTER, 'POST', url(id, 'recusar'), { texto: 'Falso alarme: era um teste da equipa.' }));
    assert.equal(r.status, 200);
    assert.deepEqual([r.pedido.status, r.pedido.reply, r.pedido.refused_by_nome], ['concluido', null, 'Mestre']);
    assert.ok(r.pedido.refused_at > 0);
    assert.deepEqual([r.pedido.accepted_at, r.pedido.accepted_changes], [null, null], 'arquivar larga a resolução proposta');
    assert.deepEqual(r.msgs.map((m) => [m.tipo, m.texto]), [
      ['nota', 'Resolução proposta: Bloquear a conta.'], ['nota', 'Arquivado: Falso alarme: era um teste da equipa.']]);
    assert.equal(emails.length, 0, 'a conta dona do ticket não recebe nada');
    assert.deepEqual((await auditoria(env)).map((x) => x.acao), ['pedido.decidir', 'pedido.arquivar']);
    assert.equal((await chamar(env, MASTER, 'POST', url(id, 'recusar'), { texto: 'outra vez' })).status, 409);
    assert.equal((await chamar(env, MASTER, 'POST', url(id, 'aceitar'), { texto: 'x' })).status, 409);
  });

  test('a lista dos erros traz o que o guião lê para dizer por decidir, decidido ou arquivado', async () => {
    const env = ambiente();
    const { id } = await umTicket(env);
    const linha = async () => (await corpoDe(await chamar(env, DEV, 'GET', '/api/equipa/pedidos', null, '?tipo=erros&estado=')))
      .pedidos.find((p) => p.id === id);
    let l = await linha();
    assert.deepEqual([l.category, l.accepted_at, l.refused_at], ['seguranca', null, null]);
    await chamar(env, DEV, 'POST', url(id, 'aceitar'), { texto: 'Contactar.' });
    l = await linha();
    assert.ok(l.accepted_at > 0 && l.refused_at === null);
    await chamar(env, DEV, 'POST', url(id, 'recusar'), { texto: 'Afinal era um teste.' });
    l = await linha();
    assert.ok(l.refused_at > 0 && l.accepted_at === null && l.status === 'concluido');
  });
});

describe('os pedidos das pessoas ficam como estavam', () => {
  test('aceitar sem alterações e recusar com a resposta e o email, tal e qual', async () => {
    const env = ambiente({ RESEND_API_KEY: 'chave' });
    armarCorreio();
    const uid = await novaConta(env);
    const pid = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, created_at, updated_at)
       VALUES (?, ?, 'problema', 'Ajuda', 'Não sei.', 'criado', 'user', 1, 1)`
    ).bind(pid, uid).run();
    const a = await corpoDe(await chamar(env, SUPORTE, 'POST', url(pid, 'aceitar'), {}));
    assert.deepEqual([a.status, a.pedido.accepted_changes, a.msgs.length], [200, null, 0]);
    const r = await corpoDe(await chamar(env, SUPORTE, 'POST', url(pid, 'recusar'), { texto: 'Não vamos mudar isto.' }));
    assert.deepEqual([r.pedido.status, r.pedido.reply, r.msgs.at(-1).tipo], ['concluido', 'Não vamos mudar isto.', 'resposta']);
    assert.equal(emails.length, 1, 'a pessoa recebe a justificação por email');
    assert.deepEqual((await auditoria(env)).map((x) => x.acao), ['pedido.aceitar', 'pedido.recusar']);
    // um erro técnico continua sem se aceitar
    const eid = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, created_at, updated_at)
       VALUES (?, ?, 'problema', 'TypeError', 'pilha', 'criado', 'client', 1, 1)`
    ).bind(eid, uid).run();
    assert.equal((await chamar(env, MASTER, 'POST', url(eid, 'aceitar'), { texto: 'x' })).status, 400);
    assert.equal((await chamar(env, MASTER, 'POST', url(eid, 'fechar'), {})).status, 200, 'e fecha-se sem decisão');
  });
});

describe('um ticket que volta', () => {
  test('arquivado, o limite volta a ser atingido: reabre sem decisão, no mesmo ticket', async () => {
    const env = ambiente();
    const { id, uid } = await umTicket(env);
    await chamar(env, MASTER, 'POST', url(id, 'recusar'), { texto: 'Falso alarme.' });
    await acabarJanela(env, 'w:' + uid);
    await ateRecusar(env, 'w:' + uid, 2);
    const ts = await deSeguranca(env);
    assert.equal(ts.length, 1);
    assert.deepEqual([ts[0].id, ts[0].status, ts[0].n, ts[0].refused_at, ts[0].refused_by_nome], [id, 'criado', 2, null, null]);
    // e decide-se de novo
    assert.equal((await chamar(env, MASTER, 'POST', url(id, 'aceitar'), { texto: 'Contactar a pessoa.' })).status, 200);
  });

  test('decidido e concluído, volta por decidir; decidido e aberto, a decisão fica', async () => {
    const env = ambiente();
    const { id, uid } = await umTicket(env);
    await chamar(env, MASTER, 'POST', url(id, 'aceitar'), { texto: 'Subir o limite.' });
    await acabarJanela(env, 'w:' + uid);
    await ateRecusar(env, 'w:' + uid, 2);
    let [t] = await deSeguranca(env);
    assert.deepEqual([t.n, t.status, t.accepted_changes], [2, 'criado', 'Subir o limite.'], 'aberto: só soma');
    await chamar(env, MASTER, 'POST', url(id, 'fechar'), {});
    await acabarJanela(env, 'w:' + uid);
    await ateRecusar(env, 'w:' + uid, 2);
    [t] = await deSeguranca(env);
    assert.deepEqual([t.n, t.status, t.accepted_at, t.accepted_changes], [3, 'criado', null, null]);
  });
});

/* --------------------------- o aviso no Discord ------------------------- */

// O Discord de faz-de-conta: cada embed que chega ao webhook de quem
// programa fica em discord; responde com o estado dado, ou rebenta, ou nunca.
// Recebe: modo — 204 (por omissão), 500, 'rebenta' ou 'pendura'.
// Devolve: a lista viva dos embeds recebidos.
function armarDiscord(modo = 204) {
  const discord = [];
  globalThis.fetch = async (u, o) => {
    if (!String(u).startsWith('https://discord.test')) throw new Error('fora do Discord: ' + u);
    discord.push(JSON.parse(o.body).embeds[0]);
    if (modo === 'rebenta') throw new Error('rede em baixo');
    if (modo === 'pendura') return new Promise(() => {});
    return new Response('', { status: modo });
  };
  return discord;
}
const comDiscord = () => ambiente({ DISCORD_DEV_WEBHOOK: 'https://discord.test/dev' });

describe('o aviso no Discord: ao abrir e ao reabrir, uma vez', () => {
  test('abrir avisa uma vez; as recusas da mesma janela e as janelas seguintes de um aberto não', async () => {
    const env = comDiscord();
    const discord = armarDiscord();
    const uid = await novaConta(env);
    await ateRecusar(env, 'w:' + uid, 2);
    assert.equal(discord.length, 1);
    assert.match(discord[0].title, /^\[teste\] Limite atingido$/, 'o título não diz «Erro na app»');
    assert.match(discord[0].description, new RegExp('gravações de dados · conta ' + uid));
    assert.equal(discord[0].fields.find((f) => f.name === 'Quem').value, uid);
    assert.match(discord[0].footer.text, /^report [0-9a-f-]{36}$/);
    for (let i = 0; i < 5; i++) await rateLimit(env, 'w:' + uid, 2, 900);
    await acabarJanela(env, 'w:' + uid);
    await ateRecusar(env, 'w:' + uid, 2);
    assert.equal(discord.length, 1, 'o ticket já está na fila: somar não avisa');
    assert.equal((await deSeguranca(env))[0].n, 2);
  });

  test('reabrir (depois de arquivado) avisa uma vez, a dizer que voltou', async () => {
    const env = comDiscord();
    const discord = armarDiscord();
    await ateRecusar(env, 'login:198.51.100.9', 10);
    const [t] = await deSeguranca(env);
    await chamar(env, MASTER, 'POST', url(t.id, 'recusar'), { texto: 'Falso alarme.' });
    await acabarJanela(env, 'login:198.51.100.9');
    await ateRecusar(env, 'login:198.51.100.9', 10);
    assert.equal(discord.length, 2);
    assert.match(discord[1].title, /Limite atingido de novo \(reaberto\) \(×2\)$/);
    assert.equal(discord[1].fields.find((f) => f.name === 'Quem').value, 'sem conta (pelo IP)');
    assert.equal(discord[1].footer.text, 'report ' + t.id);
  });

  test('um aviso que falha, ou que rebenta, não muda o false, e o ticket fica', async () => {
    for (const modo of [500, 'rebenta']) {
      const env = comDiscord();
      const discord = armarDiscord(modo);
      assert.deepEqual(await ateRecusar(env, 'conv:192.0.2.60', 1, 900), [true, false], String(modo));
      assert.equal(discord.length, 1);
      assert.equal((await deSeguranca(env)).length, 1);
    }
  });

  test('um Discord pendurado não segura o 429 mais do que a espera', async () => {
    const env = comDiscord();
    armarDiscord('pendura');
    await rateLimit(env, 'grp:192.0.2.50', 1, 900);
    const t0 = Date.now();
    assert.equal(await rateLimit(env, 'grp:192.0.2.50', 1, 900), false);
    const ms = Date.now() - t0;
    assert.ok(ms >= ESPERA_DO_AVISO_MS - 50 && ms < ESPERA_DO_AVISO_MS + 1500, 'esperou ' + ms + ' ms');
    assert.equal((await deSeguranca(env)).length, 1);
  });

  test('o embed: reaberto a vermelho, o detalhe cortado ao que o Discord aceita', () => {
    const e = limiteEmbed({ id: 'x', message: 'm', detail: 'd'.repeat(3000), user_id: null, n: 3, reaberto: true, created_at: 0 });
    assert.equal(e.title, 'Limite atingido de novo (reaberto) (×3)');
    assert.equal(e.color, 0xb94a48);
    assert.ok(e.fields.every((f) => f.value.length <= 1024));
  });
});

describe('a vigia dos tetos avisa uma vez por dia sem passar pelo rateLimit', () => {
  test('avisoDeHoje: a primeira vez sim, com o prazo a correr não, passado o prazo sim; base em baixo, sim', async () => {
    const env = ambiente();
    const t = 1_000_000_000_000;
    assert.equal(await avisoDeHoje(env, 'aviso:D1 · linhas lidas', t), true);
    assert.equal(await avisoDeHoje(env, 'aviso:D1 · linhas lidas', t + 3600000), false);
    assert.equal(await avisoDeHoje(env, 'aviso:KV · escritas', t + 3600000), true, 'cada teto tem a sua chave');
    assert.equal(await avisoDeHoje(env, 'aviso:D1 · linhas lidas', t + 86400001), true);
    assert.equal(await avisoDeHoje(env, 'aviso:D1 · linhas lidas', t + 86400002), false);
    assert.equal(await avisoDeHoje({ DB: { prepare() { throw new Error('em baixo'); } } }, 'aviso:x', t), true);
    assert.equal((await deSeguranca(env)).length, 0, 'nunca abre um ticket de segurança');
  });
});
