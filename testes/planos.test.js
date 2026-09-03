// Os planos com dentes, e o interruptor que os liga. É a primeira vez que
// o campo users.plan decide alguma coisa — e a promessa dos termos ("nada
// do que existe fica inacessível") tem de sobreviver a estes testes.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { LIMITES, podeCriar, modoDemo, fimDemo, definirDemo, esquecerCache } from '../worker/src/lib/planos.js';
import { kvFalso } from './lib/bd.js';

beforeEach(() => esquecerCache());

describe('o que cada plano deixa criar', () => {
  test('free: três imóveis, sem contratos nem planeados', () => {
    assert.equal(podeCriar('free', 'imovel', 2), null, 'o terceiro ainda entra');
    assert.match(podeCriar('free', 'imovel', 3), /3 imóveis/);
    assert.match(podeCriar('free', 'contract', 0), /Plus/);
    assert.match(podeCriar('free', 'rec', 0), /Plus/);
  });

  test('plus: dez imóveis e o resto todo', () => {
    assert.equal(podeCriar('plus', 'imovel', 9), null);
    assert.match(podeCriar('plus', 'imovel', 10), /10 imóveis/);
    assert.equal(podeCriar('plus', 'contract', 0), null);
    assert.equal(podeCriar('plus', 'rec', 0), null);
  });

  test('pro: sem limites', () => {
    assert.equal(podeCriar('pro', 'imovel', 500), null);
    assert.equal(podeCriar('pro', 'contract', 0), null);
  });

  test('um plano desconhecido vale free — o mais apertado, não o mais largo', () => {
    assert.match(podeCriar('platina', 'imovel', 3), /imóveis/);
    assert.match(podeCriar(null, 'contract', 0), /Plus/);
  });

  test('a recusa explica e promete: o que se escreveu não se perde', () => {
    ['contract', 'rec'].forEach((t) => assert.match(podeCriar('free', t, 0), /fica neste aparelho/));
  });

  test('nenhum limite fala de apagar ou esconder — só de criar', () => {
    Object.keys(LIMITES).forEach((p) => {
      const m = podeCriar(p, 'imovel', 99999);
      if (m) assert.doesNotMatch(m, /apagad|inacess/i, p);
    });
  });
});

describe('o fim do demo é uma data, não um interruptor', () => {
  test('sem nada guardado, é demo: a app comporta-se como sempre', async () => {
    assert.equal(await modoDemo({ SESSIONS: kvFalso() }), true);
    assert.equal(await fimDemo({ SESSIONS: kvFalso() }), null);
  });

  test('marcar o fim dá 30 dias de aviso: até lá continua tudo a passar', async () => {
    const env = { SESSIONS: kvFalso() };
    const fim = await definirDemo(env, false);   // 30 dias por omissão
    assert.ok(fim > Date.now() + 29 * 86400000, 'a data fica um mês à frente');
    assert.equal(await modoDemo(env), true, 'os limites ainda não valem');
    assert.equal(await fimDemo(env), fim, 'mas a data já se anuncia');
  });

  test('com a data passada, os limites valem', async () => {
    const env = { SESSIONS: kvFalso() };
    await definirDemo(env, false, 0);   // fim imediato (só para testes e dev)
    assert.equal(await modoDemo(env), false);
  });

  test('religar apaga a data e cancela o aviso', async () => {
    const env = { SESSIONS: kvFalso() };
    await definirDemo(env, false, 0);
    await definirDemo(env, true);
    assert.equal(await modoDemo(env), true);
    assert.equal(await fimDemo(env), null);
  });

  test('com o KV em baixo, é demo — um outage não tranca clientes', async () => {
    const mau = { SESSIONS: { async get() { throw new Error('KV em baixo'); } } };
    assert.equal(await modoDemo(mau), true);
  });

  test('a cache não sobrevive a definirDemo: a mudança age já', async () => {
    const env = { SESSIONS: kvFalso() };
    assert.equal(await modoDemo(env), true);   // aquece a cache
    await definirDemo(env, false, 0);
    assert.equal(await modoDemo(env), false, 'sem esperar os 60 segundos');
  });
});
