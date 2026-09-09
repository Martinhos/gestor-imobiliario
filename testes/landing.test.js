// A página de entrada do rendorium.com.
//
// O que se testa aqui é sobretudo uma coisa: que as imagens que a página pede
// existem mesmo. Elas são geradas por scripts/capturas.js e vivem em disco;
// renomear uma captura, ou tirá-las só num tema, dava uma página com buracos
// que ninguém veria até alguém abrir o site.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paginaLanding } from '../worker/src/landing.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const raiz = (p) => path.join(AQUI, '..', p);

/* Em produção. Fora do domínio raiz a mesma função devolve uma
   pré-visualização, com noindex e sem og — testado mais abaixo. */
const resposta = paginaLanding({ raiz: true });
const html = await resposta.text();

describe('a página de entrada', () => {
  test('sai como HTML, em cache, e sem restos de template', () => {
    assert.equal(resposta.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.match(resposta.headers.get('Cache-Control'), /max-age=3600/);
    assert.ok(!html.includes('${'), 'nenhum ${} por interpolar');
    assert.ok(!html.includes('undefined'), 'nada ficou undefined');
  });

  /* Cada imagem tem de existir nos dois temas: a clara no src e a escura na
     <source> da media query. Uma que falte não dá erro nenhum — dá um buraco. */
  test('todas as capturas que a página pede existem em disco, nos dois temas', () => {
    const pedidas = [...html.matchAll(/(?:src|srcset)="(\/img\/landing\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(pedidas.length >= 6, 'a página mostra o produto (' + pedidas.length + ' imagens)');
    pedidas.forEach((p) => {
      const f = raiz('web' + p);
      assert.ok(fs.existsSync(f), 'falta ' + p + ' — correr: node scripts/capturas.js');
      assert.ok(fs.statSync(f).size > 4096, p + ' é pequena de mais para ser uma captura');
    });
    // e a que se vê ao partilhar a ligação
    assert.ok(fs.existsSync(raiz('web/img/landing/partilha.webp')), 'falta a imagem de partilha');
  });

  test('cada <picture> tem a escura na media query e a clara por omissão', () => {
    const blocos = [...html.matchAll(/<picture>[\s\S]*?<\/picture>/g)].map((m) => m[0]);
    assert.equal(blocos.length, 3, 'as três capturas da página');
    blocos.forEach((b) => {
      assert.match(b, /media="\(prefers-color-scheme: dark\)"/, 'segue o tema de quem lê');
      assert.match(b, /-dark\.webp/, 'tem a escura');
      assert.match(b, /-light\.webp/, 'e a clara');
      assert.match(b, /width="\d+" height="\d+"/, 'com medidas, senão o texto salta quando ela chega');
      assert.match(b, /alt="[^"]{20,}"/, 'e uma descrição a sério');
    });
  });

  /* A primeira imagem é a que se vê ao abrir: adiá-la é adiar a única prova de
     que a app existe. As outras esperam. */
  test('a do hero carrega já; as de baixo esperam', () => {
    const blocos = [...html.matchAll(/<picture>[\s\S]*?<\/picture>/g)].map((m) => m[0]);
    assert.ok(!blocos[0].includes('loading="lazy"'), 'a do hero não espera');
    assert.ok(blocos.slice(1).every((b) => b.includes('loading="lazy"')), 'as outras esperam');
  });

  test('não tem JavaScript nenhum', () => {
    assert.ok(!/<script/i.test(html), 'o carrossel era a única razão para ter, e saiu');
  });

  /* O favicon vinha de app.rendorium.com e a CSP do worker recusava-o
     (img-src 'self'). Os ícones estão no mesmo web/, portanto no mesmo sítio. */
  test('as imagens são todas do próprio sítio', () => {
    const src = [...html.matchAll(/(?:src|href)="([^"]+\.(?:png|webp|jpg|svg))"/g)].map((m) => m[1]);
    src.forEach((s) => assert.ok(s.startsWith('/'), s + ' devia ser do próprio sítio (a CSP recusa o resto)'));
    assert.ok(fs.existsSync(raiz('web/icon-192.png')), 'o favicon existe onde é pedido');
  });

  test('diz o que é preciso a quem partilha a ligação', () => {
    assert.match(html, /property="og:image" content="https:\/\/rendorium\.com\/img\/landing\/partilha\.webp"/);
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    assert.match(html, /property="og:image:width" content="1200"/);
  });

  /* A decisão de setembro de 2026: deixou de haver planos. A página diz-o, e
     este teste existe para ninguém a deixar a prometer o contrário. */
  /* O rodapé dizia «Termos e privacidade: dentro da app». Quem quer saber a
     quem entrega os dados dos inquilinos faz a pergunta antes de criar conta —
     agora há para onde apontar (worker/src/legal-vista.js). */
  test('o rodapé leva aos documentos, em vez de dizer onde eles estão', () => {
    assert.match(html, /href="\/termos"/, 'os Termos');
    assert.match(html, /href="\/privacidade"/, 'a Privacidade');
    assert.ok(!/dentro da app, em Definições/.test(html), 'já não manda procurar');
  });

  /* Os três botões iam ao mesmo endereço, o que faz da escolha um adorno.
     «Criar conta» passa a levar ?criar=1, que a app lê para abrir já no
     registo (web/cloud/entrada.js:showAuth). */
  test('os botões não vão todos ao mesmo sítio', () => {
    const botoes = [...html.matchAll(/<a class="btn[^"]*" href="([^"]+)">([^<]+)</g)]
      .map((m) => ({ href: m[1], texto: m[2].trim() }));
    assert.ok(botoes.length >= 3, 'há botões que cheguem');
    const criar = botoes.filter((b) => b.texto === 'Criar conta');
    assert.ok(criar.length >= 1, 'há um «Criar conta»');
    criar.forEach((b) => assert.match(b.href, /\?criar=1$/, 'leva ao registo'));
    const entrar = botoes.filter((b) => /Abrir a app|Já tenho conta/.test(b.texto));
    entrar.forEach((b) => assert.ok(!/criar=1/.test(b.href), 'e estes não'));
    assert.equal(new Set(botoes.map((b) => b.href)).size, 2, 'dois destinos, não um');
  });

  /* A página tem mais de quatro mil pixéis: a marca e a porta de entrada não
     podem ficar lá em cima. O tratamento é o mesmo do cabeçalho da app. */
  test('o cabeçalho acompanha o scroll', () => {
    assert.match(html, /\.faixa-topo\{position:sticky;top:0/, 'cola ao topo');
    assert.match(html, /backdrop-filter:blur\(12px\)/, 'com o mesmo vidro da app');
    assert.match(html, /--blur:/, 'e o token que o pinta');
    assert.match(html, /<div class="faixa-topo">/, 'e a faixa envolve mesmo o cabeçalho');
  });

  test('a pré-visualização não fica presa em cache', async () => {
    const { paginaLanding: p } = await import('../worker/src/landing.js');
    assert.match(p({ raiz: true }).headers.get('Cache-Control'), /max-age=3600/, 'em produção, cache');
    assert.equal(p().headers.get('Cache-Control'), 'no-store',
      'fora dela não: uma pré-visualização em cache mente durante uma hora');
  });

  test('a app sabe abrir já no registo', () => {
    const entrada = fs.readFileSync(raiz('web/cloud/entrada.js'), 'utf8');
    assert.match(entrada, /\[\?&\]criar=1/, 'lê o ?criar=1 do endereço');
    assert.match(entrada, /CW\.showAuthMode = 'register'/, 'e abre no registo');
  });

  test('diz que é grátis e sem planos', () => {
    assert.match(html, /sem planos/i);
    assert.ok(!/plano (plus|pro)|subscri|mensalidade|€\s*\/\s*m[êe]s/i.test(html),
      'nada que sugira escalões ou pagamentos');
  });
});
