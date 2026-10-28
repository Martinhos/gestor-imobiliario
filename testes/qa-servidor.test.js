// Os tickets de QA do ambiente de desenvolvimento — o servidor, contra o SQL a
// sério (testes/lib/bd.js) com a migração 0023. Prova que em produção (sem
// ENV_NAME) todas as rotas /api/qa respondem 404 sem lerem o corpo; o criar
// (válido, sem descrição, descrição longa de mais, gravidade inválida que fica
// nula, contexto que não é objeto, contexto cortado aos 16 KB pelos passos
// mais antigos do rasto e, sem rasto, pelas chaves maiores); o listar (abertos
// primeiro e depois os resolvidos, cada parte pela ordem certa, sem os
// removidos, com o autor, a imagem como sim/não e o contexto como objeto, e
// uma segunda conta a ver e a mexer no ticket da primeira); o remover e o
// repor (o Anular), e o repor recusado depois das 24 h; a limpeza das 24 h
// apaga a linha e a captura do R2 e deixa os removidos há menos tempo; o
// reabrir guarda a resolução; a captura (tipo recusado e bytes que não são
// imagem com 415, grande de mais com 413, ticket inexistente ou removido com
// 404, a mesma imagem e o tipo de volta, sem cache); e o travão de 30 tickets
// por hora por pessoa.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ambiente, conta, pedir, resp } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';
import { contextoParaGuardar, tipoDaImagem } from '../worker/src/rotas/qa.js';

/* ------------------------------ armações ------------------------------- */

// Um PNG de 1×1 de verdade (assinatura, IHDR, IDAT e IEND).
const PNG = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));

// Recebe: env; quem — a conta; corpo — o do POST /api/qa.
// Devolve: a promessa de {status, ...}.
const criar = (env, quem, corpo) => resp(pedir(env, quem, '/api/qa', 'POST', corpo));
// Recebe: env; quem — a conta.
// Devolve: a promessa da lista de tickets do GET /api/qa.
const listar = async (env, quem) => (await resp(pedir(env, quem, '/api/qa'))).tickets;

/* Sobe bytes como o cliente sobe a captura: PUT com o Content-Type dado.
   Recebe: env; quem — a conta; id — o ticket; bytes (Uint8Array); tipo.
   Devolve: a promessa da Response. */
function subir(env, quem, id, bytes, tipo) {
  return handleApi(new Request('https://app.x.pt/api/qa/' + id + '/imagem', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + quem.token, 'Content-Type': tipo, 'Content-Length': String(bytes.byteLength) },
    body: bytes,
  }), env, { waitUntil() {} });
}

// Recebe: env; id — o ticket.
// Devolve: a promessa da linha de qa_tickets como está na base (ou null).
const daBase = async (env, id) => {
  const r = await env.DB.prepare('SELECT * FROM qa_tickets WHERE id = ?').bind(id).first();
  return r ? { ...r } : null;
};

// Recebe: env; id; campos — {coluna: valor} a escrever direto na linha.
// Devolve: a promessa do run.
const mexer = (env, id, campos) => {
  const ks = Object.keys(campos);
  return env.DB.prepare('UPDATE qa_tickets SET ' + ks.map((k) => k + ' = ?').join(', ') + ' WHERE id = ?')
    .bind(...ks.map((k) => campos[k]), id).run();
};

// Recebe: s — um texto.
// Devolve: os bytes dele em UTF-8.
const bytes = (s) => new TextEncoder().encode(s).length;

const HORA = 3600 * 1000;

/* ------------------------------- produção ------------------------------ */

describe('tickets de QA em produção', () => {
  test('sem ENV_NAME todas as rotas respondem 404 e nenhuma lê o corpo', async () => {
    const env = ambiente({ ENV_NAME: undefined });
    const a = await conta(env, 'Ana');
    const rotas = [
      ['POST', '/api/qa'], ['GET', '/api/qa'], ['DELETE', '/api/qa/x1'], ['POST', '/api/qa/x1/repor'],
      ['POST', '/api/qa/x1/reabrir'], ['PUT', '/api/qa/x1/imagem'], ['GET', '/api/qa/x1/imagem'],
    ];
    for (const [method, path] of rotas) {
      const comCorpo = method !== 'GET';
      const req = new Request('https://app.x.pt' + path, {
        method,
        headers: { Authorization: 'Bearer ' + a.token, 'Content-Type': 'application/json' },
        body: comCorpo ? JSON.stringify({ body: 'olá' }) : undefined,
      });
      const r = await handleApi(req, env, { waitUntil() {} });
      assert.equal(r.status, 404, method + ' ' + path);
      if (comCorpo) assert.equal(req.bodyUsed, false, method + ' ' + path + ' leu o corpo');
    }
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM qa_tickets').first();
    assert.equal(n.n, 0, 'nada se gravou');
  });

  test('um caminho que só começa por /api/qa não é destas rotas', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const r = await resp(pedir(env, a, '/api/qaz'));
    assert.equal(r.status, 404);
    assert.equal(r.error, 'Rota desconhecida.');
  });
});

/* -------------------------------- criar -------------------------------- */

describe('criar um ticket', () => {
  test('grava a descrição aparada, a gravidade, o contexto em JSON e quem o escreveu', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const r = await criar(env, a, { body: '  O botão some no escuro  ', severity: 'bloqueia', context: { ecra: { tab: 'casas' }, versao: 43 } });
    assert.equal(r.status, 201);
    assert.equal(r.ok, true);
    const l = await daBase(env, r.id);
    assert.equal(l.user_id, a.id);
    assert.equal(l.body, 'O botão some no escuro');
    assert.equal(l.severity, 'bloqueia');
    assert.deepEqual(JSON.parse(l.context), { ecra: { tab: 'casas' }, versao: 43 });
    assert.equal(l.status, 'aberto');
    assert.equal(l.image_key, null);
    assert.equal(l.removed_at, null);
    assert.ok(l.created_at > 0 && l.updated_at === l.created_at);
  });

  test('sem descrição (ou só espaços, ou não texto) é 400 «Escreve o que viste.»; acima de 4000 também recusa', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    for (const corpo of [{}, { body: '   \n ' }, { body: 42 }, { body: ['x'] }]) {
      const r = await criar(env, a, corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
      assert.equal(r.error, 'Escreve o que viste.');
    }
    const nao = await resp(pedir(env, a, '/api/qa', 'POST', 'isto não é json'));
    assert.equal(nao.status, 400);
    const longo = await criar(env, a, { body: 'a'.repeat(4001) });
    assert.equal(longo.status, 400);
    assert.match(longo.error, /4000 caracteres/);
    const justo = await criar(env, a, { body: 'a'.repeat(4000) });
    assert.equal(justo.status, 201, '4000 cabe');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM qa_tickets').first();
    assert.equal(n.n, 1);
  });

  test('uma gravidade fora das três fica nula; um contexto que não é objeto fica nulo', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    for (const severity of ['urgente', 'BLOQUEIA', 3, null, undefined]) {
      const r = await criar(env, a, { body: 'x', severity, context: { a: 1 } });
      assert.equal((await daBase(env, r.id)).severity, null, String(severity));
    }
    for (const g of ['bloqueia', 'incomoda', 'detalhe']) {
      const r = await criar(env, a, { body: 'x', severity: g });
      assert.equal((await daBase(env, r.id)).severity, g);
    }
    for (const context of ['texto', 7, ['a'], null]) {
      const r = await criar(env, a, { body: 'x', context });
      assert.equal((await daBase(env, r.id)).context, null, JSON.stringify(context));
    }
  });

  test('o contexto grande corta-se aos 16 KB pelos passos mais antigos do rasto', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const rasto = Array.from({ length: 400 }, (_, i) => 'passo ' + i + ' ' + 'ã'.repeat(60));
    const r = await criar(env, a, { body: 'x', context: { ecra: { tab: 'agenda' }, versao: 43, rasto } });
    const guardado = (await daBase(env, r.id)).context;
    assert.ok(bytes(guardado) <= 16 * 1024, 'cabe nos 16 KB: ' + bytes(guardado));
    const o = JSON.parse(guardado);
    assert.equal(o.cortado, true, 'diz que foi cortado');
    assert.deepEqual(o.ecra, { tab: 'agenda' }, 'o resto fica');
    assert.equal(o.versao, 43);
    assert.ok(o.rasto.length > 50 && o.rasto.length < 400, 'ficaram ' + o.rasto.length);
    assert.equal(o.rasto[o.rasto.length - 1], rasto[399], 'fica o passo mais recente');
    assert.deepEqual(o.rasto, rasto.slice(400 - o.rasto.length), 'saíram só os mais antigos, pela ordem');
    // e o mais que cabia: mais um passo já não cabia
    const maisUm = JSON.stringify({ ...o, rasto: rasto.slice(400 - o.rasto.length - 1) });
    assert.ok(bytes(maisUm) > 16 * 1024, 'não se cortou mais do que era preciso');
  });

  test('sem rasto que chegue, saem as chaves maiores; um contexto pequeno fica tal e qual', () => {
    const grande = { ecra: { tab: 'casas' }, agente: 'x'.repeat(20000), versao: 43, rasto: ['a'] };
    const o = JSON.parse(contextoParaGuardar(grande));
    assert.equal(o.cortado, true);
    assert.equal(o.agente, undefined, 'saiu a chave que não cabia');
    assert.deepEqual(o.ecra, { tab: 'casas' });
    assert.equal(o.versao, 43);
    const pequeno = { ecra: { tab: 'casas', ficha: null }, rasto: ['abrir'] };
    assert.equal(contextoParaGuardar(pequeno), JSON.stringify(pequeno), 'sem cortado quando cabe');
    assert.equal(grande.agente.length, 20000, 'o objeto de quem chamou não muda');
  });

  test('contextos hostis: milhares de chaves cortam-se depressa, e um aninhado sem fim não deita abaixo o ticket', async () => {
    const muitas = {};
    for (let i = 0; i < 40000; i++) muitas['k' + i] = 'v'.repeat(i % 50);
    const t0 = Date.now();
    const s = contextoParaGuardar(muitas);
    assert.ok(Date.now() - t0 < 2000, 'demorou ' + (Date.now() - t0) + ' ms');
    assert.ok(bytes(s) <= 16 * 1024);
    assert.equal(JSON.parse(s).cortado, true);

    const env = ambiente();
    const a = await conta(env, 'Ana');
    const fundo = '{"ecra":' + '['.repeat(200000) + ']'.repeat(200000) + '}';
    const corpo = '{"body":"aninhado","context":' + fundo + '}';
    const r = await resp(pedir(env, a, '/api/qa', 'POST', corpo));
    assert.equal(r.status, 201, 'o ticket grava-se');
    const l = await daBase(env, r.id);
    assert.equal(l.body, 'aninhado');
    assert.ok(l.context === null || bytes(l.context) <= 16 * 1024, 'o contexto ou cabe ou fica de fora');
  });
});

/* -------------------------------- listar ------------------------------- */

describe('listar os tickets', () => {
  test('abertos primeiro (o mais recente à frente), depois os resolvidos (o resolvido há menos tempo à frente), sem os removidos', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const ids = {};
    for (const n of ['abertoVelho', 'abertoNovo', 'resolvidoCedo', 'resolvidoTarde', 'removido']) {
      ids[n] = (await criar(env, a, { body: n })).id;
    }
    const t = Date.now();
    await mexer(env, ids.abertoVelho, { created_at: t - 5 * HORA });
    await mexer(env, ids.abertoNovo, { created_at: t - 1 * HORA });
    await mexer(env, ids.resolvidoCedo, { created_at: t - 1 * HORA, status: 'resolvido', resolution: 'feito', resolved_at: t - 4 * HORA });
    await mexer(env, ids.resolvidoTarde, { created_at: t - 9 * HORA, status: 'resolvido', resolution: 'feito', resolved_at: t - 2 * HORA });
    assert.equal((await resp(pedir(env, a, '/api/qa/' + ids.removido, 'DELETE'))).status, 200);
    const lista = await listar(env, a);
    assert.deepEqual(lista.map((x) => x.body), ['abertoNovo', 'abertoVelho', 'resolvidoTarde', 'resolvidoCedo']);
  });

  test('os abertos agrupados por gravidade (bloqueia, incomoda, detalhe, sem), e em cada grupo o mais recente à frente', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const t = Date.now();
    const casos = [['semNovo', null, 1], ['detalhe', 'detalhe', 2], ['bloqueiaVelho', 'bloqueia', 9], ['incomoda', 'incomoda', 3],
      ['bloqueiaNovo', 'bloqueia', 4], ['semVelho', null, 8], ['resolvidoBloqueia', 'bloqueia', 1]];
    for (const [nome, grav, horas] of casos) {
      const id = (await criar(env, a, { body: nome, severity: grav || undefined })).id;
      await mexer(env, id, nome.startsWith('resolvido')
        ? { created_at: t - horas * HORA, status: 'resolvido', resolution: 'feito', resolved_at: t }
        : { created_at: t - horas * HORA });
    }
    const lista = await listar(env, a);
    assert.deepEqual(lista.map((x) => x.body), ['bloqueiaNovo', 'bloqueiaVelho', 'incomoda', 'detalhe', 'semNovo', 'semVelho', 'resolvidoBloqueia']);
  });

  test('cada ticket traz o autor com nome e email, a imagem como sim/não e o contexto como objeto', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana Lopes');
    const comImg = (await criar(env, a, { body: 'com imagem', severity: 'detalhe', context: { ecra: { tab: 'casas', ficha: { tipo: 'casa', id: 'h1' } } } })).id;
    await criar(env, a, { body: 'sem imagem' });
    assert.equal((await subir(env, a, comImg, PNG, 'image/png')).status, 200);
    const lista = await listar(env, a);
    const t = lista.find((x) => x.id === comImg);
    assert.deepEqual(t.autor, { id: a.id, nome: 'Ana Lopes', email: a.email, discord: null });
    assert.equal(t.imagem, true);
    assert.deepEqual(t.context, { ecra: { tab: 'casas', ficha: { tipo: 'casa', id: 'h1' } } });
    assert.equal(t.severity, 'detalhe');
    assert.equal(t.status, 'aberto');
    assert.equal(t.resolution, null);
    assert.equal(t.resolved_at, null);
    assert.ok(t.created_at > 0 && t.updated_at >= t.created_at);
    assert.deepEqual(Object.keys(t).sort(), ['autor', 'body', 'context', 'created_at', 'id', 'imagem', 'resolution', 'resolved_at', 'severity', 'status', 'updated_at']);
    const s = lista.find((x) => x.body === 'sem imagem');
    assert.equal(s.imagem, false);
    assert.equal(s.context, null);
    assert.equal(s.severity, null);
  });

  test('numa conta de teste o autor é a conta do Discord que pediu o /test, e fica depois de a conta sair', async () => {
    const env = ambiente();
    const t1 = await conta(env, 'Conta de teste');
    const t2 = await conta(env, 'Conta de teste');
    await env.DB.prepare('UPDATE users SET test_owner = ? WHERE id IN (?, ?)').bind('4242', t1.id, t2.id).run();
    await env.SESSIONS.put('teste:nome:4242', 'Martinho');
    const id1 = (await criar(env, t1, { body: 'com nome' })).id;
    await env.SESSIONS.delete('teste:nome:4242');
    const id2 = (await criar(env, t2, { body: 'sem nome na ligação' })).id;
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(t1.id).run();   // o /test limpar
    const lista = await listar(env, t2);
    assert.deepEqual(lista.find((x) => x.id === id1).autor.discord, { id: '4242', nome: 'Martinho' }, 'o nome guardou-se ao criar');
    assert.deepEqual(lista.find((x) => x.id === id2).autor.discord, { id: '4242', nome: '' }, 'sem nome, fica o id');
    assert.equal(lista.find((x) => x.id === id1).autor.nome, '', 'a conta de teste já saiu, o Discord fica');
  });

  test('sem o nome da ligação, o nome vem do bot: ao criar, e nos tickets que ficaram só com o id', async () => {
    const fetchReal = globalThis.fetch;
    const pedidos = [];
    globalThis.fetch = async (url, opts) => {
      pedidos.push({ url: String(url), auth: opts && opts.headers && opts.headers.Authorization });
      if (String(url) === 'https://discord.com/api/v10/users/4242') return new Response(JSON.stringify({ id: '4242', username: 'martinho', global_name: 'Martinho Santos' }));
      if (String(url) === 'https://discord.com/api/v10/users/5151') return new Response(JSON.stringify({ id: '5151', username: 'rui_qa', global_name: null }));
      return new Response('{}', { status: 404 });
    };
    try {
      const env = ambiente();
      const t1 = await conta(env, 'Conta de teste');
      const t2 = await conta(env, 'Conta de teste');
      await env.DB.prepare('UPDATE users SET test_owner = ? WHERE id = ?').bind('4242', t1.id).run();
      await env.DB.prepare('UPDATE users SET test_owner = ? WHERE id = ?').bind('5151', t2.id).run();
      // sem token, fica só o id (como num ticket criado antes desta versão)
      const antigo = (await criar(env, t2, { body: 'antes do bot' })).id;
      assert.equal((await daBase(env, antigo)).discord_nome, null);
      assert.equal(pedidos.length, 0, 'sem token não se pergunta nada');
      env.DISCORD_BOT_TOKEN = 'tok';
      const novo = (await criar(env, t1, { body: 'com o bot' })).id;
      assert.equal((await daBase(env, novo)).discord_nome, 'Martinho Santos', 'o nome de exibição');
      assert.equal(await env.SESSIONS.get('teste:nome:4242'), 'Martinho Santos', 'guardado no KV');
      assert.equal(pedidos[0].auth, 'Bot tok');
      const lista = await listar(env, t1);
      assert.deepEqual(lista.find((x) => x.id === antigo).autor.discord, { id: '5151', nome: 'rui_qa' }, 'sem nome de exibição, o de utilizador');
      assert.equal((await daBase(env, antigo)).discord_nome, 'rui_qa', 'e fica gravado na linha, para o qa.mjs');
      const n = pedidos.length;
      await listar(env, t1);
      await criar(env, t1, { body: 'outra vez' });
      assert.equal(pedidos.length, n, 'depois de saber, não pergunta outra vez');
    } finally {
      globalThis.fetch = fetchReal;
    }
  });

  test('todas as contas veem e mexem em todos os tickets', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const b = await conta(env, 'Bruno');
    const id = (await criar(env, a, { body: 'da Ana' })).id;
    const vistoPeloBruno = await listar(env, b);
    assert.deepEqual(vistoPeloBruno.map((x) => [x.id, x.autor.nome]), [[id, 'Ana']]);
    assert.equal((await resp(pedir(env, b, '/api/qa/' + id, 'DELETE'))).status, 200, 'o Bruno remove');
    assert.deepEqual(await listar(env, a), [], 'e sai para a Ana também');
    assert.equal((await resp(pedir(env, a, '/api/qa/' + id + '/repor', 'POST'))).status, 200, 'a Ana anula');
    assert.equal((await listar(env, b)).length, 1);
  });

  test('a lista para nos 200', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const t = Date.now();
    const st = env.DB.prepare(
      `INSERT INTO qa_tickets (id, user_id, body, status, created_at, updated_at) VALUES (?, ?, ?, 'aberto', ?, ?)`);
    for (let i = 0; i < 205; i++) await st.bind('q' + i, a.id, 'n' + i, t - i, t - i).run();
    const lista = await listar(env, a);
    assert.equal(lista.length, 200);
    assert.equal(lista[0].id, 'q0', 'os mais recentes ficam');
  });
});

/* ------------------------- remover, repor, limpar ---------------------- */

describe('remover, repor e a limpeza das 24 h', () => {
  test('remover é brando: sai da lista, fica na base com removed_at, e o repor devolve-o', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = (await criar(env, a, { body: 'x' })).id;
    const r = await resp(pedir(env, a, '/api/qa/' + id, 'DELETE'));
    assert.deepEqual(r, { status: 200, ok: true });
    assert.ok((await daBase(env, id)).removed_at > 0);
    assert.deepEqual(await listar(env, a), []);
    const outra = await resp(pedir(env, a, '/api/qa/' + id, 'DELETE'));
    assert.equal(outra.status, 404, 'já removido');
    assert.equal(outra.error, 'Ticket não encontrado.');
    assert.equal((await resp(pedir(env, a, '/api/qa/nao-existe', 'DELETE'))).status, 404);
    assert.equal((await resp(pedir(env, a, '/api/qa/' + id + '/repor', 'POST'))).status, 200);
    assert.equal((await daBase(env, id)).removed_at, null);
    assert.deepEqual((await listar(env, a)).map((x) => x.id), [id]);
    assert.equal((await resp(pedir(env, a, '/api/qa/nao-existe/repor', 'POST'))).status, 404);
    assert.equal((await resp(pedir(env, a, '/api/qa/a%27b', 'DELETE'))).status, 404, 'um id sem forma de id');
  });

  test('passadas 24 h o repor já não devolve o ticket', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = (await criar(env, a, { body: 'x' })).id;
    await resp(pedir(env, a, '/api/qa/' + id, 'DELETE'));
    await mexer(env, id, { removed_at: Date.now() - 25 * HORA });
    assert.equal((await resp(pedir(env, a, '/api/qa/' + id + '/repor', 'POST'))).status, 404);
  });

  test('o GET e o POST apagam de vez os removidos há mais de 24 h, com a captura; os de há menos ficam', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const velho = (await criar(env, a, { body: 'velho' })).id;
    const recente = (await criar(env, a, { body: 'recente' })).id;
    const outroVelho = (await criar(env, a, { body: 'outro velho' })).id;
    await subir(env, a, velho, PNG, 'image/png');
    await subir(env, a, recente, PNG, 'image/png');
    assert.ok(env.FILES.m.has('qa/' + velho) && env.FILES.m.has('qa/' + recente));
    for (const id of [velho, recente, outroVelho]) await resp(pedir(env, a, '/api/qa/' + id, 'DELETE'));
    await mexer(env, velho, { removed_at: Date.now() - 25 * HORA });
    await mexer(env, recente, { removed_at: Date.now() - 23 * HORA });

    await listar(env, a);   // o GET leva o velho
    assert.equal(await daBase(env, velho), null, 'a linha saiu');
    assert.equal(env.FILES.m.has('qa/' + velho), false, 'e a captura também');
    assert.ok(await daBase(env, recente), 'o de há 23 h ainda espera pelo Anular');
    assert.ok(env.FILES.m.has('qa/' + recente));

    await mexer(env, outroVelho, { removed_at: Date.now() - 30 * HORA });
    await criar(env, a, { body: 'novo' });   // e o POST também limpa
    assert.equal(await daBase(env, outroVelho), null);
  });

  test('uma falha do R2 na limpeza não deita abaixo o pedido e a linha fica para a próxima', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = (await criar(env, a, { body: 'x' })).id;
    await subir(env, a, id, PNG, 'image/png');
    await resp(pedir(env, a, '/api/qa/' + id, 'DELETE'));
    await mexer(env, id, { removed_at: Date.now() - 25 * HORA });
    const apagar = env.FILES.delete;
    env.FILES.delete = async () => { throw new Error('R2 em baixo'); };
    const r = await resp(pedir(env, a, '/api/qa'));
    assert.equal(r.status, 200);
    assert.ok(await daBase(env, id), 'a linha fica');
    env.FILES.delete = apagar;
    await listar(env, a);
    assert.equal(await daBase(env, id), null, 'e sai na passagem seguinte');
    assert.equal(env.FILES.m.has('qa/' + id), false);
  });
});

/* -------------------------------- reabrir ------------------------------ */

describe('reabrir', () => {
  test('volta aos abertos sem resolved_at e guarda a resolução', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = (await criar(env, a, { body: 'x' })).id;
    await mexer(env, id, { status: 'resolvido', resolution: 'Corrigido em abc123', resolved_at: Date.now() });
    assert.equal((await listar(env, a))[0].status, 'resolvido');
    const r = await resp(pedir(env, a, '/api/qa/' + id + '/reabrir', 'POST'));
    assert.deepEqual(r, { status: 200, ok: true });
    const t = (await listar(env, a))[0];
    assert.equal(t.status, 'aberto');
    assert.equal(t.resolved_at, null);
    assert.equal(t.resolution, 'Corrigido em abc123', 'a resolução anterior fica');
    assert.equal((await resp(pedir(env, a, '/api/qa/nao-existe/reabrir', 'POST'))).status, 404);
    await resp(pedir(env, a, '/api/qa/' + id, 'DELETE'));
    assert.equal((await resp(pedir(env, a, '/api/qa/' + id + '/reabrir', 'POST'))).status, 404, 'removido não reabre');
  });
});

/* ------------------------------- a captura ----------------------------- */

describe('a captura de ecrã', () => {
  test('sobe e volta com os mesmos bytes, o tipo certo e sem cache', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const b = await conta(env, 'Bruno');
    const id = (await criar(env, a, { body: 'x' })).id;
    const r = await subir(env, a, id, PNG, 'image/png');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.equal((await daBase(env, id)).image_key, 'qa/' + id);
    const g = await pedir(env, b, '/api/qa/' + id + '/imagem');
    assert.equal(g.status, 200, 'outra conta também a vê');
    assert.equal(g.headers.get('Content-Type'), 'image/png');
    assert.equal(g.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(g.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.deepEqual(new Uint8Array(await g.arrayBuffer()), PNG);
  });

  test('o tipo vem dos bytes: JPEG e WebP aceites, e uma segunda captura substitui a primeira', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = (await criar(env, a, { body: 'x' })).id;
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 9, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2]);
    assert.equal((await subir(env, a, id, jpeg, 'image/jpeg')).status, 200);
    assert.equal((await pedir(env, a, '/api/qa/' + id + '/imagem')).headers.get('Content-Type'), 'image/jpeg');
    assert.equal((await subir(env, a, id, webp, 'image/webp; charset=binary')).status, 200);
    const g = await pedir(env, a, '/api/qa/' + id + '/imagem');
    assert.equal(g.headers.get('Content-Type'), 'image/webp');
    assert.deepEqual(new Uint8Array(await g.arrayBuffer()), webp);
    assert.equal(tipoDaImagem(Uint8Array.from([0x89, 0x50])), null, 'curto de mais');
  });

  test('tipo recusado ou bytes que não são imagem: 415; grande de mais: 413; vazia: 400', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = (await criar(env, a, { body: 'x' })).id;
    const texto = await subir(env, a, id, PNG, 'text/html');
    assert.equal(texto.status, 415);
    assert.match((await texto.json()).error, /PNG, JPEG ou WebP/);
    const html = new TextEncoder().encode('<script>alert(1)</script>');
    assert.equal((await subir(env, a, id, html, 'image/png')).status, 415, 'o Content-Type não chega');
    const grande = new Uint8Array(3 * 1024 * 1024 + 1);
    grande.set(PNG);
    const g = await subir(env, a, id, grande, 'image/png');
    assert.equal(g.status, 413);
    assert.match((await g.json()).error, /3 MB/);
    const justa = new Uint8Array(3 * 1024 * 1024);
    justa.set(PNG);
    assert.equal((await subir(env, a, id, justa, 'image/png')).status, 200, '3 MB cabem');
    // um Content-Length que mente para baixo não passa: conta-se o que chegou
    const mente = await handleApi(new Request('https://app.x.pt/api/qa/' + id + '/imagem', {
      method: 'PUT', headers: { Authorization: 'Bearer ' + a.token, 'Content-Type': 'image/png' }, body: grande,
    }), env, { waitUntil() {} });
    assert.equal(mente.status, 413);
    assert.equal((await subir(env, a, id, new Uint8Array(0), 'image/png')).status, 400);
  });

  test('ticket inexistente ou removido: 404 a subir e a ver; sem captura: 404', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    assert.equal((await subir(env, a, 'nao-existe', PNG, 'image/png')).status, 404);
    assert.equal(env.FILES.m.size, 0, 'nada no R2');
    const id = (await criar(env, a, { body: 'x' })).id;
    const sem = await resp(pedir(env, a, '/api/qa/' + id + '/imagem'));
    assert.equal(sem.status, 404);
    assert.equal(sem.error, 'Este ticket não tem captura.');
    await subir(env, a, id, PNG, 'image/png');
    await resp(pedir(env, a, '/api/qa/' + id, 'DELETE'));
    assert.equal((await pedir(env, a, '/api/qa/' + id + '/imagem')).status, 404, 'removido não se vê');
    assert.equal((await subir(env, a, id, PNG, 'image/png')).status, 404, 'nem se sobe');
  });
});

/* -------------------------------- o travão ----------------------------- */

describe('o travão', () => {
  test('30 tickets por hora por pessoa; o 31.º é 429 e a outra conta continua', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const b = await conta(env, 'Bruno');
    for (let i = 0; i < 30; i++) assert.equal((await criar(env, a, { body: 't' + i })).status, 201, 'o ' + (i + 1) + '.º');
    const r = await criar(env, a, { body: 'mais um' });
    assert.equal(r.status, 429);
    assert.match(r.error, /Espera um pouco/);
    assert.equal((await criar(env, b, { body: 'do Bruno' })).status, 201);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM qa_tickets WHERE user_id = ?').bind(a.id).first();
    assert.equal(n.n, 30);
  });
});
