// O rasto das pessoas do lado da app (web/cloud/rasto.js): nada se recolhe
// nem se envia antes do sim; o descritor do que se tocou nunca leva texto,
// valores nem ids de registos; os sinais em-vao, repetido, vai-e-volta (de
// uma janela e de um ecrã), desistencia e erro-campo, pelas regras de cada
// um, e o guardar; os lotes de até 50 pelo sendBeacon, o fetch com keepalive
// de recurso e o envio de 15 em 15 s; a pergunta, uma vez, só com o ecrã
// livre (nunca por cima de um portão, de uma janela nem das boas-vindas),
// com Recusar e Aceitar do mesmo peso; e a linha das Definições, que mostra
// a escolha e a muda. A app inteira, nuvem incluída, com a API, o beacon e o
// fetch simulados.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { carregarTudo, repor } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
// o estado do rasto.js e da sessão volta ao do arranque (não passa pelo proxy, por isso o repor não o vê)
afterEach(() => zerar());

const SEM_EM_LINHA = /\sstyle=|\son[a-z]+\s*=/i;
let T = 1_000_000;

/* Devolve o rasto.js ao estado de quando carregou: desligado, sem escolha,
   sem fila, sem pergunta feita, e sem sessão.
   Devolve: nada. */
function zerar() {
  vm.runInContext('rstDesligar();rstEscolha=undefined;rstEscolhaDe="";rstAPedir=false;rstPedidoEm=0;rstPedidoPara="";' +
    'rstPerguntou=false;clearTimeout(rstPerguntaTempo);rstPerguntaTempo=null;rstPerguntaTentativas=0;rstLivreAntes=false;' +
    'rstAMudar=false;modalStack.length=0;CW.user=null;CW._pulled=false;localStorage.clear();', app.__ctx);
  delete app.navigator.sendBeacon;
}

/* O relógio do rasto passa a ser o T deste ficheiro.
   Devolve: nada. */
function relogio() { app.rstAgora = () => T; }

/* Uma conta com sessão e com o estado lido.
   Devolve: nada. */
function comSessao() {
  app.CW.user = { id: 'u1', name: 'Maria Costa', email: 'maria@rendorium.test' };
  app.CW._pulled = true;
}

/* A conta disse que sim: o rasto liga.
   Devolve: nada. */
function ligar() {
  comSessao();
  relogio();
  vm.runInContext("rstAdotarEscolha('sim','u1')", app.__ctx);
}

/* Um elemento de brincar, com texto e valor que nunca podem aparecer no rasto.
   Recebe: tag — a etiqueta; attrs — os atributos; pai (opcional) — o pai.
   Devolve: o elemento. */
function el(tag, attrs = {}, pai = null) {
  return { tagName: tag.toUpperCase(), nodeType: 1, parentElement: pai, textContent: 'Maria Costa', value: 'segredo 123',
    getAttribute: (n) => (n in attrs ? attrs[n] : null) };
}

/* Os eventos da fila, deste lado da vm.
   Devolve: array de eventos. */
const fila = () => JSON.parse(JSON.stringify(app.rstFila));

/* As janelas abrem e fecham numa pilha observável, por baixo dos embrulhos
   do rasto (o openModal e o closeModal de antes deles).
   Devolve: o array das camadas abertas. */
function janelas() {
  const abertas = [];
  app.rstOpenModalDeAntes = (t, b, f) => {
    const cls = ['modal', 'open'];
    const L = { t, b, f, tocado: false, el: {
      classList: { add: (c) => cls.push(c) }, getAttribute: (n) => (n === 'class' ? cls.join(' ') : null), querySelector: () => null } };
    app.modalStack.push(L); abertas.push(L);
    return L;
  };
  app.rstCloseModalDeAntes = (origem) => {
    const L = app.modalStack.pop();
    if (L && typeof L.aoFechar === 'function') L.aoFechar(typeof origem === 'string' ? origem : '');
  };
  return abertas;
}

/* Uma API simulada: guarda cada pedido e responde pelo que o teste disser.
   Recebe: respostas — {'MÉTODO /caminho': valor, função(dados) ou Error}.
   Devolve: a lista dos pedidos ([método, caminho, dados]). */
function apiFalsa(respostas = {}) {
  const pedidos = [];
  app.api = (m, p, d) => {
    pedidos.push([m, p, d === undefined ? undefined : JSON.parse(JSON.stringify(d))]);
    const r = respostas[m + ' ' + p];
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(typeof r === 'function' ? r(d) : (r === undefined ? {} : r));
  };
  return pedidos;
}

/* O documento passa a ter body (é um browser) e o que o teste disser.
   Recebe: extra — {seletor: elemento}.
   Devolve: nada. */
function documento(extra = {}) {
  app.document.querySelector = (s) => (s === 'body' ? {} : (extra[s] || null));
}

/* O ecrã está livre aos olhos da apresentação e das novidades.
   Devolve: nada. */
function ecraLivre() {
  app.aprEcraOcupado = () => '';
  app.aprOcupaOEcra = () => false;
  app.aprQueAbrir = () => '';
  app.ecraLivre = () => true;
}

/* Espera que as microtarefas e as promessas da app corram.
   Devolve: Promise. */
const assentar = () => new Promise((r) => setImmediate(r));

describe('nada se recolhe nem se envia antes do sim', () => {
  for (const escolha of [undefined, null, 'nao']) {
    test('com a escolha ' + escolha + ': nem toque, nem janela, nem erro de campo, nem envio', () => {
      comSessao();
      relogio();
      vm.runInContext('rstAdotarEscolha(' + JSON.stringify(escolha === undefined ? null : escolha) + ',"u1")', app.__ctx);
      if (escolha === undefined) vm.runInContext('rstEscolha=undefined', app.__ctx);
      const beacons = [];
      app.navigator.sendBeacon = (u, b) => { beacons.push(u); return true; };
      assert.equal(app.rstLigado(), false);
      assert.equal(app.rstToque(el('button', { 'data-click': 'go(\'contracts\')' }), 10, 10), null);
      const L = { el: null, tocado: false };
      app.rstJanelaAbriu(L);
      assert.equal(L._rst, undefined, 'a janela não fica a ser seguida');
      assert.equal(app.rstErroCampo('c_rent'), null);
      app.rstAoPousar({ isPrimary: true, button: 0, pointerId: 1, clientX: 5, clientY: 5, target: el('div') });
      assert.equal(app.rstAoLevantar({ pointerId: 1, clientX: 5, clientY: 5 }), null);
      app.rstVerEcra();
      assert.equal(app.rstFila.length, 0, 'a fila fica vazia');
      assert.equal(app.rstEnviar(true), 0);
      assert.deepEqual(beacons, [], 'nada sai');
      assert.equal(app.rstIntervalo, null, 'e o envio de 15 em 15 s não arranca');
    });
  }

  test('a escolha pede-se só com sessão, com o estado lido e num documento a sério — e uma vez', async () => {
    const pedidos = apiFalsa({ 'GET /api/rasto/escolha': { escolha: 'nao' } });
    app.CW.user = { id: 'u1' };
    assert.equal(app.rstPedirEscolha(), null, 'sem o estado lido');
    app.CW._pulled = true;
    assert.equal(app.rstPedirEscolha(), null, 'sem documento (os testes de Node)');
    assert.equal(pedidos.length, 0);
    documento();
    relogio();
    await app.rstPedirEscolha();
    assert.deepEqual(pedidos, [['GET', '/api/rasto/escolha', undefined]]);
    assert.equal(app.rstEscolha, 'nao');
    app.rstSincronizar();
    assert.equal(pedidos.length, 1, 'já se sabe: o render não volta a pedir');
    app.document.visibilityState = 'visible';
    app.rstAoSair();
    assert.equal(pedidos.length, 1, 'a voltar à vista no mesmo minuto, não pede');
    T += 61000;
    app.rstAoSair();
    assert.equal(pedidos.length, 2, 'passado um minuto, a app que volta à vista pede outra vez (a última escolha ganha no servidor)');
    assert.equal(app.localStorage.getItem('gi_rasto_escolha'), null);
  });

  test('outra conta esquece a escolha da de antes e desliga', () => {
    ligar();
    assert.equal(app.rstLigado(), true);
    app.CW.user = { id: 'u2' };
    app.rstSincronizar();
    assert.equal(app.rstLigado(), false);
    assert.equal(app.rstEscolha, undefined);
    assert.equal(app.rstIntervalo, null);
  });
});

describe('o descritor: onde, nunca o quê', () => {
  test('a ação sem os argumentos, a ligação só com o caminho, o id sem registos, a classe, a etiqueta', () => {
    const d = (tag, a) => app.rstDescritor(el(tag, a));
    assert.equal(d('button', { 'data-click': "openProp('p_8f3k2')", id: 'x', class: 'btn' }), 'click:openProp');
    assert.equal(d('button', { 'data-click': 'onSave&&onSave()' }), 'click:onSave');
    assert.equal(d('div', { 'data-click': "menuOpen(event,'qa');qaMenuAbriu(event)" }), 'click:menuOpen');
    assert.equal(d('a', { href: '/t/entrar/ab12cd?email=maria@x.pt#y' }), 'a:/t/entrar/*?email', 'as chaves da pesquisa, sem os valores');
    assert.equal(d('a', { href: '/?entrar=tok123&entrar=x&volta=%2F' }), 'a:/?entrar&volta');
    assert.equal(d('a', { href: 'https://app.rendorium.com/?criar' }), 'a:app.rendorium.com/?criar', 'o host de fora fica');
    assert.equal(d('a', { href: 'https://teste.local/privacidade' }), 'a:/privacidade', 'o da página não');
    assert.equal(d('a', { href: 'mailto:maria@rendorium.test' }), 'a:mailto');
    assert.equal(d('a', { href: 'tel:+351912345678' }), 'a:tel');
    assert.equal(d('input', { id: 'c_rent', class: 'inp' }), 'input#c_rent');
    assert.equal(d('div', { id: 'fiscoTit_k3j4' }), 'div#fiscoTit_', 'o id de um registo corta-se ao prefixo');
    assert.equal(d('div', { id: 'p17', class: 'card grande' }), 'div.card', 'um id que é só registo não conta');
    assert.equal(d('span', {}), 'span');
  });

  test('o evento de um toque não leva texto, valores, nomes nem aria-label', () => {
    ligar();
    const b = el('button', { 'data-click': "personView('tenant','t_9x8y')", 'aria-label': 'Abrir Maria Costa', id: 'ten_9x8y' });
    const ev = app.rstToque(b, 600, 450);
    const s = JSON.stringify(ev);
    assert.equal(ev.alvo, 'click:personView');
    assert.ok(!/Maria|segredo|9x8y|tenant/.test(s), 'nada do que está no ecrã: ' + s);
    assert.deepEqual(Object.keys(ev).sort(), ['alvo', 'ecra', 'janela', 'sinal', 't', 'tipo', 'vh', 'vw', 'x', 'y']);
    assert.equal(ev.tipo, 'toque');
    assert.equal(ev.x, 500, 'em permilagem da largura (600 em 1200)');
    assert.equal(ev.y, 500, 'e da altura (450 em 900)');
    assert.equal(ev.vw, 1200);
    assert.equal(ev.vh, 900);
    assert.equal(ev.ecra, 'dashboard');
  });

  test('um toque num desenho descreve-se pelo svg, e o arrasto não é toque', () => {
    ligar();
    const svg = el('svg', { class: 'grafico' });
    const ev = app.rstToque(el('path', {}, el('g', {}, svg)), 10, 10);
    assert.equal(ev.alvo, 'svg.grafico');
    app.rstAoPousar({ isPrimary: true, button: 0, pointerId: 3, clientX: 100, clientY: 100, target: el('div') });
    assert.equal(app.rstAoLevantar({ pointerId: 3, clientX: 100, clientY: 140 }), null, '40px de arrasto');
    app.rstAoPousar({ isPrimary: true, button: 0, pointerId: 4, clientX: 100, clientY: 100, target: el('button') });
    app.rstAoCancelar();
    assert.equal(app.rstAoLevantar({ pointerId: 4, clientX: 100, clientY: 100 }), null, 'cancelado pelo browser');
    app.rstAoPousar({ isPrimary: true, button: 0, pointerId: 5, clientX: 100, clientY: 100, target: el('button') });
    assert.equal(app.rstAoLevantar({ pointerId: 5, clientX: 104, clientY: 103 }).alvo, 'button', 'a 5px é toque');
  });
});

describe('os sinais', () => {
  test('em-vao: nada que responda por cima do alvo; um botão, um role, um tabindex respondem (o -1 não)', () => {
    ligar();
    const s = (alvo) => app.rstToque(alvo, (T += 2000) % 1000, 300).sinal;
    assert.equal(s(el('span', {}, el('div', { class: 'card' }))), 'em-vao');
    assert.equal(s(el('span', {}, el('button', {}))), null);
    assert.equal(s(el('span', {}, el('div', { role: 'switch' }))), null);
    assert.equal(s(el('span', {}, el('div', { tabindex: '0' }))), null);
    assert.equal(s(el('span', {}, el('div', { class: 'sheet', tabindex: '-1' }))), 'em-vao', 'a caixa da janela não responde');
    assert.equal(s(el('b', {}, el('label', {}))), null);
    assert.equal(s(el('b', {}, el('a', { href: '/x' }))), null);
    assert.equal(s(el('b', {}, el('a', {}))), 'em-vao', 'uma ligação sem href');
    const ev = app.rstToque(el('p', { class: 'small' }, el('div')), 900, 10);
    assert.equal(ev.alvo, 'p.small', 'o descritor do próprio alvo');
  });

  test('repetido: do 3.º toque seguido a ≤24px e ≤1 s do anterior em diante; longe ou devagar recomeça', () => {
    ligar();
    const b = el('button', {});
    const toque = (dt, x, y) => { T += dt; return app.rstToque(b, x, y).sinal; };
    assert.equal(toque(0, 100, 100), null);
    assert.equal(toque(300, 110, 105), null);
    assert.equal(toque(300, 120, 110), 'repetido');
    assert.equal(toque(900, 130, 115), 'repetido', 'e os seguintes');
    assert.equal(toque(200, 300, 300), null, 'longe recomeça');
    assert.equal(toque(200, 300, 300), null);
    assert.equal(toque(1200, 300, 300), null, 'devagar recomeça');
    assert.equal(toque(100, 300, 300), null);
    assert.equal(toque(100, 300, 300), 'repetido');
  });

  test('vai-e-volta numa janela: abriu e fechou em 4 s sem nada feito lá dentro (o ✕ e o Cancelar não contam)', async () => {
    ligar();
    janelas();
    app.rstToque(el('button', { 'data-click': 'ctModal()' }), 10, 10);
    const L = app.openModal('Novo contrato de Maria Costa', '<p>corpo</p>', '');
    await assentar();
    T += 1500;
    app.rstToque(el('button', { 'data-click': 'closeModal(\'x\')' }), 10, 10);
    app.closeModal('x');
    const f = fila();
    const abre = f.find((e) => e.tipo === 'janela-abre'), fecha = f.find((e) => e.tipo === 'janela-fecha');
    assert.equal(abre.janela, 'ctModal', 'a janela tem o nome da ação que a abriu, e não o título');
    assert.equal(fecha.janela, 'ctModal');
    assert.equal(fecha.sinal, 'vai-e-volta');
    assert.ok(!/Maria/.test(JSON.stringify(f)));
    assert.equal(L._rst, null);
  });

  test('sem vai-e-volta com um toque útil lá dentro, ou depois dos 4 s', async () => {
    ligar();
    janelas();
    app.openModal('A', '', '');
    await assentar();
    app.rstToque(el('button', { 'data-click': 'selOpen(event,\'x\')' }), 10, 10);
    T += 1000;
    app.closeModal('x');
    app.openModal('B', '', '');
    await assentar();
    T += 4500;
    app.closeModal('fundo');
    const fechas = fila().filter((e) => e.tipo === 'janela-fecha');
    assert.deepEqual(fechas.map((e) => e.sinal), [null, null]);
  });

  test('vai-e-volta num ecrã: o evento do ecrã espera pelo sinal; a barra de baixo não é um toque útil', () => {
    ligar();
    app.tab = 'contracts';
    app.rstVerEcra();
    T += 1500;
    app.rstToque(el('button', { 'data-click': 'goBarra(\'casas\')' }, el('nav', { id: 'tabbar' })), 10, 880);
    app.tab = 'properties';
    app.rstVerEcra();
    let ecras = fila().filter((e) => e.tipo === 'ecra');
    const contratos = ecras.find((e) => e.ecra === 'contracts');
    assert.equal(contratos.sinal, 'vai-e-volta');
    assert.ok(!ecras.some((e) => e.ecra === 'properties'), 'o ecrã novo ainda espera');
    T += 500;
    app.rstToque(el('button', { 'data-click': 'propView(\'p1\')' }), 10, 300);
    ecras = fila().filter((e) => e.tipo === 'ecra');
    assert.equal(ecras.find((e) => e.ecra === 'properties').sinal, null, 'um toque útil resolve-o sem sinal');
    T += 9000;
    app.tab = 'settings'; app.setPage = 'tema';
    app.rstVerEcra();
    T += 1000;
    app.setPage = '';
    app.rstVerEcra();
    ecras = fila().filter((e) => e.tipo === 'ecra');
    assert.equal(ecras.find((e) => e.ecra === 'settings/tema').sinal, 'vai-e-volta', 'a subpágina das Definições é um ecrã');
    const ts = fila().map((e) => e.t);
    assert.deepEqual(ts, ts.slice().sort((a, b) => a - b), 'a fila vai pela ordem do instante');
  });

  test('desistencia: escreveu-se e fechou-se sem guardar', async () => {
    ligar();
    janelas();
    const L = app.openModal('Novo movimento', '', '');
    await assentar();
    L.tocado = true;
    T += 9000;
    app.closeModal('x');
    assert.equal(fila().find((e) => e.tipo === 'janela-fecha').sinal, 'desistencia');
    assert.ok(!fila().some((e) => e.tipo === 'guardar'));
  });

  test('o Guardar que fecha a janela é um guardar, sem desistência', async () => {
    ligar();
    janelas();
    const L = app.openModal('Novo movimento', '', '');
    await assentar();
    L.tocado = true;
    T += 3000;
    app.rstToque(el('button', { 'data-click': 'onSave&&onSave()', class: 'btn primary' }, el('div', { class: 'foot' })), 900, 880);
    app.closeModal();
    const f = fila();
    const g = f.find((e) => e.tipo === 'guardar');
    assert.ok(g, 'há um guardar');
    assert.equal(g.janela, 'janela', 'aberta sem toque e sem marcas, a janela fica com o nome genérico');
    assert.equal(f.find((e) => e.tipo === 'janela-fecha').sinal, null);
  });

  test('erro-campo: o falhaCampo deixa o sinal com o descritor do campo, sem a frase; e o guardar deixa de contar', async () => {
    ligar();
    janelas();
    const avisos = [];
    app.rstFalhaCampoDeAntes = (id, msg) => { avisos.push(msg); };
    app.document.getElementById = (id) => el('input', { id, class: 'inp' });
    const L = app.openModal('Novo contrato', '', '');
    await assentar();
    L.tocado = true;
    app.rstToque(el('button', { 'data-click': 'CW.guardarContrato()', 'data-toca': 'dados' }, el('div', { class: 'foot' })), 900, 880);
    T += 10;
    app.falhaCampo('c_rent', 'Falta a renda de Maria Costa.');
    assert.deepEqual(avisos, ['Falta a renda de Maria Costa.'], 'o falhaCampo de antes corre');
    const e = fila().find((x) => x.tipo === 'erro-campo');
    assert.equal(e.sinal, 'erro-campo');
    assert.equal(e.alvo, 'input#c_rent');
    assert.ok(!/Maria|renda/.test(JSON.stringify(e)));
    T += 2000;
    app.closeModal('x');
    assert.ok(!fila().some((x) => x.tipo === 'guardar'), 'o guardar falhou no campo');
    assert.equal(fila().find((x) => x.tipo === 'janela-fecha').sinal, 'desistencia');
  });
});

describe('o envio', () => {
  test('em lotes de até 50 pelo sendBeacon, com a sessão do carregamento, em JSON', async () => {
    ligar();
    const beacons = [];
    app.navigator.sendBeacon = (u, b) => { beacons.push([u, b]); return true; };
    for (let i = 0; i < 120; i++) app.rstPor(app.rstEvento('toque', { t: T + i, alvo: 'button' }));
    assert.equal(app.rstEnviar(), 3);
    assert.equal(app.rstFila.length, 0);
    assert.deepEqual(beacons.map((b) => b[0]), ['/api/rasto', '/api/rasto', '/api/rasto']);
    assert.equal(beacons[0][1].type, 'application/json');
    const lotes = await Promise.all(beacons.map((b) => b[1].text().then(JSON.parse)));
    assert.deepEqual(lotes.map((l) => l.eventos.length), [50, 50, 20]);
    assert.match(lotes[0].sessao, /^s-[a-z0-9]{10}$/);
    assert.ok(lotes.every((l) => l.sessao === lotes[0].sessao), 'a mesma sessão em todos');
    assert.deepEqual(Object.keys(lotes[0]).sort(), ['eventos', 'sessao']);
  });

  test('o beacon recusado vai por fetch com keepalive; com um token no aparelho, fetch com o Bearer', () => {
    ligar();
    const pedidos = [];
    app.navigator.sendBeacon = () => false;
    app.fetch = (u, o) => { pedidos.push([u, o]); return Promise.resolve({ status: 204 }); };
    app.rstPor(app.rstEvento('toque'));
    app.rstEnviar();
    assert.equal(pedidos[0][0], '/api/rasto');
    assert.equal(pedidos[0][1].method, 'POST');
    assert.equal(pedidos[0][1].keepalive, true);
    assert.equal(pedidos[0][1].credentials, 'same-origin');
    assert.equal(JSON.parse(pedidos[0][1].body).eventos.length, 1);
    app.CW.user.token = 'tok';
    let beacon = 0;
    app.navigator.sendBeacon = () => { beacon++; return true; };
    app.rstPor(app.rstEvento('toque'));
    app.rstEnviar();
    assert.equal(beacon, 0, 'o beacon não leva o Bearer');
    assert.equal(pedidos[1][1].headers.Authorization, 'Bearer tok');
  });

  test('envia de 15 em 15 s, e a página a sair leva o ecrã que esperava pelo sinal', () => {
    let intervalo = null;
    app.setInterval = (f, ms) => { intervalo = ms; return { unref() {} }; };
    ligar();
    assert.equal(intervalo, 15000);
    const beacons = [];
    app.navigator.sendBeacon = (u, b) => { beacons.push(b); return true; };
    assert.equal(app.rstEnviar(), 0, 'o ecrã do arranque ainda espera, e não há mais nada');
    assert.equal(app.rstEnviar(true), 1, 'a sair, vai');
    assert.equal(beacons.length, 1);
  });

  test('o não deita fora a fila e para', () => {
    ligar();
    app.rstPor(app.rstEvento('toque'));
    vm.runInContext("rstAdotarEscolha('nao','u1')", app.__ctx);
    assert.equal(app.rstFila.length, 0);
    assert.equal(app.rstIntervalo, null);
    assert.equal(app.rstPor(app.rstEvento('toque')), false);
  });
});

describe('a pergunta', () => {
  /* Uma conta por escolher, no browser, com o ecrã livre.
     Devolve: o array das janelas abertas. */
  function porEscolher() {
    comSessao();
    relogio();
    documento();
    ecraLivre();
    vm.runInContext("rstAdotarEscolha(null,'u1')", app.__ctx);
    return janelas();
  }

  test('abre uma vez, com o ecrã livre em duas tentativas seguidas, com o texto e os dois botões do mesmo peso', () => {
    const abertas = porEscolher();
    assert.equal(app.rstTentarPergunta(), null, 'a primeira só confirma que o ecrã está livre');
    const L = app.rstTentarPergunta();
    assert.ok(L, 'a segunda abre');
    assert.equal(abertas.length, 1);
    assert.equal(L.t, 'Ajudas-nos a melhorar o Rendorium?');
    assert.ok(L.b.includes('Se aceitares, guardamos onde tocas e que ecrãs abres, com um identificador sem o teu nome, ' +
      'para percebermos o que é difícil de usar. Nunca guardamos o que escreves nem os teus dados. Fica 90 dias e podes mudar nas Definições.'));
    const botoes = [...L.f.matchAll(/<button type="button" class="([^"]+)" data-toca="dados" data-click="rstResponder\('(sim|nao)'\)">([^<]+)<\/button>/g)];
    assert.deepEqual(botoes.map((m) => [m[2], m[3]]), [['nao', 'Recusar'], ['sim', 'Aceitar']]);
    assert.equal(botoes[0][1], botoes[1][1], 'o mesmo peso');
    assert.equal(botoes[0][1], 'btn');
    assert.ok(!SEM_EM_LINHA.test(L.b + L.f));
    assert.equal(app.rstIdDaCamada(L), 'rasto-pergunta');
    app.modalStack.length = 0;
    app.rstTentarPergunta(); app.rstTentarPergunta();
    assert.equal(abertas.length, 1, 'não volta a abrir');
  });

  for (const [porque, montar] of [
    ['os termos novos', () => documento({ '#cwTerms': {} })],
    ['a entrada à vista', () => documento({ '#cwAuth': { style: { display: '' } } })],
    ['a versão velha demais', () => documento({ '#cwUpd': {} })],
    ['o portão da apresentação', () => { app.aprEcraOcupado = () => 'portao'; }],
    ['as boas-vindas por ver', () => { app.aprOcupaOEcra = () => true; }],
    ['a apresentação do separador por abrir', () => { app.aprQueAbrir = () => 'contracts'; }],
    ['as novidades', () => { app.ecraLivre = () => false; }],
    ['uma janela aberta', () => { app.modalStack.push({ el: null }); }],
    ['o estado ainda por ler', () => { app.CW._pulled = false; }],
  ]) {
    test('não abre com ' + porque, () => {
      const abertas = porEscolher();
      montar();
      for (let i = 0; i < 6; i++) app.rstTentarPergunta();
      assert.equal(abertas.length, 0);
      assert.ok(app.rstPorqueNaoAgora());
    });
  }

  test('ficar ocupado a meio recomeça a contagem', () => {
    const abertas = porEscolher();
    app.rstTentarPergunta();
    app.aprOcupaOEcra = () => true;
    app.rstTentarPergunta();
    app.aprOcupaOEcra = () => false;
    app.rstTentarPergunta();
    assert.equal(abertas.length, 0, 'livre, ocupado, livre: ainda não');
    app.rstTentarPergunta();
    assert.equal(abertas.length, 1);
  });

  test('Aceitar grava o sim (POST /api/rasto/escolha) e liga; Recusar grava o não', async () => {
    porEscolher();
    const pedidos = apiFalsa({ 'POST /api/rasto/escolha': (d) => ({ escolha: d.escolha }) });
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    app.rstTentarPergunta(); app.rstTentarPergunta();
    assert.equal(await app.rstResponder('sim'), true);
    assert.deepEqual(pedidos, [['POST', '/api/rasto/escolha', { escolha: 'sim' }]]);
    assert.equal(app.modalStack.length, 0, 'a janela fechou');
    assert.equal(app.rstEscolha, 'sim');
    assert.equal(app.rstLigado(), true);
    assert.deepEqual(avisos, ['Obrigado. Podes mudar quando quiseres nas Definições.']);
    assert.equal(app.rstResponder('nao'), null, 'sem a pergunta aberta não responde');

    zerar(); repor(app);
    porEscolher();
    const p2 = apiFalsa({ 'POST /api/rasto/escolha': (d) => ({ escolha: d.escolha }) });
    app.toast = () => {};
    app.rstTentarPergunta(); app.rstTentarPergunta();
    await app.rstResponder('nao');
    assert.deepEqual(p2, [['POST', '/api/rasto/escolha', { escolha: 'nao' }]]);
    assert.equal(app.rstEscolha, 'nao');
    assert.equal(app.rstLigado(), false);
  });

  test('fechada no ✕ não escolhe nada e volta numa abertura passados 7 dias; fechada pela app, volta', () => {
    const abertas = porEscolher();
    app.rstTentarPergunta(); app.rstTentarPergunta();
    app.closeModal('x');
    assert.equal(app.rstEscolha, null, 'nada escolhido');
    assert.deepEqual(JSON.parse(app.localStorage.getItem('gi_rasto_perguntado')), { u1: T }, 'só a hora em que se fechou');
    assert.equal(app.rstFaltaPerguntar(), false, 'no mesmo carregamento não volta');
    vm.runInContext('rstPerguntou=false', app.__ctx);
    T += 6 * 24 * 3600 * 1000;
    assert.equal(app.rstFaltaPerguntar(), false, 'noutra abertura antes dos 7 dias, também não');
    T += 2 * 24 * 3600 * 1000;
    assert.equal(app.rstFaltaPerguntar(), true, 'passados 7 dias, volta');
    app.rstTentarPergunta(); app.rstTentarPergunta();
    assert.equal(abertas.length, 2);
    app.closeModal('fundo');
    assert.equal(JSON.parse(app.localStorage.getItem('gi_rasto_perguntado')).u1, T, 'a hora nova');
    vm.runInContext('rstPerguntou=false', app.__ctx);
    localStorageLimpo();
    app.rstTentarPergunta(); app.rstTentarPergunta();
    assert.equal(abertas.length, 3);
    app.closeModal();
    assert.equal(app.rstFaltaPerguntar(), true, 'a app fechou-a: fica por perguntar');
  });

  test('o valor antigo 1 lê-se como fechada agora; com o armazenamento vedado, volta na abertura seguinte', () => {
    porEscolher();
    app.localStorage.setItem('gi_rasto_perguntado', JSON.stringify({ u1: 1 }));
    assert.equal(app.rstFaltaPerguntar(), false);
    assert.equal(JSON.parse(app.localStorage.getItem('gi_rasto_perguntado')).u1, T, 'passa a guardar a hora');
    T += 8 * 24 * 3600 * 1000;
    assert.equal(app.rstFaltaPerguntar(), true);
    app.localStorage.clear();
    const real = app.localStorage.setItem, ler = app.localStorage.getItem;
    app.localStorage.setItem = () => { throw new Error('vedado'); };
    app.localStorage.getItem = () => { throw new Error('vedado'); };
    try {
      app.rstTentarPergunta(); app.rstTentarPergunta();
      app.closeModal('x');
      assert.equal(app.rstFaltaPerguntar(), false, 'no mesmo carregamento não volta');
      vm.runInContext('rstPerguntou=false', app.__ctx);
      assert.equal(app.rstFaltaPerguntar(), true, 'na abertura seguinte, sim');
    } finally {
      app.localStorage.setItem = real; app.localStorage.getItem = ler;
    }
  });

  test('uma falha a gravar não liga e diz que se volta a perguntar', async () => {
    porEscolher();
    apiFalsa({ 'POST /api/rasto/escolha': new Error('sem rede') });
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    app.rstTentarPergunta(); app.rstTentarPergunta();
    assert.equal(await app.rstResponder('sim'), false);
    assert.equal(app.rstEscolha, null);
    assert.equal(app.rstLigado(), false);
    assert.match(avisos[0], /Não deu para guardar a tua escolha/);
  });
});

/* Esquece as contas que fecharam a pergunta neste aparelho.
   Devolve: nada. */
function localStorageLimpo() { app.localStorage.clear(); }

describe('as Definições', () => {
  test('a linha é um interruptor com o estado em palavras, e só aparece com a escolha sabida', () => {
    comSessao();
    vm.runInContext("rstAdotarEscolha(null,'u1')", app.__ctx);
    let h = app.rstLinhaDasDefinicoes();
    assert.match(h, /role="switch" aria-checked="false"/);
    assert.match(h, /data-toca="dados" data-click="rstMudarNasDefinicoes\(\)"/);
    assert.match(h, />Ajudar a melhorar</);
    assert.match(h, /Ainda não escolheste/);
    assert.ok(!SEM_EM_LINHA.test(h));
    assert.match(app.raizDasDefinicoes(), /id="rstDefinicoes"/, 'na raiz das Definições');
    vm.runInContext("rstAdotarEscolha('sim','u1')", app.__ctx);
    h = app.rstLinhaDasDefinicoes();
    assert.match(h, /aria-checked="true"/);
    assert.match(h, /class="small rst-def-ligado">Ligado, sem o teu nome. Desligar apaga o que já foi registado</);
    vm.runInContext("rstAdotarEscolha('nao','u1')", app.__ctx);
    assert.match(app.rstLinhaDasDefinicoes(), /Desligado: não guardamos onde tocas/);
    vm.runInContext('rstEscolha=undefined', app.__ctx);
    assert.doesNotMatch(app.raizDasDefinicoes(), /id="rstDefinicoes"/, 'por saber, não aparece');
  });

  test('tocar muda a escolha pela mesma rota: sim passa a não, não e por escolher passam a sim', async () => {
    comSessao();
    relogio();
    const pedidos = apiFalsa({ 'POST /api/rasto/escolha': (d) => ({ escolha: d.escolha }) });
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    vm.runInContext("rstAdotarEscolha('sim','u1')", app.__ctx);
    assert.equal(await app.rstMudarNasDefinicoes(), true);
    assert.equal(app.rstEscolha, 'nao');
    assert.equal(app.rstLigado(), false);
    await app.rstMudarNasDefinicoes();
    assert.equal(app.rstEscolha, 'sim');
    assert.equal(app.rstLigado(), true);
    vm.runInContext("rstAdotarEscolha(null,'u1')", app.__ctx);
    await app.rstMudarNasDefinicoes();
    assert.deepEqual(pedidos.map((p) => p[2].escolha), ['nao', 'sim', 'sim']);
    assert.deepEqual(avisos, ['Desligado. Apagámos o que estava registado.',
      'Ligado. Obrigado por ajudares a melhorar o Rendorium.', 'Ligado. Obrigado por ajudares a melhorar o Rendorium.']);
    assert.equal(app.rstFaltaPerguntar(), false, 'quem escolheu nas Definições já não é perguntado');
  });
});

describe('os embrulhos', () => {
  test('o go e o render seguem o ecrã; o render do vizinho às escondidas não conta', () => {
    ligar();
    app.rstGoDeAntes = (id) => { app.tab = id; };
    app.go('reports');
    assert.equal(app.rstEcra.ecra, 'reports');
    app.rstRenderDeAntes = () => {};
    app._pintarAParte = true;
    app.tab = 'fisco';
    app.render();
    assert.equal(app.rstEcra.ecra, 'reports');
    app._pintarAParte = false;
    app.render();
    assert.equal(app.rstEcra.ecra, 'fisco');
  });

  test('uma falha do rasto não parte quem foi embrulhado', () => {
    ligar();
    janelas();
    app.rstJanelaAbriu = () => { throw new Error('partiu'); };
    app.rstFecharAsQueSairam = () => { throw new Error('partiu'); };
    const L = app.openModal('A', '', '');
    assert.ok(L, 'a janela abre na mesma');
    app.closeModal();
    assert.equal(app.modalStack.length, 0, 'e fecha');
  });
});
