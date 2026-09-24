// Os prazos do ciclo de vida: as janelas legais do arrendamento medem-se em
// dias de pré-aviso, e um cálculo errado aqui custa dinheiro a alguém. Tudo
// com data de referência fingida — um teste de calendário que depende do
// dia em que corre não é um teste.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));

// uma base limpa com um contrato ativo parametrizável
function monta(extra) {
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana', ccValid: '' })];
  app.db.owners = [];
  app.db.contracts = [app.normContract(Object.assign({
    id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'],
    rent: 800, start: '2025-03-01', end: '', increase: null, active: true,
  }, extra))];
  app.db.transactions = [];
  app.db.settings.prazosVistos = {};
}

// uma renda recebida do contrato C1 (ou sem contrato, com contractId: null)
function renda(id, date, extra) {
  app.db.transactions.push(app.normTx(Object.assign({
    id, kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 800, date,
    propertyId: 'P1', contractId: 'C1',
  }, extra || {})));
}

const AT = ['modelo2', 'cessacao', 'recibos', 'irs', 'fev15'];
const daAT = (l) => l.filter((p) => AT.includes(p.tipo));

describe('a janela de oposição e o fim do contrato', () => {
  test('a 130 dias do fim, a oposição avisa e diz a data-limite dos 120 dias', () => {
    monta({ end: '2027-01-10' });                    // hoje fingido: 2026-09-02
    const l = app.prazosDe('2026-09-02');
    const op = l.find((p) => p.tipo === 'oposicao');
    assert.ok(op, 'a oposição está na janela (150 dias de antecedência)');
    assert.equal(op.alvo, '2026-09-12', 'o alvo é end − 120 dias');
    assert.equal(op.dias, 10);
    assert.equal(op.urg, 'breve');
    assert.match(op.sub, /até 12\/09\/2026/, 'a data que se lê é a forma portuguesa');
    assert.ok(!l.find((p) => p.tipo === 'fim'), 'o fim só entra a 60 dias');
  });

  test('passada a data de oposição ela desaparece; o fim aguenta depois de passar', () => {
    monta({ end: '2026-10-01' });
    const l = app.prazosDe('2026-09-20');            // oposição foi a 03-06
    assert.ok(!l.find((p) => p.tipo === 'oposicao'), 'oposição fora de prazo não chateia');
    const fim = l.find((p) => p.tipo === 'fim');
    assert.equal(fim.dias, 11);
    const l2 = app.prazosDe('2026-10-05');
    assert.equal(l2.find((p) => p.tipo === 'fim').urg, 'passado', 'o fim passado continua acionável');
  });

  test('contrato inativo ou sem fim não gera nada', () => {
    monta({ end: '2026-10-01', active: false });
    assert.equal(app.prazosDe('2026-09-20').length, 0);
    monta({ end: '' });
    // o Modelo 2 de um contrato por indicar é outro assunto (ver «os prazos da AT»)
    assert.equal(app.prazosDe('2026-09-20').filter((p) => p.tipo !== 'cc' && !AT.includes(p.tipo)).length, 0);
  });
});

describe('o aumento anual', () => {
  test('avisa antes do aniversário, com a data-limite dos 30 dias', () => {
    monta({ increase: 2.5 });                        // start 2025-03-01
    const l = app.prazosDe('2027-01-20');            // aniversário: 2027-03-01
    const a = l.find((p) => p.tipo === 'aumento');
    assert.ok(a, 'a 40 dias do limite (45 de antecedência) está na janela');
    assert.equal(a.alvo, '2027-01-30', 'o alvo é o aniversário − 30 dias');
    assert.match(a.sub, /01\/03\/2027/);
    assert.match(a.sub, /\+2\.5%/);
  });

  test('sem increase configurado não há aviso de aumento', () => {
    monta({});
    assert.ok(!app.prazosDe('2027-01-20').find((p) => p.tipo === 'aumento'));
  });
});

describe('documentos e taxa fixa', () => {
  test('o CC de um inquilino ativo avisa a 60 dias; o de um sem contrato não', () => {
    monta({});
    app.db.tenants[0].ccValid = '2026-11-01';
    app.db.tenants.push(app.normPerson({ id: 'T2', name: 'Bruno', ccValid: '2026-11-01' }));
    const l = app.prazosDe('2026-09-10');
    const ccs = l.filter((p) => p.tipo === 'cc');
    assert.equal(ccs.length, 1, 'só a Ana, que tem contrato ativo');
    assert.match(ccs[0].titulo, /Ana/);
  });

  test('o certificado energético e o fim da taxa fixa entram nas janelas certas', () => {
    monta({});
    app.db.properties[0].energyValid = '2026-11-15';
    app.db.properties[0].loans = [app.normLoan({
      id: 'L1', name: 'Aquisição', type: 'mista', rate: 3.0, fixedYears: 2, outstanding: 90000,
      start: '2024-12-01', euribor: 2.1, spread: 1.0,
    })];
    /* a fase da taxa conta pelas prestações registadas, o relógio da simulação
       (credito.js:fimDaFaseFixa): com as 21 de dezembro de 2024 a agosto de 2026
       em dia, a primeira à taxa variável é a 25.ª — a de dezembro de 2026 */
    for (let k = 0; k < 21; k++) {
      const y = 2024 + Math.floor((11 + k) / 12), m = ((11 + k) % 12) + 1;
      app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'L1', propertyId: 'P1', amount: 400, principal: 200, date: y + '-' + String(m).padStart(2, '0') + '-01' }));
    }
    const l = app.prazosDe('2026-09-10');
    const en = l.find((p) => p.tipo === 'energia');
    assert.ok(en && en.dias === 66, 'energia na janela dos 90 dias');
    assert.equal(en.abrir, "propView('P1')", 'e abre a ficha do imóvel');
    const tx = l.find((p) => p.tipo === 'taxa');
    assert.equal(tx.alvo, '2026-12-01', 'fim da fase fixa: fixedYears × 12 − registadas prestações depois da próxima por pagar');
    assert.match(tx.sub, /3%.*3,1%/s);
    assert.equal(tx.abrir, "mortView('P1','L1')", 'e abre a ficha da hipoteca');
  });
});

/* Os prazos da AT nascem do estado fiscal do contrato. «Não declarado» é uma
   escolha do senhorio: não nasce prazo nenhum dela. O `hoje` fingido manda
   em tudo, incluindo no «ano anterior» e nos «últimos três meses». */
describe('os prazos da AT', () => {
  test('o Modelo 2 avisa um contrato por indicar até ao fim do mês seguinte ao início, e continua depois', () => {
    monta({});                                       // start 2025-03-01, estado ''
    const m2 = app.prazosDe('2025-04-01').find((p) => p.tipo === 'modelo2');
    assert.ok(m2, 'na janela dos 45 dias');
    assert.equal(m2.alvo, '2025-04-30', 'o fim do mês seguinte ao início');
    assert.equal(m2.dias, 29);
    assert.match(m2.titulo, /Modelo 2.*Ana · T2/);
    assert.match(m2.sub, /até 30\/04\/2025/i, 'diz a data-limite');
    assert.match(m2.sub, /marca-o na ficha e este aviso desaparece/, 'e como o calar, sem julgar');
    assert.equal(m2.abrir, "ctView('C1')", 'tocar lê a ficha do contrato');
    assert.ok(m2.chave.includes('2025-04-30'), 'a chave leva a data-alvo');
    assert.ok(!app.prazosDe('2025-02-01').find((p) => p.tipo === 'modelo2'), 'a 88 dias ainda não');
    const tarde = app.prazosDe('2025-09-10').find((p) => p.tipo === 'modelo2');
    assert.ok(tarde && tarde.urg === 'passado', 'passado o alvo continua, até se indicar o estado');
  });

  test('o Modelo 2 não aparece num contrato declarado, nem num não declarado, nem num que já terminou', () => {
    monta({ fisco: { estado: 'declarado' } });
    assert.ok(!app.prazosDe('2025-04-01').find((p) => p.tipo === 'modelo2'), 'declarado: já foi comunicado');
    monta({ fisco: { estado: 'naoDeclarado' } });
    assert.ok(!app.prazosDe('2025-04-01').find((p) => p.tipo === 'modelo2'), 'não declarado: escolha do senhorio');
    monta({ end: '2025-12-31' });
    assert.ok(!app.prazosDe('2026-03-01').find((p) => p.tipo === 'modelo2'), 'terminado em hoje fingido: não pede o início');
    monta({ start: '' });
    assert.ok(!app.prazosDe('2025-04-01').find((p) => p.tipo === 'modelo2'), 'sem início não há data-limite');
  });

  test('a cessação só num contrato declarado cujo fim já passou', () => {
    monta({ fisco: { estado: 'declarado' }, end: '2026-06-30' });
    const c = app.prazosDe('2026-07-05').find((p) => p.tipo === 'cessacao');
    assert.ok(c, 'fim passado: avisa');
    assert.equal(c.alvo, '2026-07-31', 'o fim do mês seguinte ao fim');
    assert.match(c.sub, /até 31\/07\/2026/i);
    assert.match(c.sub, /Modelo 2 também serve para a cessação/);
    assert.match(c.sub, /15 de fevereiro/);
    assert.equal(c.abrir, "ctView('C1')");
    assert.ok(!app.prazosDe('2026-06-20').find((p) => p.tipo === 'cessacao'), 'antes do fim não há cessação a comunicar');
    monta({ end: '2026-06-30' });                    // por indicar
    assert.ok(!app.prazosDe('2026-07-05').find((p) => p.tipo === 'cessacao'), 'por indicar: não se sabe se a AT o conhece');
    monta({ fisco: { estado: 'declarado' }, end: '2026-06-30', active: false });
    assert.ok(app.prazosDe('2026-07-05').find((p) => p.tipo === 'cessacao'), 'terminado à mão, com fim: avisa na mesma');
  });

  test('o recibo por emitir é de uma renda de contrato declarado sem recibo, dos últimos três meses', () => {
    monta({ fisco: { estado: 'declarado' } });
    renda('R1', '2026-08-05');
    const r = app.prazosDe('2026-09-12').find((p) => p.tipo === 'recibos');
    assert.ok(r, 'renda de agosto sem recibo');
    assert.equal(r.alvo, '2026-09-30', 'o fim do mês seguinte à renda');
    assert.equal(r.dias, 18);
    assert.match(r.titulo, /Recibo de renda por emitir — Ana · T2/);
    assert.match(r.sub, /Renda de agosto de 2026 recebida a 05\/08\/2026/);
    assert.match(r.sub, /marca-o no movimento/);
    assert.equal(r.abrir, "txView('R1')", 'a ficha do movimento, onde está o «Editar»');
    assert.ok(r.chave.startsWith('recibos:R1'), 'a chave é a do movimento');
    app.db.transactions[0].periodo = '2026-07';
    assert.match(app.prazosDe('2026-09-12').find((p) => p.tipo === 'recibos').sub, /Renda de julho de 2026/, 'o mês é o da renda, quando se disse qual é');
    app.db.transactions[0].recibo = true;
    assert.ok(!app.prazosDe('2026-09-12').find((p) => p.tipo === 'recibos'), 'com recibo emitido some');
  });

  test('sem contrato declarado, ou fora dos três meses, não há recibo a pedir', () => {
    monta({});                                       // por indicar
    renda('R1', '2026-08-05');
    assert.ok(!app.prazosDe('2026-09-12').find((p) => p.tipo === 'recibos'), 'por indicar: a AT ainda não emite recibos deste contrato');
    monta({ fisco: { estado: 'declarado' } });
    renda('R2', '2026-05-20');                       // três meses antes de setembro: junho em diante
    assert.ok(!app.prazosDe('2026-09-12').find((p) => p.tipo === 'recibos'), 'uma renda de maio já não entra em setembro');
    assert.ok(app.prazosDe('2026-06-20').find((p) => p.tipo === 'recibos'), 'mas entrava em junho: o hoje fingido manda');
    monta({ fisco: { estado: 'declarado' } });
    renda('R3', '2026-08-05', { sub: 'Caução' });
    assert.ok(!app.prazosDe('2026-09-12').find((p) => p.tipo === 'recibos'), 'a caução não é renda');
    monta({ fisco: { estado: 'declarado' } });
    renda('R4', '2026-08-05', { contractId: null });
    assert.ok(!app.prazosDe('2026-09-12').find((p) => p.tipo === 'recibos'), 'sem contrato não se sabe de que contrato é o recibo');
  });

  test('o IRS avisa de abril a junho quando houve rendas no ano anterior, e abre a página Declaração', () => {
    monta({});                                       // por indicar conta: é renda a declarar
    renda('R1', '2025-06-05');
    const i = app.prazosDe('2026-04-01').find((p) => p.tipo === 'irs');
    assert.ok(i, 'a 1 de abril entra');
    assert.equal(i.alvo, '2026-06-30');
    assert.equal(i.dias, 90);
    assert.match(i.titulo, /Anexo F de 2025/);
    assert.match(i.sub, /1 de abril a 30 de junho/);
    assert.match(i.sub, /página Declaração/);
    assert.equal(i.abrir, "go('fisco')");
    assert.equal(i.chave, 'irs:2025');
    assert.ok(!app.prazosDe('2026-03-31').find((p) => p.tipo === 'irs'), 'a 31 de março ainda não');
    assert.ok(!app.prazosDe('2026-07-01').find((p) => p.tipo === 'irs'), 'passado o prazo não fica a pesar');
    assert.equal(app.prazosDe('2026-04-01').filter((p) => p.tipo === 'irs').length, 1, 'um só por ano, não um por renda');
  });

  test('o ano do IRS é o do hoje fingido, e uma renda sem contrato conta', () => {
    monta({});
    renda('R1', '2026-06-05', { contractId: null });
    const i = app.prazosDe('2027-04-01').find((p) => p.tipo === 'irs');
    assert.ok(i, 'em 2027 declara-se 2026');
    assert.equal(i.alvo, '2027-06-30');
    assert.ok(!app.prazosDe('2026-04-01').find((p) => p.tipo === 'irs'), 'em 2026 não houve rendas de 2025');
  });

  test('o IRS não aparece se as únicas rendas foram de um contrato não declarado', () => {
    monta({ fisco: { estado: 'naoDeclarado' } });
    renda('R1', '2025-06-05');
    renda('R2', '2025-07-05');
    assert.ok(!app.prazosDe('2026-04-01').find((p) => p.tipo === 'irs'));
  });

  test('o 15 de fevereiro só num contrato declarado com taxa reduzida e rendas no ano anterior', () => {
    // seis anos: irsRate 15 %, abaixo dos 25
    monta({ fisco: { estado: 'declarado' }, start: '2025-03-01', end: '2031-02-28' });
    assert.ok(app.irsRate(app.db.contracts[0]) < 25, 'a taxa é reduzida');
    renda('R1', '2025-06-05');
    const f = app.prazosDe('2026-01-10').find((p) => p.tipo === 'fev15');
    assert.ok(f, 'em janeiro entra (45 dias)');
    assert.equal(f.alvo, '2026-02-15');
    assert.equal(f.dias, 36);
    assert.match(f.titulo, /duração do contrato.*Ana · T2/);
    assert.match(f.sub, /até 15\/02\/2026/i);
    assert.match(f.sub, /perde-se a redução/);
    assert.equal(f.abrir, "ctView('C1')");
    assert.ok(!app.prazosDe('2025-12-20').find((p) => p.tipo === 'fev15'), 'a 57 dias ainda não');
    assert.ok(app.prazosDe('2026-03-01').find((p) => p.tipo === 'fev15'), 'passado o dia continua, até se comunicar');
    monta({ fisco: { estado: 'declarado' } });        // sem fim: 25 %
    renda('R1', '2025-06-05');
    assert.ok(!app.prazosDe('2026-01-10').find((p) => p.tipo === 'fev15'), 'sem taxa reduzida não há o que comunicar');
    monta({ start: '2025-03-01', end: '2031-02-28' }); // por indicar
    renda('R1', '2025-06-05');
    assert.ok(!app.prazosDe('2026-01-10').find((p) => p.tipo === 'fev15'), 'por indicar: não');
    monta({ fisco: { estado: 'declarado' }, start: '2025-03-01', end: '2031-02-28' });
    assert.ok(!app.prazosDe('2026-01-10').find((p) => p.tipo === 'fev15'), 'sem rendas em 2025 não há redução a pedir');
  });

  test('um contrato não declarado não gera prazo nenhum da AT, aconteça o que acontecer', () => {
    monta({ fisco: { estado: 'naoDeclarado' }, start: '2020-03-01', end: '2026-06-30' });
    renda('R1', '2025-06-05');
    renda('R2', '2026-05-05');
    assert.equal(daAT(app.prazosDe('2026-07-05')).length, 0, 'nem cessação nem recibos');
    assert.equal(daAT(app.prazosDe('2026-04-01')).length, 0, 'nem IRS');
    assert.equal(daAT(app.prazosDe('2026-01-10')).length, 0, 'nem 15 de fevereiro');
  });

  test('o aumento de um contrato declarado lembra o Modelo 2; o de um por indicar não', () => {
    monta({ increase: 2.5, fisco: { estado: 'declarado' } });
    assert.match(app.prazosDe('2027-01-20').find((p) => p.tipo === 'aumento').sub, /comunica a nova renda à AT \(Modelo 2\)/);
    monta({ increase: 2.5 });
    assert.doesNotMatch(app.prazosDe('2027-01-20').find((p) => p.tipo === 'aumento').sub, /Modelo 2/);
  });

  test('cada prazo da AT abre alguma coisa e tem chave própria', () => {
    monta({ fisco: { estado: 'declarado' }, start: '2020-03-01', end: '2026-06-30' });
    renda('R1', '2025-06-05');
    renda('R2', '2026-06-05');
    const l = daAT(app.prazosDe('2026-07-05'));
    assert.ok(l.length >= 2, 'cessação e recibo, pelo menos');
    l.forEach((p) => {
      assert.match(p.abrir, /^(ctView|txView|go)\('/, p.tipo + ' abre alguma coisa');
      assert.ok(p.chave.startsWith(p.tipo + ':'), p.tipo + ' tem chave com o tipo');
      assert.match(p.alvo, /^\d{4}-\d{2}-\d{2}$/, p.tipo + ' tem alvo ISO');
    });
    assert.equal(new Set(l.map((p) => p.chave)).size, l.length, 'sem chaves repetidas');
  });
});

describe('silenciar', () => {
  test('cala a ocorrência; uma data nova traz o aviso de volta', () => {
    monta({ end: '2027-01-10' });
    const chave = app.prazosDe('2026-09-02').find((p) => p.tipo === 'oposicao').chave;
    app.db.settings.prazosVistos = { [chave]: true };
    assert.ok(!app.prazosAtivos('2026-09-02').find((p) => p.tipo === 'oposicao'), 'silenciado não aparece');
    app.db.contracts[0].end = '2027-06-30';          // renovou: data nova, chave nova
    monta.__ultimo = null;
    const dep = app.prazosDe('2027-01-20').find((p) => p.tipo === 'oposicao');
    assert.ok(dep && !app.db.settings.prazosVistos[dep.chave], 'a chave nova não está silenciada');
  });
});
