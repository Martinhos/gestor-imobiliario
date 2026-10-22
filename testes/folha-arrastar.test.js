// No telemóvel (até 520px) a janela de cima arrasta-se para baixo para fechar:
// pelo cabeçalho e pela barra sempre, pelo corpo só no topo do scroll e a
// descer. Segue o dedo, o véu aclara, para cima resiste; largar passada metade
// da altura ou com um sacudir fecha pelo closeModal('arrasto') e a saída parte
// de onde o dedo a deixou; antes disso volta ao sítio. Não arranca de um
// campo, de um toque longo, de quem tem gesto próprio, do corpo já rolado, de
// uma janela que não é a de cima, com o rato, nem acima dos 520px. Num
// formulário com alterações pergunta «Sair sem guardar?» e, ficando, a folha
// volta ao sítio. Sem movimento pedido não segue o dedo e fecha sem animar.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp();

/* Um nó falso com o que o arrasto lê: as classes a sério, o pai (para o
   closest e o contains), os seletores que ele cumpre (sels) e o scroll. */
function no(nome, pai, sels) {
  const classes = new Set();
  const n = {
    nome, parentElement: pai || null, sels: sels || [], scrollTop: 0, style: {}, attrs: {}, filhos: [],
    classList: {
      add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
      toggle: (c, f) => ((f === undefined ? !classes.has(c) : f) ? classes.add(c) : classes.delete(c)),
    },
    closest(sel) {
      const lista = sel.split(',').map((s) => s.trim());
      for (let x = n; x; x = x.parentElement) if (x.sels.some((s) => lista.includes(s))) return x;
      return null;
    },
    contains(x) { for (let y = x; y; y = y.parentElement) if (y === n) return true; return false; },
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener() {}, removeEventListener() {}, focus() {}, remove() { n.removido = true; },
    querySelectorAll: () => [],
  };
  if (pai) pai.filhos.push(n);
  return n;
}

/* Uma janela inteira: .modal > .bg + .sheet > .head (h2, X) + .body (campo,
   cartão com toque longo, fila de chips que rola de lado, caixa com gesto
   próprio) + .foot. A folha tem 600px de altura e fica em baixo, num ecrã
   de 844. Cada animação registada fica na lista, com o cancelar à mão. */
function janela() {
  const el = no('modal', null, ['.modal']);
  el.classList.add('modal'); el.classList.add('open');
  const bg = no('bg', el, ['.bg']);
  const s = no('sheet', el, ['.sheet']);
  const head = no('head', s, ['.head']);
  const h2 = no('h2', head);
  const x = no('x', head, ['button']);
  const body = no('body', s, ['.body']);
  const campo = no('campo', body, ['input']);
  const cartao = no('cartao', body, ['[data-lp]']);
  const texto = no('texto', body);
  const chips = no('chips', body);
  chips.scrollWidth = 700; chips.clientWidth = 340;
  const chip = no('chip', chips);
  const palco = no('palco', body, ['[data-pointerdown]']);
  const foot = no('foot', s, ['.foot']);
  const animacoes = [];
  const anima = (alvo) => (k, o) => {
    const an = { alvo, k, o, cancelada: false, onfinish: null, cancel() { this.cancelada = true; } };
    animacoes.push(an);
    return an;
  };
  s.animate = anima('sheet'); bg.animate = anima('bg');
  s.getBoundingClientRect = () => ({ top: 244, bottom: 844, height: 600, left: 0, right: 390, width: 390 });
  s.setPointerCapture = () => {};
  const partes = { '.sheet': s, '.bg': bg, '.head': head, '.body': body, '.foot': foot };
  el.querySelector = (q) => partes[q] || null;
  s.querySelector = (q) => partes[q] || null;
  return { el, bg, s, head, h2, x, body, campo, cartao, texto, chips, chip, palco, foot, animacoes };
}

let J, estreito, reduzido, fechos;
beforeEach(() => {
  limpar(app);
  estreito = true; reduzido = false; fechos = [];
  app.matchMedia = (q) => ({ matches: /520px/.test(q) ? estreito : /reduce/.test(q) ? reduzido : false });
  // só a fila de chips rola de lado (overflow-x:auto)
  app.getComputedStyle = (e) => ({ overflowX: e && e.nome === 'chips' ? 'auto' : 'visible', transform: 'none', getPropertyValue: () => '' });
  app.modalStack.length = 0;
  J = janela();
  app.modalStack.push({ el: J.el, title: 'Imóvel', onSave: null, tocado: false, snap: '' });
});
afterEach(() => repor(app));
// o dedo que ficou pousado sai, e a pilha esvazia-se dentro do teste que a encheu
afterEach(() => { app.folhaArrastoFim(ev('pointercancel', 0)); app.modalStack.length = 0; });

let hora = 1000;
// um evento de ponteiro de dedo, à altura y, com a hora dele (a velocidade lê-a)
const ev = (type, y, extra) => Object.assign({ type, pointerId: 5, pointerType: 'touch', isPrimary: true, button: 0, clientX: 195, clientY: y, target: J.h2, timeStamp: hora }, extra || {});
// o deslocamento vertical (px) que o transform da folha tem agora
const desl = () => { const m = /translateY\((-?[\d.]+)px\)/.exec(J.s.style.transform || ''); return m ? Number(m[1]) : 0; };
// a folha fecha pelo closeModal, que aqui só conta e tira a janela da pilha
const contarFechos = () => { app.closeModal = (o) => { fechos.push(o); app.modalStack.pop(); }; };
// pousa em `de`, arrasta em passos de `ms` até `ate` e (opcional) larga
function arrastar(ate, opcoes) {
  const o = Object.assign({ de: 300, passos: 6, largar: true, ms: 20, alvo: J.h2 }, opcoes);
  const extra = Object.assign({ target: o.alvo }, o.extra);
  hora += 100;
  app.folhaPousar(ev('pointerdown', o.de, extra));
  for (let i = 1; i <= o.passos; i++) {
    hora += o.ms;
    app.folhaArrastoMove(ev('pointermove', o.de + ((ate - o.de) * i) / o.passos, extra));
  }
  if (o.largar) { hora += o.pausa || 0; app.folhaArrastoFim(ev('pointerup', ate, extra)); }
}

describe('as contas do gesto', () => {
  test('para cima resiste: anda menos do que o dedo, com o sinal dele, e nunca passa de 24px', () => {
    assert.equal(app.folhaElastico(0), 0);
    const y = app.folhaElastico(-100);
    assert.ok(y < 0 && y > -24, 'para cima, com elástico (' + y + 'px)');
    assert.ok(app.folhaElastico(-100000) > -24, 'nunca descola mais de 24px do fundo');
    assert.ok(app.folhaElastico(-200) < app.folhaElastico(-100), 'mais dedo, um pouco mais de folha');
  });

  test('o véu aclara à proporção da descida e nunca sai de 0..1; sem movimento fica inteiro', () => {
    assert.equal(app.folhaVeu({ desl: 0, h: 600, mexe: true }), 1);
    assert.equal(app.folhaVeu({ desl: 300, h: 600, mexe: true }), 0.5);
    assert.equal(app.folhaVeu({ desl: 900, h: 600, mexe: true }), 0);
    assert.equal(app.folhaVeu({ desl: -20, h: 600, mexe: true }), 1);
    assert.equal(app.folhaVeu({ desl: 300, h: 600, mexe: false }), 1);
  });

  test('decidir fechar: passada metade da altura, ou a descer depressa; parado 100ms já não é sacudir', () => {
    const a = (dy, vy, ta) => ({ dy, h: 600, vy, ta });
    assert.equal(app.avisoFechaAoLargar(a(301, 0, 0), 10), true, 'passou metade');
    assert.equal(app.avisoFechaAoLargar(a(299, 0, 0), 10), false, 'ainda não');
    assert.equal(app.avisoFechaAoLargar(a(40, 0.9, 0), 10), true, 'um sacudir');
    assert.equal(app.avisoFechaAoLargar(a(40, 0.9, 0), 150), false, 'o dedo parou antes de largar');
    assert.equal(app.avisoFechaAoLargar(a(-10, 0.9, 0), 10), false, 'a subir nunca fecha');
  });
});

describe('a folha segue o dedo', () => {
  test('pelo cabeçalho: só depois dos 10px de decidir, colada ao dedo; o véu aclara e a entrada desliga-se', () => {
    hora += 100;
    app.folhaPousar(ev('pointerdown', 300));
    app.folhaArrastoMove(ev('pointermove', 306));
    assert.equal(J.s.style.transform || '', '', 'aos 6px ainda não é um arrasto');
    hora += 16;
    app.folhaArrastoMove(ev('pointermove', 312));
    assert.ok(J.el.classList.contains('arrastou'), 'a entrada não volta a correr por cima do dedo');
    assert.ok(J.s.classList.contains('arrastar'));
    assert.equal(desl(), 2, 'a folga de decidir não conta: 12px de dedo dão 2px de folha');
    hora += 16;
    app.folhaArrastoMove(ev('pointermove', 460));
    assert.equal(J.s.style.transform, 'translateY(150px)');
    assert.equal(J.bg.style.opacity, '0.75', '150 de 600: o véu a três quartos');
  });

  test('pela barra (a própria .sheet) também pega, e para cima resiste', () => {
    arrastar(150, { alvo: J.s, largar: false });
    const y = desl();
    assert.ok(y < 0 && y > -24, 'para cima, com elástico (' + y + 'px)');
    assert.ok(!J.s.classList.contains('pronto'), 'para cima nunca fecha');
  });

  test('pela caneta também; com o rato não', () => {
    arrastar(420, { extra: { pointerType: 'pen' }, largar: false });
    assert.ok(desl() > 0, 'a caneta arrasta');
    app.folhaArrastoFim(ev('pointercancel', 420));
    J.s.style.transform = '';
    arrastar(700, { extra: { pointerType: 'mouse' } });
    assert.equal(J.s.style.transform, '', 'o rato não arrasta');
  });
});

describe('largar: fecha ou volta', () => {
  test('passada metade da altura, fecha pelo closeModal(«arrasto»)', () => {
    contarFechos();
    arrastar(640, { passos: 10, ms: 40 });
    assert.deepEqual(fechos, ['arrasto']);
  });

  test('um sacudir para baixo fecha antes de metade; o mesmo gesto parado antes de largar volta', () => {
    contarFechos();
    arrastar(380, { passos: 3, ms: 8 });
    assert.deepEqual(fechos, ['arrasto'], '80px a quase 3px/ms é um sacudir');
    app.modalStack.push({ el: J.el, title: 'Imóvel', tocado: false, snap: '' });
    arrastar(380, { passos: 3, ms: 8, pausa: 150 });
    assert.deepEqual(fechos, ['arrasto'], 'parado 150ms antes de largar: não fecha outra vez');
  });

  test('largar cedo volta ao sítio (--medio, --curva-entra), com o véu, e no fim sem transform nenhum', () => {
    contarFechos();
    arrastar(420, { passos: 10, ms: 40 });
    assert.deepEqual(fechos, [], 'não fechou');
    assert.equal(J.s.style.transform, '', 'a base é o sítio; a animação leva-a lá');
    assert.equal(J.bg.style.opacity, '', 'o véu volta ao do CSS');
    const an = J.animacoes.find((x) => x.alvo === 'sheet');
    assert.match(an.k[0].transform, /translateY\(110px\)/, 'parte de onde o dedo a deixou');
    assert.equal(an.k[1].transform, 'none');
    assert.equal(an.o.duration, 200, 'o --medio');
    assert.equal(an.o.easing, 'cubic-bezier(0,0,.2,1)', 'a --curva-entra');
    const veu = J.animacoes.find((x) => x.alvo === 'bg');
    assert.equal(veu.k[1].opacity, 1, 'o véu escurece com ela');
    assert.ok(!J.s.classList.contains('arrastar') && !J.s.classList.contains('pronto'));
  });

  test('a saída de uma folha largada parte de onde o dedo a deixou, na --curva (sem animar duas vezes)', () => {
    arrastar(640, { passos: 10, ms: 40 });
    assert.equal(app.modalStack.length, 0, 'fechou pelo closeModal de verdade');
    assert.ok(J.el.classList.contains('sai'), 'a saída é a de sempre (fecharComSaida)');
    assert.ok(J.el.classList.contains('arrastada'), 'marcada para a curva do dedo');
    assert.equal(J.s.style.transform, 'translateY(330px)', 'o transform do dedo fica: o folhaDesce parte dele');
    assert.equal(J.animacoes.length, 0, 'nenhuma animação de JavaScript por cima da do CSS');
  });

  test('apanhada a meio do regresso, segue o dedo a partir de onde está', () => {
    arrastar(420, { passos: 10, ms: 40 });
    const volta = J.animacoes.find((x) => x.alvo === 'sheet');
    app.getComputedStyle = () => ({ transform: 'matrix(1, 0, 0, 1, 0, 60)', overflowX: 'visible', getPropertyValue: () => '' });
    hora += 50;
    app.folhaPousar(ev('pointerdown', 300));
    assert.ok(volta.cancelada, 'o regresso pára onde estava');
    assert.equal(desl(), 60, 'e a folha fica nos 60px a que ia');
    hora += 10;
    app.folhaArrastoMove(ev('pointermove', 330));
    assert.equal(desl(), 80, 'a partir daí, com o dedo (30px menos a folga)');
  });
});

describe('quando não pega', () => {
  test('num campo, num toque longo, em quem tem gesto próprio, no que rola de lado e no rodapé', () => {
    for (const alvo of [J.campo, J.cartao, J.palco, J.chip, J.foot]) {
      arrastar(700, { alvo });
      assert.equal(J.s.style.transform || '', '', 'não arrancou de ' + alvo.nome);
    }
  });

  test('pelo corpo: no topo e a descer pega; a subir é o scroll; a meio do scroll nunca', () => {
    arrastar(140, { alvo: J.texto, largar: false });
    assert.equal(J.s.style.transform || '', '', 'a subir pelo corpo é o scroll');
    app.folhaArrastoFim(ev('pointerup', 140));
    J.body.scrollTop = 240;
    arrastar(500, { alvo: J.texto, largar: false });
    assert.equal(J.s.style.transform || '', '', 'com o corpo a meio, o dedo rola');
    app.folhaArrastoFim(ev('pointerup', 500));
    J.body.scrollTop = 0;
    arrastar(500, { alvo: J.texto, largar: false });
    assert.ok(desl() > 0, 'no topo e a descer, a folha vem com o dedo');
  });

  test('acima dos 520px não há barra nem arrasto', () => {
    estreito = false;
    arrastar(700);
    assert.equal(J.s.style.transform || '', '');
    assert.equal(app.modalStack.length, 1);
  });

  test('só a janela de cima: a de baixo não se agarra, e uma janela nova a meio acaba o gesto', () => {
    const cima = janela();
    J.el.classList.add('under');
    app.modalStack.push({ el: cima.el, title: 'Outra', tocado: false, snap: '' });
    arrastar(700, { alvo: J.h2 });
    assert.equal(J.s.style.transform || '', '', 'a de baixo não mexe');
    app.modalStack.pop(); J.el.classList.remove('under');
    arrastar(460, { largar: false });
    assert.ok(desl() > 0);
    app.modalStack.push({ el: cima.el, title: 'Outra', tocado: false, snap: '' });
    hora += 16;
    app.folhaArrastoMove(ev('pointermove', 520));
    assert.equal(J.s.style.transform, '', 'a folha de baixo volta ao sítio');
    assert.equal(app._folhaArr, null, 'e o gesto acabou');
  });
});

describe('o browser não rola o que a folha leva', () => {
  test('trava o scroll pelo cabeçalho sempre, pelo corpo só a descer, e nunca com dois dedos ou sem arrasto', () => {
    const toque = (y, n) => {
      const e = { cancelable: true, travado: false, touches: Array.from({ length: n || 1 }, () => ({ clientX: 195, clientY: y })) };
      e.preventDefault = () => { e.travado = true; };
      app.folhaToqueMove(e);
      return e.travado;
    };
    assert.equal(toque(320), false, 'sem dedo pousado na folha, nada');
    app.folhaPousar(ev('pointerdown', 300));
    assert.equal(toque(290), true, 'pelo cabeçalho, até a subir');
    app.folhaArrastoFim(ev('pointerup', 300));
    app.folhaPousar(ev('pointerdown', 300, { target: J.texto }));
    assert.equal(toque(304), true, 'pelo corpo, a descer');
    assert.equal(toque(296), false, 'pelo corpo, a subir: é o scroll');
    assert.equal(toque(320, 2), false, 'dois dedos não são um arrasto');
  });
});

describe('o formulário com alterações', () => {
  test('pergunta «Sair sem guardar?»; quem fica tem a folha de volta ao sítio, por baixo da pergunta', () => {
    const L = app.modalStack[0];
    L.tocado = true; L.snap = 'Rua das Flores';      // o retrato de quando abriu; agora o campo diz outra coisa
    const perguntas = [];
    const pergunta = janela();
    app.openModal = (t) => { perguntas.push(t); J.el.classList.add('under'); app.modalStack.push({ el: pergunta.el, title: t, tocado: false, snap: '' }); };
    arrastar(640, { passos: 10, ms: 40 });
    assert.deepEqual(perguntas, ['Sair sem guardar?']);
    assert.equal(app.modalStack.length, 2, 'a janela continua, com a pergunta por cima');
    assert.ok(!J.el.classList.contains('arrastada'));
    assert.equal(J.s.style.transform, '', 'a folha volta ao sítio');
    const an = J.animacoes.find((x) => x.alvo === 'sheet');
    assert.ok(an && an.k[1].transform === 'none', 'a animar a partir de onde o dedo a deixou');
    app.closeModal();                                 // «Continuar a editar»
    assert.equal(app.modalTop().el, J.el, 'de volta ao formulário');
    assert.ok(!J.el.classList.contains('under'));
  });
});

describe('o CSS da folha arrastável', () => {
  const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
  const regiao = css.slice(css.indexOf('/* === folha arrastável (folha 1.3) === */'), css.indexOf('/* === fim: folha arrastável (folha 1.3) === */'));
  test('só no telemóvel: o cabeçalho é a pega, a entrada não volta a correr e a saída largada vai na --curva', () => {
    const tel = /@media\(max-width:520px\)\{([\s\S]*?)\n\}/.exec(regiao);
    assert.ok(tel, 'as regras vivem dentro de @media(max-width:520px)');
    assert.match(tel[1], /\.sheet \.head\{touch-action:none\}/);
    assert.match(tel[1], /\.modal\.open\.arrastou \.sheet,\.modal\.open\.arrastou \.bg\{animation:none\}/);
    assert.match(tel[1], /\.modal\.sai\.arrastada \.sheet,\.modal\.sai\.arrastada \.bg\{animation-timing-function:var\(--curva\)\}/);
    assert.match(tel[1], /\.modal\.arrastou \.sheet\{box-shadow:var\(--shadow\),0 32px 0 var\(--card\)\}/, 'o cartão continua por baixo quando sobe');
    assert.match(regiao, /@media\(prefers-reduced-motion:reduce\)\{\.sheet\.pronto\{opacity:\.72\}\}/);
  });
});

describe('sem movimento pedido', () => {
  test('não segue o dedo, desvanece quando largar já fecha, e fecha sem animar', () => {
    reduzido = true;
    contarFechos();
    arrastar(700, { largar: false });
    assert.equal(J.s.style.transform || '', '', 'a folha não anda');
    assert.equal(J.bg.style.opacity, undefined, 'nem o véu');
    assert.ok(J.s.classList.contains('pronto'), 'mas diz que largar já a fecha');
    app.folhaArrastoFim(ev('pointerup', 700));
    assert.deepEqual(fechos, ['arrasto']);
    assert.ok(!J.el.classList.contains('arrastada'), 'sem a saída do dedo');
    assert.equal(J.animacoes.length, 0, 'sem animação');
  });

  test('largada cedo, fica onde sempre esteve, sem animar', () => {
    reduzido = true;
    arrastar(420, { passos: 10, ms: 40 });
    assert.equal(J.animacoes.length, 0);
    assert.ok(!J.s.classList.contains('pronto') && !J.s.classList.contains('arrastar'));
    assert.equal(app.modalStack.length, 1);
  });
});
