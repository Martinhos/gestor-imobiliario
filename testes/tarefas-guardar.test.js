// A janela das tarefas trabalha sobre um rascunho (web/app/tarefas.js):
// marcar, adicionar, mudar, remover, mover, as secções e o arrasto mudam só
// o rascunho e não chamam o save(); o «Guardar» da janela grava tudo de uma
// vez, com um só save(). Fechar com alterações pergunta «Sair sem guardar?»
// pelo mecanismo dos modais (o retrato e o «mexido» da camada), e sem
// alterações fecha logo; o Cancelar deita o rascunho fora. Quem não pode
// alterar não tem «Guardar», e o Guardar reverifica a permissão. A leitura de
// fundo não corre com a janela aberta, e o rascunho não se mistura com o
// registo.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor, elementos, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const HOJE = '2026-10-25';
const app = carregarApp({ hoje: HOJE });
afterEach(() => repor(app));

/* Uma base com um imóvel e um contrato nele; as janelas numa pilha
   observável (fechar corre o aoFechar da camada, como o closeModal a sério,
   e guarda por onde se saiu), os save() contados e os toasts guardados.
   Devolve: {abertas, toasts, fechos, saves}. */
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] })];
  app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 600, start: '2026-01-01' })];
  const abertas = janelasFalsas(app, 'render', 'buildNav', 'paintThumbs', 'setModal');
  const fechos = [];
  app.closeModal = (origem) => {
    fechos.push(origem === undefined ? '(decisão)' : origem);
    const L = app.modalStack.pop();
    if (L && typeof L.aoFechar === 'function') L.aoFechar();
  };
  const saves = { n: 0 };
  app.save = () => { saves.n++; };
  const toasts = [];
  app.toast = (m, op) => { toasts.push({ m, op }); };
  app.localStorage.clear();
  app._tfRec = null;
  app.tfArrFim = 0;
  return { abertas, toasts, fechos, saves };
}

/* Duas secções e quatro tarefas, uma delas cumprida e uma solta.
   Devolve: as tarefas em bruto. */
const LISTA = () => ({
  seccoes: [{ id: 'S1', nome: 'Obras' }, { id: 'S2', nome: 'Documentos' }],
  itens: [
    { id: 'K1', nome: 'Pintar a sala', seccao: 'S1', feita: false },
    { id: 'K2', nome: 'Trocar o esquentador', seccao: 'S1', feita: true, feitaEm: '2026-10-01' },
    { id: 'K3', nome: 'Pedir o certificado energético', seccao: 'S2', feita: false },
    { id: 'K4', nome: 'Ligar à Ana', seccao: '', feita: false },
  ],
});

/* Abre a janela das tarefas de P1 com a LISTA.
   Devolve: o que o base() devolve, mais a camada da janela (L). */
function abrirP1() {
  const b = base();
  app.db.properties[0].tarefas = app.normTarefas(LISTA());
  app.tfAbrir('imovel', 'P1');
  return Object.assign(b, { L: b.abertas[0] });
}

/* Adiciona uma tarefa pelo formulário, como o dedo: abre, escreve, escolhe a
   secção e carrega no «Adicionar».
   Recebe: nome — o nome da tarefa; sid — a secção ('' para nenhuma). */
function adicionar(nome, sid) {
  app.tfNovaTarefa(sid);
  const el = elementos(app);
  el.tf_nome.value = nome;
  el.tf_sec.value = sid;
  app.tfGuardarTarefa();
}

/* Fechar no X perguntava? A mesma conta do componentes.js:closeModal: o
   «mexido» ligado e o retrato da camada diferente dos campos de agora.
   Recebe: L — a camada. Devolve: true se o X pergunta «Sair sem guardar?». */
const perguntaAoFechar = (L) => !!(L.tocado && L.snap != null && app.modalSnap(L.el) !== L.snap);

/* Uma cópia simples (de dentro da vm para cá), para comparar com o igual. */
const copia = (x) => JSON.parse(JSON.stringify(x));

/* O texto do botão da esquerda do rodapé, como o tfMarcarEstado o deixou. */
const botaoFechar = (L) => L.el.querySelector('#tf_fechar,[data-mid="tf_fechar"]').textContent;

describe('nada grava até ao Guardar', () => {
  test('quinze tarefas novas (uma numa secção criada no formulário) e três marcadas: zero save() antes, um só no Guardar', () => {
    const { saves, toasts, fechos } = abrirP1();
    // a primeira cria a secção «Chaves» no próprio formulário
    app.tfNovaTarefa('');
    const el = elementos(app);
    el.tf_nome.value = 'Tarefa 1';
    el.tf_sec.value = '__new__';
    app.tfSecMudou();
    el.pm_v.value = 'Chaves';
    app._pm();
    app.tfGuardarTarefa();
    for (let i = 2; i <= 15; i++) adicionar('Tarefa ' + i, i % 2 ? 'S1' : '');
    for (const k of ['K1', 'K3', 'K4']) app.tfMarcar(k, true);
    assert.equal(saves.n, 0, 'nem um save() até aqui');
    assert.equal(app.db.properties[0].tarefas.itens.length, 4, 'o registo está como estava');
    app.tfGuardar();
    assert.equal(saves.n, 1, 'um só save(), com tudo');
    const t = app.db.properties[0].tarefas;
    assert.equal(t.itens.length, 19);
    assert.deepEqual(t.seccoes.map((s) => s.nome), ['Obras', 'Documentos', 'Chaves']);
    assert.equal(t.itens.find((x) => x.nome === 'Tarefa 1').seccao, t.seccoes[2].id, 'a secção nova foi com a tarefa');
    igual(t.itens.filter((x) => x.feita).map((x) => x.id), ['K1', 'K2', 'K3', 'K4']);
    assert.equal(t.itens.find((x) => x.id === 'K1').feitaEm, HOJE);
    assert.equal(toasts.pop().m, 'Tarefas guardadas.');
    assert.equal(fechos.length, 17, 'o nome da secção, quinze formulários e a janela');
    assert.ok(fechos.every((o) => o === '(decisão)'), 'todos fecham como decisões, sem perguntar');
    assert.equal(app.tfRascunho, null, 'fechada a janela, o rascunho vai-se');
  });

  test('editar, remover, mover, as secções e o arrasto também não chamam o save()', () => {
    const { saves, toasts } = abrirP1();
    app.tfEditarTarefa('K4');
    elementos(app).tf_nome.value = 'Ligar à Ana às 18h';
    elementos(app).tf_sec.value = 'S2';
    app.tfGuardarTarefa();
    app.tfRemoverTarefa('K2');
    toasts.pop().op.fn();   // o Anular
    app.tfNovaSeccao();
    elementos(app).pm_v.value = 'Mudança';
    app._pm();
    app.tfMudarNomeSeccao('S1');
    elementos(app).pm_v.value = 'Obras na cozinha';
    app._pm();
    app.tfPegaClique('K3');
    elementos(app).tf_msec.value = 'S1';
    elementos(app).tf_mpos.value = '';
    app.tfGuardarMover();
    app.tfRemoverSeccao('S2');
    app.tfDobrar('S1');
    assert.equal(saves.n, 0);
    igual(app.db.properties[0].tarefas, copia(app.normTarefas(LISTA())), 'o registo não mexeu');
    igual(app.tfRascunho.seccoes.map((s) => s.nome), ['Obras na cozinha', 'Mudança']);
    igual(app.tfRascunho.itens.map((x) => x.seccao + ':' + x.id), ['S1:K3', 'S1:K1', 'S1:K2'], 'a K4 foi com a secção Documentos');
  });

  test('o arrasto muda a ordem só no rascunho', () => {
    const { saves } = abrirP1();
    const classes = () => ({ contains: () => false, remove() {}, add() {} });
    const row = { isConnected: true, style: {}, classList: classes(), getBoundingClientRect: () => ({ top: 0, height: 44 }) };
    const sec = { classList: classes() };
    app.tfArr = { tid: 'K4', h: {}, row, lista: { querySelectorAll: () => [], querySelector: () => null, classList: classes() },
      ativo: true, cancelado: false, desloc: 0, raf: 0, alvo: { sid: 'S2', depois: 'K3', cab: false, sec, antes: null } };
    app.tfArrastoFim();
    igual(app.tfRascunho.itens.map((x) => x.seccao + ':' + x.id), ['S1:K1', 'S1:K2', 'S2:K3', 'S2:K4']);
    igual(app.db.properties[0].tarefas.itens.map((x) => x.id), ['K1', 'K2', 'K3', 'K4']);
    assert.equal(saves.n, 0);
  });

  test('o rascunho é uma cópia: o que muda no registo com a janela aberta não entra nele, e o que muda nele não sai', () => {
    abrirP1();
    app.db.properties[0].tarefas.itens[0].nome = 'Mudado por baixo';
    assert.equal(app.tfRascunho.itens[0].nome, 'Pintar a sala');
    app.tfMarcar('K3', true);
    assert.equal(app.db.properties[0].tarefas.itens[2].feita, false);
  });
});

describe('o Guardar', () => {
  test('sem nada mudado, fecha sem gravar nem avisar; o rodapé diz «Fechar» e «Guardar»', () => {
    const { saves, toasts, fechos, L } = abrirP1();
    assert.match(L.f, />Fechar<\/button><button type="button" class="btn primary" data-toca="dados" data-click="tfGuardar\(\)">Guardar<\/button>$/);
    app.tfMarcar('K1', true);
    app.tfMarcar('K1', false);
    app.tfPesquisar('sala');
    assert.equal(app.tfGuardar(), true);
    assert.equal(saves.n, 0);
    assert.equal(toasts.length, 0);
    assert.deepEqual(fechos, ['(decisão)']);
  });

  test('sem permissão não há «Guardar» nem «Adicionar tarefa», e o Guardar de quem a perdeu a meio recusa sem gravar', () => {
    const { saves, toasts, L } = abrirP1();
    app.tfMarcar('K1', true);
    app.CW = { user: { id: 'eu' }, cargos: { P1: { dono: false, nome: 'Ver', perms: ['contract.view'] } }, pessoas: {} };
    assert.equal(app.tfGuardar(), false);
    assert.equal(saves.n, 0);
    assert.equal(app.db.properties[0].tarefas.itens[0].feita, false);
    assert.match(toasts.pop().m, /Não tens permissão/);
    assert.equal(app.modalStack.at(-1), L, 'a janela fica: o Cancelar deita o rascunho fora');
    // aberta já sem permissão: só «Fechar»
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    const so = app.modalStack.at(-1);
    assert.equal(so.f, '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>');
    assert.doesNotMatch(so.b, /tf-nova|tfNovaTarefa/);
  });

  test('com o registo apagado a meio, o Guardar avisa e fecha', () => {
    const { saves, toasts, fechos } = abrirP1();
    app.tfMarcar('K1', true);
    app.db.properties = [];
    assert.equal(app.tfGuardar(), false);
    assert.equal(saves.n, 0);
    assert.equal(toasts.pop().m, 'Este registo já não existe.');
    assert.deepEqual(fechos, ['(decisão)']);
  });

  test('marcar de novo uma que já estava cumprida devolve-lhe o dia de então: não é uma alteração', () => {
    const { L } = abrirP1();
    app.tfMarcar('K2', false);
    assert.equal(app.tfMudou(), true);
    app.tfMarcar('K2', true);
    assert.equal(app.tfRascunho.itens[1].feitaEm, '2026-10-01');
    assert.equal(app.tfMudou(), false);
    assert.equal(perguntaAoFechar(L), false);
  });
});

describe('fechar', () => {
  test('sem alterações fecha logo: pesquisar e filtrar não contam, e o botão diz «Fechar»', () => {
    const { fechos, L } = abrirP1();
    L.tocado = true;   // o dedo escreveu na pesquisa (o ouvinte do openModal)
    app.tfPesquisar('obras');
    assert.equal(perguntaAoFechar(L), false);
    assert.equal(botaoFechar(L), 'Fechar');
    app.tfFechar();
    assert.deepEqual(fechos, ['(decisão)'], 'fecha sem perguntar');
  });

  test('com alterações, o X e o Cancelar perguntam «Sair sem guardar?», e o botão diz «Cancelar»', () => {
    const { fechos, L } = abrirP1();
    app.tfMarcar('K1', true);
    assert.equal(perguntaAoFechar(L), true, 'o X, o véu, o Esc, o voltar e o arrasto perguntam');
    assert.equal(L.snap, app.TF_POR_GUARDAR);
    assert.equal(botaoFechar(L), 'Cancelar');
    assert.match(app.tfLista(), /<b class="tf-por-guardar">Alterações por guardar<\/b>/);
    app.tfPesquisar('sala');   // pesquisar não apaga a marca
    assert.equal(perguntaAoFechar(L), true);
    app.tfFechar();
    assert.deepEqual(fechos, ['cancelar'], 'o Cancelar passa pela pergunta, como um abandono');
    // desfeita a alteração, deixa de perguntar
    app.tfAbrir('imovel', 'P1');
    const M = app.modalStack.at(-1);
    app.tfMarcar('K1', true);
    app.tfMarcar('K1', false);
    assert.equal(perguntaAoFechar(M), false);
    assert.equal(botaoFechar(M), 'Fechar');
    assert.doesNotMatch(app.tfLista(), /tf-por-guardar/);
  });

  test('sair sem guardar deita o rascunho fora: o registo fica, e abrir de novo parte dele', () => {
    const { saves } = abrirP1();
    adicionar('Rever o contador', 'S1');
    app.tfRemoverSeccao('S2');
    app.closeModal('x');   // o «Sair sem guardar» fecha a janela
    assert.equal(app.tfRascunho, null);
    assert.equal(saves.n, 0);
    igual(app.db.properties[0].tarefas, copia(app.normTarefas(LISTA())));
    app.tfAbrir('imovel', 'P1');
    igual(app.tfRascunho, copia(app.normTarefas(LISTA())));
    assert.equal(app.tfMudou(), false);
  });

  test('o Anular de uma remoção só vale na janela onde se removeu, e sai do ecrã quando ela fecha', () => {
    const { toasts } = abrirP1();
    app.tfRemoverTarefa('K1');
    const aviso = toasts.pop();
    const ecra = elementos(app).toast;
    const tirado = [];
    ecra._op = aviso.op;
    ecra.classList = { remove: (c) => tirado.push(c), add() {}, toggle() {}, contains: () => false };
    app.closeModal('x');
    assert.deepEqual(tirado, ['on'], 'o aviso sai com a janela');
    app.tfAbrir('imovel', 'P1');
    aviso.op.fn();
    igual(app.tfRascunho.itens.map((x) => x.id), ['K1', 'K2', 'K3', 'K4'], 'a janela nova parte do registo');
    assert.equal(app.tfMudou(), false, 'e o Anular velho não lhe mexe');
  });
});

describe('a leitura de fundo', () => {
  test('o pullNow não lê com uma janela aberta (o rascunho não é pisado), e lê sem nenhuma', async () => {
    const n = carregarTudo({ hoje: HOJE });
    const pedidos = [];
    n.fetch = (url) => { pedidos.push(String(url)); return Promise.reject(new Error('sem rede')); };
    n.toast = () => {};
    n.setSyncBadge = () => {};
    n.render = () => {};
    n.buildNav = () => {};
    n.reportErr = () => {};
    n.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt' };
    n.modalStack.push({ el: {}, title: 'Tarefas · T2 Lisboa' });
    await n.pullNow();
    assert.deepEqual(pedidos, [], 'com a janela aberta não pede o estado');
    n.modalStack.length = 0;
    await n.pullNow();
    assert.ok(pedidos.some((u) => u.indexOf('/api/state') > -1), 'sem janelas, lê');
    repor(n);
  });
});
