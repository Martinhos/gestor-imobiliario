// A folha de estilo da app, nas partes onde um engano só se vê no telemóvel
// de outra pessoa. São verificações de texto, não de desenho: não substituem
// olhar para o ecrã, mas apanham sozinhas o que já partiu antes.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const componentes = readFileSync(new URL('../web/app/componentes.js', import.meta.url), 'utf8');

// o que está entre chavetas, regra a regra
function blocos(css) {
  return css.split('}').map((b) => b.slice(b.indexOf('{') + 1)).filter(Boolean);
}

const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join('\n');

describe('alturas em unidades de ecrã', () => {
  /* vh é a altura com as barras do browser recolhidas. Com a barra de
     endereço em cima e a de comandos em baixo à mostra — o Samsung Internet,
     o Chrome no Android — o que se vê é bem menos do que isso.

     Numa caixa encostada em baixo, uma altura em vh cresce para além do que
     se vê e o topo fica cortado, sem maneira de lá chegar. Foi o que
     aconteceu ao modal das novidades: a regra do telemóvel vinha depois da
     geral e repunha vh onde a geral já tinha dvh.

     Daí a regra: quem escreve uma altura em vh escreve logo a seguir a mesma
     em dvh. Quem não perceber vh nenhum fica com o que havia. */
  test('nenhuma altura em vh fica sem o par em dvh', () => {
    const falhas = [];
    blocos(css).forEach((b) => {
      const props = {};
      (b.match(/(?:^|;)\s*((?:max-|min-)?height)\s*:\s*([^;]*)/g) || []).forEach((d) => {
        const m = /((?:max-|min-)?height)\s*:\s*([^;]*)/.exec(d);
        if (!m) return;
        (props[m[1]] = props[m[1]] || []).push(m[2]);
      });
      Object.keys(props).forEach((p) => {
        const usaVh = props[p].some((v) => /\d(?:\.\d+)?vh\b/.test(v));
        const usaDin = props[p].some((v) => /\d(?:\.\d+)?[ds]vh\b/.test(v));
        if (usaVh && !usaDin) falhas.push(p + ': ' + props[p].join(' | '));
      });
    });
    assert.deepEqual(falhas, [], 'alturas em vh sem par em dvh');
  });

  test('a folha de baixo do modal cabe no que se vê', () => {
    // a regra do telemóvel é a que se aplica no telemóvel: é a que interessa
    const m = /@media\(max-width:520px\)\{\.sheet\{([^}]*)\}/.exec(css);
    assert.ok(m, 'a regra da folha de baixo existe');
    assert.match(m[1], /bottom:0/, 'está encostada em baixo');
    assert.match(m[1], /max-height:\d+dvh/, 'e a altura acompanha o que se vê');
  });

  test('a camada do modal também', () => {
    const m = /\.modal\{([^}]*)\}/.exec(css);
    assert.ok(m, 'a camada existe');
    assert.match(m[1], /height:100dvh/);
  });
});

/* Os comentários da folha falam de seletores e de durações — e falam deles
   para explicar o que MUDOU. Uma verificação de texto que os leia acusa
   sempre o que o comentário descreve, nunca o que a regra faz. */
const cssLimpo = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('movimento', () => {
  /* A folha tinha oito declarações de movimento, cada uma com a sua duração
     escrita à mão e nenhuma com curva. Os tokens são o que impede a nona de
     ser inventada de novo: quem escreve uma animação cita-os. */
  test('os tokens de movimento existem e são citados', () => {
    ['--rapido', '--medio', '--lento', '--curva', '--curva-sai'].forEach((t) => {
      assert.match(cssLimpo, new RegExp(t + '\\s*:\\s*[^;]'), t + ' declarado no :root');
      assert.ok(cssLimpo.includes('var(' + t + ')'), t + ' declarado mas nunca citado');
    });
  });

  test('as declarações antigas passaram a citar os tokens', () => {
    // nenhuma das oito ficou com a duração à mão
    [/aside\{[^}]*transition:[^;}]*\.1?\ds\b/, /\.card\.tap\{[^}]*transition:[^;}]*\.\ds\b/,
      /\.toast\{[^}]*transition:\.\d+s/, /\.prow\{transition:transform \.\d+s\}/,
      /\.fold-head \.chev\{[^}]*transition:transform \.\d+s\}/, /\.opt\{[^}]*transition:\.\d+s\}/]
      .forEach((r) => assert.doesNotMatch(cssLimpo, r, 'duração escrita à mão: ' + r));
  });

  /* O .fab tinha o scale(.96) no :active e nenhuma transition para o executar:
     descia e subia em zero frames, na peça mais tocada da app. */
  test('o FAB tem transição para o scale que já declarava', () => {
    assert.match(cssLimpo, /\.fab\{transition:transform var\(--rapido\)/);
    assert.match(cssLimpo, /\.fab:active\{transform:scale\(\.96\)\}/);
  });

  test('o estado premido cobre tudo o que se toca', () => {
    ['.btn:active', '.iconbtn:active', '.selbtn:active', '.selopt:active',
      '.menupop button:active', '.tabbar a:active', '.opt:active', '.addbox:active',
      '.fold-head:active', '.tagadd:active', '.railbtn:active', 'nav a:active',
      '.btn.primary:active', '.legend .li.tap:active', '.calday.tap:active']
      .forEach((s) => assert.ok(cssLimpo.includes(s), s + ' sem estado premido'));
  });

  /* Quem já usa o transform para se posicionar tem de o repetir no :active,
     senão salta do sítio ao ser premido. */
  test('o premido não deita fora o transform de quem já o usa', () => {
    assert.match(cssLimpo, /\.totop:active\{transform:translateX\(-50%\) scale/);
    assert.match(cssLimpo, /\.qclear:active\{transform:translateY\(-50%\) scale/);
  });

  test('o foco vê-se, e só por :focus-visible', () => {
    ['.btn:focus-visible', '.tabbar a:focus-visible', 'nav a:focus-visible',
      '.card.tap:focus-visible', '.selbtn:focus-visible', '.opt:focus-visible',
      '.fold-head:focus-visible'].forEach((s) => assert.ok(cssLimpo.includes(s), s + ' sem anel'));
    /* :focus sem -visible deixa anéis a quem passa de rato; fora dos campos,
       onde o anel é o próprio desenho do campo, não há licença para ele */
    const soltos = (cssLimpo.match(/[^\s,{};][^,{};\r\n]*:focus(?!-visible)/g) || [])
      .map((s) => s.trim())
      .filter((s) => !/^(input|textarea|\.rich-content|\.thumb input\.nm)/.test(s));
    assert.deepEqual(soltos, [], ':focus sem -visible fora dos campos');
  });

  /* O modal é criado e recebe .open no mesmo instante: uma transition não tem
     valor antigo de onde partir num nó acabado de inserir. Daí @keyframes. */
  test('há @keyframes para a folha, o véu, os menus, o crachá e os gráficos', () => {
    ['veuEntra', 'folhaEntra', 'folhaSobe', 'popEntra', 'explEntra', 'selo',
      'gbar', 'ghbar', 'gdonut']
      .forEach((n) => assert.match(cssLimpo, new RegExp('@keyframes\\s+' + n + '\\{'), '@keyframes ' + n));
    assert.match(cssLimpo, /\.modal\.open \.bg\{animation:veuEntra/);
    assert.match(cssLimpo, /\.modal\.open \.sheet\{animation:folhaEntra/);
    assert.match(cssLimpo, /@media\(max-width:520px\)\{\.modal\.open \.sheet\{animation:folhaSobe/);
  });

  test('o crachá recriado entra com um pulso', () => {
    assert.ok(cssLimpo.includes('#hdrBell .cnt'), 'o crachá do sino está na regra');
    assert.match(cssLimpo, /\{animation:selo \.18s var\(--curva\) both\}/);
  });

  test('as barras e o donut trazem a origem certa', () => {
    assert.match(cssLimpo, /\.gbar\{[^}]*transform-box:fill-box[^}]*transform-origin:bottom/);
    assert.match(cssLimpo, /\.ghbar\{[^}]*transform-origin:left/);
    assert.match(cssLimpo, /\.gdonut\{[^}]*stroke-dasharray:1/);
  });

  /* A gaveta deslizava .22s e o véu era display:none→block: o escurecido
     chegava inteiro no primeiro frame, com a gaveta a meio caminho. */
  test('o véu da gaveta desvanece em vez de aparecer', () => {
    const m = /\.scrim\{([^}]*)\}/.exec(cssLimpo);
    assert.ok(m, 'a regra do véu existe');
    assert.doesNotMatch(m[1], /display:none/, 'o display saiu da frente');
    assert.match(m[1], /opacity:0/);
    assert.match(m[1], /visibility:hidden/, 'senão apanhava toques com a gaveta fechada');
    assert.match(m[1], /var\(--medio\)/, 'à mesma duração do aside');
    assert.match(cssLimpo, /body\.open \.scrim\{opacity:1;visibility:visible/);
  });

  /* O corpo que a seta anuncia aparecia de golpe. A altura continua a saltar
     (medimos que o grid-template-rows não interpola aqui), mas o conteúdo
     entra sempre — e, fechado, continua fora do Tab por causa do display. */
  test('o conteúdo da dobra entra, e fechado fica fora do Tab', () => {
    const m = /\.fold-body\{([^}]*)\}/.exec(cssLimpo);
    assert.ok(m, 'a regra do corpo da dobra existe');
    assert.match(m[1], /display:none/, 'fechada não ocupa espaço nem recebe Tab');
    assert.match(cssLimpo, /\.fold\.open>\.fold-body\{display:grid\}/);
    // com display:none→grid uma transition não tem de onde partir: só animation
    assert.match(cssLimpo, /\.fold\.entra\.open>\.fold-body\{animation:foldEntra/);
    assert.match(cssLimpo, /@keyframes foldEntra\{from\{opacity:0/);
    // a marca é de quem abre: sem isto, cada re-render fazia o conteúdo piscar
    assert.doesNotMatch(componentes, /class="sect fold [^"]*entra/,
      'o fold() nunca nasce com a marca da entrada');
    assert.match(componentes, /if\(on\)el\.classList\.add\('entra'\)/,
      'só o toggleFold a põe');
  });

  /* É o que dá acessibilidade de graça: qualquer regra nova fica desligada
     para quem pediu menos movimento ao sistema. */
  test('prefers-reduced-motion continua a anular tudo', () => {
    const m = /@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{([^}]*)\}/.exec(cssLimpo);
    assert.ok(m, 'a regra existe e continua a apanhar o seletor universal');
    assert.match(m[1], /animation:none!important/);
    assert.match(m[1], /transition:none!important/);
  });
});
