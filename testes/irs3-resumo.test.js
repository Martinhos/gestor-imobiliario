// O resumo do Anexo F (fisco-resumo.js:resumoFiscal) na ronda 2 das correções
// da auditoria ao IRS: os gastos de um imóvel por quartos contam só na parte
// arrendada (N012); um gasto do período vai ao contrato em vigor no dia (N049);
// as rendas recebidas depois da venda do imóvel (N022); a renda paga ao
// senhorio só da parte subarrendada (N023); a caução devolvida num ano sem
// rendas (N024); a receita sem imóvel nem categoria (N027); o reembolso do
// Estado (N071); o seguro de renda pago no ano anterior (N072); a natureza 02 a
// 28 %, por quem paga e com recibo (N075, N076, N077); o quadro 5 com as rendas
// de anos anteriores e as rendas moderadas (N140, N053); a categoria B com a
// parte dos gastos e a caução à parte (N141); a renda de outro ano às regras do
// ano em que entra (N014); a regularização sem os anos sem regras (N125); as
// despesas da casa vazia com nome (N047) e as «a confirmar» (N048); os encargos
// do inquilino (N111); o que a Declaração faz a uma despesa (N113); e a divisão
// própria longe das quotas (N115).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, perto, repor } from './arnes.js';

const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

const json = (x) => JSON.parse(JSON.stringify(x));
const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: '2026-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};
const imovel = (extra) => {
  const p = app.normProp(Object.assign({ id: 'v1', name: 'T2 Lumiar', ownerIds: ['ana'], comproprietariosFora: [],
    freguesiaCodigo: '110621', tipoPredio: 'U', matrix: '7000', fraction: 'C' }, extra || {}));
  app.db.properties.push(p);
  return p;
};
const contrato = (extra, fisco) => {
  const c = app.normContract(Object.assign({ id: 'C1', name: 'Lumiar', propertyId: 'v1', tenantIds: ['t1'], rent: 1000,
    start: '2025-01-01', active: true }, extra || {}, { fisco: Object.assign({ estado: 'declarado', numero: '444', finalidade: 'hp' }, fisco || {}) }));
  app.db.contracts.push(c);
  return c;
};
/* as rendas de um contrato nos meses dados (todos, sem a lista), no dia 5, com o mês a que respeitam */
const rendas = (cid, ano, valor, meses, extra) => (meses || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).forEach((m) => {
  const mm = String(m).padStart(2, '0');
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: cid,
    date: `${ano}-${mm}-05`, periodo: `${ano}-${mm}`, recibo: true }, extra || {}));
});
const linhas = (r, id) => r.linhas.filter((l) => l.contratoId === id);
const linha = (r, id) => linhas(r, id)[0];
const condominios = (ano, valor, pid) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((m) =>
  mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: valor, propertyId: pid || 'v1', date: `${ano}-${String(m).padStart(2, '0')}-10` }));

beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }),
    app.normPerson({ id: 't2', name: 'Rita', nif: '123456789' }));
  app.db.settings.irs = app.normIrsDefs({});
});

describe('N012 — num imóvel por quartos os gastos contam só na parte arrendada', () => {
  const quartos = (extra) => imovel(Object.assign({ rentalMode: 'quartos',
    rooms: [{ id: 'q1', name: 'Quarto 1' }, { id: 'q2', name: 'Quarto 2' }, { id: 'q3', name: 'Quarto 3' }] }, extra || {}));
  const gastos = () => {
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 450, date: '2026-05-10' });
    condominios(2026, 60);
    mov({ kind: 'expense', category: 'Obras e benfeitorias', sub: 'Pintura', amount: 800, date: '2026-06-10' });
  };

  test('T3 com um quarto arrendado e o dono nos outros: um terço do IMI, do condomínio e da reparação', () => {
    quartos();
    contrato({ start: '2026-01-01', rent: 350, roomId: 'q1' });
    rendas('C1', 2026, 350);
    gastos();
    const r = app.resumoFiscal(2026, 'ana'), l = linha(r, 'C1');
    perto(l.gastos.imi, 150, 1e-6);
    perto(l.gastos.condominio, 240, 1e-6);
    perto(l.gastos.conservacao, 266.67, 0.01);
    assert.equal(r.parteArrendada.length, 1);
    const x = r.parteArrendada[0];
    assert.equal(x.propertyId, 'v1');
    assert.equal(x.origem, 'quartos');
    perto(x.parte, 0.3333, 1e-4);
    assert.equal(x.quartos, 3);
    assert.equal(x.arrendados, 1);
    perto(x.gastos, 1970, 0.01);
    perto(x.contados, 656.67, 0.01);
    const d = app.fiscoParteArrendadaDoAno(app.prop('v1'), 2026);
    perto(d.parte, 1 / 3, 1e-9);
    assert.equal(d.porOmissao, true);
  });

  test('com a parte da ficha (50 %), é ela que conta, e a origem di-lo', () => {
    quartos({ parteArrendada: 50 });
    contrato({ start: '2026-01-01', rent: 350, roomId: 'q1' });
    rendas('C1', 2026, 350);
    gastos();
    const r = app.resumoFiscal(2026, 'ana');
    perto(linha(r, 'C1').gastos.imi, 225, 1e-6);
    assert.equal(r.parteArrendada[0].origem, 'ficha');
    assert.deepEqual(json(app.fiscoParteArrendadaDoAno(app.prop('v1'), 2026)), { parte: 0.5, porOmissao: false, quartos: 3, arrendados: 1 });
  });

  test('os três quartos arrendados, ou uma casa inteira: os gastos todos, sem aviso', () => {
    quartos();
    ['q1', 'q2', 'q3'].forEach((q, i) => { contrato({ id: 'K' + i, name: 'K' + i, start: '2026-01-01', rent: 350, roomId: q }); rendas('K' + i, 2026, 350); });
    gastos();
    const r = app.resumoFiscal(2026, 'ana');
    perto(r.linhas.reduce((s, l) => s + l.gastos.imi, 0), 450, 1e-6);
    assert.equal(r.parteArrendada.length, 0);
  });
});

describe('N049 — um gasto do período vai ao contrato em vigor no dia em que se pagou', () => {
  test('C1 até 31/03 e C2 desde 1/04: a reparação de fevereiro é toda do C1; o IMI reparte-se pelas rendas', () => {
    imovel();
    contrato({ start: '2024-01-01', end: '2025-03-31', active: false, rent: 900 }, { cessacao: { data: '2025-03-31', motivo: '02' } });
    contrato({ id: 'C2', name: 'C2', start: '2025-04-01', end: '2035-03-31', rent: 1100, tenantIds: ['t2'] }, { numero: '555' });
    rendas('C1', 2025, 900, [1, 2, 3]);
    rendas('C2', 2025, 1100, [4, 5, 6, 7, 8, 9, 10, 11, 12]);
    mov({ kind: 'expense', category: 'Obras e benfeitorias', sub: 'Pintura', amount: 2400, date: '2025-02-10' });
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 600, date: '2025-05-10' });
    const r = app.resumoFiscal(2025, 'ana');
    perto(linha(r, 'C1').gastos.conservacao, 2400, 1e-6);
    perto(linha(r, 'C2').gastos.conservacao, 0, 1e-6);
    perto(linha(r, 'C1').gastos.imi, 600 * 2700 / 12600, 0.01);
    perto(linha(r, 'C2').gastos.imi, 600 * 9900 / 12600, 0.01);
  });
});

describe('N022 — as rendas recebidas depois de o imóvel ser vendido', () => {
  test('vendido a 15/12/2025, a renda de dezembro paga a 10/01/2026 tem linha em 2026; o IMI desse ano não conta', () => {
    imovel({ vendido: '2025-12-15' });
    contrato({ start: '2024-01-01', end: '2026-12-31', active: false }, { cessacao: { data: '2025-12-15', motivo: '02' } });
    rendas('C1', 2025, 1000, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda em atraso', amount: 1000, contractId: 'C1', date: '2026-01-10', periodo: '2025-12', recibo: true });
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, date: '2026-05-10' });
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.imoveis, 0, 'o imóvel já não é da declaração');
    assert.equal(r.linhas.length, 1);
    const l = r.linhas[0];
    perto(l.rendas, 1000, 1e-9);
    assert.equal(l.vendido, '2025-12-15');
    assert.deepEqual(json(l.anosAnteriores), [{ ano: 2025, valor: 1000, retencoes: 0 }]);
    perto(l.gastos.imi, 0, 1e-9, 'os gastos de um imóvel que já não é da pessoa ficam fora');
    perto(app.resumoFiscal(2025, 'ana').totais.rendas, 11000, 1e-9);
  });

  test('só a caução devolvida no ano a seguir à venda: sem linha, e diz-se com o valor', () => {
    imovel({ vendido: '2025-12-15' });
    contrato({ start: '2024-01-01', end: '2026-12-31', active: false, deposit: 2000 }, { cessacao: { data: '2025-12-15', motivo: '02' } });
    rendas('C1', 2025, 1000);
    mov({ kind: 'expense', category: 'Devoluções ao inquilino', sub: 'Devolução da caução', amount: 2000, contractId: 'C1', date: '2026-01-15' });
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.linhas.length, 0);
    assert.equal(r.caucoesSemLinha.length, 1);
    const x = r.caucoesSemLinha[0];
    assert.equal(x.contratoId, 'C1');
    assert.equal(x.vendido, '2025-12-15');
    perto(x.valor, 2000, 1e-9);
    perto(x.total, 2000, 1e-9);
  });
});

describe('N023 — a renda paga ao senhorio só da parte subarrendada', () => {
  const sub = (extra) => ({ subarrendamento: Object.assign({ ativo: true, nifSenhorio: '123456789', rendaMensal: 1200 }, extra || {}) });

  test('arrendo a 1 200 € e subarrendo um quarto a 400 €, a parte paga 400 €: rendimento 0, e não 9 600 € de «prejuízo»', () => {
    imovel(sub({ parte: 'parte', rendaParte: 400 }));
    contrato({ start: '2026-01-01', rent: 400 });
    rendas('C1', 2026, 400);
    const q = app.resumoFiscal(2026, 'ana').quadro5[0];
    perto(q.rendaPaga, 4800, 1e-6);
    perto(q.liquido, 0, 1e-6);
    assert.equal(q.parteSub, 'parte');
    assert.equal(q.semParte, false);
  });

  test('sem a parte dita (as contas antigas): a renda inteira, como antes, marcada para o aviso', () => {
    imovel(sub());
    contrato({ start: '2026-01-01', rent: 400 });
    rendas('C1', 2026, 400);
    const q = app.resumoFiscal(2026, 'ana').quadro5[0];
    perto(q.rendaPaga, 14400, 1e-6);
    assert.equal(q.semParte, true);
    assert.equal(q.parteSubPorDizer, true);
  });

  test('dois quartos subarrendados, um não declarado: o declarado leva só a parte dele da renda paga', () => {
    imovel(Object.assign(sub({ rendaMensal: 1000, parte: 'toda' }), { rentalMode: 'quartos', rooms: [{ id: 'q1', name: 'Q1' }, { id: 'q2', name: 'Q2' }] }));
    contrato({ start: '2026-01-01', rent: 600, roomId: 'q1' });
    contrato({ id: 'C2', name: 'C2', start: '2026-01-01', rent: 600, roomId: 'q2', tenantIds: ['t2'] }, { estado: 'naoDeclarado' });
    rendas('C1', 2026, 600); rendas('C2', 2026, 600);
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.quadro5.length, 1);
    perto(r.quadro5[0].rendaPaga, 6000, 1e-6, 'e não os 12 000 € inteiros');
    perto(r.quadro5[0].liquido, 1200, 1e-6);
  });

  test('«parte» sem a renda da parte é uma falta', () => {
    imovel(sub({ parte: 'parte' }));
    contrato({ start: '2026-01-01', rent: 400 });
    rendas('C1', 2026, 400);
    assert.ok(app.resumoFiscal(2026, 'ana').quadro5[0].faltas.includes('renda paga pela parte subarrendada'));
  });
});

describe('N024 — a caução devolvida num ano sem rendas do imóvel', () => {
  test('contrato acabado a 31/12/2025, a caução devolvida a 15/01/2026, sem rendas em 2026: sem linha, e diz-se com o valor', () => {
    imovel();
    contrato({ start: '2024-01-01', end: '2025-12-31', active: false, deposit: 2000 }, { cessacao: { data: '2025-12-31', motivo: '02' } });
    rendas('C1', 2025, 1000);
    const t = mov({ kind: 'expense', category: 'Devoluções ao inquilino', sub: 'Devolução da caução', amount: 2000, contractId: 'C1', date: '2026-01-15' });
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.linhas.length, 0, 'as instruções mandam não referir prédios sem rendimento');
    assert.deepEqual(json(r.caucoesSemLinha), [{ txId: t.id, contratoId: 'C1', nome: 'Lumiar', propertyId: 'v1', imovel: 'T2 Lumiar',
      data: '2026-01-15', valor: 2000, parte: 2000, total: 2000, vendido: '' }]);
  });

  test('com outro contrato com rendas no imóvel nesse ano, entra na linha e não se aponta', () => {
    imovel();
    contrato({ start: '2024-01-01', end: '2025-12-31', active: false, deposit: 2000 }, { cessacao: { data: '2025-12-31', motivo: '02' } });
    contrato({ id: 'C2', name: 'C2', start: '2026-02-01', end: '2030-01-31', tenantIds: ['t2'] });
    rendas('C2', 2026, 1000, [2, 3, 4]);
    mov({ kind: 'expense', category: 'Devoluções ao inquilino', sub: 'Devolução da caução', amount: 2000, contractId: 'C1', date: '2026-01-15' });
    const r = app.resumoFiscal(2026, 'ana');
    perto(linha(r, 'C2').gastos.outros, 2000, 1e-6);
    assert.equal(r.caucoesSemLinha.length, 0);
  });
});

describe('N027 — a receita sem imóvel nem categoria numa conta com contratos', () => {
  test('«Renda João novembro» lançada sem imóvel: vai a porClassificar; uma «Outras receitas» sem imóvel não', () => {
    imovel();
    imovel({ id: 'v2', name: 'T1 Benfica' });
    contrato();
    contrato({ id: 'C2', name: 'Benfica', propertyId: 'v2', tenantIds: ['t2'] });
    rendas('C1', 2026, 700); rendas('C2', 2026, 700, null, { propertyId: 'v2' });
    const t = mov({ kind: 'income', label: 'Renda João novembro', amount: 700, propertyId: null, date: '2026-11-07' });
    mov({ kind: 'income', category: 'Outras receitas', label: 'Juros', amount: 12, propertyId: null, date: '2026-11-08' });
    const pc = app.resumoFiscal(2026, 'ana').porClassificar;
    assert.deepEqual(json(pc), [{ txId: t.id, nome: 'Renda João novembro', valor: 700, propertyId: null, data: '2026-11-07', contratoId: null,
      categoria: '', sub: '', semImovel: true }]);
  });
});

describe('N071 — o Reembolsos › Estado num imóvel da Declaração', () => {
  test('o IMI devolvido pela AT aponta-se com o tipo «estado» e o IMI dos gastos; o reembolso do IRS sem imóvel não', () => {
    imovel(); contrato(); rendas('C1', 2026, 1000);
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 600, date: '2026-05-10' });
    const t = mov({ kind: 'income', category: 'Reembolsos', sub: 'Estado', amount: 250, date: '2026-09-10' });
    mov({ kind: 'income', category: 'Reembolsos', sub: 'Estado', amount: 400, propertyId: null, date: '2026-08-10' });
    const rg = app.resumoFiscal(2026, 'ana').reembolsosGasto;
    assert.equal(rg.length, 1);
    assert.equal(rg[0].txId, t.id);
    assert.equal(rg[0].tipo, 'estado');
    perto(rg[0].impostosNosGastos, 600, 1e-6);
  });
});

describe('N072 — a indemnização do seguro de renda com o prémio pago no ano anterior', () => {
  test('prémio a 28/12/2025 e o seguro a pagar 3 000 € em 2026: é o seguro de renda, e não o aviso genérico', () => {
    imovel(); contrato(); rendas('C1', 2026, 1000, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    mov({ kind: 'expense', category: 'Seguros', sub: 'Renda garantida', amount: 240, date: '2025-12-28' });
    const t = mov({ kind: 'income', category: 'Reembolsos', sub: 'Seguro', amount: 3000, date: '2026-10-10' });
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.seguroDeRenda.map((x) => x.txId)), [t.id]);
    assert.equal(r.reembolsosGasto.length, 0);
  });
});

describe('N075, N076, N077 — a natureza 02: 28 %, por quem paga, com recibo', () => {
  test('num contrato de habitação, a linha 02 paga 28 % (não é arrendamento habitacional), em 2025 e em 2026', () => {
    imovel(); contrato({ start: '2024-01-01' });
    [2025, 2026].forEach((y) => {
      rendas('C1', y, 1000);
      mov({ kind: 'income', category: 'Rendas', sub: 'Outras receitas prediais', amount: 2400, contractId: 'C1', date: `${y}-06-10`, recibo: true });
      const l = app.resumoFiscal(y, 'ana').linhas.find((x) => x.papel === 'outra');
      assert.equal(l.taxa, 28, String(y));
      assert.equal(l.motivoTaxa, 'nh');
      assert.equal(l.natureza, '02');
    });
  });

  test('com o NIF de quem paga e o n.º da cedência, a linha leva-os em vez dos do arrendamento', () => {
    imovel(); contrato(); rendas('C1', 2026, 1000);
    mov({ kind: 'income', category: 'Rendas', sub: 'Outras receitas prediais', amount: 2400, contractId: 'C1', date: '2026-06-10',
      pagadorNif: '500000000', cedenciaNumero: '777', recibo: true });
    const l = app.resumoFiscal(2026, 'ana').linhas.find((x) => x.papel === 'outra');
    assert.equal(l.atNumero, '777');
    assert.deepEqual(json(l.inquilinos), [{ id: '', nome: '', nif: '500000000', pais: '' }]);
    assert.deepEqual(json(l.pagador), { nif: '500000000', numero: '777', nome: '' });
    assert.equal(l.pagadorPorIndicar, false);
    assert.ok(!l.faltas.some((f) => /inquilino/.test(f)), 'as faltas do inquilino do arrendamento saem');
  });

  test('sem o NIF de quem paga, a identificação é a do arrendamento e di-lo', () => {
    imovel(); contrato(); rendas('C1', 2026, 1000);
    mov({ kind: 'income', category: 'Rendas', sub: 'Outras receitas prediais', amount: 2400, contractId: 'C1', date: '2026-06-10', recibo: true });
    const l = app.resumoFiscal(2026, 'ana').linhas.find((x) => x.papel === 'outra');
    assert.equal(l.pagadorPorIndicar, true);
    assert.equal(l.atNumero, '444');
  });

  test('um terreno sem arrendamento com uma antena: linha 02 própria, sem contrato, e não «rendas sem contrato»', () => {
    imovel({ id: 'v2', name: 'Terreno', tipoPredio: 'R' });
    const t = mov({ kind: 'income', category: 'Rendas', sub: 'Outras receitas prediais', amount: 900, propertyId: 'v2', date: '2026-06-10' });
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.semContrato.length, 0);
    assert.equal(r.linhas.length, 1);
    const l = r.linhas[0];
    assert.equal(l.contratoId, null);
    assert.equal(l.semContrato, true);
    assert.equal(l.papel, 'outra');
    perto(l.rendas, 900, 1e-9);
    assert.equal(l.taxa, 28);
    assert.ok(l.faltas.includes('NIF de quem paga esta receita'));
    assert.equal(l.recibosPorEmitir, 1, 'a cedência de uso pede recibo (N077)');
    assert.equal(app.fiscoNContratos(r.linhas), 0, 'não é um contrato');
    assert.ok(t);
  });

  test('o recibo em falta conta na linha 02 e nas rendas do quadro 5; o arrendamento rural não pede recibo', () => {
    imovel(); contrato(); rendas('C1', 2026, 1000);
    mov({ kind: 'income', category: 'Rendas', sub: 'Outras receitas prediais', amount: 2400, contractId: 'C1', date: '2026-06-10' });
    assert.equal(app.resumoFiscal(2026, 'ana').linhas.find((x) => x.papel === 'outra').recibosPorEmitir, 1);
    limpar(app);
    app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 } }); contrato({ rent: 900 });
    rendas('C1', 2026, 900, null, { recibo: false });
    assert.equal(app.resumoFiscal(2026, 'ana').quadro5[0].recibosPorEmitir, 12);
    limpar(app);
    app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
    imovel({ tipoPredio: 'R' }); contrato({}, { arrendamentoRural: true });
    rendas('C1', 2026, 300, null, { recibo: false });
    assert.equal(linha(app.resumoFiscal(2026, 'ana'), 'C1').recibosPorEmitir, 0);
  });
});

describe('N140, N053 — o quadro 5: as rendas de anos anteriores e as rendas moderadas', () => {
  test('a renda de dezembro de 2025 paga em janeiro de 2026 pelo subarrendatário vai às rendas de anos anteriores', () => {
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600, parte: 'toda' } }); contrato({ rent: 900 });
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda em atraso', amount: 900, contractId: 'C1', date: '2026-01-20', periodo: '2025-12', recibo: true });
    rendas('C1', 2026, 900, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.quadro5[0].anosAnteriores), [{ ano: 2025, valor: 900, retencoes: 0 }]);
    perto(r.totais.quadro5.anosAnteriores, 900, 1e-9);
  });

  test('em 2026 a sublocação habitacional testa as rendas moderadas (10 %, por confirmar); em 2025 fica nos 25 %', () => {
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600, parte: 'toda' } }); contrato({ rent: 900, start: '2024-01-01' });
    rendas('C1', 2025, 900); rendas('C1', 2026, 900);
    const q6 = app.resumoFiscal(2026, 'ana').quadro5[0], q5 = app.resumoFiscal(2025, 'ana').quadro5[0];
    assert.equal(q6.taxa, 10); assert.equal(q6.motivoTaxa, 'moderada'); assert.equal(q6.moderadaPorConfirmar, true);
    perto(q6.imposto, 360, 1e-6);
    assert.equal(q5.taxa, 25); assert.equal(q5.motivoTaxa, 'base'); assert.equal(q5.moderadaPorConfirmar, false);
  });
});

describe('N141 — a categoria B com a parte dos gastos e a caução à parte', () => {
  test('dois contratos de 1 000 €, um na categoria B com caução de 2 000 €, e 1 200 € de condomínio', () => {
    imovel(); contrato({ start: '2026-01-01' }, { categoriaB: true });
    contrato({ id: 'C2', name: 'C2', start: '2026-01-01', tenantIds: ['t2'] });
    rendas('C1', 2026, 1000); rendas('C2', 2026, 1000);
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 2000, contractId: 'C1', date: '2026-01-02', recibo: true });
    condominios(2026, 100);
    const r = app.resumoFiscal(2026, 'ana'), b = r.categoriaB[0];
    perto(b.rendas, 14000, 1e-9);
    perto(b.caucao, 2000, 1e-9);
    assert.equal(b.n, 13);
    assert.equal(b.nCaucao, 1);
    assert.equal(b.nRendas, 12);
    perto(b.gastos, 1200 * 14000 / 26000, 0.01);
    perto(b.gastosTotal, b.gastos, 1e-9);
    perto(b.gastosColunas.condominio, 646.15, 0.01);
    perto(linha(r, 'C2').gastos.condominio, 553.85, 0.01);
  });
});

describe('N014 — a renda de outro ano num contrato que não viveu no ano paga as regras do ano em que entra', () => {
  test('rendas de outubro a dezembro de 2025 pagas em 2026 de um contrato acabado em 2025: as regras de 2026 (10 %)', () => {
    imovel();
    contrato({ start: '2024-01-01', end: '2025-12-31', active: false }, { cessacao: { data: '2025-12-31', motivo: '02' } });
    rendas('C1', 2025, 1000, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    [10, 11, 12].forEach((m) => mov({ kind: 'income', category: 'Rendas', sub: 'Renda em atraso', amount: 1000, contractId: 'C1',
      date: '2026-01-15', periodo: `2025-${m}`, recibo: true }));
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(l.taxa, 10);
    assert.equal(l.motivoTaxa, 'moderada');
    perto(l.imposto, 300, 1e-6);
    assert.deepEqual(json(l.semVidaNoAno), { anos: [2025] });
  });

  test('a renda de janeiro de 2026 paga em dezembro de 2025, num contrato que começa em 2026: 25 % em 2025, nunca a «moderada»', () => {
    imovel();
    contrato({ start: '2026-01-01', end: '2028-12-31' });
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2025-12-15', periodo: '2026-01', recibo: true });
    const l = linha(app.resumoFiscal(2025, 'ana'), 'C1');
    assert.equal(l.taxa, 25);
    assert.equal(l.motivoTaxa, 'base');
    perto(l.imposto, 250, 1e-6);
    assert.deepEqual(json(l.semVidaNoAno), { anos: [2026] });
  });
});

describe('N125 — a regularização do n.º 20 não soma os anos sem regras', () => {
  test('contrato de 2022 cessado pelo senhorio em 2026: 2022 a 2024 por confirmar, à parte; só 2025 soma', () => {
    imovel();
    contrato({ start: '2022-01-01', end: '2031-12-31', rent: 3000, active: false }, { cessacao: { data: '2026-03-31', motivo: '01' } });
    [2022, 2023, 2024, 2025].forEach((y) => rendas('C1', y, 3000));
    rendas('C1', 2026, 3000, [1, 2, 3]);
    const r = app.resumoFiscal(2026, 'ana'), g = r.regularizacoes[0];
    assert.deepEqual(json(g.anos.map((a) => a.ano)), [2025]);
    assert.deepEqual(json(g.porConfirmar.map((a) => a.ano)), [2022, 2023, 2024]);
    assert.deepEqual(json(g.anosSemRegras), [2022, 2023, 2024]);
    perto(g.total, g.anos[0].diferenca, 1e-9);
    assert.ok(g.totalPorConfirmar > 0);
    perto(r.totais.regularizacao, g.total, 1e-9, 'o total não leva os anos por confirmar');
  });
});

describe('N047, N048 — as despesas da casa vazia e as «a confirmar»', () => {
  test('as despesas pagas sem contrato em vigor vêm com o nome, o valor, o imóvel e o intervalo', () => {
    imovel(); contrato({ start: '2026-03-01' });
    rendas('C1', 2026, 1000, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const t = mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', label: 'Condomínio de fevereiro', amount: 60, date: '2026-02-08' });
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.foraDoPeriodo), [{ txId: t.id, nome: 'Condomínio de fevereiro', data: '2026-02-08', valor: 60, propertyId: 'v1',
      imovel: 'T2 Lumiar', col: 'condominio', semContratoDe: '', semContratoAte: '2026-02-28' }]);
  });

  test('«a confirmar» pagas com a casa vazia dizem-no; escolhida a coluna, continuam fora — salvo ligadas ao contrato', () => {
    imovel();
    contrato({ start: '2025-01-01', end: '2027-12-31', active: false }, { cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas('C1', 2026, 1000, [1, 2, 3, 4, 5, 6]);
    const a = mov({ kind: 'expense', category: 'Seguros', label: 'Seguro', amount: 900, date: '2026-09-10' });
    const b = mov({ kind: 'expense', category: 'Outros', label: 'Outros', amount: 350, date: '2026-09-12' });
    let r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.aConfirmar.map((x) => [x.txId, x.semContrato, x.semContratoDe, x.semContratoAte])),
      [[a.id, true, '2026-07-01', ''], [b.id, true, '2026-07-01', '']]);
    a.irsCol = 'outros'; b.irsCol = 'outros';
    r = app.resumoFiscal(2026, 'ana');
    perto(linha(r, 'C1').gastos.outros, 0, 1e-9, 'escolher a coluna classifica; não diz que conta com a casa vazia');
    assert.equal(r.foraDoPeriodo.length, 2);
    assert.equal(r.foraPorEscolha.length, 0);
    a.contractId = 'C1';
    r = app.resumoFiscal(2026, 'ana');
    perto(linha(r, 'C1').gastos.outros, 900, 1e-9, 'ligada ao contrato, a pessoa disse de que contrato é');
    assert.deepEqual(json(r.foraPorEscolha.map((x) => x.txId)), [a.id]);
  });
});

describe('N111 — os encargos que o contrato põe a cargo do inquilino', () => {
  test('o contrato diz que o condomínio é do inquilino, e há 720 € de condomínio nos gastos: aponta-se', () => {
    imovel(); contrato({ start: '2025-01-01', encargosInquilino: ['condominio'] });
    rendas('C1', 2026, 1000);
    condominios(2026, 60);
    const e = app.resumoFiscal(2026, 'ana').encargosDoInquilino;
    assert.equal(e.length, 1);
    assert.equal(e[0].contratoId, 'C1');
    assert.equal(e[0].encargo, 'condominio');
    assert.equal(e[0].n, 12);
    perto(e[0].valor, 720, 1e-9);
    perto(e[0].nosGastos, 720, 1e-9);
  });

  test('sem o encargo no contrato, nada', () => {
    imovel(); contrato(); rendas('C1', 2026, 1000); condominios(2026, 60);
    assert.equal(app.resumoFiscal(2026, 'ana').encargosDoInquilino.length, 0);
  });
});

describe('N113 — o que a Declaração faz a uma despesa (a ficha e o CSV)', () => {
  test('paga sem contrato, no período, num imóvel sem rendas, obras dos 24 meses, a confirmar e não dedutível', () => {
    imovel(); imovel({ id: 'v2', name: 'T1 Vazio' });
    contrato({ start: '2026-03-01' });
    rendas('C1', 2026, 1000, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const fev = mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 60, date: '2026-02-08' });
    const abr = mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 60, date: '2026-04-08' });
    const vazio = mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 60, propertyId: 'v2', date: '2026-04-08' });
    const obra = mov({ kind: 'expense', category: 'Obras e benfeitorias', sub: 'Pintura', amount: 500, date: '2025-10-01' });
    const seg = mov({ kind: 'expense', category: 'Seguros', amount: 90, date: '2026-05-01' });
    const aimi = mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 90, date: '2026-09-01' });
    const memo = {};
    const f = app.fiscoDespesaNaDeclaracao(fev, memo);
    assert.equal(f.conta, false);
    assert.equal(f.motivo, 'semContrato');
    assert.match(f.texto, /08\/02\/2026/);
    assert.ok(memo[2026], 'o resumo do ano fica no memo');
    const a = app.fiscoDespesaNaDeclaracao(abr, memo);
    assert.equal(a.conta, true); assert.equal(a.col, 'condominio'); assert.equal(a.motivo, '');
    assert.equal(app.fiscoDespesaNaDeclaracao(vazio, memo).motivo, 'semRendas');
    const o = app.fiscoDespesaNaDeclaracao(obra);
    assert.equal(o.motivo, 'obras24'); assert.equal(o.col, 'obras24'); assert.equal(o.contrato.id, 'C1'); assert.equal(o.conta, false);
    assert.equal(app.fiscoDespesaNaDeclaracao(seg, memo).motivo, 'confirmar');
    assert.equal(app.fiscoDespesaNaDeclaracao(aimi, memo).motivo, 'nao');
    assert.equal(app.fiscoDespesaNaDeclaracao(mov({ kind: 'income', category: 'Rendas', amount: 1, contractId: 'C1' })), null);
  });
});

describe('N115 — uma divisão própria muito diferente das quotas diz-se aos dois donos', () => {
  test('casa 50/50, a Ana paga sozinha uma pintura de 1 000 €: o aviso sai no resumo dela e no do Bruno', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } });
    contrato(); rendas('C1', 2026, 1000);
    const t = mov({ kind: 'expense', category: 'Obras e benfeitorias', sub: 'Pintura', amount: 1000, date: '2026-05-10',
      split: { mode: 'percent', parts: { ana: 100, bruno: 0 } } });
    mov({ kind: 'expense', category: 'Obras e benfeitorias', sub: 'Pintura', amount: 100, date: '2026-06-10',
      split: { mode: 'percent', parts: { ana: 60, bruno: 40 } } });
    const a = app.resumoFiscal(2026, 'ana').divisoesProprias, b = app.resumoFiscal(2026, 'bruno').divisoesProprias;
    assert.deepEqual(json(a.map((x) => [x.txId, x.divisao, x.quota])), [[t.id, 1, 0.5]], 'um 60/40 não é «muito diferente»');
    perto(a[0].conta, 500, 1e-6, 'conta a quota');
    assert.deepEqual(json(b.map((x) => [x.txId, x.divisao, x.quota])), [[t.id, 0, 0.5]]);
  });
});

describe('outras folhas — a nota própria em qualquer despesa (N041), as obras «a confirmar» (N011), o «Fora dos totais» (N042)', () => {
  test('«é só a minha parte» num condomínio: inteira para quem a pagou, sem quota', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } });
    contrato(); rendas('C1', 2026, 1000);
    mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 100, paidBy: 'ana', notaPropria: true, date: '2026-05-10' });
    perto(linha(app.resumoFiscal(2026, 'ana'), 'C1').gastos.condominio, 100, 1e-6);
    perto(linha(app.resumoFiscal(2026, 'bruno'), 'C1').gastos.condominio, 0, 1e-6);
  });

  test('uma obra «a confirmar» paga em 2025, antes de um contrato de 2026: aponta-se em 2026, o ano das obras', () => {
    imovel(); contrato({ start: '2026-03-01' });
    rendas('C1', 2026, 1000, [3, 4, 5]);
    const t = mov({ kind: 'expense', category: 'Obras e benfeitorias', label: 'Obra', amount: 3000, date: '2025-10-01' });
    const x = app.resumoFiscal(2026, 'ana').aConfirmar.find((y) => y.txId === t.id);
    assert.ok(x, 'não some em silêncio');
    assert.equal(x.obras24, true);
    assert.equal(x.contrato, 'Lumiar');
  });

  test('uma despesa que o «Fora dos totais» tira do Anexo F diz-se, com a coluna que teria', () => {
    imovel(); contrato(); rendas('C1', 2026, 1000);
    app.db.settings.exclude = { [app.excKey('cats', 'Condomínio')]: true };
    const t = mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 60, date: '2026-05-10' });
    assert.deepEqual(json(app.resumoFiscal(2026, 'ana').despesasForaDosTotais.map((x) => [x.txId, x.col])), [[t.id, 'condominio']]);
  });
});
