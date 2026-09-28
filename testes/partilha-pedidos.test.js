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

  test('o cartão dos pedidos em Conta e partilha e o da ligação usam as mesmas linhas e botões', () => {
    const { app } = comEstado((st) => { PEDIDO(st); CONVITE(st); });
    const dash = app.pedidosDashCard(), conta = app.pedidosCard(), lig = app.connCard(app.CW.state.connections[1]);
    const linha = /<div class="card u-p-12px-13px"><b class="u-d-block">Ana quer partilhar T2 Porto contigo<\/b>[\s\S]*?<\/div><\/div>/;
    assert.equal(linha.exec(dash)[0], linha.exec(conta)[0], 'a linha do pedido é uma só');
    const botoes = /<button class="btn primary sm" data-toca="dados" data-click="CW\.acceptConn\('K2'\)">Aceitar<\/button><button[^>]*>Recusar<\/button>/;
    assert.equal(botoes.exec(dash)[0], botoes.exec(lig)[0], 'os botões do convite são os mesmos');
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

  test('a casa já partilhada vem marcada e sem quotas; a nova traz a caixa com o data-change e o lugar do bloco, vazio', () => {
    const { corpo } = abrir();
    assert.match(corpo, /id="cw_sh_H1" checked>/);
    assert.ok(!/cw_qb_H1|shareCasaMudou\('H1'\)/.test(corpo), 'a já partilhada não ganha quotas por aqui');
    assert.match(corpo, /id="cw_sh_H5" data-toca="rascunho" data-change="CW\.shareCasaMudou\('H5'\)">/);
    assert.match(corpo, /<div id="cw_qb_H5"><\/div>/);
    assert.ok(!corpo.includes('cw_q_H5_'), 'sem campos de quotas antes de marcar');
  });

  test('marcar a casa nova mostra um campo por comproprietário mais o par, em partes iguais, com a frase; desmarcar esconde', () => {
    const { app } = abrir();
    marcar(app, 'H5', true);
    const b = bloco(app, 'H5');
    assert.match(b, /<label>Eu \(tu\) \(%\)<input id="cw_q_H5_EU" type="text" inputmode="decimal" value="50"><\/label>/);
    assert.match(b, /<label>Rui \(%\)<input id="cw_q_H5_RUI" type="text" inputmode="decimal" value="50"><\/label>/);
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
    assert.match(b, /Ana \(%\)/);
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
    const { app, esp } = abrir();
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
