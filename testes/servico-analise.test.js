// Os cinco serviços de análise — visão geral, calendário, projeções, avaliação
// e declaração — são autónomos: cada um carrega e rende só com a base, com a
// db vazia e com dados (autonomia); e com os serviços que usam desligados nesta
// conta (movimentos, contratos, imóveis, proprietários, planeados, visitas,
// inquilinos) a vista rende na mesma, sem os atalhos nem os cartões deles, e
// onde havia um botão fica a frase que diz o nome do serviço e quem o liga.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarServico, limpar, igual, elementos } from './arnes.js';

const ANO = new Date().getFullYear();
const VISTAS = { dashboard: 'vDashboard', calendar: 'vCalendar', projections: 'vProjections', reports: 'vReports', fisco: 'vFisco' };
const ANALISE = ['dashboard', 'projections', 'reports', 'fisco'];
/* os serviços que os cinco «usam» (o catálogo), e que aqui se desligam */
const OUTROS = ['transactions', 'contracts', 'properties', 'owners', 'recurring', 'visits', 'tenants'];

/* Limpa o que é passageiro em cada serviço, para cada caso partir do mesmo sítio. */
function zerar(app) {
  limpar(app);
  app.repProp = ''; app.projProp = ''; app.fiscoAno = String(ANO);
  app.calMes = ''; app.calDiaSel = ''; app.donutCat = '';
  app.definirServicosDesligados(app.servicosDesligados());
}

/* Semeia a db com a forma que as vistas leem: um proprietário, um imóvel sem os
   dados matriciais, um inquilino sem NIF, dois contratos (um por indicar se foi
   declarado, um não declarado), rendas (uma sem contrato), uma despesa do imóvel
   e uma sem imóvel, um planeado vencido hoje e uma visita hoje.
   Recebe: app — o contexto; opcoes.semContratos — sem contratos (e sem rendas
   ligadas a eles), para o vazio das projeções. */
function semear(app, opcoes = {}) {
  zerar(app);
  const hoje = app.pzHoje();
  app.db.owners.push(app.normPerson({ id: 'O1', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 'T1', name: 'Tiago' }));
  app.db.properties.push(app.normProp({ id: 'P1', name: 'T2 Arroios', value: 200000, purchase: 150000, ownerIds: ['O1'] }));
  if (!opcoes.semContratos) {
    app.db.contracts.push(
      app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'P1', tenantIds: ['T1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }),
      app.normContract({ id: 'C2', name: 'Fora', propertyId: 'P1', tenantIds: ['T1'], rent: 300, start: (ANO - 1) + '-06-01', active: true, fisco: { estado: 'naoDeclarado' } }),
    );
  }
  const tx = (x) => app.db.transactions.push(app.normTx(x));
  for (let i = 1; i <= 3; i++) tx({ kind: 'income', category: 'Rendas', amount: 800, propertyId: 'P1', contractId: opcoes.semContratos ? null : 'C1', date: `${ANO}-0${i}-05` });
  tx({ kind: 'income', category: 'Rendas', amount: 800, propertyId: 'P1', date: `${ANO}-04-05` });   // sem contrato
  if (!opcoes.semContratos) tx({ kind: 'income', category: 'Rendas', amount: 300, propertyId: 'P1', contractId: 'C2', date: `${ANO}-02-05` });
  tx({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, propertyId: 'P1', date: `${ANO}-04-10` });
  tx({ kind: 'expense', category: 'Outros', label: 'Solta', amount: 50, date: `${ANO}-03-10` });   // sem imóvel
  app.db.recurring.push(app.normRec({ id: 'R1', name: 'Renda planeada', next: hoje, every: 'month', tx: { kind: 'income', amount: 800, propertyId: 'P1' } }));
  app.db.visits.push(app.normVisit({ id: 'V1', nomes: 'Bruno', propertyId: 'P1', date: hoje, start: '15:00' }));
  return app.db;
}

const desligar = (app) => app.definirServicosDesligados(OUTROS);
const ligarTudo = (app) => app.definirServicosDesligados([]);
const SUPORTE = /O suporte pode ligá-lo quando quiseres\./;

describe('autonomia: cada serviço de análise carrega e rende só com a base', () => {
  for (const id of Object.keys(VISTAS)) {
    test('autonomia: ' + id + ' regista a vista e rende com a db vazia e com dados, sem os outros serviços', () => {
      const app = carregarServico([id]);
      assert.ok(app.servicoLigado(id));
      for (const outro of OUTROS) assert.ok(!app.servicoLigado(outro), outro + ' está desligado');
      const vista = app.vistaDoSeparador(id);
      assert.equal(typeof vista, 'function', 'a vista está registada');
      assert.equal(vista, app[VISTAS[id]], 'e é a função do ficheiro do serviço');
      zerar(app);
      const vazio = vista();
      assert.equal(typeof vazio, 'string');
      assert.ok(vazio.length > 0, 'a db vazia rende');
      semear(app);
      const cheio = vista();
      assert.ok(cheio.length > 0, 'com dados rende');
      /* o calendário sozinho mostra o mesmo mês com e sem dados: as visitas e
         os planeados são de outros serviços, e aqui não estão */
      if (id !== 'calendar') assert.notEqual(cheio, vazio, 'e é outra página');
      // o render da base pinta-a no #view, e o «depois» do serviço corre por cima
      const fixos = elementos(app);
      app.tab = id;
      app.render();
      assert.ok(fixos.view.innerHTML.length > 0);
      assert.doesNotMatch(fixos.view.innerHTML, /primeiroSeparadorLigado/, 'não é o ecrã de serviço desligado');
    });
  }

  for (const id of ANALISE) {
    test('autonomia: ' + id + ' regista a análise com n e limpar que resolvem para funções', () => {
      const app = carregarServico([id]);
      const a = app.analiseDe(id);
      assert.ok(a, 'há análise registada');
      assert.equal(typeof a.n, 'function');
      assert.equal(typeof a.limpar, 'function');
      assert.equal(typeof a.n(), 'number');
      a.limpar();
      assert.equal(a.n(), 0);
    });
  }

  test('autonomia: o calendário regista o crachá, e sem os Planeados fica a zero com planeados na db', () => {
    const app = carregarServico(['calendar']);
    igual(app.crachaDe('calendar'), { n: 0, so: 'barra' });
    semear(app);
    igual(app.crachaDe('calendar'), { n: 0, so: 'barra' });
    assert.equal(app.calPlaneados(app.pzHoje(), app.pzHoje()).length, 0, 'sem o passo dos Planeados não há ocorrências');
    // o atalho de marcar visita passou a chamar o calMarcarVisita(iso), que faz o visitModal(null,{date:iso})
    assert.doesNotMatch(app.vCalendar(), /calMarcarVisita\(|visitModal\(|go\('recurring'\)/);
  });

  test('autonomia: a avaliação sem gastos no imóvel não precisa da visão geral para a frase das despesas sem imóvel', () => {
    const app = carregarServico(['reports']);
    semear(app);
    app.db.transactions = app.db.transactions.filter((t) => !(t.kind === 'expense' && t.propertyId));
    const html = app.vReports();
    assert.match(html, /Não há gastos atribuídos a este imóvel/);
    assert.doesNotMatch(html, /despesas sem imóvel atribuído/, 'a frase é da visão geral, que não está cá');
    assert.doesNotMatch(html, /Contratos ativos/, 'a tabela é dos contratos, que não estão cá');
  });

  test('autonomia: a declaração lista as obrigações sem toque quando os serviços das fichas não estão cá', () => {
    const app = carregarServico(['fisco']);
    semear(app);
    const r = app.resumoFiscal(ANO, '');
    assert.ok(r.avisos.length >= 3, 'há avisos (contrato por indicar, inquilino sem NIF, imóvel sem dados, renda sem contrato)');
    for (const a of r.avisos) assert.equal(a.abrir, '', a.texto + ' fica sem toque');
    const html = app.vFisco();
    assert.match(html, /Anexo F · quadro 4\.1/);
    assert.doesNotMatch(html, /ctView\(|personView\(|propView\(|txView\(/);
  });
});

describe('desligado: com os serviços que usam desligados, cada vista rende sem os atalhos para eles', () => {
  test('desligado: a visão geral sem os movimentos, os planeados e os imóveis', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    semear(app);
    let html = app.vDashboard();
    // o atalho é uma função com nome (o go+setTimeout não se escreve numa ação declarada)
    assert.match(html, /data-click="dashVerSemImovel\(\)"/, 'controlo: as despesas sem imóvel levam aos movimentos');
    assert.match(html, /pendToggle\(\)/, 'controlo: o cartão dos por confirmar');
    fixos.view.innerHTML = ''; app.dashDepois();
    assert.match(fixos.view.innerHTML, /newTxPick\(\)/, 'controlo: o FAB do novo movimento');
    desligar(app);
    html = app.vDashboard();
    assert.doesNotMatch(html, /dashVerSemImovel\(|go\('transactions'\)|newTxPick\(|pendToggle\(|confirmRec\(|propModal\(|go\('properties'\)/);
    assert.match(html, /Cashflow/, 'os indicadores ficam');
    fixos.view.innerHTML = ''; app.dashDepois();
    assert.doesNotMatch(fixos.view.innerHTML, /newTxPick\(|class="fab"/);
    assert.match(fixos.view.innerHTML, /Personalizar painel/, 'a personalização é da base e fica');
    // o ecrã vazio sem os Imóveis: sem o botão, e a frase diz quem os liga
    zerar(app); ligarTudo(app);
    assert.match(app.vDashboard(), /propModal\(\)/, 'controlo: com tudo ligado há botão');
    desligar(app);
    const vazio = app.vDashboard();
    assert.doesNotMatch(vazio, /propModal\(|go\('properties'\)/);
    assert.match(vazio, /O serviço Imóveis está desligado nesta conta\./);
    assert.match(vazio, SUPORTE);
  });

  test('desligado: o calendário sem as visitas nem os planeados', () => {
    const app = carregarApp();
    semear(app);
    let html = app.vCalendar();
    assert.match(html, /visView\('V1'\)/, 'controlo: a visita de hoje abre a ficha');
    assert.match(html, /calMarcarVisita\('/, 'controlo: marcar visita neste dia');
    assert.match(html, /go\('recurring'\)/, 'controlo: o planeado de hoje leva aos Planeados');
    assert.match(html, /pt vis/); assert.match(html, /pt pla/);
    desligar(app);
    html = app.vCalendar();
    assert.doesNotMatch(html, /visView\(|calMarcarVisita\(|visitModal\(|go\('recurring'\)|Marcar visita/);
    assert.doesNotMatch(html, /pt vis|pt pla/, 'nem os pontos nem a legenda deles');
    assert.match(html, /Nada marcado para este dia/);
    assert.match(html, /toca num dia para veres o que tem/);
    assert.equal(app.calPlaneados(app.pzHoje(), app.pzHoje()).length, 0);
    igual(app.crachaDe('calendar'), { n: 0, so: 'barra' });
  });

  test('desligado: as projeções sem os contratos nem os imóveis', () => {
    const app = carregarApp();
    semear(app, { semContratos: true });
    assert.match(app.vProjections(), /go\('contracts'\)/, 'controlo: sem contrato ativo aponta para os contratos');
    desligar(app);
    let html = app.vProjections();
    assert.doesNotMatch(html, /go\('contracts'\)|go\('properties'\)/);
    assert.match(html, /Nenhum contrato ativo/);
    assert.match(html, /O serviço Contratos está desligado nesta conta\./);
    assert.match(html, SUPORTE);
    // com contratos na db e os serviços desligados, a tabela rende na mesma
    semear(app); desligar(app);
    html = app.vProjections();
    assert.match(html, /Detalhe ano a ano/);
    assert.doesNotMatch(html, /go\('contracts'\)|go\('properties'\)/);
    // e o vazio sem imóveis
    zerar(app); ligarTudo(app);
    assert.match(app.vProjections(), /go\('properties'\)/, 'controlo');
    desligar(app);
    const vazio = app.vProjections();
    assert.doesNotMatch(vazio, /go\('properties'\)|go\('contracts'\)/);
    assert.match(vazio, /O serviço Imóveis está desligado nesta conta\./);
  });

  test('desligado: a avaliação sem os contratos, os imóveis e a visão geral', () => {
    const app = carregarApp();
    semear(app);
    assert.match(app.vReports(), /Contratos ativos/, 'controlo: a tabela dos contratos');
    desligar(app);
    let html = app.vReports();
    assert.doesNotMatch(html, /Contratos ativos|go\('properties'\)/);
    assert.match(html, /Conta de exploração/, 'os cartões do imóvel ficam');
    // a frase das despesas sem imóvel é da visão geral: some com ela desligada
    ligarTudo(app);
    app.db.transactions = app.db.transactions.filter((t) => !(t.kind === 'expense' && t.propertyId));
    assert.match(app.vReports(), /despesas sem imóvel atribuído/, 'controlo');
    app.definirServicosDesligados(['dashboard']);
    html = app.vReports();
    assert.doesNotMatch(html, /despesas sem imóvel atribuído/);
    assert.match(html, /Não há gastos atribuídos a este imóvel/);
    // o vazio sem imóveis
    zerar(app); ligarTudo(app);
    assert.match(app.vReports(), /go\('properties'\)/, 'controlo');
    desligar(app);
    const vazio = app.vReports();
    assert.doesNotMatch(vazio, /go\('properties'\)/);
    assert.match(vazio, /O serviço Imóveis está desligado nesta conta\./);
    assert.match(vazio, SUPORTE);
  });

  test('desligado: a declaração sem os contratos, os inquilinos, os imóveis nem os movimentos', () => {
    const app = carregarApp();
    semear(app);
    let html = app.vFisco();
    for (const s of ['ctView(', 'personView(', 'propView(', 'txView(']) assert.ok(html.includes(s), 'controlo: ' + s);
    desligar(app);
    html = app.vFisco();
    assert.doesNotMatch(html, /ctView\(|personView\(|propView\(|txView\(|go\('contracts'\)|go\('transactions'\)|go\('properties'\)/);
    assert.match(html, /Anexo F · quadro 4\.1/, 'o quadro fica');
    assert.match(html, /Obrigações de /, 'as obrigações ficam, sem toque');
    assert.match(html, /Fora da declaração/);
    assert.match(html, /Rendas sem contrato/);
    assert.match(html, /O serviço Contratos está desligado nesta conta\./);
    assert.match(html, /O serviço Movimentos está desligado nesta conta\./);
    assert.match(html, SUPORTE);
    assert.match(html, /go\('settings'\)|hdrFiltToggle\(\)|fiscoCsv\(\)/, 'o que é da base fica');
    const r = app.resumoFiscal(ANO, '');
    for (const a of r.avisos) if (!/Definições/.test(a.texto)) assert.equal(a.abrir, '', a.texto + ' fica sem toque');
    // o vazio sem imóveis
    zerar(app); ligarTudo(app);
    assert.match(app.vFisco(), /go\('properties'\)/, 'controlo');
    desligar(app);
    const vazio = app.vFisco();
    assert.doesNotMatch(vazio, /go\('properties'\)/);
    assert.match(vazio, /O serviço Imóveis está desligado nesta conta\./);
  });

  test('desligado: ligar tudo outra vez repõe os atalhos — o registo não muda, só o interruptor', () => {
    const app = carregarApp();
    semear(app);
    desligar(app);
    assert.doesNotMatch(app.vFisco(), /ctView\(/);
    ligarTudo(app);
    assert.match(app.vFisco(), /ctView\('C1'\)/);
    assert.match(app.vCalendar(), /visView\('V1'\)/);
    assert.match(app.vDashboard(), /pendToggle\(\)/);
  });
});
