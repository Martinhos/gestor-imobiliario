// Os dados de exemplo e os proprietários (KAN-10). Na nuvem um proprietário é
// uma conta (docs/decisoes.md, 2026-10-22): o db.owners refaz-se dos perfis do
// servidor (cloud/nucleo.js:rebuildDb) e só o perfil da própria conta sobe
// (exportEntities, u:profile:main). O exemplo criava duas fichas à mão — a
// Maria Costa e o Pedro Costa, com ids que nenhuma conta tem: nenhuma subia,
// e depois da primeira sincronização os imóveis passavam a ser da conta, sem
// email nem telemóvel, os «pago por» apontavam para ninguém, e o «Usar o
// contacto de» dos contratos deixava de reconhecer a proprietária. A
// proprietária do exemplo é agora a pessoa da própria conta, e o contacto que
// os contratos levam é o dela — o que sobrevive à volta pelo servidor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo } from './arnes.js';

const EU = { id: 'U1', name: 'Conta de Teste', email: 'teste@rendorium.test' };

/* A app com uma sessão e os dados de exemplo carregados.
   Recebe: antes (opcional) — chamada com a app antes do seed (para pôr um perfil).
   Devolve: a app. */
function comExemplo(antes) {
  const app = carregarTudo();
  app.render = () => {}; app.buildNav = () => {}; app.toast = () => {};
  app.CW.user = Object.assign({}, EU);
  app.CW.ambiente = 'desenvolvimento';   // o seed() recusa-se em produção
  if (antes) antes(app);
  app.seed();
  app.clearTimeout(app.pushTimer);
  return app;
}

/* O estado que o servidor devolve depois de receber o que a página exporta:
   as casas são minhas (participantes: só eu), os registos de casa e os meus
   ficam como subiram. É a volta que a página dá ao recarregar.
   Recebe: app — a app com o exemplo carregado.
   Devolve: o estado ({houses, records, userRecords, profiles, …}). */
function estadoDoServidor(app) {
  const map = app.exportEntities();
  const st = { houses: [], records: [], userRecords: [], profiles: [{ userId: EU.id, name: EU.name }], collaborators: [], people: [], sharedGroups: [] };
  Object.keys(map).forEach((k) => {
    const e = JSON.parse(JSON.stringify(map[k]));
    if (e.scope === 'house') st.houses.push({ id: e.houseId, mine: true, ownerId: EU.id, ownerName: EU.name, participants: [EU.id], data: e.data });
    else if (e.scope === 'record') st.records.push({ houseId: e.houseId, kind: e.kind, id: e.id, data: e.data, updatedAt: 1, createdBy: EU.id });
    else st.userRecords.push({ kind: e.kind, id: e.id, data: e.data, updatedAt: 1 });
  });
  return st;
}

/* Os ids de pessoa a que os movimentos se referem (pago por, a quem, partes de uma divisão).
   Recebe: txs — os movimentos.
   Devolve: os ids (array, sem repetidos). */
function idsNosMovimentos(txs) {
  const ids = new Set();
  txs.forEach((t) => {
    if (t.paidBy) ids.add(t.paidBy);
    if (t.toId) ids.add(t.toId);
    Object.keys((t.split && t.split.parts) || {}).forEach((k) => ids.add(k));
  });
  return [...ids];
}

describe('o exemplo numa conta: a proprietária é a conta', () => {
  test('nenhum proprietário sem conta: os donos dos imóveis e quem paga são a própria conta', () => {
    const app = comExemplo();
    const db = app.db;
    assert.deepEqual([...db.owners.map((o) => o.id)], [EU.id], 'uma ficha só, a da conta (sem o Pedro Costa nem uma Maria sem conta)');
    db.properties.forEach((p) => assert.deepEqual([...p.ownerIds], [EU.id], p.name + ': dono'));
    assert.deepEqual(idsNosMovimentos(db.transactions), [EU.id], 'os «pago por» são da conta');
  });

  test('o perfil da conta leva o contacto do exemplo onde estava vazio, e sobe', () => {
    const app = comExemplo();
    const eu = app.db.owners[0];
    assert.equal(eu.name, EU.name, 'o nome da conta fica');
    assert.equal(eu.email, EU.email, 'o email é o da conta');
    assert.equal(eu.phone, '913 000 001');
    assert.equal(app.nifValido(eu.nif), true, 'NIF inventado que passa o dígito de controlo');
    const perfil = app.exportEntities()['u:profile:main'];
    assert.ok(perfil, 'o perfil sobe (u:profile:main)');
    assert.equal(perfil.data.phone, eu.phone);
    assert.equal(perfil.data.email, eu.email);
  });

  test('depois da volta pelo servidor ficam a proprietária, o contacto e o «Usar o contacto de»', () => {
    const app = comExemplo();
    const d = app.rebuildDb(estadoDoServidor(app));
    const eu = d.owners.find((o) => o.id === EU.id);
    assert.ok(eu, 'a conta é proprietária');
    assert.equal(eu.phone, '913 000 001', 'o telemóvel não se perde');
    assert.equal(eu.email, EU.email, 'nem o email');
    assert.equal(app.nifValido(eu.nif), true, 'nem o NIF');
    const semFicha = idsNosMovimentos(d.transactions).filter((id) => !d.owners.some((o) => o.id === id));
    assert.deepEqual(semFicha, [], 'nenhum «pago por» aponta para quem não existe');
    d.properties.forEach((p) => assert.deepEqual([...p.ownerIds], [EU.id], p.name + ': dono'));
    // o formulário do contrato, com a base refeita: reconhece a proprietária
    app.db = d;
    const comContacto = d.contracts.filter((c) => c.ownerEmail || c.ownerPhone);
    assert.ok(comContacto.length >= 2, 'c1 e c4 levam o contacto do senhorio');
    comContacto.forEach((c) => {
      app.cForm = JSON.parse(JSON.stringify(c));
      app.ctReconheceContactos();
      assert.equal(app.cForm.ownerContactId, EU.id, app.ctName(c) + ': «Usar o contacto de» a proprietária');
      const html = app.contactSect('owner', app.cForm, app.prop(c.propertyId));
      assert.match(html, /ct-contacto-escolhido"><span>Conta de Teste</, app.ctName(c) + ': o contacto escolhido mostra-se');
    });
  });

  test('um perfil já preenchido não é pisado: os contratos levam o contacto que lá está', () => {
    const app = comExemplo((a) => {
      const eu = a.normPerson({ name: 'Rita Lopes', email: 'rita@rendorium.test', phone: '919 999 999' });
      eu.id = EU.id;
      a.db.owners = [eu];
    });
    const eu = app.db.owners.find((o) => o.id === EU.id);
    assert.equal(eu.name, 'Rita Lopes');
    assert.equal(eu.email, 'rita@rendorium.test');
    assert.equal(eu.phone, '919 999 999');
    const comContacto = app.db.contracts.filter((c) => c.ownerEmail || c.ownerPhone);
    assert.ok(comContacto.length >= 2);
    comContacto.forEach((c) => {
      assert.equal(c.ownerEmail, 'rita@rendorium.test');
      assert.equal(c.ownerPhone, '919 999 999');
    });
  });
});

describe('o exemplo sem sessão', () => {
  test('uma proprietária só, a Maria Costa, com o contacto que os contratos usam', () => {
    const app = carregarTudo();
    app.CW.ambiente = 'desenvolvimento';
    app.seed();
    app.clearTimeout(app.pushTimer);
    const db = app.db;
    assert.equal(db.owners.length, 1, 'sem o Pedro Costa');
    const o = db.owners[0];
    assert.equal(o.name, 'Maria Costa');
    assert.equal(app.nifValido(o.nif), true);
    db.properties.forEach((p) => assert.deepEqual([...p.ownerIds], [o.id], p.name + ': dono'));
    assert.deepEqual(idsNosMovimentos(db.transactions), [o.id]);
    db.contracts.filter((c) => c.ownerEmail || c.ownerPhone).forEach((c) => {
      assert.equal(app.ctMesmoContacto(c.ownerEmail, c.ownerPhone, o), true, app.ctName(c) + ': o contacto é o da proprietária');
    });
  });
});
