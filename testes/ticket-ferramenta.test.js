// A ferramenta dos pedidos e dos erros (scripts/ticket.mjs), com que o Claude
// lê e trata a tabela tickets da produção e do dev: lê os argumentos e recusa
// os que não conhece (sem chegar ao wrangler), só aceita os três alvos (a
// produção, o dev e a base isolada) e exige um nas escritas, escapa o texto que
// entra no SQL (corrido contra o esquema verdadeiro, em SQLite, com e sem a
// migração 0024), só pega nos pedidos aceites, escreve a resposta proposta sem
// nunca responder nem fechar um pedido, fecha os erros, deixa rasto no
// audit_log, escreve o listar com tudo o que é preciso para resolver, e só dá
// um commit por publicado com a etiqueta da produção ou o CI verde do dev.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { baseDeTeste } from './lib/bd.js';
import {
  lerArgumentos, confereAlvo, alvoDe, ALVOS, COLUNAS_0024, configDoAlvo, cita, cortar, textoComCommit,
  sqlListar, sqlTicketsLista, sqlUns, sqlComecar, sqlNota, sqlPropor, sqlConcluir, sqlReabrir,
  confereComecar, conferePropor, confereConcluir, confereReabrir, decisaoDe, tem0024,
  tipoLegivel, estadoLegivel, decisaoLegivel, textoDoTicket, textoDoAlvo, juntaFio, quandoChega0024,
  erroDoWrangler, ehPassageiro, comRepeticao, lerJsonDoWrangler, avaliaCorridas, publicadoProd, publicadoDev,
  erroDoGh, principal, ErroTicket, USO,
} from '../scripts/ticket.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/ticket.mjs', import.meta.url));
const HOSTIL = "Não abre; DROP TABLE tickets; --\nsegunda linha com 'plicas', \"aspas\", /* e */ \\ barra; e mais -- traços\u0000";
const SHA = 'a'.repeat(40);

// Recebe: argv — os argumentos (array).
// Devolve: o ErroTicket que lerArgumentos lançou (falha o teste se não lançar).
function recusa(argv) {
  try { lerArgumentos(argv); } catch (e) { assert.ok(e instanceof ErroTicket, 'ErroTicket: ' + e); return e; }
  assert.fail('devia recusar ' + JSON.stringify(argv));
}

// Recebe: nada.
// Devolve: a base em memória (SQLite com as migrações) com duas contas, a do
// sistema, quatro pedidos (por decidir, aceite, aceite em resolução, recusado)
// e cinco erros, com quem os apanhou e um fio.
function base() {
  const db = baseDeTeste()._db;
  db.exec(`INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES ('U1', 'maria@x.pt', 'Maria Costa', 'h', 's', 1), ('U2', 'rui@x.pt', 'Rui', 'h', 's', 1);
    INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, deleted_at) VALUES ('SISTEMA', 'sistema@invalido', 'Sem utilizador', '', '', 0, 1);
    INSERT INTO tickets (id, user_id, kind, subject, body, status, category, created_at, updated_at) VALUES
      ('p-decidir', 'U1', 'problema', 'O Guardar não responde', 'Carrego e nada.', 'criado', 'user', 100, 100),
      ('p-aceite', 'U2', 'sugestao', 'Ordenar as casas', 'Queria ordenar por renda.', 'criado', 'user', 110, 150),
      ('p-aceite-res', 'U1', 'problema', 'Gráfico vazio', 'Vazio.', 'resolucao', 'user', 120, 160),
      ('p-recusado', 'U1', 'sugestao', 'Modo escuro roxo', 'Roxo.', 'concluido', 'user', 130, 170);
    UPDATE tickets SET accepted_at = 150, accepted_by = 'd1', accepted_by_nome = 'Dina', accepted_changes = 'Só no separador Casas.' WHERE id = 'p-aceite';
    UPDATE tickets SET accepted_at = 155, accepted_by = 'd1', accepted_by_nome = 'Dina' WHERE id = 'p-aceite-res';
    UPDATE tickets SET refused_at = 170, refused_by = 'd2', refused_by_nome = 'Rui Equipa', reply = 'Não faz sentido para já.' WHERE id = 'p-recusado';
    INSERT INTO tickets (id, user_id, kind, subject, body, status, category, fingerprint, n, versao, context, created_at, updated_at) VALUES
      ('e-muitos', 'U1', 'problema', 'TypeError', 'pilha', 'criado', 'client', 'fp1', 2, '43', 'ecrã casas', 10, 50),
      ('e-n', 'SISTEMA', 'problema', 'D1 caiu', 'pilha', 'criado', 'server', 'fp2', 9, NULL, NULL, 10, 60),
      ('e-recente', 'SISTEMA', 'problema', 'Quota', 'pilha', 'criado', 'infra', 'fp3', 9, NULL, NULL, 10, 90),
      ('e-res', 'U1', 'problema', 'Erro antigo', 'pilha', 'resolucao', 'client', 'fp4', 100, NULL, NULL, 5, 10),
      ('e-fim', 'SISTEMA', 'problema', 'Fechado', 'pilha', 'concluido', 'server', 'fp5', 1, NULL, NULL, 5, 999);
    INSERT INTO ticket_users (fingerprint, user_id, first_at) VALUES ('fp1', 'U1', 1), ('fp1', 'U2', 1), ('fp1', 'U3', 1),
      ('fp2', 'U1', 1), ('fp3', 'U1', 1), ('fp4', 'U1', 1), ('fp4', 'U2', 1), ('fp4', 'U3', 1), ('fp4', 'U4', 1), ('fp4', 'U5', 1);
    INSERT INTO ticket_msgs (id, ticket_id, tipo, texto, autor, nome, papel, at) VALUES
      ('m1', 'p-aceite', 'nota', 'Aceite com alterações: Só no separador Casas.', 'd1', 'Dina', 'suporte', 151),
      ('m2', 'p-recusado', 'resposta', 'Não faz sentido para já.', 'd2', 'Rui Equipa', 'suporte', 170),
      ('m3', 'e-fim', 'nota', 'Corrigido.', 'claude', 'Claude', 'script', 999);`);
  return db;
}

// Recebe: db — a base de base().
// Devolve: a mesma base sem as colunas da 0024 (como a produção antes do «promove»).
function sem0024(db) {
  COLUNAS_0024.forEach((c) => db.exec('ALTER TABLE tickets DROP COLUMN ' + c));
  return db;
}

// Recebe: db — a base SQLite.
// Devolve: um executor como o do wrangler: corre cada instrução e devolve as
// linhas de cada uma; um erro do SQLite sai como o ErroTicket do wrangler.
function executorDe(db) {
  return (alvo, instrucoes) => {
    confereAlvo(alvo);
    try {
      return instrucoes.map((s) => (/^\s*SELECT/i.test(s) ? db.prepare(s).all() : (db.prepare(s).run(), [])));
    } catch (e) {
      const w = erroDoWrangler(e.message);
      const x = new ErroTicket(w.mensagem);
      x.tipo = w.tipo;
      x.coluna = w.coluna;
      throw x;
    }
  };
}

// Recebe: argv — os argumentos; db — a base; extra (opcional) — dependências a juntar (git, gh).
// Devolve: { codigo, out, err } do principal, com o relógio e os ids previsíveis.
function corre(argv, db, extra = {}) {
  let t = 1000, n = 0, out = '', err = '';
  const deps = Object.assign({ executar: executorDe(db), agora: () => (t += 10), uuid: () => 'msg-' + (++n) + '-' + t }, extra);
  const codigo = principal(argv, deps, { out: (x) => { out += x; }, err: (x) => { err += x; } });
  return { codigo, out, err };
}

// Recebe: db; id.
// Devolve: a linha do ticket.
const um = (db, id) => db.prepare(sqlUns([id])).get();
// Recebe: db; id.
// Devolve: as linhas do audit_log desse alvo.
const rasto = (db, id) => db.prepare('SELECT * FROM audit_log WHERE alvo = ' + cita(id) + ' ORDER BY id').all();

describe('os argumentos', () => {
  test('listar: sem alvo (a produção e o dev), só os abertos e em texto', () => {
    const o = lerArgumentos(['listar']);
    assert.equal(o.alvo, null);
    assert.equal(o.todos || o.json, false);
    const p = lerArgumentos(['listar', '--dev', '--todos', '--json']);
    assert.deepEqual([p.alvo, p.todos, p.json], ['dev', true, true]);
    assert.equal(lerArgumentos(['listar', '--local']).alvo, 'local');
    assert.equal(lerArgumentos(['listar', '--prod']).alvo, 'prod');
  });

  test('comecar: um ou mais ids, sem repetidos, e o alvo', () => {
    const o = lerArgumentos(['comecar', 'x1', 'x2', '--local', 'x1', 'x3']);
    assert.deepEqual([o.id, o.ids, o.alvo], ['x1', ['x1', 'x2', 'x3'], 'local']);
    assert.deepEqual(lerArgumentos(['comecar', 'x1', '--prod']).ids, ['x1']);
  });

  test('nota: --texto valor ou --texto=valor, o sha em minúsculas, o texto aparado', () => {
    const a = lerArgumentos(['nota', 'abc-1', '--texto', '  Vi a pilha.  ', '--commit', 'ABCDEF1', '--dev']);
    assert.deepEqual([a.id, a.texto, a.commit, a.alvo], ['abc-1', 'Vi a pilha.', 'abcdef1', 'dev']);
    assert.equal(lerArgumentos(['nota', 'abc', '--texto=com = no meio', '--local']).texto, 'com = no meio');
    assert.equal(lerArgumentos(['nota', 'abc', '--texto', 'a\r\nb', '--local']).texto, 'a\nb');
  });

  test('publicado: o sha e --prod ou --dev; com --local não existe', () => {
    const o = lerArgumentos(['publicado', 'ABC1234', '--prod']);
    assert.deepEqual([o.sha, o.alvo], ['abc1234', 'prod']);
    assert.equal(lerArgumentos(['publicado', SHA, '--dev']).alvo, 'dev');
    const l = recusa(['publicado', 'abc1234', '--local']);
    assert.equal(l.codigo, 2);
    assert.match(l.message, /só existe para --prod e --dev/);
    assert.match(recusa(['publicado', 'abc1234']).message, /precisa do ramo/);
  });

  test('propor e concluir: a nota, e um (só um) de --commit e --sem-commit', () => {
    const p = lerArgumentos(['propor', 'p1', '--resposta', 'Já está.', '--nota', 'Mudei X.', '--sem-commit', '--local']);
    assert.deepEqual([p.resposta, p.nota, p.commit, p.semCommit], ['Já está.', 'Mudei X.', null, true]);
    const c = lerArgumentos(['concluir', 'e1', '--nota', 'Feito', '--commit', 'abc1234', '--prod']);
    assert.deepEqual([c.nota, c.commit, c.semCommit], ['Feito', 'abc1234', false]);
    assert.match(recusa(['concluir', 'e1', '--nota', 'n', '--prod']).message, /--commit <sha>.*--sem-commit/);
    assert.match(recusa(['concluir', 'e1', '--nota', 'n', '--commit', 'abc1234', '--sem-commit', '--prod']).message, /não os dois/);
    assert.match(recusa(['propor', 'p1', '--nota', 'n', '--sem-commit', '--prod']).message, /Falta o --resposta/);
    assert.match(recusa(['propor', 'p1', '--resposta', 'a'.repeat(2001), '--nota', 'n', '--sem-commit', '--prod']).message, /2000 caracteres/);
  });

  test('recusa o que não conhece, com o código 2 e o uso', () => {
    for (const argv of [[], ['apagar', 'x'], ['responder', 'x', '--local'], ['fechar', 'x'], ['listar', '--loca'], ['listar', 'a mais'],
      ['listar', '--prod', '--dev'], ['comecar', 'x'], ['comecar', '--local'], ['comecar', 'x', "y' --", '--local'], ['comecar', 'x', '--local', '--prod'],
      ['nota', 'x', '--local'], ['nota', 'x', '--texto', '   ', '--local'], ['nota', 'x', '--texto', '--local'], ['nota', 'x', '--texto', 'a'.repeat(4001), '--local'],
      ['nota', 'x', '--texto', 'a', '--commit', 'nao-e-sha', '--local'], ['nota', 'x', '--texto', 'a', '--texto', 'b', '--local'],
      ['reabrir', 'x', '--todos', '--local'], ['reabrir', 'x'], ['concluir', 'x', '--resposta', 'r', '--nota', 'n', '--sem-commit', '--local'],
      ['propor', 'x', '--resposta', 'r', '--nota', 'n', '--sem-commit'], ['listar', '--json=sim'], ['publicado', 'xyz', '--prod'], ['publicado', '--dev'],
      ['concluir', "x' OR 1=1 --", '--nota', 'n', '--sem-commit', '--local'], ['concluir', 'x', '--nota', 'n', '--sem-commit=sim', '--local']]) {
      const e = recusa(argv);
      assert.equal(e.codigo, 2, JSON.stringify(argv));
      assert.match(e.message, /Uso:/, JSON.stringify(argv));
    }
    assert.match(USO, /node scripts\/ticket\.mjs propor <id> --resposta "…" --nota "…" \(--commit <sha> \| --sem-commit\) --prod\|--dev\|--local/);
  });

  test('a linha de comandos sai com 2 e o uso, sem pilha e sem chamar o wrangler, o git ou o gh', () => {
    for (const argv of [['listar', '--loca'], ['comecar', 'x1'], ['publicado', 'abc1234', '--local'], ['concluir', 'x', '--nota', 'n', '--prod']]) {
      const r = spawnSync(process.execPath, [SCRIPT].concat(argv), { encoding: 'utf8', env: Object.assign({}, process.env, { TICKET_VERBOSO: '1' }) });
      assert.equal(r.status, 2, JSON.stringify(argv) + ': ' + r.stderr);
      assert.match(r.stderr, /^ticket: /);
      assert.match(r.stderr, /node scripts\/ticket\.mjs concluir <id> --nota/);
      assert.doesNotMatch(r.stderr, /\[ticket\] (wrangler|git|gh) /, 'nenhuma chamada de fora');
      assert.doesNotMatch(r.stderr, /\bat \S+:\d+/);
      assert.equal(r.stdout, '');
    }
  });
});

describe('a guarda: a produção, o dev ou a isolada, e mais nada', () => {
  test('aceita só os três alvos, tal e qual', () => {
    assert.deepEqual(confereAlvo(alvoDe('prod')), { nome: 'prod', local: false, base: 'gestor-imobiliario' });
    assert.deepEqual(confereAlvo(alvoDe('dev')), { nome: 'dev', local: false, base: 'gestor-imobiliario-dev' });
    assert.deepEqual(confereAlvo(alvoDe('local')), { nome: 'local', local: true, base: 'gestor-imobiliario' });
  });

  test('recusa qualquer mistura antes do wrangler', () => {
    const maus = [
      { nome: 'local', local: false, base: 'gestor-imobiliario' },      // a isolada sem --local seria a produção
      { nome: 'dev', local: false, base: 'gestor-imobiliario' },        // o nome do dev com a base da produção
      { nome: 'prod', local: false, base: 'gestor-imobiliario-dev' },
      { nome: 'prod', local: true, base: 'gestor-imobiliario' },
      { nome: 'dev', local: true, base: 'gestor-imobiliario-dev' },
      { local: false, base: 'gestor-imobiliario' },                       // sem nome
      { nome: 'prod', local: false, base: 'outra' },
      null, 'prod',
    ];
    for (const a of maus) assert.throws(() => confereAlvo(a), /Recuso a base/, JSON.stringify(a));
    assert.throws(() => alvoDe('producao'), ErroTicket);
    assert.throws(() => alvoDe('__proto__'), ErroTicket);
  });

  test('o alvo é uma cópia: mexer-lhe não muda os permitidos, e o executor recusa-o', () => {
    const a = alvoDe('dev');
    a.base = 'gestor-imobiliario';
    assert.equal(ALVOS.dev.base, 'gestor-imobiliario-dev');
    assert.throws(() => executorDe(base())(a, ['SELECT 1']), /Recuso a base/);
  });

  test('o wrangler.toml temporário só tem a base do alvo, com o id verdadeiro', () => {
    const p = configDoAlvo(alvoDe('prod'), 'd41be3c3-3582-4cf4-8c64-e1d86b2a38e9');
    assert.match(p, /database_name = "gestor-imobiliario"\n/);
    assert.match(p, /database_id = "d41be3c3-3582-4cf4-8c64-e1d86b2a38e9"/);
    assert.doesNotMatch(p, /PLACEHOLDER|r2_buckets|-dev"/);
    assert.match(configDoAlvo(alvoDe('dev'), '73c6d3d4-edaa-4801-b577-5079776e1f6d'), /database_name = "gestor-imobiliario-dev"/);
    assert.throws(() => configDoAlvo(alvoDe('dev'), 'PLACEHOLDER_D1_DEV_ID'), ErroTicket);
    assert.throws(() => configDoAlvo(alvoDe('local'), '73c6d3d4-edaa-4801-b577-5079776e1f6d'), ErroTicket);
  });
});

describe('o SQL, corrido contra o esquema verdadeiro', () => {
  test('cita dobra as plicas, tira o nulo e escreve NULL e números; cortar e o commit', () => {
    assert.equal(cita("it's"), "'it''s'");
    assert.equal(cita(null), 'NULL');
    assert.equal(cita(12.9), '12');
    assert.equal(cita(NaN), 'NULL');
    assert.equal(cita('a\u0000b'), "'ab'");
    assert.equal(cortar('a\n b  c', 10), 'a b c');
    assert.equal(cortar('x'.repeat(20), 5), 'xxxx…');
    assert.equal(textoComCommit('  Feito.  ', 'abc1234'), 'Feito.\n\nCommit: abc1234');
    assert.equal(textoComCommit('Feito.', null), 'Feito.');
  });

  test('listar: aceites, por decidir, erros (pessoas, ocorrências, recente), recebidos antes de em resolução, e os concluídos no fim', () => {
    const db = base();
    const [ts, ms] = sqlListar(false).map((s) => db.prepare(s).all());
    assert.deepEqual(ts.map((l) => l.id), ['p-aceite', 'p-aceite-res', 'p-decidir', 'e-muitos', 'e-recente', 'e-n', 'e-res']);
    assert.deepEqual(ts.map((l) => l.pessoas), [0, 0, 0, 3, 1, 1, 5]);
    assert.equal(ts[0].autor_nome, 'Rui');
    assert.equal(ts[0].accepted_changes, 'Só no separador Casas.');
    assert.deepEqual(ms.map((m) => m.id), ['m1'], 'o fio só dos listados');
    const [todos, msTodos] = sqlListar(true).map((s) => db.prepare(s).all());
    assert.deepEqual(todos.map((l) => l.id).slice(7), ['e-fim', 'p-recusado']);
    assert.deepEqual(msTodos.map((m) => m.id).sort(), ['m1', 'm2', 'm3']);
  });

  test('listar numa base sem a 0024: o SELECT normal falha pela coluna, o de recurso funciona', () => {
    const db = sem0024(base());
    assert.throws(() => db.prepare(sqlTicketsLista(false, true)).all(), /no such column/);
    const [ts, ms] = sqlListar(false, false).map((s) => db.prepare(s).all());
    assert.equal(ts.length, 7);
    assert.ok(ts.every((l) => l.accepted_at === null && l.draft_reply === null));
    assert.deepEqual(ts.slice(0, 3).map((l) => l.id).sort(), ['p-aceite', 'p-aceite-res', 'p-decidir'], 'os pedidos juntos, todos por decidir');
    assert.equal(ms.length, 1);
    const e = erroDoWrangler('no such column: t.accepted_at at offset 7403: SQLITE_ERROR');
    assert.deepEqual([e.tipo, e.coluna], ['coluna', 'accepted_at'], 'um offset 7403 não é a falha passageira');
  });

  test('comecar: o erro e o pedido aceite passam; o por decidir, o recusado e um id hostil não; rasto só do que pegou', () => {
    const db = base();
    sqlComecar(['e-muitos', 'p-aceite', 'p-decidir', 'p-recusado', "x' OR '1'='1"], 500).forEach((s) => db.exec(s));
    assert.equal(um(db, 'e-muitos').status, 'resolucao');
    assert.equal(um(db, 'e-muitos').updated_at, 500);
    assert.equal(um(db, 'p-aceite').status, 'resolucao');
    assert.equal(um(db, 'p-decidir').status, 'criado');
    assert.equal(um(db, 'p-recusado').status, 'concluido');
    const linhas = db.prepare("SELECT alvo, quem, nome, papel, acao FROM audit_log WHERE acao = 'pedido.comecar' ORDER BY alvo").all();
    assert.deepEqual(linhas.map((l) => [l.alvo, l.quem, l.nome, l.papel]), [['e-muitos', 'claude', 'Claude', 'script'], ['p-aceite', 'claude', 'Claude', 'script']]);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n, 9);
  });

  test('comecar numa base sem a 0024: só os erros', () => {
    const db = sem0024(base());
    sqlComecar(['e-n', 'p-aceite'], 500, false).forEach((s) => db.exec(s));
    assert.equal(um(db, 'e-n').status, 'resolucao');
    assert.equal(um(db, 'p-aceite').status, 'criado');
    assert.equal(tem0024(um(db, 'e-n')), false);
  });

  test('nota: o texto hostil fica tal e qual no fio, com o commit, e com rasto', () => {
    const db = base();
    sqlNota('e-n', HOSTIL, 'abc1234', 700, 'msg-1').forEach((s) => db.exec(s));
    const m = db.prepare("SELECT * FROM ticket_msgs WHERE id = 'msg-1'").get();
    assert.equal(m.texto, HOSTIL.replace(/\u0000/g, '').trim() + '\n\nCommit: abc1234');
    assert.deepEqual([m.ticket_id, m.tipo, m.autor, m.nome, m.papel, m.at], ['e-n', 'nota', 'claude', 'Claude', 'script', 700]);
    assert.equal(rasto(db, 'e-n')[0].acao, 'pedido.nota');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n, 9, 'o DROP TABLE ficou dentro das plicas');
    sqlNota('nao-existe', 'x', null, 701, 'msg-2').forEach((s) => db.exec(s));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ticket_msgs WHERE id = 'msg-2'").get().n, 0, 'sem ticket, sem nota');
    assert.equal(rasto(db, 'nao-existe').length, 0, 'e sem rasto');
  });

  test('propor: a proposta no pedido aceite, em resolução, o reply intacto; nunca num erro nem num por decidir', () => {
    const db = base();
    sqlPropor('p-aceite', HOSTIL, 'Ordenei por renda.', 'abc1234', 800, 'msg-1').forEach((s) => db.exec(s));
    const l = um(db, 'p-aceite');
    assert.equal(l.draft_reply, HOSTIL.replace(/\u0000/g, ''));
    assert.deepEqual([l.draft_at, l.status, l.updated_at, l.reply], [800, 'resolucao', 800, null]);
    assert.equal(db.prepare("SELECT texto FROM ticket_msgs WHERE id = 'msg-1'").get().texto, 'Ordenei por renda.\n\nCommit: abc1234');
    assert.match(rasto(db, 'p-aceite')[0].detalhe, /^proposta: Não abre; DROP TABLE.*· commit abc1234$/);
    for (const id of ['e-n', 'p-decidir', 'p-recusado']) {
      sqlPropor(id, 'r', 'n', null, 801, 'msg-' + id).forEach((s) => db.exec(s));
      assert.equal(um(db, id).draft_reply, null, id);
      assert.equal(rasto(db, id).length, 0, id);
    }
  });

  test('concluir: só um erro, com a nota no fio e o rasto pedido.fechar', () => {
    const db = base();
    sqlConcluir('e-res', 'Corrigido.', null, 900, 'msg-1').forEach((s) => db.exec(s));
    assert.deepEqual([um(db, 'e-res').status, um(db, 'e-res').updated_at], ['concluido', 900]);
    assert.equal(rasto(db, 'e-res')[0].acao, 'pedido.fechar');
    assert.equal(rasto(db, 'e-res')[0].detalhe, 'concluído · sem commit');
    sqlConcluir('p-aceite-res', 'x', null, 901, 'msg-2').forEach((s) => db.exec(s));
    assert.equal(um(db, 'p-aceite-res').status, 'resolucao', 'um pedido não se fecha daqui');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ticket_msgs WHERE id = 'msg-2'").get().n, 0);
  });

  test('reabrir: um erro concluído volta; um pedido aceite em resolução volta e larga a proposta, guardada no fio', () => {
    const db = base();
    sqlReabrir('e-fim', false, 950, 'msg-1').forEach((s) => db.exec(s));
    assert.equal(um(db, 'e-fim').status, 'criado');
    sqlPropor('p-aceite-res', 'Já se vê o gráfico.', 'Corrigi.', null, 960, 'msg-2').forEach((s) => db.exec(s));
    sqlReabrir('p-aceite-res', true, 970, 'msg-3').forEach((s) => db.exec(s));
    const l = um(db, 'p-aceite-res');
    assert.deepEqual([l.status, l.draft_reply, l.draft_at], ['criado', null, null]);
    assert.match(db.prepare("SELECT texto FROM ticket_msgs WHERE id = 'msg-3'").get().texto, /largada ao reabrir[\s\S]*Já se vê o gráfico\.$/);
    assert.deepEqual(rasto(db, 'p-aceite-res').map((r) => r.acao), ['pedido.propor', 'pedido.reabrir']);
    sqlReabrir('p-decidir', true, 980, 'msg-4').forEach((s) => db.exec(s));
    sqlReabrir('p-recusado', true, 980, 'msg-5').forEach((s) => db.exec(s));
    assert.equal(um(db, 'p-recusado').status, 'concluido', 'um recusado não se reabre daqui');
    assert.equal(rasto(db, 'p-decidir').length + rasto(db, 'p-recusado').length, 0);
  });
});

describe('as regras de cada comando', () => {
  const L = alvoDe('local');
  const db = base();
  const linhas = (ids) => db.prepare(sqlUns(ids)).all();

  test('a decisão de um pedido, e o erro sem decisão', () => {
    assert.deepEqual(['p-decidir', 'p-aceite', 'p-recusado', 'e-n'].map((id) => decisaoDe(um(db, id))), ['por-decidir', 'aceite', 'recusado', null]);
    assert.equal(decisaoDe(um(sem0024(base()), 'p-aceite')), 'sem-0024');
  });

  test('comecar confere todos antes: por decidir, recusado, concluído ou desconhecido param tudo', () => {
    const r = confereComecar(['e-n', 'p-aceite', 'p-aceite-res'], linhas(['e-n', 'p-aceite', 'p-aceite-res']), L);
    assert.deepEqual([r.mexer.map((l) => l.id), r.jaEstavam.map((l) => l.id)], [['e-n', 'p-aceite'], ['p-aceite-res']]);
    assert.throws(() => confereComecar(['e-n', 'p-decidir'], linhas(['e-n', 'p-decidir']), L),
      /O pedido p-decidir ainda não foi aceite no back office: só se implementam os aceites\. Não mexi em nenhum\./);
    assert.throws(() => confereComecar(['p-recusado'], linhas(['p-recusado']), L), /está concluído: reabrir um pedido é da equipa/);
    assert.throws(() => confereComecar(['e-fim'], linhas(['e-fim']), L), /reabre-o primeiro \(node scripts\/ticket\.mjs reabrir e-fim --local\)/);
    assert.throws(() => confereComecar(['e-n', 'zz'], linhas(['e-n', 'zz']), L), /Não há nenhum ticket com o id zz/);
    const sem = sem0024(base());
    assert.throws(() => confereComecar(['p-aceite'], sem.prepare(sqlUns(['p-aceite'])).all(), alvoDe('prod')), /só chega à produção com o «promove»/);
  });

  test('propor só num pedido aceite e aberto; concluir só num erro; reabrir o que o Claude abriu', () => {
    assert.doesNotThrow(() => conferePropor(um(db, 'p-aceite'), 'p-aceite', L));
    assert.throws(() => conferePropor(um(db, 'e-n'), 'e-n', L), /é um erro.*concluir/);
    assert.throws(() => conferePropor(um(db, 'p-decidir'), 'p-decidir', L), /ainda não foi aceite/);
    assert.throws(() => conferePropor(um(db, 'p-recusado'), 'p-recusado', L), /já está concluído/);
    assert.throws(() => conferePropor(undefined, 'zz', L), /Não há nenhum ticket/);
    assert.equal(confereConcluir(um(db, 'e-n'), 'e-n', L), null);
    assert.equal(confereConcluir(um(db, 'e-fim'), 'e-fim', L), 'O erro e-fim já está concluído.');
    assert.throws(() => confereConcluir(um(db, 'p-recusado'), 'p-recusado', L), /pedido de uma pessoa: não se fecha daqui\. Usa o propor/);
    assert.equal(confereReabrir(um(db, 'e-res'), 'e-res', L), null);
    assert.equal(confereReabrir(um(db, 'e-n'), 'e-n', L), 'O erro e-n já está nos recebidos.');
    assert.equal(confereReabrir(um(db, 'p-aceite-res'), 'p-aceite-res', L), null);
    assert.equal(confereReabrir(um(db, 'p-aceite'), 'p-aceite', L), 'O pedido p-aceite já está nos recebidos.');
    assert.throws(() => confereReabrir(um(db, 'p-decidir'), 'p-decidir', L), /por decidir: reabrir e decidir é da equipa/);
    assert.throws(() => confereReabrir(um(db, 'p-recusado'), 'p-recusado', L), /recusado por Rui Equipa: reabri-lo é decisão da equipa/);
  });
});

describe('os comandos de ponta a ponta, numa base SQLite', () => {
  test('comecar: um por decidir recusa tudo sem mexer; o aceite e o erro passam; de novo, «já estava»', () => {
    const db = base();
    const r1 = corre(['comecar', 'e-n', 'p-decidir', '--local'], db);
    assert.equal(r1.codigo, 1);
    assert.match(r1.err, /^ticket: O pedido p-decidir ainda não foi aceite no back office: só se implementam os aceites\./);
    assert.equal(um(db, 'e-n').status, 'criado', 'não mexeu em nenhum');
    const r2 = corre(['comecar', 'p-aceite', 'e-n', '--local'], db);
    assert.equal(r2.codigo, 0, r2.err);
    assert.equal(r2.out, 'Pedido p-aceite em resolução na base isolada (--local). Foi aceite com alterações: são elas que mandam.\nErro e-n em resolução na base isolada (--local).\n');
    assert.equal(um(db, 'p-aceite').status, 'resolucao');
    assert.match(corre(['comecar', 'e-n', '--local'], db).out, /^O e-n já estava em resolução\.$/m);
    assert.equal(rasto(db, 'e-n').length, 1, 'o «já estava» não escreve');
  });

  test('propor com --commit no dev só escreve depois de o publicado dizer que sim', () => {
    const db = base();
    const git = (args) => {
      if (args[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
      if (args[0] === 'rev-parse') return { status: 0, stdout: (args[3].startsWith('refs/') ? 'b'.repeat(40) : SHA) + '\n', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };   // merge-base: contido
    };
    const corridas = (conclusao) => JSON.stringify(['Testes', 'Deploy'].map((w) => ({ workflowName: w, headSha: 'b'.repeat(40), status: 'completed', conclusion: conclusao, createdAt: '2026-10-28T10:00:00Z' })));
    const argv = ['propor', 'p-aceite', '--resposta', 'Já podes ordenar por renda.', '--nota', 'Ordenei.', '--commit', 'aaaaaaa', '--dev'];
    const nao = corre(argv, db, { git, gh: () => ({ status: 0, stdout: corridas('failure'), stderr: '' }) });
    assert.equal(nao.codigo, 1);
    assert.match(nao.err, /ainda não está publicado no dev, e não mexi no p-aceite\. POR PUBLICAR: falhou: Testes em bbbbbbb \(failure\)/);
    assert.equal(um(db, 'p-aceite').draft_reply, null);
    const sim = corre(argv, db, { git, gh: () => ({ status: 0, stdout: corridas('success'), stderr: '' }) });
    assert.equal(sim.codigo, 0, sim.err);
    assert.match(sim.out, /A pessoa só a recebe quando alguém da equipa a enviar no back office/);
    const l = um(db, 'p-aceite');
    assert.deepEqual([l.draft_reply, l.status, l.reply], ['Já podes ordenar por renda.', 'resolucao', null]);
    assert.match(db.prepare("SELECT texto FROM ticket_msgs WHERE ticket_id = 'p-aceite' ORDER BY at DESC").get().texto, /Ordenei\.\n\nCommit: aaaaaaa/);
  });

  test('concluir um erro, «já está concluído», e o pedido manda para o propor; reabrir devolve-o', () => {
    const db = base();
    const c = corre(['concluir', 'e-muitos', '--nota', HOSTIL, '--sem-commit', '--local'], db);
    assert.equal(c.codigo, 0, c.err);
    assert.match(c.out, /^Erro e-muitos concluído na base isolada \(--local\)\. Se voltar a acontecer, reabre-se sozinho\.$/m);
    assert.equal(um(db, 'e-muitos').status, 'concluido');
    assert.equal(corre(['concluir', 'e-muitos', '--nota', 'x', '--sem-commit', '--local'], db).out, 'O erro e-muitos já está concluído.\n');
    const p = corre(['concluir', 'p-recusado', '--nota', 'x', '--sem-commit', '--local'], db);
    assert.equal(p.codigo, 1);
    assert.match(p.err, /Usa o propor/);
    const r = corre(['reabrir', 'e-muitos', '--local'], db);
    assert.equal(r.codigo, 0, r.err);
    assert.equal(um(db, 'e-muitos').status, 'criado');
    assert.deepEqual(rasto(db, 'e-muitos').map((x) => x.acao), ['pedido.fechar', 'pedido.reabrir']);
    const n = corre(['nota', 'zz', '--texto', 'x', '--local'], db);
    assert.match(n.err, /Não há nenhum ticket com o id zz na base isolada/);
  });

  test('listar: as secções, a decisão com as alterações, a proposta e o fio', () => {
    const db = base();
    corre(['propor', 'p-aceite-res', '--resposta', 'Já se vê.', '--nota', 'Corrigi.', '--sem-commit', '--local'], db);
    const r = corre(['listar', '--local'], db);
    assert.equal(r.codigo, 0, r.err);
    const t = r.out;
    assert.match(t, /^### Base isolada \(--local\): 2 pedidos aceites, 1 pedido por decidir, 4 erros \(5 recebidos, 2 em resolução\)\./);
    const marcas = ['#### Pedidos aceites (2)', '== p-aceite ·', '== p-aceite-res', '#### Pedidos por decidir (1): NÃO se mexe neles', '== p-decidir',
      '#### Erros (4)', '== e-muitos', '== e-recente', '== e-n', '== e-res'].map((x) => t.indexOf(x));
    assert.ok(marcas.every((v, i) => v > -1 && (i === 0 || v > marcas[i - 1])), 'pela ordem: ' + marcas.join(', '));
    assert.match(t, /Decisão: aceite por Dina a [\d/]+, [\d:]+, com alterações:\n {2}Só no separador Casas\.\n {2}\(As alterações de quem aceitou mandam mais do que o texto do pedido\.\)/);
    assert.match(t, /Decisão: por decidir \(espera pelo Aceitar no back office; não se mexe nele\)\./);
    assert.match(t, /Resposta proposta, por enviar \(desde [\d/]+, [\d:]+\):\n {2}Já se vê\./);
    assert.match(t, /Fio: \(1\)\n {2}[\d/]+, [\d:]+ · nota · Dina:\n {4}Aceite com alterações: Só no separador Casas\./);
    assert.match(t, /== e-n · erro do servidor · recebido\nAssunto: D1 caiu\nQuem: Sem utilizador\n/);
    assert.match(t, /Ocorrências: 2 · 3 pessoas/);
    assert.doesNotMatch(t, /e-fim|p-recusado/, 'sem --todos, nada de concluídos');
    const todos = corre(['listar', '--local', '--todos'], db).out;
    assert.ok(todos.indexOf('#### Concluídos (2)') > todos.indexOf('== e-res'));
    assert.match(todos, /Decisão: recusado por Rui Equipa a /);
    assert.match(todos, /Última resposta à pessoa:\n {2}Não faz sentido para já\./);
  });

  test('listar sem a 0024 não é erro: o recurso, com o aviso no cabeçalho; e o --json', () => {
    const db = sem0024(base());
    const r = corre(['listar', '--prod'], db);
    assert.equal(r.codigo, 0, r.err);
    assert.match(r.out, /^### Produção \(gestor-imobiliario\): 0 pedidos aceites, 3 pedidos por decidir, 4 erros/);
    assert.match(r.out, /Atenção: a aceitação dos pedidos ainda não chegou a esta base \(falta a migração 0024, que só chega à produção com o «promove»\): nenhum pedido de pessoa se implementa aqui/);
    assert.match(r.out, /Decisão: a aceitação ainda não chegou a esta base/);
    const j = JSON.parse(corre(['listar', '--prod', '--json'], db).out);
    assert.deepEqual(Object.keys(j), ['prod']);
    assert.equal(j.prod.sem0024, true);
    assert.equal(j.prod.tickets.length, 7);
    assert.ok(!('accepted_at' in j.prod.tickets[0]));
    const ambos = JSON.parse(corre(['listar', '--json'], base()).out);
    assert.deepEqual(Object.keys(ambos), ['prod', 'dev']);
    assert.equal(ambos.dev.tickets[0].accepted_changes, 'Só no separador Casas.');
    assert.deepEqual(ambos.dev.tickets[0].msgs.map((m) => m.id), ['m1']);
    assert.match(quandoChega0024(alvoDe('dev')), /próximo deploy do ramo dev/);
  });
});

describe('o texto de um ticket', () => {
  test('o tipo, o estado, a decisão, e a conta apagada', () => {
    assert.deepEqual([{ category: 'user', kind: 'problema' }, { category: 'user', kind: 'sugestao' }, { category: 'client' }, { category: 'server' }, { category: 'infra' }, { category: 'seguranca' }].map(tipoLegivel),
      ['pedido de uma pessoa: problema', 'pedido de uma pessoa: sugestão', 'erro do browser', 'erro do servidor', 'erro da infraestrutura', 'erro de segurança']);
    assert.deepEqual(['criado', 'resolucao', 'concluido', 'outro'].map(estadoLegivel), ['recebido', 'em resolução', 'concluído', 'outro']);
    assert.match(decisaoLegivel({ accepted_at: 1, refused_at: null, accepted_by_nome: 'Dina', accepted_changes: null })[0], /aceite por Dina a .*, sem alterações\./);
    const t = textoDoTicket({ id: 'x', category: 'user', kind: 'problema', status: 'criado', subject: 'a\nb', user_id: 'U9', autor_nome: 'Ana', autor_email: 'a@x.pt', autor_apagado: 5,
      created_at: Date.UTC(2026, 9, 28, 13, 5), updated_at: Date.UTC(2026, 9, 28, 13, 5), body: 'um\ndois', accepted_at: null, refused_at: null, assignee_nome: 'Rita', msgs: [] });
    assert.match(t, /^== x · pedido de uma pessoa: problema · recebido\nAssunto: a b\nQuem: Ana <a@x\.pt> \(conta apagada\)\nQuando: criado a 28\/10\/2026, 13:05\n/);
    assert.match(t, /^Tomado por: Rita$/m);
    assert.match(t, /^Descrição:\n {2}um\n {2}dois$/m);
    assert.match(t, /^Fio: nenhum$/m);
    assert.doesNotMatch(t, /Ocorrências/);
  });

  test('o cabeçalho: o plural certo, o vazio e o teto', () => {
    const a = alvoDe('dev');
    const e = (id) => ({ id, category: 'client', status: 'criado', n: 1, pessoas: 1, msgs: [] });
    assert.match(textoDoAlvo(a, [e('a')]), /^### Dev \(gestor-imobiliario-dev\): 0 pedidos aceites, 0 pedidos por decidir, 1 erro \(1 recebido, 0 em resolução\)\./);
    assert.match(textoDoAlvo(a, [e('a'), e('b')]), /2 erros \(2 recebidos, 0 em resolução\)/);
    assert.equal(textoDoAlvo(a, []), '### Dev (gestor-imobiliario-dev): não há tickets abertos.');
    assert.match(textoDoAlvo(a, Array.from({ length: 200 }, (x, i) => e('t' + i))), /\(Só os primeiros 200\.\)/);
    assert.deepEqual(juntaFio([{ id: 'a', accepted_at: null }], [{ ticket_id: 'a', id: 'm' }, { ticket_id: 'b', id: 'n' }], false), [{ id: 'a', msgs: [{ ticket_id: 'a', id: 'm' }] }]);
  });
});

describe('o publicado', () => {
  const H1 = '1'.repeat(40), H2 = '2'.repeat(40), H3 = '3'.repeat(40);
  // Recebe: w — o workflow; h — o headSha; estado — 'success', 'failure', 'in_progress', …; at — a hora.
  // Devolve: uma corrida como o gh run list a dá.
  const c = (w, h, estado, at) => ({ workflowName: w, headSha: h, status: estado === 'in_progress' || estado === 'queued' ? estado : 'completed',
    conclusion: estado === 'in_progress' || estado === 'queued' ? '' : estado, createdAt: '2026-10-28T' + at + ':00Z' });
  const todos = () => true;

  test('verde: Testes e Deploy no mesmo headSha, e a Interface mais recente verde (ou nenhuma)', () => {
    const v = avaliaCorridas([c('Testes', H1, 'success', '10:00'), c('Deploy', H1, 'success', '10:00')], todos);
    assert.equal(v.publicado, true);
    assert.match(v.razao, /a Interface não correu/);
    assert.equal(avaliaCorridas([c('Testes', H1, 'success', '10:00'), c('Deploy', H1, 'success', '10:00'), c('Interface', H1, 'success', '10:00')], todos).publicado, true);
  });

  test('em curso, falhou, sem Deploy e sem corrida', () => {
    assert.match(avaliaCorridas([c('Testes', H1, 'success', '10:00'), c('Deploy', H1, 'in_progress', '10:00')], todos).razao, /^em curso: Deploy em 1111111\./);
    assert.match(avaliaCorridas([c('Testes', H1, 'failure', '10:00'), c('Deploy', H1, 'success', '10:00')], todos).razao, /^falhou: Testes em 1111111 \(failure\)\./);
    assert.match(avaliaCorridas([c('Testes', H1, 'success', '10:00'), c('Deploy', H1, 'skipped', '10:00')], todos).razao, /^sem Deploy:/);
    assert.match(avaliaCorridas([c('Testes', H1, 'success', '10:00')], todos).razao, /^sem Deploy:/);
    assert.match(avaliaCorridas([c('Testes', H1, 'success', '10:00')], () => false).razao, /^sem corrida:/);
    assert.match(avaliaCorridas([], todos).razao, /^sem corrida:/);
  });

  test('a Interface que conta é a mais recente: antiga falhada e nova verde passa; nova falhada ou em curso não', () => {
    const base0 = [c('Testes', H1, 'success', '10:00'), c('Deploy', H1, 'success', '10:00'), c('Interface', H1, 'failure', '10:00')];
    assert.match(avaliaCorridas(base0, todos).razao, /^falhou a Interface em 1111111 \(failure\)/);
    assert.equal(avaliaCorridas(base0.concat([c('Interface', H2, 'success', '11:00')]), todos).publicado, true);
    assert.match(avaliaCorridas(base0.concat([c('Interface', H2, 'in_progress', '11:00')]), todos).razao, /^em curso: Interface em 2222222/);
    const novaFalhada = [c('Testes', H1, 'success', '10:00'), c('Deploy', H1, 'success', '10:00'), c('Interface', H1, 'success', '10:00'), c('Interface', H3, 'failure', '12:00')];
    assert.equal(avaliaCorridas(novaFalhada, todos).publicado, false);
  });

  test('só contam os headSha que contêm o commit, e em cada um a corrida mais recente', () => {
    const corr = [c('Testes', H1, 'success', '10:00'), c('Deploy', H1, 'success', '10:00'), c('Testes', H2, 'failure', '09:00'), c('Deploy', H2, 'failure', '09:00')];
    assert.equal(avaliaCorridas(corr, (h) => h === H2).publicado, false, 'o H1 não contém o commit');
    assert.equal(avaliaCorridas(corr, todos).publicado, true, 'um headSha verde chega');
    assert.equal(avaliaCorridas([c('Testes', H1, 'failure', '09:00'), c('Testes', H1, 'success', '10:00'), c('Deploy', H1, 'success', '10:00')], todos).publicado, true, 'a repetição verde manda');
  });

  test('produção pela etiqueta publicado, com o git simulado', () => {
    // Recebe: o que o merge-base responde, e se o fetch e a etiqueta existem.
    // Devolve: { git, chamadas }.
    const simula = (ancestral, { fetch = 0, etiqueta = true, conhece = true } = {}) => {
      const chamadas = [];
      const git = (args) => {
        chamadas.push(args.join(' '));
        if (args[0] === 'fetch') return { status: fetch, stdout: '', stderr: 'fatal: unable to access' };
        if (args[0] === 'rev-parse') {
          if (args[3].startsWith('refs/tags/publicado')) return etiqueta ? { status: 0, stdout: H3 + '\n', stderr: '' } : { status: 1, stdout: '', stderr: '' };
          return conhece ? { status: 0, stdout: H1.toUpperCase() + '\r\n', stderr: '' } : { status: 1, stdout: '', stderr: '' };
        }
        return { status: ancestral ? 0 : 1, stdout: '', stderr: '' };
      };
      return { git, chamadas };
    };
    const s = simula(true);
    const p = publicadoProd('1111111', s.git);
    assert.deepEqual([p.publicado, p.sha], [true, H1]);
    assert.deepEqual(s.chamadas, ['fetch origin --tags --force --quiet', 'rev-parse --verify --quiet 1111111^{commit}',
      'rev-parse --verify --quiet refs/tags/publicado^{commit}', 'merge-base --is-ancestor ' + H1 + ' ' + H3]);
    assert.match(publicadoProd('1111111', simula(false).git).razao, /^ainda não está em produção: a etiqueta publicado está em 3333333/);
    assert.match(publicadoProd('1111111', simula(true, { conhece: false }).git).razao, /^fora do ramo:/);
    assert.match(publicadoProd('1111111', simula(true, { etiqueta: false }).git).razao, /etiqueta publicado não existe/);
    assert.throws(() => publicadoProd('1111111', simula(true, { fetch: 128 }).git), /git fetch das etiquetas falhou: fatal: unable to access/);
  });

  test('dev pelo CI: no origin/dev, o gh com o sha inteiro e a sessão', () => {
    const chamadas = [];
    // Recebe: args do git. Devolve: o resultado simulado (o commit H1 está no origin/dev e em H2).
    const git = (args) => {
      chamadas.push(args.join(' '));
      if (args[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
      if (args[0] === 'rev-parse') return { status: 0, stdout: (args[3].startsWith('refs/remotes/origin/dev') ? H2 : H1) + '\n', stderr: '' };
      return { status: args[3] === H3 ? 1 : 0, stdout: '', stderr: '' };
    };
    const gh = () => ({ status: 0, stdout: JSON.stringify([c('Testes', H2, 'success', '10:00'), c('Deploy', H2, 'success', '10:00'), c('Interface', H3, 'failure', '11:00')]), stderr: '' });
    const p = publicadoDev('1111111', { git, gh });
    assert.equal(p.publicado, true, p.razao + ' (a Interface falhada está num headSha que não tem o commit)');
    assert.ok(chamadas.includes('fetch origin dev --quiet'));
    assert.ok(chamadas.includes('merge-base --is-ancestor ' + H1 + ' ' + H2), 'compara com o sha inteiro');
    const fora = (args) => (args[0] === 'merge-base' ? { status: 1, stdout: '', stderr: '' } : git(args));
    assert.match(publicadoDev('1111111', { git: fora, gh }).razao, /^fora do ramo: o commit não está no origin\/dev \(falta o push\)/);
    const semSessao = () => ({ status: 1, stdout: '', stderr: 'To get started with GitHub CLI, please run:  gh auth login' });
    assert.throws(() => publicadoDev('1111111', { git, gh: semSessao }), /gh auth login/);
    assert.match(erroDoGh('dial tcp: lookup api.github.com: no such host'), /rede/);
  });
});

describe('o wrangler', () => {
  test('os erros ficam claros: 7403, sessão, rede, coluna e o resto', () => {
    const passageiro = '✘ [ERROR] A request to the Cloudflare API (/accounts/x/d1/database/y/query) failed.\n\n  The given account is not valid or is not authorized [code: 7403]';
    assert.equal(erroDoWrangler(passageiro).tipo, 'passageiro');
    assert.equal(ehPassageiro(passageiro), true);
    assert.equal(ehPassageiro('no such column: x at offset 7403'), false);
    assert.equal(erroDoWrangler('You are not authenticated. Please run `wrangler login`.').tipo, 'sem-sessao');
    assert.equal(erroDoWrangler('TypeError: fetch failed').tipo, 'rede');
    const col = erroDoWrangler('{"error":{"text":"no such column: draft_reply: SQLITE_ERROR"}}');
    assert.deepEqual([col.tipo, col.coluna], ['coluna', 'draft_reply']);
    assert.match(col.mensagem, /falta a migração 0024/);
    assert.match(erroDoWrangler('no such column: outra').mensagem, /falta uma migração/);
    assert.equal(erroDoWrangler('\u001b[31m✘ [ERROR] A base não responde.\n\n🪵  Logs were written to "x.log"').mensagem, 'O wrangler falhou: A base não responde.');
  });

  test('o 7403 repete-se até três vezes; o resto não se repete', () => {
    const pausas = [];
    // Recebe: respostas — os resultados por ordem. Devolve: o correr e quantas vezes correu.
    const sequencia = (respostas) => { let i = 0; const f = () => respostas[Math.min(i++, respostas.length - 1)]; f.vezes = () => i; return f; };
    const mau = { status: 1, stdout: '', stderr: 'The given account is not valid or is not authorized [code: 7403]' };
    const bom = { status: 0, stdout: '[]', stderr: '' };
    const s1 = sequencia([mau, mau, bom]);
    const r1 = comRepeticao(s1, { dormir: (ms) => pausas.push(ms) });
    assert.deepEqual([r1.status, r1.tentativas, s1.vezes()], [0, 3, 3]);
    assert.deepEqual(pausas, [1500, 3000]);
    const s2 = sequencia([mau]);
    assert.deepEqual([comRepeticao(s2, { dormir: () => {} }).tentativas, s2.vezes()], [4, 4], 'a primeira e mais três');
    const s3 = sequencia([{ status: 1, stdout: '', stderr: 'fetch failed' }]);
    assert.equal(comRepeticao(s3, { dormir: () => {} }).tentativas, 1);
  });

  test('o JSON do wrangler lê-se mesmo com avisos à volta', () => {
    assert.deepEqual(lerJsonDoWrangler('[{"results":[]}]'), [{ results: [] }]);
    assert.deepEqual(lerJsonDoWrangler('aviso qualquer\n[{"results":[{"a":1}]}]'), [{ results: [{ a: 1 }] }]);
    assert.equal(lerJsonDoWrangler(''), undefined);
    assert.equal(lerJsonDoWrangler('sem json'), undefined);
  });
});
