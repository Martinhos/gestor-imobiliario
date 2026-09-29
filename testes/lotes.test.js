// Um movimento de vários imóveis — de um grupo, ou de «Todos os imóveis» —
// guarda-se partido por imóvel: cada parte é um movimento normal do seu imóvel
// (que vê quem tem o imóvel), com a marca `lote` {id, n, total, alvo, modo,
// partes}. Aqui: o id das partes, a normalização, o seletor com «Sem imóvel» e
// «Todos os imóveis» como opções distintas, guardar, editar, apagar e ver um
// lote, os planeados e os modelos que se partem ao registar, a migração dos
// movimentos de grupo antigos (sem mudar número nenhum) e os moldes com
// «Todos» nas projeções. Dinheiro: tudo ao cêntimo.
// A sessão (cargos) simula-se com window.CW, como no cargos.test.js.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, perto, repor } from './arnes.js';
// as janelas abrem numa pilha observável: cada uma guarda o corpo que recebeu
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
// a sessão simulada vive no window do contexto, que o repor não toca: sai à parte
afterEach(() => { app.window.CW = undefined; app.ownerFilter = ''; });

const BADID = /^[A-Za-z0-9_-]{1,64}$/;
const cent = (v) => Math.round(v * 100);
const somaCent = (l) => l.reduce((a, t) => a + cent(t.amount), 0);

/* Três imóveis e três donos: A (eu e a Ana, comprado em 2015), B (só meu,
   2018) e C (eu e o Rui, comprado em março de 2024). O grupo G tem os três,
   o G1 só o B, e o GV nenhum.
   Devolve: nada. */
function tresCasas() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'eu', name: 'Eu' }), app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'rui', name: 'Rui' })];
  app.db.properties = [
    app.normProp({ id: 'A', name: 'Lisboa', value: 300000, purchase: 200000, purchaseDate: '2015-01-01', ownerIds: ['eu', 'ana'] }),
    app.normProp({ id: 'B', name: 'Porto', value: 100000, purchase: 100000, purchaseDate: '2018-06-01', ownerIds: ['eu'] }),
    app.normProp({ id: 'C', name: 'Faro', value: 200000, purchase: 150000, purchaseDate: '2024-03-01', ownerIds: ['eu', 'rui'] }),
  ];
  app.db.groups = [
    app.normGroup({ id: 'G', name: 'Bloco', kind: 'prop', ids: ['A', 'B', 'C'] }),
    app.normGroup({ id: 'G1', name: 'Só o Porto', kind: 'prop', ids: ['B'] }),
    app.normGroup({ id: 'GV', name: 'Vazio', kind: 'prop', ids: [] }),
  ];
}
/* uma sessão com o meu id ('eu') e os cargos por casa
   Recebe: cargos — {idDaCasa: {dono, nome, perms}}.
   Devolve: nada. */
function sessao(cargos) {
  app.window.CW = { user: { id: 'eu' }, cargos: cargos || {}, pessoas: {} };
}
/* as janelas numa pilha, o que grava e desenha calado, e o toast apanhado
   Devolve: {abertas, toasts} — as camadas abertas e os toasts ({m, o}). */
function ecra() {
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
  const toasts = [];
  app.toast = (m, o) => { toasts.push({ m, o }); };
  return { abertas, toasts };
}
const el = (id) => app.document.getElementById(id);
/* Regista um movimento pelo formulário, com os campos escritos no DOM como a
   pessoa os deixaria (o valor do seletor do imóvel: '' Sem imóvel, '*' Todos
   os imóveis, 'g:<id>' um grupo, ou o id de um imóvel).
   Recebe: c — {valor, label, amount, date, kind, modo, partes ({idDoImóvel: valor}), paga, retencao}.
   Devolve: nada. */
function registar(c) {
  app.txModal({ kind: c.kind || 'expense' });
  el('t_prop').value = c.valor;
  app.onPropChange();
  const campos = { t_label: c.label, t_amount: String(c.amount), t_date: c.date || '2026-03-05', t_psplit: c.modo || '',
    t_split: '', t_cat: c.cat || '', t_sub: '', t_paid: c.paga || '', t_retencao: c.retencao ? String(c.retencao) : '', t_ct: '', t_loan: '' };
  for (const k of Object.keys(campos)) el(k).value = campos[k];
  for (const pid of ['A', 'B', 'C']) el('t_pp_' + pid).value = c.partes && c.partes[pid] != null ? String(c.partes[pid]) : '';
  app.onSave();
}
const doLote = (id) => app.db.transactions.filter((t) => t.lote && t.lote.id === id);
const opcoes = () => Array.from(app.window.__sel.t_prop.options).filter((o) => !o.div).map((o) => o.label);

describe('o id de uma parte e a forma dos dados', () => {
  test('parteId é determinístico e cabe na forma do badId, mesmo com um id de 64 caracteres', () => {
    const longo = 'x'.repeat(30) + '-' + 'Y'.repeat(33);
    assert.equal(longo.length, 64);
    const a = app.parteId(longo, '1b4e28ba-2fa1-11d2-883f-0016d3cca427');
    assert.equal(a, app.parteId(longo, '1b4e28ba-2fa1-11d2-883f-0016d3cca427'), 'o mesmo lote e imóvel dão sempre o mesmo id');
    assert.match(a, BADID);
    assert.equal(a, longo.slice(0, 40) + '_1b4e28ba2fa1');
    assert.notEqual(app.parteId(longo, 'A'), app.parteId(longo, 'B'), 'um id por imóvel');
    assert.match(app.parteId(app.uid(), app.uid()), BADID, 'com os ids que a app faz');
    assert.equal(app.parteId('L1', 'p/1 x'), 'L1_p1x', 'o que não é letra nem algarismo sai do imóvel');
  });

  test('normTx: todos:false e lote:null por omissão; «Todos» nunca com grupo nem com imóvel; lote só com imóvel', () => {
    const t = app.normTx({});
    assert.equal(t.todos, false);
    assert.equal(t.lote, null);
    assert.ok(app.TX_TPL_KEYS.includes('todos'), 'os moldes guardam o «Todos»');
    assert.ok(!app.TX_TPL_KEYS.includes('lote'), 'e não a marca de uma parte');
    const tg = app.normTx({ kind: 'expense', groupId: 'G', todos: true, psplit: { mode: 'equal', parts: {} } });
    assert.equal(tg.groupId, 'G');
    assert.equal(tg.todos, false, 'grupo e «Todos» nunca juntos: o grupo ganha');
    const tp = app.normTx({ kind: 'expense', propertyId: 'A', todos: true, psplit: { mode: 'equal', parts: {} } });
    assert.equal(tp.todos, false);
    assert.equal(tp.psplit, null, 'com imóvel não há divisão entre imóveis');
    const tt = app.normTx({ kind: 'income', todos: 1, psplit: { mode: 'pct', parts: { 'A x': 2 } } });
    assert.equal(tt.todos, true);
    igual(Object.keys(tt.psplit.parts).map((k) => k === 'A x' ? 'mau' : 'bom'), ['bom'], 'as chaves da divisão pelo idSeguro');
    assert.equal(app.normTx({ kind: 'loan', todos: true }).todos, false, 'só uma receita ou despesa é de «Todos»');
    assert.equal(app.normTx({ kind: 'settle', todos: true }).todos, false);
    const semImovel = app.normTx({ kind: 'expense', lote: { id: 'L', n: 2, total: 10, alvo: 'todos', modo: 'equal', partes: {} } });
    assert.equal(semImovel.lote, null, 'uma parte tem sempre imóvel');
  });

  test('normTx limpa a marca do lote: ids seguros, alvo só «todos» ou «g:…», n inteiro ≥ 1, modo dos PSPLIT_MODES', () => {
    const parte = (lote) => app.normTx({ kind: 'expense', propertyId: 'A', amount: 5, lote }).lote;
    const l = parte({ id: "L'1", n: 3, total: '300', alvo: "g:G'x", modo: 'value', partes: { "A'": 1 }, lixo: 1 });
    assert.match(String(l.id), BADID, 'o id do lote pelo idSeguro');
    assert.match(l.alvo.slice(2), BADID, 'e o do grupo também');
    assert.ok(l.alvo.startsWith('g:'));
    assert.equal(l.total, 300);
    assert.equal(l.n, 3);
    assert.equal(l.modo, 'value');
    assert.ok(Object.keys(l.partes).every((k) => BADID.test(k)), 'as chaves das partes pelo idSeguro');
    assert.equal(l.lixo, undefined, 'só os campos do contrato');
    assert.equal(parte({ id: 'L', n: 2, total: 1, alvo: 'todos', modo: 'inventado', partes: {} }).modo, 'equal');
    assert.equal(parte({ id: 'L', n: 2, total: 1, alvo: 'outro', modo: 'equal' }), null, 'alvo desconhecido');
    assert.equal(parte({ id: 'L', n: 2, total: 1, alvo: 'g:', modo: 'equal' }), null, 'grupo sem id');
    assert.equal(parte({ id: 'L', n: 0, total: 1, alvo: 'todos' }), null, 'n ≥ 1');
    assert.equal(parte({ id: 'L', n: 1.5, total: 1, alvo: 'todos' }), null, 'n inteiro');
    assert.equal(parte({ id: '', n: 2, total: 1, alvo: 'todos' }), null, 'sem id');
    assert.equal(parte({ id: 'L', n: 2, total: 'x', alvo: 'todos' }), null, 'total que não é número');
    assert.equal(parte('texto'), null);
    assert.equal(app.normTx({ kind: 'loan', propertyId: 'A', lote: { id: 'L', n: 2, total: 1, alvo: 'todos' } }).lote, null, 'só receitas e despesas são lote');
  });
});

describe('«Sem imóvel» e «Todos os imóveis» no seletor', () => {
  test('uma despesa com dois ou mais imóveis meus tem «Sem imóvel» e «Todos os imóveis» à cabeça; os grupos no fim', () => {
    tresCasas();
    ecra();
    app.txModal({ kind: 'expense' });
    igual(opcoes(), ['Sem imóvel', 'Todos os imóveis', 'Lisboa', 'Porto', 'Faro', 'Grupo · Bloco', 'Grupo · Só o Porto', 'Grupo · Vazio']);
    const o = app.window.__sel.t_prop.options.filter((x) => !x.div);
    assert.equal(o[0].v, '');
    assert.equal(o[1].v, '*');
    app.txModal({ kind: 'income' });
    igual(opcoes().slice(0, 2), ['Sem imóvel', 'Todos os imóveis']);
  });

  test('sem «Todos» com um imóvel só, num acerto (que continua «Todos os imóveis» com o valor vazio) nem num pagamento de crédito', () => {
    tresCasas();
    ecra();
    app.txModal({ kind: 'settle' });
    const o = app.window.__sel.t_prop.options.filter((x) => !x.div);
    assert.equal(o[0].label, 'Todos os imóveis');
    assert.equal(o[0].v, '', 'o acerto sem imóvel é o valor vazio, como sempre');
    assert.ok(!o.some((x) => x.v === '*'), 'e não há a opção «*»');
    assert.ok(!opcoes().some((x) => x.startsWith('Grupo')), 'um acerto não é de um grupo');
    app.txModal({ kind: 'loan' });
    assert.equal(opcoes()[0], 'Sem imóvel');
    assert.ok(!opcoes().includes('Todos os imóveis'), 'uma prestação não se divide por imóveis');
    assert.ok(!opcoes().some((x) => x.startsWith('Grupo')), 'nem é de um grupo');
    app.db.properties = app.db.properties.slice(0, 1);
    app.txModal({ kind: 'expense' });
    igual(opcoes().slice(0, 2), ['Sem imóvel', 'Lisboa'], 'com um imóvel só não há «Todos»');
  });

  test('«Todos» mostra a dica com os imóveis dessa data, e a divisão entre imóveis; «Sem imóvel» a sua', () => {
    tresCasas();
    const { abertas } = ecra();
    app.txModal({ kind: 'expense' });
    el('t_date').value = '2023-05-10';
    el('t_prop').value = '*';
    app.onPropChange();
    assert.equal(app.tForm.todos, true);
    assert.equal(app.tForm.propertyId, null);
    igual(app.tForm.psplit, { mode: 'equal', parts: {} });
    const b = abertas[0].body.innerHTML;
    assert.ok(b.includes('Divide-se pelos 2 imóveis que tinhas nesta data.'), 'em 2023 o Faro ainda não era meu');
    assert.ok(!b.includes('Conta nos totais, mas não na avaliação'), 'a dica de «Sem imóvel» é de «Sem imóvel»');
    assert.match(b, /Divisão entre imóveis/);
    // a data muda: os imóveis são os dessa data
    el('t_date').value = '2026-03-05';
    app.txDataMudou();
    assert.ok(abertas[0].body.innerHTML.includes('Divide-se pelos 3 imóveis que tinhas nesta data.'));
    el('t_prop').value = '';
    app.onPropChange();
    assert.equal(app.tForm.todos, false);
    assert.ok(abertas[0].body.innerHTML.includes('Conta nos totais, mas não na avaliação de nenhum imóvel.'));
  });

  test('imoveisDeTodos: os meus, comprados até à data (sem data de compra, sempre), sem os de colaboração, com tx.add', () => {
    tresCasas();
    igual(app.imoveisDeTodos('2026-03-05').map((p) => p.id), ['A', 'B', 'C']);
    igual(app.imoveisDeTodos('2023-05-10').map((p) => p.id), ['A', 'B']);
    igual(app.imoveisDeTodos('2017-01-01').map((p) => p.id), ['A']);
    igual(app.imoveisDeTodos('2024-03-01').map((p) => p.id), ['A', 'B', 'C'], 'o dia da compra conta');
    igual(app.imoveisDeTodos('').map((p) => p.id), ['A', 'B', 'C'], 'sem data (um molde), todos');
    app.db.properties[0].purchaseDate = '';
    igual(app.imoveisDeTodos('2000-01-01').map((p) => p.id), ['A'], 'sem data de compra, sempre');
    // o C passa a colaboração com tx.add, e o B a colaboração só de ver
    sessao({ C: { dono: false, nome: 'Contabilista', perms: ['tx.view', 'tx.add'] }, B: { dono: false, nome: 'Ver', perms: ['tx.view'] } });
    igual(app.imoveisDeTodos('2026-03-05').map((p) => p.id), ['A'], 'de colaboração nunca, mesmo com tx.add');
  });

  test('quem só colabora não ganha opções novas: nem «Sem imóvel», nem «Todos», nem grupos', () => {
    tresCasas();
    const CONTAB = { dono: false, nome: 'Contabilista', perms: ['tx.view', 'tx.add'] };
    sessao({ A: CONTAB, B: CONTAB, C: CONTAB });
    assert.equal(app.podeSemImovel(), false);
    ecra();
    app.txModal({ kind: 'expense' });
    igual(opcoes(), ['Lisboa', 'Porto', 'Faro']);
    // um modelo de «Todos» cai no primeiro imóvel permitido
    app.txModal({ kind: 'expense', preset: { todos: true, psplit: { mode: 'equal', parts: {} } } });
    assert.equal(app.tForm.propertyId, 'A');
    assert.equal(app.tForm.todos, false);
    assert.equal(app.tForm.psplit, null);
    igual(opcoes(), ['Lisboa', 'Porto', 'Faro']);
  });
});

describe('guardar: o movimento parte-se por imóvel', () => {
  test('300 € num grupo de três imóveis: três partes de 100 €, com o lote e os ids parteId, e nenhum movimento sem imóvel', () => {
    tresCasas();
    const { toasts } = ecra();
    registar({ valor: 'g:G', label: 'Seguro', amount: 300, paga: 'eu' });
    assert.equal(toasts.pop().m, 'Movimento guardado.');
    const ts = app.db.transactions;
    assert.equal(ts.length, 3);
    assert.ok(ts.every((t) => t.propertyId && !t.groupId && !t.todos && t.psplit === null), 'cada parte é um movimento normal do seu imóvel');
    igual(ts.map((t) => [t.propertyId, t.amount]), [['A', 100], ['B', 100], ['C', 100]]);
    const loteId = ts[0].lote.id;
    ts.forEach((t) => {
      igual(t.lote, { id: loteId, n: 3, total: 300, alvo: 'g:G', modo: 'equal', partes: {} });
      assert.equal(t.id, app.parteId(loteId, t.propertyId));
      assert.match(t.id, BADID);
      assert.equal(t.label, 'Seguro');
      assert.equal(t.paidBy, 'eu');
      assert.equal(t.date, '2026-03-05');
    });
    assert.ok(!ts.some((t) => t.id === loteId), 'o id do lote não é de nenhuma parte');
  });

  test('«Todos os imóveis» divide pelos imóveis que havia à data, com o alvo «todos»', () => {
    tresCasas();
    ecra();
    registar({ valor: '*', label: 'Contabilista', amount: 200, date: '2023-05-10' });
    const ts = app.db.transactions;
    igual(ts.map((t) => [t.propertyId, t.amount]), [['A', 100], ['B', 100]], 'o Faro foi comprado em 2024');
    assert.ok(ts.every((t) => t.lote.alvo === 'todos' && t.lote.n === 2 && t.lote.total === 200));
    registar({ valor: '*', label: 'Contabilista 2026', amount: 300, date: '2026-03-05' });
    assert.equal(app.db.transactions.filter((t) => t.label === 'Contabilista 2026').length, 3);
  });

  test('pelo valor, por percentagem, por valor certo e por ajuste, as partes batem ao cêntimo com o total — e a retenção também', () => {
    tresCasas();
    ecra();
    registar({ valor: 'g:G', label: 'Valor', amount: 100.01, modo: 'value' });
    let ps = app.db.transactions.filter((t) => t.label === 'Valor');
    assert.equal(somaCent(ps), 10001);
    // 300 000, 100 000 e 200 000: metade, um sexto e um terço, e o cêntimo que sobra onde mais falta
    igual(ps.map((t) => cent(t.amount)), [5000, 1667, 3334]);
    assert.equal(ps[0].lote.modo, 'value');
    igual(ps[0].lote.partes, {}, 'sem valores escritos, as partes do lote ficam vazias');
    registar({ valor: 'g:G', label: 'Pct', amount: 99.99, modo: 'percent', partes: { A: 33.33, B: 33.33, C: 33.34 } });
    ps = app.db.transactions.filter((t) => t.label === 'Pct');
    assert.equal(somaCent(ps), 9999);
    igual(ps[0].lote.partes, { A: 33.33, B: 33.33, C: 33.34 });
    registar({ valor: 'g:G', label: 'Certo', amount: 100, modo: 'amount', partes: { A: 10.01, B: 20.02, C: 69.97 } });
    ps = app.db.transactions.filter((t) => t.label === 'Certo');
    igual(ps.map((t) => t.amount), [10.01, 20.02, 69.97]);
    registar({ valor: '*', label: 'Ajuste', amount: 33.34, modo: 'adjust', partes: { A: 3.33 } });
    ps = app.db.transactions.filter((t) => t.label === 'Ajuste');
    assert.equal(somaCent(ps), 3334);
    // uma renda com retenção: o retido parte-se na mesma proporção, sem se repetir em cada imóvel
    registar({ kind: 'income', valor: 'g:G', label: 'Renda', amount: 1000, retencao: 250, cat: 'Rendas' });
    ps = app.db.transactions.filter((t) => t.label === 'Renda');
    igual(ps.map((t) => t.amount), [333.34, 333.33, 333.33]);
    assert.equal(ps.reduce((a, t) => a + cent(t.retencao), 0), 25000, 'o retido soma o do movimento');
    assert.equal(ps.reduce((a, t) => a + cent(app.rendaBruta(t)), 0), 125000, 'e a renda bruta também');
  });

  test('um grupo de um só imóvel dá um movimento normal nesse imóvel, com o id do lote; um grupo vazio recusa com a frase', () => {
    tresCasas();
    const { toasts } = ecra();
    app.txModal({ kind: 'expense' });
    const id = app.tForm.id;
    el('t_prop').value = 'g:G1';
    app.onPropChange();
    Object.entries({ t_label: 'Janela', t_amount: '80', t_date: '2026-03-05', t_psplit: '' }).forEach(([k, v]) => { el(k).value = v; });
    app.onSave();
    assert.equal(app.db.transactions.length, 1);
    const t = app.db.transactions[0];
    assert.equal(t.id, id, 'o id do movimento');
    assert.equal(t.propertyId, 'B');
    assert.equal(t.lote, null, 'um imóvel só não é lote');
    assert.equal(t.groupId, null);
    registar({ valor: 'g:GV', label: 'Nada', amount: 10 });
    assert.equal(toasts.pop().m, 'O grupo não tem imóveis.');
    assert.equal(app.db.transactions.length, 1, 'nada entrou');
    registar({ valor: '*', label: 'Antes', amount: 10, date: '2010-01-01' });
    assert.equal(toasts.pop().m, 'Não havia imóveis nesta data.');
    assert.equal(app.db.transactions.length, 1);
  });

  test('um grupo com um imóvel onde não posso adicionar recusa antes de gravar o que quer que seja', () => {
    tresCasas();
    sessao({ C: { dono: false, nome: 'Ver', perms: ['tx.view'] } });
    const { toasts } = ecra();
    registar({ valor: 'g:G', label: 'Seguro', amount: 300 });
    assert.match(toasts.pop().m, /Não podes adicionar movimentos em «Faro»/);
    assert.equal(app.db.transactions.length, 0, 'nem uma parte');
  });
});

describe('editar, apagar e ver um lote', () => {
  /* um lote de 300 € no grupo G, pago por mim
     Devolve: o id do lote. */
  function umLote() {
    tresCasas();
    ecra();
    registar({ valor: 'g:G', label: 'Seguro', amount: 300, paga: 'eu' });
    return app.db.transactions[0].lote.id;
  }

  test('editar uma parte abre o lote (total, grupo, divisão); guardar com outro valor refaz as partes com os mesmos ids', () => {
    const lid = umLote();
    const ids = doLote(lid).map((t) => t.id);
    app.txModal({ id: app.parteId(lid, 'B') });
    assert.equal(app.tForm.id, lid, 'o formulário é do lote');
    assert.equal(app.tForm.amount, 300);
    assert.equal(app.tForm.groupId, 'G');
    assert.equal(app.tForm.propertyId, null);
    assert.equal(app.tForm.lote, null);
    igual(app.tForm.psplit, { mode: 'equal', parts: {} });
    app.collectTx = () => {};
    Object.assign(app.tForm, { amount: 600, psplit: { mode: 'pct', parts: { A: 2, B: 1, C: 1 } } });
    app.onSave();
    const ps = doLote(lid);
    igual(ps.map((t) => t.id), ids, 'os mesmos ids');
    igual(ps.map((t) => t.amount), [300, 150, 150]);
    assert.ok(ps.every((t) => t.lote.total === 600 && t.lote.modo === 'pct' && t.lote.n === 3));
    igual(ps[0].lote.partes, { A: 2, B: 1, C: 1 });
    assert.equal(app.db.transactions.length, 3, 'nenhuma parte velha ficou');
  });

  test('tirar um imóvel ao grupo DEPOIS de guardar não muda as partes nem as métricas desse ano', () => {
    const lid = umLote();
    const antes = JSON.parse(JSON.stringify(doLote(lid)));
    const m = (pid) => app.metrics(2026, pid, {}).op;
    const mA = m('A'), mC = m('C'), mTudo = m(null);
    app.db.groups[0].ids = ['A', 'B'];
    igual(JSON.parse(JSON.stringify(doLote(lid))), antes);
    perto(m('A'), mA); perto(m('C'), mC); perto(m(null), mTudo);
    perto(mC, 100, 0.001, 'o Faro continua com a parte dele');
    // e editar agora refaz pelo grupo de hoje: a parte do Faro sai
    app.txModal({ id: app.parteId(lid, 'A') });
    app.collectTx = () => {};
    app.onSave();
    igual(doLote(lid).map((t) => [t.propertyId, t.amount]), [['A', 150], ['B', 150]]);
    assert.ok(!app.db.transactions.some((t) => t.propertyId === 'C'), 'a parte que deixou de existir sai');
  });

  test('mudar um lote para um imóvel só deixa um movimento normal com o id do lote; um normal passa a lote com o seu id', () => {
    const lid = umLote();
    app.txModal({ id: app.parteId(lid, 'A') });
    app.collectTx = () => {};
    Object.assign(app.tForm, { groupId: null, propertyId: 'C', psplit: null });
    app.onSave();
    assert.equal(app.db.transactions.length, 1);
    const t = app.db.transactions[0];
    assert.equal(t.id, lid);
    assert.equal(t.propertyId, 'C');
    assert.equal(t.lote, null);
    assert.equal(t.amount, 300);
    // e de volta: o normal passa a lote de «Todos», com o id dele como id do lote
    app.txModal({ id: lid });
    Object.assign(app.tForm, { propertyId: null, todos: true, psplit: { mode: 'equal', parts: {} } });
    app.onSave();
    const ps = doLote(lid);
    assert.equal(ps.length, 3);
    assert.ok(!app.db.transactions.some((x) => x.id === lid), 'o normal saiu');
    assert.ok(ps.every((x) => x.lote.alvo === 'todos'));
    // e para «Sem imóvel»
    app.txModal({ id: ps[0].id });
    Object.assign(app.tForm, { todos: false, propertyId: null, psplit: null });
    app.onSave();
    assert.equal(app.db.transactions.length, 1);
    assert.equal(app.db.transactions[0].id, lid);
    assert.equal(app.db.transactions[0].propertyId, null);
  });

  test('delTx de uma parte apaga o lote inteiro, e o Anular repõe as três', () => {
    const lid = umLote();
    const { toasts } = ecra();
    app.db.transactions.push(app.normTx({ id: 'OUTRO', kind: 'expense', label: 'Outro', amount: 5, propertyId: 'A', date: '2026-03-01' }));
    app.delTx(app.parteId(lid, 'C'));
    igual(app.db.transactions.map((t) => t.id), ['OUTRO']);
    const t = toasts.pop();
    assert.equal(t.m, 'Movimento apagado.');
    t.o.fn();
    igual(doLote(lid).map((x) => x.propertyId), ['A', 'B', 'C']);
    assert.equal(app.db.transactions.length, 4);
  });

  test('um lote incompleto nesta base não abre o formulário nem se apaga, e a ficha diz porquê', () => {
    const lid = umLote();
    const { abertas, toasts } = ecra();
    // quem vê só dois dos três imóveis: a parte do Faro não está na sua base
    app.db.transactions = app.db.transactions.filter((t) => t.propertyId !== 'C');
    app.db.properties = app.db.properties.filter((p) => p.id !== 'C');
    const id = app.parteId(lid, 'A');
    assert.equal(app.loteCompleto(app.db.transactions[0]), false);
    app.txModal({ id });
    const L = abertas[abertas.length - 1];
    assert.doesNotMatch(L.b, /id="t_amount"/, 'é a ficha, e não o formulário');
    assert.ok(L.b.includes('Parte de um movimento dividido por 3 imóveis. Só quem vê os 3 imóveis o altera.'));
    assert.match(L.b, /e mais 1 imóvel que não vês/);
    assert.doesNotMatch(L.f, /Editar/);
    app.delTx(id);
    assert.equal(toasts.pop().m, 'Parte de um movimento dividido por 3 imóveis. Só quem vê os 3 imóveis o altera.');
    assert.equal(app.db.transactions.length, 2, 'nada foi apagado');
  });

  test('um lote de «Todos» só o altera quem o registou: o comproprietário vê a ficha, e não o reparte pelos imóveis dele', () => {
    tresCasas();
    const { abertas, toasts } = ecra();
    registar({ valor: '*', label: 'Contabilista', amount: 300 });
    const ps = app.db.transactions;
    // chegou do servidor: registou-o a Ana, e eu sou comproprietário das três casas
    ps.forEach((t) => { t._createdBy = 'ana'; t._atServidor = 5; });
    sessao({});
    app.txModal({ id: ps[0].id });
    const L = abertas[abertas.length - 1];
    assert.doesNotMatch(L.b, /id="t_amount"/, 'a ficha, e não o formulário');
    assert.ok(L.b.includes('Dividido por todos os imóveis de quem o registou: só essa pessoa o altera.'));
    app.delTx(ps[0].id);
    assert.equal(toasts.pop().m, 'Dividido por todos os imóveis de quem o registou: só essa pessoa o altera.');
    assert.equal(app.db.transactions.length, 3);
    // o de um grupo, um comproprietário altera: o grupo é o mesmo para todos
    registar({ valor: 'g:G', label: 'Seguro', amount: 90 });
    const g = app.db.transactions.filter((t) => t.label === 'Seguro');
    g.forEach((t) => { t._createdBy = 'ana'; t._atServidor = 5; });
    assert.equal(app.recusaDoLote(g[0]), '');
    // e quem o registou (eu) altera o meu «Todos»
    ps.forEach((t) => { t._createdBy = 'eu'; });
    assert.equal(app.recusaDoLote(ps[0]), '');
  });

  test('a ficha de uma parte mostra o total, o grupo, por quantos imóveis e a divisão', () => {
    const lid = umLote();
    const f = app.txFicha(app.parteId(lid, 'B'));
    assert.match(f, /<span>Montante<\/span><b><span class="neg">−300,00/);
    assert.match(f, /<span>Imóvel<\/span><b>Bloco · 3 imóveis<\/b>/);
    assert.match(f, /Divisão entre imóveis/);
    assert.match(f, /Partes iguais<br>Lisboa · 100,00[^<]*<br>Porto · 100,00[^<]*<br>Faro · 100,00/);
    assert.doesNotMatch(f, /que não vês/);
    assert.equal(app.loteCompleto(app.db.transactions[0]), true);
    assert.equal(app.loteCompleto(app.normTx({ kind: 'expense', propertyId: 'A' })), false, 'um movimento normal não é lote');
    igual(app.partesDoLote(lid).map((t) => t.propertyId), ['A', 'B', 'C'], 'pela ordem dos imóveis');
    // de «Todos»
    registar({ valor: '*', label: 'Banco', amount: 12, date: '2023-05-10' });
    const t = app.db.transactions.find((x) => x.label === 'Banco');
    assert.match(app.txFicha(t.id), /<span>Imóvel<\/span><b>Todos os imóveis · 2 imóveis<\/b>/);
  });
});

describe('planeados e modelos: o molde guarda o grupo, e parte-se ao registar', () => {
  test('confirmar um planeado de grupo (pelo formulário e sem abrir) cria as partes e avança o planeado', () => {
    tresCasas();
    const { toasts } = ecra();
    const r = app.normRec({ id: 'R1', name: 'Condomínio', every: 'month', next: '2026-09-01',
      tx: { kind: 'expense', label: 'Condomínio', amount: 90, groupId: 'G', psplit: { mode: 'equal', parts: {} }, category: 'Condomínio' } });
    app.db.recurring = [r];
    assert.equal(r.tx.groupId, 'G', 'o molde guarda o grupo');
    app.confirmRec('R1');
    assert.equal(app.txModo.modo, 'confirmar');
    assert.equal(app.tForm.groupId, 'G');
    app.collectTx = () => {};
    app.onSave();
    assert.equal(toasts.pop().m, 'Movimento confirmado.');
    igual(app.db.transactions.map((t) => [t.propertyId, t.amount, t.date]), [['A', 30, '2026-09-01'], ['B', 30, '2026-09-01'], ['C', 30, '2026-09-01']]);
    assert.equal(app.db.recurring[0].next, '2026-10-01', 'o planeado avançou');
    assert.equal(app.db.recurring[0].tx.groupId, 'G', 'e continua um molde do grupo');
    // sem abrir: o mesmo
    app.db.recurring[0].next = '2026-09-02';
    app.quickConfirmRec('R1');
    const segundo = app.db.transactions.filter((t) => t.date === '2026-09-02');
    assert.equal(segundo.length, 3);
    assert.ok(segundo.every((t) => t.lote && t.lote.alvo === 'g:G' && t.lote.n === 3));
    assert.equal(app.db.recurring[0].next, '2026-10-02');
    assert.ok(app.jaRegistado(app.db.recurring[0], '2026-09-15'), 'o mês já tem o movimento dele');
    // um planeado de um grupo vazio não avança
    app.db.recurring[0].tx.groupId = 'GV';
    app.quickConfirmRec('R1');
    assert.equal(toasts.pop().m, 'O grupo não tem imóveis.');
    assert.equal(app.db.recurring[0].next, '2026-10-02');
  });

  test('um modelo de «Todos» guarda o molde e, a registar também, parte o movimento', () => {
    tresCasas();
    const { toasts } = ecra();
    app.txModal({ kind: 'expense', modo: 'tpl', alsoTx: true, tplName: 'Contabilidade' });
    app.collectTx = () => {};
    Object.assign(app.tForm, { label: 'Contabilidade', amount: 60, date: '2026-04-01', todos: true, propertyId: null, psplit: { mode: 'equal', parts: {} } });
    app.onSave();
    assert.equal(toasts.pop().m, 'Modelo criado e movimento registado.');
    const x = app.db.templates[0];
    assert.equal(x.tx.todos, true);
    assert.equal(x.tx.propertyId, null);
    igual(app.db.transactions.map((t) => [t.propertyId, t.amount]), [['A', 20], ['B', 20], ['C', 20]]);
    // a ficha e o cartão do molde dizem «Todos os imóveis»; um sem imóvel, «Sem imóvel»
    assert.match(app.tplFicha(x.id), /<span>Imóvel<\/span><b>Todos os imóveis<\/b>/);
    app.db.recurring = [app.normRec({ id: 'R2', name: 'Avulso', next: '2026-10-01', tx: { kind: 'expense', amount: 5 } }),
      app.normRec({ id: 'R3', name: 'Todos', next: '2026-10-01', tx: { kind: 'expense', amount: 5, todos: true } })];
    assert.match(app.recFicha('R2'), /<span>Imóvel<\/span><b>Sem imóvel<\/b>/);
    assert.match(app.recFicha('R3'), /<span>Imóvel<\/span><b>Todos os imóveis<\/b>/);
    const pag = app.vRecurring();
    assert.match(pag, /Despesa · Sem imóvel/);
    assert.match(pag, /Despesa · Todos os imóveis/);
  });

  test('um molde com «Todos» pesa nas projeções como um grupo dos mesmos imóveis', () => {
    tresCasas();
    const previstas = () => ['', 'A', 'B', 'C', 'g:G'].map((pid) => app.despesasPrevistas(pid || null).op);
    app.db.recurring = [app.normRec({ name: 'Seguro', every: 'year', next: '2026-10-01', tx: { kind: 'expense', amount: 600, groupId: 'G', psplit: { mode: 'value', parts: {} } } })];
    const doGrupo = previstas();
    app.ownerFilter = 'ana';
    const doGrupoAna = previstas();
    app.ownerFilter = '';
    app.db.recurring = [app.normRec({ name: 'Seguro', every: 'year', next: '2026-10-01', tx: { kind: 'expense', amount: 600, todos: true, psplit: { mode: 'value', parts: {} } } })];
    assert.equal(app.db.recurring[0].tx.todos, true);
    previstas().forEach((v, i) => perto(v, doGrupo[i], 0.001));
    perto(doGrupo[1], 300, 0.001, 'o de Lisboa leva metade (300 000 de 600 000)');
    app.ownerFilter = 'ana';
    previstas().forEach((v, i) => perto(v, doGrupoAna[i], 0.001));
    // e nas métricas, um movimento de «Todos» que não se partiu pesa como o grupo
    app.ownerFilter = '';
    app.db.recurring = [];
    app.db.transactions = [app.normTx({ kind: 'expense', amount: 600, date: '2026-02-01', groupId: 'G', psplit: { mode: 'value', parts: {} } })];
    const mg = ['A', 'B', 'C', null].map((pid) => app.metrics(2026, pid, {}).op);
    app.db.transactions = [app.normTx({ kind: 'expense', amount: 600, date: '2026-02-01', todos: true, psplit: { mode: 'value', parts: {} } })];
    ['A', 'B', 'C', null].map((pid) => app.metrics(2026, pid, {}).op).forEach((v, i) => perto(v, mg[i], 0.001));
  });

  test('despesaRepete reconhece uma parte pelo planeado do grupo (ou de «Todos»), e não pelo do imóvel', () => {
    tresCasas();
    ecra();
    registar({ valor: 'g:G', label: 'Obras', amount: 300, cat: 'Obras e benfeitorias', date: '2025-04-01' });
    const parte = app.db.transactions[0];
    assert.equal(app.despesaRepete(parte), false, 'sem planeado');
    app.db.recurring = [app.normRec({ name: 'Obras', next: '2026-10-01', tx: { kind: 'expense', amount: 300, groupId: 'G', category: 'Obras e benfeitorias' } })];
    assert.equal(app.despesaRepete(parte), true, 'o planeado do grupo reconhece-a');
    app.db.recurring = [app.normRec({ name: 'Obras', next: '2026-10-01', tx: { kind: 'expense', amount: 300, groupId: 'G1', category: 'Obras e benfeitorias' } })];
    assert.equal(app.despesaRepete(parte), false, 'o de outro grupo não');
    app.db.recurring = [app.normRec({ name: 'Obras', next: '2026-10-01', tx: { kind: 'expense', amount: 300, propertyId: 'A', category: 'Obras e benfeitorias' } })];
    assert.equal(app.despesaRepete(parte), false, 'o do imóvel não: partir não muda o que fica de fora');
    app.db.recurring = [app.normRec({ name: 'Obras', next: '2026-10-01', tx: { kind: 'expense', amount: 300, todos: true, category: 'Obras e benfeitorias' } })];
    assert.equal(app.despesaRepete(parte), false, 'o de «Todos» só reconhece as partes de «Todos»');
    const semImovel = app.normTx({ kind: 'expense', amount: 5, category: 'Obras e benfeitorias', date: '2025-04-01' });
    assert.equal(app.despesaRepete(semImovel), false, 'nem um movimento sem imóvel');
  });
});

describe('a migração dos movimentos de grupo antigos', () => {
  /* Os números que não podem mudar: as métricas por imóvel, do grupo e da
     vista geral (sem filtro e com a Ana filtrada), os saldos entre donos (de
     tudo, de cada imóvel e do grupo), o «como se chega aos saldos» somado, e
     as despesas de uma vez do último ano completo.
     Devolve: {nome: número}. */
  function numeros() {
    const out = {};
    for (const filtro of ['', 'ana']) {
      app.ownerFilter = filtro;
      for (const pid of [null, 'A', 'B', 'C', 'g:G']) {
        for (const y of [2025, 2026]) {
          const m = app.metrics(y, pid, { share: true });
          out[`${filtro}|${pid}|${y}|op`] = m.op; out[`${filtro}|${pid}|${y}|inc`] = m.income;
        }
        out[`${filtro}|${pid}|fora`] = app.despesasDeUmaVez(pid).fora;
      }
    }
    app.ownerFilter = '';
    for (const pid of [null, 'A', 'B', 'C', 'g:G']) {
      const b = app.ownerBalances(pid);
      for (const k of Object.keys(b)) out[`saldo|${pid}|${k}`] = b[k];
    }
    const eff = {};
    app.balanceLines(null).forEach((l) => l.os.forEach((o) => { eff[o] = (eff[o] || 0) + (l.eff[o] || 0); }));
    for (const k of Object.keys(eff)) out['linhas|' + k] = eff[k] / 100;
    return out;
  }
  /* compara dois retratos ao cêntimo (um dono que só aparece num dos dois tem de estar a zero) */
  function iguaisAoCentimo(a, b) {
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) perto(b[k] || 0, a[k] || 0, 0.005, k);
  }
  /* os movimentos antigos: um de grupo pago por mim, uma renda de grupo recebida
     pela Ana, uma despesa de grupo paga pelo Rui (dono só do Faro) pelo valor
     de mercado, no ano passado com um planeado do grupo, e um sem imóvel */
  function antigos() {
    tresCasas();
    app.db.transactions = [
      app.normTx({ id: 'V1', kind: 'expense', label: 'Seguro', amount: 1000, date: '2026-02-10', groupId: 'G', psplit: { mode: 'equal', parts: {} }, paidBy: 'eu' }),
      app.normTx({ id: 'V2', kind: 'income', label: 'Renda', amount: 600.01, date: '2026-03-10', groupId: 'G', psplit: { mode: 'pct', parts: { A: 1, B: 2, C: 3 } }, paidBy: 'ana', retencao: 10 }),
      app.normTx({ id: 'V3', kind: 'expense', label: 'Obras', amount: 333.33, date: '2025-05-10', groupId: 'G', psplit: { mode: 'value', parts: {} }, paidBy: 'rui', category: 'Obras e benfeitorias' }),
      app.normTx({ id: 'S1', kind: 'expense', label: 'Banco', amount: 90, date: '2026-04-01', paidBy: 'rui' }),
      app.normTx({ id: 'N1', kind: 'expense', label: 'Luz', amount: 40, date: '2026-04-01', propertyId: 'A', paidBy: 'ana' }),
    ];
    // o planeado do grupo reconhece as obras: antes de partir e, pelo lote, depois
    app.db.recurring = [app.normRec({ name: 'Obras', next: '2026-10-01', tx: { kind: 'expense', amount: 1, groupId: 'G', category: 'Obras e benfeitorias' } })];
    // e uma despesa de uma vez no ano passado, num imóvel, para o «de fora» não ser só zeros
    app.db.transactions.push(app.normTx({ id: 'N2', kind: 'expense', label: 'Caldeira', amount: 250, date: '2025-06-01', propertyId: 'C', category: 'Manutenção e reparações' }));
  }

  test('parte cada movimento antigo de grupo com lote.id = o id antigo; o antigo sai; os números ficam iguais ao cêntimo', () => {
    antigos();
    const antes = numeros();
    assert.equal(app.migrarMovimentosDeGrupo(), 3);
    assert.ok(!app.db.transactions.some((t) => ['V1', 'V2', 'V3'].includes(t.id)), 'os antigos saíram');
    assert.ok(!app.db.transactions.some((t) => t.groupId), 'nenhum registo de grupo fica');
    igual(doLote('V1').map((t) => [t.id, t.propertyId, t.amount]), [['V1_A', 'A', 333.34], ['V1_B', 'B', 333.33], ['V1_C', 'C', 333.33]]);
    const v2 = doLote('V2');
    assert.equal(somaCent(v2), 60001);
    assert.equal(v2.reduce((a, t) => a + cent(t.retencao), 0), 1000, 'o retido também');
    assert.ok(v2.every((t) => t.lote.modo === 'pct' && t.lote.total === 600.01 && t.lote.alvo === 'g:G'));
    assert.equal(somaCent(doLote('V3')), 33333);
    assert.ok(app.db.transactions.some((t) => t.id === 'S1' && !t.propertyId && !t.lote), 'o sem imóvel fica como estava');
    iguaisAoCentimo(antes, numeros());
  });

  test('não parte o que tem um imóvel onde não posso adicionar, nem o de um grupo que já não existe; correr duas vezes não duplica', () => {
    antigos();
    sessao({ C: { dono: false, nome: 'Ver', perms: ['tx.view'] } });
    app.db.transactions.push(app.normTx({ id: 'V4', kind: 'expense', label: 'Sem grupo', amount: 10, date: '2026-02-10', groupId: 'NAO' }));
    app.db.transactions.push(app.normTx({ id: 'V5', kind: 'loan', label: 'Prestação de grupo', amount: 10, date: '2026-02-10', groupId: 'G' }));
    const antes = JSON.parse(JSON.stringify(app.db.transactions));
    assert.equal(app.migrarMovimentosDeGrupo(), 0, 'o Faro é de colaboração só de ver');
    igual(JSON.parse(JSON.stringify(app.db.transactions)), antes);
    app.window.CW = undefined;
    assert.equal(app.migrarMovimentosDeGrupo(), 3, 'sem a restrição, partem-se os três de receita e despesa');
    const depois = JSON.parse(JSON.stringify(app.db.transactions));
    assert.equal(app.migrarMovimentosDeGrupo(), 0, 'a segunda vez não faz nada');
    igual(JSON.parse(JSON.stringify(app.db.transactions)), depois);
    assert.ok(app.db.transactions.some((t) => t.id === 'V4' && t.groupId === 'NAO'), 'o grupo apagado fica como estava');
    assert.ok(app.db.transactions.some((t) => t.id === 'V5' && t.groupId === 'G'), 'uma prestação não se parte');
  });

  test('um grupo de um imóvel só vira um movimento normal quando as contas não mudam, e fica quando mudariam', () => {
    tresCasas();
    app.db.transactions = [
      app.normTx({ id: 'U1', kind: 'expense', label: 'Meu', amount: 50, date: '2026-02-10', groupId: 'G1', paidBy: 'eu' }),
      app.normTx({ id: 'U2', kind: 'expense', label: 'Da Ana', amount: 50, date: '2026-02-10', groupId: 'G1', paidBy: 'ana' }),
    ];
    const antes = app.ownerBalances(null);
    assert.equal(app.migrarMovimentosDeGrupo(), 1);
    const u1 = app.db.transactions.find((t) => t.id === 'U1');
    assert.equal(u1.propertyId, 'B');
    assert.equal(u1.lote, null);
    assert.equal(app.db.transactions.find((t) => t.id === 'U2').groupId, 'G1', 'a Ana pagou no Porto, que não é dela: ficava a crédito, e fica');
    const depois = app.ownerBalances(null);
    for (const k of new Set(Object.keys(antes).concat(Object.keys(depois)))) perto(depois[k] || 0, antes[k] || 0, 0.005, k);
  });

  test('as partes de um lote contam nos saldos como o grupo contava — num imóvel de um dono só, ou pago por quem não é dono', () => {
    tresCasas();
    ecra();
    registar({ valor: 'g:G', label: 'Seguro', amount: 900, paga: 'ana' });
    const b = app.ownerBalances(null);
    // a Ana pagou 900: 300 em Lisboa (meia com ela: 150 dela), 300 no Porto (só meu), 300 no Faro (meu e do Rui)
    perto(b.ana, 750); perto(b.eu, -600); perto(b.rui, -150);
    perto(Object.values(b).reduce((a, x) => a + x, 0), 0);
    const eff = {};
    app.balanceLines(null).forEach((l) => l.os.forEach((o) => { eff[o] = (eff[o] || 0) + (l.eff[o] || 0) / 100; }));
    Object.keys(b).forEach((k) => perto(eff[k], b[k], 0.001, k));
    // quem só tem imóveis seus: um «Todos» pago por si não inventa contas a zero
    app.db.owners = [app.normPerson({ id: 'eu', name: 'Eu' })];
    app.db.properties = app.db.properties.map((p) => Object.assign(p, { ownerIds: ['eu'] }));
    app.db.transactions = [];
    registar({ valor: '*', label: 'Contabilista', amount: 90, paga: 'eu' });
    assert.equal(app.db.transactions.length, 3);
    igual(app.ownerBalances(null), {});
    igual(app.balanceLines(null), []);
    assert.equal(app.balancesCard(null), '', 'sem cartão de contas entre proprietários');
  });

  test('os movimentos sem imóvel que já existem continuam a dar os mesmos números: na vista geral e nos saldos, nunca num imóvel', () => {
    tresCasas();
    app.db.transactions = [app.normTx({ id: 'S1', kind: 'expense', label: 'Banco', amount: 90, date: '2026-04-01', paidBy: 'eu' })];
    perto(app.metrics(2026, null, {}).op, 90);
    perto(app.metrics(2026, 'A', {}).op, 0);
    perto(app.metrics(2026, 'g:G', {}).op, 0);
    const b = app.ownerBalances(null);
    perto(b.eu, 60); perto(b.ana, -30); perto(b.rui, -30);
    assert.equal(app.migrarMovimentosDeGrupo(), 0);
    assert.equal(app.db.transactions[0].propertyId, null);
    assert.match(app.txFicha('S1'), /<span>Imóvel<\/span><b>Sem imóvel<\/b>/);
  });
});

describe('apagar um grupo', () => {
  test('a frase diz que os movimentos já partidos ficam em cada imóvel, e só os antigos ficam sem grupo', () => {
    tresCasas();
    const { abertas } = ecra();
    app.confirmModal = (t, b, cb) => { abertas.push({ t, b, cb }); };
    registar({ valor: 'g:G', label: 'Seguro', amount: 300 });
    app.db.transactions.push(app.normTx({ id: 'V1', kind: 'expense', label: 'Antigo', amount: 10, date: '2026-02-10', groupId: 'G' }));
    app.delGroup('G');
    const c = abertas[abertas.length - 1];
    assert.match(c.b, /O movimento já registado neste grupo fica em cada imóvel, como está\./);
    assert.match(c.b, /Um movimento antigo, ainda por dividir pelos imóveis, fica sem grupo: passa a «Sem imóvel» e conta só nos totais\./);
    c.cb();
    assert.equal(doLote(app.db.transactions[0].lote.id).length, 3, 'as partes ficam');
    assert.equal(app.db.transactions.find((t) => t.id === 'V1').groupId, null);
  });
});
