// Os serviços Contratos e Visitas, autónomos: cada um carrega e rende só com
// a base e o que requer (imóveis e inquilinos; imóveis), e com os outros
// serviços desligados nesta conta a lista, a ficha e os menus rendem sem os
// atalhos deles — registar renda (movimentos), a renda planeada (planeados),
// converter uma visita em inquilino (inquilinos). O «Registar renda» saiu do
// menu do contrato: quem o traz são os movimentos, por lpExtras; e são os
// contratos que trazem «Novo contrato» ao menu de um imóvel e de um inquilino.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarServico, limpar, igual, elementos } from './arnes.js';
// as janelas abrem numa pilha observável de camadas que respondem a qualquer
// seletor (o render repinta as fichas abertas pelo fillModal, que pede o
// título, o menu e o rodapé); o toque longo devolve os rótulos
import { janelasFalsas, menuDe } from './lib/dom.js';

const ANO = new Date().getFullYear();

/* um imóvel de arrendamento por quartos, uma inquilina, um contrato em vigor
   e um terminado, uma visita futura e uma passada — só o que é dos serviços
   carregados (os outros kinds não chegariam do servidor)
   Recebe: app — o contexto; o (opcional) — {owners, transactions} para semear também esses.
   Devolve: nada — enche o db. */
function semear(app, o) {
  limpar(app);
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', rentalMode: 'quartos',
    rooms: [{ id: 'Q1', name: 'Quarto 1' }], ownerIds: o && o.owners ? ['O1'] : [] })];
  if (o && o.owners) app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana', phone: '912 000 000' })];
  app.db.contracts = [
    app.normContract({ id: 'C1', propertyId: 'P1', roomId: 'Q1', tenantIds: ['T1'], rent: 800, payDay: 5, start: (ANO - 1) + '-01-01', end: (ANO + 1) + '-12-31' }),
    app.normContract({ id: 'C2', propertyId: 'P1', tenantIds: ['T1'], rent: 500, start: (ANO - 3) + '-01-01', end: (ANO - 2) + '-12-31', active: false }),
  ];
  app.db.visits = [
    app.normVisit({ id: 'V1', nomes: 'Bruno', propertyId: 'P1', roomId: 'Q1', date: '2999-01-01', start: '15:00', contacto: 'bruno@x.pt', notas: 'gostou' }),
    app.normVisit({ id: 'V2', nomes: 'Carla', propertyId: 'P1', date: '2001-01-01', estado: 'realizada', resultado: 'interessado' }),
  ];
  if (o && o.transactions) app.db.transactions = [app.normTx({ id: 'X1', kind: 'income', label: 'Renda Ana', amount: 800, date: ANO + '-01-05', propertyId: 'P1', contractId: 'C1' })];
}

const SEM_ATALHOS = /openTx\(|txModal\(|newTx\(|go\('transactions'\)|go\('recurring'\)/;

describe('autonomia: os contratos e as visitas rendem só com a base e o que requerem', () => {
  test('autonomia: contracts carrega com properties e tenants, os outros ficam desligados e nem estão carregados', () => {
    const app = carregarServico(['contracts']);
    for (const id of ['contracts', 'properties', 'tenants']) assert.ok(app.servicoLigado(id), id + ' ligado');
    for (const id of ['transactions', 'recurring', 'visits', 'owners', 'credits']) assert.ok(!app.servicoLigado(id), id + ' desligado');
    assert.equal(typeof app.txModal, 'undefined', 'os movimentos não estão carregados');
    assert.equal(typeof app.syncContractRec, 'undefined', 'os planeados não estão carregados');
    assert.equal(typeof app.vVisits, 'undefined', 'as visitas não estão carregadas');
    assert.equal(typeof app.vContracts, 'function');
    assert.equal(typeof app.ctModal, 'function');
    assert.equal(typeof app.generateContractPdf, 'function');
    assert.equal(typeof app.personModal, 'function', 'os inquilinos (requeridos) estão');
  });

  test('autonomia: vContracts rende com a db vazia e com dados, pelo registo, e o «depois» das rendas dos grupos corre', () => {
    const app = carregarServico(['contracts']);
    const fixos = elementos(app);
    limpar(app);
    assert.equal(app.vistaDoSeparador('contracts'), app.vContracts);
    const vazio = app.vContracts();
    assert.ok(vazio.length > 0);
    assert.match(vazio, /Cria primeiro um imóvel/);
    semear(app);
    const html = app.vContracts();
    assert.match(html, /T2 Lisboa/);
    assert.match(html, /Ana/);
    assert.match(html, /Quarto 1/);
    assert.match(html, /terminado/, 'o C2 leva o selo');
    assert.match(html, /data-lp="ct:C1"/);
    assert.match(html, /Novo contrato/, 'o FAB de criar');
    assert.doesNotMatch(html, SEM_ATALHOS);
    app.tab = 'contracts';
    app.render();
    assert.ok(fixos.view.innerHTML.includes('T2 Lisboa'), 'o render despacha pelo registo');
    assert.equal(app.depoisDoSeparador('contracts'), app.pintarRendasDosGrupos);
    app.depoisDoSeparador('contracts')();
  });

  test('autonomia: a ficha do contrato lê-se, abre e edita-se só com a base', () => {
    const app = carregarServico(['contracts']);
    elementos(app);
    semear(app);
    const abertas = janelasFalsas(app, 'paintThumbs', 'save');
    const corpo = app.ctFicha('C1');
    assert.ok(corpo.length > 0);
    assert.match(corpo, /Em vigor/);
    assert.match(corpo, /Ana/);
    assert.match(corpo, /800/);
    assert.doesNotMatch(corpo, /Próxima renda/, 'a renda planeada é dos Planeados, que não estão');
    assert.doesNotMatch(corpo, SEM_ATALHOS);
    assert.equal(app.ctFicha('nada'), '');
    app.ctView('C1');
    assert.equal(abertas.length, 1);
    assert.match(abertas[0].t, /Ana/);
    assert.match(abertas[0].m, /generateContractPdf\('C1'\)/);
    assert.match(abertas[0].m, /Terminar contrato/);
    assert.doesNotMatch(abertas[0].m, /Registar renda|txModal\(/);
    assert.match(abertas[0].f, /ctModal\('C1'\)/, 'o dono edita');
    // o formulário, novo e a editar
    app.ctModal(null, 'P1');
    assert.equal(abertas[1].t, 'Novo contrato');
    assert.equal(app.cForm.propertyId, 'P1');
    assert.match(abertas[1].b, /id="c_rent"/);
    assert.doesNotMatch(abertas[1].b, /c_autorec|Planeados/, 'sem os Planeados não há renda recorrente a prometer');
    app.ctModal('C2');
    assert.equal(abertas[2].t, 'Editar contrato');
    assert.match(abertas[2].m, /Reativar contrato/);
    assert.equal(typeof app.onSave, 'function');
    // e um contrato novo a partir de um inquilino entra já com ele dentro
    app.ctModal(null, null, 'T1');
    igual(app.cForm.tenantIds, ['T1']);
    assert.equal(app.cForm.tenantPhone, '912 000 000', 'o contacto da ficha segue');
    app.ctModal(null, null, 'ninguem');
    igual(app.cForm.tenantIds, []);
  });

  test('autonomia: visits carrega só com properties, e vVisits e a ficha rendem com a db vazia e com dados', () => {
    const app = carregarServico(['visits']);
    const fixos = elementos(app);
    assert.ok(app.servicoLigado('visits') && app.servicoLigado('properties'));
    for (const id of ['tenants', 'contracts', 'transactions']) assert.ok(!app.servicoLigado(id), id + ' desligado');
    assert.equal(typeof app.personModal, 'undefined', 'os inquilinos não estão carregados');
    assert.equal(typeof app.vContracts, 'undefined');
    assert.equal(app.vistaDoSeparador('visits'), app.vVisits);
    limpar(app);
    const vazio = app.vVisits();
    assert.ok(vazio.length > 0);
    assert.match(vazio, /Ainda não há visitas|À espera do servidor/);
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', rentalMode: 'quartos', rooms: [{ id: 'Q1', name: 'Quarto 1' }] })];
    app.db.visits = [
      app.normVisit({ id: 'V1', nomes: 'Bruno', propertyId: 'P1', roomId: 'Q1', date: '2999-01-01', start: '15:00' }),
      app.normVisit({ id: 'V2', nomes: 'Carla', propertyId: 'P1', date: '2001-01-01', estado: 'realizada', resultado: 'interessado' }),
    ];
    const html = app.vVisits();
    assert.match(html, /Próximas/);
    assert.match(html, /Passadas/);
    assert.match(html, /Bruno/);
    assert.match(html, /data-lp="vis:V1"/);
    assert.doesNotMatch(html, /visConverte\(|personModal\(/);
    app.tab = 'visits';
    app.render();
    assert.ok(fixos.view.innerHTML.includes('Bruno'), 'o render despacha pelo registo');
    const corpo = app.visFicha('V1');
    assert.ok(corpo.length > 0);
    assert.match(corpo, /Quarto 1/);
    assert.match(corpo, /15:00/);
    assert.equal(app.visFicha('nada'), '');
    const abertas = janelasFalsas(app, 'paintThumbs', 'save');
    app.visView('V1');
    assert.equal(abertas[0].t, 'Bruno');
    assert.doesNotMatch(abertas[0].m, /Converter em inquilino|visConverte\(/, 'converter é criar um inquilino, e os Inquilinos não estão');
    assert.match(abertas[0].m, /Marcar realizada/);
    igual(app.visOpcoes(app.db.visits[0]).map((i) => i.label), ['Marcar realizada', 'Marcar falta', 'Apagar visita']);
    app.visitModal();
    assert.equal(abertas[1].t, 'Marcar visita');
    assert.match(abertas[1].b, /id="vi_nomes"/);
  });

  test('autonomia: lpDe(ct), lpDe(vis) e depoisDoSeparador(contracts) resolvem para as funções de cada serviço', () => {
    const c = carregarServico(['contracts']);
    assert.equal(c.lpDe('ct'), c.lpContrato);
    assert.equal(c.depoisDoSeparador('contracts'), c.pintarRendasDosGrupos);
    assert.equal(c.lpDe('vis'), null, 'as visitas não estão carregadas');
    const v = carregarServico(['visits']);
    assert.equal(v.lpDe('vis'), v.lpVisita);
    assert.equal(v.lpDe('ct'), null, 'os contratos não estão carregados');
    assert.equal(v.depoisDoSeparador('contracts'), null);
    const app = carregarApp();
    assert.equal(app.lpDe('ct'), app.lpContrato);
    assert.equal(app.lpDe('vis'), app.lpVisita);
    app.definirServicosDesligados(['contracts']);
    assert.equal(app.lpDe('ct'), null, 'desligado, o prefixo não abre nada');
    assert.equal(app.lpDe('vis'), app.lpVisita, 'as visitas não dependem dos contratos');
  });

  test('autonomia: o toque longo de um contrato e de uma visita só com a base traz o que é de cada um', () => {
    const app = carregarServico(['contracts']);
    semear(app);
    igual(menuDe(app, app.lpContrato, ['ct', 'C1']), ['Editar contrato', 'Gerar contrato em PDF', 'Terminar contrato', 'Apagar contrato']);
    igual(menuDe(app, app.lpContrato, ['ct', 'C2']), ['Editar contrato', 'Gerar contrato em PDF', 'Reativar contrato', 'Apagar contrato']);
    assert.equal(menuDe(app, app.lpContrato, ['ct', 'nada']), null, 'um contrato que já não existe não abre nada');
    const v = carregarServico(['visits']);
    limpar(v);
    v.db.properties = [v.normProp({ id: 'P1', name: 'T2 Lisboa' })];
    v.db.visits = [v.normVisit({ id: 'V1', nomes: 'Bruno', propertyId: 'P1', date: '2999-01-01' })];
    igual(menuDe(v, v.lpVisita, ['vis', 'V1']), ['Editar visita', 'Marcar realizada', 'Marcar falta', 'Apagar visita']);
  });

  test('autonomia: o registo dos contratos contribui «Novo contrato» para os menus de imóvel e de pessoa, e o das visitas só o seu prefixo', () => {
    const app = carregarServico(['contracts']);
    semear(app);
    const m = app.REGISTO.manifestos.contracts;
    assert.equal(m.lpExtras.prop, 'lpExtrasContratosImovel');
    assert.equal(m.lpExtras.per, 'lpExtrasContratosPessoa');
    igual(app.lpExtrasDe('prop', ['prop', 'P1']).map((o) => o.label), ['Novo contrato']);
    igual(app.lpExtrasDe('per', ['per', 'tenant', 'T1']).map((o) => o.label), ['Novo contrato']);
    igual(app.lpExtrasDe('per', ['per', 'owner', 'T1']), [], 'só nos inquilinos');
    igual(app.lpExtrasDe('per', ['per', 'tenant', 'ninguem']), []);
    igual(app.lpExtrasDe('prop', ['prop', 'nada']), []);
    app.db.properties[0].use = 'habitacao';
    igual(app.lpExtrasDe('prop', ['prop', 'P1']), [], 'um imóvel que não é de arrendamento não tem contratos');
    igual(app.lpExtrasDe('per', ['per', 'tenant', 'T1']), [], 'e sem imóvel de arrendamento nenhum, a pessoa também não');
    const v = carregarServico(['visits']);
    igual(Object.keys(v.REGISTO.manifestos.visits.lp), ['vis']);
  });
});

describe('desligado: com os outros serviços desligados, os contratos e as visitas rendem sem os atalhos deles', () => {
  test('desligado: sem movimentos nem planeados, a lista e a ficha do contrato rendem sem os atalhos, e o controlo positivo mostra-os', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    semear(app, { owners: true, transactions: true });
    const abertas = janelasFalsas(app, 'paintThumbs', 'save');
    app.syncContractRec(app.db.contracts[0]);
    assert.equal(app.db.recurring.length, 1, 'a renda planeada existe');
    // controlo positivo: com tudo ligado, a ficha e o menu trazem o que é dos movimentos e dos planeados
    let corpo = app.ctFicha('C1');
    assert.match(corpo, /Próxima renda/);
    assert.match(corpo, /Rendas registadas/);
    app.ctView('C1');
    assert.match(abertas[0].m, /Registar renda/);
    // o txModal({…}) de um objeto literal não se escreve numa ação: o menu chama a função com nome, com os dois ids
    assert.match(abertas[0].m, /ctRegistarRenda\('P1','C1'\)/);
    app.ctModal('C1');
    assert.match(abertas[1].b, /id="c_autorec"/);
    assert.match(abertas[1].b, /Planeados/);
    app.tab = 'contracts';
    app.render();
    assert.ok(fixos.view.innerHTML.includes('T2 Lisboa'));
    // desligados: nada disso, e nada rebenta
    app.definirServicosDesligados(['transactions', 'recurring']);
    assert.ok(app.servicoLigado('contracts'), 'os contratos ficam');
    app.render();
    const lista = fixos.view.innerHTML;
    assert.ok(lista.includes('T2 Lisboa') && lista.includes('Ana'), 'a lista rende');
    assert.doesNotMatch(lista, SEM_ATALHOS);
    corpo = app.ctFicha('C1');
    assert.ok(corpo.length > 0);
    assert.match(corpo, /Em vigor/);
    assert.doesNotMatch(corpo, /Próxima renda|Rendas registadas/);
    assert.doesNotMatch(corpo, SEM_ATALHOS);
    app.ctView('C1');
    const L = abertas[abertas.length - 1];
    assert.doesNotMatch(L.m, /Registar renda|txModal\(|openTx\(/);
    assert.match(L.m, /Gerar contrato em PDF/, 'o que é do contrato fica');
    assert.match(L.m, /Terminar contrato/);
    app.ctModal('C1');
    const F = abertas[abertas.length - 1];
    assert.equal(F.t, 'Editar contrato');
    assert.doesNotMatch(F.b, /c_autorec|Planeados|movimento recorrente/);
    assert.match(F.b, /id="c_active"/, 'o resto do formulário está lá');
  });

  test('desligado: o menu de toque longo de um contrato não traz «Registar renda» sem os movimentos; com tudo ligado o de um imóvel de investimento e o de um inquilino trazem «Novo contrato» via lpExtrasDe', () => {
    const app = carregarApp();
    elementos(app);
    semear(app, { owners: true, transactions: true });
    const abertas = janelasFalsas(app, 'paintThumbs', 'save');
    app.definirServicosDesligados(['transactions', 'recurring']);
    const labels = menuDe(app, app.lpContrato, ['ct', 'C1']);
    assert.ok(!labels.includes('Registar renda'), labels.join(', '));
    assert.ok(labels.includes('Gerar contrato em PDF') && labels.includes('Terminar contrato'), labels.join(', '));
    // e pelo lpMenu, que despacha pelo registo
    igual(menuDe(app, app.lpMenu, 'ct:C1'), Array.from(labels));
    // controlo positivo: com tudo ligado, os contratos acrescentam «Novo contrato» aos imóveis de investimento e aos inquilinos
    // (outros serviços — os movimentos — também contribuem para estes menus: aqui só se olha para o que é dos contratos)
    app.definirServicosDesligados([]);
    const novoDe = (prefixo, a) => app.lpExtrasDe(prefixo, a).find((o) => o.label === 'Novo contrato');
    const extraProp = novoDe('prop', ['prop', 'P1']);
    assert.ok(extraProp, 'o menu do imóvel traz «Novo contrato»');
    extraProp.act();
    assert.equal(abertas[abertas.length - 1].t, 'Novo contrato');
    assert.equal(app.cForm.propertyId, 'P1', 'já com o imóvel escolhido');
    const extraPer = novoDe('per', ['per', 'tenant', 'T1']);
    assert.ok(extraPer, 'o menu do inquilino traz «Novo contrato»');
    extraPer.act();
    assert.equal(abertas[abertas.length - 1].t, 'Novo contrato');
    igual(app.cForm.tenantIds, ['T1'], 'já com o inquilino dentro');
    assert.equal(novoDe('per', ['per', 'owner', 'O1']), undefined, 'um proprietário não é parte de um contrato');
    // e com os contratos desligados a contribuição some
    app.definirServicosDesligados(['contracts']);
    assert.equal(novoDe('prop', ['prop', 'P1']), undefined);
    assert.equal(novoDe('per', ['per', 'tenant', 'T1']), undefined);
  });

  test('desligado: sem os planeados, terminar e reativar um contrato não tocam em db.recurring nem lançam; ligados, a renda planeada acompanha', () => {
    const app = carregarApp();
    elementos(app);
    semear(app, { owners: true });
    janelasFalsas(app, 'paintThumbs', 'save');
    app.confirmModal = (t, m, f) => f();
    app.syncContractRec(app.db.contracts[0]);
    assert.equal(app.db.recurring.length, 1);
    // controlo positivo: com os planeados ligados, terminar apaga a renda planeada
    app.endContract('C1');
    assert.equal(app.db.contracts[0].active, false);
    assert.equal(app.db.recurring.length, 0, 'a renda planeada saiu com o contrato');
    app.reactivateContract('C1');
    assert.equal(app.db.contracts[0].active, true);
    assert.equal(app.db.recurring.length, 1, 'e voltou');
    // desligados: o contrato termina e reativa-se na mesma, e db.recurring fica como estava
    app.definirServicosDesligados(['transactions', 'recurring']);
    const antes = JSON.stringify(app.db.recurring);
    app.endContract('C1');
    assert.equal(app.db.contracts[0].active, false);
    assert.equal(JSON.stringify(app.db.recurring), antes, 'não se toca no que é dos Planeados');
    app.reactivateContract('C1');
    assert.equal(app.db.contracts[0].active, true);
    assert.equal(JSON.stringify(app.db.recurring), antes);
    // e um movimento fora das datas abre-se pelos movimentos só com eles ligados
    let msg = '';
    app.toast = (m) => { msg = String(m); };
    app.db.transactions = [app.normTx({ id: 'X9', kind: 'income', amount: 1, date: '1990-01-01', propertyId: 'P1', contractId: 'C1' })];
    let abriu = null;
    app.pickModal = (t, opts, onPick) => { onPick(opts[0]); };
    app.txView = (id) => { abriu = id; };
    app.verMovimentosFora('C1');
    assert.equal(abriu, null, 'desligados, não abre a ficha do movimento');
    assert.equal(msg, app.hintServicoDesligado('transactions'));
    app.definirServicosDesligados([]);
    app.verMovimentosFora('C1');
    assert.equal(abriu, 'X9', 'ligados, abre');
  });

  test('desligado: sem inquilinos (e os contratos caem junto), a vista e a ficha das visitas rendem sem o atalho para a pessoa; o controlo positivo mostra-o', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    semear(app, { owners: true });
    const abertas = janelasFalsas(app, 'paintThumbs', 'save');
    // controlo positivo
    assert.ok(app.visOpcoes(app.db.visits[0]).some((i) => i.label === 'Converter em inquilino'));
    app.visView('V1');
    assert.match(abertas[0].m, /visConverte\('V1'\)/);
    assert.ok(menuDe(app, app.lpVisita, ['vis', 'V1']).includes('Converter em inquilino'));
    // desligados
    app.definirServicosDesligados(['tenants']);
    igual(app.servicosDesligados(), ['contracts', 'tenants'], 'os contratos requerem os inquilinos');
    assert.ok(app.servicoLigado('visits'));
    app.tab = 'visits';
    app.render();
    const html = fixos.view.innerHTML;
    assert.ok(html.includes('Bruno') && html.includes('Carla'), 'a vista rende');
    assert.doesNotMatch(html, /visConverte\(|personModal\(|go\('tenants'\)|go\('contracts'\)/);
    assert.ok(!app.visOpcoes(app.db.visits[0]).some((i) => i.label === 'Converter em inquilino'));
    app.visView('V1');
    const L = abertas[abertas.length - 1];
    assert.doesNotMatch(L.m, /Converter em inquilino|visConverte\(/);
    assert.match(L.m, /Marcar realizada/, 'o que é da visita fica');
    assert.ok(!menuDe(app, app.lpVisita, ['vis', 'V1']).includes('Converter em inquilino'));
    // e converter à mão não cria a ficha: diz que o serviço está desligado, sem culpa
    let msg = '', abriuPessoa = false;
    app.toast = (m) => { msg = String(m); };
    app.personModal = () => { abriuPessoa = true; };
    const n = app.db.tenants.length;
    app.visConverte('V1');
    assert.equal(app.db.tenants.length, n, 'nenhuma ficha criada');
    assert.equal(abriuPessoa, false);
    assert.equal(msg, 'O serviço Inquilinos está desligado nesta conta.');
    assert.doesNotMatch(msg, /não podes|não tens|erro/i);
    // ligados outra vez, converte e abre a ficha
    app.definirServicosDesligados([]);
    app.visConverte('V1');
    assert.equal(app.db.tenants.length, n + 1);
    assert.equal(abriuPessoa, true);
    assert.equal(app.db.tenants[n].email, 'bruno@x.pt');
  });
});
