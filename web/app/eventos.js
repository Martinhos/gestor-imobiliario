/* ============================ EVENTOS DECLARADOS ============================
   Os on…= em linha deixam de poder existir quando a CSP perder o
   'unsafe-inline' em script-src. No lugar deles há cinco
   atributos — data-click, data-change, data-input, data-keydown e
   data-pointerdown — cujo valor é uma AÇÃO: quase sempre o mesmo texto que
   estava no on…=, escrito numa gramática pequena que se lê e corre aqui, sem
   eval nem new Function.

   A gramática:
     Programa   := Instrução (';' Instrução)* ';'?
     Instrução  := Expressão
     Expressão  := E ('||' E)*
     E          := Unário ('&&' Unário)*
     Unário     := '!' Unário | '-' Unário | Posfixo
     Posfixo    := Primário ( '.' Nome | '(' Argumentos? ')' )*
     Argumentos := Expressão (',' Expressão)*
     Primário   := Nome | Texto | Número | true | false | null | undefined | '(' Expressão ')'
     Texto      := '…' | "…"   com os escapes \\ \' \" \n \t
     Número     := dígitos, com parte decimal opcional
   Fica de fora tudo o resto: atribuições, const/let/var, funções e setas, if,
   comparações, aritmética (menos o - unário), templates, new e índices […].
   Uma ação que precise disso passa a ser uma função com nome, e a ação chama-a.

   Os nomes: this é o elemento que tem o atributo (o currentTarget, como num
   on…=), event é o evento, e qualquer outro nome é uma propriedade própria do
   window posta pela app — as funções de topo declaradas com function, as
   variáveis de var, o CW. Os let e const de topo não estão no window.
   Os nomes que o browser já tinha quando este ficheiro carregou (document,
   location, fetch, eval, setTimeout, Function, o próprio window…) recusam-se
   todos, menos o Math: este é o primeiro script da app, e o que existe nessa
   altura não é da app. E no DOMContentLoaded, quando todos os scripts da app
   já correram, a lista dos nomes da app fecha-se: o que aparecer no window
   depois (o Google pendura lá google, default_gsi, closure_lm_…) é recusado,
   e os nomes desses scripts de fora recusam-se sempre (ACAO_DE_FORA). Uma
   ação só chama assim o que a app declara no topo — function, var ou
   window.x —, que é também o que o verificador da migração aceita. Um
   window.x posto dentro de uma função, depois do arranque, não serve.

   A segurança, além disso:
   - não se leem propriedades começadas por __, nem constructor nem prototype;
   - não se leem propriedades de uma função: uma função só se chama;
   - em this e event só se leem value, checked, files, key, dataset, id, name,
     selectedIndex e type; e o mesmo vale para qualquer objeto que não seja
     da app — um nó do DOM guardado numa var, um Map,
     um objeto de outro script —: só a lista, e nada de ownerDocument,
     defaultView ou parentNode, por onde se chegava ao document e ao window;
   - do window e do document não se lê nada;
   - uma função nativa só se chama se estiver na lista, conferida por
     identidade: stopPropagation e preventDefault do evento, click, focus e
     blur do elemento, e Math.min, max, round, floor, ceil e abs;
   - TODO o valor que circula numa ação passa pelo acaoValor: cada nome, cada
     propriedade lida, cada argumento, o resultado de cada chamada, os
     operandos de && e || e o resultado de cada instrução. Uma função nativa,
     o window, o document ou um nó do DOM que não seja o this nunca circulam
     — nem quando é uma função da app que os devolve (f(g()) com o g a
     devolver o fetch rebenta antes de o f correr);
   - as funções da app chamam-se todas, mas as que despacham por nome (o
     chamarServico, o delFileConfirm, o selPick) só chegam a outras funções
     da app: resolvem o nome pelo funcaoDaApp, daqui, que nunca devolve uma
     nativa nem um nome do browser, de um script de fora ou aparecido depois
     do arranque;
   - uma função que carregue código a partir de um argumento (um <script
     src>) não pode ser de topo, senão uma ação chama-a com o src que quiser:
     o loadScript vive dentro do loadSocial (entrada.js), só com o URL fixo
     do Google. As funções que recebem HTML (openModal, confirmModal…)
     continuam ao alcance, e isso equivale a uma injeção de HTML com tudo o
     que ela dá: uma moldura com srcdoc corre qualquer script desta origem,
     com acesso ao parent, e um http-equiv=refresh navega. A CSP não trava
     nenhum dos dois — o srcdoc herda-a e o script-src 'self' aceita os
     ficheiros da app, e o frame-src não olha para o srcdoc. Por isso essas
     etiquetas são TIRADAS de todo o HTML que entra numa janela, num sítio só
     (componentes.js:semEtiquetasQueCorrem). Quem injeta HTML na app fá-lo sem
     passar por ação nenhuma: a primeira defesa continua a ser o escape
     (jsq, esc).

   A ligação é preguiçosa: há em window um ouvinte de captura por tipo de
   evento. Quando um evento passa, percorre o event.composedPath() e dá um
   addEventListener a cada elemento do caminho que tenha o atributo e ainda
   não esteja ligado. A captura em window corre antes de o evento chegar ao
   alvo, e por isso o ouvinte acabado de pôr ainda dispara nesse mesmo evento.
   Assim a ordem fica a de um on…= — primeiro o alvo, depois os antepassados —,
   um event.stopPropagation() numa ação trava os de cima, e um el.click() feito
   logo a seguir a um innerHTML funciona. O atributo lê-se quando o evento
   chega: mudá-lo muda a ação, tirá-lo desliga-a.
   Há duas diferenças para um on…=, que quem converte não pode usar:
   - no mesmo elemento, um addEventListener do mesmo tipo posto pela app
     antes do primeiro evento corre ANTES da ação (com o on…= corria depois);
   - num elemento fora do documento (um innerHTML ainda por inserir), o
     el.click() não passa pelo window, e a ação não corre.

   Uma ação que falha rebenta com um Error de mensagem clara, que chega ao
   window.onerror como chegava o erro de um on…=. */

// os tipos de evento que têm atributo, um data-<tipo> cada
const ACAO_TIPOS = ['click', 'change', 'input', 'keydown', 'pointerdown'];
// o que se lê do this e do event
const ACAO_LEITURAS = new Set(['value', 'checked', 'files', 'key', 'dataset', 'id', 'name', 'selectedIndex', 'type']);
// os métodos que se chamam no event e no this, e os do Math
const ACAO_METODOS_DO_EVENTO = new Set(['stopPropagation', 'preventDefault']);
const ACAO_METODOS_DO_ELEMENTO = new Set(['click', 'focus', 'blur']);
const ACAO_METODOS_DO_MATH = new Set(['min', 'max', 'round', 'floor', 'ceil', 'abs']);
// as palavras do JavaScript que numa ação só podem ser o nome de uma propriedade (CW.delete)
const ACAO_RESERVADAS = new Set(['const', 'let', 'var', 'function', 'new', 'if', 'else', 'return', 'typeof',
  'void', 'delete', 'in', 'instanceof', 'class', 'for', 'while', 'do', 'switch', 'case', 'default', 'throw',
  'try', 'catch', 'finally', 'yield', 'await', 'async', 'of', 'with', 'super', 'import', 'export', 'debugger',
  'break', 'continue', 'extends', 'static', 'get', 'set']);
/* O marcador que o verificador e os testes põem no lugar de cada ${…} do
   código-fonte: um carácter que não aparece em ação nenhuma. Só é aceite com
   a opção {marcas: true}. */
const ACAO_MARCA = '';
// as ações já analisadas, texto → árvore; esvazia-se ao passar das mil
const ACAO_GUARDADAS = new Map();
/* Os nomes que os scripts de fora (o Google, carregado pelo loadSocial do
   entrada.js) penduram no window. Recusam-se sempre, mesmo antes de a lista
   da app fechar; o __G_ID_CLIENT__ já cai pelo __. */
const ACAO_DE_FORA = /^(google|default_gsi|_F_|closure_)/;
// os protótipos dos objetos que a app faz com {…} e […], deste window
const ACAO_PROTOS_DA_APP = [Object.prototype, Array.prototype];
/* O que a ligação apura ao arrancar: o window, os nomes que o browser já lá
   tinha, as funções nativas que se podem chamar, e os nomes da app (null até
   a lista fechar, no DOMContentLoaded). */
const ACAO_ESTADO = { janela: null, doBrowser: new Set(), nativas: new Set(), daApp: null };
// o toString das funções, guardado antes de alguém o poder trocar
const ACAO_TOSTRING = Function.prototype.toString;

/* Monta o Error de uma ação que não passa, com o texto à vista.
   Recebe: problema — o que falhou; texto (opcional) — a ação.
   Devolve: um Error com a mensagem «ação: …». */
function acaoErro(problema, texto) {
  const onde = texto == null ? '' : ' em «' + String(texto).slice(0, 120) + '»';
  return new Error('ação: ' + problema + onde);
}

/* Parte o texto de uma ação em fichas: nomes, textos, números e operadores.
   Recebe: texto — a ação; marcas — true se o marcador ACAO_MARCA vale como
   parte de um nome (o verificador e os testes).
   Devolve: [{t: 'nome'|'texto'|'numero'|'op', v, i}], com i a posição no texto;
   rebenta com um Error claro no primeiro carácter que a gramática não tem. */
function acaoFichas(texto, marcas) {
  const fichas = [];
  const n = texto.length;
  const inicioNome = (c) => /[\p{L}_$]/u.test(c) || (marcas && c === ACAO_MARCA);
  const meioNome = (c) => /[\p{L}\p{N}_$]/u.test(c) || (marcas && c === ACAO_MARCA);
  let i = 0;
  while (i < n) {
    const c = texto[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (inicioNome(c)) {
      let j = i + 1;
      while (j < n && meioNome(texto[j])) j++;
      const v = texto.slice(i, j);
      const antes = fichas[fichas.length - 1];
      // uma palavra do JavaScript só é aceite como nome de propriedade (CW.delete)
      if (ACAO_RESERVADAS.has(v) && !(antes && antes.t === 'op' && antes.v === '.')) throw acaoErro('«' + v + '» fica fora da gramática', texto);
      fichas.push({ t: 'nome', v, i });
      i = j;
      continue;
    }
    if (c >= '0' && c <= '9') {
      const m = /^\d+(?:\.\d+)?/.exec(texto.slice(i));
      const j = i + m[0].length;
      if (j < n && meioNome(texto[j])) throw acaoErro('número mal escrito na posição ' + i, texto);
      fichas.push({ t: 'numero', v: Number(m[0]), i });
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1, v = '';
      for (;;) {
        if (j >= n) throw acaoErro('texto por fechar na posição ' + i, texto);
        const d = texto[j];
        if (d === c) break;
        if (d === '\\') {
          const e = texto[j + 1];
          const trocas = { '\\': '\\', "'": "'", '"': '"', n: '\n', t: '\t' };
          if (!Object.prototype.hasOwnProperty.call(trocas, e)) throw acaoErro('escape «\\' + (e || '') + '» fora da gramática', texto);
          v += trocas[e];
          j += 2;
          continue;
        }
        v += d;
        j++;
      }
      fichas.push({ t: 'texto', v, i });
      i = j + 1;
      continue;
    }
    const dois = texto.slice(i, i + 2);
    if (dois === '&&' || dois === '||') { fichas.push({ t: 'op', v: dois, i }); i += 2; continue; }
    if (dois === '=>') throw acaoErro('setas fora da gramática', texto);
    if (dois === '==' || dois === '!=') throw acaoErro('comparações fora da gramática', texto);
    if ('!-.(),;'.includes(c)) { fichas.push({ t: 'op', v: c, i }); i++; continue; }
    if (c === '=') throw acaoErro('atribuições fora da gramática', texto);
    if (c === '<' || c === '>') throw acaoErro('comparações fora da gramática', texto);
    if ('+*/%'.includes(c)) throw acaoErro('aritmética fora da gramática (só o - unário)', texto);
    if (c === '`') throw acaoErro('template strings fora da gramática', texto);
    if (c === '[' || c === ']') throw acaoErro('índices […] fora da gramática', texto);
    if (c === '{' || c === '}') throw acaoErro('objetos e blocos {…} fora da gramática', texto);
    if (c === '?' || c === ':') throw acaoErro('o ?: fica fora da gramática', texto);
    if (c === '&' || c === '|' || c === '^' || c === '~') throw acaoErro('operadores de bits fora da gramática', texto);
    if (c === ACAO_MARCA) throw acaoErro('um ${…} por resolver', texto);
    throw acaoErro('carácter inesperado «' + c + '» na posição ' + i, texto);
  }
  return fichas;
}

/* A propriedade que não se lê em lado nenhum: __qualquer, constructor e prototype.
   Recebe: nome — o nome da propriedade.
   Devolve: true se é proibida. */
function acaoPropriedadeProibida(nome) {
  return nome.startsWith('__') || nome === 'constructor' || nome === 'prototype';
}

/* Analisa o texto de uma ação: parte-o em fichas, monta a árvore pela
   gramática e confere o que se confere sem correr (as propriedades
   proibidas, o que se lê e se chama no this, no event e no Math, e os
   métodos chamados sobre textos, números ou o this e o event, que são sempre
   nativos). É o que o verificador da migração e os testes usam.
   Recebe: texto — a ação; opcoes (opcional) — {marcas: true} aceita o
   marcador ACAO_MARCA no lugar de cada ${…} do código-fonte.
   Devolve: {texto, instrucoes} — a árvore, uma instrução por ';'; rebenta com
   um Error «ação: …» se o texto não passar. */
function analisarAcao(texto, opcoes) {
  texto = String(texto == null ? '' : texto);
  const marcas = !!(opcoes && opcoes.marcas);
  const fichas = acaoFichas(texto, marcas);
  let p = 0;
  const olha = () => fichas[p];
  const e = (v) => fichas[p] && fichas[p].t === 'op' && fichas[p].v === v;
  const espera = (v) => {
    if (e('-')) throw acaoErro('aritmética fora da gramática (só o - unário)', texto);
    if (!e(v)) throw acaoErro('esperava «' + v + '»' + (fichas[p] ? ' e veio «' + fichas[p].v + '»' : ' e a ação acabou'), texto);
    p++;
  };
  // a raiz de uma cadeia a.b().c — o primeiro nó dela
  const raiz = (no) => { while (no.t === 'prop' || no.t === 'chama') no = no.t === 'prop' ? no.o : no.f; return no; };

  const primario = () => {
    const f = olha();
    if (!f) throw acaoErro('a ação acaba a meio', texto);
    p++;
    if (f.t === 'texto' || f.t === 'numero') return { t: 'lit', v: f.v };
    if (f.t === 'nome') {
      const v = f.v;
      if (v.includes(ACAO_MARCA)) return v.split('').every((c) => c === ACAO_MARCA) ? { t: 'marca' } : { t: 'nome', n: v, dinamico: true };
      if (ACAO_RESERVADAS.has(v)) throw acaoErro('«' + v + '» fica fora da gramática', texto);
      if (v === 'true') return { t: 'lit', v: true };
      if (v === 'false') return { t: 'lit', v: false };
      if (v === 'null') return { t: 'lit', v: null };
      if (v === 'undefined') return { t: 'lit', v: undefined };
      if (v === 'this') return { t: 'este' };
      if (v === 'event') return { t: 'evento' };
      if (v.startsWith('__')) throw acaoErro('ação recusada: o nome «' + v + '» não se lê', texto);
      return { t: 'nome', n: v };
    }
    if (f.v === '(') {
      const dentro = expressao();
      espera(')');
      return dentro;
    }
    throw acaoErro('não esperava «' + f.v + '» na posição ' + f.i, texto);
  };

  const posfixo = () => {
    let no = primario();
    for (;;) {
      if (e('.')) {
        p++;
        const f = olha();
        if (!f || f.t !== 'nome') throw acaoErro('esperava um nome depois do «.»', texto);
        p++;
        const nome = f.v;
        if (acaoPropriedadeProibida(nome)) throw acaoErro('ação recusada: a propriedade «' + nome + '» não se lê', texto);
        const chamada = e('(');
        const r = raiz(no);
        if (no.t === 'este' || no.t === 'evento') {
          const metodos = no.t === 'este' ? ACAO_METODOS_DO_ELEMENTO : ACAO_METODOS_DO_EVENTO;
          if (chamada ? !metodos.has(nome) : !ACAO_LEITURAS.has(nome)) {
            throw acaoErro('ação recusada: «' + (no.t === 'este' ? 'this' : 'event') + '.' + nome + (chamada ? '()' : '') + '» não está na lista', texto);
          }
        } else if (chamada && (r.t === 'este' || r.t === 'evento' || r.t === 'lit')) {
          throw acaoErro('ação recusada: «.' + nome + '()» é um método do browser que não está na lista', texto);
        } else if (chamada && no.t === 'nome' && no.n === 'Math' && !ACAO_METODOS_DO_MATH.has(nome)) {
          throw acaoErro('ação recusada: «Math.' + nome + '()» não está na lista', texto);
        }
        no = { t: 'prop', o: no, n: nome };
        continue;
      }
      if (e('(')) {
        p++;
        const a = [];
        if (!e(')')) {
          a.push(expressao());
          while (e(',')) { p++; a.push(expressao()); }
        }
        espera(')');
        no = { t: 'chama', f: no, a };
        continue;
      }
      return no;
    }
  };

  const unario = () => {
    if (e('!')) { p++; return { t: 'nao', e: unario() }; }
    if (e('-')) { p++; return { t: 'menos', e: unario() }; }
    return posfixo();
  };
  const conjuncao = () => {
    let no = unario();
    while (e('&&')) { p++; no = { t: 'e', a: no, b: unario() }; }
    return no;
  };
  const expressao = () => {
    let no = conjuncao();
    while (e('||')) { p++; no = { t: 'ou', a: no, b: conjuncao() }; }
    return no;
  };

  if (!fichas.length) throw acaoErro('ação vazia', texto);
  const instrucoes = [expressao()];
  while (p < fichas.length) {
    if (e('-')) throw acaoErro('aritmética fora da gramática (só o - unário)', texto);
    espera(';');
    if (p < fichas.length) instrucoes.push(expressao());
  }
  return { texto, instrucoes };
}

/* Os nomes globais que uma ação usa: a cabeça de cada cadeia (o CW de
   CW.x(), o go de go('y')), sem this, event nem os literais. Um ${…} que
   ocupe o lugar de um nome — ou de parte dele, ou de uma instrução inteira —
   é um nome dinâmico, que não se consegue verificar; um ${…} no lugar de um
   argumento é só um valor, e não conta.
   Recebe: arvore — o que analisarAcao devolveu.
   Devolve: [{nome, dinamico}], sem repetições, pela ordem em que aparecem. */
function nomesDaAcao(arvore) {
  const vistos = new Map();
  const junta = (nome, dinamico) => { if (!vistos.has(nome)) vistos.set(nome, { nome, dinamico }); };
  const anda = (no, comoArgumento) => {
    switch (no.t) {
      case 'nome': junta(no.n, !!no.dinamico); break;
      case 'marca': if (!comoArgumento) junta('${…}', true); break;
      case 'prop':
        anda(no.o, false);
        if (no.n.includes(ACAO_MARCA)) junta('.' + no.n.split(ACAO_MARCA).join('${…}'), true);
        break;
      case 'chama': anda(no.f, false); no.a.forEach((x) => anda(x, true)); break;
      case 'e': case 'ou': anda(no.a, comoArgumento); anda(no.b, comoArgumento); break;
      case 'nao': case 'menos': anda(no.e, comoArgumento); break;
      default: break;
    }
  };
  arvore.instrucoes.forEach((no) => anda(no, false));
  return [...vistos.values()].map((x) => ({ nome: x.nome.split(ACAO_MARCA).join('${…}'), dinamico: x.dinamico }));
}

/* Uma função é nativa (do browser, e não da app)? Lê-se pelo toString, que
   numa nativa diz [native code]; um toString que rebente (um Proxy) conta
   como nativa, que é o lado seguro.
   Recebe: f — a função.
   Devolve: true se é nativa. */
function acaoNativa(f) {
  try { return /\{\s*\[native code\]\s*\}\s*$/.test(Reflect.apply(ACAO_TOSTRING, f, [])); } catch (e) { return true; }
}

/* O valor de um nome global, com as regras dos nomes: não pode ser do
   browser, nem de um script de fora, nem ter aparecido no window depois de a
   lista da app fechar.
   Recebe: n — o nome; texto — a ação, para as mensagens.
   Devolve: o valor; rebenta se o nome não é da app ou não existe. */
function acaoNome(n, texto) {
  const janela = ACAO_ESTADO.janela || window;
  if (n !== 'Math' && ACAO_ESTADO.doBrowser.has(n)) throw acaoErro('ação recusada: «' + n + '» é do browser, e não da app', texto);
  if (ACAO_DE_FORA.test(n)) throw acaoErro('ação recusada: «' + n + '» é de um script de fora, e não da app', texto);
  if (!Object.prototype.hasOwnProperty.call(janela, n)) throw acaoErro('nome desconhecido «' + n + '»', texto);
  if (n !== 'Math' && ACAO_ESTADO.daApp && !ACAO_ESTADO.daApp.has(n)) {
    throw acaoErro('ação recusada: «' + n + '» apareceu no window depois do arranque, e não é da app (uma ação só chama function, var ou window.x de topo)', texto);
  }
  return janela[n];
}

/* O objeto é o window ou o document (deste window, ou de outro: um window
   aponta para si mesmo pelo .window)?
   Recebe: o — o objeto.
   Devolve: true se é; um objeto que rebente ao ser olhado conta como sendo. */
function acaoJanelaOuDocumento(o) {
  const j = ACAO_ESTADO.janela || window;
  if (o === j || o === j.document) return true;
  try {
    if (typeof j.Window === 'function' && o instanceof j.Window) return true;
    if (typeof j.Document === 'function' && o instanceof j.Document) return true;
    return o.window === o;
  } catch (e) { return true; }
}

/* O objeto é do DOM: o window, o document, um nó ou outro EventTarget?
   Recebe: o — o objeto.
   Devolve: true se é; um objeto que rebente ao ser olhado conta como sendo. */
function acaoDoDom(o) {
  const j = ACAO_ESTADO.janela || window;
  if (acaoJanelaOuDocumento(o)) return true;
  try {
    for (const T of [j.EventTarget, j.Node]) if (typeof T === 'function' && o instanceof T) return true;
    return typeof o.nodeType === 'number' && 'ownerDocument' in o;
  } catch (e) { return true; }
}

/* O objeto é da app: feito com {…} ou […] (neste window), sem protótipo, ou
   de uma classe da app (um construtor que não é nativo)? Um nó do DOM, um
   Map, um objeto de outro window ou de outro script não é.
   Recebe: o — o objeto.
   Devolve: true se é da app. */
function acaoObjetoDaApp(o) {
  let proto;
  try { proto = Object.getPrototypeOf(o); } catch (e) { return false; }
  if (proto === null || ACAO_PROTOS_DA_APP.includes(proto)) return true;
  const d = Object.getOwnPropertyDescriptor(proto, 'constructor');
  return !!(d && typeof d.value === 'function' && !acaoNativa(d.value));
}

/* Lê uma propriedade, com as regras da segurança: do window e do document
   nada; do this, do event e de qualquer objeto que não seja da app (um nó do
   DOM guardado numa var, por exemplo) só a lista — as leituras de
   ACAO_LEITURAS e os métodos da lista, que se conferem depois por
   identidade. Um dataset lê-se todo: os valores dele são textos.
   Recebe: o — o objeto; n — o nome; chamada — true se o valor vai ser
   chamado logo a seguir; ctx — {el, ev}; texto — a ação.
   Devolve: o valor; rebenta com «ação recusada: …» se a leitura não é permitida. */
function acaoLer(o, n, chamada, ctx, texto) {
  if (o === null || o === undefined) throw acaoErro('não se lê «' + n + '» de ' + o, texto);
  if (typeof o === 'function') throw acaoErro('ação recusada: não se leem propriedades de uma função («' + n + '»)', texto);
  if (acaoPropriedadeProibida(n)) throw acaoErro('ação recusada: a propriedade «' + n + '» não se lê', texto);
  if (typeof o !== 'object') return o[n];
  if (o === ctx.el || o === ctx.ev) {
    const metodos = o === ctx.el ? ACAO_METODOS_DO_ELEMENTO : ACAO_METODOS_DO_EVENTO;
    if (chamada ? !metodos.has(n) : !ACAO_LEITURAS.has(n)) throw acaoErro('ação recusada: «' + n + '» não está na lista', texto);
    return o[n];
  }
  if (acaoJanelaOuDocumento(o)) throw acaoErro('ação recusada: não se lê nada do window nem do document («' + n + '»)', texto);
  const j = ACAO_ESTADO.janela || window;
  // o Math do window: o que se chama dele já o analisarAcao e a identidade das nativas prendem
  if (o === j.Math) return o[n];
  const dataset = !chamada && typeof j.DOMStringMap === 'function' && o instanceof j.DOMStringMap;
  if (!dataset && (acaoDoDom(o) || !acaoObjetoDaApp(o))) {
    const pode = chamada ? ACAO_METODOS_DO_ELEMENTO.has(n) || ACAO_METODOS_DO_EVENTO.has(n) : ACAO_LEITURAS.has(n);
    if (!pode) throw acaoErro('ação recusada: «' + n + '» não se lê de um objeto do browser (só ' + [...ACAO_LEITURAS].join(', ') + ')', texto);
  }
  return o[n];
}

/* Um valor que circula numa ação (um nome, uma propriedade lida, um
   argumento, o resultado de uma chamada, um operando de && e ||, o
   resultado de uma instrução): uma função nativa nunca circula, nem o
   window, o document ou um nó do DOM (tirando o this).
   Recebe: v — o valor; rotulo — o nome dele; ctx — {el, ev}; texto — a ação.
   Devolve: o próprio valor; rebenta se for um destes. */
function acaoValor(v, rotulo, ctx, texto) {
  if (typeof v === 'function' && acaoNativa(v)) throw acaoErro('ação recusada: a função do browser «' + rotulo + '» só se chama, e só se estiver na lista', texto);
  if (v !== null && typeof v === 'object' && v !== ctx.el && acaoDoDom(v)) {
    throw acaoErro('ação recusada: «' + rotulo + '» é o window, o document ou um nó do DOM, que não sai como valor (só o this)', texto);
  }
  return v;
}

/* O nome de um nó, para as mensagens: o nome, a propriedade, ou o que se
   chamou seguido de ().
   Recebe: no — o nó da árvore.
   Devolve: o rótulo (texto). */
function acaoRotulo(no) {
  if (no.t === 'nome' || no.t === 'prop') return no.n;
  if (no.t === 'chama') return acaoRotulo(no.f) + '()';
  if (no.t === 'este') return 'this';
  if (no.t === 'evento') return 'event';
  return '(…)';
}

/* O despacho por nome, partilhado por toda a app: o chamarServico (pelo
   funcaoDeTopo do servicos.js), o delFileConfirm e o selPick
   (componentes.js) resolvem por aqui o nome que recebem, que pode vir de
   uma ação injetada. Só sai uma função da app: com as regras dos nomes das
   ações (nada do browser, nada de um script de fora, nada que tenha
   aparecido no window depois de a lista da app fechar) e nunca uma nativa,
   mesmo guardada num var da app.
   Recebe: nome — o nome da função (texto); rebenta (opcional) — true para
   rebentar, com um Error «ação: …», quando o nome existe e é recusado (em
   vez de devolver null).
   Devolve: a função da app, ou null quando o nome não existe no window, não
   é uma função, ou é recusado (sem o rebenta). */
function funcaoDaApp(nome, rebenta) {
  if (typeof nome !== 'string' || !nome) return null;
  const recusa = (porque) => {
    if (rebenta) throw acaoErro('recusado: «' + nome.slice(0, 60) + '» ' + porque + ' (o despacho por nome só chama funções da app)');
    return null;
  };
  const janela = ACAO_ESTADO.janela || window;
  if (acaoPropriedadeProibida(nome)) return recusa('não se lê');
  if (ACAO_ESTADO.doBrowser.has(nome)) return recusa('é do browser, e não da app');
  if (ACAO_DE_FORA.test(nome)) return recusa('é de um script de fora, e não da app');
  if (!Object.prototype.hasOwnProperty.call(janela, nome)) return null;
  if (ACAO_ESTADO.daApp && !ACAO_ESTADO.daApp.has(nome)) return recusa('apareceu no window depois do arranque, e não é da app');
  const f = janela[nome];
  if (typeof f !== 'function') return null;
  if (acaoNativa(f)) return recusa('é uma função do browser');
  return f;
}

/* O objeto de onde se lê uma propriedade: o valor do nó, sem a regra do que
   sai como valor (a leitura a seguir tem as regras dela, no acaoLer). É o
   que deixa ler o value de um nó guardado sem o deixar sair.
   Recebe: no — o nó; ctx — {el, ev}; texto — a ação.
   Devolve: o valor. */
function acaoBase(no, ctx, texto) {
  if (no.t === 'nome') return acaoNome(no.n, texto);
  if (no.t === 'prop') return acaoLer(acaoBase(no.o, ctx, texto), no.n, false, ctx, texto);
  return acaoAvaliar(no, ctx, texto);
}

/* Corre um nó da árvore.
   Recebe: no — o nó; ctx — {el, ev}; texto — a ação, para as mensagens.
   Devolve: o valor do nó. */
function acaoAvaliar(no, ctx, texto) {
  switch (no.t) {
    case 'lit': return no.v;
    case 'este': return ctx.el;
    case 'evento': return ctx.ev;
    case 'nome': return acaoValor(acaoNome(no.n, texto), no.n, ctx, texto);
    case 'prop': return acaoValor(acaoLer(acaoBase(no.o, ctx, texto), no.n, false, ctx, texto), no.n, ctx, texto);
    case 'nao': return !acaoAvaliar(no.e, ctx, texto);
    case 'menos': {
      const v = acaoAvaliar(no.e, ctx, texto);
      if (typeof v !== 'number') throw acaoErro('o - unário só vale para números', texto);
      return -v;
    }
    case 'e': {
      const a = acaoValor(acaoAvaliar(no.a, ctx, texto), acaoRotulo(no.a), ctx, texto);
      return a && acaoValor(acaoAvaliar(no.b, ctx, texto), acaoRotulo(no.b), ctx, texto);
    }
    case 'ou': {
      const a = acaoValor(acaoAvaliar(no.a, ctx, texto), acaoRotulo(no.a), ctx, texto);
      return a || acaoValor(acaoAvaliar(no.b, ctx, texto), acaoRotulo(no.b), ctx, texto);
    }
    case 'chama': {
      let receptor, fn, rotulo;
      if (no.f.t === 'prop') {
        receptor = acaoAvaliar(no.f.o, ctx, texto);
        fn = acaoLer(receptor, no.f.n, true, ctx, texto);
        rotulo = no.f.n;
      } else if (no.f.t === 'nome') {
        fn = acaoNome(no.f.n, texto);
        rotulo = no.f.n;
      } else {
        fn = acaoAvaliar(no.f, ctx, texto);
        rotulo = '(…)';
      }
      if (typeof fn !== 'function') throw acaoErro('«' + rotulo + '» não é uma função', texto);
      if (acaoNativa(fn) && !ACAO_ESTADO.nativas.has(fn)) {
        throw acaoErro('ação recusada: a função do browser «' + rotulo + '» não está na lista', texto);
      }
      // cada argumento circula, e o que a chamada devolve também (f(g()) com o g a devolver o fetch)
      const args = no.a.map((x) => acaoValor(acaoAvaliar(x, ctx, texto), acaoRotulo(x), ctx, texto));
      return acaoValor(Reflect.apply(fn, receptor, args), rotulo + '()', ctx, texto);
    }
    default: throw acaoErro('um ${…} por resolver', texto);
  }
}

/* Corre uma ação, como o browser corria o on…=: com this no elemento e event
   no evento. A árvore guarda-se por texto (ACAO_GUARDADAS).
   Recebe: texto — a ação; el — o elemento que tem o atributo; evento — o evento.
   Devolve: nada; rebenta com o Error da ação que falhar. */
function correrAcao(texto, el, evento) {
  let arvore = ACAO_GUARDADAS.get(texto);
  if (!arvore) {
    arvore = analisarAcao(texto);
    if (ACAO_GUARDADAS.size >= 1000) ACAO_GUARDADAS.clear();
    ACAO_GUARDADAS.set(texto, arvore);
  }
  const ctx = { el, ev: evento };
  for (const no of arvore.instrucoes) acaoValor(acaoAvaliar(no, ctx, texto), acaoRotulo(no), ctx, texto);
}

/* Liga os eventos declarados num window: apura os nomes que o browser lá
   tem, as funções nativas da lista, e põe os ouvintes de captura. Corre uma
   vez só, ao carregar este ficheiro; uma segunda chamada não faz nada (uma
   ação que a chamasse não troca o window por outra coisa).
   Recebe: janela — o window.
   Devolve: nada. */
function ligarEventosDeclarados(janela) {
  if (ACAO_ESTADO.janela) return;
  ACAO_ESTADO.janela = janela;
  // o que este ficheiro oferece às ações; o resto dele é do mecanismo
  const oferecidas = new Set([subirAoTopo.name]);
  ACAO_ESTADO.doBrowser = new Set(Object.getOwnPropertyNames(janela).filter((n) => !oferecidas.has(n)));
  const nativas = ACAO_ESTADO.nativas;
  const junta = (proto, nomes) => {
    if (!proto) return;
    for (const n of nomes) if (typeof proto[n] === 'function') nativas.add(proto[n]);
  };
  junta(janela.Event && janela.Event.prototype, ACAO_METODOS_DO_EVENTO);
  junta(janela.HTMLElement && janela.HTMLElement.prototype, ACAO_METODOS_DO_ELEMENTO);
  junta(janela.SVGElement && janela.SVGElement.prototype, ACAO_METODOS_DO_ELEMENTO);
  junta(janela.Math, ACAO_METODOS_DO_MATH);
  /* A lista dos nomes da app fecha quando todos os scripts do index.html já
     correram. Os de fora (o Google) só chegam depois de uma ida à rede, que
     o loadSocial faz depois de um pedido à API. Sem uma página a carregar
     (os testes, o verificador) a lista fica aberta. */
  const doc = janela.document;
  if (doc && doc.readyState === 'loading' && typeof doc.addEventListener === 'function') {
    doc.addEventListener('DOMContentLoaded', () => fecharNomesDaApp(janela), { once: true });
  }
  for (const tipo of ACAO_TIPOS) {
    const atributo = 'data-' + tipo;
    const ligados = new WeakSet();
    const corre = (ev) => {
      const el = ev.currentTarget;
      const texto = el.getAttribute(atributo);
      if (texto == null) return;
      correrAcao(texto, el, ev);
    };
    janela.addEventListener(tipo, (ev) => {
      const caminho = ev && typeof ev.composedPath === 'function' ? ev.composedPath() : [];
      for (const el of caminho) {
        if (!el || typeof el.hasAttribute !== 'function' || ligados.has(el) || !el.hasAttribute(atributo)) continue;
        ligados.add(el);
        el.addEventListener(tipo, corre);
      }
    }, true);
  }
}

/* Fecha a lista dos nomes da app: o que o window tem agora e não tinha
   quando este ficheiro carregou (tirando os nomes dos scripts de fora). O
   que aparecer depois não se chama numa ação. Corre uma vez só; uma segunda
   chamada não faz nada.
   Recebe: janela — o window.
   Devolve: nada. */
function fecharNomesDaApp(janela) {
  if (ACAO_ESTADO.daApp) return;
  ACAO_ESTADO.daApp = new Set(Object.getOwnPropertyNames(janela).filter((n) => !ACAO_ESTADO.doBrowser.has(n) && !ACAO_DE_FORA.test(n)));
}

/* O botão que volta ao topo (index.html:#toTop). Era um on…= com um objeto
   literal, que a gramática não tem.
   Recebe: nada.
   Devolve: nada. */
function subirAoTopo() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

ligarEventosDeclarados(window);
