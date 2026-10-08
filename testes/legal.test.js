// Os documentos legais, e as duas páginas públicas que os mostram.
//
// O que aqui se guarda não é o texto — é que ele seja VÁLIDO: que identifique
// quem opera o serviço, que a versão que o servidor compara seja a mesma que
// os documentos dizem, e que a página pública não passe a ter uma cópia do
// contrato a divergir da que a app mostra.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paginaLegal, GUIAO_LEGAL } from '../worker/src/legal-vista.js';
import { TERMS_VERSION } from '../worker/src/lib/http.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ler = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');
const legal = ler('web/legal.js');

// o legal.js é um script de browser: corre-se com um window de mentira
function carregarLegal() {
  const janela = {};
  new Function('window', legal)(janela);
  return janela.LEGAL;
}
const L = carregarLegal();

describe('os documentos legais', () => {
  /* Estavam com os textos de exemplo em produção. Numa Política de
     Privacidade, quem trata os dados e como se lhe fala é o que a lei manda
     dizer — e o que permite exercer os direitos que o documento promete. */
  test('identificam quem opera o serviço, sem textos por preencher', () => {
    assert.ok(L.operador && !/\[.*\]/.test(L.operador), 'operador preenchido: ' + L.operador);
    assert.ok(L.email && /@/.test(L.email) && !/\[.*\]/.test(L.email), 'email preenchido: ' + L.email);
    assert.ok(!/\[O TEU NOME|\[EMAIL DE CONTACTO\]/.test(legal), 'nenhum texto de exemplo ficou');
    [L.termos, L.privacidade].forEach((d) => {
      assert.ok(d.includes(L.operador), 'o documento diz quem opera o serviço');
    });
  });

  /* Duas constantes, dois ficheiros, e uma tem de ser a outra: a do servidor é
     a que decide se alguém já aceitou esta versão. Divergirem quer dizer ou
     pedir a aceitação de um documento que ninguém mudou, ou não a pedir de um
     que mudou. */
  test('a versão dos documentos é a que o servidor compara', () => {
    assert.equal(L.version, TERMS_VERSION,
      'web/legal.js:VERSION tem de ser igual a worker/src/lib/http.js:TERMS_VERSION');
    assert.match(L.version, /^\d{4}-\d{2}-\d{2}$/, 'a chave fica em ISO: é comparada, não lida');
  });

  test('mas o que se LÊ está em dd/mm/aaaa, como no resto da app', () => {
    [L.termos, L.privacidade].forEach((d) => {
      const texto = d.replace(/<[^>]+>/g, ' ');
      assert.ok(!/\d{4}-\d{2}-\d{2}/.test(texto), 'nenhuma data ISO no texto visível');
      assert.match(texto, /Em vigor desde \d{2}\/\d{2}\/\d{4}/, 'a data escrita como cá se escreve');
    });
  });
});

describe('as páginas públicas dos documentos', () => {
  test('há uma para cada, e mais nenhuma', async () => {
    for (const q of ['termos', 'privacidade']) {
      const r = paginaLegal(q, { raiz: true });
      assert.ok(r, q + ' tem página');
      assert.equal(r.headers.get('Content-Type'), 'text/html; charset=utf-8');
      const html = await r.text();
      assert.match(html, new RegExp('<link rel="canonical" href="https://rendorium.com/' + q + '">'));
      assert.ok(!html.includes('${'), 'nada por interpolar');
    }
    assert.equal(paginaLegal('outra-coisa', { raiz: true }), undefined, 'um nome que não é de um documento não dá página');
  });

  /* O texto não é copiado para a página: ela carrega o MESMO ficheiro que a
     app carrega. Duas cópias do mesmo contrato divergem em silêncio, e a que
     está errada é sempre a que a pessoa leu. */
  test('mostram o documento da app, e não uma cópia dele', async () => {
    const html = await paginaLegal('termos', { raiz: true }).text();
    assert.match(html, /<script src="\/legal\.js"><\/script>\s*<script src="\/paginas\/documento\.js"><\/script>/,
      'carrega a fonte única, e depois o que a escreve');
    assert.match(html, /id="doc" data-campo="termos"/, 'e diz qual dos dois escrever');
    // um pedaço do texto verdadeiro não pode estar embutido na página
    const pedaco = L.termos.replace(/<[^>]+>/g, '').slice(60, 120).trim();
    assert.ok(pedaco.length > 20 && !html.includes(pedaco), 'o contrato não está copiado para aqui');
  });

  /* O que escrevia o documento era um <script> em linha; com a CSP_ESTRITA
     passou ao /paginas/documento.js, que lê o nome do documento do
     data-campo do #doc — e só aceita os dois nomes. */
  test('o documento.js escreve o documento que o #doc pede, e só um dos dois', () => {
    const correr = (campo) => {
      const doc = { innerHTML: '', getAttribute: (a) => (a === 'data-campo' ? campo : null) };
      const janela = { LEGAL: L };
      new Function('window', 'document', GUIAO_LEGAL)(janela, { getElementById: (id) => (id === 'doc' ? doc : null) });
      return doc.innerHTML;
    };
    assert.equal(correr('termos'), L.termos);
    assert.equal(correr('privacidade'), L.privacidade);
    assert.equal(correr('version'), '', 'outra propriedade do LEGAL não se escreve');
    assert.equal(correr('__proto__'), '');
  });

  test('quem não tem JavaScript fica a saber onde o encontrar', async () => {
    const html = await paginaLegal('privacidade', { raiz: true }).text();
    assert.match(html, /<noscript>/);
    assert.match(html, /Definições → Aviso legal/);
  });

  test('uma leva à outra, e as duas ao início', async () => {
    const t = await paginaLegal('termos', { raiz: true }).text();
    assert.match(t, /href="\/privacidade"/);
    assert.match(t, /href="\/"/);
    const p = await paginaLegal('privacidade', { raiz: true }).text();
    assert.match(p, /href="\/termos"/);
  });
});
