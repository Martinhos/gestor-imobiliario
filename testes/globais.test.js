// Os 43 ficheiros que o index.html carrega partilham o mesmo âmbito global —
// é a arquitetura, e é de propósito. O preço é que dois ficheiros a declarar o
// mesmo nome não se veem um ao outro até estarem os dois na mesma página: com
// var ou function, o segundo substitui o primeiro em silêncio; com const, let
// ou class, a página rebenta ao carregar. Nada apanhava nenhum dos dois casos.
//
// Havia uma colisão real quando isto entrou: «var css» em três ficheiros de
// cloud/, precisamente a parte que o arnês não carregava. Por ser var não
// rebentava — no dia em que alguém escrevesse const ali, rebentava.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TUDO, carregarTudo } from './arnes.js';
import { lerDeclaracoes } from '../eslint.config.mjs';

const ler = (rel) => readFileSync(new URL('../web/' + rel, import.meta.url), 'utf8');

const FICHEIROS = TUDO;

/* As declarações de topo de um ficheiro, lidas do texto com a mesma regra do
   ESLint (eslint.config.mjs:lerDeclaracoes): o que começa na coluna zero, fora
   de funções, textos e comentários, com TODOS os nomes de uma declaração com
   vários. A leitura antiga ficava pelo primeiro nome de cada linha — num
   «let tab='',txFilter='',…» só via o tab, e uma repetição de qualquer dos
   outros passava calada.
   Recebe: rel — o caminho relativo a web/.
   Devolve: lista de nomes declarados no topo desse ficheiro. O que só se
   pendura no window (window.x = …) fica de fora: é uma atribuição, e dois
   ficheiros podem fazê-la de propósito. */
function declaracoesDeTopo(rel) {
  return lerDeclaracoes(ler(rel), 'web/' + rel).filter(([, forma]) => forma !== 'window').map(([nome]) => nome);
}

describe('a leitura das declarações de topo', () => {
  // Recebe: src — um bocado de código. Devolve: os nomes que a leitura dá.
  const nomes = (src) => lerDeclaracoes(src).map(([nome]) => nome);

  test('lê todos os nomes de uma declaração com vários, sem se enganar nas vírgulas de dentro', () => {
    assert.deepEqual(nomes("let a='x,y',b={p:1,q:[2,3]},c=f(4,5),d=`${g,h}`,e=/,/g,k=(m,n)=>m+n,l;"),
      ['a', 'b', 'c', 'd', 'e', 'k', 'l']);
    assert.deepEqual(nomes('let kpiN=0;const KPI_REG={};function f(){}'), ['kpiN', 'KPI_REG', 'f'],
      'uma segunda instrução de topo na mesma linha também conta');
    assert.deepEqual(nomes('const A=[1,\n  2],B=3, // um comentário, com vírgula\n  C=4;\nvar D=5'), ['A', 'B', 'C', 'D'],
      'uma declaração que continua nas linhas seguintes');
    assert.deepEqual(nomes('const x=1\nfoo(a,b)\nconst y=a\n  ?b:c,z=2'), ['x', 'y', 'z'],
      'o fim da linha acaba a declaração, a não ser que a expressão continue');
  });

  test('só o topo: o que está dentro de uma função, de um texto ou de um comentário não conta', () => {
    assert.deepEqual(nomes('function f(){\nvar dentro=1\n}\nconst t=`\nconst noTexto=1`\n/*\nlet noComentario\n*/\nlet fora=2'),
      ['f', 't', 'fora']);
    // lida como regex, a barra de a/2 engolia «2, s=b/» e o s perdia-se
    assert.deepEqual(nomes('const r=a/2, s=b/2, t=3'), ['r', 's', 't'], 'uma divisão não é uma expressão regular');
    assert.deepEqual(nomes('const y=a+\n  b,z=2'), ['y', 'z'],
      'uma linha que acaba num operador continua na de baixo, mesmo que esta comece por um nome');
    assert.deepEqual(nomes('﻿const a=1'), ['a'], 'o BOM no início do ficheiro não esconde a primeira linha');
  });

  test('as outras formas de topo: function, class, async e o que se pendura no window', () => {
    assert.deepEqual(lerDeclaracoes('async function g(){}\nclass K{}\nfunction* h(){}'),
      [['g', 'function'], ['K', 'class'], ['h', 'function']]);
    assert.deepEqual(lerDeclaracoes("window.foo=1\nwindow.igual==2\nObject.defineProperty(window,'bar',{})"),
      [['foo', 'window'], ['bar', 'window']], 'uma comparação com o window não é uma atribuição');
    assert.deepEqual(lerDeclaracoes('function ação(){}\nclass Situação{}\nwindow.ação=1\nconst preço=1'),
      [['ação', 'function'], ['Situação', 'class'], ['ação', 'window'], ['preço', 'const']],
      'os nomes com acentos inteiros, em todas as formas (e não um «a» ou um «Situa» inventados)');
  });

  // da segunda revisão do lint: cada caso mata uma mutação do leitor que os outros deixavam viva
  test('os acentos em todas as formas, um nome que só começa por const, a regex depois de return, e um comentário que não prolonga uma declaração', () => {
    assert.deepEqual(lerDeclaracoes("Object.defineProperty(window,'situação',{})"), [['situação', 'window']],
      'o nome inteiro, com o acento, também quando se pendura pelo defineProperty');
    assert.deepEqual(nomes('let a=1;function ação(){}'), ['a', 'ação'],
      'e numa segunda instrução da mesma linha (e não um «a» inventado)');
    assert.deepEqual(nomes('constantes.push(1)\nletra=2'), [],
      'um constantes ou um letra no começo da linha não são um const nem um let');
    assert.deepEqual(nomes('function f(){return /[(]/.test(x)}'), ['f'],
      'depois de um return a barra abre uma expressão regular, e o ( lá dentro não abre nada');
    assert.deepEqual(nomes('const a=1,\n  /* o b */ b=2\n/* já acabou */ f(x),g=3'), ['a', 'b'],
      'um comentário a meio de uma declaração que continua não a parte, e um comentário depois de ela acabar não a faz continuar');
  });

  test('rebenta quando perde o fio, em vez de inventar nomes', () => {
    assert.throws(() => lerDeclaracoes('const a=f(1,2\nconst b=3'), /ficou por fechar/);
    assert.throws(() => lerDeclaracoes('const {a,b}=o;'), /desestruturação/);
    assert.throws(() => lerDeclaracoes('const a=(1]'), /«\]» a fechar «\(»/);
    assert.throws(() => lerDeclaracoes("const a='x\ny'"), /texto sem fim/);
  });
});

describe('os nomes globais', () => {
  test('a lista cobre o index.html inteiro, sem repetir ficheiros', () => {
    const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
    const srcs = (html.match(/src="([^"]+\.js)"/g) || []).map((s) => s.slice(5, -1));
    assert.deepEqual([...srcs].sort(), [...FICHEIROS].sort(),
      'o que se verifica tem de ser exatamente o que o browser carrega');
  });

  test('nenhum nome é declarado no topo de dois ficheiros', () => {
    const onde = new Map();
    for (const rel of FICHEIROS) {
      for (const nome of declaracoesDeTopo(rel)) {
        if (!onde.has(nome)) onde.set(nome, []);
        if (!onde.get(nome).includes(rel)) onde.get(nome).push(rel);
      }
    }
    const repetidos = [...onde].filter(([, fs]) => fs.length > 1);
    assert.deepEqual(repetidos, [],
      'declarado em mais do que um ficheiro — com var ou function o segundo ' +
      'substitui o primeiro em silêncio; com const, let ou class a página não abre');
    // um número que desce muito é a leitura a falhar, não o código a encolher
    assert.ok(onde.size > 1000, 'leu ' + onde.size + ' nomes — a expressão deixou de reconhecer as declarações?');
  });

  /* A metade que a leitura do texto não dá: com tudo no mesmo contexto, uma
     redeclaração de const/let/class entre dois ficheiros quaisquer rebenta ao
     carregar — como no browser. É o único sítio onde a app inteira, nuvem
     incluída, é avaliada de uma vez. */
  test('a app inteira carrega no mesmo âmbito sem rebentar', () => {
    const app = carregarTudo();
    assert.equal(typeof app.render, 'function', 'a base está lá');
    assert.equal(typeof app.CW, 'object', 'e a nuvem também');
  });
});
