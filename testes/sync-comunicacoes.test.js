// A migração das comunicações da duração de um contrato sobe à nuvem com a
// primeira alteração que alguém faça a esse contrato (KAN-127). A chave de
// c.fisco.comunicacoes passou do ano dos rendimentos para o ano do início do
// período (web/app/dados.js:migrarComunicacoes, a marca comunicacoesV=2), e a
// migração corre em cada leitura. Antes, a base da fusão a três era a forma
// local já migrada: o envio nunca levava nem a marca nem as chaves novas, e a
// leitura seguinte migrava outra vez o que o servidor ainda tinha — desmarcar
// uma comunicação migrada, ou mudar-lhe a data, voltava atrás.
// Agora a base de um contrato que o servidor tem por migrar fica com as
// comunicações de antes da migração (web/cloud/nucleo.js:contratoDaBase); o
// primeiro envio desse contrato (só quando ele muda) leva a migração, e a
// fusão ao ler usa a base migrada (nucleo.js:baseMigrada). Sem alteração,
// nada sobe. Uma base por migrar que já não é fresca espera pela leitura
// seguinte, como a das definições.
//
// O cliente inteiro (carregarTudo) a falar com o servidor a sério
// (testes/lib/api.js, a D1 de testes/lib/bd.js), sem espiões no meio.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, conta, pedir, estado, casa, registo } from './lib/api.js';
import { carregarTudo } from './arnes.js';

/* ------------------------------ armações ------------------------------- */

// Um valor de JSON copiado para este contexto (os objetos da app vivem noutro).
// Recebe: v — o valor. Devolve: a cópia.
const copia = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

const K = 'r:H1:contract:C1';

/* O contrato C1 de antes da migração: começou a 1/6/2022, e as comunicações
   da duração estão pelo ano dos rendimentos (2023 e 2024, as duas do período
   inicial). Migradas, ficam numa chave só, 2022, com a data mais antiga. */
const CONTRATO_VELHO = {
  name: 'T2 — Carla', propertyId: 'H1', rent: 500, notes: '', start: '2022-06-01', end: '2027-05-31',
  fisco: { estado: 'ativo', comunicacoes: { 2023: '2023-02-10', 2024: '2024-02-12' } },
};

/* Um aparelho com a app inteira e a nuvem ligada ao servidor de teste: o
   fetch vai ao handleApi com a sessão de quem está na app (CW.user), e as
   operações enviadas ficam em esp.ops. O render e o buildNav não pintam.
   Recebe: env; quem — a conta com sessão; antes (opcional) — o que pôr no
   aparelho antes de a app carregar.
   Devolve: { app, esp }. */
function aparelho(env, quem, antes) {
  const app = carregarTudo(antes ? { antes } : undefined);
  const esp = { ops: [] };
  app.fetch = async (url, opts) => {
    opts = opts || {};
    const corpo = opts.body ? JSON.parse(opts.body) : undefined;
    if (url === '/api/sync') esp.ops.push(...corpo.ops);
    return pedir(env, { token: app.CW.user.token }, url, opts.method || 'GET', corpo);
  };
  app.toast = () => {};
  app.setSyncBadge = () => {};
  app.render = () => {};
  app.buildNav = () => {};
  app.subirPendentes = () => {};
  app.CW.user = { id: quem.id, name: quem.name, email: quem.email, token: quem.token };
  return { app, esp };
}

// Lê o estado e aplica-o, sem o envio que o applyState agenda (os testes
// chamam o pushNow à mão).
// Recebe: app; env; quem. Devolve: a promessa de nada.
async function ler(app, env, quem) {
  const st = await estado(env, quem);
  assert.equal(st.status, 200);
  delete st.status;
  app.applyState(st);
  app.clearTimeout(app.pushTimer);
}

// Envia já o que houver por enviar. Recebe: app. Devolve: a promessa de nada.
async function enviar(app) { app.clearTimeout(app.pushTimer); await app.pushNow(); app.clearTimeout(app.pushTimer); }

// As operações ao contrato C1 entre as enviadas. Recebe: esp. Devolve: a lista.
const opsDoContrato = (esp) => esp.ops.filter((o) => o.kind === 'contract' && o.id === 'C1');

// O contrato C1 neste aparelho. Recebe: app. Devolve: o objeto (da app).
const contrato = (app) => app.db.contracts.find((c) => c.id === 'C1');

// O contrato C1 como está na D1. Recebe: env. Devolve: a promessa do objeto.
async function noServidor(env) {
  const r = await env.DB.prepare("SELECT data FROM records WHERE kind = 'contract' AND id = 'C1'").first();
  return JSON.parse(r.data);
}

/* Uma conta com a casa H1 e o contrato C1 no servidor.
   Recebe: c (opcional) — o contrato (CONTRATO_VELHO por omissão).
   Devolve: a promessa de { env, A }. */
async function contaComContrato(c) {
  const env = ambiente();
  const A = await conta(env, 'Ana');
  await casa(env, A, 'H1', { name: 'Soure', address: '' });
  await registo(env, 'H1', 'contract', 'C1', copia(c || CONTRATO_VELHO), A);
  return { env, A };
}

/* ------------------------------------------------------------- os casos */

describe('a migração das comunicações sobe com a primeira alteração do contrato', () => {
  test('a leitura migra; desmarcar a comunicação migrada e enviar: a leitura seguinte já não a tem', async () => {
    const { env, A } = await contaComContrato();
    const { app, esp } = aparelho(env, A);
    await ler(app, env, A);
    assert.deepEqual(copia(contrato(app).fisco.comunicacoes), { 2022: '2023-02-10' }, 'a leitura migra para a chave do período');
    assert.equal(contrato(app).fisco.comunicacoesV, 2);
    delete contrato(app).fisco.comunicacoes['2022'];
    await enviar(app);
    const ops = opsDoContrato(esp);
    assert.equal(ops.length, 1);
    assert.deepEqual(copia(ops[0].base.fisco.comunicacoes), { 2023: '2023-02-10', 2024: '2024-02-12' },
      'a base leva as comunicações como o servidor as tem');
    assert.equal(ops[0].base.fisco.comunicacoesV, undefined, 'e sem a marca');
    const s = await noServidor(env);
    assert.deepEqual(s.fisco.comunicacoes, {}, 'o servidor fica sem nenhuma');
    assert.equal(s.fisco.comunicacoesV, 2, 'e com a marca');
    await ler(app, env, A);
    assert.deepEqual(copia(contrato(app).fisco.comunicacoes), {}, 'a comunicação desmarcada não volta');
    const outro = aparelho(env, A).app;
    await ler(outro, env, A);
    assert.deepEqual(copia(contrato(outro).fisco.comunicacoes), {}, 'nem noutro aparelho');
  });

  test('mudar a data da comunicação migrada: a data nova fica', async () => {
    const { env, A } = await contaComContrato();
    const { app } = aparelho(env, A);
    await ler(app, env, A);
    contrato(app).fisco.comunicacoes['2022'] = '2023-05-20';
    await enviar(app);
    const s = await noServidor(env);
    assert.deepEqual(s.fisco.comunicacoes, { 2022: '2023-05-20' });
    assert.equal(s.fisco.comunicacoesV, 2);
    await ler(app, env, A);
    assert.deepEqual(copia(contrato(app).fisco.comunicacoes), { 2022: '2023-05-20' }, 'a data nova não volta à mais antiga');
  });

  test('sem nenhuma mudança no contrato, nada desse contrato sobe — nem depois de recarregar', async () => {
    const { env, A } = await contaComContrato();
    const { app, esp } = aparelho(env, A);
    await ler(app, env, A);
    await enviar(app);
    assert.equal(opsDoContrato(esp).length, 0, 'migrar ao ler não é uma alteração');
    await ler(app, env, A);
    await enviar(app);
    app.loadSnap();
    await enviar(app);
    assert.equal(opsDoContrato(esp).length, 0, 'nem na leitura seguinte, nem no arranque');
    const s = await noServidor(env);
    assert.deepEqual(s.fisco.comunicacoes, CONTRATO_VELHO.fisco.comunicacoes, 'o servidor fica como estava');
    assert.equal(s.fisco.comunicacoesV, undefined);
  });

  test('dois aparelhos migram o mesmo contrato e um muda outra coisa: o servidor fica migrado, com a marca e com a mudança', async () => {
    const { env, A } = await contaComContrato();
    const um = aparelho(env, A), dois = aparelho(env, A);
    await ler(um.app, env, A);
    await ler(dois.app, env, A);
    contrato(um.app).rent = 520;
    await enviar(um.app);
    let s = await noServidor(env);
    assert.equal(s.rent, 520, 'a mudança sobe');
    assert.deepEqual(s.fisco.comunicacoes, { 2022: '2023-02-10' }, 'e a migração com ela');
    assert.equal(s.fisco.comunicacoesV, 2);
    // o outro aparelho, com a leitura de antes, muda a nota
    contrato(dois.app).notes = 'Paga por transferência';
    await enviar(dois.app);
    s = await noServidor(env);
    assert.equal(s.rent, 520, 'a renda do outro aparelho fica');
    assert.equal(s.notes, 'Paga por transferência');
    assert.deepEqual(s.fisco.comunicacoes, { 2022: '2023-02-10' });
    assert.equal(s.fisco.comunicacoesV, 2);
    for (const x of [um.app, dois.app]) {
      await ler(x, env, A);
      assert.deepEqual(copia(contrato(x).fisco.comunicacoes), { 2022: '2023-02-10' });
      assert.equal(contrato(x).rent, 520);
      assert.equal(contrato(x).notes, 'Paga por transferência');
    }
  });

  test('um aparelho com a leitura velha não leva a migração por cima do que outro desmarcou; o que mudou nele fica', async () => {
    const { env, A } = await contaComContrato();
    const velho = aparelho(env, A), novo = aparelho(env, A);
    await ler(velho.app, env, A);
    await ler(novo.app, env, A);
    delete contrato(novo.app).fisco.comunicacoes['2022'];
    await enviar(novo.app);
    // o velho muda a renda, e a leitura dele já tem dois minutos
    contrato(velho.app).rent = 520;
    velho.app.migracoesLidasEm = Date.now() - 2 * 60000;
    await enviar(velho.app);
    assert.equal(opsDoContrato(velho.esp).length, 0, 'o contrato espera pela leitura seguinte');
    assert.equal(velho.app.migracoesPorLer, true, 'e o ciclo lê já');
    await ler(velho.app, env, A);
    assert.deepEqual(copia(contrato(velho.app).fisco.comunicacoes), {}, 'a comunicação desmarcada no outro fica desmarcada');
    assert.equal(contrato(velho.app).rent, 520, 'a renda mudada aqui fica');
    await enviar(velho.app);
    const s = await noServidor(env);
    assert.deepEqual(s.fisco.comunicacoes, {});
    assert.equal(s.fisco.comunicacoesV, 2);
    assert.equal(s.rent, 520);
  });

  test('a base por migrar fica no aparelho: o arranque espera pela primeira leitura, e então a migração sobe', async () => {
    const { env, A } = await contaComContrato();
    const { app, esp } = aparelho(env, A);
    await ler(app, env, A);
    const guardadas = JSON.parse(app.localStorage.getItem('gi_cloud_base_' + A.id) || '{}');
    assert.ok(guardadas[K], 'a base do contrato por migrar fica guardada');
    // a app fecha; no arranque seguinte, a comunicação é desmarcada antes de a leitura chegar
    app.loadSnap();
    const base = copia(app.bases[K]);
    assert.equal(base.fisco.comunicacoesV, undefined, 'a base guardada continua sem a marca');
    assert.deepEqual(base.fisco.comunicacoes, CONTRATO_VELHO.fisco.comunicacoes, 'e com as chaves por migrar');
    assert.deepEqual(copia(app.contratoDaBase(base)), base, 'contratoDaBase é idempotente');
    delete contrato(app).fisco.comunicacoes['2022'];
    await enviar(app);
    assert.equal(opsDoContrato(esp).length, 0, 'antes da primeira leitura não sobe');
    await ler(app, env, A);
    assert.deepEqual(copia(contrato(app).fisco.comunicacoes), {}, 'a fusão ao ler guarda o que se desmarcou');
    await enviar(app);
    assert.equal(opsDoContrato(esp).length, 1);
    const s = await noServidor(env);
    assert.deepEqual(s.fisco.comunicacoes, {});
    assert.equal(s.fisco.comunicacoesV, 2);
  });

  test('um contrato que já vem migrado do servidor comporta-se como antes', async () => {
    const migrado = copia(CONTRATO_VELHO);
    migrado.fisco = { estado: 'ativo', comunicacoes: { 2022: '2023-02-10' }, comunicacoesV: 2 };
    const { env, A } = await contaComContrato(migrado);
    const { app, esp } = aparelho(env, A);
    await ler(app, env, A);
    assert.equal(JSON.stringify(app.bases[K]), JSON.stringify(app.exportEntities()[K].data), 'a base é o contrato na forma local');
    const guardadas = JSON.parse(app.localStorage.getItem('gi_cloud_base_' + A.id) || '{}');
    assert.equal(guardadas[K], undefined, 'e não fica guardada');
    await enviar(app);
    assert.equal(opsDoContrato(esp).length, 0, 'sem mudança, nada sobe');
    contrato(app).rent = 520;
    await enviar(app);
    assert.equal(JSON.stringify(opsDoContrato(esp)[0].base), JSON.stringify({ rent: 500 }), 'só a renda, sem o bloco fiscal');
    delete contrato(app).fisco.comunicacoes['2022'];
    await enviar(app);
    await ler(app, env, A);
    assert.deepEqual(copia(contrato(app).fisco.comunicacoes), {});
    assert.equal((await noServidor(env)).rent, 520);
  });
});
