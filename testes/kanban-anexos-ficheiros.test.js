// Os anexos do kanban que não são imagens (KAN-119): o PDF de uma FINE, os
// documentos do Office e o texto simples entram, reconhecidos pelos próprios
// bytes (worker/src/lib/imagens.js:tipoDoFicheiro), e saem para descarregar,
// com o nome limpo, nosniff e a CSP dos anexos; HTML, SVG, XML e executáveis
// ficam à porta (415) mesmo com o Content-Type e o nome a mentir. O teto é de
// 10 MB. No back office, um anexo que não é imagem desenha-se num bloco com o
// ícone, o nome e o tamanho, sem <img>.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ambiente } from './lib/api.js';
import { chamar, corpoDe, MASTER, SUPORTE, DEV } from './lib/equipa.js';
import { rotasEquipaApi } from '../worker/src/equipa-api.js';
import { CSP_ANEXO } from '../worker/src/lib/http.js';
import { tipoDoFicheiro, nomesNoZip, comExtensao, disposicaoDeDescarga, TIPOS_DOS_ANEXOS } from '../worker/src/lib/imagens.js';
import { caixa } from './lib/kanban-caixa.js';

const K = '/api/equipa/kanban';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const txt = (s) => new TextEncoder().encode(s);
// uma imagem PNG de 1×1, a mesma dos testes do QA
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));
// um PDF mínimo: o que conta é a assinatura do começo
const PDF = txt('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
// o começo de um executável do Windows (MZ), com os nulos que ele tem
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00]);
const HTML = txt('<!doctype html><html><body><script>fetch("/api/equipa/kanban")</script></body></html>');
const SVG = txt('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');

/* Um ZIP mínimo (sem compressão) com estas entradas, com o diretório central
   e o fim dele, como o Office os escreve.
   Recebe: nomes — os caminhos das entradas.
   Devolve: os bytes (Uint8Array). */
function zip(nomes) {
  const locais = [], centrais = [];
  let pos = 0;
  for (const nome of nomes) {
    const n = txt(nome), dados = txt('x');
    const local = new Uint8Array(30 + n.length + dados.length), dl = new DataView(local.buffer);
    dl.setUint32(0, 0x04034b50, true); dl.setUint16(4, 20, true);
    dl.setUint32(18, dados.length, true); dl.setUint32(22, dados.length, true); dl.setUint16(26, n.length, true);
    local.set(n, 30); local.set(dados, 30 + n.length);
    const central = new Uint8Array(46 + n.length), dc = new DataView(central.buffer);
    dc.setUint32(0, 0x02014b50, true); dc.setUint16(4, 20, true); dc.setUint16(6, 20, true);
    dc.setUint32(20, dados.length, true); dc.setUint32(24, dados.length, true); dc.setUint16(28, n.length, true); dc.setUint32(42, pos, true);
    central.set(n, 46);
    locais.push(local); centrais.push(central); pos += local.length;
  }
  const tamCentral = centrais.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22), df = new DataView(fim.buffer);
  df.setUint32(0, 0x06054b50, true); df.setUint16(8, nomes.length, true); df.setUint16(10, nomes.length, true);
  df.setUint32(12, tamCentral, true); df.setUint32(16, pos, true);
  return Uint8Array.from(Buffer.concat([...locais, ...centrais, fim]));
}
const OOXML = ['[Content_Types].xml', '_rels/.rels'];

/* Cria um cartão pela rota e confere o 201.
   Recebe: env.
   Devolve: promessa do CartaoCurto. */
async function novoCartao(env) {
  const r = await corpoDe(await chamar(env, MASTER, 'POST', K + '/cartoes', { tipo: 'tarefa', titulo: 'A FINE' }));
  assert.equal(r.status, 201, JSON.stringify(r));
  return r.cartao;
}

/* Adiciona um anexo pela rota, com os bytes e os cabeçalhos dados.
   Recebe: env; chave — a do cartão; corpo — os bytes; headers (opcional).
   Devolve: promessa da Response. */
function anexar(env, chave, corpo, headers) {
  const path = K + '/cartoes/' + chave + '/anexos';
  const url = new URL('https://x.pt' + path);
  return rotasEquipaApi({ env, request: new Request(url, { method: 'PUT', body: corpo, headers: headers || {} }), path, method: 'PUT', url, eu: DEV });
}

describe('os tipos que entram, pelos bytes', () => {
  test('imagens, PDF, Word, Excel, PowerPoint, texto e CSV; o nome só separa o CSV do texto', () => {
    assert.equal(tipoDoFicheiro(PNG), 'image/png');
    assert.equal(tipoDoFicheiro(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
    assert.equal(tipoDoFicheiro(PDF, 'fine.txt'), 'application/pdf', 'o nome não manda');
    assert.equal(tipoDoFicheiro(zip([...OOXML, 'word/document.xml', 'word/styles.xml'])), DOCX);
    assert.equal(tipoDoFicheiro(zip([...OOXML, 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'])), XLSX);
    assert.equal(tipoDoFicheiro(zip([...OOXML, 'ppt/presentation.xml'])), PPTX);
    assert.equal(tipoDoFicheiro(txt('Notas da visita\nPortão avariado.\n')), 'text/plain');
    assert.equal(tipoDoFicheiro(txt('﻿data;valor\n2026-11-12;650,00\n'), 'rendas.CSV'), 'text/csv');
    assert.equal(tipoDoFicheiro(txt('data;valor\n'), 'rendas.txt'), 'text/plain');
    assert.equal(tipoDoFicheiro(txt('se a < b e c > d, nada de marcação')), 'text/plain', 'um < solto não é HTML');
    assert.deepEqual(Object.keys(TIPOS_DOS_ANEXOS).sort(), ['application/pdf', DOCX, PPTX, XLSX, 'image/jpeg', 'image/png', 'image/webp', 'text/csv', 'text/plain'].sort(),
      'a lista é fechada: nada de svg, html, xml, zip, doc ou exe');
  });

  test('HTML, SVG, XML, executáveis, ZIP genéricos, macros e texto que não é UTF-8 ficam de fora', () => {
    for (const [b, porque] of [
      [HTML, 'HTML'], [SVG, 'SVG'], [txt('<?xml version="1.0"?><a/>'), 'XML'], [txt('﻿  \n<HTML><body>x'), 'HTML com BOM e espaços'],
      [txt('Olá\n<p>e depois</p><script>alert(1)</script>'), 'HTML a meio do texto'], [txt('x <svg/onload=alert(1)>'), 'SVG a meio'],
      [EXE, 'executável'], [txt('olá\u0000mundo'), 'texto com nulos'], [Uint8Array.from([0x4f, 0x6c, 0xe1, 0x0a]), 'Latin-1 (não é UTF-8)'],
      [txt('a\u0007b'), 'carácter de controlo'], [Uint8Array.from([0, ...txt('%PDF-1.7')]), 'PDF que não começa pela assinatura'],
      [zip(['a.txt', 'b.exe']), 'ZIP genérico'], [zip([...OOXML, 'word/document.xml', 'word/vbaProject.bin']), 'Word com macros'],
      [zip([...OOXML, 'xl/workbook.xml', 'xl/activeX/activeX1.xml']), 'Excel com ActiveX'],
      [zip(['word/document.xml']), 'sem [Content_Types].xml'], [Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), 'ZIP partido'],
      [Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), '.doc antigo (OLE)'],
    ]) assert.equal(tipoDoFicheiro(b, 'nome.txt'), null, porque);
  });

  test('o ZIP lê-se pelo diretório central, e o que não bate certo dá null', () => {
    assert.deepEqual(nomesNoZip(zip(['a', 'b/c.xml'])), ['a', 'b/c.xml']);
    const z = zip(['a', 'b']);
    z[z.length - 22 + 16] = 0xff;   // o diretório central diz começar fora do ficheiro
    assert.equal(nomesNoZip(z), null);
    assert.equal(nomesNoZip(PDF), null);
  });

  test('o nome leva a extensão do tipo verdadeiro, e a descarga diz-o em UTF-8', () => {
    assert.equal(comExtensao('FINE', 'application/pdf', 120), 'FINE.pdf');
    assert.equal(comExtensao('fine.PDF', 'application/pdf', 120), 'fine.PDF');
    assert.equal(comExtensao('instalar.bat', 'text/plain', 120), 'instalar.bat.txt');
    assert.equal(comExtensao('rendas.csv', 'text/csv', 120), 'rendas.csv');
    assert.equal(comExtensao('x'.repeat(120), DOCX, 120), 'x'.repeat(115) + '.docx', 'o teto conta com a extensão');
    assert.equal(disposicaoDeDescarga('FINE Caixa «2026» (1)*.pdf'),
      'attachment; filename="FINE Caixa _2026_ (1)*.pdf"; filename*=UTF-8\'\'FINE%20Caixa%20%C2%AB2026%C2%BB%20%281%29%2A.pdf');
    assert.equal(disposicaoDeDescarga('a"b\\c.txt'), 'attachment; filename="a_b_c.txt"; filename*=UTF-8\'\'a%22b%5Cc.txt');
  });
});

describe('as rotas dos anexos com ficheiros', () => {
  test('um PDF entra e sai para descarregar: attachment com o nome, o tipo verdadeiro, nosniff e a CSP dos anexos', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    const put = await corpoDe(await anexar(env, c.chave, PDF, { 'Content-Type': 'application/octet-stream', 'X-Nome': encodeURIComponent('FINE Caixa.pdf') }));
    assert.equal(put.status, 201, JSON.stringify(put));
    const a = put.anexo;
    assert.deepEqual([a.nome, a.tipo, a.tamanho], ['FINE Caixa.pdf', 'application/pdf', PDF.length]);
    const get = await chamar(env, SUPORTE, 'GET', a.url);
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('Content-Type'), 'application/pdf');
    assert.equal(get.headers.get('Content-Disposition'), 'attachment; filename="FINE Caixa.pdf"; filename*=UTF-8\'\'FINE%20Caixa.pdf');
    assert.equal(get.headers.get('Content-Security-Policy'), CSP_ANEXO);
    assert.equal(get.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(get.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(new Uint8Array(await get.arrayBuffer()), PDF);
  });

  test('Word, Excel, texto e CSV saem com o tipo deles, o texto em UTF-8; uma imagem continua no sítio, sem attachment', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    const casos = [
      [zip([...OOXML, 'word/document.xml']), 'contrato.docx', DOCX, DOCX],
      [zip([...OOXML, 'xl/workbook.xml']), 'contas', XLSX, XLSX],
      [txt('Notas: o portão abre ao contrário.\n'), 'notas.txt', 'text/plain', 'text/plain; charset=utf-8'],
      [txt('data;valor\n2026-11-12;650,00\n'), 'rendas.csv', 'text/csv', 'text/csv; charset=utf-8'],
    ];
    for (const [bytes, nome, tipo, servido] of casos) {
      const put = await corpoDe(await anexar(env, c.chave, bytes, { 'X-Nome': encodeURIComponent(nome) }));
      assert.equal(put.status, 201, nome + ': ' + JSON.stringify(put));
      assert.equal(put.anexo.tipo, tipo, nome);
      const get = await chamar(env, DEV, 'GET', put.anexo.url);
      assert.equal(get.headers.get('Content-Type'), servido, nome);
      assert.match(get.headers.get('Content-Disposition'), /^attachment; filename="/, nome);
      assert.equal(get.headers.get('X-Content-Type-Options'), 'nosniff', nome);
      assert.equal(get.headers.get('Content-Security-Policy'), CSP_ANEXO, nome);
    }
    const img = await corpoDe(await anexar(env, c.chave, PNG, { 'X-Nome': 'ecra.png' }));
    const get = await chamar(env, DEV, 'GET', img.anexo.url);
    assert.equal(get.headers.get('Content-Type'), 'image/png');
    assert.equal(get.headers.get('Content-Disposition'), null, 'a imagem abre no sítio, como antes');
  });

  test('HTML, SVG e um executável: 415 mesmo com o Content-Type e o nome a mentir, e nada chega ao R2', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    for (const [bytes, tipo, nome] of [[HTML, 'text/plain', 'notas.txt'], [HTML, 'application/pdf', 'fine.pdf'], [SVG, 'image/png', 'desenho.png'],
      [SVG, 'text/csv', 'dados.csv'], [EXE, 'application/pdf', 'fine.pdf'], [EXE, 'image/jpeg', 'foto.jpg']]) {
      const r = await corpoDe(await anexar(env, c.chave, bytes, { 'Content-Type': tipo, 'X-Nome': nome }));
      assert.equal(r.status, 415, nome + ' (' + tipo + ')');
      assert.match(r.error, /PDF/);
      assert.match(r.error, /Word, Excel e PowerPoint/);
    }
    assert.equal(env.FILES.m.size, 0, 'nada chegou ao R2');
  });

  test('o nome por omissão tem a extensão do tipo verdadeiro, e um nome sem ela ganha-a', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    const nome = async (bytes, xNome) => (await corpoDe(await anexar(env, c.chave, bytes, xNome == null ? {} : { 'X-Nome': encodeURIComponent(xNome) }))).anexo.nome;
    assert.equal(await nome(PDF), 'documento.pdf');
    assert.equal(await nome(zip([...OOXML, 'ppt/presentation.xml'])), 'documento.pptx');
    assert.equal(await nome(txt('olá')), 'texto.txt');
    assert.equal(await nome(PNG), 'imagem.png');
    assert.equal(await nome(PDF, 'FINE de novembro'), 'FINE de novembro.pdf');
    assert.equal(await nome(txt('echo olá'), 'instalar.bat'), 'instalar.bat.txt', 'um texto nunca desce com a extensão de um programa');
    assert.equal(await nome(PNG, 'ecra'), 'ecra', 'as imagens ficam como antes');
  });

  test('o teto é de 10 MB: pelo Content-Length e pelos bytes que chegam; 10 MB certos entram', async () => {
    const env = ambiente();
    const c = await novoCartao(env);
    const MB10 = 10 * 1024 * 1024;
    const demais = await corpoDe(await anexar(env, c.chave, PDF, { 'Content-Length': String(MB10 + 1) }));
    assert.equal(demais.status, 413);
    assert.match(demais.error, /10 MB/);
    const grande = new Uint8Array(MB10 + 1);
    grande.set(PDF);
    assert.equal((await anexar(env, c.chave, grande)).status, 413);
    assert.equal(env.FILES.m.size, 0);
    const certo = new Uint8Array(MB10);
    certo.set(PDF);
    const r = await corpoDe(await anexar(env, c.chave, certo, { 'X-Nome': 'FINE digitalizada.pdf' }));
    assert.equal(r.status, 201, JSON.stringify(r));
    assert.equal(r.anexo.tamanho, MB10);
    const seis = new Uint8Array(6 * 1024 * 1024);
    seis.set(PDF);
    assert.equal((await anexar(env, c.chave, seis)).status, 201, 'os 6 MB que antes passavam do teto');
  });
});

describe('o bloco de um anexo no back office', () => {
  const ctx = caixa();
  const pdf = { id: 'a1', nome: 'FINE <b>.pdf', tipo: 'application/pdf', tamanho: 1258291, url: K + '/anexos/a1', autor: { id: 'd1', nome: 'Dina' }, created_at: 5 };
  const img = { id: 'a2', nome: 'ecra.png', tipo: 'image/png', tamanho: 2048, url: K + '/anexos/a2', autor: { id: 'd1', nome: 'Dina' }, created_at: 6 };

  test('um PDF desenha-se num bloco sem <img>: o ícone, o nome escapado, «1,2 MB», o autor e a data, que descarrega', () => {
    const h = ctx.kbAnexosHtml('KAN-14', [pdf]);
    assert.doesNotMatch(h, /<img/);
    assert.match(h, /<a class="kb-ficheiro-a" href="\/api\/equipa\/kanban\/anexos\/a1" download/);
    assert.match(h, /FINE &lt;b&gt;\.pdf/);
    assert.match(h, /PDF · 1,2 MB · Dina · dia 5/);
    assert.match(h, /data-ic="kbFicheiro"/);
    assert.match(h, /data-acao="kbAnexoRemover" data-arg="a1"/);
    assert.match(h, /Adicionar ficheiro/);
    assert.doesNotMatch(h, /Adicionar imagem/);
  });

  test('as imagens continuam em miniatura, e o campo aceita os tipos novos', () => {
    const h = ctx.kbAnexosHtml('KAN-14', [img, pdf]);
    assert.match(h, /<img src="\/api\/equipa\/kanban\/anexos\/a2"/);
    assert.ok(h.indexOf('kb-anexo-img') < h.indexOf('kb-ficheiro-a'), 'as miniaturas primeiro, os ficheiros por baixo');
    const accept = /accept="([^"]+)"/.exec(h)[1].split(',');
    for (const t of ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv']) assert.ok(accept.includes(t), t);
    assert.ok(!accept.some((t) => /svg|html?$|^(?:text|application)\/xml$|\.xml$|\.doc$|\.xls$|\.docm$|\.xlsm$/i.test(t)), 'nada de SVG, HTML, XML nem dos Office com macros');
  });

  test('um endereço que não é o das rotas não vira ligação; o tamanho diz-se como se lê', () => {
    const h = ctx.kbAnexosHtml('KAN-14', [Object.assign({}, pdf, { url: 'javascript:alert(1)' })]);
    assert.doesNotMatch(h, /href=/);
    assert.match(h, /FINE &lt;b&gt;\.pdf/, 'o nome continua lá');
    assert.equal(ctx.kbTamanho(1258291), '1,2 MB');
    assert.equal(ctx.kbTamanho(2048), '2 KB');
    assert.equal(ctx.kbTamanho(10), '1 KB');
  });
});
