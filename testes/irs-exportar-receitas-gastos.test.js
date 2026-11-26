// A exportação das receitas, dos gastos e dos quadros 5 e 9 da Declaração
// (auditoria ao IRS, vaga 3, folha 2.3.5): o texto (fisco-exportar.js:
// fiscoTexto), o CSV (fiscoCsvTexto) e o PDF (fisco-pdf.js:fiscoPdf) dizem o
// mesmo que o resumo novo (fisco-resumo.js, a 1.4 «Vaga 3»):
// - D03: a caução, os reembolsos do inquilino e as rendas devolvidas que as
//   rendas ilíquidas levam, e nenhum texto diz que as cauções ficam de fora;
// - D21, D51: as linhas 05 e 02 do mesmo contrato, com o texto da natureza;
// - D52: o quadro 5 (a sublocação), mesmo num ano só com ele, com as
//   retenções dele no total;
// - D71: a lista dos prédios do quadro 9, com o campo e o VPT;
// - D28: a condição das obras dos 24 meses e as que ficam por confirmar;
// - D90: os nomes e os grupos das colunas do impresso, lidos da versão;
// - D59: o NIF português e o país à parte, com o código da tabela X;
// - D76: a coluna «Atualização da renda superior a 1,02?»;
// - D93, D08: a quota com as casas que tem e os comproprietários fora da app;
// - D30: as letras A e B são as do Rosto, e o cônjuge pode ser o A;
// - o porquê da taxa do imóvel reabilitado e do DHD no PDF.
//
// Os casos correm de ponta a ponta pelo resumo da app; onde o teste é sobre a
// forma como a exportação lê um campo, ele é posto à mão com a forma do
// contrato.

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
/* O CSV do ano, lido: o cabeçalho, as linhas como objetos e as dos quadros.
   Devolve: {cab, rows, cruas, quadros}. */
function csv() {
  const ls = app.fiscoCsvTexto(app.resumoFiscal(ANO)).split('\n').map(cruas), cab = ls[0].map(valor);
  const rows = ls.slice(1).map((c) => Object.fromEntries(cab.map((k, i) => [k, valor(c[i])])));
  return { cab, rows, cruas: ls, quadros: rows.filter((x) => x.declarado === 'sim' || x.declarado === 'por indicar') };
}
/* Muda o resumo que as saídas leem, depois de o resumoFiscal o fazer. */
function ajustar(fn) {
  const orig = app.resumoFiscal;
  app.resumoFiscal = function () { const r = orig.apply(this, arguments); fn(r); return r; };
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

const mov = (extra) => app.db.transactions.push(app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra)));
const rendas = (v, meses, extra) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: v, contractId: 'C1', recibo: true, date: `${ANO}-${mm(m)}-05` }, extra || {})));
const imovel = (extra) => app.db.properties.push(app.normProp(Object.assign({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'],
  freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651' }, extra || {})));
const contrato = (extra, fisco) => app.db.contracts.push(app.normContract(Object.assign({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 800,
  start: '2026-01-01', end: '2031-12-31', active: true }, extra || {}, { fisco: Object.assign({ estado: 'declarado', numero: '1234567', finalidade: 'hp' }, fisco || {}) })));

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('D03 — a caução, os reembolsos e as devoluções nas rendas', () => {
  test('o texto, o CSV e o PDF dizem a caução que as rendas levam, e nenhum diz que as cauções ficam de fora', async () => {
    imovel(); contrato();
    rendas(800);
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 1600, contractId: 'C1', date: '2026-01-02' });
    mov({ kind: 'income', category: 'Reembolsos', sub: 'Inquilino', amount: 240, contractId: 'C1', date: '2026-06-20', recibo: true });
    const l = app.resumoFiscal(ANO).linhas[0];
    assert.equal(l.caucao, 1600, 'o resumo dá a caução');
    const t = app.fiscoTexto();
    assert.ok(t.includes('Rendas ilíquidas ' + app.euro2(11440) + ' (com ' + app.euro2(1600) + ' de caução e ' + app.euro2(240) + ' de reembolsos do inquilino)'), 'a linha do contrato');
    assert.ok(t.includes('Rendas ilíquidas ' + app.euro2(11440) + ' (com ' + app.euro2(1600) + ' de caução'), 'os totais');
    const c = csv().quadros[0];
    assert.equal(c.caucao, '1600,00');
    assert.equal(c.reembolsos_inquilino, '240,00');
    assert.equal(c.devolucoes_renda, '0,00');
    const p = await pdf(), b = cartao(p, 'Arroios · T2 Arroios');
    assert.equal(campoDe(b, 'Inclui a caução'), euro(1600) + ' · renda do ano em que a recebeste');
    assert.equal(campoDe(b, 'Inclui reembolsos do inquilino'), euro(240));
    const tudo = [t].concat(p.ditos).join('\n');
    assert.doesNotMatch(tudo, /cauç\S* [^.]*ficam de fora|ficam de fora[^.]*cauç/i, 'nenhum texto diz que as cauções ficam de fora');
    assert.ok(p.ditos.some((s) => /com a caução \(renda do ano em que a recebes\)/.test(s)), 'a nota das rendas ilíquidas di-lo');
  });

  test('as rendas devolvidas: a linha di-las já tiradas', () => {
    imovel(); contrato();
    rendas(800);
    ajustar((r) => { r.linhas[0].devolucoes = 800; });
    assert.ok(app.fiscoTexto().includes('(já sem ' + app.euro2(800) + ' de rendas devolvidas)'));
    assert.equal(csv().quadros[0].devolucoes_renda, '800,00');
  });
});

describe('D21, D51 — as linhas 05 e 02 do mesmo contrato', () => {
  test('a indemnização vai à sua linha, com a natureza 05 e o texto da versão, no texto, no CSV e no PDF', async () => {
    imovel(); contrato();
    rendas(800, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    mov({ kind: 'income', category: 'Rendas', sub: 'Indemnização', amount: 2400, contractId: 'C1', date: '2026-12-20' });
    const r = app.resumoFiscal(ANO), l5 = r.linhas.find((l) => l.papel === 'indemnizacao');
    assert.ok(l5, 'o resumo dá a linha 05');
    const txt05 = app.irsAno(ANO).naturezasTexto['05'];
    const nt = txt05.charAt(0).toLowerCase() + txt05.slice(1);
    const t = app.fiscoTexto();
    assert.ok(t.includes('· Arroios — T2 Arroios · natureza 05 · titular'), 'a entrada da linha 05 diz-se pela natureza');
    assert.ok(t.includes('natureza 05 (' + nt + ')'));
    const q = csv().quadros;
    assert.deepEqual(q.map((x) => x.papel).sort(), ['indemnizacao', 'renda']);
    assert.equal(q.find((x) => x.papel === 'indemnizacao').natureza_texto, nt);
    const p = await pdf(), b = cartao(p, 'Arroios · T2 Arroios · natureza 05');
    assert.ok(b, 'o cartão da linha 05');
    assert.equal(campoDe(b, 'Natureza'), '05 · ' + nt);
    assert.ok(p.ditos.some((s) => s.startsWith('Cada contrato com natureza 05') && s.includes('tem uma linha à parte da das rendas')));
  });

  test('as outras receitas prediais vão à linha 02', () => {
    imovel(); contrato();
    rendas(800);
    mov({ kind: 'income', category: 'Rendas', sub: 'Outras receitas prediais', amount: 1200, contractId: 'C1', date: '2026-06-01' });
    assert.ok(app.fiscoTexto().includes('natureza 02 (cedência de uso do prédio ou de parte dele, que não arrendamento)'));
    assert.ok(csv().quadros.some((x) => x.papel === 'outra' && x.natureza === '02'));
  });
});

describe('D52 — o quadro 5 (a sublocação)', () => {
  const sublocacao = () => {
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 } }); contrato({ rent: 900 });
    rendas(900, M12, { retencao: 0 });
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 675, retencao: 225, contractId: 'C1', date: '2026-12-28' });
  };

  test('um ano só com sublocação dá o PDF, e o texto e o CSV têm o quadro 5', async () => {
    sublocacao();
    const r = app.resumoFiscal(ANO);
    assert.equal(r.linhas.length, 0);
    assert.equal(r.quadro5.length, 1);
    const p = await pdf();
    assert.ok(p.bytes, 'há PDF: o quadro 5 é rendimento');
    const b = cartao(p, 'Arroios · T2 Arroios');
    assert.equal(campoDe(b, 'Renda paga ao senhorio'), euro(7200));
    assert.equal(campoDe(b, 'NIF do senhorio'), '123456789', 'o NIF que se copia, sem espaços (N107)');
    assert.equal(campoDe(b, 'Natureza'), '02 · subarrendamento habitacional');
    assert.ok(cartao(p, 'Total do quadro 5'));
    const t = app.fiscoTexto();
    assert.match(t, /^ANEXO F · QUADROS 4\.1 E 4\.2 E 5 — 2026/);
    assert.match(t, /\nQUADRO 5 · SUBLOCAÇÃO/);
    assert.ok(t.includes('renda paga ao senhorio ' + app.euro2(7200) + ' · NIF do senhorio 123456789'));
    assert.doesNotMatch(t, /POR CONTRATO/, 'sem linhas no 4.1 e no 4.2, sem a lista vazia');
    const q5 = csv().rows.find((x) => x.declarado === 'quadro 5');
    assert.equal(q5.renda_paga_senhorio, '7200,00');
    assert.equal(q5.nif_senhorio, '123456789');
    assert.equal(q5.quadro, '5');
    assert.equal(q5.rendas_iliquidas, r.quadro5[0].rendaRecebida.toFixed(2).replace('.', ','));
  });

  test('o total das retenções inclui as do quadro 5, e di-lo', async () => {
    sublocacao();
    const r = app.resumoFiscal(ANO);
    assert.equal(r.totais.quadro5.retencoes, 225);
    assert.ok(app.fiscoTexto().includes('retenções ' + app.euro2(r.totais.retencoes) + ' (com ' + app.euro2(225) + ' do quadro 5)'));
    const p = await pdf();
    assert.ok(p.cartoes.some((c) => campoDe(c, 'Retenções na fonte') === euro(r.totais.retencoes) + ' · com ' + euro(225) + ' do quadro 5'));
    assert.ok(p.cartoes.some((c) => campoDe(c, 'Sublocação (quadro 5)')), 'a sublocação nos totais');
  });
});

describe('D71 — os prédios do quadro 9', () => {
  test('o texto e o CSV listam os prédios do quadro 9 com o campo e o VPT', () => {
    imovel({ vpt: 100000 }); contrato();
    rendas(800);
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, propertyId: '', date: '2026-09-20' });
    const r = app.resumoFiscal(ANO), campo = r.linhas[0].campo;
    assert.ok(r.aimi && r.aimi.predios.length === 1);
    assert.ok(app.fiscoTexto().includes('Prédios do quadro 9: T2 Arroios (quadro / campo ' + r.linhas[0].quadro + ' / ' + campo + ', VPT ' + app.euro2(100000) + ')'));
    const p9 = csv().rows.find((x) => x.declarado === 'quadro 9 · prédio');
    assert.equal(p9['imóvel'], 'T2 Arroios');
    assert.equal(p9.campo, r.linhas[0].quadro + ' / ' + campo);
    assert.equal(p9.vpt, '100000,00');
  });
});

describe('D28, D90 — as obras dos 24 meses e os nomes do impresso', () => {
  const obras = (resposta) => {
    imovel(); contrato({ start: '2026-06-01' }, { obrasSemOutroUso: resposta });
    rendas(1000, [6, 7, 8, 9, 10, 11, 12]);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pintura', amount: 1500, date: '2025-09-15' });
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pequenas reparações', amount: 3000, date: '2026-01-20' });
  };

  test('por confirmar: ficam fora, numa secção à parte com a condição, no texto, no CSV e no PDF', async () => {
    obras(null);
    assert.equal(app.resumoFiscal(ANO).obrasPorConfirmar.length, 1);
    const t = app.fiscoTexto();
    assert.match(t, /\nOBRAS DOS 24 MESES POR CONFIRMAR \(não estão em nenhuma linha: só contam se, entre a obra e o contrato, o imóvel não teve outro uso/);
    assert.ok(t.includes('  Arroios — T2 Arroios: ' + app.euro2(4500) + ' (desde 09/2025) — ficam fora até responderes no contrato'));
    const o = csv().rows.find((x) => x.declarado === 'obras por confirmar');
    assert.equal(o.obras24, '4500,00');
    assert.match(o.obras24_condicao, /art\. 41\.º n\.º 7/);
    const p = await pdf();
    assert.ok(p.ditos.includes('Obras dos 24 meses por confirmar'));
    assert.ok(p.cartoes.some((c) => /^4 500,00 € desde 09\/2025 · ficam fora até responderes/.test(campoDe(c, 'Arroios · T2 Arroios') || '')));
  });

  test('confirmadas: os nomes e o grupo do impresso, as datas em MM/AAAA e a condição', async () => {
    obras(true);
    const v = app.irsAno(ANO), ob = v.colunasNomes.obras, ap = v.colunasNomes.apos;
    const t = app.fiscoTexto();
    assert.ok(t.includes(ob.titulo + ': ' + ob.inicioContrato + ' 06/2026 · ' + ob.inicioGastos + ' 09/2025 · ' + ob.valor + ' ' + app.euro2(4500) + ' (só contam se'));
    assert.ok(t.includes(ap.titulo + ': ' + ap.conservacao + ' '), 'os gastos no grupo «Após início do arrendamento»');
    assert.ok(t.includes(' · ' + ap.imi + ' ' + app.euro2(0) + ' · ' + ap.selo + ' '), 'o IMI e o selo com o nome do impresso');
    const p = await pdf(), b = cartao(p, 'Arroios · T2 Arroios');
    assert.ok(b.includes(ap.titulo) && b.includes(ob.titulo), 'os dois grupos no cartão');
    assert.equal(campoDe(b, ob.inicioContrato), '06/2026');
    assert.equal(campoDe(b, ob.inicioGastos), '09/2025');
    assert.equal(campoDe(b, ob.valor), euro(4500));
    assert.match(campoDe(b, 'Condição'), /^Só contam se, entre a obra e o contrato, o imóvel não teve outro uso/);
    assert.equal(campoDe(b, ap.taxas), euro(0), 'as taxas autárquicas pelo nome do impresso');
    assert.equal(campoDe(cartao(p, 'Total do quadro ' + app.resumoFiscal(ANO).linhas[0].quadro), ap.imi), euro(0));
    const c = csv().quadros[0];
    assert.equal(c.obras24_inicio_contrato, '06/2026');
  });
});

describe('D59 — o NIF português e o país', () => {
  test('um número estrangeiro com o país: o NIF português vazio e o país com o código da tabela X', async () => {
    app.db.tenants.push(app.normPerson({ id: 't2', name: 'Lucía', nif: 'X1234567L', pais: 'Espanha' }));
    imovel(); contrato({ tenantIds: ['t2'] });
    rendas(800);
    assert.match(app.fiscoTexto(), /Inquilinos: Lucía \(NIF português — · país Espanha · código do país da tabela X das instruções do Anexo J\)/);
    const c = csv().quadros[0];
    assert.equal(c.nif_ou_pais, 'Espanha', 'o número estrangeiro não vai na coluna do NIF');
    assert.equal(c.nif, '');
    const b = cartao(await pdf(), 'Arroios · T2 Arroios');
    assert.equal(campoDe(b, 'Inquilino'), 'Lucía');
    assert.equal(campoDe(b, 'NIF português'), '—');
    assert.equal(campoDe(b, 'País'), 'Espanha · código do país da tabela X das instruções do Anexo J');
  });

  test('com o código do país na pessoa, vai o código', () => {
    assert.equal(app.fiscoExpPais({ pais: 'Espanha', paisCodigo: '724' }), 'Espanha · código 724');
  });
});

describe('D76 — a atualização da renda de 2023', () => {
  test('um contrato de 2020: a coluna do impresso por responder, e depois a resposta', async () => {
    imovel(); contrato({ start: '2020-03-01', end: '2030-02-28' });
    rendas(800);
    const nome = app.irsAno(ANO).quadro43.colunas.find((x) => x[0] === 'atualizacao')[1];
    assert.ok(app.fiscoTexto().includes(nome + ' por responder: a renda de 2023 subiu mais de 2 %?'));
    assert.equal(csv().quadros[0].atualizacao_1_02, 'por responder');
    app.db.contracts[0].fisco.atualizacao2023 = 'sim';
    assert.ok(app.fiscoTexto().includes(nome + ' Sim'));
    assert.equal(csv().quadros[0].atualizacao_1_02, 'sim');
    assert.equal(campoDe(cartao(await pdf(), 'Arroios · T2 Arroios'), nome), 'Sim');
  });

  test('um contrato de 2022 em diante não leva a coluna', () => {
    imovel(); contrato();
    rendas(800);
    assert.doesNotMatch(app.fiscoTexto(), /1,02/);
    assert.equal(csv().quadros[0].atualizacao_1_02, '');
  });
});

describe('D93, D08 — a quota usada e os comproprietários fora da app', () => {
  test('uma quota de 49,8 % não se arredonda a 50 % no texto', async () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 49.8, bruno: 50.2 } }); contrato();
    rendas(800);
    app.CW = { user: { id: 'ana' } };
    const l = app.resumoFiscal(ANO).linhas[0];
    assert.ok(Math.abs(l.quota - 0.498) < 1e-9, 'o resumo usa 49,8 %');
    assert.match(app.fiscoTexto(), /· quota-parte 49,8 % ·/);
    assert.equal(campoDe(cartao(await pdf(), 'Arroios · T2 Arroios'), 'Quota-parte'), '49,8 %');
  });

  test('os comproprietários fora da app dizem-se na linha', async () => {
    imovel({ comproprietariosFora: [{ id: 'f1', nome: 'Irmão', quota: 50 }] }); contrato();
    rendas(800);
    app.CW = { user: { id: 'ana' } };
    assert.ok(Math.abs(app.resumoFiscal(ANO).linhas[0].quota - 0.5) < 1e-9);
    assert.ok(app.fiscoTexto().includes('Comproprietários fora da app: Irmão (50 %) — declaram a parte deles'));
    assert.equal(csv().quadros[0].comproprietarios_fora, 'Irmão (50 %)');
    assert.equal(campoDe(cartao(await pdf(), 'Arroios · T2 Arroios'), 'Comproprietários fora da app'), 'Irmão (50 %) · declaram a parte deles');
  });

  test('as quotas de cada parte do ano, quando mudaram', () => {
    imovel(); contrato();
    rendas(800);
    ajustar((r) => { const l = r.linhas[0]; l.quota = 0.5; l.quotas = [{ desde: '2026-01-01', quota: 1 }, { desde: '2026-07-01', quota: 0.5 }]; });
    assert.match(app.fiscoTexto(), /quota-parte 50 % \(100 % desde 01\/01\/2026, 50 % desde 01\/07\/2026\)/);
    assert.equal(csv().quadros[0].quotas_no_ano, '100 % desde 01/01/2026, 50 % desde 01/07/2026');
  });
});

describe('D30 — as letras são as do Rosto', () => {
  test('eu sou a B e o cônjuge o A: o PDF diz a parte do titular A, e as letras não mudam as rendas', async () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } }); contrato();
    rendas(800);
    app.db.settings.irs = { conjunta: true, titulares: {}, dispensaRecibos: false, outrosRendimentos: {}, porAno: { 2026: { conjunta: true, conjugeId: 'bruno', minhaLetra: 'B' } } };
    app.CW = { user: { id: 'ana' } };
    const r = app.resumoFiscal(ANO);
    assert.deepEqual(Array.from(r.linhas, (l) => l.titular).sort(), ['A', 'B'], 'as duas quotas entram');
    const p = await pdf();
    assert.ok(p.ditos.some((s) => s.startsWith('1 contrato com rendas em 2026 · a tua parte e a do titular A')), 'o cônjuge é o A');
    assert.ok(p.ditos.includes('A e B são as letras de cada um no Rosto da declaração: as rendas dos dois entram, seja qual for a letra.'));
    assert.match(app.fiscoTexto(), /\nA e B são as letras de cada um no Rosto da declaração/);
  });
});

describe('o porquê da taxa no PDF', () => {
  test('o imóvel reabilitado e o DHD dizem porquê, em vez de «—»', async () => {
    imovel(); contrato();
    rendas(800);
    let motivo = '';
    ajustar((r) => { const l = r.linhas[0]; l.taxa = 5; l.motivoTaxa = motivo; l.segmentos = null; });
    for (const [m, txt] of [['reabilitacao', 'imóvel reabilitado'], ['dhd', 'direito real de habitação duradoura']]) {
      motivo = m;
      assert.equal(campoDe(cartao(await pdf(), 'Arroios · T2 Arroios'), 'Taxa'), '5 % · ' + txt);
    }
  });
});
