// Novidades e versões: a lista que define a versão, o filtro por
// funcionalidade, e o ficheiro que a app vai buscar para saber se está
// atrasada. Uma versão errada aqui põe a app a pedir-se atualizações a si
// própria em ciclo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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

  /* A regra esteve ao contrário — guardava-se tudo o que não estivesse numa
     lista de exclusões — e o Cache API não lê Cache-Control nenhum. Passavam
     por lá páginas feitas à medida de quem as pede: o /equipa com a sessão da
     equipa lá dentro, o /equipa/entrar com o bilhete no endereço, o /termos, a
     montra, o APK. E a cache não tinha tecto nenhum. */
  test('só entra na cache o que o install lá pôs', () => {
    assert.match(sw, /if \(SHELL\.indexOf\(url\.pathname\) < 0\) return;/,
      'lista de permissão, não de exclusões — senão anda-se a acrescentar exceções para sempre');
    assert.match(sw, /if \(url\.origin !== self\.location\.origin\) return;/,
      'e nada de outra origem: o filtro era só por caminho');
  });

  /* O Cache.match compara o URL inteiro, query incluída, e a app manda por
     email endereços com parâmetros. Cada um deles falhava sempre na cache e
     ia buscar o index.html à REDE, enquanto os <script src> dele, sem query,
     acertavam na cache da versão antiga — a avaria da v31 sem worker nenhum
     trocar. */
  test('uma navegação serve-se sempre pela mesma chave', () => {
    assert.match(sw, /const chave = e\.request\.mode === 'navigate' \? '\/index\.html' : e\.request;/);
    const f = sw.slice(sw.indexOf("addEventListener('fetch'"));
    assert.doesNotMatch(f, /\.match\(e\.request\)/, 'nunca pela chave que a pessoa clicou');
    assert.doesNotMatch(f, /c\.put\(e\.request/,
      'nem se grava por ela: essas ligações levam segredos no endereço');
  });

  test('não se guarda o que não é uma resposta inteira, nem se cala o falhanço', () => {
    assert.match(sw, /res\.status === 200 && res\.type === 'basic'/,
      'o res.ok abrange o 206, e uma resposta parcial guardada é uma resposta partida');
    assert.match(sw, /c\.put\(chave, res\.clone\(\)\)\.catch\(/,
      'o put comunica os falhanços numa promessa rejeitada — um try/catch não apanha nada');
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
    ['rendorium.com', 'www.rendorium.com'].forEach((h) => {
      assert.ok(lista.includes(h),
        h + ' é a montra — e a app existe lá, porque só o «/» passa pelo worker');
    });
    assert.match(sw, /SEM_CACHE\.indexOf\(hn\) < 0/, 'é uma exclusão, não uma permissão');
    assert.match(sw, /gestor-imobiliario-dev\./,
      'o worker de dev também tem endereço em workers.dev');
    /* Os endereços de pré-visualização de versão do Cloudflare levam o nome do
       worker a seguir a um prefixo, e um indexOf === 0 deixava-os cair do lado
       de produção. Testa-se a regra a correr, com os dois casos. */
    const re = /const DEV_WD = (\/.*\/)\.test\(hn\)/.exec(sw);
    assert.ok(re, 'o nome do worker de dev é um rótulo, não um prefixo do hostname');
    const dev = new RegExp(re[1].slice(1, -1));
    assert.ok(dev.test('gestor-imobiliario-dev.abc.workers.dev'), 'o endereço normal do dev');
    assert.ok(dev.test('a1b2-gestor-imobiliario-dev.abc.workers.dev'), 'e o de pré-visualização');
    assert.ok(!dev.test('gestor-imobiliario.abc.workers.dev'),
      'mas o de produção continua a guardar — é onde estão as instalações antigas');
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

  /* A cura é a ação mais destrutiva da app: apaga a única cópia local e larga
     o service worker. Offline, isso troca «meia app partida» por «nenhuma
     app», e sem volta enquanto a rede não voltar. */
  test('não se cura sem rede, e sai sem gastar a tentativa', () => {
    assert.match(bloco, /if \(navigator\.onLine === false\) return;/,
      'só o === false é de confiança: o true mente com portal cativo e afins');
    assert.ok(bloco.indexOf('navigator.onLine') < bloco.indexOf('aCurar = true'),
      'antes de marcar seja o que for, senão gasta a cura da sessão sem fazer nada');
    assert.ok(bloco.indexOf('navigator.onLine') < bloco.indexOf('setTimeout'),
      'e antes do temporizador que recarrega de qualquer maneira');
  });

  /* Numa app instalada a «sessão» não é uma visita: o sessionStorage
     sobrevive a recargas e a janela pode ficar aberta semanas. Guardar só QUE
     se curou desarmava a rede de segurança para o resto da vida do separador. */
  test('a rede de segurança volta a armar-se', () => {
    assert.match(bloco, /Date\.now\(\) - antes < 6e5/, 'dez minutos, e não para sempre');
    assert.match(bloco, /setItem\(CHAVE, String\(Date\.now\(\)\)\)/, 'guarda quando, não só que');
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

  /* A lista SHELL e os <script src> do index.html são duas listas escritas à
     mão que têm de dizer o mesmo. O CI já confirma um dos sentidos, e só para
     os módulos: que cada web/app/*.js e web/cloud/*.js aparece nos dois. Falta
     o resto — o avisos.js, o legal.js, o manifesto, os ícones — e falta o
     sentido contrário, que é uma entrada na SHELL que não corresponde a
     ficheiro nenhum. Uma delas rebenta o addAll INTEIRO (o addAll é tudo ou
     nada), portanto a cache fica vazia e a app não abre offline. E agora que
     a SHELL é também a lista de permissão do fetch, uma omissão tira um
     ficheiro da cache em silêncio. */
  const sw = ler('web/sw.js');
  const lista = (nome) => {
    const m = new RegExp('const ' + nome + ' = \\[([\\s\\S]*?)\\]').exec(sw);
    assert.ok(m, 'a lista ' + nome + ' existe no sw.js');
    return m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  };
  const SHELL = lista('SHELL')
    .concat(lista('APP').map((n) => '/app/' + n + '.js'))
    .concat(lista('NUVEM').map((n) => '/cloud/' + n + '.js'));

  test('tudo o que o index.html carrega está na shell offline', () => {
    const srcs = (html.match(/src="([^"]+\.js)"/g) || []).map((s) => '/' + s.slice(5, -1));
    assert.ok(srcs.length > 40, 'apanhou os <script src> todos: ' + srcs.length);
    srcs.forEach((s) => assert.ok(SHELL.includes(s), s + ' não está na SHELL do sw.js'));
  });

  test('e tudo o que está na shell existe mesmo', () => {
    SHELL.filter((p) => p !== '/').forEach((p) => {
      assert.ok(existsSync(new URL('../web' + p, import.meta.url)),
        p + ' está na SHELL e não existe — o addAll é tudo ou nada, e falha inteiro');
    });
  });

  test('sem repetições, que escondem uma troca', () => {
    assert.equal(new Set(SHELL).size, SHELL.length, SHELL.join(' '));
  });
});
