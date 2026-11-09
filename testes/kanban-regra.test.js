// A regra única do kanban (worker/src/lib/kanban.js): o cartão que um ticket
// de QA ou um pedido aceite cria, e como se move quando a origem muda de
// estado. Corre o SQL verdadeiro contra o esquema verdadeiro (a 0028), pelos
// dois caminhos: ligado com bind (o worker) e escrito em texto (os scripts).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { baseDeTeste } from './lib/bd.js';
import {
  chaveDe, numeroDaChave, colunaDaOrigem, estadoDoPedido, prioridadeDaGravidade, tituloDe,
  cartaoDoTicketQa, cartaoDoPedido, passosDaSincronizacao, sqlEmTexto, COLUNAS_FIXAS,
} from '../worker/src/lib/kanban.js';

let seq = 0;
// um uuid de teste, diferente a cada chamada
const uuid = () => '00000000-0000-4000-8000-' + String(++seq).padStart(12, '0');

/* Corre os passos de um acontecimento na base, pelo caminho do worker
   (batch com bind) ou pelo dos scripts (o texto num exec só).
   Recebe: db — a base de teste; ev — o acontecimento; via — 'bind' ou 'texto'.
   Devolve: promessa de nada. */
async function correr(db, ev, via) {
  const passos = passosDaSincronizacao(ev);
  if (via === 'texto') { db._db.exec(passos.map(sqlEmTexto).join(';\n') + ';'); return; }
  await db.batch(passos.map((p) => db.prepare(p.sql).bind(...p.params)));
}
// o cartão de uma origem, como está na base
const cartaoDe = (db, tipo, id) => db._db.prepare('SELECT * FROM kanban_cartoes WHERE origem_tipo = ? AND origem_id = ?').get(tipo, id);

const QA = { id: 'aaaaaaaa-1111-4222-8333-444444444444', body: 'O botão Guardar não responde\nna ficha do imóvel', severity: 'bloqueia' };

describe('as peças da regra', () => {
  test('as chaves KAN-N vão e voltam', () => {
    assert.equal(chaveDe(77), 'KAN-77');
    assert.equal(numeroDaChave('KAN-77'), 77);
    assert.equal(numeroDaChave('kan-4'), 4);
    assert.equal(numeroDaChave('12'), 12);
    for (const mau of ['', 'KAN-', 'KAN-0', 'KAN-07', 'X-7', 'KAN-1;DROP', null]) assert.equal(numeroDaChave(mau), null, String(mau));
  });

  test('a coluna de cada estado, e as fixas', () => {
    assert.deepEqual(['aberto', 'em_resolucao', 'resolvido', 'removido'].map((e) => colunaDaOrigem('qa', e)),
      ['a-fazer', 'auto-tests', 'human-tests', null]);
    assert.deepEqual(['aceite', 'resolucao', 'proposta', 'concluido'].map((e) => colunaDaOrigem('pedido', e)),
      ['a-fazer', 'auto-tests', 'human-tests', 'human-tests']);
    assert.equal(colunaDaOrigem('erro', 'aberto'), null);
    assert.deepEqual(COLUNAS_FIXAS, ['a-fazer', 'auto-tests', 'human-tests', 'concluido']);
  });

  test('o estado de um pedido: só os de pessoas aceites e não recusados', () => {
    const base = { category: 'user', status: 'criado', accepted_at: 1, refused_at: null, draft_reply: null };
    assert.equal(estadoDoPedido(base), 'aceite');
    assert.equal(estadoDoPedido({ ...base, status: 'resolucao' }), 'resolucao');
    assert.equal(estadoDoPedido({ ...base, status: 'resolucao', draft_reply: 'Olá' }), 'proposta');
    assert.equal(estadoDoPedido({ ...base, status: 'concluido', draft_reply: 'Olá' }), 'concluido');
    assert.equal(estadoDoPedido({ ...base, accepted_at: null }), null, 'por decidir não tem cartão');
    assert.equal(estadoDoPedido({ ...base, refused_at: 2 }), null, 'recusado não tem cartão');
    assert.equal(estadoDoPedido({ ...base, category: 'server' }), null, 'os erros não têm cartão');
    assert.equal(estadoDoPedido({ ...base, category: 'seguranca' }), null, 'nem os de segurança');
  });

  test('o cartão de um ticket de QA e o de um pedido', () => {
    assert.deepEqual([prioridadeDaGravidade('bloqueia'), prioridadeDaGravidade('incomoda'), prioridadeDaGravidade('detalhe'), prioridadeDaGravidade(null)], [1, 2, 4, 3]);
    assert.equal(tituloDe('\n  \n  Primeira   linha  \nsegunda'), 'Primeira linha');
    assert.equal(tituloDe(''), 'Sem título');
    assert.equal(tituloDe('x'.repeat(200)).length, 120);
    const c = cartaoDoTicketQa(QA);
    assert.equal(c.tipo, 'erro');
    assert.equal(c.titulo, 'O botão Guardar não responde');
    assert.match(c.descricao, /na ficha do imóvel\n\nTicket de QA #AAAAAAAA · gravidade: bloqueia\.$/);
    assert.equal(c.prioridade, 1);
    assert.deepEqual(c.etiquetas, ['qa']);
    const p = cartaoDoPedido({ id: 'bbbbbbbb-1', subject: 'Exportar em PDF', body: 'Queria exportar.', accepted_changes: 'Só os movimentos.' });
    assert.equal(p.tipo, 'historia');
    assert.match(p.descricao, /Alterações ao pedido \(mandam mais do que o pedido\):\nSó os movimentos\.\n\nPedido #BBBBBBBB\.$/);
  });

  test('sqlEmTexto escreve os valores com as plicas dobradas e recusa contas que não batem', () => {
    assert.equal(sqlEmTexto({ sql: 'SELECT ?, ?, ?, ?', params: ["o'que", 3, null, true] }), "SELECT 'o''que', 3, NULL, 1");
    assert.throws(() => sqlEmTexto({ sql: 'SELECT ?, ?', params: [1] }));
    assert.throws(() => sqlEmTexto({ sql: 'SELECT ?', params: [1, 2] }));
  });
});

for (const via of ['bind', 'texto']) {
  describe('a sincronização na base (' + via + ')', () => {
    test('um ticket de QA cria o cartão no topo de A fazer, com o número a seguir ao do Jira, e repetir não cria outro', async () => {
      const db = baseDeTeste();
      db._db.exec("INSERT INTO kanban_cartoes (id, numero, titulo, coluna_id, posicao, relator_id, created_at, updated_at) VALUES ('j76', 76, 'Do Jira', 'a-fazer', 10, 'claude', 1, 1)");
      const ev = { tipo: 'qa', id: QA.id, estado: 'aberto', agora: 1000, novo: { uuid: uuid(), ...cartaoDoTicketQa(QA) } };
      await correr(db, ev, via);
      const k = cartaoDe(db, 'qa', QA.id);
      assert.equal(k.numero, 79, 'o contador começa no KAN-78 do Jira: o número a seguir');
      assert.equal(k.coluna_id, 'a-fazer');
      assert.ok(k.posicao < 10, 'no topo da coluna');
      assert.equal(k.tipo, 'erro');
      assert.equal(k.prioridade, 1);
      assert.equal(k.origem_estado, 'aberto');
      assert.equal(k.relator_id, 'automatico');
      assert.deepEqual(db._db.prepare('SELECT etiqueta FROM kanban_etiquetas WHERE cartao_id = ?').all(k.id).map((r) => r.etiqueta), ['qa']);
      assert.deepEqual(db._db.prepare('SELECT campo, depois FROM kanban_historico WHERE cartao_id = ?').all(k.id).map((r) => ({ ...r })), [{ campo: 'criado', depois: 'a-fazer' }]);
      // de novo, com outro uuid: nada muda, e o contador não salta
      await correr(db, { ...ev, agora: 2000, novo: { ...ev.novo, uuid: uuid() } }, via);
      assert.equal(db._db.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 2);
      assert.equal(db._db.prepare('SELECT ultimo FROM kanban_contador').get().ultimo, 79);
      assert.equal(db._db.prepare('SELECT COUNT(*) AS n FROM kanban_historico').get().n, 1);
    });

    test('em resolução, resolvido e reaberto movem o cartão; o resolvido deixa a nota como comentário', async () => {
      const db = baseDeTeste();
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'aberto', agora: 1, novo: { uuid: uuid(), ...cartaoDoTicketQa(QA) } }, via);
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'em_resolucao', agora: 2, autor: { id: 'claude', nome: 'Claude' } }, via);
      assert.equal(cartaoDe(db, 'qa', QA.id).coluna_id, 'auto-tests');
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'resolvido', agora: 3, comentario: { uuid: uuid(), texto: 'Corrigido em abc1234.' } }, via);
      const k = cartaoDe(db, 'qa', QA.id);
      assert.equal(k.coluna_id, 'human-tests');
      assert.equal(k.origem_estado, 'resolvido');
      assert.deepEqual(db._db.prepare('SELECT texto FROM kanban_comentarios WHERE cartao_id = ?').all(k.id).map((r) => r.texto), ['Corrigido em abc1234.']);
      // repetir o resolvido não move nem comenta outra vez
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'resolvido', agora: 4, comentario: { uuid: uuid(), texto: 'Outra vez.' } }, via);
      assert.equal(db._db.prepare('SELECT COUNT(*) AS n FROM kanban_comentarios').get().n, 1);
      const hist = db._db.prepare("SELECT antes, depois, autor_id FROM kanban_historico WHERE campo = 'coluna' ORDER BY id").all().map((r) => ({ ...r }));
      assert.deepEqual(hist, [
        { antes: 'a-fazer', depois: 'auto-tests', autor_id: 'claude' },
        { antes: 'auto-tests', depois: 'human-tests', autor_id: 'automatico' },
      ]);
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'aberto', agora: 5 }, via);
      assert.equal(cartaoDe(db, 'qa', QA.id).coluna_id, 'a-fazer', 'reaberto volta a A fazer');
    });

    test('um cartão movido à mão para Concluído não sai de lá sozinho, a não ser que o ticket reabra', async () => {
      const db = baseDeTeste();
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'aberto', agora: 1, novo: { uuid: uuid(), ...cartaoDoTicketQa(QA) } }, via);
      db._db.exec("UPDATE kanban_cartoes SET coluna_id = 'concluido'");
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'resolvido', agora: 2 }, via);
      let k = cartaoDe(db, 'qa', QA.id);
      assert.equal(k.coluna_id, 'concluido', 'fica em Concluído');
      assert.equal(k.origem_estado, 'resolvido', 'mas o estado visto acerta-se');
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'aberto', agora: 3 }, via);
      k = cartaoDe(db, 'qa', QA.id);
      assert.equal(k.coluna_id, 'a-fazer', 'reaberto sai de Concluído');
      assert.equal(k.concluido_at, null);
    });

    test('mover à mão para Para depois não é desfeito enquanto a origem não muda', async () => {
      const db = baseDeTeste();
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'aberto', agora: 1, novo: { uuid: uuid(), ...cartaoDoTicketQa(QA) } }, via);
      db._db.exec("UPDATE kanban_cartoes SET coluna_id = 'para-depois'");
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'aberto', agora: 2, novo: { uuid: uuid(), ...cartaoDoTicketQa(QA) } }, via);
      assert.equal(cartaoDe(db, 'qa', QA.id).coluna_id, 'para-depois');
    });

    test('removido e reposto só deixam uma linha no histórico', async () => {
      const db = baseDeTeste();
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'aberto', agora: 1, novo: { uuid: uuid(), ...cartaoDoTicketQa(QA) } }, via);
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'removido', agora: 2 }, via);
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'reposto', agora: 3 }, via);
      const k = cartaoDe(db, 'qa', QA.id);
      assert.equal(k.coluna_id, 'a-fazer');
      assert.equal(k.origem_estado, 'aberto');
      assert.deepEqual(db._db.prepare("SELECT depois FROM kanban_historico WHERE campo = 'origem' ORDER BY id").all().map((r) => r.depois), ['removido', 'reposto']);
    });

    test('um pedido aceite cria uma História; concluído vai para Human Tests sem puxar para trás um Concluído', async () => {
      const db = baseDeTeste();
      const t = { id: 'pppppppp-1', subject: 'Exportar em PDF', body: 'Queria.', accepted_changes: null };
      await correr(db, { tipo: 'pedido', id: t.id, estado: 'aceite', agora: 1, novo: { uuid: uuid(), ...cartaoDoPedido(t) } }, via);
      assert.equal(cartaoDe(db, 'pedido', t.id).tipo, 'historia');
      await correr(db, { tipo: 'pedido', id: t.id, estado: 'proposta', agora: 2 }, via);
      assert.equal(cartaoDe(db, 'pedido', t.id).coluna_id, 'human-tests');
      db._db.exec("UPDATE kanban_cartoes SET coluna_id = 'concluido'");
      await correr(db, { tipo: 'pedido', id: t.id, estado: 'concluido', agora: 3 }, via);
      assert.equal(cartaoDe(db, 'pedido', t.id).coluna_id, 'concluido');
    });

    test('um pedido que já chega concluído nasce em Concluído, com a data de feito', async () => {
      const db = baseDeTeste();
      const t = { id: 'pppppppp-2', subject: 'Antigo', body: 'Já tratado.' };
      await correr(db, { tipo: 'pedido', id: t.id, estado: 'concluido', agora: 7, novo: { uuid: uuid(), ...cartaoDoPedido(t) } }, via);
      const k = cartaoDe(db, 'pedido', t.id);
      assert.equal(k.coluna_id, 'concluido', 'não há nada para testar');
      assert.equal(k.concluido_at, 7);
      // e um que chega em resolução nasce na coluna do estado dele
      await correr(db, { tipo: 'pedido', id: 'pppppppp-3', estado: 'resolucao', agora: 8, novo: { uuid: uuid(), ...cartaoDoPedido({ id: 'pppppppp-3', subject: 'Em curso', body: 'x' }) } }, via);
      const r = cartaoDe(db, 'pedido', 'pppppppp-3');
      assert.equal(r.coluna_id, 'auto-tests');
      assert.equal(r.concluido_at, null);
    });

    test('um estado sem cartão novo não cria nada, e um tipo desconhecido não dá passos', async () => {
      const db = baseDeTeste();
      await correr(db, { tipo: 'qa', id: QA.id, estado: 'em_resolucao', agora: 1 }, via);
      assert.equal(db._db.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 0);
      assert.deepEqual(passosDaSincronizacao({ tipo: 'erro', id: 'x', estado: 'aberto' }), []);
      assert.deepEqual(passosDaSincronizacao({ tipo: 'qa', id: 'x', estado: 'inventado' }), []);
    });
  });
}
