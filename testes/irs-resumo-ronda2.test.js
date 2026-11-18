// O resumo do Anexo F (fisco-resumo.js:resumoFiscal) na ronda 2 do IRS — vaga 4,
// folha 2.4.4 (KAN-129): o quadro 4.3 do direito real de habitação duradoura, com a
// caução inicial que não é rendimento e a regularização da cessação por acordo
// (D120); os benefícios do quadro 6 na linha — o 6A dos imóveis reabilitados (D117),
// o 6B das Lojas com História com as obras a 110 % (D121) e o 6C dos rústicos
// arrendados a uma entidade de gestão florestal com as rendas a 50 % (D119); o
// imóvel fora de Portugal no Anexo J (D133) e as rendas da categoria B (D134) fora
// do Anexo F; as rendas recebidas antes do início do contrato (D130); as rendas
// abaixo da do contrato com o recibo emitido (D115); as retenções de inquilinos
// particulares (D116); as despesas do Splitwise cortadas pela quota (D122); o código
// da freguesia fora do formato (D136) e a união extinta em 2025 (D135).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, perto, repor } from './arnes.js';

// na época da entrega das rendas de 2026
const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

/* as listas vêm do contexto da app (outro realm): comparam-se pelo JSON */
const igual = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const mm = (m) => String(m).padStart(2, '0');
const M12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
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
const contrato = (extra, fisco) => {
  const c = app.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'v1', tenantIds: ['t1'], rent: 1000,
    start: '2026-01-01', active: true }, extra || {}, { fisco: Object.assign({ estado: 'declarado', numero: '1234567', finalidade: 'hp' }, fisco || {}) }));
  app.db.contracts.push(c);
  return c;
};
/* as rendas de um contrato nos meses dados (todos, sem a lista), no dia 5 */
const rendas = (valor, meses, extra, ano) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1',
    date: `${ano || 2026}-${mm(m)}-05`, recibo: true }, extra || {})));
const resumo = (ano) => app.resumoFiscal(ano || 2026, 'ana');
const linhaDe = (r, papel) => r.linhas.find((l) => l.contratoId === 'C1' && (l.papel || 'renda') === (papel || 'renda'));

beforeEach(() => {
  limpar(app);
  app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('D120 — o direito real de habitação duradoura vai ao quadro 4.3, a 5 %', () => {
  test('a prestação mensal: quadro 4.3, natureza 01, campo 4901, 5 %, a escritura e a caução', () => {
    imovel(); contrato({ rent: 500, deposit: 20000 }, { finalidade: 'dhd' });
    rendas(500);
    const r = resumo(), l = linhaDe(r);
    assert.equal(l.quadro, '4.3');
    assert.equal(l.natureza, '01');
    assert.equal(l.campo, '4901');
    assert.equal(l.taxa, 5);
    assert.equal(l.motivoTaxa, 'dhd');
    perto(l.imposto, 6000 * 0.05, 1e-9);
    assert.equal(l.dhd.escritura, '2026-01-01');
    assert.equal(l.dhd.caucao, 20000);
    assert.equal(l.dhd.cessacao, null);
    assert.ok(!l.faltas.some((f) => f.startsWith('valor da caução')));
  });

  test('a caução inicial não é rendimento (CIRS art. 8.º n.º 5 b)): fica fora das rendas, sem recibo, e diz-se', () => {
    imovel(); contrato({ rent: 500, deposit: 20000 }, { finalidade: 'dhd' });
    rendas(500);
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 20000, contractId: 'C1', date: '2026-01-02' });
    const l = linhaDe(resumo());
    perto(l.rendas, 6000, 1e-9);
    perto(l.caucao, 0, 1e-9);
    perto(l.dhd.caucaoRecebida, 20000, 1e-9);
    assert.equal(l.recibosPorEmitir, 0);
  });

  test('sem o valor da caução da escritura, falta', () => {
    imovel(); contrato({ rent: 500, deposit: 0 }, { finalidade: 'dhd' });
    rendas(500);
    assert.ok(linhaDe(resumo()).faltas.some((f) => f.startsWith('valor da caução do direito real de habitação duradoura')));
  });

  test('os gastos nas colunas do 4.3; a devolução da caução de um DHD não é gasto', () => {
    imovel(); contrato({ rent: 500, deposit: 20000 }, { finalidade: 'dhd' });
    rendas(500);
    mov({ kind: 'expense', category: 'Condomínio', amount: 600, date: '2026-04-10' });
    mov({ kind: 'expense', category: 'Devoluções ao inquilino', sub: 'Devolução da caução', amount: 20000, contractId: 'C1', date: '2026-05-10' });
    const l = linhaDe(resumo());
    perto(l.dhd.gastos.condominio, 600, 1e-9);
    perto(l.dhd.gastos.outros, 0, 1e-9);
    perto(l.gastos.outros, 0, 1e-9);
  });

  test('cessado por acordo das partes (motivo 01 do 4.3): a redução cai desde o início, com a regularização dos anos anteriores', () => {
    imovel();
    contrato({ rent: 500, deposit: 20000, start: '2025-01-01', end: '2045-01-01', active: false }, { finalidade: 'dhd', cessacao: { data: '2026-06-30', motivo: '01' } });
    rendas(500, M12, {}, 2025);
    rendas(500, [1, 2, 3, 4, 5, 6]);
    const r = resumo(), l = linhaDe(r);
    assert.equal(l.quadro, '4.3');
    assert.equal(l.taxa, app.irsAno(2026).taxas.habitacional);
    assert.equal(l.dhd.cessacao.motivo, '01');
    const g = r.regularizacoes.find((x) => x.contratoId === 'C1');
    assert.ok(g && g.dhd, 'a regularização do n.º 20 num DHD');
    const base25 = app.irsAno(2025).taxas.habitacional;
    perto(g.total, 6000 * 0.05 * (base25 - 5) / 5, 0.01);
  });

  test('cessado no fim do prazo (motivo 06): sem regularização, os 5 % ficam', () => {
    imovel();
    contrato({ rent: 500, deposit: 20000, start: '2025-01-01', end: '2026-06-30', active: false }, { finalidade: 'dhd', cessacao: { data: '2026-06-30', motivo: '06' } });
    rendas(500, M12, {}, 2025);
    rendas(500, [1, 2, 3, 4, 5, 6]);
    const r = resumo();
    assert.equal(linhaDe(r).taxa, 5);
    assert.ok(!r.regularizacoes.some((x) => x.contratoId === 'C1'));
  });

  test('a prestação anual da caução do 11.º ano: 5 % da caução, natureza 02 do 4.3, à taxa base', () => {
    const outra = carregarApp({ hoje: '2032-06-01' });
    limpar(outra);
    outra.db.owners.push(outra.normPerson({ id: 'ana', name: 'Ana' }));
    outra.db.tenants.push(outra.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
    outra.db.properties.push(outra.normProp({ id: 'v1', name: 'Casa', ownerIds: ['ana'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '1' }));
    const c = outra.normContract({ id: 'C1', name: 'DHD', propertyId: 'v1', tenantIds: ['t1'], rent: 500, deposit: 20000, start: '2020-03-01', active: true,
      fisco: { estado: 'declarado', numero: '1', finalidade: 'dhd' } });
    outra.db.contracts.push(c);
    for (let m = 1; m <= 12; m++) outra.db.transactions.push(outra.normTx({ kind: 'income', category: 'Rendas', amount: 500, contractId: 'C1', propertyId: 'v1', recibo: true, date: `2031-${mm(m)}-05` }));
    igual(outra.fiscoDhdPrestacaoAnual(c, 2031), { valor: 1000, data: '2031-03-01', anoDoDireito: 11 });
    assert.equal(outra.fiscoDhdPrestacaoAnual(c, 2029), null, 'o 9.º ano não');
    const r = outra.resumoFiscal(2031, 'ana'), l = r.linhas.find((x) => x.papel === 'caucaoDhd');
    assert.ok(l, 'a linha da prestação anual');
    assert.equal(l.quadro, '4.3');
    assert.equal(l.natureza, '02');
    perto(l.rendas, 1000, 1e-9);
    assert.equal(l.taxa, outra.irsAno(2031).taxas.habitacional);
  });
});

describe('D117, D119, D121 — os benefícios do quadro 6 na linha (l.beneficios)', () => {
  const reab = { tipo: 'aru', inicio: '2015-01-10', conclusao: '2016-06-30', certificado: true };

  test('6A: um imóvel reabilitado com as condições paga 5 % no 4.1 e a linha leva o 6A com o aviso da AT', () => {
    imovel({ reabilitacao: reab, purchaseDate: '2010-05-01' }); contrato();
    rendas(1000);
    const l = linhaDe(resumo());
    assert.equal(l.quadro, '4.1');
    assert.equal(l.taxa, 5);
    igual(l.beneficios.map((b) => [b.id, b.quadro]), [['reab71', '6A']]);
    assert.ok(l.beneficios[0].aviso.length > 0, 'o aviso da PIV 28153');
    assert.equal(l.beneficios[0].taxa, 5);
    perto(l.imposto, 12000 * 0.05, 1e-9);
  });

  test('6A: comprado depois de 6 de outubro de 2023, não há 6A', () => {
    imovel({ reabilitacao: reab, purchaseDate: '2024-01-10' }); contrato();
    rendas(1000);
    const l = linhaDe(resumo());
    igual(l.beneficios, []);
    assert.notEqual(l.taxa, 5);
  });

  test('6B: numa Loja com História as obras dos 24 meses contam 110 % no imposto, e o quadro leva-as por inteiro', () => {
    imovel({ lojaComHistoria: true });
    contrato({}, { finalidade: 'nh', obrasSemOutroUso: true });
    rendas(1000);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 1000, date: '2025-10-10' });
    const l = linhaDe(resumo());
    perto(l.obras24.valor, 1000, 1e-9);
    perto(l.liquido, 11000, 1e-9);
    igual(l.beneficios.map((b) => b.id), ['lojaHistoria']);
    assert.equal(l.beneficios[0].fatorObras24, 1.1);
    perto(l.liquidoTributavel, 12000 - 1100, 1e-9);
    perto(l.imposto, (12000 - 1100) * 0.28, 1e-6);
  });

  test('6C: o rústico arrendado a uma entidade de gestão florestal conta as rendas a 50 % (EBF art. 59.º-G n.º 11)', () => {
    imovel({ tipoPredio: 'R' });
    contrato({ rent: 500, start: '2019-05-01' }, { finalidade: 'nh', egf: true, celebracao: '2019-05-01' });
    rendas(500);
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 100, date: '2026-05-10' });
    const r = resumo(), l = linhaDe(r);
    igual(l.beneficios.map((b) => [b.id, b.quadro, b.fator]), [['egf', '6C', 0.5]]);
    perto(l.rendas, 6000, 1e-9, 'o 4.1 leva as rendas por inteiro');
    perto(l.liquidoTributavel, 6000 * 0.5 - 100, 1e-9, 'o fator é das rendas, não do líquido');
    perto(l.imposto, (3000 - 100) * 0.28, 1e-6);
    perto(r.totais.imposto, (3000 - 100) * 0.28, 1e-6);
  });

  test('sem a marca do 6C as rendas contam por inteiro', () => {
    imovel({ tipoPredio: 'R' });
    contrato({ rent: 500, start: '2019-05-01' }, { finalidade: 'nh', celebracao: '2019-05-01' });
    rendas(500);
    const l = linhaDe(resumo());
    igual(l.beneficios, []);
    perto(l.imposto, 6000 * 0.28, 1e-6);
  });
});

describe('D133 — um imóvel fora de Portugal sai do Anexo F para o quadro 7A do Anexo J', () => {
  test('as rendas, os gastos do período arrendado, o país e o imposto pago lá; sem imposto estimado', () => {
    imovel({ pais: 'França', paisCodigo: '250' });
    contrato({}, { impostoEstrangeiro: { 2026: 300 } });
    rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', amount: 600, date: '2026-04-10' });
    const r = resumo();
    assert.equal(r.linhas.length, 0, 'nada no 4.1/4.2');
    assert.equal(r.anexoJ.length, 1);
    const e = r.anexoJ[0];
    assert.equal(e.pais, 'França');
    assert.equal(e.paisCodigo, '250');
    perto(e.rendas, 12000, 1e-9);
    perto(e.gastos, 600, 1e-9);
    perto(e.liquido, 11400, 1e-9);
    perto(e.impostoEstrangeiro, 300, 1e-9);
    igual(e.faltas, []);
    perto(r.totais.imposto, 0, 1e-9);
    perto(r.totais.rendas, 0, 1e-9);
    perto(r.totais.anexoJ.liquido, 11400, 1e-9);
    assert.ok(!r.contratosSemRendas.some((x) => x.contratoId === 'C1'));
  });

  test('sem o código do país, falta', () => {
    imovel({ pais: 'França' }); contrato();
    rendas(1000);
    igual(resumo().anexoJ[0].faltas, ['código do país (tabela X do Anexo J)']);
  });
});

describe('D134 — as rendas tributadas na categoria B saem do Anexo F', () => {
  test('o contrato marcado vai a r.categoriaB, com o valor, e não ao 4.1', () => {
    imovel(); contrato({}, { categoriaB: true });
    rendas(1000);
    const r = resumo();
    assert.equal(r.linhas.length, 0);
    assert.equal(r.categoriaB.length, 1);
    perto(r.categoriaB[0].rendas, 12000, 1e-9);
    assert.equal(r.categoriaB[0].n, 12);
    perto(r.totais.categoriaB.rendas, 12000, 1e-9);
    perto(r.totais.imposto, 0, 1e-9);
    assert.equal(r.fora.length, 0, 'não é um contrato não declarado');
  });
});

describe('D130 — a renda recebida antes do início do contrato', () => {
  test('diz-se em r.rendasAntesDoInicio; a antecipada (com o mês do contrato) e a caução não', () => {
    imovel(); contrato({ start: '2026-03-01' });
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2026-01-05', recibo: true });
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2026-02-25', periodo: '2026-03', recibo: true });
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 2000, contractId: 'C1', date: '2026-02-20', recibo: true });
    rendas(1000, [4, 5, 6]);
    const r = resumo();
    igual(r.rendasAntesDoInicio.map((x) => [x.data, x.valor, x.inicio]), [['2026-01-05', 1000, '2026-03-01']]);
    perto(linhaDe(r).rendas, 7000, 1e-9, 'continua a contar (com a antecipada e a caução)');
  });
});

describe('D115 — as rendas abaixo da renda do contrato com o recibo emitido', () => {
  test('a parte paga pelo fiador por fora: todos os meses abaixo de 850 €', () => {
    imovel(); contrato({ rent: 850 });
    rendas(550);
    const r = resumo();
    assert.equal(r.rendasAbaixo.length, 12);
    assert.equal(r.rendasAbaixo[0].referencia, 850);
    assert.equal(r.rendasAbaixo[0].diferenca, 300);
    assert.equal(r.rendasAbaixo[0].empresa, false);
  });

  test('com a resposta «pagamento parcial» (t.parcial) ou sem recibo emitido, não', () => {
    imovel(); contrato({ rent: 850 });
    rendas(550, [1, 2, 3, 4, 5, 6], { parcial: true });
    rendas(550, [7, 8, 9, 10, 11, 12], { recibo: false });
    igual(resumo().rendasAbaixo, []);
  });

  test('uma comissão descontada num mês: só esse mês, contra as rendas à volta', () => {
    imovel(); contrato({ rent: 1000 });
    rendas(1000, [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]);
    rendas(800, [5]);
    const r = resumo();
    igual(r.rendasAbaixo.map((x) => [x.mes, x.valor, x.referencia]), [['2026-05', 800, 1000]]);
  });

  test('o mês em que o contrato começa a meio (a renda à proporção dos dias) não conta', () => {
    imovel(); contrato({ rent: 1000, start: '2026-03-16' });
    rendas(516.13, [3]);
    rendas(1000, [4, 5, 6, 7, 8, 9, 10, 11, 12]);
    igual(resumo().rendasAbaixo, []);
  });

  test('uma atualização a meio do ano não é uma renda abaixo (nunca contra a renda de hoje)', () => {
    imovel(); contrato({ rent: 1022, start: '2025-01-01' });
    rendas(1000, [1, 2, 3, 4, 5, 6]);
    rendas(1022, [7, 8, 9, 10, 11, 12]);
    igual(resumo().rendasAbaixo, []);
  });

  test('a retenção soma à renda; o inquilino empresa diz-se', () => {
    app.db.tenants[0].nif = '501234567';
    imovel(); contrato({ rent: 1000 });
    rendas(750, M12, { retencao: 250 });
    igual(resumo().rendasAbaixo, [], '750 € + 250 € retidos = a renda');
    app.db.transactions[4].amount = 500;
    const x = resumo().rendasAbaixo;
    assert.equal(x.length, 1);
    assert.equal(x[0].empresa, true);
  });
});

describe('D116 — retenções de inquilinos particulares', () => {
  test('um inquilino com NIF de particular e retenções: confirma-as nos recibos', () => {
    imovel(); contrato();
    rendas(750, M12, { retencao: 250 });
    const r = resumo();
    assert.equal(r.retencoesParticulares.length, 1);
    perto(r.retencoesParticulares[0].retencoes, 3000, 1e-9);
    igual(r.retencoesParticulares[0].inquilinos, [{ nome: 'Tiago', nif: '123456789' }]);
  });

  test('uma empresa retém: nada a dizer', () => {
    app.db.tenants[0].nif = '501234567';
    imovel(); contrato();
    rendas(750, M12, { retencao: 250 });
    igual(resumo().retencoesParticulares, []);
  });
});

describe('D122 — as despesas do Splitwise importadas antes da v79, com a quota já cortada', () => {
  test('num imóvel de dois donos, sem swKey: o valor e o total reposto (valor ÷ quota)', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } }); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', amount: 250, date: '2026-03-10', src: 'splitwise', batch: 'b1' });
    mov({ kind: 'expense', category: 'Condomínio', amount: 500, date: '2026-04-10', src: 'splitwise', batch: 'b2', swKey: '2026-04-10|x|500.00|y' });
    const r = resumo();
    assert.equal(r.splitwiseCortadas.length, 1);
    assert.equal(r.splitwiseCortadas[0].quota, 0.5);
    perto(r.splitwiseCortadas[0].total, 500, 1e-9);
  });

  test('num imóvel de um dono só, não', () => {
    imovel(); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', amount: 250, date: '2026-03-10', src: 'splitwise', batch: 'b1' });
    igual(resumo().splitwiseCortadas, []);
  });
});

describe('D136, D135 — o código da freguesia', () => {
  test('um código cortado pela versão antiga (0302) falta; o 0302FI com letras não', () => {
    imovel({ freguesiaCodigo: '0302' }); contrato();
    rendas(1000);
    assert.ok(linhaDe(resumo()).faltas.some((f) => f.startsWith('código da freguesia fora do formato')));
    app.db.properties[0].freguesiaCodigo = '0302FI';
    assert.ok(!linhaDe(resumo()).faltas.some((f) => f.startsWith('código da freguesia')));
  });

  test('a união extinta em 2025 (010123): a marca em 2025 e depois, nunca nas de 2024; não é uma falta', () => {
    imovel({ freguesiaCodigo: '010123', matrizConfirmada: '2026-01-15' });
    contrato({ start: '2024-03-01' });
    rendas(600, M12, {}, 2024);
    rendas(600, M12, {}, 2025);
    rendas(600);
    const l = linhaDe(resumo());
    assert.equal(l.freguesiaUniao.codigo, '010123');
    igual(l.freguesiaUniao.repostas.map((x) => x.codigo), ['010128', '010132', '010134']);
    assert.equal(l.matrizConfirmada, '2026-01-15');
    assert.ok(!l.faltas.some((f) => f.startsWith('código da freguesia')));
    assert.equal(linhaDe(resumo(2025)).freguesiaUniao.codigo, '010123', 'a declaração de 2025 já leva a marca');
    assert.equal(linhaDe(resumo(2024)).freguesiaUniao, null);
  });
});
