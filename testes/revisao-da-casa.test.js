// A revisão de cada casa (migração 0020): duas escritas que leram a mesma
// casa não se esmagam. Prova o trigger houses_revisao contra o SQL a sério
// (testes/lib/bd.js), o gravarCasa e o comCasaFresca, e os três sítios onde
// as escritas se cruzavam: dois comproprietários a sair ao mesmo tempo, duas
// aprovações da mesma proposta, e a ficha gravada a meio de uma saída. Os
// cruzamentos são forçados: os pedidos esperam uns pelos outros à porta da
// escrita, depois de todos terem lido. E confere que nenhuma escrita de
// houses no worker foge ao gravarCasa.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, conta, pedir, resp, casa, comproprietario } from './lib/api.js';
import { gravarCasa, comCasaFresca, casaMudou, FRASE_CASA_MUDOU } from '../worker/src/lib/acesso.js';

/* ------------------------------ armações ------------------------------- */

// Recebe: env; hid — a casa.
// Devolve: a promessa de {data (o JSON lido), rev}.
async function lida(env, hid) {
  const r = await env.DB.prepare('SELECT data, rev FROM houses WHERE id = ?').bind(hid).first();
  return { data: JSON.parse(r.data), rev: r.rev };
}

/* Uma porta à frente das escritas: as primeiras `n` que casem com `padrao`
   esperam umas pelas outras e só então seguem, uma de cada vez (a D1 corre
   os lotes um a um). Assim todos os pedidos leem antes de qualquer um
   gravar — o cruzamento que se quer provar. Conta as recusas do trigger.
   Recebe: env; padrao — regex do SQL das escritas a segurar; n — quantas.
   Devolve: { recusas } — o contador, lido no fim. */
function porta(env, padrao, n = 2) {
  const db = env.DB, prepare = db.prepare.bind(db), batch = db.batch.bind(db);
  let chegados = 0, abrir, fila = Promise.resolve(), noLote = false;
  const aberta = new Promise((r) => { abrir = r; });
  setTimeout(() => abrir(), 1000); // nunca prende um teste
  const conta = { recusas: 0 };
  const espera = async () => { if (chegados < n) { chegados++; if (chegados === n) abrir(); await aberta; } };
  // um de cada vez, como a D1; as recusas contam-se
  const emFila = (fazer) => {
    const vez = fila.then(fazer).catch((e) => { if (casaMudou(e)) conta.recusas++; throw e; });
    fila = vez.catch(() => {});
    return vez;
  };
  db.prepare = (sql) => {
    const q = prepare(sql);
    q._sql = sql;
    const run = q.run.bind(q);
    q.run = async () => {
      if (noLote) return run();
      if (!padrao.test(sql)) return emFila(run);
      await espera();
      // uma escrita condicional que não mexeu em nada também é uma recusa
      const r = await emFila(run);
      if (r && r.meta && r.meta.changes === 0) conta.recusas++;
      return r;
    };
    return q;
  };
  db.batch = async (stmts) => {
    if (stmts.some((s) => padrao.test(s._sql || ''))) await espera();
    return emFila(async () => { noLote = true; try { return await batch(stmts); } finally { noLote = false; } });
  };
  return conta;
}

// Recebe: env; quem; hid.
// Devolve: a promessa de {status, ...} do DELETE /api/houses/:id/participacao.
const sair = (env, quem, hid) => resp(pedir(env, quem, '/api/houses/' + hid + '/participacao', 'DELETE'));

/* A: Alice cria H1 e partilha-a com B e C, a 50/30/20 por proposta aceite.
   Devolve: { env, A, B, C }. */
async function tresDonos() {
  const env = ambiente();
  const A = await conta(env, 'Alice'), B = await conta(env, 'Bruno'), C = await conta(env, 'Carla');
  await casa(env, A, 'H1', { name: 'T2 Benfica' });
  await comproprietario(env, A, B, ['H1']);
  await comproprietario(env, A, C, ['H1']);
  const q = { [A.id]: 50, [B.id]: 30, [C.id]: 20 };
  assert.equal((await resp(pedir(env, A, '/api/houses/H1/proposal', 'POST', { shares: q }))).status, 201);
  assert.equal((await resp(pedir(env, B, '/api/houses/H1/proposal/accept', 'POST', {}))).applied, false);
  assert.equal((await resp(pedir(env, C, '/api/houses/H1/proposal/accept', 'POST', {}))).applied, true);
  assert.deepEqual((await lida(env, 'H1')).data.ownerShares, q);
  return { env, A, B, C };
}

/* ------------------------------ o trigger ------------------------------ */

describe('o trigger houses_revisao', () => {
  test('grava por cima da revisão lida; por cima de uma velha é recusada e o lote desfaz-se', async () => {
    const env = ambiente();
    const A = await conta(env, 'Alice');
    await casa(env, A, 'H1', { name: 'Antes' });
    const r0 = (await lida(env, 'H1')).rev;
    assert.equal(r0, '', 'uma casa nova começa sem revisão');
    await gravarCasa(env, 'H1', r0, { data: JSON.stringify({ name: 'Primeira' }) }, 1).run();
    const r1 = (await lida(env, 'H1')).rev;
    assert.ok(r1 && r1 !== r0, 'a escrita deu uma revisão nova');

    // uma segunda escrita que tinha lido r0: recusada, e o lote todo com ela
    await assert.rejects(env.DB.batch([
      env.DB.prepare("INSERT INTO house_exits (house_id, user_id, created_at) VALUES ('H1', 'X', 1)"),
      gravarCasa(env, 'H1', r0, { data: JSON.stringify({ name: 'Segunda' }) }, 2),
    ]), (e) => casaMudou(e));
    assert.equal((await lida(env, 'H1')).data.name, 'Primeira', 'a segunda não esmagou a primeira');
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM house_exits').first()).n, 0, 'o resto do lote também não ficou');

    await gravarCasa(env, 'H1', r1, { deleted: 1 }, 3).run();
    assert.equal((await env.DB.prepare('SELECT deleted FROM houses WHERE id = ?').bind('H1').first()).deleted, 1);
  });

  test('uma correção à mão, que não mexe na revisão, passa e não a muda', async () => {
    const env = ambiente();
    const A = await conta(env, 'Alice');
    await casa(env, A, 'H1');
    await gravarCasa(env, 'H1', '', { data: '{}' }, 1).run();
    const r = (await lida(env, 'H1')).rev;
    await env.DB.prepare("UPDATE houses SET data = '{\"name\":\"à mão\"}' WHERE id = 'H1'").run();
    assert.equal((await lida(env, 'H1')).rev, r);
  });
});

describe('comCasaFresca', () => {
  test('repete quando a casa mudou, desiste à terceira, e não repete outros erros', async () => {
    let n = 0;
    assert.equal(await comCasaFresca(async () => { if (++n < 2) throw new Error('casa-mudou'); return 'feito'; }), 'feito');
    assert.equal(n, 2);
    n = 0;
    await assert.rejects(comCasaFresca(async () => { n++; throw new Error('casa-mudou'); }), (e) => casaMudou(e));
    assert.equal(n, 3);
    n = 0;
    await assert.rejects(comCasaFresca(async () => { n++; throw new Error('outra coisa'); }), /outra coisa/);
    assert.equal(n, 1);
    assert.match(FRASE_CASA_MUDOU, /Tenta outra vez/);
  });
});

/* ------------------------- os cruzamentos ------------------------------ */

describe('escritas que se cruzam não se esmagam', () => {
  test('dois comproprietários saem ao mesmo tempo: a Alice fica com tudo, e os dois saem', async () => {
    const { env, A, B, C } = await tresDonos();
    const p = porta(env, /UPDATE houses SET/);
    const [rb, rc] = await Promise.all([sair(env, B, 'H1'), sair(env, C, 'H1')]);
    assert.equal(rb.status, 200, JSON.stringify(rb));
    assert.equal(rc.status, 200, JSON.stringify(rc));
    assert.ok(p.recusas >= 1, 'as duas saídas cruzaram-se mesmo (houve ' + p.recusas + ' recusa)');
    const d = (await lida(env, 'H1')).data;
    assert.deepEqual(d.ownerShares, { [A.id]: 100 }, 'sem a revisão, a segunda saída repunha a quota de quem saiu primeiro');
    assert.deepEqual(d.ownerIds, [A.id]);
    const avisos = (await env.DB.prepare("SELECT user_id, actor_id FROM house_events WHERE kind = 'casa.sair' ORDER BY created_at").all()).results;
    assert.ok(avisos.every((e) => e.user_id !== e.actor_id), 'ninguém é avisado da sua própria saída');
    assert.equal(avisos.filter((e) => e.user_id === A.id).length, 2, 'a Alice é avisada das duas');
  });

  test('duas aprovações ao mesmo tempo: nenhuma se perde, e a proposta aplica-se', async () => {
    const env = ambiente();
    const A = await conta(env, 'Alice'), B = await conta(env, 'Bruno'), C = await conta(env, 'Carla');
    await casa(env, A, 'H1');
    await comproprietario(env, A, B, ['H1']);
    await comproprietario(env, A, C, ['H1']);
    const q = { [A.id]: 40, [B.id]: 35, [C.id]: 25 };
    await resp(pedir(env, A, '/api/houses/H1/proposal', 'POST', { shares: q }));
    const p = porta(env, /UPDATE share_proposals SET approvals/);
    const [rb, rc] = await Promise.all([
      resp(pedir(env, B, '/api/houses/H1/proposal/accept', 'POST', {})),
      resp(pedir(env, C, '/api/houses/H1/proposal/accept', 'POST', {})),
    ]);
    assert.equal(rb.status, 200);
    assert.equal(rc.status, 200);
    assert.ok(p.recusas >= 1, 'as duas aprovações cruzaram-se mesmo');
    assert.ok(rb.applied !== rc.applied, 'uma aprovou, a outra (relida) aplicou');
    assert.deepEqual((await lida(env, 'H1')).data.ownerShares, q, 'sem a revisão, uma aprovação perdia-se e a proposta ficava pendente');
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM share_proposals').first()).n, 0);
  });

  test('a ficha gravada a meio de uma saída não repõe a quota de quem saiu', async () => {
    const { env, A, B } = await tresDonos();
    const p = porta(env, /UPDATE houses SET/);
    const ficha = { id: 'H1', name: 'T2 Benfica (renovado)', rooms: [] };
    const [rs, rp] = await Promise.all([
      sair(env, B, 'H1'),
      resp(pedir(env, A, '/api/houses/H1', 'PUT', { data: ficha })),
    ]);
    assert.equal(rs.status, 200, JSON.stringify(rs));
    assert.equal(rp.status, 200, JSON.stringify(rp));
    assert.ok(p.recusas >= 1, 'as duas escritas cruzaram-se mesmo');
    const d = (await lida(env, 'H1')).data;
    assert.equal(d.name, 'T2 Benfica (renovado)', 'a ficha ficou');
    assert.ok(!(B.id in d.ownerShares), 'e a quota do Bruno não voltou: ' + JSON.stringify(d.ownerShares));
    assert.ok(!d.ownerIds.includes(B.id));
  });
});

/* ------------------------- nenhuma escrita foge ------------------------- */

describe('todas as escritas de houses no worker passam pelo gravarCasa', () => {
  test('o único UPDATE houses do worker é o do gravarCasa', () => {
    const achados = [];
    const varre = (pasta) => {
      for (const f of readdirSync(new URL(pasta, import.meta.url), { withFileTypes: true })) {
        const caminho = pasta + f.name + (f.isDirectory() ? '/' : '');
        if (f.isDirectory()) { varre(caminho); continue; }
        if (!f.name.endsWith('.js') || f.name === 'docs-gerados.js') continue;
        const texto = readFileSync(new URL(caminho, import.meta.url), 'utf8');
        for (const m of texto.matchAll(/UPDATE\s+houses\b/gi)) achados.push(caminho + ':' + texto.slice(0, m.index).split('\n').length);
      }
    };
    varre('../worker/src/');
    assert.equal(achados.length, 1, 'escritas de houses: ' + achados.join(', '));
    assert.match(achados[0], /lib\/acesso\.js/);
  });
});
