// O guia público «Declarar as rendas» (worker/src/guia-vista.js).
//
// O que aqui se guarda: que a página existe nos dois endereços com o que a
// cada um cabe (indexada na raiz, com os dados estruturados; pré-visualização
// fora dela), que não traz JavaScript nem estilos em linha, que se encontra
// pelo IRS, que o caminho e o «Voltar ao início» levam à montra, que segue a
// ordem de quem declara (ticket a89a5fcb: se tens de declarar, onde, como, o
// que podes deduzir, as fontes), que nenhuma secção do texto verificado se
// perde nem muda de id, que as partes novas citam a fonte oficial, que o que
// se deduz e o que não se deduz se distinguem pela forma e pelo que se ouve,
// e que as fontes só apontam para domínios oficiais.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paginaGuia, seccoesDoGuia, CSS_GUIA, CAMINHO_GUIA, H1 } from '../worker/src/guia-vista.js';
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

  /* O único <script> é o bloco de dados dos motores de busca (ld+json), que
     não corre, e só na raiz. */
  test('não traz JavaScript nem estilos em linha (CSP_ESTRITA)', async () => {
    const r = paginaGuia({ raiz: true });
    assert.match(r.headers.get('Content-Security-Policy'), /default-src 'self'/);
    assert.equal(r.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.deepEqual(html.match(/<script\b[^>]*>/gi), ['<script type="application/ld+json">'], 'na raiz, só o bloco de dados');
    assert.doesNotMatch(previa, /<script/i, 'e na pré-visualização nem isso');
    assert.doesNotMatch(html, /\sstyle=|<style/i);
    assert.doesNotMatch(html, /\son[a-z]+=/i);
    assert.match(html, /<link rel="stylesheet" href="\/paginas\/guia\.css">/);
    assert.equal(paginaGuia({ raiz: false }).headers.get('Cache-Control'), 'no-store', 'a pré-visualização não fica em cache');
  });

  /* A ordem de quem declara (ticket a89a5fcb, 2026-11-09): 1 se tens de
     declarar, 2 onde, 3 como, 4 o que podes deduzir — as cinco secções do
     texto verificado, com os ids de antes, para as ligações de fora não
     partirem —, 5 as fontes. O índice segue a mesma ordem, e cada âncora tem
     o seu alvo uma vez só. */
  test('a ordem nova: tens de declarar, onde, como, as deduções (4.1 a 4.5), as fontes', () => {
    const s = seccoesDoGuia();
    assert.deepEqual(s.map((x) => x.num + ' ' + x.id), ['1 tens-de-declarar', '2 onde-declarar', '3 como-preencher',
      '4 deducoes', '4.1 regra', '4.2 pode-deduzir', '4.3 nao-pode-deduzir', '4.4 cuidado', '4.5 documentos', '5 fontes']);
    assert.deepEqual(s.slice(0, 3).map((x) => x.titulo), ['Tens de declarar?', 'Onde declaras', 'Como preenches']);
    assert.deepEqual(s.filter((x) => x.parte === 'deducoes').map((x) => x.titulo), ['A regra geral', 'O que podes deduzir',
      'O que não podes deduzir', 'O que pede cuidado', 'Os documentos a guardar'], 'os títulos do Martinho, tal e qual');
    // na página, pela mesma ordem, cada uma uma vez, com o número à vista
    const ids = [...html.matchAll(/<section class="(?:bloco|parte)" id="([a-z-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, s.map((x) => x.id), 'as secções na página, pela ordem');
    for (const x of s) {
      const nivel = x.parte ? 3 : 2;
      assert.match(html, new RegExp('<h' + nivel + ' id="t-' + x.id + '"><span class="num" aria-hidden="true">' +
        x.num.replace('.', '\\.') + '</span>'), x.id + ': o título h' + nivel + ' com o número ' + x.num);
    }
    // a parte 4 é uma secção que contém as cinco: até às fontes abrem-se seis e fecham-se seis
    const parte = html.slice(html.indexOf('<section class="parte" id="deducoes"'), html.indexOf('<section class="bloco" id="fontes"'));
    for (const x of s.filter((y) => y.parte)) assert.match(parte, new RegExp('<section class="bloco" id="' + x.id + '"'));
    assert.equal((parte.match(/<section\b/g) || []).length, 6);
    assert.equal((parte.match(/<\/section>/g) || []).length, 6);
    assert.match(parte, /<\/section>\n {2}<\/section>\s*$/, 'a parte fecha depois da última das cinco');
    // o índice: a mesma ordem, a nota de segurança no fim, e a parte 4 com as suas (4.1 a 4.5)
    const indice = /<nav class="indice" aria-label="Neste guia">([\s\S]*?)<\/nav>/.exec(html)[1];
    assert.deepEqual([...indice.matchAll(/<a href="#([a-z-]+)">/g)].map((m) => m[1]), [...s.map((x) => x.id), 'seguranca']);
    for (const x of s.filter((y) => y.parte)) {
      assert.match(indice, new RegExp('<a href="#' + x.id + '"><span class="num-ind" aria-hidden="true">' +
        x.num.replace('.', '\\.') + '</span>' + x.titulo + '</a>'));
    }
    for (const id of [...s.map((x) => x.id), 'seguranca']) {
      assert.equal(html.split(' id="' + id + '"').length - 1, 1, 'o alvo #' + id + ' uma vez só');
    }
    // o «onde-declarar» de antes continua a existir, agora a parte 2
    assert.ok(html.indexOf('id="onde-declarar"') < html.indexOf('id="como-preencher"'));
  });

  test('o texto verificado chega inteiro: cada lista com as suas linhas', () => {
    assert.equal(linhas(html, 'sim').length, 3 + 3 + 9 + 1 + 3, 'o que podes deduzir');
    assert.equal(linhas(html, 'nao').length, 17, 'o que não podes deduzir');
    assert.equal(linhas(html, 'doc').length, 14, 'os documentos a guardar');
    // a regra geral (5), a mudança de habitação (4), a água e a luz (3), os quatro pontos do Anexo F (4)
    assert.equal(linhas(html, 'cond').length, 5 + 4 + 3 + 4, 'as condições');
    // os quatro pontos do Anexo F (antes «Onde declarar») estão agora em «Como preenches»
    const como = /<section class="bloco" id="como-preencher"[\s\S]*?\n {2}<\/section>/.exec(html)[0];
    assert.equal(linhas(como, 'cond').length, 4);
    assert.match(como, /<p>No Anexo F da declaração Modelo 3, declara:<\/p>/);
    const t = texto(html);
    for (const frase of [
      'O seguro de renda, que o artigo 41.º, n.º 1, inclui expressamente',
      'calculada pela permilagem dela',
      'nos 24 meses antes de o arrendamento começar',
      'para mais de 100 km de distância',
      'O AIMI, o Adicional ao Imposto Municipal sobre Imóveis',
      'O seguro multirriscos facultativo da casa',
      'Na sublocação',
      'declaração Modelo 2 do Imposto do Selo',
      'e-balcão',
      'No Anexo F da declaração Modelo 3',
      'o mais seguro é não a deduzir até teres uma resposta escrita da AT',
      '8 de novembro de 2026',
      'sem teres escolhido as regras da categoria B',
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
    for (const tu of ['Guarda os três', 'não deduzas', 'Não as incluas', 'pede uma resposta escrita', 'ou uma informação vinculativa',
      'pede ao empreiteiro', 'Modelo 3, declara', 'em cada ano, guarda']) {
      assert.ok(t.includes(tu), 'por tu: ' + tu);
    }
    assert.doesNotMatch(t, /\(s\)|\bpôr\b|\btirar\b/, 'as regras de escrita da casa');
  });

  /* As partes 1 a 3 escreveram-se só de fontes oficiais abertas (2026-11-09):
     o que nelas se diz de prazos, taxas, contratos, entrega e preenchimento
     vem com o artigo entre parênteses e com a fonte principal no fim de cada
     uma, e cada ligação de dentro do guia é uma das fontes da lista. */
  test('as partes 1 a 3 dizem o essencial, cada uma com a fonte oficial', () => {
    const parte = (id) => new RegExp('<section class="bloco" id="' + id + '"[\\s\\S]*?\\n {2}</section>').exec(html)[0];
    const [p1, p2, p3] = ['tens-de-declarar', 'onde-declarar', 'como-preencher'].map(parte);
    const t1 = texto(p1), t2 = texto(p2), t3 = texto(p3);
    for (const frase of ['rendimentos prediais, da categoria F do IRS', 'a Modelo 3, com o Anexo F',
      'de 1 de abril a 30 de junho do ano seguinte ao das rendas', 'de 1 de abril a 30 de junho de 2027 (artigo 60.º, n.º 1)',
      '25 % nas rendas de arrendamento habitacional (artigo 72.º, n.º 2)', '28 % nas outras rendas prediais',
      '10 % nas rendas de 2026 a 2029', '2 300 € no continente', 'artigo 45.º-C do Estatuto dos Benefícios Fiscais',
      'menos 20 pontos percentuais',
      '(artigo 72.º, n.º 23)', '(artigo 72.º, n.º 20)', 'até 15 de fevereiro do ano seguinte', 'podes optar por englobar',
      '(artigo 22.º, n.º 5)']) assert.ok(t1.includes(frase), '1, falta: ' + frase);
    // o dinheiro e as percentagens como na casa: o espaço fino que não parte a linha (o texto() de cima troca-o)
    for (const v of ['25 %', '28 %', '10 %', '50 %', '2 300 €']) assert.ok(p1.includes(v), 'com o espaço fino: ' + v);
    assert.doesNotMatch(p1, /\d %|\d €/, 'nenhum espaço normal antes de % ou €');
    for (const frase of ['só se entregam por transmissão eletrónica de dados', 'o teu NIF e a senha de acesso',
      'Chave Móvel Digital', 'registas-te no Portal']) assert.ok(t2.includes(frase), '2, falta: ' + frase);
    assert.match(p2, /<p class="ir"><a class="btn" href="https:\/\/www\.portaldasfinancas\.gov\.pt\/" rel="noopener"><span>Ir ao Portal das Finanças<\/span><svg class="i seguir"/);
    for (const frase of ['Cada prédio vai numa linha própria', 'código da freguesia, de seis dígitos', 'pelo valor ilíquido',
      '07 no arrendamento habitacional, 06 no não habitacional', 'retenções na fonte', 'O NIF português do inquilino',
      'nos 24 meses antes do arrendamento', 'Quadro 4.1', 'Quadro 4.2', 'quadro 4.2A', 'Quadro 6G']) {
      assert.ok(t3.includes(frase), '3, falta: ' + frase);
    }
    // a fonte principal de cada parte, no fim, ligada ao sítio oficial
    for (const [p, fonte] of [[p1, 'irs72\\.aspx'], [p2, 'portaria-104-2026-1\\.pdf'], [p3, 'Mod_3_anexo_F\\.pdf']]) {
      assert.match(p, new RegExp('<p class="fonte"><a href="https://info\\.portaldasfinancas\\.gov\\.pt/[^"]*' + fonte +
        '" rel="noopener">Fonte principal: [^<]+</a></p>\\n {2}</section>$'));
    }
    // os factos soltos levam o ponto, sem o visto nem a cruz do que se deduz
    for (const l of linhas(p1 + p3, 'info')) assert.match(l, /^<li><span class="ponto" aria-hidden="true"><\/span><span>/);
    assert.equal(linhas(p1 + p2 + p3, 'sim').length + linhas(p1 + p2 + p3, 'nao').length, 0);
    // cada ligação de dentro do guia (fontes e o botão do Portal) é uma das fontes da lista
    const lista = /<ul class="fontes">([\s\S]*?)<\/ul>/.exec(html)[1];
    const daLista = new Set([...lista.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
    const corpo = html.slice(html.indexOf('<section class="bloco" id="tens-de-declarar"'), html.indexOf('<section class="bloco" id="fontes"'));
    for (const m of corpo.matchAll(/href="(https?:[^"]+)"/g)) assert.ok(daLista.has(m[1]), 'fora da lista de fontes: ' + m[1]);
  });

  test('as fontes apontam só para domínios oficiais', () => {
    const fontes = /<ul class="fontes">([\s\S]*?)<\/ul>/.exec(html)[1];
    const urls = [...fontes.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.equal((fontes.match(/<li>/g) || []).length, 12 + 9, 'as doze das partes 1 a 3 e as nove das deduções');
    assert.equal(urls.length, 21, 'todas com o endereço confirmado');
    assert.equal(new Set(urls).size, urls.length, 'nenhuma repetida');
    for (const u of urls) {
      assert.match(u, /^https:\/\/(?:info\.portaldasfinancas\.gov\.pt|www\.portaldasfinancas\.gov\.pt|diariodarepublica\.pt)\//, u);
    }
  });

  /* Quem pesquisa «IRS» chega aqui (decisão do Martinho, 2026-11-08): o
     título, a descrição e o h1 dizem-no, e o h1 é o título do cartão da
     montra — quem clica encontra o que lhe prometeram. Desde 2026-11-09 o
     título da página é o h1 (decisão do Martinho), sem o « — Rendorium», que
     o passava dos 60. */
  test('título e descrição cabem no que os motores mostram, dizem IRS, e as redes dizem o mesmo', () => {
    const titulo = /<title>([^<]+)<\/title>/.exec(html)[1];
    const desc = /<meta name="description" content="([^"]+)">/.exec(html)[1];
    const h1 = /<h1>([^<]+)<\/h1>/.exec(html)[1];
    assert.ok(titulo.length <= 60, 'título com ' + titulo.length);
    assert.ok(desc.length >= 110 && desc.length <= 160, 'descrição com ' + desc.length);
    for (const [nome, t] of [['o título', titulo], ['a descrição', desc], ['o h1', h1]]) assert.match(t, /\bIRS\b/, nome);
    assert.equal(h1, 'IRS das rendas: como declarar e o que podes deduzir');
    assert.equal(H1, h1);
    assert.equal(titulo, h1, 'o título da página é o h1');
    assert.ok(html.includes('<meta property="og:description" content="' + desc + '">'), 'as redes dizem o mesmo');
    assert.ok(html.includes('<meta property="og:title" content="' + h1 + '">'), 'e o título das redes é o h1');
    assert.doesNotMatch(html, /og:image/, 'a imagem da montra ainda fala da Declaração: não se usa aqui');
    assert.doesNotMatch(html + previa, /na hora de/i, 'nada do português do Brasil');
  });

  /* O caminho no topo (Início › o guia) e o «Voltar ao início» no fim da
     leitura levam à montra: «/» na raiz, «/montra» fora dela, onde a raiz é
     a app. A página atual marca-se com aria-current e na tinta da frente (o
     escuro forçado do Samsung Internet mexe nos fundos). */
  test('o caminho no topo e o «Voltar ao início» levam à montra de cada sítio', () => {
    for (const [h, inicio] of [[html, '/'], [previa, '/montra']]) {
      const caminho = /<nav class="caminho" aria-label="Caminho">([\s\S]*?)<\/nav>/.exec(h);
      assert.ok(caminho, 'o caminho existe');
      assert.ok(h.indexOf('class="caminho"') < h.indexOf('<h1>'), 'no topo, antes do título');
      const itens = caminho[1].match(/<li>[\s\S]*?<\/li>/g);
      assert.equal(itens.length, 2, 'Início › o guia');
      assert.match(itens[0], new RegExp('<a href="' + inicio + '">Início</a>'), 'o início de ' + inicio);
      assert.match(itens[1], /<span class="separador" aria-hidden="true">›<\/span><span class="atual" aria-current="page">Guia do IRS das rendas<\/span>/);
      assert.match(h, new RegExp('<p class="voltar"><a class="btn" href="' + inicio + '"><svg [^>]*aria-hidden="true"[^>]*>[\\s\\S]*?</svg><span>Voltar ao início</span></a></p>'));
      assert.ok(h.indexOf('class="voltar"') > h.indexOf('id="seguranca"'), 'no fim da leitura');
    }
    assert.match(CSS_GUIA, /\.caminho \.atual\{color:var\(--ink\);font-weight:600\}/, 'a página atual pela tinta e pelo peso');
    assert.match(CSS_GUIA, /\.caminho a\{[^}]*min-height:44px/, 'o Início com alvo de dedo: 44 de altura');
    assert.match(CSS_GUIA, /\.caminho a::after\{content:'';position:absolute;top:0;bottom:0;left:-8px;right:-8px\}/,
      'e alargado para os lados, porque a palavra é curta');
  });

  /* O cabeçalho é o da montra: no computador o «IRS», o «Entrar» e o «Criar
     conta» em linha; no telemóvel a marca inteira, o «Criar conta» e o ☰,
     que abre (sem JavaScript, um <details>) o «IRS» e o «Entrar». Aqui o
     «IRS» é a página atual, dito com aria-current e na tinta da frente. */
  test('o cabeçalho: em linha no computador, a gaveta no telemóvel, e o «IRS» como página atual', () => {
    for (const h of [html, previa]) {
      const cab = /<header>[\s\S]*?<\/header>/.exec(h)[0];
      const gaveta = /<details class="gaveta">([\s\S]*?)<\/details>/.exec(cab);
      assert.ok(gaveta, 'a gaveta é um <details> dentro do cabeçalho');
      const emLinha = [...cab.replace(gaveta[0], '').matchAll(/<a class="([^"]*)" href="([^"]*)"[^>]*>([^<]*)<\/a>/g)]
        .map((m) => [m[3], m[2], /\bem-linha\b/.test(m[1])]);
      assert.deepEqual(emLinha, [['IRS', CAMINHO_GUIA, true], ['Entrar', 'https://app.rendorium.com', true],
        ['Criar conta', 'https://app.rendorium.com/?criar=1', false]]);
      assert.match(cab, new RegExp('<a class="btn fantasma em-linha guias" href="' + CAMINHO_GUIA + '" aria-label="Guia do IRS das rendas" aria-current="page">IRS</a>'));
      assert.match(gaveta[1], /<summary class="gaveta-botao" aria-label="Menu">/, 'o ☰ chama-se «Menu»');
      const ligacoes = [...gaveta[1].matchAll(/<a href="([^"]+)"[^>]*><span>([^<]+)<\/span><svg class="i seguir"/g)].map((m) => [m[2], m[1]]);
      assert.deepEqual(ligacoes, [['IRS', CAMINHO_GUIA], ['Entrar', 'https://app.rendorium.com']]);
      assert.match(gaveta[1], new RegExp('<a href="' + CAMINHO_GUIA + '" aria-current="page">'), 'a página atual também na gaveta');
      assert.doesNotMatch(gaveta[1], /Criar conta/, 'o «Criar conta» fica sempre à vista');
    }
    assert.match(CSS_GUIA, /@media\(max-width:439px\)\{a\.btn\.em-linha\{display:none\}\}/);
    assert.match(CSS_GUIA, /@media\(min-width:440px\)\{\.gaveta\{display:none\}\}/);
    assert.doesNotMatch(CSS_GUIA, /a\.btn\.entrar\{display:none\}|\.marca span:last-child\{position:absolute/, 'a marca fica inteira');
    assert.match(CSS_GUIA, /a\.btn\[aria-current="page"\]\{color:var\(--accent-text\);text-decoration:underline/, 'a página atual pela frente');
    assert.match(CSS_GUIA, /\.gaveta-painel a\[aria-current="page"\]\{color:var\(--accent-text\)\}/);
    assert.match(CSS_GUIA, /\.gaveta\[open\] \.gaveta-botao\{border-color:var\(--accent\);color:var\(--accent-text\)\}/);
    assert.match(CSS_GUIA, /\.gaveta-botao::-webkit-details-marker\{display:none\}/);
    assert.match(CSS_GUIA, /@keyframes gaveta-desce\{from\{clip-path:inset\(0 0 100% 0\);opacity:0\}\}/);
    assert.match(CSS_GUIA, /@media\(prefers-reduced-motion:reduce\)\{[^\n]*\.gaveta-painel\{animation:none\}/, 'quieta com menos movimento');
  });

  /* Os dados estruturados, só na raiz: o caminho (BreadcrumbList) e o artigo
     (Article), com a data fixa da revisão, para os motores mostrarem o guia
     como o que é. */
  test('os dados estruturados dizem o caminho e o artigo, só na raiz', () => {
    const bloco = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
    assert.doesNotMatch(bloco, /</, 'nenhum «<» cru dentro do bloco');
    const dados = JSON.parse(bloco);
    assert.equal(dados['@context'], 'https://schema.org');
    const de = (tipo) => dados['@graph'].find((d) => d['@type'] === tipo);
    const url = 'https://rendorium.com' + CAMINHO_GUIA;
    assert.deepEqual(de('BreadcrumbList').itemListElement.map((i) => [i.position, i.name, i.item]),
      [[1, 'Início', 'https://rendorium.com/'], [2, 'Guia do IRS das rendas', url]]);
    const a = de('Article');
    assert.equal(a.headline, /<h1>([^<]+)<\/h1>/.exec(html)[1], 'o título do artigo é o h1');
    assert.equal(a.description, /<meta name="description" content="([^"]+)">/.exec(html)[1]);
    assert.equal(a.inLanguage, 'pt-PT');
    assert.equal(a.url, url);
    assert.equal(a.mainEntityOfPage, url);
    assert.equal(a.dateModified, '2026-11-08', 'a data fixa da revisão');
    assert.deepEqual([a.publisher['@type'], a.publisher.name], ['Organization', 'Rendorium']);
    assert.match(a.publisher.logo.url, /^https:\/\/rendorium\.com\/icon-512\.png$/);
    assert.doesNotMatch(previa, /ld\+json/, 'a pré-visualização não se apresenta como a original');
  });

  /* A pílula do QA (equipa-qa.js:pilulaDasPaginas) entra no dev pelo
     index.js, já pronta: o guia só lhe guarda o sítio, antes do </body>. */
  test('o espaço da pílula do QA: o op.qa entra tal e qual antes do </body>', async () => {
    const qa = '<link rel="stylesheet" href="/paginas/qa.css"><script src="/paginas/qa.js"></script>';
    assert.ok((await paginaGuia({ raiz: false, qa }).text()).endsWith('</footer>\n' + qa + '</body></html>'));
    assert.ok(previa.endsWith('</footer>\n</body></html>'), 'sem op.qa, nada');
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
    assert.doesNotMatch(fecho, /IRS|Declara|Anexo|calcula/i, 'o fecho fala da app de produção');
    assert.match(fecho, /\?criar=1/);
  });
});
