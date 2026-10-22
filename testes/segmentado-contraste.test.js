// O realce dos segmentados vê-se em qualquer escuro:
// - a escolha acesa leva um contorno de 2px no cobalto, o fundo --accent-soft
//   e o texto --accent-text, em todos os segmentados menos as abas
//   sublinhadas das Pessoas, e nos dois temas (a regra vem depois da do
//   escuro da ronda anterior e pesa o mesmo);
// - no que desliza (o formulário do imóvel) o contorno vai na peça que corre;
// - o contorno tem 3:1 ou mais contra a pista, e o texto 4.5:1 contra o fundo
//   aceso, no claro e no escuro (e o texto do tipo do movimento na cor dele);
// - o segmentado do imóvel continua um radiogroup com a peça na escolha;
// - a nota do Samsung Internet aparece na linha do Tema só lá e só em
//   Automático, ligada ao segmentado para o leitor de ecrã.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
// o navigator não passa pelo proxy: volta ao do arnês depois de cada teste
const UA_ARNES = app.__ctx.navigator.userAgent;
afterEach(() => { app.__ctx.navigator.userAgent = UA_ARNES; });

const CSS = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const INICIO = '/* ===== ajustes-v40d: 1.1';
const FIM = '/* ===== fim: ajustes-v40d 1.1 ===== */';
const SECCAO = CSS.slice(CSS.indexOf(INICIO), CSS.indexOf(FIM));
const SEM_COMENTARIOS = SECCAO.replace(/\/\*[\s\S]*?\*\//g, '');

/* o valor de um token num bloco (:root ou :root.dark) */
const token = (bloco, nome) => {
  const i = CSS.indexOf(bloco + '{');
  const m = CSS.slice(i, CSS.indexOf('}', i)).match(new RegExp(nome + ':(#[0-9a-f]{6})'));
  return m[1];
};
const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/* a especificidade de um seletor simples desta folha: [ids, classes+atributos+pseudo-classes, elementos] */
const especificidade = (s) => {
  const sem = s.replace(/:not\(([^)]*)\)/g, ' $1 ');
  const classes = (sem.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const elementos = (sem.replace(/\[[^\]]+\]/g, '').match(/(^|[\s>+~])[a-z][\w-]*/g) || []).length;
  return [(sem.match(/#[\w-]+/g) || []).length, classes, elementos];
};
const pesa = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
/* a declaração de um seletor exato da secção */
const regra = (seletorInicio) => {
  const i = SEM_COMENTARIOS.indexOf(seletorInicio);
  assert.ok(i >= 0, 'há a regra ' + seletorInicio);
  const a = SEM_COMENTARIOS.indexOf('{', i);
  return { seletores: SEM_COMENTARIOS.slice(i, a).split(',').map((x) => x.trim()), corpo: SEM_COMENTARIOS.slice(a + 1, SEM_COMENTARIOS.indexOf('}', a)).trim() };
};

describe('a regra do realce', () => {
  test('a secção existe, uma vez, e vem DEPOIS da do escuro da ronda anterior', () => {
    assert.equal(CSS.split(INICIO).length, 2, 'uma secção só');
    assert.ok(CSS.indexOf(FIM) > CSS.indexOf(INICIO));
    const v40c = CSS.indexOf(':root.dark .segm>.on,');
    assert.ok(v40c > 0 && CSS.indexOf(INICIO) > v40c, 'a regra nova fica por baixo da do :root.dark de cima');
  });

  test('a escolha acesa: contorno de 2px no cobalto, fundo --accent-soft, texto --accent-text, sem sombra — em todos menos as abas sublinhadas e o que desliza', () => {
    const r = regra('.segm:not(.abas-pessoas):not(.desliza)>.on');
    assert.deepEqual(r.seletores.map((s) => s.replace(/^\.segm:not\(\.abas-pessoas\):not\(\.desliza\)>/, '')),
      ['.on', '[aria-checked="true"]', '[aria-current="page"]', '[aria-selected="true"]'], 'os mesmos quatro estados da regra de base');
    assert.match(r.corpo, /position:relative;/);
    assert.match(r.corpo, /background:var\(--accent-soft\);/);
    assert.match(r.corpo, /color:var\(--segm-texto,var\(--accent-text\)\)/);
    assert.match(r.corpo, /box-shadow:none/);
    assert.doesNotMatch(r.corpo, /border|padding/, 'o botão aceso não muda de caixa: o texto tem a mesma largura que tinha');
    // o contorno é uma peça por cima, colada às bordas do botão e sem apanhar toques
    const c = regra('.segm:not(.abas-pessoas):not(.desliza)>.on::after');
    assert.equal(c.seletores.length, 4);
    assert.ok(c.seletores.every((s) => s.endsWith('::after')));
    assert.equal(c.corpo, 'content:"";position:absolute;inset:0;border:2px solid var(--accent);border-radius:inherit;pointer-events:none');
  });

  test('nos segmentados apertados o aceso cabe: colunas iguais, letra a 13px e menos enchimento nos tipos do movimento e no «declarado» do contrato', () => {
    assert.equal(regra('.segm.mov-tipo-segm>button{').corpo, 'font-size:13px;padding-left:3px;padding-right:3px');
    assert.equal(regra('.segm.ct-at-segm>button[type="button"]{').corpo, 'font-size:13px;padding-left:1px;padding-right:1px');
    assert.doesNotMatch(SEM_COMENTARIOS, /flex:1 1 auto/, 'as colunas ficam iguais (o flex:1 1 0 da regra de base)');
    assert.equal(regra('.segm.abas-area>a{').corpo, 'padding-left:6px;padding-right:6px');
    // e pesam mais do que as de cada um (a do contrato vem depois desta secção)
    assert.ok(pesa(especificidade('.segm.ct-at-segm>button[type="button"]'), especificidade('.segm.ct-at-segm>button')) > 0);
    assert.ok(pesa(especificidade('.segm.mov-tipo-segm>button'), especificidade('.segm>button')) > 0);
  });

  test('pesa o mesmo que a do escuro de cima (e por vir depois ganha), e mais do que a de base', () => {
    const nova = especificidade('.segm:not(.abas-pessoas):not(.desliza)>[aria-checked="true"]');
    for (const velha of [':root.dark .segm>.on', ':root.dark .segm>[aria-checked="true"]', ':root.dark .segm>[aria-current="page"]']) {
      assert.ok(pesa(nova, especificidade(velha)) >= 0, velha + ' não pode pesar mais');
    }
    assert.ok(pesa(nova, especificidade('.segm>.on')) > 0);
    // o tom do movimento entra por variáveis: as regras de cor de lá pesam menos e não contam
    assert.ok(pesa(nova, especificidade('.mov-tipo-segm>button.on.pos')) > 0);
  });

  test('o que desliza: o contorno e o fundo na peça, nos dois temas; o botão aceso só com o texto', () => {
    const p = regra('.segm.desliza>.segm-polegar');
    assert.deepEqual(p.seletores, ['.segm.desliza>.segm-polegar', ':root.dark .segm.desliza>.segm-polegar']);
    assert.match(p.corpo, /border:2px solid var\(--accent\);background:var\(--accent-soft\);box-shadow:none/);
    const b = regra('.segm.desliza>.on');
    assert.equal(b.corpo, 'color:var(--accent-text)');
    // a peça desliza por transform: a borda é por dentro e a largura não muda
    assert.match(CSS, /\.segm-polegar\{position:absolute;[^}]*width:calc\(\(100% - 10px\) \/ 2\)/);
    assert.match(CSS, /\*\{box-sizing:border-box\}/);
  });

  test('cores só por tokens, nada de transition:all nem :hover solto na secção', () => {
    assert.doesNotMatch(SEM_COMENTARIOS, /#[0-9a-f]{3,6}\b/i);
    assert.doesNotMatch(SEM_COMENTARIOS, /rgba?\(/);
    assert.doesNotMatch(SEM_COMENTARIOS, /transition:all/);
    assert.doesNotMatch(SEM_COMENTARIOS, /:hover/);
  });
});

describe('o contraste, pelos tokens', () => {
  const temas = [[':root', 'claro'], [':root.dark', 'escuro']];

  test('o contorno (o cobalto) contra a pista (--chip) e contra o fundo da página: 3:1 ou mais nos dois temas', () => {
    for (const [bloco, nome] of temas) {
      for (const atras of ['--chip', '--card', '--bg']) {
        const c = contraste(token(bloco, '--accent'), token(bloco, atras));
        assert.ok(c >= 3, `${nome}: --accent contra ${atras} ${c.toFixed(2)}`);
      }
    }
  });

  test('o texto aceso contra o fundo aceso: 4.5:1 ou mais nos dois temas — o cobalto e as cores do movimento', () => {
    for (const [bloco, nome] of temas) {
      for (const [texto, fundo] of [['--accent-text', '--accent-soft'], ['--in', '--accent-soft'], ['--out', '--accent-soft'], ['--loan', '--accent-soft']]) {
        const c = contraste(token(bloco, texto), token(bloco, fundo));
        assert.ok(c >= 4.5, `${nome}: ${texto} sobre ${fundo} ${c.toFixed(2)}`);
      }
    }
  });

  test('o realce de antes era quase igual à pista (o defeito): o branco no claro e o --line2 no escuro abaixo de 1.6:1', () => {
    assert.ok(contraste(token(':root', '--card'), token(':root', '--chip')) < 1.6);
    assert.ok(contraste(token(':root.dark', '--line2'), token(':root.dark', '--chip')) < 1.6);
  });

  test('o tipo do movimento: o contorno no cobalto e só o texto na cor dele, pela variável', () => {
    for (const [cls, tom] of [['pos', 'in'], ['neg', 'out'], ['prest', 'loan']]) {
      const r = regra(`.mov-tipo-segm>button.on.${cls}{`.slice(0, -1));
      assert.equal(r.corpo, `--segm-texto:var(--${tom})`);
    }
    assert.doesNotMatch(SEM_COMENTARIOS, /--segm-tom|--segm-fundo/, 'o contorno e o fundo não mudam com o tipo');
  });
});

describe('o segmentado do imóvel', () => {
  test('um radiogroup com a peça na escolha (i0 ou i1), escondida do leitor de ecrã, e um radio aceso', () => {
    limpar(app);
    const h = app.imvSegmentado('Tipo de arrendamento', [['inteiro', 'Imóvel inteiro', 'Um contrato só.'], ['quartos', 'Por quartos', 'Um por quarto.']], 'quartos', 'setMode');
    assert.match(h, /<div class="segm desliza" id="imv_segm_setMode" role="radiogroup" aria-labelledby="imv_seg_setMode"><span class="segm-polegar i1" aria-hidden="true"><\/span>/);
    assert.match(h, /role="radio" aria-checked="false" class=""[^>]*>Imóvel inteiro</);
    assert.match(h, /role="radio" aria-checked="true" class="on"[^>]*>Por quartos</);
    assert.match(h, /Um por quarto\./);
    assert.doesNotMatch(h, /style=/);
  });
});

describe('a nota do Samsung Internet no Tema', () => {
  const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36';
  const CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
  const comTema = (ua, tema) => { limpar(app); app.__ctx.navigator.userAgent = ua; app.db.settings.theme = tema; return app.linhaDoTema(); };

  test('o Samsung Internet reconhece-se pelo UA; o Chrome do mesmo telemóvel não', () => {
    app.__ctx.navigator.userAgent = SAMSUNG;
    assert.equal(app.eSamsungInternet(), true);
    app.__ctx.navigator.userAgent = CHROME;
    assert.equal(app.eSamsungInternet(), false);
    app.__ctx.navigator.userAgent = undefined;
    assert.equal(app.eSamsungInternet(), false);
  });

  test('no Samsung Internet em Automático: a nota por baixo do segmentado, com o caminho e o «Escuro», ligada por aria-describedby', () => {
    const h = comTema(SAMSUNG, 'auto');
    assert.match(h, /<div class="segm" role="radiogroup" aria-label="Tema" aria-describedby="defTemaSamsung">/);
    const nota = h.match(/<p class="def-tema-samsung" id="defTemaSamsung">([\s\S]*?)<\/p>/);
    assert.ok(nota, 'há a nota');
    assert.match(nota[1], /escurece as páginas à força/);
    assert.match(nota[1], /<b>Samsung Internet → Definições → Labs → Usar o tema escuro do site<\/b>/);
    assert.match(nota[1], /<b>Escuro<\/b> aqui/);
    assert.ok(h.indexOf('id="defTemaSamsung"') > h.indexOf('defTema_dark'), 'a nota vem depois do segmentado');
    assert.doesNotMatch(h, /style=/);
  });

  test('no Samsung Internet em Claro ou Escuro, e noutro browser em Automático: sem nota', () => {
    for (const [ua, tema] of [[SAMSUNG, 'light'], [SAMSUNG, 'dark'], [CHROME, 'auto'], ['node', 'auto']]) {
      const h = comTema(ua, tema);
      assert.doesNotMatch(h, /def-tema-samsung|aria-describedby/, ua.slice(0, 20) + ' ' + tema);
      assert.match(h, /aria-label="Tema">/);
    }
  });
});
