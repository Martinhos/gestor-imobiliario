// Os serviços dos imóveis (properties) e dos créditos (credits): cada um
// carrega e rende só com a base (+ o que requer), o toque longo resolve pelo
// registo, e com os outros serviços desligados nesta conta a lista, a ficha e
// os menus rendem sem os atalhos para eles — e sem rebentar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { carregarApp, carregarServico, limpar, igual, elementos } from './arnes.js';
// as janelas numa pilha observável; o toque longo devolve os rótulos
import { janelasFalsas, menuDe } from './lib/dom.js';

/* um imóvel arrendado com hipoteca viva, o proprietário, o inquilino, o
   contrato em vigor e um pagamento de crédito sem hipoteca associada (um
   órfão, que o cartão dos créditos oferece para associar) */
function semear(app) {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana Silva' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Rui Costa' }));
  const l = app.normLoan({ id: 'l1', name: 'Aquisição', bank: 'Banco Azul', outstanding: 100000, years: 30, type: 'fixa', rate: 3 });
  app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa da Praia', address: 'Rua do Mar 1', ownerIds: ['o1'], value: 200000, use: 'investimento', rentalMode: 'inteiro', loans: [l] }));
  app.db.contracts.push(app.normContract({ id: 'c1', propertyId: 'p1', rent: 650, tenantIds: ['t1'], start: '2024-01-01' }));
  app.db.transactions.push(app.normTx({ id: 'x1', kind: 'loan', label: 'Prestação', propertyId: 'p1', amount: 421.6, date: '2025-01-05' }));
  return app.db;
}

/* as janelas não abrem (testes/lib/dom.js:janelasFalsas: cada openModal
   empilha uma camada falsa, onde vive o onSave), sem repintar nem gravar; e
   as fichas guardam, na mesma lista, o objeto que entregariam ao abrirFicha.
   Recebe: app — o proxy.
   Devolve: as camadas e as fichas abertas, pela ordem. */
function janelasEFichas(app) {
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
  app.abrirFicha = (o) => { abertas.push(o); };
  return abertas;
}

const ATALHOS_CONTRATOS = /go\('contracts'\)|openContract\(|ctModal\(/;
const ATALHOS_MOVIMENTOS = /go\('transactions'\)|openTx\(|txModal\(|newTx\(/;

describe('autonomia: os imóveis e os créditos rendem só com a base', () => {
  test('autonomia: properties carrega só a base e o serviço; a lista e a ficha rendem com a db vazia e com dados', () => {
    const app = carregarServico(['properties']);
    assert.ok(app.servicoLigado('properties'));
    for (const id of ['contracts', 'transactions', 'owners', 'recurring', 'credits']) assert.ok(!app.servicoLigado(id), id + ' fica desligado');
    assert.equal(typeof app.syncAllLoanRecs, 'undefined', 'os planeados nem sequer estão carregados');
    assert.equal(typeof app.txModal, 'undefined', 'nem os movimentos');
    assert.equal(typeof app.vistaDoSeparador('properties'), 'function', 'a vista está registada');
    assert.equal(app.depoisDoSeparador('properties'), app.propsDepois, 'as miniaturas vêm do registo');
    assert.equal(typeof app.lpDe('prop'), 'function', 'lpDe(prop) resolve');
    // db vazia
    limpar(app);
    const vazia = app.vProperties();
    assert.ok(vazia.length > 0);
    assert.match(vazia, /Sem imóveis/);
    // com dados
    semear(app);
    const lista = app.vProperties();
    assert.match(lista, /Casa da Praia/);
    assert.match(lista, /propView\('p1'\)/, 'tocar abre a ficha');
    assert.ok(!/Dívida/.test(lista), 'sem os Créditos a dívida não se mostra');
    assert.ok(!/Arrendado/.test(lista), 'sem os Contratos o estado não se mostra');
    const ficha = app.propFicha('p1');
    assert.ok(ficha.length > 0);
    assert.match(ficha, /Rua do Mar 1/);
    assert.match(ficha, /Ana Silva/);
    assert.ok(!/Hipotecas/.test(ficha) && !/Contratos ativos/.test(ficha));
    // e o render pinta a lista no #view
    const fixos = elementos(app);
    app.tab = 'properties';
    app.render();
    assert.match(fixos.view.innerHTML, /Casa da Praia/);
  });

  test('autonomia: o formulário do imóvel grava sem os Planeados carregados, e o menu do imóvel só traz o que é dos imóveis', () => {
    const app = carregarServico(['properties']);
    semear(app);
    const abertas = janelasEFichas(app);
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.propModal('p1');
    assert.equal(abertas.length, 1);
    assert.match(abertas[0].b, /Casa da Praia/);
    assert.ok(!/addLoan\(\)/.test(abertas[0].b) && !/Banco Azul/.test(abertas[0].b), 'sem os Créditos o formulário não tem a dobra das hipotecas');
    app.collectProp = () => {};
    app.onSave();
    assert.equal(msg, 'Imóvel atualizado.', 'gravou sem chamar os planeados');
    igual(menuDe(app, 'lpImovel', ['prop', 'p1']), ['Editar imóvel', 'Apagar imóvel']);
    // a ficha (janela) leva o corpo e o botão de editar
    app.propView('p1');
    const ficha = abertas[abertas.length - 1];
    assert.equal(ficha.titulo(), 'Casa da Praia');
    assert.match(ficha.corpo(), /Rua do Mar 1/);
    assert.match(ficha.editar.act, /propModal\('p1'\)/);
  });

  test('autonomia: credits traz properties por requer; a lista dos créditos e as fichas rendem com a db vazia e com dados', () => {
    const app = carregarServico(['credits']);
    assert.ok(app.servicoLigado('credits') && app.servicoLigado('properties'), 'os Imóveis vêm por requer');
    for (const id of ['contracts', 'transactions', 'owners', 'recurring']) assert.ok(!app.servicoLigado(id), id + ' fica desligado');
    assert.equal(typeof app.vistaDoSeparador('credits'), 'function');
    assert.equal(typeof app.lpDe('mort'), 'function', 'lpDe(mort) resolve');
    assert.equal(typeof app.lpDe('prop'), 'function');
    // db vazia
    limpar(app);
    const vazia = app.vCredits();
    assert.ok(vazia.length > 0);
    assert.match(vazia, /Sem hipotecas/);
    assert.match(vazia, /go\('properties'\)/, 'o caminho para o primeiro imóvel: os Imóveis estão sempre com os Créditos');
    // com dados
    semear(app);
    const lista = app.vCredits();
    assert.match(lista, /Aquisição/);
    assert.match(lista, /mortView\('p1','l1'\)/);
    assert.ok(!/sem crédito associado/.test(lista), 'sem os Movimentos não há cartão dos órfãos');
    assert.match(app.mortFicha('p1', 'l1'), /Em dívida/);
    const ficha = app.propFicha('p1');
    assert.match(ficha, /Hipotecas/, 'com os Créditos ligados a ficha do imóvel mostra as hipotecas');
    assert.match(app.vProperties(), /Dívida/);
    const fixos = elementos(app);
    app.tab = 'credits';
    app.render();
    assert.match(fixos.view.innerHTML, /Aquisição/);
  });

  test('autonomia: a hipoteca grava e apaga sem os Planeados carregados, e os menus não trazem os pagamentos sem os Movimentos', () => {
    const app = carregarServico(['credits']);
    semear(app);
    const abertas = janelasEFichas(app);
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.mortModal('p1', 'l1');
    assert.match(abertas[0].b, /Banco Azul/);
    app.collectProp = () => {};
    app.onSave();
    assert.equal(msg, 'Hipoteca guardada.');
    /* a tabela da amortização é dos Créditos: fica com os Movimentos desligados; pagar é que não */
    igual(menuDe(app, 'lpHipoteca', ['mort', 'p1', 'l1']), ['Editar hipoteca', 'Amortização', 'Apagar hipoteca']);
    igual(menuDe(app, 'lpImovel', ['prop', 'p1']), ['Editar imóvel', 'Amortização', 'Apagar imóvel']);
    igual(app.lpExtrasCreditosImovel(['prop', 'p1']).map((o) => o.label), ['Amortização']);
    app.mortView('p1', 'l1');
    const ficha = abertas[abertas.length - 1];
    assert.match(ficha.titulo(), /Aquisição/);
    assert.ok(!/pagarCreditoDaHipoteca\(|txModal\(/.test(ficha.menu()), 'a ficha da hipoteca não oferece pagar');
    assert.match(ficha.menu(), /amortModal\('p1','l1'\)/, 'mas a amortização fica');
    assert.match(ficha.menu(), /delMortFrom\('p1','l1'\)/);
    // apagar a hipoteca passa sem o syncAllLoanRecs
    app.confirmModal = (t, txt, cb) => cb();
    app.delMortFrom('p1', 'l1');
    assert.equal(msg, 'Hipoteca apagada.');
    assert.equal(app.prop('p1').loans.length, 0);
  });
});

describe('desligado: com os outros serviços desligados, a lista, a ficha e os menus rendem sem os atalhos', () => {
  test('desligado: contracts, transactions, owners e recurring — a lista e a ficha rendem sem atalhos; o controlo positivo mostra o estado, os contratos e a dívida', () => {
    const app = carregarApp();
    semear(app);
    // controlo positivo: tudo ligado
    const listaOn = app.vProperties(), fichaOn = app.propFicha('p1');
    assert.match(listaOn, /Arrendado/);
    assert.match(listaOn, /Rui Costa/);
    assert.match(listaOn, /Todos os estados/);
    assert.match(listaOn, /Dívida/);
    assert.match(fichaOn, /Contratos ativos/);
    assert.match(fichaOn, /Hipotecas/);
    assert.match(fichaOn, /Rui Costa/);
    // os outros desligados; a db continua a ter os contratos e os movimentos, e é a guarda que os esconde
    app.definirServicosDesligados(['contracts', 'transactions', 'owners', 'recurring']);
    const lista = app.vProperties(), ficha = app.propFicha('p1');
    assert.match(lista, /Casa da Praia/);
    assert.doesNotMatch(lista, ATALHOS_CONTRATOS);
    assert.doesNotMatch(lista, ATALHOS_MOVIMENTOS);
    assert.ok(!/Arrendado/.test(lista) && !/Rui Costa/.test(lista) && !/Todos os estados/.test(lista), 'sem os Contratos não há estado, renda nem contratos');
    assert.match(lista, /Dívida/, 'os Créditos ficaram ligados: a dívida continua');
    assert.match(ficha, /Rua do Mar 1/);
    assert.doesNotMatch(ficha, ATALHOS_CONTRATOS);
    assert.doesNotMatch(ficha, ATALHOS_MOVIMENTOS);
    assert.ok(!/Contratos ativos/.test(ficha) && !/Rui Costa/.test(ficha));
    assert.match(ficha, /Hipotecas/);
    const fixos = elementos(app);
    app.tab = 'properties';
    app.render();
    assert.match(fixos.view.innerHTML, /Casa da Praia/);
  });

  test('desligado: o menu de toque longo de um imóvel não traz «Novo contrato», «Registar despesa» nem os pagamentos de crédito; o controlo positivo traz os dos Créditos', () => {
    const app = carregarApp();
    semear(app);
    // controlo positivo: os Créditos acrescentam os seus, via lpExtras
    const ligado = menuDe(app, 'lpImovel', ['prop', 'p1']);
    assert.ok(ligado.includes('Editar imóvel') && ligado.includes('Apagar imóvel'), ligado.join(', '));
    assert.ok(ligado.includes('Pagamento de crédito') && ligado.includes('Amortização'), ligado.join(', '));
    assert.equal(ligado.indexOf('Apagar imóvel'), ligado.length - 1, 'apagar fica no fim');
    igual(app.lpExtrasCreditosImovel(['prop', 'p1']).map((o) => o.label), ['Pagamento de crédito', 'Amortização']);
    igual(app.lpExtrasCreditosImovel(['prop', 'nada']), []);
    // os outros desligados
    app.definirServicosDesligados(['contracts', 'transactions', 'owners', 'recurring']);
    const fora = menuDe(app, 'lpImovel', ['prop', 'p1']);
    for (const r of ['Novo contrato', 'Registar despesa', 'Nova despesa', 'Pagamento de crédito']) assert.ok(!fora.includes(r), r + ' não devia estar: ' + fora.join(', '));
    igual(fora, ['Editar imóvel', 'Amortização', 'Apagar imóvel']);
    igual(app.lpExtrasCreditosImovel(['prop', 'p1']).map((o) => o.label), ['Amortização'], 'sem os Movimentos os Créditos só acrescentam a amortização, que é deles');
    // pelo lpMenu da base o caminho é o mesmo
    igual(menuDe(app, 'lpMenu', 'prop:p1'), ['Editar imóvel', 'Amortização', 'Apagar imóvel']);
    // e a folha de opções toca no serviço pelo chamarServico: com ele desligado avisa e não abre
    app.definirServicosDesligados([]);
    let opts = null, msg = '';
    app.lpShow = (t, o) => { opts = o; };
    app.toast = (m) => { msg = m; };
    app.lpImovel(['prop', 'p1']);
    const pagar = opts.find((o) => o.label === 'Pagamento de crédito');
    app.definirServicosDesligados(['transactions']);
    app.txModal = () => { throw new Error('não devia abrir'); };
    pagar.act();
    assert.equal(msg, 'O serviço Movimentos está desligado nesta conta.');
  });

  test('desligado: com credits desligado a ficha e a lista não mostram o cartão do crédito, o formulário não tem hipotecas e o menu não traz os pagamentos', () => {
    const app = carregarApp();
    semear(app);
    const abertas = janelasEFichas(app);
    // controlo positivo
    assert.match(app.propFicha('p1'), /Hipotecas/);
    assert.match(app.vProperties(), /Dívida/);
    app.propModal('p1');
    assert.match(abertas[0].b, /addLoan\(\)/, 'o formulário tem a dobra das hipotecas');
    assert.match(abertas[0].b, /Banco Azul/);
    assert.ok(menuDe(app, 'lpImovel', ['prop', 'p1']).includes('Pagamento de crédito'));
    // os Créditos desligados
    app.definirServicosDesligados(['credits']);
    assert.ok(app.servicoLigado('properties'), 'os Imóveis ficam');
    const ficha = app.propFicha('p1');
    assert.ok(!/Hipotecas/.test(ficha) && !/Aquisição/.test(ficha), 'a ficha não mostra o cartão do crédito');
    assert.match(ficha, /Contratos ativos/, 'os Contratos continuam');
    const lista = app.vProperties();
    assert.ok(!/Dívida/.test(lista) && !/Aquisição/.test(lista));
    assert.match(lista, /Arrendado/);
    app.propModal('p1');
    assert.ok(!/addLoan\(\)/.test(abertas[1].b) && !/Banco Azul/.test(abertas[1].b), 'o formulário não tem a dobra das hipotecas');
    assert.match(abertas[1].b, /Casa da Praia/);
    const menu = menuDe(app, 'lpImovel', ['prop', 'p1']);
    assert.ok(!menu.includes('Pagamento de crédito') && !menu.includes('Amortização'), menu.join(', '));
    assert.equal(app.lpDe('mort'), null, 'o toque longo de uma hipoteca não abre nada');
    assert.equal(app.vistaDoSeparador('credits'), null);
  });

  test('desligado: com transactions desligado os créditos não oferecem pagar nem associar órfãos, e a tabela da amortização fica', () => {
    const app = carregarApp();
    semear(app);
    const abertas = janelasEFichas(app);
    let msg = '';
    app.toast = (m) => { msg = m; };
    // controlo positivo: o órfão aparece e a ficha da hipoteca oferece pagar
    const on = app.vCredits();
    assert.match(on, /1 pagamento sem crédito associado/);
    assert.match(on, /associarOrfaos\('p1','l1'\)/);
    app.mortView('p1', 'l1');
    // o «Pagamento de crédito» chama a função com nome, com o imóvel e a hipoteca
    assert.match(abertas[0].menu(), /pagarCreditoDaHipoteca\('p1','l1'\)/);
    assert.match(abertas[0].menu(), /amortModal\(/);
    assert.ok(menuDe(app, 'lpHipoteca', ['mort', 'p1', 'l1']).includes('Pagamento de crédito'));
    // os Movimentos desligados; o órfão continua na db, e é a guarda que o esconde
    app.definirServicosDesligados(['transactions']);
    assert.ok(app.servicoLigado('credits'));
    const off = app.vCredits();
    assert.match(off, /Aquisição/);
    assert.ok(!/sem crédito associado/.test(off) && !/associarOrfaos\(/.test(off), 'sem o cartão dos órfãos');
    assert.doesNotMatch(off, ATALHOS_MOVIMENTOS);
    app.mortView('p1', 'l1');
    const menu = abertas[1].menu();
    assert.doesNotMatch(menu, ATALHOS_MOVIMENTOS);
    assert.match(menu, /amortModal\(/, 'a tabela da amortização é dos Créditos e fica');
    assert.match(menu, /delMortFrom\(/, 'apagar é dos Créditos e fica');
    igual(menuDe(app, 'lpHipoteca', ['mort', 'p1', 'l1']), ['Editar hipoteca', 'Amortização', 'Apagar hipoteca']);
    // associar à mão avisa, sem culpa, e não mexe em nada
    const antes = app.prop('p1').loans[0].outstanding;
    app.associarOrfaos('p1', 'l1');
    assert.equal(msg, 'O serviço Movimentos está desligado nesta conta.');
    assert.equal(app.prop('p1').loans[0].outstanding, antes);
    assert.equal(app.db.transactions[0].loanId, null);
  });

  test('desligado: com owners desligado a ficha do imóvel não oferece criar um proprietário, e o atalho avisa sem abrir', () => {
    const app = carregarApp();
    semear(app);
    janelasEFichas(app);
    let extra = null, msg = '', abriu = false;
    app.pickModal = (t, o, cb, ex) => { extra = ex; };
    app.toast = (m) => { msg = m; };
    app.personModal = () => { abriu = true; };
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('p1'))));
    // controlo positivo
    app.addPropOwner();
    assert.match(extra, /newOwnerFromProp\(\)/);
    assert.match(extra, /Criar proprietário novo/);
    app.newOwnerFromProp();
    assert.ok(abriu, 'com os Proprietários ligados a ficha de pessoa abre');
    // os Proprietários desligados
    abriu = false;
    app.definirServicosDesligados(['owners']);
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('p1'))));
    app.addPropOwner();
    assert.equal(extra, '', 'sem o botão de criar');
    app.newOwnerFromProp();
    assert.ok(!abriu);
    assert.equal(msg, 'O serviço Proprietários está desligado nesta conta.');
    // a lista e a ficha rendem na mesma, com os nomes dos donos (são dados do imóvel)
    assert.match(app.vProperties(), /Ana Silva/);
    assert.match(app.propFicha('p1'), /Ana Silva/);
  });

  test('desligado: com recurring desligado gravar o imóvel e a hipoteca, apagar a hipoteca e a caixa da mista passam sem tocar nos planeados', () => {
    const app = carregarApp();
    semear(app);
    janelasEFichas(app);
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.collectProp = () => {};
    let tocou = 0, historia = 0;
    for (const f of ['syncAllLoanRecs', 'syncLoanRec', 'loanRecOf']) app[f] = () => { tocou++; };
    /* a pergunta pelas prestações desde o início é dos Créditos (creditos.js) e corre sem os Planeados */
    app.loanStartsAntes = () => { historia++; return {}; };
    app.perguntarPrestacoesEmFalta = () => { historia++; };
    // controlo positivo: com os Planeados ligados, gravar passa por eles
    app.propModal('p1');
    app.onSave();
    assert.ok(tocou > 0, 'com os Planeados ligados gravar sincroniza');
    tocou = 0;
    app.definirServicosDesligados(['recurring']);
    app.propModal('p1');
    app.onSave();
    assert.equal(msg, 'Imóvel atualizado.');
    app.mortModal('p1', 'l1');
    app.onSave();
    assert.equal(msg, 'Hipoteca guardada.');
    assert.ok(historia > 0, 'a pergunta pelas prestações desde o início correu sem os Planeados');
    const mista = app.normLoan({ id: 'lm', outstanding: 100000, years: 30, type: 'mista', rate: 2, fixedYears: 5, euribor: 3, spread: 1, start: '2024-01-01', stampTax: false });
    assert.match(app.loanBox(mista), /Prestação a partir de/);
    app.confirmModal = (t, txt, cb) => cb();
    app.delMortFrom('p1', 'l1');
    assert.equal(msg, 'Hipoteca apagada.');
    assert.equal(tocou, 0, 'nada dos Planeados foi chamado');
  });
});
