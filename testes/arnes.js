// Carrega a app num contexto de Node, com o mínimo de browser à volta.
//
// Os módulos da app são scripts clássicos que partilham o mesmo âmbito. Aqui
// são avaliados por ordem dentro de um contexto de vm, o que dá acesso às
// funções todas sem precisar de as reescrever nem de abrir um browser.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'web');

// Ordem igual à do index.html. O arranque fica de fora: só liga a interface.
export const MODULOS = [
  'dados', 'anexos', 'auxiliares', 'lista', 'continuidade', 'graficos', 'credito', 'componentes',
  'metricas', 'navegacao', 'acessos', 'vistas', 'imovel', 'pessoas', 'contrato',
  'planeados', 'prazos', 'notificacoes', 'visitas', 'calendario', 'movimento', 'creditos', 'splitwise', 'contrato-pdf',
  'avaliacao', 'fisco', 'definicoes', 'copias',
];

/* A camada da nuvem, pela ordem do index.html. Carrega inteira neste contexto
   sem fingir mais nada — confirmou-se um a um. Fica separada do MODULOS de
   propósito: a nuvem embrulha o save, o render e o go por reatribuição, e os
   testes de lógica que já existem contam com as versões sem nuvem. */
export const NUVEM = ['nucleo', 'anexos', 'utilizadores', 'partilha', 'colaboradores', 'ajuda', 'painel',
  'filtros', 'entrada', 'novidades', 'selecao', 'selecao-listas', 'guia'];

/* Tudo o que o index.html carrega, pela ordem dele, como caminhos relativos a
   web/. É esta a lista que interessa a quem procura colisões de nomes: dois
   ficheiros a declarar o mesmo nome no mesmo âmbito só se veem juntos. Aqui
   o arranque entra: a nuvem embrulha funções dele (o seed, no guia.js), e no
   browser ele está carregado quando ela chega. */
export const TUDO = MODULOS.map((n) => 'app/' + n + '.js')
  .concat(['app/arranque.js', 'avisos.js', 'legal.js'])
  .concat(NUVEM.map((n) => 'cloud/' + n + '.js'));

function elementoFalso() {
  const el = {
    /* o style guarda o que lhe escrevem, incluindo as variaveis de CSS: sem
       setProperty, quem escreve uma (o aviso, que sobe acima do rodape do
       modal) rebentava aqui e em lado nenhum no browser */
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    dataset: {}, classList: {
      add() {}, remove() {}, toggle() {}, contains: () => false,
    },
    children: [], attributes: {},
    innerHTML: '', textContent: '', value: '', checked: false,
    appendChild(x) { this.children.push(x); return x; },
    insertBefore(x) { this.children.unshift(x); return x; },
    removeChild() {}, remove() {}, closest: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, setAttribute() {},
    getAttribute: () => null, removeAttribute() {}, focus() {}, blur() {}, click() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }),
    scrollIntoView() {}, insertAdjacentElement() {}, insertAdjacentHTML() {},
  };
  return el;
}

function armazenamentoFalso() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

/** Cria um contexto novo com a app carregada. Cada teste tem o seu. */
export function carregarApp() {
  const doc = {
    documentElement: elementoFalso(),
    body: elementoFalso(),
    head: elementoFalso(),
    createElement: () => elementoFalso(),
    getElementById: () => elementoFalso(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    createDocumentFragment: () => elementoFalso(),
  };

  const janela = {
    document: doc,
    localStorage: armazenamentoFalso(),
    location: { origin: 'https://teste.local', pathname: '/', href: 'https://teste.local/' },
    navigator: { userAgent: 'node', vibrate() {}, onLine: true },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    crypto: globalThis.crypto,
    fetch: () => Promise.reject(new Error('sem rede nos testes')),
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (f) => setTimeout(f, 0),
    indexedDB: { open: () => ({ addEventListener() {} }) },
    URL, Blob, TextEncoder, TextDecoder, console, Math, Date, JSON, Intl,
    addEventListener() {}, removeEventListener() {},
    scrollTo() {}, innerWidth: 1200, innerHeight: 900, screen: { height: 900 },
    history: { pushState() {}, back() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };
  janela.window = janela;
  janela.globalThis = janela;
  janela.self = janela;

  const ctx = vm.createContext(janela);
  for (const nome of MODULOS) carregarEm(ctx, 'app/' + nome + '.js');
  return proxyDe(ctx);
}

/* Avalia um ficheiro de web/ dentro do contexto, como o browser faria com um
   <script src>: no mesmo âmbito que os anteriores.
   Recebe: ctx — o contexto de vm; rel — o caminho relativo a web/.
   Devolve: nada — o ficheiro fica avaliado no contexto; rebenta com o nome do
   ficheiro à frente se ele não carregar. */
function carregarEm(ctx, rel) {
  const codigo = fs.readFileSync(path.join(WEB, rel), 'utf8');
  try {
    vm.runInContext(codigo, ctx, { filename: rel });
  } catch (e) {
    throw new Error('falhou a carregar ' + rel + ': ' + e.message);
  }
}

/** A app inteira, nuvem incluída — o que o browser tem depois de carregar o
    index.html todo. É onde uma redeclaração de const/let/class entre dois
    ficheiros quaisquer rebenta, porque estão finalmente no mesmo âmbito. */
export function carregarTudo() {
  const app = carregarApp();
  const ctx = app.__ctx;
  for (const rel of TUDO.slice(MODULOS.length)) carregarEm(ctx, rel);
  return app;
}

/* O proxy que dá acesso ao que vive no âmbito lexico do contexto.
   Recebe: ctx — o contexto de vm com a app carregada.
   Devolve: um Proxy sobre o contexto que resolve nomes avaliando-os. */
function proxyDe(ctx) {
  // As declaracoes de topo (const, let, function) vivem no ambito lexico da
  // linguagem, nao no objeto global: chega-se-lhes avaliando o nome. O proxy
  // faz isso, para os testes escreverem app.euro2(...) como se fosse normal.
  return new Proxy(ctx, {
    get(alvo, nome) {
      if (typeof nome !== 'string') return alvo[nome];
      if (nome === '__ctx') return alvo;
      try {
        return vm.runInContext(nome, alvo);
      } catch (e) {
        return undefined;
      }
    },
    set(alvo, nome, valor) {
      alvo.__v = valor;
      try {
        vm.runInContext(nome + ' = __v;', alvo);
      } catch (e) {
        alvo[nome] = valor;
      }
      return true;
    },
    has(alvo, nome) {
      try { vm.runInContext('typeof ' + String(nome), alvo); return true; } catch (e) { return false; }
    },
  });
}

/** Base de dados vazia, para cada teste partir do mesmo sítio. */
export function limpar(app) {
  app.db = JSON.parse(JSON.stringify(app.blank));
  app.fillCats(app.db.settings);
  app.ownerFilter = '';
  app.dashProp = '';
  return app.db;
}

/* Comparadores que atravessam o contexto isolado. Um array criado dentro da vm
   tem outro prototipo, e o deepEqual estrito repara nisso: compara-se o
   conteudo, que e o que interessa ao teste. */
export const igual = (a, b, msg) =>
  assert.deepEqual(JSON.parse(JSON.stringify(a)), b, msg);
export const vazio = (o, msg) =>
  assert.equal(Object.keys(o).length, 0, msg);
