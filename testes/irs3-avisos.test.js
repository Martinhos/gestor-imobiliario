// Os avisos de «A tratar antes de entregar» das correções da auditoria ao IRS
// de raiz, ronda 2 (fisco-avisos.js:fiscoAvisos, KAN-150 a KAN-154): o aviso
// dos donos responde-se no próprio sítio, um por imóvel, com «É só meu» e «Há
// outros donos» (N065); o dos recibos marca as N como emitidas, com
// confirmação e Anular (N062); os toques de vários movimentos abrem os
// Movimentos filtrados e o do selo abre a despesa já preenchida (N134); a
// caução devolvida num ano sem rendas (N024); as receitas sem imóvel nem
// categoria (N027) e as lançadas noutra conta da casa (N006); o reembolso do
// Estado (N071) e o do seguro com as duas hipóteses (N072); as rendas
// estimadas (N079); a renda constante abaixo da do contrato (N080); as rendas
// moderadas — o que entrou e a renda do contrato de lados diferentes do
// limite, os pagamentos de vários meses, os quartos da mesma fração (N013,
// N054); a dispensa dos recibos do ano (N055); o código da união de
// freguesias extinta (N087); as despesas pagas sem contrato, com o nome e o
// valor (N047), e as «a confirmar» da casa vazia (N048); os encargos do
// inquilino (N111); a divisão própria longe das quotas (N115); a parte
// arrendada de um imóvel por quartos (N012); a sublocação sem a parte (N023);
// o 6A no ano da conclusão (N091); a regularização dos anos sem regras
// (N125); e o contrato sem inquilino (N036). Os resumos são os do
// resumoFiscal, com dados na base, ou montados à mão com a forma combinada
// com o resumo.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

// na época da entrega das rendas de 2026
const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

/* uma cópia simples, com os espaços finos dos euros (U+202F) e os rígidos
   passados a espaços normais, para os textos se escreverem à mão */
const json = (x) => JSON.parse(JSON.stringify(x).replace(/[  ]/g, ' '));
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
/* um imóvel (v1, da Ana, por omissão), com os dados matriciais e os donos
   fora da app confirmados, salvo se o teste disser outra coisa
   Recebe: extra — o que muda.
   Devolve: o imóvel normalizado. */
const imovel = (extra) => {
  const p = app.normProp(Object.assign({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'], comproprietariosFora: [],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }, extra || {}));
  app.db.properties.push(p);
  return p;
};
/* um contrato (C1 no imóvel v1, por omissão), declarado, de habitação
   permanente
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
   com recibo
   Recebe: valor; meses (opcional); ano (opcional, 2026); extra (opcional). */
const rendas = (valor, meses, ano, extra) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1',
    date: `${ano || 2026}-${mm(m)}-05`, recibo: true }, extra || {})));
/* os avisos do resumo de um ano (2026 por omissão) que casam com a expressão
   Recebe: re — a expressão; ano (opcional).
   Devolve: os avisos (cópias simples). */
const avisos = (re, ano) => json(app.resumoFiscal(ano || 2026, 'ana').avisos).filter((a) => re.test(a.texto));
/* um resumo à mão, com a forma do resumo */
const resumoMao = (extra) => Object.assign({ ano: 2026, titularId: 'ana', titulares: ['ana'], linhas: [], fora: [], semContrato: [],
  aConfirmar: [], obrasSoltas: 0, foraDoPeriodo: [], semSessao: false, contratosSemRendas: [] }, extra);
/* uma linha do resumo à mão (a das rendas do C1) */
const linhaMao = (extra) => Object.assign({ contratoId: 'C1', propertyId: 'v1', nome: 'C1', imovel: 'T2 Arroios', atNumero: '1234567',
  inicio: '2026-01-01', estado: 'declarado', freguesiaCodigo: '110623', tipoPredio: 'U', artigo: '4651', fracao: 'A', quota: 1,
  natureza: '07', naturezaAssumida: false, titular: 'A', titularId: 'ana', quadro: '4.1', taxa: 25, taxaEscrita: null, isencao: null,
  celebracao: '2025-12-15', acimaDoLimite: null, comunicacao: null, inquilinos: [{ id: 't1', nome: 'Tiago', nif: '123456789', pais: '' }],
  papel: 'renda', rendas: 12000, retencoes: 0, gastos: { selo: 100 }, faltas: [], recibosPorEmitir: 0, mesesEmVigor: 12, mesesComRenda: 12,
  quotas: null, beneficios: [], dhd: null, freguesiaUniao: null, matrizConfirmada: '' }, extra);
const avisosMao = (r, re) => json(app.fiscoAvisos(r)).filter((a) => re.test(a.texto));
/* todos os avisos de um resumo à mão (cópias simples) */
const todosMao = (r) => json(app.fiscoAvisos(r));

beforeEach(() => {
  limpar(app);
  app.definirServicosDesligados([]);
  app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('as ações no próprio aviso (D8: N065, N062)', () => {
  test('N065: o aviso dos donos é um por imóvel, pergunta «há mais donos além de ti?» e traz «É só meu» e «Há outros donos»', () => {
    imovel({ comproprietariosFora: null }); imovel({ id: 'v2', name: 'T1 Graça', comproprietariosFora: null });
    contrato(); contrato({ id: 'C2', name: 'C2', propertyId: 'v2' });
    rendas(1000); rendas(800, M12, 2026, { contractId: 'C2', propertyId: 'v2' });
    const a = avisos(/há mais donos além de ti/);
    assert.equal(a.length, 2, 'um por imóvel, nunca um «são todos só meus»');
    const v1 = a.find((x) => /^Imóvel T2 Arroios/.test(x.texto)), v2 = a.find((x) => /^Imóvel T1 Graça/.test(x.texto));
    assert.equal(v1.nivel, 'aviso');
    assert.match(v1.texto, /^Imóvel T2 Arroios: há mais donos além de ti\? Conta por inteiro nesta declaração\. /);
    assert.match(v1.texto, /um irmão, um herdeiro, o teu cônjuge se o imóvel está em nome dos dois/);
    assert.equal(v1.acao, "imvSoMeu('v1')");
    assert.equal(v1.acaoTexto, 'É só meu');
    assert.equal(v1.abrir, "imvAbrirQuotas('v1','sim')");
    assert.equal(v1.abrirTexto, 'Há outros donos');
    assert.equal(v2.acao, "imvSoMeu('v2')");
    // «É só meu» grava a resposta e o aviso desse imóvel some
    app.imvSoMeu('v1');
    const b = avisos(/há mais donos além de ti/);
    assert.equal(b.length, 1);
    assert.match(b[0].texto, /^Imóvel T1 Graça: /);
    // com os Imóveis desligados, nem ação nem toque
    app.definirServicosDesligados(['properties']);
    const c = avisos(/há mais donos além de ti/);
    assert.equal(c[0].abrir, '');
    assert.equal(c[0].acao, undefined);
  });

  test('N062: o aviso dos recibos marca as N como emitidas (com confirmação e Anular) e «Ver as rendas» abre as do contrato', () => {
    imovel(); contrato();
    rendas(1000, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 2026, { recibo: false });
    rendas(1000, [12]);
    const a = avisos(/sem recibo eletrónico emitido/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^11 rendas de 2026 sem recibo eletrónico emitido\. Se já emitiste os recibos no Portal das Finanças, marca-os aqui; se não, emite-os lá primeiro$/);
    assert.equal(a[0].acao, "fiscoAvMarcarRecibos(2026,'ana')");
    assert.equal(a[0].acaoTexto, 'Marcar as 11 como emitidas');
    assert.equal(a[0].abrir, "goMovimentos('2026','v1','rendas','income','C1')");
    assert.equal(a[0].abrirTexto, 'Ver as rendas');
    // a ação pergunta (o que marca: o que já se emitiu) e, no OK, marca as 11
    let pergunta = null, anular = null;
    app.confirmModal = (titulo, html, cb) => { pergunta = { titulo, html }; cb(); };
    app.comDesfazer = (msg, f) => { anular = f; };
    app.fiscoAvMarcarRecibos(2026, 'ana');
    assert.equal(pergunta.titulo, 'Marcar os 11 recibos como emitidos');
    assert.match(pergunta.html, /Marcas que já emitiste no Portal das Finanças/);
    assert.match(pergunta.html, /A app não emite recibos/);
    assert.equal(app.db.transactions.filter((t) => !t.recibo).length, 0);
    assert.equal(avisos(/sem recibo eletrónico emitido/).length, 0);
    anular();
    assert.equal(app.db.transactions.filter((t) => !t.recibo).length, 11, 'o Anular devolve-as a por emitir');
  });

  test('N062: com uma renda, «Marcar como emitido»; com os Movimentos desligados, sem ação', () => {
    imovel(); contrato();
    rendas(1000, [1], 2026, { recibo: false });
    const a = avisos(/sem recibo eletrónico emitido/);
    assert.equal(a[0].acaoTexto, 'Marcar como emitido');
    assert.equal(a[0].abrirTexto, 'Ver a renda');
    app.definirServicosDesligados(['transactions']);
    const b = avisos(/sem recibo eletrónico emitido/);
    assert.equal(b[0].acao, undefined);
    assert.equal(b[0].abrir, '');
  });
});

describe('os toques que levam ao sítio onde se resolve (N134)', () => {
  test('o selo abre a despesa já preenchida: o imóvel, Impostos › Imposto do selo pelo id, 10 % da renda e o último dia do prazo', () => {
    imovel(); contrato(); rendas(1000);
    const a = avisos(/não há imposto do selo nos gastos/);
    assert.equal(a.length, 1);
    assert.equal(a[0].abrir, "txNovaDespesaCom('v1','impostos/imposto-do-selo','100.00','2026-02-28','Imposto do selo · C1')");
    assert.equal(a[0].abrirTexto, 'Adicionar o selo');
    assert.match(a[0].texto, /em Impostos › Imposto do selo, com o dia em que o pagaste$/);
  });

  test('dois contratos sem selo: um aviso por contrato, cada um com a sua despesa', () => {
    imovel(); contrato(); contrato({ id: 'C2', name: 'C2', rent: 600 });
    rendas(1000); rendas(600, M12, 2026, { contractId: 'C2' });
    const a = avisos(/não há imposto do selo nos gastos/);
    assert.equal(a.length, 2);
    assert.match(a[1].abrir, /^txNovaDespesaCom\('v1','impostos\/imposto-do-selo','60\.00',/);
  });

  test('nenhum aviso abre a lista dos movimentos sem filtro: os meses dobrados abrem as rendas do contrato', () => {
    imovel(); contrato();
    rendas(1000, [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2026-04-20', recibo: true });
    mov({ kind: 'expense', category: 'Outros', amount: 50, date: '2026-05-01' });
    mov({ kind: 'expense', category: 'Outros', amount: 70, date: '2026-06-01' });
    const xs = json(app.resumoFiscal(2026, 'ana').avisos);
    assert.equal(xs.filter((a) => a.abrir === "go('transactions')").length, 0);
    const d = xs.find((a) => /abril de 2026 com 2 rendas .* confirma a que mês respeita cada renda: os meses e o limite das rendas moderadas contam-se por ele/.test(a.texto));
    assert.ok(d, 'há o aviso dos meses dobrados');
    assert.equal(d.abrir, "goMovimentos('2026','v1','rendas','income','C1')");
    const o = xs.find((a) => /^Outros: 2 despesas/.test(a.texto));
    assert.ok(o, 'há o aviso das «a confirmar»');
    assert.equal(o.abrir, "goMovimentos('2026','v1','Outros','expense','')");
  });
});

describe('as receitas (N024, N027, N006, N071, N072, N079)', () => {
  test('N024: a caução devolvida num ano sem rendas do imóvel diz o valor e o que fazer', () => {
    const r = resumoMao({ caucoesSemLinha: [{ txId: 'cx', contratoId: 'C1', nome: 'C1', propertyId: 'v1', imovel: 'T2 Arroios', data: '2026-01-15',
      valor: 2000, total: 2000, parte: 2000, vendido: '' }] });
    const a = avisosMao(r, /caução devolvida/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'aviso');
    assert.match(a[0].texto, /^Contrato C1: a caução devolvida a 15\/01\/2026 \(2 000 €\) é gasto de 2026 \(Ofício-Circulado 20256\), mas o imóvel T2 Arroios não tem rendas em 2026/);
    assert.match(a[0].texto, /mandam não indicar prédios que não deram rendas\. Confirma com a AT como a declarar/);
    assert.match(a[0].texto, /CIRS art\. 55\.º/);
    assert.equal(a[0].abrir, "txView('cx')");
    // numa casa a meias, a parte de quem declara
    const b = avisosMao(resumoMao({ caucoesSemLinha: [{ txId: 'cx', contratoId: null, nome: 'Devolução', propertyId: 'v1', imovel: 'T2 Arroios',
      data: '2026-01-15', valor: 1000, total: 2000, vendido: '2025-12-20' }] }), /caução devolvida/);
    assert.match(b[0].texto, /^Imóvel T2 Arroios: a caução devolvida a 15\/01\/2026 \(2 000 € — a tua parte: 1 000 €\).*o imóvel T2 Arroios \(vendido a 20\/12\/2025\)/);
  });

  test('N027: uma receita sem imóvel nem categoria diz que, se é renda, se escolhe o imóvel, o contrato e as Rendas', () => {
    const r = resumoMao({ porClassificar: [{ txId: 'r1', nome: 'Renda João novembro', valor: 700, propertyId: null, data: '2026-11-05',
      contratoId: null, categoria: '', sub: '', semImovel: true }] });
    const a = avisosMao(r, /sem imóvel nem categoria/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Receita de 2026 sem imóvel nem categoria: Renda João novembro, 700 €. Não entra na Declaração: se é uma renda, escolhe na ficha dela o imóvel, o contrato e a categoria Rendas');
    assert.equal(a[0].abrir, "txView('r1')");
    assert.equal(avisosMao(r, /dos imóveis desta declaração|que a app não conta como renda/).length, 0);
  });

  test('N006: a receita lançada por outra conta da casa diz quem a lançou, e o toque leva a quem a pode classificar', () => {
    app.db.transactions.push({ id: 'rb', kind: 'income', amount: 800, date: '2026-02-05', propertyId: 'v1', category: 'Arrendamento',
      sub: 'Renda mensal', _createdBy: 'bruno' });
    const r = resumoMao({ porClassificar: [{ txId: 'rb', nome: 'Arrendamento › Renda mensal', valor: 800, propertyId: 'v1', data: '2026-02-05',
      contratoId: null, categoria: 'Arrendamento', sub: 'Renda mensal' }] });
    app.podeEditar = () => false;
    const a = avisosMao(r, /lançada por/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Receita de 2026 lançada por Bruno noutra conta, que a app não conta como renda: Arrendamento › Renda mensal, 800 €\. /);
    assert.match(a[0].texto, /só quem a lançou a pode mudar — pede a Bruno que o faça$/);
    assert.equal(a[0].abrir, "personView('owner','bruno')");
    assert.equal(a[0].abrirTexto, 'Abrir proprietário');
    assert.equal(avisosMao(r, /muda-lhe a categoria/).length, 0, 'não manda mudar a categoria a quem não a lançou');
    // quem a pode alterar abre o movimento
    app.podeEditar = () => true;
    const b = avisosMao(r, /lançada por/);
    assert.match(b[0].texto, /podes mudá-la na ficha, ou pedir a Bruno que o faça$/);
    assert.equal(b[0].abrir, "txView('rb')");
  });

  test('N071: o reembolso do Estado abate a um imposto deduzido, e o do IRS não conta', () => {
    const r = resumoMao({ reembolsosGasto: [{ txId: 'e1', nome: 'IMI devolvido', valor: 250, propertyId: 'v1', data: '2026-09-10', tipo: 'estado',
      sub: 'Estado', abatido: 0, impostosNosGastos: 600 }] });
    const a = avisosMao(r, /Reembolso do Estado/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Reembolso do Estado de 2026: IMI devolvido, 250 €\. Se devolve um imposto ou uma taxa que está nos gastos \(o IMI, o imposto do selo, as taxas autárquicas\), abate-o a essa despesa/);
    assert.match(a[0].texto, /O reembolso do IRS não conta/);
    assert.match(a[0].texto, /de um ano anterior, confirma com a AT/);
    assert.equal(avisosMao(r, /Reembolso do seguro/).length, 0, 'não é o texto do seguro');
    // sem impostos nos gastos do imóvel (o reembolso do IRS lançado num imóvel), não
    r.reembolsosGasto[0].impostosNosGastos = 0;
    assert.equal(avisosMao(r, /Reembolso do Estado/).length, 0);
  });

  test('N072: o reembolso do seguro diz sempre as duas hipóteses, a indemnização das rendas e o reembolso de uma despesa', () => {
    const r = resumoMao({ reembolsosGasto: [{ txId: 's1', nome: 'Seguro paga 3 rendas', valor: 3000, propertyId: 'v1', data: '2026-10-05', tipo: 'seguro',
      sub: 'Seguro', abatido: 0 }] });
    const a = avisosMao(r, /Reembolso do seguro/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /Se compensa rendas que não recebeste \(um seguro de renda\), é uma indemnização \(natureza 05\) e declara-se: muda-lhe a categoria para Rendas › Indemnização e liga-a ao contrato\./);
    assert.match(a[0].texto, /Se reembolsa uma despesa que está nos gastos, abate-o a ela/);
  });

  test('N079: as rendas do ano registadas por estimativa dão um aviso por contrato, com o número e o valor', () => {
    imovel(); contrato();
    rendas(1000, M12, 2026, { tags: ['Estimativa'] });
    const a = avisos(/por estimativa/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'aviso');
    assert.match(a[0].texto, /^Contrato C1: 12 rendas de 2026 \(12 000 €\) foram registadas por estimativa — com a renda de hoje e no dia previsto de cada mês — e contam na Declaração como recebidas\./);
    assert.match(a[0].texto, /Confere cada uma com os recibos \(o valor, o dia em que entrou, os meses que não foram pagos\) e, conferidas, tira a cada uma a etiqueta «Estimativa»/);
    assert.equal(a[0].abrir, "goMovimentos('2026','v1','rendas','income','C1')");
    // sem a etiqueta, nada
    app.db.transactions.forEach((t) => { t.tags = []; });
    assert.equal(avisos(/por estimativa/).length, 0);
  });
});

describe('as rendas (N080, N013, N054, N055)', () => {
  test('N080: as rendas do ano inteiro todas abaixo da do contrato, com recibo, perguntam se a renda do contrato está certa', () => {
    imovel(); contrato();
    rendas(950);
    const a = avisos(/A renda do contrato está certa\?/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Contrato C1: as rendas de 2026 têm todas 950 €, abaixo da renda do contrato \(1 000 €\), com o recibo emitido\. /);
    assert.match(a[0].texto, /regista em cada mês a renda do recibo, e a comissão como despesa/);
    assert.equal(a[0].abrir, "goMovimentos('2026','v1','rendas','income','C1')");
  });

  test('N080: se a renda subiu depois (as rendas seguintes já são a do contrato), não', () => {
    imovel(); contrato();
    rendas(950); rendas(1000, [1, 2, 3, 4], 2027);
    assert.equal(avisos(/A renda do contrato está certa\?/).length, 0);
  });

  test('N013: o que entrou cabe no limite e a renda do contrato não — a app diz que mede o que entrou e manda confirmar', () => {
    imovel(); contrato({ rent: 2500 });
    rendas(2000);
    const a = avisos(/no limite das rendas moderadas/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'aviso');
    assert.match(a[0].texto, /^Contrato C1: no limite das rendas moderadas \(2 300 € por mês\), a app mede o que entrou — 2 000 € por mês \(24 000 € em 12 meses em vigor\) — e a renda do contrato é 2 500 €: o que entrou cabe no limite e a renda do contrato não\. A app dá a taxa de 10 %/);
    assert.match(a[0].texto, /DL 97\/2026, art\. 3\.º n\.º 3/);
  });

  test('N013: a renda paga ao trimestre não manda registar «as outras» rendas', () => {
    imovel(); contrato({ rent: 800 });
    [1, 4, 7, 10].forEach((m) => mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 2400, contractId: 'C1', date: `2026-${mm(m)}-05`, recibo: true }));
    const a = avisos(/em vigor em 2026 e só/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /há pagamentos de vários meses num movimento: não registes as rendas outra vez — parte cada pagamento num movimento por mês/);
    assert.doesNotMatch(a[0].texto, /se recebeste as outras, regista-as/);
    // e os meses a dobrar dizem que são pagamentos de vários meses, a partir por mês
    const d = avisos(/vários meses num movimento\?/);
    assert.equal(d.length, 1);
    assert.match(d[0].texto, /são pagamentos de vários meses num movimento\? Parte-os num movimento por mês, com o mês a que respeita cada um: os meses e o limite das rendas moderadas contam-se assim/);
  });

  test('N054: os quartos do mesmo imóvel que somam mais do que o limite, cada um abaixo dele, dão um aviso com os contratos e a soma', () => {
    imovel({ name: 'T4 Graça' });
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((id) => {
      contrato({ id, name: 'Quarto ' + id.slice(1), rent: 700 });
      rendas(700, M12, 2026, { contractId: id });
    });
    const a = avisos(/somam .* por mês/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Imóvel T4 Graça: os 4 contratos em vigor em janeiro de 2026 somam 2 800 € por mês \(Quarto 1, 700 €; Quarto 2, 700 €; Quarto 3, 700 €; Quarto 4, 700 €\), acima do limite das rendas moderadas \(2 300 €\), e cada um cabe nele\./);
    assert.match(a[0].texto, /a AT pode medir a renda pela fração inteira: confirma-o antes de entregar$/);
    assert.equal(a[0].abrir, "propView('v1')");
  });

  test('N055: a dispensa dos recibos lê-se do ano da Declaração (o cartão da situação), e não do campo antigo', () => {
    imovel(); contrato(); rendas(1000, M12, 2026, { recibo: false });
    app.fiscoSetSituacao(2026, 'dispensaRecibos', true);
    assert.equal(avisos(/sem recibo eletrónico emitido/).length, 0);
    assert.equal(avisos(/^Modelo 44: tens dispensa/).length, 1);
    // conta antiga: o campo de topo ligado, e o ano de 2026 desligado no cartão
    app.db.settings.irs.dispensaRecibos = true;
    app.fiscoSetSituacao(2026, 'dispensaRecibos', false);
    assert.equal(avisos(/^Modelo 44: tens dispensa/).length, 0);
    assert.equal(avisos(/12 rendas de 2026 sem recibo eletrónico emitido/).length, 1);
  });
});

describe('os imóveis e o quadro 5 (N087, N023, N036)', () => {
  test('N087: o código de uma união extinta é falta nas declarações de 2025 em diante, mesmo com «Confirmei na caderneta»', () => {
    const u = { codigo: '111126', nome: 'U.F. QUELUZ E BELAS', repostas: [{ codigo: '111130', nome: 'BELAS' }, { codigo: '111133', nome: 'QUELUZ' }] };
    const r = resumoMao({ linhas: [linhaMao({ freguesiaCodigo: '111126', freguesiaUniao: u, matrizConfirmada: '2026-03-01' })] });
    const a = avisosMao(r, /união de freguesias/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'falta');
    assert.match(a[0].texto, /^Imóvel T2 Arroios: o código da freguesia, 111126, é o de uma união de freguesias desagregada em outubro de 2025 \(Lei 25-A\/2025\) e deixou de existir\. O prédio passou para uma destas: 111130 BELAS ou 111133 QUELUZ/);
    assert.match(a[0].texto, /Escolhe a freguesia reposta/);
    assert.match(a[0].texto, /A marca «Confirmei na caderneta» não chega/);
    assert.doesNotMatch(a[0].texto, /se estão certos/);
    assert.equal(a[0].abrir, "imvAbrirNoCampo('v1','p_freguesiaCodigo')");
    assert.equal(a[0].abrirTexto, 'Corrigir o código');
    // sem a confirmação, a mesma falta, sem a frase da marca
    const b = avisosMao(resumoMao({ linhas: [linhaMao({ freguesiaCodigo: '111126', freguesiaUniao: u })] }), /união de freguesias/);
    assert.equal(b[0].nivel, 'falta');
    assert.doesNotMatch(b[0].texto, /Confirmei na caderneta/);
  });

  test('N023: a sublocação sem a parte subarrendada dita avisa que a renda paga só abate na parte, com o toque na pergunta', () => {
    const r = resumoMao({ quadro5: [{ contratoId: 'S1', nome: 'Quarto', imovel: 'T3 Anjos', propertyId: 'v1', rendaRecebida: 4800, rendaPaga: 14400,
      faltas: [], semParte: true, parteSub: '' }] });
    const a = avisosMao(r, /só abate na parte que subarrendas/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'aviso');
    assert.match(a[0].texto, /^Quadro 5 \(sublocação\), imóvel T3 Anjos: a renda paga ao senhorio só abate na parte que subarrendas, e a ficha não diz se é a casa toda\. A app conta a renda inteira \(14 400 €, contra 4 800 € recebidos\), e por isso o rendimento fica negativo\. /);
    assert.equal(a[0].abrir, "imvAbrirNoCampo('v1','p_sub_parte')");
    assert.equal(a[0].abrirTexto, 'Responder');
    r.quadro5[0].semParte = false; r.quadro5[0].parteSub = 'parte';
    assert.equal(avisosMao(r, /só abate na parte que subarrendas/).length, 0);
  });

  test('N036: uma linha sem inquilino é falta, com o NIF que o quadro pede', () => {
    const r = resumoMao({ linhas: [linhaMao({ inquilinos: [] })] });
    const a = avisosMao(r, /sem inquilino/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'falta');
    assert.match(a[0].texto, /^Contrato C1: sem inquilino, e a linha do quadro 4\.1 do Anexo F pede o NIF do inquilino \(ou o país de residência de quem não tem NIF português\)\. Liga-o no contrato/);
    assert.equal(a[0].abrir, "ctView('C1')");
    // com o resumo de verdade: o inquilino apagado do contrato
    imovel(); contrato(); rendas(1000);
    app.db.tenants.length = 0;
    assert.equal(avisos(/sem inquilino/).length, 1);
  });
});

describe('os gastos (N047, N048, N111, N115, N012, N024)', () => {
  test('N047: as despesas pagas sem contrato em vigor dizem o nome, o valor, o imóvel e o intervalo, e abrem-se', () => {
    const fp = (txId, nome, valor) => ({ txId, nome, data: '2026-09-10', valor, propertyId: 'v1', imovel: 'T2 Arroios', col: 'outros',
      semContratoDe: '2026-07-01', semContratoAte: '' });
    const r = resumoMao({ foraDoPeriodo: [fp('d1', 'Certificado energético', 180), fp('d2', 'Comissão de arrendamento', 1230)] });
    const a = avisosMao(r, /sem contrato em vigor/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^2 despesas de 2026 \(1 410 €\) pagas com o imóvel T2 Arroios sem contrato em vigor \(desde 01\/07\/2026\) ficam fora dos gastos: Certificado energético, 180 €; Comissão de arrendamento, 1 230 €\. Só conta o período arrendado\./);
    assert.equal(a[0].abrir, "goMovimentos('2026','v1','','expense','')");
    const b = avisosMao(resumoMao({ foraDoPeriodo: [fp('d1', 'Certificado energético', 180)] }), /sem contrato em vigor/);
    assert.match(b[0].texto, /^Despesa de 2026 paga com o imóvel T2 Arroios sem contrato em vigor \(desde 01\/07\/2026\) fica fora dos gastos: Certificado energético, 180 €/);
    assert.equal(b[0].abrir, "txView('d1')");
  });

  test('N048: uma despesa «a confirmar» paga com a casa vazia propõe «Não dedutível», e não escolher a coluna', () => {
    const r = resumoMao({ aConfirmar: [
      { txId: 'a1', nome: 'Advogado', data: '2026-09-05', valor: 900, propertyId: 'v1', imovel: 'T2 Arroios', categoria: 'Serviços profissionais', sub: '', origem: 'mapa', semContrato: true },
      { txId: 'a2', nome: 'Contabilista', data: '2026-03-05', valor: 200, propertyId: 'v1', imovel: 'T2 Arroios', categoria: 'Serviços profissionais', sub: '', origem: 'mapa' }] });
    const a = avisosMao(r, /^Serviços profissionais/);
    assert.equal(a.length, 2, 'as da casa vazia à parte');
    const vazia = a.find((x) => /sem contrato em vigor/.test(x.texto));
    assert.match(vazia.texto, /^Serviços profissionais: 1 despesa de 2026 a confirmar paga com o imóvel sem contrato em vigor — Advogado, 900 €\. Não conta nos gastos: só conta o período arrendado\. Escolhe «Não dedutível» na ficha dela/);
    assert.doesNotMatch(vazia.texto, /a coluna do Anexo F \(ou Não dedutível\)/);
    assert.equal(vazia.abrir, "txView('a1')");
    const outra = a.find((x) => x !== vazia);
    assert.match(outra.texto, /Escolhe na ficha dela a coluna do Anexo F \(ou Não dedutível\)/);
  });

  test('N111: o encargo que o contrato põe a cargo do inquilino e está nos gastos diz as duas hipóteses (sem o IMI)', () => {
    const r = resumoMao({ encargosDoInquilino: [
      { contratoId: 'C1', nome: 'C1', propertyId: 'v1', imovel: 'T2 Arroios', encargo: 'condominio', encargoNome: 'Condomínio', n: 12, valor: 720, nosGastos: 720, txIds: ['k1', 'k2'] },
      { contratoId: 'C1', nome: 'C1', propertyId: 'v1', imovel: 'T2 Arroios', encargo: 'imi', encargoNome: 'IMI', n: 1, valor: 320, nosGastos: 320, txIds: ['i1'] }] });
    const a = avisosMao(r, /do inquilino, e há/);
    assert.equal(a.length, 1, 'o IMI paga-o sempre o dono à AT');
    assert.match(a[0].texto, /^Contrato C1: o contrato diz que o condomínio é do inquilino, e há 720 € de condomínio nos gastos de 2026 \(12 despesas\)\. Se foste tu a pagar, está certo — e o que o inquilino te devolve é renda; se pagou ele, não são gastos teus/);
    assert.equal(a[0].abrir, "goMovimentos('2026','v1','','expense','')");
  });

  test('N115: a divisão própria longe da quota diz que conta a quota de cada dono, aos dois donos', () => {
    const d = (divisao, conta) => resumoMao({ divisoesProprias: [{ txId: 'p1', nome: 'Pintura', data: '2026-05-05', valor: 1000, propertyId: 'v1', imovel: 'T2 Arroios',
      quota: 0.5, divisao, conta }] });
    const quemNaoPagou = avisosMao(d(0, 500), /^Pintura/);
    assert.equal(quemNaoPagou.length, 1);
    assert.equal(quemNaoPagou[0].nivel, 'aviso');
    assert.match(quemNaoPagou[0].texto, /^Pintura, 1 000 € \(T2 Arroios\): a divisão diz que não pagaste nada, e a tua quota no imóvel é 50 %\. Aqui conta pela quota de cada dono — 500 € nos teus gastos —/);
    assert.match(quemNaoPagou[0].texto, /se não acertaram contas entre vocês, a parte que não pagaste não é gasto teu: corrige-a à mão/i);
    const quemPagou = avisosMao(d(1, 500), /^Pintura/);
    assert.equal(quemPagou[0].nivel, 'info');
    assert.match(quemPagou[0].texto, /a divisão diz que pagaste 100 %/);
    assert.match(quemPagou[0].texto, /não aceita deduzir acima da quota/);
    // o sinónimo do resumo
    assert.equal(avisosMao(resumoMao({ divisaoPropria: d(0, 500).divisoesProprias }), /^Pintura/).length, 1);
  });

  test('N012: um imóvel por quartos com quartos vazios diz a parte arrendada que a app usou, com o atalho para a ficha', () => {
    const r = resumoMao({ parteArrendada: [{ propertyId: 'v1', imovel: 'T3 Graça', origem: 'quartos', parte: 1 / 3, quartos: 3, gastos: 1970, contados: 656.67 }] });
    const a = avisosMao(r, /por quartos/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'info');
    assert.match(a[0].texto, /^Imóvel T3 Graça \(por quartos\): os gastos da casa contam só na parte arrendada, 33,33 % — sem a parte de cada quarto, cada um conta por igual \(3 quartos\): 656,67 € dos 1 970 € de gastos do ano\. /);
    assert.match(a[0].texto, /CIRS art\. 41\.º n\.º 4\): indica na ficha do imóvel a parte da casa de cada quarto, com a sua parte das zonas comuns$/);
    assert.match(a[0].abrir, /^imvAbrirNoCampo\('v1','(p_room_parte_[\w-]+)?'\)$/, 'o atalho para o primeiro quarto sem parte (KAN-152-1)');
    assert.equal(a[0].abrirTexto, 'Indicar as partes');
    // com as partes dos quartos todas indicadas (KAN-152-1: uma parte por quarto)
    r.parteArrendada[0].origem = 'partes'; r.parteArrendada[0].parte = 0.4; r.parteArrendada[0].semParte = [];
    const b = avisosMao(r, /por quartos/);
    assert.match(b[0].texto, /40 %, pelas partes que indicaste para cada quarto/);
    assert.equal(b[0].abrirTexto, 'Corrigir as partes');
  });
});

describe('o 6A, a regularização e os anos sem regras (N091, N125)', () => {
  test('N091: no ano em que a reabilitação acabou, as rendas de antes da conclusão não têm os 5 %', () => {
    imovel({ purchaseDate: '2019-05-01', reabilitacao: { tipo: 'aru', inicio: '2023-09-01', conclusao: '2026-07-15', certificado: true } });
    contrato({ start: '2024-03-01', end: '2027-02-28' }, { celebracao: '2024-02-15' });
    rendas(1000, M12, 2025); rendas(1000);
    const a = avisos(/a reabilitação do imóvel ficou concluída/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'aviso');
    assert.match(a[0].texto, /^Contrato C1: a reabilitação do imóvel ficou concluída a 15\/07\/2026\. Os 5 % do quadro 6A só valem nas rendas a partir de 01\/08\/2026: as de antes vêm de um imóvel ainda por recuperar e não os têm — a app já as conta sem eles\./);
    assert.match(a[0].texto, /confirma com a AT como declarar as rendas de antes da conclusão/);
    // no ano seguinte, nada
    rendas(1000, M12, 2027);
    assert.equal(avisos(/a reabilitação do imóvel ficou concluída/, 2027).length, 0);
  });

  test('N125: os anos da regularização sem regras na app ficam por confirmar, fora da estimativa', () => {
    const r = resumoMao({ regularizacoes: [{ contratoId: 'C1', nome: 'C1', anos: [{ ano: 2025, diferenca: 720 }], total: 720,
      porConfirmar: [{ ano: 2022, diferenca: 720 }, { ano: 2023, diferenca: 720 }, { ano: 2024, diferenca: 720 }], totalPorConfirmar: 2160,
      anosSemRegras: [2022, 2023, 2024], anosEmFalta: [] }] });
    const a = avisosMao(r, /motivo do senhorio/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /a app estima 720 € sem os juros \(2025: 720 €\)/);
    assert.match(a[0].texto, /Os anos de 2022 a 2024 ficam por confirmar e fora da estimativa: a app não tem as regras desses anos, e com as de 2025 dariam cerca de 2 160 €/);
    // só com anos por confirmar (sem diferença nos anos com regras), o aviso nasce na mesma
    const b = avisosMao(resumoMao({ regularizacoes: [{ contratoId: 'C1', nome: 'C1', anos: [], total: 0,
      porConfirmar: [{ ano: 2024, diferenca: 360 }], totalPorConfirmar: 360, anosSemRegras: [2024], anosEmFalta: [] }] }), /motivo do senhorio/);
    assert.equal(b.length, 1);
    assert.match(b[0].texto, /O ano de 2024 fica por confirmar e fora da estimativa/);
  });
});

describe('os pedidos das outras folhas (N150, N042, N011, N045)', () => {
  test('N150: a renda antiga com só o início escrito depois de 1990 conta, mas fica por confirmar (âmbar, no contrato)', () => {
    imovel(); contrato({ start: '1995-01-01', rent: 150 }, { celebracao: '', isencao: 'prerau', nrau3536: true });
    rendas(150);
    const a = avisos(/é posterior ao que a isenção pede/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'aviso');
    assert.match(a[0].texto, /^Contrato C1: o início escrito no contrato \(01\/01\/1995\)/);
    assert.equal(a[0].abrir, "ctView('C1')");
  });

  test('N127: o 6C marcado num prédio que não é rústico leva à ficha do imóvel, onde se vê o tipo', () => {
    imovel({ tipoPredio: 'U' }); contrato({ start: '2019-01-01', end: '2030-12-31' }, { celebracao: '2018-12-15', egf: true });
    rendas(1000);
    const a = avisos(/quadro 6C/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /só vale num prédio rústico/);
    assert.equal(a[0].abrir, "propView('v1')");
  });

  test('N060: uma isenção de programa (quadro 6D) que põe a linha a 0 % diz-se, com a isenção, para se confirmar no contrato', () => {
    const paa = { id: 'paa', nome: 'Programa de Apoio ao Arrendamento (PAA)', curto: 'PAA', quadro: '6D', codigo: '' };
    const a = avisosMao(resumoMao({ linhas: [linhaMao({ isencao: paa, taxa: 0 })] }), /isento de IRS/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'info');
    assert.equal(a[0].texto, 'Contrato C1: isento de IRS pelo Programa de Apoio ao Arrendamento (PAA), no quadro 6D: as rendas de 2026 (12 000 €) ficam com 0 % de imposto. '
      + 'Confirma no contrato que está mesmo nesse programa — escolhida por engano, a isenção tira o imposto todo');
    assert.equal(a[0].abrir, "ctView('C1')");
    // a renda antiga (6H) não é de programa
    const prerau = { id: 'prerau', nome: 'Renda antiga', curto: 'renda antiga', quadro: '6H', codigo: '' };
    assert.equal(avisosMao(resumoMao({ linhas: [linhaMao({ isencao: prerau, taxa: 0 })] }), /isento de IRS/).length, 0);
  });

  test('N042: as despesas que o «Fora dos totais» tira do Anexo F dizem-se, com o caminho para as contar', () => {
    const r = resumoMao({ despesasForaDosTotais: [{ txId: 'f1', nome: 'Condomínio de março', valor: 60, propertyId: 'v1', data: '2026-03-01', col: 'condominio' },
      { txId: 'f2', nome: 'Condomínio de abril', valor: 60, propertyId: 'v1', data: '2026-04-01', col: 'condominio' }] });
    const a = avisosMao(r, /Fora dos totais/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'info');
    assert.equal(a[0].texto, '2 despesas de 2026 (120 €) ficam fora do Anexo F porque a categoria está «Fora dos totais»: Condomínio de março, 60 €; Condomínio de abril, 60 €. Para as contar, desliga-o em Definições → Categorias, etiquetas e IRS');
    assert.equal(a[0].abrir, "go('settings');goSet('irs')");
  });

  test('N011, N045: a obra «a confirmar» antes de um contrato diz o contrato e as obras dos 24 meses; a categoria sem subcategoria leva a nota da categoria', () => {
    const notas = app.IRS_MAPA_NOTAS, antes = notas['Obras e benfeitorias'];
    notas['Obras e benfeitorias'] = 'Reparar o que já existe é conservação; o que acrescenta valor não se deduz';
    const r = resumoMao({ aConfirmar: [{ txId: 'o1', nome: 'Obra', data: '2026-02-05', valor: 3000, propertyId: 'v1', imovel: 'T2 Arroios',
      categoria: 'Obras e benfeitorias', sub: '', origem: 'categoria', obras24: true, contrato: 'C9' }] });
    let a;
    try { a = avisosMao(r, /^Obras e benfeitorias/); } finally { if (antes === undefined) delete notas['Obras e benfeitorias']; else notas['Obras e benfeitorias'] = antes; }
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /Obra, 3 000 € \(antes do contrato C9\)/);
    assert.match(a[0].texto, /Reparar o que já existe é conservação; o que acrescenta valor não se deduz/);
    assert.match(a[0].texto, /Se é uma obra de conservação antes do arrendamento, escolhe a coluna das obras dos 24 meses$/);
  });
});

describe('a forma dos avisos', () => {
  test('um aviso sem ação não traz os campos novos; um com ação traz acao, acaoTexto e acaoToca', () => {
    const xs = todosMao(resumoMao({ linhas: [linhaMao({ inquilinos: [] })] }));
    xs.forEach((a) => {
      assert.equal(a.acao, undefined);
      assert.ok(!('abrirTexto' in a) || a.abrir, 'o rótulo do toque só com toque');
    });
    imovel({ comproprietariosFora: null }); contrato(); rendas(1000);
    const d = avisos(/há mais donos além de ti/)[0];
    assert.equal(d.acaoToca, 'camada');
  });
});
