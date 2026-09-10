// O que o worker mede sobre si próprio, e o batimento que dá para fora.
//
// Três coisas que o resumo diário não respondia: «esta assinatura de erro
// está a piorar?», «que rota demora ou falha mais?» e «qual é a consulta que
// come as linhas da D1?». E uma que ninguém respondia: «o cron morreu?» —
// porque quem detetava a ausência de linhas no op_log era o próprio cron.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { rotaGenerica, medirPedido, medirRelato, pulsar } from '../worker/src/lib/medidas.js';
import { textoDasConsultas, consultasPesadas } from '../worker/src/notify.js';

const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// Corre `f` com o fetch global substituído por `falso`, e repõe-o no fim.
// Recebe: falso — a função que faz de fetch; f — o que correr entretanto.
// Devolve: Promise com o que f devolver.
async function comFetch(falso, f) {
  const antes = globalThis.fetch;
  globalThis.fetch = falso;
  try { return await f(); } finally { globalThis.fetch = antes; }
}

// uma ligação de faz-de-conta que guarda os pontos que lhe escrevem
const ligacao = () => { const pontos = []; return { pontos, writeDataPoint: (p) => pontos.push(p) }; };

describe('a rota genérica', () => {
  test('os ids, os tokens e os números viram marcadores', () => {
    assert.equal(rotaGenerica('/api/convite/' + 'a'.repeat(64)), '/api/convite/:token');
    assert.equal(rotaGenerica('/api/casas/3f2a1c0e-9b8d-4e7f-a6b5-c4d3e2f1a0b9/registos'), '/api/casas/:id/registos');
    assert.equal(rotaGenerica('/api/tickets/42'), '/api/tickets/:n');
    assert.equal(rotaGenerica('/api/me'), '/api/me', 'o que não tem valor fica como está');
  });

  test('cabe num índice do Analytics Engine, que tem 96 bytes de tecto', () => {
    assert.ok(rotaGenerica('/api/' + 'x'.repeat(300)).length <= 96);
  });
});

describe('os pontos', () => {
  test('um pedido dá um ponto com a rota genérica, nunca o caminho tal e qual', () => {
    const m = ligacao();
    medirPedido({ MEDIDAS: m }, 'GET', '/api/ligar/' + 'b'.repeat(64), 200, 37);
    assert.equal(m.pontos.length, 1);
    const p = m.pontos[0];
    assert.deepEqual(p.blobs, ['pedido', 'GET', '/api/ligar/:token', '200']);
    assert.deepEqual(p.doubles, [37]);
    assert.deepEqual(p.indexes, ['/api/ligar/:token'], 'um índice só — mais do que um e o ponto não é gravado');
    assert.ok(!JSON.stringify(p).includes('b'.repeat(64)), 'o token não vai');
  });

  test('um relato dá um ponto com a categoria e a assinatura', () => {
    const m = ligacao();
    medirRelato({ MEDIDAS: m }, 'server', 'server:Falhou a cópia');
    assert.deepEqual(m.pontos[0].blobs, ['relato', 'server', 'server:Falhou a cópia']);
    assert.deepEqual(m.pontos[0].doubles, [1]);
    assert.ok(m.pontos[0].indexes[0].length <= 96);
  });

  test('sem ligação não faz nada, e uma ligação que rebenta não parte o pedido', () => {
    assert.doesNotThrow(() => medirPedido({}, 'GET', '/api/me', 200, 1));
    assert.doesNotThrow(() => medirPedido({ MEDIDAS: { writeDataPoint() { throw new Error('quota'); } } }, 'GET', '/api/me', 200, 1));
  });

  test('cada relato e cada pedido à API deixam um ponto', () => {
    assert.match(ler('worker/src/lib/relatos.js'), /medirRelato\(env, categoria, fp\)/);
    const idx = ler('worker/src/index.js');
    assert.match(idx, /medirPedido\(env, request\.method, url\.pathname, res\.status, Date\.now\(\) - t0\)/, 'o pedido que correu');
    assert.match(idx, /medirPedido\(env, request\.method, url\.pathname, 500, Date\.now\(\) - t0\)/, 'e o que rebentou');
  });

  /* A ligação ao Analytics Engine está à espera de ser ligada no painel da conta
     (wrangler.toml); até lá o código é inerte, e é isso que o teste acima guarda.
     O teste da ligação nos dois ambientes volta com ela. */
});

describe('as consultas mais pesadas', () => {
  test('uma linha por consulta, com as linhas lidas e as vezes, e a consulta cortada', () => {
    const t = textoDasConsultas([
      { consulta: 'SELECT * FROM records   WHERE house_id = ? AND deleted = 0 ORDER BY updated_at DESC LIMIT 500', linhas: 123456, vezes: 87 },
      { consulta: 'SELECT COUNT(*) FROM users', linhas: 12, vezes: 1 },
    ]);
    const linhas = t.split('\n');
    assert.equal(linhas.length, 2);
    assert.match(linhas[0], /^`123[\s .]456` · 87× · SELECT \* FROM records WHERE/, 'espaços a mais somem');
    assert.ok(linhas[0].endsWith('…') && linhas[0].length < 110, 'a consulta é cortada');
    assert.match(linhas[1], /`12` · 1× · SELECT COUNT\(\*\) FROM users$/);
  });

  test('sem consultas fica um traço, e sem resposta a secção nem entra', () => {
    assert.equal(textoDasConsultas([]), '—');
    assert.equal(textoDasConsultas(null), '—');
    assert.match(ler('worker/src/notify.js'), /if \(pesadas && pesadas\.length\) \{/, 'o resumo só a mostra quando há');
  });

  const env = { CF_ANALYTICS_TOKEN: 't', CF_ACCOUNT_ID: 'a' };
  const resposta = (corpo) => async () => ({ json: async () => corpo });

  test('sem token nem conta não pergunta nada', async () => {
    assert.equal(await consultasPesadas({}), null);
  });

  test('pede as cinco mais pesadas, pela forma que o wrangler também usa, e traduz a resposta', async () => {
    let pedido = null;
    const lista = await comFetch(async (url, opts) => {
      pedido = JSON.parse(opts.body);
      return { json: async () => ({ data: { viewer: { accounts: [{ d1QueriesAdaptiveGroups: [
        { dimensions: { query: 'SELECT * FROM records' }, sum: { rowsRead: 900 }, count: 3 },
        { dimensions: { query: 'SELECT 1' }, sum: { rowsRead: 1 }, count: 1 },
      ] }] } } }) };
    }, () => consultasPesadas(env));
    assert.match(pedido.query, /d1QueriesAdaptiveGroups\(limit:5/, 'cinco');
    assert.match(pedido.query, /orderBy:\[sum_rowsRead_DESC\]/, 'as que mais leram primeiro');
    assert.match(pedido.query, /dimensions\{ query \}/, 'com a consulta');
    assert.deepEqual(lista, [
      { consulta: 'SELECT * FROM records', linhas: 900, vezes: 3 },
      { consulta: 'SELECT 1', linhas: 1, vezes: 1 },
    ]);
  });

  test('uma resposta que não se entende, ou que não chega, dá null — nunca rebenta o resumo', async () => {
    assert.equal(await comFetch(resposta({ errors: ['x'] }), () => consultasPesadas(env)), null, 'sem data');
    assert.equal(await comFetch(resposta({ data: { viewer: { accounts: [{}] } } }), () => consultasPesadas(env)), null, 'sem o conjunto');
    assert.equal(await comFetch(async () => { throw new Error('sem rede'); }, () => consultasPesadas(env)), null, 'sem rede');
    const semCampos = await comFetch(resposta({ data: { viewer: { accounts: [{ d1QueriesAdaptiveGroups: [{}] }] } } }),
      () => consultasPesadas(env));
    assert.deepEqual(semCampos, [{ consulta: '', linhas: 0, vezes: 0 }], 'campos em falta não partem a tradução');
  });
});

/* O batimento só bate depois de o trabalho ter corrido bem. Um batimento que
   batesse à entrada era o alarme a mentir: o cron acordou, mas o que ele
   devia fazer ficou por fazer. */
describe('o batimento para fora', () => {
  test('sem URL não bate, e não rejeita', async () => {
    assert.equal(await pulsar(''), false);
    assert.equal(await pulsar(undefined), false);
  });

  test('com URL faz um GET, e diz se o serviço aceitou', async () => {
    let visto = null;
    assert.equal(await comFetch(async (url, opts) => { visto = { url, metodo: opts.method }; return { ok: true }; },
      () => pulsar('https://batimento.local/x')), true);
    assert.deepEqual(visto, { url: 'https://batimento.local/x', metodo: 'GET' });
    assert.equal(await comFetch(async () => ({ ok: false }), () => pulsar('https://batimento.local/x')), false, 'resposta má');
    assert.equal(await comFetch(async () => { throw new Error('sem rede'); }, () => pulsar('https://batimento.local/x')), false, 'sem rede');
  });

  test('bate depois da vigia, e só se ela correu', () => {
    const idx = ler('worker/src/index.js');
    const hora = idx.slice(idx.indexOf('if (!diario) {'), idx.indexOf('return;', idx.indexOf('if (!diario) {')));
    assert.ok(hora.indexOf("registarOp(env, 'vigia', true)") < hora.indexOf('pulsar(env.HEARTBEAT_URL)'),
      'depois de a vigia ficar registada como verde');
    assert.ok(hora.indexOf('pulsar(env.HEARTBEAT_URL)') < hora.indexOf('} catch (e) {'),
      'dentro do try — se a vigia rebentar, não bate');
  });

  test('o do dia bate só com a cópia feita e o resumo entregue', () => {
    const idx = ler('worker/src/index.js');
    assert.match(idx, /if \(copiaOk && entregue !== false\) await pulsar\(env\.HEARTBEAT_COPIA_URL\);/);
  });
});
