// O formulário do movimento quando há mais do que um proprietário à escolha:
// o meu nome leva « (eu)» no fim — em «Pago por»/«Recebido por», em «Quem
// paga»/«Quem recebe» e nas linhas da divisão entre proprietários. E a opção
// vazia do imóvel, que se chamava «Todos os imóveis» e ninguém lia como «sem
// imóvel»: passa a «Sem imóvel» (num acerto continua «Todos os imóveis»: um
// acerto sem imóvel é de todos), com uma dica por baixo, e a ficha diz o mesmo.
// «Todos os imóveis» voltou, mas como opção à parte — a segunda, numa receita
// ou despesa de quem tem dois ou mais imóveis — e divide-se pelos imóveis
// (o testes/lotes.test.js prova o resto).
// A sessão simula-se com window.CW, como no cargos.test.js.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
// as janelas abrem numa pilha observável: cada uma guarda o corpo que recebeu
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp();
afterEach(() => repor(app));
// a sessão simulada vive no window do contexto, que o repor não toca: sai à parte
afterEach(() => { app.window.CW = undefined; });

const DICA = 'Conta nos totais, mas não na avaliação de nenhum imóvel.';

/* uma sessão com o meu id ('eu'); sem argumentos, sem sessão
   Recebe: com — true para pôr a sessão; cargos (opcional) — os cargos por casa.
   Devolve: nada. */
function sessao(com, cargos) {
  app.window.CW = com ? { user: { id: 'eu' }, cargos: cargos || {}, pessoas: {} } : undefined;
}
/* dois imóveis meus: o T2, a meias com o Rui, e o T1, só meu; e a sessão posta
   Devolve: nada. */
function duasCasas() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'eu', name: 'Eu' }), app.normPerson({ id: 'rui', name: 'Rui' })];
  app.db.properties = [
    app.normProp({ id: 'P1', name: 'T2 Meias', value: 100000, ownerIds: ['eu', 'rui'] }),
    app.normProp({ id: 'P2', name: 'T1 Só meu', value: 100000, ownerIds: ['eu'] }),
  ];
  sessao(true);
}
/* os rótulos das opções de um seletor do formulário aberto, sem as linhas divisórias
   Recebe: id — o id do sel() ('t_prop', 't_paid', 't_to').
   Devolve: array de textos. */
const opcoes = (id) => Array.from(app.window.__sel[id].options).filter((o) => !o.div).map((o) => o.label);
/* os nomes nas linhas da divisão entre proprietários, pela ordem do HTML
   Recebe: html — o corpo do formulário.
   Devolve: array de textos. */
const linhasDaDivisao = (html) => [...html.matchAll(/<span class="nm">([^<]*)<\/span>/g)].map((m) => m[1]);
/* as escolhas dos chips de «Pago por»/«Recebido por»: o nome inteiro de
   cada uma, no title (o que o leitor de ecrã também lê), e o que se vê no
   chip
   Recebe: html — o corpo do formulário.
   Devolve: array de {nome, curto}. */
const segmento = (html) => [...html.matchAll(/<button type="button" role="radio"[^>]*title="([^"]*)"[^>]*data-click="txPagoPor\([^)]*\)"><svg[\s\S]*?<\/svg><span>([^<]*)<\/span><\/button>/g)]
  .map((m) => ({ nome: m[1], curto: m[2] }));
const nomes = (html) => segmento(html).map((x) => x.nome);

describe('rotuloDoDono', () => {
  test('« (eu)» só no meu, e só com mais do que um à escolha', () => {
    duasCasas();
    assert.equal(app.rotuloDoDono({ id: 'eu', name: 'Eu' }, 2), 'Eu (eu)');
    assert.equal(app.rotuloDoDono({ id: 'rui', name: 'Rui' }, 2), 'Rui');
    assert.equal(app.rotuloDoDono({ id: 'eu', name: 'Eu' }, 1), 'Eu', 'sozinho não há que distinguir');
    assert.equal(app.rotuloDoDono({ id: 'eu', name: 'Eu' }, 0), 'Eu');
    sessao(false);
    assert.equal(app.rotuloDoDono({ id: 'eu', name: 'Eu' }, 2), 'Eu', 'sem sessão ninguém é «eu»');
    assert.equal(app.rotuloDoDono(null, 2), '', 'aguenta uma ficha em falta');
  });
});

describe('o «(eu)» no formulário do movimento', () => {
  test('com dois proprietários, «Pago por» diz «Eu (eu)» e «Rui»; a divisão em percentagem também', () => {
    duasCasas();
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense', propId: 'P1', preset: { split: { mode: 'percent', parts: {} } } });
    // «Todos» e um chip por dono, com o nome inteiro
    assert.deepEqual(nomes(abertas[0].b), ['Todos os proprietários', 'Eu (eu)', 'Rui']);
    assert.deepEqual(segmento(abertas[0].b).map((x) => x.curto), ['Todos', 'Eu (eu)', 'Rui']);
    assert.match(abertas[0].b, /<span class="flabel" id="t_paidL">Pago por<\/span><input type="hidden" id="t_paid" value="">/);
    assert.deepEqual(linhasDaDivisao(abertas[0].b), ['Eu (eu)', 'Rui']);
    // o campo de cada linha continua a ir pelo id, e não pelo rótulo
    assert.match(abertas[0].b, /id="t_sp_eu"/);
    assert.match(abertas[0].b, /id="t_sp_rui"/);
    // numa renda o rótulo é «Recebido por», com o mesmo sufixo
    app.txModal({ kind: 'income', propId: 'P1' });
    assert.match(abertas[1].b, /Recebido por/);
    assert.deepEqual(nomes(abertas[1].b), ['Todos os proprietários', 'Eu (eu)', 'Rui']);
  });

  test('os chips mostram o nome inteiro, sem o cortar ao primeiro', () => {
    duasCasas();
    app.db.owners = [app.normPerson({ id: 'eu', name: 'Ana Costa' }), app.normPerson({ id: 'rui', name: 'Rui Matos' })];
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense', propId: 'P1' });
    assert.deepEqual(segmento(abertas[0].b).map((x) => x.curto), ['Todos', 'Ana Costa (eu)', 'Rui Matos']);
    assert.deepEqual(nomes(abertas[0].b), ['Todos os proprietários', 'Ana Costa (eu)', 'Rui Matos']);
    app.db.owners[1].name = 'Ana Matos';
    app.txModal({ kind: 'expense', propId: 'P1' });
    assert.deepEqual(segmento(abertas[1].b).map((x) => x.curto), ['Todos', 'Ana Costa (eu)', 'Ana Matos']);
  });

  test('um toque num chip escreve no campo e no movimento, sem repintar', () => {
    duasCasas();
    janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense', propId: 'P1' });
    let repintou = 0;
    const repaint = app.repaintTx;
    app.repaintTx = () => { repintou++; };
    try {
      app.txPagoPor('rui');
      assert.equal(app.tForm.paidBy, 'rui');
      assert.equal(app.document.getElementById('t_paid').value, 'rui', 'o campo que o collectTx lê');
      app.txPagoPor('');
      assert.equal(app.tForm.paidBy, null, '«Todos» é ninguém em particular');
      assert.equal(app.document.getElementById('t_paid').value, '');
      assert.equal(repintou, 0, 'o resto do formulário não depende de quem pagou');
    } finally { app.repaintTx = repaint; }
  });

  test('com três ou mais donos continuam a ser chips, um por dono', () => {
    duasCasas();
    app.db.owners.push(app.normPerson({ id: 'bia', name: 'Bia' }));
    app.db.properties[0].ownerIds = ['eu', 'rui', 'bia'];
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense', propId: 'P1' });
    assert.deepEqual(nomes(abertas[0].b), ['Todos os proprietários', 'Eu (eu)', 'Rui', 'Bia']);
    assert.match(abertas[0].b, /<div class="chips-fila pago-por" role="radiogroup" aria-labelledby="t_paidL">/);
    assert.doesNotMatch(abertas[0].b, /<label>Pago por<div class="sel"/, 'já não troca para o menu');
  });

  test('a dica da divisão vai pelo primeiro nome, sem o sufixo, e diz se a soma bate certo', () => {
    duasCasas();
    janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense', propId: 'P1', preset: { amount: 100, paidBy: 'eu' } });
    const dica = app.splitHint(app.ownersOfProp(app.prop('P1')).map(app.owner));
    assert.ok(dica.includes('<span class="mov-pnome">Eu</span><span class="small">50%</span><b>' + app.euro2(50) + '</b>'), dica);
    assert.doesNotMatch(dica, /\(eu\)/);
    assert.ok(dica.includes('Soma ' + app.euro2(100) + ' — bate certo.'), dica);
    // em valor certo, o que falta diz-se em vez do «bate certo»
    app.tForm.split = { mode: 'amount', parts: { eu: 30, rui: 20 } };
    const falta = app.splitHint(app.ownersOfProp(app.prop('P1')).map(app.owner));
    assert.match(falta, /class="mov-soma perigo"/);
    assert.ok(falta.includes('Faltam ' + app.euro2(50) + ': os valores têm de somar ' + app.euro2(100) + '.'), falta);
    assert.doesNotMatch(falta, /bate certo/);
  });

  test('com um só proprietário não há «(eu)»', () => {
    duasCasas();
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense', propId: 'P2' });
    assert.deepEqual(nomes(abertas[0].b), ['Todos os proprietários', 'Eu']);
    assert.equal(app.tForm.paidBy, 'eu', 'e fica logo escolhido, como sempre');
    assert.match(abertas[0].b, /role="radio" aria-checked="true" class="chip on" data-v="eu"/, 'e aceso nos chips');
  });

  test('sem sessão (meuId vazio) não há «(eu)», mesmo com dois proprietários', () => {
    duasCasas();
    sessao(false);
    assert.equal(app.meuId(), '');
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense', propId: 'P1', preset: { split: { mode: 'percent', parts: {} } } });
    assert.deepEqual(nomes(abertas[0].b), ['Todos os proprietários', 'Eu', 'Rui']);
    assert.deepEqual(linhasDaDivisao(abertas[0].b), ['Eu', 'Rui']);
    assert.doesNotMatch(abertas[0].b, /\(eu\)/);
  });

  test('num acerto, «Quem paga» e «Quem recebe» levam o «(eu)»', () => {
    duasCasas();
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'settle', propId: 'P1' });
    assert.match(abertas[0].b, /Quem paga/);
    assert.match(abertas[0].b, /Quem recebe/);
    assert.deepEqual(opcoes('t_paid'), ['Todos os proprietários', 'Eu (eu)', 'Rui']);
    assert.deepEqual(opcoes('t_to'), ['Todos os proprietários', 'Eu (eu)', 'Rui']);
  });
});

describe('a opção «Sem imóvel»', () => {
  test('numa despesa de um dono é a primeira opção, e «Todos os imóveis» é outra, a seguir', () => {
    duasCasas();
    janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense' });
    assert.equal(app.tForm.propertyId, null, 'com dois imóveis nenhum fica pré-escolhido');
    assert.deepEqual(opcoes('t_prop'), ['Sem imóvel', 'Todos os imóveis', 'T2 Meias', 'T1 Só meu']);
    assert.equal(app.window.__sel.t_prop.options[0].v, '', '«Sem imóvel» é o valor vazio');
    assert.equal(app.window.__sel.t_prop.options[1].v, '*', '«Todos os imóveis» é outro valor');
    // numa renda, o mesmo; num pagamento de crédito, «Sem imóvel» e sem «Todos»
    app.txModal({ kind: 'income' });
    assert.deepEqual(opcoes('t_prop').slice(0, 2), ['Sem imóvel', 'Todos os imóveis']);
    app.txModal({ kind: 'loan' });
    assert.equal(opcoes('t_prop')[0], 'Sem imóvel');
    assert.ok(!opcoes('t_prop').includes('Todos os imóveis'));
  });

  test('num acerto a primeira opção continua «Todos os imóveis»', () => {
    duasCasas();
    janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'settle' });
    assert.deepEqual(opcoes('t_prop'), ['Todos os imóveis', 'T2 Meias', 'T1 Só meu']);
  });

  test('com «Sem imóvel» escolhido o formulário mostra a dica; com um imóvel, não; num acerto, nunca', () => {
    duasCasas();
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense' });
    assert.ok(abertas[0].b.includes(DICA), 'sem imóvel: a dica');
    // o imóvel vive ao lado da data (o canvas): a dica vem logo a seguir aos dois
    assert.match(abertas[0].b, /<\/label><\/div>\s*<div class="hint u-mt-n6px">Conta nos totais/, 'logo a seguir ao seletor do imóvel');
    app.txModal({ kind: 'expense', propId: 'P1' });
    assert.ok(!abertas[1].b.includes(DICA), 'com imóvel: sem dica');
    app.txModal({ kind: 'settle' });
    assert.ok(!abertas[2].b.includes(DICA), 'num acerto sem imóvel é «Todos os imóveis»: sem dica');
    // num movimento de grupo também não: tem imóveis, os do grupo
    app.db.groups.push(app.normGroup({ id: 'G', name: 'Bloco', kind: 'prop', ids: ['P1', 'P2'] }));
    app.txModal({ kind: 'expense', preset: { groupId: 'G' } });
    assert.ok(!abertas[3].b.includes(DICA), 'num grupo: sem dica');
  });

  test('um dono com uma casa só abre-a pré-escolhida e pode trocar para «Sem imóvel»', () => {
    duasCasas();
    app.db.properties.pop();
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense' });
    assert.equal(app.tForm.propertyId, 'P1', 'a única casa fica escolhida');
    assert.deepEqual(opcoes('t_prop'), ['Sem imóvel', 'T2 Meias']);
    assert.ok(!abertas[0].b.includes(DICA));
    // troca para «Sem imóvel» no seletor: o valor vazio
    app.document.getElementById('t_prop').value = '';
    app.onPropChange();
    assert.equal(app.tForm.propertyId, null);
    assert.ok(abertas[0].body.innerHTML.includes(DICA), 'repintado com a dica');
    assert.deepEqual(opcoes('t_prop'), ['Sem imóvel', 'T2 Meias']);
  });

  test('guardar uma despesa sem imóvel grava com propertyId null, e a ficha diz «Sem imóvel»', () => {
    duasCasas();
    janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.txModal({ kind: 'expense' });
    app.collectTx = () => {};
    Object.assign(app.tForm, { label: 'Seguro da atividade', amount: 120, date: '2026-03-01', propertyId: null, groupId: null, paidBy: 'eu' });
    app.onSave();
    assert.equal(msg, 'Movimento adicionado.');
    assert.equal(app.db.transactions.length, 1);
    const t = app.db.transactions[0];
    assert.equal(t.propertyId, null);
    assert.equal(t.groupId, null);
    assert.equal(t.label, 'Seguro da atividade');
    const ficha = app.txFicha(t.id);
    assert.match(ficha, /<span>Imóvel<\/span><b>Sem imóvel<\/b>/);
    assert.doesNotMatch(ficha, /Todos os imóveis/);
  });

  test('a ficha de um acerto sem imóvel diz «Todos os imóveis»; a de um movimento de grupo, o grupo', () => {
    duasCasas();
    app.db.transactions.push(app.normTx({ id: 'S1', kind: 'settle', label: 'Acerto', amount: 50, date: '2026-03-01', propertyId: null, paidBy: 'eu', toId: 'rui' }));
    const ficha = app.txFicha('S1');
    assert.match(ficha, /<span>Imóvel<\/span><b>Todos os imóveis<\/b>/);
    assert.doesNotMatch(ficha, /Sem imóvel/);
    app.db.groups.push(app.normGroup({ id: 'G', name: 'Bloco', kind: 'prop', ids: ['P1', 'P2'] }));
    app.db.transactions.push(app.normTx({ id: 'G1', kind: 'expense', label: 'Seguro', amount: 50, date: '2026-03-01', groupId: 'G' }));
    assert.match(app.txFicha('G1'), /<span>Imóvel<\/span><b>Grupo Bloco<\/b>/);
    // e com imóvel, o nome dele
    app.db.transactions.push(app.normTx({ id: 'T1', kind: 'expense', label: 'Luz', amount: 20, date: '2026-03-01', propertyId: 'P1' }));
    assert.match(app.txFicha('T1'), /<span>Imóvel<\/span><b>T2 Meias<\/b>/);
  });

  test('quem só colabora continua sem a opção «Sem imóvel» (nem «Todos os imóveis»), e sem a dica', () => {
    duasCasas();
    const CONTAB = ['tx.view', 'tx.add'];
    sessao(true, { P1: { dono: false, nome: 'Contabilista', perms: CONTAB }, P2: { dono: false, nome: 'Contabilista', perms: CONTAB } });
    assert.equal(app.souSoColaborador(), true);
    assert.equal(app.podeSemImovel(), false);
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.txModal({ kind: 'expense' });
    assert.equal(app.tForm.propertyId, 'P1', 'cai no primeiro imóvel permitido');
    assert.deepEqual(opcoes('t_prop'), ['T2 Meias', 'T1 Só meu']);
    assert.ok(!abertas[0].b.includes(DICA));
    // e mesmo com o imóvel tirado à força, a dica não aparece: não tem onde gravar sem imóvel
    app.tForm.propertyId = null;
    assert.ok(!app.txBody().includes(DICA));
  });
});
