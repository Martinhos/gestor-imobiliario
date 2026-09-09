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
const navegacao = readFileSync(new URL('../web/app/navegacao.js', import.meta.url), 'utf8');
const notificacoes = readFileSync(new URL('../web/app/notificacoes.js', import.meta.url), 'utf8');
const vistas = readFileSync(new URL('../web/app/vistas.js', import.meta.url), 'utf8');
const graficos = readFileSync(new URL('../web/app/graficos.js', import.meta.url), 'utf8');

/* A escada das camadas. O modal esteve abaixo do menu lateral, e em ecrã largo
   isso cortava-o ao meio — e deixava o menu clicável por baixo de um véu que
   não o tapava. É invisível no telemóvel, onde a gaveta está fora do ecrã, e
   por isso passou despercebido: fica guardado. */
describe('a escada das camadas', () => {
  // por indexOf e não por expressão: os seletores levam pontos, e escapá-los
  // dava mais barras invertidas do que regra
  /* o mesmo seletor aparece em várias regras (a do fundo, a da media query, a
     do movimento): procura-se a que declara mesmo o z-index, e só dentro do
     bloco dela — não na seguinte */
  const zDe = (sel) => {
    let i = -1;
    while ((i = cssLimpo.indexOf(sel + '{', i + 1)) > -1) {
      const m = /z-index:(\d+)/.exec(cssLimpo.slice(i, cssLimpo.indexOf('}', i)));
      if (m) return Number(m[1]);
    }
    assert.fail(sel + ' não declara z-index em regra nenhuma');
    return 0;
  };

  test('um modal está acima de toda a navegação', () => {
    const modal = zDe('.modal');
    assert.ok(modal > zDe('aside'), 'acima do menu lateral');
    assert.ok(modal > zDe('.scrim'), 'e do véu da gaveta');
    assert.ok(modal > zDe('.tabbar'), 'e da barra de baixo');
    assert.ok(modal > zDe('.fab'), 'e do botão flutuante');
  });

  /* O que fica ACIMA do modal só pode ser o que não esconde nada com que se
     interaja: um aviso que passa e um balão de leitura. */
  test('e só o aviso e o balão ficam acima dele', () => {
    const modal = zDe('.modal');
    assert.ok(zDe('.toast') > modal, 'o aviso vê-se por cima de um modal');
    assert.ok(zDe('.tip') > modal, 'e o balão também');
  });
});

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

  /* A --curva-fita não é citada por nenhuma regra CSS: quem a usa são as duas
     fitas, em JS, pelo tokenTexto. Por isso fica fora da lista acima — mas tem
     de estar declarada, senão o valor de recurso do tokenTexto passava a ser a
     verdade e o token deixava de mandar em coisa nenhuma. */
  test('a curva de quem atravessa em bloco existe, e sai das outras duas', () => {
    assert.match(cssLimpo, /--curva-fita\s*:\s*cubic-bezier\(\.4,0,\.2,1\)/, 'declarada no :root');
    /* o arranque da --curva-sai com a chegada da --curva-entra: é isso que lhe
       dá velocidade zero à partida e à chegada */
    assert.match(cssLimpo, /--curva-sai\s*:\s*cubic-bezier\(\.4,0,/, 'o arranque vem daqui');
    assert.match(cssLimpo, /--curva-entra\s*:\s*cubic-bezier\(0,0,\.2,1\)/, 'a chegada daqui');
  });

  /* As duas fitas — a dos separadores e a das listas — têm o que sai e o que
     entra agarrados um ao outro. A curva de quem CHEGA arranca à velocidade
     máxima: medido no browser, fazia 30% do caminho nos primeiros 34 ms, e
     lia-se como um empurrão. E tem de ser a MESMA curva nos dois painéis: com
     curvas diferentes abria-se uma fenda entre eles a meio do caminho. */
  test('as fitas usam a curva da fita; as peças soltas a de quem chega', () => {
    const cont = readFileSync(new URL('../web/app/continuidade.js', import.meta.url), 'utf8');
    ['correrAFita', 'deslizarPainel'].forEach((f) => {
      const i = cont.indexOf('function ' + f + '(');
      assert.ok(i > -1, f + ' existe');
      /* até à declaração de topo seguinte: estas funções levam comentários
         longos, e uma janela de tamanho fixo cortava-as a meio */
      const fim = cont.indexOf('\nfunction ', i + 1);
      const corpo = cont.slice(i, fim > -1 ? fim : cont.length);
      assert.match(corpo, /tokenTexto\('--curva-fita'/, f + ' cita a --curva-fita');
      assert.ok(!/tokenTexto\('--curva-entra'/.test(corpo), f + ' já não usa a de quem chega');
      assert.equal((corpo.match(/easing:\s*curva/g) || []).length, 2,
        f + ': a mesma curva nos dois painéis, senão abre fenda');
    });
    const j = cont.indexOf('function aplicarContinuidade(');
    assert.match(cont.slice(j, j + 900), /tokenTexto\('--curva-entra'/,
      'as peças soltas continuam a CHEGAR, e essa curva está certa para elas');
  });

  /* Uma lista de seletores dava a ilusão de cobrir a regra e não cobria: o
     regex do .card.tap pedia UM dígito antes do «s» e o valor lá era .12s, por
     isso nunca podia falhar. Varre-se a folha inteira: qualquer transition ou
     animation com um tempo escrito à mão acusa, seja de que regra for. O 0s é
     a única excepção, e não é uma duração escolhida — é «troca já». */
  test('nenhuma declaração de movimento tem tempo escrito à mão', () => {
    const decls = cssLimpo.match(/(?:transition|animation)(?:-duration|-delay)?\s*:[^;{}]*/g) || [];
    assert.ok(decls.length > 20, 'a folha tem declarações de movimento (' + decls.length + ')');
    const mao = decls.filter((d) => /(?:^|[\s,:(])\.?\d+(?:\.\d+)?m?s\b/.test(d))
      .filter((d) => !/(?:^|[\s,:(])0s\b/.test(d.replace(/var\([^)]*\)/g, '')));
    assert.deepEqual(mao, [], 'cita os tokens: --rapido, --medio, --lento, --desenho, --pulso');
  });

  /* Provam-se os tokens novos como os outros: declarados E citados. */
  test('o desenho dos gráficos e o pulso do crachá também são tokens', () => {
    ['--desenho', '--pulso'].forEach((t) => {
      assert.match(cssLimpo, new RegExp(t + '\\s*:\\s*[^;]'), t + ' declarado no :root');
      assert.ok(cssLimpo.includes('var(' + t + ')'), t + ' declarado mas nunca citado');
    });
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

  /* Do uso real: «muitos botões ficam brancos quando clico, mas depois volto a
     clicar e já não fica». Cinco pares :hover/:active pintavam-se da MESMA cor
     (.iconbtn, .selopt, .menupop button, .legend .li.tap e .btn.primary). Com
     rato, o ponteiro fica em cima depois do clique, o :hover mantém a cor, e o
     toque seguinte não muda coisa nenhuma. */
  test('premido nunca é da mesma cor que passar por cima', () => {
    const fundo = (corpo) => (corpo.match(/background(?:-color)?:\s*([^;]+)/) || [])[1];
    const porEstado = (estado) => {
      const m = {};
      for (const r of cssLimpo.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        if (!r[1].includes(estado)) continue;
        const cor = fundo(r[2]);
        if (!cor) continue;
        r[1].split(',').map((x) => x.trim()).forEach((sel) => {
          if (sel.includes(estado)) m[sel.split(estado)[0].trim()] = cor.trim();
        });
      }
      return m;
    };
    const passa = porEstado(':hover'), preme = porEstado(':active');
    const iguais = Object.keys(preme).filter((k) => passa[k] && passa[k] === preme[k]);
    assert.deepEqual(iguais, [], 'premido igual a hover: o segundo toque não muda nada');
  });

  /* Medido no browser: a --curva faz 83% do caminho em 30% do tempo. Num botão
     que encolhe 3% é o estalido que se quer; numa folha que sobe o ecrã
     inteiro, são 83% da altura em 78ms — «nem se percebe que deslizou». */
  test('o que atravessa distância não usa a curva do estalido', () => {
    ['--curva-entra'].forEach((t) => {
      assert.match(cssLimpo, new RegExp(t + '\\s*:\\s*[^;]'), t + ' declarado no :root');
      assert.ok(cssLimpo.includes('var(' + t + ')'), t + ' declarado mas nunca citado');
    });
    // a folha, o véu, a gaveta e as formas dos gráficos: tudo o que percorre caminho
    [/\.modal\.open \.sheet\{animation:folhaEntra var\(--lento\) var\(--curva-entra\)/,
      /\.modal\.open \.sheet\{animation:folhaSobe var\(--lento\) var\(--curva-entra\)/,
      /#view\.entra \.gbar\{[^}]*var\(--curva-entra\)/,
      /#view\.entra \.gdonut,#donutCard\.redesenha \.gdonut\{[^}]*var\(--curva-entra\)/,
      /aside\{[^}]*transition:width var\(--medio\) var\(--curva-entra\)/]
      .forEach((r) => assert.match(cssLimpo, r, 'ainda com a curva do estalido: ' + r));
    // e a folha teve de ganhar tempo: a .26s não chegava para se ver subir
    assert.match(cssLimpo, /--lento:\.3\ds/, 'o degrau longo cresceu');
  });

  /* Um gráfico não pode mudar de altura só por alguém lhe tocar: a guia e a
     faixa de leitura são sobrepostas, e a faixa fica no TOPO — debaixo do dedo
     era onde o balão antigo estava, e é onde a mão tapa o que se quer ler. */
  /* O «modal preto» que ficava por trás de uma ficha não era um modal: era a
     página a deixar de ser pintada. O body tem uma altura de ecrã
     (html,body{height:100%}); trancado em position:fixed com top:-scrollY, um
     overflow:hidden fazia-o recortar o próprio conteúdo a uma caixa de um
     ecrã ancorada no INÍCIO do documento — e essa caixa está fora da vista
     quando a página está rolada. O .modal escapava por ser fixed, e por isso
     a folha e o véu ficavam certos: o que desaparecia era tudo o resto. */
  test('a página trancada continua a ser pintada por trás da janela', () => {
    const m = /html\.noscroll body\{([^}]*)\}/.exec(cssLimpo);
    assert.ok(m, 'a regra da página trancada existe');
    assert.match(m[1], /position:fixed/, 'é o fixed que a trava no sítio');
    assert.doesNotMatch(m[1], /overflow:hidden/,
      'e nunca overflow:hidden: com top negativo, recorta a página toda para fora do ecrã');
    assert.match(cssLimpo, /html\.noscroll\{overflow:hidden\}/, 'quem tranca o scroll é o html');
  });

  test('ler um gráfico não lhe mexe na altura', () => {
    const g = /\.chartguia,\.chartlido\{([^}]*)\}/.exec(cssLimpo);
    assert.ok(g, 'a regra da guia e da faixa existe');
    assert.match(cssLimpo, /\.chartguia\{position:absolute/);
    assert.match(cssLimpo, /\.chartlido\{position:absolute[^}]*top:0/, 'a faixa fica no topo, fora do dedo');
    const cb = /\.chartbox\{([^}]*)\}/.exec(cssLimpo);
    assert.ok(cb, 'a regra da caixa existe');
    assert.match(cb[1], /position:relative/);
    assert.match(cb[1], /touch-action:pan-y/, 'o gesto horizontal lê sem impedir o scroll vertical');
    /* Segurar o dedo num gráfico caía no gesto de selecionar palavra do
       browser — escolhia o mês e, ao começar, roubava o ponteiro e cancelava
       a leitura. É a mesma proteção que [data-lp] já tem. */
    assert.match(cb[1], /user-select:none/, 'segurar num gráfico não seleciona os rótulos');
    assert.match(cb[1], /-webkit-touch-callout:none/, 'nem abre o callout do iOS');
    assert.match(graficos, /closest\('\.chartbox\[data-lido\]'\)\)return/,
      'onde já se lê com o dedo, o balão antigo cala-se');
  });

  /* A faixa da série de um indicador é enchida DEPOIS de a página estar
     pintada — correr as séries de todos custa 24ms com 500 movimentos, que é
     metade de uma pintura. Por isso a altura tem de vir do CSS: sem ela, tudo
     o que está por baixo saltava quando a faixa aparecesse, que é a queixa dos
     «quadrados que aparecem desalinhados» outra vez. */
  test('a faixa da série tem altura antes de ter conteúdo', () => {
    const m = /\.kserie\{([^}]*)\}/.exec(cssLimpo);
    assert.ok(m, 'a regra da faixa existe');
    assert.match(m[1], /height:\d+px/, 'altura fixa, e não a do conteúdo');
    assert.match(vistas, /class="kserie" data-kpi="\$\{id\}"><\/div>/, 'e nasce vazia');
    assert.match(vistas, /if\(cx\.dataset\.feito\)return/, 'e enche-se uma vez só');
  });

  /* A faixa comparava anos por cima de um número que não era de um ano. Na
     visão geral o valor do cartão É o do ano corrente; nos Movimentos é a soma
     do filtro inteiro — mostrava −17 000 € com uma variação a falar de
     −3 400 €. Duas guardas: a faixa só NASCE onde o valor é anual, e mesmo aí
     só FALA se o texto do cartão for igual ao do ano, formatado pela própria
     série. */
  test('a variação só fala do número que o cartão mostra', () => {
    assert.match(vistas, /evo\.anual&&haAnoAnterior\(\)/, 'a faixa só nasce onde o valor é anual');
    assert.match(vistas, /f\.anual=true/, 'e é quem cria os cartões que o declara');
    assert.match(vistas, /function falaDoMesmo\(cx,s,ano\)/);
    assert.match(vistas, /limpa\(alvo\.textContent\)===limpa\(s\.fmt\(ano\.value\)\)/,
      'compara o texto formatado pela própria série');
    assert.match(vistas, /if\(!a&&!h\)\{cx\.innerHTML='';return\}/, 'dois zeros não se comparam');
    assert.match(vistas, /\$\{antes\.label\}: \$\{s\.fmt\?s\.fmt\(a\):a\}/,
      'e diz o número de que fala, não só o ano');
  });

  /* Medido: o --accent (#244c3b) sobre o --side (#1a3a2c) da gaveta dá 1.29:1
     — o anel existia e não se via. */
  test('o anel de foco na gaveta escura vem da paleta da gaveta', () => {
    assert.match(cssLimpo, /nav a:focus-visible,\.railbtn:focus-visible\{outline-color:var\(--side-ink\)\}/);
    // e depois da regra geral, senão não a ganhava
    assert.ok(cssLimpo.indexOf('outline-color:var(--side-ink)') >
      cssLimpo.indexOf('.rich-tools button:focus-visible'), 'a seguir à regra que corrige');
  });

  /* O tornarFocavel dá role=button às formas dos gráficos, e a rede do premido
     apanhava-as: medido, as barras saltavam ao serem tocadas e o ponto de uma
     linha afastava-se na proporção da distância à origem do desenho — em SVG a
     origem de um transform não é o centro da forma. */
  test('uma forma de gráfico não se afunda ao ser tocada', () => {
    assert.match(cssLimpo, /svg \[role="button"\]:active,svg \.tap:active\{transform:none\}/);
    // e depois da regra que apanha, senão não a ganhava
    assert.ok(cssLimpo.indexOf('svg [role="button"]:active') >
      cssLimpo.indexOf('[role="button"]:active,.tap:active{transform:scale'),
      'vem a seguir à rede que corrige');
  });

  /* Medido na visão geral: 39 sítios alcançáveis pelo Tab, 19 deles sem anel
     nenhum, por não caberem em nenhuma classe da lista. */
  test('a rede apanha o que o tornarFocavel torna alcançável', () => {
    assert.match(cssLimpo, /\[role="button"\]:focus-visible\{outline:2px solid var\(--accent\);outline-offset:2px\}/);
    assert.match(vistas, /setAttribute\('role','button'\)/, 'é isso que o tornarFocavel escreve');
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

  /* Medido: a sincronização adota o estado do servidor de 3 em 3 minutos e
     chama render(), que refaz o buildNav — o crachá pulsava sozinho, sem nada
     ter acontecido. O pulso é de quem MUDA de número, e quem decide isso é o
     cntNovo, não a existência do nó. */
  test('o crachá só pulsa quando o número muda', () => {
    assert.match(cssLimpo, /\.cnt\.novo\{animation:selo var\(--pulso\) var\(--curva\) both\}/);
    assert.doesNotMatch(cssLimpo, /(?:^|[,}])\s*(?:nav a|\.tabbar a|#hdrBell) \.cnt\{animation:selo/,
      'sem o .novo, qualquer crachá recriado pulsava');
    assert.match(navegacao, /function cntNovo\(chave,n\)/, 'a memória da contagem anterior existe');
    assert.match(navegacao, /antes!==undefined&&antes!==n/, 'a primeira vez não pulsa, e o número igual também não');
    // os três sítios que emitem um crachá passam por ela
    assert.equal((navegacao.match(/cntNovo\(/g) || []).length, 3, 'a gaveta, a barra de baixo, e a definição');
    assert.match(notificacoes, /cntNovo\('sino',n\)/, 'o sino também');
  });

  /* O transform-box:fill-box é o que faz a origem de um <rect> valer sobre a
     própria forma e não sobre o viewBox todo. E a entrada é de quem CHEGA ao
     ecrã: sem o #view.entra, a sincronização de fundo e qualquer repintura
     mandavam os gráficos desenharem-se outra vez a meio de uma leitura. */
  test('os gráficos só se desenham para quem chega ao ecrã', () => {
    assert.match(cssLimpo, /#view\.entra \.gbar\{[^}]*transform-box:fill-box[^}]*transform-origin:bottom/);
    assert.match(cssLimpo, /#view\.entra \.ghbar\{[^}]*transform-origin:left/);
    assert.match(cssLimpo, /#view\.entra \.gdonut,#donutCard\.redesenha \.gdonut\{[^}]*stroke-dasharray:1/,
      'e a roda tambem se redesenha quando e ela a mudar de reparto, sem passar pelo render');
    /* Medido: a linha do zero a y=90.9 e uma barra de despesa de 90.9 a 141.5.
       Com a origem no fundo da propria caixa, ela nascia la em baixo, solta do
       eixo, e subia ate la — «primeiro aparecem desalinhados». */
    assert.match(cssLimpo, /#view\.entra \.gbar\.desce\{transform-origin:top\}/,
      'a barra que desce cresce a partir do eixo, que e o topo da caixa dela');
    assert.match(graficos, /class="gbar\$\{seg\.value<0\?' desce':''\}"/,
      'e é o graficos.js que sabe qual delas desce');
    assert.doesNotMatch(cssLimpo, /(?:^|[,}])\s*\.(?:gbar|ghbar|gdonut)\{[^}]*animation:/,
      'sem o portão, animava em qualquer repintura');
    assert.match(vistas, /view\(\)\.classList\.toggle\('entra',!!_entrar\);_entrar=0/, 'o render gasta a marca');
    assert.equal((navegacao.match(/_entrar=1/g) || []).length, 2, 'quem a liga é o go e o goSet');
  });

  /* Medido no browser: as barras são irmãs dos onze elementos do eixo, por
     isso um :nth-child contava-os a eles — a primeira barra ficava com o
     último degrau. E o .ghbar é sempre filho único: nenhuma das cinco regras
     chegava a casar. O atraso passa a ser escrito onde o índice se sabe. */
  test('o escalonamento vem do graficos.js e não de um nth-child', () => {
    assert.doesNotMatch(cssLimpo, /\.(?:gbar|ghbar):nth-child/, 'o nth-child contava o eixo');
    assert.match(graficos, /const atrasoEntrada=\(i,n\)=>\{/, 'a onda conta as formas todas');
    assert.match(graficos, /Math\.round\(i\*Math\.min\(30,150\/\(n-1\)\)\)/,
      'o orçamento é 150ms repartido por todas, com o degrau a não passar de 30');
    assert.doesNotMatch(graficos, /Math\.min\(i,5\)/,
      'o corte aos seis degraus partia o gráfico ao meio: onda à esquerda, salto à direita');
    assert.match(graficos, /const atraso=grp\.some\(s=>s\.value\)\?atrasoEntrada\(col\+\+,colunas\):''/,
      'conta as colunas desenhadas, não os meses vazios');
    /* o atraso viaja no style da própria barra: o hit() deixou de lá estar
       quando o gráfico passou a ler-se com o dedo e as formas saíram do Tab */
    assert.match(graficos, /class="gbar\$\{[^}]*\}"[^`]*\$\{atraso\?` style="\$\{atraso\}"`:''\}/,
      'a barra vertical, pela coluna');
    assert.doesNotMatch(graficos, /class="gbar[^`]*hit\(/,
      'e sem toque próprio: cada forma com onclick era uma paragem do Tab sem destino');
    assert.match(graficos, /const colunas=groups\.filter/, 'e sabe quantas colunas desenham');
    assert.match(graficos, /class="ghbar"[^`]*\$\{atrasoEntrada\(i,items\.length\)\}/, 'a barra horizontal, pelo item');
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
