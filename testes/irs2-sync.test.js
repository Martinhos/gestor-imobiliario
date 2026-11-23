// Repor uma cópia, a versão mínima e o Splitwise perante a Declaração
// (KAN-148). Repor uma cópia antiga com sessão iniciada não apaga no servidor
// o que outros participantes ou outros aparelhos registaram depois dela, nem
// põe por cima o que o servidor tem mais recente (a cessação de um contrato),
// e a pergunta diz a data da cópia, que muda a conta e os outros aparelhos e
// quantos movimentos (por ano) e contratos saem; o envio que se segue não
// manda o «del» do que é de uma casa com outras pessoas (N004). O servidor
// recusa com 426 a escrita de uma versão abaixo da mínima, quando ela a diz,
// e a app tranca; ao voltar a rede lê a mínima outra vez (N103). O «Só desde»
// do Splitwise só corta por omissão com despesas importadas sem a chave, e a
// pré-visualização lista as que ficam antes e não estão no imóvel (N037). Num
// grupo com quem não é dono, a janela pergunta quem e a parte dessas pessoas
// sai do custo; o texto deixa de mandar escrever os outros do grupo como
// donos (N038). Uma data do CSV que não existe deixa a linha sem data (N104).
// E uma casa nova que sobe com quotas escritas e volta sem elas diz-se
// (N139). Dois clientes a sério (a app inteira com a nuvem, o
// fetch ligado ao worker) contra a D1 de teste, como em
// testes/fusao-dos-registos.test.js. Cada achado tem aqui pelo menos um
// assert que falhava antes.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { carregarApp, carregarTudo, limpar, repor } from './arnes.js';
import { ambiente, conta, casa, comproprietario, registo, pedir, resp } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

/* ------------------------------------------------------------- armações */

/* Um cliente a sério: a app inteira com a nuvem, o fetch ligado ao worker e
   a sessão da conta; o que pinta calado. Os ops de cada POST /api/sync ficam
   em app.__ops, os cabeçalhos do último pedido em app.__cab; com
   app.__semEstado = true a leitura do estado falha como sem rede.
   Recebe: env; quem — a conta.
   Devolve: o proxy da app. */
function cliente(env, quem) {
  const app = carregarTudo();
  const ops = [];
  app.fetch = (url, opts) => {
    opts = opts || {};
    app.__cab = opts.headers || {};
    if (url === '/api/state' && app.__semEstado) return Promise.reject(new Error('sem rede'));
    if (url === '/api/sync' && opts.body) ops.push(...JSON.parse(opts.body).ops);
    return handleApi(new Request('https://app.x.pt' + url, { method: opts.method || 'GET', headers: opts.headers, body: opts.body }), env, { waitUntil() {} });
  };
  app.__ops = ops;
  app.toast = () => {};
  app.setSyncBadge = () => {};
  app.render = () => {};
  app.buildNav = () => {};
  app.subirPendentes = () => {};
  app.CW.user = { id: quem.id, name: quem.name, email: quem.email, token: quem.token };
  return app;
}
// Lê o estado como o ciclo lê e desarma o envio que ele agenda.
async function ler(app) { await app.pullNow(true); app.clearTimeout(app.pushTimer); }
// Envia já o que houver por enviar.
async function enviar(app) { app.clearTimeout(app.pushTimer); await app.pushNow(); app.clearTimeout(app.pushTimer); }
// Deixa o relógio andar: o que se escreve a seguir fica com um instante maior no servidor.
const pausa = () => new Promise((r) => setTimeout(r, 15));
// O registo como a D1 o tem (null se não existe), com a marca de apagado.
const naBase = async (env, kind, id) => {
  const r = await env.DB.prepare('SELECT data, deleted FROM records WHERE kind = ? AND id = ?').bind(kind, id).first();
  return r ? Object.assign(JSON.parse(r.data), { __apagado: r.deleted }) : null;
};
/* Guarda uma cópia de segurança pelo caminho do botão (Definições › Guardar
   cópia: exportarSoMeu(driveSave)), com a descarga apanhada.
   Recebe: app.
   Devolve: {nome, conteudo} — o ficheiro. */
function guardarCopia(app) {
  let ficheiro = null;
  app.download = (nome, mime, conteudo) => { ficheiro = { nome, conteudo }; };
  app.exportarSoMeu(app.driveSave);
  return ficheiro;
}
/* Repõe uma cópia como o «Repor uma cópia», e diz que sim à pergunta.
   Recebe: app; ficheiro — {nome, conteudo}.
   Devolve: {pergunta, toasts} — o texto da pergunta (null se não houve) e os avisos. */
async function reporCopia(app, ficheiro) {
  const dito = { pergunta: null, toasts: [] };
  app.confirmModal = (t, txt, cb) => { dito.pergunta = txt; cb(); };
  app.closeAllModals = () => {};
  app.applyTheme = () => {};
  app.toast = (m) => { dito.toasts.push(m); };
  await app.bkLoad(ficheiro.conteudo, ficheiro.nome);
  app.clearTimeout(app.pushTimer);
  return dito;
}
const casaSoure = { name: 'Soure', address: '', freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '1' };
const contratoC1 = { name: 'T2 — Carla', propertyId: 'H1', rent: 500, start: '2025-01-01', end: '2029-12-31',
  fisco: { estado: 'declarado', numero: '9', finalidade: 'hp' } };
const renda = (app, id, m) => app.normTx({ id, kind: 'income', label: 'Renda', category: 'Rendas', sub: 'Renda mensal', amount: 500,
  date: `2026-${String(m).padStart(2, '0')}-05`, propertyId: 'H1', contractId: 'C1', periodo: `2026-${String(m).padStart(2, '0')}` });
// Termina o contrato C1 a 31/10/2026, motivo 02, como a ficha o grava.
function cessar(app) {
  const c = app.db.contracts.find((x) => x.id === 'C1');
  c.fisco = app.normFisco(Object.assign({}, c.fisco, { cessacao: { data: '2026-10-31', motivo: '02' } }));
}

/* ---------------------------------------------------- N004 — com sessão */

describe('N004 — repor uma cópia com sessão iniciada', () => {
  test('numa casa partilhada, as rendas do comproprietário e a cessação ficam no servidor, e a pergunta diz a data e que muda a conta', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
    await casa(env, A, 'H1', casaSoure);
    await comproprietario(env, A, B, ['H1']);
    await registo(env, 'H1', 'contract', 'C1', contratoC1, A);
    await registo(env, 'H1', 'tx', 'R1', Object.assign({}, renda({ normTx: (x) => x }, 'R1', 1)), A);
    const cA = cliente(env, A), cB = cliente(env, B);
    await ler(cA); await ler(cB);
    // a Ana guarda uma cópia «em fevereiro»
    const copia = guardarCopia(cA);
    assert.match(copia.nome, /^gestor-imobiliario-\d{4}-\d{2}-\d{2}\.json$/);
    await pausa();
    // depois: o Bruno regista as rendas de fevereiro a outubro, e a Ana termina o contrato
    for (let m = 2; m <= 10; m++) cB.db.transactions.push(renda(cB, 'R' + m, m));
    await enviar(cB); await ler(cA);
    cessar(cA);
    await enviar(cA); await ler(cB);
    assert.deepEqual((await naBase(env, 'contract', 'C1')).fisco.cessacao, { data: '2026-10-31', motivo: '02' });
    await pausa();
    // em novembro a Ana repõe a cópia de fevereiro e diz que sim
    const dito = await reporCopia(cA, copia);
    await enviar(cA); await ler(cB);
    for (let m = 2; m <= 10; m++) {
      const r = await naBase(env, 'tx', 'R' + m);
      assert.ok(r && !r.__apagado, 'a renda R' + m + ' do Bruno continua no servidor');
    }
    assert.deepEqual((await naBase(env, 'contract', 'C1')).fisco.cessacao, { data: '2026-10-31', motivo: '02' }, 'a cessação não volta atrás');
    assert.equal(cB.db.transactions.filter((t) => t.kind === 'income').length, 10, 'o Bruno vê as 10 rendas');
    assert.equal(cA.__ops.filter((o) => o.op === 'del').length, 0, 'nenhum «del» saiu da reposição');
    assert.match(dito.pergunta, /^Cópia de \d{2}\/\d{2}\/\d{4}\./);
    assert.match(dito.pergunta, /Tens sessão iniciada: repor muda a tua conta e os teus outros aparelhos, não só este\./);
    assert.match(dito.pergunta, /Não sai nenhum movimento nem contrato\./);
    assert.match(dito.pergunta, /Ficam como estão 10 registos mais recentes do que a cópia, ou de casas com outras pessoas\./);
  });

  test('também quando quem repõe é a comproprietária e a casa é do outro', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
    await casa(env, B, 'H1', casaSoure);
    await comproprietario(env, B, A, ['H1']);
    await registo(env, 'H1', 'contract', 'C1', contratoC1, B);
    const cA = cliente(env, A), cB = cliente(env, B);
    await ler(cA); await ler(cB);
    const copia = guardarCopia(cA);
    assert.ok(JSON.parse(copia.conteudo).properties.some((p) => p.id === 'H1'), 'a casa em compropriedade vai na cópia');
    await pausa();
    for (let m = 1; m <= 9; m++) cB.db.transactions.push(renda(cB, 'R' + m, m));
    await enviar(cB); await ler(cA);
    await pausa();
    await reporCopia(cA, copia);
    await enviar(cA);
    for (let m = 1; m <= 9; m++) assert.ok(!(await naBase(env, 'tx', 'R' + m)).__apagado, 'a renda R' + m + ' do dono fica');
  });

  test('uma conta, dois aparelhos: o que o outro aparelho fez depois da cópia fica, e o que a cópia tem e a conta já não tem volta', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1', casaSoure);
    await registo(env, 'H1', 'contract', 'C1', contratoC1, A);
    await registo(env, 'H1', 'tx', 'R1', renda({ normTx: (x) => x }, 'R1', 1), A);
    const telemovel = cliente(env, A), computador = cliente(env, A);
    await ler(telemovel); await ler(computador);
    const copia = guardarCopia(telemovel);
    await pausa();
    // no computador: as rendas de fevereiro a abril, a cessação, e a de janeiro apagada
    for (let m = 2; m <= 4; m++) computador.db.transactions.push(renda(computador, 'R' + m, m));
    cessar(computador);
    computador.db.transactions = computador.db.transactions.filter((t) => t.id !== 'R1');
    await enviar(computador); await ler(telemovel);
    assert.equal((await naBase(env, 'tx', 'R1')).__apagado, 1);
    await pausa();
    const dito = await reporCopia(telemovel, copia);
    await enviar(telemovel);
    for (let m = 2; m <= 4; m++) assert.ok(!(await naBase(env, 'tx', 'R' + m)).__apagado, 'a renda R' + m + ' do outro aparelho fica');
    assert.deepEqual((await naBase(env, 'contract', 'C1')).fisco.cessacao, { data: '2026-10-31', motivo: '02' });
    assert.equal((await naBase(env, 'tx', 'R1')).__apagado, 0, 'a renda que a cópia tem volta');
    assert.match(dito.pergunta, /Volta 1 movimento da cópia, que já não está na conta\./);
    assert.match(dito.pergunta, /Ficam como estão 4 registos mais recentes do que a cópia/);
  });

  test('o que é só meu e a conta já tinha antes da cópia, e a cópia não traz, sai — e a pergunta diz quantos por ano', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1', casaSoure);
    await registo(env, 'H1', 'contract', 'C1', contratoC1, A);
    await registo(env, 'H1', 'tx', 'R1', renda({ normTx: (x) => x }, 'R1', 1), A);
    await registo(env, 'H1', 'tx', 'R5', renda({ normTx: (x) => x }, 'R5', 5), A);
    const cA = cliente(env, A);
    await ler(cA);
    const copia = guardarCopia(cA);
    // a cópia foi feita depois de apagar a renda de maio neste aparelho, sem rede
    const j = JSON.parse(copia.conteudo);
    j.transactions = j.transactions.filter((t) => t.id !== 'R5');
    const dito = await reporCopia(cA, { nome: copia.nome, conteudo: JSON.stringify(j) });
    await enviar(cA);
    assert.match(dito.pergunta, /Sai 1 movimento \(2026: 1\), que não está na cópia\./);
    assert.equal((await naBase(env, 'tx', 'R5')).__apagado, 1, 'a reposição continua a repor o que é só meu');
    assert.equal((await naBase(env, 'tx', 'R1')).__apagado, 0);
  });

  test('sem conseguir ler a conta, não repõe e diz porquê', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1', casaSoure);
    await registo(env, 'H1', 'tx', 'R1', renda({ normTx: (x) => x }, 'R1', 1), A);
    const cA = cliente(env, A);
    await ler(cA);
    const copia = guardarCopia(cA);
    const j = JSON.parse(copia.conteudo);
    j.transactions = [];
    cA.__semEstado = true;
    const dito = await reporCopia(cA, { nome: copia.nome, conteudo: JSON.stringify(j) });
    assert.equal(dito.pergunta, null, 'não chega a perguntar');
    assert.deepEqual(dito.toasts, ['Para repor uma cópia com sessão iniciada, a app tem de ler a tua conta primeiro. Liga-te à internet e tenta outra vez.']);
    assert.deepEqual(cA.db.transactions.map((t) => t.id), ['R1']);
  });

  test('o envio a seguir à reposição não manda o «del» do que é de uma casa com outras pessoas, e a vigia acaba com ele', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
    await casa(env, A, 'H1', casaSoure);
    await comproprietario(env, A, B, ['H1']);
    await registo(env, 'H1', 'tx', 'X', renda({ normTx: (x) => x }, 'X', 3), B);
    const cA = cliente(env, A);
    await ler(cA);
    cA.reposicaoArmada = { lim: 0, chaves: { 'r:H1:tx:X': 1 }, ate: Date.now() + 60000 };
    cA.db.transactions = cA.db.transactions.filter((t) => t.id !== 'X');
    await enviar(cA);
    assert.equal(cA.__ops.filter((o) => o.op === 'del').length, 0);
    assert.equal((await naBase(env, 'tx', 'X')).__apagado, 0);
    assert.equal(cA.reposicaoArmada, null, 'a vigia acaba quando o envio chega');
    await ler(cA);
    assert.ok(cA.db.transactions.some((t) => t.id === 'X'), 'o estado seguinte devolve-o ao aparelho');
    // e o que a pessoa apaga depois sai como sempre
    cA.db.transactions = cA.db.transactions.filter((t) => t.id !== 'X');
    await enviar(cA);
    assert.equal((await naBase(env, 'tx', 'X')).__apagado, 1);
  });
});

/* -------------------------------------------- com a app só da base (sem nuvem) */

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

/* O que a app diz e abre durante um teste: os toasts, a última janela, a
   última confirmação e os erros junto aos campos.
   Devolve: {toasts, janela, confirmar, erros}. */
function semEcra() {
  const dito = { toasts: [], janela: null, confirmar: null, erros: [] };
  app.save = () => {};
  app.render = () => {};
  app.buildNav = () => {};
  app.applyTheme = () => {};
  app.closeModal = () => {};
  app.closeAllModals = () => {};
  app.toast = (m) => { dito.toasts.push(m); };
  app.openModal = (titulo, corpo, pe) => { dito.janela = { titulo, corpo, pe }; };
  app.confirmModal = (t, txt, cb) => { dito.confirmar = { t, txt, cb }; };
  app.falhaCampo = (id, msg) => { dito.erros.push({ id, msg }); };
  return dito;
}

describe('N004 — sem sessão, a pergunta da reposição', () => {
  beforeEach(() => {
    limpar(app);
    const db = app.db;
    db.properties.push(app.normProp({ id: 'P1', name: 'T2 Arroios' }));
    db.contracts.push(app.normContract({ id: 'C1', propertyId: 'P1', rent: 500 }), app.normContract({ id: 'C2', propertyId: 'P1', rent: 400 }));
    db.transactions.push(app.normTx({ id: 'T1', kind: 'income', amount: 500, date: '2025-12-05', propertyId: 'P1' }),
      app.normTx({ id: 'T2', kind: 'income', amount: 500, date: '2026-01-05', propertyId: 'P1' }),
      app.normTx({ id: 'T3', kind: 'income', amount: 500, date: '2026-02-05', propertyId: 'P1' }));
  });
  const copiaDe = (extra) => JSON.stringify(Object.assign({ properties: [{ id: 'P1', name: 'T2 Arroios' }], contracts: [{ id: 'C1', propertyId: 'P1', rent: 500 }],
    transactions: [{ id: 'T3', kind: 'income', amount: 500, date: '2026-02-05', propertyId: 'P1' }] }, extra));

  test('diz a data da cópia, os totais, e quantos movimentos por ano e contratos saem; com o sim substitui', () => {
    const dito = semEcra();
    app.bkLoad(copiaDe({ copia: { feitaEm: '2026-02-10T12:00:00.000Z' } }));
    assert.equal(dito.confirmar.txt, 'Cópia de 10/02/2026.<br>Repor substitui os dados deste aparelho pelos da cópia: 1 imóvel, 1 contrato e 1 movimento.'
      + '<br>Saem 2 movimentos (2025: 1; 2026: 1) e 1 contrato, que não estão na cópia.');
    dito.confirmar.cb();
    assert.deepEqual(app.db.transactions.map((t) => t.id), ['T3']);
    assert.equal(app.db.copia, undefined, 'o cabeçalho não fica na base');
  });

  test('sem cabeçalho, o dia vem do nome do ficheiro; colada, diz que não tem data', () => {
    const dito = semEcra();
    app.bkLoad(copiaDe(), 'gestor-imobiliario-2026-03-01.json');
    assert.match(dito.confirmar.txt, /^Cópia de 01\/03\/2026\./);
    app.bkLoad(copiaDe());
    assert.match(dito.confirmar.txt, /^Esta cópia não diz quando foi feita\./);
  });

  test('a cópia guardada leva o cabeçalho com o instante, à frente', () => {
    semEcra();
    let ficheiro = null;
    app.download = (nome, mime, conteudo) => { ficheiro = conteudo; };
    app.driveSave();
    const j = JSON.parse(ficheiro);
    assert.equal(Object.keys(j)[0], 'copia');
    assert.ok(Date.parse(j.copia.feitaEm) > 0);
    assert.ok(Array.isArray(j.transactions) && j.transactions.length === 3);
  });
});

/* ---------------------------------------------------------------- N103 */

describe('N103 — a versão mínima também no servidor', () => {
  const assets = (minima) => ({ fetch: async () => new Response(JSON.stringify({ versao: 80, minima })) });
  const op = (id) => ({ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id,
    data: { id, kind: 'expense', label: 'Obras', amount: 100, date: '2026-03-01', propertyId: 'H1' } });

  test('POST /api/sync de uma versão abaixo da mínima: 426 com a mínima, sem gravar; sem o cabeçalho passa como sempre', async () => {
    const env = ambiente({ ASSETS: assets(79) });
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1', casaSoure);
    const velha = await resp(pedir(env, A, '/api/sync', 'POST', { ops: [op('T1')] }, { 'X-Versao': '76' }));
    assert.equal(velha.status, 426);
    assert.equal(velha.erro, 'versao_minima');
    assert.equal(velha.minima, 79);
    assert.equal(await naBase(env, 'tx', 'T1'), null, 'nada gravado');
    const certa = await resp(pedir(env, A, '/api/sync', 'POST', { ops: [op('T2')] }, { 'X-Versao': '79' }));
    assert.equal(certa.status, 200);
    assert.equal(certa.results[0].ok, true);
    const semCab = await resp(pedir(env, A, '/api/sync', 'POST', { ops: [op('T3')] }));
    assert.equal(semCab.status, 200, 'as versões de antes do cabeçalho continuam a escrever');
    const lixo = await resp(pedir(env, A, '/api/sync', 'POST', { ops: [op('T4')] }, { 'X-Versao': 'abc' }));
    assert.equal(lixo.status, 200);
    // sem se saber a mínima (sem os assets), passa
    const env2 = ambiente();
    const B = await conta(env2, 'Bruno');
    await casa(env2, B, 'H1', casaSoure);
    assert.equal((await resp(pedir(env2, B, '/api/sync', 'POST', { ops: [op('T5')] }, { 'X-Versao': '1' }))).status, 200);
  });

  test('a app diz a versão em cada pedido e, com o 426, tranca com a mínima que o servidor disse', async () => {
    const env = ambiente({ ASSETS: assets(10000) });
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1', casaSoure);
    const cA = cliente(env, A);
    let gate = null;
    cA.gateAtualizar = (m) => { gate = m; };
    await ler(cA);
    assert.equal(cA.__cab['X-Versao'], String(cA.VERSAO));
    cA.db.transactions.push(cA.normTx({ id: 'T1', kind: 'expense', label: 'Obras', amount: 100, date: '2026-03-01', propertyId: 'H1' }));
    await enviar(cA);
    assert.equal(cA.CW.trancado, true);
    assert.equal(gate, 10000);
    assert.equal(await naBase(env, 'tx', 'T1'), null, 'o servidor não gravou');
    assert.ok(cA.db.transactions.some((t) => t.id === 'T1'), 'o que ficou por enviar fica no aparelho');
  });

  test('ao voltar a rede lê a mínima outra vez, e abaixo dela tranca', async () => {
    const a = carregarTudo();
    let gate = null;
    a.gateAtualizar = (m) => { gate = m; };
    let minima = a.VERSAO;
    a.fetch = async (url) => (url === '/versao.json' ? new Response(JSON.stringify({ versao: a.VERSAO, minima })) : new Response('{}'));
    await a.versaoMinimaAoVoltar();
    assert.notEqual(a.CW.trancado, true, 'na mínima, segue');
    minima = a.VERSAO + 1;
    await a.versaoMinimaAoVoltar();
    assert.equal(a.CW.trancado, true);
    assert.equal(gate, a.VERSAO + 1);
    assert.match(String(a.startSync), /addEventListener\('online', function \(\) \{ versaoMinimaAoVoltar\(\); syncCycle\(\); \}\)/);
  });
});

/* ------------------------------------------------------- Splitwise (N037, N038) */

/* O CSV como o Splitwise o exporta: Date, Description, Category, Cost,
   Currency e uma coluna por pessoa; no fim, o «Total balance» sem data.
   Recebe: linhas — as linhas do meio; cab (opcional) — o cabeçalho.
   Devolve: o texto. */
function csv(linhas, cab = 'Date,Description,Category,Cost,Currency,Ana,Tiago') {
  return [cab, '', ...linhas, '', ' ,Total balance, , ,EUR,0.00,0.00'].join('\n');
}
/* Lê o CSV como o swParse (sem abrir a janela) e escolhe o imóvel, a resposta
   à pergunta de quem não é dono, quem não é, e o «Só desde».
   Recebe: texto; {prop, desde, naoDonos ('0' por omissão), nao (os índices das colunas)}.
   Devolve: nada. */
function lerCsv(texto, { prop = 'v2', desde, naoDonos = '0', nao = [] } = {}) {
  const t = texto.trim();
  const rows = app.parseCsv(t, app.splitDelim(t.split('\n')[0]));
  app.swHead = rows[0].map((h) => String(h).trim());
  app.swRows = rows.slice(1);
  app.swEuros = {};
  app.swGrupo = { resp: '', nao: {} };
  app.window._swCols = app.swColunas();
  app.document.getElementById('sw_prop').value = prop;
  app.document.getElementById('sw_naoDonos').value = naoDonos;
  for (const i of app.window._swCols.pessoas) app.document.getElementById('sw_nd_' + i).checked = nao.includes(i);
  app.document.getElementById('sw_desde').value = desde === undefined ? app.swDesdeOmissao(prop) : desde;
}
function importar(texto, opcoes) {
  const dito = semEcra();
  lerCsv(texto, opcoes);
  app.swDo();
  return dito;
}
const doSplitwise = () => app.db.transactions.filter((t) => t.src === 'splitwise');
const lote = (d) => doSplitwise().forEach((t) => { t.batch = 'b' + new Date(d + 'T12:00:00').getTime(); });

describe('N037 — o «Só desde» por omissão e as despesas lançadas tarde', () => {
  beforeEach(() => {
    limpar(app);
    app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
    app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, comproprietariosFora: [] }));
    app.db.properties.push(app.normProp({ id: 'v2', name: 'T1 Graça', ownerIds: ['ana'] }));
  });
  const jan = '2026-01-15,Canalizador,Maintenance,120.00,EUR,120.00,-120.00';
  const mar = '2026-03-20,Condomínio março,Condominium,50.00,EUR,50.00,-50.00';
  const tarde = '2026-04-05,Reparar o esquentador,Maintenance,300.00,EUR,300.00,-300.00';

  test('a despesa lançada no Splitwise depois da importação, com a data de antes, entra por omissão; as já importadas ficam repetidas', () => {
    importar(csv([jan, mar]), { desde: '' });
    lote('2026-04-10');
    assert.equal(app.swDesdeOmissao('v2'), '', 'só despesas com a chave: nada a cortar');
    const dito = importar(csv([jan, mar, tarde]));
    assert.deepEqual(dito.toasts, ['1 despesa importada · 2 repetidas ignoradas.']);
    assert.deepEqual(doSplitwise().map((t) => t.label).sort(), ['Canalizador', 'Condomínio março', 'Reparar o esquentador']);
  });

  test('com despesas importadas sem a chave, o corte é só pela data delas', () => {
    importar(csv(['2025-09-10,Obras 2025,Maintenance,80.00,EUR,80.00,-80.00']), { desde: '' });
    doSplitwise().forEach((t) => { t.swKey = ''; });
    lote('2025-10-01');
    importar(csv([jan, mar]), { desde: '' });
    doSplitwise().filter((t) => t.swKey).forEach((t) => { t.batch = 'b' + new Date('2026-04-10T12:00:00').getTime(); });
    assert.equal(app.swDesdeOmissao('v2'), '2025-10-01', 'a importação com a chave não empurra o corte');
  });

  test('a pré-visualização lista as de antes do «Só desde» que não estão no imóvel, com a data, a descrição e o valor', () => {
    importar(csv([jan, mar]), { desde: '' });
    semEcra();
    lerCsv(csv([jan, mar, tarde]), { desde: '2026-04-10' });
    const h = app.swPrevHtml(app.swPrepare({ pid: 'v2', desde: '2026-04-10' }));
    assert.match(h, /3 despesas de antes do «Só desde»\./);
    assert.match(h, /Destas, 1 não está neste imóvel\. Se foi lançada no Splitwise depois da última importação, deixa o «Só desde» em branco para a importar:/);
    assert.match(h, /<td>05\/04\/2026<\/td><td class="u-ta-left u-ws-normal">Reparar o esquentador<\/td><td>300,00\s?€<\/td>/);
    assert.doesNotMatch(h, /<td>15\/01\/2026<\/td>/, 'a já importada não se lista');
  });

  /* as apagadas de propósito vivem no imóvel (N102): numa casa com outra conta o
     corte por omissão segue a regra das casas só minhas */
  test('numa casa com outra conta o corte por omissão é o das casas só minhas: as apagadas vivem no imóvel', () => {
    app.CW = { user: { id: 'ana' } };
    importar(csv([jan, mar], 'Date,Description,Category,Cost,Currency,Ana,Bruno'), { prop: 'v1', desde: '' });
    lote('2026-04-10');
    assert.equal(app.swDesdeOmissao('v1'), '');
    assert.equal(app.swDesdeOmissao('v2'), '');
  });
});

describe('N038 — o grupo do Splitwise com quem não é dono', () => {
  beforeEach(() => {
    limpar(app);
    app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
    app.db.properties.push(app.normProp({ id: 'v2', name: 'T1 Graça', ownerIds: ['ana'] }));
  });
  // a Ana é a 5.ª coluna (índice 5), o Tiago a 6.ª (índice 6)
  const TIAGO = 6;

  test('a janela pergunta, obrigatoriamente, se o grupo tem quem não é dono, e com o sim quem', () => {
    const dito = semEcra();
    lerCsv(csv(['2026-04-05,Reparar o esquentador,Maintenance,300.00,EUR,150.00,-150.00']), { naoDonos: '' });
    app.swMapModal();
    assert.match(dito.janela.corpo, /<label>O grupo do Splitwise tem alguém que não é dono deste imóvel\? <span class="req">\*<\/span>/);
    app.swDo();
    assert.deepEqual(dito.erros, [{ id: 'sw_naoDonos', msg: 'Diz se o grupo tem alguém que não é dono deste imóvel.' }]);
    assert.equal(doSplitwise().length, 0);
    app.swGrupo = { resp: '1', nao: {} };
    const h = app.swNaoDonosHtml(app.window._swCols);
    assert.match(h, /<label class="check"><input type="checkbox" id="sw_nd_6" data-change="swRefresh\(\)"> Tiago<\/label>/);
    lerCsv(csv(['2026-04-05,Reparar o esquentador,Maintenance,300.00,EUR,150.00,-150.00']), { naoDonos: '1' });
    app.swDo();
    assert.equal(dito.erros[1].id, 'sw_nd_5', 'com o sim, falta dizer quem');
  });

  test('a parte do inquilino sai do custo, pelos saldos — pagasse quem pagasse —, e fica nas notas', () => {
    const dito = importar(csv(['2026-04-05,Reparar o esquentador,Maintenance,300.00,EUR,150.00,-150.00',
      '2026-05-05,Pintura,Maintenance,200.00,EUR,-100.00,100.00',
      '2026-06-05,Lâmpadas do Tiago,Maintenance,40.00,EUR,40.00,-40.00',
      '2026-07-05,Fechadura,Maintenance,60.00,EUR,0.00,0.00']), { naoDonos: '1', nao: [TIAGO] });
    assert.deepEqual(doSplitwise().map((t) => [t.label, t.amount]), [['Reparar o esquentador', 150], ['Pintura', 100]]);
    assert.equal(doSplitwise()[0].notes, 'No Splitwise: 300,00 €. A parte de quem não é dono (150,00 €) ficou de fora.');
    assert.equal(doSplitwise()[0].swKey, app.normSwKey('2026-04-05|Reparar o esquentador|300.00|Maintenance'), 'a chave é a da linha, com o custo total');
    assert.deepEqual(dito.toasts, ['2 despesas importadas.']);
    const h = app.swPrevHtml(app.swPrepare({ pid: 'v2', naoDonos: [TIAGO] }));
    assert.match(h, /1 despesa que cabe só a quem não é dono: não é gasto dos donos\./);
    assert.match(h, /1 despesa fica de fora porque os saldos do Splitwise não dizem quem a pagou\./);
    assert.match(h, /<td>05\/07\/2026<\/td><td class="u-ta-left u-ws-normal">Fechadura<\/td>/);
  });

  test('o texto deixa de mandar escrever os outros do grupo como donos', () => {
    semEcra();
    lerCsv(csv(['2026-04-05,Reparar o esquentador,Maintenance,300.00,EUR,150.00,-150.00']), { naoDonos: '' });
    assert.doesNotMatch(app.swQuotaHtml('v2', 2), /quotas dos outros donos/);
    app.swGrupo = { resp: '1', nao: { [TIAGO]: true } };
    const h = app.swQuotaHtml('v2', 2);
    assert.match(h, /A app lança a parte dos donos de cada despesa: o custo menos a parte de quem não é dono, pelos saldos do Splitwise\./);
    assert.doesNotMatch(h, /quotas dos outros donos|Se a casa é partilhada/);
  });
});

describe('N104 — as datas do CSV do Splitwise que não existem', () => {
  beforeEach(() => {
    limpar(app);
    app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
    app.db.properties.push(app.normProp({ id: 'v2', name: 'T1 Graça', ownerIds: ['ana'] }));
  });

  test('«12/31/2025» e «2025-02-30» não são datas: a linha fica sem data e não entra', () => {
    assert.equal(app.isoDate('12/31/2025'), null);
    assert.equal(app.isoDate('31/12/2025'), '2025-12-31');
    assert.equal(app.isoDate('2024-02-29'), '2024-02-29');
    assert.equal(app.isoDate('2025-02-29'), null);
    const dito = importar(csv(['12/31/2025,Canalizador,Maintenance,120.00,EUR,120.00,-120.00',
      '2025-02-30,Condomínio,Condominium,50.00,EUR,50.00,-50.00',
      '2025-12-30,Pintura,Maintenance,80.00,EUR,80.00,-80.00'], 'Date,Description,Category,Cost,Currency,Ana'), { desde: '' });
    assert.deepEqual(doSplitwise().map((t) => t.date), ['2025-12-30']);
    assert.deepEqual(dito.toasts, ['1 despesa importada.']);
    assert.match(app.swPrevHtml(app.swPrepare({ pid: 'v2' })), /2 linhas sem uma data que se perceba\./);
  });
});

/* ------------------------------------------------------- N139 (o aviso) */

test('N139 — uma casa nova que sobe com quotas escritas e volta sem elas diz-se, uma vez', () => {
  const a = carregarTudo();
  const avisos = [];
  a.toast = (m) => { avisos.push(m); };
  a.lembrarQuotasDaCasaNova('H1', { name: 'Soure', comproprietariosFora: [{ id: 'f1', nome: 'Carla', quota: 50 }] });
  a.lembrarQuotasDaCasaNova('H2', { name: 'Graça', quotasHist: [{ desde: '2020-01-01' }] });
  a.lembrarQuotasDaCasaNova('H3', { name: 'Arroios', comproprietariosFora: null });
  const st = { houses: [{ id: 'H1', data: { name: 'Soure' } }, { id: 'H2', data: { name: 'Graça', quotasHist: [{ desde: '2020-01-01' }] } }, { id: 'H3', data: {} }] };
  const nomes = a.quotasQueNaoVieram(st);
  assert.deepEqual([...nomes], ['Soure']);
  a.avisarQuotasQueNaoVieram(nomes);
  assert.deepEqual(avisos, ['As quotas que tinhas escritas em Soure não vieram: confirma-as na ficha do imóvel.']);
  assert.deepEqual([...a.quotasQueNaoVieram(st)], [], 'cada casa diz-se uma vez');
});
