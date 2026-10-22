// Num imóvel que não criei, «Apagar imóvel» é sair dele. O ⋯ da ficha, o do
// formulário e o toque longo de um imóvel colaborado ou partilhado comigo têm
// o «Apagar imóvel»; a confirmação diz que as permissões são retiradas, que
// não se desfaz e como se volta (ao comproprietário, também para onde vai a
// quota e que os saldos passam a contar com as quotas novas); confirmar chama
// DELETE /api/houses/<id>/participacao (cloud/partilha.js:CW.sairDaCasa) e
// relê o estado, e um erro do servidor não muda nada. Na seleção das Casas os
// meus apagam-se como sempre, com o Anular, e dos outros saio, numa só
// confirmação; uma saída que falhe não trava as outras e o aviso diz qual
// ficou. O «Deixar de colaborar» diz o mesmo.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, repor } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
const espera = () => new Promise((r) => setTimeout(r, 5));

const CONTAB = ['tx.view', 'tx.add', 'rec.view', 'rec.add', 'contract.view', 'report.view'];

/* O estado do servidor: a Minha (H1) é minha, com um contrato e um
   movimento; a Partilhada (H2) é do Rui, e sou comproprietário com a Ana
   (50/30/20); a Colab (H3) e a Outra colab (H4) são do Rui, onde colaboro
   como Contabilista pela mesma linha (C9); a Só nós (H5) é do Rui, só com ele
   e comigo, sem quotas escritas. */
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1, data: { id: 'H1', name: 'Minha' } },
    { id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU', 'ANA'], updatedAt: 1,
      data: { id: 'H2', name: 'Partilhada', ownerShares: { RUI: 50, EU: 30, ANA: 20 } } },
    { id: 'H3', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI'], updatedAt: 1, data: { id: 'H3', name: 'Colab' },
      collab: { id: 'C9', roleId: 'R1', roleName: 'Contabilista', perms: CONTAB } },
    { id: 'H4', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI'], updatedAt: 1, data: { id: 'H4', name: 'Outra colab' },
      collab: { id: 'C9', roleId: 'R1', roleName: 'Contabilista', perms: CONTAB } },
    { id: 'H5', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1, data: { id: 'H5', name: 'Só nós' } },
  ],
  records: [
    { houseId: 'H1', kind: 'contract', id: 'K1', updatedAt: 1, data: { id: 'K1', propertyId: 'H1', rent: 500, tenantIds: [] } },
    { houseId: 'H1', kind: 'tx', id: 'T1', updatedAt: 1, data: { id: 'T1', kind: 'income', label: 'Renda', amount: 500, date: '2026-01-02', propertyId: 'H1' } },
  ],
  userRecords: [],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }, { userId: 'ANA', name: 'Ana', data: null }],
  connections: [], roles: [], collaborators: [], invites: [], people: [],
  shareLink: null, shareRequests: { incoming: [], outgoing: [] },
  sharedGroupRequests: { incoming: [], outgoing: [] }, sharedGroups: [],
});

/* A app com o estado, a sessão e os espiões: esp.api as chamadas (esp.falha
   faz rejeitar as de um caminho), esp.toasts, esp.confirmados (aceites na
   hora, salvo com esp.naoConfirma), esp.desfazer o Anular do último apagar,
   esp.pulls e esp.fechos (closeAllModals).
   Devolve: esp. */
function montar() {
  const esp = { api: [], toasts: [], confirmados: [], desfazer: null, pulls: 0, fechos: 0, renders: 0, falha: null, naoConfirma: false };
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
  const st = ESTADO();
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  app.CW.selL = { tipo: null, ids: {} };
  app.tab = 'properties';
  app.txProp = '';
  app.dashProp = '';
  app.api = (method, p) => {
    esp.api.push(method + ' ' + p);
    return esp.falha && p.indexOf(esp.falha) > -1 ? Promise.reject(new Error('O servidor recusou')) : Promise.resolve({ ok: true });
  };
  app.toast = (m) => { esp.toasts.push(m); };
  app.confirmModal = (t, txt, sim) => { esp.confirmados.push({ t, txt }); if (!esp.naoConfirma) sim(); };
  app.comDesfazer = (m, restaurar) => { esp.toasts.push(m); esp.desfazer = restaurar; };
  app.render = () => { esp.renders++; };
  app.pullNow = (force) => { if (force) esp.pulls++; return Promise.resolve(); };
  app.save = () => {}; app.buildNav = () => {};
  app.closeAllModals = () => { esp.fechos++; };
  return esp;
}

describe('o «Apagar imóvel» de quem não criou o imóvel', () => {
  let esp;
  beforeEach(() => { esp = montar(); });

  test('a origem e o cargo vêm do estado: a H2 é partilhada, a H3 colaborada, e nenhuma das duas é minha', () => {
    assert.equal(app.origemDaCasa('H2'), 'partilhado');
    assert.equal(app.origemDaCasa('H3'), 'colaboro');
    assert.equal(app.imvComoSaio('H1'), '');
    assert.equal(app.imvComoSaio('H2'), 'comproprietario');
    assert.equal(app.imvComoSaio('H3'), 'colaborador');
    assert.equal(app.imvPossoSair('H1'), false, 'o meu apaga-se, não se sai dele');
    assert.equal(app.imvPossoSair('H2'), true);
    assert.equal(app.imvPossoApagar('H3'), true);
  });

  test('o ⋯ da ficha do colaborado e do partilhado tem «Apagar imóvel», vermelho, que vai ao delProp', () => {
    let ficha = null;
    app.abrirFicha = (o) => { ficha = o; return {}; };
    for (const id of ['H3', 'H2', 'H1']) {
      app.propView(id);
      const m = ficha.menu();
      assert.match(m, /<button type="button" class="danger" data-toca="dados" data-risco="destroi" data-click="closePops\(\);delProp\('H\d'\)">[\s\S]*? Apagar imóvel<\/button>/, id);
      assert.ok(m.includes("delProp('" + id + "')"), id);
    }
  });

  test('o ⋯ do formulário de um partilhado que edito também o tem, e o toque longo de um colaborado', () => {
    let menuDoForm = '';
    app.openModal = (t, corpo, pe, m) => { menuDoForm = m; return {}; };
    app.paintThumbs = () => {};
    app.propModal('H2');
    assert.match(menuDoForm, /delProp\('H2'\)">[\s\S]*? Apagar imóvel/);
    let opts = null;
    app.lpShow = (t, o) => { opts = o; };
    app.lpImovel(['prop', 'H3']);
    assert.ok(opts.some((o) => o.label === 'Apagar imóvel'), opts.map((o) => o.label).join(', '));
  });

  test('a frase do colaborador: as permissões saem, o registado fica com o dono, não se desfaz, e volta-se com um convite novo dele', () => {
    esp.naoConfirma = true;
    app.delProp('H3');
    assert.equal(esp.confirmados.length, 1);
    const q = esp.confirmados[0];
    assert.equal(q.t, 'Apagar «Colab»', 'o título começa por Apagar: o botão é o vermelho de sempre');
    assert.equal(q.txt, 'Deixas de colaborar em <b>Colab</b>: as tuas permissões neste imóvel são retiradas e ele sai da tua lista. ' +
      'O que registaste fica com Rui. Não se desfaz: para voltares a ter acesso, pede a Rui um convite novo.');
    assert.deepEqual(esp.api, [], 'sem o sim, nada vai ao servidor');
  });

  test('a frase do comproprietário: a quota e para quem vai, os saldos e o IRS pelas quotas novas, e quem tem de voltar a partilhar', () => {
    esp.naoConfirma = true;
    app.delProp('H2');
    const q = esp.confirmados[0];
    assert.equal(q.t, 'Apagar «Partilhada»');
    assert.match(q.txt, /^Deixas de ser comproprietário de <b>Partilhada<\/b>: as tuas permissões são retiradas e ele sai da tua lista\./);
    assert.match(q.txt, / A tua quota \(30%\) é dividida por Rui e Ana na proporção das quotas deles\. /);
    assert.match(q.txt, /Os saldos e o IRS do imóvel passam a contar com as quotas novas, também nos movimentos já registados\. O que registaste fica\./);
    assert.match(q.txt, /Não se desfaz: para voltares, Rui tem de voltar a partilhá-lo contigo\.$/);
    // só com o Rui e sem quotas escritas: metade, e passa para ele
    app.delProp('H5');
    assert.match(esp.confirmados[1].txt, / A tua quota \(50%\) passa para Rui\. /);
  });

  test('confirmar chama DELETE /api/houses/<id>/participacao, avisa, fecha as janelas, limpa os filtros e relê o estado', async () => {
    app.txProp = 'H3'; app.dashProp = 'H3';
    app.delProp('H3');
    await espera();
    assert.deepEqual(esp.api, ['DELETE /api/houses/H3/participacao']);
    assert.deepEqual(esp.toasts, ['Saíste de Colab.']);
    assert.equal(esp.fechos, 1, 'a ficha fecha');
    assert.equal(esp.pulls, 1, 'o pullNow(true)');
    assert.ok(esp.renders >= 1);
    assert.equal(app.txProp, ''); assert.equal(app.dashProp, '');
    assert.equal(esp.desfazer, null, 'sem Anular');
  });

  test('um erro do servidor diz a frase dele e não muda nada', async () => {
    esp.falha = '/participacao';
    const antes = app.db.properties.map((p) => p.id).join();
    app.txProp = 'H2';
    app.delProp('H2');
    await espera();
    assert.deepEqual(esp.toasts, ['O servidor recusou']);
    assert.equal(app.db.properties.map((p) => p.id).join(), antes);
    assert.equal(esp.fechos, 0, 'a ficha fica aberta');
    assert.equal(esp.pulls, 0);
    assert.equal(app.txProp, 'H2');
  });

  test('o delProp de um imóvel que não criei já não diz «só quem criou»: encaminha para a saída; o meu apaga-se como sempre', () => {
    esp.naoConfirma = true;
    app.delProp('H2');
    assert.ok(!esp.toasts.some((t) => /Só quem criou/.test(t)));
    assert.equal(esp.confirmados.length, 1);
    app.delProp('H1');
    assert.equal(esp.confirmados[1].t, 'Apagar imóvel');
    assert.equal(esp.confirmados[1].txt, 'Apagar “Minha”, o seu contrato e todos os movimentos associados?', 'com um contrato, no singular');
  });

  test('CW.sairDaCasa só chama a rota e devolve a promessa, sem perguntar', async () => {
    const r = app.CW.sairDaCasa('H9');
    assert.equal(typeof r.then, 'function');
    assert.deepEqual(await r, { ok: true });
    assert.deepEqual(esp.api, ['DELETE /api/houses/H9/participacao']);
    assert.equal(esp.confirmados.length, 0);
  });
});

describe('a seleção das Casas', () => {
  let esp;
  beforeEach(() => { esp = montar(); });

  test('os imóveis que não criei marcam-se', () => {
    for (const id of ['H2', 'H3']) assert.equal(app.selLRecusa('prop', id), '', id);
    app.lpLongo('prop:H3');
    app.CW.selLTocar('prop', 'H2');
    assert.deepEqual(Object.keys(app.CW.selL.ids).sort(), ['H2', 'H3']);
  });

  test('só os meus: como sempre — o que vai junto, apagar na base e o Anular, nada ao servidor', () => {
    app.CW.selL = { tipo: 'prop', ids: { H1: 1 } };
    app.CW.selLApagar();
    assert.equal(esp.confirmados.length, 1);
    assert.deepEqual(esp.confirmados[0], { t: 'Apagar 1 imóvel', txt: 'Vão junto 1 contrato e 1 movimento.' });
    assert.deepEqual(esp.api, []);
    assert.ok(!app.db.properties.some((p) => p.id === 'H1'));
    assert.equal(esp.toasts.at(-1), '1 imóvel apagado.');
    esp.desfazer();
    assert.ok(app.db.properties.some((p) => p.id === 'H1'), 'o Anular repõe');
    assert.ok(app.db.contracts.some((c) => c.id === 'K1'));
  });

  test('só de outros: uma confirmação «Apagar», as saídas no servidor, sem Anular, e o estado relido', async () => {
    app.CW.selL = { tipo: 'prop', ids: { H2: 1, H3: 1 } };
    app.CW.selLApagar();
    await espera();
    assert.equal(esp.confirmados.length, 1);
    const q = esp.confirmados[0];
    assert.equal(q.t, 'Apagar 2 imóveis');
    assert.match(q.txt, /^Sais de <b>Partilhada<\/b> e <b>Colab<\/b>: as tuas permissões neles são retiradas e saem da tua lista\./);
    assert.match(q.txt, /Em <b>Partilhada<\/b>, de que és comproprietário, a tua quota é dividida pelos restantes na proporção das quotas deles/);
    assert.match(q.txt, /Não se desfaz: para voltares a um deles, o dono tem de te enviar um convite novo ou voltar a partilhá-lo contigo\.$/);
    assert.ok(!/Anular/.test(q.txt));
    assert.deepEqual(esp.api.sort(), ['DELETE /api/houses/H2/participacao', 'DELETE /api/houses/H3/participacao']);
    assert.equal(app.db.properties.length, 5, 'nada sai da base à mão: sai pelo estado relido');
    assert.equal(esp.desfazer, null, 'sem Anular');
    assert.equal(esp.toasts.at(-1), 'Saíste de 2 imóveis.');
    assert.equal(esp.pulls, 1);
    assert.equal(app.CW.selL.tipo, null, 'sai da seleção');
  });

  test('um só de outro: a frase é a da ficha', () => {
    esp.naoConfirma = true;
    app.CW.selL = { tipo: 'prop', ids: { H3: 1 } };
    app.CW.selLApagar();
    assert.equal(esp.confirmados[0].t, 'Apagar 1 imóvel');
    assert.equal(esp.confirmados[0].txt, app.imvFraseSaida(app.prop('H3')));
  });

  test('mista: UMA confirmação com os dois lados, o Anular só repõe os meus, e uma saída que falha não trava a outra', async () => {
    esp.falha = '/houses/H2/';
    app.CW.selL = { tipo: 'prop', ids: { H1: 1, H2: 1, H3: 1 } };
    app.CW.selLApagar();
    await espera();
    assert.equal(esp.confirmados.length, 1, 'uma confirmação só');
    const q = esp.confirmados[0];
    assert.equal(q.t, 'Apagar 1 imóvel e sair de 2');
    assert.match(q.txt, /^O teu <b>Minha<\/b> é apagado\. Vão junto 1 contrato e 1 movimento\. Sais de <b>Partilhada<\/b> e <b>Colab<\/b>/);
    assert.match(q.txt, / O Anular só repõe o teu\.$/);
    assert.deepEqual(esp.api.sort(), ['DELETE /api/houses/H2/participacao', 'DELETE /api/houses/H3/participacao']);
    assert.ok(!app.db.properties.some((p) => p.id === 'H1'), 'o meu sai da base');
    assert.equal(esp.toasts.at(-1), '1 imóvel apagado. Saíste de 1 imóvel. «Partilhada» ficou como estava: O servidor recusou.');
    assert.equal(esp.pulls, 1, 'houve uma saída: relê');
    esp.desfazer();
    assert.ok(app.db.properties.some((p) => p.id === 'H1'), 'o Anular repõe o meu');
    assert.equal(app.db.properties.filter((p) => p.id === 'H3').length, 1, 'e não mexe nos outros');
  });

  test('todas as saídas falham: o aviso diz quais e porquê, e não se relê nada', async () => {
    esp.falha = '/participacao';
    app.CW.selL = { tipo: 'prop', ids: { H3: 1, H4: 1 } };
    app.CW.selLApagar();
    await espera();
    assert.equal(esp.toasts.at(-1), '«Colab», «Outra colab» ficaram como estavam: O servidor recusou.');
    assert.equal(esp.pulls, 0);
    assert.match(esp.confirmados[0].txt, /Não se desfaz: para voltares a um deles, pede ao dono um convite novo\.$/, 'só colaborados');
  });
});

describe('o «Deixar de colaborar»', () => {
  let esp;
  beforeEach(() => { esp = montar(); });

  test('diz que as permissões saem em todos esses imóveis, que não se desfaz e que é preciso um convite novo do dono', async () => {
    app.CW.sairDeImovel('C9');
    await espera();
    const q = esp.confirmados[0];
    assert.equal(q.t, 'Sair de 2 imóveis');
    assert.equal(q.txt, 'Deixas de colaborar em <b>Colab, Outra colab</b>: as tuas permissões nesses imóveis são retiradas e eles saem da tua lista. ' +
      'O que registaste fica com Rui. Não se desfaz: para voltares a ter acesso, pede a Rui um convite novo.');
    assert.deepEqual(esp.api, ['DELETE /api/collaborators/C9'], 'sai de todos pela linha de colaboração');
  });
});
