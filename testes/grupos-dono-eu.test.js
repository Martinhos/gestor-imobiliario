// Num grupo de proprietários, o meu nome leva « (eu)» no fim, como no
// formulário do movimento (acessos.js:rotuloDoDono): no seletor de adicionar
// (definicoes.js:addGroupMember), nos chips dos membros (definicoes.js:groupBody)
// e no resumo do cartão (definicoes.js:cartaoDoGrupo), os três pelo
// definicoes.js:gMemberName. O avatar do seletor fica com as iniciais do nome.
// A sessão simula-se com window.CW, como no movimento-dono-eu.test.js.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp();
afterEach(() => repor(app));
afterEach(() => { app.window.CW = undefined; });

/* eu e o Rui como proprietários, e a sessão posta (ou não)
   Recebe: com — true para pôr a sessão com o meu id ('eu').
   Devolve: nada. */
function doisDonos(com) {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'eu', name: 'Martinho' }), app.normPerson({ id: 'rui', name: 'Rui Costa' })];
  app.window.CW = com ? { user: { id: 'eu' }, cargos: {}, pessoas: {} } : undefined;
}
/* abre «Novo grupo de proprietários» e o seletor de adicionar; devolve as
   opções que o seletor recebeu e o HTML que ele desenhou
   Devolve: {opts, html, abertas}. */
function abrirSeletor() {
  const abertas = janelasFalsas(app, 'render', 'save');
  app.groupModal('owner');
  app.addGroupMember();
  const sel = abertas[abertas.length - 1];
  return { abertas, html: sel.b, titulo: sel.t };
}

describe('grupos de proprietários: o meu nome leva «(eu)»', () => {
  test('no seletor de adicionar, o meu tem « (eu)» e o avatar as iniciais do nome', () => {
    doisDonos(true);
    const { html, titulo } = abrirSeletor();
    assert.equal(titulo, 'Adicionar ao grupo');
    assert.match(html, /<span class="avatar">M<\/span>[\s\S]*?<b[^>]*>Martinho \(eu\)<\/b>/);
    assert.match(html, /<span class="avatar">RC<\/span>[\s\S]*?<b[^>]*>Rui Costa<\/b>/);
    assert.ok(!html.includes('Rui Costa (eu)'));
  });

  test('sem sessão ninguém é «eu»', () => {
    doisDonos(false);
    const { html } = abrirSeletor();
    assert.ok(!html.includes('(eu)'));
  });

  test('com um só proprietário não há que distinguir', () => {
    doisDonos(true);
    app.db.owners = app.db.owners.slice(0, 1);
    const { html } = abrirSeletor();
    assert.match(html, /<b[^>]*>Martinho<\/b>/);
    assert.ok(!html.includes('(eu)'));
  });

  test('nos chips dos membros e no cartão do grupo', () => {
    doisDonos(true);
    app.db.groups = [app.normGroup({ id: 'GO', kind: 'owner', name: 'Família', ids: ['eu', 'rui'] })];
    assert.equal(app.gMemberName('owner', 'eu'), 'Martinho (eu)');
    assert.equal(app.gMemberName('owner', 'rui'), 'Rui Costa');
    assert.equal(app.gMemberName('owner', 'apagado'), '');
    const abertas = janelasFalsas(app, 'render', 'save');
    app.groupModal('owner', 'GO');
    assert.ok(abertas[0].b.includes('Martinho (eu)'), 'o chip');
    assert.ok(app.cartaoDoGrupo(app.db.groups[0]).includes('Martinho (eu) · Rui Costa'), 'o cartão');
  });
});
