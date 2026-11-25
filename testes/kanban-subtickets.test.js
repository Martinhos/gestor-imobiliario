// Os subtickets do kanban (KAN-162) e o «O que testar» em lista numerada
// (KAN-159). Prova: a chave KAN-N-X (lib/kanban.js: chaveDe, numeroDaChave,
// numeroDoSubticket); os passos partidos pela mesma regra na pílula
// (web/cloud/qa.js:qaPassosDoTexto, cópia letra a letra) e no back office
// (worker/src/equipa-kanban.js:kbPassosDoTexto, outra cópia), com a
// lista numerada na resolução, na descrição e nos comentários dos dois; o
// scripts/kanban.mjs a criar os subtickets (resolver com --teste, partir), a
// recusar o comecar de um subticket e a repô-los ao resolver de novo; o pai a
// seguir os filhos pelo script e pelas rotas do kanban e da pílula (Staging,
// Adiado, A fazer, com o histórico e o rasto dos Subtickets); e o promove a
// contar os subtickets pelo commit do pai.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { baseDeTeste } from './lib/bd.js';
import { ambiente } from './lib/api.js';
import { chamar, corpoDe, MASTER } from './lib/equipa.js';
import { caixa } from './lib/kanban-caixa.js';
import { carregarTudo, repor } from './arnes.js';
import {
  chaveDe, numeroDaChave, numeroDoSubticket, numeroDoPai, passosDoTexto, passosDoPaiSegue, SUBTICKETS,
} from '../worker/src/lib/kanban.js';
import {
  principal, confereLeitura, confereAlvo, textoDoFicheiro, erroDoWrangler, mensagemPorMigrar, ErroKanban, lerQuadro, lerArgumentos, resolucaoPartida,
} from '../scripts/kanban.mjs';
import { planoDoPromove, chavesDaMensagem } from '../scripts/promover.mjs';

const app = carregarTudo();
afterEach(() => repor(app));

/* ------------------------------- armações ------------------------------- */

let relogio = 5000000, seq = 0;

// Recebe: nada. Devolve: a base em memória (SQLite com as migrações), com o contador a zero.
function novaBase() {
  const db = baseDeTeste()._db;
  db.exec('UPDATE kanban_contador SET ultimo = 0');
  return db;
}

// Recebe: db — a base do --local. Devolve: as dependências do principal (ler e escrever nessa base, relógio e ids previsíveis).
function deps(db) {
  return {
    ler(a, instrucoes) {
      confereLeitura(a, instrucoes);
      try { return instrucoes.map((s) => db.prepare(s).all()); } catch (e) {
        const w = erroDoWrangler(e.message);
        const x = new ErroKanban(w.tipo === 'por-migrar' ? mensagemPorMigrar(a, w.tabela) : w.mensagem);
        x.tipo = w.tipo;
        throw x;
      }
    },
    escrever(a, instrucoes) {
      confereAlvo(a);
      db.exec('BEGIN');
      try { db.exec(textoDoFicheiro(instrucoes, 'teste')); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    agora: () => (relogio += 1000),
    uuid: () => 'u-' + String(++seq).padStart(5, '0'),
  };
}

// Recebe: argv; db. Devolve: {codigo, out, err} do scripts/kanban.mjs na base (sempre --local).
function corre(argv, db) {
  let out = '', err = '';
  const codigo = principal(argv.concat(['--local']), deps(db), { out: (x) => { out += x; }, err: (x) => { err += x; } });
  return { codigo, out, err };
}

// Recebe: db; numero; coluna; extra. Devolve: nada; insere o KAN-N à mão.
function poeCartao(db, numero, coluna, extra = {}) {
  const l = Object.assign({ id: 'k' + numero, numero, titulo: 'Cartão ' + numero, coluna_id: coluna, posicao: numero, relator_id: 'claude', created_at: 1, updated_at: 1 }, extra);
  const cols = Object.keys(l);
  db.prepare('INSERT INTO kanban_cartoes (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')').run(...cols.map((c) => l[c]));
  db.exec('UPDATE kanban_contador SET ultimo = MAX(ultimo, ' + Number(numero) + ')');
}

// Recebe: db; chave. Devolve: a coluna do cartão.
const colunaDe = (db, chave) => (db.prepare('SELECT coluna_id FROM kanban_cartoes WHERE numero = ?').get(numeroDaChave(chave)) || {}).coluna_id;

const TESTES = ['--teste', 'A Declaração :: 1. Abre Fisco › Declaração. 2. Confirma o 4.1.', '--teste', 'O total :: 1. Abre o quadro 4.2. 2. Confirma o total.',
  '--teste', 'O PDF :: 1. Descarrega o PDF. 2. Confirma as páginas.'];

/* ------------------------------- a chave ------------------------------- */

describe('a chave KAN-N-X', () => {
  test('o numero de um subticket é negativo, e a chave e o número vão e voltam', () => {
    assert.equal(numeroDoSubticket(126, 1), -126001);
    assert.equal(chaveDe(-126001), 'KAN-126-1');
    assert.equal(chaveDe(-126012), 'KAN-126-12');
    assert.equal(chaveDe(126), 'KAN-126');
    assert.deepEqual(['KAN-126-1', 'kan-126-3', '126-2', ' KAN-7-999 '].map(numeroDaChave), [-126001, -126003, -126002, -7999]);
    assert.deepEqual(['KAN-126-0', 'KAN-126-1000', 'KAN-126-', 'KAN--1', 'KAN-0-1'].map(numeroDaChave), [null, null, null, null, null]);
    assert.equal(numeroDaChave('KAN-126'), 126);
    assert.deepEqual([numeroDoPai(-126003), numeroDoPai(126), numeroDoPai(null)], [126, 126, null]);
  });

  test('o scripts/kanban.mjs aceita a chave de um subticket e o --teste repetido', () => {
    assert.equal(lerArgumentos(['ver', 'KAN-126-2']).numero, -126002);
    const r = lerArgumentos(['resolver', 'KAN-126', '--nota', 'x', '--sem-commit'].concat(TESTES));
    assert.deepEqual(r.testes.map((t) => t.titulo), ['A Declaração', 'O total', 'O PDF']);
    assert.equal(r.testes[1].passos, '1. Abre o quadro 4.2. 2. Confirma o total.');
    // um só é o --testar de sempre
    const um = lerArgumentos(['resolver', 'KAN-126', '--nota', 'x', '--sem-commit', '--teste', 'Só um :: 1. a 2. b']);
    assert.deepEqual([um.testes.length, um.testar], [0, 'Só um: 1. a 2. b']);
    assert.throws(() => lerArgumentos(['resolver', 'KAN-126', '--nota', 'x', '--sem-commit', '--testar', 'a'].concat(TESTES)), /não os dois/);
    assert.throws(() => lerArgumentos(['partir', 'KAN-126', '--teste', 'Só um :: 1. a']), /dois ou mais/);
    assert.throws(() => lerArgumentos(['partir', 'KAN-126', '--teste', 'sem dois pontos', '--teste', 'b :: c']), /Título curto :: /);
  });

  test('o promove lê o KAN-126-1 como o KAN-126, sem intervalos', () => {
    assert.deepEqual(chavesDaMensagem('Os subtickets KAN-126-1 e KAN-126-2 (KAN-126)'), [126]);
    assert.deepEqual(chavesDaMensagem('KAN-126-1 a KAN-126-3'), [126]);
  });
});

/* ------------------------------ os passos ------------------------------ */

const TRES = 'O que testar: 1. Abre Fisco › Declaração no telemóvel. 2. Confirma que o 4.1 e o 4.2 estão em cartões separados. 3. Confirma o total do 4.2.';

describe('o «O que testar» em lista numerada, nos dois lados', () => {
  test('a regra: os passos de seguida a partir do 1, numa linha ou em linhas, por bloco', () => {
    assert.deepEqual(passosDoTexto(TRES), [{ antes: 'O que testar:', passos: [
      'Abre Fisco › Declaração no telemóvel.', 'Confirma que o 4.1 e o 4.2 estão em cartões separados.', 'Confirma o total do 4.2.'] }]);
    assert.deepEqual(passosDoTexto('1) Abre.\n2) Fecha.'), [{ antes: '', passos: ['Abre.', 'Fecha.'] }]);
    assert.deepEqual(passosDoTexto('A nota.\n\nCommit: abc1234\n\nO que testar: 1. Um.\n2. Dois.'),
      [{ texto: 'A nota.' }, { texto: 'Commit: abc1234' }, { antes: 'O que testar:', passos: ['Um.', 'Dois.'] }]);
    // sem passos (ou só um), fica como está: quem chama mostra o texto como sempre
    assert.equal(passosDoTexto('Confirma o 4.1 e o 4.2.'), null);
    assert.equal(passosDoTexto('O que testar: 1. Só um passo.'), null);
    assert.equal(passosDoTexto('Versão 2. Depois 3. e 4.'), null);
    assert.equal(passosDoTexto(null), null);
  });

  test('a pílula tem a mesma função, letra a letra', () => {
    const daLib = passosDoTexto.toString().replace(/^function passosDoTexto\b/, 'function F');
    const daPilula = app.qaPassosDoTexto.toString().replace(/^function qaPassosDoTexto\b/, 'function F');
    assert.equal(daPilula, daLib);
    for (const t of [TRES, '1) a\n2) b', 'sem passos', 'x\n\n1. a 2. b\n\ny']) {
      assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('qaPassosDoTexto(' + JSON.stringify(t) + ')', app.__ctx))), passosDoTexto(t));
    }
  });

  test('o back office tem a mesma função, letra a letra, com o nome do guião', () => {
    const ctx = caixa();
    assert.equal(ctx.kbPassosDoTexto.toString().replace(/^function kbPassosDoTexto\b/, 'function F'),
      passosDoTexto.toString().replace(/^function passosDoTexto\b/, 'function F'));
    for (const t of [TRES, '1) a\n2) b', 'sem passos']) assert.deepEqual(JSON.parse(JSON.stringify(ctx.kbPassosDoTexto(t))), passosDoTexto(t));
  });

  test('na pílula: a resolução, a descrição e os comentários com passos saem numa lista numerada; sem passos, num parágrafo', () => {
    const lista = (h) => (h.match(/<ol class="qa-passos">([\s\S]*?)<\/ol>/) || [])[1] || '';
    const r = app.qaHtmlTexto('A nota.\n\n' + TRES, '');
    assert.match(r, /<p>A nota\.<\/p><p>O que testar:<\/p><ol class="qa-passos">/);
    assert.equal((lista(r).match(/<li>/g) || []).length, 3);
    assert.equal(app.qaHtmlTexto('Sem passos <b>aqui</b>.', 'qa-ver-txt'), '<p class="qa-ver-txt">Sem passos &lt;b&gt;aqui&lt;/b&gt;.</p>');
    const t = { id: 'q1', cartao: 'KAN-9', ticket: true, status: 'human-tests', titulo: 'Um', body: 'O que testar: 1. a 2. b', resolution: 'Feito.\n\n' + TRES,
      resolved_at: 1, created_at: 1, autor: { id: 'x', nome: 'Rita' } };
    const topo = app.qaHtmlTopo(t);
    assert.equal((topo.match(/<ol class="qa-passos">/g) || []).length, 2, 'a descrição e a resolução');
    const coms = app.qaHtmlListaComentarios([{ autor: { nome: 'Claude' }, texto: TRES, created_at: 1 }]);
    assert.match(coms, /<ol class="qa-passos"><li>Abre Fisco › Declaração no telemóvel\.<\/li>/);
    assert.doesNotMatch(topo + coms, /\sstyle=|\son[a-z]+\s*=/i);
  });

  test('no back office: o comentário e a descrição com passos saem numa lista numerada', () => {
    const ctx = caixa();
    const h = ctx.kbComentariosHtml('KAN-9', [{ id: 'c1', autor: { nome: 'Claude' }, texto: TRES, created_at: 1 }]);
    assert.match(h, /<p class="ms-texto">O que testar:<\/p><ol class="kb-passos"><li>Abre Fisco › Declaração no telemóvel\.<\/li><li>Confirma que o 4\.1/);
    assert.equal(ctx.kbTextoHtml('Sem passos.', 'kb-texto'), '<p class="kb-texto">Sem passos.</p>');
    assert.doesNotMatch(h, /\sstyle=|\son[a-z]+\s*=/i);
  });
});

/* ----------------------------- o pai segue ----------------------------- */

describe('os subtickets no scripts/kanban.mjs, e o pai a segui-los', () => {
  test('três testes criam KAN-126-1..3 em Human Tests; o pai segue: dois em Staging fica, o terceiro leva-o, um Adiado leva-o a Adiado', () => {
    const db = novaBase();
    poeCartao(db, 126, 'auto-tests', { prioridade: 2, titulo: 'A Declaração em cartões' });
    db.exec("INSERT INTO kanban_etiquetas (cartao_id, etiqueta) VALUES ('k126', 'irs')");
    const r = corre(['resolver', 'KAN-126', '--nota', 'Cada quadro tem o seu cartão.', '--sem-commit'].concat(TESTES), db);
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /Subtickets em «Human Tests»: KAN-126-1 «A Declaração», KAN-126-2 «O total», KAN-126-3 «O PDF»/);
    const filhos = db.prepare("SELECT numero, sub, tipo, titulo, descricao, coluna_id, prioridade, pai_id, (SELECT GROUP_CONCAT(etiqueta) FROM kanban_etiquetas e WHERE e.cartao_id = k.id) AS et FROM kanban_cartoes k WHERE sub IS NOT NULL ORDER BY sub").all().map((x) => ({ ...x }));
    assert.deepEqual(filhos.map((f) => [chaveDe(f.numero), f.sub, f.tipo, f.coluna_id, f.prioridade, f.pai_id, f.et]), [
      ['KAN-126-1', 1, 'subtarefa', 'human-tests', 2, 'k126', 'irs'], ['KAN-126-2', 2, 'subtarefa', 'human-tests', 2, 'k126', 'irs'], ['KAN-126-3', 3, 'subtarefa', 'human-tests', 2, 'k126', 'irs']]);
    assert.equal(filhos[0].descricao, 'O que testar: 1. Abre Fisco › Declaração. 2. Confirma o 4.1.');
    assert.equal(colunaDe(db, 'KAN-126'), 'human-tests');
    // pela ordem do quadro: o pai e, por baixo, o 1, o 2 e o 3
    assert.deepEqual(db.prepare("SELECT numero FROM kanban_cartoes WHERE coluna_id = 'human-tests' ORDER BY posicao").all().map((x) => chaveDe(x.numero)),
      ['KAN-126', 'KAN-126-1', 'KAN-126-2', 'KAN-126-3']);
    const testar = db.prepare("SELECT texto FROM kanban_comentarios WHERE cartao_id = 'k126' AND texto LIKE 'O que testar:%'").get().texto;
    assert.match(testar, /^O que testar: em 3 subtickets[\s\S]*\nKAN-126-1 — A Declaração\nKAN-126-2 — O total\nKAN-126-3 — O PDF$/);
    // a contagem do contador não sobe com os subtickets
    assert.equal(db.prepare('SELECT ultimo FROM kanban_contador').get().ultimo, 126);

    assert.equal(corre(['mover', 'KAN-126-1', 'staging'], db).codigo, 0);
    const dois = corre(['mover', 'KAN-126-2', 'staging'], db);
    assert.match(dois.out, /O pai KAN-126 fica em «Human Tests»/);
    assert.equal(colunaDe(db, 'KAN-126'), 'human-tests');
    const tres = corre(['mover', 'KAN-126-3', 'staging'], db);
    assert.match(tres.out, /O pai KAN-126 seguiu os subtickets: «Human Tests» → «Staging»/);
    assert.equal(colunaDe(db, 'KAN-126'), 'staging');
    const h = db.prepare("SELECT autor_id, autor_nome, antes, depois FROM kanban_historico WHERE cartao_id = 'k126' AND campo = 'coluna' ORDER BY id DESC").get();
    assert.deepEqual({ ...h }, { autor_id: SUBTICKETS.id, autor_nome: 'Subtickets (KAN-126-3, Claude)', antes: 'human-tests', depois: 'staging' });
    const rasto = db.prepare("SELECT quem, alvo, detalhe FROM audit_log WHERE acao = 'kanban.seguir' ORDER BY id DESC").get();
    assert.deepEqual({ ...rasto }, { quem: 'subtickets', alvo: 'KAN-126', detalhe: 'human-tests → staging (pelos subtickets: KAN-126-3, Claude)' });
    assert.ok(db.prepare("SELECT concluido_at FROM kanban_cartoes WHERE id = 'k126'").get().concluido_at, 'o pai em Staging tem o concluido_at');

    corre(['mover', 'KAN-126-2', 'adiado'], db);
    assert.equal(colunaDe(db, 'KAN-126'), 'adiado');
    corre(['mover', 'KAN-126-2', 'staging'], db);
    assert.equal(colunaDe(db, 'KAN-126'), 'staging');
  });

  test('o comecar e o resolver de um subticket recusam-se (trata-se o pai); reabrir o pai leva os que esperam; resolver de novo repõe-nos; com --teste troca os por aceitar', () => {
    const db = novaBase();
    poeCartao(db, 130, 'a-fazer');
    assert.equal(corre(['resolver', 'KAN-130', '--nota', 'Feito.', '--sem-commit'].concat(TESTES), db).codigo, 0);
    const c = corre(['comecar', 'KAN-130-1'], db);
    assert.equal(c.codigo, 1);
    assert.match(c.err, /KAN-130-1 é um subticket do KAN-130: trata-se o pai \(node scripts\/kanban\.mjs comecar KAN-130 --local\)/);
    corre(['mover', 'KAN-130-1', 'staging'], db);
    // reabrir o pai: os que esperam em Human Tests voltam com ele; o aceite fica
    const re = corre(['reabrir', 'KAN-130'], db);
    assert.match(re.out, /Voltaram com ele: KAN-130-2, KAN-130-3/);
    assert.deepEqual(['KAN-130', 'KAN-130-1', 'KAN-130-2', 'KAN-130-3'].map((k) => colunaDe(db, k)), ['a-fazer', 'staging', 'a-fazer', 'a-fazer']);
    // resolver de novo sem --teste: de volta a Human Tests
    const de = corre(['resolver', 'KAN-130', '--nota', 'Outra vez.', '--sem-commit'], db);
    assert.equal(de.codigo, 0, de.err);
    assert.match(de.out, /De volta a «Human Tests» com o pai: KAN-130-2, KAN-130-3/);
    assert.deepEqual(['KAN-130', 'KAN-130-2', 'KAN-130-3'].map((k) => colunaDe(db, k)), ['human-tests', 'human-tests', 'human-tests']);
    // com --teste: os por aceitar saem, os novos continuam a contar do 4, o aceite fica
    corre(['reabrir', 'KAN-130'], db);
    const tr = corre(['resolver', 'KAN-130', '--nota', 'De raiz.', '--sem-commit', '--teste', 'Novo A :: 1. a 2. b', '--teste', 'Novo B :: 1. c 2. d'], db);
    assert.equal(tr.codigo, 0, tr.err);
    assert.match(tr.out, /Subtickets em «Human Tests»: KAN-130-4 «Novo A», KAN-130-5 «Novo B»[\s\S]*Saíram \(trocados pelos novos\): KAN-130-2, KAN-130-3/);
    const vivos = db.prepare('SELECT numero, coluna_id FROM kanban_cartoes WHERE sub IS NOT NULL AND removed_at IS NULL ORDER BY sub').all().map((x) => chaveDe(x.numero) + ':' + x.coluna_id);
    assert.deepEqual(vivos, ['KAN-130-1:staging', 'KAN-130-4:human-tests', 'KAN-130-5:human-tests']);
  });

  test('o partir num cartão em Human Tests: cria os subtickets, troca o «O que testar» do ticket de QA e recusa repetir', () => {
    const db = novaBase();
    db.exec("INSERT INTO qa_tickets (id, user_id, body, status, resolution, resolved_at, created_at, updated_at) VALUES ('q1', 'U1', 'Corrido.', 'human-tests', 'A nota.\n\nO que testar: 1. a 2. b 3. c', 2, 1, 1)");
    poeCartao(db, 140, 'human-tests', { origem_tipo: 'qa', origem_id: 'q1', origem_estado: 'human-tests' });
    assert.equal(corre(['partir', 'KAN-140', '--teste', 'Um :: 1. a', '--teste', 'Outro :: 1. b 2. c'], db).codigo, 0);
    assert.deepEqual(['KAN-140', 'KAN-140-1', 'KAN-140-2'].map((k) => colunaDe(db, k)), ['human-tests', 'human-tests', 'human-tests']);
    assert.equal(db.prepare("SELECT resolution FROM qa_tickets WHERE id = 'q1'").get().resolution,
      'A nota.\n\nO que testar: em 2 subtickets, cada um com os seus passos, aceite ou comentado à parte (o cartão segue-os):\nKAN-140-1 — Um\nKAN-140-2 — Outro');
    const outra = corre(['partir', 'KAN-140', '--teste', 'Um :: 1. a', '--teste', 'Outro :: 1. b'], db);
    assert.equal(outra.codigo, 1);
    assert.match(outra.err, /já tem subtickets \(KAN-140-1, KAN-140-2\)/);
    assert.equal(resolucaoPartida(null, 'x'), 'O que testar: x');
    // o pai de QA leva o ticket quando segue: os dois em Staging levam-nos aos dois
    corre(['mover', 'KAN-140-1', 'staging'], db);
    corre(['mover', 'KAN-140-2', 'staging'], db);
    assert.equal(colunaDe(db, 'KAN-140'), 'staging');
    assert.equal(db.prepare("SELECT status FROM qa_tickets WHERE id = 'q1'").get().status, 'staging');
  });

  test('o plano do promove conta o commit do pai e não põe os subtickets nos «sem commits»', () => {
    const db = novaBase();
    poeCartao(db, 150, 'auto-tests');
    corre(['resolver', 'KAN-150', '--nota', 'x', '--sem-commit'].concat(TESTES), db);
    const commits = [{ sha: 'a'.repeat(40), assunto: 'Os três (KAN-150)', mensagem: 'Os três (KAN-150)', ficheiros: ['web/x.js'] }];
    const ler = () => lerQuadro(true, deps(db));
    let p = planoDoPromove(commits, ler());
    assert.deepEqual([p.commits[0].categoria, p.semCommits.length], ['deixar', 0]);
    ['KAN-150-1', 'KAN-150-2'].forEach((k) => corre(['mover', k, 'staging'], db));
    assert.equal(planoDoPromove(commits, ler()).commits[0].categoria, 'deixar', 'com um por testar, o pai fica em Human Tests');
    corre(['mover', 'KAN-150-3', 'staging'], db);
    p = planoDoPromove(commits, ler());
    assert.deepEqual([p.commits[0].categoria, p.commits[0].staging, p.semCommits.map((k) => k.chave)], ['levar', ['KAN-150'], []]);
    corre(['mover', 'KAN-150-3', 'adiado'], db);
    assert.equal(planoDoPromove(commits, ler()).commits[0].categoria, 'deixar', 'um Adiado leva o pai, e o commit, a ficar');
  });
});

/* ---------------------- o pai segue, pelas rotas ---------------------- */

describe('o pai segue os subtickets pelas rotas do kanban e da pílula', () => {
  // Recebe: env. Devolve: nada; o KAN-160 em Human Tests com três subtickets lá também.
  function comSubtickets(env) {
    const db = env.DB._db;
    db.exec('UPDATE kanban_contador SET ultimo = 0');
    poeCartao(db, 160, 'human-tests', { titulo: 'O pai' });
    [1, 2, 3].forEach((x) => poeCartao(db, numeroDoSubticket(160, x), 'human-tests',
      { id: 'k160-' + x, sub: x, tipo: 'subtarefa', pai_id: 'k160', titulo: 'Teste ' + x, descricao: 'O que testar: 1. a 2. b', posicao: 200 + x }));
  }

  test('o Aceitar do quadro: dois em Staging deixam o pai, o terceiro leva-o; um comentário devolve o filho e o pai a A fazer', async () => {
    const env = ambiente();
    comSubtickets(env);
    const db = env.DB._db;
    const mover = (k, col) => chamar(env, MASTER, 'POST', '/api/equipa/kanban/cartoes/' + k + '/mover', { coluna_id: col, indice: 0 }).then(corpoDe);
    assert.equal((await mover('KAN-160-1', 'staging')).status, 200);
    assert.equal((await mover('KAN-160-2', 'staging')).cartao.chave, 'KAN-160-2');
    assert.equal(colunaDe(db, 'KAN-160'), 'human-tests');
    await mover('KAN-160-3', 'adiado');
    assert.equal(colunaDe(db, 'KAN-160'), 'adiado');
    const h = db.prepare("SELECT autor_nome FROM kanban_historico WHERE cartao_id = 'k160' AND campo = 'coluna' ORDER BY id DESC").get();
    assert.equal(h.autor_nome, 'Subtickets (KAN-160-3, Mestre)');
    await mover('KAN-160-3', 'staging');
    assert.equal(colunaDe(db, 'KAN-160'), 'staging');
    // o comentário de uma pessoa num subticket em Human Tests: ele e o pai voltam a A fazer
    await mover('KAN-160-3', 'human-tests');
    assert.equal(colunaDe(db, 'KAN-160'), 'human-tests');
    const c = await corpoDe(await chamar(env, MASTER, 'POST', '/api/equipa/kanban/cartoes/KAN-160-3/comentarios', { texto: 'No Samsung não aparece.' }));
    assert.equal(c.coluna_id, 'a-fazer');
    assert.deepEqual(['KAN-160', 'KAN-160-3'].map((k) => colunaDe(db, k)), ['a-fazer', 'a-fazer']);
    // o detalhe do pai lista os subtickets com a coluna de cada um
    const d = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/kanban/cartoes/KAN-160'));
    assert.deepEqual(d.subtarefas.sort((x, y) => x.sub - y.sub).map((s) => [s.chave, s.sub, s.coluna_id]), [['KAN-160-1', 1, 'staging'], ['KAN-160-2', 2, 'staging'], ['KAN-160-3', 3, 'a-fazer']]);
    // a pesquisa pela chave encontra o subticket
    const q = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/kanban', null, '?q=KAN-160-2'));
    assert.deepEqual(q.cartoes.map((k) => k.chave), ['KAN-160-2']);
    // um subticket não muda de pai nem de tipo
    const e = await corpoDe(await chamar(env, MASTER, 'PATCH', '/api/equipa/kanban/cartoes/KAN-160-1', { tipo: 'tarefa' }));
    assert.equal(e.status, 400);
  });

  test('a pílula: lista os subtickets com o pai, e o Enviar para produção do último leva o pai a Staging', async () => {
    const env = ambiente();
    comSubtickets(env);
    const db = env.DB._db;
    const l = await corpoDe(await chamar(env, MASTER, 'GET', '/api/equipa/qa'));
    const pai = l.tickets.find((t) => t.cartao === 'KAN-160'), filho = l.tickets.find((t) => t.cartao === 'KAN-160-2');
    assert.deepEqual(pai.subtickets.map((s) => [s.cartao, s.status]), [['KAN-160-1', 'human-tests'], ['KAN-160-2', 'human-tests'], ['KAN-160-3', 'human-tests']]);
    assert.deepEqual([filho.id, filho.sub, filho.pai], ['KAN-160-2', 2, { cartao: 'KAN-160', titulo: 'O pai' }]);
    for (const k of ['KAN-160-1', 'KAN-160-2']) {
      assert.equal((await chamar(env, MASTER, 'POST', '/api/equipa/qa/' + k + '/mover', { coluna: 'staging' })).status, 200);
    }
    assert.equal(colunaDe(db, 'KAN-160'), 'human-tests');
    await chamar(env, MASTER, 'POST', '/api/equipa/qa/KAN-160-3/mover', { coluna: 'staging' });
    assert.equal(colunaDe(db, 'KAN-160'), 'staging');
    // o comentário pela pílula: volta o filho e o pai
    await chamar(env, MASTER, 'POST', '/api/equipa/qa/KAN-160-3/mover', { coluna: 'human-tests' });
    const c = await corpoDe(await chamar(env, MASTER, 'POST', '/api/equipa/qa/KAN-160-3/comentarios', { texto: 'Ainda falha.' }));
    assert.equal(c.coluna, 'a-fazer');
    assert.deepEqual(['KAN-160', 'KAN-160-3'].map((k) => colunaDe(db, k)), ['a-fazer', 'a-fazer']);
  });

  test('um pai fora das colunas de quem testa não segue; um cartão que não é subticket não mexe em nada', () => {
    const db = novaBase();
    poeCartao(db, 170, 'auto-tests');
    poeCartao(db, numeroDoSubticket(170, 1), 'staging', { id: 'k170-1', sub: 1, tipo: 'subtarefa', pai_id: 'k170' });
    poeCartao(db, 171, 'human-tests');
    const correr = (id) => passosDoPaiSegue(id, { chave: 'x' }, 9).forEach((p) => db.prepare(p.sql).run(...p.params));
    correr('k170-1');
    correr('k171');
    assert.deepEqual([colunaDe(db, 'KAN-170'), colunaDe(db, 'KAN-171')], ['auto-tests', 'human-tests']);
  });

  test('na pílula, o pai com subtickets por decidir não tem as decisões; os subtickets vêm por baixo dele na lista', () => {
    const pai = { id: 'KAN-160', cartao: 'KAN-160', ticket: false, tipo: 'erro', status: 'human-tests', titulo: 'O pai', body: '', created_at: 1, resolved_at: 3,
      subtickets: [{ cartao: 'KAN-160-1', titulo: 'Teste 1', status: 'staging' }, { cartao: 'KAN-160-2', titulo: 'Teste 2', status: 'human-tests' }] };
    const pe = app.qaRodapeTicket(pai);
    assert.doesNotMatch(pe, /Enviar para produção|Adiar a produção|Recusar/);
    assert.match(app.qaHtmlTopo(pai), /Subtickets[\s\S]*Testa e decide cada um à parte[\s\S]*KAN-160-1[\s\S]*Staging[\s\S]*KAN-160-2/);
    const filho = (x, r) => ({ id: 'KAN-160-' + x, cartao: 'KAN-160-' + x, ticket: false, tipo: 'subtarefa', sub: x, pai: { cartao: 'KAN-160', titulo: 'O pai' },
      status: 'human-tests', titulo: 'Teste ' + x, body: 'O que testar: 1. a 2. b', created_at: 1, resolved_at: r });
    assert.match(app.qaRodapeTicket(filho(2, 3)), /Enviar para produção/);
    assert.match(app.qaHtmlTopo(filho(2, 3)), /Subticket do <span class="num">KAN-160<\/span>[\s\S]*<ol class="qa-passos">/);
    assert.equal(app.qaNomeDoTipo(filho(2, 3)), 'Subticket');
    const outro = { id: 'KAN-7', cartao: 'KAN-7', ticket: false, tipo: 'tarefa', status: 'human-tests', titulo: 'Outro', created_at: 1, resolved_at: 9 };
    const ordem = Array.from(app.qaFilhosAoPai([filho(2, 5), outro, filho(1, 4), pai]), (t) => t.cartao);
    assert.deepEqual(ordem, ['KAN-7', 'KAN-160', 'KAN-160-1', 'KAN-160-2']);
  });

  test('no back office, o pai com subtickets por decidir diz que se decide em cada um, e lista-os com a coluna', () => {
    const ctx = caixa();
    ctx.kbEstado = { colunas: [{ id: 'human-tests', nome: 'Human Tests', fim: false }, { id: 'staging', nome: 'Staging', fim: true }] };
    const subs = [{ chave: 'KAN-160-1', sub: 1, tipo: 'subtarefa', titulo: 'Teste 1', coluna_id: 'staging' }, { chave: 'KAN-160-2', sub: 2, tipo: 'subtarefa', titulo: 'Teste 2', coluna_id: 'human-tests' }];
    const barra = ctx.kbDecidirHtml({ chave: 'KAN-160', coluna_id: 'human-tests' }, subs);
    assert.match(barra, /Decide-se em cada subticket \(1 por decidir\): este cartão segue-os/);
    assert.doesNotMatch(barra, /Enviar para produção/);
    assert.match(ctx.kbDecidirHtml({ chave: 'KAN-160-2', coluna_id: 'human-tests' }, []), /Enviar para produção/);
    const lista = ctx.kbSubtarefasHtml({ chave: 'KAN-160', tipo: 'erro' }, subs);
    assert.match(lista, /Subtickets <span class="n">1\/2<\/span>[\s\S]*KAN-160-1[\s\S]*Staging[\s\S]*KAN-160-2[\s\S]*Human Tests/);
    assert.equal(ctx.kbFrase({ campo: 'coluna', antes: 'human-tests', depois: 'staging', autor: { id: 'subtickets' } }), 'Seguiu os subtickets: de Human Tests para Staging');
    assert.equal(ctx.kbChave('kan-160-2'), 'KAN-160-2');
  });
});
