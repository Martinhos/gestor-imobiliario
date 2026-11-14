// As secções das tarefas como pastas (web/app/tarefas.js, KAN-136): uma secção
// pode estar dentro de outra (pai), a qualquer profundidade; o caminho com «/»
// cria as que faltam, no «+ Criar secção…», no «Adicionar secção» e no «Mudar
// o nome» (que muda a secção de sítio); o «Mover secção» e o arrasto pela pega
// do cabeçalho mudam-na de sítio; a lista é uma árvore, com a conta somada, o
// filtro e a remoção a levarem o que está dentro. E, a arrastar, parar 600 ms
// no nome de uma secção recolhida abre-a (KAN-135).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, elementos, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp({ hoje: '2026-11-14' });
afterEach(() => repor(app));

/* Uma base com um imóvel, as janelas numa pilha observável e os toasts guardados.
   Devolve: {abertas, toasts}. */
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] })];
  const abertas = janelasFalsas(app, 'render', 'buildNav', 'save', 'paintThumbs', 'setModal');
  const toasts = [];
  app.toast = (m, op) => { toasts.push({ m, op }); };
  app.localStorage.clear();
  app._tfRec = null;
  app.tfArrFim = 0;
  return { abertas, toasts };
}

/* Obras (S1) com a Cozinha (S3) dentro, e Documentos (S2) no topo; seis tarefas.
   Devolve: as tarefas em bruto. */
const ARVORE = () => ({
  seccoes: [{ id: 'S1', nome: 'Obras' }, { id: 'S2', nome: 'Documentos' }, { id: 'S3', nome: 'Cozinha', pai: 'S1' }],
  itens: [
    { id: 'K1', nome: 'Pintar a sala', seccao: 'S1', feita: false },
    { id: 'K2', nome: 'Trocar o esquentador', seccao: 'S1', feita: true, feitaEm: '2026-10-01' },
    { id: 'K3', nome: 'Pedir o certificado', seccao: 'S2', feita: false },
    { id: 'K4', nome: 'Ligar à Ana', seccao: '', feita: false },
    { id: 'K6', nome: 'Bancada nova', seccao: 'S3', feita: false },
    { id: 'K7', nome: 'Torneira', seccao: 'S3', feita: true, feitaEm: '2026-10-02' },
  ],
});

/* Abre a janela das tarefas de P1 com a ARVORE.
   Devolve: o que o base() devolve. */
function abrir() {
  const b = base();
  app.db.properties[0].tarefas = app.normTarefas(ARVORE());
  app.tfAbrir('imovel', 'P1');
  return b;
}
/* As secções do rascunho como «id<pai», pela ordem do array.
   Devolve: array de texto. */
const secs = (t = app.tfRascunho) => t.seccoes.map((s) => s.id + '<' + (s.pai || '-'));
/* As opções de um sel() já desenhado, pelos rótulos.
   Recebe: id — o id do sel(). Devolve: array de rótulos. */
const rotulos = (id) => JSON.parse(JSON.stringify(app.window.__sel[id].options.map((o) => o.label)));
/* O id da secção do rascunho com este nome. Recebe: nome. Devolve: o id. */
const idDe = (nome) => app.tfRascunho.seccoes.find((s) => s.nome === nome).id;

describe('o modelo: a mãe de cada secção', () => {
  test('o normTarefas guarda a mãe que existe, e manda para o topo a que não existe, a própria e a que fecha um ciclo', () => {
    const t = app.normTarefas({ seccoes: [
      { id: 'A', nome: 'A', pai: 'B' }, { id: 'B', nome: 'B', pai: 'A' },
      { id: 'C', nome: 'C', pai: 'C' }, { id: 'D', nome: 'D', pai: 'X9' }, { id: 'E', nome: 'E', pai: 'B' }, { id: 'F', nome: 'F' },
    ], itens: [] });
    igual(secs(t), ['A<-', 'B<A', 'C<-', 'D<-', 'E<B', 'F<-'], 'o ciclo A↔B desfaz-se na primeira; E fica dentro de B');
    igual(app.normTarefas({ seccoes: [{ id: 'S1', nome: 'X' }] }).seccoes, [{ id: 'S1', nome: 'X', pai: '' }], 'uma secção antiga, sem pai, fica no topo');
  });

  test('a árvore, o ramo e o caminho', () => {
    const t = app.normTarefas(ARVORE());
    igual(app.tfArvore(t).map((o) => o.s.id + ':' + o.nivel), ['S1:0', 'S3:1', 'S2:0']);
    igual(app.tfRamo(t, 'S1'), ['S1', 'S3']);
    igual(app.tfRamo(t, 'S9'), []);
    assert.equal(app.tfCaminhoTexto(t, 'S3'), 'Obras / Cozinha');
    assert.equal(app.tfCaminhoTexto(t, 'S3', true), 'Obras/Cozinha');
    igual(app.tfPartes(' Obras //Cozinha/ '), ['Obras', 'Cozinha']);
  });

  test('o caminho resolve-se a partir do topo: reaproveita o que existe (sem acentos nem maiúsculas) e cria o que falta', () => {
    const t = app.normTarefas(ARVORE());
    const r = app.tfResolverCaminho(t.seccoes, ['OBRAS', 'cozinha', 'Elétrica', 'Tomadas']);
    assert.equal(r.ja, false);
    igual(r.novas.map((s) => s.nome), ['Elétrica', 'Tomadas']);
    assert.equal(r.novas[0].pai, 'S3');
    assert.equal(r.novas[1].pai, r.novas[0].id);
    assert.equal(r.id, r.novas[1].id);
    const ja = app.tfResolverCaminho(t.seccoes, ['Obras', 'Cozinha']);
    assert.equal(ja.ja, true);
    assert.equal(ja.id, 'S3');
    const noTopo = app.tfResolverCaminho(t.seccoes, ['Cozinha']);
    assert.equal(noTopo.novas.length, 1, 'uma Cozinha no topo é outra secção');
    assert.equal(noTopo.novas[0].pai, '');
    assert.equal(t.seccoes.length, 3, 'não mexe na lista que recebe');
  });

  test('mover uma secção: para dentro de outra, entre irmãs, para o topo; nunca para dentro dela própria', () => {
    const t = app.normTarefas(ARVORE());
    igual(secs(app.tfMoverSeccaoEm(t, 'S2', 'S1', '')), ['S1<-', 'S2<S1', 'S3<S1'], 'em 1.º lugar dentro de Obras');
    igual(secs(app.tfMoverSeccaoEm(t, 'S2', 'S1', 'S3')), ['S1<-', 'S3<S1', 'S2<S1'], 'depois da Cozinha');
    igual(secs(app.tfMoverSeccaoEm(t, 'S3', '', 'S1')), ['S1<-', 'S3<-', 'S2<-'], 'para o topo, entre Obras e Documentos');
    igual(secs(app.tfMoverSeccaoEm(t, 'S3', '', '')), ['S3<-', 'S1<-', 'S2<-'], 'para o topo, em 1.º lugar');
    igual(secs(app.tfMoverSeccaoEm(t, 'S1', 'S3', '')), secs(t), 'dentro de uma das de dentro: nada muda');
    igual(secs(app.tfMoverSeccaoEm(t, 'S1', 'S1', '')), secs(t), 'dentro dela própria: nada muda');
    igual(secs(app.tfMoverSeccaoEm(t, 'S2', 'S9', '')), ['S2<-', 'S1<-', 'S3<S1'], 'uma mãe que não existe vale o topo');
    igual(secs(t), ['S1<-', 'S2<-', 'S3<S1'], 'não mexe na lista que recebe');
  });
});

describe('a lista em árvore', () => {
  test('a Cozinha vem dentro de Obras, recuada, e a conta de Obras soma as dela', () => {
    abrir();
    const html = app.tfLista();
    assert.match(html, /<div class="tf-seccao tf-n0" data-sec="S1">.*<div class="tf-filhas"><div class="tf-seccao tf-n1" data-sec="S3">/s);
    assert.match(html, /<b>Obras<\/b><span class="tf-conta">2 de 4<span class="imv-so-leitor"> cumpridas/, '2 de Obras e 2 da Cozinha');
    assert.match(html, /<b>Cozinha<\/b><span class="tf-conta">1 de 2</);
    assert.ok(html.indexOf('data-sec="S3"') < html.indexOf('data-sec="S2"'), 'Documentos vem depois de tudo o que Obras tem');
    assert.match(html, /aria-label="Mover a secção: Cozinha" data-toca="camada" data-pointerdown="tfArrastarSeccao\(event,this\)" data-click="tfPegaSecClique\('S3'\)"/);
    assert.match(html, /tfMoverSeccao\('S1'\)/, 'o ⋯ tem o «Mover secção»');
  });

  test('uma mãe sem tarefas dela mas com secções dentro não diz «Sem tarefas nesta secção.»', () => {
    abrir();
    app.tfRascunho.itens = app.tfRascunho.itens.filter((x) => x.seccao !== 'S1');
    const html = app.tfLista();
    const obras = html.slice(html.indexOf('data-sec="S1"'), html.indexOf('data-sec="S3"'));
    assert.doesNotMatch(obras, /Sem tarefas nesta secção/);
  });

  test('o recuo deixa de crescer no 4.º nível', () => {
    abrir();
    app.tfRascunho.seccoes.push({ id: 'N1', nome: 'a', pai: 'S3' }, { id: 'N2', nome: 'b', pai: 'N1' }, { id: 'N3', nome: 'c', pai: 'N2' }, { id: 'N4', nome: 'd', pai: 'N3' });
    const html = app.tfLista();
    assert.match(html, /tf-n3" data-sec="N2"/);
    assert.match(html, /tf-n4" data-sec="N3"/);
    assert.match(html, /tf-n4" data-sec="N4"/);
  });

  test('o filtro de Obras mostra a Cozinha, e a pesquisa procura no caminho', () => {
    abrir();
    app.tfFiltro.seccao = 'S1';
    let html = app.tfLista();
    assert.match(html, /Bancada nova/);
    assert.doesNotMatch(html, /Pedir o certificado/);
    app.tfFiltro.seccao = '';
    app.tfFiltro.q = 'obras';
    html = app.tfLista();
    assert.match(html, /Torneira/, 'a Torneira está em Obras / Cozinha');
    assert.doesNotMatch(html, /Ligar à Ana/);
    igual(JSON.parse(JSON.stringify(app.tfOpcoesDeSeccao(app.tfRascunho))).map((o) => o.label),
      ['Todas as secções', 'Obras', 'Obras / Cozinha', 'Documentos', 'Sem secção']);
  });
});

describe('o caminho com «/»', () => {
  test('o «Adicionar secção» cria as que faltam, umas dentro das outras; um caminho que já existe não cria nada', () => {
    const { toasts } = abrir();
    app.tfNovaSeccao();
    elementos(app).pm_v.value = 'obras/Cozinha/Elétrica';
    app._pm();
    const el = idDe('Elétrica');
    igual(secs().slice(3), [el + '<S3']);
    app.tfNovaSeccao();
    elementos(app).pm_v.value = 'Obras/Cozinha';
    app._pm();
    assert.equal(toasts.pop().m, 'A secção «Obras / Cozinha» já existe.');
    assert.equal(app.tfRascunho.seccoes.length, 4);
  });

  test('o «+ Criar secção…» do formulário aceita o caminho, e a tarefa fica na última', () => {
    abrir();
    app.tfNovaTarefa('');
    const el = elementos(app);
    el.tf_nome.value = 'Tomada do fogão';
    el.tf_sec.value = '__new__';
    app.tfSecMudou();
    el.pm_v.value = 'Obras/Cozinha/Elétrica';
    app._pm();
    igual(rotulos('tf_sec'), ['Sem secção', 'Obras', 'Obras / Cozinha', 'Obras / Cozinha / Elétrica', 'Documentos', '+ Criar secção…']);
    assert.equal(app.tfRascunho.seccoes.length, 3, 'ainda nada no rascunho');
    app.tfGuardarTarefa();
    const e = idDe('Elétrica');
    assert.equal(app.tfRascunho.seccoes.find((s) => s.id === e).pai, 'S3');
    assert.equal(app.tfRascunho.itens.find((x) => x.nome === 'Tomada do fogão').seccao, e);
  });

  test('o «Mudar o nome» abre com o caminho, e mudar o caminho leva a secção, com o que tem dentro', () => {
    const { abertas, toasts } = abrir();
    app.tfMudarNomeSeccao('S3');
    assert.match(abertas[abertas.length - 1].b, /value="Obras\/Cozinha"/);
    elementos(app).pm_v.value = 'Documentos/Cozinha velha';
    app._pm();
    igual(secs(), ['S1<-', 'S2<-', 'S3<S2']);
    assert.equal(app.tfRascunho.seccoes[2].nome, 'Cozinha velha');
    app.tfMudarNomeSeccao('S3');
    elementos(app).pm_v.value = 'Cozinha';
    app._pm();
    igual(secs(), ['S1<-', 'S2<-', 'S3<-'], 'sem mãe vai para o topo, para o fim');
    app.tfMudarNomeSeccao('S2');
    elementos(app).pm_v.value = 'Arquivo/Papelada';
    app._pm();
    const arq = idDe('Arquivo');
    assert.equal(app.tfRascunho.seccoes.find((s) => s.id === 'S2').pai, arq, 'a mãe que falta cria-se');
    assert.equal(app.tfRascunho.seccoes.find((s) => s.id === 'S2').nome, 'Papelada');
    assert.equal(toasts.length, 0);
  });

  test('o «Mudar o nome» recusa ir para dentro dela própria e o caminho de outra secção', () => {
    const { toasts } = abrir();
    const antes = JSON.stringify(app.tfRascunho);
    app.tfMudarNomeSeccao('S1');
    elementos(app).pm_v.value = 'Obras/Cozinha/Obras';
    app._pm();
    assert.equal(toasts.pop().m, 'Uma secção não pode ficar dentro dela própria.');
    app.tfMudarNomeSeccao('S2');
    elementos(app).pm_v.value = 'obras';
    app._pm();
    assert.equal(toasts.pop().m, 'Já existe a secção «Obras».');
    assert.equal(JSON.stringify(app.tfRascunho), antes);
  });
});

describe('remover e mover secções', () => {
  test('remover Obras leva a Cozinha e as tarefas das duas, e o Anular devolve tudo ao lugar', () => {
    const { toasts } = abrir();
    const antes = JSON.stringify(app.tfRascunho);
    app.tfRemoverSeccao('S1');
    igual(secs(), ['S2<-']);
    igual(app.tfRascunho.itens.map((x) => x.id), ['K3', 'K4']);
    const aviso = toasts.pop();
    assert.equal(aviso.m, 'Secção removida, com 1 subsecção e 4 tarefas.');
    aviso.op.fn();
    assert.equal(JSON.stringify(app.tfRascunho), antes);
  });

  test('o «Mover secção»: a mãe sem ela nem as de dentro, as posições das irmãs, e «Mover» muda o rascunho', () => {
    const { abertas } = abrir();
    app.tfPegaSecClique('S1');
    const j = abertas[abertas.length - 1];
    assert.equal(j.t, 'Mover secção');
    igual(rotulos('tf_smae'), ['No topo', 'Documentos'], 'nem Obras nem a Cozinha');
    assert.match(j.b, /<input type="hidden" id="tf_smae" value="">/);
    igual(rotulos('tf_spos'), ['Em primeiro lugar', 'Depois de «Documentos»']);
    const el = elementos(app);
    el.tf_smae.value = 'S2';
    app.tfMoverMaeMudou();
    igual(rotulos('tf_spos'), ['Em primeiro lugar']);
    app.tfGuardarMoverSeccao();
    igual(app.tfArvore(app.tfRascunho).map((o) => o.s.id + ':' + o.nivel), ['S2:0', 'S1:1', 'S3:2'], 'Obras, com a Cozinha, dentro de Documentos');
    assert.match(j.f, />Mover<\/button>$/);
  });

  test('o toque logo a seguir a largar não abre o «Mover secção»', () => {
    const { abertas } = abrir();
    const n = abertas.length;
    app.tfArrFim = Infinity;
    app.tfPegaSecClique('S1');
    assert.equal(abertas.length, n);
  });
});

/* Um elemento falso com uma caixa no ecrã, para o alvo do arrasto medir.
   Recebe: top, h — o topo e a altura; o — {id, sec, cab, linhas, dona (a
   secção de uma linha ou de umas filhas), pai (o parentElement), dentro (o
   que contém), recolhida}.
   Devolve: o elemento. */
function caixa(top, h, o = {}) {
  const classes = new Set(o.recolhida ? ['tf-recolhida'] : []);
  const e = {
    o,
    getBoundingClientRect: () => ({ top, bottom: top + h, height: h, left: 0, right: 300, width: 300 }),
    getClientRects: () => [1],
    getAttribute: (n) => (n === 'data-id' ? o.id ?? null : n === 'data-sec' ? o.sec ?? null : null),
    classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    querySelector: (s) => (s === '.tf-cab' ? o.cab || null : null),
    querySelectorAll: (s) => (s === '.tf-item' ? o.linhas || [] : []),
    contains: (x) => x === e || (o.dentro || []).includes(x),
    closest: (s) => (s === '.tf-seccao' ? o.dona || null : null),
    get parentElement() { return o.pai || null; },
  };
  return e;
}

/* O ecrã: as soltas (0–88, com a K4), Obras (100–276: cabeçalho, K1 e as
   filhas com a Cozinha: cabeçalho 188–232 e a K6) e Documentos recolhida (290–334).
   Recebe: agarrada — 'K4' (uma tarefa) ou o id da secção agarrada.
   Devolve: os elementos. */
function ecra(agarrada) {
  const lista = {};
  const k4 = caixa(44, 44, { id: 'K4' }), k1 = caixa(144, 44, { id: 'K1' }), k6 = caixa(232, 44, { id: 'K6' });
  const soltas = caixa(0, 88, { sec: '', cab: caixa(0, 44), linhas: [k4], pai: lista });
  const f1 = caixa(188, 88, {});
  const s3 = caixa(188, 88, { sec: 'S3', cab: caixa(188, 44), linhas: [k6], pai: f1 });
  const s1 = caixa(100, 176, { sec: 'S1', cab: caixa(100, 44), linhas: [k1, k6], pai: lista, dentro: [f1, s3, k1, k6] });
  const s2 = caixa(290, 44, { sec: 'S2', cab: caixa(290, 44), recolhida: true, pai: lista });
  k4.o.dona = soltas; k1.o.dona = s1; k6.o.dona = s3; f1.o.dona = s1;
  lista.querySelectorAll = (s) => (s === '.tf-seccao' ? [soltas, s1, s3, s2] : s === '.tf-filhas' ? [f1] : []);
  const row = agarrada === 'K4' ? k4 : { S1: s1, S2: s2, S3: s3 }[agarrada];
  app.tfArr = { tipo: agarrada === 'K4' ? 'tarefa' : 'seccao', lista, row };
  return { lista, soltas, s1, s2, s3, f1, k1, k6 };
}

describe('o alvo do arrasto, numa árvore', () => {
  test('uma tarefa: cada secção conta com o cabeçalho e as tarefas dela, e a de dentro ganha nas dela', () => {
    base();
    const { s1, s3, k6 } = ecra('K4');
    const naK6 = app.tfArrastoAlvoTarefa(250);
    assert.equal(naK6.sid, 'S3');
    assert.equal(naK6.cab, false);
    assert.equal(naK6.antes, k6);
    assert.equal(naK6.sec, s3);
    const cab = app.tfArrastoAlvo(200);
    assert.equal(cab.sid, 'S3');
    assert.equal(cab.cab, true);
    const fimObras = app.tfArrastoAlvo(180);
    assert.equal(fimObras.sid, 'S1');
    assert.equal(fimObras.depois, 'K1', 'a K6 não conta como de Obras');
    assert.equal(fimObras.sec, s1);
  });

  test('uma secção: no nome de outra fica dentro dela; entre irmãs é uma linha, ao nível da lista à altura do dedo', () => {
    base();
    const { s1, s3, f1, lista } = ecra('S2');
    const obras = app.tfArrastoAlvo(120);
    assert.equal(obras.cab, true);
    assert.equal(obras.pai, 'S1');
    assert.equal(obras.sec, s1);
    assert.equal(app.tfArrastoAlvo(200).pai, 'S3', 'no nome da Cozinha, dentro dela');
    const fimCozinha = app.tfArrastoAlvo(250);
    assert.equal(fimCozinha.cab, false);
    assert.equal(fimCozinha.pai, 'S1');
    assert.equal(fimCozinha.depois, 'S3');
    assert.equal(fimCozinha.cont, f1);
    const depoisObras = app.tfArrastoAlvo(160);
    assert.equal(depoisObras.pai, '');
    assert.equal(depoisObras.depois, 'S1');
    assert.equal(depoisObras.cont, lista);
    const primeiro = app.tfArrastoAlvo(50);
    assert.equal(primeiro.depois, '');
    assert.equal(primeiro.antes, s1);
    assert.ok(s3);
  });

  test('uma secção nunca cai dentro dela própria nem das de dentro', () => {
    base();
    const { s2 } = ecra('S1');
    const a = app.tfArrastoAlvo(200);
    assert.equal(a.cab, false, 'o nome da Cozinha (dentro de Obras) não é alvo');
    assert.equal(a.pai, '');
    assert.equal(a.antes, s2);
  });

  test('largar uma secção no nome de outra muda o rascunho; o registo só muda no Guardar', () => {
    const { toasts } = abrir();
    const { s1 } = ecra('S2');
    const a = app.tfArr;
    a.row.style = {};
    a.row.isConnected = true;
    a.lista.classList = { remove() {} };
    a.lista.querySelector = () => null;
    Object.assign(a, { sid: 'S2', h: {}, ativo: true, cancelado: false, desloc: 0, raf: 0, abrir: 0,
      alvo: { cab: true, pai: 'S1', depois: '', sec: s1 } });
    app.tfArrastoFim();
    igual(secs(), ['S1<-', 'S2<S1', 'S3<S1']);
    igual(secs(app.db.properties[0].tarefas), ['S1<-', 'S2<-', 'S3<S1']);
    assert.equal(toasts.length, 0, 'Obras está aberta: vê-se para onde foi');
    assert.equal(app.tfArr, null);
  });
});

describe('a secção recolhida abre ao parar em cima dela, a arrastar (KAN-135)', () => {
  /* Os temporizadores da app num registo, para os disparar à mão.
     Devolve: {pedidos, limpos}. */
  function relogio() {
    const pedidos = [], limpos = [];
    app.setTimeout = (fn, ms) => { pedidos.push({ fn, ms }); return pedidos.length; };
    app.clearTimeout = (id) => { limpos.push(id); };
    return { pedidos, limpos };
  }

  test('600 ms com o dedo no nome de Documentos (recolhida) abrem-na, e o alvo volta a medir-se', () => {
    abrir();
    app.tfDobrar('S2');
    const { s2 } = ecra('K4');
    Object.assign(app.tfArr, { ativo: true, cancelado: false, chave: '', abrir: 0 });
    app.tfArr.lista.querySelector = () => null;
    const { pedidos } = relogio();
    let pintou = 0;
    app.tfArrastoPintar = () => { pintou++; };
    app.tfArrastoMarcar({ sid: 'S2', depois: '', cab: true, sec: s2, antes: null });
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0].ms, 600);
    assert.ok(s2.classList.contains('tf-alvo'), 'acende já');
    pedidos[0].fn();
    igual(app.tfRecolhidasDe({ tipo: 'imovel', id: 'P1' }), [], 'abriu, e o aparelho lembra-se');
    assert.equal(pintou, 1);
  });

  test('sair antes dos 600 ms, ou largar, não abre nada', () => {
    abrir();
    app.tfDobrar('S2');
    const { s2, s1 } = ecra('K4');
    Object.assign(app.tfArr, { ativo: true, cancelado: false, chave: '', abrir: 0 });
    app.tfArr.lista.querySelector = () => null;
    const { pedidos, limpos } = relogio();
    app.tfArrastoMarcar({ sid: 'S2', depois: '', cab: true, sec: s2, antes: null });
    app.tfArrastoMarcar({ sid: 'S1', depois: '', cab: true, sec: s1, antes: null });
    assert.deepEqual(limpos, [1], 'mudar de alvo cancela');
    pedidos[0].fn();
    igual(app.tfRecolhidasDe({ tipo: 'imovel', id: 'P1' }), ['S2'], 'continua recolhida');
    assert.equal(pedidos.length, 1, 'Obras está aberta: não conta nada');
  });

  test('numa secção aberta não conta nada', () => {
    abrir();
    const { s1 } = ecra('K4');
    Object.assign(app.tfArr, { ativo: true, cancelado: false, chave: '', abrir: 0 });
    app.tfArr.lista.querySelector = () => null;
    const { pedidos } = relogio();
    app.tfArrastoMarcar({ sid: 'S1', depois: '', cab: true, sec: s1, antes: null });
    assert.equal(pedidos.length, 0);
  });
});
