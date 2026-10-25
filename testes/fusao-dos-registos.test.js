// Os registos de uma casa partilhada (contratos, movimentos, planeados, fichas
// de inquilino) e os registos da conta fundem a três como a casa
// (worker/src/lib/escritas.js:gravarRegisto, web/cloud/nucleo.js:fundirRegistoLocal,
// com o mesmo fundirTres): o que outra conta ou outro aparelho mudou num
// registo não volta atrás nem se apaga quando este aparelho grava a sua cópia.
//
// Os três primeiros testes reproduzem a perda: dois clientes a sério (a app
// inteira com a nuvem, o fetch ligado ao worker) contra a D1 de teste. A Ana
// adiciona tarefas, documentos e chaves a um contrato (ou muda a nota de um
// movimento); o Bruno, com a cópia de antes, muda outro campo — ou só tem a
// cópia a diferir do retrato, como numa normalização nova — e envia.
// Corridos contra o código de antes desta fusão, os três chumbavam (a Ana
// lia o contrato sem as tarefas, e o movimento sem a nota). Depois: a fusão
// campo a campo e item a item no servidor, o campo removido, o planeado do
// colaborador, a ficha com documentos, os registos da conta, o envio sem
// base, a escrita que não muda nada, a base inválida e o PUT REST, a escrita
// a meio; e no cliente a leitura que funde, as bases (o que se guarda no
// aparelho, o recarregar com a normalização, a espera antes do primeiro
// estado), a troca de conta e o tamanho.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { carregarTudo } from './arnes.js';
import { ambiente, conta, casa, comproprietario, registo, dadoGlobal, cargo, darCargo, sync, pedir, resp } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

/* ------------------------------------------------------------- armações */

/* Um cliente a sério: a app inteira com a nuvem, o fetch ligado ao worker e
   a sessão da conta; o que pinta calado. Os ops de cada POST /api/sync ficam
   em app.__ops; com app.__semRede = true o envio falha como sem rede.
   Recebe: env; quem — a conta; antes (opcional) — o que pôr no aparelho
   antes de a app carregar.
   Devolve: o proxy da app. */
function cliente(env, quem, antes) {
  const app = carregarTudo(antes ? { antes } : undefined);
  const ops = [];
  app.fetch = (url, opts) => {
    opts = opts || {};
    if (url === '/api/sync' && app.__semRede) return Promise.reject(new Error('sem rede'));
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
const ids = (l) => (l || []).map((x) => x.id);
const copia = (o) => JSON.parse(JSON.stringify(o));
const contratoDe = (app, id) => app.db.contracts.find((c) => c.id === id);
const movimentoDe = (app, id) => app.db.transactions.find((t) => t.id === id);
const tarefa = (id, nome) => ({ id, nome, seccao: '', feita: false, feitaEm: '' });
const ficheiro = (id, name) => ({ id, name, type: 'application/pdf', size: 10, added: '2026-10-25' });
const CONTRATO = { name: 'T2 — Carla', propertyId: 'H1', rent: 500, notes: '' };
const MOVIMENTO = { kind: 'income', label: 'Renda', amount: 500, date: '2026-10-01', propertyId: 'H1', notes: '' };

/* Uma casa H1 da Ana, partilhada com o Bruno por ligação, com um contrato C1
   e um movimento M1 escritos pela Ana.
   Recebe: contrato, movimento (opcionais) — o que se junta aos de omissão.
   Devolve: {env, A, B}. */
async function partilhada(contrato, movimento) {
  const env = ambiente();
  const A = await conta(env, 'Ana'), B = await conta(env, 'Bruno');
  await casa(env, A, 'H1', { name: 'Soure', address: '' });
  await comproprietario(env, A, B, ['H1']);
  await registo(env, 'H1', 'contract', 'C1', Object.assign({}, CONTRATO, contrato), A);
  await registo(env, 'H1', 'tx', 'M1', Object.assign({}, MOVIMENTO, movimento), A);
  return { env, A, B };
}

/* Um put de um registo de H1 pelo /api/sync, com base ou sem ela.
   Recebe: env; quem; kind; data (com o id); base (opcional).
   Devolve: o resultado da operação. */
async function porRegisto(env, quem, kind, data, base) {
  const op = { op: 'put', scope: 'record', houseId: 'H1', kind, id: data.id, data };
  if (base !== undefined) op.base = base;
  return (await sync(env, quem, [op]))[0];
}

/* Um registo como está na D1.
   Recebe: env; kind; id; tabela (opcional) — 'user_records' para os da conta.
   Devolve: o JSON com __autor, __em e __apagado. */
async function naBase(env, kind, id, tabela) {
  const t = tabela || 'records';
  const r = await env.DB.prepare(`SELECT * FROM ${t} WHERE kind = ? AND id = ?`).bind(kind, id).first();
  return Object.assign(JSON.parse(r.data), { __autor: r.author, __em: r.updated_at, __apagado: r.deleted });
}

/* ------------------------------------------------------- a reprodução */

describe('a reprodução da perda', () => {
  for (const modo of ['muda a nota', 'só tem a cópia velha a diferir do retrato']) {
    test('contrato: o Bruno com a cópia de antes que ' + modo + ': as tarefas, os documentos e as chaves da Ana ficam', async () => {
      const { env, A, B } = await partilhada();
      const cA = cliente(env, A), cB = cliente(env, B);
      await ler(cA); await ler(cB);
      const c = contratoDe(cA, 'C1');
      c.tarefas = { seccoes: [], itens: [tarefa('T1', 'Pintar'), tarefa('T2', 'Trocar fechadura')] };
      c.files = [ficheiro('D1', 'Contrato assinado')];
      c.keys = [{ id: 'K1', name: 'Porta da rua', qty: 2 }];
      await enviar(cA);
      if (modo === 'muda a nota') contratoDe(cB, 'C1').notes = 'Paga por transferência';
      else cB.snap['r:H1:contract:C1'] = '#velho:1';   // como uma normalização nova: difere do retrato sem ninguém lhe mexer
      await enviar(cB);
      await ler(cA); await ler(cB);
      for (const [quem, app] of [['Ana', cA], ['Bruno', cB]]) {
        const x = contratoDe(app, 'C1');
        assert.deepEqual(ids(x.tarefas.itens), ['T1', 'T2'], quem + ': as tarefas');
        assert.deepEqual(ids(x.files), ['D1'], quem + ': os documentos');
        assert.deepEqual(ids(x.keys), ['K1'], quem + ': as chaves');
        assert.equal(x.notes, modo === 'muda a nota' ? 'Paga por transferência' : '', quem + ': a nota');
      }
    });
  }

  test('movimento: a Ana muda a nota e o Bruno, com a cópia de antes, muda o valor: ficam os dois', async () => {
    const { env, A, B } = await partilhada();
    const cA = cliente(env, A), cB = cliente(env, B);
    await ler(cA); await ler(cB);
    movimentoDe(cA, 'M1').notes = 'Recebida em mão';
    await enviar(cA);
    movimentoDe(cB, 'M1').amount = 550;
    await enviar(cB);
    await ler(cA); await ler(cB);
    for (const app of [cA, cB]) {
      assert.equal(movimentoDe(app, 'M1').notes, 'Recebida em mão');
      assert.equal(movimentoDe(app, 'M1').amount, 550);
    }
  });
});

/* ------------------------------------------------ a fusão no servidor */

describe('a fusão no servidor', () => {
  test('contrato: tarefas, documentos, inventário e chaves juntam-se item a item; o removido de um lado sai, e só ele', async () => {
    const lista = {
      files: [ficheiro('D1', 'Contrato'), ficheiro('D2', 'Caução')],
      inventory: [{ id: 'I1', name: 'Frigorífico', qty: 1, state: 'usado' }],
      keys: [{ id: 'K1', name: 'Porta', qty: 1 }],
      tarefas: { seccoes: [], itens: [tarefa('T1', 'Pintar')] },
    };
    const { env, A, B } = await partilhada(lista);
    const base = Object.assign({ id: 'C1' }, CONTRATO, copia(lista));
    const daA = copia(base);
    daA.files = [base.files[1], ficheiro('D3', 'Recibo')];          // removeu D1, adicionou D3
    daA.inventory.push({ id: 'I2', name: 'Fogão', qty: 1, state: 'novo' });
    daA.keys[0].qty = 3;
    assert.ok((await porRegisto(env, A, 'contract', daA, { files: base.files, inventory: base.inventory, keys: base.keys })).ok);
    const doB = copia(base);
    doB.tarefas.itens.push(tarefa('T2', 'Trocar fechadura'));
    doB.keys.push({ id: 'K2', name: 'Garagem', qty: 1 });
    doB.rent = 600;
    assert.ok((await porRegisto(env, B, 'contract', doB, { tarefas: base.tarefas, keys: base.keys, rent: 500 })).ok);
    const c = await naBase(env, 'contract', 'C1');
    assert.deepEqual(ids(c.files), ['D2', 'D3'], 'o D1 que a Ana removeu não volta com a cópia do Bruno');
    assert.deepEqual(ids(c.inventory), ['I1', 'I2']);
    assert.deepEqual(c.keys.map((k) => k.id + ':' + k.qty), ['K1:3', 'K2:1'], 'a quantidade da Ana e a chave do Bruno');
    assert.deepEqual(ids(c.tarefas.itens), ['T1', 'T2']);
    assert.equal(c.rent, 600);
    assert.equal(c.__autor, B.id, 'o autor é o último a escrever');
  });

  test('movimento: campos diferentes ficam os dois, o mesmo campo fica com o último, e um campo removido sai', async () => {
    const { env, A, B } = await partilhada(undefined, { interest: 12, principal: 300 });
    const base = Object.assign({ id: 'M1' }, MOVIMENTO, { interest: 12, principal: 300 });
    assert.ok((await porRegisto(env, A, 'tx', Object.assign(copia(base), { notes: 'Em mão' }), { notes: '' })).ok);
    const doB = Object.assign(copia(base), { amount: 550 });
    delete doB.interest;                                      // o movimento deixou de ser uma prestação
    assert.ok((await porRegisto(env, B, 'tx', doB, { amount: 500, interest: 12 })).ok);
    assert.ok((await porRegisto(env, A, 'tx', Object.assign(copia(base), { notes: 'Em mão', amount: 575 }), { amount: 500 })).ok);
    const m = await naBase(env, 'tx', 'M1');
    assert.equal(m.notes, 'Em mão');
    assert.equal(m.amount, 575, 'o mesmo campo dos dois lados: o último');
    assert.equal('interest' in m, false, 'o juro que o Bruno removeu saiu');
    assert.equal(m.principal, 300, 'e o que ninguém tirou ficou');
  });

  test('um campo removido sai também da casa (a mesma fusão)', async () => {
    const { env, A } = await partilhada();
    await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?').bind(JSON.stringify({ id: 'H1', name: 'Soure', antigo: 'x', rooms: [] }), 'H1').run();
    const r = (await sync(env, A, [{ op: 'put', scope: 'house', houseId: 'H1', data: { id: 'H1', name: 'Soure', rooms: [] }, base: { antigo: 'x' } }]))[0];
    assert.ok(r.ok);
    const h = await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind('H1').first();
    assert.equal('antigo' in JSON.parse(h.data), false);
  });

  test('planeado de outrem confirmado por um colaborador: só next/until/muted entram, por cima da fusão', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana', { plano: 'pro' }), B = await conta(env, 'Bruno', { plano: 'pro' });
    await casa(env, A, 'H1', { name: 'Soure' });
    const rec = { name: 'Renda', every: 'month', next: '2026-11-01', until: '', end: '', muted: false, tx: { kind: 'income', amount: 500, propertyId: 'H1' } };
    await registo(env, 'H1', 'rec', 'R1', rec, A);
    await cargo(env, A, 'Contas', ['rec.add'], 'G1');
    await darCargo(env, A, B, 'G1', ['H1']);
    const base = Object.assign({ id: 'R1' }, copia(rec));
    assert.ok((await porRegisto(env, A, 'rec', Object.assign(copia(base), { name: 'Renda da Carla' }), { name: 'Renda' })).ok);
    // a cópia do Bruno é a de antes; confirma (next avança) e tenta mudar o montante
    const doB = Object.assign(copia(base), { next: '2026-12-01' });
    doB.tx.amount = 999;
    assert.ok((await porRegisto(env, B, 'rec', doB, { next: '2026-11-01', tx: base.tx })).ok);
    const r = await naBase(env, 'rec', 'R1');
    assert.equal(r.next, '2026-12-01', 'a confirmação entra');
    assert.equal(r.tx.amount, 500, 'o montante não entra');
    assert.equal(r.name, 'Renda da Carla', 'o que a Ana mudou fica');
  });

  test('ficha de inquilino: os documentos que cada conta adicionou ficam', async () => {
    const { env, A, B } = await partilhada();
    const ficha = { id: 'P1', name: 'Carla', phone: '', files: [] };
    await registo(env, 'H1', 'tenant', 'P1', ficha, A);
    await porRegisto(env, A, 'tenant', Object.assign(copia(ficha), { files: [ficheiro('D1', 'CC')] }), { files: [] });
    await porRegisto(env, B, 'tenant', Object.assign(copia(ficha), { phone: '912', files: [ficheiro('D2', 'Recibo')] }), { phone: '', files: [] });
    const p = await naBase(env, 'tenant', 'P1');
    assert.deepEqual(ids(p.files), ['D1', 'D2']);
    assert.equal(p.phone, '912');
  });

  test('registos da conta (u:tx, u:tpl): dois aparelhos da mesma conta não se esmagam', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const tx = { kind: 'expense', label: 'Seguro', amount: 90, notes: '' };
    const tpl = { name: 'Seguro', tx: { kind: 'expense', label: 'Seguro', amount: 90 } };
    await dadoGlobal(env, A, 'tx', 'X1', tx);
    await dadoGlobal(env, A, 'tpl', 'P1', tpl);
    const put = (kind, id, data, base) => sync(env, A, [{ op: 'put', scope: 'user', kind, id, data: Object.assign({ id }, data), base }]);
    await put('tx', 'X1', Object.assign(copia(tx), { notes: 'Anual' }), { notes: '' });
    await put('tx', 'X1', Object.assign(copia(tx), { amount: 95 }), { amount: 90 });
    await put('tpl', 'P1', Object.assign(copia(tpl), { name: 'Seguro multirriscos' }), { name: 'Seguro' });
    const doOutro = copia(tpl); doOutro.tx.amount = 95;
    await put('tpl', 'P1', doOutro, { tx: tpl.tx });
    const x = await naBase(env, 'tx', 'X1', 'user_records'), p = await naBase(env, 'tpl', 'P1', 'user_records');
    assert.equal(x.notes, 'Anual'); assert.equal(x.amount, 95);
    assert.equal(p.name, 'Seguro multirriscos'); assert.equal(p.tx.amount, 95);
  });

  test('sem base (um cliente de antes): os campos que chegam ganham, e nada sai', async () => {
    const lista = { files: [ficheiro('D1', 'Contrato')], tarefas: { seccoes: [], itens: [tarefa('T1', 'Pintar')] }, iban: 'PT50' };
    const { env, B } = await partilhada(lista);
    const r = await porRegisto(env, B, 'contract', { id: 'C1', name: 'Velho', rent: 450, files: [ficheiro('D2', 'Outro')], tarefas: { seccoes: [], itens: [] } });
    assert.ok(r.ok);
    const c = await naBase(env, 'contract', 'C1');
    assert.equal(c.name, 'Velho'); assert.equal(c.rent, 450);
    assert.deepEqual(ids(c.files), ['D2', 'D1'], 'nenhum documento sai');
    assert.deepEqual(ids(c.tarefas.itens), ['T1'], 'nenhuma tarefa sai');
    assert.equal(c.iban, 'PT50', 'o campo que não chega fica');
  });

  test('um envio que deixa o registo como estava não grava: o autor e a data ficam', async () => {
    const { env, B } = await partilhada();
    const antes = await naBase(env, 'contract', 'C1');
    assert.ok((await porRegisto(env, B, 'contract', Object.assign({ id: 'C1' }, CONTRATO), {})).ok);
    const depois = await naBase(env, 'contract', 'C1');
    assert.equal(depois.__autor, antes.__autor);
    assert.equal(depois.__em, antes.__em);
  });

  test('uma base que não é objeto é 400; o PUT REST de um registo leva a base como o sync', async () => {
    const { env, A, B } = await partilhada({ files: [ficheiro('D1', 'Contrato')] });
    assert.equal((await porRegisto(env, A, 'contract', { id: 'C1', name: 'x' }, ['lista'])).status, 400);
    const r = await resp(pedir(env, B, '/api/houses/H1/records/contract/C1', 'PUT',
      { data: Object.assign({ id: 'C1' }, CONTRATO, { name: 'REST', files: [] }), base: { name: CONTRATO.name, files: [] } }));
    assert.equal(r.status, 200);
    const c = await naBase(env, 'contract', 'C1');
    assert.equal(c.name, 'REST');
    assert.deepEqual(ids(c.files), ['D1'], 'a base dizia que não havia documentos: nenhum sai');
  });

  test('uma escrita a meio: a fusão repete-se com o registo fresco e nada se perde', async () => {
    const { env, B } = await partilhada({ tarefas: { seccoes: [], itens: [] } });
    // entre a leitura e a escrita do Bruno, a Ana grava uma tarefa (uma vez)
    const prep = env.DB.prepare.bind(env.DB);
    let meteu = false;
    env.DB.prepare = (sql) => {
      const st = prep(sql);
      if (meteu || !/^SELECT data, deleted FROM records/.test(sql)) return st;
      const bind = st.bind.bind(st);
      st.bind = (...a) => {
        const b = bind(...a), first = b.first.bind(b);
        b.first = async () => {
          const row = await first();
          if (!meteu) {
            meteu = true;
            const d = JSON.parse(row.data); d.tarefas.itens.push(tarefa('TA', 'Da Ana'));
            await prep('UPDATE records SET data = ? WHERE kind = ? AND id = ?').bind(JSON.stringify(d), 'contract', 'C1').run();
          }
          return row;
        };
        return b;
      };
      return st;
    };
    const base = Object.assign({ id: 'C1' }, CONTRATO, { tarefas: { seccoes: [], itens: [] } });
    const doB = copia(base); doB.tarefas.itens.push(tarefa('TB', 'Do Bruno'));
    assert.ok((await porRegisto(env, B, 'contract', doB, { tarefas: base.tarefas })).ok);
    env.DB.prepare = prep;
    assert.ok(meteu, 'a escrita a meio aconteceu');
    assert.deepEqual(ids((await naBase(env, 'contract', 'C1')).tarefas.itens), ['TA', 'TB']);
  });
});

/* -------------------------------------------------------- o cliente */

describe('o cliente', () => {
  test('a leitura com um contrato por enviar funde em vez de esmagar, e o envio seguinte leva os dois', async () => {
    const { env, A, B } = await partilhada();
    const cA = cliente(env, A), cB = cliente(env, B);
    await ler(cA); await ler(cB);
    contratoDe(cA, 'C1').notes = 'Da Ana';             // por enviar
    contratoDe(cB, 'C1').tarefas.itens.push(tarefa('T1', 'Pintar'));
    contratoDe(cB, 'C1').rent = 520;
    await enviar(cB);
    await ler(cA);                                     // applyState com o contrato por enviar
    const c = contratoDe(cA, 'C1');
    assert.equal(c.notes, 'Da Ana', 'o que é daqui fica');
    assert.equal(c.rent, 520, 'e o que o Bruno mudou também');
    assert.deepEqual(ids(c.tarefas.itens), ['T1']);
    assert.equal(c._author, B.id, 'as marcas são as do servidor');
    await enviar(cA);
    const s = await naBase(env, 'contract', 'C1');
    assert.equal(s.notes, 'Da Ana'); assert.equal(s.rent, 520); assert.deepEqual(ids(s.tarefas.itens), ['T1']);
  });

  test('a base de cada registo refaz-se a cada estado e muda com cada envio aceite; o envio leva só o que mudou', async () => {
    const { env, A } = await partilhada();
    const cA = cliente(env, A);
    await ler(cA);
    const k = 'r:H1:contract:C1';
    assert.equal(JSON.stringify(cA.bases[k]), JSON.stringify(cA.exportEntities()[k].data), 'a base é o contrato do servidor na forma local');
    contratoDe(cA, 'C1').notes = 'Nova';
    await enviar(cA);
    const op = cA.__ops.find((o) => o.kind === 'contract');
    assert.equal(JSON.stringify(op.base), JSON.stringify({ notes: '' }), 'só o campo que mudou, com o valor que tinha');
    assert.equal(cA.bases[k].notes, 'Nova', 'o envio aceite passa a ser a base');
    const guardado = JSON.parse(cA.localStorage.getItem('gi_cloud_base_' + A.id));
    assert.ok(guardado.H1, 'a base da casa fica no aparelho');
    assert.equal(guardado[k], undefined, 'a de um registo que já subiu não: é igual ao contrato local');
  });

  test('a base de um registo por enviar fica no aparelho e volta ao recarregar, pela normalização desta versão', async () => {
    const { env, A } = await partilhada();
    const cA = cliente(env, A);
    await ler(cA);
    cA.__semRede = true;
    contratoDe(cA, 'C1').notes = 'Escrita sem rede';
    cA.rawSet(cA.KEY, JSON.stringify(cA.db));         // o que o save() grava no aparelho
    await enviar(cA);
    const k = 'r:H1:contract:C1', chave = 'gi_cloud_base_' + A.id;
    const guardado = JSON.parse(cA.localStorage.getItem(chave));
    assert.ok(guardado[k], 'a base do contrato por enviar ficou no aparelho');
    assert.equal(guardado[k].notes, '');
    assert.equal(guardado['r:H1:tx:M1'], undefined, 'a do movimento, que não mudou, não');
    delete guardado[k].tarefas;                        // uma versão de antes deste campo
    const levar = [cA.KEY, 'gi_cloud_snap_' + A.id, 'gi_cloud_owner'];
    const outro = cliente(env, A, (janela) => {
      levar.forEach((x) => { const v = cA.localStorage.getItem(x); if (v != null) janela.localStorage.setItem(x, v); });
      janela.localStorage.setItem(chave, JSON.stringify(guardado));
    });
    outro.loadSnap();
    assert.deepEqual(copia(outro.bases[k].tarefas), { seccoes: [], itens: [] }, 'a normalização desta versão acrescenta o campo à base');
    assert.ok(outro.basesPorEnviar[k], 'e continua por enviar');
    assert.equal(JSON.stringify(outro.bases['r:H1:tx:M1']), JSON.stringify(outro.exportEntities()['r:H1:tx:M1'].data),
      'a base do movimento, igual ao retrato, tira-se do próprio movimento');
    await enviar(outro);
    const op = outro.__ops.find((o) => o.kind === 'contract');
    assert.equal(JSON.stringify(op.base), JSON.stringify({ notes: '' }), 'o envio leva só a nota');
    assert.equal(outro.__ops.filter((o) => o.kind === 'tx').length, 0, 'o movimento não sobe');
    assert.equal((await naBase(env, 'contract', 'C1')).notes, 'Escrita sem rede');
  });

  test('antes do primeiro estado, um registo sem base que o servidor tem espera; ao ler, o simples é do servidor e as listas juntam-se', async () => {
    const { env, A, B } = await partilhada({ tarefas: { seccoes: [], itens: [] } });
    const cA = cliente(env, A);
    await ler(cA);
    cA.bases = {};                                     // a primeira sessão com bases: ainda nenhuma
    cA.CW._pulled = 0;
    const c = contratoDe(cA, 'C1');
    c.notes = 'Cópia velha'; c.tarefas.itens.push(tarefa('TA', 'Daqui'));
    const doB = Object.assign({ id: 'C1' }, CONTRATO, { notes: 'Do servidor', tarefas: { seccoes: [], itens: [tarefa('TB', 'Do Bruno')] } });
    await porRegisto(env, B, 'contract', doB, { notes: '', tarefas: { seccoes: [], itens: [] } });
    await enviar(cA);
    assert.equal(cA.__ops.filter((o) => o.kind === 'contract').length, 0, 'o contrato não sobe sem base');
    await ler(cA);
    const x = contratoDe(cA, 'C1');
    assert.equal(x.notes, 'Do servidor', 'o campo simples é o do servidor');
    assert.deepEqual(ids(x.tarefas.itens).sort(), ['TA', 'TB'], 'as tarefas juntam-se');
    await enviar(cA);
    assert.deepEqual(ids((await naBase(env, 'contract', 'C1')).tarefas.itens).sort(), ['TA', 'TB']);
  });

  test('finishLogin, na troca de conta, limpa as bases da conta que sai (memória e aparelho)', () => {
    const app = carregarTudo();
    ['hideAuth', 'showLegalGate', 'startSync', 'showTermsGate'].forEach((n) => { app[n] = () => {}; });
    app.api = () => Promise.resolve({});
    app.CW.resgatarChegada = () => {};
    app.localStorage.setItem('gi_cloud_owner', 'U-sai');
    app.localStorage.setItem('gi_cloud_base_U-sai', JSON.stringify({ H1: { id: 'H1' }, 'r:H1:tx:M1': { id: 'M1' } }));
    app.localStorage.setItem('gi_cloud_base_U-entra', JSON.stringify({ H9: { id: 'H9' } }));
    app.bases = { H1: { id: 'H1' } };
    app.basesPorEnviar = { 'r:H1:tx:M1': 1 };
    app.finishLogin({ id: 'U-entra', name: 'Entra', email: 'e@x.pt' });
    assert.equal(app.localStorage.getItem('gi_cloud_base_U-sai'), null, 'as da conta que sai');
    assert.equal(app.localStorage.getItem('gi_cloud_base_U-entra'), null, 'e as que a que entra tinha de outra vez');
    assert.deepEqual(copia(app.bases), {});
    assert.deepEqual(copia(app.basesPorEnviar), {});
  });

  test('o tamanho das bases: o exemplo e 500 movimentos', (t) => {
    const app = carregarTudo();
    app.render = () => {}; app.buildNav = () => {}; app.toast = () => {};
    app.CW.user = { id: 'U1', name: 'Maria', email: 'm@x.pt' };
    app.CW.ambiente = 'desenvolvimento';   // o seed() recusa-se em produção
    app.seed();
    assert.equal(app.db.properties.length, 3, 'os dados de exemplo entraram');
    app.clearTimeout(app.pushTimer);
    const casas = app.db.properties.map((p) => p.id);
    for (let i = 0; i < 500; i++) {
      app.db.transactions.push(app.normTx({ id: 'mov' + i, kind: i % 4 ? 'income' : 'expense', label: 'Renda de ' + (1 + (i % 12)) + '/2026',
        amount: 450 + i, date: '2026-' + String(1 + (i % 12)).padStart(2, '0') + '-08', propertyId: casas[i % casas.length],
        category: i % 4 ? 'Rendas' : 'Manutenção e reparações', notes: i % 7 ? '' : 'Paga por transferência', periodo: '2026-01', recibo: true }));
    }
    const map = app.exportEntities();
    const todas = {};
    Object.keys(map).forEach((k) => { todas[app.chaveDaBase(k)] = map[k].data; });
    app.bases = todas;
    app.basesPorEnviar = {};
    app.saveBases();
    const guardado = app.localStorage.getItem('gi_cloud_base_U1').length;
    const tudo = JSON.stringify(todas).length;
    const db = JSON.stringify(app.db).length;
    t.diagnostic('registos: ' + Object.keys(map).length + '; db no aparelho: ' + db + ' caracteres');
    t.diagnostic('bases guardadas (casas, nenhum registo por enviar): ' + guardado + ' caracteres');
    t.diagnostic('bases de todos os registos (o que custaria guardá-las todas): ' + tudo + ' caracteres');
    assert.ok(guardado < 64 * 1024, 'as bases guardadas ficam pequenas: ' + guardado);
    assert.ok(tudo < 1024 * 1024, 'mesmo todas, em memória, ficam abaixo de 1 MB: ' + tudo);
  });
});
