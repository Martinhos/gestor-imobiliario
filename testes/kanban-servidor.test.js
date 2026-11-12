// O kanban da equipa no servidor (worker/src/rotas/kanban.js): as rotas
// /api/equipa/kanban com os papéis, os cartões KAN-N, o mover e a
// renumeração, o histórico de cada campo, os comentários, as ligações, os
// anexos no R2, as colunas do master e o quadro num número fixo de consultas.
// E os ganchos que levam os tickets de QA (rotas/qa.js) e os pedidos aceites
// (equipa-api.js) ao kanban: o cartão nasce e move-se com eles, nada corre em
// produção, e uma falha do kanban nunca muda a resposta da ação sobre o ticket.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ambiente, conta, novaConta, pedir, resp, auditoria } from './lib/api.js';
import { chamar, corpoDe, MASTER, SUPORTE, DEV, ADMIN, COMERCIAL, SEM_CARGO } from './lib/equipa.js';
import { rotasEquipaApi } from '../worker/src/equipa-api.js';
import { sincronizarKanban } from '../worker/src/rotas/kanban.js';
import { CSP_ANEXO } from '../worker/src/lib/http.js';
import { cartaoDoPedido, colunaDepoisDoComentario } from '../worker/src/lib/kanban.js';

const K = '/api/equipa/kanban';
// uma imagem PNG de 1×1, a mesma dos testes do QA
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));

/* ------------------------------- armações ------------------------------- */

/* Uma chamada às rotas com o estado e o JSON juntos.
   Recebe: env; eu; method; path; corpo (opcional); query (opcional).
   Devolve: promessa de {status, ...o JSON}. */
const ir = async (env, eu, method, path, corpo, query) => corpoDe(await chamar(env, eu, method, path, corpo, query));

/* Cria um cartão pela rota e confere o 201.
   Recebe: env; eu (MASTER por omissão); corpo — junta-se a {tipo: 'tarefa', titulo: 'Uma tarefa'}.
   Devolve: promessa do CartaoCurto. */
async function novoCartao(env, eu, corpo) {
  const r = await ir(env, eu || MASTER, 'POST', K + '/cartoes', Object.assign({ tipo: 'tarefa', titulo: 'Uma tarefa' }, corpo));
  assert.equal(r.status, 201, JSON.stringify(r));
  return r.cartao;
}

/* O quadro como a sessão o vê.
   Recebe: env; eu (MASTER por omissão); query (opcional, '?tipo=erro').
   Devolve: promessa de {status, colunas, cartoes, etiquetas, pessoas, eu}. */
const quadro = (env, eu, query) => ir(env, eu || MASTER, 'GET', K, null, query);

/* As chaves de uma coluna, pela ordem do quadro.
   Recebe: env; coluna — o id.
   Devolve: promessa da lista de chaves. */
const ordemDe = async (env, coluna) => (await quadro(env)).cartoes.filter((c) => c.coluna_id === coluna).map((c) => c.chave);

/* Uma linha (ou todas) da base, como objetos simples.
   Recebe: env; sql; a — os valores.
   Devolve: a linha ({…} ou undefined) / a lista. */
const uma = (env, sql, ...a) => { const r = env.DB._db.prepare(sql).get(...a); return r ? { ...r } : r; };
const todas = (env, sql, ...a) => env.DB._db.prepare(sql).all(...a).map((r) => ({ ...r }));

/* As linhas do histórico de um cartão (sem a «criado»), pela ordem.
   Recebe: env; id — o do cartão.
   Devolve: a lista de {campo, antes, depois}. */
const historicoDe = (env, id) => todas(env, "SELECT campo, antes, depois FROM kanban_historico WHERE cartao_id = ? AND campo <> 'criado' ORDER BY id", id);

/* As ações kanban.* do audit_log, pela ordem.
   Recebe: env.
   Devolve: promessa da lista de 'acao alvo'. */
const rastoKanban = async (env) => (await auditoria(env)).filter((x) => x.acao.startsWith('kanban.')).map((x) => x.acao + ' ' + x.alvo);

/* Chama as rotas com um corpo em bytes e cabeçalhos à escolha (os anexos).
   Recebe: env; eu; method; path; corpo (bytes ou nada); headers (opcional).
   Devolve: promessa da Response. */
function chamarCru(env, eu, method, path, corpo, headers) {
  const url = new URL('https://x.pt' + path);
  const request = new Request(url, { method, body: corpo, headers: headers || {} });
  return rotasEquipaApi({ env, request, path, method, url, eu });
}

/* Um pedido escrito direto na base, como o deixa a Ajuda da app.
   Recebe: env; userId; extra (opcional) — {categoria, assunto, corpo}.
   Devolve: promessa do id. */
async function novoPedido(env, userId, extra) {
  const id = crypto.randomUUID();
  const o = Object.assign({ categoria: 'user', assunto: 'Ajuda', corpo: 'Não sei fazer X.' }, extra);
  await env.DB.prepare(
    `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, created_at, updated_at)
     VALUES (?, ?, 'problema', ?, ?, 'criado', ?, ?, ?)`
  ).bind(id, userId, o.assunto, o.corpo, o.categoria, Date.now(), Date.now()).run();
  return id;
}

/* O cartão de uma origem, como está na base.
   Recebe: env; tipo — 'qa' ou 'pedido'; id — o da origem.
   Devolve: a linha, ou undefined. */
const cartaoDaOrigem = (env, tipo, id) => uma(env, 'SELECT * FROM kanban_cartoes WHERE origem_tipo = ? AND origem_id = ?', tipo, id);

/* Conta as consultas: cada prepare é uma (as de um batch também passam pelo prepare).
   Recebe: env.
   Devolve: {n, sql} — o contador e os textos, que vão crescendo. */
function contar(env) {
  const c = { n: 0, sql: [] };
  const prepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => { c.n++; c.sql.push(sql); return prepare(sql); };
  return c;
}

/* ------------------------------- as portas ------------------------------- */

describe('as portas do kanban', () => {
  test('sem ENV_NAME todas as rotas respondem 404, sem lerem o corpo nem escreverem nada', async () => {
    const env = ambiente({ ENV_NAME: undefined });
    const rotas = [
      ['GET', K], ['GET', K + '/pessoas'], ['POST', K + '/cartoes'], ['GET', K + '/cartoes/KAN-1'],
      ['PATCH', K + '/cartoes/KAN-1'], ['DELETE', K + '/cartoes/KAN-1'], ['POST', K + '/cartoes/KAN-1/mover'],
      ['POST', K + '/cartoes/KAN-1/repor'], ['POST', K + '/cartoes/KAN-1/comentarios'], ['POST', K + '/cartoes/KAN-1/ligacoes'],
      ['PUT', K + '/cartoes/KAN-1/anexos'], ['PATCH', K + '/comentarios/x1'], ['DELETE', K + '/comentarios/x1'],
      ['DELETE', K + '/ligacoes/x1'], ['GET', K + '/anexos/x1'], ['DELETE', K + '/anexos/x1'], ['POST', K + '/colunas'],
      ['PATCH', K + '/colunas/a-fazer'], ['POST', K + '/colunas/ordem'], ['DELETE', K + '/colunas/para-depois'],
    ];
    for (const [method, path] of rotas) {
      const url = new URL('https://x.pt' + path);
      const comCorpo = method !== 'GET';
      const request = new Request(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: comCorpo ? JSON.stringify({ tipo: 'tarefa', titulo: 'x', nome: 'x', texto: 'x' }) : undefined,
      });
      const r = await corpoDe(await rotasEquipaApi({ env, request, path, method, url, eu: MASTER }));
      assert.equal(r.status, 404, method + ' ' + path);
      assert.equal(r.error, 'Rota desconhecida.');
      if (comCorpo) assert.equal(request.bodyUsed, false, method + ' ' + path + ' leu o corpo');
    }
    assert.equal(uma(env, 'SELECT COUNT(*) AS n FROM kanban_cartoes').n, 0);
    assert.equal(uma(env, 'SELECT COUNT(*) AS n FROM kanban_colunas').n, 5, 'as colunas ficam como a migração as semeou');
    assert.deepEqual(await auditoria(env), [], 'nada no rasto');
  });

  test('sem um papel da equipa, 403; qualquer um dos quatro papéis vê e cria', async () => {
    const env = ambiente();
    for (const eu of [SEM_CARGO, COMERCIAL]) {
      assert.equal((await quadro(env, eu)).status, 403, eu.nome + ' vê o quadro');
      const r = await ir(env, eu, 'POST', K + '/cartoes', { tipo: 'tarefa', titulo: 'x' });
      assert.equal(r.status, 403, eu.nome + ' cria');
      assert.match(r.error, /cargo/);
    }
    for (const eu of [MASTER, ADMIN, DEV, SUPORTE]) {
      assert.equal((await quadro(env, eu)).status, 200, eu.nome);
      await novoCartao(env, eu, { titulo: 'De ' + eu.nome });
    }
    assert.equal((await quadro(env)).cartoes.length, 4);
  });

  test('um caminho ou um método que não existe dá 404', async () => {
    const env = ambiente();
    for (const [m, p] of [['GET', K + '/nada'], ['PUT', K], ['GET', K + '/cartoes'], ['GET', K + '/cartoes/KAN-1/outra'],
      ['GET', K + '/cartoes/KAN-1/mover'], ['GET', K + '/colunas'], ['GET', K + '/cartoes/KAN-1/a/b/c']]) {
      const r = await ir(env, MASTER, m, p);
      assert.equal(r.status, 404, m + ' ' + p);
      assert.equal(r.error, 'Rota desconhecida.');
    }
    // um caminho que só começa por /api/equipa/kanban não é do kanban (o index.js responde 404)
    assert.equal(await chamar(env, MASTER, 'GET', K + 'zz'), null);
  });
});

/* ------------------------------- criar ------------------------------- */

describe('criar um cartão', () => {
  test('o caminho feliz: KAN-N, no topo da coluna, com o relator, as etiquetas normalizadas, o histórico e o rasto', async () => {
    const env = ambiente();
    const c1 = await novoCartao(env, DEV, {
      titulo: '  Exportar   em PDF ', descricao: '  O pedido todo.\r\nSegunda linha. ', etiquetas: ['Suporte', 'a espera', 'suporte', ' '],
      prioridade: 2, prazo: '2026-12-01',
    });
    assert.equal(c1.chave, 'KAN-79');
    assert.equal(c1.numero, 79);
    assert.equal(c1.tipo, 'tarefa');
    assert.equal(c1.titulo, 'Exportar em PDF');
    assert.equal(c1.coluna_id, 'a-fazer');
    assert.deepEqual(c1.etiquetas, ['a-espera', 'suporte']);
    assert.equal(c1.prioridade, 2);
    assert.equal(c1.prazo, '2026-12-01');
    assert.deepEqual([c1.responsavel, c1.pai, c1.origem, c1.concluido_at], [null, null, null, null]);
    assert.deepEqual([c1.comentarios, c1.anexos, c1.subtarefas, c1.bloqueado], [0, 0, { total: 0, feitas: 0 }, false]);
    const c2 = await novoCartao(env, MASTER);
    assert.equal(c2.chave, 'KAN-80');
    assert.ok(c2.posicao < c1.posicao, 'o novo vai para o topo');
    const l = uma(env, 'SELECT relator_id, relator_nome, descricao FROM kanban_cartoes WHERE id = ?', c1.id);
    assert.deepEqual(l, { relator_id: 'd1', relator_nome: 'Dina', descricao: 'O pedido todo.\nSegunda linha.' });
    assert.deepEqual(todas(env, 'SELECT campo, antes, depois, autor_id FROM kanban_historico WHERE cartao_id = ?', c1.id),
      [{ campo: 'criado', antes: null, depois: 'a-fazer', autor_id: 'd1' }]);
    const rasto = (await auditoria(env)).filter((x) => x.acao === 'kanban.criar');
    assert.deepEqual(rasto.map((x) => [x.quem, x.papel, x.alvo, x.detalhe]),
      [['d1', 'dev', 'KAN-79', 'Exportar em PDF'], ['m1', 'master', 'KAN-80', 'Uma tarefa']]);
  });

  test('sem coluna nem prioridade vai para A fazer com Média; numa coluna de fim nasce concluído', async () => {
    const env = ambiente();
    const a = await novoCartao(env, MASTER, { tipo: 'historia' });
    assert.deepEqual([a.coluna_id, a.prioridade, a.concluido_at], ['a-fazer', 3, null]);
    const b = await novoCartao(env, MASTER, { coluna_id: 'concluido', prioridade: '5' });
    assert.equal(b.coluna_id, 'concluido');
    assert.equal(b.prioridade, 5);
    assert.equal(typeof b.concluido_at, 'number');
  });

  test('as recusas dizem o campo, e nada se grava', async () => {
    const env = ambiente();
    const base = await novoCartao(env);
    const epico = await novoCartao(env, MASTER, { tipo: 'epico', titulo: 'Grande' });
    await env.DB.prepare("INSERT INTO audit_log (at, quem, nome, papel, acao) VALUES (1, 'U9', 'Cliente', 'utilizador', 'casa.sair')").run();
    const muitas = Array.from({ length: 21 }, (_, i) => 'e' + i);
    const casos = [
      [{ tipo: 'outro' }, 'tipo'], [{ tipo: undefined }, 'tipo'], [{ titulo: '   ' }, 'titulo'], [{ titulo: 'x'.repeat(201) }, 'titulo'],
      [{ titulo: 7 }, 'titulo'], [{ descricao: 'x'.repeat(20001) }, 'descricao'], [{ descricao: 5 }, 'descricao'],
      [{ prioridade: 0 }, 'prioridade'], [{ prioridade: 2.5 }, 'prioridade'], [{ prioridade: 'alta' }, 'prioridade'],
      [{ etiquetas: 'qa' }, 'etiquetas'], [{ etiquetas: ['x'.repeat(41)] }, 'etiquetas'], [{ etiquetas: muitas }, 'etiquetas'],
      [{ etiquetas: [3] }, 'etiquetas'], [{ prazo: '2026-02-30' }, 'prazo'], [{ prazo: '1/2/2026' }, 'prazo'], [{ prazo: 20261201 }, 'prazo'],
      [{ coluna_id: 'nao-ha' }, 'coluna_id'], [{ coluna_id: 'a b' }, 'coluna_id'], [{ responsavel_id: 'desconhecido' }, 'responsavel_id'],
      [{ responsavel_id: 'U9' }, 'responsavel_id'], [{ tipo: 'subtarefa' }, 'pai'], [{ tipo: 'epico', pai: base.chave }, 'pai'],
      [{ pai: 'KAN-99' }, 'pai'], [{ pai: 'abc' }, 'pai'], [{ tipo: 'subtarefa', pai: epico.chave }, 'pai'],
    ];
    for (const [extra, campo] of casos) {
      const r = await ir(env, MASTER, 'POST', K + '/cartoes', Object.assign({ tipo: 'tarefa', titulo: 'Ok' }, extra));
      assert.equal(r.status, 400, JSON.stringify(extra));
      assert.equal(r.campo, campo, JSON.stringify(extra));
      assert.ok(r.error && !/undefined/.test(r.error), r.error);
    }
    const semObjeto = await corpoDe(await chamarCru(env, MASTER, 'POST', K + '/cartoes', '[1]', { 'Content-Type': 'application/json' }));
    assert.equal(semObjeto.status, 400);
    assert.equal(uma(env, 'SELECT COUNT(*) AS n FROM kanban_cartoes').n, 2, 'só os dois do começo');
    assert.equal((await rastoKanban(env)).length, 2);
    // e os limites certos passam
    const no = await novoCartao(env, MASTER, { titulo: 'x'.repeat(200), descricao: 'y'.repeat(20000), etiquetas: muitas.slice(0, 20), prazo: '2028-02-29' });
    assert.equal(no.etiquetas.length, 20);
  });

  test('o pai e o responsável: subtarefa debaixo de uma tarefa, e o responsável é alguém da equipa', async () => {
    const env = ambiente();
    await env.DB.prepare("INSERT INTO audit_log (at, quem, nome, papel, acao) VALUES (1, 's9', 'Sara', 'suporte', 'equipa.entrar')").run();
    const epico = await novoCartao(env, MASTER, { tipo: 'epico', titulo: 'Grande' });
    const tarefa = await novoCartao(env, MASTER, { pai: epico.chave.toLowerCase() });
    assert.deepEqual(tarefa.pai, { chave: epico.chave, titulo: 'Grande', tipo: 'epico' });
    const sub = await novoCartao(env, MASTER, { tipo: 'subtarefa', pai: String(tarefa.numero) });
    assert.equal(sub.pai.chave, tarefa.chave);
    assert.deepEqual((await novoCartao(env, DEV, { responsavel_id: 'd1' })).responsavel, { id: 'd1', nome: 'Dina' });
    assert.deepEqual((await novoCartao(env, DEV, { responsavel_id: 'claude' })).responsavel, { id: 'claude', nome: 'Claude' });
    assert.deepEqual((await novoCartao(env, DEV, { responsavel_id: 's9' })).responsavel, { id: 's9', nome: 'Sara' });
    const q = await quadro(env);
    assert.deepEqual(q.cartoes.find((c) => c.id === epico.id).subtarefas, { total: 1, feitas: 0 });
    assert.deepEqual(q.cartoes.find((c) => c.id === tarefa.id).subtarefas, { total: 1, feitas: 0 });
  });
});

/* ------------------------------- as chaves ------------------------------- */

describe('as chaves KAN-N', () => {
  test('o número segue o maior que existe e nunca se repete, nem depois de um cartão apagado de vez', async () => {
    const env = ambiente();
    // a base nova começa a seguir à última chave do Jira (o contador semeado a 78)
    assert.equal((await novoCartao(env)).chave, 'KAN-79');
    env.DB._db.exec("INSERT INTO kanban_cartoes (id, numero, titulo, coluna_id, posicao, relator_id, created_at, updated_at) VALUES ('j150', 150, 'Mais alto', 'a-fazer', 10, 'claude', 1, 1)");
    assert.equal((await novoCartao(env)).chave, 'KAN-151', 'segue o maior que existe');
    env.DB._db.exec('DELETE FROM kanban_cartoes WHERE numero = 151');
    assert.equal((await novoCartao(env)).chave, 'KAN-152', 'o 151 não volta');
    const ana = await conta(env, 'Ana');
    const qa = await resp(pedir(env, ana, '/api/qa', 'POST', { body: 'Do QA' }));
    assert.equal(cartaoDaOrigem(env, 'qa', qa.id).numero, 153, 'o gancho do QA usa o mesmo contador');
    assert.equal((await novoCartao(env)).chave, 'KAN-154');
    assert.equal(uma(env, 'SELECT ultimo FROM kanban_contador').ultimo, 154);
  });

  test('a chave lê-se como KAN-79, kan-79 ou 79; o que não é chave dá 404', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    for (const ch of ['KAN-79', 'kan-79', '79']) assert.equal((await ir(env, DEV, 'GET', K + '/cartoes/' + ch)).cartao.id, c.id, ch);
    for (const ch of ['KAN-0', 'KAN-80', 'x', 'KAN-79%27', '%E0%A4%A', 'KAN-079']) {
      const r = await ir(env, DEV, 'GET', K + '/cartoes/' + ch);
      assert.equal(r.status, 404, ch);
      assert.equal(r.error, 'Cartão não encontrado.');
    }
  });
});

/* ------------------------------- ler ------------------------------- */

describe('ler um cartão', () => {
  test('traz a descrição, o relator, as subtarefas, os comentários (meu), o histórico, as ligações e os anexos', async () => {
    const env = ambiente();
    const a = await novoCartao(env, MASTER, { titulo: 'A', descricao: 'A descrição.' });
    const s = await novoCartao(env, DEV, { tipo: 'subtarefa', titulo: 'S', pai: a.chave });
    const b = await novoCartao(env, DEV, { titulo: 'B' });
    const c = await novoCartao(env, DEV, { titulo: 'C' });
    assert.equal((await ir(env, DEV, 'POST', K + '/cartoes/' + b.chave + '/ligacoes', { tipo: 'bloqueia', chave: a.chave })).status, 200);
    assert.equal((await ir(env, DEV, 'POST', K + '/cartoes/' + a.chave + '/ligacoes', { tipo: 'relaciona', chave: c.chave })).status, 200);
    await ir(env, MASTER, 'POST', K + '/cartoes/' + a.chave + '/comentarios', { texto: 'Do mestre.' });
    await ir(env, DEV, 'POST', K + '/cartoes/' + a.chave + '/comentarios', { texto: 'Da Dina.' });
    assert.equal((await chamarCru(env, DEV, 'PUT', K + '/cartoes/' + a.chave + '/anexos', PNG, { 'X-Nome': 'a.png' })).status, 201);

    const r = await ir(env, DEV, 'GET', K + '/cartoes/' + a.chave);
    assert.equal(r.status, 200);
    assert.equal(r.cartao.descricao, 'A descrição.');
    assert.deepEqual(r.cartao.relator, { id: 'm1', nome: 'Mestre' });
    assert.equal(r.cartao.bloqueado, true, 'B bloqueia-o');
    assert.equal(r.cartao.comentarios, 2);
    assert.equal(r.cartao.anexos, 1);
    assert.deepEqual(r.subtarefas.map((x) => [x.chave, x.pai.chave]), [[s.chave, a.chave]]);
    assert.deepEqual(r.comentarios.map((x) => [x.texto, x.autor.nome, x.meu]), [['Do mestre.', 'Mestre', false], ['Da Dina.', 'Dina', true]]);
    assert.deepEqual(r.ligacoes.map((x) => [x.tipo, x.cartao.chave, x.cartao.titulo, x.cartao.coluna_id]),
      [['bloqueado', b.chave, 'B', 'a-fazer'], ['relaciona', c.chave, 'C', 'a-fazer']]);
    assert.equal(r.anexos.length, 1);
    assert.equal(r.anexos[0].url, K + '/anexos/' + r.anexos[0].id);
    assert.deepEqual(r.anexos[0].autor, { id: 'd1', nome: 'Dina' });
    assert.deepEqual(r.historico.map((h) => [h.campo, h.antes, h.depois]), [
      ['criado', null, 'a-fazer'], ['ligacao', null, 'bloqueado ' + b.chave], ['ligacao', null, 'relaciona ' + c.chave], ['anexo', null, 'a.png'],
    ]);
    assert.deepEqual(r.historico[1].autor, { id: 'd1', nome: 'Dina' });
    assert.equal(r.origem, null);
  });
});

/* ------------------------------- editar ------------------------------- */

describe('editar um cartão', () => {
  test('cada campo que muda deixa a sua linha no histórico; o que não muda não escreve nada', async () => {
    const env = ambiente();
    const c = await novoCartao(env, DEV, { titulo: 'Antes', descricao: 'd', etiquetas: ['a'] });
    const r = await ir(env, MASTER, 'PATCH', K + '/cartoes/' + c.chave, {
      tipo: 'erro', titulo: 'Depois', descricao: 'd2', prioridade: 1, etiquetas: ['b', 'A'], responsavel_id: 'm1', prazo: '2026-12-31',
    });
    assert.equal(r.status, 200);
    assert.deepEqual([r.cartao.tipo, r.cartao.titulo, r.cartao.prioridade, r.cartao.prazo], ['erro', 'Depois', 1, '2026-12-31']);
    assert.deepEqual(r.cartao.etiquetas, ['a', 'b']);
    assert.deepEqual(r.cartao.responsavel, { id: 'm1', nome: 'Mestre' });
    assert.deepEqual(historicoDe(env, c.id), [
      { campo: 'tipo', antes: 'tarefa', depois: 'erro' }, { campo: 'titulo', antes: 'Antes', depois: 'Depois' },
      { campo: 'descricao', antes: 'd', depois: 'd2' }, { campo: 'prioridade', antes: '3', depois: '1' },
      { campo: 'prazo', antes: null, depois: '2026-12-31' }, { campo: 'etiquetas', antes: 'a', depois: 'a,b' },
      { campo: 'responsavel', antes: null, depois: 'Mestre' },
    ]);
    assert.equal(uma(env, 'SELECT autor_id FROM kanban_historico WHERE cartao_id = ? ORDER BY id DESC', c.id).autor_id, 'm1');
    const editar = (await auditoria(env)).filter((x) => x.acao === 'kanban.editar');
    assert.deepEqual(editar.map((x) => [x.alvo, x.detalhe]), [[c.chave, 'tipo, titulo, descricao, prioridade, prazo, etiquetas, responsavel']]);

    // o mesmo outra vez: nada muda, nada se escreve
    const igual = await ir(env, MASTER, 'PATCH', K + '/cartoes/' + c.chave, { titulo: ' Depois ', etiquetas: ['B', 'a'], prioridade: '1' });
    assert.equal(igual.status, 200);
    assert.equal(historicoDe(env, c.id).length, 7);
    assert.equal((await auditoria(env)).filter((x) => x.acao === 'kanban.editar').length, 1);

    // null tira o responsável e o prazo
    await ir(env, MASTER, 'PATCH', K + '/cartoes/' + c.chave, { responsavel_id: null, prazo: null, etiquetas: [] });
    assert.deepEqual(historicoDe(env, c.id).slice(7), [
      { campo: 'prazo', antes: '2026-12-31', depois: null }, { campo: 'etiquetas', antes: 'a,b', depois: null },
      { campo: 'responsavel', antes: 'Mestre', depois: null },
    ]);
    const depois = (await ir(env, DEV, 'GET', K + '/cartoes/' + c.chave)).cartao;
    assert.deepEqual([depois.responsavel, depois.prazo, depois.etiquetas], [null, null, []]);
  });

  test('a descrição longa fica cortada no histórico, inteira no cartão', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    const longa = 'x'.repeat(5000);
    await ir(env, MASTER, 'PATCH', K + '/cartoes/' + c.chave, { descricao: longa });
    assert.equal((await ir(env, MASTER, 'GET', K + '/cartoes/' + c.chave)).cartao.descricao, longa);
    const h = historicoDe(env, c.id)[0];
    assert.equal(h.antes, null);
    assert.equal(h.depois.length, 1000);
    assert.ok(h.depois.endsWith('…'));
  });

  test('o pai: sem ciclos nem de si mesmo; um épico sem pai nem subtarefas debaixo; uma subtarefa sempre com pai', async () => {
    const env = ambiente();
    const a = await novoCartao(env, MASTER, { titulo: 'A' });
    const b = await novoCartao(env, MASTER, { titulo: 'B', pai: a.chave });
    const e = await novoCartao(env, MASTER, { tipo: 'epico', titulo: 'E' });
    const patch = (ch, corpo) => ir(env, MASTER, 'PATCH', K + '/cartoes/' + ch, corpo);
    let r = await patch(a.chave, { pai: b.chave });
    assert.equal(r.status, 400);
    assert.match(r.error, /debaixo deste cartão/);
    r = await patch(a.chave, { pai: a.chave });
    assert.equal(r.status, 400);
    assert.match(r.error, /si mesmo/);
    r = await patch(b.chave, { pai: e.chave });
    assert.equal(r.status, 200);
    assert.deepEqual(historicoDe(env, b.id), [{ campo: 'pai', antes: a.chave, depois: e.chave }]);
    const s = await novoCartao(env, MASTER, { tipo: 'subtarefa', titulo: 'S', pai: b.chave });
    r = await patch(b.chave, { tipo: 'epico' });
    assert.equal(r.status, 400, 'tem pai');
    assert.equal(r.campo, 'pai');
    r = await patch(b.chave, { tipo: 'epico', pai: null });
    assert.equal(r.status, 400, 'tem uma subtarefa debaixo');
    assert.equal(r.campo, 'tipo');
    assert.match(r.error, new RegExp(s.chave));
    r = await patch(s.chave, { pai: null });
    assert.equal(r.status, 400);
    assert.match(r.error, /precisa de um cartão pai/);
    r = await patch(s.chave, { pai: e.chave });
    assert.equal(r.status, 400, 'subtarefa debaixo de um épico');
    r = await patch(s.chave, { tipo: 'tarefa', pai: e.chave });
    assert.equal(r.status, 200);
    assert.deepEqual(r.cartao.pai, { chave: e.chave, titulo: 'E', tipo: 'epico' });
    r = await patch(a.chave, { tipo: 'epico' });
    assert.equal(r.status, 200, 'A não tem pai nem subtarefas: pode ser épico');
  });

  test('as recusas do editar dizem o campo; um cartão que não existe dá 404', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    assert.equal((await ir(env, MASTER, 'PATCH', K + '/cartoes/KAN-99', { titulo: 'x' })).status, 404);
    for (const [corpo, campo] of [[{ titulo: '' }, 'titulo'], [{ etiquetas: [1] }, 'etiquetas'], [{ tipo: 'x' }, 'tipo'],
      [{ prioridade: null }, 'prioridade'], [{ prazo: '2026-13-01' }, 'prazo'], [{ responsavel_id: 'ninguem' }, 'responsavel_id']]) {
      const r = await ir(env, MASTER, 'PATCH', K + '/cartoes/' + c.chave, corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
      assert.equal(r.campo, campo);
    }
    assert.equal(historicoDe(env, c.id).length, 0);
  });
});

/* ------------------------------- mover ------------------------------- */

describe('mover um cartão', () => {
  test('o índice conta sem o próprio cartão: topo, meio, e mais do que a coluna é o fim; reordenar não deixa linha', async () => {
    const env = ambiente();
    const [c1, c2, c3, c4] = [await novoCartao(env), await novoCartao(env), await novoCartao(env), await novoCartao(env)];
    assert.deepEqual(await ordemDe(env, 'a-fazer'), [c4.chave, c3.chave, c2.chave, c1.chave]);
    const mover = (c, coluna, indice) => ir(env, DEV, 'POST', K + '/cartoes/' + c.chave + '/mover', { coluna_id: coluna, indice });
    assert.equal((await mover(c1, 'a-fazer', 0)).status, 200);
    assert.deepEqual(await ordemDe(env, 'a-fazer'), [c1.chave, c4.chave, c3.chave, c2.chave]);
    await mover(c1, 'a-fazer', 2);
    assert.deepEqual(await ordemDe(env, 'a-fazer'), [c4.chave, c3.chave, c1.chave, c2.chave]);
    const r = await mover(c1, 'a-fazer', 99);
    assert.deepEqual(await ordemDe(env, 'a-fazer'), [c4.chave, c3.chave, c2.chave, c1.chave]);
    assert.equal(r.cartao.coluna_id, 'a-fazer');
    await mover(c4, 'a-fazer', 1);
    assert.deepEqual(await ordemDe(env, 'a-fazer'), [c3.chave, c4.chave, c2.chave, c1.chave]);
    const mexidas = (await rastoKanban(env)).filter((x) => x.startsWith('kanban.mover')).length;
    await mover(c4, 'a-fazer', 1);
    assert.equal((await rastoKanban(env)).filter((x) => x.startsWith('kanban.mover')).length, mexidas, 'já estava ali: não escreve');
    assert.equal(uma(env, "SELECT COUNT(*) AS n FROM kanban_historico WHERE campo = 'coluna'").n, 0);
    assert.equal((await mover(c2, 'auto-tests')).cartao.coluna_id, 'auto-tests', 'sem índice vai para o topo');
  });

  test('mudar de coluna deixa a linha e acerta o concluido_at; o ticket de QA vai com o cartão', async () => {
    const env = ambiente();
    const { id } = await ir(env, DEV, 'POST', '/api/equipa/qa', { body: 'O botão não responde', severity: 'incomoda' });
    const k = cartaoDaOrigem(env, 'qa', id);
    let r = await ir(env, SUPORTE, 'POST', K + '/cartoes/KAN-' + k.numero + '/mover', { coluna_id: 'concluido', indice: 0 });
    assert.equal(r.cartao.coluna_id, 'concluido');
    assert.equal(typeof r.cartao.concluido_at, 'number');
    assert.deepEqual(todas(env, "SELECT antes, depois, autor_id FROM kanban_historico WHERE campo = 'coluna'"),
      [{ antes: 'a-fazer', depois: 'concluido', autor_id: 's1' }]);
    const ticket = uma(env, 'SELECT status, resolved_at, updated_at FROM qa_tickets WHERE id = ?', id);
    assert.equal(ticket.status, 'concluido', 'o ticket foi com o cartão');
    assert.equal(ticket.resolved_at, r.cartao.updated_at);
    assert.equal(cartaoDaOrigem(env, 'qa', id).origem_estado, 'concluido');
    r = await ir(env, SUPORTE, 'POST', K + '/cartoes/KAN-' + k.numero + '/mover', { coluna_id: 'para-depois', indice: 0 });
    assert.equal(r.cartao.concluido_at, null);
    assert.deepEqual(uma(env, 'SELECT status, resolved_at FROM qa_tickets WHERE id = ?', id), { status: 'para-depois', resolved_at: null });
    assert.deepEqual((await rastoKanban(env)).filter((x) => x.startsWith('kanban.mover')), ['kanban.mover KAN-' + k.numero, 'kanban.mover KAN-' + k.numero]);
  });

  test('a meio dos vizinhos; e quando estão colados, a coluna renumera-se de 1024 em 1024', async () => {
    const env = ambiente();
    const [x1, x2, x3, m, n] = [await novoCartao(env), await novoCartao(env), await novoCartao(env), await novoCartao(env), await novoCartao(env)];
    for (const [c, p] of [[x1, 1], [x2, 1.0001], [x3, 1.0002]]) {
      env.DB._db.prepare("UPDATE kanban_cartoes SET coluna_id = 'para-depois', posicao = ? WHERE id = ?").run(p, c.id);
    }
    // entre x1 e x2 já não cabe: renumera
    let r = await ir(env, DEV, 'POST', K + '/cartoes/' + m.chave + '/mover', { coluna_id: 'para-depois', indice: 1 });
    assert.equal(r.status, 200);
    assert.deepEqual(await ordemDe(env, 'para-depois'), [x1.chave, m.chave, x2.chave, x3.chave]);
    assert.deepEqual(todas(env, "SELECT posicao FROM kanban_cartoes WHERE coluna_id = 'para-depois' ORDER BY posicao").map((l) => l.posicao),
      [1024, 2048, 3072, 4096]);
    // entre 2048 e 3072 cabe: a meio, sem renumerar
    r = await ir(env, DEV, 'POST', K + '/cartoes/' + n.chave + '/mover', { coluna_id: 'para-depois', indice: 2 });
    assert.equal(r.cartao.posicao, 2560);
    assert.deepEqual(await ordemDe(env, 'para-depois'), [x1.chave, m.chave, n.chave, x2.chave, x3.chave]);
    assert.equal(uma(env, 'SELECT posicao FROM kanban_cartoes WHERE id = ?', x3.id).posicao, 4096);
  });

  test('as recusas do mover', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    for (const [corpo, campo] of [[{ coluna_id: 'nao-ha' }, 'coluna_id'], [{}, 'coluna_id'], [{ coluna_id: 'a-fazer', indice: -1 }, 'indice'],
      [{ coluna_id: 'a-fazer', indice: 1.5 }, 'indice'], [{ coluna_id: 'a-fazer', indice: '2' }, 'indice']]) {
      const r = await ir(env, DEV, 'POST', K + '/cartoes/' + c.chave + '/mover', corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
      assert.equal(r.campo, campo);
    }
    assert.equal((await ir(env, DEV, 'POST', K + '/cartoes/KAN-9/mover', { coluna_id: 'a-fazer' })).status, 404);
  });
});

/* ------------------------------- remover e repor ------------------------------- */

describe('remover e repor um cartão', () => {
  test('só o master; o removido sai do quadro e da leitura, e o repor devolve-o', async () => {
    const env = ambiente();
    const c = await novoCartao(env, DEV);
    let r = await ir(env, DEV, 'DELETE', K + '/cartoes/' + c.chave);
    assert.equal(r.status, 403);
    assert.match(r.error, /Só o master/);
    assert.equal((await ir(env, MASTER, 'DELETE', K + '/cartoes/' + c.chave)).ok, true);
    assert.equal((await quadro(env)).cartoes.length, 0);
    assert.equal((await quadro(env)).colunas.find((x) => x.id === 'a-fazer').total, 0);
    for (const [m, p, corpo] of [['GET', ''], ['PATCH', '', { titulo: 'x' }], ['POST', '/mover', { coluna_id: 'a-fazer' }],
      ['POST', '/comentarios', { texto: 'x' }], ['DELETE', '']]) {
      assert.equal((await ir(env, MASTER, m, K + '/cartoes/' + c.chave + p, corpo)).status, 404, m + ' ' + p);
    }
    assert.equal((await ir(env, DEV, 'POST', K + '/cartoes/' + c.chave + '/repor')).status, 403);
    r = await ir(env, MASTER, 'POST', K + '/cartoes/' + c.chave + '/repor');
    assert.equal(r.cartao.chave, c.chave);
    assert.equal((await quadro(env)).cartoes.length, 1);
    assert.deepEqual(historicoDe(env, c.id).map((h) => h.campo), ['removido', 'reposto']);
    const antes = (await rastoKanban(env)).length;
    assert.equal((await ir(env, MASTER, 'POST', K + '/cartoes/' + c.chave + '/repor')).status, 200, 'não estava removido');
    assert.equal((await rastoKanban(env)).length, antes, 'e não escreveu');
    assert.deepEqual((await rastoKanban(env)).slice(1), ['kanban.remover ' + c.chave, 'kanban.repor ' + c.chave]);
    assert.equal((await ir(env, MASTER, 'POST', K + '/cartoes/KAN-9/repor')).status, 404);
  });

  test('repor um cartão cuja coluna entretanto saiu põe-no em A fazer', async () => {
    const env = ambiente();
    const col = (await ir(env, MASTER, 'POST', K + '/colunas', { nome: 'Revisão' })).coluna;
    const c = await novoCartao(env, MASTER, { coluna_id: col.id });
    await ir(env, MASTER, 'DELETE', K + '/cartoes/' + c.chave);
    assert.equal((await ir(env, MASTER, 'DELETE', K + '/colunas/' + col.id)).ok, true, 'só tinha um removido');
    assert.equal((await ir(env, MASTER, 'POST', K + '/cartoes/' + c.chave + '/repor')).cartao.coluna_id, 'a-fazer');
  });
});

/* ------------------------------- comentários ------------------------------- */

describe('os comentários', () => {
  test('escrever, mudar e remover; só quem escreveu muda e remove', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    const r = await ir(env, DEV, 'POST', K + '/cartoes/' + c.chave + '/comentarios', { texto: '  Vi isto.  ' });
    assert.equal(r.status, 200);
    assert.deepEqual([r.comentario.texto, r.comentario.autor, r.comentario.meu], ['Vi isto.', { id: 'd1', nome: 'Dina' }, true]);
    for (const texto of ['   ', 'x'.repeat(8001), undefined]) {
      const m = await ir(env, DEV, 'POST', K + '/cartoes/' + c.chave + '/comentarios', { texto });
      assert.equal(m.status, 400);
      assert.equal(m.campo, 'texto');
    }
    assert.equal((await ir(env, DEV, 'POST', K + '/cartoes/' + c.chave + '/comentarios', { texto: 'y'.repeat(8000) })).status, 200);
    assert.equal((await quadro(env)).cartoes[0].comentarios, 2);
    const id = r.comentario.id;
    let x = await ir(env, SUPORTE, 'PATCH', K + '/comentarios/' + id, { texto: 'Outro.' });
    assert.equal(x.status, 403);
    x = await ir(env, MASTER, 'DELETE', K + '/comentarios/' + id);
    assert.equal(x.status, 403, 'nem o master remove o de outra pessoa');
    x = await ir(env, DEV, 'PATCH', K + '/comentarios/' + id, { texto: 'Vi isto, e mais.' });
    assert.equal(x.comentario.texto, 'Vi isto, e mais.');
    assert.equal(uma(env, 'SELECT texto FROM kanban_comentarios WHERE id = ?', id).texto, 'Vi isto, e mais.');
    assert.equal((await ir(env, DEV, 'DELETE', K + '/comentarios/' + id)).ok, true);
    assert.equal((await quadro(env)).cartoes[0].comentarios, 1);
    assert.equal((await ir(env, DEV, 'PATCH', K + '/comentarios/' + id, { texto: 'x' })).status, 404, 'já foi removido');
    assert.equal((await ir(env, DEV, 'DELETE', K + '/comentarios/a%27b')).status, 404);
    assert.deepEqual((await rastoKanban(env)).slice(1),
      ['kanban.comentar ' + c.chave, 'kanban.comentar ' + c.chave, 'kanban.comentario.editar ' + c.chave, 'kanban.comentario.remover ' + c.chave]);
  });
});

/* KAN-116: em Human Tests o Martinho aceita ou recusa, e recusar é comentar
   o que está mal — o comentário de uma pessoa devolve o cartão a Auto Tests,
   a fila do Claude. Os cartões de um pedido seguem o pedido, e o Claude
   comenta sem mexer na coluna. */
describe('um comentário em Human Tests devolve o cartão a Auto Tests', () => {
  // o Claude como o scripts/kanban.mjs o assina (autor id «claude»), se algum dia passar pela rota
  const CLAUDE = { discordId: 'claude', nome: 'Claude', papel: 'dev', papeis: ['dev'] };
  const comentar = (env, eu, chave, texto) => ir(env, eu, 'POST', K + '/cartoes/' + chave + '/comentarios', { texto });
  const linhasColuna = (env, id) => todas(env, "SELECT antes, depois, autor_id, autor_nome FROM kanban_historico WHERE cartao_id = ? AND campo = 'coluna' ORDER BY id", id);

  test('de uma pessoa leva o cartão ao topo de Auto Tests, com a linha «coluna» assinada por ela', async () => {
    const env = ambiente();
    const ja = await novoCartao(env, MASTER, { coluna_id: 'auto-tests' });
    const c = await novoCartao(env, MASTER, { coluna_id: 'human-tests', titulo: 'O aviso no Samsung' });
    const r = await comentar(env, DEV, c.chave, 'No Samsung o aviso ainda não aparece.');
    assert.equal(r.status, 200);
    assert.equal(r.coluna_id, 'auto-tests', 'a resposta diz a coluna nova');
    assert.equal(r.comentario.texto, 'No Samsung o aviso ainda não aparece.');
    assert.deepEqual(await ordemDe(env, 'auto-tests'), [c.chave, ja.chave], 'no topo de Auto Tests');
    assert.deepEqual(await ordemDe(env, 'human-tests'), []);
    const k = uma(env, 'SELECT coluna_id, concluido_at, updated_at FROM kanban_cartoes WHERE id = ?', c.id);
    assert.deepEqual([k.coluna_id, k.concluido_at, k.updated_at], ['auto-tests', null, r.comentario.created_at]);
    assert.deepEqual(linhasColuna(env, c.id), [{ antes: 'human-tests', depois: 'auto-tests', autor_id: 'd1', autor_nome: 'Dina' }]);
    assert.deepEqual(todas(env, 'SELECT texto, autor_id FROM kanban_comentarios WHERE cartao_id = ?', c.id),
      [{ texto: 'No Samsung o aviso ainda não aparece.', autor_id: 'd1' }]);
    // já em Auto Tests: o comentário seguinte não mexe em nada
    const r2 = await comentar(env, SUPORTE, c.chave, 'E no Chrome também.');
    assert.equal(r2.coluna_id, 'auto-tests');
    assert.equal(linhasColuna(env, c.id).length, 1);
    assert.deepEqual((await rastoKanban(env)).filter((x) => x.startsWith('kanban.comentar')), ['kanban.comentar ' + c.chave, 'kanban.comentar ' + c.chave]);
    // numa coluna vazia, o lugar é o 0, como o mover para o topo
    const v = await novoCartao(env, MASTER, { coluna_id: 'human-tests' });
    await ir(env, DEV, 'POST', K + '/cartoes/' + ja.chave + '/mover', { coluna_id: 'a-fazer' });
    await ir(env, DEV, 'POST', K + '/cartoes/' + c.chave + '/mover', { coluna_id: 'a-fazer' });
    await comentar(env, DEV, v.chave, 'Falta o texto.');
    assert.equal(uma(env, 'SELECT posicao FROM kanban_cartoes WHERE id = ?', v.id).posicao, 0);
  });

  test('noutra coluna, do Claude ou num cartão de um pedido, o comentário não move', async () => {
    const env = ambiente();
    for (const col of ['a-fazer', 'auto-tests', 'concluido', 'para-depois']) {
      const c = await novoCartao(env, MASTER, { coluna_id: col });
      const antes = uma(env, 'SELECT coluna_id, posicao, concluido_at FROM kanban_cartoes WHERE id = ?', c.id);
      const r = await comentar(env, DEV, c.chave, 'Visto em ' + col + '.');
      assert.equal(r.status, 200);
      assert.equal(r.coluna_id, col, col + ': fica');
      assert.deepEqual(uma(env, 'SELECT coluna_id, posicao, concluido_at FROM kanban_cartoes WHERE id = ?', c.id), antes, col + ': nada muda');
      assert.deepEqual(linhasColuna(env, c.id), [], col + ': sem linha «coluna»');
    }
    // o Claude deixa a nota em Human Tests sem devolver o cartão
    const doClaude = await novoCartao(env, MASTER, { coluna_id: 'human-tests' });
    const rc = await comentar(env, CLAUDE, doClaude.chave, 'Feito.\n\nCommit: abc1234');
    assert.equal(rc.coluna_id, 'human-tests');
    assert.equal(uma(env, 'SELECT coluna_id FROM kanban_cartoes WHERE id = ?', doClaude.id).coluna_id, 'human-tests');
    assert.deepEqual(linhasColuna(env, doClaude.id), []);
    // o cartão de um pedido segue o pedido: em Human Tests, comentar não o move nem mexe no pedido
    const pid = await novoPedido(env, await novaConta(env));
    await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/aceitar');
    await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/fechar');
    const k = cartaoDaOrigem(env, 'pedido', pid);
    assert.equal(k.coluna_id, 'human-tests');
    const pedidoAntes = uma(env, 'SELECT * FROM tickets WHERE id = ?', pid);
    const rp = await comentar(env, SUPORTE, 'KAN-' + k.numero, 'Falei com a pessoa.');
    assert.equal(rp.coluna_id, 'human-tests');
    assert.equal(cartaoDaOrigem(env, 'pedido', pid).coluna_id, 'human-tests');
    assert.deepEqual(uma(env, 'SELECT * FROM tickets WHERE id = ?', pid), pedidoAntes);
  });

  test('num cartão de QA continua como antes: ticket e cartão a Auto Tests, de qualquer coluna', async () => {
    const env = ambiente();
    for (const col of ['a-fazer', 'human-tests', 'concluido']) {
      const { id } = await ir(env, DEV, 'POST', '/api/equipa/qa', { body: 'O botão não responde em ' + col, severity: 'incomoda' });
      const k = cartaoDaOrigem(env, 'qa', id);
      if (col !== 'a-fazer') await ir(env, DEV, 'POST', K + '/cartoes/KAN-' + k.numero + '/mover', { coluna_id: col });
      const r = await comentar(env, SUPORTE, 'KAN-' + k.numero, 'Ainda falha.');
      assert.equal(r.coluna_id, 'auto-tests', col);
      assert.equal(cartaoDaOrigem(env, 'qa', id).coluna_id, 'auto-tests', col + ': o cartão');
      assert.equal(uma(env, 'SELECT status FROM qa_tickets WHERE id = ?', id).status, 'auto-tests', col + ': o ticket');
      const ult = linhasColuna(env, k.id).pop();
      assert.deepEqual([ult.antes, ult.depois, ult.autor_id], [col, 'auto-tests', 's1'], col + ': a linha assinada por quem comentou');
      assert.equal(todas(env, 'SELECT id FROM kanban_comentarios WHERE cartao_id = ?', k.id).length, 1, col + ': o comentário uma vez');
    }
  });

  test('a regra pura: só pessoas, só Human Tests, nunca pedidos', () => {
    const k = (coluna_id, origem_tipo) => ({ coluna_id, origem_tipo: origem_tipo || null });
    assert.equal(colunaDepoisDoComentario(k('human-tests'), 'd1'), 'auto-tests');
    assert.equal(colunaDepoisDoComentario(k('human-tests', 'qa'), 'd1'), 'auto-tests');
    assert.equal(colunaDepoisDoComentario(k('human-tests', 'pedido'), 'd1'), 'human-tests');
    assert.equal(colunaDepoisDoComentario(k('human-tests'), 'claude'), 'human-tests');
    assert.equal(colunaDepoisDoComentario(k('human-tests'), 'automatico'), 'human-tests');
    for (const col of ['a-fazer', 'auto-tests', 'concluido', 'para-depois', 'uma-nova']) assert.equal(colunaDepoisDoComentario(k(col), 'd1'), col);
  });
});

/* ------------------------------- ligações ------------------------------- */

describe('as ligações', () => {
  test('bloqueia, é bloqueado por e relaciona-se; a repetida ou o próprio dão 409; bloqueado até o outro acabar', async () => {
    const env = ambiente();
    const [a, b, c] = [await novoCartao(env, DEV, { titulo: 'A' }), await novoCartao(env, DEV, { titulo: 'B' }), await novoCartao(env, DEV, { titulo: 'C' })];
    const ligar = (de, corpo) => ir(env, DEV, 'POST', K + '/cartoes/' + de.chave + '/ligacoes', corpo);
    const l = await ligar(a, { tipo: 'bloqueia', chave: b.chave });
    assert.deepEqual([l.ligacao.tipo, l.ligacao.cartao], ['bloqueia', { chave: b.chave, titulo: 'B', tipo: 'tarefa', coluna_id: 'a-fazer' }]);
    const bloqueados = async () => (await quadro(env)).cartoes.filter((x) => x.bloqueado).map((x) => x.chave);
    assert.deepEqual(await bloqueados(), [b.chave]);
    assert.equal((await ligar(b, { tipo: 'bloqueado', chave: a.chave })).status, 409, 'é a mesma ligação, vista do outro lado');
    assert.equal((await ligar(a, { tipo: 'relaciona', chave: c.chave })).status, 200);
    assert.equal((await ligar(c, { tipo: 'relaciona', chave: a.chave })).status, 409);
    assert.equal((await ligar(a, { tipo: 'bloqueia', chave: a.chave })).status, 409);
    const t = await ligar(a, { tipo: 'x', chave: b.chave });
    assert.equal(t.status, 400);
    assert.equal(t.campo, 'tipo');
    assert.equal((await ligar(a, { tipo: 'bloqueia', chave: 'abc' })).campo, 'chave');
    assert.equal((await ligar(a, { tipo: 'bloqueia', chave: 'KAN-99' })).status, 404);
    const c2 = await ligar(c, { tipo: 'bloqueado', chave: b.chave });
    assert.equal(c2.ligacao.tipo, 'bloqueado');
    assert.equal(uma(env, "SELECT COUNT(*) AS n FROM kanban_ligacoes WHERE de_id = ? AND para_id = ? AND tipo = 'bloqueia'", b.id, c.id).n, 1,
      'grava-se como B bloqueia C');
    assert.deepEqual(await bloqueados(), [c.chave, b.chave].sort().reverse());

    const vistaB = await ir(env, DEV, 'GET', K + '/cartoes/' + b.chave);
    assert.deepEqual(vistaB.ligacoes.map((x) => [x.tipo, x.cartao.chave]), [['bloqueado', a.chave], ['bloqueia', c.chave]]);
    assert.deepEqual(historicoDe(env, b.id).map((h) => h.depois), ['bloqueado ' + a.chave, 'bloqueia ' + c.chave]);

    // A acaba: deixa de bloquear B
    await ir(env, DEV, 'POST', K + '/cartoes/' + a.chave + '/mover', { coluna_id: 'concluido' });
    assert.deepEqual(await bloqueados(), [c.chave]);

    assert.equal((await ir(env, DEV, 'DELETE', K + '/ligacoes/' + l.ligacao.id)).ok, true);
    assert.deepEqual((await ir(env, DEV, 'GET', K + '/cartoes/' + b.chave)).ligacoes.map((x) => x.cartao.chave), [c.chave]);
    assert.deepEqual(historicoDe(env, b.id).slice(-1), [{ campo: 'ligacao', antes: 'bloqueado ' + a.chave, depois: null }]);
    assert.deepEqual(historicoDe(env, a.id).filter((h) => h.campo === 'ligacao').slice(-1), [{ campo: 'ligacao', antes: 'bloqueia ' + b.chave, depois: null }]);
    assert.equal((await ir(env, DEV, 'DELETE', K + '/ligacoes/' + l.ligacao.id)).status, 404);
  });
});

/* ------------------------------- anexos ------------------------------- */

describe('os anexos', () => {
  test('uma imagem vai para o R2 em kanban/<cartão>/<anexo> e volta com o tipo verdadeiro e a CSP dos anexos', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    const put = await corpoDe(await chamarCru(env, DEV, 'PUT', K + '/cartoes/' + c.chave + '/anexos', PNG,
      { 'Content-Type': 'application/octet-stream', 'X-Nome': encodeURIComponent('captura do ecrã.png') }));
    assert.equal(put.status, 201);
    const a = put.anexo;
    assert.deepEqual([a.nome, a.tipo, a.tamanho, a.url, a.autor.id], ['captura do ecrã.png', 'image/png', PNG.length, K + '/anexos/' + a.id, 'd1']);
    const chave = 'kanban/' + c.id + '/' + a.id;
    assert.ok(env.FILES.m.has(chave), 'no R2');
    assert.equal(uma(env, 'SELECT chave FROM kanban_anexos WHERE id = ?', a.id).chave, chave);
    const get = await chamar(env, SUPORTE, 'GET', a.url);
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('Content-Type'), 'image/png');
    assert.equal(get.headers.get('Content-Security-Policy'), CSP_ANEXO);
    assert.equal(get.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.deepEqual(new Uint8Array(await get.arrayBuffer()), PNG);
    assert.equal((await quadro(env)).cartoes[0].anexos, 1);
    assert.equal((await ir(env, DEV, 'DELETE', a.url)).ok, true);
    assert.ok(!env.FILES.m.has(chave), 'saiu do R2');
    assert.equal((await chamar(env, DEV, 'GET', a.url)).status, 404);
    assert.equal((await quadro(env)).cartoes[0].anexos, 0);
    assert.deepEqual(historicoDe(env, c.id), [{ campo: 'anexo', antes: null, depois: 'captura do ecrã.png' }, { campo: 'anexo', antes: 'captura do ecrã.png', depois: null }]);
    assert.deepEqual((await rastoKanban(env)).slice(1), ['kanban.anexar ' + c.chave, 'kanban.anexo.remover ' + c.chave]);
  });

  test('só PNG, JPEG ou WebP pelos bytes, até 5 MB, e não vazia; o nome sem X-Nome, ou malformado', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    const put = (corpo, headers) => chamarCru(env, DEV, 'PUT', K + '/cartoes/' + c.chave + '/anexos', corpo, headers);
    assert.equal((await put(new TextEncoder().encode('<svg onload=alert(1)>'), { 'Content-Type': 'image/png' })).status, 415);
    assert.equal((await put(new Uint8Array(0))).status, 400);
    assert.equal((await put(PNG, { 'Content-Length': String(5 * 1024 * 1024 + 1) })).status, 413);
    const grande = new Uint8Array(5 * 1024 * 1024 + 1);
    grande.set(PNG);
    assert.equal((await put(grande)).status, 413);
    assert.equal(env.FILES.m.size, 0, 'nada chegou ao R2');
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
    assert.equal((await corpoDe(await put(jpeg))).anexo.nome, 'imagem.jpg');
    assert.equal((await corpoDe(await put(PNG, { 'X-Nome': '%E0%A4%A' }))).anexo.nome, '%E0%A4%A');
    assert.equal((await corpoDe(await put(PNG, { 'X-Nome': encodeURIComponent('../../a\u0000b.png') }))).anexo.nome, '..-..-ab.png');
    assert.equal((await chamarCru(env, DEV, 'PUT', K + '/cartoes/KAN-9/anexos', PNG)).status, 404);
    assert.equal((await chamar(env, DEV, 'GET', K + '/anexos/nao-ha')).status, 404);
  });
});

/* ------------------------------- colunas ------------------------------- */

describe('as colunas', () => {
  test('só o master: criar no fim, mudar o nome e o fim, ordenar e remover a vazia', async () => {
    const env = ambiente();
    for (const [m, p, corpo] of [['POST', '/colunas', { nome: 'X' }], ['PATCH', '/colunas/a-fazer', { nome: 'X' }],
      ['POST', '/colunas/ordem', { ids: [] }], ['DELETE', '/colunas/para-depois']]) {
      const r = await ir(env, DEV, m, K + p, corpo);
      assert.equal(r.status, 403, m + ' ' + p);
      assert.match(r.error, /Só o master/);
    }
    const r = await ir(env, MASTER, 'POST', K + '/colunas', { nome: '  Em   revisão ' });
    assert.deepEqual({ ...r.coluna, id: 'x' }, { id: 'x', nome: 'Em revisão', ordem: 6, fim: false, fixa: false, total: 0 });
    const col = r.coluna;
    let x = await ir(env, MASTER, 'POST', K + '/colunas', { nome: 'EM REVISÃO' });
    assert.equal(x.status, 409);
    assert.equal(x.campo, 'nome');
    assert.equal((await ir(env, MASTER, 'POST', K + '/colunas', { nome: ' ' })).campo, 'nome');
    assert.equal((await ir(env, MASTER, 'POST', K + '/colunas', { nome: 'x'.repeat(61) })).campo, 'nome');
    assert.equal((await ir(env, MASTER, 'POST', K + '/colunas', { nome: 'Y', fim: 'sim' })).campo, 'fim');

    const c = await novoCartao(env, MASTER, { coluna_id: col.id });
    x = await ir(env, MASTER, 'PATCH', K + '/colunas/' + col.id, { fim: true });
    assert.equal(x.coluna.fim, true);
    assert.equal(x.coluna.total, 1);
    assert.equal(typeof uma(env, 'SELECT concluido_at FROM kanban_cartoes WHERE id = ?', c.id).concluido_at, 'number');
    assert.equal((await quadro(env)).cartoes[0].concluido_at > 0, true);
    await ir(env, MASTER, 'PATCH', K + '/colunas/' + col.id, { fim: false, nome: 'Revisão' });
    assert.equal(uma(env, 'SELECT concluido_at FROM kanban_cartoes WHERE id = ?', c.id).concluido_at, null);
    assert.equal((await ir(env, MASTER, 'PATCH', K + '/colunas/concluido', { fim: false })).status, 409, 'a fixa só muda de nome');
    assert.equal((await ir(env, MASTER, 'PATCH', K + '/colunas/concluido', { nome: 'Feito' })).coluna.nome, 'Feito');
    assert.equal((await ir(env, MASTER, 'PATCH', K + '/colunas/a-fazer', { nome: 'feito' })).status, 409, 'nome repetido');
    assert.equal((await ir(env, MASTER, 'PATCH', K + '/colunas/nao-ha', { nome: 'Z' })).status, 404);

    const ids = ['para-depois', col.id, 'a-fazer', 'auto-tests', 'human-tests', 'concluido'];
    for (const mau of [ids.slice(1), ids.concat('a-fazer'), ['a-fazer', ...ids.slice(1).map((i) => (i === 'a-fazer' ? 'nao-ha' : i))], 'x']) {
      const o = await ir(env, MASTER, 'POST', K + '/colunas/ordem', { ids: mau });
      assert.equal(o.status, 400, JSON.stringify(mau));
      assert.equal(o.campo, 'ids');
    }
    const o = await ir(env, MASTER, 'POST', K + '/colunas/ordem', { ids });
    assert.deepEqual(o.colunas.map((cc) => cc.id), ids);
    assert.deepEqual((await quadro(env)).colunas.map((cc) => [cc.id, cc.ordem]), ids.map((id, i) => [id, i + 1]));

    assert.equal((await ir(env, MASTER, 'DELETE', K + '/colunas/a-fazer')).status, 409, 'fixa');
    assert.equal((await ir(env, MASTER, 'DELETE', K + '/colunas/' + col.id)).status, 409, 'tem um cartão');
    await ir(env, MASTER, 'POST', K + '/cartoes/' + c.chave + '/mover', { coluna_id: 'a-fazer' });
    assert.equal((await ir(env, MASTER, 'DELETE', K + '/colunas/' + col.id)).ok, true);
    assert.equal((await ir(env, MASTER, 'DELETE', K + '/colunas/' + col.id)).status, 404);
    assert.equal((await ir(env, MASTER, 'DELETE', K + '/colunas/para-depois')).ok, true, 'a Para depois não é fixa');
    assert.deepEqual((await auditoria(env)).filter((a) => a.acao.startsWith('kanban.coluna')).map((a) => a.acao),
      ['kanban.coluna.criar', 'kanban.coluna.mudar', 'kanban.coluna.mudar', 'kanban.coluna.mudar', 'kanban.coluna.ordenar',
        'kanban.coluna.remover', 'kanban.coluna.remover']);
    assert.equal((await auditoria(env)).find((a) => a.acao === 'kanban.coluna.criar').alvo, col.id);
  });

  test('o quadro tem no máximo 20 colunas', async () => {
    const env = ambiente();
    for (let i = 6; i <= 20; i++) assert.equal((await ir(env, MASTER, 'POST', K + '/colunas', { nome: 'C' + i })).status, 200);
    assert.equal((await ir(env, MASTER, 'POST', K + '/colunas', { nome: 'C21' })).status, 409);
  });
});

/* ------------------------------- o quadro ------------------------------- */

describe('o quadro', () => {
  test('as colunas com o total, os cartões por coluna e posição, as etiquetas, as pessoas e quem sou', async () => {
    const env = ambiente();
    await env.DB.prepare("INSERT INTO audit_log (at, quem, nome, papel, acao) VALUES (5, 's9', 'Sara', 'suporte', 'equipa.entrar')").run();
    await env.DB.prepare("INSERT INTO audit_log (at, quem, nome, papel, acao) VALUES (6, 'U123', 'Cliente', 'utilizador', 'casa.sair')").run();
    await env.DB.prepare("INSERT INTO audit_log (at, quem, nome, papel, acao) VALUES (7, 'c1', 'Carlos', 'comercial', 'equipa.entrar')").run();
    // um cartão importado do Jira, com o Claude como relator e outro nome
    env.DB._db.exec("INSERT INTO kanban_cartoes (id, numero, titulo, coluna_id, posicao, relator_id, relator_nome, created_at, updated_at, removed_at) VALUES ('j1', 90, 'Do Jira', 'a-fazer', 0, 'claude', 'Claude (Jira)', 9, 9, 9)");
    const a = await novoCartao(env, DEV, { etiquetas: ['qa', 'montra'] });
    const b = await novoCartao(env, DEV, { coluna_id: 'auto-tests', etiquetas: ['qa'], responsavel_id: 'claude' });
    const c = await novoCartao(env, DEV, { coluna_id: 'concluido' });
    const ana = await conta(env, 'Ana');
    const doQa = await resp(pedir(env, ana, '/api/qa', 'POST', { body: 'Do QA' }));
    const kq = 'KAN-' + cartaoDaOrigem(env, 'qa', doQa.id).numero;
    const q = await quadro(env, SUPORTE);
    assert.deepEqual(q.colunas.map((x) => [x.id, x.nome, x.ordem, x.fim, x.fixa, x.total]), [
      ['a-fazer', 'A fazer', 1, false, true, 2], ['auto-tests', 'Auto Tests', 2, false, true, 1], ['human-tests', 'Human Tests', 3, false, true, 0],
      ['concluido', 'Concluído', 4, true, true, 1], ['para-depois', 'Para depois', 5, false, false, 0],
    ]);
    assert.deepEqual(q.cartoes.map((x) => x.chave), [kq, a.chave, b.chave, c.chave], 'por coluna e, dentro dela, pela posição (sem o removido)');
    assert.equal(a.chave, 'KAN-91', 'o número segue o maior, mesmo de um removido');
    assert.deepEqual(q.etiquetas, ['montra', 'qa']);
    assert.deepEqual(q.pessoas, [
      { id: 'claude', nome: 'Claude' }, { id: 'd1', nome: 'Dina' }, { id: 's9', nome: 'Sara' }, { id: 's1', nome: 'Sofia' },
    ], 'sem a conta da app, sem um cargo de fora da equipa e sem a Sincronização');
    assert.deepEqual(q.eu, { id: 's1', nome: 'Sofia', master: false });
    assert.equal((await quadro(env, MASTER)).eu.master, true);
    const p = await ir(env, SUPORTE, 'GET', K + '/pessoas');
    assert.deepEqual(p.pessoas, q.pessoas);
    // as contagens das subtarefas: feitas são as de uma coluna de fim
    const e = await novoCartao(env, MASTER, { tipo: 'epico' });
    await novoCartao(env, MASTER, { pai: e.chave });
    await novoCartao(env, MASTER, { pai: e.chave, coluna_id: 'concluido' });
    assert.deepEqual((await quadro(env)).cartoes.find((x) => x.id === e.id).subtarefas, { total: 2, feitas: 1 });
  });

  test('os filtros: q pela chave, pelo título ou pela descrição; tipo; etiqueta; responsável; prioridade; épico', async () => {
    const env = ambiente();
    const e1 = await novoCartao(env, MASTER, { tipo: 'epico', titulo: 'Épico grande' });
    const t1 = await novoCartao(env, MASTER, { titulo: 'Exportar PDF', pai: e1.chave, etiquetas: ['montra'], prioridade: 1, responsavel_id: 'm1' });
    const t2 = await novoCartao(env, MASTER, { tipo: 'erro', titulo: 'Botão partido', descricao: 'Parte 100% das vezes', etiquetas: ['qa'], prioridade: 2 });
    const t3 = await novoCartao(env, MASTER, { tipo: 'historia', titulo: 'Outra', pai: e1.chave });
    const so = async (query, eu) => (await quadro(env, eu || MASTER, query)).cartoes.map((c) => c.chave).sort();
    const ch = (...cs) => cs.map((c) => c.chave).sort();
    assert.deepEqual(await so('?q=' + t1.chave), ch(t1));
    assert.deepEqual(await so('?q=kan-80'), ch(t1));
    assert.deepEqual(await so('?q=pdf'), ch(t1));
    assert.deepEqual(await so('?q=' + encodeURIComponent('100%')), ch(t2));
    assert.deepEqual(await so('?q=' + encodeURIComponent('0%_')), [], 'o % e o _ são letras, não curingas');
    assert.deepEqual(await so('?tipo=erro'), ch(t2));
    assert.deepEqual(await so('?tipo=erro,historia'), ch(t2, t3));
    assert.deepEqual(await so('?tipo=erro&tipo=epico'), ch(t2, e1));
    assert.deepEqual(await so('?etiqueta=QA'), ch(t2));
    assert.deepEqual(await so('?responsavel=eu'), ch(t1));
    assert.deepEqual(await so('?responsavel=eu', DEV), []);
    assert.deepEqual(await so('?responsavel=m1'), ch(t1));
    assert.deepEqual(await so('?prioridade=1,2'), ch(t1, t2));
    assert.deepEqual(await so('?pai=' + e1.chave), ch(t1, t3));
    assert.deepEqual(await so('?tipo=tarefa&etiqueta=qa'), []);
    const f = await quadro(env, MASTER, '?tipo=erro');
    assert.equal(f.colunas.find((c) => c.id === 'a-fazer').total, 4, 'o total é sem filtros');
    for (const mau of ['?tipo=x', '?prioridade=9', '?pai=abc']) assert.equal((await quadro(env, MASTER, mau)).status, 400, mau);
  });

  test('os filtros com todos os valores que cabem não passam dos 100 valores ligados da D1', async () => {
    const env = ambiente();
    await novoCartao(env);
    let maior = 0;
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => {
      const s = prepare(sql), bind = s.bind;
      s.bind = (...a) => { maior = Math.max(maior, a.length); return bind(...a); };
      return s;
    };
    const trinta = (f) => Array.from({ length: 30 }, (_, i) => f(i)).join(',');
    const query = '?q=x&tipo=erro,erro,tarefa,' + 'tarefa,'.repeat(25) + '&prioridade=1,01,1.0,' + '2,'.repeat(25) +
      '&etiqueta=' + trinta((i) => 'e' + i) + ',E1,e1&responsavel=' + trinta((i) => 'p' + i) + '&pai=' + trinta((i) => 'KAN-' + (i + 1)) + ',kan-1,1';
    const r = await quadro(env, MASTER, query);
    assert.equal(r.status, 200);
    assert.ok(maior <= 100, 'ligou ' + maior + ' valores');
  });
});

/* ------------------------------- as consultas ------------------------------- */

describe('o quadro gasta sempre as mesmas consultas', () => {
  /* Semeia n cartões direto na base, com etiquetas, comentários, anexos,
     ligações e filhos (o primeiro é o épico de todos).
     Recebe: env; n.
     Devolve: nada. */
  function semear(env, n) {
    const db = env.DB._db;
    const colunas = ['a-fazer', 'auto-tests', 'human-tests', 'concluido', 'para-depois'];
    db.exec('BEGIN');
    const cartao = db.prepare('INSERT INTO kanban_cartoes (id, numero, tipo, titulo, coluna_id, posicao, relator_id, pai_id, created_at, updated_at)' +
      " VALUES (?, ?, ?, ?, ?, ?, 'claude', ?, 1, 1)");
    const etiqueta = db.prepare('INSERT INTO kanban_etiquetas (cartao_id, etiqueta) VALUES (?, ?)');
    const comentario = db.prepare("INSERT INTO kanban_comentarios (id, cartao_id, autor_id, texto, created_at, updated_at) VALUES (?, ?, 'claude', 'x', 1, 1)");
    const anexo = db.prepare("INSERT INTO kanban_anexos (id, cartao_id, chave, tipo, tamanho, autor_id, created_at) VALUES (?, ?, 'k', 'image/png', 1, 'claude', 1)");
    const ligacao = db.prepare("INSERT INTO kanban_ligacoes (id, de_id, para_id, tipo, autor_id, created_at) VALUES (?, ?, ?, 'bloqueia', 'claude', 1)");
    for (let i = 1; i <= n; i++) {
      cartao.run('c' + i, i, i === 1 ? 'epico' : 'tarefa', 'Cartão ' + i, colunas[i % 5], i, i === 1 ? null : 'c1');
      etiqueta.run('c' + i, 'e' + (i % 7));
      etiqueta.run('c' + i, 'qa');
      comentario.run('m' + i, 'c' + i);
      if (i % 2 === 0) anexo.run('a' + i, 'c' + i);
      if (i > 1) ligacao.run('l' + i, 'c' + (i - 1), 'c' + i);
    }
    db.exec('COMMIT');
  }

  test('com 5 e com 200 cartões, o mesmo número de consultas', async () => {
    const gastos = [];
    for (const n of [5, 200]) {
      const env = ambiente();
      semear(env, n);
      const conta1 = contar(env);
      const q = await quadro(env, DEV);
      assert.equal(q.status, 200);
      assert.equal(q.cartoes.length, n);
      gastos.push(conta1.n);
      const c2 = q.cartoes.find((c) => c.chave === 'KAN-2');
      assert.deepEqual([c2.comentarios, c2.anexos, c2.etiquetas, c2.pai.chave], [1, 1, ['e2', 'qa'], 'KAN-1']);
      const epico = q.cartoes.find((c) => c.chave === 'KAN-1');
      assert.equal(epico.subtarefas.total, n - 1);
      assert.equal(epico.subtarefas.feitas, q.cartoes.filter((c) => c.coluna_id === 'concluido' && c.chave !== 'KAN-1').length);
      // o KAN-2 é bloqueado pelo KAN-1 (em auto-tests, não acabou); o KAN-4 pelo KAN-3 (em concluido, acabou)
      assert.equal(c2.bloqueado, true);
      assert.equal(q.cartoes.find((c) => c.chave === 'KAN-3').coluna_id, 'concluido');
      assert.equal(q.cartoes.find((c) => c.chave === 'KAN-4').bloqueado, false);
    }
    assert.equal(gastos[0], gastos[1], 'o número não cresce com os cartões');
    assert.ok(gastos[0] <= 5, 'são ' + gastos[0]);
  });
});

/* ------------------------------- os tickets de QA ------------------------------- */

describe('os tickets de QA levam o seu cartão', () => {
  test('criado pela app ou pelo back office, nasce em A fazer como Erro, com a etiqueta qa e a prioridade da gravidade', async () => {
    const env = ambiente();
    const ana = await conta(env, 'Ana');
    const daApp = await resp(pedir(env, ana, '/api/qa', 'POST', { body: 'O Guardar não responde\nna ficha do imóvel', severity: 'bloqueia' }));
    assert.equal(daApp.status, 201);
    const daEquipa = await ir(env, SUPORTE, 'POST', '/api/equipa/qa', { body: 'O filtro não guarda', severity: 'detalhe' });
    assert.equal(daEquipa.status, 201);
    const q = await quadro(env, DEV);
    assert.deepEqual(q.cartoes.map((c) => [c.titulo, c.tipo, c.coluna_id, c.prioridade, c.etiquetas, c.origem]), [
      ['O filtro não guarda', 'erro', 'a-fazer', 4, ['qa'], { tipo: 'qa', id: daEquipa.id, estado: 'a-fazer', existe: true }],
      ['O Guardar não responde', 'erro', 'a-fazer', 1, ['qa'], { tipo: 'qa', id: daApp.id, estado: 'a-fazer', existe: true }],
    ]);
    assert.equal(cartaoDaOrigem(env, 'qa', daApp.id).relator_id, 'automatico');
    const r = await ir(env, DEV, 'GET', K + '/cartoes/' + q.cartoes[1].chave);
    assert.equal(r.origem.resumo, 'O Guardar não responde\nna ficha do imóvel');
    assert.match(r.cartao.descricao, /Ticket de QA #[0-9A-F]{8} · gravidade: bloqueia\.$/);
  });

  test('reabrir volta a A fazer; remover e repor deixam a linha no histórico; repor o que não saiu não deixa', async () => {
    const env = ambiente();
    const { id } = await ir(env, DEV, 'POST', '/api/equipa/qa', { body: 'Algo partido' });
    // o scripts/qa.mjs resolve por SQL e leva o cartão pela mesma regra
    await env.DB.prepare("UPDATE qa_tickets SET status = 'human-tests', resolved_at = 1 WHERE id = ?").bind(id).run();
    assert.equal(await sincronizarKanban(env, { tipo: 'qa', id, estado: 'human-tests', agora: Date.now() }), true);
    assert.equal(cartaoDaOrigem(env, 'qa', id).coluna_id, 'human-tests');
    assert.equal((await ir(env, DEV, 'POST', '/api/equipa/qa/' + id + '/reabrir')).status, 200);
    const k = cartaoDaOrigem(env, 'qa', id);
    assert.deepEqual([k.coluna_id, k.origem_estado], ['a-fazer', 'a-fazer']);
    assert.equal((await ir(env, DEV, 'POST', '/api/equipa/qa/' + id + '/repor')).status, 200);
    assert.equal(uma(env, "SELECT COUNT(*) AS n FROM kanban_historico WHERE campo = 'origem'").n, 0, 'não estava removido');
    assert.equal((await ir(env, DEV, 'DELETE', '/api/equipa/qa/' + id)).status, 200);
    assert.equal((await ir(env, DEV, 'POST', '/api/equipa/qa/' + id + '/repor')).status, 200);
    assert.deepEqual(todas(env, "SELECT depois, autor_id FROM kanban_historico WHERE campo = 'origem' ORDER BY id"),
      [{ depois: 'removido', autor_id: 'automatico' }, { depois: 'reposto', autor_id: 'automatico' }]);
    assert.equal(cartaoDaOrigem(env, 'qa', id).removed_at, null, 'o cartão nunca saiu do quadro');
    assert.deepEqual(historicoDe(env, k.id).filter((h) => h.campo === 'coluna').map((h) => [h.antes, h.depois]),
      [['a-fazer', 'human-tests'], ['human-tests', 'a-fazer']]);
  });
});

/* ------------------------------- os pedidos ------------------------------- */

describe('os pedidos aceites levam o seu cartão', () => {
  test('aceitar cria uma História em A fazer com quem aceitou; responder, fechar e reabrir movem-na', async () => {
    const env = ambiente();
    const uid = await novaConta(env);
    const pid = await novoPedido(env, uid, { assunto: 'Exportar em PDF', corpo: 'Queria exportar.' });
    const url = (acao) => '/api/equipa/pedidos/' + pid + '/' + acao;
    const r = await ir(env, SUPORTE, 'POST', url('aceitar'), { texto: 'Só os movimentos.' });
    assert.equal(r.status, 200);
    assert.ok(r.pedido.accepted_at);
    const k = cartaoDaOrigem(env, 'pedido', pid);
    assert.deepEqual([k.numero, k.tipo, k.titulo, k.coluna_id, k.origem_estado, k.relator_id, k.relator_nome],
      [79, 'historia', 'Exportar em PDF', 'a-fazer', 'aceite', 's1', 'Sofia']);
    assert.match(k.descricao, /Alterações ao pedido \(mandam mais do que o pedido\):\nSó os movimentos\./);
    assert.deepEqual(todas(env, 'SELECT etiqueta FROM kanban_etiquetas WHERE cartao_id = ?', k.id), [{ etiqueta: 'suporte' }]);
    assert.equal((await ir(env, SUPORTE, 'GET', '/api/equipa/pedidos/' + pid)).cartao, 'KAN-79');

    assert.equal((await ir(env, SUPORTE, 'POST', url('responder'), { texto: 'Olá, já está.' })).status, 200);
    assert.equal(cartaoDaOrigem(env, 'pedido', pid).coluna_id, 'auto-tests');
    assert.equal((await ir(env, SUPORTE, 'POST', url('fechar'))).status, 200);
    assert.equal(cartaoDaOrigem(env, 'pedido', pid).coluna_id, 'human-tests');
    assert.equal((await ir(env, SUPORTE, 'POST', url('reabrir'))).status, 200);
    assert.equal(cartaoDaOrigem(env, 'pedido', pid).coluna_id, 'a-fazer');
    assert.deepEqual(historicoDe(env, k.id).map((h) => [h.antes, h.depois]),
      [['a-fazer', 'auto-tests'], ['auto-tests', 'human-tests'], ['human-tests', 'a-fazer']]);
    assert.deepEqual(todas(env, 'SELECT DISTINCT autor_id FROM kanban_historico WHERE cartao_id = ?', k.id), [{ autor_id: 's1' }]);
    // a nota e o atribuir não mexem no cartão
    await ir(env, SUPORTE, 'POST', url('nota'), { texto: 'Interna.' });
    await ir(env, SUPORTE, 'POST', url('atribuir'));
    assert.equal(historicoDe(env, k.id).length, 3);
    const lido = await ir(env, SUPORTE, 'GET', K + '/cartoes/KAN-79');
    assert.deepEqual(lido.origem, { tipo: 'pedido', id: pid, estado: 'aceite', existe: true, resumo: 'Exportar em PDF' });
  });

  test('só os pedidos das pessoas aceites: recusado, por decidir, um erro ou um de segurança não têm cartão', async () => {
    const env = ambiente();
    const uid = await novaConta(env);
    const recusado = await novoPedido(env, uid);
    assert.equal((await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + recusado + '/recusar', { texto: 'Não fazemos.' })).status, 200);
    const porDecidir = await novoPedido(env, uid);
    assert.equal((await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + porDecidir + '/responder', { texto: 'A ver.' })).status, 200);
    const seg = await novoPedido(env, uid, { categoria: 'seguranca', assunto: 'Limite atingido' });
    assert.equal((await ir(env, MASTER, 'POST', '/api/equipa/pedidos/' + seg + '/aceitar', { texto: 'Bloquear o IP.' })).status, 200);
    const erro = await novoPedido(env, uid, { categoria: 'server', assunto: 'TypeError' });
    assert.equal((await ir(env, DEV, 'POST', '/api/equipa/pedidos/' + erro + '/fechar')).status, 200);
    assert.equal(uma(env, 'SELECT COUNT(*) AS n FROM kanban_cartoes').n, 0);
    assert.equal((await ir(env, SUPORTE, 'GET', '/api/equipa/pedidos/' + porDecidir)).cartao, null);
  });

  test('mover o cartão à mão não mexe no pedido', async () => {
    const env = ambiente();
    const pid = await novoPedido(env, await novaConta(env));
    await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/aceitar');
    const antes = uma(env, 'SELECT * FROM tickets WHERE id = ?', pid);
    assert.equal((await ir(env, DEV, 'POST', K + '/cartoes/KAN-79/mover', { coluna_id: 'concluido' })).status, 200);
    assert.deepEqual(uma(env, 'SELECT * FROM tickets WHERE id = ?', pid), antes);
  });
});

/* ------------------- a descrição de um pedido só a quem vê os pedidos ------------------- */

describe('a descrição de um pedido só a quem vê os pedidos', () => {
  /* Um pedido aceite pelo suporte, com a descrição mudada uma vez (para o
     histórico ter uma linha «descricao»), um comentário, e um cartão normal
     com uma descrição que fala no mesmo.
     Recebe: nada.
     Devolve: promessa de {env, pid, pedido: a chave do cartão do pedido, normal: o cartão normal}. */
  async function cenario() {
    const env = ambiente();
    const pid = await novoPedido(env, await novaConta(env), { assunto: 'Exportar em PDF', corpo: 'O meu NIF é 123456789 e quero exportar.' });
    assert.equal((await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/aceitar', { texto: 'Só os movimentos.' })).status, 200);
    const pedido = 'KAN-' + cartaoDaOrigem(env, 'pedido', pid).numero;
    assert.equal((await ir(env, SUPORTE, 'PATCH', K + '/cartoes/' + pedido, { descricao: 'O NIF 123456789 pede o PDF.' })).status, 200);
    await ir(env, SUPORTE, 'POST', K + '/cartoes/' + pedido + '/comentarios', { texto: 'Falei com a pessoa.' });
    const normal = await novoCartao(env, DEV, { titulo: 'Rever o NIF', descricao: 'Validar o NIF no registo.' });
    return { env, pid, pedido, normal };
  }

  test('com o dev e o admin a descrição fica oculta; com o suporte e o master aparece', async () => {
    const { env, pedido, normal } = await cenario();
    for (const eu of [DEV, ADMIN]) {
      const r = await ir(env, eu, 'GET', K + '/cartoes/' + pedido);
      assert.equal(r.status, 200, eu.nome);
      assert.equal(r.cartao.descricao, '', eu.nome);
      assert.equal(r.cartao.descricaoOculta, true, eu.nome);
      assert.equal(r.cartao.titulo, 'Exportar em PDF', 'o título (o assunto) continua');
      assert.deepEqual([r.origem.tipo, r.origem.estado, r.origem.resumo], ['pedido', 'aceite', null], 'sem o resumo');
      assert.deepEqual(r.historico.filter((h) => h.campo === 'descricao').map((h) => [h.antes, h.depois]), [[null, null]], 'a linha fica, sem o texto');
      assert.deepEqual(r.comentarios.map((c) => c.texto), ['Falei com a pessoa.'], 'os comentários continuam');
      assert.doesNotMatch(JSON.stringify(r), /123456789|exportar\.|Só os movimentos/, eu.nome + ': nada do texto em lado nenhum');
      const q = await quadro(env, eu);
      assert.equal(q.cartoes.find((c) => c.chave === pedido).descricaoOculta, true);
      assert.equal('descricaoOculta' in q.cartoes.find((c) => c.chave === normal.chave), false, 'um cartão que não é de um pedido não leva a marca');
      assert.equal((await ir(env, eu, 'GET', K + '/cartoes/' + normal.chave)).cartao.descricao, 'Validar o NIF no registo.');
    }
    for (const eu of [SUPORTE, MASTER]) {
      const r = await ir(env, eu, 'GET', K + '/cartoes/' + pedido);
      assert.equal(r.cartao.descricao, 'O NIF 123456789 pede o PDF.', eu.nome);
      assert.equal('descricaoOculta' in r.cartao, false, eu.nome);
      assert.equal(r.origem.resumo, 'Exportar em PDF');
      const linha = r.historico.find((h) => h.campo === 'descricao');
      assert.match(linha.antes, /O meu NIF é 123456789 e quero exportar\.[\s\S]*Só os movimentos\./);
      assert.equal(linha.depois, 'O NIF 123456789 pede o PDF.');
      assert.equal('descricaoOculta' in (await quadro(env, eu)).cartoes.find((c) => c.chave === pedido), false);
    }
  });

  test('a pesquisa não deixa adivinhar o texto: só pela chave e pelo título', async () => {
    const { env, pedido, normal } = await cenario();
    const achados = async (eu, q) => (await quadro(env, eu, '?q=' + encodeURIComponent(q))).cartoes.map((c) => c.chave).sort();
    for (const eu of [DEV, ADMIN]) {
      assert.deepEqual(await achados(eu, '123456789'), [], eu.nome);
      assert.deepEqual(await achados(eu, 'PDF'), [pedido], 'pelo título, sim');
      assert.deepEqual(await achados(eu, 'NIF'), [normal.chave], 'a descrição dos outros cartões procura-se');
      assert.deepEqual(await achados(eu, pedido.toLowerCase()), [pedido], 'pela chave, sim');
    }
    for (const eu of [SUPORTE, MASTER]) {
      assert.deepEqual(await achados(eu, '123456789'), [pedido], eu.nome);
      assert.deepEqual(await achados(eu, 'NIF'), [normal.chave, pedido].sort());
    }
  });

  test('mudar a descrição de um pedido sem ver os pedidos dá 403; os outros campos mudam-se', async () => {
    const { env, pedido, normal } = await cenario();
    const descricao = () => uma(env, "SELECT descricao, prioridade FROM kanban_cartoes WHERE origem_tipo = 'pedido'");
    const antes = descricao();
    for (const corpo of [{ descricao: 'Outra coisa.' }, { descricao: 'Outra coisa.', prioridade: 1 }, { descricao: '' }]) {
      const r = await ir(env, DEV, 'PATCH', K + '/cartoes/' + pedido, corpo);
      assert.equal(r.status, 403, JSON.stringify(corpo));
      assert.equal(r.campo, 'descricao');
      assert.equal(r.error, 'Só quem vê os pedidos muda a descrição de um pedido.');
    }
    assert.equal((await ir(env, ADMIN, 'PATCH', K + '/cartoes/' + pedido, { descricao: 'x' })).status, 403);
    assert.deepEqual(descricao(), antes, 'nada mudou, nem a prioridade que vinha junto');
    const r = await ir(env, DEV, 'PATCH', K + '/cartoes/' + pedido, { prioridade: 1, etiquetas: ['suporte', 'dev'], titulo: 'Exportar em PDF (contas)' });
    assert.equal(r.status, 200);
    assert.equal(r.cartao.descricaoOculta, true);
    assert.deepEqual([r.cartao.prioridade, r.cartao.etiquetas, r.cartao.titulo], [1, ['dev', 'suporte'], 'Exportar em PDF (contas)']);
    assert.equal(descricao().descricao, antes.descricao);
    assert.equal((await ir(env, DEV, 'PATCH', K + '/cartoes/' + normal.chave, { descricao: 'Mudada pela Dina.' })).status, 200, 'num cartão normal, sim');
    assert.equal((await ir(env, MASTER, 'PATCH', K + '/cartoes/' + pedido, { descricao: 'Mudada pelo master.' })).status, 200);
    assert.equal(descricao().descricao, 'Mudada pelo master.');
  });
});

/* ------------------------------- a origem existe? ------------------------------- */

describe('a origem diz se o ticket está nesta base', () => {
  test('um pedido trazido da produção e um ticket de QA já apagado de vez: existe false; os daqui: true', async () => {
    const env = ambiente();
    // como o scripts/kanban.mjs sincronizar o deixa: o cartão de um pedido que só existe na produção
    const prod = { id: 'prod-pedido-1', subject: 'Da produção', body: 'Texto da produção.', accepted_changes: null };
    assert.equal(await sincronizarKanban(env, { tipo: 'pedido', id: prod.id, estado: 'aceite', agora: Date.now(),
      novo: Object.assign({ uuid: crypto.randomUUID() }, cartaoDoPedido(prod)) }), true);
    const pid = await novoPedido(env, await novaConta(env), { assunto: 'Daqui' });
    await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/aceitar');
    const fica = await ir(env, DEV, 'POST', '/api/equipa/qa', { body: 'Fica' });
    const sai = await ir(env, DEV, 'POST', '/api/equipa/qa', { body: 'Sai' });
    // a limpeza das 24 h apaga a linha do ticket; o cartão sobrevive-lhe
    env.DB._db.prepare('DELETE FROM qa_tickets WHERE id = ?').run(sai.id);
    const q = await quadro(env, SUPORTE);
    const existe = (id) => q.cartoes.find((c) => c.origem && c.origem.id === id).origem.existe;
    assert.deepEqual([existe(prod.id), existe(pid), existe(fica.id), existe(sai.id)], [false, true, true, false]);
    const chave = (id) => q.cartoes.find((c) => c.origem && c.origem.id === id).chave;
    for (const eu of [SUPORTE, DEV]) {
      const r = await ir(env, eu, 'GET', K + '/cartoes/' + chave(prod.id));
      assert.deepEqual([r.origem.tipo, r.origem.existe, r.origem.resumo], ['pedido', false, null], eu.nome);
    }
    assert.equal((await ir(env, SUPORTE, 'GET', K + '/cartoes/' + chave(prod.id))).cartao.descricao, 'Texto da produção.\n\nPedido #PRODPEDI.',
      'o texto vive no cartão, mesmo sem o ticket aqui');
    assert.deepEqual([(await ir(env, DEV, 'GET', K + '/cartoes/' + chave(pid))).origem.existe,
      (await ir(env, DEV, 'GET', K + '/cartoes/' + chave(sai.id))).origem.existe], [true, false]);
    const semOrigem = await novoCartao(env);
    assert.equal(semOrigem.origem, null);
  });
});

/* ------------------------------- na produção e com falhas ------------------------------- */

describe('o gancho na produção e quando o kanban falha', () => {
  test('sem ENV_NAME, aceitar e responder não tocam no kanban, e o detalhe do pedido fica como era', async () => {
    const env = ambiente({ ENV_NAME: undefined });
    const pid = await novoPedido(env, await novaConta(env));
    const c = contar(env);
    assert.equal((await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/aceitar')).status, 200);
    assert.equal((await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/responder', { texto: 'Olá.' })).status, 200);
    const d = await ir(env, SUPORTE, 'GET', '/api/equipa/pedidos/' + pid);
    assert.equal(d.status, 200);
    assert.equal('cartao' in d, false, 'a resposta da produção não ganha campos');
    assert.deepEqual(c.sql.filter((s) => /kanban_/.test(s)), [], 'nem uma consulta ao kanban');
    assert.equal(await sincronizarKanban(env, { tipo: 'qa', id: 'x', estado: 'aberto', agora: 1 }), false);
    assert.equal(uma(env, 'SELECT COUNT(*) AS n FROM kanban_cartoes').n, 0);
  });

  test('com a tabela dos cartões apagada, o pedido e o ticket de QA respondem como sempre', async () => {
    const env = ambiente();
    env.DB._db.exec('DROP TABLE kanban_cartoes');
    const erros = [];
    const errOriginal = console.error;
    console.error = (...a) => { erros.push(a.map(String).join(' ')); };
    try {
      const pid = await novoPedido(env, await novaConta(env));
      const a = await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/aceitar', { texto: 'Com uma alteração.' });
      assert.equal(a.status, 200);
      assert.ok(a.pedido.accepted_at, 'o pedido ficou aceite');
      assert.deepEqual(a.msgs.map((m) => m.tipo), ['nota']);
      const r = await ir(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/responder', { texto: 'Olá.' });
      assert.equal(r.status, 200);
      assert.equal(r.pedido.status, 'resolucao');
      const d = await ir(env, SUPORTE, 'GET', '/api/equipa/pedidos/' + pid);
      assert.equal(d.status, 200);
      assert.equal(d.cartao, null);
      const q = await ir(env, DEV, 'POST', '/api/equipa/qa', { body: 'Partido' });
      assert.equal(q.status, 201);
      assert.equal(uma(env, 'SELECT COUNT(*) AS n FROM qa_tickets').n, 1);
      assert.equal((await ir(env, DEV, 'POST', '/api/equipa/qa/' + q.id + '/reabrir')).status, 200);
      assert.equal((await ir(env, DEV, 'DELETE', '/api/equipa/qa/' + q.id)).status, 200);
      assert.deepEqual((await auditoria(env)).map((x) => x.acao), ['pedido.aceitar', 'pedido.responder']);
    } finally {
      console.error = errOriginal;
    }
    assert.ok(erros.length >= 4, 'cada falha ficou no console.error');
    assert.ok(erros.every((e) => /kanban/.test(e)));
  });
});
