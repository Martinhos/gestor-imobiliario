// O cliente dos grupos partilhados (cloud/grupos.js e o que lhe toca em
// nucleo, entrada, partilha, acessos e definicoes): os grupos do estado
// entram em db.groups marcados _partilhado e não sobem; ?grupo=<token>
// aterra num modal e «Pedir para entrar» deixa um pedido que o dono aceita
// ou recusa (na janela do grupo), e que quem pediu vê e cancela no cartão
// «Grupos partilhados»; um grupo privado partilha-se,
// cria-se um novo, gere-se na sua janela e aparece no cartão «Grupos
// partilhados» e com o selo no separador Grupos. Como o
// partilha-pedidos.test.js: a nuvem por cima da app do arnês, com api,
// pullNow, toast, as confirmações, os prompts e as janelas trocados por
// espiões — o servidor destas rotas prova-se em grupos-partilhados.test.js.

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
const TOKEN = 'a'.repeat(64);
const cru = (x) => JSON.parse(JSON.stringify(x));

// Um sessionStorage/localStorage de faz-de-conta (o arnês não dá sessionStorage).
// Devolve: {getItem, setItem, removeItem}.
function armazem() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

/* A app com a nuvem por cima e os espiões: esp.api regista cada chamada (e
   esp.resposta decide o que ela devolve), esp.toasts as mensagens,
   esp.confirmados as confirmações (aceites na hora), esp.prompts os prompts
   (respondidos com esp.nomeDoPrompt), as janelas abrem numa pilha observável
   (esp.abertas), e o pullNow corre esp.aoPuxar — a forma de fingir o estado
   que a leitura traria. O espião da api entra ANTES do entrada.js, porque a
   aterragem de ?grupo= pede a pré-visualização ao carregar.
   Recebe: o (opcional) — {search: o location.search com que a app arranca;
   resposta: a função da api desde o arranque}.
   Devolve: {app, esp}. */
function montar(o) {
  o = o || {};
  const app = carregarApp({ antes: (janela) => {
    if (o.search) janela.location.search = o.search;
    janela.sessionStorage = armazem();
  } });
  app.document.documentElement.style.removeProperty = () => {};
  const ctx = app.__ctx;
  const carregar = (nome) => vm.runInContext(le('web/cloud/' + nome + '.js'), ctx, { filename: 'cloud/' + nome + '.js' });
  const esp = { api: [], toasts: [], confirmados: [], prompts: [], nomeDoPrompt: '', resposta: o.resposta || null, aoPuxar: null, puxou: 0 };
  carregar('nucleo');
  app.api = (method, p, body) => {
    esp.api.push({ method, path: p, body: body === undefined ? undefined : cru(body) });
    const r = esp.resposta ? esp.resposta(method, p, body) : {};
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  // o ajuda.js entra pelo lockScroll, que o ecrã de entrada chama ao carregar
  for (const nome of ['utilizadores', 'partilha', 'colaboradores', 'grupos', 'ajuda', 'entrada']) carregar(nome);
  app.toast = (m) => { esp.toasts.push(m); };
  esp.abertas = janelasFalsas(app, 'render', 'setSyncBadge', 'subirPendentes', 'save', 'scheduleReminders', 'buildNav', 'schedulePush');
  app.confirmModal = (t, txt, cb) => { esp.confirmados.push({ t, txt }); cb(); };
  app.promptModal = (t, l, v, cb) => { esp.prompts.push({ t, l, v }); if (esp.nomeDoPrompt) cb(esp.nomeDoPrompt); };
  app.pullNow = () => { esp.puxou++; if (esp.aoPuxar) esp.aoPuxar(); return Promise.resolve(); };
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
  app.CW._pulled = 1; app.CW._esperaFim = 1;
  esp.chamadas = () => esp.api.map((x) => x.method + ' ' + x.path);
  return { app, esp };
}

/* O estado do servidor: a Minha (H1, minha, posta por mim no grupo do Rui),
   Do Rui (H2, dele, no grupo dele), a Terceira (H3, minha, no meu grupo);
   o grupo G1 «Casas do Porto» do Rui, com o Rui, eu e a Ana, sem ligação
   (não é meu); o grupo G2 «Família», meu, com a Ana e a ligação ativa; um
   grupo privado GP com a Terceira e a Do Rui (a que não é minha). */
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'RUI', 'ANA'], updatedAt: 1, data: { id: 'H1', name: 'Minha', address: 'Rua A' } },
    { id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU', 'ANA'], updatedAt: 1, data: { id: 'H2', name: 'Do Rui' } },
    { id: 'H3', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'ANA'], updatedAt: 1, data: { id: 'H3', name: 'Terceira', address: 'Rua C' } },
  ],
  records: [],
  userRecords: [{ kind: 'group', id: 'GP', updatedAt: 1, data: { id: 'GP', kind: 'prop', name: 'Privado', ids: ['H3', 'H2'] } }],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }, { userId: 'ANA', name: 'Ana', data: null }],
  connections: [], roles: [], collaborators: [], invites: [], people: [],
  shareLink: null, shareRequests: { incoming: [], outgoing: [] },
  sharedGroups: [
    { id: 'G1', name: 'Casas do Porto', ownerId: 'RUI', ownerName: 'Rui', mine: false,
      members: [{ id: 'RUI', name: 'Rui' }, { id: 'EU', name: 'Eu' }, { id: 'ANA', name: 'Ana' }],
      houses: [{ id: 'H2', name: 'Do Rui', ownerId: 'RUI' }, { id: 'H1', name: 'Minha', ownerId: 'EU' }], link: null },
    { id: 'G2', name: 'Família', ownerId: 'EU', ownerName: 'Eu', mine: true,
      members: [{ id: 'EU', name: 'Eu' }, { id: 'ANA', name: 'Ana' }],
      houses: [{ id: 'H3', name: 'Terceira', ownerId: 'EU' }], link: { ativo: true, expiresAt: 4102444800000, uses: 3 } },
  ],
});

// O estado com o grupo G2 também como u:group (o grupo privado que se
// partilhou, ainda por apagar no servidor) e um movimento atribuído a ele.
const TRANSICAO = () => {
  const st = ESTADO();
  st.userRecords.push({ kind: 'group', id: 'G2', updatedAt: 1, data: { id: 'G2', kind: 'prop', name: 'Família (antigo)', ids: ['H3', 'H2'] } });
  st.userRecords.push({ kind: 'tx', id: 'T1', updatedAt: 1, data: { id: 'T1', kind: 'expense', label: 'Seguro', amount: 10, date: '2026-01-01', groupId: 'G2' } });
  return st;
};

// A app montada com o estado na base e em CW.state.
// Recebe: st (opcional) — o estado (ESTADO() por omissão).
// Devolve: {app, esp}.
function comEstado(st) {
  const { app, esp } = montar();
  st = st || ESTADO();
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  esp.api.length = 0;
  return { app, esp };
}

/* ------------------------------------------------ o estado e a base */

describe('os grupos partilhados no estado e na base', () => {
  test('estadoVazio tem sharedGroups, e applyState força a lista quando o servidor não a manda', () => {
    const { app } = montar();
    assert.deepEqual(cru(app.estadoVazio().sharedGroups), []);
    const st = ESTADO();
    delete st.sharedGroups;
    app.localStorage.setItem('gi_cloud_owner', 'EU');
    app.applyState(st, 'etag1', 'r1');
    assert.deepEqual(cru(app.CW.state.sharedGroups), [], 'a lista tem forma, venha ou não');
    assert.ok(!app.db.groups.some((g) => g._partilhado), 'e sem grupos partilhados na base');
  });

  test('rebuildDb mete cada grupo partilhado em db.groups como grupo de imóveis, com os ids das casas e as marcas', () => {
    const { app } = comEstado();
    const g1 = app.db.groups.find((g) => g.id === 'G1'), g2 = app.db.groups.find((g) => g.id === 'G2');
    assert.equal(g1.kind, 'prop');
    assert.deepEqual(cru(g1.ids), ['H2', 'H1']);
    assert.equal(g1.name, 'Casas do Porto');
    assert.equal(g1._partilhado, true);
    assert.equal(g1._dono, 'RUI');
    assert.equal(g1._donoNome, 'Rui');
    assert.equal(g1._meu, false);
    assert.deepEqual(cru(g1._membros), [{ id: 'RUI', name: 'Rui' }, { id: 'EU', name: 'Eu' }, { id: 'ANA', name: 'Ana' }]);
    assert.equal(g1._ligacao, null);
    assert.equal(g2._meu, true);
    assert.deepEqual(cru(g2._ligacao), { ativo: true, expiresAt: 4102444800000, uses: 3 });
    assert.equal(app.db.groups.find((g) => g.id === 'GP')._partilhado, undefined, 'o privado fica como era');
  });

  test('um u:group local com o mesmo id cede ao partilhado, e o id fica — os movimentos com groupId continuam a apontar para ele', () => {
    const { app } = comEstado(TRANSICAO());
    const g2s = app.db.groups.filter((g) => g.id === 'G2');
    assert.equal(g2s.length, 1, 'um só grupo com o id');
    assert.equal(g2s[0]._partilhado, true);
    assert.equal(g2s[0].name, 'Família', 'a versão do servidor, não a antiga');
    assert.deepEqual(cru(g2s[0].ids), ['H3']);
    assert.equal(app.db.transactions.find((t) => t.id === 'T1').groupId, 'G2');
    assert.equal(app.grp('G2')._meu, true, 'e o grp() da base encontra-o');
  });

  test('exportEntities não exporta um grupo _partilhado e exporta os privados como antes', () => {
    const { app } = comEstado();
    const chaves = Object.keys(cru(app.exportEntities()));
    assert.ok(chaves.includes('u:group:GP'), 'o privado sobe');
    assert.ok(!chaves.includes('u:group:G1') && !chaves.includes('u:group:G2'), 'os partilhados não: ' + chaves.filter((k) => k.startsWith('u:group')).join(', '));
    assert.ok(!('_partilhado' in cru(app.exportEntities()['u:group:GP'].data)), 'e sem marcas');
  });

  test('a transição: o u:group antigo fica obsoleto no retrato, o envio seguinte manda o del, e o grupo partilhado fica na base', async () => {
    const { app, esp } = montar();
    app.localStorage.setItem('gi_cloud_owner', 'EU');
    app.applyState(TRANSICAO(), 'etag1', 'r1');
    assert.equal(app.snap['u:group:G2'], '__obsoleto__', 'a chave antiga de uma entidade que passou a viver noutra');
    assert.equal(app.snap['u:group:GP'] && app.snap['u:group:GP'] !== '__obsoleto__', true, 'o privado continua vivo no retrato');
    assert.equal(app.db.groups.filter((g) => g.id === 'G2').length, 1);
    assert.equal(app.db.groups.find((g) => g.id === 'G2')._partilhado, true);
    esp.resposta = (m, p, body) => ({ results: body.ops.map(() => ({ ok: true })) });
    await app.pushNow();
    const sync = esp.api.find((x) => x.path === '/api/sync');
    assert.ok(sync, 'houve envio');
    assert.ok(sync.body.ops.some((o) => o.op === 'del' && o.scope === 'user' && o.kind === 'group' && o.id === 'G2'), 'o del do u:group antigo: ' + JSON.stringify(sync.body.ops));
    assert.ok(!sync.body.ops.some((o) => o.op === 'put' && o.kind === 'group' && o.id === 'G2'), 'e nenhum put dele');
    assert.ok(!('u:group:G2' in app.snap), 'depois do del, sai do retrato');
  });

  test('depois de partilhar aqui, o estado seguinte não tira o grupo da base: a chave antiga não conta como remoção local', () => {
    const { app } = comEstado();
    // como fica logo a seguir ao CW.grupoPartilhar: o GP marcado, e o retrato ainda com o u:group dele
    app.grupoLocalPartilhado('GP', 'Privado', ['H3']);
    app.snap = { 'u:group:GP': app.resumoDeTexto(JSON.stringify({ id: 'GP', kind: 'prop', name: 'Privado', ids: ['H3', 'H2'] })) };
    app.localStorage.setItem('gi_cloud_owner', 'EU');
    const st = ESTADO();
    st.sharedGroups.push({ id: 'GP', name: 'Privado', ownerId: 'EU', ownerName: 'Eu', mine: true, members: [{ id: 'EU', name: 'Eu' }], houses: [{ id: 'H3', name: 'Terceira', ownerId: 'EU' }], link: null });
    app.applyState(st, 'etag2', 'r2');
    const gp = app.db.groups.filter((g) => g.id === 'GP');
    assert.equal(gp.length, 1);
    assert.equal(gp[0]._partilhado, true, 'o grupo partilhado ficou');
    assert.equal(app.snap['u:group:GP'], '__obsoleto__');
  });
});

/* ------------------------------------------------ a porta ?grupo= */

describe('a porta ?grupo=<token>', () => {
  test('parseConvite lê ?grupo= (64 hex, insensível a maiúsculas) e continua a ler convite e ligar', () => {
    const { app } = montar();
    assert.deepEqual(cru(app.parseConvite('?grupo=' + TOKEN.toUpperCase())), { tipo: 'grupo', token: TOKEN });
    assert.deepEqual(cru(app.parseConvite('?x=1&grupo=' + TOKEN + '&y=2')), { tipo: 'grupo', token: TOKEN });
    assert.deepEqual(cru(app.parseConvite('?convite=' + TOKEN)), { tipo: 'convite', token: TOKEN });
    assert.deepEqual(cru(app.parseConvite('?ligar=' + TOKEN)), { tipo: 'ligar', token: TOKEN });
    assert.equal(app.parseConvite('?grupo=' + 'a'.repeat(63)), null, 'só 64 hex');
    assert.equal(app.parseConvite('?grupo=' + 'g'.repeat(64)), null, 'só hex');
  });

  test('a aterragem guarda gi_grupo, e preverChegada pede GET /api/grupo/<token>; a frase do ecrã de entrada diz o dono, o nome e os imóveis', async () => {
    const prev = { name: 'Casas do Porto', ownerName: 'Rui', houses: [{ name: 'Do Rui' }, { name: 'Minha' }], members: 2 };
    const { app, esp } = montar({ search: '?grupo=' + TOKEN.toUpperCase(), resposta: (m, p) => (p.startsWith('/api/grupo/') ? prev : {}) });
    assert.equal(app.sessionStorage.getItem('gi_grupo'), TOKEN, 'o token fica à espera, em minúsculas');
    assert.ok(esp.chamadas().includes('GET /api/grupo/' + TOKEN), 'a pré-visualização: ' + esp.chamadas().join(', '));
    assert.ok(!esp.api.some((x) => x.method === 'POST'), 'e nada que entre');
    await espera();
    assert.equal(app.CW._chegadaMsg, 'Rui convida-te para o grupo «Casas do Porto» (2 imóveis). Entra ou cria conta para pedires para entrar.');
    assert.deepEqual(cru(app.chegadaGuardada()), { tipo: 'grupo', token: TOKEN });
    assert.equal(app.fraseDaChegada({ tipo: 'grupo', token: TOKEN }, null), 'Entra ou cria conta para pedires para entrar.');
    assert.match(app.fraseDaChegada({ tipo: 'grupo', token: TOKEN }, { ownerName: 'Ana', name: 'Um', houses: [{ name: 'x' }] }), /^Ana convida-te para o grupo «Um» \(1 imóvel\)\./);
    app.esquecerChegada('grupo');
    assert.equal(app.chegadaGuardada(), null);
  });

  test('modalGrupo diz que é um pedido que o dono tem de aceitar, com o nome, os imóveis, «Agora não» e «Pedir para entrar»; o resgate abre-o', async () => {
    const { app, esp } = montar();
    const prev = { name: 'Casas do Porto', ownerName: 'Rui', houses: [{ name: 'Do Rui' }, { name: 'Minha' }], members: 3 };
    app.modalGrupo(TOKEN, prev);
    const j = esp.abertas[0];
    assert.equal(j.t, 'Grupo de Rui');
    assert.match(j.b, /<b>Rui<\/b> convida-te para o grupo <b>«Casas do Porto»<\/b> \(3 pessoas\)\./);
    assert.match(j.b, /Imóveis no grupo/);
    assert.match(j.b, /<b>Do Rui<\/b>/);
    assert.match(j.b, /<b>Minha<\/b>/);
    assert.match(j.b, /Ao pedires para entrar, <b>Rui<\/b> tem de aceitar\. Depois passas a comproprietário destes imóveis — vês contratos, movimentos e pessoas\. Os imóveis que adicionares ao grupo ficam partilhados com todos os membros\. Podes sair quando quiseres, em Grupos\./);
    assert.ok(!/Ao entrares|Entrar no grupo/.test(j.b + j.f), 'nada de entrar já');
    assert.match(j.b, /Entras como <b>eu@exemplo\.pt<\/b>/);
    assert.match(j.f, /data-toca="camada" data-click="CW\.chegadaDepois\('grupo'\)">Agora não</);
    assert.match(j.f, new RegExp('data-toca="dados" data-click="CW\\.entrarNoGrupo\\(\'' + TOKEN + '\'\\)">Pedir para entrar<'));
    assert.ok(!/on[a-z]+=|style=/.test(j.b + j.f), 'nada em linha');
    assert.deepEqual(cru(app.CW._grupoPrev), prev);
    // «Agora não» esquece o token e a pré-visualização
    app.sessionStorage.setItem('gi_grupo', TOKEN);
    app.CW.chegadaDepois('grupo');
    assert.equal(app.sessionStorage.getItem('gi_grupo'), null);
    assert.equal(app.CW._grupoPrev, null);
    assert.equal(app.modalStack.length, 0);
    // o resgate, com o token guardado, abre o mesmo modal (sem os avisos de entrada à frente)
    app.sessionStorage.setItem('gi_grupo', TOKEN);
    app.document.getElementById = () => null;
    app.authEl = null;
    esp.resposta = (m, p) => (p.startsWith('/api/grupo/') ? prev : {});
    app.CW.resgatarChegada();
    await new Promise((r) => setTimeout(r, 450));
    assert.equal(esp.abertas[1] && esp.abertas[1].t, 'Grupo de Rui');
    assert.ok(esp.chamadas().includes('GET /api/grupo/' + TOKEN));
  });

  test('CW.entrarNoGrupo com pedido: POST /api/grupo/<token>/entrar, esquece o token, fecha as janelas, sincroniza e abre «Pedido enviado» a dizer que o dono tem de aceitar — sem «Agora estás no grupo»', async () => {
    const { app, esp } = comEstado();
    app.sessionStorage.setItem('gi_grupo', TOKEN);
    app.modalGrupo(TOKEN, { name: 'Casas do Porto', ownerName: 'Rui', houses: [{ name: 'Do Rui' }] });
    // a resposta nova do servidor a quem ainda não é membro: sem os ids das casas
    esp.resposta = () => ({ id: 'G1', name: 'Casas do Porto', ownerName: 'Rui', houses: [{ name: 'Do Rui' }, { name: 'Minha' }], jaEstava: false, pedido: true });
    app.CW.entrarNoGrupo(TOKEN);
    await espera();
    assert.deepEqual(esp.chamadas(), ['POST /api/grupo/' + TOKEN + '/entrar']);
    assert.equal(app.sessionStorage.getItem('gi_grupo'), null, 'o token saiu');
    assert.equal(app.CW._grupoPrev, null);
    assert.equal(esp.puxou, 1, 'sincronizou: o pedido que fiz passa a estar no estado');
    assert.equal(app.modalStack.length, 1, 'o modal da chegada fechou e abriu o do desfecho');
    const j = esp.abertas[1];
    assert.equal(j.t, 'Pedido enviado');
    assert.match(j.b, /Pediste para entrar no grupo <b>«Casas do Porto»<\/b>\. <b>Rui<\/b> tem de aceitar: quando aceitar, os imóveis do grupo aparecem-te e passas a comproprietário deles\./);
    assert.match(j.b, /Vês o pedido, e podes cancelá-lo, em Grupos, no cartão «Grupos partilhados»\./);
    assert.match(j.f, /^<button class="btn primary" data-toca="camada" data-click="closeModal\(\)">Fechar<\/button>$/);
    assert.ok(!/Agora estás no grupo|És comproprietário|Ver os imóveis/.test(j.t + j.b + j.f), 'ainda não está no grupo');
    assert.ok(!/on[a-z]+=|style=/.test(j.b + j.f), 'nada em linha');
    assert.deepEqual(esp.toasts, []);
  });

  test('CW.entrarNoGrupo com jaPedido diz que já tinha pedido; com jaEstava abre «Já estás no grupo …» com os imóveis e «Ver os imóveis»', async () => {
    const { app, esp } = comEstado();
    app.sessionStorage.setItem('gi_grupo', TOKEN);
    esp.resposta = () => ({ id: 'G1', name: 'Casas do Porto', ownerName: 'Rui', houses: [{ name: 'Do Rui' }], jaEstava: false, pedido: true, jaPedido: true });
    app.CW.entrarNoGrupo(TOKEN);
    await espera();
    assert.equal(esp.abertas[0].t, 'Pedido enviado');
    assert.match(esp.abertas[0].b, /^<div class="form"><div class="hint u-fs-14px">Já tinhas pedido para entrar no grupo <b>«Casas do Porto»<\/b>\. <b>Rui<\/b> tem de aceitar/);
    assert.equal(app.sessionStorage.getItem('gi_grupo'), null, 'o token saiu também');
    // quem já é membro
    app.sessionStorage.setItem('gi_grupo', TOKEN);
    app.modalGrupo(TOKEN, { name: 'Casas do Porto', ownerName: 'Rui', houses: [] });
    esp.resposta = () => ({ id: 'G1', name: 'Casas do Porto', ownerName: 'Rui', houses: [{ name: 'Do Rui' }, { name: 'Minha' }], jaEstava: true, pedido: false });
    app.CW.entrarNoGrupo(TOKEN);
    await espera();
    assert.equal(app.sessionStorage.getItem('gi_grupo'), null);
    assert.equal(app.modalStack.length, 1, 'o modal da chegada fechou');
    const j = esp.abertas[esp.abertas.length - 1];
    assert.equal(j.t, 'Já estás no grupo «Casas do Porto»');
    assert.match(j.b, /Grupo de <b>Rui<\/b>\. És comproprietário de <b>Do Rui, Minha<\/b>: vês e editas contratos, movimentos e pessoas\./);
    assert.match(j.b, /sair quando quiseres, em Grupos\./);
    assert.match(j.f, /data-toca="ecra" data-click="closeAllModals\(\);go\('properties'\)">Ver os imóveis</);
    assert.ok(!j.b.includes('tem de aceitar'), 'sem pedido nenhum');
    assert.equal(esp.puxou, 2);
    assert.deepEqual(esp.toasts, []);
  });

  test('um 429 (o grupo com pedidos de mais por responder) deixa o token e o modal para se tentar depois, e diz a frase do servidor', async () => {
    const { app, esp } = comEstado();
    app.sessionStorage.setItem('gi_grupo', TOKEN);
    app.modalGrupo(TOKEN, { name: 'X', ownerName: 'Rui', houses: [] });
    esp.resposta = () => Object.assign(new Error('Este grupo já tem demasiados pedidos por responder. Tenta mais tarde.'), { status: 429 });
    app.CW.entrarNoGrupo(TOKEN);
    await espera();
    assert.equal(app.sessionStorage.getItem('gi_grupo'), TOKEN);
    assert.equal(app.modalStack.length, 1);
    assert.deepEqual(esp.toasts, ['Este grupo já tem demasiados pedidos por responder. Tenta mais tarde.']);
    assert.equal(esp.puxou, 0);
    // o 400 do dono que abre a própria ligação esquece-a e fecha
    esp.resposta = () => Object.assign(new Error('O grupo é teu.'), { status: 400 });
    app.CW.entrarNoGrupo(TOKEN);
    await espera();
    assert.equal(app.sessionStorage.getItem('gi_grupo'), null);
    assert.equal(app.modalStack.length, 0);
    assert.equal(esp.toasts[1], 'O grupo é teu.');
  });

  test('um 404 ao entrar esquece o token, fecha e diz a frase; um erro passageiro deixa tudo para se tentar outra vez', async () => {
    const { app, esp } = comEstado();
    app.sessionStorage.setItem('gi_grupo', TOKEN);
    app.modalGrupo(TOKEN, { name: 'X', ownerName: 'Rui', houses: [] });
    esp.resposta = () => Object.assign(new Error('Esta ligação não serve.'), { status: 404 });
    app.CW.entrarNoGrupo(TOKEN);
    await espera();
    assert.equal(app.sessionStorage.getItem('gi_grupo'), null);
    assert.equal(app.CW._grupoPrev, null);
    assert.equal(app.modalStack.length, 0, 'o modal fechou: cada toque repetia o pedido');
    assert.deepEqual(esp.toasts, ['Esta ligação não serve.']);
    assert.equal(esp.puxou, 0);
    // e um 500
    app.sessionStorage.setItem('gi_grupo', TOKEN);
    app.modalGrupo(TOKEN, { name: 'X', ownerName: 'Rui', houses: [] });
    esp.resposta = () => Object.assign(new Error('Erro 500'), { status: 500 });
    app.CW.entrarNoGrupo(TOKEN);
    await espera();
    assert.equal(app.sessionStorage.getItem('gi_grupo'), TOKEN, 'o token fica');
    assert.equal(app.modalStack.length, 1, 'e o modal também');
    assert.equal(esp.toasts[1], 'Erro 500');
    // com os Colaboradores desligados nesta conta não se entra, e diz-se
    app.definirServicosDesligados(['colaboradores']);
    esp.api.length = 0;
    app.CW.entrarNoGrupo(TOKEN);
    await espera();
    assert.deepEqual(esp.api, []);
    assert.match(esp.toasts[2], /Colaboradores está desligado nesta conta/);
  });
});

/* ------------------------------------------------ partilhar e criar */

describe('partilhar um grupo privado e criar um novo', () => {
  test('CW.grupoPartilhar: um só POST …/partilhar com o nome e as casas minhas; a janela da ligação abre logo, à espera, e preenche-se com o URL; marca o grupo local e guarda o URL; o toast diz que casa ficou de fora', async () => {
    const { app, esp } = comEstado();
    const url = 'https://teste.local/?grupo=' + TOKEN;
    esp.resposta = (m, p) => (p.endsWith('/partilhar') ? { ok: true, id: 'GP', url, expiresAt: 4102444800000 } : {});
    app.groupModal('prop', 'GP');   // a janela do grupo privado, de onde o menu chama
    app.CW.grupoPartilhar('GP');
    // antes de o servidor responder, a janela da ligação já está aberta, à espera
    const espera1 = esp.abertas[esp.abertas.length - 1];
    assert.equal(espera1.t, 'Ligação do grupo');
    assert.match(espera1.b, /A criar a ligação…/);
    assert.match(espera1.b, /A partilhar o grupo <b>«Privado»<\/b>/);
    assert.match(espera1.f, /<button class="btn primary" disabled>Copiar ligação<\/button>/, 'copiar só depois de haver ligação');
    await espera();
    assert.equal(esp.confirmados[0].t, 'Partilhar este grupo');
    assert.match(esp.confirmados[0].txt, /quem pedir para entrar pela ligação, e tu aceitares, fica comproprietário dos imóveis dele/);
    assert.match(esp.confirmados[0].txt, /Só os imóveis teus entram: <b>Do Rui<\/b> sai do grupo\./);
    assert.deepEqual(esp.chamadas(), ['POST /api/shared-groups/GP/partilhar'], 'um pedido só, e não três em fila');
    assert.deepEqual(esp.api[0].body, { name: 'Privado', houseIds: ['H3'] }, 'só a Terceira é minha');
    const g = app.db.groups.find((x) => x.id === 'GP');
    assert.equal(g._partilhado, true);
    assert.equal(g._meu, true);
    assert.equal(g._dono, 'EU');
    assert.deepEqual(cru(g.ids), ['H3'], 'a Do Rui saiu');
    assert.deepEqual(cru(g._membros), [{ id: 'EU', name: 'Eu' }]);
    assert.equal(g._ligacao.ativo, true);
    assert.equal(app.localStorage.getItem('gi_ligacao_url_grupo_GP_EU'), url, 'o URL fica no aparelho, na chave do grupo e da conta');
    assert.ok(esp.toasts.includes('Grupo partilhado. Do Rui ficou de fora — não é teu.'), esp.toasts.join(' | '));
    const j = esp.abertas[esp.abertas.length - 1];
    assert.equal(j, espera1, 'a mesma janela, preenchida no sítio — não fecha e reabre');
    const corpo = j.el.querySelector('.body').innerHTML;
    assert.ok(corpo.includes(url));
    assert.match(corpo, /Vale 7 dias e serve para várias pessoas/);
    assert.match(corpo, /pede para entrar no grupo <b>«Privado»<\/b>; quando aceitares, passa a comproprietário dos imóveis dele/);
    assert.ok(!corpo.includes('fica logo no grupo'), 'ninguém entra sem o dono aceitar');
    assert.match(j.el.querySelector('.foot').innerHTML, /CW\.copiar\('https:\/\/teste\.local/, 'o «Copiar ligação» já leva o URL');
    assert.equal(app.modalStack.length, 1, 'a janela do grupo privado fechou: o Guardar dela escrevia por cima das marcas');
    assert.equal(esp.puxou, 1);
    assert.ok(!Object.keys(cru(app.exportEntities())).includes('u:group:GP'), 'deixa de subir como u:group');
    // um grupo que já é partilhado abre a janela dele em vez de partilhar outra vez
    esp.api.length = 0;
    app.CW.grupoPartilhar('G2');
    assert.deepEqual(esp.api, []);
    assert.equal(esp.abertas[esp.abertas.length - 1].t, 'Família');
  });

  test('CW.grupoNovo cria pelo nome (PUT com um id daqui) e abre a janela do grupo', async () => {
    const { app, esp } = comEstado();
    app.uid = () => 'G9';
    esp.nomeDoPrompt = 'Casas de Faro';
    app.CW.grupoNovo();
    await espera();
    assert.equal(esp.prompts[0].t, 'Novo grupo partilhado');
    assert.deepEqual(esp.chamadas(), ['PUT /api/shared-groups/G9']);
    assert.deepEqual(esp.api[0].body, { name: 'Casas de Faro' });
    assert.equal(esp.puxou, 1);
    const j = esp.abertas[esp.abertas.length - 1];
    assert.equal(j.t, 'Casas de Faro');
    assert.match(j.b, /Grupo <b>teu<\/b>/);
    assert.match(j.b, /Ainda não há imóveis no grupo/);
    assert.match(j.b, /Criar ligação/);
    assert.equal(app.db.groups.find((g) => g.id === 'G9')._meu, true);
    // sem o serviço não se cria nada
    app.definirServicosDesligados(['colaboradores']);
    esp.api.length = 0;
    app.CW.grupoNovo();
    assert.deepEqual(esp.api, []);
    assert.match(esp.toasts[esp.toasts.length - 1], /desligado nesta conta/);
  });
});

/* ------------------------------------------------ a janela do grupo */

describe('a janela do grupo (CW.grupoModal)', () => {
  test('ao dono: membros com o dono marcado e eu «(eu)», «Remover» nos outros, imóveis com o dono, «Remover» no imóvel, a ligação com «expira a … · usada N vezes», e no menu «Mudar o nome…» e «Apagar grupo»; sem «Sair do grupo»', () => {
    const { app, esp } = comEstado();
    app.CW.grupoModal('G2');
    const j = esp.abertas[0];
    assert.equal(j.t, 'Família');
    assert.match(j.b, /Grupo <b>teu<\/b>\. Quem está nele é comproprietário de todos os imóveis do grupo/);
    assert.match(j.b, /<b class="u-d-block">Eu \(eu\)<\/b><span class="badge grey">dono<\/span>/);
    assert.match(j.b, /<b class="u-d-block">Ana<\/b><span class="small">membro<\/span>/);
    assert.match(j.b, /data-risco="destroi" data-click="CW\.grupoRemoverMembro\('G2','ANA'\)">Remover</);
    assert.ok(!j.b.includes("CW.grupoRemoverMembro('G2','EU')"), 'não me removo a mim');
    assert.match(j.b, /<b class="u-d-block">Terceira<\/b><span class="small">teu<\/span>/);
    assert.match(j.b, /data-click="CW\.grupoRemoverImovel\('G2','H3'\)">Remover</);
    assert.match(j.b, /data-toca="camada" data-click="CW\.grupoImoveis\('G2'\)">[\s\S]*?Adicionar os meus imóveis…</);
    assert.match(j.b, /Ligação de convite/);
    assert.match(j.b, /Ativa · expira a \S+ · usada 3 vezes/, 'a data como o pt-PT do motor a escreve; cada pedido pela ligação é um uso');
    assert.match(j.b, /Quem a abrir pede para entrar, e só entra quando aceitares — os pedidos aparecem em cima\./);
    assert.ok(!j.b.includes('sem mais confirmação'), 'a regra antiga saiu');
    assert.ok(!j.b.includes('Pedidos para entrar'), 'sem pedidos, sem a secção');
    assert.match(j.b, /data-toca="nada" data-click="CW\.grupoLigacaoCopiar\('G2'\)">Copiar ligação</);
    assert.match(j.b, /data-toca="dados" data-click="CW\.grupoLigacaoRodar\('G2'\)">Rodar</);
    assert.match(j.b, /data-toca="dados" data-click="CW\.grupoLigacaoDesativar\('G2'\)">Desativar</);
    assert.ok(!j.b.includes('Sair do grupo'), 'o dono não sai — apaga');
    assert.match(j.m, /data-toca="camada" data-click="closePops\(\);CW\.grupoRenomear\('G2'\)"/);
    assert.match(j.m, /data-toca="dados" data-risco="destroi" data-click="closePops\(\);CW\.grupoApagar\('G2'\)"/);
    assert.match(j.f, /data-toca="camada" data-click="closeModal\(\)">Fechar</);
    assert.ok(!/on[a-z]+=|style=/.test(j.b + j.f + j.m), 'nada em linha');
  });

  test('a quem não é dono: «Sair do grupo», sem «Remover», sem a ligação e sem «Apagar grupo»; «Remover» só no imóvel meu', () => {
    const { app, esp } = comEstado();
    app.CW.grupoModal('G1');
    const j = esp.abertas[0];
    assert.equal(j.t, 'Casas do Porto');
    assert.match(j.b, /Grupo de <b>Rui<\/b>\./);
    assert.match(j.b, /<b class="u-d-block">Rui<\/b><span class="badge grey">dono<\/span>/);
    assert.match(j.b, /<b class="u-d-block">Eu \(eu\)<\/b><span class="small">membro<\/span>/);
    assert.ok(!j.b.includes('CW.grupoRemoverMembro('), 'só o dono remove membros');
    assert.match(j.b, /data-toca="dados" data-risco="destroi" data-click="CW\.grupoSair\('G1'\)">Sair do grupo</);
    assert.match(j.b, /Ao saíres, os imóveis que adicionaste são removidos do grupo\. Os movimentos já registados ficam em cada imóvel\./);
    assert.match(j.b, /<b class="u-d-block">Do Rui<\/b><span class="small">de Rui<\/span>/);
    assert.match(j.b, /<b class="u-d-block">Minha<\/b><span class="small">teu<\/span>/);
    assert.ok(j.b.includes("CW.grupoRemoverImovel('G1','H1')"), 'a minha tiro eu');
    assert.ok(!j.b.includes("CW.grupoRemoverImovel('G1','H2')"), 'a do Rui não');
    assert.ok(!j.b.includes('Ligação de convite') && !j.b.includes('Criar ligação') && !j.b.includes('grupoLigacao'), 'a ligação é do dono');
    assert.equal(j.m, '', 'sem menu: nem apagar nem renomear');
    // sem imóveis meus, a saída para criar o primeiro em vez do botão
    app.db.properties = app.db.properties.filter((p) => p.id === 'H2');
    app.CW.grupoModal('G1');
    const k = esp.abertas[1];
    assert.match(k.b, /Ainda não tens imóveis teus para adicionar ao grupo\./);
    assert.match(k.b, /data-toca="camada" data-click="propModal\(\)">Adicionar imóvel</);
    assert.ok(!k.b.includes('grupoImoveis'));
  });

  test('«Adicionar os meus imóveis…» lista só as casas cwMinha, com as do grupo marcadas, e guardar faz o PUT houses com as marcadas', async () => {
    const { app, esp } = comEstado();
    app.CW.grupoModal('G1');
    app.CW.grupoImoveis('G1');
    const j = esp.abertas[1];
    assert.equal(j.t, 'Adicionar os meus imóveis');
    assert.match(j.b, /ficam partilhados com todos os membros de <b>«Casas do Porto»<\/b> — passam a comproprietários/);
    assert.match(j.b, /id="cwg_h_H1" checked>/);
    assert.match(j.b, /id="cwg_h_H3">/);
    assert.ok(!j.b.includes('cwg_h_H2'), 'a Do Rui não é minha');
    // como o browser lê o HTML: a H1 marcada; e a pessoa marca a H3
    app.document.getElementById('cwg_h_H1').checked = true;
    app.document.getElementById('cwg_h_H3').checked = true;
    esp.aoPuxar = () => { app.db.groups.find((g) => g.id === 'G1').ids.push('H3'); };
    j.onSave();
    await espera();
    assert.deepEqual(esp.chamadas(), ['PUT /api/shared-groups/G1/houses']);
    assert.deepEqual(esp.api[0].body, { houseIds: ['H1', 'H3'] });
    assert.deepEqual(esp.toasts, ['Imóveis no grupo atualizados.']);
    assert.equal(app.modalStack.length, 1, 'a janela das caixas fechou, a do grupo ficou');
    // o repinte escreve no corpo da camada (body.innerHTML); o L.b é o que a janela tinha ao abrir
    assert.match(esp.abertas[0].body.innerHTML, /<b class="u-d-block">Terceira<\/b>/, 'e repintou-se com o estado que a leitura trouxe');
  });

  test('remover um imóvel, remover um membro e a ligação (criar, rodar, desativar, copiar) falam com as rotas do contrato e repintam a janela', async () => {
    const { app, esp } = comEstado();
    const url = 'https://teste.local/?grupo=' + TOKEN;
    esp.resposta = (m, p) => (p.endsWith('/link') && m === 'POST' ? { url, expiresAt: 4102444800000 } : {});
    app.CW.grupoModal('G2');
    esp.aoPuxar = () => { const g = app.db.groups.find((x) => x.id === 'G2'); g.ids = []; g._membros = [{ id: 'EU', name: 'Eu' }]; };
    app.CW.grupoRemoverImovel('G2', 'H3');
    app.CW.grupoRemoverMembro('G2', 'ANA');
    await espera();
    assert.deepEqual(esp.confirmados.map((c) => c.t), ['Remover imóvel do grupo', 'Remover do grupo']);
    assert.match(esp.confirmados[0].txt, /<b>Terceira<\/b> deixa de estar partilhado pelo grupo/);
    assert.match(esp.confirmados[1].txt, /<b>Ana<\/b> deixa de ver os imóveis do grupo, e os imóveis que adicionou são removidos dele/);
    assert.deepEqual(esp.chamadas(), ['DELETE /api/shared-groups/G2/houses/H3', 'DELETE /api/shared-groups/G2/members/ANA']);
    assert.deepEqual(esp.toasts, ['Imóvel removido do grupo.', 'Membro removido.']);
    assert.match(esp.abertas[0].body.innerHTML, /Ainda não há imóveis no grupo/, 'repintou');
    assert.ok(!esp.abertas[0].body.innerHTML.includes('Ana'), 'sem a Ana');
    // a ligação
    esp.api.length = 0; esp.toasts.length = 0; esp.aoPuxar = null;
    app.CW.grupoLigacaoCopiar('G2');
    assert.match(esp.toasts[0], /A ligação só se mostra quando é criada/);
    app.CW.grupoLigacaoRodar('G2');
    await espera();
    assert.equal(esp.confirmados[2].t, 'Rodar a ligação');
    assert.deepEqual(esp.chamadas(), ['POST /api/shared-groups/G2/link']);
    assert.equal(app.localStorage.getItem('gi_ligacao_url_grupo_G2_EU'), url);
    assert.equal(esp.abertas[1].t, 'Ligação do grupo');
    assert.ok(esp.abertas[1].b.includes(url));
    app.CW.grupoLigacaoCopiar('G2');
    assert.ok(esp.toasts.includes('Ligação copiada.'));
    app.CW.grupoLigacaoDesativar('G2');
    await espera();
    assert.equal(esp.confirmados[3].t, 'Desativar a ligação');
    assert.equal(esp.chamadas()[1], 'DELETE /api/shared-groups/G2/link');
    assert.equal(app.localStorage.getItem('gi_ligacao_url_grupo_G2_EU'), null, 'o URL guardado sai');
    assert.ok(esp.toasts.includes('Ligação do grupo desativada.'));
    app.CW.grupoLigacaoCriar('G2');
    await espera();
    assert.equal(esp.chamadas()[2], 'POST /api/shared-groups/G2/link');
    assert.ok(esp.toasts.includes('Ligação do grupo criada — copia-a e envia.'));
  });

  test('«Mudar o nome…» faz o PUT {name} e repinta o título; sair e apagar chamam as rotas, fecham as janelas e tiram o grupo da base', async () => {
    const { app, esp } = comEstado();
    app.db.transactions.push(app.normTx({ id: 'T2', kind: 'expense', label: 'Seguro', amount: 10, date: '2026-01-01', groupId: 'G2' }));
    app.CW.grupoModal('G2');
    esp.nomeDoPrompt = 'Família toda';
    app.CW.grupoRenomear('G2');
    await espera();
    assert.deepEqual(esp.prompts.map((p) => [p.t, p.v]), [['Mudar o nome', 'Família']]);
    assert.deepEqual(esp.chamadas(), ['PUT /api/shared-groups/G2']);
    assert.deepEqual(esp.api[0].body, { name: 'Família toda' });
    assert.equal(esp.abertas[0].el.querySelector('.head h2').textContent, 'Família toda');
    assert.deepEqual(esp.toasts, ['Grupo guardado.']);
    // apagar (só o dono; a base fica sem o grupo e os movimentos sem grupo)
    esp.api.length = 0;
    app.CW.grupoApagar('G2');
    await espera();
    assert.equal(esp.confirmados[0].t, 'Apagar grupo');
    assert.match(esp.confirmados[0].txt, /desaparece para todos os membros[\s\S]*Os movimentos já registados ficam em cada imóvel\. Um movimento antigo, ainda por dividir, fica sem imóvel\./);
    assert.ok(!esp.confirmados[0].txt.includes('contar para todos'), 'a regra antiga saiu');
    assert.deepEqual(esp.chamadas(), ['DELETE /api/shared-groups/G2']);
    assert.ok(!app.db.groups.some((g) => g.id === 'G2'));
    assert.equal(app.db.transactions.find((t) => t.id === 'T2').groupId, null);
    assert.equal(app.modalStack.length, 0);
    assert.ok(esp.toasts.includes('Grupo apagado.'));
    // sair (quem não é dono)
    esp.api.length = 0;
    app.CW.grupoModal('G1');
    app.CW.grupoSair('G1');
    await espera();
    assert.equal(esp.confirmados[1].t, 'Sair do grupo');
    assert.match(esp.confirmados[1].txt, /os imóveis que adicionaste são removidos do grupo\. Os movimentos já registados ficam em cada imóvel\./);
    assert.deepEqual(esp.chamadas(), ['DELETE /api/shared-groups/G1/members/EU']);
    assert.ok(!app.db.groups.some((g) => g.id === 'G1'));
    assert.equal(app.modalStack.length, 0);
    assert.ok(esp.toasts.includes('Saíste do grupo «Casas do Porto».'));
    // o servidor que recusa deixa tudo como está
    esp.resposta = () => Object.assign(new Error('Só o dono do grupo ou o dono do imóvel o tiram.'), { status: 403 });
    app.CW.grupoRemoverImovel('GP', 'H3');
    await espera();
    assert.ok(esp.toasts.includes('Só o dono do grupo ou o dono do imóvel o tiram.'));
  });
});

/* ------------------------------------------------ os cartões e o separador Grupos */

describe('o cartão «Grupos partilhados» e o separador Grupos', () => {
  test('gruposCard lista os grupos com N imóveis, N pessoas e «teu»/«de <dono>», abre a janela e tem «Novo grupo partilhado»; vCloud tem só a linha que leva aos Grupos, com os Colaboradores ligados', () => {
    const { app } = comEstado();
    const h = app.gruposCard();
    assert.match(h, /<div class="title">Grupos partilhados<\/div>/);
    assert.match(h, /data-toca="camada" data-click="CW\.grupoModal\('G1'\)">[\s\S]*?<b class="u-d-block">Casas do Porto<\/b><span class="small">2 imóveis · 3 pessoas · de Rui<\/span>/);
    assert.match(h, /data-click="CW\.grupoModal\('G2'\)">[\s\S]*?<b class="u-d-block">Família<\/b><span class="small">1 imóvel · 2 pessoas · teu<\/span>/);
    assert.match(h, /data-toca="camada" data-click="CW\.grupoNovo\(\)">[\s\S]*?Novo grupo partilhado</);
    assert.match(h, /Quem está num grupo é comproprietário de todos os imóveis dele/);
    assert.match(h, /o dono do grupo cria a ligação por onde os outros pedem para entrar, e aceita ou recusa cada pedido\./);
    assert.ok(!h.includes('Privado'), 'os privados não são daqui');
    const c = app.vCloud();
    const iL = c.indexOf('Ainda não estás ligado a ninguém.'), iG = c.indexOf('Grupos partilhados'), iS = c.indexOf('Segurança');
    assert.ok(iL > -1 && iG > iL && iS > iG, 'a seguir aos utilizadores ligados, antes da segurança: ' + [iL, iG, iS].join(', '));
    assert.match(c, /data-toca="ecra" data-click="go\('groups'\)">[\s\S]*?<b class="u-d-block">Grupos partilhados<\/b><span class="small">2 grupos partilhados<\/span>/, 'a linha que leva ao separador');
    assert.ok(!c.includes('CW.grupoNovo()') && !c.includes("CW.grupoModal('G1')"), 'o cartão já não vive em Conta e partilha');
    // sem grupos, o vazio convida
    app.db.groups = app.db.groups.filter((g) => !g._partilhado);
    assert.match(app.gruposCard(), /Ainda não estás em nenhum grupo partilhado\. Cria um novo, ou partilha um grupo de imóveis que já tenhas\./);
    assert.match(app.vCloud(), /Ainda em nenhum grupo partilhado/);
    // com os Colaboradores desligados, nem cartão nem porta
    app.definirServicosDesligados(['colaboradores']);
    assert.equal(app.gruposCard(), '');
    assert.ok(!app.vCloud().includes('Grupos partilhados'));
    app.definirServicosDesligados([]);
    app.CW.user = null;
    assert.equal(app.gruposCard(), '', 'sem sessão não há grupos');
  });

  test('vGroups mostra o selo «Partilhado · N pessoas» (e «de <dono>» quando não é meu), abre CW.grupoModal num partilhado, e «Partilhar» no privado em vez de «Novo grupo partilhado»', () => {
    const { app } = comEstado();
    const h = app.vGroups();
    assert.match(h, /data-click="CW\.grupoModal\('G1'\)">[\s\S]*?<div class="title">Casas do Porto<span class="badge grey u-ml-7px">Partilhado · 3 pessoas · de Rui<\/span><\/div>/);
    assert.match(h, /data-click="CW\.grupoModal\('G2'\)">[\s\S]*?<div class="title">Família<span class="badge grey u-ml-7px">Partilhado · 2 pessoas<\/span><\/div>/);
    assert.match(h, /data-click="groupModal\('prop','GP'\)">[\s\S]*?<div class="title">Privado<\/div>/, 'o privado abre o modal da base, sem selo');
    assert.match(h, /data-toca="camada" data-click="event\.stopPropagation\(\);CW\.grupoPartilhar\('GP'\)">[\s\S]*?Partilhar<\/button>/);
    assert.equal((h.match(/CW\.grupoPartilhar\(/g) || []).length, 1, 'só no privado: os partilhados não se partilham outra vez');
    assert.match(h, /«Partilhar» passa um grupo de imóveis a partilhado/);
    assert.ok(!h.includes('Novo grupo partilhado'), 'vive no cartão dos partilhados, em cima');
    // sem sessão o «Partilhar» fica à vista: o toque é que diz que é preciso entrar
    app.CW.user = null;
    assert.ok(app.vGroups().includes("CW.grupoPartilhar('GP')"));
  });

  test('groupModal e delGroup delegam para a nuvem num grupo partilhado (apagar ao dono, sair a quem não é)', async () => {
    const { app, esp } = comEstado();
    app.groupModal('prop', 'G1');
    assert.equal(esp.abertas[0].t, 'Casas do Porto', 'a janela da nuvem, não o formulário da base');
    assert.match(esp.abertas[0].b, /Sair do grupo/);
    app.delGroup('G2');
    app.delGroup('G1');
    await espera();
    assert.deepEqual(esp.confirmados.map((c) => c.t), ['Apagar grupo', 'Sair do grupo']);
    assert.deepEqual(esp.chamadas(), ['DELETE /api/shared-groups/G2', 'DELETE /api/shared-groups/G1/members/EU']);
    // um privado continua a apagar-se na base, sem API
    esp.api.length = 0;
    app.delGroup('GP');
    await espera();
    assert.equal(esp.confirmados[2].t, 'Apagar grupo');
    assert.deepEqual(esp.api, []);
    assert.ok(!app.db.groups.some((g) => g.id === 'GP'));
  });

  test('o menu de um grupo de imóveis privado tem sempre «Partilhar este grupo…» — com sessão, sem ela e com os Colaboradores desligados (o toque explica) —, e um grupo novo ou de proprietários não', () => {
    const { app, esp } = comEstado();
    app.groupModal('prop', 'GP');
    assert.equal(esp.abertas[0].t, 'Editar grupo');
    assert.match(esp.abertas[0].m, /data-toca="camada" data-click="closePops\(\);CW\.grupoPartilhar\('GP'\)">[\s\S]*?Partilhar este grupo…</);
    assert.match(esp.abertas[0].m, /Apagar grupo/);
    assert.ok(esp.abertas[0].m.indexOf('Partilhar este grupo') < esp.abertas[0].m.indexOf('Apagar grupo'), 'partilhar antes de apagar');
    // um grupo novo (sem id) não tem menu nenhum
    app.groupModal('prop');
    assert.equal(esp.abertas[1].m, '');
    // sem sessão: fica, e o toque leva à entrada
    app.CW.user = null;
    app.groupModal('prop', 'GP');
    assert.ok(esp.abertas[2].m.includes("CW.grupoPartilhar('GP')"));
    assert.match(esp.abertas[2].m, /Apagar grupo/);
    // com os Colaboradores desligados: fica, e o toque diz a frase do serviço
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
    app.definirServicosDesligados(['colaboradores']);
    app.groupModal('prop', 'GP');
    assert.ok(esp.abertas[3].m.includes("CW.grupoPartilhar('GP')"));
    assert.ok(!app.vGroups().includes('Novo grupo partilhado'));
    // e num grupo de proprietários nunca
    app.definirServicosDesligados([]);
    app.db.groups.push(app.normGroup({ id: 'GO', kind: 'owner', name: 'Família', ids: ['EU'] }));
    app.groupModal('owner', 'GO');
    assert.ok(!esp.abertas[4].m.includes('grupoPartilhar'));
  });
});

/* ------------------------------------------------ os pedidos para entrar */

/* O estado com pedidos: o Zé e a Lurdes pediram para entrar no meu grupo G2
   «Família» (o Zé vem nas duas listas do servidor — a de todos os meus
   grupos e a do grupo —, a Lurdes só na do grupo, e chegou depois), e eu
   pedi para entrar no grupo G7 «Casas de Faro» do Tó. */
const COM_PEDIDOS = () => {
  const st = ESTADO();
  st.sharedGroupRequests = {
    incoming: [{ groupId: 'G2', groupName: 'Família', userId: 'ZE', name: 'Zé', createdAt: 1767225600000 }],
    outgoing: [{ groupId: 'G7', groupName: 'Casas de Faro', ownerName: 'Tó', createdAt: 1767225600000 }],
  };
  st.sharedGroups[0].pedidos = [];
  st.sharedGroups[1].pedidos = [{ userId: 'LU', name: 'Lurdes', createdAt: 1767312000000 }, { userId: 'ZE', name: 'Zé', createdAt: 1767225600000 }];
  return st;
};

describe('o pedido para entrar num grupo', () => {
  test('a janela do grupo mostra ao dono «Pedidos para entrar», antes dos membros, com Aceitar e Recusar por pessoa, sem repetir quem vem nas duas listas', () => {
    const { app, esp } = comEstado(COM_PEDIDOS());
    app.CW.grupoModal('G2');
    const b = esp.abertas[0].b;
    const iP = b.indexOf('<div class="flabel">Pedidos para entrar</div>'), iM = b.indexOf('<div class="flabel">Membros</div>');
    assert.ok(iP > -1 && iP < iM, 'antes dos membros: ' + [iP, iM].join(', '));
    assert.match(b, /<b class="u-d-block">Zé<\/b><span class="small">quer entrar · pediu a [^<]+<\/span>/);
    assert.match(b, /data-toca="dados" data-click="CW\.grupoAceitarPedido\('G2','ZE'\)">Aceitar</);
    assert.match(b, /data-toca="dados" data-click="CW\.grupoRecusarPedido\('G2','ZE'\)">Recusar</);
    assert.match(b, /data-toca="dados" data-click="CW\.grupoAceitarPedido\('G2','LU'\)">Aceitar</);
    assert.equal((b.match(/grupoAceitarPedido\('G2','ZE'\)/g) || []).length, 1, 'o Zé aparece uma vez');
    assert.ok(b.indexOf("'ZE'") < b.indexOf("'LU'"), 'pela ordem de chegada');
    assert.match(b, /Se aceitares, passa a comproprietário dos imóveis do grupo/);
    assert.ok(!/on[a-z]+=|style=/.test(b), 'nada em linha');
  });

  test('a quem não é dono, nem a secção nem um botão de aceitar ou recusar — mesmo com um pedido desse grupo no estado', () => {
    const st = COM_PEDIDOS();
    st.sharedGroupRequests.incoming.push({ groupId: 'G1', groupName: 'Casas do Porto', userId: 'ZE', name: 'Zé', createdAt: 1 });
    st.sharedGroups[0].pedidos = [{ userId: 'ZE', name: 'Zé', createdAt: 1 }];
    const { app, esp } = comEstado(st);
    app.CW.grupoModal('G1');
    const b = esp.abertas[0].b;
    assert.ok(!b.includes('Pedidos para entrar'));
    assert.ok(!/grupoAceitarPedido|grupoRecusarPedido|>Aceitar<|>Recusar</.test(b), 'nenhum botão a quem não é dono');
    assert.deepEqual(cru(app.pedidosParaEntrar('G1')), []);
    assert.match(app.gruposCard(), /<b class="u-d-block">Casas do Porto<\/b><span class="small">2 imóveis · 3 pessoas · de Rui<\/span>/, 'e no cartão não se contam');
  });

  test('CW.grupoAceitarPedido: POST …/requests/<uid>/accept, tira o pedido do estado, sincroniza, repinta a janela e diz quem entrou', async () => {
    const { app, esp } = comEstado(COM_PEDIDOS());
    app.CW.grupoModal('G2');
    esp.aoPuxar = () => { app.db.groups.find((g) => g.id === 'G2')._membros.push({ id: 'ZE', name: 'Zé' }); };
    app.CW.grupoAceitarPedido('G2', 'ZE');
    await espera();
    assert.deepEqual(esp.chamadas(), ['POST /api/shared-groups/G2/requests/ZE/accept']);
    assert.equal(esp.api[0].body, undefined);
    assert.deepEqual(esp.toasts, ['Zé entrou no grupo «Família».']);
    assert.equal(esp.puxou, 1, 'sincronizou');
    assert.deepEqual(cru(app.CW.state.sharedGroupRequests.incoming), [], 'o pedido saiu do estado');
    assert.deepEqual(cru(app.pedidosParaEntrar('G2')).map((p) => p.userId), ['LU'], 'e da lista do grupo');
    const rep = esp.abertas[0].body.innerHTML;
    assert.ok(!rep.includes("grupoAceitarPedido('G2','ZE')"), 'a janela repintou-se sem o pedido');
    assert.match(rep, /<b class="u-d-block">Zé<\/b><span class="small">membro<\/span>/, 'e com o Zé nos membros');
    assert.ok(!app.pedidosDashCard().includes('Zé quer entrar'), 'o cartão da vista geral também');
  });

  test('CW.grupoRecusarPedido: POST …/reject e «Pedido recusado.»; um erro passageiro deixa o pedido, e um 404 (quem pediu cancelou) diz-se e tira-o', async () => {
    const { app, esp } = comEstado(COM_PEDIDOS());
    app.CW.grupoRecusarPedido('G2', 'LU');
    await espera();
    assert.deepEqual(esp.chamadas(), ['POST /api/shared-groups/G2/requests/LU/reject']);
    assert.deepEqual(esp.toasts, ['Pedido recusado.']);
    assert.equal(esp.puxou, 1);
    assert.deepEqual(cru(app.pedidosParaEntrar('G2')).map((p) => p.userId), ['ZE']);
    esp.resposta = () => Object.assign(new Error('Erro 500'), { status: 500 });
    app.CW.grupoAceitarPedido('G2', 'ZE');
    await espera();
    assert.equal(esp.toasts[1], 'Erro 500');
    assert.deepEqual(cru(app.pedidosParaEntrar('G2')).map((p) => p.userId), ['ZE'], 'fica, para se tentar outra vez');
    assert.equal(esp.puxou, 1);
    esp.resposta = () => Object.assign(new Error('Pedido não encontrado.'), { status: 404 });
    app.CW.grupoAceitarPedido('G2', 'ZE');
    await espera();
    assert.equal(esp.chamadas()[2], 'POST /api/shared-groups/G2/requests/ZE/accept');
    assert.equal(esp.toasts[2], 'Pedido não encontrado.');
    assert.deepEqual(cru(app.pedidosParaEntrar('G2')), [], 'sai da lista na mesma');
    assert.equal(esp.puxou, 2, 'e lê o estado');
  });

  test('CW.grupoCancelarPedido: DELETE …/requests/<eu>, tira o meu pedido do estado, sincroniza, e o cartão deixa de o mostrar', async () => {
    const { app, esp } = comEstado(COM_PEDIDOS());
    assert.match(app.gruposCard(), /Casas de Faro · à espera de Tó/);
    app.CW.grupoCancelarPedido('G7');
    await espera();
    assert.deepEqual(esp.chamadas(), ['DELETE /api/shared-groups/G7/requests/EU']);
    assert.deepEqual(esp.toasts, ['Pedido cancelado.']);
    assert.equal(esp.puxou, 1);
    assert.deepEqual(cru(app.CW.state.sharedGroupRequests.outgoing), []);
    assert.equal(cru(app.CW.state.sharedGroupRequests.incoming).length, 1, 'os que me chegam ficam');
    assert.ok(!app.gruposCard().includes('Casas de Faro'));
  });

  test('gruposCard lista o pedido que fiz («<grupo> · à espera de <dono>», «Cancelar pedido») e, nos meus grupos, quantos pedidos esperam resposta', () => {
    const { app } = comEstado(COM_PEDIDOS());
    const h = app.gruposCard();
    assert.match(h, /<b class="u-d-block">Casas de Faro · à espera de Tó<\/b><span class="small">Pediste para entrar\. Os imóveis do grupo aparecem quando Tó aceitar\.<\/span>/);
    assert.match(h, /data-toca="dados" data-click="CW\.grupoCancelarPedido\('G7'\)">Cancelar pedido</);
    assert.match(h, /<b class="u-d-block">Família<\/b><span class="small">1 imóvel · 2 pessoas · teu · <b>2 pedidos por responder<\/b><\/span>/);
    assert.ok(h.indexOf('Família') < h.indexOf('Casas de Faro'), 'os grupos primeiro, depois os pedidos que fiz');
    assert.ok(!/on[a-z]+=|style=/.test(h), 'nada em linha');
    // só com o pedido, sem grupos: o pedido mostra-se e o vazio não
    app.db.groups = app.db.groups.filter((g) => !g._partilhado);
    const so = app.gruposCard();
    assert.match(so, /Casas de Faro · à espera de Tó/);
    assert.ok(!so.includes('Ainda não estás em nenhum grupo partilhado'));
    // sem o nome do dono, sem buracos na frase
    app.CW.state.sharedGroupRequests.outgoing = [{ groupId: 'G8', groupName: 'Sem dono à vista' }];
    assert.match(app.gruposCard(), /Sem dono à vista · à espera de resposta<\/b><span class="small">Pediste para entrar\. Os imóveis do grupo aparecem quando o dono aceitar\./);
  });

  test('sem sessão ou com os Colaboradores desligados, aceitar, recusar e cancelar não chamam a API nem rebentam; um estado sem a lista dos pedidos também não', async () => {
    const { app, esp } = comEstado(COM_PEDIDOS());
    app.CW.user = null;
    app.CW.grupoAceitarPedido('G2', 'ZE');
    app.CW.grupoRecusarPedido('G2', 'ZE');
    app.CW.grupoCancelarPedido('G7');
    assert.equal(app.gruposCard(), '');
    await espera();
    assert.deepEqual(esp.api, []);
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
    app.definirServicosDesligados(['colaboradores']);
    app.CW.grupoAceitarPedido('G2', 'ZE');
    app.CW.grupoCancelarPedido('G7');
    await espera();
    assert.deepEqual(esp.api, []);
    assert.equal(esp.toasts.length, 2);
    assert.match(esp.toasts[0], /Colaboradores está desligado nesta conta/);
    assert.equal(app.pedidosDashCard(), '', 'nem o cartão da vista geral os oferece');
    // um estado de antes da regra, sem sharedGroupRequests nem pedidos nos grupos
    app.definirServicosDesligados([]);
    app.CW.state = ESTADO();
    assert.doesNotThrow(() => app.gruposCard());
    assert.doesNotThrow(() => app.CW.grupoModal('G2'));
    assert.ok(!esp.abertas[esp.abertas.length - 1].b.includes('Pedidos para entrar'));
    assert.equal(app.pedidosDashCard(), '');
  });

  test('apagar o grupo leva os pedidos dele; uma parte de lote, que vive no seu imóvel, fica como estava e não conta como movimento antigo', async () => {
    const { app, esp } = comEstado(COM_PEDIDOS());
    const parte = app.normTx({ id: 'L1_H3', kind: 'expense', label: 'Seguro', amount: 10, date: '2026-01-01', propertyId: 'H3' });
    parte.lote = { id: 'L1', n: 2, total: 20, alvo: 'g:G2', modo: 'equal', partes: {} };
    app.db.transactions.push(parte);
    app.CW.grupoApagar('G2');
    await espera();
    assert.match(esp.confirmados[0].txt, /Os movimentos já registados ficam em cada imóvel\.$/, 'sem movimentos antigos, sem a frase deles');
    assert.deepEqual(esp.chamadas(), ['DELETE /api/shared-groups/G2']);
    const t = app.db.transactions.find((x) => x.id === 'L1_H3');
    assert.equal(t.propertyId, 'H3');
    assert.equal(t.lote.alvo, 'g:G2', 'a parte fica como estava');
    assert.deepEqual(cru(app.CW.state.sharedGroupRequests.incoming), [], 'os pedidos do grupo saíram');
    assert.equal(cru(app.CW.state.sharedGroupRequests.outgoing).length, 1, 'os de outros grupos ficam');
  });
});
