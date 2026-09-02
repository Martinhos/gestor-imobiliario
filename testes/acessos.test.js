// Exceções de acesso por pessoa. O papel manda; isto é o remendo — e um
// remendo no controlo de acessos é onde um engano custa mais caro.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { lerAcessos, guardarAcessos, origemDoAcesso } from '../worker/src/acessos.js';
import { podeCorrer, comandosDe, PERMISSOES, PODEM_TUDO, SO_MASTER } from '../worker/src/discord.js';

const REGRAS = { PERMISSOES, PODEM_TUDO, SO_MASTER };
const origem = (pap, cmd, a) => origemDoAcesso(pap, cmd, a, REGRAS);

function kvFalso() {
  const m = new Map();
  return {
    m,
    async put(k, v) { m.set(k, v); },
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async delete(k) { m.delete(k); },
  };
}
const env = () => ({ SESSIONS: kvFalso() });

describe('de onde vem cada acesso', () => {
  test('o que o cargo dá é predefinido', () => {
    assert.equal(origem('dev', 'erros'), 'papel');
    assert.equal(origem('suporte', 'pedidos'), 'papel');
    assert.equal(origem('admin', 'uso'), 'papel');
  });

  test('o que o cargo não dá, sem exceção, é nada', () => {
    assert.equal(origem('suporte', 'erros'), 'nao');
    assert.equal(origem('dev', 'uso'), 'nao');
  });

  test('acrescentado a uma pessoa aparece como dado', () => {
    assert.equal(origem('suporte', 'erros', { mais: ['erros'], menos: [] }), 'dado');
  });

  test('retirado a uma pessoa aparece como retirado', () => {
    assert.equal(origem('dev', 'erros', { mais: [], menos: ['erros'] }), 'retirado');
  });

  test('retirar ganha a dar, se ambos existirem', () => {
    // um estado que não devia acontecer, mas se acontecer nega-se
    assert.equal(origem('dev', 'erros', { mais: ['erros'], menos: ['erros'] }), 'retirado');
  });
});

describe('o que se pode correr', () => {
  test('sem exceções, é o que o papel dá', () => {
    assert.equal(podeCorrer('suporte', 'erros'), false);
    assert.equal(podeCorrer('dev', 'erros'), true);
  });

  test('uma exceção dá acesso a quem o cargo não dava', () => {
    assert.equal(podeCorrer('suporte', 'erros', { mais: ['erros'], menos: [] }), true);
  });

  test('uma exceção tira acesso a quem o cargo dava', () => {
    assert.equal(podeCorrer('dev', 'erros', { mais: [], menos: ['erros'] }), false);
    assert.equal(podeCorrer('admin', 'uso', { mais: [], menos: ['uso'] }), false);
  });

  test('a lista de comandos acompanha as exceções', () => {
    const base = comandosDe('suporte');
    const mais = comandosDe('suporte', { mais: ['erros'], menos: [] });
    assert.equal(base.includes('erros'), false);
    assert.equal(mais.includes('erros'), true);
    const menos = comandosDe('suporte', { mais: [], menos: ['pedidos'] });
    assert.equal(menos.includes('pedidos'), false);
  });
});

describe('o master não se tranca fora', () => {
  test('nenhuma exceção lhe retira nada', () => {
    Object.keys(PERMISSOES).forEach((c) => {
      assert.equal(podeCorrer('master', c, { mais: [], menos: [c] }), true, c);
    });
  });

  test('e tudo lhe aparece como predefinido', () => {
    assert.equal(origem('master', 'access', { mais: [], menos: ['access'] }), 'papel');
  });
});

describe('o /access não se dá a si próprio', () => {
  test('só o master o corre', () => {
    assert.equal(podeCorrer('master', 'access'), true);
    ['admin', 'dev', 'suporte'].forEach((p) => {
      assert.equal(podeCorrer(p, 'access'), false, p + ' não corre /access');
    });
  });

  test('nem por exceção se consegue', () => {
    // senão quem gere acessos podia dar-se a si a gestão de acessos
    ['admin', 'dev', 'suporte'].forEach((p) => {
      assert.equal(podeCorrer(p, 'access', { mais: ['access'], menos: [] }), false, p);
      assert.equal(origem(p, 'access', { mais: ['access'], menos: [] }), 'nao', p);
    });
  });

  test('nem o admin o herda por poder tudo o resto', () => {
    assert.equal(PODEM_TUDO.includes('admin'), true, 'o admin pode o resto');
    assert.equal(podeCorrer('admin', 'access'), false, 'mas não isto');
  });
});

describe('guardar e ler', () => {
  test('o que se guarda lê-se de volta', async () => {
    const e = env();
    await guardarAcessos(e, '42', { mais: ['erros'], menos: ['uso'] });
    assert.deepEqual(await lerAcessos(e, '42'), { mais: ['erros'], menos: ['uso'] });
  });

  test('não guarda repetidos', async () => {
    const e = env();
    const r = await guardarAcessos(e, '42', { mais: ['erros', 'erros'], menos: [] });
    assert.deepEqual(r.mais, ['erros']);
  });

  test('sem exceções apaga a entrada em vez de guardar vazio', async () => {
    const e = env();
    await guardarAcessos(e, '42', { mais: ['erros'], menos: [] });
    await guardarAcessos(e, '42', { mais: [], menos: [] });
    assert.equal(e.SESSIONS.m.has('acesso:42'), false);
  });

  test('quem nunca teve exceções não tem nenhuma', async () => {
    assert.deepEqual(await lerAcessos(env(), 'nunca-visto'), { mais: [], menos: [] });
  });

  test('sem id, ou com o KV avariado, vale o papel', async () => {
    assert.deepEqual(await lerAcessos(env(), null), { mais: [], menos: [] });
    const mau = { SESSIONS: { async get() { throw new Error('KV em baixo'); } } };
    assert.deepEqual(await lerAcessos(mau, '42'), { mais: [], menos: [] });
  });

  test('lixo guardado não vira permissões', async () => {
    const e = env();
    await e.SESSIONS.put('acesso:42', '{"mais":"tudo","menos":null}');
    assert.deepEqual(await lerAcessos(e, '42'), { mais: [], menos: [] });
  });
});
