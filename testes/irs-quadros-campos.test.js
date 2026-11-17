// Os cartões dos quadros da Declaração (fisco-quadros.js), da auditoria ao IRS
// (KAN-126, vaga 1, folha 2.1.11): o que a pessoa copia para o Anexo F no Portal
// tem de ser o que o impresso pede, com os números certos.
//   D16  a natureza 07 assumida (finalidade por indicar) vai com o selo de falta
//   D17  a taxa escrita no contrato, quando é outra, é só uma nota: conta a da lei
//   D63  as obras dos 24 meses: o cartão diz o ano em que cada contrato começou
//   D69  «uma linha por prédio ou fração de cada contrato, com a renda que lhe cabe»
//   D72/D98  «prejuízo X €» em vez de um imposto negativo; os totais dos quadros = KPI
//   D77  o n.º do campo de cada linha e «por esta ordem»; o campo no 4.2A, 4.2B, 6D, 8, 9
//   D84  o 8B com o prazo das declarações de substituição (30 dias depois da entrega)
//   D102 o 4.2 sem «Data de início» (vai no 4.2A)
//   D106 a linha do quadro 4.4 (casa nova a mais de 100 km), com a ligação ao guia
// Os campos novos do resumo (l.campo, l.prejuizo, l.taxaEscrita em número,
// l.naturezaAssumida, r.aConfirmar) são da folha 2.1.7: aqui testam-se com um
// resumo feito à mão com a forma do contrato (plano, §1.4), e também pelo
// resumoFiscal, de ponta a ponta.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => app.definirServicosDesligados([]));
afterEach(() => repor(app));
const ANO = 2026;

/* um movimento normalizado, já na base
   Recebe: extra — os campos do movimento.
   Devolve: o movimento. */
const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};
/* o texto de um bocado de HTML, sem as etiquetas */
const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/* uma cópia JSON (os objetos vêm do contexto da app) */
const j = (x) => JSON.parse(JSON.stringify(x));

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Vera', nif: '123456789' }));
  app.db.properties.push(
    app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }),
    app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['ana'], freguesiaCodigo: '110624', tipoPredio: 'U', matrix: '777' }),
  );
  app.db.contracts.push(
    // sem termo: sem redução pela duração, no 4.1
    app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2024-01-01', active: true,
      fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }),
    // dez anos de prazo: com redução, no 4.2
    app.normContract({ id: 'L1', name: 'Benfica longo', propertyId: 'v2', tenantIds: ['t2'], rent: 600, start: '2024-03-01', end: '2034-02-28', active: true,
      fisco: { estado: 'declarado', numero: '7654321', finalidade: 'hp' } }),
  );
  for (let i = 1; i <= 12; i++) {
    const m = String(i).padStart(2, '0');
    mov({ kind: 'income', category: 'Rendas', amount: 1000, contractId: 'C1', recibo: true, date: `${ANO}-${m}-05` });
    mov({ kind: 'income', category: 'Rendas', amount: 600, contractId: 'L1', propertyId: 'v2', recibo: true, date: `${ANO}-${m}-06` });
  }
});

/* O resumo do ano com as linhas trocadas por cópias, para um teste mudar os
   campos de uma linha à mão (a forma da §1.4 do plano).
   Recebe: muda (opcional) — chamada com (linha) para cada linha.
   Devolve: o resumo. */
function resumoAMao(muda) {
  const r = app.resumoFiscal(ANO, '');
  r.linhas = r.linhas.map((l) => { const c = Object.assign({}, l); if (muda) muda(c); return c; });
  return r;
}
/* a linha de um contrato num resumo */
const linhaDe = (r, id) => r.linhas.find((l) => l.contratoId === id);
/* o valor de um campo do fiscoCamposDe, por grupo e rótulo */
const campo = (cs, grupo, nome) => cs.find((c) => c.grupo === grupo && c.campo === nome);

describe('D16 · a natureza 07 assumida, com a falta', () => {
  test('finalidade por indicar: «07 (assumida)» com o selo vermelho; com a finalidade, só «07»', () => {
    const r = resumoAMao((l) => { if (l.contratoId === 'C1') l.naturezaAssumida = true; });
    const n = campo(app.fiscoCamposDe(r, linhaDe(r, 'C1')), '', 'Natureza');
    assert.deepEqual(j([n.valor, n.falta, n.nota]), ['07 (assumida)', true, 'finalidade por indicar']);
    const html = app.fiscoContratoHtml(r, linhaDe(r, 'C1'));
    assert.match(html, /<dd>07 \(assumida\) <span class="badge red">finalidade por indicar<\/span><\/dd>/);
    const ok = campo(app.fiscoCamposDe(r, linhaDe(r, 'L1')), '', 'Natureza');
    assert.deepEqual(j([ok.valor, ok.falta]), ['07', false]);
  });

  test('de ponta a ponta: um contrato sem finalidade mostra a natureza assumida', () => {
    app.db.contracts.find((c) => c.id === 'C1').fisco.finalidade = '';
    const r = app.resumoFiscal(ANO, '');
    assert.equal(linhaDe(r, 'C1').naturezaAssumida, true, 'o resumo (2.1.7) marca-a');
    assert.match(app.fiscoContratoHtml(r, linhaDe(r, 'C1')), /07 \(assumida\) <span class="badge red">finalidade por indicar/);
  });
});

describe('D17 · a taxa escrita no contrato é uma nota; conta a da lei', () => {
  test('25 % escrito e 10 % da lei: a linha diz 10 % renda moderada, e a nota diz a escrita', () => {
    const r = resumoAMao((l) => { if (l.contratoId === 'C1') Object.assign(l, { taxa: 10, motivoTaxa: 'moderada', taxaEscrita: 25 }); });
    const l = linhaDe(r, 'C1');
    const card = app.fiscoContratoHtml(r, l);
    assert.match(card, /<span class="small">T2 Arroios · taxa 10 % · renda moderada<\/span>/);
    assert.match(card, /<p class="fis-ctc-nota">Escreveste 25 % no contrato; a lei de 2026 dá 10 %, e é essa que conta aqui\.<\/p>/);
    const res = app.fiscoQuadroResumoHtml(r, [l], '4.1', false);
    assert.match(res, /10 % renda moderada · escreveste 25 % no contrato/);
    assert.doesNotMatch(res + card, /escrita no contrato/, 'a linha nunca diz que a taxa é a escrita');
  });

  test('a escrita igual à da lei, ou nenhuma: sem nota', () => {
    for (const e of [null, 10]) {
      const r = resumoAMao((l) => { if (l.contratoId === 'C1') Object.assign(l, { taxa: 10, motivoTaxa: 'moderada', taxaEscrita: e }); });
      assert.doesNotMatch(app.fiscoContratoHtml(r, linhaDe(r, 'C1')), /fis-ctc-nota|Escreveste/);
    }
  });

  test('de ponta a ponta: 25 escrito num contrato de 1 000 € em 2026', () => {
    app.db.contracts.find((c) => c.id === 'C1').taxRate = 25;
    const r = app.resumoFiscal(ANO, '');
    const l = linhaDe(r, 'C1');
    assert.equal(l.taxa, 10, 'a taxa da linha é a da lei (2.1.7)');
    assert.equal(l.taxaEscrita, 25);
    assert.match(app.fiscoContratoHtml(r, l), /Escreveste 25 % no contrato; a lei de 2026 dá 10 %/);
  });
});

describe('D63 · as obras dos 24 meses com o ano certo', () => {
  test('um contrato que começou no ano anterior, sem rendas nele: o cartão di-lo, e não «começaram em 2026»', () => {
    const r = resumoAMao((l) => {
      if (l.contratoId === 'C1') Object.assign(l, { inicio: '2025-12-01', obras24: { valor: 4000, inicioGastos: '2025-03-10' } });
    });
    r.totais = Object.assign({}, r.totais, { obras24: 4000 });
    const h = texto(app.fiscoObrasCard(r));
    assert.doesNotMatch(h, /começaram em 2026/, 'o subtítulo antigo era falso aqui');
    assert.match(h, /Gastos dos 24 meses antes do início de cada contrato/);
    assert.match(h, /contrato desde 01\/12\/2025 · gastos desde 10\/03\/2025 · começou em 2025, sem rendas nesse ano: vão no primeiro ano com rendas/);
  });

  test('um contrato que começa no ano da declaração não leva a nota', () => {
    const r = resumoAMao((l) => { if (l.contratoId === 'C1') Object.assign(l, { inicio: '2026-02-01', obras24: { valor: 900, inicioGastos: '2025-11-20' } }); });
    assert.doesNotMatch(texto(app.fiscoObrasCard(r)), /começou em/);
  });

  test('as colunas das obras pedem o mês e o ano, como o impresso', () => {
    const r = resumoAMao((l) => { if (l.contratoId === 'C1') Object.assign(l, { inicio: '2026-02-01', obras24: { valor: 900, inicioGastos: '2025-11-20' } }); });
    const cs = app.fiscoCamposDe(r, linhaDe(r, 'C1')), g = 'Obras dos 24 meses antes do contrato';
    assert.equal(campo(cs, g, 'Início do contrato').valor, '02/2026');
    assert.equal(campo(cs, g, 'Mês do primeiro pagamento').valor, '11/2025');
    assert.equal(campo(cs, g, 'Valor').valor, app.euro2(900));
  });
});

describe('D69 · uma linha por prédio ou fração', () => {
  test('a frase fixa do cartão, e a fração com mais do que uma leva o selo', () => {
    const r = resumoAMao((l) => { if (l.contratoId === 'C1') { l.fracao = 'C e AB'; l.faltas = l.faltas.concat(['fração: mais do que uma no mesmo campo (C e AB) — no Anexo F cada fração vai numa linha, com a renda que lhe cabe']); } });
    const card = app.fiscoQuadroCard(r, '4.1');
    assert.match(card, /uma linha por prédio ou fração de cada contrato, com a renda que lhe cabe/);
    assert.doesNotMatch(card, /uma linha por contrato/);
    const f = campo(app.fiscoCamposDe(r, linhaDe(r, 'C1')), '', 'Fração ou secção');
    assert.deepEqual(j([f.valor, f.falta, f.nota]), ['C e AB', true, 'uma fração por linha']);
  });

  test('de ponta a ponta: a fração «C e AB» no imóvel', () => {
    app.db.properties.find((p) => p.id === 'v1').fraction = 'C e AB';
    const r = app.resumoFiscal(ANO, '');
    assert.match(app.fiscoContratoHtml(r, linhaDe(r, 'C1')), /<dd>C e AB <span class="badge red">uma fração por linha<\/span><\/dd>/);
  });
});

describe('D72 / D98 · prejuízo, e não imposto negativo; os totais dos quadros = KPI', () => {
  test('uma linha com mais gastos do que rendas diz «prejuízo X €»; o total diz «imposto estimado»', () => {
    const r = resumoAMao((l) => {
      if (l.contratoId === 'C1') Object.assign(l, { liquido: -6400, imposto: 0, prejuizo: 6400 });
      if (l.contratoId === 'L1') Object.assign(l, { liquido: 11700, imposto: 2925, prejuizo: 0 });
    });
    r.linhas.forEach((l) => { l.quadro = '4.1'; });
    const h = app.fiscoQuadroResumoHtml(r, r.linhas, '4.1', false);
    assert.ok(h.includes('<span class="small">prejuízo ' + app.euro2(6400) + '</span>'), 'a linha da perda');
    assert.ok(h.includes('<span class="small">imposto estimado ' + app.euro2(2925) + '</span>'), 'a linha do ganho');
    const tot = h.slice(h.indexOf('<b>Total do quadro 4.1</b>'));
    assert.ok(tot.includes('<span class="small">imposto estimado ' + app.euro2(2925) + '</span>'), 'o total do quadro');
    assert.doesNotMatch(h, /imposto −|imposto -/);
  });

  test('um resumo antigo com o imposto da linha negativo também sai como prejuízo', () => {
    const r = resumoAMao((l) => { if (l.contratoId === 'C1') Object.assign(l, { liquido: -6400, imposto: -1792, prejuizo: undefined }); });
    const h = app.fiscoQuadroResumoHtml(r, [linhaDe(r, 'C1')], '4.1', false);
    assert.ok(h.includes('prejuízo ' + app.euro2(6400)));
    assert.ok(!h.includes(app.euro2(-1792)) && !/imposto [−-]/.test(h), 'sem o imposto negativo');
  });

  test('de ponta a ponta: uma loja com prejuízo no 4.1 e um contrato longo no 4.2, do mesmo titular', () => {
    app.db.properties.push(app.normProp({ id: 'v3', name: 'Loja Graça', ownerIds: ['ana'], freguesiaCodigo: '110625', tipoPredio: 'U', matrix: '888' }));
    app.db.contracts.push(app.normContract({ id: 'K1', name: 'Loja', propertyId: 'v3', tenantIds: ['t1'], rent: 300, start: '2025-01-01', active: true,
      fisco: { estado: 'declarado', numero: '1111111', finalidade: 'nh' } }));
    for (let i = 1; i <= 12; i++) mov({ kind: 'income', category: 'Rendas', amount: 300, contractId: 'K1', propertyId: 'v3', recibo: true, date: `${ANO}-${String(i).padStart(2, '0')}-07` });
    mov({ kind: 'expense', category: 'Manutenção e reparações', amount: 10000, propertyId: 'v3', irsCol: 'conservacao', date: ANO + '-06-01' });
    const r = app.resumoFiscal(ANO, '');
    const loja = linhaDe(r, 'K1');
    assert.ok(loja.liquido < 0, 'controlo: a loja dá prejuízo');
    assert.ok(r.linhas.every((l) => l.imposto >= 0), 'nenhuma linha com imposto negativo (2.1.7)');
    const html = app.vFisco();
    assert.doesNotMatch(html, /imposto −|imposto -\d/);
    assert.match(app.fiscoQuadroResumoHtml(r, [loja], '4.1', false), /prejuízo /);
    // o total de cada quadro, como o cartão o escreve, e a soma dos dois = o KPI
    const total = (q) => {
      const m = new RegExp('<b>Total do quadro ' + q.replace('.', '\\.') + '</b>.*?imposto estimado ([^<]+)</span>', 's').exec(app.fiscoQuadroCard(r, q));
      return m && m[1];
    };
    const soma = (q) => Math.round(r.linhas.filter((l) => l.quadro === q && !l.isencao).reduce((n, l) => n + l.imposto, 0) * 100) / 100;
    assert.equal(total('4.1'), app.euro2(soma('4.1')));
    assert.equal(total('4.2'), app.euro2(soma('4.2')));
    assert.equal(Math.round((soma('4.1') + soma('4.2')) * 100) / 100, r.totais.imposto, 'os totais dos quadros somam o imposto estimado do KPI');
  });
});

describe('D77 · o n.º do campo e «por esta ordem»', () => {
  /* o resumo com os campos que o 2.1.7 escreve: 4001… no 4.1, 4501… no 4.2 */
  const comCampos = () => resumoAMao((l) => { l.campo = l.quadro === '4.2' ? '4501' : '4001'; });

  test('o cartão de cada quadro: «por esta ordem», o primeiro campo, e o campo em cada linha', () => {
    const r = comCampos();
    const q1 = app.fiscoQuadroCard(r, '4.1'), q2 = app.fiscoQuadroCard(r, '4.2');
    assert.match(q1, /<b>por esta ordem<\/b>.*O n\.º do campo de cada linha \(4001…\) é o que os outros quadros pedem para a identificar\./);
    assert.match(q2, /O n\.º do campo de cada linha \(4501…\)/);
    assert.match(q1, /<span class="small">campo 4001 · T2 Arroios · /);
    assert.match(q2, /<span class="small">campo 4501 · T1 Benfica · /);
  });

  test('o campo à cabeça dos campos da linha, e no 4.2A e no 4.2B', () => {
    const r = comCampos();
    // o 4.2B mostra-se pelo facto do n.º 24 (elegivel24), e não pela descida da taxa (D36, KAN-127)
    const l = Object.assign(linhaDe(r, 'L1'), { bonus: true, elegivel24: true, rendaAnterior: 700, contratoAnterior: { id: 'X', nome: 'Antes', numero: '999' } });
    const cs = app.fiscoCamposDe(r, l);
    assert.deepEqual(j([cs[0].grupo, cs[0].campo, cs[0].valor]), ['', 'Campo', '4501']);
    assert.equal(campo(cs, 'Quadro 4.2A', 'Campo do quadro 4.2').valor, '4501');
    assert.equal(campo(cs, 'Quadro 4.2B', 'Campo do quadro 4.2').valor, '4501');
    assert.match(app.fiscoReducoesHtml(r, [l]), /Benfica longo \(campo 4501\)/);
  });

  test('o 6D, o 8 e o 9 dizem o campo de cada linha', () => {
    const r = comCampos();
    const l = linhaDe(r, 'C1');
    // o 6D: um isento no 4.1
    Object.assign(l, { isencao: { id: 'paa', nome: 'Programa de Apoio ao Arrendamento', curto: 'PAA', quadro: '6D', codigo: '01' } });
    r.totais = Object.assign({}, r.totais, { isentos: { n: 1, rendas: l.rendas, liquido: l.liquido } });
    assert.match(texto(app.fiscoIsentosCard(r)), /campo 4001 do 4\.1 · T2 Arroios/);
    assert.match(texto(app.fiscoIsentosCard(r)), /no 6D indicas o campo do 4\.1 onde ficaram \(o n\.º ao lado de cada um\)/);
    // o 8: uma renda de 2024 recebida em 2026
    l.anosAnteriores = [{ ano: 2024, valor: 2000 }];
    assert.match(texto(app.fiscoAnosAnterioresCard(r)), /quadro 4\.1 · campo 4001 · respeitam a 2024/);
    // o 9: o campo onde o prédio ficou
    r.aimi = { n: 1, total: 120, predios: [{ propertyId: 'v1', imovel: 'T2 Arroios', quadro: '4.1', vpt: 100000 }], vptArrendados: 100000, vptTotal: 100000, semVpt: [], abate: 60, parte: 60 };
    assert.match(texto(app.fiscoAimiCard(r)), /T2 Arroios campo 4001 do quadro 4\.1 · valor patrimonial tributário/);
  });

  test('de ponta a ponta: o resumo numera, e a página mostra-o', () => {
    const r = app.resumoFiscal(ANO, '');
    assert.equal(linhaDe(r, 'C1').campo, '4001', 'o 2.1.7 numera o 4.1');
    assert.equal(linhaDe(r, 'L1').campo, '4501', 'e o 4.2');
    const html = app.vFisco();
    assert.match(html, /campo 4001 · T2 Arroios/);
    assert.match(html, /<dt>Campo<span class="small">linha do quadro 4\.2<\/span><\/dt><dd>4501<\/dd>/);
  });
});

describe('D84 · o 8B com o prazo das substituições', () => {
  test('rendas de 2024 recebidas em 2026: as substituições até 30/07/2027', () => {
    const r = resumoAMao((l) => { if (l.contratoId === 'C1') l.anosAnteriores = [{ ano: 2024, valor: 2000 }]; });
    const h = texto(app.fiscoAnosAnterioresCard(r));
    assert.match(h, /no 8B se entregares as declarações de substituição desses anos \(até cinco anos para trás\) até 30\/07\/2027, 30 dias depois do fim do prazo da entrega \(CIRS art\. 74\.º n\.º 8\)\./);
  });

  test('de ponta a ponta: uma renda de novembro de 2024 paga em 2026', () => {
    mov({ kind: 'income', category: 'Rendas', amount: 1000, contractId: 'C1', recibo: true, periodo: '2024-11', date: ANO + '-02-20' });
    const r = app.resumoFiscal(ANO, '');
    // o ano e o valor; o resumo dá também as retenções de cada ano (D55, KAN-127)
    assert.deepEqual(j(linhaDe(r, 'C1').anosAnteriores).map((a) => ({ ano: a.ano, valor: a.valor })), [{ ano: 2024, valor: 1000 }]);
    assert.match(app.vFisco(), /até 30\/07\/2027, 30 dias depois do fim do prazo da entrega/);
  });
});

describe('D102 · o 4.2 sem «Data de início»', () => {
  test('a linha do 4.2 não tem a coluna; o 4.2A tem o início; a do 4.1 tem-na', () => {
    const r = app.resumoFiscal(ANO, '');
    const c42 = app.fiscoCamposDe(r, linhaDe(r, 'L1')), c41 = app.fiscoCamposDe(r, linhaDe(r, 'C1'));
    assert.equal(campo(c42, '', 'Data de início'), undefined);
    assert.equal(campo(c42, 'Quadro 4.2A', 'Início').valor, '01/03/2024');
    assert.equal(campo(c41, '', 'Data de início').valor, '01/01/2024');
  });
});

describe('D106 · o quadro 4.4, uma vez, com o guia', () => {
  test('a página fala do 4.4 uma vez, com a ligação ao guia das deduções', () => {
    const html = app.vFisco();
    assert.equal((html.match(/quadro 4\.4/g) || []).length, 1);
    assert.match(html, /Mudaste a tua casa para mais de 100 km e arrendaste a antiga\? O quadro 4\.4 deduz às rendas dela as que pagas pela nova/);
    assert.match(html, /<a class="btn sm" href="\/guias\/declarar-rendas#pode-deduzir" target="_blank" rel="noopener" data-toca="nada">Ver no guia<\/a>/);
    // no primeiro quadro, o 4.1
    const r = app.resumoFiscal(ANO, '');
    assert.match(app.fiscoQuadroCard(r, '4.1'), /quadro 4\.4/);
    assert.doesNotMatch(app.fiscoQuadroCard(r, '4.2'), /quadro 4\.4/);
  });

  test('sem linhas no 4.1, vai no 4.2; sem o quadro na versão, ou só lojas, não se diz', () => {
    let r = resumoAMao((l) => { l.quadro = '4.2'; });
    assert.match(app.fiscoQuadroCard(r, '4.2'), /quadro 4\.4/);
    r = app.resumoFiscal(ANO, '');
    r.versao = Object.assign({}, r.versao, { quadros: Object.assign({}, r.versao.quadros, { mudanca100km: '' }) });
    assert.doesNotMatch(app.fiscoQuadroCard(r, '4.1'), /100 km/);
    r = resumoAMao((l) => { l.natureza = '06'; });
    assert.equal(app.fiscoMudanca100kmHtml(r), '');
  });
});

describe('as despesas a confirmar e os cartões sem «só de leitura»', () => {
  test('o primeiro quadro diz quantas despesas a confirmar não contam; nunca «contam em Outros»', () => {
    const r = app.resumoFiscal(ANO, '');
    r.aConfirmar = [{ txId: 'a', nome: 'Seguro', valor: 120 }, { txId: 'b', nome: 'Contabilista', valor: 300 }];
    r.semRegra = 1;
    const q1 = texto(app.fiscoQuadroCard(r, '4.1'));
    assert.match(q1, /2 despesas a confirmar não contam em coluna nenhuma até escolheres a coluna de cada uma: estão em «A tratar antes de entregar»\./);
    assert.doesNotMatch(q1, /em Outros/);
    assert.doesNotMatch(texto(app.fiscoQuadroCard(r, '4.2')), /a confirmar não cont/, 'uma vez por página');
  });

  test('a Declaração requer os Contratos e os Movimentos: os cartões abrem sempre, sem perguntar pelos serviços', () => {
    const fonte = readFileSync(new URL('../web/app/fisco-quadros.js', import.meta.url), 'utf8');
    assert.doesNotMatch(fonte, /servicoLigado|fraseServicoDesligado/);
    const r = app.resumoFiscal(ANO, '');
    r.fora = [{ contratoId: 'C9', nome: 'Fora', imovel: 'T2 Arroios', rendas: 500, n: 1, quota: 1 }];
    r.semContrato = [{ propertyId: 'v1', imovel: 'T2 Arroios', rendas: 400, n: 1, ids: ['tx9'] }];
    assert.match(app.fiscoForaCard(r), /class="card tap u-p-11px-13px" data-toca="camada" data-click="ctView\('C9'\)"/);
    assert.match(app.fiscoSemContratoCard(r), /txView\('tx9'\)/);
    assert.match(app.fiscoSemContratoCard(r), /Estas rendas declaram-se na mesma/, 'sem contrato não deixam de se declarar');
    assert.match(app.fiscoQuadroCard(r, '4.1'), /<div class="fis-ctc tap" data-toca="camada" data-click="ctView\('C1'\)">/);
  });
});
