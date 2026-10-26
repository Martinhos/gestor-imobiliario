// Passar o controlo de um ou vários imóveis que criei a um comproprietário
// deles. O ⋯ da ficha tem «Passar o controlo» só para quem criou o imóvel,
// com um servidor que já sabe destes pedidos, sem um pedido pendente e com
// pelo menos um comproprietário; a folha escolhe quem recebe entre os
// comproprietários (com vários imóveis, os que são comproprietários de
// todos), sem interruptor nem quotas; a frase diz que só muda quem controla
// o imóvel na app, que continuo comproprietário com a minha quota, que nada
// muda nas quotas, nos grupos nem nos outros comproprietários, que os meus
// colaboradores ficam com o mesmo cargo e passam a ser geridos por quem
// recebe, e que precisa de ser aceite. «Enviar pedido» chama POST
// /api/transfers só com as casas e quem recebe, e a ficha passa a mostrar o
// pendente com o Cancelar. Quem recebe vê o pedido no sino com «Ver» e
// «Recusar», e a folha do «Ver» diz o mesmo do lado dele e tem o Aceitar.
// Os avisos têm frase (o colab.novo_dono incluído), e um estado sem
// transfers (um servidor de antes) não parte nada.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, repor } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
const espera = () => new Promise((r) => setTimeout(r, 5));

/* O estado do servidor: a T2 Benfica (H1) é minha com o Bruno (60/40), e a
   Rita colabora nela; a Loja (H6) é minha com a Ana e o Bruno, e o Tó
   colabora nela; a Sozinha (H7) é só minha; a Quinta (H8) é minha com a Ana;
   a Partilhada (H2) é do Rui e sou comproprietário (o Tiago colabora nela,
   com o Rui). Estou ligado ao Bruno e ao Zé, que não é comproprietário de
   nada. */
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'BRUNO'], updatedAt: 1,
      data: { id: 'H1', name: 'T2 Benfica', ownerShares: { EU: 60, BRUNO: 40 } } },
    { id: 'H6', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'ANA', 'BRUNO'], updatedAt: 1,
      data: { id: 'H6', name: 'Loja', ownerShares: { EU: 50, ANA: 25, BRUNO: 25 } } },
    { id: 'H7', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1, data: { id: 'H7', name: 'Sozinha' } },
    { id: 'H8', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'ANA'], updatedAt: 1, data: { id: 'H8', name: 'Quinta' } },
    { id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1,
      collaborators: [{ id: 'C9', userId: 'TIAGO', name: 'Tiago', roleName: 'Contabilista' }],
      data: { id: 'H2', name: 'Partilhada', ownerShares: { RUI: 50, EU: 50 } } },
  ],
  records: [], userRecords: [],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }, { userId: 'ANA', name: 'Ana', data: null }, { userId: 'BRUNO', name: 'Bruno', data: null }],
  connections: [
    { id: 'L1', status: 'active', peer: { id: 'BRUNO', name: 'Bruno', email: 'b@exemplo.pt' }, myShares: ['H1', 'H6'], peerShares: [] },
    { id: 'L2', status: 'active', peer: { id: 'ZE', name: 'Zé' }, myShares: [], peerShares: [] },
  ],
  roles: [{ id: 'R1', name: 'Contabilista', perms: ['tx.view'] }],
  collaborators: [
    { id: 'C1', userId: 'COLAB', name: 'Rita Colab', roleId: 'R1', roleName: 'Contabilista', houses: [{ id: 'H1', name: 'T2 Benfica' }] },
    { id: 'C2', userId: 'TO', name: 'Tó Colab', roleId: 'R1', roleName: 'Contabilista', houses: [{ id: 'H6', name: 'Loja' }] },
  ],
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
// um valor da app como JSON simples (sem o protótipo do contexto)
const simples = (v) => JSON.parse(JSON.stringify(v));

describe('pedir para passar o controlo', () => {
  let esp;
  beforeEach(() => { esp = montar(); });

  test('as quatro chamadas da nuvem vão às rotas do contrato; o pedido leva só as casas e quem recebe', async () => {
    await app.CW.pedirTransferencia({ houseIds: ['H1'], toUserId: 'BRUNO', ficar: true, shares: { H1: { EU: 50, BRUNO: 50 } } });
    await app.CW.cancelarTransferencia('LT 1');
    await app.CW.recusarTransferencia('LT2');
    await app.CW.aceitarTransferencia('LT3');
    assert.deepEqual(esp.api.map((x) => x.m), ['POST /api/transfers', 'DELETE /api/transfers/LT%201',
      'POST /api/transfers/LT2/reject', 'POST /api/transfers/LT3/accept']);
    assert.deepEqual(simples(esp.api[0].corpo), { houseIds: ['H1'], toUserId: 'BRUNO' }, 'sem ficar nem quotas');
  });

  test('o ⋯ da ficha tem «Passar o controlo» antes do «Apagar imóvel», só no que criei e tem comproprietários', () => {
    assert.deepEqual([...app.imvMenuDaFicha('H1')].map((x) => x.label), ['Passar o controlo', 'Apagar imóvel']);
    assert.equal(app.imvMenuDaFicha('H1')[0].act, "imvTransferir('H1')");
    assert.ok(!app.imvMenuDaFicha('H1')[0].danger, 'passar o controlo não destrói: não é vermelho');
    assert.deepEqual([...app.imvMenuDaFicha('H7')].map((x) => x.label), ['Apagar imóvel'], 'sem comproprietários, não há a quem passar');
    assert.deepEqual([...app.imvMenuDaFicha('H2')].map((x) => x.label), ['Apagar imóvel'], 'num que não criei, só o sair');
    let ficha = null;
    app.abrirFicha = (o) => { ficha = o; return {}; };
    app.propView('H1');
    assert.match(ficha.menu(), /data-click="closePops\(\);imvTransferir\('H1'\)">[\s\S]*? Passar o controlo<\/button>/);
  });

  test('sem o campo transfers no estado (um servidor de antes), sem sessão ou com um pedido pendente, não há «Passar o controlo»', () => {
    delete app.CW.state.transfers;
    assert.equal(app.imvPossoTransferir('H1'), false, 'o servidor não sabe: levava a um 404');
    assert.deepEqual([...app.imvMenuDaFicha('H1')].map((x) => x.label), ['Apagar imóvel']);
    app.CW.state.transfers = { incoming: [], outgoing: [{ lote: 'LT', to: { id: 'BRUNO', name: 'Bruno' }, houses: [{ id: 'H1', name: 'T2 Benfica' }], at: 1 }] };
    assert.equal(app.imvPossoTransferir('H1'), false, 'um pendente por casa');
    assert.equal(app.imvPossoTransferir('H6'), true);
    app.CW.user = null;
    assert.equal(app.imvPossoTransferir('H6'), false, 'sem sessão');
  });

  test('os destinos são os comproprietários; com vários imóveis, os de todos; uma ligação sem casa em comum não conta', () => {
    assert.deepEqual(simples(app.imvTrfDestinos(['H1'])), [{ id: 'BRUNO', nome: 'Bruno' }]);
    assert.deepEqual(simples(app.imvTrfDestinos(['H6'])), [{ id: 'ANA', nome: 'Ana' }, { id: 'BRUNO', nome: 'Bruno' }], 'por ordem alfabética');
    assert.deepEqual(simples(app.imvTrfDestinos(['H1', 'H6'])), [{ id: 'BRUNO', nome: 'Bruno' }], 'só quem é comproprietário dos dois');
    assert.deepEqual(simples(app.imvTrfDestinos(['H1', 'H8'])), []);
    assert.deepEqual(simples(app.imvTrfDestinos(['H7'])), [], 'o Zé está ligado a mim, mas não é comproprietário');
  });

  test('a folha: «Para quem» com o único comproprietário já escolhido, sem interruptor nem quotas, e o rodapé', () => {
    app.imvTransferir('H1');
    const L = esp.modais[0];
    assert.equal(L.title, 'Passar o controlo');
    assert.match(L.corpo, /<label>Para quem <span class="req">\*<\/span><div class="sel" id="sel_trf_para">/);
    assert.match(L.corpo, /<span id="lab_trf_para">Bruno<\/span>/, 'com um só, já escolhido');
    assert.match(L.corpo, /Só podes passar o controlo a um comproprietário deste imóvel\./);
    assert.doesNotMatch(L.corpo, /interruptor|role="switch"|trf_q_|Continuar como comproprietário|pt-quota/, 'sem o interruptor e sem as quotas');
    assert.match(L.corpo, /<p class="trf-frase" id="trfFrase" aria-live="polite">/);
    assert.deepEqual(acoes(L.pe), ['closeModal()', 'imvTrfPedir()']);
    assert.match(L.pe, />Cancelar<\/button><button type="button" class="btn primary"[^>]*>Enviar pedido<\/button>$/);
  });

  test('a frase: só muda o controlo, continuo comproprietário com a minha quota, nada mais muda, o colaborador pelo nome, aceitar', () => {
    app.imvTransferir('H1');
    assert.equal(app.imvTrfFrase(),
      'Só muda quem controla <b>T2 Benfica</b> na app: <b>Bruno</b> passa a gerir as partilhas, os colaboradores e o apagar. ' +
      'Continuas comproprietário com a tua quota (60%), e nada muda nas quotas, nos grupos nem nos outros comproprietários. ' +
      'O teu colaborador Rita Colab continua neste imóvel com o mesmo cargo e passa a ser gerido por Bruno; é avisado. ' +
      'Bruno tem de aceitar: até lá nada muda, e podes cancelar o pedido na ficha do imóvel.');
  });

  test('com dois comproprietários, nenhum vem escolhido: a frase diz «quem escolheres», e escolher reescreve-a', () => {
    app.imvTransferir('H6');
    assert.equal(app._trf.para, '');
    assert.match(app.imvTrfFrase(), /^Só muda quem controla <b>Loja<\/b> na app: quem escolheres passa a gerir/);
    assert.match(app.imvTrfFrase(), /passa a ser gerido por quem receber; é avisado\. Quem receber tem de aceitar/);
    app.document.getElementById('trf_para').value = 'ANA';
    app.imvTrfMudou();
    assert.equal(app._trf.para, 'ANA');
    assert.match(app.document.getElementById('trfFrase').innerHTML, /<b>Ana<\/b> passa a gerir[\s\S]*Ana tem de aceitar/);
  });

  test('enviar sem quem recebe diz o erro no «Para quem», e nada vai ao servidor', () => {
    app.imvTransferir('H6');
    app.imvTrfPedir();
    assert.deepEqual(esp.falhas, [{ id: 'selb_trf_para', msg: 'Escolhe a quem passas o controlo.' }]);
    assert.equal(esp.api.length, 0);
  });

  test('enviar: o pedido só com as casas e quem recebe, a folha fecha, o aviso, o estado relido, e o segundo toque não repete', async () => {
    let depois = 0;
    app.imvTransferir(['H1'], () => { depois++; });
    app.imvTrfPedir();
    app.imvTrfPedir();
    await espera();
    const pedidos = esp.api.filter((x) => x.m === 'POST /api/transfers');
    assert.equal(pedidos.length, 1);
    assert.deepEqual(simples(pedidos[0].corpo), { houseIds: ['H1'], toUserId: 'BRUNO' });
    assert.equal(app.modalStack.length, 0, 'a folha fechou');
    assert.equal(esp.toasts.at(-1), 'Pedido enviado a Bruno. Até aceitar, nada muda: podes cancelá-lo na ficha do imóvel.');
    assert.equal(esp.pulls, 1);
    assert.equal(depois, 1, 'o que corre depois de pedir (a seleção sai)');
    assert.equal(app._trf, null);
  });

test('escolher quem recebe pergunta ao servidor; quem falta ligar diz-se por baixo, e o pedido não segue', async () => {
    const falta = { classList: { u: true, toggle(c, on) { this.u = on; } }, textContent: '' };
    const getEl = app.document.getElementById;
    app.document.getElementById = (id) => (id === 'trfFalta' ? falta : getEl.call(app.document, id));
    esp.resposta = { ok: true, semLigacao: [{ id: 'CARLA', name: 'Carla' }, { id: 'DUARTE', name: 'Duarte' }] };
    app.imvTransferir('H1');
    await espera();
    const chk = esp.api.filter((x) => x.m === 'POST /api/transfers/check');
    assert.equal(chk.length, 1, 'com o Bruno já escolhido, pergunta logo');
    assert.deepEqual(simples(chk[0].corpo), { houseIds: ['H1'], toUserId: 'BRUNO' });
    const frase = 'Para passares o controlo a Bruno, faltam as ligações de Bruno a Carla e Duarte. Têm de se ligar primeiro, em Pessoas › Proprietários.';
    assert.equal(falta.textContent, frase);
    assert.equal(falta.classList.u, false, 'à vista');
    app.imvTrfPedir();
    await espera();
    assert.deepEqual(esp.falhas, [{ id: 'selb_trf_para', msg: frase }]);
    assert.equal(esp.api.filter((x) => x.m === 'POST /api/transfers').length, 0, 'o pedido não foi');
    // ligados entretanto: perguntar outra vez (o que escolher faz, imvTrfMudou) limpa o aviso e o pedido segue
    esp.resposta = { ok: true, semLigacao: [] };
    app.imvTrfVerificar();
    await espera();
    assert.equal(falta.textContent, '');
    assert.equal(falta.classList.u, true);
    app.imvTrfPedir();
    await espera();
    assert.equal(esp.api.filter((x) => x.m === 'POST /api/transfers').length, 1);
  });

  test('uma ligação só com uma pessoa diz-se no singular, e o erro do servidor sobre a ligação vai para o «Para quem»', async () => {
    assert.equal(app.imvTrfFraseFalta('Bruno', ['Carla']),
      'Para passares o controlo a Bruno, falta a ligação de Bruno a Carla. Têm de se ligar primeiro, em Pessoas › Proprietários.');
    assert.equal(app.imvTrfFraseFalta('Bruno', []), '');
    app.imvTransferir('H1');
    await espera();
    const msg = 'Para passares o controlo a Bruno, falta a ligação de Bruno a Carla. Têm de se ligar primeiro, em Pessoas › Proprietários.';
    esp.falha = { caminho: '/api/transfers', msg };
    app.imvTrfPedir();
    await espera();
    assert.deepEqual(esp.falhas.at(-1), { id: 'selb_trf_para', msg });
  });

  test('o erro do servidor sobre quem recebe vai para o «Para quem»; outro vai num aviso, e a folha fica', async () => {
    app.imvTransferir('H1');
    esp.falha = { caminho: '/api/transfers', msg: 'Só podes passar o imóvel a um comproprietário dele.' };
    app.imvTrfPedir();
    await espera();
    assert.deepEqual(esp.falhas, [{ id: 'selb_trf_para', msg: 'Só podes passar o imóvel a um comproprietário dele.' }]);
    esp.falha = { caminho: '/api/transfers', msg: 'Este imóvel já tem uma transferência pendente.' };
    app.imvTrfPedir();
    await espera();
    assert.equal(esp.toasts.at(-1), 'Este imóvel já tem uma transferência pendente.');
    assert.equal(app.modalStack.length, 1, 'a folha continua aberta');
  });

  test('da seleção: vão os que criei com comproprietários, os outros dizem-se no cimo, e a frase fala de todos', () => {
    app.imvTransferir(['H1', 'H2', 'H7', 'H6']);
    const L = esp.modais[0];
    assert.equal(L.title, 'Passar o controlo de 2 imóveis');
    assert.deepEqual(simples(app._trf.ids), ['H1', 'H6']);
    assert.equal(app._trf.para, 'BRUNO', 'o único comproprietário dos dois');
    assert.match(L.corpo, /<b>Partilhada<\/b> fica de fora: só quem criou um imóvel lhe passa o controlo\. <b>Sozinha<\/b> fica de fora: não tem comproprietários\./);
    assert.match(L.corpo, /a um comproprietário de todos estes imóveis\./);
    const f = app.imvTrfFrase();
    assert.match(f, /^Só muda quem controla <b>T2 Benfica<\/b> e <b>Loja<\/b> na app: <b>Bruno<\/b> passa a gerir/);
    assert.match(f, /Continuas comproprietário com as tuas quotas, e nada muda/);
    assert.match(f, /Os teus colaboradores Rita Colab e Tó Colab continuam nestes imóveis com o mesmo cargo e passam a ser geridos por Bruno; são avisados\./);
    assert.match(f, /podes cancelar o pedido na ficha de cada imóvel\.$/);
  });

  test('sem nenhum que vá, um aviso com a razão e sem folha', () => {
    app.imvTransferir(['H2']);
    assert.equal(esp.toasts.at(-1), 'Só quem criou o imóvel lhe passa o controlo.');
    app.imvTransferir('H7');
    assert.equal(esp.toasts.at(-1), 'Só passas o controlo a um comproprietário, e este imóvel ainda não tem nenhum. Partilha-o primeiro em Pessoas › Proprietários.');
    app.imvTransferir(['H2', 'H7']);
    assert.equal(esp.toasts.at(-1), 'Partilhada fica de fora: só quem criou um imóvel lhe passa o controlo. Sozinha fica de fora: não tem comproprietários.');
    assert.equal(esp.modais.length, 0);
  });

  test('vários imóveis sem um comproprietário em comum: a folha diz que só se passa a um comproprietário e leva aos Proprietários', () => {
    app.imvTransferir(['H1', 'H8']);
    const L = esp.modais[0];
    assert.equal(L.title, 'Passar o controlo de 2 imóveis');
    assert.match(L.corpo, /Só passas o controlo a um comproprietário, e ninguém é comproprietário de todos estes imóveis\./);
    assert.match(L.corpo, /Escolhe só imóveis que partilhas com a mesma pessoa, ou partilha-os com ela primeiro em Pessoas › Proprietários\./);
    assert.deepEqual(acoes(L.pe), ['closeModal()', 'imvTrfLigar()']);
    assert.match(L.pe, />Ir para os proprietários<\/button>$/);
  });
});

describe('o pendente e a resposta', () => {
  let esp;
  const PEDIDO = () => ({ lote: 'LT1', from: { id: 'RUI', name: 'Rui' }, houses: [{ id: 'H2', name: 'Partilhada' }, { id: 'HZ', name: 'Casa Z' }], at: 5 });
  beforeEach(() => {
    esp = montar((st) => {
      st.transfers = {
        incoming: [PEDIDO()],
        outgoing: [{ lote: 'LT9', to: { id: 'BRUNO', name: 'Bruno' }, houses: [{ id: 'H1', name: 'T2 Benfica' }, { id: 'H6', name: 'Loja' }], at: 4 }],
      };
    });
  });

  test('a ficha mostra o pendente com o Cancelar, que cancela o pedido todo e relê o estado', async () => {
    const c = app.imvTrfNaFicha(app.prop('H1'));
    assert.match(c, /<b>Pediste para passar o controlo a Bruno<\/b>/);
    assert.match(c, /Até Bruno aceitar, nada muda\. O pedido leva também Loja: cancelar cancela o pedido todo\./);
    assert.deepEqual(acoes(c), ["notifTransfCancelar('LT9')"]);
    assert.match(c, /aria-label="Cancelar o pedido para passar o controlo"/);
    assert.match(app.propFicha('H1'), /imv-trf/, 'na ficha');
    await app.notifTransfCancelar('LT9');
    assert.deepEqual(esp.api.map((x) => x.m), ['DELETE /api/transfers/LT9']);
    assert.equal(esp.toasts.at(-1), 'Cancelaste o pedido.');
    assert.equal(esp.pulls, 1);
  });

  test('quem recebe: o pedido conta no sino, com «Ver» e «Recusar» e sem Aceitar à vista; o que eu pedi espera', () => {
    const ped = app.notifPedidos();
    assert.equal(ped.length, 1);
    assert.equal(ped[0].tipo, 'transf');
    assert.equal(ped[0].titulo, 'Rui quer passar-te o controlo de 2 imóveis: Partilhada e Casa Z');
    assert.equal(ped[0].sub, 'Se aceitares, passas a gerir os imóveis na app. As quotas e os comproprietários não mudam.');
    assert.equal(app.notifConta(), 1);
    const c = app.atencaoCorpo().corpo;
    assert.ok(acoes(c).includes("notifTransfVer('LT1')") && acoes(c).includes("notifTransfRecusar('LT1')"), acoes(c).join(' | '));
    assert.ok(!acoes(c).some((a) => /Aceitar/.test(a)), 'aceitar só depois de ver');
    assert.match(c, /<h3>À espera de resposta<\/h3>/);
    assert.match(c, /T2 Benfica e Loja · à espera de Bruno<\/p>\s*<p class="small">Pediste para passar o controlo\. Até Bruno aceitar, nada muda\.<\/p>/);
    assert.ok(acoes(c).includes("notifTransfCancelar('LT9')"));
    assert.match(app.linhasDosPedidos(), /Rui quer passar-te o controlo de 2 imóveis: Partilhada e Casa Z[\s\S]*notifTransfVer\('LT1'\)">Ver<\/button>/);
  });

  test('o «Ver» diz o mesmo do lado de quem recebe: só muda o controlo, as quotas ficam, os colaboradores dele pelo nome, e Recusar e Aceitar', () => {
    app.notifTransfVer('LT1');
    const L = esp.modais[0];
    assert.equal(L.title, 'Pedido de Rui');
    assert.match(L.corpo, /<p>Rui quer passar-te o controlo de <b>Partilhada<\/b> e <b>Casa Z<\/b>\.<\/p>/);
    assert.match(L.corpo, /Só muda quem os controla na app: passas a gerir as partilhas, os colaboradores e o apagar\./);
    assert.match(L.corpo, /Rui fica com a quota que tem, tu ficas com a tua, e nada muda nas quotas, nos grupos nem nos outros comproprietários\./);
    assert.match(L.corpo, /O colaborador de Rui nestes imóveis, Tiago, continua com o mesmo cargo e passa a ser gerido por ti\./);
    assert.match(L.corpo, /Nada muda até aceitares\./);
    assert.doesNotMatch(L.corpo, /pt-quota|espaço de armazenamento|perdem o acesso/);
    assert.deepEqual(acoes(L.pe), ["notifTransfRecusar('LT1')", "notifTransfAceitar('LT1')"]);
    app.closeModal();
    app.notifTransfVer('NAO-HA');
    assert.equal(esp.toasts.at(-1), 'Este pedido já não está pendente.');
  });

  test('aceitar fecha a folha e o sino, diz o que passei a gerir e o que ficou de fora, e relê', async () => {
    app.openModal('Pede atenção', '', '');
    app.notifTransfVer('LT1');
    esp.resposta = { ok: true, aceites: ['H2'], falhadas: [{ houseId: 'HZ', error: 'Já não és comproprietário deste imóvel.' }] };
    const p = app.notifTransfAceitar('LT1');
    assert.equal(app.notifTransfAceitar('LT1'), undefined, 'o segundo toque não repete');
    assert.equal(app.modalStack.length, 0, 'a folha e o sino fecharam');
    await p;
    assert.deepEqual(esp.api.map((x) => x.m), ['POST /api/transfers/LT1/accept']);
    assert.equal(esp.toasts.at(-1), 'Aceitaste: passas a gerir Partilhada. «Casa Z» ficou de fora: Já não és comproprietário deste imóvel.');
    assert.equal(esp.pulls, 1);
    assert.equal(app.notifTransfAvisoAceite(['A', 'B'], []), 'Aceitaste: passas a gerir 2 imóveis.');
    assert.equal(app.notifTransfAvisoAceite([], [{ nome: 'A', erro: '' }]), 'Não passaste a gerir nenhum imóvel. «A» ficou de fora: o pedido já não valia.');
  });

  test('recusar não pergunta: vai ao servidor, avisa e relê; um erro diz a frase do servidor', async () => {
    await app.notifTransfRecusar('LT1');
    assert.deepEqual(esp.api.map((x) => x.m), ['POST /api/transfers/LT1/reject']);
    assert.equal(esp.toasts.at(-1), 'Recusaste o pedido.');
    esp.falha = { caminho: '/reject', msg: 'Este pedido já não está pendente.' };
    await app.notifTransfRecusar('LT1');
    assert.equal(esp.toasts.at(-1), 'Este pedido já não está pendente.');
  });

  test('na ficha de um imóvel cujo controlo me querem passar, o pedido com o «Ver»', () => {
    const c = app.imvTrfNaFicha(app.prop('H2'));
    assert.match(c, /<b>Rui quer passar-te o controlo deste imóvel<\/b>/);
    assert.match(c, /Se aceitares, passas a gerir os imóveis na app\./);
    assert.deepEqual(acoes(c), ["notifTransfVer('LT1')"]);
  });
});

describe('os avisos e o servidor de antes', () => {
  let esp;
  beforeEach(() => { esp = montar(); });

  test('cada kind tem a sua frase (o colab.novo_dono incluído); os de antes da correção e o pedido não são linha', () => {
    const d = (id, kind, at, extra) => Object.assign({ id, kind, houseId: 'H1', houseName: 'T2 Benfica', actorId: 'BRUNO', actorName: 'Bruno', at }, extra);
    app.CW.state.departures = [
      d('1', 'transf.aceite', 5000), d('2', 'transf.recusada', 4000), d('3', 'transf.cancelada', 3000),
      d('4', 'casa.novo_dono', 2500, { houseId: 'H2', houseName: 'Partilhada' }),
      d('5', 'colab.novo_dono', 2000, { houseId: 'HX', houseName: 'Casa X' }), d('6', 'transf.pedido', 6000),
      d('9', 'casa.sem_acesso', 1500), d('10', 'colab.removido', 1400), d('7', 'transf.aceite', 500), d('8', 'coisa.nova', 7000)];
    const l = app.notifSaidas();
    assert.deepEqual([...l].map((x) => x.titulo), [
      'Bruno aceitou o controlo de T2 Benfica.', 'Bruno recusou o controlo de T2 Benfica.',
      'Bruno cancelou o pedido para te passar o controlo de T2 Benfica.',
      'Bruno passou a gerir Partilhada na app.', 'Bruno passou a gerir Casa X: continuas com o mesmo cargo.']);
    assert.equal(l[0].ir, "propView('H1')", 'o imóvel ainda está na base: abre a ficha');
    assert.equal(l[4].ir, '', 'o imóvel já não está na base: a linha não leva a lado nenhum');
    assert.equal(l[4].quem, 'Bruno', 'as iniciais de quem passou a gerir');
    assert.equal(app.notifConta(), 5);
    app.db.settings.notifLidoAte = 9000;
    assert.equal(app.notifSaidas().length, 0, 'o «Marcar tudo como lido» cala-os');
  });

  test('sem transfers no estado nada rebenta: sem pedidos, sem pendentes, sem «Passar o controlo» na barra', () => {
    delete app.CW.state.transfers;
    assert.deepEqual(simples(app.notifTransfRecebidas()), []);
    assert.equal(app.notifPedidos().length, 0);
    assert.equal(app.imvTrfNaFicha(app.prop('H1')), '');
    assert.doesNotMatch(app.atencaoCorpo().corpo, /À espera de resposta/);
    assert.doesNotMatch(app.selLBarraHtml('prop'), /selLTransferir/, 'a barra dos imóveis de sempre');
    app.CW.state.transfers = { incoming: 'lixo', outgoing: null };
    assert.equal(app.notifTransfEnviadas().length, 0);
    assert.equal(app.pedidosParaResponder().transf.length, 0);
  });

  test('na seleção das Casas, o «Passar o controlo» só com algum que posso passar; abre a folha com os marcados', () => {
    assert.match(app.selLBarraHtml('prop'), /id="selLTransferir" data-sel-l-precisa data-toca="camada" data-click="CW\.selLTransferir\(\)">[\s\S]*? Passar o controlo<\/button>/);
    assert.match(app.selLBarraHtml('prop'), /<p class="sel-l-info">/, 'a contagem com a razão por cima');
    assert.equal(app.selLComAcoes('prop'), true);
    const b = app.document.getElementById('selLTransferir'), pq = app.document.getElementById('selLPorque');
    app.CW.selL = { tipo: 'prop', ids: { H2: 1, H7: 1 } };
    app.selLPintarTransferir();
    assert.equal(b.disabled, true);
    assert.equal(pq.textContent, 'Só passas o controlo dos que criaste, com comproprietários e sem um pedido pendente.');
    app.CW.selL = { tipo: 'prop', ids: { H1: 1, H2: 1, H7: 1 } };
    app.selLPintarTransferir();
    assert.equal(b.disabled, false);
    assert.equal(pq.textContent, 'Passar o controlo deixa 2 de fora.');
    app.CW.selLTransferir();
    assert.equal(esp.modais[0].title, 'Passar o controlo');
    assert.deepEqual(simples(app._trf.ids), ['H1']);
  });
});
