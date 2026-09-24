// Carrega a app num contexto de Node, com o mínimo de browser à volta.
//
// Os módulos da app são scripts clássicos que partilham o mesmo âmbito. Aqui
// são avaliados por ordem dentro de um contexto de vm, o que dá acesso às
// funções todas sem precisar de as reescrever nem de abrir um browser.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lerCatalogo } from './lib/catalogo.cjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'web');

// Ordem igual à do index.html. O arranque fica de fora: só liga a interface.
export const MODULOS = [
  'eventos', 'estilos-calculados', 'dados', 'anexos', 'formato', 'espera', 'registos', 'tipos', 'irs', 'saldos', 'ambito', 'icones', 'tema',
  'lista', 'continuidade', 'graficos', 'credito', 'componentes',
  'metricas', 'navegacao', 'servicos', 'acessos', 'vistas',
  'painel-geral', 'lista-imoveis', 'lista-contratos', 'lista-pessoas', 'lista-colaboradores', 'lista-movimentos', 'projecoes',
  'imovel', 'pessoas', 'contrato',
  'planeados', 'prazos', 'notificacoes', 'visitas', 'calendario', 'movimento', 'creditos', 'splitwise', 'contrato-pdf',
  'avaliacao', 'fisco', 'definicoes', 'copias',
];

/* O catálogo dos serviços, lido do próprio ficheiro do cliente
   (testes/lib/catalogo.cjs:lerCatalogo, o mesmo que o percurso lê): cada
   manifesto com id, nome, ficheiros, kinds, userKinds, casa, colab, requer e
   usa. É a mesma lista que a app usa — não há uma cópia aqui para apodrecer. */
export const SERVICOS_FICHEIROS = lerCatalogo();

/* Os módulos que são de algum serviço (só os de app/: a nuvem carrega-se à
   parte, por carregarTudo), pelo nome sem pasta nem extensão. */
const DE_SERVICOS = new Set(SERVICOS_FICHEIROS.flatMap((s) => s.ficheiros)
  .filter((f) => f.startsWith('app/')).map((f) => f.slice(4, -3)));

/* A base, pelo nome e pela ordem do index.html: o que não é de serviço nenhum,
   o que carregarBase carrega e o que cada serviço tem por garantido. Era «o
   que sobra» dos manifestos, e assim um ficheiro novo esquecido no catálogo
   caía na base sem ninguém o dizer — e o que era base (os prazos, o sino, o
   Splitwise, as contas das hipotecas) só estava escrito na negativa. A mesma
   lista vive no web/sw.js (BASE, com o arranque, que aqui não carrega). */
export const BASE = ['eventos', 'estilos-calculados', 'dados', 'anexos', 'formato', 'espera', 'registos', 'tipos', 'irs', 'saldos', 'ambito', 'icones', 'tema',
  'lista', 'continuidade', 'graficos', 'credito', 'componentes', 'metricas', 'navegacao', 'servicos', 'acessos', 'vistas',
  'prazos', 'notificacoes', 'splitwise', 'definicoes', 'copias'];

/* Cada módulo é da base ou de um serviço, e só de um; a base vai pela ordem
   do MODULOS. Rebenta ao importar o arnês, com o nome à vista: um ficheiro
   novo tem de ser declarado num dos dois sítios.
   Devolve: nada — lança se as listas não baterem. */
function conferirBase() {
  const falta = MODULOS.filter((n) => !BASE.includes(n) && !DE_SERVICOS.has(n));
  const dois = BASE.filter((n) => DE_SERVICOS.has(n));
  const fora = BASE.filter((n) => !MODULOS.includes(n));
  const ordem = MODULOS.filter((n) => BASE.includes(n)).join() === BASE.join();
  if (falta.length || dois.length || fora.length || !ordem) {
    throw new Error('arnes.js: a BASE não bate com o MODULOS e o catálogo — sem dono: ' + falta.join(', ') +
      '; na base e num serviço: ' + dois.join(', ') + '; na base e não carregados: ' + fora.join(', ') + (ordem ? '' : '; fora da ordem do index.html'));
  }
}
conferirBase();

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
    scrollIntoView() {}, insertAdjacentElement() {},
    /* como no browser, 'afterbegin' e 'beforeend' escrevem dentro do
       elemento (é assim que o «depois» da visão geral acrescenta ao #view);
       'beforebegin' e 'afterend' escrevem fora, e aqui não há pai onde pôr */
    insertAdjacentHTML(onde, html) {
      if (onde === 'afterbegin') this.innerHTML = html + this.innerHTML;
      else if (onde === 'beforeend') this.innerHTML += html;
    },
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

/** Cria um contexto novo com a app carregada. Cada teste tem o seu — ou,
    num ficheiro que partilha um por vários testes, repõe-no depois de cada
    um com afterEach(() => repor(app)).
    Recebe: opcoes (opcional) — {antes(janela)}: corre antes do primeiro
    ficheiro, com o window do contexto, para pôr no aparelho o que o arranque
    vai ler (o dados.js lê a base guardada ao carregar, como no browser);
    {hoje: 'AAAA-MM-DD'}: o dia em que a app vive (relogioFixo) — os testes
    de dinheiro e de datas não dependem do dia em que a bateria corre.
    Devolve: o proxy sobre o contexto. */
export function carregarApp(opcoes) {
  const ctx = contextoNovo(opcoes);
  if (opcoes && typeof opcoes.antes === 'function') opcoes.antes(ctx);
  for (const nome of MODULOS) carregarEm(ctx, 'app/' + nome + '.js');
  return proxyDe(ctx);
}

/* Só a base, sem serviço nenhum: o que as Definições e o motor das vistas
   têm por garantido. Todos os serviços ficam desligados neste contexto.
   Recebe: opcoes (opcional) — {hoje}, como carregarApp.
   Devolve: o proxy sobre o contexto, como carregarApp. */
export function carregarBase(opcoes) {
  return carregarServico([], opcoes);
}

/* A base e um ou mais serviços — e os que eles requerem, por fecho —, e nada
   mais: é a prova de autonomia. Os outros serviços ficam desligados
   (definirServicosDesligados), como o servidor os deixaria numa conta assim.
   Recebe: ids — os ids dos serviços a carregar (array); opcoes (opcional) —
   {hoje}, como carregarApp.
   Devolve: o proxy sobre o contexto, como carregarApp. */
export function carregarServico(ids, opcoes) {
  const porId = new Map(SERVICOS_FICHEIROS.map((s) => [s.id, s]));
  const querem = new Set();
  const pede = (id) => {
    const s = porId.get(id);
    if (!s) throw new Error('serviço desconhecido: ' + id);
    if (querem.has(id)) return;
    querem.add(id);
    (s.requer || []).forEach(pede);
  };
  (ids || []).forEach(pede);
  const ficheiros = new Set([...querem].flatMap((id) => porId.get(id).ficheiros)
    .filter((f) => f.startsWith('app/')).map((f) => f.slice(4, -3)));
  const ctx = contextoNovo(opcoes);
  for (const nome of MODULOS) if (!DE_SERVICOS.has(nome) || ficheiros.has(nome)) carregarEm(ctx, 'app/' + nome + '.js');
  const outros = SERVICOS_FICHEIROS.map((s) => s.id).filter((id) => !querem.has(id));
  vm.runInContext('definirServicosDesligados(' + JSON.stringify(outros) + ')', ctx);
  return proxyDe(ctx);
}

/* O que o arnês guarda de cada contexto, para o limpar e o repor: os
   elementos do DOM por id, o document e as funções dele como nasceram, e o
   valor de antes de cada nome que um teste trocou pelo proxy. */
const ESTADOS = new WeakMap();

/* Um relógio que marca o dia `hoje` ao meio-dia local e anda daí ao ritmo do
   verdadeiro. A app lê o dia pelo new Date() (formato.js:today, o YEAR, os
   prazos, as prestações vencidas): com ele, o que um teste de dinheiro prova
   deixa de mudar com o dia em que a bateria corre — a regra do prazos.test.js.
   O Date.now() continua a crescer (os ids e as datas de atualização contam
   com isso), e um Date com argumentos é o de sempre.
   Recebe: hoje — 'AAAA-MM-DD'.
   Devolve: a classe Date do contexto; rebenta se o dia não tiver essa forma. */
function relogioFixo(hoje) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(hoje))) throw new Error('arnes.js: o hoje é uma data AAAA-MM-DD, veio ' + hoje);
  const Real = Date;
  const desvio = new Real(hoje + 'T12:00:00').getTime() - Real.now();
  return class extends Real {
    constructor(...a) { if (a.length) super(...a); else super(Real.now() + desvio); }
    static now() { return Real.now() + desvio; }
  };
}

/* Um contexto de vm com o mínimo de browser à volta e nada carregado. O DOM
   lembra-se de cada elemento pelo id, como o browser: o que o render escreve
   no #view lê-se depois (elementos), e o limpar e o repor esvaziam-no. Era
   um elemento novo a cada getElementById, e cada ficheiro que precisava de
   ler o ecrã remendava-o à sua maneira.
   Recebe: opcoes (opcional) — {hoje: 'AAAA-MM-DD'} dá à app esse dia
   (relogioFixo); sem ele, o relógio do sistema.
   Devolve: o contexto (vm.createContext). */
function contextoNovo(opcoes) {
  const porId = new Map();
  const doc = {
    documentElement: elementoFalso(),
    body: elementoFalso(),
    head: elementoFalso(),
    createElement: () => elementoFalso(),
    getElementById: (id) => {
      if (!porId.has(id)) porId.set(id, elementoFalso());
      return porId.get(id);
    },
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
    URL, Blob, TextEncoder, TextDecoder, console, Math, JSON, Intl,
    Date: opcoes && opcoes.hoje ? relogioFixo(opcoes.hoje) : Date,
    addEventListener() {}, removeEventListener() {},
    scrollTo() {}, innerWidth: 1200, innerHeight: 900, screen: { height: 900 },
    history: { pushState() {}, back() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };
  janela.window = janela;
  janela.globalThis = janela;
  janela.self = janela;

  const ctx = vm.createContext(janela);
  ESTADOS.set(ctx, { porId, doc, docOriginal: Object.assign({}, doc), trocados: new Map() });
  return ctx;
}

/* Avalia um ficheiro de web/ dentro do contexto, como o browser faria com um
   <script src>: no mesmo âmbito que os anteriores. O filename é o endereço
   file:// do ficheiro, e não o caminho relativo: a cobertura do node --test só
   conta scripts cujo endereço é file:, e com o relativo o web/ inteiro — as
   hipotecas, o IRS, os prazos — ficava fora do relatório.
   Recebe: ctx — o contexto de vm; rel — o caminho relativo a web/.
   Devolve: nada — o ficheiro fica avaliado no contexto; rebenta com o nome do
   ficheiro à frente se ele não carregar. */
function carregarEm(ctx, rel) {
  const cheio = path.join(WEB, rel);
  const codigo = fs.readFileSync(cheio, 'utf8');
  try {
    vm.runInContext(codigo, ctx, { filename: pathToFileURL(cheio).href });
  } catch (e) {
    throw new Error('falhou a carregar ' + rel + ': ' + e.message);
  }
}

/** A app inteira, nuvem incluída — o que o browser tem depois de carregar o
    index.html todo. É onde uma redeclaração de const/let/class entre dois
    ficheiros quaisquer rebenta, porque estão finalmente no mesmo âmbito.
    Recebe: opcoes (opcional) — {antes, hoje}, como carregarApp.
    Devolve: o proxy sobre o contexto, como carregarApp. */
export function carregarTudo(opcoes) {
  const app = carregarApp(opcoes);
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
  const { trocados } = ESTADOS.get(ctx);
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
    /* Trocar um nome da app (app.render = …) guarda o valor de antes, para o
       repor. Um const não se troca: o nome no âmbito léxico esconde o
       objeto global, e escrever lá deixava a app a chamar a original sem
       ninguém dar por isso. Rebenta com o nome — o teste troca o que a
       função chama, ou a app declara-a com function. */
    set(alvo, nome, valor) {
      if (typeof nome !== 'string') { alvo[nome] = valor; return true; }
      const primeira = !trocados.has(nome);
      if (primeira) {
        try { trocados.set(nome, { existia: true, valor: vm.runInContext(nome, alvo) }); } catch (e) { trocados.set(nome, { existia: false }); }
      }
      alvo.__v = valor;
      try {
        vm.runInContext(nome + ' = __v;', alvo);
      } catch (e) {
        if (primeira) trocados.delete(nome);
        throw new TypeError('app.' + nome + (/constant/.test(e.message)
          ? ' é const na app e não se troca: troca-se o que ela chama, ou declara-se com function'
          : ' não se troca') + ' (' + e.message + ')');
      } finally {
        delete alvo.__v;
      }
      return true;
    },
    has(alvo, nome) {
      try { vm.runInContext('typeof ' + String(nome), alvo); return true; } catch (e) { return false; }
    },
  });
}

/** Devolve a app ao que era ao carregar, menos os dados: cada nome que um
    teste trocou pelo proxy (app.render = …, app.tab = …) volta ao valor de
    antes e o que não existia sai; as funções do document voltam às do
    arnês; o DOM esvazia-se. Os dados repõe-nos o limpar. Num ficheiro que
    partilha uma app por vários testes, afterEach(() => repor(app)): o stub
    de um teste deixa de ficar para o seguinte, e a ordem dos testes deixa
    de mudar o resultado.
    Recebe: app — o proxy de carregarApp (ou das irmãs).
    Devolve: nada. */
export function repor(app) {
  const ctx = app.__ctx;
  const e = ESTADOS.get(ctx);
  for (const [nome, antes] of e.trocados) {
    // um nome que não existia sai pelo global do contexto (o `this` de um
    // script), que é onde a atribuição o criou — tirá-lo só da janela não chega
    if (!antes.existia) { vm.runInContext('delete this[' + JSON.stringify(nome) + ']', ctx); delete ctx[nome]; continue; }
    ctx.__v = antes.valor;
    try { vm.runInContext(nome + ' = __v;', ctx); } finally { delete ctx.__v; }
  }
  e.trocados.clear();
  for (const k of Object.keys(e.doc)) if (!(k in e.docOriginal)) delete e.doc[k];
  Object.assign(e.doc, e.docOriginal);
  e.porId.clear();
}

/** Base de dados vazia e ecrã vazio, para cada teste partir do mesmo sítio.
    Recebe: app — o proxy.
    Devolve: a base nova (app.db). */
export function limpar(app) {
  app.db = JSON.parse(JSON.stringify(app.blank));
  app.fillCats(app.db.settings);
  app.ownerFilter = '';
  app.dashProp = '';
  ESTADOS.get(app.__ctx).porId.clear();
  return app.db;
}

/** O DOM da app por id, para ler o que ela lá escreveu: elementos(app).view
    é o #view — o mesmo elemento que a app recebe do getElementById, e sempre
    o de agora (depois de um limpar, o novo).
    Recebe: app — o proxy.
    Devolve: um objeto em que cada propriedade é o elemento com esse id. */
export function elementos(app) {
  return new Proxy({}, { get: (_, id) => (typeof id === 'string' ? app.document.getElementById(id) : undefined) });
}

/* Comparadores que atravessam o contexto isolado. Um array criado dentro da vm
   tem outro prototipo, e o deepEqual estrito repara nisso: compara-se o
   conteudo, que e o que interessa ao teste. */
export const igual = (a, b, msg) =>
  assert.deepEqual(JSON.parse(JSON.stringify(a)), b, msg);
export const vazio = (o, msg) =>
  assert.equal(Object.keys(o).length, 0, msg);

/* Dois números iguais a menos da tolerância — um cêntimo por omissão, que é
   o dinheiro. Estava copiado em nove ficheiros.
   Recebe: a — o que veio; b — o esperado; tol (opcional, 0.01); msg (opcional).
   Devolve: nada — falha a asserção com os dois números à vista. */
export const perto = (a, b, tol = 0.01, msg) =>
  assert.ok(Math.abs(a - b) <= tol, (msg ? msg + ': ' : '') + `esperava ${b} (±${tol}), veio ${a}`);
