// As saídas da Declaração (o texto, o CSV e o PDF: fisco-exportar.js e
// fisco-pdf.js) e os valores a copiar (formato.js), da ronda 2 das correções
// da segunda auditoria ao IRS:
// - N010: o Anexo J é individual — em conjunta, um por titular, com o total
//   de cada um e sem o total dos dois;
// - N039: o 4.2C no CSV (a coluna e a linha de rodapé) e no texto;
// - N106: a coluna isencao_6d só com o código, nunca o id da app;
// - N107: o NIF e os euros que se copiam, sem espaços nem €;
// - N108: o PDF pela ordem das colunas do impresso (4.1, 4.2 e quadro 5);
// - N110 e N082: o texto do quadro 8 — facultativo, com o 4.3 e o 5, e os
//   gastos que a app não separa;
// - N120: a ressalva dos Açores junto do imposto estimado;
// - N123: o mesmo par de nomes que o KPI («imposto estimado» e «depois dos
//   prejuízos de anos anteriores»);
// - N124: os prejuízos de anos que não estão na app;
// - N125 e N031: a regularização do n.º 20 diz os anos sem rendas na app e
//   os por confirmar, sem as regras desses anos;
// - e a categoria B como o cartão da página: as rendas à parte da caução e
//   os gastos do imóvel que saíram com elas.
//
// Os casos correm de ponta a ponta pelo resumo da app; onde o teste é sobre
// a forma como as saídas leem um campo do resumo, o campo vai à mão.

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
const e2 = (v) => app.euro2(v);
const euro = (v) => app.fiscoPdfEuro(v);
const semTags = (h) => String(h).replace(/<[^>]+>/g, '');
/* Um valor do contexto da app como um de cá (os arrays de lá têm outro protótipo). */
const plano = (x) => JSON.parse(JSON.stringify(x));

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
/* O valor de uma célula crua, sem as aspas e sem o ="…" dos códigos.
   Recebe: c — a célula crua.
   Devolve: o valor (string). */
function valor(c) {
  if (c.startsWith('="')) return c.slice(2, -1);
  if (c.startsWith('"')) return c.slice(1, -1).split('""').join('"');
  return c;
}
/* O CSV do ano, lido: o cabeçalho, as linhas como objetos e as dos quadros.
   Devolve: {cab, rows, quadros}. */
function csv() {
  const ls = app.fiscoCsvTexto(app.resumoFiscal(ANO)).split('\n').map(cruas), cab = ls[0].map(valor);
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
  app.toast = (m) => { out.avisos.push(m); };
  await app.fiscoPdf();
  app.PDF = original;
  assert.ok(out.bytes, 'descarregou o PDF: ' + out.avisos.join(' | '));
  return out;
}
/* Os cartões do PDF: o que tem um título, o valor de um campo, os nomes dos
   campos pela ordem, e o primeiro cartão com um campo.
   Devolvem: o cartão / o valor / os nomes / o cartão. */
const cartao = (p, titulo) => p.cartoes.find((c) => c[0] === titulo);
const campoDe = (c, campo) => { const x = c && c.find((i) => Array.isArray(i) && i[0] === campo); return x && x[1]; };
const nomes = (c) => c.filter((i) => Array.isArray(i)).map((i) => i[0]);
const comCampo = (p, campo) => p.cartoes.find((c) => c.some((i) => Array.isArray(i) && i[0] === campo));
/* Muda o resumo que as saídas leem, depois de o resumoFiscal o fazer (o
   repor do afterEach devolve o de sempre).
   Recebe: fn — recebe o resumo e muda-o.
   Devolve: nada. */
function ajustar(fn) {
  const orig = app.resumoFiscal;
  app.resumoFiscal = function () { const r = orig.apply(this, arguments); fn(r); return r; };
}

const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ propertyId: 'v1' }, extra)));
/* As rendas de um contrato, uma por mês, nos meses dados de um ano.
   Recebe: v — o valor; extra — {contractId, propertyId, ano, meses, ...campos do movimento}.
   Devolve: nada. */
const rendas = (v, extra) => {
  const x = Object.assign({ contractId: 'C1', propertyId: 'v1', ano: ANO, meses: M12 }, extra);
  for (const m of x.meses) {
    const o = Object.assign({}, x, { kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: v, recibo: true, date: `${x.ano}-${mm(m)}-05` });
    delete o.ano; delete o.meses;
    mov(o);
  }
};
const imovel = (extra) => app.db.properties.push(app.normProp(Object.assign({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'],
  freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }, extra)));
const contrato = (extra, fisco) => app.db.contracts.push(app.normContract(Object.assign({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'],
  rent: 1000, start: '2020-01-01', active: true }, extra, { fisco: Object.assign({ estado: 'declarado', numero: '111', finalidade: 'hp' }, fisco) })));
/* A declaração conjunta de 2026: a Ana (A) com o Bruno (B), a sessão da Ana. */
const conjunta = () => {
  app.db.settings.irs = { conjunta: true, titulares: {}, dispensaRecibos: false, outrosRendimentos: {},
    porAno: { [ANO]: { conjunta: true, conjugeId: 'bruno', minhaLetra: 'A' } } };
  app.meuId = () => 'ana';
};

beforeEach(() => {
  limpar(app);
  app.toast = () => {};
  app.fiscoAno = String(ANO);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Jean', pais: 'França' }));
});

describe('N010 · o Anexo J é individual: um por titular, sem o total dos dois', () => {
  const paris = () => {
    imovel({ id: 'v7', name: 'Studio Paris', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, pais: 'França', paisCodigo: '250' });
    contrato({ id: 'CJ', name: 'Paris', propertyId: 'v7', tenantIds: ['t2'], start: '2024-01-01' }, { numero: '', impostoEstrangeiro: { [ANO]: 600 } });
    rendas(1000, { contractId: 'CJ', propertyId: 'v7' });
  };

  test('conjunta, Studio Paris a 50/50: o PDF tem o Anexo J do titular A e o do B, 6 000 € e 300 € cada, e nenhum total conjunto', async () => {
    conjunta(); paris();
    const r = app.resumoFiscal(ANO);
    assert.deepEqual(plano(r.anexoJ.map((e) => [e.titular, e.liquido, e.impostoEstrangeiro])), [['A', 6000, 300], ['B', 6000, 300]]);
    const p = await pdf();
    assert.ok(p.ditos.includes('Anexo J do titular A · imóveis fora de Portugal'), 'a secção do titular A');
    assert.ok(p.ditos.includes('Anexo J do titular B · imóveis fora de Portugal'), 'a secção do titular B');
    const a = cartao(p, 'Paris · Studio Paris · titular A'), b = cartao(p, 'Paris · Studio Paris · titular B');
    assert.ok(a && b, 'cada cartão diz o titular no título');
    for (const c of [a, b]) {
      assert.equal(campoDe(c, 'Rendimento líquido'), euro(6000));
      assert.equal(campoDe(c, 'Imposto pago no estrangeiro'), euro(300));
    }
    assert.ok(!p.cartoes.some((c) => typeof c[0] === 'string' && /^Total do Anexo J/.test(c[0])), 'com uma entrada por titular, nenhum total; e nunca o dos dois');
    assert.ok(p.ditos.some((s) => s.startsWith('O Anexo J é individual: cada titular entrega o seu, com o NIF dele no quadro 3A')), 'a nota diz que cada um entrega o seu');
    assert.ok(!p.ditos.some((s) => /uma linha por imóvel e por titular/.test(s)));
    const tot = comCampo(p, 'Fora do Anexo F · Anexo J do titular A (quadro 7A)');
    assert.match(campoDe(tot, 'Fora do Anexo F · Anexo J do titular A (quadro 7A)'), /^rendas 6 000,00 € · líquido 6 000,00 € · imposto pago lá 300,00 €/);
    assert.ok(campoDe(tot, 'Fora do Anexo F · Anexo J do titular B (quadro 7A)'), 'nos totais, o de cada um');
    assert.equal(campoDe(tot, 'Fora do Anexo F · Anexo J (quadro 7A)'), undefined, 'sem a soma dos dois');
  });

  test('conjunta: o texto tem um bloco por titular e o CSV diz o Anexo J de cada um em anexo_destino', () => {
    conjunta(); paris();
    const t = app.fiscoTexto();
    assert.match(t, /\nANEXO J DO TITULAR A · QUADRO 7A \(imóveis fora de Portugal[^\n]*\n {2}Paris — Studio Paris · quota-parte 50 % · titular A: /);
    assert.match(t, /\nANEXO J DO TITULAR B · QUADRO 7A \(imóveis fora de Portugal[^\n]*\n {2}Paris — Studio Paris · quota-parte 50 % · titular B: /);
    assert.doesNotMatch(t, /\nANEXO J · QUADRO/);
    assert.ok(t.includes('Fora do Anexo F: Anexo J do titular A (quadro 7A) — rendas ' + e2(6000) + ', líquido ' + e2(6000) + ' · Anexo J do titular B (quadro 7A) — rendas ' + e2(6000)));
    assert.ok(t.includes('O Anexo J é individual: cada titular entrega o seu, com o NIF dele no quadro 3A'));
    const js = csv().rows.filter((x) => x.declarado === 'anexo J');
    assert.deepEqual(js.map((x) => [x.titular, x.anexo_destino, x.liquido, x.imposto_estrangeiro]),
      [['A', 'Anexo J do titular A · quadro 7A', '6000,00', '300,00'], ['B', 'Anexo J do titular B · quadro 7A', '6000,00', '300,00']]);
  });

  test('conjunta com dois imóveis da Ana lá fora: o total é o do Anexo J dela, só com as rendas dela', async () => {
    conjunta(); paris();
    imovel({ id: 'v8', name: 'Piso Madrid', ownerIds: ['ana'], pais: 'Espanha', paisCodigo: '724' });
    contrato({ id: 'CM', name: 'Madrid', propertyId: 'v8', tenantIds: ['t2'], rent: 500, start: '2024-01-01' }, { numero: '' });
    rendas(500, { contractId: 'CM', propertyId: 'v8' });
    const p = await pdf();
    const tA = cartao(p, 'Total do Anexo J do titular A');
    assert.ok(tA, 'o total do titular A');
    assert.equal(campoDe(tA, 'Rendimento líquido'), euro(12000), 'os 6 000 € de Paris e os 6 000 € de Madrid');
    assert.equal(campoDe(tA, 'Imposto pago no estrangeiro'), euro(300));
    assert.equal(cartao(p, 'Total do Anexo J do titular B'), undefined, 'o B só tem uma entrada');
    assert.equal(cartao(p, 'Total do Anexo J'), undefined, 'nunca o dos dois');
    assert.ok(app.fiscoTexto().includes('  Total do Anexo J do titular A: rendas ' + e2(12000) + ' · gastos ' + e2(0) + ' · líquido ' + e2(12000) + ' · imposto pago no estrangeiro ' + e2(300)));
  });

  test('em separado, o Anexo J é o teu: «Anexo J», sem titular, como sempre', async () => {
    imovel({ pais: 'França', paisCodigo: '250' });
    contrato({ tenantIds: ['t2'] }, { impostoEstrangeiro: { [ANO]: 300 } });
    rendas(1000);
    const p = await pdf();
    assert.ok(p.ditos.includes('Anexo J · imóveis fora de Portugal'));
    assert.ok(!p.ditos.some((s) => s.startsWith('O Anexo J é individual')), 'a frase só em conjunta');
    assert.equal(csv().rows.find((x) => x.declarado === 'anexo J').anexo_destino, 'Anexo J · quadro 7A');
  });
});

describe('N039 · o 4.2C no CSV e no texto, como no PDF', () => {
  const benfica = (fisco) => {
    imovel();
    contrato({ id: 'L1', name: 'Benfica longo', rent: 900, start: '2024-03-01', end: '2034-02-28' },
      Object.assign({ numero: '333', celebracao: '2024-02-15', comunicacoes: { 2024: '2025-02-10' }, comunicacoesV: 2 }, fisco));
    rendas(900, { contractId: 'L1' });
  };

  test('um 4.2 celebrado em 2024 com a renda confirmada dentro do limite: a coluna diz «sim», o rodapé e o texto dizem «Sim (01)»', () => {
    benfica({ rendaAcimaDoLimite: false });
    const r = app.resumoFiscal(ANO);
    assert.equal(r.linhas[0].quadro, '4.2');
    const c = csv(), l = c.quadros.find((x) => x.contrato === 'Benfica longo');
    assert.equal(c.cab[c.cab.length - 4], 'limite_n23_4_2c', 'a coluna nova vai no fim');
    assert.equal(l.limite_n23_4_2c, 'sim');
    const q = c.rows.find((x) => x.declarado === 'quadro 4.2C');
    assert.ok(q, 'a linha de rodapé do 4.2C');
    assert.equal(q.quadro, '4.2C');
    assert.equal(q.limite_n23_4_2c, 'sim');
    assert.match(q.contrato, /cumprem o n\.º 23 do art\. 72\.º do CIRS\? Celebrados desde 01\/01\/2024: Benfica longo · resposta Sim \(01\)\./);
    const t = app.fiscoTexto();
    assert.match(t, /\nQUADRO 4\.2C · LIMITE DAS RENDAS \(n\.º 23 do art\. 72\.º\)\n {2}Celebrados desde 01\/01\/2024: Benfica longo · resposta Sim \(01\)\n {2}O 4\.2C pergunta se nenhum destes contratos passa 150 % dos limites de renda/);
  });

  test('por confirmar: «por confirmar» na coluna, e o rodapé e o texto nomeiam o contrato', async () => {
    benfica({});
    const c = csv();
    assert.equal(c.quadros.find((x) => x.contrato === 'Benfica longo').limite_n23_4_2c, 'por confirmar');
    const q = c.rows.find((x) => x.declarado === 'quadro 4.2C');
    assert.equal(q.limite_n23_4_2c, 'por confirmar');
    assert.match(q.contrato, /falta confirmar na ficha do contrato: Benfica longo/);
    assert.match(q.faltas, /Benfica longo/);
    assert.match(app.fiscoTexto(), /QUADRO 4\.2C[^\n]*\n {2}Celebrados desde 01\/01\/2024: Benfica longo · falta confirmar na ficha do contrato: Benfica longo\n[^\n]*Confirmados todos, a resposta é «Sim» \(01\)\./);
    const p = await pdf(), k = cartao(p, 'Quadro 4.2C · limite das rendas (n.º 23)');
    assert.equal(campoDe(k, 'Resposta'), 'falta confirmar na ficha do contrato: Benfica longo', 'o PDF diz o mesmo');
  });

  test('um 4.2 celebrado antes de 2024 não leva o 4.2C: a coluna fica vazia e não há rodapé', () => {
    imovel();
    contrato({ id: 'L0', name: 'Lumiar', rent: 800, start: '2021-01-11', end: '2031-01-10' },
      { numero: '444', celebracao: '2021-01-05', comunicacoes: { 2021: '2021-12-20' }, comunicacoesV: 2 });
    rendas(800, { contractId: 'L0' });
    const c = csv();
    assert.equal(c.quadros[0].quadro, '4.2');
    assert.equal(c.quadros[0].limite_n23_4_2c, '');
    assert.equal(c.rows.find((x) => x.declarado === 'quadro 4.2C'), undefined);
    assert.doesNotMatch(app.fiscoTexto(), /QUADRO 4\.2C/);
  });
});

describe('N106 · a coluna isencao_6d só com o código', () => {
  test('um contrato RSAA de 2026 (o código do 6D por conhecer): a coluna vazia, nunca «rsaa», e o porquê nas faltas', () => {
    imovel();
    contrato({ name: 'RSAA', rent: 700, start: '2026-09-01', end: '2029-08-31' }, { isencao: 'rsaa', celebracao: '2026-09-01', ihru: '2026-12-01' });
    rendas(700, { meses: [9, 10, 11, 12] });
    const r = app.resumoFiscal(ANO);
    assert.ok(r.linhas[0].isencao && !r.linhas[0].isencao.codigo, 'o cenário: isento, sem código');
    const l = csv().quadros[0];
    assert.equal(l.isencao_6d, '');
    assert.notEqual(l.isencao_6d, 'rsaa');
    assert.equal(l.isencao_quadro, '6D');
    assert.match(l.faltas, /código do quadro 6D: do modelo novo, por conhecer/);
    assert.match(app.fiscoTexto(), /isento \(quadro 6D, código do modelo novo, por conhecer\)/);
  });
});

describe('N107 · os valores a copiar', () => {
  test('o NIF copia-se com os nove algarismos seguidos, e os euros sem milhares nem €', () => {
    assert.equal(app.nifCopia('123 456 789'), '123456789');
    assert.equal(app.nifCopia(123456789), '123456789');
    assert.equal(app.nifCopia(' 12345 '), '12345', 'o que não tem nove algarismos fica como foi escrito, aparado');
    assert.equal(app.nifCopia(''), '');
    assert.equal(app.euroCopia(18750), '18750,00');
    assert.equal(app.euroCopia(1234567.5), '1234567,50');
    assert.equal(app.euroCopia(-50.5), '-50,50', 'o hífen-menos de teclado');
    assert.equal(app.euroCopia('lixo'), '0,00');
  });

  test('fmtCopiavel: lê-se com o formato da app e o que se copia são os algarismos e a vírgula', () => {
    const h = app.fmtCopiavel(app.euro2(18750));
    assert.equal(semTags(h), '18750,00', 'o texto que se copia');
    assert.match(h, /^<span class="cp-eur">18<span class="cp-g">750<\/span>,00<\/span>$/, 'os separadores e o € pelo CSS');
    assert.equal(semTags(app.fmtCopiavel(app.euro2(1234567.5))), '1234567,50');
    assert.equal((app.fmtCopiavel(app.euro2(1234567.5)).match(/cp-g/g) || []).length, 2);
    assert.equal(semTags(app.fmtCopiavel(app.euro(1251))), '1251', 'sem cêntimos');
    assert.equal(semTags(app.fmtCopiavel(app.euro2(-50))), '-50,00');
    assert.equal(semTags(app.fmtCopiavel(app.euro2(0))), '0,00');
    assert.equal(semTags(app.fmtCopiavel(app.fmtNIF('123456789'))), '123456789', 'o NIF');
    assert.equal(app.fmtCopiavel(app.fmtNIF('123456789')), '123<span class="cp-g">456</span><span class="cp-g">789</span>');
    assert.equal(app.fmtCopiavel('<b>a & b</b>'), '&lt;b&gt;a &amp; b&lt;/b&gt;', 'o resto vai escapado');
    assert.equal(app.fmtCopiavel(null), '');
    assert.equal(app.fmtCopiavel('12 500,00 €'), '12 500,00 €', 'um espaço normal não é o do money: fica como está');
  });

  test('no PDF o NIF do inquilino vai sem espaços (no PDF o que se vê é o que se copia)', async () => {
    imovel(); contrato(); rendas(1000);
    const p = await pdf();
    assert.equal(campoDe(cartao(p, 'Arroios · T2 Arroios'), 'Inquilino'), 'Tiago · NIF 123456789');
    assert.ok(!p.ditos.concat(p.cartoes.flat(2)).some((s) => typeof s === 'string' && s.includes('123 456 789')));
  });
});

describe('N108 · o PDF pela ordem das colunas do impresso', () => {
  test('a linha do 4.1: o n.º, o início, a matriz, o titular, as rendas, a natureza, as retenções, o NIF, os gastos; a taxa e a estimativa no fim', async () => {
    imovel(); contrato(); rendas(1000);
    mov({ kind: 'expense', category: 'Condomínio', amount: 300, date: '2026-04-10' });
    const p = await pdf(), ns = nomes(cartao(p, 'Arroios · T2 Arroios'));
    const i = (n) => { const k = ns.indexOf(n); assert.ok(k > -1, 'falta o campo ' + n + ' em ' + ns.join(' | ')); return k; };
    const ordem = ['Campo', 'N.º do contrato na AT', 'Início do contrato', 'Freguesia (código)', 'Tipo de prédio', 'Artigo matricial', 'Fração', 'Titular',
      'Rendas ilíquidas', 'Natureza', 'Retenções na fonte', 'Inquilino', 'Condomínio', 'Taxa', 'Estimativa da app'];
    const pos = ordem.map(i);
    assert.deepEqual(pos.slice().sort((a, b) => a - b), pos, 'pela ordem do impresso: ' + ns.join(' | '));
    assert.equal(ns[i('Taxa') + 1], 'Estimativa da app', 'a taxa logo antes da estimativa');
  });

  test('a linha do 4.2: o 4.2A depois dos gastos, e a taxa depois dele', async () => {
    imovel();
    contrato({ id: 'L1', name: 'Benfica longo', rent: 900, start: '2024-03-01', end: '2034-02-28' },
      { numero: '333', celebracao: '2024-02-15', comunicacoes: { 2024: '2025-02-10' }, comunicacoesV: 2, rendaAcimaDoLimite: false });
    rendas(900, { contractId: 'L1' });
    const p = await pdf(), ns = nomes(cartao(p, 'Benfica longo · T2 Arroios'));
    assert.equal(ns.indexOf('Início do contrato'), -1, 'no 4.2 a data de início é do 4.2A');
    assert.ok(ns.indexOf('Titular') < ns.indexOf('Rendas ilíquidas') && ns.indexOf('Rendas ilíquidas') < ns.indexOf('Natureza') && ns.indexOf('Natureza') < ns.indexOf('Inquilino'));
    assert.ok(ns.indexOf('4.2A · comunicação') > ns.indexOf('Inquilino') && ns.indexOf('Taxa') > ns.indexOf('4.2A · comunicação'));
  });

  test('o quadro 5: o titular primeiro, a renda paga e o NIF do senhorio no fim', async () => {
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 } }); contrato({ rent: 900 });
    rendas(900);
    const p = await pdf(), ns = nomes(comCampo(p, 'Renda paga ao senhorio'));
    const ordem = ['Titular', 'N.º do contrato na AT', 'Data de início', 'Renda recebida', 'Natureza', 'Retenções na fonte', 'Atualização da renda superior a 1,02?', 'Sublocatário', 'Renda paga ao senhorio', 'NIF do senhorio'];
    assert.deepEqual(plano(ns.slice(0, ordem.length)), ordem, 'pela ordem do impresso: ' + ns.join(' | '));
    assert.equal(campoDe(comCampo(p, 'Renda paga ao senhorio'), 'NIF do senhorio'), '123456789');
  });
});

describe('N110 e N082 · o texto do quadro 8', () => {
  test('é facultativo, diz que se pode deixar em branco, aceita o 4.1, 4.2, 4.3 ou 5 e diz que a app não separa os gastos', () => {
    imovel(); contrato(); rendas(1000);
    ajustar((r) => { r.linhas[0].anosAnteriores = [{ ano: 2025, valor: 1000, retencoes: 0 }]; });
    const t = app.fiscoQuadro8Texto(app.resumoFiscal(ANO));
    assert.match(t, /^Estas rendas já estão nas rendas da linha e pagam imposto este ano/);
    assert.match(t, /O quadro 8 é facultativo: só o preenches se quiseres o regime do artigo 74\.º do CIRS — o 8A se optares pelo englobamento/);
    assert.match(t, /Se não, deixa-o em branco\./);
    assert.match(t, /leva o campo do 4\.1, 4\.2, 4\.3 ou 5 de onde a renda é/);
    assert.match(t, /esses gastos soma-os tu: a app não os separa/);
    assert.doesNotMatch(t, /4\.1 ou do 4\.2/);
    assert.ok(app.fiscoTexto().includes('QUADRO 8 · RENDAS DE ANOS ANTERIORES (facultativo)'));
  });

  test('com os gastos de cada ano no resumo, a frase dos gastos que a app não separa sai', () => {
    imovel(); contrato(); rendas(1000);
    ajustar((r) => { r.linhas[0].anosAnteriores = [{ ano: 2025, valor: 1000, retencoes: 0, gastos: 50 }]; });
    assert.doesNotMatch(app.fiscoQuadro8Texto(app.resumoFiscal(ANO)), /a app não os separa/);
  });

  test('de ponta a ponta: a renda de dezembro recebida em janeiro dá o quadro 8 facultativo no texto e no PDF', async () => {
    imovel(); contrato();
    rendas(1000, { meses: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', recibo: true, date: '2026-01-05', periodo: '2025-12' });
    const r = app.resumoFiscal(ANO);
    assert.deepEqual(plano(r.linhas[0].anosAnteriores.map((a) => [a.ano, a.valor])), [[2025, 1000]], 'o cenário');
    const p = await pdf();
    assert.ok(p.ditos.includes('recebidas em 2026 · já estão nas rendas de cada linha · facultativo'));
    assert.ok(p.ditos.some((s) => /O quadro 8 é facultativo/.test(s) && /deixa-o em branco/.test(s)), 'o mesmo texto no PDF');
    assert.equal(campoDe(comCampo(p, 'Arroios · de 2025'), 'Arroios · de 2025'), euro(1000) + ' · quadro 4.1, campo ' + r.linhas[0].campo);
  });

  test('as rendas de anos anteriores do quadro 5 também vão ao quadro 8', async () => {
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 } }); contrato({ rent: 900 });
    rendas(900);
    ajustar((r) => { r.quadro5[0].anosAnteriores = [{ ano: 2025, valor: 900, retencoes: 225 }]; });
    const t = app.fiscoTexto();
    assert.ok(t.includes('QUADRO 8 · RENDAS DE ANOS ANTERIORES (facultativo)\n  Arroios — T2 Arroios · respeitam a 2025: ' + e2(900) + ' · quadro 5 · retenções ' + e2(225) + '\n'));
    const p = await pdf();
    assert.equal(campoDe(comCampo(p, 'Arroios · de 2025'), 'Arroios · de 2025'), euro(900) + ' · quadro 5');
    assert.equal(campoDe(comCampo(p, 'Arroios · de 2025'), 'Arroios · de 2025 · retenções'), euro(225));
    const q5 = csv().rows.find((x) => x.declarado === 'quadro 5');
    assert.equal(q5.anos_anteriores, '2025:900,00');
    assert.equal(q5.anos_anteriores_retencoes, '2025:225,00');
  });
});

describe('N120, N123 e N124 · o imposto estimado nas saídas', () => {
  test('N120: a ressalva dos Açores junto do imposto estimado, no texto, no CSV e no PDF', async () => {
    imovel(); contrato(); rendas(1000);
    const ress = 'taxas do continente; nos Açores a AT aplica menos 30 %';
    assert.ok(app.fiscoTexto().includes('(sem englobamento) — ' + ress));
    assert.ok(csv().rows.find((x) => x.declarado === 'imposto').contrato.includes('Estimativa sem englobamento, com as ' + ress + '.'));
    const p = await pdf();
    assert.match(campoDe(comCampo(p, 'Imposto estimado'), 'Imposto estimado'), / · sem englobamento · taxas do continente; nos Açores a AT aplica menos 30 %$/);
  });

  test('N120: sem as regras do ano não há imposto, nem a ressalva', () => {
    app.fiscoAno = '2023';
    imovel(); contrato(); rendas(1000, { ano: 2023 });
    assert.doesNotMatch(app.fiscoTexto(app.resumoFiscal(2023)), /Açores/);
  });

  test('N123: «imposto estimado» é o das linhas; o de depois é «depois dos prejuízos de anos anteriores», no texto, no CSV e no PDF', async () => {
    imovel(); contrato(); rendas(1000);
    ajustar((r) => {
      r.reporte = { porTitular: { ana: { usado: 2000, resto: 0 } }, usado: 2000, imposto: 500, anosSemDados: [] };
      r.totais.impostoDepoisDoReporte = Math.max(0, Math.round((r.totais.imposto - 500) * 100) / 100);
    });
    const r = app.resumoFiscal(ANO), depois = r.totais.impostoDepoisDoReporte;
    const t = app.fiscoTexto();
    assert.ok(t.includes('o imposto desce ' + e2(500) + ': depois dos prejuízos de anos anteriores, ' + e2(depois) + '.'));
    assert.doesNotMatch(t, /o imposto estimado desce|e fica em/);
    assert.ok(t.includes('imposto estimado ' + e2(r.totais.imposto) + ' → depois dos prejuízos de anos anteriores ' + e2(depois)));
    const rep = csv().rows.find((x) => x.declarado === 'reporte');
    assert.doesNotMatch(rep.contrato, /o imposto estimado desce/);
    const p = await pdf(), tot = comCampo(p, 'Imposto estimado');
    assert.match(campoDe(tot, 'Imposto estimado'), new RegExp('^' + euro(r.totais.imposto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' · sem englobamento'));
    assert.match(campoDe(tot, 'Depois dos prejuízos de anos anteriores'), new RegExp('^' + euro(depois).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(!p.ditos.some((s) => /o imposto estimado desce/.test(s)));
  });

  test('N124: sem abate e com anos da janela sem dados, o texto, o CSV e o PDF dizem que esses prejuízos não entram', async () => {
    imovel(); contrato({ start: '2025-01-01' }); rendas(1000);
    const frase = 'Prejuízos de anos que não estão na app (de 2019 a 2024) não entram nesta estimativa; a AT abate-os na liquidação.';
    ajustar((r) => { r.reporte = { porTitular: {}, usado: 0, imposto: 0, anosSemDados: [2019, 2020, 2021, 2022, 2023, 2024] }; });
    assert.ok(app.resumoFiscal(ANO).totais.imposto > 0, 'há imposto');
    assert.ok(app.fiscoTexto().includes('\n' + frase + '\n'));
    assert.ok(csv().rows.find((x) => x.declarado === 'imposto').contrato.endsWith(frase));
    const p = await pdf();
    assert.ok(p.ditos.includes(frase), 'nas notas do PDF');
  });

  test('N124: com abate, a frase do reporte já diz os anos sem registos; sem anos sem dados, nada', () => {
    imovel(); contrato({ start: '2025-01-01' }); rendas(1000);
    ajustar((r) => { r.reporte = { porTitular: { ana: { usado: 500, resto: 0 } }, usado: 500, imposto: 125, anosSemDados: [2021, 2023] }; });
    const t = app.fiscoTexto();
    assert.doesNotMatch(t, /Prejuízos de anos que não estão na app/);
    assert.match(t, /anos sem registos \(de 2021 e 2023\)/);
    assert.equal(app.fiscoExpAnos([2024, 2019, 2020, 2021, 2022, 2023, 2024]), 'de 2019 a 2024');
    assert.equal(app.fiscoExpAnos([2020]), 'de 2020');
    assert.equal(app.fiscoExpAnos([2019, 2021, 2023]), 'de 2019, 2021 e 2023');
    assert.equal(app.fiscoExpAnos([]), '');
  });
});

describe('a categoria B nas saídas diz o mesmo que o cartão da página', () => {
  test('as rendas contadas à parte da caução e os gastos que saíram com elas, no texto, no CSV e no PDF', async () => {
    imovel(); contrato({}, { categoriaB: true }); rendas(800);
    ajustar((r) => { Object.assign(r.categoriaB[0], { n: 13, nCaucao: 1, caucao: 800, rendas: 10400, gastos: 600, gastosTotal: 600, gastosColunas: { condominio: 600 } }); });
    const t = app.fiscoTexto();
    assert.ok(t.includes('  Arroios — T2 Arroios: ' + e2(10400) + ' (12 rendas e a caução) · gastos do imóvel que saíram com estas rendas ' + e2(600) + ' · rendas menos gastos ' + e2(9800)));
    assert.match(t, /as rendas menos estes gastos \(CIRS art\. 31\.º n\.º 4\)/);
    const b = csv().rows.find((x) => x.declarado === 'categoria B');
    assert.deepEqual([b.caucao, b.gastos_total, b.liquido], ['800,00', '600,00', '9800,00']);
    const p = await pdf();
    assert.match(campoDe(comCampo(p, 'Arroios · T2 Arroios'), 'Arroios · T2 Arroios'), /^10 400,00 € · 12 rendas e a caução · gastos 600,00 € · rendas menos gastos 9 800,00 € · Anexo B ou C$/);
  });
});

describe('N125 e N031 · a regularização do n.º 20 diz os anos que faltam e os por confirmar', () => {
  /* 10 anos desde 2020 (14 %), rendas na app de 2022 a junho de 2026, cessado
     pelo senhorio a 30/06/2026 (motivo 01): 78 meses decorridos, 23 % */
  const c03 = () => {
    imovel();
    contrato({ name: 'C1', rent: 3000, start: '2020-01-01', end: '2029-12-31' }, { numero: '1234567' });
    [2022, 2023, 2024, 2025].forEach((a) => rendas(3000, { ano: a }));
    rendas(3000, { meses: [1, 2, 3, 4, 5, 6] });
    app.ctTerminar('C1', '2026-06-30', '01');
  };

  test('de ponta a ponta: o texto, o CSV e o PDF dizem 2020 e 2021 em falta e 2022 a 2024 por confirmar', async () => {
    c03();
    const g = app.resumoFiscal(ANO).regularizacoes[0];
    assert.deepEqual(plano(g.anosEmFalta), [2020, 2021], 'o cenário: os anos sem rendas na app');
    const t = app.fiscoTexto();
    assert.match(t, /\n {4}Regularização: diferença estimada de [^\n]*Faltam os anos de 2020 a 2021, de que a app não tem rendas: a diferença deles também se regulariza/);
    const c = csv(), q = c.rows.find((x) => x.declarado === 'quadro 10');
    assert.equal(q.regularizacao_anos_em_falta, '2020 2021');
    assert.match(q.faltas, /regularização: faltam os anos de 2020 a 2021/);
    const p = await pdf();
    assert.match(campoDe(comCampo(p, 'Regularização (art. 72.º n.º 20)'), 'Regularização (art. 72.º n.º 20)'), /Faltam os anos de 2020 a 2021, de que a app não tem rendas/);
  });

  test('os anos sem regras ficam por confirmar, com a diferença das regras de 2025, fora da soma, nas três saídas', async () => {
    c03();
    ajustar((r) => {
      r.regularizacoes = [{ contratoId: 'C1', nome: 'C1', desde: '2020-01-01', anos: [{ ano: 2025, diferenca: 3240 }], total: 3240,
        porConfirmar: [{ ano: 2022, diferenca: 3240 }, { ano: 2023, diferenca: 3240 }, { ano: 2024, diferenca: 3240 }], totalPorConfirmar: 9720,
        anosSemRegras: [2022, 2023, 2024], anosEmFalta: [2020, 2021] }];
      r.totais.regularizacao = 3240;
    });
    const t = app.fiscoTexto();
    assert.ok(t.includes('por confirmar, de 2022 a 2024 (2022: ' + e2(3240) + '; 2023: ' + e2(3240) + '; 2024: ' + e2(3240) + ', com as regras de 2025): a app não tem as regras desses anos, e a diferença deles fica fora da estimativa'));
    assert.ok(t.includes('(+' + e2(3240) + ', estimativa sem juros e sem os anos em falta ou por confirmar)'));
    const q = csv().rows.find((x) => x.declarado === 'quadro 10');
    assert.equal(q.regularizacao_estimada, '3240,00', 'só os anos com regras');
    assert.equal(q.regularizacao_anos_por_confirmar, '2022 2023 2024');
    assert.equal(q.regularizacao_por_confirmar, '9720,00');
    const p = await pdf();
    assert.match(campoDe(comCampo(p, 'Regularização (art. 72.º n.º 20)'), 'Regularização (art. 72.º n.º 20)'), /; por confirmar, de 2022 a 2024 \(2022: 3 240,00 €; 2023: 3 240,00 €; 2024: 3 240,00 €, com as regras de 2025\)/);
    assert.match(campoDe(comCampo(p, 'Imposto estimado'), 'Com a regularização do quadro 10'), /sem os anos em falta ou por confirmar: vê o quadro 10\)$/);
  });

  test('sem diferença estimada (só anos por confirmar), a regularização diz-se na mesma', async () => {
    c03();
    ajustar((r) => {
      r.regularizacoes = [{ contratoId: 'C1', nome: 'C1', desde: '2023-01-01', anos: [], total: 0,
        porConfirmar: [{ ano: 2023, diferenca: 300 }, { ano: 2024, diferenca: 360 }], totalPorConfirmar: 660, anosSemRegras: [2023, 2024], anosEmFalta: [] }];
      r.totais.regularizacao = 0;
    });
    const t = app.fiscoTexto();
    assert.ok(t.includes('    Regularização (art. 72.º n.º 20, sem diferença estimada): por confirmar, de 2023 a 2024 (2023: ' + e2(300) + '; 2024: ' + e2(360) + ', com as regras de 2025)'));
    const q = csv().rows.find((x) => x.declarado === 'quadro 10');
    assert.equal(q.regularizacao_estimada, '');
    assert.equal(q.regularizacao_por_confirmar, '660,00');
    const p = await pdf();
    assert.match(campoDe(comCampo(p, 'Regularização (art. 72.º n.º 20)'), 'Regularização (art. 72.º n.º 20)'), /com juros compensatórios\. Por confirmar, de 2023 a 2024/);
  });

  test('um resumo sem os campos novos não diz nada a mais', () => {
    c03();
    ajustar((r) => { r.regularizacoes = [{ contratoId: 'C1', nome: 'C1', anos: [{ ano: 2025, diferenca: 3240 }], total: 3240 }]; r.totais.regularizacao = 3240; });
    const t = app.fiscoTexto(), q10 = t.slice(t.indexOf('QUADRO 10'), t.indexOf('A TRATAR'));
    assert.ok(q10.includes('Regularização: diferença estimada de ' + e2(3240)), 'o quadro 10 do texto');
    assert.doesNotMatch(q10, /Faltam os anos|por confirmar, de/, 'só os avisos de «A tratar», que o resumo fez, os podem dizer');
    assert.ok(t.includes('(+' + e2(3240) + ', estimativa sem juros)'));
  });
});
