// Staging, Adiado e Produção no kanban da equipa (KAN-156, KAN-157, as
// decisões do Martinho, 2026-11-24): a migração 0032 e o que ela faz aos
// cartões de QA. As decisões no quadro e na pílula testam-se em
// kanban-cliente.test.js e qa-cliente.test.js; a lista da pílula em
// qa-servidor.test.js e qa-equipa.test.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { baseDeTeste } from './lib/bd.js';

const PASTA = new URL('../migrations/', import.meta.url);
const A_0032 = '0032_staging_adiado.sql';

/* Uma base com as migrações de antes da 0032, para a ver chegar a uma base
   que já existe (a D1 do dev).
   Devolve: a DatabaseSync. */
function baseAntes() {
  const db = new DatabaseSync(':memory:');
  readdirSync(PASTA).filter((f) => f.endsWith('.sql') && f < A_0032).sort()
    .forEach((f) => db.exec(readFileSync(new URL(f, PASTA), 'utf8')));
  return db;
}

/* Corre a 0032 numa base.
   Recebe: db — a DatabaseSync.
   Devolve: nada. */
function correr0032(db) {
  db.exec(readFileSync(new URL(A_0032, PASTA), 'utf8'));
}

/* As colunas pela ordem do quadro, em linhas curtas.
   Recebe: db — a DatabaseSync.
   Devolve: a lista de 'ordem:id:nome:fim:fixa'. */
function colunas(db) {
  return db.prepare('SELECT id, nome, ordem, fim, fixa FROM kanban_colunas ORDER BY ordem, nome').all()
    .map((c) => [c.ordem, c.id, c.nome, c.fim, c.fixa].join(':'));
}

describe('a migração 0032', () => {
  test('numa base nova: Staging e Adiado antes de Produção, fixas e de fim, e Concluído passa a Produção', () => {
    const db = baseDeTeste()._db;
    assert.deepEqual(colunas(db), [
      '1:a-fazer:A fazer:0:1', '2:auto-tests:Auto Tests:0:1', '3:human-tests:Human Tests:0:1',
      '4:staging:Staging:1:1', '5:adiado:Adiado:1:1', '6:concluido:Produção:1:1', '7:para-depois:Para depois:0:0',
    ]);
  });

  test('numa base que já existe: os cartões de Concluído ficam (o histórico), e as colunas do master descem com Produção', () => {
    const db = baseAntes();
    // o master criou uma coluna no fim e outra entre Human Tests e Concluído
    db.exec("INSERT INTO kanban_colunas (id, nome, ordem, fim, fixa, created_at, updated_at) VALUES ('c-fim', 'Arquivo', 6, 1, 0, 1, 1)");
    db.exec("UPDATE kanban_colunas SET ordem = ordem + 1 WHERE ordem >= 4");
    db.exec("INSERT INTO kanban_colunas (id, nome, ordem, fim, fixa, created_at, updated_at) VALUES ('c-meio', 'Revisão', 4, 0, 0, 1, 1)");
    db.exec("INSERT INTO kanban_cartoes (id, numero, titulo, coluna_id, posicao, relator_id, created_at, updated_at, concluido_at) VALUES ('k1', 79, 'Já feito', 'concluido', 0, 'claude', 1, 1, 5)");
    assert.deepEqual(colunas(db).map((l) => l.split(':').slice(0, 2).join(':')),
      ['1:a-fazer', '2:auto-tests', '3:human-tests', '4:c-meio', '5:concluido', '6:para-depois', '7:c-fim']);
    correr0032(db);
    assert.deepEqual(colunas(db), [
      '1:a-fazer:A fazer:0:1', '2:auto-tests:Auto Tests:0:1', '3:human-tests:Human Tests:0:1', '4:c-meio:Revisão:0:0',
      '5:staging:Staging:1:1', '6:adiado:Adiado:1:1', '7:concluido:Produção:1:1', '8:para-depois:Para depois:0:0', '9:c-fim:Arquivo:1:0',
    ], 'logo antes de Produção; o que vinha depois desce duas casas');
    const k = db.prepare("SELECT coluna_id, concluido_at FROM kanban_cartoes WHERE id = 'k1'").get();
    assert.deepEqual({ ...k }, { coluna_id: 'concluido', concluido_at: 5 }, 'o cartão de Concluído fica em Produção, com a data');
    // correr outra vez não muda nada
    const antes = colunas(db);
    correr0032(db);
    assert.deepEqual(colunas(db), antes, 'idempotente');
  });

  test('um Concluído que o master renomeou passa a Produção na mesma (o contrato das colunas)', () => {
    const db = baseAntes();
    db.exec("UPDATE kanban_colunas SET nome = 'Feito' WHERE id = 'concluido'");
    correr0032(db);
    assert.equal(db.prepare("SELECT nome FROM kanban_colunas WHERE id = 'concluido'").get().nome, 'Produção');
  });
});

describe('os cartões de QA em Staging e em Adiado', () => {
  test('mover o cartão leva o ticket, e o ticket fica resolvido (são de fim); voltar a Human Tests mantém-no resolvido', () => {
    const db = baseDeTeste()._db;
    db.exec("INSERT INTO qa_tickets (id, user_id, body, status, created_at, updated_at) VALUES ('q1', 'u1', 'O botão', 'human-tests', 1, 1)");
    db.exec("INSERT INTO kanban_cartoes (id, numero, tipo, titulo, coluna_id, posicao, relator_id, origem_tipo, origem_id, origem_estado, created_at, updated_at)" +
      " VALUES ('k1', 80, 'erro', 'O botão', 'human-tests', 0, 'automatico', 'qa', 'q1', 'human-tests', 1, 1)");
    db.exec("UPDATE qa_tickets SET resolved_at = 2 WHERE id = 'q1'");
    const ticket = () => ({ ...db.prepare("SELECT status, resolved_at FROM qa_tickets WHERE id = 'q1'").get() });
    db.exec("UPDATE kanban_cartoes SET coluna_id = 'adiado', updated_at = 3 WHERE id = 'k1'");
    assert.deepEqual(ticket(), { status: 'adiado', resolved_at: 2 });
    db.exec("UPDATE kanban_cartoes SET coluna_id = 'staging', updated_at = 4 WHERE id = 'k1'");
    assert.deepEqual(ticket(), { status: 'staging', resolved_at: 2 });
    db.exec("UPDATE kanban_cartoes SET coluna_id = 'concluido', updated_at = 5 WHERE id = 'k1'");
    assert.deepEqual(ticket(), { status: 'concluido', resolved_at: 2 }, 'o promove leva-o a Produção');
    db.exec("UPDATE kanban_cartoes SET coluna_id = 'a-fazer', updated_at = 6 WHERE id = 'k1'");
    assert.deepEqual(ticket(), { status: 'a-fazer', resolved_at: null }, 'reaberto, deixa de estar resolvido');
  });
});
