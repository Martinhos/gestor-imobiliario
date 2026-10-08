/* Percorre a app e verifica o interface em cada estado.
   ----------------------------------------------------
     node testes/ui/percorrer.js [url]        (por omissão http://127.0.0.1:8788)
     node testes/ui/percorrer.js --sem-fotos  só as regras, sem capturas

   Faz duas coisas de cada vez:

   1. Verifica invariantes — nada transborda, os menus cabem, os modais
      cobrem o que está por trás e não deixam passar o toque. São regras
      duras: falham o processo. Cada uma nasceu de um defeito real. E falham
      também uma cena que não se monta, um erro na página e um erro na
      consola que não seja o ruído conhecido de fora (veredicto, lá em baixo).

   2. Guarda uma captura e um resumo de cada estado em testes/ui/relatorio/,
      para o avaliar.js os dar a ler a um modelo. A qualidade de um interface
      não cabe numa asserção; o que cabe é a estabilidade.

   Precisa da app a correr. Em CI é o workflow que a levanta. Lido por um
   require (os testes), não arranca: expõe as regras e mais nada. */

const fs = require('fs');
const path = require('path');
const invariantes = require('./invariantes.js');
const { lerCatalogo } = require('../lib/catalogo.cjs');

const URL_BASE = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8788';
const SEM_FOTOS = process.argv.includes('--sem-fotos');
const SAIDA = path.join(__dirname, 'relatorio');

/* Os ecrãs. O toque (hasTouch) é o que faz o Chromium responder a
   (pointer:coarse), que é onde a app põe os mínimos de toque
   (index.html:@media(pointer:coarse)) e onde a regra dos alvos falha
   (invariantes.js): sem ele, um telemóvel era medido com os tamanhos do rato.
   Só o toque, sem isMobile — com ele o Chromium desenha a 980px e encolhe.
   O tema é o do sistema, que a app segue em automático (tema.js:isDark):
   o claro, metade do que as pessoas veem, nunca passava por aqui. Fica um
   telemóvel em claro, que é onde aperta. */
const ECRAS = [
  { nome: 'telemovel', width: 375, height: 812, toque: true, tema: 'dark' },
  { nome: 'telemovel-deitado', width: 915, height: 412, toque: true, tema: 'dark' },
  { nome: 'computador', width: 1440, height: 900, toque: false, tema: 'dark' },
  { nome: 'telemovel-claro', width: 375, height: 812, toque: true, tema: 'light' },
];

/* Os separadores que o percurso visita: os serviços do catálogo
   (web/app/servicos.js:SERVICOS, lido por testes/lib/catalogo.cjs, o mesmo
   leitor do arnês), pela ordem do menu, mais as Definições. A
   conta do percurso não tem serviços desligados, por isso todos abrem; um
   serviço novo entra aqui sozinho, e um desligado numa conta nunca se
   visita — é o registo que decide, não uma lista à parte. */
const VISTAS = lerCatalogo().map((s) => s.id).concat(['settings']);

/* Estados que só existem depois de mexer: modais, menus abertos, modo de
   edição. O «fazer» de cada cena é uma FUNÇÃO, e não texto: um predicado ou um
   corpo em texto é avaliado com eval dentro da página, e a CSP não tem
   'unsafe-eval' — o Playwright levava com um EvalError e a cena não se montava.
   Passado como função, o Playwright entrega-a pelo protocolo e ela corre sem
   eval nenhum. Vale para tudo neste ficheiro: evaluate e waitForFunction. Os
   nomes da app que as cenas chamam estão declarados em eslint.config.mjs:NA_PAGINA. */
const CENAS = [
  { nome: 'modal-movimento', fazer: () => { txModal({ kind: 'expense' }); } },
  { nome: 'modal-imovel', fazer: () => { propModal(); } },
  { nome: 'modal-contrato', fazer: () => { ctModal(); } },
  { nome: 'modal-pessoa', fazer: () => { personModal('tenant'); } },
  {
    nome: 'menu-no-fundo-do-modal',
    fazer: () => {
      txModal({ kind: 'expense' });
      [...document.querySelectorAll('.modal.open .fold-head')].forEach((h) => h.click());
      const b = document.querySelector('.modal.open .body');
      const s = [...document.querySelectorAll('.modal.open .selbtn')].filter((x) => x.offsetParent).pop();
      if (s) { const r = b.getBoundingClientRect(); b.scrollTop += s.getBoundingClientRect().top - (r.bottom - 55); s.click(); }
    },
  },
  {
    nome: 'modais-empilhados',
    fazer: () => { txModal({ kind: 'expense' }); pickModal('Escolhe', [{ v: 1, label: 'Um' }, { v: 2, label: 'Dois' }], () => {}); },
  },
  { nome: 'painel-de-filtros', fazer: () => { go('properties'); render(); document.getElementById('hdrFilt').click(); } },
  { nome: 'novidades', fazer: () => { CW.verNovidades(AVISOS.slice(0, 1)); } },
  { nome: 'tutorial', fazer: () => { CW.guiaAbrir('imoveis'); } },
  {
    // o caso que estava partido: o cartão ficava por baixo da janela
    nome: 'tutorial-sobre-janela',
    fazer: () => { CW.guiaAbrir('perfil'); propModal(); },
  },
  {
    /* A ficha de leitura: o que tocar num registo passa a abrir. Antes disto,
       tocar num imovel abria um formulario de vinte e um campos com o
       «Apagar imovel» encostado ao titulo. */
    nome: 'ficha-de-imovel',
    fazer: () => { propView(db.properties[0].id); },
  },
  { nome: 'ficha-de-contrato', fazer: () => { ctView(db.contracts[0].id); } },
  {
    /* Uma janela aberta com a PAGINA ROLADA. Era o estado em que a pagina
       deixava de ser pintada por tras — e nenhuma cena o mostrava, porque
       todas abrem as janelas no topo, onde o recorte coincidia com o visivel
       e o defeito era invisivel. */
    nome: 'ficha-com-a-pagina-rolada',
    fazer: () => {
      go('transactions'); render(); window.scrollTo(0, 700);
      txView(db.transactions[0].id);
    },
  },
  { nome: 'ficha-de-movimento', fazer: () => { txView(db.transactions[0].id); } },
  { nome: 'ficha-de-inquilino', fazer: () => { personView('tenant', db.tenants[0].id); } },
  { nome: 'ficha-de-planeado', fazer: () => { recView(db.recurring[0].id); } },
  {
    /* Um aviso VISIVEL com uma janela aberta. O aviso mora a 22px do fundo,
       que e onde o rodape do modal esta, e caia em cima de «Guardar» — os
       botoes que se esta precisamente a pedir para carregar. A ordem importa,
       e e esta a que faltava: a janela abre com um aviso ja no ecra. */
    nome: 'aviso-sobre-janela',
    fazer: () => { toast('Guardado.', { rotulo: 'Anular', fn() {}, ms: 60000 }); propModal(); },
  },
  {
    nome: 'primeiros-passos',
    fazer: () => { localStorage.removeItem('gi_passos_fora'); go('dashboard'); render(); },
  },
  { nome: 'edicao-dos-cartoes', fazer: () => { go('dashboard'); render(); CW.enterEdit(); } },
  {
    /* Ler um grafico com o dedo: o gesto novo desta fase. Sem uma cena, o que
       so aparece enquanto se arrasta nao e visto por ninguem — foi assim que o
       selo da sincronizacao viveu em cima do sino sem ninguem dar por isso. */
    nome: 'grafico-lido-com-o-dedo',
    fazer: () => {
      go('dashboard'); render();
      const c = document.querySelector('#view .chartbox[data-lido]');
      if (!c) throw new Error('nenhum grafico se deixa ler');
      const r = c.getBoundingClientRect();
      const ev = (t, x) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 1,
        pointerType: 'touch', isPrimary: true, clientX: x, clientY: r.top + r.height / 2, buttons: 1 });
      c.dispatchEvent(ev('pointerdown', r.left + r.width * 0.45));
      document.dispatchEvent(ev('pointermove', r.left + r.width * 0.7));
      if (!c.classList.contains('a-ler')) throw new Error('arrastar nao poe o grafico a ler');
    },
  },
  { nome: 'selo-por-enviar', fazer: () => { go('dashboard'); render(); setSyncBadge('pend', 3); } },
  { nome: 'selo-sem-ligacao', fazer: () => { go('dashboard'); render(); setSyncBadge('off'); } },
  { nome: 'selo-guardado', fazer: () => { go('dashboard'); render(); setSyncBadge('ok'); } },
  {
    /* Andar no calendario, que e o gesto desta vista. O percurso passava por
       ca e nunca mudava de mes: tres defeitos seguidos nesta zona nao podiam
       falhar em CI, porque o ecra estava coberto e os gestos nao. */
    nome: 'calendario-mes-seguinte',
    fazer: () => {
      go('calendar'); render();
      const m0 = document.querySelector('#view .toolbar b').textContent.trim();
      calNav(1);
      const m1 = document.querySelector('#view .toolbar b').textContent.trim();
      if (m0 === m1) throw new Error('o mes nao mudou: ' + m0);
    },
  },
  {
    /* O caso que falhou a serio: voltar ao mes de hoje pela SETA deixa o calMes
       posto (com o mes de hoje la dentro), e o botao ficava no ecra sem nada
       para fazer. Duas voltas, uma para cada lado. */
    nome: 'calendario-voltar-pela-seta',
    fazer: () => {
      go('calendar'); render();
      calNav(1); calNav(-1);
      calNav(-1); calNav(1);
    },
  },
  {
    nome: 'calendario-botao-hoje',
    fazer: () => {
      go('calendar'); render();
      calNav(2);
      const b = [...document.querySelectorAll('#view .toolbar .btn')].find((x) => x.textContent.trim() === 'Hoje');
      if (!b) throw new Error('dois meses a frente e sem botao Hoje');
      b.click();
    },
  },
  {
    /* Escolher um dia repinta so o painel de baixo (calSel), sem passar pelo
       render — e um dos tres repintes locais da app. */
    nome: 'calendario-dia-escolhido',
    fazer: () => {
      go('calendar'); render();
      const d = [...document.querySelectorAll('#view .calday.tap')];
      if (d.length < 8) throw new Error('a grelha do mes tem ' + d.length + ' dias tocaveis');
      d[7].click();
      if (!document.querySelector('#view .calday.on')) throw new Error('nenhum dia ficou escolhido');
    },
  },
  {
    /* O caminho curto: mudar o que se ve sem passar pelo render. E aqui que
       uma linha pode ficar sem as decoracoes da nuvem e ninguem dar por isso —
       a lista fica certa a olho e o kebab desapareceu. */
    nome: 'movimentos-filtrados-sem-render',
    fazer: () => {
      go('transactions'); render();
      const n0 = document.querySelectorAll('#view .txrow').length;
      if (!n0) throw new Error('a vista dos Movimentos nao tem linhas');
      txSearch = 'a'; refrescarMovimentos();
      const n1 = document.querySelectorAll('#view .txrow').length;
      if (n1 === 0) throw new Error('a pesquisa deixou a lista vazia: a cena nao prova nada');
      if (n1 > n0) throw new Error('a pesquisa devolveu mais linhas do que havia');
    },
  },
  {
    /* E o mesmo com a selecao ligada: as linhas refeitas nascem sem a marca, e
       e o motor que tem de a repor. */
    nome: 'movimentos-filtrados-em-selecao',
    fazer: () => {
      go('transactions'); render();
      const l = document.querySelector('#view .txrow');
      if (!l) throw new Error('a vista dos Movimentos nao tem linhas');
      CW.selEntrar(l.getAttribute('data-tx'));
      txSearch = 'a'; refrescarMovimentos();
    },
  },
  {
    nome: 'selecao-de-movimentos',
    fazer: () => {
      go('transactions'); render();
      const l = document.querySelector('#view .txrow');
      if (!l) throw new Error('a vista dos Movimentos não tem linhas: a cena não prova nada');
      CW.selEntrar(l.getAttribute('data-lp').replace('tx:', ''));
    },
  },
  {
    /* Marcar várias e repintar por OUTRO caminho que não o de entrar em
       seleção. O selToggle só repinta as marcas (selPintar), sem regerar
       linha nenhuma; o render a seguir regera-as todas, e as marcas têm de lá
       estar à mesma. Uma cena que apenas entrasse em seleção não provava
       nada: o CW.selEntrar já repinta por dentro. */
    nome: 'selecao-marcada-sobrevive-a-repintura',
    fazer: () => {
      go('transactions'); render();
      const ls = [...document.querySelectorAll('#view .txrow')];
      if (ls.length < 3) throw new Error('sem movimentos que cheguem para marcar (' + ls.length + ')');
      CW.selEntrar(ls[0].getAttribute('data-tx'));
      [...document.querySelectorAll('#view .txrow')].slice(1, 3)
        .forEach((l) => CW.selToggle(l.getAttribute('data-tx')));
      txDir = txDir === 'desc' ? 'asc' : 'desc';   // uma repintura que não vem da seleção
      render();
    },
  },
  {
    nome: 'selecao-com-tudo-marcado',
    fazer: () => {
      go('transactions'); render();
      const l = document.querySelector('#view .txrow');
      if (!l) throw new Error('a vista dos Movimentos não tem linhas: a cena não prova nada');
      CW.selEntrar(l.getAttribute('data-lp').replace('tx:', '')); CW.selTodos();
    },
  },
];

/* O ruído de fora, e só esse. O Google Sign-In recusa a origem local — o
   cliente OAuth só conhece os domínios publicados (wrangler.toml:
   GOOGLE_CLIENT_ID) — e di-lo duas vezes na consola: o GSI_LOGGER da
   biblioteca e o 403 do botão que ela pede. Nada disto é da app, e cada
   entrada diz de onde vem pelo ENDEREÇO, não só pelo texto: um 403 da nossa
   API não é ruído. Tudo o resto que chega à consola como erro trava — um erro
   que se imprime e não trava é um erro que ninguém lê. Curta de propósito:
   uma lista de permissão que cresce é um guarda que se desliga aos poucos. */
const RUIDO_DE_FORA = [
  {
    porque: 'o Google Sign-In recusa a origem local',
    texto: /^\[GSI_LOGGER\]: The given origin is not allowed for the given client ID\.$/,
    url: /^https:\/\/(?:accounts\.google\.com\/gsi\/|ssl\.gstatic\.com\/_\/gsi\/)/,
  },
  {
    porque: 'o 403 do botão do Google, pela mesma recusa',
    texto: /^Failed to load resource: the server responded with a status of 403 \(\)$/,
    url: /^https:\/\/accounts\.google\.com\/gsi\//,
  },
  /* A biblioteca do Google aplica estilos em linha de duas maneiras: uma folha,
     que a CSP aceita pelo sha256 que o worker/src/index.js lhe dá, e dois
     ATRIBUTOS de estilo, que um hash não cobre (só com 'unsafe-hashes', que
     abriria a porta a todos). Ficam recusados, e o browser di-lo na consola.
     Medido no ecrã de entrada: com a folha permitida, o botão tem os mesmos
     72px de altura que tem sem CSP nenhuma — os dois atributos não mudam nada
     do que se vê. Só do endereço deles: uma recusa da CSP num ficheiro nosso
     não é ruído e continua a falhar o percurso. */
  {
    porque: 'o Google Sign-In põe estilo num atributo, que a CSP recusa sem efeito no que se vê',
    texto: /^Applying inline style violates the following Content Security Policy directive/,
    url: /^https:\/\/accounts\.google\.com\/gsi\//,
  },
];

// As regras do veredicto que não são invariantes: vêm dos erros apanhados pelo caminho.
const REGRAS_DE_ERRO = ['a cena monta-se', 'a página não rebenta', 'a consola não tem erros'];

/* Diz se um erro de consola é ruído conhecido: o de fora (RUIDO_DE_FORA) ou
   um pedido que o próprio percurso fez falhar de propósito — o 401 de
   perguntar por uma conta que ainda não existe, que o entrar() anota com o
   endereço. Cada pedido anotado desculpa UM erro, no ecrã onde foi feito, e
   fica gasto.
   Recebe: e — o erro de consola {ecra, consola, url}; provocados — os pedidos
   anotados [{ecra, url, status}], que esta função vai gastando.
   Devolve: a razão, se for ruído; null se for um erro a sério. */
function ruidoConhecido(e, provocados) {
  const r = RUIDO_DE_FORA.find((x) => x.texto.test(e.consola || '') && x.url.test(e.url || ''));
  if (r) return r.porque;
  const i = provocados.findIndex((p) => p.ecra === e.ecra && p.url === e.url &&
    (e.consola || '').startsWith('Failed to load resource: the server responded with a status of ' + p.status + ' '));
  if (i < 0) return null;
  provocados.splice(i, 1);
  return 'o percurso perguntou por uma conta que ainda não existia';
}

/* O veredicto do percurso: os invariantes quebrados, as cenas que não se
   montaram, os erros da página e os de consola fora do ruído conhecido — tudo
   falha. Uma cena que lança não mede nada, e era precisamente o estado que se
   queria ver; um ReferenceError na página era a avaria da v31. Iam para uma
   lista que se imprimia, e o processo saía com 0.
   Recebe: resultados — [{ecra, estado, falhas: [{regra, detalhe}]}];
   erros — [{ecra, onde, cena?, erro?, consola?, url?}]; provocados — os
   pedidos que o percurso fez falhar de propósito (ver ruidoConhecido).
   Devolve: {falhas: [{ecra, estado, regra, detalhe}], ruido: [{ecra, porque, texto}]}. */
function veredicto(resultados, erros, provocados) {
  const falhas = [], ruido = [];
  const porGastar = (provocados || []).slice();
  for (const r of resultados) {
    for (const f of r.falhas) falhas.push({ ecra: r.ecra, estado: r.estado, regra: f.regra, detalhe: f.detalhe });
  }
  for (const e of erros) {
    if (e.cena) {
      falhas.push({ ecra: e.ecra, estado: e.cena, regra: REGRAS_DE_ERRO[0], detalhe: e.erro });
    } else if (e.consola === undefined) {
      falhas.push({ ecra: e.ecra, estado: e.onde, regra: REGRAS_DE_ERRO[1], detalhe: e.erro });
    } else {
      const porque = ruidoConhecido(e, porGastar);
      if (porque) ruido.push({ ecra: e.ecra, porque, texto: e.consola });
      else falhas.push({ ecra: e.ecra, estado: e.onde, regra: REGRAS_DE_ERRO[2], detalhe: e.consola + (e.url ? ' (' + e.url + ')' : '') });
    }
  }
  return { falhas, ruido };
}

/* Espera que a página assente, em vez de dormir um tempo que num runner lento
   não chega e num rápido sobra: nenhuma mudança no DOM durante 120 ms (com um
   teto de 3 s, para uma página que não pare de mexer não prender o percurso),
   depois dois frames para as transições arrancarem, e as animações acabadas.
   Mede-se em repouso por isto: um modal a meio de entrar está dois píxeis
   abaixo do sítio, e o invariante «modal dentro do ecrã» apanhava-o — «814 em
   812», ora num estado ora noutro, sem nada no código ter mudado.
   Recebe: pagina — a página do Playwright.
   Devolve: os milissegundos que demorou (o resumo guarda-os). */
async function repouso(pagina) {
  const t0 = Date.now();
  await pagina.evaluate(() => new Promise((fim) => {
    let quieto = 0;
    const acabar = () => { mo.disconnect(); clearTimeout(quieto); clearTimeout(teto); fim(); };
    const mo = new MutationObserver(() => { clearTimeout(quieto); quieto = setTimeout(acabar, 120); });
    const teto = setTimeout(acabar, 3000);
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    quieto = setTimeout(acabar, 120);
  }));
  await pagina.evaluate(() => new Promise((fim) => requestAnimationFrame(() => requestAnimationFrame(fim))));
  await pagina.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  return Date.now() - t0;
}

async function limpar(pagina) {
  await pagina.evaluate(() => {
    try { closeAllModals(); } catch (e) {}
    try { closePops(); } catch (e) {}
    try { if (CW.editMode) CW.exitEdit(true); } catch (e) {}
    document.getElementById('cwUpdBar')?.remove();
    document.getElementById('cwLegal')?.remove();
    document.getElementById('cwTerms')?.remove();
  });
}

/* Carrega no botão do formulário de entrada e espera pela RESPOSTA do
   servidor e, se ela for boa, pela sessão posta no cliente (finishLogin, em
   cloud/entrada.js). Era um tempo fixo — 1,8 s na entrada, 2,2 s no registo —
   que num runner lento não chegava e num rápido sobrava.
   Recebe: pagina — a página; rota — '/api/auth/login' ou '/api/auth/register'.
   Devolve: a resposta do servidor (a Response do Playwright). */
async function submeter(pagina, rota) {
  // armada ANTES do clique, para não perder uma resposta rápida
  const resposta = pagina.waitForResponse((r) => r.request().method() === 'POST' &&
    new URL(r.url()).pathname === rota, { timeout: 20000 }).catch(() => null);
  await pagina.evaluate(() => { CW.submitAuth(); });
  const r = await resposta;
  if (!r) {
    // o formulário recusou antes de pedir (uma validação dele): diz-se o que ele diz
    const diz = await pagina.evaluate(() => (document.getElementById('cwa_err') || {}).textContent || '');
    throw new Error('o formulário não chegou a pedir ' + rota + (diz ? ': ' + diz : ''));
  }
  if (r.ok()) await pagina.waitForFunction(() => !!(window.CW && window.CW.user), null, { timeout: 15000 });
  return r;
}

/* Entra (ou cria a conta) pelo formulário, e deixa a página pronta a medir.
   Recebe: pagina — a página; anotar — onde registar um pedido que se fez
   falhar de propósito ({url, status}), para o veredicto o desculpar.
   Devolve: nada — ou rebenta a dizer o que o servidor respondeu. */
async function entrar(pagina, anotar) {
  /* Entra pelo formulário, como uma pessoa entraria.

     A primeira versão chamava a API de entrada por fetch. A sessão ficava no
     cookie, mas o cliente guarda o utilizador em localStorage — e sem isso
     continuava a mostrar o ecrã de entrada. O percurso corria as 48 cenas
     todas sobre o ecrã de entrada e dava tudo verde, que é pior do que
     falhar. Daí o formulário, e daí o confirmar() lá em baixo. */
  const EMAIL = 'percurso-ui@teste.local';
  const SENHA = 'Percurso#2026';

  await pagina.goto(URL_BASE, { waitUntil: 'networkidle' });
  // a app decide entre a sessão guardada e o formulário: espera-se por uma das duas
  await pagina.waitForFunction(() => !!(window.CW && window.CW.user) || !!document.getElementById('cwa_email'),
    null, { timeout: 20000 }).catch(() => {});

  if (!(await pagina.evaluate(() => !!(window.CW && window.CW.user)))) {
    const temForm = await pagina.$('#cwa_email');
    if (!temForm) throw new Error('sem sessão e sem formulário de entrada');

    await pagina.fill('#cwa_email', EMAIL);
    await pagina.fill('#cwa_pass', SENHA);
    const r = await submeter(pagina, '/api/auth/login');

    // conta ainda não existe: criar pelo formulário de registo
    if (!r.ok()) {
      /* o browser escreve o 401 na consola como erro; é o percurso a
         perguntar, e só esse pedido fica desculpado (ruidoConhecido) */
      if (r.status() === 401) anotar({ url: r.url(), status: 401 });
      await pagina.evaluate(() => { CW.showAuthMode = 'register'; CW.showAuth(); }).catch(() => {});
      if (!(await pagina.waitForSelector('#cwa_name', { timeout: 3000 }).catch(() => null))) {
        const b = await pagina.$('text=Ainda não tenho conta');
        if (b) await b.click();
        await pagina.waitForSelector('#cwa_name', { timeout: 5000 });
      }
      await pagina.fill('#cwa_name', 'Percurso UI');
      await pagina.fill('#cwa_email', EMAIL);
      await pagina.fill('#cwa_pass', SENHA);
      await pagina.fill('#cwa_pass2', SENHA);
      await pagina.check('#cwa_terms');
      await submeter(pagina, '/api/auth/register');
    }
  }

  if (!(await pagina.evaluate(() => !!(window.CW && window.CW.user)))) {
    /* A mensagem no ecrã é a da última tentativa — normalmente a do registo,
       que diz "já existe uma conta com este email" e faz parecer que o
       problema é esse. O que costuma estar por trás é o tecto de tentativas
       de entrada. Diz-se o que o servidor respondeu de facto. */
    /* os valores vão como ARGUMENTO, e não interpolados num texto: é o que
       permite que o predicado seja uma função e não passe por eval */
    const diz = await pagina.evaluate(async ({ email, senha }) => {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senha }),
      });
      return r.status + ' ' + (await r.text()).slice(0, 120);
    }, { email: EMAIL, senha: SENHA });
    throw new Error('não deu para entrar. A entrada responde: ' + diz);
  }

  // fechar os avisos de primeira abertura, que não são o objeto deste percurso
  await pagina.evaluate(() => { try { CW.acceptLegal && CW.acceptLegal(); } catch (e) {} });
  await repouso(pagina);
  await preparar(pagina);
}

/* Dados de exemplo: sem eles as vistas estão vazias e não há nada que medir.

   A sincronização inicial chega depois do arranque e passava por cima do que
   se tivesse semeado — semear uma vez e seguir em frente dava um percurso
   sobre uma app vazia. Por isso semeia-se depois de o servidor ter falado
   (CW._pulled, posto pelo applyState em cloud/nucleo.js), com teto: sem rede
   ele nunca fala, e aí semeia-se na mesma. E com insistência: semear e esperar
   que os dados lá estejam, até seis vezes.
   Recebe: pagina — a página, já com sessão.
   Devolve: nada — deixa a app com dados e sem janelas abertas. */
async function preparar(pagina) {
  /* Em producao os dados de exemplo sao recusados de proposito. O percurso
     precisa deles para ter o que medir, por isso corre contra um ambiente
     marcado -- e diz-se porque, em vez de falhar mais a frente com um
     "sem dados" que nao explica nada. */
  const amb = await pagina.evaluate(() => (window.CW && window.CW.ambiente) || '?');
  if (amb === 'producao') {
    throw new Error('a app diz estar em producao, onde os dados de exemplo sao recusados.\n' +
      'Levanta-a com: npx wrangler dev --port 8788 --var ENV_NAME:percurso');
  }
  const IMOVEIS = () => ((typeof db !== 'undefined' && db.properties) ? db.properties.length : 0);
  await pagina.waitForFunction(() => !!(window.CW && window.CW._pulled), null, { timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 6; i++) {
    if (await pagina.evaluate(IMOVEIS) > 0) break;
    await pagina.evaluate(() => { try { seed(); } catch (e) {} });
    await pagina.waitForFunction(IMOVEIS, null, { timeout: 3000 }).catch(() => {});
  }
  await repouso(pagina);
  await limpar(pagina);
}

/* Antes de medir seja o que for, confirmar que estamos mesmo dentro da app e
   com dados à frente. É o que impede um percurso de dar verde sobre o ecrã
   de entrada. */
async function confirmar(pagina, onde) {
  const e = await pagina.evaluate(() => ({
    sessao: !!(window.CW && window.CW.user),
    // o hideAuth() só esconde o elemento, não o remove: conta a visibilidade
    entrada: (() => { const el = document.getElementById('cwAuth');
      return !!el && getComputedStyle(el).display !== 'none'; })(),
    vista: (document.getElementById('view') || {}).children ? document.getElementById('view').children.length : 0,
    // o db é declarado com let: existe no âmbito global mas não em window.db,
    // e olhar para window.db dava sempre "sem dados"
    imoveis: (typeof db !== 'undefined' && db.properties) ? db.properties.length : -1,
    /* nos Movimentos, uma lista vazia desliga em silêncio a regra das linhas
       (invariantes.js) e as cenas de seleção: passa a haver verde sem haver
       verificação nenhuma */
    movimentos: (typeof tab !== 'undefined' && tab === 'transactions')
      ? document.querySelectorAll('#view .txrow').length : -1,
  }));
  const mal = [];
  if (!e.sessao) mal.push('sem sessão');
  if (e.entrada) mal.push('ecrã de entrada à frente');
  if (!e.vista) mal.push('vista vazia');
  if (e.imoveis <= 0) mal.push('sem dados de exemplo');
  if (e.movimentos === 0) mal.push('nos Movimentos sem uma única linha');
  if (mal.length) throw new Error('estado inválido em "' + onde + '": ' + mal.join(', '));
}

/* Mede um estado: confirma que se está dentro da app, espera que a página
   assente e corre as regras nela; guarda a captura.
   Recebe: pagina; estado — o nome do estado; ecra — o nome do ecrã; esperas —
   onde guardar quanto demorou o repouso.
   Devolve: {estado, ecra, falhas, medidas}. */
async function verificar(pagina, estado, ecra, esperas) {
  await confirmar(pagina, ecra + ' · ' + estado);
  // mede-se em repouso: a razão está no repouso()
  esperas.push(await repouso(pagina));
  const r = await pagina.evaluate(invariantes.dentroDaPagina);
  const nome = ecra + '__' + estado;
  if (!SEM_FOTOS) {
    await pagina.screenshot({ path: path.join(SAIDA, nome + '.png'), fullPage: false });
  }
  return { estado, ecra, ...r };
}

/* O percurso inteiro: entra em cada ecrã, visita as vistas e as cenas, mede
   cada estado, e decide pelo veredicto — que junta os invariantes, as cenas
   que não se montaram e os erros da página e da consola. Escreve o resumo em
   testes/ui/relatorio/.
   Devolve: nada — sai com 1 quando o veredicto tem falhas. */
async function correr() {
  // aqui e não no topo: quem só lê as regras (os testes) não precisa do browser
  const { chromium } = require('playwright');
  fs.rmSync(SAIDA, { recursive: true, force: true });
  fs.mkdirSync(SAIDA, { recursive: true });

  const navegador = await chromium.launch();
  const resultados = [];
  const erros = [];
  const provocados = [];
  const esperas = [];

  for (const ecra of ECRAS) {
    const ctx = await navegador.newContext({
      viewport: { width: ecra.width, height: ecra.height },
      colorScheme: ecra.tema,
      hasTouch: ecra.toque,
      deviceScaleFactor: 1,
    });
    const pagina = await ctx.newPage();
    let onde = 'entrada';   // o estado em curso: um erro diz onde apareceu
    pagina.on('pageerror', (e) => erros.push({ ecra: ecra.nome, onde, erro: String(e.message).split('\n')[0].slice(0, 300) }));
    pagina.on('console', (m) => {
      if (m.type() !== 'error') return;
      erros.push({ ecra: ecra.nome, onde, consola: m.text().slice(0, 300), url: (m.location() || {}).url || '' });
    });

    await entrar(pagina, (p) => provocados.push({ ecra: ecra.nome, ...p }));

    for (const v of VISTAS) {
      onde = 'vista-' + v;
      await pagina.evaluate((vista) => { go(vista); render(); }, v);
      resultados.push(await verificar(pagina, onde, ecra.nome, esperas));
    }

    for (const c of CENAS) {
      onde = c.nome;
      await limpar(pagina);
      await pagina.evaluate(() => { go('dashboard'); render(); });
      esperas.push(await repouso(pagina));   // a cena parte de uma página parada
      try { await pagina.evaluate(c.fazer); } catch (e) {
        /* Uma cena que não se monta não tem estado para medir, e era esse o
           estado que se queria ver: a falha é essa (veredicto). Segue-se para
           a próxima, para uma corrida as dizer todas de uma vez. */
        erros.push({ ecra: ecra.nome, onde, cena: c.nome,
          erro: String(e.message).replace(/^page\.evaluate: /, '').split('\n')[0].slice(0, 300) });
        continue;
      }
      resultados.push(await verificar(pagina, c.nome, ecra.nome, esperas));
    }

    onde = 'saída';
    await limpar(pagina);
    await ctx.close();
  }
  await navegador.close();

  const { falhas, ruido } = veredicto(resultados, erros, provocados);
  const t = esperas.slice().sort((a, b) => a - b);
  const resumo = {
    url: URL_BASE,
    estados: resultados.length,
    ecras: ECRAS.map((e) => e.nome),
    errosDeConsola: erros,
    ruidoIgnorado: ruido,
    falhas,
    repouso: { medianaMs: t[t.length >> 1] || 0, maximoMs: t[t.length - 1] || 0, noTeto: t.filter((x) => x >= 3000).length },
    medidas: resultados.map((r) => ({ ecra: r.ecra, estado: r.estado, ...r.medidas })),
  };
  fs.writeFileSync(path.join(SAIDA, 'resumo.json'), JSON.stringify(resumo, null, 2));

  console.log(resultados.length + ' estados verificados em ' + ECRAS.length + ' ecrãs (repouso: mediana ' +
    resumo.repouso.medianaMs + ' ms, máximo ' + resumo.repouso.maximoMs + ' ms, ' + resumo.repouso.noTeto + ' no teto).');
  if (ruido.length) {
    const conta = {};
    ruido.forEach((r) => { conta[r.porque] = (conta[r.porque] || 0) + 1; });
    console.log('\nruído conhecido, ignorado: ' + Object.keys(conta).map((k) => conta[k] + ' × ' + k).join('; ') + '.');
  }
  if (falhas.length) {
    const deErros = falhas.filter((f) => REGRAS_DE_ERRO.includes(f.regra));
    if (deErros.length) {
      console.error('\nerros nas cenas, na página ou na consola (' + deErros.length + '):');
      deErros.forEach((f) => console.error('  ' + JSON.stringify(f)));
    }
    const quebrados = falhas.filter((f) => !REGRAS_DE_ERRO.includes(f.regra));
    if (quebrados.length) {
      console.error('\ninvariantes quebrados (' + quebrados.length + '):');
      quebrados.forEach((f) => console.error('  [' + f.ecra + ' · ' + f.estado + '] ' + f.regra + ' — ' + f.detalhe));
    }
    process.exit(1);
  }
  console.log('todos os invariantes cumpridos.');
  if (!SEM_FOTOS) console.log('capturas e resumo em testes/ui/relatorio/');
}

if (require.main === module) correr().catch((e) => { console.error(e); process.exit(1); });

module.exports = { ECRAS, VISTAS, CENAS, RUIDO_DE_FORA, ruidoConhecido, veredicto };
