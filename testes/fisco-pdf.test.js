// O PDF do Anexo F (web/app/fisco-pdf.js): sai do resumoFiscal com os mesmos
// números da página — rendas, retenções, gastos por coluna e totais de cada
// quadro —, um contrato no 4.1 e outro no 4.2 (com o 4.2A, o 4.2B e o 4.2C),
// as faltas escritas como faltas, o nome do ficheiro só com [a-z0-9-], o
// texto que o escritor latin-1 escreve sem «?», e o caminho sem o serviço
// Contratos (sem escritor, um aviso e nenhuma descarga).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { carregarApp, carregarServico, igual, limpar, repor } from './arnes.js';

const FICHEIRO = new URL('../web/app/fisco-pdf.js', import.meta.url);

/* Carrega o fisco-pdf.js no contexto da app, como o index.html o carrega
   depois do fisco.js — só se o arnês ainda não o trouxe.
   Recebe: app — o proxy do arnês.
   Devolve: o mesmo proxy. */
function comPdf(app) {
  if (typeof app.fiscoPdf !== 'function') vm.runInContext(fs.readFileSync(FICHEIRO, 'utf8'), app.__ctx, { filename: FICHEIRO.href });
  return app;
}

/* Os textos que o PDF escreve, pela ordem, tirados dos operadores «(…) Tj»
   das páginas, sem os escapes do literal e com o € de volta (o 128 do WinAnsi).
   Recebe: bytes — o PDF (string latin-1).
   Devolve: a lista dos textos. */
function textos(bytes) {
  const out = [];
  for (const m of bytes.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)) {
    out.push(m[1].replace(/\\(.)/g, '$1').replace(/\x80/g, '€').replace(/\x97/g, '—').replace(/\x96/g, '–'));
  }
  return out;
}

const app = comPdf(carregarApp({ hoje: '2026-03-15' }));
const ANO = 2025;
let guardado, avisos;

const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra)));
const rendas = (contractId, valor, propertyId, retencao) => {
  for (let i = 1; i <= 12; i++) {
    mov({ kind: 'income', category: 'Rendas', amount: valor, contractId, propertyId, recibo: true,
      date: `${ANO}-${String(i).padStart(2, '0')}-05`, retencao: retencao && i <= 2 ? retencao : 0 });
  }
};

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana Simões' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Vera', nif: '123456789' }));
  app.db.properties.push(
    app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 },
      freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }),
    // sem artigo matricial: a falta tem de vir escrita, e nunca um artigo plausível
    app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['bruno'], freguesiaCodigo: '110601', tipoPredio: 'U' }),
  );
  app.db.contracts.push(
    app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2020-01-01', active: true,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } }),
    app.normContract({ id: 'L1', name: 'Benfica longo', propertyId: 'v2', tenantIds: ['t2'], rent: 900, start: '2024-03-01', end: '2034-02-28', active: true,
      fisco: { estado: 'declarado', numero: '333', finalidade: 'hp', celebracao: '2024-02-15', comunicacoes: { 2025: '2026-02-10' }, rendaAnterior: 1000, rendaAcimaDoLimite: false } }),
  );
  rendas('C1', 1000, 'v1', 250);
  rendas('L1', 900, 'v2');
  mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, date: ANO + '-04-10' });
  mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 1200, date: ANO + '-02-10', propertyId: 'v2' });
  guardado = null; avisos = [];
  app.downloadBytes = (nome, mime, bytes) => { guardado = { nome, mime, bytes }; };
  app.toast = (m) => { avisos.push(m); };
});
afterEach(() => repor(app));

describe('o PDF do Anexo F', () => {
  test('descarrega um PDF com o nome do ano e de hoje, e diz que exportou', async () => {
    await app.fiscoPdf();
    assert.ok(guardado, 'descarregou');
    assert.equal(guardado.nome, 'anexo-f-2025-2026-03-15.pdf');
    assert.equal(guardado.mime, 'application/pdf');
    assert.ok(guardado.bytes.startsWith('%PDF-1.4\n'));
    assert.ok(guardado.bytes.endsWith('%%EOF'));
    assert.deepEqual(avisos, ['PDF exportado.']);
    // o aspeto do contrato: cartões arredondados (curvas «c») e o rodapé em cada página
    const n = (guardado.bytes.match(/\/Type \/Page /g) || []).length, t = textos(guardado.bytes);
    for (let p = 1; p <= n; p++) assert.ok(t.includes('Página ' + p + ' de ' + n), 'o rodapé da página ' + p);
    assert.equal(t.filter((s) => s === 'Feito com o Rendorium').length, n);
    assert.match(guardado.bytes, / c\n?[^\n]* c h f Q|c h f Q/, 'um cartão arredondado');
    for (let i = 0; i < guardado.bytes.length; i++) assert.ok(guardado.bytes.charCodeAt(i) < 256, 'um carácter por byte, na posição ' + i);
  });

  test('os números são os da página: rendas, retenções, gastos e totais, por contrato e por quadro', async () => {
    const r = app.resumoFiscal(ANO, '');
    igual(r.linhas.map((l) => [l.contratoId, l.quadro]), [['C1', '4.1'], ['L1', '4.2']]);
    await app.fiscoPdf();
    const t = textos(guardado.bytes), junto = t.join('\n');
    // à cabeça, os totais do ano
    assert.ok(t.includes('IRS · Anexo F'));
    assert.ok(t.includes('Rendimentos de 2025 · entrega de 1 de abril a 30 de junho de 2026'));
    assert.ok(t.includes('Valores por inteiro, de todos os proprietários'));
    assert.ok(t.includes('Feito a 15/03/2026, com o que a app tem registado.'));
    assert.ok(t.includes('23 300,00 €'), 'rendas ilíquidas do ano: 12 × 1000 + 2 × 250 + 12 × 900');
    assert.ok(t.includes('1 500,00 €'), 'gastos dedutíveis: IMI 300 + condomínio 1200');
    const T = r.totais;
    assert.ok(t.includes(app.fiscoPdfEuro(T.liquido)), 'o líquido da página');
    assert.ok(t.includes(app.fiscoPdfEuro(T.imposto) + ' · sem englobamento'), 'o imposto estimado da página');
    // o 4.1, campo a campo, e o total dele
    const q41 = junto.slice(junto.indexOf('Quadro 4.1 ·'), junto.indexOf('Quadro 4.2 ·'));
    for (const s of ['Arroios · T2 Arroios', '111', '01/01/2020', '25 % · taxa base', '110623', 'U', '4651', 'A',
      'Tiago · NIF 123 456 789', '07 · arrendamento habitacional', '12 500,00 €', '500,00 €', '300,00 €', 'Total do quadro 4.1']) {
      assert.ok(q41.split('\n').includes(s), 'no 4.1: ' + s);
    }
    // o 4.2, com o 4.2A, o 4.2B, o 4.2C e a falta do artigo
    const q42 = junto.slice(junto.indexOf('Quadro 4.2 ·'));
    for (const s of ['Benfica longo · T1 Benfica', '333', '10 800,00 €', '0,00 €', '1 200,00 €', 'falta',
      'Sim (comunicada a 10/02/2026)', '01/03/2024', '28/02/2034', '900,00 € por mês', '1 000,00 € por mês',
      'Total do quadro 4.2', 'Sim (01)', 'Artigo matricial.']) {
      assert.ok(q42.split('\n').includes(s), 'no 4.2: ' + s);
    }
    assert.ok(q42.includes('Falta'), 'a linha das faltas');
    assert.ok(junto.includes('quem declara és tu, no Portal das'), 'a nota final');
  });

  test('o que o escritor latin-1 não escreve não vira «?»', async () => {
    app.db.transactions.push(app.normTx({ kind: 'expense', category: 'Sem regra', amount: 30000, date: ANO + '-05-01', propertyId: 'v1' }));
    await app.fiscoPdf();
    const t = textos(guardado.bytes);
    assert.ok(t.every((s) => !s.includes('?')), 'sem «?»: ' + t.filter((s) => s.includes('?')).join(' | '));
    assert.equal(app.fiscoPdfTxt('1 250,50 € − Definições → IRS'), '1 250,50 € - Definições › IRS');
    assert.equal(app.fiscoPdfTxt('Łukasz Ōta'), '?ukasz Ota', 'a letra base quando a há');
  });

  test('com sessão: a minha quota-parte e o meu nome no ficheiro, sem seletor nenhum', async () => {
    app.CW = { user: { id: 'ana' } };
    await app.fiscoPdf();
    assert.equal(guardado.nome, 'anexo-f-2025-ana-simoes-2026-03-15.pdf');
    assert.match(guardado.nome, /^[a-z0-9-]+\.pdf$/);
    const t = textos(guardado.bytes);
    assert.ok(t.includes('Titular: Ana Simões, na quota-parte'));
    assert.ok(t.includes('6 250,00 €'), 'metade das rendas do Arroios');
    assert.ok(t.includes('50 %'), 'a quota-parte na linha');
    assert.ok(!t.some((s) => s.startsWith('Benfica longo')), 'o T1 Benfica não é da Ana');
  });

  test('em conjunta com o cônjuge como B: os dois titulares no cabeçalho, e uma linha de cada um com a letra no título', async () => {
    app.db.settings.irs = { conjunta: true, titulares: { bruno: 'B' }, dispensaRecibos: false, outrosRendimentos: {} };
    app.CW = { user: { id: 'ana' } };
    await app.fiscoPdf();
    assert.equal(guardado.nome, 'anexo-f-2025-ana-simoes-2026-03-15.pdf', 'o meu nome no ficheiro');
    const t = textos(guardado.bytes);
    assert.ok(t.includes('Titulares: Ana Simões (A) e Bruno (B), cada um na sua quota-parte'));
    assert.ok(t.includes('Arroios · T2 Arroios · titular A'));
    assert.ok(t.includes('Arroios · T2 Arroios · titular B'));
    assert.ok(t.includes('Benfica longo · T1 Benfica · titular B'), 'o T1 Benfica, só do Bruno, entra pela letra dele');
    assert.ok(t.includes('1 contrato com rendas em 2025 · a tua parte e a do titular B'), 'o Arroios conta uma vez');
    assert.ok(t.includes('2 contratos nos quadros 4.1 e 4.2'));
    assert.ok(t.includes('6 250,00 €'), 'metade das rendas do Arroios, em cada linha');
  });

  test('um contrato isento fica na linha do 4.1 e no 6D, com o programa e o código; o AIMI no quadro 9', async () => {
    app.db.properties.push(app.normProp({ id: 'v3', name: 'T0 Graça', ownerIds: ['ana'], freguesiaCodigo: '110610', tipoPredio: 'U', matrix: '12', vpt: 50000 }));
    app.db.contracts.push(app.normContract({ id: 'I1', name: 'Graça PAA', propertyId: 'v3', tenantIds: ['t1'], rent: 500, start: '2024-01-01', active: true,
      fisco: { estado: 'declarado', numero: '222', finalidade: 'hp', isencao: 'paa' } }));
    rendas('I1', 500, 'v3');
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, date: ANO + '-09-10' });
    const r = app.resumoFiscal(ANO, '');
    await app.fiscoPdf();
    const t = textos(guardado.bytes), junto = t.join('\n');
    const d6 = t.slice(t.findIndex((s) => s.startsWith('Quadro 6D')));
    for (const s of ['Graça PAA · T0 Graça', '222', '01', '6 000,00 €', 'Rendimento líquido isento', app.fiscoPdfEuro(r.totais.isentos.liquido)]) {
      assert.ok(d6.includes(s), 'no 6D: ' + s);
    }
    assert.ok(junto.includes('isento · quadro 6D · código 01'), 'a taxa da linha do 4.1');
    const q9 = t.slice(t.findIndex((s) => s.startsWith('Quadro 9')));
    assert.ok(q9.includes('400,00 €'), 'o 9101');
    assert.ok(q9.includes('falta o VPT de T2 Arroios e T1 Benfica'), 'sem VPT, o 9102 diz o que falta');
  });

  test('sem rendas no ano não descarrega e diz porquê', async () => {
    app.fiscoAno = '2019';
    await app.fiscoPdf();
    assert.equal(guardado, null);
    assert.deepEqual(avisos, ['Sem contratos nos quadros 4.1 e 4.2 em 2019: não há PDF para exportar.']);
  });

  test('no Android vai para o seletor nativo, em base64', async () => {
    let pedido = null;
    app.window.Android = { saveAs: (nome, mime, b64) => { pedido = { nome, mime, b64 }; } };
    app.btoa = (x) => Buffer.from(x, 'latin1').toString('base64');   // o do browser; o arnês não o traz
    try { await app.fiscoPdf(); } finally { delete app.window.Android; }
    assert.equal(guardado, null);
    assert.equal(pedido.nome, 'anexo-f-2025-2026-03-15.pdf');
    assert.ok(Buffer.from(pedido.b64, 'base64').toString('latin1').startsWith('%PDF-1.4'));
  });
});

describe('sem o serviço Contratos', () => {
  test('não há escritor: um aviso a dizer porquê, e nada descarregado', async () => {
    const so = comPdf(carregarServico(['fisco'], { hoje: '2026-03-15' }));
    assert.equal(typeof so.PDF, 'undefined', 'o escritor é do serviço Contratos');
    let baixou = false; const ditos = [];
    so.downloadBytes = () => { baixou = true; };
    so.toast = (m) => { ditos.push(m); };
    await so.fiscoPdf();
    assert.equal(baixou, false);
    assert.equal(ditos.length, 1);
    assert.match(ditos[0], /^O PDF faz-se com o serviço Contratos\. O serviço Contratos está desligado nesta conta\./);
  });
});
