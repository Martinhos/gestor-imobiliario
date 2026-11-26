// Os modelos de dados do Lab (KAN-167) — o servidor, contra o SQL a sério
// (testes/lib/bd.js) com a migração 0035. Prova que em produção (sem
// ENV_NAME, ou com o 'producao') as rotas /api/modelos e /api/equipa/modelos
// respondem 404; que a lista semeia os de base uma vez por pessoa, e que a
// pessoa é a do Discord por trás das contas de teste (duas contas de teste
// do mesmo dono veem os mesmos modelos; uma conta normal tem os seus);
// renomear, reordenar, gravar a conta como modelo, remover (os de base não) e
// repor; e o centro de tudo, substituir os dados: recusado numa conta normal
// do dev (403, e os dados ficam), sem a confirmação (400), com um modelo de
// outra pessoa (404) ou com entidades que não se conferem (400, e nada
// muda); numa conta de teste troca as casas, os registos e os dados globais
// pelos do modelo, com ids novos nas casas, a conta de origem trocada pela de
// agora, o perfil por cima e as casas de outras contas intactas; e é atómico
// (um lote que falha a meio deixa a conta como estava).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ambiente, conta, pedir, resp, casa, registo, dadoGlobal } from './lib/api.js';
import {
  baseDoPedido, conferirEntidades, remapear, resumoDe, nomeValido, ambienteDeTeste, CONFIRMAR, rotasModelosDaEquipa,
} from '../worker/src/rotas/modelos.js';

/* ------------------------------ armações ------------------------------- */

const BASE = ['exemplo', 'vazio', 'prejuizo'];

// Recebe: env; quem — a conta; base (opcional) — os ids dos cenários.
// Devolve: a promessa da lista dos modelos.
const listar = async (env, quem, base = BASE) =>
  (await resp(pedir(env, quem, '/api/modelos?base=' + base.join(',')))).modelos;

/* Passa uma conta a conta de teste (o email do /test e o dono do Discord).
   Recebe: env; quem — a conta; dono — o id do Discord (ou null).
   Devolve: a mesma conta, com o email novo. */
async function deTeste(env, quem, dono) {
  const email = quem.id.toLowerCase() + '@teste.rendorium.com';
  await env.DB.prepare('UPDATE users SET email = ?, test_owner = ? WHERE id = ?').bind(email, dono, quem.id).run();
  return Object.assign({}, quem, { email });
}

// Recebe: env; uid. Devolve: a promessa das casas vivas da conta (id, data).
const casasDe = async (env, uid) => (await env.DB.prepare('SELECT id, data FROM houses WHERE owner_id = ? ORDER BY id').bind(uid).all()).results;
// Recebe: env; houseId. Devolve: a promessa dos registos da casa.
const registosDe = async (env, h) => (await env.DB.prepare('SELECT kind, id, data, author FROM records WHERE house_id = ? ORDER BY kind, id').bind(h).all()).results;
// Recebe: env; uid. Devolve: a promessa dos dados globais da conta.
const globaisDe = async (env, uid) => (await env.DB.prepare('SELECT kind, id, data FROM user_records WHERE user_id = ? ORDER BY kind, id').bind(uid).all()).results;

/* Uma conta com dados: uma casa com um contrato e um movimento, um
   movimento sem casa, as definições e o perfil.
   Recebe: env; quem — a conta; h — o id da casa.
   Devolve: a promessa de nada. */
async function comDados(env, quem, h) {
  await casa(env, quem, h, { id: h, name: 'Casa de ' + quem.name, ownerIds: [quem.id] });
  await registo(env, h, 'contract', 'c-' + h, { id: 'c-' + h, propertyId: h, rent: 500 }, quem.id);
  await registo(env, h, 'tx', 't-' + h, { id: 't-' + h, propertyId: h, amount: 500, paidBy: quem.id }, quem.id);
  await dadoGlobal(env, quem, 'tx', 'solto-' + h, { id: 'solto-' + h, amount: 9 });
  await dadoGlobal(env, quem, 'settings', 'main', { cor: 'antiga' });
  await dadoGlobal(env, quem, 'profile', 'main', { id: quem.id, name: quem.name, nif: '' });
}

/* As entidades de um cenário, como o cliente as manda (cloud/modelos.js:mdlEntidadesDoCenario).
   Recebe: uid — a conta que o recebe.
   Devolve: a lista. */
function cenario(uid) {
  return [
    { scope: 'house', houseId: 'casa-nova', data: { id: 'casa-nova', name: 'T2 do modelo', ownerIds: [uid] } },
    { scope: 'record', houseId: 'casa-nova', kind: 'contract', id: 'ct1', data: { id: 'ct1', propertyId: 'casa-nova', rent: 750 } },
    { scope: 'record', houseId: 'casa-nova', kind: 'tx', id: 'tx1', data: { id: 'tx1', propertyId: 'casa-nova', amount: 750 } },
    { scope: 'user', kind: 'settings', id: 'main', data: { cor: 'nova' } },
    { scope: 'user', kind: 'profile', id: 'main', data: { id: uid, name: 'Eu', nif: '210000007' } },
  ];
}

/* ------------------------------- produção ------------------------------ */

describe('os modelos só existem fora de produção', () => {
  test('sem ENV_NAME, ou com o producao, todas as rotas dão 404', async () => {
    for (const ENV_NAME of [undefined, 'producao']) {
      const env = ambiente({ ENV_NAME });
      const eu = await conta(env, 'Ana');
      for (const [p, m, c] of [['/api/modelos', 'GET'], ['/api/modelos', 'POST', { nome: 'x' }], ['/api/modelos/ordem', 'PUT', { ids: [] }],
        ['/api/modelos/abc', 'PATCH', { nome: 'x' }], ['/api/modelos/abc', 'DELETE'], ['/api/modelos/abc/usar', 'POST', { confirmar: CONFIRMAR }]]) {
        assert.equal((await resp(pedir(env, eu, p, m, c))).status, 404, m + ' ' + p + ' com ENV_NAME ' + ENV_NAME);
      }
      const r = await rotasModelosDaEquipa({ env, path: '/api/equipa/modelos', method: 'GET', seg: [], eu: { discordId: '1' } });
      assert.equal(r.status, 404);
      assert.equal(ambienteDeTeste(env), false);
    }
    assert.equal(ambienteDeTeste({ ENV_NAME: 'dev' }), true);
  });
});

/* -------------------------- a lista e o dono --------------------------- */

describe('a lista, os de base e a pessoa', () => {
  test('o GET semeia os de base uma vez, pela ordem, e a pessoa é a do Discord', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '111');
    const b = await deTeste(env, await conta(env, 'B'), '111');
    const c = await conta(env, 'Normal');
    const l1 = await listar(env, a);
    assert.deepEqual(l1.map((m) => m.cenario), BASE);
    assert.ok(l1.every((m) => m.origem === 'base' && m.tipo === 'cenario' && m.nome === null));
    assert.deepEqual(l1.map((m) => m.ordem), [0, 1, 2]);
    // de novo, e da outra conta de teste do mesmo dono: os mesmos, sem duplicar
    const l2 = await listar(env, b);
    assert.deepEqual(l2.map((m) => m.id), l1.map((m) => m.id));
    // um cenário novo no código entra no fim
    const l3 = await listar(env, a, BASE.concat(['reducao']));
    assert.deepEqual(l3.map((m) => m.cenario), BASE.concat(['reducao']));
    // a conta normal tem os seus
    const l4 = await listar(env, c);
    assert.equal(l4.length, 3);
    assert.ok(l4.every((m) => !l1.some((x) => x.id === m.id)));
    const donos = (await env.DB.prepare('SELECT DISTINCT dono FROM qa_modelos ORDER BY dono').all()).results.map((r) => r.dono);
    assert.deepEqual(donos, ['conta:' + c.id, 'discord:111']);
  });

  test('um cenário que a pessoa já tem por um ticket não nasce outra vez como de base', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '333');
    await env.DB.prepare("INSERT INTO qa_modelos (id, dono, ordem, tipo, cenario, origem, ticket, criado_em, atualizado_em) VALUES ('t1', 'discord:333', 0, 'cenario', 'vazio', 'ticket', 'KAN-9', 1, 1)").run();
    const l = await listar(env, a);
    assert.deepEqual(l.map((m) => m.cenario + ':' + m.origem), ['vazio:ticket', 'exemplo:base', 'prejuizo:base']);
    assert.equal(l[0].ticket, 'KAN-9');
  });

  test('o ?base= só aceita ids com a forma de um cenário, sem repetidos', () => {
    const u = (q) => new URL('https://x/api/modelos?base=' + q);
    assert.deepEqual(baseDoPedido(u('a,b,a, c ,X,../x,')), ['a', 'b', 'c']);
    assert.deepEqual(baseDoPedido(new URL('https://x/api/modelos')), []);
  });

  test('o back office tem os modelos da pessoa da equipa (os mesmos da conta de teste dela)', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '222');
    const ids = (await listar(env, a)).map((m) => m.id);
    const r = await rotasModelosDaEquipa({ env, path: '/api/equipa/modelos', method: 'GET', url: new URL('https://x/api/equipa/modelos'), eu: { discordId: '222' } });
    assert.deepEqual((await r.json()).modelos.map((m) => m.id), ids);
    // gravar e usar pedem uma conta
    const g = await rotasModelosDaEquipa({ env, path: '/api/equipa/modelos', method: 'POST', request: new Request('https://x', { method: 'POST', body: '{"nome":"x"}' }), eu: { discordId: '222' } });
    assert.equal(g.status, 403);
    const u = await rotasModelosDaEquipa({ env, path: '/api/equipa/modelos/' + ids[0] + '/usar', method: 'POST', request: new Request('https://x', { method: 'POST', body: '{}' }), eu: { discordId: '222' } });
    assert.equal(u.status, 403);
  });
});

/* -------------------------- renomear, ordenar -------------------------- */

describe('renomear, ordenar, remover e repor', () => {
  test('renomear muda o nome da pessoa e recusa o vazio, o comprido e o modelo de outro', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    const b = await deTeste(env, await conta(env, 'B'), '2');
    const [m] = await listar(env, a);
    const r = await resp(pedir(env, a, '/api/modelos/' + m.id, 'PATCH', { nome: '  IRS\ncom prejuízo  ' }));
    assert.equal(r.status, 200);
    assert.equal(r.modelo.nome, 'IRS com prejuízo');
    assert.equal((await listar(env, a))[0].nome, 'IRS com prejuízo');
    assert.equal((await resp(pedir(env, a, '/api/modelos/' + m.id, 'PATCH', { nome: '   ' }))).status, 400);
    assert.equal((await resp(pedir(env, a, '/api/modelos/' + m.id, 'PATCH', { nome: 'x'.repeat(81) }))).status, 400);
    assert.equal((await resp(pedir(env, b, '/api/modelos/' + m.id, 'PATCH', { nome: 'meu' }))).status, 404);
    assert.equal(nomeValido(5), null);
  });

  test('reordenar guarda a ordem nova, com os ids que faltam no fim e os de outro de fora', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    const b = await deTeste(env, await conta(env, 'B'), '2');
    const ids = (await listar(env, a)).map((m) => m.id);
    const deB = (await listar(env, b))[0].id;
    const r = await resp(pedir(env, a, '/api/modelos/ordem', 'PUT', { ids: [ids[2], deB, ids[0]] }));
    assert.equal(r.status, 200);
    assert.deepEqual(r.modelos.map((m) => m.id), [ids[2], ids[0], ids[1]]);
    assert.deepEqual((await listar(env, a)).map((m) => m.id), [ids[2], ids[0], ids[1]]);
    assert.equal((await listar(env, b))[0].id, deB, 'o de B ficou onde estava');
    assert.equal((await resp(pedir(env, a, '/api/modelos/ordem', 'PUT', { ids: ['ma"u'] }))).status, 400);
  });

  test('os de base não se removem; um gravado sai, volta com o repor, e passadas 24 h apaga-se de vez', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    const [base] = await listar(env, a);
    assert.equal((await resp(pedir(env, a, '/api/modelos/' + base.id, 'DELETE'))).status, 403);
    const g = (await resp(pedir(env, a, '/api/modelos', 'POST', { nome: 'Meu' }))).modelo;
    assert.equal((await resp(pedir(env, a, '/api/modelos/' + g.id, 'DELETE'))).status, 200);
    assert.ok(!(await listar(env, a)).some((m) => m.id === g.id));
    assert.equal((await resp(pedir(env, a, '/api/modelos/' + g.id + '/repor', 'POST'))).status, 200);
    assert.ok((await listar(env, a)).some((m) => m.id === g.id));
    await resp(pedir(env, a, '/api/modelos/' + g.id, 'DELETE'));
    await env.DB.prepare('UPDATE qa_modelos SET removido_em = ? WHERE id = ?').bind(Date.now() - 25 * 3600 * 1000, g.id).run();
    assert.equal((await resp(pedir(env, a, '/api/modelos/' + g.id + '/repor', 'POST'))).status, 404);
    await listar(env, a);
    assert.equal(await env.DB.prepare('SELECT id FROM qa_modelos WHERE id = ?').bind(g.id).first(), null);
  });
});

/* ------------------------------- gravar -------------------------------- */

describe('gravar a conta como modelo', () => {
  test('grava as casas, os registos e os dados globais vivos, sem o perfil, com o resumo', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    await comDados(env, a, 'h-a');
    await casa(env, a, 'h-apagada', { id: 'h-apagada', name: 'Apagada' }, 1);
    await dadoGlobal(env, a, 'owner', 'o-antigo', { name: 'do modelo antigo' });   // um kind que a app já não escreve não vai
    const r = await resp(pedir(env, a, '/api/modelos', 'POST', { nome: 'A com dados' }));
    assert.equal(r.status, 201);
    assert.equal(r.modelo.tipo, 'dados');
    assert.equal(r.modelo.origem, 'pessoa');
    assert.deepEqual(r.modelo.resumo, { imoveis: 1, contratos: 1, pessoas: 0, movimentos: 2, planeados: 0 });
    const linha = await env.DB.prepare('SELECT dados FROM qa_modelos WHERE id = ?').bind(r.modelo.id).first();
    const d = JSON.parse(linha.dados);
    assert.equal(d.conta, a.id);
    assert.deepEqual(d.entidades.map((e) => e.scope + ':' + (e.kind || '') + ':' + (e.id || e.houseId)).sort(),
      ['house::h-a', 'record:contract:c-h-a', 'record:tx:t-h-a', 'user:settings:main', 'user:tx:solto-h-a'].sort());
    assert.equal((await resp(pedir(env, a, '/api/modelos', 'POST', { nome: '' }))).status, 400);
  });

  test('uma conta grande vai para o R2 e volta a ler-se ao usar', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    await casa(env, a, 'h-g', { id: 'h-g', name: 'Grande', notas: 'x'.repeat(200 * 1024) });
    for (let i = 0; i < 3; i++) await registo(env, 'h-g', 'tx', 't' + i, { id: 't' + i, propertyId: 'h-g', n: 'y'.repeat(30 * 1024) }, a.id);
    const g = (await resp(pedir(env, a, '/api/modelos', 'POST', { nome: 'Grande' }))).modelo;
    const linha = await env.DB.prepare('SELECT dados, dados_r2 FROM qa_modelos WHERE id = ?').bind(g.id).first();
    assert.equal(linha.dados, null);
    assert.equal(linha.dados_r2, 'modelos/' + g.id);
    const b = await deTeste(env, await conta(env, 'B'), '1');
    const u = await resp(pedir(env, b, '/api/modelos/' + g.id + '/usar', 'POST', { confirmar: CONFIRMAR }));
    assert.equal(u.status, 200);
    assert.equal(u.resumo.movimentos, 3);
    assert.equal((await casasDe(env, b.id)).length, 1);
  });
});

/* -------------------------------- usar --------------------------------- */

describe('substituir os dados: só numa conta de teste, com confirmação, e de uma vez', () => {
  test('numa conta normal do dev é 403, e os dados ficam', async () => {
    const env = ambiente();
    const c = await conta(env, 'Normal');
    await comDados(env, c, 'h-n');
    const [m] = await listar(env, c);
    const r = await resp(pedir(env, c, '/api/modelos/' + m.id + '/usar', 'POST', { confirmar: CONFIRMAR, entidades: cenario(c.id) }));
    assert.equal(r.status, 403);
    assert.equal(r.erro, 'so_contas_de_teste');
    assert.deepEqual((await casasDe(env, c.id)).map((h) => h.id), ['h-n']);
    assert.equal((await registosDe(env, 'h-n')).length, 2);
  });

  test('sem a confirmação é 400; o modelo de outra pessoa é 404; entidades que não se conferem são 400 — e nada muda', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    const b = await deTeste(env, await conta(env, 'B'), '2');
    await comDados(env, a, 'h-a');
    const [m] = await listar(env, a);
    const [deB] = await listar(env, b);
    const usar = (id, corpo) => resp(pedir(env, a, '/api/modelos/' + id + '/usar', 'POST', corpo));
    assert.equal((await usar(m.id, { entidades: cenario(a.id) })).status, 400);
    assert.equal((await usar(m.id, { confirmar: 'sim', entidades: cenario(a.id) })).status, 400);
    assert.equal((await usar(deB.id, { confirmar: CONFIRMAR, entidades: cenario(a.id) })).status, 404);
    const orfao = cenario(a.id).concat([{ scope: 'record', houseId: 'outra', kind: 'tx', id: 'x', data: { id: 'x' } }]);
    assert.equal((await usar(m.id, { confirmar: CONFIRMAR, entidades: orfao })).status, 400);
    assert.equal((await usar(m.id, { confirmar: CONFIRMAR, entidades: [{ scope: 'record', houseId: 'casa-nova', kind: 'nada', id: 'x', data: {} }] })).status, 400);
    assert.deepEqual((await casasDe(env, a.id)).map((h) => h.id), ['h-a']);
    assert.equal(JSON.parse((await globaisDe(env, a.id)).find((g) => g.kind === 'settings').data).cor, 'antiga');
  });

  test('um cenário troca as casas, os registos e os dados globais, com ids novos nas casas, e deixa as casas dos outros', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    const outro = await conta(env, 'Outro');
    await comDados(env, a, 'h-a');
    await comDados(env, outro, 'h-o');
    await registo(env, 'h-a', 'tx', 'apagado', { id: 'apagado' }, a.id);
    await env.DB.prepare("INSERT INTO files (id, owner_id, house_id, created_at) VALUES ('f1', ?, 'h-a', 1)").bind(a.id).run();
    await env.FILES.put('f1', new Uint8Array([1, 2, 3]));
    const [m] = await listar(env, a);
    const r = await resp(pedir(env, a, '/api/modelos/' + m.id + '/usar', 'POST', { confirmar: CONFIRMAR, entidades: cenario(a.id) }));
    assert.equal(r.status, 200);
    assert.deepEqual(r.resumo, { imoveis: 1, contratos: 1, pessoas: 0, movimentos: 1, planeados: 0 });
    const casas = await casasDe(env, a.id);
    assert.equal(casas.length, 1);
    const h = casas[0].id;
    assert.notEqual(h, 'casa-nova', 'a casa nasce com um id novo');
    assert.equal(JSON.parse(casas[0].data).id, h);
    assert.equal(JSON.parse(casas[0].data).name, 'T2 do modelo');
    const regs = await registosDe(env, h);
    assert.deepEqual(regs.map((x) => x.kind + ':' + x.id), ['contract:ct1', 'tx:tx1']);
    assert.equal(JSON.parse(regs[0].data).propertyId, h, 'as referências à casa seguem o id novo');
    assert.ok(regs.every((x) => x.author === a.id));
    assert.equal((await registosDe(env, 'h-a')).length, 0, 'os registos da casa velha saíram');
    const globais = await globaisDe(env, a.id);
    assert.deepEqual(globais.map((g) => g.kind + ':' + g.id), ['profile:main', 'settings:main']);
    assert.equal(JSON.parse(globais.find((g) => g.kind === 'settings').data).cor, 'nova');
    assert.equal(JSON.parse(globais.find((g) => g.kind === 'profile').data).nif, '210000007');
    assert.equal(await env.DB.prepare("SELECT id FROM files WHERE id = 'f1'").first(), null, 'os anexos da casa velha saíram');
    assert.equal(env.FILES.m.has('f1'), false);
    // as do outro ficaram
    assert.deepEqual((await casasDe(env, outro.id)).map((x) => x.id), ['h-o']);
    assert.equal((await registosDe(env, 'h-o')).length, 2);
    // e o estado da conta é o do modelo
    const st = await resp(pedir(env, a, '/api/state'));
    assert.deepEqual(st.houses.map((x) => x.id), [h]);
  });

  test('um modelo sem definições deixa as definições da conta', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    await comDados(env, a, 'h-a');
    const [m] = await listar(env, a);
    const sem = cenario(a.id).filter((e) => e.kind !== 'settings' && e.kind !== 'profile');
    assert.equal((await resp(pedir(env, a, '/api/modelos/' + m.id + '/usar', 'POST', { confirmar: CONFIRMAR, entidades: sem }))).status, 200);
    const globais = await globaisDe(env, a.id);
    assert.equal(JSON.parse(globais.find((g) => g.kind === 'settings').data).cor, 'antiga');
    assert.equal(JSON.parse(globais.find((g) => g.kind === 'profile').data).nif, '', 'o perfil fica');
    assert.ok(!globais.some((g) => g.kind === 'tx'), 'o movimento solto saiu');
  });

  test('um modelo gravado numa conta usa-se noutra conta de teste: a conta de origem passa a ser a de agora', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '7');
    await comDados(env, a, 'h-a');
    const g = (await resp(pedir(env, a, '/api/modelos', 'POST', { nome: 'Da A' }))).modelo;
    // a mesma pessoa, noutra conta de teste (o /test de amanhã)
    const b = await deTeste(env, await conta(env, 'B'), '7');
    const r = await resp(pedir(env, b, '/api/modelos/' + g.id + '/usar', 'POST', { confirmar: CONFIRMAR }));
    assert.equal(r.status, 200);
    const [hb] = await casasDe(env, b.id);
    assert.notEqual(hb.id, 'h-a');
    const tx = (await registosDe(env, hb.id)).find((x) => x.kind === 'tx');
    assert.equal(JSON.parse(tx.data).paidBy, b.id);
    assert.equal(JSON.parse(tx.data).propertyId, hb.id);
    // a conta A não mudou
    assert.deepEqual((await casasDe(env, a.id)).map((x) => x.id), ['h-a']);
    // e usar o mesmo modelo outra vez dá outra casa, sem chocar com a primeira
    assert.equal((await resp(pedir(env, b, '/api/modelos/' + g.id + '/usar', 'POST', { confirmar: CONFIRMAR }))).status, 200);
    const depois = await casasDe(env, b.id);
    assert.equal(depois.length, 1);
    assert.notEqual(depois[0].id, hb.id);
  });

  test('é atómico: um lote que falha a meio deixa a conta como estava', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    await comDados(env, a, 'h-a');
    const [m] = await listar(env, a);
    const batch = env.DB.batch.bind(env.DB);
    env.DB.batch = (stmts) => batch(stmts.concat([env.DB.prepare('INSERT INTO tabela_que_nao_existe VALUES (1)')]));
    await assert.rejects(pedir(env, a, '/api/modelos/' + m.id + '/usar', 'POST', { confirmar: CONFIRMAR, entidades: cenario(a.id) }));
    env.DB.batch = batch;
    assert.deepEqual((await casasDe(env, a.id)).map((h) => h.id), ['h-a']);
    assert.equal((await registosDe(env, 'h-a')).length, 2);
    assert.equal((await globaisDe(env, a.id)).length, 3);
  });

  test('o travão: 20 trocas por conta em 15 minutos', async () => {
    const env = ambiente();
    const a = await deTeste(env, await conta(env, 'A'), '1');
    const [m] = await listar(env, a);
    let ultimo = 0;
    for (let i = 0; i < 21; i++) ultimo = (await resp(pedir(env, a, '/api/modelos/' + m.id + '/usar', 'POST', { confirmar: CONFIRMAR, entidades: [] }))).status;
    assert.equal(ultimo, 429);
  });
});

/* ------------------------------ as funções puras ------------------------------ */

describe('conferir e remapear', () => {
  test('conferirEntidades recusa o que o /api/sync recusaria', () => {
    assert.ok(conferirEntidades('x').erro);
    assert.ok(conferirEntidades([{ scope: 'house', houseId: 'a b', data: {} }]).erro);
    assert.ok(conferirEntidades([{ scope: 'house', houseId: 'a', data: [] }]).erro);
    assert.ok(conferirEntidades([{ scope: 'house', houseId: 'a', data: {} }, { scope: 'house', houseId: 'a', data: {} }]).erro);
    assert.ok(conferirEntidades([{ scope: 'user', kind: 'settings', id: 'outra', data: {} }]).erro);
    assert.ok(conferirEntidades([{ scope: 'nada', data: {} }]).erro);
    const ok = conferirEntidades([{ scope: 'house', houseId: 'a', data: { id: 'x', _meu: 1, name: 'A' } }]);
    assert.deepEqual(ok.entidades[0].data, { id: 'a', name: 'A' }, 'sem as chaves de trabalho, e o id da linha manda');
  });

  test('remapear troca só os ids entre aspas', () => {
    let n = 0;
    const r = remapear([
      { scope: 'house', houseId: 'h1', data: { id: 'h1', nota: 'h1 no texto', dono: 'U1' } },
      { scope: 'record', houseId: 'h1', kind: 'tx', id: 't', data: { propertyId: 'h1', paidBy: 'U1', outros: ['h1x', 'U1'] } },
    ], 'U1', 'U2', () => 'N' + (++n));
    assert.equal(r[0].houseId, 'N1');
    assert.deepEqual(r[0].data, { id: 'N1', nota: 'h1 no texto', dono: 'U2' });
    assert.deepEqual(r[1].data, { propertyId: 'N1', paidBy: 'U2', outros: ['h1x', 'U2'] });
    assert.deepEqual(resumoDe(r), { imoveis: 1, contratos: 0, pessoas: 0, movimentos: 1, planeados: 0 });
  });
});
