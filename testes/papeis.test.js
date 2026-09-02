// Papéis do bot: quem é quem, o que cada um pode correr, e que pedidos vê.
// É o que separa o suporte dos dados técnicos e a operação de toda a gente.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  papel, papeisDe, podeCorrer, comandosDe, catsDe,
  PERMISSOES, CATS_DO_PAPEL, PAPEIS, SO_MASTER,
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

  test('estar em duas listas dá a mais alta como principal', () => {
    assert.equal(papel(ENV, quem('a1', ['cargo-suporte'])), 'admin');
    assert.equal(papel(ENV, quem('m1', ['cargo-suporte'])), 'master', 'master fica acima de tudo');
  });

  test('mas os papéis somam-se: ter dois cargos dá os dois cantos', () => {
    // com irmãos, escolher só o mais alto tirava acessos a quem ganhasse
    // um segundo cargo — o admin já não contém o suporte
    const dois = quem('a1', ['cargo-suporte']);
    assert.deepEqual(papeisDe(ENV, dois), ['admin', 'suporte']);
    assert.equal(podeCorrer(papeisDe(ENV, dois), 'uso'), true, 'o lado de admin');
    assert.equal(podeCorrer(papeisDe(ENV, dois), 'pedidos'), true, 'o lado de suporte');
    assert.deepEqual(catsDe(papeisDe(ENV, dois)).sort(), ['infra', 'seguranca', 'user']);
  });

  test('quem não está em lista nenhuma não tem papéis', () => {
    assert.deepEqual(papeisDe(ENV, quem('estranho')), []);
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
  test('o master corre tudo', () => {
    Object.keys(PERMISSOES).forEach((c) => assert.equal(podeCorrer('master', c), true, c));
  });

  test('só o master corre o que é só do master', () => {
    // quem gere quem pode o quê tem de ser um só: ver testes/acessos.test.js
    assert.ok(SO_MASTER.length, 'e há mesmo algum comando assim');
    SO_MASTER.forEach((c) => {
      ['admin', 'dev', 'suporte'].forEach((p) => assert.equal(podeCorrer(p, c), false, p + ' · ' + c));
    });
  });

  test('os três irmãos não se contêm uns aos outros', () => {
    /* É o que muda com a hierarquia nova: o admin já não é um super-dev.

       O alcance de um papel não são só os comandos — o admin e o suporte
       correm os mesmos comandos de pedidos, mas sobre pedidos diferentes.
       Comparar só a lista de comandos dizia que o suporte cabia dentro do
       admin, e não cabe: o admin não vê um único pedido de uma pessoa. */
    const alcance = (p) => comandosDe(p).concat(catsDe(p).map((c) => 'pedidos:' + c));
    const conj = { admin: alcance('admin'), dev: alcance('dev'), suporte: alcance('suporte') };
    ['admin', 'dev', 'suporte'].forEach((a) => {
      ['admin', 'dev', 'suporte'].forEach((b) => {
        if (a === b) return;
        assert.ok(
          conj[a].some((c) => conj[b].indexOf(c) < 0),
          a + ' alcança alguma coisa que o ' + b + ' não alcança'
        );
      });
    });
  });

  test('o master vê todas as categorias de pedido', () => {
    assert.deepEqual([...CATS_DO_PAPEL.master].sort(), [...CATEGORIAS].sort());
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

  test('o consumo é do admin e mais de ninguém', () => {
    assert.equal(podeCorrer('admin', 'uso'), true);
    assert.equal(podeCorrer('dev', 'uso'), false);
  });

  test('o master corre pelo menos tudo o que os irmãos correm', () => {
    const m = comandosDe('master');
    ['admin', 'dev', 'suporte'].forEach((p) => {
      comandosDe(p).forEach((c) => assert.ok(m.includes(c), 'o master também corre /' + c));
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

  test('o admin vê a infraestrutura, não os pedidos das pessoas', () => {
    assert.ok(CATS_DO_PAPEL.admin.includes('infra'));
    assert.equal(CATS_DO_PAPEL.admin.includes('user'), false);
  });

  test('juntando os três irmãos, nenhuma categoria fica sem dono', () => {
    const juntos = new Set(
      CATS_DO_PAPEL.admin.concat(CATS_DO_PAPEL.dev, CATS_DO_PAPEL.suporte)
    );
    assert.deepEqual([...juntos].sort(), [...CATEGORIAS].sort());
  });

  test('a única categoria partilhada é a segurança, de propósito', () => {
    // um aviso de segurança que ninguém vê é pior do que um visto duas vezes
    const juntos = CATS_DO_PAPEL.admin.concat(CATS_DO_PAPEL.dev, CATS_DO_PAPEL.suporte);
    const repetidas = juntos.filter((c, n) => juntos.indexOf(c) !== n);
    assert.deepEqual(repetidas, ['seguranca']);
  });

  test('todo o papel tem categorias definidas', () => {
    PAPEIS.forEach((p) => assert.ok((CATS_DO_PAPEL[p] || []).length, p));
  });
});
