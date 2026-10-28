// No telemóvel o selo da sincronização é o ícone, e só duas frases descem
// para a faixa por baixo do cabeçalho: «Sem ligação» (.fora) e a nova
// tentativa que vem dele (.tenta). O «N alterações por enviar» (.pend) fica
// só o ícone cobalto: cada gravação passa por ele e logo a seguir pelo
// «Guardado», e a faixa a entrar e a sair fazia o cabeçalho saltar a cada
// gravação. Prova as regras do bloco do telemóvel em estilos.css
// (header.top:has(>.sync.…) e o span absoluto da faixa).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// sem os comentários, e com as linhas normalizadas (metade da árvore é CRLF)
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// as regras de topo e as de dentro de um @media, como [seletor, corpo]
function regras(texto) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(texto))) out.push([m[1].trim().replace(/^@media[^{]*\{/, '').trim(), m[2]]);
  return out;
}

const todas = regras(css);

// a regra que faz o cabeçalho crescer o que a faixa ocupa
const crescer = todas.filter(([s, c]) => /header\.top:has\(/.test(s) && /\.sync\./.test(s) && /padding-bottom:40px/.test(c));
// a regra que põe a frase na faixa absoluta, a toda a largura
const faixa = todas.filter(([s, c]) => /header\.top \.sync\.\w+ span/.test(s) && /position:absolute/.test(c));

describe('a faixa do selo no telemóvel', () => {
  test('há uma regra que faz o cabeçalho crescer e uma que põe a frase na faixa', () => {
    assert.equal(crescer.length, 1, 'o padding-bottom do header.top: ' + crescer.map((r) => r[0]).join(' | '));
    assert.equal(faixa.length, 1, 'o span absoluto da faixa: ' + faixa.map((r) => r[0]).join(' | '));
  });

  test('o «por enviar» não faz o cabeçalho crescer nem desce para a faixa', () => {
    crescer.forEach(([s]) => assert.doesNotMatch(s, /\.sync\.pend\b/, 'o padding-bottom: ' + s));
    faixa.forEach(([s]) => assert.doesNotMatch(s, /\.sync\.pend\b/, 'o span da faixa: ' + s));
    assert.doesNotMatch(css, /header\.top \.sync\.pend span\{/, 'nenhuma regra pinta a faixa do «por enviar»');
  });

  test('o «Sem ligação» e a nova tentativa continuam com a faixa', () => {
    ['fora', 'tenta'].forEach((c) => {
      const re = new RegExp('\\.sync\\.' + c + '\\b');
      assert.ok(crescer.some(([s]) => re.test(s)), 'o .' + c + ' faz o cabeçalho crescer');
      assert.ok(faixa.some(([s]) => re.test(s)), 'o .' + c + ' desce para a faixa');
    });
    assert.match(css, /header\.top \.sync\.fora span\{background:var\(--danger-soft\);color:var\(--danger\)\}/);
    assert.match(css, /header\.top \.sync\.tenta span\{background:var\(--out-soft\);color:var\(--out\)\}/);
  });

  test('no telemóvel a frase do selo esconde-se, e o computador fica com ela ao lado do ícone', () => {
    assert.match(css, /header\.top \.sync span\{display:none\}/, 'no telemóvel o selo é o ícone');
    assert.match(css, /\.sync\.pend\{background:var\(--accent-soft\);color:var\(--accent-text\)\}/, 'o cobalto do «por enviar»');
    assert.match(css, /\n\.sync\{display:inline-flex;[^}]*white-space:nowrap\}/, 'no computador o selo é o ícone com a frase');
  });
});
