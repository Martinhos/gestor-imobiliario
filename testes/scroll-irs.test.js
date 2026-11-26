// A página do IRS não rola inteira no telemóvel (KAN-166, ticket de QA
// 4eb8c497): os botões de um aviso do «A tratar antes de entregar»
// (fisco.js:fiscoObrigacoesCard) encolhem até à largura da linha, e os dois de
// um aviso com ação («Marcar as 10 como emitidas» e «Ver as rendas») partem em
// duas linhas. Com flex:0 0 auto a fila alargava o documento (407px num ecrã de
// 384) e o browser do telemóvel levava a página inteira, cabeçalho incluído, de
// lado e na vertical.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');

/* As declarações da regra com este seletor exato (a última, se houver mais).
   Recebe: sel — o seletor, como está na folha.
   Devolve: o texto entre as chavetas, ou '' sem a regra. */
function regra(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = [...css.matchAll(new RegExp('(?:^|[}\\n])\\s*' + esc + '\\s*\\{([^}]*)\\}', 'g'))];
  return m.length ? m[m.length - 1][1] : '';
}

test('a fila dos botões de um aviso encolhe até à largura da linha (os botões partem em linhas)', () => {
  const r = regra('.fis-ob .fis-ob-acoes');
  assert.ok(r, 'há a regra .fis-ob .fis-ob-acoes');
  assert.doesNotMatch(r, /flex:\s*0\s+0\s/, 'sem flex:0 0 — a fila não encolhia e passava a borda do cartão');
  assert.match(r, /flex:\s*0\s+1\s/);
  assert.match(r, /min-width:\s*0/);
  assert.match(r, /max-width:\s*100%/);
});

test('um botão sozinho num aviso também encolhe, e nunca passa a largura da linha', () => {
  const r = regra('.fis-ob .btn');
  assert.ok(r, 'há a regra .fis-ob .btn');
  assert.doesNotMatch(r, /flex:\s*0\s+0\s/);
  assert.match(r, /max-width:\s*100%/);
});
