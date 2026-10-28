// A app Android de dev abre as ligações do /test (https://dev.rendorium.com/t/entrar?…),
// a única porta do dev sem sessão: o flavor dev declara-as num manifesto só
// dele (src/dev/AndroidManifest.xml, que o manifest merger junta à activity de
// main), com autoVerify; a de produção não declara nada novo. A MainActivity
// carrega a ligação no WebView ao abrir (onCreate) e com a app já aberta
// (onNewIntent, por ser singleTask), uma vez só, e só se for https, do HOST
// do flavor e do caminho /t/entrar. O README do Android explica-o.
//
// Sem SDK Android nesta máquina o Gradle só corre no CI: aqui leem-se os
// ficheiros como quem os vai compilar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const RAIZ = new URL('../', import.meta.url);

// Recebe: p — caminho relativo à raiz do repositório.
// Devolve: o texto do ficheiro, com os fins de linha normalizados para \n.
const ler = (p) => readFileSync(new URL(p, RAIZ), 'utf8').replace(/\r\n/g, '\n');

const MANIFESTO_DEV = 'android/app/src/dev/AndroidManifest.xml';
const JAVA = ler('android/app/src/main/java/pt/gestorimobiliario/app/MainActivity.java');

/* O Java sem comentários nem literais de texto, para contar chavetas e
   procurar nomes sem tropeçar no que está escrito nos comentários.
   Recebe: src — o texto do ficheiro.
   Devolve: o mesmo texto, com os comentários apagados e cada literal
   ("…" ou '…') trocado por "" ou ''. Uma passagem só, da esquerda para a
   direita: o «//» de "https://" não é um comentário, e o «"» de um
   comentário não abre um literal. */
function soCodigo(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])'/gm, (m) => (m[0] === '"' ? '""' : m[0] === "'" ? "''" : ''));
}

/* O corpo de um método, da chaveta que abre à que fecha.
   Recebe: src — o Java (já sem comentários); cabeca — regex da assinatura.
   Devolve: o texto entre as chavetas, ou null se a assinatura não existe. */
function corpo(src, cabeca) {
  const m = cabeca.exec(src);
  if (!m) return null;
  let i = src.indexOf('{', m.index + m[0].length - 1), fundo = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') fundo++;
    else if (src[j] === '}' && --fundo === 0) return src.slice(i + 1, j);
  }
  return null;
}

const CODIGO = soCodigo(JAVA);

describe('o manifesto do flavor dev', () => {
  test('existe, e é um manifesto que o merger junta: sem package, só a MainActivity e o intent-filter', () => {
    assert.ok(existsSync(new URL(MANIFESTO_DEV, RAIZ)), MANIFESTO_DEV + ' existe');
    const xml = ler(MANIFESTO_DEV);
    assert.match(xml, /^<\?xml version="1\.0" encoding="utf-8"\?>\n/, 'começa pela declaração');
    assert.match(xml, /<manifest xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"\s*>/, 'o manifest com o namespace do android');
    assert.doesNotMatch(xml, /<manifest[^>]*\bpackage=/, 'sem package: o AGP 8 usa o namespace do build.gradle');
    assert.doesNotMatch(xml, /\btools:/, 'sem regras do merger: o intent-filter junta-se sozinho');
    assert.doesNotMatch(xml, /<uses-permission|<receiver|<service|<provider/, 'nada além da activity');
    assert.equal((xml.match(/<activity\b/g) || []).length, 1, 'uma activity só');
    assert.match(xml, /<application>\s*<activity android:name="\.MainActivity">/, 'a MainActivity de main, dentro do application');
    assert.doesNotMatch(xml, /android:exported|android:launchMode/, 'o exported e o singleTask vêm de main');
    const comentarios = [...xml.matchAll(/<!--([\s\S]*?)-->/g)];
    assert.equal(comentarios.length, (xml.match(/<!--/g) || []).length, 'cada comentário fecha');
    for (const c of comentarios) assert.ok(!c[1].includes('--'), '«--» dentro de um comentário parte o XML');
  });

  test('o intent-filter: VIEW, DEFAULT e BROWSABLE, https://dev.rendorium.com/t/entrar, com autoVerify', () => {
    const xml = ler(MANIFESTO_DEV);
    const filtros = [...xml.matchAll(/<intent-filter\b([^>]*)>([\s\S]*?)<\/intent-filter>/g)];
    assert.equal(filtros.length, 1, 'um intent-filter');
    const [, atributos, dentro] = filtros[0];
    assert.match(atributos, /android:autoVerify="true"/, 'autoVerify, para o Android confirmar no assetlinks.json');
    assert.match(dentro, /<action android:name="android\.intent\.action\.VIEW" \/>/, 'VIEW');
    assert.match(dentro, /<category android:name="android\.intent\.category\.DEFAULT" \/>/, 'DEFAULT');
    assert.match(dentro, /<category android:name="android\.intent\.category\.BROWSABLE" \/>/, 'BROWSABLE: abre-se do browser e do Discord');
    const datas = [...dentro.matchAll(/<data\b([^>]*?)\/>/g)].map((m) => m[1]);
    assert.equal(datas.length, 1, 'um <data> só: com vários, o Android cruza-os todos');
    assert.match(datas[0], /android:scheme="https"/, 'só https');
    assert.match(datas[0], /android:host="dev\.rendorium\.com"/, 'o host do dev');
    assert.match(datas[0], /android:path="\/t\/entrar"/, 'o caminho exato do /test, o mesmo que a MainActivity aceita');
    assert.doesNotMatch(dentro, /android:scheme="http"|android:host="\*/, 'nem http nem hosts com asterisco');
  });

  test('o manifesto de main (o da produção) não declara nada disto', () => {
    const main = ler('android/app/src/main/AndroidManifest.xml');
    assert.doesNotMatch(main, /android\.intent\.action\.VIEW|BROWSABLE|autoVerify|t\/entrar|android:scheme/, 'a produção fica igual');
    assert.match(main, /android:name="\.MainActivity"[\s\S]*?android:exported="true"[\s\S]*?android:launchMode="singleTask"/, 'a activity de main continua exported e singleTask');
  });

  test('nenhum outro flavor tem manifesto próprio', () => {
    assert.ok(!existsSync(new URL('android/app/src/producao/AndroidManifest.xml', RAIZ)), 'o producao fica com o de main');
  });
});

describe('a MainActivity abre a ligação', () => {
  test('a decisão é uma função pura: https, o host do flavor, sem utilizador nem porta, e o caminho /t/entrar', () => {
    const f = corpo(CODIGO, /static boolean eLigacaoDoTeste\(Uri u, String host\)\s*\{/g);
    assert.ok(f, 'static boolean eLigacaoDoTeste(Uri u, String host)');
    assert.match(f, /u == null \|\| host == null/, 'nulos dão false');
    assert.match(f, /""\.equals\(u\.getScheme\(\)\)/, 'o esquema comparado com um literal');
    assert.match(JAVA, /"https"\.equals\(u\.getScheme\(\)\)/, 'e o literal é https');
    assert.match(f, /host\.equals\(u\.getHost\(\)\)/, 'host igual (dev.rendorium.com.evil.com não passa)');
    assert.match(f, /u\.getUserInfo\(\) == null/, 'nada de utilizador@ antes do host');
    assert.match(f, /u\.getPort\(\) == -1/, 'sem porta');
    assert.match(f, /CAMINHO_TESTE\.equals\(u\.getPath\(\)\)/, 'o caminho exato');
    assert.match(JAVA, /private static final String CAMINHO_TESTE = "\/t\/entrar";/, 'o caminho é /t/entrar');
    assert.doesNotMatch(f, /\bweb\b|getIntent|this\./, 'pura: não lê a activity');
  });

  test('do intent só conta um ACTION_VIEW que não venha dos recentes, e o URL carregado reescreve-se a partir do HOST', () => {
    const f = corpo(CODIGO, /private static String ligacaoDoIntent\(Intent intent\)\s*\{/g);
    assert.ok(f, 'private static String ligacaoDoIntent(Intent intent)');
    assert.match(f, /Intent\.ACTION_VIEW\.equals\(intent\.getAction\(\)\)/, 'só VIEW');
    assert.match(f, /Intent\.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY/, 'quem volta pelos recentes traz o intent antigo, já gasto');
    assert.match(f, /eLigacaoDoTeste\(u, HOST\)/, 'a decisão com o HOST do flavor');
    assert.match(f, /"" \+ HOST \+ CAMINHO_TESTE/, 'o URL feito do HOST e do caminho, não do texto que chegou');
    assert.match(f, /u\.getEncodedQuery\(\)/, 'com a query tal como veio (a assinatura não pode mudar)');
    assert.doesNotMatch(f, /u\.toString\(\)/, 'nunca o URI que chegou, tal e qual');
  });

  test('no onCreate, a ligação ganha ao estado guardado, mas uma vez só', () => {
    const f = corpo(CODIGO, /protected void onCreate\(Bundle state\)\s*\{/g);
    assert.ok(f, 'o onCreate');
    assert.match(f, /ligacaoAberta = state != null && state\.getBoolean\(KEY_LIGACAO_ABERTA, false\);/, 'lê do estado se a ligação já se abriu');
    assert.match(f, /String ligacao = ligacaoAberta \? null : ligacaoDoIntent\(getIntent\(\)\);/, 'senão, a do intent');
    const ini = f.indexOf('if (ligacao != null)');
    const rest = f.indexOf('web.restoreState(state)');
    assert.ok(ini >= 0 && rest > ini, 'a ligação decide-se antes do restoreState');
    assert.match(f.slice(ini), /abrirLigacao\(ligacao\);\s*\}\s*else\s*\{\s*boolean restored = state != null && web\.restoreState\(state\) != null;\s*if \(!restored\) web\.loadUrl\(START_URL\);\s*\}/, 'com ligação, abre-a; sem ela, o de sempre');
    const guardar = corpo(CODIGO, /protected void onSaveInstanceState\(Bundle out\)\s*\{/g);
    assert.match(guardar, /out\.putBoolean\(KEY_LIGACAO_ABERTA, ligacaoAberta\);/, 'e guarda que já a abriu: recriar não a volta a abrir');
  });

  test('com a app aberta (singleTask), a ligação chega ao onNewIntent', () => {
    const f = corpo(CODIGO, /@Override\s+protected void onNewIntent\(Intent intent\)\s*\{/g);
    assert.ok(f, '@Override protected void onNewIntent(Intent intent)');
    assert.match(f, /^\s*super\.onNewIntent\(intent\);\s*setIntent\(intent\);/, 'super e setIntent primeiro');
    assert.match(f, /String ligacao = ligacaoDoIntent\(intent\);/, 'a mesma decisão');
    assert.match(f, /if \(ligacao != null && web != null\) abrirLigacao\(ligacao\);/, 'e só abre se for uma das do /test');
  });

  test('abrir a ligação marca-a como aberta e limpa o histórico depois, para o «voltar» não regressar à sessão de antes', () => {
    const f = corpo(CODIGO, /private void abrirLigacao\(String url\)\s*\{/g);
    assert.ok(f, 'private void abrirLigacao(String url)');
    assert.match(f, /ligacaoAberta = true;/);
    assert.match(f, /limparHistorico = true;/);
    assert.match(f, /web\.loadUrl\(url\);/);
    const fim = corpo(CODIGO, /public void onPageFinished\(WebView v, String url\)\s*\{/g);
    assert.match(fim, /if \(limparHistorico && url != null && !CAMINHO_TESTE\.equals\(Uri\.parse\(url\)\.getPath\(\)\)\) \{\s*v\.clearHistory\(\);\s*limparHistorico = false;\s*\}/, 'limpa no fim da página a seguir à ligação');
  });

  test('o Java continua a compilar à vista: imports, chavetas e nenhum domínio escrito', () => {
    for (const c of ['android.content.Intent', 'android.net.Uri', 'android.os.Bundle']) assert.match(JAVA, new RegExp('^import ' + c.replace(/\./g, '\\.') + ';$', 'm'), 'import ' + c);
    assert.equal((CODIGO.match(/\{/g) || []).length, (CODIGO.match(/\}/g) || []).length, 'as chavetas fecham');
    assert.equal((CODIGO.match(/\(/g) || []).length, (CODIGO.match(/\)/g) || []).length, 'os parênteses fecham');
    assert.doesNotMatch(JAVA, /rendorium\.com/, 'o domínio vem do flavor');
    assert.equal((CODIGO.match(/void onNewIntent\(/g) || []).length, 1, 'um onNewIntent só');
    assert.match(CODIGO, /private static final String KEY_LIGACAO_ABERTA = "";/, 'a chave do estado é uma constante');
    assert.match(CODIGO, /private boolean ligacaoAberta;/);
    assert.match(CODIGO, /private boolean limparHistorico;/);
  });
});

describe('o README do Android', () => {
  test('explica as ligações do /test: o que a APK de dev abre, o autoVerify e o assetlinks, e o Android 10 e o 12+', () => {
    const README = ler('android/README.md');
    const ini = README.search(/^## Ligações do \/test \(só no dev\)$/m);
    assert.ok(ini >= 0, 'a secção «Ligações do /test (só no dev)»');
    const fim = README.indexOf('\n## ', ini + 3);
    const sec = README.slice(ini, fim < 0 ? undefined : fim);
    assert.match(sec, /`https:\/\/dev\.rendorium\.com\/t\/entrar\?…`/, 'as ligações');
    assert.match(sec, /`app\/src\/dev\/AndroidManifest\.xml`/, 'onde vive o intent-filter');
    assert.match(sec, /`android:autoVerify="true"`/, 'o autoVerify');
    assert.match(sec, /`https:\/\/dev\.rendorium\.com\/\.well-known\/assetlinks\.json`/, 'o assetlinks');
    assert.match(sec, /Android 10/, 'o 10');
    assert.match(sec, /Android 12/, 'e o 12+');
    assert.match(sec, /onNewIntent/, 'com a app aberta');
    assert.match(sec, /produção não/i, 'a produção não declara nada');
    assert.doesNotMatch(README, /a app de dev carrega\s+`https:\/\/dev\.rendorium\.com`\)/, 'a frase do topo não diz só que abre o domínio');
  });
});
