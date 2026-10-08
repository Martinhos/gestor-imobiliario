// As regras do IRS por ano dos rendimentos: uma versão por ano (web/app/irs-AAAA.js),
// registada em todo o lado, lida pelo motor do irs.js — as taxas de cada ano
// (25 % habitacional, 28 % não habitacional, a redução pela duração com os
// dois regimes e as renovações, os 10 % das rendas moderadas de 2026 a 2029),
// os prazos da AT, e o resumo do Anexo F com o 4.1 e o 4.2 separados, os
// gastos repartidos também pelas rendas que ficam fora, só o período
// arrendado, as rendas de anos anteriores para o quadro 8 e o imposto
// estimado. E a página: a versão do ano, o guia e o aviso de quando um ano
// ainda não tem versão.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { carregarApp, limpar, perto, repor, MODULOS, BASE } from './arnes.js';

const app = carregarApp({ hoje: '2026-10-08' });
afterEach(() => repor(app));

const RAIZ = new URL('../', import.meta.url);
const ler = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8').replace(/\r\n/g, '\n');
const copia = (x) => JSON.parse(JSON.stringify(x));
const ANOS = readdirSync(new URL('web/app/', RAIZ)).map((n) => /^irs-(\d{4})\.js$/.exec(n)).filter(Boolean).map((m) => Number(m[1])).sort();
const ct = (extra) => app.normContract(Object.assign({ rent: 1000, fisco: { estado: 'declarado', finalidade: 'hp' } }, extra));

beforeEach(() => {
  limpar(app);
  app.fiscoAno = '';
});

describe('as versões por ano dos rendimentos', () => {
  test('cada irs-AAAA.js regista o próprio ano e está no index.html (antes dos prazos), na SHELL, no arnês e no MAPA', () => {
    assert.ok(ANOS.includes(2025) && ANOS.includes(2026), 'há as versões de 2025 e de 2026');
    const html = ler('web/index.html'), sw = ler('web/sw.js'), mapa = ler('scripts/gerar-docs.js');
    const srcs = (html.match(/src="([^"]+\.js)"/g) || []).map((s) => s.slice(5, -1));
    for (const a of ANOS) {
      const f = 'irs-' + a;
      assert.match(ler('web/app/' + f + '.js'), new RegExp('registarAnoIrs\\(\\{\\s*ano:\\s*' + a + ','), f + ' regista ' + a);
      const i = srcs.indexOf('app/' + f + '.js');
      assert.ok(i > srcs.indexOf('app/irs.js') && i < srcs.indexOf('app/prazos.js'), f + ' no index.html, depois do irs.js e antes dos prazos');
      assert.match(sw, new RegExp("'" + f + "'"), f + ' na SHELL');
      assert.ok(MODULOS.includes(f) && BASE.includes(f), f + ' no arnês, na base');
      assert.ok(mapa.includes("'web/app/" + f + ".js'"), f + ' no MAPA');
    }
    igualA(app.irsAnosConhecidos(), ANOS);
  });

  test('cada versão tem os campos todos, com as datas no ano seguinte ao dos rendimentos', () => {
    for (const a of ANOS) {
      const v = copia(app.irsAno(a));
      assert.equal(v.ano, a); assert.equal(v.exato, true);
      assert.match(v.entrega.de, new RegExp('^' + (a + 1) + '-04-01$'));
      assert.match(v.entrega.ate, new RegExp('^' + (a + 1) + '-06-30$'));
      assert.match(v.prazos.comunicacaoDuracao, new RegExp('^' + (a + 1) + '-02-15$'));
      assert.equal(typeof v.modelo.oficial, 'boolean');
      assert.ok(v.modelo.texto.length > 40);
      assert.equal(v.taxas.habitacional, 25); assert.equal(v.taxas.naoHabitacional, 28);
      igualA(v.colunas, ['conservacao', 'condominio', 'imi', 'selo', 'taxas', 'outros']);
      igualA(v.naturezas, { habitacional: '07', naoHabitacional: '06' });
      assert.ok(v.novidades.length >= 1 && v.passos.length >= 5);
      v.passos.forEach((p) => assert.ok(p.titulo && p.texto.length > 20));
    }
  });

  test('um ano sem versão usa a mais recente antes dele, com as datas passadas para esse ano; antes da primeira, a primeira', () => {
    const ult = ANOS[ANOS.length - 1];
    const v = copia(app.irsAno(ult + 1));
    assert.equal(v.ano, ult); assert.equal(v.exato, false); assert.equal(v.pedido, ult + 1);
    assert.equal(v.entrega.ate, (ult + 2) + '-06-30', 'a entrega dos rendimentos do ano seguinte é no ano a seguir a esse');
    assert.equal(v.prazos.comunicacaoDuracao, (ult + 2) + '-02-15');
    const velho = copia(app.irsAno(2020));
    assert.equal(velho.ano, ANOS[0]); assert.equal(velho.exato, false);
    assert.equal(velho.entrega.de, '2021-04-01');
    assert.equal(app.irsAno().pedido, 2026, 'sem ano, o corrente');
    assert.equal(app.irsAno(1).pedido, 2026, 'o índice de um map não é um ano');
  });
});

describe('as taxas de cada ano', () => {
  test('2025: 25 % na habitação, 28 % no não habitacional, sem redução na habitação não permanente', () => {
    assert.equal(app.irsRate(ct({}), 2025), 25, 'sem fim não há duração');
    assert.equal(app.irsRate(ct({ fisco: { finalidade: 'nh' }, start: '2025-01-01', end: '2045-12-31' }), 2025), 28);
    assert.equal(app.irsRate(ct({ fisco: { finalidade: 'hnp' }, start: '2025-01-01', end: '2045-12-31' }), 2025), 25);
    assert.equal(app.irsTaxa(ct({ fisco: { finalidade: 'nh' } }), 2025).motivo, 'nh');
  });

  test('a redução pela duração da Lei 56/2023: 15, 10 e 5 %, e −2 pontos por renovação igual até 5 %', () => {
    const r = (start, end, ren) => app.irsRate(ct({ start, end, fisco: { finalidade: 'hp', renovacoes: ren || [] } }), 2025);
    assert.equal(r('2024-01-01', '2028-12-31'), 15, 'cinco anos');
    assert.equal(r('2024-01-01', '2028-12-30'), 25, 'um dia a menos já não');
    assert.equal(r('2024-03-15', '2034-03-14'), 10);
    assert.equal(r('2024-01-01', '2043-12-31'), 5);
    assert.equal(r('2024-01-01', '2028-12-31', [{ inicio: '2029-01-01', fim: '2033-12-31' }]), 15, 'a renovação ainda não começou em 2025');
    const longo = ct({ start: '2014-01-01', end: '2018-12-31', fisco: { finalidade: 'hp', renovacoes: [
      { inicio: '2024-01-01', fim: '2028-12-31' }, { inicio: '2029-01-01', fim: '2033-12-31' }, { inicio: '2034-01-01', fim: '2038-12-31' },
      { inicio: '2039-01-01', fim: '2043-12-31' }, { inicio: '2044-01-01', fim: '2048-12-31' }, { inicio: '2049-01-01', fim: '2053-12-31' }] } });
    assert.equal(app.irsRate(longo, 2025), 13);
    assert.equal(app.irsRate(longo, 2050), 5, 'nunca abaixo do mínimo');
    const curtaDepois = ct({ rent: 2500, start: '2024-01-01', end: '2028-12-31', fisco: { finalidade: 'hp', renovacoes: [{ inicio: '2029-01-01', fim: '2030-12-31' }] } });
    assert.equal(app.irsRate(curtaDepois, 2029), 25, 'uma renovação de dois anos não tem redução (e acima de 2 300 € não há os 10 %)');
  });

  test('o regime de 2019 vale até à renovação para quem começou antes de 7 de outubro de 2023, e fica a mais baixa com os 25 %', () => {
    assert.equal(app.irsRate(ct({ rent: 2500, start: '2020-03-01', end: '2025-02-28' }), 2024), 23, '5 anos em 2020: 23 %');
    assert.equal(app.irsRate(ct({ rent: 2500, start: '2021-01-01', end: '2023-12-31' }), 2023), 25, '3 anos: 26 % do regime antigo, fica o 25');
    assert.equal(app.irsRate(ct({ rent: 2500, start: '2020-01-01', end: '2039-12-31' }), 2025), 10, 'vinte anos no regime antigo: 10 %');
    assert.equal(app.irsRate(ct({ rent: 2500, start: '2017-01-01', end: '2027-12-31' }), 2025), 25, 'antes de 2019 não há redução');
  });

  test('2026: 10 % nas rendas de habitação até 2 300 €/mês, mesmo não permanente; a duração ganha quando dá menos; o não habitacional fica nos 28 %', () => {
    assert.equal(app.irsRate(ct({ rent: 2300 }), 2026), 10);
    assert.equal(app.irsRate(ct({ rent: 2300.01 }), 2026), 25);
    assert.equal(app.irsRate(ct({ rent: 800, fisco: { finalidade: 'hnp' } }), 2026), 10);
    assert.equal(app.irsRate(ct({ rent: 800, fisco: {} }), 2026), 10, 'finalidade por indicar: assume-se habitação');
    assert.equal(app.irsRate(ct({ rent: 800, fisco: { finalidade: 'nh' } }), 2026), 28);
    assert.equal(app.irsRate(ct({ rent: 800, start: '2026-01-01', end: '2045-12-31' }), 2026), 5, 'vinte anos: 5 %');
    const t = copia(app.irsTaxa(ct({ rent: 800, start: '2026-01-01', end: '2030-12-31' }), 2026));
    assert.equal(t.taxa, 10); assert.equal(t.motivo, 'moderada');
    assert.equal(t.reducao.taxa, 15, 'a redução pela duração continua lá: é ela que manda o contrato para o 4.2');
    assert.equal(app.irsRate(ct({ rent: 800 }), 2029), 10, 'até 2029 (a versão de 2026 serve os anos seguintes)');
    assert.equal(app.irsRate(ct({ rent: 800 }), 2030), 25, 'em 2030 acabou');
    assert.equal(app.irsRate(ct({ rent: 800 }), 2025), 25, 'em 2025 ainda não havia');
  });

  test('a taxa escrita no contrato manda sobre a estimativa, em qualquer ano', () => {
    assert.equal(app.taxRateOf(ct({ rent: 800, taxRate: 25 }), 2026), 25);
    perto(app.netRent(ct({ rent: 800 }), 2026), 720);
    assert.equal(app.irsTaxaPorque(ct({ rent: 800 }), 2026), 'renda moderada');
    assert.equal(app.irsTaxaPorque(ct({ rent: 8000, start: '2026-01-01', end: '2036-12-31' }), 2026), 'pela duração');
  });

  test('a frase das taxas sai da versão: em 2026 fala das rendas moderadas, em 2025 não', () => {
    const t26 = app.irsTaxasTexto(2026), t25 = app.irsTaxasTexto(2025);
    assert.match(t26, /25 % \(28 % no não habitacional\)/);
    assert.match(t26, /15 % com 5 anos, 10 % com 10 anos, 5 % com 20 anos ou mais/);
    assert.match(t26, /Até 2029, as rendas de habitação até 2\s300\s€ por mês pagam 10 %/);
    assert.doesNotMatch(t25, /moderad|2029/);
  });
});

describe('os prazos da AT vêm da versão do ano', () => {
  const monta = (extra) => {
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2' })];
    app.db.contracts = [app.normContract(Object.assign({ id: 'C1', propertyId: 'P1', rent: 800, start: '2025-01-01', active: true,
      fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } }, extra))];
    app.db.transactions = [app.normTx({ id: 'r', kind: 'income', category: 'Rendas', amount: 800, date: '2025-05-01', propertyId: 'P1', contractId: 'C1', recibo: true })];
    app.db.settings.prazosVistos = {};
  };

  test('a entrega do Anexo F e a comunicação de fevereiro têm as datas da versão', () => {
    monta({ end: '2034-12-31' });
    const l = app.prazosDe('2026-01-20');
    assert.equal(l.find((p) => p.tipo === 'fev15').alvo, app.irsAno(2025).prazos.comunicacaoDuracao);
    const irs = app.prazosDe('2026-05-01').find((p) => p.tipo === 'irs');
    assert.equal(irs.alvo, app.irsAno(2025).entrega.ate);
    assert.match(irs.sub, /^De 1 de abril a 30 de junho\./);
  });

  test('a comunicação de fevereiro só nasce da redução pela duração — os 10 % das rendas moderadas não a pedem', () => {
    monta({ start: '2026-01-01', end: '2027-12-31' });
    app.db.transactions[0].date = '2026-05-01';
    assert.equal(app.irsRate(app.db.contracts[0], 2026), 10);
    assert.ok(!app.prazosDe('2027-01-20').some((p) => p.tipo === 'fev15'));
    app.db.contracts[0].end = '2032-12-31';
    assert.ok(app.prazosDe('2027-01-20').some((p) => p.tipo === 'fev15'), 'com sete anos já há redução, e a comunicação');
  });

  test('o Modelo 2 lembra o imposto do selo, que é dedutível', () => {
    monta({ start: '2026-09-15', fisco: { estado: '' } });
    const m = app.prazosDe('2026-10-08').find((p) => p.tipo === 'modelo2');
    assert.match(m.sub, /imposto do selo \(10 % de uma renda\), que é dedutível/);
  });
});

describe('o resumo do Anexo F', () => {
  const casa = (extra) => {
    app.db.owners.push(app.normPerson({ id: 'o1', name: 'Eu' }));
    app.db.properties.push(app.normProp(Object.assign({ id: 'p1', name: 'Casa', ownerIds: ['o1'], freguesiaCodigo: '110659', tipoPredio: 'U', matrix: '1' }, extra)));
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Ana', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Rui', nif: '123456789' }));
  };
  const renda = (id, contractId, date, amount, extra) => app.db.transactions.push(app.normTx(Object.assign({ id, kind: 'income', category: 'Rendas', amount: amount || 500, date, propertyId: 'p1', contractId, recibo: true }, extra)));
  const gasto = (id, category, date, amount, extra) => app.db.transactions.push(app.normTx(Object.assign({ id, kind: 'expense', category, amount, date, propertyId: 'p1' }, extra)));

  test('os gastos do imóvel repartem-se também pelas rendas que ficam fora (não declaradas e sem contrato), e essa parte não entra', () => {
    casa();
    app.db.contracts.push(app.normContract({ id: 'c1', propertyId: 'p1', tenantIds: ['t1'], rent: 500, start: '2025-01-01', fisco: { estado: 'declarado', numero: '1' } }));
    app.db.contracts.push(app.normContract({ id: 'c2', propertyId: 'p1', tenantIds: ['t2'], rent: 500, start: '2025-01-01', fisco: { estado: 'naoDeclarado' } }));
    renda('r1', 'c1', '2025-03-01'); renda('r2', 'c2', '2025-03-01'); renda('r3', null, '2025-04-01');
    gasto('d1', 'Condomínio', '2025-03-10', 150);
    const r = app.resumoFiscal(2025, '');
    assert.equal(r.linhas.length, 1);
    perto(r.linhas[0].gastos.condominio, 50, 1e-9, 'um terço: 500 de 1 500');
    perto(r.totais.gastos.condominio, 50, 1e-9);
  });

  test('só o período arrendado conta: o condomínio com o imóvel vazio fica fora e diz-se; o IMI conta; a coluna escolhida à mão manda', () => {
    casa();
    app.db.contracts.push(app.normContract({ id: 'c1', propertyId: 'p1', tenantIds: ['t1'], rent: 500, start: '2025-07-01', fisco: { estado: 'declarado', numero: '1' } }));
    renda('r1', 'c1', '2025-07-01');
    gasto('d1', 'Condomínio', '2025-03-10', 100);
    gasto('d2', 'Condomínio', '2025-08-10', 100);
    gasto('d3', 'Impostos', '2025-05-10', 300, { sub: 'IMI' });
    gasto('d4', 'Seguros', '2025-02-01', 80, { irsCol: 'outros' });
    const r = app.resumoFiscal(2025, '');
    perto(r.linhas[0].gastos.condominio, 100, 1e-9);
    perto(r.linhas[0].gastos.imi, 300, 1e-9, 'CIRS art. 41.º n.º 5: o IMI do ano em que o imóvel deu rendas');
    perto(r.linhas[0].gastos.outros, 80, 1e-9, 'escolhida à mão: a pessoa decidiu');
    assert.equal(r.foraDoPeriodo, 1);
    const a = r.avisos.find((x) => /sem contrato em vigor/.test(x.texto));
    assert.ok(a && /só conta o período arrendado/.test(a.texto));
  });

  test('o 4.2 leva os contratos com redução pela duração, com as datas do 4.2A; o 4.1 os outros; a natureza e a taxa são do ano', () => {
    casa();
    app.db.contracts.push(app.normContract({ id: 'longo', name: 'Longo', propertyId: 'p1', tenantIds: ['t1'], rent: 600, start: '2024-01-01', end: '2030-12-31',
      fisco: { estado: 'declarado', numero: '7', finalidade: 'hp', renovacoes: [] } }));
    app.db.contracts.push(app.normContract({ id: 'loja', name: 'Loja', propertyId: 'p1', tenantIds: ['t2'], rent: 900, start: '2024-01-01', end: '2033-12-31',
      fisco: { estado: 'declarado', numero: '8', finalidade: 'nh' } }));
    renda('r1', 'longo', '2025-02-01', 600); renda('r2', 'loja', '2025-02-01', 900);
    const r = app.resumoFiscal(2025, '');
    const longo = r.linhas.find((l) => l.contratoId === 'longo'), loja = r.linhas.find((l) => l.contratoId === 'loja');
    assert.equal(longo.quadro, '4.2'); assert.equal(longo.taxa, 15); assert.equal(longo.natureza, '07');
    igualA(longo.datas, { inicio: '2024-01-01', fim: '2030-12-31', renovacaoInicio: '', renovacaoFim: '' });
    assert.equal(loja.quadro, '4.1'); assert.equal(loja.taxa, 28); assert.equal(loja.natureza, '06');
    assert.equal(r.linhas[0].contratoId, 'loja', 'o 4.1 primeiro');
  });

  test('um contrato longo sem finalidade: a falta diz-se, porque a redução é só da habitação permanente', () => {
    casa();
    app.db.contracts.push(app.normContract({ id: 'c1', name: 'Sem fim', propertyId: 'p1', tenantIds: ['t1'], rent: 600, start: '2024-01-01', end: '2033-12-31', fisco: { estado: 'declarado', numero: '1' } }));
    renda('r1', 'c1', '2025-02-01', 600);
    const r = app.resumoFiscal(2025, '');
    assert.ok(r.linhas[0].faltas.some((f) => /^finalidade/.test(f)));
    assert.ok(r.avisos.some((a) => /habitação permanente/.test(a.texto)));
  });

  test('uma renda de anos anteriores entra na linha (conta no ano em que se recebe) e fica apontada para o quadro 8', () => {
    casa();
    app.db.contracts.push(app.normContract({ id: 'c1', propertyId: 'p1', tenantIds: ['t1'], rent: 500, start: '2023-01-01', fisco: { estado: 'declarado', numero: '1' } }));
    renda('r1', 'c1', '2025-01-05', 500, { periodo: '2024-11' });
    renda('r2', 'c1', '2025-01-06', 500, { periodo: '2023-12' });
    renda('r3', 'c1', '2025-03-01', 500, { periodo: '2025-03' });
    const r = app.resumoFiscal(2025, '');
    perto(r.linhas[0].rendas, 1500, 1e-9);
    igualA(r.linhas[0].anosAnteriores, [{ ano: 2023, valor: 500 }, { ano: 2024, valor: 500 }]);
    perto(r.totais.anosAnteriores, 1000, 1e-9);
    app.fiscoAno = '2025';
    assert.match(app.vFisco(), /Rendas de anos anteriores[\s\S]*respeitam a 2024/);
  });

  test('o selo de um contrato que começou no ano: lembra-se quando falta, cala-se quando está', () => {
    casa();
    app.db.contracts.push(app.normContract({ id: 'c1', name: 'Novo', propertyId: 'p1', tenantIds: ['t1'], rent: 500, start: '2025-03-01', fisco: { estado: 'declarado', numero: '1' } }));
    renda('r1', 'c1', '2025-03-01');
    assert.ok(app.resumoFiscal(2025, '').avisos.some((a) => /imposto do selo/.test(a.texto)));
    gasto('s', 'Impostos', '2025-03-20', 50, { sub: 'Imposto do selo' });
    assert.ok(!app.resumoFiscal(2025, '').avisos.some((a) => /imposto do selo/.test(a.texto)));
    perto(app.resumoFiscal(2025, '').linhas[0].gastos.selo, 50, 1e-9);
  });

  test('o líquido, o imposto estimado à taxa de cada contrato e o prejuízo a reportar', () => {
    casa();
    app.db.contracts.push(app.normContract({ id: 'c1', propertyId: 'p1', tenantIds: ['t1'], rent: 1000, start: '2025-01-01', fisco: { estado: 'declarado', numero: '1' } }));
    renda('r1', 'c1', '2025-02-01', 1000, { retencao: 250 });
    gasto('g', 'Condomínio', '2025-02-10', 250);
    let r = app.resumoFiscal(2025, '');
    perto(r.linhas[0].liquido, 1000, 1e-9, '1 250 ilíquidos − 250');
    perto(r.totais.imposto, 250, 1e-9, '25 % em 2025');
    gasto('g2', 'Manutenção e reparações', '2025-03-10', 3000);
    r = app.resumoFiscal(2025, '');
    perto(r.totais.liquido, -2000, 1e-9);
    perto(r.totais.imposto, 0, 1e-9, 'um resultado negativo não paga');
    perto(r.totais.prejuizo, 2000, 1e-9);
  });
});

describe('a página Declaração', () => {
  const comRendas = (ano) => {
    app.db.owners.push(app.normPerson({ id: 'o1', name: 'Eu' }));
    app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', ownerIds: ['o1'], freguesiaCodigo: '110659', tipoPredio: 'U', matrix: '1' }));
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Ana', nif: '123456789' }));
    // sete anos: 15 % pela duração (e, de 2026 a 2029, os 10 % das rendas moderadas, que são mais baixos)
    app.db.contracts.push(app.normContract({ id: 'c1', name: 'Ana', propertyId: 'p1', tenantIds: ['t1'], rent: 700, start: (ano - 1) + '-01-01', end: (ano + 5) + '-12-31',
      fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } }));
    app.db.transactions.push(app.normTx({ id: 'r', kind: 'income', category: 'Rendas', amount: 700, date: ano + '-02-01', propertyId: 'p1', contractId: 'c1', recibo: true }));
    app.fiscoAno = String(ano);
  };

  test('2025: a versão oficial, a entrega em 2026, o que mudou, o 4.2 com o 4.2A e o guia', () => {
    comRendas(2025);
    const html = app.vFisco();
    assert.match(html, /IRS 2025/);
    assert.match(html, /Rendimentos de 2025 · entrega de 1 de abril a 30 de junho de 2026/);
    assert.match(html, /Modelo oficial/);
    assert.match(html, /O que mudou em 2025/);
    assert.match(html, /Anexo F · quadro 4\.2/);
    assert.match(html, /Quadro 4\.2A · datas de cada contrato/);
    assert.doesNotMatch(html, /Anexo F · quadro 4\.1/, 'sem contratos sem redução, o 4.1 não se escreve');
    assert.match(html, /Como preencher, passo a passo/);
    assert.match(html, /Simular e entregar/);
    assert.match(html, /taxa 15 % · pela duração/);
  });

  test('2026: provisória, com os 10 % nas novidades e na linha', () => {
    comRendas(2026);
    const html = app.vFisco();
    assert.match(html, /Versão provisória/);
    assert.match(html, /Taxa de 10 % nas rendas de habitação até 2\s300 €/);
    assert.match(html, /taxa 10 % · renda moderada/);
    assert.match(html, /entrega de 1 de abril a 30 de junho de 2027/);
  });

  test('um ano sem versão diz que usa a mais recente', () => {
    comRendas(2027);
    const html = app.vFisco();
    assert.match(html, /Ainda não há versão das regras de 2027\./);
    assert.match(html, /Usam-se as de 2026/);
    assert.match(html, /entrega de 1 de abril a 30 de junho de 2028/);
    assert.doesNotMatch(html, /O que mudou em/, 'as novidades de outro ano não são deste');
    assert.match(html, /Regras de 2026/);
    assert.doesNotMatch(html, /rendimentos de 2026 —/, 'nem o texto do modelo de outro ano');
  });

  test('sem rendas no ano, a versão do ano continua à vista', () => {
    comRendas(2025);
    app.fiscoAno = '2026';
    const html = app.vFisco();
    assert.match(html, /Sem rendas em 2026/);
    assert.match(html, /IRS 2026/);
  });

  test('a ficha do contrato diz porque é que a taxa é a que é', () => {
    comRendas(2026);
    app.db.contracts[0].end = '2027-12-31';
    let html = '';
    app.ficha = (linhas) => { html = JSON.stringify(linhas); return ''; };
    app.ctFicha('c1');
    assert.match(html, /10%[^"]*\(estimado: renda moderada\)/);
    assert.match(html, /taxa de 10 % das rendas moderadas \(EBF art\. 45\.º-C\)/);
  });
});

describe('o guião do ano novo (scripts/nova-versao-irs.js)', () => {
  test('numa cópia da árvore, cria o ano a seguir ao último com as datas certas, o modelo provisório, e regista-o nos quatro sítios', () => {
    const { criarVersao } = createRequire(import.meta.url)('../scripts/nova-versao-irs.js');
    const tmp = mkdtempSync(join(tmpdir(), 'irs-ano-'));
    try {
      const ult = ANOS[ANOS.length - 1], novo = ult + 1;
      for (const rel of ['web/index.html', 'web/sw.js', 'testes/arnes.js', 'scripts/gerar-docs.js'].concat(ANOS.map((a) => 'web/app/irs-' + a + '.js'))) {
        mkdirSync(dirname(join(tmp, rel)), { recursive: true });
        writeFileSync(join(tmp, rel), readFileSync(new URL(rel, RAIZ)));
      }
      const r = criarVersao(tmp, novo);
      assert.equal(r.de, ult);
      const txt = readFileSync(join(tmp, 'web/app/irs-' + novo + '.js'), 'utf8');
      assert.match(txt, new RegExp('^/\\* =+ IRS ' + novo + ' =+'));
      assert.match(txt, new RegExp('registarAnoIrs\\(\\{\\s*ano:' + novo + ','));
      assert.match(txt, new RegExp("entrega:\\{de:'" + (novo + 1) + "-04-01',ate:'" + (novo + 1) + "-06-30'\\}"));
      assert.match(txt, new RegExp("comunicacaoDuracao:'" + (novo + 1) + "-02-15'"));
      assert.match(txt, /modelo:\{oficial:false,/);
      assert.match(txt, new RegExp('Ainda sem novidades confirmadas para ' + novo));
      assert.doesNotMatch(txt, new RegExp("ano:" + ult + ","));
      const ok = (rel, re, n) => assert.equal((readFileSync(join(tmp, rel), 'utf8').match(re) || []).length, n, rel);
      ok('web/index.html', new RegExp('<script src="app/irs-' + ult + '\\.js"></script>\\r?\\n<script src="app/irs-' + novo + '\\.js"></script>', 'g'), 1);
      ok('web/sw.js', new RegExp("'irs-" + novo + "'", 'g'), 1);
      ok('testes/arnes.js', new RegExp("'irs-" + novo + "'", 'g'), 2);
      ok('scripts/gerar-docs.js', new RegExp("'web/app/irs-" + novo + "\\.js'", 'g'), 1);
      assert.throws(() => criarVersao(tmp, novo), /já existe/);
      assert.throws(() => criarVersao(tmp, ult - 1), /já existe|só se cria um ano depois/);
      // e a versão nova carrega e lê-se como as outras: o texto é JavaScript válido
      const ctx = { versoes: [] };
      runInNewContext('function registarAnoIrs(v){versoes.push(v)}\n' + txt, ctx);
      assert.equal(ctx.versoes[0].ano, novo);
      assert.equal(ctx.versoes[0].passos.length, copia(app.irsAno(ult)).passos.length, 'os passos vêm iguais, com os marcadores');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

/* compara através do contexto isolado (os arrays da vm têm outro protótipo) */
function igualA(a, b, msg) { assert.deepEqual(copia(a), b, msg); }
