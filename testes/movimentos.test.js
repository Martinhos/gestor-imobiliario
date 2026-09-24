// Os cartões de resumo dos Movimentos: abrir um indicador e ficar a ver só
// esse tipo. O caminho fazia-se à mão pelo modal de filtros — agora a janela
// do cartão traz o botão. O Saldo é a volta atrás.
//
// Também aqui: o separador dos Colaboradores, que só aparece com conta.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
// as janelas abrem numa pilha observável: cada uma guarda título, corpo e rodapé
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp();
afterEach(() => repor(app));

function monta() {
  limpar(app);
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
  app.db.transactions = [
    app.normTx({ id: 'T1', kind: 'income', label: 'Renda', amount: 800, propertyId: 'P1', date: '2026-03-08' }),
    app.normTx({ id: 'T2', kind: 'expense', label: 'Condomínio', amount: 55, propertyId: 'P1', date: '2026-03-08' }),
    app.normTx({ id: 'T3', kind: 'loan', label: 'Prestação', amount: 400, propertyId: 'P1', date: '2026-03-10' }),
    app.normTx({ id: 'T4', kind: 'owed', label: 'Emprestei ao Rui', amount: 100, propertyId: 'P1', date: '2026-03-11' }),
    app.normTx({ id: 'T5', kind: 'repay', label: 'Devolvi ao banco', amount: 30, propertyId: 'P1', date: '2026-03-12' }),
  ];
  app.txFilter = ''; app.txCat = ''; app.txSub = '';
}

// o rodapé da janela do cartão com este rótulo
function rodapeDe(abertas, titulo) {
  const j = abertas.find((x) => x.t === titulo);
  assert.ok(j, 'a janela «' + titulo + '» abriu');
  return j.f || '';
}

// abre a janela de cada cartão de resumo e devolve as janelas abertas
function abreCartoes() {
  const abertas = janelasFalsas(app, 'render', 'toast');
  const html = app.vTransactions();
  const ids = (html.match(/id="(k\d+)"/g) || []).map((m) => m.slice(4, -1));
  ids.forEach((id) => app.kpiModal(id));
  return { abertas, html, ids };
}

describe('os cartões de resumo levam ao filtro', () => {
  beforeEach(monta);

  test('cada cartão oferece ver só o seu tipo; o saldo só quando há filtro', () => {
    const { abertas } = abreCartoes();
    assert.match(rodapeDe(abertas, 'Receitas'), /txVerTipo\('income'\)/);
    assert.match(rodapeDe(abertas, 'Receitas'), /Ver só as receitas/);
    assert.match(rodapeDe(abertas, 'Despesas'), /txVerTipo\('expense'\)/);
    assert.match(rodapeDe(abertas, 'Prestações'), /txVerTipo\('loan'\)/);
    assert.match(rodapeDe(abertas, 'Dívidas recebidas'), /txVerTipo\('owed'\)/);
    assert.match(rodapeDe(abertas, 'Dívidas pagas'), /txVerTipo\('repay'\)/);
    // sem filtro, o saldo já mostra tudo: não há para onde voltar
    assert.doesNotMatch(rodapeDe(abertas, 'Saldo'), /txVerTipo/);
    // todas fecham
    abertas.forEach((j) => assert.match(j.f, /Fechar/));
  });

  test('com um tipo filtrado, o saldo traz a volta atrás e o próprio tipo já não se oferece', () => {
    app.txFilter = 'income';
    const { abertas } = abreCartoes();
    assert.match(rodapeDe(abertas, 'Saldo'), /txVerTipo\(''\)/);
    assert.match(rodapeDe(abertas, 'Saldo'), /Ver todos os tipos/);
    assert.doesNotMatch(rodapeDe(abertas, 'Receitas'), /txVerTipo/, 'já se está a ver só as receitas');
  });

  test('txVerTipo muda o filtro e limpa a categoria, que era do tipo anterior', () => {
    janelasFalsas(app, 'render', 'toast');
    app.txCat = 'Condomínio'; app.txSub = 'Quota mensal';
    app.txVerTipo('loan');
    assert.equal(app.txFilter, 'loan');
    assert.equal(app.txCat, '');
    assert.equal(app.txSub, '');
    app.txVerTipo('');
    assert.equal(app.txFilter, '', 'o saldo devolve todos os tipos');
  });

  test('o filtro por dívidas recebidas ou pagas separa-as, e o seletor tem as duas', () => {
    janelasFalsas(app, 'render', 'toast');
    const so = (k) => { app.txFilter = k; return app.db.transactions.filter(app.txMatch).map((t) => t.id); };
    assert.deepEqual(Array.from(so('owed')), ['T4']);
    assert.deepEqual(Array.from(so('repay')), ['T5']);
    assert.deepEqual(Array.from(so('debt')), ['T4', 'T5'], 'juntas, como sempre');
    app.txFilter = '';
    const corpo = app.txFilterBody();
    assert.match(corpo, /Dívidas recebidas/);
    assert.match(corpo, /Dívidas pagas/);
  });
});

describe('o separador dos Colaboradores', () => {
  beforeEach(monta);

  test('vive na secção Pessoas, a seguir aos Proprietários', () => {
    const pessoas = app.NAV_GROUPS.find((g) => g.label === 'Pessoas');
    assert.deepEqual(Array.from(pessoas.ids), ['visits', 'tenants', 'owners', 'colaboradores']);
    const t = app.TABS.find((x) => x.id === 'colaboradores');
    assert.ok(t && t.label === 'Colaboradores', 'o separador existe');
  });

  test('sem conta na nuvem esconde-se, e a vista explica porquê', () => {
    app.window.CW = null;
    assert.ok(app.separadoresEscondidos().indexOf('colaboradores') > -1, 'escondido sem sessão');
    const html = app.vColabTab();
    assert.match(html, /Precisas de uma conta/);
    assert.match(html, /goSet\('cloud'\)/);
    app.window.CW = { user: { id: 'EU' }, cargos: {} };
    assert.equal(app.separadoresEscondidos().indexOf('colaboradores'), -1, 'com sessão aparece');
    app.window.CW = null;
  });
});
