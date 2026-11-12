// O aviso de baixo com o Anular do kanban (KAN-111, ticket de QA e20f2c66): ao
// remover um cartão, no telemóvel, o aviso ficava com metade do ecrã (o
// position:fixed com left:50% encolhe-se até à borda direita, 192px a 384) e o
// texto partia-se sílaba a sílaba numa coluna ao lado do Anular. Aqui: cada
// classe que o kbAvisarComAnular escreve tem regra no CSS do back office, o
// aviso tem a largura do conteúdo até ao teto, e o Anular tem 44px ao toque.
// O aspeto a sério, a 384×785 nos três temas, prova-se no browser, à parte.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CSS_EQUIPA } from '../worker/src/equipa-vista.js';
import { CSS_KANBAN } from '../worker/src/equipa-kanban.js';
import { caixa } from './lib/kanban-caixa.js';

const CSS = CSS_EQUIPA + CSS_KANBAN;

/* O corpo de cada regra que tem o seletor sozinho (sem descendentes nem
   estados), de fora ou de dentro de um @media.
   Recebe: css; seletor — por exemplo '.eq-toast'.
   Devolve: as declarações (array de texto). */
function regras(css, seletor) {
  const fora = seletor.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  const re = new RegExp('(?:^|[{},\\s])' + fora + '(?:,[^{]*)?\\{([^{}]*)\\}', 'g');
  return [...css.matchAll(re)].map((m) => m[1]);
}

/* O corpo de um @media (o primeiro com esta condição que tem o seletor).
   Recebe: css; cond — por exemplo 'pointer:coarse'; seletor.
   Devolve: as declarações do seletor dentro dele, ou ''. */
function noMedia(css, cond, seletor) {
  const partes = css.split('@media(' + cond + '){').slice(1);
  for (const p of partes) {
    // até ao fecho do @media: conta as chavetas
    let n = 1, i = 0;
    for (; i < p.length && n; i++) { if (p[i] === '{') n++; else if (p[i] === '}') n--; }
    const corpo = p.slice(0, i);
    const r = regras(corpo, seletor);
    if (r.length) return r.join(';');
  }
  return '';
}

describe('o aviso com o Anular', () => {
  const ctx = caixa();
  const aviso = { className: '', innerHTML: '' };
  ctx.el = (id) => (id === 'aviso' ? aviso : null);
  ctx.setTimeout = () => 0;
  ctx.kbAvisarComAnular('Cartão KAN-111 removido.', 'KAN-111');
  const classes = [...aviso.innerHTML.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/))
    .concat(aviso.className.split(/\s+/)).filter((c) => c && !/^i(-|$)/.test(c));

  test('escreve o texto, o Anular e o fechar, e mostra-se', () => {
    assert.equal(aviso.className, 'eq-toast on');
    assert.deepEqual([...new Set(classes)].sort(), ['eq-toast', 'eq-toast-txt', 'eq-toast-x', 'kb-anular', 'on']);
  });

  test('cada classe que o kanban escreve no aviso tem regra no CSS do back office', () => {
    for (const c of new Set(classes)) {
      if (c === 'on') { assert.match(CSS, /\.eq-toast\.on\{/, 'o .eq-toast.on'); continue; }
      assert.ok(regras(CSS, '.' + c).length, 'falta a regra de .' + c);
    }
  });

  test('o aviso tem a largura do conteúdo até ao teto, e não metade do ecrã', () => {
    const r = regras(CSS_EQUIPA, '.eq-toast').join(';');
    assert.match(r, /position:fixed/);
    assert.match(r, /left:50%/);
    // sem a largura, o shrink-to-fit de um fixed com left:50% só tem 50vw
    assert.match(r, /(?:^|;|\s)width:max-content/, 'o .eq-toast precisa de width:max-content');
    assert.match(r, /max-width:min\(560px,calc\(100vw - 32px\)\)/, 'o teto: 560px, ou o ecrã menos 16px de cada lado');
    // o texto é o que encolhe e quebra; os botões não
    assert.match(regras(CSS_EQUIPA, '.eq-toast-txt').join(';'), /flex:1;min-width:0/);
    assert.match(regras(CSS_KANBAN, '.kb-anular').join(';'), /flex:none/);
    assert.match(regras(CSS_EQUIPA, '.eq-toast-x').join(';'), /flex:none/);
  });

  test('o Anular é um botão da casa: contorno na cor da frente, letra herdada, e 44px ao toque', () => {
    const r = regras(CSS_KANBAN, '.kb-anular').join(';');
    assert.match(r, /border:1px solid currentColor/, 'o contorno na cor da frente (sobrevive ao escuro forçado do Samsung)');
    assert.match(r, /color:inherit/);
    assert.match(r, /min-height:36px/);
    assert.match(CSS_EQUIPA, /button,input,textarea\{font:inherit;color:inherit\}/, 'a letra da casa nos botões');
    assert.match(noMedia(CSS_KANBAN, 'pointer:coarse', '.kb-anular'), /min-height:44px/, 'o Anular com 44px ao toque');
    assert.match(noMedia(CSS_EQUIPA, 'pointer:coarse', '.eq-toast-x'), /width:44px;height:44px/, 'o fechar com 44px ao toque');
  });

  test('o :hover do Anular só com rato', () => {
    const fora = CSS_KANBAN.replace(/@media\(hover:hover\) and \(pointer:fine\)\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    assert.doesNotMatch(fora, /\.kb-anular:hover/);
    assert.match(CSS_KANBAN, /\.kb-anular:hover\{/);
  });
});
