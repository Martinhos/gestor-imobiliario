// A entrega: o que o deploy confere antes e depois de publicar, o terraform,
// os fins de linha, o limpar-dev, os atalhos do package.json e os restos do
// repositório.
//
// Os workflows não se correm aqui — leem-se como quem os vai correr: os passos
// pela ordem do ficheiro, o bash de cada um, as condições. Onde o bash decide
// alguma coisa que se possa correr sem a Cloudflare nem o GitHub (juntar os
// segredos), corre-se mesmo. As decisões de rede vivem em scripts/entrega.js
// como funções puras, e é isso que se exercita.

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const RAIZ = new URL('../', import.meta.url);

// Recebe: p — caminho relativo à raiz do repositório.
// Devolve: o texto do ficheiro, com os fins de linha normalizados para \n.
const ler = (p) => readFileSync(new URL(p, RAIZ), 'utf8').replace(/\r\n/g, '\n');
// Recebe: p — caminho relativo à raiz. Devolve: true se o ficheiro existe.
const existe = (p) => existsSync(new URL(p, RAIZ));

/* Os jobs de um workflow, pelo nome (as chaves a dois espaços debaixo de jobs:).
   Recebe: yml — o texto do workflow.
   Devolve: array com os nomes dos jobs. */
function jobsDe(yml) {
  const linhas = yml.split('\n');
  const i = linhas.findIndex((l) => /^jobs:\s*$/.test(l));
  return linhas.slice(i + 1).map((l) => l.match(/^ {2}([\w-]+):\s*$/)).filter(Boolean).map((m) => m[1]);
}

/* Os passos de um job, lidos do texto: cada «- » à indentação dos passos abre
   um; dentro dele, as chaves (name, id, if, uses, run…) e o bloco do run — as
   linhas mais indentadas que ele.
   Recebe: yml — o texto do workflow; job — o nome do job.
   Devolve: array de {name, id, if, run, texto} pela ordem do ficheiro. */
function passos(yml, job) {
  const linhas = yml.split('\n');
  const ini = linhas.findIndex((l) => l === '  ' + job + ':');
  assert.ok(ini >= 0, 'o job ' + job + ' existe');
  const iSteps = linhas.findIndex((l, i) => i > ini && /^ {4}steps:\s*$/.test(l));
  const brutos = [];
  let atual = null;
  for (let i = iSteps + 1; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^ {0,4}\S/.test(l)) break;              // outro job, ou outra chave do job
    if (/^ {6}- /.test(l)) { atual = []; brutos.push(atual); }
    if (atual) atual.push(l);
  }
  return brutos.map((texto) => {
    const p = { texto: texto.join('\n') };
    for (let j = 0; j < texto.length; j++) {
      const m = texto[j].match(/^(?: {6}- | {8})([\w-]+):\s*(.*)$/);
      if (!m) continue;
      if (m[1] === 'run' && /^[|>]-?$/.test(m[2])) {
        const bloco = [];
        for (let k = j + 1; k < texto.length && (/^ {10}/.test(texto[k]) || texto[k].trim() === ''); k++) bloco.push(texto[k].slice(10));
        p.run = bloco.join('\n').replace(/\s+$/, '');
      } else {
        p[m[1]] = m[2].trim();
      }
    }
    return p;
  });
}

/* O índice do primeiro passo cujo run (ou nome) casa com a expressão.
   Recebe: ps — os passos; re — expressão a procurar no run; campo (opcional) — 'name' para procurar no nome.
   Devolve: o índice, ou -1. */
function onde(ps, re, campo) {
  return ps.findIndex((p) => re.test((campo ? p[campo] : p.run) || ''));
}

const DEPLOY = ler('.github/workflows/deploy.yml');
const PASSOS = passos(DEPLOY, 'deploy');

/* O que mexe em alguma coisa fora do runner: a conta da Cloudflare, o
   repositório, o Discord. Nada disto pode acontecer antes de se saber que os
   testes deste commit passaram. */
const EFEITOS = /terraform (?:plan|apply)|wrangler@4 (?:d1|deploy|rollback)|git push|discord-register/;

describe('o deploy espera pelos testes', () => {
  // achado A.7-1
  test('a publicação só sai depois de o «Testes» deste commit ficar verde, e o dispatch de emergência continua lá', () => {
    // a promoção (push ao main) e o dev continuam a publicar; a saída de emergência também
    assert.match(DEPLOY, /^on:\n {2}push:\n {4}branches: \[main, dev\]\n {2}workflow_dispatch:/m, 'push a main e a dev, e o dispatch');
    assert.match(DEPLOY, /ambiente:[\s\S]*?options: \[producao, dev\]/, 'o dispatch escolhe o ambiente');

    const espera = onde(PASSOS, /node scripts\/entrega\.js testes\b/);
    assert.ok(espera >= 0, 'há um passo que espera pelo «Testes» deste commit');
    assert.match(PASSOS[espera].texto, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/, 'com o token do próprio workflow');
    assert.match(PASSOS[espera].texto, /timeout-minutes: \d+/, 'e com um limite de tempo');
    assert.match(DEPLOY, /^permissions:\n(?: {2}.*\n)*? {2}actions: read\b/m, 'o token pode ler as corridas das Actions');
    const antes = PASSOS.slice(0, espera).filter((p) => EFEITOS.test(p.run || '')).map((p) => p.name);
    assert.deepEqual(antes, [], 'nada que mexa lá fora corre antes de os testes passarem');
    assert.ok(PASSOS.slice(espera).filter((p) => EFEITOS.test(p.run || '')).length >= 4, 'e tudo o que mexe corre depois');

    // aquilo por que se espera existe e corre nos mesmos pushes
    const t = ler('.github/workflows/testes.yml');
    assert.match(t, /^name: Testes$/m);
    assert.match(t, /^ {2}push:\n {4}branches: \[main, dev\]/m, 'o «Testes» corre em cada push a main e a dev');
    assert.match(ler('scripts/entrega.js'), /actions\/workflows\/testes\.yml\/runs\?head_sha=/, 'e pergunta-se pelo testes.yml deste commit');
  });

  test('o estado dos testes de um commit: basta uma corrida verde, espera-se enquanto houver uma a correr', () => {
    const { estadoDosTestes } = require('../scripts/entrega.js');
    assert.equal(estadoDosTestes([]), 'nenhuma');
    assert.equal(estadoDosTestes([{ status: 'queued', conclusion: null }]), 'a correr');
    assert.equal(estadoDosTestes([{ status: 'completed', conclusion: 'failure' }]), 'vermelho');
    assert.equal(estadoDosTestes([{ status: 'completed', conclusion: 'cancelled' }]), 'vermelho', 'cancelado não é verde');
    assert.equal(estadoDosTestes([{ status: 'completed', conclusion: 'failure' }, { status: 'in_progress', conclusion: null }]), 'a correr',
      'uma repetição a correr ainda pode ficar verde');
    assert.equal(estadoDosTestes([{ status: 'completed', conclusion: 'failure' }, { status: 'completed', conclusion: 'success' }]), 'verde',
      'num avanço rápido o mesmo commit tem a corrida do dev e a do main');
  });

  test('esperar pelos testes: segue quando ficam verdes, trava quando falham ou quando nunca aparecem', async () => {
    const { esperarTestes } = require('../scripts/entrega.js');
    const base = { dormir: async () => {}, intervalo: 1, voltas: 10, semCorrida: 3, escrever: () => {} };
    // Recebe: seq — as respostas da API, por ordem (a última repete-se).
    // Devolve: a função pedir que as vai dando.
    const respostas = (seq) => { let i = 0; return async () => { const r = seq[Math.min(i++, seq.length - 1)]; if (r instanceof Error) throw r; return r; }; };

    const verde = await esperarTestes({ ...base, evento: 'push',
      pedir: respostas([[], new Error('502'), [{ status: 'in_progress' }], [{ status: 'completed', conclusion: 'success' }]]) });
    assert.equal(verde.ok, true, 'a corrida apareceu, a API espirrou uma vez, e acabou verde');

    const vermelho = await esperarTestes({ ...base, evento: 'push',
      pedir: respostas([[{ status: 'completed', conclusion: 'failure', html_url: 'https://x/1' }]]) });
    assert.equal(vermelho.ok, false);
    assert.match(vermelho.motivo, /falharam[\s\S]*https:\/\/x\/1/, 'e diz qual');

    const semNada = await esperarTestes({ ...base, evento: 'workflow_dispatch', pedir: respostas([[]]) });
    assert.equal(semNada.ok, false, 'sem corrida não se publica');
    assert.match(semNada.motivo, /Run workflow/, 'no dispatch diz como a pedir à mão');

    const semFim = await esperarTestes({ ...base, voltas: 4, evento: 'push', pedir: respostas([[{ status: 'in_progress' }]]) });
    assert.equal(semFim.ok, false, 'um «Testes» que não acaba não deixa passar');
  });
});

/* Os blocos resource de um main.tf, com o corpo de cada um (as chavetas
   contadas, que o HCL aninha).
   Recebe: tf — o texto do main.tf.
   Devolve: mapa {'tipo.nome': corpo}. */
function recursosTf(tf) {
  const out = {};
  const re = /^resource "([\w]+)" "([\w]+)" \{/gm;
  let m;
  while ((m = re.exec(tf))) {
    let d = 0, i = m.index + m[0].length - 1;
    for (; i < tf.length; i++) {
      if (tf[i] === '{') d++;
      if (tf[i] === '}' && --d === 0) break;
    }
    out[m[1] + '.' + m[2]] = tf.slice(m.index, i + 1);
  }
  return out;
}

describe('o terraform não destrói o que tem dados', () => {
  // achado A.7-2
  test('as bases e os baldes têm prevent_destroy, e o deploy aplica só um plano lido e sem destruições', () => {
    const r = recursosTf(ler('terraform/main.tf'));
    for (const a of ['cloudflare_d1_database.db', 'cloudflare_d1_database.db_dev', 'cloudflare_r2_bucket.files', 'cloudflare_r2_bucket.files_dev']) {
      assert.ok(r[a], a + ' existe');
      assert.match(r[a], /lifecycle \{\s*prevent_destroy = true\s*\}/, a + ' não se destrói');
    }

    const tf = PASSOS[onde(PASSOS, /terraform init/)];
    assert.ok(tf, 'o passo do terraform existe');
    assert.doesNotMatch(DEPLOY, /-auto-approve/, 'nada de apply sem plano');
    const plano = tf.run.search(/terraform plan -input=false -out=/);
    const le = tf.run.search(/node \.\.\/scripts\/entrega\.js plano /);
    const aplica = tf.run.search(/terraform apply -input=false "\$RUNNER_TEMP\/plano\.tfplan"/);
    assert.ok(plano >= 0 && le > plano && aplica > le, 'plano → leitura do plano → apply desse plano, por esta ordem');
    assert.match(tf.texto, /ACEITAR_DESTRUICAO: \$\{\{ inputs\.aceitar_destruicao \}\}/, 'a aceitação é escrita à mão, no dispatch');
    assert.match(DEPLOY, /aceitar_destruicao:\n {8}description: /, 'e o dispatch tem o campo');
  });

  test('o plano: destruir ou substituir trava, salvo o que se aceitou por nome; só no-op não muda nada', () => {
    const { analisarPlano } = require('../scripts/entrega.js');
    // Recebe: acoes — as ações de cada recurso, por endereço. Devolve: um plano no formato do terraform show -json.
    const plano = (acoes, saidas) => ({
      resource_changes: Object.entries(acoes).map(([address, actions]) => ({ address, change: { actions } })),
      output_changes: saidas || {},
    });
    const parado = analisarPlano(plano({ 'cloudflare_d1_database.db': ['no-op'], 'cloudflare_r2_bucket.files': ['no-op'] }), []);
    assert.deepEqual(parado, { muda: false, destruir: [], recusadas: [] }, 'só o file_size refrescado: nada a aplicar');

    const troca = analisarPlano(plano({ 'cloudflare_d1_database.db': ['delete', 'create'], 'cloudflare_workers_kv_namespace.sessions': ['create', 'delete'] }), []);
    assert.deepEqual(troca.recusadas, ['cloudflare_d1_database.db', 'cloudflare_workers_kv_namespace.sessions'], 'uma substituição é uma destruição');

    const aceite = analisarPlano(plano({ 'cloudflare_r2_bucket.files_dev': ['delete'], 'cloudflare_d1_database.db': ['delete'] }), ['cloudflare_r2_bucket.files_dev']);
    assert.deepEqual(aceite.recusadas, ['cloudflare_d1_database.db'], 'aceitar um não aceita os outros');
    assert.equal(analisarPlano(plano({ 'cloudflare_r2_bucket.files_dev': ['delete'] }), ['cloudflare_r2_bucket.files_dev']).recusadas.length, 0);

    assert.equal(analisarPlano(plano({ 'cloudflare_d1_database.db': ['update'] }), []).muda, true, 'uma atualização aplica-se');
    assert.equal(analisarPlano(plano({ 'x.y': ['no-op'] }, { d1_dev_id: { actions: ['create'] } }), []).muda, true, 'uma saída nova também');
    assert.equal(analisarPlano({}, []).muda, false, 'um plano vazio não muda nada');
  });
});

/* Um servidor HTTP local que responde o que se lhe disser, pela ordem.
   Recebe: respostas — array de funções (caminho) → {status, corpo}; a última repete-se.
   Devolve: Promise de {base, fechar}. */
function servidor(respostas) {
  let n = 0;
  const s = createServer((req, res) => {
    const caminho = req.url.split('?')[0];
    const r = respostas[Math.min(Math.floor(n / 2), respostas.length - 1)](caminho);
    n++;
    res.writeHead(r.status, { 'content-type': 'text/plain' });
    res.end(r.corpo || '');
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok({
    base: 'http://127.0.0.1:' + s.address().port,
    fechar: () => new Promise((f) => s.close(f)),
  })));
}

describe('depois de publicar, confirma-se', () => {
  const ESPERADO = { versao: 39, minima: 0, data: '2026-09-15' };
  // Recebe: v — o objeto de versão a servir. Devolve: a resposta do servidor de teste para cada caminho.
  const serve = (v, raiz = 200) => (caminho) => (caminho === '/versao.json'
    ? { status: 200, corpo: JSON.stringify(v, null, 2) + '\n' } : { status: raiz, corpo: '<!doctype html>' });

  // achado A.7-4
  test('o passo a seguir ao deploy confere a versão acabada de gerar, e há um recuo escrito', () => {
    const gera = onde(PASSOS, /node scripts\/versao\.js/);
    const publica = onde(PASSOS, /npx wrangler@4 deploy /);
    const confirma = onde(PASSOS, /node scripts\/entrega\.js publicacao "\$APP_URL"/);
    assert.ok(gera >= 0 && publica > gera && confirma === publica + 1, 'gera a versão → publica → confirma logo a seguir');
    assert.equal(PASSOS[confirma].id, 'confirmar');
    const esc = PASSOS[onde(PASSOS, /ENV_FLAG=/)].run;
    assert.match(esc, /APP_URL=https:\/\/app\.rendorium\.com/, 'produção confere o endereço canónico');
    assert.match(esc, /APP_URL=https:\/\/dev\.rendorium\.com/, 'e o dev o dele');

    const recuo = PASSOS[onde(PASSOS, /wrangler@4 rollback/)];
    assert.ok(recuo, 'há um passo de recuo');
    assert.match(recuo.if, /^failure\(\) && steps\.confirmar\.outputs\.veredicto == 'avaria'$/, 'só quando o worker novo responde com erro');
    assert.match(recuo.run, /wrangler@4 rollback --yes --message "[^"]+" \$ENV_FLAG/, 'no ambiente certo, sem perguntar');

    const readme = ler('README.md');
    const sec = readme.slice(readme.indexOf('## Se uma publicação correu mal'));
    assert.ok(readme.includes('## Se uma publicação correu mal'), 'o README tem o caminho de recuo');
    assert.match(sec, /Rollback/, 'o recuo à mão, no painel');
    assert.match(sec, /migrações[^\n]*não recuam/i, 'o que o recuo não desfaz');
    assert.match(sec, /versão nova|sobe a versão|subir a versão/i, 'e que uma avaria na app se corrige para a frente');
  });

  test('a confirmação: segue quando a versão nova responde, e distingue avaria de «ainda a antiga»', async () => {
    const { confirmarPublicacao, pedirHttp } = require('../scripts/entrega.js');
    const base = { esperado: ESPERADO, pedir: pedirHttp, dormir: async () => {}, intervalo: 1, tentativas: 4, escrever: () => {} };

    const chega = await servidor([serve({ ...ESPERADO, versao: 38 }), serve(ESPERADO)]);
    try {
      const r = await confirmarPublicacao({ ...base, base: chega.base });
      assert.equal(r.veredicto, 'ok', 'à segunda tentativa já responde a nova: ' + r.detalhe);
    } finally { await chega.fechar(); }

    const velha = await servidor([serve({ ...ESPERADO, versao: 38 })]);
    try {
      assert.equal((await confirmarPublicacao({ ...base, base: velha.base })).veredicto, 'outra-versao');
    } finally { await velha.fechar(); }

    const partida = await servidor([serve(ESPERADO, 500)]);
    try {
      assert.equal((await confirmarPublicacao({ ...base, base: partida.base })).veredicto, 'avaria', 'a raiz passa pelo worker: 5xx é o worker partido');
    } finally { await partida.fechar(); }

    const barrada = await servidor([() => ({ status: 403, corpo: 'não' })]);
    try {
      assert.equal((await confirmarPublicacao({ ...base, base: barrada.base })).veredicto, 'sem-resposta', 'um 403 não diz nada sobre o worker');
    } finally { await barrada.fechar(); }

    const ninguem = await confirmarPublicacao({ ...base, base: 'http://127.0.0.1:9' });
    assert.equal(ninguem.veredicto, 'sem-resposta', 'sem ligação também não');
  });
});

/* Os três comandos do entrega.js tal como o deploy os chama: com as variáveis
   do Actions no ambiente, a rede num servidor local, e o que escrevem para os
   passos seguintes (o stdout do plano, o GITHUB_OUTPUT da publicação). */
describe('os comandos do entrega.js, como o deploy os chama', () => {
  /* Muda variáveis de ambiente enquanto fn corre, cala a consola, e repõe tudo.
     Recebe: vars — {nome: valor}; fn — a função (pode ser assíncrona).
     Devolve: Promise de {r, log} — o que fn devolveu e as linhas do console.log. */
  async function comAmbiente(vars, fn) {
    const antes = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    Object.assign(process.env, vars);
    const log = mock.method(console, 'log', () => {});
    const err = mock.method(console, 'error', () => {});
    try {
      const r = await fn();
      return { r, log: log.mock.calls.map((c) => String(c.arguments[0])) };
    } finally {
      log.mock.restore(); err.mock.restore();
      for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
  }

  test('plano: diz «muda» ou «nada» numa palavra, e recusa o que destrói sem aceitação', async () => {
    const { comandoPlano } = require('../scripts/entrega.js');
    const tmp = mkdtempSync(join(tmpdir(), 'plano-'));
    try {
      // Recebe: nome — o ficheiro; acoes — as ações do recurso. Devolve: o caminho do plano escrito.
      const plano = (nome, acoes) => {
        const f = join(tmp, nome);
        writeFileSync(f, JSON.stringify({ resource_changes: [{ address: 'cloudflare_d1_database.db', change: { actions: acoes } }] }));
        return f;
      };
      const nada = await comAmbiente({ ACEITAR_DESTRUICAO: '' }, () => comandoPlano(plano('a.json', ['no-op'])));
      assert.deepEqual([nada.r, nada.log], [0, ['nada']]);
      const muda = await comAmbiente({ ACEITAR_DESTRUICAO: '' }, () => comandoPlano(plano('b.json', ['update'])));
      assert.deepEqual([muda.r, muda.log], [0, ['muda']]);
      const troca = await comAmbiente({ ACEITAR_DESTRUICAO: '' }, () => comandoPlano(plano('c.json', ['delete', 'create'])));
      assert.deepEqual([troca.r, troca.log], [1, []], 'recusa, e não diz nada no stdout que o bash tome por um veredicto');
      const aceite = await comAmbiente({ ACEITAR_DESTRUICAO: 'cloudflare_d1_database.db' }, () => comandoPlano(plano('d.json', ['delete', 'create'])));
      assert.deepEqual([aceite.r, aceite.log], [0, ['muda']], 'aceite à mão pelo endereço, aplica-se');
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

  test('testes: pergunta à API do GitHub pelas corridas do testes.yml deste commit, com o token', async () => {
    const { comandoTestes } = require('../scripts/entrega.js');
    const pedidos = [];
    const s = createServer((req, res) => {
      pedidos.push({ url: req.url, auth: req.headers.authorization });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ workflow_runs: [{ status: 'completed', conclusion: 'success' }] }));
    });
    await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
    try {
      const { r } = await comAmbiente({
        GITHUB_API_URL: 'http://127.0.0.1:' + s.address().port, GITHUB_REPOSITORY: 'dono/repo',
        GITHUB_SHA: 'abc123', GITHUB_TOKEN: 'tk', GITHUB_EVENT_NAME: 'push',
      }, () => comandoTestes());
      assert.equal(r, 0, 'verde: segue');
      assert.deepEqual(pedidos, [{ url: '/repos/dono/repo/actions/workflows/testes.yml/runs?head_sha=abc123&per_page=100', auth: 'Bearer tk' }]);
    } finally { await new Promise((f) => s.close(f)); }
  });

  test('publicacao: confirma contra o web/versao.json desta árvore e deixa o veredicto ao passo do recuo', async () => {
    const { comandoPublicacao } = require('../scripts/entrega.js');
    const versao = JSON.parse(ler('web/versao.json'));
    const srv = await servidor([(caminho) => (caminho === '/versao.json' ? { status: 200, corpo: JSON.stringify(versao) } : { status: 200, corpo: 'ok' })]);
    const tmp = mkdtempSync(join(tmpdir(), 'saida-'));
    const saida = join(tmp, 'github_output');
    writeFileSync(saida, '');
    try {
      const { r } = await comAmbiente({ GITHUB_OUTPUT: saida }, () => comandoPublicacao(srv.base + '/'));
      assert.equal(r, 0);
      assert.equal(readFileSync(saida, 'utf8'), 'veredicto=ok\n', 'o passo do recuo lê isto');
    } finally { await srv.fechar(); rmSync(tmp, { recursive: true, force: true }); }
  });

  test('publicacao: um worker partido dá «avaria» ao passo do recuo e deixa o caminho no resumo da corrida', async () => {
    const { comandoPublicacao } = require('../scripts/entrega.js');
    const srv = await servidor([() => ({ status: 503, corpo: 'partido' })]);
    const tmp = mkdtempSync(join(tmpdir(), 'saida-'));
    const saida = join(tmp, 'github_output'), resumo = join(tmp, 'resumo');
    writeFileSync(saida, ''); writeFileSync(resumo, '');
    try {
      const { r } = await comAmbiente({ GITHUB_OUTPUT: saida, GITHUB_STEP_SUMMARY: resumo },
        () => comandoPublicacao(srv.base, { tentativas: 2, intervalo: 1 }));
      assert.equal(r, 1, 'não confirmado: o passo falha');
      assert.equal(readFileSync(saida, 'utf8'), 'veredicto=avaria\n', 'e o recuo corre');
      assert.match(readFileSync(resumo, 'utf8'), /Se uma publicação correu mal/, 'o resumo aponta para o README');
    } finally { await srv.fechar(); rmSync(tmp, { recursive: true, force: true }); }
  });
});

describe('o módulo gerado', () => {
  // achado A.7-5
  test('não vai no git, e gera-se em todo o sítio que o lê antes do wrangler', () => {
    const ignorados = ler('.gitignore').split('\n').map((l) => l.trim());
    assert.ok(ignorados.includes('worker/src/docs-gerados.js'), 'o .gitignore tem-no');

    const pkg = JSON.parse(ler('package.json'));
    assert.equal(pkg.scripts.predev, 'node scripts/gerar-docs.js', 'o npm run dev gera-o antes do wrangler dev');
    assert.equal(pkg.scripts.prepare, 'node scripts/gerar-docs.js', 'o npm install e o npm ci também');

    // em qualquer workflow, um passo que levante ou publique o worker tem de
    // ter antes, no mesmo job, o gerador — ou um npm ci/install, que corre o prepare
    const pasta = new URL('.github/workflows/', RAIZ);
    let vistos = 0;
    for (const f of readdirSync(pasta).filter((n) => n.endsWith('.yml'))) {
      const yml = ler('.github/workflows/' + f);
      for (const job of jobsDe(yml)) {
        const ps = passos(yml, job);
        ps.forEach((p, i) => {
          if (!/wrangler(?:@4)? (?:dev|deploy)\b/.test(p.run || '')) return;
          vistos++;
          const gerou = ps.slice(0, i).some((q) => /node scripts\/gerar-docs\.js|\bnpm (?:ci|install)\b/.test(q.run || ''));
          assert.ok(gerou, f + ' › ' + job + ' › «' + p.name + '» corre o wrangler sem gerar os docs antes');
        });
      }
    }
    assert.ok(vistos >= 2, 'viu o deploy e o percurso (' + vistos + ')');

    const gd = ler('scripts/gerar-docs.js');
    assert.doesNotMatch(gd, /o resultado vai\s+(?:\/\/\s*)?no repositório/, 'o comentário deixou de dizer que vai no git');
    assert.match(gd, /\.gitignore/, 'e diz porque não vai');
  });
});

describe('o README', () => {
  // achado A.7-6
  test('diz o que o código faz: anexos no R2, o token que o deploy usa, as origens da Google', () => {
    const r = ler('README.md');
    assert.doesNotMatch(r, /ficam apenas no aparelho/, 'os anexos já não são só do aparelho');
    assert.match(r, /\| Anexos \| Cloudflare R2/, 'a arquitetura tem o R2');
    assert.ok(existe('worker/src/files.js') && /env\.FILES\.put/.test(ler('worker/src/files.js')), 'e o R2 está mesmo no código');
    assert.match(r, /cria as duas D1, os dois KV e os dois R2/, 'o que o terraform cria');
    const token = r.slice(r.indexOf('## Deploy (uma vez)'), r.indexOf('## Entrada com Google'));
    for (const p of ['Workers Scripts', 'D1', 'Workers KV Storage', 'Workers R2 Storage', 'Workers Routes', 'DNS']) {
      assert.ok(token.includes(p), 'o token do deploy leva ' + p);
    }
    const google = r.slice(r.indexOf('## Entrada com Google'));
    assert.match(google, /https:\/\/app\.rendorium\.com/, 'a origem canónica autorizada na Google');
    assert.match(ler('wrangler.toml'), /https:\/\/app\.rendorium\.com/, 'que é a que o wrangler.toml manda autorizar');
  });
});

describe('os fins de linha', () => {
  // achado A.7-8
  test('o repositório pede LF em todas as máquinas, e o --check da versão não se engana com CRLF', () => {
    assert.ok(existe('.gitattributes'), 'há .gitattributes');
    const ga = ler('.gitattributes');
    assert.match(ga, /^\* text=auto eol=lf$/m, 'LF no repositório e na cópia de trabalho');
    for (const ext of ['png', 'webp', 'jar', 'keystore', 'apk']) assert.match(ga, new RegExp('^\\*\\.' + ext + ' binary$', 'm'), ext + ' é binário');
    assert.match(ga, /^\*\.bat text eol=crlf$/m, 'os .bat do Windows ficam com CRLF');

    const src = ler('scripts/versao.js');
    assert.match(src, /require\.main === module/, 'o versao.js pode ler-se sem escrever o ficheiro');
    const { conteudoDe, emDia } = require('../scripts/versao.js');
    const esperado = conteudoDe(require('../web/avisos.js'));
    assert.equal(emDia(esperado.replace(/\n/g, '\r\n'), esperado), true, 'um checkout com CRLF está em dia');
    assert.equal(emDia(esperado.replace(/"versao": \d+/, '"versao": 1'), esperado), false, 'uma versão errada não');
    assert.equal(emDia(ler('web/versao.json'), esperado), true, 'e o ficheiro desta árvore está em dia');
  });
});

/* As tabelas das migrações e as chaves estrangeiras entre elas.
   Devolve: {tabelas: Set, refs: array de [filha, mãe]}. */
function esquema() {
  const tabelas = new Set();
  const refs = [];
  for (const f of readdirSync(new URL('migrations/', RAIZ)).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = ler('migrations/' + f).replace(/--.*$/gm, '');
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      tabelas.add(m[1]);
      for (const r of m[2].matchAll(/REFERENCES (\w+)/gi)) refs.push([m[1], r[1]]);
    }
    for (const m of sql.matchAll(/ALTER TABLE (\w+) ADD COLUMN [^;]*?REFERENCES (\w+)/gi)) refs.push([m[1], m[2]]);
  }
  return { tabelas, refs };
}

describe('limpar o dev', () => {
  /* O que fica de propósito numa limpeza: o rasto da equipa e o que é da
     equipa, não de uma conta. Uma tabela nova nas migrações tem de entrar na
     lista do workflow ou aqui — e, aqui, com a razão no cabeçalho dele. */
  const FICAM = ['audit_log', 'op_log', 'team_links', 'reply_templates'];

  // achado A.7-10
  test('a lista de tabelas do limpar-dev é a do esquema menos o que fica, por ordem das chaves estrangeiras', () => {
    const yml = ler('.github/workflows/limpar-dev.yml');
    const m = yml.match(/for t in ([\s\S]*?); do/);
    assert.ok(m, 'o ciclo das tabelas');
    const lista = m[1].split(/[\s\\]+/).filter(Boolean);
    const { tabelas, refs } = esquema();
    assert.ok(tabelas.size >= 20 && tabelas.has('user_services'), 'leu as migrações todas (' + tabelas.size + ')');

    const esperadas = [...tabelas].filter((t) => !FICAM.includes(t)).sort();
    assert.deepEqual([...lista].sort(), esperadas, 'as tabelas de conta, nem mais nem menos');
    for (const t of FICAM) {
      assert.ok(tabelas.has(t), t + ' existe no esquema');
      assert.match(yml.slice(0, yml.indexOf('name:')), new RegExp('\\b' + t + '\\b'), t + ' fica — e o cabeçalho diz porquê');
    }
    for (const [filha, mae] of refs) {
      if (!lista.includes(filha) || !lista.includes(mae) || filha === mae) continue;
      assert.ok(lista.indexOf(filha) < lista.indexOf(mae), filha + ' aponta para ' + mae + ': tem de sair antes');
    }
  });
});

describe('o estado do terraform e a publicação anterior', () => {
  // achado A.7-11
  test('o estado vive no R2 e só se guarda quando o apply mudou alguma coisa, e o guarda da chegada compara com a etiqueta «publicado»', () => {
    const tf = PASSOS[onde(PASSOS, /terraform init/)];
    const apply = tf.run.indexOf('terraform apply');
    const marca = tf.run.indexOf('TF_MUDOU=1');
    assert.ok(apply >= 0 && marca > apply, 'TF_MUDOU só se escreve depois de um apply');

    /* o estado não vai no repositório (é público): vem do R2 antes do terraform
       e volta para lá depois de um apply que mudou alguma coisa */
    assert.ok(!/git add terraform\/terraform\.tfstate/.test(DEPLOY), 'o estado já não se comita');
    assert.match(ler('.gitignore'), /^terraform\/terraform\.tfstate$/m, 'e o .gitignore cobre-o');
    /* pelo nome do passo: a mensagem de ajuda de um deles traz os comandos do
       outro lá dentro, e uma procura pelo comando apanhava o passo errado */
    /* pelo nome do passo: a mensagem de ajuda de um deles traz os comandos do
       outro lá dentro, e uma procura pelo comando apanhava o passo errado */
    const trazer = onde(PASSOS, /^Trazer o estado do terraform$/, 'name');
    const correr = onde(PASSOS, /terraform init/);
    assert.ok(trazer > -1 && trazer < correr, 'o estado vem do R2 antes de o terraform correr');
    assert.match(PASSOS[trazer].run, /r2 object get .*terraform\.tfstate/, 'traz-se do R2');
    assert.match(PASSOS[trazer].run, /exit 1/, 'e sem estado, sem pedido explícito, o deploy para');
    const guardar = PASSOS[onde(PASSOS, /^Guardar o estado do terraform no R2$/, 'name')];
    assert.match(guardar.run, /r2 object put .*terraform\.tfstate/, 'e volta para lá depois do apply');
    assert.match(guardar.if, /env\.TF_MUDOU/, 'o estado só volta ao R2 quando o apply mudou alguma coisa');
    assert.match(guardar.run, /historico\//, 'e fica também uma cópia datada, para se poder voltar atrás');

    const guarda = PASSOS[onde(PASSOS, /node scripts\/chegada\.js /)];
    assert.match(guarda.run, /^node scripts\/chegada\.js refs\/tags\/publicado HEAD\^1$/, 'a etiqueta primeiro; o HEAD^1 só enquanto ela não existe');
    assert.equal(guarda.if, 'env.IS_PROD', 'em produção, no push e no dispatch');

    const confirma = onde(PASSOS, /entrega\.js publicacao/);
    const etiqueta = onde(PASSOS, /git tag -f publicado "\$GITHUB_SHA"/);
    assert.ok(etiqueta > confirma, 'a etiqueta só se move depois de a publicação responder');
    assert.equal(PASSOS[etiqueta].if, 'env.IS_PROD', 'e só em produção');
    assert.match(PASSOS[etiqueta].run, /git push -f origin refs\/tags\/publicado/);
    assert.match(DEPLOY, /^ {2}contents: write\b/m, 'o token pode mover a etiqueta');
  });
});

/* Um bash que tenha o node à mão, para correr o bash dos passos a sério: no CI
   é o do sistema; no Windows, o do Git (o «bash» do PATH pode ser o do WSL,
   que não vê o node do Windows).
   Devolve: o caminho do bash, ou null. */
function bashComNode() {
  const candidatos = process.platform === 'win32'
    ? [join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'), 'bash'] : ['bash'];
  for (const b of candidatos) {
    const r = spawnSync(b, ['-c', 'command -v node'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return b;
  }
  return null;
}
const BASH = bashComNode();

/* Corre o bash do passo «Juntar os segredos» com o ambiente dado e devolve o
   que ficou no ficheiro dos segredos.
   Recebe: vars — as variáveis do ambiente do passo (IS_PROD, os segredos).
   Devolve: o objeto JSON dos segredos juntados. */
function juntar(vars) {
  const p = PASSOS[onde(PASSOS, /Juntar os segredos/, 'name')];
  const tmp = mkdtempSync(join(tmpdir(), 'segredos-'));
  try {
    const barra = (s) => s.replace(/\\/g, '/');
    const genv = join(tmp, 'github_env');
    writeFileSync(genv, '');
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^(DISCORD_|PASS_PEPPER|HEARTBEAT|RESEND|CF_|TESTE_CHAVE|DESTINO_|TF_VAR_)/.test(k)) delete env[k];
    const r = spawnSync(BASH, ['-eo', 'pipefail', '-c', p.run], {
      encoding: 'utf8', env: { ...env, RUNNER_TEMP: barra(tmp), GITHUB_ENV: barra(genv), ...vars },
    });
    assert.equal(r.status, 0, 'o bash correu: ' + r.stderr);
    const caminho = (readFileSync(genv, 'utf8').match(/^SEGREDOS=(.+)$/m) || [])[1];
    assert.ok(caminho, 'o passo diz aos seguintes onde está o ficheiro');
    return JSON.parse(readFileSync(caminho.trim(), 'utf8'));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

describe('os segredos', () => {
  // achado A.7-12
  test('saem com o worker, numa versão só: nada de secret put, e o ficheiro não fica no disco', () => {
    const comPut = PASSOS.filter((p) => /secret (?:put|bulk)/.test(p.run || '')).map((p) => p.name);
    assert.deepEqual(comPut, [], 'um secret put por segredo era uma versão do worker por segredo');
    const junta = onde(PASSOS, /Juntar os segredos/, 'name');
    const publica = onde(PASSOS, /npx wrangler@4 deploy /);
    assert.ok(junta >= 0 && publica === junta + 1, 'junta-os e publica-os com o worker, a seguir');
    assert.match(PASSOS[publica].run, /npx wrangler@4 deploy \$ENV_FLAG --secrets-file "\$SEGREDOS"/, 'o código e os segredos numa versão');
    assert.match(PASSOS[publica].run, /trap 'rm -f "\$SEGREDOS"' EXIT/, 'e o ficheiro apaga-se, corra bem ou mal');
    assert.match(PASSOS[junta].run, /umask 077/, 'o ficheiro só é legível pelo runner');
    assert.match(PASSOS[junta].run, /eval "alt=\\"\\\$\{\$\{nome\}_DEV:-\}\\""/, 'no dev, o _DEV do mesmo nome continua a mandar');
  });

  test('o bash dos segredos, corrido: a precedência do _DEV, e o que é só de produção fica fora do dev', { skip: BASH ? false : 'sem um bash com o node à mão' }, () => {
    const prod = juntar({ IS_PROD: '1', DISCORD_BOT_TOKEN: 'bot-prod', DISCORD_BOT_TOKEN_DEV: 'bot-dev', HEARTBEAT_URL: 'https://hb',
      PASS_PEPPER: 'pimenta-prod', PASS_PEPPER_DEV: 'pimenta-dev', TESTE_CHAVE: 'a"b\\c$d' });
    assert.equal(prod.DISCORD_BOT_TOKEN, 'bot-prod', 'em produção o _DEV não conta');
    assert.equal(prod.PASS_PEPPER, 'pimenta-prod');
    assert.equal(prod.HEARTBEAT_URL, 'https://hb');
    assert.equal(prod.TESTE_CHAVE, 'a"b\\c$d', 'os valores passam tal e qual, aspas e barras incluídas');
    assert.ok(!('RESEND_API_KEY' in prod), 'um segredo sem valor não entra (no worker fica o que lá estava)');

    const dev = juntar({ IS_PROD: '', DISCORD_BOT_TOKEN: 'bot-prod', DISCORD_BOT_TOKEN_DEV: 'bot-dev', HEARTBEAT_URL: 'https://hb',
      PASS_PEPPER: 'pimenta-prod', PASS_PEPPER_DEV: 'pimenta-dev', TESTE_CHAVE: 'k' });
    assert.equal(dev.DISCORD_BOT_TOKEN, 'bot-dev', 'no dev manda o _DEV');
    assert.equal(dev.TESTE_CHAVE, 'k', 'sem _DEV, vale o partilhado');
    assert.equal(dev.PASS_PEPPER, 'pimenta-dev');
    assert.ok(!('HEARTBEAT_URL' in dev), 'o batimento de produção nunca no dev');

    const devSemPimenta = juntar({ IS_PROD: '', PASS_PEPPER: 'pimenta-prod' });
    assert.ok(!('PASS_PEPPER' in devSemPimenta), 'e o pepper de produção nunca no dev, mesmo sem o _DEV');
  });
});

describe('o README do Android', () => {
  // achado A.7-13
  test('diz o endereço que a concha carrega de facto, e como uma publicação lá chega', () => {
    const java = readFileSync(new URL('android/app/src/main/java/pt/gestorimobiliario/app/MainActivity.java', RAIZ), 'utf8');
    const host = (java.match(/HOST = "([^"]+)"/) || [])[1];
    assert.ok(host, 'a MainActivity tem o HOST');
    const r = ler('android/README.md');
    assert.ok(r.includes('https://' + host), 'o README diz https://' + host);
    assert.doesNotMatch(r.slice(0, r.indexOf('## ')), /workers\.dev/, 'e não o endereço antigo como o que se carrega');
    assert.match(r, /versao\.json/, 'a app pergunta pela versão');
  });
});

describe('os atalhos do package.json', () => {
  // achado A.7-15
  test('nenhum migra nem publica a partir do portátil', () => {
    const { scripts } = JSON.parse(ler('package.json'));
    for (const [nome, cmd] of Object.entries(scripts)) {
      assert.doesNotMatch(cmd, /--remote\b/, nome + ' não toca na base remota');
      assert.doesNotMatch(cmd, /wrangler deploy/, nome + ' não publica');
    }
    assert.ok(!('db:remote' in scripts), 'o atalho para migrar produção saiu');
    assert.match(scripts.deploy || '', /process\.exit\(1\)/, 'o npm run deploy diz por onde se publica, e falha');
  });
});

describe('os restos de sessões', () => {
  // achado A.7-16
  test('o launch.json das sessões e os worktrees dos agentes ficam fora do git', () => {
    const ignorados = ler('.gitignore').split('\n').map((l) => l.trim());
    assert.ok(ignorados.includes('.claude/launch.json'), 'o launch.json aponta para uma pasta temporária de uma sessão');
    assert.ok(ignorados.includes('.claude/worktrees/'), 'os worktrees dos agentes');
  });
});

describe('o pepper das palavras-passe', () => {
  // achado A.4-17b
  test('o deploy publica o PASS_PEPPER pela função put: o de produção em produção, o _DEV no dev, e nunca o de produção no dev', () => {
    const p = PASSOS[onde(PASSOS, /Juntar os segredos/, 'name')];
    assert.match(p.texto, /^ {10}PASS_PEPPER: \$\{\{ secrets\.PASS_PEPPER \}\}$/m);
    assert.match(p.texto, /^ {10}PASS_PEPPER_DEV: \$\{\{ secrets\.PASS_PEPPER_DEV \}\}$/m);
    assert.match(p.run, /if \[ -n "\$IS_PROD" \]; then\n\s*put PASS_PEPPER "\$PASS_PEPPER"\nelse\n\s*put PASS_PEPPER ""\nfi/,
      'no dev a função put só encontra o _DEV');
    assert.match(p.run, /nunca se muda nem se apaga/, 'e o aviso de que um pepper não se troca');
    assert.match(ler('README.md'), /PASS_PEPPER/, 'o README diz que o segredo existe');
  });
});
