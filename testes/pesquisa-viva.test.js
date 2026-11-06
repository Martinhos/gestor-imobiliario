// A pesquisa onde se está a escrever não sai do documento quando a vista se
// repinta (ticket de QA ebd1bce7). O render punha a vista inteira por
// innerHTML, e a via parcial dos Movimentos levava o campo para o molde: o
// campo saía do documento a meio da palavra, o teclado do telemóvel perdia a
// composição e voltava a metê-la no campo novo — o texto saltava, duplicava-se
// e, no Samsung, a app congelava. A barra da pesquisa (.mov-barra, filha direta
// do #view) fica, e o resto troca-se à volta dela.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));

/* Um nó de faz-de-conta que sabe quem é o pai e quais são os filhos, e conta
   as vezes que saiu do documento (sair).
   Recebe: nome — para se ler nas falhas; opcoes — {cls, id (do input), funil}.
   Devolve: o nó. */
function no(nome, opcoes = {}) {
  const n = {
    nome, pai: null, children: [], sair: 0, innerHTMLPosto: 0, tagName: opcoes.tag || 'DIV', id: opcoes.inputId && opcoes.tag === 'INPUT' ? opcoes.inputId : '',
    style: { setProperty() {}, removeProperty() {} }, dataset: {},
    classList: { contains: (c) => (opcoes.cls || []).includes(c), add() {}, remove() {}, toggle() {} },
    get outerHTML() { return opcoes.funil || ''; },
    set innerHTML(h) { this.innerHTMLPosto++; this.children.forEach((f) => { f.pai = null; f.sair++; }); this.children = []; },
    get innerHTML() { return ''; },
    appendChild(x) { if (x.pai) x.pai._tira(x); x.pai = this; this.children.push(x); return x; },
    insertBefore(x, ref) { if (x.pai) x.pai._tira(x); x.pai = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, x); return x; },
    _tira(x) { const i = this.children.indexOf(x); if (i > -1) this.children.splice(i, 1); x.pai = null; x.sair++; },
    remove() { if (this.pai) this.pai._tira(this); },
    replaceWith(x) { const p = this.pai; if (!p) return; p.insertBefore(x, this); p._tira(this); },
    contains(x) { for (let a = x; a; a = a.pai) if (a === this) return true; return false; },
    querySelector(s) {
      const todos = [];
      const anda = (r) => r.children.forEach((f) => { todos.push(f); anda(f); });
      anda(this);
      if (s === 'input') return todos.find((f) => f.tagName === 'INPUT') || null;
      if (s === '.mov-filt') return todos.find((f) => f.classList.contains('mov-filt')) || null;
      return null;
    },
    querySelectorAll: () => [], getAttribute: () => null, setAttribute() {}, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, closest: () => null, focus() {}, blur() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }),
    insertAdjacentHTML() {}, scrollIntoView() {}, replaceChildren(...xs) { this.children.slice().forEach((f) => this._tira(f)); xs.forEach((x) => this.appendChild(x)); },
  };
  return n;
}
/* Uma barra da pesquisa: a .mov-barra com o campo e o funil.
   Recebe: id — o id do campo; funil — o outerHTML do funil; extra — classes da barra.
   Devolve: {barra, campo, funil}. */
function barraCom(id, funil, extra = []) {
  const barra = no('barra ' + id + ' ' + funil, { cls: ['mov-barra', ...extra] });
  const busca = no('busca', { cls: ['mov-busca'] });
  const campo = no('campo ' + id, { tag: 'INPUT', inputId: id });
  const f = no('funil ' + funil, { cls: ['mov-filt'], funil });
  barra.appendChild(busca); busca.appendChild(campo); barra.appendChild(f);
  barra.sair = 0; busca.sair = 0; campo.sair = 0; f.sair = 0;
  return { barra, campo, funil: f };
}
const nomes = (r) => r.children.map((x) => x.nome);
/* O molde do createElement: os filhos entram quando lhe escrevem o innerHTML,
   como o browser faria com o HTML da vista nova.
   Recebe: filhos — uma função que devolve os nós da vista nova.
   Devolve: o molde. */
function moldeCom(filhos) {
  const m = no('molde');
  Object.defineProperty(m, 'innerHTML', { configurable: true, get: () => '', set: () => { filhos().forEach((x) => m.appendChild(x)); } });
  return m;
}

describe('a barra da pesquisa com o foco fica de uma pintura para a seguinte', () => {
  test('só fica a barra cujo campo tem o foco, com o mesmo campo na vista nova; o funil acompanha', () => {
    const v = no('#view'), molde = no('molde');
    const viva = barraCom('tx_q', '<b>0</b>'), nova = barraCom('tx_q', '<b>2</b>');
    v.appendChild(viva.barra); molde.appendChild(nova.barra);
    const r = app.barraDaPesquisaViva(v, molde, viva.campo, 'mov-barra');
    assert.equal(r.vivo, viva.barra);
    assert.equal(r.novo, nova.barra);
    assert.equal(viva.barra.querySelector('.mov-filt'), nova.funil, 'o funil conta outra coisa: troca-se pelo novo');
    assert.equal(viva.campo.pai.pai, viva.barra, 'o campo fica onde estava');
    assert.equal(app.barraDaPesquisaViva(v, molde, no('outro', { tag: 'INPUT', inputId: 'x' }), 'mov-barra'), null, 'o foco noutro sítio: nada fica');
    const outra = no('molde 2'); outra.appendChild(barraCom('lq_lprops', '<b>0</b>').barra);
    assert.equal(app.barraDaPesquisaViva(v, outra, viva.campo, 'mov-barra'), null, 'outra pesquisa: nada fica');
  });

  test('a vista nova entra à volta da barra viva, pela ordem do molde, e a barra nunca sai do documento', () => {
    const v = no('#view'), molde = no('molde');
    const viva = barraCom('tx_q', '<b>0</b>'), nova = barraCom('tx_q', '<b>0</b>');
    v.appendChild(no('abas velhas')); v.appendChild(viva.barra); v.appendChild(no('chips velhos')); v.appendChild(no('lista velha'));
    molde.appendChild(no('abas')); molde.appendChild(nova.barra); molde.appendChild(no('chips')); molde.appendChild(no('Nada neste filtro'));
    app.trocarAVoltaDaBarra(v, molde, { vivo: viva.barra, novo: nova.barra });
    assert.deepEqual(nomes(v), ['abas', viva.barra.nome, 'chips', 'Nada neste filtro']);
    assert.equal(viva.barra.sair, 0, 'a barra não saiu');
    assert.equal(viva.campo.sair, 0, 'o campo não saiu');
  });

  test('pintarAVoltaDaPesquisa: com o foco na pesquisa põe a vista à volta dela; sem ele não faz nada', () => {
    const v = no('#view');
    const viva = barraCom('lq_lprops', '<b>1</b>', ['lfm-barra']);
    v.appendChild(viva.barra); v.appendChild(no('lista velha'));
    const nova = barraCom('lq_lprops', '<b>1</b>', ['lfm-barra']);
    let pedidos = 0;
    app.document.createElement = () => { pedidos++; return moldeCom(() => [no('abas'), nova.barra, no('cartões novos')]); };
    app.document.activeElement = viva.campo;
    assert.equal(app.pintarAVoltaDaPesquisa(v, '<qualquer/>'), true);
    assert.deepEqual(nomes(v), ['abas', viva.barra.nome, 'cartões novos']);
    assert.equal(viva.campo.sair, 0);
    app.document.activeElement = no('um botão', { tag: 'BUTTON' });
    pedidos = 0;
    assert.equal(app.pintarAVoltaDaPesquisa(v, '<qualquer/>'), false, 'sem o foco na pesquisa: o render faz o de sempre');
    assert.equal(pedidos, 0, 'e nem monta o molde');
    app.document.activeElement = no('campo de fora', { tag: 'INPUT', inputId: 'lq_lprops' });
    assert.equal(app.pintarAVoltaDaPesquisa(v, '<qualquer/>'), false, 'um campo fora do #view não conta');
  });

  test('o render não tira do documento a pesquisa onde se está a escrever (e, sem foco nela, pinta como sempre)', () => {
    const v = app.document.getElementById('view');
    const fake = no('#view');
    Object.assign(v, { children: fake.children, contains: fake.contains, appendChild: fake.appendChild, insertBefore: fake.insertBefore, _tira: fake._tira });
    let postos = 0;
    Object.defineProperty(v, 'innerHTML', { configurable: true, get: () => '', set: () => { postos++; v.children.slice().forEach((f) => v._tira(f)); } });
    const viva = barraCom('tx_q', '<b>0</b>');
    v.appendChild(viva.barra); v.appendChild(no('lista velha'));
    viva.barra.sair = 0; viva.campo.sair = 0;
    app.document.createElement = () => moldeCom(() => [barraCom('tx_q', '<b>0</b>').barra, no('Nada neste filtro')]);
    app.document.activeElement = viva.campo;
    app.tab = 'transactions';
    app.render();
    assert.equal(postos, 0, 'a vista não entrou por innerHTML');
    assert.ok(v.contains(viva.campo), 'o campo vivo continua no #view');
    assert.equal(viva.campo.sair, 0, 'e nunca saiu');
    app.document.activeElement = null;
    app.render();
    assert.equal(postos, 1, 'sem foco na pesquisa, o render põe a vista por innerHTML, como sempre');
  });
});
