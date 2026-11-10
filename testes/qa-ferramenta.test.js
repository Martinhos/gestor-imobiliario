// A ferramenta dos tickets de QA (scripts/qa.mjs), com que o Claude lê e fecha
// os tickets do dev: lê os argumentos e recusa os que não conhece, só aceita a
// base do dev ou a isolada (nunca a produção), escapa o texto que entra no SQL
// (corrido contra o esquema verdadeiro, em SQLite), escreve o listar com tudo
// o que é preciso para resolver um ticket sem abrir a app (a fila de A fazer e
// Auto Tests, ou todas as colunas do kanban), leva os tickets às colunas
// (comecar, resolver, reabrir, mover) com o cartão a seguir, e monta a nota do
// resolver com e sem commit.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { baseDeTeste } from './lib/bd.js';
import { passosDaSincronizacao, sqlEmTexto, cartaoDoTicketQa } from '../worker/src/lib/kanban.js';
import {
  lerArgumentos, confereAlvo, alvoDe, ALVOS, configDoDev, cita, sqlListar, sqlUm, sqlNaColuna, sqlColunas, colunaDaLinha, sqlDoCartao,
  resolverColuna, ticketFechado, colunaDoStatus, estadoLegivel,
  notaDaResolucao, contextoLegivel, ticketDaLinha, textoDoTicket, textoDaLista, tipoDaImagem, erroDoWrangler,
  lerJsonDoWrangler, mensagemPorMigrar, ErroQa, COMANDOS, USO,
} from '../scripts/qa.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/qa.mjs', import.meta.url));

// Recebe: argv — os argumentos (array).
// Devolve: o ErroQa que lerArgumentos lançou (falha o teste se não lançar).
function recusa(argv) {
  try { lerArgumentos(argv); } catch (e) { assert.ok(e instanceof ErroQa, 'ErroQa: ' + e); return e; }
  assert.fail('devia recusar ' + JSON.stringify(argv));
}

describe('os argumentos', () => {
  test('listar: por omissão o dev, só os por resolver e em texto', () => {
    assert.deepEqual(lerArgumentos(['listar']), { comando: 'listar', id: null, ids: null, coluna: null, local: false, todos: false, json: false, para: null, nota: null, commit: null });
    const o = lerArgumentos(['listar', '--local', '--todos', '--json']);
    assert.equal(o.local && o.todos && o.json, true);
  });

  test('resolver aceita --nota valor e --nota=valor, apara a nota e põe o sha em minúsculas', () => {
    const a = lerArgumentos(['resolver', 'abc-123', '--nota', '  Corrigido o encaixe.  ', '--commit', 'ABCDEF1', '--local']);
    assert.equal(a.id, 'abc-123');
    assert.equal(a.nota, 'Corrigido o encaixe.');
    assert.equal(a.commit, 'abcdef1');
    assert.equal(a.local, true);
    const b = lerArgumentos(['resolver', 'abc', '--nota=com = no meio']);
    assert.equal(b.nota, 'com = no meio');
    assert.equal(b.commit, null);
  });

  test('imagem leva o id e a pasta; reabrir só o id', () => {
    assert.equal(lerArgumentos(['imagem', 'x1', '--para', 'C:/tmp/qa']).para, 'C:/tmp/qa');
    assert.equal(lerArgumentos(['reabrir', 'x1']).id, 'x1');
  });

  test('comecar leva um ou mais ids, sem repetidos, e o --local', () => {
    const um = lerArgumentos(['comecar', 'x1']);
    assert.deepEqual([um.id, um.ids, um.local], ['x1', ['x1'], false]);
    const varios = lerArgumentos(['comecar', 'x1', 'x2', '--local', 'x1', 'x3']);
    assert.deepEqual([varios.id, varios.ids, varios.local], ['x1', ['x1', 'x2', 'x3'], true]);
  });

  test('mover leva o id e a coluna (o nome pode vir em várias palavras) e o --local', () => {
    assert.ok(COMANDOS.includes('mover') && /mover <id> <coluna>/.test(USO));
    const a = lerArgumentos(['mover', 'x1', 'para-depois']);
    assert.deepEqual([a.id, a.coluna, a.local], ['x1', 'para-depois', false]);
    const b = lerArgumentos(['mover', 'x1', 'Para', 'depois', '--local']);
    assert.deepEqual([b.id, b.coluna, b.local], ['x1', 'Para depois', true]);
    assert.equal(lerArgumentos(['mover', 'x1', 'Para depois']).coluna, 'Para depois');
  });

  test('recusa o que não conhece, com o código 2 e o uso', () => {
    for (const argv of [['mover'], ['mover', 'x1'], ['mover', 'x1', 'a', '--todos'], ['mover', "x' --", 'a-fazer'], [],['apagar', 'x'], ['remover', 'x'], ['listar', '--loca'], ['listar', 'a mais'], ['imagem'],
      ['resolver', 'x'], ['resolver', 'x', '--nota', '   '], ['resolver', 'x', '--nota'], ['resolver', 'x', '--nota', 'n', '--commit', 'nao-e-sha'],
      ['reabrir', 'x', '--todos'], ['comecar'], ['comecar', 'x', '--nota', 'n'], ['comecar', 'x', "y' --"], ['listar', '--json=sim'], ['imagem', "x' OR 1=1 --"], ['resolver', 'x', '--nota', 'a'.repeat(4001)]]) {
      const e = recusa(argv);
      assert.equal(e.codigo, 2, JSON.stringify(argv));
      assert.match(e.message, /Uso:|id|sha|caracteres/);
    }
  });

  test('a linha de comandos sai com 2 e o uso, sem pilha e sem chamar o wrangler', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'listar', '--loca'], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^qa: O comando listar não aceita a opção --loca\./);
    assert.match(r.stderr, /node scripts\/qa\.mjs resolver <id> --nota/);
    assert.doesNotMatch(r.stderr, /\bat \S+:\d+/);
    assert.equal(r.stdout, '');
  });
});

describe('a base: o dev ou a isolada, nunca a produção', () => {
  test('aceita só os dois alvos, tal e qual', () => {
    assert.deepEqual(confereAlvo(alvoDe(false)), { local: false, base: 'gestor-imobiliario-dev', bucket: 'gestor-imobiliario-dev' });
    assert.deepEqual(confereAlvo(alvoDe(true)), { local: true, base: 'gestor-imobiliario', bucket: 'gestor-imobiliario' });
  });

  test('recusa a produção e qualquer mistura', () => {
    const maus = [
      { local: false, base: 'gestor-imobiliario', bucket: 'gestor-imobiliario' },     // a produção
      { local: false, base: 'gestor-imobiliario-dev', bucket: 'gestor-imobiliario' }, // o bucket da produção
      { local: false, base: 'gestor-imobiliario', bucket: 'gestor-imobiliario-dev' },
      { local: true, base: 'gestor-imobiliario-dev', bucket: 'gestor-imobiliario' },
      { base: 'gestor-imobiliario-dev', bucket: 'gestor-imobiliario-dev' },             // sem dizer onde
      null,
    ];
    for (const a of maus) assert.throws(() => confereAlvo(a), /produção não se toca/, JSON.stringify(a));
  });

  test('o alvo é uma cópia: mexer-lhe não muda os alvos permitidos', () => {
    const a = alvoDe(false);
    a.base = 'gestor-imobiliario';
    assert.equal(ALVOS.remoto.base, 'gestor-imobiliario-dev');
    assert.throws(() => confereAlvo(a));
  });

  test('o wrangler.toml temporário só tem o dev, com o id verdadeiro', () => {
    const t = configDoDev('73c6d3d4-edaa-4801-b577-5079776e1f6d');
    assert.match(t, /database_name = "gestor-imobiliario-dev"/);
    assert.match(t, /database_id = "73c6d3d4-edaa-4801-b577-5079776e1f6d"/);
    assert.match(t, /bucket_name = "gestor-imobiliario-dev"/);
    assert.doesNotMatch(t, /"gestor-imobiliario"/);
    assert.doesNotMatch(t, /PLACEHOLDER/);
    assert.throws(() => configDoDev(''), ErroQa);
    assert.throws(() => configDoDev('PLACEHOLDER_D1_DEV_ID'), ErroQa);
  });
});

describe('o SQL, corrido contra o esquema verdadeiro', () => {
  const HOSTIL = "Não abre; DROP TABLE qa_tickets; --\nsegunda linha com 'plicas', \"aspas\", /* e */ \\ barra\u0000";

  // Recebe: nada.
  // Devolve: a base em memória com duas contas e tickets em várias colunas
  // (um removido, um com o status antigo 'aberto' e um com um status desconhecido).
  function base() {
    const db = baseDeTeste()._db;
    db.exec(`INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES ('U1', 'maria@x.pt', 'Maria Costa', 'h', 's', 1), ('U2', 'rui@x.pt', 'Rui', 'h', 's', 1);
      INSERT INTO qa_tickets (id, user_id, body, severity, context, image_key, status, created_at, updated_at) VALUES
        ('t-velho', 'U1', 'velho', 'detalhe', NULL, NULL, 'a-fazer', 100, 100),
        ('t-novo', 'U2', 'novo', 'bloqueia', '{"versao":43}', 'qa/t-novo', 'a-fazer', 300, 300),
        ('t-fora', 'U1', 'removido', NULL, NULL, NULL, 'a-fazer', 400, 400),
        ('t-curso', 'U1', 'em curso', 'incomoda', NULL, NULL, 'auto-tests', 200, 200),
        ('t-depois', 'U2', 'para depois', 'bloqueia', NULL, NULL, 'para-depois', 700, 700),
        ('t-antigo', 'U1', 'antigo', NULL, NULL, NULL, 'aberto', 150, 150),
        ('t-estranho', 'U1', 'estranho', NULL, NULL, NULL, 'coisa-rara', 160, 160);
      UPDATE qa_tickets SET removed_at = 500 WHERE id = 't-fora';
      INSERT INTO qa_tickets (id, user_id, body, status, resolution, resolved_at, created_at, updated_at) VALUES
        ('t-r1', 'U1', 'r1', 'human-tests', 'feito', 250, 50, 250), ('t-r2', 'U2', 'r2', 'concluido', 'feito', 260, 60, 260);`);
    return db;
  }
  // Recebe: db, id. Devolve: a linha do ticket.
  const um = (db, id) => db.prepare(sqlUm(id)).get();

  test('cita dobra as plicas, tira o nulo e escreve NULL e números', () => {
    assert.equal(cita("it's"), "'it''s'");
    assert.equal(cita(null), 'NULL');
    assert.equal(cita(undefined), 'NULL');
    assert.equal(cita(12.9), '12');
    assert.equal(cita(NaN), 'NULL');
    assert.equal(cita('a\u0000b'), "'ab'");
  });

  test('listar: por omissão só a fila (A fazer e Auto Tests, e o status antigo); Para depois e o resto de fora', () => {
    const db = base();
    // por gravidade (bloqueia, incomoda, detalhe, sem gravidade); o autor vem junto
    const fila = db.prepare(sqlListar(false)).all();
    assert.deepEqual(fila.map((l) => l.id), ['t-novo', 't-curso', 't-velho', 't-antigo']);
    assert.equal(fila[0].autor_nome, 'Rui');
    assert.equal(fila[0].autor_email, 'rui@x.pt');
    assert.equal(um(db, 't-fora').removed_at, 500);
  });

  test('listar --todos: todas as colunas (resolvidos pela resolução), até a de status desconhecido, sem os removidos', () => {
    const db = base();
    assert.deepEqual(db.prepare(sqlListar(true)).all().map((l) => l.id),
      ['t-depois', 't-novo', 't-r2', 't-r1', 't-curso', 't-velho', 't-estranho', 't-antigo']);
  });

  test('listar: a chave do cartão (KAN-N) quando o ticket tem cartão, e só quando tem', () => {
    const db = base();
    const ev = { tipo: 'qa', id: 't-novo', estado: 'a-fazer', agora: 1000, novo: { uuid: 'c-novo', ...cartaoDoTicketQa({ id: 't-novo', body: 'novo', severity: 'bloqueia' }) } };
    db.exec(passosDaSincronizacao(ev).map(sqlEmTexto).join(';\n'));
    const por = Object.fromEntries(db.prepare(sqlListar(true)).all().map((l) => [l.id, ticketDaLinha(l).cartao]));
    assert.match(por['t-novo'], /^KAN-\d+$/);
    assert.equal(por['t-velho'], null);
    // um cartão removido não conta
    db.exec("UPDATE kanban_cartoes SET removed_at = 5 WHERE id = 'c-novo'");
    assert.equal(ticketDaLinha(db.prepare(sqlListar(false)).all().find((l) => l.id === 't-novo')).cartao, null);
  });

  test('as colunas do kanban, pela ordem do quadro', () => {
    const db = base();
    const cs = db.prepare(sqlColunas()).all().map(colunaDaLinha);
    assert.deepEqual(cs.map((c) => c.id), ['a-fazer', 'auto-tests', 'human-tests', 'concluido', 'para-depois']);
    assert.deepEqual(cs.map((c) => c.fim), [false, false, false, true, false]);
    assert.equal(cs[4].nome, 'Para depois');
  });

  test('resolver (Human Tests) guarda a nota hostil tal e qual, sem partir a instrução', () => {
    const db = base();
    const nota = notaDaResolucao(HOSTIL, 'abc1234');
    db.exec(sqlNaColuna('t-novo', 'human-tests', 900, nota));
    const l = um(db, 't-novo');
    assert.equal(l.status, 'human-tests');
    assert.equal(l.resolution, nota.replace(/\u0000/g, ''));
    assert.equal(l.resolved_at, 900);
    assert.equal(db.prepare("SELECT updated_at FROM qa_tickets WHERE id = 't-novo'").get().updated_at, 900);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM qa_tickets').get().n, 9);
    // um id hostil também fica dentro das plicas (a linha de comandos já o recusa antes)
    db.exec(sqlNaColuna("x' OR '1'='1", 'human-tests', 1, 'nada'));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM qa_tickets WHERE resolution = 'nada'").get().n, 0);
    // e não mexe nos removidos
    db.exec(sqlNaColuna('t-fora', 'human-tests', 1, 'nada'));
    assert.equal(um(db, 't-fora').status, 'a-fazer');
  });

  test('comecar leva um ticket a Auto Tests e mexe só no status e no updated_at; os removidos ficam', () => {
    const db = base();
    db.exec(sqlNaColuna('t-velho', 'auto-tests', 700));
    assert.equal(um(db, 't-velho').status, 'auto-tests');
    assert.equal(db.prepare("SELECT updated_at FROM qa_tickets WHERE id = 't-velho'").get().updated_at, 700);
    db.exec(sqlNaColuna('t-fora', 'auto-tests', 700));
    assert.equal(um(db, 't-fora').status, 'a-fazer', 'nem um removido');
    db.exec(sqlNaColuna("x' OR '1'='1", 'auto-tests', 700));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM qa_tickets WHERE status = 'auto-tests'").get().n, 2);
  });

  test('reabrir volta a A fazer, larga o resolved_at e guarda a resolução', () => {
    const db = base();
    db.exec(sqlNaColuna('t-r1', 'a-fazer', 999));
    const l = um(db, 't-r1');
    assert.equal(l.status, 'a-fazer');
    assert.equal(l.resolved_at, null);
    assert.equal(l.resolution, 'feito');
  });

  test('mover: o resolved_at acompanha a coluna (posto ao chegar a Concluído, tirado ao ir para Para depois)', () => {
    const db = base();
    db.exec(sqlNaColuna('t-velho', 'concluido', 800));
    assert.deepEqual({ ...um(db, 't-velho') }.resolved_at, 800);
    db.exec(sqlNaColuna('t-velho', 'para-depois', 900));
    const l = um(db, 't-velho');
    assert.equal(l.status, 'para-depois');
    assert.equal(l.resolved_at, null);
    // de Human Tests para Concluído mantém o resolved_at de quando foi resolvido
    db.exec(sqlNaColuna('t-r1', 'concluido', 950));
    assert.equal(um(db, 't-r1').resolved_at, 250);
  });

  test('o ticket primeiro e o cartão depois: um ticket antigo sem cartão ganha-o ao mover, e mover o cartão à mão leva o ticket', () => {
    const db = base();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 0);
    db.exec(sqlNaColuna('t-antigo', 'para-depois', 1000));
    assert.equal(um(db, 't-antigo').status, 'para-depois', 'o ticket já mudou antes de se tocar no cartão');
    const novo = { uuid: 'c-antigo', ...cartaoDoTicketQa({ id: 't-antigo', body: 'antigo', severity: null }) };
    db.exec(sqlDoCartao({ id: 't-antigo', estado: 'para-depois', agora: 1000, novo }));
    const k = db.prepare("SELECT coluna_id, origem_tipo, origem_id FROM kanban_cartoes WHERE id = 'c-antigo'").get();
    assert.deepEqual({ ...k }, { coluna_id: 'para-depois', origem_tipo: 'qa', origem_id: 't-antigo' });
    assert.equal(um(db, 't-antigo').status, 'para-depois');
    // repetir o mover não duplica o cartão
    db.exec(sqlNaColuna('t-antigo', 'para-depois', 1100));
    db.exec(sqlDoCartao({ id: 't-antigo', estado: 'para-depois', agora: 1100, novo: { ...novo, uuid: 'outro' } }));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM kanban_cartoes').get().n, 1);
    // o outro sentido, o gatilho da 0029: mover o cartão à mão leva o ticket
    db.exec("UPDATE kanban_cartoes SET coluna_id = 'human-tests', updated_at = 1200 WHERE id = 'c-antigo'");
    const l = um(db, 't-antigo');
    assert.equal(l.status, 'human-tests');
    assert.equal(l.resolved_at, 1200);
  });
});

describe('as colunas: o nome ou o id, o que fecha e o que se pega', () => {
  const COLUNAS = [
    { id: 'a-fazer', nome: 'A fazer', ordem: 1, fim: false }, { id: 'auto-tests', nome: 'Auto Tests', ordem: 2, fim: false },
    { id: 'human-tests', nome: 'Human Tests', ordem: 3, fim: false }, { id: 'concluido', nome: 'Concluído', ordem: 4, fim: true },
    { id: 'para-depois', nome: 'Para depois', ordem: 5, fim: false },
    { id: '3f2a9c10-aaaa-4bbb-8ccc-123456789abc', nome: 'Em revisão', ordem: 6, fim: true },
  ];

  test('resolverColuna aceita o id e o nome, sem caixa nem acentos, e as colunas novas do master', () => {
    for (const t of ['para-depois', 'para depois', 'Para depois', 'PARA-DEPOIS', ' para  depois ']) assert.equal(resolverColuna(t, COLUNAS).id, 'para-depois', t);
    for (const t of ['concluido', 'Concluído', 'CONCLUÍDO']) assert.equal(resolverColuna(t, COLUNAS).id, 'concluido', t);
    assert.equal(resolverColuna('auto tests', COLUNAS).id, 'auto-tests');
    assert.equal(resolverColuna('em revisao', COLUNAS).id, '3f2a9c10-aaaa-4bbb-8ccc-123456789abc');
    assert.equal(resolverColuna('3F2A9C10-AAAA-4BBB-8CCC-123456789ABC', COLUNAS).nome, 'Em revisão');
  });

  test('resolverColuna recusa a que não existe, a listar as que existem', () => {
    for (const t of ['inexistente', '', '   ', "x' OR 1=1 --"]) {
      assert.throws(() => resolverColuna(t, COLUNAS), (e) => e instanceof ErroQa && e.codigo === 2
        && /Não há nenhuma coluna/.test(e.message) && /A fazer \(a-fazer\), Auto Tests \(auto-tests\)/.test(e.message) && /Para depois \(para-depois\)/.test(e.message), t);
    }
  });

  test('ticketFechado: Human Tests e as colunas de fim não se pegam (reabre-se primeiro); o resto sim', () => {
    const f = (status) => ticketFechado({ status }, COLUNAS);
    for (const s of ['human-tests', 'concluido', 'resolvido', '3f2a9c10-aaaa-4bbb-8ccc-123456789abc']) assert.equal(f(s), true, s);
    for (const s of ['a-fazer', 'auto-tests', 'para-depois', 'aberto', 'em_resolucao', 'coisa-rara']) assert.equal(f(s), false, s);
  });

  test('colunaDoStatus leva os status antigos às colunas da migração 0029', () => {
    assert.deepEqual(['aberto', 'em_resolucao', 'resolvido', 'para-depois', 'x'].map(colunaDoStatus), ['a-fazer', 'auto-tests', 'concluido', 'para-depois', 'x']);
  });
});

describe('a nota do resolver', () => {
  test('com commit, numa linha própria; sem commit, só a nota aparada', () => {
    assert.equal(notaDaResolucao('  A pílula já cola à borda.  ', 'abc1234'), 'A pílula já cola à borda.\n\nCommit: abc1234');
    assert.equal(notaDaResolucao('Não se reproduz na v43.', null), 'Não se reproduz na v43.');
  });
});

describe('o texto do listar', () => {
  const CTX = {
    ecra: { tab: 'properties', pagina: 'Imóveis', ficha: { tipo: 'casa', id: 'h1' }, modal: 'Nova renda', hash: '#casas' },
    versao: 43, ambiente: 'dev', janela: { w: 390, h: 844, dpr: 3 }, tema: { escolhido: 'auto', escuro: true, forcado: true },
    agente: 'Mozilla/5.0 SamsungBrowser/27.0', ponteiro: 'touch', rasto: ['go properties', 'abrir casa h1'],
    quando: '2026-10-28T13:03:00.000Z', extra: { a: 1 },
  };
  const LINHA = {
    id: 'aaaa-1111', user_id: 'U1', body: 'O botão Guardar não responde.\nSó no telemóvel.', severity: 'bloqueia',
    context: JSON.stringify(CTX), image_key: 'qa/aaaa-1111', status: 'aberto', resolution: null, resolved_at: null,
    created_at: Date.UTC(2026, 9, 28, 13, 5), updated_at: Date.UTC(2026, 9, 28, 13, 5), autor_nome: 'Maria Costa', autor_email: 'maria@x.pt',
  };

  test('ticketDaLinha dá a forma do GET /api/qa', () => {
    const t = ticketDaLinha(LINHA);
    assert.deepEqual(t.context, CTX);
    assert.equal(t.imagem, true);
    assert.deepEqual(t.autor, { id: 'U1', nome: 'Maria Costa', email: 'maria@x.pt', discord: null });
    assert.deepEqual(ticketDaLinha(Object.assign({}, LINHA, { discord_id: '4242', discord_nome: 'Martinho' })).autor.discord, { id: '4242', nome: 'Martinho' });
    assert.equal(ticketDaLinha(Object.assign({}, LINHA, { severity: 'estranha', image_key: null })).severity, null);
  });

  test('o contexto legível diz onde estava, sem inventar e sem perder o que não conhece', () => {
    const l = contextoLegivel(CTX).join('\n');
    assert.match(l, /Ecrã: separador «properties», página «Imóveis», ficha casa h1, janela aberta «Nova renda», endereço #casas/);
    assert.match(l, /Versão: 43 \(ambiente dev\)/);
    assert.match(l, /Janela: 390×844 px a 3x/);
    assert.match(l, /Tema: escolhido «auto», a ver escuro, escurecido à força pelo browser/);
    assert.match(l, /Ponteiro: touch/);
    assert.match(l, /Agente: Mozilla\/5\.0 SamsungBrowser/);
    assert.match(l, /No aparelho: 28\/10\/2026, 13:03/);
    assert.match(l, /Rasto \(do mais antigo para o último\):\n {2}- go properties\n {2}- abrir casa h1/);
    assert.match(l, /extra: \{"a":1\}/);
    assert.deepEqual(contextoLegivel({ versao: 43 }), ['Versão: 43']);
    assert.deepEqual(contextoLegivel(null), []);
    assert.match(contextoLegivel('{partido')[0], /Por ler/);
  });

  test('um ticket por extenso: id, gravidade, quem, quando, imagem, a descrição inteira', () => {
    const t = textoDoTicket(ticketDaLinha(LINHA), true);
    assert.match(t, /^== aaaa-1111 · BLOQUEIA · novo$/m);
    assert.match(textoDoTicket(ticketDaLinha(Object.assign({}, LINHA, { status: 'em_resolucao' }))), /^== aaaa-1111 · BLOQUEIA · em resolução$/m);
    assert.match(textoDoTicket(ticketDaLinha(Object.assign({}, LINHA, { status: 'para-depois', cartao: 12 })), false, [{ id: 'para-depois', nome: 'Para depois' }]), /^== aaaa-1111 · BLOQUEIA · Para depois · KAN-12$/m);
    assert.deepEqual(['aberto', 'em_resolucao', 'resolvido', 'outro'].map((x) => estadoLegivel(x)), ['novo', 'em resolução', 'resolvido', 'outro']);
    assert.equal(estadoLegivel('para-depois'), 'Para depois');
    assert.equal(estadoLegivel('uuid-1', [{ id: 'uuid-1', nome: 'Em revisão' }]), 'Em revisão');
    assert.match(t, /^Quem: Maria Costa <maria@x\.pt>$/m);
    assert.match(t, /^Quando: 28\/10\/2026, 13:05$/m);
    assert.match(t, /^Imagem: sim — node scripts\/qa\.mjs imagem aaaa-1111 --local$/m);
    assert.match(t, /^Descrição:\n {2}O botão Guardar não responde\.\n {2}Só no telemóvel\.$/m);
    assert.match(t, /^ {2}Ecrã: separador «properties»/m);
    const sem = textoDoTicket(ticketDaLinha(Object.assign({}, LINHA, { severity: null, context: null, image_key: null, autor_nome: null, autor_email: null })), false);
    assert.match(sem, /· sem gravidade ·/);
    assert.match(sem, /^Gravidade: nenhuma escolhida$/m);
    assert.match(sem, /^Imagem: não$/m);
    assert.match(sem, /^Contexto: nenhum$/m);
    assert.match(sem, /^Quem: conta desconhecida \(U1\)$/m);
    const deTeste = (o) => textoDoTicket(ticketDaLinha(Object.assign({}, LINHA, o)), false);
    assert.match(deTeste({ discord_id: '4242', discord_nome: 'Martinho' }), /^Quem: Martinho \(Discord 4242\), com uma conta de teste$/m,
      'numa conta de teste, quem escreveu é a conta do Discord que pediu o /test');
    assert.match(deTeste({ discord_id: '4242', discord_nome: null, autor_nome: null }), /^Quem: Discord 4242, com uma conta de teste$/m);
    assert.match(deTeste({ user_id: 'equipa:4242', discord_id: '4242', discord_nome: 'Dina', autor_nome: null }), /^Quem: Dina \(Discord 4242\), no back office$/m,
      'um ticket do back office é da pessoa da equipa');
  });

  test('reaberto mostra a resolução anterior; resolvido mostra a resolução e a data', () => {
    const reaberto = textoDoTicket(ticketDaLinha(Object.assign({}, LINHA, { resolution: 'Tentei X.\n\nCommit: abc1234' })));
    assert.match(reaberto, /Resolução anterior \(foi reaberto — o que já se tentou\):\n {2}Tentei X\.\n {2}\n {2}Commit: abc1234/);
    const feito = textoDoTicket(ticketDaLinha(Object.assign({}, LINHA, { status: 'resolvido', resolution: 'Feito.', resolved_at: Date.UTC(2026, 9, 28, 15, 0) })));
    assert.match(feito, /^Resolvido a 28\/10\/2026, 15:00:\n {2}Feito\.$/m);
  });

  test('a lista: a fila por colunas com as contagens, as colunas do quadro com --todos, os status antigos e desconhecidos e o vazio', () => {
    const COLS = [
      { id: 'a-fazer', nome: 'A fazer', fim: false }, { id: 'auto-tests', nome: 'Auto Tests', fim: false },
      { id: 'human-tests', nome: 'Human Tests', fim: false }, { id: 'concluido', nome: 'Concluído', fim: true },
      { id: 'para-depois', nome: 'Para depois', fim: false },
    ];
    const t = (id, status, o) => ticketDaLinha(Object.assign({}, LINHA, { id, status }, o || {}));
    const fila = textoDaLista([t('n1', 'a-fazer', { cartao: 7 }), t('e1', 'auto-tests')], { colunas: COLS });
    assert.match(fila, /^Tickets de QA no dev \(gestor-imobiliario-dev\): A fazer 1, Auto Tests 1\. Só a fila de trabalho; `--todos` mostra/);
    assert.ok(fila.indexOf('#### A fazer (1)') < fila.indexOf('== n1') && fila.indexOf('== n1') < fila.indexOf('#### Auto Tests (1)'));
    assert.match(fila, /^== n1 · BLOQUEIA · A fazer · KAN-7$/m);
    assert.match(fila, /^== e1 · BLOQUEIA · Auto Tests$/m);
    // a fila vazia numa das colunas continua no cabeçalho
    assert.match(textoDaLista([t('n1', 'a-fazer')], { colunas: COLS }), /: A fazer 1, Auto Tests 0\./);
    // com --todos, pela ordem do quadro (Para depois é a última), e os que não têm coluna ao fim, com o próprio status
    const todos = textoDaLista([t('p1', 'para-depois'), t('c1', 'concluido', { resolution: 'ok', resolved_at: 1 }), t('h1', 'human-tests', { resolution: 'ok', resolved_at: 1 }),
      t('e1', 'auto-tests'), t('n1', 'a-fazer'), t('x1', 'coisa-rara'), t('v1', 'aberto')], { todos: true, local: true, colunas: COLS });
    assert.match(todos, /^Tickets de QA na base isolada \(--local\): A fazer 2, Auto Tests 1, Human Tests 1, Concluído 1, Para depois 1, Estado «coisa-rara» 1\./);
    assert.doesNotMatch(todos, /Só a fila/);
    const marcas = ['#### A fazer (2)', '== n1', '== v1', '#### Auto Tests (1)', '== e1', '#### Human Tests (1)', '== h1', '#### Concluído (1)', '== c1',
      '#### Para depois (1)', '== p1', '#### Estado «coisa-rara» (1)', '== x1'].map((x) => todos.indexOf(x));
    assert.ok(marcas.every((v, i) => v > -1 && (i === 0 || v > marcas[i - 1])), 'pela ordem do quadro: ' + marcas.join(', '));
    assert.match(todos, /^== x1 · BLOQUEIA · coisa-rara$/m);
    assert.match(todos, /^Resolvido a .*:\n {2}ok$/m);
    // os abertos em grupos por gravidade, com quantos tem cada um
    const g = (id, severity) => t(id, 'a-fazer', { severity });
    const grupos = textoDaLista([g('b1', 'bloqueia'), g('b2', 'bloqueia'), g('d1', 'detalhe'), g('s1', null)], { colunas: COLS });
    const m2 = ['##### Bloqueia (2)', '== b1', '== b2', '##### Detalhe (1)', '== d1', '##### Sem gravidade (1)', '== s1'].map((x) => grupos.indexOf(x));
    assert.ok(m2.every((v, i) => v > -1 && (i === 0 || v > m2[i - 1])), 'pela ordem: ' + m2.join(', '));
    assert.doesNotMatch(grupos, /##### Incomoda/, 'um grupo vazio não aparece');
    assert.equal(textoDaLista([], {}), 'Não há tickets de QA por resolver (em A fazer nem em Auto Tests) no dev (gestor-imobiliario-dev).');
    assert.equal(textoDaLista([], { todos: true, local: true }), 'Não há tickets de QA na base isolada (--local).');
  });
});

describe('a imagem e o wrangler', () => {
  test('o tipo da imagem vem dos primeiros bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    assert.equal(tipoDaImagem(png), 'png');
    assert.equal(tipoDaImagem(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'jpg');
    assert.equal(tipoDaImagem(Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1')), 'webp');
    assert.equal(tipoDaImagem(Buffer.from('<html>nada</html>')), null);
    assert.equal(tipoDaImagem(Buffer.alloc(3)), null);
  });

  test('os erros do wrangler ficam claros', () => {
    assert.equal(erroDoWrangler('D1_ERROR: no such table: qa_tickets: SQLITE_ERROR').tipo, 'por-migrar');
    assert.equal(erroDoWrangler('You are not authenticated. Please run `wrangler login`.').tipo, 'sem-sessao');
    assert.equal(erroDoWrangler('TypeError: fetch failed').tipo, 'rede');
    assert.equal(erroDoWrangler('The specified key does not exist.').tipo, 'sem-objeto');
    const outro = erroDoWrangler('▲ [WARNING] aviso\nAlgo inesperado aconteceu');
    assert.equal(outro.tipo, 'outro');
    assert.match(outro.mensagem, /Algo inesperado aconteceu/);
    assert.equal(erroDoWrangler('\u001b[31m✘ [ERROR] A base não responde.\n\n🪵  Logs were written to "x.log"').mensagem, 'O wrangler falhou: A base não responde.');
    assert.match(mensagemPorMigrar(false), /próximo deploy/);
    assert.match(mensagemPorMigrar(true), /--persist-to \.wrangler\/state-revisao --file migrations\/0023_qa_tickets\.sql/);
  });

  test('o JSON do wrangler lê-se mesmo com avisos à volta', () => {
    assert.deepEqual(lerJsonDoWrangler('[{"results":[]}]'), [{ results: [] }]);
    assert.deepEqual(lerJsonDoWrangler('aviso qualquer\n[{"results":[{"a":1}]}]'), [{ results: [{ a: 1 }] }]);
    assert.equal(lerJsonDoWrangler(''), undefined);
    assert.equal(lerJsonDoWrangler('sem json'), undefined);
  });
});
