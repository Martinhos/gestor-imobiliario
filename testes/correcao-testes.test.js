// A infraestrutura dos testes a verificar-se a si própria: o percurso da
// interface, o arnês e os workflows. São as redes que apanham o que os outros
// testes não veem, e cada uma estava desligada numa parte — um percurso que
// imprimia os erros das cenas e da página e dava verde, uma regra que prometia
// falhar e só media, um arnês invisível à cobertura, um workflow que não corria
// quando mudava o servidor, um tema que nunca era visto. O que aqui se prende é
// o que as volta a ligar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
// Recebe: rel — caminho a partir da raiz. Devolve: o texto do ficheiro, com fins de linha LF.
const ler = (rel) => readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const require = createRequire(import.meta.url);

/* O percurso só se carrega se não arrancar sozinho: sem a guarda do
   require.main, importá-lo corria o percurso inteiro contra um servidor que não
   está lá (e o Playwright, que o CI dos testes não instala). */
const fontePercurso = ler('testes/ui/percorrer.js');
const percurso = /require\.main === module/.test(fontePercurso) ? require('./ui/percorrer.js') : null;
// Devolve: o módulo do percurso; falha o teste se ele ainda arrancar ao ser lido.
const doPercurso = () => {
  assert.ok(percurso, 'o percorrer.js corre ao ser importado: não expõe as regras para se provarem');
  return percurso;
};

/* O corpo de uma função de topo de um ficheiro, do nome até à declaração de
   topo seguinte.
   Recebe: src — o texto; nome — o nome da função.
   Devolve: o texto do corpo (vazio se a função não existir). */
const corpoDe = (src, nome) => {
  const i = src.search(new RegExp('^(?:async )?function ' + nome + '\\(', 'm'));
  if (i < 0) return '';
  const fim = src.slice(i + 1).search(/^(?:async function|function|const|let|if \(require)/m);
  return fim < 0 ? src.slice(i) : src.slice(i, i + 1 + fim);
};

const GSI = '[GSI_LOGGER]: The given origin is not allowed for the given client ID.';
const R403 = 'Failed to load resource: the server responded with a status of 403 ()';
const R401 = 'Failed to load resource: the server responded with a status of 401 (Unauthorized)';

describe('o percurso da interface falha quando alguma coisa rebenta', () => {
  /* Várias cenas lançam de propósito para dizer que o estado não se montou («o
     mes nao mudou», «a pesquisa deixou a lista vazia»), e um ReferenceError na
     página era a avaria da v31. Iam para uma lista que se imprimia, e o
     processo saía com 0: medido, com uma cena a lançar e um erro na página, o
     percurso dizia «todos os invariantes cumpridos.». */
  // achado A.6-1
  test('uma cena que lança, um erro da página e um erro de consola são falhas — o ruído do Google não', () => {
    const { veredicto } = doPercurso();
    const erros = [
      { ecra: 'telemovel', onde: 'calendario-mes-seguinte', cena: 'calendario-mes-seguinte', erro: 'Error: o mes nao mudou: setembro de 2026' },
      { ecra: 'telemovel', onde: 'vista-dashboard', erro: 'txModal is not defined' },
      { ecra: 'telemovel', onde: 'entrada', consola: GSI, url: 'https://ssl.gstatic.com/_/gsi/_/js/k=gsi.gsi.pt_PT/m=credential_button_library' },
      { ecra: 'telemovel', onde: 'entrada', consola: R403, url: 'https://accounts.google.com/gsi/button?theme=outline&size=large' },
      { ecra: 'telemovel', onde: 'vista-contracts', consola: R403, url: 'http://127.0.0.1:8788/api/state' },
      { ecra: 'computador', onde: 'vista-settings', consola: 'Sincronização falhou: TypeError: x is undefined', url: 'http://127.0.0.1:8788/cloud/nucleo.js' },
    ];
    const { falhas, ruido } = veredicto([], erros, []);
    assert.deepEqual(falhas.map((f) => f.ecra + ' · ' + f.estado + ' · ' + f.regra), [
      'telemovel · calendario-mes-seguinte · a cena monta-se',
      'telemovel · vista-dashboard · a página não rebenta',
      'telemovel · vista-contracts · a consola não tem erros',
      'computador · vista-settings · a consola não tem erros',
    ]);
    assert.match(falhas[0].detalhe, /o mes nao mudou/, 'e diz porquê');
    assert.match(falhas[2].detalhe, /\/api\/state/, 'com o endereço: um 403 da nossa API não é o do Google');
    assert.equal(ruido.length, 2, 'o GSI_LOGGER e o 403 do botão do Google ficam de fora, e só esses');
  });

  test('o 401 que o percurso provoca ao perguntar por uma conta nova é ruído, e só esse', () => {
    const { veredicto } = doPercurso();
    const url = 'http://127.0.0.1:8788/api/auth/login';
    const e401 = { ecra: 'telemovel', onde: 'entrada', consola: R401, url };
    const provocado = [{ ecra: 'telemovel', url, status: 401 }];
    assert.equal(veredicto([], [e401], provocado).falhas.length, 0, 'provocado por quem corre o percurso');
    assert.equal(veredicto([], [e401], []).falhas.length, 1, 'sem ter sido provocado, é um erro');
    assert.equal(veredicto([], [e401, { ...e401 }], provocado).falhas.length, 1, 'um pedido provocado desculpa um erro, não dois');
    assert.equal(veredicto([], [{ ...e401, ecra: 'computador' }], provocado).falhas.length, 1, 'e só no ecrã onde foi provocado');
  });

  test('os invariantes quebrados continuam a ser falhas, com o ecrã e o estado', () => {
    const { veredicto } = doPercurso();
    const r = veredicto([{ ecra: 'computador', estado: 'modal-imovel', falhas: [{ regra: 'modal dentro do ecrã', detalhe: 'modal 0 em 2..814' }] }], [], []);
    assert.deepEqual(r.falhas, [{ ecra: 'computador', estado: 'modal-imovel', regra: 'modal dentro do ecrã', detalhe: 'modal 0 em 2..814' }]);
  });

  test('a lista do ruído de fora é curta, e cada entrada diz de onde vem pelo endereço', () => {
    const { RUIDO_DE_FORA } = doPercurso();
    assert.ok(RUIDO_DE_FORA.length <= 3, 'uma lista de permissão que cresce é um guarda que se desliga aos poucos');
    for (const r of RUIDO_DE_FORA) {
      assert.ok(r.texto instanceof RegExp && r.url instanceof RegExp && r.porque, JSON.stringify(r.porque));
      assert.doesNotMatch('http://127.0.0.1:8788/api/state', r.url, 'nada da própria app passa por ruído');
    }
  });

  test('o processo sai com 1 quando o veredicto tem falhas, e a frase final só aparece sem elas', () => {
    const correr = corpoDe(fontePercurso, 'correr');
    assert.match(correr, /veredicto\(resultados, erros, provocados\)/, 'o fim decide pelo veredicto, que junta tudo');
    const sai = correr.indexOf('process.exit(1)'), frase = correr.indexOf("'todos os invariantes cumpridos.'");
    assert.ok(sai > -1 && frase > sai, 'sai com 1 antes de chegar à frase');
    assert.doesNotMatch(correr, /erros\.slice\(0, ?8\)/, 'e os erros deixaram de ser só uma lista impressa');
  });
});

describe('o percurso corre quando muda o que ele exercita', () => {
  /* O percurso entra pela API a sério — cria a conta, semeia, lê o estado —,
     mas o filtro de caminhos deixava de fora o servidor e a base: uma
     alteração ao /api/auth/register ou uma migração que partisse o arranque
     não o disparava. */
  // achado A.6-3
  test('o workflow da interface dispara com o worker, as migrações e o wrangler.toml', () => {
    const wf = ler('.github/workflows/interface.yml');
    const listas = [...wf.matchAll(/^\s+paths: \[([^\]]*)\]/gm)]
      .map((m) => m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')));
    assert.equal(listas.length, 2, 'as duas listas: pull_request e push');
    for (const l of listas) {
      for (const p of ['web/**', 'testes/ui/**', 'worker/**', 'migrations/**', 'wrangler.toml',
        'package.json', 'package-lock.json', '.github/workflows/interface.yml']) {
        assert.ok(l.includes(p), p + ' em falta em [' + l.join(', ') + ']');
      }
    }
  });
});

describe('a cobertura vê o cliente', () => {
  /* O relatório de cobertura do node --test só conta scripts cujo endereço é
     file:. O arnês avaliava o web/ com o caminho relativo (app/dados.js), e os
     dois terços do código onde estão as hipotecas, o IRS e os prazos não
     apareciam — o CI media só o worker/ e os scripts/. Prova-se no mecanismo
     de que o relatório se alimenta: a cobertura em bruto do V8. */
  // achado A.6-4a
  test('o arnês avalia o web/ com um endereço file://, que é o que o relatório de cobertura conta', () => {
    const d = mkdtempSync(path.join(tmpdir(), 'cobertura-'));
    try {
      const arnes = pathToFileURL(path.join(RAIZ, 'testes', 'arnes.js')).href;
      const r = spawnSync(process.execPath, ['-e', "import('" + arnes + "').then((m) => m.carregarBase())"],
        { env: { ...process.env, NODE_V8_COVERAGE: d }, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const urls = readdirSync(d).flatMap((f) => JSON.parse(readFileSync(path.join(d, f), 'utf8')).result.map((s) => s.url));
      const dados = pathToFileURL(path.join(RAIZ, 'web', 'app', 'dados.js')).href;
      assert.ok(urls.includes(dados),
        'o dados.js não aparece na cobertura; do web/ aparece: ' + urls.filter((u) => /dados\.js$/.test(u)).join(', '));
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe('a regra dos alvos de toque falha no ecrã de dedo', () => {
  const invariantes = require('./ui/invariantes.js');
  const teto = Number((/const TETO_ALVOS_PEQUENOS = (\d+);/.exec(ler('testes/ui/invariantes.js')) || [])[1]);

  /* Corre as regras numa página de faz-de-conta que só tem botões — o resto das
     regras encontra listas vazias e cala-se.
     Recebe: botoes — [{w, h, cls}] (cls: o seletor a que o botão responde);
     dedo — se a página responde a (pointer:coarse).
     Devolve: o {falhas, medidas} que as regras devolvem. */
  const correr = (botoes, dedo) => {
    const els = botoes.map((b) => ({
      offsetParent: {}, textContent: 'Pagar', tagName: 'BUTTON', children: [],
      getBoundingClientRect: () => ({ top: 10, left: 10, width: b.w, height: b.h, bottom: 10 + b.h, right: 10 + b.w }),
      matches: (s) => s.split(',').some((x) => x.trim() === b.cls),
      getAttribute: (a) => (a === 'class' ? b.cls.slice(1).split('.').join(' ') : null),
      querySelector: () => null, classList: { contains: () => false },
    }));
    const caixa = {
      document: {
        documentElement: { scrollWidth: 375, clientWidth: 375, classList: { contains: () => false } },
        querySelectorAll: (sel) => (sel.startsWith('button, a[data-click]') ? els : []),
        querySelector: () => null, getElementById: () => null,
      },
      innerWidth: 375, innerHeight: 812,
      matchMedia: (q) => ({ matches: dedo && /pointer:\s*coarse/.test(q) }),
      getComputedStyle: () => ({ position: 'static', transform: 'none', filter: 'none', overflow: 'visible',
        overflowX: 'visible', overflowY: 'visible', display: 'block', opacity: '1', visibility: 'visible', pointerEvents: 'auto', zIndex: 'auto' }),
    };
    return JSON.parse(JSON.stringify(vm.runInNewContext(invariantes.fonte(), caixa)));
  };

  /* O comentário dizia «abaixo disso falha-se o botão» e o corpo só contava.
     O desenho (docs/design.md, «Toque e acessibilidade») diz onde a regra vale:
     em ecrã de dedo, e só aí — no rato os tamanhos compactos são os certos. */
  // achado A.6-5
  test('no ecrã de dedo, mais tipos de alvo abaixo de 40px do que o teto falham; no rato só se medem', () => {
    assert.ok(Number.isInteger(teto), 'o teto dos alvos pequenos está declarado, como o das famílias');
    const pequenos = Array.from({ length: teto + 1 }, (_, i) => ({ w: 90, h: 33, cls: '.btn.k' + i }));
    const aoDedo = correr(pequenos, true);
    assert.ok(aoDedo.falhas.some((f) => /alvos de toque/.test(f.regra)), 'falha: ' + JSON.stringify(aoDedo.falhas));
    const aoRato = correr(pequenos, false);
    assert.deepEqual(aoRato.falhas, [], 'no rato os tamanhos compactos são os certos');
    assert.equal(aoRato.medidas.alvosPequenos, teto + 1, 'mas continuam a medir-se');
    const noTeto = correr(pequenos.slice(1), true);
    assert.deepEqual(noTeto.falhas, [], 'até ao teto, não falha');
    const declarados = correr(Array.from({ length: teto + 1 }, () => ({ w: 28, h: 28, cls: '.tag button' })), true);
    assert.deepEqual(declarados.falhas, [], 'o que a folha declara mais pequeno de propósito não conta');
    const caixas = correr(Array.from({ length: teto + 9 }, () => ({ w: 36, h: 42, cls: '.selbox' })), true);
    assert.deepEqual(caixas.falhas, [], 'uma caixa por linha é um tipo só: o teto não depende de quantos movimentos há');
    assert.deepEqual(caixas.medidas.tiposPequenos, ['button.selbox'], 'e o tipo diz-se, a tag e as classes');
  });

  test('os ecrãs de telemóvel do percurso são de dedo, e o computador não', () => {
    const { ECRAS } = doPercurso();
    for (const e of ECRAS) assert.equal(!!e.toque, /^telemovel/.test(e.nome), e.nome);
    assert.match(fontePercurso, /hasTouch: ecra\.toque/, 'e o contexto do browser nasce com toque');
  });
});

describe('o lint', () => {
  /* As declarações de topo de um ficheiro do index.html, com a regra do
     globais.test.js (só o que começa na coluna zero, sem comentários).
     Recebe: src — o texto. Devolve: os nomes. */
  const declaracoes = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, '').split('\n')
    .map((l) => (/^(?:var|let|const|function|class|async function)\s+([A-Za-z_$][\w$]*)/.exec(l) || [])[1])
    .filter(Boolean);

  /* O ESLint não se descarrega sem autorização. A configuração fica pronta e
     lê-se aqui sem ele (carrega sem o pacote globals); o passo do CI instala os
     dois. */
  // achado A.6-10
  test('a configuração lê o web/ como scripts num só âmbito, com os globais tirados dos ficheiros do index.html', async () => {
    const cfg = (await import(pathToFileURL(path.join(RAIZ, 'eslint.config.mjs')).href)).default;
    assert.ok(Array.isArray(cfg), 'a configuração plana é uma lista');
    const web = cfg.find((b) => (b.files || []).includes('web/app/*.js'));
    assert.ok(web, 'há um bloco para o web/app');
    assert.ok(web.files.includes('web/cloud/*.js'), 'que junta a nuvem, no mesmo âmbito');
    assert.equal(web.languageOptions.sourceType, 'script', 'scripts clássicos, e não módulos');
    const { TUDO } = await import('./arnes.js');
    const nomes = new Set(TUDO.flatMap((rel) => declaracoes(ler('web/' + rel))));
    assert.ok(nomes.size > 1000, 'leu ' + nomes.size + ' nomes');
    const globais = web.languageOptions.globals;
    assert.deepEqual([...nomes].filter((n) => !(n in globais)), [], 'cada nome de topo é um global para os outros ficheiros');
    const regras = web.rules;
    assert.equal(regras['no-undef'], 'error', 'o nome mal escrito, que é a razão disto');
    assert.equal(regras['no-dupe-keys'], 'error');
    assert.deepEqual(regras['no-redeclare'], ['error', { builtinGlobals: false }],
      'cada ficheiro declara os seus globais: contá-los como redeclaração acusava a app inteira');
    assert.equal(regras['no-unused-vars'][1].vars, 'local', 'uma função de topo é chamada pelo onclick de outro ficheiro');
    const worker = cfg.find((b) => (b.files || []).some((f) => f.startsWith('worker/')));
    assert.equal(worker.languageOptions.sourceType, 'module');
  });

  test('o CI corre-o a seguir ao node --check, e trava: a primeira leitura saiu limpa', () => {
    const ci = ler('.github/workflows/testes.yml');
    const i = ci.indexOf('- name: Lint');
    assert.ok(i > ci.indexOf('- name: Verificar a sintaxe de todos os módulos'), 'o passo existe, a seguir ao node --check');
    const passo = ci.slice(i, ci.indexOf('\n      - ', i + 1));
    assert.doesNotMatch(passo, /continue-on-error/, 'o lint está limpo: um problema novo parte o build');
    // as versões provadas, e só essas: uma subida é uma mudança feita de propósito, com este teste a mexer.
    // A linha do install inteira, e não uma linha qualquer do passo: assim não passa um pacote a mais
    // antes do eslint, nem um comentário que repita as versões certas enquanto o install usa outras.
    assert.match(passo, /^\s*npm install --prefix \/tmp\/lint --no-save --no-audit --no-fund eslint@10\.10\.0 globals@16\.5\.0$/m,
      'instalado aqui, fixado às versões provadas, fora do package.json');
    assert.match(passo, /--no-save/);
    assert.match(passo, /eslint \./);
  });

  /* O NA_PAGINA do eslint.config.mjs, lido do texto (não é exportado): o
     objeto literal, avaliado à parte, sem nada à volta.
     Devolve: {padrão de ficheiros: {app, browser}}. */
  const lerNaPagina = () => {
    const m = /\nconst NA_PAGINA = (\{[\s\S]*?\n\});/.exec(ler('eslint.config.mjs'));
    assert.ok(m, 'o NA_PAGINA está no eslint.config.mjs');
    return vm.runInNewContext('(' + m[1] + ')');
  };

  /* da segunda revisão do lint. LIMITE: a metade do browser só se prova com o
     pacote globals presente (à mão, ou na junção node_modules/globals desta
     máquina). No CI, o npm test corre antes do passo do Lint, sem o pacote: a
     configuração dá G('browser') = {}, não há nome do browser nenhum para ver,
     e essa metade passa sem provar nada — o teste di-lo na saída. A metade da
     app trava sempre, com ou sem o pacote. */
  test('os ficheiros que conduzem a página só ganham os nomes da página que o NA_PAGINA lhes dá, e nenhum outro da app ou do browser', async (t) => {
    const mod = await import(pathToFileURL(path.join(RAIZ, 'eslint.config.mjs')).href);
    const cfg = mod.default;
    const APP = mod.globaisDaApp();
    // como a configuração: sem o pacote globals (o CI dos testes não o instala) fica só a metade da app
    let globais = null;
    try { globais = (await import('globals')).default; } catch (e) { globais = null; }
    if (!globais) t.diagnostic('sem o pacote globals: a metade do browser deste teste não prova nada nesta corrida (só a da app)');
    else assert.ok(Object.keys(globais.browser).length > 100, 'controlo: com o pacote, a metade do browser vê mesmo os nomes do browser');
    const doNode = globais ? globais.node : {};
    const doBrowser = globais ? globais.browser : {};
    const NA = lerNaPagina();
    assert.deepEqual(Object.keys(NA).sort(), ['scripts/capturas.js', 'testes/ui/*.js'], 'controlo: os dois lados que conduzem a página');
    for (const [ficheiros, { app, browser }] of Object.entries(NA)) {
      const blocos = cfg.filter((b) => (b.files || []).includes(ficheiros));
      assert.ok(blocos.length, 'há blocos para ' + ficheiros);
      const g = Object.assign({}, ...blocos.map((b) => (b.languageOptions || {}).globals || {}));
      // controlo: o que o NA_PAGINA dá chega mesmo lá
      for (const n of app) assert.ok(n in g, ficheiros + ': ' + n + ' é um global');
      const daApp = Object.keys(APP).filter((n) => n in g && !(n in doNode) && !app.includes(n));
      assert.deepEqual(daApp, [], ficheiros + ': um nome da app fora do NA_PAGINA deixava de ser acusado no lado do Node');
      const doBrowserAMais = Object.keys(g).filter((n) => n in doBrowser && !(n in doNode) && !browser.includes(n));
      assert.deepEqual(doBrowserAMais, [], ficheiros + ': os nomes do browser não passam da lista');
    }
  });
});

describe('o percurso espera por condições, e não por tempos', () => {
  /* 1,2 s, 1,8 s, 0,4 s e 2,2 s na entrada, e 250 e 350 ms em cada vista e
     cena: num runner lento não chegavam (e o percurso caía no «não deu para
     entrar»), num rápido sobravam. */
  // achado A.6-14
  test('a entrada espera pela resposta do servidor e pela sessão posta', () => {
    assert.doesNotMatch(fontePercurso, /\bdormir\(|setTimeout\(r, ?ms\)/, 'nenhuma espera fixa');
    const submeter = corpoDe(fontePercurso, 'submeter');
    assert.match(submeter, /waitForResponse\(/, 'espera pelo pedido de entrada ou de registo');
    // uma FUNÇÃO, e não um texto: um predicado em texto é avaliado com eval na página, e a CSP não tem 'unsafe-eval'
    assert.match(submeter, /waitForFunction\(\(\) => !!\(window\.CW && window\.CW\.user\)/, 'e pela sessão no cliente');
    assert.match(corpoDe(fontePercurso, 'entrar'), /submeter\(pagina, '\/api\/auth\/login'\)/);
    assert.match(corpoDe(fontePercurso, 'preparar'), /CW\._pulled/, 'semeia depois de o servidor ter falado');
  });

  test('as vistas e as cenas medem-se depois de a página assentar', () => {
    const repouso = corpoDe(fontePercurso, 'repouso');
    assert.match(repouso, /MutationObserver/, 'nenhuma mudança no DOM durante um bocado');
    assert.match(repouso, /getAnimations\(\)/, 'e as animações acabadas');
    assert.match(corpoDe(fontePercurso, 'verificar'), /await repouso\(pagina\)/);
  });
});

describe('os dois temas', () => {
  /* Os três contextos nasciam em escuro: metade do que as pessoas veem nunca
     passava pela única rede que olha para o ecrã, nem pelo parecer do modelo,
     que julga contraste e legibilidade. A app segue o sistema em automático
     (tema.js:isDark), por isso o colorScheme do contexto chega. */
  // achado A.6-15
  test('o percurso vê a app no tema claro e no escuro, e o parecer do modelo recebe os dois', () => {
    const { ECRAS } = doPercurso();
    assert.deepEqual([...new Set(ECRAS.map((e) => e.tema))].sort(), ['dark', 'light']);
    const claro = ECRAS.find((e) => e.tema === 'light');
    assert.ok(claro.width < 900 && claro.toque, 'o claro num telemóvel, que é onde aperta');
    assert.match(fontePercurso, /colorScheme: ecra\.tema/, 'e o contexto nasce no tema do ecrã');
    assert.match(ler('testes/ui/avaliar.js'), new RegExp("'" + claro.nome + '__'), 'o modelo vê capturas do claro');
  });
});
