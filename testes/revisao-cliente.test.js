// O cliente em serviços, com dados: o render de cada separador, o ecrã de
// serviço desligado, o toque longo de cada prefixo, a camada da nuvem inteira
// a embrulhar as funções movidas, os menus sem repetições, o go, o botão de
// filtros e os crachás — e, no fim, as regras que a passagem a serviços
// chegou a partir e que ficaram presas aqui: os crachás da gaveta e da barra
// de baixo, o menu do contrato, os prazos, os primeiros passos e as
// Definições com um serviço desligado, e o primeiro separador do arranque.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { carregarApp, carregarTudo, carregarBase, limpar, igual, elementos, SERVICOS_FICHEIROS } from './arnes.js';

const RAIZ = new URL('../', import.meta.url);
const ler = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const ANO = new Date().getFullYear();
/* os quinze separadores, pela ordem do menu: os catorze serviços mais as Definições */
const SEPARADORES = SERVICOS_FICHEIROS.map((s) => s.id).concat(['settings']);

/* Um proprietário, um inquilino, um imóvel de investimento com hipoteca viva,
   um contrato em vigor, uma renda e uma despesa, um planeado vencido hoje, um
   modelo e uma visita hoje — o suficiente para cada vista e cada menu terem
   o que mostrar.
   Recebe: app — o contexto da app.
   Devolve: a base semeada (app.db). */
function semear(app) {
  const db = limpar(app);
  const hoje = app.pzHoje();
  db.owners.push(app.normPerson({ id: 'o1', name: 'Ana Dona', nif: '123456789', phone: '912345678' }));
  db.tenants.push(app.normPerson({ id: 't1', name: 'Rui Inquilino', phone: '961234567' }));
  const l = app.normLoan({ id: 'l1', name: 'Aquisição', bank: 'Banco Azul', outstanding: 50000, years: 20, type: 'fixa', rate: 3, start: '2020-01-10' });
  db.properties.push(app.normProp({ id: 'p1', name: 'T2 Lisboa', address: 'Rua do Mar 1', use: 'investimento', rentalMode: 'inteiro', ownerIds: ['o1'], value: 200000, purchase: 150000, loans: [l] }));
  db.contracts.push(app.normContract({ id: 'c1', name: 'Arrendamento', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.transactions.push(app.normTx({ id: 'x1', kind: 'income', label: 'Renda', category: 'Rendas', amount: 800, propertyId: 'p1', contractId: 'c1', date: ANO + '-01-05', paidBy: 'o1' }));
  db.transactions.push(app.normTx({ id: 'x2', kind: 'expense', label: 'Condomínio', category: 'Condomínio', amount: 55, propertyId: 'p1', date: ANO + '-01-12' }));
  db.recurring.push(app.normRec({ id: 'r1', name: 'Seguro', every: 'month', next: hoje, tx: { kind: 'expense', label: 'Seguro', amount: 20, propertyId: 'p1' } }));
  db.templates.push(app.normTpl({ id: 'm1', name: 'Luz', tx: { kind: 'expense', label: 'Luz', amount: 30, propertyId: 'p1' } }));
  db.visits.push(app.normVisit({ id: 'v1', nomes: 'Bruno', propertyId: 'p1', date: hoje, start: '15:00' }));
  return db;
}

/* o toque longo devolve os rótulos das opções em vez de abrir a folha */
function folhas(app) {
  const vistas = [];
  app.lpShow = (t, opts) => { vistas.push({ titulo: t, labels: JSON.parse(JSON.stringify(opts.map((o) => o.label))) }); };
  return vistas;
}
const repetidos = (l) => l.filter((x, i) => l.indexOf(x) !== i);
/* a ligação de um separador na gaveta ou na barra de baixo, com o crachá que traz */
const ligacao = (html, chamada) => (html.match(new RegExp('<a [^>]*data-click="' + chamada.replace(/[()']/g, '\\$&') + '"[^>]*>[\\s\\S]*?</a>')) || [''])[0];

describe('regressão: o render de cada um dos quinze separadores, com tudo carregado e dados semeados', () => {
  for (const t of SEPARADORES) {
    test('render: «' + t + '» pinta HTML no #view sem lançar, pela vista que o serviço registou', () => {
      const app = carregarApp();
      const fixos = elementos(app);
      semear(app);
      assert.equal(typeof app.vistaDoSeparador(t), 'function', 'há vista registada');
      app.tab = t;
      app.render();
      const html = fixos.view.innerHTML;
      assert.ok(html.length > 0, 'o #view tem HTML');
      assert.doesNotMatch(html, /está desligado nesta conta/, 'não é o ecrã de serviço desligado');
      assert.doesNotMatch(html, /undefined|NaN/, 'sem restos de valores por preencher');
    });
  }
});

describe('regressão: cada serviço desligado pinta o ecrã que diz o nome e quem o liga', () => {
  for (const s of SERVICOS_FICHEIROS) {
    test('desligado: «' + s.id + '» no separador dele mostra «' + s.nome + ' está desligado nesta conta»', () => {
      const app = carregarApp();
      const fixos = elementos(app);
      semear(app);
      app.definirServicosDesligados([s.id]);
      assert.equal(app.vistaDoSeparador(s.id), null, 'sem vista para despachar');
      app.tab = s.id;
      app.render();
      const html = fixos.view.innerHTML;
      assert.ok(html.includes(app.esc(s.nome) + ' está desligado nesta conta'), html.slice(0, 200));
      assert.match(html, /O suporte pode ligá-lo quando quiseres\./);
      assert.match(html, /data-toca="ecra" data-click="go\(primeiroSeparadorLigado\(\)\)"/, 'o Voltar tem data-toca e vai ao primeiro ligado');
      assert.doesNotMatch(html, /não podes|não tens|erro/i, 'sem culpa');
      // e as Definições continuam a abrir com este desligado
      app.tab = 'settings';
      app.render();
      assert.doesNotMatch(fixos.view.innerHTML, /está desligado nesta conta/);
    });
  }
});

describe('regressão: o toque longo de cada prefixo abre com o serviço dono ligado e não abre com ele desligado', () => {
  const PREFIXOS = [
    ['prop', 'prop:p1', 'properties'],
    ['tx', 'tx:x1', 'transactions'],
    ['ct', 'ct:c1', 'contracts'],
    ['per', 'per:tenant:t1', 'tenants'],
    ['vis', 'vis:v1', 'visits'],
    ['rec', 'rec:r1', 'recurring'],
    ['tpl', 'tpl:m1', 'recurring'],
    ['mort', 'mort:p1:l1', 'credits'],
  ];
  for (const [prefixo, valor, servico] of PREFIXOS) {
    test('toque longo: «' + prefixo + '» abre a folha com ' + servico + ' ligado, sem opções repetidas, e fica quieto com ele desligado', () => {
      const app = carregarApp();
      semear(app);
      const vistas = folhas(app);
      assert.equal(typeof app.lpDe(prefixo), 'function', 'o prefixo tem dono registado');
      app.lpMenu(valor);
      assert.equal(vistas.length, 1, 'abriu a folha');
      assert.ok(vistas[0].labels.length > 0, 'com opções');
      assert.deepEqual(repetidos(vistas[0].labels), [], 'sem repetições: ' + vistas[0].labels.join(' | '));
      app.definirServicosDesligados([servico]);
      app.lpMenu(valor);
      assert.equal(vistas.length, 1, 'desligado, não abre nada');
    });
  }

  test('toque longo: o menu de um imóvel de investimento com contrato e hipoteca traz cada opção uma só vez, pela ordem de sempre', () => {
    const app = carregarApp();
    semear(app);
    const vistas = folhas(app);
    app.lpMenu('prop:p1');
    igual(vistas[0].labels, ['Editar imóvel', 'Novo contrato', 'Registar despesa', 'Pagamento de crédito', 'Amortização', 'Apagar imóvel']);
    assert.equal(vistas[0].titulo, 'T2 Lisboa');
    // os vizinhos desligados levam as suas opções e as dos imóveis ficam
    app.definirServicosDesligados(['contracts', 'transactions']);
    app.lpMenu('prop:p1');
    igual(vistas[1].labels, ['Editar imóvel', 'Amortização', 'Apagar imóvel'], 'os Créditos sem os Movimentos só acrescentam a amortização, que é deles');
  });

  test('toque longo: as pessoas registam o mesmo handler pelos dois serviços, e cada cartão segue o kind', () => {
    const app = carregarApp();
    semear(app);
    const vistas = folhas(app);
    app.lpMenu('per:owner:o1');
    assert.equal(vistas[0].titulo, 'Ana Dona');
    igual(vistas[0].labels, ['Editar ficha', 'Apagar']);
    app.lpMenu('per:tenant:t1');
    assert.equal(vistas[1].titulo, 'Rui Inquilino');
    assert.deepEqual(repetidos(vistas[1].labels), []);
    assert.equal(vistas[1].labels.filter((l) => l === 'Novo contrato').length, 1, 'os Contratos trazem «Novo contrato» uma vez');
    app.definirServicosDesligados(['owners']);
    app.lpMenu('per:owner:o1');
    assert.equal(vistas.length, 2, 'um proprietário não abre com os Proprietários desligados');
    app.lpMenu('per:tenant:t1');
    assert.equal(vistas.length, 3, 'e um inquilino ainda abre');
  });
});

describe('regressão: a camada da nuvem carrega inteira e embrulha as funções movidas', () => {
  test('carregarTudo carrega sem lançar, e cada função que a nuvem embrulha continua a ser uma função — a nova, não a de antes', () => {
    const app = carregarTudo();
    for (const n of ['vDashboard', 'vTransactions', 'lpMenu', 'render', 'go', 'save', 'pendingCard', 'goSet', 'hdrFiltToggle', 'vSettings',
      'syncContractRec', 'seed', 'delPerson', 'propBody', 'txLinhaExtra', 'txMesExtra', 'evoMoney', 'kpiModal', 'closePops', 'selOpen', 'selPick', 'setTheme', 'driveOpen']) {
      assert.equal(typeof app[n], 'function', n + ' é função');
    }
    /* cada wrapper guardou o original e reatribuiu o nome: prova de que a
       função existia quando a nuvem chegou (a ordem do index.html) */
    for (const [orig, atual] of [['_vDashboard', 'vDashboard'], ['_vDashboard_guia', 'vDashboard'], ['_vTransactions', 'vTransactions'], ['_vTransactions_sel', 'vTransactions'],
      ['_lpMenu', 'lpMenu'], ['_lpMenu_sel', 'lpMenu'], ['_pendingCard', 'pendingCard'], ['_render', 'render'], ['_render_sel', 'render'], ['_go', 'go'], ['_go_sel', 'go'],
      ['_goSet', 'goSet'], ['_save', 'save'], ['_hdrFiltToggle', 'hdrFiltToggle'], ['_hdrFiltToggle_sel', 'hdrFiltToggle'], ['_vSettings', 'vSettings'], ['_vSettingsNov', 'vSettings'],
      ['_syncContractRec', 'syncContractRec'], ['_seed_guia', 'seed'], ['_delPerson', 'delPerson'], ['_propBody', 'propBody'], ['_txLinhaExtra', 'txLinhaExtra'], ['_txMesExtra', 'txMesExtra'],
      ['_evoMoney', 'evoMoney'], ['_kpiModal', 'kpiModal'], ['_closePops', 'closePops'], ['_setTheme', 'setTheme'], ['_driveOpen', 'driveOpen']]) {
      assert.equal(typeof app[orig], 'function', orig + ' apanhou uma função');
      assert.notEqual(app[orig], app[atual], atual + ' foi reatribuída por cima');
    }
  });

  test('o registo resolve pelo nome na hora: dá a versão embrulhada pela nuvem, e não a que o serviço registou antes', () => {
    const app = carregarTudo();
    assert.equal(app.vistaDoSeparador('dashboard'), app.vDashboard);
    assert.notEqual(app.vistaDoSeparador('dashboard'), app._vDashboard, 'não é a original do painel-geral.js');
    assert.equal(app.vistaDoSeparador('transactions'), app.vTransactions);
    assert.notEqual(app.vistaDoSeparador('transactions'), app._vTransactions);
    assert.equal(app.vistaDoSeparador('settings'), app.vSettings);
    assert.notEqual(app.vistaDoSeparador('settings'), app._vSettings);
    assert.equal(app.depoisDoSeparador('transactions'), app.pintarListaTx);
    for (const t of SEPARADORES) assert.equal(typeof app.vistaDoSeparador(t), 'function', t);
    // e a vista embrulhada rende com dados, nuvem incluída
    const fixos = elementos(app);
    semear(app);
    for (const t of ['dashboard', 'transactions', 'contracts', 'properties']) { app.tab = t; app.render(); assert.ok(fixos.view.innerHTML.length > 0, t); }
  });

  test('cada nome que a nuvem embrulha por «var _x = x» está declarado num ficheiro que o index.html carrega antes', () => {
    const html = ler('web/index.html');
    const ordem = (html.match(/src="([^"]+\.js)"/g) || []).map((s) => s.slice(5, -1));
    const declarados = new Set();
    const falhas = [];
    let vistos = 0;
    for (const f of ordem) {
      const src = ler('web/' + f);
      if (f.startsWith('cloud/')) {
        const re = /^var (_[\w$]+) = ([A-Za-z_$][\w$]*);/gm;
        let m;
        while ((m = re.exec(src))) { vistos++; if (!declarados.has(m[2])) falhas.push(f + ' embrulha «' + m[2] + '» antes de ela existir'); }
      }
      src.split('\n').forEach((l) => { const d = /^(?:var|let|const|function|class|async function)\s+([A-Za-z_$][\w$]*)/.exec(l); if (d) declarados.add(d[1]); });
    }
    assert.deepEqual(falhas, []);
    assert.ok(vistos >= 20, 'contou ' + vistos + ' wrappers — a leitura deixou de os reconhecer?');
    assert.ok(ordem.indexOf('app/servicos.js') > ordem.indexOf('app/navegacao.js') && ordem.indexOf('app/servicos.js') < ordem.indexOf('app/vistas.js'), 'servicos.js entre navegacao.js e vistas.js');
    for (const s of SERVICOS_FICHEIROS) for (const f of s.ficheiros) assert.ok(ordem.indexOf(f) > ordem.indexOf('app/servicos.js'), f + ' depois de servicos.js');
  });
});

describe('regressão: o que o go, o botão de filtros e os «depois de pintar» faziam antes, fazem agora pelo registo', () => {
  test('go arruma o donut da visão geral e fecha o painel dos movimentos e os de análise, como o go de antes fazia à mão', () => {
    const app = carregarApp();
    elementos(app);
    semear(app);
    app.tab = 'dashboard'; app.donutCat = 'Impostos'; app.txFiltAberto = true; app.anaOpen = { dashboard: true };
    app.go('properties');
    assert.equal(app.tab, 'properties');
    assert.equal(app.donutCat, '', 'o donut fechou (aoMudarDeSeparador)');
    assert.equal(app.txFiltAberto, false, 'o painel dos movimentos fechou (fecharFiltrosDosServicos)');
    igual(app.anaOpen, {});
    assert.equal(app.setPage, '');
  });

  test('o botão de filtros do cabeçalho: nos movimentos alterna o painel próprio, na análise o da base', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    semear(app);
    app.tab = 'transactions'; app.txFiltAberto = false;
    app.hdrFiltToggle();
    assert.equal(app.txFiltAberto, true);
    assert.ok(!app.anaOpen.transactions, 'o painel da base não se mexeu');
    app.hdrFiltToggle();
    assert.equal(app.txFiltAberto, false);
    app.tab = 'dashboard';
    app.hdrFiltToggle();
    assert.equal(app.anaOpen.dashboard, true);
    assert.equal(app.txFiltAberto, false);
    app.hdrFiltToggle();
    assert.equal(app.anaOpen.dashboard, false);
    assert.ok(fixos.view.innerHTML.length > 0);
  });

  test('hdrFiltN, anaClear e limparFiltroAtual contam e limpam o que cada serviço regista, e o proprietário pela base', () => {
    const app = carregarApp();
    elementos(app);
    semear(app);
    app.tab = 'transactions';
    app.txSearch = 'renda'; app.txFilter = 'income'; app.txDe = ANO + '-01-01'; app.ownerFilter = 'o1'; app.txNoPayer = false;
    assert.equal(app.hdrFiltN(), 5, 'pesquisa, tipo, datas, proprietário e «só com pessoa»');
    app.limparFiltroAtual();
    assert.equal(app.txSearch, ''); assert.equal(app.txFilter, ''); assert.equal(app.txDe, ''); assert.equal(app.ownerFilter, ''); assert.equal(app.txNoPayer, true);
    assert.equal(app.hdrFiltN(), 0);
    app.tab = 'dashboard'; app.ownerFilter = 'o1'; app.dashProp = 'p1';
    assert.equal(app.hdrFiltN(), 2);
    app.anaClear();
    assert.equal(app.dashProp, ''); assert.equal(app.ownerFilter, ''); assert.equal(app.hdrFiltN(), 0);
    app.tab = 'projections'; app.ownerFilter = 'o1'; app.projProp = 'p1';
    assert.equal(app.hdrFiltN(), 2);
    app.limparFiltroAtual();
    assert.equal(app.projProp, ''); assert.equal(app.hdrFiltN(), 0);
    app.tab = 'reports'; app.ownerFilter = 'o1'; app.repProp = 'p1';
    assert.equal(app.hdrFiltN(), 2);
    app.anaClear();
    assert.equal(app.repProp, ''); assert.equal(app.hdrFiltN(), 0);
    app.tab = 'fisco'; app.ownerFilter = 'o1'; app.fiscoAno = '2020';
    assert.equal(app.hdrFiltN(), 1, 'na Declaração o ano não é filtro');
    app.anaClear();
    assert.equal(app.fiscoAno, ''); assert.equal(app.ownerFilter, '');
    app.tab = 'properties';
    assert.equal(app.hdrFiltN(), 0, 'as listas contam pelo lf');
    app.tab = 'calendar';
    assert.equal(app.hdrFiltN(), 0, 'sem análise registada, zero');
  });

  test('o botão de filtros aparece nas listas, na análise e nos movimentos, e some no calendário, nos colaboradores e nas definições', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    semear(app);
    const esperado = { dashboard: true, calendar: false, properties: true, contracts: true, visits: true, tenants: true, owners: true, colaboradores: false,
      transactions: true, recurring: true, credits: true, projections: true, reports: true, fisco: true, settings: false };
    for (const t of SEPARADORES) {
      app.tab = t;
      app.pintarBotaoFiltros();
      assert.equal(fixos.hdrFilt.style.display !== 'none', esperado[t], t);
    }
    // um serviço desligado leva o botão consigo
    app.definirServicosDesligados(['transactions']);
    app.tab = 'transactions';
    app.pintarBotaoFiltros();
    assert.equal(fixos.hdrFilt.style.display, 'none');
  });

  test('a visão geral ganha a criação rápida uma vez só, depois dos cartões, e o fabpad com ela; sem os Movimentos fica só o personalizar', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    semear(app);
    app.tab = 'dashboard';
    app.render();
    const html = fixos.view.innerHTML;
    assert.equal((html.match(/class="fab"/g) || []).length, 1, 'um FAB');
    assert.equal((html.match(/fabpad/g) || []).length, 1, 'um fabpad');
    assert.match(html, /newTxPick\(\)/);
    assert.match(html, /id="dashPersonalizar"/);
    assert.ok(html.indexOf('Personalizar painel') > html.indexOf('donutCard'), 'entra depois dos cartões');
    assert.match(html, /id="pendCard"/, 'o cartão dos por confirmar (dos Planeados) está');
    app.definirServicosDesligados(['transactions']);
    app.render();
    const sem = fixos.view.innerHTML;
    assert.doesNotMatch(sem, /class="fab"|newTxPick\(/);
    assert.match(sem, /Personalizar painel/);
  });

  test('o crachá dos Planeados na gaveta e o do Calendário na barra de baixo vêm do registo, com o número e a cor de antes, e pulsam quando o número muda', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    semear(app);
    igual(app.crachaDe('recurring'), { n: 1, aviso: true });
    igual(app.crachaDe('calendar'), { n: 1, so: 'barra' });   // só na barra de baixo, como antes da transição
    app.buildNav();
    const rec = ligacao(fixos.nav.innerHTML, "go('recurring')");
    // a cor de aviso é a classe utilitária que tomou o lugar do background em linha
    assert.match(rec, /<span class="cnt u-bg-v-warn">1<\/span>/, 'na gaveta, na cor de aviso porque nenhum passou do prazo');
    const cal = ligacao(fixos.tabbar.innerHTML, "goBarra('calendar')");
    assert.match(cal, /<span class="cnt[^"]*"[^>]*>1<\/span>/, 'na barra de baixo, o mesmo número');
    assert.doesNotMatch(cal, /--warn/, 'sem cor de aviso');
    // mais um pendente: o crachá da gaveta pulsa
    app.db.recurring.push(app.normRec({ id: 'r2', name: 'Água', every: 'month', next: app.pzHoje(), tx: { kind: 'expense', label: 'Água', amount: 10, propertyId: 'p1' } }));
    app.buildNav();
    assert.match(ligacao(fixos.nav.innerHTML, "go('recurring')"), /class="cnt novo u-bg-v-warn"/);
    // sem os Planeados, some dos dois sítios
    app.definirServicosDesligados(['recurring']);
    app.buildNav();
    assert.doesNotMatch(fixos.nav.innerHTML, /class="cnt/);
    assert.doesNotMatch(fixos.tabbar.innerHTML, /class="cnt/);
    assert.doesNotMatch(fixos.nav.innerHTML, /go\('recurring'\)/, 'e o separador saiu do menu');
  });

  test('os prazos do CC e do certificado energético apontam para a ficha certa, e a lista não rebenta com tudo desligado', () => {
    const app = carregarApp();
    semear(app);
    const hoje = app.pzHoje(), breve = app.pzAddDias(hoje, 5);
    app.db.owners[0].ccValid = breve;
    app.db.properties[0].energyValid = breve;
    const de = (tipo) => JSON.parse(JSON.stringify(app.prazosDe(hoje).filter((p) => p.tipo === tipo)));
    assert.match(de('cc')[0].abrir, /personView\('owner','o1'\)/);
    assert.match(de('energia')[0].abrir, /propView\('p1'\)/);
    app.definirServicosDesligados(SERVICOS_FICHEIROS.map((s) => s.id));
    assert.doesNotThrow(() => app.prazosDe(hoje));
    assert.doesNotThrow(() => app.prazosCard());
  });

  test('os auxiliares que vieram dos serviços vivem na base, e o addDays já não recua um dia na mudança de hora', () => {
    const app = carregarBase();
    for (const n of ['addDays', 'dayInMonth', 'deacc', 'nomeDoTipo', 'mesPt']) assert.equal(typeof app[n], n === 'mesPt' ? 'undefined' : 'function', n);
    assert.equal(app.addDays('2026-03-28', 1), '2026-03-29');
    assert.equal(app.addDays('2026-03-29', 1), '2026-03-30', 'o dia da mudança para a hora de verão');
    assert.equal(app.addDays('2026-10-25', 1), '2026-10-26', 'e o da volta');
    assert.equal(app.addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(app.dayInMonth(2026, 1, 31), '2026-02-28');
    assert.equal(app.deacc('Água Fria'), 'agua fria');
    assert.equal(app.nomeDoTipo('debt'), 'Dívidas');
    assert.equal(app.nomeDoTipo('xyz'), 'xyz');
  });

  test('as Definições rendem cada subpágina com todos os serviços ligados e com todos desligados', () => {
    const app = carregarApp();
    semear(app);
    for (const off of [[], SERVICOS_FICHEIROS.map((s) => s.id)]) {
      app.definirServicosDesligados(off);
      for (const p of ['', 'defaults', 'cats', 'filtros', 'tags', 'groups', 'irs', 'dados']) {
        app.setPage = p;
        const html = app.vSettings();
        assert.ok(typeof html === 'string' && html.length > 0, 'subpágina «' + p + '» com ' + off.length + ' desligados');
      }
    }
    app.definirServicosDesligados([]);
    app.setPage = 'defaults';
    assert.match(app.vSettings(), /capTargetSet\(/, 'com a Avaliação ligada, o yield exigido está lá');
  });
});

/* O que a passagem a serviços chegou a partir no cliente, e ficou preso: cada
   teste diz a regra; o número da revisão que o reproduziu vai por cima. */
describe('regressões da passagem a serviços', () => {
  // revisão dos serviços, A.1-1
  test('a gaveta não pinta crachá no Calendário — só a barra de baixo o tem', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    semear(app);
    app.buildNav();
    const cal = ligacao(fixos.nav.innerHTML, "go('calendar')");
    assert.ok(cal, 'o Calendário está na gaveta');
    assert.doesNotMatch(cal, /class="cnt/, 'sem crachá na gaveta: ' + cal);
    assert.match(ligacao(fixos.nav.innerHTML, "go('recurring')"), /class="cnt/, 'controlo: o dos Planeados fica');
    assert.match(ligacao(fixos.tabbar.innerHTML, "goBarra('calendar')"), /class="cnt/, 'controlo: o da barra de baixo fica');
  });

  // revisão dos serviços, A.1-2
  test('o crachá do Calendário na barra de baixo pulsa quando o número muda', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    semear(app);
    app.buildNav();
    assert.doesNotMatch(ligacao(fixos.tabbar.innerHTML, "goBarra('calendar')"), /cnt novo/, 'a primeira vez não pulsa');
    app.db.recurring.push(app.normRec({ id: 'r2', name: 'Água', every: 'month', next: app.pzHoje(), tx: { kind: 'expense', label: 'Água', amount: 10, propertyId: 'p1' } }));
    app.buildNav();
    assert.match(ligacao(fixos.tabbar.innerHTML, "goBarra('calendar')"), /class="cnt novo"/, 'de 1 para 2, pulsa — como antes da transição');
  });

  // revisão dos serviços, A.1-3
  test('o menu de um contrato traz «Registar renda» logo a seguir a «Editar contrato», antes do PDF', () => {
    const app = carregarApp();
    semear(app);
    const vistas = folhas(app);
    app.lpMenu('ct:c1');
    igual(vistas[0].labels, ['Editar contrato', 'Registar renda', 'Gerar contrato em PDF', 'Terminar contrato', 'Apagar contrato']);
  });

  // revisão dos serviços, A.1-4
  test('os prazos do CC e do certificado energético não abrem a ficha de um serviço desligado', () => {
    const app = carregarApp();
    semear(app);
    const hoje = app.pzHoje(), breve = app.pzAddDias(hoje, 5);
    app.db.owners[0].ccValid = breve;
    app.db.properties[0].energyValid = breve;
    const de = (tipo) => JSON.parse(JSON.stringify(app.prazosDe(hoje).filter((p) => p.tipo === tipo)));
    app.definirServicosDesligados(['owners']);
    assert.equal(de('cc')[0].abrir, '', 'sem os Proprietários o prazo diz-se, mas não abre a ficha');
    app.definirServicosDesligados(['properties']);
    assert.equal(de('energia')[0].abrir, '', 'sem os Imóveis o prazo diz-se, mas não abre a ficha');
    // e o cartão não apresenta a linha como tocável (com os dois serviços desligados)
    app.definirServicosDesligados(['owners', 'properties']);
    assert.doesNotMatch(app.prazosCard(), /propModal\(|personModal\(/);
  });

  // revisão dos serviços, A.1-5
  test('os «Primeiros passos» não oferecem «Fazer agora» para um serviço desligado', () => {
    const app = carregarTudo();
    semear(app);
    app.CW.user = { id: 'o1', name: 'Ana Dona', email: 'ana@exemplo.pt', token: 't' };
    app.CW._pulled = 1; app.CW._esperaFim = 1;
    const acts = () => JSON.parse(JSON.stringify(app.passos().map((p) => p.act)));
    // sem os Imóveis: o servidor não manda casas, e o passo dos imóveis está «por fazer»
    app.db.properties = []; app.db.contracts = [];
    app.definirServicosDesligados(['properties']);
    assert.ok(!acts().includes('propModal()'), 'sem os Imóveis não se abre a ficha de imóvel: ' + acts().join(' | '));
    assert.ok(!acts().includes('ctModal()'), 'nem a do contrato, que cai com os Imóveis');
    assert.doesNotMatch(app.cartaoPassos(), /propModal\(\)|ctModal\(\)/);
    // com os Imóveis mas sem os Contratos: o passo dos contratos não oferece o formulário
    semear(app); app.db.contracts = [];
    app.definirServicosDesligados(['contracts']);
    assert.ok(!acts().includes('ctModal()'), acts().join(' | '));
    // e sem os Movimentos, «Confirma os primeiros movimentos» não leva a um separador que não abre
    app.db.transactions = [];
    app.definirServicosDesligados(['transactions']);
    assert.ok(!acts().includes("go('transactions')"), acts().join(' | '));
  });

  // revisão dos serviços, A.1-6
  test('as Definições não escrevem o yield da Avaliação com o serviço desligado', () => {
    const app = carregarApp();
    semear(app);
    app.setPage = 'defaults';
    app.definirServicosDesligados(['reports']);
    assert.doesNotMatch(app.vSettings(), /capTargetSet\(/);
  });

  // revisão dos serviços, A.1-7
  test('o design.md não diz que o addDays devolve a data com toISOString', () => {
    const design = ler('docs/design.md'), aux = ler('web/app/formato.js');
    const addDays = (aux.match(/const addDays=[^\n]*/) || [''])[0];
    assert.ok(addDays && !/toISOString/.test(addDays), 'controlo: o addDays da base constrói a data em hora local');
    assert.doesNotMatch(design, /addDays \(auxiliares\.js:addDays\) constrói a data em hora local e\s+devolve-a com toISOString/);
  });

  // revisão dos serviços, A.1-8
  test('lista-colaboradores.js usa um só fim de linha', () => {
    const s = readFileSync(new URL('web/app/lista-colaboradores.js', RAIZ), 'latin1');
    const crlf = (s.match(/\r\n/g) || []).length, so = (s.match(/(^|[^\r])\n/g) || []).length;
    assert.ok(!(crlf && so), 'CRLF ' + crlf + ' e LF ' + so + ' misturados');
  });

  // revisão dos serviços, A.1-9
  test('o arranque abre no primeiro separador ligado quando o inicial está desligado no aparelho', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    app.definirServicosDesligados(['dashboard']);
    vm.runInContext(ler('web/app/arranque.js'), app.__ctx, { filename: 'app/arranque.js' });
    assert.equal(app.tab, app.primeiroSeparadorLigado(), 'o primeiro render não fica na Visão geral desligada');
    assert.doesNotMatch(fixos.view.innerHTML, /está desligado nesta conta/);
  });
});
