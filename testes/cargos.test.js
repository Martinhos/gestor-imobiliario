// Colaboradores com cargos, do lado da app: quem pode o quê em cada imóvel,
// o que se esconde, e a garantia de que um colaborador nunca parte as contas
// entre proprietários. As decisões vivem em web/app/acessos.js (puro) e
// testam-se aqui sem a camada da nuvem: a sessão simula-se com window.CW.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { carregarApp, limpar, igual } from './arnes.js';

const require = createRequire(import.meta.url);
const acessos = require('../web/app/acessos.js');
const app = carregarApp();
const lpShowReal = app.lpShow;   // guardado antes de qualquer stub

const GESTOR = ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'];
const CONTAB = ['tx.view', 'tx.add', 'rec.view', 'rec.add', 'contract.view', 'loan.view', 'file.view', 'file.add', 'report.view'];

// uma sessão com o meu id e os cargos por casa; sem argumentos, sem sessão
function sessao(cargos, pessoas, id) {
  app.window.CW = cargos ? { user: { id: id || 'eu' }, cargos, pessoas: pessoas || {} } : undefined;
}
// três imóveis: o meu, um onde sou contabilista e um onde só marco visitas
function tresCasas() {
  limpar(app);
  app.db.properties = [
    app.normProp({ id: 'P1', name: 'T1 Meu', value: 100000, ownerIds: ['eu'] }),
    Object.assign(app.normProp({ id: 'P2', name: 'T2 Rui', value: 200000, ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui', _cargo: 'Contabilista' }),
    Object.assign(app.normProp({ id: 'P3', name: 'T3 Rui', value: 300000, ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui', _cargo: 'Gestor de visitas' }),
  ];
  app.db.owners = [app.normPerson({ id: 'eu', name: 'Eu' }), Object.assign(app.normPerson({ id: 'rui', name: 'Rui' }), { _userId: 'rui' })];
  sessao({ P2: { dono: false, nome: 'Contabilista', perms: CONTAB }, P3: { dono: false, nome: 'Gestor de visitas', perms: GESTOR } });
}

describe('as permissões e as suas implicações', () => {
  test('adicionar implica ver, em cadeia', () => {
    assert.equal(app.temPerm(['tx.add'], 'tx.view'), true);
    assert.equal(app.temPerm(['contract.add'], 'rec.view'), true, 'contract.add → rec.add → rec.view');
    assert.equal(app.temPerm(['house.edit'], 'loan.view'), true);
    assert.equal(app.temPerm(['house.edit'], 'file.view'), true);
    assert.equal(app.temPerm(['tx.view'], 'tx.add'), false, 'ver nunca dá adicionar');
    assert.equal(app.temPerm({ 'visit.add': true }, 'visit.view'), true, 'aceita um objeto');
    assert.equal(app.temPerm([], 'tx.view'), false);
  });

  test('a lista canónica tem as quinze chaves e cada uma tem rótulo', () => {
    assert.equal(acessos.PERMS.length, 15);
    acessos.PERMS.forEach((k) => assert.ok(acessos.ROTULOS[k] && acessos.ROTULOS[k].rotulo, k));
    Object.keys(acessos.IMPLICA).forEach((k) => {
      assert.ok(acessos.PERMS.includes(k), k);
      acessos.IMPLICA[k].forEach((x) => assert.ok(acessos.PERMS.includes(x), x));
    });
    acessos.CARGOS_EXEMPLO.forEach((c) => c.perms.forEach((k) => assert.ok(acessos.PERMS.includes(k), c.nome + ': ' + k)));
  });

  const PERMISSOES = new URL('../worker/src/lib/permissoes.js', import.meta.url);
  const ha = existsSync(PERMISSOES);
  test('é a mesma do servidor (worker/src/lib/permissoes.js)', { skip: ha ? false : 'o ficheiro do servidor ainda não existe' }, async () => {
    const srv = await import(PERMISSOES.href);
    const lista = (x) => (Array.isArray(x) ? x : x instanceof Set ? Array.from(x) : Object.keys(x || {})).slice().sort();
    assert.ok(srv.PERMS, 'o servidor exporta PERMS');
    assert.deepEqual(lista(srv.PERMS), acessos.PERMS.slice().sort(), 'PERMS iguais nos dois lados');
    if (srv.KIND_PERM) assert.deepEqual(srv.KIND_PERM, acessos.KIND_PERM, 'KIND_PERM igual');
    if (srv.CARGOS_EXEMPLO) {
      const norm = (cs) => cs.map((c) => ({ nome: c.nome || c.name, perms: lista(c.perms) }));
      assert.deepEqual(norm(srv.CARGOS_EXEMPLO), norm(acessos.CARGOS_EXEMPLO), 'CARGOS_EXEMPLO iguais');
    }
    // as implicações: o fecho de cada permissão e de cada cargo tem de dar o mesmo
    const fecho = (ps) => Array.from(acessos.fechoPerms(ps)).sort();
    if (typeof srv.normalizarPerms === 'function') {
      acessos.PERMS.forEach((k) => assert.deepEqual(lista(srv.normalizarPerms([k])), fecho([k]), 'fecho de ' + k));
      acessos.CARGOS_EXEMPLO.forEach((c) => assert.deepEqual(lista(srv.normalizarPerms(c.perms)), fecho(c.perms), c.nome));
    } else if (srv.IMPLICA) {
      const norm = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, lista(o[k])]));
      assert.deepEqual(norm(srv.IMPLICA), norm(acessos.IMPLICA), 'IMPLICA igual');
    }
  });
});

describe('posso X nesta casa?', () => {
  test('sem sessão, tudo é dono', () => {
    tresCasas(); sessao();
    assert.equal(app.pode('P3', 'tx.add'), true);
    assert.equal(app.souDono('P3'), true);
    assert.equal(app.souCriador('P3'), true);
    assert.equal(app.souSoColaborador(), false);
    assert.equal(app.casasComo('house.edit').length, 3);
  });

  test('com sessão, o cargo manda; um imóvel fora de CW.cargos é meu', () => {
    tresCasas();
    assert.equal(app.pode('P1', 'house.edit'), true, 'não está em cargos: dono');
    assert.equal(app.pode('P2', 'tx.add'), true);
    assert.equal(app.pode('P2', 'rec.view'), true, 'por implicação');
    assert.equal(app.pode('P2', 'visit.add'), false);
    assert.equal(app.pode('P2', 'house.edit'), false);
    assert.equal(app.pode('P3', 'tx.view'), false);
    assert.equal(app.pode('P3', 'visit.add'), true);
    assert.equal(app.pode('P2', 'apagar_imovel'), false, 'permissão desconhecida nunca');
    assert.equal(app.pode(null, 'tx.add'), true, 'sem imóvel é meu');
    assert.equal(app.souDono('P1'), true);
    assert.equal(app.souDono('P2'), false);
    assert.deepEqual(app.casasComo('tx.add').map((p) => p.id), ['P1', 'P2']);
    assert.deepEqual(app.casasComo('visit.add').map((p) => p.id), ['P1', 'P3']);
    assert.deepEqual(app.casasDeColaboracao().map((p) => p.id), ['P2', 'P3']);
    assert.equal(app.souSoColaborador(), false, 'tenho o P1');
    assert.equal(app.podeSemImovel(), true);
  });

  test('um comproprietário é dono mas não criador; só quem criou apaga', () => {
    tresCasas();
    app.window.CW.cargos.P1 = { dono: true, criador: false };
    assert.equal(app.souDono('P1'), true);
    assert.equal(app.souCriador('P1'), false);
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.delProp('P1');
    assert.match(msg, /Só quem criou o imóvel/);
    assert.equal(app.db.properties.length, 3, 'nada foi apagado');
  });

  test('só colaborador: sem imóveis meus, e nada sem imóvel', () => {
    tresCasas();
    app.window.CW.cargos.P1 = { dono: false, nome: 'Ver tudo', perms: ['tx.view'] };
    assert.equal(app.souSoColaborador(), true);
    assert.equal(app.podeSemImovel(), false);
    limpar(app);
    assert.equal(app.souSoColaborador(), false, 'sem imóveis nenhuns não é «só colaborador»');
  });

  test('editar e apagar é só o que eu adicionei; a recusa tem frase', () => {
    tresCasas();
    const meu = { _createdBy: 'eu' }, dele = { _createdBy: 'rui' }, semMarca = {};
    assert.equal(app.podeEditar('P2', 'tx.add', meu), true);
    assert.equal(app.podeEditar('P2', 'tx.add', dele), false);
    assert.equal(app.podeEditar('P2', 'tx.add', semMarca), true, 'sem marca deixa-se passar — o servidor decide');
    assert.equal(app.podeEditar('P1', 'tx.add', dele), true, 'no meu imóvel edito tudo');
    assert.equal(app.motivoRecusa('P2', 'tx.add', meu), '');
    assert.match(app.motivoRecusa('P2', 'tx.add', dele), /Só quem o adicionou/);
    assert.equal(app.motivoRecusa('P3', 'tx.add'), 'Não tens permissão para adicionar movimentos neste imóvel — pede ao dono.');
    assert.equal(app.fraseSemPerm('visit.add'), 'Não tens permissão para marcar visitas neste imóvel — pede ao dono.');
  });

  test('o seletor de imóvel lista onde posso adicionar, mais o já escolhido', () => {
    tresCasas();
    assert.deepEqual(app.propOptsPara('tx.add').map((o) => o.v), ['P1', 'P2']);
    assert.deepEqual(app.propOptsPara('tx.add', 'P3').map((o) => o.v), ['P1', 'P2', 'P3'], 'um registo antigo não fica sem casa');
  });
});

describe('o colaborador não parte as contas', () => {
  test('nunca está em ownerIds; o dono do imóvel não entra nas minhas contas globais', () => {
    tresCasas();
    assert.deepEqual(app.ownersOfProp(app.prop('P2')), ['rui']);
    assert.deepEqual(app.propsOf('eu').map((p) => p.id), ['P1']);
    assert.equal(app.ownerNames(app.prop('P2')), 'Rui');
    assert.deepEqual(app.donosGlobais().map((o) => o.id), ['eu'], 'o Rui só é dono onde eu colaboro');
    app.db.properties[0].ownerIds = ['eu', 'rui'];
    assert.deepEqual(app.donosGlobais().map((o) => o.id), ['eu', 'rui'], 'comproprietário de um imóvel meu conta');
  });

  test('as contas entre proprietários ignoram os imóveis onde só colaboro', () => {
    tresCasas();
    app.db.owners.push(Object.assign(app.normPerson({ id: 'ze', name: 'Zé' }), { _userId: 'ze' }));
    app.db.properties[1].ownerIds = ['rui', 'ze'];
    app.db.transactions = [app.normTx({ id: 'T1', kind: 'expense', label: 'Condomínio', amount: 300, date: '2026-03-01', propertyId: 'P2', paidBy: 'rui' })];
    igual(app.ownerBalances('P2'), {}, 'nada a contar num imóvel de colaboração');
    igual(app.ownerBalances(null), {});
    assert.equal(app.balanceLines('P2').length, 0);
    assert.equal(app.balancesCard('P2'), '');
    assert.equal(app.propDebt('P2'), 0);
    // o mesmo imóvel visto pelo dono tem contas
    sessao();
    assert.ok(Object.keys(app.ownerBalances('P2')).length === 2, 'para o dono há saldos');
    assert.match(app.balancesCard('P2'), /Contas entre proprietários/);
  });

  test('acertar contas num imóvel de colaboração recusa', () => {
    tresCasas();
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.settleModal('P2');
    assert.match(msg, /só o dono as acerta/);
    assert.equal(app.settleTargets(null).some((x) => x.pid === 'P2'), false);
  });
});

describe('o âmbito financeiro', () => {
  test('visiveis() tem tudo; scope() só onde o cargo abre as finanças', () => {
    tresCasas();
    assert.equal(app.visiveis().length, 3);
    assert.deepEqual(app.scope().map((p) => p.id), ['P1', 'P2'], 'o P3 só dá visitas');
    assert.equal(app.metrics(app.YEAR, null, { share: true }).props.length, 2);
    assert.equal(app.metrics(app.YEAR, null, { share: true }).value, 300000, 'o T3 não soma');
    sessao();
    assert.equal(app.scope().length, 3);
  });

  test('a Avaliação só lista onde há report.view', () => {
    tresCasas();
    app.repProp = '';
    const html = app.vReports();
    assert.match(html, /T2 Rui/);
    assert.doesNotMatch(html, /T3 Rui/);
  });

  test('a vista geral diz que inclui os imóveis onde colaboro, por inteiro', () => {
    tresCasas();
    app.db.settings.notifLidoAte = 1;
    const html = app.vDashboard();
    assert.match(html, /Inclui 1 imóvel onde és colaborador \(valores por inteiro\)/);
  });

  test('quem só colabora sem finanças vê o vazio com o botão para os imóveis', () => {
    tresCasas();
    app.window.CW.cargos.P1 = { dono: false, nome: 'Gestor de visitas', perms: GESTOR };
    app.window.CW.cargos.P2 = { dono: false, nome: 'Gestor de visitas', perms: GESTOR };
    app.db.properties[0]._sharedFrom = 'Rui';
    const html = app.vDashboard();
    assert.match(html, /És colaborador de Rui em 3 imóveis como Gestor de visitas\./);
    assert.match(html, /Ver os imóveis/);
    assert.equal(app.fraseColaborador(), 'És colaborador de Rui em 3 imóveis como Gestor de visitas.');
  });

  test('o resumo junta donos e cargos sem repetir', () => {
    tresCasas();
    app.db.properties[2]._sharedFrom = 'Ana';
    app.window.CW.cargos.P3.nome = 'Ver tudo';
    const r = app.resumoColaborador();
    assert.equal(r.n, 2);
    assert.deepEqual(Array.from(r.donos), ['Rui', 'Ana']);
    assert.deepEqual(Array.from(r.cargos), ['Contabilista', 'Ver tudo']);
    assert.equal(app.listaE(['A', 'B', 'C']), 'A, B e C');
  });
});

describe('o que se esconde', () => {
  // o menu do toque longo devolve as opções em vez de abrir a folha
  function menuDe(v) {
    let opts = null, msg = '';
    app.lpShow = (t, o) => { opts = o; };
    app.toast = (m) => { msg = m; };
    app.lpMenu(v);
    return { labels: opts ? opts.map((o) => o.label) : null, msg };
  }

  test('o menu do imóvel filtra por permissão', () => {
    tresCasas();
    const cont = menuDe('prop:P2').labels;
    assert.ok(cont.includes('Ver imóvel') && cont.includes('Registar despesa'), cont.join(', '));
    assert.ok(!cont.includes('Editar imóvel') && !cont.includes('Apagar imóvel') && !cont.includes('Novo contrato'), cont.join(', '));
    const meu = menuDe('prop:P1').labels;
    assert.ok(meu.includes('Editar imóvel') && meu.includes('Apagar imóvel'), meu.join(', '));
  });

  test('contratos e movimentos: ver, ou editar só o que é meu', () => {
    tresCasas();
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P3', rent: 500, tenantIds: [] }), app.normContract({ id: 'C2', propertyId: 'P1', rent: 500, tenantIds: [] })];
    const c1 = menuDe('ct:C1').labels;
    assert.ok(c1.includes('Ver contrato') && !c1.includes('Apagar contrato') && !c1.includes('Registar renda'), c1.join(', '));
    assert.ok(menuDe('ct:C2').labels.includes('Apagar contrato'));
    const t1 = app.normTx({ id: 'T1', label: 'Obra', propertyId: 'P2', amount: 10 }); t1._createdBy = 'rui';
    const t2 = app.normTx({ id: 'T2', label: 'Luz', propertyId: 'P2', amount: 10 }); t2._createdBy = 'eu';
    app.db.transactions = [t1, t2];
    const m1 = menuDe('tx:T1').labels;
    assert.ok(m1.includes('Ver movimento') && !m1.includes('Apagar movimento'), m1.join(', '));
    const m2 = menuDe('tx:T2').labels;
    assert.ok(m2.includes('Editar movimento') && m2.includes('Apagar movimento'), m2.join(', '));
  });

  test('sem nenhuma ação, o toque longo diz que só posso ver', () => {
    tresCasas();
    app.db.recurring = [app.normRec({ id: 'R1', name: 'Renda', next: '2000-01-01', tx: { kind: 'income', propertyId: 'P3', amount: 500 } })];
    const r = menuDe('rec:R1');
    assert.deepEqual(Array.from(r.labels), [], 'nenhuma ação');
    // o lpShow a sério com lista vazia é que avisa, em vez de abrir uma folha vazia
    let msg = '', abriu = false;
    app.lpShow = lpShowReal;
    app.closeAllModals = () => {};
    app.pickModal = () => { abriu = true; };
    app.toast = (m) => { msg = m; };
    app.lpMenu('rec:R1');
    assert.match(msg, /Só podes ver este registo/);
    assert.equal(abriu, false);
  });

  test('o cartão do imóvel só tem os chips que o cargo abre, e o selo do cargo', () => {
    tresCasas();
    app.db.properties[0]._colaboradores = [{ userId: 'ana', name: 'Ana', roleName: 'Contabilista' }];
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P3', rent: 500, tenantIds: [], start: '2020-01-01' })];
    const html = app.vProperties();
    // o cartão de um imóvel: do seu data-lp até ao data-lp seguinte
    const cartao = (id) => { const i = html.indexOf('data-lp="prop:' + id + '"'), j = html.indexOf('data-lp="prop:', i + 1); return html.slice(i, j < 0 ? undefined : j); };
    const t3 = cartao('P3');
    assert.doesNotMatch(t3, /Yield|Valor |Dívida|Arrendado|Vago/);
    assert.match(t3, /de Rui · Gestor de visitas/);
    assert.match(t3, /cw-shared/, 'a nuvem não pendura outro selo por cima');
    const t2 = cartao('P2');
    assert.match(t2, /Valor 200/);
    assert.match(t2, /de Rui · Contabilista/);
    const t1 = cartao('P1');
    assert.match(t1, /1 colaborador</);
    assert.doesNotMatch(t1, /cw-shared/);
  });

  test('a gaveta esconde os separadores que o cargo não abre a quem só colabora', () => {
    tresCasas();
    const nav = app.document.createElement('div'), tb = app.document.createElement('div');
    app.document.getElementById = (id) => (id === 'nav' ? nav : id === 'tabbar' ? tb : app.document.createElement('div'));
    app.buildNav();
    assert.match(nav.innerHTML, /Créditos/, 'com um imóvel meu, tudo à vista');
    assert.deepEqual(Array.from(app.separadoresEscondidos()), []);
    app.window.CW.cargos.P1 = { dono: false, nome: 'Gestor de visitas', perms: GESTOR };
    app.window.CW.cargos.P2 = { dono: false, nome: 'Gestor de visitas', perms: GESTOR };
    const fora = Array.from(app.separadoresEscondidos());
    ['credits', 'projections', 'reports', 'transactions', 'recurring', 'contracts'].forEach((id) => assert.ok(fora.includes(id), id));
    assert.ok(!fora.includes('visits') && !fora.includes('properties'));
    app.buildNav();
    assert.doesNotMatch(nav.innerHTML, /Créditos|Projeções|Avaliação|Movimentos/);
    assert.match(nav.innerHTML, /Visitas/);
    assert.doesNotMatch(tb.innerHTML, /Movimentos/);
    assert.match(tb.innerHTML, /Imóveis/);
    assert.deepEqual(Array.from(app.TABBAR), ['dashboard', 'transactions', 'properties', 'calendar'], 'a constante não muda');
  });

  test('o FAB de novo movimento só existe onde posso adicionar', () => {
    tresCasas();
    app.db.transactions = [app.normTx({ id: 'T1', label: 'Luz', propertyId: 'P1', amount: 10 })];
    assert.match(app.vTransactions(), /class="fab"/);
    app.window.CW.cargos.P1 = { dono: false, nome: 'Gestor de visitas', perms: GESTOR };
    app.window.CW.cargos.P2 = { dono: false, nome: 'Gestor de visitas', perms: GESTOR };
    assert.doesNotMatch(app.vTransactions(), /class="fab"/);
    assert.doesNotMatch(app.vContracts(), /class="fab"/);
  });

  test('a ficha de um imóvel de colaboração abre só de leitura', () => {
    tresCasas();
    let aberto = null;
    app.openModal = (t, b, f) => { aberto = { t, b, f }; };
    app.paintThumbs = () => {};
    app.propModal('P2');
    assert.equal(aberto.t, 'T2 Rui');
    assert.match(aberto.b, /És colaborador como <b>Contabilista<\/b>/);
    assert.match(aberto.b, /Valor de mercado/, 'o contabilista vê valores');
    assert.doesNotMatch(aberto.b, /p_name/, 'não é o formulário');
    assert.match(aberto.f, /Fechar/);
    app.propModal('P3');
    assert.doesNotMatch(aberto.b, /Valor de mercado/, 'o gestor de visitas não');
  });

  test('guardar sem permissão recusa com a frase, antes de gravar', () => {
    tresCasas();
    let msg = '';
    app.toast = (m) => { msg = m; };
    // uma camada falsa na pilha, para o onSave ter onde pousar
    app.openModal = () => { app.modalStack.push({ el: app.document.createElement('div'), onSave: null }); };
    app.closeModal = () => {}; app.render = () => {}; app.buildNav = () => {};
    // uma visita num imóvel onde sou contabilista
    app.visitModal(null, { propertyId: 'P2', nomes: 'Ana' });
    app.visColhe = () => {};
    app.onSave();
    assert.equal(msg, 'Não tens permissão para marcar visitas neste imóvel — pede ao dono.');
    assert.equal((app.db.visits || []).length, 0);
  });
});

describe('nomes, estado e a porta do URL', () => {
  test('nomeUtilizador: proprietários, depois as pessoas do estado, depois o id curto', () => {
    tresCasas();
    app.window.CW.pessoas = { ana: { name: 'Ana', kind: 'collab', roleName: 'Contabilista' } };
    assert.equal(app.nomeUtilizador('rui'), 'Rui');
    assert.equal(app.nomeUtilizador('ana'), 'Ana');
    assert.equal(app.nomeUtilizador('3F9K2A1BXYZ'), '3F9K2A1B');
    assert.equal(app.notifNome('ana'), 'Ana (Contabilista)');
    assert.equal(app.notifNome('rui'), 'Rui');
  });

  test('cargosDoEstado: dono, comproprietário, colaborador, e quem é quem', () => {
    const st = {
      houses: [
        { id: 'H1', ownerId: 'eu', ownerName: 'Eu', mine: true, participants: ['eu'] },
        { id: 'H2', ownerId: 'rui', ownerName: 'Rui', mine: false, participants: ['rui', 'eu'] },
        { id: 'H3', ownerId: 'rui', ownerName: 'Rui', mine: false, participants: ['rui'], collab: { roleId: 'r1', roleName: 'Contabilista', perms: ['tx.view', 'tx.add'] } },
        { id: 'H4', ownerId: 'ana', mine: false, participants: ['ana'] },
      ],
      people: [{ id: 'rui', name: 'Rui', kind: 'owner' }, { id: 'zed', name: 'Zé', kind: 'collab', roleName: 'Gestor de visitas' }],
      connections: [{ status: 'accepted', peer: { id: 'lig' } }, { status: 'pending', peer: { id: 'pend' } }],
    };
    const r = app.cargosDoEstado(st, 'eu');
    igual(r.cargos.H1, { dono: true, criador: true });
    igual(r.cargos.H2, { dono: true, criador: false });
    igual(r.cargos.H3, { dono: false, id: 'r1', nome: 'Contabilista', perms: ['tx.view', 'tx.add'] });
    assert.equal(r.cargos.H4.dono, false, 'sem collab nem participação: cargo vazio');
    igual(r.cargos.H4.perms, []);
    ['eu', 'rui', 'ana', 'lig'].forEach((u) => assert.ok(r.ownersIds.has(u), u));
    ['zed', 'pend'].forEach((u) => assert.ok(!r.ownersIds.has(u), u + ' não é dono'));
    igual(r.pessoas.zed, { name: 'Zé', kind: 'collab', roleName: 'Gestor de visitas' });
    assert.equal(r.pessoas.ana.name, '', 'o dono de uma casa entra pelo id mesmo sem nome');
    igual(app.cargosDoEstado({}, 'eu').cargos, {});
  });

  test('parseConvite lê ?convite= e ?ligar= com token de 64 hex', () => {
    const tok = 'a'.repeat(32) + 'B'.repeat(32);
    igual(app.parseConvite('?convite=' + tok), { tipo: 'convite', token: tok.toLowerCase() });
    igual(app.parseConvite('?x=1&ligar=' + tok), { tipo: 'ligar', token: tok.toLowerCase() });
    assert.equal(app.parseConvite('?x=1'), null);
    assert.equal(app.parseConvite('?convite=abc123'), null, 'curto demais');
    assert.equal(app.parseConvite('?convite=' + 'z'.repeat(64)), null, 'fora do hex');
    assert.equal(app.parseConvite(''), null);
  });

  test('os pedidos de partilha entram no sino', () => {
    tresCasas();
    app.db.settings.notifLidoAte = 1;
    app.window.CW.state = { shareRequests: { incoming: [{ id: 'q1', fromName: 'Ana', houseName: 'T4 Porto' }] } };
    assert.equal(app.notifConta(), 1);
    let corpo = '';
    app.openModal = (t, b) => { corpo = b; };
    app.notifModal();
    assert.match(corpo, /Ana quer partilhar T4 Porto contigo/);
    assert.match(corpo, /CW\.pedidoAceitar\('q1'\)/);
    assert.match(corpo, /CW\.pedidoRecusar\('q1'\)/);
  });

  test('a cópia leva só o que é meu', () => {
    tresCasas();
    app.db.transactions = [app.normTx({ id: 'T1', label: 'Luz', propertyId: 'P1', amount: 10 }), app.normTx({ id: 'T2', label: 'Obra', propertyId: 'P2', amount: 10 })];
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P2', rent: 500, tenantIds: ['I1'] })];
    app.db.tenants = [app.normPerson({ id: 'I1', name: 'Inquilino do Rui' }), app.normPerson({ id: 'I2', name: 'Meu' })];
    const d = app.dbSoMeu();
    assert.deepEqual(d.properties.map((p) => p.id), ['P1']);
    assert.deepEqual(d.transactions.map((t) => t.id), ['T1']);
    assert.deepEqual(d.contracts, []);
    assert.deepEqual(d.tenants.map((t) => t.id), ['I2']);
    assert.equal(app.db.properties.length, 3, 'a base a sério não muda');
  });
});
