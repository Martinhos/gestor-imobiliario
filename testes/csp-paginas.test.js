// As páginas que o worker escreve, com a CSP sem 'unsafe-inline'.
//
// A landing, os documentos legais, os docs, o back office (e o ecrã de
// entrada dele) e as páginas do /t/entrar respondem com a CSP_ESTRITA: a CSP
// geral sem 'unsafe-inline' no script-src nem no style-src. Com ela, um
// <script> ou um <style> escritos no HTML, um on…= ou um style= não correm —
// a página ficava morta ou despida sem dar erro nenhum no servidor. O que se
// guarda aqui é que nenhuma destas páginas os traga, que a política chegue
// ao browser por cima do harden(), e que os ficheiros que os substituem
// (paginas-recursos.js) saiam com o tipo certo e só para quem os podia ver.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import worker from '../worker/src/index.js';
import { CSP_ESTRITA } from '../worker/src/lib/http.js';
import { CAMINHOS_DOS_RECURSOS, recursoDePagina } from '../worker/src/paginas-recursos.js';
import { ambiente, conta } from './lib/api.js';

const TOKEN_EQUIPA = 'e'.repeat(64);

/* O ambiente do worker com uma sessão de equipa de master no KV, como a
   deixa o POST /equipa/entrar.
   Devolve: o env. */
async function comSessaoDeEquipa() {
  const env = ambiente();
  const agora = Date.now();
  await env.SESSIONS.put('equipa:' + TOKEN_EQUIPA, JSON.stringify({
    discordId: 'm1', nome: 'Mestre', papel: 'master', papeis: ['master'], desde: agora, guildId: null, verificadoEm: agora,
  }));
  return env;
}

/* Um pedido ao worker inteiro, como a Cloudflare o faz (passa pelo harden).
   Recebe: env; caminho — o caminho a pedir; opcoes (opcional) — {equipa:
   true} para levar o cookie da sessão de equipa, {metodo} para outro método.
   Devolve: promessa da Response. */
async function pedirAoWorker(env, caminho, opcoes = {}) {
  const headers = opcoes.equipa ? { Cookie: 'gi_equipa=' + TOKEN_EQUIPA } : {};
  const fundo = [];
  const r = await worker.fetch(new Request('https://app.x.pt' + caminho, { method: opcoes.metodo || 'GET', headers }),
    env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
  return r;
}

// As etiquetas de abertura de um HTML. O texto que as páginas escrevem vai
// escapado (um < é &lt;), por isso isto só apanha etiquetas a sério. Um >
// dentro de um valor entre aspas (alt="a > b") não fecha a etiqueta: o que
// vem depois dele também se vê.
const etiquetas = (html) => html.match(/<[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>/g) || [];

// O que o JavaScript servido não pode escrever no HTML que monta: qualquer
// on…= e qualquer style=, com aspas duplas, plicas ou sem nada. As
// propriedades do DOM (d.onclose = …, el.style.x = …) têm um ponto antes, e
// passam.
const ON_NO_JS = /\son[a-z]+\s*=/i;
const STYLE_NO_JS = /\sstyle\s*=/i;

/* O que a CSP_ESTRITA recusaria numa página: scripts em linha (um
   <script type="application/json"> não corre, e passa), <style>, atributos
   on…= e style=.
   Recebe: html — a página.
   Devolve: a lista do que se recusaria (vazia quando está limpa). */
function recusas(html) {
  const fora = [];
  for (const t of etiquetas(html)) {
    if (/^<script\b/i.test(t) && !/\ssrc="/.test(t) && !/\stype="application\/json"/.test(t)) fora.push('script em linha: ' + t);
    if (/^<style\b/i.test(t)) fora.push('<style>: ' + t);
    if (/\son[a-z]+\s*=/i.test(t)) fora.push('on…=: ' + t);
    if (/\sstyle\s*=/i.test(t)) fora.push('style=: ' + t);
  }
  return fora;
}

const BILHETE = 'b'.repeat(64);

/* Um bilhete de entrada da equipa na base, como o deixa o criarBilhete, no
   estado que o teste quer.
   Recebe: env; estado — 'boa', 'usada' ou 'expirou'; nome (opcional) — o
   nome de quem entra, escrito na página.
   Devolve: nada — a promessa resolve quando a linha está escrita. */
async function bilhete(env, estado, nome = 'Mestre <b>') {
  const agora = Date.now();
  const payload = JSON.stringify({ discordId: 'm1', nome, papel: 'master', papeis: ['master'], guildId: null });
  await env.DB.prepare('INSERT INTO team_links (token, payload, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?)')
    .bind(BILHETE, payload, agora, estado === 'expirou' ? agora - 1000 : agora + 300000, estado === 'usada' ? agora : null).run();
}

// Cada página, pedida ao worker como a pede o browser: [nome, caminho,
// opções ({equipa} com sessão, {bilhete} com um bilhete nesse estado), o
// estado HTTP esperado].
const PAGINAS = [
  ['a montra', '/montra', {}, 200],
  ['os termos', '/termos', {}, 200],
  ['a privacidade', '/privacidade', {}, 200],
  // sem sessão, o /equipa e o /equipa/docs mostram o ecrã de entrada com 401 (já era assim antes da CSP)
  ['o ecrã de entrada da equipa (sem sessão)', '/equipa', {}, 401],
  ['a ligação de entrada da equipa (que não existe)', '/equipa/entrar?t=' + 'a'.repeat(64), {}, 410],
  ['a ligação de entrada da equipa (boa, com o formulário)', '/equipa/entrar?t=' + BILHETE, { bilhete: 'boa' }, 200],
  ['a ligação de entrada da equipa (boa, a caminho dos docs)', '/equipa/entrar?depois=docs&t=' + BILHETE, { bilhete: 'boa' }, 200],
  ['a ligação de entrada da equipa (já usada)', '/equipa/entrar?t=' + BILHETE, { bilhete: 'usada' }, 410],
  ['a ligação de entrada da equipa (expirou)', '/equipa/entrar?t=' + BILHETE, { bilhete: 'expirou' }, 410],
  ['os docs sem sessão', '/equipa/docs', {}, 401],
  ['o back office', '/equipa', { equipa: true }, 200],
  ['os docs', '/equipa/docs', { equipa: true }, 200],
  ['o /t/entrar sem chave', '/t/entrar', {}, 503],
];

describe('as páginas do worker, com a CSP sem unsafe-inline', () => {
  test('a CSP_ESTRITA é a geral sem unsafe-inline nem os sha256, e mais nada diferente', async () => {
    // a geral, como o harden a põe numa resposta qualquer da API
    const geral = (await pedirAoWorker(ambiente(), '/api/me')).headers.get('Content-Security-Policy');
    assert.match(geral, /default-src 'self'/, 'controlo: a geral veio');
    // os hashes que a app vier a ter para os seus dois scripts em linha também não são destas páginas
    assert.equal(CSP_ESTRITA, geral.replace(/ '(?:unsafe-inline|sha256-[^']+)'/g, ''));
    assert.doesNotMatch(CSP_ESTRITA, /unsafe-inline/);
  });

  test('controlo: as guardas apanham o que a CSP_ESTRITA recusaria, também escondido', () => {
    assert.deepEqual(recusas('<p>limpo</p><script type="application/json" id="x">{}</script><script src="/a.js"></script>'), []);
    assert.equal(recusas('<img alt="a > b" onerror="x()">').length, 1, 'um on…= depois de um > entre aspas');
    assert.equal(recusas("<img alt='a > b' style='color:red'>").length, 1, 'um style= com plicas depois de um > entre plicas');
    assert.equal(recusas('<form onsubmit=x()>').length, 1, 'um on…= sem aspas');
    assert.equal(recusas('<script>x()</script>').length, 1, 'um script em linha');
    assert.equal(recusas('<style>p{}</style>').length, 1, 'um <style>');
    for (const js of ["h += '<img onerror=\"x()\">'", "h += '<body onload=x()>'", "h += \"<p style='a:b'>\"", "h += '<p style = \"a:b\">'"]) {
      assert.ok(ON_NO_JS.test(js) || STYLE_NO_JS.test(js), js);
    }
    for (const js of ['d.onclose = function () {}', "el.style.display = 'none'"]) {
      assert.ok(!ON_NO_JS.test(js) && !STYLE_NO_JS.test(js), js + ' é uma propriedade do DOM, e passa');
    }
  });

  for (const [nome, caminho, op, estado] of PAGINAS) {
    test(nome + ' sai com a CSP_ESTRITA e sem nada em linha que ela recuse', async () => {
      const env = op.equipa ? await comSessaoDeEquipa() : ambiente();
      if (op.bilhete) await bilhete(env, op.bilhete);
      const r = await pedirAoWorker(env, caminho, op);
      assert.equal(r.status, estado, 'o estado da página');
      assert.match(r.headers.get('Content-Type'), /^text\/html/, 'é uma página');
      assert.equal(r.headers.get('Content-Security-Policy'), CSP_ESTRITA, 'o harden deixa-a passar');
      const html = await r.text();
      assert.deepEqual(recusas(html), []);
      // o que substitui o que estava em linha existe mesmo
      for (const t of etiquetas(html)) {
        const m = /^<(?:script|link)\b[^>]*\s(?:src|href)="(\/(?:paginas|equipa)\/[^"]+\.(?:js|css))"/.exec(t);
        if (m) assert.ok(CAMINHOS_DOS_RECURSOS.includes(m[1]), m[1] + ' é servido pelo worker');
      }
    });
  }

  test('a ligação de entrada da equipa (boa) leva o formulário, e o nome do bilhete sai escapado', async () => {
    const MAU = '<img src=x onerror=alert(1)>';
    const ESCAPADO = '&lt;img src=x onerror=alert(1)&gt;';
    const env = ambiente();
    await bilhete(env, 'boa', MAU);
    const r = await pedirAoWorker(env, '/equipa/entrar?t=' + BILHETE);
    assert.equal(r.status, 200, 'controlo: a ligação é boa');
    const html = await r.text();
    assert.ok(html.includes('<form method="POST" action="/equipa/entrar">'), 'o formulário que gasta a ligação');
    assert.match(html, /<button class="[^"]*\blargo\b[^"]*" type="submit">Entrar<\/button>/, 'o botão .largo');
    assert.match(await (await pedirAoWorker(ambiente(), '/equipa/estilos.css')).text(), /\.largo\{/,
      'e o .largo existe na folha que a página liga');
    assert.ok(html.includes(ESCAPADO), 'o nome sai escapado');
    assert.ok(!html.includes(MAU), 'e nunca cru');
    assert.deepEqual(recusas(html), []);
    // controlo: se o escape falhasse, o recusas() apanhava o onerror
    assert.equal(recusas(html.replace(ESCAPADO, MAU)).length, 1, 'o recusas() vê o nome cru');
  });

  test('o back office leva os dados da sessão num script que não corre, e o guião à parte', async () => {
    const html = await (await pedirAoWorker(await comSessaoDeEquipa(), '/equipa', { equipa: true })).text();
    const scripts = etiquetas(html).filter((t) => /^<script\b/.test(t));
    assert.deepEqual(scripts, ['<script type="application/json" id="dados-equipa">', '<script src="/equipa/guiao.js">']);
    assert.match(html, /data-acao="sair"/, 'o Sair vai pela delegação');
  });

  test('a página de produção do /t/entrar também', async () => {
    const env = ambiente({ ENV_NAME: undefined });
    const r = await pedirAoWorker(env, '/t/entrar');
    assert.equal(r.status, 404);
    assert.equal(r.headers.get('Content-Security-Policy'), CSP_ESTRITA);
    assert.deepEqual(recusas(await r.text()), []);
  });
});

describe('os ficheiros que substituem o que estava em linha', () => {
  const EQUIPA = ['/equipa/guiao.js', '/equipa/docs.css', '/equipa/docs.js'];

  test('saem com o tipo certo, e o JavaScript compila', async () => {
    for (const c of CAMINHOS_DOS_RECURSOS) {
      const r = await pedirAoWorker(await comSessaoDeEquipa(), c, { equipa: true });
      assert.equal(r.status, 200, c);
      assert.equal(r.headers.get('Content-Type'), c.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', c);
      assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff', c + ': o browser não adivinha o tipo');
      const texto = await r.text();
      assert.ok(texto.length > 100, c + ' tem conteúdo');
      if (c.endsWith('.js')) {
        assert.doesNotThrow(() => new Function(texto), c + ' compila');
        // o HTML que o JavaScript escreve também vive debaixo da CSP_ESTRITA
        assert.doesNotMatch(texto, ON_NO_JS, c + ' não escreve on…=');
        assert.doesNotMatch(texto, STYLE_NO_JS, c + ' não escreve style=');
      } else {
        assert.doesNotMatch(texto, /<\/?style/i, c + ' é só CSS');
      }
    }
  });

  test('o que só ia em páginas da equipa só se dá a quem tem sessão de equipa', async () => {
    for (const c of EQUIPA) {
      const r = await pedirAoWorker(ambiente(), c);
      assert.equal(r.status, 401, c + ' sem sessão');
      assert.doesNotMatch(await r.text(), /function|\{/, c + ' não deixa sair nada');
    }
  });

  test('uma sessão de cliente da app, a sério, não serve para o que é da equipa', async () => {
    const env = ambiente();
    const cliente = await conta(env, 'Cliente');
    // controlo: a sessão é boa, pelo Bearer e pelo cookie
    assert.equal((await worker.fetch(new Request('https://app.x.pt/api/me', { headers: { Authorization: 'Bearer ' + cliente.token } }),
      env, { waitUntil() {} })).status, 200, 'controlo: o Bearer entra na app');
    assert.equal((await worker.fetch(new Request('https://app.x.pt/api/me', { headers: { Cookie: 'gi_session=' + cliente.token } }),
      env, { waitUntil() {} })).status, 200, 'controlo: o cookie entra na app');
    for (const c of EQUIPA) {
      for (const headers of [{ Authorization: 'Bearer ' + cliente.token }, { Cookie: 'gi_session=' + cliente.token }]) {
        const r = await worker.fetch(new Request('https://app.x.pt' + c, { headers }), env, { waitUntil() {} });
        assert.equal(r.status, 401, c + ' com ' + Object.keys(headers)[0]);
        assert.doesNotMatch(await r.text(), /function|\{/, c + ' não deixa sair nada');
      }
    }
  });

  test('o que é das páginas públicas serve-se a toda a gente, também no domínio raiz', async () => {
    for (const c of CAMINHOS_DOS_RECURSOS.filter((x) => !EQUIPA.includes(x))) {
      const r = await worker.fetch(new Request('https://rendorium.com' + c), ambiente(), { waitUntil() {} });
      assert.equal(r.status, 200, c + ' no domínio raiz não é reencaminhado para a app');
    }
  });

  test('só GET e HEAD; e um caminho que não é de nenhum recurso segue para as outras rotas', async () => {
    assert.equal((await pedirAoWorker(ambiente(), '/paginas/landing.css', { metodo: 'POST' })).status, 405);
    assert.equal((await pedirAoWorker(ambiente(), '/paginas/landing.css', { metodo: 'HEAD' })).status, 200);
    assert.equal(await recursoDePagina('/paginas/outra.css', 'GET', async () => true), null);
    assert.equal(await recursoDePagina('/paginas/constructor', 'GET', async () => true), null);
  });
});
