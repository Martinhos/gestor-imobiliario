// O sino: a atividade dos outros nas casas partilhadas (com autor vindo do
// servidor), a contagem do crachá, e a marca de leitura que impede o
// primeiro arranque de despejar o histórico inteiro.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));

function monta() {
  app.CW = { user: { id: 'EU' } };
  app.window.CW = app.CW;
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
  app.db.owners = [app.normPerson({ id: 'ELA', name: 'Maria Costa' })];
  app.db.tenants = []; app.db.visits = []; app.db.recurring = [];
  app.db.transactions = [];
  app.db.settings.notifLidoAte = 1000;   // marca posta: nada de inundacao
}

describe('a atividade partilhada', () => {
  test('so conta o que OUTROS fizeram depois da marca, com nome e destino', () => {
    monta();
    const meu = app.normTx({ id: 'T1', label: 'Renda', propertyId: 'P1' });
    meu._author = 'EU'; meu._atServidor = 5000;
    const dela = app.normTx({ id: 'T2', label: 'Obra da cozinha', propertyId: 'P1' });
    dela._author = 'ELA'; dela._atServidor = 6000;
    const velho = app.normTx({ id: 'T3', label: 'Antiga', propertyId: 'P1' });
    velho._author = 'ELA'; velho._atServidor = 500;
    app.db.transactions = [meu, dela, velho];
    const l = app.notifPartilha();
    assert.equal(l.length, 1, 'nem o meu, nem o anterior a marca');
    assert.match(l[0].titulo, /Obra da cozinha/);
    assert.match(l[0].sub, /Maria Costa/);
    assert.match(l[0].sub, /T2 Lisboa/);
    assert.match(l[0].ir, /transactions/);
  });

  test('sem marca nenhuma, a primeira chamada poe a marca em agora e devolve vazio', () => {
    monta();
    delete app.db.settings.notifLidoAte;
    const dela = app.normTx({ id: 'T2', label: 'Historica', propertyId: 'P1' });
    dela._author = 'ELA'; dela._atServidor = 6000;
    app.db.transactions = [dela];
    assert.equal(app.notifPartilha().length, 0, 'o historico antigo nao inunda');
    assert.ok(app.db.settings.notifLidoAte > 0, 'a marca ficou posta');
  });

  /* Parte da conta vem do aparelho e parte do servidor. Ao abrir, a app pinta
     com o que tem em casa — e se esses planeados já foram confirmados noutro
     lado, o sino anunciava um atraso que já não existe e corrigia-se um
     segundo depois. Um número errado durante um segundo é pior do que
     nenhum. */
  test('o crachá espera por saber: nada até o servidor ter falado', () => {
    monta();
    app.tab = 'dashboard';
    // um planeado em atraso, do que está guardado no aparelho
    app.db.recurring = [app.normRec({
      id: 'R1', name: 'Renda', every: 'month', next: '2000-01-01',
      tx: { kind: 'income', amount: 500, propertyId: 'P1' },
    })];
    assert.equal(app.notifConta(), 1, 'a conta em si sabe que há um atrasado');

    // o #hdrBell do arnês é sempre o mesmo elemento: lê-se o que o sino lá escreveu
    const sino = app.document.getElementById('hdrBell');

    // ainda não falámos com o servidor
    delete app.CW._esperaFim;
    app.notifSino();
    assert.doesNotMatch(sino.innerHTML, /class="cnt/, 'sem crachá enquanto não se sabe');

    // e depois de a espera acabar
    app.CW._esperaFim = 1;
    app.notifSino();
    assert.match(sino.innerHTML, /class="cnt/, 'agora sim');
    assert.match(sino.innerHTML, />1</, 'e com o número certo');

    // sem nuvem nenhuma, não há nada por que esperar
    app.window.CW = undefined; app.CW = undefined;
    app.notifSino();
    assert.match(sino.innerHTML, /class="cnt/, 'numa app sem nuvem, aparece logo');
    monta();
  });

  /* A espera é curta de propósito. Sem rede o servidor nunca fala, e um sino
     calado para sempre num aparelho offline era trocar um erro de um segundo
     por um silêncio permanente: o que está no aparelho passa a ser tudo o que
     há, e diz-se. */
  test('a espera acaba mesmo sem servidor: offline, o aparelho fala por si', () => {
    monta();
    app.tab = 'dashboard';
    app.db.recurring = [app.normRec({
      id: 'R1', name: 'Renda', every: 'month', next: '2000-01-01',
      tx: { kind: 'income', amount: 500, propertyId: 'P1' },
    })];
    const sino = app.document.getElementById('hdrBell');

    delete app.CW._esperaFim;
    app.notifSino();
    assert.doesNotMatch(sino.innerHTML, /class="cnt/, 'enquanto se espera, cala-se');

    /* o pedido falhou: NÃO há _pulled — a página dos cargos continua a poder
       distinguir «não tens» de «ainda não sabemos» —, mas a espera acabou */
    app.CW._esperaFim = 1;
    app.notifSino();
    assert.ok(!app.CW._pulled, 'sem rede, o servidor continua sem ter falado');
    assert.match(sino.innerHTML, /class="cnt/, 'e mesmo assim o sino conta o que há');
    monta();
  });

  /* Os três sítios que afirmavam a mesma coisa cedo de mais: o sino, o cartão
     dos «por confirmar» e o aviso do arranque. O cartão é o mais visível — um
     movimento por confirmar que já foi confirmado noutro aparelho aparecia e
     desaparecia à frente de quem estava a olhar. */
  test('o cartão dos por confirmar também espera pela espera', () => {
    monta();
    app.db.recurring = [app.normRec({
      id: 'R1', name: 'Renda', every: 'month', next: '2000-01-01',
      tx: { kind: 'income', amount: 500, propertyId: 'P1' },
    })];
    assert.ok(app.recActive().length, 'há mesmo um planeado no aparelho');

    delete app.CW._esperaFim;
    assert.equal(app.pendingCard(), '', 'nada se afirma antes de a espera acabar');

    app.CW._esperaFim = 1;
    assert.match(app.pendingCard(), /confirmar/i, 'acabada a espera, o cartão aparece');
    monta();
  });

  test('o crachá soma atrasados e partilha; marcar lido cala a partilha', () => {
    monta();
    const dela = app.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P1', date: '2999-01-01' });
    dela._author = 'ELA'; dela._atServidor = Date.now();
    app.db.visits = [dela];
    assert.equal(app.notifConta(), 1);
    app.closeModal = () => {}; app.render = () => {};   // o DOM falso nao renderiza paineis
    app.notifLido();
    assert.equal(app.notifConta(), 0, 'depois de lido, silencio');
  });
});

describe('o modal e a tabbar', () => {
  test('o modal tem as seccoes e a linha da partilha leva ao sitio certo', () => {
    monta();
    const dela = app.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P1', date: '2999-01-01' });
    dela._author = 'ELA'; dela._atServidor = Date.now();
    app.db.visits = [dela];
    // renderizar o corpo sem abrir modal a serio
    let corpo = '';
    const openReal = app.openModal;
    app.openModal = (t, b) => { corpo = b; };
    app.notifModal();
    app.openModal = openReal;
    assert.match(corpo, /Nas casas partilhadas/);
    assert.match(corpo, /Visita — Ana/);
    assert.match(corpo, /Maria Costa/);
  });

  test('um prazo que calha hoje diz «hoje», nunca «hoje dias»', () => {
    monta();
    const openReal = app.openModal, pzReal = app.prazosAtivos;
    let corpo = '';
    app.openModal = (t, b2) => { corpo = b2; };
    app.prazosAtivos = () => [{ titulo: 'Fim do contrato', dias: 0, abrir: "go('contracts')", urg: 'urgente' }];
    app.notifModal();
    app.openModal = openReal; app.prazosAtivos = pzReal;
    assert.match(corpo, /hoje</, 'o «hoje» fecha sem sufixo');
    assert.doesNotMatch(corpo, /hoje dias/);
  });

  test('a barra de baixo leva o Calendario no lugar dos Planeados', () => {
    assert.deepEqual(Array.from(app.TABBAR), ['dashboard', 'transactions', 'properties', 'calendar']);
  });
});
