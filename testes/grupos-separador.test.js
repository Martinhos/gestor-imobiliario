// O separador Grupos e partilhar um grupo que já existe. Os grupos saíram
// das Definições para um separador da base (app/definicoes.js:vGrupos): em
// cima, com sessão e o serviço Colaboradores, o cartão «Grupos partilhados»
// com «Novo grupo partilhado» e «Partilhar um grupo que já tens»; em baixo,
// os grupos por tipo, e cada grupo de imóveis privado com imóveis meus tem
// «Partilhar» à vista. A janela de edição do grupo privado tem o botão no
// corpo. As Definições perdem a linha «Grupos», e os caminhos antigos
// (goSet('groups'), a página guardada) levam ao separador. Conta e partilha
// fica com uma linha que leva aos Grupos, e o separador tem o crachá dos
// pedidos por responder, que é do serviço Colaboradores. Como o
// grupos-cloud.test.js: a nuvem por cima da app do arnês, com a api, o
// pullNow, o toast, as confirmações e as janelas trocados por espiões.

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
const cru = (x) => JSON.parse(JSON.stringify(x));

/* A app com a nuvem por cima e os espiões: esp.api as chamadas (esp.resposta
   decide o que devolvem), esp.toasts, esp.confirmados (aceites na hora), as
   janelas numa pilha observável (esp.abertas) e esp.puxou as leituras.
   Devolve: {app, esp}. */
function montar() {
  const nova = carregarApp({ antes: (janela) => { janela.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }; } });
  nova.document.documentElement.style.removeProperty = () => {};
  const ctx = nova.__ctx;
  const carregar = (nome) => vm.runInContext(le('web/cloud/' + nome + '.js'), ctx, { filename: 'cloud/' + nome + '.js' });
  const esp = { api: [], toasts: [], confirmados: [], resposta: null, puxou: 0 };
  carregar('nucleo');
  nova.api = (method, p, body) => {
    esp.api.push({ method, path: p, body: body === undefined ? undefined : cru(body) });
    const r = esp.resposta ? esp.resposta(method, p, body) : {};
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  for (const nome of ['utilizadores', 'partilha', 'colaboradores', 'grupos', 'ajuda', 'entrada']) carregar(nome);
  nova.toast = (m) => { esp.toasts.push(m); };
  esp.abertas = janelasFalsas(nova, 'render', 'setSyncBadge', 'subirPendentes', 'save', 'scheduleReminders', 'buildNav', 'schedulePush');
  nova.confirmModal = (t, txt, cb) => { esp.confirmados.push({ t, txt }); cb(); };
  nova.pullNow = () => { esp.puxou++; return Promise.resolve(); };
  nova.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
  nova.CW._pulled = 1; nova.CW._esperaFim = 1;
  esp.chamadas = () => esp.api.map((x) => x.method + ' ' + x.path);
  return { app: nova, esp };
}

/* O estado: a Minha (H1) e a Terceira (H3) são minhas, a Do Rui (H2) é dele;
   o grupo G1 do Rui (não é meu), o G2 «Família» meu, com dois pedidos para
   entrar (o Zé nas duas listas do servidor, a Lurdes só na do grupo); o
   grupo privado GP com a Terceira e a Do Rui, e o grupo privado GR só com a
   Do Rui (nenhum imóvel meu). */
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'RUI'], updatedAt: 1, data: { id: 'H1', name: 'Minha' } },
    { id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1, data: { id: 'H2', name: 'Do Rui' } },
    { id: 'H3', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'ANA'], updatedAt: 1, data: { id: 'H3', name: 'Terceira' } },
  ],
  records: [],
  userRecords: [
    { kind: 'group', id: 'GP', updatedAt: 1, data: { id: 'GP', kind: 'prop', name: 'Privado', ids: ['H3', 'H2'] } },
    { kind: 'group', id: 'GR', updatedAt: 1, data: { id: 'GR', kind: 'prop', name: 'Só do Rui', ids: ['H2'] } },
    { kind: 'group', id: 'GO', updatedAt: 1, data: { id: 'GO', kind: 'owner', name: 'Família de donos', ids: ['EU'] } },
  ],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }, { userId: 'ANA', name: 'Ana', data: null }],
  connections: [], roles: [], collaborators: [], invites: [], people: [],
  shareLink: null, shareRequests: { incoming: [], outgoing: [] },
  sharedGroupRequests: {
    incoming: [{ groupId: 'G2', groupName: 'Família', userId: 'ZE', name: 'Zé', createdAt: 1767225600000 }],
    outgoing: [{ groupId: 'G7', groupName: 'Casas de Faro', ownerName: 'Tó', createdAt: 1767225600000 }],
  },
  sharedGroups: [
    { id: 'G1', name: 'Casas do Porto', ownerId: 'RUI', ownerName: 'Rui', mine: false,
      members: [{ id: 'RUI', name: 'Rui' }, { id: 'EU', name: 'Eu' }],
      houses: [{ id: 'H2', name: 'Do Rui', ownerId: 'RUI' }, { id: 'H1', name: 'Minha', ownerId: 'EU' }], link: null, pedidos: [] },
    { id: 'G2', name: 'Família', ownerId: 'EU', ownerName: 'Eu', mine: true,
      members: [{ id: 'EU', name: 'Eu' }, { id: 'ANA', name: 'Ana' }],
      houses: [{ id: 'H3', name: 'Terceira', ownerId: 'EU' }], link: { ativo: true, expiresAt: 4102444800000, uses: 3 },
      pedidos: [{ userId: 'LU', name: 'Lurdes', createdAt: 1767312000000 }, { userId: 'ZE', name: 'Zé', createdAt: 1767225600000 }] },
  ],
});

// A app montada com o estado na base e em CW.state.
// Devolve: {app, esp}.
function comEstado() {
  const { app, esp } = montar();
  const st = ESTADO();
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  esp.api.length = 0;
  return { app, esp };
}

describe('o separador Grupos', () => {
  test('com sessão e os Colaboradores: o cartão dos partilhados em cima, os grupos por tipo em baixo, e os partilhados não se repetem', () => {
    const { app } = comEstado();
    const h = app.vGrupos();
    const iCartao = h.indexOf('<div class="title">Grupos partilhados</div>'), iImoveis = h.indexOf('<div class="section-title">Imóveis</div>');
    assert.ok(iCartao > -1 && iImoveis > iCartao, 'os partilhados em cima: ' + [iCartao, iImoveis].join(', '));
    assert.equal((h.match(/CW\.grupoModal\('G1'\)/g) || []).length, 1, 'o grupo do Rui uma vez só');
    assert.equal((h.match(/CW\.grupoModal\('G2'\)/g) || []).length, 1, 'o meu uma vez só');
    assert.equal((h.match(/Novo grupo partilhado/g) || []).length, 1, '«Novo grupo partilhado» só no cartão');
    assert.match(h, /data-click="groupModal\('prop','GP'\)">[\s\S]*?<div class="title">Privado<\/div>/, 'os privados em baixo');
    assert.match(h, /<div class="section-title">Proprietários<\/div>[\s\S]*?Família de donos/);
    assert.match(h, /Casas de Faro · à espera de Tó/, 'os pedidos que fiz, como no cartão');
    assert.match(h, /<b>2 pedidos por responder<\/b>/, 'e os que esperam resposta nos meus');
    assert.ok(!/on[a-z]+=|style=/.test(h), 'nada em linha');
  });

  test('cada grupo de imóveis privado com imóveis meus tem «Partilhar» à vista, que trava o toque e não abre a janela de edição', () => {
    const { app } = comEstado();
    const h = app.vGrupos();
    const cartao = h.slice(h.indexOf("groupModal('prop','GP')"), h.indexOf("groupModal('prop','GR')"));
    assert.match(cartao, /<button type="button" class="btn sm u-fx-0-0-auto" data-toca="camada" data-click="event\.stopPropagation\(\);CW\.grupoPartilhar\('GP'\)">[\s\S]*? Partilhar<\/button>/);
    assert.equal((h.match(/CW\.grupoPartilhar\(/g) || []).length, 1, 'só o GP: nem os partilhados, nem o grupo só com imóveis dos outros, nem o de proprietários');
    assert.ok(!h.includes("CW.grupoPartilhar('GR')"), 'o GR só tem a Do Rui — partilhá-lo dava um grupo vazio');
    assert.ok(!h.includes("CW.grupoPartilhar('GO')"));
  });

  test('tocar «Partilhar» confirma, partilha com o mesmo id e o grupo passa à secção dos partilhados', async () => {
    const { app, esp } = comEstado();
    const url = 'https://teste.local/?grupo=' + 'b'.repeat(64);
    esp.resposta = (m, p) => (p.endsWith('/link') ? { url, expiresAt: 4102444800000 } : {});
    app.CW.grupoPartilhar('GP');
    await espera();
    assert.equal(esp.confirmados[0].t, 'Partilhar este grupo');
    assert.deepEqual(esp.chamadas(), ['PUT /api/shared-groups/GP', 'PUT /api/shared-groups/GP/houses', 'POST /api/shared-groups/GP/link']);
    assert.equal(esp.abertas[esp.abertas.length - 1].t, 'Ligação do grupo');
    assert.ok(esp.abertas[esp.abertas.length - 1].b.includes(url), 'a ligação aparece');
    const h = app.vGrupos();
    const iImoveis = h.indexOf('<div class="section-title">Imóveis</div>');
    const iGP = h.indexOf("CW.grupoModal('GP')");
    assert.ok(iGP > -1 && iGP < iImoveis, 'o mesmo id, agora em cima, nos partilhados');
    assert.ok(!h.includes("groupModal('prop','GP')"), 'e já não na lista dos privados');
    assert.ok(!h.includes("CW.grupoPartilhar('GP')"), 'nem com «Partilhar»');
  });

  test('«Partilhar um grupo que já tens» lista só os privados com imóveis meus e segue para a confirmação', async () => {
    const { app, esp } = comEstado();
    assert.match(app.gruposCard(), /data-toca="camada" data-click="CW\.grupoEscolherParaPartilhar\(\)">[\s\S]*? Partilhar um grupo que já tens</);
    app.CW.grupoEscolherParaPartilhar();
    const j = esp.abertas[0];
    assert.equal(j.t, 'Partilhar um grupo que já tens');
    assert.match(j.b, /<b class="u-d-block u-fs-14px">Privado<\/b>/);
    assert.match(j.b, /1 imóvel teu · 1 de outra pessoa fica de fora/);
    assert.ok(!j.b.includes('Só do Rui') && !j.b.includes('Família'), 'nem o grupo sem imóveis meus nem os partilhados');
    app._pick(0);
    await espera();
    assert.equal(esp.confirmados[0].t, 'Partilhar este grupo', 'escolher leva à mesma confirmação');
    assert.equal(esp.chamadas()[0], 'PUT /api/shared-groups/GP');
  });

  test('sem grupos privados para partilhar, «Partilhar um grupo que já tens» não aparece; e um grupo sem imóveis meus não se partilha', async () => {
    const { app, esp } = comEstado();
    app.db.groups = app.db.groups.filter((g) => g.id !== 'GP');
    assert.ok(!app.gruposCard().includes('grupoEscolherParaPartilhar'));
    assert.ok(app.gruposCard().includes('CW.grupoNovo()'), '«Novo grupo partilhado» fica');
    app.CW.grupoEscolherParaPartilhar();
    assert.match(esp.toasts[0], /Não tens grupos de imóveis teus por partilhar/);
    app.CW.grupoPartilhar('GR');
    await espera();
    assert.deepEqual(esp.api, [], 'nada vai ao servidor');
    assert.deepEqual(esp.confirmados, []);
    assert.match(esp.toasts[1], /Este grupo não tem imóveis teus/);
  });

  test('sem sessão, com os Colaboradores desligados ou sem a nuvem, o separador mostra só os grupos privados e nenhum botão de partilha', () => {
    const { app } = comEstado();
    const semPartilha = (h, porque) => {
      assert.ok(!/grupoPartilhar|grupoNovo|grupoEscolherParaPartilhar|Grupos partilhados/.test(h), porque);
      assert.match(h, /data-click="groupModal\('prop','GP'\)"/, porque + ': os privados ficam');
    };
    app.definirServicosDesligados(['colaboradores']);
    semPartilha(app.vGrupos(), 'serviço desligado');
    app.definirServicosDesligados([]);
    app.CW.user = null;
    semPartilha(app.vGrupos(), 'sem sessão');
    const base = carregarApp();
    base.db.properties.push(base.normProp({ id: 'P1', name: 'Casa' }));
    base.db.groups.push(base.normGroup({ id: 'B1', kind: 'prop', name: 'Lisboa', ids: ['P1'] }));
    const h = base.vGrupos();
    assert.match(h, /data-click="groupModal\('prop','B1'\)"/);
    assert.ok(!h.includes('CW.'), 'sem a nuvem, nada da nuvem');
  });

  test('a janela de edição de um grupo privado com imóveis meus tem «Partilhar este grupo» à vista; um grupo novo, o de proprietários e o sem imóveis meus não', () => {
    const { app, esp } = comEstado();
    app.groupModal('prop', 'GP');
    assert.match(esp.abertas[0].b, /<button type="button" class="btn sm" data-toca="camada" data-click="CW\.grupoPartilhar\('GP'\)">[\s\S]*? Partilhar este grupo<\/button>/);
    assert.match(esp.abertas[0].b, /Partilha-se o grupo como está guardado\./);
    assert.match(esp.abertas[0].m, /Partilhar este grupo…/, 'o do ⋯ fica');
    app.groupModal('prop');
    assert.ok(!esp.abertas[1].b.includes('grupoPartilhar'), 'um grupo novo ainda não existe');
    app.groupModal('owner', 'GO');
    assert.ok(!esp.abertas[2].b.includes('grupoPartilhar'));
    app.groupModal('prop', 'GR');
    assert.ok(!(esp.abertas[3].b + esp.abertas[3].m).includes('grupoPartilhar'), 'só com imóveis dos outros, nem no corpo nem no ⋯');
    app.CW.user = null;
    app.groupModal('prop', 'GP');
    assert.ok(!esp.abertas[4].b.includes('grupoPartilhar'), 'sem sessão');
  });
});

describe('os caminhos antigos e as portas', () => {
  test('as Definições já não têm a linha «Grupos»', () => {
    const { app } = comEstado();
    app.setPage = '';
    const h = app.vSettings();
    assert.ok(!h.includes("goSet('groups')"), 'sem a porta');
    assert.ok(!/<b class="u-d-block">Grupos<\/b>/.test(h), 'sem o rótulo');
    assert.match(h, /goSet\('tags'\)/, 'controlo: as outras linhas de Dados ficam');
  });

  test('goSet(\'groups\') vai para o separador Grupos, e as outras subpáginas continuam nas Definições', () => {
    const { app } = comEstado();
    app.tab = 'settings';
    app.goSet('groups');
    assert.equal(app.tab, 'groups');
    assert.equal(app.setPage, '');
    assert.deepEqual(JSON.parse(app.localStorage.getItem('gi_page')), { tab: 'groups', set: '' }, 'e é lembrado como separador');
    app.go('settings');
    app.goSet('tags');
    assert.equal(app.tab, 'settings');
    assert.equal(app.setPage, 'tags');
  });

  test('a página guardada antiga {tab:\'settings\', set:\'groups\'} abre o separador Grupos', () => {
    const { app } = comEstado();
    app.localStorage.setItem('gi_page', JSON.stringify({ tab: 'settings', set: 'groups' }));
    app.restorePage();
    assert.equal(app.tab, 'groups');
    assert.equal(app.setPage, '');
    // controlo: outra subpágina guardada continua a abrir nas Definições
    app.localStorage.setItem('gi_page', JSON.stringify({ tab: 'settings', set: 'filtros' }));
    app.restorePage();
    assert.equal(app.tab, 'settings');
    assert.equal(app.setPage, 'filtros');
  });

  test('Conta e partilha tem uma linha que leva aos Grupos, com quantos grupos partilhados e quantos pedidos por responder', () => {
    const { app } = comEstado();
    const c = app.vCloud();
    assert.match(c, /<div class="card tap u-d-flex u-ai-center u-g-13px" data-toca="ecra" data-click="go\('groups'\)">[\s\S]*?<b class="u-d-block">Grupos partilhados<\/b><span class="small">2 grupos partilhados · 2 pedidos por responder<\/span>/);
    assert.ok(!c.includes('CW.grupoNovo()'), 'o cartão saiu de lá');
    app.definirServicosDesligados(['colaboradores']);
    assert.ok(!app.vCloud().includes("go('groups')"), 'com o serviço desligado, sem a porta');
  });

  test('os textos levam a «Grupos», e não a «Definições → Grupos»', () => {
    for (const f of ['web/cloud/grupos.js', 'web/cloud/entrada.js', 'web/app/definicoes.js', 'web/cloud/partilha.js']) {
      assert.ok(!/Definições (→|›) Grupos/.test(le(f)), f);
    }
    const { app, esp } = comEstado();
    app.desfechoDoGrupo({ pedido: true, name: 'Casas de Faro', ownerName: 'Tó' }, {});
    assert.match(esp.abertas[0].b, /podes cancelá-lo, em Grupos, no cartão «Grupos partilhados»\./);
    app.desfechoDoGrupo({ jaEstava: true, name: 'Casas do Porto', ownerName: 'Rui', houses: [] }, {});
    assert.match(esp.abertas[1].b, /sair quando quiseres, em Grupos\./);
  });
});

describe('o crachá do separador', () => {
  test('conta os pedidos por responder nos meus grupos, o mesmo número das linhas do cartão; registado pelo serviço Colaboradores', () => {
    const { app } = comEstado();
    assert.deepEqual(cru(app.crachaDe('groups')), { n: 2 });
    assert.equal(app.REGISTO.cracha.groups.servico, 'colaboradores');
    // um pedido respondido sai da conta
    app.pedidoDeGrupoResolvido('G2', 'ZE');
    assert.deepEqual(cru(app.crachaDe('groups')), { n: 1 });
    // sem sessão, zero; com o serviço desligado, nada
    app.CW.user = null;
    assert.deepEqual(cru(app.crachaDe('groups')), { n: 0 });
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
    app.definirServicosDesligados(['colaboradores']);
    assert.equal(app.crachaDe('groups'), null);
  });

  test('sem a nuvem não há crachá, e a gaveta pinta-o quando há pedidos', () => {
    const base = carregarApp();
    assert.equal(base.crachaDe('groups'), null, 'a função é da nuvem: sem ela, nada');
    const { app } = comEstado();
    assert.equal(app.crachaHtml('groups', 'gaveta').replace(/ novo/, ''), '<span class="cnt">2</span>');
    assert.equal(app.crachaHtml('groups', 'barra'), '<span class="cnt">2</span>', 'sem `so`, vale nos dois sítios — e os Grupos não estão na barra de baixo');
  });

  test('a base só chama a nuvem dos grupos com guarda na mesma linha', () => {
    const src = le('web/app/definicoes.js').split('\n');
    const linhas = src.filter((l) => /(^|[^\w$.'"])(gruposCard|gruposParaPartilhar|crachaDosGrupos|linhaDosGrupos)\s*\(/.test(l));
    assert.ok(linhas.length >= 3, 'controlo: a base usa-as ' + linhas.length + ' vezes');
    for (const l of linhas) assert.match(l, /typeof (gruposCard|gruposParaPartilhar)==='function'/, l.trim());
    const partilha = le('web/cloud/partilha.js');
    assert.match(partilha, /typeof linhaDosGrupos === 'function' \? linhaDosGrupos\(\)/);
  });
});
