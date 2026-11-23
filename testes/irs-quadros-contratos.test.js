// Os cartões dos contratos na Declaração (fisco-quadros.js), da auditoria ao IRS
// (KAN-127): o que a pessoa copia do 4.2A, do 4.2B, do quadro 10, dos quadros das
// isenções, do quadro 8 e do quadro 9 tem de ser o que a lei e o impresso pedem.
//   D01  a comunicação da duração é do período, não do ano: o cartão do 4.2 não a diz anual
//   D35  comunicada depois do prazo: «comunicada fora do prazo (a …) — no 4.2A é NÃO», a âmbar;
//        por fazer: «por comunicar · até …»
//   D09  o cartão do quadro 10: regime, n.º, ano de início do benefício, data e motivo
//   D10  o motivo que regulariza (n.º 20): a taxa da duração decorrida e a diferença sem juros
//   D36  o 4.2B mostra-se pelo facto (elegivel24), e diz que a AT pode aplicar os 5 pontos
//   D37  o 4.2B diz que renda usou (Q2: a de hoje)
//   D41  uma renovação a meio do ano: «X % até dd/mm, Y % depois»
//   D15  rendas depois do termo sem renovação registada: a taxa base, e a nota
//   D55  o quadro 8 com as retenções (e os gastos) de cada ano, um movimento por ano
//   D18  os quadros 6F e 6H como o 6D, só com o campo do 4.1
//   D49  as linhas moderadas de um ano provisório: o campo da taxa de 10 % por conhecer, a âmbar
//   D50  sem regras do ano: sem taxa nem imposto estimado
//   D78  o 4.2C cita a portaria da versão, pela data de celebração
//   D71  o cartão do AIMI escreve os dois números da demonstração (9101 e 9102)
// Os campos novos do resumo (l.comunicacao, l.segmentos, l.elegivel24, r.cessados,
// r.regularizacoes, r.semRegrasDoAno, r.aimi.demonstracao…) vêm do resumo da mesma
// vaga: aqui testam-se com um resumo feito à mão com a forma do contrato (o plano, §1.4).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => app.definirServicosDesligados([]));
afterEach(() => repor(app));

/* um movimento normalizado, já na base
   Recebe: extra — os campos do movimento.
   Devolve: o movimento. */
const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1' }, extra));
  app.db.transactions.push(t);
  return t;
};
/* o texto de um bocado de HTML, sem as etiquetas */
const texto = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/* uma cópia JSON (os objetos vêm do contexto da app) */
const j = (x) => JSON.parse(JSON.stringify(x));
/* um valor em euros como o texto() o deixa (os espaços finos passam a espaços) */
const eu = (v) => texto(app.euro2(v));

beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Vera', nif: '123456789' }));
  app.db.properties.push(
    app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }),
    app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['ana'], freguesiaCodigo: '110624', tipoPredio: 'U', matrix: '777' }),
  );
  app.db.contracts.push(
    // sem termo: sem redução pela duração, no 4.1 (em 2026, renda moderada a 10 %)
    app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2024-01-01', active: true,
      fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }),
    // dez anos de prazo: com redução, no 4.2
    app.normContract({ id: 'L1', name: 'Benfica longo', propertyId: 'v2', tenantIds: ['t2'], rent: 600, start: '2024-03-01', end: '2034-02-28', active: true,
      fisco: { estado: 'declarado', numero: '7654321', finalidade: 'hp', celebracao: '2024-03-01' } }),
  );
  for (const ano of [2025, 2026]) {
    for (let i = 1; i <= 12; i++) {
      const m = String(i).padStart(2, '0');
      mov({ kind: 'income', category: 'Rendas', amount: 1000, contractId: 'C1', recibo: true, date: `${ano}-${m}-05` });
      mov({ kind: 'income', category: 'Rendas', amount: 600, contractId: 'L1', propertyId: 'v2', recibo: true, date: `${ano}-${m}-06` });
    }
  }
});

/* O resumo de um ano com as linhas trocadas por cópias, para um teste mudar os
   campos de uma linha à mão (a forma da §1.4 do plano).
   Recebe: ano — o ano; muda (opcional) — chamada com (linha) para cada linha.
   Devolve: o resumo. */
function resumoAMao(ano, muda) {
  const r = app.resumoFiscal(ano, '');
  r.linhas = r.linhas.map((l) => { const c = Object.assign({}, l); if (muda) muda(c); return c; });
  return r;
}
/* a linha de um contrato num resumo */
const linhaDe = (r, id) => r.linhas.find((l) => l.contratoId === id);
/* o valor de um campo do fiscoCamposDe, por grupo e rótulo */
const campo = (cs, grupo, nome) => cs.find((c) => c.grupo === grupo && c.campo === nome);

describe('D01 · D35 · a comunicação do 4.2A é do período', () => {
  test('comunicada a tempo: «comunicada a …», sem selo, com o período a que respeita', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'L1') Object.assign(l, { comunicado: '2025-02-10',
      comunicacao: { periodoInicio: '2024-03-01', chave: '2024', prazo: '2025-02-15', data: '2025-02-10', foraDePrazo: false } }); });
    const c = campo(app.fiscoCamposDe(r, linhaDe(r, 'L1')), 'Quadro 4.2A', 'Comunicação');
    assert.equal(c.valor, 'comunicada a 10/02/2025');
    assert.equal(c.aviso, false);
    assert.match(c.sub, /01\/03\/2024/, 'diz de que período é');
  });

  test('comunicada depois de 15 de fevereiro: «fora do prazo» e «no 4.2A é NÃO», a âmbar', () => {
    const r = resumoAMao(2025, (l) => { if (l.contratoId === 'L1') Object.assign(l, { comunicado: '2025-03-01',
      comunicacao: { periodoInicio: '2024-03-01', chave: '2024', prazo: '2025-02-15', data: '2025-03-01', foraDePrazo: true } }); });
    const c = campo(app.fiscoCamposDe(r, linhaDe(r, 'L1')), 'Quadro 4.2A', 'Comunicação');
    assert.equal(c.valor, 'comunicada fora do prazo (a 01/03/2025) — no 4.2A é NÃO');
    assert.equal(c.aviso, true);
    const card = texto(app.fiscoQuadroCard(r, '4.2'));
    assert.match(card, /1 contrato comunicado fora do prazo/);
  });

  test('por comunicar com o prazo à frente: «por comunicar · até …»', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'L1') Object.assign(l, { comunicado: '',
      comunicacao: { periodoInicio: '2026-03-01', chave: '2026', prazo: '2027-02-15', data: '', foraDePrazo: false } }); });
    const c = campo(app.fiscoCamposDe(r, linhaDe(r, 'L1')), 'Quadro 4.2A', 'Comunicação');
    assert.equal(c.valor, 'por comunicar · até 15/02/2027');
    assert.equal(c.aviso, true);
  });

  test('por comunicar com o prazo passado: no 4.2A é NÃO', () => {
    const r = resumoAMao(2025, (l) => { if (l.contratoId === 'L1') Object.assign(l, { comunicado: '',
      comunicacao: { periodoInicio: '2024-03-01', chave: '2024', prazo: '2025-02-15', data: '', foraDePrazo: false } }); });
    const c = campo(app.fiscoCamposDe(r, linhaDe(r, 'L1')), 'Quadro 4.2A', 'Comunicação');
    assert.equal(c.valor, 'por comunicar · o prazo acabou a 15/02/2025 — no 4.2A é NÃO');
    assert.equal(c.aviso, true);
  });

  test('o cartão do 4.2 diz que se comunica uma vez por período, e não um prazo do ano', () => {
    const r = resumoAMao(2026);
    const card = texto(app.fiscoQuadroCard(r, '4.2'));
    assert.match(card, /uma vez por período/);
    assert.match(card, /ano seguinte ao início do contrato ou de cada renovação/);
    assert.doesNotMatch(card, /comunicadas no Portal até \d\d\/\d\d\/\d{4}/, 'sem o 15 de fevereiro do ano dos rendimentos');
  });

  test('de ponta a ponta: a comunicação de 2025 do período de 2024 vale em 2026', () => {
    const L1 = app.db.contracts.find((c) => c.id === 'L1');
    L1.fisco = app.normFisco(Object.assign({}, L1.fisco, { comunicacoes: { 2024: '2025-02-10' } }));
    const r = app.resumoFiscal(2026, '');
    assert.equal(campo(app.fiscoCamposDe(r, linhaDe(r, 'L1')), 'Quadro 4.2A', 'Comunicação').valor, 'comunicada a 10/02/2025');
  });
});

describe('D09 · D10 · o quadro 10', () => {
  beforeEach(() => {
    app.db.contracts.push(app.normContract({ id: 'X1', name: 'Benfica que acabou', propertyId: 'v2', tenantIds: ['t2'], rent: 600, start: '2024-03-01', end: '2029-02-28', active: false,
      fisco: { estado: 'declarado', numero: '5550001', finalidade: 'hp', cessacao: { data: '2026-04-30', motivo: '01' } } }));
  });
  /* o resumo de 2026 com um contrato cessado e a regularização, à mão */
  const comCessado = (motivo, extra) => {
    const r = resumoAMao(2026);
    r.cessados = [Object.assign({ contratoId: 'X1', nome: 'Benfica que acabou', imovel: 'T1 Benfica', regime: '02', numero: '5550001',
      anoInicioBeneficio: 2024, data: '2026-04-30', motivo: motivo }, extra || {})];
    r.regularizacoes = motivo === '01' ? [{ contratoId: 'X1', nome: 'Benfica que acabou', anos: [{ ano: 2024, diferenca: 300 }, { ano: 2025, diferenca: 600 }], total: 900 }] : [];
    r.totais = Object.assign({}, r.totais, { regularizacao: motivo === '01' ? 900 : 0 });
    return r;
  };

  test('o cartão: regime, n.º, ano de início do benefício, data e motivo, com os textos da versão', () => {
    const h = app.fiscoQuadro10Card(comCessado('03'));
    const t = texto(h);
    assert.match(t, /Quadro 10 · contratos que acabaram/);
    assert.match(t, /Regime fiscal 02 · Artigo 72\.º, n\.º 3, do Código do IRS/);
    assert.match(t, /N\.º do contrato 5550001/);
    assert.match(t, /Ano de início do benefício 2024/);
    assert.match(t, /Data da cessação 30\/04\/2026/);
    assert.match(t, /Motivo 03 · Acabou no fim do prazo ou de uma renovação/);
    assert.doesNotMatch(t, /n\.º 20/, 'sem regularização fora do motivo 01');
    assert.match(h, /data-click="ctView\('X1'\)"/, 'tocar abre o contrato');
  });

  test('os códigos e os textos vêm da versão do ano, não do código', () => {
    const r = comCessado('03');
    r.versao = Object.assign({}, r.versao, { quadro10: { regimes: [{ codigo: '02', texto: 'Regime de teste', n: 3 }],
      motivos: [{ codigo: '03', curto: 'Motivo de teste', texto: 'x', para: 'reducao', quem: 'fim' }] } });
    const t = texto(app.fiscoQuadro10Card(r));
    assert.match(t, /Regime fiscal 02 · Regime de teste/);
    assert.match(t, /Motivo 03 · Motivo de teste/);
  });

  test('sem motivo nem n.º: a falta, com o caminho', () => {
    const t = texto(app.fiscoQuadro10Card(comCessado('', { numero: '' })));
    assert.match(t, /Motivo falta/);
    assert.match(t, /N\.º do contrato falta/);
  });

  test('o motivo 01: a redução do período perde-se, a taxa da duração decorrida e a diferença sem juros', () => {
    const t = texto(app.fiscoQuadro10Card(comCessado('01')));
    assert.match(t, /Motivo 01 · Acabou antes do prazo, por motivo do senhorio/);
    assert.match(t, /n\.º 20/);
    assert.match(t, /juros compensatórios/);
    assert.ok(t.includes('estimativa sem juros: ' + eu(900)), 'a diferença estimada');
    assert.ok(t.includes('2024: ' + eu(300)) && t.includes('2025: ' + eu(600)), 'ano a ano');
    assert.match(t, /duração que o contrato durou/);
  });

  test('sem contratos cessados, ou um resumo antigo, não há cartão', () => {
    const r = resumoAMao(2026);
    delete r.cessados;
    assert.equal(app.fiscoQuadro10Card(r), '');
    r.cessados = [];
    assert.equal(app.fiscoQuadro10Card(r), '');
  });

  test('sem regras do ano: a diferença não se estima', () => {
    const r = comCessado('01');
    r.semRegrasDoAno = true;
    const t = texto(app.fiscoQuadro10Card(r));
    assert.ok(!t.includes(eu(900)), 'sem o valor');
  });
});

describe('D36 · D37 · o 4.2B', () => {
  test('pelo facto (elegivel24), mesmo quando a taxa não desceu: os campos e «a AT pode aplicar os 5 pontos»', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'L1') Object.assign(l, { elegivel24: true, bonus: false, rendaAnterior: 700,
      contratoAnterior: { id: 'X', nome: 'Antes', numero: '999' } }); });
    const l = linhaDe(r, 'L1'), cs = app.fiscoCamposDe(r, l);
    assert.ok(campo(cs, 'Quadro 4.2B', 'Renda deste contrato'), 'o 4.2B aparece');
    assert.match(campo(cs, 'Quadro 4.2B', 'Renda deste contrato').sub, /de hoje/, 'diz que renda usou');
    assert.equal(campo(cs, 'Quadro 4.2B', 'N.º do contrato anterior').valor, '999');
    const h = texto(app.fiscoReducoesHtml(r, [l]));
    assert.match(h, /Quadro 4\.2B/);
    assert.match(h, /a AT pode aplicar os 5 pontos/);
  });

  test('sem o facto, não há 4.2B', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'L1') Object.assign(l, { elegivel24: false, bonus: false }); });
    const l = linhaDe(r, 'L1');
    assert.equal(campo(app.fiscoCamposDe(r, l), 'Quadro 4.2B', 'Renda deste contrato'), undefined);
    assert.doesNotMatch(app.fiscoReducoesHtml(r, [l]), /4\.2B/);
  });
});

describe('D41 · D15 · a taxa por período', () => {
  const seg = (de, ate, taxa, o) => Object.assign({ de, ate, taxa, motivo: 'duracao', reducao: true, semRenovacao: false, rendas: 600, imposto: 0 }, o || {});

  test('uma renovação a meio do ano: «15 % até 28/02, 10 % depois», no resumo e no cartão', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'L1') l.segmentos = [seg('2026-01-01', '2026-02-28', 15, { rendas: 1200 }), seg('2026-03-01', '2026-12-31', 10, { rendas: 6000 })]; });
    const card = app.fiscoQuadroCard(r, '4.2');
    assert.match(texto(card), /15 % até 28\/02, 10 % depois/);
    assert.match(texto(app.fiscoContratoHtml(r, linhaDe(r, 'L1'))), /15 % até 28\/02, 10 % depois/);
  });

  test('rendas depois do termo sem renovação registada: a taxa base, e a nota', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'L1') l.segmentos = [seg('2026-01-01', '2026-02-28', 10, { rendas: 1200 }),
      seg('2026-03-01', '2026-12-31', 25, { motivo: 'semRenovacao', reducao: false, semRenovacao: true, rendas: 6000 })]; });
    const t = texto(app.fiscoContratoHtml(r, linhaDe(r, 'L1')));
    assert.match(t, /10 % até 28\/02, 25 % depois do termo, sem renovação registada/);
    assert.match(t, /Rendas depois do termo \(28\/02\/2026\) sem renovação registada/);
  });

  test('um contrato curto sem redução que continua depois do termo: a mesma taxa, sem frase nem nota', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'C1') l.segmentos = [seg('2026-01-01', '2026-03-31', 25, { motivo: 'base', reducao: false, rendas: 3000 }),
      seg('2026-04-01', '2026-12-31', 25, { motivo: 'semRenovacao', reducao: false, semRenovacao: true, rendas: 9000 })]; });
    const t = texto(app.fiscoContratoHtml(r, linhaDe(r, 'C1')));
    assert.doesNotMatch(t, /depois do termo/);
    assert.match(t, /taxa \d+ % · /, 'a taxa da linha, só');
  });

  test('o ano da cessação com o n.º 20: a taxa que tinha', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'L1') l.segmentos = [seg('2026-01-01', '2026-04-30', 25, { regulariza: true, taxaAntes: 10, rendas: 2400 })]; });
    assert.match(texto(app.fiscoContratoHtml(r, linhaDe(r, 'L1'))), /taxa 25 % \(era 10 %, n\.º 20\)/);
  });

  test('um só período: sem a frase', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'L1') l.segmentos = [seg('2026-01-01', '2026-12-31', 10)]; });
    assert.doesNotMatch(texto(app.fiscoQuadroCard(r, '4.2')), / até \d\d\/\d\d, /);
  });
});

describe('D55 · o quadro 8 com as retenções e os gastos de cada ano', () => {
  test('cada ano com as retenções (e os gastos, quando o resumo os dá), e um movimento por ano', () => {
    const r = resumoAMao(2026, (l) => { if (l.contratoId === 'C1') l.anosAnteriores = [{ ano: 2024, valor: 2000, retencoes: 500 }, { ano: 2023, valor: 1000, retencoes: 0, gastos: 120 }]; });
    const t = texto(app.fiscoAnosAnterioresCard(r));
    assert.ok(t.includes('respeitam a 2024 · retenções ' + eu(500)), 'as retenções de 2024');
    assert.ok(t.includes('gastos ' + eu(120)), 'os gastos de 2023');
    assert.match(t, /um movimento por ano/);
    assert.match(t, /retenções na fonte e os gastos/);
  });
});

describe('D18 · os quadros 6F e 6H', () => {
  test('cada isenção no seu quadro, com o campo do 4.1 e sem código', () => {
    const r = resumoAMao(2026, (l) => {
      if (l.contratoId === 'C1') Object.assign(l, { campo: '4001', quadro: '4.1', isencao: { id: 'al', nome: 'Ex-alojamento local passado a arrendamento', curto: 'ex-alojamento local', quadro: '6F', codigo: '' } });
      if (l.contratoId === 'L1') Object.assign(l, { campo: '4002', quadro: '4.1', isencao: { id: 'prerau', nome: 'Renda antiga', curto: 'renda antiga', quadro: '6H', codigo: '' } });
    });
    const t = texto(app.fiscoIsentosCard(r));
    assert.match(t, /Quadro 6F/);
    assert.match(t, /Quadro 6H/);
    assert.doesNotMatch(t, /Quadro 6D/, 'nenhum dos dois vai ao 6D');
    assert.match(t, /campo 4001 do 4\.1/);
    assert.match(t, /campo 4002 do 4\.1/);
    assert.doesNotMatch(t, /código por conhecer/, 'o 6F e o 6H não têm código');
    assert.match(t, /EBF art\. 74\.º-A/);
    assert.match(t, /EBF art\. 46\.º-A/);
  });

  test('o 6D continua com os códigos, lidos da versão', () => {
    const r = resumoAMao(2025, (l) => { if (l.contratoId === 'C1') Object.assign(l, { campo: '4001', isencao: { id: 'paa', nome: 'PAA', curto: 'PAA', quadro: '6D', codigo: '01' } }); });
    const t = texto(app.fiscoIsentosCard(r));
    assert.match(t, /Quadro 6D/);
    assert.match(t, /01 Programa de Apoio ao Arrendamento \(PAA\)/);
  });
});

describe('D49 · a taxa de 10 % num ano de regras provisórias', () => {
  test('2026 (modelo por aprovar): a linha moderada leva o campo por conhecer, a âmbar', () => {
    const r = app.resumoFiscal(2026, '');
    const l = linhaDe(r, 'C1');
    assert.equal(l.motivoTaxa, 'moderada', 'controlo: 1 000 € sem termo em 2026');
    const c = campo(app.fiscoCamposDe(r, l), '', 'Taxa de 10 % (EBF 45.º-C)');
    assert.ok(c, 'o campo está lá');
    assert.equal(c.valor, 'campo do modelo novo por conhecer');
    assert.equal(c.aviso, true);
  });

  test('com o modelo oficial, ou fora das moderadas, não', () => {
    const r = app.resumoFiscal(2026, '');
    r.versao = Object.assign({}, r.versao, { modelo: { oficial: true, texto: '' } });
    assert.equal(campo(app.fiscoCamposDe(r, linhaDe(r, 'C1')), '', 'Taxa de 10 % (EBF 45.º-C)'), undefined);
    const r25 = app.resumoFiscal(2025, '');
    assert.equal(campo(app.fiscoCamposDe(r25, linhaDe(r25, 'C1')), '', 'Taxa de 10 % (EBF 45.º-C)'), undefined);
  });
});

describe('D50 · sem regras do ano', () => {
  test('o resumo diz que não há regras: os quadros sem taxa nem imposto estimado', () => {
    const r = resumoAMao(2025);
    r.semRegrasDoAno = true;
    const q = texto(app.fiscoQuadroCard(r, '4.1')), c = texto(app.fiscoContratoHtml(r, linhaDe(r, 'C1')));
    assert.doesNotMatch(q, /imposto estimado/);
    assert.doesNotMatch(q, /\d % /, 'sem taxa');
    assert.match(q, /sem regras de 2025/);
    assert.doesNotMatch(c, /taxa \d/);
  });

  test('um resumo sem o campo, de um ano antes da primeira versão, também', () => {
    const r = resumoAMao(2025);
    delete r.semRegrasDoAno;
    r.ano = 2023;
    r.versao = Object.assign({}, r.versao, { exato: false, pedido: 2023 });
    assert.doesNotMatch(texto(app.fiscoQuadroCard(r, '4.1')), /imposto estimado/);
  });
});

describe('D78 · o 4.2C cita a portaria da versão', () => {
  /* desde a D3 (N092) a página diz as portarias do ano com as datas, como o PDF, e não a da
     data de celebração: nas rendas de 2026 a AT pode medir pelos limites novos também os
     contratos celebrados antes de setembro */
  test('em 2026, num contrato de 2024 e num de outubro de 2026: as duas portarias com as datas', () => {
    const r = resumoAMao(2026);
    const l = linhaDe(r, 'L1');
    for (const x of [l, Object.assign({}, l, { celebracao: '2026-10-20' })]) {
      const t = texto(app.fiscoReducoesHtml(r, [x]));
      assert.match(t, /até 31\/08\/2026, os limites gerais por tipologia e concelho das tabelas 1 e 2 do anexo I à Portaria 176\/2019/);
      assert.match(t, /desde 14\/10\/2026, os limites máximos de renda do arrendamento acessível por tipologia e concelho, do anexo à Portaria 454\/2026\/1/);
    }
  });

  test('sem o resumo, a função ainda dá a portaria da data de celebração', () => {
    const v = app.irsAno(2026), L23 = v.taxas.limiteRendaAlta;
    assert.match(app.fiscoLimitesDoN23(L23, [{ nome: 'X', celebracao: '2024-03-01' }]), /Portaria 176\/2019/);
    assert.doesNotMatch(app.fiscoLimitesDoN23(L23, [{ nome: 'X', celebracao: '2026-10-20' }]), /176\/2019/);
  });
});

describe('D71 · o AIMI da demonstração', () => {
  const aimi = (extra) => Object.assign({ n: 1, total: 120, predios: [{ propertyId: 'v1', imovel: 'T2 Arroios', quadro: '4.1', vpt: 100000 }],
    vptArrendados: 100000, vptTotal: 100000, semVpt: [], abate: 60, parte: 60 }, extra || {});

  test('sem os números: os dois campos para os escrever, e o 9101/9102 «da demonstração do AIMI»', () => {
    const r = resumoAMao(2026);
    r.aimi = aimi({ demonstracao: null });
    const h = app.fiscoAimiCard(r);
    assert.match(h, /<input id="fiscoAimiTotal" type="text" inputmode="decimal" class="num" value="" placeholder="Opcional" autocomplete="off" data-change="fiscoAimiMudou\(this,2026,'total'\)">/);
    assert.match(h, /<input id="fiscoAimiVt" type="text" inputmode="decimal" class="num" value="" placeholder="Opcional" autocomplete="off" data-change="fiscoAimiMudou\(this,2026,'valorTributavel'\)">/);
    const t = texto(h);
    assert.match(t, /9101/);
    assert.match(t, /9102/);
    assert.match(t, /da demonstração do AIMI/);
    assert.ok(t.includes('AIMI pago registado na app ' + eu(120)), 'o que a app soma fica à parte');
  });

  test('com os números, os campos trazem-nos; os excluídos dizem porquê', () => {
    const r = resumoAMao(2026);
    r.aimi = aimi({ demonstracao: { total: 450.5, valorTributavel: 900000 }, excluidos: [{ imovel: 'Loja Baixa', porque: 'afetação comercial' }] });
    const h = app.fiscoAimiCard(r);
    assert.match(h, /id="fiscoAimiTotal"[^>]*value="450,50"/);
    assert.match(h, /id="fiscoAimiVt"[^>]*value="900000,00"/);
    assert.match(texto(h), /Loja Baixa · afetação comercial/);
  });

  test('um resumo sem a demonstração lê o valor da situação do ano', () => {
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { aimi: { total: 300, valorTributavel: 700000 } } } });
    const r = resumoAMao(2026);
    r.aimi = aimi();
    assert.match(app.fiscoAimiCard(r), /id="fiscoAimiTotal"[^>]*value="300,00"/);
  });

  test('escrever grava pela fiscoSetSituacao, com o outro número como estava', () => {
    const vistos = [], antes = app.fiscoSetSituacao;
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { aimi: { total: null, valorTributavel: 700000 } } } });
    app.fiscoSetSituacao = (ano, k, v) => { vistos.push(j([ano, k, v])); };
    try {
      const el = { value: '1.234,50' };
      app.fiscoAimiMudou(el, 2026, 'total');
      app.fiscoAimiMudou({ value: '' }, 2026, 'valorTributavel');
    } finally { app.fiscoSetSituacao = antes; }
    assert.deepEqual(vistos, [[2026, 'aimi', { total: 1234.5, valorTributavel: 700000 }], [2026, 'aimi', { total: null, valorTributavel: null }]]);
  });

  test('sem a fiscoSetSituacao, escrever não rebenta', () => {
    const antes = app.fiscoSetSituacao;
    app.fiscoSetSituacao = undefined;
    try { assert.doesNotThrow(() => app.fiscoAimiMudou({ value: '10' }, 2026, 'total')); } finally { app.fiscoSetSituacao = antes; }
  });
});

describe('os selos com uma frase cabem no telemóvel', () => {
  test('um selo dentro de um campo do cartão parte em linhas, e não empurra a página para o lado a 375 px', () => {
    const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
    assert.match(css, /\.fis-campo dd \.badge\{white-space:normal;max-width:100%;text-align:left\}/);
  });
});
