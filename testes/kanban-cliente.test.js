// O kanban da equipa no browser (worker/src/equipa-kanban.js): o guião que o
// /equipa/kanban.js serve e o CSS do /equipa/kanban.css. O guião é texto
// dentro de um String.raw e corre na página do back office, debaixo da
// CSP_ESTRITA, a seguir ao guião principal: tem de fazer parse, de ser o
// texto do ficheiro tal e qual, de não escrever nada que a CSP recuse, de só
// declarar nomes seus (kb…, kanban…, e os dois pontos de encaixe) e de só
// registar ações suas. As contas do arrasto, dos filtros e do histórico
// provam-se a correr o guião numa caixa com o mínimo do browser.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { recursoDePagina, CAMINHOS_DOS_RECURSOS } from '../worker/src/paginas-recursos.js';
import { GUIAO_KANBAN, CSS_KANBAN } from '../worker/src/equipa-kanban.js';
import { GUIAO } from '../worker/src/equipa-guiao.js';
import { caixa } from './lib/kanban-caixa.js';

const ler = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// o código sem os comentários (que podem contar como era, ou citar o que não se faz)
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* Os atributos de evento do HTML, como no testes/csp.test.js: com a lista, e
   não um on[a-z]+ qualquer, uma variável como «onde = …» não passa por
   atributo — e o on…= apanha-se com ou sem aspas. */
const EVENTOS_DO_HTML = ('abort animationend animationstart auxclick beforeinput blur cancel change click close contextmenu copy cut ' +
  'dblclick drag dragend dragenter dragleave dragover dragstart drop error focus focusin focusout input invalid keydown keypress ' +
  'keyup load mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup paste pointercancel pointerdown pointerenter ' +
  'pointerleave pointermove pointerout pointerover pointerup reset resize scroll scrollend select submit toggle touchcancel ' +
  'touchend touchmove touchstart transitionend wheel').split(' ');
const VALOR = String.raw`(?:\s*=\s*\\?["'` + '`' + String.raw`$]|=[^\s"'<>=` + '`' + String.raw`])`;
const RE_ON = new RegExp(String.raw`(?<=[\s"'/])on(?:` + EVENTOS_DO_HTML.join('|') + ')(?![a-z])' + VALOR, 'gi');
const RE_STYLE = new RegExp(String.raw`(?<=[\s"'/])style` + VALOR, 'gi');

/* Os nomes declarados na coluna zero de um guião (var, let, const, function, class).
   Recebe: src — o texto do guião.
   Devolve: [{tipo, nome}]. */
function deTopo(src) {
  const limpo = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^[ \t]*\/\/.*$/gm, '');
  const fora = [];
  for (const l of limpo.split('\n')) {
    const m = /^(var|let|const|function|class|async function)\s+([A-Za-z_$][\w$]*)/.exec(l);
    if (m) {
      fora.push({ tipo: m[1], nome: m[2] });
      // var a = 1, b = 2: os outros nomes da mesma linha
      if (m[1] === 'var') for (const x of l.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=/g)) fora.push({ tipo: 'var', nome: x[1] });
    }
  }
  return fora;
}

// o guião do kanban como o browser o recebe: pelo /equipa/kanban.js, com sessão de equipa
const servido = async () => (await recursoDePagina('/equipa/kanban.js', 'GET', async () => true)).text();

describe('o guião do kanban servido', () => {
  test('faz parse, e o /equipa/kanban.js serve-o sem mexer numa letra', async () => {
    const texto = await servido();
    assert.doesNotThrow(() => new Function(texto), 'o guião servido tem de fazer parse');
    assert.equal(texto, GUIAO_KANBAN);
    // e corre por cima do principal: os dois juntos, como na página
    assert.doesNotThrow(() => new Function(GUIAO + '\n' + texto), 'os dois guiões juntos fazem parse');
  });

  test('é o texto dos quatro ficheiros tal e qual, por ordem: sem crases nem interpolações lá dentro, nada escrito a dobrar', () => {
    // o guião vive em pedaços (o do quadro, os filtros, o arrasto e a janela), cada um um String.raw
    const pedacos = ['equipa-kanban.js', 'equipa-kanban-filtros.js', 'equipa-kanban-arrasto.js', 'equipa-kanban-janela.js'].map((f) => {
      const fonte = ler('worker/src/' + f);
      const inicio = fonte.indexOf('String.raw`');
      assert.ok(inicio > -1, f + ': o guião é um String.raw');
      assert.equal(fonte.indexOf('String.raw`', inicio + 1), -1, f + ': um pedaço só por ficheiro');
      const fim = fonte.indexOf('`;\n', inicio);
      const texto = fonte.slice(inicio + 'String.raw`'.length, fim);
      assert.doesNotMatch(texto, /\$\{|`/, f + ': sem interpolações nem crases');
      assert.doesNotMatch(texto, /\\\\[n']/, f + ': e nada dobrado');
      return texto;
    });
    assert.equal(GUIAO_KANBAN, pedacos.join(''), 'o que está escrito nos ficheiros é o que sai, pela ordem do GUIAO_KANBAN');
  });

  test('nada de alert(), prompt(), confirm() nem <select>', () => {
    const codigo = semComentarios(GUIAO_KANBAN);
    assert.ok(codigo.length > GUIAO_KANBAN.length / 2, 'controlo: tirar os comentários deixou o código');
    assert.doesNotMatch(codigo, /\balert\(/);
    assert.doesNotMatch(codigo, /\bprompt\(/);
    assert.doesNotMatch(codigo, /\bconfirm\(/);
    assert.doesNotMatch(codigo, /<select/i);
    assert.match(codigo, /type="radio"/, 'controlo: as escolhas são rádios em chips');
  });

  test('o HTML que escreve não leva on…= nem style= (a CSP_ESTRITA não os corria); mexe por CSSOM', () => {
    const maus = [...GUIAO_KANBAN.matchAll(RE_ON), ...GUIAO_KANBAN.matchAll(RE_STYLE)].map((m) => m[0]);
    assert.deepEqual(maus, []);
    assert.doesNotMatch(GUIAO_KANBAN, /\son[a-z]+\s*=/i, 'nem uma variável começada por on à frente de um =');
    assert.doesNotMatch(GUIAO_KANBAN, /\sstyle\s*=/i);
    assert.doesNotMatch(GUIAO_KANBAN, /setAttribute\(\s*['"](?:on[a-z]+|style)['"]/);
    assert.doesNotMatch(GUIAO_KANBAN, /<style/i, 'nem folhas em linha');
    assert.match(GUIAO_KANBAN, /\.style\.transform = 'translate\(/, 'controlo: o arrasto mexe pelo transform');
    // controlo: as expressões apanham o que deviam
    assert.equal([...' onclick="x"'.matchAll(RE_ON)].length, 1);
    assert.equal([...' style="x"'.matchAll(RE_STYLE)].length, 1);
  });

  test('os nomes de topo são do kanban (kb…, kanban…, mais verKanban e novoCartao), só var e function, e nenhum é do guião principal', () => {
    const nomes = deTopo(GUIAO_KANBAN);
    assert.ok(nomes.length > 50, 'controlo: achou os nomes');
    const fora = nomes.filter((n) => !/^(?:kb|KB_|kanban)/.test(n.nome) && n.nome !== 'verKanban' && n.nome !== 'novoCartao');
    assert.deepEqual(fora, []);
    assert.deepEqual(nomes.filter((n) => n.tipo !== 'var' && n.tipo !== 'function'), [], 'num script clássico só var e function ficam em window');
    const doGuiao = new Set(deTopo(GUIAO).map((n) => n.nome));
    assert.ok(doGuiao.has('ACOES') && doGuiao.has('formulario'), 'controlo: leu os do guião');
    assert.deepEqual(nomes.filter((n) => doGuiao.has(n.nome)).map((n) => n.nome), [], 'nenhum nome repete um do guião');
    for (const n of ['verKanban', 'novoCartao']) assert.ok(nomes.some((x) => x.nome === n && x.tipo === 'function'), n + ' é uma function');
  });

  test('as ações registadas em ACOES começam por kb, e todas as que o HTML chama existem', () => {
    const ctx = caixa();
    const registadas = Object.keys(ctx.ACOES);
    assert.ok(registadas.length > 20, 'controlo: registou as ações');
    assert.deepEqual(registadas.filter((n) => !/^kb[A-Z]/.test(n)), []);
    for (const n of registadas) assert.equal(typeof ctx.ACOES[n], 'function', n);
    // o que o texto escreve com comAcao/ligarA: do kanban, ou do guião principal
    const doGuiao = new Set([...GUIAO.matchAll(/^ {2}(\w+): function/gm)].map((m) => m[1]));
    assert.ok(doGuiao.has('fecharDialogo'), 'controlo: leu as ações do guião');
    const chamadas = new Set([...GUIAO_KANBAN.matchAll(/comAcao\('(\w+)'/g), ...GUIAO_KANBAN.matchAll(/ligarA\('(?:enter|mudar)', '(\w+)'/g)].map((m) => m[1]));
    assert.ok(chamadas.size > 20, 'controlo: achou as chamadas');
    assert.deepEqual([...chamadas].filter((n) => !registadas.includes(n) && !doGuiao.has(n)), []);
    assert.deepEqual(Object.keys(ctx.ICONES).filter((n) => !/^kb[A-Z]/.test(n)), [], 'os desenhos novos também são kb');
  });

  test('os pontos de encaixe e as funções têm o comentário com Recebe e Devolve', () => {
    const linhas = GUIAO_KANBAN.split('\n');
    const sem = [];
    let n = 0;
    linhas.forEach((l, i) => {
      if (!/^function \w+\(/.test(l)) return;
      n++;
      // o comentário colado por cima: um bloco /* … */ ou as linhas //
      let doc = '', j = i - 1;
      if (/\*\/\s*$/.test(linhas[j] || '')) { while (j >= 0 && !/^\s*\/\*/.test(linhas[j])) doc = linhas[j--] + '\n' + doc; doc = (linhas[j] || '') + '\n' + doc; }
      else while (j >= 0 && /^\s*\/\//.test(linhas[j])) doc = linhas[j--] + '\n' + doc;
      const temArgs = !/\(\s*\)/.test(l);
      if (!/Devolve:/.test(doc) || (temArgs && !/Recebe:/.test(doc))) sem.push(l);
    });
    assert.ok(n > 60, 'controlo: achou as funções');
    assert.deepEqual(sem, []);
  });
});

describe('servidos pelo worker', () => {
  test('o /equipa/kanban.js só com sessão de equipa; o /equipa/kanban.css a toda a gente', async () => {
    assert.ok(CAMINHOS_DOS_RECURSOS.includes('/equipa/kanban.js') && CAMINHOS_DOS_RECURSOS.includes('/equipa/kanban.css'));
    const sem = await recursoDePagina('/equipa/kanban.js', 'GET', async () => false);
    assert.equal(sem.status, 401);
    assert.doesNotMatch(await sem.text(), /function|\{/, 'sem sessão não sai nada');
    const com = await recursoDePagina('/equipa/kanban.js', 'GET', async () => true);
    assert.equal(com.status, 200);
    assert.equal(com.headers.get('Content-Type'), 'text/javascript; charset=utf-8');
    assert.equal(com.headers.get('Cache-Control'), 'no-store');
    let perguntou = false;
    const css = await recursoDePagina('/equipa/kanban.css', 'GET', async () => { perguntou = true; return false; });
    assert.equal(css.status, 200);
    assert.equal(perguntou, false, 'o CSS nem pergunta pela sessão');
    assert.equal(css.headers.get('Content-Type'), 'text/css; charset=utf-8');
    assert.equal(await css.text(), CSS_KANBAN);
    assert.equal((await recursoDePagina('/equipa/kanban.js', 'POST', async () => true)).status, 405);
  });
});

describe('o CSS do kanban', () => {
  test('nenhum :hover fora de @media(hover:hover) and (pointer:fine)', () => {
    let fora = CSS_KANBAN;
    const portao = '@media(hover:hover) and (pointer:fine){';
    let i;
    while ((i = fora.indexOf(portao)) > -1) {
      let n = 0, j = i + portao.length - 1;
      for (; j < fora.length; j++) { if (fora[j] === '{') n++; else if (fora[j] === '}' && --n === 0) break; }
      fora = fora.slice(0, i) + fora.slice(j + 1);
    }
    assert.ok(fora.length < CSS_KANBAN.length, 'controlo: o portão existe');
    assert.doesNotMatch(fora, /:hover/);
  });

  test('as cores só por tokens: nem hexadecimais, nem rgb/hsl, nem nomes; e não redeclara o :root', () => {
    const semComent = CSS_KANBAN.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(semComent, /#[0-9a-f]{3,8}\b/i);
    assert.doesNotMatch(semComent, /\b(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab)\(/i);
    assert.doesNotMatch(semComent, /:\s*(?:white|black|red|green|blue|gray|grey|orange|yellow|purple)\b/i);
    assert.doesNotMatch(semComent, /:root/);
    assert.match(semComent, /var\(--accent\)/, 'controlo: usa os tokens');
  });

  test('todas as regras são de classes kb-, e o movimento usa os tokens e respeita o menos movimento', () => {
    const semComent = CSS_KANBAN.replace(/\/\*[\s\S]*?\*\//g, '');
    const maus = [];
    for (const m of semComent.matchAll(/([^{}]+)\{/g)) {
      const sel = m[1].trim();
      if (/^@|^(?:from|to|\d+%)$/.test(sel)) continue;
      for (const s of sel.split(',')) if (!/\.kb-/.test(s)) maus.push(s.trim());
    }
    assert.deepEqual(maus, []);
    assert.doesNotMatch(semComent, /transition:\s*all\b/);
    assert.doesNotMatch(semComent, /(?:transition|animation)[^;{}]*\b\d*\.?\d+m?s\b/, 'durações só por --rapido/--medio');
    assert.match(semComent, /@media\(prefers-reduced-motion:reduce\)/);
    assert.match(semComent, /var\(--eq-barra, 0px\)/, 'afasta-se da barra de baixo');
  });
});

describe('as contas do quadro', () => {
  const ctx = caixa();
  const cartoes = [
    { chave: 'KAN-1', coluna_id: 'a', tipo: 'tarefa', etiquetas: ['qa'], prioridade: 3, responsavel: { id: 'eu1', nome: 'Eu' }, pai: null },
    { chave: 'KAN-2', coluna_id: 'a', tipo: 'erro', etiquetas: [], prioridade: 1, responsavel: null, pai: { chave: 'KAN-9', tipo: 'epico', titulo: 'E' } },
    { chave: 'KAN-3', coluna_id: 'a', tipo: 'tarefa', etiquetas: ['design'], prioridade: 3, responsavel: { id: 'x', nome: 'X' }, pai: null },
    { chave: 'KAN-4', coluna_id: 'b', tipo: 'historia', etiquetas: [], prioridade: 2, responsavel: null, pai: null },
  ];
  const chaves = (l, col) => Array.from(l).filter((c) => c.coluna_id === col).map((c) => c.chave);

  test('mover na ordem local: o indice conta sem o próprio cartão, e maior do que o total vai para o fim', () => {
    assert.deepEqual(chaves(ctx.kbMoverLocal(cartoes, 'KAN-1', 'a', 2), 'a'), ['KAN-2', 'KAN-3', 'KAN-1']);
    assert.deepEqual(chaves(ctx.kbMoverLocal(cartoes, 'KAN-3', 'a', 0), 'a'), ['KAN-3', 'KAN-1', 'KAN-2']);
    const outra = ctx.kbMoverLocal(cartoes, 'KAN-2', 'b', 0);
    assert.deepEqual(chaves(outra, 'b'), ['KAN-2', 'KAN-4']);
    assert.deepEqual(chaves(outra, 'a'), ['KAN-1', 'KAN-3']);
    assert.deepEqual(chaves(ctx.kbMoverLocal(cartoes, 'KAN-2', 'b', 99), 'b'), ['KAN-4', 'KAN-2']);
    assert.deepEqual(chaves(ctx.kbMoverLocal(cartoes, 'KAN-4', 'nova', 0), 'nova'), ['KAN-4'], 'uma coluna vazia');
    assert.equal(cartoes[1].coluna_id, 'a', 'a lista antiga fica como estava (é o que se repõe se o servidor recusar)');
  });

  test('o indice do servidor sai dos vizinhos à vista, mesmo com cartões escondidos pelos filtros', () => {
    const ordem = ['KAN-1', 'KAN-2', 'KAN-3', 'KAN-5'];
    assert.equal(ctx.kbIndiceEntre(ordem, 'KAN-3', 'KAN-1'), 2, 'antes do KAN-3, com o KAN-2 escondido entre eles');
    assert.equal(ctx.kbIndiceEntre(ordem, '', 'KAN-5'), 4, 'no fim');
    assert.equal(ctx.kbIndiceEntre(ordem, 'KAN-1', ''), 0, 'no topo');
    assert.equal(ctx.kbIndiceEntre(ordem, '', ''), 4, 'numa coluna sem nada à vista: no fim');
    assert.equal(ctx.kbIndiceEntre([], '', ''), 0);
  });

  test('os filtros: tipo, etiqueta, os meus, responsável, prioridade, épico e a pesquisa (pelas chaves que o servidor achou)', () => {
    const f = (o) => Object.assign(ctx.kbSemFiltros(), o);
    const passam = (o, q) => cartoes.filter((c) => ctx.kbPassa(c, f(o), q || null, 'eu1')).map((c) => c.chave);
    assert.deepEqual(passam({}), ['KAN-1', 'KAN-2', 'KAN-3', 'KAN-4']);
    assert.deepEqual(passam({ tipo: 'tarefa' }), ['KAN-1', 'KAN-3']);
    assert.deepEqual(passam({ etiqueta: 'qa' }), ['KAN-1']);
    assert.deepEqual(passam({ responsavel: 'eu' }), ['KAN-1']);
    assert.deepEqual(passam({ responsavel: 'x' }), ['KAN-3']);
    assert.deepEqual(passam({ prioridade: '1' }), ['KAN-2']);
    assert.deepEqual(passam({ pai: 'KAN-9' }), ['KAN-2']);
    assert.deepEqual(passam({ q: 'aviso' }, { chaves: { 'KAN-3': true, 'KAN-4': true } }), ['KAN-3', 'KAN-4']);
    assert.deepEqual(passam({ tipo: 'tarefa', q: 'aviso' }, { chaves: { 'KAN-3': true, 'KAN-4': true } }), ['KAN-3']);
    assert.equal(ctx.kbQuantosFiltros(f({ q: 'x', tipo: 'erro' })), 2);
    assert.equal(ctx.kbQuantosFiltros(ctx.kbSemFiltros()), 0);
  });

  test('o histórico em frases, com os nomes das colunas, dos tipos e das prioridades', () => {
    ctx.kbEstado = { colunas: [{ id: 'a-fazer', nome: 'A fazer' }, { id: 'auto-tests', nome: 'Auto Tests' }], cartoes: [], etiquetas: [],
      pessoas: [{ id: 'claude', nome: 'Claude' }], eu: { id: 'eu1', nome: 'Eu', master: true } };
    assert.equal(ctx.kbFrase({ campo: 'coluna', antes: 'a-fazer', depois: 'auto-tests' }), 'Moveu de A fazer para Auto Tests');
    assert.equal(ctx.kbFrase({ campo: 'prioridade', antes: '3', depois: '2' }), 'Mudou a prioridade de Média para Alta');
    assert.equal(ctx.kbFrase({ campo: 'tipo', antes: 'tarefa', depois: 'erro' }), 'Mudou o tipo de Tarefa para Erro');
    assert.equal(ctx.kbFrase({ campo: 'responsavel', antes: null, depois: 'claude' }), 'Atribuiu a Claude');
    assert.equal(ctx.kbFrase({ campo: 'responsavel', antes: 'claude', depois: null }), 'Removeu o responsável (Claude)');
    assert.equal(ctx.kbFrase({ campo: 'titulo', antes: 'a<b', depois: 'c' }), 'Mudou o título de «a&lt;b» para «c»', 'o que vem do servidor sai escapado');
    assert.equal(ctx.kbFrase({ campo: 'prazo', antes: null, depois: '2026-11-30' }), 'Mudou o prazo para 30/11/2026');
    assert.equal(ctx.kbFrase({ campo: 'etiquetas', antes: 'qa', depois: 'qa,design' }), 'Mudou as etiquetas de qa para qa, design');
    assert.equal(ctx.kbFrase({ campo: 'criado', antes: null, depois: 'a-fazer' }), 'Criou o cartão em A fazer');
  });

  test('chaves, etiquetas, contagens e o campo de que fala uma recusa', () => {
    assert.equal(ctx.kbChave('kan-77'), 'KAN-77');
    assert.equal(ctx.kbChave(' 77 '), 'KAN-77');
    assert.equal(ctx.kbChave('KAN-'), '');
    assert.equal(ctx.kbChave('KAN-7x'), '');
    assert.deepEqual([...ctx.kbEtiquetasDe('QA, a espera,qa, ').lista], ['qa', 'a-espera']);
    assert.match(ctx.kbEtiquetasDe('x'.repeat(41)).erro, /até 40 caracteres/);
    assert.match(ctx.kbEtiquetasDe(Array.from({ length: 21 }, (_, i) => 't' + i).join(',')).erro, /Até 20 etiquetas/);
    assert.equal(ctx.kbConta(1, 'cartão', 'cartões'), '1 cartão');
    assert.equal(ctx.kbConta(0, 'cartão', 'cartões'), '0 cartões');
    assert.equal(ctx.kbCampoDoErro('O título é obrigatório.'), 'kbF-titulo');
    assert.equal(ctx.kbCampoDoErro('Um épico não tem pai.'), 'kbF-pai');
    assert.equal(ctx.kbCampoDoErro('Algo correu mal.'), '');
    assert.equal(ctx.kbDia('2026-01-05'), '05/01/2026');
  });
});

describe('o cartão aberto', () => {
  const ctx = caixa();
  ctx.kbEstado = { colunas: [{ id: 'a-fazer', nome: 'A fazer', fim: false }], cartoes: [], etiquetas: [], pessoas: [], eu: { id: 'eu1', nome: 'Eu', master: false } };
  const detalhe = (cartao, origem) => ({ cartao: Object.assign({ chave: 'KAN-80', tipo: 'tarefa', titulo: 'Assunto <b>', coluna_id: 'a-fazer', prioridade: 3, etiquetas: [] }, cartao),
    subtarefas: [], comentarios: [], historico: [], ligacoes: [], anexos: [], origem: origem || null });

  test('a descrição de um pedido escondida a quem não vê os pedidos: a frase no lugar dela, sem selo de erro', () => {
    const oculto = ctx.kbPainelHtml(detalhe({ descricao: '', descricaoOculta: true }, { tipo: 'pedido', id: 'p-1', estado: 'aceite', existe: true }), false);
    assert.match(oculto, /O texto deste pedido só se mostra a quem vê os pedidos\./);
    assert.doesNotMatch(oculto, /badge dg[^>]*>[^<]*(?:pedido|texto)/i, 'sem selo de erro');
    const visivel = ctx.kbPainelHtml(detalhe({ descricao: 'O texto <i>todo</i>' }), false);
    assert.match(visivel, /O texto &lt;i&gt;todo&lt;\/i&gt;/, 'com a descrição, ela aparece (escapada)');
    assert.doesNotMatch(visivel, /só se mostra a quem vê os pedidos/);
    assert.match(visivel, /Assunto &lt;b&gt;/, 'o título sai escapado');
  });

  test('a origem: um pedido daqui abre na secção Pedidos; um da produção diz-se com o #curto e abre no back office da produção', () => {
    const aqui = ctx.kbOrigemHtml({ tipo: 'pedido', id: 'abcd1234-ef', estado: 'aceite', resumo: 'Assunto', existe: true });
    assert.match(aqui, /Pedido de ajuda/);
    assert.match(aqui, /data-acao="kbAbrirPedido" data-arg="abcd1234-ef"/);
    const semCampo = ctx.kbOrigemHtml({ tipo: 'pedido', id: 'abcd1234-ef', estado: 'aceite' });
    assert.match(semCampo, /data-acao="kbAbrirPedido"/, 'sem o campo existe, fica como estava');
    const prod = ctx.kbOrigemHtml({ tipo: 'pedido', id: 'abcd1234-ef99', estado: 'aceite', existe: false });
    assert.match(prod, /Pedido da produção #ABCD1234EF99|Pedido da produção #ABCD1234/);
    assert.match(prod, /<a class="btn sm" href="https:\/\/rendorium\.com\/equipa#pedidos\/abcd1234-ef99" target="_blank" rel="noopener">Abrir no back office da produção<\/a>/);
    assert.doesNotMatch(prod, /kbAbrirPedido/);
    const qa = ctx.kbOrigemHtml({ tipo: 'qa', id: 'q1', estado: 'auto-tests', resumo: 'O botão não responde' });
    assert.match(qa, /Ticket de QA/);
    assert.doesNotMatch(qa, /auto-tests|Auto Tests/, 'o estado de um ticket de QA é a coluna do cartão: não se repete');
    assert.doesNotMatch(qa, /kbAbrirPedido|rendorium\.com/);
  });
});
