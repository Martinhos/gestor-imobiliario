// O guia «Declarar as rendas» (worker/src/guia-vista.js) e a montra
// (worker/src/landing.js) depois da ronda 2 da auditoria ao IRS (KAN-128,
// folha 2.3.9). Cada defeito confirmado que estes dois ficheiros tinham fica
// aqui com pelo menos um assert, que falhava antes da correção:
//   D112 a renda é a do recibo, antes da retenção, da comissão e de descontos; a gestora
//   D113 a obra paga pelo inquilino e descontada na renda
//   D118 os 5 % da reabilitação (com a mudança de posição da AT) e os quadros 4.3, 6A, 6B e 6C
//   D131 o guia sem alojamento local (decisão do Martinho, 2026-11-17), e a montra fala de cada imóvel arrendado
//   D133 o guia é dos imóveis em Portugal; os de fora vão ao Anexo J
//   D134 os dois casos da categoria B
//   D137 o código e o artigo da caderneta atual, e a reposição das freguesias em 2025
// O guia continua a ser informação: as partes 1 a 3 não falam da app.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paginaGuia } from '../worker/src/guia-vista.js';
import { paginaLanding } from '../worker/src/landing.js';

const guia = await paginaGuia({ raiz: true }).text();
const montra = await paginaLanding({ raiz: true }).text();
// Recebe: h — o HTML. Devolve: o texto visível, sem etiquetas e com os espaços (finos incluídos) normais.
const texto = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
// Recebe: id — o id de uma secção do guia. Devolve: o HTML dela.
const parte = (id) => new RegExp('<section class="bloco" id="' + id + '"[\\s\\S]*?\\n {2}</section>').exec(guia)[0];
// Recebe: h — o HTML; titulo — o subtítulo de um grupo. Devolve: o HTML do grupo.
const grupo = (h, titulo) => {
  const m = new RegExp('<div class="grupo">\\s*<h[34]>' + titulo + '</h[34]>[\\s\\S]*?\\n {4}</div>').exec(h);
  assert.ok(m, 'o grupo «' + titulo + '» existe');
  return m[0];
};
// Recebe: h — o HTML de uma lista; inicio — o começo de uma linha. Devolve: o texto dessa linha.
const linha = (h, inicio) => {
  const l = (h.match(/<li>[\s\S]*?<\/li>/g) || []).map(texto).find((t) => t.trim().startsWith(inicio));
  assert.ok(l, 'a linha que começa por «' + inicio + '» existe');
  return l;
};
const fontes = /<ul class="fontes">([\s\S]*?)<\/ul>/.exec(guia)[1];
const ficha = texto(/<dl class="ficha">[\s\S]*?<\/dl>/.exec(guia)[0]);

describe('o guia na ronda 2 da auditoria ao IRS', () => {
  test('D112: a renda que se declara é a do recibo, antes da retenção, da comissão e de descontos; a gestora', () => {
    const p3 = texto(parte('como-preencher'));
    assert.match(p3, /As rendas pelo valor ilíquido \(a renda do recibo, antes da retenção, da comissão e de descontos\)/);
    const g = texto(grupo(parte('como-preencher'), 'Quando a renda não chega inteira'));
    assert.match(g, /a renda do recibo, antes da retenção, da comissão e de descontos/);
    assert.match(g, /e não só o que chega à tua conta/);
    const gestora = linha(grupo(parte('como-preencher'), 'Quando a renda não chega inteira'), 'Se uma imobiliária ou gestora');
    assert.match(gestora, /declaras a renda inteira/);
    assert.match(gestora, /a comissão dela é um gasto, na coluna de outros/);
    assert.match(gestora, /processo 615\/2016/);
  });

  test('D113: a obra paga pelo inquilino e descontada na renda: a renda inteira, e a obra só se for de conservação com a fatura em teu nome', () => {
    const obra = linha(grupo(parte('como-preencher'), 'Quando a renda não chega inteira'), 'Se o inquilino pagou uma obra');
    assert.match(obra, /e a descontou na renda, declaras a renda inteira/);
    assert.match(obra, /A obra só se deduz se for de conservação ou manutenção e tiveres a fatura em teu nome/);
    assert.match(obra, /uma melhoria não se deduz/);
    assert.match(obra, /artigo 41\.º, n\.os 1 e 9/);
  });

  test('D118: os 5 % da reabilitação em «A taxa», com a mudança de posição da AT, e os quadros 4.3, 6A, 6B e 6C', () => {
    const taxa = grupo(parte('tens-de-declarar'), 'A taxa');
    const cinco = linha(taxa, '5 % nas rendas de um imóvel reabilitado');
    for (const f of ['entre 2 de janeiro de 2008 e 6 de outubro de 2023', 'já eras dono do imóvel a 6 de outubro de 2023',
      'artigo 71.º, n.º 7, do Estatuto dos Benefícios Fiscais', 'revogada pela Lei n.º 56/2023',
      'processo 28153, de 25 de setembro de 2026', 'A AT já mudou de posição', 'processo 23119',
      'no quadro 4.1', 'no quadro 6A']) assert.ok(cinco.includes(f), 'falta: ' + f);
    assert.ok(taxa.includes('5 % nas rendas'), 'com o espaço fino');
    const cada = texto(grupo(parte('como-preencher'), 'O quadro de cada contrato'));
    assert.match(cada, /Quadro 4\.3: o direito real de habitação duradoura/);
    assert.match(cada, /artigo 72\.º, n\.º 5/);
    const outros = grupo(parte('como-preencher'), 'Os outros quadros');
    const raros = linha(outros, 'Quadros 6A, 6B e 6C');
    for (const f of ['No 6A', 'No 6B', 'loja com história', '110 %', 'artigo 59.º-I, n.º 2', 'No 6C', 'rústico florestal',
      '50 %', 'artigo 59.º-G, n.os 11, 14 e 15', '31 de dezembro de 2026']) assert.ok(raros.includes(f), 'falta: ' + f);
    // ao lado dos do D79, que continuam lá
    for (const q of ['Quadro 4.4:', 'Quadro 5:', 'Quadros 6D, 6F e 6H:', 'Quadro 8:', 'Quadro 9:', 'Quadro 10:']) {
      assert.ok(texto(outros).includes(q), 'falta: ' + q);
    }
    for (const u of ['EBF/PIV_28153.pdf', 'cirs/Documents/PIV_23119.pdf', 'bf_rep/ra/Pages/ebf71_ra202310.aspx',
      'bf_rep/Pages/ebf59g.aspx', 'bf_rep/Pages/ebf59i.aspx']) assert.ok(fontes.includes(u), 'a fonte ' + u);
  });

  /* Decisão do Martinho (2026-11-17): a app é só de arrendamento com contratos, e o guia não trata o
     alojamento local. A única menção que fica é a isenção do 6F, que é de arrendamento (o imóvel que passou
     do alojamento local para habitação permanente). */
  test('D131 (sem alojamento local): o guia não fala dele, salvo a isenção do 6F, que é de arrendamento', () => {
    const fora = texto(grupo(parte('tens-de-declarar'), 'Quando não vão ao Anexo F'));
    assert.doesNotMatch(fora, /alojamento local|campo 417|quadro 15|artigo 28.º/i);
    assert.doesNotMatch(ficha, /alojamento local/i);
    const isentas = texto(grupo(parte('tens-de-declarar'), 'Rendas isentas'));
    const semIsencao = texto(guia).replace(isentas, '');
    assert.doesNotMatch(semIsencao, /alojamento local/i, 'fora da isenção do 6F, nenhuma menção');
    assert.ok(!fontes.includes('cirs_rep/Pages/irs28.aspx'), 'a fonte que só servia o alojamento local saiu');
    for (const u of ['cirs_rep/Pages/irs4.aspx', 'Mod_3_anexo_B.pdf']) assert.ok(fontes.includes(u), 'a fonte ' + u);
  });

  test('D133: o guia é dos imóveis em Portugal; os de fora vão ao Anexo J, quadro 7A', () => {
    assert.match(ficha, /recebes rendas de imóveis em Portugal/);
    assert.match(ficha, /As de um imóvel fora de Portugal vão ao Anexo J/);
    const fora = linha(grupo(parte('tens-de-declarar'), 'Quando não vão ao Anexo F'), 'As rendas de um imóvel fora de Portugal');
    for (const f of ['Anexo J', 'quadro 7A', 'código F01', 'o imposto que lá pagaste', 'artigo 15.º, n.º 1',
      'artigo 81.º, n.º 1']) assert.ok(fora.includes(f), 'falta: ' + f);
    for (const u of ['cirs_rep/Pages/irs15.aspx', 'cirs_rep/Pages/irs81.aspx', 'Mod_3_anexo_J.pdf']) assert.ok(fontes.includes(u), 'a fonte ' + u);
  });

  test('D134: os dois casos da categoria B, a opção e o prédio afeto à atividade', () => {
    const b = linha(grupo(parte('tens-de-declarar'), 'Quando não vão ao Anexo F'), 'As rendas da categoria B');
    for (const f of ['optaste por tributar o arrendamento na categoria B', 'artigo 4.º, n.º 1, alínea n), e n.º 5',
      'afeto a uma atividade tua', 'artigo 3.º, n.º 2, alínea a)', 'Anexo B', 'campo 410 do quadro 4A', 'Anexo C'])
      assert.ok(b.includes(f), 'falta: ' + f);
    assert.ok(fontes.includes('cirs_rep/Pages/irs3.aspx'));
  });

  test('D137: o código e o artigo da caderneta atual, e a reposição das freguesias em outubro de 2025', () => {
    const lal = grupo(parte('como-preencher'), 'Linha a linha');
    const id = linha(lal, 'A identificação matricial');
    assert.match(id, /código da freguesia, de seis caracteres \(quatro algarismos e, desde 2025, às vezes duas letras no fim\)/, 'D136: o código pode ter letras');
    assert.match(id, /da caderneta predial atual, que obténs no Portal das Finanças, ou da nota de cobrança do IMI mais recente/);
    const rep = linha(lal, 'Em outubro de 2025');
    for (const f of ['cerca de 300 freguesias', 'Lei n.º 25-A/2025', 'o código e o artigo podem ter mudado',
      'a caderneta da compra', 'artigo 113.º, n.º 1, do Código do IMI']) assert.ok(rep.includes(f), 'falta: ' + f);
    assert.doesNotMatch(rep, /\b30[23]\b/, 'o número exato não: a imprensa disse 302 e a tabela tem 303');
    for (const u of ['cimi/Pages/cimi113.aspx', 'Reposicao-freguesias-agregadas-2025-tab-correspondencia.aspx',
      'lei-25-a-2025.pdf']) assert.ok(fontes.includes(u), 'a fonte ' + u);
  });

  test('as partes 1 a 3 continuam a ser informação: não falam da app', () => {
    const corpo = texto(guia.slice(guia.indexOf('<section class="bloco" id="tens-de-declarar"'), guia.indexOf('<section class="parte" id="deducoes"')));
    assert.doesNotMatch(corpo, /Rendorium|\bapp\b|por ti\b/i);
    assert.doesNotMatch(corpo, /\(s\)|\bpôr\b|\btirar\b/);
  });

  // o -s do verbo cai antes do pronome: «declara-las», «regista-los», «paga-lo» — nunca «declaras-las»
  test('os pronomes depois do verbo, sem o -s que cai: «declara-las» e não «declaras-las»', () => {
    const tudo = texto(guia);
    assert.doesNotMatch(tudo, /[A-Za-zÀ-ÿ]s-l[oa]s?\b/, 'um verbo com o -s antes de -lo/-la/-los/-las');
    assert.match(tudo, /declara-las no quadro 4\.4 do Anexo F/);
  });
});

describe('a montra na ronda 2 da auditoria ao IRS', () => {
  test('D131: o ecrã do IRS fala das rendas e dos gastos de cada imóvel arrendado', () => {
    const ecra = texto(/<section[^>]*id="irs"[\s\S]*?<\/section>/.exec(montra)[0]);
    assert.match(ecra, /As rendas e os gastos de cada imóvel arrendado chegam arrumados pelo quadro do Anexo F/);
  });
});
