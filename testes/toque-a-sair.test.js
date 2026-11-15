// KAN-140: enquanto uma janela ainda sai do ecrã, a de baixo já é a de cima e
// o X dela está no mesmo sítio — os toques seguidos no X fechavam as janelas
// de baixo, uma a uma, e o terceiro abria o «Sair sem guardar?» da que estava
// por baixo de todas, com a primeira ainda à vista. Até ao fim da saída, os
// cliques de um dedo ou de um rato engolem-se (componentes.js:cliqueASair);
// o teclado, o «voltar» e a automação não.
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => { app.modalStack.length = 0; });
afterEach(() => repor(app));
const clique = (isTrusted = true) => ({ isTrusted });
/* Uma camada da pilha com o que o closeModal, o fecharComSaida e o promote
   leem de uma janela. Recebe: title. Devolve: a camada ({el, title}). */
function camada(title) {
  const classes = new Set(['modal', 'open']);
  const el = {
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    setAttribute() {}, removeAttribute() {}, querySelector: () => null, querySelectorAll: () => [], remove() { el.removido = true; },
  };
  return { el, title, tocado: false, snap: null };
}

describe('os toques a meio da saída de uma janela (KAN-140)', () => {
  test('o tempo da saída: o --medio e a folga; sem movimento, nenhum', () => {
    const [sm, md] = [app.semMovimento, app.msDoToken];
    try {
      app.semMovimento = () => false;
      app.msDoToken = (nome, omissao) => (nome === '--medio' ? 240 : omissao);
      assert.equal(app.saidaAte(1000), 1360);
      app.semMovimento = () => true;
      assert.equal(app.saidaAte(1000), 1000);
    } finally { app.semMovimento = sm; app.msDoToken = md; }
  });

  test('fechar uma janela engole os cliques até ao fim da saída', () => {
    const sm = app.semMovimento;
    try {
      app.semMovimento = () => false;
      app.modalStack.push(camada('Tarefas'), camada('Ticket de QA'));
      assert.equal(app.cliqueASair(clique(), Date.now()), false, 'com as duas abertas, os toques passam');
      app.closeModal('x');
      const agora = Date.now();
      assert.equal(app.modalStack.length, 1, 'só o ticket fechou');
      assert.equal(app.cliqueASair(clique(), agora + 50), true, 'o segundo toque no X, a meio da saída, engole-se');
      assert.equal(app.cliqueASair(clique(false), agora + 50), false, 'um clique da própria app não');
      assert.equal(app.cliqueASair(clique(), agora + 2000), false, 'depois da saída, os toques voltam');
      app.closeModal('x');
      assert.equal(app.modalStack.length, 0);
    } finally { app.semMovimento = sm; }
  });

  test('sob automação (navigator.webdriver), nada se engole', () => {
    const sm = app.semMovimento;
    const nav = app.navigator;
    try {
      app.semMovimento = () => false;
      app.modalStack.push(camada('Uma'));
      app.closeModal();
      Object.defineProperty(nav, 'webdriver', { value: true, configurable: true });
      assert.equal(app.cliqueASair(clique(), Date.now() + 10), false);
    } finally {
      try { delete nav.webdriver; } catch (e) { /* fica */ }
      app.semMovimento = sm;
    }
  });
});
