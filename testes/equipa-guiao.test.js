// O guião do /equipa é texto dentro de um template literal do servidor —
// um \n a menos e o browser recebe JavaScript partido, com a página morta
// em "A carregar…" para a equipa inteira. O node --check do ficheiro não
// apanha isto (o template é legal); só o parse do guião GERADO apanha.
// Foi exatamente assim que o back office partiu uma vez: nunca mais.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { paginaEquipa } from '../worker/src/equipa-vista.js';
import { recursoDePagina } from '../worker/src/paginas-recursos.js';

const EUS = [
  { nome: 'Mestre', discordId: 'm1', papel: 'master', papeis: ['master'] },
  { nome: 'Sofia', discordId: 's1', papel: 'suporte', papeis: ['suporte'] },
  { nome: 'Dev', discordId: 'd1', papel: 'dev', papeis: ['dev'] },
];

// o guião como o browser o recebe: pelo /equipa/guiao.js, com sessão de equipa
const guiaoServido = async () => (await recursoDePagina('/equipa/guiao.js', 'GET', async () => true)).text();

/* Com a CSP_ESTRITA o guião já não vai dentro da página: a página traz os
   dados da sessão num <script type="application/json"> e carrega o guião do
   /equipa/guiao.js. */
describe('o guião servido pelo /equipa compila', () => {
  for (const eu of EUS) {
    test('para ' + eu.papel, async () => {
      const html = await new Response(paginaEquipa(eu).body).text();
      const m = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(html);
      assert.ok(m, 'a página traz os dados da sessão');
      const dados = JSON.parse(m[1]);
      assert.equal(dados.eu.nome, eu.nome, 'que o guião lê');
      assert.ok(dados.ESTADOS && dados.CATS, 'com os estados e as categorias');
      assert.match(html, /<script src="\/equipa\/guiao\.js"><\/script>/, 'e carrega o guião à parte');
      const guiao = await guiaoServido();
      // parse only: new Function rebenta com o mesmo SyntaxError que o browser
      assert.doesNotThrow(() => new Function(guiao), 'o guião servido tem de fazer parse');
    });
  }

  /* A armadilha era o servidor cozer o guião: um \n escrito numa string do
     browser virava uma quebra verdadeira no JavaScript servido, e cada plica
     e cada quebra tinham de ir dobradas. Com o guião num String.raw, o que se
     escreve no ficheiro é o que o browser recebe — não há o que dobrar. */
  // achado A.5-8
  test('o guião servido é o texto do ficheiro tal e qual: o servidor não coze nada', async () => {
    const { GUIAO } = await import('../worker/src/equipa-guiao.js');
    const fonte = readFileSync(new URL('../worker/src/equipa-guiao.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const inicio = fonte.indexOf('String.raw`');
    assert.ok(inicio > -1, 'o guião é um String.raw');
    const texto = fonte.slice(inicio + 'String.raw`'.length, fonte.lastIndexOf('`'));
    assert.equal(GUIAO, texto, 'o que está escrito no ficheiro é o que sai');
    assert.doesNotMatch(texto, /\$\{|`/, 'sem interpolações nem crases lá dentro');
    assert.doesNotMatch(texto, /\\\\[n']/, 'e nada escrito a dobrar');
    assert.match(texto, /\\n/, 'as quebras nas mensagens escrevem-se \\n, como em qualquer JavaScript');
    assert.equal(await guiaoServido(), GUIAO, 'o /equipa/guiao.js serve o guião sem mexer numa letra');
    for (const eu of EUS) {
      const html = await new Response(paginaEquipa(eu).body).text();
      assert.ok(!html.includes(GUIAO.slice(0, 200)), 'e a página de ' + eu.papel + ' já não o leva dentro');
    }
  });
});

/* A ferramenta da equipa veste a linguagem da app — cobalto, cartões,
   selos, Geist e Bricolage —, mas com a barra GRAFITE e a marca em ardósia,
   para nunca se confundir com a app (azul-noite). O que pede valores ou um
   motivo abre a janela de confirmação, e o resultado diz-se no aviso de
   baixo: nem alert(), nem prompt(), nem <select>. */
describe('o back office na linguagem nova', () => {
  test('nada de alert(), prompt(), confirm() nem <select>; desligar um serviço pergunta numa faixa do cartão', async () => {
    const { GUIAO } = await import('../worker/src/equipa-guiao.js');
    // o código, sem os comentários (que podem contar como era antes)
    const codigo = GUIAO.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(codigo.length > GUIAO.length / 2, 'controlo: tirar os comentários deixou o código');
    assert.doesNotMatch(codigo, /\balert\(/, 'sem alert(): os resultados vão para o aviso de baixo');
    assert.doesNotMatch(codigo, /\bprompt\(/, 'sem prompt(): os valores pedem-se na janela');
    assert.doesNotMatch(codigo, /<select/, 'sem <select>: os modelos são um menu e as categorias são chips');
    assert.doesNotMatch(codigo, /\bconfirm\(/, 'sem confirm(): desligar um serviço pergunta na faixa âmbar do cartão');
    assert.match(codigo, /if \(!confirmado\) \{ mostrarAvisoDesligar\(id, servico, nome, caem\); return; \}/, 'desligar mostra a faixa antes de pedir');
    assert.match(GUIAO, /function formulario\(/, 'a janela de confirmação existe');
    assert.match(GUIAO, /CAMPO_MOTIVO = \{ nome: 'motivo'[^}]*min: 5, max: 300/, 'o motivo com o mínimo e o máximo que o servidor pede');
    assert.match(GUIAO, /function avisar\(/, 'e o aviso de baixo também');
  });

  test('os dois CSS declaram as letras de /fonts/, os tokens da app e a barra grafite, sem o verde antigo nem o azul-noite', async () => {
    const { CSS_EQUIPA } = await import('../worker/src/equipa-vista.js');
    const { CSS_DOCS } = await import('../worker/src/docs-vista.js');
    for (const [nome, css] of [['CSS_EQUIPA', CSS_EQUIPA], ['CSS_DOCS', CSS_DOCS]]) {
      assert.match(css, /font-family:'Geist'[^}]*src:url\(\/fonts\/geist\.woff2\)/, nome + ': a Geist, de /fonts/');
      assert.match(css, /font-family:'Bricolage Grotesque'[^}]*src:url\(\/fonts\/bricolage-grotesque\.woff2\)/, nome + ': a Bricolage, de /fonts/');
      assert.match(css, /--accent:#2952D9/, nome + ': o cobalto');
      assert.match(css, /--eq:#161A23/, nome + ': a barra grafite');
      assert.match(css, /--eq-marca:#5B6478/, nome + ': a marca em ardósia');
      assert.doesNotMatch(css, /#244c3b|#5ee0a8|#17221d/i, nome + ': nada do verde antigo');
      assert.doesNotMatch(css, /#0E1830/i, nome + ': nunca o azul-noite da barra da app');
      assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic/, nome + ': nada de letras do Google (a CSP recusa)');
    }
  });

  test('a página traz a barra lateral com a marca e o selo «Equipa», a Documentação, o Sair, a janela e o aviso', async () => {
    const html = await new Response(paginaEquipa(EUS[0]).body).text();
    assert.match(html, /<nav class="eq-lado" aria-label="Equipa">/);
    assert.match(html, /<span class="mark" aria-hidden="true"><\/span><span class="eq-nome">Rendorium<\/span><span class="eq-selo">Equipa<\/span>/);
    assert.match(html, /<a class="nv" href="\/equipa\/docs">/);
    assert.match(html, /<button type="button" class="eq-sair" data-acao="sair">Sair<\/button>/);
    assert.match(html, /<dialog class="janela" id="dialogo" aria-labelledby="janelaTit">/);
    assert.match(html, /id="aviso" role="status" aria-live="polite"/);
  });
});
