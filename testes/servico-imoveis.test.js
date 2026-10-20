// Os serviços dos imóveis (properties) e dos créditos (credits): cada um
// carrega e rende só com a base (+ o que requer), o toque longo resolve pelo
// registo, e com os outros serviços desligados nesta conta a lista, a ficha e
// os menus rendem sem os atalhos para eles — e sem rebentar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { carregarApp, carregarServico, carregarTudo, limpar, igual, elementos } from './arnes.js';
// as janelas numa pilha observável; o toque longo devolve os rótulos
import { janelasFalsas, menuDe } from './lib/dom.js';

// o rótulo do chip dos movimentos de um imóvel: «Movimentos · N», ou só «Movimentos» sem nenhum
const m = (app, id) => { const n = app.db.transactions.filter((t) => t.propertyId === id).length; return 'Movimentos' + (n ? ' · ' + n : ''); };

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
    assert.ok(!/Hipoteca · /.test(ficha) && !/<h3>Contrato/.test(ficha) && !/ctView\(/.test(ficha), 'sem os Créditos nem os Contratos, nem o cartão da hipoteca nem o do contrato');
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
    assert.match(ficha, /Hipoteca · Aquisição/, 'com os Créditos ligados a ficha do imóvel mostra as hipotecas');
    assert.match(ficha, /amortModal\('p1','l1'\)/, 'com o plano de amortização');
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
    assert.match(listaOn, /<span>Renda<\/span><b>650/, 'a renda no cartão');
    assert.match(listaOn, /<span class="mov-chip"><div class="sel" id="sel_lfc_lprops_st">/, 'o chip rápido do estado');
    assert.match(listaOn, /<span>Vagos · 0<\/span>/, 'cada estado com quantos há');
    assert.match(listaOn, /Todos os estados/);
    assert.match(listaOn, /Dívida/);
    assert.match(fichaOn, /<h3>Contrato<\/h3>/);
    assert.match(fichaOn, /ctView\('c1'\)/, 'a linha do contrato abre a ficha dele');
    assert.match(fichaOn, /Hipoteca · Aquisição/);
    assert.match(fichaOn, /Rui Costa/);
    // os outros desligados; a db continua a ter os contratos e os movimentos, e é a guarda que os esconde
    app.definirServicosDesligados(['contracts', 'transactions', 'owners', 'recurring']);
    const lista = app.vProperties(), ficha = app.propFicha('p1');
    assert.match(lista, /Casa da Praia/);
    assert.doesNotMatch(lista, ATALHOS_CONTRATOS);
    assert.doesNotMatch(lista, ATALHOS_MOVIMENTOS);
    assert.ok(!/Arrendado/.test(lista) && !/Renda/.test(lista) && !/Todos os estados/.test(lista) && !/lfc_lprops_st/.test(lista), 'sem os Contratos não há estado, renda (nem a ordenação por ela), contratos nem chip do estado');
    assert.match(lista, /Dívida/, 'os Créditos ficaram ligados: a dívida continua');
    assert.match(ficha, /Rua do Mar 1/);
    assert.doesNotMatch(ficha, ATALHOS_CONTRATOS);
    assert.doesNotMatch(ficha, ATALHOS_MOVIMENTOS);
    assert.ok(!/<h3>Contrato/.test(ficha) && !/ctView\(/.test(ficha) && !/Rui Costa/.test(ficha) && !/Renda em vigor/.test(ficha));
    assert.doesNotMatch(ficha, /Registar despesa|verMovimentosDoImovel|Novo contrato/, 'nem as ações rápidas dos serviços desligados');
    assert.match(ficha, /Hipoteca · Aquisição/);
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
    assert.match(app.propFicha('p1'), /Hipoteca · Aquisição/);
    assert.match(app.vProperties(), /Dívida/);
    app.propModal('p1');
    assert.match(abertas[0].b, /addLoan\(\)/, 'o formulário tem a dobra das hipotecas');
    assert.match(abertas[0].b, /Banco Azul/);
    assert.ok(menuDe(app, 'lpImovel', ['prop', 'p1']).includes('Pagamento de crédito'));
    // os Créditos desligados
    app.definirServicosDesligados(['credits']);
    assert.ok(app.servicoLigado('properties'), 'os Imóveis ficam');
    const ficha = app.propFicha('p1');
    assert.ok(!/Hipoteca · /.test(ficha) && !/Aquisição/.test(ficha) && !/Em dívida/.test(ficha), 'a ficha não mostra o cartão do crédito nem a dívida');
    assert.doesNotMatch(ficha, /Pagamento de crédito/, 'nem a ação rápida do pagamento');
    assert.match(ficha, /Rui Costa/, 'os Contratos continuam');
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
    // a lista e a ficha rendem na mesma; os nomes dos donos (são dados do
    // imóvel) estão na ficha — o cartão da lista diz só a morada, como o canvas
    assert.match(app.vProperties(), /Casa da Praia/);
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

describe('a lista, a ficha e o formulário na linguagem nova', () => {
  test('o chip rápido do estado filtra ao escolher, diz quantos há em cada estado, e o × limpa-o', () => {
    const app = carregarApp();
    semear(app);
    app.db.properties.push(app.normProp({ id: 'p2', name: 'Casa do Campo', use: 'proprio', ownerIds: ['o1'], value: 90000 }));
    const chip = (h) => h.slice(h.indexOf('id="sel_lfc_lprops_st"'), h.indexOf('</span>', h.indexOf('id="pop_lfc_lprops_st"')));
    let html = app.vProperties();
    assert.match(chip(html), /aria-label="Estado"[^>]*><span id="lab_lfc_lprops_st">Estado<\/span>/, 'desligado diz o nome');
    assert.match(html, /<span>Todos os estados · 2<\/span>[\s\S]*<span>Arrendados · 1<\/span>[\s\S]*<span>Uso próprio · 1<\/span>/, 'o «Todos» conta os que passam os outros filtros');
    app.render = () => {};
    app.imvFiltroRapido('proprio');
    html = app.vProperties();
    assert.match(html, /Casa do Campo/);
    assert.doesNotMatch(html, /Casa da Praia/, 'o arrendado saiu');
    assert.match(html, /<span class="mov-chip on"><div class="sel" id="sel_lfc_lprops_st">[\s\S]*?aria-label="Estado: Uso próprio"[\s\S]*?<span id="lab_lfc_lprops_st">Uso próprio<\/span>/);
    assert.match(html, /data-click="lfLimparCampo\('lprops','st'\)"/, 'ligado, leva o ×');
    assert.equal(app.lf('lprops').st, 'proprio', 'é o mesmo filtro do seletor do painel');
    app.lfLimparCampo('lprops', 'st');
    assert.equal(app.lf('lprops').st, '');
    assert.match(app.vProperties(), /Casa da Praia/);
  });

  test('o cartão: a capa (a primeira foto, ou o mosaico estável), o estado com a cor do contrato e os três números', () => {
    const app = carregarApp();
    semear(app);
    app.db.properties.push(app.normProp({ id: 'p2', name: 'Casa do Campo', use: 'proprio', ownerIds: ['o1'], value: 90000, purchase: 70000 }));
    const cartao = (html, id) => { const i = html.indexOf('data-lp="prop:' + id + '"'), j = html.indexOf('data-lp="prop:', i + 1); return html.slice(i, j < 0 ? undefined : j); };
    let html = app.vProperties();
    const praia = cartao(html, 'p1'), campo = cartao(html, 'p2');
    assert.match(praia, /<div class="imv-capa imv-mosaico imv-t[0-3]">/, 'sem fotos, o mosaico');
    assert.equal(app.imvMosaico(app.prop('p1')), app.imvMosaico(app.normProp({ id: 'p1' })), 'a mesma cor para o mesmo imóvel');
    assert.match(praia, /<span class="badge in">Arrendado<\/span>/);
    assert.deepEqual([...praia.matchAll(/<div class="imv-kv"><span>([^<]*)<\/span>/g)].map((m) => m[1]), ['Renda', 'Yield', 'Dívida']);
    assert.match(campo, /<span class="badge grey">Uso próprio<\/span>/);
    assert.deepEqual([...campo.matchAll(/<div class="imv-kv"><span>([^<]*)<\/span>/g)].map((m) => m[1]), ['Valor', 'Aquisição', 'Dívida']);
    assert.doesNotMatch(praia, /class="iconbtn opcoes"/, 'o cartão já não tem o ⋮: tocar abre a ficha');
    app.prop('p1').photos = [app.normFile({ id: 'f1', name: 'Sala', type: 'image/jpeg', size: 10 }), app.normFile({ id: 'f2', name: 'Quarto', type: 'image/jpeg', size: 10 })];
    html = app.vProperties();
    assert.match(cartao(html, 'p1'), /class="imv-capa imv-mosaico imv-t[0-3] pcover" id="th_f1"><span class="imv-nfotos">2 fotos<\/span>/, 'a primeira foto é a capa');
    assert.equal(app.imvCorDoEstado('parcial'), '', 'parcial é o cobalto (o .badge sem cor)');
    assert.equal(app.imvCorDoEstado('vago'), 'amber');
  });

  test('a ficha do dono: o topo, as ações rápidas que os serviços deixam, o cartão dos números e os por confirmar do imóvel', () => {
    const app = carregarApp();
    semear(app);
    app.db.recurring = [app.normRec({ id: 'r1', name: 'Renda Rui Costa', every: 'month', next: '2020-01-01', tx: { kind: 'income', propertyId: 'p1', contractId: 'c1', amount: 650 } }),
      app.normRec({ id: 'r2', name: 'Renda de outro imóvel', every: 'month', next: '2020-01-01', tx: { kind: 'income', propertyId: 'outro', amount: 1 } })];
    const f = app.propFicha('p1');
    assert.match(f, /^<div class="imv-ficha">/);
    assert.match(f, /<p class="imv-fmorada">Rua do Mar 1<\/p>/);
    assert.deepEqual([...f.matchAll(/<button type="button" class="chip[^"]*"[^>]*>(?:<svg[\s\S]*?<\/svg>)? ([^<]*)<\/button>/g)].map((m) => m[1]),
      [m(app, 'p1'), 'Novo contrato', 'Registar despesa', 'Pagamento de crédito']);
    // os movimentos do imóvel vão à frente, acesos e com quantos são
    assert.match(f, /<button type="button" class="chip on destaque" aria-label="Ver os movimentos deste imóvel[^"]*"/);
    assert.match(f, /data-click="pagamentoNoImovel\('p1'\)"/);
    assert.match(f, /data-toca="ecra" data-click="closeAllModals\(\);verMovimentosDoImovel\('p1'\)"/, 'mudar de ecrã fecha a ficha');
    assert.match(f, /Renda em vigor[\s\S]*Yield[\s\S]*Valor de mercado[\s\S]*Em dívida · 1 hipoteca/);
    assert.match(f, /<h3>Por confirmar<\/h3>[\s\S]*Renda Rui Costa[\s\S]*Em atraso[\s\S]*quickConfirmRec\('r1'\)/);
    assert.doesNotMatch(f, /Renda de outro imóvel/, 'só os do imóvel');
    assert.ok(f.indexOf('Por confirmar') < f.indexOf('<h3>Contrato</h3>') && f.indexOf('<h3>Contrato</h3>') < f.indexOf('Hipoteca · Aquisição'), 'pela ordem do canvas');
    // sem os Movimentos nem os Planeados: as ações deles e os por confirmar saem
    app.definirServicosDesligados(['transactions', 'recurring']);
    const g = app.propFicha('p1');
    assert.doesNotMatch(g, /Registar despesa|Pagamento de crédito|verMovimentosDoImovel|Por confirmar/);
    assert.match(g, /Novo contrato/);
  });

  test('as despesas fixas: uma linha por despesa com quando e quanto, e a frase do IMI que o formulário escreve', () => {
    const app = carregarApp();
    semear(app);
    Object.assign(app.prop('p1'), { imi: 600, condominio: 45, seguro: 216, seguroMes: 3 });
    const f = app.propFicha('p1');
    assert.match(f, /<h3>Despesas fixas<\/h3>/);
    assert.match(f, /<span class="imv-fixa-n">IMI<\/span><span class="small">mai · ago · nov<\/span><b>600,00\s€\/ano<\/b>/);
    assert.match(f, /<span class="imv-fixa-n">Seguro<\/span><span class="small">fim de mar<\/span>/);
    assert.match(app.imvFraseImi(80), /^IMI 80,00\s€\/ano numa só prestação, no fim de maio, para confirmares na data\.$/);
    assert.match(app.imvFraseImi('400'), /^IMI 400,00\s€\/ano em 2 prestações de 200,00\s€, no fim de maio e de novembro, para confirmares na data\.$/);
    assert.match(app.imvFraseImi(600), /em 3 prestações de 200,00\s€, no fim de maio, de agosto e de novembro/);
    assert.equal(app.imvFraseImi(''), '');
  });

  test('o formulário em grupos, com os segmentados, e a secção dos proprietários pelo ponto de extensão', () => {
    const app = carregarApp();
    semear(app);
    const abertas = janelasEFichas(app);
    app.propModal('p1');
    const html = abertas[0].b;
    assert.ok((html.match(/<div class="sect imv-grupo">/g) || []).length >= 4, 'os grupos são cartões .sect');
    assert.match(html, /<div class="segm" role="radiogroup" aria-labelledby="imv_seg_setUse"><button type="button" role="radio" aria-checked="true" class="on"[^>]*setUse\('investimento'\)">Arrendamento<\/button>/);
    assert.match(html, /role="radio" aria-checked="false" class=""[^>]*setMode\('quartos'\)">Por quartos<\/button>/);
    assert.match(html, /id="p_share_o1"/, 'sem a nuvem, a secção daqui');
    app.donosDoFormulario = () => '<div class="sect imv-grupo cw-teste">da nuvem</div>';
    app.propModal('p1');
    assert.match(abertas[1].b, /cw-teste">da nuvem/);
    assert.doesNotMatch(abertas[1].b, /p_share_/, 'a secção da nuvem toma o lugar da daqui');
    app.donosDoFormulario = () => '';
    app.propModal('p1');
    assert.match(abertas[2].b, /id="p_share_o1"/, 'vazia, fica a daqui');
    app.donosDoFormulario = null;
  });

  test('com a nuvem e uma sessão, o formulário leva a secção das quotas por proposta (cloud/utilizadores.js); sem sessão, a daqui', () => {
    const app = carregarTudo();
    limpar(app);
    app.db.owners = [app.normPerson({ id: 'eu', name: 'Rui Dono' }), app.normPerson({ id: 'ana', name: 'Ana Sócia' })];
    app.db.properties = [app.normProp({ id: 'p1', name: 'T2 Porto', ownerIds: ['eu', 'ana'] })];
    app.CW.state = { proposals: [] };
    app.CW.user = { id: 'eu', name: 'Rui Dono', token: 't' };
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('p1'))));
    let html = app.propBody();
    assert.match(html, /<div class="sect imv-grupo cw-donos"><div class="imv-sec-cab"><h3>Proprietários e quota-parte<\/h3>/);
    assert.match(html, /CW\.proposeShares\('p1'\)/, 'as quotas mudam por proposta');
    assert.doesNotMatch(html, /p_share_/, 'e não à mão');
    app.CW.user = null;
    html = app.propBody();
    assert.match(html, /id="p_share_eu"/, 'sem sessão, os proprietários são fichas locais');
  });
});

describe('a ficha, a lista e o formulário: o que a revisão apanhou', () => {
  test('a capa da ficha pinta-se na camada da ficha, mesmo quando o render a repinta com outra janela por cima', () => {
    const app = carregarApp();
    semear(app);
    app.prop('p1').photos = [app.normFile({ id: 'f1', name: 'Sala', type: 'image/jpeg', size: 10 })];
    janelasFalsas(app, 'render', 'buildNav', 'save');
    const pinturas = [];
    app.paintThumbs = (lista, raiz) => { pinturas.push({ ids: Array.from(lista || [], (f) => f.id), raiz }); };
    app.propView('p1');
    const ficha = app.modalStack[app.modalStack.length - 1];
    assert.ok(ficha && ficha.ficha, 'a camada da ficha');
    // a lista das tarefas (ou a galeria, ou o plano) por cima, e um render
    app.openModal('Tarefas · Casa da Praia', '<div class="form"></div>');
    pinturas.length = 0;
    app.refrescarFichas();
    assert.equal(pinturas.length, 1, 'a ficha repintou-se e pediu a capa');
    assert.deepEqual(pinturas[0].ids, ['f1']);
    assert.equal(pinturas[0].raiz, ficha.el, 'a capa procura-se na ficha, e não na janela de cima (ficava o mosaico com «1 foto»)');
  });

  test('«Novo contrato» na linha de um quarto livre abre o contrato já nesse quarto; se o formulário não abrir, nada mexe', () => {
    const app = carregarApp();
    semear(app);
    Object.assign(app.prop('p1'), { rentalMode: 'quartos', rooms: [{ id: 'q1', name: 'Quarto 1' }, { id: 'q2', name: 'Quarto 2' }] });
    app.db.contracts[0].roomId = 'q1';
    const f = app.propFicha('p1');
    assert.match(f, /<button type="button" class="btn sm" data-toca="camada" data-click="contratoNoQuarto\('p1','q2'\)">Novo contrato<\/button>/);
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    const avisos = [];
    app.toast = (m) => { avisos.push(m); };
    app.contratoNoQuarto('p1', 'q2');
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].t, 'Novo contrato');
    assert.equal(app.cForm.propertyId, 'p1');
    assert.equal(app.cForm.roomId, 'q2', 'o formulário começa no quarto da linha, e não no «Imóvel inteiro»');
    assert.equal(app.document.getElementById('c_room').value, 'q2', 'e o campo escondido que o guardar lê (contrato.js:collectCt) também');
    // o ctModal sai cedo com um aviso (já não há imóveis de arrendamento): a
    // janela de cima continua a mesma e o formulário de antes não muda
    app.closeAllModals();
    app.cForm = { marca: 'antes' };
    app.prop('p1').use = 'proprio';
    app.contratoNoQuarto('p1', 'q2');
    assert.equal(abertas.length, 1, 'nada abriu');
    assert.equal(avisos.length, 1, 'o ctModal disse porquê');
    assert.equal(app.cForm.marca, 'antes');
    assert.equal(app.cForm.roomId, undefined);
  });

  test('os por confirmar: o «Confirmar» é irmão do alvo de «rever», e não um botão dentro de outro', () => {
    const app = carregarApp();
    semear(app);
    app.db.recurring = [app.normRec({ id: 'r1', name: 'Renda Rui Costa', every: 'month', next: '2020-01-01', tx: { kind: 'income', propertyId: 'p1', contractId: 'c1', amount: 650 } })];
    const f = app.propFicha('p1');
    assert.match(f, /<div class="imv-linha imv-pend">\s*<div class="imv-linha-txt tap" data-toca="camada" data-click="confirmRec\('r1'\)">(?:(?!<\/div>)[\s\S])*<\/div>\s*<button type="button" class="btn sm primary" data-toca="dados" data-click="quickConfirmRec\('r1'\)">Confirmar<\/button><\/div>/);
    assert.doesNotMatch(f, /stopPropagation/, 'sem o data-click na linha, o botão já não precisa de travar o toque');
  });

  test('o cartão da lista diz só a morada, como o canvas; os donos ficam na ficha e na pesquisa', () => {
    const app = carregarApp();
    semear(app);
    const html = app.vProperties(), cartao = html.slice(html.indexOf('data-lp="prop:p1"'));
    assert.match(cartao, /<div class="small imv-morada">Rua do Mar 1<\/div>/);
    assert.doesNotMatch(cartao, /Ana Silva/, 'o nome do dono não se repete em todos os cartões');
    app.lf('lprops').q = 'Ana Silva';
    assert.match(app.vProperties(), /Casa da Praia/, 'a pesquisa continua a encontrar pelo dono');
    assert.match(app.propFicha('p1'), /Ana Silva/);
  });

  test('um valor de um milhão ou mais vai em milhões no cartão, com o valor inteiro para o rato e para os leitores de ecrã', () => {
    const app = carregarApp();
    semear(app);
    assert.equal(app.imvEuroCurto(975000), app.euro(975000));
    assert.equal(app.imvEuroCurto(999999.6), '<span title="1 000 000 €" aria-hidden="true">1 M€</span><span class="imv-so-leitor">1 000 000 €</span>', 'o euro() arredondava para sete algarismos');
    assert.equal(app.imvEuroCurto(1250000), '<span title="1 250 000 €" aria-hidden="true">1,25 M€</span><span class="imv-so-leitor">1 250 000 €</span>');
    assert.match(app.imvEuroCurto(12500000), />12,5 M€</);
    app.db.properties.push(app.normProp({ id: 'p2', name: 'Quinta', use: 'proprio', ownerIds: ['o1'], value: 1250000, purchase: 1180000 }));
    const html = app.vProperties(), i = html.indexOf('data-lp="prop:p2"');
    const kv = [...html.slice(i).matchAll(/<div class="imv-kv"><span>([^<]*)<\/span><b>([\s\S]*?)<\/b><\/div>/g)].slice(0, 2).map((m) => [m[1], m[2]]);
    assert.deepEqual(kv.map((x) => x[0]), ['Valor', 'Aquisição']);
    assert.match(kv[0][1], /aria-hidden="true">1,25 M€<\/span><span class="imv-so-leitor">1 250 000 €<\/span>$/);
    assert.match(kv[1][1], />1,18 M€</);
  });

  test('os campos de euros do formulário abrem com a vírgula da app e ao cêntimo, e o num() lê-os de volta', () => {
    const app = carregarApp();
    semear(app);
    Object.assign(app.prop('p1'), { value: 200000, purchase: 180000.5, vpt: 95432.18, imi: 312.5, condominio: 45.9, seguro: 216 });
    app.prop('p1').loans[0].capitalInicio = 154277.2;
    const abertas = janelasEFichas(app);
    app.propModal('p1');
    const b = abertas[0].b;
    const valor = (id) => (new RegExp('id="' + id + '"[^>]*value="([^"]*)"').exec(b) || [])[1];
    assert.equal(valor('l_out_l1'), '154277,2', 'e não «154277.2»');
    assert.equal(valor('p_value'), '200000', 'os inteiros ficam iguais');
    assert.equal(valor('p_purchase'), '180000,5');
    assert.equal(valor('p_vpt'), '95432,18');
    assert.equal(valor('p_imi'), '312,5');
    assert.equal(valor('p_condominio'), '45,9');
    assert.equal(valor('p_seguro'), '216');
    assert.doesNotMatch(b, /value="\d+\.\d+"/, 'nenhum campo com o ponto decimal do JavaScript');
    for (const id of ['l_out_l1', 'p_purchase', 'p_vpt', 'p_imi', 'p_condominio']) assert.equal(String(app.num(valor(id))), valor(id).replace(',', '.'), id + ' lê-se de volta');
    // três casas arredondam ao cêntimo: o num() lia «1000,255» como milhares
    app.prop('p1').loans[0].capitalInicio = 1000.255;
    app.propModal('p1');
    const tres = (/id="l_out_l1"[^>]*value="([^"]*)"/.exec(abertas[1].b) || [])[1];
    assert.match(tres, /^1000,2\d$/);
    assert.ok(app.num(tres) < 1001, 'lido como mil e pouco, e não como um milhão');
  });

  test('os dados registais dizem o que é o número da descrição predial, na ficha e no resumo da dobra', () => {
    const app = carregarApp();
    semear(app);
    Object.assign(app.prop('p1'), { registry: '15937', matrix: '4651', tipoPredio: 'U' });
    assert.match(app.propFicha('p1'), /urbano · descrição predial n\.º 15937 · artigo 4651/);
    const abertas = janelasEFichas(app);
    app.propModal('p1');
    assert.match(abertas[0].b, /<span class="fsum">descrição predial n\.º 15937<\/span>/);
    assert.doesNotMatch(abertas[0].b + app.propFicha('p1'), /(?:·|>) n\.º 15937|>n\.º 15937/, 'o número sozinho lia-se como o da porta');
  });
});

describe('a nuvem: o perfil e os colaboradores do imóvel', () => {
  test('«Gerir» os colaboradores: com alterações no formulário pergunta antes de sair; sem alterações, sai logo', () => {
    const app = carregarTudo();
    limpar(app);
    app.db.owners = [app.normPerson({ id: 'eu', name: 'Rui Dono' })];
    app.db.properties = [app.normProp({ id: 'p1', name: 'T2 Porto', ownerIds: ['eu'] })];
    app.db.properties[0]._colaboradores = [{ userId: 'ana', name: 'Ana', roleName: 'Contabilista' }];
    app.CW.state = { proposals: [] };
    app.CW.user = { id: 'eu', name: 'Rui Dono', token: 't' };
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('p1'))));
    const html = app.propBody();
    assert.match(html, /<a href="#" class="u-c-v-accent" data-toca="ecra" data-click="event\.preventDefault\(\);cwGerirColaboradores\(\)">Gerir<\/a>/);
    assert.doesNotMatch(html, /closeAllModals\(\);go\(/, 'já não fecha tudo sem perguntar');
    const abertas = janelasFalsas(app, 'render', 'buildNav', 'save');
    const idas = [];
    app.go = (t) => { idas.push(t); };
    // a ficha e, por cima, o formulário com alterações
    app.openModal('T2 Porto', '<div class="imv-ficha"></div>');
    const form = app.openModal('Editar imóvel', html);
    form.tocado = true; form.snap = 'o que tinha ao abrir';
    app.cwGerirColaboradores();
    assert.equal(app.modalStack.length, 3, 'nada fechou');
    assert.equal(abertas[2].t, 'Sair sem guardar?');
    assert.match(abertas[2].f, /data-click="cwSairParaColaboradores\(\)">Sair sem guardar<\/button>/);
    assert.match(abertas[2].f, /data-click="closeModal\(\)">Continuar a editar<\/button>/);
    assert.deepEqual(idas, [], 'e não mudou de separador');
    app.cwSairParaColaboradores();
    assert.equal(app.modalStack.length, 0);
    assert.deepEqual(idas, ['colaboradores']);
    // sem alterações, segue logo
    idas.length = 0;
    app.openModal('Editar imóvel', html);
    app.cwGerirColaboradores();
    assert.equal(app.modalStack.length, 0);
    assert.deepEqual(idas, ['colaboradores']);
  });

  test('o perfil: o indicativo é o menu da app (sel), e não um <select>; a linha tem classe e o JavaScript não escreve estilos', () => {
    const app = carregarTudo();
    const lab = { tagName: 'LABEL', firstChild: { nodeType: 3, nodeValue: 'Telemóvel' }, insertBefore() {} };
    const inp = { value: '+44 7700 900123', placeholder: 'Opcional', style: {}, parentNode: lab };
    const criar = app.document.createElement, criados = [];
    app.document.createElement = (t) => { const e = criar(t); e.tag = t; criados.push(e); return e; };
    app.document.getElementById = (id) => (id === 'pe_phone' ? inp : id === 'cw_cc' ? null : criar('div'));
    app.injectPhoneCountry();
    assert.deepEqual(criados.map((e) => e.tag), ['div'], 'só a linha: nada de <select> nem de <option>');
    const linha = criados[0];
    assert.equal(linha.className, 'cw-tel');
    assert.match(linha.innerHTML, /^<div class="sel" id="sel_cw_cc">\s*<input type="hidden" id="cw_cc" value="\+44">/, 'o indicativo fica no campo escondido que o onSave lê');
    assert.match(linha.innerHTML, /role="option"[^>]*>\s*<span>\+351 Portugal<\/span>/);
    assert.doesNotMatch(linha.innerHTML, /<select|style=/);
    assert.ok(linha.children.includes(inp), 'o número vai para a linha, à direita do menu');
    assert.deepEqual(Object.keys(inp.style), [], 'a largura do número vem da folha de estilos (estilos.css:.cw-tel)');
    assert.equal(linha.style.cssText, undefined);
    assert.equal(inp.value, '7700 900123');
    assert.equal(lab.htmlFor, 'pe_phone', 'o rótulo continua a ser do número');
  });
});
