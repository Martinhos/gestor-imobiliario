// O cartão «O que podes fazer» fecha-se (ticket QA 20d33967): um X no canto
// (painel-geral.js:cartaoPodes), o fecho guardado por conta com a assinatura
// do cargo (podesChave, podesAssinatura, podesFechado, podesFechar), o cartão
// a voltar quando o cargo muda, e o vazio no lugar dele na vista de quem não
// tem finanças (vazioSemContasColab). A sessão simula-se com window.CW, como
// em colaborador-acoes.test.js.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => app.definirServicosDesligados([]));
afterEach(() => repor(app));
afterEach(() => app.localStorage.clear());

const GESTOR = ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'];
const CONTAB = ['tx.view', 'tx.add', 'rec.view', 'rec.add', 'contract.view', 'loan.view', 'file.view', 'file.add', 'report.view'];

// três imóveis do Rui, todos com o mesmo cargo meu; eu sou a conta `eu`
function colaboro(a, perms, eu = 'eu') {
  limpar(a);
  a.db.properties = ['P1', 'P2', 'P3'].map((id, i) =>
    Object.assign(a.normProp({ id, name: 'T' + (i + 1) + ' Rui', ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui', _cargo: 'Gestor' }));
  a.db.owners = [a.normPerson({ id: eu, name: 'Eu' }), Object.assign(a.normPerson({ id: 'rui', name: 'Rui' }), { _userId: 'rui' })];
  const cs = {};
  ['P1', 'P2', 'P3'].forEach((id) => { cs[id] = { dono: false, nome: 'Gestor', perms }; });
  a.window.CW = Object.assign(a.window.CW || {}, { user: { id: eu }, cargos: cs, pessoas: {} });
}
// fecha o cartão como o X: sem o render de verdade, que não interessa aqui
function fechar(a) {
  a.render = () => {};
  a.podesFechar();
}
// o HTML do cartão, do id ao fim
function cartao(html) {
  const i = html.indexOf('id="colabPodes"');
  return i < 0 ? '' : html.slice(i, html.indexOf('<!--fim-podes-->', i));
}

describe('o X do «O que podes fazer»', () => {
  test('o cartão tem o X no canto: botão, «Fechar», o ícone x e a ação da casa', () => {
    colaboro(app, GESTOR);
    const c = cartao(app.vDashboard());
    assert.ok(c, 'o cartão está lá');
    assert.match(c, /<button type="button" class="btn sm ghost so-icone colab-podes-fechar" aria-label="Fechar"[^>]* data-toca="vista" data-click="podesFechar\(\)">/);
    assert.ok(c.includes(app.ic('x', 18)), 'o ícone x da casa, a 18');
    assert.match(app.vDashboard(), /class="card u-mb-14px colab-podes" id="colabPodes"/, 'o cartão leva a classe que o posiciona');
    assert.doesNotMatch(c, /\sstyle=|\son[a-z]+=/, 'nada de style= nem on…= (CSP)');
  });

  test('fechar esconde o cartão e guarda o fecho por conta, com a assinatura do cargo', () => {
    colaboro(app, CONTAB);
    assert.match(app.vDashboard(), /O que podes fazer/);
    fechar(app);
    const html = app.vDashboard();
    assert.doesNotMatch(html, /O que podes fazer|colabPodes/);
    assert.match(html, /Receita/, 'com finanças, a vista continua a das contas');
    assert.equal(app.localStorage.getItem('gi_podes_fora:eu'), app.podesAssinatura());
    assert.match(app.podesAssinatura(), /#fin$/);
  });

  test('o cartão volta quando o cargo muda: outras ações, ou as finanças a aparecer', () => {
    colaboro(app, GESTOR);
    fechar(app);
    assert.doesNotMatch(app.vDashboard(), /O que podes fazer/);
    colaboro(app, ['visit.view', 'visit.add']);
    assert.match(app.vDashboard(), /O que podes fazer/, 'perdeu o «Adicionar inquilino»: o cartão volta');
    fechar(app);
    assert.doesNotMatch(app.vDashboard(), /O que podes fazer/);
    colaboro(app, ['visit.view', 'visit.add', 'tx.view']);
    assert.match(app.vDashboard(), /O que podes fazer/, 'as mesmas ações, mas agora com finanças: volta');
  });

  test('o fecho é da conta: outra conta no mesmo aparelho continua a ver o cartão', () => {
    colaboro(app, GESTOR);
    fechar(app);
    colaboro(app, GESTOR, 'outra');
    assert.match(app.vDashboard(), /O que podes fazer/);
  });

  test('sem finanças, o cartão fechado deixa o vazio, com «Ver os imóveis» e as próximas visitas por baixo', () => {
    colaboro(app, GESTOR);
    const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    app.db.visits = [app.normVisit({ id: 'V1', nomes: 'Pessoa 1', propertyId: 'P1', date: d(2) })];
    fechar(app);
    const html = app.vDashboard();
    assert.doesNotMatch(html, /O que podes fazer/);
    assert.match(html, /<div class="empty u-mb-14px"><b>As finanças ficam com o dono<\/b>O teu cargo não abre as finanças destes imóveis/);
    assert.match(html, /data-toca="ecra" data-click="go\('properties'\)">.* Ver os imóveis/);
    assert.ok(html.indexOf('As finanças ficam com o dono') < html.indexOf('Próximas visitas'), 'as visitas por baixo, como antes');
    app.definirServicosDesligados(['properties']);
    assert.doesNotMatch(app.vDashboard(), /Ver os imóveis/, 'sem o serviço dos Imóveis, sem a porta');
    app.definirServicosDesligados([]);
    assert.doesNotMatch(cartao(html), /./, 'e o cartão não está');
  });

  test('com o localStorage a lançar, o cartão aparece e o X não rebenta', () => {
    colaboro(app, GESTOR);
    const rebenta = () => { throw new Error('armazenamento bloqueado'); };
    app.localStorage = { getItem: rebenta, setItem: rebenta, removeItem: rebenta, clear() {} };
    assert.match(app.vDashboard(), /O que podes fazer/);
    assert.doesNotThrow(() => fechar(app));
    assert.match(app.vDashboard(), /O que podes fazer/, 'não se finge que fechou');
    assert.equal(app.podesFechado(), false);
  });

  test('um fecho guardado com outra assinatura não esconde o cartão', () => {
    colaboro(app, GESTOR);
    app.localStorage.setItem('gi_podes_fora:eu', 'visitModal()#fin');
    assert.match(app.vDashboard(), /O que podes fazer/);
    assert.equal(app.podesFechado(), false);
  });
});

describe('o X e os primeiros passos do guia', () => {
  test('com o cartão à mostra a marca continua no fim dele e os passos vêm a seguir; fechado, os passos ficam', () => {
    const tudo = carregarTudo();
    colaboro(tudo, GESTOR);
    tudo.CW.user = { id: 'eu', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
    let html = tudo.vDashboard();
    assert.ok(html.includes('<!--fim-podes--></div>'), 'a marca do fim do cartão');
    assert.ok(html.indexOf('colab-podes-fechar') < html.indexOf('<!--fim-podes-->'), 'o X é do cartão');
    assert.ok(html.indexOf('Primeiros passos') > html.indexOf('<!--fim-podes-->'), 'os passos a seguir ao cartão');
    tudo.render = () => {};
    tudo.podesFechar();
    html = tudo.vDashboard();
    assert.doesNotMatch(html, /O que podes fazer/);
    assert.match(html, /Primeiros passos/, 'os passos não se perdem com o cartão fechado');
    assert.ok(html.indexOf('Primeiros passos') < html.indexOf('As finanças ficam com o dono'), 'sem a marca, os passos vão para o topo');
  });
});
