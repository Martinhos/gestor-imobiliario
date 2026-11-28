// A cláusula do IRS nos termos e o aviso «quem declara és tu» (auditoria ao
// IRS, vaga 1, folhas 2.1.5 e as do aviso).
//
// O que aqui se guarda é a letra: o texto que o Martinho aprovou para os termos
// (2026-11-13, M2), palavra por palavra, no §2 a seguir às minutas, com a versão
// dos documentos subida junta nos dois lados — e o aviso curto, o mesmo em
// todos os sítios onde a Declaração sai da app (a página, o texto, o CSV, o PDF
// e o guia público). Um texto legal que diverge em silêncio é sempre o que a
// pessoa leu.
//
// Duas partes:
// - «os termos»: passam desde a folha 2.1.5.
// - «o aviso em cada saída»: só passam depois de a vaga 1 integrar — a página
//   é a 2.1.10 (fisco.js), o texto e o CSV a 2.1.8 (fisco-exportar.js), o guia
//   a 2.1.6 (worker/src/guia-vista.js). O PDF já o tinha antes da vaga.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TERMS_VERSION } from '../worker/src/lib/http.js';
import { paginaGuia } from '../worker/src/guia-vista.js';
import { carregarApp, limpar, repor } from './arnes.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ler = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');

/* O texto aprovado (decisões do Martinho, 2026-11-13, M2), à letra. O negrito
   do «apoio ao preenchimento» é o do texto aprovado. */
const CLAUSULA = [
  'O resumo do IRS (a Declaração, o PDF, o CSV, o texto copiado e o guia) é um apoio ao preenchimento: faz-se com o ' +
  'que registas na aplicação e com as regras fiscais tal como as entendemos à data, que podem estar desatualizadas ou ser ' +
  'provisórias enquanto não sai o modelo oficial do ano. O imposto mostrado é uma estimativa. Não é aconselhamento fiscal ' +
  'nem substitui um contabilista certificado.',
  'A declaração é tua: confirmas cada valor no Portal das Finanças antes de a entregar, e és tu o responsável pelo que ' +
  'declaras. Não assumimos responsabilidade por imposto em falta, coimas, juros ou correções que resultem de uma ' +
  'declaração, mesmo que preenchida a partir da aplicação.',
];
/* O aviso aprovado, o do PDF, igual em todos os sítios. */
const AVISO = 'A app resume; quem declara és tu, no Portal das Finanças. Confirma cada valor antes de entregar: o imposto aqui é uma estimativa.';
/* A versão dos documentos em produção antes desta (a da FINE, KAN-14). */
const ANTERIOR = '2026-11-12';

/* O que se lê de um pedaço de HTML: sem etiquetas (as de dentro da frase,
   como o <b>, saem sem deixar espaço; as de bloco separam), com as entidades
   do esc de volta e os espaços juntos.
   Recebe: html — o HTML (string).
   Devolve: o texto (string). */
function textoDe(html) {
  return String(html).replace(/<\/?(?:b|strong|i|em|span|a|abbr|small)\b[^>]*>/gi, '').replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

// o legal.js é um script de browser: corre-se com um window de mentira
const janela = {};
new Function('window', ler('web/legal.js'))(janela);
const L = janela.LEGAL;

describe('os termos: a cláusula do IRS e a versão nova', () => {
  /* Cada parágrafo aprovado é um <p> dos termos, com o texto à letra. */
  test('a cláusula aprovada está nos termos, palavra por palavra, em dois parágrafos', () => {
    const paragrafos = [...L.termos.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
    for (const c of CLAUSULA) {
      const p = paragrafos.find((x) => textoDe(x) === c);
      assert.ok(p, 'o parágrafo está, à letra: ' + c.slice(0, 50) + '…');
    }
    assert.ok(L.termos.includes('é um <b>apoio ao preenchimento</b>:'), 'o negrito do texto aprovado');
  });

  test('fica no §2, a seguir ao parágrafo das minutas e antes do §3', () => {
    const t = L.termos;
    const s2 = t.indexOf('2. O que a aplicação é — e o que não é');
    const minutas = t.indexOf('conteúdo, validade ou consequências dos documentos gerados.</p>');
    const irs = t.indexOf('<p>O resumo do IRS (');
    const segundo = t.indexOf('<p>A declaração é tua:');
    const s3 = t.indexOf('3. Fase experimental');
    assert.ok(s2 > -1 && minutas > s2, 'o parágrafo das minutas está no §2');
    assert.equal(irs, minutas + 'conteúdo, validade ou consequências dos documentos gerados.</p>'.length, 'logo a seguir às minutas');
    assert.ok(segundo > irs && s3 > segundo, 'os dois parágrafos, por esta ordem, antes do §3');
    assert.equal(t.slice(s2, t.lastIndexOf('<h3', s3)).match(/<h3/g), null, 'sem título novo no meio do §2');
  });

  /* A versão é a chave que o servidor compara: subir só num lado deixava ou
     sem pedir a aceitação dos termos novos, ou a pedi-la para sempre. */
  test('a versão subiu, igual nos dois lados, e o que se lê diz a data nova', () => {
    assert.equal(L.version, '2026-11-17');
    assert.equal(TERMS_VERSION, L.version, 'worker/src/lib/http.js:TERMS_VERSION = web/legal.js:VERSION');
    assert.ok(TERMS_VERSION > ANTERIOR, 'mais nova do que a de produção: toda a gente aceita de novo depois do promove');
    for (const d of [L.termos, L.privacidade]) assert.match(textoDe(d), /Em vigor desde 17\/11\/2026\./);
  });

  test('os pontos dos termos seguem a ordem, sem números repetidos', () => {
    const n = [...L.termos.matchAll(/<h3[^>]*>(\d+)\./g)].map((m) => Number(m[1]));
    assert.deepEqual(n, n.map((_, i) => i + 1));
  });

  /* O aviso curto e a cláusula dizem o mesmo: a estimativa, o Portal das
     Finanças, quem declara. A letra do aviso vive no irs.js (IRS_AVISO). */
  test('o IRS_AVISO da app é o aviso aprovado, à letra, e não contradiz a cláusula', () => {
    const app = carregarApp();
    assert.equal(app.IRS_AVISO, AVISO);
    const clausula = CLAUSULA.join(' ');
    for (const ideia of ['Portal das Finanças', 'estimativa']) {
      assert.ok(AVISO.includes(ideia) && clausula.includes(ideia), ideia);
    }
  });
});

/* ------------------------------------------------------------------------
   O aviso em cada saída da Declaração. Esta parte só passa depois de a vaga 1
   integrar: o fisco.js (a página, folha 2.1.10), o fisco-exportar.js (o texto
   e o CSV, folha 2.1.8) e o worker/src/guia-vista.js (o guia, folha 2.1.6).
   O PDF (fisco-pdf.js) já o escrevia.
   ------------------------------------------------------------------------ */
describe('o aviso em cada saída da Declaração, igual, à letra (depois de a vaga 1 integrar)', () => {
  const app = carregarApp({ hoje: '2026-03-15' });
  const ANO = 2025;
  if (typeof app.fiscoPdf !== 'function') {
    const f = new URL('../web/app/fisco-pdf.js', import.meta.url);
    vm.runInContext(fs.readFileSync(f, 'utf8'), app.__ctx, { filename: f.href });
  }
  afterEach(() => repor(app));
  beforeEach(() => {
    limpar(app);
    app.fiscoAno = String(ANO);
    app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
    app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
    app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651' }));
    app.db.contracts.push(app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2024-01-01', active: true,
      fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }));
    for (let i = 1; i <= 12; i++) {
      app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', amount: 1000, contractId: 'C1', propertyId: 'v1', recibo: true, date: `${ANO}-${String(i).padStart(2, '0')}-05` }));
    }
    app.toast = () => {};
  });

  test('a página da Declaração (fisco.js)', () => {
    assert.ok(textoDe(app.vFisco()).includes(AVISO), 'a página escreve o aviso à letra');
  });

  test('o texto copiado (fisco-exportar.js:fiscoTexto)', () => {
    assert.ok(app.fiscoTexto().replace(/\s+/g, ' ').includes(AVISO), 'o texto escreve o aviso à letra');
  });

  test('a folha de cálculo (fisco-exportar.js:fiscoXlsx)', () => {
    let xlsx = null;
    app.download = (nome, mime, conteudo) => { xlsx = conteudo; };
    app.fiscoXlsx();
    assert.ok(xlsx, 'descarregou');
    assert.ok(Buffer.from(xlsx).toString('utf8').includes(AVISO.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')), 'a folha de cálculo escreve o aviso à letra');
  });

  /* O escritor do PDF parte as linhas: lê-se o que a Declaração lhe passa, e
     não o que ele desenha. */
  test('o PDF (fisco-pdf.js)', async () => {
    const ditos = [];
    const original = app.PDF;
    app.PDF = function () {
      const pdf = original.apply(this, arguments);
      for (const k of Object.keys(pdf)) {
        if (typeof pdf[k] !== 'function') continue;
        const f = pdf[k];
        pdf[k] = function () { for (const a of arguments) if (typeof a === 'string') ditos.push(a); return f.apply(this, arguments); };
      }
      return pdf;
    };
    app.downloadBytes = () => {};
    await app.fiscoPdf();
    assert.ok(ditos.some((t) => t.includes(AVISO)), 'o PDF escreve o aviso à letra');
  });

  /* O guia é do worker e não carrega o irs.js: escreve o aviso à letra, e é
     aqui que se confere que é o mesmo. */
  test('o guia público (worker/src/guia-vista.js)', async () => {
    const html = await paginaGuia({ raiz: true }).text();
    assert.ok(textoDe(html).includes(AVISO), 'o guia escreve o aviso à letra');
  });
});
