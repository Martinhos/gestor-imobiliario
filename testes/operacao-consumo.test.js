/* O consumo à cabeça da Operação, com o gráfico de cada valor (KAN-144,
   ticket de QA 578aa979): as amostras que a vigia de hora a hora grava
   (migrations/0031_consumo_amostras.sql, worker/src/lib/consumo-serie.js), o
   passado das contas reconstruído da D1, a rota da série
   (GET /api/equipa/operacao/serie) e o guião (a ordem e os botões). Corre
   contra a D1 de teste, que é SQLite a sério com as migrações aplicadas. */

import { test, describe, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { baseDeTeste, r2Falso } from './lib/bd.js';
import worker from '../worker/src/index.js';
import { RETENCAO_MS, MEDIDAS, HORIZONTES } from '../worker/src/lib/consumo-serie.js';

const HORA = 3600000, DIA = 86400000;
// 03:00 UTC: antes das 9h de Lisboa, para o email dos atrasos não entrar na vigia
const AGORA = Date.UTC(2026, 10, 24, 3, 0, 0);

afterEach(() => { mock.restoreAll(); });

/* Uma conta na base.
   Recebe: env; id; criada — o created_at (ms); apagada (opcional) — o deleted_at. */
async function contaComDatas(env, id, criada, apagada) {
  await env.DB.prepare('INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, id + '@x.pt', id, 'h', 's', criada, apagada == null ? null : apagada).run();
}
/* Uma casa (e n registos nela).
   Recebe: env; id; dona — o id da conta; n — quantos registos. */
async function casaComRegistos(env, id, dona, n) {
  await env.DB.prepare('INSERT INTO houses (id, owner_id, data, updated_at) VALUES (?, ?, ?, ?)').bind(id, dona, '{}', AGORA - HORA).run();
  for (let i = 0; i < n; i++) {
    await env.DB.prepare('INSERT INTO records (house_id, kind, id, data, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, 'mov', 'r' + i, '{}', AGORA).run();
  }
}
// as amostras guardadas de uma medida, por ordem
const amostras = async (env, medida) => (await env.DB.prepare('SELECT at, valor FROM consumo_amostras WHERE medida = ? ORDER BY at')
  .bind(medida).all()).results.map((r) => ({ at: Number(r.at), v: Number(r.valor) }));

/* A vigia de hora a hora inteira (o cron '0 * * * *'), à espera do que ficou em fundo.
   Recebe: env; quando — o scheduledTime (ms). */
async function vigia(env, quando) {
  const fundo = [];
  await worker.scheduled({ cron: '0 * * * *', scheduledTime: quando }, env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
}

/* Conta as instruções que passam pelo prepare da base, por um filtro.
   Recebe: env. Devolve: a lista dos SQL preparados (a encher). */
function espiarSql(env) {
  const vistos = [];
  const original = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => { vistos.push(sql); return original(sql); };
  return vistos;
}

/* A API de análise da Cloudflare a fingir: responde a cada pergunta do cloudflareUsage.
   Recebe: lidas — as linhas lidas da D1 que a resposta traz. */
function cloudflareResponde(lidas) {
  mock.method(globalThis, 'fetch', async (url, o) => {
    const q = JSON.parse(o.body).query;
    const conta = {};
    if (/d1AnalyticsAdaptiveGroups/.test(q)) {
      conta.d1AnalyticsAdaptiveGroups = [{ sum: { rowsRead: lidas, rowsWritten: 300, readQueries: 1, writeQueries: 1 } }];
      conta.workersInvocationsAdaptive = [{ sum: { requests: 4200, errors: 0 } }];
    }
    if (/kvOperationsAdaptiveGroups/.test(q)) conta.kvOperationsAdaptiveGroups = [{ sum: { requests: 70 }, dimensions: { actionType: 'write' } }];
    return new Response(JSON.stringify({ data: { viewer: { accounts: [conta] } } }), { status: 200 });
  });
}

describe('a vigia guarda o consumo de hora a hora', () => {
  test('uma amostra por hora, com os números da D1, num só INSERT; uma segunda volta na mesma hora repõe, não duplica', async () => {
    const env = { DB: baseDeTeste() };
    await contaComDatas(env, 'u1', AGORA - 3 * HORA);
    await contaComDatas(env, 'u2', AGORA - 2 * HORA);
    await casaComRegistos(env, 'h1', 'u1', 3);
    const sql = espiarSql(env);
    await vigia(env, AGORA + 5 * 60000);   // a vigia das 03:05 guarda às 03:00
    const inserts = sql.filter((s) => /INSERT[\s\S]*INTO consumo_amostras/.test(s));
    assert.equal(inserts.length, 1, 'um INSERT só para a amostra (o passado das contas não fez falta: são de hoje)');
    assert.deepEqual(await amostras(env, 'contas'), [{ at: AGORA, v: 2 }]);
    assert.deepEqual(await amostras(env, 'casas'), [{ at: AGORA, v: 1 }]);
    assert.deepEqual(await amostras(env, 'registos'), [{ at: AGORA, v: 3 }]);
    assert.deepEqual(await amostras(env, 'ativos'), [{ at: AGORA, v: 1 }]);
    assert.deepEqual(await amostras(env, 'pedidos'), [{ at: AGORA, v: 0 }]);
    assert.deepEqual(await amostras(env, 'd1-lidas'), [], 'sem token da Cloudflare, os tectos ficam de fora (não se inventa um 0)');
    await contaComDatas(env, 'u3', AGORA + HORA / 2);
    await vigia(env, AGORA + 50 * 60000);
    assert.deepEqual(await amostras(env, 'contas'), [{ at: AGORA, v: 3 }], 'a mesma hora, a amostra reposta');
  });

  test('com a Cloudflare, os tectos entram na amostra — e o consumo pede-se uma vez por hora para os avisos e para a amostra', async () => {
    cloudflareResponde(1234567);
    const env = { DB: baseDeTeste(), CF_ANALYTICS_TOKEN: 't', CF_ACCOUNT_ID: 'a', DISCORD_ADMIN_WEBHOOK: 'https://discord.invalid/w' };
    await vigia(env, AGORA);
    assert.deepEqual(await amostras(env, 'd1-lidas'), [{ at: AGORA, v: 1234567 }]);
    assert.deepEqual(await amostras(env, 'kv-escritas'), [{ at: AGORA, v: 70 }]);
    assert.deepEqual(await amostras(env, 'r2-espaco'), [], 'o que a API não devolveu não se guarda');
    const perguntas = globalThis.fetch.mock.calls.filter((c) => /graphql/.test(String(c.arguments[0])));
    assert.equal(perguntas.length, 4, 'as quatro perguntas do cloudflareUsage, uma vez (não duas: a vigia e a amostra partilham-nas)');
  });

  test('cada fonte falha sozinha: sem a tabela dos pedidos, as outras medidas entram; sem a tabela das amostras, a vigia corre na mesma', async () => {
    const env = { DB: baseDeTeste() };
    await contaComDatas(env, 'u1', AGORA - HORA);
    env.DB._db.exec('DROP TABLE tickets');
    await vigia(env, AGORA);
    assert.deepEqual(await amostras(env, 'contas'), [{ at: AGORA, v: 1 }]);
    assert.deepEqual(await amostras(env, 'pedidos'), [], 'sem tabela, sem número — e sem 0 inventado');
    assert.deepEqual(await amostras(env, 'erros'), []);

    const env2 = { DB: baseDeTeste() };
    env2.DB._db.exec('DROP TABLE consumo_amostras');
    await vigia(env2, AGORA);
    const ops = (await env2.DB.prepare('SELECT op, ok, detalhe FROM op_log ORDER BY id').all()).results;
    assert.ok(ops.some((o) => o.op === 'vigia' && o.ok === 1), 'a vigia registou-se como bem: ' + JSON.stringify(ops));
    const falha = ops.find((o) => o.op === 'consumo');
    assert.ok(falha && falha.ok === 0 && /amostra/.test(falha.detalhe), 'e a falha do histórico ficou à parte: ' + JSON.stringify(falha));
  });

  test('apaga o que passa dos 400 dias, e só isso', async () => {
    const env = { DB: baseDeTeste() };
    const velha = AGORA - RETENCAO_MS - HORA, nova = AGORA - RETENCAO_MS + HORA;
    for (const [m, t] of [['casas', velha], ['casas', nova], ['d1-lidas', velha], ['d1-lidas', nova]]) {
      await env.DB.prepare('INSERT INTO consumo_amostras (medida, at, valor) VALUES (?, ?, ?)').bind(m, t, 7).run();
    }
    await vigia(env, AGORA);
    assert.deepEqual((await amostras(env, 'casas')).map((a) => a.at), [nova, AGORA]);
    assert.deepEqual((await amostras(env, 'd1-lidas')).map((a) => a.at), [nova]);
  });
});

describe('o passado das contas', () => {
  test('reconstrói-se dia a dia das datas da D1 (criadas menos apagadas), uma vez só, e não toca nas casas', async () => {
    const env = { DB: baseDeTeste() };
    const hoje = Math.floor(AGORA / DIA) * DIA;
    await contaComDatas(env, 'a', hoje - 10 * DIA + 5 * HORA);
    await contaComDatas(env, 'b', hoje - 5 * DIA + HORA, hoje - 3 * DIA + 2 * HORA);   // apagada três dias depois
    await contaComDatas(env, 'c', hoje - 1 * DIA + 20 * HORA);
    await casaComRegistos(env, 'h1', 'a', 0);
    await vigia(env, AGORA);
    const c = await amostras(env, 'contas');
    const em = (t) => (c.find((a) => a.at === t) || {}).v;
    assert.equal(em(hoje - 9 * DIA), 1, 'no fim do dia da primeira conta');
    assert.equal(em(hoje - 5 * DIA), 1, 'antes da segunda');
    assert.equal(em(hoje - 4 * DIA), 2, 'no fim do dia da segunda');
    assert.equal(em(hoje - 2 * DIA), 1, 'no fim do dia em que se apagou');
    assert.equal(em(hoje), 2, 'à meia-noite de hoje (a da reconstrução, com a terceira de ontem)');
    assert.equal(em(AGORA), 2, 'e a amostra desta hora');
    assert.equal(c[0].at, hoje - 9 * DIA, 'nada antes da primeira conta');
    assert.equal(c.length, 11, 'dez fins de dia e a hora de agora');
    assert.deepEqual((await amostras(env, 'casas')).map((a) => a.at), [AGORA], 'as casas não têm data de criação: começam agora');

    const sql = espiarSql(env);
    await vigia(env, AGORA + HORA);
    assert.ok(!sql.some((s) => /GROUP BY d/.test(s)), 'feito o passado, a vigia seguinte não o volta a fazer');
    assert.equal((await amostras(env, 'contas')).length, 12);
  });

  test('uma conta mais velha do que a retenção: o passado começa no corte, e não se refaz de hora a hora', async () => {
    const env = { DB: baseDeTeste() };
    await contaComDatas(env, 'velha', AGORA - 900 * DIA);
    await vigia(env, AGORA);
    const c = await amostras(env, 'contas');
    assert.ok(c[0].at >= AGORA - RETENCAO_MS && c[0].at < AGORA - RETENCAO_MS + DIA, 'o primeiro ponto é o primeiro fim de dia dentro da retenção');
    assert.ok(c.every((a) => a.v === 1));
    const sql = espiarSql(env);
    await vigia(env, AGORA + HORA);
    assert.ok(!sql.some((s) => /GROUP BY d/.test(s)), 'não volta a reconstruir');
  });
});

describe('a rota da série', () => {
  const MASTER = { discordId: 'm1', nome: 'Mestre', papel: 'master', papeis: ['master'] };
  const SUPORTE = { discordId: 's1', nome: 'Sofia', papel: 'suporte', papeis: ['suporte'] };
  /* Um pedido à API do back office.
     Recebe: env; eu — quem pede; caminho — com a query. Devolve: {status, j}. */
  async function pedir(env, eu, caminho) {
    const { rotasEquipaApi } = await import('../worker/src/equipa-api.js');
    const url = new URL('https://x.pt' + caminho);
    const r = await rotasEquipaApi({ env, request: new Request(url), path: url.pathname, method: 'GET', url, eu });
    return { status: r.status, j: await r.json() };
  }
  /* Uma amostra por hora de uma medida, para trás desde agora.
     Recebe: env; medida; horas; valor — função do índice (0 = a mais recente). */
  async function semear(env, medida, horas, valor) {
    const agoraH = Math.floor(Date.now() / HORA) * HORA;
    const linhas = [];
    for (let i = 0; i < horas; i++) linhas.push([medida, agoraH - i * HORA, valor(i)]);
    await env.DB.prepare("INSERT INTO consumo_amostras (medida, at, valor) SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]') FROM json_each(?)")
      .bind(JSON.stringify(linhas)).run();
  }

  test('a guarda é a da operação: sem infra, 403', async () => {
    const env = { DB: baseDeTeste() };
    const r = await pedir(env, SUPORTE, '/api/equipa/operacao/serie?medida=contas&horizonte=7d');
    assert.equal(r.status, 403);
  });

  test('valida a medida e o horizonte', async () => {
    const env = { DB: baseDeTeste() };
    assert.equal((await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=senhas&horizonte=7d')).status, 400);
    assert.equal((await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=__proto__&horizonte=7d')).status, 400);
    assert.equal((await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=contas&horizonte=2a')).status, 400);
    assert.equal((await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=contas')).status, 400);
    const ok = await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=contas&horizonte=7d');
    assert.equal(ok.status, 200);
    assert.deepEqual(Object.keys(HORIZONTES), ['1d', '7d', '14d', '1m', '3m', '1a']);
  });

  test('junta por hora, 6 h, dia e semana conforme o horizonte, e acaba no valor de agora', async () => {
    const env = { DB: baseDeTeste() };
    await contaComDatas(env, 'u1', Date.now() - DIA);
    await casaComRegistos(env, 'h1', 'u1', 0);
    await casaComRegistos(env, 'h2', 'u1', 0);
    await semear(env, 'casas', 400 * 24, (i) => 1000 - Math.floor(i / 24));
    const esperado = { '1d': [HORA, 24], '7d': [HORA, 168], '14d': [6 * HORA, 56], '1m': [DIA, 30], '3m': [DIA, 91], '1a': [7 * DIA, 52] };
    for (const [h, [passo, n]] of Object.entries(esperado)) {
      const { status, j } = await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=casas&horizonte=' + h);
      assert.equal(status, 200);
      assert.equal(j.passo, passo, h + ': o passo');
      const guardados = j.pontos.filter((p) => !p.vivo);
      assert.ok(guardados.length >= n && guardados.length <= n + 2, h + ': ' + guardados.length + ' pontos (esperados ~' + n + ')');
      assert.ok(guardados.every((p, i) => i === 0 || p.t > guardados[i - 1].t), h + ': por ordem');
      assert.ok(guardados.every((p) => p.t >= j.inicio && p.t <= j.fim), h + ': dentro do horizonte');
      const ultimo = j.pontos[j.pontos.length - 1];
      assert.deepEqual([ultimo.vivo, ultimo.v], [true, 2], h + ': o último é o valor de agora, ao vivo');
      assert.equal(j.desde, Math.floor(Date.now() / HORA) * HORA - (400 * 24 - 1) * HORA, h + ': desde a amostra mais antiga');
      assert.equal(j.tecto, null);
    }
    // o fim de cada dia nas casas: o valor da última amostra do dia, não a soma nem a média
    const { j } = await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=casas&horizonte=1m');
    const ontem = j.pontos[j.pontos.length - 3];
    assert.ok(Number.isInteger(ontem.v) && ontem.v <= 1000 && ontem.v >= 970, 'um valor de amostra: ' + ontem.v);
  });

  test('o 1d começa ontem à hora em ponto de agora (os intervalos batem com as amostras), e o 7d também', async () => {
    const env = { DB: baseDeTeste() };
    await semear(env, 'casas', 30, (i) => 100 - i);
    for (const [h, horas] of [['1d', 24], ['7d', 168]]) {
      const { j } = await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=casas&horizonte=' + h);
      const horaDeAgora = Math.floor(j.fim / HORA) * HORA;
      assert.equal(j.inicio, horaDeAgora - horas * HORA, h + ': começa à hora em ponto, ' + horas + ' h antes da hora de agora');
      if (h === '1d') {
        const guardados = j.pontos.filter((p) => !p.vivo);
        assert.equal(guardados.length, 25, '1d: de ontem a esta hora até agora, de hora a hora');
        assert.equal(guardados[0].t, j.inicio, '1d: o primeiro ponto é a amostra de ontem a esta hora, não a seguinte');
        assert.equal(guardados[0].v, 100 - 24, '1d: e traz o valor dessa amostra');
      }
    }
  });

  test('os tectos juntam pelo pico e trazem o tecto; as contas trazem o MAX_USERS', async () => {
    const env = { DB: baseDeTeste(), MAX_USERS: '150' };
    const agoraH = Math.floor(Date.now() / HORA) * HORA, d0 = Math.floor(agoraH / DIA) * DIA - 3 * DIA;
    for (const [t, v] of [[d0 + HORA, 10], [d0 + 2 * HORA, 50], [d0 + 3 * HORA, 20]]) {
      await env.DB.prepare('INSERT INTO consumo_amostras (medida, at, valor) VALUES (?, ?, ?)').bind('d1-lidas', t, v).run();
      await env.DB.prepare('INSERT INTO consumo_amostras (medida, at, valor) VALUES (?, ?, ?)').bind('pedidos', t, v).run();
    }
    const pico = (await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=d1-lidas&horizonte=1m')).j;
    assert.deepEqual(pico.pontos.map((p) => [p.t, p.v]), [[d0, 50]], 'o pico do dia; sem Cloudflare, sem ponto ao vivo');
    assert.equal(pico.tecto, 5000000);
    assert.equal(pico.agrega, 'pico');
    const fim = (await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=pedidos&horizonte=1m')).j;
    assert.deepEqual(fim.pontos.filter((p) => !p.vivo).map((p) => [p.t, p.v]), [[d0, 20]], 'o valor no fim do dia');
    assert.equal(fim.agrega, 'fim');
    assert.equal((await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=contas&horizonte=1d')).j.tecto, 150);
  });

  test('o valor de agora de um tecto vem da Cloudflare; sem amostras, a série é só ele e o desde fica nulo', async () => {
    cloudflareResponde(4321);
    const env = { DB: baseDeTeste(), CF_ANALYTICS_TOKEN: 't', CF_ACCOUNT_ID: 'a' };
    const { j } = await pedir(env, MASTER, '/api/equipa/operacao/serie?medida=d1-lidas&horizonte=7d');
    assert.equal(j.pontos.length, 1);
    assert.deepEqual([j.pontos[0].v, j.pontos[0].vivo], [4321, true]);
    assert.equal(j.desde, null);
    assert.equal(j.nome, 'D1 · linhas lidas');
  });

  test('o painel diz que medida abre cada campo do consumo', async () => {
    const env = { DB: baseDeTeste(), FILES: r2Falso() };
    const { j } = await pedir(env, MASTER, '/api/equipa/operacao');
    assert.equal(j.medidas['Contas'], 'contas');
    assert.equal(j.medidas['D1 · linhas lidas'], 'd1-lidas');
    assert.equal(j.medidas['Casas'], 'casas');
    assert.equal(j.medidas['Registos'], 'registos');
    assert.equal(Object.keys(j.medidas).length, Object.keys(MEDIDAS).length);
  });
});

describe('o guião da Operação', () => {
  const MESTRE = { nome: 'Mestre', discordId: 'm1', papel: 'master', papeis: ['master'] };
  const assentar = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
  const PAINEL = {
    teste: 'dev',
    consumo: [
      { name: 'Contas', value: '12 / 100  (12%)' }, { name: 'Ativos (24h)', value: '3' }, { name: 'Casas · registos', value: '4 · 57' },
      { name: 'Pedidos abertos', value: '2' }, { name: 'Erros (24h)', value: '0' }, { name: 'Cópias de segurança', value: 'ok' },
      { name: 'D1 · linhas lidas', value: '1 000 / 5 000 000  (0%)' }, { name: 'KV · escritas', value: '900 / 1 000  (90%)' },
    ],
    medidas: { 'Contas': 'contas', 'Ativos (24h)': 'ativos', 'Casas': 'casas', 'Registos': 'registos', 'Pedidos abertos': 'pedidos',
      'Erros (24h)': 'erros', 'D1 · linhas lidas': 'd1-lidas', 'KV · escritas': 'kv-escritas' },
    copias: [], crons: [], historico: [], master: true,
  };
  const SERIE = (h) => ({ medida: 'contas', nome: 'Contas', horizonte: h, inicio: 0, fim: 8 * HORA, passo: HORA, agrega: 'fim', unidade: null, tecto: 100,
    desde: 4 * HORA, pontos: [{ t: 4 * HORA, v: 10 }, { t: 6 * HORA, v: 11 }, { t: 8 * HORA, v: 12, vivo: true }] });

  /* O guião servido pelo /equipa numa página de faz-de-conta (como o correcao-operacao.test.js:correrGuiao).
     Recebe: responder — (rota) → JSON. Devolve: {contexto, els, rotas}. */
  async function correrGuiao(responder) {
    const { paginaEquipa } = await import('../worker/src/equipa-vista.js');
    const { GUIAO } = await import('../worker/src/equipa-guiao.js');
    const html = await new Response(paginaEquipa(MESTRE).body).text();
    const dados = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(html)[1];
    const els = { 'dados-equipa': { id: 'dados-equipa', textContent: dados } };
    const rotas = [], guardado = {};
    const contexto = vm.createContext({
      document: {
        getElementById: (id) => els[id] || (els[id] = { id, innerHTML: '', open: false, showModal() { this.open = true; }, close() { this.open = false; }, querySelector: () => null }),
        addEventListener() {},
        documentElement: { classList: { contains: () => false, add() {}, remove() {} } }, body: { style: {} },
      },
      sessionStorage: { getItem: (k) => (k in guardado ? guardado[k] : null), setItem: (k, v) => { guardado[k] = String(v); } },
      location: { reload() {} }, scrollY: 0, scrollTo() {},
      fetch: async (rota) => { rotas.push(String(rota)); return new Response(JSON.stringify(responder(String(rota)) || {}), { status: 200 }); },
      setTimeout, console,
    });
    vm.runInContext(GUIAO, contexto);
    await assentar();
    return { contexto, els, rotas, guardado };
  }
  const responder = (rota) => {
    if (rota === '/api/equipa/operacao') return PAINEL;
    const m = /\/api\/equipa\/operacao\/serie\?medida=([^&]+)&horizonte=(\w+)/.exec(rota);
    if (m) return SERIE(m[2]);
    if (rota === '/api/equipa/email') return { semChave: true };
    return { pedidos: [], sessoes: [] };
  };

  test('o Consumo é a primeira secção, e cada quadrado e cada tecto com série é um botão que abre o gráfico', async () => {
    const g = await correrGuiao(responder);
    g.contexto.ir('operacao'); await assentar();
    const h = g.els.conteudo.innerHTML;
    const iConsumo = h.indexOf('id="titConsumo"'), iTeste = h.indexOf('id="titTeste"'), iTarefas = h.indexOf('aria-label="Tarefas agendadas"');
    assert.ok(iConsumo > 0 && iConsumo < iTeste && iTeste < iTarefas, 'consumo, depois a sessão de teste, depois as tarefas');
    assert.ok(h.indexOf('<section') === h.indexOf('<section class="op-consumo"'), 'a primeira secção a seguir ao cabeçalho é a do consumo');
    const botoes = [...h.matchAll(/<button type="button" class="(st|lm)[^"]*"[^>]*data-acao="verSerie" data-arg="([^"]+)"/g)].map((m) => m[1] + ':' + m[2]);
    assert.deepEqual(botoes, ['st:contas', 'st:ativos', 'st:casas', 'st:registos', 'st:pedidos', 'st:erros', 'lm:d1-lidas', 'lm:kv-escritas']);
    assert.match(h, /<span class="sub">Registos<\/span>[\s\S]*?<b class="st-valor n">57<\/b>/, 'o «Casas · registos» partiu-se em dois quadrados');
    assert.doesNotMatch(h, /<div class="lm-topo">/, 'dentro de um botão só vai texto (o topo da linha é um span)');
  });

  test('o cartão: os seis horizontes, um só escolhido, o gráfico com o tecto e a leitura; o horizonte muda a série e lembra-se por medida', async () => {
    const g = await correrGuiao(responder);
    g.contexto.ir('operacao'); await assentar();
    g.contexto.verSerie('contas', 'Contas'); await assentar();
    assert.equal(g.els.dialogo.open, true, 'a janela abriu');
    assert.match(g.els.dialogo.innerHTML, /<h2 id="janelaTit">Contas<\/h2>/);
    const chips = g.els.serieHorizontes.innerHTML;
    assert.deepEqual([...chips.matchAll(/data-arg="(\w+)"/g)].map((m) => m[1]), ['1d', '7d', '14d', '1m', '3m', '1a']);
    assert.equal((chips.match(/aria-pressed="true"/g) || []).length, 1);
    assert.match(chips, /class="chip on" aria-pressed="true" data-acao="mudarHorizonte" data-arg="7d"/, 'abre no 7d');
    assert.ok(g.rotas.includes('/api/equipa/operacao/serie?medida=contas&horizonte=7d'));
    const corpo = g.els.serieCorpo.innerHTML;
    assert.match(corpo, /class="sr-linha" data-pontos="3" d="M300\.0 [\d.]+ L450\.0 [\d.]+ L600\.0 [\d.]+"/, 'a linha pelos três pontos, até agora');
    assert.match(corpo, /class="sr-tecto"/, 'o tecto marcado');
    assert.match(corpo, /Sem dados antes de /, 'a série começa a meio do horizonte e diz-o');
    assert.equal(g.els.serieLeitura.textContent, 'Agora · 12', 'a leitura nasce no valor de agora');

    g.contexto.mudarHorizonte('1a'); await assentar();
    assert.ok(g.rotas.includes('/api/equipa/operacao/serie?medida=contas&horizonte=1a'), 'mudar o horizonte pede a série nova');
    assert.match(g.els.serieHorizontes.innerHTML, /class="chip on" aria-pressed="true" data-acao="mudarHorizonte" data-arg="1a"/);
    assert.equal(g.guardado['eq_serie_h:contas'], '1a');
    g.contexto.mudarHorizonte('9z'); await assentar();
    assert.equal(g.guardado['eq_serie_h:contas'], '1a', 'um horizonte de fora não faz nada');

    g.els.dialogo.open = false; g.els.dialogo.onclose();
    g.contexto.verSerie('casas', 'Casas'); await assentar();
    assert.match(g.els.serieHorizontes.innerHTML, /class="chip on" aria-pressed="true" data-acao="mudarHorizonte" data-arg="7d"/, 'outra medida, o seu horizonte');
    g.els.dialogo.open = false; g.els.dialogo.onclose();
    g.contexto.verSerie('contas', 'Contas'); await assentar();
    assert.match(g.els.serieHorizontes.innerHTML, /data-arg="1a"/);
    assert.match(g.els.serieHorizontes.innerHTML, /class="chip on" aria-pressed="true" data-acao="mudarHorizonte" data-arg="1a"/, 'as contas voltam no 1a');
  });

  test('o 1d vai de ontem à hora em ponto até agora, e cada meia-noite é uma linha tracejada com o dia novo (1d e 7d, não o 14d)', async () => {
    // agora: 25/11/2026 às 12:30, na hora de quem vê (o vm corre no fuso do processo, como o browser)
    const fim = new Date(2026, 10, 25, 12, 30).getTime();
    const serieDe = (h, dias, passo) => {
      const inicio = new Date(2026, 10, 25 - dias, 12, 0).getTime(), pontos = [];
      for (let t = inicio; t < fim; t += passo) pontos.push({ t, v: 10 });
      pontos.push({ t: fim, v: 12, vivo: true });
      return { medida: 'casas', nome: 'Casas', horizonte: h, inicio, fim, passo, agrega: 'fim', unidade: null, tecto: null, desde: inicio - DIA, pontos };
    };
    const g = await correrGuiao((rota) => {
      const m = /horizonte=(\w+)/.exec(rota);
      if (/\/serie\?/.test(rota)) return { '1d': serieDe('1d', 1, HORA), '7d': serieDe('7d', 7, HORA), '14d': serieDe('14d', 14, 6 * HORA) }[m[1]];
      return responder(rota);
    });
    g.contexto.verSerie('casas', 'Casas'); await assentar();
    g.contexto.mudarHorizonte('1d'); await assentar();
    let corpo = g.els.serieCorpo.innerHTML;
    assert.match(corpo, /<div class="sr-x[^"]*"[^>]*><span>ontem 12:00<\/span><span>Agora<\/span><\/div>/, 'o eixo começa ontem à hora em ponto e acaba em Agora');
    const divisoes = [...corpo.matchAll(/<line class="sr-divisao" x1="([\d.]+)"/g)].map((m) => Number(m[1]));
    const meiaNoite = new Date(2026, 10, 25).getTime(), inicio = new Date(2026, 10, 24, 12).getTime();
    assert.deepEqual(divisoes, [Number(((meiaNoite - inicio) / (fim - inicio) * 600).toFixed(1))], 'uma linha só, na meia-noite');
    assert.deepEqual([...corpo.matchAll(/<span class="sr-dia"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]), ['25/11'], 'com o dia novo ao lado');
    assert.ok(corpo.indexOf('class="sr-divisao"') < corpo.indexOf('class="sr-linha"'), 'por baixo da linha da série');
    g.contexto.lerSerie(0);
    assert.equal(g.els.serieLeitura.textContent, '24/11 12:00 · 10', 'a leitura do primeiro ponto diz o dia de ontem');

    g.contexto.mudarHorizonte('7d'); await assentar();
    corpo = g.els.serieCorpo.innerHTML;
    assert.match(corpo, /<div class="sr-x[^"]*"[^>]*><span>18\/11 12:00<\/span><span>Agora<\/span><\/div>/, 'o 7d começa no dia e na hora');
    assert.deepEqual([...corpo.matchAll(/<span class="sr-dia"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]),
      ['19', '20', '21', '22', '23', '24', '25'], 'uma por meia-noite, só com o dia (sete rótulos a 384 px não cabem com o mês)');
    assert.equal((corpo.match(/class="sr-divisao"/g) || []).length, 7);

    g.contexto.mudarHorizonte('14d'); await assentar();
    assert.doesNotMatch(g.els.serieCorpo.innerHTML, /sr-divisao|sr-dia/, 'o 14d fica como estava');
  });

  test('os estados: sem dados e erro (com o Tentar outra vez); uma resposta atrasada não pinta por cima da escolha nova', async () => {
    let modo = 'vazio';
    const g = await correrGuiao((rota) => {
      if (/\/serie\?/.test(rota)) {
        if (modo === 'vazio') return { ...SERIE('7d'), pontos: [], desde: null };
        return null;
      }
      return responder(rota);
    });
    g.contexto.verSerie('erros', 'Erros nas 24 h'); await assentar();
    assert.match(g.els.serieCorpo.innerHTML, /Ainda sem dados\./);
    // o erro: o servidor responde 500
    g.contexto.fetch = async () => new Response(JSON.stringify({ error: 'Rebentou.' }), { status: 500 });
    modo = 'erro';
    g.contexto.mudarHorizonte('1d'); await assentar();
    assert.match(g.els.serieCorpo.innerHTML, /Não deu para ler a série\.[\s\S]*Rebentou\.[\s\S]*data-acao="recarregarSerie"/);

    // a corrida: o 3m responde depois do 1a, que foi escolhido depois — fica o 1a
    let soltar3m;
    g.contexto.fetch = async (rota) => {
      const h = /horizonte=(\w+)/.exec(String(rota))[1];
      const r = new Response(JSON.stringify({ ...SERIE(h), pontos: h === '3m' ? [{ t: 0, v: 99 }] : [{ t: 0, v: 5 }, { t: 8 * HORA, v: 7, vivo: true }] }), { status: 200 });
      if (h === '3m') return new Promise((ok) => { soltar3m = () => ok(r); });
      return r;
    };
    g.contexto.mudarHorizonte('3m'); await assentar();
    g.contexto.mudarHorizonte('1a'); await assentar();
    soltar3m(); await assentar();
    assert.match(g.els.serieCorpo.innerHTML, /data-pontos="2"/, 'o desenho é o do 1a');
    assert.equal(g.els.serieLeitura.textContent, 'Agora · 7');
  });
});
