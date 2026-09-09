// Novidades e versões: a lista que define a versão, o filtro por
// funcionalidade, e o ficheiro que a app vai buscar para saber se está
// atrasada. Uma versão errada aqui põe a app a pedir-se atualizações a si
// própria em ciclo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const avisos = require('../web/avisos.js');
const { AVISOS, VERSAO, VERSAO_MINIMA, FUNCIONALIDADES } = avisos;

const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

describe('a lista de novidades', () => {
  test('a versão é a da entrada mais recente', () => {
    assert.equal(VERSAO, AVISOS[0].v);
  });

  test('vem da mais recente para a mais antiga, sem repetir números', () => {
    const vs = AVISOS.map((a) => a.v);
    assert.deepEqual(vs, [...vs].sort((a, b) => b - a), 'por ordem decrescente');
    assert.equal(new Set(vs).size, vs.length, 'sem versões repetidas');
  });

  test('cada entrada está completa', () => {
    AVISOS.forEach((a) => {
      assert.ok(Number.isInteger(a.v) && a.v > 0, 'versão inteira');
      assert.match(a.data, /^\d{4}-\d{2}-\d{2}$/, 'data da versão ' + a.v);
      assert.ok(a.titulo && a.titulo.length > 8, 'título da versão ' + a.v);
      assert.ok((a.seccoes || []).length, 'secções na versão ' + a.v);
    });
  });

  test('cada secção diz o que toca, e só nomes que existem', () => {
    const conhecidas = Object.keys(FUNCIONALIDADES);
    AVISOS.forEach((a) => a.seccoes.forEach((s) => {
      assert.ok((s.afeta || []).length, 'v' + a.v + ' · "' + s.titulo + '" sem afeta');
      s.afeta.forEach((f) => {
        assert.ok(conhecidas.includes(f), 'v' + a.v + ' usa a funcionalidade "' + f + '", que não existe');
      });
      assert.ok(s.itens.length, 'v' + a.v + ' · "' + s.titulo + '" sem itens');
      s.itens.forEach((i) => assert.ok(i.length > 15, 'item curto demais: ' + i));
    }));
  });

  test('a mínima nunca passa a versão em vigor', () => {
    // uma mínima acima da versão publicada trancava toda a gente fora
    assert.ok(VERSAO_MINIMA <= VERSAO, 'mínima ' + VERSAO_MINIMA + ' > versão ' + VERSAO);
  });
});

describe('o filtro por funcionalidade', () => {
  // a mesma regra que a app usa: a secção conta se tocar em algo que a pessoa tem
  const paraQuemTem = (minhas) => AVISOS
    .map((a) => ({ v: a.v, seccoes: a.seccoes.filter((s) => s.afeta.some((f) => minhas.includes(f))) }))
    .filter((a) => a.seccoes.length);

  test('quem tem tudo vê tudo', () => {
    const todas = Object.keys(FUNCIONALIDADES);
    assert.equal(paraQuemTem(todas).length, AVISOS.length);
  });

  test('quem só tem uma funcionalidade vê só o que a toca', () => {
    const so = paraQuemTem(['anexos']);
    so.forEach((a) => a.seccoes.forEach((s) => {
      assert.ok(s.afeta.includes('anexos'), '"' + s.titulo + '" não toca em anexos');
    }));
  });

  test('uma funcionalidade sem novidades não mostra nada', () => {
    /* uma chave inventada, de propósito: usar uma funcionalidade real
       ('creditos') partiu no dia em que ela ganhou novidades — o teste
       validava o estado do momento, não a regra */
    assert.deepEqual(paraQuemTem(['__sem_novidades__']), []);
  });

  test('sem funcionalidade nenhuma não se vê nada', () => {
    assert.deepEqual(paraQuemTem([]), []);
  });

  test('toda a funcionalidade declarada tem um nome legível', () => {
    Object.keys(FUNCIONALIDADES).forEach((k) => {
      assert.ok(FUNCIONALIDADES[k] && FUNCIONALIDADES[k].length > 3, k);
    });
  });
});

describe('o ficheiro que a app vai buscar', () => {
  const json = JSON.parse(ler('web/versao.json'));

  test('bate certo com a lista de novidades', () => {
    assert.equal(json.versao, VERSAO, 'correr: node scripts/versao.js');
    assert.equal(json.minima, VERSAO_MINIMA, 'correr: node scripts/versao.js');
    assert.equal(json.data, AVISOS[0].data);
  });
});

describe('o service worker', () => {
  const sw = ler('web/sw.js');

  test('traz a versão de avisos.js em vez de a repetir', () => {
    assert.match(sw, /importScripts\('\/avisos\.js'\)/);
    assert.match(sw, /typeof VERSAO === 'number'/, 'a versão vem de lá');
    assert.match(sw, /const CACHE = 'gi-shell-v' \+ VER/, 'e dá o nome à cache');
  });

  /* A v31 partiu em produção com ReferenceError em cadeia — LS_SESSAO, CW,
     ic, go — porque este ficheiro deixava uma página carregar metade de cada
     versão. Duas causas, as duas aqui guardadas. */
  test('não troca de versão a meio de um carregamento', () => {
    assert.doesNotMatch(sw, /self\.skipWaiting\(\)/,
      'o worker novo espera: com skipWaiting assumia o controlo a meio da página');
  });

  test('a alternativa à rede é só da cache desta versão', () => {
    assert.doesNotMatch(sw, /caches\.match\(/,
      'o caches.match sem cacheName procura em TODAS as caches, incluindo a da versão anterior');
    assert.match(sw, /caches\.open\(CACHE\)[\s\S]{0,80}?\.match\(/,
      'serve-se da cache desta versão, e só dela');
  });

  test('sem versão não guarda nem apaga nada', () => {
    assert.match(sw, /const VER = typeof VERSAO/, 'a versão pode faltar');
    assert.match(sw, /if \(VER == null\) return;/, 'e nesse caso este worker não manda em nada');
  });

  test('não declara VERSAO, que colidiria com a do ficheiro importado', () => {
    assert.doesNotMatch(sw, /^\s*(let|const|var)\s+VERSAO\b/m);
  });

  test('guarda o avisos.js, senão não abre offline', () => {
    assert.match(sw, /'\/avisos\.js'/);
  });

  test('nunca serve a versão da cache', () => {
    assert.match(sw, /versao\.json/);
  });
});

/* Um arranque que falha é um ecrã em branco — e o código que sabe atualizar a
   app (cloud/novidades.js:verificarVersao) é precisamente o que não chegou a
   carregar. Quem ficasse partido não se curava sozinho. */
describe('a rede de segurança do arranque', () => {
  const html = ler('web/index.html');
  const i = html.indexOf("var CHAVE = 'gi_arranque_curado'");
  const bloco = i > -1 ? html.slice(html.lastIndexOf('<script>', i), html.indexOf('</script>', i)) : '';

  test('existe, e antes de tudo o que pode falhar', () => {
    assert.ok(i > -1, 'a rede existe');
    assert.ok(i < html.indexOf('<script src="app/dados.js">'),
      'antes do primeiro ficheiro do arranque, senão não o apanha');
  });

  test('não depende de nada — se dependesse, falhava com o resto', () => {
    assert.ok(!/<script src=/.test(bloco), 'é inline');
    ['ic(', 'toast(', 'render(', 'CW.'].forEach((f) => {
      assert.ok(!bloco.includes(f), 'não usa ' + f + ', que pode não existir');
    });
  });

  test('apanha as duas maneiras de o arranque partir', () => {
    assert.match(bloco, /tagName === 'SCRIPT'/, 'um ficheiro que não carrega');
    assert.match(bloco, /is not defined/, 'e um símbolo que devia existir e não existe');
    assert.match(bloco, /addEventListener\('error'[\s\S]{0,200}?true\)/,
      'o erro de um <script> não sobe: ouve-se na descida');
  });

  test('cura uma vez, não em ciclo', () => {
    assert.match(bloco, /sessionStorage\.getItem\(CHAVE\)/, 'lembra-se de já ter tentado');
    assert.match(bloco, /document\.readyState === 'complete'/, 'e só durante o arranque');
    assert.match(bloco, /caches\.delete/, 'limpa o que está guardado');
    assert.match(bloco, /unregister\(\)/, 'e larga o service worker');
  });
});

describe('a app carrega as peças novas', () => {
  const html = ler('web/index.html');

  test('o avisos.js entra antes da camada da nuvem', () => {
    assert.ok(html.indexOf('src="avisos.js"') > -1, 'avisos.js é carregado');
    assert.ok(
      html.indexOf('src="avisos.js"') < html.indexOf('src="cloud/novidades.js"'),
      'e antes de quem o usa'
    );
  });
});
