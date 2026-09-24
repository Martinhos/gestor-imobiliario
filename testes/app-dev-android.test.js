// A app Android de dev instalável ao lado da de produção: os dois product
// flavors do build.gradle (applicationId, nome, ícone, HOST e assinatura
// próprios do dev), a MainActivity a ler o HOST do BuildConfig, os recursos do
// flavor em src/dev/res, o deploy a compilar o flavor do ambiente nos dois
// ramos, e o README do Android a dizer tudo isto.
//
// Sem SDK Android nesta máquina o Gradle só corre no CI: aqui leem-se os
// ficheiros como quem os vai compilar. O bash do passo da chave corre-se
// mesmo, com segredos de mentira, para provar qual chave sai em cada caso.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const RAIZ = new URL('../', import.meta.url);

// Recebe: p — caminho relativo à raiz do repositório.
// Devolve: o texto do ficheiro, com os fins de linha normalizados para \n.
const ler = (p) => readFileSync(new URL(p, RAIZ), 'utf8').replace(/\r\n/g, '\n');

/* Os passos de um job, lidos do texto (o mesmo leitor de correcao-entrega):
   cada «- » à indentação dos passos abre um; dentro dele, as chaves (name,
   id, if, uses, run…) e o bloco do run — as linhas mais indentadas que ele.
   Recebe: yml — o texto do workflow; job — o nome do job.
   Devolve: array de {name, id, if, uses, run, texto} pela ordem do ficheiro. */
function passos(yml, job) {
  const linhas = yml.split('\n');
  const ini = linhas.findIndex((l) => l === '  ' + job + ':');
  assert.ok(ini >= 0, 'o job ' + job + ' existe');
  const iSteps = linhas.findIndex((l, i) => i > ini && /^ {4}steps:\s*$/.test(l));
  const brutos = [];
  let atual = null;
  for (let i = iSteps + 1; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^ {0,4}\S/.test(l)) break;
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

/* O corpo de um bloco «nome {…}» de um ficheiro Gradle, com as chavetas
   contadas (os blocos aninham-se).
   Recebe: texto — o Gradle; nome — o nome do bloco (ex. 'productFlavors').
   Devolve: o texto entre as chavetas, ou null se o bloco não existe. */
function bloco(texto, nome) {
  const m = new RegExp('(?:^|\\n)\\s*' + nome + '\\s*\\{').exec(texto);
  if (!m) return null;
  let d = 0;
  const ini = m.index + m[0].length - 1;
  for (let i = ini; i < texto.length; i++) {
    if (texto[i] === '{') d++;
    if (texto[i] === '}' && --d === 0) return texto.slice(ini + 1, i);
  }
  return null;
}

/* Os pathData de um vetor Android, pela ordem do ficheiro.
   Recebe: xml — o texto do drawable.
   Devolve: array de strings (o valor de cada android:pathData). */
const pathsDe = (xml) => [...xml.matchAll(/android:pathData="([^"]+)"/g)].map((m) => m[1]);

/* Os pontos de um pathData feito só de M e L (segmentos retos).
   Recebe: d — o pathData.
   Devolve: array de [x, y]; falha se houver outro comando. */
function pontosDe(d) {
  assert.doesNotMatch(d, /[^ML\d.,\s-]/, 'só segmentos retos em «' + d + '»');
  return [...d.matchAll(/[ML]\s*(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

const GRADLE = ler('android/app/build.gradle');
const DEPLOY = ler('.github/workflows/deploy.yml');
const PASSOS = passos(DEPLOY, 'deploy');
const README = ler('android/README.md');

// Zona segura do ícone adaptativo: os 66dp centrais dos 108dp, um círculo de
// raio 66/108*48/2 ≈ 14,7 em torno de (24,24) num viewport de 48. Fora dela os
// launchers cortam (a máscara redonda do Pixel, o quadrado dos 72dp).
const RAIO_SEGURO = 66 / 108 * 48 / 2;
// Recebe: [x, y] — um ponto do viewport. Devolve: a distância ao centro (24,24).
const distancia = ([x, y]) => Math.hypot(x - 24, y - 24);

/* Um bash à mão, para correr o bash do passo a sério: no CI é o do sistema;
   no Windows, o do Git (o «bash» do PATH pode ser o do WSL).
   Devolve: o caminho do bash, ou null. */
function bashDisponivel() {
  const candidatos = process.platform === 'win32'
    ? [join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'), 'bash'] : ['bash'];
  for (const b of candidatos) {
    const r = spawnSync(b, ['-c', 'command -v base64'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return b;
  }
  return null;
}
const BASH = bashDisponivel();
const B64_PROD = Buffer.from('chave-prod').toString('base64');
const B64_DEV = Buffer.from('chave-dev').toString('base64');

/* Corre o bash do passo «Escrever a chave de assinatura» numa pasta
   temporária, com os segredos dados.
   Recebe: vars — IS_PROD, CHAVE_B64, CHAVE_DEV_B64, CHAVE_DEV_PASS.
   Devolve: {status, saida, tmp, env, ficheiros, resumo} — o código de saída,
   o que escreveu, a pasta (RUNNER_TEMP), o que pôs no GITHUB_ENV, o conteúdo
   dos keystores escritos, e o GITHUB_STEP_SUMMARY. */
function escreverChave(vars) {
  const p = PASSOS.find((q) => q.name === 'Escrever a chave de assinatura');
  const tmp = mkdtempSync(join(tmpdir(), 'chave-'));
  try {
    const barra = (s) => s.replace(/\\/g, '/');
    const genv = join(tmp, 'github_env'), resumo = join(tmp, 'resumo');
    writeFileSync(genv, ''); writeFileSync(resumo, '');
    const r = spawnSync(BASH, ['-eo', 'pipefail', '-c', p.run], {
      cwd: tmp, encoding: 'utf8',
      env: { ...process.env, RUNNER_TEMP: barra(tmp), GITHUB_ENV: barra(genv), GITHUB_STEP_SUMMARY: barra(resumo), ...vars },
    });
    const env = Object.fromEntries(readFileSync(genv, 'utf8').split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
    const ficheiros = {};
    for (const f of ['dev.keystore', 'release.keystore']) if (existsSync(join(tmp, f))) ficheiros[f] = readFileSync(join(tmp, f), 'utf8');
    return { status: r.status, saida: (r.stdout || '') + (r.stderr || ''), tmp: barra(tmp), env, ficheiros, resumo: readFileSync(resumo, 'utf8') };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

describe('o build.gradle: dois flavors, um por ambiente', () => {
  const flavors = bloco(GRADLE, 'productFlavors');
  const producao = flavors && bloco(flavors, 'producao');
  const dev = flavors && bloco(flavors, 'dev');

  test('a dimensão «ambiente» com os flavors producao e dev, cada um com o seu HOST no BuildConfig', () => {
    assert.match(GRADLE, /^\s*flavorDimensions\s+'ambiente'\s*$/m, 'a dimensão ambiente');
    assert.ok(producao, 'o flavor producao existe');
    assert.ok(dev, 'o flavor dev existe');
    assert.match(producao, /dimension\s+'ambiente'/, 'producao na dimensão ambiente');
    assert.match(dev, /dimension\s+'ambiente'/, 'dev na dimensão ambiente');
    // o valor é uma expressão Java: as aspas de dentro têm de lá ir
    assert.match(producao, /buildConfigField\s+'String',\s*'HOST',\s*'"app\.rendorium\.com"'/, 'producao carrega app.rendorium.com');
    assert.match(dev, /buildConfigField\s+'String',\s*'HOST',\s*'"dev\.rendorium\.com"'/, 'dev carrega dev.rendorium.com');
    const bf = bloco(GRADLE, 'buildFeatures');
    assert.ok(bf && /buildConfig\s+true/.test(bf), 'o BuildConfig gera-se (no AGP 8 vem desligado)');
  });

  test('o dev tem applicationId e versionName próprios; o producao fica como estava', () => {
    assert.match(dev, /applicationIdSuffix\s+'\.dev'/, 'o dev instala-se ao lado: pt.gestorimobiliario.app.dev');
    assert.match(dev, /versionNameSuffix\s+'-dev'/, 'e diz-se dev na versão');
    assert.doesNotMatch(producao, /applicationIdSuffix|versionNameSuffix/, 'o producao não muda de applicationId nem de versão');
    assert.match(bloco(GRADLE, 'defaultConfig'), /applicationId\s+"pt\.gestorimobiliario\.app"/, 'o applicationId base é o de sempre');
    assert.match(GRADLE, /namespace\s+'pt\.gestorimobiliario\.app'/, 'o namespace não leva o sufixo: o BuildConfig fica no pacote da MainActivity');
  });

  test('a assinatura: o dev com a chave de dev quando existe, e na fixa quando não; o producao sempre na fixa', () => {
    const sc = bloco(GRADLE, 'signingConfigs');
    assert.ok(sc && bloco(sc, 'fixa'), 'a signingConfig fixa continua');
    const scDev = bloco(sc, 'dev');
    assert.ok(scDev, 'e há uma signingConfig dev');
    assert.match(scDev, /storeFile\s+ficheiroDaChaveDev/, 'com o ficheiro da chave de dev');
    for (const v of ['ANDROID_KEYSTORE_DEV_FILE', 'ANDROID_KEYSTORE_DEV_PASS', 'ANDROID_KEYSTORE_DEV_ALIAS', 'ANDROID_KEY_DEV_PASS']) {
      assert.match(GRADLE, new RegExp("System\\.getenv\\('" + v + "'\\)"), 'lê ' + v + ' no CI');
    }
    for (const p of ['devStoreFile', 'devStorePassword', 'devKeyAlias', 'devKeyPassword']) {
      assert.match(GRADLE, new RegExp("getProperty\\('" + p + "'\\)"), 'e ' + p + ' do keystore.properties nesta máquina');
    }
    assert.match(GRADLE, /getProperty\('devKeyAlias'\)\s*\?:\s*'dev'/, 'o alias de dev por omissão é «dev»');
    assert.match(GRADLE, /def temChaveDev\s*=.*ficheiroDaChaveDev.*senhaDaChaveDev/, 'a chave de dev existe quando há ficheiro e palavra-passe');

    assert.match(dev, /if \(temChaveDev\)\s+signingConfig\s+signingConfigs\.dev/, 'o dev assina com a chave de dev quando a há');
    assert.match(dev, /else if \(temChave\)\s+signingConfig\s+signingConfigs\.fixa/, 'e cai na fixa quando não');
    assert.match(producao, /if \(temChave\)\s+signingConfig\s+signingConfigs\.fixa/, 'o producao assina com a fixa');
    assert.doesNotMatch(producao, /signingConfigs\.dev/, 'e nunca com a de dev');
    assert.match(GRADLE, /println\s+"Assinatura: producao ->[\s\S]*?dev ->/, 'o Gradle diz qual chave assina cada flavor');
    assert.match(GRADLE, /'chave de dev'/, '…a de dev');
    assert.match(GRADLE, /'chave fixa \(sem chave de dev\)'/, '…ou a fixa por falta dela');
  });

  test('o DSL do AGP: as signingConfigs antes de quem as usa, e o release sem signingConfig no buildType (mandaria sobre a do flavor)', () => {
    const iSigning = GRADLE.search(/^\s*signingConfigs\s*\{/m);
    const iFlavors = GRADLE.search(/^\s*productFlavors\s*\{/m);
    const iTypes = GRADLE.search(/^\s*buildTypes\s*\{/m);
    assert.ok(iSigning >= 0 && iSigning < iFlavors && iSigning < iTypes, 'signingConfigs {} vem antes de productFlavors {} e de buildTypes {}');
    const release = bloco(bloco(GRADLE, 'buildTypes'), 'release');
    assert.ok(release, 'o buildType release existe');
    assert.doesNotMatch(release, /signingConfig\b/, 'o release não fixa a chave: fá-lo cada flavor');
    assert.match(release, /proguardFiles/, 'e mantém o resto');
    // a guarda: um assemble*Release sem chave para com a mensagem
    assert.match(GRADLE, /tasks\.matching \{ it\.name\.startsWith\('assemble'\) && it\.name\.contains\('Release'\) \}/, 'a guarda dos assemble*Release continua');
    assert.match(GRADLE, /tarefa\.name\.contains\('Dev'\) \? \(temChaveDev \|\| temChave\) : temChave/, 'o dev contenta-se com a chave de dev; o resto precisa da fixa');
    assert.match(GRADLE, /throw new GradleException\('Sem chave de assinatura/, 'e sem chave para');
  });
});

describe('a MainActivity', () => {
  test('lê o HOST do BuildConfig, e o domínio deixou de estar escrito no Java', () => {
    const java = ler('android/app/src/main/java/pt/gestorimobiliario/app/MainActivity.java');
    assert.match(java, /^\s*private static final String HOST = BuildConfig\.HOST;$/m, 'HOST = BuildConfig.HOST');
    assert.doesNotMatch(java, /app\.rendorium\.com|dev\.rendorium\.com/, 'nenhum domínio escrito: o flavor é que decide');
    assert.match(java, /^package pt\.gestorimobiliario\.app;$/m, 'no mesmo pacote do BuildConfig (sem import)');
    assert.doesNotMatch(java, /import .*BuildConfig/, 'sem import do BuildConfig');
    assert.match(java, /HOST\.equals\(u\.getHost\(\)\)/, 'e a app continua a ficar dentro do seu domínio');
  });
});

describe('os recursos do flavor dev (src/dev/res)', () => {
  test('o nome diz DEV e o fundo do ícone é outra cor', () => {
    const strings = ler('android/app/src/dev/res/values/strings.xml');
    const nome = (strings.match(/<string name="app_name">([^<]+)<\/string>/) || [])[1];
    assert.ok(nome, 'o app_name do dev existe');
    assert.match(nome, /\bDEV\b/, 'e diz DEV: ' + nome);
    assert.equal(nome, 'Rendorium DEV');
    assert.notEqual(nome, (ler('android/app/src/main/res/values/strings.xml').match(/<string name="app_name">([^<]+)</) || [])[1], 'diferente do de produção');

    const cor = (xml) => (xml.match(/<color name="ic_launcher_background">(#[0-9A-Fa-f]{6,8})<\/color>/) || [])[1];
    const corDev = cor(ler('android/app/src/dev/res/values/colors.xml'));
    const corMain = cor(ler('android/app/src/main/res/values/colors.xml'));
    assert.ok(corDev && corMain, 'os dois ic_launcher_background existem');
    assert.notEqual(corDev.toUpperCase(), corMain.toUpperCase(), 'o de dev é outra cor');
    assert.equal(corDev.toUpperCase(), '#B45309', 'âmbar');
    // a sobreposição só funciona se o mipmap de main for por referência
    for (const f of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      const mip = ler('android/app/src/main/res/mipmap-anydpi-v26/' + f);
      assert.match(mip, /<background android:drawable="@color\/ic_launcher_background" \/>/, f + ' aponta para a cor pelo nome');
      assert.match(mip, /<foreground android:drawable="@drawable\/ic_launcher_foreground" \/>/, f + ' e para o desenho pelo nome');
    }
    assert.ok(!existsSync(new URL('android/app/src/dev/res/mipmap-anydpi-v26/', RAIZ)), 'o dev não precisa de mipmap próprio');
  });

  test('o ícone de dev tem a mesma casa de main, mais as letras DEV a traço, tudo dentro da zona segura', () => {
    const main = ler('android/app/src/main/res/drawable/ic_launcher_foreground.xml');
    const dev = ler('android/app/src/dev/res/drawable/ic_launcher_foreground.xml');
    const casa = pathsDe(main);
    assert.equal(casa.length, 3, 'a casa de main são três paths');
    const paths = pathsDe(dev);
    for (const p of casa) assert.ok(paths.includes(p), 'a casa de dev tem o path «' + p + '»');
    const letras = paths.filter((p) => !casa.includes(p));
    assert.equal(letras.length, 3, 'e mais três paths, um por letra');
    assert.match(dev, /android:viewportWidth="48"[\s\S]*android:viewportHeight="48"/, 'no mesmo viewport de 48');

    // a casa fica no group escalado; as letras fora dele, em coordenadas absolutas
    const grupo = dev.match(/<group\s+android:scaleX="([\d.]+)"\s+android:scaleY="([\d.]+)"\s+android:translateX="([\d.]+)"\s+android:translateY="([\d.]+)">([\s\S]*?)<\/group>/);
    assert.ok(grupo, 'a casa está num group com scale e translate');
    const [sx, sy, tx, ty] = grupo.slice(1, 5).map(Number);
    assert.deepEqual([sx, sy, tx, ty], [0.75, 0.75, 15, 10], 'a geometria que o make-icons.js replica');
    assert.deepEqual(pathsDe(grupo[5]), casa, 'e só a casa está lá dentro');
    const depois = dev.slice(dev.indexOf('</group>'));
    assert.deepEqual(pathsDe(depois), letras, 'as letras vêm depois do group');

    // as letras: só segmentos retos, traço branco fino, sem preenchimento
    const blocos = [...depois.matchAll(/<path[\s\S]*?\/>/g)].map((m) => m[0]);
    assert.equal(blocos.length, 3);
    for (const b of blocos) {
      assert.match(b, /android:strokeColor="#FFFFFF"/, 'traço branco');
      assert.match(b, /android:strokeWidth="1\.6"/, 'traço de 1,6');
      assert.match(b, /android:strokeLineCap="round"/);
      assert.match(b, /android:strokeLineJoin="round"/);
      assert.match(b, /android:fillColor="#00000000"/, 'sem preenchimento');
    }
    assert.deepEqual(letras, [
      'M16,29 L16,35 M16,29 L18.5,29 L20,30.5 L20,33.5 L18.5,35 L16,35',
      'M22,29 L22,35 M22,29 L26,29 M22,32 L25,32 M22,35 L26,35',
      'M28,29 L30,35 L32,29',
    ], 'D, E, V — a geometria combinada com o make-icons.js');
    // e o comentário do topo diz a mesma geometria, para quem a replica
    const cab = dev.slice(0, dev.indexOf('<vector'));
    assert.match(cab, /scaleX=0\.75 scaleY=0\.75\s+translateX=15 translateY=10/, 'o comentário diz o transform da casa');
    for (const [l, d] of [['D', letras[0]], ['E', letras[1]], ['V', letras[2]]]) {
      assert.ok(cab.includes(l + '=[' + d + ']'), 'o comentário diz «' + l + '=[…]» tal e qual');
    }

    // nada fora da zona segura: a casa transformada e as letras, com o traço
    for (const p of casa) {
      for (const [x, y] of pontosDe(p)) {
        const pt = [x * sx + tx, y * sy + ty];
        assert.ok(distancia(pt) + 1.9 * sx / 2 <= RAIO_SEGURO, 'a casa em (' + pt + ') fica na zona segura');
      }
    }
    for (const d of letras) {
      for (const pt of pontosDe(d)) {
        assert.ok(distancia(pt) + 0.8 <= RAIO_SEGURO, 'a letra em (' + pt + ') fica na zona segura');
        assert.ok(pt[1] > 25.75 + 1.9 * sy / 2, 'e abaixo da casa');
      }
    }
  });
});

describe('o deploy compila o APK nos dois ambientes', () => {
  const java = PASSOS.findIndex((p) => /^actions\/setup-java@/.test(p.uses || ''));
  const gradle = PASSOS.findIndex((p) => /^gradle\/actions\/setup-gradle@/.test(p.uses || ''));
  const chave = PASSOS.findIndex((p) => p.name === 'Escrever a chave de assinatura');
  const apk = PASSOS.findIndex((p) => p.name === 'Compilar APK');

  test('nenhum dos quatro passos do APK fica só no main, e continuam antes de esperar pelos testes', () => {
    assert.ok(java >= 0 && gradle > java && chave > gradle && apk > chave, 'java → gradle → chave → APK, por esta ordem');
    for (const i of [java, gradle, chave, apk]) {
      assert.equal(PASSOS[i].if, undefined, '«' + (PASSOS[i].name || PASSOS[i].uses) + '» corre nos dois ambientes');
      assert.doesNotMatch(PASSOS[i].texto, /ref_name == 'main'/, 'e não tem o «só no main»');
    }
    const espera = PASSOS.findIndex((p) => /node scripts\/entrega\.js testes\b/.test(p.run || ''));
    const chegada = PASSOS.findIndex((p) => /node scripts\/chegada\.js /.test(p.run || ''));
    assert.ok(chegada < java && apk < espera, 'entre o guarda da chegada e a espera pelos testes, como antes');
    assert.doesNotMatch(DEPLOY, /APK só na produção/, 'o comentário deixou de dizer que é só na produção');
  });

  test('a tarefa é a do flavor do ambiente, e o ficheiro vai para o mesmo sítio', () => {
    const run = PASSOS[apk].run;
    assert.equal(PASSOS[apk]['working-directory'], 'android');
    assert.match(run, /^chmod \+x gradlew$/m);
    const m = run.match(/if \[ -n "\$IS_PROD" \]; then\n\s*\.\/gradlew --no-daemon assembleProducaoRelease\n\s*cp (\S+) \.\.\/web\/gestor-imobiliario\.apk\nelse\n\s*\.\/gradlew --no-daemon assembleDevRelease\n\s*cp (\S+) \.\.\/web\/gestor-imobiliario\.apk\nfi/);
    assert.ok(m, 'assembleProducaoRelease com IS_PROD, assembleDevRelease sem, os dois copiados para ../web/gestor-imobiliario.apk');
    assert.equal(m[1], 'app/build/outputs/apk/producao/release/app-producao-release.apk', 'a saída do flavor producao');
    assert.equal(m[2], 'app/build/outputs/apk/dev/release/app-dev-release.apk', 'a saída do flavor dev');
    assert.doesNotMatch(run, /assembleRelease\b/, 'nunca o assembleRelease a secas: compilava os dois e exigia a chave fixa em dev');
    assert.match(PASSOS[apk].texto, /^ {10}ANDROID_KEYSTORE_PASS: \$\{\{ secrets\.ANDROID_KEYSTORE_PASS \}\}$/m, 'a palavra-passe da fixa');
    assert.match(PASSOS[apk].texto, /^ {10}ANDROID_KEYSTORE_DEV_PASS: \$\{\{ secrets\.ANDROID_KEYSTORE_DEV_PASS \}\}$/m, 'e a da de dev, para o Gradle escolher');
  });

  test('o passo da chave: em dev prefere a de dev e cai na de produção dizendo-o; as variáveis são as que o Gradle lê', () => {
    const p = PASSOS[chave];
    assert.match(p.texto, /CHAVE_B64: \$\{\{ secrets\.ANDROID_KEYSTORE_B64 \}\}/, 'lê a chave de produção');
    assert.match(p.texto, /CHAVE_DEV_B64: \$\{\{ secrets\.ANDROID_KEYSTORE_DEV_B64 \}\}/, 'e a de dev');
    assert.match(p.texto, /CHAVE_DEV_PASS: \$\{\{ secrets\.ANDROID_KEYSTORE_DEV_PASS \}\}/, 'e a palavra-passe da de dev, para saber se está completa');
    const iDev = p.run.search(/if \[ -z "\$IS_PROD" \] && \[ -n "\$CHAVE_DEV_B64" \] && \[ -n "\$CHAVE_DEV_PASS" \]; then/);
    const iProd = p.run.search(/if \[ -z "\$CHAVE_B64" \]; then/);
    assert.ok(iDev >= 0 && iProd > iDev, 'primeiro a de dev (só fora de produção, e só completa); depois a de produção');
    assert.match(p.run, /ANDROID_KEYSTORE_DEV_FILE=\$RUNNER_TEMP\/dev\.keystore" >> "\$GITHUB_ENV"/, 'exporta ANDROID_KEYSTORE_DEV_FILE, que o Gradle lê para o flavor dev');
    assert.match(p.run, /ANDROID_KEYSTORE_FILE=\$RUNNER_TEMP\/release\.keystore" >> "\$GITHUB_ENV"/, 'e ANDROID_KEYSTORE_FILE para a fixa');
    assert.match(p.run, /if \[ -z "\$IS_PROD" \]; then\n\s*echo "O APK de dev vai assinado com a chave de produção[^\n]*ANDROID_KEYSTORE_DEV_B64[^\n]*\| tee -a "\$GITHUB_STEP_SUMMARY"/, 'em dev sem a chave de dev, o resumo diz que saiu com a de produção');
    assert.match(p.run, /Falta o segredo ANDROID_KEYSTORE_B64/, 'e sem nenhuma, para');
    // o deploy e o Gradle falam das mesmas variáveis
    for (const v of ['ANDROID_KEYSTORE_DEV_FILE', 'ANDROID_KEYSTORE_DEV_PASS', 'ANDROID_KEYSTORE_FILE', 'ANDROID_KEYSTORE_PASS']) {
      assert.match(GRADLE, new RegExp("getenv\\('" + v + "'\\)"), 'o Gradle lê ' + v);
      assert.match(DEPLOY, new RegExp(v + '\\b'), 'que o deploy escreve ou passa');
    }
  });

  test('o bash do passo da chave, corrido: qual chave sai em cada caso', { skip: BASH ? false : 'sem um bash à mão' }, () => {
    const devComChave = escreverChave({ IS_PROD: '', CHAVE_B64: B64_PROD, CHAVE_DEV_B64: B64_DEV, CHAVE_DEV_PASS: 'p' });
    assert.equal(devComChave.status, 0, devComChave.saida);
    assert.equal(devComChave.env.ANDROID_KEYSTORE_DEV_FILE, devComChave.tmp + '/dev.keystore', 'em dev com a chave de dev, exporta a de dev');
    assert.equal(devComChave.env.ANDROID_KEYSTORE_FILE, undefined, 'e a de produção nem se escreve');
    assert.equal(devComChave.ficheiros['dev.keystore'], 'chave-dev', 'descodificada tal e qual');
    assert.equal(devComChave.ficheiros['release.keystore'], undefined);
    assert.equal(devComChave.resumo, '', 'nada a avisar');

    const devSemChave = escreverChave({ IS_PROD: '', CHAVE_B64: B64_PROD, CHAVE_DEV_B64: '', CHAVE_DEV_PASS: '' });
    assert.equal(devSemChave.status, 0, devSemChave.saida);
    assert.equal(devSemChave.env.ANDROID_KEYSTORE_FILE, devSemChave.tmp + '/release.keystore', 'sem a de dev, cai na de produção');
    assert.equal(devSemChave.env.ANDROID_KEYSTORE_DEV_FILE, undefined);
    assert.equal(devSemChave.ficheiros['release.keystore'], 'chave-prod');
    assert.match(devSemChave.resumo, /APK de dev vai assinado com a chave de produção.*ANDROID_KEYSTORE_DEV_B64/, 'e di-lo no resumo');

    const devMeiaChave = escreverChave({ IS_PROD: '', CHAVE_B64: B64_PROD, CHAVE_DEV_B64: B64_DEV, CHAVE_DEV_PASS: '' });
    assert.equal(devMeiaChave.env.ANDROID_KEYSTORE_FILE, devMeiaChave.tmp + '/release.keystore', 'a chave de dev sem palavra-passe não conta');
    assert.match(devMeiaChave.resumo, /chave de produção/);

    const prod = escreverChave({ IS_PROD: '1', CHAVE_B64: B64_PROD, CHAVE_DEV_B64: B64_DEV, CHAVE_DEV_PASS: 'p' });
    assert.equal(prod.status, 0, prod.saida);
    assert.equal(prod.env.ANDROID_KEYSTORE_FILE, prod.tmp + '/release.keystore', 'em produção é sempre a fixa');
    assert.equal(prod.env.ANDROID_KEYSTORE_DEV_FILE, undefined, 'mesmo havendo a de dev');
    assert.equal(prod.resumo, '');

    const nada = escreverChave({ IS_PROD: '1', CHAVE_B64: '', CHAVE_DEV_B64: B64_DEV, CHAVE_DEV_PASS: 'p' });
    assert.equal(nada.status, 1, 'em produção sem a fixa, para — a de dev não a substitui');
    assert.match(nada.saida, /Falta o segredo ANDROID_KEYSTORE_B64/);
  });
});

describe('o README do Android', () => {
  test('diz os dois flavors, como se compila cada um, e a chave de dev', () => {
    assert.match(README, /^## Dois flavors/m, 'uma secção sobre os flavors');
    assert.match(README, /`pt\.gestorimobiliario\.app\.dev`/, 'o applicationId do dev');
    assert.match(README, /Rendorium DEV/, 'o nome do dev');
    assert.match(README, /`dev\.rendorium\.com`/, 'o HOST do dev');
    assert.match(README, /ao lado/, 'instalam-se ao lado');
    assert.match(README, /`\.\/gradlew assembleDevRelease`|^\.\/gradlew assembleDevRelease$/m, 'como compilar o dev');
    assert.match(README, /assembleProducaoRelease/, 'e o producao');
    assert.match(README, /app\/build\/outputs\/apk\/<flavor>\/release\/app-<flavor>-release\.apk/, 'onde fica cada um');
    assert.doesNotMatch(README, /apk\/release\/app-release\.apk/, 'o caminho antigo, sem flavor, saiu');

    assert.match(README, /^### Chave de dev/m, 'uma secção sobre a chave de dev');
    assert.match(README, /`ANDROID_KEYSTORE_DEV_B64`/, 'o segredo da chave');
    assert.match(README, /`ANDROID_KEYSTORE_DEV_PASS`/, 'e o da palavra-passe');
    for (const p of ['devStoreFile', 'devStorePassword', 'devKeyAlias', 'devKeyPassword']) assert.match(README, new RegExp('^' + p + '=', 'm'), p + ' no keystore.properties');
    assert.match(README, /keytool -genkeypair -v -keystore app\/dev\.keystore -alias dev -keyalg RSA -keysize 2048 -validity 10000/, 'como criar uma');
    assert.match(ler('.gitignore'), /^android\/app\/\*\.keystore$/m, 'que o .gitignore cobre');
    assert.match(README, /cai\s+na chave fixa/, 'sem ela assina com a fixa');
    assert.match(README, /`applicationId`, não da chave/, 'e porquê: a coexistência vem do applicationId');
    assert.match(README, /descartável/, 'a de dev pode tratar-se como descartável');
  });
});
