// Os cartões de resumo dos Movimentos: abrir um indicador e ficar a ver só
// esse tipo. O caminho fazia-se à mão pelo modal de filtros — agora a janela
// do cartão traz o botão. O Saldo é a volta atrás.
//
// Também aqui: o separador dos Colaboradores, que só aparece com conta.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
// as janelas abrem numa pilha observável: cada uma guarda título, corpo e rodapé
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp();
afterEach(() => repor(app));

function monta() {
  limpar(app);
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
  app.db.transactions = [
    app.normTx({ id: 'T1', kind: 'income', label: 'Renda', amount: 800, propertyId: 'P1', date: '2026-03-08' }),
    app.normTx({ id: 'T2', kind: 'expense', label: 'Condomínio', amount: 55, propertyId: 'P1', date: '2026-03-08' }),
    app.normTx({ id: 'T3', kind: 'loan', label: 'Prestação', amount: 400, propertyId: 'P1', date: '2026-03-10' }),
    app.normTx({ id: 'T4', kind: 'owed', label: 'Emprestei ao Rui', amount: 100, propertyId: 'P1', date: '2026-03-11' }),
    app.normTx({ id: 'T5', kind: 'repay', label: 'Devolvi ao banco', amount: 30, propertyId: 'P1', date: '2026-03-12' }),
  ];
  app.txFilter = ''; app.txCat = ''; app.txSub = '';
  app.txProp = ''; app.txPaid = ''; app.txDe = ''; app.txAte = ''; app.txNoPayer = true; app.txSearch = ''; app.ownerFilter = '';
}

// o rodapé da janela do cartão com este rótulo
function rodapeDe(abertas, titulo) {
  const j = abertas.find((x) => x.t === titulo);
  assert.ok(j, 'a janela «' + titulo + '» abriu');
  return j.f || '';
}

// abre a janela de cada cartão de resumo e devolve as janelas abertas
function abreCartoes() {
  const abertas = janelasFalsas(app, 'render', 'toast');
  const html = app.vTransactions();
  const ids = (html.match(/id="(k\d+)"/g) || []).map((m) => m.slice(4, -1));
  ids.forEach((id) => app.kpiModal(id));
  return { abertas, html, ids };
}

describe('os cartões de resumo levam ao filtro', () => {
  beforeEach(monta);

  test('cada cartão oferece ver só o seu tipo; o saldo só quando há filtro', () => {
    const { abertas } = abreCartoes();
    assert.match(rodapeDe(abertas, 'Receitas'), /txVerTipo\('income'\)/);
    assert.match(rodapeDe(abertas, 'Receitas'), /Ver só as receitas/);
    assert.match(rodapeDe(abertas, 'Despesas'), /txVerTipo\('expense'\)/);
    assert.match(rodapeDe(abertas, 'Prestações'), /txVerTipo\('loan'\)/);
    assert.match(rodapeDe(abertas, 'Dívidas recebidas'), /txVerTipo\('owed'\)/);
    assert.match(rodapeDe(abertas, 'Dívidas pagas'), /txVerTipo\('repay'\)/);
    // sem filtro, o saldo já mostra tudo: não há para onde voltar
    assert.doesNotMatch(rodapeDe(abertas, 'Saldo'), /txVerTipo/);
    // todas fecham
    abertas.forEach((j) => assert.match(j.f, /Fechar/));
  });

  test('com um tipo filtrado, o saldo traz a volta atrás e o próprio tipo já não se oferece', () => {
    app.txFilter = 'income';
    const { abertas } = abreCartoes();
    assert.match(rodapeDe(abertas, 'Saldo'), /txVerTipo\(''\)/);
    assert.match(rodapeDe(abertas, 'Saldo'), /Ver todos os tipos/);
    assert.doesNotMatch(rodapeDe(abertas, 'Receitas'), /txVerTipo/, 'já se está a ver só as receitas');
  });

  test('txVerTipo muda o filtro e limpa a categoria, que era do tipo anterior', () => {
    janelasFalsas(app, 'render', 'toast');
    app.txCat = 'Condomínio'; app.txSub = 'Quota mensal';
    app.txVerTipo('loan');
    assert.equal(app.txFilter, 'loan');
    assert.equal(app.txCat, '');
    assert.equal(app.txSub, '');
    app.txVerTipo('');
    assert.equal(app.txFilter, '', 'o saldo devolve todos os tipos');
  });

  test('o filtro por dívidas recebidas ou pagas separa-as, e o seletor tem as duas', () => {
    janelasFalsas(app, 'render', 'toast');
    const so = (k) => { app.txFilter = k; return app.db.transactions.filter(app.txMatch).map((t) => t.id); };
    assert.deepEqual(Array.from(so('owed')), ['T4']);
    assert.deepEqual(Array.from(so('repay')), ['T5']);
    assert.deepEqual(Array.from(so('debt')), ['T4', 'T5'], 'juntas, como sempre');
    app.txFilter = '';
    const corpo = app.txFilterBody();
    assert.match(corpo, /Dívidas recebidas/);
    assert.match(corpo, /Dívidas pagas/);
  });
});

/* O que um chip da fila diz: o rótulo do botão (o lab_ do sel), sem as opções
   da lista que ele abre; num chip sem menu, o texto dele.
   Recebe: html — a vista; id — o id do sel do chip ('txcTipo'…).
   Devolve: o texto, ou null sem esse chip. */
const rotuloDoChip = (html, id) => (html.match(new RegExp('id="lab_' + id + '">([^<]*)<')) || [])[1] ?? null;
/* O span do chip (o .mov-chip) que tem o sel com este id.
   Recebe: html — a vista; id — o id do sel.
   Devolve: o pedaço de HTML do chip, até ao fim do sel. */
const chipDe = (html, id) => { const i = html.indexOf('id="sel_' + id + '"'); return i < 0 ? '' : html.slice(html.lastIndexOf('<span class="mov-chip', i), html.indexOf('</div></div>', i) + 40); };

describe('os chips dos filtros (o canvas: abrem a escolha e, ligados, mostram o valor com o ×)', () => {
  beforeEach(monta);

  test('sem filtros: Período, Tipo, Imóvel e Categoria pelo nome, sem × nem Limpar', () => {
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana Costa' })];
    const html = app.vTransactions();
    assert.equal(rotuloDoChip(html, 'txcPer'), 'Período');
    assert.equal(rotuloDoChip(html, 'txcTipo'), 'Tipo');
    assert.equal(rotuloDoChip(html, 'txcProp'), 'Imóvel');
    assert.equal(rotuloDoChip(html, 'txcCat'), 'Categoria');
    assert.equal(rotuloDoChip(html, 'txcPago'), 'Pago ou recebido por');
    assert.doesNotMatch(html, /mov-chip on|mov-chip-x|chip limpar/);
    // a pesquisa vive na vista, com a exceção do placeholder e o rótulo inteiro
    assert.match(html, /<input id="tx_q" type="search" value="" placeholder="Pesquisar…" aria-label="Pesquisar movimentos/);
    assert.match(html, /id="txFiltBtn"[^>]*aria-label="Filtros"/);
  });

  test('ligado, o chip diz o valor, leva o × e o leitor de ecrã ouve o nome e o valor; o botão dos filtros conta-o', () => {
    app.txFilter = 'income'; app.txProp = 'P1'; app.txCat = 'Rendas'; app.txSub = 'Renda mensal';
    const html = app.vTransactions();
    assert.equal(rotuloDoChip(html, 'txcTipo'), 'Receitas');
    assert.equal(rotuloDoChip(html, 'txcProp'), 'T2 Lisboa');
    assert.equal(rotuloDoChip(html, 'txcCat'), 'Rendas › Renda mensal');
    assert.match(chipDe(html, 'txcTipo'), /^<span class="mov-chip on">/);
    assert.match(html, /aria-label="Tipo: Receitas"/);
    assert.match(html, /data-click="txLimparFiltro\('tipo'\)"/);
    assert.match(html, /data-click="txLimparFiltro\('cat'\)"/);
    assert.match(html, /<button type="button" class="chip limpar" data-toca="vista" data-click="clearTxFilters\(\)">Limpar<\/button>/, 'com dois ou mais, o Limpar vê-se em todo o lado');
    assert.match(html, /aria-label="Filtros: 4 ativos"/);
    // com um só, no telemóvel o × chega: o Limpar fica só para o ecrã largo
    app.txProp = ''; app.txCat = ''; app.txSub = '';
    assert.match(app.vTransactions(), /class="chip limpar mov-so-largo"/);
  });

  test('o × limpa só o seu filtro; o do tipo leva a categoria, que era da árvore dele', () => {
    janelasFalsas(app, 'render', 'toast');
    app.txFilter = 'expense'; app.txCat = 'Obras'; app.txSub = 'Pintura'; app.txProp = 'P1'; app.txDe = '2026-01-01'; app.txAte = '2026-12-31';
    app.txLimparFiltro('per');
    assert.deepEqual([app.txDe, app.txAte, app.txFilter], ['', '', 'expense']);
    app.txLimparFiltro('tipo');
    assert.deepEqual([app.txFilter, app.txCat, app.txSub, app.txProp], ['', '', '', 'P1']);
    app.txLimparFiltro('prop');
    assert.equal(app.txProp, '');
    app.txNoPayer = false;
    app.txLimparFiltro('pessoa');
    assert.equal(app.txNoPayer, true);
  });

  test('o chip do período: um ano escolhe-o inteiro e diz o ano; outras datas dizem-se por extenso', () => {
    janelasFalsas(app, 'render', 'toast');
    assert.deepEqual(Array.from(app.txAnos()), ['2026']);
    app.document.getElementById('txcPer').value = '2026';
    app.txChipPeriodo();
    assert.deepEqual([app.txDe, app.txAte], ['2026-01-01', '2026-12-31']);
    assert.equal(app.txAnoDoFiltro(), '2026');
    assert.equal(rotuloDoChip(app.vTransactions(), 'txcPer'), '2026');
    app.txAte = '2026-06-30';
    assert.equal(app.txAnoDoFiltro(), '');
    assert.equal(app.txRotuloPeriodo(), '01/01/2026 – 30/06/2026');
    app.txDe = '';
    assert.equal(app.txRotuloPeriodo(), 'até 30/06/2026');
    app.document.getElementById('txcPer').value = '';
    app.txChipPeriodo();
    assert.deepEqual([app.txDe, app.txAte], ['', ''], '«Todo o período» limpa as datas');
  });
});

describe('o painel dos filtros (o M-Filtros)', () => {
  beforeEach(monta);

  test('o título com o Fechar, quantos movimentos passam, o tipo em chips e o interruptor das pessoas', () => {
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana Costa' })];
    const corpo = app.txFilterBody();
    assert.match(corpo, /<h2 class="mov-filtros-tit" id="txFtit">Filtros<\/h2>/);
    assert.match(corpo, /data-click="txFilterFechar\(\)">Fechar<\/button>/);
    assert.doesNotMatch(corpo, /clearTxFilters/, 'sem filtros não há o que limpar');
    assert.match(corpo, /Aplicam-se ao mexer · 5 movimentos<\/p>/);
    const tipos = [...corpo.matchAll(/role="radio" aria-checked="(true|false)" data-toca="vista" data-click="txPorTipo\('(\w*)'\)">([^<]*)</g)].map((m) => [m[2], m[1], m[3]]);
    assert.deepEqual(tipos.map((t) => t[0]), ['', 'income', 'expense', 'loan', 'debt', 'owed', 'repay', 'settle']);
    assert.deepEqual(tipos.filter((t) => t[1] === 'true').map((t) => t[2]), ['Todos']);
    assert.match(corpo, /class="interruptor" id="txNoPayer" role="switch" aria-checked="true"/);
    app.txFilter = 'income';
    assert.match(app.txFilterBody(), /clearTxFilters\(\)">Limpar<\/button>/);
    assert.match(app.txFilterBody(), /Aplicam-se ao mexer · 1 movimento<\/p>/, 'no singular');
  });

  test('o interruptor vai num rótulo que se toca inteiro, e a opção vazia de cada campo diz só «Todos»', () => {
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana Costa' })];
    app.txCat = 'Rendas';
    const corpo = app.txFilterBody();
    // tocar no texto chega ao botão: é ele o controlo do <label>
    assert.match(corpo, /<label class="mov-interr"><span id="txNoPayerL">Incluir movimentos sem pessoa atribuída<\/span>\s*<button type="button" class="interruptor" id="txNoPayer" role="switch"[^>]*><\/button><\/label>/);
    // na grelha de duas colunas o rótulo do campo já diz o que é; a 390px os longos cortavam-se
    const vazia = (id) => app.window.__sel[id].options.find((o) => o.v === '').label;
    assert.equal(vazia('txPropF'), 'Todos');
    assert.equal(vazia('txCatF'), 'Todas');
    assert.equal(vazia('txSubF'), 'Todas');
    assert.equal(vazia('txPaidF'), 'Qualquer um');
    assert.ok(!app.window.__sel.txOwnerF && !/Proprietário</.test(corpo), 'sem o filtro de proprietário (o «Pago por» fica)');
    // os chips, que usam as mesmas listas, continuam com o nome inteiro
    assert.equal(app.txOpcoesImovel()[0].label, 'Todos os imóveis');
    assert.equal(app.txOpcoesCategoria()[0].label, 'Todas as categorias');
  });

  test('txPorTipo e o interruptor mudam o filtro; o tipo leva a categoria', () => {
    janelasFalsas(app, 'render', 'toast');
    app.txCat = 'Rendas';
    app.txPorTipo('loan');
    assert.deepEqual([app.txFilter, app.txCat], ['loan', '']);
    app.onTxNoPayer();
    assert.equal(app.txNoPayer, false);
    app.onTxNoPayer();
    assert.equal(app.txNoPayer, true);
  });

  test('os filtros comuns em chips: aplicam-se num toque, e o aplicado leva o visto e limpa', () => {
    app.db.settings.filters = [{ id: 'F1', name: 'T2 · rendas', kind: 'income', prop: 'P1', owner: '', cat: '', sub: '', de: '', ate: '' },
      { id: 'F2', name: 'Em branco', kind: '', prop: '', owner: '', cat: '', sub: '', de: '', ate: '' }];
    let corpo = app.txFilterBody();
    assert.match(corpo, /<span class="lbl">Filtros comuns<\/span>/);
    assert.match(corpo, /aria-pressed="false" data-toca="vista" data-click="aplicarFiltroComum\('F1'\)">T2 · rendas</);
    assert.match(corpo, /aria-pressed="false" data-toca="vista" data-click="aplicarFiltroComum\('F2'\)">Em branco</, 'um filtro em branco não está ligado numa lista sem filtros');
    app.txFilter = 'income'; app.txProp = 'P1';
    corpo = app.txFilterBody();
    assert.match(corpo, /class="chip on" aria-pressed="true" data-toca="vista" data-click="clearTxFilters\(\)">/);
    // e na fila dos chips, só no ecrã largo
    assert.match(app.vTransactions(), /class="mov-chip mov-comum mov-so-largo"/);
  });
});

describe('a linha e o mês, nos dois desenhos do canvas', () => {
  beforeEach(monta);

  test('o quadrado do ícone tem a cor do tipo: receita verde, despesa laranja, prestação roxa, dívida em cobalto', () => {
    const linha = (id) => app.txLinhaHtml(app.db.transactions.find((t) => t.id === id), '2026-03');
    assert.match(linha('T1'), /<span class="ic in" aria-hidden="true">/);
    assert.match(linha('T1'), /<b class="pos">\+/);
    assert.match(linha('T2'), /<span class="ic out" aria-hidden="true">/);
    assert.match(linha('T2'), /<b class="neg">−/);
    assert.match(linha('T3'), /<span class="ic loan" aria-hidden="true">/);
    assert.match(linha('T3'), /<b class="prest">−/);
    assert.match(linha('T4'), /<span class="ic" aria-hidden="true">/);
    assert.match(linha('T4'), /<b class="mov-div">\+/);
  });

  test('a linha curta do telemóvel e as colunas da tabela vêm no mesmo HTML', () => {
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana Costa' })];
    const t = app.db.transactions.find((x) => x.id === 'T2');
    t.paidBy = 'O1'; t.category = 'Condomínio'; t.sub = 'Quota';
    const html = app.txLinhaHtml(t, '2026-03');
    assert.match(html, /<div class="small mov-curta">08\/03 · T2 Lisboa · Ana<\/div>/);
    assert.match(html, /<span class="mov-c-data">08\/03\/2026<\/span>/);
    assert.match(html, /<span class="mov-c-imovel">T2 Lisboa<\/span><span class="mov-c-cat">Condomínio › Quota<\/span><span class="mov-c-quem">Ana Costa<\/span>/);
    assert.match(html, /<div class="small mov-tipo">Despesa<\/div>/);
    assert.match(html, /^<div class="linha txrow mov-linha" data-lp="tx:T2" data-fk="tx:T2"/);
    // sem onde nem quem, a linha curta diz a categoria (ou o tipo), e nunca só a data
    const solto = app.normTx({ id: 'S', kind: 'expense', label: 'Selos', amount: 3, date: '2026-03-02' });
    assert.match(app.txLinhaHtml(solto, '2026-03'), /<div class="small mov-curta">02\/03 · Despesa<\/div>/);
  });

  test('o cabeçalho da tabela e o saldo do mês com o sinal', () => {
    const cab = app.txCabTabela();
    assert.deepEqual([...cab.matchAll(/<span class="mov-c-\w+">([^<]*)<\/span>/g)].map((m) => m[1]), ['Data', 'Descrição', 'Imóvel', 'Categoria', 'Pago · recebido', 'Valor']);
    assert.match(cab, /<span class="mov-cab-caixa"><\/span>/, 'a caixa de tudo é da camada da seleção');
    assert.match(app.vTransactions(), /<div class="mov-cab" data-fk="txcab">[\s\S]*<div id="txLista" class="mov-tabela"><\/div>$/);
    assert.match(app.txMesHtml('2026-03'), /^<div class="txmes"><div class="section-title mov-mes"/);
  });

  test('os totais: a prestação em roxo, as dívidas em cobalto, o saldo a tinta e só ele com rodapé', () => {
    const html = app.vTransactions();
    assert.match(html, /<div class="grid mov-tot" role="group" aria-label="Totais no filtro atual">/);
    const pe = [...html.matchAll(/<div class="label">([^<]*)<\/div><div class="value ([^"]*)">[^<]*<\/div>(?:<div class="foot">([^<]*)<\/div>)?/g)].map((m) => [m[1], m[2].trim(), m[3] || '']);
    assert.deepEqual(pe, [['Receitas', 'pos', ''], ['Despesas', 'neg', ''], ['Prestações', 'prest', ''], ['Dívidas recebidas', 'mov-div', ''], ['Dívidas pagas', 'mov-div', ''], ['Saldo', '', '5 movimentos']]);
  });
});

describe('o separador dos Colaboradores', () => {
  beforeEach(monta);

  /* Em 2026-10 (o canvas da linguagem nova) os Colaboradores saíram da barra
     lateral: são arrumação da conta, e a porta vive nas Definições. */
  test('não está no menu — a porta vive nas Definições — e o separador continua a existir', () => {
    assert.ok(!app.NAV_GROUPS.some((g) => g.ids.indexOf('colaboradores') > -1), 'fora dos grupos do menu');
    const t = app.TABS.find((x) => x.id === 'colaboradores');
    assert.ok(t && t.label === 'Colaboradores', 'o separador existe');
  });

  test('sem conta na nuvem esconde-se, e a vista explica porquê', () => {
    app.window.CW = null;
    assert.ok(app.separadoresEscondidos().indexOf('colaboradores') > -1, 'escondido sem sessão');
    const html = app.vColabTab();
    assert.match(html, /Precisas de uma conta/);
    assert.match(html, /goSet\('cloud'\)/);
    app.window.CW = { user: { id: 'EU' }, cargos: {} };
    assert.equal(app.separadoresEscondidos().indexOf('colaboradores'), -1, 'com sessão aparece');
    app.window.CW = null;
  });
});
