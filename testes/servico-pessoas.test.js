// Os serviços das pessoas — Inquilinos, Proprietários e Colaboradores — como
// serviços: cada um carrega e rende só com a base (e o que requer), e quando
// os outros estão desligados nesta conta as listas, a ficha e o toque longo
// rendem sem os atalhos para eles (contratos num inquilino, imóveis num
// proprietário, a partilha e os cargos que a nuvem pinta).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { carregarServico, carregarTudo, limpar, igual, elementos, SERVICOS_FICHEIROS } from './arnes.js';

const TODOS = SERVICOS_FICHEIROS.map((s) => s.id);

/* Um imóvel de arrendamento, o dono dele, uma inquilina com contrato em
   vigor — o suficiente para cada lista e cada ficha terem o que mostrar.
   Recebe: app — a janela da app.
   Devolve: a base semeada (app.db). */
function semear(app) {
  const db = limpar(app);
  db.owners.push(app.normPerson({ id: 'o1', name: 'Rui Dono', nif: '123456789', phone: '912345678' }));
  db.tenants.push(app.normPerson({ id: 't1', name: 'Ana Inquilina', phone: '961234567', email: 'ana@exemplo.pt' }));
  db.properties.push(app.normProp({ id: 'p1', name: 'T2 Porto', use: 'investimento', ownerIds: ['o1'] }));
  db.contracts.push(app.normContract({ id: 'c1', name: 'Arrendamento da Ana', propertyId: 'p1', tenantIds: ['t1'], rent: 700, start: '2026-01-01', active: true }));
  return db;
}

/* Os espiões que apanham o que a ficha e o toque longo abrem, sem DOM.
   Recebe: app — a janela da app.
   Devolve: {modais: [{titulo, corpo, menu}], folhas: [{titulo, labels}]}. */
function espiar(app) {
  const esp = { modais: [], folhas: [], toasts: [] };
  app.openModal = (t, b, f, m) => { esp.modais.push({ titulo: t, corpo: b || '', rodape: f || '', menu: m || '' }); return { el: {} }; };
  app.closeAllModals = () => {};
  app.lpShow = (t, opts) => { esp.folhas.push({ titulo: t, labels: opts.map((o) => o.label) }); };
  app.toast = (m) => { esp.toasts.push(String(m)); };
  return esp;
}

const ultimo = (a) => a[a.length - 1];
const SEM_CONTRATOS = ['openContract(', 'ctModal(', 'ctView(', "go('contracts')"];
const SEM_IMOVEIS = ['openProp(', "go('properties')", 'T2 Porto'];

describe('autonomia: os inquilinos, os proprietários e os colaboradores rendem só com a base', () => {
  test('autonomia: tenants carrega só a base e o serviço; vTenants rende com a db vazia e com dados, sem os contratos', () => {
    const app = carregarServico(['tenants']);
    assert.ok(app.servicoLigado('tenants'));
    for (const id of ['owners', 'contracts', 'properties', 'colaboradores']) assert.ok(!app.servicoLigado(id), id + ' desligado');
    assert.equal(typeof app.vistaDoSeparador('tenants'), 'function');
    assert.equal(app.vistaDoSeparador('owners'), null, 'os proprietários registaram-se mas estão desligados');
    limpar(app);
    const vazio = app.vTenants();
    assert.ok(vazio.length > 0);
    assert.match(vazio, /Sem inquilinos/);
    semear(app);
    const html = app.vTenants();
    assert.match(html, /Ana Inquilina/);
    assert.ok(html.includes("personView('tenant','t1')"), 'o cartão abre a ficha');
    assert.ok(html.includes('data-lp="per:tenant:t1"'), 'e tem toque longo');
    for (const t of SEM_CONTRATOS) assert.ok(!html.includes(t), 'sem ' + t);
    assert.ok(!html.includes('Sem contrato ativo') && !html.includes('Arrendamento da Ana'), 'os contratos não se mencionam: o serviço não está nesta conta');
    assert.ok(!html.includes('lfsel_lten_ct'), 'sem o filtro por contrato');
    assert.ok(!html.includes('Ordenar por renda'), 'sem a ordem por renda');
    const fixos = elementos(app);
    app.tab = 'tenants';
    app.render();
    assert.match(fixos.view.innerHTML, /Ana Inquilina/, 'o render despacha a vista pelo registo');
  });

  test('autonomia: owners carrega só a base e o serviço; vOwners rende com a db vazia e com dados, sem os imóveis', () => {
    const app = carregarServico(['owners']);
    assert.ok(app.servicoLigado('owners'));
    for (const id of ['tenants', 'contracts', 'properties']) assert.ok(!app.servicoLigado(id), id + ' desligado');
    assert.equal(typeof app.vistaDoSeparador('owners'), 'function');
    assert.equal(app.vistaDoSeparador('tenants'), null);
    limpar(app);
    const vazio = app.vOwners();
    assert.ok(vazio.length > 0);
    assert.match(vazio, /Sem proprietários/);
    semear(app);
    const html = app.vOwners();
    assert.match(html, /Rui Dono/);
    assert.ok(html.includes("personView('owner','o1')"));
    for (const t of SEM_IMOVEIS) assert.ok(!html.includes(t), 'sem ' + t);
    assert.ok(!html.includes('Sem imóveis'), 'os imóveis não se mencionam: o serviço não está nesta conta');
    assert.ok(!html.includes('lfsel_lown_p') && !html.includes('lfsel_lown_pr'), 'sem os filtros por imóvel');
    const fixos = elementos(app);
    app.tab = 'owners';
    app.render();
    assert.match(fixos.view.innerHTML, /Rui Dono/);
  });

  test('autonomia: a ficha da pessoa rende só com tenants e só com owners, com HTML não vazio e sem os atalhos dos outros', () => {
    const t = carregarServico(['tenants']);
    semear(t);
    const espT = espiar(t);
    const fichaT = t.personFicha('tenant', 't1');
    assert.ok(fichaT.length > 0);
    assert.match(fichaT, /Telemóvel/);
    assert.ok(!/Mora em|Arrendamento da Ana|Contratos anteriores/.test(fichaT), 'sem os contratos');
    t.personView('tenant', 't1');
    assert.equal(ultimo(espT.modais).titulo, 'Ana Inquilina');
    assert.ok(ultimo(espT.modais).corpo.length > 0);
    for (const x of SEM_CONTRATOS) assert.ok(!ultimo(espT.modais).menu.includes(x), 'menu sem ' + x);
    assert.ok(!ultimo(espT.modais).menu.includes('Ver contrato'));
    assert.ok(ultimo(espT.modais).menu.includes("delPerson('tenant','t1')"), 'controlo: o apagar, que é deste serviço, está');

    const o = carregarServico(['owners']);
    semear(o);
    const espO = espiar(o);
    const fichaO = o.personFicha('owner', 'o1');
    assert.ok(fichaO.length > 0);
    assert.match(fichaO, /NIF/);
    assert.ok(!/Imóveis e quota-parte|T2 Porto|Renda mensal|Contas entre proprietários/.test(fichaO), 'sem os imóveis, a renda e o saldo');
    o.personView('owner', 'o1');
    assert.equal(ultimo(espO.modais).titulo, 'Rui Dono');
    assert.ok(ultimo(espO.modais).corpo.length > 0);
    assert.ok(ultimo(espO.modais).rodape.includes("personModal('owner','o1')"), 'o editar é deste serviço');
  });

  test('autonomia: colaboradores carrega a base, os Imóveis (requer) e o serviço; vColabTab rende sem nuvem, com a db vazia e com dados', () => {
    const app = carregarServico(['colaboradores']);
    assert.ok(app.servicoLigado('colaboradores'));
    assert.ok(app.servicoLigado('properties'), 'o fecho dos requer');
    for (const id of ['tenants', 'owners', 'contracts', 'transactions']) assert.ok(!app.servicoLigado(id), id + ' desligado');
    assert.equal(typeof app.vistaDoSeparador('colaboradores'), 'function');
    assert.equal(app.vColaboradores, undefined, 'a nuvem não está carregada');
    limpar(app);
    const vazio = app.vColabTab();
    assert.ok(vazio.length > 0);
    assert.match(vazio, /Precisas de uma conta/);
    assert.ok(vazio.includes("goSet('cloud')"), 'a saída é para a base (Definições)');
    semear(app);
    assert.match(app.vColabTab(), /Precisas de uma conta/);
    const fixos = elementos(app);
    app.tab = 'colaboradores';
    app.render();
    assert.match(fixos.view.innerHTML, /Precisas de uma conta/);
  });

  test('autonomia: lpDe(\'per\') resolve com um dos dois ligado, e lpPessoa decide pelo kind', () => {
    for (const id of ['tenants', 'owners']) {
      const app = carregarServico([id]);
      semear(app);
      const esp = espiar(app);
      assert.equal(typeof app.lpDe('per'), 'function', id + ' sozinho dá o handler');
      app.lpMenu('per:tenant:t1');
      app.lpMenu('per:owner:o1');
      assert.equal(esp.folhas.length, 1, 'só o kind do serviço ligado abre a folha');
      assert.equal(ultimo(esp.folhas).titulo, id === 'tenants' ? 'Ana Inquilina' : 'Rui Dono');
      igual(ultimo(esp.folhas).labels, ['Editar ficha', 'Apagar']);
      app.definirServicosDesligados(TODOS);
      assert.equal(app.lpDe('per'), null, 'com os dois desligados não há handler');
      app.lpMenu('per:tenant:t1');
      assert.equal(esp.folhas.length, 1);
    }
  });
});

describe('desligado: com os outros desligados, as pessoas rendem sem os atalhos', () => {
  /* a app inteira, nuvem incluída, com um extra de teste no menu da pessoa a
     fazer de «Novo contrato» — prova o mecanismo sem depender do que os
     Contratos registam hoje (que também o trazem, quando ligados) */
  function montar() {
    const app = carregarTudo();
    semear(app);
    const esp = espiar(app);
    vm.runInContext("function perExtraDeTeste(a){return a[1]==='tenant'?[{label:'Novo contrato',icon:'contract',act:function(){}}]:[]}", app.__ctx);
    app.registarServico({ id: 'contracts', lpExtras: { per: 'perExtraDeTeste' } });
    return { app, esp, fixos: elementos(app) };
  }

  test('desligado: contracts — a lista e a ficha de um inquilino rendem sem os atalhos para contratos, e o toque longo sem «Novo contrato»', () => {
    const { app, esp, fixos } = montar();
    app.definirServicosDesligados(['contracts']);
    assert.ok(app.servicoLigado('tenants'), 'os inquilinos não requerem os contratos');
    const html = app.vTenants();
    assert.match(html, /Ana Inquilina/);
    for (const t of SEM_CONTRATOS) assert.ok(!html.includes(t), 'lista sem ' + t);
    assert.ok(!html.includes('Arrendamento da Ana') && !html.includes('Sem contrato ativo'));
    assert.ok(!html.includes('lfsel_lten_ct'));
    app.tab = 'tenants';
    app.render();
    for (const t of SEM_CONTRATOS) assert.ok(!fixos.view.innerHTML.includes(t), 'render sem ' + t);
    const ficha = app.personFicha('tenant', 't1');
    assert.ok(ficha.length > 0);
    assert.ok(!/Mora em|Arrendamento da Ana/.test(ficha));
    app.personView('tenant', 't1');
    for (const t of SEM_CONTRATOS) assert.ok(!ultimo(esp.modais).menu.includes(t), 'ficha sem ' + t);
    assert.ok(!ultimo(esp.modais).menu.includes('Ver contrato'));
    app.lpMenu('per:tenant:t1');
    assert.ok(!ultimo(esp.folhas).labels.includes('Novo contrato'), ultimo(esp.folhas).labels.join(' | '));
    igual(ultimo(esp.folhas).labels, ['Editar ficha', 'Apagar']);
  });

  test('desligado: properties — a lista e a ficha de um proprietário rendem sem os atalhos para imóveis', () => {
    const { app, esp, fixos } = montar();
    app.definirServicosDesligados(['properties']);
    assert.ok(app.servicoLigado('owners'), 'os proprietários não requerem os imóveis');
    assert.ok(!app.servicoLigado('contracts'), 'o fecho: sem imóveis não há contratos');
    const html = app.vOwners();
    assert.match(html, /Rui Dono/);
    for (const t of SEM_IMOVEIS) assert.ok(!html.includes(t), 'lista sem ' + t);
    assert.ok(!html.includes('Sem imóveis') && !html.includes('lfsel_lown_p'));
    app.tab = 'owners';
    app.render();
    assert.match(fixos.view.innerHTML, /Rui Dono/);
    for (const t of SEM_IMOVEIS) assert.ok(!fixos.view.innerHTML.includes(t), 'render sem ' + t);
    const ficha = app.personFicha('owner', 'o1');
    assert.ok(ficha.length > 0);
    assert.ok(!/Imóveis e quota-parte|T2 Porto|Renda mensal/.test(ficha));
    app.personView('owner', 'o1');
    assert.equal(ultimo(esp.modais).titulo, 'Rui Dono');
    assert.ok(ultimo(esp.modais).corpo.length > 0);
    for (const t of SEM_IMOVEIS) assert.ok(!ultimo(esp.modais).corpo.includes(t) && !ultimo(esp.modais).menu.includes(t), 'ficha sem ' + t);
  });

  test('desligado: owners — a lista de inquilinos abre; tenants — a de proprietários abre; o toque longo segue o kind', () => {
    const { app, esp, fixos } = montar();
    app.definirServicosDesligados(['owners']);
    assert.equal(typeof app.vistaDoSeparador('tenants'), 'function');
    assert.equal(app.vistaDoSeparador('owners'), null);
    app.tab = 'tenants';
    app.render();
    assert.match(fixos.view.innerHTML, /Ana Inquilina/);
    assert.equal(typeof app.lpDe('per'), 'function');
    app.lpMenu('per:owner:o1');
    assert.equal(esp.folhas.length, 0, 'um proprietário não abre nada com o serviço desligado');
    app.lpMenu('per:tenant:t1');
    assert.equal(esp.folhas.length, 1);

    app.definirServicosDesligados(['tenants']);
    assert.equal(typeof app.vistaDoSeparador('owners'), 'function');
    assert.equal(app.vistaDoSeparador('tenants'), null);
    assert.ok(!app.servicoLigado('contracts'), 'o fecho: sem inquilinos não há contratos');
    app.tab = 'owners';
    app.render();
    assert.match(fixos.view.innerHTML, /Rui Dono/);
    app.lpMenu('per:tenant:t1');
    assert.equal(esp.folhas.length, 1, 'um inquilino não abre nada com o serviço desligado');
    app.lpMenu('per:owner:o1');
    assert.equal(esp.folhas.length, 2);
    assert.equal(ultimo(esp.folhas).titulo, 'Rui Dono');
  });

  /* A nuvem com sessão e estado: eu sou o dono do T2 Porto, com uma
     colaboradora, um cargo, um convite, a ligação de partilha ativa e um
     pedido recebido; e um imóvel onde sou eu o colaborador. */
  function montarNuvem() {
    const { app, esp } = montar();
    app.CW.user = { id: 'o1', name: 'Rui Dono', email: 'rui@exemplo.pt', token: 't' };
    app.CW.state = {
      me: { id: 'o1' },
      roles: [{ id: 'R1', name: 'Gestor de visitas', perms: ['visit.view', 'visit.add'], n: 1 }],
      collaborators: [{ id: 'C1', userId: 'MARIA', name: 'Maria', roleId: 'R1', roleName: 'Gestor de visitas', houses: [{ id: 'p1', name: 'T2 Porto' }] }],
      invites: [{ id: 'i1', label: 'para a Ana', roleName: 'Gestor de visitas', houses: [{ id: 'p1', name: 'T2 Porto' }], expiresAt: 4102444800000 }],
      shareLink: { ativo: true, uses: 2 },
      shareRequests: { incoming: [{ id: 'q1', fromName: 'Ana', houseName: 'T1 Braga', createdAt: 1 }], outgoing: [] },
      connections: [],
    };
    app.CW._pulled = 1;
    const casa = app.db.properties[0];
    casa._colaboradores = [{ id: 'C1', userId: 'MARIA', name: 'Maria', roleId: 'R1', roleName: 'Gestor de visitas' }];
    app.db.properties.push(Object.assign(app.normProp({ id: 'p2', name: 'Do Zé', ownerIds: ['ZE'] }), { _sharedFrom: 'Zé', _cargo: 'Contabilista', _collabId: 'C9' }));
    app.pForm = casa;
    const chamadas = [];
    app.api = (method, p) => { chamadas.push(method + ' ' + p); return Promise.resolve({}); };
    return { app, esp, chamadas };
  }

  test('desligado: colaboradores — as funções da nuvem que pintam partilha e cargos devolvem vazio sem lançar, e a aterragem não gasta a ligação', () => {
    const { app, esp, chamadas } = montarNuvem();
    app.definirServicosDesligados(['colaboradores']);
    assert.ok(app.servicoLigado('properties') && app.servicoLigado('tenants') && app.servicoLigado('owners'), 'os outros ficam');
    for (const f of ['ligacaoCard', 'pedidosCard', 'cargosCard', 'convidarCard', 'colaboradoresCard', 'colaboroCard']) {
      assert.equal(app[f](), '', f + ' devolve vazio');
    }
    igual(app.pedidosRecebidos(), [], 'o sino não conta pedidos');
    const vc = app.vColaboradores();
    assert.match(vc, /Colaboradores está desligado nesta conta/);
    assert.ok(!/CW\.cargoModal|Convidar colaborador|Maria|CW\.sairDeImovel/.test(vc), 'a vista não traz os cartões');
    assert.match(app.vColabTab(), /desligado nesta conta/, 'o separador passa a mesma página');
    const conta = app.vCloud();
    assert.match(conta, /A minha conta/);
    assert.match(conta, /Apagar a conta/);
    assert.match(conta, /O serviço Colaboradores está desligado nesta conta\./);
    for (const t of ['Ligar a outro utilizador', 'Utilizadores ligados', 'Ainda não estás ligado', 'CW.ligacaoRodar()', 'CW.ligacaoCriar()', 'Pedidos de partilha', 'CW.pedidoAceitar']) {
      assert.ok(!conta.includes(t), 'Conta e partilha sem ' + t);
    }
    const bloco = app.cwOwnersBlock();
    assert.match(bloco, /Este imóvel é só teu/);
    assert.ok(!bloco.includes("go('colaboradores')") && !bloco.includes('Maria'), 'a ficha do imóvel não aponta para o separador');
    app.CW.aceitarConvite('c'.repeat(64));
    app.CW.pedirPartilha('d'.repeat(64), ['p1']);
    igual(chamadas, [], 'nada foi ao servidor');
    assert.equal(esp.toasts.filter((t) => t === 'O serviço Colaboradores está desligado nesta conta.').length, 2);
  });

  test('desligado: o controlo positivo — com tudo ligado, a lista, a ficha, o toque longo e a nuvem mostram tudo', () => {
    const { app, esp } = montarNuvem();
    igual(app.servicosDesligados(), []);
    const lista = app.vTenants();
    assert.match(lista, /Arrendamento da Ana/);
    assert.ok(lista.includes('lfsel_lten_ct') && lista.includes('Ordenar por renda'));
    const donos = app.vOwners();
    assert.match(donos, /T2 Porto/);
    assert.ok(donos.includes('lfsel_lown_p'));
    assert.match(app.personFicha('tenant', 't1'), /Mora em/);
    const fichaO = app.personFicha('owner', 'o1');
    assert.match(fichaO, /Imóveis e quota-parte/);
    assert.match(fichaO, /T2 Porto/);
    assert.match(fichaO, /Renda mensal que lhe toca/);
    app.personView('tenant', 't1');
    assert.ok(ultimo(esp.modais).menu.includes("ctView('c1')"), 'o «Ver contrato»');
    app.lpMenu('per:tenant:t1');
    assert.ok(ultimo(esp.folhas).labels.includes('Novo contrato'), ultimo(esp.folhas).labels.join(' | '));
    for (const [f, t] of [['ligacaoCard', 'CW.ligacaoRodar()'], ['pedidosCard', 'Ana quer partilhar T1 Braga contigo'], ['cargosCard', 'Gestor de visitas'],
      ['convidarCard', 'Convidar colaborador'], ['colaboradoresCard', 'Maria'], ['colaboroCard', "CW.sairDeImovel('C9')"]]) {
      assert.ok(app[f]().includes(t), f + ' traz ' + t);
    }
    assert.equal(app.pedidosRecebidos().length, 1);
    assert.match(app.vColaboradores(), /Convidar colaborador/);
    const conta = app.vCloud();
    assert.ok(conta.includes('Ligar a outro utilizador') && conta.includes('CW.ligacaoRodar()') && conta.includes('Pedidos de partilha'));
    assert.ok(!conta.includes('está desligado nesta conta'));
    const bloco = app.cwOwnersBlock();
    assert.ok(bloco.includes('Maria') && bloco.includes("go('colaboradores')"), 'a ficha do imóvel aponta para o separador');
  });
});
