// O «?» do cabeçalho (navegacao.js:pintarBotaoAjuda, abrirAjuda,
// ajudaBrilho…): o botão #hdrAjuda onde estava a nuvem, antes do sino, abre a
// apresentação do separador onde se está (cloud/apresentacao.js:aprRever) —
// decisão do Martinho, 2026-10-29. Pinta-se só com sessão e num separador com
// apresentação (sem isso fica vazio e o :empty esconde-o), nunca nas
// Definições, e o toque fecha a gaveta e abre a apresentação. A Ajuda saiu da gaveta e da barra
// lateral (gavetaFundo) e da ilustração do fundo do menu na apresentação das
// Definições (cloud/apresentacao-analise.js:aprADefinicoesPerfil). Na
// primeira abertura da app neste aparelho, com o ecrã livre (fechadas as
// boas-vindas e a apresentação do separador), o «?» brilha uma vez
// (gi_ajuda_brilho); o brilho sai ao tocar-lhe, e sem armazenamento não brilha.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor, elementos } from './arnes.js';

const app = carregarApp();

/* Larga a vigia do brilho de uma app: um temporizador que ficou armado não
   corre por cima do teste seguinte.
   Recebe: a — a app.
   Devolve: nada. */
function largarVigia(a) {
  clearTimeout(a._ajudaBrilhoTempo);
  a._ajudaBrilhoTempo = null; a._ajudaBrilhoLivre = 0; a._ajudaBrilhoVoltas = 0; a._ajudaBrilhoFim = false;
}

afterEach(() => largarVigia(app));
afterEach(() => repor(app));

/* O #hdrAjuda com classes e atributos que se leem (o elemento falso do
   arnês não guarda nem uma coisa nem outra).
   Recebe: a — a app.
   Devolve: o botão, com .cls (as classes) e .atr (os atributos). */
function botao(a) {
  const b = a.document.getElementById('hdrAjuda');
  const cls = new Set(), atr = {};
  b.classList = { add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)),
    toggle: (c, v) => ((v ?? !cls.has(c)) ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) };
  b.setAttribute = (k, v) => { atr[k] = String(v); };
  b.getAttribute = (k) => (k in atr ? atr[k] : null);
  b.removeAttribute = (k) => { delete atr[k]; };
  b.cls = cls; b.atr = atr;
  return b;
}

/* Um body com um classList de verdade, para a gaveta (o body.open).
   Recebe: a — a app.
   Devolve: {cls, repor}. */
function corpo(a) {
  const body = a.document.body, antigo = body.classList, cls = new Set();
  body.classList = { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, v) => ((v ?? !cls.has(c)) ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) };
  return { cls, repor: () => { body.classList = antigo; } };
}

/* A app limpa, na Visão geral, sem janelas, com o aparelho vazio e, se se
   pede, com sessão.
   Recebe: sessao (opcional) — true para pôr uma sessão em CW.user.
   Devolve: o #hdrAjuda (botao). */
function montar(sessao) {
  limpar(app);
  largarVigia(app);
  app.localStorage.clear();
  app.modalStack.length = 0;
  app.tab = 'dashboard'; app.setPage = '';
  app.window.CW = Object.assign(app.window.CW || {}, { user: sessao ? { id: 'EU', name: 'Ana Silva' } : null });
  apresentacoes(app);
  return botao(app);
}

/* As apresentações da nuvem, de mentira, numa app só da base: a Visão geral
   e os Imóveis têm; o aprRever regista o que se abriu.
   Recebe: a — a app; ids (opcional) — os separadores com apresentação.
   Devolve: o array das apresentações abertas (o que o aprRever recebeu). */
function apresentacoes(a, ids = ['dashboard', 'properties']) {
  const abertas = [];
  a.APRESENTACOES = Object.fromEntries(ids.map((id) => [id, { nome: id, imagens: [{}] }]));
  a.aprImagensVisiveis = (id) => (a.APRESENTACOES[id] ? [{}] : []);
  a.aprRever = (id) => { abertas.push(id); };
  return abertas;
}

describe('o «?» pinta-se e acende', () => {
  test('com sessão leva o ícone da Ajuda; sem ela fica vazio (e o :empty esconde-o), sem aceso nem brilho', () => {
    const b = montar(true);
    app.buildNav();
    assert.equal(b.innerHTML, app.ic('ajuda', 16), 'o ícone da Ajuda, do tamanho do sino');
    assert.ok(!b.cls.has('on') && b.atr['aria-current'] === undefined, 'na Visão geral, apagado');
    b.cls.add('brilha');
    app.window.CW.user = null;
    app.buildNav();
    assert.equal(b.innerHTML, '', 'sem sessão, vazio');
    assert.ok(!b.cls.has('on') && !b.cls.has('brilha'), 'nem aceso nem a brilhar');
  });

  test('nas Definições (a raiz, as subpáginas e a Ajuda) não aparece; volta nos separadores — pelo goSet, pelo go e pelo voltar (só o render)', () => {
    const b = montar(true);
    const icone = app.ic('ajuda', 16);
    app.buildNav();
    assert.equal(b.innerHTML, icone, 'controlo: na Visão geral está lá');
    app.abrirDefinicoes('ajuda');
    assert.equal(app.tab, 'settings'); assert.equal(app.setPage, 'ajuda');
    assert.equal(b.innerHTML, '', 'na Ajuda, vazio (o :empty esconde-o)');
    assert.ok(!b.cls.has('on') && b.atr['aria-current'] === undefined, 'e nunca aceso');
    app.goSet('faq');
    assert.equal(b.innerHTML, '', 'noutra subpágina das Definições, vazio');
    // o voltar do sistema (componentes.js, o popstate) sai da subpágina só com o render
    app.setPage = ''; app.render();
    assert.equal(b.innerHTML, '', 'na raiz das Definições, vazio');
    b.cls.add('brilha');
    app.render();
    assert.ok(!b.cls.has('brilha'), 'nas Definições não brilha');
    app.go('dashboard');
    assert.equal(b.innerHTML, icone, 'noutro separador, de volta');
  });

  test('só num separador com apresentação: sem ela (ou sem imagens para esta conta) fica vazio', () => {
    const b = montar(true);
    app.buildNav();
    assert.equal(b.innerHTML, app.ic('ajuda', 16), 'controlo: a Visão geral tem');
    app.go('contracts');
    assert.equal(b.innerHTML, '', 'os Contratos, aqui sem apresentação, ficam sem o «?»');
    app.go('properties');
    assert.equal(b.innerHTML, app.ic('ajuda', 16), 'os Imóveis têm');
    app.aprImagensVisiveis = () => [];
    app.render();
    assert.equal(b.innerHTML, '', 'sem imagens para esta conta (um serviço desligado), vazio');
  });

  test('o ícone não se reescreve quando não muda (cada pintura passa por aqui)', () => {
    const b = montar(true);
    app.buildNav();
    let escritas = 0, html = b.innerHTML;
    Object.defineProperty(b, 'innerHTML', { configurable: true, get: () => html, set: (v) => { escritas++; html = v; } });
    app.buildNav(); app.render(); app.pintarBotaoAjuda();
    assert.equal(escritas, 0);
    delete b.innerHTML;
  });
});

describe('o toque no «?» abre a apresentação do ecrã', () => {
  test('abre a apresentação do separador onde se está, sem mudar de ecrã, fecha a gaveta e tira o brilho', () => {
    const b = montar(true), c = corpo(app);
    const abertas = apresentacoes(app);
    try {
      c.cls.add('open'); b.cls.add('brilha');
      app.abrirAjuda();
      assert.deepEqual(abertas, ['dashboard'], 'a da Visão geral');
      assert.equal(app.tab, 'dashboard', 'fica no ecrã');
      assert.equal(c.cls.has('open'), false, 'a gaveta fecha');
      assert.equal(b.cls.has('brilha'), false, 'o brilho sai');
      app.go('properties');
      app.abrirAjuda();
      assert.deepEqual(abertas, ['dashboard', 'properties'], 'noutro separador, a dele');
      app.go('contracts');
      app.abrirAjuda();
      app.tab = 'settings';
      app.abrirAjuda();
      assert.deepEqual(abertas, ['dashboard', 'properties'], 'sem apresentação, ou nas Definições, não abre nada');
    } finally { c.repor(); }
  });

  test('o fundo da gaveta já não tem a Ajuda, mas tem o cartão da conta', () => {
    montar(true);
    const fundo = app.gavetaFundo();
    assert.ok(fundo.includes('class="nav-conta"') && fundo.includes('O meu perfil'), 'o cartão da conta');
    assert.ok(!/Ajuda|abrirDefinicoes\('ajuda'\)|abrirAjuda/.test(fundo), 'e nada da Ajuda');
    app.tab = 'settings'; app.setPage = 'ajuda';
    app.buildNav();
    assert.ok(!/<span class="txt">Ajuda<\/span>/.test(elementos(app).nav.innerHTML), 'nem na Ajuda aberta');
  });
});

describe('o brilho da primeira abertura', () => {
  test('com sessão e o ecrã livre, brilha e grava a marca; noutra abertura (a marca no aparelho) não volta', () => {
    const b = montar(true);
    app.buildNav();
    assert.equal(app.ajudaBrilhoPorque(), '', 'o ecrã está livre');
    assert.equal(app.ajudaBrilhoTentar(), true);
    assert.ok(b.cls.has('brilha'), 'brilha');
    assert.equal(app.localStorage.getItem('gi_ajuda_brilho'), '1', 'e o aparelho fica marcado');
    b.cls.delete('brilha');
    assert.equal(app.ajudaBrilhoTentar(), false, 'na mesma abertura, uma vez só');
    // outra abertura: a app de novo, com a marca no aparelho
    const outra = carregarApp({ antes: (j) => { j.localStorage.setItem('gi_ajuda_brilho', '1'); } });
    try {
      const b2 = botao(outra);
      outra.window.CW = { user: { id: 'EU', name: 'Ana Silva' } };
      apresentacoes(outra);
      outra.buildNav();
      assert.equal(outra.ajudaBrilhoPorque(), 'feito');
      assert.equal(outra.ajudaBrilhoTentar(), false);
      assert.ok(!b2.cls.has('brilha'), 'não volta a brilhar');
      assert.equal(outra._ajudaBrilhoTempo, null, 'nem arma a vigia');
    } finally { largarVigia(outra); }
  });

  test('não entra sem sessão, com uma janela aberta, com a gaveta aberta, nem com uma apresentação por mostrar', () => {
    let b = montar(false);
    app.buildNav();
    assert.equal(app.ajudaBrilhoTentar(), false, 'sem sessão');
    b = montar(true);
    app.buildNav();
    app.modalStack.push({ el: {} });
    assert.equal(app.ajudaBrilhoPorque(), 'janela');
    assert.equal(app.ajudaBrilhoTentar(), false, 'com uma janela aberta (as boas-vindas, a apresentação, as novidades)');
    app.modalStack.length = 0;
    const c = corpo(app);
    try {
      c.cls.add('open');
      assert.equal(app.ajudaBrilhoTentar(), false, 'com a gaveta aberta');
    } finally { c.repor(); }
    app.aprQueAbrir = () => 'boas-vindas';
    assert.equal(app.ajudaBrilhoPorque(), 'apresentacao');
    assert.equal(app.ajudaBrilhoTentar(), false, 'com uma apresentação por abrir neste arranque');
    app.aprQueAbrir = () => '';
    app.aprEcraOcupado = () => 'estado';
    assert.equal(app.ajudaBrilhoTentar(), false, 'antes de o estado do servidor chegar (a apresentação ainda não sabe)');
    app.aprEcraOcupado = () => '';
    assert.ok(!b.cls.has('brilha'));
    assert.equal(app.localStorage.getItem('gi_ajuda_brilho'), null, 'e a marca fica por gravar');
    assert.equal(app.ajudaBrilhoTentar(), true, 'livre o ecrã, brilha');
  });

  test('a vigia só acende com o ecrã livre em duas olhadelas seguidas (a janela que abre logo a seguir a outra fechar)', () => {
    const b = montar(true);
    app.buildNav();
    assert.ok(app._ajudaBrilhoTempo, 'a pintura com sessão arma a vigia');
    largarVigia(app);
    app.ajudaBrilhoPasso();
    assert.ok(!b.cls.has('brilha'), 'uma olhadela livre não chega');
    app.modalStack.push({ el: {} });                // as novidades abriram entretanto
    app.ajudaBrilhoPasso();
    app.modalStack.length = 0;
    app.ajudaBrilhoPasso();
    assert.ok(!b.cls.has('brilha'), 'a janela pelo meio recomeça a conta');
    app.ajudaBrilhoPasso();
    assert.ok(b.cls.has('brilha'), 'duas seguidas livres: brilha');
    assert.equal(app._ajudaBrilhoTempo, null, 'e a vigia para');
  });

  test('tocar no «?» antes de brilhar marca o aparelho: já o encontrou, e não brilha depois', () => {
    const b = montar(true);
    app.buildNav();
    app.abrirAjuda();
    assert.equal(app.localStorage.getItem('gi_ajuda_brilho'), '1');
    assert.equal(app._ajudaBrilhoTempo, null, 'a vigia larga-se');
    app.ajudaBrilhoTentar();
    assert.ok(!b.cls.has('brilha'));
  });

  test('sem armazenamento (que recusa ler ou gravar) não brilha, e não rebenta', () => {
    const fecha = carregarApp({ antes: (j) => { j.localStorage.getItem = () => { throw new Error('fechado'); }; } });
    const grava = carregarApp({ antes: (j) => { j.localStorage.setItem = () => { throw new Error('cheio'); }; } });
    try {
      for (const a of [fecha, grava]) {
        const b = botao(a);
        a.window.CW = { user: { id: 'EU', name: 'Ana Silva' } };
        const abertas = apresentacoes(a);
        assert.doesNotThrow(() => a.buildNav());
        assert.equal(a.ajudaBrilhoTentar(), false);
        assert.ok(!b.cls.has('brilha'), 'sem brilho');
        assert.doesNotThrow(() => a.abrirAjuda(), 'e o toque abre a apresentação na mesma');
        assert.deepEqual(abertas, ['dashboard']);
      }
      assert.equal(fecha.ajudaBrilhoPorque(), 'armazenamento');
    } finally { largarVigia(fecha); largarVigia(grava); }
  });

  test('com a apresentação a sério: as boas-vindas de uma conta nova por ver seguram o brilho; vistas, o «?» brilha', () => {
    const t = carregarTudo();
    try {
      limpar(t);
      clearTimeout(t._aprTempo); t._aprTempo = null;
      t.modalStack.length = 0;
      t.CW.user = { id: 'EU', name: 'Maria Costa', email: 'eu@exemplo.pt' };
      t.CW._pulled = 1; t.CW.cargos = {}; t.CW.selMode = false; t.CW.editMode = false;
      t.CW._chegadaPorAbrir = false; t.CW._chegadaEmCurso = false;
      t.document.querySelector = (s) => (s === 'body' ? t.document.body : null);
      t.tab = 'dashboard'; t.setPage = '';
      const b = botao(t);
      t.pintarBotaoAjuda();
      t.aprContaNova('EU');
      assert.equal(t.aprQueAbrir(), 'boas-vindas', 'controlo: as boas-vindas estão por ver');
      assert.equal(t.ajudaBrilhoTentar(), false, 'o brilho espera por elas');
      t.aprMarcarVista(['boas-vindas', 'dashboard']); t.aprLargarContaNova();
      assert.equal(t.aprQueAbrir(), '', 'controlo: vistas, nada por abrir aqui');
      assert.equal(t.ajudaBrilhoTentar(), true, 'e o «?» brilha');
      assert.ok(b.cls.has('brilha'));
    } finally { clearTimeout(t._aprTempo); largarVigia(t); }
  });
});

describe('a apresentação das Definições', () => {
  test('a ilustração do fundo do menu já não desenha a Ajuda: as Definições e o cartão da conta', () => {
    const t = carregarTudo();
    try {
      t.CW.user = { id: 'EU', name: 'Maria Costa' };
      const html = t.aprADefinicoesPerfil();
      const gaveta = html.slice(html.indexOf('apr-a-gaveta'), html.indexOf('apr-a-conta'));
      assert.ok(gaveta.includes('Definições'), 'as Definições ficam');
      assert.ok(!gaveta.includes('Ajuda') && !gaveta.includes(t.ic('ajuda', 12)), 'a Ajuda saiu');
      assert.ok(html.includes('apr-a-conta') && html.includes('Maria Costa'), 'o cartão da conta, em destaque');
    } finally { clearTimeout(t._aprTempo); largarVigia(t); }
  });
});
