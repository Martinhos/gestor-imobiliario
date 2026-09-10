// Quatro olhos sobre o código: o que o CI passa a verificar por conta própria.
//
// Os ciclos de importação no worker, e os dois binários que varrem segredos e
// os workflows. Nada disto veio de uma ferramenta a correr em cada push — os
// ciclos leem-se do código, e os binários entram fixados ao byte.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = new URL('../', import.meta.url);
const ler = (p) => readFileSync(new URL(p, RAIZ), 'utf8');

/* Um ciclo de importação em módulos ES pode dar zona morta temporal em
   runtime, e num Worker isso aparece como um 500 sem explicação nenhuma.
   Havia dois quando isto entrou (medidos com madge --circular):
   discord.js → equipa.js → equipa-vista.js → discord.js, e
   notify.js → discord.js → notify.js. Resolvidos ao tirar de discord.js o
   que era lido de mais do que um lado — o bloco dos papéis e o envio pelo
   bot — para lib/. Fica aqui para não voltarem, sem download nenhum. */
describe('as importações do worker', () => {
  // fileURLToPath e não .pathname: o caminho tem espaços, e o pathname vem com %20
  const base = fileURLToPath(new URL('worker/src/', RAIZ));
  const ficheiros = [];
  (function varre(dir, rel) {
    for (const nome of readdirSync(dir)) {
      const cheio = join(dir, nome);
      if (statSync(cheio).isDirectory()) varre(cheio, rel + nome + '/');
      else if (nome.endsWith('.js')) ficheiros.push(rel + nome);
    }
  })(base, '');

  // Recebe: rel — o caminho de um módulo, relativo a worker/src/.
  // Devolve: lista dos módulos que ele importa, estáticos e dinâmicos, no mesmo formato.
  const importaDe = (rel) => {
    const src = ler('worker/src/' + rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const alvos = [];
    const re = /(?:from\s*|import\s*\()\s*'(\.\.?\/[^']+)'/g;
    let m;
    while ((m = re.exec(src))) {
      const partes = (rel.split('/').slice(0, -1).join('/') + '/' + m[1]).split('/');
      const pilha = [];
      for (const p of partes) {
        if (p === '..') pilha.pop();
        else if (p !== '.' && p !== '') pilha.push(p);
      }
      alvos.push(pilha.join('/'));
    }
    return alvos;
  };

  test('não há ciclos, nem por importação dinâmica', () => {
    const grafo = new Map(ficheiros.map((f) => [f, importaDe(f)]));
    const ciclos = [];
    const estado = new Map();   // 1 = em curso, 2 = fechado
    const desce = (no, caminho) => {
      if (estado.get(no) === 2) return;
      if (estado.get(no) === 1) { ciclos.push(caminho.slice(caminho.indexOf(no)).concat(no).join(' → ')); return; }
      estado.set(no, 1);
      for (const alvo of grafo.get(no) || []) desce(alvo, caminho.concat(no));
      estado.set(no, 2);
    };
    for (const f of ficheiros) desce(f, []);
    assert.deepEqual(ciclos, [], 'ciclos de importação em worker/src');
    assert.ok(ficheiros.length > 25 && ficheiros.includes('discord.js'), 'leu o worker inteiro: ' + ficheiros.length);
  });

  test('os papéis e o envio pelo bot saíram do bot, e ele continua a exportá-los', () => {
    assert.match(ler('worker/src/lib/papeis.js'), /export const PERMISSOES = \{/);
    assert.match(ler('worker/src/lib/bot.js'), /export async function postAsBot/);
    const bot = ler('worker/src/discord.js');
    assert.doesNotMatch(bot, /^export const PERMISSOES/m, 'a tabela não está duplicada no bot');
    assert.match(bot, /export \{[^}]*PERMISSOES[^}]*\} from '\.\/lib\/papeis\.js'/, 'mas sai por ele, para quem já o importava');
    assert.match(ler('scripts/gerar-docs.js'), /ler\('worker\/src\/lib\/papeis\.js'\)/, 'e o gerador de docs lê-a de onde ela está');
  });
});

/* O secret scanning do GitHub está fechado em repositório privado, e os
   workflows são quase todos bash escrito dentro de YAML — um erro aí só
   aparece a meio de um deploy. Os dois binários entram fixados à versão e ao
   byte: uma versão que mude sem ninguém dar por isso, ou um ficheiro que não
   bata certo com o checksum, não corre. */
describe('os binários do CI', () => {
  const ci = ler('.github/workflows/testes.yml');

  const pinado = (nome) => {
    const versao = new RegExp(nome.toUpperCase() + '_VERSAO=([0-9.]+)').exec(ci);
    const soma = new RegExp(nome.toUpperCase() + '_SHA256=([0-9a-f]{64})').exec(ci);
    assert.ok(versao, nome + ' tem a versão fixa');
    assert.ok(soma, nome + ' tem o sha256 fixo');
    assert.match(ci, new RegExp('sha256sum -c'), 'e o ficheiro é conferido antes de correr');
    return versao[1];
  };

  test('o gitleaks está fixado e corre sobre a árvore', () => {
    pinado('gitleaks');
    assert.match(ci, /gitleaks dir \./, 'o «detect --no-git» ficou depreciado na 8.19');
  });

  test('o actionlint está fixado e corre sobre os workflows', () => {
    pinado('actionlint');
    assert.match(ci, /actionlint -color/);
  });
});
