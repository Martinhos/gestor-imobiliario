// A casa partilhada não perde o que outra conta lhe juntou: a fusão a três da
// casa (worker/src/lib/permissoes.js:fundirTres, a mesma letra em
// web/cloud/nucleo.js), no envio e na leitura.
//
// Os três primeiros testes reproduzem a perda de 2026-10-25 (16 fotos e as
// tarefas de uma casa partilhada, gravada inteira por um aparelho com a cópia
// de antes): dois clientes a sério (a app inteira com a nuvem, o fetch ligado
// ao worker) contra a D1 de teste. Corridos contra o código de antes da fusão,
// os três chumbavam — a conta A lia a casa sem as tarefas e sem as fotos.
// Depois: a fusão campo a campo e item a item no servidor (tarefas, secções,
// fotos, a ordem, a remoção só do que se removeu, o colaborador, o cliente
// sem base, o PUT REST), a fusão na leitura do cliente, as bases no aparelho
// (o que se guarda, quando muda, o tamanho, o recarregar) e a prova de que o
// bloco da fusão é o mesmo nos dois lados.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { carregarTudo } from './arnes.js';
import { ambiente, conta, casa, comproprietario, cargo, darCargo, estado, sync, pedir, resp } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';
import { fundirTres } from '../worker/src/lib/permissoes.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

/* ------------------------------------------------------------- armações */

/* Um cliente a sério: a app inteira com a nuvem, com o fetch ligado ao
   worker (handleApi) e a sessão da conta; o que pinta e o selo calados. Os
   ops de cada POST /api/sync ficam em app.__ops.
   Recebe: env; quem — a conta; antes (opcional) — o que pôr no aparelho
   antes de a app carregar (como o arnês: antes(janela)).
   Devolve: o proxy da app. */
function cliente(env, quem, antes) {
  const app = carregarTudo(antes ? { antes } : undefined);
  const ops = [];
  app.fetch = (url, opts) => {
    opts = opts || {};
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
// Lê o estado como o ciclo lê (mesmo com uma janela aberta) e desarma o envio que ele agenda.
async function ler(app) { await app.pullNow(true); app.clearTimeout(app.pushTimer); }
// Envia já o que houver por enviar.
async function enviar(app) { app.clearTimeout(app.pushTimer); await app.pushNow(); app.clearTimeout(app.pushTimer); }
const casaDe = (app, id) => app.db.properties.find((p) => p.id === id);
// A casa como está na D1 (o JSON e a revisão).
async function naBase(env, id) {
  const r = await env.DB.prepare('SELECT data, rev FROM houses WHERE id = ?').bind(id).first();
  return Object.assign(JSON.parse(r.data), { __rev: r.rev });
}
const ids = (l) => (l || []).map((x) => x.id);
const tarefa = (id, nome, extra) => Object.assign({ id, nome, seccao: '', feita: false, feitaEm: '' }, extra);
const foto = (id, name) => ({ id, name, type: 'image/jpeg', size: 10, added: '2026-10-25' });
const TAREFAS = () => ({ seccoes: [{ id: 'S1', nome: 'Cozinha' }], itens: [
  tarefa('T1', 'Pintar', { seccao: 'S1' }), tarefa('T2', 'Trocar torneira')] });
const FOTOS = () => [foto('F1', 'Sala'), foto('F2', 'Dispensa 1')];
const copia = (o) => JSON.parse(JSON.stringify(o));

/* Uma casa H1 da Ana, partilhada com o Bruno por ligação.
   Recebe: dados (opcional) — o que a casa já tem.
   Devolve: {env, A, B}. */
async function partilhada(dados) {
  const env = ambiente();
  const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
  await casa(env, A, 'H1', Object.assign({ name: 'Soure', address: '' }, dados));
  await comproprietario(env, A, B, ['H1']);
  return { env, A, B };
}

/* Um put da casa H1 pelo /api/sync, com base ou sem ela.
   Recebe: env; quem; data; base (opcional).
   Devolve: o resultado da operação. */
async function porCasa(env, quem, data, base) {
  const op = { op: 'put', scope: 'house', houseId: 'H1', data };
  if (base !== undefined) op.base = base;
  return (await sync(env, quem, [op]))[0];
}

/* ------------------------------------------------------- a reprodução */

describe('a reprodução da perda', () => {
  for (const modo of ['muda o nome', 'só tem a cópia velha a diferir do retrato']) {
    test('comproprietário com a versão de antes que ' + modo + ': a Ana continua com as tarefas e as fotos', async () => {
      const { env, A, B } = await partilhada();
      const cA = cliente(env, A), cB = cliente(env, B);
      await ler(cA); await ler(cB);
      const hA = casaDe(cA, 'H1');
      hA.tarefas = TAREFAS(); hA.photos = FOTOS();
      await enviar(cA);
      if (modo === 'muda o nome') casaDe(cB, 'H1').name = 'Soure renovada';
      else cB.snap['h:H1'] = '#velho:1';   // como uma normalização nova: a casa difere do retrato sem ninguém lhe mexer
      await enviar(cB);
      await ler(cA);
      const h = casaDe(cA, 'H1');
      assert.equal(h.name, modo === 'muda o nome' ? 'Soure renovada' : 'Soure');
      assert.deepEqual(ids(h.tarefas.itens), ['T1', 'T2']);
      assert.deepEqual(ids(h.tarefas.seccoes), ['S1']);
      assert.deepEqual(ids(h.photos), ['F1', 'F2']);
      const st = await estado(env, B);
      const doB = st.houses.find((x) => x.id === 'H1').data;
      assert.deepEqual(ids(doB.photos), ['F1', 'F2'], 'o estado do Bruno também as tem');
      assert.deepEqual(ids(doB.tarefas.itens), ['T1', 'T2']);
    });
  }

  test('colaborador com house.edit e a versão de antes muda o nome: nada se perde', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana', { plano: 'pro' }), B = await conta(env, 'Bruno', { plano: 'pro' });
    await casa(env, A, 'H1', { name: 'Soure', value: 250000 });
    await cargo(env, A, 'Gestor', ['house.edit'], 'R1');
    await darCargo(env, A, B, 'R1', ['H1']);
    const cA = cliente(env, A), cB = cliente(env, B);
    await ler(cA); await ler(cB);
    const hA = casaDe(cA, 'H1');
    hA.tarefas = TAREFAS(); hA.photos = FOTOS();
    await enviar(cA);
    casaDe(cB, 'H1').name = 'Soure renovada';
    await enviar(cB);
    await ler(cA);
    const h = casaDe(cA, 'H1');
    assert.equal(h.name, 'Soure renovada');
    assert.deepEqual(ids(h.tarefas.itens), ['T1', 'T2']);
    assert.deepEqual(ids(h.photos), ['F1', 'F2']);
    assert.equal(h.value, 250000, 'o valor, que o cargo não vê, fica');
  });
});

/* ------------------------------------------------ a fusão no servidor */

describe('a fusão no servidor', () => {
  test('campo a campo: o nome de um e a morada do outro ficam os dois', async () => {
    const { env, A, B } = await partilhada();
    assert.ok((await porCasa(env, A, { id: 'H1', name: 'Soure 2', address: '', rooms: [] }, { name: 'Soure' })).ok);
    assert.ok((await porCasa(env, B, { id: 'H1', name: 'Soure', address: 'Rua B', rooms: [] }, { address: '' })).ok);
    const h = await naBase(env, 'H1');
    assert.equal(h.name, 'Soure 2');
    assert.equal(h.address, 'Rua B');
  });

  test('tarefas: as adicionadas dos dois lados ficam, cada uma no seu lugar', async () => {
    const base = { seccoes: [], itens: [tarefa('T1', 'Pintar')] };
    const { env, A, B } = await partilhada({ tarefas: base });
    await porCasa(env, A, { id: 'H1', tarefas: { seccoes: [], itens: [tarefa('T1', 'Pintar'), tarefa('T2', 'Torneira')] } }, { tarefas: base });
    await porCasa(env, B, { id: 'H1', tarefas: { seccoes: [], itens: [tarefa('T3', 'Estores'), tarefa('T1', 'Pintar')] } }, { tarefas: base });
    assert.deepEqual(ids((await naBase(env, 'H1')).tarefas.itens), ['T3', 'T1', 'T2'],
      'a do Bruno antes da T1, como ele a pôs; a da Ana no fim');
  });

  test('tarefas: a removida de um lado sai, e só ela', async () => {
    const base = { seccoes: [], itens: [tarefa('T1', 'a'), tarefa('T2', 'b'), tarefa('T3', 'c')] };
    const { env, A, B } = await partilhada({ tarefas: base });
    await porCasa(env, A, { id: 'H1', tarefas: { seccoes: [], itens: [tarefa('T1', 'a'), tarefa('T3', 'c')] } }, { tarefas: base });
    const doB = copia(base); doB.itens.push(tarefa('T4', 'd'));
    await porCasa(env, B, { id: 'H1', tarefas: doB }, { tarefas: base });
    assert.deepEqual(ids((await naBase(env, 'H1')).tarefas.itens), ['T1', 'T3', 'T4']);
  });

  test('tarefas: o mesmo campo mudado dos dois lados fica com o último; campos diferentes juntam-se', async () => {
    const base = { seccoes: [], itens: [tarefa('T1', 'Pintar'), tarefa('T2', 'Torneira')] };
    const { env, A, B } = await partilhada({ tarefas: base });
    const daA = copia(base); daA.itens[0].nome = 'Pintar sala'; daA.itens[1].feita = true; daA.itens[1].feitaEm = '2026-10-25';
    await porCasa(env, A, { id: 'H1', tarefas: daA }, { tarefas: base });
    const doB = copia(base); doB.itens[0].nome = 'Pintar quarto'; doB.itens[1].nome = 'Torneira da cozinha';
    await porCasa(env, B, { id: 'H1', tarefas: doB }, { tarefas: base });
    const [t1, t2] = (await naBase(env, 'H1')).tarefas.itens;
    assert.equal(t1.nome, 'Pintar quarto', 'a última a chegar');
    assert.equal(t2.nome, 'Torneira da cozinha');
    assert.equal(t2.feita, true, 'a marca da Ana fica');
    assert.equal(t2.feitaEm, '2026-10-25');
  });

  test('secções: adicionadas dos dois lados ficam, a removida de um lado sai', async () => {
    const base = { seccoes: [{ id: 'S1', nome: 'Cozinha' }, { id: 'S2', nome: 'Sala' }], itens: [] };
    const { env, A, B } = await partilhada({ tarefas: base });
    await porCasa(env, A, { id: 'H1', tarefas: { seccoes: [{ id: 'S1', nome: 'Cozinha' }, { id: 'S3', nome: 'WC' }], itens: [] } }, { tarefas: base });
    const doB = copia(base); doB.seccoes.push({ id: 'S4', nome: 'Quarto' });
    await porCasa(env, B, { id: 'H1', tarefas: doB }, { tarefas: base });
    assert.deepEqual(ids((await naBase(env, 'H1')).tarefas.seccoes), ['S1', 'S3', 'S4']);
  });

  test('fotos: a ordem de quem reordenou, o nome de quem renomeou e a nova no fim', async () => {
    const base = [foto('F1', 'Sala'), foto('F2', 'Cozinha'), foto('F3', 'Quarto')];
    const { env, A, B } = await partilhada({ photos: base });
    await porCasa(env, A, { id: 'H1', photos: [base[2], base[0], base[1]] }, { photos: base });
    const doB = copia(base); doB[1].name = 'Cozinha nova'; doB.push(foto('F4', 'Varanda'));
    await porCasa(env, B, { id: 'H1', photos: doB }, { photos: base });
    const fotos = (await naBase(env, 'H1')).photos;
    assert.deepEqual(ids(fotos), ['F3', 'F1', 'F2', 'F4'], 'o Bruno não mexeu na ordem: fica a da Ana');
    assert.equal(fotos[2].name, 'Cozinha nova');
  });

  test('a remoção é só do que se removeu: a foto que a Ana tirou não volta com a cópia do Bruno', async () => {
    const base = [foto('F1', 'Sala'), foto('F2', 'Cozinha')];
    const { env, A, B } = await partilhada({ photos: base });
    await porCasa(env, A, { id: 'H1', name: 'Soure', photos: [base[1]] }, { photos: base });
    await porCasa(env, B, { id: 'H1', name: 'Soure B', photos: base }, { name: 'Soure' });
    const h = await naBase(env, 'H1');
    assert.deepEqual(ids(h.photos), ['F2']);
    assert.equal(h.name, 'Soure B');
  });

  test('um cliente sem base (de antes da fusão): junta e muda, nunca remove', async () => {
    const { env, B } = await partilhada({ tarefas: TAREFAS(), photos: FOTOS() });
    const r = await porCasa(env, B, { id: 'H1', name: 'Soure velha', tarefas: { seccoes: [], itens: [tarefa('T9', 'Nova')] }, photos: [foto('F2', 'Despensa')] });
    assert.ok(r.ok);
    const h = await naBase(env, 'H1');
    assert.equal(h.name, 'Soure velha', 'os campos que chegam ganham');
    assert.deepEqual(ids(h.tarefas.itens), ['T9', 'T1', 'T2'], 'nenhuma tarefa sai; a que chega fica antes das que só o servidor tinha');
    assert.deepEqual(ids(h.tarefas.seccoes), ['S1'], 'nenhuma secção sai');
    assert.deepEqual(ids(h.photos), ['F1', 'F2'], 'nenhuma foto sai');
    assert.equal(h.photos.find((f) => f.id === 'F2').name, 'Despensa', 'e a que chega muda');
  });

  test('um envio que deixa a casa como estava não grava: a revisão fica', async () => {
    const { env, A } = await partilhada({ photos: FOTOS() });
    const antes = await naBase(env, 'H1');
    const data = { id: 'H1', name: 'Soure', address: '', rooms: [], photos: FOTOS() };
    assert.ok((await porCasa(env, A, data, {})).ok);
    assert.equal((await naBase(env, 'H1')).__rev, antes.__rev);
  });

  test('colaborador sem house.edit: recusado, e a casa não muda', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana', { plano: 'pro' }), B = await conta(env, 'Bruno', { plano: 'pro' });
    await casa(env, A, 'H1', { name: 'Soure', photos: FOTOS() });
    await cargo(env, A, 'Fotos', ['file.view'], 'R1');
    await darCargo(env, A, B, 'R1', ['H1']);
    const antes = await naBase(env, 'H1');
    const r = await porCasa(env, B, { id: 'H1', name: 'Outra', photos: [] }, { name: 'Soure', photos: FOTOS() });
    assert.equal(r.status, 403);
    assert.deepEqual(await naBase(env, 'H1'), antes);
  });

  test('colaborador com house.edit e sem report.view: o que o cargo não vê nem entra nem sai', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana', { plano: 'pro' }), B = await conta(env, 'Bruno', { plano: 'pro' });
    await casa(env, A, 'H1', { name: 'Soure', value: 250000, purchase: 180000, photos: FOTOS(), tarefas: TAREFAS() });
    await cargo(env, A, 'Gestor', ['house.edit'], 'R1');
    await darCargo(env, A, B, 'R1', ['H1']);
    // o cliente dele normaliza o valor que não recebe para 0, na base e no que manda
    const proj = { id: 'H1', name: 'Soure', value: 0, purchase: 0, photos: FOTOS(), tarefas: TAREFAS() };
    const novo = Object.assign(copia(proj), { name: 'Soure B', value: 1 });
    novo.tarefas.itens.push(tarefa('T5', 'Do Bruno'));
    assert.ok((await porCasa(env, B, novo, { name: 'Soure', value: 0, tarefas: proj.tarefas })).ok);
    const h = await naBase(env, 'H1');
    assert.equal(h.name, 'Soure B');
    assert.equal(h.value, 250000, 'o valor não entra (fundirCasa)');
    assert.equal(h.purchase, 180000);
    assert.deepEqual(ids(h.tarefas.itens), ['T1', 'T2', 'T5']);
    assert.deepEqual(ids(h.photos), ['F1', 'F2']);
  });

  test('o PUT REST da casa leva a base como o sync; uma base que não é objeto é 400', async () => {
    const { env, A, B } = await partilhada({ photos: FOTOS() });
    const r = await resp(pedir(env, B, '/api/houses/H1', 'PUT', { data: { id: 'H1', name: 'Soure REST', photos: [] }, base: { name: 'Soure', photos: [] } }));
    assert.equal(r.status, 200);
    const h = await naBase(env, 'H1');
    assert.equal(h.name, 'Soure REST');
    assert.deepEqual(ids(h.photos), ['F1', 'F2'], 'a base dizia que não havia fotos: nenhuma sai');
    assert.equal((await porCasa(env, A, { id: 'H1', name: 'x' }, ['lista'])).status, 400);
  });
});

/* -------------------------------------------------------- o cliente */

describe('o cliente', () => {
  test('a leitura com a casa por enviar funde em vez de esmagar, e o envio seguinte leva as duas', async () => {
    const { env, A, B } = await partilhada();
    const cA = cliente(env, A), cB = cliente(env, B);
    await ler(cA); await ler(cB);
    casaDe(cA, 'H1').name = 'Soure da Ana';          // por enviar
    casaDe(cB, 'H1').photos = FOTOS();
    casaDe(cB, 'H1').tarefas = TAREFAS();
    await enviar(cB);
    await ler(cA);                                    // applyState com a casa por enviar
    const h = casaDe(cA, 'H1');
    assert.equal(h.name, 'Soure da Ana', 'o que é daqui fica');
    assert.deepEqual(ids(h.photos), ['F1', 'F2'], 'e o que o Bruno adicionou também');
    assert.deepEqual(ids(h.tarefas.itens), ['T1', 'T2']);
    assert.deepEqual(h.ownerIds.slice().sort(), [A.id, B.id].sort(), 'os donos são os do servidor');
    await enviar(cA);
    const s = await naBase(env, 'H1');
    assert.equal(s.name, 'Soure da Ana');
    assert.deepEqual(ids(s.photos), ['F1', 'F2']);
  });

  test('a base refaz-se a cada estado, muda com cada envio aceite, e o envio leva só o que mudou', async () => {
    const { env, A } = await partilhada({ photos: FOTOS() });
    const cA = cliente(env, A);
    await ler(cA);
    const exp = cA.exportEntities()['h:H1'].data;
    assert.equal(JSON.stringify(cA.bases.H1), JSON.stringify(exp), 'a base é a casa do servidor na forma local');
    casaDe(cA, 'H1').name = 'Soure nova';
    await enviar(cA);
    const op = cA.__ops.find((o) => o.scope === 'house');
    assert.equal(JSON.stringify(op.base), JSON.stringify({ name: 'Soure' }), 'só o campo que mudou, com o valor que tinha');
    assert.equal(cA.bases.H1.name, 'Soure nova', 'o envio aceite passa a ser a base');
    const guardado = JSON.parse(cA.localStorage.getItem('gi_cloud_base_' + A.id));
    assert.equal(guardado.H1.name, 'Soure nova', 'e fica no aparelho');
  });

  test('a base sobrevive a recarregar e passa pela normalização desta versão', async () => {
    const { env, A } = await partilhada({ tarefas: TAREFAS() });
    const cA = cliente(env, A);
    await ler(cA);
    const guardado = JSON.parse(cA.localStorage.getItem('gi_cloud_base_' + A.id));
    delete guardado.H1.seguroMes;                    // uma versão de antes deste campo
    const outro = cliente(env, A, (janela) => {
      janela.localStorage.setItem('gi_cloud_base_' + A.id, JSON.stringify(guardado));
    });
    outro.loadSnap();
    assert.equal(JSON.stringify(outro.bases.H1), JSON.stringify(cA.bases.H1), 'igual à de antes de recarregar');
    assert.equal(outro.bases.H1.seguroMes, 0, 'o campo que a versão nova acrescenta acrescenta-se à base também');
    assert.deepEqual(ids(outro.bases.H1.tarefas.itens), ['T1', 'T2']);
  });

  test('antes do primeiro estado, uma casa que o servidor já tem e sem base espera por ele', async () => {
    const { env, A } = await partilhada({ photos: FOTOS() });
    const cA = cliente(env, A);
    await ler(cA);
    cA.bases = {};                                   // a primeira sessão com bases: ainda nenhuma
    cA.CW._pulled = 0;
    casaDe(cA, 'H1').photos = [];                    // uma cópia velha, sem as fotos
    await enviar(cA);
    assert.equal(cA.__ops.filter((o) => o.scope === 'house').length, 0, 'a casa não sobe sem base');
    await ler(cA);
    assert.deepEqual(ids(casaDe(cA, 'H1').photos), ['F1', 'F2'], 'sem base, a leitura junta as listas');
    assert.deepEqual(ids((await naBase(env, 'H1')).photos), ['F1', 'F2']);
  });

  test('o tamanho da base: uma casa com 16 fotos e 40 tarefas em 4 secções', (t) => {
    const app = carregarTudo();
    const seccoes = [1, 2, 3, 4].map((i) => ({ id: 'S' + i, nome: 'Divisão ' + i }));
    const itens = Array.from({ length: 40 }, (_, i) => tarefa('tarefa-' + i + '-' + 'x'.repeat(20), 'Uma tarefa com um nome médio ' + i, { seccao: 'S' + (1 + (i % 4)) }));
    const photos = Array.from({ length: 16 }, (_, i) => foto(webcrypto.randomUUID(), 'Fotografia ' + i));
    const base = app.stripHouse(app.normProp({ id: 'H1', name: 'Soure', address: 'Rua de Cima, 12', tarefas: { seccoes, itens }, photos }));
    const n = JSON.stringify(base).length;
    t.diagnostic('base de uma casa com 16 fotos e 40 tarefas: ' + n + ' caracteres');
    assert.ok(n < 16000, 'menos de 16 KB por casa: ' + n);
    const parcial = app.baseParcial(base, Object.assign(copia(base), { name: 'Outra' }));
    assert.equal(JSON.stringify(parcial), JSON.stringify({ name: 'Soure' }), 'mudar o nome leva só o nome');
  });
});

/* ------------------------------------------ a mesma fusão nos dois lados */

describe('a mesma fusão nos dois lados', () => {
  const BLOCO = /\/\/ <fusao>[\s\S]*?\/\/ <\/fusao>/;
  const bloco = (rel) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n').match(BLOCO)[0].replace(/^export function /gm, 'function ');

  test('o bloco é igual, letra a letra, no worker e no cliente', () => {
    assert.equal(bloco('web/cloud/nucleo.js'), bloco('worker/src/lib/permissoes.js'));
  });

  /* Um gerador pequeno e determinista: listas de itens com id tiradas de um
     conjunto de 6, com mudanças ao acaso de cada lado.
     Recebe: semente.
     Devolve: {base, chega, atual}. */
  function caso(semente) {
    let s = semente;
    const r = (n) => { s = (s * 1103515245 + 12345) % 2147483648; return s % n; };
    const item = (i) => ({ id: 'i' + i, nome: 'n' + r(3), feita: !!r(2) });
    const lista = () => Array.from({ length: r(6) }, (_, i) => i).filter(() => r(3)).map(item);
    const mexe = (l) => {
      l = copia(l);
      if (l.length && r(2)) l.splice(r(l.length), 1);
      if (r(2)) l.push(item(6 + r(4)));
      if (l.length > 1 && r(2)) l.reverse();
      if (l.length && r(2)) l[r(l.length)].nome = 'mudado' + r(5);
      return l;
    };
    const base = { id: 'H', name: 'n' + r(2), photos: lista(), tarefas: { seccoes: lista(), itens: lista() } };
    const ramo = () => ({ id: 'H', name: r(2) ? base.name : 'm' + r(3), photos: mexe(base.photos), tarefas: { seccoes: mexe(base.tarefas.seccoes), itens: mexe(base.tarefas.itens) } });
    return { base: r(5) ? base : undefined, chega: ramo(), atual: ramo() };
  }

  test('os dois dão o mesmo resultado em 300 casos, e nunca perdem o que só o servidor tem', () => {
    const app = carregarTudo();
    for (let i = 1; i <= 300; i++) {
      const { base, chega, atual } = caso(i);
      const doWorker = fundirTres(copia(base === undefined ? null : base) || undefined, copia(chega), copia(atual));
      const doCliente = app.fundirTres(copia(base === undefined ? null : base) || undefined, copia(chega), copia(atual));
      assert.equal(JSON.stringify(doCliente), JSON.stringify(doWorker), 'caso ' + i);
      const naBaseIds = new Set(ids(base && base.photos));
      ids(atual.photos).filter((id) => !naBaseIds.has(id)).forEach((id) => {
        assert.ok(ids(doWorker.photos).includes(id), 'caso ' + i + ': ' + id + ' só estava no servidor e ficou');
      });
    }
  });

  test('a ordem: uma tarefa adicionada no fim fica no fim, mesmo com a ordem do servidor mudada', () => {
    const base = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const atual = [{ id: 'c' }, { id: 'a' }, { id: 'b' }, { id: 's' }];
    const chega = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'n' }];
    assert.deepEqual(ids(fundirTres(base, chega, atual)), ['c', 'a', 'b', 's', 'n']);
    // e quem reordena aqui dá a ordem; a do servidor encaixa antes do que a seguia
    assert.deepEqual(ids(fundirTres(base, [{ id: 'b' }, { id: 'a' }, { id: 'c' }], [{ id: 'a' }, { id: 's' }, { id: 'b' }, { id: 'c' }])), ['s', 'b', 'a', 'c']);
  });
});
