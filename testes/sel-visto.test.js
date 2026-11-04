// O visto do menu de escolha (componentes.js:sel e selPick) acompanha a
// escolha. Ticket de QA d7da7025: no menu do tipo de produto da hipoteca,
// escolhesse-se o que se escolhesse, o visto ficava no «Seguro de vida». O
// selPick mudava o input escondido, o rótulo e o aria-selected, mas a classe
// on e o ícone do visto ficavam na opção que o sel() desenhou. Agora as duas
// desenham a opção pela mesma função (componentes.js:selOpcaoDesenho): depois
// de escolher, só a escolhida tem on, aria-selected="true" e o visto, e o
// desenho é o mesmo que o sel() faria com esse valor.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, igual, repor } from './arnes.js';

const app = carregarApp();
const VISTO = app.ic('check', 16);

/* Os atributos de uma etiqueta de abertura, como objeto.
   Recebe: s — o texto de dentro da etiqueta (sem < nem >).
   Devolve: {nome: valor}. */
const atributos = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

/* Um elemento de faz-de-conta com classes, atributos, miolo e foco a sério
   (o do arnês ignora as classes e os atributos).
   Recebe: attrs — os atributos iniciais; miolo — o innerHTML; focos — a lista onde o foco se regista.
   Devolve: o elemento. */
function elemento(attrs, miolo, focos) {
  const el = {
    attrs: Object.assign({}, attrs), id: attrs.id || '', innerHTML: miolo || '', value: attrs.value || '', textContent: '', style: {},
    offsetTop: 0, offsetHeight: 40, scrollTop: 0, clientHeight: 400, parentElement: null,
    get className() { return this.attrs.class || ''; },
    set className(v) { this.attrs.class = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    focus() { focos.push(el); },
    getBoundingClientRect: () => ({ top: 0, bottom: 40, left: 0, right: 100, width: 100, height: 40 }),
  };
  const cls = () => new Set(el.className.split(/\s+/).filter(Boolean));
  const poe = (s) => { el.className = [...s].join(' '); };
  el.classList = {
    contains: (c) => cls().has(c),
    add: (c) => { const s = cls(); s.add(c); poe(s); },
    remove: (c) => { const s = cls(); s.delete(c); poe(s); },
    toggle: (c, f) => { const s = cls(); const quer = f === undefined ? !s.has(c) : !!f; if (quer) s.add(c); else s.delete(c); poe(s); return quer; },
  };
  return el;
}

/* As opções de um HTML do sel(): cada <button class="selopt…">, com os
   atributos e o miolo.
   Recebe: html — o que o sel() devolveu.
   Devolve: [{attrs, miolo}]. */
const opcoesDoHtml = (html) => [...html.matchAll(/<button ([^>]*class="selopt[^"]*"[^>]*)>([\s\S]*?)<\/button>/g)]
  .map((m) => ({ attrs: atributos(m[1]), miolo: m[2] }));

/* Põe um sel() no DOM de faz-de-conta: o input escondido, o botão, o rótulo,
   a lista e as opções, cada um pelo id, como o browser os acharia.
   Recebe: id, valor, opcoes, onchange, toca — os argumentos do sel().
   Devolve: {html, inp, btn, lab, pop, opts, focos}. */
function montar(id, valor, opcoes, onchange, toca) {
  const html = app.sel(id, valor, opcoes, onchange, toca);
  const focos = [];
  const btn = elemento(atributos(html.match(/<button ([^>]*class="selbtn"[^>]*)>/)[1]), '', focos);
  const lab = elemento({ id: 'lab_' + id }, '', focos);
  const inp = elemento({ id, value: String(valor) }, '', focos);
  const opts = opcoesDoHtml(html).map((o) => elemento(o.attrs, o.miolo, focos));
  const pop = elemento({ id: 'pop_' + id, class: 'selpop' }, '', focos);
  pop.querySelectorAll = (s) => (s === '.selopt' ? opts : []);
  pop.parentNode = { querySelector: () => btn };
  pop.contains = () => false;
  const caixa = { querySelector: (s) => (s === '.selpop' ? pop : s === '.selbtn' ? btn : null) };
  [btn, ...opts].forEach((x) => { x.closest = (s) => (s === '.sel' ? caixa : null); });
  const porId = { [id]: inp, ['lab_' + id]: lab, ['selb_' + id]: btn, ['pop_' + id]: pop };
  app.document.getElementById = (x) => porId[x] || null;
  app.document.querySelectorAll = (s) => (/\.selpop\.on/.test(s) && pop.classList.contains('on') ? [pop] : []);
  return { html, inp, btn, lab, pop, opts, focos };
}

/* O estado que se vê de cada opção: com o on, com o aria-selected, com o visto.
   Recebe: opts — as opções do DOM de faz-de-conta.
   Devolve: [[on, aria-selected, visto]]. */
const estado = (opts) => opts.map((o) => [o.classList.contains('on'), o.getAttribute('aria-selected'), o.innerHTML.includes(VISTO)]);

const PRODUTOS = () => app.PRODUTOS_HIPOTECA.map((x) => ({ v: x.id, label: x.nome }));
let mudou;

beforeEach(() => {
  mudou = 0;
  app.liveLoanAll = () => { mudou++; };
});
afterEach(() => repor(app));

describe('o visto segue a escolha', () => {
  test('o menu do tipo de produto: escolher o Ordenado domiciliado leva o on, o aria-selected e o visto, e o Seguro de vida perde-os', () => {
    const s = montar('l_ptipo_pv', 'seguro_vida', PRODUTOS(), 'liveLoanAll', 'rascunho');
    igual(estado(s.opts)[0], [true, 'true', true], 'à entrada, o Seguro de vida é o escolhido');
    const i = app.PRODUTOS_HIPOTECA.findIndex((x) => x.id === 'ordenado');
    app.selPick(null, 'l_ptipo_pv', i);
    igual(s.inp.value, 'ordenado');
    igual(s.lab.textContent, 'Ordenado domiciliado');
    const depois = estado(s.opts);
    igual(depois[i], [true, 'true', true], 'a escolhida tem tudo');
    igual(depois.filter((x, j) => j !== i), depois.filter((x, j) => j !== i).map(() => [false, 'false', false]), 'e mais nenhuma');
    igual(mudou, 1, 'o onchange corre, uma vez');
  });

  test('escolher outra vez move tudo outra vez, com a linha separadora pelo meio (os índices contam com ela)', () => {
    const ops = [{ v: 'a', label: 'A' }, { div: true }, { v: 'b', label: 'B' }, { v: 'c', label: 'C' }];
    const s = montar('t', 'a', ops, '', 'vista');
    igual(s.opts.map((o) => o.getAttribute('data-i')), ['0', '2', '3']);
    app.selPick(null, 't', 3);
    igual(estado(s.opts), [[false, 'false', false], [false, 'false', false], [true, 'true', true]]);
    app.selPick(null, 't', 2);
    igual(estado(s.opts), [[false, 'false', false], [true, 'true', true], [false, 'false', false]]);
    app.selPick(null, 't', 2);
    igual(estado(s.opts), [[false, 'false', false], [true, 'true', true], [false, 'false', false]], 'a mesma outra vez não mexe');
  });

  test('um valor que não está nas opções não acende nenhuma; escolher acende só a escolhida', () => {
    const s = montar('t', 'zz', [{ v: 'a', label: 'A' }, { v: 'b', label: 'B' }]);
    igual(estado(s.opts), [[false, 'false', false], [false, 'false', false]]);
    app.selPick(null, 't', 1);
    igual(estado(s.opts), [[false, 'false', false], [true, 'true', true]]);
  });

  test('o desenho de cada opção depois do selPick é o que o sel() faria com o valor novo: uma função só', () => {
    const ops = [{ v: 'x', label: 'Xis <b>' }, { div: true }, { v: 'y', label: 'Ípsilon & cia' }, { v: 'z', label: 'Zê' }];
    const s = montar('t', 'x', ops, '', 'rascunho');
    app.selPick(null, 't', 3);
    const esperado = opcoesDoHtml(app.sel('t', 'z', ops, '', 'rascunho'));
    igual(s.opts.map((o) => [o.className.trim(), o.getAttribute('aria-selected'), o.innerHTML.trim()]),
      esperado.map((o) => [o.attrs.class.trim(), o.attrs['aria-selected'], o.miolo.trim()]));
    assert.match(s.opts[0].innerHTML, /Xis &lt;b&gt;/, 'o rótulo continua a passar pelo esc()');
    igual([s.opts[2].getAttribute('data-toca'), s.opts[2].getAttribute('data-click')], ['rascunho', "selPick(event,'t',3)"], 'a família e a ação ficam');
  });

  test('pelo teclado: escolher devolve o foco ao botão, e reabrir leva-o à opção escolhida agora', () => {
    const s = montar('t', 'a', [{ v: 'a', label: 'A' }, { v: 'b', label: 'B' }, { v: 'c', label: 'C' }]);
    const tecla = { detail: 0, stopPropagation() {} };
    app.selOpen(tecla, 't');
    assert.ok(s.pop.classList.contains('on'), 'abriu');
    assert.equal(s.focos[s.focos.length - 1], s.opts[0], 'na escolhida de antes');
    app.selPick(tecla, 't', 2);
    assert.ok(!s.pop.classList.contains('on'), 'fechou');
    assert.equal(s.focos[s.focos.length - 1], s.btn, 'o foco volta ao botão');
    app.selOpen(tecla, 't');
    assert.equal(s.focos[s.focos.length - 1], s.opts[2], 'reaberta, o foco vai à escolhida de agora');
    const r = app.selTecla({ key: 'ArrowUp', target: s.opts[2], preventDefault() {} });
    assert.ok(r);
    assert.equal(s.focos[s.focos.length - 1], s.opts[1], 'e as setas andam a partir dela');
  });

  test('o selPick não troca os botões das opções: o foco e os ouvintes ficam nos mesmos', () => {
    const s = montar('t', 'a', [{ v: 'a', label: 'A' }, { v: 'b', label: 'B' }]);
    const antes = s.opts.slice();
    app.selPick(null, 't', 1);
    assert.ok(s.pop.querySelectorAll('.selopt').every((o, j) => o === antes[j]));
  });
});
