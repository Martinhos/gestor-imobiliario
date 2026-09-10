// A publicação chega a quem já tem a app instalada?
//
// A cache offline chama-se pela VERSÃO (web/sw.js). Publicar sem subir a versão
// é publicar para ninguém — e, pior, é publicar para meio de um carregamento,
// porque o install do worker novo abre a cache com o MESMO nome e sobrepõe as
// entradas por baixo de quem está a ler. É a avaria da v31 pela porta do lado.
//
// Este é o guarda que recusa a publicação antes de ela sair.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ficheirosGuardados, decidir } = require('../scripts/chegada.js');

describe('a decisão de deixar publicar', () => {
  test('nada mudou: publica-se, e a versão fica onde está', () => {
    const r = decidir([], 33, 33);
    assert.equal(r.ok, true);
    assert.match(r.motivo, /nada do que a cache guarda mudou/);
  });

  test('mudou e a versão sobe: é o caminho normal', () => {
    const r = decidir(['web/app/lista.js'], 33, 34);
    assert.equal(r.ok, true);
    assert.match(r.motivo, /33 para 34/);
  });

  /* O caso que isto existe para apanhar. Sem versão nova, a app instalada não
     recebe nada: a cache tem o nome da versão e o /versao.json responde o
     mesmo número, portanto nem o worker troca nem a app pergunta. */
  test('mudou e a versão não sobe: não sai', () => {
    const r = decidir(['web/app/lista.js', 'web/sw.js'], 33, 33);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /web\/app\/lista\.js/, 'diz quais são');
    assert.match(r.motivo, /web\/sw\.js/);
    assert.match(r.motivo, /node scripts\/versao\.js/, 'e diz o que fazer a seguir');
  });

  /* Uma versão a descer põe a app a pedir-se uma atualização para trás, e o
     activate do worker apaga a cache da versão mais recente. */
  test('a versão a descer não sai, mudasse o que mudasse', () => {
    assert.equal(decidir([], 34, 33).ok, false);
    assert.equal(decidir(['web/avisos.js'], 34, 33).ok, false);
    assert.match(decidir([], 34, 33).motivo, /DESCEU/);
  });
});

describe('que ficheiros contam', () => {
  const guardados = ficheirosGuardados();

  test('saem da SHELL do sw.js, e não de uma segunda lista à mão', () => {
    ['web/index.html', 'web/avisos.js', 'web/legal.js', 'web/manifest.webmanifest',
      'web/app/dados.js', 'web/cloud/nucleo.js', 'web/icon-192.png'].forEach((f) => {
      assert.ok(guardados.includes(f), f + ' devia contar');
    });
  });

  /* O worker não está na SHELL — não se guarda a si próprio —, mas é ele que
     manda na cache: uma alteração ao sw.js sem versão nova põe o worker novo a
     encher a cache do antigo. */
  test('o próprio service worker conta', () => {
    assert.ok(guardados.includes('web/sw.js'));
  });

  test('a raiz conta como o index.html, e não como um caminho «web/»', () => {
    assert.ok(!guardados.includes('web/'), 'o «/» da SHELL não vira um caminho de pasta');
    assert.equal(guardados.filter((f) => f === 'web/index.html').length, 1, 'e não fica repetido');
  });

  test('não conta o que a cache não guarda', () => {
    assert.ok(!guardados.includes('web/versao.json'), 'é derivado da versão, não a define');
    assert.ok(!guardados.some((f) => f.startsWith('web/img/')), 'as imagens são da montra');
    assert.ok(!guardados.includes('web/_headers'));
  });

  test('todos existem — um caminho mal traduzido passava a nunca acusar nada', () => {
    guardados.forEach((f) => {
      assert.ok(existsSync(new URL('../' + f, import.meta.url)), f + ' não existe');
    });
  });

  test('sem repetições', () => {
    assert.equal(new Set(guardados).size, guardados.length);
  });

  /* A leitura é por expressão sobre o texto do sw.js. Se as listas mudarem de
     forma, isto tem de rebentar em vez de devolver uma lista curta em silêncio
     — uma lista curta não acusa nada e deixa passar tudo. */
  test('um sw.js que não se reconheça rebenta, em vez de deixar passar', () => {
    assert.throws(() => ficheirosGuardados('/* um sw.js sem listas nenhumas */'),
      /não encontrei a lista/);
  });
});
