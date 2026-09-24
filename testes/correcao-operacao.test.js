// Correções da operação: a cópia da base, o bot do Discord, o back office,
// a documentação servida, o correio e a vigia dos limites. Cada teste diz a
// regra; o achado da avaliação de 2026-09-14 que a pediu vai num comentário
// por cima. Corre o SQL a sério contra o esquema a sério (testes/lib/bd.js).

import { test, describe, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, generateKeyPairSync, sign } from 'node:crypto';
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { baseDeTeste, kvFalso, r2Falso } from './lib/bd.js';
import { copiar, tabelasDaBase } from '../worker/src/salvaguarda.js';

const RAIZ = new URL('../', import.meta.url);
const ler = (p) => readFileSync(new URL(p, RAIZ), 'utf8');
const fetchReal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchReal; });

/* ------------------------------------------------------------ a cópia */

// Enche a base com gente bastante para a cópia precisar de três páginas,
// com os textos que costumam partir um restauro: plicas, quebras, acentos.
async function baseCheia(n) {
  const DB = baseDeTeste();
  for (let i = 0; i < n; i++) {
    const id = 'U' + String(i).padStart(7, '0');
    await DB.prepare(
      'INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, id.toLowerCase() + '@x.pt', i % 7 ? 'Pessoa ' + i : "D'Ávila\ncom quebra", 'h', 's', 1000 + i).run();
  }
  await DB.prepare(
    `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, created_at, updated_at)
     VALUES ('T1', 'U0000001', 'problema', 'Ajuda', 'Não sei «isto»', 'criado', 'user', 1, 1)`
  ).run();
  return DB;
}

// Lê a cópia do R2 de faz-de-conta como quem a vai restaurar.
async function registosDa(FILES, chave) {
  const bytes = FILES.m.get(chave);
  const texto = Buffer.from(await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer()).toString('utf8');
  return texto.split('\n').filter(Boolean).map((l) => JSON.parse(l)).slice(1);
}

describe('a cópia da base', () => {
  // achado A.5-1
  test('pagina pelo rowid: nenhuma página usa OFFSET e as que seguem a primeira são uma procura na chave', async () => {
    const base = await baseCheia(1201);
    const vistas = [];
    const DB = Object.assign({}, base, { prepare: (sql) => { vistas.push(sql); return base.prepare(sql); } });
    await copiar({ DB, FILES: r2Falso() });
    const paginas = vistas.filter((s) => /FROM "users"/.test(s));
    assert.equal(paginas.length, 3, '1201 linhas são três páginas de 500');
    paginas.forEach((s) => assert.doesNotMatch(s, /OFFSET/i, 'um OFFSET lê e deita fora as linhas de antes: ' + s));
    const seguintes = paginas.filter((s) => /rowid > \?/.test(s));
    assert.equal(seguintes.length, 2, 'as páginas depois da primeira partem do cursor');
    for (const s of seguintes) {
      const plano = base._db.prepare('EXPLAIN QUERY PLAN ' + s).all(0, 500).map((x) => x.detail).join(' | ');
      assert.match(plano, /SEARCH users USING INTEGER PRIMARY KEY \(rowid>\?\)/,
        'lê só o que devolve, e não a tabela desde o princípio: ' + plano);
    }
  });

  test('uma linha apagada a meio da cópia não empurra a página seguinte: tudo o que lá estava sai uma vez', async () => {
    const base = await baseCheia(1201);
    const todos = base._db.prepare('SELECT id FROM users ORDER BY rowid').all().map((x) => x.id);
    let primeira = true;
    const DB = Object.assign({}, base, {
      prepare(sql) {
        const q = base.prepare(sql);
        if (!/FROM "users"/.test(sql)) return q;
        const all = q.all;
        q.all = async () => {
          const r = await all();
          // alguém apaga a sua conta depois de a primeira página ter saído
          if (primeira) { primeira = false; base._db.exec("DELETE FROM users WHERE id = 'U0000003'"); }
          return r;
        };
        return q;
      },
    });
    const FILES = r2Falso();
    const r = await copiar({ DB, FILES });
    const ids = (await registosDa(FILES, r.chave)).filter((x) => x.t === 'users').map((x) => x.r.id);
    assert.equal(new Set(ids).size, ids.length, 'nenhuma linha repetida');
    assert.deepEqual([...ids].sort(), [...todos].sort(), 'nenhuma linha saltada — a apagada já tinha saído na primeira página');
  });

  test('a cópia leva as colunas da tabela e só essas, e o restaurar.js repõe a base tal e qual', async () => {
    const base = await baseCheia(1201);
    const FILES = r2Falso();
    const r = await copiar({ DB: base, FILES });
    const registos = await registosDa(FILES, r.chave);
    assert.equal(r.linhas, registos.length);
    const colunas = Object.keys(base._db.prepare('SELECT * FROM users LIMIT 1').get());
    registos.filter((x) => x.t === 'users').forEach((x) => assert.deepEqual(Object.keys(x.r), colunas));

    // o ciclo inteiro: o ficheiro do R2 → scripts/restaurar.js → uma base vazia
    const pasta = mkdtempSync(join(tmpdir(), 'copia-'));
    try {
      const ficheiro = join(pasta, 'copia.ndjson.gz');
      writeFileSync(ficheiro, FILES.m.get(r.chave));
      const sql = execFileSync(process.execPath,
        [fileURLToPath(new URL('scripts/restaurar.js', RAIZ)), ficheiro], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const nova = baseDeTeste();
      nova._db.exec('BEGIN;\n' + sql + '\nCOMMIT;');
      for (const t of await tabelasDaBase({ DB: base })) {
        const antes = base._db.prepare('SELECT * FROM "' + t + '" ORDER BY rowid').all();
        const depois = nova._db.prepare('SELECT * FROM "' + t + '" ORDER BY rowid').all();
        assert.deepEqual(depois, antes, 'a tabela ' + t + ' volta como estava');
      }
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  test('nenhuma migração cria uma tabela WITHOUT ROWID: a cópia pagina pelo rowid', () => {
    const b = baseDeTeste();
    const semRowid = b._db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND sql LIKE '%WITHOUT ROWID%'").all();
    assert.deepEqual(semRowid, [], 'uma tabela sem rowid faz a cópia rebentar: ou tem rowid, ou a cópia aprende a paginá-la');
  });
});

/* ---------------------------------------------------- o bot do Discord */

const PAR = generateKeyPairSync('ed25519');
const CHAVE_PUBLICA = PAR.publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex');

// o ambiente de um bot com papéis por pessoa: a1 é admin e dev ao mesmo tempo
function ambienteDoBot(extra) {
  return Object.assign({
    DB: baseDeTeste(), SESSIONS: kvFalso(), FILES: r2Falso(),
    DISCORD_PUBLIC_KEY: CHAVE_PUBLICA,
    DISCORD_MASTER: 'm1', DISCORD_ADMINS: 'a1', DISCORD_DEVS: 'a1 d1', DISCORD_SUPORTE: 's1',
  }, extra);
}

// Assina e entrega uma interação como o Discord a entregaria.
async function interagir(env, corpo, ctx) {
  const { handleInteraction } = await import('../worker/src/discord.js');
  const raw = JSON.stringify(corpo);
  const ts = String(Math.floor(Date.now() / 1000));
  const request = new Request('https://x.pt/api/discord', {
    method: 'POST', body: raw,
    headers: {
      'X-Signature-Ed25519': sign(null, Buffer.from(ts + raw), PAR.privateKey).toString('hex'),
      'X-Signature-Timestamp': ts,
    },
  });
  return handleInteraction(request, env, ctx || { waitUntil() {} });
}
const comando = (quem, nome, opcoes) => ({
  type: 2, guild_id: 'G1', application_id: 'app', token: 'tok',
  member: { user: { id: quem, username: quem }, roles: [] },
  data: { name: nome, options: Object.entries(opcoes || {}).map(([name, value]) => ({ name, value })) },
});
const botao = (quem, customId) => ({
  type: 3, guild_id: 'G1', application_id: 'app', token: 'tok',
  member: { user: { id: quem, username: quem }, roles: [] }, data: { custom_id: customId },
});
async function comPedido(env, extra) {
  const o = Object.assign({ id: 'T1', categoria: 'user', estado: 'criado' }, extra);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES ('U1', 'dona@x.pt', 'Dona', 'h', 's', 1)"
  ).run();
  await env.DB.prepare(
    `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, created_at, updated_at)
     VALUES (?, 'U1', 'problema', 'Ajuda com renda', 'Não sei', ?, ?, 1, 1)`
  ).bind(o.id, o.estado, o.categoria).run();
  return o.id;
}
const estadoDo = async (env, id) => (await env.DB.prepare('SELECT status FROM tickets WHERE id = ?').bind(id).first()).status;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

describe('o bot do Discord', () => {
  // achado A.5-3
  test('/responder e /fechar respondem ao Discord sem esperar pelo correio: o email segue depois, no waitUntil', async () => {
    for (const nome of ['responder', 'fechar']) {
      const env = ambienteDoBot({ RESEND_API_KEY: 'k' });
      await comPedido(env);
      const soltar = [];
      globalThis.fetch = () => new Promise((ok) => soltar.push(() => ok(new Response('{"id":"x"}', { status: 200 }))));
      const depois = [];
      const r = await Promise.race([
        interagir(env, comando('s1', nome, { id: 'T1', texto: 'Já está.' }), { waitUntil: (p) => depois.push(p) }),
        esperar(1500).then(() => 'pendurado'),
      ]);
      try {
        assert.notEqual(r, 'pendurado', '/' + nome + ' ficou à espera do Resend — o Discord corta aos 3 s');
        assert.match((await r.json()).data.embeds[0].footer.text, /T1/, 'a resposta traz o pedido');
        assert.equal(soltar.length, 1, 'o email saiu para o Resend');
        assert.ok(depois.length >= 1, 'e ficou entregue ao waitUntil');
      } finally {
        soltar.forEach((f) => f());
        await Promise.all(depois);
      }
    }
  });

  test('o correio tem prazo: um Resend pendurado desiste e diz porquê, em vez de segurar quem espera', async () => {
    const { enviarEmail } = await import('../worker/src/lib/correio.js');
    globalThis.fetch = (url, o) => new Promise((ok, falha) => {
      if (o && o.signal) o.signal.addEventListener('abort', () => falha(new Error('abortado')));
    });
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      let feito = false;
      const p = enviarEmail({ RESEND_API_KEY: 'k' }, { para: 'a@x.pt', assunto: 'x', texto: 'y' });
      p.then(() => { feito = true; });
      await new Promise((r) => setImmediate(r));
      mock.timers.tick(30000);
      for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
      assert.ok(feito, 'ao fim do prazo o envio desiste');
      const r = await p;
      assert.equal(r.enviado, false);
      assert.match(r.motivo, /prazo/);
    } finally {
      mock.timers.reset();
    }
  });

  // achado A.5-4a
  test('um erro num botão ou num menu vira mensagem e relato, não um 500 sem rasto', async () => {
    const env = ambienteDoBot();
    await comPedido(env);
    const base = env.DB;
    env.DB = Object.assign({}, base, {
      prepare(sql) {
        if (/SELECT category FROM tickets/.test(sql)) throw new Error('D1 em baixo');
        return base.prepare(sql);
      },
    });
    const depois = [];
    const r = await interagir(env, botao('s1', 'tk:fim:T1'), { waitUntil: (p) => depois.push(p) })
      .catch((e) => ({ rebentou: e }));
    assert.ok(!r.rebentou, 'rebentou para o Discord: ' + (r.rebentou && r.rebentou.message));
    assert.equal(r.status, 200);
    assert.match((await r.json()).data.content, /Correu mal: D1 em baixo/);
    await Promise.all(depois);
    const relato = await base.prepare("SELECT subject, body FROM tickets WHERE category = 'server'").first();
    assert.ok(relato && /D1 em baixo/.test(relato.subject + relato.body), 'quem programa fica a saber');

    // um clique que chega sem data nenhuma também não rebenta
    const r2 = await interagir(ambienteDoBot(), { type: 3, member: { user: { id: 's1' }, roles: [] } })
      .catch((e) => ({ rebentou: e }));
    assert.ok(!r2.rebentou, 'um clique sem data rebentava com TypeError');
    assert.equal(r2.status, 200);
  });

  // achado A.5-10
  test('o /pedido responde só a quem o correu: a ficha leva o email da pessoa', async () => {
    const env = ambienteDoBot();
    await comPedido(env);
    const r = await (await interagir(env, comando('s1', 'pedido', { id: 'T1' }))).json();
    assert.equal(r.data.flags, 64, 'efémera, como as outras respostas de comando');
    assert.ok(r.data.embeds[0].fields.some((f) => /dona@x\.pt/.test(f.value)), 'a ficha continua lá, para quem a pediu');
    assert.equal(r.data.components.length, 1, 'e os botões também');
    assert.doesNotMatch(ler('worker/src/discord.js'), /const publico = /, 'o ajudante das respostas públicas não tinha quem o chamasse');
  });

  // achado A.5-11
  test('os botões de um pedido passam pelas mesmas exceções que os comandos: sem /fechar, o «Concluir» também não', async () => {
    const env = ambienteDoBot();
    await comPedido(env);
    await env.SESSIONS.put('acesso:s1', JSON.stringify({ mais: [], menos: ['fechar'] }));
    const r = await (await interagir(env, botao('s1', 'tk:fim:T1'))).json();
    assert.match(r.data.content, /fechar/);
    assert.equal(await estadoDo(env, 'T1'), 'criado', 'o pedido não mudou');
    // o «Em resolução» é do /responder, que continua a ser dela
    const r2 = await (await interagir(env, botao('s1', 'tk:res:T1'))).json();
    assert.equal(r2.type, 7);
    assert.equal(await estadoDo(env, 'T1'), 'resolucao');
  });

  // achado A.5-14
  test('a recusa do /pedido diz os papéis por extenso, como as outras recusas', async () => {
    const env = ambienteDoBot();
    await comPedido(env);   // um pedido de pessoa, que nem o admin nem o dev veem
    const r = await (await interagir(env, comando('a1', 'pedido', { id: 'T1' }))).json();
    assert.match(r.data.content, /fora do papel \*\*admin \+ dev\*\*/);
    assert.doesNotMatch(r.data.content, /admin,dev/);
  });
});

/* ------------------------------------------------ a sessão de equipa */

describe('a sessão de equipa', () => {
  const MIN = 60000;
  const SARA = { discordId: 's9', nome: 'Sara', papel: 'suporte', papeis: ['suporte'], guildId: 'G1' };
  const ambienteDaEquipa = () => ({
    DB: baseDeTeste(), SESSIONS: kvFalso(), DISCORD_BOT_TOKEN: 'bot',
    DISCORD_MASTER: 'm1', DISCORD_SUPORTE: 'cargo-suporte',
  });
  async function entrar(env, quem) {
    const { criarBilhete, rotasEquipa } = await import('../worker/src/equipa.js');
    const b = await criarBilhete(env, quem);
    const f = new FormData();
    f.set('t', b.token);
    const r = await rotasEquipa({
      env, request: new Request('https://x.pt/equipa/entrar', { method: 'POST', body: f }),
      method: 'POST', path: '/equipa/entrar', url: new URL('https://x.pt/equipa/entrar'),
    });
    const cookie = r.headers.get('Set-Cookie').split(';')[0];
    return { cookie, token: cookie.split('=')[1] };
  }
  // envelhece a sessão como se tivesse passado este tempo desde a última verificação
  async function envelhecer(env, token, ms) {
    const k = 'equipa:' + token;
    const s = JSON.parse(await env.SESSIONS.get(k));
    s.desde -= ms;
    if (s.verificadoEm) s.verificadoEm -= ms;
    await env.SESSIONS.put(k, JSON.stringify(s));
  }
  const pedidoCom = (cookie) => new Request('https://x.pt/api/equipa/eu', { headers: { Cookie: cookie } });
  function discordResponde(estado, corpo) {
    const vistos = [];
    globalThis.fetch = async (url) => {
      vistos.push(String(url));
      if (estado === 'rede') throw new Error('sem rede');
      return new Response(JSON.stringify(corpo), { status: estado });
    };
    return vistos;
  }

  // achado A.5-5
  test('tirar o cargo no Discord tira o back office: passado o intervalo, a sessão volta a perguntar os cargos', async () => {
    const { getEquipa } = await import('../worker/src/equipa.js');
    const env = ambienteDaEquipa();
    const { cookie, token } = await entrar(env, SARA);
    const vistos = discordResponde(200, { roles: [] });   // o cargo foi-lhe tirado
    assert.ok(await getEquipa(env, pedidoCom(cookie)), 'acabada de entrar, vale sem perguntar');
    assert.equal(vistos.length, 0, 'e sem gastar uma chamada ao Discord');
    await envelhecer(env, token, 20 * MIN);
    assert.equal(await getEquipa(env, pedidoCom(cookie)), null, 'sem cargo, sem sessão');
    assert.match(vistos[0] || '', /guilds\/G1\/members\/s9$/);
    assert.equal(await env.SESSIONS.get('equipa:' + token), null, 'e a sessão morreu no KV');
    const rasto = await env.DB.prepare("SELECT acao FROM audit_log WHERE quem = 's9' ORDER BY id DESC").first();
    assert.equal(rasto.acao, 'equipa.sair', 'e fica no rasto porque saiu');
  });

  test('com o cargo ainda lá, a sessão continua com os papéis de agora, e não volta a perguntar logo', async () => {
    const { getEquipa } = await import('../worker/src/equipa.js');
    const env = Object.assign(ambienteDaEquipa(), { DISCORD_ADMINS: 'cargo-admin' });
    const { cookie, token } = await entrar(env, SARA);
    await envelhecer(env, token, 20 * MIN);
    discordResponde(200, { roles: ['cargo-suporte', 'cargo-admin'] });
    const eu = await getEquipa(env, pedidoCom(cookie));
    assert.deepEqual(eu.papeis, ['admin', 'suporte'], 'ganhou um cargo: soma-se');
    const vistos = discordResponde(200, { roles: [] });
    assert.ok(await getEquipa(env, pedidoCom(cookie)), 'acabada de verificar, vale');
    assert.equal(vistos.length, 0, 'sem voltar a perguntar');
  });

  test('quem saiu do servidor perde a sessão; um Discord em baixo não tranca a equipa fora', async () => {
    const { getEquipa } = await import('../worker/src/equipa.js');
    const env = ambienteDaEquipa();
    // uma sessão por resposta do Discord: depois de uma falha, a mesma sessão só volta a perguntar um minuto depois
    const casos = [
      ['rede', null, true, 'sem resposta do Discord, vale o que se sabia'],
      [500, {}, true, 'nem com um 500'],
      [404, { code: 10004, message: 'Unknown Guild' }, true, 'um servidor desconhecido não diz nada da pessoa'],
      [404, { code: 10007, message: 'Unknown Member' }, false, 'já não é membro do servidor'],
    ];
    for (const [estado, corpo, fica, porque] of casos) {
      const a = await entrar(env, SARA);
      await envelhecer(env, a.token, 20 * MIN);
      const vistos = discordResponde(estado, corpo);
      const eu = await getEquipa(env, pedidoCom(a.cookie));
      assert.equal(vistos.length, 1, 'perguntou ao Discord');
      assert.equal(!!eu, fica, porque);
      if (fica) {
        const outra = discordResponde(200, { roles: [] });
        assert.ok(await getEquipa(env, pedidoCom(a.cookie)), 'e não volta a perguntar logo a seguir');
        assert.equal(outra.length, 0);
      }
    }
  });

  test('o /entrar leva o servidor no bilhete, para a sessão saber a quem perguntar', async () => {
    const { verBilhete } = await import('../worker/src/equipa.js');
    const env = ambienteDoBot();
    const r = await (await interagir(env, comando('s1', 'entrar'))).json();
    const t = /t=([a-f0-9]{64})/.exec(r.data.content)[1];
    assert.equal((await verBilhete(env, t)).quem.guildId, 'G1');
  });
});

/* --------------------------------------------------------- o back office */

describe('o back office', () => {
  const ADMIN = { discordId: 'a1', nome: 'Ana', papel: 'admin', papeis: ['admin'] };
  const MASTER = { discordId: 'm1', nome: 'Mestre', papel: 'master', papeis: ['master'] };
  async function chamar(env, eu, method, path, corpo) {
    const { rotasEquipaApi } = await import('../worker/src/equipa-api.js');
    const url = new URL('https://x.pt' + path);
    const request = new Request(url, corpo
      ? { method, body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } }
      : { method });
    return rotasEquipaApi({ env, request, path, method, url, eu });
  }

  // achado A.5-2
  test('descarregar a base inteira é só do master; verificar a cópia continua de quem opera', async () => {
    const env = { DB: baseDeTeste(), SESSIONS: kvFalso(), FILES: r2Falso(), ENV_NAME: 'teste' };
    const r = await copiar(env);
    const dia = r.chave.slice(7, 17);
    const nega = await chamar(env, ADMIN, 'GET', '/api/equipa/operacao/copias/' + dia + '/descarregar');
    assert.equal(nega.status, 403, 'o admin vê o consumo e as cópias, não sai com as contas das pessoas');
    assert.equal((await chamar(env, ADMIN, 'GET', '/api/equipa/operacao/copias/' + dia + '/resumo')).status, 200, 'mas verifica-a');
    assert.equal((await chamar(env, MASTER, 'GET', '/api/equipa/operacao/copias/' + dia + '/descarregar')).status, 200);
    const rasto = (await env.DB.prepare("SELECT quem FROM audit_log WHERE acao = 'operacao.descarregar'").all()).results;
    assert.deepEqual(rasto.map((x) => x.quem), ['m1'], 'a recusa não chegou a descarregar nada');
  });

  /* A palavra-passe que o master define ou cria no back office grava-se como
     as da app (worker/src/auth.js:palavraNova): com PASS_PEPPER vai com a
     pimenta e fica pass_v 2. Gravada à parte, ficava na versão 1 numa linha
     que o login teria de refazer — ou, pior, a dizer 2 sem o ser. */
  test('as palavras-passe do back office gravam-se como as da app: com PASS_PEPPER, na versão 2', async () => {
    const { conferePalavra } = await import('../worker/src/auth.js');
    const env = { DB: baseDeTeste(), SESSIONS: kvFalso(), FILES: r2Falso(), ENV_NAME: 'teste', PASS_PEPPER: 'pimenta-de-teste' };
    const linha = async (id) => env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    const nova = await (await chamar(env, MASTER, 'POST', '/api/equipa/pessoas',
      { email: 'nova@x.pt', nome: 'Nova', password: 'Segredo#123', motivo: 'conta pedida por email' })).json();
    let u = await linha(nova.id);
    assert.equal(u.pass_v, 2, 'criada com pimenta');
    assert.deepEqual(await conferePalavra(env, 'Segredo#123', u), { ok: true, refazer: false });
    const r = await chamar(env, MASTER, 'POST', '/api/equipa/pessoas/' + nova.id + '/acao',
      { acao: 'password', valor: 'Outro#Segredo9', motivo: 'ficou trancada fora' });
    assert.equal(r.status, 200);
    u = await linha(nova.id);
    assert.equal(u.pass_v, 2, 'redefinida com pimenta');
    assert.deepEqual(await conferePalavra(env, 'Outro#Segredo9', u), { ok: true, refazer: false });
  });

  // achado A.5-12
  test('sem TESTE_CHAVE nem token do bot, o ambiente de teste recusa: não há chave pública que assine uma entrada', async () => {
    const { rotaTeste, ligacaoTeste } = await import('../worker/src/teste.js');
    const env = { DB: baseDeTeste(), SESSIONS: kvFalso(), FILES: r2Falso(), ENV_NAME: 'dev' };
    // a ligação que qualquer pessoa assinava com a constante que estava no código
    const exp = String(Date.now() + 600000);
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('teste:sem-chave'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(exp + ':0:0::1:'))).toString('hex');
    const url = new URL('https://dev.x.pt/t/entrar?exp=' + exp + '&dados=0&m=0&l=1&q=&sig=' + sig);
    const r = await rotaTeste({ env, url, request: new Request(url) });
    assert.equal(r.status, 503);
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first()).n, 0, 'nenhuma conta criada');
    await assert.rejects(ligacaoTeste(env, 'https://dev.x.pt', false), /TESTE_CHAVE/, 'e não se emite nenhuma');
    assert.equal((await chamar(env, MASTER, 'POST', '/api/equipa/operacao/teste', {})).status, 503, 'nem pelo back office');
  });

  // achado A.5-13
  test('sem nenhuma lista de papéis configurada, quem entra é master — e os comentários dizem o mesmo que o código', async () => {
    const { papeisDe } = await import('../worker/src/lib/papeis.js');
    assert.deepEqual(papeisDe({}, { member: { user: { id: 'x' }, roles: [] } }), ['master']);
    for (const f of ['worker/src/lib/papeis.js', 'wrangler.toml']) {
      const frases = [...ler(f).matchAll(/quem tiver acesso ao servidor[^.]*?é\s*(?:\/\/|#)?\s*([\wçã]+)/g)].map((m) => m[1]);
      assert.ok(frases.length, f + ' explica o arranque sem listas');
      frases.forEach((p) => assert.equal(p, 'master', f + ' diz «' + p + '»'));
    }
  });
});

/* -------------------------------------------------- a documentação servida */

describe('a documentação servida', () => {
  // achado A.5-6
  test('a página dos docs monta-se uma vez por versão dos docs, e não em cada pedido: é igual para toda a equipa', async () => {
    const { DOCS } = await import('../worker/src/docs-gerados.js');
    const { paginaDocs } = await import('../worker/src/docs-vista.js');
    const primeira = await paginaDocs().text();
    DOCS.capitulos.push({ id: 'marca', titulo: 'MARCA-DO-TESTE', itens: [] });
    try {
      const segunda = await paginaDocs().text();
      assert.ok(!segunda.includes('MARCA-DO-TESTE'), 'a segunda vez não voltou a montar a página');
      assert.equal(segunda, primeira);
    } finally {
      DOCS.capitulos.pop();
    }
  });
});

/* ---------------------------------------------- o guião do back office */

const assentar = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

// Corre o guião servido pelo /equipa numa página de faz-de-conta: um document
// com getElementById (e os dados da sessão que a página traz no seu
// <script type="application/json">), os ouvintes que o guião põe no
// document, um fetch que responde por rota, e alert, confirm e prompt que
// ficam registados. O guião é o do /equipa/guiao.js, como o browser o recebe.
async function correrGuiao(eu, responder) {
  const { paginaEquipa } = await import('../worker/src/equipa-vista.js');
  const { recursoDePagina } = await import('../worker/src/paginas-recursos.js');
  const html = await new Response(paginaEquipa(eu).body).text();
  const guiao = await (await recursoDePagina('/equipa/guiao.js', 'GET', async () => true)).text();
  const dados = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(html)[1];
  const els = { 'dados-equipa': { id: 'dados-equipa', textContent: dados } };
  const ouvintes = {};
  const registo = { prompt: [], alert: [], confirm: [], rotas: [] };
  const contexto = vm.createContext({
    document: {
      getElementById: (id) => els[id] || (els[id] = {
        id, innerHTML: '', value: '', showModal() { this.aberto = true; }, close() {}, querySelector: () => null,
      }),
      addEventListener(tipo, f) { (ouvintes[tipo] = ouvintes[tipo] || []).push(f); },
    },
    location: { reload() {} },
    fetch: async (rota, o) => {
      registo.rotas.push(String(rota));
      return new Response(JSON.stringify(responder(String(rota), o) || {}), { status: 200 });
    },
    alert: (m) => { registo.alert.push(String(m)); },
    confirm: (m) => { registo.confirm.push(String(m)); return true; },
    prompt: (m) => { registo.prompt.push(String(m)); return 'x'; },
    setTimeout, console,
  });
  vm.runInContext(guiao, contexto);
  await assentar();
  return { contexto, els, registo, html, ouvintes };
}
// As ações declaradas num pedaço de HTML: cada etiqueta com data-acao,
// data-enter ou data-mudar, com os atributos data-* desfeitos das entidades
// — o dataset que o browser entrega ao ouvinte.
function acoesNoHtml(html) {
  const desfaz = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return [...html.matchAll(/<[a-z]+\s[^>]*\bdata-(acao|enter|mudar)="[^"]*"[^>]*>/g)].map((m) => {
    const dataset = {};
    for (const a of m[0].matchAll(/\sdata-([a-z0-9]+)="([^"]*)"/g)) dataset[a[1]] = desfaz(a[2]);
    return { tipo: m[1], nome: dataset[m[1]], dataset };
  });
}
// Dispara o evento de uma ação pelos ouvintes que o guião pôs no document,
// com as funções da página trocadas por espiões.
// Recebe: g — o que o correrGuiao devolve; a — uma ação do acoesNoHtml; nomes — as funções a espiar.
// Devolve: as chamadas que as funções espiadas receberam.
function correrAcao(g, a, nomes) {
  const chamadas = [];
  const antes = {};
  const evento = { acao: 'click', enter: 'keydown', mudar: 'change' }[a.tipo];
  const alvo = {
    dataset: a.dataset, value: '',
    getAttribute: (k) => (k.startsWith('data-') && k.slice(5) in a.dataset ? a.dataset[k.slice(5)] : null),
    closest: (sel) => (sel === '[data-' + a.tipo + ']' ? alvo : null),
  };
  nomes.forEach((n) => { antes[n] = g.contexto[n]; g.contexto[n] = (...x) => { chamadas.push([n, ...x]); }; });
  try {
    (g.ouvintes[evento] || []).forEach((f) => f({ target: alvo, key: 'Enter' }));
  } finally {
    nomes.forEach((n) => { g.contexto[n] = antes[n]; });
  }
  return chamadas;
}

describe('o guião do back office', () => {
  const MESTRE = { nome: 'Mestre', discordId: 'm1', papel: 'master', papeis: ['master'] };
  const HOSTIL = `x'),alert('pwn'),('"><b>`;
  const HOSTIL2 = "y\\');alert(2);//";
  const ESPIADAS = ['verPedido', 'verPessoa', 'acaoConta', 'mudarServico', 'agir', 'mudarCategoria', 'ir', 'verLista',
    'verPessoas', 'resumoCopia', 'sessaoTeste', 'copiarAgora', 'criarConta', 'criarEndereco', 'guardarModelo', 'usarModelo', 'sair'];
  const COM_ID = ['verPedido', 'verPessoa', 'acaoConta', 'mudarServico', 'agir', 'mudarCategoria'];

  // achado A.5-15
  test('um id nos botões chega à função tal e qual, venha com plicas, aspas ou HTML: o escape serve o sítio onde está', async () => {
    const respostas = (rota) => {
      if (rota.startsWith('/api/equipa/pedidos?')) return { pedidos: [{ id: HOSTIL, subject: 'Ajuda', category: 'user', status: 'criado', created_at: 1 }] };
      if (rota.startsWith('/api/equipa/pessoas?')) return { pessoas: [{ id: HOSTIL, name: 'P', email: 'p@x.pt' }] };
      if (/\/servicos$/.test(rota)) return { servicos: [{ id: HOSTIL2, nome: 'Fisco', ligado: true, requer: [] }] };
      if (rota.startsWith('/api/equipa/pessoas/')) {
        return {
          quem: { id: HOSTIL, nome: 'P', email: 'p@x.pt', entrada: 'password + google', casas: 0, registos: 0, pedidos: 0, errosApanhados: 0 },
          pedidos: [{ id: HOSTIL2, subject: 's', status: 'criado' }], master: true,
        };
      }
      if (rota === '/api/equipa/modelos') return { modelos: [] };
      if (rota.startsWith('/api/equipa/pedidos/')) {
        return {
          pedido: { id: HOSTIL, subject: 's', body: 'b', category: 'user', status: 'concluido', created_at: 1 }, msgs: [],
          quem: { id: HOSTIL2, nome: 'P', email: 'p@x.pt', casas: 0, registos: 0, aceitouTermos: true },
          outros: [{ id: HOSTIL2, subject: 'o', status: 'criado' }],
        };
      }
      return {};
    };
    const g = await correrGuiao(MESTRE, respostas);
    const vistas = [g.els.conteudo.innerHTML];                              // a lista de pedidos
    g.contexto.verPessoas('abc'); await assentar(); vistas.push(g.els.conteudo.innerHTML);
    g.contexto.verPessoa('U1'); await assentar(); vistas.push(g.els.conteudo.innerHTML + g.els.servicosCard.innerHTML);
    g.contexto.verPedido('T1'); await assentar(); vistas.push(g.els.conteudo.innerHTML);
    const comId = [];
    for (const html of vistas) {
      for (const a of acoesNoHtml(html)) {
        let chamadas = [];
        assert.doesNotThrow(() => { chamadas = correrAcao(g, a, ESPIADAS); }, 'a ação corre: ' + a.nome);
        assert.ok(chamadas.length, 'a ação ' + a.nome + ' chega a uma função da página');
        chamadas.filter((c) => COM_ID.includes(c[0])).forEach((c) => comId.push(c));
      }
    }
    assert.deepEqual(g.registo.alert, [], 'nenhum id conseguiu correr código seu');
    assert.ok(comId.length >= 10, 'passou pelos botões todos: ' + comId.length);
    comId.forEach((c) => assert.ok([HOSTIL, HOSTIL2].includes(c[1]), c[0] + ' recebeu ' + JSON.stringify(c[1])));
    assert.ok(comId.some((c) => c[0] === 'mudarServico' && c[2] === HOSTIL2), 'o serviço também chega inteiro');
    // e no texto do guião: nenhum valor metido entre plicas escritas à mão, nem o esc() sozinho num manipulador
    const { GUIAO } = await import('../worker/src/equipa-guiao.js');
    assert.doesNotMatch(GUIAO, /\\'' \+|\+ '\\'/);
    assert.doesNotMatch(GUIAO, /on(?:click|keydown|change)="[^"]*' \+ esc\(/);
    assert.doesNotMatch(GUIAO, /\son(?:click|keydown|change)="/, 'e nenhum manipulador em linha: a CSP_ESTRITA não o corria');
  });

  test('um nome de ação que não está na tabela rebenta com um erro claro, e não procura mais nada', async () => {
    const g = await correrGuiao(MESTRE, () => ({ pedidos: [] }));
    const alvo = { dataset: {}, getAttribute: () => 'alert', closest: () => alvo };
    assert.throws(() => g.ouvintes.click.forEach((f) => f({ target: alvo })), /ação desconhecida: alert/);
    assert.deepEqual(g.registo.alert, []);
  });

  // achado A.5-16
  test('as palavras-passe pedem-se num campo de palavra-passe, nunca num prompt() em claro', async () => {
    const g = await correrGuiao(MESTRE, () => ({ pedidos: [] }));
    g.contexto.criarConta();
    assert.deepEqual(g.registo.prompt.filter((p) => /palavra-passe/i.test(p)), [], 'criar conta não pede a palavra-passe num prompt');
    assert.match((g.els.dialogo || {}).innerHTML || '', /type="password"/, 'pede-a num input type=password');
    g.contexto.acaoConta('U1', 'password');
    assert.deepEqual(g.registo.prompt.filter((p) => /palavra-passe/i.test(p)), [], 'definir a de outra pessoa também não');
    assert.match(g.els.dialogo.innerHTML, /type="password"/);
  });

  // achado A.5-9
  test('o que entra num <script> não o consegue fechar: um nome com </script> fica um nome', async () => {
    const nome = '</script><script>alert(1)</script>';
    const g = await correrGuiao({ nome, discordId: 'm1', papel: 'master', papeis: ['master'] }, () => ({ pedidos: [] }));
    assert.equal((g.html.match(/<\/script/gi) || []).length, 2, 'só os fechos dos dois da página: os dados e o guião');
    assert.equal(g.contexto.eu.nome, nome, 'e o browser lê o nome tal e qual');
    assert.deepEqual(g.registo.alert, []);
  });

  test('o botão de descarregar uma cópia só aparece a quem pode descarregar', async () => {
    const copias = [{ key: 'copias/2026-09-14.ndjson.gz', size: 2048 }];
    const painel = (master) => (rota) => (rota === '/api/equipa/operacao'
      ? { consumo: [], copias, crons: [], historico: [], master }
      : rota === '/api/equipa/email' ? { semChave: true } : { pedidos: [] });
    const a = await correrGuiao({ nome: 'Ana', discordId: 'a1', papel: 'admin', papeis: ['admin'] }, painel(false));
    a.contexto.ir('operacao'); await assentar();
    assert.match(a.els.conteudo.innerHTML, /Verificar/, 'o admin verifica');
    assert.doesNotMatch(a.els.conteudo.innerHTML, /descarregar/, 'mas não descarrega');
    const m = await correrGuiao(MESTRE, painel(true));
    m.contexto.ir('operacao'); await assentar();
    assert.match(m.els.conteudo.innerHTML, /\/descarregar"/);
  });
});

/* ------------------------------------------------------------ os comentários */

describe('os comentários', () => {
  const MEUS = ['worker/src/discord.js', 'worker/src/equipa.js', 'worker/src/equipa-api.js', 'worker/src/equipa-vista.js',
    'worker/src/equipa-guiao.js', 'worker/src/docs-vista.js', 'worker/src/landing.js', 'worker/src/legal-vista.js',
    'worker/src/notify.js', 'worker/src/salvaguarda.js', 'worker/src/teste.js', 'worker/src/acessos.js',
    'worker/src/lib/bot.js', 'worker/src/lib/papeis.js', 'worker/src/lib/correio.js', 'worker/src/lib/enderecos.js'];

  // achado A.5-19
  test('nenhum bloco de comentário fica empilhado noutro: o gerador dos docs só lê o de baixo, e quem lê o ficheiro vê dois cabeçalhos', () => {
    const empilhados = [];
    for (const f of MEUS) {
      // sem try: um ficheiro da lista que mude de nome rebenta aqui em vez de sair da verificação calado
      const L = ler(f).replace(/\r\n/g, '\n').split('\n');
      for (let i = 1; i < L.length; i++) {
        if (L[i - 1].trim().endsWith('*/') && L[i].trim().startsWith('/*')) empilhados.push(f + ':' + (i + 1));
      }
    }
    assert.deepEqual(empilhados, []);
    assert.equal((ler('worker/src/equipa-api.js').match(/inspeciona-se em casa/g) || []).length, 1, 'o tecto de CPU explicado uma vez');
    assert.equal((ler('worker/src/docs-vista.js').match(/Monta a página inteira/g) || []).length, 1, 'a página dos docs com um cabeçalho');
  });
});

/* ---------------------------------------------------- a vigia dos limites */

// Responde às perguntas à API de análise da Cloudflare com os conjuntos que
// cada uma pede; um conjunto marcado 'falha' faz a pergunta toda vir com erro.
function analise(respostas) {
  const perguntas = [];
  globalThis.fetch = async (url, o) => {
    const corpo = JSON.parse(o.body);
    perguntas.push(corpo);
    const conta = {};
    let falhou = false;
    for (const [conjunto, r] of Object.entries(respostas)) {
      if (!corpo.query.includes(conjunto + '(')) continue;
      if (r === 'falha') falhou = true; else conta[conjunto] = r;
    }
    if (falhou) return new Response('{"data":null,"errors":[{"message":"unknown field"}]}', { status: 200 });
    return new Response(JSON.stringify({ data: { viewer: { accounts: [conta] } } }), { status: 200 });
  };
  return perguntas;
}
const NORMAIS = {
  d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 1000000, rowsWritten: 2000, readQueries: 1, writeQueries: 1 } }],
  workersInvocationsAdaptive: [{ sum: { requests: 5000, errors: 0 } }],
  kvOperationsAdaptiveGroups: [
    { sum: { requests: 4000 }, dimensions: { actionType: 'read' } },
    { sum: { requests: 850 }, dimensions: { actionType: 'write' } },
  ],
  r2OperationsAdaptiveGroups: [
    { sum: { requests: 1200 }, dimensions: { actionType: 'PutObject' } },
    { sum: { requests: 300 }, dimensions: { actionType: 'ListObjects' } },
    { sum: { requests: 9000 }, dimensions: { actionType: 'GetObject' } },
    { sum: { requests: 50 }, dimensions: { actionType: 'DeleteObject' } },
  ],
  r2StorageAdaptiveGroups: [
    { max: { payloadSize: 6e9, metadataSize: 1e6 }, dimensions: { bucketName: 'gestor-imobiliario' } },
    { max: { payloadSize: 3.5e9, metadataSize: 0 }, dimensions: { bucketName: 'gestor-imobiliario-dev' } },
  ],
  d1QueriesAdaptiveGroups: [],
};
const ambienteCf = (extra) => Object.assign({ DB: baseDeTeste(), FILES: r2Falso(), CF_ANALYTICS_TOKEN: 't', CF_ACCOUNT_ID: 'a' }, extra);
const valorDe = (campos, k) => (campos.find((c) => c.name === k) || {}).value || '';

describe('a vigia dos limites', () => {
  // achado A.5-7a
  test('cada tecto que a vigia declara sai medido: o KV conta leituras e escritas, e a vigia avisa-o', async () => {
    analise(NORMAIS);
    const n = await import('../worker/src/notify.js');
    const campos = await n.usageFields(ambienteCf());
    assert.match(valorDe(campos, 'KV · escritas'), /^850 \/ 1\D?000\s+\(85%\)/, 'o tecto mais apertado do plano');
    assert.match(valorDe(campos, 'KV · leituras'), /^4\D?000 \/ 100\D?000/);
    assert.ok(n.LIMITS && Object.keys(n.LIMITS).length >= 7, 'os tectos estão à vista de quem os confere');
    for (const k of Object.keys(n.LIMITS)) assert.match(valorDe(campos, k), /\d.* \/ /, k + ' declarado e medido');

    const enviados = [];
    const f = globalThis.fetch;
    globalThis.fetch = async (url, o) => {
      if (String(url).startsWith('https://discord.test')) { enviados.push(JSON.parse(o.body)); return new Response('', { status: 204 }); }
      return f(url, o);
    };
    const r = await n.watchLimits(ambienteCf({ DISCORD_ADMIN_WEBHOOK: 'https://discord.test/hook' }), null);
    assert.ok(r.limites.includes('KV · escritas'), 'a vigia olha para o KV: ' + JSON.stringify(r));
    assert.ok(enviados.length === 1 && enviados[0].embeds[0].fields.some((x) => x.name === 'KV · escritas'));
  });

  test('uma parte da API de análise que falha não leva as outras: o D1 fica, e o que falta diz que falta', async () => {
    analise(Object.assign({}, NORMAIS, { kvOperationsAdaptiveGroups: 'falha' }));
    const { usageFields } = await import('../worker/src/notify.js');
    const campos = await usageFields(ambienteCf());
    assert.match(valorDe(campos, 'D1 · linhas lidas'), /\(20%\)/, 'o tecto que deita a app abaixo continua medido');
    assert.match(valorDe(campos, 'KV · escritas'), /sem medida/, 'e o KV não desaparece calado');
  });

  // achado A.4-6b
  test('o R2 está na vigia: o espaço dos dois buckets somados e as operações de classe A desde o dia 1 do mês', async () => {
    const perguntas = analise(NORMAIS);
    const n = await import('../worker/src/notify.js');
    const campos = await n.usageFields(ambienteCf());
    assert.match(valorDe(campos, 'R2 · armazenamento'), /^9,50 GB \/ 10,00 GB\s+\(95%\)/);
    assert.match(valorDe(campos, 'R2 · operações de classe A (mês)'), /^1\D?500 \/ 1\D?000\D?000/, 'escrever e listar são classe A; ler e apagar não');
    const doMes = perguntas.find((p) => p.query.includes('r2OperationsAdaptiveGroups('));
    const agora = new Date();
    assert.equal(Object.values(doMes.variables).find((v) => /T00:00:00/.test(String(v))),
      new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString(), 'contadas desde o dia 1, a janela do plano');
    const f = globalThis.fetch;
    globalThis.fetch = async (url, o) => (String(url).startsWith('https://discord.test') ? new Response('', { status: 204 }) : f(url, o));
    const r = await n.watchLimits(ambienteCf({ DISCORD_ADMIN_WEBHOOK: 'https://discord.test/hook' }), null);
    assert.ok(r.limites.includes('R2 · armazenamento'), 'a 95% do espaço, a vigia avisa');
  });

  // achado A.5-18
  test('o SQL do notify.js vai todo por bind: nenhum valor entra por interpolação', async () => {
    assert.doesNotMatch(ler('worker/src/notify.js'), /`[^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{[^`]*`/);
    // e conta o mesmo que contava: quem mexeu nas casas nas últimas 24 horas
    const { usageFields } = await import('../worker/src/notify.js');
    const env = { DB: baseDeTeste(), FILES: r2Falso() };
    for (const [id, t] of [['U1', Date.now()], ['U2', Date.now() - 3 * 86400000]]) {
      await env.DB.prepare('INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, id + '@x.pt', 'P', 'h', 's', 1).run();
      await env.DB.prepare("INSERT INTO houses (id, owner_id, data, updated_at) VALUES (?, ?, '{}', ?)").bind('H' + id, id, t).run();
    }
    assert.equal(valorDe(await usageFields(env), 'Ativos (24h)'), '1');
  });
});
