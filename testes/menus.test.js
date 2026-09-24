// Onde abrem os menus de escolha. É geometria pura, e é o que impede um
// dropdown de ficar cortado pelo corpo de um modal — medido em produção:
// 70% de um menu de 16 categorias fora de vista, sem sinal nenhum de que
// faltava ali alguma coisa.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
const { posicaoPop } = app;

// um botão com 44px de altura, o tamanho real de um .selbtn
const botao = (topo) => ({ top: topo, bottom: topo + 44 });
const ECRA = { top: 0, bottom: 812 };

describe('escolher o lado', () => {
  test('com espaço em baixo, abre para baixo', () => {
    assert.equal(posicaoPop(botao(100), ECRA, 230).lado, 'baixo');
  });

  test('encostado ao fundo, vira-se para cima', () => {
    assert.equal(posicaoPop(botao(700), ECRA, 230).lado, 'cima');
  });

  test('encostado ao topo, fica para baixo mesmo sem caber', () => {
    // virar para cima quando lá cabe ainda menos é mais confuso do que
    // deixar rolar para baixo
    assert.equal(posicaoPop(botao(10), ECRA, 400).lado, 'baixo');
  });

  test('a meio, com o menu a caber, não se vira', () => {
    assert.equal(posicaoPop(botao(400), ECRA, 200).lado, 'baixo');
  });
});

describe('escolher a altura', () => {
  test('cabendo, não se mexe na altura', () => {
    assert.equal(posicaoPop(botao(100), ECRA, 230).maxHeight, null);
  });

  test('não cabendo, encolhe até ao espaço que há', () => {
    // botão a 700: sobram 812-744-10 = 58 em baixo, 690 em cima -> vira e cabe
    const d = posicaoPop(botao(700), ECRA, 230);
    assert.equal(d.lado, 'cima');
    assert.equal(d.maxHeight, null, 'em cima cabe inteiro');
  });

  test('sem espaço de nenhum lado, encolhe para o maior', () => {
    const apertado = { top: 300, bottom: 500 };
    const d = posicaoPop(botao(430), apertado, 300);
    assert.equal(d.lado, 'cima');            // 120 acima contra 26 abaixo
    assert.equal(d.maxHeight, 120);
  });

  test('nunca cresce acima do que o menu já tem', () => {
    // é o que fazia um menu de 16 categorias passar de 230 para 488px
    const folgado = { top: 0, bottom: 2000 };
    assert.equal(posicaoPop(botao(100), folgado, 230).maxHeight, null);
  });

  test('não encolhe abaixo de 60px', () => {
    const esmagado = { top: 400, bottom: 460 };
    const d = posicaoPop(botao(410), esmagado, 300);
    assert.ok(d.maxHeight >= 60, 'um menu de dois pixeis não é um menu');
  });
});

describe('o menu cabe mesmo no espaço que lhe é dado', () => {
  const cabe = (topoBotao, limite, quer) => {
    const d = posicaoPop(botao(topoBotao), limite, quer, 10);
    const b = botao(topoBotao);
    const altura = d.maxHeight == null ? quer : d.maxHeight;
    const t = d.lado === 'cima' ? b.top - 5 - altura : b.bottom + 5;
    return { dentro: t >= limite.top - 1 && t + altura <= limite.bottom + 1, t, altura, lado: d.lado };
  };

  test('em qualquer posição do ecrã, não transborda', () => {
    for (let y = 0; y <= 760; y += 20) {
      for (const quer of [90, 168, 230]) {
        const r = cabe(y, ECRA, quer);
        assert.ok(r.dentro, 'botão a ' + y + ' com menu de ' + quer +
          ': ficou em ' + Math.round(r.t) + '..' + Math.round(r.t + r.altura) + ' (' + r.lado + ')');
      }
    }
  });

  test('dentro do corpo de um modal, também não', () => {
    // o corpo de um modal ocupa tipicamente 128..743
    const corpo = { top: 128, bottom: 743 };
    for (let y = 130; y <= 700; y += 20) {
      const r = cabe(y, corpo, 230);
      assert.ok(r.dentro, 'botão a ' + y + ': ' + Math.round(r.t) + '..' + Math.round(r.t + r.altura));
    }
  });

  test('num ecrã deitado, com 412px de altura, também não', () => {
    const deitado = { top: 60, bottom: 400 };
    for (let y = 62; y <= 350; y += 10) {
      const r = cabe(y, deitado, 230);
      assert.ok(r.dentro, 'botão a ' + y + ': ' + Math.round(r.t) + '..' + Math.round(r.t + r.altura));
    }
  });
});
