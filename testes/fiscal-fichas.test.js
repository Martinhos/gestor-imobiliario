// As fichas e os formulários do imóvel e da pessoa com o que o Anexo F pede:
// no imóvel, distrito, código da freguesia, tipo de prédio, tipologia, VPT e
// data de aquisição; na pessoa, o país e, no inquilino, a retenção na fonte —
// e o aviso de um NIF que não bate certo. É o HTML que as vistas geram e o
// que os formulários leem de volta, sem browser.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp();
beforeEach(() => limpar(app));
afterEach(() => repor(app));

/* Lê os campos do formulário como se a pessoa os tivesse escrito: o documento
   falso do arnês guarda um elemento por id, e aqui dá-se-lhe o valor (ou o
   «checked») de cada id que interessa quando o formulário o pede. Devolve a
   função que repõe o documento como estava. */
function comCampos(valores) {
  const doc = app.document, original = doc.getElementById;
  doc.getElementById = (id) => {
    const el = original(id);
    if (id in valores) { if (typeof valores[id] === 'boolean') el.checked = valores[id]; else el.value = valores[id]; }
    return el;
  };
  return () => { doc.getElementById = original; };
}

describe('o formulário do imóvel', () => {
  test('tem os campos fiscais, e o resumo da dobra diz o código da freguesia', () => {
    app.pForm = app.normProp({ id: 'p1', name: 'T2', distrito: 'Coimbra', freguesiaCodigo: '110623', tipoPredio: 'U', tipologia: 'T2', vpt: 85000, purchaseDate: '2019-04-20' });
    const html = app.propBody();
    for (const id of ['p_distrito', 'p_freguesiaCodigo', 'p_tipoPredio', 'p_tipologia', 'p_vpt', 'p_purchaseDate']) {
      assert.ok(html.includes('id="' + id + '"'), 'tem o campo ' + id);
    }
    assert.match(html, /id="p_freguesiaCodigo"[^>]*maxlength="6"/, 'o código tem seis dígitos, e o campo não deixa escrever mais');
    assert.match(html, /id="p_purchaseDate" type="date" value="2019-04-20"/);
    assert.ok(html.includes('value="Coimbra"'));
    assert.ok(html.includes('freguesia n.º 110623'), 'o resumo da dobra, visível mesmo fechada');
    assert.ok(html.includes('caderneta predial'), 'a dica diz onde se vai buscar o código');
  });

  test('sem código, o resumo da dobra não o inventa', () => {
    app.pForm = app.normProp({ id: 'p1', name: 'T2', freguesia: 'Soure' });
    const html = app.propBody();
    assert.ok(!html.includes('freguesia n.º'));
    assert.ok(html.includes('Soure'));
  });

  test('collectProp lê os campos novos de volta, e o VPT nunca fica negativo', () => {
    app.pForm = app.normProp({ id: 'p1', name: 'T2' });
    const repor = comCampos({ p_name: 'T2', p_distrito: 'Coimbra', p_freguesiaCodigo: ' 110623 ', p_tipoPredio: 'R', p_tipologia: 'T3', p_vpt: '85 000', p_purchaseDate: '2019-04-20' });
    try { app.collectProp(); } finally { repor(); }
    const p = app.pForm;
    assert.equal(p.distrito, 'Coimbra');
    assert.equal(p.freguesiaCodigo, '110623', 'sem os espaços à volta');
    assert.equal(p.tipoPredio, 'R');
    assert.equal(p.tipologia, 'T3');
    assert.equal(p.vpt, 85000);
    assert.equal(p.purchaseDate, '2019-04-20');
    const repor2 = comCampos({ p_name: 'T2', p_vpt: '-5' });
    try { app.collectProp(); } finally { repor2(); }
    assert.equal(app.pForm.vpt, 0);
  });

  test('ao guardar, um código de freguesia que não tem seis dígitos é apontado e nada se grava', () => {
    const avisos = [];
    const toast = app.toast, openModal = app.openModal, paintThumbs = app.paintThumbs, render = app.render, closeModal = app.closeModal;
    app.toast = (m) => avisos.push(m);
    app.openModal = () => {};            // o fillModal precisa de um DOM a sério
    app.paintThumbs = () => {};
    app.render = () => {};
    app.closeModal = () => {};
    app.modalStack.push({ onSave: null });   // a camada onde o propModal pendura o onSave
    try {
      app.propModal();
      const repor = comCampos({ p_name: 'Casa', p_freguesiaCodigo: '1106' });
      try { app.onSave(); } finally { repor(); }
      assert.deepEqual(avisos, ['O código da freguesia tem 6 dígitos.']);
      assert.equal(app.db.properties.length, 0, 'não gravou');
      // com seis dígitos grava; e vazio também, que o código é opcional
      const repor2 = comCampos({ p_name: 'Casa', p_freguesiaCodigo: '110623' });
      try { app.onSave(); } finally { repor2(); }
      assert.equal(app.db.properties.length, 1);
      assert.equal(app.db.properties[0].freguesiaCodigo, '110623');
      assert.equal(avisos[avisos.length - 1], 'Imóvel adicionado.');
    } finally {
      app.modalStack.length = 0;
      app.toast = toast; app.openModal = openModal; app.paintThumbs = paintThumbs; app.render = render; app.closeModal = closeModal;
    }
  });
});

describe('a ficha do imóvel', () => {
  test('os dados registais dizem o código, o tipo e a tipologia; a linha fiscal, o VPT e a data', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'T2', freguesia: 'Soure', distrito: 'Coimbra', freguesiaCodigo: '110623', tipoPredio: 'U', tipologia: 'T2', vpt: 85000, purchaseDate: '2019-04-20' }));
    const html = app.propFicha('p1');
    assert.ok(html.includes('freguesia n.º 110623'));
    assert.ok(html.includes('urbano'));
    assert.ok(html.includes('T2'));
    assert.ok(html.includes('Coimbra'));
    assert.ok(html.includes('Fiscal'));
    assert.ok(html.includes('VPT ' + app.euro(85000)));
    assert.ok(html.includes('adquirido a 20/04/2019'));
  });

  test('rústico lê-se por extenso, e sem VPT nem data não há linha fiscal', () => {
    app.db.properties.push(app.normProp({ id: 'p1', name: 'Terreno', tipoPredio: 'R' }));
    const html = app.propFicha('p1');
    assert.ok(html.includes('rústico'));
    assert.ok(!html.includes('Fiscal'));
    assert.ok(!html.includes('adquirido a'));
  });
});

describe('o formulário da pessoa', () => {
  test('o inquilino tem o país e a retenção na fonte', () => {
    app.perKind = 'tenant';
    app.perForm = app.normPerson({ id: 't1', name: 'Ana', pais: 'Espanha', retem: true });
    const html = app.personBody();
    assert.ok(html.includes('id="pe_pais"'));
    assert.ok(html.includes('value="Espanha"'));
    assert.match(html, /id="pe_retem" checked/);
    assert.ok(html.includes('Retém IRS na fonte'));
    assert.ok(html.includes('id="pe_nifHint"'));
  });

  test('o proprietário tem o país mas não a retenção', () => {
    app.perKind = 'owner';
    app.perForm = app.normPerson({ id: 'o1', name: 'Bruno' });
    const html = app.personBody();
    assert.ok(html.includes('id="pe_pais"'));
    assert.ok(!html.includes('pe_retem'));
  });

  test('a dica do NIF só fala quando o dígito de controlo falha', () => {
    assert.equal(app.pessoaNifHint('123456780'), 'Este NIF não bate certo: confere os dígitos.');
    assert.equal(app.pessoaNifHint('123456789'), '');
    assert.equal(app.pessoaNifHint(''), '', 'vazio não se julga');
    app.perKind = 'tenant';
    app.perForm = app.normPerson({ id: 't1', name: 'Ana', nif: '123456780' });
    assert.ok(app.personBody().includes('não bate certo'), 'a dica já vem preenchida ao abrir');
    app.perForm = app.normPerson({ id: 't1', name: 'Ana', nif: '123456789' });
    const html = app.personBody();
    assert.ok(!html.includes('não bate certo'));
    assert.match(html, /id="pe_nifHint"[^>]*hidden/, 'sem nada a dizer, a dica não ocupa espaço');
  });

  test('collectPerson lê o país e, no inquilino, a retenção', () => {
    app.perKind = 'tenant';
    app.perForm = app.normPerson({ id: 't1', name: 'Ana' });
    const repor = comCampos({ pe_name: 'Ana', pe_pais: 'França', pe_retem: true });
    try { app.collectPerson(); } finally { repor(); }
    assert.equal(app.perForm.pais, 'França');
    assert.equal(app.perForm.retem, true);
  });
});

describe('a ficha da pessoa', () => {
  test('o inquilino que retém e tem um NIF que não bate certo lê-se assim', () => {
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Ana', nif: '123456780', retem: true, pais: 'Espanha' }));
    const html = app.personFicha('tenant', 't1');
    assert.ok(html.includes('Retenção na fonte'));
    assert.ok(html.includes('retém IRS ao pagar a renda'));
    assert.ok(html.includes('NIF 123 456 780 · não bate certo'));
    assert.ok(html.includes('País: Espanha'));
    assert.ok(!html.includes('Esta ficha só tem o nome'), 'a ficha não está vazia');
  });

  test('um NIF certo não leva aviso, e um proprietário nunca tem a linha da retenção', () => {
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Ana', nif: '123456789' }));
    const html = app.personFicha('tenant', 't1');
    assert.ok(html.includes('NIF 123 456 789'));
    assert.ok(!html.includes('não bate certo'));
    assert.ok(!html.includes('Retenção na fonte'));
    app.db.owners.push(app.normPerson({ id: 'o1', name: 'Bruno', retem: true }));
    assert.ok(!app.personFicha('owner', 'o1').includes('Retenção na fonte'));
  });

  test('só a retenção já chega para a ficha não estar vazia', () => {
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Ana', retem: true }));
    assert.ok(!app.personFicha('tenant', 't1').includes('Esta ficha só tem o nome'));
    app.db.tenants.push(app.normPerson({ id: 't2', name: 'Rui' }));
    assert.ok(app.personFicha('tenant', 't2').includes('Esta ficha só tem o nome'));
  });
});
