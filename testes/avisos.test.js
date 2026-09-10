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
  test('em produção não troca de versão a meio de um carregamento', () => {
    // sem os comentários: eles falam do skipWaiting para explicar quando se usa
    const codigo = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const inst = codigo.slice(codigo.indexOf("addEventListener('install'"), codigo.indexOf("addEventListener('activate'"));
    const linhas = inst.split('\n').filter((l) => l.includes('skipWaiting'));
    assert.equal(linhas.length, 1, 'no install há um só skipWaiting');
    assert.match(linhas[0], /!GUARDA/,
      'e só fora de produção, onde não há cache a proteger — em produção o worker novo espera');
  });

  /* O worker novo espera, e um location.reload() NÃO o promove: o documento
     antigo e o novo sobrepõem-se e o registo nunca fica sem clientes. Sem um
     canal, «quem manda na altura de trocar é a app» era só uma frase, e a
     versão nova chegava pelo efeito lateral de lhe apagarem as caches. */
  test('atende o pedido de troca da app, e só esse', () => {
    const codigo = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const msg = codigo.slice(codigo.indexOf("addEventListener('message'"));
    assert.ok(msg.startsWith("addEventListener('message'"), 'o worker ouve mensagens');
    const linha = msg.split('\n').find((l) => l.includes('skipWaiting'));
    assert.ok(linha, 'e é aí que assume');
    assert.ok(linha.includes("tipo === 'assumir'"),
      'nunca por iniciativa própria: só quando a app pede, com a recarga já decidida');
  });

  /* O install corre uma vez por worker, e o caches.open sobre um nome apagado
     devolve uma cache nova e VAZIA sem se queixar. Quem apagasse a cache por
     baixo de um worker deixava-a assim para sempre. */
  test('um worker que ativa com a cache vazia volta a enchê-la de uma vez', () => {
    assert.match(sw, /function garantirShell/, 'sabe reconstruir a shell');
    assert.match(sw, /ks\.length \? null : c\.addAll\(SHELL\)/,
      'e só quando ela está vazia — encher por cima a cada ativação era um download por publicação');
    const act = sw.slice(sw.indexOf("addEventListener('activate'"), sw.indexOf("addEventListener('fetch'"));
    const prod = act.slice(act.indexOf('if (VER == null) return;'));
    assert.ok(prod.indexOf('garantirShell') < prod.indexOf('clients.claim'),
      'antes de assumir os clientes, senão assume-os com a cache vazia');
  });

  test('a alternativa à rede é só da cache desta versão', () => {
    assert.doesNotMatch(sw, /caches\.match\(/,
      'o caches.match sem cacheName procura em TODAS as caches, incluindo a da versão anterior');
    assert.match(sw, /caches\.open\(CACHE\)[\s\S]{0,80}?\.match\(/,
      'serve-se da cache desta versão, e só dela');
  });

  /* A cache leva o nome da VERSÃO, e fora de produção a versão não muda entre
     publicações — o dev publica dezenas de vezes com a mesma. Com a cache a
     responder primeiro, o ambiente congelava no primeiro carregamento dessa
     versão, e atualizar a página não adiantava. */
  /* A regra diz quem NÃO é produção, e não quem é. Esteve ao contrário
     (`hostname === 'app.rendorium.com'`), e isso deixava de fora gente que
     está mesmo em produção: o wrangler.toml liga o workers.dev à mão porque as
     instalações antigas — PWA e APK — apontam para lá. Perderiam o offline em
     silêncio. E fixar o literal no teste foi exatamente o que não apanhou a
     omissão, por isso agora testa-se a regra a correr. */
  test('quem não guarda são os ambientes conhecidos; o resto é produção', () => {
    const m = /const SEM_CACHE = \[([\s\S]*?)\];/.exec(sw);
    assert.ok(m, 'a lista de quem NÃO guarda existe — a regra é por exclusão');
    const lista = m[1].match(/'([^']+)'/g).map((x) => x.replace(/'/g, ''));
    ['localhost', '127.0.0.1', 'dev.rendorium.com'].forEach((h) => {
      assert.ok(lista.includes(h), h + ' não pode guardar');
    });
    assert.match(sw, /SEM_CACHE\.indexOf\(hn\) < 0/, 'é uma exclusão, não uma permissão');
    assert.match(sw, /gestor-imobiliario-dev\./,
      'o worker de dev também tem endereço em workers.dev');
    // e o inverso, que é o que se perdeu antes: nada exclui os endereços antigos
    assert.ok(!lista.some((h) => /workers\.dev$/.test(h)),
      'os endereços antigos de produção (PWA e APK) continuam a guardar');
  });

  test('fora de produção o fetch não toca na cache', () => {
    assert.match(sw, /if \(!GUARDA \|\| VER == null\) return;/);
  });

  /* E a transição tem de se desenrascar: quem já tem uma cache de uma
     publicação anterior não tinha como sair dela — o worker novo esperava, e o
     antigo continuava a servir o que estava guardado. */
  test('fora de produção assume já e limpa o que estava guardado', () => {
    const inst = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('activate'"));
    assert.match(inst, /if \(!GUARDA\) \{ self\.skipWaiting\(\); return; \}/,
      'assume já: não há cache a proteger, logo não há carregamento a partir');
    const act = sw.slice(sw.indexOf("addEventListener('activate'"), sw.indexOf("addEventListener('fetch'"));
    const forcaDeProd = act.slice(act.indexOf('if (!GUARDA)'), act.indexOf('if (VER == null)'));
    assert.match(forcaDeProd, /keys\.map\(\(k\) => caches\.delete\(k\)\)/,
      'apaga TODAS as caches, e não só as de outras versões');
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

/* A travessia entre versões, do lado da app. Foi aqui que a v31 se resolveu
   pela metade: tirou-se o skipWaiting do install (bem) e escreveu-se que a app
   passava a mandar na troca (mal — não tinha como). O que a app fazia era
   apagar TODAS as caches, incluindo a que o worker em espera acabara de
   encher, e recarregar à espera de que a versão nova viesse da rede. */
describe('a troca de versão', () => {
  const nov = ler('web/cloud/novidades.js');
  const entrada = ler('web/cloud/entrada.js');

  test('a app pede a troca e espera pela confirmação', () => {
    assert.match(nov, /function trocarDeWorker/);
    assert.match(nov, /postMessage\(\{ tipo: 'assumir' \}\)/, 'o pedido');
    assert.match(nov, /addEventListener\('controllerchange'/,
      'e a confirmação: sem ela não se sabe se trocou, e o resto da decisão depende disso');
    assert.match(nov, /setTimeout\(function \(\) \{ fim\(false\); \}, 4000\)/,
      'com tecto — uma troca que não vem não pode prender o ecrã de progresso');
  });

  test('nunca se apaga a cache da versão para onde se vai', () => {
    const f = nov.slice(nov.indexOf('function limparCaches'), nov.indexOf('function limparCaches') + 900);
    assert.match(f, /function limparCaches\(guardar\)/, 'sabe qual é a versão-alvo');
    assert.match(f, /k !== poupada/, 'e poupa-a: é o addAll do worker em espera, a versão nova inteira');
    assert.doesNotMatch(f, /r\.update\(\)/,
      'e já não fica pendurada num update() sem tecto — quem atualiza o worker é o trocarDeWorker');
  });

  test('a troca vem primeiro, o machado só quando ela falha', () => {
    const ver = nov.slice(nov.indexOf('CW.verificarVersao'));
    assert.ok(ver.indexOf('trocarDeWorker') < ver.indexOf('limparCaches'), 'por esta ordem');
    assert.match(ver, /if \(trocou\) \{ location\.reload\(\); return; \}/,
      'trocou: a cache do worker novo é a boa, limpá-la seria desfazê-la');
    assert.match(ver, /limparCaches\(nova\)/, 'não trocou: apaga o resto, poupando a da versão nova');
  });

  /* Apagar as caches é destruir a única cópia local da app. Fazê-lo sem nada
     do outro lado deixa a pessoa sem app até haver rede — e o botão que a leva
     ali é, muitas vezes, o do ecrã que a tranca por a versão ser velha demais. */
  test('o botão Atualizar não destrói a cópia local sem servidor do outro lado', () => {
    const f = nov.slice(nov.indexOf('CW.atualizarAgora'), nov.indexOf('function limparCaches'));
    assert.ok(f.indexOf('trocarDeWorker') < f.indexOf('servidorResponde'), 'primeiro tenta trocar');
    assert.ok(f.indexOf('servidorResponde') < f.indexOf('limparCaches'), 'e só apaga depois de o servidor responder');
    assert.match(f, /Sem ligação ao servidor/, 'e quando não responde, diz — em vez de recarregar para o nada');
    const sonda = nov.slice(nov.indexOf('function servidorResponde'), nov.indexOf('/* O caminho de todos os botões'));
    assert.match(sonda, /fetch\('\/versao\.json', \{ cache: 'no-store' \}\)/, 'pergunta ao servidor');
    assert.match(sonda, /setTimeout\(function \(\) \{ diz\(false\); \}, 4000\)/,
      'com tempo-limite: uma rede pendurada não é uma rede, e é o caso do portal cativo');
  });

  test('o registo não deixa o avisos.js vir da cache do browser', () => {
    assert.match(entrada, /register\('sw\.js', \{ updateViaCache: 'none' \}\)/,
      'o sw.js é igual entre versões; o que muda é o avisos.js que ele importa');
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
