// O dev.rendorium.com prova ao Android que a APK de dev é dele: serve o
// /.well-known/assetlinks.json sem sessão (o Android verifica sem cookies)
// a partir do /assetlinks-dev.json que o deploy escreve depois de compilar o
// APK de dev, com a impressão SHA-256 tirada do próprio APK. Sem esse
// ficheiro é o 404 seco, sem cache. A produção e o percurso não mudam. E o
// passo do deploy: só no dev, no sítio certo, a transformar a saída do
// keytool (e do apksigner) no JSON, e sem partir a publicação quando não há
// impressão nenhuma.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import worker from '../worker/src/index.js';
import { passaSemSessao } from '../worker/src/teste.js';
import { ambiente } from './lib/api.js';

const RAIZ = new URL('../', import.meta.url);
const ler = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const ORIGEM = 'https://dev.rendorium.com';
const PACOTE = 'pt.gestorimobiliario.app.dev';
const CAMINHO = '/.well-known/assetlinks.json';

// uma impressão de um certificado a sério (keytool -genkeypair, 2026-10-28)
const IMPRESSAO = '70:79:B5:61:60:4B:49:3E:F9:B8:2F:EA:5A:99:45:FE:DF:81:F6:1C:53:6E:5C:8E:90:C5:C7:CE:20:66:1F:A5';
const OUTRA = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89';
const DA_CA = '11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99:00:11:22';
const semPontos = (f) => f.replace(/:/g, '').toLowerCase();

/* O que o deploy escreveria em web/assetlinks-dev.json.
   Recebe: impressoes — a lista. Devolve: o texto do JSON. */
const assetlinks = (impressoes) => JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'],
  target: { namespace: 'android_app', package_name: PACOTE, sha256_cert_fingerprints: impressoes } }]);

/* Os assets fingidos, com os ficheiros que se lhes der (e mais nenhum), como
   os da Cloudflare: cache longa, ETag, 304 a quem traz o If-None-Match.
   Recebe: ficheiros — {caminho: texto}.
   Devolve: {pedidos, fetch}. */
function assetsDoDeploy(ficheiros) {
  const pedidos = [];
  return {
    pedidos,
    fetch: async (request) => {
      pedidos.push(request);
      const texto = ficheiros[new URL(request.url).pathname];
      if (texto === undefined) return new Response('não há', { status: 404 });
      if (request.headers.get('If-None-Match')) return new Response(null, { status: 304, headers: { ETag: '"a"' } });
      return new Response(request.method === 'HEAD' ? null : texto, { status: 200, headers: {
        'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', ETag: '"a"' } });
    },
  };
}

/* O ambiente do dev publicado (ENV_NAME 'dev' e a porta fechada).
   Recebe: ficheiros — o que os assets têm; extra (opcional) — o que se troca.
   Devolve: o env. */
const dev = (ficheiros, extra) => ambiente(Object.assign(
  { ENV_NAME: 'dev', PORTA_DEV: 'fechada', TESTE_CHAVE: 'chave-das-ligacoes', ASSETS: assetsDoDeploy(ficheiros) }, extra || {}));

/* Um pedido ao worker inteiro, sem cookies nem sessão (como o do Android).
   Recebe: env; caminho; o (opcional) — {method, headers}.
   Devolve: a promessa da Response. */
async function aoWorker(env, caminho, o) {
  const op = o || {};
  const fundo = [];
  const r = await worker.fetch(new Request(ORIGEM + caminho, { method: op.method || 'GET', headers: op.headers || {} }),
    env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
  return r;
}

/* A resposta é o 404 seco da porta: curto, sem cache, vestido pelo harden.
   Recebe: r — a Response; onde — para a mensagem.
   Devolve: a promessa de nada. */
async function e404Seco(r, onde) {
  assert.equal(r.status, 404, onde + ' devia dar 404');
  assert.equal(await r.text(), 'Não encontrado', onde);
  assert.equal(r.headers.get('Cache-Control'), 'no-store', onde + ': um 404 não fica guardado pelo Android nem pelo caminho');
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff', onde + ': passou pelo harden');
}

describe('no dev, o /.well-known/assetlinks.json', () => {
  test('sem sessão, dá 200 application/json com o corpo do /assetlinks-dev.json, em GET e HEAD', async () => {
    const corpo = assetlinks([IMPRESSAO]);
    const env = dev({ '/assetlinks-dev.json': corpo });
    const r = await aoWorker(env, CAMINHO);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Content-Type'), 'application/json');
    assert.equal(await r.text(), corpo);
    assert.equal(r.headers.get('Location'), null, 'sem redireções: o Android não as segue');
    assert.equal(r.headers.get('Set-Cookie'), null);
    assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff', 'passou pelo harden');
    const cache = /max-age=(\d+)/.exec(r.headers.get('Cache-Control') || '');
    assert.ok(cache && Number(cache[1]) <= 3600, 'cache curta (' + r.headers.get('Cache-Control') + '): uma impressão nova chega depressa');
    assert.doesNotMatch(r.headers.get('Cache-Control'), /immutable/, 'a cache dos assets não passa');
    const h = await aoWorker(env, CAMINHO, { method: 'HEAD' });
    assert.equal(h.status, 200, 'HEAD');
    assert.equal(h.headers.get('Content-Type'), 'application/json', 'HEAD');
    assert.equal(await h.text(), '', 'HEAD sem corpo');
    assert.deepEqual(env.ASSETS.pedidos.map((p) => p.method + ' ' + new URL(p.url).pathname),
      ['GET /assetlinks-dev.json', 'HEAD /assetlinks-dev.json']);
  });

  test('um pedido condicional não leva um 304 dos assets: o corpo inteiro, sempre', async () => {
    const corpo = assetlinks([IMPRESSAO]);
    const env = dev({ '/assetlinks-dev.json': corpo });
    const r = await aoWorker(env, CAMINHO, { headers: { 'If-None-Match': '"a"', 'If-Modified-Since': 'Wed, 28 Oct 2026 10:00:00 GMT' } });
    assert.equal(r.status, 200);
    assert.equal(await r.text(), corpo);
  });

  test('sem o ficheiro (antes do primeiro deploy, ou com o keytool a falhar): o 404 seco, sem cache', async () => {
    const env = dev({});
    await e404Seco(await aoWorker(env, CAMINHO), 'GET sem ficheiro');
    await e404Seco(await aoWorker(env, CAMINHO, { method: 'HEAD' }), 'HEAD sem ficheiro');
  });

  test('também com a porta aberta (o dev sem a PORTA_DEV) e com outros métodos não abre nada', async () => {
    const corpo = assetlinks([IMPRESSAO]);
    const aberto = dev({ '/assetlinks-dev.json': corpo }, { PORTA_DEV: undefined });
    assert.equal(await (await aoWorker(aberto, CAMINHO)).text(), corpo, 'a rota é do dev, não da porta');
    const env = dev({ '/assetlinks-dev.json': corpo });
    for (const method of ['POST', 'PUT', 'DELETE']) {
      await e404Seco(await aoWorker(env, CAMINHO, { method }), method + ' sem sessão');
    }
  });

  test('o /assetlinks-dev.json em si, e o resto do /.well-known, continuam atrás da porta', async () => {
    const env = dev({ '/assetlinks-dev.json': assetlinks([IMPRESSAO]), '/.well-known/outro.json': '{}' });
    await e404Seco(await aoWorker(env, '/assetlinks-dev.json'), '/assetlinks-dev.json');
    await e404Seco(await aoWorker(env, '/assetlinks-dev.json', { method: 'HEAD' }), 'HEAD /assetlinks-dev.json');
    for (const c of ['/.well-known/outro.json', '/.well-known/assetlinks.json/', '/.well-known/assetlinks.jsonx', '/.WELL-KNOWN/assetlinks.json']) {
      await e404Seco(await aoWorker(env, c), c);
    }
    assert.equal(env.ASSETS.pedidos.length, 0, 'nem chegou aos assets');
  });

  test('a regra da porta diz que o caminho passa sem sessão, em GET e HEAD, e só ele', () => {
    assert.equal(passaSemSessao(CAMINHO, 'GET'), true);
    assert.equal(passaSemSessao(CAMINHO, 'HEAD'), true);
    for (const m of ['POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal(passaSemSessao(CAMINHO, m), false, m);
    assert.equal(passaSemSessao('/assetlinks-dev.json', 'GET'), false);
    assert.equal(passaSemSessao('/.well-known/outro.json', 'GET'), false);
  });
});

describe('fora do dev, nada muda', () => {
  test('na produção (sem ENV_NAME) e no percurso, o caminho segue para os assets tal e qual', async () => {
    for (const ENV_NAME of [undefined, 'percurso', 'teste']) {
      const env = dev({ '/assetlinks-dev.json': assetlinks([IMPRESSAO]), [CAMINHO]: 'o de sempre' }, { ENV_NAME });
      const r = await aoWorker(env, CAMINHO);
      assert.equal(r.status, 200, String(ENV_NAME));
      assert.equal(await r.text(), 'o de sempre', String(ENV_NAME) + ': o ficheiro do dev não aparece');
      assert.deepEqual(env.ASSETS.pedidos.map((p) => new URL(p.url).pathname), [CAMINHO], String(ENV_NAME));
    }
  });
});

/* Os passos do deploy.yml, pela ordem, com o texto de cada um.
   Recebe: yml — o texto do workflow.
   Devolve: [{nome, texto}]. */
function passosDoDeploy(yml) {
  const linhas = yml.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let atual = null;
  for (const l of linhas) {
    const novo = /^ {6}- (?:name: (.*)|uses: (.*))$/.exec(l);
    if (novo) { atual = { nome: (novo[1] || novo[2]).trim(), texto: '' }; out.push(atual); continue; }
    if (atual && l.trim() && !/^ {7,}/.test(l)) atual = null;   // um comentário ou chave a 6 espaços fecha o passo
    else if (atual) atual.texto += l + '\n';
  }
  return out;
}

/* O script do «run: |» de um passo, sem a indentação do YAML.
   Recebe: texto — o texto do passo. Devolve: o script (texto). */
function scriptDoPasso(texto) {
  const i = texto.indexOf('        run: |\n');
  assert.ok(i > -1, 'o passo tem um run: |');
  return texto.slice(i + '        run: |\n'.length).split('\n')
    .map((l) => (l.startsWith('          ') ? l.slice(10) : l.trim())).join('\n');
}

const PASSOS = passosDoDeploy(ler('.github/workflows/deploy.yml'));
const PASSO = PASSOS.find((p) => /assetlinks/i.test(p.nome));
const SCRIPT = PASSO ? scriptDoPasso(PASSO.texto) : '';
const JS = (/<<'JS'\n([\s\S]*?)\nJS\n/.exec(SCRIPT) || [])[1];

// uma pasta temporária nova, e o que lá se põe sai no fim do processo
const PASTA = mkdtempSync(path.join(tmpdir(), 'assetlinks-'));
process.on('exit', () => rmSync(PASTA, { recursive: true, force: true }));
const emBarras = (p) => p.replace(/\\/g, '/');

/* Corre o pedaço em Node do passo, como o passo o corre.
   Recebe: entrada — a saída do keytool/apksigner; pacote (opcional).
   Devolve: {status, stdout, stderr}. */
function transformar(entrada, pacote) {
  const f = path.join(PASTA, 'assetlinks.js');
  writeFileSync(f, JS);
  return spawnSync(process.execPath, pacote === null ? [f] : [f, pacote || PACOTE], { input: entrada, encoding: 'utf8' });
}

// a saída do keytool 17 (-printcert -jarfile) de um JAR assinado
const KEYTOOL = `Signer #1:

Certificate #1:
Owner: CN=Rendorium Dev
Issuer: CN=Rendorium Dev
Serial number: 50a244b7f6ad4d91
Valid from: Wed Oct 28 22:56:10 WET 2026 until: Sun Mar 15 22:56:10 WET 2054
Certificate fingerprints:
\t SHA1: 28:FA:ED:96:9B:EA:FC:2F:65:61:46:47:AC:9C:C7:74:FB:B4:87:93
\t SHA256: ${IMPRESSAO}
Signature algorithm name: SHA256withRSA
Subject Public Key Algorithm: 2048-bit RSA key
Version: 3
`;
// a do apksigner (verify --print-certs), com um carimbo de origem que não é o certificado da app
const APKSIGNER = `Signer #1 certificate DN: CN=Rendorium Dev
Signer #1 certificate SHA-256 digest: ${semPontos(IMPRESSAO)}
Signer #1 certificate SHA-1 digest: 28faed969beafc2f65614647ac9cc774fbb48793
Signer #1 certificate MD5 digest: 0123456789abcdef0123456789abcdef
Source Stamp Signer certificate DN: CN=Carimbo
Source Stamp Signer certificate SHA-256 digest: ${semPontos(OUTRA)}
`;

describe('o passo do deploy que escreve o web/assetlinks-dev.json', () => {
  test('existe, só no dev, depois do «Compilar APK» e antes do wrangler deploy, e não parte a publicação', () => {
    assert.ok(PASSO, 'há um passo com assetlinks no nome');
    const nomes = PASSOS.map((p) => p.nome);
    const i = PASSOS.indexOf(PASSO);
    assert.ok(i > nomes.indexOf('Compilar APK') && nomes.indexOf('Compilar APK') > -1, 'depois do «Compilar APK»');
    const publicar = PASSOS.findIndex((p) => /wrangler@4 deploy/.test(p.texto));
    assert.ok(publicar > -1 && i < publicar, 'antes do wrangler deploy');
    assert.match(PASSO.texto, /^ {8}if: \$\{\{ !env\.IS_PROD \}\}$/m, 'só no dev: o contrário do if: env.IS_PROD da produção');
    assert.match(PASSO.texto, /^ {8}continue-on-error: true$/m, 'uma falha que ninguém previu também não parte');
    assert.match(SCRIPT, /^set \+e$/m, 'sem o -e que o GitHub põe no bash');
    assert.doesNotMatch(SCRIPT, /^set -e/m);
    assert.doesNotMatch(SCRIPT, /exit [1-9]/, 'nunca sai com erro');
    assert.match(SCRIPT, /keytool -printcert -jarfile "\$APK"/);
    assert.match(SCRIPT, /APK=web\/gestor-imobiliario\.apk/, 'o APK que o «Compilar APK» copiou');
    assert.match(SCRIPT, /web\/assetlinks-dev\.json/);
    assert.match(SCRIPT, new RegExp(PACOTE.replace(/\./g, '\\.')));
    assert.match(SCRIPT, /GITHUB_STEP_SUMMARY/, 'avisa no resumo');
    assert.ok(JS, 'o pedaço em Node vai num heredoc <<\'JS\'');
  });

  test('o .gitignore deixa o ficheiro gerado de fora', () => {
    assert.ok(ler('.gitignore').split(/\r?\n/).includes('web/assetlinks-dev.json'));
  });

  test('a saída do keytool dá a forma do contrato, com a impressão em maiúsculas e dois pontos', () => {
    const r = transformar(KEYTOOL);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), JSON.parse(assetlinks([IMPRESSAO])));
  });

  test('de outros JDK («SHA-256:», minúsculas, CRLF) e do apksigner (sem o carimbo de origem), a mesma', () => {
    const variantes = [
      KEYTOOL.replace('SHA256:', 'SHA-256:'),
      KEYTOOL.replace(IMPRESSAO, IMPRESSAO.toLowerCase()),
      KEYTOOL.replace(/\n/g, '\r\n'),
      APKSIGNER,
      APKSIGNER.replace(/\n/g, '\r\n'),
      KEYTOOL + APKSIGNER,   // os dois, do mesmo certificado: uma impressão só
      'Not a signed jar file\n' + APKSIGNER,
    ];
    for (const v of variantes) {
      const r = transformar(v);
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(JSON.parse(r.stdout)[0].target.sha256_cert_fingerprints, [IMPRESSAO], JSON.stringify(v.slice(0, 40)));
    }
  });

  test('o apksigner do runner do GitHub escreve «V2 Signer:» (a saída real de um deploy do dev), e a impressão tira-se na mesma', () => {
    const doRunner = 'Not a signed jar file\n' +
      'V2 Signer: certificate DN: CN=Rendorium, O=Rendorium, L=Lisboa, C=PT\n' +
      'V2 Signer: certificate SHA-256 digest: ' + semPontos(IMPRESSAO).toLowerCase() + '\n' +
      'V2 Signer: certificate SHA-1 digest: 9f0652984bf833d58fc015a7c57f83e9941f9069\n' +
      'V2 Signer: certificate MD5 digest: 7f3a24ff2a96c52ad0c1eb7a2e622cdc\n' +
      'Source Stamp Signer: certificate SHA-256 digest: ' + semPontos(OUTRA) + '\n';
    const r = transformar(doRunner);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout)[0].target.sha256_cert_fingerprints, [IMPRESSAO], 'a do V2, e não a do carimbo de origem');
    const v3 = doRunner.replace(/V2 Signer/g, 'V3 Signer');
    assert.deepEqual(JSON.parse(transformar(v3).stdout)[0].target.sha256_cert_fingerprints, [IMPRESSAO], 'e a do V3');
  });

  test('com dois assinantes, as duas; de uma cadeia, só o certificado de quem assina (o primeiro)', () => {
    const dois = KEYTOOL + '\nSigner #2:\n\nCertificate #1:\nOwner: CN=Outra\nCertificate fingerprints:\n\t SHA256: ' + OUTRA + '\n';
    assert.deepEqual(JSON.parse(transformar(dois).stdout)[0].target.sha256_cert_fingerprints, [IMPRESSAO, OUTRA]);
    const cadeia = KEYTOOL + '\nCertificate #2:\nOwner: CN=A CA\nCertificate fingerprints:\n\t SHA256: ' + DA_CA + '\n';
    assert.deepEqual(JSON.parse(transformar(cadeia).stdout)[0].target.sha256_cert_fingerprints, [IMPRESSAO]);
    const rodada = 'Signer (minSdkVersion=33, maxSdkVersion=2147483647) certificate SHA-256 digest: ' + semPontos(OUTRA) + '\n' + APKSIGNER;
    assert.deepEqual(JSON.parse(transformar(rodada).stdout)[0].target.sha256_cert_fingerprints, [OUTRA, IMPRESSAO]);
  });

  test('sem impressão nenhuma (APK só com a assinatura v2, um erro do keytool) ou sem pacote: falha calado no stdout', () => {
    for (const v of ['Not a signed jar file\n', 'keytool error: java.util.zip.ZipException: zip END header not found\n', '',
      KEYTOOL.replace(IMPRESSAO, IMPRESSAO.slice(0, -3)), 'Signature algorithm name: SHA256withRSA\n']) {
      const r = transformar(v);
      assert.notEqual(r.status, 0, JSON.stringify(v));
      assert.equal(r.stdout, '', 'nada que se escreva no ficheiro');
    }
    assert.notEqual(transformar(KEYTOOL, null).status, 0, 'sem o pacote');
  });
});

/* O bash do Git no Windows (o do System32 é o do WSL, que não vê estes
   caminhos); fora do Windows, o do sistema. */
const BASH = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '/bin/bash';

/* Corre o passo inteiro como o GitHub o corre (bash -eo pipefail), com um
   keytool e um apksigner fingidos à frente no PATH.
   Recebe: o — {keytool, apksigner}: o que cada um imprime (null: o keytool
   sai com erro; o apksigner não existe); antigo — um assetlinks já em web/.
   Devolve: {status, ficheiro (texto ou null), resumo, saida}. */
function correrPasso(o, antigo) {
  const casa = mkdtempSync(path.join(PASTA, 'passo-'));
  const bin = path.join(casa, 'bin');
  const temp = path.join(casa, 'runner');
  const sdk = path.join(casa, 'sdk');
  for (const d of [bin, temp, path.join(casa, 'web')]) mkdirSync(d, { recursive: true });
  writeFileSync(path.join(casa, 'web', 'gestor-imobiliario.apk'), 'PK');
  if (antigo) writeFileSync(path.join(casa, 'web', 'assetlinks-dev.json'), antigo);
  // um programa fingido: confere os argumentos e imprime o que se lhe deu (null: um erro, e sai com 1)
  const falso = (destino, args, saida) => {
    writeFileSync(destino + '.txt', saida === null ? 'keytool error: avaria\n' : saida);
    writeFileSync(destino, '#!/bin/sh\n[ "$*" = "' + args + '" ] || exit 3\ncat "$0.txt"\n' + (saida === null ? 'exit 1\n' : ''), { mode: 0o755 });
  };
  falso(path.join(bin, 'keytool'), '-printcert -jarfile web/gestor-imobiliario.apk', o.keytool);
  if (o.apksigner !== null) {
    mkdirSync(path.join(sdk, 'build-tools', '34.0.0'), { recursive: true });
    falso(path.join(sdk, 'build-tools', '34.0.0', 'apksigner'), 'verify --print-certs web/gestor-imobiliario.apk', o.apksigner);
  }
  const script = path.join(casa, 'passo.sh');
  writeFileSync(script, SCRIPT);
  const resumo = path.join(casa, 'resumo.md');
  // no Windows o PATH chama-se Path: fica um só, com os fingidos à frente
  const env = {};
  for (const k of Object.keys(process.env)) if (k.toUpperCase() !== 'PATH') env[k] = process.env[k];
  const r = spawnSync(BASH, ['--noprofile', '--norc', '-eo', 'pipefail', emBarras(script)], {
    cwd: casa, encoding: 'utf8',
    env: Object.assign(env, { PATH: [bin, path.dirname(process.execPath), process.env.PATH || process.env.Path].join(path.delimiter),
      RUNNER_TEMP: emBarras(temp), GITHUB_STEP_SUMMARY: emBarras(resumo), ANDROID_HOME: emBarras(sdk), ANDROID_SDK_ROOT: '' }),
  });
  const f = path.join(casa, 'web', 'assetlinks-dev.json');
  return { status: r.status, saida: (r.stdout || '') + (r.stderr || ''),
    ficheiro: existsSync(f) ? readFileSync(f, 'utf8') : null, resumo: existsSync(resumo) ? readFileSync(resumo, 'utf8') : '' };
}

describe('o passo inteiro, no bash', { skip: !existsSync(BASH) && 'sem bash' }, () => {
  test('com o keytool a ver a assinatura: escreve o ficheiro e di-lo no resumo', () => {
    const r = correrPasso({ keytool: KEYTOOL, apksigner: null });
    assert.equal(r.status, 0, r.saida);
    assert.deepEqual(JSON.parse(r.ficheiro), JSON.parse(assetlinks([IMPRESSAO])));
    assert.match(r.resumo, new RegExp(IMPRESSAO));
  });

  test('com um APK só v2 (o keytool diz «Not a signed jar file» e sai com 0): vale o apksigner do SDK', () => {
    const r = correrPasso({ keytool: 'Not a signed jar file\n', apksigner: APKSIGNER });
    assert.equal(r.status, 0, r.saida);
    assert.deepEqual(JSON.parse(r.ficheiro)[0].target.sha256_cert_fingerprints, [IMPRESSAO]);
  });

  test('sem impressão nenhuma: o deploy segue (sai com 0), sem ficheiro, e com o aviso no resumo', () => {
    for (const o of [{ keytool: null, apksigner: null }, { keytool: 'Not a signed jar file\n', apksigner: 'ERROR: no signers\n' }]) {
      const r = correrPasso(o, assetlinks([OUTRA]));
      assert.equal(r.status, 0, r.saida);
      assert.equal(r.ficheiro, null, 'nem fica um antigo');
      assert.match(r.resumo, /assetlinks/i);
      assert.match(r.resumo, /impress/i);
      assert.match(r.saida, /::warning::/);
    }
  });
});
