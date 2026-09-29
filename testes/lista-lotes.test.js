// A lista dos movimentos com lotes. Um movimento de vários imóveis (de um
// grupo, ou de «Todos os imóveis») é guardado como uma parte por imóvel, cada
// uma um movimento normal com propertyId e o campo lote ({id, n, total, alvo,
// modo, partes}). Na lista continua a ser UMA linha: sem filtro, o lote
// inteiro, «dividido por N imóveis»; com o filtro num imóvel, a parte dele,
// «parte de «…» · total …». Os indicadores somam as partes uma vez; a
// contagem e a ordenação são das linhas. E «Sem imóvel» quer dizer mesmo sem
// imóvel: um filtro por imóvel deixa-o de fora. Na seleção (cloud/selecao.js),
// marcar a linha de um lote marca o lote, e editar e eliminar apanham as
// partes todas — nunca as de outro lote.
//
// As partes montam-se à mão, só com a forma dos dados do contrato: esta lista
// não depende das funções que partem o lote ao guardar.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, igual, perto, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

// a app vive num dia fixo: as evoluções são «mês a mês em YEAR»
const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
// a mesma com a nuvem por cima, para a seleção
const nuvem = carregarTudo({ hoje: '2026-09-06' });
afterEach(() => repor(nuvem));

const SINAL = app.KIND.expense.sign;

/* A base de cada teste: a Ana tem três imóveis num grupo, o Bloco — o T2 com o
   Bruno (70/30), o T3 e o T1 só dela.
   Recebe: a — o proxy da app.
   Devolve: nada — escreve na db e repõe os filtros. */
function semear(a) {
  limpar(a);
  a.db.owners.push(a.normPerson({ id: 'ana', name: 'Ana' }), a.normPerson({ id: 'bruno', name: 'Bruno' }));
  const casa = a.normProp({ id: 'casa', name: 'T2', ownerIds: ['ana', 'bruno'] });
  casa.ownerShares = { ana: 70, bruno: 30 };
  a.db.properties.push(casa, a.normProp({ id: 'casa2', name: 'T3', ownerIds: ['ana'] }), a.normProp({ id: 'casa3', name: 'T1', ownerIds: ['ana'] }));
  a.db.groups.push(a.normGroup({ id: 'G', name: 'Bloco', kind: 'prop', ids: ['casa', 'casa2', 'casa3'] }));
  a.txFilter = ''; a.txProp = ''; a.txPaid = ''; a.txCat = ''; a.txSub = ''; a.txSearch = '';
  a.txDe = ''; a.txAte = ''; a.txSort = 'date'; a.txDir = 'desc'; a.txNoPayer = true;
}

/* Um movimento normal na base; por omissão uma despesa de 50 € no T2.
   Recebe: a — o proxy; extra — os campos que mudam.
   Devolve: o movimento. */
function mov(a, extra) {
  const t = a.normTx(Object.assign({ kind: 'expense', label: 'Luz', amount: 50, date: '2026-03-12', paidBy: 'ana', propertyId: 'casa' }, extra));
  a.db.transactions.push(t);
  return t;
}

/* As partes de um lote, montadas à mão com a forma do contrato: uma por
   imóvel, com o id <lote>_<imóvel>, o valor dividido em partes iguais e o
   lote igual em todas. Entram na base pela ordem dada.
   Recebe: a — o proxy; id — o id do lote; pids — os imóveis das partes que
   estão na base; o (opcional) — {total, n, alvo, label, date, extra}.
   Devolve: as partes (array), pela ordem de pids. */
function lote(a, id, pids, o = {}) {
  const n = o.n || pids.length, total = o.total != null ? o.total : 100 * n;
  const L = { id, n, total, alvo: o.alvo || 'g:G', modo: 'equal', partes: {} };
  return pids.map((pid) => {
    const t = a.normTx(Object.assign({ id: id + '_' + pid, kind: 'expense', label: o.label || 'Seguro', amount: total / n,
      date: o.date || '2026-03-10', paidBy: 'ana', propertyId: pid, lote: L }, o.extra || {}));
    if (!t.lote) t.lote = L;   // um normTx que ainda não conserve o lote
    a.db.transactions.push(t);
    return t;
  });
}

/* O bloco de um cartão de resumo da vista dos movimentos, pelo rótulo. */
function cartao(html, rotulo) {
  const b = html.split('<div class="card kpi').find((x) => x.includes('<div class="label">' + rotulo + '</div>'));
  assert.ok(b, 'há um cartão «' + rotulo + '»');
  return b;
}
const kpiValor = (html, rotulo) => (cartao(html, rotulo).match(/<div class="value[^"]*">([^<]*)<\/div>/) || [])[1];
const kpiRodape = (html, rotulo) => (cartao(html, rotulo).match(/<div class="foot">([^<]*)<\/div>/) || [])[1];

/* As linhas da última pintura da vista (txLista), deste lado da vm. */
const linhas = () => { app.vTransactions(); return app.txLista; };

describe('a linha de um lote', () => {
  beforeEach(() => semear(app));

  test('sem filtro, três partes de 100 € são uma linha de 300 € «dividido por 3 imóveis», com o grupo e «· 3 imóveis»', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3']);
    const ls = linhas();
    assert.equal(ls.length, 1, 'uma linha só');
    assert.equal(ls[0]._partes.length, 3, 'com as três partes');
    assert.equal(app.valorNaVista(ls[0]), 300);
    const html = app.txLinhaHtml(ls[0], '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(300)), 'o total, com o sinal');
    assert.ok(html.includes('dividido por 3 imóveis'), html);
    assert.ok(html.includes(' · Bloco · 3 imóveis'), 'o grupo no lugar do imóvel: ' + html);
    assert.doesNotMatch(html, /· T2|parte de|a tua parte/, 'nem o nome de uma parte, nem a frase de uma parte');
  });

  test('um lote de «Todos os imóveis» diz «Todos os imóveis · 3 imóveis»', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3'], { alvo: 'todos' });
    const html = app.txLinhaHtml(linhas()[0], '2026-03');
    assert.ok(html.includes(' · Todos os imóveis · 3 imóveis'), html);
    assert.ok(html.includes('dividido por 3 imóveis'));
    assert.doesNotMatch(html, /Bloco/);
  });

  test('com o filtro num imóvel do lote, uma linha de 100 € com «parte de «<rótulo>» · total 300 €»', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3']);
    app.txProp = 'casa2';
    const ls = linhas();
    assert.equal(ls.length, 1);
    assert.equal(ls[0].id, 'L1_casa2', 'a linha é a parte desse imóvel');
    assert.equal(ls[0]._partes.length, 1);
    assert.equal(app.valorNaVista(ls[0]), 100);
    const html = app.txLinhaHtml(ls[0], '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(100)), 'a parte do T3');
    assert.ok(!html.includes(SINAL + app.euro2(300)), 'e não o total como valor');
    assert.ok(html.includes('parte de «Seguro» · total ' + app.euro2(300)), html);
    assert.ok(html.includes(' · Bloco · 3 imóveis'), 'continua a dizer de onde é');
    assert.doesNotMatch(html, /dividido por/);
  });

  test('com três partes na base de um lote de cinco (as outras não se veem), «parte de … · total …» sem filtro nenhum', () => {
    lote(app, 'L5', ['casa', 'casa2', 'casa3'], { n: 5, total: 500 });
    const ls = linhas();
    assert.equal(ls.length, 1);
    assert.equal(app.valorNaVista(ls[0]), 300, 'o que se vê: as três partes');
    const html = app.txLinhaHtml(ls[0], '2026-03');
    assert.ok(html.includes('parte de «Seguro» · total ' + app.euro2(500)), html);
    assert.ok(html.includes(' · Bloco · 5 imóveis'), 'dividido por cinco, não pelos três que se veem');
    assert.doesNotMatch(html, /dividido por/);
  });

  test('o filtro pelo grupo mostra o lote inteiro; o de um proprietário, a parte dele', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3']);
    app.txProp = 'g:G';
    let html = app.txLinhaHtml(linhas()[0], '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(300)));
    assert.ok(html.includes('dividido por 3 imóveis'));
    app.txProp = ''; app.ownerFilter = 'bruno';   // só é dono do T2, a 30 %
    let ls = linhas();
    assert.equal(ls.length, 1);
    assert.equal(ls[0].id, 'L1_casa');
    perto(app.valorNaVista(ls[0]), 30, 0.005);
    html = app.txLinhaHtml(ls[0], '2026-03');
    assert.ok(html.includes('parte de «Seguro» · total ' + app.euro2(300)), html);
    app.ownerFilter = 'ana';                      // 70 % do T2 e os outros dois inteiros
    ls = linhas();
    assert.equal(ls[0]._partes.length, 3);
    perto(app.valorNaVista(ls[0]), 270, 0.005);
    html = app.txLinhaHtml(ls[0], '2026-03');
    assert.ok(html.includes('dividido por 3 imóveis · a tua parte · total ' + app.euro2(300)), html);
  });

  test('de um grupo que já não existe, só «· 3 imóveis» — nunca «Todos os imóveis»', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3'], { alvo: 'g:APAGADO' });
    const html = app.txLinhaHtml(linhas()[0], '2026-03');
    assert.ok(html.includes(' · 3 imóveis'), html);
    assert.doesNotMatch(html, /Todos os imóveis|Bloco/);
    assert.ok(html.includes('dividido por 3 imóveis'));
  });

  test('txLinhaHtml usa o id da primeira parte, pela ordem dos imóveis, no data-lp e no txView', () => {
    lote(app, 'L1', ['casa3', 'casa2', 'casa']);   // na base ao contrário
    const l = linhas()[0];
    assert.equal(l.id, 'L1_casa', 'a primeira pela ordem dos imóveis, não pela da base');
    igual(l._partes.map((p) => p.id), ['L1_casa', 'L1_casa2', 'L1_casa3']);
    const html = app.txLinhaHtml(l, '2026-03');
    assert.ok(html.includes('data-lp="tx:L1_casa"'), html);
    assert.ok(html.includes("txView('L1_casa')"), html);
    assert.equal((html.match(/L1_casa[23]/g) || []).length, 0, 'as outras partes não aparecem na linha');
  });
});

describe('as linhas da lista', () => {
  beforeEach(() => semear(app));

  test('linhasDaLista: pela ordem, os normais tal e qual e cada lote no lugar da primeira parte; dois lotes não se misturam; o _partes não toca na base', () => {
    const a = mov(app, { id: 'A', date: '2026-03-20' });
    lote(app, 'L1', ['casa', 'casa2']);
    const b = mov(app, { id: 'B', date: '2026-03-05' });
    lote(app, 'L2', ['casa2', 'casa3'], { label: 'Seguro' });   // o mesmo rótulo e a mesma data
    const ls = app.linhasDaLista(app.db.transactions.slice());
    igual(ls.map((l) => l.id), ['A', 'L1_casa', 'B', 'L2_casa2']);
    assert.equal(ls[0], a, 'um movimento normal passa tal e qual');
    assert.equal(ls[2], b);
    igual(ls[1]._partes.map((p) => p.id), ['L1_casa', 'L1_casa2']);
    igual(ls[3]._partes.map((p) => p.id), ['L2_casa2', 'L2_casa3']);
    assert.ok(app.db.transactions.every((t) => !('_partes' in t)), 'a linha é uma cópia: a base não ganha _partes');
    assert.equal(app.linhasDaLista([]).length, 0);
  });

  test('os indicadores somam as partes (300 €) e a contagem conta linhas', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3']);
    mov(app, { id: 'A', amount: 50 });
    mov(app, { id: 'R', kind: 'income', label: 'Renda', amount: 1000, date: '2026-03-05' });
    let html = app.vTransactions();
    assert.equal(kpiValor(html, 'Despesas'), app.euro(350), 'as três partes e a luz');
    assert.equal(kpiValor(html, 'Saldo'), app.euro(650));
    assert.equal(kpiRodape(html, 'Saldo'), '3 movimentos', 'o lote, a luz e a renda: três linhas, não cinco');
    assert.equal(app.txLinhasPintadas, 3);
    app.txProp = 'casa';
    html = app.vTransactions();
    assert.equal(kpiValor(html, 'Despesas'), app.euro(150), 'a parte do T2 e a luz');
    assert.equal(kpiRodape(html, 'Saldo'), '3 movimentos');
    const evo = app.KPI_REG[(cartao(html, 'Despesas').match(/id="(k\d+)"/) || [])[1]].evo();
    perto(evo.monthly.reduce((x, y) => x + y, 0), 150, 0.005, 'as evoluções somam as partes');
    app.txProp = ''; app.txFilter = 'expense';
    assert.match(app.txFilterBody(), /· 2 movimentos</, 'a contagem do painel dos filtros também é de linhas');
  });

  test('o saldo do mês soma a linha do lote uma vez', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3']);
    mov(app, { id: 'A', amount: 50 });
    const soma = (ls) => ls.reduce((x, t) => x + app.saldoNaVista(t), 0);
    perto(soma(linhas()), -350, 0.005);
    app.txProp = 'casa3';
    perto(soma(linhas()), -100, 0.005);
  });

  test('ordenar por montante usa o valor da linha, não o de cada parte', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3']);        // 300, em partes de 100
    mov(app, { id: 'A', amount: 250 });
    mov(app, { id: 'B', amount: 150 });
    app.txSort = 'amount'; app.txDir = 'desc';
    igual(linhas().map((t) => t.id), ['L1_casa', 'A', 'B'], 'o lote vale 300: à frente');
    app.txDir = 'asc';
    igual(linhas().map((t) => t.id), ['B', 'A', 'L1_casa']);
    app.txProp = 'casa'; app.txDir = 'desc';
    igual(linhas().map((t) => t.id), ['A', 'B', 'L1_casa'], 'no T2 a linha vale 100: fica para o fim');
  });

  test('a linha refaz-se quando o filtro muda, e só então (a assinatura da lista viva)', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3']);
    const sem = linhas()[0], htmlSem = app.txLinhaHtml(sem, '2026-03');
    const outra = linhas()[0];
    assert.equal(outra.id, sem.id, 'a mesma chave de pintura para pintura');
    assert.equal(app.txLinhaHtml(outra, '2026-03'), htmlSem, 'e o mesmo HTML: fica como está');
    app.txProp = 'casa';
    const t2 = linhas()[0];
    assert.equal(t2.id, 'L1_casa', 'o T2 é a primeira parte: a chave é a mesma…');
    assert.notEqual(app.txLinhaHtml(t2, '2026-03'), htmlSem, '… e o HTML muda: a lista viva refaz a linha');
    app.txProp = 'casa3';
    assert.equal(linhas()[0].id, 'L1_casa3', 'noutro imóvel é outra linha');
    app.txProp = 'g:G';
    assert.equal(app.txLinhaHtml(linhas()[0], '2026-03'), htmlSem, 'o grupo inteiro é o lote inteiro');
  });

  test('a pesquisa encontra o lote pelo total escrito e pelo nome do grupo, não pelo valor de uma parte', () => {
    lote(app, 'L1', ['casa', 'casa2', 'casa3']);
    app.txSearch = '300';
    assert.equal(linhas().length, 1);
    assert.equal(linhas()[0]._partes.length, 3);
    app.txSearch = 'bloco';
    assert.equal(linhas().length, 1);
    app.txSearch = '100';
    assert.equal(linhas().length, 0);
  });
});

describe('«Sem imóvel» e os movimentos de grupo antigos', () => {
  beforeEach(() => semear(app));

  test('um movimento sem imóvel não passa no filtro por um imóvel, e passa em «Sem imóvel atribuído» e sem filtro', () => {
    const s = mov(app, { id: 'S', label: 'Contabilista', amount: 80, propertyId: null });
    lote(app, 'L1', ['casa', 'casa2', 'casa3']);
    igual(linhas().map((t) => t.id), ['S', 'L1_casa'], 'sem filtro, os dois (por data, do mais recente)');
    assert.ok(app.txMatch(s));
    app.txProp = 'casa';
    assert.ok(!app.txMatch(s), 'não é de nenhum imóvel');
    igual(linhas().map((t) => t.id), ['L1_casa']);
    app.txProp = '__none__';
    assert.ok(app.txMatch(s));
    igual(linhas().map((t) => t.id), ['S'], 'as partes de um lote têm imóvel: não são «sem imóvel»');
    assert.equal(app.valorNaVista(s), 80, 'por inteiro');
  });

  test('um movimento de grupo antigo (groupId, sem partes) mostra-se como hoje', () => {
    const g = mov(app, { id: 'GR', label: 'Limpeza', amount: 300, propertyId: null, groupId: 'G' });
    let ls = linhas();
    assert.equal(ls.length, 1);
    assert.equal(ls[0], g, 'a própria, sem cópia nem _partes');
    let html = app.txLinhaHtml(ls[0], '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(300)));
    assert.doesNotMatch(html, /dividido por|imóveis/);
    app.txProp = 'casa';
    ls = linhas();
    assert.equal(ls[0], g);
    assert.equal(app.valorNaVista(g), 100, 'a quota do T2, como hoje');
    html = app.txLinhaHtml(g, '2026-03');
    assert.ok(html.includes('parte de Bloco · total ' + app.euro2(300)), html);
  });
});

describe('a seleção com lotes (cloud/selecao.js)', () => {
  let esp;
  beforeEach(() => {
    semear(nuvem);
    nuvem.CW.selReset();
    esp = { toasts: [], confirmar: null, desfazer: null };
    janelasFalsas(nuvem, 'render', 'save', 'buildNav');
    nuvem.toast = (m) => { esp.toasts.push(m); };
    nuvem.confirmModal = (titulo, texto, cb) => { esp.confirmar = { titulo, texto, cb }; };
    nuvem.comDesfazer = (msg, restaurar) => { esp.desfazer = { msg, restaurar }; };
  });
  afterEach(() => { nuvem.CW.selReset(); });

  const marcados = () => Object.keys(nuvem.selIds).sort();

  test('marcar a linha marca o lote: as três partes, contadas como um movimento, e a marca segue o filtro', () => {
    lote(nuvem, 'L1', ['casa', 'casa2', 'casa3']);
    lote(nuvem, 'L2', ['casa', 'casa2'], { label: 'Condomínio' });
    mov(nuvem, { id: 'A' });
    nuvem.CW.selEntrar();
    nuvem.CW.selToggle('L1_casa');
    igual(marcados(), ['L1_casa', 'L1_casa2', 'L1_casa3'], 'o lote inteiro, e nada do outro lote');
    assert.equal(nuvem.selN(), 1, 'um movimento');
    nuvem.vTransactions();
    const l1 = nuvem.txLista.find((l) => l.id === 'L1_casa');
    const html = nuvem.txLinhaHtml(l1, '2026-03');
    assert.ok(html.includes('data-tx="L1_casa"'), 'o data-tx é o da primeira parte');
    assert.match(html, /sel-on/);
    assert.ok(html.includes("CW.selToggle('L1_casa',event)"));
    nuvem.txProp = 'casa3';                       // a linha passa a ser a parte do T1…
    nuvem.vTransactions();
    const so = nuvem.txLista.find((l) => l.lote && l.lote.id === 'L1');
    assert.equal(so.id, 'L1_casa3');
    assert.match(nuvem.txLinhaHtml(so, '2026-03'), /sel-on/, '… e continua marcada');
    nuvem.CW.selToggle('L1_casa3');               // desmarcar por qualquer parte desmarca o lote
    igual(marcados(), []);
    nuvem.CW.selEntrar('L2_casa2');               // entrar pelo toque longo numa parte
    igual(marcados(), ['L2_casa', 'L2_casa2']);
    nuvem.CW.selToggle('A');
    assert.equal(nuvem.selN(), 2);
  });

  test('marcar tudo e marcar o mês marcam cada lote inteiro, e voltar a tocar desmarca', () => {
    lote(nuvem, 'L1', ['casa', 'casa2', 'casa3']);
    mov(nuvem, { id: 'A' });
    // as linhas no ecrã, como o selPintar as lê: o data-tx e o data-mes, a classe e a caixa
    const linhaFalsa = (id, mes) => ({ getAttribute: (k) => (k === 'data-tx' ? id : k === 'data-mes' ? mes : null),
      classList: { toggle() {} }, querySelector: () => null });
    nuvem.document.querySelectorAll = (s) => (/\.txrow/.test(s) ? [linhaFalsa('L1_casa', '2026-03'), linhaFalsa('A', '2026-03')] : []);
    nuvem.CW.selEntrar();
    nuvem.CW.selTodos();
    igual(marcados(), ['A', 'L1_casa', 'L1_casa2', 'L1_casa3']);
    assert.equal(nuvem.selN(), 2);
    nuvem.CW.selTodos();
    igual(marcados(), [], 'tudo marcado: limpa, com as partes todas');
    nuvem.CW.selMes('2026-03');
    igual(marcados(), ['A', 'L1_casa', 'L1_casa2', 'L1_casa3']);
  });

  test('editar em massa muda a categoria das três partes, e de mais nenhuma', () => {
    const ps = lote(nuvem, 'L1', ['casa', 'casa2', 'casa3']);
    const outro = lote(nuvem, 'L2', ['casa', 'casa2'], { label: 'Condomínio' });
    const a = mov(nuvem, { id: 'A', category: 'Luz' });
    nuvem.CW.selEntrar('L1_casa2');
    nuvem.document.getElementById('selCat').value = 'Seguros';
    nuvem.CW.selGravar();
    igual(ps.map((t) => t.category), ['Seguros', 'Seguros', 'Seguros']);
    igual(outro.map((t) => t.category), ['', '']);
    assert.equal(a.category, 'Luz');
    igual(esp.toasts, ['1 movimento alterado.']);
    assert.equal(nuvem.CW.selMode, false, 'sai da seleção');
  });

  test('eliminar a seleção apaga as três partes, a confirmação soma 300 € e o Anular repõe-nas', () => {
    lote(nuvem, 'L1', ['casa', 'casa2', 'casa3']);
    lote(nuvem, 'L2', ['casa', 'casa2'], { label: 'Condomínio' });
    nuvem.CW.selEntrar('L1_casa');
    nuvem.CW.selApagar();
    assert.ok(esp.confirmar, 'pede confirmação');
    assert.equal(esp.confirmar.titulo, 'Eliminar 1 movimento');
    assert.equal(esp.confirmar.texto, 'Somam ' + nuvem.euro2(300) + '.');
    esp.confirmar.cb();
    igual(nuvem.db.transactions.map((t) => t.id).sort(), ['L2_casa', 'L2_casa2'], 'só o outro lote fica');
    assert.equal(esp.desfazer.msg, '1 movimento eliminado.');
    esp.desfazer.restaurar();
    igual(nuvem.db.transactions.map((t) => t.id).sort(), ['L1_casa', 'L1_casa2', 'L1_casa3', 'L2_casa', 'L2_casa2']);
    igual(nuvem.db.transactions.filter((t) => t.lote.id === 'L1').map((t) => t.lote.total), [300, 300, 300], 'inteiras, com o lote');
  });

  test('um lote e um movimento solto: «Eliminar 2 movimentos», somam 350 €', () => {
    lote(nuvem, 'L1', ['casa', 'casa2', 'casa3']);
    mov(nuvem, { id: 'A', amount: 50 });
    nuvem.CW.selEntrar('A');
    nuvem.CW.selToggle('L1_casa3');
    nuvem.CW.selApagar();
    assert.equal(esp.confirmar.titulo, 'Eliminar 2 movimentos');
    assert.equal(esp.confirmar.texto, 'Somam ' + nuvem.euro2(350) + '.');
    esp.confirmar.cb();
    assert.equal(nuvem.db.transactions.length, 0);
  });

  test('um lote incompleto nesta base não se edita nem se apaga pela seleção: só quem vê os imóveis todos o altera', () => {
    const ps = lote(nuvem, 'L5', ['casa', 'casa2', 'casa3'], { n: 5, total: 500 });
    nuvem.CW.selEntrar('L5_casa');
    assert.equal(nuvem.selN(), 1);
    nuvem.CW.selApagar();
    assert.equal(esp.confirmar, null, 'nem chega a perguntar');
    assert.match(esp.toasts[0], /Um movimento dividido ficou de fora: tem partes em imóveis que não vês/);
    assert.equal(nuvem.db.transactions.length, 3);
    nuvem.document.getElementById('selCat').value = 'Seguros';
    nuvem.CW.selGravar();
    igual(ps.map((t) => t.category), ['', '', ''], 'nenhuma parte mudou');
    assert.match(esp.toasts[1], /^Um movimento dividido ficou de fora/);
  });
});
