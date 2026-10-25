// Transferir a propriedade de um ou vários imóveis que criei a um proprietário
// ligado a mim. O ⋯ da ficha tem «Transferir propriedade» só para quem criou
// o imóvel, com um servidor que já sabe de transferências e sem um pedido
// pendente; a folha escolhe quem recebe entre as ligações aceites, tem o
// interruptor «Continuar como comproprietário» (desligado) e, ligado, as
// quotas a meias, que têm de somar 100 (o erro vai para o campo); a frase diz
// o que passa, se saio ou fico, as quotas, os colaboradores pelo nome, que
// precisa de ser aceite e que até lá se cancela. «Pedir transferência» chama
// POST /api/transfers e a ficha passa a mostrar o pendente com o Cancelar.
// Quem recebe vê o pedido no sino com «Ver» e «Recusar», e a folha do «Ver»
// tem o Aceitar; aceitar diz o que ficou de fora. Os avisos novos têm frase,
// e um estado sem transfers (um servidor de antes) não parte nada.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, repor } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
const espera = () => new Promise((r) => setTimeout(r, 5));

/* O estado do servidor: a T2 Benfica (H1) é minha, só minha, e o Rui
   colabora nela; a Loja (H6) é minha com a Ana (60/40); a Partilhada (H2) é
   do Rui e sou comproprietário. Estou ligado ao Bruno (aceite) e tenho um
   convite por aceitar do Zé. */
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1, data: { id: 'H1', name: 'T2 Benfica' } },
    { id: 'H6', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'ANA'], updatedAt: 1,
      data: { id: 'H6', name: 'Loja', ownerShares: { EU: 60, ANA: 40 } } },
    { id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1,
      data: { id: 'H2', name: 'Partilhada', ownerShares: { RUI: 50, EU: 50 } } },
  ],
  records: [], userRecords: [],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }, { userId: 'ANA', name: 'Ana', data: null }, { userId: 'BRUNO', name: 'Bruno', data: null }],
  connections: [
    { id: 'L1', status: 'active', peer: { id: 'BRUNO', name: 'Bruno', email: 'b@exemplo.pt' }, myShares: [], peerShares: [] },
    { id: 'L2', status: 'pending', incoming: false, peer: { id: 'ZE', name: 'Zé' }, myShares: [], peerShares: [] },
  ],
  roles: [{ id: 'R1', name: 'Contabilista', perms: ['tx.view'] }],
  collaborators: [{ id: 'C1', userId: 'COLAB', name: 'Rita Colab', roleId: 'R1', roleName: 'Contabilista', houses: [{ id: 'H1', name: 'T2 Benfica' }] }],
  invites: [], people: [],
  shareLink: null, shareRequests: { incoming: [], outgoing: [] },
  sharedGroupRequests: { incoming: [], outgoing: [] }, sharedGroups: [],
  departures: [],
  transfers: { incoming: [], outgoing: [] },
});

/* A app com o estado, a sessão e os espiões: esp.api as chamadas (com o
   corpo; esp.resposta e esp.falha mudam o que respondem), esp.toasts,
   esp.falhas (falhaCampo), esp.modais (openModal, a pilha a sério), esp.pulls.
   Recebe: mexe (opcional) — função que muda o estado antes de entrar.
   Devolve: esp. */
function montar(mexe) {
  const esp = { api: [], toasts: [], falhas: [], modais: [], pulls: 0, renders: 0, falha: null, resposta: null };
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
  const st = ESTADO();
  if (mexe) mexe(st);
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  app.CW.selL = { tipo: null, ids: {} };
  app.tab = 'properties';
  app.modalStack.length = 0;
  app.db.settings.notifLidoAte = 1000;
  app.api = (method, p, corpo) => {
    esp.api.push({ m: method + ' ' + p, corpo });
    if (esp.falha && p.indexOf(esp.falha.caminho) > -1) return Promise.reject(new Error(esp.falha.msg));
    return Promise.resolve(esp.resposta || { ok: true });
  };
  app.toast = (m) => { esp.toasts.push(m); };
  app.falhaCampo = (id, msg) => { esp.falhas.push({ id, msg }); };
  app.openModal = (title, corpo, pe, menuHtml) => {
    const L = { title, corpo, pe, menuHtml };
    esp.modais.push(L);
    app.modalStack.push(L);
    return L;
  };
  app.closeModal = () => { const L = app.modalStack.pop(); if (L && L.aoFechar) L.aoFechar(); };
  app.render = () => { esp.renders++; };
  app.pullNow = (force) => { if (force) esp.pulls++; return Promise.resolve(); };
  app.save = () => {}; app.buildNav = () => {};
  return esp;
}

// as ações de um HTML, pelo data-click
const acoes = (html) => [...String(html).matchAll(/data-click="([^"]+)"/g)].map((m) => m[1]);

describe('pedir a transferência', () => {
  let esp;
  beforeEach(() => { esp = montar(); });

  test('as quatro chamadas da nuvem vão às rotas do contrato, com o corpo certo', async () => {
    await app.CW.pedirTransferencia({ houseIds: ['H1'], toUserId: 'BRUNO', ficar: false, shares: { H1: { EU: 50, BRUNO: 50 } } });
    await app.CW.pedirTransferencia({ houseIds: ['H1', 'H6'], toUserId: 'BRUNO', ficar: true, shares: { H1: { EU: 60, BRUNO: 40 } } });
    await app.CW.cancelarTransferencia('LT 1');
    await app.CW.recusarTransferencia('LT2');
    await app.CW.aceitarTransferencia('LT3');
    assert.deepEqual(esp.api.map((x) => x.m), ['POST /api/transfers', 'POST /api/transfers', 'DELETE /api/transfers/LT%201',
      'POST /api/transfers/LT2/reject', 'POST /api/transfers/LT3/accept']);
    assert.deepEqual(JSON.parse(JSON.stringify(esp.api[0].corpo)), { houseIds: ['H1'], toUserId: 'BRUNO', ficar: false }, 'sem ficar, as quotas não vão');
    assert.deepEqual(JSON.parse(JSON.stringify(esp.api[1].corpo)), { houseIds: ['H1', 'H6'], toUserId: 'BRUNO', ficar: true, shares: { H1: { EU: 60, BRUNO: 40 } } });
  });

  test('o ⋯ da ficha tem «Transferir propriedade» antes do «Apagar imóvel», só no que criei', () => {
    const h1 = [...app.imvMenuDaFicha('H1')].map((x) => x.label);
    assert.deepEqual(h1, ['Transferir propriedade', 'Apagar imóvel']);
    assert.equal(app.imvMenuDaFicha('H1')[0].act, "imvTransferir('H1')");
    assert.ok(!app.imvMenuDaFicha('H1')[0].danger, 'transferir não destrói: não é vermelho');
    assert.deepEqual([...app.imvMenuDaFicha('H2')].map((x) => x.label), ['Apagar imóvel'], 'num que não criei, só o sair');
    let ficha = null;
    app.abrirFicha = (o) => { ficha = o; return {}; };
    app.propView('H1');
    assert.match(ficha.menu(), /data-click="closePops\(\);imvTransferir\('H1'\)">[\s\S]*? Transferir propriedade<\/button>/);
  });

  test('sem o campo transfers no estado (um servidor de antes), sem sessão ou com um pedido pendente, não há «Transferir»', () => {
    delete app.CW.state.transfers;
    assert.equal(app.imvPossoTransferir('H1'), false, 'o servidor não sabe: levava a um 404');
    assert.deepEqual([...app.imvMenuDaFicha('H1')].map((x) => x.label), ['Apagar imóvel']);
    app.CW.state.transfers = { incoming: [], outgoing: [{ lote: 'LT', to: { id: 'BRUNO', name: 'Bruno' }, houses: [{ id: 'H1', name: 'T2 Benfica' }], ficar: false, shares: null, at: 1 }] };
    assert.equal(app.imvPossoTransferir('H1'), false, 'um pendente por casa');
    assert.equal(app.imvPossoTransferir('H6'), true);
    app.CW.user = null;
    assert.equal(app.imvPossoTransferir('H6'), false, 'sem sessão');
  });

  test('quem recebe escolhe-se entre as ligações aceites; a única vem já escolhida', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(app.imvTrfDestinos())), [{ id: 'BRUNO', nome: 'Bruno' }], 'o convite por aceitar do Zé não conta');
    app.imvTransferir('H1');
    const L = esp.modais[0];
    assert.equal(L.title, 'Transferir propriedade');
    assert.match(L.corpo, /<label>Para quem <span class="req">\*<\/span><div class="sel" id="sel_trf_para">/);
    assert.match(L.corpo, /<span id="lab_trf_para">Bruno<\/span>/, 'com um só, já escolhido');
    assert.match(L.corpo, /role="switch" id="trfFicar" aria-checked="false"/, 'o interruptor começa desligado');
    assert.match(L.corpo, /<b>Continuar como comproprietário<\/b>/);
    assert.deepEqual(acoes(L.pe), ['closeModal()', 'imvTrfPedir()']);
    assert.match(L.pe, />Cancelar<\/button><button type="button" class="btn primary"[^>]*>Pedir transferência<\/button>$/);
  });

  test('a frase sem ficar: o que passa e para quem, que saio e a quota, o colaborador pelo nome, aceitar e cancelar', () => {
    app.imvTransferir('H1');
    const f = app.imvTrfFrase();
    assert.equal(f, '<b>T2 Benfica</b> passa para <b>Bruno</b>, que fica a gerir o imóvel: as partilhas, os colaboradores e o apagar. ' +
      'Tu sais dele, e a tua quota (100%) passa para Bruno. ' +
      'O teu colaborador Rita Colab perde o acesso a este imóvel e é avisado. Os cargos são teus e não passam. ' +
      'Bruno tem de aceitar: até lá nada muda, e podes cancelar o pedido na ficha do imóvel.');
    app.closeModal();
    app.imvTransferir('H6');
    assert.match(app.imvTrfFrase(), /a tua quota \(60%\) passa para Bruno\. A quota de Ana não muda se mantiver o acesso\. Os comproprietários que não estejam ligados a Bruno perdem o acesso, e a quota deles passa para os que ficam\./);
  });

  test('com «Continuar como comproprietário»: as quotas a meias, os outros como estão, e a frase com elas', () => {
    app.imvTransferir('H6');
    app.imvTrfFicar();
    assert.equal(app.imvTrfQuotasHtml().indexOf('trf_q_H6_EU') > -1, true);
    const ini = JSON.parse(JSON.stringify(app.imvTrfQuotasIniciais(app.prop('H6'), 'BRUNO')));
    assert.deepEqual(ini, { EU: 30, BRUNO: 30, ANA: 40 }, 'a minha (60) dividida a meias com quem recebe');
    assert.deepEqual(JSON.parse(JSON.stringify(app.imvTrfQuotasIniciais(app.prop('H1'), 'BRUNO'))), { EU: 50, BRUNO: 50 });
    assert.match(app.imvTrfQuotasHtml(), /<span class="pt-quota-nome">Tu<\/span><input id="trf_q_H6_EU" type="text" inputmode="decimal" value="30"/);
    assert.match(app.imvTrfQuotasHtml(), /entram quando Bruno aceitar/);
    // sem nada escrito, a frase diz as de partida
    app.document.getElementById('trf_q_H6_EU').value = '30';
    app.document.getElementById('trf_q_H6_BRUNO').value = '30';
    app.document.getElementById('trf_q_H6_ANA').value = '40';
    app.imvTrfEscreveu();
    assert.match(app.imvTrfFrase(), /Continuas comproprietário: ficas com 30%, Bruno com 30% e Ana com 40%\./);
    assert.doesNotMatch(app.imvTrfFrase(), /Tu sais/);
  });

  test('pedir sem quem recebe diz o erro no «Para quem», e nada vai ao servidor', () => {
    app.CW.state.connections.push({ id: 'L3', status: 'active', peer: { id: 'ANA', name: 'Ana' }, myShares: [], peerShares: [] });
    app.imvTransferir('H1');
    assert.equal(app._trf.para, '', 'com dois, nenhum escolhido');
    app.imvTrfPedir();
    assert.deepEqual(esp.falhas, [{ id: 'selb_trf_para', msg: 'Escolhe para quem transferes.' }]);
    assert.equal(esp.api.length, 0);
  });

  test('quotas que não somam 100 dizem-se no campo; 60/40 seguem no pedido, a folha fecha, o aviso e o estado relido', async () => {
    let depois = 0;
    app.imvTransferir(['H1'], () => { depois++; });
    app.imvTrfFicar();
    const g = (id) => app.document.getElementById(id);
    g('trf_q_H1_EU').value = '60'; g('trf_q_H1_BRUNO').value = '30';
    app.imvTrfPedir();
    assert.deepEqual(esp.falhas, [{ id: 'trf_q_H1_EU', msg: 'As quotas de T2 Benfica têm de somar 100 (agora somam 90).' }]);
    g('trf_q_H1_BRUNO').value = '0';
    app.imvTrfPedir();
    assert.deepEqual(esp.falhas[1], { id: 'trf_q_H1_BRUNO', msg: 'Escreve uma quota maior do que 0 e até 100.' });
    assert.equal(esp.api.length, 0);
    g('trf_q_H1_BRUNO').value = '40';
    app.imvTrfPedir();
    app.imvTrfPedir();   // o segundo toque com o pedido a meio não repete
    await espera();
    assert.equal(esp.api.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(esp.api[0].corpo)), { houseIds: ['H1'], toUserId: 'BRUNO', ficar: true, shares: { H1: { EU: 60, BRUNO: 40 } } });
    assert.equal(app.modalStack.length, 0, 'a folha fechou');
    assert.equal(esp.toasts.at(-1), 'Pedido enviado a Bruno. Até aceitar, nada muda: podes cancelá-lo na ficha do imóvel.');
    assert.equal(esp.pulls, 1);
    assert.equal(depois, 1, 'o que corre depois de pedir (a seleção sai)');
    assert.equal(app._trf, null);
  });

  test('o erro do servidor sobre quem recebe vai para o «Para quem»; outro vai num aviso, e a folha fica', async () => {
    app.imvTransferir('H1');
    esp.falha = { caminho: '/api/transfers', msg: 'Só podes transferir para um proprietário ligado a ti.' };
    app.imvTrfPedir();
    await espera();
    assert.deepEqual(esp.falhas, [{ id: 'selb_trf_para', msg: 'Só podes transferir para um proprietário ligado a ti.' }]);
    esp.falha = { caminho: '/api/transfers', msg: 'Este imóvel já tem uma transferência pendente.' };
    app.imvTrfPedir();
    await espera();
    assert.equal(esp.toasts.at(-1), 'Este imóvel já tem uma transferência pendente.');
    assert.equal(app.modalStack.length, 1, 'a folha continua aberta');
  });

  test('da seleção: vão só os que criei, e os outros dizem-se no cimo; sem nenhum meu, um aviso sem folha', () => {
    app.imvTransferir(['H1', 'H2', 'H6']);
    const L = esp.modais[0];
    assert.equal(L.title, 'Transferir 2 imóveis');
    assert.deepEqual(JSON.parse(JSON.stringify(app._trf.ids)), ['H1', 'H6']);
    assert.match(L.corpo, /<b>Partilhada<\/b> fica de fora: só quem criou um imóvel o pode transferir\./);
    assert.match(app.imvTrfFrase(), /^<b>T2 Benfica<\/b> e <b>Loja<\/b> passam para <b>Bruno<\/b>, que fica a gerir os imóveis/);
    assert.match(app.imvTrfFrase(), /Tu sais deles, e as tuas quotas passam para Bruno\. A quota de Ana não muda se mantiver o acesso\./);
    assert.match(app.imvTrfFrase(), /O teu colaborador Rita Colab perde o acesso a estes imóveis e é avisado\./);
    app.closeModal();
    app.imvTransferir(['H2']);
    assert.equal(esp.modais.length, 1, 'sem folha');
    assert.equal(esp.toasts.at(-1), 'Só quem criou o imóvel o pode transferir.');
  });

  test('sem nenhuma ligação aceite, a folha diz como ligar e leva aos Proprietários', () => {
    app.CW.state.connections = [];
    app.imvTransferir('H1');
    const L = esp.modais[0];
    assert.match(L.corpo, /Só podes transferir para um proprietário ligado a ti, e ainda não tens nenhuma ligação aceite\./);
    assert.match(L.corpo, /Em Pessoas › Proprietários, dá o teu id ao outro ou escreve o dele\./);
    assert.deepEqual(acoes(L.pe), ['closeModal()', 'imvTrfLigar()']);
    assert.match(L.pe, />Ir para os proprietários<\/button>$/);
  });
});

describe('o pendente e a resposta', () => {
  let esp;
  const PEDIDO = () => ({ lote: 'LT1', from: { id: 'ALICE', name: 'Alice' }, houses: [{ id: 'HA', name: 'Casa A' }, { id: 'HB', name: 'Casa B' }],
    ficar: true, shares: { HA: { ALICE: 60, EU: 40 }, HB: { ALICE: 50, EU: 50 } }, at: 5 });
  beforeEach(() => {
    esp = montar((st) => {
      st.transfers = {
        incoming: [PEDIDO()],
        outgoing: [{ lote: 'LT9', to: { id: 'BRUNO', name: 'Bruno' }, houses: [{ id: 'H1', name: 'T2 Benfica' }, { id: 'H6', name: 'Loja' }], ficar: false, shares: null, at: 4 }],
      };
    });
  });

  test('a ficha mostra o pendente com o Cancelar, que cancela o pedido todo e relê o estado', async () => {
    const c = app.imvTrfNaFicha(app.prop('H1'));
    assert.match(c, /<b>Transferência pendente para Bruno<\/b>/);
    assert.match(c, /Até Bruno aceitar, nada muda\. O pedido leva também Loja: cancelar cancela o pedido todo\./);
    assert.deepEqual(acoes(c), ["notifTransfCancelar('LT9')"]);
    assert.match(c, />Cancelar<\/button><\/div>$/);
    assert.match(app.propFicha('H1'), /imv-trf/, 'na ficha');
    await app.notifTransfCancelar('LT9');
    assert.deepEqual(esp.api.map((x) => x.m), ['DELETE /api/transfers/LT9']);
    assert.equal(esp.toasts.at(-1), 'Pedido de transferência cancelado.');
    assert.equal(esp.pulls, 1);
  });

  test('quem recebe: o pedido conta no sino, com «Ver» e «Recusar» e sem Aceitar à vista', () => {
    const ped = app.notifPedidos();
    assert.equal(ped.length, 1);
    assert.equal(ped[0].tipo, 'transf');
    assert.equal(ped[0].titulo, 'Alice quer transferir-te 2 imóveis: Casa A e Casa B');
    assert.equal(ped[0].sub, 'Se aceitares, os imóveis passam a ser teus e Alice fica com uma quota em cada um.');
    assert.equal(app.notifConta(), 1);
    const c = app.atencaoCorpo().corpo;
    assert.ok(acoes(c).includes("notifTransfVer('LT1')") && acoes(c).includes("notifTransfRecusar('LT1')"), acoes(c).join(' | '));
    assert.ok(!acoes(c).some((a) => /Aceitar/.test(a)), 'aceitar só depois de ver');
    // o que eu pedi espera, com o Cancelar
    assert.match(c, /<h3>À espera de resposta<\/h3>/);
    assert.match(c, /T2 Benfica e Loja · à espera de Bruno/);
    assert.ok(acoes(c).includes("notifTransfCancelar('LT9')"));
    // e o cartão dos pedidos da Visão geral também
    assert.match(app.linhasDosPedidos(), /Alice quer transferir-te 2 imóveis: Casa A e Casa B[\s\S]*notifTransfVer\('LT1'\)">Ver<\/button>/);
  });

  test('o «Ver» diz as casas, que quem pede fica, as quotas, o que passo a gerir, e tem Recusar e Aceitar', () => {
    app.notifTransfVer('LT1');
    const L = esp.modais[0];
    assert.equal(L.title, 'Transferência de Alice');
    assert.match(L.corpo, /<p>Alice quer transferir-te <b>Casa A<\/b> e <b>Casa B<\/b>\.<\/p>/);
    assert.match(L.corpo, /<span class="pt-quota-nome">Alice<\/span><b class="num">60%<\/b>/);
    assert.match(L.corpo, /<span class="pt-quota-nome">Tu<\/span><b class="num">40%<\/b>/);
    assert.match(L.corpo, /Passas a gerir as partilhas e os colaboradores, e podes apagar os imóveis\. Os colaboradores de Alice nestes imóveis perdem o acesso/);
    assert.match(L.corpo, /Nada muda até aceitares\./);
    assert.deepEqual(acoes(L.pe), ["notifTransfRecusar('LT1')", "notifTransfAceitar('LT1')"]);
    app.closeModal();
    app.notifTransfVer('NAO-HA');
    assert.equal(esp.toasts.at(-1), 'Este pedido já não está pendente.');
  });

  test('aceitar fecha a folha e o sino, diz o que passou a ser meu e o que ficou de fora, e relê', async () => {
    app.openModal('Pede atenção', '', '');
    app.notifTransfVer('LT1');
    esp.resposta = { ok: true, aceites: ['HA'], falhadas: [{ houseId: 'HB', error: 'A casa mudou entretanto.' }] };
    const p = app.notifTransfAceitar('LT1');
    assert.equal(app.notifTransfAceitar('LT1'), undefined, 'o segundo toque não repete');
    assert.equal(app.modalStack.length, 0, 'a folha e o sino fecharam');
    await p;
    assert.deepEqual(esp.api.map((x) => x.m), ['POST /api/transfers/LT1/accept']);
    assert.equal(esp.toasts.at(-1), 'Aceitaste: Casa A passou a ser teu. «Casa B» ficou de fora: A casa mudou entretanto.');
    assert.equal(esp.pulls, 1);
  });

  test('recusar não pergunta: vai ao servidor, avisa e relê; um erro diz a frase do servidor', async () => {
    await app.notifTransfRecusar('LT1');
    assert.deepEqual(esp.api.map((x) => x.m), ['POST /api/transfers/LT1/reject']);
    assert.equal(esp.toasts.at(-1), 'Recusaste a transferência.');
    esp.falha = { caminho: '/reject', msg: 'Este pedido já não está pendente.' };
    await app.notifTransfRecusar('LT1');
    assert.equal(esp.toasts.at(-1), 'Este pedido já não está pendente.');
  });

  test('na ficha de um imóvel que me querem transferir e já vejo, o pedido com o «Ver»', () => {
    app.CW.state.transfers.incoming[0].houses.push({ id: 'H2', name: 'Partilhada' });
    const c = app.imvTrfNaFicha(app.prop('H2'));
    assert.match(c, /<b>Alice quer transferir-te este imóvel<\/b>/);
    assert.deepEqual(acoes(c), ["notifTransfVer('LT1')"]);
  });
});

describe('os avisos novos e o servidor de antes', () => {
  let esp;
  beforeEach(() => { esp = montar(); });

  test('cada kind novo tem a sua frase; o pedido não é linha (já é pedido por responder), e a marca de leitura vale', () => {
    const d = (id, kind, at, extra) => Object.assign({ id, kind, houseId: 'H1', houseName: 'T2 Benfica', actorId: 'BRUNO', actorName: 'Bruno', at }, extra);
    app.CW.state.departures = [
      d('1', 'transf.aceite', 5000), d('2', 'transf.recusada', 4000), d('3', 'transf.cancelada', 3000),
      d('4', 'casa.novo_dono', 2500, { houseId: 'H2', houseName: 'Partilhada', actorId: 'RUI', actorName: 'Rui' }),
      d('5', 'colab.removido', 2000, { houseId: 'HX', houseName: 'Casa X' }), d('6', 'transf.pedido', 6000), d('9', 'casa.sem_acesso', 1500, { houseId: 'HY', houseName: 'Casa Y' }), d('7', 'transf.aceite', 500),
      d('8', 'coisa.nova', 7000)];
    const l = app.notifSaidas();
    assert.deepEqual([...l].map((x) => x.titulo), [
      'Bruno aceitou a transferência de T2 Benfica.', 'Bruno recusou a transferência de T2 Benfica.', 'Bruno cancelou a transferência de T2 Benfica.',
      'Rui é o novo dono de Partilhada.', 'Deixaste de colaborar em Casa X: o imóvel mudou de dono.', 'Deixaste de ter acesso a Casa Y: passou para Bruno.']);
    assert.equal(l[0].ir, "propView('H1')", 'o imóvel ainda está na base: abre a ficha');
    assert.equal(l[4].ir, '', 'o imóvel já não está na base: a linha não leva a lado nenhum');
    assert.equal(app.notifConta(), 6);
    app.db.settings.notifLidoAte = 9000;
    assert.equal(app.notifSaidas().length, 0, 'o «Marcar tudo como lido» cala-os');
  });

  test('sem transfers no estado nada rebenta: sem pedidos, sem pendentes, sem «Transferir» na barra', () => {
    delete app.CW.state.transfers;
    assert.deepEqual(JSON.parse(JSON.stringify(app.notifTransfRecebidas())), []);
    assert.equal(app.notifPedidos().length, 0);
    assert.equal(app.imvTrfNaFicha(app.prop('H1')), '');
    assert.doesNotMatch(app.atencaoCorpo().corpo, /À espera de resposta/);
    assert.doesNotMatch(app.selLBarraHtml('prop'), /selLTransferir/, 'a barra dos imóveis de sempre');
    app.CW.state.transfers = { incoming: 'lixo', outgoing: null };
    assert.equal(app.notifTransfEnviadas().length, 0);
    assert.equal(app.pedidosParaResponder().transf.length, 0);
  });

  test('na seleção das Casas, o Transferir só com algum que criei; abre a folha com os marcados', () => {
    assert.match(app.selLBarraHtml('prop'), /id="selLTransferir" data-sel-l-precisa data-toca="camada" data-click="CW\.selLTransferir\(\)">[\s\S]*? Transferir<\/button>/);
    assert.match(app.selLBarraHtml('prop'), /<p class="sel-l-info">/, 'a contagem com a razão por cima');
    assert.equal(app.selLComAcoes('prop'), true);
    const b = app.document.getElementById('selLTransferir'), pq = app.document.getElementById('selLPorque');
    app.CW.selL = { tipo: 'prop', ids: { H2: 1 } };
    app.selLPintarTransferir();
    assert.equal(b.disabled, true);
    assert.equal(pq.textContent, 'Só transferes os que criaste e não têm um pedido pendente.');
    app.CW.selL = { tipo: 'prop', ids: { H1: 1, H2: 1 } };
    app.selLPintarTransferir();
    assert.equal(b.disabled, false);
    assert.equal(pq.textContent, '1 fica de fora da transferência.');
    app.CW.selLTransferir();
    assert.equal(esp.modais[0].title, 'Transferir propriedade');
    assert.deepEqual(JSON.parse(JSON.stringify(app._trf.ids)), ['H1']);
  });
});
