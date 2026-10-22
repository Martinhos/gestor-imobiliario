// As tarefas de um imóvel ou de um contrato (web/app/tarefas.js): ao adicionar
// uma tarefa escolhe-se a secção, ou cria-se uma ali mesmo, que se grava com
// a tarefa; as secções recolhem-se e o que fica recolhido é do aparelho; e as
// tarefas mudam de lugar pela ordem do array — para o 1.º lugar de uma
// secção, entre duas tarefas, entre secções e para «Sem secção» —, pela pega
// ou pelo «Mover tarefa». Quem não pode alterar não tem pega.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, elementos, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const HOJE = '2026-10-20';
const app = carregarApp({ hoje: HOJE });
afterEach(() => repor(app));

/* Uma base com um imóvel e um contrato nele, as janelas numa pilha
   observável, os toasts guardados e o aparelho sem secções recolhidas.
   Devolve: {abertas, toasts}. */
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] }),
    app.normProp({ id: 'P2', name: 'T1 Porto', use: 'investimento', ownerIds: ['O1'] })];
  app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 600, start: '2026-01-01' })];
  const abertas = janelasFalsas(app, 'render', 'buildNav', 'save', 'paintThumbs', 'setModal');
  const toasts = [];
  app.toast = (m, op) => { toasts.push({ m, op }); };
  app.localStorage.clear();
  app._tfRec = null;
  app.tfArrFim = 0;
  return { abertas, toasts };
}

/* Duas secções, cinco tarefas: duas em Obras, duas em Documentos e uma solta.
   Devolve: as tarefas em bruto. */
const LISTA = () => ({
  seccoes: [{ id: 'S1', nome: 'Obras' }, { id: 'S2', nome: 'Documentos' }],
  itens: [
    { id: 'K1', nome: 'Pintar a sala', seccao: 'S1', feita: false },
    { id: 'K2', nome: 'Trocar o esquentador', seccao: 'S1', feita: true, feitaEm: '2026-10-01' },
    { id: 'K3', nome: 'Pedir o certificado energético', seccao: 'S2', feita: false },
    { id: 'K4', nome: 'Ligar à Ana', seccao: '', feita: false },
    { id: 'K5', nome: 'Entregar a caderneta', seccao: 'S2', feita: false },
  ],
});

/* As tarefas do imóvel P1 como «secção:id», pela ordem do array.
   Devolve: array de texto. */
const ordem = () => app.db.properties[0].tarefas.itens.map((x) => (x.seccao || '-') + ':' + x.id);
/* A mesma leitura sobre uma lista qualquer.
   Recebe: t — as tarefas. Devolve: array de texto. */
const ordemDe = (t) => t.itens.map((x) => (x.seccao || '-') + ':' + x.id);
/* As opções de um sel() já desenhado, pelos rótulos.
   Recebe: id — o id do sel(). Devolve: array de rótulos. */
const rotulos = (id) => JSON.parse(JSON.stringify(app.window.__sel[id].options.map((o) => o.label)));

/* Abre a janela das tarefas de P1 com a LISTA.
   Devolve: o que o base() devolve. */
function abrirP1() {
  const b = base();
  app.db.properties[0].tarefas = app.normTarefas(LISTA());
  app.tfAbrir('imovel', 'P1');
  return b;
}

describe('o seletor da secção no formulário', () => {
  test('está sempre lá, mesmo sem secções: «Sem secção» primeiro e «+ Criar secção…» no fim', () => {
    const { abertas } = base();
    app.tfAbrir('imovel', 'P1');
    app.tfNovaTarefa('');
    const form = abertas[abertas.length - 1];
    assert.equal(form.t, 'Nova tarefa');
    assert.match(form.b, /<label>Secção<div class="sel" id="sel_tf_sec">/);
    assert.doesNotMatch(form.b, /adiciona uma no ⋯/, 'a dica de ir ao ⋯ saiu');
    igual(rotulos('tf_sec'), ['Sem secção', '+ Criar secção…']);
    assert.match(app.tfLista(), /ao adicioná-la, escolhes a secção ou crias uma nova/);
  });

  test('com secções, mostra-as pela ordem e vem com a secção de onde se pediu', () => {
    const { abertas } = abrirP1();
    app.tfNovaTarefa('S2');
    igual(rotulos('tf_sec'), ['Sem secção', 'Obras', 'Documentos', '+ Criar secção…']);
    assert.match(abertas[abertas.length - 1].b, /<input type="hidden" id="tf_sec" value="S2">/);
    app.tfNovaTarefa('S9');
    assert.match(abertas[abertas.length - 1].b, /<input type="hidden" id="tf_sec" value="">/, 'uma secção que não existe não fica escolhida');
  });

  test('«+ Criar secção…» pede o nome, deixa a secção nova escolhida, e ela grava-se com a tarefa', () => {
    const { abertas, toasts } = abrirP1();
    app.tfNovaTarefa('');
    const el = elementos(app);
    el.tf_nome.value = 'Mudar a fechadura';
    el.tf_sec.value = '__new__';
    app.tfSecMudou();
    const nome = abertas[abertas.length - 1];
    assert.equal(nome.t, 'Nova secção');
    assert.match(nome.b, /Nome da secção <span class="req">\*<\/span>/);
    assert.match(nome.b, /placeholder="Ex: Obras"/);
    el.pm_v.value = 'Chaves';
    app._pm();
    const nova = el.tf_sec.value;
    assert.ok(nova && nova !== '__new__', 'a secção nova fica escolhida');
    igual(rotulos('tf_sec'), ['Sem secção', 'Obras', 'Documentos', 'Chaves', '+ Criar secção…']);
    assert.equal(app.db.properties[0].tarefas.seccoes.length, 2, 'ainda nada gravado');
    assert.equal(el.tf_nome.value, 'Mudar a fechadura', 'o nome escrito fica');
    app.tfGuardarTarefa();
    const t = app.db.properties[0].tarefas;
    igual(t.seccoes.map((s) => s.nome), ['Obras', 'Documentos', 'Chaves']);
    const k = t.itens[t.itens.length - 1];
    assert.equal(k.nome, 'Mudar a fechadura');
    assert.equal(k.seccao, nova);
    assert.equal(toasts.pop().m, 'Tarefa adicionada.');
  });

  test('cancelar o nome devolve a escolha de antes, e cancelar a tarefa não deixa a secção para trás', () => {
    abrirP1();
    app.tfNovaTarefa('S1');
    const el = elementos(app);
    el.tf_sec.value = '__new__';
    app.tfSecMudou();
    assert.equal(el.tf_sec.value, 'S1', 'o «+ Criar secção…» não fica escolhido');
    app.closeModal();   // o Cancelar do nome
    el.tf_sec.value = '__new__';
    app.tfSecMudou();
    el.pm_v.value = 'Jardim';
    app._pm();
    app.closeModal();   // o Cancelar da tarefa
    app.tfNovaTarefa('');
    igual(rotulos('tf_sec'), ['Sem secção', 'Obras', 'Documentos', '+ Criar secção…'], 'a secção do formulário cancelado não aparece');
    assert.equal(app.db.properties[0].tarefas.seccoes.length, 2);
  });

  test('um nome que já existe, sem olhar a acentos nem maiúsculas, escolhe essa secção sem a repetir', () => {
    const { toasts } = abrirP1();
    app.tfNovaTarefa('');
    const el = elementos(app);
    el.tf_sec.value = '__new__';
    app.tfSecMudou();
    el.pm_v.value = 'DOCUMENTOS';
    app._pm();
    assert.equal(el.tf_sec.value, 'S2');
    assert.equal(toasts.pop().m, 'A secção «Documentos» já existe: fica escolhida.');
    igual(rotulos('tf_sec'), ['Sem secção', 'Obras', 'Documentos', '+ Criar secção…']);
  });

  test('editar e mudar de secção leva a tarefa para o fim da nova', () => {
    abrirP1();
    app.tfEditarTarefa('K1');
    elementos(app).tf_nome.value = 'Pintar a sala';
    elementos(app).tf_sec.value = 'S2';
    app.tfGuardarTarefa();
    igual(ordem(), ['S1:K2', 'S2:K3', '-:K4', 'S2:K5', 'S2:K1']);
    app.tfEditarTarefa('K1');
    elementos(app).tf_sec.value = 'S2';
    elementos(app).tf_nome.value = 'Pintar a sala de branco';
    app.tfGuardarTarefa();
    igual(ordem(), ['S1:K2', 'S2:K3', '-:K4', 'S2:K5', 'S2:K1'], 'sem mudar de secção, fica onde está');
  });
});

describe('as secções recolhem-se', () => {
  test('sem nada guardado está tudo aberto, e o cabeçalho é um botão que recolhe', () => {
    abrirP1();
    const html = app.tfLista();
    assert.doesNotMatch(html, /tf-recolhida/);
    const cabs = [...html.matchAll(/<button type="button" class="tf-dobra" aria-expanded="(true|false)" aria-controls="(tfi_[^"]+)" data-toca="nada" data-click="tfDobrar\('([^']*)'\)">/g)];
    igual(cabs.map((m) => m[1] + ' ' + m[2] + ' ' + m[3]), ['true tfi__sem ', 'true tfi_S1 S1', 'true tfi_S2 S2']);
    assert.match(html, /<div class="tf-itens" id="tfi_S1">/, 'o aria-controls aponta para as tarefas');
    assert.match(html, /<b>Obras<\/b><span class="tf-conta">1 de 2<span class="imv-so-leitor"> cumpridas<\/span><\/span>/);
  });

  test('recolher guarda no aparelho, por registo e por secção, e abrir de novo tira', () => {
    abrirP1();
    app.tfDobrar('S1');
    app.tfDobrar('');
    assert.deepEqual(JSON.parse(app.localStorage.getItem('gi_tf_recolhidas')), { 'imovel:P1': ['S1', '__sem__'] });
    const html = app.tfLista();
    assert.match(html, /<div class="tf-seccao tf-recolhida" data-sec="S1">/);
    assert.match(html, /<div class="tf-seccao tf-recolhida" data-sec="">/);
    assert.match(html, /aria-expanded="false" aria-controls="tfi_S1"/);
    assert.match(html, /<div class="tf-seccao" data-sec="S2">/);
    assert.match(html, /Pintar a sala/, 'recolhida, a tarefa continua no HTML — quem a esconde é a folha');
    app.tfDobrar('S1');
    assert.deepEqual(JSON.parse(app.localStorage.getItem('gi_tf_recolhidas')), { 'imovel:P1': ['__sem__'] });
    app.tfDobrar('');
    assert.deepEqual(JSON.parse(app.localStorage.getItem('gi_tf_recolhidas')), {}, 'sem nada recolhido a chave do registo sai');
  });

  test('outro registo tem as suas, e uma secção que já não existe sai do aparelho', () => {
    abrirP1();
    app.tfDobrar('S1');
    app.db.properties[1].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P2');
    assert.doesNotMatch(app.tfLista(), /tf-recolhida/, 'o P2 está todo aberto');
    app.localStorage.setItem('gi_tf_recolhidas', JSON.stringify({ 'imovel:P1': ['S1', 'S9', 7] }));
    app._tfRec = null;
    app.tfAbrir('imovel', 'P1');
    app.tfDobrar('S2');
    assert.deepEqual(JSON.parse(app.localStorage.getItem('gi_tf_recolhidas')), { 'imovel:P1': ['S1', 'S2'] });
  });

  test('com o aparelho fechado ou com lixo guardado, está tudo aberto e o toque vale na mesma', () => {
    const lixo = carregarApp({ hoje: HOJE, antes: (j) => { j.localStorage.setItem('gi_tf_recolhidas', '[1,2]'); } });
    lixo.db.properties = [lixo.normProp({ id: 'P1', name: 'X', tarefas: LISTA() })];
    janelasFalsas(lixo, 'render', 'save');
    lixo.tfAbrir('imovel', 'P1');
    assert.doesNotMatch(lixo.tfLista(), /tf-recolhida/);
    const fechado = carregarApp({ hoje: HOJE, antes: (j) => {
      j.localStorage.getItem = () => { throw new Error('fechado'); };
      j.localStorage.setItem = () => { throw new Error('cheio'); };
    } });
    fechado.db.properties = [fechado.normProp({ id: 'P1', name: 'X', tarefas: LISTA() })];
    janelasFalsas(fechado, 'render', 'save');
    fechado.tfAbrir('imovel', 'P1');
    assert.doesNotMatch(fechado.tfLista(), /tf-recolhida/);
    fechado.tfDobrar('S2');
    assert.match(fechado.tfLista(), /<div class="tf-seccao tf-recolhida" data-sec="S2">/, 'fica em memória');
  });
});

describe('mover: a regra', () => {
  test('para o 1.º lugar de uma secção, sem mexer na lista que recebe', () => {
    base();
    const t = app.normTarefas(LISTA());
    const n = app.tfMoverEm(t, 'K5', 'S2', '');
    igual(ordemDe(n), ['S1:K1', 'S1:K2', 'S2:K5', 'S2:K3', '-:K4']);
    igual(ordemDe(t), ['S1:K1', 'S1:K2', 'S2:K3', '-:K4', 'S2:K5'], 'a original fica');
    igual(ordemDe(app.tfMoverEm(t, 'K1', 'S2', '')), ['S1:K2', 'S2:K1', 'S2:K3', '-:K4', 'S2:K5'], 'vinda de outra secção');
  });

  test('entre x e y na mesma secção, a descer e a subir', () => {
    base();
    const t = app.normTarefas(LISTA());
    t.itens.push({ id: 'K6', nome: 'Rever o contador', seccao: 'S1', feita: false, feitaEm: '' });
    igual(ordemDe(app.tfMoverEm(t, 'K1', 'S1', 'K2')), ['S1:K2', 'S1:K1', 'S2:K3', '-:K4', 'S2:K5', 'S1:K6'], 'entre K2 e K6');
    igual(ordemDe(app.tfMoverEm(t, 'K6', 'S1', 'K1')), ['S1:K1', 'S1:K6', 'S1:K2', 'S2:K3', '-:K4', 'S2:K5'], 'entre K1 e K2');
  });

  test('entre secções: muda a secção e fica entre as duas', () => {
    base();
    const t = app.normTarefas(LISTA());
    const n = app.tfMoverEm(t, 'K1', 'S2', 'K3');
    igual(ordemDe(n), ['S1:K2', 'S2:K3', 'S2:K1', '-:K4', 'S2:K5']);
    const s2 = n.itens.filter((x) => x.seccao === 'S2').map((x) => x.id);
    igual(s2, ['K3', 'K1', 'K5'], 'na secção, entre K3 e K5');
  });

  test('para «Sem secção»: em 1.º lugar, depois de uma solta, e numa lista sem soltas', () => {
    base();
    const t = app.normTarefas(LISTA());
    igual(ordemDe(app.tfMoverEm(t, 'K3', '', '')), ['S1:K1', 'S1:K2', '-:K3', '-:K4', 'S2:K5']);
    igual(ordemDe(app.tfMoverEm(t, 'K3', '', 'K4')), ['S1:K1', 'S1:K2', '-:K4', '-:K3', 'S2:K5']);
    const sem = app.normTarefas(LISTA());
    sem.itens = sem.itens.filter((x) => x.seccao);
    igual(ordemDe(app.tfMoverEm(sem, 'K2', '', '')), ['S1:K1', 'S2:K3', 'S2:K5', '-:K2'], 'sem soltas, fica no fim do array');
  });

  test('o que não bate certo não estraga nada: tarefa ou secção desconhecida, o «depois» que mudou de sítio', () => {
    base();
    const t = app.normTarefas(LISTA());
    igual(ordemDe(app.tfMoverEm(t, 'K9', 'S1', '')), ordemDe(t), 'tarefa que não existe');
    igual(ordemDe(app.tfMoverEm(t, 'K1', 'S1', 'K1')), ordemDe(t), 'depois de si própria');
    igual(ordemDe(app.tfMoverEm(t, 'K3', 'S9', '')), ['S1:K1', 'S1:K2', '-:K3', '-:K4', 'S2:K5'], 'secção que não existe vale «Sem secção»');
    igual(ordemDe(app.tfMoverEm(t, 'K4', 'S1', 'K3')), ['S1:K1', 'S1:K2', 'S1:K4', 'S2:K3', 'S2:K5'], 'um «depois» de outra secção põe-na no fim');
  });
});

describe('a pega e o «Mover tarefa»', () => {
  test('quem pode tem uma pega por tarefa, que arrasta e abre o «Mover tarefa»; quem não pode não tem', () => {
    abrirP1();
    const html = app.tfLista();
    const pegas = [...html.matchAll(/<button type="button" class="tf-pega" aria-label="Mover: ([^"]*)" data-toca="camada" data-pointerdown="tfArrastar\(event,this\)" data-click="tfPegaClique\('(K\d)'\)">/g)];
    igual(pegas.map((m) => m[2]), ['K4', 'K1', 'K2', 'K3', 'K5']);
    assert.equal(pegas[0][1], 'Ligar à Ana');
    assert.match(html, /<div class="tf-item" data-id="K4"><button type="button" class="tf-pega"/, 'a pega é a primeira coisa da linha');
    app.CW = { user: { id: 'eu' }, cargos: { P1: { dono: false, nome: 'Ver', perms: ['contract.view'] } }, pessoas: {} };
    const so = app.tfLista();
    assert.doesNotMatch(so, /tf-pega|tfArrastar|tf-so-alvo/);
  });

  test('o lugar para largar sem secção só existe com secções, sem soltas à vista, e para quem pode', () => {
    abrirP1();
    assert.doesNotMatch(app.tfLista(), /tf-so-alvo/, 'há uma solta: o grupo dela já é o alvo');
    app.db.properties[0].tarefas.itens = app.db.properties[0].tarefas.itens.filter((x) => x.seccao);
    assert.match(app.tfLista(), /<div class="tf-seccao tf-so-alvo" data-sec=""><div class="tf-cab" data-sec="">[\s\S]*Larga aqui para a tarefa ficar sem secção\./);
    app.db.properties[0].tarefas.seccoes = [];
    app.db.properties[0].tarefas.itens = [];
    assert.doesNotMatch(app.tfLista(), /tf-so-alvo/, 'sem secções não há para onde');
  });

  test('o «Mover tarefa» abre com o lugar de agora, a secção nova traz as posições dela, e guardar grava', () => {
    const { abertas, toasts } = abrirP1();
    app.tfPegaClique('K5');
    const j = abertas[abertas.length - 1];
    assert.equal(j.t, 'Mover tarefa');
    assert.match(j.b, /<input type="hidden" id="tf_msec" value="S2">/);
    assert.match(j.b, /<input type="hidden" id="tf_mpos" value="K3">/, 'depois de K3, onde está');
    igual(rotulos('tf_mpos'), ['Em primeiro lugar', 'Depois de «Pedir o certificado energético»']);
    const el = elementos(app);
    el.tf_msec.value = 'S1';
    app.tfMoverSecMudou();
    igual(rotulos('tf_mpos'), ['Em primeiro lugar', 'Depois de «Pintar a sala»', 'Depois de «Trocar o esquentador»']);
    assert.equal(el.tf_mpos.value, 'K2', 'noutra secção, o fim');
    el.tf_mpos.value = 'K1';
    app.tfGuardarMover();
    igual(ordem(), ['S1:K1', 'S1:K5', 'S1:K2', 'S2:K3', '-:K4']);
    assert.equal(toasts.pop().m, 'Tarefa movida.');
  });

  test('o toque que o browser dispara logo a seguir a largar não abre o «Mover tarefa»', () => {
    const { abertas } = abrirP1();
    const antes = abertas.length;
    app.tfArrFim = Infinity;
    app.tfPegaClique('K1');
    assert.equal(abertas.length, antes);
    app.tfArrFim = 0;
    app.tfPegaClique('K1');
    assert.equal(abertas.length, antes + 1);
  });
});

/* Um elemento falso com uma caixa no ecrã, para o alvo do arrasto medir.
   Recebe: top, h — o topo e a altura; o — {id, sec, recolhida, cab, linhas}.
   Devolve: o elemento. */
function caixa(top, h, o = {}) {
  const classes = new Set(o.recolhida ? ['tf-recolhida'] : []);
  return {
    getBoundingClientRect: () => ({ top, bottom: top + h, height: h, left: 0, right: 300, width: 300 }),
    getClientRects: () => [1],
    getAttribute: (n) => (n === 'data-id' ? o.id : n === 'data-sec' ? o.sec : null),
    classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    querySelector: (s) => (s === '.tf-cab' ? o.cab || null : null),
    querySelectorAll: (s) => (s === '.tf-item' ? o.linhas || [] : []),
  };
}

describe('o alvo do arrasto', () => {
  /* Três grupos no ecrã, com a tarefa K4 agarrada: as soltas (o cabeçalho de
     0 a 44 e a K4), Obras aberta com K1 e K2, e Documentos recolhida.
     Devolve: {obras, docs, k1, k2, soltas}. */
  function ecra() {
    const k4 = caixa(44, 44, { id: 'K4' });
    const soltas = caixa(0, 88, { sec: '', cab: caixa(0, 44), linhas: [k4] });
    const k1 = caixa(144, 44, { id: 'K1' }), k2 = caixa(188, 44, { id: 'K2' });
    const obras = caixa(100, 132, { sec: 'S1', cab: caixa(100, 44), linhas: [k1, k2] });
    const docs = caixa(240, 44, { sec: 'S2', cab: caixa(240, 44), recolhida: true });
    const lista = { querySelectorAll: (s) => (s === '.tf-seccao' ? [soltas, obras, docs] : []) };
    app.tfArr = { lista, row: k4 };
    return { obras, docs, k1, k2, soltas };
  }

  test('por cima do nome de uma secção é o 1.º lugar dela, e a secção inteira acende', () => {
    base();
    const { obras } = ecra();
    const a = app.tfArrastoAlvo(120);
    assert.equal(a.cab, true);
    assert.equal(a.sid, 'S1');
    assert.equal(a.depois, '');
    assert.equal(a.sec, obras);
  });

  test('entre duas tarefas é a linha entre elas; recolhida ou sem outras, é o 1.º lugar', () => {
    base();
    const { k2 } = ecra();
    const entre = app.tfArrastoAlvo(180);
    assert.equal(entre.cab, false);
    assert.equal(entre.depois, 'K1');
    assert.equal(entre.antes, k2, 'a linha fica antes de K2');
    const fim = app.tfArrastoAlvo(225);
    assert.equal(fim.depois, 'K2');
    assert.equal(fim.antes, null, 'no fim da secção');
    const primeiro = app.tfArrastoAlvo(150);
    assert.equal(primeiro.depois, '');
    const rec = app.tfArrastoAlvo(275);
    assert.equal(rec.sid, 'S2');
    assert.equal(rec.cab, true, 'recolhida, a secção acende');
    const so = app.tfArrastoAlvo(70);
    assert.equal(so.sid, '');
    assert.equal(so.cab, true, 'a própria tarefa não conta: sem outras soltas é o 1.º lugar');
    assert.equal(app.tfArrastoAlvo(400).sid, 'S2', 'abaixo de tudo, a secção mais perto');
  });

  test('largar grava a ordem nova, e largar numa secção recolhida diz para onde foi', () => {
    const { toasts } = abrirP1();
    const { docs } = ecra();
    const lista = app.tfArr.lista;
    lista.querySelector = () => null;
    const row = app.tfArr.row;
    row.style = {};
    Object.assign(app.tfArr, { tid: 'K4', h: {}, ativo: true, cancelado: false, desloc: 0, raf: 0,
      alvo: { sid: 'S2', depois: '', cab: true, sec: docs, antes: null } });
    row.isConnected = true;
    lista.classList = { remove() {} };
    app.tfArrastoFim();
    igual(ordem(), ['S1:K1', 'S1:K2', 'S2:K4', 'S2:K3', 'S2:K5']);
    assert.equal(toasts.pop().m, 'Tarefa movida para «Documentos».');
    assert.equal(app.tfArr, null, 'o arrasto acabou');
    assert.ok(app.tfArrFim > 0, 'o clique a seguir engole-se');
  });
});
