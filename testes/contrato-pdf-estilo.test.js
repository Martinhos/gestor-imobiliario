// O contrato em PDF com o aspeto da app (web/app/contrato-pdf.js): as letras
// da app embutidas (a Geist e a Bricolage Grotesque, de web/fonts/*.ttf, como
// TrueType com o /FontFile2 e o /Length de cada stream certo), a Helvetica
// quando as letras não vêm, o rodapé «Página N de M» e «Feito com o
// Rendorium» em todas as páginas, nenhuma linha a passar a margem com as
// larguras da letra em uso, e o texto legal do modelo igual, frase a frase e
// pela mesma ordem.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carregarApp, limpar } from './arnes.js';

const FONTES = { '/fonts/geist-400.ttf': 'geist-400.ttf', '/fonts/geist-600.ttf': 'geist-600.ttf', '/fonts/bricolage-grotesque-700.ttf': 'bricolage-grotesque-700.ttf' };
const bytesDe = (f) => fs.readFileSync(new URL('../web/fonts/' + f, import.meta.url));

/* Um elemento do DOMParser mínimo abaixo: o que o generateContractPdf lê
   (nodeType, tagName, getAttribute, childNodes, textContent,
   getElementsByTagName).
   Recebe: tagName — o nome; attrs — os atributos ({nome: valor}).
   Devolve: o elemento. */
function elemento(tagName, attrs) {
  return {
    nodeType: 1, tagName, childNodes: [],
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    get textContent() { return this.childNodes.map((c) => c.textContent).join(''); },
    getElementsByTagName(t) {
      const out = [];
      const anda = (n) => n.childNodes.forEach((c) => { if (c.nodeType === 1) { if (c.tagName === t) out.push(c); anda(c); } });
      anda(this);
      return out;
    },
  };
}
/* Lê o CONTRACT_XML numa árvore de elementos (o arnês não traz DOMParser): sem
   a declaração e os comentários, com as etiquetas, os atributos e o texto.
   Recebe: src — o XML.
   Devolve: {documentElement}. */
function lerXml(src) {
  src = src.replace(/<\?xml[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '');
  const raiz = elemento('#', {}), pilha = [raiz];
  for (const m of src.matchAll(/<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g)) {
    const topo = pilha[pilha.length - 1];
    if (m[1]) { pilha.pop(); continue; }
    if (m[2]) {
      const a = {};
      for (const x of m[3].matchAll(/([\w-]+)="([^"]*)"/g)) a[x[1]] = x[2];
      const el = elemento(m[2], a);
      topo.childNodes.push(el);
      if (!m[4]) pilha.push(el);
      continue;
    }
    topo.childNodes.push({ nodeType: 3, textContent: m[5] });
  }
  return { documentElement: raiz.childNodes.find((n) => n.nodeType === 1) };
}

/* Uma app com o contrato C1 (duas pessoas de cada lado, inventário, chaves,
   caução e rendas antecipadas), o DOMParser mínimo e o fetch pedido.
   Recebe: fetch — o fetch do contexto; 'letras' serve as de web/fonts/, uma
   função é usada tal e qual.
   Devolve: {app, gera} — gera() gera o PDF e devolve os bytes. */
function montar(fetch) {
  const app = carregarApp({ hoje: '2026-11-09' });
  const ctx = app.__ctx;
  ctx.DOMParser = class { parseFromString(s) { return lerXml(s); } };
  ctx.fetch = fetch === 'letras' ? (url) => {
    if (!FONTES[url]) return Promise.resolve({ ok: false });
    const b = bytesDe(FONTES[url]);
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
  } : fetch;
  let guardado = null;
  ctx.downloadBytes = (nome, mime, bytes) => { guardado = bytes; };
  ctx.toast = () => {};
  limpar(app);
  app.db.owners = [
    app.normPerson({ id: 'O1', name: 'Ana Simões', gender: 'f', marital: 'Casado(a)', nationality: 'Portuguesa', cc: '123456789ZZ1', nif: '123456789', taxAddress: 'Rua A, 1\n1000-001 Lisboa', email: 'ana@exemplo.pt' }),
    app.normPerson({ id: 'O2', name: 'Beatriz Lopes', gender: 'f', nif: '234567890' }),
  ];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Rui Carvalho', gender: 'm', nif: '345678901' }), app.normPerson({ id: 'T2', name: 'Joana Pereira', gender: 'f' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Arroios', ownerIds: ['O1', 'O2'], street: 'Rua B', doorNumber: '2', postalCode: '1000-001', locality: 'Lisboa', registry: '1234', matrix: '4651' })];
  app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', tenantIds: ['T1', 'T2'], rent: 1250, deposit: 2500, advance: 2, payDay: 8, iban: 'PT50000201231234567890154',
    start: '2026-12-01', end: '2028-11-30',
    inventory: Array.from({ length: 40 }, (_, i) => ({ name: 'Elemento ' + (i + 1) + (i % 7 ? '' : ' com um nome comprido que tem de partir em mais do que uma linha da coluna'), qty: 1 + (i % 3), state: i % 4 ? 'usado' : 'novo' })),
    keys: [{ name: 'Porta da rua', qty: 2 }, { name: 'Caixa do correio', qty: 1 }] })];
  return { app, gera: async () => { guardado = null; await app.generateContractPdf('C1'); return guardado; } };
}

/* Os objetos do PDF pelo xref: confirma que cada desvio aponta para «n 0 obj».
   Recebe: b — os bytes (string latin-1).
   Devolve: a lista dos corpos dos objetos (o que está entre «obj» e «endobj»). */
function objetos(b) {
  const x = Number(/startxref\n(\d+)\n%%EOF$/.exec(b)[1]);
  assert.ok(b.startsWith('xref\n', x), 'o startxref aponta para o xref');
  const linhas = b.slice(x).split('\n'), n = Number(linhas[1].split(' ')[1]);
  const out = [];
  for (let i = 1; i < n; i++) {
    const off = Number(linhas[2 + i].slice(0, 10));
    assert.ok(b.startsWith(i + ' 0 obj\n', off), 'o desvio do objeto ' + i);
    out.push(b.slice(off, b.indexOf('\nendobj\n', off)));
  }
  return out;
}

/* Os textos escritos, pela ordem, com a letra, o tamanho e a posição de
   cada um, já em Unicode (os bytes são WinAnsi).
   Recebe: b — os bytes do PDF.
   Devolve: [{f, size, x, y, s}]. */
function textos(b) {
  return [...b.matchAll(/\/(F\d) ([\d.]+) Tf ([\d.-]+) ([\d.-]+) Td \(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => ({
    f: m[1], size: Number(m[2]), x: Number(m[3]), y: Number(m[4]),
    s: m[5].replace(/\\(.)/g, '$1').replace(/[\x80-\x9f]/g, (c) => WIN_UNI[c.charCodeAt(0) - 128] || c),
  }));
}
// os símbolos de 128 a 159 do WinAnsi (o TextDecoder do node lê-os como latin-1)
const WIN_UNI = '€\x81‚ƒ„…†‡ˆ‰Š‹Œ\x8dŽ\x8f\x90‘’“”•–—˜™š›œ\x9džŸ';
const RODAPE = /^(Feito com o Rendorium|Página \d+ de \d+)$/;
const paginas = (b) => (b.match(/\/Type \/Page /g) || []).length;

/* O que é de um PDF bem feito: o cabeçalho e o fim, o xref certo, o /Length de
   cada stream igual aos bytes dele, e o rodapé em todas as páginas. */
function confirmarPdf(b) {
  assert.ok(b.startsWith('%PDF-1.4\n'));
  assert.ok(b.endsWith('%%EOF'));
  for (let i = 0; i < b.length; i++) if (b.charCodeAt(i) > 255) assert.fail('um carácter por byte, na posição ' + i);
  const objs = objetos(b);
  let streams = 0;
  for (const o of objs) {
    const m = /^\d+ 0 obj\n<< \/Length (\d+)[^]*?>>\nstream\n/.exec(o);
    if (!m) continue;
    streams++;
    assert.equal(o.length - m[0].length, Number(m[1]) + '\nendstream'.length, 'o /Length bate com o stream');
    assert.ok(o.endsWith('\nendstream'));
  }
  const n = paginas(b), t = textos(b).map((x) => x.s);
  assert.ok(streams >= n, 'um stream por página, pelo menos');
  for (let p = 1; p <= n; p++) assert.equal(t.filter((s) => s === 'Página ' + p + ' de ' + n).length, 1, 'o rodapé da página ' + p);
  assert.equal(t.filter((s) => s === 'Feito com o Rendorium').length, n, 'a marca em cada página');
  return objs;
}

describe('o contrato em PDF com as letras da app', () => {
  test('embute a Geist e a Bricolage como TrueType, com o ficheiro inteiro e os nomes', async () => {
    const { app, gera } = montar('letras');
    const b = await gera();
    assert.ok(b, 'gerou');
    const objs = confirmarPdf(b);
    const fontes = objs.filter((o) => /\/Subtype \/TrueType/.test(o));
    assert.equal(fontes.length, 3, 'as três letras');
    for (const [nome, f] of [['Geist-Regular', 'geist-400.ttf'], ['Geist-SemiBold', 'geist-600.ttf'], ['BricolageGrotesque-Bold', 'bricolage-grotesque-700.ttf']]) {
      assert.ok(fontes.some((o) => new RegExp('/BaseFont /[A-Z]{6}\\+' + nome + ' /FirstChar 32 /LastChar 255 /Widths \\[(\\d+ ){223}\\d+\\]').test(o)), nome);
      const tam = bytesDe(f).length;
      const ff = objs.find((o) => o.includes('/Length ' + tam + ' /Length1 ' + tam + ' >>'));
      assert.ok(ff, 'o /FontFile2 da ' + nome + ' com o /Length1 do ficheiro');
      assert.equal(Buffer.from(ff.slice(ff.indexOf('stream\n') + 7, -'\nendstream'.length), 'latin1').equals(bytesDe(f)), true, 'os bytes da ' + nome + ' tal e qual');
    }
    assert.equal((b.match(/\/FontFile2 \d+ 0 R/g) || []).length, 3);
    assert.doesNotMatch(b, /\/BaseFont \/Helvetica/);
    assert.ok(paginas(b) >= 4, 'várias páginas: ' + paginas(b));
    assert.equal(app.pdfLetrasBytes !== null, true, 'as letras ficam em memória para o próximo PDF');
  });

  test('nenhuma linha passa a margem, medida com as larguras da letra embutida', async () => {
    const { app, gera } = montar('letras');
    const b = await gera();
    const L = app.PDF_LETRAS, peso = { F1: 'texto', F2: 'forte', F3: 'titulo' }, limite = 595.28 - 56 + 0.5;
    for (const t of textos(b)) {
      const w = app.textW(t.s, t.size, true, L[peso[t.f]].larguras);
      assert.ok(t.x + w <= limite, '«' + t.s + '» acaba em ' + (t.x + w).toFixed(1));
      assert.ok(t.x >= 56 - 0.01 && t.y >= 28, '«' + t.s + '» dentro da página');
    }
  });

  test('o texto legal é o do modelo, frase a frase e pela mesma ordem', async () => {
    const { app, gera } = montar('letras');
    const b = await gera();
    const junto = textos(b).map((x) => x.s).filter((s) => !RODAPE.test(s)).join(' ').replace(/\s+/g, ' ');
    const d = app.contractData(app.contract('C1'));
    const ok = (k) => !(d[k] === '' || d[k] == null || d[k] === 0);
    const xml = app.CONTRACT_XML.replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(clausula|secao|anexo)([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, inner) => {
        const o = /opcional="([^"]+)"/.exec(attrs);
        if (o && (o[1] === 'fotos' ? !d.fotos : !ok(o[1]))) return '';
        const t = /titulo="([^"]+)"/.exec(attrs);
        return (t ? '<cab>' + t[1] + '</cab>' : '') + inner;
      });
    const frases = [];
    let ncl = 0;
    for (const m of xml.matchAll(/<(n|p|destaque|item|titulo|subtitulo|cab|clausula-tit)((?:\s+[\w-]+="[^"]*")*)>([\s\S]*?)<\/\1>/g)) {
      const o = /opcional="([^"]+)"/.exec(m[2]);
      if (o && !ok(o[1])) continue;
      let s = app.fillTpl(m[3].replace(/\s+/g, ' ').trim(), d).replace(/[  ]/g, ' ');
      if (m[1] === 'subtitulo') { frases.push(...s.split(' · ')); continue; }
      frases.push(s);
    }
    // os títulos das cláusulas, como o gerador os escreve
    for (const m of app.CONTRACT_XML.matchAll(/<clausula titulo="([^"]+)"([^>]*)>/g)) {
      const o = /opcional="([^"]+)"/.exec(m[2]);
      if (o && !ok(o[1])) continue;
      ncl++;
      assert.ok(junto.includes('CLÁUSULA ' + app.ROMANOS[ncl] + ' — ' + m[1]), 'o título da cláusula ' + ncl);
    }
    assert.ok(ncl >= 15, 'as cláusulas todas: ' + ncl);
    let desde = 0;
    for (const f of frases) {
      const i = junto.indexOf(f, desde);
      assert.ok(i > -1, 'a frase, pela ordem: «' + f.slice(0, 90) + '»');
      desde = i + f.length;
    }
    assert.ok(frases.length > 80, 'todas as frases: ' + frases.length);
    assert.ok(junto.includes('VALOR TOTAL A ENTREGAR NA ASSINATURA: 5 000 € — 2 500 € de renda antecipada + 2 500 € de caução'));
    assert.match(junto, /1\. Os SENHORIOS dão de arrendamento/, 'o número de cada ponto vem antes dele');
    for (const s of ['Ana Simões', 'Senhoria', 'Beatriz Lopes', 'Rui Carvalho', 'Inquilino', 'Joana Pereira', 'Inquilina']) assert.ok(junto.includes(s), 'a assinatura: ' + s);
  });

  test('o «2 500 €» não parte nem vira «?»', async () => {
    const { gera } = montar('letras');
    const t = textos(await gera()).map((x) => x.s);
    assert.ok(t.every((s) => !s.includes('?')), t.filter((s) => s.includes('?')).join(' | '));
    assert.ok(t.every((s) => !/^€/.test(s)), 'nenhuma linha começa pelo €');
  });
});

describe('sem as letras, a Helvetica', () => {
  test('sem rede (o fetch falha) o PDF sai na Helvetica, inteiro e com o rodapé', async () => {
    const { app, gera } = montar(() => Promise.reject(new Error('sem rede')));
    const b = await gera();
    const objs = confirmarPdf(b);
    assert.doesNotMatch(b, /FontFile2|TrueType/);
    assert.ok(objs.some((o) => o.includes('/BaseFont /Helvetica ')));
    assert.ok(objs.some((o) => o.includes('/BaseFont /Helvetica-Bold ')));
    assert.equal(app.pdfLetrasBytes, null);
    // as quebras medem com a Helvetica: nenhuma linha passa a margem
    for (const t of textos(b)) assert.ok(t.x + app.textW(t.s, t.size, t.f !== 'F1') <= 595.28 - 56 + 0.5, '«' + t.s + '»');
  });

  test('um ficheiro que não é uma letra (a página da app no lugar dela) não entra', async () => {
    const html = Buffer.from('<!doctype html><title>Rendorium</title>');
    const { app, gera } = montar(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(html.buffer.slice(html.byteOffset, html.byteOffset + html.byteLength)) }));
    const b = await gera();
    confirmarPdf(b);
    assert.doesNotMatch(b, /FontFile2/);
    assert.equal(await app.pdfLetras(), null);
  });

  test('as recusas não vão buscar letras nenhumas', async () => {
    let pedidos = 0;
    const { app } = montar(() => { pedidos++; return Promise.reject(new Error('x')); });
    let dito = '';
    app.toast = (m) => { dito = m; };
    app.db.contracts[0].end = '';
    await app.generateContractPdf('C1');
    assert.equal(dito, 'Indica o início e o fim do contrato antes de gerar o PDF.');
    assert.equal(pedidos, 0);
  });
});
