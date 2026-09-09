// O módulo que faz uma repintura parecer um movimento. O que se testa aqui é
// a parte que não precisa de browser — e, sobretudo, a promessa de que ele
// NUNCA fica com a repintura: se não puder animar, chama e sai da frente.
//
// Num sítio destes é fácil escrever um invólucro que engole o trabalho que
// devia embrulhar. Foi o que se testou primeiro.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp } from './arnes.js';

const app = carregarApp();
const { pintarComContinuidade, deslizarEntre, semMovimento, msDoToken, tokenTexto,
  medirContinuidade, aplicarContinuidade } = app;

describe('a repintura acontece sempre', () => {
  /* O DOM do arnês não tem animate(): é exatamente o caso «não dá para
     animar», e é onde um invólucro distraído deixaria a app sem repintar. */
  test('sem onde animar, pinta à mesma e devolve o que a pintura devolveu', () => {
    let vezes = 0;
    const r = pintarComContinuidade(() => { vezes++; return 'feito'; });
    assert.equal(vezes, 1, 'chamou a pintura uma vez, nem zero nem duas');
    assert.equal(r, 'feito', 'devolveu o que a pintura devolveu');
  });

  test('o deslize entre estados também', () => {
    let vezes = 0;
    const r = deslizarEntre(() => null, () => { vezes++; return 42; }, 1);
    assert.equal(vezes, 1);
    assert.equal(r, 42);
  });

  /* Sem raiz onde procurar peças não há nada a acompanhar — mas continua a
     haver uma vista para repintar. */
  test('com uma raiz que não existe, pinta à mesma', () => {
    let vezes = 0;
    pintarComContinuidade(() => vezes++, { raiz: () => null });
    assert.equal(vezes, 1);
  });
});

describe('rolar a pagina nao e uma mudanca', () => {
  const cont = readFileSync(new URL('../web/app/continuidade.js', import.meta.url), 'utf8');

  /* Medido: tocar no separador em que ja se esta, com a pagina a 600, punha os
     blocos da visao geral a deslizar 606px sem nada ter mudado. O
     getBoundingClientRect conta a partir da janela, e o go() faz scrollTo(0,0)
     DEPOIS do render e ANTES da microtarefa que aplica — o scroll perdido
     virava deslocamento. */
  test('as posicoes sao contadas a partir do documento, e nao da janela', () => {
    assert.match(cont, /function ondeEsta\(e\)\{/, 'ha um so sitio a converter');
    assert.match(cont, /r\.left\+\(window\.pageXOffset\|\|0\)/);
    assert.match(cont, /r\.top\+\(window\.pageYOffset\|\|0\)/);
    // e ninguem compara rects crus a seguir
    assert.doesNotMatch(cont, /a\.y-r\.top|a\.x-r\.left/,
      'comparar rects da janela era o defeito');
  });

  /* A janela de vista so decide o que vale a pena animar. Quando decidia
     tambem o que EXISTE, uma peca fora da janela parecia ter chegado agora
     (entrava a desvanecer) ou ter saido do ecra (ficava um fantasma fixo por
     cima do conteudo), so por se ter rolado a pagina. */
  test('estar por perto nao decide se a peca existe', () => {
    const corpo = cont.slice(cont.indexOf('function aplicarContinuidade'));
    const marca = corpo.indexOf('vistos[k]=1');
    const filtro = corpo.indexOf('porPerto');
    assert.ok(marca > -1 && filtro > -1, 'os dois estao la');
    assert.ok(marca < filtro, 'marca-se como vista ANTES de perguntar se esta por perto');
  });
});

describe('menos movimento', () => {
  /* A regra de CSS que anula animações não apanha estas: são feitas pela API
     do JavaScript, que o @media não vê. Tem de se perguntar à mão — e sem
     matchMedia (numa vm, num browser antigo) a resposta é «não pediu». */
  test('sem matchMedia não rebenta, e assume que ninguém pediu', () => {
    assert.equal(semMovimento(), false);
  });
});

describe('acompanhar peças é a regra, não um pedido', () => {
  /* Liguei isto primeiro a três sítios, e o resultado foi o esperado: todas as
     outras listas continuaram a trocar de golpe. Quem repinta não se pode ter
     de lembrar — quem repinta é o render, e é ele que acompanha. */
  const vistas = readFileSync(new URL('../web/app/vistas.js', import.meta.url), 'utf8');

  test('é o render que mede e aplica, e mais ninguém tem de pedir', () => {
    assert.match(vistas, /const antes=\(ecra===_ecraPintado&&!contSuspensa\)\?medirContinuidade\(view\(\)\):null/,
      'mede no princípio da pintura');
    assert.match(vistas, /Promise\.resolve\(\)\.then\(\(\)=>aplicarContinuidade\(antes,view\(\)\)\)/,
      'e aplica depois, numa microtarefa');
  });

  /* O render corre também ao mudar de separador, e aí não há peça nenhuma a
     acompanhar: é outro ecrã. Sem esta guarda, mudar de separador deitava
     todas as linhas do ecrã anterior para a camada de saída ao mesmo tempo. */
  test('só dentro do mesmo ecrã', () => {
    assert.match(vistas, /const ecra=tab\+'\|'\+\(setPage\|\|''\)/);
    assert.match(vistas, /_ecraPintado=ecra/);
  });

  /* Uma chave, um dono. O data-lp é do TOQUE LONGO; aceitá-lo aqui fazia com
     que quem o punha para ganhar a folha de opções se inscrevesse sem saber no
     deslizar entre repinturas — os blocos da visão geral deslizavam 606px por
     terem data-lp para o modo de edição. Quem quer ser acompanhado di-lo. */
  test('a chave da continuidade é só a dela', () => {
    const cont = readFileSync(new URL('../web/app/continuidade.js', import.meta.url), 'utf8');
    assert.match(cont, /const SEL_CHAVE='\[data-fk\]'/);
    assert.doesNotMatch(cont, /getAttribute\('data-lp'\)/, 'o data-lp é do gesto, não da animação');
  });

  /* E as linhas que QUEREM ser acompanhadas passam a dizê-lo. Sem isto, a
     correção acima tirava-lhes o deslizar sem ninguém dar por isso. */
  test('as linhas de lista pedem as duas chaves', () => {
    const pares = [
      ['../web/app/vistas.js', /data-lp="tx:[^"]*" data-fk="tx:/],
      ['../web/app/vistas.js', /data-lp="prop:[^"]*" data-fk="prop:/],
      ['../web/app/vistas.js', /data-lp="ct:[^"]*" data-fk="ct:/],
      ['../web/app/vistas.js', /data-lp="per:[^"]*" data-fk="per:/],
      ['../web/app/visitas.js', /data-lp="vis:[^"]*" data-fk="vis:/],
      ['../web/app/creditos.js', /data-lp="mort:[^"]*" data-fk="mort:/],
      ['../web/app/planeados.js', /data-lp="tpl:[^"]*" data-fk="tpl:/],
    ];
    for (const [f, re] of pares) {
      assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), re, f + ' sem as duas chaves');
    }
  });

  /* Apanhado a medir, e não por relato: com a janela sem altura (separador
     escondido, webview a ser redimensionada, painel do browser recolhido) o
     porPerto dizia que nada estava por perto, e ficavam as saídas sem os
     deslizes — meia animação, sem erro nenhum. */
  test('sem altura de janela, não se filtra por estar à vista', () => {
    const cont = readFileSync(new URL('../web/app/continuidade.js', import.meta.url), 'utf8');
    const corpo = cont.slice(cont.indexOf('function porPerto'), cont.indexOf('function ondeEsta'));
    assert.match(corpo, /if\(!h\)return true;/, 'sem janela, tudo conta como perto');
  });

  test('sem nada medido, aplicar não rebenta', () => {
    assert.equal(medirContinuidade(null), null);
    assert.doesNotThrow(() => aplicarContinuidade(null, {}));
  });
});

describe('os tempos vêm dos tokens, não de números à parte', () => {
  test('sem :root de onde os ler, fica o valor de recurso', () => {
    assert.equal(msDoToken('--medio', 200), 200);
    assert.equal(tokenTexto('--curva-entra', 'cubic-bezier(0,0,.2,1)'), 'cubic-bezier(0,0,.2,1)');
  });
});

/* Medido no browser, no instante zero da travessia entre separadores: um
   cartão que estava em y=282 aparecia em y=252, 15px mais à esquerda e 30px
   mais largo. O `velho` — a caixa para onde os filhos do #view são mudados —
   era um <div> pelado, e o #view tem a classe .wrap, que lhe dá o
   espaçamento. Sem ela o conteúdo estica-se de encosto a encosto, as linhas
   voltam a partir noutro sítio, os blocos encurtam, e tudo o que está em
   baixo sobe. Lê-se como um salto antes do deslize. */
describe('a caixa de quem sai é a mesma caixa', () => {
  const fonte = readFileSync(new URL('../web/app/continuidade.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');

  test('o #view tem mesmo espaçamento a perder — é por isso que a classe importa', () => {
    assert.match(html, /<div class="wrap" id="view">/, 'o #view é um .wrap');
    assert.match(html, /\.wrap\{padding:/, 'e o .wrap é quem dá o espaçamento');
  });

  test('o velho leva as classes do próprio #view, menos o entra', () => {
    const i = fonte.indexOf("const velho=document.createElement('div')");
    assert.ok(i > -1, 'a caixa de quem sai existe');
    const corpo = fonte.slice(i, i + 900);
    assert.match(corpo, /velho\.className=String\(v\.className\|\|''\)/,
      'copiadas do #view, não escritas à mão');
    assert.match(corpo, /c!=='entra'/,
      'menos a que manda os gráficos desenharem-se de novo: quem sai não entra em cena');
    assert.match(corpo, /box-sizing:border-box/,
      'e a largura medida conta o espaçamento, senão o conteúdo estica na mesma');
  });
});
