// As saídas da Declaração (o texto, o CSV e o PDF: fisco-exportar.js e
// fisco-pdf.js) no quadro 10 e no 4.2A, da segunda auditoria ao IRS:
// - N008: cada linha do quadro 10 leva a identificação matricial (freguesia,
//   tipo, artigo, fração), o titular e o NIF do inquilino (ou o país), pela
//   ordem do impresso, uma por titular em conjunta;
// - N009: o ano de início do benefício que a app não sabe ao certo diz
//   «a confirmar», e porquê;
// - N040: um ano só com o quadro 10 (ou só com a regularização) dá o PDF;
// - N003: a comunicação da duração migrada do modelo antigo, por confirmar,
//   sai «a confirmar» no 4.2A, e não NÃO.
//
// Os campos novos que o resumo põe em r.cessados (os das linhas do 4.x, e a
// marca do ano a confirmar) e a marca das comunicações por confirmar vão à
// mão com a forma combinada, onde o teste é sobre a forma como as saídas os
// leem; onde a app já os dá (o contrato que acabou no início do ano, a ficha
// do imóvel e do inquilino), o caminho é o de ponta a ponta.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-23' });
if (typeof app.fiscoPdf !== 'function') {
  const f = new URL('../web/app/fisco-pdf.js', import.meta.url);
  vm.runInContext(fs.readFileSync(f, 'utf8'), app.__ctx, { filename: f.href });
}

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
/* O valor de uma célula crua: sem as aspas e o código sem o ="…".
   Recebe: c — a célula crua.
   Devolve: o valor (string). */
function valor(c) {
  if (c.startsWith('="')) return c.slice(2, -1);
  if (c.startsWith('"')) return c.slice(1, -1).split('""').join('"');
  return c;
}
/* O CSV do ano da página, lido: o cabeçalho, as linhas como objetos pelo
   nome da coluna e as cruas.
   Devolve: {cab, rows, cruas}. */
function csv() {
  const ls = app.fiscoCsvTexto(app.resumoFiscal(app.fiscoAnoAtual())).split('\n').map(cruas), cab = ls[0].map(valor);
  return { cab, cruas: ls, rows: ls.slice(1).map((c) => Object.fromEntries(cab.map((k, i) => [k, valor(c[i])]))) };
}
/* Muda o resumo que as saídas leem, depois de o resumoFiscal o fazer (o
   repor do afterEach devolve o de sempre).
   Recebe: fn — recebe o resumo e muda-o.
   Devolve: nada. */
function ajustar(fn) {
  const orig = app.resumoFiscal;
  app.resumoFiscal = function () { const r = orig.apply(this, arguments); fn(r); return r; };
}
/* O que o PDF recebe para escrever: os textos soltos e os cartões campo →
   valor (com o estilo de cada campo), lidos à entrada do escritor; e os
   avisos (toast).
   Devolve: {ditos, cartoes, estilos, bytes, avisos}. */
function lerPdf() {
  const out = { ditos: [], cartoes: [], bytes: null, avisos: [] };
  const original = app.PDF;
  app.PDF = function () {
    const pdf = original.apply(this, arguments);
    for (const k of Object.keys(pdf)) {
      if (typeof pdf[k] !== 'function') continue;
      const f = pdf[k];
      pdf[k] = function () {
        for (const a of arguments) {
          if (typeof a === 'string') out.ditos.push(a);
          else if (k === 'cartao' && a && Array.isArray(a.itens)) out.cartoes.push(a.itens.map((x) => (x.texto != null ? x.texto : [x.campo, x.valor, !!x.forte])));
        }
        return f.apply(this, arguments);
      };
    }
    return pdf;
  };
  app.downloadBytes = (nome, mime, bytes) => { out.bytes = bytes; };
  app.toast = (m) => { out.avisos.push(m); };
  return out;
}
/* O PDF do ano da página, lido; falha se não descarregou.
   Devolve: o lerPdf depois do fiscoPdf. */
async function pdf() {
  const p = lerPdf();
  await app.fiscoPdf();
  assert.ok(p.bytes, 'descarregou o PDF: ' + p.avisos.join(' | '));
  return p;
}
/* Os cartões do PDF com um título; o valor de um campo num cartão; os nomes
   dos campos de um cartão, pela ordem.
   Devolvem: os cartões / o valor / os nomes. */
const cartoes = (p, titulo) => p.cartoes.filter((c) => c[0] === titulo);
const campoDe = (c, campo) => { const x = c && c.find((i) => Array.isArray(i) && i[0] === campo); return x && x[1]; };
const forte = (c, campo) => { const x = c && c.find((i) => Array.isArray(i) && i[0] === campo); return !!(x && x[2]); };
const nomes = (c) => Array.from(c.filter((i) => Array.isArray(i)), (i) => i[0]);

const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ propertyId: 'v1' }, extra)));
/* As rendas de um contrato, uma por mês, nos meses dados de um ano.
   Recebe: contractId; v — o valor; ano; meses (opcional, 1..12).
   Devolve: nada. */
const rendas = (contractId, v, ano, meses) => {
  for (const i of meses || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    mov({ kind: 'income', category: 'Rendas', amount: v, contractId, recibo: true, date: `${ano}-${String(i).padStart(2, '0')}-05` });
  }
};
/* O contrato do Lumiar no 4.2 (11/01/2021 a 10/01/2026), que acabou no
   termo, com as rendas só de 2025.
   Recebe: extra — campos do contrato; fisco — campos do bloco fiscal.
   Devolve: o contrato (já na base). */
const lumiar = (extra, fisco) => {
  const c = app.normContract(Object.assign({ id: 'C1', name: 'Lumiar', propertyId: 'v1', tenantIds: ['t1'], rent: 800, start: '2021-01-11', end: '2026-01-10', active: false },
    extra, { fisco: Object.assign({ estado: 'declarado', numero: '444', finalidade: 'hp', celebracao: '2021-01-05', rendaAcimaDoLimite: false,
      comunicacoes: { 2021: '2021-12-20' }, comunicacoesV: 2, cessacao: { data: '2026-01-10', motivo: '03' } }, fisco) }));
  app.db.contracts.push(c);
  return c;
};

beforeEach(() => {
  limpar(app);
  app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'rui', name: 'Rui' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Lucía', pais: 'Espanha' }));
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Lumiar', ownerIds: ['ana'], freguesiaCodigo: '110621', tipoPredio: 'U', matrix: '7000', fraction: 'C' }));
});
afterEach(() => repor(app));

describe('N040: um ano só com o quadro 10 dá o PDF', () => {
  test('o contrato do 4.2 que acabou a 10/01/2026, sem rendas em 2026: o PDF sai com o quadro 10', async () => {
    app.fiscoAno = '2026';
    lumiar();
    rendas('C1', 800, 2025);
    const r = app.resumoFiscal(2026);
    assert.equal(r.linhas.length, 0, 'nenhuma renda em 2026');
    assert.equal(r.cessados.length, 1, 'mas o contrato acabou em 2026');
    const p = await pdf();
    assert.ok(p.ditos.includes('Quadro 10 · contratos que acabaram'), 'o quadro 10 vai no PDF');
    const b = cartoes(p, 'Lumiar · T2 Lumiar').at(-1);
    assert.equal(campoDe(b, 'Data da cessação'), '10/01/2026');
    assert.ok(p.ditos.some((s) => /^Sem rendas em 2026 nos quadros/.test(s)), 'e diz porque é que o Anexo F deste ano leva o quadro 10');
    assert.equal(p.ditos.lastIndexOf(app.IRS_AVISO) >= 0, true, 'acaba no aviso');
  });

  test('um ano só com a regularização (sem linhas nem cessados à vista) também dá o PDF', async () => {
    app.fiscoAno = '2026';
    lumiar();
    ajustar((r) => { r.cessados = []; r.regularizacoes = [{ contratoId: 'C1', nome: 'Lumiar', anos: [{ ano: 2025, diferenca: 300 }], total: 300 }]; r.totais.regularizacao = 300; });
    const p = await pdf();
    assert.ok(p.cartoes.some((c) => campoDe(c, 'Com a regularização do quadro 10')), 'a regularização nos totais');
  });

  test('sem nada no ano, continua sem PDF e diz porquê', async () => {
    app.fiscoAno = '2019';
    const p = lerPdf();
    await app.fiscoPdf();
    assert.equal(p.bytes, null);
    assert.equal(p.avisos.length, 1);
    assert.match(p.avisos[0], /^Sem rendas a declarar em 2019/);
  });
});

describe('N008: o quadro 10 com a matriz, o titular e o NIF do inquilino', () => {
  test('de ponta a ponta: a linha «quadro 10» do CSV, o texto e o cartão do PDF levam a matriz, o titular e o NIF, pela ordem do impresso', async () => {
    app.fiscoAno = '2026';
    lumiar();
    rendas('C1', 800, 2025);
    const c = csv(), q = c.rows.filter((x) => x.declarado === 'quadro 10');
    assert.equal(q.length, 1);
    assert.deepEqual([q[0].freguesia, q[0].tipo_predio, q[0].artigo, q[0]['fração'], q[0].titular, q[0].inquilinos, q[0].nif_ou_pais, q[0].nif, q[0].pais],
      ['110621', 'U', '7000', 'C', 'A', 'Tiago', '123456789', '123456789', '']);
    const i = c.rows.indexOf(q[0]);
    assert.equal(c.cruas[i + 1][c.cab.indexOf('freguesia')], '="110621"', 'o código da freguesia como código');
    c.cruas.forEach((ls, k) => assert.equal(ls.length, c.cab.length, 'a linha ' + k + ' tem as colunas do cabeçalho'));
    const t = app.fiscoTexto();
    assert.match(t, /\n {2}Lumiar — T2 Lumiar: regime 02 [^\n]*motivo 03[^\n]*\n {4}Freguesia 110621 · U · artigo 7000 · fração C · titular A · inquilinos: Tiago \(NIF 123456789\)/);
    const p = await pdf(), b = cartoes(p, 'Lumiar · T2 Lumiar').at(-1);
    assert.deepEqual(nomes(b).slice(0, 11), ['Regime fiscal', 'N.º do contrato na AT', 'Ano de início do benefício', 'Data da cessação', 'Motivo da cessação',
      'Freguesia (código)', 'Tipo de prédio', 'Artigo matricial', 'Fração', 'Titular', 'Inquilino'], 'a ordem do impresso');
    assert.equal(campoDe(b, 'Freguesia (código)'), '110621');
    assert.equal(campoDe(b, 'Artigo matricial'), '7000');
    assert.equal(campoDe(b, 'Titular'), 'A');
    assert.equal(campoDe(b, 'Inquilino'), 'Tiago · NIF 123456789', 'o NIF que se copia, sem espaços (N107)');
  });

  test('lê os campos que o resumo põe em cada entrada (os das linhas do 4.x), com o país de um inquilino de fora e o que falta', async () => {
    app.fiscoAno = '2026';
    lumiar();
    ajustar((r) => {
      r.cessados = [{ contratoId: 'C1', nome: 'Lumiar', imovel: 'T2 Lumiar', regime: '02', numero: '444', anoInicioBeneficio: 2021, data: '2026-01-10', motivo: '03',
        propertyId: 'v1', titularId: 'ana', titular: 'A', freguesiaCodigo: '110658', tipoPredio: 'U', artigo: '', fracao: '',
        inquilinos: [{ nome: 'Lucía', nif: '', pais: 'Espanha' }] }];
    });
    const q = csv().rows.find((x) => x.declarado === 'quadro 10');
    assert.deepEqual([q.freguesia, q.artigo, q.titular, q.inquilinos, q.nif_ou_pais, q.nif, q.pais], ['110658', '', 'A', 'Lucía', 'Espanha', '', 'Espanha'],
      'os do resumo, e não os da ficha');
    assert.match(q.faltas, /artigo matricial/, 'o artigo que falta é uma falta');
    assert.match(app.fiscoTexto(), /Freguesia 110658 · U · artigo — · titular A · inquilinos: Lucía \(NIF português — · país Espanha/);
    const b = cartoes(await pdf(), 'Lumiar · T2 Lumiar').at(-1);
    assert.equal(campoDe(b, 'Artigo matricial'), 'falta');
    assert.equal(campoDe(b, 'NIF português'), '—');
    assert.match(campoDe(b, 'País'), /^Espanha/);
  });

  test('em conjunta, um contrato do imóvel dos dois dá uma linha por titular (A e B), no CSV, no texto e no PDF', async () => {
    app.fiscoAno = '2026';
    lumiar();
    const base = { contratoId: 'C1', nome: 'Lumiar', imovel: 'T2 Lumiar', regime: '02', numero: '444', anoInicioBeneficio: 2021, data: '2026-01-10', motivo: '03',
      propertyId: 'v1', freguesiaCodigo: '110621', tipoPredio: 'U', artigo: '7000', fracao: 'C', inquilinos: [{ nome: 'Tiago', nif: '123456789', pais: '' }] };
    ajustar((r) => {
      r.variosTitulares = true;
      r.cessados = [Object.assign({}, base, { titularId: 'ana', titular: 'A' }), Object.assign({}, base, { titularId: 'rui', titular: 'B' })];
    });
    const q = csv().rows.filter((x) => x.declarado === 'quadro 10');
    assert.deepEqual(q.map((x) => x.titular), ['A', 'B']);
    const t = app.fiscoTexto();
    assert.match(t, /titular A · inquilinos: Tiago/);
    assert.match(t, /titular B · inquilinos: Tiago/);
    const p = await pdf();
    assert.equal(campoDe(cartoes(p, 'Lumiar · T2 Lumiar · titular A').at(-1), 'Titular'), 'A');
    assert.equal(campoDe(cartoes(p, 'Lumiar · T2 Lumiar · titular B').at(-1), 'Titular'), 'B');
  });
});

describe('N009: o ano de início do benefício que a app não sabe diz «a confirmar»', () => {
  const comAnoAConfirmar = () => ajustar((r) => {
    r.cessados = [{ contratoId: 'C1', nome: 'Lumiar', imovel: 'T2 Lumiar', regime: '02', numero: '444', anoInicioBeneficio: 2021, data: '2026-01-10', motivo: '03',
      propertyId: 'v1', titularId: 'ana', titular: 'A', freguesiaCodigo: '110621', tipoPredio: 'U', artigo: '7000', fracao: 'C',
      inquilinos: [{ nome: 'Tiago', nif: '123456789', pais: '' }],
      anoInicioConfirmar: true, anoInicioPorque: 'o contrato começou em 2021 e a app só tem rendas dele desde 2025: confirma o ano da primeira declaração com a redução' }];
  });

  test('o texto, o CSV e o PDF dizem «a confirmar» e porquê, com o ano sugerido', async () => {
    app.fiscoAno = '2026';
    lumiar();
    comAnoAConfirmar();
    const t = app.fiscoTexto();
    assert.match(t, /benefício desde 2021 \(a confirmar\)/);
    assert.match(t, /Falta: [^\n]*ano de início do benefício a confirmar \(o contrato começou em 2021 e a app só tem rendas dele desde 2025: confirma o ano da primeira declaração com a redução\)/);
    const q = csv().rows.find((x) => x.declarado === 'quadro 10');
    assert.equal(q.cessacao_ano_beneficio, '2021', 'o ano sugerido fica na coluna de sempre');
    assert.match(q.faltas, /ano de início do benefício a confirmar \(o contrato começou em 2021/);
    const b = cartoes(await pdf(), 'Lumiar · T2 Lumiar').at(-1);
    assert.equal(campoDe(b, 'Ano de início do benefício'),
      '2021 · a confirmar (o contrato começou em 2021 e a app só tem rendas dele desde 2025: confirma o ano da primeira declaração com a redução)');
    assert.ok(forte(b, 'Ano de início do benefício'), 'a forte, como o que falta');
  });

  test('de ponta a ponta: um contrato de 2021 com as rendas na app só desde 2025, sem a comunicação do período, não dá o ano como certo', async () => {
    app.fiscoAno = '2026';
    lumiar({}, { comunicacoes: {} });
    rendas('C1', 800, 2025);
    const x = app.resumoFiscal(2026).cessados[0];
    const t = app.fiscoTexto();
    assert.ok(t.includes('benefício desde ' + x.anoInicioBeneficio + ' (a confirmar)'), 'o ano do resumo, a confirmar');
    assert.match(csv().rows.find((r) => r.declarado === 'quadro 10').faltas, /ano de início do benefício a confirmar/);
    assert.match(campoDe(cartoes(await pdf(), 'Lumiar · T2 Lumiar').at(-1), 'Ano de início do benefício'), new RegExp('^' + x.anoInicioBeneficio + ' · a confirmar \\('));
  });

  test('sem a marca do resumo, um contrato que começou antes do ano dado fica a confirmar, como no cartão', () => {
    app.fiscoAno = '2026';
    lumiar();
    ajustar((r) => { r.cessados.forEach((x) => { x.anoInicioBeneficio = 2025; delete x.anoInicioConfirmar; delete x.anoInicioPorque; }); });
    assert.match(app.fiscoTexto(), /benefício desde 2025 \(a confirmar\)[^\n]*\n[^\n]*\n {4}Falta: [^\n]*ano de início do benefício a confirmar \(o contrato começou em 2021, antes do primeiro ano com rendas dele na app\)/);
  });

  test('um ano certo sai como sempre, sem «a confirmar»', async () => {
    app.fiscoAno = '2026';
    lumiar();
    ajustar((r) => { r.cessados.forEach((x) => { x.anoInicioBeneficio = 2021; x.anoInicioConfirmar = false; }); });
    rendas('C1', 800, 2025);
    assert.doesNotMatch(app.fiscoTexto(), /a confirmar/);
    assert.doesNotMatch(csv().rows.find((x) => x.declarado === 'quadro 10').faltas, /a confirmar/);
    assert.equal(campoDe(cartoes(await pdf(), 'Lumiar · T2 Lumiar').at(-1), 'Ano de início do benefício'), '2021');
  });
});

describe('N003: a comunicação migrada por confirmar sai «a confirmar» no 4.2A', () => {
  /* o contrato de 01/06/2021 a 31/05/2026 (23 %, n.º 3) com as rendas de 2025,
     e a marca antiga de 2025 (10/02/2026) por confirmar no período de 2021 */
  const antigo = () => {
    const c = app.normContract({ id: 'C2', name: 'Contrato C1', propertyId: 'v1', tenantIds: ['t1'], rent: 700, start: '2021-06-01', end: '2026-05-31', active: true,
      fisco: { estado: 'declarado', numero: '555', finalidade: 'hp', celebracao: '2021-05-20', rendaAcimaDoLimite: false, comunicacoes: {}, comunicacoesV: 2 } });
    c.fisco.comunicacoesPorConfirmar = { 2021: '2026-02-10' };
    app.db.contracts.push(c);
    rendas('C2', 700, 2025);
    return c;
  };

  test('pela marca do contrato: o texto, o CSV e o PDF dizem «a confirmar», sem afirmar NÃO nem «fora do prazo»', async () => {
    app.fiscoAno = '2025';
    antigo();
    const l = app.resumoFiscal(2025).linhas.find((x) => x.contratoId === 'C2');
    assert.equal(l.quadro, '4.2');
    const t = app.fiscoTexto();
    assert.match(t, /4\.2A[^\n]*: a confirmar — a marca de 10\/02\/2026 vem da app antiga/);
    assert.match(t, /se comunicaste a duração deste período até 15\/02\/2022, no 4\.2A é SIM/);
    assert.doesNotMatch(t, /no 4\.2A é NÃO · início/, 'nem NÃO');
    assert.doesNotMatch(t, /fora do prazo/);
    const q = csv().rows.find((x) => x.contrato === 'Contrato C1' && x.declarado === 'sim');
    assert.equal(q.comunicacao_4_2a_resposta, 'a confirmar');
    assert.equal(q.comunicacao_4_2a, '', 'a data antiga não é o dia da comunicação do período');
    assert.equal(q.comunicacao_4_2a_prazo, '2022-02-15');
    const b = cartoes(await pdf(), 'Contrato C1 · T2 Lumiar').at(-1);
    assert.match(campoDe(b, '4.2A · comunicação'), /^A confirmar \(a marca de 10\/02\/2026 vem da app antiga/);
    assert.ok(forte(b, '4.2A · comunicação'), 'a forte');
  });

  test('de ponta a ponta: a marca anual antiga ({2025: 10/02/2026}) de um contrato de 2021 sai «a confirmar», e não «fora do prazo — NÃO»', async () => {
    app.fiscoAno = '2025';
    app.db.contracts.push(app.normContract({ id: 'C3', name: 'Contrato antigo', propertyId: 'v1', tenantIds: ['t1'], rent: 700, start: '2021-06-01', end: '2026-05-31', active: true,
      fisco: { estado: 'declarado', numero: '556', finalidade: 'hp', celebracao: '2021-05-20', rendaAcimaDoLimite: false, comunicacoes: { 2025: '2026-02-10' } } }));
    rendas('C3', 700, 2025);
    const t = app.fiscoTexto();
    assert.match(t, /4\.2A[^\n]*: a confirmar — a marca de 10\/02\/2026 vem da app antiga[^\n]*até 15\/02\/2022, no 4\.2A é SIM, senão é NÃO · início/);
    assert.doesNotMatch(t, /comunicada fora do prazo/);
    const q = csv().rows.find((x) => x.contrato === 'Contrato antigo' && x.declarado === 'sim');
    assert.deepEqual([q.comunicacao_4_2a, q.comunicacao_4_2a_resposta], ['', 'a confirmar']);
    assert.match(campoDe(cartoes(await pdf(), 'Contrato antigo · T2 Lumiar').at(-1), '4.2A · comunicação'), /^A confirmar /);
  });

  test('pelo l.comunicacao do resumo (porConfirmar e a data antiga)', () => {
    app.fiscoAno = '2025';
    antigo().fisco.comunicacoesPorConfirmar = {};
    ajustar((r) => { r.linhas.find((x) => x.contratoId === 'C2').comunicacao = { periodoInicio: '2021-06-01', chave: '2021', prazo: '2022-02-15', data: '', foraDePrazo: false, porConfirmar: true, dataAntiga: '2026-02-10' }; });
    assert.match(app.fiscoTexto(), /4\.2A[^\n]*: a confirmar — a marca de 10\/02\/2026/);
    assert.equal(csv().rows.find((x) => x.contrato === 'Contrato C1' && x.declarado === 'sim').comunicacao_4_2a_resposta, 'a confirmar');
  });

  test('com o dia confirmado (a data do período escrita), conta o dia, e já não «a confirmar»', () => {
    app.fiscoAno = '2025';
    const c = antigo();
    c.fisco.comunicacoes = { 2021: '2022-02-01' };
    const t = app.fiscoTexto();
    assert.match(t, /4\.2A[^\n]*: comunicada a 01\/02\/2022 · início/);
    assert.equal(csv().rows.find((x) => x.contrato === 'Contrato C1' && x.declarado === 'sim').comunicacao_4_2a_resposta, 'sim');
  });
});
