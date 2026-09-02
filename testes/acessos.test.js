// Exceções de acesso por pessoa. O papel manda; isto é o remendo — e um
// remendo no controlo de acessos é onde um engano custa mais caro.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { lerAcessos, guardarAcessos, origemDoAcesso, excecoesDoMenu } from '../worker/src/acessos.js';
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

  test('nem quem pode tudo o resto o herda', () => {
    // hoje só o master está em PODEM_TUDO; se um dia lá entrar outro papel,
    // este teste garante que não vem com a gestão de acessos atrás
    PODEM_TUDO.filter((p) => p !== 'master').forEach((p) => {
      assert.equal(podeCorrer(p, 'access'), false, p + ' pode o resto, mas não isto');
    });
    assert.equal(podeCorrer('admin', 'access'), false);
  });
});

describe('as caixas do menu viram exceções', () => {
  // o menu marca comandos; o que se guarda é a diferença para o cargo
  const GERIVEIS = Object.keys(PERMISSOES).filter((c) => SO_MASTER.indexOf(c) < 0);
  const doCargo = (pap) => (c) => origem(pap, c, { mais: [], menos: [] }) === 'papel';

  test('marcar o que o cargo não dá guarda um mais', () => {
    const d = excecoesDoMenu(comandosDe('suporte').concat('erros'), GERIVEIS, doCargo('suporte'));
    assert.deepEqual(d.mais, ['erros']);
    assert.deepEqual(d.menos, []);
  });

  test('desmarcar o que o cargo dá guarda um menos', () => {
    const d = excecoesDoMenu(comandosDe('admin').filter((c) => c !== 'uso'), GERIVEIS, doCargo('admin'));
    assert.deepEqual(d.mais, []);
    assert.deepEqual(d.menos, ['uso']);
  });

  test('deixar tudo como veio não guarda exceção nenhuma', () => {
    // abrir o menu e fechá-lo sem mexer não pode escrever nada
    ['admin', 'dev', 'suporte'].forEach((p) => {
      const d = excecoesDoMenu(comandosDe(p), GERIVEIS, doCargo(p));
      assert.deepEqual(d, { mais: [], menos: [] }, p);
    });
  });

  test('guarda-se a diferença para o cargo, não a lista marcada', () => {
    /* É o que faz com que mudar o cargo de alguém no Discord continue a
       mudar-lhe os acessos: se guardássemos a lista marcada, a pessoa
       ficava congelada no cargo que tinha no dia em que se abriu o menu. */
    const marcados = comandosDe('suporte').concat('erros');
    const d = excecoesDoMenu(marcados, GERIVEIS, doCargo('suporte'));
    assert.ok(d.mais.concat(d.menos).length < marcados.length);
    // e o mesmo clique visto de um cargo diferente guarda outra coisa
    const outro = excecoesDoMenu(marcados, GERIVEIS, doCargo('dev'));
    assert.notDeepEqual(outro, d);
  });

  test('o /access nunca entra nas caixas', () => {
    assert.equal(GERIVEIS.indexOf('access'), -1);
    const d = excecoesDoMenu(['access'], GERIVEIS, doCargo('admin'));
    assert.equal(d.mais.indexOf('access'), -1);
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
