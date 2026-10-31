// Worker do Rendorium (nome interno: gestor-imobiliario): /api/* vai para a API (D1 + KV);
// tudo o resto é servido pelos assets estáticos (a PWA em web/).

import { handleApi, recordReport } from './api.js';
import { mascararTokens } from './lib/relatos.js';
import { medirPedido, pulsar } from './lib/medidas.js';
import { CSP_ANEXO, CSP_ESTRITA } from './lib/http.js';
import { CRON_DIARIO } from './lib/auditoria.js';
import { limparLimites } from './lib/limites.js';
import { varrerAnexos } from './files.js';
import { dailyReport, watchLimits } from './notify.js';
import { copiar } from './salvaguarda.js';
import { recursoDePagina } from './paginas-recursos.js';
import { CAMINHOS_DE_IDENTIDADE, identidadeDeDev } from './lib/identidade.js';
import { assetLinksDoDev, portaDoDev } from './teste.js';

/* Os dois scripts em linha do web/index.html — a armadilha de erros e a cura
   do arranque — têm de correr antes de qualquer ficheiro, e por isso não podem
   sair para um .js. Entram na política pelo sha256 do texto exato entre as
   etiquetas, com fins de linha LF, que é como o ficheiro vai para produção.
   Sem o «unsafe-inline» nenhum outro script ou folha em linha corre: o CSS da
   app vive no web/estilos.css e os eventos em data-click (web/app/eventos.js).
   O testes/csp.test.js confere que estes hashes continuam a bater com o
   ficheiro, aqui e no web/_headers, que tem de ficar igual. */
const HASHES_EM_LINHA = "'sha256-c4UA1V+48Fe1JESBNvW0EoXCeYe6ELM2ka4toVHOtm4=' " +
  "'sha256-dOWyPmDWCNjOauaFadEMzAWiQMAhldb2MQT5bP86V3A='";
/* A app não carrega nada de fora, tirando o botão de entrada com Google e as
   estatísticas do Cloudflare Web Analytics: o Cloudflare injeta em cada página
   o beacon.min.js (static.cloudflareinsights.com), que manda as visitas para
   cloudflareinsights.com. Sem cookies; recusado aqui, não registava nada e
   ainda disparava a cura do arranque (index.html:deFora). */
const CSP = [
  "default-src 'self'",
  "script-src 'self' " + HASHES_EM_LINHA + " https://accounts.google.com/gsi/client https://static.cloudflareinsights.com",
  /* O sha256 não é nosso: é da folha que o botão de entrada com Google injeta
     na página (accounts.google.com/gsi/client). Sem ele, o browser recusa-a e
     o botão passa de 72px para 357px de altura — medido —, que é mudar o que a
     pessoa vê. Um hash é o preço mais baixo: não abre a porta a mais nada, ao
     contrário do «unsafe-inline». Em troca, é de um terceiro: quando o
     Google mudar a biblioteca, o hash caduca e o botão volta a crescer. Quem o
     apanha é o percurso da interface, que falha em qualquer recusa da CSP que
     não seja das duas conhecidas (testes/ui/percorrer.js:RUIDO_DE_FORA). */
  "style-src 'self' 'sha256-RU4sU0AaS8IBGZx8XrGt/pa9A5SLA3dQszGeqT5L3Kw=' https://accounts.google.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "connect-src 'self' https://accounts.google.com https://cloudflareinsights.com",
  "frame-src https://accounts.google.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",   // sem clickjacking
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',   // o popup do Google precisa
};

/* O que uma resposta pode apertar por sua conta, e só isso.

   A regra continua a ser que os cabeçalhos de segurança se impõem por cima
   do que veio de baixo. A exceção é para apertar, nunca para afrouxar: a
   página que troca a ligação da equipa tem um token no endereço e pede
   'no-referrer', e com um `set` cego ficava com a política geral, que deixa
   sair a origem. E um anexo (GET /api/files/:id) vai com a CSP_ANEXO — a
   geral apertada, mais `sandbox` —, porque é conteúdo de terceiros servido
   nesta origem. As páginas que o worker escreve (landing, legais, docs,
   back office, entrada de teste) vão com a CSP_ESTRITA — a geral sem os três
   hashes: os dois dos scripts em linha da app e o da folha do Google, que
   nenhuma delas tem nem desenha. A lista é
   de valores exactos de propósito — assim uma
   rota não consegue afrouxar nada, mesmo por engano. */
const PODE_APERTAR = { 'Referrer-Policy': ['no-referrer'], 'Content-Security-Policy': [CSP_ANEXO, CSP_ESTRITA] };

// Veste uma resposta com os cabeçalhos de segurança antes de sair; só os
// valores exactos em PODE_APERTAR escapam a ser substituídos. Devolve uma
// Response nova — a original não se volta a usar.
// Recebe: res — a Response acabada de produzir por uma rota.
// Devolve: uma Response nova com os cabeçalhos de segurança postos — a
// original não se volta a usar.
function harden(res) {
  const out = new Response(res.body, res);
  Object.keys(SECURITY_HEADERS).forEach((k) => {
    const posto = out.headers.get(k);
    const permitidos = PODE_APERTAR[k] || [];
    if (posto && permitidos.indexOf(posto) > -1) return;   // a resposta apertou; fica
    out.headers.set(k, SECURITY_HEADERS[k]);
  });
  return out;
}

export default {
  // Uma vez por dia: cópia da base para o R2 e resumo do consumo. A cópia
  // vai primeiro para o resumo do mesmo dia já poder dizer se correu bem —
  // uma cópia que deixa de acontecer só dá nas vistas quando é precisa.
  async scheduled(event, env, ctx) {
    // Dois horários. À hora certa olha-se para os limites, que é barato, e
    // (a partir das 9h em Lisboa) mandam-se os avisos dos planeados em
    // atraso, aos poucos; a cópia e o resumo são o trabalho pesado e ficam
    // uma vez por dia. O
    // diário reconhece-se pelo horário exato que o wrangler.toml agenda
    // (CRON_DIARIO) — um teste confere que os dois batem.
    const diario = event.cron === CRON_DIARIO;
    ctx.waitUntil((async () => {
      /* Cada execução deixa uma linha no op_log. O alarme não é uma linha
         com erro — é a ausência de linhas novas, que era o que ninguém via
         quando o cron morria de todo. */
      const { registarOp } = await import('./lib/auditoria.js');
      if (!diario) {
        try {
          // os contadores do travão cuja janela acabou (nunca lança)
          await limparLimites(env);
          await watchLimits(env, ctx);
          await registarOp(env, 'vigia', true);
          /* O batimento para fora, e só depois de a vigia ter corrido: o
             alarme da casa é a ausência de linhas no op_log, mas quem deteta
             a ausência é este cron. Se ele morrer, ninguém dá por isso — o
             URL vive num segredo (HEARTBEAT_URL); sem ele, não bate. */
          await pulsar(env.HEARTBEAT_URL);
        } catch (e) {
          await registarOp(env, 'vigia', false, String((e && e.message) || e));
          await recordReport(env, ctx, 'infra', 'Vigia dos limites falhou',
            String((e && e.stack) || (e && e.message) || e).slice(0, 800));
        }
        /* O email dos planeados em atraso (lib/avisos-atraso.js, que nunca
           lança), depois da vigia e do batimento: a partir das 9h em Lisboa,
           com um número fixo de consultas e no máximo 20 emails por hora —
           o que fica vai na hora seguinte. Não vive no diário porque a cópia
           já gasta lá a sua parte das consultas que o plano gratuito deixa
           fazer numa invocação. A hora é a do agendamento (scheduledTime). */
        try {
          const { resumoDosAtrasos, horaDosAvisos } = await import('./lib/avisos-atraso.js');
          const agora = event.scheduledTime || Date.now();
          if (horaDosAvisos(agora)) {
            const a = await resumoDosAtrasos(env, agora);
            await registarOp(env, 'atrasos', a.ok, a.detalhe);
          }
        } catch (e) {
          await registarOp(env, 'atrasos', false, String((e && e.message) || e));
        }
        return;
      }
      let copiaOk = false;
      try {
        const r = await copiar(env);
        copiaOk = !r.erro;
        await registarOp(env, 'copia', !r.erro, JSON.stringify(r).slice(0, 490));
        if (r.erro) await recordReport(env, ctx, 'infra', 'Cópia de segurança falhou', r.erro);
      } catch (e) {
        await registarOp(env, 'copia', false, String((e && e.message) || e));
        await recordReport(env, ctx, 'infra', 'Cópia de segurança falhou',
          String((e && e.stack) || (e && e.message) || e).slice(0, 800));
      }
      // os anexos que já não pertencem a nada (files.js:varrerAnexos) —
      // depois da cópia; se falhar, fica um relato e o resumo segue
      try {
        await varrerAnexos(env);
      } catch (e) {
        await recordReport(env, ctx, 'infra', 'Varredura dos anexos falhou',
          String((e && e.stack) || (e && e.message) || e).slice(0, 800));
      }
      /* o rasto das pessoas vive 90 dias (lib/rasto.js:podarRasto, que nunca
         lança): os eventos mais velhos e os pids anónimos que ficaram vazios */
      try {
        const { podarRasto } = await import('./lib/rasto.js');
        const p = await podarRasto(env);
        await registarOp(env, 'rasto', p.ok,
          p.ok ? p.eventos + ' eventos e ' + p.pids + ' pseudónimos podados' : p.erro);
      } catch (e) {
        await registarOp(env, 'rasto', false, String((e && e.message) || e));
      }
      // o resultado é o do envio a sério: um resumo que não chegou a lado
      // nenhum registado como verde era o batimento a mentir
      let entregue = null;
      try { entregue = await dailyReport(env, ctx); } catch (e) { entregue = false; }
      await registarOp(env, 'resumo', entregue !== false,
        entregue === null ? 'sem canal configurado' : null);
      // o batimento do dia: só com a cópia feita E o resumo entregue
      if (copiaOk && entregue !== false) await pulsar(env.HEARTBEAT_COPIA_URL);
    })());
  },

  /* O correio que ENTRA (a regra do test@rendorium.com aponta para aqui).
     Só se aceita o que a própria casa envia — o envelope do Resend vem de
     send.rendorium.com, e é o envelope que se verifica. O resto é recusado
     à porta, antes de existir caixa: test@ não é um endereço público. */
  async email(message, env, ctx) {
    const { dominioDaCasa } = await import('./lib/correio.js');
    const destino = env.DESTINO_CORREIO_TESTE;
    if (!destino || !dominioDaCasa(message.from)) {
      return message.setReject('Este endereço só aceita correio do próprio Rendorium.');
    }
    await message.forward(destino);
  },

  // Recebe: request — o pedido; env — as bindings do worker; ctx — o contexto (waitUntil).
  // Devolve: promessa da Response, já vestida pelo harden.
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* A porta do dev (teste.js:portaDoDev): no dev.rendorium.com, sem a sessão de
       uma conta de teste — a de uma ligação do /test —, tudo é um 404 seco,
       tirando a ligação, o Discord, o back office e o /versao.json do deploy.
       Antes de tudo o resto, para nenhuma rota abaixo responder primeiro.
       Fora do dev (produção, percurso) devolve null sem ler nada. */
    const fechada = await portaDoDev(env, request, url);
    if (fechada) return harden(fechada);

    /* O /.well-known/assetlinks.json do dev (teste.js:assetLinksDoDev), que
       o Android lê sem cookies para a APK de dev abrir as ligações do /test.
       Logo DEPOIS da porta, e não antes: a porta continua a ser a primeira
       coisa de todas, e o que ela deixa passar sem sessão fica dito num sítio
       só (teste.js:SEM_SESSAO), onde o caminho está. Fora do dev, null. */
    const ligacoes = await assetLinksDoDev(env, request, url);
    if (ligacoes) return harden(ligacoes);

    const caminho = url.pathname.replace(/^\/|\/$/g, '');
    const naRaiz = url.hostname === 'rendorium.com' || url.hostname === 'www.rendorium.com';

    /* O consentimento do rasto (o formulário da faixa da montra, sem JS) e a
       recolha da montra (o sendBeacon dela), em qualquer host e ANTES do
       reencaminhamento da raiz para a app: a montra vive em rendorium.com e é
       lá que os pede (lib/rasto.js). Depois da porta do dev, que fica
       primeiro. */
    if (request.method === 'POST' && (url.pathname === '/consentimento' || url.pathname === '/rasto')) {
      const { rotaConsentimento, rotaRastoDaMontra } = await import('./lib/rasto.js');
      return harden(url.pathname === '/consentimento'
        ? await rotaConsentimento(env, request, url)
        : await rotaRastoDaMontra(env, request, url));
    }

    /* Os CSS e os JavaScript das páginas que o worker escreve, que vão com a
       CSP_ESTRITA e já não trazem nada em linha (paginas-recursos.js).
       Antes de tudo: a landing e os documentos legais também os pedem no
       domínio raiz, onde o resto é reencaminhado para a app. */
    const recurso = await recursoDePagina(url.pathname, request.method, async () => {
      const { getEquipa } = await import('./equipa.js');
      return !!(await getEquipa(env, request));
    });
    if (recurso) return harden(recurso);

    /* Os documentos legais respondem em QUALQUER endereço. São os mesmos
       documentos em todo o lado, não colidem com nada (a app é uma página só,
       sem rotas), e sem isto não havia como os ver sem ser em produção. */
    if (caminho === 'termos' || caminho === 'privacidade') {
      const { paginaLegal } = await import('./legal-vista.js');
      return harden(paginaLegal(caminho, { raiz: naRaiz }));
    }

    /* A montra tem de poder ver-se ANTES de ser publicada. Fora do domínio
       raiz é o /montra que a serve — a raiz do dev continua a ser a app, que é
       para isso que esse ambiente serve. Em produção o /montra é só um atalho
       para o que já está em «/». */
    if (caminho === 'montra' || (naRaiz && url.pathname === '/')) {
      const { paginaLanding } = await import('./landing.js');
      // a escolha do rasto deste aparelho (o cookie rd_escolha): sem ela, a faixa
      const { lerCookiesDoRasto } = await import('./lib/rasto.js');
      return harden(paginaLanding({ raiz: naRaiz, escolha: lerCookiesDoRasto(request).escolha }));
    }

    /* O domínio raiz é a montra; a app vive em app.rendorium.com. Qualquer
       outro caminho na raiz é reencaminhado para a app — os endereços antigos
       (workers.dev) continuam a servir a app diretamente, porque as
       instalações feitas lá não podem partir. */
    if (naRaiz) {
      return Response.redirect('https://app.rendorium.com' + url.pathname + url.search, 302);
    }

    /* A porta do ambiente de teste (/test no Discord ou o botão na
       Operação). Fora de produção, só: lá dentro a rota diz que não. */
    if (url.pathname === '/t/entrar' && request.method === 'GET') {
      const { rotaTeste } = await import('./teste.js');
      return harden(await rotaTeste({ env, url, request }));
    }

    // Interações do bot do Discord. A autenticação é a assinatura Ed25519
    // que o Discord envia — não há sessão nem cookies aqui. Uma exceção é
    // tratada como nas outras rotas da API: 500 com relato, em vez de um
    // erro do worker que o Discord mostra como «esta interação falhou» sem
    // ninguém saber porquê.
    if (url.pathname === '/api/discord' && request.method === 'POST') {
      try {
        const { handleInteraction } = await import('./discord.js');
        return await handleInteraction(request, env, ctx);
      } catch (e) {
        console.error('discord', e);
        ctx.waitUntil(recordReport(env, ctx, 'server', e && e.message,
          'POST /api/discord\n' + String((e && e.stack) || '').slice(0, 800)));
        return new Response(JSON.stringify({ error: 'Erro interno do servidor.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
    }

    /* A ferramenta de equipa. Vive fora da API de quem usa a app e tem a sua
       própria sessão — quem entra aqui não tem casas nem movimentos, e uma
       sessão de cliente não abre nada disto. */
    if (url.pathname.startsWith('/equipa') || url.pathname.startsWith('/api/equipa/')) {
      const { rotasEquipa, getEquipa } = await import('./equipa.js');
      const c = { env, request, ctx, url, path: url.pathname.replace(/\/+$/, ''), method: request.method };
      try {
        // a pílula do QA no back office do dev (equipa-qa.js): o guião e o CSS dela
        if (url.pathname === '/equipa/qa.js' || url.pathname === '/equipa/qa.css') {
          const { recursoDoQa } = await import('./equipa-qa.js');
          return harden(await recursoDoQa(env, url, request.method, await getEquipa(env, request)));
        }
        const r = await rotasEquipa(c);
        if (r) { r.headers.set('Cache-Control', 'no-store'); return harden(r); }
        if (url.pathname === '/equipa' || url.pathname === '/equipa/') {
          const { paginaEquipa } = await import('./equipa-vista.js');
          const eu = await getEquipa(env, request);
          return harden(paginaEquipa(eu, { qa: env.ENV_NAME || '' }));
        }
        // a documentação da casa: gerada do código no deploy, para a equipa
        if (url.pathname === '/equipa/docs') {
          const eu = await getEquipa(env, request);
          if (!eu) {
            const { paginaEquipa } = await import('./equipa-vista.js');
            return harden(paginaEquipa(null));
          }
          const { paginaDocs } = await import('./docs-vista.js');
          return harden(paginaDocs());
        }
        const { rotasEquipaApi } = await import('./equipa-api.js');
        const eu = await getEquipa(env, request);
        if (!eu) {
          return new Response(JSON.stringify({ error: 'Sem sessão de equipa.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
          });
        }
        const r2 = await rotasEquipaApi(Object.assign({}, c, { eu }));
        if (r2) { r2.headers.set('Cache-Control', 'no-store'); return harden(r2); }
      } catch (e) {
        console.error('equipa', e);
        ctx.waitUntil(recordReport(env, ctx, 'server', e && e.message,
          'equipa ' + url.pathname + '\n' + String((e && e.stack) || '').slice(0, 800)));
        return new Response(JSON.stringify({ error: 'Erro interno do servidor.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      return new Response('Não encontrado', { status: 404 });
    }
    if (url.pathname.startsWith('/api/')) {
      // a API é de uso próprio: nada de a chamar a partir de outro site
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) {
        return new Response(JSON.stringify({ error: 'Origem não autorizada.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      const t0 = Date.now();
      try {
        const res = await handleApi(request, env, ctx);
        res.headers.set('Cache-Control', 'no-store');
        // um ponto por pedido: rota genérica, estado, duração — nunca o caminho tal e qual
        medirPedido(env, request.method, url.pathname, res.status, Date.now() - t0);
        return harden(res);
      } catch (e) {
        medirPedido(env, request.method, url.pathname, 500, Date.now() - t0);
        console.error('API error', e);
        // quem programa fica a saber, sem o utilizador ter de reportar — mas
        // o caminho de um convite ou da ligação de partilha leva o token, e
        // esse não pode ficar nos relatos
        ctx.waitUntil(recordReport(env, ctx, 'server', e && e.message,
          request.method + ' ' + mascararTokens(url.pathname) + '\n' + String((e && e.stack) || '').slice(0, 800)));
        return new Response(JSON.stringify({ error: 'Erro interno do servidor.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
    }
    /* Fora de produção a app chama-se «Rendorium DEV» e tem ícones âmbar
       (lib/identidade.js): o manifesto e a página «/» reescrevem-se ao
       passar, para a PWA de dev se instalar ao lado da de produção sem se
       confundirem. Os dois caminhos passam pelo worker nos dois ambientes
       (run_worker_first no wrangler.toml); em produção seguem direitos. O
       pedido inteiro vai ao identidadeDeDev, e não só a resposta: é ele que
       tira as condições antes de ir aos assets, senão um 304 deles saía
       sem reescrita e a PWA de dev ficava com a cara de produção. */
    if (env.ENV_NAME && CAMINHOS_DE_IDENTIDADE.indexOf(url.pathname) > -1) {
      return harden(await identidadeDeDev(env.ASSETS, request));
    }
    return harden(await env.ASSETS.fetch(request));
  },
};
