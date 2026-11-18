// O resumo do Anexo F (fisco-resumo.js:resumoFiscal), as linhas e o imposto —
// vaga 1 do IRS, folha 2.1.7 (KAN-126): a última renovação do 4.2A só do ano
// (D13), a finalidade por indicar (D16), a taxa da lei do ano e a escrita ao
// lado (D17), o contrato anterior do mesmo quarto (D38), o início em falta
// (D43), as obras dos 24 meses no ano do início (D63), as frações (D69), as
// perdas titular a titular sem imposto negativo (D72, D98), o n.º do campo
// (D77) e as despesas «a confirmar» que não contam (D61 e os gastos).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, perto, repor } from './arnes.js';

// um dia depois de todos os anos dos cenários, na época da entrega de 2026
const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

const json = (x) => JSON.parse(JSON.stringify(x));
const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: '2026-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};
const imovel = (extra) => {
  const p = app.normProp(Object.assign({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }, extra || {}));
  app.db.properties.push(p);
  return p;
};
const contrato = (extra) => {
  const c = app.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'v1', tenantIds: ['t1'], rent: 1000,
    start: '2025-01-01', active: true, fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }, extra || {}));
  app.db.contracts.push(c);
  return c;
};
/* doze rendas (ou as dos meses dados) de um contrato num ano */
const rendas = (cid, ano, valor, meses, pid) => (meses || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).forEach((m) =>
  mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: cid, propertyId: pid || 'v1',
    date: `${ano}-${String(m).padStart(2, '0')}-05`, recibo: true }));
const linha = (r, id) => r.linhas.find((l) => l.contratoId === id);

beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Vera', nif: '123456789' }));
});

describe('D13 — a última renovação do 4.2A é só a começada até 31 de dezembro do ano', () => {
  test('renovado em 2027: a linha de 2026 não a mostra, a de 2027 sim', () => {
    imovel();
    // contrato de 5 anos (regime de 2019, 23 %), renovado pelo «Renovar…»: o c.end vai com a renovação
    contrato({ start: '2022-01-01', end: '2031-12-31',
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', renovacoes: [{ inicio: '2027-01-01', fim: '2031-12-31' }] } });
    rendas('C1', 2026, 1000); rendas('C1', 2027, 1000, [1, 2, 3, 4]);
    const a = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(a.datas.inicio, '2022-01-01');
    assert.equal(a.datas.fim, '2026-12-31', 'o termo é o do contrato inicial');
    assert.equal(a.datas.renovacaoInicio, '', 'em 2026 ainda não havia renovação');
    assert.equal(a.datas.renovacaoFim, '');
    const b = linha(app.resumoFiscal(2027, 'ana'), 'C1');
    assert.equal(b.datas.renovacaoInicio, '2027-01-01');
    assert.equal(b.datas.renovacaoFim, '2031-12-31');
  });

  test('uma renovação a meio do ano é desse ano', () => {
    imovel();
    contrato({ start: '2021-06-01', end: '2031-05-31',
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', renovacoes: [{ inicio: '2026-06-01', fim: '2031-05-31' }] } });
    rendas('C1', 2026, 1000);
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(l.datas.fim, '2026-05-31');
    assert.equal(l.datas.renovacaoInicio, '2026-06-01');
  });
});

describe('D16 — a finalidade por indicar é uma falta em todas as linhas', () => {
  test('uma loja sem finalidade: natureza 07 assumida, com a falta; com a finalidade, nada', () => {
    imovel();
    contrato({ start: '2025-01-01', end: '2027-12-31', rent: 800, fisco: { estado: 'declarado', numero: '111', finalidade: '' } });
    rendas('C1', 2026, 800);
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(l.quadro, '4.1', 'sem redução pela duração (antes, só aí se pedia a finalidade)');
    assert.equal(l.natureza, '07');
    assert.equal(l.naturezaAssumida, true);
    assert.ok(l.faltas.some((f) => /^finalidade do contrato/.test(f)), 'a falta começa pelo texto que os avisos procuram');
    app.db.contracts[0].fisco.finalidade = 'nh';
    const nh = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(nh.natureza, '06');
    assert.equal(nh.naturezaAssumida, false);
    assert.equal(nh.taxa, 28);
    assert.ok(!nh.faltas.some((f) => /^finalidade/.test(f)));
    app.db.contracts[0].fisco.finalidade = 'hp';
    const hp = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(hp.naturezaAssumida, false);
    assert.ok(!hp.faltas.some((f) => /^finalidade/.test(f)));
  });
});

describe('D17 — na Declaração a taxa é a da lei do ano; a escrita vai ao lado', () => {
  test('25 % escrito num contrato de 2026 com renda até 2 300 €: taxa 10, taxaEscrita 25, imposto a 10 %', () => {
    imovel();
    contrato({ start: '2024-03-01', end: '2027-02-28', rent: 900, taxRate: 25 });
    rendas('C1', 2026, 900);
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(l.taxa, 10);
    assert.equal(l.motivoTaxa, 'moderada');
    assert.equal(l.taxaEscrita, 25);
    perto(l.imposto, 10800 * 0.10, 1e-9);
    perto(app.taxRateOf(app.db.contracts[0], 2026), 25, 1e-9, 'fora da Declaração a escrita continua a mandar');
    app.db.contracts[0].taxRate = 0;
    assert.equal(linha(app.resumoFiscal(2026, 'ana'), 'C1').taxaEscrita, null, 'sem nada escrito, null');
  });

  test('28 % escrito num contrato de habitação de 2025: a taxa é a base, 25', () => {
    imovel();
    contrato({ start: '2022-01-01', rent: 2500, taxRate: 28 });
    rendas('C1', 2025, 2500);
    const l = linha(app.resumoFiscal(2025, 'ana'), 'C1');
    assert.equal(l.taxa, 25);
    assert.equal(l.taxaEscrita, 28);
  });
});

describe('D38 — o contrato anterior do 4.2B é o do mesmo quarto, e já acabado', () => {
  const quartos = () => {
    imovel({ rooms: [{ id: 'qA', name: 'Quarto A' }, { id: 'qB', name: 'Quarto B' }] });
    contrato({ id: 'B0', name: 'Quarto B (antigo)', roomId: 'qB', rent: 420, start: '2023-01-01', end: '2024-08-31', active: false,
      fisco: { estado: 'declarado', numero: '000-B', finalidade: 'hp' } });
    contrato({ id: 'A1', name: 'Quarto A', roomId: 'qA', rent: 400, start: '2024-02-01', active: true,
      fisco: { estado: 'declarado', numero: '111-A', finalidade: 'hp' } });
    contrato({ id: 'B1', name: 'Quarto B (novo)', roomId: 'qB', tenantIds: ['t2'], rent: 380, start: '2024-09-01', end: '2029-08-31',
      fisco: { estado: 'declarado', numero: '222-B', finalidade: 'hp', rendaAnterior: 420 } });
    rendas('B1', 2025, 380); rendas('A1', 2025, 400);
  };

  test('num imóvel por quartos o anterior é o do mesmo quarto, nunca o de outro em vigor', () => {
    quartos();
    const l = linha(app.resumoFiscal(2025, 'ana'), 'B1');
    assert.deepEqual(json(l.contratoAnterior), { id: 'B0', nome: 'Quarto B (antigo)', numero: '000-B' });
  });

  test('sem contrato anterior do mesmo quarto fica por identificar (null)', () => {
    quartos();
    app.db.contracts = app.db.contracts.filter((c) => c.id !== 'B0');
    assert.equal(linha(app.resumoFiscal(2025, 'ana'), 'B1').contratoAnterior, null);
  });

  test('um contrato do mesmo imóvel ainda em vigor no início do novo não é o anterior', () => {
    imovel();
    contrato({ id: 'X', name: 'Velho', rent: 500, start: '2020-01-01', end: '2025-12-31', active: true,
      fisco: { estado: 'declarado', numero: '999', finalidade: 'hp' } });
    contrato({ id: 'N', name: 'Novo', tenantIds: ['t2'], rent: 450, start: '2025-03-01', end: '2030-02-28',
      fisco: { estado: 'declarado', numero: '888', finalidade: 'hp', rendaAnterior: 500 } });
    rendas('N', 2025, 450, [3, 4, 5]);
    assert.equal(app.fiscoContratoAnterior(app.db.contracts[1]), null);
    // terminado de facto antes do novo (a cessação), mesmo com o termo estipulado depois: é o anterior
    app.db.contracts[0].active = false;
    app.db.contracts[0].fisco.cessacao = { data: '2025-02-28', motivo: '' };
    assert.equal(app.fiscoContratoAnterior(app.db.contracts[1]).id, 'X');
  });
});

describe('D43 — o contrato sem data de início tem a falta', () => {
  test('a falta «data de início do contrato» na linha', () => {
    imovel();
    contrato({ start: '' });
    rendas('C1', 2026, 1000, [1, 2, 3]);
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.ok(l.faltas.indexOf('data de início do contrato') > -1);
    app.db.contracts[0].start = '2026-01-01';
    assert.ok(linha(app.resumoFiscal(2026, 'ana'), 'C1').faltas.indexOf('data de início do contrato') < 0);
  });
});

describe('D63 — as obras dos 24 meses vão para o ano em que o contrato começa', () => {
  // a casa esteve só à espera de inquilino: sem a resposta «sim», as obras ficam por confirmar (D28)
  const espera = { estado: 'declarado', numero: '1234567', finalidade: 'hp', obrasSemOutroUso: true };
  test('a 1.ª renda paga em dezembro, antes do início em janeiro: as obras são do ano do início', () => {
    imovel();
    contrato({ start: '2027-01-01', fisco: espera });
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2026-12-15', periodo: '2027-01', recibo: true });
    rendas('C1', 2027, 1000, [2, 3, 4]);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 4000, date: '2026-10-10' });
    const a = linha(app.resumoFiscal(2026, 'ana'), 'C1'), b = linha(app.resumoFiscal(2027, 'ana'), 'C1');
    perto(a.obras24.valor, 0, 1e-9, 'não na declaração do ano antes do início');
    perto(b.obras24.valor, 4000, 1e-9);
    assert.equal(b.obras24.inicioGastos, '2026-10-10');
  });

  test('sem rendas no ano do início, as obras vão para o primeiro ano com rendas (o recurso)', () => {
    imovel();
    contrato({ start: '2026-12-01', fisco: espera });
    rendas('C1', 2027, 1000, [1, 2, 3]);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 3000, date: '2026-10-10' });
    perto(linha(app.resumoFiscal(2027, 'ana'), 'C1').obras24.valor, 3000, 1e-9);
  });
});

describe('D69 — mais do que uma fração no mesmo campo é uma falta', () => {
  test('«C e AB», «A, B», «A/B» e «A+B» têm a falta; «A», «AB» e «R/C» não', () => {
    imovel();
    contrato();
    rendas('C1', 2026, 900);
    const faltaDe = (fr) => {
      app.db.properties[0].fraction = fr;
      return linha(app.resumoFiscal(2026, 'ana'), 'C1').faltas.find((f) => /^fração: mais do que uma/.test(f));
    };
    for (const fr of ['C e AB', 'A, B', 'A/B', 'A+B', 'c E ab']) assert.ok(faltaDe(fr), fr);
    assert.match(faltaDe('C e AB'), /\(C e AB\)/, 'a falta diz o que está escrito');
    for (const fr of ['A', 'AB', 'R/C', 'r/c esq', '']) assert.equal(faltaDe(fr), undefined, fr);
  });
});

describe('D72 e D98 — as perdas titular a titular, sem imposto negativo', () => {
  const s1 = () => {
    imovel({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'] });
    imovel({ id: 'v2', name: 'Loja Bruno', ownerIds: ['bruno'], matrix: '200' });
    contrato({ id: 'C1', name: 'Arroios', propertyId: 'v1', rent: 1000, start: '2024-01-01' });
    contrato({ id: 'C2', name: 'Loja', propertyId: 'v2', tenantIds: ['t2'], rent: 300, start: '2024-01-01',
      fisco: { estado: 'declarado', numero: '222', finalidade: 'nh' } });
    rendas('C1', 2025, 1000); rendas('C2', 2025, 300, null, 'v2');
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, date: '2025-04-10' });
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 10000, propertyId: 'v2', date: '2025-06-10' });
  };

  test('conjunta: a perda do B não abate ao A — imposto só do A e prejuízo do B', () => {
    s1();
    app.db.settings.irs = { conjunta: true, titulares: { bruno: 'B' }, dispensaRecibos: false, outrosRendimentos: {} };
    const r = app.resumoFiscal(2025, 'ana');
    const a = linha(r, 'C1'), b = linha(r, 'C2');
    perto(a.liquido, 11700, 1e-9); perto(b.liquido, -6400, 1e-9);
    perto(a.imposto, 2925, 1e-9);
    assert.equal(b.imposto, 0, 'nenhuma linha com imposto negativo');
    perto(b.prejuizo, 6400, 1e-9);
    assert.equal(a.prejuizo, 0);
    perto(r.totais.imposto, 2925, 1e-9);
    perto(r.totais.prejuizo, 6400, 1e-9);
    assert.deepEqual(json(r.totais.porTitular), {
      ana: { liquido: 11700, imposto: 2925, prejuizo: 0 },
      bruno: { liquido: -6400, imposto: 0, prejuizo: 6400 } });
    assert.ok(r.linhas.every((l) => l.imposto >= 0));
    perto(r.totais.imposto, r.linhas.reduce((s, l) => s + l.imposto, 0), 1e-9, 'o total sai das linhas: os totais dos quadros batem com o KPI');
  });

  test('um titular com duas taxas: a perda abate ao positivo, que paga a taxa dele', () => {
    s1();
    app.db.properties.find((p) => p.id === 'v2').ownerIds = ['ana'];
    const r = app.resumoFiscal(2025, 'ana');
    perto(r.totais.liquido, 5300, 1e-9);
    perto(r.totais.imposto, 5300 * 0.25, 1e-9, '5 300 € à taxa do rendimento que sobra (25 %), e não 1 133 €');
    perto(linha(r, 'C1').imposto, 1325, 1e-9);
    assert.equal(linha(r, 'C2').imposto, 0);
    perto(linha(r, 'C2').prejuizo, 6400, 1e-9, 'o prejuízo da linha fica dito');
    assert.equal(r.totais.prejuizo, 0, 'mas o titular não tem prejuízo a reportar');
    assert.deepEqual(json(r.totais.porTitular), { ana: { liquido: 5300, imposto: 1325, prejuizo: 0 } });
  });

  test('várias linhas positivas: a perda reparte-se na proporção delas, cada parte à sua taxa', () => {
    imovel({ id: 'v1', ownerIds: ['ana'] });
    imovel({ id: 'v2', name: 'Loja', ownerIds: ['ana'] });
    imovel({ id: 'v3', name: 'Garagem', ownerIds: ['ana'] });
    contrato({ id: 'H', propertyId: 'v1', rent: 1000, start: '2022-01-01' });                    // 12 000 a 25 %
    contrato({ id: 'L', propertyId: 'v2', rent: 500, start: '2022-01-01', fisco: { estado: 'declarado', numero: '2', finalidade: 'nh' } }); // 6 000 a 28 %
    contrato({ id: 'G', propertyId: 'v3', rent: 100, start: '2022-01-01', fisco: { estado: 'declarado', numero: '3', finalidade: 'nh' } }); // 1 200 − 4 800
    rendas('H', 2025, 1000); rendas('L', 2025, 500, null, 'v2'); rendas('G', 2025, 100, null, 'v3');
    mov({ kind: 'expense', category: 'Manutenção e reparações', amount: 6000, propertyId: 'v3', date: '2025-05-05' });
    const r = app.resumoFiscal(2025, 'ana');
    // perda 4 800: 2/3 ao H (3 200), 1/3 à L (1 600)
    perto(linha(r, 'H').imposto, (12000 - 3200) * 0.25, 1e-9);
    perto(linha(r, 'L').imposto, (6000 - 1600) * 0.28, 1e-9);
    perto(r.totais.imposto, 2200 + 1232, 1e-9);
  });

  test('uma linha isenta não paga nem abate, e não tem prejuízo', () => {
    imovel({ id: 'v1', ownerIds: ['ana'] });
    imovel({ id: 'v2', name: 'PAA', ownerIds: ['ana'] });
    contrato({ id: 'C1', rent: 1000, start: '2022-01-01' });
    contrato({ id: 'I', propertyId: 'v2', rent: 300, start: '2024-01-01', fisco: { estado: 'declarado', numero: '5', finalidade: 'hp', isencao: 'paa' } });
    rendas('C1', 2025, 1000); rendas('I', 2025, 300, null, 'v2');
    mov({ kind: 'expense', category: 'Manutenção e reparações', amount: 9000, propertyId: 'v2', date: '2025-05-05' });
    const r = app.resumoFiscal(2025, 'ana');
    const i = linha(r, 'I');
    assert.ok(i.isencao, 'isento (PAA)');
    assert.equal(i.imposto, 0);
    assert.equal(i.prejuizo, 0);
    perto(linha(r, 'C1').imposto, 12000 * 0.25, 1e-9, 'o isento não abate ao outro');
    assert.equal(r.totais.prejuizo, 0);
  });
});

describe('D77 — cada linha leva o n.º do campo do seu quadro', () => {
  test('4001, 4002 no 4.1 e 4501, 4502 no 4.2, pela ordem final das linhas', () => {
    imovel({ id: 'v1', name: 'A casa' });
    imovel({ id: 'v2', name: 'B casa' });
    contrato({ id: 'S1', propertyId: 'v1', start: '2024-01-01' });
    contrato({ id: 'S2', propertyId: 'v2', start: '2024-01-01' });
    contrato({ id: 'R1', propertyId: 'v1', tenantIds: ['t2'], start: '2024-01-01', end: '2033-12-31' });
    contrato({ id: 'R2', propertyId: 'v2', tenantIds: ['t2'], start: '2024-01-01', end: '2033-12-31' });
    ['S1', 'S2', 'R1', 'R2'].forEach((id) => rendas(id, 2025, 500, null, id.endsWith('1') ? 'v1' : 'v2'));
    const r = app.resumoFiscal(2025, 'ana');
    assert.deepEqual(json(r.linhas.map((l) => [l.quadro, l.contratoId, l.campo])),
      [['4.1', 'S1', '4001'], ['4.1', 'S2', '4002'], ['4.2', 'R1', '4501'], ['4.2', 'R2', '4502']]);
  });
});

describe('D61 e os gastos — o que está «a confirmar» não conta, e fica listado', () => {
  test('uma despesa em «Seguros» (a confirmar pelo mapa) fica fora das colunas, em aConfirmar', () => {
    imovel();
    contrato();
    rendas('C1', 2026, 1000);
    const t = mov({ kind: 'expense', category: 'Seguros', label: 'Seguro anual', amount: 240, date: '2026-02-01' });
    mov({ kind: 'expense', category: 'Outros', amount: 90, date: '2026-03-01' });
    const r = app.resumoFiscal(2026, 'ana');
    const l = linha(r, 'C1');
    perto(Object.keys(l.gastos).reduce((s, k) => s + l.gastos[k], 0), 0, 1e-9, 'nada conta');
    assert.ok(Object.keys(l.gastos).every((k) => Number.isFinite(l.gastos[k])), 'nenhuma coluna estranha nas linhas');
    assert.equal(r.aConfirmar.length, 2);
    assert.deepEqual(json(r.aConfirmar[0]), { txId: t.id, nome: 'Seguro anual', data: '2026-02-01', valor: 240, propertyId: 'v1',
      imovel: 'T2 Arroios', categoria: 'Seguros', sub: '', origem: 'categoria' });
    assert.equal(r.aConfirmar[1].nome, 'Outros');
    assert.equal(r.semRegra, 0, 'o semRegra conta só as sem regra nenhuma');
    perto(l.liquido, 12000, 1e-9);
    // escolhida a coluna na despesa, conta
    t.irsCol = 'outros';
    const r2 = app.resumoFiscal(2026, 'ana');
    assert.equal(r2.aConfirmar.length, 1);
    perto(linha(r2, 'C1').gastos.outros, 240, 1e-9);
  });

  test('só as do ano e dos imóveis com linha; um valor que o mapa não conhece também fica a confirmar', () => {
    imovel();
    imovel({ id: 'v9', name: 'Sem rendas' });
    contrato();
    rendas('C1', 2026, 1000);
    mov({ kind: 'expense', category: 'Seguros', amount: 100, date: '2025-12-31' });
    mov({ kind: 'expense', category: 'Seguros', amount: 100, propertyId: 'v9', date: '2026-02-01' });
    assert.equal(app.resumoFiscal(2026, 'ana').aConfirmar.length, 0);
    app.db.settings.irsMapa = Object.assign({}, app.db.settings.irsMapa, { 'Coisas': 'coluna-de-outro-ano' });
    mov({ kind: 'expense', category: 'Coisas', amount: 30, date: '2026-04-01' });
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.aConfirmar.length, 1);
    assert.equal(r.aConfirmar[0].categoria, 'Coisas');
  });

  test('uma despesa de grupo a confirmar diz os imóveis da declaração que toca', () => {
    imovel();
    imovel({ id: 'v2', name: 'T1 Benfica' });
    contrato();
    contrato({ id: 'C2', propertyId: 'v2', tenantIds: ['t2'] });
    rendas('C1', 2026, 1000); rendas('C2', 2026, 500, null, 'v2');
    app.db.groups.push(app.normGroup({ id: 'G', name: 'Lisboa', kind: 'prop', ids: ['v1', 'v2'] }));
    mov({ kind: 'expense', category: 'Seguros', amount: 300, propertyId: null, groupId: 'G', date: '2026-05-01' });
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.aConfirmar.length, 1, 'uma vez, não uma por imóvel');
    assert.equal(r.aConfirmar[0].propertyId, null);
    assert.equal(r.aConfirmar[0].imovel, 'T2 Arroios, T1 Benfica');
  });
});
