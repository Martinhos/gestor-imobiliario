// As migrações da base: numeradas de 0001 em diante, uma a uma, sem repetidos
// nem saltos. O wrangler aplica-as pela ordem do NOME, e dois ramos que criem
// cada um a sua 0016_*.sql fundem-se sem conflito nenhum no git — ficam as
// duas, e em produção corre primeiro a que calhar à frente no alfabeto, uma
// ordem que ninguém escolheu.
//
// O CI tinha um passo para isto que passava sempre: um `sort -c` sobre uma
// lista que o `ls` já devolve ordenada (medido com 0015_a, 0015_b e 0017_c:
// passava com o repetido e com o salto). Este ficheiro apanha-o no portátil, e
// confere que o passo do CI passou a verificar mesmo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const PASTA = path.join(RAIZ, 'migrations');
const ci = readFileSync(path.join(RAIZ, '.github/workflows/testes.yml'), 'utf8').replace(/\r\n/g, '\n');

/* O que está mal na numeração de um conjunto de ficheiros de migração. A
   mesma regra que o passo do CI: o número é o que vem antes do primeiro «_»,
   com quatro algarismos, e a lista tem de ser 0001, 0002, … até ao maior.
   Recebe: nomes — os nomes dos ficheiros .sql, sem pasta, por qualquer ordem.
   Devolve: lista de frases, uma por problema; vazia quando está tudo certo. */
function problemasDaNumeracao(nomes) {
  const mal = [];
  const vistos = new Set();
  for (const n of [...nomes].sort()) {
    const m = /^(\d{4})_[^/\\]+\.sql$/.exec(n);
    if (!m) { mal.push('fora da forma NNNN_nome.sql: ' + n); continue; }
    const x = Number(m[1]);
    if (vistos.has(x)) mal.push('repetido: ' + m[1]);
    vistos.add(x);
  }
  const maior = Math.max(0, ...vistos);
  for (let i = 1; i <= maior; i++) if (!vistos.has(i)) mal.push('falta: ' + String(i).padStart(4, '0'));
  return mal;
}

// Devolve: os nomes dos .sql de migrations/, pela ordem do disco.
const ficheirosDaPasta = () => readdirSync(PASTA).filter((n) => n.endsWith('.sql'));

describe('as migrações da base', () => {
  // achado A.7-3
  test('estão numeradas de 0001 em diante, sem repetidos nem saltos, e nenhuma está vazia', () => {
    const nomes = ficheirosDaPasta();
    assert.ok(nomes.length >= 15, 'leu ' + nomes.length + ' migrações — a pasta mudou de sítio?');
    assert.deepEqual(problemasDaNumeracao(nomes), [],
      'dois ramos com o mesmo número, ou um número saltado: o wrangler aplica-as pela ordem do nome');
    const vazias = nomes.filter((n) => statSync(path.join(PASTA, n)).size === 0);
    assert.deepEqual(vazias, [], 'uma migração vazia não muda nada e gasta o número');
  });

  /* A regra tem de apanhar o caso que o `sort -c` deixava passar, e aceitar
     as que vêm a seguir quando estão em sequência (a 0016 e a 0017 desta vaga). */
  test('a regra apanha um número repetido e um salto, e aceita as seguintes em sequência', () => {
    const ate14 = Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(4, '0') + '_m.sql');
    const mas = problemasDaNumeracao(ate14.concat(['0015_a.sql', '0015_b.sql', '0017_c.sql']));
    assert.ok(mas.includes('repetido: 0015'), 'o repetido: ' + mas.join('; '));
    assert.ok(mas.includes('falta: 0016'), 'e o salto: ' + mas.join('; '));
    assert.deepEqual(problemasDaNumeracao(ate14.concat(['0015_s.sql', '0016_correcoes.sql', '0017_operacao.sql'])), []);
    assert.deepEqual(problemasDaNumeracao(['0001_a.sql', 'notas.sql']), ['fora da forma NNNN_nome.sql: notas.sql']);
  });

  test('o passo do CI compara com a sequência que devia ser, e não só com a ordem', () => {
    const i = ci.indexOf('- name: Validar as migrações da base de dados');
    assert.ok(i > -1, 'o passo existe');
    // só o código: o comentário do passo explica o sort -c que lá estava
    const passo = ci.slice(i).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    assert.doesNotMatch(passo, /sort -c/,
      'o sort -c sobre a saída do ls passa sempre: o ls já a devolve ordenada');
    assert.match(passo, /seq -f %04g 1/, 'gera 0001…N e compara');
    assert.match(passo, /test -s "\$f"/, 'e continua a recusar uma migração vazia');
  });
});

/* O próprio passo do CI, corrido sobre pastas de faz-de-conta. Precisa de um
   bash POSIX com o seq do GNU: no runner do CI há; num Windows o «bash» do
   PATH costuma ser o do WSL, que corre noutra máquina de ficheiros — lá, a
   regra fica provada pelos testes de cima. */
describe('o passo do CI, a correr', () => {
  // Devolve: o texto do bloco run: do passo das migrações, sem a indentação do YAML.
  const script = () => {
    const i = ci.indexOf('- name: Validar as migrações da base de dados');
    const linhas = ci.slice(i).split('\n');
    const r = linhas.findIndex((l) => /^\s+run: \|$/.test(l));
    const corpo = [];
    for (const l of linhas.slice(r + 1)) {
      if (l.trim() && !l.startsWith('          ')) break;
      corpo.push(l.slice(10));
    }
    return corpo.join('\n');
  };
  // Recebe: nomes — os ficheiros a pôr numa pasta migrations/ nova.
  // Devolve: o código de saída do passo do CI corrido nessa pasta.
  const correrCom = (nomes) => {
    const d = mkdtempSync(path.join(tmpdir(), 'migracoes-'));
    try {
      mkdirSync(path.join(d, 'migrations'));
      for (const n of nomes) writeFileSync(path.join(d, 'migrations', n), 'select 1;\n');
      return spawnSync('bash', ['-e', '-c', script()], { cwd: d, encoding: 'utf8' }).status;
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  };
  const semBash = process.platform === 'win32' ? 'o bash do Windows é o do WSL; a regra prova-se acima' : false;

  test('falha com um repetido e com um salto, e passa com a sequência certa', { skip: semBash }, () => {
    assert.equal(correrCom(['0001_a.sql', '0002_b.sql', '0003_c.sql']), 0, 'a sequência certa passa');
    assert.notEqual(correrCom(['0001_a.sql', '0001_b.sql', '0002_c.sql']), 0, 'um repetido falha');
    assert.notEqual(correrCom(['0001_a.sql', '0003_c.sql']), 0, 'um salto falha');
    assert.equal(correrCom(ficheirosDaPasta()), 0, 'e as migrações do repositório passam');
  });
});
