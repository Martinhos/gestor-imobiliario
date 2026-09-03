// O correio do Rendorium: o que sai, de quem sai, e o que nunca pode sair.
// O envio a sério é do Resend; aqui intercepta-se o fetch e verifica-se o
// envelope — remetentes certos, prefixo de ambiente, e a regra de ouro:
// sem chave, ninguém tenta enviar nada.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { enviarEmail, emailReporPassword, emailRespostaPedido, emailPedidoRecebido, numeroPedido, dominioDaCasa, REMETENTES } from '../worker/src/lib/correio.js';
import { baseDeTeste, kvFalso, r2Falso } from './lib/bd.js';
import { rotasEquipaApi } from '../worker/src/equipa-api.js';

const fetchReal = globalThis.fetch;
let capturados = [];
function armarFetch(estado = 200) {
  capturados = [];
  globalThis.fetch = async (url, opts) => {
    capturados.push({ url: String(url), corpo: JSON.parse(opts.body) });
    return new Response(estado === 200 ? '{"id":"x"}' : 'nope', { status: estado });
  };
}
afterEach(() => { globalThis.fetch = fetchReal; });

describe('o envelope', () => {
  test('sem chave não se tenta enviar nada — e diz-se porquê', async () => {
    armarFetch();
    const r = await enviarEmail({}, { para: 'a@x.pt', assunto: 'olá' });
    assert.equal(r.enviado, false);
    assert.match(r.motivo, /RESEND_API_KEY/);
    assert.equal(capturados.length, 0, 'nem um pedido saiu');
  });

  test('um destinatário inválido morre antes da rede', async () => {
    armarFetch();
    const r = await enviarEmail({ RESEND_API_KEY: 'k' }, { para: 'isto não é email', assunto: 'x' });
    assert.equal(r.enviado, false);
    assert.equal(capturados.length, 0);
  });

  test('os três remetentes têm o papel certo e o reply-to certo', () => {
    assert.match(REMETENTES.maquina.de, /no-reply@rendorium\.com/);
    assert.match(REMETENTES.maquina.responderA, /support@/, 'as pessoas respondem ao no-reply na mesma');
    assert.match(REMETENTES.suporte.de, /support@rendorium\.com/);
    assert.match(REMETENTES.geral.de, /general@rendorium\.com/);
  });

  test('fora de produção o assunto leva o ambiente à frente', async () => {
    armarFetch();
    await enviarEmail({ RESEND_API_KEY: 'k', ENV_NAME: 'dev' }, { para: 'a@x.pt', assunto: 'Olá' });
    assert.equal(capturados[0].corpo.subject, '[dev] Olá');
    armarFetch();
    await enviarEmail({ RESEND_API_KEY: 'k' }, { para: 'a@x.pt', assunto: 'Olá' });
    assert.equal(capturados[0].corpo.subject, 'Olá', 'em produção, limpo');
  });

  test('o Resend a recusar não rebenta nada — devolve o motivo', async () => {
    armarFetch(422);
    const r = await enviarEmail({ RESEND_API_KEY: 'k' }, { para: 'a@x.pt', assunto: 'x' });
    assert.equal(r.enviado, false);
    assert.match(r.motivo, /422/);
  });
});

describe('o correio das contas de teste vai para a caixa da casa', () => {
  test('o destinatario @teste.rendorium.com vira test@ e a conta fica no assunto', async () => {
    armarFetch();
    const r = await enviarEmail({ RESEND_API_KEY: 'k' }, { para: 'teste-ab12cd@teste.rendorium.com', assunto: 'Recebemos o teu pedido' });
    assert.equal(r.enviado, true);
    assert.deepEqual(capturados[0].corpo.to, ['test@rendorium.com']);
    assert.match(capturados[0].corpo.subject, /teste-ab12cd/, 'sabe-se de que sessao veio');
  });

  test('com dono e email registado, vai direto ao dev que criou a conta', async () => {
    const env = { RESEND_API_KEY: 'k', DB: baseDeTeste(), SESSIONS: kvFalso() };
    await env.DB.prepare(
      "INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, test_owner) VALUES ('T1', 'teste-t1@teste.rendorium.com', 'T', 'h', 's', 1, 'alice')"
    ).run();
    await env.SESSIONS.put('teste:email:alice', 'alice@gmail.com');
    armarFetch();
    await enviarEmail(env, { para: 'teste-t1@teste.rendorium.com', assunto: 'Recebemos o teu pedido' });
    assert.deepEqual(capturados[0].corpo.to, ['alice@gmail.com'], 'o correio segue para quem criou a conta');
    assert.match(capturados[0].corpo.subject, /teste-t1/);

    // outro dono sem email registado: fica na caixa da casa
    await env.DB.prepare(
      "INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, test_owner) VALUES ('T2', 'teste-t2@teste.rendorium.com', 'T', 'h', 's', 1, 'bob')"
    ).run();
    armarFetch();
    await enviarEmail(env, { para: 'teste-t2@teste.rendorium.com', assunto: 'Olá' });
    assert.deepEqual(capturados[0].corpo.to, ['test@rendorium.com']);
  });

  test('um destinatario normal nao e tocado', async () => {
    armarFetch();
    await enviarEmail({ RESEND_API_KEY: 'k' }, { para: 'pessoa@gmail.com', assunto: 'Ola' });
    assert.deepEqual(capturados[0].corpo.to, ['pessoa@gmail.com']);
  });

  test('dominioDaCasa reconhece o dominio e os subdominios, e mais nada', () => {
    assert.equal(dominioDaCasa('x@rendorium.com'), true);
    assert.equal(dominioDaCasa('bounces@send.rendorium.com'), true, 'o envelope do Resend e da casa');
    assert.equal(dominioDaCasa('a@teste.rendorium.com'), true);
    assert.equal(dominioDaCasa('x@rendorium.com.pt'), false, 'gralha nao e a casa');
    assert.equal(dominioDaCasa('x@meurendorium.com'), false);
    assert.equal(dominioDaCasa('x@gmail.com'), false);
    assert.equal(dominioDaCasa(''), false);
  });
});

describe('os emails concretos', () => {
  test('o de repor leva a ligação nas duas versões e vem da máquina', async () => {
    armarFetch();
    await emailReporPassword({ RESEND_API_KEY: 'k' }, 'a@x.pt', 'https://app.rendorium.com/?repor=abc');
    const c = capturados[0].corpo;
    assert.match(c.from, /no-reply@/);
    assert.match(c.text, /repor=abc/);
    assert.match(c.html, /repor=abc/);
    assert.match(c.text, /1 hora/);
  });

  test('o numero do pedido e o mesmo em todo o lado: 8 caracteres do id, sem hifens', () => {
    assert.equal(numeroPedido('ab12cd34-e5f6-7890-abcd-ef1234567890'), '#AB12CD34');
    assert.equal(numeroPedido('T1'), '#T1', 'ids curtos ficam como sao');
  });

  test('a confirmacao de rececao vem da maquina e cita o numero nas duas versoes', async () => {
    armarFetch();
    await emailPedidoRecebido({ RESEND_API_KEY: 'k' }, 'a@x.pt', 'ab12cd34-e5f6-7890-abcd-ef1234567890', 'Ajuda com renda');
    const c = capturados[0].corpo;
    assert.match(c.from, /no-reply@/);
    assert.match(c.subject, /#AB12CD34/);
    assert.match(c.text, /#AB12CD34/);
    assert.match(c.html, /#AB12CD34/);
    assert.match(c.text, /Ajuda com renda/);
  });

  test('o de resposta escapa o HTML do texto do suporte', async () => {
    armarFetch();
    await emailRespostaPedido({ RESEND_API_KEY: 'k' }, 'a@x.pt', 'Ajuda', 'usa <b>isto</b> & aquilo', 'T1-uuid-x');
    const c = capturados[0].corpo;
    assert.match(c.from, /support@/);
    assert.match(c.subject, /#T1UUIDX/, 'a resposta cita o numero');
    assert.ok(c.html.includes('&lt;b&gt;isto&lt;/b&gt; &amp; aquilo'), 'nada de HTML injetado no molde');
  });
});

describe('responder a um pedido dispara o email certo — e só esse', () => {
  const MASTER = { discordId: 'm1', nome: 'Mestre', papel: 'master', papeis: ['master'] };
  const chamar = (env, path, corpo) => rotasEquipaApi({
    env, ctx: null,
    request: new Request('https://x.pt' + path, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } }),
    path, method: 'POST', url: new URL('https://x.pt' + path), eu: MASTER,
  });

  test('pedido de pessoa → email para o dono; erro técnico → nunca', async () => {
    const env = { DB: baseDeTeste(), SESSIONS: kvFalso(), FILES: r2Falso(), RESEND_API_KEY: 'k', ENV_NAME: 'teste' };
    await env.DB.prepare(
      "INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES ('U1', 'dona@x.pt', 'Dona', 'h', 's', 1)"
    ).run();
    await env.DB.prepare(
      `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, created_at, updated_at)
       VALUES ('T1', 'U1', 'problema', 'Ajuda com renda', 'x', 'criado', 'user', 1, 1),
              ('T2', 'U1', 'problema', 'TypeError', 'stack', 'criado', 'server', 1, 1)`
    ).run();

    armarFetch();
    await chamar(env, '/api/equipa/pedidos/T1/responder', { texto: 'Já está resolvido.' });
    assert.equal(capturados.length, 1, 'um email, e só um');
    assert.deepEqual(capturados[0].corpo.to, ['dona@x.pt']);
    assert.match(capturados[0].corpo.subject, /Ajuda com renda/);
    assert.match(capturados[0].corpo.subject, /#T1/, 'o numero segue na resposta do back office');

    armarFetch();
    await chamar(env, '/api/equipa/pedidos/T2/responder', { texto: 'corrigido no deploy' });
    assert.equal(capturados.length, 0, 'um stack trace não é correio para ninguém');
  });
});
