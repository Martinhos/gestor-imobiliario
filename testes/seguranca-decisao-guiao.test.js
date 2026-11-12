// O cartão «Por decidir» de um ticket de segurança, no back office, tem as
// mesmas duas ações dos pedidos das pessoas: Recusar e Aceitar (KAN-114), e
// o detalhe e a linha da lista dizem «aceite» e «recusado». Corre o guião
// servido pelo /equipa/guiao.js numa página de faz-de-conta e pinta o
// detalhe e a linha de um ticket de segurança em cada estado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { GUIAO } from '../worker/src/equipa-guiao.js';
import { paginaEquipa } from '../worker/src/equipa-vista.js';
import { MASTER } from './lib/equipa.js';

/* Carrega o guião num contexto com o mínimo que o arranque toca (o documento
   ainda a ler-se, para não arrancar a navegação).
   Devolve: {detalhe(p), linha(p), ctx}. */
async function guiao() {
  const html = await new Response(paginaEquipa(MASTER).body).text();
  const dados = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(html)[1];
  const els = {};
  const el = (id) => els[id] || (els[id] = {
    id, innerHTML: '', textContent: id === 'dados-equipa' ? dados : '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
  });
  const ctx = vm.createContext({
    document: { readyState: 'loading', getElementById: el, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], body: el('body'), documentElement: el('html') },
    window: {}, location: { hash: '' }, history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }), setTimeout, clearTimeout,
  });
  vm.runInContext(GUIAO, ctx);
  const detalhePedido = vm.runInContext('detalhePedido', ctx), linhaPedido = vm.runInContext('linhaPedido', ctx);
  return {
    ctx,
    detalhe: (p) => detalhePedido({ pedido: p, msgs: [], quem: null }, 'erros', false),
    linha: (p) => linhaPedido(p, false),
  };
}

const SEG = { id: 'abc12345', category: 'seguranca', subject: 'Limite atingido: gravações de dados · conta U1', body: 'Chave: w:U1', status: 'criado', created_at: 1, n: 1 };

describe('o ticket de segurança decide-se com Recusar e Aceitar', () => {
  test('por decidir: os botões são Recusar e Aceitar, sem Decidir nem Arquivar', async () => {
    const g = await guiao();
    const h = g.detalhe(SEG);
    const botoes = /<div class="pd-decisao-botoes">([\s\S]*?)<\/div>/.exec(h)[1];
    assert.equal(botoes,
      '<button type="button" class="btn" data-acao="recusarSeguranca" data-arg="abc12345">Recusar</button>' +
      '<button type="button" class="btn primary" data-acao="aceitarSeguranca" data-arg="abc12345">Aceitar</button>');
    assert.match(h, /<span class="pd-decisao-tit">Por decidir<\/span>/);
    assert.match(h, /Recusar conclui-o, com a justificação\./);
    assert.doesNotMatch(h, /Decidir|Arquivar|arquiv/);
    assert.match(g.linha(SEG), / · por decidir · /);
  });

  test('as ações existem no guião com os nomes novos', async () => {
    const g = await guiao();
    for (const n of ['aceitarSeguranca', 'recusarSeguranca']) assert.equal(vm.runInContext('typeof ' + n, g.ctx), 'function', n);
    for (const n of ['decidirSeguranca', 'arquivarSeguranca']) assert.equal(vm.runInContext('typeof ' + n, g.ctx), 'undefined', n);
    assert.match(GUIAO, /aceitarSeguranca: function \(d\) \{ aceitarSeguranca\(d\.arg\); \}/);
    assert.match(GUIAO, /recusarSeguranca: function \(d\) \{ recusarSeguranca\(d\.arg\); \}/);
  });

  test('aceite: «Aceite por» no detalhe e «· aceite» na lista', async () => {
    const g = await guiao();
    const p = { ...SEG, accepted_at: 2, accepted_by_nome: 'Dina', accepted_changes: 'Subir o limite.' };
    assert.match(g.detalhe(p), /Aceite por Dina · /);
    assert.match(g.linha(p), / · aceite · /);
    assert.doesNotMatch(g.detalhe(p) + g.linha(p), />[^<]*[Dd]ecidid/, 'o texto (a classe pd-decidido é só do estilo)');
  });

  test('recusado: «Recusado por» no detalhe e «· recusado» na lista', async () => {
    const g = await guiao();
    const p = { ...SEG, status: 'concluido', refused_at: 2, refused_by_nome: 'Dina' };
    assert.match(g.detalhe(p), /Recusado por Dina · [^<]*\(a justificação está na nota interna acima\)/);
    assert.match(g.linha(p), / · recusado · /);
    assert.doesNotMatch(g.detalhe(p) + g.linha(p), /[Aa]rquivad/);
  });
});
