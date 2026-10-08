// Os estilos calculados (web/app/estilos-calculados.js): os valores que vêm
// dos dados — a largura de uma barra, a cor de uma série, o atraso da onda de
// um gráfico — em atributos data-*, validados e aplicados pelo CSSOM, no
// lugar dos style="…" com ${…} que a CSP sem 'unsafe-inline' deixa de aceitar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { carregarApp } from './arnes.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CODIGO = fs.readFileSync(path.join(AQUI, '..', 'web', 'app', 'estilos-calculados.js'), 'utf8');

/* Um elemento de faz-de-conta com um style que guarda o que lhe escrevem.
   Recebe: attrs (opcional) — os atributos; filhos (opcional).
   Devolve: o elemento. */
function elemento(attrs = {}, filhos = []) {
  const props = {};
  return {
    nodeType: 1, attrs: { ...attrs }, filhos, props,
    style: { setProperty(k, v) { props[k] = v; }, removeProperty(k) { delete props[k]; } },
    getAttribute(a) { return Object.prototype.hasOwnProperty.call(this.attrs, a) ? this.attrs[a] : null; },
    querySelectorAll(sel) {
      const nomes = sel.split(',').map((s) => s.slice(1, -1));
      const out = [];
      const anda = (el) => el.filhos.forEach((x) => { if (nomes.some((n) => x.getAttribute(n) != null)) out.push(x); anda(x); });
      anda(this);
      return out;
    },
  };
}

/* O ficheiro carregado num contexto com um MutationObserver de faz-de-conta.
   Recebe: nada.
   Devolve: {ctx, observadores, doc} — os observadores criados, com o que
   observam e a função que o browser chamaria. */
function contexto() {
  const observadores = [];
  const doc = { documentElement: elemento(), querySelectorAll: () => [] };
  const MutationObserver = class { constructor(cb) { this.cb = cb; observadores.push(this); } observe(alvo, op) { this.alvo = alvo; this.op = op; } };
  const ctx = vm.createContext({ document: doc, MutationObserver });
  vm.runInContext(CODIGO, ctx);
  return { ctx, observadores, doc };
}

describe('os valores validam-se antes de se aplicarem', () => {
  const { ctx } = contexto();

  test('a largura: uma percentagem de 0 a 100', () => {
    for (const [v, r] of [['0', '0%'], ['37.5', '37.5%'], ['100', '100%'], ['100.0', '100.0%']]) assert.equal(ctx.estiloLargura(v), r, v);
    for (const v of ['101', '-1', '1e2', '50%', '50px', '', ' 5', 'calc(1px)', '5;color:red', 'NaN']) assert.equal(ctx.estiloLargura(v), null, v);
  });

  test('a cor: #hex, rgb()/hsl() com números, ou var(--nome)', () => {
    for (const v of ['#fff', '#ffff', '#2f7d5b', '#2f7d5bcc', 'rgb(1,2,3)', 'rgba(1, 2, 3, .5)', 'rgb(1 2 3 / 50%)', 'hsl(120deg 50% 50%)', 'hsla(120,50%,50%,0.3)', 'var(--danger)', 'var(--accent-soft)']) {
      assert.equal(ctx.estiloCor(v), v, v);
    }
    for (const v of ['red', '#ggg', '#12345', 'url(x)', 'var(--a);background:url(x)', 'rgb(1,2,3);x', 'expression(alert(1))', 'var(--a) url(x)', 'rgb(a,b,c)', '', 'javascript:1']) {
      assert.equal(ctx.estiloCor(v), null, v);
    }
  });

  test('as paletas da app passam todas', () => {
    const app = carregarApp();
    for (const c of [...app.PAL_LIGHT, ...app.PAL_DARK, 'var(--danger)', 'var(--accent)']) assert.equal(app.estiloCor(c), c, c);
  });

  test('o atraso: milissegundos inteiros, até dez segundos', () => {
    for (const [v, r] of [['0', '0ms'], ['30', '30ms'], ['150ms', '150ms'], ['10000', '10000ms']]) assert.equal(ctx.estiloAtraso(v), r, v);
    for (const v of ['-1', '1.5', '10001', '1s', 'animation-delay:30ms', '', '30 ms']) assert.equal(ctx.estiloAtraso(v), null, v);
  });
});

describe('a aplicação', () => {
  test('o que passa escreve-se no el.style; o que não passa não', () => {
    const { ctx } = contexto();
    const el = elemento({ 'data-largura': '42.5', 'data-fundo': 'var(--accent)', 'data-atraso': 'mau' });
    ctx.aplicarEstiloCalculado(el);
    assert.deepEqual({ ...el.props }, { width: '42.5%', background: 'var(--accent)' });
  });

  test('um atributo que sai, ou que deixa de passar, tira o que tinha posto — e só isso', () => {
    const { ctx } = contexto();
    const el = elemento({ 'data-largura': '10', 'data-fundo': '#fff' });
    el.props.color = 'red';                // escrito pela app, à mão
    el.props['animation-delay'] = '5ms';   // idem, sem atributo
    ctx.aplicarEstiloCalculado(el);
    delete el.attrs['data-largura'];
    el.attrs['data-fundo'] = 'url(x)';
    ctx.aplicarEstiloCalculado(el);
    assert.deepEqual({ ...el.props }, { color: 'red', 'animation-delay': '5ms' }, 'saíram a largura e o fundo; o resto ficou');
  });

  test('o observador vigia o documento inteiro, só estes atributos', () => {
    const { observadores, doc } = contexto();
    assert.equal(observadores.length, 1);
    const [o] = observadores;
    assert.equal(o.alvo, doc.documentElement);
    assert.deepEqual(JSON.parse(JSON.stringify(o.op)), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-largura', 'data-fundo', 'data-atraso'] });
  });

  test('os elementos que entram, e os que mudam de atributo, recebem os valores', () => {
    const { observadores } = contexto();
    const neto = elemento({ 'data-atraso': '60' });
    const filho = elemento({ 'data-largura': '75' }, [neto]);
    const entra = elemento({}, [filho]);
    const texto = { nodeType: 3 };
    observadores[0].cb([{ type: 'childList', addedNodes: [texto, entra] }]);
    assert.equal(filho.props.width, '75%');
    assert.equal(neto.props['animation-delay'], '60ms', 'também lá dentro');
    filho.attrs['data-largura'] = '20';
    observadores[0].cb([{ type: 'attributes', target: filho, attributeName: 'data-largura' }]);
    assert.equal(filho.props.width, '20%');
  });

  test('sem MutationObserver (o arnês dos testes), carrega e não faz nada', () => {
    const app = carregarApp();
    assert.equal(typeof app.aplicarEstilosCalculados, 'function');
    assert.equal(app.vigiarEstilosCalculados(app.document), null);
  });
});

/* As mesmas funções, mas na app carregada pelo arnês — que é a que conta: a
   cobertura do CI só vê os módulos carregados pelo endereço file:// de cada um
   (arnes.js:carregarEm), e o contexto de vm lá de cima corre o ficheiro à
   parte, fora dessa conta. */
describe('no arnês', () => {
  test('as três regras validam o valor', () => {
    const app = carregarApp();
    assert.equal(app.estiloLargura('37.5'), '37.5%');
    assert.equal(app.estiloLargura('101'), null);
    assert.equal(app.estiloAtraso('30'), '30ms');
    assert.equal(app.estiloAtraso('1s'), null);
    assert.equal(app.estiloCor('url(x)'), null);
  });

  test('o que passa escreve-se no el.style; o que sai, ou deixa de passar, tira-se', () => {
    const app = carregarApp();
    const el = elemento({ 'data-largura': '42.5', 'data-fundo': 'var(--accent)', 'data-atraso': 'mau' });
    app.aplicarEstiloCalculado(el);
    assert.deepEqual({ ...el.props }, { width: '42.5%', background: 'var(--accent)' }, 'o atraso não passou');
    delete el.attrs['data-largura'];
    app.aplicarEstiloCalculado(el);
    assert.deepEqual({ ...el.props }, { background: 'var(--accent)' }, 'o atributo que saiu levou o que tinha posto');
    assert.doesNotThrow(() => app.aplicarEstiloCalculado(null), 'sem elemento, não faz nada');
  });

  test('a raiz e tudo o que está dentro dela, e os lotes do observador', () => {
    const app = carregarApp();
    const neto = elemento({ 'data-atraso': '60' });
    const filho = elemento({ 'data-largura': '75' }, [neto]);
    const raiz = elemento({}, [filho]);
    app.aplicarEstilosCalculados(raiz);
    assert.equal(filho.props.width, '75%');
    assert.equal(neto.props['animation-delay'], '60ms', 'também lá dentro');
    assert.doesNotThrow(() => app.aplicarEstilosCalculados(null));
    filho.attrs['data-largura'] = '20';
    app.estilosAoMudar([{ type: 'attributes', target: filho }, { type: 'childList', addedNodes: [{ nodeType: 3 }, raiz] }]);
    assert.equal(filho.props.width, '20%');
  });

  test('com MutationObserver, arranca ao carregar e vigia o documento inteiro', () => {
    const observadores = [];
    const app = carregarApp({
      antes: (ctx) => {
        ctx.MutationObserver = class {
          constructor(cb) { this.cb = cb; observadores.push(this); }
          observe(alvo, op) { this.alvo = alvo; this.op = op; }
        };
      },
    });
    assert.equal(observadores.length, 1, 'um só, o deste ficheiro');
    assert.equal(observadores[0].alvo, app.document.documentElement);
    assert.deepEqual(JSON.parse(JSON.stringify(observadores[0].op)),
      { subtree: true, childList: true, attributes: true, attributeFilter: ['data-largura', 'data-fundo', 'data-atraso'] });
  });
});
