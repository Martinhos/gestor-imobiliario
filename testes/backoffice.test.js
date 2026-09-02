// O back office: ações sobre contas, o fio dos pedidos, a operação e o
// rasto. É a parte da app onde a equipa mexe na vida de quem a usa — os
// testes correm o SQL a sério contra o esquema a sério (testes/lib/bd.js),
// porque aqui um JOIN errado não é um bug, é um incidente.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { baseDeTeste, kvFalso, r2Falso } from './lib/bd.js';
import { rotasEquipaApi } from '../worker/src/equipa-api.js';
import { auditar, registarOp } from '../worker/src/lib/auditoria.js';
import { getSessionUser, createSession } from '../worker/src/auth.js';

/* ------------------------------ armações ------------------------------- */

const MASTER = { discordId: 'm1', nome: 'Mestre', papel: 'master', papeis: ['master'] };
const SUPORTE = { discordId: 's1', nome: 'Sofia', papel: 'suporte', papeis: ['suporte'] };
const DEV = { discordId: 'd1', nome: 'Dina', papel: 'dev', papeis: ['dev'] };

function ambiente() {
  return { DB: baseDeTeste(), SESSIONS: kvFalso(), FILES: r2Falso() };
}

// chama a API como o index.js chama: com o caminho, o método e a sessão
function chamar(env, eu, method, path, corpo, query) {
  const url = new URL('https://x.pt' + path + (query || ''));
  const request = new Request(url, corpo
    ? { method, body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } }
    : { method });
  return rotasEquipaApi({ env, request, path, method, url, eu });
}
async function corpoDe(resposta) {
  assert.ok(resposta, 'a rota respondeu');
  return { status: resposta.status, ...(await resposta.json()) };
}

let seq = 0;
async function novaConta(env, extra) {
  const id = 'U' + String(++seq).padStart(7, '0');
  const o = Object.assign({ email: id.toLowerCase() + '@x.pt', nome: 'Pessoa', pass: 'h', google: null }, extra);
  await env.DB.prepare(
    'INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, google_sub) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, o.email, o.nome, o.pass, o.pass ? 's' : '', Date.now(), o.google).run();
  return id;
}
async function novoPedido(env, userId, extra) {
  const id = crypto.randomUUID();
  const o = Object.assign({ categoria: 'user', assunto: 'Ajuda', corpo: 'Não sei fazer X.' }, extra);
  await env.DB.prepare(
    `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, created_at, updated_at)
     VALUES (?, ?, 'problema', ?, ?, 'criado', ?, ?, ?)`
  ).bind(id, userId, o.assunto, o.corpo, o.categoria, Date.now(), Date.now()).run();
  return id;
}
const auditoria = async (env) =>
  (await env.DB.prepare('SELECT * FROM audit_log ORDER BY id').all()).results;

/* ------------------------------- rasto ---------------------------------- */

describe('o rasto', () => {
  test('escreve quem, o quê e porquê', async () => {
    const env = ambiente();
    assert.equal(await auditar(env, MASTER, 'conta.plano', 'U1', 'pediu upgrade'), true);
    const r = await auditoria(env);
    assert.equal(r.length, 1);
    assert.equal(r[0].quem, 'm1');
    assert.equal(r[0].acao, 'conta.plano');
    assert.equal(r[0].detalhe, 'pediu upgrade');
  });

  test('uma base avariada não faz a auditoria mentir que escreveu', async () => {
    const env = { DB: { prepare() { throw new Error('em baixo'); } } };
    assert.equal(await auditar(env, MASTER, 'x', null, null), false);
  });

  test('o batimento das operações regista e poda o que é velho', async () => {
    const env = ambiente();
    await env.DB.prepare('INSERT INTO op_log (op, at, ok) VALUES (?, ?, 1)')
      .bind('copia', Date.now() - 100 * 86400000).run();
    await registarOp(env, 'copia', true, '{"linhas":5}');
    const r = (await env.DB.prepare('SELECT * FROM op_log').all()).results;
    assert.equal(r.length, 1, 'a execução com 100 dias foi podada');
    assert.equal(r[0].detalhe, '{"linhas":5}');
  });

  test('só o master lê o rasto', async () => {
    const env = ambiente();
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/auditoria')).status, 403);
    assert.equal((await chamar(env, MASTER, 'GET', '/api/equipa/auditoria')).status, 200);
  });
});

/* -------------------------- ações sobre contas -------------------------- */

describe('ações sobre contas', () => {
  test('são só do master', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    for (const eu of [SUPORTE, DEV]) {
      const r = await chamar(env, eu, 'POST', '/api/equipa/pessoas/' + id + '/acao',
        { acao: 'sessoes', motivo: 'porque sim' });
      assert.equal(r.status, 403, eu.papel);
    }
  });

  test('sem motivo não se mexe', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    const r = await chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + id + '/acao',
      { acao: 'sessoes', motivo: 'ok' });
    assert.equal(r.status, 400);
  });

  test('mudar o plano persiste e deixa rasto duplo: a intenção e o feito', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    const r = await corpoDe(await chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + id + '/acao',
      { acao: 'plano', valor: 'plus', motivo: 'pagou o Plus por transferência' }));
    assert.equal(r.status, 200);
    assert.equal(r.quem.plano, 'plus');
    const rasto = await auditoria(env);
    assert.deepEqual(rasto.map((x) => x.acao), ['conta.plano', 'conta.plano.feito']);
    assert.match(rasto[0].detalhe, /transferência/);
  });

  test('um plano inventado é recusado, e o rasto mostra a falha', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    const r = await chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + id + '/acao',
      { acao: 'plano', valor: 'platina', motivo: 'engano meu' });
    assert.equal(r.status, 400);
    assert.equal((await auditoria(env)).pop().acao, 'conta.plano.falhou');
  });

  test('suspender trava a sessão que já estava aberta', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    const token = await createSession(env, id, 0);
    const pedido = new Request('https://x.pt/api/me', { headers: { Cookie: 'gi_session=' + token } });
    assert.ok(await getSessionUser(env, pedido), 'antes, entra');

    await chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + id + '/acao',
      { acao: 'suspender', motivo: 'conta comprometida' });
    assert.equal(await getSessionUser(env, pedido), null, 'depois, não');

    await chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + id + '/acao',
      { acao: 'reativar', motivo: 'falso alarme' });
    // reativar não ressuscita sessões antigas: o epoch subiu ao suspender
    assert.equal(await getSessionUser(env, pedido), null, 'a sessão velha morreu de vez');
    const u = await env.DB.prepare('SELECT suspended_at, sess_epoch FROM users WHERE id = ?').bind(id).first();
    assert.equal(u.suspended_at, null);
    assert.equal(u.sess_epoch, 1);
  });

  test('terminar sessões sobe o epoch e mata os tokens', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    const token = await createSession(env, id, 0);
    await chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + id + '/acao',
      { acao: 'sessoes', motivo: 'telemóvel perdido' });
    const pedido = new Request('https://x.pt/api/me', { headers: { Cookie: 'gi_session=' + token } });
    assert.equal(await getSessionUser(env, pedido), null);
  });

  test('limpar limites apaga só os da pessoa', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    const d = Date.now() + 900000;
    await env.DB.prepare('INSERT INTO rate_limits (k, n, expires_at) VALUES (?, 30, ?)').bind('acct:' + id, d).run();
    await env.DB.prepare('INSERT INTO rate_limits (k, n, expires_at) VALUES (?, 5, ?)').bind('login:1.2.3.4', d).run();
    const r = await corpoDe(await chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + id + '/acao',
      { acao: 'limpar-limites', motivo: 'ficou presa no login' }));
    assert.match(r.resultado, /\(1\)/);
    const resto = (await env.DB.prepare('SELECT k FROM rate_limits').all()).results;
    assert.deepEqual(resto.map((x) => x.k), ['login:1.2.3.4']);
  });

  test('mudar o email valida, recusa duplicados e normaliza', async () => {
    const env = ambiente();
    const a = await novaConta(env, { email: 'a@x.pt' });
    const b = await novaConta(env, { email: 'b@x.pt' });
    const acao = (valor) => chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + a + '/acao',
      { acao: 'email', valor, motivo: 'pediu por escrito' });
    assert.equal((await acao('isto não é um email')).status, 400);
    assert.equal((await acao('b@x.pt')).status, 400, 'já é de outra conta');
    const r = await corpoDe(await acao('  Novo@X.pt '));
    assert.equal(r.quem.email, 'novo@x.pt');
    assert.ok(b);
  });

  test('desligar o Google recusa numa conta só-Google', async () => {
    const env = ambiente();
    const soGoogle = await novaConta(env, { pass: '', google: 'g-123' });
    const comAmbos = await novaConta(env, { google: 'g-456' });
    const acao = (id) => chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + id + '/acao',
      { acao: 'desligar-google', motivo: 'conta google comprometida' });
    assert.equal((await acao(soGoogle)).status, 400, 'trancava a pessoa fora');
    assert.equal((await acao(comAmbos)).status, 200, 'com password, pode');
    const u = await env.DB.prepare('SELECT google_sub FROM users WHERE id = ?').bind(comAmbos).first();
    assert.equal(u.google_sub, null);
  });

  test('numa conta apagada já não se mexe', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    await env.DB.prepare('UPDATE users SET deleted_at = ? WHERE id = ?').bind(Date.now(), id).run();
    const r = await chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + id + '/acao',
      { acao: 'sessoes', motivo: 'tarde de mais' });
    assert.equal(r.status, 409);
  });

  test('a ficha diz como a pessoa entra', async () => {
    const env = ambiente();
    const id = await novaConta(env, { google: 'g-1' });
    const r = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/pessoas/' + id));
    assert.equal(r.quem.entrada, 'password + google');
    assert.equal(r.master, true);
  });
});

/* ---------------------------- o fio dos pedidos -------------------------- */

describe('o fio dos pedidos', () => {
  test('responder duas vezes guarda as duas; a app vê a última', async () => {
    const env = ambiente();
    const pid = await novoPedido(env, await novaConta(env));
    await chamar(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/responder', { texto: 'Primeira.' });
    const r = await corpoDe(await chamar(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/responder', { texto: 'Segunda.' }));
    assert.equal(r.msgs.length, 2, 'o fio guarda as duas');
    assert.equal(r.pedido.reply, 'Segunda.', 'a coluna que a app lê é a última');
    assert.equal(r.msgs[0].texto, 'Primeira.', 'e a primeira não se perdeu');
  });

  test('uma nota interna não toca na resposta que a pessoa vê', async () => {
    const env = ambiente();
    const pid = await novoPedido(env, await novaConta(env));
    await chamar(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/responder', { texto: 'Olá.' });
    const r = await corpoDe(await chamar(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/nota', { texto: 'parece o bug 42' }));
    assert.equal(r.pedido.reply, 'Olá.');
    assert.deepEqual(r.msgs.map((m) => m.tipo), ['resposta', 'nota']);
  });

  test('atribuir é tomar; repetir é largar', async () => {
    const env = ambiente();
    const pid = await novoPedido(env, await novaConta(env));
    let r = await corpoDe(await chamar(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/atribuir'));
    assert.equal(r.pedido.assignee, 's1');
    assert.equal(r.pedido.assignee_nome, 'Sofia');
    r = await corpoDe(await chamar(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/atribuir'));
    assert.equal(r.pedido.assignee, null);
  });

  test('reclassificar muda a categoria e pode tirá-lo da própria vista', async () => {
    const env = ambiente();
    const pid = await novoPedido(env, await novaConta(env));
    const r = await corpoDe(await chamar(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/categoria', { categoria: 'server' }));
    assert.equal(r.pedido.category, 'server');
    // depois de reclassificado, o suporte já não o abre — e é esse o objetivo
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/pedidos/' + pid)).status, 403);
    assert.equal((await chamar(env, DEV, 'GET', '/api/equipa/pedidos/' + pid)).status, 200);
  });

  test('a lista separa pedidos de pessoas e erros', async () => {
    const env = ambiente();
    const uid = await novaConta(env);
    await novoPedido(env, uid);
    await novoPedido(env, uid, { categoria: 'server', assunto: 'TypeError' });
    const pessoas = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/pedidos', null, '?tipo=pessoas'));
    const erros = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/pedidos', null, '?tipo=erros'));
    assert.deepEqual(pessoas.pedidos.map((p) => p.category), ['user']);
    assert.deepEqual(erros.pedidos.map((p) => p.category), ['server']);
  });

  test('cada ação no pedido deixa rasto', async () => {
    const env = ambiente();
    const pid = await novoPedido(env, await novaConta(env));
    await chamar(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/responder', { texto: 'Olá.' });
    await chamar(env, SUPORTE, 'POST', '/api/equipa/pedidos/' + pid + '/atribuir');
    const acoes = (await auditoria(env)).map((x) => x.acao);
    assert.deepEqual(acoes, ['pedido.responder', 'pedido.atribuir']);
  });
});

/* ----------------------------- respostas-tipo ---------------------------- */

describe('respostas-tipo', () => {
  test('criam-se, listam-se, e só o autor ou o master as apagam', async () => {
    const env = ambiente();
    const r = await corpoDe(await chamar(env, SUPORTE, 'POST', '/api/equipa/modelos',
      { titulo: 'Boas-vindas', texto: 'Olá! Obrigado por escreveres.' }));
    assert.equal(r.status, 201);
    const lista = await corpoDe(await chamar(env, DEV, 'GET', '/api/equipa/modelos'));
    assert.equal(lista.modelos.length, 1);
    assert.equal((await chamar(env, DEV, 'DELETE', '/api/equipa/modelos/' + r.id)).status, 403, 'a Dina não apaga o da Sofia');
    assert.equal((await chamar(env, MASTER, 'DELETE', '/api/equipa/modelos/' + r.id)).status, 200, 'o master sim');
  });
});

/* ------------------------------- operação ------------------------------- */

describe('a operação', () => {
  test('é de quem vê a infraestrutura', async () => {
    const env = ambiente();
    assert.equal((await chamar(env, SUPORTE, 'GET', '/api/equipa/operacao')).status, 403);
    assert.equal((await chamar(env, DEV, 'GET', '/api/equipa/operacao')).status, 403);
    assert.equal((await chamar(env, MASTER, 'GET', '/api/equipa/operacao')).status, 200);
  });

  test('o painel traz o batimento e o histórico das cópias', async () => {
    const env = ambiente();
    await registarOp(env, 'vigia', true);
    await registarOp(env, 'copia', false, 'rebentou');
    const r = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/operacao'));
    const ops = {};
    r.crons.forEach((c) => { ops[c.op] = c; });
    assert.equal(ops.vigia.ok, 1);
    assert.equal(ops.copia.ok, 0);
    assert.equal(r.historico.length, 1);
  });

  test('copiar agora escreve no R2, no batimento e no rasto', async () => {
    const env = ambiente();
    await novaConta(env);
    const r = await corpoDe(await chamar(env, MASTER, 'POST', '/api/equipa/operacao/copiar'));
    assert.equal(r.status, 200);
    assert.ok(r.copia.linhas > 0, 'copiou linhas');
    assert.equal([...env.FILES.m.keys()].length, 1, 'está no R2');
    const rasto = await auditoria(env);
    assert.equal(rasto[0].acao, 'operacao.copiar');
    const bat = await env.DB.prepare("SELECT * FROM op_log WHERE op = 'copia'").first();
    assert.match(bat.detalhe, /"manual":true/);
  });

  test('verificar uma cópia conta por tabela e bate certo com a base', async () => {
    const env = ambiente();
    await novaConta(env);
    await novaConta(env);
    await corpoDe(await chamar(env, MASTER, 'POST', '/api/equipa/operacao/copiar'));
    const dia = new Date().toISOString().slice(0, 10);
    const r = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/operacao/copias/' + dia + '/resumo'));
    assert.equal(r.status, 200);
    assert.equal(r.tabelas.users, 2, 'as duas contas estão na cópia');
    assert.equal(r.vivas.users, 2, 'e a base viva concorda');
    assert.equal(r.irreconheciveis, 0, 'nenhuma linha ilegível');
  });

  test('descarregar uma cópia fica no rasto — é sair com a base toda', async () => {
    const env = ambiente();
    await novaConta(env);
    await corpoDe(await chamar(env, MASTER, 'POST', '/api/equipa/operacao/copiar'));
    const dia = new Date().toISOString().slice(0, 10);
    const r = await chamar(env, MASTER, 'GET', '/api/equipa/operacao/copias/' + dia + '/descarregar');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('Content-Disposition'), /attachment/);
    assert.ok((await auditoria(env)).some((x) => x.acao === 'operacao.descarregar'));
  });
});

/* --------------------------- a conta suspensa ---------------------------- */

describe('a conta suspensa vista da app', () => {
  test('o login diz que está suspensa — mas só depois da password certa', async () => {
    // a frase está no rotas/auth.js depois do verifyPassword: dizer
    // "suspensa" a quem não provou ser o dono era contar o estado da conta
    // a estranhos. Aqui garante-se a ordem no próprio ficheiro.
    const { readFileSync } = await import('node:fs');
    const fonte = readFileSync(new URL('../worker/src/rotas/auth.js', import.meta.url), 'utf8');
    const verifica = fonte.indexOf('verifyPassword(String(b.password)');
    const suspensa = fonte.indexOf('está suspensa');
    assert.ok(verifica > -1 && suspensa > verifica, 'a suspensão só se revela a quem tem a password');
  });
});
