// A exportação da Declaração na ronda 2 do IRS (vaga 4, folha 2.4.7): o texto
// (fisco-exportar.js:fiscoTexto), o CSV (fiscoCsvTexto) e o PDF
// (fisco-pdf.js:fiscoPdf) dizem o mesmo que o resumo da ronda 2 (fisco-resumo.js):
// - D120: o quadro 4.3 do direito real de habitação duradoura, com as colunas
//   das instruções (a escritura, a caução, os moradores, os gastos obrigatórios,
//   a cessação), a caução inicial que não é rendimento e a regularização de um
//   DHD cessado por acordo;
// - D117, D119, D121: os quadros 6A, 6B e 6C com o campo do 4.1 de cada linha,
//   o líquido sobre que o imposto se estima (as rendas do 6C a 50 %, as obras do
//   6B a 110 %) à parte do líquido do quadro, e o aviso do 6A;
// - D133: o imóvel fora de Portugal no quadro 7A do Anexo J (F01, o país e o
//   código, o líquido, o imposto pago lá), sem imposto estimado;
// - D134: as rendas da categoria B fora do Anexo F, com o anexo para onde vão;
// - D135: o código de uma união de freguesias extinta em 2025 — no PDF o campo
//   diz «confirmar», o texto e o CSV levam a falta;
// - D137: a nota da caderneta atual ao lado da identificação matricial;
// - D112: a renda ilíquida é a do recibo, antes da retenção, da comissão e de
//   descontos.
//
// Os casos correm de ponta a ponta pelo resumo da app.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2027-05-10' });
if (typeof app.fiscoPdf !== 'function') {
  const f = new URL('../web/app/fisco-pdf.js', import.meta.url);
  vm.runInContext(fs.readFileSync(f, 'utf8'), app.__ctx, { filename: f.href });
}
afterEach(() => repor(app));

const ANO = 2026;
const mm = (m) => String(m).padStart(2, '0');
const M12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* As células cruas de uma linha do CSV (o ';' só separa fora das aspas).
   Recebe: linha — a linha (string).
   Devolve: as células (array de strings). */
function cruas(linha) {
  const out = [];
  let i = 0;
  for (;;) {
    const ini = i;
    if (linha[i] === '=' && linha[i + 1] === '"') i = linha.indexOf('"', i + 2) + 1;
    else if (linha[i] === '"') {
      i++;
      for (;;) { const j = linha.indexOf('"', i); if (linha[j + 1] === '"') i = j + 2; else { i = j + 1; break; } }
    } else { const j = linha.indexOf(';', i); i = j < 0 ? linha.length : j; }
    out.push(linha.slice(ini, i));
    if (linha[i] !== ';') return out;
    i++;
  }
}
/* O valor de uma célula crua, sem as aspas e sem o ="…" dos códigos. */
function valor(c) {
  if (c.startsWith('="')) return c.slice(2, -1);
  if (c.startsWith('"')) return c.slice(1, -1).split('""').join('"');
  return c;
}
/* O CSV de um ano, lido: o cabeçalho, as linhas como objetos e as dos quadros.
   Recebe: ano (opcional) — o ano (ANO sem ele).
   Devolve: {cab, rows, quadros}. */
function csv(ano) {
  const ls = app.fiscoCsvTexto(app.resumoFiscal(ano || ANO)).split('\n').map(cruas), cab = ls[0].map(valor);
  const rows = ls.slice(1).map((c) => {
    assert.equal(c.length, cab.length, 'cada linha tem as colunas do cabeçalho');
    return Object.fromEntries(cab.map((k, i) => [k, valor(c[i])]));
  });
  return { cab, rows, quadros: rows.filter((x) => x.declarado === 'sim' || x.declarado === 'por indicar') };
}
/* O PDF do ano, lido à entrada do escritor: os textos soltos e os cartões
   (cada item [campo, valor], ou o texto de um título ou de um grupo).
   Devolve: {ditos, cartoes, bytes, avisos}. */
async function pdf() {
  const out = { ditos: [], cartoes: [], bytes: null, avisos: [] };
  const original = app.PDF;
  app.PDF = function () {
    const p = original.apply(this, arguments);
    for (const k of Object.keys(p)) {
      if (typeof p[k] !== 'function') continue;
      const f = p[k];
      p[k] = function () {
        for (const a of arguments) {
          if (typeof a === 'string') out.ditos.push(a);
          else if (k === 'cartao' && a && Array.isArray(a.itens)) out.cartoes.push(a.itens.map((x) => (x.texto != null ? x.texto : [x.campo, x.valor])));
        }
        return f.apply(this, arguments);
      };
    }
    return p;
  };
  app.downloadBytes = (nome, mime, bytes) => { out.bytes = bytes; };
  app.toast = (m) => out.avisos.push(m);
  await app.fiscoPdf();
  return out;
}
const cartao = (p, titulo) => p.cartoes.find((c) => typeof c[0] === 'string' && c[0].startsWith(titulo));
const campoDe = (c, campo) => { const x = c && c.find((i) => Array.isArray(i) && i[0] === campo); return x && x[1]; };
const euro = (v) => app.fiscoPdfEuro(v);
const e2 = (v) => app.euro2(v);

const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra)));
const rendas = (v, meses, extra, ano) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: v, contractId: 'C1', recibo: true, date: `${ano || ANO}-${mm(m)}-05` }, extra || {})));
const imovel = (extra) => app.db.properties.push(app.normProp(Object.assign({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'],
  freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651' }, extra || {})));
const contrato = (extra, fisco) => app.db.contracts.push(app.normContract(Object.assign({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000,
  start: '2026-01-01', active: true }, extra || {}, { fisco: Object.assign({ estado: 'declarado', numero: '1234567', finalidade: 'hp' }, fisco || {}) })));

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('D120 — o quadro 4.3 do direito real de habitação duradoura', () => {
  const dhd = () => {
    imovel(); contrato({ rent: 500, deposit: 20000 }, { finalidade: 'dhd' });
    rendas(500);
    mov({ kind: 'expense', category: 'Condomínio', amount: 600, date: '2026-04-10' });
  };

  test('o texto leva o 4.3 com a escritura, a caução, a natureza das instruções e os gastos obrigatórios', () => {
    dhd();
    const r = app.resumoFiscal(ANO), l = r.linhas[0];
    assert.equal(l.quadro, '4.3', 'o resumo põe o DHD no 4.3');
    const t = app.fiscoTexto();
    assert.match(t, /^ANEXO F · QUADROS 4\.1, 4\.2 E 4\.3 — 2026/);
    assert.ok(t.includes('Campo 4901 · [4.3] n.º 1234567 · Arroios — T2 Arroios · titular A'), 'a entrada, sem «natureza» no título da linha das rendas');
    assert.ok(t.includes('natureza 01 (prestação pecuniária mensal (rendas))'), 'o texto da natureza é o do 4.3, não o do 4.1');
    assert.ok(t.includes('Quadro 4.3: escritura 01/01/2026 · caução ' + e2(20000) + ' (a da escritura)'));
    assert.ok(t.includes('Gastos obrigatórios suportados e pagos: Conservação extraordinária ' + e2(0) + ' · Condomínio ' + e2(600) + ' · Outros ' + e2(0)));
    assert.ok(t.includes('Moradores: Tiago (NIF 123456789)'));
    assert.ok(t.includes('Rendimento líquido ' + e2(5400) + ' · imposto estimado ' + e2(270)));
  });

  test('o CSV leva as colunas do 4.3 no fim, e a linha diz o quadro e a natureza', () => {
    dhd();
    const { cab, quadros } = csv(), c = quadros[0];
    assert.deepEqual(cab.slice(cab.indexOf('vpt') + 1, cab.indexOf('vpt') + 9),
      ['quadro_6a', 'quadro_6b', 'quadro_6c', 'liquido_tributavel', 'beneficios_texto', 'dhd_escritura', 'dhd_caucao', 'dhd_caucao_recebida'], 'as colunas novas vão depois das que havia');
    assert.equal(c.quadro, '4.3');
    assert.equal(c.natureza, '01');
    assert.equal(c.natureza_texto, 'prestação pecuniária mensal (rendas)');
    assert.equal(c.dhd_escritura, '2026-01-01');
    assert.equal(c.dhd_caucao, '20000,00');
    assert.equal(c.dhd_caucao_recebida, '0,00');
    assert.equal(c.dhd_condominio, '600,00');
    assert.equal(c.dhd_conservacao_extra, '0,00');
    assert.equal(c.dhd_outros, '0,00');
    assert.equal(c.dhd_cessacao_data, '');
  });

  test('o PDF tem o quadro 4.3 com as colunas das instruções, e o PDF sai só com ele', async () => {
    dhd();
    const p = await pdf(), q = app.irsAno(ANO).quadro43, nome = (id, lista) => (q[lista || 'colunas'].find((x) => x[0] === id) || [])[1];
    assert.ok(p.bytes, 'há PDF');
    assert.ok(p.ditos.includes('Quadro 4.3 · direito real de habitação duradoura'), 'o título do quadro');
    const b = cartao(p, 'Arroios · T2 Arroios');
    assert.equal(campoDe(b, 'Campo'), '4901');
    assert.equal(campoDe(b, app.fiscoPdfTxt(nome('numero'))), '1234567');
    assert.equal(campoDe(b, app.fiscoPdfTxt(nome('escritura'))), '01/01/2026');
    assert.equal(campoDe(b, app.fiscoPdfTxt(nome('caucao'))), euro(20000));
    assert.equal(campoDe(b, app.fiscoPdfTxt(nome('valor'))), euro(6000));
    assert.equal(campoDe(b, app.fiscoPdfTxt(nome('natureza'))), '01 · prestação pecuniária mensal (rendas)');
    assert.ok(b.includes(app.fiscoPdfTxt(nome('gastos'))), 'o grupo dos gastos obrigatórios');
    assert.equal(campoDe(b, nome('condominio', 'gastos')), euro(600));
    assert.equal(campoDe(b, app.fiscoPdfTxt(nome('cessacao'))), '—');
    assert.equal(campoDe(b, 'Morador'), 'Tiago · NIF 123 456 789');
    assert.match(campoDe(b, 'Estimativa da app'), /^líquido 5 400,00 € · imposto estimado 270,00 €/);
    assert.ok(cartao(p, 'Total do quadro 4.3'), 'o total do quadro');
    assert.ok(!cartao(p, 'Total do quadro 4.1'), 'nada no 4.1');
    assert.ok(p.ditos.some((s) => s.startsWith('No 4.3 vai cada direito real de habitação duradoura')), 'a nota do quadro');
  });

  test('a caução recebida no ano diz-se e não é rendimento', async () => {
    dhd();
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 20000, contractId: 'C1', date: '2026-01-02' });
    const t = app.fiscoTexto();
    assert.ok(t.includes('caução recebida em 2026: ' + e2(20000) + ' — não é rendimento'));
    assert.equal(csv().quadros[0].dhd_caucao_recebida, '20000,00');
    assert.equal(csv().quadros[0].rendas_iliquidas, '6000,00');
    const b = cartao(await pdf(), 'Arroios · T2 Arroios');
    assert.match(campoDe(b, 'Caução recebida em 2026'), /^20 000,00 € · não é rendimento/);
  });

  test('cessado por acordo (motivo 01 do 4.3): a cessação e a regularização são do 4.3, não do quadro 10', async () => {
    imovel();
    contrato({ rent: 500, deposit: 20000, start: '2025-01-01', end: '2045-01-01', active: false }, { finalidade: 'dhd', cessacao: { data: '2026-06-30', motivo: '01' } });
    rendas(500, M12, {}, 2025);
    rendas(500, [1, 2, 3, 4, 5, 6]);
    const r = app.resumoFiscal(ANO), g = r.regularizacoes.find((x) => x.dhd);
    assert.ok(g && g.total > 0, 'o resumo dá a regularização do DHD');
    const t = app.fiscoTexto();
    assert.ok(t.includes('cessação 30/06/2026 · motivo 01 (Por acordo das partes)'));
    assert.ok(t.includes('Regularização (art. 72.º n.º 20): diferença estimada de ' + e2(g.total) + ' (2025: ' + e2(g.anos[0].diferenca) + ')'));
    assert.ok(t.includes('o direito real de habitação duradoura cessou por acordo das partes'));
    assert.ok(t.includes('com a regularização do quadro 4.3 '), 'o caminho do imposto diz o quadro certo');
    assert.ok(!t.includes('regularização do quadro 10'));
    const c = csv().quadros[0];
    assert.equal(c.dhd_cessacao_data, '2026-06-30');
    assert.equal(c.dhd_cessacao_motivo, '01');
    assert.equal(c.regularizacao_estimada, g.total.toFixed(2).replace('.', ','));
    const p = await pdf(), b = cartao(p, 'Arroios · T2 Arroios');
    assert.equal(campoDe(b, app.fiscoPdfTxt(app.irsAno(ANO).quadro43.colunas.find((x) => x[0] === 'cessacao')[1])), '30/06/2026 · motivo 01 · Por acordo das partes');
    assert.match(campoDe(b, 'Regularização (art. 72.º n.º 20)'), /^diferença estimada de 1 200,00 €/);
    assert.ok(p.cartoes.some((x) => campoDe(x, 'Com a regularização do quadro 4.3')), 'os totais');
  });
});

describe('D117, D119, D121 — os quadros 6A, 6B e 6C', () => {
  test('6A: o campo do 4.1 no quadro 6A, a taxa de 5 % e o aviso da AT, no texto, no CSV e no PDF', async () => {
    imovel({ reabilitacao: { tipo: 'aru', inicio: '2015-01-10', conclusao: '2016-06-30', certificado: true }, purchaseDate: '2010-05-01' });
    contrato();
    rendas(1000);
    const r = app.resumoFiscal(ANO), l = r.linhas[0], b6 = l.beneficios[0];
    assert.equal(b6.quadro, '6A');
    const t = app.fiscoTexto();
    assert.ok(t.includes('Quadro 6A (campo 4001 do 4.1): ' + b6.curto + ' · taxa de 5 %'), 'na linha');
    assert.ok(t.includes(b6.aviso), 'o aviso da PIV 28153');
    assert.match(t, /\nQUADRO 6A · IMÓVEL REABILITADO \(ARU OU NRAU\)[^\n]*\n {2}Campo 4001 — Arroios — T2 Arroios/);
    const c = csv().quadros[0];
    assert.equal(c.quadro_6a, '4001');
    assert.equal(c.quadro_6b, '');
    assert.match(c.beneficios_texto, /^6A · imóvel reabilitado · taxa de 5 %/);
    const p = await pdf();
    assert.ok(p.ditos.includes('Quadro 6A · ' + app.fiscoPdfTxt(b6.nome)));
    const k = cartao(p, 'Arroios · T2 Arroios · quadro 6A');
    assert.equal(campoDe(k, 'Campo do quadro 4.1'), '4001');
    assert.equal(campoDe(k, 'N.º do contrato na AT'), '1234567');
    assert.equal(campoDe(k, 'O que muda'), 'taxa de 5 %');
    assert.equal(campoDe(k, 'Confirma'), app.fiscoPdfTxt(b6.aviso));
    assert.match(campoDe(cartao(p, 'Arroios · T2 Arroios'), 'Quadro 6A'), /^imóvel reabilitado · o campo 4001 vai ao 6A · taxa de 5 %/);
  });

  test('6C: as rendas por inteiro no quadro e a 50 % no imposto, sem confundir os dois líquidos', async () => {
    imovel({ tipoPredio: 'R' });
    contrato({ rent: 500, start: '2019-05-01' }, { finalidade: 'nh', egf: true, celebracao: '2019-05-01' });
    rendas(500);
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 100, date: '2026-05-10' });
    const r = app.resumoFiscal(ANO), l = r.linhas[0];
    assert.equal(l.liquidoTributavel, 2900, 'o resumo dá o líquido do imposto');
    const t = app.fiscoTexto();
    assert.ok(t.includes('Rendimento líquido ' + e2(5900)), 'o líquido do quadro, por inteiro');
    assert.ok(t.includes('Líquido para o imposto estimado ' + e2(2900) + ' (o quadro leva os valores por inteiro: no 6C as rendas contam 50 %)'));
    assert.ok(t.includes('Quadro 6C (campo 4001 do 4.1): arrendado a uma EGF · as rendas (' + e2(6000) + ') contam 50 % no imposto · líquido para o imposto ' + e2(2900)));
    const c = csv().quadros[0];
    assert.equal(c.quadro_6c, '4001');
    assert.equal(c.liquido, '5900,00');
    assert.equal(c.liquido_tributavel, '2900,00');
    const im = csv().rows.find((x) => x.declarado === 'imposto');
    assert.equal(im.liquido_tributavel, '2900,00');
    const p = await pdf(), b = cartao(p, 'Arroios · T2 Arroios');
    assert.match(campoDe(b, 'Estimativa da app'), /^líquido 5 900,00 € · para o imposto 2 900,00 € \(no 6C as rendas contam 50 %\) · imposto estimado 812,00 €/);
    assert.ok(p.cartoes.some((x) => campoDe(x, 'Líquido para o imposto') === euro(2900) + ' · no 6C as rendas contam 50 % (estimativa)'), 'nos totais');
    assert.ok(cartao(p, 'Arroios · T2 Arroios · quadro 6C'));
  });

  test('6B: as obras dos 24 meses contam 110 % no imposto', () => {
    imovel({ lojaComHistoria: true });
    contrato({}, { finalidade: 'nh', obrasSemOutroUso: true });
    rendas(1000);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 1000, date: '2025-10-10' });
    const t = app.fiscoTexto();
    assert.ok(t.includes('Quadro 6B (campo 4001 do 4.1): Loja com História · as obras dos 24 meses (' + e2(1000) + ') contam 110 % no imposto · líquido para o imposto ' + e2(10900)));
    const c = csv().quadros[0];
    assert.equal(c.quadro_6b, '4001');
    assert.equal(c.liquido_tributavel, '10900,00');
  });
});

describe('D133 — o imóvel fora de Portugal no quadro 7A do Anexo J', () => {
  test('F01, o país e o código, o líquido e o imposto pago lá; sem imposto estimado; o PDF sai só com ele', async () => {
    imovel({ pais: 'França', paisCodigo: '250' });
    contrato({}, { impostoEstrangeiro: { 2026: 300 } });
    rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', amount: 600, date: '2026-04-10' });
    const r = app.resumoFiscal(ANO);
    assert.equal(r.linhas.length, 0);
    const t = app.fiscoTexto();
    assert.match(t, /\nANEXO J · QUADRO 7A \(imóveis fora de Portugal: não vão ao Anexo F; a app não estima o imposto\)\n/);
    assert.ok(t.includes('  Arroios — T2 Arroios · titular A: código F01 · país França (código 250) · rendas ' + e2(12000) + ' · gastos ' + e2(600) + ' · líquido ' + e2(11400) + ' · imposto pago no estrangeiro ' + e2(300)));
    assert.ok(t.includes('Fora do Anexo F: Anexo J (quadro 7A) — rendas ' + e2(12000) + ', líquido ' + e2(11400)), 'nos totais');
    const j = csv().rows.find((x) => x.declarado === 'anexo J');
    assert.equal(j.quadro, '7A');
    assert.equal(j.anexo_j_codigo, 'F01');
    assert.equal(j.pais, 'França');
    assert.equal(j.pais_codigo, '250');
    assert.equal(j.rendas_iliquidas, '12000,00');
    assert.equal(j.gastos_total, '600,00');
    assert.equal(j.liquido, '11400,00');
    assert.equal(j.imposto_estrangeiro, '300,00');
    assert.equal(j.imposto_estimado, '', 'sem estimativa (Q12)');
    assert.equal(j.anexo_destino, 'Anexo J · quadro 7A');
    const p = await pdf();
    assert.ok(p.bytes, 'há PDF: as rendas lá de fora também se declaram');
    assert.ok(p.ditos.includes('Anexo J · imóveis fora de Portugal'));
    const b = cartao(p, 'Arroios · T2 Arroios');
    assert.equal(campoDe(b, 'Código do rendimento'), 'F01');
    assert.equal(campoDe(b, 'País'), 'França · código 250');
    assert.equal(campoDe(b, 'Rendimento líquido'), euro(11400));
    assert.equal(campoDe(b, 'Imposto pago no estrangeiro'), euro(300));
    assert.match(campoDe(b, 'Estimativa da app'), /^sem imposto estimado/);
    assert.ok(!p.ditos.concat(p.cartoes.flat(2).filter((x) => typeof x === 'string')).some((s) => /imposto estimado [0-9]/.test(s)), 'nenhum imposto estimado');
  });

  test('sem o código do país, falta no texto, no CSV e no PDF', async () => {
    imovel({ pais: 'França' });
    contrato();
    rendas(1000);
    assert.ok(app.fiscoTexto().includes('Falta: código do país (tabela X do Anexo J).'));
    assert.equal(csv().rows.find((x) => x.declarado === 'anexo J').faltas, 'código do país (tabela X do Anexo J)');
    const b = cartao(await pdf(), 'Arroios · T2 Arroios');
    assert.match(campoDe(b, 'País'), /^França · falta o código do país/);
  });
});

describe('D134 — as rendas da categoria B fora do Anexo F', () => {
  test('com o valor e o anexo para onde vão, à parte dos contratos não declarados', async () => {
    imovel(); contrato({ rent: 800 }, { categoriaB: true });
    rendas(800);
    const t = app.fiscoTexto();
    assert.match(t, /\nFORA DO ANEXO F · CATEGORIA B \(declaram-se no Anexo B ou C, com a tua atividade\)\n {2}Arroios — T2 Arroios: /);
    assert.ok(t.includes('Arroios — T2 Arroios: ' + e2(9600) + ' (12 rendas)'));
    assert.ok(!t.includes('FORA DA DECLARAÇÃO'), 'não é um contrato não declarado');
    const b = csv().rows.find((x) => x.declarado === 'categoria B');
    assert.equal(b.rendas_iliquidas, '9600,00');
    assert.equal(b.anexo_destino, 'Anexo B ou C');
    const p = await pdf();
    assert.ok(p.bytes, 'há PDF');
    assert.ok(p.ditos.includes('Fora do Anexo F · categoria B'));
    assert.ok(p.cartoes.some((c) => campoDe(c, 'Arroios · T2 Arroios') === euro(9600) + ' · 12 rendas · Anexo B ou C'));
    assert.ok(p.ditos.some((s) => /art\. 4\.º n\.º 1 n\).*art\. 3\.º n\.º 2 a\)/.test(s)), 'a nota com as duas razões');
  });
});

describe('D135 — o código de uma união de freguesias extinta em 2025', () => {
  test('em 2026 o PDF diz «confirmar» em vez do código; o texto e o CSV levam a falta', async () => {
    imovel({ freguesiaCodigo: '130812' }); contrato();
    rendas(1000);
    const l = app.resumoFiscal(ANO).linhas[0];
    assert.ok(l.freguesiaUniao, 'o resumo marca a união');
    const t = app.fiscoTexto();
    assert.ok(t.includes('freguesia 130812 (a confirmar)'));
    assert.ok(t.includes('Falta: código da freguesia e artigo a confirmar na caderneta predial atual (130812 é o código de uma união de freguesias desagregada em outubro de 2025 (Lei 25-A/2025): o prédio passou para uma destas: 130818 Leça da Palmeira ou 130820 Matosinhos, e o artigo pode ter mudado).'));
    const c = csv().quadros[0];
    assert.equal(c.freguesia, '130812');
    assert.match(c.faltas, /^código da freguesia e artigo a confirmar na caderneta predial atual/);
    assert.equal(c.freguesia_repostas, '130818 Leça da Palmeira / 130820 Matosinhos');
    const b = cartao(await pdf(), 'Arroios · T2 Arroios');
    assert.match(campoDe(b, 'Freguesia (código)'), /^confirmar · 130812 é o código de uma união de freguesias desagregada em outubro de 2025/);
    assert.match(campoDe(b, 'Artigo matricial'), /^4651 · pode ter mudado: confirma na caderneta predial atual/);
  });

  test('confirmado na caderneta, o código fica e diz-se o dia; em 2024 não há marca', async () => {
    imovel({ freguesiaCodigo: '130812', matrizConfirmada: '2026-11-20' }); contrato({ start: '2024-01-01' });
    rendas(1000);
    rendas(1000, M12, {}, 2024);
    const t = app.fiscoTexto();
    assert.ok(t.includes('freguesia 130812 (confirmada na caderneta a 20/11/2026)'));
    assert.ok(!t.includes('a confirmar na caderneta'));
    assert.equal(csv().quadros[0].matriz_confirmada, '2026-11-20');
    const b = cartao(await pdf(), 'Arroios · T2 Arroios');
    assert.equal(campoDe(b, 'Freguesia (código)'), '130812 · confirmado na caderneta predial a 20/11/2026');
    const t24 = app.fiscoTexto(app.resumoFiscal(2024));
    assert.ok(t24.includes('freguesia 130812 · U'), 'nas declarações de 2024 o código da união é o certo');
    assert.equal(csv(2024).quadros[0].freguesia_repostas, '');
  });
});

describe('D137, D112 — as notas do PDF e do texto', () => {
  test('a nota da caderneta atual e a renda do recibo', async () => {
    imovel(); contrato();
    rendas(1000);
    const p = await pdf();
    assert.ok(p.ditos.some((s) => s.includes('caderneta predial atual (Portal das Finanças › Imóveis) ou da nota de cobrança do IMI mais recente') && s.includes('Lei 25-A/2025')), 'D137');
    assert.ok(p.ditos.some((s) => s.startsWith('Rendas ilíquidas: a renda do recibo, antes da retenção, da comissão e de descontos')), 'D112 no PDF');
    assert.ok(app.fiscoTexto().includes('As rendas ilíquidas são a renda do recibo, antes da retenção, da comissão e de descontos.'), 'D112 no texto');
  });

  test('o aviso de que quem declara és tu continua no fim de cada saída', async () => {
    imovel({ pais: 'França', paisCodigo: '250' }); contrato({}, { categoriaB: true });
    rendas(1000);
    assert.ok(app.fiscoTexto().trimEnd().endsWith(app.IRS_AVISO));
    const { rows } = csv();
    assert.equal(rows[rows.length - 1].contrato, app.IRS_AVISO);
    const p = await pdf();
    const fim = p.ditos.lastIndexOf(app.fiscoPdfTxt(app.IRS_AVISO));
    assert.ok(fim > p.ditos.lastIndexOf(app.fiscoPdfTxt(app.FISCO_EXP_CATEGORIA_B_NOTA)), 'o aviso vem depois da categoria B');
  });
});
