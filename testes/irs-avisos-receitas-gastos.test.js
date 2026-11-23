// Os avisos de «A tratar antes de entregar» das receitas, dos gastos e das
// quotas (fisco-avisos.js:fiscoAvisos) — vaga 3 do IRS, folha 2.3.3 (KAN-128):
// as rendas «Fora dos totais» e as de uma categoria renomeada, que continuam a
// declarar-se e contam nos meses (D19); as receitas que a app não conta como
// renda, com a compensação do IHRU (D05, D51); os reembolsos de um gasto (D20)
// e os do seguro num imóvel com seguro de renda (D21); a conjunta com o
// cônjuge (D31); as despesas sem imóvel (D68); o imóvel por inteiro sem os
// donos fora da app confirmados (D08) e as quotas que mudaram no ano (D29);
// as obras dos 24 meses por confirmar (D28); as despesas que contam fora do
// período por escolha (D65); e, do resumo novo, a linha das rendas antes da
// 05/02 nos avisos de cada contrato, os recibos da caução e do reembolso do
// inquilino e o que falta ao quadro 5. Os resumos são os do resumoFiscal, com
// dados na base; os que pedem um caso raro montam-se à mão, com a forma do
// contrato de interfaces.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

// um dia depois de todos os anos dos cenários, na época da entrega de 2026
const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

/* uma cópia simples, com os espaços finos dos euros (U+202F) e os rígidos
   passados a espaços normais, para os textos se escreverem à mão */
const json = (x) => JSON.parse(JSON.stringify(x).replace(/[\u00a0\u202f]/g, ' '));
const mm = (m) => String(m).padStart(2, '0');
const M12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/* um movimento na base (no imóvel v1, por omissão)
   Recebe: extra — os campos.
   Devolve: o movimento normalizado. */
const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: '2026-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};
/* o imóvel v1, da Ana, com os dados matriciais e os donos fora da app
   confirmados («Não, mais ninguém»), salvo se o teste disser outra coisa
   Recebe: extra — o que muda.
   Devolve: o imóvel normalizado. */
const imovel = (extra) => {
  const p = app.normProp(Object.assign({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'], comproprietariosFora: [],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }, extra || {}));
  app.db.properties.push(p);
  return p;
};
/* o contrato C1 no imóvel v1, declarado, de habitação permanente
   Recebe: extra — o que muda; fisco — o que muda no bloco fiscal.
   Devolve: o contrato normalizado. */
const contrato = (extra, fisco) => {
  const c = app.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'v1', tenantIds: ['t1'], rent: 1000,
    start: '2026-01-01', active: true }, extra || {}, { fisco: Object.assign({ estado: 'declarado', numero: '1234567', finalidade: 'hp',
    celebracao: '2025-12-15', comunicado: '2026-01-20' }, fisco || {}) }));
  app.db.contracts.push(c);
  return c;
};
/* as rendas de um contrato nos meses dados (todos, sem a lista), no dia 5,
   com recibo */
const rendas = (valor, meses, extra) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1',
    date: `2026-${mm(m)}-05`, periodo: `2026-${mm(m)}`, recibo: true }, extra || {})));
/* os avisos do resumo de 2026 que casam com a expressão
   Recebe: re — a expressão; eu (opcional) — quem declara ('ana').
   Devolve: os avisos (cópias simples). */
const avisos = (re, eu) => json(app.resumoFiscal(2026, eu === undefined ? 'ana' : eu).avisos).filter((a) => re.test(a.texto));
/* um resumo à mão, com a forma do contrato de interfaces
   Recebe: extra — os campos.
   Devolve: o resumo. */
const resumoMao = (extra) => Object.assign({ ano: 2026, titularId: 'ana', titulares: ['ana'], linhas: [], fora: [], semContrato: [],
  aConfirmar: [], obrasSoltas: 0, foraDoPeriodo: 0, semSessao: false, contratosSemRendas: [] }, extra);
/* uma linha do resumo à mão (a das rendas do C1)
   Recebe: extra — os campos que mudam.
   Devolve: a linha. */
const linhaMao = (extra) => Object.assign({ contratoId: 'C1', propertyId: 'v1', nome: 'C1', imovel: 'T2 Arroios', atNumero: '1234567',
  inicio: '2026-01-01', estado: 'declarado', freguesiaCodigo: '110623', tipoPredio: 'U', artigo: '4651', fracao: 'A', quota: 1,
  natureza: '07', naturezaAssumida: false, titular: 'A', titularId: 'ana', quadro: '4.1', taxa: 25, taxaEscrita: null, isencao: null,
  celebracao: '2025-12-15', acimaDoLimite: null, comunicacao: null, inquilinos: [{ id: 't1', nome: 'Tiago', nif: '123456789', pais: '' }],
  papel: 'renda', rendas: 12000, retencoes: 0, gastos: { selo: 100 }, faltas: [], recibosPorEmitir: 0, mesesEmVigor: 12, mesesComRenda: 12,
  quotas: null }, extra);
const avisosMao = (r, re) => json(app.fiscoAvisos(r)).filter((a) => re.test(a.texto));

beforeEach(() => {
  limpar(app);
  app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('D19 — as rendas fora dos totais e as de uma categoria renomeada continuam a declarar-se', () => {
  test('a Declaração diz que as rendas «Fora dos totais» estão nela (informação, sem toque)', () => {
    imovel(); contrato();
    rendas(800, [1, 2, 3, 4, 5, 6, 7, 8, 11, 12]);
    rendas(800, [9, 10], { sub: 'Renda em atraso' });
    app.toggleExc('catsIn', 'Rendas', 'Renda em atraso');
    const a = avisos(/Fora dos totais/);
    assert.deepEqual(a, [{ texto: '2 rendas de 2026 (1 600 €) estão numa categoria «Fora dos totais»: ficam fora das contas da app, mas declaram-se, e estão nesta Declaração',
      abrir: '', toca: '', nivel: 'info' }]);
  });

  test('as rendas de cada contrato, nos avisos dos meses e das retenções, escolhem-se pelo papel e não pelo nome', () => {
    imovel(); const c = contrato();
    rendas(800);
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 1600, contractId: 'C1', date: '2026-01-02' });
    mov({ kind: 'income', category: 'Reembolsos', sub: 'Inquilino', amount: 50, contractId: 'C1', date: '2026-02-20', recibo: true });
    app.toggleExc('catsIn', 'Rendas', 'Renda mensal');
    assert.equal(app.fiscoAvRendasDe(c).length, 12, 'fora dos totais continuam a ser rendas');
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    assert.equal(app.db.transactions[0].category, 'Arrendamento');
    assert.equal(app.fiscoAvRendasDe(c).length, 12, 'renomeadas continuam a ser rendas');
    assert.equal(avisos(/em vigor em 2026/).length, 0, 'nenhum mês sem renda');
  });
});

describe('D05, D51 — as receitas que a app não conta como renda', () => {
  test('a receita sem categoria nem contrato e as Outras receitas: «se são rendimentos do imóvel, declaram-se», com a natureza 02', () => {
    imovel(); contrato();
    rendas(800);
    mov({ kind: 'income', category: 'Outras receitas', amount: 1200, date: '2026-06-01', label: 'Painel publicitário' });
    mov({ kind: 'income', category: '', amount: 800, date: '2026-12-30', label: 'Renda C1' });
    const a = avisos(/não conta como renda/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, '2 receitas de 2026 dos imóveis desta declaração (2 000 €) que a app não conta como renda: Painel publicitário, 1 200 €; Renda C1, 800 €. '
      + 'Se são rendimentos do imóvel (publicidade, partes comuns, um lugar de garagem, uma renda paga por outro), declaram-se: muda-lhes a categoria para Rendas — '
      + 'a renda do contrato, ou Rendas › Outras receitas prediais (natureza 02) — e liga-as ao contrato');
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].abrir, "go('transactions')");
    assert.doesNotMatch(a[0].texto, /IHRU/, 'sem contrato anterior ao RAU não se fala do IHRU');
  });

  test('uma só, com o toque no movimento', () => {
    imovel(); contrato();
    rendas(800);
    const t = mov({ kind: 'income', category: 'Subsídios e apoios', amount: 900, contractId: 'C1', date: '2026-07-01', label: 'Programa municipal' });
    const a = avisos(/não conta como renda/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Receita de 2026 que a app não conta como renda: Programa municipal, 900 €\. Se é rendimento do imóvel .* declara-se: muda-lhe a categoria/);
    assert.equal(a[0].abrir, `txView('${t.id}')`);
    assert.equal(a[0].toca, 'camada');
  });

  test('num imóvel com um contrato anterior ao RAU, diz que a compensação do IHRU não é rendimento', () => {
    imovel(); contrato({ start: '1985-03-01', rent: 150 }, { celebracao: '1985-02-20' });
    rendas(150);
    mov({ kind: 'income', category: 'Subsídios e apoios', amount: 1800, date: '2026-07-01', label: 'Compensação IHRU' });
    const a = avisos(/não conta como renda/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /\. A compensação do IHRU aos senhorios dos contratos anteriores a 1990 \(DL 132\/2023\) não é rendimento: essa fica como está$/);
  });
});

describe('D20 — os reembolsos de um gasto', () => {
  test('o do seguro, sem seguro de renda: âmbar, «só conta o que pagaste de facto»', () => {
    imovel(); contrato();
    rendas(1000);
    const t = mov({ kind: 'income', category: 'Reembolsos', sub: 'Seguro', amount: 1200, date: '2026-05-10', label: 'Seguradora' });
    const a = avisos(/^Reembolso do seguro de 2026:/);
    assert.deepEqual(a, [{ texto: 'Reembolso do seguro de 2026: Seguradora, 1 200 €. Se reembolsa uma despesa que está nos gastos, abate-o a ela (diminui-lhe o valor): '
      + 'só conta o que pagaste de facto, e um gasto que outro pagou não é teu (CIRS art. 41.º n.º 1)', abrir: `txView('${t.id}')`, toca: 'camada', nivel: 'aviso' }]);
  });

  test('o do condomínio sem contrato já abateu ao condomínio (Q7): só se diz, sem pedir o contrato', () => {
    imovel(); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 600, date: '2026-02-10' });
    mov({ kind: 'income', category: 'Reembolsos', sub: 'Condomínio', amount: 200, date: '2026-06-10', label: 'Devolução do condomínio' });
    const a = avisos(/condomínio/);
    assert.deepEqual(a, [{ texto: 'O reembolso do condomínio de 2026 (Devolução do condomínio, 200 €) abate 200 € ao condomínio dos gastos desta declaração: um gasto que te devolveram não é teu',
      abrir: '', toca: '', nivel: 'info' }]);
    assert.ok(!a.some((x) => /liga/.test(x.texto)), 'não pede o contrato');
  });
});

describe('D21 — o reembolso do seguro num imóvel com seguro de renda', () => {
  test('pode ser a indemnização das rendas (natureza 05): diz como a declarar', () => {
    imovel(); contrato();
    rendas(1000, [1, 2, 3, 4, 5, 6]);
    mov({ kind: 'expense', category: 'Seguros', sub: 'Renda garantida', amount: 300, date: '2026-01-15' });
    const t = mov({ kind: 'income', category: 'Reembolsos', sub: 'Seguro', amount: 3000, date: '2026-12-20', label: 'Seguro de renda' });
    const a = avisos(/seguro de renda/);
    assert.deepEqual(a, [{ texto: 'Reembolso do seguro de 2026 num imóvel com seguro de renda: Seguro de renda, 3 000 €. Se compensa rendas que não recebeste, é uma indemnização (natureza 05) '
      + 'e declara-se: muda-lhe a categoria para Rendas › Indemnização e liga-a ao contrato. Se reembolsa uma despesa, abate-o a essa despesa',
      abrir: `txView('${t.id}')`, toca: 'camada', nivel: 'aviso' }]);
    assert.equal(avisos(/^Reembolso do seguro de 2026:/).length, 0, 'não se repete nos reembolsos de um gasto');
  });
});

describe('D31 — a conjunta com o cônjuge escolhido', () => {
  test('diz que entram só os imóveis do cônjuge partilhados com esta conta (informativo: não há nada a corrigir na app)', () => {
    const r = resumoMao({ titulares: ['ana', 'bruno'], linhas: [linhaMao()] });
    assert.deepEqual(avisosMao(r, /conjunta/), [{ texto: 'Tributação conjunta com Bruno: entram só os imóveis do cônjuge partilhados com esta conta. '
      + 'Os que estão só na conta de Bruno não chegam aqui: junta-os no Portal das Finanças, a partir do PDF ou do CSV da Declaração dessa conta',
      abrir: '', toca: '', nivel: 'info' }]);
    assert.equal(avisosMao(resumoMao({ titularId: undefined, titulares: ['ana'], linhas: [linhaMao()] }), /conjunta/).length, 0, 'só um titular: sem conjunta');
  });

  test('pela situação do ano, com o resumo de verdade; sem cônjuge, só a falta de antes', () => {
    imovel(); contrato();
    rendas(1000);
    app.db.settings.irs = Object.assign({}, app.db.settings.irs || {}, { porAno: { 2026: { conjunta: true, conjugeId: 'bruno', minhaLetra: 'A' } } });
    assert.equal(avisos(/imóveis do cônjuge partilhados/).length, 1);
    app.db.settings.irs.porAno = { 2026: { conjunta: true, conjugeId: '', minhaLetra: 'A' } };
    assert.equal(avisos(/imóveis do cônjuge partilhados/).length, 0);
    assert.equal(avisos(/sem o cônjuge escolhido/).length, 1);
  });
});

describe('D68 — as despesas sem imóvel', () => {
  test('não entram nos gastos: dizem-se, com o nome e o valor de cada uma', () => {
    imovel(); contrato();
    rendas(800);
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 420, propertyId: null, date: '2026-04-28', label: 'IMI T2' });
    mov({ kind: 'expense', category: 'Condomínio', amount: 600, propertyId: null, date: '2026-02-01', label: 'Condomínio' });
    const a = avisos(/sem imóvel/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^2 despesas de 2026 sem imóvel \(1 020 €\) não entram nos gastos do Anexo F: /);
    assert.match(a[0].texto, /IMI T2, 420 €/);
    assert.match(a[0].texto, /Condomínio, 600 €/);
    assert.match(a[0].texto, /Se são de um imóvel arrendado, escolhe-o na ficha de cada uma$/);
    assert.equal(a[0].nivel, 'aviso');
  });
});

describe('D08 — o imóvel por inteiro sem os donos fora da app confirmados', () => {
  test('por confirmar: âmbar, com o toque nas quotas do imóvel', () => {
    imovel({ comproprietariosFora: null }); contrato();
    rendas(800);
    const a = avisos(/por inteiro nesta declaração/);
    // o toque abre a pergunta das quotas (imovel.js:imvAbrirQuotas — N135)
    assert.deepEqual(a, [{ texto: 'Imóvel T2 Arroios: conta por inteiro nesta declaração, e não está confirmado que não há outros donos. Se a casa tem donos fora da app (um irmão, um herdeiro), '
      + 'escreve-os com a quota de cada um na ficha do imóvel, em «Há outros donos fora da app?» — cada um declara só a sua parte (CIRS art. 19.º); se é só tua, escolhe «Não, mais ninguém»',
      abrir: "imvAbrirQuotas('v1')", toca: 'camada', nivel: 'aviso' }]);
  });

  test('com «Não, mais ninguém», com os de fora escritos ou com dois donos na app, não', () => {
    const p = imovel({ comproprietariosFora: [] }); contrato();
    rendas(800);
    assert.equal(avisos(/por inteiro nesta declaração/).length, 0, '«Não, mais ninguém»');
    p.comproprietariosFora = [{ id: 'f1', nome: 'Rui', quota: 50 }];
    assert.equal(avisos(/por inteiro nesta declaração/).length, 0, 'com o irmão fora da app');
    p.comproprietariosFora = null; p.ownerIds = ['ana', 'bruno']; p.ownerShares = { ana: 50, bruno: 50 };
    assert.equal(avisos(/por inteiro nesta declaração/).length, 0, 'com dois donos na app');
  });

  test('um imóvel do quadro 5 (que arrendas e subarrendas) não: nele não és o dono', () => {
    imovel({ comproprietariosFora: null, subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 } }); contrato({ rent: 900 });
    rendas(900);
    assert.equal(avisos(/por inteiro nesta declaração/).length, 0);
  });
});

describe('D29 — as quotas que mudaram no ano', () => {
  test('o Bruno saiu a 31 de maio: diz que cada renda e cada gasto contam pela quota do seu dia (informação)', () => {
    imovel({ ownerIds: ['ana'], comproprietariosFora: [],
      quotasHist: [{ ate: '2026-05-31', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, fora: [] }] });
    contrato();
    rendas(1000);
    const a = avisos(/mudou em 2026/);
    assert.deepEqual(a, [{ texto: 'Imóvel T2 Arroios: a tua quota mudou em 2026 (50 % desde 01/01/2026 e 100 % desde 01/06/2026). '
      + 'A Declaração conta cada renda e cada gasto pela quota do dia em que entrou ou foi pago (CIRS art. 19.º)',
      abrir: "propView('v1')", toca: 'camada', nivel: 'info' }]);
  });
});

describe('D28 — as obras dos 24 meses por confirmar', () => {
  test('por responder: âmbar, e o toque abre a pergunta do contrato; com «não», só se diz porque ficam fora', () => {
    imovel(); contrato({ start: '2026-06-01' });
    rendas(1000, [6, 7, 8, 9, 10, 11, 12]);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pintura', amount: 1500, date: '2025-09-15' });
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 3000, date: '2026-01-20' });
    assert.deepEqual(avisos(/obras dos 24 meses antes/), [{ texto: 'Contrato C1: as obras dos 24 meses antes do início (4 500 €) ficam fora dos gastos até responderes, no contrato, '
      + 'se entretanto o imóvel esteve só à espera de inquilino, sem uso teu nem da família — só assim contam (CIRS art. 41.º n.º 7)',
      abrir: "ctIrParaPergunta('C1','c_fobras')", toca: 'camada', nivel: 'aviso' }]);
    app.db.contracts[0].fisco.obrasSemOutroUso = false;
    assert.deepEqual(avisos(/obras dos 24 meses antes/), [{ texto: 'Contrato C1: as obras dos 24 meses antes do início (4 500 €) não contam nos gastos — '
      + 'respondeste no contrato que, entretanto, o imóvel teve outro uso (CIRS art. 41.º n.º 7)',
      abrir: "ctIrParaPergunta('C1','c_fobras')", toca: 'camada', nivel: 'info' }]);
    app.db.contracts[0].fisco.obrasSemOutroUso = true;
    assert.equal(avisos(/obras dos 24 meses antes/).length, 0, 'com «sim» entram, e não há aviso');
  });
});

describe('D65 — as despesas que contam fora do período por escolha', () => {
  test('o condomínio de antes do contrato com a coluna escolhida: informação, com o nome e o valor', () => {
    imovel(); contrato({ start: '2026-06-01' });
    rendas(1000, [6, 7, 8, 9, 10, 11, 12]);
    const t = mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 250, irsCol: 'condominio', date: '2026-04-10', label: 'Condomínio de abril' });
    assert.deepEqual(avisos(/por teres escolhido a coluna/), [{ texto: 'Despesa de 2026 paga com o imóvel sem contrato em vigor que conta nos gastos por teres escolhido a coluna na ficha: '
      + 'Condomínio de abril, 250 €. Se não é deste período arrendado, volta a «Pela categoria» na ficha dela',
      abrir: `txView('${t.id}')`, toca: 'camada', nivel: 'info' }]);
  });
});

describe('do resumo novo — a linha das rendas, os recibos e o quadro 5', () => {
  test('um contrato com a linha 05 antes da das rendas no array: os avisos do contrato leem a das rendas', () => {
    const l05 = linhaMao({ papel: 'indemnizacao', natureza: '05', quadro: '4.1', recibosPorEmitir: 0, rendas: 900 });
    const lr = linhaMao({ quadro: '4.2', natureza: '07', taxa: 10, recibosPorEmitir: 2 });
    const a = avisosMao(resumoMao({ linhas: [l05, lr] }), /sem recibo/);
    assert.deepEqual(a, [{ texto: '2 rendas de 2026 sem recibo eletrónico emitido', abrir: "ctView('C1')", toca: 'camada', nivel: 'aviso' }]);
  });

  test('a caução e o reembolso do inquilino sem recibo: o aviso diz que também pedem recibo', () => {
    imovel(); contrato();
    rendas(1000);
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 2000, contractId: 'C1', date: '2026-01-02' });
    mov({ kind: 'income', category: 'Reembolsos', sub: 'Inquilino', amount: 240, contractId: 'C1', date: '2026-06-20' });
    const a = avisos(/sem recibo eletrónico/);
    assert.deepEqual(a, [{ texto: '2 recebimentos de 2026 sem recibo eletrónico emitido: a caução e o reembolso do inquilino também pedem recibo, como a renda',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'aviso' }]);
  });

  test('só rendas sem recibo: o texto de sempre', () => {
    imovel(); contrato();
    rendas(1000, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    rendas(1000, [11, 12], { recibo: false });
    assert.equal(avisos(/sem recibo eletrónico/)[0].texto, '2 rendas de 2026 sem recibo eletrónico emitido');
  });

  test('o quadro 5 sem o NIF do senhorio nem a renda paga: falta, com o toque na ficha do imóvel', () => {
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '', rendaMensal: 0 } }); contrato({ rent: 900 });
    rendas(900);
    assert.deepEqual(avisos(/^Quadro 5/), [{ texto: 'Quadro 5 (sublocação), contrato C1: sem NIF do senhorio e renda paga ao senhorio. '
      + 'O NIF do senhorio e a renda que lhe pagas escrevem-se na ficha do imóvel, no subarrendamento', abrir: "propView('v1')", toca: 'camada', nivel: 'falta' }]);
  });

  test('o quadro 5 com o NIF do inquilino errado: falta, com o toque no contrato', () => {
    app.db.tenants[0].nif = '123456788';
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 } }); contrato({ rent: 900 });
    rendas(900);
    assert.deepEqual(avisos(/^Quadro 5/), [{ texto: 'Quadro 5 (sublocação), contrato C1: o NIF do inquilino Tiago não bate certo. '
      + 'O inquilino liga-se no contrato, e o NIF ou o país dele escrevem-se na ficha do inquilino', abrir: "ctView('C1')", toca: 'camada', nivel: 'falta' }]);
  });
});
