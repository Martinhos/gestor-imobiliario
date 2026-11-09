// Os filtros, o seletor, as etiquetas e a ordem das colunas do kanban da equipa
// (worker/src/equipa-kanban-filtros.js), a correr o guião numa caixa com o mínimo
// do browser (testes/lib/kanban-caixa.js): o HTML, as contas e o que se guarda. O que
// precisa de um browser a sério (abrir e fechar o painel, o toque, o teclado) prova-se
// no browser, no servidor isolado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { GUIAO_KANBAN, CSS_KANBAN } from '../worker/src/equipa-kanban.js';
import { caixa } from './lib/kanban-caixa.js';

const ESTADO = () => ({
  colunas: [{ id: 'a', nome: 'A fazer', fim: false }, { id: 'b', nome: 'Feito', fim: true }],
  cartoes: [
    { chave: 'KAN-1', coluna_id: 'a', tipo: 'tarefa', titulo: 'banana', etiquetas: ['qa'], prioridade: 3, responsavel: { id: 'eu1', nome: 'Eu' }, pai: null,
      prazo: '2026-12-01', created_at: 300, updated_at: 900 },
    { chave: 'KAN-2', coluna_id: 'a', tipo: 'erro', titulo: 'Abacate', etiquetas: [], prioridade: 1, responsavel: null, pai: { chave: 'KAN-9' },
      prazo: null, created_at: 100, updated_at: 950 },
    { chave: 'KAN-3', coluna_id: 'a', tipo: 'tarefa', titulo: 'cereja 10', etiquetas: ['design'], prioridade: 5, responsavel: { id: 'x', nome: 'X' }, pai: null,
      prazo: '2026-11-20', created_at: 200, updated_at: 100 },
    { chave: 'KAN-4', coluna_id: 'a', tipo: 'historia', titulo: 'cereja 9', etiquetas: [], prioridade: 3, responsavel: null, pai: null,
      prazo: null, created_at: 400, updated_at: 500 },
    { chave: 'KAN-9', coluna_id: 'b', tipo: 'epico', titulo: 'Épico', etiquetas: [], prioridade: 2, responsavel: null, pai: null, created_at: 1, updated_at: 1 },
  ],
  etiquetas: ['design', 'qa'],
  pessoas: [{ id: 'eu1', nome: 'Eu' }, { id: 'x', nome: 'Xavier' }],
  eu: { id: 'eu1', nome: 'Eu', master: true },
});
const chaves = (l) => Array.from(l).map((c) => c.chave);

describe('o seletor', () => {
  const ctx = caixa();

  test('de uma escolha: um botão que abre uma lista de botões, com aria-expanded, aria-controls e a escolhida marcada', () => {
    const html = ctx.kbSelHtml('kbT-um', { opcoes: [['', 'Todos'], ['a', 'Alfa'], ['b', 'Beta <b>']], valor: 'b', filtro: true, rotuloId: 'r1' });
    assert.match(html, /<button type="button" class="kb-sel-botao" id="kbT-um" aria-haspopup="listbox" aria-expanded="false" aria-controls="kbT-um-ops"/);
    assert.match(html, /aria-labelledby="r1 kbT-um-txt"/, 'o nome por cima e o valor');
    assert.match(html, /id="kbT-um-txt">Beta &lt;b&gt;<\/span>/, 'o botão diz a escolhida, escapada');
    assert.match(html, /class="kb-sel kb-sel-on"/, 'um filtro com escolha acende-se');
    assert.match(html, /class="kb-sel-lista" id="kbT-um-lista" data-gesto hidden>/, 'a lista começa fechada e a folha não arranca dela');
    assert.match(html, /role="listbox" id="kbT-um-ops"/);
    assert.doesNotMatch(html, /aria-multiselectable/);
    assert.equal((html.match(/role="option"/g) || []).length, 3);
    assert.match(html, /id="kbT-um-op2" aria-selected="true" data-acao="kbSelEscolher" data-arg="kbT-um" data-arg2="2"/);
    assert.match(html, /id="kbT-um-op0" aria-selected="false"/);
    assert.doesNotMatch(html, /<select/i);
    // sem escolha, não se acende e diz a primeira
    const vazio = ctx.kbSelHtml('kbT-um', { opcoes: [['', 'Todos'], ['a', 'Alfa']], valor: '', filtro: true });
    assert.match(vazio, /class="kb-sel"/);
    assert.match(vazio, /id="kbT-um-txt">Todos</);
  });

  test('escolher: uma escolha troca o valor; várias marcam e desmarcam', () => {
    const um = { multi: false, valor: 'a' };
    assert.equal(ctx.kbSelValorNovo(um, 'b'), 'b');
    const varias = { multi: true, valor: ['qa'] };
    assert.deepEqual([...ctx.kbSelValorNovo(varias, 'design')], ['qa', 'design']);
    assert.deepEqual([...ctx.kbSelValorNovo(varias, 'qa')], []);
    assert.deepEqual([...varias.valor], ['qa'], 'não muda a lista que tinha');
  });

  test('várias escolhas: aria-multiselectable, a contagem no botão, os selos com o × e a «Nova etiqueta» no fim', () => {
    const html = ctx.kbSelHtml('kbT-v', { multi: true, opcoes: [['qa', 'qa'], ['design', 'design']], valor: ['qa', 'nova'], um: 'etiqueta', varios: 'etiquetas', nova: 'Nova etiqueta' });
    assert.match(html, /role="listbox" id="kbT-v-ops" aria-multiselectable="true"/);
    assert.match(html, /id="kbT-v-txt">2 etiquetas</);
    assert.match(html, /<div class="kb-selos" id="kbT-v-selos"><span class="kb-selo"><span class="kb-selo-txt">qa<\/span><button type="button" class="kb-selo-x" aria-label="Remover «qa»" data-acao="kbSelTirar" data-arg="kbT-v" data-arg2="qa"/);
    const fim = html.slice(html.indexOf('</div>', html.indexOf('id="kbT-v-ops"')));
    assert.match(fim, /kb-sel-nova[^>]*data-acao="kbSelNova" data-arg="kbT-v"[\s\S]*Nova etiqueta/, 'a «Nova etiqueta» vem depois das opções');
    assert.ok(html.indexOf('Nova etiqueta') > html.lastIndexOf('role="option"'), 'no fim da lista');
    assert.equal(ctx.kbSelTexto({ multi: true, valor: ['a'], um: 'etiqueta', varios: 'etiquetas' }), '1 etiqueta');
    assert.equal(ctx.kbSelTexto({ multi: true, valor: [], vazio: 'Escolher etiquetas' }), 'Escolher etiquetas');
    // aberta, a «Nova etiqueta» é um campo com o erro ao lado, Cancelar e Adicionar (nunca o prompt)
    ctx.kbSels['kbT-v'].novaAberta = true;
    const aberta = ctx.kbSelListaHtml('kbT-v');
    assert.match(aberta, /<input id="kbT-v-novo" class="campo" type="text"[^>]*placeholder="Ex: pagamentos" aria-describedby="kbT-v-novoErro" data-enter="kbSelNovaOk" data-arg="kbT-v">/);
    assert.match(aberta, /<p class="erro-txt" id="kbT-v-novoErro"><\/p>/);
    assert.match(aberta, /data-acao="kbSelNovaOk" data-arg="kbT-v">Adicionar</);
    assert.doesNotMatch(semComentarios(GUIAO_KANBAN), /\bprompt\(/);
  });

  test('a lista abre por baixo, ou por cima quando lá cabe melhor, e encolhe para não sair cortada', () => {
    const lim = { top: 0, bottom: 800 };
    assert.deepEqual({ ...ctx.kbSelLado({ top: 100, bottom: 146 }, lim, 280) }, { cima: false, max: 0 });
    assert.deepEqual({ ...ctx.kbSelLado({ top: 600, bottom: 646 }, lim, 280) }, { cima: true, max: 0 });
    assert.deepEqual({ ...ctx.kbSelLado({ top: 200, bottom: 246 }, { top: 150, bottom: 400 }, 280) }, { cima: false, max: 146 }, 'no corpo da janela que rola: encolhe');
    assert.equal(ctx.kbSelLado({ top: 10, bottom: 56 }, { top: 0, bottom: 100 }, 280).max, 96, 'nunca abaixo de 96px');
  });

  test('o teclado: as setas andam e param nas pontas, o Home e o End vão às pontas', () => {
    assert.equal(ctx.kbSelIndice(-1, 4, 'ArrowDown'), 0);
    assert.equal(ctx.kbSelIndice(-1, 4, 'ArrowUp'), 3);
    assert.equal(ctx.kbSelIndice(3, 4, 'ArrowDown'), 3);
    assert.equal(ctx.kbSelIndice(0, 4, 'ArrowUp'), 0);
    assert.equal(ctx.kbSelIndice(1, 4, 'ArrowDown'), 2);
    assert.equal(ctx.kbSelIndice(2, 4, 'Home'), 0);
    assert.equal(ctx.kbSelIndice(0, 4, 'End'), 3);
    assert.equal(ctx.kbSelIndice(0, 0, 'ArrowDown'), -1);
    // o ouvinte do teclado é na captura e engole o Esc de uma lista aberta (a janela por baixo fica)
    assert.match(GUIAO_KANBAN, /if \(kbSelAberto\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); kbSelFechar\(true\); \}/);
    assert.match(GUIAO_KANBAN, /\}, true\);\n\/\* Um toque ou clique fora da lista aberta fecha-a/);
  });
});

describe('os filtros no painel', () => {
  const ctx = caixa();
  ctx.kbEstado = ESTADO();

  test('o painel: Filtros com Fechar, quantos passam, e os seis campos com o nome por cima e um seletor', () => {
    ctx.kbFiltros = ctx.kbSemFiltros();
    const html = ctx.kbFPainelHtml();
    assert.match(html, /<h2 class="kb-fp-tit" id="kbFTit">Filtros<\/h2><button type="button" class="btn sm" data-acao="kbFiltrosFechar">Fechar<\/button>/, 'sem filtros, sem Limpar');
    assert.match(html, /Aplicam-se ao mexer · 5 cartões/);
    const nomes = [...html.matchAll(/<span class="rot" id="kbFS-(\w+)-rot">([^<]+)<\/span>/g)].map((m) => m[2]);
    assert.deepEqual(nomes, ['Os meus', 'Tipo', 'Etiqueta', 'Responsável', 'Prioridade', 'Épico']);
    assert.equal((html.match(/class="kb-sel-botao"/g) || []).length, 6);
    assert.doesNotMatch(html, /kb-sel-on/);
    assert.match(html, /id="kbFS-pai-op1" aria-selected="false"[^>]*><span class="kb-sel-op-txt">KAN-9 · Épico</, 'os épicos do quadro');
  });

  test('cada seletor filtra (pelo aoMudar), o funil conta sem a pesquisa, e o painel diz quantos passam', () => {
    ctx.kbFiltros = ctx.kbSemFiltros();
    ctx.kbFPainelHtml();
    const mudou = [], antes = ctx.kbFiltrar;
    ctx.kbFiltrar = (campo, v) => { mudou.push([campo, v]); ctx.kbFiltros[campo] = v; };
    try {
      ctx.kbSels['kbFS-tipo'].aoMudar('tarefa');
      ctx.kbSels['kbFS-meus'].aoMudar('eu');
      ctx.kbSels['kbFS-etiqueta'].aoMudar('qa');
    } finally { ctx.kbFiltrar = antes; }
    assert.deepEqual(mudou, [['tipo', 'tarefa'], ['responsavel', 'eu'], ['etiqueta', 'qa']], '«Os meus» mexe no responsável');
    assert.equal(ctx.kbNFunil(ctx.kbFiltros), 3);
    ctx.kbFiltros.q = 'banana';
    assert.equal(ctx.kbNFunil(ctx.kbFiltros), 3, 'a pesquisa está à vista: não conta no funil');
    assert.equal(ctx.kbQuantosFiltros(ctx.kbFiltros), 4);
    ctx.kbFiltros.q = '';
    const html = ctx.kbFPainelHtml();
    assert.match(html, /data-acao="kbLimparFiltros">Limpar</, 'com filtros, o Limpar');
    assert.match(html, /Aplicam-se ao mexer · 1 de 5 cartões/);
    assert.match(html, /<div class="kb-sel kb-sel-on" id="kbFS-tipo-sel">/);
    assert.match(html, /id="kbFS-meus-txt">Só os meus</);
    assert.match(html, /id="kbFS-responsavel-txt">Eu \(os meus\)</, 'os dois campos dizem o mesmo filtro');
    assert.deepEqual(chaves(ctx.kbVisiveis('a')), ['KAN-1']);
  });

  test('«Todos» no «Os meus» não tira uma pessoa escolhida no Responsável', () => {
    ctx.kbFiltros = Object.assign(ctx.kbSemFiltros(), { responsavel: 'x' });
    ctx.kbFPainelHtml();
    const mudou = [], antes = ctx.kbFiltrar;
    ctx.kbFiltrar = (campo, v) => mudou.push([campo, v]);
    try {
      ctx.kbSels['kbFS-meus'].aoMudar('');
      ctx.kbFiltros.responsavel = 'eu';
      ctx.kbSels['kbFS-meus'].aoMudar('');
    } finally { ctx.kbFiltrar = antes; }
    assert.deepEqual(mudou, [['responsavel', '']], 'só tira quando o filtro era o «Os meus»');
    ctx.kbFiltros = ctx.kbSemFiltros();
  });

  test('um filtro que já não está no quadro (uma etiqueta removida) continua à vista para se poder tirar', () => {
    ctx.kbFiltros = Object.assign(ctx.kbSemFiltros(), { etiqueta: 'velha' });
    assert.match(ctx.kbFPainelHtml(), /id="kbFS-etiqueta-txt">velha</);
  });

  test('os filtros guardados de uma sessão anterior (kb_filtros) continuam a ler-se', () => {
    const c = caixa();
    c.sessionStorage = { getItem: (k) => (k === 'kb_filtros' ? JSON.stringify({ q: 'aviso', tipo: 'erro', etiqueta: 'qa', responsavel: 'eu', prioridade: '1', pai: 'KAN-9', lixo: 'x' }) : null), setItem() {} };
    assert.deepEqual({ ...c.kbLerFiltros() }, { q: 'aviso', tipo: 'erro', etiqueta: 'qa', responsavel: 'eu', prioridade: '1', pai: 'KAN-9' });
    c.sessionStorage = { getItem() { throw new Error('bloqueado'); } };
    assert.deepEqual({ ...c.kbLerFiltros() }, { ...c.kbSemFiltros() }, 'sem armazenamento, sem filtros');
  });
});

describe('as etiquetas do formulário', () => {
  const ctx = caixa();
  ctx.kbEstado = ESTADO();

  test('o campo: o seletor de várias com as do quadro e as do cartão, a «Nova etiqueta» e o erro ao lado', () => {
    const html = ctx.kbEtiquetasCampoHtml(['qa', 'so-deste']);
    assert.match(html, /<span class="rot" id="kbF-etiquetasRot">Etiquetas<\/span>/);
    assert.match(html, /id="kbF-etiquetas" aria-haspopup="listbox"[^>]*aria-describedby="kbF-etiquetasErro"/);
    assert.deepEqual([...html.matchAll(/<span class="kb-sel-op-txt">([^<]+)<\/span>/g)].map((m) => m[1]), ['design', 'qa', 'so-deste', 'Nova etiqueta']);
    assert.match(html, /id="kbF-etiquetas-txt">2 etiquetas</);
    assert.match(html, /<p class="erro-txt" id="kbF-etiquetasErro"><\/p>/);
    assert.deepEqual([...ctx.kbSelValor('kbF-etiquetas')], ['qa', 'so-deste']);
  });

  test('a etiqueta nova segue as regras do servidor; e as escolhidas também (kbEtiquetasDe com a lista)', () => {
    assert.deepEqual({ ...ctx.kbEtiquetaNova('  À Espera ') }, { nome: 'à-espera', erro: '' });
    assert.match(ctx.kbEtiquetaNova('   ').erro, /Escreve o nome/);
    assert.match(ctx.kbEtiquetaNova('x'.repeat(41)).erro, /Até 40 caracteres \(esta tem 41\)/);
    assert.deepEqual([...ctx.kbEtiquetasDe(['QA', 'a espera', 'qa', '']).lista], ['qa', 'a-espera']);
    assert.match(ctx.kbEtiquetasDe(['x'.repeat(41)]).erro, /até 40 caracteres/);
    assert.match(ctx.kbEtiquetasDe(Array.from({ length: 21 }, (_, i) => 't' + i)).erro, /Até 20 etiquetas/);
    assert.deepEqual([...ctx.kbEtiquetasDe('qa, design').lista], ['qa', 'design'], 'o texto com vírgulas continua a servir');
  });

  test('o formulário já não tem o campo de texto «separadas por vírgulas»', () => {
    assert.doesNotMatch(GUIAO_KANBAN, /Separadas por vírgulas/);
    assert.match(GUIAO_KANBAN, /kbEtiquetasDe\(kbSelValor\('kbF-etiquetas'\)\)/);
  });
});

describe('a ordem de cada coluna', () => {
  const ctx = caixa();
  ctx.kbEstado = ESTADO();
  ctx.kbFiltros = ctx.kbSemFiltros();
  const ordem = (v) => { ctx.kbOrdens = v ? { a: v } : {}; return chaves(ctx.kbVisiveis('a')); };

  test('kbVisiveis devolve pela ordem escolhida, os empates pela do quadro', () => {
    assert.deepEqual(ordem(''), ['KAN-1', 'KAN-2', 'KAN-3', 'KAN-4'], 'a do quadro');
    assert.deepEqual(ordem('prioridade:asc'), ['KAN-2', 'KAN-1', 'KAN-4', 'KAN-3'], 'a mais alta primeiro; 1 e 4 empatam e ficam como no quadro');
    assert.deepEqual(ordem('prioridade:desc'), ['KAN-3', 'KAN-1', 'KAN-4', 'KAN-2']);
    assert.deepEqual(ordem('titulo:asc'), ['KAN-2', 'KAN-1', 'KAN-4', 'KAN-3'], 'sem ligar às maiúsculas, e o 9 antes do 10');
    assert.deepEqual(ordem('titulo:desc'), ['KAN-3', 'KAN-4', 'KAN-1', 'KAN-2']);
    assert.deepEqual(ordem('criacao:asc'), ['KAN-2', 'KAN-3', 'KAN-1', 'KAN-4']);
    assert.deepEqual(ordem('criacao:desc'), ['KAN-4', 'KAN-1', 'KAN-3', 'KAN-2']);
    assert.deepEqual(ordem('alteracao:desc'), ['KAN-2', 'KAN-1', 'KAN-4', 'KAN-3']);
    assert.deepEqual(ordem('prazo:asc'), ['KAN-3', 'KAN-1', 'KAN-2', 'KAN-4'], 'sem prazo no fim');
    assert.deepEqual(ordem('prazo:desc'), ['KAN-1', 'KAN-3', 'KAN-2', 'KAN-4'], 'sem prazo no fim, também ao contrário');
    ctx.kbFiltros = Object.assign(ctx.kbSemFiltros(), { tipo: 'tarefa' });
    assert.deepEqual(ordem('prioridade:asc'), ['KAN-1', 'KAN-3'], 'com filtros, ordena o que se vê');
    ctx.kbFiltros = ctx.kbSemFiltros();
    assert.deepEqual(ordem('nada:asc'), ['KAN-1', 'KAN-2', 'KAN-3', 'KAN-4'], 'uma ordem que não existe é a do quadro');
    ctx.kbOrdens = {};
  });

  test('kbOrdemManual: true na ordem do quadro, false com outra (o arrasto não reordena dentro dela)', () => {
    ctx.kbOrdens = {};
    assert.equal(ctx.kbOrdemManual('a'), true);
    ctx.kbOrdens = { a: 'prazo:asc' };
    assert.equal(ctx.kbOrdemManual('a'), false);
    assert.equal(ctx.kbOrdemManual('b'), true, 'só a coluna ordenada');
    ctx.kbOrdens = {};
  });

  test('o cabeçalho diz quando a coluna está ordenada, e o botão abre a escolha', () => {
    ctx.kbOrdens = {};
    const solto = ctx.kbColunaCabAcoes({ id: 'a', nome: 'A <fazer>' });
    assert.match(solto, /class="kb-ord" aria-haspopup="dialog" title="Ordenar" aria-label="Ordenar A &lt;fazer&gt;" data-acao="kbOrdenar" data-arg="a"/);
    ctx.kbOrdens = { a: 'prioridade:desc' };
    const ordenada = ctx.kbColunaCabAcoes({ id: 'a', nome: 'A fazer' });
    assert.match(ordenada, /class="kb-ord kb-ord-on"/);
    assert.match(ordenada, /aria-label="Ordenada por prioridade, a mais baixa primeiro\. Mudar a ordem de A fazer"/);
    assert.match(ordenada, /<span class="kb-ord-txt" aria-hidden="true">Prioridade<\/span>/);
    ctx.kbOrdens = {};
  });

  test('guardada por coluna no aparelho (localStorage), calada quando não deixa, e só as que existem', () => {
    const c = caixa();
    const guardado = {};
    c.localStorage = { getItem: (k) => guardado[k] || null, setItem: (k, v) => { guardado[k] = v; } };
    c.kbOrdens = { a: 'titulo:asc', b: 'prazo:desc' };
    c.kbGuardarOrdens();
    assert.equal(guardado.kb_ordem, '{"a":"titulo:asc","b":"prazo:desc"}');
    guardado.kb_ordem = '{"a":"titulo:asc","b":"rasgada","c":"prioridade:lado"}';
    assert.deepEqual({ ...c.kbLerOrdens() }, { a: 'titulo:asc' });
    c.localStorage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
    assert.deepEqual({ ...c.kbLerOrdens() }, {});
    assert.doesNotThrow(() => c.kbGuardarOrdens());
    assert.deepEqual({ ...caixa().kbOrdens }, {}, 'sem localStorage nenhum, arranca na ordem do quadro');
  });
});

describe('o CSS dos filtros', () => {
  test('o escolhido na cor da frente (letra e contorno), alvos de 44px e o movimento só com os tokens', () => {
    const css = CSS_KANBAN.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(css, /\.kb-sel-on \.kb-sel-botao\{border-color:var\(--accent\);background:var\(--accent-soft\);color:var\(--accent-text\)/);
    assert.match(css, /\.kb-sel-op\[aria-selected="true"\]\{color:var\(--accent-text\);border-color:var\(--accent\)/);
    assert.match(css, /\.kb-ord\.kb-ord-on\{color:var\(--accent-text\);border-color:var\(--accent\)/);
    assert.match(css, /\.kb-sel-op\{[^}]*min-height:44px/);
    assert.match(css, /\.kb-fpainel\.kb-entra\{animation:kbFpEntra var\(--medio\) var\(--curva-entra\)\}/);
    assert.match(css, /\.kb-sel-lista\{[^}]*overscroll-behavior:contain[^}]*animation:kbSelEntra var\(--rapido\) var\(--curva\)/);
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\s*\.kb-fpainel\.kb-entra,\.kb-sel-lista\{animation-name:kbFpAparece\}/);
  });
});

// o código sem os comentários (que podem citar o que não se faz)
function semComentarios(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }
