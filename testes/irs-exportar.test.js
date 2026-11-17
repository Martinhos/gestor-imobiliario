// A exportação da Declaração (auditoria ao IRS, vaga 1, folha 2.1.8): o CSV do
// Anexo F (fisco-exportar.js:fiscoCsv), o texto (fiscoTexto) e o PDF
// (fisco-pdf.js:fiscoPdf), com as células do CSV (copias.js:celulaCsv,
// celulaCodigo, celulaNumero).
//
// Cada defeito tem aqui o seu assert, que falhava antes da folha:
// - D74: os valores com vírgula e duas casas, e os códigos que o Excel não
//   converte em número (="040810", ="07", ="01");
// - D103: nenhuma célula de texto que o Excel leia como fórmula;
// - D34: as rendas sem contrato no CSV (uma linha por imóvel) e no PDF, com o
//   valor, e o PDF sem recusar quando só há essas; «A tratar» no fim do CSV;
// - D59: o NIF português e o país em colunas à parte; o número estrangeiro
//   não vai como NIF;
// - D72, D98: o imposto de uma linha nunca negativo, o prejuízo à parte, e o
//   prejuízo a reportar de cada titular;
// - D97: a condição dos 36 meses do art. 55.º n.º 8;
// - D77: o campo de cada linha (4001…, 4501…) no CSV, no texto e no PDF, e
//   nos subquadros que se ligam a ela (4.2A, 4.2B, 6D, 8, 9);
// - D84: o prazo das declarações de substituição do quadro 8B;
// - D99: o imposto depois do AIMI, e o limite do abate dito como leitura da app;
// - D101: a renda deste contrato e o n.º do anterior do 4.2B;
// - D102: no 4.2 a data de início só no 4.2A;
// - D105: a linha das regras (ano, oficiais ou provisórias, revistas a, a
//   versão da app) no PDF, no CSV e no texto;
// - o aviso do PDF sem o escritor já não fala do serviço Contratos (D57).
//
// Os campos que o resumo da mesma vaga produz (l.campo, l.prejuizo,
// totais.porTitular, fisco-resumo.js, folha 2.1.7) são postos à mão onde o
// teste é sobre a forma como a exportação os lê: a prova de ponta a ponta é
// da integração.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-03-15' });
if (typeof app.fiscoPdf !== 'function') {
  const f = new URL('../web/app/fisco-pdf.js', import.meta.url);
  vm.runInContext(fs.readFileSync(f, 'utf8'), app.__ctx, { filename: f.href });
}
const ANO = 2025;

/* As células cruas de uma linha do CSV, tal como o ficheiro as tem (com as
   aspas, ou o ="…" de um código): o ';' só separa fora das aspas.
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
/* O valor de uma célula crua: sem as aspas (as de dentro desdobradas), e o
   código sem o ="…".
   Recebe: c — a célula crua.
   Devolve: o valor (string). */
function valor(c) {
  if (c.startsWith('="')) return c.slice(2, -1);
  if (c.startsWith('"')) return c.slice(1, -1).split('""').join('"');
  return c;
}
/* O CSV do Anexo F lido: o cabeçalho, as linhas cruas e as linhas como
   objetos pelo nome da coluna (valores), e as dos quadros (sim / por indicar).
   Recebe: csv — o conteúdo entregue ao download.
   Devolve: {cab, cruas, rows, quadros, raw(row, col)}. */
function lerCsv(csv) {
  const ls = csv.split('\n').map(cruas), cab = ls[0].map(valor);
  const rows = ls.slice(1).map((c) => Object.fromEntries(cab.map((k, i) => [k, valor(c[i])])));
  return {
    cab, cruas: ls, rows,
    quadros: rows.filter((x) => x.declarado === 'sim' || x.declarado === 'por indicar'),
    raw: (i, k) => ls[i + 1][cab.indexOf(k)],
  };
}
/* O CSV que o fiscoCsv descarrega.
   Devolve: {nome, mime, conteudo}. */
function csvDescarregado() {
  let g = null;
  app.download = (nome, mime, conteudo) => { g = { nome, mime, conteudo }; };
  app.fiscoCsv();
  assert.ok(g, 'descarregou');
  return g;
}
/* Muda o resumo que as saídas leem, depois de o resumoFiscal o fazer: é o «r
   feito à mão com a forma do contrato» para os campos da folha do resumo.
   Recebe: fn — recebe o resumo e muda-o.
   Devolve: nada (o repor do afterEach devolve o resumoFiscal de sempre). */
function ajustar(fn) {
  const orig = app.resumoFiscal;
  app.resumoFiscal = function () { const r = orig.apply(this, arguments); fn(r); return r; };
}
/* Põe o campo em cada linha pela ordem do quadro (4001… no 4.1, 4501… no
   4.2), como a folha do resumo o faz, sem depender dela.
   Recebe: r — o resumo.
   Devolve: nada. */
function numerar(r) {
  const n = { '4.1': 4000, '4.2': 4500 };
  r.linhas.forEach((l) => { n[l.quadro]++; l.campo = String(n[l.quadro]); });
}
/* O que o PDF recebe para escrever: os textos soltos (títulos, notas, caixas)
   e os cartões campo → valor, lidos à entrada do escritor (contrato-pdf.js:PDF),
   antes de ele partir as linhas.
   Devolve: {ditos, cartoes, bytes} — cartoes é [[título, [campo, valor]…]];
   bytes fica com o PDF depois do fiscoPdf. */
function lerPdf() {
  const out = { ditos: [], cartoes: [], bytes: null };
  const original = app.PDF;
  app.PDF = function () {
    const pdf = original.apply(this, arguments);
    for (const k of Object.keys(pdf)) {
      if (typeof pdf[k] !== 'function') continue;
      const f = pdf[k];
      pdf[k] = function () {
        for (const a of arguments) {
          if (typeof a === 'string') out.ditos.push(a);
          else if (k === 'cartao' && a && Array.isArray(a.itens)) out.cartoes.push(a.itens.map((x) => (x.texto != null ? x.texto : [x.campo, x.valor])));
        }
        return f.apply(this, arguments);
      };
    }
    return pdf;
  };
  app.downloadBytes = (nome, mime, bytes) => { out.bytes = bytes; };
  return out;
}
/* Um cartão do PDF pelo princípio do título.
   Recebe: pdf — o lerPdf; titulo — o princípio do título.
   Devolve: o cartão ([título, [campo, valor]…]) ou undefined. */
const cartao = (pdf, titulo) => pdf.cartoes.find((c) => typeof c[0] === 'string' && c[0].startsWith(titulo));
/* O valor de um campo num cartão.
   Recebe: c — o cartão; campo — o nome do campo.
   Devolve: o valor, ou undefined. */
const campoDe = (c, campo) => { const x = c.find((i) => Array.isArray(i) && i[0] === campo); return x && x[1]; };

const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra)));
const rendas = (contractId, v, propertyId, extra) => {
  for (let i = 1; i <= 12; i++) {
    mov(Object.assign({ kind: 'income', category: 'Rendas', amount: v, contractId, propertyId: propertyId || 'v1', recibo: true, date: `${ANO}-${String(i).padStart(2, '0')}-05` }, extra));
  }
};

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
  // Bragança: a freguesia começa por 0, que o Excel tirava
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Bragança', ownerIds: ['ana'], freguesiaCodigo: '040810', tipoPredio: 'U', matrix: '3850' }));
  app.db.contracts.push(app.normContract({ id: 'C1', name: 'Bragança', propertyId: 'v1', tenantIds: ['t1'], rent: 512.25, start: '2024-02-01', active: true,
    fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }));
  rendas('C1', 512.25);
  mov({ kind: 'expense', category: 'Condomínio', amount: 40.1, date: ANO + '-03-10' });
});
afterEach(() => repor(app));

describe('as células do CSV (copias.js)', () => {
  test('um código vai como ="…" (o Excel não lhe tira os zeros); com outra coisa, vai como texto com a plica', () => {
    assert.equal(app.celulaCodigo('040810'), '="040810"');
    assert.equal(app.celulaCodigo('07'), '="07"');
    assert.equal(app.celulaCodigo('4.1'), '="4.1"', 'o quadro, que o Excel podia ler como data');
    assert.equal(app.celulaCodigo(4001), '="4001"');
    assert.equal(app.celulaCodigo(''), '""');
    assert.equal(app.celulaCodigo(null), '""');
    assert.equal(app.celulaCodigo('=1+1'), '"\'=1+1"', 'um «código» com fórmula vai pelo celulaCsv');
    assert.equal(app.celulaCodigo('1"+"2'), '"1""+""2"', 'nada de aspas dentro do ="…"');
    assert.equal(app.celulaCodigo('abc'), '"abc"');
  });

  test('um valor vai com vírgula decimal e duas casas, o negativo com o sinal e sem a plica', () => {
    assert.equal(app.celulaNumero(6147), '"6147,00"');
    assert.equal(app.celulaNumero(40.1), '"40,10"');
    assert.equal(app.celulaNumero(-6400), '"-6400,00"');
    assert.equal(app.celulaNumero('12.5'), '"12,50"');
    assert.equal(app.celulaNumero(-0.001), '"0,00"', 'sem «-0,00»');
    assert.equal(app.celulaNumero(2, 0), '"2"', 'uma contagem');
    assert.equal(app.celulaNumero(12.5, null), '"12,5"', 'uma percentagem com as casas que tem');
    assert.equal(app.celulaNumero(25, null), '"25"');
    assert.equal(app.celulaNumero(null), '""');
    assert.equal(app.celulaNumero('abc'), '""');
  });

  test('o celulaCsv põe a plica também nos sinais de largura inteira', () => {
    for (const s of ['＝1+1', '＋351', '－2', '＠SUM(A1)']) assert.equal(app.celulaCsv(s), '"\'' + s + '"', s);
    assert.equal(app.celulaCsv(-5), '"-5"', 'um número negativo continua número');
  });
});

describe('o CSV do Anexo F', () => {
  test('D74: os valores com vírgula e duas casas, e os códigos que o Excel lê como texto', () => {
    const { nome, conteudo } = csvDescarregado();
    assert.equal(nome, 'anexo-f-2025.csv');
    const c = lerCsv(conteudo);
    // as colunas que já existiam ficam no mesmo sítio
    assert.deepEqual(c.cab.slice(0, 16), ['ano', 'declarado', 'contrato', 'n_at', 'inicio', 'imovel', 'freguesia', 'tipo_predio', 'artigo', 'fracao', 'natureza', 'inquilinos', 'nif_ou_pais', 'quota_pct', 'rendas_iliquidas', 'retencoes']);
    assert.deepEqual(c.cab.slice(-6), ['campo', 'prejuizo', 'nif', 'pais', 'renda_4_2b', 'n_at_anterior_4_2b'], 'as novas no fim');
    assert.ok(conteudo.includes('"6147,00"'), 'as rendas: 12 × 512,25');
    assert.ok(conteudo.includes('"40,10"'), 'o condomínio');
    assert.equal(c.raw(0, 'freguesia'), '="040810"');
    assert.equal(c.raw(0, 'natureza'), '="07"');
    assert.equal(c.raw(0, 'quadro'), '="4.1"');
    assert.equal(c.raw(0, 'n_at'), '="1234567"');
    assert.equal(c.raw(0, 'rendas_iliquidas'), '"6147,00"');
    assert.equal(c.raw(0, 'condominio'), '"40,10"');
    assert.equal(c.raw(0, 'quota_pct'), '"100"');
    assert.equal(c.raw(0, 'taxa_pct'), '"25"');
    assert.match(c.raw(0, 'liquido'), /^"\d+,\d\d"$/);
  });

  test('D103: nenhuma célula de texto começa por = + - @: os nomes de outra pessoa levam a plica', () => {
    app.db.contracts[0].name = '=1+1';
    app.db.tenants[0].name = '=HYPERLINK("http://x.example","clique")';
    app.db.properties[0].name = '+351 casa';
    app.db.properties[0].fraction = '@A';
    const { conteudo } = csvDescarregado();
    const c = lerCsv(conteudo);
    assert.equal(c.raw(0, 'contrato'), '"\'=1+1"');
    assert.equal(c.raw(0, 'inquilinos'), '"\'=HYPERLINK(""http://x.example"",""clique"")"');
    assert.equal(c.raw(0, 'imovel'), '"\'+351 casa"');
    assert.equal(c.raw(0, 'fracao'), '"\'@A"');
    c.cruas.forEach((ls, i) => ls.forEach((x) => {
      if (x.startsWith('="')) assert.match(x, /^="[0-9A-Z.]*"$/, 'linha ' + i + ': um código só com algarismos, maiúsculas e o ponto');
      else if (/^"-\d+(,\d+)?"$/.test(x)) return;   // um valor negativo
      else assert.doesNotMatch(valor(x), /^[=+\-@\t\r]/, 'linha ' + i + ': ' + x);
    }));
  });

  test('D34: as rendas sem contrato numa linha por imóvel, e no fim «A tratar», as regras e o aviso', () => {
    mov({ kind: 'income', category: 'Rendas', amount: 750, date: ANO + '-11-05' });
    mov({ kind: 'income', category: 'Rendas', amount: 750, date: ANO + '-12-05' });
    const r = app.resumoFiscal(ANO);
    assert.equal(r.semContrato.length, 1);
    const c = lerCsv(csvDescarregado().conteudo);
    const sem = c.rows.filter((x) => x.declarado === 'sem contrato');
    assert.equal(sem.length, 1);
    assert.equal(sem[0].imovel, 'T2 Bragança');
    assert.equal(sem[0].rendas_iliquidas, '1500,00');
    assert.match(sem[0].faltas, /^2 rendas sem contrato ligado: não estão .*declaram-se na mesma$/);
    // a soma das rendas do CSV é a do ano: as do quadro e as sem contrato
    const soma = c.rows.reduce((s, x) => s + (Number(String(x.rendas_iliquidas || '0').replace(',', '.')) || 0), 0);
    assert.equal(Math.round(soma * 100) / 100, 6147 + 1500);
    // o que há a tratar, com o nível, pela ordem da página
    const tratar = c.rows.filter((x) => /^a tratar \((falta|aviso|nota)\)$/.test(x.declarado));
    assert.deepEqual(tratar.map((x) => x.contrato), Array.from(r.avisos, (a) => a.texto));
    assert.ok(tratar.length > 0, 'as rendas sem contrato são um ponto a tratar');
    // e as duas linhas de rodapé, a das regras e a do aviso, por esta ordem, no fim
    const [regras, aviso] = c.rows.slice(-2);
    assert.equal(regras.declarado, 'regras');
    assert.match(regras.contrato, /^Regras de 2025 \(oficiais\)/);
    assert.equal(aviso.declarado, 'aviso');
    assert.equal(aviso.contrato, app.IRS_AVISO);
    c.cruas.forEach((ls, i) => assert.equal(ls.length, c.cab.length, 'a linha ' + i + ' tem as colunas do cabeçalho'));
  });

  test('D59: o NIF português e o país em colunas à parte; um número estrangeiro com o país não vai como NIF', () => {
    app.db.tenants.push(app.normPerson({ id: 't2', name: 'Lucía', nif: 'X1234567L', pais: 'Espanha' }));
    app.db.contracts[0].tenantIds = ['t2'];
    let c = lerCsv(csvDescarregado().conteudo).quadros[0];
    assert.equal(c.nif, '');
    assert.equal(c.pais, 'Espanha');
    assert.equal(c.nif_ou_pais, 'X1234567L', 'a coluna antiga fica como era');
    assert.match(app.fiscoTexto(), /Inquilinos: Lucía \(sem NIF português · país Espanha\)/);
    app.db.contracts[0].tenantIds = ['t1'];
    c = lerCsv(csvDescarregado().conteudo);
    assert.equal(c.quadros[0].nif, '123456789');
    assert.equal(c.raw(0, 'nif'), '="123456789"');
    assert.equal(c.quadros[0].pais, '');
  });

  test('D98: o imposto de uma linha nunca é negativo, e o prejuízo vai na coluna dele; o líquido fica negativo', () => {
    // o resumo antigo (sem o prejuízo da linha) e o novo (com ele) dão o mesmo
    let comPrejuizo = false;
    ajustar((r) => {
      const l = r.linhas[0];
      l.liquido = -6400; l.imposto = -1792;
      if (comPrejuizo) { l.imposto = 0; l.prejuizo = 6400; } else delete l.prejuizo;
    });
    for (comPrejuizo of [false, true]) {
      const c = lerCsv(csvDescarregado().conteudo);
      assert.equal(c.quadros[0].imposto_estimado, '0,00', 'com prejuízo da linha: ' + comPrejuizo);
      assert.equal(c.quadros[0].prejuizo, '6400,00');
      assert.equal(c.raw(0, 'liquido'), '"-6400,00"', 'um número negativo, sem a plica');
    }
  });

  test('D101: o 4.2B com a renda deste contrato e o n.º do contrato anterior', () => {
    app.db.transactions = [];
    app.db.contracts = [
      app.normContract({ id: 'C0', name: 'Antigo', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2020-01-01', end: '2023-12-31', active: false,
        fisco: { estado: 'declarado', numero: '7777', finalidade: 'hp' } }),
      app.normContract({ id: 'C1', name: 'Novo', propertyId: 'v1', tenantIds: ['t1'], rent: 950, start: '2024-01-01', end: '2029-12-31', active: true,
        fisco: { estado: 'declarado', numero: '8888', finalidade: 'hp', rendaAnterior: 1000, celebracao: '2023-12-15', rendaAcimaDoLimite: false } }),
    ];
    rendas('C1', 950);
    const l = app.resumoFiscal(ANO).linhas[0];
    assert.equal(l.bonus, true, 'o cenário tem a descida do n.º 24');
    const c = lerCsv(csvDescarregado().conteudo);
    assert.equal(c.quadros[0].reducao_4_2b, 'sim');
    assert.equal(c.quadros[0].renda_anterior_4_2b, '1000,00');
    assert.equal(c.quadros[0].renda_4_2b, '950,00');
    assert.equal(c.raw(0, 'n_at_anterior_4_2b'), '="7777"');
    assert.match(app.fiscoTexto(), /4\.2B[^\n]*renda deste contrato [^\n]* · contrato anterior n\.º 7777 \(Antigo\) · renda anterior /);
  });
});

describe('o campo de cada linha e os subquadros (D77), e o quadro 8 (D84)', () => {
  beforeEach(() => {
    app.db.tenants.push(app.normPerson({ id: 't2', name: 'Vera', nif: '123456789' }));
    app.db.properties.push(
      app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['ana'], freguesiaCodigo: '110601', tipoPredio: 'U', matrix: '77' }),
      app.normProp({ id: 'v3', name: 'T0 Graça', ownerIds: ['ana'], freguesiaCodigo: '110610', tipoPredio: 'U', matrix: '12' }));
    app.db.contracts.push(
      app.normContract({ id: 'L1', name: 'Benfica longo', propertyId: 'v2', tenantIds: ['t2'], rent: 900, start: '2024-03-01', end: '2034-02-28', active: true,
        fisco: { estado: 'declarado', numero: '333', finalidade: 'hp', celebracao: '2024-02-15', rendaAcimaDoLimite: false } }),
      app.normContract({ id: 'I1', name: 'Graça PAA', propertyId: 'v3', tenantIds: ['t1'], rent: 500, start: '2024-01-01', active: true,
        fisco: { estado: 'declarado', numero: '222', finalidade: 'hp', isencao: 'paa' } }));
    rendas('L1', 900, 'v2');
    rendas('I1', 500, 'v3');
    // uma renda de dezembro de 2024 recebida em janeiro de 2025: quadro 8
    mov({ kind: 'income', category: 'Rendas', amount: 512.25, contractId: 'C1', recibo: true, date: ANO + '-01-20', periodo: '2024-12' });
    ajustar(numerar);
  });

  test('o CSV leva o campo de cada linha, como código', () => {
    const r = app.resumoFiscal(ANO);
    const c = lerCsv(csvDescarregado().conteudo);
    assert.deepEqual(c.quadros.map((x) => x.quadro + ' ' + x.campo), Array.from(r.linhas, (l) => l.quadro + ' ' + l.campo));
    assert.ok(c.quadros.some((x) => x.campo === '4501'));
    const i = c.quadros.findIndex((x) => x.contrato === 'Graça PAA');
    assert.equal(c.raw(i, 'isencao_6d'), '="01"', 'o código da isenção com o zero');
    assert.equal(c.raw(i, 'campo'), '="' + r.linhas[i].campo + '"');
  });

  test('o texto diz o campo de cada entrada, a ordem, e o campo no 4.2A; e o prazo do 8B', () => {
    const t = app.fiscoTexto();
    assert.match(t, /POR CONTRATO \(preenche por esta ordem/);
    assert.match(t, /\n {2}Campo 4001 · \[4\.1\] n\.º /);
    assert.match(t, /\n {2}Campo 4501 · \[4\.2\] n\.º 333 · Benfica longo/);
    assert.match(t, /4\.2A \(campo 4501\): /);
    // D84: as substituições até 30 dias depois do fim do prazo da entrega de 2025 (30/06/2026)
    assert.match(t, /QUADRO 8 · RENDAS DE ANOS ANTERIORES\n {2}No 8A [^\n]*no 8B [^\n]*até 30\/07\/2026 \(30 dias depois do fim do prazo da entrega\)/);
  });

  test('o PDF leva o campo em cada linha e nos subquadros, e o prazo do 8B', async () => {
    const pdf = lerPdf();
    await app.fiscoPdf();
    assert.ok(pdf.bytes, 'descarregou');
    const r = app.resumoFiscal(ANO), campo = (id) => r.linhas.find((l) => l.contratoId === id).campo;
    const c1 = cartao(pdf, 'Bragança'), l1 = cartao(pdf, 'Benfica longo'), d6 = cartao(pdf, 'Graça PAA'), i1 = pdf.cartoes.filter((x) => x[0] === 'Graça PAA · T0 Graça');
    assert.equal(campoDe(c1, 'Campo'), campo('C1'));
    assert.equal(campoDe(l1, 'Campo'), campo('L1'));
    assert.equal(campoDe(l1, '4.2A · campo do quadro 4.2'), campo('L1'));
    assert.equal(i1.length, 2, 'o isento no 4.1 e no 6D');
    assert.equal(campoDe(i1[1], 'Campo do quadro 4.1'), campo('I1'), 'o 6D diz o campo do 4.1');
    assert.ok(d6);
    const q8 = pdf.cartoes.find((x) => x.some((i) => Array.isArray(i) && i[0] === 'Bragança · de 2024'));
    assert.equal(campoDe(q8, 'Bragança · de 2024'), app.fiscoPdfEuro(512.25) + ' · quadro 4.1, campo ' + campo('C1'));
    assert.ok(pdf.ditos.some((s) => s.includes('até 30/07/2026 (30 dias depois do fim do prazo da entrega)')), 'D84 no PDF');
    assert.ok(pdf.ditos.some((s) => /preenche por esta ordem/.test(s)), 'a ordem no título do quadro');
  });
});

describe('o PDF do Anexo F', () => {
  test('D34: com rendas sem contrato, o PDF diz o valor; só com elas, faz o PDF em vez de recusar', async () => {
    mov({ kind: 'income', category: 'Rendas', amount: 750, date: ANO + '-11-05' });
    mov({ kind: 'income', category: 'Rendas', amount: 750, date: ANO + '-12-05' });
    let pdf = lerPdf();
    await app.fiscoPdf();
    const sc = pdf.cartoes.find((x) => x.some((i) => Array.isArray(i) && i[0] === 'T2 Bragança'));
    assert.ok(sc, 'o cartão das rendas sem contrato');
    assert.equal(campoDe(sc, 'T2 Bragança'), app.fiscoPdfEuro(1500) + ' · 2 rendas');
    assert.ok(pdf.ditos.includes('Rendas sem contrato ligado'));
    // só rendas sem contrato: o PDF faz-se, com elas
    app.db.transactions = app.db.transactions.filter((t) => !t.contractId);
    const ditos = [];
    app.toast = (m) => ditos.push(m);
    pdf = lerPdf();
    await app.fiscoPdf();
    assert.ok(pdf.bytes, 'não recusou');
    assert.deepEqual(ditos, ['PDF exportado.']);
    assert.ok(pdf.cartoes.some((x) => x.some((i) => Array.isArray(i) && i[0] === 'T2 Bragança' && i[1] === app.fiscoPdfEuro(1500) + ' · 2 rendas')));
  });

  test('D98, D72, D97: a linha com prejuízo, o prejuízo a reportar de cada titular e os 36 meses', async () => {
    ajustar((r) => {
      r.variosTitulares = true;
      const a = r.linhas[0];
      a.titularId = 'ana'; a.titular = 'A';
      const b = JSON.parse(JSON.stringify(a));
      b.titularId = 'bruno'; b.titular = 'B'; b.nome = 'Loja'; b.liquido = -6400; b.imposto = -1792; b.prejuizo = 6400;
      r.linhas.push(b);
      r.totais.porTitular = { ana: { liquido: a.liquido, imposto: a.imposto, prejuizo: 0 }, bruno: { liquido: -6400, imposto: 0, prejuizo: 6400 } };
    });
    const pdf = lerPdf();
    await app.fiscoPdf();
    const loja = cartao(pdf, 'Loja');
    assert.equal(campoDe(loja, 'Estimativa da app'), 'líquido ' + app.fiscoPdfEuro(-6400) + ' · imposto estimado ' + app.fiscoPdfEuro(0) + ' (não vai ao quadro)', 'o imposto da linha nunca negativo');
    assert.match(campoDe(loja, 'Resultado negativo'), new RegExp('^' + app.fiscoPdfEuro(6400) + ' · abate às rendas das outras linhas do mesmo titular'));
    const tot = pdf.cartoes.find((x) => x.some((i) => Array.isArray(i) && i[0] === 'Imposto estimado'));
    assert.equal(campoDe(tot, 'Prejuízo a reportar · titular B'), app.fiscoPdfEuro(6400));
    assert.equal(campoDe(tot, 'Prejuízo a reportar · titular A'), undefined, 'a A não tem prejuízo');
    assert.ok(pdf.ditos.some((s) => /pelo menos 36 meses nos cinco anos seguintes \(CIRS art\. 55\.º n\.º 8\); a AT faz a conta, titular a titular/.test(s)), 'D97');
    const t = app.fiscoTexto();
    assert.ok(t.includes('Prejuízo a reportar do titular B ' + app.euro2(6400) + '. Não se perde:'), 'no texto');
    assert.match(t, /36 meses/);
    assert.ok(t.includes('Resultado negativo ' + app.euro2(6400) + ' · imposto estimado ' + app.euro2(0) + ': abate às rendas das outras linhas do mesmo titular'), 'a linha do texto');
  });

  test('D99: com o AIMI a abater, o imposto depois dele; e o limite do abate dito como leitura da app', async () => {
    app.db.properties[0].vpt = 100000;
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, date: ANO + '-09-10' });
    const r = app.resumoFiscal(ANO);
    assert.ok(r.aimi && r.aimi.abate > 0, 'o AIMI abate');
    const pdf = lerPdf();
    await app.fiscoPdf();
    const tot = pdf.cartoes.find((x) => x.some((i) => Array.isArray(i) && i[0] === 'Imposto estimado'));
    const depois = Math.round((r.totais.imposto - r.aimi.abate) * 100) / 100;
    assert.equal(campoDe(tot, 'Depois do AIMI (quadro 9)'), app.fiscoPdfEuro(depois) + ' · abate ' + app.fiscoPdfEuro(r.aimi.abate) + ' (estimativa)');
    const nota = pdf.ditos.find((s) => s.startsWith('O AIMI não é gasto das rendas'));
    assert.doesNotMatch(nota, /nunca mais do que o imposto delas/);
    assert.match(nota, /A app limita o abate ao imposto estimado das rendas; a lei fala da coleta à taxa de 28 %/);
    assert.ok(app.fiscoTexto().includes('imposto depois do AIMI ' + app.euro2(depois)));
  });

  test('D102: no 4.2 a data de início não está nos campos da linha (está no 4.2A); no 4.1 está', async () => {
    app.db.properties.push(app.normProp({ id: 'v2', name: 'T1', ownerIds: ['ana'], freguesiaCodigo: '110601', tipoPredio: 'U', matrix: '77' }));
    app.db.contracts.push(app.normContract({ id: 'L1', name: 'Longo', propertyId: 'v2', tenantIds: ['t1'], rent: 900, start: '2024-03-01', end: '2034-02-28', active: true,
      fisco: { estado: 'declarado', numero: '333', finalidade: 'hp', celebracao: '2024-02-15', rendaAcimaDoLimite: false } }));
    rendas('L1', 900, 'v2');
    assert.equal(app.resumoFiscal(ANO).linhas.find((l) => l.contratoId === 'L1').quadro, '4.2');
    const pdf = lerPdf();
    await app.fiscoPdf();
    const l1 = cartao(pdf, 'Longo'), c1 = cartao(pdf, 'Bragança');
    assert.equal(campoDe(l1, 'Início do contrato'), undefined);
    assert.equal(campoDe(l1, '4.2A · início'), '01/03/2024');
    assert.equal(campoDe(c1, 'Início do contrato'), '01/02/2024');
  });

  test('D105: o PDF, o CSV e o texto dizem as regras, oficiais ou provisórias, quando foram revistas e a versão da app', async () => {
    app.VERSAO = 77;
    const v = app.irsAno(ANO);
    const linha = 'Regras de 2025 (oficiais), revistas a ' + app.dPT(v.revisto) + ' · versão da app 77';
    assert.equal(app.fiscoRegrasTexto(app.resumoFiscal(ANO)), linha);
    const pdf = lerPdf();
    await app.fiscoPdf();
    assert.ok(pdf.ditos.includes(linha + '.'), 'no cabeçalho do PDF');
    assert.equal(lerCsv(csvDescarregado().conteudo).rows.find((x) => x.declarado === 'regras').contrato, linha);
    assert.equal(app.fiscoTexto().split('\n')[1], linha);
    // o ano seguinte: provisórias, se a versão o for; e um ano sem versão diz de onde vêm
    const v26 = app.irsAno(2026);
    assert.equal(app.fiscoRegrasTexto({ ano: 2026, versao: v26 }),
      'Regras de 2026 (' + (v26.modelo.oficial ? 'oficiais' : 'provisórias') + ')' + (v26.revisto ? ', revistas a ' + app.dPT(v26.revisto) : '') + ' · versão da app 77');
    assert.equal(app.fiscoRegrasTexto({ ano: 2031, versao: app.irsAno(2031) }), 'Ainda sem regras de 2031: usam-se as de ' + app.irsAno(2031).ano + ' · versão da app 77');
    // sem a versão da app (o avisos.js não carregou), sem ela
    app.VERSAO = undefined;
    assert.equal(app.fiscoRegrasTexto(app.resumoFiscal(ANO)), 'Regras de 2025 (oficiais), revistas a ' + app.dPT(v.revisto));
  });

  test('sem o escritor, pede que se recarregue — a Declaração requer os Contratos, não se fala do serviço desligado', async () => {
    app.PDF = undefined;
    app.servicoLigado = (id) => id !== 'contracts';
    const ditos = [];
    let baixou = false;
    app.toast = (m) => ditos.push(m);
    app.downloadBytes = () => { baixou = true; };
    await app.fiscoPdf();
    assert.equal(baixou, false);
    assert.deepEqual(ditos, ['Não foi possível preparar o PDF. Recarrega a página e tenta outra vez.']);
  });

  test('o aviso aprovado fecha o PDF, o texto e o CSV', async () => {
    const pdf = lerPdf();
    await app.fiscoPdf();
    assert.ok(pdf.ditos.includes(app.IRS_AVISO), 'a caixa do fim');
    assert.ok(app.fiscoTexto().trimEnd().endsWith(app.IRS_AVISO));
    assert.ok(csvDescarregado().conteudo.endsWith(';"' + app.IRS_AVISO + '"' + ';""'.repeat(lerCsv(csvDescarregado().conteudo).cab.length - 3)));
  });
});
