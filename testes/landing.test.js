// A página de entrada do rendorium.com.
//
// O produto mostra-se em maquetes desenhadas em HTML e CSS, não em capturas:
// o que aqui se guarda é que elas digam a verdade sobre si próprias (os
// números fecham, cada barra tem a sua altura, a descrição existe), que as
// letras venham da casa, que a imagem de partilha continue onde as redes a
// vão buscar, e o resto do contrato da página — sem JavaScript, metadados,
// botões, cabeçalho, movimento e os seus recuos.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { paginaLanding, CSS_LANDING } from '../worker/src/landing.js';
import { CSS_LEGAL } from '../worker/src/legal-vista.js';
import { CSS_TESTE } from '../worker/src/teste.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const raiz = (p) => path.join(AQUI, '..', p);

/* Em produção. Fora do domínio raiz a mesma função devolve uma
   pré-visualização, com noindex e sem og — testado mais abaixo. */
const resposta = paginaLanding({ raiz: true });
const html = await resposta.text();
/* Os estilos vivem à parte, em /paginas/landing.css: a página vai com a
   CSP_ESTRITA, que não aplica um <style> escrito dentro do HTML. */
const css = CSS_LANDING;

describe('a página de entrada', () => {
  test('sai como HTML, em cache, e sem restos de template', () => {
    assert.equal(resposta.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.match(resposta.headers.get('Cache-Control'), /max-age=3600/);
    assert.ok(!html.includes('${'), 'nenhum ${} por interpolar');
    assert.ok(!html.includes('undefined'), 'nada ficou undefined');
  });

  /* O redesign trocou as capturas por maquetes em HTML e CSS (a prancheta
     Landing): seguem os tokens e o tema de quem lê, e não envelhecem a cada
     mudança da app. Quem não as vê ouve a descrição — cada uma é um role="img"
     com aria-label, e o que está dentro dela não se lê aos bocados. */
  test('mostra o produto em maquetes com descrição, e já não em capturas', () => {
    assert.ok(!/<picture|<img\b/.test(html), 'nenhuma captura na página');
    const maquetes = [...html.matchAll(/<div class="([^"]+)" role="img" aria-label="([^"]+)">/g)]
      .map((m) => ({ classe: m[1], descricao: m[2] }));
    assert.deepEqual(maquetes.map((m) => m.classe), ['telemovel', 'telemovel imoveis', 'telemovel contratos',
      'telemovel planeados', 'computador', 'acerto n'],
      'o hero, os três ecrãs, o computador e as contas entre donos');
    maquetes.forEach((m) => assert.ok(m.descricao.length >= 60, 'uma descrição a sério: ' + m.descricao));
    assert.match(html, /<div class="hero-visual">\s*<div class="tile" aria-hidden="true">/,
      'o mosaico do hero é decoração, escondido dos leitores de ecrã');
  });

  /* Os números da maquete são inventados, mas não podem ser absurdos: quem
     gere rendas faz a conta de cabeça. A prancheta trazia um cashflow que não
     fechava (7 534 € para 29 910 − 6 312 − 11 064); aqui o cashflow é o que
     sobra, e é o mesmo no telemóvel e no computador. */
  test('os números das maquetes fecham entre si', () => {
    const valor = (rotulo) => [...html.matchAll(new RegExp('<p(?: class="m-sub")?>' + rotulo +
      '</p><p class="tit">([−\\d\\u202F]+)\\u202F€</p>', 'g'))]
      .map((m) => Number(m[1].replace(/ /g, '').replace('−', '-')));
    const [r, d, p, c] = ['Receita', 'Despesas', 'Prestações', 'Cashflow'].map(valor);
    [r, d, p, c].forEach((v) => assert.equal(v.length, 2, 'cada indicador nas duas maquetes'));
    assert.equal(c[0], r[0] - d[0] - p[0], 'o cashflow é a receita menos as despesas e as prestações');
    assert.deepEqual([r[0], d[0], p[0], c[0]], [r[1], d[1], p[1], c[1]], 'e o computador diz o mesmo que o telemóvel');
  });

  /* A CSP_ESTRITA não aplica um atributo de estilo: cada barra recebe a
     altura por uma regra :nth-child da folha. Uma barra a mais no HTML ficava
     com altura zero, sem erro nenhum. */
  test('cada barra das maquetes tem a sua altura na folha', () => {
    const nTel = (/<div class="m-cartao barras-tel">([\s\S]*?)<\/div>/.exec(html)[1].match(/<span><\/span>/g) || []).length;
    const nPc = (html.match(/<span class="mes">/g) || []).length;
    assert.ok(nTel >= 6, 'o gráfico do telemóvel tem barras');
    assert.equal(nPc, nTel, 'os dois gráficos mostram os mesmos meses');
    for (let i = 1; i <= nTel; i++) {
      assert.match(css, new RegExp('\\.barras-tel span:nth-child\\(' + i + '\\)\\{height:\\d+px\\}'), 'a barra ' + i + ' do telemóvel');
      assert.match(css, new RegExp('\\.barras-pc \\.mes:nth-child\\(' + i + '\\) \\.r\\{height:\\d+px\\}'), 'a receita ' + i + ' do computador');
      assert.match(css, new RegExp('\\.barras-pc \\.mes:nth-child\\(' + i + '\\) \\.d\\{height:\\d+px\\}'), 'a despesa ' + i + ' do computador');
    }
    assert.ok(!new RegExp('\\.barras-tel span:nth-child\\(' + (nTel + 1) + '\\)').test(css), 'e nenhuma regra para uma barra que não existe');
  });

  /* A imagem de partilha é a única que fica: quem a mostra é a rede social,
     que não corre CSS nenhum. As capturas antigas saíram com as maquetes, e o
     que fica na pasta é o que alguém pede. */
  test('a imagem de partilha existe, e a pasta não guarda capturas que ninguém pede', () => {
    const f = raiz('web/img/landing/partilha.webp');
    assert.ok(fs.existsSync(f), 'falta a imagem de partilha');
    assert.ok(fs.statSync(f).size > 4096, 'e é uma imagem a sério');
    for (const nome of fs.readdirSync(raiz('web/img/landing'))) {
      assert.ok(html.includes('/img/landing/' + nome), nome + ' está na pasta mas a página não o pede');
    }
  });

  /* As letras são as da app, auto-alojadas: a CSP só deixa font-src 'self',
     e um pedido ao Google Fonts era recusado em silêncio — a página caía na
     letra do sistema sem ninguém dar por isso. */
  test('as letras são da casa, declaradas e pedidas cedo', () => {
    for (const [familia, ficheiro] of [['Geist', 'geist'], ['Bricolage Grotesque', 'bricolage-grotesque']]) {
      const bloco = new RegExp("@font-face\\{font-family:'" + familia + "';src:url\\(/fonts/" + ficheiro +
        "\\.woff2\\) format\\('woff2'\\);[^}]*font-display:swap;[^}]*unicode-range:U\\+0000-00FF").exec(css);
      assert.ok(bloco, familia + ' declarada com swap e o unicode-range latino');
      assert.ok(fs.existsSync(raiz('web/fonts/' + ficheiro + '.woff2')), 'o ficheiro de ' + familia + ' existe');
      assert.match(html, new RegExp('<link rel="preload" href="/fonts/' + ficheiro +
        '\\.woff2" as="font" type="font/woff2" crossorigin>'), familia + ' pedida logo no <head>');
    }
    assert.match(css, /body\{[^}]*font-family:'Geist',/, 'o corpo na Geist');
    assert.match(css, /h1,h2,h3,\.tit\{font-family:'Bricolage Grotesque',/, 'os títulos na Bricolage');
    assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html + css), 'nada do Google Fonts');
  });

  /* Três folhas, as mesmas letras: a montra, os documentos legais e a
     entrada de teste declaram-nas cada uma na sua (a CSP_ESTRITA quer a folha
     de cada página à parte), e uma que divergisse era uma página com outra
     letra ou com um ficheiro que já não existe. */
  test('a montra, os documentos e a entrada de teste declaram as mesmas letras', () => {
    const letras = (t) => (t.match(/@font-face\{[^}]*\}/g) || []).join('\n');
    assert.equal((letras(css).match(/@font-face/g) || []).length, 2, 'as duas na montra');
    assert.equal(letras(CSS_LEGAL), letras(css), 'os documentos iguais à montra');
    assert.equal(letras(CSS_TESTE), letras(css), 'e a entrada de teste também');
  });

  /* Segue o tema de quem lê, com os tokens do contrato da app: os mesmos
     nomes, o fundo e o cobalto de cada lado. */
  test('segue o tema de quem lê, com os tokens da app', () => {
    assert.match(css, /:root\{color-scheme:light dark;[^}]*--bg:#F2F3F6;[^}]*--accent:#2952D9;/, 'o claro');
    const escuro = /@media\(prefers-color-scheme:dark\)\{:root\{([^}]*)\}\}/.exec(css);
    assert.ok(escuro, 'o escuro existe');
    assert.match(escuro[1], /--bg:#0B111E;/, 'com o fundo escuro do contrato');
    assert.match(escuro[1], /--accent:#7C9BFF;/, 'e o cobalto escuro');
    assert.match(html, /<meta name="theme-color" content="#F2F3F6" media="\(prefers-color-scheme: light\)">/);
    assert.match(html, /<meta name="theme-color" content="#0B111E" media="\(prefers-color-scheme: dark\)">/);
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
    assert.match(css, /\.faixa-topo\{position:sticky;top:0/, 'cola ao topo');
    assert.match(css, /backdrop-filter:blur\(12px\)/, 'com o mesmo vidro da app');
    assert.match(css, /--blur:/, 'e o token que o pinta');
    assert.match(html, /<link rel="stylesheet" href="\/paginas\/landing\.css">/, 'a folha que o traz');
    assert.match(html, /<div class="faixa-topo">/, 'e a faixa envolve mesmo a marca');
  });

  /* As animações são CSS puro — o teste do «sem JavaScript» lá em cima é o
     que guarda isso — e NUNCA podem esconder conteúdo: a entrada do hero
     parte de @keyframes (o estado base é o visível), e as revelações ao
     scroll vivem atrás de @supports, para um motor sem animation-timeline
     mostrar a página feita. */
  test('a página anima sem esconder nada a ninguém', () => {
    assert.match(css, /@keyframes sobe\{from\{opacity:0;transform:translateY\(16px\)\}\}/,
      'uma entrada só, em transform/opacity');
    assert.match(css, /\.hero h1\{animation:sobe var\(--entrada\) var\(--curva-entra\) backwards\}/,
      'o hero entra pela curva de quem atravessa distância');
    assert.match(css, /\.hero \.telemovel\{animation:sobe [^}]*backwards\}/,
      'a maquete do telemóvel entra com ele');
    assert.match(css, /\.hero \.sub\{animation:sobe [^}]*\.07s backwards\}/,
      'e a chegada é escalonada, não em bloco');
    assert.match(css, /@supports \(animation-timeline: view\(\)\)/,
      'as revelações ao scroll estão atrás de @supports');
    assert.match(css, /animation-range:entry 8% entry 42%/, 'e presas à entrada no ecrã');
    /* os degraus da grelha seguem as colunas que existem: o padrão de três
       aplicado a duas colunas punha o cartão da direita a entrar antes do
       da esquerda — ordem de leitura invertida na largura de um tablet */
    assert.match(css, /@media\(min-width:620px\) and \(max-width:939px\)\{\s*\.grelha \.cartao:nth-child\(2n\)/,
      'a duas colunas, o degrau é de dois');
    assert.match(css, /@media\(min-width:940px\)\{\s*\.grelha \.cartao:nth-child\(3n\+2\)/,
      'a três colunas, de três');
    assert.match(css, /@supports \(animation-timeline: scroll\(\)\)/,
      'a risca do cabeçalho também');
    assert.ok(!/transition:[^}]*box-shadow/.test(css),
      'a sombra do hover anima por opacity num ::after, não por box-shadow (repaint)');
    const semKeyframes = css.replace(/@keyframes [\s\S]*?\}\}/g, '');
    /* a sombra do hover nasce invisível num ::after — é decoração, não
       conteúdo; o que este guarda protege é conteúdo que uma animação por
       correr deixaria escondido */
    const semDecoracao = semKeyframes.replace(/[^{}]*::after\{[^}]*\}/g, '');
    assert.ok(!/opacity:0[;}]/.test(semDecoracao),
      'nenhum estado base fica invisível fora de @keyframes');
  });

  /* Menos movimento é menos, não zero: as entradas ficam mas em opacidade
     pura (o @keyframes redefinido dentro da media query tira o translateY a
     todas), os transforms do hover e do premido saem, e as transições de cor
     ficam — cor não é movimento. A risca do cabeçalho continua a acender-se
     pelo scroll: também é só cor, e por isso o override antigo do
     border-bottom-color deixou de ser preciso. */
  test('quem pediu menos movimento recebe fundidos, não deslocações', () => {
    const bloco = /@media\(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/.exec(css);
    assert.ok(bloco, 'o recuo de menos movimento existe');
    assert.match(bloco[1], /@keyframes sobe\{from\{opacity:0\}\}/,
      'as entradas passam a fundido de opacidade');
    assert.ok(!bloco[1].includes('translateY'), 'nada se desloca');
    assert.match(bloco[1], /a\.btn:hover,a\.btn:active\{transform:none\}/,
      'o hover não levanta e o premido não encolhe');
    assert.ok(!bloco[1].includes('animation:none'),
      'menos movimento é menos, não zero — os fundidos e a risca do scroll ficam');
  });

  test('o vidro tem recuo, e o hover que mexe só existe com rato', () => {
    assert.match(css, /-webkit-backdrop-filter:blur\(12px\) saturate\(140%\)/,
      'o prefixo que o iOS antigo lê');
    assert.match(css, /@media\(prefers-reduced-transparency:reduce\)/, 'o recuo do vidro');
    assert.match(css, /@media\(prefers-contrast:more\)/, 'e o do contraste');
    assert.match(css, /@media\(hover:hover\) and \(pointer:fine\)/, 'o portão do rato');
    /* fora do portão, um hover só pode mudar cor: num ecrã de dedo, o toque
       deixava um botão «levantado» até alguém tocar noutro sítio */
    const semPortao = css.replace(/@media\(hover:hover\) and \(pointer:fine\)\{[\s\S]*?\n\}/g, '');
    assert.ok(!/:hover\{[^}]*(?:transform|box-shadow)/.test(semPortao),
      'nenhum hover fora do portão levanta nem sombreia');
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

  /* Quem abre a página percebe em segundos o que ela faz: o chapéu diz o que
     é, o título diz a vantagem, e cada ecrã que a entrega (Imóveis,
     Contratos, Planeados) tem a sua secção, com o título e o telemóvel. */
  test('o valor primeiro, e cada ecrã na sua secção', () => {
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, 'um título só');
    assert.match(html, /<p class="chapeu">Gestão de arrendamento para senhorios<\/p>\s*<h1>Nenhuma renda te passa despercebida\.<\/h1>/);
    assert.match(html, /<h2>Do imóvel à renda, tudo ligado<\/h2>/);
    for (const id of ['imoveis', 'contratos', 'planeados']) {
      const s = new RegExp('<section class="wrap ecra-seccao[^"]*" id="' + id + '" aria-labelledby="t-' + id +
        '">[\\s\\S]*?<h3 id="t-' + id + '">[\\s\\S]*?<div class="telemovel ' + id + '" role="img"[\\s\\S]*?</section>').exec(html);
      assert.ok(s, 'a secção ' + id + ', com o título e a maquete');
    }
    assert.ok(!/O que faz/.test(html), 'a grelha já não abre a página');
  });

  /* A Declaração (o IRS) ainda só existe em dev: a montra de produção não
     pode prometer o que a app de produção não tem. Vale o texto e os
     metadados. */
  test('não promete o IRS, que ainda só existe em dev', () => {
    assert.ok(!/IRS|Anexo F|Modelo 2|\bAT\b|Finanças/.test(html), 'nem no texto nem nos metadados');
  });

  /* O que o Google mostra sem cortar: o título nos 60 caracteres e a
     descrição nos 160, com os termos que um senhorio procura. */
  test('o título e a descrição cabem no que os motores mostram', () => {
    const titulo = /<title>([^<]+)<\/title>/.exec(html)[1];
    const desc = /<meta name="description" content="([^"]+)">/.exec(html)[1];
    assert.ok(titulo.length <= 60, 'título com ' + titulo.length);
    assert.ok(desc.length >= 110 && desc.length <= 160, 'descrição com ' + desc.length);
    assert.match(titulo, /gestão de arrendamento/);
    assert.match(desc, /rendas em atraso/);
    assert.match(html, new RegExp('<meta property="og:description" content="' + desc + '">'), 'e as redes dizem o mesmo');
  });

  /* Os três ecrãs contam a história do hero: as rendas em vigor nos Imóveis
     somam o último mês do gráfico, e o que o hero diz estar por confirmar é
     o que os Planeados mostram. */
  test('os ecrãs e o hero contam a mesma história', () => {
    const sec = (id) => new RegExp('id="' + id + '"[\\s\\S]*?</section>').exec(html)[0];
    const euros = (t) => Number(t.replace(/\s/g, '').replace(',', '.').replace('−', '-'));
    const rendas = [...sec('imoveis').matchAll(/<span class="m-sub">Renda<\/span>([^<]+?)\s?€?<\/span>/g)]
      .map((m) => m[1]).filter((t) => t !== '—').map(euros);
    assert.equal(rendas.length, 3, 'três imóveis arrendados');
    // 2 425 € é o último mês de landing.js:RECEITA_MES
    assert.equal(rendas.reduce((a, b) => a + b, 0), 2425, 'que somam o último mês do gráfico');
    const [, porConfirmar, emAtraso] = /<strong>(\d+) por confirmar<\/strong><br><span class="m-sub">(\d+) em atraso/.exec(html);
    const plan = sec('planeados');
    assert.equal((plan.match(/botao-maquete pequeno">Confirmar/g) || []).length, Number(porConfirmar), 'os por confirmar do hero');
    assert.equal((plan.match(/m-selo red">Em atraso/g) || []).length, Number(emAtraso), 'e os em atraso');
  });

  test('diz que é grátis e sem planos', () => {
    assert.match(html, /sem planos/i);
    // o «€/mês» das rendas dentro das maquetes é a app a falar, não um preço
    const texto = html.replace(/role="img"[\s\S]*?<\/section>/g, '');
    assert.ok(!/plano (plus|pro)|subscri|mensalidade|€\s*\/\s*m[êe]s/i.test(texto),
      'nada que sugira escalões ou pagamentos');
  });
});
