// A configuração do ESLint: o lint que o `node --check` não é.
//
// Numa app de dezenas de ficheiros num só âmbito global e sem build, um nome mal
// escrito só aparece quando a linha corre, e o arnês não dispara onclick
// nenhum. O no-undef, com a lista dos globais tirada dos próprios ficheiros do
// index.html (a lista e a regra do testes/globais.test.js), apanha-o antes.
// Só as regras que apanham erros; nenhuma de estilo.
//
// Corre no CI (.github/workflows/testes.yml, passo «Lint»), que instala o
// eslint e o globals só para esse passo — os testes continuam sem
// dependências. Sem o pacote globals a configuração carrega à mesma (é assim
// que o testes/correcao-testes.test.js a lê sem descarregar nada), mas o
// no-undef acusaria o document e o window: um alarme alto, nunca um verde falso.
//
// À mão: npm install --no-save eslint@10.10.0 globals@16.5.0 && npx eslint .
// (as versões do CI, fixadas ao patch como o Node: uma versão nova é uma mudança à parte)
// (o eslint 10 pede Node ^20.19, ^22.13 ou >=24; o CI está no 22.18)

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUDO } from './testes/arnes.js';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
// Recebe: rel — caminho a partir da raiz do repositório.
// Devolve: o texto do ficheiro.
const ler = (rel) => readFileSync(path.join(RAIZ, rel), 'utf8');

let globals = null;
try { globals = (await import('globals')).default; } catch (e) { globals = null; }
// Recebe: nome — um ambiente do pacote globals ('browser', 'node', 'serviceworker').
// Devolve: os globais desse ambiente, ou nenhum se o pacote não estiver instalado.
const G = (nome) => (globals ? globals[nome] : {});

// as palavras depois das quais uma barra abre uma expressão regular, e não uma divisão
const ANTES_DE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete',
  'void', 'throw', 'instanceof', 'yield', 'await']);
// o último carácter de uma linha que deixa a expressão por acabar na linha seguinte
const CONTINUA_DEPOIS = ',=+-*/%&|^!?:<>.';
// o primeiro carácter de uma linha que continua a expressão da linha de cima
const CONTINUA_ANTES = ',.?:+-*/%&|^=<>';
// um carácter de um nome ou de um número, acentos incluídos (um «ação» é um nome só)
const LETRA = /[\p{L}\p{N}_$]/u;

/* As declarações de topo de um ficheiro, lidas do texto: só as linhas que
   começam na coluna zero E fora de qualquer parêntesis, chaveta, texto,
   template ou comentário (o que está dentro de uma função é local). É a regra
   do testes/globais.test.js, que guarda os nomes repetidos entre ficheiros, e
   é daqui que ele a importa: uma regra, um sítio.

   Lê TODOS os nomes de uma declaração com vários — let a='',b=f(1,2),c={x,y};
   — partindo pelas vírgulas ao nível zero, e uma declaração que continua nas
   linhas seguintes. Uma leitura só do primeiro nome deixava de fora quase
   trezentos globais (os filtros dos movimentos, o thumbCache, o pushTimer…) e
   o no-undef acusava-os todos.

   Mais duas formas que lá não contam como declaração mas são globais para os
   outros ficheiros: window.nome = … e Object.defineProperty(window,'nome',…).

   Se a leitura perder o fio (um parêntesis que não fecha, um texto sem fim),
   rebenta com o nome do problema: um global a menos é um alarme, mas um
   ficheiro lido às avessas podia dar globais inventados, e isso seria um verde
   falso. Uma desestruturação no topo também rebenta — não há nenhuma, e
   lê-la a meio seria esconder nomes.
   Recebe: src — o texto do ficheiro; onde (opcional) — o nome, para as mensagens.
   Devolve: [[nome, forma]], com forma 'var', 'let', 'const', 'function',
   'class' ou 'window', pela ordem em que aparecem. */
export function lerDeclaracoes(src, onde = 'o texto') {
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const n = src.length;
  const out = [];
  const pilha = [];     // o que está aberto: '(', '[', '{' ou '${' (dentro de um template)
  let ant = '';         // o último carácter significativo (as palavras e os textos contam como 'a')
  let palavra = '';     // a última palavra, para o «return /x/»
  let decl = null;      // a declaração em curso: {forma, estado: 'nome' (à espera do nome) | 'depois' (já o leu)}
  const rebenta = (i, porque) => {
    const linha = src.slice(0, i).split('\n').length;
    throw new Error('lerDeclaracoes: ' + onde + ', linha ' + linha + ': ' + porque);
  };
  // Recebe: j — a posição logo a seguir à crase ou ao } que fecha um ${.
  // Devolve: [posição a seguir, true se parou num ${ que abre].
  const template = (j) => {
    while (j < n) {
      const d = src[j];
      if (d === '\\') { j += 2; continue; }
      if (d === '`') return [j + 1, false];
      if (d === '$' && src[j + 1] === '{') return [j + 2, true];
      j++;
    }
    return rebenta(j, 'um template sem fim');
  };
  let i = 0;
  while (i < n) {
    const c = src[i];
    // uma linha nova, ao nível zero: a coluna zero é onde as declarações de topo começam
    if (pilha.length === 0 && (i === 0 || src[i - 1] === '\n')) {
      const fimLinha = src.indexOf('\n', i);
      const linha = src.slice(i, fimLinha < 0 ? n : fimLinha);
      let m = /^(var|let|const)(?=[\s{[])\s*/.exec(linha);
      if (m) {
        decl = { forma: m[1], estado: 'nome' };
        i += m[0].length; ant = ''; palavra = m[1];
        continue;
      }
      // (uma declaração em curso não acaba aqui: o fim da linha de cima já decidiu se continua)
      // (os nomes com a mesma classe do LETRA: um «function ação» é o ação, e não um «a»)
      m = /^(?:async\s+)?(function|class)\s*\*?\s*([\p{L}_$][\p{L}\p{N}_$]*)/u.exec(linha);
      if (m) out.push([m[2], m[1]]);
      m = /^window\.([\p{L}_$][\p{L}\p{N}_$]*)\s*=(?!=)/u.exec(linha)
        || /^Object\.defineProperty\(\s*window\s*,\s*['"]([\p{L}_$][\p{L}\p{N}_$]*)['"]/u.exec(linha);
      if (m) out.push([m[1], 'window']);
    }
    if (c === '/' && src[i + 1] === '/') {                    // comentário até ao fim da linha
      const f = src.indexOf('\n', i);
      i = f < 0 ? n : f;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {                    // comentário de bloco
      const f = src.indexOf('*/', i + 2);
      if (f < 0) rebenta(i, 'um comentário sem fim');
      i = f + 2;
      continue;
    }
    if (c === "'" || c === '"') {                             // texto
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\n') rebenta(i, 'um texto sem fim na linha');
        j += src[j] === '\\' ? 2 : 1;
      }
      if (j >= n) rebenta(i, 'um texto sem fim');
      i = j + 1; ant = 'a'; palavra = '';
      continue;
    }
    if (c === '`' || (c === '}' && pilha[pilha.length - 1] === '${')) {
      if (c === '}') pilha.pop();
      const [j, abriu] = template(i + 1);
      if (abriu) { pilha.push('${'); ant = '{'; } else ant = 'a';
      i = j; palavra = '';
      continue;
    }
    if (c === '/') {
      const regex = ant === '' || '(,=:[!&|?{};+-*%<>~^}'.includes(ant) || (ant === 'a' && ANTES_DE_REGEX.has(palavra));
      if (regex) {
        let j = i + 1, classe = false;
        while (j < n && (classe || src[j] !== '/')) {
          if (src[j] === '\n') rebenta(i, 'uma expressão regular sem fim');
          if (src[j] === '\\') j++;
          else if (src[j] === '[') classe = true;
          else if (src[j] === ']') classe = false;
          j++;
        }
        j++;
        while (j < n && /[a-z]/.test(src[j])) j++;            // as bandeiras
        i = j; ant = 'a'; palavra = '';
        continue;
      }
    }
    if (LETRA.test(c)) {                                       // uma palavra (ou um número)
      let j = i + 1;
      while (j < n && LETRA.test(src[j])) j++;
      const w = src.slice(i, j);
      if (decl && pilha.length === 0 && decl.estado === 'nome') {
        out.push([w, decl.forma]);
        decl.estado = 'depois';
      } else if (!decl && pilha.length === 0 && ant === ';') {
        // uma segunda instrução de topo na mesma linha: let kpiN=0;const KPI_REG={};
        if (w === 'var' || w === 'let' || w === 'const') decl = { forma: w, estado: 'nome' };
        else if (w === 'function' || w === 'class') {
          const m = /^\s*\*?\s*([\p{L}_$][\p{L}\p{N}_$]*)/u.exec(src.slice(j, j + 200));
          if (m) out.push([m[1], w]);
        }
      }
      palavra = w; ant = 'a'; i = j;
      continue;
    }
    if (c === '\n') {
      // ao nível zero, a declaração acaba no fim da linha, a não ser que a expressão continue
      if (decl && pilha.length === 0 && decl.estado !== 'nome' && !CONTINUA_DEPOIS.includes(ant)) {
        let j = i + 1;
        while (j < n && /\s/.test(src[j])) j++;
        const k = src[j];
        const comentario = k === '/' && (src[j + 1] === '/' || src[j + 1] === '*');
        if (!k || comentario || !CONTINUA_ANTES.includes(k)) decl = null;
      }
      i++;
      continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === '[' || c === '{') {
      if (decl && pilha.length === 0 && decl.estado === 'nome') rebenta(i, 'uma desestruturação no topo, que isto não lê');
      pilha.push(c);
    } else if (c === ')' || c === ']' || c === '}') {
      const abre = pilha.pop();
      if (abre !== { ')': '(', ']': '[', '}': '{' }[c]) rebenta(i, '«' + c + '» a fechar «' + (abre || 'nada') + '»');
    } else if (decl && pilha.length === 0) {
      if (c === ',') decl.estado = 'nome';
      else if (c === ';') decl = null;
    }
    ant = c; palavra = '';
    i++;
  }
  if (pilha.length) rebenta(n, 'ficou por fechar: ' + pilha.join(' '));
  return out;
}

/* As declarações de topo de um ficheiro de web/, com o modo de global de cada uma.
   Recebe: rel — o caminho relativo a web/.
   Devolve: [[nome, 'readonly'|'writable']] — var e let reatribuem-se de fora
   (o db é trocado pela nuvem), e o que se pendura no window também; o resto não. */
export function declaracoesDeTopo(rel) {
  return lerDeclaracoes(ler('web/' + rel), 'web/' + rel)
    .map(([nome, forma]) => [nome, forma === 'var' || forma === 'let' || forma === 'window' ? 'writable' : 'readonly']);
}

/* Os globais que a app declara para si própria: os de todos os ficheiros que o
   index.html carrega (arnes.js:TUDO, a lista que o globais.test.js confere
   contra o index.html, ficheiro a ficheiro).
   Devolve: {nome: 'readonly'|'writable'}. */
export function globaisDaApp() {
  const out = {};
  for (const rel of TUDO) {
    for (const [nome, modo] of declaracoesDeTopo(rel)) out[nome] = out[nome] === 'writable' ? 'writable' : modo;
  }
  return out;
}

/* Os .js de uma pasta, separados pelo que são: módulos ES (import ou export no
   topo) ou CommonJS. O ESLint tem de saber antes de ler: um import num ficheiro
   lido como CommonJS é um erro de sintaxe, e um require num módulo um no-undef.
   Recebe: pasta — relativa à raiz.
   Devolve: {modulos, commonjs}, cada um uma lista de caminhos relativos à raiz. */
function porTipo(pasta) {
  const out = { modulos: [], commonjs: [] };
  for (const n of readdirSync(path.join(RAIZ, pasta))) {
    if (!n.endsWith('.js')) continue;
    const rel = pasta + '/' + n;
    (/^(?:import|export)\s/m.test(ler(rel)) ? out.modulos : out.commonjs).push(rel);
  }
  return out;
}

/* Só o que apanha erros: um nome que não existe, uma chave repetida num
   objeto, uma declaração repetida no mesmo âmbito, e uma variável que ninguém
   lê (quase sempre um nome trocado). O no-redeclare não conta os globais
   declarados acima: cada ficheiro de web/ declara os seus, e contá-los como
   redeclaração acusava a app inteira. */
const REGRAS = {
  'no-undef': 'error',
  'no-dupe-keys': 'error',
  'no-redeclare': ['error', { builtinGlobals: false }],
  'no-unused-vars': ['error', { vars: 'all', args: 'none', caughtErrors: 'none' }],
};

const APP = globaisDaApp();
const SCRIPTS = porTipo('scripts');

/* Os globais que a app usa e não declara, porque vêm de fora:
   - google — a biblioteca da entrada com Google, que o cloud/entrada.js
     carrega com loadScript('https://accounts.google.com/gsi/client');
   - Android — a ponte que a app Android (android/, WebView) injeta com
     addJavascriptInterface; no browser não existe, e quem a usa pergunta
     primeiro (window.Android&&…).
   Só leitura: a app nunca os reatribui. */
const DE_FORA = { google: 'readonly', Android: 'readonly' };

/* Os ficheiros do cliente que também se leem no Node (o scripts/versao.js e os
   testes fazem require deles): exportam por module.exports atrás de uma guarda
   typeof module !== 'undefined'. Só nesses o module é um nome conhecido — num
   ficheiro sem a guarda, um module solto é mesmo um erro. */
const COM_GUARDA_DO_NODE = ['avisos.js', 'legal.js', ...TUDO]
  .filter((rel, i, l) => l.indexOf(rel) === i)
  .filter((rel) => /typeof\s+module\s*!==?\s*['"]undefined['"]/.test(ler('web/' + rel)))
  .map((rel) => 'web/' + rel);

/* Os ficheiros que conduzem a app pelo Playwright: o que vai dentro de
   page.evaluate(() => …) corre na página, com os nomes do browser e os da app.
   O ESLint não distingue o lado do Node do lado da página, por isso cada um
   ganha SÓ os nomes da página que usa, contados à mão — com os cerca de 1500
   da app e os do browser inteiros, um sum, um db ou um name esquecido no lado
   do Node deixava de ser acusado. Um nome novo dentro de um page.evaluate é
   acusado até entrar aqui: um alarme, nunca um verde falso. */
const NA_PAGINA = {
  'scripts/capturas.js': {
    app: ['hideAuth', 'db', '_seed_guia', 'setPage', 'donutCat', 'buildNav', 'render'],
    browser: ['document', 'window', 'Image'],
  },
  /* o percurso: as regras do invariantes.js correm na página e leem o estado
     da seleção, e cada cena do percorrer.js é uma FUNÇÃO que corre lá dentro
     (era texto, que o Playwright avalia com eval — e a CSP não tem
     'unsafe-eval'). Os nomes que essas cenas chamam entram todos aqui. */
  'testes/ui/*.js': {
    app: ['selIds', 'AVISOS', 'CW', 'calNav', 'closeAllModals', 'closePops', 'ctModal', 'ctView',
      'db', 'go', 'personModal', 'personView', 'pickModal', 'propModal', 'propView', 'recView',
      'refrescarMovimentos', 'render', 'seed', 'setSyncBadge', 'tab', 'toast', 'txDir', 'txModal',
      'txSearch', 'txView'],
    browser: ['document', 'window', 'getComputedStyle', 'innerHeight', 'innerWidth', 'matchMedia',
      'MutationObserver', 'requestAnimationFrame', 'fetch', 'localStorage', 'PointerEvent'],
  },
};
/* Recebe: nomes — {app, browser}, os nomes da página que um ficheiro usa.
   Devolve: {nome: modo}, com o modo que cada nome tem na app ou no browser.
   Rebenta com um nome que a app já não declara: um nome da app que mudou
   deixava de ser um global, e a lista ficava a mentir. */
function daPagina({ app, browser }) {
  const out = {};
  for (const n of app) {
    if (!(n in APP)) throw new Error('eslint.config.mjs: NA_PAGINA pede «' + n + '», que a app já não declara no topo');
    out[n] = APP[n];
  }
  // sem o pacote globals, os do browser ficam de fora (o alarme alto de sempre)
  const b = G('browser');
  for (const n of browser) if (n in b) out[n] = b[n];
  return out;
}
// o service worker importa ficheiros do cliente (importScripts): os nomes deles valem lá
const DO_SW = Object.fromEntries([...ler('web/sw.js').matchAll(/importScripts\(\s*['"]\/?([^'"]+)['"]/g)]
  .flatMap((m) => declaracoesDeTopo(m[1])));

export default [
  {
    ignores: ['node_modules/**', '.wrangler/**', '.unlazy/**', '.stryker-tmp/**', 'testes/mutacao/**',
      'testes/ui/relatorio/**', 'worker/src/docs-gerados.js', 'android/**', 'terraform/**'],
  },
  {
    // o cliente: scripts clássicos num só âmbito, cada um com os nomes dos outros
    files: ['web/app/*.js', 'web/cloud/*.js', 'web/avisos.js', 'web/legal.js'],
    languageOptions: { sourceType: 'script', ecmaVersion: 'latest', globals: { ...G('browser'), ...DE_FORA, ...APP } },
    // uma função de topo que ninguém chama DENTRO do ficheiro é chamada pelo onclick de outro
    rules: { ...REGRAS, 'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none' }] },
  },
  ...(COM_GUARDA_DO_NODE.length ? [{
    files: COM_GUARDA_DO_NODE,
    languageOptions: { globals: { module: 'readonly' } },
  }] : []),
  {
    files: ['web/sw.js'],
    languageOptions: { sourceType: 'script', ecmaVersion: 'latest', globals: { ...G('serviceworker'), ...DO_SW } },
    rules: REGRAS,
  },
  {
    // o servidor: módulos ES no runtime dos Workers, que tem os globais de um service worker
    files: ['worker/**/*.js'],
    languageOptions: { sourceType: 'module', ecmaVersion: 'latest', globals: G('serviceworker') },
    rules: REGRAS,
  },
  {
    files: ['testes/*.js', 'testes/lib/*.js', 'eslint.config.mjs', ...SCRIPTS.modulos],
    languageOptions: { sourceType: 'module', ecmaVersion: 'latest', globals: G('node') },
    rules: REGRAS,
  },
  ...(SCRIPTS.commonjs.length ? [{
    files: SCRIPTS.commonjs,
    languageOptions: { sourceType: 'commonjs', ecmaVersion: 'latest', globals: G('node') },
    rules: REGRAS,
  }] : []),
  {
    // o percurso: CommonJS no Node, com funções que correm dentro da página
    files: ['testes/ui/*.js'],
    languageOptions: { sourceType: 'commonjs', ecmaVersion: 'latest', globals: G('node') },
    rules: REGRAS,
  },
  // por cima do bloco de cada um: os nomes da página que o NA_PAGINA lhe dá
  ...Object.entries(NA_PAGINA).map(([ficheiros, nomes]) => ({
    files: [ficheiros],
    languageOptions: { globals: { ...G('node'), ...daPagina(nomes) } },
  })),
];
