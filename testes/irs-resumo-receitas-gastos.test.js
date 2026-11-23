// O resumo do Anexo F (fisco-resumo.js:resumoFiscal), as receitas e os gastos —
// vaga 3 do IRS, folha 2.3.2 (KAN-128): as receitas pelo papel de cada uma
// (irs-papeis.js:irsReceitaDe) e não pelo nome — a caução como renda do ano em
// que se recebe (D03), os reembolsos do inquilino como renda e o do condomínio a
// abater ao gasto (D20), as indemnizações na natureza 05 e as outras receitas
// prediais na 02 (D21, D51), a devolução de renda a abater às rendas (D53), o
// nome e o «Fora dos totais» que já não tiram rendas (D19) e as receitas por
// classificar (D05); e os gastos — os consumos que a renda inclui (D26), as obras
// dos 24 meses por confirmar (D28), a nota de IMI própria (D32), o quadro 5 da
// sublocação (D52), as despesas que contam fora do período por escolha (D65) e as
// sem imóvel (D68).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, perto, repor } from './arnes.js';

// um dia depois de todos os anos dos cenários, na época da entrega de 2026
const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

const json = (x) => JSON.parse(JSON.stringify(x));
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
const rendas = (valor, meses, extra) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1',
    date: `2026-${mm(m)}-05`, recibo: true }, extra || {})));
const resumo = (eu) => app.resumoFiscal(2026, eu === undefined ? 'ana' : eu);
const linhaDe = (r, id, papel) => r.linhas.find((l) => l.contratoId === (id || 'C1') && (l.papel || 'renda') === (papel || 'renda'));

beforeEach(() => {
  limpar(app);
  app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('D03 — a caução é renda do ano em que se recebe, e a devolução é gasto do ano em que se devolve', () => {
  test('a caução recebida entra nas rendas da linha do contrato, com a retenção, e diz-se em l.caucao', () => {
    imovel(); contrato({ deposit: 1600 });
    rendas(800);
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 1200, retencao: 400, contractId: 'C1', date: '2026-01-02' });
    const r = resumo(), l = linhaDe(r);
    perto(l.rendas, 9600 + 1600, 1e-9);
    perto(l.retencoes, 400, 1e-9);
    perto(l.caucao, 1600, 1e-9);
    assert.equal(l.natureza, '07', 'a natureza é a da linha');
    assert.equal(l.papel, 'renda');
    assert.equal(l.recibosPorEmitir, 1, 'a caução pede recibo de renda (CIRS art. 115.º n.º 5 a))');
    perto(r.totais.rendas, 11200, 1e-9);
  });

  test('a devolução da caução, paga uns dias depois do fim do contrato, conta em Outros no ano em que se devolve', () => {
    imovel(); contrato({ start: '2025-01-01', end: '2026-06-30', active: false }, { cessacao: { data: '2026-06-30', motivo: '03' } });
    rendas(800, [1, 2, 3, 4, 5, 6]);
    mov({ kind: 'expense', category: 'Devoluções ao inquilino', sub: 'Devolução da caução', amount: 1600, date: '2026-07-05' });
    const r = resumo();
    perto(linhaDe(r).gastos.outros, 1600, 1e-9);
    assert.equal(r.foraDoPeriodo.length, 0, 'não é uma despesa da casa vazia');
  });
});

describe('D19 — o nome da categoria e o «Fora dos totais» já não tiram rendas do Anexo F', () => {
  test('renomear «Rendas» não muda o Anexo F', () => {
    imovel(); contrato();
    rendas(800);
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    assert.equal(app.db.transactions[0].category, 'Arrendamento');
    perto(resumo().totais.rendas, 9600, 1e-9);
  });

  test('a «Renda em atraso» fora dos totais continua a declarar-se, e o resumo conta-as', () => {
    imovel(); contrato();
    rendas(800, [1, 2, 3, 4, 5, 6, 7, 8, 11, 12]);
    rendas(800, [9, 10], { sub: 'Renda em atraso', date: '2026-11-20' });
    app.toggleExc('catsIn', 'Rendas', 'Renda em atraso');
    const r = resumo();
    perto(r.totais.rendas, 9600, 1e-9);
    assert.deepEqual(json(r.rendasForaDosTotais), { n: 2, valor: 1600 });
  });
});

describe('D20 — os reembolsos: do inquilino são renda; do condomínio sem contrato abatem ao condomínio; do seguro dizem-se', () => {
  test('o condomínio que o inquilino reembolsa, ligado ao contrato, é renda (com recibo)', () => {
    imovel(); contrato();
    rendas(1000);
    M12.forEach((m) => {
      mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 50, date: `2026-${mm(m)}-02` });
      mov({ kind: 'income', category: 'Reembolsos', sub: 'Condomínio', amount: 50, contractId: 'C1', date: `2026-${mm(m)}-08`, recibo: true });
    });
    const r = resumo(), l = linhaDe(r);
    perto(l.rendas, 12600, 1e-9);
    perto(l.reembolsos, 600, 1e-9);
    perto(l.gastos.condominio, 600, 1e-9);
    perto(r.totais.liquido, 12000, 1e-9);
  });

  test('o reembolso do inquilino sem recibo conta nos recibos por emitir', () => {
    imovel(); contrato();
    rendas(1000);
    mov({ kind: 'income', category: 'Reembolsos', sub: 'Inquilino', amount: 240, contractId: 'C1', date: '2026-06-20' });
    const l = linhaDe(resumo());
    perto(l.rendas, 12240, 1e-9);
    assert.equal(l.recibosPorEmitir, 1);
  });

  test('o condomínio que devolve parte da quota, sem contrato, abate ao gasto do condomínio (Q7) e diz-se', () => {
    imovel(); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 600, date: '2026-02-10' });
    const t = mov({ kind: 'income', category: 'Reembolsos', sub: 'Condomínio', amount: 200, date: '2026-06-10', label: 'Devolução do condomínio' });
    const r = resumo();
    perto(linhaDe(r).gastos.condominio, 400, 1e-9);
    perto(r.totais.rendas, 12000, 1e-9, 'não é renda');
    const e = r.reembolsosGasto.find((x) => x.txId === t.id);
    assert.ok(e, 'em reembolsosGasto');
    assert.equal(e.tipo, 'condominio');
    perto(e.valor, 200, 1e-9);
    perto(e.abatido, 200, 1e-9);
    assert.equal(e.propertyId, 'v1');
  });

  test('o seguro que paga uma reparação não é renda: fica em reembolsosGasto, sem abater sozinho', () => {
    imovel(); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 1200, date: '2026-04-10' });
    const t = mov({ kind: 'income', category: 'Reembolsos', sub: 'Seguro', amount: 1200, date: '2026-05-10', label: 'Seguradora' });
    const r = resumo();
    perto(r.totais.rendas, 12000, 1e-9);
    const e = r.reembolsosGasto.find((x) => x.txId === t.id);
    assert.ok(e && e.tipo === 'seguro' && e.abatido === 0 && e.nome === 'Seguradora');
    assert.equal(r.seguroDeRenda.length, 0, 'sem seguro de renda no imóvel');
  });
});

describe('D21, D51 — as linhas da natureza 05 e 02 do mesmo contrato', () => {
  test('a indemnização de rendas vai a uma linha 05 do contrato, sem recibo, e a renda fica na 07', () => {
    imovel(); contrato();
    rendas(1000, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    mov({ kind: 'income', category: 'Rendas', sub: 'Indemnização', amount: 3000, contractId: 'C1', date: '2026-12-20' });
    const r = resumo(), l7 = linhaDe(r), l5 = linhaDe(r, 'C1', 'indemnizacao');
    perto(l7.rendas, 9000, 1e-9);
    assert.ok(l5, 'há uma linha da indemnização');
    assert.equal(l5.natureza, '05');
    perto(l5.rendas, 3000, 1e-9);
    assert.equal(l5.recibosPorEmitir, 0, 'a indemnização não pede recibo (art. 115.º n.º 5 a) não abrange a alínea g))');
    assert.equal(l5.quadro, '4.1');
    assert.equal(l5.taxa, 25, 'à taxa base, sem a redução nem a das rendas moderadas');
    assert.equal(l7.taxa, 10, 'as rendas de 2026 até 2 300 € a 10 %');
    perto(r.totais.rendas, 12000, 1e-9);
    perto(r.totais.imposto, 900 + 750, 1e-9, '9 000 € a 10 % e 3 000 € a 25 %');
    assert.notEqual(l5.campo, l7.campo, 'cada linha tem o seu campo');
  });

  test('a cedência de uso (Outras receitas prediais) vai a uma linha 02 do contrato', () => {
    imovel(); contrato();
    rendas(800);
    mov({ kind: 'income', category: 'Rendas', sub: 'Outras receitas prediais', amount: 1200, contractId: 'C1', date: '2026-06-01' });
    const r = resumo(), l2 = linhaDe(r, 'C1', 'outra');
    assert.ok(l2 && l2.natureza === '02');
    perto(l2.rendas, 1200, 1e-9);
    perto(r.totais.rendas, 10800, 1e-9);
  });

  test('o Reembolsos › Seguro num imóvel com seguro de renda no ano fica em seguroDeRenda (pode ser a indemnização)', () => {
    imovel(); contrato();
    rendas(1000, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    mov({ kind: 'expense', category: 'Seguros', sub: 'Renda garantida', amount: 300, date: '2026-01-15' });
    const t = mov({ kind: 'income', category: 'Reembolsos', sub: 'Seguro', amount: 3000, date: '2026-12-20', label: 'Seguro de renda' });
    const r = resumo();
    assert.deepEqual(json(r.seguroDeRenda.map((x) => [x.txId, x.valor, x.propertyId])), [[t.id, 3000, 'v1']]);
    assert.ok(!r.reembolsosGasto.some((x) => x.txId === t.id), 'não se repete em reembolsosGasto');
  });
});

describe('D05, D51 — as receitas do imóvel que não são renda nem passivo ficam por classificar', () => {
  test('Outras receitas, Subsídios e uma receita sem categoria nem contrato num imóvel da declaração', () => {
    imovel(); contrato();
    rendas(800);
    const a = mov({ kind: 'income', category: 'Outras receitas', amount: 1200, date: '2026-06-01', label: 'Painel publicitário' });
    const b = mov({ kind: 'income', category: 'Subsídios e apoios', amount: 900, contractId: 'C1', date: '2026-07-01', label: 'Programa municipal' });
    const c = mov({ kind: 'income', category: '', amount: 800, date: '2026-12-30', label: 'Renda C1' });
    mov({ kind: 'income', category: 'Empréstimos recebidos', amount: 5000, date: '2026-02-01' });
    mov({ kind: 'income', category: 'Reembolsos', sub: 'Estado', amount: 50, date: '2026-02-01' });
    const r = resumo();
    perto(r.totais.rendas, 9600, 1e-9);
    assert.deepEqual(json(r.porClassificar.map((x) => [x.txId, x.valor, x.propertyId])).sort(), [[a.id, 1200, 'v1'], [b.id, 900, 'v1'], [c.id, 800, 'v1']].sort());
  });
});

describe('D53 — a devolução de renda abate às rendas da linha, e não é gasto', () => {
  test('a renda paga em duplicado e devolvida: 12 000 € de rendas, nada em Outros, nenhum recibo a mais', () => {
    imovel(); contrato();
    rendas(1000);
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2026-03-09', recibo: false });
    mov({ kind: 'expense', category: 'Devoluções ao inquilino', sub: 'Devolução de renda', amount: 1000, contractId: 'C1', date: '2026-04-02' });
    const r = resumo(), l = linhaDe(r);
    perto(l.rendas, 12000, 1e-9);
    perto(l.devolucoes, 1000, 1e-9);
    perto(l.gastos.outros, 0, 1e-9);
    assert.equal(l.recibosPorEmitir, 0);
    assert.equal(r.aConfirmar.length, 0);
  });

  test('com uma coluna escolhida à mão, a devolução não conta como gasto e abate às rendas na mesma (nunca as duas)', () => {
    imovel(); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Devoluções ao inquilino', sub: 'Devolução de renda', amount: 1000, irsCol: 'outros', date: '2026-04-02' });
    const l = linhaDe(resumo());
    perto(l.rendas, 11000, 1e-9, 'sem contrato ligado abate às linhas do imóvel');
    perto(l.gastos.outros, 0, 1e-9);
    perto(l.devolucoes, 1000, 1e-9);
  });
});

describe('D26 — os consumos só contam quando a renda os inclui', () => {
  test('com consumosIncluidos, a eletricidade do período do contrato vai a Outros; sem ele fica a confirmar', () => {
    imovel(); contrato({}, { consumosIncluidos: true });
    rendas(800);
    mov({ kind: 'expense', category: 'Água, luz e gás', sub: 'Eletricidade', amount: 60, date: '2026-05-12' });
    perto(linhaDe(resumo()).gastos.outros, 60, 1e-9);
    app.db.contracts[0].fisco.consumosIncluidos = false;
    const r = resumo();
    perto(linhaDe(r).gastos.outros, 0, 1e-9);
    assert.equal(r.aConfirmar.length, 1);
  });
});

describe('D28 — as obras dos 24 meses só entram com o imóvel à espera de inquilino confirmado', () => {
  test('por responder ficam fora, em obrasPorConfirmar; com a resposta «sim» entram', () => {
    imovel(); contrato({ start: '2026-06-01' });
    rendas(1000, [6, 7, 8, 9, 10, 11, 12]);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pintura', amount: 1500, date: '2025-09-15' });
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 3000, date: '2026-01-20' });
    let r = resumo();
    perto(linhaDe(r).obras24.valor, 0, 1e-9);
    assert.deepEqual(json(r.obrasPorConfirmar), [{ contratoId: 'C1', nome: 'C1', imovel: 'T2 Arroios', valor: 4500, inicioGastos: '2025-09-15', resposta: null }]);
    perto(linhaDe(r).gastos.conservacao, 0, 1e-9, 'e não passam a conservação');
    app.db.contracts[0].fisco.obrasSemOutroUso = false;
    r = resumo();
    perto(linhaDe(r).obras24.valor, 0, 1e-9);
    assert.equal(r.obrasPorConfirmar[0].resposta, false);
    app.db.contracts[0].fisco.obrasSemOutroUso = true;
    r = resumo();
    perto(linhaDe(r).obras24.valor, 4500, 1e-9);
    assert.equal(r.obrasPorConfirmar.length, 0);
  });
});

describe('D32 — a nota de IMI própria conta inteira para quem a pagou', () => {
  test('numa casa a 50/50, a nota da Ana (2 000 €) conta inteira na dela e nada na do Bruno', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } }); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 2000, paidBy: 'ana', notaPropria: true, date: '2026-04-28' });
    perto(linhaDe(resumo('ana')).gastos.imi, 2000, 1e-9);
    perto(linhaDe(resumo('bruno')).gastos.imi, 0, 1e-9);
    perto(linhaDe(resumo('')).gastos.imi, 2000, 1e-9, 'por inteiro conta uma vez');
  });

  test('sem a marca, o IMI do prédio continua pela quota', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } }); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 4000, paidBy: 'ana', date: '2026-04-28' });
    perto(linhaDe(resumo('ana')).gastos.imi, 2000, 1e-9);
  });
});

describe('D52 — a sublocação vai ao quadro 5, sem gastos', () => {
  test('arrendo por 600 € e subarrendo por 900 €: quadro 5 com a diferença e nada no 4.1', () => {
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 } }); contrato({ rent: 900 });
    rendas(900);
    M12.forEach((m) => mov({ kind: 'expense', category: 'Condomínio', amount: 50, date: `2026-${mm(m)}-01` }));
    const r = resumo();
    assert.equal(r.linhas.length, 0, 'nada no 4.1 nem no 4.2');
    assert.equal(r.quadro5.length, 1);
    const q = r.quadro5[0];
    assert.equal(q.contratoId, 'C1');
    perto(q.rendaRecebida, 10800, 1e-9);
    perto(q.rendaPaga, 7200, 1e-9);
    perto(q.liquido, 3600, 1e-9);
    assert.equal(q.nifSenhorio, '123456789');
    assert.equal(q.natureza, '02', 'subarrendamento habitacional');
    // N053: em 2026 o quadro 5 testa as rendas moderadas como as linhas (900 € ≤ 2 300 €): 10 % da diferença, por confirmar pela AT
    assert.equal(q.motivoTaxa, 'moderada');
    assert.equal(q.moderadaPorConfirmar, true);
    perto(q.imposto, 360, 1e-9);
    perto(r.totais.imposto, 360, 1e-9, 'o imposto estimado conta com o quadro 5');
    perto(r.totais.quadro5.rendaRecebida, 10800, 1e-9);
    perto(r.totais.rendas, 0, 1e-9, 'as rendas dos quadros 4.1 e 4.2 não');
  });
});

describe('D65 — as despesas da casa vazia que contam por a coluna ter sido escolhida à mão dizem-se', () => {
  test('o condomínio de antes do contrato: pela categoria fica fora; com a coluna escolhida conta, e vai a foraPorEscolha', () => {
    imovel(); contrato({ start: '2026-06-01' });
    rendas(1000, [6, 7, 8, 9, 10, 11, 12]);
    mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 250, date: '2026-03-10' });
    const t = mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 250, irsCol: 'condominio', date: '2026-04-10', label: 'Condomínio de abril' });
    const r = resumo();
    perto(linhaDe(r).gastos.condominio, 250, 1e-9);
    assert.equal(r.foraDoPeriodo.length, 1);
    assert.deepEqual(json(r.foraPorEscolha.map((x) => [x.txId, x.nome, x.valor])), [[t.id, 'Condomínio de abril', 250]]);
  });
});

describe('D68 — as despesas sem imóvel dizem-se', () => {
  test('o IMI e o condomínio registados «Sem imóvel» vão a semImovel; o AIMI e o não dedutível não', () => {
    imovel(); contrato();
    rendas(800);
    const a = mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 420, propertyId: null, date: '2026-04-28' });
    const b = mov({ kind: 'expense', category: 'Condomínio', amount: 600, propertyId: null, date: '2026-02-01' });
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 300, propertyId: null, date: '2026-09-01' });
    mov({ kind: 'expense', category: 'Mobiliário e equipamento', sub: 'Mobiliário', amount: 300, propertyId: null, date: '2026-09-01' });
    const r = resumo();
    assert.deepEqual(json(r.semImovel.map((x) => [x.txId, x.valor])).sort(), [[a.id, 420], [b.id, 600]].sort());
  });
});

describe('D59 — o inquilino que mora fora de Portugal', () => {
  test('um número fiscal estrangeiro com o país não é a falta «não bate certo»; sem país, é', () => {
    assert.equal(app.fiscoFaltaDoInquilino('Lucía', 'X1234567L', 'Espanha'), '', 'o NIF português fica em branco e vai o país');
    assert.equal(app.fiscoFaltaDoInquilino('Lucía', '123456788', 'Portugal'), 'NIF do inquilino Lucía não bate certo');
    assert.equal(app.fiscoFaltaDoInquilino('Lucía', '123456788', ''), 'NIF do inquilino Lucía não bate certo');
    assert.equal(app.fiscoFaltaDoInquilino('Lucía', '', ''), 'NIF ou país do inquilino Lucía');
    assert.equal(app.fiscoFaltaDoInquilino('Lucía', '', 'Espanha'), '');
    assert.equal(app.fiscoFaltaDoInquilino('Rui', '123456789', ''), '');
  });
});

describe('D30 — o subtítulo da página diz a letra do cônjuge no Rosto, como o PDF', () => {
  test('o cônjuge pode ser o A: a página não diz sempre «titular B»', () => {
    const r = { porInteiro: false, titularId: 'eu' };
    const eu = { titularId: 'eu', titular: 'B', quota: 1 }, cj = { titularId: 'cj', titular: 'A', quota: 1 };
    assert.equal(app.fiscoParte(r, [eu, cj]), 'a tua parte e a do titular A');
    assert.equal(app.fiscoParte(r, [cj]), 'a parte do titular A');
    assert.equal(app.fiscoParte(r, [eu, { titularId: 'cj', titular: 'B', quota: 1 }]), 'a tua parte e a do titular B');
    assert.equal(app.fiscoParte({ porInteiro: true }, [eu]), 'valores por inteiro');
  });
});
