// Ver a montra antes de a publicar.
//
// A página de entrada só era servida no domínio raiz, portanto a única
// maneira de a ver era publicá-la — o dev e o servidor local serviam a app e
// mais nada. Passa a haver /montra em qualquer endereço.
//
// O que aqui se guarda é a diferença entre os dois sítios: a raiz é a página
// a sério, indexável e com og; o resto é uma pré-visualização, que não pode
// competir com ela nos motores de busca nem mentir a quem partilhar a ligação.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paginaLanding } from '../worker/src/landing.js';
import { paginaLegal } from '../worker/src/legal-vista.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const index = fs.readFileSync(path.join(AQUI, '..', 'worker/src/index.js'), 'utf8');

const texto = (r) => r.text();

describe('a montra fora de produção', () => {
  test('o /montra serve a página de entrada em qualquer endereço', () => {
    assert.match(index, /caminho === 'montra'/, 'o caminho existe');
    /* e não está trancado ao domínio raiz: é isso que permite vê-la no dev e
       no servidor local, que é a razão de tudo isto */
    const i = index.indexOf("caminho === 'montra'");
    const linha = index.slice(index.lastIndexOf('\n', i), index.indexOf('\n', i));
    assert.match(linha, /naRaiz && url\.pathname === '\/'/, 'na raiz continua a servir «/»');
  });

  test('na raiz da app continua a estar a app, e não a montra', () => {
    /* o dev serve para testar a APP: se «/» lá passasse a ser a montra, o
       ambiente deixava de servir para o que existe */
    const i = index.indexOf("caminho === 'montra'");
    const bloco = index.slice(i, i + 200);
    assert.ok(!/^\s*if \(url\.pathname === '\/'\)/m.test(bloco),
      'a raiz só é montra quando naRaiz');
  });

  test('os documentos legais respondem em qualquer endereço', () => {
    const i = index.indexOf("caminho === 'termos'");
    assert.ok(i > -1);
    assert.ok(i < index.indexOf('if (naRaiz)'), 'antes do reencaminhamento para a app');
  });
});

describe('a pré-visualização não compete com a página a sério', () => {
  test('na raiz: indexável, com og e canonical', async () => {
    const l = await texto(paginaLanding({ raiz: true }));
    assert.match(l, /property="og:image"/, 'tem og para quem partilha');
    assert.match(l, /<link rel="canonical" href="https:\/\/rendorium\.com">/);
    assert.ok(!/noindex/.test(l), 'e é indexável');
  });

  test('fora da raiz: noindex, sem og e sem canonical', async () => {
    const l = await texto(paginaLanding());
    assert.match(l, /<meta name="robots" content="noindex,nofollow">/,
      'duas cópias indexadas competiam uma com a outra');
    assert.ok(!/og:image|og:url/.test(l),
      'um og que aponta para produção a partir do dev mente a quem partilha');
    assert.ok(!/rel="canonical"/.test(l));
  });

  test('e nos documentos, o «início» aponta para onde a montra está', async () => {
    const naRaiz = await texto(paginaLegal('termos', { raiz: true }));
    assert.match(naRaiz, /href="\/">Início</, 'na raiz, a montra é «/»');
    const fora = await texto(paginaLegal('termos'));
    assert.match(fora, /href="\/montra">Início</, 'fora dela, é /montra — ali «/» é a app');
    assert.match(fora, /noindex,nofollow/);
  });

  test('as duas páginas continuam inteiras nos dois sítios', async () => {
    for (const op of [{ raiz: true }, undefined]) {
      const l = await texto(paginaLanding(op));
      assert.ok(!l.includes('${'), 'landing sem nada por interpolar');
      assert.match(l, /O teu portefólio de arrendamento/, 'com o título');
      assert.match(l, /img\/landing\/visao-geral-light\.webp/, 'e com as capturas');
      const t = await texto(paginaLegal('privacidade', op));
      assert.ok(!t.includes('${'), 'documento sem nada por interpolar');
      assert.match(t, /<script src="\/legal\.js"><\/script>/, 'a carregar a fonte única');
    }
  });
});
