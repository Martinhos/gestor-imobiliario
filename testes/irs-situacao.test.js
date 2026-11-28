// A situação fiscal de cada ano e o imposto do KPI na página da Declaração
// (web/app/fisco.js).
//
// O que aqui se guarda, defeito a defeito:
// - D91: a situação (conjunta, cônjuge, letra, dispensa, AIMI) grava-se no
//   ano dos rendimentos, em settings.irs.porAno, com a cópia do que o ano
//   herdava na primeira escrita; mudar 2026 não refaz a Declaração de 2025.
// - D30: o cônjuge é um proprietário escolhido, e a minha letra A/B é só a
//   posição no Rosto (o cônjuge fica com a outra); não há letra por
//   proprietário.
// - D31: com a conjunta, a nota de que só entram os imóveis do cônjuge que
//   estão nesta app; sem cônjuge escolhido, que entram só as minhas rendas.
// - D70: a nota fixa das letras F e D1/AF1/DG1 continua com a conjunta.
// - D111: o limite da dispensa dos recibos é o das rendas do ano anterior até
//   duas vezes o IAS desse ano, lido da versão das regras.
// - D10: a regularização do quadro 10 soma-se à parte no KPI, como
//   estimativa sem juros, e a falta a pagar conta com ela.
// - D73 (Q10): o KPI mostra o imposto depois de abater os prejuízos de anos
//   anteriores, com a linha do que abateu, por titular em conjunta.
// - Os prazos da AT na página: o aviso sem data diz «Sem prazo», e um prazo
//   que se resolve no próprio aviso traz o botão, sem ficar dentro de uma
//   linha que se toca inteira.
//
// O KPI e os prazos leem um resumo e uma lista feitos à mão com a forma do
// contrato (o r.reporte, o totais.impostoDepoisDoReporte e o
// totais.regularizacao vêm da folha do resumo, na mesma vaga).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

/* O que se lê de um pedaço de HTML: sem etiquetas, com as entidades do esc de
   volta e os espaços juntos.
   Recebe: html — o HTML (string).
   Devolve: o texto (string). */
function textoDe(html) {
  return String(html).replace(/<\/?(?:b|strong|i|em|span|a|abbr|small)\b[^>]*>/gi, '').replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/* Uma cópia simples de um objeto da app (os de lá não são deepEqual aos de cá).
   Recebe: o — o objeto.
   Devolve: a cópia. */
const copia = (o) => JSON.parse(JSON.stringify(o));

/* Um movimento já normalizado, na base.
   Recebe: extra — os campos do movimento.
   Devolve: o movimento. */
const mov = (extra) => {
  const t = app.normTx(Object.assign({ kind: 'income', category: 'Rendas', recibo: true }, extra));
  app.db.transactions.push(t);
  return t;
};

/* A Ana (com sessão) e o Rui, cada um com o seu imóvel e as rendas de 2025
   (o cenário s14 da auditoria); o Rui tem ainda conta na app como proprietário.
   Devolve: nada. */
function montaAnaERui() {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'rui', name: 'Rui' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
  app.db.properties.push(
    app.normProp({ id: 'v1', name: 'T2 da Ana', ownerIds: ['ana'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '1' }),
    app.normProp({ id: 'v2', name: 'T1 do Rui', ownerIds: ['rui'], freguesiaCodigo: '110624', tipoPredio: 'U', matrix: '2' }));
  app.db.contracts.push(
    app.normContract({ id: 'C1', name: 'Ana', propertyId: 'v1', tenantIds: ['t1'], rent: 800, start: '2024-01-01', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } }),
    app.normContract({ id: 'C2', name: 'Rui', propertyId: 'v2', tenantIds: ['t1'], rent: 500, start: '2024-01-01', fisco: { estado: 'declarado', numero: '2', finalidade: 'hp' } }));
  for (let m = 1; m <= 12; m++) {
    const d = `2025-${String(m).padStart(2, '0')}-05`;
    mov({ amount: 800, contractId: 'C1', propertyId: 'v1', date: d });
    mov({ amount: 500, contractId: 'C2', propertyId: 'v2', date: d });
  }
  app.CW = { user: { id: 'ana' } };
  app.render = () => {};
}

/* O cartão da situação de um ano, aberto (desde a D8 fecha numa linha com
   «Mudar»), com um resumo feito à mão (o cartão só lê o ano, quem declara e
   se é por inteiro).
   Recebe: ano — o ano; extra (opcional) — o que muda no resumo.
   Devolve: o HTML do cartão. */
const cartao = (ano, extra) => app.fiscoSituacaoCard(Object.assign({ ano, titularId: 'ana', titulares: ['ana'], porInteiro: false }, extra || {}), true);
/* a explicação de um «?» do cartão (KAN-127-17: as notas saíram da vista para o «?»), num texto só */
const ajuda = (chave, ano) => app.fisAjudaTexto(chave, ano).join(' ').replace(/\s+/g, ' ');

describe('D91: a situação é de cada ano', () => {
  beforeEach(montaAnaERui);

  test('mudar 2026 grava em porAno[2026], com a cópia do herdado; os campos de topo e 2025 ficam', () => {
    app.db.settings.irs = app.normIrsDefs({ conjunta: false, dispensaRecibos: true });
    assert.equal(app.fiscoSetSituacao(2026, 'conjunta', true), true);
    const irs = app.db.settings.irs;
    assert.deepEqual(copia(irs.porAno), { 2026: { conjunta: true, conjugeId: '', minhaLetra: 'A', dispensaRecibos: true, bensComuns: false, aimi: { total: null, valorTributavel: null } } });
    assert.equal(irs.conjunta, false, 'o topo não se toca');
    assert.equal(irs.dispensaRecibos, true);
    assert.equal(app.irsSituacao(2025, 'ana').conjunta, false, '2025 fica separada');
    assert.equal(app.irsSituacao(2027, 'ana').conjunta, true, '2027 herda a de 2026');
  });

  test('s14: ligar a conjunta em 2026 com o Rui como cônjuge não refaz a Declaração de 2025', () => {
    const antes = app.resumoFiscal(2025, 'ana');
    assert.deepEqual(copia(antes.linhas.map((l) => l.nome + ' ' + l.titular)), ['Ana A']);
    app.fiscoSetSituacao(2026, 'conjunta', true);
    app.fiscoSetSituacao(2026, 'conjugeId', 'rui');
    const depois = app.resumoFiscal(2025, 'ana');
    assert.deepEqual(copia(depois.linhas.map((l) => l.nome + ' ' + l.titular)), ['Ana A'], 'a de 2025, já entregue, não ganha as linhas do Rui');
    assert.equal(depois.totais.rendas, 9600);
    assert.deepEqual(copia(app.db.settings.irs.titulares), {}, 'nenhuma letra por proprietário');
    const s = app.irsSituacao(2026, 'ana');
    assert.deepEqual([s.conjunta, s.conjugeId, s.minhaLetra, s.letraConjuge], [true, 'rui', 'A', 'B']);
  });

  test('o cartão diz o ano, e cada interruptor grava nesse ano', () => {
    const h = cartao(2025);
    assert.match(h, /<h2 class="ana-tit">A tua situação fiscal em 2025<\/h2>/);
    assert.match(textoDe(h), /^A tua situação fiscal em 2025 Grava ao mexer\./);
    assert.ok(h.includes('id="fiscoConjunta" aria-checked="false" aria-label="Tributação conjunta" data-toca="dados" data-click="fiscoSetSituacao(2025,\'conjunta\',true)"'));
    assert.match(h, /id="fiscoDispensa" aria-checked="false"[^>]*data-click="fiscoSetSituacao\(2025,'dispensaRecibos',true\)"/);
    assert.match(ajuda('situacao', 2025), /Cada ano tem a sua situação, a do último dia do ano \(CIRS art\. 13\.º\): o que mudas aqui vale para 2025 e para os anos seguintes que não tenham a sua, e nunca muda os anteriores\./);
    assert.doesNotMatch(h, /fiscoSetIrs|fiscoSetTitular|style=|onclick=/);
  });

  test('a primeira escrita copia o ano anterior mais perto, sem o AIMI; a seguinte não volta a copiar', () => {
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2024: { conjunta: true, conjugeId: 'rui', minhaLetra: 'B', dispensaRecibos: true, aimi: { total: 100, valorTributavel: 200 } } } });
    assert.match(textoDe(cartao(2026)), /A situação de 2026 vem de 2024: o que mudares aqui vale a partir de 2026\./);
    app.fiscoSetSituacao(2026, 'dispensaRecibos', false);
    assert.deepEqual(copia(app.db.settings.irs.porAno[2026]), { conjunta: true, conjugeId: 'rui', minhaLetra: 'B', dispensaRecibos: false, bensComuns: false, aimi: { total: null, valorTributavel: null } });
    app.db.settings.irs.porAno[2024].conjunta = false;
    app.fiscoSetSituacao(2026, 'minhaLetra', 'A');
    assert.equal(app.db.settings.irs.porAno[2026].conjunta, true, 'já tem a sua: não se copia outra vez');
    assert.doesNotMatch(textoDe(cartao(2026)), /vem de/);
  });

  test('o que não é um campo da situação, um ano sem quatro dígitos ou um cônjuge que não pode ser, não grava', () => {
    const nada = [[2026, 'outraCoisa', true], ['26', 'conjunta', true], [null, 'conjunta', true], [2026, 'conjugeId', 'ana'],
      [2026, 'conjugeId', 'ninguem'], [2026, 'conjugeId', '__proto__'], [2026, 'minhaLetra', 'C'], [2026, 'aimi', 5], [2026, 'aimi', null]];
    for (const [a, c, v] of nada) assert.equal(app.fiscoSetSituacao(a, c, v), false, JSON.stringify([a, c, v]));
    assert.deepEqual(copia(app.db.settings.irs.porAno), {});
    assert.equal(app.db.settings.irs.outraCoisa, undefined);
  });

  test('o AIMI da demonstração: só as chaves que vêm mudam, ao cêntimo; nunca se herda; o redesenho espera o foco', () => {
    let pintou = 0;
    app.render = () => { pintou++; };
    assert.equal(app.fiscoSetSituacao(2025, 'aimi', { total: '312.456', valorTributavel: 650000 }), true);
    assert.equal(pintou, 0, 'vem do change de um campo: o redesenho é depois');
    assert.deepEqual(copia(app.irsSituacao(2025, 'ana').aimi), { total: 312.46, valorTributavel: 650000 });
    app.fiscoSetSituacao(2025, 'aimi', { valorTributavel: '' });
    assert.deepEqual(copia(app.irsSituacao(2025, 'ana').aimi), { total: 312.46, valorTributavel: null });
    assert.deepEqual(copia(app.irsSituacao(2026, 'ana').aimi), { total: null, valorTributavel: null }, 'a liquidação de um ano não é a do seguinte');
  });
});

describe('D30: o cônjuge escolhe-se; a letra é a posição no Rosto', () => {
  beforeEach(() => {
    montaAnaERui();
    app.db.owners.push(app.normPerson({ id: 'carla', name: 'Carla' }));
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2025: { conjunta: true } } });
  });

  test('com a conjunta: a lista dos proprietários sem mim (os com rendas no ano primeiro) e o A/B da minha letra', () => {
    const h = cartao(2025);
    assert.match(h, /<label class="fis-sit-nota fis-sit-campo">O teu cônjuge<div class="sel" id="sel_fiscoConjuge">/);
    const opcoes = [...h.matchAll(/role="option"[^>]*>\s*<span>([^<]*)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(opcoes, ['Ninguém escolhido', 'Rui', 'Carla']);
    assert.match(h, /<input type="hidden" id="fiscoSitAno" value="2025">/);
    assert.match(h, /<div class="segm fis-ab" role="group" id="fiscoMinhaLetra" aria-label="A tua letra no Rosto">/);
    assert.ok(h.includes('<button type="button" class="on" aria-pressed="true" data-toca="dados" data-click="fiscoSetSituacao(2025,\'minhaLetra\',\'A\')">A</button>'));
    assert.ok(h.includes('data-click="fiscoSetSituacao(2025,\'minhaLetra\',\'B\')">B</button>'));
    const t = textoDe(h) + ' ' + ajuda('letra', 2025);
    assert.match(h, /data-click="fisExplicar\('letra',2025\)"/, 'o «?» da letra');
    assert.match(t, /A e B são a posição de cada um no Rosto da declaração: sujeito passivo A e sujeito passivo B\. A letra não muda as rendas que entram/);
    assert.doesNotMatch(t, /Marca o cônjuge como B|Titular de cada proprietário/);
    assert.doesNotMatch(h, /fiscoTit_/);
    assert.doesNotMatch(t, /\b(pôr|tirar|põe|tira|põem)\b/i);
  });

  test('eu sou B e o Rui é o cônjuge: ele fica com A, escolhido pela lista', () => {
    app.fiscoSetSituacao(2025, 'minhaLetra', 'B');
    app.document.getElementById('fiscoConjuge').value = 'rui';
    app.document.getElementById('fiscoSitAno').value = '2025';
    app.fiscoSetConjuge();
    const s = app.irsSituacao(2025, 'ana');
    assert.deepEqual([s.conjunta, s.conjugeId, s.minhaLetra, s.letraConjuge], [true, 'rui', 'B', 'A']);
    const h = cartao(2025);
    assert.match(textoDe(h), /A tua letra no Rosto ?Rui fica com a A/);
    assert.match(h, /<span id="lab_fiscoConjuge">Rui<\/span>/);
    // e desfaz-se: «Ninguém escolhido»
    app.document.getElementById('fiscoConjuge').value = '';
    app.fiscoSetConjuge();
    assert.equal(app.irsSituacao(2025, 'ana').conjugeId, '');
  });

  test('quem declara, no texto e no PDF: a letra de cada um é a das linhas (a do Rosto)', () => {
    const r = { ano: 2025, porInteiro: false, titularId: 'ana', titulares: ['ana', 'rui'],
      linhas: [{ titularId: 'rui', titular: 'A' }, { titularId: 'ana', titular: 'B' }] };
    assert.equal(app.fiscoQuemDeclara(r), 'Ana (B) e Rui (A)');
  });

  test('a página com a conjunta ligada e sem cônjuge diz que entram só as minhas rendas', () => {
    app.fiscoAno = '2025';
    assert.match(textoDe(app.vFisco()), /A tributação conjunta de 2025 está ligada sem cônjuge escolhido: entram só as tuas rendas\./);
    app.fiscoAno = '';
  });
});

describe('D31 e D70: as notas da conjunta', () => {
  beforeEach(() => {
    montaAnaERui();
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2025: { conjunta: true } } });
  });

  test('com cônjuge: só entram os imóveis dele que estão nesta app; sem cônjuge: só as minhas rendas', () => {
    let t = textoDe(cartao(2025));
    assert.match(t, /Sem cônjuge escolhido, entram só as tuas rendas\./, 'o caso de agora, à vista');
    assert.match(ajuda('conjuge', 2025), /Sem cônjuge escolhido, a Declaração tem só as tuas rendas\./);
    assert.doesNotMatch(t, /Entram só os imóveis do cônjuge/);
    app.fiscoSetSituacao(2025, 'conjugeId', 'rui');
    t = textoDe(cartao(2025));
    assert.match(ajuda('conjuge', 2025), /Entram só os imóveis do cônjuge que vês nesta app, os partilhados contigo\. Os que estão só na conta do cônjuge não chegam aqui: junta-os no Portal das Finanças, a partir do PDF ou da folha de cálculo da Declaração dessa conta\./);
    assert.doesNotMatch(t, /Sem cônjuge escolhido/);
  });

  test('sem outro proprietário, diz que não há quem escolher; sem saber quem sou, também', () => {
    app.db.owners = app.db.owners.filter((o) => o.id === 'ana');
    assert.match(textoDe(cartao(2025)), /Não há outro proprietário nesta app para escolher como cônjuge/);
    const t = textoDe(cartao(2025, { porInteiro: true, titularId: '' }));
    assert.match(t, /Sem saber qual dos proprietários és, não há cônjuge a escolher/);
    assert.doesNotMatch(t, /O teu cônjuge/);
  });

  /* N063 (D8): a letra F do óbito só com a conjunta; a dos dependentes vale em conjunta e em
     separado, e fica à parte */
  test('a nota das letras: a F só com a conjunta, as D1/AF1/DG1 com e sem ela', () => {
    for (const conj of [true, false]) {
      app.db.settings.irs = app.normIrsDefs({ porAno: { 2025: { conjunta: conj } } });
      const t = ajuda('conjunta', 2025);
      assert.match(t, /D1, AF1 ou DG1/);
      assert.match(t, /A app só escreve A e B: essa letra muda-se no Portal das Finanças\./);
      if (conj) assert.match(t, /levam a letra F/); else assert.doesNotMatch(t, /óbito|letra F/);
    }
  });
});

describe('D111: o limite da dispensa dos recibos', () => {
  beforeEach(montaAnaERui);
  /* um valor em euros como o texto o lê (os espaços do formato juntos num) */
  const eur = (n) => app.euro2(n).replace(/\s+/g, ' ');

  /* a nota de quem tem dispensa está no «?» da dispensa (N063, KAN-127-17) */

  test('em 2026: as rendas de 2025 até 1 045,00 € (duas vezes o IAS de 2025), e não o de 2026', () => {
    const t = ajuda('dispensa', 2026);
    assert.ok(t.includes('Em 2026 tem dispensa quem a 31 de dezembro de 2025 tinha 65 anos ou mais'), t);
    assert.ok(t.includes('recebeu rendas de 2025 até ' + eur(1045) + ' (duas vezes o IAS de 2025)'), t);
    assert.ok(t.includes('o Modelo 44, a declaração anual das rendas de 2026, até ao fim de fevereiro de 2027'), t);
    assert.ok(!t.includes(eur(1074.26)), 'o IAS de 2026 não é o da dispensa de 2026');
  });

  test('em 2027: as rendas de 2026 até 1 074,26 €; sem a versão do ano anterior, sem número', () => {
    assert.ok(ajuda('dispensa', 2027).includes('recebeu rendas de 2026 até ' + eur(1074.26) + ' (duas vezes o IAS de 2026)'));
    const t = ajuda('dispensa', 2025);
    assert.ok(t.includes('recebeu rendas de 2024 até duas vezes o IAS de 2024 —'), t);
    assert.ok(!t.includes(eur(1074.26)) && !t.includes(eur(1045)));
  });
});

/* O cartão de um KPI, pelo rótulo: o valor, as linhas de rodapé e a explicação.
   Recebe: html — a grelha; rotulo — o rótulo do cartão.
   Devolve: {valor, pes:[HTML], expl}. */
function kpiDe(html, rotulo) {
  const i = html.indexOf('<div class="label">' + rotulo + '</div>');
  assert.ok(i > -1, 'há o cartão ' + rotulo);
  const fim = html.indexOf('<div class="card kpi', i);
  const h = html.slice(i, fim > -1 ? fim : undefined);
  return {
    valor: (/<div class="value [^"]*">(.*?)<\/div>/.exec(h) || [])[1],
    pes: [...h.matchAll(/<div class="foot">(.*?)<\/div>/g)].map((m) => m[1]),
    expl: (/<div class="expl">([\s\S]*?)<\/div>/.exec(h) || [])[1] || '',
  };
}

/* Um resumo feito à mão com a forma do contrato (o plano §1.4 e o rev6 §6.1).
   Recebe: totais — o que muda nos totais; extra — o que muda no resumo.
   Devolve: o resumo. */
function resumoFeito(totais, extra) {
  const cols = ['conservacao', 'condominio', 'imi', 'selo', 'taxas', 'outros'];
  const gastos = {}; cols.forEach((k) => { gastos[k] = 0; });
  return Object.assign({
    ano: 2026, versao: app.irsAno(2026), colunas: cols, titularId: 'ana', titulares: ['ana'], porInteiro: false, variosTitulares: false,
    linhas: [{ contratoId: 'C1', titularId: 'ana', titular: 'A' }], aimi: null,
    totais: Object.assign({ rendas: 28800, retencoes: 0, gastos, obras24: 0, liquido: 28800, imposto: 7200, prejuizo: 0, anosAnteriores: 0,
      isentos: { n: 0, rendas: 0, liquido: 0 } }, totais),
  }, extra);
}

/* a linha das taxas do continente, à vista no imposto (N120) */
const AC = 'taxas do continente; nos Açores a AT aplica menos 30 %';

describe('D73: o KPI do imposto com os prejuízos de anos anteriores', () => {
  beforeEach(() => { limpar(app); app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' })); });

  // o cenário d73-d97: 2025 com prejuízo de 5 400 €, 2026 com 28 800 € de líquido a 25 % e 600 € retidos
  const reporte = { porTitular: { ana: { anos: [{ ano: 2025, prejuizo: 5400, usado: 5400 }], usado: 5400, resto: 0, imposto: 1350 } },
    usado: 5400, imposto: 1350, anosSemDados: [] };

  test('o imposto é o depois do reporte (5 850 €, e não 7 200 €), com a linha do prejuízo, e a falta conta com ele', () => {
    const k = kpiDe(app.fiscoKpis(resumoFeito({ imposto: 7200, impostoDepoisDoReporte: 5850, retencoes: 600 }, { reporte })), 'Imposto estimado');
    assert.equal(k.valor, app.euro(5850));
    /* N123: o que abateu é ao rendimento, e diz-se quanto desce o imposto; as taxas do continente no fim (N120) */
    assert.deepEqual(k.pes, ['depois dos prejuízos de anos anteriores: −' + app.euro(5400) + ' ao rendimento (−' + app.euro(1350) + ' de imposto)',
      'já retido ' + app.euro(600) + ' · falta ' + app.euro(5250), AC]);
    assert.match(k.expl, /O imposto estimado das linhas é 7\s200\s€; os prejuízos de anos anteriores que a app conhece \(5\s400\s€\) abatem ao rendimento deste ano, o mais antigo primeiro e titular a titular \(CIRS art\. 55\.º\): o imposto desce 1\s350\s€, e depois dos prejuízos de anos anteriores fica em 5\s850\s€/);
    assert.match(k.expl, /Pode faltar informação — imóveis fora da app, anos sem registos, a condição dos 36 meses de rendas nos cinco anos seguintes —, e a AT faz a conta na liquidação\./);
  });

  test('em conjunta, o prejuízo que abateu é de cada titular, pela letra', () => {
    const dois = { porTitular: { bruno: { usado: 400, imposto: 100 }, ana: { usado: 1000, imposto: 250 } }, usado: 1400, imposto: 350, anosSemDados: [] };
    const extra = { titulares: ['ana', 'bruno'], variosTitulares: true,
      linhas: [{ contratoId: 'C1', titularId: 'ana', titular: 'A' }, { contratoId: 'C2', titularId: 'bruno', titular: 'B' }] };
    let k = kpiDe(app.fiscoKpis(resumoFeito({ impostoDepoisDoReporte: 6850 }, Object.assign({ reporte: dois }, extra))), 'Imposto estimado');
    assert.equal(k.pes[0], 'depois dos prejuízos de anos anteriores: A −' + app.euro(1000) + ' · B −' + app.euro(400) + ' ao rendimento (−' + app.euro(350) + ' de imposto)');
    const um = { porTitular: { bruno: { usado: 400, imposto: 100 }, ana: { usado: 0, imposto: 0 } }, usado: 400, imposto: 100, anosSemDados: [] };
    k = kpiDe(app.fiscoKpis(resumoFeito({ impostoDepoisDoReporte: 7100 }, Object.assign({ reporte: um }, extra))), 'Imposto estimado');
    assert.equal(k.pes[0], 'depois dos prejuízos de anos anteriores do titular B: −' + app.euro(400) + ' ao rendimento (−' + app.euro(100) + ' de imposto)');
  });

  test('um resumo sem o impostoDepoisDoReporte abate o r.reporte.imposto; sem reporte, nada muda', () => {
    let k = kpiDe(app.fiscoKpis(resumoFeito({ imposto: 7200 }, { reporte })), 'Imposto estimado');
    assert.equal(k.valor, app.euro(5850));
    k = kpiDe(app.fiscoKpis(resumoFeito({ imposto: 7200 })), 'Imposto estimado');
    assert.equal(k.valor, app.euro(7200));
    assert.deepEqual(k.pes, ['sem englobamento', AC]);
    assert.doesNotMatch(k.expl, /anos anteriores/);
    k = kpiDe(app.fiscoKpis(resumoFeito({ imposto: 7200, impostoDepoisDoReporte: 7200 }, { reporte: { porTitular: {}, usado: 0, imposto: 0, anosSemDados: [2023] } })), 'Imposto estimado');
    assert.deepEqual(k.pes, ['sem englobamento', AC], 'sem nada a abater, sem linha');
    assert.match(k.expl, /Prejuízos de anos que não estão na app \(de 2023\) não entram nesta estimativa/, 'só no porquê (N124)');
  });

  test('o abate do AIMI nunca passa do imposto depois do reporte', () => {
    const aimi = { total: 1000, n: 1, predios: [], vptArrendados: 0, vptTotal: 0, semVpt: [], parte: 800, abate: 800 };
    const k = kpiDe(app.fiscoKpis(resumoFeito({ imposto: 3000, impostoDepoisDoReporte: 500, retencoes: 100 },
      { aimi, reporte: { porTitular: { ana: { usado: 10000, imposto: 2500 } }, usado: 10000, imposto: 2500, anosSemDados: [] } })), 'Imposto estimado');
    assert.equal(k.valor, app.euro(500));
    assert.deepEqual(k.pes, ['depois dos prejuízos de anos anteriores: −' + app.euro(10000) + ' ao rendimento (−' + app.euro(2500) + ' de imposto)', 'depois do AIMI: ~' + app.euro(0) + ' (estimativa)',
      'já retido ' + app.euro(100) + ' · a receber ' + app.euro(100), AC]);
  });
});

describe('D10: a regularização do quadro 10 soma-se à parte', () => {
  beforeEach(() => { limpar(app); });

  test('uma linha com o imposto e a regularização, «estimativa sem juros», e a falta conta com ela', () => {
    const k = kpiDe(app.fiscoKpis(resumoFeito({ imposto: 3000, impostoDepoisDoReporte: 3000, regularizacao: 900, retencoes: 500 })), 'Imposto estimado');
    assert.equal(k.valor, app.euro(3000), 'o número principal é o do ano');
    assert.deepEqual(k.pes, ['com a regularização do quadro 10: ~' + app.euro(3900) + ' (+' + app.euro(900) + ', estimativa sem juros)',
      'já retido ' + app.euro(500) + ' · falta ' + app.euro(3400), AC]);
    assert.match(k.expl, /regulariza-se nesta declaração, com juros compensatórios \(CIRS art\. 72\.º\)\. A app soma a diferença à parte, sem os juros, e a falta a pagar já a conta\./);
  });

  test('sem o totais.regularizacao, a soma das r.regularizacoes; sem nenhuma, nada', () => {
    let k = kpiDe(app.fiscoKpis(resumoFeito({ imposto: 3000 }, { regularizacoes: [{ contratoId: 'C1', nome: 'X', anos: [], total: 250.5 }, { total: 100 }] })), 'Imposto estimado');
    assert.equal(k.pes[0], 'com a regularização do quadro 10: ~' + app.euro(3350.5) + ' (+' + app.euro(350.5) + ', estimativa sem juros)');
    k = kpiDe(app.fiscoKpis(resumoFeito({ imposto: 3000, regularizacao: 0 }, { regularizacoes: [] })), 'Imposto estimado');
    assert.deepEqual(k.pes, ['sem englobamento', AC]);
    assert.doesNotMatch(k.expl, /regulariza/);
  });
});

describe('os prazos da AT na página (os itens novos do prazos.js)', () => {
  beforeEach(() => { limpar(app); assert.equal(app.sabemosOEstado(), true, 'sem sessão, o estado é o do aparelho'); });

  const elementos = { chave: 'elementos:C1', tipo: 'elementos', semData: true, alvo: '2026-11-17', dias: 0, urg: 'info',
    titulo: 'Registar o contrato no Portal das Finanças — Arroios', sub: 'Começou antes de 1 de abril de 2015.', abrir: "ctView('C1')" };
  const fev15 = { chave: 'fev15:C1:2027-02-15', tipo: 'fev15', alvo: '2027-02-15', dias: 20, urg: 'breve', evento: 'inicio',
    titulo: 'Comunicar a duração do contrato à AT — Benfica', sub: 'Comunica-se uma vez.', abrir: "ctView('C2')",
    acao: "pzComunicadaPergunta('C2','2026')", acaoTexto: 'Marcar como comunicada' };

  test('o registo dos elementos mínimos entra, sem data: «Sem prazo», a cinzento, e não «Hoje»', () => {
    app.prazosAtivos = () => [elementos];
    const h = app.fisPrazosCard();
    assert.match(h, /Registar o contrato no Portal das Finanças — Arroios/);
    assert.match(h, /<span class="badge grey">Sem prazo<\/span>/);
    assert.doesNotMatch(h, />Hoje</);
  });

  test('um prazo com «feito» leva o botão dele e o que abre a ficha, sem ficar dentro de uma linha que se toca', () => {
    app.prazosAtivos = () => [fev15];
    const h = app.fisPrazosCard();
    const i = h.search(/<div class="fis-pz[ "]/);
    assert.ok(i > -1, h);
    const linha = h.slice(i, h.indexOf('</section>', i));
    assert.match(linha, /^<div class="fis-pz">/, 'a linha não se toca inteira (um toque no botão corria também o dela)');
    assert.ok(linha.includes('<button type="button" class="btn sm primary" data-toca="camada" aria-label="Marcar como comunicada: Comunicar a duração do contrato à AT — Benfica" data-click="pzComunicadaPergunta(\'C2\',\'2026\')">Marcar como comunicada</button>'));
    assert.ok(linha.includes('<button type="button" class="btn sm" data-toca="camada" data-click="ctView(\'C2\')">Abrir contrato</button>'));
    assert.match(linha, /<span class="badge amber">Faltam 20 dias<\/span>/);
  });

  test('sem «feito», a linha continua a abrir a ficha num toque', () => {
    app.prazosAtivos = () => [Object.assign({}, fev15, { acao: undefined, acaoTexto: undefined })];
    assert.match(app.fisPrazosCard(), /<div class="fis-pz tap" data-toca="camada" data-click="ctView\('C2'\)">/);
  });
});

describe('o cartão cabe num telemóvel, com alvos de 44 px no toque', () => {
  test('o A/B, a lista do cônjuge e os botões dos prazos usam os componentes com a medida do dedo', () => {
    const css = fs.readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
    assert.match(css, /\.fis-ab>button\{flex:0 0 44px;width:44px\}/, 'cada letra tem 44 px de largura');
    assert.match(css, /@media\(pointer:coarse\)\{\s*\.fis-ab>button,\.ana \.btn\.sm\{min-height:44px\}/, 'e 44 de altura no dedo, como os botões pequenos da página');
    assert.match(css, /\.selbtn\{[^}]*min-height:46px/, 'a lista do cônjuge é um sel()');
    assert.match(css, /\.fis-linha-txt\{flex:1;min-width:0;margin:0\}/, 'o texto encolhe ao lado do A/B, sem rolar de lado');
  });
});

describe('os botões de «A tratar» dizem o que fazem', () => {
  test('o envio ao IHRU marca-se no próprio aviso, e um aviso que leva aos imóveis diz «Ver imóveis»', () => {
    assert.equal(app.fiscoRotuloDoAviso("pzIhruPergunta('c1')"), 'Marcar como enviado');
    assert.equal(app.fiscoRotuloDoAviso("go('properties')"), 'Ver imóveis');
    assert.equal(app.fiscoRotuloDoAviso("ctResponderEmpresa('c1')"), 'Responder', 'o inquilino empresa responde-se no contrato');
    assert.equal(app.fiscoRotuloDoAviso("ctView('c1')"), 'Abrir contrato', 'os de antes ficam');
  });
});
