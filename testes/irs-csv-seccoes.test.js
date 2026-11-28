// O CSV do Anexo F põe o que não é linha do Anexo F em secções à parte
// (KAN-126-5, comentário do Martinho de 2026-11-26): os avisos de «A tratar»
// vinham colados às linhas dos quadros, sem se perceber que eram outra coisa.
// Agora vêm numa secção própria, depois de uma linha vazia e com um título que
// diz que são avisos, e a estimativa e as notas noutra
// (fisco-exportar.js:fiscoCsvTexto, a tabela em texto). O que se descarrega
// passou a ser a folha de cálculo .xlsx (KAN-126-8, fisco-exportar.js:fiscoXlsx),
// com os nomes do cabeçalho acentuados (fisco-exportar.js:FISCO_CSV_NOMES).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-03-15' });
afterEach(() => repor(app));


/* As células cruas de uma linha do CSV (com as aspas, ou o ="…" de um
   código): o ';' só separa fora das aspas.
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
/* O valor de uma célula crua, sem as aspas nem o ="…".
   Recebe: c — a célula crua.
   Devolve: o valor (string). */
const valor = (c) => c.startsWith('="') ? c.slice(2, -1) : c.startsWith('"') ? c.slice(1, -1).split('""').join('"') : c;

/* uma renda de 2025 do contrato C1, já na base */
const renda = (mes) => app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 800, propertyId: 'v1',
  contractId: 'C1', recibo: true, date: '2025-' + String(mes).padStart(2, '0') + '-05' }));

beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'rui', name: 'Rui' }));
  /* um inquilino sem NIF nem país: a Declaração aponta-o em «A tratar» */
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago' }));
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Lumiar', ownerIds: ['ana'], freguesiaCodigo: '110621', tipoPredio: 'U', matrix: '7000', fraction: 'C' }));
  app.db.contracts.push(app.normContract({ id: 'C1', name: 'Lumiar', propertyId: 'v1', tenantIds: ['t1'], rent: 800, active: true, start: '2024-01-01',
    fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp' } }));
  for (let m = 1; m <= 12; m++) renda(m);
  app.CW = { user: { id: 'ana' }, _esperaFim: true };
  app.fiscoAno = '2025';
  app.fiscoSitAberta = null;
  app.render = () => {};
  app.toast = () => {};
});

describe('KAN-126-5 · o CSV do Anexo F: os avisos numa secção à parte', () => {
  /* a tabela do Anexo F em texto (fisco-exportar.js:fiscoCsvTexto) */
  const csv = () => ({ conteudo: app.fiscoCsvTexto(app.resumoFiscal(app.fiscoAnoAtual())) });

  test('as linhas do quadro, uma vazia, a secção dos avisos, outra vazia e a da estimativa e das notas', () => {
    const r = app.resumoFiscal(2025);
    assert.ok(r.linhas.length === 1 && r.avisos.length > 0, 'controlo: uma linha do quadro e avisos');
    const ls = csv().conteudo.split('\n'), cel = ls.map(cruas), cab = cel[0].map(valor);
    const vazia = cab.map(() => '""').join(';');
    cel.forEach((c, i) => assert.equal(c.length, cab.length, 'a linha ' + i + ' tem as colunas do cabeçalho'));
    const col = (i, k) => valor(cel[i][cab.indexOf(k)]);
    // 1: a linha do contrato, no 4.1
    assert.equal(col(1, 'declarado'), 'sim');
    assert.equal(col(1, 'contrato'), 'Lumiar');
    // 2 e 3: uma linha vazia e o título dos avisos, na primeira coluna, sem mais nada
    assert.equal(ls[2], vazia, 'uma linha vazia separa as linhas do quadro dos avisos');
    assert.equal(col(3, 'ano'), 'AVISOS: o que a app encontrou para tratares antes de entregar. Não são linhas do Anexo F.');
    assert.ok(cel[3].slice(1).every((c) => c === '""'), 'o título vai sozinho na linha');
    // os avisos, todos, pela ordem da página, com o nível
    const n = r.avisos.length;
    assert.deepEqual(cel.slice(4, 4 + n).map((c) => valor(c[1])), Array.from(r.avisos, (a) => 'a tratar (' + app.fiscoNivelNome(a) + ')'));
    assert.deepEqual(cel.slice(4, 4 + n).map((c) => valor(c[2])), Array.from(r.avisos, (a) => a.texto));
    // depois, outra vazia e a secção da estimativa e das notas: o imposto, as regras e o aviso, que fecha o ficheiro
    assert.equal(ls[4 + n], vazia, 'uma linha vazia separa os avisos das notas');
    assert.equal(col(5 + n, 'ano'), 'ESTIMATIVA E NOTAS: o imposto que a app estima, as regras e o aviso. Não são linhas do Anexo F.');
    assert.deepEqual(cel.slice(6 + n).map((c) => valor(c[1])), ['imposto', 'regras', 'aviso']);
    assert.equal(col(ls.length - 1, 'contrato'), app.IRS_AVISO);
    // nenhum «a tratar» fora da secção dele
    assert.equal(cel.filter((c) => /^a tratar/.test(valor(c[1] || ''))).length, n);
  });

  test('sem avisos não há secção dos avisos; sem regras do ano, a secção diz só as notas', () => {
    const r = app.resumoFiscal(2025);
    assert.ok(csv().conteudo.split('\n').some((l) => l.startsWith('"AVISOS')), 'controlo: com avisos, o título deles');
    r.avisos = [];
    const ls = app.fiscoCsvTexto(r).split('\n');
    assert.ok(!ls.some((l) => l.startsWith('"AVISOS')), 'sem avisos, sem o título deles');
    assert.equal(ls[2], ls[0].replace(/"[^"]*"/g, '""'), 'a linha do quadro, uma vazia');
    assert.match(ls[3], /^"ESTIMATIVA E NOTAS: /, 'e logo a estimativa e as notas');
    // 2024 é antes da primeira versão das regras (D50): nem imposto nem reporte, e a secção chama-se «NOTAS»
    const t = app.fiscoCsvTexto(app.resumoFiscal(2024)).split('\n');
    assert.ok(t.some((l) => l.startsWith('"NOTAS: as regras e o aviso. Não são linhas do Anexo F.";""')));
    assert.ok(!t.some((l) => l.startsWith('"ESTIMATIVA')));
    assert.deepEqual(t.slice(-2).map((l) => valor(cruas(l)[1])), ['regras', 'aviso']);
  });

  /* KAN-126-8: a app do Google Sheets no Android lia o CSV como Latin-1 e
     ignorava a marca de ordem de bytes («ï»¿"ano"» na primeira célula); a
     exportação passou a ser a folha de cálculo .xlsx (fisco-exportar.js:fiscoXlsx),
     com o texto em UTF-8 dentro do XML. */
  test('descarrega-se a folha de cálculo .xlsx, com os acentos e o € em UTF-8 lá dentro', async () => {
    let blob = null, nome = '';
    app.descarregarBlob = (b, n) => { blob = b; nome = n; };
    app.fiscoXlsx();
    assert.equal(nome, 'anexo-f-2025.xlsx');
    assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04], 'um zip, sem a marca de ordem de bytes à frente');
    const tudo = new TextDecoder('utf-8').decode(bytes), txt = tudo.slice(tudo.indexOf('<sst'), tudo.indexOf('</sst>'));
    assert.match(txt, /Inquilino Tiago: sem NIF nem país de residência/, 'os acentos inteiros');
    assert.ok(!txt.includes('\ufffd'), 'nenhum carácter de substituição');
  });

  test('o cabeçalho da folha diz «início», «imóvel» e «fração», e cada valor fica debaixo do seu nome', () => {
    const [anexo] = app.fiscoXlsxFolhas(app.resumoFiscal(2025));
    const cab = JSON.parse(JSON.stringify(anexo.linhas[0].map((c) => c && c.v)));
    assert.deepEqual(cab.slice(0, 11), ['ano', 'declarado', 'contrato', 'n_at', 'início', 'imóvel', 'freguesia', 'tipo_predio', 'artigo', 'fração', 'natureza']);
    const l = anexo.linhas[1].map((c) => c && c.v);
    assert.equal(l[cab.indexOf('imóvel')], 'T2 Lumiar');
    assert.equal(l[cab.indexOf('início')], '2024-01-01');
    assert.equal(l[cab.indexOf('fração')], 'C');
    assert.equal(cab.filter((k) => /[^\x20-\x7e]/.test(k)).length, 3, 'só estes três levam acento');
  });
});
