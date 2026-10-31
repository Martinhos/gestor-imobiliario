// O POST /api/sync em lote: um pedido com N operações gasta as mesmas
// consultas à D1 que um com uma, e cabe com folga no teto de 50 consultas
// por invocação do plano gratuito (ticket de QA a3a6d2d4 — 600 rendas a
// entrar «1 a 1»). E o que cada operação diz que fez (acao) e a contagem
// por kind e por ação (rotas/sync.js:contarOps).
//
// Contra a D1 de teste (testes/lib/bd.js), com as armações de testes/lib/api.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ambiente, conta, casa, registo, sync, pedir, resp, comproprietario, cargo, darCargo,
} from './lib/api.js';
import { prepararEscritas, aplicarOps, aplicarOp } from '../worker/src/lib/escritas.js';
import { contarOps, MAX_OPS } from '../worker/src/rotas/sync.js';
import { handleApi } from '../worker/src/api.js';

/* Embrulha a base num contador como a D1 conta o teto: cada first/all/run
   fora de um lote é uma consulta, e um batch inteiro é UMA («a db.batch()
   call counts as a single query against it, not one query per statement»,
   https://developers.cloudflare.com/d1/platform/limits/).
   Recebe: env.
   Devolve: { n } — o contador, que vai subindo. */
function contar(env) {
  const c = { n: 0 };
  let emLote = false;
  const prepare = env.DB.prepare.bind(env.DB), batch = env.DB.batch.bind(env.DB);
  env.DB.prepare = (sql) => {
    const st = prepare(sql);
    const q = {
      bind(...a) { st.bind(...a); return q; },
      first() { if (!emLote) c.n++; return st.first(); },
      all() { if (!emLote) c.n++; return st.all(); },
      run() { if (!emLote) c.n++; return st.run(); },
    };
    return q;
  };
  env.DB.batch = async (stmts) => {
    c.n++;
    emLote = true;
    try { return await batch(stmts); } finally { emLote = false; }
  };
  return c;
}

// O teto da D1 no plano gratuito, e a folga que se exige abaixo dele.
const TETO = 50;
const FOLGA = 20;

// Um movimento novo da casa H1, como o cliente o manda.
// Recebe: i — o número; extra (opcional) — o que se junta ao data.
// Devolve: a operação.
const tx = (i, extra) => ({
  op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 't' + i,
  data: Object.assign({ id: 't' + i, label: 'Renda ' + i, amount: 500, kind: 'income', date: '2026-01-0' + (1 + (i % 9)), propertyId: 'H1' }, extra || {}),
});

// As linhas de um kind na casa H1.
// Recebe: env; kind.
// Devolve: a promessa do número de linhas vivas.
const quantas = async (env, kind) => (await env.DB.prepare(
  'SELECT COUNT(*) AS n FROM records WHERE house_id = ? AND kind = ? AND deleted = 0'
).bind('H1', kind).first()).n;

/* Mede as consultas de um /api/sync com n operações num cenário novo.
   Recebe: n; montar — async (env) => { quem, ops(n) } o cenário.
   Devolve: a promessa de { consultas, results, env }. */
async function medir(n, montar) {
  const env = ambiente();
  const { quem, ops } = await montar(env);
  const c = contar(env);
  const results = await sync(env, quem, ops(n));
  return { consultas: c.n, results, env };
}

describe('um /api/sync gasta as mesmas consultas com 1 operação e com 200', () => {
  test('o pedaço do cliente é o máximo do servidor (200)', () => {
    assert.equal(MAX_OPS, 200);
  });

  const cenarios = [
    ['a dona cria movimentos', async (env) => {
      const D = await conta(env, 'Dona');
      await casa(env, D, 'H1');
      return { quem: D, ops: (n) => Array.from({ length: n }, (_, i) => tx(i)) };
    }],
    ['a dona edita movimentos que já lá estão, com a base', async (env) => {
      const D = await conta(env, 'Dona');
      await casa(env, D, 'H1');
      for (let i = 0; i < 200; i++) await registo(env, 'H1', 'tx', 't' + i, tx(i).data, D);
      return {
        quem: D,
        ops: (n) => Array.from({ length: n }, (_, i) => Object.assign(tx(i, { label: 'Mudou ' + i }), { base: { label: 'Renda ' + i } })),
      };
    }],
    ['uma comproprietária cria movimentos com anexos', async (env) => {
      const D = await conta(env, 'Dona'), P = await conta(env, 'Partilha');
      await casa(env, D, 'H1');
      await comproprietario(env, D, P, ['H1']);
      return { quem: P, ops: (n) => Array.from({ length: n }, (_, i) => tx(i, { files: [{ id: 'f' + i, name: 'r.pdf' }] })) };
    }],
    ['um colaborador sem «Juntar anexos» edita movimentos que criou', async (env) => {
      const D = await conta(env, 'Dona'), C = await conta(env, 'Contabilista');
      await casa(env, D, 'H1');
      const rid = await cargo(env, D, 'Contabilista', ['tx.view', 'tx.add'], 'R1');
      await darCargo(env, D, C, rid, ['H1']);
      // cada movimento com o seu anexo já preso: editar sem mexer nos anexos passa
      const anexo = (i) => ({ files: [{ id: 'f' + i, name: 'r.pdf' }] });
      for (let i = 0; i < 200; i++) {
        await registo(env, 'H1', 'tx', 't' + i, tx(i, anexo(i)).data, C);
        await env.DB.prepare(
          "INSERT INTO files (id, owner_id, house_id, size, created_at, record_kind, record_id) VALUES (?, ?, 'H1', 1, 1, 'tx', ?)"
        ).bind('f' + i, D.id, 't' + i).run();
      }
      return { quem: C, ops: (n) => Array.from({ length: n }, (_, i) => tx(i, Object.assign({ label: 'Mudou ' + i }, anexo(i)))) };
    }],
    ['a dona apaga movimentos', async (env) => {
      const D = await conta(env, 'Dona');
      await casa(env, D, 'H1');
      for (let i = 0; i < 200; i++) await registo(env, 'H1', 'tx', 't' + i, tx(i).data, D);
      return { quem: D, ops: (n) => Array.from({ length: n }, (_, i) => ({ op: 'del', scope: 'record', houseId: 'H1', kind: 'tx', id: 't' + i })) };
    }],
  ];

  for (const [nome, montar] of cenarios) {
    test(nome + ': o mesmo número de consultas, e abaixo do teto com folga', async () => {
      const um = await medir(1, montar);
      const duzentos = await medir(200, montar);
      assert.ok(um.results.every((r) => r.ok), JSON.stringify(um.results));
      assert.equal(duzentos.results.length, 200);
      assert.ok(duzentos.results.every((r) => r.ok), JSON.stringify(duzentos.results.filter((r) => !r.ok).slice(0, 3)));
      assert.equal(duzentos.consultas, um.consultas,
        'consultas com 1 operação e com 200: ' + um.consultas + ' e ' + duzentos.consultas);
      assert.ok(duzentos.consultas <= TETO - FOLGA, duzentos.consultas + ' consultas (o teto é ' + TETO + ')');
    });
  }

  test('as 200 ficam mesmo gravadas, e os anexos presos a cada registo', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'H1');
    for (let i = 0; i < 200; i++) {
      await env.DB.prepare('INSERT INTO files (id, owner_id, size, created_at) VALUES (?, ?, 1, 1)').bind('f' + i, D.id).run();
    }
    const r = await sync(env, D, Array.from({ length: 200 }, (_, i) => tx(i, { files: [{ id: 'f' + i, name: 'r.pdf' }] })));
    assert.ok(r.every((x) => x.ok));
    assert.equal(await quantas(env, 'tx'), 200);
    const presos = (await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM files WHERE house_id = 'H1' AND record_kind = 'tx' AND record_id = 't' || substr(id, 2)"
    ).first()).n;
    assert.equal(presos, 200, 'cada anexo preso ao seu movimento');
  });

  test('uma casa nova e os seus registos no mesmo pedido: a mesma conta, e os registos entram', async () => {
    const montar = async (env) => {
      const D = await conta(env, 'Dona');
      return {
        quem: D,
        ops: (n) => [{ op: 'put', scope: 'house', houseId: 'H1', data: { id: 'H1', name: 'T2', rooms: [] } }]
          .concat(Array.from({ length: n - 1 }, (_, i) => tx(i))),
      };
    };
    const dois = await medir(2, montar);
    const duzentos = await medir(200, montar);
    assert.ok(duzentos.results.every((r) => r.ok));
    assert.equal(await quantas(duzentos.env, 'tx'), 199);
    assert.equal(duzentos.consultas, dois.consultas);
    assert.ok(duzentos.consultas <= TETO - FOLGA, duzentos.consultas + ' consultas');
  });

  test('um lote que falha a meio: cada operação vai sozinha, e só a má é 500', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'H1');
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => {
      const st = prepare(sql);
      if (!/^\s*INSERT INTO records/.test(sql)) return st;
      const bind = st.bind.bind(st);
      st.bind = (...a) => {
        const b = bind(...a), run = b.run.bind(b);
        b.run = async () => { if (a[2] === 't1') throw new Error('D1 recusou esta'); return run(); };
        return b;
      };
      return st;
    };
    const r = await sync(env, D, [tx(0), tx(1), tx(2)]);
    env.DB.prepare = prepare;
    assert.deepEqual(r.map((x) => x.ok), [true, false, true]);
    assert.equal(r[1].status, 500);
    assert.ok(!('_erro' in r[1]), 'a exceção não sai para o cliente');
    assert.equal(await quantas(env, 'tx'), 2);
  });
});

describe('o que cada operação fez (acao) e a contagem do pedido (contarOps)', () => {
  test('criado, editado, removido; igual, gone e recusas não contam', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'H0');
    await registo(env, 'H0', 'contract', 'c1', { name: 'Velho', start: '2025-01-01' }, D);
    const e = await prepararEscritas(env, D);
    const r = await aplicarOps(e, [
      { op: 'put', scope: 'house', houseId: 'H1', data: { id: 'H1', name: 'Nova', rooms: [] } },
      tx(1), tx(2),
      { op: 'put', scope: 'record', houseId: 'H0', kind: 'contract', id: 'c1', data: { id: 'c1', name: 'Novo', start: '2025-01-01' } },
      { op: 'put', scope: 'user', kind: 'tx', id: 'u1', data: { id: 'u1', label: 'Café', amount: 2 } },
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'tx', id: 'nunca' },
      { op: 'put', scope: 'record', houseId: 'NAO', kind: 'tx', id: 'x', data: { id: 'x' } },
      { op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'mau id!', data: {} },
    ]);
    assert.deepEqual(r[0], { ok: true, acao: 'criado', scope: 'house', kind: 'house' });
    assert.deepEqual(r[1], { ok: true, acao: 'criado', scope: 'record', kind: 'tx' });
    assert.deepEqual(r[3], { ok: true, acao: 'editado', scope: 'record', kind: 'contract' });
    assert.deepEqual(r[4], { ok: true, acao: 'criado', scope: 'user', kind: 'tx' });
    assert.deepEqual(r[5], { ok: true, gone: true });
    assert.equal(r[6].status, 403);
    assert.equal(r[7].status, 400);
    // o mesmo outra vez: nada muda, e nada conta
    const igual = await aplicarOps(await prepararEscritas(env, D), [tx(1)]);
    assert.equal(igual[0].igual, true);
    const apagar = await aplicarOps(await prepararEscritas(env, D), [
      { op: 'del', scope: 'record', houseId: 'H1', kind: 'tx', id: 't2' },
      { op: 'del', scope: 'house', houseId: 'H0' },
    ]);
    assert.deepEqual(apagar[0], { ok: true, acao: 'removido', scope: 'record', kind: 'tx' });
    assert.deepEqual(apagar[1], { ok: true, acao: 'removido', scope: 'house', kind: 'house' });

    assert.deepEqual(contarOps(r.concat(igual, apagar)), {
      house: { criado: 1, removido: 1 },
      tx: { criado: 3, removido: 1 },
      contract: { editado: 1 },
    });
    assert.deepEqual(contarOps([]), {});
    assert.deepEqual(contarOps(null), {});
    assert.deepEqual(contarOps([null, { ok: false, status: 403 }, { ok: true }]), {});
  });

  test('quem lê {ok:true} continua a ler: a resposta do sync e a do REST têm a forma de sempre', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'H1');
    assert.deepEqual(await sync(env, D, [tx(1)]), [{ ok: true }]);
    const rest = await resp(pedir(env, D, '/api/houses/H1/records/tx/t2', 'PUT', { data: tx(2).data }));
    assert.equal(rest.status, 200);
    assert.equal(rest.ok, true);
    assert.ok(!('acao' in rest));
    // e a aplicarOp de uma operação só diz o mesmo que a de muitas
    assert.deepEqual(await aplicarOp(await prepararEscritas(env, D), tx(3)), { ok: true, acao: 'criado', scope: 'record', kind: 'tx' });
  });
});

describe('o que um /api/sync mudou vai para o rasto de quem o consentiu', () => {
  /* Um POST /api/sync com o contexto de execução a guardar as promessas do
     waitUntil, para se esperar pelo que a rota deixa a correr depois de
     responder.
     Recebe: env; quem; ops; headers (opcional).
     Devolve: a promessa de { results, esperar } — esperar() resolve quando
     as promessas do waitUntil acabaram. */
  async function syncComCtx(env, quem, ops, headers) {
    const pendentes = [];
    const ctx = { waitUntil(p) { pendentes.push(p); } };
    const h = Object.assign({ Authorization: 'Bearer ' + quem.token, 'Content-Type': 'application/json' }, headers || {});
    const r = await handleApi(new Request('https://app.x.pt/api/sync', { method: 'POST', headers: h, body: JSON.stringify({ ops }) }), env, ctx);
    return { results: (await r.json()).results, esperar: () => Promise.all(pendentes) };
  }
  const eventos = async (env) => (await env.DB.prepare("SELECT sessao, alvo FROM rasto_eventos WHERE tipo = 'dados'").all()).results;

  test('com «sim», um evento de dados por pedido, com as contagens por tipo e a sessão da app', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'H1');
    await env.DB.prepare("UPDATE users SET rasto_escolha = 'sim' WHERE id = ?").bind(D.id).run();
    const { results, esperar } = await syncComCtx(env, D, [tx(1), tx(2), tx(3)], { 'X-Rasto-Sessao': 's-abcdefghij' });
    assert.ok(results.every((r) => r.ok));
    await esperar();
    const ev = await eventos(env);
    assert.equal(ev.length, 1);
    assert.equal(ev[0].alvo, 'dados:tx+3');
    assert.equal(ev[0].sessao, 's-abcdefghij');
  });

  test('sem «sim», nada', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'H1');
    const { esperar } = await syncComCtx(env, D, [tx(1)]);
    await esperar();
    assert.equal((await eventos(env)).length, 0);
  });
});
