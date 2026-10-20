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
    assert.ok(!html.includes('lfc_lten_ct'), 'nem o chip dele');
    assert.doesNotMatch(html, /id="pop_lfsel_lten_sb"[^]*?<span>Renda<\/span>/, 'sem a ordem por renda');
    assert.match(html, /<span class="small pes-sub">\+351 961 234 567 · ana@exemplo\.pt<\/span>/, 'a linha fica com o contacto');
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
    assert.ok(!html.includes('lfc_lown_pr') && !html.includes('lfc_lown_p"'), 'nem os chips deles');
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
    for (const x of SEM_CONTRATOS.concat(['Novo contrato', 'Ver contrato', 'Sem contrato'])) assert.ok(!ultimo(espT.modais).corpo.includes(x), 'corpo sem ' + x);
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
    assert.ok(!/def-voltar|def-nav/.test(vazio), 'é um ecrã das Pessoas: sem o Voltar nem a navegação das Definições');
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
    for (const t of SEM_CONTRATOS) assert.ok(!ultimo(esp.modais).menu.includes(t) && !ultimo(esp.modais).corpo.includes(t), 'ficha sem ' + t);
    assert.ok(!ultimo(esp.modais).menu.includes('Ver contrato') && !ultimo(esp.modais).corpo.includes('Ver contrato'));
    assert.ok(!html.includes('lfc_lten_ct'), 'nem o chip do filtro por contrato');
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

  test('o meu perfil edita-se mas não se apaga: nem no formulário, nem na ficha, nem no toque longo; outro proprietário sem conta apaga-se', () => {
    const { app, esp } = montar();
    app.db.owners.push(app.normPerson({ id: 'o2', name: 'Sem Conta' }));
    app.CW.user = { id: 'o1', name: 'Rui Dono', email: 'rui@exemplo.pt', token: 't' };
    app.personModal('owner', 'o1');
    assert.doesNotMatch(ultimo(esp.modais).menu, /Apagar|delPerson/, 'o formulário do meu perfil sem «Apagar»');
    app.personView('owner', 'o1');
    assert.doesNotMatch(ultimo(esp.modais).menu, /Apagar|delPerson/, 'a ficha também não');
    app.lpMenu('per:owner:o1');
    assert.ok(!ultimo(esp.folhas).labels.includes('Apagar'), ultimo(esp.folhas).labels.join(' | '));
    assert.equal(app.personApagavel('owner', app.db.owners[0]), false);
    // um proprietário com conta (ligado) também não: sai desfazendo a partilha
    assert.equal(app.personApagavel('owner', Object.assign(app.normPerson({ id: 'u9', name: 'Ligado' }), { _userId: 'u9' })), false);
    // controlo: um proprietário sem conta continua a ter o «Apagar»
    app.personModal('owner', 'o2');
    assert.match(ultimo(esp.modais).menu, /Apagar proprietário/);
    app.lpMenu('per:owner:o2');
    assert.ok(ultimo(esp.folhas).labels.includes('Apagar'));
    // e um inquilino também
    app.personModal('tenant', 't1');
    assert.match(ultimo(esp.modais).menu, /Apagar inquilino/);
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
    assert.ok(app.separadoresEscondidos().indexOf('colaboradores') > -1, 'desligado, sai do segmentado das Pessoas');
    app.tab = 'tenants';
    assert.doesNotMatch(app.abasDaArea(), /go\('colaboradores'\)/);
    const conta = app.vCloud();
    assert.match(conta, /A minha conta/);
    assert.match(conta, /Apagar a conta/);
    assert.match(conta, /O serviço Colaboradores está desligado nesta conta\./);
    for (const t of ['Ligar a outro utilizador', 'Utilizadores ligados', 'Ainda não estás ligado', 'CW.ligacaoRodar()', 'CW.ligacaoCriar()', 'Pedidos de partilha', 'CW.pedidoAceitar']) {
      assert.ok(!conta.includes(t), 'Conta e partilha sem ' + t);
    }
    const bloco = app.cwOwnersBlock();
    assert.match(bloco, /Este imóvel é só teu/);
    // o «Gerir» passa por cloud/utilizadores.js:cwGerirColaboradores (pergunta antes de sair de um formulário com alterações)
    assert.ok(!bloco.includes('cwGerirColaboradores()') && !bloco.includes("go('colaboradores')") && !bloco.includes('Maria'), 'a ficha do imóvel não aponta para o separador');
    app.CW.aceitarConvite('c'.repeat(64));
    app.CW.pedirPartilha('d'.repeat(64), ['p1']);
    igual(chamadas, [], 'nada foi ao servidor');
    assert.equal(esp.toasts.filter((t) => t === 'O serviço Colaboradores está desligado nesta conta.').length, 2);
  });

  test('desligado: o controlo positivo — com tudo ligado, a lista, a ficha, o toque longo e a nuvem mostram tudo', () => {
    const { app, esp } = montarNuvem();
    igual(app.servicosDesligados(), []);
    const lista = app.vTenants();
    assert.match(lista, /Mora em T2 Porto/, 'a linha diz onde mora, pelo contrato');
    assert.match(lista, /class="num pes-valor">700\s€</, 'e a renda à direita');
    assert.ok(lista.includes('lfsel_lten_ct'));
    assert.match(lista, /id="pop_lfsel_lten_sb"[^]*?<span>Renda<\/span>/, 'e a ordem por renda');
    assert.ok(lista.includes('id="lfc_lten_ct"'), 'e o chip do filtro rápido');
    const donos = app.vOwners();
    assert.match(donos, /T2 Porto/);
    assert.ok(donos.includes('lfsel_lown_p'));
    assert.ok(donos.includes('id="lfc_lown_pr"'));
    assert.match(app.personFicha('tenant', 't1'), /<h3>Mora em<\/h3>/);
    const fichaO = app.personFicha('owner', 'o1');
    assert.match(fichaO, /Imóveis e quota-parte/);
    assert.match(fichaO, /T2 Porto/);
    assert.match(fichaO, /Renda que lhe cabe/);
    app.personView('tenant', 't1');
    assert.ok(ultimo(esp.modais).corpo.includes("ctView('c1')"), 'o contrato abre-se do corpo da ficha');
    assert.ok(ultimo(esp.modais).corpo.includes("ctModal(null,null,'t1')"), 'e o «Novo contrato» já com a pessoa');
    app.lpMenu('per:tenant:t1');
    assert.ok(ultimo(esp.folhas).labels.includes('Novo contrato'), ultimo(esp.folhas).labels.join(' | '));
    for (const [f, t] of [['ligacaoCard', 'CW.ligacaoRodar()'], ['pedidosCard', 'Ana quer partilhar T1 Braga contigo'], ['cargosCard', 'Gestor de visitas'],
      ['convidarCard', 'Convidar colaborador'], ['colaboradoresCard', 'Maria'], ['colaboroCard', "CW.sairDeImovel('C9')"]]) {
      assert.ok(app[f]().includes(t), f + ' traz ' + t);
    }
    assert.equal(app.pedidosRecebidos().length, 1);
    assert.match(app.vColaboradores(), /Convidar colaborador/);
    app.tab = 'tenants';
    assert.match(app.abasDaArea(), /go\('colaboradores'\)">Colaboradores <span class="n">1<\/span>/, 'ligado e com sessão, os Colaboradores são o terceiro das Pessoas');
    const conta = app.vCloud();
    assert.ok(conta.includes('Ligar a outro utilizador') && conta.includes('CW.ligacaoRodar()') && conta.includes('Pedidos de partilha'));
    assert.ok(!conta.includes('está desligado nesta conta'));
    const bloco = app.cwOwnersBlock();
    assert.ok(bloco.includes('Maria') && bloco.includes('cwGerirColaboradores()'), 'a ficha do imóvel aponta para o separador');
  });
});

describe('o desenho: as listas e as fichas das pessoas lêem o que a app sabe', () => {
  /* O pedaço do HTML de uma lista que pertence à linha de uma pessoa: do
     data-lp dela até ao da seguinte.
     Recebe: html — a vista; kind — 'tenant' ou 'owner'; id — o id da pessoa.
     Devolve: o texto da linha ('' se não estiver lá). */
  const linhaDe = (html, kind, id) => html.split('data-lp="per:' + kind + ':').find((x) => x.startsWith(id + '"')) || '';

  /* a app inteira, sem sessão (tudo é «dono»), com a base das pessoas e as
     datas contadas a partir de hoje */
  function montarDesenho() {
    const app = carregarTudo();
    semear(app);
    const esp = espiar(app);
    const dia = (n) => app.pzAddDias(app.today(), n);
    return { app, esp, dia };
  }

  test('a lista dos inquilinos: o avatar, onde mora (ou vai morar, ou morou), a renda, os chips com quantos; sem FAB nem ⋮', () => {
    const { app, dia } = montarDesenho();
    app.db.properties.push(app.normProp({ id: 'p2', name: 'T3 Coimbra', use: 'investimento', rentalMode: 'quartos', rooms: [{ id: 'q1', name: 'Quarto 2' }], ownerIds: ['o1'] }));
    app.db.tenants.push(app.normPerson({ id: 't2', name: 'Rui Almeida' }), app.normPerson({ id: 't3', name: 'Sofia Lopes' }),
      app.normPerson({ id: 't4', name: 'Carla Mendes' }), app.normPerson({ id: 't5', name: 'Marta Silva', phone: '912000111' }));
    app.db.contracts.push(
      app.normContract({ id: 'c2', propertyId: 'p2', roomId: 'q1', tenantIds: ['t2'], rent: 425, start: dia(-100), active: true }),
      app.normContract({ id: 'c3', propertyId: 'p2', tenantIds: ['t3'], rent: 400, start: dia(40), active: true }),
      app.normContract({ id: 'c4', propertyId: 'p1', tenantIds: ['t4'], rent: 650, start: dia(-800), end: dia(-30), active: true }));
    const html = app.vTenants();
    assert.doesNotMatch(html, /class="fab"|lpMenu\(/, 'nem FAB nem ⋮: as opções estão na ficha e no toque longo');
    assert.match(html, /<div class="list pes-lista" data-listaviva="inquilinos">/, 'as linhas num cartão');
    const ana = linhaDe(html, 'tenant', 't1');
    assert.match(ana, /<span class="avatar pes-av" aria-hidden="true">AI<\/span>/, 'as iniciais');
    assert.match(ana, /<span class="small pes-sub">Mora em T2 Porto<\/span>/);
    assert.match(ana, /<span class="num pes-valor">700\s€<\/span>/);
    assert.match(linhaDe(html, 'tenant', 't2'), /<span class="small pes-sub">T3 Coimbra · Quarto 2<\/span>[\s\S]*425\s€/, 'num quarto, o quarto');
    const sofia = linhaDe(html, 'tenant', 't3');
    assert.ok(sofia.includes('Vai morar em T3 Coimbra a partir de ' + app.dPT(dia(40))), sofia);
    assert.match(sofia, /<span class="badge">Por começar<\/span>/);
    assert.doesNotMatch(sofia, /pes-av-sem/);
    const carla = linhaDe(html, 'tenant', 't4');
    assert.ok(carla.includes('Morou em T2 Porto até ' + app.dPT(dia(-30))), carla);
    assert.match(carla, /pes-av pes-av-sem/, 'sem contrato que conte, o avatar fica cinzento');
    assert.match(carla, /<span class="num pes-valor"><\/span>/, 'e sem renda');
    const marta = linhaDe(html, 'tenant', 't5');
    assert.match(marta, /<span class="small pes-sub">Sem contrato<\/span>/);
    assert.match(marta, /<span class="small pes-contacto">\+351 912 000 111<\/span>/, 'o contacto na coluna do computador');
    // o chip do contrato (vistas.js:lfCabeca): desligado diz o nome, e cada escolha diz quantos lhe cabem
    assert.match(html, /<span class="mov-chip"><div class="sel" id="sel_lfc_lten_ct">[\s\S]*?<span id="lab_lfc_lten_ct">Contrato<\/span>/);
    assert.match(html, /id="pop_lfc_lten_ct"[\s\S]*?<span>Todos os inquilinos<\/span>[\s\S]*?<span>Com contrato ativo · 2<\/span>[\s\S]*?<span>Com contrato por começar · 1<\/span>[\s\S]*?<span>Sem contrato · 2<\/span>/);
    // a escolha filtra logo, sem «Aplicar», e é o mesmo filtro do painel
    let pintou = 0;
    app.render = () => { pintou++; };
    app.pesFiltroRapido('lten', 'ct', 'sem');
    assert.equal(pintou, 1);
    assert.equal(app.lf('lten').ct, 'sem');
    const sem = app.vTenants();
    igual([...sem.matchAll(/data-lp="per:tenant:(\w+)"/g)].map((m) => m[1]), ['t4', 't5']);
    assert.match(sem, /<span class="mov-chip on"><div class="sel" id="sel_lfc_lten_ct">[\s\S]*?aria-label="Contrato: Sem contrato"[\s\S]*?<span id="lab_lfc_lten_ct">Sem contrato<\/span>/, 'ligado, diz o valor');
    assert.match(sem, /data-click="lfLimparCampo\('lten','ct'\)"/, 'com o × que o limpa');
  });

  test('a lista dos proprietários: os imóveis, a renda que lhe cabe, a conta de outro, e os chips com e sem imóveis', () => {
    const { app } = montarDesenho();
    app.db.owners.push(app.normPerson({ id: 'o2', name: 'Maria Costa' }), Object.assign(app.normPerson({ id: 'u9', name: 'Pedro Costa' }), { _userId: 'u9' }));
    const html = app.vOwners();
    assert.match(html, /<div class="list pes-lista" data-listaviva="proprietarios">/);
    assert.doesNotMatch(html, /class="fab"|lpMenu\(/);
    const rui = linhaDe(html, 'owner', 'o1');
    assert.match(rui, /<span class="small pes-sub">T2 Porto<\/span>/);
    assert.match(rui, /<span class="num pes-valor">700\s€<\/span>/, 'a renda que lhe cabe (100%)');
    assert.match(linhaDe(html, 'owner', 'o2'), /<span class="small pes-sub">Sem imóveis<\/span>/);
    assert.match(linhaDe(html, 'owner', 'u9'), /<span class="badge">Tem conta<\/span>/);
    assert.doesNotMatch(rui, /Tem conta/);
    assert.match(html, /id="pop_lfc_lown_pr"[\s\S]*?<span>Com imóveis · 1<\/span>[\s\S]*?<span>Sem imóveis · 2<\/span>/);
    app.lf('lown').pr = 'com';
    igual([...app.vOwners().matchAll(/data-lp="per:owner:(\w+)"/g)].map((m) => m[1]), ['o1']);
  });

  test('os selos do que pede atenção: a renda em atraso pelos Planeados, o cartão de cidadão pela janela dos prazos', () => {
    const { app, dia } = montarDesenho();
    const ana = app.db.tenants[0];
    const renda = { id: 'r1', auto: true, name: 'Renda', next: dia(-20), until: dia(-12), every: 'month', muted: false, tx: { kind: 'income', amount: 700, propertyId: 'p1', contractId: 'c1' } };
    app.db.recurring = [renda];
    ana.ccValid = dia(20);
    let lista = linhaDe(app.vTenants(), 'tenant', 't1');
    assert.match(lista, /<span class="badge red">Renda em atraso<\/span>/);
    assert.ok(lista.includes('<span class="badge amber">CC caduca a ' + app.pesDataCurta(dia(20)) + '</span>'), lista);
    let ficha = app.personFicha('tenant', 't1');
    assert.match(ficha, /<div class="pes-selos"><span class="badge in">Com contrato em vigor<\/span><span class="badge red">Renda em atraso<\/span>/, 'no topo da ficha');
    assert.match(ficha, /<b>T2 Porto<\/b>[\s\S]*?<span class="badge red">Renda em atraso<\/span>/, 'e na linha do contrato');
    // a janela ainda aberta: por confirmar, a cobalto, e a lista não diz nada
    Object.assign(renda, { next: dia(-2), until: dia(5) });
    assert.doesNotMatch(linhaDe(app.vTenants(), 'tenant', 't1'), /Renda/);
    assert.match(app.personFicha('tenant', 't1'), /<span class="badge">Renda por confirmar<\/span>/);
    // a próxima ainda não chegou: em dia
    Object.assign(renda, { next: dia(10), until: dia(17) });
    assert.match(app.personFicha('tenant', 't1'), /<span class="badge in">Renda em dia<\/span>/);
    // silenciada, ou sem os Planeados: não se diz nada
    renda.muted = true;
    assert.doesNotMatch(app.personFicha('tenant', 't1'), /Renda (em dia|em atraso|por confirmar)/);
    renda.muted = false;
    app.definirServicosDesligados(['recurring']);
    assert.doesNotMatch(app.personFicha('tenant', 't1'), /Renda (em dia|em atraso|por confirmar)/);
    app.definirServicosDesligados([]);
    // o cartão de cidadão: vermelho a sete dias e depois de caducar; nada fora da janela
    ana.ccValid = dia(5);
    assert.match(linhaDe(app.vTenants(), 'tenant', 't1'), /<span class="badge red">CC caduca a /);
    ana.ccValid = dia(-3);
    assert.match(linhaDe(app.vTenants(), 'tenant', 't1'), /<span class="badge red">CC caducou a /);
    ana.ccValid = dia(90);
    assert.doesNotMatch(linhaDe(app.vTenants(), 'tenant', 't1'), /CC cad/);
    // um inquilino sem contrato que conte não é avisado (o critério do «Pede atenção»)
    ana.ccValid = dia(20);
    app.db.contracts[0].end = dia(-1);
    assert.doesNotMatch(linhaDe(app.vTenants(), 'tenant', 't1'), /CC cad/);
    // um proprietário é, e fora dos 30 dias o selo é cinzento
    app.db.owners[0].ccValid = dia(45);
    assert.match(linhaDe(app.vOwners(), 'owner', 'o1'), /<span class="badge grey">CC caduca a /);
  });

  test('a ficha do inquilino lê-se primeiro: o selo, as ações rápidas, onde mora, os contactos que tocam, a identificação, os documentos e as notas — sem campos', () => {
    const { app } = montarDesenho();
    Object.assign(app.db.tenants[0], { nif: '123456789', cc: '123456789ZX4', birth: '1991-06-12', marital: 'Solteiro(a)', gender: 'f',
      taxAddress: 'Rua A 1\n1000-001 Lisboa', notes: 'Fiador: o pai', files: [app.normFile({ id: 'f1', name: 'CC.pdf', size: 421888, type: 'application/pdf' })] });
    const f = app.personFicha('tenant', 't1');
    assert.match(f, /<p class="pes-papel">Inquilino<\/p><div class="pes-selos"><span class="badge in">Com contrato em vigor<\/span>/);
    assert.match(f, /<span class="avatar pes-av pes-av-g" aria-hidden="true">AI<\/span>/);
    assert.match(f, /<div class="chips-fila pes-acoes"[^>]*><button type="button" class="chip" data-toca="camada" data-click="ctView\('c1'\)">[\s\S]*? Ver contrato<\/button><button type="button" class="chip" data-toca="camada" data-click="ctModal\(null,null,'t1'\)">/);
    assert.match(f, /<h3>Mora em<\/h3><\/div><div class="pes-linha-f tap" data-toca="camada" data-click="ctView\('c1'\)">/);
    assert.ok(f.includes('<b>T2 Porto</b><span class="small num">desde 01/01/2026</span>'), 'onde e desde quando');
    assert.match(f, /700,00\s€<span class="small">\/mês<\/span>/);
    assert.match(f, /<a class="pes-kv pes-liga" href="tel:\+351961234567" data-toca="nada"><span>Telemóvel<\/span><span>\+351 961 234 567<\/span><\/a>/, 'o telemóvel liga');
    assert.match(f, /<a class="pes-kv pes-liga" href="mailto:ana@exemplo\.pt" data-toca="nada"><span>Email<\/span>/, 'o email escreve');
    assert.match(f, /<span>Data de nascimento<\/span><span>12\/06\/1991<\/span>/);
    assert.match(f, /<span>Estado civil<\/span><span>Solteira<\/span>/, 'o estado civil com o género da ficha');
    assert.match(f, /<span>Morada fiscal<\/span><span>Rua A 1<br>1000-001 Lisboa<\/span>/);
    assert.match(f, /data-click="openMeta\('f1'\)">[\s\S]*?<b>CC\.pdf<\/b><\/span><span class="small num">412 KB<\/span>/, 'o documento abre, com o tamanho');
    assert.match(f, /<h3>Documentos<\/h3><span class="small num">1<\/span>/);
    assert.match(f, /data-toca="dados" data-click="pesEscolherDocs\('t1'\)">[\s\S]*? Adicionar documentos<\/button>/);
    assert.match(f, /<div class="pes-texto rich">Fiador: o pai<\/div>/);
    const ordem = ['<h3>Mora em', '<h3>Contactos', '<h3>Identificação', '<h3>Documentos', '<h3>Notas'].map((t) => f.indexOf(t));
    assert.ok(ordem.every((x, i) => x > -1 && (!i || x > ordem[i - 1])), 'pela ordem do canvas: ' + ordem);
    assert.doesNotMatch(f, /<input|<textarea|<select/, 'uma ficha lê-se, não se edita');
    // quem não pode alterar a ficha não tem o «Adicionar documentos»
    app.podeEditarInquilino = () => false;
    assert.doesNotMatch(app.personFicha('tenant', 't1'), /pesEscolherDocs/);
    // um cargo sem «ver inquilinos» fica com o nome e a nota do cargo — e não com «só tem o nome»
    app.pode = (pid, perm) => perm !== 'tenant.view';
    const so = app.personFicha('tenant', 't1');
    assert.match(so, /O teu cargo mostra só o nome desta pessoa\./);
    assert.doesNotMatch(so, /Esta ficha só tem o nome|Telemóvel|NIF|Fiador|CC\.pdf/);
  });

  test('a ficha do proprietário: as contas com o plano de acerto, a quota-parte com a renda que lhe cabe, e o atalho para a quota dele', () => {
    const { app, esp } = montarDesenho();
    assert.doesNotMatch(app.personFicha('owner', 'o1'), /pesVerNaQuota/, 'dono de tudo a 100%: a app na quota dele é a app como está');
    app.db.owners.push(app.normPerson({ id: 'o2', name: 'Maria Costa' }));
    Object.assign(app.db.properties[0], { ownerIds: ['o1', 'o2'], ownerShares: { o1: 40, o2: 60 } });
    app.db.transactions.push(app.normTx({ id: 'x1', kind: 'expense', label: 'Obras', amount: 1000, date: '2026-02-01', propertyId: 'p1', paidBy: 'o2' }));
    const f = app.personFicha('owner', 'o1');
    assert.match(f, /<p class="pes-papel">Proprietário<\/p>/);
    assert.match(f, /<section class="card pes-contas out">[\s\S]*?A pagar 400,00\s€[\s\S]*?Plano: Rui paga 400,00\s€ a Maria\.[\s\S]*?data-click="settleModal\(null\)">Acertar contas<\/button>/);
    assert.match(f, /data-click="propView\('p1'\)">\s*<span class="pes-forte">T2 Porto<\/span><span>40%/);
    assert.match(f, /<span>Renda que lhe cabe<\/span><span><b>280,00\s€<\/b>\/mês<\/span>/, '700 € na quota de 40%');
    assert.match(f, /data-toca="ecra" data-click="pesVerNaQuota\('o1'\)">[\s\S]*? Ver a app na quota de Rui<\/button>/);
    assert.match(app.personFicha('owner', 'o2'), /<section class="card pes-contas in">[\s\S]*?A receber 400,00\s€/);
    // o atalho põe o proprietário em foco e leva à Visão geral
    let foi = '';
    app.go = (t) => { foi = t; };
    app.buildNav = () => {};
    app.pesVerNaQuota('o1');
    assert.equal(app.ownerFilter, 'o1');
    assert.equal(foi, 'dashboard');
    app.ownerFilter = '';
    // outro proprietário com conta: a nota de quem manda no perfil, e sem «Editar»
    app.db.owners.push(Object.assign(app.normPerson({ id: 'u9', name: 'Pedro Costa', phone: '917330482' }), { _userId: 'u9' }));
    const pedro = app.personFicha('owner', 'u9');
    assert.match(pedro, /<span class="badge">Tem conta Rendorium<\/span>/);
    assert.match(pedro, /<div class="pes-nota">[\s\S]*?só quem tem a conta o edita\. Para o remover das casas, desfaz a partilha em Conta e partilha\./);
    assert.match(pedro, /<h3>Contactos e identificação<\/h3>/);
    app.personView('owner', 'u9');
    assert.doesNotMatch(ultimo(esp.modais).rodape, /personModal|Editar/);
  });

  test('«Adicionar documentos» junta os ficheiros à ficha do inquilino e grava', async () => {
    const { app, esp } = montarDesenho();
    let gravou = 0;
    app.save = () => { gravou++; };
    app.render = () => {};
    app.takeFiles = () => Promise.resolve([app.normFile({ id: 'f9', name: 'Recibo.pdf', size: 2048 })]);
    app.pesJuntarDocs('t1', {});
    await new Promise((r) => setTimeout(r, 0));
    igual(app.db.tenants[0].files.map((f) => f.id), ['f9']);
    assert.equal(gravou, 1);
    assert.equal(ultimo(esp.toasts), 'Documento adicionado.');
  });

  test('o toque longo segue o «Editar» da ficha: o perfil de outro proprietário com conta não se edita, o meu abre «O meu perfil»', () => {
    const { app, esp } = montarDesenho();
    /* o toque longo devolve as opções inteiras (com o act), não só os rótulos */
    const opcoes = [];
    app.lpShow = (t, opts) => { opcoes.push({ titulo: t, opts }); };
    app.db.owners.push(app.normPerson({ id: 'o2', name: 'Sem Conta' }), Object.assign(app.normPerson({ id: 'u9', name: 'Pedro Costa' }), { _userId: 'u9' }));
    app.CW.user = { id: 'o1', name: 'Rui Dono', email: 'rui@exemplo.pt', token: 't' };
    let perfil = 0;
    app.CW.editProfile = () => { perfil++; };
    // outro proprietário com conta: nem «Editar ficha» nem «Apagar» — sem
    // opções nenhumas, o aviso diz de quem é o perfil (não que é o cargo)
    app.lpMenu('per:owner:u9');
    const pedro = opcoes.filter((o) => o.titulo === 'Pedro Costa').flatMap((o) => o.opts.map((x) => x.label));
    assert.ok(!pedro.includes('Editar ficha') && !pedro.includes('Apagar'), pedro.join(' | '));
    assert.deepEqual(pedro, [], 'nenhum serviço acrescenta opções a um proprietário');
    assert.equal(ultimo(esp.toasts), 'Este perfil é de Pedro Costa, que tem conta: só quem tem a conta o edita.');
    // e o formulário dele, chamado por outra porta, dá a ficha de leitura
    const antes = esp.modais.length;
    app.personModal('owner', 'u9');
    assert.equal(esp.modais.length, antes + 1);
    assert.equal(ultimo(esp.modais).titulo, 'Pedro Costa', 'a ficha, não «Editar proprietário»');
    assert.doesNotMatch(ultimo(esp.modais).corpo, /id="pe_name"/, 'sem campos');
    // o meu perfil: «Editar ficha» vai ao editProfile da nuvem
    app.lpMenu('per:owner:o1');
    const eu = ultimo(opcoes).opts.find((o) => o.label === 'Editar ficha');
    assert.ok(eu, 'o meu perfil edita-se');
    const nModais = esp.modais.length;
    eu.act();
    assert.equal(perfil, 1, 'pelo «O meu perfil»');
    assert.equal(esp.modais.length, nModais, 'e não pelo formulário local');
    // controlo: um proprietário sem conta continua a abrir o formulário local
    app.lpMenu('per:owner:o2');
    ultimo(opcoes).opts.find((o) => o.label === 'Editar ficha').act();
    assert.equal(ultimo(esp.modais).titulo, 'Editar proprietário');
    assert.equal(perfil, 1);
  });

  test('a validade do cartão de cidadão lê-se na identificação mesmo sem o número', () => {
    const { app, dia } = montarDesenho();
    const ana = app.db.tenants[0];
    ana.ccValid = dia(400);
    let f = app.personFicha('tenant', 't1');
    assert.ok(f.includes('<span>Cartão de Cidadão</span><span><span class="small">válido até ' + app.dPT(dia(400)) + '</span></span>'), 'a linha existe só com a validade');
    ana.ccValid = dia(-3);
    f = app.personFicha('tenant', 't1');
    assert.ok(f.includes('<span>Cartão de Cidadão</span><span><span class="small">caducou a ' + app.dPT(dia(-3)) + '</span></span>'), 'e diz que caducou');
    // com o número, o número e por baixo a validade
    ana.cc = '123456789ZX4';
    assert.match(app.personFicha('tenant', 't1'), /<span>Cartão de Cidadão<\/span><span>[^<]+<span class="small">caducou a /);
    // sem nenhum dos dois, a linha não existe
    ana.cc = ''; ana.ccValid = '';
    assert.doesNotMatch(app.personFicha('tenant', 't1'), /Cartão de Cidadão/);
  });
});
