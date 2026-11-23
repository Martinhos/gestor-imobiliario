// Os cartões da Declaração na ronda 2 do IRS — vaga 4, folha 2.4.6 (KAN-129): o
// cartão do quadro 4.3 do direito real de habitação duradoura, com as colunas dele,
// a caução que não é rendimento, a prestação anual do 11.º ano e a cessação por
// acordo (D120); os cartões do 6A (imóveis reabilitados, D117), do 6B (Lojas com
// História, D121) e do 6C (rústicos arrendados a uma entidade de gestão florestal,
// D119), com o campo do 4.1 de cada linha, e o líquido do imposto no KPI; o cartão
// «Anexo J · quadro 7A» dos imóveis fora de Portugal, sem imposto estimado (D133);
// o cartão «Fora do Anexo F · categoria B» e a frase de «A tua situação fiscal»
// (D134); a união de freguesias extinta em 2025 no campo da freguesia (D135) e a
// caderneta atual (D137); a renda do recibo no KPI e na dica (D112); os 5 % do 6A e
// do 4.3 no porquê do imposto (D118).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

// na época da entrega das rendas de 2026
const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));
const ANO = 2026;

const mm = (m) => String(m).padStart(2, '0');
const M12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* O que se lê de um pedaço de HTML: sem etiquetas, com as entidades de volta e
   os espaços juntos.
   Recebe: html — o HTML (string).
   Devolve: o texto (string). */
function textoDe(html) {
  return String(html).replace(/<\/?(?:b|strong|i|em|span|a|abbr|small)\b[^>]*>/gi, '').replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra));
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
  const c = app.normContract(Object.assign({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000,
    start: '2026-01-01', active: true }, extra || {}, { fisco: Object.assign({ estado: 'declarado', numero: '1234567', finalidade: 'hp' }, fisco || {}) }));
  app.db.contracts.push(c);
  return c;
};
/* as rendas de um contrato nos meses dados (todos, sem a lista), no dia 5 */
const rendas = (valor, meses, extra, ano) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1',
    date: `${ano || ANO}-${mm(m)}-05`, recibo: true }, extra || {})));
const resumo = (ano) => app.resumoFiscal(ano || ANO, 'ana');
const pagina = (ano) => { app.fiscoAno = String(ano || ANO); return app.vFisco(); };

/* O HTML de um cartão da página (a <section>), pelo começo do título.
   Recebe: html — a página; titulo — o começo do título (texto já escapado).
   Devolve: o HTML do cartão, ou '' sem ele. */
function cartao(html, titulo) {
  const i = html.indexOf('<h2 class="ana-tit">' + titulo);
  if (i < 0) return '';
  const ini = html.lastIndexOf('<section', i), fim = html.indexOf('</section>', i);
  return html.slice(ini, fim + 10);
}
/* O valor de um campo (o <dd>) num pedaço de HTML, pelo rótulo exato.
   Recebe: h — o HTML; campo — o rótulo.
   Devolve: o HTML do <dd>, ou null. */
function valorDe(h, campo) {
  const re = new RegExp('<dt>' + campo.replace(/[()?.*+\[\]]/g, '\\$&') + '(?:<span class="small">[^<]*</span>)?</dt><dd>(.*?)</dd>');
  const m = re.exec(h);
  return m ? semCopia(m[1]) : null;
}
/* um valor que se copia limpo (formato.js:fmtCopiavel, N107: os separadores no CSS) de
   volta ao texto do euro2 e do fmtNIF, para o comparar com eles */
function semCopia(h) {
  const sep = app.euro2(1000).charAt(1), fim = app.euro2(1).slice(-2, -1), menos = app.euro2(-1).charAt(0), sepNif = app.fmtNIF('123456789').charAt(3);
  const grupos = (gs, s) => gs.replace(/<span class="cp-g">(\d{3})<\/span>/g, s + '$1');
  return String(h).replace(/<span class="cp-eur">(-?)(\d+)((?:<span class="cp-g">\d{3}<\/span>)*)(,\d+)?<\/span>/g,
    (x, neg, a, gs, dec) => (neg ? menos : '') + a + grupos(gs, sep) + (dec || '') + fim + '€').replace(/<span class="cp-g">(\d{3})<\/span>/g, sepNif + '$1');
}
/* O subtítulo pequeno de um campo, pelo rótulo exato. */
function subDe(h, campo) {
  const re = new RegExp('<dt>' + campo.replace(/[()?.*+\[\]]/g, '\\$&') + '<span class="small">([^<]*)</span></dt>');
  const m = re.exec(h);
  return m ? m[1] : null;
}
/* O cartão de um KPI, pelo rótulo: as linhas de rodapé e a explicação. */
function kpiDe(html, rotulo) {
  const i = html.indexOf('<div class="label">' + rotulo + '</div>');
  assert.ok(i > -1, 'há o cartão ' + rotulo);
  const fim = html.indexOf('<div class="card kpi', i);
  const h = html.slice(i, fim > -1 ? fim : undefined);
  return { pes: [...h.matchAll(/<div class="foot">(.*?)<\/div>/g)].map((m) => m[1]), expl: (/<div class="expl">([\s\S]*?)<\/div>/.exec(h) || [])[1] || '' };
}

beforeEach(() => {
  limpar(app);
  app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('D120 — o cartão do quadro 4.3, com as colunas dele', () => {
  test('um DHD tem o seu cartão, campo a campo pelos nomes do impresso, e não cai fora da página', () => {
    imovel(); contrato({ rent: 500, deposit: 20000 }, { finalidade: 'dhd' });
    rendas(500);
    mov({ kind: 'expense', category: 'Condomínio', amount: 600, date: '2026-04-10' });
    const h = pagina(), q = cartao(h, 'Quadro 4.3');
    assert.ok(q, 'o cartão do 4.3');
    assert.match(textoDe(q), /Quadro 4\.3 · direito real de habitação duradoura/);
    assert.equal(valorDe(q, 'Escritura pública ou documento particular – Data da celebração'), '01/01/2026');
    assert.equal(valorDe(q, 'Escritura pública ou documento particular – Valor da caução'), app.euro2(20000));
    assert.equal(valorDe(q, 'Rendimento – Natureza'), '01');
    assert.equal(subDe(q, 'Rendimento – Natureza'), 'Prestação pecuniária mensal (rendas)');
    assert.equal(valorDe(q, 'Rendimento – Valor ilíquido'), app.euro2(6000));
    assert.equal(valorDe(q, 'Condomínio'), app.euro2(600));
    assert.equal(valorDe(q, 'Conservação extraordinária'), '—');
    assert.match(q, /<p class="lbl fis-ctc-grupo">Gastos obrigatórios suportados e pagos<\/p>/);
    assert.equal(valorDe(q, 'NIF do morador'), '<span class="u-ws-nowrap">' + app.fmtNIF('123456789') + '</span>');
    assert.match(q, /taxa 5 % · habitação duradoura \(DHD\)/);
    assert.match(textoDe(q), /a prestação mensal com a natureza 01, a 5 % \(CIRS art\. 72\.º n\.º 5\)/);
    assert.equal(cartao(h, 'Quadro 4.1'), '', 'nada no 4.1');
  });

  test('a caução recebida diz-se no cartão: não é rendimento e fica fora do valor', () => {
    imovel(); contrato({ rent: 500, deposit: 20000 }, { finalidade: 'dhd' });
    rendas(500);
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 20000, contractId: 'C1', date: '2026-01-02' });
    const q = cartao(pagina(), 'Quadro 4.3');
    assert.match(textoDe(q), new RegExp('Recebeste ' + textoDe(app.euro2(20000)) + ' de caução em 2026: a caução de um direito real de habitação duradoura não é rendimento'));
    assert.equal(valorDe(q, 'Rendimento – Valor ilíquido'), app.euro2(6000));
  });

  test('sem a caução da escritura, o campo falta', () => {
    imovel(); contrato({ rent: 500, deposit: 0 }, { finalidade: 'dhd' });
    rendas(500);
    const q = cartao(pagina(), 'Quadro 4.3');
    assert.equal(valorDe(q, 'Escritura pública ou documento particular – Valor da caução'), '<span class="badge red">falta no contrato</span>');
  });

  test('cessado por acordo das partes: a data e o motivo do 4.3, a regularização no cartão e no KPI', () => {
    imovel();
    contrato({ rent: 500, deposit: 20000, start: '2025-01-01', end: '2045-01-01', active: false }, { finalidade: 'dhd', cessacao: { data: '2026-06-30', motivo: '01' } });
    rendas(500, M12, {}, 2025);
    rendas(500, [1, 2, 3, 4, 5, 6]);
    const h = pagina(), q = cartao(h, 'Quadro 4.3');
    assert.match(q, /<p class="lbl fis-ctc-grupo">Cessação dos efeitos do DHD<\/p>/);
    assert.equal(valorDe(q, 'Data'), '30/06/2026');
    assert.equal(valorDe(q, 'Motivo'), '01 · Por acordo das partes');
    assert.match(textoDe(q), /Cessou por acordo das partes: os 5 % caem desde o início do direito/);
    assert.match(textoDe(q), /estimativa sem juros: /);
    assert.ok(kpiDe(h, 'Imposto estimado').pes.some((p) => /com a regularização do quadro 4\.3/.test(p)), 'o KPI diz o 4.3, e não o quadro 10');
  });

  test('só com o 4.3, é ele o primeiro quadro (onde se dizem as despesas a confirmar e o 4.4)', () => {
    imovel(); contrato({ rent: 500, deposit: 20000 }, { finalidade: 'dhd' });
    rendas(500);
    assert.equal(app.fiscoPrimeiroQuadro(resumo()), '4.3');
  });

  test('a prestação anual da caução do 11.º ano vai numa linha à parte, com a natureza 02', () => {
    const outra = carregarApp({ hoje: '2032-06-01' });
    limpar(outra);
    outra.render = () => {};
    outra.db.owners.push(outra.normPerson({ id: 'ana', name: 'Ana' }));
    outra.db.tenants.push(outra.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
    outra.db.properties.push(outra.normProp({ id: 'v1', name: 'Casa', ownerIds: ['ana'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '1' }));
    outra.db.contracts.push(outra.normContract({ id: 'C1', name: 'DHD', propertyId: 'v1', tenantIds: ['t1'], rent: 500, deposit: 20000, start: '2020-03-01', active: true,
      fisco: { estado: 'declarado', numero: '1', finalidade: 'dhd' } }));
    for (let m = 1; m <= 12; m++) outra.db.transactions.push(outra.normTx({ kind: 'income', category: 'Rendas', amount: 500, contractId: 'C1', propertyId: 'v1', recibo: true, date: `2031-${mm(m)}-05` }));
    const r = outra.resumoFiscal(2031, 'ana'), q = outra.fiscoQuadroCard(r, '4.3');
    assert.match(textoDe(q), /prestação anual da caução \(natureza 02\)/);
    assert.match(textoDe(q), /Prestação anual da caução deste direito real de habitação duradoura/);
    assert.ok(q.indexOf('<dt>Rendimento – Natureza<span class="small">Prestação pecuniária anual (caução) - 11.º ano e seguintes</span></dt><dd>02</dd>') > -1);
  });
});

describe('D117, D121, D119 — os cartões do 6A, do 6B e do 6C, com o campo do 4.1 de cada linha', () => {
  const reab = { tipo: 'aru', inicio: '2015-01-10', conclusao: '2016-06-30', certificado: true };

  test('6A: o cartão com o campo 01 do 6A a apontar para o 4001, o aviso da AT e a nota do 6G', () => {
    imovel({ reabilitacao: reab, purchaseDate: '2010-05-01' }); contrato();
    rendas(1000);
    const h = pagina(), q = cartao(h, 'Quadro 6A');
    assert.ok(q, 'o cartão do 6A');
    const t = textoDe(q);
    assert.match(t, /campo 01 do 6A · indica o campo 4001 do 4\.1/);
    assert.match(t, /Pagam 5 % em vez da taxa do contrato/);
    assert.match(t, /informação vinculativa 28153/);
    assert.match(t, /englobamento \(quadro 6G\), estas rendas entram também/);
    const c = textoDe(cartao(h, 'Quadro 4.1'));
    assert.match(c, /Quadro 6A \(imóvel reabilitado\): indica o campo 4001 desta linha — as rendas pagam 5 %/);
    assert.match(c, /com o 6A/);
  });

  test('D118: o porquê do imposto diz os 5 % do 6A', () => {
    imovel({ reabilitacao: reab, purchaseDate: '2010-05-01' }); contrato();
    rendas(1000);
    assert.match(textoDe(kpiDe(pagina(), 'Imposto estimado').expl), /As rendas de imóveis reabilitados \(quadro 6A\) pagam 5 %/);
  });

  test('6B: as obras dos 24 meses de uma Loja com História a 110 %, e o líquido do imposto no total e no KPI', () => {
    imovel({ lojaComHistoria: true });
    contrato({}, { finalidade: 'nh', obrasSemOutroUso: true });
    rendas(1000);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 1000, date: '2025-10-10' });
    const h = pagina(), q = cartao(h, 'Quadro 6B');
    assert.ok(q, 'o cartão do 6B');
    assert.match(textoDe(q), /A AT considera estas obras em 110 %/);
    assert.match(textoDe(q), new RegExp('Obras dos 24 meses ?' + textoDe(app.euro2(1000))));
    const c = textoDe(cartao(h, 'Quadro 4.1'));
    /* uma linha só: sem o total do quadro (D8, maqueta 6); o líquido do imposto diz-se no
       cartão do contrato e no KPI */
    assert.match(c, new RegExp('o imposto estimado conta ' + textoDe(app.euro2(10900))));
    assert.ok(kpiDe(h, 'Rendimento líquido').pes.some((p) => textoDe(p) === 'no imposto: ' + textoDe(app.euro(10900)) + ' (quadro 6)'));
  });

  test('6C: as rendas a 50 % — o cartão, e o KPI do líquido deixa de dizer que é a base do imposto', () => {
    imovel({ tipoPredio: 'R' });
    contrato({ rent: 500, start: '2019-05-01' }, { finalidade: 'nh', egf: true, celebracao: '2019-05-01' });
    rendas(500);
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 100, date: '2026-05-10' });
    const h = pagina(), q = cartao(h, 'Quadro 6C');
    assert.ok(q, 'o cartão do 6C');
    assert.match(textoDe(q), /campo 13 do 6C · indica o campo 4001 do 4\.1/);
    assert.match(textoDe(q), /A AT considera estas rendas em 50 %/);
    const k = kpiDe(h, 'Rendimento líquido');
    assert.ok(k.pes.some((p) => textoDe(p) === 'no imposto: ' + textoDe(app.euro(2900)) + ' (quadro 6)'), 'a linha do líquido do imposto');
    assert.doesNotMatch(k.expl, /É sobre isto que se paga o imposto/);
    assert.match(textoDe(k.expl), /no 6C as rendas contam 50 %/);
  });

  test('sem benefícios, nenhum cartão do 6 e o KPI como antes', () => {
    imovel(); contrato();
    rendas(1000);
    const h = pagina();
    assert.equal(cartao(h, 'Quadro 6'), '');
    assert.match(kpiDe(h, 'Rendimento líquido').expl, /É sobre isto que se paga o imposto/);
  });
});

describe('D133 — o cartão «Anexo J · quadro 7A», sem imposto estimado', () => {
  test('F01, o país e o código, o líquido e o imposto pago lá; a página não fica «Sem rendas»', () => {
    imovel({ pais: 'França', paisCodigo: '250' });
    contrato({}, { impostoEstrangeiro: { 2026: 300 } });
    rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', amount: 600, date: '2026-04-10' });
    const h = pagina();
    assert.doesNotMatch(h, /Sem rendas em 2026/);
    const q = cartao(h, 'Anexo J · quadro 7A');
    assert.ok(q, 'o cartão do Anexo J');
    assert.equal(valorDe(q, 'Código do rendimento'), 'F01');
    assert.equal(valorDe(q, 'País da fonte'), '250 · França');
    assert.equal(valorDe(q, 'Rendimento líquido'), app.euro2(11400));
    assert.equal(valorDe(q, 'Imposto pago no estrangeiro'), app.euro2(300));
    assert.equal(valorDe(q, 'Rendas'), app.euro2(12000));
    assert.doesNotMatch(textoDe(q), /imposto estimado [0-9]/, 'sem estimativa (Q12)');
    assert.match(textoDe(q), /A app não estima o imposto destas rendas/);
    assert.ok(kpiDe(h, 'Rendas ilíquidas').pes.some((p) => /no Anexo J, quadro 7A/.test(p)));
    /* só o Anexo J, sem linhas do Anexo F: o imposto é «sem estimativa», e não 0 € (N051) */
    assert.match(h, /<div class="label">Imposto estimado<\/div><div class="value ">sem estimativa<\/div>/);
    assert.match(textoDe(kpiDe(h, 'Imposto estimado').expl), /As rendas de imóveis fora de Portugal \(Anexo J\) dependem do país, da convenção e do englobamento: a app não as estima/);
  });

  test('sem o código do país, o campo falta', () => {
    imovel({ pais: 'França' }); contrato();
    rendas(1000);
    const q = cartao(pagina(), 'Anexo J · quadro 7A');
    assert.equal(valorDe(q, 'País da fonte'), 'França <span class="badge red">falta o código na ficha do imóvel</span>');
  });
});

describe('D134 — «Fora do Anexo F · categoria B» e a frase de «A tua situação fiscal»', () => {
  test('o contrato na categoria B tem o cartão com o valor, o total e o anexo, em vez do «nada fora»', () => {
    imovel(); contrato({}, { categoriaB: true });
    rendas(1000);
    const h = pagina();
    assert.doesNotMatch(h, /Sem rendas em 2026/);
    const q = cartao(h, 'Fora do Anexo F · categoria B');
    assert.ok(q, 'o cartão da categoria B');
    assert.match(textoDe(q), new RegExp('Arroios T2 Arroios · 12 rendas em 2026 ' + textoDe(app.euro2(12000))));
    assert.match(textoDe(q), /Anexo B, no regime simplificado, ou no Anexo C/);
    assert.doesNotMatch(h, /fis-nada-fora/);
    assert.ok(kpiDe(h, 'Rendas ilíquidas').pes.some((p) => /na categoria B \(Anexo B ou C\)/.test(p)));
  });

  /* N063 (D8): a nota da categoria B saiu de «A tua situação fiscal» — dizem-na o contrato
     (a pergunta da categoria B) e o cartão «Fora do Anexo F · categoria B» */
  test('«A tua situação fiscal» já não fala da categoria B; o cartão dela diz onde se marca', () => {
    imovel(); contrato();
    rendas(1000);
    const s = textoDe(app.fiscoSituacaoCard(resumo(), true));
    assert.doesNotMatch(s, /categoria B/);
    const r = Object.assign(resumo(), { categoriaB: [{ contratoId: 'C1', nome: 'Arroios', imovel: 'T2 Arroios', rendas: 12000, n: 12, quota: 1 }] });
    assert.match(textoDe(app.fiscoCategoriaBCard(r)), /A marca muda-se na ficha do contrato\./);
  });
});

describe('D135, D137 — a união de freguesias extinta e a caderneta atual', () => {
  test('2026: o código da união é falta, o artigo «pode ter mudado», e as freguesias repostas na nota', () => {
    imovel({ freguesiaCodigo: '010123' }); contrato();
    rendas(1000);
    const q = cartao(pagina(), 'Quadro 4.1');
    assert.equal(valorDe(q, 'Freguesia (código)'), '010123 <span class="badge red">troca pelo da caderneta atual</span>');
    assert.equal(subDe(q, 'Freguesia (código)'), 'união de freguesias extinta em 2025');
    assert.equal(valorDe(q, 'Artigo'), '4651 <span class="badge amber">pode ter mudado</span>');
    assert.match(textoDe(q), /O código 010123 é o de uma união de freguesias que deixou de existir em outubro de 2025 \(Lei 25-A\/2025\): o prédio passou para uma destas — 010128 Agadão, 010132 Belazaima do Chão ou 010134 Castanheira do Vouga/);
    assert.match(textoDe(q), /caderneta predial atual/);
  });

  test('a marca da caderneta não o cala: um código de união já não está em nenhuma caderneta (N087)', () => {
    imovel({ freguesiaCodigo: '010123', matrizConfirmada: '2026-11-02' }); contrato();
    rendas(1000);
    const q = cartao(pagina(), 'Quadro 4.1');
    assert.equal(valorDe(q, 'Freguesia (código)'), '010123 <span class="badge red">troca pelo da caderneta atual</span>');
    assert.doesNotMatch(textoDe(q), /confirmad[oa] na caderneta|Confirmaste/);
    assert.equal(valorDe(q, 'Artigo'), '4651 <span class="badge amber">pode ter mudado</span>');
  });

  test('2024 (uma substituição): o código da união é o certo, sem nada a dizer', () => {
    imovel({ freguesiaCodigo: '010123' }); contrato({ start: '2024-01-01' });
    rendas(1000, M12, {}, 2024);
    const q = app.fiscoQuadroCard(resumo(2024), '4.1');
    assert.equal(valorDe(q, 'Freguesia (código)'), '010123');
    assert.doesNotMatch(textoDe(q), /desagregada|repostas cerca de 300/);
  });

  test('D137: sem o código, o campo diz que vem da caderneta atual; a dica do quadro fala da reposição só com uma união extinta (N066)', () => {
    imovel({ freguesiaCodigo: '' }); contrato();
    rendas(1000);
    const q = cartao(pagina(), 'Quadro 4.1');
    assert.equal(subDe(q, 'Freguesia (código)'), 'da caderneta predial atual');
    assert.doesNotMatch(textoDe(q), /foram repostas cerca de 300/, 'sem união extinta, a dica não fala da reposição');
    const r = resumo();
    r.linhas = r.linhas.map((l) => Object.assign({}, l, { freguesiaUniao: { codigo: '010123', repostas: [] } }));
    assert.match(textoDe(app.fiscoQuadroCard(r, '4.1')), /copiam-se da caderneta predial atual ou da nota de cobrança do IMI mais recente: em outubro de 2025 foram repostas/);
  });

  test('D136: o código fora do formato é falta no campo', () => {
    imovel({ freguesiaCodigo: '0302' }); contrato();
    rendas(1000);
    const q = cartao(pagina(), 'Quadro 4.1');
    assert.equal(valorDe(q, 'Freguesia (código)'), '0302 <span class="badge red">fora do formato</span>');
  });
});

describe('D112 — a renda do recibo, antes da retenção, da comissão e de descontos', () => {
  test('o KPI das rendas e a dica do quadro dizem-no, com a comissão da gestora como gasto', () => {
    imovel(); contrato();
    rendas(1000);
    const h = pagina();
    const k = textoDe(kpiDe(h, 'Rendas ilíquidas').expl);
    assert.match(k, /^A renda do recibo, antes da retenção, da comissão e de descontos/);
    assert.match(k, /a comissão é um gasto, na coluna Outros/);
    assert.doesNotMatch(k, /^O que entrou como renda/);
    assert.match(textoDe(cartao(h, 'Quadro 4.1')), /Rendas ilíquidas: a renda do recibo, antes da retenção, da comissão e de descontos/);
  });
});
