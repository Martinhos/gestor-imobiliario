// O resumo do Anexo F (fisco-resumo.js:resumoFiscal) dos contratos no tempo —
// vaga 2 do IRS, folha 2.2.8 (KAN-127): a comunicação por período (D01, D35),
// a cessação à parte do termo nos gastos (D02, D39, D42), o quadro 10 (D09),
// a regularização do n.º 20 pela duração decorrida (D10), as taxas por troço
// com as rendas depois do termo e a renovação a meio do ano (D15, D41), o
// 4.2B pelo facto do n.º 24 (D36, D37), o quadro 8 com as retenções de cada
// ano (D55), os anos sem regras (D50), a atualização de 2023 (D76), a
// cobertura dos meses (D04) e o prejuízo dos anos anteriores (D73).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, perto, repor } from './arnes.js';

// um dia depois de todos os anos dos cenários, na época da entrega de 2026
const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

const json = (x) => JSON.parse(JSON.stringify(x));
const mov = (a, extra) => {
  const t = a.normTx(Object.assign({ propertyId: 'v1', date: '2026-03-05' }, extra));
  a.db.transactions.push(t);
  return t;
};
const imovel = (a, extra) => {
  const p = a.normProp(Object.assign({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }, extra || {}));
  a.db.properties.push(p);
  return p;
};
const contrato = (a, extra) => {
  const c = a.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'v1', tenantIds: ['t1'], rent: 1000,
    start: '2025-01-01', active: true, fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }, extra || {}));
  a.db.contracts.push(c);
  return c;
};
/* as rendas de um contrato nos meses dados (todos, sem a lista), no dia 5, com o mês a que respeitam */
const rendas = (a, cid, ano, valor, meses, pid, extra) => (meses || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).forEach((m) => {
  const mm = String(m).padStart(2, '0');
  mov(a, Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: cid, propertyId: pid || 'v1',
    date: `${ano}-${mm}-05`, periodo: `${ano}-${mm}`, recibo: true }, extra || {}));
});
const condominio = (a, ano, meses, valor) => (meses || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).forEach((m) =>
  mov(a, { kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: valor || 50, date: `${ano}-${String(m).padStart(2, '0')}-10` }));
const linha = (r, id) => r.linhas.find((l) => l.contratoId === id);
const base = (a) => {
  limpar(a);
  a.db.owners.push(a.normPerson({ id: 'ana', name: 'Ana' }), a.normPerson({ id: 'bruno', name: 'Bruno' }));
  a.db.tenants.push(a.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), a.normPerson({ id: 't2', name: 'Vera', nif: '123456789' }));
};

beforeEach(() => base(app));

describe('D01, D35 — a comunicação da duração é a do período, com a data e o prazo', () => {
  test('comunicada a tempo em 2025 (pela chave do início, 2024): vale para 2025 e 2026', () => {
    imovel(app);
    contrato(app, { start: '2024-03-01', end: '2029-02-28',
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', comunicacoes: { 2024: '2025-02-10' }, comunicacoesV: 2 } });
    rendas(app, 'C1', 2025, 1000); rendas(app, 'C1', 2026, 1000);
    for (const ano of [2025, 2026]) {
      const l = linha(app.resumoFiscal(ano, 'ana'), 'C1');
      assert.equal(l.quadro, '4.2');
      assert.equal(l.comunicado, '2025-02-10', 'a de um período conta em todos os anos dele');
      assert.deepEqual(json(l.comunicacao), { periodoInicio: '2024-03-01', chave: '2024', prazo: '2025-02-15', data: '2025-02-10', foraDePrazo: false });
    }
  });

  test('comunicada depois de 15 de fevereiro: foraDePrazo (no 4.2A é NÃO)', () => {
    imovel(app);
    contrato(app, { start: '2024-03-01', end: '2029-02-28',
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', comunicacoes: { 2024: '2025-03-20' }, comunicacoesV: 2 } });
    rendas(app, 'C1', 2025, 1000);
    const c = linha(app.resumoFiscal(2025, 'ana'), 'C1').comunicacao;
    assert.equal(c.data, '2025-03-20');
    assert.equal(c.foraDePrazo, true);
  });

  test('sem redução não há comunicação a fazer (null)', () => {
    imovel(app);
    contrato(app, { start: '2025-01-01', end: '2026-12-31', rent: 2500 });
    rendas(app, 'C1', 2025, 2500);
    const l = linha(app.resumoFiscal(2025, 'ana'), 'C1');
    assert.equal(l.quadro, '4.1');
    assert.equal(l.comunicacao, null);
  });
});

describe('D02, D39, D42 — os gastos contam até ao dia em que o contrato acabou, nunca até ao termo', () => {
  test('sem termo, terminado com a cessação a 31/03/2026: o condomínio de janeiro a março conta, o resto fica fora', () => {
    imovel(app);
    contrato(app, { start: '2025-01-01', end: '', active: false,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', cessacao: { data: '2026-03-31', motivo: '02' } } });
    rendas(app, 'C1', 2026, 1000, [1, 2, 3]);
    condominio(app, 2026);
    const r = app.resumoFiscal(2026, 'ana');
    perto(linha(r, 'C1').gastos.condominio, 150, 1e-9);
    assert.equal(r.foraDoPeriodo, 9);
    assert.equal(app.fiscoHaviaContrato('v1', '2026-03-31'), true);
    assert.equal(app.fiscoHaviaContrato('v1', '2026-04-01'), false);
  });

  test('com o termo em 2029 e a cessação a 31/05/2026: o termo fica para a taxa, a cessação manda nos gastos', () => {
    imovel(app);
    const c = contrato(app, { start: '2024-01-01', end: '2028-12-31', active: false,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', cessacao: { data: '2026-05-31', motivo: '02' } } });
    rendas(app, 'C1', 2025, 1000); rendas(app, 'C1', 2026, 1000, [1, 2, 3, 4, 5]);
    condominio(app, 2026);
    assert.equal(c.end, '2028-12-31', 'o termo não muda');
    const r25 = app.resumoFiscal(2025, 'ana');
    assert.equal(linha(r25, 'C1').quadro, '4.2', 'o escalão de 2025 é o do termo (5 anos), não o da duração vivida');
    assert.equal(linha(r25, 'C1').taxa, 15);
    const r = app.resumoFiscal(2026, 'ana');
    perto(linha(r, 'C1').gastos.condominio, 250, 1e-9);
    assert.equal(r.foraDoPeriodo, 7);
  });

  test('um terminado sem data nenhuma não diz quando acabou: não se adivinha', () => {
    imovel(app);
    contrato(app, { start: '2025-01-01', end: '', active: false });
    assert.equal(app.fiscoHaviaContrato('v1', '2026-03-01'), false);
  });

  test('uma renovação escrita no bloco que passa o fim leva os gastos com ela', () => {
    imovel(app);
    const c = contrato(app, { start: '2021-01-01', end: '2025-12-31',
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', renovacoes: [{ inicio: '2026-01-01', fim: '2028-12-31' }] } });
    c.end = '2025-12-31';   // gravado assim antes da normalização (D42)
    rendas(app, 'C1', 2026, 1000, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    condominio(app, 2026, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const r = app.resumoFiscal(2026, 'ana');
    perto(linha(r, 'C1').gastos.condominio, 550, 1e-9);
    assert.equal(r.foraDoPeriodo, 0);
  });
});

describe('D15, D41 — cada renda paga a taxa do troço do mês a que respeita', () => {
  test('rendas depois do termo sem a renovação registada: à taxa base, no 4.1, com o troço dito e os gastos do período', () => {
    imovel(app);
    contrato(app, { start: '2021-01-01', end: '2025-12-31', rent: 2500,
      fisco: { estado: 'declarado', numero: '1', finalidade: 'hp', celebracao: '2020-12-15' } });
    rendas(app, 'C1', 2026, 2500, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    condominio(app, 2026, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const r = app.resumoFiscal(2026, 'ana'), l = linha(r, 'C1');
    assert.equal(l.quadro, '4.1');
    assert.equal(l.taxa, 25);
    assert.equal(l.motivoTaxa, 'base');
    assert.equal(l.segmentos.length, 1);
    assert.equal(l.segmentos[0].semRenovacao, true);
    perto(l.segmentos[0].rendas, 27500, 1e-9);
    perto(l.gastos.condominio, 550, 1e-9, 'o contrato continua em vigor: os gastos são do período arrendado');
    assert.equal(r.foraDoPeriodo, 0);
  });

  test('renovado a meio do ano (23 % e depois 15 %): o imposto reparte-se, a taxa mostrada é a do último troço', () => {
    imovel(app);
    contrato(app, { start: '2020-07-01', end: '2030-06-30', rent: 2500,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', renovacoes: [{ inicio: '2025-07-01', fim: '2030-06-30' }] } });
    rendas(app, 'C1', 2025, 2500);
    const l = linha(app.resumoFiscal(2025, 'ana'), 'C1');
    assert.equal(l.quadro, '4.2');
    assert.equal(l.taxa, 15);
    perto(l.imposto, 15000 * 0.23 + 15000 * 0.15, 1e-9);
    assert.deepEqual(json(l.segmentos.map((s) => [s.de, s.ate, s.taxa, s.rendas, s.imposto, s.reducao, s.semRenovacao])),
      [['2025-01-01', '2025-06-30', 23, 15000, 3450, true, false], ['2025-07-01', '2025-12-31', 15, 15000, 2250, true, false]]);
    perto(l.segmentos.reduce((s, x) => s + x.imposto, 0), l.imposto, 1e-9, 'o imposto da linha é a soma dos troços');
  });

  test('renovado a meio do ano para um período sem redução: fica no 4.2 (o 4.2A diz as datas), 3 meses a 23 % e 9 a 25 %', () => {
    imovel(app);
    contrato(app, { start: '2020-04-01', end: '2028-03-31', rent: 2500,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', renovacoes: [{ inicio: '2025-04-01', fim: '2028-03-31' }] } });
    rendas(app, 'C1', 2025, 2500);
    const l = linha(app.resumoFiscal(2025, 'ana'), 'C1');
    assert.equal(l.quadro, '4.2');
    assert.equal(l.taxa, 25);
    perto(l.imposto, 7500 * 0.23 + 22500 * 0.25, 1e-9);
  });

  test('a renda de dezembro paga em janeiro vai ao troço do mesmo período, e um ano de troço só não tem segmentos', () => {
    imovel(app);
    contrato(app, { start: '2024-03-01', end: '2029-02-28',
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } });
    rendas(app, 'C1', 2025, 1000);
    mov(app, { kind: 'income', category: 'Rendas', amount: 1000, contractId: 'C1', date: '2025-01-08', periodo: '2024-12', recibo: true });
    const l = linha(app.resumoFiscal(2025, 'ana'), 'C1');
    assert.equal(l.segmentos, null);
    assert.equal(l.taxa, 15);
    perto(l.imposto, 13000 * 0.15, 1e-9);
  });
});

describe('D36, D37 — o 4.2B pelo facto do n.º 24, à parte da descida da taxa', () => {
  test('20 anos com a renda 10 % abaixo da anterior: elegível, mas a taxa não desce do mínimo', () => {
    imovel(app);
    contrato(app, { id: 'A0', name: 'A0', start: '2019-06-01', end: '2024-05-31', active: false, rent: 1000,
      fisco: { estado: 'declarado', numero: '100', finalidade: 'hp' } });
    contrato(app, { start: '2024-06-01', end: '2044-05-31', rent: 900,
      fisco: { estado: 'declarado', numero: '200', finalidade: 'hp', celebracao: '2024-05-20', rendaAnterior: 1000 } });
    rendas(app, 'C1', 2025, 900);
    const l = linha(app.resumoFiscal(2025, 'ana'), 'C1');
    assert.equal(l.elegivel24, true, 'o 4.2B mostra-se');
    assert.equal(l.bonus, false, 'a estimativa fica no mínimo');
    assert.equal(l.taxa, 5);
  });

  test('celebrado a 15/11/2023 (depois de 7/10/2023): elegível, e a taxa desce os 5 pontos', () => {
    imovel(app);
    contrato(app, { start: '2023-12-01', end: '2028-11-30', rent: 900,
      fisco: { estado: 'declarado', numero: '200', finalidade: 'hp', celebracao: '2023-11-15', rendaAnterior: 1000 } });
    rendas(app, 'C1', 2025, 900);
    const l = linha(app.resumoFiscal(2025, 'ana'), 'C1');
    assert.equal(l.elegivel24, true);
    assert.equal(l.bonus, true);
    assert.equal(l.taxa, 10);
  });

  test('sem a renda anterior não é elegível', () => {
    imovel(app);
    contrato(app, { start: '2024-03-01', end: '2029-02-28', fisco: { estado: 'declarado', numero: '200', finalidade: 'hp' } });
    rendas(app, 'C1', 2025, 1000);
    assert.equal(linha(app.resumoFiscal(2025, 'ana'), 'C1').elegivel24, false);
  });
});

describe('D55 — as rendas de anos anteriores levam as retenções de cada ano', () => {
  test('uma renda de 2024 recebida em 2026, com 250 € retidos', () => {
    imovel(app);
    contrato(app, { start: '2024-01-01' });
    rendas(app, 'C1', 2026, 1000, [1, 2, 3]);
    mov(app, { kind: 'income', category: 'Rendas', amount: 750, retencao: 250, contractId: 'C1', date: '2026-04-10', periodo: '2024-05', recibo: true });
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.deepEqual(json(l.anosAnteriores), [{ ano: 2024, valor: 1000, retencoes: 250 }]);
    perto(l.retencoes, 250, 1e-9, 'e continuam nas retenções da linha');
  });
});

describe('D50 — antes da primeira versão das regras, o resumo di-lo', () => {
  test('2024 não tem regras; 2025 e 2026 sim', () => {
    imovel(app);
    contrato(app, { start: '2024-01-01' });
    rendas(app, 'C1', 2024, 1000);
    assert.equal(app.resumoFiscal(2024, 'ana').semRegrasDoAno, true);
    assert.equal(app.resumoFiscal(2025, 'ana').semRegrasDoAno, false);
    assert.equal(app.resumoFiscal(2026, 'ana').semRegrasDoAno, false);
  });
});

describe('D76 — a atualização de 2023 nos contratos começados antes de 2022', () => {
  test('por responder, respondida, e null nos que começaram em 2022 ou depois', () => {
    imovel(app);
    imovel(app, { id: 'v2', name: 'B' });
    imovel(app, { id: 'v3', name: 'C' });
    contrato(app, { start: '2021-03-01' });
    contrato(app, { id: 'C2', propertyId: 'v2', start: '2020-01-01', fisco: { estado: 'declarado', numero: '2', finalidade: 'hp', atualizacao2023: 'sim' } });
    contrato(app, { id: 'C3', propertyId: 'v3', start: '2022-01-01' });
    rendas(app, 'C1', 2025, 1000); rendas(app, 'C2', 2025, 1000, null, 'v2'); rendas(app, 'C3', 2025, 1000, null, 'v3');
    const r = app.resumoFiscal(2025, 'ana');
    assert.equal(linha(r, 'C1').atualizacao2023, '');
    assert.equal(linha(r, 'C2').atualizacao2023, 'sim');
    assert.equal(linha(r, 'C3').atualizacao2023, null);
  });
});

describe('D09 — os contratos com benefício que acabaram no ano (quadro 10)', () => {
  test('cessado a 31/08/2025 por motivo do inquilino: regime, n.º, ano de início do benefício, data e motivo', () => {
    imovel(app);
    contrato(app, { start: '2024-01-01', end: '2028-12-31', active: false,
      fisco: { estado: 'declarado', numero: '114', finalidade: 'hp', celebracao: '2023-12-15', cessacao: { data: '2025-08-31', motivo: '02' } } });
    rendas(app, 'C1', 2024, 1000); rendas(app, 'C1', 2025, 1000, [1, 2, 3, 4, 5, 6, 7, 8]);
    const r = app.resumoFiscal(2025, 'ana');
    assert.deepEqual(json(r.cessados), [{ contratoId: 'C1', nome: 'C1', imovel: 'T2 Arroios', regime: app.irsRegimeQuadro10(app.contract('C1'), 2025),
      numero: '114', anoInicioBeneficio: 2024, data: '2025-08-31', motivo: '02' }]);
    assert.equal(r.cessados[0].regime, '02', 'o n.º 3 do art. 72.º (5 a 10 anos) é o código 02');
    assert.deepEqual(json(app.resumoFiscal(2024, 'ana').cessados), [], 'no ano antes não');
  });

  test('um terminado antigo sem a cessação, com o fim no ano, vai com o motivo por dizer; um sem benefício não vai', () => {
    imovel(app);
    imovel(app, { id: 'v2', name: 'Loja' });
    contrato(app, { start: '2020-01-01', end: '2025-06-30', active: false, fisco: { estado: 'declarado', numero: '9', finalidade: 'hp' } });
    contrato(app, { id: 'C2', propertyId: 'v2', start: '2024-01-01', end: '2028-12-31', active: false,
      fisco: { estado: 'declarado', numero: '8', finalidade: 'nh', cessacao: { data: '2025-03-31', motivo: '02' } } });
    rendas(app, 'C1', 2025, 1000, [1, 2, 3, 4, 5, 6]);
    rendas(app, 'C2', 2025, 500, [1, 2, 3], 'v2');
    const r = app.resumoFiscal(2025, 'ana');
    assert.deepEqual(json(r.cessados.map((x) => [x.contratoId, x.data, x.motivo])), [['C1', '2025-06-30', '']]);
  });
});

describe('D10 — a regularização do n.º 20: a taxa da duração decorrida, só no período em que acabou', () => {
  const dez = (motivo) => {
    imovel(app);
    contrato(app, { start: '2024-01-01', end: '2033-12-31', rent: 2500, active: false,
      fisco: { estado: 'declarado', numero: '555', finalidade: 'hp', celebracao: '2023-12-10', rendaAcimaDoLimite: false,
        cessacao: { data: '2026-06-30', motivo } } });
    rendas(app, 'C1', 2024, 2500); rendas(app, 'C1', 2025, 2500); rendas(app, 'C1', 2026, 2500, [1, 2, 3, 4, 5, 6]);
  };

  test('10 anos (10 %) acabados ao fim de 30 meses por motivo do senhorio: 2024 e 2025 estimam-se em 2026; as rendas de 2026 já a 25 %', () => {
    dez('01');
    const dec = app.irsTaxaDecorrida(app.contract('C1'));
    assert.equal(dec.taxa, 25, '30 meses não chegam a escalão nenhum: a taxa base');
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.regularizacoes), [{ contratoId: 'C1', nome: 'C1', anos: [{ ano: 2024, diferenca: 4500 }, { ano: 2025, diferenca: 4500 }], total: 9000 }]);
    perto(r.totais.regularizacao, 9000, 1e-9);
    const l = linha(r, 'C1');
    assert.equal(l.quadro, '4.2', 'a linha fica no 4.2: o 4.2A e o quadro 10 dizem-no à AT');
    assert.equal(l.taxa, 25);
    perto(l.imposto, 3750, 1e-9);
    assert.equal(l.segmentos[0].regulariza, true);
    assert.equal(l.segmentos[0].taxaAntes, 10);
    perto(r.totais.imposto, 3750, 1e-9, 'a regularização fica à parte do imposto do ano');
    // os anos já entregues não se reescrevem
    assert.equal(linha(app.resumoFiscal(2025, 'ana'), 'C1').taxa, 10);
    perto(linha(app.resumoFiscal(2025, 'ana'), 'C1').imposto, 3000, 1e-9);
  });

  test('por motivo do inquilino nada se regulariza', () => {
    dez('02');
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.regularizacoes), []);
    assert.equal(r.totais.regularizacao, 0);
    assert.equal(linha(r, 'C1').taxa, 10);
    assert.equal(linha(r, 'C1').segmentos, null);
  });

  test('acabado na renovação: só os anos da renovação, os do contrato inicial ficam', () => {
    imovel(app);
    contrato(app, { start: '2020-01-01', end: '2029-12-31', rent: 1000, active: false,
      fisco: { estado: 'declarado', numero: '7', finalidade: 'hp', renovacoes: [{ inicio: '2025-01-01', fim: '2029-12-31' }],
        cessacao: { data: '2026-06-30', motivo: '01' } } });
    rendas(app, 'C1', 2024, 1000); rendas(app, 'C1', 2025, 1000); rendas(app, 'C1', 2026, 1000, [1, 2, 3, 4, 5, 6]);
    const t25 = linha(app.resumoFiscal(2025, 'ana'), 'C1').taxa;
    assert.ok(t25 < 25, 'a renovação de 5 anos tinha redução em 2025');
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.regularizacoes[0].anos.map((a) => a.ano)), [2025], '2024 é do contrato inicial, cumprido: não se toca');
    perto(r.regularizacoes[0].total, 12000 * (25 - t25) / 100, 1e-9);
  });

  test('sem extras (o que os anos seguintes leem) não há regularização nem reporte', () => {
    dez('01');
    const r = app.resumoFiscal(2026, 'ana', { semExtras: true });
    assert.deepEqual(json(r.regularizacoes), []);
    assert.equal(r.reporte, null);
    assert.deepEqual(json(r.avisos), []);
  });
});

describe('D73 — o prejuízo dos anos anteriores abate ao imposto estimado, titular a titular', () => {
  const s2 = () => {
    imovel(app);
    contrato(app, { start: '2024-01-01', rent: 2400, fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } });
    rendas(app, 'C1', 2025, 800);
    rendas(app, 'C1', 2026, 2400);
    mov(app, { kind: 'expense', category: 'Manutenção e reparações', sub: 'Telhado', amount: 15000, date: '2025-06-10' });
  };

  test('5 400 € de 2025 abatem aos 28 800 € de 2026: imposto 7 200 → 5 850; os totais dos quadros não mudam', () => {
    s2();
    const r25 = app.resumoFiscal(2025, 'ana');
    perto(r25.totais.prejuizo, 5400, 1e-9);
    const r = app.resumoFiscal(2026, 'ana');
    perto(r.totais.imposto, 7200, 1e-9, 'totais.imposto continua a soma das linhas');
    assert.deepEqual(json(r.reporte), {
      porTitular: { ana: { anos: [{ ano: 2025, prejuizo: 5400, usado: 5400 }], usado: 5400, resto: 0, imposto: 1350 } },
      usado: 5400, imposto: 1350, anosSemDados: [2020, 2021, 2022, 2023] });
    perto(r.totais.impostoDepoisDoReporte, 5850, 1e-9);
  });

  test('o mais antigo primeiro, e só seis anos para trás', () => {
    imovel(app);
    contrato(app, { start: '2019-01-01', rent: 1000, fisco: { estado: 'declarado', numero: '111', finalidade: 'nh' } });
    rendas(app, 'C1', 2019, 100); rendas(app, 'C1', 2020, 100); rendas(app, 'C1', 2021, 1000); rendas(app, 'C1', 2026, 1000);
    mov(app, { kind: 'expense', category: 'Manutenção e reparações', amount: 3200, date: '2019-06-10' });   // 2019: −2 000
    mov(app, { kind: 'expense', category: 'Manutenção e reparações', amount: 4200, date: '2020-06-10' });   // 2020: −3 000
    mov(app, { kind: 'expense', category: 'Manutenção e reparações', amount: 11000, date: '2021-06-10' });  // 2021: +1 000
    const r = app.resumoFiscal(2026, 'ana');
    // 2021 consome 1 000 do de 2019 (que expira em 2025); o de 2020 (3 000) é o único que chega a 2026
    assert.deepEqual(json(r.reporte.porTitular.ana.anos), [{ ano: 2020, prejuizo: 3000, usado: 3000 }]);
    perto(r.reporte.imposto, 3000 * 0.28, 1e-9);
    assert.equal(r.reporte.porTitular.ana.resto, 0);
  });

  test('um ano negativo não usa nada, e o que sobra fica para os seguintes', () => {
    imovel(app);
    contrato(app, { start: '2024-01-01', rent: 1000 });
    rendas(app, 'C1', 2025, 100); rendas(app, 'C1', 2026, 100);
    mov(app, { kind: 'expense', category: 'Manutenção e reparações', amount: 2200, date: '2025-06-10' });   // 2025: −1 000
    mov(app, { kind: 'expense', category: 'Manutenção e reparações', amount: 1700, date: '2026-06-10' });   // 2026: −500
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.reporte.porTitular.ana), { anos: [{ ano: 2025, prejuizo: 1000, usado: 0 }], usado: 0, resto: 1000, imposto: 0 });
    assert.equal(r.totais.impostoDepoisDoReporte, 0);
  });

  test('conjunta: o prejuízo do B não abate ao A', () => {
    imovel(app);
    imovel(app, { id: 'v2', name: 'Loja', ownerIds: ['bruno'] });
    contrato(app, { start: '2024-01-01', rent: 1000 });
    contrato(app, { id: 'C2', propertyId: 'v2', tenantIds: ['t2'], start: '2024-01-01', rent: 300, fisco: { estado: 'declarado', numero: '2', finalidade: 'nh' } });
    rendas(app, 'C1', 2025, 1000); rendas(app, 'C2', 2025, 300, null, 'v2');
    rendas(app, 'C1', 2026, 1000); rendas(app, 'C2', 2026, 300, null, 'v2');
    mov(app, { kind: 'expense', category: 'Manutenção e reparações', amount: 10000, propertyId: 'v2', date: '2025-06-10' });   // B 2025: −6 400
    app.db.settings.irs = { conjunta: true, titulares: { bruno: 'B' }, dispensaRecibos: false, outrosRendimentos: {} };
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.reporte.porTitular.ana, undefined, 'a Ana não tem prejuízos');
    assert.deepEqual(json(r.reporte.porTitular.bruno.anos), [{ ano: 2025, prejuizo: 6400, usado: 3600 }]);
    perto(r.reporte.porTitular.bruno.resto, 2800, 1e-9);
    perto(r.reporte.imposto, 3600 * 0.28, 1e-9);
    perto(r.totais.impostoDepoisDoReporte, r.totais.imposto - 3600 * 0.28, 1e-9, 'só o imposto do Bruno desce');
    perto(r.totais.porTitular.ana.imposto, linha(r, 'C1').imposto, 1e-9);
  });

  test('sem prejuízos: nada a abater, e os anos sem dados ditos', () => {
    imovel(app);
    contrato(app, { start: '2025-01-01' });
    rendas(app, 'C1', 2026, 1000);
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.reporte), { porTitular: {}, usado: 0, imposto: 0, anosSemDados: [2020, 2021, 2022, 2023, 2024] });
    assert.equal(r.totais.impostoDepoisDoReporte, r.totais.imposto);
  });
});

describe('D04 — a cobertura dos meses de cada contrato, e os contratos vivos sem renda', () => {
  const app26 = carregarApp({ hoje: '2026-11-13' });
  afterEach(() => repor(app26));
  beforeEach(() => base(app26));

  test('em vigor o ano inteiro com só set–nov registadas: 11 meses e 3 rendas; o vivo sem renda nenhuma aparece', () => {
    imovel(app26);
    imovel(app26, { id: 'v2', name: 'T1 Benfica' });
    contrato(app26, { start: '2024-01-01', rent: 800 });
    contrato(app26, { id: 'C2', name: 'Benfica', propertyId: 'v2', tenantIds: ['t2'], start: '2025-06-01', rent: 600 });
    rendas(app26, 'C1', 2026, 800, [9, 10, 11]);
    const r = app26.resumoFiscal(2026, 'ana'), l = linha(r, 'C1');
    assert.equal(l.mesesEmVigor, 11, 'até hoje (13/11)');
    assert.equal(l.mesesComRenda, 3);
    assert.deepEqual(json(r.contratosSemRendas), [{ contratoId: 'C2', nome: 'Benfica', imovel: 'T1 Benfica', propertyId: 'v2', mesesEmVigor: 11, mesesComRenda: 0 }]);
  });

  test('pelo mês a que respeitam: a de dezembro de 2025 paga em janeiro conta em 2025; a cessação e a compra cortam os meses', () => {
    imovel(app26, { purchaseDate: '2025-03-15' });
    contrato(app26, { start: '2024-01-01', active: false, fisco: { estado: 'declarado', numero: '1', finalidade: 'hp', cessacao: { data: '2026-04-30', motivo: '02' } } });
    rendas(app26, 'C1', 2025, 1000, [3, 4, 5, 6, 7, 8, 9, 10, 11]);
    mov(app26, { kind: 'income', category: 'Rendas', amount: 1000, contractId: 'C1', date: '2026-01-08', periodo: '2025-12', recibo: true });
    rendas(app26, 'C1', 2026, 1000, [1, 2]);
    const l25 = linha(app26.resumoFiscal(2025, 'ana'), 'C1');
    assert.equal(l25.mesesEmVigor, 10, 'de março (a compra) a dezembro');
    assert.equal(l25.mesesComRenda, 10, 'a de dezembro, paga em janeiro, conta');
    const l26 = linha(app26.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(l26.mesesEmVigor, 4, 'até à cessação, 30/04');
    assert.equal(l26.mesesComRenda, 2);
  });

  test('um não declarado e um que acabou antes do ano não entram nos sem renda; um terminado sem data não se conta', () => {
    imovel(app26);
    imovel(app26, { id: 'v2', name: 'B' });
    imovel(app26, { id: 'v3', name: 'C' });
    contrato(app26, { start: '2024-01-01', fisco: { estado: 'naoDeclarado' } });
    contrato(app26, { id: 'C2', propertyId: 'v2', start: '2023-01-01', active: false, fisco: { estado: 'declarado', numero: '2', finalidade: 'hp', cessacao: { data: '2025-12-31', motivo: '03' } } });
    contrato(app26, { id: 'C3', propertyId: 'v3', start: '2023-01-01', end: '', active: false });
    rendas(app26, 'C3', 2026, 1000, [1], 'v3');
    const r = app26.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.contratosSemRendas), []);
    assert.equal(linha(r, 'C3').mesesEmVigor, null);
    assert.equal(linha(r, 'C3').mesesComRenda, 1);
  });
});

describe('as quotas na data (com a 2.2.7): por inteiro, a meio do ano e o VPT do AIMI', () => {
  test('sem saber quem és, os donos fora da app abatem: a casa a 50 % com um irmão fora', () => {
    imovel(app, { ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, comproprietariosFora: [{ id: 'f1', nome: 'Irmão', quota: 50 }] });
    contrato(app, { start: '2025-01-01' });
    rendas(app, 'C1', 2026, 1000);
    const r = app.resumoFiscal(2026, '');
    perto(linha(r, 'C1').quota, 0.5, 1e-9);
    perto(r.totais.rendas, 6000, 1e-9);
  });

  test('as quotas mudam a 1/7: cada renda pela do seu dia, e a linha diz as duas', () => {
    imovel(app, { ownerIds: ['ana', 'bruno'], ownerShares: { ana: 75, bruno: 25 }, comproprietariosFora: [],
      quotasHist: [{ ate: '2026-06-30', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, fora: [] }] });
    contrato(app, { start: '2025-01-01' });
    rendas(app, 'C1', 2026, 1000);
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    perto(l.rendas, 6 * 500 + 6 * 750, 1e-9);
    assert.deepEqual(json(l.quotas), [{ desde: '2026-01-01', quota: 0.5 }, { desde: '2026-07-01', quota: 0.75 }]);
    assert.equal(linha(app.resumoFiscal(2025, 'ana'), 'C1'), undefined, 'sem rendas em 2025');
    rendas(app, 'C1', 2025, 1000);
    assert.equal(linha(app.resumoFiscal(2025, 'ana'), 'C1').quotas, null, 'num ano sem mudança, null');
  });

  test('o VPT do quadro 9 vai pela quota a 1 de janeiro (CIMI art. 135.º-A n.º 3)', () => {
    imovel(app, { vpt: 100000, ownerIds: ['ana', 'bruno'], ownerShares: { ana: 75, bruno: 25 }, comproprietariosFora: [],
      quotasHist: [{ ate: '2026-06-30', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, fora: [] }] });
    contrato(app, { start: '2025-01-01' });
    rendas(app, 'C1', 2026, 1000);
    mov(app, { kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, propertyId: '', date: '2026-09-10' });
    const a = app.resumoFiscal(2026, 'ana').aimi;
    perto(a.predios[0].vpt, 50000, 1e-9, 'a 1/1 a Ana tinha 50 %');
  });
});

describe('o resumo aguenta 600 rendas com seis anos de reporte', () => {
  test('mede o resumoFiscal (o Samsung é lento)', () => {
    for (let i = 1; i <= 10; i++) imovel(app, { id: 'v' + i, name: 'Casa ' + i });
    for (let i = 1; i <= 10; i++) contrato(app, { id: 'C' + i, name: 'C' + i, propertyId: 'v' + i, start: '2020-01-01' });
    for (let ano = 2021; ano <= 2026; ano++) for (let i = 1; i <= 10; i++) rendas(app, 'C' + i, ano, 1000, i % 2 ? null : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'v' + i);
    for (let ano = 2021; ano <= 2026; ano++) for (let i = 1; i <= 10; i++) mov(app, { kind: 'expense', category: 'Manutenção e reparações', amount: ano < 2024 ? 20000 : 500, propertyId: 'v' + i, date: `${ano}-06-10` });
    const n = app.db.transactions.filter((t) => t.kind === 'income').length;
    assert.ok(n >= 600, n + ' rendas');
    const t0 = performance.now();
    const r = app.resumoFiscal(2026, 'ana');
    const ms = performance.now() - t0;
    console.log(`# resumoFiscal(2026) com ${n} rendas e ${app.db.transactions.length} movimentos: ${Math.round(ms)} ms`);
    assert.ok(r.reporte.usado > 0);
    assert.ok(ms < 3000, 'em menos de 3 s na máquina dos testes');
  });
});
