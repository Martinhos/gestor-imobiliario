// As três portas da partilha, na camada da nuvem: os botões nos vazios do
// «Convidar colaborador», o cartão «Pedidos por responder» no topo da vista
// geral (em todos os estados dela) e as quotas ao escolher a casa no modal
// das partilhas, com a proposta a seguir à partilha. Como o
// colaboradores-cloud.test.js: nucleo, utilizadores, partilha, colaboradores
// e painel por cima da app do arnês, com api, pullNow, toast e as janelas
// trocados por espiões.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { carregarApp } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');
const espera = () => new Promise((r) => setTimeout(r, 5));

// A app com a nuvem por cima e os espiões: esp.api regista cada chamada (e
// esp.resposta decide o que ela devolve), esp.toasts as mensagens, e as
// janelas abrem numa pilha observável (esp.abertas) para chegar ao onSave.
function montar() {
  const app = carregarApp();
  app.document.documentElement.style.removeProperty = () => {};
  const ctx = app.__ctx;
  for (const nome of ['nucleo', 'utilizadores', 'partilha', 'colaboradores', 'painel']) {
    vm.runInContext(le('web/cloud/' + nome + '.js'), ctx, { filename: 'cloud/' + nome + '.js' });
  }
  const esp = { api: [], toasts: [], abertas: null, resposta: null };
  app.api = (method, p, body) => {
    esp.api.push({ method, path: p, body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)) });
    const r = esp.resposta ? esp.resposta(method, p, body) : {};
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  app.toast = (m) => { esp.toasts.push(m); };
  esp.abertas = janelasFalsas(app, 'render', 'setSyncBadge', 'subirPendentes');
  app.pullNow = () => Promise.resolve();
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
  app.CW._pulled = 1;
  app.CW._esperaFim = 1;   // como depois do primeiro sync: o que estiver vazio está mesmo vazio
  return { app, esp };
}

// O estado do servidor: duas casas minhas (a Minha já partilhada com o Rui,
// a Segunda ainda não), a ligação ativa com o Rui, um cargo, e nada por
// responder. A Ana tem perfil, para poder ser comproprietária.
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'RUI'], updatedAt: 1,
      data: { id: 'H1', name: 'Minha', address: 'Rua A' } },
    { id: 'H5', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1,
      data: { id: 'H5', name: 'Segunda', address: 'Rua B' } },
  ],
  records: [], userRecords: [],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }, { userId: 'ANA', name: 'Ana', data: null }],
  connections: [{ id: 'K1', status: 'active', incoming: false, peer: { id: 'RUI', name: 'Rui', email: 'rui@exemplo.pt' }, myShares: ['H1'], peerShares: [] }],
  roles: [{ id: 'R2', name: 'Gestor de visitas', perms: ['visit.view'], n: 0 }],
  collaborators: [], invites: [], people: [],
  shareLink: null,
  shareRequests: { incoming: [], outgoing: [] },
});

// A app montada com o estado de ESTADO() (ou o que muda lhe fizer) na base e em CW.state.
// Recebe: muda (opcional) — função que recebe o estado e o altera antes de o usar.
// Devolve: {app, esp}.
function comEstado(muda) {
  const { app, esp } = montar();
  const st = ESTADO();
  if (muda) muda(st);
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  return { app, esp };
}

const PEDIDO = (st) => { st.shareRequests.incoming = [{ id: 'p1', fromName: 'Ana', houseName: 'T2 Porto', createdAt: 1 }]; };
const CONVITE = (st) => { st.connections.push({ id: 'K2', status: 'pending', incoming: true, peer: { id: 'ZE', name: 'Zé', email: 'ze@exemplo.pt' } }); };
// um pedido para entrar no meu grupo G2 (o Zé) e um que eu fiz para entrar no do Tó
const GRUPO = (st) => {
  st.sharedGroupRequests = {
    incoming: [{ groupId: 'G2', groupName: 'Família', userId: 'ZE', name: 'Zé', createdAt: 1 }],
    outgoing: [{ groupId: 'G7', groupName: 'Casas de Faro', ownerName: 'Tó', createdAt: 1 }],
  };
};

/* ------------------------------------------------ o «Convidar colaborador» nos vazios */

describe('o «Convidar colaborador» sem cargos ou sem imóveis', () => {
  test('sem cargos, a frase fica e ganha o botão «Novo cargo»', () => {
    const { app } = comEstado((st) => { st.roles = []; });
    const h = app.convidarCard();
    assert.match(h, /Cria primeiro um cargo, no cartão «Cargos» em baixo\./);
    assert.match(h, /data-toca="camada" data-click="CW\.cargoModal\(\)">Novo cargo</);
  });

  test('sem imóveis meus, a frase fica e ganha o botão «Adicionar imóvel», que abre o formulário do imóvel', () => {
    const { app } = comEstado((st) => { st.houses = []; });
    const h = app.convidarCard();
    assert.match(h, /Ainda não tens imóveis para partilhar — cria um primeiro\./);
    assert.match(h, /data-toca="camada" data-click="propModal\(\)">Adicionar imóvel</);
  });

  test('sem o serviço dos Imóveis, em vez do botão fica a frase de quem o liga', () => {
    const { app } = comEstado((st) => { st.houses = []; });
    // o fecho dos serviços desliga os Colaboradores com os Imóveis (requer): o ramo só se vê trocando a pergunta
    app.servicoLigado = (id) => id !== 'properties';
    const h = app.convidarCard();
    assert.match(h, /Ainda não tens imóveis para partilhar/);
    assert.ok(h.includes(app.fraseServicoDesligado('properties')), 'a frase de serviço desligado: ' + h);
    assert.ok(!h.includes('propModal()') && !h.includes('Adicionar imóvel'), 'sem o botão');
  });
});

/* ------------------------------------------------ o cartão «Pedidos por responder» */

describe('pedidosDashCard', () => {
  test('sem nada por responder, nada', () => {
    const { app } = comEstado();
    assert.equal(app.pedidosDashCard(), '');
  });

  test('um pedido de partilha recebido: quem quer partilhar o quê, Aceitar e Recusar pelos handlers que já existem', () => {
    const { app } = comEstado(PEDIDO);
    const h = app.pedidosDashCard();
    assert.match(h, /<div class="title">Pedidos por responder<\/div><div class="small">1 por responder<\/div>/);
    assert.match(h, /Ana quer partilhar T2 Porto contigo/);
    assert.match(h, /data-toca="dados" data-click="CW\.pedidoAceitar\('p1'\)">Aceitar</);
    assert.match(h, /data-toca="dados" data-click="CW\.pedidoRecusar\('p1'\)">Recusar</);
  });

  test('um convite de ligação recebido: «quer ligar-se a ti», Aceitar com acceptConn e Recusar com delConn', () => {
    const { app } = comEstado(CONVITE);
    const h = app.pedidosDashCard();
    assert.match(h, /1 por responder/);
    assert.match(h, /Zé quer ligar-se a ti/);
    assert.match(h, /Se aceitares, cada um pode escolher que casas partilha com o outro\./);
    assert.match(h, /data-toca="dados" data-click="CW\.acceptConn\('K2'\)">Aceitar</);
    assert.match(h, /data-toca="dados" data-click="CW\.delConn\('K2',1\)">Recusar</);
  });

  test('os dois juntos contam-se; os enviados (o pedido à espera, o convite enviado) não entram', () => {
    const enviados = (st) => {
      st.shareRequests.outgoing = [{ id: 'p2', toName: 'Rui', houseName: 'Minha' }];
      st.connections.push({ id: 'K3', status: 'pending', incoming: false, peer: { id: 'LU', name: 'Lurdes' } });
    };
    const { app } = comEstado((st) => { PEDIDO(st); CONVITE(st); enviados(st); });
    const h = app.pedidosDashCard();
    assert.match(h, /2 por responder/);
    assert.ok(h.includes('Ana quer partilhar') && h.includes('Zé quer ligar-se'));
    assert.ok(!h.includes('Lurdes') && !h.includes("'p2'") && !h.includes('Cancelar'), 'os enviados ficam de fora: ' + h);
    const { app: so } = comEstado(enviados);
    assert.equal(so.pedidosDashCard(), '', 'só com enviados não há nada a responder');
  });

  test('com o serviço Colaboradores desligado os pedidos de partilha não entram, mas os convites de ligação sim', () => {
    const { app } = comEstado(PEDIDO);
    app.definirServicosDesligados(['colaboradores']);
    assert.equal(app.pedidosDashCard(), '');
    const { app: b } = comEstado((st) => { PEDIDO(st); CONVITE(st); });
    b.definirServicosDesligados(['colaboradores']);
    const h = b.pedidosDashCard();
    assert.match(h, /1 por responder/);
    assert.match(h, /Zé quer ligar-se a ti/);
    assert.ok(!h.includes('Ana quer partilhar'));
  });

  test('um pedido para entrar num grupo meu: «<nome> quer entrar no grupo «<grupo>»», o que aceitar implica, Aceitar e Recusar com o grupo e a pessoa; o que eu fiz não entra', () => {
    const { app } = comEstado(GRUPO);
    const h = app.pedidosDashCard();
    assert.match(h, /<div class="title">Pedidos por responder<\/div><div class="small">1 por responder<\/div>/);
    assert.match(h, /<b class="u-d-block">Zé quer entrar no grupo «Família»<\/b><span class="small">Se aceitares, passa a comproprietário dos imóveis do grupo\.<\/span>/);
    assert.match(h, /data-toca="dados" data-click="CW\.grupoAceitarPedido\('G2','ZE'\)">Aceitar</);
    assert.match(h, /data-toca="dados" data-click="CW\.grupoRecusarPedido\('G2','ZE'\)">Recusar</);
    assert.ok(!h.includes('Casas de Faro') && !h.includes('Cancelar'), 'o pedido que fiz não é para responder: ' + h);
    assert.ok(h.endsWith('<!--fim-pedidos-->'), 'e o guia continua a entrar depois');
    assert.ok(!/on[a-z]+=|style=/.test(h), 'nada em linha');
    // os nomes escapam no texto e os ids no data-click
    const { app: b } = comEstado((st) => { st.sharedGroupRequests = { incoming: [{ groupId: "G'2", groupName: '<i>Casa</i>', userId: "Z'E", name: 'Zé <b>' }], outgoing: [] }; });
    const e = b.pedidosDashCard();
    assert.ok(e.includes('Zé &lt;b&gt; quer entrar no grupo «&lt;i&gt;Casa&lt;/i&gt;»'), e);
    assert.ok(e.includes("CW.grupoAceitarPedido('" + b.jsq("G'2") + "','" + b.jsq("Z'E") + "')"), e);
    assert.ok(e.includes("'G\\&#039;2'"), 'a plica escapada para o JS e para o atributo: ' + e);
  });

  test('os três juntos contam-se — partilha, grupo e convite de ligação, por esta ordem', () => {
    const { app } = comEstado((st) => { PEDIDO(st); GRUPO(st); CONVITE(st); });
    const h = app.pedidosDashCard();
    assert.match(h, /3 por responder/);
    const iP = h.indexOf('Ana quer partilhar'), iG = h.indexOf('Zé quer entrar no grupo'), iC = h.indexOf('Zé quer ligar-se');
    assert.ok(iP > -1 && iP < iG && iG < iC, [iP, iG, iC].join(', '));
  });

  test('com os Colaboradores desligados o pedido de grupo não entra nem conta; um estado sem a lista (de antes da regra) ou com pedidos mal formados também não rebenta', () => {
    const { app } = comEstado(GRUPO);
    app.definirServicosDesligados(['colaboradores']);
    assert.equal(app.pedidosDashCard(), '');
    const { app: b } = comEstado((st) => { GRUPO(st); CONVITE(st); });
    b.definirServicosDesligados(['colaboradores']);
    const h = b.pedidosDashCard();
    assert.match(h, /1 por responder/);
    assert.ok(!h.includes('quer entrar no grupo') && !h.includes('grupoAceitarPedido'));
    const { app: c } = comEstado((st) => { delete st.sharedGroupRequests; });
    assert.equal(c.pedidosDashCard(), '');
    const { app: d } = comEstado((st) => { st.sharedGroupRequests = { incoming: [{ groupId: 'G2', groupName: 'X' }, null], outgoing: [] }; });
    assert.equal(d.pedidosDashCard(), '', 'sem a pessoa não há o que aceitar');
    // um pedido de um grupo que está na base e não é meu nunca ganha botões
    const { app: f } = comEstado((st) => {
      st.sharedGroups = [{ id: 'G1', name: 'Casas do Porto', ownerId: 'RUI', ownerName: 'Rui', mine: false, members: [{ id: 'RUI', name: 'Rui' }, { id: 'EU', name: 'Eu' }], houses: [], link: null }];
      st.sharedGroupRequests = { incoming: [{ groupId: 'G1', groupName: 'Casas do Porto', userId: 'ZE', name: 'Zé' }], outgoing: [] };
    });
    assert.equal(f.grp('G1')._meu, false, 'controlo: o grupo está na base e é do Rui');
    assert.equal(f.pedidosDashCard(), '', 'nenhum botão de aceitar a quem não é dono');
  });

  test('o cartão dos pedidos nos Proprietários e o da ligação usam as mesmas linhas e botões', () => {
    const { app } = comEstado((st) => { PEDIDO(st); CONVITE(st); });
    const dash = app.pedidosDashCard(), conta = app.pedidosCard(), lig = app.connCard(app.CW.state.connections[1]);
    const linha = /<div class="pd-linha"><b class="u-d-block">Ana quer partilhar T2 Porto contigo<\/b>[\s\S]*?<\/div><\/div>/;
    assert.equal(linha.exec(dash)[0], linha.exec(conta)[0], 'a linha do pedido é uma só');
    const botoes = /<button class="btn primary sm" data-toca="dados" data-click="CW\.acceptConn\('K2'\)">Aceitar<\/button><button[^>]*>Recusar<\/button>/;
    assert.equal(botoes.exec(dash)[0], botoes.exec(lig)[0], 'os botões do convite são os mesmos');
  });

  /* Recusar um pedido não destrói nada (quem pediu pode voltar a pedir): é o
     botão secundário, e não o vermelho cheio do que apaga (o canvas Main). */
  test('o «Recusar» é o botão secundário em todas as linhas, e nunca o vermelho', () => {
    const { app } = comEstado((st) => { PEDIDO(st); GRUPO(st); CONVITE(st); });
    const h = app.pedidosDashCard() + app.pedidosCard() + app.connCard(app.CW.state.connections[1]);
    const recusas = h.match(/<button[^>]*>Recusar<\/button>/g) || [];
    assert.ok(recusas.length >= 5, 'as três do cartão, a do pedido nos Proprietários e a do convite: ' + recusas.length);
    for (const b of recusas) {
      assert.match(b, /^<button class="btn sm" data-toca="dados" data-click="CW\.(?:pedidoRecusar|grupoRecusarPedido|delConn)\(/, b);
      assert.doesNotMatch(b, /danger/, b);
    }
  });

  /* As linhas sozinhas, sem cartão: o que a Visão geral junta à atividade num
     cartão só («Pedidos e atividade», o canvas Main). O cartão é feito delas. */
  test('linhasDosPedidos devolve só as linhas — partilha, grupo e convite, por esta ordem — e o cartão leva-as por dentro', () => {
    const { app } = comEstado((st) => { PEDIDO(st); GRUPO(st); CONVITE(st); });
    const l = app.linhasDosPedidos();
    assert.ok(l.startsWith('<div class="pd-linha">') && l.endsWith('</div></div>'), 'começa e acaba numa linha: ' + l.slice(0, 80));
    assert.equal((l.match(/<div class="pd-linha">/g) || []).length, 3, 'uma por pedido');
    assert.ok(!/class="card|title|por responder|<!--fim-pedidos-->|u-h-14px/.test(l), 'sem cartão, sem título, sem marca nem espaço');
    const iP = l.indexOf('Ana quer partilhar'), iG = l.indexOf('Zé quer entrar no grupo'), iC = l.indexOf('Zé quer ligar-se');
    assert.ok(iP > -1 && iP < iG && iG < iC, [iP, iG, iC].join(', '));
    assert.ok(app.pedidosDashCard().includes('<div class="pd-lista">' + l + '</div>'), 'o cartão é o das linhas');
    // sem nada por responder, vazio; e o serviço desligado tira os pedidos dele, como no cartão
    const { app: vazio } = comEstado();
    assert.equal(vazio.linhasDosPedidos(), '');
    app.definirServicosDesligados(['colaboradores']);
    assert.equal((app.linhasDosPedidos().match(/<div class="pd-linha">/g) || []).length, 1, 'só o convite de ligação');
  });
});

/* ------------------------------------------------ o embrulho da vista geral (cloud/painel.js) */

/* O DOM do arnês não lê HTML: um elemento falso cujo innerHTML se parte nos
   filhos de topo — cada um com classList, id, outerHTML, textContent, os
   querySelector que o dashKey do painel faz e os seus filhos —, o que o
   embrulho da vista geral precisa para partir a vista em blocos.
   Devolve: o elemento falso. */
function elementoQueLe() {
  let html = '';
  return {
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; },
    get children() { return filhosDe(html); },
    get firstElementChild() { return filhosDe(html)[0] || null; },
    classList: { contains: () => false }, id: '', querySelector: () => null, querySelectorAll: () => [],
  };
}
const VAZIAS = new Set(['input', 'br', 'hr', 'img', 'path', 'circle', 'line', 'rect', 'polyline', 'use']);
// Recebe: html — um texto de HTML.
// Devolve: os nós de topo (elementos falsos, ver noDe), pela ordem.
function filhosDe(html) {
  const out = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
  let m, prof = 0, ini = 0, tag = '', attrs = '', fimAbre = 0;
  while ((m = re.exec(html))) {
    if (!m[2]) continue;
    const nome = m[2].toLowerCase(), auto = m[0].endsWith('/>') || VAZIAS.has(nome);
    if (m[1]) {
      if (--prof === 0) out.push(noDe(html.slice(ini, m.index + m[0].length), tag, attrs, html.slice(fimAbre, m.index)));
      continue;
    }
    if (prof === 0) {
      ini = m.index; tag = nome; attrs = m[3]; fimAbre = m.index + m[0].length;
      if (auto) out.push(noDe(m[0], tag, attrs, ''));
    }
    if (!auto) prof++;
  }
  return out;
}
// Recebe: parte — um passo de seletor ('.classe' ou '#id'); g — true para casar todas as ocorrências.
// Devolve: a expressão que casa a etiqueta de abertura de um elemento com essa classe ou id.
const etiquetaCom = (parte, g) => new RegExp('<[a-zA-Z][\\w-]*[^>]*\\b' + (parte[0] === '#' ? 'id="' + parte.slice(1) + '"' : 'class="[^"]*\\b' + parte.slice(1) + '\\b[^"]*"') + '[^>]*>', g ? 'g' : '');
// Recebe: outer — o HTML do elemento inteiro; tag, attrs — a etiqueta e os atributos; inner — o HTML de dentro.
// Devolve: o elemento falso, com o que o embrulho da vista geral lhe pede.
function noDe(outer, tag, attrs, inner) {
  const cls = ((/class="([^"]*)"/.exec(attrs) || [, ''])[1]).split(/\s+/);
  const id = (/\bid="([^"]*)"/.exec(attrs) || [, ''])[1];
  const texto = (desde) => {
    const fimTag = inner.indexOf('>', desde), nomeTag = /<([a-zA-Z][\w-]*)/.exec(inner.slice(desde))[1];
    const fecho = inner.indexOf('</' + nomeTag + '>', fimTag);
    return { textContent: inner.slice(fimTag + 1, fecho < 0 ? undefined : fecho).replace(/<[^>]+>/g, '') };
  };
  const todos = (sel) => {
    const partes = sel.trim().split(/\s+/);
    if (partes.slice(0, -1).some((p) => !etiquetaCom(p).test(inner))) return [];
    return [...inner.matchAll(etiquetaCom(partes[partes.length - 1], true))].map((x) => texto(x.index));
  };
  return {
    outerHTML: outer, id, tag, classList: { contains: (c) => cls.includes(c) },
    textContent: inner.replace(/<[^>]+>/g, ''),
    querySelector: (sel) => todos(sel)[0] || null,
    querySelectorAll: todos,
    get children() { return filhosDe(inner); },
    get firstElementChild() { return filhosDe(inner)[0] || null; },
  };
}

describe('o embrulho da vista geral põe o cartão à cabeça', () => {
  test('na vista vazia («Ainda não há nada registado»)', () => {
    const { app } = comEstado((st) => { st.houses = []; PEDIDO(st); });
    const h = app.vDashboard();
    const iP = h.indexOf('Pedidos por responder'), iV = h.indexOf('Ainda não há nada registado');
    assert.ok(iP > -1 && iV > -1, h.slice(0, 400));
    assert.ok(iP < iV, 'o cartão vem antes do vazio');
    assert.ok(h.startsWith('<div class="card"><div><div class="title">Pedidos por responder'), 'à cabeça de tudo');
  });

  test('na vista de quem só colabora (antes do «O que podes fazer»)', () => {
    const { app } = comEstado((st) => {
      st.houses = [{ id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI'], updatedAt: 1,
        collab: { id: 'C9', roleId: 'R1', roleName: 'Gestor de visitas', perms: ['visit.view'] }, data: { id: 'H2', name: 'Do Rui' } }];
      CONVITE(st);
    });
    const h = app.vDashboard();
    const iP = h.indexOf('Pedidos por responder'), iQ = h.indexOf('O que podes fazer');
    assert.ok(iP > -1 && iQ > -1, h.slice(0, 400));
    assert.ok(iP < iQ, 'o cartão vem antes do «O que podes fazer»');
    assert.ok(h.startsWith('<div class="card"><div><div class="title">Pedidos por responder'), 'à cabeça de tudo');
  });

  test('na vista cheia, antes da parte fixa e fora da grelha ordenável', () => {
    const { app } = comEstado(PEDIDO);
    app.document.createElement = () => elementoQueLe();
    app._vDashboard = () => '<div class="hint">filtro</div>' +
      '<div class="grid"><div class="card kpi"><span class="label">Receita</span></div></div>' +
      '<div class="cols"><div class="card"><div class="title">Entradas e saídas</div></div><div class="card"><div class="title">Cashflow acumulado</div></div></div>';
    const h = app.vDashboard();
    const iP = h.indexOf('Pedidos por responder'), iF = h.indexOf('<div class="hint">filtro</div>'), iC = h.indexOf('<div class="cw-cont">');
    assert.ok(iP > -1 && iF > -1 && iC > -1, h);
    assert.ok(iP < iF && iF < iC, 'o cartão, depois o fixo, depois a grelha');
    assert.equal((h.match(/class="cw-blk/g) || []).length, 3, 'os blocos ordenáveis são a fila dos indicadores e os dois cartões');
    assert.match(h, /data-k="kpi:Receita"/);
    assert.match(h, /data-k="card:Entradas e saídas"/);
    assert.match(h, /data-k="card:Cashflow acumulado"/);
    // sem pedidos, a vista é a de sempre
    app.CW.state.shareRequests.incoming = [];
    assert.ok(app.vDashboard().startsWith('<div class="hint">filtro</div><div class="cw-cont">'));
  });
});

/* ------------------------------------------------ as quotas ao escolher a casa (CW.sharesModal) */

describe('as quotas ao escolher a casa a partilhar', () => {
  // abre o modal das partilhas com o Rui; a caixa da casa já partilhada vem marcada, como o browser a lê do HTML
  const abrir = (muda) => {
    const r = comEstado(muda);
    r.app.CW.sharesModal('K1');
    r.corpo = r.esp.abertas[0].b;
    r.app.document.getElementById('cw_sh_H1').checked = true;
    return r;
  };
  // marca (ou desmarca) a caixa de uma casa e corre o data-change dela, como o browser faria
  const marcar = (app, hid, on) => { app.document.getElementById('cw_sh_' + hid).checked = on; app.CW.shareCasaMudou(hid); };
  const bloco = (app, hid) => app.document.getElementById('cw_qb_' + hid).innerHTML;
  const escreve = (app, hid, valores) => { for (const [u, v] of Object.entries(valores)) app.document.getElementById('cw_q_' + hid + '_' + u).value = v; };
  const chamadas = (esp) => esp.api.map((x) => x.method + ' ' + x.path);

  test('a casa já partilhada vem marcada, com a divisão em vigor e «Propor nova divisão»; a nova traz a caixa com o data-change e o lugar do bloco, vazio', () => {
    const { corpo, esp } = abrir();
    assert.equal(esp.abertas[0].t, 'Partilha com Rui');
    assert.match(corpo, /id="cw_sh_H1" checked data-toca="rascunho" data-change="CW\.shareCasaMudou\('H1'\)">/);
    assert.match(corpo, /<div id="cw_qb_H1"><div class="pt-quotas">[\s\S]*?Eu \(tu\)<\/span><b class="num">50%<\/b>[\s\S]*?Rui<\/span><b class="num">50%<\/b>/);
    assert.match(corpo, /data-toca="rascunho" data-click="CW\.shareProporAbrir\('H1'\)">Propor nova divisão</);
    assert.ok(!corpo.includes('cw_q_H1_'), 'sem campos antes de propor');
    assert.match(corpo, /id="cw_sh_H5" data-toca="rascunho" data-change="CW\.shareCasaMudou\('H5'\)">/);
    assert.match(corpo, /<div id="cw_qb_H5"><\/div>/);
    assert.ok(!corpo.includes('cw_q_H5_'), 'sem campos de quotas antes de marcar');
  });

  test('marcar a casa nova mostra um campo por comproprietário mais o par, em partes iguais, com a frase; desmarcar esconde', () => {
    const { app } = abrir();
    marcar(app, 'H5', true);
    const b = bloco(app, 'H5');
    // uma linha por pessoa (o canvas M-Quotas): o nome, o campo com nome para o leitor de ecrã, e o %
    assert.match(b, /<label class="pt-quota"><span class="pt-quota-nome">Eu \(tu\)<\/span><input id="cw_q_H5_EU" type="text" inputmode="decimal" value="50" aria-label="Eu \(tu\), quota em %" autocomplete="off"><span class="pt-pct" aria-hidden="true">%<\/span><\/label>/);
    assert.match(b, /<label class="pt-quota"><span class="pt-quota-nome">Rui<\/span><input id="cw_q_H5_RUI" type="text" inputmode="decimal" value="50" aria-label="Rui, quota em %" autocomplete="off">/);
    assert.match(b, /A divisão só entra em vigor depois de o outro confirmar; até lá fica em partes iguais\./);
    assert.equal((b.match(/<input /g) || []).length, 2);
    marcar(app, 'H5', false);
    assert.equal(bloco(app, 'H5'), '');
  });

  test('com três donos (a casa já a meias com a Ana) os campos são três, a 33,3', () => {
    const { app } = abrir((st) => { st.houses[1].participants = ['EU', 'ANA']; });
    marcar(app, 'H5', true);
    const b = bloco(app, 'H5');
    for (const u of ['EU', 'ANA', 'RUI']) assert.match(b, new RegExp('id="cw_q_H5_' + u + '" [^>]*value="33,3"'));
    assert.equal((b.match(/<input /g) || []).length, 3);
    assert.match(b, /<span class="pt-quota-nome">Ana<\/span>/);
  });

  test('desmarcar e voltar a marcar repõe o que estava escrito', () => {
    const { app } = abrir();
    marcar(app, 'H5', true);
    escreve(app, 'H5', { EU: '70', RUI: '30' });
    marcar(app, 'H5', false);
    marcar(app, 'H5', true);
    assert.match(bloco(app, 'H5'), /cw_q_H5_EU" [^>]*value="70"/);
    assert.match(bloco(app, 'H5'), /cw_q_H5_RUI" [^>]*value="30"/);
  });

  test('guardar com a soma longe de 100 recusa, sem chamar a API e sem fechar', async () => {
    const { app, esp } = abrir();
    marcar(app, 'H5', true);
    escreve(app, 'H5', { EU: '60', RUI: '60' });
    esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(esp.api, []);
    assert.deepEqual(esp.toasts, ['As percentagens de Segunda têm de somar 100 (agora somam 120).']);
    assert.equal(app.modalStack.length, 1, 'o modal não fechou');
    // uma percentagem negativa também
    escreve(app, 'H5', { EU: '-10', RUI: '110' });
    esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(esp.api, []);
    assert.equal(esp.toasts[1], 'Percentagens inválidas em Segunda.');
  });

  test('guardar com 60/40 (com vírgula decimal) faz o PUT das partilhas e depois o POST da proposta com essas quotas', async () => {
    const { app, esp } = abrir();
    marcar(app, 'H5', true);
    escreve(app, 'H5', { EU: '60,0', RUI: '40' });
    esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(chamadas(esp), ['PUT /api/connections/K1/shares', 'POST /api/houses/H5/proposal']);
    assert.deepEqual(esp.api[0].body, { houseIds: ['H1', 'H5'] });
    assert.deepEqual(esp.api[1].body, { shares: { EU: 60, RUI: 40 } });
    assert.equal(app.modalStack.length, 0, 'o modal fechou');
    assert.deepEqual(esp.toasts, ['Partilha atualizada. A proposta de divisão seguiu — falta a confirmação do outro comproprietário.']);
  });

  test('guardar em partes iguais partilha sem proposta', async () => {
    const { app, esp } = abrir();
    marcar(app, 'H5', true);
    escreve(app, 'H5', { EU: '50', RUI: '50' });   // o que o browser lê do value="50" dos campos; o DOM do arnês não o lê
    esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(chamadas(esp), ['PUT /api/connections/K1/shares']);
    assert.deepEqual(esp.api[0].body, { houseIds: ['H1', 'H5'] });
    assert.deepEqual(esp.toasts, ['Partilha atualizada.']);
  });

  test('uma casa que já estava partilhada não envia proposta — só a lista muda', async () => {
    const { esp } = abrir();
    esp.abertas[0].onSave();   // a Minha continua marcada, a Segunda não
    await espera();
    assert.deepEqual(chamadas(esp), ['PUT /api/connections/K1/shares']);
    assert.deepEqual(esp.api[0].body, { houseIds: ['H1'] });
    const b = abrir();
    b.app.document.getElementById('cw_sh_H1').checked = false;   // deixa de a partilhar
    b.esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(chamadas(b.esp), ['PUT /api/connections/K1/shares']);
    assert.deepEqual(b.esp.api[0].body, { houseIds: [] });
    assert.deepEqual(b.esp.toasts, ['Partilha atualizada.']);
  });

  test('desmarcar a casa já partilhada tira a divisão e diz que o outro deixa de a ver; voltar a marcar repõe', () => {
    const { app } = abrir();
    marcar(app, 'H1', false);
    assert.match(bloco(app, 'H1'), /Ao guardar, Rui deixa de ver esta casa e de ter quota nela\./);
    marcar(app, 'H1', true);
    assert.match(bloco(app, 'H1'), /Propor nova divisão/);
  });

  test('«Propor nova divisão» abre os campos com a divisão atual; guardar com 70/30 faz o PUT e a proposta, sem mudar a lista', async () => {
    const { app, esp } = abrir();
    app.CW.shareProporAbrir('H1');
    const b = bloco(app, 'H1');
    assert.match(b, /id="cw_q_H1_EU" [^>]*value="50"/);
    assert.match(b, /id="cw_q_H1_RUI" [^>]*value="50"/);
    assert.match(b, /A nova divisão só entra em vigor depois de todos os comproprietários confirmarem\./);
    assert.match(b, /CW\.shareProporFechar\('H1'\)">Não propor</);
    escreve(app, 'H1', { EU: '70', RUI: '30' });
    esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(chamadas(esp), ['PUT /api/connections/K1/shares', 'POST /api/houses/H1/proposal']);
    assert.deepEqual(esp.api[0].body, { houseIds: ['H1'] });
    assert.deepEqual(esp.api[1].body, { shares: { EU: 70, RUI: 30 } });
    assert.deepEqual(esp.toasts, ['A proposta de divisão seguiu — falta a confirmação do outro comproprietário.']);
  });

  test('a nova divisão igual à atual, ou fechada com «Não propor», não envia proposta; a soma errada recusa', async () => {
    const a = abrir();
    a.app.CW.shareProporAbrir('H1');
    escreve(a.app, 'H1', { EU: '50', RUI: '50' });
    a.esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(chamadas(a.esp), ['PUT /api/connections/K1/shares']);
    const b = abrir();
    b.app.CW.shareProporAbrir('H1');
    escreve(b.app, 'H1', { EU: '80', RUI: '20' });
    b.app.CW.shareProporFechar('H1');
    assert.ok(!bloco(b.app, 'H1').includes('cw_q_H1_'), 'fechou os campos');
    b.app.CW.shareProporAbrir('H1');
    assert.match(bloco(b.app, 'H1'), /id="cw_q_H1_EU" [^>]*value="80"/, 'reabre com o que estava escrito');
    b.app.CW.shareProporFechar('H1');
    b.esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(chamadas(b.esp), ['PUT /api/connections/K1/shares']);
    const c = abrir();
    c.app.CW.shareProporAbrir('H1');
    escreve(c.app, 'H1', { EU: '80', RUI: '30' });
    c.esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(c.esp.api, []);
    assert.deepEqual(c.esp.toasts, ['As percentagens de Minha têm de somar 100 (agora somam 110).']);
  });

  test('a proposta por responder mostra-se: a do outro confirma-se ali; a minha diz de quem se espera e cancela-se', async () => {
    const outro = abrir((st) => { st.proposals = [{ houseId: 'H1', shares: { EU: 40, RUI: 60 }, approvals: ['RUI'], proposedByName: 'Rui' }]; });
    assert.match(outro.corpo, /Eu \(tu\)<\/span><b class="num">50% <span class="u-c-v-warn">→ 40%<\/span>/);
    assert.match(outro.corpo, /<b>Rui<\/b> propôs esta nova divisão\./);
    assert.match(outro.corpo, /CW\.shareResponder\('H1',1\)">Confirmar nova divisão</);
    assert.ok(!outro.corpo.includes('shareProporAbrir'), 'com proposta por responder, não se propõe outra por cima');
    await outro.app.CW.shareResponder('H1', 1);
    assert.deepEqual(chamadas(outro.esp), ['POST /api/houses/H1/proposal/accept']);
    const minha = abrir((st) => { st.proposals = [{ houseId: 'H1', shares: { EU: 60, RUI: 40 }, approvals: ['EU'], proposedByName: 'Eu' }]; });
    assert.match(minha.corpo, /à espera de: <b>Rui<\/b>/);
    assert.match(minha.corpo, /CW\.shareResponder\('H1',0\)">Cancelar proposta</);
  });

  test('as casas que o outro partilha comigo aparecem por baixo, sem caixa, com a divisão e o «Propor nova divisão»', async () => {
    const { app, esp, corpo } = abrir((st) => {
      st.houses.push({ id: 'H9', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1, data: { id: 'H9', name: 'Do Rui', address: 'Rua C' } });
      st.connections[0].peerShares = ['H9'];
    });
    assert.match(corpo, /O que Rui partilha contigo<\/div>[\s\S]*?<b class="u-d-block">Do Rui<\/b>/);
    assert.ok(!corpo.includes('cw_sh_H9'), 'não é minha: não se adiciona nem remove daqui');
    assert.match(corpo, /CW\.shareProporAbrir\('H9'\)/);
    app.CW.shareProporAbrir('H9');
    escreve(app, 'H9', { RUI: '30', EU: '70' });
    esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(chamadas(esp), ['PUT /api/connections/K1/shares', 'POST /api/houses/H9/proposal']);
    assert.deepEqual(esp.api[0].body, { houseIds: ['H1'] }, 'a lista das minhas fica como estava');
  });

  test('a proposta que falha depois do PUT: a partilha fica feita, e diz-se que a proposta não seguiu e onde a propor', async () => {
    const { app, esp } = abrir();
    marcar(app, 'H5', true);
    escreve(app, 'H5', { EU: '60', RUI: '40' });
    esp.resposta = (m, p) => (p.endsWith('/proposal') ? Object.assign(new Error('Sem permissão.'), { status: 403 }) : {});
    esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(chamadas(esp), ['PUT /api/connections/K1/shares', 'POST /api/houses/H5/proposal']);
    assert.equal(app.modalStack.length, 0, 'a partilha ficou feita e o modal fechou');
    assert.deepEqual(esp.toasts, ['Partilha atualizada, mas a proposta de divisão não seguiu — Segunda: Sem permissão. Podes propô-la na ficha do imóvel.']);
  });

  test('o PUT que falha não fecha o modal nem envia proposta nenhuma', async () => {
    const { app, esp } = abrir();
    marcar(app, 'H5', true);
    escreve(app, 'H5', { EU: '60', RUI: '40' });
    esp.resposta = () => new Error('Erro 500');
    esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(chamadas(esp), ['PUT /api/connections/K1/shares']);
    assert.equal(app.modalStack.length, 1);
    assert.deepEqual(esp.toasts, ['Erro 500']);
  });
});

/* ------------------------------------------------ enviarProposta */

describe('enviarProposta', () => {
  test('é o único sítio com a rota da proposta; o proposeShares da ficha passa por ele', async () => {
    assert.equal((le('web/cloud/utilizadores.js').match(/\/proposal'/g) || []).length, 1, 'a rota escreve-se uma vez');
    assert.ok(!le('web/cloud/partilha.js').includes('/proposal'), 'o modal das partilhas não fala com a rota');
    const { app, esp } = comEstado();
    const enviadas = [];
    app.enviarProposta = (hid, shares) => { enviadas.push({ hid, shares: JSON.parse(JSON.stringify(shares)) }); return Promise.resolve({}); };
    app.CW.proposeShares('H1');
    assert.equal(esp.abertas[0].t, 'Propor nova divisão');
    app.document.getElementById('cw_pp_EU').value = '70';
    app.document.getElementById('cw_pp_RUI').value = '30';
    esp.abertas[0].onSave();
    await espera();
    assert.deepEqual(enviadas, [{ hid: 'H1', shares: { EU: 70, RUI: 30 } }]);
    assert.deepEqual(esp.api, [], 'a chamada à API é do enviarProposta');
    assert.deepEqual(esp.toasts, ['Proposta enviada — falta a confirmação dos outros comproprietários.']);
  });

  test('chama POST /api/houses/:hid/proposal com {shares} e devolve a promessa da API', async () => {
    const { app, esp } = comEstado();
    esp.resposta = () => ({ ok: 1 });
    const r = await app.enviarProposta('H5', { EU: 60, RUI: 40 });
    assert.deepEqual(JSON.parse(JSON.stringify(r)), { ok: 1 });
    assert.deepEqual(esp.api, [{ method: 'POST', path: '/api/houses/H5/proposal', body: { shares: { EU: 60, RUI: 40 } } }]);
  });
});

/* Numa conta nova o guia punha os «Primeiros passos» por cima de tudo — e
   por cima do pedido por responder, que é a coisa mais urgente da vista geral.
   O cartão dos pedidos acaba numa marca, e o guia insere os passos a seguir a
   ela (cloud/guia.js), como já fazia a seguir ao «O que podes fazer». */
describe('os pedidos ficam à frente do guia', () => {
  test('o cartão dos pedidos acaba na marca que o guia procura', () => {
    const { app } = comEstado();
    app.CW.state.shareRequests.incoming = [{ id: 'R1', fromName: 'Ana', houseName: 'T2 Lisboa' }];
    const html = app.pedidosDashCard();
    assert.ok(html.endsWith('<!--fim-pedidos-->'), 'a marca fecha o cartão');
    assert.equal(app.pedidosDashCard.call(Object.assign({}, app)), html, 'controlo: é o mesmo HTML');
    app.CW.state.shareRequests.incoming = [];
    assert.equal(app.pedidosDashCard(), '', 'sem pedidos não há marca nenhuma');
  });

  test('o guia insere os passos depois dessa marca quando não há «O que podes fazer»', () => {
    const g = le('web/cloud/guia.js');
    const bloco = g.slice(g.indexOf('vDashboard = function'), g.indexOf('vDashboard = function') + 900);
    assert.ok(bloco.includes("'<!--fim-podes--></div>'"), 'primeiro o «O que podes fazer» de quem colabora');
    assert.ok(bloco.includes("fim = '<!--fim-pedidos-->'"), 'depois os pedidos por responder');
    assert.ok(bloco.indexOf("'<!--fim-podes--></div>'") < bloco.indexOf("fim = '<!--fim-pedidos-->'"), 'por esta ordem');
    assert.ok(bloco.includes('return passosHtml + html'), 'e sem nenhum dos dois, por cima');
  });
});

/* ------------------------------------------------ remover e aceitar uma ligação */

/* Em toda a página o nome é «ligação» (o ⋯ diz «Remover ligação»): a janela,
   o aceitar e o remover diziam «conexão», que é o do Brasil. E a janela de
   confirmação diz com números o que vai junto (contrato §4), sem «casa(s)». */
describe('remover e aceitar uma ligação', () => {
  test('a janela diz o nome e as casas que vão junto, e o botão é o «Remover» vermelho', async () => {
    const { app, esp } = comEstado((st) => { st.connections[0].myShares = ['H1', 'H5']; st.connections[0].peerShares = ['X1']; });
    app.CW.delConn('K1');
    const j = esp.abertas[0];
    assert.equal(j.t, 'Remover a ligação a Rui');
    assert.ok(j.b.includes('Deixas de partilhar 2 casas com Rui, e a casa que recebes deixa de aparecer. Os dados de cada um não são apagados.'), j.b);
    assert.match(j.f, /<button class="btn danger" data-click="_ok\(\)">Remover<\/button>/);
    app._ok();
    await espera();
    assert.deepEqual(esp.api.map((x) => x.method + ' ' + x.path), ['DELETE /api/connections/K1']);
    assert.deepEqual(esp.toasts, ['Ligação removida.']);
  });

  test('no singular, só num sentido, e sem casas nenhumas', () => {
    const frase = (mine, theirs) => {
      const { app } = comEstado((st) => { st.connections[0].myShares = mine; st.connections[0].peerShares = theirs; });
      return app.fraseRemoverLigacao(app.CW.state.connections[0]);
    };
    assert.equal(frase(['H1'], []), 'Deixas de partilhar 1 casa com Rui. Os dados de cada um não são apagados.');
    assert.equal(frase([], ['X1', 'X2', 'X3']), 'As 3 casas que recebes de Rui deixam de aparecer. Os dados de cada um não são apagados.');
    assert.equal(frase([], ['X1']), 'A casa que recebes de Rui deixa de aparecer. Os dados de cada um não são apagados.');
    assert.equal(frase([], []), 'Ainda não partilham casas um com o outro: sai só a ligação. Os dados de cada um não são apagados.');
    const { app } = comEstado((st) => { st.connections[0].peer.name = '<b>Zé</b>'; });
    assert.ok(app.fraseRemoverLigacao(app.CW.state.connections[0]).includes('&lt;b&gt;Zé&lt;/b&gt;'), 'o nome passa pelo esc');
  });

  test('um convite enviado sai sem perguntar; aceitar diz «Ligação aceite»', async () => {
    const { app, esp } = comEstado(CONVITE);
    app.CW.delConn('K2', 1);
    app.CW.acceptConn('K2');
    await espera();
    assert.equal(esp.abertas.length, 0, 'sem janela');
    assert.deepEqual(esp.toasts.slice().sort(), ['Convite removido.', 'Ligação aceite. Escolhe agora que casas queres partilhar.']);
    assert.ok(!/'[^'\n]*[Cc]onex(ão|ões)[^'\n]*'/.test(le('web/cloud/partilha.js')), 'nenhuma «conexão» nas frases');
  });

  /* O convite por responder salta à vista (o canvas M-Partilha): a linha leva
     a classe pt-convite, e a folha de estilos tem de a pintar — escrevia-se a
     classe e nenhuma regra a lia. */
  test('cada classe da linha de uma ligação tem regra na folha de estilos, a do convite incluída', () => {
    const { app } = comEstado(CONVITE);
    const linha = app.connCard(app.CW.state.connections[1]);
    assert.match(linha, /class="pt-linha pt-convite"/);
    const css = le('web/estilos.css');
    for (const c of new Set([...linha.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => /^pt-/.test(c)))) {
      assert.ok(new RegExp('\\.' + c + '\\b').test(css), 'a classe ' + c + ' não tem regra');
    }
    assert.match(css, /\.pt-linha\.pt-convite\{background:var\(--accent-soft\)\}/);
  });
});

/* ------------------------------------------------ a ligação só na lista de cima, e o «Remover ligação» na ficha */

/* A ligação ativa já está na lista dos Proprietários (pessoas.js:
   donosComPartilha): o cartão de baixo deixava-a aparecer outra vez. Fica
   com o que ainda não é ligação (os convites, nos dois sentidos), o campo
   para ligar, os pedidos e a ligação de partilha; e «Remover ligação» passa
   para o ⋯ do cabeçalho da ficha do outro. */
describe('a ligação ativa só na lista de cima, e o «Remover ligação» na ficha', () => {
  const ENVIADO = (st) => { st.connections.push({ id: 'K3', status: 'pending', incoming: false, peer: { id: 'LU', name: 'Lurdes' } }); };

  test('o cartão dos Proprietários não repete a ligação ativa e leva os convites pendentes, o recebido e o enviado', () => {
    const { app } = comEstado((st) => { CONVITE(st); ENVIADO(st); });
    const h = app.comproprietariosHtml();
    assert.ok(!h.includes("CW.sharesModal('K1')") && !h.includes('cw_conn_K1') && !h.includes("CW.delConn('K1')"), 'sem a ligação ativa com o Rui: ' + h);
    assert.ok(!/>Rui</.test(h) && !h.includes('id RUI'), 'o Rui não aparece no cartão');
    assert.match(h, /<div class="pt-linha pt-convite">[\s\S]*?Zé quer ligar-se a ti/, 'o convite recebido, com o fundo do convite');
    assert.match(h, /data-click="CW\.acceptConn\('K2'\)">Aceitar</);
    assert.match(h, /Lurdes[\s\S]*?À espera que aceite o convite\.[\s\S]*?data-click="CW\.delConn\('K3',1\)">Cancelar</, 'o enviado, com Cancelar');
    assert.ok(!h.includes('pt-vazio'), 'com convites não há vazio');
    // por esta ordem: os convites, o campo, e por baixo a ligação de partilha
    const iC = h.indexOf('Zé quer ligar-se'), iL = h.indexOf('id="cw_peer"'), iS = h.indexOf('A minha ligação de partilha');
    assert.ok(iC > -1 && iC < iL && iL < iS, [iC, iL, iS].join(', '));
    assert.ok(app.donosComPartilha().some((o) => o.id === 'RUI'), 'controlo: o Rui está na lista dos Proprietários');
  });

  test('o vazio do cartão: sem ligação nenhuma diz que ainda não há ligações; com ativas e sem convites não diz nada; antes do sync diz que ainda não chegaram', () => {
    const { app } = comEstado();
    const comAtiva = app.comproprietariosHtml();
    assert.ok(!comAtiva.includes('pt-vazio') && !comAtiva.includes('Ainda não tens ligações'), 'o Rui está ligado: o cartão começa no meu id');
    assert.match(comAtiva, /<div class="card pt-cartao"><div class="pt-linha pt-meu">[\s\S]*?<\/div><div class="pt-linha pt-ligar">/);
    const { app: sem } = comEstado((st) => { st.connections = []; });
    assert.match(sem.comproprietariosHtml(), /<div class="pt-linha pt-vazio"><span class="small">Ainda não tens ligações\.<\/span><\/div>/);
    // só um convite enviado: há uma linha, e o vazio não se diz
    const { app: so } = comEstado((st) => { st.connections = []; ENVIADO(st); });
    assert.ok(!so.comproprietariosHtml().includes('pt-vazio'));
    const { app: antes } = comEstado((st) => { st.connections = []; });
    antes.CW._pulled = 0;
    assert.match(antes.comproprietariosHtml(), /Ainda não recebemos as ligações deste aparelho/);
  });

  test('sem o separador dos Proprietários não há lista de cima: a Segurança leva a partilha, com as ativas no cartão, «Casas partilhadas» e o ⋯', () => {
    const { app } = comEstado(CONVITE);
    app.definirServicosDesligados(['owners']);
    const h = app.vCloud();
    assert.match(h, /data-toca="camada" data-click="CW\.sharesModal\('K1'\)">Casas partilhadas</);
    assert.ok(h.includes("CW.delConn('K1')") && h.includes('Remover ligação'), 'o ⋯ da linha fica');
    assert.ok(h.includes('Zé quer ligar-se a ti'), 'e o convite');
    assert.ok(h.includes('O id do outro utilizador'), 'e o campo');
    assert.ok(h.indexOf('O teu id') > -1 && h.indexOf('O teu id') < h.indexOf('O id do outro utilizador'), 'e o meu id, por cima do campo');
    assert.ok(h.indexOf('Apagar a conta') < h.indexOf('Partilhar com outras contas'), 'a segurança primeiro, a partilha numa secção à parte por baixo');
  });

  test('o campo diz «O id do outro utilizador», com o asterisco vermelho e o exemplo; a dica e a secção não dizem «dele»', () => {
    const { app } = comEstado();
    const h = app.comproprietariosHtml();
    assert.match(h, /<label class="u-fx-1 u-minw-0">O id do outro utilizador <span class="req">\*<\/span><input id="cw_peer"[^>]*placeholder="Ex: A7KQ2MPX"/);
    assert.ok(h.includes('<p class="small">Ligar a outro utilizador: escreve o id que o outro utilizador te deu. Depois de aceite, cada um escolhe que casas partilha.</p>'), h);
    assert.ok(!/\bdele\b|ele te deu/.test(h.replace(/<[^>]+>/g, ' ')), 'nenhum «dele» na secção');
    assert.ok(h.includes('Na ficha de cada um, em «Editar casas partilhadas»'), 'a frase de cima aponta para onde as casas se editam agora');
  });

  test('a ficha de outro proprietário ligado tem «Remover ligação» no ⋯ do cabeçalho, que chama o CW.delConn com o id da ligação e pergunta antes', async () => {
    const { app, esp } = comEstado();
    assert.deepEqual(JSON.parse(JSON.stringify(app.partilhaComDonoDaNuvem('RUI'))), { act: "CW.sharesModal('K1')", ligacao: 'K1' }, 'o gancho traz o id da ligação');
    app.personView('owner', 'RUI');
    const f = esp.abertas[esp.abertas.length - 1];
    assert.equal(f.t, 'Rui');
    assert.match(f.m, /aria-label="Opções"/, 'o ⋯ no cabeçalho, ao lado do X');
    assert.match(f.m, /<button type="button" class="danger" data-toca="camada" data-risco="destroi" data-click="closePops\(\);CW\.delConn\('K1'\)">[\s\S]*? Remover ligação<\/button>/);
    assert.ok(!f.m.includes('Apagar proprietário'), 'um proprietário com conta não se apaga');
    assert.match(f.f, /data-click="CW\.sharesModal\('K1'\)">Editar casas partilhadas</, 'o rodapé fica como estava');
    // o que o ⋯ corre: a confirmação de sempre, e o DELETE com o id certo
    app.CW.delConn('K1');
    const j = esp.abertas[esp.abertas.length - 1];
    assert.equal(j.t, 'Remover a ligação a Rui');
    assert.ok(j.b.includes(app.fraseRemoverLigacao(app.CW.state.connections[0])), j.b);
    app._ok();
    await espera();
    assert.deepEqual(esp.api.map((x) => x.method + ' ' + x.path), ['DELETE /api/connections/K1']);
    assert.equal(app.modalStack.length, 1, 'o Rui continua na lista (o servidor aqui não mudou nada): a ficha fica');
    // no meu perfil, e numa ficha de inquilino, não há
    app.personView('owner', 'EU');
    assert.ok(!esp.abertas[esp.abertas.length - 1].m.includes('Remover ligação'), 'no meu perfil não');
    assert.equal(app.removerLigacaoDaFicha('tenant', { id: 'RUI', _userId: 'RUI' }), null);
  });

  test('um convite por aceitar ainda não dá «Remover ligação» na ficha', () => {
    const { app } = comEstado((st) => { st.connections[0].status = 'pending'; st.connections[0].incoming = false; });
    const rui = app.db.owners.find((o) => o.id === 'RUI');
    assert.ok(rui, 'controlo: o Rui está na base pela casa em comum');
    assert.equal(app.removerLigacaoDaFicha('owner', rui), null);
  });

  test('removida a ligação, a ficha de quem saiu da lista fecha; a de outra pessoa fica', async () => {
    const { app, esp } = comEstado();
    // o servidor, depois do DELETE: sem a ligação, e a Minha deixa de ser partilhada com o Rui
    app.pullNow = () => {
      const st = app.CW.state;
      st.connections = [];
      st.houses[0].participants = ['EU'];
      app.db = app.rebuildDb(st);
      return Promise.resolve();
    };
    app.personView('owner', 'RUI');
    assert.equal(app.modalStack[app.modalStack.length - 1].ficha.dono, 'RUI', 'a ficha leva o id dele');
    app.CW.delConn('K1');
    app._ok();
    await espera();
    assert.deepEqual(esp.toasts, ['Ligação removida.']);
    assert.ok(!app.donosComPartilha().some((o) => o.id === 'RUI'), 'controlo: o Rui saiu da lista');
    assert.equal(app.modalStack.length, 0, 'a ficha do Rui fechou');
    // com a ficha de outra pessoa por cima, nada fecha
    const { app: b } = comEstado();
    b.modalStack.push({ ficha: { dono: 'ANA' } });
    b.fecharFichaDeQuemSaiu('RUI');
    assert.equal(b.modalStack.length, 1, 'a ficha da Ana fica');
  });
});
