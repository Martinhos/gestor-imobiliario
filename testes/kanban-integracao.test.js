// O kanban da equipa ligado ao resto do back office: o detalhe de um pedido
// aceite leva ao cartão dele (o «Cartão KAN-N»), só no dev; e a página do dev
// carrega o guião do kanban a seguir ao guião principal, que o abre como
// primeira secção.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { paginaEquipa } from '../worker/src/equipa-vista.js';
import { recursoDePagina } from '../worker/src/paginas-recursos.js';
import { MASTER, SUPORTE } from './lib/equipa.js';

const assentar = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };

/* Corre os guiões do back office (o principal e, no dev, o do kanban) numa
   página de faz-de-conta, com a rede a responder vazio.
   Recebe: eu — a sessão de equipa; qa — o ENV_NAME ('' na produção).
   Devolve: o contexto do vm, com as funções dos guiões. */
async function correr(eu, qa) {
  const html = await new Response(paginaEquipa(eu, qa ? { qa } : undefined).body).text();
  const dados = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(html)[1];
  const els = { 'dados-equipa': { textContent: dados } };
  const el = (id) => els[id] || (els[id] = {
    id, innerHTML: '', className: '', value: '', inert: false, classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    setAttribute() {}, getAttribute: () => null, focus() {}, showModal() {}, close() {}, querySelector: () => null, querySelectorAll: () => [],
  });
  const ctx = vm.createContext({
    document: {
      title: '', readyState: 'complete', body: el('body'), documentElement: el('html'), getElementById: el,
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    },
    location: { hash: '', reload() {} },
    history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    getComputedStyle: () => ({ position: 'sticky' }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}, setTimeout, clearTimeout, console,
    fetch: async () => new Response('{}', { status: 200 }),
    requestAnimationFrame: (f) => setTimeout(f, 0), navigator: {},
  });
  ctx.window = ctx;
  vm.runInContext(await (await recursoDePagina('/equipa/guiao.js', 'GET', async () => true)).text(), ctx);
  if (qa) {
    assert.match(html, /<script src="\/equipa\/guiao\.js"><\/script>\s*<script src="\/equipa\/kanban\.js"><\/script>/, 'o kanban vem a seguir ao guião');
    vm.runInContext(await (await recursoDePagina('/equipa/kanban.js', 'GET', async () => true)).text(), ctx);
  }
  await assentar();
  return ctx;
}

// um pedido aceite de uma pessoa, como o GET /api/equipa/pedidos/:id o devolve
const PEDIDO = {
  pedido: { id: 'aaaabbbb-1', category: 'user', kind: 'sugestao', subject: 'Exportar em PDF', body: 'Queria exportar.', status: 'criado', created_at: 1, accepted_at: 2 },
  quem: { id: 'U1', nome: 'Maria' }, msgs: [],
};

describe('o pedido e o seu cartão', () => {
  test('no dev, o detalhe de um pedido com cartão leva lá, pelo endereço do kanban', async () => {
    const ctx = await correr(SUPORTE, 'dev');
    const html = ctx.detalhePedido(Object.assign({ cartao: 'KAN-79' }, PEDIDO), 'pessoas', false);
    assert.match(html, /No kanban: <button type="button" class="ligacao" data-acao="ir" data-arg="kanban" data-arg2="KAN-79">Cartão KAN-79<\/button>/);
    assert.doesNotMatch(ctx.detalhePedido(PEDIDO, 'pessoas', false), /No kanban/, 'sem cartão, nada');
  });

  test('na produção não há kanban, e o detalhe não fala dele mesmo que viesse a chave', async () => {
    const ctx = await correr(MASTER, '');
    assert.doesNotMatch(ctx.detalhePedido(Object.assign({ cartao: 'KAN-79' }, PEDIDO), 'pessoas', false), /kanban|KAN-79/i);
  });

  test('no dev, o guião do kanban define o que o guião principal chama', async () => {
    const ctx = await correr(MASTER, 'dev');
    assert.equal(typeof ctx.verKanban, 'function', 'verKanban');
    assert.equal(typeof ctx.novoCartao, 'function', 'novoCartao');
    assert.equal(typeof ctx.marcarEndereco, 'function', 'e o guião principal dá o marcarEndereco');
  });
});
