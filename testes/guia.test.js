// O guia público «Declarar as rendas» (worker/src/guia-vista.js).
//
// O que aqui se guarda: que a página existe nos dois endereços com o que a
// cada um cabe (indexada na raiz, pré-visualização fora dela), que não traz
// JavaScript nem estilos em linha, que nenhuma secção do texto verificado se
// perde, que o que se deduz e o que não se deduz se distinguem pela forma e
// pelo que se ouve, e que as fontes só apontam para domínios oficiais.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paginaGuia, seccoesDoGuia, CSS_GUIA, CAMINHO_GUIA } from '../worker/src/guia-vista.js';
import { CSS_LANDING } from '../worker/src/landing.js';

const html = await paginaGuia({ raiz: true }).text();
const previa = await paginaGuia({ raiz: false }).text();
// Recebe: h — o HTML. Devolve: o texto visível, sem etiquetas.
const texto = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
// Recebe: h — o HTML; classe — a classe da lista. Devolve: as linhas dessa lista, todas.
const linhas = (h, classe) => {
  const listas = h.match(new RegExp('<ul class="lista ' + classe + '">[\\s\\S]*?</ul>', 'g')) || [];
  return listas.flatMap((l) => l.match(/<li>[\s\S]*?<\/li>/g) || []);
};

describe('o guia «Declarar as rendas»', () => {
  test('vive em /guias/declarar-rendas, indexado só na raiz', () => {
    assert.equal(CAMINHO_GUIA, '/guias/declarar-rendas');
    assert.match(html, /<meta name="robots" content="index,follow">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/rendorium\.com\/guias\/declarar-rendas">/);
    assert.match(previa, /<meta name="robots" content="noindex,nofollow">/);
    assert.doesNotMatch(previa, /canonical/, 'a pré-visualização não se declara a original');
    assert.match(previa, /class="marca" href="\/montra"/, 'e o início é a montra de lá');
  });

  test('não traz JavaScript nem estilos em linha (CSP_ESTRITA)', async () => {
    const r = paginaGuia({ raiz: true });
    assert.match(r.headers.get('Content-Security-Policy'), /default-src 'self'/);
    assert.equal(r.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /\sstyle=|<style/i);
    assert.doesNotMatch(html, /\son[a-z]+=/i);
    assert.match(html, /<link rel="stylesheet" href="\/paginas\/guia\.css">/);
    assert.equal(paginaGuia({ raiz: false }).headers.get('Cache-Control'), 'no-store', 'a pré-visualização não fica em cache');
  });

  test('as sete secções e a nota de segurança, com o índice a apontar para todas', () => {
    const s = seccoesDoGuia();
    assert.deepEqual(s.map((x) => x.id),
      ['regra', 'pode-deduzir', 'nao-pode-deduzir', 'cuidado', 'documentos', 'onde-declarar', 'fontes']);
    for (const x of s) {
      assert.match(html, new RegExp('<section class="bloco" id="' + x.id + '"'), x.id + ' na página');
      assert.match(html, new RegExp('<a href="#' + x.id + '">'), x.id + ' no índice');
    }
    assert.match(html, /id="seguranca"/);
    assert.match(html, /<a href="#seguranca">/);
  });

  test('o texto verificado chega inteiro: cada lista com as suas linhas', () => {
    assert.equal(linhas(html, 'sim').length, 3 + 3 + 9 + 1 + 3, 'o que podes deduzir');
    assert.equal(linhas(html, 'nao').length, 17, 'o que não podes deduzir');
    assert.equal(linhas(html, 'doc').length, 14, 'os documentos a guardar');
    // a regra geral (5), a mudança de habitação (4), a água e a luz (3), onde declarar (4)
    assert.equal(linhas(html, 'cond').length, 5 + 4 + 3 + 4, 'as condições');
    const t = texto(html);
    for (const frase of [
      'Seguro de renda, expressamente incluído no artigo 41.º, n.º 1',
      'imputada de acordo com a respetiva permilagem',
      'nos 24 meses anteriores ao início do arrendamento',
      'a mais de 100 km',
      'AIMI, Adicional ao Imposto Municipal sobre Imóveis',
      'Seguro multirriscos facultativo da habitação',
      'Na sublocação',
      'declaração Modelo 2 do Imposto do Selo',
      'e-balcão',
      'No Anexo F da declaração Modelo 3',
      'a opção sem risco é não a deduzir até teres resposta escrita da AT',
      '8 de novembro de 2026',
      'sem opção pela tributação segundo as regras da categoria B',
    ]) assert.ok(t.includes(frase), 'falta: ' + frase);
  });

  test('o que se deduz e o que não se deduz distinguem-se pela forma e pelo que se ouve', () => {
    for (const l of linhas(html, 'sim')) {
      assert.match(l, /class="i sim"/);
      assert.match(l, /<span class="so-leitor">Podes deduzir: <\/span>/);
    }
    for (const l of linhas(html, 'nao')) {
      assert.match(l, /class="i nao"/);
      assert.match(l, /<span class="so-leitor">Não podes deduzir: <\/span>/);
    }
    assert.match(CSS_GUIA, /\.i\.sim\{color:var\(--in\)\}/);
    assert.match(CSS_GUIA, /\.i\.nao\{color:var\(--danger\)\}/);
  });

  test('por tu, sem a forma de cortesia do texto de origem', () => {
    const t = texto(html);
    // as instruções do texto de origem, uma a uma (o «declare» do conjuntivo, «o contrato declare», fica)
    for (const voce of ['Guarde os três', 'não deduza os','Não as inclua ', 'obtenha resposta', 'apresente um pedido',
      'peça ao empreiteiro', 'Modelo 3, declare', 'ano, conserve']) {
      assert.ok(!t.includes(voce), 'por você: ' + voce);
    }
    for (const tu of ['Guarda os três', 'não deduzas', 'Não as incluas', 'obtém resposta', 'apresenta um pedido',
      'pede ao empreiteiro', 'Modelo 3, declara', 'ano, conserva']) {
      assert.ok(t.includes(tu), 'por tu: ' + tu);
    }
    assert.doesNotMatch(t, /\(s\)|\bpôr\b|\btirar\b/, 'as regras de escrita da casa');
  });

  test('as fontes apontam só para domínios oficiais', () => {
    const fontes = /<ul class="fontes">([\s\S]*?)<\/ul>/.exec(html)[1];
    const urls = [...fontes.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.equal((fontes.match(/<li>/g) || []).length, 9, 'as nove fontes');
    assert.ok(urls.length > 0);
    for (const u of urls) assert.match(u, /^https:\/\/(?:info\.portaldasfinancas\.gov\.pt|diariodarepublica\.pt)\//, u);
  });

  test('título e descrição cabem no que os motores mostram, e as redes dizem o mesmo', () => {
    const titulo = /<title>([^<]+)<\/title>/.exec(html)[1];
    const desc = /<meta name="description" content="([^"]+)">/.exec(html)[1];
    assert.ok(titulo.length <= 60, 'título com ' + titulo.length);
    assert.ok(desc.length >= 110 && desc.length <= 160, 'descrição com ' + desc.length);
    assert.ok(html.includes('<meta property="og:description" content="' + desc + '">'), 'as redes dizem o mesmo');
    assert.doesNotMatch(html, /og:image/, 'a imagem da montra ainda fala da Declaração: não se usa aqui');
  });

  test('a folha usa as letras e o tema da montra, e o hover só com rato', () => {
    const letras = (t) => (t.match(/@font-face\{[^}]*\}/g) || []).join('\n');
    assert.equal(letras(CSS_GUIA), letras(CSS_LANDING));
    assert.match(CSS_GUIA, /@media\(prefers-color-scheme:dark\)\{:root\{/);
    const semPortao = CSS_GUIA.replace(/@media\(hover:hover\) and \(pointer:fine\)\{[\s\S]*?\n\}/g, '');
    assert.doesNotMatch(semPortao, /:hover/, 'nenhum :hover fora do portão');
  });

  test('tem a ligação para saltar ao conteúdo, e o fecho não promete a Declaração', () => {
    assert.match(html, /<a class="saltar" href="#conteudo">/);
    assert.match(html, /<main class="wrap" id="conteudo">/);
    const fecho = /<section class="fecho"[\s\S]*?<\/section>/.exec(html)[0];
    assert.doesNotMatch(fecho, /IRS|Declara|Anexo|calcula/, 'o fecho fala da app de produção');
    assert.match(fecho, /\?criar=1/);
  });
});
