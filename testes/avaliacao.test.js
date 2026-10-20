// Avaliação: NOI anualizado, valor por rendimento, diferença sem valor de mercado,
// yield exigido, equity projetado, o relatório em texto e onde vive a rentabilidade.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, perto, repor } from './arnes.js';

// a app vive num dia fixo: o NOI anualiza-se pelos meses que já passaram do
// ano, e o que o teste prova não pode mudar com o mês em que a bateria corre
const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
const ANO = Number(app.today().slice(0, 4));
const MES = Number(app.today().slice(5, 7));

let p;
beforeEach(() => {
  limpar(app);
  app.repProp = '';
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  p = app.normProp({ id: 'v1', name: 'T2', value: 220000, purchase: 150000, ownerIds: ['ana', 'bruno'], ownerShares: { ana: 60, bruno: 40 } });
  app.db.properties.push(p);
});
const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ kind: 'income', amount: 1000, propertyId: 'v1', date: ANO + '-03-05' }, extra)));
const oitoRendas = () => {
  for (let i = 1; i <= 8; i++) mov({ date: `${ANO}-0${i}-05` });
  mov({ kind: 'expense', amount: 1000, date: ANO + '-02-10' });
};

describe('avaliação por rendimento', () => {
  test('anualiza o ano corrente e os cartões e o relatório mostram o mesmo valor', () => {
    oitoRendas();
    const m = app.metrics(ANO, 'v1', {});
    perto(m.noiAnual, 7000 * 12 / MES, 1e-6);
    const { valuation, diff } = app.valuationOf(m.noiAnual, 220000);
    perto(valuation, m.noiAnual / 0.05, 1e-6);
    perto(diff, valuation / 220000 - 1, 1e-9);
    const v = app.euro(valuation);
    assert.ok(app.repCard(p).includes(v), 'o cartão do imóvel');
    assert.ok(app.portCard(null).includes(v), 'o cartão do portefólio');
    assert.ok(app.reportText().includes(v), 'o relatório em texto');
  });

  test('anos completos usam o NOI real', () => {
    for (let i = 1; i <= 12; i++) mov({ date: `${ANO - 1}-${String(i).padStart(2, '0')}-05` });
    mov({ kind: 'expense', amount: 1000, date: (ANO - 1) + '-06-10' });
    const y = app.evoValuation(p, 'val').yearly.find((x) => x.label === ANO - 1);
    perto(y.value, 11000 / 0.05);
    const d = app.evoValuation(p, 'diff').yearly.find((x) => x.label === ANO - 1);
    perto(d.value, 0, 1e-9);
  });

  test('cauções e empréstimos recebidos não entram no NOI', () => {
    oitoRendas();
    const antes = app.metrics(ANO, 'v1', {}).noiAnual;
    mov({ amount: 2000, category: 'Rendas', sub: 'Caução' });
    mov({ amount: 10000, category: 'Empréstimos recebidos', sub: 'Família' });
    perto(app.metrics(ANO, 'v1', {}).noiAnual, antes, 1e-9);
  });

  test('o yield exigido não aceita zero nem negativo', () => {
    app.render = () => {};
    app.capTargetSet('-5');
    assert.equal(app.db.settings.capTarget, 0.1);
    app.capTargetSet('');
    assert.equal(app.db.settings.capTarget, 5);
    app.capTargetSet('0');
    assert.equal(app.db.settings.capTarget, 5);
    app.capTargetSet('6,5');
    assert.equal(app.db.settings.capTarget, 6.5);
    app.db.settings.capTarget = -5;      // dados antigos
    perto(app.capTargetFrac(), 0.001, 1e-12);
    assert.ok(app.valuationOf(11000, 220000).valuation > 0);
  });

  test('sem valor de mercado a diferença é «—», sem cor nem juízo', () => {
    assert.ok(Number.isNaN(app.valuationOf(11000, 0).diff));
    igual(app.diffKpi(NaN), { v: '—', c: '', f: 'sem valor de mercado' });
    igual(app.diffKpi(0.05), { v: '+5,0%', c: 'pos', f: 'as rendas justificam mais' });
    assert.equal(app.diffKpi(-0.1).c, 'neg');
    p.value = 0;
    oitoRendas();
    const html = app.repCard(p);
    assert.match(html, /sem valor de mercado/);
    assert.doesNotMatch(html, /\+0,0%/);
  });

  test('o equity projetado bate com o plano da hipoteca', () => {
    const l = app.normLoan({ id: 'l1', outstanding: 100000, years: 30, rate: 3 });
    p.loans = [l];
    p.value = 200000;
    const e = app.evoValuation(p, 'equity').yearly[0];
    perto(e.value, 200000 - app.amort(l, 12).rows[11].bal);
    assert.equal(app.debtOf(p), 100000);
    perto(app.payOf(p), 431.6, 0.01);
  });

  test('debtOf e payOf ignoram hipotecas liquidadas', () => {
    const viva = app.normLoan({ id: 'l2', outstanding: 50000, years: 20, rate: 3 });
    p.loans = [app.normLoan({ id: 'l1', outstanding: 0, years: 30, rate: 3 }), viva];
    assert.equal(app.debtOf(p), 50000);
    perto(app.payOf(p), app.loanCalc(viva).total, 1e-9);
  });
});

describe('o relatório em texto', () => {
  test('usa os mesmos números que os cartões, na quota do proprietário filtrado', () => {
    app.db.contracts.push(app.normContract({ propertyId: 'v1', rent: 1000, active: true }));
    oitoRendas();
    app.ownerFilter = 'ana';
    const t = app.reportText();
    assert.ok(t.includes('Renda contratada ' + app.euro(600) + '/mês'), 'cabeçalho a 60 %');
    assert.ok(t.includes('Renda ' + app.euro(600) + '/mês'), 'bloco do imóvel a 60 %');
    assert.ok(t.includes('Valor ' + app.euro(132000)), 'valor de mercado a 60 %');
    assert.ok(t.includes('quota-parte 60%'));
    const m = app.metrics(ANO, 'v1', { share: true });
    assert.ok(t.includes('avaliação por rendimento ' + app.euro(app.valuationOf(m.noiAnual, m.value).valuation)));
    assert.match(t, /sobre a aquisição/);
    assert.doesNotMatch(t, /cash-on-cash/);
    assert.match(t, /Valor por rendimento .* · diferença/);
    assert.ok(app.repCard(p).includes(app.euro(132000)), 'o cartão do imóvel também entra na quota');
  });
});

describe('onde vive a rentabilidade', () => {
  test('saiu da visão geral', () => {
    oitoRendas();
    const html = app.vDashboard();
    assert.doesNotMatch(html, /Rentabilidade|Yield bruto|Cap rate|Sobre a aquisição|>LTV</);
    assert.match(html, /Cashflow/, 'os KPIs do ano ficam');
    assert.match(html, /Renda líquida de impostos \(estim\.\)/);
  });

  test('a avaliação mostra os quatro rácios como KPI com explicação e evolução, no portefólio e na ficha do imóvel', () => {
    oitoRendas();
    /* com um imóvel só, o portefólio É esse imóvel: a página é logo a ficha dele */
    let html = app.vReports();
    for (const r of ['Yield bruto', 'Cap rate', 'Sobre a aquisição', 'LTV', 'Equity']) {
      assert.equal((html.match(new RegExp('class="label">' + r + '<', 'g')) || []).length, 1, r + ' na ficha do imóvel');
    }
    assert.equal((html.match(/class="card kpi evo"/g) || []).length, 5, 'cinco KPIs com evolução (o Equity e os quatro rácios)');
    assert.match(html, /kpiModal\('k\d+'\)" aria-label="Valor por rendimento, /, 'o valor por rendimento abre a evolução');
    assert.match(html, /kpiModal\('k\d+'\)" aria-label="Diferença, /, 'e a diferença também');
    assert.doesNotMatch(html, /Por imóvel/, 'sem tabela de uma linha');
    /* com dois, o portefólio: os rácios dele e a tabela «Por imóvel», que abre a ficha de cada um */
    app.db.properties.push(app.normProp({ id: 'v2', name: 'T1 Benfica', value: 150000, ownerIds: ['ana'] }));
    html = app.vReports();
    for (const r of ['Yield bruto', 'Cap rate', 'Sobre a aquisição', 'LTV']) {
      assert.equal((html.match(new RegExp('class="label">' + r + '<', 'g')) || []).length, 1, r + ' no portefólio');
    }
    assert.equal((html.match(/class="card kpi evo"/g) || []).length, 4, 'os quatro rácios do portefólio com evolução');
    assert.match(html, /<th>Imóvel<\/th><th class="u-ta-left">Ocupação<\/th><th>Valor<\/th><th>Renda anual<\/th><th>NOI anualizado<\/th><th>Yield<\/th><th>Cap rate<\/th><th>LTV<\/th><th>Cashflow<\/th>/);
    assert.match(html, /data-click="repFoco\('v1'\)"/);
    assert.match(html, /data-click="repFoco\('v2'\)"/);
    const m = app.metrics(ANO, 'v1', { share: true });
    assert.ok(html.includes('<td>' + app.pct(m.cap) + '</td>'), 'a linha traz o cap rate do imóvel');
    assert.match(html, /Ana 60% · Bruno 40%/, 'os donos com a quota de cada um');
    assert.doesNotMatch(html, /Yield líquido \(cap rate\)/);
    assert.match(html, /Renda anual contratada/);
    assert.match(html, /anualizado/);
    /* tocar numa linha põe o imóvel em foco, e a página passa a ser a ficha dele */
    app.render = () => {};
    app.repFoco('v1');
    assert.equal(app.repProp, 'v1');
    html = app.vReports();
    assert.match(html, /<h2 class="ava-nome">T2<\/h2>/);
    assert.match(html, /<span class="mov-chip on">[\s\S]*?aria-label="Imóvel: T2"[\s\S]*?aria-label="Voltar a todos os imóveis" data-toca="vista" data-click="repAnaLimpar\(\);render\(\);anaChipFocar\('repSel'\)"/, 'e o × do chip «Imóvel» limpa-o');
    app.repProp = '';
  });

  test('as ações da página vivem na fila do chip «Imóvel»; o yield exigido saiu para a roda dentada', () => {
    oitoRendas();
    const html = app.vReports();
    /* um botão de partilha só, com as duas ações no menu dele */
    assert.ok(html.includes('aria-label="Partilhar" title="Partilhar">'));
    assert.ok(html.includes('data-click="closePops();shareReport()">'));
    assert.ok(html.includes('data-click="closePops();downloadCsv()">'));
    assert.match(html, /^<div class="ana-topo"><div class="chips-fila mov-chips ana-chips" role="group" aria-label="Filtros da avaliação"><span class="mov-chip">/);
    assert.doesNotMatch(html, /ana-pin|avaYield|capTargetSet/, 'o yield não está na página');
    assert.doesNotMatch(html, /Proprietário/, 'nem o chip do proprietário');
  });

  test('evoRatio aceita o âmbito todo, um imóvel e um grupo', () => {
    p.loans = [app.normLoan({ id: 'l1', outstanding: 100000, years: 30, rate: 3 })];
    app.db.groups.push(app.normGroup({ id: 'G', name: 'Grupo', kind: 'prop', ids: ['v1'] }));
    const todo = app.evoRatio('ltv', null), um = app.evoRatio('ltv', 'v1'), g = app.evoRatio('ltv', 'g:G');
    assert.ok(todo.yearly.length >= 2 && Number.isFinite(todo.yearly[0].value));
    const vals = (d) => JSON.parse(JSON.stringify(d.yearly.map((y) => y.value)));
    igual(vals(todo), vals(um), 'com um só imóvel, o âmbito é o imóvel');
    igual(vals(g), vals(um), 'o grupo já não dá NaN');
    assert.equal(typeof app.rentGrid, 'function');
  });

  test('a amortização antecipada aparece à parte', () => {
    oitoRendas();
    mov({ kind: 'loan', amount: 600, payType: 'prestacao', date: ANO + '-04-05' });
    mov({ kind: 'loan', amount: 30000, payType: 'amortizacao', date: ANO + '-04-20' });
    assert.match(app.repCard(p), /Amortizações antecipadas/);
    /* a visão geral escreve os fluxos com os cêntimos (painel-geral.js: o canvas
       diz «+5 000,00 € amortizados»); a regra que se guarda aqui é a mesma */
    assert.ok(app.vDashboard().includes('+' + app.euro2(30000) + ' amortizados'));
    assert.ok(app.vDashboard().includes('>' + app.euro2(600) + '<'), 'as prestações não levam a amortização');
  });
});

describe('o que a página mostra e faz', () => {
  test('o selo da ocupação: por quartos cobalto, uso próprio cinzento, e um estado desconhecido cinzento', () => {
    assert.equal(app.avaSelo({ key: 'parcial', label: '3/4 quartos' }), '', 'o cobalto é o .badge sem modificador');
    assert.equal(app.avaSelo({ key: 'arrendado' }), 'in');
    assert.equal(app.avaSelo({ key: 'vago' }), 'amber');
    assert.equal(app.avaSelo({ key: 'proprio' }), 'grey');
    assert.equal(app.avaSelo({ key: 'outra' }), 'grey');
    assert.equal(app.avaSelo({ key: 'toString' }), 'grey', 'só as chaves do mapa');
  });

  test('na conta de exploração, o «−» e a cor só vão no que tem valor', () => {
    const m = { income: 1000, op: 0, noi: 1000, loan: 0.4, amort: 0, cf: 999.6 };
    let html = app.contaCard(m);
    assert.doesNotMatch(html, /−/, 'sem despesas nem prestações não há «−0 €»');
    assert.doesNotMatch(html, /class="(neg|prest)"/, 'nem a cor do que sai');
    html = app.contaCard(Object.assign({}, m, { op: 250, loan: 600, cf: 150 }));
    assert.ok(html.includes('<b class="neg">−' + app.euro(250) + '</b>'));
    assert.ok(html.includes('<b class="prest">−' + app.euro(600) + '</b>'));
  });

  test('gravar o yield não tira o foco ao campo para onde o Tab foi', async () => {
    const doc = app.document;
    const seguinte = doc.getElementById('avaSeguinte');
    seguinte.id = 'avaSeguinte';
    let pintou = 0, focado = 0;
    seguinte.focus = () => { focado++; doc.activeElement = seguinte; };
    // o render troca a vista inteira: quem tinha o foco desaparece e ele cai no body
    app.render = () => { pintou++; doc.activeElement = doc.body; };
    doc.activeElement = doc.body;        // no change, o foco ainda vai a caminho do campo seguinte
    app.capTargetSet('6');
    assert.equal(app.db.settings.capTarget, 6, 'grava já');
    assert.equal(pintou, 0, 'o redesenho espera que o foco assente');
    doc.activeElement = seguinte;        // o Tab acabou de o levar ao campo seguinte
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(pintou, 1, 'redesenha uma vez');
    assert.equal(focado, 1, 'e devolve o foco ao campo seguinte');
    let corpo = '';
    const abrir = app.openModal;
    app.openModal = (t, b) => { corpo = b; };
    try { app.avaOpcoes(); } finally { app.openModal = abrir; }
    assert.match(corpo, /<input id="avaYield" [^>]*data-input="avaOpcaoYield\(this\)" data-change="avaOpcaoYield\(this,1\)"/, 'o campo do yield tem id, para o foco lhe voltar');
  });

  test('a explicação do herói diz o anualizado uma vez só', () => {
    oitoRendas();
    const m = app.metrics(ANO, 'v1', { share: true }), v = app.valuationOf(m.noiAnual, m.value);
    const html = app.avaHeroi(m, v.valuation, v.diff, null);
    assert.equal(html.split('o resultado até hoje é anualizado').length - 1, 1);
    assert.match(html, /O anualizado é ×12 sobre os meses decorridos\./);
  });

  test('as hipotecas: os números e o gráfico da dívida lado a lado; o total dos contratos só na primeira célula', () => {
    p.loans = [app.normLoan({ id: 'l1', outstanding: 100000, years: 30, rate: 3 })];
    const html = app.repCard(p);
    assert.match(html, /<div class="ava-hip"><div><div class="stat">[\s\S]*Imposto do selo até ao fim[\s\S]*?<\/div><\/div>\s*<div class="chartbox/, 'os números numa coluna e o gráfico noutra');
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago' }));
    app.db.contracts.push(app.normContract({ id: 'C1', propertyId: 'v1', tenantIds: ['t1'], rent: 900, start: (ANO - 1) + '-01-01', active: true }));
    const comContrato = app.repCard(p);
    assert.match(comContrato, /<tr class="ana-total"><td><b>Total mensal<\/b><\/td><td><\/td>/, 'a célula presa ao rolar não leva duas colunas por cima dos valores');
  });
});
