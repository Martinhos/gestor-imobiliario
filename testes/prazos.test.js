// Os prazos do ciclo de vida: as janelas legais do arrendamento medem-se em
// dias de pré-aviso, e um cálculo errado aqui custa dinheiro a alguém. Tudo
// com data de referência fingida — um teste de calendário que depende do
// dia em que corre não é um teste.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp } from './arnes.js';

const app = carregarApp();

// uma base limpa com um contrato ativo parametrizável
function monta(extra) {
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana', ccValid: '' })];
  app.db.owners = [];
  app.db.contracts = [app.normContract(Object.assign({
    id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'],
    rent: 800, start: '2025-03-01', end: '', increase: null, active: true,
  }, extra))];
  app.db.settings.prazosVistos = {};
}

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
    assert.equal(app.prazosDe('2026-09-20').filter((p) => p.tipo !== 'cc').length, 0);
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
      id: 'L1', name: 'Aquisição', type: 'mista', rate: 3.0, fixedYears: 2,
      start: '2024-12-01', euribor: 2.1, spread: 1.0,
    })];
    const l = app.prazosDe('2026-09-10');
    const en = l.find((p) => p.tipo === 'energia');
    assert.ok(en && en.dias === 66, 'energia na janela dos 90 dias');
    const tx = l.find((p) => p.tipo === 'taxa');
    assert.equal(tx.alvo, '2026-12-01', 'fim da fase fixa = start + fixedYears');
    assert.match(tx.sub, /3%.*3,1%/s);
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
