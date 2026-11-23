// Os avisos de «A tratar antes de entregar» da ronda 2 do IRS
// (fisco-avisos.js:fiscoAvisos) — vaga 4, folha 2.4.5 (KAN-129): as rendas abaixo
// da do contrato com o recibo emitido, como pergunta, com o inquilino empresa e o
// encargo descontado (D115, D114); as retenções de inquilinos particulares (D116);
// os benefícios do quadro 6 marcados que não contam, e o aviso da AT dos que contam
// (D117, D119, D121); as despesas do Splitwise com a quota já cortada, com o toque
// que repõe o total (D122); a renda recebida antes do início do contrato (D130); o
// que saiu do Anexo F — o Anexo J e a categoria B (D133, D134); o código da
// freguesia fora do formato (D136) e o de uma união desagregada em 2025 (D135); e o
// direito real de habitação duradoura (D120): a caução, o motivo da cessação, a
// regularização da cessação por acordo e a parte da caução que se fica (natureza 03,
// declarada à mão). Os resumos são os do resumoFiscal, com dados na base; os casos
// raros montam-se à mão, com a forma do contrato de interfaces.

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
/* o imóvel v1, da Ana, com os dados matriciais e os donos fora da app
   confirmados, salvo se o teste disser outra coisa
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
const rendas = (valor, meses, extra, ano) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1',
    date: `${ano || 2026}-${mm(m)}-05`, recibo: true }, extra || {})));
/* os avisos do resumo de 2026 que casam com a expressão
   Recebe: re — a expressão; ano (opcional).
   Devolve: os avisos (cópias simples). */
const avisos = (re, ano) => json(app.resumoFiscal(ano || 2026, 'ana').avisos).filter((a) => re.test(a.texto));
/* um resumo à mão, com a forma do contrato de interfaces */
const resumoMao = (extra) => Object.assign({ ano: 2026, titularId: 'ana', titulares: ['ana'], linhas: [], fora: [], semContrato: [],
  aConfirmar: [], obrasSoltas: 0, foraDoPeriodo: 0, semSessao: false, contratosSemRendas: [] }, extra);
/* uma linha do resumo à mão (a das rendas do C1) */
const linhaMao = (extra) => Object.assign({ contratoId: 'C1', propertyId: 'v1', nome: 'C1', imovel: 'T2 Arroios', atNumero: '1234567',
  inicio: '2026-01-01', estado: 'declarado', freguesiaCodigo: '110623', tipoPredio: 'U', artigo: '4651', fracao: 'A', quota: 1,
  natureza: '07', naturezaAssumida: false, titular: 'A', titularId: 'ana', quadro: '4.1', taxa: 25, taxaEscrita: null, isencao: null,
  celebracao: '2025-12-15', acimaDoLimite: null, comunicacao: null, inquilinos: [{ id: 't1', nome: 'Tiago', nif: '123456789', pais: '' }],
  papel: 'renda', rendas: 12000, retencoes: 0, gastos: { selo: 100 }, faltas: [], recibosPorEmitir: 0, mesesEmVigor: 12, mesesComRenda: 12,
  quotas: null, beneficios: [], dhd: null, freguesiaUniao: null, matrizConfirmada: '' }, extra);
const avisosMao = (r, re) => json(app.fiscoAvisos(r)).filter((a) => re.test(a.texto));

beforeEach(() => {
  limpar(app);
  app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('D115, D114 — as rendas abaixo da do contrato com o recibo emitido', () => {
  test('o fiador paga por fora: uma pergunta por contrato, com os meses, o valor e o encargo descontado', () => {
    imovel(); contrato({ rent: 850 });
    rendas(550);
    const a = avisos(/abaixo da renda/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato C1: as rendas de 12 meses, de janeiro a dezembro de 2026, ficaram abaixo da renda (550 € em vez de 850 €), '
      + 'com o recibo emitido. Foram pela renda inteira? Então o quadro 4.1 vai abaixo dos recibos: regista em cada mês a renda do recibo, '
      + 'e o que se descontou (a comissão da gestora, uma obra) como despesa. Se o inquilino descontou um encargo, não o confirmes também como despesa. '
      + 'Se pagou só uma parte, o resto fica em dívida e não se declara');
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].abrir, "goMovimentos('2026','v1','rendas','income','C1')", 'N134: as rendas do contrato');
  });

  test('um mês só abre o movimento; o inquilino empresa diz a declaração que ele entrega; os encargos do Q13 pelo nome', () => {
    app.db.tenants[0].nif = '501234567';
    imovel(); contrato({ rent: 1000, encargosInquilino: ['condominio', 'imi'] });
    rendas(1000, [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]);
    const t = mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 800, contractId: 'C1', date: '2026-05-05', recibo: true });
    const a = avisos(/abaixo da renda/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Contrato C1: a renda de maio de 2026 ficou abaixo da renda \(800 € em vez de 1 000 €\), com o recibo emitido\. Foi pela renda inteira\? /);
    assert.match(a[0].texto, /o quadro 4\.1 vai abaixo do recibo e da declaração que a empresa inquilina entrega à AT: regista a renda do recibo,/);
    assert.match(a[0].texto, /Se o inquilino descontou um encargo \(condomínio ou IMI\), não o confirmes também como despesa\./);
    assert.equal(a[0].abrir, `txView('${t.id}')`);
  });

  test('com a resposta «pagamento parcial» não se pergunta', () => {
    imovel(); contrato({ rent: 850 });
    rendas(550, M12, { parcial: true });
    assert.equal(avisos(/abaixo da renda/).length, 0);
  });

  test('o quadro é o da linha (4.2 num contrato com redução); meses com valores diferentes dizem a diferença somada', () => {
    const r = resumoMao({ linhas: [linhaMao({ quadro: '4.2' })], rendasAbaixo: [
      { contratoId: 'C1', nome: 'C1', imovel: 'T2 Arroios', propertyId: 'v1', mes: '2026-03', valor: 800, referencia: 1000, diferenca: 200, txIds: ['a'], empresa: false },
      { contratoId: 'C1', nome: 'C1', imovel: 'T2 Arroios', propertyId: 'v1', mes: '2026-04', valor: 900, referencia: 1000, diferenca: 100, txIds: ['b'], empresa: false }] });
    const a = avisosMao(r, /abaixo da renda/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Contrato C1: as rendas de março e abril de 2026 ficaram abaixo da renda \(300 € abaixo, no total\)/);
    assert.match(a[0].texto, /o quadro 4\.2 vai abaixo dos recibos/);
  });
});

describe('D116 — as retenções de inquilinos particulares', () => {
  test('um particular com retenções: confirma-as nos recibos, com o toque no contrato', () => {
    imovel(); contrato();
    rendas(750, M12, { retencao: 250 });
    const a = avisos(/é um particular/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato C1: 3 000 € de retenções na fonte em 2026, e o inquilino Tiago é um particular — só retém IRS quem tem contabilidade organizada. '
      + 'Confirma-as nos recibos: a comissão da gestora e os descontos não são retenção, e uma retenção que o recibo não tem não abate ao imposto');
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].abrir, "ctView('C1')");
  });

  test('uma empresa retém: nada a dizer', () => {
    app.db.tenants[0].nif = '501234567';
    imovel(); contrato();
    rendas(750, M12, { retencao: 250 });
    assert.equal(avisos(/particular/).length, 0);
  });
});

describe('D117, D119, D121 — os benefícios do quadro 6', () => {
  const reab = { tipo: 'aru', inicio: '2015-01-10', conclusao: '2016-06-30', certificado: true };

  test('6A comprado depois de 6 de outubro de 2023: não conta, porquê, a taxa da linha, e a posição da AT (PIV 28153)', () => {
    imovel({ reabilitacao: reab, purchaseDate: '2024-01-10' }); contrato();
    rendas(1000);
    const a = avisos(/quadro 6A/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Contrato C1: o quadro 6A \(imóvel reabilitado\) está marcado, mas não conta em 2026 — compraste o imóvel depois de 6 de outubro de 2023/);
    assert.match(a[0].texto, /Sem ele, as rendas vão a \d+ %, e não a 5 %\./);
    assert.match(a[0].texto, /É a posição mais recente da AT \(informação vinculativa 28153\); confirma-a antes de entregar$/);
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].abrir, "propView('v1')");
  });

  test('6A sem o certificado da câmara e com a reabilitação fora das datas: também se diz, sem repetir «não conta»', () => {
    imovel({ reabilitacao: Object.assign({}, reab, { certificado: false }), purchaseDate: '2010-05-01' }); contrato();
    rendas(1000);
    let a = avisos(/quadro 6A/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /— sem o certificado da câmara \(o início e a conclusão da reabilitação\)\. Sem ele/);
    assert.match(a[0].texto, /informação vinculativa 28153/);
    app.db.properties[0].reabilitacao = Object.assign({}, reab, { inicio: '2024-02-01' });
    a = avisos(/quadro 6A/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /a reabilitação só conta se começou entre 2 de janeiro de 2008 e 6 de outubro de 2023/);
  });

  test('6A que conta: o aviso da versão sobre a posição da AT, só a dizer', () => {
    imovel({ reabilitacao: reab, purchaseDate: '2010-05-01' }); contrato();
    rendas(1000);
    const a = avisos(/^Quadro 6A/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Quadro 6A \(imóvel reabilitado\), contrato C1: os 5 % seguem a posição mais recente da AT \(informação vinculativa 28153/);
    assert.match(a[0].texto, /Confirma antes de entregar$/);
    assert.equal(a[0].nivel, 'info');
    assert.equal(avisos(/está marcado, mas não conta/).length, 0);
  });

  // N127: o que falha é o tipo de prédio — o toque leva à ficha do imóvel
  test('6C marcado num prédio urbano: não conta, as rendas por inteiro, com o toque na ficha do imóvel', () => {
    imovel({ tipoPredio: 'U' });
    contrato({ rent: 500, start: '2019-05-01' }, { finalidade: 'nh', egf: true, celebracao: '2019-05-01' });
    rendas(500);
    const a = avisos(/quadro 6C/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /só vale num prédio rústico\. Sem ele, as rendas contam por inteiro, e não a 50 %$/);
    assert.equal(a[0].abrir, "propView('v1')");
  });

  test('6B marcado num contrato de habitação: as obras a 100 %', () => {
    imovel({ lojaComHistoria: true }); contrato();
    rendas(1000);
    const a = avisos(/quadro 6B/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /as obras dos 24 meses antes do arrendamento contam a 100 %, e não a 110 %$/);
    assert.doesNotMatch(a[0].texto, /informação vinculativa/);
  });

  test('6C depois da vigência (2027): o motivo fala do ano, sem a frase cortada', () => {
    const r = resumoMao({ ano: 2027, linhas: [linhaMao({ taxa: 28 })] });
    imovel({ tipoPredio: 'R' });
    contrato({ rent: 500, start: '2019-05-01' }, { finalidade: 'nh', egf: true, celebracao: '2019-05-01' });
    const a = avisosMao(r, /quadro 6C/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /não conta em 2027 — a lei só o tem em vigor até 31 de dezembro de 2026: sem nova prorrogação, o quadro 6C não conta em 2027\. Sem ele/);
  });

  test('6A falta dizer o tipo da reabilitação: sem a frase da posição da AT', () => {
    const r = resumoMao({ linhas: [linhaMao()] });
    imovel({ reabilitacao: reab, purchaseDate: '2010-05-01' }); contrato();
    app.db.properties[0].reabilitacao = Object.assign({}, reab, { tipo: 'outro' }); // um registo de fora, por normalizar
    const a = avisosMao(r, /quadro 6A/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /falta dizer se a reabilitação foi numa área de reabilitação urbana ou no NRAU\. Sem ele, as rendas vão a 25 %, e não a 5 %$/);
  });
});

describe('D122 — as despesas do Splitwise com a quota já cortada', () => {
  const doisDonos = () => imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } });

  test('dizem-se com o toque que repõe o total; as que têm swKey não', () => {
    doisDonos(); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', label: 'Condomínio março', amount: 250, date: '2026-03-10', src: 'splitwise', batch: 'b1' });
    mov({ kind: 'expense', category: 'Condomínio', label: 'Condomínio abril', amount: 500, date: '2026-04-10', src: 'splitwise', batch: 'b2', swKey: '2026-04-10|x|500.00|y' });
    const a = avisos(/Splitwise/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Despesa de 2026 importada do Splitwise com o valor já cortado pela tua quota: Condomínio março, 250 €. '
      + 'A Declaração volta a aplicá-la, e deduzes menos do que pagaste. Repor põe-lhe o custo total, 500 €, pela quota de hoje no imóvel — confirma-o no Splitwise');
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].abrir, "fiscoAvReporSplitwise(2026,'ana')");
    assert.equal(a[0].toca, 'camada');
  });

  test('o «Repor o total» grava a quantia total e uma chave, e o aviso cala-se; o «Anular» desfaz', () => {
    doisDonos(); contrato();
    rendas(1000);
    const t = mov({ kind: 'expense', category: 'Condomínio', label: 'Condomínio março', amount: 250, date: '2026-03-10', src: 'splitwise', batch: 'b1' });
    let pergunta = null, anular = null;
    app.confirmModal = (titulo, html, cb) => { pergunta = { titulo, html }; cb(); };
    app.comDesfazer = (msg, restaurar) => { anular = restaurar; };
    app.fiscoAvReporSplitwise(2026, 'ana');
    assert.equal(pergunta.titulo, 'Repor o custo total');
    assert.match(json(pergunta.html), /Condomínio março · 10\/03\/2026: 250 € → <b>500 €<\/b>/);
    assert.equal(t.amount, 500);
    assert.equal(t.swKey, '2026-03-10|Condomínio março|500.00|');
    assert.equal(avisos(/Splitwise/).length, 0, 'com a chave, o resumo cala-a');
    anular();
    assert.equal(t.amount, 250);
    assert.ok(!t.swKey);
    assert.equal(avisos(/Splitwise/).length, 1);
  });

  test('duas iguais no mesmo imóvel (cada dono importou a sua parte): não se repõem, diz-se para apagar a que está a mais', () => {
    doisDonos(); contrato();
    rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', label: 'Obras', amount: 500, date: '2026-03-10', src: 'splitwise', batch: 'b1' });
    mov({ kind: 'expense', category: 'Condomínio', label: 'Obras', amount: 500, date: '2026-03-10', src: 'splitwise', batch: 'b9' });
    const a = avisos(/Splitwise/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^2 despesas de 2026 importadas do Splitwise com o valor já cortado pela tua quota, e com outra igual no mesmo imóvel/);
    assert.match(a[0].texto, /apaga a que está a mais/);
    assert.equal(a[0].abrir, "goMovimentos('2026','v1','Condomínio','expense','')", 'N134: as despesas do Condomínio do imóvel');
    let chamou = false;
    app.confirmModal = () => { chamou = true; };
    app.fiscoAvReporSplitwise(2026, 'ana');
    assert.equal(chamou, false, 'nada a repor');
  });
});

describe('D130 — a renda recebida antes do início do contrato', () => {
  test('é deste contrato? uma por contrato; a antecipada com o mês do contrato e a caução não', () => {
    imovel(); contrato({ start: '2026-03-01' });
    const t = mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 450, contractId: 'C1', date: '2026-01-05', recibo: true });
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2026-02-25', periodo: '2026-03', recibo: true });
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 2000, contractId: 'C1', date: '2026-02-20', recibo: true });
    rendas(1000, [4, 5, 6]);
    const a = avisos(/antes do início do contrato/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato C1: a renda de 450 € recebida a 05/01/2026 é de antes do início do contrato (01/03/2026) — é deste contrato? '
      + 'Se é uma renda antecipada, escolhe no movimento o mês da renda; se é de outro contrato, liga-a a ele. Até lá, conta nas rendas deste');
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].abrir, `txView('${t.id}')`);
  });
});

describe('D133, D134 — o que saiu do Anexo F', () => {
  test('o imóvel fora de Portugal: vai ao Anexo J (quadro e código da versão), sem estimativa; sem o código do país, falta', () => {
    imovel({ pais: 'França' }); contrato({}, { impostoEstrangeiro: { 2026: 300 } });
    rendas(1000);
    const f = avisos(/código do país/);
    assert.equal(f.length, 1);
    assert.equal(f[0].texto, 'Imóvel T2 Arroios (França): sem o código do país da tabela X, que o quadro 7A do Anexo J pede. Escreve-o na ficha do imóvel');
    assert.equal(f[0].nivel, 'falta');
    assert.equal(f[0].abrir, "propView('v1')");
    const i = avisos(/não vão ao Anexo F/);
    assert.equal(i.length, 1);
    assert.equal(i[0].texto, 'Contrato C1 (França): as rendas de 2026 (12 000 €) não vão ao Anexo F — o imóvel fica fora de Portugal. '
      + 'Declaram-se no Anexo J, quadro 7A (código F01), com os gastos e o imposto pago lá (300 €). A app não estima o imposto: o crédito por dupla tributação depende do país');
    assert.equal(i[0].nivel, 'info');
    assert.equal(avisos(/sem código da freguesia|sem tipo de prédio/).length, 0, 'sem as faltas da matriz portuguesa');
    app.db.properties[0].paisCodigo = '250';
    assert.equal(avisos(/código do país/).length, 0);
  });

  test('as rendas antecipadas de um imóvel fora de Portugal não pedem recibo', () => {
    imovel({ pais: 'França', paisCodigo: '250' }); contrato({ start: '2026-03-01', advance: 2 });
    rendas(1000, [5, 6, 7, 8, 9, 10, 11, 12]);
    const a = avisos(/renda antecipada|rendas antecipadas/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /declaram-se no ano em que as recebeste$/);
  });

  test('a categoria B: sai do Anexo F para o Anexo B ou C, só a dizer', () => {
    imovel(); contrato({}, { categoriaB: true });
    rendas(1000);
    const a = avisos(/categoria B/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato C1: as rendas de 2026 (12 000 €) estão na categoria B — saem do Anexo F e declaram-se no Anexo B ou C, com os rendimentos da atividade');
    assert.equal(a[0].nivel, 'info');
    assert.equal(a[0].abrir, "ctView('C1')");
  });
});

describe('D136, D135 — o código da freguesia', () => {
  test('fora do formato da AT (um 0302 cortado por uma versão antiga): falta; o 0302FI com letras não', () => {
    imovel({ freguesiaCodigo: '0302' }); contrato();
    rendas(1000);
    const a = avisos(/formato da AT/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Imóvel T2 Arroios: o código da freguesia, «0302», não tem o formato da AT — são 6 caracteres, 4 algarismos e 2 algarismos ou letras, como na caderneta. Corrige-o na ficha do imóvel');
    assert.equal(a[0].nivel, 'falta');
    assert.equal(a[0].abrir, "propView('v1')");
    app.db.properties[0].freguesiaCodigo = '0302FI';
    assert.equal(avisos(/código da freguesia/).length, 0);
  });

  // N087: o código da união deixou de existir — falta, e o «Confirmei na caderneta» não o cala
  test('a união desagregada em 2025: falta com as repostas, desde a declaração de 2025; o «Confirmei na caderneta» não a cala', () => {
    imovel({ freguesiaCodigo: '010123' }); contrato({ start: '2024-03-01' });
    rendas(600, M12, {}, 2024);
    rendas(600, M12, {}, 2025);
    rendas(600);
    const a = avisos(/união de freguesias/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Imóvel T2 Arroios: o código da freguesia, 010123, é o de uma união de freguesias desagregada em outubro de 2025 (Lei 25-A/2025) e deixou de existir. '
      + 'O prédio passou para uma destas: 010128 Agadão, 010132 Belazaima do Chão ou 010134 Castanheira do Vouga, e o artigo matricial pode ter mudado. '
      + 'Escolhe a freguesia reposta pela caderneta predial atual e corrige o código e o artigo na ficha do imóvel: é o que vai à declaração.');
    assert.equal(a[0].nivel, 'falta');
    assert.equal(a[0].abrir, "imvAbrirNoCampo('v1','p_freguesiaCodigo')");
    assert.equal(a[0].abrirTexto, 'Corrigir o código');
    assert.equal(avisos(/união de freguesias/, 2025).length, 1);
    assert.equal(avisos(/união de freguesias/, 2024).length, 0, 'nas de 2024 o código da união é o certo');
    app.db.properties[0].matrizConfirmada = '2026-11-18';
    const b = avisos(/união de freguesias/);
    assert.equal(b.length, 1, 'confirmado, o código continua a não existir');
    assert.match(b[0].texto, /A marca «Confirmei na caderneta» não chega: este código já não está em nenhuma caderneta.$/);
  });
});

describe('D120 — o direito real de habitação duradoura', () => {
  test('sem o valor da caução: falta, com o «Responder» no campo da caução', () => {
    imovel(); contrato({ rent: 500, deposit: 0 }, { finalidade: 'dhd' });
    rendas(500);
    const a = avisos(/sem o valor da caução/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato C1: direito real de habitação duradoura sem o valor da caução, que o quadro 4.3 pede — o da escritura. Escreve-o no contrato, em Caução');
    assert.equal(a[0].nivel, 'falta');
    assert.equal(a[0].abrir, "ctIrParaPergunta('C1','c_dep')");
  });

  test('a caução recebida não é rendimento: só se diz', () => {
    imovel(); contrato({ rent: 500, deposit: 20000 }, { finalidade: 'dhd' });
    rendas(500);
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 20000, contractId: 'C1', date: '2026-01-02' });
    const a = avisos(/caução recebida/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato C1: a caução recebida em 2026 (20 000 €) não é rendimento e fica fora do quadro 4.3 — num direito real de habitação duradoura só o é a prestação anual, do 11.º ano em diante, que a app conta sozinha');
    assert.equal(a[0].nivel, 'info');
  });

  test('cessado por acordo: a regularização dos 5 % desde o início, com o motivo do 4.3; e a parte da caução que se fica declara-se à mão (natureza 03)', () => {
    imovel();
    contrato({ rent: 500, deposit: 20000, start: '2025-01-01', end: '2045-01-01', active: false }, { finalidade: 'dhd', cessacao: { data: '2026-06-30', motivo: '01' } });
    rendas(500, M12, {}, 2025);
    rendas(500, [1, 2, 3, 4, 5, 6]);
    const g = avisos(/acabou por acordo das partes/);
    assert.equal(g.length, 1);
    assert.match(g[0].texto, /^Contrato C1: o direito real de habitação duradoura acabou por acordo das partes \(o motivo 01 do quadro 4\.3\)\. Os 5 % caem desde o início do contrato \(CIRS art\. 72\.º n\.º 20\)/);
    assert.match(g[0].texto, /a app estima [\d ]+(,\d+)? € sem os juros \(2025: /);
    assert.equal(g[0].nivel, 'falta');
    assert.equal(avisos(/acabou antes do prazo por motivo do senhorio/).length, 0, 'não é o texto do quadro 10');
    const c = avisos(/por incumprimento do morador/);
    assert.equal(c.length, 1);
    assert.equal(c[0].texto, 'Contrato C1: o direito real de habitação duradoura acabou a 30/06/2026. Se ficaste com parte da caução (20 000 €) por incumprimento do morador, '
      + 'essa parte é rendimento de 2026 e declara-se à mão no quadro 4.3, com a natureza 03 («Dedução ao montante da caução por incumprimento dos deveres do morador»): '
      + 'a app não a conta. A parte que devolves não é gasto');
    assert.equal(c[0].nivel, 'aviso');
    assert.equal(c[0].abrir, "ctView('C1')");
  });

  test('acabou sem o motivo da cessação, que o 4.3 pede: falta', () => {
    const l = linhaMao({ quadro: '4.3', natureza: '01', dhd: { escritura: '2025-01-01', caucao: 0, caucaoRecebida: 0, cessacao: { data: '2026-06-30', motivo: '' }, gastos: null } });
    const a = avisosMao(resumoMao({ linhas: [l] }), /sem o motivo da cessação/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato C1: o direito real de habitação duradoura acabou a 30/06/2026 sem o motivo da cessação, que o quadro 4.3 pede. Escolhe-o no contrato');
    assert.equal(a[0].nivel, 'falta');
    assert.equal(avisosMao(resumoMao({ linhas: [l] }), /por incumprimento do morador/).length, 0, 'sem caução, nada a declarar à mão');
  });
});

describe('os campos da ronda 2 em falta (um resumo antigo)', () => {
  test('sem eles, nenhum aviso da ronda 2 nem erro', () => {
    const l = linhaMao();
    delete l.beneficios; delete l.dhd; delete l.freguesiaUniao; delete l.matrizConfirmada;
    const a = json(app.fiscoAvisos(resumoMao({ linhas: [l] })));
    assert.equal(a.filter((x) => /Splitwise|abaixo da renda|particular|Anexo J|categoria B|união de freguesias|quadro 6|antes do início/.test(x.texto)).length, 0);
  });
});
