// A ferramenta do kanban (scripts/kanban.mjs), com que o Claude lê e escreve o
// quadro da equipa no dev: lê os argumentos e recusa os que não conhece (sem
// chegar ao wrangler), só escreve no dev ou na base isolada (a produção só se
// lê, e só com SELECT), e o SQL de cada comando corre contra o esquema
// verdadeiro (SQLite com as migrações): criar com o número seguinte, editar e
// mover com o histórico, comentar, ligar, importar a exportação do Jira
// (estados, tipos, etiquetas, comentários, datas; idempotente pela chave, com
// o contador acertado) e sincronizar os cartões dos pedidos aceites sem os
// duplicar. E o scripts/qa.mjs a mover o cartão de um ticket de QA depois do
// comecar, do resolver e do reabrir, sem nunca fazer falhar o ticket.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { baseDeTeste } from './lib/bd.js';
import { passosDaSincronizacao, sqlEmTexto, cartaoDoTicketQa } from '../worker/src/lib/kanban.js';
import {
  lerArgumentos, confereAlvo, confereLeitura, soLeitura, alvoDe, ALVOS, PRODUCAO, principal, ErroKanban, textoDoFicheiro,
  msDoJira, dataValida, confereEtiquetas, erroDoWrangler, mensagemPorMigrar, planoDoJira, USO,
} from '../scripts/kanban.mjs';
import { sqlDoCartao, acertarCartao, sqlComecar, sqlResolver, sqlReabrir, sqlUm, notaDaResolucao } from '../scripts/qa.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/kanban.mjs', import.meta.url));
const HOSTIL = "Não abre; DROP TABLE kanban_cartoes; --\nsegunda linha com 'plicas', \"aspas\", /* e */ \\ barra, um ? solto;\nBEGIN TRANSACTION; e COMMIT; no meio\u0000";
const SEM_NULO = HOSTIL.replace(/\u0000/g, '');

let seq = 0;
let relogio = 1000000;

// Recebe: nada.
// Devolve: a base em memória (SQLite com as migrações), com uma conta para os pedidos.
function novaBase() {
  const db = baseDeTeste()._db;
  db.exec("INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES ('U1', 'maria@x.pt', 'Maria', 'h', 's', 1)");
  /* a 0028 semeia o contador no KAN-78 (a última chave do Jira); estas bases
     começam do zero, para os números dos casos serem pequenos — o arranque
     verdadeiro prova-se à parte, em «a base nova continua a numeração do Jira» */
  db.exec('UPDATE kanban_contador SET ultimo = 0');
  return db;
}

// Recebe: db — a base.
// Devolve: a mesma base sem as tabelas do kanban (o dev antes do deploy da 0028).
function semKanban(db) {
  ['kanban_colunas', 'kanban_contador', 'kanban_cartoes', 'kanban_etiquetas', 'kanban_comentarios', 'kanban_historico', 'kanban_ligacoes', 'kanban_anexos']
    .forEach((t) => db.exec('DROP TABLE ' + t));
  return db;
}

// Recebe: bases — { dev, local, prod }, a base SQLite de cada alvo.
// Devolve: { ler, escrever, chamadas } — executores como os do wrangler, que
// passam pelas mesmas guardas (a leitura só SELECT, a escrita nunca na
// produção), correm a escrita numa transação pelo texto do ficheiro, e guardam
// cada chamada (tipo, alvo, instruções).
function executoresDe(bases) {
  const chamadas = [];
  return {
    chamadas,
    ler(a, instrucoes) {
      confereLeitura(a, instrucoes);
      chamadas.push({ tipo: 'ler', alvo: a.nome, instrucoes });
      try {
        return instrucoes.map((s) => bases[a.nome].prepare(s).all());
      } catch (e) {
        const w = erroDoWrangler(e.message);
        const x = new ErroKanban(w.tipo === 'por-migrar' ? mensagemPorMigrar(a, w.tabela) : w.mensagem);
        x.tipo = w.tipo;
        throw x;
      }
    },
    escrever(a, instrucoes) {
      confereAlvo(a);
      chamadas.push({ tipo: 'escrever', alvo: a.nome, instrucoes });
      const db = bases[a.nome];
      db.exec('BEGIN');
      try { db.exec(textoDoFicheiro(instrucoes, 'teste')); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

// Recebe: argv — os argumentos; bases — { dev, local, prod }; extra (opcional) — dependências a juntar.
// Devolve: { codigo, out, err, chamadas } do principal, com o relógio e os ids previsíveis.
function corre(argv, bases, extra = {}) {
  let out = '', err = '';
  const ex = executoresDe(bases);
  const deps = Object.assign({ ler: ex.ler, escrever: ex.escrever, agora: () => (relogio += 1000), uuid: () => 'u-' + String(++seq).padStart(5, '0') }, extra);
  const codigo = principal(argv, deps, { out: (x) => { out += x; }, err: (x) => { err += x; } });
  return { codigo, out, err, chamadas: ex.chamadas };
}

// Recebe: db; numero — o N.
// Devolve: a linha do cartão KAN-N.
const cartaoN = (db, numero) => db.prepare('SELECT * FROM kanban_cartoes WHERE numero = ?').get(numero);
// Recebe: db; numero.
// Devolve: as linhas do histórico do KAN-N (campo, antes, depois, autor_id), pela ordem.
const historicoDe = (db, numero) => db.prepare('SELECT h.campo, h.antes, h.depois, h.autor_id FROM kanban_historico h JOIN kanban_cartoes c ON c.id = h.cartao_id WHERE c.numero = ? ORDER BY h.id')
  .all(numero).map((r) => ({ ...r }));
// Recebe: db; numero.
// Devolve: as etiquetas do KAN-N, pela ordem do alfabeto.
const etiquetasDe = (db, numero) => db.prepare('SELECT e.etiqueta FROM kanban_etiquetas e JOIN kanban_cartoes c ON c.id = e.cartao_id WHERE c.numero = ? ORDER BY e.etiqueta')
  .all(numero).map((r) => r.etiqueta);
// Recebe: db; coluna — o id.
// Devolve: os números dos cartões da coluna, de cima para baixo.
const ordemDe = (db, coluna) => db.prepare('SELECT numero FROM kanban_cartoes WHERE coluna_id = ? AND removed_at IS NULL ORDER BY posicao, numero').all(coluna).map((r) => r.numero);
// Recebe: s — uma data do Jira. Devolve: o instante em ms (com o fuso escrito como o ISO pede).
const MS = (s) => Date.parse(s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));

// Recebe: db; numero; coluna (opcional) — o id; extra (opcional) — colunas a mais.
// Devolve: nada; insere o KAN-N à mão, como se já lá estivesse.
function poeCartao(db, numero, coluna = 'a-fazer', extra = {}) {
  const l = Object.assign({ id: 'k' + numero, numero, titulo: 'Cartão ' + numero, coluna_id: coluna, posicao: numero, relator_id: 'claude', created_at: 1, updated_at: 1 }, extra);
  const cols = Object.keys(l);
  db.prepare('INSERT INTO kanban_cartoes (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')').run(...cols.map((c) => l[c]));
  db.exec('UPDATE kanban_contador SET ultimo = MAX(ultimo, ' + Number(numero) + ')');
}

// Recebe: argv — os argumentos. Devolve: o ErroKanban que lerArgumentos lançou (falha o teste se não lançar).
function recusa(argv) {
  try { lerArgumentos(argv); } catch (e) { assert.ok(e instanceof ErroKanban, 'ErroKanban: ' + e); return e; }
  assert.fail('devia recusar ' + JSON.stringify(argv));
}

describe('os argumentos', () => {
  test('listar: por omissão o dev, sem as colunas de fim, em texto', () => {
    const o = lerArgumentos(['listar']);
    assert.deepEqual([o.comando, o.local, o.todos, o.json, o.coluna, o.etiqueta], ['listar', false, false, false, null, null]);
    const b = lerArgumentos(['listar', '--local', '--todos', '--json', '--coluna', 'Human Tests', '--etiqueta=QA']);
    assert.deepEqual([b.local, b.todos, b.json, b.coluna, b.etiqueta], [true, true, true, 'Human Tests', 'qa']);
  });

  test('as chaves aceitam KAN-77, kan-77 e 77', () => {
    for (const k of ['KAN-77', 'kan-77', '77']) assert.equal(lerArgumentos(['ver', k]).numero, 77);
    const l = lerArgumentos(['ligar', 'KAN-5', 'Bloqueado', 'kan-9', '--local']);
    assert.deepEqual([l.numero, l.ligacao, l.outro, l.local], [5, 'bloqueado', 9, true]);
    assert.deepEqual([lerArgumentos(['mover', '77', 'human-tests']).coluna, lerArgumentos(['importar-jira', 'jira.json']).ficheiro], ['human-tests', 'jira.json']);
  });

  test('criar: os valores de omissão, e os nomes dos tipos e das prioridades', () => {
    const o = lerArgumentos(['criar', '--titulo', '  Exportar   em PDF ']);
    assert.equal(o.coluna, 'a-fazer');
    assert.deepEqual(o.campos, { titulo: 'Exportar em PDF', descricao: '', tipo: 'tarefa', etiquetas: [], prioridade: 3, pai: null, prazo: null });
    const b = lerArgumentos(['criar', '--titulo=X', '--tipo', 'História', '--etiquetas', ' QA, design,qa ', '--prioridade', 'alta', '--pai', 'kan-5', '--prazo', '2026-12-01', '--coluna', 'para-depois']);
    assert.deepEqual(b.campos, { titulo: 'X', descricao: '', tipo: 'historia', etiquetas: ['design', 'qa'], prioridade: 2, pai: 5, prazo: '2026-12-01' });
    assert.equal(lerArgumentos(['criar', '--titulo', 'X', '--tipo', 'ERRO', '--prioridade', '5']).campos.tipo, 'erro');
  });

  test('editar: só os campos dados; «nenhum» tira o pai e o prazo, e "" as etiquetas', () => {
    assert.deepEqual(lerArgumentos(['editar', 'KAN-3', '--pai', 'nenhum', '--prazo', 'nenhum', '--etiquetas', '']).campos, { pai: null, prazo: null, etiquetas: [] });
    assert.deepEqual(lerArgumentos(['editar', '3', '--descricao=']).campos, { descricao: '' });
    assert.equal(lerArgumentos(['comentar', 'KAN-3', '--texto', '  olá  ']).texto, 'olá');
  });

  test('recusa o que não conhece, com o código 2 e o uso', () => {
    for (const argv of [[], ['apagar', 'KAN-1'], ['remover', 'KAN-1'], ['listar', '--loca'], ['listar', '--prod'], ['listar', 'a mais'],
      ['ver'], ['ver', 'KAN-0'], ['ver', 'X-7'], ['ver', "KAN-1' OR 1=1"], ['criar'], ['criar', '--titulo', '   '], ['criar', '--titulo', 'x', '--prod'],
      ['criar', '--titulo', 'x', '--tipo', 'bug'], ['criar', '--titulo', 'x', '--prioridade', '7'], ['criar', '--titulo', 'x', '--prazo', '2026-02-30'],
      ['criar', '--titulo', 'x', '--etiquetas', 'e'.repeat(41)], ['criar', '--titulo', 'x', '--titulo', 'y'], ['criar', '--titulo', 'x'.repeat(201)],
      ['editar', 'KAN-1'], ['editar', 'KAN-1', '--coluna', 'concluido'], ['mover', 'KAN-1'], ['comentar', 'KAN-1'], ['comentar', 'KAN-1', '--texto', ' '],
      ['comentar', 'KAN-1', '--texto', 'a'.repeat(8001)], ['ligar', 'KAN-1', 'bloqueia'], ['ligar', 'KAN-1', 'parte', 'KAN-2'], ['ligar', 'KAN-1', 'relaciona', 'kan-1'],
      ['importar-jira'], ['sincronizar', '--prod'], ['listar', '--json=sim'], ['criar', '--titulo']]) {
      const e = recusa(argv);
      assert.equal(e.codigo, 2, JSON.stringify(argv));
    }
    assert.match(recusa(['listar', '--prod']).message, /não aceita a opção --prod[\s\S]*Uso:/);
  });

  test('a linha de comandos sai com 2 e o uso, sem pilha, sem avisos do Node e sem chamar o wrangler', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'mover', 'KAN-3'], { encoding: 'utf8', env: Object.assign({}, process.env, { KANBAN_VERBOSO: '1' }) });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^kanban: Falta a coluna\./);
    assert.match(r.stderr, /node scripts\/kanban\.mjs importar-jira <ficheiro\.json>/);
    assert.doesNotMatch(r.stderr, /\bat \S+:\d+|\[kanban\] wrangler|Warning/);
    assert.equal(r.stdout, '');
    assert.ok(USO.includes('sincronizar'));
  });
});

describe('a guarda: escreve no dev ou na isolada; a produção só se lê, e só com SELECT', () => {
  test('aceita só os dois alvos de escrita, tal e qual', () => {
    assert.deepEqual(confereAlvo(alvoDe(false)), { nome: 'dev', local: false, base: 'gestor-imobiliario-dev' });
    assert.deepEqual(confereAlvo(alvoDe(true)), { nome: 'local', local: true, base: 'gestor-imobiliario' });
  });

  test('recusa escrever na produção e em qualquer mistura', () => {
    const maus = [PRODUCAO, { nome: 'dev', local: false, base: 'gestor-imobiliario' }, { nome: 'local', local: false, base: 'gestor-imobiliario' },
      { nome: 'prod', local: true, base: 'gestor-imobiliario' }, { local: false, base: 'gestor-imobiliario-dev' }, null];
    for (const a of maus) assert.throws(() => confereAlvo(a), /A produção não se toca/, JSON.stringify(a));
    const a = alvoDe(false);
    a.base = 'gestor-imobiliario';
    assert.equal(ALVOS.remoto.base, 'gestor-imobiliario-dev', 'o alvo é uma cópia');
    assert.throws(() => confereAlvo(a));
  });

  test('as leituras: os três sítios, e só um SELECT por instrução', () => {
    assert.equal(confereLeitura(PRODUCAO, ['SELECT 1', "SELECT 'a;b -- c /* d' AS x"]), PRODUCAO);
    assert.equal(soLeitura("SELECT id FROM tickets WHERE subject = 'it''s; DROP'"), true);
    for (const mau of ['INSERT INTO tickets (id) VALUES (1)', 'SELECT 1; DELETE FROM tickets', 'SELECT 1 -- e mais', 'UPDATE tickets SET status = 1',
      ' WITH x AS (SELECT 1) DELETE FROM tickets', "SELECT 'a'; DROP TABLE tickets", '']) {
      assert.equal(soLeitura(mau), false, mau);
      assert.throws(() => confereLeitura(PRODUCAO, [mau]), /só SELECT/);
    }
    assert.throws(() => confereLeitura(PRODUCAO, []), /Nada para ler/);
    assert.throws(() => confereLeitura({ nome: 'prod', local: false, base: 'outra' }, ['SELECT 1']), /Recuso ler/);
  });

  test('nenhum comando chega à produção para escrever: a escrita passa sempre pela guarda', () => {
    const prod = novaBase();
    const ex = executoresDe({ prod });
    assert.throws(() => ex.escrever(PRODUCAO, ['DELETE FROM tickets']), /A produção não se toca/);
    assert.equal(ex.chamadas.length, 0);
  });
});

describe('o SQL de cada comando, contra o esquema verdadeiro', () => {
  test('a base nova continua a numeração do Jira: o primeiro cartão é o KAN-79, e importar o Jira não colide com ele', () => {
    const dev = baseDeTeste()._db;
    assert.equal(dev.prepare('SELECT ultimo FROM kanban_contador').get().ultimo, 78, 'a 0028 começa na última chave do Jira');
    const r = corre(['criar', '--titulo', 'Antes da importação'], { dev });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^KAN-79 criado/);
  });

  test('criar: KAN-1 numa base vazia; depois do KAN-76, o KAN-77, no topo da coluna, com etiquetas, histórico e rasto', () => {
    const dev = novaBase();
    let r = corre(['criar', '--titulo', 'Primeiro'], { dev });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^KAN-1 criado em «A fazer» no dev \(gestor-imobiliario-dev\): Primeiro/);
    poeCartao(dev, 76, 'a-fazer', { posicao: -5000 });
    r = corre(['criar', '--titulo', 'Exportar', '--descricao', HOSTIL, '--tipo', 'historia', '--etiquetas', 'qa,design', '--prioridade', '2', '--prazo', '2026-12-01'], { dev });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^KAN-77 criado/);
    const k = cartaoN(dev, 77);
    assert.deepEqual([k.tipo, k.titulo, k.descricao, k.prioridade, k.prazo, k.relator_id, k.relator_nome, k.concluido_at],
      ['historia', 'Exportar', SEM_NULO.trim(), 2, '2026-12-01', 'claude', 'Claude', null]);
    assert.deepEqual(ordemDe(dev, 'a-fazer'), [77, 76, 1], 'no topo da coluna');
    assert.deepEqual(etiquetasDe(dev, 77), ['design', 'qa']);
    assert.deepEqual(historicoDe(dev, 77), [{ campo: 'criado', antes: null, depois: 'a-fazer', autor_id: 'claude' }]);
    assert.equal(dev.prepare('SELECT ultimo FROM kanban_contador').get().ultimo, 77);
    assert.deepEqual({ ...dev.prepare("SELECT quem, papel, acao, alvo FROM audit_log WHERE alvo = 'KAN-77'").get() }, { quem: 'claude', papel: 'script', acao: 'kanban.criar', alvo: 'KAN-77' });
    const escrita = r.chamadas.find((c) => c.tipo === 'escrever');
    assert.equal(escrita.alvo, 'dev');
    assert.doesNotMatch(textoDoFicheiro(escrita.instrucoes, 'x'), /BEGIN TRANSACTION/, 'o wrangler tiraria o BEGIN TRANSACTION de dentro do texto');
  });

  test('criar numa coluna de fim põe o concluido_at; e pelo nome da coluna', () => {
    const dev = novaBase();
    assert.equal(corre(['criar', '--titulo', 'Feito', '--coluna', 'Concluído'], { dev }).codigo, 0);
    assert.equal(cartaoN(dev, 1).coluna_id, 'concluido');
    assert.ok(cartaoN(dev, 1).concluido_at > 0);
    const r = corre(['criar', '--titulo', 'X', '--coluna', 'nao-existe'], { dev });
    assert.equal(r.codigo, 1);
    assert.match(r.err, /Não há a coluna «nao-existe»\. As colunas são: a-fazer \(«A fazer»\), auto-tests/);
    assert.ok(!r.chamadas.some((c) => c.tipo === 'escrever'));
  });

  test('criar com pai: as regras da rota (épico sem pai, subtarefa com pai que não é épico), sem escrever quando recusa', () => {
    const dev = novaBase();
    poeCartao(dev, 1, 'a-fazer', { tipo: 'epico' });
    poeCartao(dev, 2, 'a-fazer', { tipo: 'tarefa' });
    for (const [argv, msg] of [
      [['criar', '--titulo', 'S', '--tipo', 'subtarefa'], /precisa de --pai/],
      [['criar', '--titulo', 'E', '--tipo', 'epico', '--pai', 'KAN-2'], /Um épico não tem pai/],
      [['criar', '--titulo', 'S', '--tipo', 'subtarefa', '--pai', 'KAN-1'], /não pode ser um épico/],
      [['criar', '--titulo', 'T', '--pai', 'KAN-9'], /KAN-9 não existe/],
    ]) {
      const r = corre(argv, { dev });
      assert.equal(r.codigo, 1, argv.join(' '));
      assert.match(r.err, msg);
      assert.ok(!r.chamadas.some((c) => c.tipo === 'escrever'));
    }
    assert.equal(corre(['criar', '--titulo', 'S', '--tipo', 'subtarefa', '--pai', 'KAN-2'], { dev }).codigo, 0);
    assert.equal(cartaoN(dev, 3).pai_id, 'k2');
  });

  test('editar: uma linha de histórico por campo que mudou, o updated_at e o rasto; nada mudou, nada se escreve; sem ciclos', () => {
    const dev = novaBase();
    poeCartao(dev, 1, 'a-fazer', { tipo: 'epico' });
    poeCartao(dev, 2, 'a-fazer', { tipo: 'tarefa', descricao: 'antes' });
    dev.exec("INSERT INTO kanban_etiquetas (cartao_id, etiqueta) VALUES ('k2', 'qa')");
    const r = corre(['editar', 'KAN-2', '--titulo', 'Novo', '--prioridade', '1', '--etiquetas', 'qa,montra', '--pai', 'KAN-1', '--prazo', '2026-11-30', '--descricao', 'depois'], { dev });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /KAN-2 editado no dev \(gestor-imobiliario-dev\): título, descrição, prioridade, prazo, etiquetas, pai\./);
    const k = cartaoN(dev, 2);
    assert.deepEqual([k.titulo, k.prioridade, k.prazo, k.pai_id, k.descricao], ['Novo', 1, '2026-11-30', 'k1', 'depois']);
    assert.ok(k.updated_at > 1);
    assert.deepEqual(etiquetasDe(dev, 2), ['montra', 'qa']);
    assert.deepEqual(historicoDe(dev, 2).map((h) => [h.campo, h.antes, h.depois]), [
      ['titulo', 'Cartão 2', 'Novo'], ['descricao', 'antes', 'depois'], ['prioridade', '3', '1'], ['prazo', null, '2026-11-30'],
      ['etiquetas', 'qa', 'montra,qa'], ['pai', null, 'KAN-1'],
    ]);
    assert.equal(dev.prepare("SELECT detalhe FROM audit_log WHERE acao = 'kanban.editar'").get().detalhe, 'titulo, descricao, prioridade, prazo, etiquetas, pai');
    const igual = corre(['editar', 'KAN-2', '--titulo', 'Novo', '--prioridade', 'mais alta'], { dev });
    assert.match(igual.out, /Nada mudou no KAN-2/);
    assert.ok(!igual.chamadas.some((c) => c.tipo === 'escrever'));
    const ciclo = corre(['editar', 'KAN-1', '--tipo', 'tarefa', '--pai', 'KAN-2'], { dev });
    assert.equal(ciclo.codigo, 1);
    assert.match(ciclo.err, /KAN-2 não pode ser o pai de KAN-1: está por baixo dele/);
    assert.equal(corre(['editar', 'KAN-2', '--pai', 'nenhum'], { dev }).codigo, 0);
    assert.equal(cartaoN(dev, 2).pai_id, null);
  });

  test('editar: a descrição fica no histórico cortada aos 1000 caracteres; um cartão com subtarefas não passa a épico', () => {
    const dev = novaBase();
    poeCartao(dev, 1, 'a-fazer', { tipo: 'tarefa' });
    poeCartao(dev, 2, 'a-fazer', { tipo: 'subtarefa', pai_id: 'k1' });
    assert.equal(corre(['editar', 'KAN-1', '--descricao', 'x'.repeat(1500)], { dev }).codigo, 0);
    assert.equal(cartaoN(dev, 1).descricao.length, 1500, 'a descrição guarda-se inteira');
    const h = historicoDe(dev, 1)[0];
    assert.deepEqual([h.campo, h.antes, h.depois.length, h.depois.slice(-1)], ['descricao', null, 1000, '…']);
    const r = corre(['editar', 'KAN-1', '--tipo', 'epico'], { dev });
    assert.equal(r.codigo, 1);
    assert.match(r.err, /KAN-1 tem subtarefas: não pode ser um épico/);
    assert.ok(!r.chamadas.some((c) => c.tipo === 'escrever'));
  });

  test('mover: para o topo da coluna, com a linha «coluna» e o concluido_at; na mesma coluna, sem linha; nunca mexe no ticket', () => {
    const dev = novaBase();
    poeCartao(dev, 1, 'human-tests', { origem_tipo: 'qa', origem_id: 'q1', origem_estado: 'resolvido' });
    poeCartao(dev, 2, 'concluido');
    poeCartao(dev, 3, 'a-fazer');
    let r = corre(['mover', 'KAN-1', 'Concluído'], { dev });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /KAN-1: «Human Tests» → «Concluído» \(no topo\)/);
    let k = cartaoN(dev, 1);
    assert.deepEqual([k.coluna_id, k.origem_estado], ['concluido', 'resolvido']);
    assert.ok(k.concluido_at > 0);
    assert.deepEqual(ordemDe(dev, 'concluido'), [1, 2]);
    assert.deepEqual(historicoDe(dev, 1), [{ campo: 'coluna', antes: 'human-tests', depois: 'concluido', autor_id: 'claude' }]);
    r = corre(['mover', '1', 'a-fazer'], { dev });
    k = cartaoN(dev, 1);
    assert.deepEqual([k.coluna_id, k.concluido_at], ['a-fazer', null], 'sair do fim tira o concluido_at');
    assert.deepEqual(ordemDe(dev, 'a-fazer'), [1, 3]);
    corre(['mover', 'KAN-3', 'a-fazer'], { dev });
    assert.deepEqual(ordemDe(dev, 'a-fazer'), [3, 1], 'sobe ao topo da mesma coluna');
    assert.equal(historicoDe(dev, 3).length, 0, 'reordenar não deixa linha');
    const fora = corre(['mover', 'KAN-3', 'em-revisao'], { dev });
    assert.equal(fora.codigo, 1);
    assert.match(fora.err, /Não há a coluna «em-revisao»/);
    dev.exec("UPDATE kanban_cartoes SET removed_at = 5 WHERE numero = 3");
    assert.match(corre(['mover', 'KAN-3', 'auto-tests'], { dev }).err, /foi removido/);
  });

  test('comentar: o texto hostil fica tal e qual, assinado pelo Claude, e conta no listar', () => {
    const dev = novaBase();
    poeCartao(dev, 4);
    const r = corre(['comentar', 'KAN-4', '--texto', HOSTIL], { dev });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /Comentário escrito no KAN-4/);
    const m = dev.prepare('SELECT * FROM kanban_comentarios').get();
    assert.deepEqual([m.cartao_id, m.autor_id, m.autor_nome, m.texto], ['k4', 'claude', 'Claude', SEM_NULO.trim()]);
    assert.ok(cartaoN(dev, 4).updated_at > 1);
    assert.equal(dev.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 1, 'o DROP ficou dentro das plicas');
    assert.match(corre(['listar'], { dev }).out, /KAN-4 · Tarefa · Média — Cartão 4 \(1 comentário\)/);
  });

  test('ligar: bloqueia, bloqueado (ao contrário) e relaciona, uma linha no histórico de cada lado; repetir não duplica', () => {
    const dev = novaBase();
    [1, 2, 3].forEach((n) => poeCartao(dev, n));
    let r = corre(['ligar', 'KAN-1', 'bloqueia', 'KAN-2'], { dev });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^KAN-1 bloqueia KAN-2 no dev/);
    assert.match(corre(['listar'], { dev }).out, /KAN-2 · Tarefa · Média — Cartão 2 \(bloqueado\)/);
    r = corre(['ligar', 'KAN-3', 'bloqueado', 'KAN-2'], { dev });
    assert.match(r.out, /KAN-3 é bloqueado por KAN-2/);
    assert.deepEqual(dev.prepare('SELECT de_id, para_id, tipo FROM kanban_ligacoes ORDER BY created_at').all().map((l) => ({ ...l })), [
      { de_id: 'k1', para_id: 'k2', tipo: 'bloqueia' }, { de_id: 'k2', para_id: 'k3', tipo: 'bloqueia' },
    ]);
    assert.deepEqual(historicoDe(dev, 2).map((h) => h.depois), ['bloqueado KAN-1', 'bloqueia KAN-3']);
    assert.match(corre(['ligar', 'KAN-2', 'bloqueado', 'KAN-1'], { dev }).out, /Já estava ligado/);
    assert.match(corre(['ligar', 'KAN-2', 'relaciona', 'KAN-1'], { dev }).out, /KAN-2 relaciona-se com KAN-1/);
    const outra = corre(['ligar', 'KAN-1', 'relaciona', 'KAN-2'], { dev });
    assert.match(outra.out, /Já estava ligado/);
    assert.ok(!outra.chamadas.some((c) => c.tipo === 'escrever'));
    assert.equal(dev.prepare('SELECT COUNT(*) AS n FROM kanban_ligacoes').get().n, 3);
    corre(['mover', 'KAN-1', 'concluido'], { dev });
    assert.doesNotMatch(corre(['listar'], { dev }).out, /Cartão 2 \(bloqueado/, 'quem bloqueia acabou: deixa de estar bloqueado');
    assert.match(corre(['ver', 'KAN-2'], { dev }).out, /Ligações:\n {2}é bloqueado por KAN-1 «Cartão 1» \(Concluído\)\n {2}bloqueia KAN-3 «Cartão 3» \(A fazer\)\n {2}relaciona-se com KAN-1/);
  });

  test('listar: sem as colunas de fim, com --todos, por coluna e por etiqueta, e o --json na forma da rota', () => {
    const dev = novaBase();
    poeCartao(dev, 1, 'a-fazer', { tipo: 'erro', prioridade: 1, origem_tipo: 'qa', origem_id: 'q1', origem_estado: 'aberto' });
    poeCartao(dev, 2, 'concluido');
    poeCartao(dev, 3, 'a-fazer', { pai_id: 'k2', tipo: 'subtarefa' });
    dev.exec("INSERT INTO kanban_etiquetas (cartao_id, etiqueta) VALUES ('k1', 'qa'), ('k1', 'design')");
    let r = corre(['listar'], { dev });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^Kanban no dev \(gestor-imobiliario-dev\): 2 cartões\. A coluna Concluído \(1\) fica escondida \(--todos mostra-a\)\./);
    assert.match(r.out, /## A fazer \(2\)\n {2}KAN-1 · Erro · Mais alta · design, qa — Cartão 1 \(ticket de QA\)\n {2}KAN-3 · Subtarefa · Média — Cartão 3 \(pai KAN-2\)/);
    assert.match(r.out, /## Human Tests \(0\)\n {2}\(vazia\)/);
    assert.doesNotMatch(r.out, /## Concluído/);
    assert.match(corre(['listar', '--todos'], { dev }).out, /## Concluído \(1\)\n {2}KAN-2 · Tarefa · Média — Cartão 2 \(subtarefas 0\/1\)/);
    assert.match(corre(['listar', '--coluna', 'concluido'], { dev }).out, /^Kanban no dev \(gestor-imobiliario-dev\): 1 cartão\.\n\n## Concluído \(1\)/);
    assert.match(corre(['listar', '--etiqueta', 'qa', '--local'], { local: dev }).out, /^Kanban na base isolada \(--local\), com a etiqueta «qa»: 1 cartão\.[\s\S]*## A fazer \(1 de 2\)/);
    const j = JSON.parse(corre(['listar', '--json', '--todos'], { dev }).out);
    assert.deepEqual(j.colunas.map((c) => [c.id, c.total, c.fim]), [['a-fazer', 2, false], ['auto-tests', 0, false], ['human-tests', 0, false], ['concluido', 1, true], ['para-depois', 0, false]]);
    assert.deepEqual(Object.keys(j.cartoes[0]).sort(), ['anexos', 'bloqueado', 'chave', 'coluna_id', 'comentarios', 'concluido_at', 'created_at', 'etiquetas', 'id', 'numero',
      'origem', 'pai', 'posicao', 'prazo', 'prioridade', 'responsavel', 'subtarefas', 'tipo', 'titulo', 'updated_at']);
    assert.deepEqual(j.cartoes[0].origem, { tipo: 'qa', id: 'q1', estado: 'aberto' });
    assert.ok(r.chamadas.every((c) => c.tipo === 'ler' && c.instrucoes.every(soLeitura)), 'o listar só lê');
  });

  test('listar numa base sem as tabelas do kanban não é erro: diz-se', () => {
    const r = corre(['listar'], { dev: semKanban(novaBase()) });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^Tabelas por migrar\. A tabela kanban_\w+ ainda não existe no dev: a migração 0028 chega lá com o próximo deploy do ramo dev\./);
    assert.equal(JSON.parse(corre(['listar', '--json'], { dev: semKanban(novaBase()) }).out).porMigrar, true);
    assert.match(corre(['ver', 'KAN-1', '--local'], { local: semKanban(novaBase()) }).err, /0028_kanban\.sql/);
  });

  test('ver: tudo — a descrição, a origem, as subtarefas, os comentários e o histórico; --json na forma da rota', () => {
    const dev = novaBase();
    dev.exec("INSERT INTO qa_tickets (id, user_id, body, status, created_at, updated_at) VALUES ('q1', 'U1', 'O botão não responde', 'aberto', 1, 1)");
    poeCartao(dev, 7, 'a-fazer', { descricao: 'Linha 1\nLinha 2', origem_tipo: 'qa', origem_id: 'q1', origem_estado: 'aberto' });
    poeCartao(dev, 8, 'concluido', { pai_id: 'k7', tipo: 'subtarefa' });
    corre(['comentar', 'KAN-7', '--texto', 'Visto.'], { dev });
    corre(['mover', 'KAN-7', 'auto-tests'], { dev });
    const r = corre(['ver', 'kan-7'], { dev });
    assert.equal(r.codigo, 0, r.err);
    for (const re of [/^KAN-7 · Tarefa · Média · «Auto Tests» \(no dev/, /\nOrigem: ticket de QA q1 \(último estado visto: aberto\):\n {2}O botão não responde/,
      /\nDescrição:\n {2}Linha 1\n {2}Linha 2/, /\nSubtarefas \(1 de 1 feitas\):\n {2}KAN-8 · Subtarefa/, /\nComentários \(1\):\n {2}Claude · .+\n {4}Visto\./,
      /\nHistórico:\n {2}.+ · Claude · coluna: «A fazer» → «Auto Tests»/]) assert.match(r.out, re);
    const j = JSON.parse(corre(['ver', 'KAN-7', '--json'], { dev }).out);
    assert.equal(j.cartao.chave, 'KAN-7');
    assert.equal(j.cartao.descricao, 'Linha 1\nLinha 2');
    assert.deepEqual(j.cartao.relator, { id: 'claude', nome: '' });
    assert.equal(j.origem.resumo, 'O botão não responde');
    assert.deepEqual(j.subtarefas.map((s) => s.chave), ['KAN-8']);
    assert.deepEqual(j.historico.map((h) => h.campo), ['coluna']);
    const nada = corre(['ver', 'KAN-99'], { dev });
    assert.equal(nada.codigo, 1);
    assert.match(nada.err, /Não há nenhum cartão KAN-99 no dev/);
  });
});

/* ------------------------- o importar-jira ------------------------------ */

// Recebe: key, o estado, o tipo, a prioridade (ou null), as etiquetas, as datas
// de criação e de atualização, e extra ({descricao, comentarios, pai, prazo}).
// Devolve: uma tarefa como a exportação do Jira a escreve.
function noJira(key, estadoJira, tipo, prioridade, etiquetas, criado, atualizado, extra = {}) {
  return {
    key,
    fields: {
      summary: 'Tarefa ' + key, status: { name: estadoJira }, issuetype: { name: tipo }, labels: etiquetas,
      priority: prioridade == null ? null : { name: prioridade }, created: criado, updated: atualizado, duedate: extra.prazo || null,
      parent: extra.pai ? { key: extra.pai } : null, description: extra.descricao == null ? '' : extra.descricao,
      comment: { comments: extra.comentarios || [] },
    },
  };
}

const COMENTARIO = { author: { displayName: 'Rendorium' }, body: '**Corrigido**: ' + HOSTIL, created: '2026-11-09T09:19:00.565+0000', updated: '2026-11-09T09:20:00.000+0000' };
const JIRA = {
  issues: {
    totalCount: 6,
    nodes: [
      noJira('KAN-4', 'Concluído', 'Tarefa', 'Medium', ['design'], '2026-11-08T13:00:44.217+0000', '2026-11-09T09:44:49.984+0000', { descricao: 'Feito.\n\n**O que testar**', comentarios: [COMENTARIO] }),
      noJira('KAN-14', 'Para depois', 'Task', 'High', ['a-espera', 'creditos'], '2026-11-08T13:03:00.862+0000', '2026-11-08T13:03:32.137+0000'),
      noJira('KAN-71', 'Human Tests', 'Bug', 'Lowest', ['plataforma', 'qa'], '2026-11-09T09:46:20.163+0000', '2026-11-09T09:58:13.153+0000'),
      noJira('KAN-73', 'Human Tests', 'História', 'Média', ['qa'], '2026-11-09T11:28:00.227+0000', '2026-11-09T11:59:16.057+0000', { pai: 'KAN-76' }),
      noJira('KAN-76', 'A fazer', 'Épico', null, [], '2026-11-09T11:59:26.960+0100', '2026-11-09T12:13:00.422+0100', { prazo: '2026-12-01' }),
      noJira('KAN-77', 'Auto Tests', 'Subtarefa', 'Highest', ['design', 'plataforma'], '2026-11-09T12:54:17.447+0000', '2026-11-09T12:54:22.686+0000', { pai: 'KAN-71' }),
    ],
  },
};

describe('o importar-jira', () => {
  test('as datas do Jira lêem-se com o fuso sem os dois pontos; sem fuso, não', () => {
    assert.equal(msDoJira('2026-11-08T13:00:44.217+0000'), Date.UTC(2026, 10, 8, 13, 0, 44, 217));
    assert.equal(msDoJira('2026-11-08T14:00:44.217+0100'), Date.UTC(2026, 10, 8, 13, 0, 44, 217));
    assert.equal(msDoJira('2026-11-08T13:00:44Z'), Date.UTC(2026, 10, 8, 13, 0, 44));
    for (const mau of ['2026-11-08T13:00:44.217', '2026-11-08', 'ontem', null, 17]) assert.equal(msDoJira(mau), null, String(mau));
    assert.equal(dataValida('2026-02-28'), true);
    assert.equal(dataValida('2026-02-30'), false);
    assert.deepEqual(confereEtiquetas(['QA', 'a-espera', 'qa', ' Em  espera ']), ['a-espera', 'em-espera', 'qa'], 'normalizadas como nas rotas');
  });

  test('importa: colunas pelos estados, tipos, prioridades, etiquetas, pai, prazo, comentários do «Claude (Jira)», as datas e a ordem', () => {
    const dev = novaBase();
    const r = corre(['importar-jira', 'jira.json'], { dev }, { lerFicheiro: () => '\uFEFF' + JSON.stringify(JIRA) });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^Importei 6 cartões do Jira no dev \(gestor-imobiliario-dev\): A fazer 1, Auto Tests 1, Human Tests 2, Concluído 1, Para depois 1; 1 comentário\. O contador ficou em KAN-77\./);
    assert.equal(r.chamadas.filter((c) => c.tipo === 'escrever').length, 1, 'tudo numa escrita só');
    const linhas = dev.prepare('SELECT numero, tipo, coluna_id, prioridade, prazo FROM kanban_cartoes ORDER BY numero').all().map((l) => [l.numero, l.tipo, l.coluna_id, l.prioridade, l.prazo]);
    assert.deepEqual(linhas, [[4, 'tarefa', 'concluido', 3, null], [14, 'tarefa', 'para-depois', 2, null], [71, 'erro', 'human-tests', 5, null],
      [73, 'historia', 'human-tests', 3, null], [76, 'epico', 'a-fazer', 3, '2026-12-01'], [77, 'subtarefa', 'auto-tests', 1, null]]);
    const k4 = cartaoN(dev, 4);
    assert.deepEqual([k4.titulo, k4.descricao, k4.created_at, k4.updated_at, k4.concluido_at, k4.relator_id],
      ['Tarefa KAN-4', 'Feito.\n\n**O que testar**', MS('2026-11-08T13:00:44.217+0000'), MS('2026-11-09T09:44:49.984+0000'), MS('2026-11-09T09:44:49.984+0000'), 'claude']);
    assert.equal(cartaoN(dev, 76).created_at, Date.UTC(2026, 10, 9, 10, 59, 26, 960), 'o fuso +0100 conta');
    assert.equal(cartaoN(dev, 14).concluido_at, null);
    assert.deepEqual([etiquetasDe(dev, 14), etiquetasDe(dev, 77), etiquetasDe(dev, 76)], [['a-espera', 'creditos'], ['design', 'plataforma'], []]);
    assert.equal(cartaoN(dev, 73).pai_id, cartaoN(dev, 76).id);
    assert.equal(cartaoN(dev, 77).pai_id, cartaoN(dev, 71).id);
    const c = dev.prepare('SELECT * FROM kanban_comentarios').get();
    assert.deepEqual([c.cartao_id, c.autor_id, c.autor_nome, c.texto, c.created_at, c.updated_at],
      [k4.id, 'claude', 'Claude (Jira)', ('**Corrigido**: ' + SEM_NULO).trim(), MS(COMENTARIO.created), MS(COMENTARIO.updated)]);
    assert.deepEqual(historicoDe(dev, 71), [{ campo: 'criado', antes: null, depois: 'human-tests', autor_id: 'claude' }]);
    assert.equal(dev.prepare("SELECT at FROM kanban_historico h JOIN kanban_cartoes k ON k.id = h.cartao_id WHERE k.numero = 71").get().at, MS('2026-11-09T09:46:20.163+0000'));
    assert.deepEqual(ordemDe(dev, 'human-tests'), [73, 71], 'a mais recente em cima');
    assert.equal(dev.prepare('SELECT ultimo FROM kanban_contador').get().ultimo, 77);
    assert.match(dev.prepare("SELECT detalhe FROM audit_log WHERE acao = 'kanban.importar'").get().detalhe, /^6 cartões do Jira \(KAN-4 a KAN-77\)$/);
  });

  test('é idempotente pela chave: de novo não escreve nada; com uma chave nova, só ela entra, por baixo das que lá estão', () => {
    const dev = novaBase();
    const ler = () => JSON.stringify(JIRA);
    corre(['importar-jira', 'jira.json'], { dev }, { lerFicheiro: ler });
    const outra = corre(['importar-jira', 'jira.json'], { dev }, { lerFicheiro: ler });
    assert.equal(outra.codigo, 0, outra.err);
    assert.match(outra.out, /^Nada a importar no dev \(gestor-imobiliario-dev\): as 6 tarefas já existiam\./);
    assert.ok(!outra.chamadas.some((c) => c.tipo === 'escrever'));
    assert.equal(dev.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 6);
    dev.exec("UPDATE kanban_cartoes SET titulo = 'Mudado à mão' WHERE numero = 14");
    const mais = { issues: { nodes: JIRA.issues.nodes.concat([noJira('KAN-80', 'Human Tests', 'Tarefa', 'Medium', [], '2026-11-01T10:00:00.000+0000', '2026-11-01T10:00:00.000+0000')]) } };
    const r = corre(['importar-jira', 'jira.json'], { dev }, { lerFicheiro: () => JSON.stringify(mais) });
    assert.match(r.out, /^Importei 1 cartão do Jira .*O contador ficou em KAN-80\.\nSaltei 6 chaves que já existiam: KAN-4, KAN-14, KAN-71, KAN-73, KAN-76, KAN-77\./);
    assert.match(r.out, /Atenção: o KAN-14 que já existe tem outro título \(«Mudado à mão»\)/);
    assert.deepEqual(ordemDe(dev, 'human-tests'), [73, 71, 80]);
    assert.equal(dev.prepare('SELECT COUNT(*) AS n FROM kanban_historico').get().n, 7);
  });

  test('o contador fica no maior número, também quando a base já tinha cartões criados por cima', () => {
    const dev = novaBase();
    poeCartao(dev, 90);
    corre(['importar-jira', 'jira.json'], { dev }, { lerFicheiro: () => JSON.stringify(JIRA) });
    assert.equal(dev.prepare('SELECT ultimo FROM kanban_contador').get().ultimo, 90);
    corre(['criar', '--titulo', 'Depois'], { dev });
    assert.ok(cartaoN(dev, 91), 'o seguinte é o 91');
  });

  test('um estado, um tipo ou uma prioridade que não conhece param tudo antes de escrever, com a lista', () => {
    const dev = novaBase();
    const mau = { issues: { nodes: JIRA.issues.nodes.concat([
      noJira('KAN-90', 'Em revisão', 'Tarefa', 'Medium', [], '2026-11-01T10:00:00.000+0000', '2026-11-01T10:00:00.000+0000'),
      noJira('KAN-91', 'A fazer', 'Spike', 'Urgente', [], '2026-11-01T10:00:00.000+0000', 'ontem'),
      noJira('KAN-0', 'A fazer', 'Tarefa', 'Medium', [], '2026-11-01T10:00:00.000+0000', '2026-11-01T10:00:00.000+0000'),
      noJira('KAN-92', 'A fazer', 'Tarefa', 'Medium', [], '2026-11-01T10:00:00.000+0000', '2026-11-01T10:00:00.000+0000', { pai: 'KAN-500' }),
    ]) } };
    const r = corre(['importar-jira', 'jira.json'], { dev }, { lerFicheiro: () => JSON.stringify(mau) });
    assert.equal(r.codigo, 1);
    for (const re of [/Não importei nada/, /Estados que não conheço: «Em revisão» \(conheço: A fazer, Auto Tests, Human Tests, Concluído, Para depois\)/,
      /Tipos que não conheço: «Spike»/, /Prioridades que não conheço: «Urgente»/, /KAN-91: a data de atualização «ontem» não se lê/,
      /KAN-0: a chave não é KAN-N/, /KAN-92: o pai KAN-500 não está no ficheiro nem na base/]) assert.match(r.err, re);
    assert.ok(!r.chamadas.some((c) => c.tipo === 'escrever'));
    assert.equal(dev.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 0);
    assert.throws(() => planoDoJira({ nada: 1 }, [], []), /forma da exportação do Jira/);
    assert.match(corre(['importar-jira', 'x.json'], { dev }, { lerFicheiro: () => '{' }).err, /Não consegui ler o JSON de x\.json/);
  });
});

/* ------------------------- o sincronizar -------------------------------- */

// Recebe: db; linhas — [id, status, extra] dos pedidos a inserir (extra: colunas a mais).
// Devolve: nada.
function poePedidos(db, linhas) {
  linhas.forEach(([id, status, extra = {}]) => {
    const l = Object.assign({ id, user_id: 'U1', kind: 'sugestao', subject: 'Pedido ' + id, body: 'Queria ' + id + '.', status, category: 'user', created_at: 1, updated_at: 1 }, extra);
    const cols = Object.keys(l);
    db.prepare('INSERT INTO tickets (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')').run(...cols.map((c) => l[c]));
  });
}

describe('o sincronizar', () => {
  // Recebe: nada. Devolve: { prod, dev } — os pedidos de cada lado.
  function bases() {
    const prod = novaBase(), dev = novaBase();
    poePedidos(prod, [
      ['p-aceite', 'criado', { accepted_at: 10 }], ['p-res', 'resolucao', { accepted_at: 11 }],
      ['p-prop', 'resolucao', { accepted_at: 12, draft_reply: 'Olá' }], ['p-fim', 'concluido', { accepted_at: 13, accepted_changes: 'Só o PDF.' }],
      ['p-decidir', 'criado'], ['p-recusado', 'concluido', { accepted_at: 14, refused_at: 15 }], ['e-erro', 'criado', { category: 'client', accepted_at: 16 }],
    ]);
    poePedidos(dev, [['d-aceite', 'criado', { accepted_at: 20 }]]);
    return { prod, dev };
  }

  test('cria os cartões dos pedidos aceites (da produção e do dev) no dev, pela regra; a produção só se lê', () => {
    const b = bases();
    const r = corre(['sincronizar'], b);
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^Sincronização dos pedidos aceites no dev \(gestor-imobiliario-dev\): 6 pedidos lidos \(5 da produção, 1 do dev\)\.\nCriei 5 cartões: /);
    assert.match(r.out, /Não movi nenhum cartão\.\nOs outros: 1 recusado \(sem cartão\)\./);
    const porOrigem = (id) => b.dev.prepare("SELECT * FROM kanban_cartoes WHERE origem_tipo = 'pedido' AND origem_id = ?").get(id);
    assert.deepEqual(['p-aceite', 'p-res', 'p-prop', 'p-fim', 'd-aceite'].map((id) => [porOrigem(id).coluna_id, porOrigem(id).origem_estado, porOrigem(id).tipo]), [
      ['a-fazer', 'aceite', 'historia'], ['auto-tests', 'resolucao', 'historia'], ['human-tests', 'proposta', 'historia'], ['concluido', 'concluido', 'historia'], ['a-fazer', 'aceite', 'historia'],
    ]);
    assert.match(porOrigem('p-fim').descricao, /Só o PDF\.\n\nPedido #PFIM\.$/);
    assert.equal(porOrigem('p-fim').relator_id, 'claude');
    assert.equal(b.dev.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 5);
    assert.equal(b.prod.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'kanban_cartoes'").get().n, 1);
    assert.equal(b.prod.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 0, 'nada se escreveu na produção');
    const naProducao = r.chamadas.filter((c) => c.alvo === 'prod');
    assert.ok(naProducao.length >= 1 && naProducao.every((c) => c.tipo === 'ler' && c.instrucoes.every(soLeitura)), 'na produção, só SELECT');
    assert.deepEqual(r.chamadas.filter((c) => c.tipo === 'escrever').map((c) => c.alvo), ['dev']);
  });

  test('repetir não escreve nem duplica; um pedido que mudou move o cartão, uma vez', () => {
    const b = bases();
    corre(['sincronizar'], b);
    let r = corre(['sincronizar'], b);
    assert.match(r.out, /Nada a acertar: criei 0 cartões e movi 0\.\nOs outros: 5 já em dia, 1 recusado \(sem cartão\)\./);
    assert.ok(!r.chamadas.some((c) => c.tipo === 'escrever'));
    b.prod.exec("UPDATE tickets SET status = 'resolucao' WHERE id = 'p-aceite'");
    r = corre(['sincronizar'], b);
    assert.match(r.out, /Não criei nenhum cartão\.\nMovi 1 cartão: KAN-\d+ A fazer → Auto Tests\./);
    assert.equal(b.dev.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 5);
    const k = b.dev.prepare("SELECT id FROM kanban_cartoes WHERE origem_id = 'p-aceite'").get();
    assert.deepEqual(b.dev.prepare("SELECT campo, antes, depois, autor_id FROM kanban_historico WHERE cartao_id = ? AND campo = 'coluna'").all(k.id).map((h) => ({ ...h })),
      [{ campo: 'coluna', antes: 'a-fazer', depois: 'auto-tests', autor_id: 'claude' }]);
    assert.match(corre(['sincronizar'], b).out, /Nada a acertar/);
  });

  test('um cartão movido à mão para Concluído não sai de lá; um removido fica como está', () => {
    const b = bases();
    corre(['sincronizar'], b);
    b.dev.exec("UPDATE kanban_cartoes SET coluna_id = 'concluido' WHERE origem_id = 'p-res'");
    b.dev.exec("UPDATE kanban_cartoes SET removed_at = 9 WHERE origem_id = 'p-prop'");
    b.prod.exec("UPDATE tickets SET status = 'concluido' WHERE id IN ('p-res', 'p-prop')");
    const r = corre(['sincronizar'], b);
    assert.match(r.out, /1 cartão mudou só o estado visto/);
    assert.match(r.out, /1 com o cartão removido \(fica como está\)/);
    assert.equal(b.dev.prepare("SELECT coluna_id FROM kanban_cartoes WHERE origem_id = 'p-res'").get().coluna_id, 'concluido');
  });

  test('com --local lê e escreve só na base isolada', () => {
    const local = novaBase();
    poePedidos(local, [['l-1', 'criado', { accepted_at: 1 }]]);
    const r = corre(['sincronizar', '--local'], { local });
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^Sincronização dos pedidos aceites na base isolada \(--local\): 1 pedido lido\.\nCriei 1 cartão: KAN-1 «Pedido l-1» \(A fazer\)\./);
    assert.deepEqual([...new Set(r.chamadas.map((c) => c.alvo))], ['local']);
  });
});

/* ------------------------- o qa.mjs e o cartão do ticket ---------------- */

describe('o qa.mjs move o cartão do ticket, depois do ticket e sem nunca o fazer falhar', () => {
  const ID = 'aaaaaaaa-1111-4222-8333-444444444444';
  // Recebe: db. Devolve: a função que corre um texto de SQL numa transação (como uma chamada ao wrangler).
  const correrEm = (db) => (sql) => { db.exec('BEGIN'); try { db.exec(sql); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };
  // Recebe: comCartao — se o ticket já tem o cartão. Devolve: a base com o ticket de QA (e o cartão, criado pela regra).
  function comTicket(comCartao) {
    const db = novaBase();
    db.exec("INSERT INTO qa_tickets (id, user_id, body, severity, status, created_at, updated_at) VALUES ('" + ID + "', 'U1', 'O Guardar não responde', 'bloqueia', 'aberto', 1, 1)");
    if (comCartao) {
      const ev = { tipo: 'qa', id: ID, estado: 'aberto', agora: 2, novo: { uuid: 'cartao-qa', ...cartaoDoTicketQa({ id: ID, body: 'O Guardar não responde', severity: 'bloqueia' }) } };
      correrEm(db)(passosDaSincronizacao(ev).map(sqlEmTexto).join(';\n'));
    }
    return db;
  }

  test('comecar, resolver (com a nota e o commit como comentário) e reabrir levam o cartão, assinado pelo Claude', () => {
    const db = comTicket(true);
    const correr = correrEm(db);
    correr(sqlComecar(ID, 10));
    assert.equal(acertarCartao(correr, { id: ID, estado: 'em_resolucao', agora: 10 }), '');
    assert.equal(db.prepare(sqlUm(ID)).get().status, 'em_resolucao');
    assert.equal(db.prepare("SELECT coluna_id FROM kanban_cartoes WHERE id = 'cartao-qa'").get().coluna_id, 'auto-tests');
    const nota = notaDaResolucao("Corrigido o encaixe; BEGIN TRANSACTION e 'plicas'", 'abc1234');
    correr(sqlResolver(ID, nota, 20));
    assert.equal(acertarCartao(correr, { id: ID, estado: 'resolvido', agora: 20, comentario: { uuid: 'com-1', texto: nota } }), '');
    assert.doesNotMatch(sqlDoCartao({ id: ID, estado: 'resolvido', agora: 20, comentario: { uuid: 'c', texto: nota } }), /BEGIN TRANSACTION/);
    const k = db.prepare("SELECT coluna_id, origem_estado FROM kanban_cartoes WHERE id = 'cartao-qa'").get();
    assert.deepEqual({ ...k }, { coluna_id: 'human-tests', origem_estado: 'resolvido' });
    assert.deepEqual({ ...db.prepare('SELECT autor_id, autor_nome, texto FROM kanban_comentarios').get() }, { autor_id: 'claude', autor_nome: 'Claude', texto: nota });
    correr(sqlReabrir(ID, 30));
    assert.equal(acertarCartao(correr, { id: ID, estado: 'aberto', agora: 30 }), '');
    assert.equal(db.prepare("SELECT coluna_id FROM kanban_cartoes WHERE id = 'cartao-qa'").get().coluna_id, 'a-fazer');
    assert.deepEqual(db.prepare("SELECT antes, depois, autor_id FROM kanban_historico WHERE campo = 'coluna' ORDER BY id").all().map((h) => ({ ...h })), [
      { antes: 'a-fazer', depois: 'auto-tests', autor_id: 'claude' }, { antes: 'auto-tests', depois: 'human-tests', autor_id: 'claude' },
      { antes: 'human-tests', depois: 'a-fazer', autor_id: 'claude' },
    ]);
  });

  test('um ticket sem cartão (dos antigos) não cria nem mexe em nada', () => {
    const db = comTicket(false);
    const correr = correrEm(db);
    correr(sqlComecar(ID, 10));
    assert.equal(acertarCartao(correr, { id: ID, estado: 'em_resolucao', agora: 10 }), '');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM kanban_historico').get().n, 0);
  });

  test('numa base sem as tabelas do kanban, o SQL do ticket corre na mesma e o cartão só deixa uma linha a dizer porquê', () => {
    const db = semKanban(comTicket(false));
    const correr = correrEm(db);
    for (const [sql, ev, status] of [
      [sqlComecar(ID, 10), { id: ID, estado: 'em_resolucao', agora: 10 }, 'em_resolucao'],
      [sqlResolver(ID, 'Feito.', 20), { id: ID, estado: 'resolvido', agora: 20, comentario: { uuid: 'c1', texto: 'Feito.' } }, 'resolvido'],
      [sqlReabrir(ID, 30), { id: ID, estado: 'aberto', agora: 30 }, 'aberto'],
    ]) {
      correr(sql);
      const linha = acertarCartao(correr, ev);
      assert.equal(linha, 'O cartão do kanban não se acertou: esta base ainda não tem as tabelas do kanban (a migração 0028). O ticket ficou como devia.');
      assert.equal(db.prepare(sqlUm(ID)).get().status, status, 'o ticket mudou na mesma');
    }
    assert.match(acertarCartao(() => { throw new Error('rede em baixo\nmais'); }, { id: ID, estado: 'aberto', agora: 1 }), /não se acertou: rede em baixo\. O ticket/);
  });

  test('nos três comandos, o cartão vem depois de o ticket ter mudado, numa chamada à parte, e a linha vai para a saída', () => {
    const src = readFileSync(new URL('../scripts/qa.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    for (const [cmd, update, estado] of [['cmdComecar', 'sqlComecar(l.id, agora)', "'em_resolucao'"], ['cmdResolver', 'sqlResolver(o.id, resolucao, agora)', "'resolvido'"],
      ['cmdReabrir', 'sqlReabrir(o.id, agora)', "'aberto'"]]) {
      const corpo = src.slice(src.indexOf('function ' + cmd + '('), src.indexOf('\n}\n', src.indexOf('function ' + cmd + '(')));
      const iUpdate = corpo.indexOf('executar(a, ' + update + ')');
      const iConfere = corpo.indexOf('umTicket(a,', iUpdate);
      const iCartao = corpo.indexOf('acertarCartao((sql) => executar(a, sql),');
      assert.ok(iUpdate > 0 && iConfere > iUpdate && iCartao > iConfere, cmd + ': o UPDATE sozinho, a confirmação, e só depois o cartão');
      assert.ok(corpo.slice(iCartao).includes('estado: ' + estado), cmd + ' leva o cartão para o estado ' + estado);
      assert.match(corpo, /\(cartao \? '\\n' \+ cartao : ''\)/, cmd + ' junta a linha do cartão à saída');
    }
    assert.match(src, /comentario: \{ uuid: randomUUID\(\), texto: resolucao/);
  });
});
