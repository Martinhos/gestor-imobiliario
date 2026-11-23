// A página da Declaração, ronda 2 da segunda auditoria ao IRS:
//   N066  a ordem da maqueta 6 (números, «A tratar», os quadros, a situação numa linha, os
//         prazos só com prazos); o total do quadro só com mais de uma linha; a dica do quadro
//         só com o seu caso
//   N063  «A tua situação fiscal»: a F só com a conjunta, os dependentes à parte, a dispensa só
//         ligada ou a pedido, sem a nota da categoria B
//   N050  o KPI do imposto num ano sem regras: «—» e «sem regras de AAAA»
//   N051  rendas no Anexo J ou na categoria B: dito à vista no imposto; sem Anexo F, «sem estimativa»
//   N120  as taxas do continente e os Açores à vista no imposto
//   N123  os prejuízos de anos anteriores ao rendimento e quanto desce o imposto
//   N124  os prejuízos dos anos que não estão na app, no porquê do imposto
//   N151  os benefícios do EBF caem com dívidas às Finanças e à Segurança Social
//   N092  o 4.2C com as portarias do ano e as datas, como o PDF
//   N010  o Anexo J por titular, em conjunta
//   N029  a categoria B sem os recibos de renda eletrónicos
//   N030  o arrendamento rural fora de quem tem dispensa
//   N075  as outras receitas prediais a 28 %, não habitacional
//   N082  o quadro 8 facultativo, com o texto do PDF
//   N140  o quadro 5: a diferença negativa sem «Prejuízo»; as rendas de anos anteriores no quadro 8
//   N141  a categoria B com os gastos que saíram e a caução à parte
//   N142  o Anexo J: o líquido negativo a âmbar; os imóveis do mesmo país numa linha
//   N116  as obras de um contrato que começou num ano sem rendas: confirmar com a AT
//   N077  a linha 02 pede recibo eletrónico; a 05 não
//   N107  os valores a copiar com os separadores no CSS (formato.js:fmtCopiavel)
//   N125  no quadro 10, os anos da regularização antes das regras da app, por confirmar
// E os dois botões de um aviso de «A tratar» (a ação e o abrir).
// Os campos novos do resumo (r.quadro5[].anosAnteriores, r.categoriaB[].gastos, gastosColunas,
// caucao e nCaucao, a linha 02 a 28 % com motivoTaxa 'nh', taxas.limiteRendaAlta.nota)
// testam-se também com um resumo feito à mão com essa forma.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-20' });
afterEach(() => repor(app));

/* o texto de um bocado de HTML, sem as etiquetas e com as entidades do esc de volta */
const texto = (html) => String(html).replace(/<[^>]+>/g, ' ')
  .replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
/* os euros como o texto() os deixa (o espaço dos milhares e o do € passam a espaço) */
const eu = (v) => texto(app.euro(v)), eu2 = (v) => texto(app.euro2(v));

/* um movimento normalizado, já na base */
const mov = (extra) => {
  const t = app.normTx(Object.assign({ kind: 'income', category: 'Rendas', propertyId: 'v1', recibo: true }, extra));
  app.db.transactions.push(t);
  return t;
};
/* as rendas mensais de um contrato num ano, de um mês a outro */
const rendas = (id, ano, valor, de = 1, ate = 12, pid = 'v1') => {
  for (let m = de; m <= ate; m++) mov({ amount: valor, contractId: id, propertyId: pid, date: ano + '-' + String(m).padStart(2, '0') + '-05' });
};
/* um contrato declarado, já na base */
const contrato = (o) => app.db.contracts.push(app.normContract(Object.assign({ name: 'Lumiar', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, active: true,
  start: '2025-01-01', fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp' } }, o)));

/* o HTML de um cartão da página (fisCartao), pelo começo do título; null sem ele */
function cartao(html, titulo) {
  const i = html.indexOf('<h2 class="ana-tit">' + titulo);
  if (i < 0) return null;
  const ini = html.lastIndexOf('<section', i);
  const fim = html.indexOf('<section', i);
  return html.slice(ini, fim > -1 ? fim : undefined);
}
/* o cartão de um KPI: o valor, os rodapés e a explicação */
function kpiDe(html, rotulo) {
  const i = html.indexOf('<div class="label">' + rotulo + '</div>');
  assert.ok(i > -1, 'há o cartão ' + rotulo);
  const fim = html.indexOf('<div class="card kpi', i);
  const h = html.slice(i, fim > -1 ? fim : undefined);
  return {
    valor: (/<div class="value [^"]*">(.*?)<\/div>/.exec(h) || [])[1],
    pes: [...h.matchAll(/<div class="foot">(.*?)<\/div>/g)].map((m) => m[1]),
    expl: texto((/<div class="expl">([\s\S]*?)<\/div>/.exec(h) || [])[1] || ''),
  };
}
/* um resumo feito à mão com a forma do resumoFiscal (os KPI e os cartões leem estes campos) */
function resumoFeito(totais, extra) {
  const cols = ['conservacao', 'condominio', 'imi', 'selo', 'taxas', 'outros'];
  const gastos = {}; cols.forEach((k) => { gastos[k] = 0; });
  return Object.assign({
    ano: 2026, versao: app.irsAno(2026), colunas: cols, titularId: 'ana', titulares: ['ana'], porInteiro: false, variosTitulares: false,
    linhas: [{ contratoId: 'C1', titularId: 'ana', titular: 'A', quadro: '4.1', motivoTaxa: 'base', taxa: 25, rendas: 28800, liquido: 28800, imposto: 7200 }],
    aimi: null, quadro5: [], anexoJ: [], categoriaB: [], fora: [], semContrato: [], avisos: [],
    totais: Object.assign({ rendas: 28800, retencoes: 0, gastos, obras24: 0, liquido: 28800, imposto: 7200, prejuizo: 0, anosAnteriores: 0,
      isentos: { n: 0, rendas: 0, liquido: 0 } }, totais),
  }, extra);
}

beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Vera', nif: '234567899' }));
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Lumiar', ownerIds: ['ana'], freguesiaCodigo: '110621', tipoPredio: 'U', matrix: '7000', fraction: 'C' }),
    app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['ana'], freguesiaCodigo: '110622', tipoPredio: 'U', matrix: '7001' }));
  app.CW = { user: { id: 'ana' }, _esperaFim: true };   // com sessão, e o estado da nuvem já chegou (os prazos mostram-se)
  app.fiscoAno = '2026';
  app.fiscoSitAberta = null;
  app.fiscoSitDispensaVer = false;
  app.render = () => {};
});

describe('N066 · a ordem da Declaração (maqueta 6) e o cartão do quadro', () => {
  test('números, «A tratar», os quadros, a situação numa linha e o aviso — sem os prazos vazios', () => {
    contrato({ id: 'C1' }); rendas('C1', 2026, 1000, 1, 10);
    const AT = { modelo2: 1, cessacao: 1, recibos: 1, irs: 1, fev15: 1, rsaa: 1, modelo44: 1, elementos: 1 };
    assert.equal(app.prazosAtivos().filter((p) => AT[p.tipo]).length, 0, 'controlo: nenhum prazo da AT na janela de aviso');
    const html = app.vFisco();
    const kpis = html.indexOf('fis-kpis'), tratar = html.indexOf('A tratar antes de entregar'), q41 = html.indexOf('Quadro 4.1 · sem redução');
    const sit = html.indexOf('A tua situação fiscal em 2026'), aviso = html.indexOf('fis-aviso');
    assert.ok(kpis > -1 && tratar > kpis && q41 > tratar && sit > q41 && aviso > sit, 'kpis < A tratar < 4.1 < situação < aviso');
    assert.ok(sit > html.indexOf('fiscoPilha'), 'a situação depois da pilha dos quadros');
    assert.doesNotMatch(html, /Prazos da AT|Nada para já/, 'sem prazos, sem o cartão');
    assert.doesNotMatch(html, /Os prazos com data estão nos Prazos da AT/, 'nem a frase que aponta para ele');
  });

  test('com prazos ativos, o cartão dos prazos vem depois da situação', () => {
    contrato({ id: 'C1' }); rendas('C1', 2026, 1000, 1, 10);
    app.prazosAtivos = () => [{ tipo: 'irs', titulo: 'Entrega do IRS', sub: 'até 30/06', data: '2027-06-30', abrir: '' }];
    const html = app.vFisco();
    assert.ok(html.indexOf('<h2 class="ana-tit">Prazos da AT') > html.indexOf('<h2 class="ana-tit">A tua situação fiscal'), 'os prazos depois da situação');
    assert.match(html, /Os prazos com data estão nos Prazos da AT, depois dos quadros\./);
  });

  test('um contrato só: o quadro 4.1 sem «Total do quadro 4.1»; com dois, o total volta', () => {
    contrato({ id: 'C1' }); rendas('C1', 2026, 1000);
    let q = cartao(app.vFisco(), 'Quadro 4.1');
    assert.ok(q, 'há o quadro 4.1');
    assert.doesNotMatch(q, /Total do quadro 4\.1/, 'com uma linha, o total repetia-a');
    contrato({ id: 'C2', name: 'Benfica', propertyId: 'v2', tenantIds: ['t2'], fisco: { estado: 'declarado', numero: '2020202', finalidade: 'hp' } });
    rendas('C2', 2026, 500, 1, 12, 'v2');
    q = cartao(app.vFisco(), 'Quadro 4.1');
    assert.equal((q.match(/Total do quadro 4\.1/g) || []).length, 2, 'com duas linhas, o total no resumo e em cartão');
  });

  test('a dica do quadro da pessoa comum não fala da gestora, do VPT nem das uniões de freguesias', () => {
    contrato({ id: 'C1' }); rendas('C1', 2026, 1000);
    mov({ kind: 'expense', category: 'Condomínio', amount: 300, date: '2026-03-10' });
    const t = texto(cartao(app.vFisco(), 'Quadro 4.1'));
    assert.match(t, /Rendas ilíquidas: a renda do recibo, antes da retenção, da comissão e de descontos\./);
    assert.doesNotMatch(t, /gestora|VPT|uniões|caução, no ano|devolveste/);
  });

  test('a repartição pelas rendas só num imóvel com mais do que um contrato e gastos', () => {
    contrato({ id: 'C1' }); contrato({ id: 'C2', name: 'Quarto 2', tenantIds: ['t2'], fisco: { estado: 'declarado', numero: '2020202', finalidade: 'hp' } });
    rendas('C1', 2026, 1000); rendas('C2', 2026, 500);
    mov({ kind: 'expense', category: 'Condomínio', amount: 300, date: '2026-03-10' });
    assert.match(texto(cartao(app.vFisco(), 'Quadro 4.1')), /repartem-se pelas linhas na proporção das rendas de cada uma/);
  });

  test('a situação fiscal fecha numa linha com o resumo e «Mudar»; abre e fecha', () => {
    contrato({ id: 'C1' }); rendas('C1', 2026, 1000);
    let s = cartao(app.vFisco(), 'A tua situação fiscal em 2026');
    assert.match(s, /<span class="small">Em separado, titular A · recibos eletrónicos<\/span>/);
    assert.match(s, /id="fiscoSitMudar"[^>]*data-click="fiscoSitMudar\(true\)" aria-expanded="false" aria-controls="fiscoSitCorpo">Mudar<\/button>/);
    assert.match(s, /<div class="fis-sit-corpo" id="fiscoSitCorpo" hidden>/, 'fechado, o corpo escondido');
    assert.match(s, /id="fiscoConjunta"/, 'os interruptores estão lá, escondidos');
    app.fiscoSitMudar(true);
    s = cartao(app.vFisco(), 'A tua situação fiscal em 2026');
    assert.match(s, /<div class="fis-sit-corpo" id="fiscoSitCorpo">/, 'aberto');
    assert.match(s, />Fechar<\/button>/);
    assert.match(s, /Grava ao mexer\./);
    app.fiscoSitMudar(false);
    assert.match(cartao(app.vFisco(), 'A tua situação fiscal em 2026'), /id="fiscoSitCorpo" hidden/);
  });

  test('o resumo da situação em conjunta e com a dispensa; abre sozinho com o cônjuge por escolher', () => {
    app.db.owners.push(app.normPerson({ id: 'rui', name: 'Rui' }));
    contrato({ id: 'C1' }); rendas('C1', 2026, 1000);
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true, conjugeId: 'rui', minhaLetra: 'B', dispensaRecibos: true } } });
    let s = cartao(app.vFisco(), 'A tua situação fiscal em 2026');
    assert.match(texto(s), /Em conjunta com Rui, és o titular B · dispensa dos recibos eletrónicos/);
    assert.match(s, /id="fiscoSitCorpo" hidden/);
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true } } });
    s = cartao(app.vFisco(), 'A tua situação fiscal em 2026');
    assert.match(s, /id="fiscoSitCorpo">/, 'a conjunta sem o cônjuge escolhido, havendo quem escolher: aberto');
    app.fiscoSitMudar(false);
    assert.match(cartao(app.vFisco(), 'A tua situação fiscal em 2026'), /id="fiscoSitCorpo" hidden/, 'fechado à mão, fica fechado');
  });

  test('a ordem do quadro 6: os benefícios (6A a 6C) antes dos isentos (6D)', () => {
    const r = resumoFeito({}, { linhas: [
      { contratoId: 'C1', nome: 'Reab', titularId: 'ana', titular: 'A', quadro: '4.1', rendas: 1000, liquido: 1000, imposto: 50, campo: '4001', beneficios: [{ quadro: '6A', nome: 'Imóveis reabilitados', taxa: 5, campos: ['6001'] }], obras24: { valor: 0 }, gastos: {} },
      { contratoId: 'C2', nome: 'Isento', titularId: 'ana', titular: 'A', quadro: '4.1', rendas: 1000, liquido: 1000, imposto: 0, campo: '4002', isencao: { quadro: '6D', codigo: '01', nome: 'PAA' }, obras24: { valor: 0 }, gastos: {} }] });
    const h = app.fiscoBeneficiosCard(r) + app.fiscoIsentosCard(r);
    assert.ok(h.indexOf('Quadro 6A') > -1 && h.indexOf('Quadro 6D') > h.indexOf('Quadro 6A'), 'controlo dos cartões');
    const src = app.vFisco.toString();
    assert.ok(src.indexOf('fiscoBeneficiosCard(r)') < src.indexOf('fiscoIsentosCard(r)'), 'a página põe o 6A a 6C antes do 6D');
  });
});

describe('N063 e N030 · «A tua situação fiscal», aberta', () => {
  const sit = (extra) => app.fiscoSituacaoCard(Object.assign({ ano: 2026, titularId: 'ana', titulares: ['ana'], porInteiro: false }, extra || {}), true);

  test('por omissão: sem o óbito, sem a categoria B e sem a caixa postal; os dependentes e «Quem tem dispensa?» à vista', () => {
    const h = sit(), t = texto(h);
    assert.doesNotMatch(t, /óbito|categoria B|caixa postal|Modelo 44/);
    assert.match(t, /As rendas de um dependente declaram-se com a letra dele — D1, AF1 ou DG1, como no quadro 6B do rosto —, em conjunta ou em separado\./);
    assert.match(h, /id="fiscoSitQuemDispensa"[^>]*data-click="fiscoSitVerDispensa\(\)"[^>]*>Quem tem dispensa\?<\/button>/);
  });

  test('com a conjunta ligada, a letra F do ano do óbito', () => {
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true } } });
    assert.match(texto(sit()), /No ano do óbito do cônjuge, com a opção pela conjunta, as rendas que eram só dele levam a letra F/);
  });

  test('com a dispensa ligada, quem a tem e o Modelo 44 — e o arrendamento rural à parte (N030)', () => {
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { dispensaRecibos: true } } });
    const t = texto(sit());
    assert.match(t, /Em 2026 tem dispensa quem a 31 de dezembro de 2025 tinha 65 anos ou mais, ou quem não tem nem é obrigado a ter caixa postal eletrónica e recebeu rendas de 2025 até [^(]+\(duas vezes o IAS de 2025\) — ou não as recebeu e não conta passar esse valor em 2026 \(Portaria 98-A\/2015, art\. 5\.º\)\./);
    assert.doesNotMatch(t, /e o arrendamento rural/, 'o rural não está entre quem tem dispensa');
    assert.match(t, /As rendas de um arrendamento rural não pedem recibo eletrónico \(art\. 5\.º n\.º 3 a\)\): isso marca-se no contrato, e não aqui, e não te dispensa dos recibos dos outros contratos; podes declará-las no Modelo 44, se quiseres\./);
    assert.match(t, /o Modelo 44, a declaração anual das rendas de 2026, até ao fim de fevereiro de 2027/);
  });

  test('«Quem tem dispensa?» mostra a nota sem ligar a dispensa', () => {
    app.fiscoSitVerDispensa();
    assert.match(texto(sit()), /tem dispensa quem/);
    assert.equal(app.irsSituacao(2026, 'ana').dispensaRecibos, false, 'a dispensa continua desligada');
  });
});

describe('N050 · o KPI do imposto num ano sem regras', () => {
  test('2024: «—» e «sem regras de 2024», sem a falta a pagar nem «a lei de 2024»', () => {
    contrato({ id: 'C1', start: '2023-01-01', end: '2030-12-31' });
    rendas('C1', 2024, 1000); mov({ amount: 0, contractId: 'C1', date: '2024-12-20' });
    app.db.transactions.forEach((t) => { if (t.contractId === 'C1') t.retencao = 250; });
    app.fiscoAno = '2024';
    const r = app.resumoFiscal(2024);
    assert.equal(r.semRegrasDoAno, true, 'controlo: 2024 é antes da primeira versão');
    assert.ok(r.totais.imposto > 0, 'controlo: o resumo calculou um imposto');
    const k = kpiDe(app.fiscoKpis(r), 'Imposto estimado');
    assert.equal(k.valor, '—');
    assert.deepEqual(k.pes, ['sem regras de 2024']);
    assert.doesNotMatch(k.expl, /a lei de 2024 dá/);
    assert.match(k.expl, /A app não tem as regras de 2024/);
  });
});

describe('N051 e N120 · o que fica de fora do imposto, à vista', () => {
  test('só Anexo J e categoria B: «sem estimativa», e não 0 €', () => {
    const r = resumoFeito({ rendas: 0, liquido: 0, imposto: 0, anexoJ: { rendas: 18000 }, categoriaB: { rendas: 24000 } },
      { linhas: [], anexoJ: [{ contratoId: 'J1', rendas: 18000 }], categoriaB: [{ contratoId: 'B1', rendas: 24000 }] });
    const k = kpiDe(app.fiscoKpis(r), 'Imposto estimado');
    assert.equal(k.valor, 'sem estimativa');
    assert.deepEqual(k.pes, ['a app não estima as rendas do Anexo J e da categoria B']);
  });

  test('com linhas do Anexo F e um imóvel lá fora: o rodapé à vista diz que não as estima; e as taxas do continente', () => {
    const r = resumoFeito({ anexoJ: { rendas: 18000 } }, { anexoJ: [{ contratoId: 'J1', rendas: 18000 }] });
    const k = kpiDe(app.fiscoKpis(r), 'Imposto estimado');
    assert.equal(k.valor, app.euro(7200));
    assert.ok(k.pes.includes('sem as rendas do Anexo J: a app não as estima'), k.pes.join(' | '));
    assert.equal(k.pes[k.pes.length - 1], 'taxas do continente; nos Açores a AT aplica menos 30 %');
  });

  test('o porquê: as taxas do continente e os Açores, sem a Madeira', () => {
    const k = kpiDe(app.fiscoKpis(resumoFeito({})), 'Imposto estimado');
    assert.deepEqual(k.pes, ['sem englobamento', 'taxas do continente; nos Açores a AT aplica menos 30 %']);
    assert.match(k.expl, /com as taxas do continente: a quem reside nos Açores a AT aplica-as 30 % mais baixas, pela residência/);
    assert.doesNotMatch(k.expl, /Madeira/);
  });
});

describe('N123 e N124 · os prejuízos de anos anteriores no imposto', () => {
  test('com abate: o que abateu ao rendimento e quanto desceu o imposto, com o par de nomes das exportações', () => {
    const reporte = { porTitular: { ana: { usado: 5400, imposto: 1350 } }, usado: 5400, imposto: 1350, anosSemDados: [] };
    const k = kpiDe(app.fiscoKpis(resumoFeito({ imposto: 7200, impostoDepoisDoReporte: 5850, retencoes: 600 }, { reporte })), 'Imposto estimado');
    assert.equal(k.valor, app.euro(5850), 'o número de cima é o de depois (D73)');
    assert.equal(k.pes[0], 'depois dos prejuízos de anos anteriores: −' + app.euro(5400) + ' ao rendimento (−' + app.euro(1350) + ' de imposto)');
    assert.ok(k.pes.includes('já retido ' + app.euro(600) + ' · falta ' + app.euro(5250)));
    assert.ok(k.expl.includes('O imposto estimado das linhas é ' + eu(7200) + ';'), k.expl);
    assert.ok(k.expl.includes('depois dos prejuízos de anos anteriores fica em ' + eu(5850)), k.expl);
    assert.doesNotMatch(k.expl, /não entram nesta estimativa/, 'com abate, a frase do reporte já diz o que pode faltar');
  });

  test('sem abate e com anos da janela sem dados: a frase só no porquê', () => {
    const reporte = { porTitular: {}, usado: 0, imposto: 0, anosSemDados: [2020, 2021, 2022, 2023, 2024] };
    const r = resumoFeito({ imposto: 1200, impostoDepoisDoReporte: 1200 }, { reporte });
    const k = kpiDe(app.fiscoKpis(r), 'Imposto estimado');
    assert.ok(k.expl.includes('Prejuízos de anos que não estão na app (de 2020 a 2024) não entram nesta estimativa; a AT abate-os na liquidação.'), k.expl);
    assert.ok(!k.pes.some((p) => /prejuízos/.test(p)), 'nenhum rodapé');
    assert.doesNotMatch(app.fiscoObrigacoesCard(r, false), /não entram nesta estimativa/, 'nunca em «A tratar»');
    assert.equal(app.fiscoKpiAnos([2019, 2021, 2023]), 'de 2019, 2021 e 2023');
    assert.equal(app.fiscoKpiAnos([2024]), 'de 2024');
  });
});

describe('N151 · os benefícios do EBF e as dívidas', () => {
  test('uma linha a 10 % (rendas moderadas): o porquê diz que só vale sem dívidas', () => {
    const r = resumoFeito({ imposto: 2880 }, { linhas: [{ contratoId: 'C1', titularId: 'ana', titular: 'A', quadro: '4.1', motivoTaxa: 'moderada', taxa: 10 }] });
    assert.match(kpiDe(app.fiscoKpis(r), 'Imposto estimado').expl, /A taxa de 10 % das rendas moderadas é um benefício fiscal: só vale sem dívidas por regularizar às Finanças e à Segurança Social \(EBF art\. 14\.º\)\./);
  });

  test('isentos e o 6A: no plural; só a redução pela duração não é do EBF', () => {
    let r = resumoFeito({}, { linhas: [{ contratoId: 'C1', titularId: 'ana', titular: 'A', quadro: '4.1', isencao: { quadro: '6D' } },
      { contratoId: 'C2', titularId: 'ana', titular: 'A', quadro: '4.1', motivoTaxa: 'reabilitacao', beneficios: [{ quadro: '6A', taxa: 5 }] }] });
    assert.match(kpiDe(app.fiscoKpis(r), 'Imposto estimado').expl, /As isenções e os benefícios do quadro 6A são benefícios fiscais: só valem sem dívidas/);
    r = resumoFeito({}, { linhas: [{ contratoId: 'C1', titularId: 'ana', titular: 'A', quadro: '4.2', motivoTaxa: 'duracao', taxa: 15 }] });
    assert.doesNotMatch(kpiDe(app.fiscoKpis(r), 'Imposto estimado').expl, /dívidas/);
  });
});

describe('N092 · o 4.2C com as portarias do ano, como o PDF', () => {
  test('2026: as duas tabelas com as datas e a nota da versão; 2025: só a Portaria 176/2019', () => {
    const l = { nome: 'Lumiar', celebracao: '2024-03-01', campo: '4501' };
    const r26 = resumoFeito({}, { ano: 2026, versao: app.irsAno(2026) });
    const t26 = texto(app.fiscoReducoesHtml(r26, [l]));
    assert.match(t26, /Portaria 176\/2019/);
    assert.match(t26, /Portaria 454\/2026\/1/);
    assert.match(t26, /até 31\/08\/2026/);
    const comNota = Object.assign({}, r26, { versao: Object.assign({}, r26.versao, { taxas: Object.assign({}, r26.versao.taxas,
      { limiteRendaAlta: Object.assign({}, r26.versao.taxas.limiteRendaAlta, { nota: 'Desde 1 de setembro de 2026, os limites leem-se como os novos (DL 97/2026, art. 14.º b)).' }) }) }) });
    assert.match(texto(app.fiscoReducoesHtml(comNota, [l])), /DL 97\/2026, art\. 14\.º b\)\)\. Um que passe não tem redução e vai ao 4\.1\./);
    const r25 = resumoFeito({}, { ano: 2025, versao: app.irsAno(2025) });
    const t25 = texto(app.fiscoReducoesHtml(r25, [Object.assign({}, l, { celebracao: '2024-03-01' })]));
    assert.match(t25, /Portaria 176\/2019/);
    assert.doesNotMatch(t25, /454\/2026/);
  });
});

describe('N010 e N142 · o Anexo J', () => {
  const j1 = (o) => Object.assign({ contratoId: 'J1', nome: 'Studio Paris', imovel: 'Paris', pais: 'França', paisCodigo: '250', codigo: 'F01',
    rendas: 6000, gastos: 0, liquido: 6000, impostoEstrangeiro: 300, quota: 0.5, faltas: [] }, o);

  test('em conjunta, um Anexo J por titular, cada um com o seu total e sem o total dos dois', () => {
    const r = resumoFeito({ anexoJ: { rendas: 13000, gastos: 0, liquido: 13000, impostoEstrangeiro: 650 } }, { titulares: ['ana', 'bruno'], variosTitulares: true,
      anexoJ: [j1({ titularId: 'ana', titular: 'A' }), j1({ contratoId: 'J2', nome: 'Loft Lyon', titularId: 'ana', titular: 'A', rendas: 1000, liquido: 1000, impostoEstrangeiro: 50 }),
        j1({ titularId: 'bruno', titular: 'B' })] });
    const h = app.fiscoAnexoJCard(r), t = texto(h);
    assert.ok(cartao(h, 'Anexo J do titular A · quadro 7A') && cartao(h, 'Anexo J do titular B · quadro 7A'), 'um cartão por titular');
    assert.match(t, /O Anexo J é individual: cada titular entrega o seu, com o NIF dele no quadro 3A\./);
    assert.doesNotMatch(t, /e por titular|Total do quadro 7A/);
    const a = texto(cartao(h, 'Anexo J do titular A'));
    assert.ok(a.includes('Total do Anexo J do titular A') && a.includes('Rendas ' + eu2(7000)) && a.includes('Imposto pago no estrangeiro ' + eu2(350)), a);
    assert.doesNotMatch(texto(cartao(h, 'Anexo J do titular B')), /Total do Anexo J/, 'uma entrada só, sem total');
  });

  test('o líquido negativo vai a âmbar, e os imóveis do mesmo país podem somar-se numa linha', () => {
    const r = resumoFeito({}, { anexoJ: [j1({ titularId: 'ana', titular: 'A', quota: 1, rendas: 2000, gastos: 5000, liquido: -3000 })] });
    const h = app.fiscoAnexoJCard(r), t = texto(h);
    assert.match(t, /Gastos acima das rendas: confirma no Portal como o campo aceita o valor\./);
    assert.match(h, /<dt>Rendimento líquido<span class="small">as rendas menos os gastos<\/span><\/dt><dd><span class="cp-eur">-3<span class="cp-g">000<\/span>,00<\/span> <span class="badge amber">confirma no Portal<\/span><\/dd>/);
    assert.match(t, /os imóveis do mesmo país podem somar-se numa linha/);
    assert.doesNotMatch(t, /uma linha por imóvel/);
    assert.ok(cartao(h, 'Anexo J · quadro 7A'), 'fora da conjunta, sem «do titular»');
  });
});

describe('N029 e N141 · a categoria B', () => {
  test('os recibos de renda não se emitem: o documento é a fatura', () => {
    const r = resumoFeito({ categoriaB: { rendas: 12000 } }, { categoriaB: [{ contratoId: 'B1', nome: 'Loja', imovel: 'Loja Baixa', rendas: 12000, n: 12, quota: 1 }] });
    const t = texto(app.fiscoCategoriaBCard(r));
    assert.match(t, /O contrato continua com o Modelo 2; os recibos de renda eletrónicos não se emitem \(Portaria 98-A\/2015, art\. 5\.º n\.º 1\): o documento é a fatura ou a fatura-recibo da tua atividade\./);
    assert.doesNotMatch(t, /Modelo 2 e os recibos/);
  });

  test('os gastos que saíram com as rendas e a caução contada à parte', () => {
    const r = resumoFeito({ categoriaB: { rendas: 14000 } }, { categoriaB: [{ contratoId: 'B1', nome: 'C1', imovel: 'T2 Arroios', rendas: 14000, n: 13, nCaucao: 1, caucao: 2000, quota: 1,
      gastos: 646.15, gastosTotal: 646.15, gastosColunas: { condominio: 646.15 } }] });
    const t = texto(app.fiscoCategoriaBCard(r));
    assert.match(t, /12 rendas e a caução em 2026/);
    assert.ok(t.includes('Gastos do imóvel que saíram com estas rendas: ' + eu2(646.15)), t);
    assert.ok(t.includes('rendas menos gastos: ' + eu2(13353.85)), t);
    assert.doesNotMatch(t, /13 rendas/);
  });
});

describe('N075 · as outras receitas prediais', () => {
  test('a linha 02 diz os 28 %: não é arrendamento habitacional', () => {
    contrato({ id: 'C1' });
    const r = resumoFeito({}), l = { contratoId: 'C1', nome: 'Lumiar', imovel: 'T2 Lumiar', titularId: 'ana', titular: 'A', quadro: '4.1', papel: 'outra', natureza: '02',
      motivoTaxa: 'nh', taxa: 28, quota: 1, rendas: 2400, liquido: 2160, imposto: 604.8, gastos: {}, obras24: { valor: 0 }, inquilinos: [], faltas: [], datas: {} };
    assert.match(texto(app.fiscoContratoHtml(r, l)), /vão numa linha à parte, com a natureza 02 \(CIRS art\. 8\.º n\.º 2\), a 28 %: não é arrendamento habitacional \(CIRS art\. 72\.º n\.º 1 e\)\)\./);
  });

  test('N077: a 02 pede recibo eletrónico, como as rendas; a indemnização (05) não', () => {
    contrato({ id: 'C1' });
    const r = resumoFeito({}), base = { contratoId: 'C1', nome: 'Lumiar', imovel: 'T2 Lumiar', titularId: 'ana', titular: 'A', quadro: '4.1', quota: 1, rendas: 2400,
      liquido: 2400, imposto: 600, gastos: {}, obras24: { valor: 0 }, inquilinos: [], faltas: [], datas: {} };
    const t02 = texto(app.fiscoContratoHtml(r, Object.assign({}, base, { papel: 'outra', natureza: '02', motivoTaxa: 'nh', taxa: 28 })));
    assert.match(t02, /Pedem recibo eletrónico, como as rendas \(CIRS art\. 115\.º n\.º 5 a\)\)\./);
    assert.doesNotMatch(t02, /sem recibo/);
    assert.match(texto(app.fiscoContratoHtml(r, Object.assign({}, base, { papel: 'indemnizacao', natureza: '05', motivoTaxa: 'base', taxa: 25 }))), /sem recibo de renda/);
  });
});

describe('N125 · a regularização dos anos antes das regras da app, no quadro 10', () => {
  test('os anos por confirmar dizem-se e não se somam', () => {
    const r = resumoFeito({ regularizacao: 240 }, { cessados: [{ contratoId: 'L1', nome: 'Lumiar', titular: 'A', regime: '01', numero: '2020202', motivo: '01',
      data: '2026-01-03', anoInicioBeneficio: 2022, anoInicioConfirmar: false }],
    regularizacoes: [{ contratoId: 'L1', nome: 'Lumiar', anos: [{ ano: 2025, diferenca: 240 }], total: 240, porConfirmar: [{ ano: 2024, diferenca: 240 }], totalPorConfirmar: 240, anosSemRegras: [2024] }] });
    assert.ok((r.versao.quadro10.motivos || []).some((m) => String(m.codigo) === '01' && m.regulariza), 'controlo: o 01 regulariza');
    const t = texto(app.fiscoQuadro10Card(r));
    assert.ok(t.includes('estimativa sem juros: ' + eu2(240) + ' (2025: ' + eu2(240) + ')'), t);
    assert.ok(t.includes('Os anos antes das regras da app (2024: ' + eu2(240) + ') ficam por confirmar: as taxas eram outras, e não se somam.'), t);
  });
});

describe('N107 · os valores a copiar', () => {
  test('o NIF e os euros do cartão do contrato levam os separadores no CSS (copiam-se limpos)', () => {
    contrato({ id: 'C1' }); rendas('C1', 2026, 1000);
    const q = cartao(app.vFisco(), 'Quadro 4.1');
    assert.match(q, /<dt>Rendas \(rendimento ilíquido\)(?:<span class="small">[^<]*<\/span>)?<\/dt><dd><span class="cp-eur">12<span class="cp-g">000<\/span>,00<\/span><\/dd>/);
    assert.match(q, /<dd><span class="u-ws-nowrap">123<span class="cp-g">456<\/span><span class="cp-g">789<\/span><\/span><\/dd>/);
    const j = app.fiscoCampoHtml({ campo: 'Rendimento líquido', valor: app.euro2(6000) });
    assert.match(j, /<dd><span class="cp-eur">6<span class="cp-g">000<\/span>,00<\/span><\/dd>/);
  });
});

describe('N082 e N140 · o quadro 8 e o quadro 5', () => {
  test('o quadro 8 é facultativo e fica em branco sem o regime do art. 74.º — o mesmo texto do PDF', () => {
    const r = resumoFeito({}, { versao: app.irsAno(2026), linhas: [{ contratoId: 'C1', nome: 'Lumiar', titularId: 'ana', titular: 'A', quadro: '4.1', campo: '4001',
      anosAnteriores: [{ ano: 2025, valor: 1000, retencoes: 0 }] }] });
    const t = texto(app.fiscoAnosAnterioresCard(r));
    assert.match(t, /facultativo/);
    assert.match(t, /em branco/);
    assert.ok(t.includes(texto(app.esc(app.fiscoQuadro8Texto(r)))), 'o texto do cartão é o das exportações');
  });

  test('as rendas de anos anteriores do subarrendatário vão ao cartão do quadro 8, com o quadro 5', () => {
    const r = resumoFeito({}, { linhas: [], quadro5: [{ contratoId: 'S1', nome: 'Sub Graça', titular: 'A', anosAnteriores: [{ ano: 2025, valor: 900, retencoes: 0 }] }] });
    const t = texto(app.fiscoAnosAnterioresCard(r));
    assert.match(t, /Sub Graça quadro 5 · respeitam a 2025/);
  });

  test('a diferença negativa do quadro 5 diz «sem rendimento», e não «Prejuízo»', () => {
    const r = resumoFeito({ quadro5: { rendaRecebida: 2400, rendaPaga: 12000, liquido: -9600, imposto: 0, retencoes: 0, n: 1 } },
      { quadro5: [{ contratoId: 'S1', nome: 'Sub Graça', imovel: 'T1 Graça', titular: 'A', quota: 1, taxa: 25, rendaRecebida: 2400, rendaPaga: 12000, liquido: -9600, imposto: 0, inquilinos: [] }] });
    const t = texto(app.fiscoQuadro5Card(r));
    assert.doesNotMatch(t, /Prejuízo/);
    assert.match(t, /sem rendimento: pagaste ao senhorio mais do que recebeste/);
  });
});

describe('N116 · as obras de um contrato que começou num ano sem rendas', () => {
  test('a linha diz que as instruções as pedem no ano do início e manda confirmar com a AT', () => {
    const r = resumoFeito({ obras24: 2000 }, { linhas: [{ contratoId: 'C1', nome: 'Lumiar', imovel: 'T2 Lumiar', titular: 'A', quadro: '4.1', campo: '4001',
      inicio: '2025-12-10', obras24: { valor: 2000, inicioGastos: '2025-11-15' } }] });
    const t = texto(app.fiscoObrasCard(r));
    assert.match(t, /As instruções pedem estas obras no ano do início do contrato; se o Portal não aceitar o início em 2025 nesta declaração, confirma com a AT \(e-balcão\)\./);
    const r2 = resumoFeito({ obras24: 2000 }, { linhas: [Object.assign({}, r.linhas[0], { inicio: '2026-02-01' })] });
    assert.doesNotMatch(texto(app.fiscoObrasCard(r2)), /e-balcão/, 'no ano do início, nada a confirmar');
  });
});

describe('«A tratar»: os dois botões de um aviso', () => {
  test('a ação primária à frente e o abrir com o seu rótulo; sem ação, como antes', () => {
    const r = resumoFeito({}, { avisos: [
      { texto: 'T2 Lumiar: és o único dono?', nivel: 'aviso', acao: "imvSoMeu('v1')", acaoTexto: 'É só meu', abrir: "imvAbrirQuotas('v1')", abrirTexto: 'Há outros donos', toca: 'camada' },
      { texto: 'Contrato sem n.º', nivel: 'falta', abrir: "ctView('C1')", toca: 'camada' }] });
    const h = app.fiscoObrigacoesCard(r, false);
    assert.match(h, /<span class="chips-fila fis-ob-acoes"><button type="button" class="btn sm primary" data-toca="camada" data-click="imvSoMeu\('v1'\)">É só meu<\/button><button type="button" class="btn sm" data-toca="camada" data-click="imvAbrirQuotas\('v1'\)">Há outros donos<\/button><\/span>/);
    assert.match(h, /data-click="ctView\('C1'\)">Abrir contrato<\/button>/);
    assert.equal(app.fiscoRotuloDoAviso("goMovimentos('2026','v1')"), 'Ver os movimentos');
    assert.equal(app.fiscoRotuloDoAviso("personView('owner','ana')"), 'Abrir proprietário');
    assert.equal(app.fiscoRotuloDoAviso("personView('tenant','t1')"), 'Abrir inquilino');
    assert.equal(app.fiscoRotuloDoAviso('fiscoSitAbrir()'), 'Abrir a situação fiscal');
  });
});
