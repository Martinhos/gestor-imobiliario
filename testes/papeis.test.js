// Papéis do bot: quem é quem, o que cada um pode correr, e que pedidos vê.
// É o que separa o suporte dos dados técnicos e a operação de toda a gente.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  papel, podeCorrer, comandosDe, PERMISSOES, CATS_DO_PAPEL, PAPEIS,
} from '../worker/src/discord.js';
import { CATEGORIAS } from '../worker/src/lib/http.js';

const quem = (id, cargos = []) => ({ member: { user: { id }, roles: cargos } });

const ENV = {
  DISCORD_MASTER: 'm1',
  DISCORD_ADMINS: 'a1',
  DISCORD_DEVS: 'd1 d2',
  DISCORD_SUPORTE: 's1,cargo-suporte',
};

describe('quem é quem', () => {
  test('reconhece cada lista', () => {
    assert.equal(papel(ENV, quem('m1')), 'master');
    assert.equal(papel(ENV, quem('a1')), 'admin');
    assert.equal(papel(ENV, quem('d2')), 'dev');
    assert.equal(papel(ENV, quem('s1')), 'suporte');
  });

  test('quem não está em lista nenhuma não entra', () => {
    assert.equal(papel(ENV, quem('estranho')), null);
  });

  test('um cargo do Discord conta como a pessoa', () => {
    assert.equal(papel(ENV, quem('outro', ['cargo-suporte'])), 'suporte');
    assert.equal(papel(ENV, quem('outro', ['cargo-qualquer'])), null);
  });

  test('estar em duas listas dá a mais alta', () => {
    assert.equal(papel(ENV, quem('a1', ['cargo-suporte'])), 'admin');
    assert.equal(papel(ENV, quem('m1', ['cargo-suporte'])), 'master', 'master fica acima de tudo');
  });

  test('sem nada configurado, quem entra no servidor manda', () => {
    assert.equal(papel({}, quem('seja-quem-for')), 'master');
  });

  test('separa vírgulas, espaços e quebras de linha', () => {
    const e = { DISCORD_DEVS: 'x1,\n x2  x3' };
    ['x1', 'x2', 'x3'].forEach((id) => assert.equal(papel(e, quem(id)), 'dev', id));
  });
});

describe('o que cada papel corre', () => {
  test('o master e o admin correm tudo', () => {
    Object.keys(PERMISSOES).forEach((c) => {
      assert.equal(podeCorrer('master', c), true, 'master · ' + c);
      assert.equal(podeCorrer('admin', c), true, 'admin · ' + c);
    });
  });

  test('o master vê todas as categorias de pedido', () => {
    assert.deepEqual([...CATS_DO_PAPEL.master].sort(), [...CATS_DO_PAPEL.admin].sort());
  });

  test('a operação é só do admin', () => {
    ['uso', 'resumo', 'copias'].forEach((c) => {
      assert.equal(podeCorrer('dev', c), false, 'dev não corre /' + c);
      assert.equal(podeCorrer('suporte', c), false, 'suporte não corre /' + c);
    });
  });

  test('os erros são de quem programa', () => {
    assert.equal(podeCorrer('dev', 'erros'), true);
    assert.equal(podeCorrer('suporte', 'erros'), false);
  });

  test('os pedidos são dos dois', () => {
    ['pedidos', 'pedido', 'responder', 'fechar'].forEach((c) => {
      assert.equal(podeCorrer('dev', c), true, c);
      assert.equal(podeCorrer('suporte', c), true, c);
    });
  });

  test('sem papel não se corre nada', () => {
    Object.keys(PERMISSOES).forEach((c) => assert.equal(podeCorrer(null, c), false, c));
  });

  test('dev e suporte são irmãos: nenhum contém o outro', () => {
    const d = comandosDe('dev'), s = comandosDe('suporte');
    assert.ok(d.includes('erros') && !s.includes('erros'), 'dev tem o que o suporte não tem');
    assert.ok(!d.every((c) => s.includes(c)), 'e não são o mesmo conjunto');
  });

  test('o admin vê pelo menos tudo o que os outros veem', () => {
    const a = comandosDe('master');
    ['dev', 'suporte'].forEach((p) => {
      comandosDe(p).forEach((c) => assert.ok(a.includes(c), 'admin também corre /' + c));
    });
  });
});

describe('que pedidos cada papel vê', () => {
  test('o suporte vê só o que as pessoas contaram', () => {
    assert.deepEqual(CATS_DO_PAPEL.suporte, ['user']);
  });

  test('quem programa não vê os pedidos de suporte', () => {
    assert.equal(CATS_DO_PAPEL.dev.includes('user'), false);
  });

  test('o admin vê todas as categorias que existem', () => {
    assert.deepEqual([...CATS_DO_PAPEL.admin].sort(), [...CATEGORIAS].sort());
  });

  test('juntando dev e suporte cobre-se tudo, sem sobreposição', () => {
    const juntos = CATS_DO_PAPEL.dev.concat(CATS_DO_PAPEL.suporte);
    assert.equal(new Set(juntos).size, juntos.length, 'nenhuma categoria em dois papéis');
    assert.deepEqual(juntos.sort(), [...CATEGORIAS].sort(), 'e nenhuma fica sem dono');
  });

  test('todo o papel tem categorias definidas', () => {
    PAPEIS.forEach((p) => assert.ok((CATS_DO_PAPEL[p] || []).length, p));
  });
});
