// O quadro do kanban e o cartão aberto (worker/src/equipa-kanban.js), ronda 1 do QA:
// - o selo da prioridade (87a280c5): a palavra na cor dela, a Média sem selo;
// - a coluna vazia (13ec02d1): o sítio do vazio é o botão de adicionar, e o pé não o repete;
// - o cartão aberto (38fb3759): Editar e Remover num ⋯ no cimo, Mover para e Copiar numa linha;
// - o Mover para (02c390e3): só as outras colunas, sem «Nesta coluna»;
// - as opções dos ⋯ (3c3f3b6e): ícone e rótulo em cada linha, Remover a vermelho e só ao master.
// Corre o guião numa caixa (testes/lib/kanban-caixa.js) e lê o HTML que ele escreve.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CSS_KANBAN } from '../worker/src/equipa-kanban.js';
import { caixa } from './lib/kanban-caixa.js';

const COLUNAS = [
  { id: 'a-fazer', nome: 'A fazer', fim: false },
  { id: 'auto-tests', nome: 'Auto Tests', fim: false },
  { id: 'concluido', nome: 'Concluído', fim: true },
  { id: 'para-depois', nome: 'Para depois', fim: false },
];
const cartao = (chave, coluna, prioridade, extra) => Object.assign({ chave, tipo: 'tarefa', titulo: 'Título de ' + chave, coluna_id: coluna, prioridade, etiquetas: [] }, extra);

/* Uma caixa com um quadro pequeno e a janela apanhada (o kbJanela da leaf-a
   não corre aqui: guarda-se o que se lhe pediu).
   Recebe: master — true para o master.
   Devolve: {ctx, janelas}. */
function quadroDeProva(master) {
  const ctx = caixa();
  ctx.kbEstado = {
    colunas: COLUNAS,
    cartoes: [cartao('KAN-1', 'a-fazer', 1), cartao('KAN-2', 'a-fazer', 3), cartao('KAN-3', 'a-fazer', 5), cartao('KAN-4', 'auto-tests', 2), cartao('KAN-5', 'concluido', 4)],
    etiquetas: [], pessoas: [], eu: { id: 'eu1', nome: 'Eu', master: !!master },
  };
  const janelas = [];
  ctx.kbJanela = (titulo, corpo, opcoes) => janelas.push({ titulo, corpo, opcoes });
  return { ctx, janelas };
}
// as opções de uma janela de escolhas: [{acao, texto, icone, perigo}]
const opcoes = (corpo) => [...corpo.matchAll(/<button type="button" class="btn lista kb-opcao([^"]*)"([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({
  acao: (/data-acao="(\w+)"/.exec(m[2]) || [])[1], perigo: /texto-perigo/.test(m[1]), icone: (/data-ic="(\w+)"/.exec(m[3]) || [])[1],
  texto: m[3].replace(/<span class="so-leitor">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').trim(),
}));
const PAINEL = (cartaoExtra) => ({ cartao: Object.assign(cartao('KAN-77', 'a-fazer', 2), cartaoExtra), subtarefas: [], comentarios: [], historico: [], ligacoes: [], anexos: [], origem: null });

describe('o selo da prioridade (87a280c5)', () => {
  const { ctx } = quadroDeProva(false);

  test('o ícone e a palavra, na classe da cor de cada nível, com «Prioridade:» para o leitor de ecrã', () => {
    const nomes = { 1: 'Mais alta', 2: 'Alta', 4: 'Baixa', 5: 'Mais baixa' };
    for (const p of [1, 2, 4, 5]) {
      const h = ctx.kbPrioridadeHtml(p);
      assert.match(h, new RegExp('^<span class="kb-prio kb-prio-selo kb-p' + p + '">'), 'o selo na cor do nível ' + p);
      assert.match(h, new RegExp('data-ic="kbP' + p + '"'), 'com o ícone do nível');
      assert.match(h, new RegExp('<span class="so-leitor">Prioridade: </span>' + nomes[p] + '</span>$'), 'diz a palavra à vista');
    }
  });

  test('a Média, a de omissão, não leva selo (nem as duas linhas); um valor estranho conta como Média', () => {
    assert.equal(ctx.kbPrioridadeHtml(3), '');
    assert.equal(ctx.kbPrioridadeHtml(undefined), '');
    assert.equal(ctx.kbPrioridadeHtml(9), '');
    const media = ctx.kbCartaoHtml(cartao('KAN-2', 'a-fazer', 3));
    assert.doesNotMatch(media, /kb-prio|data-ic="kbP3"/, 'o cartão médio sem selo nem ícone');
    const alta = ctx.kbCartaoHtml(cartao('KAN-1', 'a-fazer', 1));
    assert.match(alta, /<span class="kb-chave n">KAN-1<\/span><span class="kb-prio kb-prio-selo kb-p1">/, 'na linha de cima, logo a seguir à chave');
    assert.match(alta, /kb-prio-selo[\s\S]*class="kb-pega"[\s\S]*class="kb-mais"[\s\S]*<\/div><p class="kb-c-tit">/, 'antes da pega e do ⋯; o título fica na linha dele');
  });

  test('a linha «Prioridade» do cartão aberto diz o nome, Média incluída', () => {
    for (const [p, nome] of [[3, 'Média'], [1, 'Mais alta'], [5, 'Mais baixa']]) {
      const h = ctx.kbCamposHtml(cartao('KAN-9', 'a-fazer', p));
      assert.match(h, new RegExp('<dt>Prioridade</dt><dd>[\\s\\S]*?<span class="kb-prio-txt">' + nome + '</span></dd>'));
    }
  });

  test('o CSS: letra e contorno na cor (currentColor), sem fundo, numa linha; cada nível com o seu token', () => {
    const selo = /\.kb-prio-selo\{([^}]*)\}/.exec(CSS_KANBAN);
    assert.ok(selo, 'há a regra do selo');
    assert.match(selo[1], /border:1px solid currentColor/);
    assert.match(selo[1], /white-space:nowrap/);
    assert.doesNotMatch(selo[1], /background/, 'sem fundo: o escuro forçado apagava-o');
    const cores = [1, 2, 4, 5].map((p) => (new RegExp('\\.kb-p' + p + '\\{color:(var\\(--[\\w-]+\\))\\}').exec(CSS_KANBAN) || [])[1]);
    assert.ok(cores.every(Boolean), 'cada nível tem a cor por token');
    assert.equal(new Set(cores).size, 4, 'e as quatro são diferentes');
    assert.doesNotMatch(CSS_KANBAN, /\.kb-prio\{[^}]*margin-left:auto/, 'o selo já não empurra a pega: quem encosta à direita é a pega (ou o ⋯)');
    assert.match(CSS_KANBAN, /\.kb-c-topo \.kb-pega\{margin-left:auto\}/);
  });
});

describe('a coluna vazia (13ec02d1)', () => {
  test('sem cartão nenhum: o vazio é o botão «Adicionar cartão» dessa coluna, e o pé não tem botão', () => {
    const { ctx } = quadroDeProva(false);
    const h = ctx.kbColunaHtml(COLUNAS[3]);
    assert.match(h, /<div class="kb-col-lista" data-coluna="para-depois"><button type="button" class="kb-col-vazio kb-col-vazio-mais" data-acao="kbNovo" data-arg="para-depois">/);
    assert.match(h, /data-ic="mais"[^]*Adicionar cartão<span class="so-leitor"> em Para depois<\/span><\/button><\/div><\/section>$/, 'com o ícone, e logo a seguir a coluna fecha: sem pé');
    assert.doesNotMatch(h, /Nenhum cartão|kb-col-pe|kb-col-mais/);
    assert.equal((h.match(/data-acao="kbNovo"/g) || []).length, 1, 'um botão só');
  });

  test('com cartões, o pé tem o «Adicionar cartão» como antes', () => {
    const { ctx } = quadroDeProva(false);
    const h = ctx.kbColunaHtml(COLUNAS[0]);
    assert.match(h, /<div class="kb-col-pe"><button type="button" class="btn sm ghost kb-col-mais" data-acao="kbNovo" data-arg="a-fazer">/);
    assert.doesNotMatch(h, /kb-col-vazio/);
  });

  test('com filtros que escondem tudo fica como está: «Nada com estes filtros.» e o pé com o botão', () => {
    const { ctx } = quadroDeProva(false);
    ctx.kbFiltros.prioridade = '2';
    const h = ctx.kbColunaHtml(COLUNAS[0]);
    assert.match(h, /<p class="kb-col-vazio">Nada com estes filtros\.<\/p>/);
    assert.match(h, /kb-col-pe[^]*data-acao="kbNovo" data-arg="a-fazer"/);
    // e uma coluna mesmo vazia, com os filtros ligados, continua a ter o botão no vazio
    assert.match(ctx.kbColunaHtml(COLUNAS[3]), /kb-col-vazio-mais/);
  });

  test('o CSS: o botão do vazio tem ≥44px, é tracejado (herda do .kb-col-vazio), e esconde-se a meio de um arrasto', () => {
    const r = /\.kb-col-vazio-mais\{([^}]*)\}/.exec(CSS_KANBAN);
    assert.ok(r);
    assert.ok(Number((/min-height:(\d+)px/.exec(r[1]) || [])[1]) >= 44);
    assert.match(CSS_KANBAN, /\.kb-col-vazio\{[^}]*border:1px dashed/);
    assert.match(CSS_KANBAN, /\.kb-col-lista:has\(\.kb-lugar\) \.kb-col-vazio\{display:none\}/);
  });
});

describe('o cartão aberto (38fb3759)', () => {
  test('o ⋯ no cimo, ao lado do fechar, e só com o cartão chegado', () => {
    const { ctx } = quadroDeProva(true);
    const cab = ctx.kbPainelCabHtml(cartao('KAN-77', 'a-fazer', 2), 'KAN-77');
    assert.match(cab, /<button type="button" class="btn sm ghost so-icone kb-p-mais" aria-label="Opções de KAN-77" aria-haspopup="dialog" data-acao="kbMenuPainel" data-arg="KAN-77">[^]*<\/button><button type="button" class="btn sm ghost so-icone kb-p-fechar"/);
    assert.doesNotMatch(ctx.kbPainelCabHtml(null, 'KAN-77'), /kb-p-mais/, 'à espera, só o fechar');
  });

  test('Mover para e Copiar a ligação numa só linha; Editar e Remover fora do corpo; o título logo a seguir ao cimo', () => {
    for (const master of [true, false]) {
      const { ctx } = quadroDeProva(master);
      const h = ctx.kbPainelHtml(PAINEL(), false);
      const acoes = /<div class="kb-p-acoes">([^]*?)<\/div>/.exec(h)[1];
      assert.deepEqual([...acoes.matchAll(/data-acao="(\w+)"/g)].map((m) => m[1]), ['kbMoverPara', 'kbCopiar']);
      assert.match(acoes, /data-ic="kbMover"[^]*Mover para…[^]*data-ic="kbCopiar"[^]*Copiar a ligação/, 'cada um com o ícone');
      assert.doesNotMatch(h, /data-acao="kb(?:Editar|Remover)"/, 'nem Editar nem Remover no painel (master: ' + master + ')');
      assert.match(h, /<div class="kb-p-corpo"><h2 class="kb-p-tit" id="kbPainelTit"/);
    }
    assert.match(CSS_KANBAN, /\.kb-p-acoes\{display:flex;gap:8px\}/, 'a linha não parte');
    assert.match(CSS_KANBAN, /\.kb-p-acoes \.btn\{flex:1 1 0;/, 'e as duas com o mesmo peso');
  });

  test('o ⋯ do painel: Editar e, só ao master, Remover a vermelho; cada um com o ícone', () => {
    const m = quadroDeProva(true);
    m.ctx.kbDetalhe = PAINEL();
    m.ctx.kbMenuPainel('KAN-77');
    const j = m.janelas.pop();
    assert.equal(j.titulo, 'KAN-77 · Título de KAN-77', 'a chave e o título, sem partir entre os dois');
    assert.deepEqual(opcoes(j.corpo), [
      { acao: 'kbEditar', perigo: false, icone: 'kbEditar', texto: 'Editar' },
      { acao: 'kbRemover', perigo: true, icone: 'kbRemover', texto: 'Remover' },
    ]);
    const s = quadroDeProva(false);
    s.ctx.kbDetalhe = PAINEL();
    s.ctx.kbMenuPainel('KAN-77');
    assert.deepEqual(opcoes(s.janelas.pop().corpo).map((o) => o.texto), ['Editar'], 'o suporte não remove');
    assert.equal(typeof m.ctx.ACOES.kbMenuPainel, 'function', 'a ação existe');
  });
});

describe('o Mover para (02c390e3)', () => {
  test('só as outras colunas, cada uma com a contagem; diz onde está; sem «Nesta coluna» nem reordenar', () => {
    const { ctx, janelas } = quadroDeProva(false);
    ctx.kbMoverPara('KAN-2');
    const j = janelas.pop();
    assert.equal(j.titulo, 'Mover KAN-2');
    assert.match(j.corpo, /Está em <b>A fazer<\/b>\./);
    assert.doesNotMatch(j.corpo, /Nesta coluna|Para o topo|Subir um lugar|Descer um lugar|Para o fim|\.º de/);
    const ops = opcoes(j.corpo);
    assert.deepEqual(ops.map((o) => o.texto), ['Auto Tests1', 'Concluído1', 'Para depois0']);
    assert.ok(ops.every((o) => o.acao === 'kbMover' && o.icone === 'kbMover'));
    assert.match(j.corpo, /data-acao="kbMover" data-arg="KAN-2" data-arg2="auto-tests" data-arg3="0"/, 'vai para o topo da coluna');
    assert.match(j.corpo, /1<span class="so-leitor"> cartão<\/span>[^]*0<span class="so-leitor"> cartões<\/span>/, 'a contagem dita com o plural certo');
  });

  test('com uma coluna só, diz que não há outras', () => {
    const { ctx, janelas } = quadroDeProva(false);
    ctx.kbEstado.colunas = [COLUNAS[0]];
    ctx.kbMoverPara('KAN-1');
    assert.match(janelas.pop().corpo, /Não há outras colunas\./);
  });
});

describe('o ⋯ do cartão no quadro (3c3f3b6e)', () => {
  test('ícone e rótulo em cada linha; Remover a vermelho só ao master; o título com a chave e o título', () => {
    const m = quadroDeProva(true);
    m.ctx.kbMenuCartao('KAN-1');
    const j = m.janelas.pop();
    assert.equal(j.titulo, 'KAN-1 · Título de KAN-1');
    assert.deepEqual(opcoes(j.corpo), [
      { acao: 'kbAbrir', perigo: false, icone: 'kbAbrirCartao', texto: 'Abrir o cartão' },
      { acao: 'kbMoverPara', perigo: false, icone: 'kbMover', texto: 'Mover para…' },
      { acao: 'kbEditar', perigo: false, icone: 'kbEditar', texto: 'Editar' },
      { acao: 'kbCopiar', perigo: false, icone: 'kbCopiar', texto: 'Copiar a ligação' },
      { acao: 'kbRemover', perigo: true, icone: 'kbRemover', texto: 'Remover' },
    ]);
    const s = quadroDeProva(false);
    s.ctx.kbMenuCartao('KAN-1');
    assert.deepEqual(opcoes(s.janelas.pop().corpo).map((o) => o.acao), ['kbAbrir', 'kbMoverPara', 'kbEditar', 'kbCopiar']);
    assert.match(CSS_KANBAN, /\.kb-opcao\.texto-perigo \.i\{color:currentColor\}/, 'o ícone do Remover também a vermelho');
  });

  test('os desenhos novos existem, em traço, com o nome kb', () => {
    const { ctx } = quadroDeProva(false);
    for (const n of ['kbMover', 'kbAbrirCartao', 'kbRemover']) assert.match(ctx.ICONES[n], /^<path d="[^"]+"\/>$/, n);
  });
});

describe('o premido, sem o retângulo azul do toque', () => {
  test('o cartão, as pílulas do segmentado, as linhas do painel e o vazio têm o seu :active, fora do portão do hover', () => {
    let fora = CSS_KANBAN;
    const portao = '@media(hover:hover) and (pointer:fine){';
    const i = fora.indexOf(portao);
    let n = 0, j = i + portao.length - 1;
    for (; j < fora.length; j++) { if (fora[j] === '{') n++; else if (fora[j] === '}' && --n === 0) break; }
    fora = fora.slice(0, i) + fora.slice(j + 1);
    assert.match(fora, /\.kb-cartao:has\(\.kb-abrir:active\)\{background:var\(--press\)/);
    assert.match(fora, /\.kb-seg-op:active\{background:var\(--press\)/);
    assert.match(fora, /\.kb-linha:active\{background:var\(--press\)\}/);
    assert.match(fora, /\.kb-col-vazio-mais:active\{background:var\(--press\)/);
    assert.match(fora, /\.kb-linha\{[^}]*transition:background-color var\(--rapido\) var\(--curva\)/, 'com a transição pelos tokens');
  });
});
