// Chegar ao fim do que rola não rola o que está por trás. Uma lista de escolha
// que flutua por cima dos Movimentos chegava ao fim, o dedo continuava, e quem
// rolava era a lista dos movimentos por baixo dela. A regra (docs/design.md, as
// alturas e a rolagem): cada caixa da folha que rola na vertical leva
// overscroll-behavior:contain, salvo as que vivem em linha na página, onde o
// resto do gesto é da página de propósito; a que rola de lado contém o fim
// na horizontal; a lista e o menu que não têm o que rolar não deixam o dedo
// arrastar a partir das opções; e as camadas de ecrã inteiro que o JS monta
// contêm também. São verificações de texto: o gesto mede-se no browser.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const folha = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');

/* As regras da folha, as de dentro das @media, @supports e @container
   também, juntadas por seletor: um seletor pode dizer o overflow numa regra e
   o overscroll-behavior noutra.
   Recebe: css — a folha, sem comentários.
   Devolve: Map seletor → {prop: valor} (a última declaração ganha). */
function regras(css) {
  const m = new Map();
  for (const r of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = r[1].trim().replace(/\s+/g, ' ');
    const decl = m.get(sel) || {};
    for (const d of r[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      decl[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).replace(/!important/, '').trim();
    }
    m.set(sel, decl);
  }
  return m;
}

/* O valor de uma propriedade de dois eixos (overflow, overscroll-behavior)
   num eixo: o longhand ganha; com um valor só no atalho, é o dos dois eixos;
   com dois, o primeiro é o x e o segundo o y.
   Recebe: decl — as declarações; prop — 'overflow' ou 'overscroll-behavior'; eixo — 'x' ou 'y'.
   Devolve: o valor (texto), ou '' se não está escrito. */
function noEixo(decl, prop, eixo) {
  if (decl[prop + '-' + eixo]) return decl[prop + '-' + eixo];
  const v = (decl[prop] || '').split(/\s+/).filter(Boolean);
  if (!v.length) return '';
  return v.length === 1 ? v[0] : (eixo === 'x' ? v[0] : v[1]);
}

const rola = (decl, eixo) => /^(auto|scroll)$/.test(noEixo(decl, 'overflow', eixo));
const contem = (decl, eixo) => noEixo(decl, 'overscroll-behavior', eixo) === 'contain';
const R = regras(folha);

/* As caixas que rolam na vertical e deixam, no fim, o gesto seguir para fora,
   de propósito — e porquê. Uma razão por caixa; uma caixa que saia da folha
   tem de sair daqui também. */
const EM_LINHA = {
  '.prow textarea.pnm': 'o nome de uma foto, três linhas no meio da lista das fotos: no fim, o dedo segue para a lista à volta',
  '.cred-plano': 'o plano ano a ano, em linha na página e na janela do plano: ocupa metade do ecrã, e contê-la prendia o dedo de quem pousou nela para descer',
};

describe('o que rola por cima não rola o que está por trás', () => {
  test('cada caixa que rola na vertical contém o fim, salvo as que vivem em linha na página', () => {
    const falta = [];
    for (const [sel, decl] of R) if (rola(decl, 'y') && !contem(decl, 'y') && !EM_LINHA[sel]) falta.push(sel);
    assert.deepEqual(falta, [], 'caixas que rolam na vertical sem overscroll-behavior:contain (ou com razão em EM_LINHA)');
  });

  test('as exceções existem, rolam, e cada uma tem a razão escrita', () => {
    for (const [sel, razao] of Object.entries(EM_LINHA)) {
      assert.ok(R.has(sel), sel + ' já não está na folha: sai da lista');
      assert.ok(rola(R.get(sel), 'y'), sel + ' já não rola na vertical: sai da lista');
      assert.ok(razao.length > 30, sel + ' tem a razão escrita');
    }
  });

  test('a lista de um sel(), o menu ⋯, a gaveta e o portão do email contêm', () => {
    for (const sel of ['.selpop', '.menupop', 'nav', '.email-portao', '.fpanel>.card', '.sheet .body']) {
      assert.ok(R.has(sel), sel + ' existe');
      assert.ok(rola(R.get(sel), 'y'), sel + ' rola na vertical');
      assert.ok(contem(R.get(sel), 'y'), sel + ' contém o fim');
    }
  });

  test('o que rola de lado contém o fim na horizontal (o voltar do browser fica de fora)', () => {
    const falta = [];
    for (const [sel, decl] of R) if (rola(decl, 'x') && !contem(decl, 'x')) falta.push(sel);
    assert.deepEqual(falta, [], 'caixas que rolam de lado sem overscroll-behavior-x:contain');
  });
});

describe('a lista curta', () => {
  /* Antes do Chrome 144, o contain numa caixa que não transborda não contava
     (o Samsung Internet 30 é um Chrome 143), e o traço por cima de uma lista
     de três opções rolava os movimentos. A lista e o menu perguntam se têm o
     que rolar (container-type scroll-state) e, sem nada, as opções não deixam
     arrastar. */
  test('a lista e o menu ⋯ são contentores de scroll-state', () => {
    assert.equal(R.get('.selpop')['container-type'], 'scroll-state');
    assert.equal(R.get('.menupop')['container-type'], 'scroll-state');
  });

  test('sem o que rolar, as opções não deixam arrastar; o pinch-zoom e o toque ficam', () => {
    const bloco = /@supports \(container-type:scroll-state\)\{\s*@container not scroll-state\(scrollable:y\)\{([^{}]+)\{([^{}]*)\}\s*\}\s*\}/.exec(folha);
    assert.ok(bloco, 'a regra vive num @supports: um browser que não pergunta não prende as listas compridas');
    const alvos = bloco[1].split(',').map((s) => s.trim());
    for (const s of ['.selopt', '.sdiv', '.menupop>button']) assert.ok(alvos.includes(s), s + ' entra na regra');
    assert.match(bloco[2], /^touch-action:pinch-zoom$/);
  });

  test('o touch-action das opções só muda nessa regra: com o que rolar, a lista rola', () => {
    for (const [sel, decl] of R) {
      if (!/\.selopt|\.menupop/.test(sel) || !decl['touch-action']) continue;
      assert.equal(sel, '.selopt,.sdiv,.menupop>button', 'só a regra da lista curta mexe no touch-action das opções');
    }
  });
});

/* Os ficheiros .js do web/, a percorrer à procura das camadas montadas em JS.
   Devolve: array de {f, txt}. */
function scriptsDaWeb() {
  const base = new URL('../web/', import.meta.url);
  return readdirSync(base, { recursive: true })
    .map((f) => String(f).replace(/\\/g, '/'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ f, txt: readFileSync(new URL(f, base), 'utf8') }));
}

describe('as camadas de ecrã inteiro feitas em JS', () => {
  /* O estilo delas é o cssText do JS (a CSP aceita-o; um style= no HTML, não),
     e por isso não passam pela folha: cada uma que rola diz o contain ali. */
  const camadas = [];
  for (const { f, txt } of scriptsDaWeb()) {
    for (const m of txt.matchAll(/\.style\.cssText\s*=\s*((?:'[^'\n]*'\s*\+?\s*)+)/g)) {
      const css = [...m[1].matchAll(/'([^'\n]*)'/g)].map((x) => x[1]).join('');
      // o id é o último dado antes do cssText (entre os dois pode haver um comentário comprido)
      const ids = [...txt.slice(Math.max(0, m.index - 900), m.index).matchAll(/\.id\s*=\s*'(\w+)'/g)];
      const id = ids.length ? ids[ids.length - 1][1] : '?';
      camadas.push({ f, id, css });
    }
  }

  test('acham-se as camadas da Ajuda, das Novidades e da entrada', () => {
    const ids = camadas.map((c) => c.id);
    for (const id of ['cwDoc', 'cwTerms', 'cwLegal', 'cwUpd', 'cwUpd2', 'cwRepor']) assert.ok(ids.includes(id), id + ' encontrada');
    assert.ok(camadas.some((c) => c.f === 'cloud/entrada.js' && /z-index:200/.test(c.css)), 'o ecrã de entrada (#cwAuth) encontrado');
  });

  test('cada camada que rola contém o fim', () => {
    const falta = camadas.filter((c) => /overflow(-y)?:(auto|scroll)/.test(c.css) && !/overscroll-behavior(-y)?:contain/.test(c.css))
      .map((c) => c.f + ' #' + c.id);
    assert.deepEqual(falta, [], 'camadas que rolam sem overscroll-behavior:contain');
  });
});
