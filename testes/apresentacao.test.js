// A apresentação (cloud/apresentacao.js): o registo, a janela com o
// carrossel, o gesto que decide como o das fotos, as boas-vindas de quem cria
// conta (só com o sinal de conta nova, uma vez, com o fim adaptado a quem só
// colabora e a quem já tem imóveis), a espera pelo ecrã livre, a primeira
// visita a um separador (e não o vizinho que o deslize pinta, e nas
// Definições só a raiz), o estado em db.settings a sobreviver à fusão entre
// aparelhos, o novo:true do Google só para a conta que nasce, a espera mútua
// com as novidades, a secção da Ajuda e o kit das maquetes. A app inteira,
// nuvem incluída (carregarTudo), com a sessão simulada em CW.user e as janelas
// numa camada de brincar que guarda o que a janela escreve nela.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, generateKeyPairSync, sign as assinarNode } from 'node:crypto';
import { carregarTudo, limpar, repor, igual } from './arnes.js';
import { ambiente, pedir } from './lib/api.js';
import { fundirCasaComBase } from '../worker/src/lib/permissoes.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const app = carregarTudo();
afterEach(() => repor(app));
// uma tentativa que ficou agendada (APR_ESPERA, APR_INSISTE) não corre por cima do teste seguinte
afterEach(() => { clearTimeout(app._aprTempo); app._aprTempo = null; app._aprLeituras = 0; });

const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/* Um elemento de brincar: as classes, os atributos, o style e o texto, e o
   tamanho que o palco teria.
   Recebe: classes (opcional) — as classes de início (array).
   Devolve: o elemento. */
function no(classes) {
  const cl = new Set(classes || []), at = {};
  return {
    at, style: {}, textContent: '', children: [],
    classList: {
      add: (c) => cl.add(c), remove: (c) => cl.delete(c), contains: (c) => cl.has(c),
      toggle: (c, on) => { const v = on === undefined ? !cl.has(c) : !!on; if (v) cl.add(c); else cl.delete(c); return v; },
    },
    setAttribute(k, v) { at[k] = String(v); }, getAttribute(k) { return k in at ? at[k] : null; }, removeAttribute(k) { delete at[k]; },
    focus() {}, querySelector() { return null; },
    getBoundingClientRect: () => ({ width: 320, height: 240, top: 0, left: 0, bottom: 240, right: 320 }),
  };
}

/* A camada de uma janela aberta, com as peças que a apresentação procura
   (o palco, a fita, as imagens, os pontos, os dois botões e a frase do
   leitor de ecrã), montada a partir do HTML que o openModal recebeu.
   Recebe: corpo, rodape — o HTML.
   Devolve: {el, pecas}. */
function camada(corpo, rodape) {
  const n = (String(corpo).match(/class="apr-folha/g) || []).length;
  const folhas = Array.from({ length: n }, (_, k) => {
    const f = no(k === 0 ? ['apr-folha', 'apr-estreia'] : ['apr-folha']);
    if (k) { f.setAttribute('aria-hidden', 'true'); f.setAttribute('inert', ''); }
    return f;
  });
  const pontos = no(); pontos.children = Array.from({ length: n }, (_, k) => no(k === 0 ? ['on'] : []));
  const fita = no(), palco = no();
  palco.querySelector = (s) => (s === '.apr-fita' ? fita : null);
  const pecas = { fita, palco, pontos, folhas, ant: no(/apr-ant u-d-none/.test(rodape) ? ['u-d-none'] : []), seg: no(), vivo: no() };
  const mapa = { '.apr-fita': fita, '.apr-palco': palco, '.apr-pontos': pontos, '.apr-ant': pecas.ant, '.apr-seg': pecas.seg, '.apr-so-leitor': pecas.vivo };
  const classes = new Set();
  const el = {
    classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) },
    querySelector: (s) => mapa[s] || null,
    querySelectorAll: (s) => (s === '.apr-folha' ? folhas : []),
  };
  return { el, pecas, classes };
}

/* As janelas numa pilha observável: o openModal empilha uma camada com o
   título, o corpo e o rodapé; o closeModal e o closeAllModals tiram-nas e
   correm o aoFechar, com a origem do fecho, como o verdadeiro. O save fica calado (grava no
   aparelho, e o que interessa é o db).
   Devolve: as camadas abertas, pela ordem. */
function janelas() {
  const abertas = [];
  app.openModal = (t, b, f) => {
    const c = camada(b, f);
    const L = { el: c.el, pecas: c.pecas, classes: c.classes, t, b, f };
    app.modalStack.push(L); abertas.push(L);
    return L;
  };
  const fecha = (origem) => { const L = app.modalStack.pop(); if (L && typeof L.aoFechar === 'function') L.aoFechar(typeof origem === 'string' ? origem : ''); };
  app.closeModal = fecha;
  app.closeAllModals = () => { while (app.modalStack.length) fecha(); };
  app.save = () => {};
  app.go = (id) => { app.tab = id; };
  return abertas;
}

/* A app limpa, com sessão e já depois do primeiro estado, sem janelas, sem
   o sinal de conta nova e sem apresentações dos separadores registadas
   (ficam só as boas-vindas, que são deste ficheiro).
   Recebe: opcoes (opcional) — {nome, respondida}: o nome da conta, e
   respondida para uma conta que já respondeu à pergunta de quem fecha a
   meio (aprPerguntar), e que fecha por qualquer caminho sem a ouvir.
   Devolve: as janelas (janelas()). */
function montar(opcoes = {}) {
  limpar(app);
  clearTimeout(app._aprTempo); app._aprTempo = null;
  app.modalStack.length = 0;
  app.CW.user = { id: 'EU', name: opcoes.nome === undefined ? 'Maria Costa' : opcoes.nome, email: 'eu@exemplo.pt' };
  app.CW._pulled = 1; app.CW._esperaFim = 1;
  app.CW.cargos = {};
  app.CW._chegadaPorAbrir = false; app.CW._chegadaEmCurso = false;
  app.CW.selMode = false; app.CW.editMode = false;
  app.CW._aprNova = ''; app._aprAdiado = ''; app._aprUltimoEcra = '';
  app.localStorage.removeItem('gi_apr_nova');
  for (const id of Object.keys(app.APRESENTACOES)) if (id !== 'boas-vindas') delete app.APRESENTACOES[id];
  app.tab = 'dashboard'; app.setPage = '';
  if (opcoes.respondida) { app.db.settings = app.db.settings || {}; app.db.settings.apresentacoes = { perguntou: 1 }; }
  consulta({});
  return janelas();
}

/* O que o document.querySelector encontra: o body (sem ele a janela não tem
   onde abrir — o document do arnês não tem nada) e os elementos do mapa.
   Recebe: mapa — {seletor: elemento}.
   Devolve: nada. */
function consulta(mapa) {
  app.document.querySelector = (s) => (s === 'body' ? app.document.body : mapa[s] || null);
}

/* Uma apresentação de separador de brincar, com n imagens.
   Recebe: id — o separador; n (opcional) — quantas imagens (2).
   Devolve: nada. */
function registarDeBrincar(id, n = 2) {
  app.registarApresentacao(id, { nome: 'Do ' + id, imagens: Array.from({ length: n }, (_, k) => ({ titulo: 'Imagem ' + (k + 1), texto: 'O texto <b>' + k + '</b>.', maquete: () => app.aprCena(app.aprSelo('x')) })) });
}

const vistas = () => JSON.parse(JSON.stringify((app.db.settings || {}).apresentacoes || {}));

describe('o registo', () => {
  test('regista pelo id, recusa o que não tem lista de imagens, e as boas-vindas vêm registadas com sete imagens', () => {
    montar();
    app.registarApresentacao('contracts', { nome: 'Contratos', imagens: [{ titulo: 'a', texto: 'b', maquete: () => '' }] });
    app.registarApresentacao('', { nome: 'x', imagens: [] });
    app.registarApresentacao('reports', { nome: 'sem imagens' });
    assert.ok(app.APRESENTACOES.contracts, 'registada');
    assert.equal(app.APRESENTACOES.reports, undefined, 'sem lista de imagens não entra');
    assert.equal(app.APRESENTACOES['boas-vindas'].imagens.length, 7);
    igual(app.APRESENTACOES['boas-vindas'].marcaTambem, ['dashboard', 'properties']);
  });

  test('as imagens: o quando filtra (e um que rebenta fica de fora), o título e o texto podem ser funções, e uma maquete que rebenta deixa a imagem vazia', () => {
    montar();
    app.registarApresentacao('groups', { nome: () => 'Grupos', imagens: [
      { titulo: () => 'Dinâmico', texto: 'Fixo.', maquete: () => { throw new Error('x'); } },
      { titulo: 'Escondida', texto: '', maquete: () => 'm', quando: () => false },
      { titulo: 'Rebenta', texto: '', maquete: () => 'm', quando: () => { throw new Error('y'); } },
      { titulo: 'Sim', texto: '', maquete: () => '<i>m</i>', quando: () => true },
    ] });
    igual(app.aprImagensDe('groups'), [{ titulo: 'Dinâmico', texto: 'Fixo.', html: '' }, { titulo: 'Sim', texto: '', html: '<i>m</i>' }]);
    igual(app.aprImagensDe('nada'), []);
  });
});

describe('a janela', () => {
  test('o ✕ é o da cabeça da janela, e o corpo tem o palco com a fita, uma imagem por cada (só a primeira à vista), os pontos e a frase do leitor de ecrã', () => {
    assert.match(ler('web/app/componentes.js'), /<button class="iconbtn" data-toca="camada" data-click="closeModal\('x'\)" aria-label="Fechar">/,
      'o ✕ do modalLayer, no canto de cima à direita, é o que fecha a apresentação');
    const ab = montar();
    registarDeBrincar('contracts', 3);
    const L = app.aprAbrir('contracts', { marcar: true });
    assert.equal(ab.length, 1);
    assert.equal(L.t, 'Do contracts', 'o título da janela é o nome');
    assert.ok(L.classes.has('apr-janela'));
    assert.match(L.b, /class="apr-palco" role="region" aria-roledescription="carrossel" aria-label="Do contracts" data-pointerdown="aprArrastar\(event,this\)"/);
    assert.equal((L.b.match(/class="apr-folha/g) || []).length, 3);
    assert.match(L.b, /<section class="apr-folha apr-estreia" role="group" aria-roledescription="imagem" aria-label="1 de 3">/, 'a primeira à vista, com a estreia');
    assert.match(L.b, /aria-label="2 de 3" aria-hidden="true" inert>/, 'as outras inertes e escondidas');
    assert.match(L.b, /<h3 class="apr-tit">Imagem 1<\/h3><p class="apr-txt">O texto <b>0<\/b>.<\/p>/);
    assert.match(L.b, /<div class="apr-pontos" aria-hidden="true"><span class="on"><\/span><span><\/span><span><\/span><\/div>/);
    assert.match(L.b, /<p class="apr-so-leitor" aria-live="polite" aria-atomic="true"><\/p>/);
    assert.equal(L.pecas.vivo.textContent, 'Imagem 1 de 3: Imagem 1');
    assert.doesNotMatch(L.b + L.f, /style=|\son[a-z]+=/, 'nada que a CSP recuse');
  });

  test('o rodapé: sem Anterior na primeira, Anterior e Seguinte no meio, e na última o botão do fim — «Percebi» por omissão', () => {
    montar();
    registarDeBrincar('contracts', 3);
    const L = app.aprAbrir('contracts', { marcar: true });
    const { ant, seg } = L.pecas, c = L.apr;
    assert.ok(ant.classList.contains('u-d-none'), 'sem Anterior na primeira');
    assert.equal(seg.textContent, 'Seguinte');
    app.aprSeguinte();
    assert.equal(c.i, 1);
    assert.ok(!ant.classList.contains('u-d-none'), 'o Anterior aparece');
    assert.equal(L.pecas.folhas[1].getAttribute('aria-hidden'), null, 'a de agora à vista');
    assert.equal(L.pecas.folhas[0].getAttribute('aria-hidden'), 'true', 'a de antes escondida');
    assert.ok(!L.pecas.folhas[0].classList.contains('apr-estreia'), 'a estreia é só da abertura');
    assert.ok(L.pecas.pontos.children[1].classList.contains('on') && !L.pecas.pontos.children[0].classList.contains('on'));
    app.aprSeguinte();
    assert.equal(seg.textContent, 'Percebi', 'na última, o fim');
    assert.equal(seg.getAttribute('data-toca'), 'camada');
    assert.equal(L.pecas.vivo.textContent, 'Imagem 3 de 3: Imagem 3');
    app.aprPassar(-1);
    assert.equal(c.i, 1);
    assert.equal(seg.textContent, 'Seguinte');
    app.aprSeguinte(); app.aprSeguinte();
    assert.equal(app.modalStack.length, 0, '«Percebi» fecha');
    assert.equal(c.i, 2, 'não passou da última');
  });

  test('as setas do teclado passam de imagem (sem dar a volta), e não num campo nem com uma tecla de modo', () => {
    montar();
    registarDeBrincar('contracts', 2);
    const L = app.aprAbrir('contracts', { marcar: true });
    const tecla = (key, extra) => app.aprTecla(Object.assign({ key, target: { tagName: 'DIV' }, preventDefault() {} }, extra));
    tecla('ArrowLeft');
    assert.equal(L.apr.i, 0, 'antes da primeira não há nada');
    tecla('ArrowRight');
    assert.equal(L.apr.i, 1);
    tecla('ArrowRight');
    assert.equal(L.apr.i, 1, 'depois da última também não');
    tecla('ArrowLeft', { target: { tagName: 'INPUT' } });
    tecla('ArrowLeft', { ctrlKey: true });
    assert.equal(L.apr.i, 1);
    tecla('ArrowLeft');
    assert.equal(L.apr.i, 0);
    assert.equal(L.pecas.fita.style.transform, '', 'na primeira a fita está no sítio');
    tecla('ArrowRight');
    assert.equal(L.pecas.fita.style.transform, 'translateX(calc(-100% - 1 * var(--apr-folga)))', 'e na segunda, em percentagem');
  });

  test('o deslize decide como o das fotos: o eixo aos 10px, um quarto da largura ou um sacudir — mas nas pontas não dá a volta', () => {
    for (const dx of [-40, -11, -10, -9, 0, 9, 10, 25]) {
      for (const dy of [-30, -11, 0, 10, 11, 40]) assert.equal(app.aprEixo(dx, dy), app.fotoEixo(dx, dy), dx + ',' + dy);
    }
    for (const desl of [-200, -81, -79, -31, -29, 0, 29, 31, 79, 81, 200]) {
      for (const vx of [-1, -0.5, -0.3, 0, 0.3, 0.5, 1]) {
        assert.equal(app.aprDecide(desl, 320, vx, 1, 3), app.fotoDecide(desl, 320, vx), desl + '/' + vx + ' no meio');
      }
    }
    assert.equal(app.aprDecide(200, 320, 0, 0, 3), 0, 'na primeira, para a direita, volta ao sítio');
    assert.equal(app.aprDecide(-200, 320, 0, 2, 3), 0, 'na última, para a esquerda, também');
    assert.equal(app.aprDecide(-200, 320, 0, 0, 3), 1);
  });

  test('um arrasto de lado leva a fita (preso a uma imagem) e passa à vizinha; nas pontas resiste; um gesto vertical é do corpo', () => {
    montar();
    registarDeBrincar('contracts', 3);
    const L = app.aprAbrir('contracts', { marcar: true });
    const ouvintes = {};
    const docAntes = { add: app.document.addEventListener, rem: app.document.removeEventListener };
    app.document.addEventListener = (t, f) => { ouvintes[t] = f; };
    app.document.removeEventListener = (t) => { delete ouvintes[t]; };
    const ev = (x, y, type) => ({ pointerId: 7, clientX: x, clientY: y, button: 0, isPrimary: true, type });
    try {
      app.aprArrastar(ev(200, 100), L.pecas.palco);
      ouvintes.pointermove(ev(195, 100));
      ouvintes.pointermove(ev(60, 104));
      assert.match(L.pecas.fita.style.transform, /^translateX\(-?\d/, 'a fita segue o dedo');
      ouvintes.pointerup(ev(60, 104, 'pointerup'));
      assert.equal(L.apr.i, 1, 'mais de um quarto: passou à seguinte');
      // na primeira de volta, para a direita: resiste e não vira
      app.aprIr(L.apr, 0);
      app.aprArrastar(ev(100, 100), L.pecas.palco);
      ouvintes.pointermove(ev(115, 100));
      ouvintes.pointermove(ev(400, 100));
      const x = Number(/translateX\((-?[\d.]+)px\)/.exec(L.pecas.fita.style.transform)[1]);
      assert.ok(x > 0 && x < 160, 'a ponta resiste: andou ' + x + ' de 285');
      ouvintes.pointerup(ev(400, 100, 'pointerup'));
      assert.equal(L.apr.i, 0, 'e volta ao sítio');
      // vertical: o gesto não é do carrossel
      app.aprArrastar(ev(100, 100), L.pecas.palco);
      ouvintes.pointermove(ev(102, 140));
      assert.equal(app._aprArrasto, null, 'largou o gesto ao corpo da janela');
      assert.equal(L.apr.i, 0);
    } finally {
      app.document.addEventListener = docAntes.add; app.document.removeEventListener = docAntes.rem;
    }
  });
});

describe('as boas-vindas', () => {
  test('só com o sinal de conta nova, e da conta que tem a sessão; vistas uma vez, não voltam', () => {
    montar({ respondida: true });
    assert.equal(app.aprQueAbrir(), '', 'uma conta de antes não as vê');
    app.aprContaNova('OUTRA');
    assert.equal(app.aprQueAbrir(), '', 'o sinal de outra conta não vale para esta');
    app.aprContaNova('EU');
    assert.equal(app.localStorage.getItem('gi_apr_nova'), 'EU', 'fica no aparelho');
    assert.equal(app.aprQueAbrir(), 'boas-vindas');
    app.aprTentar();
    assert.equal(app.modalStack.length, 1, 'com o ecrã livre, abrem');
    assert.equal(app.modalStack[0].t, 'Boas-vindas');
    app.closeModal('x');
    assert.ok(vistas()['boas-vindas'], 'o ✕ marca-as como vistas');
    assert.equal(app.localStorage.getItem('gi_apr_nova'), null, 'e larga o sinal');
    app.aprContaNova('EU');
    assert.equal(app.aprQueAbrir(), '', 'vistas (aqui ou noutro aparelho), não voltam');
    app.aprTentar();
    assert.equal(app.localStorage.getItem('gi_apr_nova'), null, 'um sinal que as definições desmentem larga-se');
  });

  test('por ver viajam nas definições: quem fecha a app antes de as ver vê-as noutro aparelho, e vistas já não', () => {
    montar({ respondida: true });
    app.CW._pulled = 0;
    app.aprContaNova('EU');
    app.aprGuardarPorVer();
    assert.equal('boas-vindas' in vistas(), false, 'antes de o servidor responder, nada vai para as definições');
    app.CW._pulled = 1;
    consulta({ '#cwLegal': {} });
    app.aprTentar();
    assert.equal(vistas()['boas-vindas'], 0, 'com o servidor a responder, a marca «por ver» fica nas definições');
    assert.equal(app.modalStack.length, 0, 'e o aviso inicial ainda tapa o ecrã');
    // outro aparelho: o mesmo estado, sem o sinal
    app.CW._aprNova = '';
    app.localStorage.removeItem('gi_apr_nova');
    consulta({});
    assert.equal(app.aprQueAbrir(), 'boas-vindas', 'sem o sinal, a marca das definições chega');
    app.aprTentar();
    assert.equal(app.modalStack.length, 1, 'e abrem');
    app.closeModal('x');
    assert.equal(vistas()['boas-vindas'], 1, 'fechadas, a marca passa a vista');
    assert.equal(app.aprQueAbrir(), '', 'e não voltam');
  });

  test('a primeira imagem diz a frase do Martinho, com o primeiro nome da conta — e sem nome, só «Parabéns.»', () => {
    montar({ nome: 'Maria da Conceição Costa' });
    const im = app.aprImagensDe('boas-vindas');
    assert.equal(im[0].titulo, 'Parabéns, Maria. A partir de hoje, nenhuma renda te passa despercebida.');
    assert.equal(im[0].texto, 'Cada imóvel, cada contrato e cada euro no sítio certo, e a app a lembrar-te do que vem a seguir.');
    montar({ nome: '' });
    assert.equal(app.aprImagensDe('boas-vindas')[0].titulo, 'Parabéns. A partir de hoje, nenhuma renda te passa despercebida.');
  });

  test('as sete imagens: o imóvel, o inquilino, o contrato, os planeados com as quatro origens e o confirmar, os modelos e a vantagem, e o fim', () => {
    montar();
    const im = app.aprImagensDe('boas-vindas');
    assert.equal(im.length, 7);
    assert.match(im[1].texto, /Casas → Imóveis/);
    assert.match(im[2].texto, /Casas → Pessoas → Inquilinos/);
    assert.match(im[3].texto, /Casas → Contratos/);
    assert.match(im[4].texto, /Dinheiro → Planeados/);
    for (const o of ['renda dos contratos', 'prestação das hipotecas', 'o IMI, o condomínio e o seguro', 'à mão', 'Confirmar']) assert.ok(im[4].texto.includes(o), o);
    for (const o of ['do contrato', 'da hipoteca', 'do imóvel', 'à mão', 'Confirmar']) assert.ok(im[4].html.includes(o), 'a maquete mostra «' + o + '»');
    assert.match(im[5].texto, /movimento guardado para copiar/);
    assert.match(im[5].texto, /A partir de um modelo/);
    assert.equal(im[6].titulo, 'Cria o teu primeiro imóvel');
    const L = app.aprAbrir('boas-vindas', { marcar: true });
    app.aprIr(L.apr, 6);
    assert.equal(L.pecas.seg.textContent, 'Ir para os imóveis');
    assert.equal(L.pecas.seg.getAttribute('data-toca'), 'ecra');
  });

  test('«Ir para os imóveis» fecha e leva aos Imóveis, e fechar as boas-vindas marca também a Visão geral e os Imóveis', () => {
    montar();
    app.aprContaNova('EU');
    const L = app.aprAbrir('boas-vindas', { marcar: true });
    app.aprIr(L.apr, 6);
    app.aprSeguinte();
    assert.equal(app.modalStack.length, 0);
    assert.equal(app.tab, 'properties');
    igual(Object.keys(vistas()).sort(), ['boas-vindas', 'dashboard', 'properties']);
    registarDeBrincar('properties');
    registarDeBrincar('dashboard');
    assert.equal(app.aprQueAbrir(), '', 'nada de duas janelas seguidas');
  });

  test('o fim adaptado: quem só colabora não vê como se cria o que o cargo não deixa, e quem já tem imóveis vê que estão à espera', () => {
    montar();
    app.db.properties.push(app.normProp({ id: 'P1', name: 'T2 Arroios', ownerIds: ['OUTRO'], _sharedFrom: 'Rita Lopes' }));
    app.CW.cargos = { P1: { dono: false, perms: ['tx.view', 'tx.add', 'rec.view', 'rec.add'], nome: 'Contabilista' } };
    assert.ok(app.souSoColaborador());
    const im = app.aprImagensDe('boas-vindas');
    igual(im.map((x) => x.titulo.split('.')[0]), ['Parabéns, Maria', 'O que se repete fica planeado', 'Modelos para o que não tem data', 'Os imóveis já estão à tua espera']);
    assert.match(im[3].texto, /<b>Rita Lopes<\/b> deu-te acesso a 1 imóvel, com o cargo <b>Contabilista<\/b>\. Estão em <b>Casas → Imóveis<\/b>\./);
    app.CW.cargos = { P1: { dono: false, perms: ['visit.view'], nome: 'Visitas' } };
    igual(app.aprImagensDe('boas-vindas').map((x) => x.titulo.split(' ')[0]), ['Parabéns,', 'Os'], 'um cargo que só vê: os parabéns e o fim');
    // um imóvel meu (chegou por uma partilha, ou já lá estava)
    app.CW.cargos = {};
    const meu = app.aprImagensDe('boas-vindas');
    assert.equal(meu.length, 7);
    assert.equal(meu[6].titulo, 'Os teus imóveis já estão à tua espera');
    assert.match(meu[6].texto, /^Tens 1 imóvel em <b>Casas → Imóveis<\/b>/);
  });

  test('o registo por email e o Google com novo:true dão o sinal; entrar numa conta de antes, não', async () => {
    montar();
    const feitos = [];
    app.finishLogin = (u) => feitos.push(u.id);
    const campo = (id, v) => { const e = app.document.getElementById(id); e.value = v; e.checked = true; };
    campo('cwa_email', 'nova@exemplo.pt'); campo('cwa_pass', 'Forte#2026x'); campo('cwa_pass2', 'Forte#2026x'); campo('cwa_name', 'Maria Costa'); campo('cwa_terms', 'on');
    app.api = (m, rota) => Promise.resolve({ id: rota.endsWith('/register') ? 'NOVA' : 'ANTIGA', name: 'X', email: 'nova@exemplo.pt' });
    app.CW.showAuthMode = 'login';
    app.CW.submitAuth();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(app.localStorage.getItem('gi_apr_nova'), null, 'entrar não dá o sinal');
    app.CW.showAuthMode = 'register';
    app.CW.submitAuth();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(app.localStorage.getItem('gi_apr_nova'), 'NOVA', 'criar a conta dá');
    app.localStorage.removeItem('gi_apr_nova');
    app.api = () => Promise.resolve({ id: 'G1', name: 'G', email: 'g@exemplo.pt' });
    app.socialLogin('google', { credential: 'x' });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(app.localStorage.getItem('gi_apr_nova'), null, 'o Google de uma conta de antes não');
    app.api = () => Promise.resolve({ id: 'G2', name: 'G', email: 'g@exemplo.pt', novo: true });
    app.socialLogin('google', { credential: 'x' });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(app.localStorage.getItem('gi_apr_nova'), 'G2', 'o Google de uma conta nova dá');
    igual(feitos, ['ANTIGA', 'NOVA', 'G1', 'G2'], 'e todos acabam no finishLogin');
  });
});

describe('quando abre', () => {
  test('o ecrã ocupado adia: sem sessão, antes do estado, com a entrada, um portão, uma janela, a ligação de convite por abrir, uma leitura, o tutorial, a gaveta, um modo', () => {
    montar();
    app.aprContaNova('EU');
    assert.equal(app.aprEcraOcupado(), '');
    const casos = [
      ['sessao', () => { app.CW.user = null; }],
      ['estado', () => { app.CW._pulled = 0; }],
      ['janela', () => { app.modalStack.push({ el: {} }); }],
      ['chegada', () => { app.CW._chegadaPorAbrir = true; }],
      ['chegada', () => { app.CW._chegadaEmCurso = true; }],
      ['leitura', () => { app._aprLeituras = 1; }],
      ['modo', () => { app.CW.selMode = true; }],
    ];
    for (const [porque, fazer] of casos) {
      montar(); app.aprContaNova('EU'); app.CW.selMode = false; app._aprLeituras = 0;
      fazer();
      assert.equal(app.aprEcraOcupado(), porque);
      app.aprTentar();
      assert.equal(app.modalStack.filter((L) => L.apr).length, 0, porque + ': não abre');
    }
    for (const [sel, porque] of [['#cwLegal', 'portao'], ['#cwTerms', 'portao'], ['#cwUpd', 'portao'], ['#cwGuia', 'tutorial']]) {
      montar(); app.aprContaNova('EU');
      consulta({ [sel]: {} });
      assert.equal(app.aprEcraOcupado(), porque, sel);
    }
    montar();
    consulta({ '#cwAuth': { style: { display: 'flex' } } });
    assert.equal(app.aprEcraOcupado(), 'entrada');
    consulta({ '#cwAuth': { style: { display: 'none' } } });
    assert.equal(app.aprEcraOcupado(), '', 'a entrada escondida já não tapa');
    // fora de um browser (o document sem nada, como o do arnês) não há onde abrir
    app.document.querySelector = () => null;
    assert.equal(app.aprEcraOcupado(), 'documento');
    app.aprContaNova('EU');
    app.aprTentar();
    assert.equal(app.modalStack.length, 0, 'e não abre');
    app._aprLeituras = 0;
  });

  test('uma leitura do estado tapa o ecrã enquanto dura (aceitar um convite lê o estado antes de abrir a confirmação)', async () => {
    montar();
    let acabar;
    const antes = app.aprPullDeAntes;
    app.aprPullDeAntes = () => new Promise((r) => { acabar = r; });
    try {
      const p = app.pullNow(true);
      assert.equal(app.aprEcraOcupado(), 'leitura');
      acabar();
      await p;
      assert.equal(app.aprEcraOcupado(), '');
    } finally { app.aprPullDeAntes = antes; }
  });

  test('a ligação de convite guardada faz as boas-vindas esperar por ela, até a janela dela abrir', async () => {
    montar();
    const guardado = {};
    app.window.sessionStorage = { getItem: (k) => guardado[k] || null, setItem: (k, v) => { guardado[k] = v; }, removeItem: (k) => { delete guardado[k]; } };
    try {
      guardado.gi_convite = 'abc';
      app.CW.resgatarChegada();
      assert.equal(app.CW._chegadaPorAbrir, true);
      app.aprContaNova('EU');
      assert.equal(app.aprEcraOcupado(), 'chegada');
      app.aprTentar();
      assert.equal(app.modalStack.length, 0, 'as boas-vindas esperam pelo convite');
      // respondida noutro sítio (ou esquecida): a espera acaba na tentativa seguinte do resgate
      delete guardado.gi_convite;
      await new Promise((r) => setTimeout(r, 450));
      assert.equal(app.CW._chegadaPorAbrir, false, 'sem ligação, não há por que esperar');
      assert.equal(app.aprEcraOcupado(), '');
    } finally { delete app.window.sessionStorage; }
  });

  test('a primeira visita a um separador abre a apresentação dele, e a segunda não; sem apresentação registada não faz nada', () => {
    montar({ respondida: true });
    app.tab = 'contracts';
    app.aprTentar();
    assert.equal(app.modalStack.length, 0, 'sem apresentação registada, nada');
    registarDeBrincar('contracts');
    assert.equal(app.aprQueAbrir(), 'contracts');
    app.aprTentar();
    assert.equal(app.modalStack.length, 1);
    app.closeModal('esc');
    assert.ok(vistas().contracts, 'fechar por qualquer via marca');
    app.aprTentar();
    assert.equal(app.modalStack.length, 0, 'a segunda visita não abre');
    // a de um separador espera pelas boas-vindas por ver
    registarDeBrincar('transactions');
    app.tab = 'transactions';
    app.aprContaNova('EU');
    assert.equal(app.aprQueAbrir(), 'boas-vindas', 'as boas-vindas passam à frente');
  });

  test('se se sair do separador antes de a janela poder abrir, não abre: fica para a próxima chegada', () => {
    montar();
    registarDeBrincar('contracts');
    app.tab = 'contracts';
    app.modalStack.push({ el: {} });
    app.aprTentar();
    app.modalStack.length = 0;
    app.tab = 'transactions';
    app.aprTentar();
    assert.equal(app.modalStack.length, 0, 'nos Movimentos não abre a dos Contratos');
    assert.ok(!vistas().contracts, 'e a dos Contratos continua por ver');
    app.tab = 'contracts';
    app.aprTentar();
    assert.equal(app.modalStack.length, 1, 'na chegada seguinte abre');
  });

  test('o render agenda a tentativa, mas não o do vizinho que o deslize pinta às escondidas', () => {
    montar();
    // o render de antes (o da base, embrulhado pela nuvem) fica calado: conta só o embrulho da apresentação
    const pintar = app.aprRenderDeAntes;
    app.aprRenderDeAntes = () => {};
    try {
      app._pintarAParte = true;
      app.render();
      assert.equal(app._aprTempo, null, 'o vizinho não conta');
      app._pintarAParte = false;
      app.render();
      assert.ok(app._aprTempo, 'a pintura do separador agenda');
      clearTimeout(app._aprTempo); app._aprTempo = null;
    } finally { app.aprRenderDeAntes = pintar; app._pintarAParte = false; }
  });

  test('fechar as boas-vindas num separador com apresentação por ver deixa-a para a chegada seguinte: nada de duas janelas seguidas', () => {
    montar({ respondida: true });
    registarDeBrincar('transactions');
    const pintar = app.aprRenderDeAntes;
    app.aprRenderDeAntes = () => {};
    try {
      app.tab = 'transactions'; app.render();   // um recarregar devolveu a pessoa aos Movimentos
      app.aprContaNova('EU');
      app.aprTentar();
      assert.equal(app.modalStack.length, 1);
      assert.equal(app.modalStack[0].t, 'Boas-vindas');
      app.closeModal('x');
      app.render(); app.aprTentar();
      assert.equal(app.modalStack.length, 0, 'fechadas as boas-vindas, a dos Movimentos não abre logo a seguir');
      assert.ok(!vistas().transactions, 'e continua por ver');
      app.tab = 'recurring'; app.render();
      app.tab = 'transactions'; app.render();
      app.aprTentar();
      assert.equal(app.modalStack.length, 1, 'na chegada seguinte, abre');
      assert.equal(app.modalStack[0].t, 'Do transactions');
    } finally { app.aprRenderDeAntes = pintar; }
  });

  test('nas Definições, só na raiz', () => {
    montar();
    registarDeBrincar('settings');
    app.tab = 'settings'; app.setPage = 'ajuda';
    assert.equal(app.aprQueAbrir(), '', 'numa subpágina, não');
    app.setPage = '';
    assert.equal(app.aprQueAbrir(), 'settings');
  });

  test('a Ajuda reabre sem mudar o estado, a não ser que se chegue à última imagem', () => {
    montar();
    registarDeBrincar('contracts');
    app.aprRever('contracts');
    assert.equal(app.modalStack.length, 1);
    app.closeModal('x');
    igual(vistas(), {}, 'rever e fechar a meio não marca');
    app.aprContaNova('EU');
    app.aprRever('boas-vindas');
    const L = app.modalStack[0];
    app.aprIr(L.apr, 6);
    assert.equal(L.pecas.seg.textContent, 'Percebi', 'quem revê fica na Ajuda: o fim é o «Percebi», e não leva aos Imóveis');
    app.aprSeguinte();
    assert.equal(app.modalStack.length, 0);
    assert.equal(app.tab, 'dashboard', 'não mudou de separador');
    igual(vistas(), { 'boas-vindas': 1 }, 'chegar ao fim e carregar no «Percebi» marca só essa');
    assert.equal(app.localStorage.getItem('gi_apr_nova'), null, 'e larga o sinal das boas-vindas');
  });

  test('rever na Ajuda até à última imagem e fechar no ✕ também conta como vista (ticket de QA ea801987)', () => {
    montar();
    registarDeBrincar('contracts', 3);
    app.aprRever('contracts');
    app.aprIr(app.modalStack[0].apr, 2);
    app.closeModal('x');
    assert.equal(app.modalStack.length, 0, 'sem pergunta: rever nunca pergunta');
    igual(vistas(), { contracts: 1 });
    app.CW.user = { id: 'EU' };
    registarDeBrincar('transactions', 2);
    app.aprRever('transactions');
    app.CW.user = { id: 'OUTRA' };
    app.aprIr(app.modalStack[0].apr, 1);
    app.closeModal('x');
    assert.ok(!vistas().transactions, 'noutra sessão não marca');
  });

  test('«Marcar todas como vistas» na Ajuda: todas as da conta ficam vistas e o botão sai (ticket de QA f6e09ead)', () => {
    montar();
    registarDeBrincar('contracts');
    registarDeBrincar('properties');
    app.aprContaNova('EU');
    const antes = app.apresentacoesNaAjuda();
    assert.match(antes, /data-click="aprMarcarTodasVistas\(\)">Marcar todas como vistas</, 'com alguma por ver, o botão está lá');
    app.aprMarcarTodasVistas();
    for (const id of app.aprDaConta()) assert.ok(vistas()[id], id + ' vista');
    assert.equal(app.aprQueAbrir(), '', 'nenhuma abre sozinha');
    assert.equal(app.localStorage.getItem('gi_apr_nova'), null, 'o sinal das boas-vindas sai');
    assert.doesNotMatch(app.apresentacoesNaAjuda(), /Marcar todas como vistas/, 'todas vistas, o botão sai');
  });
});

/* A pergunta de cima, se for a de quem fecha a meio (aprPerguntar).
   Devolve: a camada, ou null. */
const pergunta = () => {
  const L = app.modalStack[app.modalStack.length - 1];
  return L && L.aprPergunta ? L : null;
};

describe('a pergunta a quem fecha antes do fim (ticket de QA 61dee982)', () => {
  test('o ✕ antes da última imagem pergunta, e a marca espera; «Continuar a mostrar» marca esta e a resposta, e as outras abrem sem voltar a perguntar', () => {
    montar();
    registarDeBrincar('contracts', 3);
    app.tab = 'contracts';
    app.aprTentar();
    app.closeModal('x');
    const P = pergunta();
    assert.ok(P, 'fechada a meio, pergunta');
    assert.equal(P.t, 'Não queres ver as apresentações?');
    assert.ok(P.classes.has('apr-pergunta'), 'com os botões em coluna');
    assert.match(P.b, /<b>Ajuda → Apresentações<\/b>/, 'diz onde se reveem');
    const botoes = [...P.f.matchAll(/<button[^>]*class="([^"]*)"[^>]*data-click="aprResponder\('(\w+)'\)">([^<]*)</g)].map((m) => [m[3], m[2], /primary/.test(m[1])]);
    igual(botoes, [['Voltar à apresentação', 'voltar', false], ['Não mostrar mais', 'nenhuma', false], ['Continuar a mostrar', 'mostrar', true]]);
    igual(vistas(), {}, 'ainda nada marcado');
    app.aprTentar();
    assert.equal(app.modalStack.length, 1, 'com a pergunta aberta, nada abre por cima');
    app.aprResponder('mostrar');
    assert.equal(app.modalStack.length, 0);
    igual(vistas(), { contracts: 1, perguntou: 1 });
    registarDeBrincar('transactions', 3);
    app.tab = 'transactions';
    app.aprTentar();
    assert.equal(app.modalStack.length, 1, 'as outras abrem na primeira visita');
    app.closeModal('fundo');
    assert.equal(app.modalStack.length, 0, 'e já não pergunta');
    assert.ok(vistas().transactions);
  });

  test('«Não mostrar mais»: nenhuma abre sozinha, nem as boas-vindas, e a Ajuda continua a reabri-las', () => {
    montar();
    registarDeBrincar('contracts', 2);
    registarDeBrincar('transactions', 2);
    app.tab = 'contracts';
    app.aprTentar();
    app.closeModal('arrasto');
    app.aprResponder('nenhuma');
    igual(vistas(), { contracts: 1, perguntou: 1, nenhuma: 1 });
    app.tab = 'transactions';
    assert.equal(app.aprQueAbrir(), '', 'o separador seguinte não abre');
    app.aprContaNova('EU');
    assert.equal(app.aprQueAbrir(), '', 'nem as boas-vindas');
    assert.equal(app.aprOcupaOEcra(), false, 'nem prendem as novidades');
    app.aprRever('transactions');
    assert.equal(app.modalStack.length, 1, 'a Ajuda reabre');
    app.closeModal('x');
    assert.equal(app.modalStack.length, 0, 'e rever não pergunta');
  });

  test('«Voltar à apresentação» reabre na mesma imagem, sem marcar nem gastar a pergunta', () => {
    montar();
    registarDeBrincar('contracts', 4);
    app.tab = 'contracts';
    app.aprTentar();
    app.aprSeguinte();
    app.closeModal('esc');
    app.aprResponder('voltar');
    assert.equal(app.modalStack.length, 1);
    const L = app.modalStack[0];
    assert.ok(L.apr && L.apr.marcar, 'a mesma apresentação, ainda a marcar');
    assert.equal(L.apr.i, 1, 'na imagem onde estava');
    assert.equal(L.pecas.folhas[1].getAttribute('aria-hidden'), null, 'essa à vista');
    assert.ok(!L.pecas.ant.classList.contains('u-d-none'), 'com o Anterior');
    igual(vistas(), {}, 'nada marcado');
    app.closeModal('voltar');
    assert.ok(pergunta(), 'fechada a meio outra vez, pergunta outra vez');
  });

  test('fechar a pergunta sem escolher é o fecho de sempre: esta fica vista, e pergunta-se da próxima vez', () => {
    montar();
    registarDeBrincar('contracts', 2);
    registarDeBrincar('transactions', 2);
    app.tab = 'contracts';
    app.aprTentar();
    app.closeModal('x');
    app.closeModal('x');
    igual(vistas(), { contracts: 1 });
    app.tab = 'transactions';
    app.aprTentar();
    app.closeModal('x');
    assert.ok(pergunta(), 'sem resposta, pergunta na seguinte');
  });

  test('não pergunta: na última imagem, no «Percebi», num fecho sem origem, ao rever na Ajuda, nem a outra conta', () => {
    montar();
    registarDeBrincar('contracts', 2);
    let L = app.aprAbrir('contracts', { marcar: true });
    app.aprIr(L.apr, 1);
    app.closeModal('x');
    assert.equal(app.modalStack.length, 0, 'na última imagem viu tudo');
    registarDeBrincar('transactions', 2);
    L = app.aprAbrir('transactions', { marcar: true });
    app.aprIr(L.apr, 1);
    app.aprSeguinte();
    assert.equal(app.modalStack.length, 0, 'o «Percebi» é uma decisão');
    registarDeBrincar('recurring', 3);
    app.aprAbrir('recurring', { marcar: true });
    app.closeAllModals();
    assert.equal(app.modalStack.length, 0, 'despejar a pilha não pergunta');
    registarDeBrincar('tenants', 3);
    app.aprRever('tenants');
    app.closeModal('x');
    assert.equal(app.modalStack.length, 0, 'rever não pergunta');
    registarDeBrincar('visits', 3);
    app.aprAbrir('visits', { marcar: true });
    app.CW.user = { id: 'OUTRA' };
    app.closeModal('x');
    assert.equal(app.modalStack.length, 0, 'outra sessão não ouve a pergunta de quem saiu');
    assert.ok(!vistas().visits);
  });

  test('as boas-vindas também perguntam; «Continuar a mostrar» marca-as com a Visão geral e os Imóveis e larga o sinal', () => {
    montar();
    app.aprContaNova('EU');
    app.aprTentar();
    app.closeModal('x');
    assert.ok(pergunta(), 'as boas-vindas fechadas na primeira imagem perguntam');
    assert.equal(app.localStorage.getItem('gi_apr_nova'), 'EU', 'o sinal espera pela resposta');
    app.aprResponder('mostrar');
    igual(Object.keys(vistas()).sort(), ['boas-vindas', 'dashboard', 'perguntou', 'properties']);
    assert.equal(app.localStorage.getItem('gi_apr_nova'), null);
  });

  test('o closeModal a sério passa a origem do fecho ao aoFechar', () => {
    const fonte = ler('web/app/componentes.js');
    assert.match(fonte, /M\.aoFechar\(typeof origem==='string'\?origem:''\)/);
  });
});

describe('o estado', () => {
  test('fica em db.settings, numa chave que sobe (sem «_»), e sobrevive à fusão com outro aparelho, aqui e no servidor', () => {
    montar();
    registarDeBrincar('contracts');
    app.aprMarcarVista(['contracts']);
    igual(app.db.settings.apresentacoes, { contracts: 1 });
    assert.ok('apresentacoes' in app.strip(app.db.settings), 'sobe com as definições');
    // este aparelho marcou os Contratos; o outro, a Visão geral e os Imóveis; a base de cá não tinha nenhum
    const pk = app.parseKey('u:settings:main');
    const aqui = app.fundirRegistoLocal(pk, { apresentacoes: { contracts: 1 } }, { apresentacoes: { dashboard: 1, properties: 1 } }, { apresentacoes: {} });
    igual(aqui.apresentacoes, { dashboard: 1, properties: 1, contracts: 1 }, 'ao ler, junta as marcas');
    // no servidor: o outro aparelho já gravou; este envia a sua, com a base que leu (parcial, como nucleo.js:baseParcial)
    const servidor = JSON.stringify({ apresentacoes: { dashboard: 1, properties: 1 } });
    igual(fundirCasaComBase(servidor, { apresentacoes: { contracts: 1 } }, { apresentacoes: null }).apresentacoes,
      { dashboard: 1, properties: 1, contracts: 1 }, 'ao gravar, também');
    igual(fundirCasaComBase(servidor, { apresentacoes: { dashboard: 1, groups: 1 } }, { apresentacoes: { dashboard: 1 } }).apresentacoes,
      { dashboard: 1, properties: 1, groups: 1 }, 'com base, só entra o que este mudou');
  });

  test('antes de o servidor responder não decide nada, e as definições vazias de um aparelho novo não abrem nada por engano', () => {
    montar();
    registarDeBrincar('dashboard');
    app.CW._pulled = 0;
    app.aprTentar();
    assert.equal(app.modalStack.length, 0);
    app.CW._pulled = 1;
    app.aprTentar();
    assert.equal(app.modalStack.length, 1, 'com o estado conhecido, abre');
  });
});

describe('o servidor', () => {
  test('a entrada com o Google diz novo:true só no pedido em que a conta nasce', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'ka', alg: 'RS256', use: 'sig' });
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const agora = Math.floor(Date.now() / 1000);
    const cab = b64u({ alg: 'RS256', kid: 'ka', typ: 'JWT' });
    const corpo = b64u({ iss: 'https://accounts.google.com', aud: 'cid', exp: agora + 600, iat: agora, sub: 'g-apr', email: 'apr@exemplo.pt', email_verified: true, name: 'Ana' });
    const idToken = cab + '.' + corpo + '.' + assinarNode('sha256', Buffer.from(cab + '.' + corpo), privateKey).toString('base64url');
    const antes = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    try {
      const env = ambiente({ GOOGLE_CLIENT_ID: 'cid' });
      const r1 = await (await pedir(env, null, '/api/auth/google', 'POST', { credential: idToken })).json();
      assert.equal(r1.novo, true, 'a conta nasceu neste pedido');
      const r2 = await (await pedir(env, null, '/api/auth/google', 'POST', { credential: idToken })).json();
      assert.equal(r2.id, r1.id);
      assert.ok(!('novo' in r2), 'da segunda vez é uma conta de antes');
    } finally { globalThis.fetch = antes; }
  });
});

describe('as novidades e a apresentação esperam uma pela outra', () => {
  test('o ecraLivre das novidades conta com a janela aberta e com as boas-vindas por ver; a apresentação só abre sem janela nenhuma', () => {
    montar({ respondida: true });
    const gid = app.document.getElementById;
    app.document.getElementById = () => null;
    try {
      assert.equal(app.ecraLivre(), true);
      app.aprContaNova('EU');
      assert.equal(app.ecraLivre(), false, 'as boas-vindas por ver passam à frente');
      app.aprTentar();
      assert.equal(app.ecraLivre(), false, 'abertas, também');
      app.closeModal('x');
      assert.equal(app.ecraLivre(), true, 'fechadas, é a vez das novidades');
      registarDeBrincar('transactions');
      app.tab = 'transactions';
      assert.equal(app.aprQueAbrir(), 'transactions');
      app.modalStack.push({ el: {}, t: 'O que há de novo' });
      app.aprTentar();
      assert.equal(app.modalStack.filter((L) => L.apr).length, 0, 'com as novidades abertas, a apresentação espera');
    } finally { app.document.getElementById = gid; }
  });

  test('fechar as novidades deixa a apresentação do ecrã onde se está para a chegada seguinte', () => {
    montar();
    registarDeBrincar('transactions');
    const pintar = app.aprRenderDeAntes;
    app.aprRenderDeAntes = () => {};
    try {
      app.tab = 'transactions'; app.render();
      app.modalStack.push({ el: {}, t: 'O que há de novo' });
      app.CW.novFechar();
      assert.equal(app.modalStack.length, 0);
      app.render(); app.aprTentar();
      assert.equal(app.modalStack.length, 0, 'não abre logo a seguir às novidades');
      app.tab = 'dashboard'; app.render();
      app.tab = 'transactions'; app.render();
      app.aprTentar();
      assert.equal(app.modalStack.length, 1, 'na chegada seguinte, abre');
    } finally { app.aprRenderDeAntes = pintar; }
  });
});

describe('a Ajuda', () => {
  test('a secção «Apresentações»: as boas-vindas e cada separador com apresentação que a conta vê, pela ordem da navegação, com o «Vista»', () => {
    montar();
    registarDeBrincar('transactions');
    registarDeBrincar('properties', 3);
    registarDeBrincar('colaboradores');
    app.aprMarcarVista('properties');
    igual(app.aprDaConta(), ['boas-vindas', 'properties', 'colaboradores', 'transactions']);
    const html = app.apresentacoesNaAjuda();
    assert.match(html, /<h2>Apresentações<\/h2><span class="small num">1 de 4 vistas<\/span>/);
    const tiles = [...html.matchAll(/data-click="aprRever\('([^']+)'\)"><span class="small num">(\d+) imagens<\/span><b>([^<]+)<\/b>(<span class="badge in">Vista<\/span>)?/g)]
      .map((m) => [m[1], Number(m[2]), m[3], !!m[4]]);
    igual(tiles, [['boas-vindas', 7, 'Boas-vindas', false], ['properties', 3, 'Do properties', true], ['colaboradores', 2, 'Do colaboradores', false], ['transactions', 2, 'Do transactions', false]]);
    app.CW.tickets = [];
    const pagina = app.vAjuda();
    assert.ok(pagina.indexOf('Como se faz') > -1 && pagina.indexOf('Apresentações') > pagina.indexOf('Como se faz'),
      'vive na página da Ajuda, a seguir a «Como se faz»');
    app.CW.user = null;
    assert.ok(!app.aprDaConta().includes('colaboradores'), 'um separador escondido não aparece');
  });
});

describe('o kit das maquetes', () => {
  test('cada peça escreve HTML sem style= nem on…=, escapa o texto, e as imagens das boas-vindas também', () => {
    montar();
    const pecas = [
      app.aprCena('<b>x</b>', { tom: 'noite', arranjo: 'heroi' }), app.aprCena('', { tom: 'mau', arranjo: 'mau' }),
      app.aprTela({ titulo: 'Casas', abas: app.APR_ABAS_CASAS, aba: 'Imóveis', barra: 'casas', mais: true, corpo: 'c' }),
      app.aprPesquisa({ alvo: true }), app.aprChips(['a', 'b'], [1], 0), app.aprSecao('Os meus imóveis', 4),
      app.aprCartao('x', { flutua: true, alvo: true, classe: 'apr-c-x' }), app.aprFolha('Novo', 'x'),
      app.aprLinha({ titulo: 't', sub: 's', sub2: 's2', valor: app.aprDinheiro(950), tom: 'pos', selos: [['do contrato'], ['à mão', 'grey']], avatar: 'Ana Ribeiro', seta: true, botao: app.aprBotao('Confirmar', { primario: true }) }),
      app.aprLinha({ icone: 'building', titulo: 'i' }), app.aprLinha({ capa: 't2', titulo: 'c' }),
      app.aprSelo('Vago', 'amber'), app.aprCampo('Nome', '', { obrigatorio: true, vazio: 'Ex: T2 Lisboa' }), app.aprSegmentado(['A', 'B'], 'A'),
      app.aprCartaoImovel(app.APR_EXEMPLO.imovel('bonfim')), app.aprBarras([1, 5, 10], { aceso: 2, tom: 'in' }), app.aprProgresso(37.5, { tom: 'loan' }),
      app.aprValor(-35), app.aprMais({ alvo: true }), app.aprBarra('dinheiro'), app.aprAviso('a', 'b', { icone: 'check', tom: 'in' }), app.aprSurge('x', 2, 'apr-heroi-a'),
    ].concat(app.aprImagensDe('boas-vindas').map((x) => x.html));
    for (const h of pecas) assert.doesNotMatch(h, /style=|\son[a-z]+=|<script/i, h.slice(0, 80));
    assert.match(app.aprCena('', { tom: 'mau', arranjo: 'mau' }), /class="apr-cena apr-cena-centro"><span class="apr-fundo imv-mosaico imv-t0">/, 'um tom que não existe cai no cobalto');
    assert.match(app.aprLinha({ titulo: '<x>' }), /&lt;x&gt;/, 'o texto passa pelo esc');
    assert.match(app.aprBarras([1, 5, 10]), /apr-a1".*apr-a5".*apr-a10"/, 'as alturas são classes, em décimos');
    assert.match(app.aprProgresso(37.5), /data-largura="37\.5"/, 'a largura vai pelo data-largura');
    assert.match(app.aprSurge('x', 2), /data-atraso="120"/, 'a escada da estreia é de 60 ms');
    assert.match(app.aprCartaoImovel(app.APR_EXEMPLO.imovel('bonfim')), /3\/4 quartos/);
    assert.match(app.aprCartaoImovel(app.APR_EXEMPLO.imovel('cedofeita')), /Vago/);
  });

  test('o APR_EXEMPLO fecha entre si: as rendas somam 2 425 €/mês, cada contrato é de um imóvel e de um inquilino que existem, e o T1 está vago', () => {
    const ex = app.APR_EXEMPLO;
    assert.equal(ex.imoveis.reduce((a, p) => a + ex.rendaDe(p.id), 0), 2425);
    assert.equal(ex.rendaDe('cedofeita'), 0);
    for (const c of ex.contratos) {
      assert.ok(ex.imovel(c.imovel), c.id + ': o imóvel existe');
      assert.ok(ex.inquilinos.some((t) => t.nome === c.inquilino && t.imovel === c.imovel), c.id + ': o inquilino existe e é desse imóvel');
    }
    assert.equal(ex.receitaMes[ex.receitaMes.length - 1], 2425, 'o último mês é o das rendas em vigor');
    assert.equal(ex.receitaMes[0] - 2425, 690, 'antes de setembro o T1 rendia 690 €');
    assert.equal(ex.dividaDe('bonfim'), 231800);
    assert.ok(!/João Silva/.test(JSON.stringify(ex)), 'nada de nomes de fachada');
  });

  test('as datas dos contratos do APR_EXEMPLO contam-se a partir de hoje: começaram antes e acabam depois, e não envelhecem', () => {
    const iso = (d) => d.split('/').reverse().join('-');
    const hoje = app.today();
    for (const c of app.APR_EXEMPLO.contratos) {
      assert.match(c.desde, /^01\/\d{2}\/\d{4}$/, c.id + ': começa no dia 1');
      assert.ok(iso(c.desde) < hoje, c.id + ': já começou');
      if (c.ate) assert.ok(iso(c.ate) > hoje, c.id + ': ainda está em vigor');
    }
    assert.equal(app.aprMes(0), '01/' + hoje.slice(5, 7) + '/' + hoje.slice(0, 4));
    assert.equal(app.aprMes(-12).slice(3), hoje.slice(5, 7) + '/' + (Number(hoje.slice(0, 4)) - 1));
    assert.ok(app.aprMes(1, true).slice(0, 2) > '27', 'o último dia de um mês');
  });

  test('os textos das boas-vindas seguem a casa: sem «pôr»/«tirar», sem «(s)», sem «Bem-vindo», sem ponto de exclamação e sem emojis', () => {
    montar();
    const textos = app.aprImagensDe('boas-vindas').map((x) => x.titulo + ' ' + x.texto + ' ' + x.html.replace(/<[^>]*>/g, ' ')).join(' ');
    assert.ok(textos.length > 1000, 'leu os textos e as maquetes');
    assert.doesNotMatch(textos, /(^|[^\p{L}])(pôr|põe|põem|puser|tirar|tira|tiras)([^\p{L}]|$)/iu);
    assert.doesNotMatch(textos, /\(s\)/);
    assert.doesNotMatch(textos, /Bem-vind/i);
    assert.doesNotMatch(textos, /!/);
    assert.doesNotMatch(textos, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
