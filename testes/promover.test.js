// O promove só do que está em Staging (scripts/promover.mjs, KAN-156): o
// plano separa os commits do dev pelos cartões que citam (a levar, a deixar,
// mistos, sem cartão, só em Produção, de cartões fora do quadro), o ramo faz
// o cherry-pick -x num worktree e pára no primeiro conflito sem o resolver (o
// web/versao.json, que se gera, é a exceção), e o fechar leva a Produção os
// cartões de Staging cujos commits chegaram à etiqueta publicado. E o
// scripts/ticket.mjs publicado a reconhecer um commit do dev que chegou à
// produção por cherry-pick (com o trailer do -x, ou só pelo patch).
// Tudo num repositório git temporário, com um origin nu ao lado: o
// repositório verdadeiro nunca se toca.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  principal, lerArgumentos, chavesDaMensagem, categoriaDoCommit, planoDoPromove, versaoDoAvisos, confereVersoes, copiadosDe, commitsDoLog,
  ErroPromover, hojeEmLisboa,
} from '../scripts/promover.mjs';
import { publicadoProd } from '../scripts/ticket.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/promover.mjs', import.meta.url));
const VERSAO_JS = readFileSync(new URL('../scripts/versao.js', import.meta.url), 'utf8');
const HOJE = '2026-11-24';

/* ------------------------- o repositório de brincar ---------------------- */

// Recebe: cwd — a pasta; args — os argumentos do git.
// Devolve: o stdout aparado; lança se o git falhar.
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: Object.assign({}, process.env, { GIT_EDITOR: 'true', GIT_TERMINAL_PROMPT: '0' }) });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + r.stderr);
  return r.stdout.trim();
}

// Recebe: entradas — [{v, titulo, data}] do mais recente para o mais antigo; minima.
// Devolve: o texto de um web/avisos.js pequeno, na forma do verdadeiro (cada entrada em várias linhas).
function avisos(entradas, minima) {
  return 'var AVISOS = [\n' + entradas.map((e) => '  {\n    v: ' + e.v + ',\n    titulo: \'' + e.titulo + '\',\n    itens: [\'um\', \'dois\', \'três\'],\n    data: \'' + e.data + '\',\n  },\n').join('')
    + '];\nvar VERSAO = AVISOS[0].v;\nvar VERSAO_MINIMA = ' + minima + ';\n\nif (typeof module !== \'undefined\' && module.exports) {\n'
    + '  module.exports = { AVISOS: AVISOS, VERSAO: VERSAO, VERSAO_MINIMA: VERSAO_MINIMA };\n}\n';
}

// Recebe: cwd; ficheiros — {caminho: texto}; mensagem.
// Devolve: o sha do commit novo.
function commit(cwd, ficheiros, mensagem) {
  Object.entries(ficheiros).forEach(([f, t]) => {
    mkdirSync(path.dirname(path.join(cwd, f)), { recursive: true });
    writeFileSync(path.join(cwd, f), t);
  });
  if (Object.keys(ficheiros).some((f) => f === 'web/avisos.js')) {
    const r = spawnSync(process.execPath, ['scripts/versao.js'], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', mensagem);
  return git(cwd, 'rev-parse', 'HEAD');
}

const V3 = { v: 3, titulo: 'Três', data: '2026-11-01' };
const V4 = { v: 4, titulo: 'Quatro', data: '2026-11-20' };

// Recebe: nada.
// Devolve: { base, work, sha: {d1…d9} } — um origin nu e um clone com o main (a base) e o dev com nove commits:
// d1 KAN-1 (a.txt), d2 KAN-2 (b.txt), d3 sem cartão, d4 KAN-1 e KAN-3, d5 KAN-4 (muda o b.txt do d2),
// d6 KAN-5 (a versão 4), d7 «KAN-10 a KAN-12», d8 KAN-20 (em Produção), d9 KAN-99 (fora do quadro).
function repositorio() {
  const base = mkdtempSync(path.join(os.tmpdir(), 'promover-'));
  const origin = path.join(base, 'origin.git');
  const work = path.join(base, 'work');
  git(base, 'init', '-q', '--bare', origin);
  git(base, 'init', '-q', '-b', 'main', work);
  [['user.name', 'Teste'], ['user.email', 'teste@exemplo.pt'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false'], ['tag.gpgsign', 'false']]
    .forEach(([k, v]) => git(work, 'config', k, v));
  git(work, 'remote', 'add', 'origin', origin);
  commit(work, { 'scripts/versao.js': VERSAO_JS, 'web/avisos.js': avisos([V3], 2), 'leia.md': 'Base\n' }, 'Base');
  git(work, 'push', '-q', 'origin', 'main');
  git(work, 'checkout', '-q', '-b', 'dev');
  const sha = {};
  sha.d1 = commit(work, { 'a.txt': 'a1\n' }, 'A nova (KAN-1)');
  sha.d2 = commit(work, { 'b.txt': 'b1\n' }, 'B nova (KAN-2)');
  sha.d3 = commit(work, { 'docs.md': 'só texto\n' }, 'Só documentação');
  sha.d4 = commit(work, { 'c.txt': 'c1\n' }, 'Mistura\n\nCorpo com KAN-1 e KAN-3.');
  sha.d5 = commit(work, { 'b.txt': 'b1\nb2\n' }, 'B muda (KAN-4)');
  sha.d6 = commit(work, { 'web/avisos.js': avisos([V4, V3], 2) }, 'Versão 4 (KAN-5, v4)');
  sha.d7 = commit(work, { 'e.txt': 'e\n' }, 'Os três (KAN-10 a KAN-12)');
  sha.d8 = commit(work, { 'f.txt': 'f\n' }, 'Antigo (KAN-20)');
  sha.d9 = commit(work, { 'g.txt': 'g\n' }, 'Chave errada (KAN-99)');
  git(work, 'push', '-q', 'origin', 'dev');
  git(work, 'checkout', '-q', 'main');
  return { base, work, sha };
}

const COLUNAS = [['a-fazer', 'A fazer', 1, false], ['auto-tests', 'Auto Tests', 2, false], ['human-tests', 'Human Tests', 3, false],
  ['staging', 'Staging', 4, true], ['adiado', 'Adiado', 5, true], ['concluido', 'Produção', 6, true], ['para-depois', 'Para depois', 7, false]]
  .map(([id, nome, ordem, fim]) => ({ id, nome, ordem, fim, fixa: true, total: 0 }));

// Recebe: colunaDe — {N: coluna}.
// Devolve: o quadro na forma de kanban.mjs:lerQuadro.
function quadroCom(colunaDe) {
  return {
    colunas: COLUNAS,
    cartoes: Object.entries(colunaDe).map(([n, coluna]) => ({ chave: 'KAN-' + n, numero: Number(n), coluna_id: coluna, titulo: 'Cartão ' + n, origem: null })),
  };
}
const QUADRO = { 1: 'staging', 2: 'adiado', 3: 'human-tests', 4: 'staging', 5: 'staging', 10: 'staging', 11: 'staging', 12: 'staging', 20: 'concluido', 30: 'staging' };

// Recebe: r — o repositório; argv; colunaDe (opcional); extra (opcional) — dependências a juntar.
// Devolve: { codigo, out, err, movidos } do principal, com o quadro e o mover de brincar.
function corre(r, argv, colunaDe = QUADRO, extra = {}) {
  let out = '', err = '';
  const movidos = [];
  const deps = Object.assign({
    raiz: r.work, quadro: () => quadroCom(colunaDe), hoje: () => HOJE, tmp: () => path.join(r.base, 'wt'),
    mover: (chave, coluna, local) => { movidos.push([chave, coluna, !!local]); return { codigo: 0, out: '', err: '' }; },
  }, extra);
  const codigo = principal(argv, deps, { out: (t) => { out += t; }, err: (t) => { err += t; } });
  return { codigo, out, err, movidos };
}

const c7 = (s) => s.slice(0, 7);

/* ------------------------- sem git -------------------------------------- */

describe('o promover sem git: argumentos, chaves e categorias', () => {
  test('os argumentos: recusa o que não conhece, os shas maus, o mesmo sha nos dois lados e um --nome fora de promover/', () => {
    const r = lerArgumentos(['ramo', '--levar', 'ABC1234,def5678', '--deixar=1234567', '--nome', 'promover/2026-11-24-2']);
    assert.deepEqual([r.levar, r.deixar, r.nome], [['abc1234', 'def5678'], ['1234567'], 'promover/2026-11-24-2']);
    for (const [argv, re] of [
      [[], /Falta o comando/], [['promove'], /Não conheço o comando/], [['plano', '--loca'], /não aceita a opção --loca/],
      [['ramo', '--levar', 'xyz'], /não são shas/], [['ramo', '--levar', 'abc1234', '--deixar', 'abc1234ff'], /não pode ir em --levar e em --deixar/],
      [['ramo', '--nome', 'main'], /promover\/<algo>/], [['ramo', '--nome', 'promover/../main'], /promover\/<algo>/], [['fechar', 'KAN-1'], /Não sei o que fazer/],
    ]) {
      assert.throws(() => lerArgumentos(argv), (e) => e instanceof ErroPromover && e.codigo === 2 && re.test(e.message), JSON.stringify(argv));
    }
  });

  test('a linha de comandos: um argumento mau sai com 2 e o uso, sem chamar o git', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'ramo', '--levar', 'nao-e-sha'], { encoding: 'utf8', env: Object.assign({}, process.env, { PROMOVER_VERBOSO: '1' }) });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^promover: No --levar, não são shas/);
    assert.match(r.stderr, /node scripts\/promover\.mjs plano \[--json\] \[--local\]/);
    assert.doesNotMatch(r.stderr, /\[promover\] git/);
  });

  test('as chaves da mensagem: soltas, intervalos («a», «..», «até», «–») e nada de falsos', () => {
    assert.deepEqual(chavesDaMensagem('Ronda 2 (KAN-150 a KAN-154, KAN-147, KAN-148, v82)'), [147, 148, 150, 151, 152, 153, 154]);
    assert.deepEqual(chavesDaMensagem('cartões KAN-145..154'), [145, 146, 147, 148, 149, 150, 151, 152, 153, 154]);
    assert.deepEqual(chavesDaMensagem('KAN-3 até 5 e kan-9'), [3, 4, 5, 9]);
    assert.deepEqual(chavesDaMensagem('KAN-7–8'), [7, 8]);
    assert.deepEqual(chavesDaMensagem('KAN-129, v80; KAN-12 a nova; XKAN-5; KAN-1 a KAN-900'), [1, 12, 129, 900], 'um intervalo grande demais não abre');
    assert.deepEqual(chavesDaMensagem('Sem cartão nenhum'), []);
  });

  test('a categoria de um commit pelas colunas dos cartões', () => {
    const q = new Map([[1, { coluna_id: 'staging' }], [2, { coluna_id: 'adiado' }], [3, { coluna_id: 'concluido' }], [4, { coluna_id: 'human-tests' }]]);
    const cat = (ns) => categoriaDoCommit(ns, q).categoria;
    assert.deepEqual([cat([1]), cat([1, 3]), cat([2]), cat([2, 3]), cat([1, 2]), cat([1, 9]), cat([]), cat([3]), cat([9]), cat([4, 9])],
      ['levar', 'levar', 'deixar', 'deixar', 'misto', 'misto', 'sem-cartao', 'producao', 'desconhecido', 'deixar']);
  });

  test('o plano sem git: as decisões mandam sobre a categoria, o avisos.js e as migrações nos riscos, e a coluna Staging que ainda não existe', () => {
    const sha = (c) => c.repeat(40);
    const commits = [
      { sha: sha('a'), assunto: 'Versão 9 (KAN-2)', mensagem: 'Versão 9 (KAN-2)', ficheiros: ['web/avisos.js', 'web/versao.json', 'migrations/0040_x.sql'] },
      { sha: sha('b'), assunto: 'Versão 10 (KAN-1)', mensagem: 'Versão 10 (KAN-1)', ficheiros: ['web/avisos.js', 'web/versao.json', 'migrations/0041_y.sql'] },
      { sha: sha('c'), assunto: 'Docs', mensagem: 'Docs', ficheiros: ['docs/x.md'] },
    ];
    const quadro = quadroCom({ 1: 'staging', 2: 'adiado' });
    const p = planoDoPromove(commits, quadro, { levar: ['ccccccc'] });
    assert.deepEqual(p.levar.map((c) => c.sha[0]), ['b', 'c']);
    assert.deepEqual([p.deixar.map((c) => c.sha[0]), p.perguntas.length], [['a'], 0]);
    assert.ok(p.commits.find((c) => c.sha[0] === 'c').decidido);
    assert.match(p.riscos.join('\n'), /bbbbbbb vai e aaaaaaa fica antes dele, e os dois mexem no web\/avisos\.js/);
    assert.match(p.riscos.join('\n'), /A migração migrations\/0040_x\.sql \(aaaaaaa\) fica e a migrations\/0041_y\.sql vai/);
    assert.doesNotMatch(p.riscos.join('\n'), /versao\.json/, 'o versao.json gera-se: não é risco');
    const forca = planoDoPromove(commits, quadro, { deixar: ['bbbbbbb'], levar: ['ccccccc'] });
    assert.deepEqual(forca.levar.map((c) => c.sha[0]), ['c']);
    const semStaging = planoDoPromove(commits, { colunas: COLUNAS.filter((c) => c.id !== 'staging'), cartoes: [] });
    assert.equal(semStaging.semStaging, true);
    assert.deepEqual(semStaging.perguntas.map((c) => c.categoria), ['desconhecido', 'desconhecido', 'sem-cartao']);
  });

  test('a versão do avisos.js lê-se num contexto à parte; a mínima nunca acima da versão; a versão não desce', () => {
    assert.deepEqual(versaoDoAvisos(avisos([V4, V3], 3)), { versao: 4, minima: 3 });
    assert.equal(versaoDoAvisos('isto não é javascript ('), null);
    assert.deepEqual(confereVersoes({ main: { versao: 3, minima: 2 }, dev: { versao: 5, minima: 2 }, ramo: { versao: 4, minima: 2 } }, true), { erros: [], avisos: [] });
    assert.match(confereVersoes({ main: { versao: 3, minima: 2 }, ramo: { versao: 4, minima: 5 } }, true).erros[0], /passa da versão/);
    assert.match(confereVersoes({ main: { versao: 5, minima: 2 }, ramo: { versao: 4, minima: 2 } }, true).erros[0], /A versão desce/);
    assert.match(confereVersoes({ main: { versao: 4, minima: 2 }, ramo: { versao: 4, minima: 2 } }, true).avisos[0], /não sobe/);
    assert.match(confereVersoes({ main: { versao: 3, minima: 2 }, dev: { versao: 4, minima: 3 }, ramo: { versao: 4, minima: 3 } }, false).avisos[0], /sobe de 2 para 3/);
  });

  test('os cherry-picks do main pelo trailer do -x, e o log com os ficheiros', () => {
    const a = 'a'.repeat(40), b = 'b'.repeat(40);
    assert.deepEqual([...copiadosDe('X\n\n(cherry picked from commit ' + a + ')\n\nY\n(cherry picked from commit ' + b.toUpperCase() + ')')], [a, b]);
    const log = '\x1e' + a + '\x1f\x1fAssunto (KAN-1)\n\nCorpo\x1f\n\na.txt\nweb/avisos.js\n\x1e' + b + '\x1f' + a + '\x1fOutro\x1f\n';
    assert.deepEqual(commitsDoLog(log).map((c) => [c.sha, c.assunto, c.ficheiros]), [[a, 'Assunto (KAN-1)', ['a.txt', 'web/avisos.js']], [b, 'Outro', []]]);
    assert.match(hojeEmLisboa(new Date('2026-11-24T23:30:00Z')), /^2026-11-24$/);
  });
});

/* ------------------------- com git -------------------------------------- */

describe('o promover num repositório de brincar', () => {
  let r;
  before(() => { r = repositorio(); });
  after(() => {
    try { git(r.work, 'worktree', 'prune'); } catch (e) { /* já limpo */ }
    rmSync(r.base, { recursive: true, force: true });
  });

  test('plano: a levar, a deixar, as perguntas (misto, sem cartão, só em Produção, fora do quadro), os riscos e os de Staging sem commits', () => {
    const p = corre(r, ['plano']);
    assert.equal(p.codigo, 0, p.err);
    const s = r.sha;
    assert.match(p.out, /^Promove: 9 commits do origin\/dev \(\w{7}\) que faltam no origin\/main/);
    const seccao = (t) => p.out.split('## ' + t)[1].split('\n## ')[0];
    for (const x of ['d1', 'd5', 'd6', 'd7']) assert.match(seccao('A levar (4)'), new RegExp(c7(s[x])), x);
    assert.match(seccao('A deixar no dev (1)'), new RegExp(c7(s.d2) + ' B nova \\(KAN-2\\) \\[KAN-2 em Adiado\\]'));
    const perguntas = seccao('Por perguntar ao Martinho (4)');
    assert.match(perguntas, new RegExp('misto \\(1\\):\\n {4}' + c7(s.d4) + ' Mistura \\[KAN-1 em Staging; KAN-3 em Human Tests\\]'));
    assert.match(perguntas, new RegExp('sem cartão \\(1\\):\\n {4}' + c7(s.d3) + ' Só documentação \\[sem KAN-N\\]'));
    assert.match(perguntas, new RegExp('só em Produção \\(1\\):\\n {4}' + c7(s.d8) + ' Antigo \\(KAN-20\\) \\[KAN-20 em Produção\\]'));
    assert.match(perguntas, new RegExp('cartão que não está no quadro \\(1\\):\\n {4}' + c7(s.d9) + '.+\\[KAN-99 fora do quadro\\]'));
    assert.match(p.out, new RegExp(c7(s.d5) + ' vai e ' + c7(s.d2) + ' fica antes dele, e os dois mexem em b\\.txt: pode depender dele\\.'));
    assert.match(p.out, /## Em Staging sem commits no dev por levar \(1\)\n {2}KAN-30 — Cartão 30/);
    assert.match(p.out, /BLOQUEIA: 4 commits por decidir/);
    const j = JSON.parse(corre(r, ['plano', '--json']).out);
    assert.deepEqual([j.levar.length, j.deixar.length, j.perguntas.map((c) => c.categoria).sort(), j.bloqueia], [4, 1, ['desconhecido', 'misto', 'producao', 'sem-cartao'], true]);
    assert.deepEqual(j.levar.find((c) => c.sha === s.d7).chaves, ['KAN-10', 'KAN-11', 'KAN-12']);
  });

  test('ramo: recusa enquanto houver perguntas, e não cria nada', () => {
    const x = corre(r, ['ramo']);
    assert.equal(x.codigo, 1);
    assert.match(x.err, /^promover: Não criei o ramo: há 4 commits por decidir\./);
    assert.equal(git(r.work, 'branch', '--list', 'promover/*'), '');
    assert.match(corre(r, ['ramo', '--levar', 'abcdef1']).err, /não são de nenhum commit por levar \(vê o plano\): abcdef1\./);
  });

  test('ramo: pára no primeiro conflito sem o resolver (o d5 precisa do d2, que fica), com o -x no que aplicou', () => {
    const s = r.sha;
    const x = corre(r, ['ramo', '--deixar', [s.d3, s.d4, s.d8, s.d9].map(c7).join(','), '--nome', 'promover/conflito']);
    assert.equal(x.codigo, 1, x.out + x.err);
    assert.match(x.err, new RegExp('PAROU no ' + c7(s.d5) + ' «B muda \\(KAN-4\\)»: o cherry-pick dá conflito em b\\.txt\\. Não resolvi nada'));
    assert.match(x.err, new RegExp('Mexem nesses ficheiros e ficam no dev: ' + c7(s.d2) + ' «B nova \\(KAN-2\\)» \\(KAN-2\\)'));
    const pasta = path.join(r.base, 'wt', 'promover-conflito');
    assert.equal(git(pasta, 'rev-list', '--count', 'origin/main..HEAD'), '1', 'só o d1');
    assert.match(git(pasta, 'log', '-1', '--format=%B'), new RegExp('\\(cherry picked from commit ' + s.d1 + '\\)'));
    assert.equal(git(pasta, 'status', '--porcelain'), '', 'sem conflito deixado a meio');
    assert.ok(!existsSync(path.join(r.work, '.git', 'worktrees', 'promover-conflito', 'CHERRY_PICK_HEAD')));
    assert.equal(git(r.work, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main', 'a cópia de trabalho não se mexeu');
    git(r.work, 'worktree', 'remove', '--force', pasta);
    git(r.work, 'branch', '-D', 'promover/conflito');
  });

  test('ramo: com o KAN-2 em Staging, tudo aplica, pela ordem do dev, com o trailer, a versão 4 e o versao.json conferido', () => {
    const s = r.sha;
    const q = Object.assign({}, QUADRO, { 2: 'staging' });
    const x = corre(r, ['ramo', '--deixar', [s.d3, s.d4, s.d8, s.d9].map(c7).join(',')], q);
    assert.equal(x.codigo, 0, x.err);
    assert.match(x.out, /^Ramo promover\/2026-11-24 a partir do origin\/main/);
    assert.match(x.out, /Versão: main 3 \(mínima 2\) → ramo 4 \(mínima 2\); o dev está na 4 \(mínima 2\)\./);
    assert.match(x.out, /git -C ".+" push -u origin promover\/2026-11-24/);
    assert.doesNotMatch(x.out, /Risco do plano/);
    const pasta = path.join(r.base, 'wt', 'promover-2026-11-24');
    const msgs = git(pasta, 'log', '--reverse', '--format=%s%x1f%b%x1e', 'origin/main..HEAD').split('\x1e').map((m) => m.trim()).filter(Boolean);
    assert.deepEqual(msgs.map((m) => m.split('\x1f')[0]), ['A nova (KAN-1)', 'B nova (KAN-2)', 'B muda (KAN-4)', 'Versão 4 (KAN-5, v4)', 'Os três (KAN-10 a KAN-12)']);
    ['d1', 'd2', 'd5', 'd6', 'd7'].forEach((k, i) => assert.match(msgs[i], new RegExp('cherry picked from commit ' + s[k]), k));
    assert.deepEqual(JSON.parse(readFileSync(path.join(pasta, 'web/versao.json'), 'utf8')), { versao: 4, minima: 2, data: '2026-11-20' });
    assert.ok(!existsSync(path.join(pasta, 'c.txt')) && !existsSync(path.join(pasta, 'docs.md')), 'o que fica não vai');
    assert.equal(git(r.work, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
    const outra = corre(r, ['ramo', '--deixar', [s.d3, s.d4, s.d8, s.d9].map(c7).join(',')], q);
    assert.match(outra.err, /O ramo promover\/2026-11-24 já existe: dá outro com --nome/);
  });

  test('fechar: depois do merge e da etiqueta publicado, os de Staging com os commits em produção (por cópia) vão a Produção; os outros ficam e diz-se o que falta', () => {
    const s = r.sha;
    git(r.work, 'merge', '-q', '--no-ff', '-m', 'Promover 2026-11-24', 'promover/2026-11-24');
    git(r.work, 'push', '-q', 'origin', 'main');
    git(r.work, 'tag', '-f', 'publicado', 'main');
    git(r.work, 'push', '-q', '-f', 'origin', 'refs/tags/publicado');
    const q = Object.assign({}, QUADRO, { 2: 'staging' });
    const seco = corre(r, ['fechar', '--seco'], q);
    assert.equal(seco.codigo, 0, seco.err);
    assert.deepEqual(seco.movidos, []);
    assert.match(seco.out, /\(--seco: não mexi em nenhum cartão\.\)/);
    const f = corre(r, ['fechar'], q);
    assert.equal(f.codigo, 0, f.err);
    assert.deepEqual(f.movidos.map((m) => m[0]).sort(), ['KAN-10', 'KAN-11', 'KAN-12', 'KAN-2', 'KAN-30', 'KAN-4', 'KAN-5']);
    assert.ok(f.movidos.every((m) => m[1] === 'concluido' && m[2] === false));
    assert.match(f.out, new RegExp('KAN-1 fica em Staging: ainda não estão em produção ' + c7(s.d4) + ' «Mistura»'), 'o d4 ficou no dev e também é do KAN-1');
    assert.match(f.out, /KAN-30 → Produção — sem commits no dev\./);
    // o plano a seguir já não conta os que foram por cherry-pick
    const p = corre(r, ['plano'], q);
    assert.match(p.out, /^Promove: 4 commits do origin\/dev .+; 5 já lá estão por cherry-pick, e não contam/);
  });

  test('ticket.mjs publicado --prod: um commit do dev que chegou por cherry-pick -x (trailer) e um sem -x (o mesmo patch)', () => {
    const s = r.sha;
    const g = (args) => spawnSync('git', args, { cwd: r.work, encoding: 'utf8' });
    const p1 = publicadoProd(c7(s.d1), g);
    assert.equal(p1.publicado, true, p1.razao);
    assert.match(p1.razao, /chegou à produção por cherry-pick: \w{7}, com «\(cherry picked from commit/);
    assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', s.d1, 'publicado'], { cwd: r.work }).status, 1, 'o d1 do dev não é antepassado do main');
    const p4 = publicadoProd(c7(s.d4), g);
    assert.equal(p4.publicado, false);
    assert.match(p4.razao, /^ainda não está em produção/);
    // sem o -x: só o patch diz que é o mesmo
    git(r.work, 'cherry-pick', s.d9);
    git(r.work, 'push', '-q', 'origin', 'main');
    git(r.work, 'tag', '-f', 'publicado', 'main');
    git(r.work, 'push', '-q', '-f', 'origin', 'refs/tags/publicado');
    const p9 = publicadoProd(c7(s.d9), g);
    assert.equal(p9.publicado, true, p9.razao);
    assert.match(p9.razao, /por cherry-pick: o mesmo patch/);
  });
});

describe('o conflito que se resolve sozinho: só o web/versao.json', () => {
  test('o main mudou a data da versão 3 e o dev subiu a 4: o avisos.js junta-se, o versao.json gera-se, e o ramo fica pronto', () => {
    const r = repositorio();
    try {
      // no main, uma correção que muda a data da versão 3 (o versao.json muda com ela)
      commit(r.work, { 'web/avisos.js': avisos([Object.assign({}, V3, { data: '2026-11-02' })], 2) }, 'Correção da data');
      git(r.work, 'push', '-q', 'origin', 'main');
      const s = r.sha;
      const q = Object.assign({}, QUADRO, { 1: 'adiado', 4: 'adiado', 10: 'adiado', 11: 'adiado', 12: 'adiado' });
      const x = corre(r, ['ramo', '--deixar', [s.d3, s.d4, s.d8, s.d9].map(c7).join(',')], q);
      assert.equal(x.codigo, 0, x.err);
      assert.match(x.out, new RegExp(c7(s.d6) + ' → \\w{7} \\(o web/versao\\.json gerado do web/avisos\\.js\\) «Versão 4'));
      const pasta = path.join(r.base, 'wt', 'promover-2026-11-24');
      assert.deepEqual(JSON.parse(readFileSync(path.join(pasta, 'web/versao.json'), 'utf8')), { versao: 4, minima: 2, data: '2026-11-20' });
      assert.match(readFileSync(path.join(pasta, 'web/avisos.js'), 'utf8'), /v: 4,[\s\S]*v: 3,[\s\S]*data: '2026-11-02'/, 'as duas mudanças do avisos.js ficam');
      assert.match(git(pasta, 'log', '-1', '--format=%B'), new RegExp('cherry picked from commit ' + s.d6));
    } finally {
      try { git(r.work, 'worktree', 'prune'); } catch (e) { /* já limpo */ }
      rmSync(r.base, { recursive: true, force: true });
    }
  });

  test('o web/avisos.js em conflito não se resolve sozinho: pára e diz porquê', () => {
    const r = repositorio();
    try {
      // no main, uma versão 4 diferente: o avisos.js do dev não junta
      commit(r.work, { 'web/avisos.js': avisos([{ v: 4, titulo: 'Outra quatro', data: '2026-11-03' }, V3], 2) }, 'Hotfix 4');
      git(r.work, 'push', '-q', 'origin', 'main');
      const s = r.sha;
      const q = Object.assign({}, QUADRO, { 1: 'adiado', 4: 'adiado', 10: 'adiado', 11: 'adiado', 12: 'adiado' });
      const x = corre(r, ['ramo', '--deixar', [s.d3, s.d4, s.d8, s.d9].map(c7).join(',')], q);
      assert.equal(x.codigo, 1);
      assert.match(x.err, new RegExp('PAROU no ' + c7(s.d6) + ' .+conflito em web/avisos\\.js'));
      assert.equal(git(path.join(r.base, 'wt', 'promover-2026-11-24'), 'status', '--porcelain'), '');
    } finally {
      try { git(r.work, 'worktree', 'prune'); } catch (e) { /* já limpo */ }
      rmSync(r.base, { recursive: true, force: true });
    }
  });
});
