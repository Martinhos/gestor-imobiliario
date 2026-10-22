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
    assert.match(corpo, /Atividade nas casas partilhadas/);
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

  // o corpo do «Pede atenção», com os planeados e os prazos dados
  function corpoCom(recs, prazos) {
    const openReal = app.openModal, recReal = app.recActive, pzReal = app.prazosAtivos;
    let corpo = '';
    app.openModal = (t, b) => { corpo = b; };
    app.recActive = () => recs;
    app.prazosAtivos = () => prazos;
    try { app.notifModal(); } finally { app.openModal = openReal; app.recActive = recReal; app.prazosAtivos = pzReal; }
    return corpo;
  }
  const rec = (id, kind, amount) => app.normRec({ id, name: 'Planeado ' + id, every: 'month', next: app.today(),
    tx: { kind, label: 'x', amount, propertyId: 'P1' } });

  test('Confirmar e Silenciar refazem a janela com o mesmo filtro: a linha confirmada não fica à vista com a data antiga', () => {
    monta();
    const corpo = corpoCom([rec('r1', 'income', 800)], []);
    const conf = /<button[^>]*data-click="([^"]*)">Confirmar</.exec(corpo);
    assert.ok(conf, 'controlo: há um Confirmar');
    assert.equal(conf[1], "quickConfirmRec('r1');notifModal('')", 'confirma e refaz a janela');
    const sil = /<button[^>]*data-click="([^"]*)">Silenciar</.exec(corpo);
    assert.ok(sil && /;notifModal\(''\)$/.test(sil[1]), 'o Silenciar também');
  });

  test('o valor de um por confirmar tem a cor do dinheiro dele, como nos Planeados: prestação roxa, despesa laranja, as duas com «−», transferência sem cor nem sinal', () => {
    monta();
    const corpo = corpoCom([rec('r1', 'loan', 716.54), rec('r2', 'expense', 50), rec('r3', 'income', 800), rec('r4', 'settle', 30)], []);
    const valores = [...corpo.matchAll(/<b class="(num[^"]*)">([^<]*)<\/b>/g)].map((m) => [m[1], m[2]]);
    assert.equal(valores.length, 4, 'controlo: quatro valores');
    const de = (n) => valores.find((v) => v[1].includes(n));
    assert.equal(de('716,54')[0], 'num prest', 'prestação: roxa');
    assert.ok(de('716,54')[1].startsWith('−'), 'a prestação sai: leva o «−» (planeados.js:recValor)');
    assert.equal(de('50,00')[0], 'num neg');
    assert.ok(de('50,00')[1].startsWith('−'));
    assert.equal(de('800,00')[0], 'num pos');
    assert.deepEqual([de('30,00')[0], de('30,00')[1].includes('−')], ['num', false], 'a transferência não tem cor nem sinal');
  });

  test('um prazo diz quanto falta como o cartão («Falta 1 dia»), e um sem destino não se apresenta como tocável', () => {
    monta();
    const corpo = corpoCom([], [
      { titulo: 'Comunicar à AT', dias: 1, abrir: "go('contracts')", urg: 'urgente' },
      { titulo: 'Seguro a renovar', dias: 20, abrir: '', urg: 'breve' },
    ]);
    assert.match(corpo, />Falta 1 dia</);
    assert.doesNotMatch(corpo, /Faltam 1 dia/);
    assert.match(corpo, /<button type="button" class="atencao-linha tap"[^>]*data-click="closeModal\(\);go\('contracts'\)">[\s\S]*?Comunicar à AT/);
    assert.match(corpo, /<div class="atencao-linha"><div class="atencao-txt"><p class="title">Seguro a renovar/, 'sem destino: uma linha, não um botão');
    assert.doesNotMatch(corpo, /data-click="closeModal\(\);"/, 'nenhum toque que só fecha a janela');
    assert.match(corpo, /<span class="badge amber">Faltam 20 dias</);
  });

  test('o sino diz o nome da janela que abre, com a contagem, e não só o número', () => {
    monta();
    const b = app.document.getElementById('hdrBell');
    const attrs = {};
    const setReal = b.setAttribute, contaReal = app.notifConta;
    b.setAttribute = (k, v) => { attrs[k] = v; };
    app.tab = 'dashboard';
    try {
      app.CW._esperaFim = true; // o crachá espera pelo servidor (espera.js:sabemosOEstado)
      app.notifConta = () => 4;
      app.notifSino();
      assert.equal(attrs['aria-label'], 'Pede atenção: 4 por ver');
      assert.equal(b.title, 'Pede atenção: 4 por ver');
      app.notifConta = () => 0;
      app.notifSino();
      assert.equal(attrs['aria-label'], 'Pede atenção');
    } finally {
      b.setAttribute = setReal; app.notifConta = contaReal;
    }
  });

  test('a barra de baixo tem o Inicio, as duas areas (Casas e Dinheiro) e a Agenda', () => {
    assert.deepEqual(Array.from(app.TABBAR), ['dashboard', 'casas', 'dinheiro', 'calendar']);
  });
});

/* Os pedidos para entrar num grupo meu chegam ao sino como os de partilha, e
   respondem-se ali; e um movimento de varios imoveis (um lote) vive partido
   numa parte por imovel — o sino conta-o uma vez, pelo lote.id. */
describe('os pedidos de grupo e os lotes no sino', () => {
  const cru = (x) => JSON.parse(JSON.stringify(x));
  const PEDIDOS = () => ({
    shareRequests: { incoming: [{ id: 'q1', fromName: 'Ana', houseName: 'T4 Porto' }] },
    sharedGroupRequests: {
      incoming: [{ groupId: 'G2', groupName: 'Família', userId: 'ZE', name: 'Zé', createdAt: 1 }],
      outgoing: [{ groupId: 'G7', groupName: 'Casas de Faro', ownerName: 'Tó', createdAt: 1 }],
    },
  });
  // uma parte de um lote, escrita por outra pessoa a uma hora do servidor
  const parte = (loteId, pid, alvo, n, autor, at, label) => {
    const t = app.normTx({ id: loteId + '_' + pid, kind: 'expense', label: label || 'Seguro multirriscos', amount: 40, date: '2026-09-01', propertyId: pid });
    t.lote = { id: loteId, n, total: 40 * n, alvo, modo: 'equal', partes: {} };
    t._author = autor; t._atServidor = at;
    return t;
  };

  test('notifPedidos inclui o pedido de grupo (o que eu fiz não), que conta no crachá, e o modal responde por notifGrupoAceitar/notifGrupoRecusar', () => {
    monta();
    app.CW.state = PEDIDOS();
    const l = cru(app.notifPedidos());
    assert.equal(l.length, 2, 'o de partilha e o de grupo');
    assert.deepEqual(l[1], { id: 'grupo:G2:ZE', tipo: 'grupo', gid: 'G2', uid: 'ZE',
      titulo: 'Zé quer entrar no grupo «Família»', sub: 'Se aceitares, passa a comproprietário dos imóveis do grupo.' });
    assert.equal(app.notifConta(), 2);
    let corpo = '';
    app.openModal = (t, b) => { corpo = b; };
    app.notifModal();
    assert.match(corpo, /<h3>Pedidos por responder<\/h3>/);
    assert.match(corpo, /Zé quer entrar no grupo «Família»/);
    assert.match(corpo, /data-toca="dados" data-click="notifGrupoAceitar\('G2','ZE'\)">Aceitar</);
    assert.match(corpo, /data-toca="dados" data-click="notifGrupoRecusar\('G2','ZE'\)">Recusar</);
    assert.match(corpo, /data-click="notifPedidoAceitar\('q1'\)"/, 'o de partilha continua pelo seu');
    assert.ok(!corpo.includes('Casas de Faro'), 'o pedido que fiz não se responde aqui');
    assert.ok(!/on[a-z]+=|style=/.test(corpo), 'nada em linha');
  });

  test('notifGrupoAceitar e notifGrupoRecusar fecham o sino primeiro e respondem pela nuvem; sem ela, só fecham', () => {
    monta();
    const ordem = [];
    app.closeModal = () => { ordem.push('fechar'); };
    app.CW.grupoAceitarPedido = (g, u) => { ordem.push('aceitar ' + g + ' ' + u); };
    app.CW.grupoRecusarPedido = (g, u) => { ordem.push('recusar ' + g + ' ' + u); };
    app.notifGrupoAceitar('G2', 'ZE');
    app.notifGrupoRecusar('G2', 'LU');
    assert.deepEqual(ordem, ['fechar', 'aceitar G2 ZE', 'fechar', 'recusar G2 LU']);
    // a nuvem sem o ficheiro dos grupos, e sem nuvem nenhuma
    app.CW = { user: { id: 'EU' } }; app.window.CW = app.CW;
    assert.doesNotThrow(() => app.notifGrupoAceitar('G2', 'ZE'));
    app.window.CW = undefined; app.CW = undefined;
    assert.doesNotThrow(() => app.notifGrupoRecusar('G2', 'ZE'));
    assert.equal(ordem.filter((x) => x === 'fechar').length, 4, 'e fecha sempre');
    monta();
  });

  test('com os Colaboradores desligados o pedido de grupo não entra no sino; um estado sem a lista (de antes da regra) também não rebenta', () => {
    monta();
    app.CW.state = { sharedGroupRequests: PEDIDOS().sharedGroupRequests };
    assert.equal(app.notifPedidos().length, 1);
    app.definirServicosDesligados(['colaboradores']);
    try {
      assert.equal(app.notifPedidos().length, 0);
      assert.equal(app.notifConta(), 0);
    } finally {
      app.definirServicosDesligados([]);
    }
    app.CW.state = { shareRequests: { incoming: [] } };
    assert.deepEqual(cru(app.notifPedidos()), []);
    app.CW.state = { sharedGroupRequests: { incoming: [{ groupId: 'G2' }, null] } };
    assert.deepEqual(cru(app.notifPedidos()), [], 'sem a pessoa não há o que aceitar');
    // um grupo partilhado que está na base e não é meu: o sino não oferece aceitar
    app.db.groups = [Object.assign(app.normGroup({ id: 'G2', kind: 'prop', name: 'Família', ids: [] }), { _partilhado: true, _meu: false })];
    app.CW.state = { sharedGroupRequests: PEDIDOS().sharedGroupRequests };
    assert.equal(app.notifPedidos().length, 0, 'nenhum botão de aceitar a quem não é dono');
    app.db.groups[0]._meu = true;
    assert.equal(app.notifPedidos().length, 1, 'controlo: sendo meu, entra');
  });

  test('notifPartilha conta um lote de três partes uma vez, com o título do lote, o grupo e os imóveis, e a hora da parte mais nova', () => {
    monta();
    app.db.properties = ['P1', 'P2', 'P3'].map((id, i) => app.normProp({ id, name: 'Casa ' + (i + 1) }));
    app.db.groups = [app.normGroup({ id: 'G1', kind: 'prop', name: 'Casas do Porto', ids: ['P1', 'P2', 'P3'] })];
    const solto = app.normTx({ id: 'T9', label: 'Obra', propertyId: 'P1' });
    solto._author = 'ELA'; solto._atServidor = 5000;
    app.db.transactions = [parte('L1', 'P1', 'g:G1', 3, 'ELA', 6000), parte('L1', 'P2', 'g:G1', 3, 'ELA', 6000), parte('L1', 'P3', 'g:G1', 3, 'ELA', 7000), solto];
    const l = cru(app.notifPartilha());
    assert.equal(l.length, 2, 'o lote uma vez, mais o movimento solto: ' + l.map((n) => n.titulo).join(' | '));
    assert.equal(l[0].titulo, 'Movimento — Seguro multirriscos');
    assert.match(l[0].sub, /^Maria Costa · Casas do Porto · 3 imóveis · /);
    assert.equal(l[0].at, 7000, 'a hora da parte mais nova');
    assert.match(l[1].sub, /^Maria Costa · Casa 1 · /, 'o solto continua com o imóvel dele');
    assert.equal(app.notifConta(), 2, 'e o crachá conta o lote uma vez');
  });

  test('um lote de «Todos os imóveis» diz «Todos os imóveis · N imóveis»; as partes que escrevi e as de antes da marca não contam, e dois lotes contam dois', () => {
    monta();
    app.db.properties = ['P1', 'P2'].map((id) => app.normProp({ id, name: id }));
    app.db.groups = [];
    app.db.transactions = [
      parte('L2', 'P1', 'todos', 2, 'ELA', 6000, 'Condomínio'), parte('L2', 'P2', 'todos', 2, 'ELA', 6000, 'Condomínio'),
      parte('L3', 'P1', 'todos', 2, 'EU', 6000, 'Meu'), parte('L3', 'P2', 'todos', 2, 'EU', 6000, 'Meu'),
      // uma parte de antes da marca e outra depois: conta, uma vez
      parte('L4', 'P1', 'g:GX', 2, 'ELA', 500, 'Água'), parte('L4', 'P2', 'g:GX', 2, 'ELA', 6500, 'Água'),
    ];
    const l = cru(app.notifPartilha());
    assert.deepEqual(l.map((n) => n.titulo), ['Movimento — Água', 'Movimento — Condomínio'], 'o meu não conta; os outros dois, uma vez cada');
    assert.match(l[1].sub, /^Maria Costa · Todos os imóveis · 2 imóveis · /);
    assert.match(l[0].sub, /^Maria Costa · 2 imóveis · /, 'um grupo que já não está na base fica só com os imóveis');
  });
});

/* Quem saiu de uma casa que fica comigo: o servidor manda as saídas em
   CW.state.departures (um colaborador que deixou de colaborar, um
   comproprietário que deixou de o ser), e o sino mostra-as na atividade, com
   a mesma marca de leitura, a contar no crachá, e no painel geral. */
describe('quem saiu, no sino e no painel', () => {
  const cru = (x) => JSON.parse(JSON.stringify(x));
  const saida = (id, kind, at, extra) => Object.assign({ id, kind, houseId: 'P1', houseName: 'T2 Benfica', actorId: 'RUI', actorName: 'Rui', at }, extra || {});
  const comSaidas = (lista) => { monta(); app.CW.state = { departures: lista }; };
  // o corpo do «Pede atenção», sem abrir janela nenhuma
  const corpoDoSino = () => {
    let corpo = '', pe = '';
    const openReal = app.openModal;
    app.openModal = (t, b, p) => { corpo = b; pe = p; };
    try { app.notifModal(); } finally { app.openModal = openReal; }
    return { corpo, pe };
  };

  test('sem departures (ausente, vazio, sem estado, sem nuvem) não há nada, nem no crachá nem no sino', () => {
    monta();
    assert.deepEqual(cru(app.notifSaidas()), [], 'sem estado');
    app.CW.state = {};
    assert.deepEqual(cru(app.notifSaidas()), [], 'estado de antes da regra');
    app.CW.state = { departures: [] };
    assert.deepEqual(cru(app.notifSaidas()), [], 'lista vazia');
    app.CW.state = { departures: null };
    assert.deepEqual(cru(app.notifSaidas()), []);
    assert.equal(app.notifConta(), 0);
    assert.doesNotMatch(corpoDoSino().corpo, /Atividade nas casas partilhadas/);
    app.window.CW = undefined; app.CW = undefined;
    assert.deepEqual(cru(app.notifSaidas()), [], 'numa app sem nuvem');
    monta();
  });

  test('as duas frases, com quem, a casa, a hora como as outras e as mais recentes primeiro', () => {
    comSaidas([saida('e1', 'colab.sair', 5000), saida('e2', 'casa.sair', 6000, { actorId: 'ZE', actorName: 'Zé Lopes' })]);
    const l = cru(app.notifSaidas());
    assert.deepEqual(l.map((n) => n.titulo), ['Zé Lopes deixou de ser comproprietário de T2 Benfica.', 'Rui deixou de colaborar em T2 Benfica.']);
    assert.equal(l[1].sub, app.notifQuando(5000), 'o sub é a data e a hora, como na atividade');
    assert.equal(l[0].quem, 'Zé Lopes');
    assert.equal(app.notifQuem(l[0]), 'Zé Lopes', 'as iniciais do avatar são de quem saiu');
    assert.equal(l[0].tipo, 'saida');
  });

  test('sem nome da casa vale o da base, sem nome de quem saiu «Alguém»; um tipo que não se conhece e a minha própria saída não entram', () => {
    comSaidas([
      saida('e1', 'colab.sair', 5000, { houseName: '', actorName: '' }),
      saida('e2', 'outra.coisa', 5000),
      saida('e3', 'casa.sair', 5000, { actorId: 'EU', actorName: 'Eu' }),
      null,
    ]);
    const l = cru(app.notifSaidas());
    assert.deepEqual(l.map((n) => n.titulo), ['Alguém deixou de colaborar em T2 Lisboa.']);
  });

  test('filtradas pela marca de leitura, como a atividade: o «Marcar tudo como lido» cala-as', () => {
    comSaidas([saida('e1', 'colab.sair', 500), saida('e2', 'casa.sair', 6000)]);
    assert.deepEqual(cru(app.notifSaidas()).map((n) => n.id), ['e2'], 'a de antes da marca não conta');
    assert.equal(app.notifSaidas(0).length, 2, 'com uma marca dada, manda ela');
    app.closeModal = () => {}; app.render = () => {};
    app.notifLido();
    assert.equal(app.notifSaidas().length, 0, 'depois de lido, silêncio');
    assert.equal(app.notifConta(), 0);
  });

  test('a primeira contagem sem marca põe-na em agora: as saídas antigas não inundam', () => {
    comSaidas([saida('e1', 'colab.sair', 6000)]);
    delete app.db.settings.notifLidoAte;
    assert.equal(app.notifSaidas().length, 0);
    assert.ok(app.db.settings.notifLidoAte > 6000, 'a marca ficou posta');
  });

  test('contam no crachá, uma cada, junto com a atividade partilhada', () => {
    comSaidas([saida('e1', 'colab.sair', 5000), saida('e2', 'casa.sair', 6000)]);
    const dela = app.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P1', date: '2999-01-01' });
    dela._author = 'ELA'; dela._atServidor = 7000;
    app.db.visits = [dela];
    assert.equal(app.notifConta(), 3);
    const l = cru(app.notifAtividade());
    assert.deepEqual(l.map((n) => n.at), [7000, 6000, 5000], 'juntas e pela hora');
  });

  test('com os Colaboradores desligados, a saída de um colaborador não entra; a de um comproprietário fica', () => {
    comSaidas([saida('e1', 'colab.sair', 5000), saida('e2', 'casa.sair', 6000)]);
    app.definirServicosDesligados(['colaboradores']);
    try {
      assert.deepEqual(cru(app.notifSaidas()).map((n) => n.id), ['e2']);
      assert.equal(app.notifConta(), 1);
    } finally {
      app.definirServicosDesligados([]);
    }
  });

  test('o modal mostra as duas na atividade, levam à ficha do imóvel, e nada em linha', () => {
    comSaidas([saida('e1', 'colab.sair', 5000), saida('e2', 'casa.sair', 6000, { actorName: 'Rui Costa' })]);
    const { corpo, pe } = corpoDoSino();
    assert.match(corpo, /<h3>Atividade nas casas partilhadas<\/h3>/);
    assert.match(corpo, /Rui deixou de colaborar em T2 Benfica\./);
    assert.match(corpo, /Rui Costa deixou de ser comproprietário de T2 Benfica\./);
    assert.match(corpo, /<button type="button" class="atencao-linha tap" data-toca="camada" data-click="closeModal\(\);propView\('P1'\)"><span class="avatar" aria-hidden="true">RC<\/span>/);
    assert.ok(!/\son[a-z]+=|style=/.test(corpo), 'sem style= nem on…=');
    assert.match(pe, /Marcar tudo como lido/, 'há o que marcar como lido');
  });

  test('o toque: com a casa na base abre a ficha (propView); sem ela, ou com os Imóveis desligados, a linha não é um botão', () => {
    comSaidas([saida('e1', 'colab.sair', 5000)]);
    assert.equal(app.notifSaidas()[0].ir, "propView('P1')");
    let abriu = '';
    const viewReal = app.propView;
    app.propView = (id) => { abriu = id; };
    try { app.correrAcao(app.notifSaidas()[0].ir, null, null); } finally { app.propView = viewReal; }
    assert.equal(abriu, 'P1', 'a ação abre a ficha da casa');

    app.db.properties = [];
    assert.equal(app.notifSaidas()[0].ir, '', 'a casa já não está na base');
    const { corpo } = corpoDoSino();
    assert.match(corpo, /<div class="atencao-linha"><span class="avatar" aria-hidden="true">R<\/span><div class="atencao-txt"><p class="title">Rui deixou de colaborar em T2 Benfica\./);
    assert.doesNotMatch(corpo, /data-click="closeModal\(\);"/, 'nenhum toque que só fecha a janela');

    // (sem os Imóveis os Colaboradores também se desligam: vai a saída de um comproprietário)
    monta(); app.CW.state = { departures: [saida('e2', 'casa.sair', 5000)] };
    app.definirServicosDesligados(['properties']);
    try {
      assert.equal(app.notifSaidas()[0].ir, '', 'sem os Imóveis não há ficha para abrir');
    } finally {
      app.definirServicosDesligados([]);
    }
  });

  test('o painel geral mostra-a: a linha do telemóvel e o cartão da atividade', () => {
    comSaidas([saida('e1', 'colab.sair', 5000)]);
    app.CW._esperaFim = 1;   // o «Pede atenção» espera pelo servidor
    const h = app.pedeAtencao();
    assert.match(h, /<b>1 novidade nas casas partilhadas<\/b><span class="small">Rui deixou de colaborar em T2 Benfica\.<\/span>/, 'a frase vai sozinha, sem o nome repetido');
    assert.match(h, /<h3 class="title vg-tit">Atividade nas casas partilhadas<\/h3>/);
    assert.match(h, /<button type="button" class="vg-item-abrir" data-toca="camada" data-click="propView\('P1'\)"><span class="avatar" aria-hidden="true">R<\/span><span class="vg-item-txt"><b>Rui deixou de colaborar em T2 Benfica\.<\/b>/);
    assert.ok(!/\son[a-z]+=|style=/.test(h), 'sem style= nem on…=');
    app.db.properties = [];
    assert.match(app.atividadeCard(app.notifAtividade()), /<div class="vg-item"><div class="vg-item-abrir"><span class="avatar"/, 'sem a casa, uma linha e não um botão');
  });
});
