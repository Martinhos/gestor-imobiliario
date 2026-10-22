// O separador Grupos e partilhar um grupo que já existe. Os grupos são um
// separador da base (app/definicoes.js:vGrupos), uma aba das Casas: lá
// dentro os tipos num segmentado, «Novo grupo
// de …» e, com sessão e o serviço Colaboradores, «Novo grupo partilhado»;
// cada grupo é um cartão — os partilhados com a ligação, os pedidos e os
// membros, os pedidos que fiz à parte —, e cada grupo de imóveis privado tem
// sempre «Partilhar» à vista (o toque explica o que não dá). A janela de
// edição do grupo privado tem o botão no corpo. Os caminhos antigos
// (goSet('groups'), a página guardada) levam ao separador. As Definições e a
// página da conta já não têm porta para eles, e o separador tem o crachá dos
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
  test('sem a cabeça das subpáginas (é uma aba das Casas), o que os grupos são, os tipos num segmentado com quantos há de cada, e os grupos de imóveis em cartões, os partilhados uma vez só', () => {
    const { app } = comEstado();
    const h = app.vGrupos();
    assert.ok(!h.includes('def-voltar'), 'sem o Voltar às Definições');
    assert.ok(!h.includes('class="def-nav"'), 'nem a navegação lateral delas, no computador');
    assert.match(h, /^<p class="def-intro">Servem de filtro em toda a app\./, 'a vista começa no que os grupos são');
    assert.match(h, /<div class="segm def-abas" role="group" aria-label="Tipo de grupo"><button type="button" id="grpTipo_prop" class="on" aria-pressed="true" data-toca="vista" data-click="grupoTipoEscolher\('prop'\)">Imóveis <span class="n">4<\/span><\/button><button type="button" id="grpTipo_owner" class="" aria-pressed="false"[^>]*>Proprietários <span class="n">1<\/span><\/button><button type="button" id="grpTipo_contract"[^>]*>Contratos <span class="n">0<\/span><\/button><\/div>/);
    assert.equal((h.match(/CW\.grupoModal\('G1'\)/g) || []).length, 1, 'o grupo do Rui uma vez só');
    assert.equal((h.match(/CW\.grupoModal\('G2'\)/g) || []).length, 1, 'o meu uma vez só');
    assert.equal((h.match(/Novo grupo partilhado/g) || []).length, 1, '«Novo grupo partilhado» uma vez, no cimo');
    assert.match(h, /data-click="groupModal\('prop'\)">[\s\S]*?Novo grupo de imóveis</);
    assert.match(h, /<h3>Privado<\/h3><span class="badge grey">Privado<\/span>[\s\S]*?data-click="groupModal\('prop','GP'\)">/, 'os privados, com «Editar»');
    assert.ok(!h.includes('Família de donos'), 'os de proprietários estão no outro separador');
    assert.match(h, /À espera de Tó/, 'os pedidos que fiz');
    assert.match(h, /<b>Zé<\/b> quer entrar/, 'e os que esperam resposta nos meus');
    assert.ok(!/\son[a-z]+=|\sstyle=/.test(h), 'nada em linha');
  });

  test('o segmentado troca o tipo à vista: os proprietários, e os contratos com o vazio a convidar o primeiro', () => {
    const { app } = comEstado();
    app.grupoTipoEscolher('owner');
    let h = app.vGrupos();
    assert.match(h, /id="grpTipo_owner" class="on" aria-pressed="true"/);
    assert.match(h, /<h3>Família de donos<\/h3>/);
    assert.ok(!h.includes('Privado') && !h.includes('grupoPartilhar'), 'um grupo de proprietários não se partilha nem diz «Privado»');
    assert.ok(!h.includes('CW.grupoNovo()'), '«Novo grupo partilhado» é só dos imóveis');
    app.grupoTipoEscolher('contract');
    h = app.vGrupos();
    assert.match(h, /<div class="empty"><b>Ainda não há grupos de contratos<\/b>[\s\S]*?data-click="groupModal\('contract'\)">[\s\S]*?Novo grupo de contratos/);
    assert.equal((h.match(/Novo grupo de contratos/g) || []).length, 1, 'no vazio, o botão é o dele — não dois iguais');
    app.grupoTipoEscolher('xpto');
    assert.match(app.vGrupos(), /id="grpTipo_contract" class="on"/, 'um tipo que não existe não mexe');
  });

  test('cada grupo de imóveis privado tem «Partilhar» à vista — também o que só tem imóveis dos outros —, ao lado de «Editar»', () => {
    const { app } = comEstado();
    const h = app.vGrupos();
    const cartao = h.slice(h.indexOf('<h3>Privado</h3>'), h.indexOf('<h3>Só do Rui</h3>'));
    assert.match(cartao, /<button type="button" class="btn sm" data-toca="camada" data-click="CW\.grupoPartilhar\('GP'\)">[\s\S]*? Partilhar<\/button>/);
    assert.equal((h.match(/CW\.grupoPartilhar\(/g) || []).length, 2, 'o GP e o GR: nem os partilhados, nem o de proprietários');
    assert.ok(h.includes("CW.grupoPartilhar('GR')"), 'o GR só tem a Do Rui, e o botão fica: o toque é que explica');
    assert.ok(!h.includes("CW.grupoPartilhar('GO')"));
  });

  test('tocar «Partilhar» confirma, partilha com o mesmo id e o grupo passa a cartão de partilhado', async () => {
    const { app, esp } = comEstado();
    const url = 'https://teste.local/?grupo=' + 'b'.repeat(64);
    esp.resposta = (m, p) => (p.endsWith('/partilhar') ? { ok: true, url, expiresAt: 4102444800000 } : {});
    app.CW.grupoPartilhar('GP');
    await espera();
    assert.equal(esp.confirmados[0].t, 'Partilhar este grupo');
    assert.deepEqual(esp.chamadas(), ['POST /api/shared-groups/GP/partilhar'], 'um pedido só');
    const j = esp.abertas[esp.abertas.length - 1];
    assert.equal(j.t, 'Ligação do grupo');
    assert.ok(j.el.querySelector('.body').innerHTML.includes(url), 'a ligação aparece, na janela que abriu à espera');
    const h = app.vGrupos();
    assert.match(h, /<h3>Privado<\/h3><span class="badge">Partilhado · teu<\/span>/, 'o mesmo id, agora partilhado');
    assert.ok(h.includes("CW.grupoModal('GP')"));
    assert.ok(!h.includes("groupModal('prop','GP')"), 'e já não se edita como privado');
    assert.ok(!h.includes("CW.grupoPartilhar('GP')"), 'nem com «Partilhar»');
  });

  test('um grupo só com imóveis dos outros abre a janela que diz de quem são, sem ir ao servidor', async () => {
    const { app, esp } = comEstado();
    app.CW.grupoPartilhar('GR');
    await espera();
    assert.deepEqual(esp.api, [], 'nada vai ao servidor');
    assert.deepEqual(esp.confirmados, []);
    assert.equal(esp.abertas[0].t, 'Este imóvel não é teu');
    assert.match(esp.abertas[0].b, /<b>Do Rui<\/b> é de Rui\./);
    assert.equal(app.CW.grupoEscolherParaPartilhar, undefined, '«Partilhar um grupo que já tens» saiu: cada grupo tem o seu «Partilhar»');
  });

  test('sem sessão ou com os Colaboradores desligados, «Novo grupo partilhado» e os pedidos saem e cada grupo de imóveis privado fica com «Partilhar»; sem a nuvem, nada da nuvem', () => {
    const { app } = comEstado();
    const semPartilha = (h, porque) => {
      assert.ok(!/grupoNovo|grupoCancelarPedido/.test(h), porque);
      assert.match(h, /data-click="groupModal\('prop','GP'\)"/, porque + ': os privados ficam');
      assert.ok(h.includes("CW.grupoPartilhar('GP')") && h.includes("CW.grupoPartilhar('GR')"), porque + ': com o «Partilhar»');
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
    assert.ok(!h.includes('Partilhar um grupo é para sempre'), 'nem a nota do que é partilhar');
  });

  test('a janela de edição de um grupo de imóveis privado tem sempre «Partilhar este grupo» à vista (o sem imóveis meus e sem sessão também); um grupo novo e o de proprietários não', () => {
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
    assert.ok(esp.abertas[3].b.includes("CW.grupoPartilhar('GR')") && esp.abertas[3].m.includes("CW.grupoPartilhar('GR')"), 'só com imóveis dos outros: no corpo e no ⋯, e o toque explica');
    app.CW.user = null;
    app.groupModal('prop', 'GP');
    assert.ok(esp.abertas[4].b.includes("CW.grupoPartilhar('GP')"), 'sem sessão: o toque leva à entrada');
  });
});

describe('os caminhos antigos e as portas', () => {
  /* Em 2026-10 os Grupos saíram da barra lateral para as Definições, e a
     2026-10-22 saíram delas para uma aba das Casas: a raiz já não tem a
     linha, nem a navegação lateral do computador. */
  test('as Definições já não têm a porta dos Grupos', () => {
    const { app } = comEstado();
    app.tab = 'settings';
    app.setPage = '';
    const h = app.vSettings();
    assert.ok(!h.includes("goSet('groups')") && !h.includes("go('groups')"), 'sem a porta');
    assert.ok(!/<b class="u-d-block">Grupos<\/b>/.test(h), 'nem a linha');
    assert.match(h, /goSet\('cats'\)/, 'controlo: as outras linhas ficam');
    app.setPage = 'cats';
    const sub = app.vSettings();
    assert.match(sub, /<nav class="def-nav" aria-label="Definições">/, 'controlo: a navegação lateral está lá');
    assert.ok(!sub.includes('groups'), 'e não leva aos Grupos');
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

  test('a página da conta já não leva aos Grupos', () => {
    const { app } = comEstado();
    assert.ok(!app.vCloud().includes("go('groups')"), 'sem a porta');
    assert.ok(!app.vCloud().includes('Grupos partilhados'), 'nem a linha «Grupos partilhados»');
    assert.equal(app.linhaDosGrupos, undefined, 'e a linha saiu da nuvem: não tinha onde viver');
  });

  /* Desde 2026-10-22 os Grupos são uma aba das Casas: o caminho que os
     textos ensinam é «Casas → Grupos», pelo grupo da gaveta, e o cartão
     «Grupos partilhados» já não existe para ser citado. */
  test('os textos levam a «Casas → Grupos», e nenhum cita o cartão «Grupos partilhados», que saiu', () => {
    for (const f of ['web/cloud/grupos.js', 'web/app/definicoes.js']) {
      assert.ok(!/cartão «Grupos partilhados»/.test(le(f)), f);
      assert.ok(!/Definições → Grupos/.test(le(f)), f + ': o caminho antigo');
    }
    const { app, esp } = comEstado();
    app.desfechoDoGrupo({ pedido: true, name: 'Casas de Faro', ownerName: 'Tó' }, {});
    assert.match(esp.abertas[0].b, /podes cancelá-lo, em Casas → Grupos\./);
    app.desfechoDoGrupo({ jaEstava: true, name: 'Casas do Porto', ownerName: 'Rui', houses: [] }, {});
    assert.match(esp.abertas[1].b, /sair quando quiseres, em Casas → Grupos\./);
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
    const linhas = src.filter((l) => /(^|[^\w$.'"])(cartaoDoGrupoPartilhado|pedidosQueFizHtml|crachaDosGrupos)\s*\(/.test(l));
    // os cartões dos partilhados e os pedidos que fiz (vGroups, vGrupos)
    assert.ok(linhas.length >= 2, 'controlo: a base usa-as ' + linhas.length + ' vezes');
    for (const l of linhas) assert.match(l, /typeof (cartaoDoGrupoPartilhado|pedidosQueFizHtml)==='function'/, l.trim());
  });
});
