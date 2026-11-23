// A exportação dos contratos da Declaração (auditoria ao IRS, vaga 2, folha
// 2.2.12): o texto (fisco-exportar.js:fiscoTexto), o CSV (fiscoCsvTexto) e o
// PDF (fisco-pdf.js:fiscoPdf) dizem o mesmo que os cartões da página.
//
// Cada defeito tem aqui o seu assert, que falhava antes da folha:
// - D01: a comunicação do 4.2A é uma por período (o prazo do período, e não o
//   15 de fevereiro do ano dos rendimentos), com a resposta e o prazo no CSV;
// - D35: comunicada depois do prazo é «Não» no 4.2A;
// - D09: o quadro 10 (os contratos que acabaram), com o regime, o n.º, o ano
//   do benefício, a data e o motivo, e o que falta;
// - D10: a regularização do motivo 01, estimada e sem juros;
// - D36, D37: o 4.2B sempre que o contrato o tem, mesmo sem a taxa descer, e
//   a renda que a app comparou;
// - D41, D15: a taxa de cada período quando muda no ano, e a base depois do
//   termo sem renovação registada;
// - D55: as retenções de cada ano anterior, e um movimento por ano;
// - D18: o 6F e o 6H como o 6D, com o campo do 4.1 e sem código;
// - D49: no modelo provisório, o campo da taxa de 10 % (e o código que falta)
//   por conhecer;
// - D50: sem regras do ano, sem taxa nem imposto;
// - D78: o 4.2C com os limites da versão do ano;
// - D16: a natureza 07 assumida; D17: a taxa escrita no contrato é uma nota;
// - o abate dos prejuízos de anos anteriores e o imposto depois dele
//   (r.reporte, totais.impostoDepoisDoReporte), no texto, no CSV e no PDF.
//
// Os campos que o resumo da mesma vaga produz (l.comunicacao, l.segmentos,
// l.elegivel24, l.anosAnteriores[].retencoes, r.cessados, r.regularizacoes,
// r.semRegrasDoAno, r.reporte, totais.impostoDepoisDoReporte) são postos à
// mão com a forma do contrato onde o teste é sobre a forma como a exportação
// os lê; onde o motor da app já os dá (a comunicação pelo período, o n.º 24,
// a versão emprestada), o caminho é o de ponta a ponta.

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
/* O CSV do ano da página, lido: o cabeçalho, as linhas como objetos pelo
   nome da coluna, as cruas, e as dos quadros (sim / por indicar).
   Devolve: {cab, rows, cruas, quadros, raw(i, col)} — raw a célula crua da
   linha i dos quadros. */
function csv() {
  const ls = app.fiscoCsvTexto(app.resumoFiscal(app.fiscoAnoAtual())).split('\n').map(cruas), cab = ls[0].map(valor);
  const rows = ls.slice(1).map((c) => Object.fromEntries(cab.map((k, i) => [k, valor(c[i])])));
  const qi = rows.map((x, i) => (x.declarado === 'sim' || x.declarado === 'por indicar' ? i : -1)).filter((i) => i >= 0);
  return { cab, rows, cruas: ls, quadros: qi.map((i) => rows[i]), raw: (i, k) => ls[qi[i] + 1][cab.indexOf(k)] };
}
/* Muda o resumo que as saídas leem, depois de o resumoFiscal o fazer: o «r
   feito à mão com a forma do contrato» (o repor do afterEach devolve o de
   sempre).
   Recebe: fn — recebe o resumo e muda-o.
   Devolve: nada. */
function ajustar(fn) {
  const orig = app.resumoFiscal;
  app.resumoFiscal = function () { const r = orig.apply(this, arguments); fn(r); return r; };
}
/* O que o PDF recebe para escrever: os textos soltos (títulos, notas, caixas)
   e os cartões campo → valor, lidos à entrada do escritor.
   Devolve: {ditos, cartoes, bytes}. */
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
/* O PDF do ano da página, lido.
   Devolve: o lerPdf depois do fiscoPdf. */
async function pdf() {
  const p = lerPdf();
  await app.fiscoPdf();
  assert.ok(p.bytes, 'descarregou o PDF');
  return p;
}
/* Um cartão do PDF pelo princípio do título; o valor de um campo nele; o
   cartão que tem um campo.
   Devolvem: o cartão / o valor / o cartão (ou undefined). */
const cartao = (p, titulo) => p.cartoes.find((c) => typeof c[0] === 'string' && c[0].startsWith(titulo));
const campoDe = (c, campo) => { const x = c && c.find((i) => Array.isArray(i) && i[0] === campo); return x && x[1]; };
const comCampo = (p, campo) => p.cartoes.find((c) => c.some((i) => Array.isArray(i) && i[0] === campo));
const euro = (v) => app.fiscoPdfEuro(v);

const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra)));
/* As rendas de um contrato, uma por mês, nos meses dados do ano.
   Recebe: contractId; v — o valor; ano; meses (opcional, 1..12).
   Devolve: nada. */
const rendas = (contractId, v, ano, meses) => {
  for (const i of meses || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    mov({ kind: 'income', category: 'Rendas', amount: v, contractId, recibo: true, date: `${ano || ANO}-${String(i).padStart(2, '0')}-05` });
  }
};
/* O contrato longo do 4.2 (2024-03-01 a 2034-02-28), com o que se lhe muda.
   Recebe: extra — campos do contrato; fisco — campos do bloco fiscal.
   Devolve: o contrato (já na base). */
const longo = (extra, fisco) => {
  const c = app.normContract(Object.assign({ id: 'L1', name: 'Benfica longo', propertyId: 'v1', tenantIds: ['t1'], rent: 900, start: '2024-03-01', end: '2034-02-28', active: true },
    extra, { fisco: Object.assign({ estado: 'declarado', numero: '333', finalidade: 'hp', celebracao: '2024-02-15', rendaAcimaDoLimite: false, comunicacoes: { 2024: '2025-02-10' } }, fisco) }));
  app.db.contracts.push(c);
  return c;
};
const linhaDe = (r, id) => r.linhas.find((l) => l.contratoId === id);

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Bragança', ownerIds: ['ana'], freguesiaCodigo: '040810', tipoPredio: 'U', matrix: '3850' }));
});
afterEach(() => repor(app));

describe('o 4.2A: a comunicação por período (D01, D35)', () => {
  test('D01: comunicada até ao prazo do período (o contrato de 2024: até 15/02/2025) é Sim em 2025, e diz-se uma vez por período', async () => {
    longo();
    rendas('L1', 900);
    const l = linhaDe(app.resumoFiscal(ANO), 'L1');
    assert.equal(l.quadro, '4.2');
    assert.match(app.fiscoTexto(), /4\.2A[^\n]*: comunicada a 10\/02\/2025 · início/);
    const c = csv().quadros[0];
    assert.equal(c.comunicacao_4_2a, '2025-02-10');
    assert.equal(c.comunicacao_4_2a_resposta, 'sim');
    assert.equal(c.comunicacao_4_2a_prazo, '2025-02-15', 'o prazo do período, e não o 15/02/2026');
    assert.equal(c.comunicacao_4_2a_periodo, '2024-03-01');
    const p = await pdf();
    assert.equal(campoDe(cartao(p, 'Benfica longo'), '4.2A · comunicação'), 'Sim (comunicada a 10/02/2025)');
    const nota = p.ditos.find((s) => s.startsWith('No 4.2A, «Sim» na comunicação'));
    assert.match(nota, /uma vez por período, e não todos os anos; feita depois do prazo, a resposta é «Não»/);
    assert.doesNotMatch(nota, /15\/02\/2026/, 'sem o prazo do ano dos rendimentos');
  });

  test('D01: num período que começou no ano, por comunicar com o prazo ainda à frente diz até quando', async () => {
    app.fiscoAno = '2026';
    longo({ start: '2026-01-01', end: '2035-12-31' }, { celebracao: '2025-12-20', comunicacoes: {} });
    rendas('L1', 900, 2026, [1, 2, 3]);
    assert.match(app.fiscoTexto(), /4\.2A[^\n]*: por comunicar · até 15\/02\/2027 · início/);
    const c = csv().quadros[0];
    assert.equal(c.comunicacao_4_2a_resposta, '', 'ainda não se sabe');
    assert.equal(c.comunicacao_4_2a_prazo, '2027-02-15');
    const p = await pdf();
    assert.equal(campoDe(cartao(p, 'Benfica longo'), '4.2A · comunicação'), 'Por comunicar (até 15/02/2027; sem ela, é Não)');
  });

  test('D01: por comunicar com o prazo do período já passado é Não', () => {
    longo({}, { comunicacoes: {} });
    rendas('L1', 900);
    assert.match(app.fiscoTexto(), /4\.2A[^\n]*: por comunicar \(o prazo acabou a 15\/02\/2025\) — no 4\.2A é NÃO · início/);
    assert.equal(csv().quadros[0].comunicacao_4_2a_resposta, 'nao');
  });

  test('D35: comunicada depois do prazo do período é Não no 4.2A, no texto, no CSV e no PDF', async () => {
    // o dia escrito na janela de agora (comunicacoesV 2): uma marca do modelo
    // antigo com esta data ficava por confirmar
    longo({}, { comunicacoes: { 2024: '2025-03-20' }, comunicacoesV: 2 });
    rendas('L1', 900);
    assert.match(app.fiscoTexto(), /4\.2A[^\n]*: comunicada fora do prazo \(a 20\/03\/2025; o prazo era 15\/02\/2025\) — no 4\.2A é NÃO · início/);
    const c = csv().quadros[0];
    assert.equal(c.comunicacao_4_2a, '2025-03-20', 'a data fica na coluna de sempre');
    assert.equal(c.comunicacao_4_2a_resposta, 'nao');
    const p = await pdf();
    assert.equal(campoDe(cartao(p, 'Benfica longo'), '4.2A · comunicação'), 'Não (comunicada fora do prazo, a 20/03/2025; o prazo era 15/02/2025)');
  });

  test('D35: lê o l.comunicacao do resumo, com o foraDePrazo dele', () => {
    longo();
    rendas('L1', 900);
    ajustar((r) => { linhaDe(r, 'L1').comunicacao = { periodoInicio: '2024-03-01', chave: '2024', prazo: '2025-02-15', data: '2025-02-16', foraDePrazo: true }; });
    assert.match(app.fiscoTexto(), /comunicada fora do prazo \(a 16\/02\/2025; o prazo era 15\/02\/2025\)/);
    assert.equal(csv().quadros[0].comunicacao_4_2a_resposta, 'nao');
    ajustar((r) => { linhaDe(r, 'L1').comunicacao = null; });
    assert.equal(csv().quadros[0].comunicacao_4_2a_resposta, '', 'sem nada a comunicar, nada se responde');
  });
});

describe('o 4.2B (D36, D37)', () => {
  test('D36: um contrato de 20 anos com a renda abaixo da anterior leva o 4.2B, mesmo sem a taxa descer', async () => {
    longo({ start: '2024-06-01', end: '2044-05-31' }, { celebracao: '2024-05-20', rendaAnterior: 1000 });
    rendas('L1', 900);
    const l = linhaDe(app.resumoFiscal(ANO), 'L1');
    assert.equal(l.bonus, false, 'a estimativa fica nos 5 % (leitura prudente)');
    const c = csv().quadros[0];
    assert.equal(c.reducao_4_2b, 'sim');
    assert.equal(c.taxa_desceu_4_2b, 'nao');
    assert.equal(c.renda_4_2b, '900,00');
    assert.equal(c.renda_anterior_4_2b, '1000,00');
    assert.match(app.fiscoTexto(), /\n {4}4\.2B[^\n]*: a estimativa não desce a taxa abaixo de 5 % \(leitura prudente\); a AT pode aplicar os 5 pontos · renda deste contrato /);
    const b = cartao(await pdf(), 'Benfica longo');
    assert.equal(campoDe(b, '4.2B · renda anterior'), euro(1000) + ' por mês');
    assert.match(campoDe(b, '4.2B · taxa'), /a AT pode aplicar os 5 pontos/);
  });

  test('D36: o elegivel24 do resumo manda; sem ele nem a descida, não há 4.2B', () => {
    longo({}, { rendaAnterior: 1000 });
    rendas('L1', 900);
    ajustar((r) => { const l = linhaDe(r, 'L1'); l.bonus = false; l.elegivel24 = false; });
    const c = csv().quadros[0];
    assert.equal(c.reducao_4_2b, '');
    assert.equal(c.renda_4_2b, '');
    assert.doesNotMatch(app.fiscoTexto(), /4\.2B/);
  });

  test('D37: celebrado a 2023-11-15 (o n.º 24 vale desde 2023-10-07), e o 4.2B diz a renda que a app comparou', async () => {
    longo({ start: '2023-12-01', end: '2028-11-30' }, { celebracao: '2023-11-15', rendaAnterior: 1000, comunicacoes: { 2023: '2024-02-10' } });
    rendas('L1', 900);
    assert.equal(linhaDe(app.resumoFiscal(ANO), 'L1').quadro, '4.2');
    assert.equal(csv().quadros[0].reducao_4_2b, 'sim');
    assert.ok(app.fiscoTexto().includes('renda deste contrato ' + app.euro2(900) + ' (a de hoje, a que a app comparou)'));
    assert.equal(campoDe(cartao(await pdf(), 'Benfica longo'), '4.2B · renda deste contrato'), euro(900) + ' por mês · a de hoje no contrato');
  });
});

describe('a taxa de cada período (D41, D15), a natureza assumida (D16) e a taxa escrita (D17)', () => {
  test('D41: uma renovação a meio do ano dá duas taxas, cada uma até onde vale', async () => {
    longo();
    rendas('L1', 900);
    ajustar((r) => {
      linhaDe(r, 'L1').segmentos = [
        { de: '2025-01-01', ate: '2025-06-30', taxa: 23, motivo: 'duracao', reducao: true, semRenovacao: false, rendas: 5400, imposto: 1242 },
        { de: '2025-07-01', ate: '2025-12-31', taxa: 13, motivo: 'duracao', reducao: true, semRenovacao: false, rendas: 5400, imposto: 702 }];
    });
    assert.match(app.fiscoTexto(), / · taxa 23 % até 30\/06\/2025, 13 % depois\n/);
    assert.equal(csv().quadros[0].taxas_por_periodo, '23 % até 30/06/2025, 13 % depois');
    assert.equal(campoDe(cartao(await pdf(), 'Benfica longo'), 'Taxa'), '23 % até 30/06/2025, 13 % depois');
  });

  test('D41: troços seguidos com a mesma taxa juntam-se, e um troço sem rendas não conta', () => {
    longo();
    rendas('L1', 900);
    ajustar((r) => {
      linhaDe(r, 'L1').segmentos = [
        { de: '2025-01-01', ate: '2025-02-28', taxa: 23, semRenovacao: false, rendas: 0 },
        { de: '2025-03-01', ate: '2025-06-30', taxa: 10, semRenovacao: false, rendas: 3600 },
        { de: '2025-07-01', ate: '2025-12-31', taxa: 10, semRenovacao: false, rendas: 5400 }];
      linhaDe(r, 'L1').taxa = 10;
    });
    assert.equal(csv().quadros[0].taxas_por_periodo, '', 'uma taxa só');
    assert.match(app.fiscoTexto(), / · taxa 10 %\n/);
  });

  test('D15: as rendas depois do termo sem renovação registada vão à taxa base, e diz-se', async () => {
    longo({ start: '2020-03-01', end: '2025-02-28' });
    rendas('L1', 900);
    ajustar((r) => {
      linhaDe(r, 'L1').segmentos = [
        { de: '2025-01-01', ate: '2025-02-28', taxa: 15, motivo: 'duracao', reducao: true, semRenovacao: false, rendas: 1800, imposto: 270 },
        { de: '2025-03-01', ate: '2025-12-31', taxa: 25, motivo: 'semRenovacao', reducao: false, semRenovacao: true, rendas: 9000, imposto: 2250 }];
    });
    const t = '15 % até 28/02/2025, 25 % depois do termo, sem renovação registada';
    assert.ok(app.fiscoTexto().includes(' · taxa ' + t), 'no texto');
    assert.equal(csv().quadros[0].taxas_por_periodo, t);
    const p = await pdf();
    assert.equal(campoDe(cartao(p, 'Benfica longo'), 'Taxa'), t);
    ajustar((r) => { linhaDe(r, 'L1').segmentos[0].rendas = 0; });
    const p2 = await pdf();
    assert.equal(campoDe(cartao(p2, 'Benfica longo'), 'Taxa'), '25 % depois do termo, sem renovação registada', 'só depois do termo, sem repetir o porquê');
  });

  test('D16: sem finalidade, a natureza 07 vai como assumida', async () => {
    app.db.contracts.push(app.normContract({ id: 'C1', name: 'Loja?', propertyId: 'v1', tenantIds: ['t1'], rent: 800, start: '2020-01-01', active: true,
      fisco: { estado: 'declarado', numero: '111', finalidade: '' } }));
    rendas('C1', 800);
    assert.equal(linhaDe(app.resumoFiscal(ANO), 'C1').naturezaAssumida, true);
    assert.equal(campoDe(cartao(await pdf(), 'Loja?'), 'Natureza'), '07 (assumida) · arrendamento habitacional · falta a finalidade do contrato');
    const c = csv();
    assert.equal(c.quadros[0].natureza_assumida, 'sim');
    assert.equal(c.raw(0, 'natureza'), '="07"', 'o código fica o de sempre');
    assert.match(app.fiscoTexto(), /natureza 07 \(assumida: finalidade por indicar\)/);
  });

  test('D17: a taxa escrita no contrato é uma nota; a da linha é a da lei', async () => {
    app.db.contracts.push(app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2020-01-01', active: true, taxRate: 28,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } }));
    rendas('C1', 1000);
    const b = cartao(await pdf(), 'Arroios');
    assert.equal(campoDe(b, 'Taxa'), '25 % · taxa base');
    assert.equal(campoDe(b, 'Taxa escrita no contrato'), '28 % · não é a da lei de 2025: na declaração conta a de 25 %');
    const c = csv().quadros[0];
    assert.equal(c.taxa_pct, '25');
    assert.equal(c.taxa_escrita_pct, '28');
    assert.match(app.fiscoTexto(), / · taxa 25 % \(escreveste 28 % no contrato; conta a da lei de 2025\)/);
  });
});

describe('o quadro 8 (D55) e as isenções (D18)', () => {
  test('D55: as retenções de cada ano anterior, e um movimento por ano', async () => {
    longo();
    rendas('L1', 900);
    ajustar((r) => { linhaDe(r, 'L1').anosAnteriores = [{ ano: 2023, valor: 12000, retencoes: 3000 }, { ano: 2024, valor: 12000, retencoes: 0 }]; });
    const p = await pdf();
    const q8 = comCampo(p, 'Benfica longo · de 2023');
    assert.equal(campoDe(q8, 'Benfica longo · de 2023 · retenções'), euro(3000));
    assert.equal(campoDe(q8, 'Benfica longo · de 2024 · retenções'), undefined, 'sem retenções, sem a linha');
    assert.ok(p.ditos.some((s) => /no 8B também as retenções e os gastos de cada ano/.test(s) && /um pagamento de vários anos regista-se num movimento por ano/.test(s)));
    assert.equal(csv().quadros[0].anos_anteriores_retencoes, '2023:3000,00 2024:0,00');
    const t = app.fiscoTexto();
    assert.ok(t.includes('de anos anteriores: 2023 ' + app.euro2(12000) + ' (retenções ' + app.euro2(3000) + '), 2024 ' + app.euro2(12000) + '\n'), 'sem retenções, sem o parêntese');
    assert.match(t, /um movimento por ano/);
  });

  test('D18: um isento do 6H tem o quadro dele, com o campo do 4.1 e sem código', async () => {
    app.db.contracts.push(app.normContract({ id: 'C1', name: 'Renda antiga', propertyId: 'v1', tenantIds: ['t1'], rent: 180, start: '1987-05-01', active: true,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } }));
    rendas('C1', 180);
    ajustar((r) => {
      const l = linhaDe(r, 'C1');
      l.isencao = { id: 'prerau', nome: 'Renda antiga: contrato anterior ao RAU, sujeito ao NRAU', curto: 'renda antiga (anterior ao RAU)', quadro: '6H', codigo: '' };
      l.taxa = 0; l.imposto = 0; l.campo = '4001';
      r.totais.isentos = { n: 1, rendas: l.rendas, liquido: l.liquido };
    });
    const p = await pdf();
    assert.ok(p.ditos.includes('Quadro 6H · rendimentos isentos'));
    assert.ok(!p.ditos.includes('Quadro 6D · rendimentos isentos'));
    const h = p.cartoes.filter((c) => c[0] === 'Renda antiga · T2 Bragança')[1];
    assert.equal(campoDe(h, 'Campo do quadro 4.1'), '4001');
    assert.match(campoDe(h, 'Isenção'), /EBF art\. 46\.º-A$/);
    assert.equal(campoDe(h, 'Código'), undefined, 'o 6H não tem código');
    assert.ok(p.ditos.some((s) => s.startsWith('No 6H indicas só o campo do 4.1')));
    const c = csv();
    assert.equal(c.raw(0, 'isencao_quadro'), '="6H"');
    assert.equal(c.quadros[0].isencao_6d, '', 'não é do 6D');
    assert.match(app.fiscoTexto(), /Isentos \(quadro 6H\)/);
  });
});

describe('o modelo provisório (D49), os anos sem regras (D50) e o 4.2C (D78)', () => {
  test('D49: em 2026, provisório, a linha a 10 % diz que o campo do modelo novo está por conhecer; em 2025 não', async () => {
    app.fiscoAno = '2026';
    app.db.contracts.push(app.normContract({ id: 'M1', name: 'Moderada', propertyId: 'v1', tenantIds: ['t1'], rent: 900, start: '2025-01-01', end: '2027-12-31', active: true,
      fisco: { estado: 'declarado', numero: '555', finalidade: 'hp' } }));
    rendas('M1', 900, 2026, [1, 2, 3]);
    assert.equal(linhaDe(app.resumoFiscal(2026), 'M1').motivoTaxa, 'moderada');
    assert.equal(campoDe(cartao(await pdf(), 'Moderada'), 'Taxa de 10 % (EBF art. 45.º-C)'), 'campo do modelo novo por conhecer');
    assert.equal(csv().quadros[0].taxa_campo_por_conhecer, 'Taxa de 10 % (EBF art. 45.º-C): campo do modelo novo por conhecer');
    assert.match(app.fiscoTexto(), / · taxa 10 % · Taxa de 10 % \(EBF art\. 45\.º-C\): campo do modelo novo por conhecer/);
    app.fiscoAno = String(ANO);
    rendas('M1', 900, ANO, [1, 2, 3]);
    assert.equal(csv().quadros[0].taxa_campo_por_conhecer, '', 'no modelo oficial já se sabe');
  });

  test('D49: um isento do 6D sem código no modelo provisório diz que o código está por conhecer', async () => {
    app.fiscoAno = '2026';
    app.db.contracts.push(app.normContract({ id: 'R1', name: 'RSAA', propertyId: 'v1', tenantIds: ['t1'], rent: 700, start: '2026-01-01', active: true,
      fisco: { estado: 'declarado', numero: '666', finalidade: 'hp' } }));
    rendas('R1', 700, 2026, [1, 2]);
    ajustar((r) => {
      const l = linhaDe(r, 'R1');
      l.isencao = { id: 'rsaa', nome: 'Regime Simplificado de Arrendamento Acessível (RSAA)', curto: 'RSAA', quadro: '6D', codigo: '' };
      l.taxa = 0; l.imposto = 0;
      r.totais.isentos = { n: 1, rendas: l.rendas, liquido: l.liquido };
    });
    const p = await pdf();
    const d6 = p.cartoes.filter((c) => c[0] === 'RSAA · T2 Bragança')[1];
    assert.equal(campoDe(d6, 'Código'), 'do modelo novo, por conhecer');
  });

  test('D50: um ano antes da primeira versão não tem taxa nem imposto', async () => {
    app.fiscoAno = '2023';
    app.db.contracts.push(app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2020-01-01', active: true,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } }));
    rendas('C1', 1000, 2023);
    const c = csv();
    assert.equal(c.quadros[0].taxa_pct, '');
    assert.equal(c.quadros[0].imposto_estimado, '');
    assert.equal(c.quadros[0].rendas_iliquidas, '12000,00', 'as rendas ficam');
    assert.match(c.rows.find((x) => x.declarado === 'regras').contrato, /^A app não tem as regras de 2023: as taxas, os quadros e os códigos podem ser outros/);
    const t = app.fiscoTexto();
    assert.match(t, /imposto estimado por conhecer \(a app não tem as regras de 2023\)/);
    assert.match(t, / · taxa por conhecer \(a app não tem as regras de 2023\)/);
    assert.doesNotMatch(t, /taxa 25 %/);
    const p = await pdf();
    assert.match(campoDe(cartao(p, 'Arroios'), 'Estimativa da app'), /sem taxa nem imposto: a app não tem as regras de 2023$/);
    assert.equal(campoDe(cartao(p, 'Arroios'), 'Taxa'), 'por conhecer (a app não tem as regras de 2023)');
    assert.equal(campoDe(comCampo(p, 'Imposto estimado'), 'Imposto estimado'), 'por conhecer: a app não tem as regras de 2023');
    assert.ok(p.ditos.some((s) => s.startsWith('A app não tem as regras de 2023') && /Não uses estes números/.test(s)), 'a caixa do topo');
  });

  test('D50: o r.semRegrasDoAno do resumo manda', () => {
    app.db.contracts.push(app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2020-01-01', active: true,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } }));
    rendas('C1', 1000);
    assert.equal(csv().quadros[0].taxa_pct, '25');
    ajustar((r) => { r.semRegrasDoAno = true; });
    assert.equal(csv().quadros[0].taxa_pct, '');
  });

  test('D78: o 4.2C de 2026 cita os limites da versão, com as datas (a Portaria 454/2026/1 desde setembro)', async () => {
    app.fiscoAno = '2026';
    longo();
    rendas('L1', 900, 2026, [1, 2, 3]);
    assert.equal(linhaDe(app.resumoFiscal(2026), 'L1').quadro, '4.2');
    let nota = (await pdf()).ditos.find((s) => s.startsWith('O 4.2C pergunta'));
    assert.match(nota, /passa 150 % dos limites de renda \(até 31\/08\/2026, [^;]*Portaria 176\/2019[^;]*; de 01\/09\/2026 a 13\/10\/2026, [^;]*; desde 14\/10\/2026, [^)]*Portaria 454\/2026\/1, de 13 de outubro\)/);
    app.fiscoAno = String(ANO);
    rendas('L1', 900, ANO, [1, 2]);
    nota = (await pdf()).ditos.find((s) => s.startsWith('O 4.2C pergunta'));
    assert.match(nota, /Portaria 176\/2019/);
    assert.doesNotMatch(nota, /454\/2026/, 'em 2025 só vale a de 2019');
  });
});

describe('o quadro 10 (D09) e a regularização (D10)', () => {
  /* o resumo com um contrato terminado por motivo do senhorio (regime 02, n.º
     3 do art. 72.º), com a regularização, e outro sem o motivo (um contrato
     que já não está na base: a matriz, o titular e o inquilino vêm na
     entrada, como o resumo os dá) */
  const comCessados = () => ajustar((r) => {
    r.cessados = [
      { contratoId: 'L1', nome: 'Benfica longo', imovel: 'T2 Bragança', regime: '02', numero: '333', anoInicioBeneficio: 2024, data: '2025-08-15', motivo: '01' },
      { contratoId: 'X9', nome: 'Antigo', imovel: 'T2 Bragança', regime: '03', numero: '', anoInicioBeneficio: 2020, data: '2025-03-31', motivo: '',
        propertyId: 'v1', titularId: 'ana', titular: 'A', freguesiaCodigo: '040810', tipoPredio: 'U', artigo: '3850', fracao: '',
        anoInicioConfirmar: false, inquilinos: [{ nome: 'Tiago', nif: '123456789', pais: '' }] }];
    r.regularizacoes = [{ contratoId: 'L1', nome: 'Benfica longo', anos: [{ ano: 2025, diferenca: 450 }], total: 450 }];
    r.totais.regularizacao = 450;
  });

  test('D09: o texto, o CSV e o PDF têm o quadro 10, com os textos das tabelas da versão e o que falta', async () => {
    longo();
    rendas('L1', 900);
    comCessados();
    const t = app.fiscoTexto();
    assert.match(t, /\nQUADRO 10 · CONTRATOS QUE ACABARAM[^\n]*\n {2}Benfica longo — T2 Bragança: regime 02 \(Artigo 72\.º, n\.º 3, do Código do IRS\) · n\.º 333 · benefício desde 2024 · cessação 15\/08\/2025 · motivo 01 \(Acabou antes do prazo, por motivo do senhorio\)/);
    assert.match(t, /Antigo — T2 Bragança: [^\n]*motivo por indicar\n {4}Freguesia 040810 · U · artigo 3850 · titular A · inquilinos: Tiago \(NIF 123456789\)\n {4}Falta: n\.º do contrato na AT, motivo da cessação\./);
    const c = csv(), q10 = c.rows.filter((x) => x.declarado === 'quadro 10');
    assert.equal(q10.length, 2);
    assert.deepEqual([q10[0].contrato, q10[0].n_at, q10[0].cessacao_regime, q10[0].cessacao_ano_beneficio, q10[0].cessacao_data, q10[0].cessacao_motivo],
      ['Benfica longo', '333', '02', '2024', '2025-08-15', '01']);
    const i = c.rows.indexOf(q10[0]);
    assert.equal(c.cruas[i + 1][c.cab.indexOf('cessacao_motivo')], '="01"', 'o motivo como código');
    assert.equal(q10[1].faltas, 'n.º do contrato na AT; motivo da cessação');
    c.cruas.forEach((ls, k) => assert.equal(ls.length, c.cab.length, 'a linha ' + k + ' tem as colunas do cabeçalho'));
    const p = await pdf();
    assert.ok(p.ditos.includes('Quadro 10 · contratos que acabaram'));
    const b = p.cartoes.filter((x) => x[0] === 'Benfica longo · T2 Bragança').at(-1);
    assert.equal(campoDe(b, 'Regime fiscal'), '02 · Artigo 72.º, n.º 3, do Código do IRS');
    assert.equal(campoDe(b, 'Ano de início do benefício'), '2024');
    assert.equal(campoDe(b, 'Data da cessação'), '15/08/2025');
    assert.equal(campoDe(b, 'Motivo da cessação'), '01 · Acabou antes do prazo, por motivo do senhorio');
    assert.equal(campoDe(cartao(p, 'Antigo'), 'Motivo da cessação'), 'falta: escolhe-o na ficha do contrato');
  });

  test('D10: o motivo 01 leva a regularização estimada, sem juros, que acresce ao imposto antes das retenções', async () => {
    longo();
    rendas('L1', 900);
    comCessados();
    ajustar((r) => { r.totais.retencoes = 300; });
    const r = app.resumoFiscal(ANO), I = app.fiscoExpImpostos(r);
    assert.equal(I.regularizacao, 450);
    assert.equal(I.comRegularizacao, Math.round((I.final + 450) * 100) / 100);
    assert.equal(I.aPagar, Math.round((I.final + 450 - 300) * 100) / 100, 'a falta a pagar conta com a regularização');
    const t = app.fiscoTexto();
    assert.ok(t.includes('com a regularização do quadro 10 ' + app.euro2(I.comRegularizacao) + ' (+' + app.euro2(450) + ', estimativa sem juros) → depois das retenções (' + app.euro2(300) + '): falta pagar ' + app.euro2(I.aPagar)));
    assert.ok(t.includes('Regularização: diferença estimada de ' + app.euro2(450) + ' (2025: ' + app.euro2(450) + '), sem os juros compensatórios'));
    assert.match(t, /taxa da duração efetivamente decorrida \(CIRS art\. 72\.º n\.º 20\)/);
    const c = csv();
    assert.equal(c.rows.find((x) => x.declarado === 'quadro 10').regularizacao_estimada, '450,00');
    const imp = c.rows.find((x) => x.declarado === 'imposto');
    assert.equal(imp.regularizacao_estimada, '450,00');
    assert.equal(imp.imposto_final, I.comRegularizacao.toFixed(2).replace('.', ','));
    assert.equal(imp.falta_pagar, I.aPagar.toFixed(2).replace('.', ','));
    const p = await pdf(), tot = comCampo(p, 'Imposto estimado');
    assert.equal(campoDe(tot, 'Com a regularização do quadro 10'), euro(I.comRegularizacao) + ' · +' + euro(450) + ' (estimativa, sem os juros compensatórios)');
    assert.equal(campoDe(tot, 'Depois das retenções'), 'falta pagar ' + euro(I.aPagar));
    assert.match(campoDe(p.cartoes.filter((x) => x[0] === 'Benfica longo · T2 Bragança').at(-1), 'Regularização (art. 72.º n.º 20)'), /^diferença estimada de /);
  });

  test('D10 e reporte: os números da exportação são os do KPI da página (imposto → reporte → AIMI → regularização → retenções)', async () => {
    longo();
    rendas('L1', 900);
    app.db.properties[0].vpt = 100000;
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, date: ANO + '-09-10' });
    comCessados();
    ajustar((r) => {
      r.totais.retencoes = 300;
      r.reporte = { porTitular: { ana: { anos: [], usado: 1000, resto: 0, imposto: 100 } }, usado: 1000, imposto: 100, anosSemDados: [] };
      r.totais.impostoDepoisDoReporte = Math.max(0, Math.round((r.totais.imposto - 100) * 100) / 100);
      if (r.aimi) r.aimi.abate = 50;
    });
    const r = app.resumoFiscal(ANO), I = app.fiscoExpImpostos(r);
    assert.equal(I.depoisReporte, app.fiscoImpostoDoKpi(r), 'o imposto depois do reporte é o do KPI');
    assert.equal(I.regularizacao, app.fiscoRegularizacao(r), 'a regularização é a do KPI');
    assert.equal(I.abate, 50);
    const html = app.vFisco();
    assert.ok(html.includes('depois do AIMI: ~' + app.euro(I.final)), 'o AIMI da página');
    assert.ok(html.includes('com a regularização do quadro 10: ~' + app.euro(I.comRegularizacao) + ' (+' + app.euro(450) + ', estimativa sem juros)'), 'a regularização da página');
    assert.ok(html.includes('falta ' + app.euro(I.aPagar)), 'a falta a pagar da página');
    const t = app.fiscoTexto();
    assert.ok(t.includes('Imposto: imposto estimado ' + app.euro2(I.imposto) + ' → depois dos prejuízos de anos anteriores ' + app.euro2(I.depoisReporte) + ' → depois do AIMI ' + app.euro2(I.final)
      + ' → com a regularização do quadro 10 ' + app.euro2(I.comRegularizacao)), 'a mesma ordem no texto');
    assert.equal(csv().rows.find((x) => x.declarado === 'imposto').falta_pagar, I.aPagar.toFixed(2).replace('.', ','));
    assert.equal(campoDe(comCampo(await pdf(), 'Imposto estimado'), 'Depois das retenções'), 'falta pagar ' + euro(I.aPagar));
  });

  test('sem contratos que acabaram, nem quadro 10 nem linhas dele', async () => {
    longo();
    rendas('L1', 900);
    assert.doesNotMatch(app.fiscoTexto(), /QUADRO 10/);
    assert.equal(csv().rows.filter((x) => x.declarado === 'quadro 10').length, 0);
    assert.ok(!(await pdf()).ditos.includes('Quadro 10 · contratos que acabaram'));
  });
});

describe('o abate dos prejuízos de anos anteriores (Q10, D73)', () => {
  test('o texto, o CSV e o PDF dizem o abate e o imposto depois dele, com o que pode faltar', async () => {
    longo();
    rendas('L1', 900);
    let antes = 0;
    ajustar((r) => {
      antes = r.totais.imposto;
      r.reporte = { porTitular: { ana: { anos: [{ ano: 2023, prejuizo: 2000, usado: 2000 }], usado: 2000, resto: 300, imposto: 200 } }, usado: 2000, imposto: 200, anosSemDados: [2021, 2022] };
      r.totais.impostoDepoisDoReporte = Math.max(0, Math.round((r.totais.imposto - 200) * 100) / 100);
    });
    const depois = Math.round((app.resumoFiscal(ANO).totais.imposto - 200) * 100) / 100;
    assert.ok(antes > 200, 'o cenário tem imposto para abater');
    const t = app.fiscoTexto();
    assert.ok(t.includes('Prejuízos de anos anteriores: abatem ' + app.euro2(2000) + ' ao rendimento líquido; o imposto estimado desce ' + app.euro2(200) + ' e fica em ' + app.euro2(depois) + '.'));
    assert.ok(t.includes('Ficam ' + app.euro2(300) + ' para os anos seguintes.'));
    assert.match(t, /anos sem registos \(2021 e 2022\) e a condição de os prédios darem rendas 36 meses/);
    const c = csv(), rep = c.rows.find((x) => x.declarado === 'reporte');
    assert.ok(rep, 'a linha de rodapé do reporte');
    assert.equal(rep.reporte_abatido, '2000,00');
    assert.equal(rep.imposto_depois_reporte, depois.toFixed(2).replace('.', ','));
    assert.equal(c.rows.indexOf(rep), c.rows.findIndex((x) => x.declarado === 'regras') - 2, 'antes da linha do imposto, das regras e do aviso');
    assert.equal(c.rows.find((x) => x.declarado === 'imposto').imposto_depois_reporte, depois.toFixed(2).replace('.', ','));
    assert.equal(c.quadros[0].imposto_estimado, (Math.round(linhaDe(app.resumoFiscal(ANO), 'L1').imposto * 100) / 100).toFixed(2).replace('.', ','), 'o imposto das linhas não muda');
    const p = await pdf(), tot = comCampo(p, 'Imposto estimado');
    assert.equal(campoDe(tot, 'Prejuízos de anos anteriores'), 'abatem ' + euro(2000) + ' ao líquido');
    assert.equal(campoDe(tot, 'Depois dos prejuízos de anos anteriores'), euro(depois) + ' · o imposto desce ' + euro(200) + ' (estimativa)');
    assert.ok(p.ditos.some((s) => s.startsWith('Prejuízos de anos anteriores: abatem')), 'a nota com o que pode faltar');
  });

  test('em conjunta, o abate de cada titular; o AIMI abate ao que sobra', async () => {
    longo();
    rendas('L1', 900);
    app.db.properties[0].vpt = 100000;
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, date: ANO + '-09-10' });
    ajustar((r) => {
      r.variosTitulares = true;
      const a = r.linhas[0];
      a.titularId = 'ana'; a.titular = 'A';
      const b = JSON.parse(JSON.stringify(a));
      b.titularId = 'bruno'; b.titular = 'B'; b.nome = 'Loja';
      r.linhas.push(b);
      r.reporte = { porTitular: { ana: { anos: [], usado: 1000, resto: 0, imposto: 100 }, bruno: { anos: [], usado: 500, resto: 0, imposto: 50 } }, usado: 1500, imposto: 150, anosSemDados: [] };
      r.totais.impostoDepoisDoReporte = Math.max(0, r.totais.imposto - 150);
      if (r.aimi) r.aimi.abate = 1e6;   // mais do que o imposto: abate só o que sobra
    });
    const r = app.resumoFiscal(ANO);
    assert.ok(app.fiscoTexto().includes('abatem ' + app.euro2(1500) + ' (titular A ' + app.euro2(1000) + ' e titular B ' + app.euro2(500) + ') ao rendimento líquido'));
    const tot = comCampo(await pdf(), 'Imposto estimado');
    assert.equal(campoDe(tot, 'Prejuízos de anos anteriores · titular A'), 'abatem ' + euro(1000) + ' ao líquido');
    assert.equal(campoDe(tot, 'Prejuízos de anos anteriores · titular B'), 'abatem ' + euro(500) + ' ao líquido');
    if (r.aimi) assert.equal(campoDe(tot, 'Depois do AIMI (quadro 9)'), euro(0) + ' · abate ' + euro(r.totais.impostoDepoisDoReporte) + ' (estimativa)');
  });

  test('sem nada a abater (ou um resumo sem o reporte), nada se diz', () => {
    longo();
    rendas('L1', 900);
    assert.doesNotMatch(app.fiscoTexto(), /Prejuízos de anos anteriores/);
    ajustar((r) => { r.reporte = { porTitular: {}, usado: 0, imposto: 0, anosSemDados: [2020] }; r.totais.impostoDepoisDoReporte = r.totais.imposto; });
    assert.doesNotMatch(app.fiscoTexto(), /Prejuízos de anos anteriores/);
    assert.equal(csv().rows.filter((x) => x.declarado === 'reporte').length, 0);
  });
});

describe('o quadro 9: os números da demonstração do AIMI e os prédios de fora', () => {
  beforeEach(() => {
    longo();
    rendas('L1', 900);
    app.db.properties[0].vpt = 100000;
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, date: ANO + '-09-10' });
  });

  test('com a demonstração, o 9101 e o 9102 são os dela; os prédios de fora dizem porquê', async () => {
    ajustar((r) => {
      r.aimi.demonstracao = { total: 350, valorTributavel: 900000 };
      r.aimi.excluidos = [{ propertyId: 'v9', imovel: 'Loja', motivo: 'afetacao', porque: 'afetação de comércio', arrendado: true }];
    });
    const p = await pdf(), q9 = comCampo(p, '9101 · AIMI liquidado');
    assert.equal(campoDe(q9, '9101 · AIMI liquidado'), euro(350));
    assert.equal(campoDe(q9, '9102 · valor tributável'), euro(900000));
    assert.equal(campoDe(q9, 'AIMI pago (o que a app tem)'), euro(400));
    assert.equal(campoDe(q9, 'Fora do quadro 9 · Loja'), 'afetação de comércio');
    const row = csv().rows.find((x) => x.declarado === 'quadro 9');
    assert.equal(row.aimi_9101, '350,00');
    assert.equal(row.aimi_9102, '900000,00');
    assert.match(row.contrato, /Fora do quadro 9: Loja \(afetação de comércio\)\.$/);
    const t = app.fiscoTexto();
    assert.ok(t.includes('AIMI (quadro 9): 9101 ' + app.euro2(350) + ' · 9102 ' + app.euro2(900000) + ' · Fora do quadro 9: Loja (afetação de comércio) · pago ' + app.euro2(400)));
  });

  test('sem a demonstração, os dois campos dizem de onde vêm, sem valor', async () => {
    ajustar((r) => { r.aimi.demonstracao = null; });
    const q9 = comCampo(await pdf(), '9101 · AIMI liquidado');
    assert.equal(campoDe(q9, '9101 · AIMI liquidado'), 'da demonstração do AIMI');
    assert.equal(campoDe(q9, '9102 · valor tributável'), 'da demonstração do AIMI');
    const row = csv().rows.find((x) => x.declarado === 'quadro 9');
    assert.equal(row.aimi_9101, '');
    assert.match(row.contrato, /escreve-os na Declaração/);
    assert.match(app.fiscoTexto(), /AIMI \(quadro 9\): 9101 da demonstração do AIMI · 9102 da demonstração do AIMI · pago /);
  });
});

describe('o aviso aprovado fica no fim de tudo', () => {
  test('com o quadro 10 e o reporte, o texto, o CSV e o PDF acabam no IRS_AVISO', async () => {
    longo();
    rendas('L1', 900);
    ajustar((r) => {
      r.cessados = [{ contratoId: 'L1', nome: 'Benfica longo', imovel: 'T2 Bragança', regime: '03', numero: '333', anoInicioBeneficio: 2024, data: '2025-12-31', motivo: '03' }];
      r.reporte = { porTitular: { ana: { anos: [], usado: 100, resto: 0, imposto: 10 } }, usado: 100, imposto: 10, anosSemDados: [] };
    });
    assert.ok(app.fiscoTexto().trimEnd().endsWith(app.IRS_AVISO));
    const c = csv();
    assert.equal(c.rows.at(-1).declarado, 'aviso');
    assert.equal(c.rows.at(-1).contrato, app.IRS_AVISO);
    const p = await pdf();
    assert.ok(p.ditos.includes(app.IRS_AVISO), 'a caixa do fim');
    assert.ok(p.ditos.lastIndexOf(app.IRS_AVISO) > p.ditos.indexOf('Quadro 10 · contratos que acabaram'), 'depois do quadro 10');
  });
});
