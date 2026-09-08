// O módulo que faz uma repintura parecer um movimento. O que se testa aqui é
// a parte que não precisa de browser — e, sobretudo, a promessa de que ele
// NUNCA fica com a repintura: se não puder animar, chama e sai da frente.
//
// Num sítio destes é fácil escrever um invólucro que engole o trabalho que
// devia embrulhar. Foi o que se testou primeiro.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp } from './arnes.js';

const app = carregarApp();
const { pintarComContinuidade, deslizarEntre, semMovimento, msDoToken, tokenTexto } = app;

describe('a repintura acontece sempre', () => {
  /* O DOM do arnês não tem animate(): é exatamente o caso «não dá para
     animar», e é onde um invólucro distraído deixaria a app sem repintar. */
  test('sem onde animar, pinta à mesma e devolve o que a pintura devolveu', () => {
    let vezes = 0;
    const r = pintarComContinuidade(() => { vezes++; return 'feito'; });
    assert.equal(vezes, 1, 'chamou a pintura uma vez, nem zero nem duas');
    assert.equal(r, 'feito', 'devolveu o que a pintura devolveu');
  });

  test('o deslize entre estados também', () => {
    let vezes = 0;
    const r = deslizarEntre(() => null, () => { vezes++; return 42; }, 1);
    assert.equal(vezes, 1);
    assert.equal(r, 42);
  });

  /* Sem raiz onde procurar peças não há nada a acompanhar — mas continua a
     haver uma vista para repintar. */
  test('com uma raiz que não existe, pinta à mesma', () => {
    let vezes = 0;
    pintarComContinuidade(() => vezes++, { raiz: () => null });
    assert.equal(vezes, 1);
  });
});

describe('menos movimento', () => {
  /* A regra de CSS que anula animações não apanha estas: são feitas pela API
     do JavaScript, que o @media não vê. Tem de se perguntar à mão — e sem
     matchMedia (numa vm, num browser antigo) a resposta é «não pediu». */
  test('sem matchMedia não rebenta, e assume que ninguém pediu', () => {
    assert.equal(semMovimento(), false);
  });
});

describe('os tempos vêm dos tokens, não de números à parte', () => {
  test('sem :root de onde os ler, fica o valor de recurso', () => {
    assert.equal(msDoToken('--medio', 200), 200);
    assert.equal(tokenTexto('--curva-entra', 'cubic-bezier(0,0,.2,1)'), 'cubic-bezier(0,0,.2,1)');
  });
});
