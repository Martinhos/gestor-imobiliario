// Os titulares da Declaração e a quota de cada um: a quota fiscal na data de
// cada movimento, com os comproprietários fora da app abatidos (D08) e as
// quotas com data, em que quem saiu continua a contar nos dias em que era
// dono e a casa vendida antes do ano não entra (D29); em conjunta, eu e o
// cônjuge escolhido, seja qual for a letra de cada um no Rosto (D30), pela
// situação de cada ano (D91); e o AIMI do quadro 9 — inteiro para quem o
// pagou, sem quota nem peso (D32), com os dois números da demonstração de
// liquidação, e sem rústicos, sem comércio, serviços, indústria e outros
// fins (pela afetação da caderneta) e sem os prédios do PAA (D71).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, igual, perto } from './arnes.js';

const app = carregarApp({ hoje: '2027-04-15' });
afterEach(() => repor(app));

/* Limpa a base e põe os donos, dois inquilinos e as definições do IRS.
   Recebe: donos — [[id, nome]]; irs (opcional) — o bloco settings.irs.
   Devolve: nada. */
function montar(donos, irs) {
  limpar(app);
  donos.forEach(([id, name]) => app.db.owners.push(app.normPerson({ id, name })));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
  app.db.tenants.push(app.normPerson({ id: 't2', name: 'Vera', nif: '123456789' }));
  app.db.settings.irs = app.normIrsDefs(irs || {});
}

/* Um imóvel com os dados matriciais completos.
   Recebe: id; name; ownerIds; ownerShares; extra (opcional) — campos a juntar.
   Devolve: o imóvel normalizado (já na base). */
function imovel(id, name, ownerIds, ownerShares, extra) {
  const p = app.normProp(Object.assign({ id, name, ownerIds, ownerShares: ownerShares || {},
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A', vpt: 100000 }, extra || {}));
  app.db.properties.push(p);
  return p;
}

/* Um contrato declarado, habitacional.
   Recebe: id; propertyId; extra (opcional) — campos a juntar (o fisco inteiro, se vier).
   Devolve: nada. */
function contrato(id, propertyId, extra) {
  app.db.contracts.push(app.normContract(Object.assign({ id, name: id, propertyId, tenantIds: ['t1'], rent: 1000,
    start: '2024-01-01', active: true, fisco: { estado: 'declarado', numero: '1' + id.replace(/\D/g, '') + '23456', finalidade: 'hp' } },
  extra || {})));
}

/* Um movimento normalizado, já na base.
   Recebe: extra — os campos do movimento.
   Devolve: o movimento. */
function mov(extra) {
  const t = app.normTx(extra);
  app.db.transactions.push(t);
  return t;
}

/* As 12 rendas mensais de um contrato num ano (dia 5).
   Recebe: contractId; ano; valor.
   Devolve: nada. */
function rendas(contractId, ano, valor) {
  for (let m = 1; m <= 12; m++) {
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId,
      date: `${ano}-${String(m).padStart(2, '0')}-05`, recibo: true });
  }
}

/* As linhas de um resumo como [contrato, letra, titular, rendas].
   Recebe: r — o resumo.
   Devolve: array ordenado. */
const linhas = (r) => r.linhas.map((l) => [l.contratoId, l.titular, l.titularId, l.rendas])
  .sort((a, b) => (a[0] + a[2]).localeCompare(b[0] + b[2]));

describe('D08 — os comproprietários fora da app abatem à quota de quem declara', () => {
  test('a Ana com 50 % e o irmão fora da app: metade das rendas e do IMI', () => {
    montar([['ana', 'Ana']]);
    const p = imovel('v1', 'T2 herdado', ['ana'], {}, { comproprietariosFora: [{ id: 'f1', nome: 'Irmão', quota: 50 }] });
    contrato('C1', 'v1');
    rendas('C1', 2026, 800);
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, propertyId: 'v1', date: '2026-05-31' });
    perto(app.fiscoQuota(p, 'ana', '2026-05-05'), 0.5, 1e-9);
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.linhas.length, 1);
    perto(r.linhas[0].rendas, 4800, 0.01, 'a quota da Ana, não a casa toda');
    perto(r.linhas[0].gastos.imi, 150, 0.01);
    perto(r.linhas[0].quota, 0.5, 1e-9);
  });

  test('por confirmar (null) ou «não há outros» ([]): a casa toda é dela', () => {
    montar([['ana', 'Ana']]);
    const p = imovel('v1', 'T2', ['ana'], {}, { comproprietariosFora: null });
    assert.equal(app.fiscoQuota(p, 'ana', '2026-03-01'), 1);
    p.comproprietariosFora = [];
    assert.equal(app.fiscoQuota(p, 'ana', '2026-03-01'), 1);
  });

  test('por inteiro (sem saber quem és) é a parte dos donos da app, sem a dos de fora', () => {
    montar([['ana', 'Ana'], ['bruno', 'Bruno']]);
    const p = imovel('v1', 'T2', ['ana', 'bruno'], { ana: 50, bruno: 50 }, { comproprietariosFora: [{ id: 'f1', nome: 'Irmã', quota: 20 }] });
    perto(app.fiscoQuota(p, '', '2026-03-01'), 0.8, 1e-9);
    perto(app.fiscoQuota(p, 'ana', '2026-03-01'), 0.4, 1e-9);
    perto(app.fiscoQuotaNoAno(p, '', 2026), 0.8, 1e-9);
  });
});

describe('D29 — as quotas com data: cada renda pela quota do seu dia', () => {
  /* Ana e Bruno 50/50 até 30/06/2026; 75/25 desde 1/07/2026 (escritura). */
  function casal() {
    montar([['ana', 'Ana'], ['bruno', 'Bruno']]);
    const p = imovel('v1', 'T2 Arroios', ['ana', 'bruno'], { ana: 75, bruno: 25 }, {
      quotasHist: [{ ate: '2026-06-30', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, fora: [] }] });
    contrato('C1', 'v1', { start: '2025-01-01' });
    rendas('C1', 2025, 1000);
    rendas('C1', 2026, 1000);
    return p;
  }

  test('a compra de quota a meio de 2026 só muda as rendas daí em diante; 2025 fica', () => {
    const p = casal();
    perto(app.resumoFiscal(2026, 'ana').totais.rendas, 7500, 0.01, '6 × 500 + 6 × 750');
    perto(app.resumoFiscal(2026, 'bruno').totais.rendas, 4500, 0.01, '6 × 500 + 6 × 250');
    perto(app.resumoFiscal(2025, 'ana').totais.rendas, 6000, 0.01);
    perto(app.resumoFiscal(2025, 'bruno').totais.rendas, 6000, 0.01);
    perto(app.fiscoQuotaNoAno(p, 'bruno', 2026), 0.5, 1e-9, 'a maior do ano');
    perto(app.fiscoQuotaNoAno(p, 'bruno', 2027), 0.25, 1e-9);
    igual(app.fiscoDiasDasQuotas(p, 2026), ['2026-01-01', '2026-07-01']);
  });

  test('o Bruno sai em 2027: continua a declarar 2026, e a Ana não fica com a parte dele', () => {
    const p = casal();
    p.quotasHist.push({ ate: '2027-01-31', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 75, bruno: 25 }, fora: [] });
    p.ownerIds = ['ana'];
    p.ownerShares = { ana: 100 };
    app.db.owners = app.db.owners.filter((o) => o.id !== 'bruno');
    const b26 = app.resumoFiscal(2026, 'bruno');
    perto(b26.totais.rendas, 4500, 0.01);
    assert.equal(b26.imoveis, 1, 'o imóvel continua na Declaração dele de 2026');
    perto(app.resumoFiscal(2026, 'ana').totais.rendas, 7500, 0.01);
    perto(app.resumoFiscal(2025, 'ana').totais.rendas, 6000, 0.01);
    perto(app.resumoFiscal(2025, 'bruno').totais.rendas, 6000, 0.01);
  });

  test('a casa vendida antes de 1 de janeiro não entra no ano; vendida a 1 de janeiro, ou durante o ano, entra', () => {
    montar([['ana', 'Ana']]);
    const p = imovel('v1', 'T1', ['ana'], {}, { vendido: '2025-10-01' });
    contrato('C1', 'v1');
    rendas('C1', 2025, 500);
    mov({ kind: 'income', category: 'Rendas', amount: 500, contractId: 'C1', date: '2026-01-10', recibo: true });
    assert.equal(app.fiscoQuotaNoAno(p, 'ana', 2026), 0);
    assert.equal(app.fiscoQuotaNoAno(p, '', 2026), 0);
    assert.equal(app.fiscoQuotaNoAno(p, 'ana', 2025), 1);
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.imoveis, 0, 'o imóvel já não é da declaração de 2026');
    // N022: a renda recebida depois da venda é rendimento do ano em que entra (CIRS art. 8.º n.º 1): tem linha, com a venda dita
    assert.equal(r.linhas.length, 1);
    perto(r.linhas[0].rendas, 500, 0.01);
    assert.equal(r.linhas[0].vendido, '2025-10-01');
    perto(app.resumoFiscal(2025, 'ana').totais.rendas, 6000, 0.01);
    p.vendido = '2026-01-01';
    assert.equal(app.fiscoQuotaNoAno(p, 'ana', 2026), 1, 'no dia da venda ainda era dela');
  });
});

describe('D30 — em conjunta, eu e o cônjuge escolhido, seja qual for a letra', () => {
  /* A Ana (sessão) é o sujeito passivo B; o Bruno, o A. Casa comum 50/50 e uma
     só do Bruno, partilhada; e uma casa da Ana com o irmão Carlos. */
  function conjunta(sit) {
    montar([['ana', 'Ana'], ['bruno', 'Bruno'], ['carlos', 'Carlos']], { conjunta: true, porAno: { 2026: sit } });
    imovel('v1', 'Casa comum', ['ana', 'bruno'], { ana: 50, bruno: 50 });
    imovel('v2', 'Casa do Bruno', ['bruno'], {});
    imovel('v3', 'Casa dos irmãos', ['ana', 'carlos'], { ana: 50, carlos: 50 });
    contrato('C1', 'v1', { start: '2026-01-01' });
    contrato('C2', 'v2', { start: '2026-01-01', tenantIds: ['t2'] });
    contrato('C3', 'v3', { start: '2026-01-01' });
    rendas('C1', 2026, 1000);
    rendas('C2', 2026, 600);
    rendas('C3', 2026, 400);
  }

  test('a Ana B e o Bruno escolhido como cônjuge: as linhas dele com A, as dela com B, o irmão de fora', () => {
    conjunta({ conjunta: true, conjugeId: 'bruno', minhaLetra: 'B' });
    const r = app.resumoFiscal(2026, 'ana');
    igual(r.titulares, ['ana', 'bruno']);
    igual(linhas(r), [['C1', 'B', 'ana', 6000], ['C1', 'A', 'bruno', 6000], ['C2', 'A', 'bruno', 7200], ['C3', 'B', 'ana', 2400]]);
    perto(r.totais.rendas, 21600, 0.01);
    assert.equal(app.fiscoLetra('ana', 2026), 'B');
    assert.equal(app.fiscoLetra('bruno', 2026), 'A');
  });

  test('a Ana A e o Bruno B dão as mesmas rendas, só com as letras trocadas', () => {
    conjunta({ conjunta: true, conjugeId: 'bruno', minhaLetra: 'A' });
    const r = app.resumoFiscal(2026, 'ana');
    igual(linhas(r), [['C1', 'A', 'ana', 6000], ['C1', 'B', 'bruno', 6000], ['C2', 'B', 'bruno', 7200], ['C3', 'A', 'ana', 2400]]);
  });

  test('nunca «todos os de letra diferente da minha»: sem cônjuge escolhido, só eu, e diz-se', () => {
    conjunta({ conjunta: true, conjugeId: '', minhaLetra: 'B' });
    const t = app.fiscoTitulares('ana', 2026);
    igual(t.ids, ['ana'], 'nem o Bruno nem o Carlos (os dois com a letra A)');
    assert.equal(t.semConjuge, true);
    igual(app.resumoFiscal(2026, 'ana').titulares, ['ana']);
    // nos campos antigos, a Ana marcada B e os outros em A: também não se adivinha
    app.db.settings.irs = app.normIrsDefs({ conjunta: true, titulares: { ana: 'B' } });
    igual(app.fiscoTitulares('ana', 2026).ids, ['ana']);
  });

  test('um cônjuge que já não é proprietário na app não entra', () => {
    conjunta({ conjunta: true, conjugeId: 'rui', minhaLetra: 'A' });
    const t = app.fiscoTitulares('ana', 2026);
    igual(t.ids, ['ana']);
    assert.equal(t.semConjuge, true);
  });

  test('os campos antigos continuam a valer: o único marcado B, quando eu não sou B', () => {
    montar([['ana', 'Ana'], ['bruno', 'Bruno']], { conjunta: true, titulares: { bruno: 'B' } });
    igual(app.fiscoTitulares('ana', 2026).ids, ['ana', 'bruno']);
    assert.equal(app.fiscoLetra('bruno', 2026), 'B');
    assert.equal(app.fiscoLetra('ana', 2026), 'A');
  });

  test('por inteiro, a letra dos donos que tiveram quota no ano', () => {
    conjunta({ conjunta: true, conjugeId: 'bruno', minhaLetra: 'B' });
    assert.equal(app.fiscoTitularDe(app.prop('v1'), '', 2026), 'A/B');
    assert.equal(app.fiscoTitularDe(app.prop('v2'), '', 2026), 'A');
    assert.equal(app.fiscoTitularDe(app.prop('v1'), 'ana', 2026), 'B');
  });
});

describe('D91 — a situação é a de cada ano', () => {
  /* Ana com um T2 (800 €/mês) e Rui com um T1 (500 €/mês), partilhado com ela. */
  function casados(irs) {
    montar([['ana', 'Ana'], ['rui', 'Rui']], irs);
    imovel('v1', 'T2 da Ana', ['ana'], {});
    imovel('v2', 'T1 do Rui', ['rui'], {});
    contrato('C1', 'v1');
    contrato('C2', 'v2', { tenantIds: ['t2'] });
    rendas('C1', 2025, 800); rendas('C2', 2025, 500);
    rendas('C1', 2026, 800); rendas('C2', 2026, 500);
  }

  test('a conjunta ligada em 2026 não refaz a Declaração de 2025', () => {
    casados({ porAno: { 2026: { conjunta: true, conjugeId: 'rui', minhaLetra: 'A' } } });
    const r25 = app.resumoFiscal(2025, 'ana'), r26 = app.resumoFiscal(2026, 'ana');
    igual(linhas(r25), [['C1', 'A', 'ana', 9600]]);
    perto(r25.totais.rendas, 9600, 0.01);
    igual(linhas(r26), [['C1', 'A', 'ana', 9600], ['C2', 'B', 'rui', 6000]]);
    perto(r26.totais.rendas, 15600, 0.01);
    assert.equal(app.fiscoLetra('rui', 2025), 'A', 'em 2025 não há conjunta: tudo A');
  });

  test('um ano sem situação própria herda a do ano anterior mais perto', () => {
    casados({ porAno: { 2025: { conjunta: false }, 2026: { conjunta: true, conjugeId: 'rui', minhaLetra: 'B' } } });
    igual(app.fiscoTitulares('ana', 2027).ids, ['ana', 'rui']);
    igual(app.fiscoTitulares('ana', 2025).ids, ['ana']);
    assert.equal(app.fiscoLetra('ana', 2027), 'B');
  });
});

describe('D32 — o AIMI é de quem o pagou: inteiro, sem quota nem peso', () => {
  /* Ana e Bruno 50/50 num prédio arrendado (VPT 1 600 000); a Ana pagou 1 400 € de AIMI. */
  function predio(t) {
    montar([['ana', 'Ana'], ['bruno', 'Bruno']]);
    imovel('v1', 'T2 Arroios', ['ana', 'bruno'], { ana: 50, bruno: 50 }, { vpt: 1600000 });
    contrato('C1', 'v1', { start: '2026-01-01' });
    rendas('C1', 2026, 4000);
    return mov(Object.assign({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 1400, propertyId: 'v1', paidBy: 'ana', date: '2026-09-30' }, t || {}));
  }

  test('registado no imóvel partilhado conta o mesmo que sem imóvel; o Bruno, que não pagou, não tem AIMI', () => {
    const t = predio();
    perto(app.resumoFiscal(2026, 'ana').aimi.total, 1400, 0.01);
    assert.equal(app.resumoFiscal(2026, 'bruno').aimi, null);
    t.propertyId = null;
    perto(app.resumoFiscal(2026, 'ana').aimi.total, 1400, 0.01);
    // o VPT do quadro 9 continua o da quota (a matriz diz a parte de cada um)
    t.propertyId = 'v1';
    perto(app.resumoFiscal(2026, 'ana').aimi.predios[0].vpt, 800000, 0.01);
  });

  test('sem «pago por» num imóvel desta declaração conta inteiro para quem declara, e diz-se que não se sabe quem pagou', () => {
    predio({ paidBy: null });
    const a = app.resumoFiscal(2026, 'ana').aimi;
    perto(a.total, 1400, 0.01);
    assert.equal(a.semPagador.length, 1);
    perto(a.semPagador[0].valor, 1400, 0.01);
  });

  test('sem «pago por» num imóvel que não é desta declaração não conta', () => {
    montar([['ana', 'Ana'], ['bruno', 'Bruno']]);
    imovel('v1', 'T2 da Ana', ['ana'], {});
    imovel('v2', 'Casa do Bruno', ['bruno'], {});
    contrato('C1', 'v1');
    rendas('C1', 2026, 500);
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 900, propertyId: 'v2', date: '2026-09-30' });
    assert.equal(app.resumoFiscal(2026, 'ana').aimi, null);
  });

  test('o «Fora dos totais» não tira o AIMI do quadro 9', () => {
    predio();
    app.db.settings.exclude = { 'cats:Impostos/AIMI': true };
    assert.equal(app.countsInTotals(app.db.transactions.find((t) => t.sub === 'AIMI')), false);
    perto(app.resumoFiscal(2026, 'ana').aimi.total, 1400, 0.01);
  });
});

describe('D71 — o quadro 9: os prédios sobre os quais o AIMI incide, e a demonstração', () => {
  const ANO = 2025;
  /* Moradia (VPT 500 000), loja (300 000) e um terreno rústico arrendados, a
     casa própria (400 000); AIMI de 2 100 € sem imóvel, pago pela Ana. */
  function carteira(lojaExtra) {
    montar([['ana', 'Ana']]);
    imovel('v1', 'Moradia arrendada', ['ana'], {}, { vpt: 500000, afetacao: 'habitacao' });
    imovel('v2', 'Loja', ['ana'], {}, Object.assign({ vpt: 300000 }, lojaExtra || {}));
    imovel('v3', 'Casa própria', ['ana'], {}, { vpt: 400000, use: 'proprio' });
    imovel('v4', 'Terreno rústico', ['ana'], {}, { vpt: 50000, tipoPredio: 'R' });
    contrato('C1', 'v1');
    contrato('C2', 'v2', { tenantIds: ['t2'], fisco: { estado: 'declarado', numero: '222', finalidade: 'nh' } });
    contrato('C4', 'v4', { fisco: { estado: 'declarado', numero: '444', finalidade: 'nh' } });
    rendas('C1', ANO, 3000);
    rendas('C2', ANO, 1500);
    rendas('C4', ANO, 200);
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 2100, propertyId: '', paidBy: 'ana', date: ANO + '-09-20' });
  }

  test('a loja (afetação de comércio) e o rústico ficam fora da lista e do 9102, com o porquê', () => {
    carteira({ afetacao: 'comercio' });
    const a = app.resumoFiscal(ANO, 'ana').aimi;
    igual(a.predios.map((p) => [p.imovel, p.vpt]), [['Moradia arrendada', 500000]]);
    perto(a.vptArrendados, 500000);
    perto(a.vptTotal, 900000, 0.01, 'a moradia e a casa própria');
    perto(a.parte, 1166.67, 0.01, '2 100 × 500 000 / 900 000');
    igual(a.excluidos.map((x) => [x.imovel, x.motivo, x.arrendado]).sort(),
      [['Loja', 'afetacao', true], ['Terreno rústico', 'rustico', true]]);
    assert.match(a.excluidos.find((x) => x.motivo === 'afetacao').porque, /comércio/);
  });

  test('serviços, indústria e outros fins também ficam fora; a habitação e sem afetação ficam', () => {
    for (const af of ['servicos', 'industria', 'outros']) {
      carteira({ afetacao: af });
      assert.ok(!app.resumoFiscal(ANO, 'ana').aimi.predios.some((p) => p.imovel === 'Loja'), af);
    }
    // a finalidade não habitacional do contrato não decide: é a afetação da caderneta
    carteira({});
    const a = app.resumoFiscal(ANO, 'ana').aimi;
    assert.ok(a.predios.some((p) => p.imovel === 'Loja'));
    igual(a.afetacaoPorConfirmar.map((p) => p.imovel), ['Loja'], 'diz-se, para a pessoa confirmar a afetação');
  });

  test('um prédio arrendado no PAA fica fora do quadro 9', () => {
    carteira({ afetacao: 'comercio' });
    app.db.contracts.find((c) => c.id === 'C1').fisco.isencao = 'paa';
    const a = app.resumoFiscal(ANO, 'ana').aimi;
    igual(a.predios.map((p) => p.imovel), []);
    const x = a.excluidos.find((e) => e.imovel === 'Moradia arrendada');
    assert.equal(x.motivo, 'paa');
    assert.match(x.porque, /PAA/);
  });

  test('o AIMI de 700 € pago pela Ana no prédio a meias é 700 €, não 350 €', () => {
    montar([['ana', 'Ana'], ['bruno', 'Bruno']]);
    imovel('v4', 'Prédio a meias', ['ana', 'bruno'], { ana: 50, bruno: 50 }, { vpt: 1400000 });
    contrato('C1', 'v4');
    rendas('C1', ANO, 6000);
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 700, propertyId: 'v4', paidBy: 'ana', date: ANO + '-09-20' });
    perto(app.resumoFiscal(ANO, 'ana').aimi.total, 700, 0.01);
  });

  test('com os dois números da demonstração: o 9101 e o 9102 são eles, e a parte sai deles', () => {
    carteira({ afetacao: 'comercio' });
    app.db.settings.irs = app.normIrsDefs({ porAno: { [ANO]: { aimi: { total: 2500, valorTributavel: 1000000 } } } });
    const a = app.resumoFiscal(ANO, 'ana').aimi;
    igual(a.demonstracao, { total: 2500, valorTributavel: 1000000 });
    perto(a.total, 2100, 0.01, 'o pago continua à parte');
    perto(a.parte, 1250, 0.01, '2 500 × 500 000 / 1 000 000');
    // de outro ano não se herdam
    assert.equal(app.resumoFiscal(ANO + 1, 'ana').aimi, null);
  });

  test('sem demonstração, demonstracao é null; com ela e sem o AIMI registado, o quadro 9 existe', () => {
    carteira({ afetacao: 'comercio' });
    assert.equal(app.resumoFiscal(ANO, 'ana').aimi.demonstracao, null);
    app.db.transactions = app.db.transactions.filter((t) => t.sub !== 'AIMI');
    assert.equal(app.resumoFiscal(ANO, 'ana').aimi, null);
    app.db.settings.irs = app.normIrsDefs({ porAno: { [ANO]: { aimi: { total: 1800, valorTributavel: null } } } });
    const a = app.resumoFiscal(ANO, 'ana').aimi;
    assert.equal(a.n, 0);
    perto(a.total, 0);
    igual(a.demonstracao, { total: 1800, valorTributavel: null });
    perto(a.parte, 1000, 0.01, '1 800 × 500 000 / 900 000 (o 9102 estimado pela app)');
  });
});
