// Colaboradores com cargos, do lado da app: quem pode o quê em cada imóvel,
// o que se esconde, e a garantia de que um colaborador nunca parte as contas
// entre proprietários. As decisões vivem em web/app/acessos.js (puro) e
// testam-se aqui sem a camada da nuvem: a sessão simula-se com window.CW.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { carregarApp, limpar, igual } from './arnes.js';

const require = createRequire(import.meta.url);
const acessos = require('../web/app/acessos.js');
const app = carregarApp();
const lpShowReal = app.lpShow;   // guardado antes de qualquer stub
const personModalReal = app.personModal;

/* uma camada de janela falsa, com corpo e rodapé observáveis: o modo só de
   leitura desativa os campos do corpo e troca o rodapé por «Fechar» */
function camadaFalsa() {
  const campos = [{ disabled: false, type: 'text', value: 'a' }, { disabled: false, type: 'text', value: 'b' }];
  const body = { innerHTML: '', hint: '', querySelectorAll: () => campos, insertAdjacentHTML: (w, h) => { body.hint += h; } };
  const foot = { innerHTML: '' };
  const el = { querySelector: (s) => (s === '.body' ? body : s === '.foot' ? foot : null), querySelectorAll: () => [] };
  return { el, body, foot, campos, onSave: null };
}
// abre janelas numa pilha observável: cada openModal empilha uma camadaFalsa e guarda o que recebeu
function janelasFalsas() {
  const abertas = [];
  app.openModal = (t, b, f, m) => { const L = camadaFalsa(); L.t = t; L.b = b; L.f = f; L.m = m || ''; app.modalStack.push(L); abertas.push(L); return L; };
  app.closeModal = () => { app.modalStack.pop(); };
  app.closeAllModals = () => { app.modalStack.length = 0; };
  app.paintThumbs = () => {}; app.render = () => {}; app.buildNav = () => {}; app.save = () => {};
  return abertas;
}

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
    const meu = { _createdBy: 'eu' }, dele = { _createdBy: 'rui' }, local = {}, antigo = { _atServidor: 5 };
    assert.equal(app.podeEditar('P2', 'tx.add', meu), true);
    assert.equal(app.podeEditar('P2', 'tx.add', dele), false);
    assert.equal(app.podeEditar('P2', 'tx.add', local), true, 'ainda não subiu: é meu');
    assert.equal(app.podeEditar('P2', 'tx.add', antigo), false, 'veio do servidor sem criador (anterior à marca): não é meu, o servidor recusava');
    assert.equal(app.podeEditar('P2', 'tx.add', antigo, true), false);
    assert.equal(app.podeEditar('P1', 'tx.add', dele), true, 'no meu imóvel edito tudo');
    assert.equal(app.podeEditar('P1', 'tx.add', antigo, true), true);
    assert.equal(app.motivoRecusa('P2', 'tx.add', meu), '');
    assert.match(app.motivoRecusa('P2', 'tx.add', dele), /Só quem o adicionou pode alterar este registo/);
    assert.match(app.motivoRecusa('P2', 'tx.add', antigo, true), /Só quem o adicionou pode apagar este registo/);
    assert.equal(app.motivoRecusa('P3', 'tx.add'), 'Não tens permissão para adicionar movimentos neste imóvel — pede ao dono.');
    assert.equal(app.fraseSemPerm('visit.add'), 'Não tens permissão para marcar visitas neste imóvel — pede ao dono.');
  });

  test('um planeado alheio confirma-se e silencia-se com rec.add; os campos e o apagar são de quem o criou — salvo o que confirmar apaga', () => {
    tresCasas();
    const doDono = { _createdBy: 'rui', _atServidor: 5, every: 'month', next: '2026-09-01', end: '' }, antigo = { _atServidor: 5, every: 'month', next: '2026-09-01' };
    assert.equal(app.podeEditar('P2', 'rec.add', doDono, 'confirmar'), true, 'o contabilista confirma a renda do dono');
    assert.equal(app.podeEditar('P2', 'rec.add', antigo, 'confirmar'), true);
    assert.equal(app.podeEditar('P2', 'rec.add', doDono), false, 'mas não lhe altera os campos: o servidor só funde next, until e muted');
    assert.equal(app.podeEditar('P2', 'rec.add', antigo), false);
    assert.equal(app.podeEditar('P2', 'rec.add', doDono, true), false, 'nem a apaga: mensal sem fim');
    assert.equal(app.podeEditar('P2', 'rec.add', { _createdBy: 'eu' }), true);
    assert.equal(app.podeEditar('P2', 'rec.add', { _createdBy: 'eu' }, true), true);
    assert.equal(app.podeEditar('P3', 'rec.add', doDono, 'confirmar'), false, 'sem rec.add, nada');
    assert.equal(app.podeEditar('P1', 'rec.add', doDono), true, 'no meu imóvel edito tudo');
    // o que confirmar apaga (uma só vez; a última ocorrência antes do fim) o servidor deixa apagar a quem tem rec.add
    const once = { _createdBy: 'rui', _atServidor: 5, every: 'once', next: '2026-09-15' };
    const ultimo = { _createdBy: 'rui', _atServidor: 5, every: 'month', next: '2026-09-01', end: '2026-09-30' };
    const aindaNao = { _createdBy: 'rui', _atServidor: 5, every: 'month', next: '2026-09-01', end: '2026-10-01' };
    assert.equal(app.recTermina(once), true);
    assert.equal(app.recTermina(ultimo), true);
    assert.equal(app.recTermina(aindaNao), false);
    assert.equal(app.recTermina(doDono), false);
    assert.equal(app.recTermina(null), false);
    assert.equal(app.podeEditar('P2', 'rec.add', once, true), true, 'confirmar um «uma só vez» é apagá-lo');
    assert.equal(app.podeEditar('P2', 'rec.add', ultimo, true), true, 'a última ocorrência antes do fim também');
    assert.equal(app.podeEditar('P2', 'rec.add', aindaNao, true), false, 'antes disso, não');
    assert.equal(app.podeEditar('P2', 'rec.add', once), false, 'os campos continuam a ser do dono');
    assert.equal(app.podeEditar('P2', 'tx.add', { _createdBy: 'rui', _atServidor: 5, every: 'once' }, true), false, 'a exceção é só dos planeados');
    assert.equal(app.motivoRecusa('P2', 'rec.add', doDono, 'confirmar'), '');
    assert.match(app.motivoRecusa('P2', 'rec.add', doDono), /Só quem o adicionou pode alterar/);
    assert.match(app.motivoRecusa('P2', 'rec.add', doDono, true), /Só quem o adicionou pode apagar/);
    assert.equal(app.motivoRecusa('P2', 'rec.add', once, true), '');
    // confirmar: o mensal (avança) e o «uma só vez» (apaga) passam; sem tx.add não — cria um movimento
    const rec = (x) => Object.assign(app.normRec({ id: 'R1', name: 'Renda', next: '2000-01-01', tx: { kind: 'income', propertyId: 'P2', amount: 500 } }), x);
    assert.equal(app.recusaConfirmar(rec(doDono)), '');
    assert.equal(app.recusaConfirmar(rec(once)), '');
    app.window.CW.cargos.P2.perms = ['rec.add'];
    assert.equal(app.recusaConfirmar(rec(once)), app.fraseSemPerm('tx.add'));
    app.window.CW.cargos.P2.perms = ['tx.add'];
    assert.equal(app.recusaConfirmar(rec(once)), app.fraseSemPerm('rec.add'));
    app.window.CW.cargos.P2.perms = CONTAB;
    // silenciar passa; apagar recusa sem tirar nada
    app.db.recurring = [rec(doDono)];
    let msg = '';
    const reais = { toast: app.toast, save: app.save, render: app.render, buildNav: app.buildNav, confirmModal: app.confirmModal };
    app.toast = (m) => { msg = m; };
    app.save = () => {}; app.render = () => {}; app.buildNav = () => {};
    app.skipRec('R1');
    assert.equal(app.db.recurring[0].muted, true);
    app.confirmModal = () => { throw new Error('não devia perguntar'); };
    app.delRec('R1');
    assert.match(msg, /Só quem o adicionou pode apagar/);
    assert.equal(app.db.recurring.length, 1);
    Object.keys(reais).forEach((k) => { app[k] = reais[k]; });
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

  test('um registo antigo do dono (sem criador) só se vê; o planeado do dono confirma-se e silencia-se, não se edita nem apaga', () => {
    tresCasas();
    const t1 = app.normTx({ id: 'T1', label: 'Obra', propertyId: 'P2', amount: 10 }); t1._atServidor = 5;
    app.db.transactions = [t1];
    assert.deepEqual(Array.from(menuDe('tx:T1').labels), ['Ver movimento']);
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.delTx('T1');
    assert.match(msg, /Só quem o adicionou pode apagar/);
    assert.equal(app.db.transactions.length, 1, 'nada saiu da base');
    const r1 = app.normRec({ id: 'R1', name: 'Renda', next: '2000-01-01', tx: { kind: 'income', propertyId: 'P2', amount: 500 } });
    r1._createdBy = 'rui'; r1._atServidor = 5;
    app.db.recurring = [r1];
    assert.deepEqual(Array.from(menuDe('rec:R1').labels), ['Confirmar', 'Silenciar'], 'sem «Editar»: os campos são do dono; sem «Apagar»');
    // um «uma só vez» do dono: confirmar apaga-o (o servidor aceita), mas o menu continua sem «Apagar» nem «Editar»
    r1.every = 'once';
    assert.deepEqual(Array.from(menuDe('rec:R1').labels), ['Confirmar', 'Silenciar']);
    // sem tx.add o Confirmar some (criava um movimento); silenciar fica
    app.window.CW.cargos.P2.perms = ['rec.add'];
    assert.deepEqual(Array.from(menuDe('rec:R1').labels), ['Silenciar']);
    app.window.CW.cargos.P2.perms = CONTAB;
    r1._createdBy = 'eu';
    const meu = menuDe('rec:R1').labels;
    ['Confirmar', 'Silenciar', 'Editar', 'Apagar'].forEach((l) => assert.ok(meu.includes(l), l));
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
    // responder fecha o sino primeiro: o cartão não fica a repetir o pedido já respondido
    assert.match(corpo, /onclick="closeModal\(\);window\.CW&&CW\.pedidoAceitar&&CW\.pedidoAceitar\('q1'\)"/);
    assert.match(corpo, /onclick="closeModal\(\);window\.CW&&CW\.pedidoRecusar&&CW\.pedidoRecusar\('q1'\)"/);
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

describe('o que um colaborador faz — e o ecrã não desmente', () => {
  const reais = { collectTx: app.collectTx, collectPerson: app.collectPerson, pickModal: app.pickModal, repaintCt: app.repaintCt };
  afterEach(() => { Object.keys(reais).forEach((k) => { app[k] = reais[k]; }); app.personModal = personModalReal; app.modalStack.length = 0; });
  // o menu do toque longo devolve as opções em vez de abrir a folha
  function menuDe(v) {
    let opts = null;
    app.lpShow = (t, o) => { opts = o; };
    app.lpMenu(v);
    return opts ? opts.map((o) => o.label) : null;
  }

  test('«Ver movimento» e «Ver contrato» abrem só de leitura; o que é meu abre para editar', () => {
    tresCasas();
    const abertas = janelasFalsas();
    const t1 = app.normTx({ id: 'T1', label: 'Obra', kind: 'expense', propertyId: 'P2', amount: 10 }); t1._createdBy = 'rui';
    const t2 = app.normTx({ id: 'T2', label: 'Luz', kind: 'expense', propertyId: 'P2', amount: 10 }); t2._createdBy = 'eu';
    app.db.transactions = [t1, t2];
    app.txModal('T1');
    let L = abertas[0];
    assert.equal(L.t, 'Despesa', 'o título não diz editar');
    assert.equal(L.m, '', 'sem menu de apagar');
    assert.ok(L.campos.every((c) => c.disabled), 'campos desativados');
    assert.match(L.foot.innerHTML, /Fechar/);
    assert.doesNotMatch(L.foot.innerHTML, /Guardar/);
    assert.match(L.body.hint, /só de leitura/);
    assert.equal(L.soLeitura, true);
    assert.equal(app.onSave, null, 'nada por guardar');
    app.txModal('T2');
    L = abertas[1];
    assert.equal(L.t, 'Editar despesa');
    assert.match(L.m, /Apagar movimento/);
    assert.ok(L.campos.every((c) => !c.disabled));
    assert.equal(typeof app.onSave, 'function');
    // o contabilista só vê contratos: o do Rui abre em leitura, com o PDF mas sem apagar
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P2', rent: 500, tenantIds: [] })];
    app.ctModal('C1');
    L = abertas[2];
    assert.equal(L.t, 'Contrato');
    assert.match(L.m, /Gerar contrato em PDF/);
    assert.doesNotMatch(L.m, /Apagar contrato/);
    assert.ok(L.campos.every((c) => c.disabled));
    assert.match(L.foot.innerHTML, /Fechar/);
    assert.match(L.body.hint, /só de leitura/);
    assert.equal(app.onSave, null);
    // a miniatura do registo fotográfico é um div: em leitura não repinta (repintar reativava os campos)
    let repintou = false;
    app.repaintCt = () => { repintou = true; };
    app.togCtPhoto('f1');
    assert.equal(repintou, false);
    // no meu imóvel o contrato abre para editar
    app.db.contracts.push(app.normContract({ id: 'C2', propertyId: 'P1', rent: 500, tenantIds: [] }));
    app.ctModal('C2');
    L = abertas[3];
    assert.equal(L.t, 'Editar contrato');
    assert.match(L.m, /Apagar contrato/);
    assert.equal(typeof app.onSave, 'function');
  });

  test('pagar crédito num imóvel onde colaboro pede «Editar a ficha do imóvel»', () => {
    tresCasas();
    app.db.properties[1].loans = [app.normLoan({ id: 'L1', name: 'Aquisição', outstanding: 100000, rate: 3 })];
    const FRASE = 'Registar pagamentos de crédito precisa de poder editar a ficha do imóvel — pede ao dono.';
    assert.equal(app.motivoCredito('P2'), FRASE, 'contabilista: tx.add e loan.view, sem house.edit');
    assert.equal(app.motivoCredito('P1'), '', 'no meu imóvel posso');
    assert.equal(app.motivoCredito(null), '', 'sem imóvel é meu');
    assert.equal(app.motivoCredito('P3'), app.fraseSemPerm('tx.add'), 'sem tx.add é essa a falta');
    const menu = menuDe('prop:P2');
    assert.ok(menu.includes('Registar despesa') && !menu.includes('Pagamento de crédito') && !menu.includes('Amortização'), menu.join(', '));
    assert.deepEqual(Array.from(menuDe('mort:P2:L1')), []);
    // a prestação planeada da hipoteca também abate capital: não se confirma
    const r = app.normRec({ id: 'R1', name: 'Prestação', next: '2000-01-01', tx: { kind: 'loan', propertyId: 'P2', loanId: 'L1', amount: 400 } });
    assert.equal(app.recusaConfirmar(r), FRASE);
    // o formulário aberto por outro caminho recusa ao guardar, antes de mexer em nada
    janelasFalsas();
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.txModal(null, 'loan', 'P2');
    app.collectTx = () => {};
    Object.assign(app.tForm, { propertyId: 'P2', label: 'Prestação', amount: 400, loanId: 'L1' });
    app.onSave();
    assert.equal(msg, FRASE);
    assert.equal(app.db.transactions.length, 0);
    assert.equal(app.db.properties[1].loans[0].outstanding, 100000, 'nada abatido');
    // o «Novo movimento» da lista nem chega a abrir o formulário
    const antes = app.modalStack.length;
    app.txProp = 'P2';
    app.newTxFromFilters('loan');
    assert.equal(app.modalStack.length, antes);
    assert.equal(msg, FRASE);
    app.txProp = '';
    // com «Editar a ficha», tudo volta
    app.window.CW.cargos.P2.perms = CONTAB.concat(['house.edit']);
    assert.equal(app.motivoCredito('P2'), '');
    assert.equal(app.recusaConfirmar(r), '');
    assert.ok(menuDe('prop:P2').includes('Pagamento de crédito'));
    assert.ok(menuDe('mort:P2:L1').includes('Amortização'));
  });

  test('quem só colabora abre o movimento novo já no primeiro imóvel permitido', () => {
    tresCasas();
    app.window.CW.cargos.P1 = { dono: false, nome: 'Gestor', perms: ['contract.add', 'tx.add'] };   // P1 e P2 dão tx.add
    assert.equal(app.souSoColaborador(), true);
    janelasFalsas();
    app.txModal(null, 'expense', null);
    assert.equal(app.tForm.propertyId, 'P1');
    app.txModal(null, 'expense', null, null, null, { propertyId: null, label: 'De um modelo' });
    assert.equal(app.tForm.propertyId, 'P1', 'um preset sem imóvel também');
    app.txModal(null, 'expense', 'P2');
    assert.equal(app.tForm.propertyId, 'P2', 'o que vem escolhido fica');
    // e sem imóvel não grava
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.collectTx = () => {};
    Object.assign(app.tForm, { propertyId: null, label: 'Luz', amount: 10 });
    app.onSave();
    assert.equal(msg, 'Escolhe o imóvel.');
    assert.equal(app.db.transactions.length, 0);
    // contrato e visita já caíam no primeiro permitido
    app.ctModal(null);
    assert.equal(app.cForm.propertyId, 'P1');
    app.visitModal(null);
    assert.equal(app.visForm.propertyId, 'P3');
    // um dono sem imóvel escolhido fica em «Todos os imóveis», como sempre
    sessao();
    app.txModal(null, 'expense', null);
    assert.equal(app.tForm.propertyId, null);
  });

  test('a ficha de inquilino de um colaborador fica presa ao imóvel', () => {
    tresCasas();
    assert.equal(app.normPerson({}).houseId, '', 'por omissão vazio');
    assert.equal(app.normPerson({ houseId: 'P3' }).houseId, 'P3', 'persiste o que vier');
    // «Converter em inquilino» numa visita do P3 (gestor de visitas)
    app.db.visits = [app.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P3', contacto: 'ana@x.pt' })];
    app.personModal = () => {};
    app.visConverte('V1');
    app.personModal = personModalReal;
    const ana = app.db.tenants[0];
    assert.equal(ana.houseId, 'P3');
    assert.equal(app.casaDoInquilino(ana), 'P3');
    assert.equal(app.podeEditarInquilino(ana), true, 'é minha: edito-a');
    assert.deepEqual(app.dbSoMeu().tenants.map((t) => t.id), [], 'não vai na cópia: é do imóvel do Rui');
    assert.match(app.vTenants(), /Ana/, 'e está na lista');
    assert.match(app.vTenants(), /Adicionar inquilino/);
    // a visita de um imóvel meu dá uma ficha minha (houseId vazio), como as do FAB: presa ao imóvel, perdia-se com ele
    app.db.visits.push(app.normVisit({ id: 'V2', nomes: 'Bruno', propertyId: 'P1', contacto: '912' }));
    app.personModal = () => {};
    app.visConverte('V2');
    const bruno = app.db.tenants.find((t) => t.name === 'Bruno');
    assert.equal(bruno.houseId, '');
    assert.equal(bruno.phone, '912');
    assert.equal(app.casaDoInquilino(bruno), null);
    assert.ok(app.dbSoMeu().tenants.some((t) => t.id === bruno.id), 'vai na cópia');
    // sem sessão, tudo é meu: idem
    sessao();
    app.db.visits.push(app.normVisit({ id: 'V3', nomes: 'Carla', propertyId: 'P3' }));
    app.visConverte('V3');
    app.personModal = personModalReal;
    assert.equal(app.db.tenants.find((t) => t.name === 'Carla').houseId, '');
  });

  test('criar ou alterar um planeado pede rec.add, não tx.add; o seletor lista onde há rec.add; o alheio abre só de leitura', () => {
    tresCasas();
    app.window.CW.cargos.P2 = { dono: false, nome: 'Gestor', perms: ['contract.add'] };   // rec.add por implicação, sem tx.add
    const r1 = app.normRec({ id: 'R1', name: 'IMI', next: '2026-09-01', tx: { kind: 'expense', propertyId: 'P2', amount: 500 } });
    r1._createdBy = 'eu'; r1._atServidor = 5;
    const r2 = app.normRec({ id: 'R2', name: 'Renda', next: '2026-09-01', tx: { kind: 'income', propertyId: 'P2', amount: 700 } });
    r2._createdBy = 'rui'; r2._atServidor = 5;
    app.db.recurring = [r1, r2];
    const abertas = janelasFalsas();
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.collectTx = () => {};
    // o meu: abre para editar e grava sem «Adicionar movimentos»
    app.editRec('R1');
    assert.equal(abertas.length, 1);
    assert.equal(app.tForm._recId, 'R1');
    assert.equal(typeof app.onSave, 'function');
    assert.ok(app.window.__sel.t_prop.options.some((o) => o.label === 'T2 Rui'), 'o seletor tem o imóvel onde tenho rec.add');
    Object.assign(app.tForm, { label: 'IMI 2026', amount: 520, propertyId: 'P2' });
    app.onSave();
    assert.equal(msg, 'Movimento recorrente atualizado.');
    assert.equal(app.db.recurring[0].tx.amount, 520);
    assert.equal(app.db.recurring[0].name, 'IMI 2026');
    // um planeado novo: o seletor lista P1 e P2 (rec.add), enquanto um movimento novo só lista P1 (tx.add)
    app.txModal(null, 'expense', null);
    const opcoes = () => Array.from(app.window.__sel.t_prop.options).filter((o) => !o.div).map((o) => o.label);
    assert.deepEqual(opcoes(), ['Todos os imóveis', 'T1 Meu']);
    app.tForm._recNew = true; app.tForm._every = 'month';
    app.repaintTx();
    assert.deepEqual(opcoes(), ['Todos os imóveis', 'T1 Meu', 'T2 Rui']);
    Object.assign(app.tForm, { label: 'Seguro', amount: 30, propertyId: 'P2' });
    app.onSave();
    assert.equal(msg, 'Movimento recorrente criado.');
    assert.equal(app.db.recurring.length, 3);
    assert.equal(app.db.recurring[2].tx.propertyId, 'P2');
    assert.equal(app.db.recurring[2].name, 'Seguro');
    assert.equal(app.db.transactions.length, 0, 'não criou movimento nenhum');
    // o do Rui abre só de leitura: os campos são de quem o criou
    app.editRec('R2');
    const L = abertas[abertas.length - 1];
    assert.equal(L.soLeitura, true);
    assert.equal(app.onSave, null);
    assert.match(L.body.hint, /só de leitura/);
    assert.match(L.foot.innerHTML, /Fechar/);
    // confirmar continua a pedir tx.add — cria um movimento
    assert.equal(app.recusaConfirmar(r2), app.fraseSemPerm('tx.add'));
    // e sem rec.add nenhum, o guardar de um planeado recusa com a frase certa
    app.window.CW.cargos.P2 = { dono: false, nome: 'Contab. sem planeados', perms: ['tx.add'] };
    app.txModal(null, 'expense', 'P2');
    app.tForm._recNew = true;
    Object.assign(app.tForm, { label: 'Água', amount: 20, propertyId: 'P2' });
    app.onSave();
    assert.equal(msg, app.fraseSemPerm('rec.add'));
    assert.equal(app.db.recurring.length, 3);
  });

  test('o FAB «Adicionar inquilino» de quem só colabora pede o imóvel', () => {
    tresCasas();
    app.window.CW.cargos.P1 = { dono: false, nome: 'Gestor de visitas', perms: GESTOR };   // P1 e P3 dão tenant.add
    const abertas = janelasFalsas();
    let escolha = null;
    app.pickModal = (t, opts, onPick) => { escolha = { t, opts, onPick }; };
    app.personModal('tenant');
    assert.equal(escolha.t, 'Inquilino de que imóvel?');
    assert.deepEqual(escolha.opts.map((o) => o.label), ['T1 Meu', 'T3 Rui']);
    assert.equal(abertas.length, 0, 'a ficha ainda não abriu');
    escolha.onPick(escolha.opts[1]);
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].t, 'Novo inquilino');
    assert.equal(app.perForm.houseId, 'P3');
    // guardar deixa a ficha presa ao imóvel
    app.collectPerson = () => {};
    app.perForm.name = 'Bruno';
    app.onSave();
    assert.equal(app.db.tenants.length, 1);
    assert.equal(app.db.tenants[0].houseId, 'P3');
    // com um só imóvel possível, vai direto
    escolha = null;
    app.window.CW.cargos.P1 = { dono: false, nome: 'Contabilista', perms: CONTAB };
    app.personModal('tenant');
    assert.equal(escolha, null);
    assert.equal(app.perForm.houseId, 'P3');
    // sem nenhum, a frase — e o FAB nem aparece
    let msg = '';
    app.toast = (m) => { msg = m; };
    app.window.CW.cargos.P3 = { dono: false, nome: 'Contabilista', perms: CONTAB };
    const n = abertas.length;
    app.personModal('tenant');
    assert.equal(msg, app.fraseSemPerm('tenant.add'));
    assert.equal(abertas.length, n);
    assert.doesNotMatch(app.vTenants(), /Adicionar inquilino/);
    // um dono não passa por aqui
    sessao();
    app.personModal('tenant');
    assert.equal(app.perForm.houseId, '');
    // o inquilino criado a meio de um contrato de um imóvel de colaboração fica preso a ele
    tresCasas();
    app.window.CW.cargos.P1 = { dono: false, nome: 'Gestor', perms: ['contract.add', 'tenant.add'] };
    app.cForm = { propertyId: 'P1', tenantIds: [] };
    app.newTenantFromCt();
    assert.equal(app.perForm.houseId, 'P1');
    sessao();
    app.cForm = { propertyId: 'P1', tenantIds: [] };
    app.newTenantFromCt();
    assert.equal(app.perForm.houseId, '', 'para o dono nada muda');
  });
});
