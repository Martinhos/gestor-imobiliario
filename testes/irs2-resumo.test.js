// O resumo do Anexo F (fisco-resumo.js:resumoFiscal), o motor do IRS (irs.js) e
// os titulares (fisco-titulares.js) na ronda 1 das correções da auditoria ao
// IRS: o ano de início do benefício do quadro 10 pelo início do período com o
// regime, «a confirmar» quando a app não o sabe (N009); a matriz, o titular e
// os inquilinos em cada entrada do quadro 10, uma por titular (N008); os anos
// que faltam à regularização do n.º 20 (N031); as rendas de meses depois do
// dia em que o contrato acabou (N033); o inquilino empresa que o contrato não
// identifica (N034); a redução caída toda pelo n.º 20 (N101); a quota do mês
// da renda em atraso e a de 31 de dezembro do IMI (N069); o AIMI de um prédio
// comprado depois de 1 de janeiro (N070); os bens comuns do casal em conjunta
// (N020); e as casas sem quotas com data com movimentos de quem já saiu (N035).

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
const rendas = (cid, ano, valor, meses, pid) => (meses || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).forEach((m) => {
  const mm = String(m).padStart(2, '0');
  mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: cid, propertyId: pid || 'v1',
    date: `${ano}-${mm}-05`, periodo: `${ano}-${mm}`, recibo: true });
});
const linhas = (r, id) => r.linhas.filter((l) => l.contratoId === id);
const linha = (r, id) => linhas(r, id)[0];
const irs = (x) => { app.db.settings.irs = app.normIrsDefs(x || {}); };

beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }),
    app.normPerson({ id: 'emp', name: 'Empresa Lda', nif: '500000000' }));
  irs({});
});

describe('N009 — o ano de início do benefício parte do início do período com o regime', () => {
  test('4.2 desde 2024, comunicado no prazo, com rendas só de 2026: 2024, certo', () => {
    imovel();
    contrato({ start: '2024-01-01', end: '2033-12-31', active: false },
      { comunicacoes: { 2024: '2025-02-10' }, comunicacoesV: 2, cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas('C1', 2026, 1000, [1, 2, 3, 4, 5, 6]);
    const x = app.resumoFiscal(2026, 'ana').cessados[0];
    assert.equal(x.anoInicioBeneficio, 2024, 'e não 2026, o primeiro ano com rendas na app');
    assert.equal(x.anoInicioConfirmar, false, 'a comunicação do período feita no prazo diz que a redução começou nesse ano');
    assert.equal(x.anoInicioPorque, '');
  });

  test('o mesmo sem a comunicação registada: 2024, a confirmar, com o porquê', () => {
    imovel();
    contrato({ start: '2024-01-01', end: '2033-12-31', active: false }, { cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas('C1', 2026, 1000, [1, 2, 3, 4, 5, 6]);
    const x = app.resumoFiscal(2026, 'ana').cessados[0];
    assert.equal(x.anoInicioBeneficio, 2024);
    assert.equal(x.anoInicioConfirmar, true);
    assert.match(x.anoInicioPorque, /o contrato começou em 2024 e a app só tem rendas dele desde 2026/);
    assert.doesNotMatch(x.anoInicioPorque, /\.$/, 'sem ponto final');
  });

  test('contrato de 11/01/2021 a 10/01/2026 (n.º 3), com rendas só de 2025: 2021, a confirmar', () => {
    imovel();
    contrato({ start: '2021-01-11', end: '2026-01-10', active: false }, { cessacao: { data: '2026-01-10', motivo: '03' } });
    rendas('C1', 2025, 1000);
    const x = app.resumoFiscal(2026, 'ana').cessados[0];
    assert.equal(x.regime, '02');
    assert.equal(x.anoInicioBeneficio, 2021, 'e não 2025');
    assert.equal(x.anoInicioConfirmar, true);
    assert.match(x.anoInicioPorque, /desde 2025/);
  });

  test('com as rendas do ano do início na app é certo; uma renovação com o mesmo n.º recua até ao contrato', () => {
    imovel();
    contrato({ start: '2020-01-01', end: '2024-12-31', active: false },
      { renovacoes: [{ inicio: '2025-01-01', fim: '2029-12-31' }], cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas('C1', 2025, 1000); rendas('C1', 2026, 1000, [1, 2, 3, 4, 5, 6]);
    let x = app.resumoFiscal(2026, 'ana').cessados[0];
    assert.equal(x.anoInicioBeneficio, 2020, 'a renovação de 5 anos tem o mesmo n.º 3 do contrato');
    assert.equal(x.anoInicioConfirmar, true);
    rendas('C1', 2020, 1000);
    x = app.resumoFiscal(2026, 'ana').cessados[0];
    assert.equal(x.anoInicioBeneficio, 2020);
    assert.equal(x.anoInicioConfirmar, false, 'com as rendas de 2020 na app, é certo');
  });

  test('o contrato inicial sem redução (2 anos, 26 %): o regime começou na renovação', () => {
    imovel();
    contrato({ start: '2019-01-01', end: '2020-12-31', active: false },
      { renovacoes: [{ inicio: '2021-01-01', fim: '2030-12-31' }], cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas('C1', 2025, 1000); rendas('C1', 2026, 1000, [1, 2, 3, 4, 5, 6]);
    const x = app.resumoFiscal(2026, 'ana').cessados[0];
    assert.equal(x.anoInicioBeneficio, 2021);
    assert.match(x.anoInicioPorque, /^a renovação começou em 2021/);
  });

  test('a comunicação feita depois do prazo: a confirmar, a dizer que a AT pode ter começado mais tarde', () => {
    imovel();
    contrato({ start: '2024-01-01', end: '2033-12-31', active: false },
      { comunicacoes: { 2024: '2025-03-20' }, comunicacoesV: 2, cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas('C1', 2026, 1000, [1, 2, 3, 4, 5, 6]);
    const x = app.resumoFiscal(2026, 'ana').cessados[0];
    assert.equal(x.anoInicioBeneficio, 2024);
    assert.equal(x.anoInicioConfirmar, true);
    assert.match(x.anoInicioPorque, /depois do prazo/);
  });
});

describe('N008 — cada entrada do quadro 10 com a matriz, o titular e os inquilinos', () => {
  test('sem conjunta: uma entrada, titular A, com a matriz e o NIF do inquilino', () => {
    imovel();
    contrato({ start: '2024-01-01', end: '2033-12-31', active: false }, { cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas('C1', 2026, 1000, [1, 2, 3, 4, 5, 6]);
    const cs = app.resumoFiscal(2026, 'ana').cessados;
    assert.equal(cs.length, 1);
    assert.deepEqual(json([cs[0].titular, cs[0].titularId, cs[0].quota, cs[0].freguesiaCodigo, cs[0].tipoPredio, cs[0].artigo, cs[0].fracao, cs[0].propertyId]),
      ['A', 'ana', 1, '110621', 'U', '7000', 'C', 'v1']);
    assert.deepEqual(json(cs[0].inquilinos), [{ id: 't1', nome: 'Tiago', nif: '123456789', pais: '' }]);
  });

  test('em conjunta, um imóvel dos dois cônjuges dá duas entradas, A e B, cada uma com a sua quota', () => {
    irs({ porAno: { 2026: { conjunta: true, conjugeId: 'bruno', minhaLetra: 'A' } } });
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } });
    contrato({ start: '2024-01-01', end: '2033-12-31', active: false }, { cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas('C1', 2026, 1000, [1, 2, 3, 4, 5, 6]);
    const cs = app.resumoFiscal(2026, 'ana').cessados;
    assert.deepEqual(json(cs.map((x) => [x.contratoId, x.titular, x.titularId, x.quota, x.artigo])),
      [['C1', 'A', 'ana', 0.5, '7000'], ['C1', 'B', 'bruno', 0.5, '7000']]);
  });
});

describe('N031 — a regularização do n.º 20 diz os anos do período que a app não tem', () => {
  test('10 anos desde 2020, rendas na app desde 2022, cessado pelo senhorio em 2026: faltam 2020 e 2021', () => {
    imovel();
    contrato({ start: '2020-01-01', end: '2029-12-31', rent: 3000, active: false }, { cessacao: { data: '2026-06-30', motivo: '01' } });
    [2022, 2023, 2024, 2025].forEach((y) => rendas('C1', y, 3000));
    rendas('C1', 2026, 3000, [1, 2, 3, 4, 5, 6]);
    const g = app.resumoFiscal(2026, 'ana').regularizacoes[0];
    assert.deepEqual(json(g.anos.map((a) => a.ano)), [2022, 2023, 2024, 2025]);
    assert.deepEqual(json(g.anosEmFalta), [2020, 2021]);
    assert.deepEqual(json(g.anosSemRegras), [2022, 2023, 2024], 'a app só tem as regras de 2025 e de 2026');
    assert.equal(g.desde, '2020-01-01');
  });

  test('com as rendas desde o início do período, não falta nenhum', () => {
    imovel();
    contrato({ start: '2024-01-01', end: '2033-12-31', rent: 2500, active: false },
      { celebracao: '2023-12-10', rendaAcimaDoLimite: false, cessacao: { data: '2026-06-30', motivo: '01' } });
    rendas('C1', 2024, 2500); rendas('C1', 2025, 2500); rendas('C1', 2026, 2500, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(json(app.resumoFiscal(2026, 'ana').regularizacoes[0].anosEmFalta), []);
  });
});

describe('N033 — as rendas de meses depois do dia em que o contrato acabou', () => {
  test('cessado a 30/06/2026 com rendas de janeiro a agosto: as de julho e agosto apontam-se; a de junho paga em julho não', () => {
    imovel();
    contrato({ start: '2025-01-01', end: '2027-12-31', active: false }, { cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas('C1', 2026, 1000, [1, 2, 3, 4, 5]);
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2026-07-03', periodo: '2026-06', recibo: true });
    rendas('C1', 2026, 1000, [7, 8]);
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.rendasDepoisDoFim.map((x) => [x.contratoId, x.mes, x.data, x.valor, x.fim, x.imovel])),
      [['C1', '2026-07', '2026-07-05', 1000, '2026-06-30', 'T2 Lumiar'], ['C1', '2026-08', '2026-08-05', 1000, '2026-06-30', 'T2 Lumiar']]);
    assert.equal(r.totais.rendas, 8000, 'continuam na linha: só se apontam');
  });

  test('um contrato que continua, ou um não declarado, não aponta nada', () => {
    imovel();
    contrato({ start: '2025-01-01', end: '2027-12-31' });
    rendas('C1', 2026, 1000);
    assert.deepEqual(json(app.resumoFiscal(2026, 'ana').rendasDepoisDoFim), []);
    app.db.contracts[0].active = false;
    app.db.contracts[0].fisco.cessacao = { data: '2026-06-30', motivo: '02' };
    app.db.contracts[0].fisco.estado = 'naoDeclarado';
    assert.deepEqual(json(app.resumoFiscal(2026, 'ana').rendasDepoisDoFim), []);
  });
});

describe('N034 — o inquilino empresa que o contrato não diz quem lá mora', () => {
  test('com «Não»: a linha sai não habitacional (natureza 06, 4.1, 28 %), sem redução nem 10 %', () => {
    imovel();
    contrato({ tenantIds: ['emp'], start: '2025-01-01', end: '2029-12-31' }, { empresaMorador: false });
    rendas('C1', 2026, 1000, [1, 2, 3]);
    const c = app.contract('C1');
    assert.equal(app.irsEmpresaMorador(c), false);
    assert.equal(app.irsEmpresaNaoHabitacional(c), true);
    assert.equal(app.irsFinalidade(c), 'nh');
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.deepEqual(json([l.natureza, l.quadro, l.taxa, l.motivoTaxa, l.taxaReduzida, l.empresaNaoHabitacional, l.comunicacao]),
      ['06', '4.1', 28, 'nh', false, true, null]);
    perto(l.imposto, 840, 1e-9);
  });

  test('o «Não» antigo (a pergunta junta com a sublocação) conta como por responder; o «Sim» identifica', () => {
    imovel();
    contrato({ tenantIds: ['emp'], start: '2025-01-01', end: '2029-12-31' }, { empresaHabitacao: false });
    rendas('C1', 2026, 1000, [1, 2, 3]);
    const c = app.contract('C1');
    assert.equal(app.irsEmpresaMorador(c), null);
    assert.equal(linha(app.resumoFiscal(2026, 'ana'), 'C1').natureza, '07', 'sem resposta nova fica a finalidade escrita');
    c.fisco.empresaHabitacao = true;
    assert.equal(app.irsEmpresaMorador(c), true);
    c.fisco.empresaMorador = true;
    assert.equal(linha(app.resumoFiscal(2026, 'ana'), 'C1').natureza, '07');
  });

  test('o «Não» num contrato com um inquilino particular não muda nada', () => {
    imovel();
    contrato({ start: '2025-01-01', end: '2029-12-31' }, { empresaMorador: false });
    rendas('C1', 2026, 1000, [1, 2, 3]);
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(l.natureza, '07');
    assert.equal(l.empresaNaoHabitacional, false);
  });
});

describe('N101 — a redução caída toda pelo n.º 20 marca a linha', () => {
  const dez = (motivo) => {
    imovel();
    contrato({ start: '2024-01-01', end: '2033-12-31', rent: 2500, active: false },
      { celebracao: '2023-12-10', rendaAcimaDoLimite: false, cessacao: { data: '2026-06-30', motivo } });
    rendas('C1', 2024, 2500); rendas('C1', 2025, 2500); rendas('C1', 2026, 2500, [1, 2, 3, 4, 5, 6]);
  };

  test('10 anos acabados ao fim de 30 meses pelo senhorio: reducaoCaida, e a linha fica no 4.2 (D14)', () => {
    dez('01');
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(l.reducaoCaida, true);
    assert.equal(l.quadro, '4.2');
    assert.equal(l.taxa, 25);
  });

  test('por motivo do inquilino, ou com a duração decorrida ainda num escalão, não', () => {
    dez('02');
    assert.equal(linha(app.resumoFiscal(2026, 'ana'), 'C1').reducaoCaida, false);
    limpar(app);
    app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
    imovel();
    contrato({ start: '2020-01-01', end: '2029-12-31', rent: 3000, active: false }, { cessacao: { data: '2026-06-30', motivo: '01' } });
    rendas('C1', 2026, 3000, [1, 2, 3, 4, 5, 6]);
    const l = linha(app.resumoFiscal(2026, 'ana'), 'C1');
    assert.equal(l.taxa, 23, '78 meses ainda dão o escalão dos 5 anos');
    assert.equal(l.reducaoCaida, false);
  });
});

describe('N069 — a renda em atraso pela quota do mês, o IMI pela de 31 de dezembro do ano anterior', () => {
  const casa = () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 },
      quotasHist: [{ ate: '2026-06-30', ownerIds: ['ana'], ownerShares: { ana: 100 }, fora: [] }] });
    contrato({ start: '2025-01-01', end: '2029-12-31' });
    rendas('C1', 2026, 1000, [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2026-08-05', periodo: '2026-03', recibo: true });
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 400, date: '2026-11-30' });
  };

  test('a renda de março paga em agosto é toda da Ana (dona de tudo em março), e diz-se', () => {
    casa();
    const ana = app.resumoFiscal(2026, 'ana'), bruno = app.resumoFiscal(2026, 'bruno');
    perto(linha(ana, 'C1').rendas, 9000, 1e-9, 'jan. a jun. por inteiro (março incluído) e metade de jul. a dez.');
    perto(linha(bruno, 'C1').rendas, 3000, 1e-9);
    assert.equal(ana.rendasDeOutraQuota.length, 1);
    const x = ana.rendasDeOutraQuota[0];
    assert.deepEqual(json([x.contratoId, x.mes, x.data, x.valor, x.desde, x.quotaMes, x.quotaDia]), ['C1', '2026-03', '2026-08-05', 1000, '2026-07-01', 1, 0.5]);
  });

  test('o IMI pago em novembro de 2026 é o de 2025: todo da Ana, nada do Bruno', () => {
    casa();
    const ana = app.resumoFiscal(2026, 'ana'), bruno = app.resumoFiscal(2026, 'bruno');
    perto(linha(ana, 'C1').gastos.imi, 400, 1e-9);
    perto(linha(bruno, 'C1').gastos.imi, 0, 1e-9);
    assert.deepEqual(json(ana.imiDeOutraQuota.map((x) => [x.valor, x.quotaAno, x.quotaDia])), [[400, 1, 0.5]]);
  });

  test('«É a minha nota de IMI» continua a mandar: a nota inteira para quem a pagou', () => {
    casa();
    app.db.transactions.find((t) => t.sub === 'IMI').notaPropria = true;
    app.db.transactions.find((t) => t.sub === 'IMI').paidBy = 'bruno';
    perto(linha(app.resumoFiscal(2026, 'bruno'), 'C1').gastos.imi, 400, 1e-9);
    assert.deepEqual(json(app.resumoFiscal(2026, 'ana').imiDeOutraQuota), []);
  });
});

describe('N070 — o AIMI não incidiu num prédio comprado depois de 1 de janeiro', () => {
  const aimi = () => {
    imovel({ id: 'casa', name: 'Casa', vpt: 600000 });
    imovel({ id: 'v2', name: 'T2 Arroios', vpt: 400000, ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } });
    imovel({ id: 'v3', name: 'T1 Alvalade', vpt: 600000, purchaseDate: '2026-03-01' });
    contrato({ id: 'C2', name: 'Arroios', propertyId: 'v2', start: '2025-01-01', end: '2029-12-31' });
    contrato({ id: 'C3', name: 'Alvalade', propertyId: 'v3', start: '2026-04-01', end: '2031-03-31' });
    rendas('C2', 2026, 1000, null, 'v2'); rendas('C3', 2026, 1000, [4, 5, 6, 7, 8, 9, 10, 11, 12], 'v3');
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 1400, propertyId: '', paidBy: 'ana', date: '2026-09-20' });
  };

  test('o T1 comprado a 1/3/2026 sai do quadro 9 e da conta: a parte que abate é 350 €', () => {
    aimi();
    const a = app.resumoFiscal(2026, 'ana').aimi;
    assert.deepEqual(json(a.predios.map((x) => [x.imovel, x.vpt])), [['T2 Arroios', 200000]]);
    const ex = a.excluidos.find((x) => x.propertyId === 'v3');
    assert.equal(ex.motivo, 'compra');
    assert.equal(ex.porque, 'comprado depois de 1 de janeiro: o AIMI deste ano não incidiu sobre ele');
    perto(a.vptTotal, 800000, 1e-9);
    perto(a.parte, 350, 1e-9);
  });

  test('com os números da demonstração, o T1 também não pesa no numerador', () => {
    aimi();
    irs({ porAno: { 2026: { aimi: { total: 1400, valorTributavel: 800000 } } } });
    perto(app.resumoFiscal(2026, 'ana').aimi.parte, 350, 1e-9);
  });

  test('comprado a 1 de janeiro, ou sem data de compra, fica', () => {
    aimi();
    app.db.properties.find((p) => p.id === 'v3').purchaseDate = '2026-01-01';
    assert.equal(app.resumoFiscal(2026, 'ana').aimi.predios.length, 2);
    assert.equal(app.fiscoAimiExclusao({ purchaseDate: '' }, [], 2026), null);
  });
});

describe('N020 — os bens comuns do casal em conjunta, com o cônjuge sem conta', () => {
  const casal = (fora, situacao) => {
    app.db.owners = [app.normPerson({ id: 'ana', name: 'Ana' })];
    irs({ porAno: { 2026: Object.assign({ conjunta: true, bensComuns: true }, situacao || {}) } });
    imovel({ comproprietariosFora: fora });
    contrato({ start: '2025-01-01', end: '2029-12-31' });
    rendas('C1', 2026, 1000);
  };

  test('o T2 dos dois, com o Bruno escrito como dono de fora a 50 %: duas linhas, A 6 000 € e B 6 000 €', () => {
    casal([{ id: 'f1', nome: 'Bruno', quota: 50 }]);
    const r = app.resumoFiscal(2026, 'ana');
    const ls = linhas(r, 'C1');
    assert.deepEqual(json(ls.map((l) => [l.titular, l.rendas, l.conjugeFora])), [['A', 6000, false], ['B', 6000, true]]);
    assert.equal(ls[1].titularId, 'conjuge~ana');
    assert.equal(app.fiscoEhConjugeFora(ls[1].titularId), true);
    perto(r.totais.rendas, 12000, 1e-9);
    assert.deepEqual(json(r.conjugeFora), { id: 'conjuge~ana', nome: 'Bruno', letra: 'B' });
    assert.deepEqual(json(r.bensComuns), { imoveis: [{ propertyId: 'v1', imovel: 'T2 Lumiar', nome: 'Bruno', quota: 0.5 }], porDecidir: [], soMeus: [] });
    assert.deepEqual(json(r.titulares), ['ana', 'conjuge~ana']);
    assert.equal(r.semConjuge, true, 'continua sem cônjuge com conta');
  });

  test('sem a escolha nada muda: uma linha A de 6 000 €', () => {
    casal([{ id: 'f1', nome: 'Bruno', quota: 50 }], { bensComuns: false });
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(linhas(r, 'C1').map((l) => [l.titular, l.rendas])), [['A', 6000]]);
    assert.equal(r.bensComuns, null);
    assert.equal(r.conjugeFora, null);
    assert.deepEqual(json(r.titulares), ['ana']);
  });

  test('com dois donos de fora não se adivinha o cônjuge; sem nenhum, a linha fica inteira em A', () => {
    casal([{ id: 'f1', nome: 'Bruno', quota: 25 }, { id: 'f2', nome: 'Carla', quota: 25 }]);
    let r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(linhas(r, 'C1').map((l) => [l.titular, l.rendas])), [['A', 6000]]);
    assert.deepEqual(json(r.bensComuns.porDecidir), [{ propertyId: 'v1', imovel: 'T2 Lumiar', nomes: ['Bruno', 'Carla'] }]);
    app.db.properties[0].comproprietariosFora = [];
    r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(linhas(r, 'C1').map((l) => [l.titular, l.rendas])), [['A', 12000]]);
    assert.deepEqual(json(r.bensComuns.soMeus), [{ propertyId: 'v1', imovel: 'T2 Lumiar' }]);
  });

  test('donos de fora com nomes diferentes em dois imóveis: as duas linhas B, e o nome do cônjuge fica por dizer', () => {
    casal([{ id: 'f1', nome: 'Bruno', quota: 50 }]);
    imovel({ id: 'v2', name: 'T1 herdado', comproprietariosFora: [{ id: 'f2', nome: 'Carlos', quota: 50 }] });
    contrato({ id: 'C2', name: 'Herdado', propertyId: 'v2', start: '2025-01-01', end: '2029-12-31' });
    rendas('C2', 2026, 500, null, 'v2');
    const r = app.resumoFiscal(2026, 'ana');
    assert.deepEqual(json(r.bensComuns.imoveis.map((x) => [x.imovel, x.nome])), [['T1 herdado', 'Carlos'], ['T2 Lumiar', 'Bruno']]);
    assert.equal(r.conjugeFora.nome, '', 'nomes diferentes são pessoas diferentes: o aviso lista-os');
  });

  test('com um cônjuge com conta escolhido, a escolha não junta ninguém; sem conjunta também não', () => {
    casal([{ id: 'f1', nome: 'Bruno', quota: 50 }], { conjunta: false });
    assert.deepEqual(json(app.fiscoTitulares('ana', 2026).ids), ['ana']);
    app.db.owners.push(app.normPerson({ id: 'rui', name: 'Rui' }));
    irs({ porAno: { 2026: { conjunta: true, bensComuns: true, conjugeId: 'rui', minhaLetra: 'B' } } });
    const q = app.fiscoTitulares('ana', 2026);
    assert.deepEqual(json([q.ids, q.conjugeFora, q.semConjuge]), [['ana', 'rui'], false, false]);
    irs({ porAno: { 2026: { conjunta: true, bensComuns: true, minhaLetra: 'B' } } });
    assert.equal(app.fiscoLetra('conjuge~ana', 2026), 'A', 'o cônjuge leva a outra letra que não a minha');
  });
});

describe('N035 — as casas sem quotas com data com movimentos de quem já não é participante', () => {
  test('uma renda gravada pelo Bruno, que já saiu, numa casa sem histórico: pergunta-se', () => {
    imovel();
    contrato({ start: '2025-01-01', end: '2029-12-31' });
    rendas('C1', 2026, 1000, [1, 2]);
    app.db.transactions[0]._createdBy = 'bruno';
    app.db.transactions[1]._createdBy = 'ana';
    assert.deepEqual(json(app.resumoFiscal(2026, 'ana').quotasSemHistorico), [{ propertyId: 'v1', imovel: 'T2 Lumiar', autores: [{ id: 'bruno', nome: 'Bruno' }] }]);
  });

  test('com o histórico das quotas, ou sendo o autor colaborador, não', () => {
    const p = imovel();
    contrato({ start: '2025-01-01', end: '2029-12-31' });
    rendas('C1', 2026, 1000, [1]);
    app.db.transactions[0]._createdBy = 'bruno';
    p._colaboradores = [{ id: 'k1', userId: 'bruno', name: 'Bruno' }];
    assert.deepEqual(json(app.resumoFiscal(2026, 'ana').quotasSemHistorico), []);
    p._colaboradores = [];
    p.quotasHist = [{ ate: '2026-04-30', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, fora: [] }];
    assert.deepEqual(json(app.resumoFiscal(2026, 'ana').quotasSemHistorico), []);
  });
});

describe('N003 — a comunicação migrada por confirmar vai no l.comunicacao', () => {
  test('sem data e com a marca da migração: porConfirmar e a data antiga; com data, nada', () => {
    imovel();
    contrato({ start: '2024-03-01', end: '2029-02-28' }, { comunicacoesV: 2, comunicacoesPorConfirmar: { 2024: '2025-06-10' } });
    rendas('C1', 2026, 1000);
    const x = linha(app.resumoFiscal(2026, 'ana'), 'C1').comunicacao;
    assert.deepEqual(json([x.data, x.foraDePrazo, x.porConfirmar, x.dataAntiga]), ['', false, true, '2025-06-10']);
    app.db.contracts[0].fisco.comunicacoes = { 2024: '2025-02-01' };
    const y = linha(app.resumoFiscal(2026, 'ana'), 'C1').comunicacao;
    assert.equal(y.porConfirmar, undefined);
  });
});
