// O cartão do «Anular» puxa-se para baixo com o dedo: segue-o só na vertical
// (para cima resiste), fecha passada metade da altura ou com um sacudir, e
// volta ao sítio se o dedo larga cedo. Fechá-lo não desfaz nem antecipa o
// apagar: o aoExpirar corre aos 6400ms de sempre. Com o dedo pousado, o prazo
// do aviso e o do desfazer esperam; o clique que vem a seguir a um arrasto não
// carrega no «Anular»; o rato não arrasta; um aviso novo a meio ganha; e sem
// movimento pedido o cartão não segue o dedo e fecha sem animar.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

/* Um relógio de mão: os prazos do aviso (6000ms) e do desfazer (6400ms)
   andam quando o teste manda, e o Date.now da app é o dele. */
const relogio = {
  agora: 1e12, fila: [], n: 0,
  por(f, ms) { const id = ++this.n; this.fila.push({ id, quando: this.agora + (ms || 0), f }); return id; },
  tirar(id) { this.fila = this.fila.filter((x) => x.id !== id); },
  andar(ms) {
    const alvo = this.agora + ms;
    for (;;) {
      this.fila.sort((a, b) => a.quando - b.quando || a.id - b.id);
      const p = this.fila[0];
      if (!p || p.quando > alvo) break;
      this.fila.shift(); this.agora = p.quando; p.f();
    }
    this.agora = alvo;
  },
};
const app = carregarApp({
  antes(j) {
    j.setTimeout = (f, ms) => relogio.por(f, ms);
    j.clearTimeout = (id) => relogio.tirar(id);
    j.Date = class extends Date { static now() { return relogio.agora; } };
  },
});

/* O #toast com o que o browser lhe daria: as classes a sério, o texto que
   apaga os filhos, a caixa de 56px perto do fundo do ecrã de 900 do arnês e as
   animações registadas (com o cancelar e o onfinish à mão do teste). */
function avisoFalso() {
  const classes = new Set();
  const t = {
    id: 'toast', style: { transform: '', setProperty(k, v) { this[k] = v; } }, filhos: [], animacoes: [],
    get textContent() { return this._txt || ''; },
    set textContent(v) { this._txt = v; this.filhos = []; },
    classList: {
      add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
      toggle: (c, f) => ((f === undefined ? !classes.has(c) : f) ? classes.add(c) : classes.delete(c)),
    },
    appendChild(x) { this.filhos.push(x); return x; },
    closest: (s) => (s === '#toast' ? t : null),
    getBoundingClientRect: () => ({ top: 680, bottom: 736, height: 56, left: 40, right: 350, width: 310 }),
    setPointerCapture() {},
    animate(k, o) {
      const an = { k, o, cancelada: false, onfinish: null, cancel() { this.cancelada = true; } };
      t.animacoes.push(an);
      return an;
    },
  };
  return t;
}

let T, esp;
beforeEach(() => {
  limpar(app);
  relogio.fila = [];
  T = avisoFalso();
  const porId = app.document.getElementById;
  app.document.getElementById = (id) => (id === 'toast' ? T : porId(id));
  app.save = () => {}; app.render = () => {}; app.buildNav = () => {};
  esp = { repostos: 0, expirados: 0 };
});
afterEach(() => repor(app));
// o dedo que ficou pousado sai, e os prazos que ficaram a correr acabam dentro do teste que os armou
afterEach(() => { app.avisoArrastoFim(ev('pointercancel', 700)); relogio.andar(60000); });

// um evento de ponteiro de dedo no aviso, à altura y
const ev = (type, y, extra) => Object.assign({ type, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientX: 195, clientY: y, target: T }, extra || {});
// apagar qualquer coisa: o toast com «Anular», a contar repostos e expirados
const apagar = () => app.comDesfazer('Movimento apagado.', () => { esp.repostos++; }, () => { esp.expirados++; });
// o botão «Anular» do aviso de agora
const anular = () => T.filhos.find((b) => b.className === 'toastbtn');
// o deslocamento vertical (px) que o transform do aviso tem agora
const desl = () => { const m = /translateY\((-?[\d.]+)px\)/.exec(T.style.transform); return m ? Number(m[1]) : 0; };
// pousa, arrasta em passos de 10ms até y e (opcional) larga
function arrastar(ate, opcoes) {
  const o = Object.assign({ de: 700, passos: 6, largar: true, ms: 10 }, opcoes);
  app.avisoPousar(ev('pointerdown', o.de, o.extra));
  for (let i = 1; i <= o.passos; i++) {
    relogio.andar(o.ms);
    app.avisoArrastoMove(ev('pointermove', o.de + ((ate - o.de) * i) / o.passos, o.extra));
  }
  if (o.largar) app.avisoArrastoFim(ev('pointerup', ate, o.extra));
}

describe('o aviso com «Anular» segue o dedo', () => {
  test('pousar e puxar para baixo: só depois dos 10px de decidir, e colado ao dedo, sem salto', () => {
    apagar();
    assert.ok(T.classList.contains('on') && T.classList.contains('arrasta'), 'o aviso com botão é arrastável');
    app.avisoPousar(ev('pointerdown', 700));
    app.avisoArrastoMove(ev('pointermove', 706));
    assert.equal(T.style.transform, '', 'aos 6px ainda não é um arrasto');
    assert.ok(!T.classList.contains('arrastar'));
    relogio.andar(16);
    app.avisoArrastoMove(ev('pointermove', 712));
    assert.ok(T.classList.contains('arrastar'), 'passou a arrastar (transições do transform desligadas)');
    assert.equal(desl(), 2, 'a folga de decidir não conta: 12px de dedo dão 2px de aviso');
    relogio.andar(16);
    app.avisoArrastoMove(ev('pointermove', 730));
    assert.equal(desl(), 20);
    assert.match(T.style.transform, /^translateX\(-50%\) translateY\(20px\)$/, 'mantém o centrado do .toast');
  });

  test('para cima resiste: anda menos do que o dedo e nunca passa de metade da altura', () => {
    apagar();
    arrastar(560, { largar: false });
    const y = desl();
    assert.ok(y < 0 && y > -28, 'para cima, com elástico (' + y + 'px)');
    assert.ok(Math.abs(y) < 130, 'muito menos do que os 130px do dedo');
    assert.ok(!T.classList.contains('pronto'), 'para cima nunca fecha');
    app.avisoArrastoFim(ev('pointerup', 560));
    assert.ok(T.classList.contains('on'), 'largado para cima, fica');
  });

  test('para o lado não é dele: o aviso não mexe e, ao largar, o prazo retoma', () => {
    apagar();
    app.avisoPousar(ev('pointerdown', 700));
    app.avisoArrastoMove(ev('pointermove', 702, { clientX: 230 }));
    app.avisoArrastoMove(ev('pointermove', 740, { clientX: 260 }));
    assert.equal(T.style.transform, '', 'um gesto de lado não arrasta o aviso');
    app.avisoArrastoFim(ev('pointerup', 740, { clientX: 260 }));
    assert.ok(T.classList.contains('on'));
    relogio.andar(6000);
    assert.ok(!T.classList.contains('on'), 'o prazo voltou a contar');
  });
});

describe('largar: fecha ou volta', () => {
  test('passada metade da altura, fecha a deslizar para baixo; o apagado continua apagado e o prazo é o de sempre', () => {
    apagar();
    relogio.andar(1000);
    arrastar(750, { passos: 10, ms: 30 });
    assert.ok(!T.classList.contains('on'), 'fechado: sem .on, já não se toca');
    assert.equal(T.style.transform, '', 'por baixo da animação, já no estado fechado');
    const an = T.animacoes.at(-1);
    assert.ok(an, 'sai a animar');
    assert.match(an.k[0].transform, /translateY\(40px\)/, 'parte de onde o dedo o deixou (50px de dedo menos a folga)');
    assert.equal(an.k[1].opacity, 0);
    assert.match(an.k[1].transform, /translateY\(220px\)/, 'até sair do ecrã (900 − 680)');
    assert.equal(an.o.duration, 200, 'o --medio');
    assert.equal(an.o.easing, 'cubic-bezier(.22,1,.36,1)', 'a --curva: o largar continua a velocidade do dedo');
    assert.equal(esp.repostos, 0, 'fechar não anula');
    assert.equal(esp.expirados, 0, 'nem antecipa o que não volta');
    relogio.andar(6400 - 1300 - 1);
    assert.equal(esp.expirados, 0, 'um milissegundo antes dos 6400ms, ainda nada');
    relogio.andar(1);
    assert.equal(esp.expirados, 1, 'aos 6400ms do apagar, liquida — como sempre');
  });

  test('um sacudir para baixo fecha mesmo antes de metade', () => {
    apagar();
    arrastar(725, { passos: 3, ms: 8 });
    assert.ok(!T.classList.contains('on'), '15px a quase 1px/ms é um sacudir');
  });

  test('um dedo que parou antes de largar já não é um sacudir', () => {
    apagar();
    arrastar(725, { passos: 3, ms: 8, largar: false });
    relogio.andar(150);
    app.avisoArrastoFim(ev('pointerup', 725));
    assert.ok(T.classList.contains('on'), 'parado 150ms antes de largar: volta');
  });

  test('largar cedo volta ao sítio (--medio, --curva-entra), e o «Anular» ainda repõe', () => {
    apagar();
    arrastar(725, { passos: 10, ms: 40 });
    assert.ok(T.classList.contains('on'), 'ficou à vista');
    assert.equal(T.style.transform, '', 'a base é o sítio; a animação leva-o lá');
    const an = T.animacoes.at(-1);
    assert.match(an.k[0].transform, /translateY\(15px\)/);
    assert.equal(an.k[1].transform, 'translateX(-50%)');
    assert.equal(an.o.easing, 'cubic-bezier(0,0,.2,1)', 'a --curva-entra');
    an.onfinish();
    assert.ok(!T.classList.contains('arrastar'), 'no fim, as transições de sempre voltam');
    relogio.andar(400);
    anular().onclick();
    assert.equal(esp.repostos, 1, 'o Anular repõe');
    assert.equal(T.textContent, 'Anulado.');
    relogio.andar(10000);
    assert.equal(esp.expirados, 0, 'anulado, nunca liquida');
  });

  test('o clique que vem logo a seguir a um arrasto não carrega no «Anular»', () => {
    apagar();
    arrastar(720, { passos: 4, ms: 40 });
    assert.ok(T.classList.contains('on'));
    anular().onclick();
    assert.equal(esp.repostos, 0, 'o clique do fim do arrasto engole-se');
    assert.ok(T.classList.contains('on'), 'e o aviso continua lá');
    relogio.andar(400);
    anular().onclick();
    assert.equal(esp.repostos, 1, 'um toque a sério, depois, anula');
  });
});

describe('o prazo espera pelo dedo', () => {
  test('com o dedo no aviso nada fecha nem liquida; devolvido, fica o que faltava (pelo menos 1,5s) e o desfazer anda com ele', () => {
    apagar();
    relogio.andar(5000);
    arrastar(720, { passos: 2, ms: 10, largar: false });
    relogio.andar(4000);
    assert.ok(T.classList.contains('on'), 'aos 9s, com o dedo nele, o aviso não fechou');
    assert.equal(esp.expirados, 0, 'e o desfazer não liquidou');
    app.avisoArrastoFim(ev('pointerup', 700));
    assert.ok(T.classList.contains('on'), 'voltou');
    relogio.andar(1499);
    assert.ok(T.classList.contains('on'), 'faltava 1s: fica 1,5s');
    relogio.andar(1);
    assert.ok(!T.classList.contains('on'), 'e sai aos 1,5s');
    assert.equal(esp.expirados, 0, 'o Anular saiu há instantes: a folga de 400ms de sempre');
    relogio.andar(400);
    assert.equal(esp.expirados, 1, '400ms depois de o aviso sair, liquida');
  });

  test('seguro além do prazo e afastado: liquida ao largar, nem antes nem nunca', () => {
    apagar();
    relogio.andar(3000);
    arrastar(780, { passos: 8, ms: 10, largar: false });
    relogio.andar(5000);
    assert.equal(esp.expirados, 0, 'o dedo segura o prazo');
    app.avisoArrastoFim(ev('pointerup', 780));
    assert.ok(!T.classList.contains('on'));
    assert.equal(esp.expirados, 1, 'passado o prazo, liquida assim que o aviso sai');
    assert.equal(esp.repostos, 0);
  });
});

describe('quem arrasta e quem interrompe', () => {
  test('o rato não arrasta, e um aviso sem botão também não', () => {
    apagar();
    arrastar(780, { extra: { pointerType: 'mouse' } });
    assert.ok(T.classList.contains('on'), 'com o rato, o aviso fica');
    assert.equal(T.animacoes.length, 0);
    app.toast('Guardado.');
    assert.ok(!T.classList.contains('arrasta'), 'sem botão, não é arrastável');
    arrastar(780);
    assert.ok(T.classList.contains('on'), 'e não sai com o dedo');
  });

  test('um aviso novo a meio do arrasto ganha: o arrasto acaba e o desfazer anterior liquida no prazo dele', () => {
    apagar();
    arrastar(740, { largar: false });
    assert.ok(desl() > 0);
    app.toast('Sincronizado.');
    assert.equal(T.style.transform, '', 'o aviso novo vem no sítio');
    assert.ok(!T.classList.contains('arrastar'), 'com as transições de sempre');
    assert.equal(T.textContent, 'Sincronizado.');
    app.avisoArrastoMove(ev('pointermove', 790));
    app.avisoArrastoFim(ev('pointerup', 790));
    assert.ok(T.classList.contains('on'), 'o dedo do arrasto antigo já não mexe no novo');
    relogio.andar(6400);
    assert.equal(esp.expirados, 1, 'o desfazer de antes deixou de esperar pelo dedo');
  });

  test('apanhado a meio do regresso, o aviso segue o dedo a partir de onde está', () => {
    apagar();
    arrastar(725, { passos: 10, ms: 40 });
    const volta = T.animacoes.at(-1);
    app.getComputedStyle = () => ({ transform: 'matrix(1, 0, 0, 1, -155, 6)', opacity: '1', getPropertyValue: () => '' });
    relogio.andar(100);
    app.avisoPousar(ev('pointerdown', 700));
    assert.ok(volta.cancelada, 'a volta pára onde estava');
    assert.equal(desl(), 6, 'e o aviso fica nos 6px a que ia');
    relogio.andar(10);
    app.avisoArrastoMove(ev('pointermove', 730));
    assert.equal(desl(), 26, 'a partir daí, com o dedo');
  });
});

describe('sem movimento pedido', () => {
  test('não segue o dedo, desvanece quando largar já fecha, e fecha sem animar', () => {
    app.semMovimento = () => true;
    apagar();
    arrastar(760, { largar: false });
    assert.equal(T.style.transform, '', 'o aviso não anda');
    assert.ok(T.classList.contains('pronto'), 'mas diz que largar já o fecha');
    app.avisoArrastoFim(ev('pointerup', 760));
    assert.ok(!T.classList.contains('on'), 'fechou');
    assert.equal(T.animacoes.length, 0, 'sem animação');
    assert.ok(!T.classList.contains('arrastar') && !T.classList.contains('pronto'));
    assert.equal(esp.repostos, 0);
  });
});
