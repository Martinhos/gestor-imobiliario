// A divisão nas vistas dos movimentos: um movimento de grupo, visto com um
// filtro por imóvel ou por proprietário, mostra a parte que cabe a essa vista
// — na linha, no saldo do mês, nos indicadores, nas evoluções e na ordenação —
// e diz de que total é parte. E a auditoria das divisões: entre imóveis em
// todos os modos, por proprietário dentro de um movimento de grupo, e as
// contas entre donos que daí saem. Um cêntimo aqui é uma discussão.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, perto, repor } from './arnes.js';

// a app vive num dia fixo: as evoluções são «mês a mês em YEAR», e o ano dos
// movimentos tem de ser o da app
const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
const soma = (a) => a.reduce((x, y) => x + y, 0);
/* Ao cêntimo: meio cêntimo de tolerância.
   Recebe: a, b, msg — como o perto.
   Devolve: nada — falha a asserção com os dois números à vista. */
const cent = (a, b, msg) => perto(a, b, 0.005, msg);

let casa, casa2;
/* A Ana tem dois imóveis num grupo: o T2 com o Bruno (um sócio a 30 %) e o T3
   só dela. A Carla não é dona de nenhum. */
beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }), app.normPerson({ id: 'carla', name: 'Carla' }));
  casa = app.normProp({ id: 'casa', name: 'T2', value: 200000, purchase: 150000, ownerIds: ['ana', 'bruno'] });
  casa.ownerShares = { ana: 70, bruno: 30 };
  casa2 = app.normProp({ id: 'casa2', name: 'T3', value: 100000, purchase: 50000, ownerIds: ['ana'] });
  app.db.properties.push(casa, casa2);
  app.db.groups.push(app.normGroup({ id: 'G', name: 'Bloco', kind: 'prop', ids: ['casa', 'casa2'] }));
  app.txFilter = ''; app.txProp = ''; app.txPaid = ''; app.txCat = ''; app.txSub = ''; app.txSearch = '';
  app.txDe = ''; app.txAte = ''; app.txSort = 'date'; app.txDir = 'desc'; app.txNoPayer = true;
});
/* um movimento na base; por omissão uma despesa de 200 € em março paga pela Ana */
const mov = (extra) => {
  const t = app.normTx(Object.assign({ kind: 'expense', label: 'Seguro', amount: 200, date: '2026-03-10', paidBy: 'ana' }, extra));
  app.db.transactions.push(t);
  return t;
};
/* o mesmo, no grupo Bloco */
const grupo = (extra) => mov(Object.assign({ groupId: 'G' }, extra || {}));
/* o bloco de um cartão de resumo da vista dos movimentos, pelo rótulo */
function cartao(html, rotulo) {
  const b = html.split('<div class="card kpi').find((x) => x.includes('<div class="label">' + rotulo + '</div>'));
  assert.ok(b, 'há um cartão «' + rotulo + '»');
  return b;
}
const kpiValor = (html, rotulo) => (cartao(html, rotulo).match(/<div class="value[^"]*">([^<]*)<\/div>/) || [])[1];
const kpiId = (html, rotulo) => (cartao(html, rotulo).match(/id="(k\d+)"/) || [])[1];
const SINAL = app.KIND.expense.sign;

describe('valorNaVista: o valor como os filtros o veem', () => {
  test('sem filtro, o total', () => {
    const t = grupo();
    assert.equal(app.valorNaVista(t), 200);
  });

  test('filtrado por um imóvel do grupo, a parte desse imóvel', () => {
    const t = grupo();
    app.txProp = 'casa';
    assert.equal(app.valorNaVista(t), 100, 'em partes iguais por omissão');
    app.txProp = 'casa2';
    assert.equal(app.valorNaVista(t), 100);
    const u = grupo({ psplit: { mode: 'pct', parts: { casa: 3, casa2: 1 } } });
    app.txProp = 'casa';
    assert.equal(app.valorNaVista(u), 150, 'a divisão escolhida no movimento manda');
    app.txProp = 'casa2';
    assert.equal(app.valorNaVista(u), 50);
  });

  test('filtrado pelo grupo, a soma das partes é o total', () => {
    const t = grupo({ psplit: { mode: 'pct', parts: { casa: 3, casa2: 1 } } });
    app.txProp = 'g:G';
    assert.equal(app.valorNaVista(t), 200);
  });

  test('filtrado por proprietário, a parte do dono em cada imóvel do grupo', () => {
    const t = grupo();
    app.ownerFilter = 'ana';
    cent(app.valorNaVista(t), 170, '70 % do T2 e o T3 inteiro');
    app.ownerFilter = 'bruno';
    cent(app.valorNaVista(t), 30, 'só os 30 % do T2: o T3 não é dele');
  });

  test('imóvel e proprietário: a parte do dono nesse imóvel', () => {
    const t = grupo();
    app.txProp = 'casa'; app.ownerFilter = 'bruno';
    cent(app.valorNaVista(t), 30);
    app.ownerFilter = 'ana';
    cent(app.valorNaVista(t), 70);
  });

  test('«sem imóvel» é mesmo sem imóvel: passa sem filtro e em «Sem imóvel atribuído», inteiro, e um filtro por imóvel deixa-o de fora', () => {
    const t = mov({ amount: 50, paidBy: null });   // sem imóvel nem grupo
    app.txProp = '__none__';
    assert.ok(app.txMatch(t), 'passa no filtro «sem imóvel»');
    assert.equal(app.valorNaVista(t), 50);
    app.txProp = '';
    assert.ok(app.txMatch(t), 'e sem filtro');
    assert.equal(app.valorNaVista(t), 50, 'e vale por inteiro — não há por onde o dividir');
    app.txProp = 'casa';
    assert.ok(!app.txMatch(t), 'um filtro por imóvel deixa-o de fora: não é de nenhum imóvel');
    app.txProp = 'g:G';
    assert.ok(!app.txMatch(t), 'nem o filtro pelo grupo');
    app.txProp = ''; app.ownerFilter = 'ana';
    assert.ok(!app.txMatch(t), 'nem o de um proprietário: não é de nenhum imóvel dele');
  });

  test('um acerto vale sempre por inteiro', () => {
    const t = mov({ kind: 'settle', amount: 50, propertyId: 'casa', paidBy: 'bruno', toId: 'ana' });
    app.ownerFilter = 'bruno';
    assert.equal(app.valorNaVista(t), 50);
    app.txProp = 'casa';
    assert.equal(app.valorNaVista(t), 50);
    assert.equal(app.fraseDaParte(t), '');
  });

  test('um imóvel apagado do grupo: reparte-se pelos que restam; um grupo sem imóveis: o total', () => {
    app.db.groups[0].ids = ['casa', 'casa2', 'fantasma'];
    const t = grupo();
    app.txProp = 'casa';
    assert.equal(app.valorNaVista(t), 100, 'metade, pelos dois que existem — como a ficha');
    assert.match(app.txFicha(t.id), /T2 · 100,00/);
    app.txProp = '';
    app.db.groups.push(app.normGroup({ id: 'vazio', name: 'Vazio', kind: 'prop', ids: [] }));
    const v = grupo({ groupId: 'vazio' });
    assert.equal(app.valorNaVista(v), 200, 'não há por onde dividir: o total, e não 0 €');
    app.txProp = 'g:vazio';
    assert.ok(app.txMatch(v));
    assert.equal(app.valorNaVista(v), 200);
    assert.equal(app.fraseDaParte(v), '');
  });
});

describe('a linha: a parte, e de que total é parte', () => {
  test('sem corte, o total e nenhuma frase', () => {
    const t = grupo();
    const html = app.txLinhaHtml(t, '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(200)), 'o total, com o sinal');
    assert.doesNotMatch(html, /parte de|a tua parte/);
    const fino = mov({ amount: 10.0051, propertyId: 'casa' });   // três decimais não são um corte
    assert.equal(app.valorNaVista(fino), 10.01);
    assert.equal(app.fraseDaParte(fino), '');
  });

  test('filtrado por um imóvel do grupo: a parte e «parte de <grupo> · total …»', () => {
    const t = grupo();
    app.txProp = 'casa';
    const html = app.txLinhaHtml(t, '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(100)), 'a parte do T2');
    assert.ok(!html.includes(SINAL + app.euro2(200)), 'e não o total como valor');
    assert.ok(html.includes('parte de Bloco · total ' + app.euro2(200)), html);
  });

  test('filtrado por proprietário: «a tua parte · total …»', () => {
    const t = grupo();
    app.ownerFilter = 'bruno';
    const html = app.txLinhaHtml(t, '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(30)));
    assert.ok(html.includes('a tua parte · total ' + app.euro2(200)), html);
    assert.doesNotMatch(html, /a tua parte em/, 'sem filtro por imóvel não se nomeia nenhum');
  });

  test('imóvel e proprietário: «a tua parte em <imóvel> · total …»', () => {
    const t = grupo();
    app.txProp = 'casa'; app.ownerFilter = 'bruno';
    const html = app.txLinhaHtml(t, '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(30)));
    assert.ok(html.includes('a tua parte em T2 · total ' + app.euro2(200)), html);
  });

  test('num movimento de um só imóvel, o filtro de proprietário corta pela quota, e o de imóvel não corta', () => {
    const t = mov({ propertyId: 'casa', amount: 100 });
    app.txProp = 'casa';
    let html = app.txLinhaHtml(t, '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(100)));
    assert.doesNotMatch(html, /parte de|a tua parte/, 'é todo deste imóvel');
    app.ownerFilter = 'bruno';
    html = app.txLinhaHtml(t, '2026-03');
    assert.ok(html.includes(SINAL + app.euro2(30)));
    assert.ok(html.includes('a tua parte · total ' + app.euro2(100)), html);
    assert.doesNotMatch(html, /a tua parte em/, 'o imóvel não cortou nada: não se nomeia');
  });

  test('o filtro pelo grupo não corta, e a frase muda com o filtro (a assinatura da linha viva)', () => {
    const t = grupo();
    app.txProp = 'g:G';
    const inteira = app.txLinhaHtml(t, '2026-03');
    assert.ok(inteira.includes(SINAL + app.euro2(200)));
    assert.doesNotMatch(inteira, /parte de|a tua parte/);
    app.txProp = 'casa';
    assert.notEqual(app.txLinhaHtml(t, '2026-03'), inteira, 'mudar o filtro muda o HTML: a lista viva refaz a linha');
  });

  test('a pesquisa casa o total escrito, não a parte', () => {
    const t = grupo();
    app.txProp = 'casa';
    app.txSearch = '200';
    assert.ok(app.txMatch(t));
    app.txSearch = '100';
    assert.ok(!app.txMatch(t));
  });
});

describe('os indicadores, o saldo do mês, as evoluções e a ordenação', () => {
  let I, G, B, C, A;
  beforeEach(() => {
    I = mov({ kind: 'income', label: 'Renda', amount: 1000, propertyId: 'casa', date: '2026-03-05' });
    G = grupo();                                                                          // 200: 100 no T2
    B = mov({ label: 'Obras', amount: 150, propertyId: 'casa', date: '2026-03-12' });
    C = mov({ label: 'Luz', amount: 50, propertyId: 'casa', date: '2026-03-20' });
    A = mov({ label: 'Água', amount: 40, propertyId: 'casa2', date: '2026-04-02' });
  });

  test('os indicadores somam as partes', () => {
    let html = app.vTransactions();
    assert.equal(kpiValor(html, 'Despesas'), app.euro(440), 'sem filtro, tudo inteiro');
    assert.equal(kpiValor(html, 'Saldo'), app.euro(560));
    app.txProp = 'casa';
    html = app.vTransactions();
    assert.equal(kpiValor(html, 'Receitas'), app.euro(1000));
    assert.equal(kpiValor(html, 'Despesas'), app.euro(300), '100 do grupo, 150 e 50 do imóvel');
    assert.equal(kpiValor(html, 'Saldo'), app.euro(700));
    app.txProp = ''; app.ownerFilter = 'bruno';
    html = app.vTransactions();
    assert.equal(kpiValor(html, 'Receitas'), app.euro(300), '30 % da renda');
    assert.equal(kpiValor(html, 'Despesas'), app.euro(90), '30 % de 100+150+50');
  });

  test('o saldo do mês soma as partes', () => {
    const marco = () => app.db.transactions.filter(app.txMatch).filter((t) => t.date.startsWith('2026-03'));
    cent(soma(marco().map(app.saldoNaVista)), 1000 - 200 - 150 - 50);
    app.txProp = 'casa';
    cent(soma(marco().map(app.saldoNaVista)), 1000 - 100 - 150 - 50);
    app.txProp = ''; app.ownerFilter = 'bruno';
    cent(soma(marco().map(app.saldoNaVista)), 300 - 30 - 45 - 15);
  });

  test('as evoluções somam as partes', () => {
    app.txProp = 'casa';
    const html = app.vTransactions();
    const desp = app.KPI_REG[kpiId(html, 'Despesas')].evo();
    cent(soma(desp.monthly), 300);
    cent(desp.yearly.find((y) => y.label === 2026).value, 300);
    const saldo = app.KPI_REG[kpiId(html, 'Saldo')].evo();
    cent(soma(saldo.monthly), 700);
  });

  test('a ordenação por montante usa a parte', () => {
    app.txSort = 'amount'; app.txDir = 'desc';
    app.vTransactions();
    igual(app.txLista.map((t) => t.id), [I.id, G.id, B.id, C.id, A.id], 'sem filtro, o grupo (200) vale mais do que as obras (150)');
    app.txProp = 'casa';
    app.vTransactions();
    igual(app.txLista.map((t) => t.id), [I.id, B.id, G.id, C.id], 'no T2 o grupo vale 100: entre as obras e a luz');
    app.txDir = 'asc';
    app.vTransactions();
    igual(app.txLista.map((t) => t.id), [C.id, G.id, B.id, I.id]);
  });

  test('um movimento fora dos totais não entra, cortado ou não', () => {
    const cau = grupo({ kind: 'income', label: 'Caução', category: 'Rendas', sub: 'Caução', amount: 400 });
    assert.ok(!app.countsInTotals(cau));
    app.txProp = 'casa';
    assert.equal(app.saldoNaVista(cau), 0);
    assert.equal(app.valorNaVista(cau), 200, 'a linha mostra a parte na mesma');
    assert.equal(kpiValor(app.vTransactions(), 'Receitas'), app.euro(1000));
  });
});

describe('auditoria: a divisão entre imóveis', () => {
  test('em cada modo as partes somam o total, batem com a ficha e com txPropShare', () => {
    const casos = [
      [null, [10000, 10000]],
      [{ mode: 'equal', parts: {} }, [10000, 10000]],
      [{ mode: 'pct', parts: { casa: 3, casa2: 1 } }, [15000, 5000]],
      [{ mode: 'percent', parts: { casa: 25, casa2: 75 } }, [5000, 15000]],
      [{ mode: 'amount', parts: { casa: 120.5, casa2: 79.5 } }, [12050, 7950]],
      [{ mode: 'adjust', parts: { casa: 50 } }, [12500, 7500]],
      [{ mode: 'value', parts: {} }, [13333, 6667]],
      [{ mode: 'purchase', parts: {} }, [15000, 5000]],
    ];
    for (const [psplit, esperado] of casos) {
      const t = grupo({ psplit });
      const c = app.psplitCents(t, [casa, casa2], 20000);
      const modo = psplit ? psplit.mode : 'omissão';
      igual(c, esperado, modo);
      assert.equal(c[0] + c[1], 20000, modo);
      cent(app.txPropShare(t, 'casa') * 200, c[0] / 100, modo);
      cent(app.txPropShare(t, 'casa2') * 200, c[1] / 100, modo);
      const ficha = app.txFicha(t.id);
      assert.ok(ficha.includes('T2 · ' + app.euro2(c[0] / 100)), modo + ': a ficha diz o mesmo do T2');
      assert.ok(ficha.includes('T3 · ' + app.euro2(c[1] / 100)), modo + ': e do T3');
      app.txProp = 'casa';
      cent(app.valorNaVista(t), c[0] / 100, modo + ': a lista diz o mesmo');
      app.txProp = '';
    }
  });

  test('ao cêntimo: 33,33 € em partes iguais dá 16,67 e 16,66, nunca 16,66 e 16,66', () => {
    const t = grupo({ amount: 33.33 });
    const c = app.psplitCents(t, [casa, casa2], 3333);
    igual(c.slice().sort(), [1666, 1667]);
    app.txProp = 'casa';
    const a = app.valorNaVista(t);
    app.txProp = 'casa2';
    cent(a + app.valorNaVista(t), 33.33, 'as duas partes da lista somam o total');
  });

  test('modo valor certo acima do total reparte o total ao cêntimo (entre imóveis e entre donos)', () => {
    /* 10,01 € com 6,67 + 6,67 pedidos: arredondar cada um à escala dava 5,01 + 5,01 = 10,02 */
    const t = grupo({ amount: 10.01, psplit: { mode: 'amount', parts: { casa: 6.67, casa2: 6.67 } } });
    const c = app.psplitCents(t, [casa, casa2], 1001);
    assert.equal(c[0] + c[1], 1001);
    const d = mov({ amount: 10.01, propertyId: 'casa', split: { mode: 'amount', parts: { ana: 6.67, bruno: 6.67 } } });
    const s = app.txSplitCents(d, casa, ['ana', 'bruno']);
    assert.equal(s[0] + s[1], 1001);
  });

  test('txPropShare e txW somam um pelo grupo', () => {
    const t = grupo({ psplit: { mode: 'pct', parts: { casa: 7, casa2: 3 } } });
    cent(app.txPropShare(t, 'casa') + app.txPropShare(t, 'casa2'), 1);
    cent(app.txW(t, 'g:G'), 1);
    assert.equal(app.txPropShare(t, 'fantasma'), 0, 'um imóvel fora do grupo não leva nada');
  });
});

describe('auditoria: a parte do proprietário num movimento de grupo', () => {
  test('txWeight dá a parte do dono dentro de cada imóvel, e 0 onde não é dono', () => {
    const t = grupo();
    app.ownerFilter = 'ana';
    perto(app.txWeight(t, 'casa', true), 0.35, 1e-9, '70 % da metade do T2');
    perto(app.txWeight(t, 'casa2', true), 0.5, 1e-9, 'o T3 é só dela');
    perto(app.txWeight(t, null, true), 0.85, 1e-9);
    perto(app.txWeight(t, 'g:G', true), 0.85, 1e-9);
    app.ownerFilter = 'bruno';
    perto(app.txWeight(t, 'casa', true), 0.15, 1e-9);
    assert.equal(app.txWeight(t, 'casa2', true), 0, 'não é dono do T3');
    perto(app.txWeight(t, null, true), 0.15, 1e-9, 'no âmbito dele só há o T2');
    app.ownerFilter = 'carla';
    assert.equal(app.txWeight(t, 'casa', true), 0);
    assert.equal(app.txWeight(t, null, true), 0);
    assert.ok(!app.txMatch(t), 'e a lista nem o mostra a quem não é dono de nenhum imóvel do grupo');
  });

  test('a divisão própria do movimento manda dentro de cada imóvel', () => {
    const t = grupo({ split: { mode: 'pct', parts: { bruno: 100 } } });
    app.ownerFilter = 'bruno';
    perto(app.txWeight(t, 'casa', true), 0.5, 1e-9, 'o T2 inteiro é do Bruno');
    cent(app.valorNaVista(t), 100);
    app.ownerFilter = 'ana';
    assert.equal(app.txWeight(t, 'casa', true), 0, 'no T2 a Ana não leva nada');
    perto(app.txWeight(t, 'casa2', true), 0.5, 1e-9, 'no T3 ela é a única: fica com a parte toda');
    cent(app.valorNaVista(t), 100);
  });

  test('a parte do dono na lista bate com a ficha ao cêntimo', () => {
    /* era um cêntimo de diferença: a quota em fração (1/3 de 100 €) dava 33,33 à
       Ana, e a ficha e as contas entre donos dão-lhe 33,34 */
    app.db.properties.push(app.normProp({ id: 'tres', name: 'T1', ownerIds: ['ana', 'bruno', 'carla'] }));
    const t = mov({ amount: 100, propertyId: 'tres' });
    const ficha = app.txFicha(t.id);
    assert.match(ficha, /Ana · 33,34/);
    assert.match(ficha, /Bruno · 33,33/);
    app.ownerFilter = 'ana';
    assert.equal(app.valorNaVista(t), 33.34);
    app.ownerFilter = 'bruno';
    assert.equal(app.valorNaVista(t), 33.33);
    app.ownerFilter = 'carla';
    assert.equal(app.valorNaVista(t), 33.33);
  });
});

describe('auditoria: contas entre donos num movimento de grupo', () => {
  test('cada imóvel reparte a sua parte pelos seus donos, quem pagou fica a crédito e a soma é zero', () => {
    grupo();                                       // 200 pagos pela Ana: 100 no T2 (70/30), 100 no T3 (só dela)
    const b = app.ownerBalances(null);
    cent(b.ana, 30); cent(b.bruno, -30);
    cent(soma(Object.values(b)), 0);
    const t2 = app.ownerBalances('casa');
    cent(t2.ana, 30); cent(t2.bruno, -30);
    cent(app.ownerBalances('casa2').ana, 0, 'no T3 pagou a si própria');
    igual(app.ownerBalances('g:G'), JSON.parse(JSON.stringify(b)), 'o grupo em foco tem os mesmos saldos');
  });

  test('a divisão entre imóveis escolhida no movimento entra nas contas', () => {
    grupo({ psplit: { mode: 'pct', parts: { casa: 3, casa2: 1 } } });   // 150 no T2, 50 no T3
    const b = app.ownerBalances(null);
    cent(b.ana, 45, '150 pagos, 105 seus'); cent(b.bruno, -45);
    cent(soma(Object.values(b)), 0);
  });

  test('um pagador que não é dono de um dos imóveis do grupo fica a crédito na mesma', () => {
    grupo({ paidBy: 'bruno' });                    // dono do T2, não do T3
    let b = app.ownerBalances(null);
    cent(b.bruno, 170, '100 do T3 mais os 70 da Ana no T2'); cent(b.ana, -170);
    cent(soma(Object.values(b)), 0);
    const t3 = app.ownerBalances('casa2');
    cent(t3.bruno, 100); cent(t3.ana, -100);
    app.db.transactions.length = 0;
    grupo({ paidBy: 'carla' });                    // não é dona de nenhum
    b = app.ownerBalances(null);
    cent(b.carla, 200); cent(b.ana, -170); cent(b.bruno, -30);
    cent(soma(Object.values(b)), 0);
    /* e o acerto no imóvel salda-a, mesmo não sendo dona dele */
    mov({ kind: 'settle', amount: 100, propertyId: 'casa2', paidBy: 'ana', toId: 'carla', date: '2026-03-20' });
    const depois = app.ownerBalances('casa2');
    cent(depois.ana, 0); cent(depois.carla, 0);
  });

  test('com o filtro de proprietário só entram as partes dos imóveis dele', () => {
    grupo({ paidBy: 'bruno' });
    app.ownerFilter = 'bruno';
    const b = app.ownerBalances(null);
    cent(b.bruno, 70, 'só o T2: pagou 100, 30 eram seus'); cent(b.ana, -70);
    cent(soma(Object.values(b)), 0);
  });

  test('balanceLines conta o mesmo que ownerBalances', () => {
    grupo({ paidBy: 'carla', psplit: { mode: 'pct', parts: { casa: 3, casa2: 1 } } });
    mov({ kind: 'income', amount: 500, propertyId: 'casa', paidBy: 'bruno', date: '2026-03-15' });
    const eff = {};
    app.balanceLines(null).forEach((l) => l.os.forEach((o) => { eff[o] = (eff[o] || 0) + (l.eff[o] || 0) / 100; }));
    const b = app.ownerBalances(null);
    for (const k of Object.keys(b)) cent(eff[k] || 0, b[k], k);
    cent(soma(Object.values(b)), 0);
  });
});
