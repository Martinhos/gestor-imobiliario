// Partilhar de uma vez um grupo privado que já existe (POST
// /api/shared-groups/:id/partilhar): o grupo, o dono como membro, as casas
// dele e a ligação nascem num só lote — tudo ou nada —, contra o SQL a sério.
// Era uma fila de três pedidos (criar, casas, ligação), lenta na Cloudflare
// e capaz de deixar um grupo vazio quando o segundo falhava. Prova-se o que
// fica, e sobretudo o que NÃO fica: casas alheias, um grupo que já existe, o
// serviço desligado, e cada recusa sem rasto nenhum.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, conta, pedir, resp, estado, casa, desligar, fotografia, auditoria } from './lib/api.js';
import { canAccessHouse } from '../worker/src/lib/acesso.js';

// Recebe: env; quem — a conta; id — o grupo; corpo — {name, houseIds}.
// Devolve: a promessa de {status, ...} do POST …/partilhar.
const partilhar = (env, quem, id, corpo) => resp(pedir(env, quem, '/api/shared-groups/' + id + '/partilhar', 'POST', corpo));

// Recebe: env; sql — uma consulta com COUNT(*) AS n; args — os parâmetros.
// Devolve: a promessa do n.
const contar = async (env, sql, ...args) => ((await env.DB.prepare(sql).bind(...args).first()) || {}).n || 0;

// Dono D com as casas H1 e H2; X, um estranho, com a HX.
// Devolve: {env, D, X}.
async function armar() {
  const env = ambiente();
  const D = await conta(env, 'Dono');
  const X = await conta(env, 'Estranho');
  await casa(env, D, 'H1', { name: 'T2 Lisboa' });
  await casa(env, D, 'H2', { name: 'T1 Porto' });
  await casa(env, X, 'HX', { name: 'Casa do Estranho' });
  return { env, D, X };
}

describe('POST /api/shared-groups/:id/partilhar', () => {
  test('cria o grupo, o dono como membro, as casas e a ligação de uma vez, e devolve o URL com o token', async () => {
    const { env, D } = await armar();
    const r = await partilhar(env, D, 'G1', { name: 'Lisboa', houseIds: ['H1', 'H2'] });
    assert.equal(r.status, 201, JSON.stringify(r));
    assert.equal(r.id, 'G1');
    assert.equal(r.name, 'Lisboa');
    assert.match(r.url, /\/\?grupo=[a-f0-9]{64}$/);
    assert.ok(r.expiresAt > Date.now() + 6 * 86400000, 'a ligação vale sete dias');
    assert.equal(await contar(env, 'SELECT COUNT(*) AS n FROM shared_groups WHERE id = ? AND owner_id = ? AND deleted = 0', 'G1', D.id), 1);
    assert.equal(await contar(env, 'SELECT COUNT(*) AS n FROM shared_group_members WHERE group_id = ? AND user_id = ?', 'G1', D.id), 1);
    assert.equal(await contar(env, 'SELECT COUNT(*) AS n FROM shared_group_houses WHERE group_id = ? AND added_by = ?', 'G1', D.id), 2);
    const token = /grupo=([a-f0-9]{64})$/.exec(r.url)[1];
    const lig = await env.DB.prepare('SELECT token_hash, revoked_at, uses FROM shared_group_links WHERE group_id = ?').bind('G1').first();
    assert.ok(lig && lig.token_hash && lig.token_hash !== token, 'só o hash fica guardado');
    assert.equal(lig.revoked_at, null);
    assert.equal(lig.uses, 0);
    // o estado do dono já traz o grupo, com as casas e a ligação ativa
    const st = await estado(env, D);
    const g = st.sharedGroups.find((x) => x.id === 'G1');
    assert.ok(g && g.mine);
    assert.deepEqual(g.houses.map((h) => h.id).sort(), ['H1', 'H2']);
    assert.equal(g.link && g.link.ativo, true);
    // e a auditoria diz as três coisas, como antes
    const acoes = (await auditoria(env)).filter((x) => x.alvo === 'G1' || x.detalhe === 'G1').map((x) => x.acao);
    for (const a of ['grupo.criar', 'grupo.imoveis', 'grupo.ligacao.criar']) assert.ok(acoes.includes(a), a + ' em ' + acoes.join(','));
  });

  test('a ligação serve logo: quem a abre fica com um pedido, como nas ligações criadas à parte', async () => {
    const { env, D, X } = await armar();
    const r = await partilhar(env, D, 'G1', { name: 'Lisboa', houseIds: ['H1'] });
    const token = /grupo=([a-f0-9]{64})$/.exec(r.url)[1];
    const e = await resp(pedir(env, X, '/api/grupo/' + token + '/entrar', 'POST', {}));
    assert.equal(e.status, 201, JSON.stringify(e));
    assert.equal(e.pedido, true);
    assert.equal((await canAccessHouse(env, X.id, 'H1')).ok, false, 'pedir não dá acesso');
  });

  test('uma casa que não é minha recusa tudo, sem deixar grupo, casas nem ligação', async () => {
    const { env, D } = await armar();
    const antes = await fotografia(env);
    const r = await partilhar(env, D, 'G1', { name: 'Lisboa', houseIds: ['H1', 'HX'] });
    assert.equal(r.status, 403);
    assert.equal(r.error, 'Só podes adicionar ao grupo imóveis teus.');
    assert.deepEqual(await fotografia(env), antes, 'nada ficou');
  });

  test('sem casas, sem nome, nome longo ou corpo inválido dá 400 e não cria nada', async () => {
    const { env, D } = await armar();
    const antes = await fotografia(env);
    for (const [corpo, frase] of [
      [{ name: 'Lisboa', houseIds: [] }, 'Escolhe pelo menos um imóvel teu para o grupo.'],
      [{ name: '  ', houseIds: ['H1'] }, 'Dá um nome ao grupo (até 60 caracteres).'],
      [{ name: 'x'.repeat(61), houseIds: ['H1'] }, 'Dá um nome ao grupo (até 60 caracteres).'],
      [{ name: 'Lisboa', houseIds: 'H1' }, null],
    ]) {
      const r = await partilhar(env, D, 'G1', corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
      if (frase) assert.equal(r.error, frase);
    }
    assert.deepEqual(await fotografia(env), antes);
  });

  test('um grupo que já existe é 409 (um segundo toque não cria nem roda nada); de outra pessoa ou apagado, 404', async () => {
    const { env, D, X } = await armar();
    const r1 = await partilhar(env, D, 'G1', { name: 'Lisboa', houseIds: ['H1'] });
    assert.equal(r1.status, 201);
    const hash = (await env.DB.prepare('SELECT token_hash FROM shared_group_links WHERE group_id = ?').bind('G1').first()).token_hash;
    const r2 = await partilhar(env, D, 'G1', { name: 'Lisboa', houseIds: ['H1', 'H2'] });
    assert.equal(r2.status, 409);
    assert.equal(r2.error, 'Este grupo já está partilhado.');
    assert.equal((await env.DB.prepare('SELECT token_hash FROM shared_group_links WHERE group_id = ?').bind('G1').first()).token_hash, hash, 'a ligação não rodou');
    assert.equal(await contar(env, 'SELECT COUNT(*) AS n FROM shared_group_houses WHERE group_id = ?', 'G1'), 1, 'as casas ficaram como estavam');
    // de outra pessoa: o 404 de sempre, sem dizer que existe
    const rX = await partilhar(env, X, 'G1', { name: 'Meu', houseIds: ['HX'] });
    assert.equal(rX.status, 404);
    assert.equal(rX.error, 'Grupo não encontrado.');
    // apagado: o mesmo 404
    assert.equal((await resp(pedir(env, D, '/api/shared-groups/G1', 'DELETE'))).status, 200);
    assert.equal((await partilhar(env, D, 'G1', { name: 'Lisboa', houseIds: ['H1'] })).status, 404);
  });

  test('dois pedidos ao mesmo tempo com o mesmo id: um cria, o outro leva 409, e fica um grupo só', async () => {
    const { env, D } = await armar();
    const [a, b] = await Promise.all([
      partilhar(env, D, 'G1', { name: 'Lisboa', houseIds: ['H1'] }),
      partilhar(env, D, 'G1', { name: 'Lisboa', houseIds: ['H1'] }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(await contar(env, 'SELECT COUNT(*) AS n FROM shared_groups WHERE id = ?', 'G1'), 1);
    assert.equal(await contar(env, 'SELECT COUNT(*) AS n FROM shared_group_links WHERE group_id = ?', 'G1'), 1);
  });

  test('com os Colaboradores desligados nesta conta é 403 com a frase do serviço, e não cria nada', async () => {
    const { env, D } = await armar();
    await desligar(env, D, 'colaboradores');
    const antes = await fotografia(env);
    const r = await partilhar(env, D, 'G1', { name: 'Lisboa', houseIds: ['H1'] });
    assert.equal(r.status, 403);
    assert.equal(r.error, 'O serviço Colaboradores está desligado nesta conta.');
    assert.deepEqual(await fotografia(env), antes);
  });

  test('sem sessão é 401, e um id com forma errada é 400', async () => {
    const { env, D } = await armar();
    assert.equal((await partilhar(env, null, 'G1', { name: 'Lisboa', houseIds: ['H1'] })).status, 401);
    assert.equal((await partilhar(env, D, 'G 1', { name: 'Lisboa', houseIds: ['H1'] })).status, 400);
  });
});
