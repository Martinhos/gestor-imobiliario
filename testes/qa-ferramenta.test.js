// A ferramenta dos tickets de QA (scripts/qa.mjs), com que o Claude lê e fecha
// os tickets do dev: lê os argumentos e recusa os que não conhece, só aceita a
// base do dev ou a isolada (nunca a produção), escapa o texto que entra no SQL
// (corrido contra o esquema verdadeiro, em SQLite), escreve o listar com tudo
// o que é preciso para resolver um ticket sem abrir a app, e monta a nota do
// resolver com e sem commit.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { baseDeTeste } from './lib/bd.js';
import {
  lerArgumentos, confereAlvo, alvoDe, ALVOS, configDoDev, cita, sqlListar, sqlUm, sqlResolver, sqlReabrir,
  notaDaResolucao, contextoLegivel, ticketDaLinha, textoDoTicket, textoDaLista, tipoDaImagem, erroDoWrangler,
  lerJsonDoWrangler, mensagemPorMigrar, ErroQa,
} from '../scripts/qa.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/qa.mjs', import.meta.url));

// Recebe: argv — os argumentos (array).
// Devolve: o ErroQa que lerArgumentos lançou (falha o teste se não lançar).
function recusa(argv) {
  try { lerArgumentos(argv); } catch (e) { assert.ok(e instanceof ErroQa, 'ErroQa: ' + e); return e; }
  assert.fail('devia recusar ' + JSON.stringify(argv));
}

describe('os argumentos', () => {
  test('listar: por omissão o dev, só os abertos e em texto', () => {
    assert.deepEqual(lerArgumentos(['listar']), { comando: 'listar', id: null, local: false, todos: false, json: false, para: null, nota: null, commit: null });
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

  test('recusa o que não conhece, com o código 2 e o uso', () => {
    for (const argv of [[], ['apagar', 'x'], ['remover', 'x'], ['listar', '--loca'], ['listar', 'a mais'], ['imagem'],
      ['resolver', 'x'], ['resolver', 'x', '--nota', '   '], ['resolver', 'x', '--nota'], ['resolver', 'x', '--nota', 'n', '--commit', 'nao-e-sha'],
      ['reabrir', 'x', '--todos'], ['listar', '--json=sim'], ['imagem', "x' OR 1=1 --"], ['resolver', 'x', '--nota', 'a'.repeat(4001)]]) {
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
  // Devolve: a base em memória com duas contas e três tickets (um removido).
  function base() {
    const db = baseDeTeste()._db;
    db.exec(`INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES ('U1', 'maria@x.pt', 'Maria Costa', 'h', 's', 1), ('U2', 'rui@x.pt', 'Rui', 'h', 's', 1);
      INSERT INTO qa_tickets (id, user_id, body, severity, context, image_key, status, created_at, updated_at) VALUES
        ('t-velho', 'U1', 'velho', 'detalhe', NULL, NULL, 'aberto', 100, 100),
        ('t-novo', 'U2', 'novo', 'bloqueia', '{"versao":43}', 'qa/t-novo', 'aberto', 300, 300),
        ('t-fora', 'U1', 'removido', NULL, NULL, NULL, 'aberto', 400, 400);
      UPDATE qa_tickets SET removed_at = 500 WHERE id = 't-fora';
      INSERT INTO qa_tickets (id, user_id, body, status, resolution, resolved_at, created_at, updated_at) VALUES
        ('t-r1', 'U1', 'r1', 'resolvido', 'feito', 250, 50, 250), ('t-r2', 'U2', 'r2', 'resolvido', 'feito', 260, 60, 260);`);
    return db;
  }

  test('cita dobra as plicas, tira o nulo e escreve NULL e números', () => {
    assert.equal(cita("it's"), "'it''s'");
    assert.equal(cita(null), 'NULL');
    assert.equal(cita(undefined), 'NULL');
    assert.equal(cita(12.9), '12');
    assert.equal(cita(NaN), 'NULL');
    assert.equal(cita('a\u0000b'), "'ab'");
  });

  test('listar: sem os removidos, abertos do mais recente, depois os resolvidos pela resolução, com o autor', () => {
    const db = base();
    assert.deepEqual(db.prepare(sqlListar(false)).all().map((l) => l.id), ['t-novo', 't-velho']);
    const todos = db.prepare(sqlListar(true)).all();
    assert.deepEqual(todos.map((l) => l.id), ['t-novo', 't-velho', 't-r2', 't-r1']);
    assert.equal(todos[0].autor_nome, 'Rui');
    assert.equal(todos[0].autor_email, 'rui@x.pt');
    assert.equal(db.prepare(sqlUm('t-fora')).get().removed_at, 500);
  });

  test('listar: os abertos por gravidade (bloqueia, incomoda, detalhe, sem) e em cada uma o mais recente primeiro', () => {
    const db = base();
    db.exec(`INSERT INTO qa_tickets (id, user_id, body, severity, status, created_at, updated_at) VALUES
      ('t-bv', 'U1', 'b velho', 'bloqueia', 'aberto', 10, 10), ('t-i', 'U1', 'i', 'incomoda', 'aberto', 20, 20),
      ('t-sn', 'U1', 's novo', NULL, 'aberto', 900, 900), ('t-sv', 'U1', 's velho', NULL, 'aberto', 5, 5);`);
    assert.deepEqual(db.prepare(sqlListar(false)).all().map((l) => l.id), ['t-novo', 't-bv', 't-i', 't-velho', 't-sn', 't-sv']);
    assert.deepEqual(db.prepare(sqlListar(true)).all().map((l) => l.id).slice(6), ['t-r2', 't-r1'], 'os resolvidos continuam pela resolução');
  });

  test('resolver guarda a nota hostil tal e qual, sem partir a instrução', () => {
    const db = base();
    const nota = notaDaResolucao(HOSTIL, 'abc1234');
    db.exec(sqlResolver('t-novo', nota, 900));
    const l = db.prepare(sqlUm('t-novo')).get();
    assert.equal(l.status, 'resolvido');
    assert.equal(l.resolution, nota.replace(/\u0000/g, ''));
    assert.equal(l.resolved_at, 900);
    assert.equal(db.prepare("SELECT updated_at FROM qa_tickets WHERE id = 't-novo'").get().updated_at, 900);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM qa_tickets').get().n, 5);
    // um id hostil também fica dentro das plicas (a linha de comandos já o recusa antes)
    db.exec(sqlResolver("x' OR '1'='1", 'nada', 1));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM qa_tickets WHERE resolution = 'nada'").get().n, 0);
    // e não mexe nos removidos
    db.exec(sqlResolver('t-fora', 'nada', 1));
    assert.equal(db.prepare(sqlUm('t-fora')).get().status, 'aberto');
  });

  test('reabrir volta a aberto, larga o resolved_at e guarda a resolução', () => {
    const db = base();
    db.exec(sqlReabrir('t-r1', 999));
    const l = db.prepare(sqlUm('t-r1')).get();
    assert.equal(l.status, 'aberto');
    assert.equal(l.resolved_at, null);
    assert.equal(l.resolution, 'feito');
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
    assert.match(t, /^== aaaa-1111 · BLOQUEIA · aberto$/m);
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
  });

  test('reaberto mostra a resolução anterior; resolvido mostra a resolução e a data', () => {
    const reaberto = textoDoTicket(ticketDaLinha(Object.assign({}, LINHA, { resolution: 'Tentei X.\n\nCommit: abc1234' })));
    assert.match(reaberto, /Resolução anterior \(foi reaberto — o que já se tentou\):\n {2}Tentei X\.\n {2}\n {2}Commit: abc1234/);
    const feito = textoDoTicket(ticketDaLinha(Object.assign({}, LINHA, { status: 'resolvido', resolution: 'Feito.', resolved_at: Date.UTC(2026, 9, 28, 15, 0) })));
    assert.match(feito, /^Resolvido a 28\/10\/2026, 15:00:\n {2}Feito\.$/m);
  });

  test('a lista: contagens com o plural certo, secções e o vazio', () => {
    const abertos = [ticketDaLinha(LINHA)];
    const r = ticketDaLinha(Object.assign({}, LINHA, { id: 'bbbb', status: 'resolvido', resolution: 'ok', resolved_at: 1 }));
    assert.match(textoDaLista(abertos, {}), /^Tickets de QA no dev \(gestor-imobiliario-dev\): 1 aberto\./);
    const todos = textoDaLista(abertos.concat(r, r), { todos: true, local: true });
    assert.match(todos, /^Tickets de QA na base isolada \(--local\): 1 aberto, 2 resolvidos\./);
    assert.ok(todos.indexOf('#### Abertos (1)') < todos.indexOf('#### Resolvidos (2)'));
    // os abertos em grupos por gravidade, com quantos tem cada um
    const g = (id, severity) => ticketDaLinha(Object.assign({}, LINHA, { id, severity }));
    const grupos = textoDaLista([g('b1', 'bloqueia'), g('b2', 'bloqueia'), g('d1', 'detalhe'), g('s1', null)], {});
    const marcas = ['##### Bloqueia (2)', '== b1', '== b2', '##### Detalhe (1)', '== d1', '##### Sem gravidade (1)', '== s1'].map((x) => grupos.indexOf(x));
    assert.ok(marcas.every((v, i) => v > -1 && (i === 0 || v > marcas[i - 1])), 'pela ordem: ' + marcas.join(', '));
    assert.doesNotMatch(grupos, /##### Incomoda/, 'um grupo vazio não aparece');
    assert.equal(textoDaLista([], {}), 'Não há tickets de QA abertos no dev (gestor-imobiliario-dev).');
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
