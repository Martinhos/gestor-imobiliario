// A CSP sem «unsafe-inline», amarrada onde ela vive e no que a app escreve.
//
// A política da app está em dois sítios que têm de ser iguais: a constante CSP
// do worker/src/index.js, que o harden() põe na raiz (é a que manda na app), e
// o web/_headers, que veste os ficheiros estáticos. Nenhuma das duas traz
// «unsafe-inline»: os dois scripts em linha do web/index.html — a armadilha de
// erros e a cura do arranque, que têm de correr antes de tudo — entram por
// sha256, e o CSS da app vive no web/estilos.css.
//
// Com ela, um on…=, um style=, um <style> ou uma folha criada por JavaScript
// deixam de ser aplicados pelo browser, SEM erro nenhum no servidor: a app
// ficava despida e muda e o CI não dava por nada. Por isso o varrimento é
// aqui: o web/ inteiro e as páginas do worker, à procura de tudo o que a
// política recusaria — e a gramática de cada ação, lida do próprio
// web/app/eventos.js, para não haver duas.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { TUDO, carregarApp } from './arnes.js';
import { lerDeclaracoes } from '../eslint.config.mjs';
import { camadaFalsa } from './lib/dom.js';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
/* O texto de um ficheiro com os fins de linha em LF — que é como ele vai para
   produção, e é sobre isso que os hashes se calculam. Nesta máquina a cópia de
   trabalho pode estar em CRLF; o .gitattributes manda eol=lf.
   Recebe: rel — o caminho a partir da raiz.
   Devolve: o texto. */
const ler = (rel) => readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/* ============================ onde a CSP vive ============================ */

/* O sha256 de cada script em linha do web/index.html, no formato da CSP.
   Devolve: ["'sha256-…'", …], pela ordem em que aparecem. */
function hashesDoIndex() {
  return [...ler('web/index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => "'sha256-" + createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
}

/* A CSP geral, lida do texto do worker/src/index.js: os dois literais,
   avaliados à parte (é como o testes/correcao-testes.test.js lê o NA_PAGINA).
   Não se importa o módulo — a constante não é exportada, e é de propósito.
   Devolve: a política, em texto. */
function cspDoWorker() {
  const src = ler('worker/src/index.js');
  const h = /\nconst HASHES_EM_LINHA = ([\s\S]*?);\n/.exec(src);
  const c = /\nconst CSP = (\[[\s\S]*?\]\.join\('; '\));\n/.exec(src);
  assert.ok(h && c, 'o HASHES_EM_LINHA e o CSP continuam a ser lidos do worker/src/index.js');
  return vm.runInNewContext('const HASHES_EM_LINHA = ' + h[1] + '; ' + c[1]);
}

/* A política que o web/_headers serve aos ficheiros estáticos.
   Devolve: a política, em texto. */
function cspDosHeaders() {
  const m = /^\s*Content-Security-Policy:\s*(.+)$/m.exec(ler('web/_headers'));
  assert.ok(m, 'o web/_headers tem a política');
  return m[1].trim();
}

describe('a CSP da app', () => {
  test('as duas políticas são a mesma, palavra por palavra', () => {
    assert.equal(cspDosHeaders(), cspDoWorker(),
      'o worker/src/index.js e o web/_headers têm de dizer o mesmo: quem entra pela raiz e quem entra por um ficheiro vê a mesma app');
  });

  test('nenhuma das duas deixa correr o que está em linha', () => {
    for (const csp of [cspDoWorker(), cspDosHeaders()]) {
      assert.doesNotMatch(csp, /unsafe-inline/, csp);
      assert.doesNotMatch(csp, /unsafe-eval/, csp);
      assert.match(csp, /script-src 'self'/);
      assert.match(csp, /style-src 'self'/);
    }
  });

  test('os dois sítios trazem o sha256 de cada script em linha do index.html', () => {
    const hashes = hashesDoIndex();
    assert.equal(hashes.length, 2, 'o web/index.html tem dois scripts em linha');
    for (const [rel, csp] of [['worker/src/index.js', cspDoWorker()], ['web/_headers', cspDosHeaders()]]) {
      for (const h of hashes) assert.ok(csp.includes(h), rel + ': falta o ' + h);
    }
    // e nenhum hash a mais no script-src: um que sobre é um script que já não existe
    for (const csp of [cspDoWorker(), cspDosHeaders()]) {
      const scriptSrc = /script-src[^;]*/.exec(csp)[0];
      assert.deepEqual([...scriptSrc.matchAll(/'sha256-[^']+'/g)].map((m) => m[0]), hashes);
    }
  });

  /* O único hash do style-src não é nosso: é o da folha que o botão de entrada
     com Google injeta. Sem ele o browser recusa-a e o botão passa de 72px para
     357px de altura — medido no ecrã de entrada, contra a mesma página sem CSP
     nenhuma. Fica preso aqui porque é de um terceiro: quando o Google mudar a
     biblioteca, este teste continua verde (o hash está nos dois sítios) mas o
     botão cresce — quem apanha isso é o percurso da interface. */
  test('o style-src traz o hash da folha do Google, e mais nenhum', () => {
    const DO_GOOGLE = "'sha256-RU4sU0AaS8IBGZx8XrGt/pa9A5SLA3dQszGeqT5L3Kw='";
    for (const csp of [cspDoWorker(), cspDosHeaders()]) {
      const styleSrc = /style-src[^;]*/.exec(csp)[0];
      assert.deepEqual([...styleSrc.matchAll(/'sha256-[^']+'/g)].map((m) => m[0]), [DO_GOOGLE]);
      assert.doesNotMatch(styleSrc, /unsafe-hashes/, 'um hash não vale para um atributo de estilo, e não se abre a porta a todos');
    }
  });

  test('o script em linha mede-se em LF, e é isso que o hash apanha', () => {
    /* A cópia de trabalho pode estar em CRLF nesta máquina e em LF no CI: o
       hash tem de ser o mesmo nos dois casos, senão a app arrancava aqui e
       ficava sem os dois scripts em produção. O ler() normaliza, como o
       .gitattributes manda guardar. */
    const cru = readFileSync(path.join(RAIZ, 'web/index.html'), 'utf8');
    const emLf = cru.replace(/\r\n/g, '\n');
    const hashDe = (t) => [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)]
      .map((m) => createHash('sha256').update(m[1], 'utf8').digest('base64'));
    assert.deepEqual(hashDe(emLf), hashDe(emLf.replace(/\n/g, '\r\n')).length ? hashDe(emLf) : [],
      'controlo: o cálculo corre');
    assert.deepEqual(hashesDoIndex().map((h) => h.slice(8, -1)), hashDe(emLf), 'o hash é o do texto em LF');
  });

  test('as páginas do worker continuam com a política mais apertada, e o harden só deixa apertar', async () => {
    const { CSP_ESTRITA } = await import('../worker/src/lib/http.js');
    assert.doesNotMatch(CSP_ESTRITA, /unsafe-inline/);
    assert.doesNotMatch(CSP_ESTRITA, /unsafe-eval/);
    // é a geral sem os três hashes: estas páginas não têm script nenhum em linha nem desenham o botão do Google
    assert.equal(CSP_ESTRITA, cspDoWorker().replace(/ 'sha256-[^']+'/g, ''));
    /* O harden() impõe os cabeçalhos de segurança por cima do que a rota pôs, e
       só não o faz para os valores EXATOS do PODE_APERTAR — que continuam a ser
       dois, e os dois mais apertados do que a geral (o CSP_ANEXO tem
       default-src 'none' e sandbox). Uma lista de valores exatos é o que impede
       uma rota de afrouxar a política por engano. */
    const src = ler('worker/src/index.js');
    const m = /const PODE_APERTAR = (\{[\s\S]*?\});/.exec(src);
    assert.ok(m, 'o PODE_APERTAR está lá');
    assert.match(m[1], /'Content-Security-Policy': \[CSP_ANEXO, CSP_ESTRITA\]/, 'só estes dois valores exatos');
    assert.match(src, /if \(posto && permitidos\.indexOf\(posto\) > -1\) return;/, 'e só um valor da lista escapa a ser substituído');
  });
});

/* ================= nada em linha, no que a app escreve ================= */

/* Os ficheiros que o varrimento confere: o web/ inteiro (os .js e o
   index.html) e as páginas que o worker escreve. */
const PAGINAS_DO_WORKER = ['landing.js', 'legal-vista.js', 'docs-vista.js', 'equipa-vista.js', 'equipa-guiao.js', 'teste.js']
  .map((f) => 'worker/src/' + f);
// Recebe: d — uma pasta a partir da raiz. Devolve: os .js dela, com o caminho.
const js = (d) => readdirSync(path.join(RAIZ, d)).filter((f) => f.endsWith('.js')).map((f) => d + '/' + f);
const FICHEIROS = ['web/index.html', ...js('web'), ...js('web/app'), ...js('web/cloud'), ...PAGINAS_DO_WORKER];

/* O valor de um atributo, logo a seguir ao nome: com aspas (ou a aspa escapada
   de um texto JavaScript, ou um ${…} de um template), com os espaços que o
   HTML deixa à volta do =; ou sem aspas, colado ao = — e é isto que deixa de
   fora o «style= » da prosa de um comentário. */
const VALOR = String.raw`(?:\s*=\s*\\?["'` + '`' + String.raw`$]|=[^\s"'<>=` + '`' + String.raw`])`;
/* Os atributos de evento do HTML, tirados do Chromium (as propriedades on… de
   HTMLElement, Element, Node, EventTarget, Document, Window, SVGElement,
   HTMLBodyElement, HTMLFrameSetElement e HTMLMediaElement). Com a lista, e não
   um on[a-z]+ qualquer, uma variável de JavaScript como o «onSave=(…)» ou um
   «onde = '…'» não passam por atributo — e o on…= apanha-se com ou sem aspas. */
const EVENTOS_DO_HTML = ('abort afterprint animationcancel animationend animationiteration animationstart auxclick ' +
  'beforecopy beforecut beforeinput beforematch beforepaste beforeprint beforetoggle beforeunload beforexrselect blur ' +
  'cancel canplay canplaythrough change click close command contentvisibilityautostatechange contextlost contextmenu ' +
  'contextrestored copy cuechange cut dblclick drag dragend dragenter dragleave dragover dragstart drop durationchange ' +
  'emptied encrypted ended error focus focusin focusout formdata freeze fullscreenchange fullscreenerror gamepadconnected ' +
  'gamepaddisconnected gotpointercapture hashchange input invalid keydown keypress keyup languagechange load loadeddata ' +
  'loadedmetadata loadstart lostpointercapture message messageerror mousedown mouseenter mouseleave mousemove mouseout ' +
  'mouseover mouseup mousewheel offline online pagehide pageshow paste pause play playing pointercancel pointerdown ' +
  'pointerenter pointerleave pointerlockchange pointerlockerror pointermove pointerout pointerover pointerup popstate ' +
  'prerenderingchange progress ratechange readystatechange rejectionhandled reset resize resume scroll scrollend ' +
  'scrollsnapchange scrollsnapchanging search securitypolicyviolation seeked seeking select selectionchange selectstart ' +
  'slotchange stalled storage submit suspend timeupdate toggle touchcancel touchend touchmove touchstart transitioncancel ' +
  'transitionend transitionrun transitionstart unhandledrejection unload visibilitychange volumechange waiting ' +
  'waitingforkey webkitanimationend webkitanimationiteration webkitanimationstart webkitfullscreenchange ' +
  'webkitfullscreenerror webkittransitionend wheel').split(' ');
const RE_ON = new RegExp(String.raw`(?<=[\s"'` + '`' + String.raw`/])on(?:` + EVENTOS_DO_HTML.join('|') + ')(?![a-z])' + VALOR, 'gi');
const RE_STYLE = new RegExp(String.raw`(?<=[\s"'` + '`' + String.raw`/])style` + VALOR, 'gi');

describe('a app não escreve nada que a CSP recuse', () => {
  test('nenhum atributo on…= e nenhum style=', () => {
    const maus = [];
    for (const rel of FICHEIROS) {
      const src = ler(rel);
      for (const m of src.matchAll(RE_ON)) maus.push(rel + ': ' + m[0].trim());
      for (const m of src.matchAll(RE_STYLE)) maus.push(rel + ': ' + m[0].trim());
    }
    assert.deepEqual(maus, [], 'um on…= não corre e um style= não se aplica: os eventos vão em data-click (web/app/eventos.js) e os estilos em classes (web/estilos.css)');
  });

  test('nenhum setAttribute de um on…= ou de um style=', () => {
    const maus = [];
    for (const rel of FICHEIROS) {
      for (const m of ler(rel).matchAll(/setAttribute\(\s*(['"`])(on[a-z]+|style)\1/g)) maus.push(rel + ": setAttribute('" + m[2] + "')");
    }
    assert.deepEqual(maus, []);
  });

  test('nenhuma folha em linha: nem escrita no HTML, nem criada por JavaScript', () => {
    const maus = [];
    for (const rel of FICHEIROS) {
      const src = ler(rel);
      for (const m of src.matchAll(/<style[\s>]/g)) maus.push(rel + ':' + src.slice(0, m.index).split('\n').length + ': uma folha escrita no HTML');
      if (!rel.endsWith('.html')) {
        for (const m of src.matchAll(/createElement\(\s*['"`]style['"`]\s*\)/g)) maus.push(rel + ':' + src.slice(0, m.index).split('\n').length + ': uma folha criada por JavaScript');
      }
    }
    assert.deepEqual(maus, [], 'as regras vivem no web/estilos.css — e uma folha criada por JavaScript é CSS em linha na mesma');
  });

  test('quem procurava [onclick] procura [data-click]', () => {
    const maus = [];
    /* este ficheiro fica de fora: é ele que escreve o padrão que procura */
    const consumidores = [...js('testes'), ...js('testes/ui'), ...js('testes/lib')].filter((f) => f !== 'testes/csp.test.js');
    for (const rel of [...FICHEIROS, ...consumidores]) {
      for (const m of ler(rel).matchAll(/\[on(click|change|input|keydown|pointerdown)\b/g)) maus.push(rel + ': [on' + m[1] + ']');
      for (const m of ler(rel).matchAll(/getAttribute\(\s*['"]on(click|change|input|keydown|pointerdown)['"]/g)) maus.push(rel + ": getAttribute('on" + m[1] + "')");
    }
    assert.deepEqual(maus, [], 'a ação vive no data-<evento>: quem lê o atributo antigo vê sempre null e não acusa nada');
  });

  test('cada classe u-… que a app usa existe no web/estilos.css', () => {
    const naFolha = new Set([...ler('web/estilos.css').matchAll(/\.(u-[a-z0-9-]+)\{/g)].map((m) => m[1]));
    assert.ok(naFolha.size > 100, 'controlo: a folha tem os utilitários (' + naFolha.size + ')');
    const maus = [];
    for (const rel of FICHEIROS.filter((f) => f.startsWith('web/'))) {
      for (const m of ler(rel).matchAll(/(?<![\w-])u-[a-z0-9][a-z0-9-]*(\$\{)?/g)) {
        if (!m[1] && !naFolha.has(m[0])) maus.push(rel + ': ' + m[0]);
      }
    }
    assert.deepEqual(maus, [], 'uma classe que não existe na folha é um estilo que desapareceu do ecrã, sem erro nenhum');
  });
});

/* ===================== a gramática de cada ação ===================== */

/* O analisarAcao e o nomesDaAcao do próprio web/app/eventos.js, corridos num
   contexto à parte: uma gramática, um sítio.
   Devolve: {analisarAcao, nomesDaAcao}. */
function gramatica() {
  const janela = { addEventListener() {}, Math };
  janela.window = janela;
  const ctx = vm.createContext(janela);
  vm.runInContext(ler('web/app/eventos.js'), ctx, { filename: 'eventos.js' });
  return { analisarAcao: ctx.analisarAcao, nomesDaAcao: ctx.nomesDaAcao };
}

/* Os nomes que uma ação pode usar: function, var e window.x de topo em todos os
   ficheiros que o index.html carrega, e o Math (os let e const de topo não
   ficam no window). É a regra do eslint.config.mjs e do testes/globais.test.js.
   Devolve: um Set de nomes. */
function nomesDaApp() {
  const out = new Set(['Math']);
  for (const rel of TUDO) {
    for (const [nome, forma] of lerDeclaracoes(ler('web/' + rel), rel)) {
      if (forma === 'function' || forma === 'var' || forma === 'window') out.add(nome);
    }
  }
  return out;
}

const MARCA = '\u0001';

/* Lê o valor de um atributo a partir da posição logo depois da aspa que o
   abre, saltando os ${…} (com chavetas equilibradas: lá dentro há aspas).
   Recebe: src — o texto; i — a posição depois da aspa; aspa — a aspa que o abre.
   Devolve: o texto do valor. */
function lerValor(src, i, aspa) {
  let j = i;
  while (j < src.length) {
    if (src[j] === '$' && src[j + 1] === '{') {
      let fundo = 1;
      j += 2;
      while (j < src.length && fundo) { if (src[j] === '{') fundo++; else if (src[j] === '}') fundo--; j++; }
      continue;
    }
    if (src.startsWith(aspa, j) && !(aspa.length === 1 && src[j - 1] === '\\')) return src.slice(i, j);
    if (src[j] === '\n' && !src.slice(i, j).includes('${')) break;
    j++;
  }
  return src.slice(i, j);
}

/* O valor de um atributo, tal como está no código, feito ação: cada ${…} e cada
   concatenação ' + … + ' passa a um marcador, e os escapes do texto JavaScript
   e as entidades do esc() desfazem-se (o browser desfá-las ao ler o atributo).
   Recebe: c — o valor como está no código.
   Devolve: a ação, com marcadores. */
function acaoDoCodigo(c) {
  let s = '';
  for (let i = 0; i < c.length;) {
    if (c[i] === '$' && c[i + 1] === '{') {
      let fundo = 1, j = i + 2;
      while (j < c.length && fundo) { if (c[j] === '{') fundo++; else if (c[j] === '}') fundo--; j++; }
      s += MARCA;
      i = j;
      continue;
    }
    s += c[i++];
  }
  s = s.replace(/(?<!\\)'\s*\+[\s\S]*?\+\s*'/g, MARCA).replace(/(?<!\\)'\s*\+[\s\S]*$/, MARCA).replace(/^[\s\S]*?\+\s*'/, MARCA);
  s = s.replace(/\\(['"\\])/g, '$1');
  return s.replace(/&(quot|#0?39|amp|lt|gt);/g, (_, e) => ({ quot: '"', '#039': "'", '#39': "'", amp: '&', lt: '<', gt: '>' }[e]));
}

describe('cada ação declarada passa na gramática e só chama nomes da app', () => {
  const gram = gramatica();
  const nomes = nomesDaApp();

  test('controlo: a gramática e a lista dos nomes vieram', () => {
    assert.equal(typeof gram.analisarAcao, 'function');
    assert.ok(nomes.size > 500, 'a app declara os seus nomes de topo (' + nomes.size + ')');
    assert.throws(() => gram.analisarAcao('a = 1'), 'uma atribuição não é uma ação');
  });

  test('nenhuma ação sai da gramática, e nenhum nome dela é de fora da app', () => {
    const maus = [];
    for (const rel of FICHEIROS) {
      const src = ler(rel);
      const doWorker = rel.startsWith('worker/');
      for (const m of src.matchAll(/data-(click|change|input|keydown|pointerdown)\s*=\s*(\\?["'])/g)) {
        const valor = lerValor(src, m.index + m[0].length, m[2]);
        const linha = rel + ':' + src.slice(0, m.index).split('\n').length;
        let daAcao;
        try {
          daAcao = gram.nomesDaAcao(gram.analisarAcao(acaoDoCodigo(valor), { marcas: true }));
        } catch (e) {
          maus.push(linha + ': ' + e.message.split(' em «')[0] + ' — «' + valor.slice(0, 80) + '»');
          continue;
        }
        /* Um nome dinâmico (${…} no lugar do nome) não se consegue conferir
           aqui, e nas páginas do worker os nomes não são os da app: nesses dois
           casos fica só a gramática, como no verificador. */
        for (const { nome, dinamico } of daAcao) {
          if (!dinamico && !doWorker && !nomes.has(nome)) maus.push(linha + ': «' + nome + '» não é function, var nem window.x de topo em web/');
        }
      }
    }
    assert.deepEqual(maus, []);
  });
});

/* ================== defesa em profundidade nas janelas ================== */

describe('as janelas não deixam passar HTML que corre por si', () => {
  const MAU = '<p>antes</p>'
    + '<iframe srcdoc="&lt;script&gt;fuga()&lt;/script&gt;"></iframe>'
    + '<meta http-equiv="refresh" content="0;url=/outro">'
    + '<base href="https://exemplo.pt/">'
    + '<object data="/x"></object><embed src="/x">'
    + '<p>depois</p>';

  /* Uma ação declarada chega a todas as funções que recebem HTML (o openModal,
     o fillModal, o confirmModal, o pickModal), e isso equivale a uma injeção de
     HTML: um <iframe srcdoc> corre qualquer script desta origem com acesso ao
     parent — a CSP não o trava, porque o srcdoc herda-a e o script-src 'self'
     aceita os ficheiros da app. Todas passam pelo fillModal, e é lá que estas
     etiquetas se tiram, num sítio só. */
  test('o fillModal tira o iframe, o meta, o base, o object e o embed — e deixa o resto igual', () => {
    const app = carregarApp();
    const c = camadaFalsa();
    app.fillModal(c.el, 'Título', MAU, MAU, MAU);
    const sitios = [['corpo', c.body.innerHTML], ['rodapé', c.foot.innerHTML],
      ['menu do cabeçalho', c.el.querySelector('.head span').innerHTML]];
    for (const [onde, html] of sitios) {
      assert.doesNotMatch(html, /<\s*(iframe|meta|base|object|embed)\b/i, onde);
      assert.match(html, /<p>antes<\/p>/, onde + ': o resto do HTML fica igual');
      assert.match(html, /<p>depois<\/p>/, onde + ': e o que vinha depois também');
    }
    assert.equal(c.el.querySelector('.head h2').textContent, 'Título', 'o título continua a entrar como texto');
  });

  test('o rodapé por omissão continua a ser o Cancelar e o Guardar', () => {
    const app = carregarApp();
    const c = camadaFalsa();
    app.fillModal(c.el, 'T', '<p>x</p>');
    assert.match(c.foot.innerHTML, /data-click="closeModal\(\)"/);
    assert.match(c.foot.innerHTML, /data-click="onSave&&onSave\(\)"/);
  });

  test('nenhum HTML da app traz uma dessas etiquetas de propósito', () => {
    /* É o que torna a limpeza segura: se alguma vista precisasse de um
       <iframe>, tirá-lo calado partia-a. Conferido sobre o código, sem os
       comentários (que falam destas etiquetas para explicar a regra). */
    const maus = [];
    for (const rel of FICHEIROS.filter((f) => f.endsWith('.js') && f.startsWith('web/'))) {
      const semComentarios = ler(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of semComentarios.matchAll(/<\s*(iframe|meta|base|object|embed)\b/gi)) maus.push(rel + ': <' + m[1]);
    }
    assert.deepEqual(maus, []);
  });
});
