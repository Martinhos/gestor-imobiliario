// O aviso de um registo adicionado leva «Ver» (componentes.js:avisoComVer):
// o imóvel, o contrato, o movimento (e o lote de vários imóveis, e o que se
// confirma de um planeado), o planeado, o modelo, a visita, o inquilino, o
// proprietário e a hipoteca novos dizem «… adicionado.» com o botão, e tocar
// nele vai ao separador certo e abre a ficha do registo com o id novo. Uma
// edição fica com o aviso de sempre, sem botão. O «Ver» não aparece por cima
// de uma janela que a app acabou de abrir (a pergunta das prestações em
// falta), nem para um separador desligado; com fichas por baixo, mudar de
// separador fecha-as primeiro.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas, camadaFalsa } from './lib/dom.js';

const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));

const FICHAS = ['propView', 'ctView', 'txView', 'recView', 'tplView', 'visView', 'personView', 'mortView'];

/* Dois imóveis meus (o A de arrendamento), dois donos, uma inquilina e um
   grupo com os dois; as janelas numa pilha, o toast, o go e as fichas
   apanhados.
   Devolve: {abertas, avisos, gos, fichas}. */
function ecra() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'eu', name: 'Eu' }), app.normPerson({ id: 'rui', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'I1', name: 'Ana' })];
  app.db.properties = [
    app.normProp({ id: 'A', name: 'Lisboa', use: 'investimento', ownerIds: ['eu'] }),
    app.normProp({ id: 'B', name: 'Porto', ownerIds: ['eu'] }),
  ];
  app.db.groups = [app.normGroup({ id: 'G', name: 'Bloco', kind: 'prop', ids: ['A', 'B'] })];
  app.modalStack.length = 0;   // a pilha é da app, e o repor não a esvazia
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'refreshDetail');
  const avisos = [], gos = [], fichas = [];
  app.toast = (m, op) => { avisos.push({ m, op }); };
  app.go = (id) => { gos.push(id); app.tab = id; };
  for (const n of FICHAS) app[n] = (...a) => { fichas.push([n, ...a]); };
  app.tab = 'dashboard';
  return { abertas, avisos, gos, fichas };
}

/* O último aviso tem a frase m e o «Ver» de 6 s; tocar nele (a partir da
   Visão geral) vai ao separador e abre a ficha esperada.
   Recebe: e — o ecra(); m — a frase; sep — o separador; ficha — [nome, ...args].
   Devolve: nada — falha o teste se não bater. */
function confereVer(e, m, sep, ficha) {
  const a = e.avisos.at(-1);
  assert.ok(a, 'houve aviso');
  assert.equal(a.m, m);
  assert.ok(a.op, m + ': o aviso leva botão');
  assert.equal(a.op.rotulo, 'Ver');
  assert.equal(a.op.ms, 6000);
  e.gos.length = 0; e.fichas.length = 0;
  app.tab = 'dashboard';
  a.op.fn();
  assert.deepEqual(e.gos, [sep], m + ': vai ao separador');
  assert.deepEqual(e.fichas, [ficha], m + ': abre a ficha do registo novo');
}

/* O último aviso é o de sempre, sem botão.
   Recebe: e — o ecra(); m — a frase.
   Devolve: nada. */
function semVer(e, m) {
  const a = e.avisos.at(-1);
  assert.ok(a, 'houve aviso');
  assert.equal(a.m, m);
  assert.equal(a.op, undefined, m + ': sem botão');
}

describe('o «Ver» no aviso de um registo novo', () => {
  test('imóvel: o novo dá «Imóvel adicionado.» com Ver para a ficha; editar, «Imóvel atualizado.» sem botão', () => {
    const e = ecra();
    app.perguntarPrestacoesEmFalta = () => {};
    app.collectProp = () => {};
    app.propModal();
    app.pForm.name = 'Faro';
    app.onSave();
    const id = app.db.properties.at(-1).id;
    assert.equal(app.db.properties.at(-1).name, 'Faro');
    confereVer(e, 'Imóvel adicionado.', 'properties', ['propView', id]);
    app.propModal('A');
    app.onSave();
    semVer(e, 'Imóvel atualizado.');
  });

  test('imóvel: se a app abre logo a pergunta das prestações em falta, o aviso não leva Ver por cima dela', () => {
    const e = ecra();
    app.perguntarPrestacoesEmFalta = () => { app.openModal('Prestações em falta', 'x', ''); };
    app.collectProp = () => {};
    app.propModal();
    app.pForm.name = 'Faro';
    app.onSave();
    semVer(e, 'Imóvel adicionado.');
    assert.equal(e.abertas.at(-1).t, 'Prestações em falta', 'a pergunta fica à vista');
  });

  test('hipoteca: a nova dá «Hipoteca adicionada.» com Ver para a ficha dela; editar, «Hipoteca guardada.»; com a pergunta aberta, sem Ver', () => {
    const e = ecra();
    app.perguntarPrestacoesEmFalta = () => {};
    app.collectProp = () => {};
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('A'))));
    const l = app.normLoan({ name: 'Aquisição', outstanding: 100000 });
    app.pForm.loans.push(l);
    app.mortOpen(l.id, true);
    app.onSave();
    confereVer(e, 'Hipoteca adicionada.', 'credits', ['mortView', 'A', l.id]);
    app.mortModal('A', l.id);
    app.onSave();
    semVer(e, 'Hipoteca guardada.');
    // a pergunta das prestações abre-se logo a seguir: o aviso fica sem Ver
    app.perguntarPrestacoesEmFalta = () => { app.openModal('Prestações em falta', 'x', ''); };
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('A'))));
    const l2 = app.normLoan({ name: 'Obras', outstanding: 20000 });
    app.pForm.loans.push(l2);
    app.mortOpen(l2.id, true);
    app.onSave();
    semVer(e, 'Hipoteca adicionada.');
  });

  test('contrato: o novo dá «Contrato adicionado.» com Ver; editar, «Contrato guardado.»; os movimentos fora das datas continuam com o Ver deles', () => {
    const e = ecra();
    app.cForm = app.normContract({ propertyId: 'A', tenantIds: ['I1'], rent: 500, start: '2026-01-01' });
    const id = app.cForm.id;
    app.ctGravar();
    assert.ok(app.contract(id), 'gravou');
    confereVer(e, 'Contrato adicionado.', 'contracts', ['ctView', id]);
    app.cForm = app.normContract(JSON.parse(JSON.stringify(app.contract(id))));
    app.ctGravar();
    semVer(e, 'Contrato guardado.');
    // um movimento antes do início: o aviso é o dos movimentos fora, com o Ver para a lista deles
    app.db.transactions.push(app.normTx({ id: 'TF', kind: 'income', propertyId: 'A', contractId: id, amount: 500, date: '2025-12-01', label: 'Renda' }));
    let fora = 0;
    app.verMovimentosFora = () => { fora++; };
    app.cForm = app.normContract(JSON.parse(JSON.stringify(app.contract(id))));
    app.ctGravar();
    const a = e.avisos.at(-1);
    assert.match(a.m, /fora das datas/);
    assert.equal(a.op.rotulo, 'Ver');
    assert.equal(a.op.ms, 9000);
    a.op.fn();
    assert.equal(fora, 1);
  });

  test('movimento: o novo dá «Movimento adicionado.» com Ver para a ficha; editar, «Movimento guardado.»', () => {
    const e = ecra();
    app.collectTx = () => {};
    app.txModal({ kind: 'expense', propId: 'A' });
    Object.assign(app.tForm, { label: 'Canalizador', amount: 80, date: '2026-09-01' });
    const id = app.tForm.id;
    app.onSave();
    assert.ok(app.db.transactions.find((t) => t.id === id), 'gravou');
    confereVer(e, 'Movimento adicionado.', 'transactions', ['txView', id]);
    app.txModal({ id });
    app.tForm.amount = 90;
    app.onSave();
    semVer(e, 'Movimento guardado.');
  });

  test('movimento de vários imóveis: o Ver abre a primeira parte, que a ficha lê como o lote inteiro', () => {
    const e = ecra();
    app.collectTx = () => {};
    app.txModal({ kind: 'expense' });
    Object.assign(app.tForm, { label: 'Seguro', amount: 90, date: '2026-09-01', groupId: 'G', propertyId: null, todos: false, psplit: { mode: 'equal', parts: {} } });
    const lote = app.tForm.id;
    app.onSave();
    const partes = app.partesDoLote(lote);
    assert.equal(partes.length, 2, 'partiu-se pelos dois imóveis');
    const primeira = partes[0].id;
    confereVer(e, 'Movimento adicionado.', 'transactions', ['txView', primeira]);
    assert.match(app.txFicha(primeira), /Bloco · 2 imóveis/, 'a ficha da parte é a do lote');
  });

  test('confirmar um planeado: «Movimento confirmado.» com Ver para o movimento que nasceu', () => {
    const e = ecra();
    app.db.recurring = [app.normRec({ id: 'R1', name: 'Condomínio', every: 'month', next: '2026-09-01',
      tx: { kind: 'expense', label: 'Condomínio', amount: 40, propertyId: 'A', category: 'Condomínio' } })];
    app.collectTx = () => {};
    app.confirmRec('R1');
    app.onSave();
    const t = app.db.transactions.at(-1);
    assert.equal(t.label, 'Condomínio');
    confereVer(e, 'Movimento confirmado.', 'transactions', ['txView', t.id]);
  });

  test('confirmar sem abrir (o Confirmar da linha do planeado): o mesmo «Ver» para o movimento que nasceu', () => {
    const e = ecra();
    app.db.recurring = [app.normRec({ id: 'R1', name: 'Condomínio', every: 'month', next: '2026-09-01',
      tx: { kind: 'expense', label: 'Condomínio', amount: 40, propertyId: 'A', category: 'Condomínio' } })];
    app.quickConfirmRec('R1');
    const t = app.db.transactions.at(-1);
    assert.equal(t.label, 'Condomínio');
    confereVer(e, 'Movimento confirmado.', 'transactions', ['txView', t.id]);
  });

  test('planeado: o novo dá «Movimento recorrente adicionado.» com Ver; editar, «Movimento recorrente atualizado.»', () => {
    const e = ecra();
    app.collectTx = () => {};
    app.txModal({ kind: 'expense', propId: 'A', modo: 'rec', every: 'month' });
    Object.assign(app.tForm, { label: 'Limpeza', amount: 30, date: '2026-09-10' });
    app.onSave();
    const r = app.db.recurring.at(-1);
    assert.equal(r.name, 'Limpeza');
    confereVer(e, 'Movimento recorrente adicionado.', 'recurring', ['recView', r.id]);
    app.editRec(r.id);
    app.onSave();
    semVer(e, 'Movimento recorrente atualizado.');
  });

  test('modelo: o novo dá «Modelo adicionado.» (ou «… e movimento registado.») com Ver para o modelo; editar, «Modelo atualizado.»', () => {
    const e = ecra();
    app.collectTx = () => {};
    app.txModal({ kind: 'expense', propId: 'A', modo: 'tpl', tplName: 'Água' });
    Object.assign(app.tForm, { label: 'Água', amount: 20, date: '2026-09-02' });
    app.onSave();
    const x = app.db.templates.at(-1);
    assert.equal(x.name, 'Água');
    confereVer(e, 'Modelo adicionado.', 'recurring', ['tplView', x.id]);
    app.txModal({ kind: 'expense', propId: 'A', modo: 'tpl', alsoTx: true, tplName: 'Luz' });
    Object.assign(app.tForm, { label: 'Luz', amount: 25, date: '2026-09-02' });
    app.onSave();
    const y = app.db.templates.at(-1);
    assert.equal(y.name, 'Luz');
    confereVer(e, 'Modelo adicionado e movimento registado.', 'recurring', ['tplView', y.id]);
    app.editTpl(x.id);
    app.onSave();
    semVer(e, 'Modelo atualizado.');
  });

  test('visita: a nova dá «Visita adicionada.» com Ver; editar, «Visita guardada.»', () => {
    const e = ecra();
    app.visColhe = () => {};
    app.visitModal();
    Object.assign(app.visForm, { nomes: 'Joana', propertyId: 'A', date: '2026-09-10' });
    app.onSave();
    const v = app.db.visits.at(-1);
    assert.equal(v.nomes, 'Joana');
    confereVer(e, 'Visita adicionada.', 'visits', ['visView', v.id]);
    app.visitModal(v.id);
    app.onSave();
    semVer(e, 'Visita guardada.');
  });

  test('pessoas: o inquilino e o proprietário novos dão «… adicionado.» com Ver; editar, «Ficha guardada.»; a ficha criada a partir do contrato volta ao contrato, sem aviso', () => {
    const e = ecra();
    app.collectPerson = () => {};
    app.personModal('tenant');
    app.perForm.name = 'Joana';
    app.onSave();
    const t = app.db.tenants.at(-1);
    assert.equal(t.name, 'Joana');
    confereVer(e, 'Inquilino adicionado.', 'tenants', ['personView', 'tenant', t.id]);
    app.personModal('owner');
    app.perForm.name = 'Marta';
    app.onSave();
    const o = app.db.owners.at(-1);
    assert.equal(o.name, 'Marta');
    confereVer(e, 'Proprietário adicionado.', 'owners', ['personView', 'owner', o.id]);
    app.personModal('tenant', t.id);
    app.onSave();
    semVer(e, 'Ficha guardada.');
    // com o after (o contrato que cria um inquilino), quem chama continua o fluxo
    const antes = e.avisos.length;
    let voltou = '';
    app.personModal('tenant', null, (nid) => { voltou = nid; });
    app.perForm.name = 'Pedro';
    app.onSave();
    assert.equal(voltou, app.db.tenants.at(-1).id);
    assert.equal(e.avisos.length, antes, 'sem aviso daqui');
  });
});

describe('avisoComVer: quando o Ver cabe e o que faz', () => {
  test('com uma ficha por baixo, mudar de separador fecha-a antes de abrir; no mesmo separador abre por cima', () => {
    const e = ecra();
    const abrir = [];
    app.modalStack.push(Object.assign(camadaFalsa(), { ficha: {} }));
    app.avisoComVer('Movimento adicionado.', 'transactions', () => { abrir.push(app.modalStack.length); });
    const a = e.avisos.at(-1);
    assert.equal(a.op.rotulo, 'Ver');
    a.op.fn();
    assert.deepEqual(e.gos, ['transactions']);
    assert.deepEqual(abrir, [0], 'a ficha de baixo fechou antes de abrir a nova');
    app.modalStack.push(Object.assign(camadaFalsa(), { ficha: {} }));
    app.avisoComVer('Movimento adicionado.', 'transactions', () => { abrir.push(app.modalStack.length); });
    e.avisos.at(-1).op.fn();
    assert.deepEqual(e.gos, ['transactions'], 'já lá estava: não volta a ir');
    assert.deepEqual(abrir, [0, 1], 'a ficha de baixo fica, e a nova abre por cima');
  });

  test('com um formulário aberto por baixo, ou aberto depois do aviso, o Ver não navega por cima dele', () => {
    const e = ecra();
    let abriu = 0;
    app.modalStack.push(camadaFalsa());
    app.avisoComVer('Inquilino adicionado.', 'tenants', () => { abriu++; });
    semVer(e, 'Inquilino adicionado.');
    app.modalStack.length = 0;
    app.avisoComVer('Inquilino adicionado.', 'tenants', () => { abriu++; });
    const a = e.avisos.at(-1);
    assert.equal(a.op.rotulo, 'Ver');
    app.modalStack.push(camadaFalsa());   // um formulário abriu entretanto
    a.op.fn();
    assert.deepEqual(e.gos, []);
    assert.equal(abriu, 0);
    assert.equal(app.modalStack.length, 1, 'o formulário fica');
  });

  test('um separador desligado não leva Ver; um go recusado não abre a ficha', () => {
    const e = ecra();
    let abriu = 0;
    try {
      app.definirServicosDesligados(['visits']);
      app.avisoComVer('Visita adicionada.', 'visits', () => { abriu++; });
      semVer(e, 'Visita adicionada.');
    } finally {
      app.definirServicosDesligados([]);
    }
    app.go = (id) => { e.gos.push(id); };   // recusa: fica onde está
    app.avisoComVer('Visita adicionada.', 'visits', () => { abriu++; });
    e.avisos.at(-1).op.fn();
    assert.deepEqual(e.gos, ['visits']);
    assert.equal(abriu, 0);
  });
});
