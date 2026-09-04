// Worker do Rendorium (nome interno: gestor-imobiliario): /api/* vai para a API (D1 + KV);
// tudo o resto é servido pelos assets estáticos (a PWA em web/).

import { handleApi, recordReport } from './api.js';
import { dailyReport, watchLimits } from './notify.js';
import { copiar } from './salvaguarda.js';

// A app não carrega nada de fora, tirando o botão de entrada com Google.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "connect-src 'self' https://accounts.google.com",
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
   sair a origem. A lista é de valores exactos de propósito — assim uma
   rota não consegue afrouxar nada, mesmo por engano. */
const PODE_APERTAR = { 'Referrer-Policy': ['no-referrer'] };

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
    // Dois horários. À hora certa olha-se só para os limites, que é barato;
    // a cópia e o resumo são o trabalho pesado e ficam uma vez por dia.
    const diario = String(event.cron || '').startsWith('0 9 ');
    ctx.waitUntil((async () => {
      /* Cada execução deixa uma linha no op_log. O alarme não é uma linha
         com erro — é a ausência de linhas novas, que era o que ninguém via
         quando o cron morria de todo. */
      const { registarOp } = await import('./lib/auditoria.js');
      if (!diario) {
        try {
          await watchLimits(env, ctx);
          await registarOp(env, 'vigia', true);
        } catch (e) {
          await registarOp(env, 'vigia', false, String((e && e.message) || e));
          await recordReport(env, ctx, 'infra', 'Vigia dos limites falhou',
            String((e && e.stack) || (e && e.message) || e).slice(0, 800));
        }
        return;
      }
      try {
        const r = await copiar(env);
        await registarOp(env, 'copia', !r.erro, JSON.stringify(r).slice(0, 490));
        if (r.erro) await recordReport(env, ctx, 'infra', 'Cópia de segurança falhou', r.erro);
      } catch (e) {
        await registarOp(env, 'copia', false, String((e && e.message) || e));
        await recordReport(env, ctx, 'infra', 'Cópia de segurança falhou',
          String((e && e.stack) || (e && e.message) || e).slice(0, 800));
      }
      // o resultado é o do envio a sério: um resumo que não chegou a lado
      // nenhum registado como verde era o batimento a mentir
      let entregue = null;
      try { entregue = await dailyReport(env, ctx); } catch (e) { entregue = false; }
      await registarOp(env, 'resumo', entregue !== false,
        entregue === null ? 'sem canal configurado' : null);
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

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* O domínio raiz é a montra; a app vive em app.rendorium.com. Quem
       chegar a rendorium.com vê a landing, e qualquer outro caminho na
       raiz é reencaminhado para a app — os endereços antigos (workers.dev)
       continuam a servir a app diretamente, porque as instalações feitas
       lá não podem partir. */
    if (url.hostname === 'rendorium.com' || url.hostname === 'www.rendorium.com') {
      if (url.pathname === '/') {
        const { paginaLanding } = await import('./landing.js');
        return harden(paginaLanding());
      }
      return Response.redirect('https://app.rendorium.com' + url.pathname + url.search, 302);
    }

    /* A porta do ambiente de teste (/test no Discord ou o botão na
       Operação). Fora de produção, só: lá dentro a rota diz que não. */
    if (url.pathname === '/t/entrar' && request.method === 'GET') {
      const { rotaTeste } = await import('./teste.js');
      return harden(await rotaTeste({ env, url, request }));
    }

    // Interações do bot do Discord. A autenticação é a assinatura Ed25519
    // que o Discord envia — não há sessão nem cookies aqui.
    if (url.pathname === '/api/discord' && request.method === 'POST') {
      const { handleInteraction } = await import('./discord.js');
      return handleInteraction(request, env, ctx);
    }

    /* A ferramenta de equipa. Vive fora da API de quem usa a app e tem a sua
       própria sessão — quem entra aqui não tem casas nem movimentos, e uma
       sessão de cliente não abre nada disto. */
    if (url.pathname.startsWith('/equipa') || url.pathname.startsWith('/api/equipa/')) {
      const { rotasEquipa, getEquipa } = await import('./equipa.js');
      const c = { env, request, ctx, url, path: url.pathname.replace(/\/+$/, ''), method: request.method };
      try {
        const r = await rotasEquipa(c);
        if (r) { r.headers.set('Cache-Control', 'no-store'); return harden(r); }
        if (url.pathname === '/equipa' || url.pathname === '/equipa/') {
          const { paginaEquipa } = await import('./equipa-vista.js');
          const eu = await getEquipa(env, request);
          return harden(paginaEquipa(eu));
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
      try {
        const res = await handleApi(request, env, ctx);
        res.headers.set('Cache-Control', 'no-store');
        return harden(res);
      } catch (e) {
        console.error('API error', e);
        // quem programa fica a saber, sem o utilizador ter de reportar
        ctx.waitUntil(recordReport(env, ctx, 'server', e && e.message,
          request.method + ' ' + url.pathname + '\n' + String((e && e.stack) || '').slice(0, 800)));
        return new Response(JSON.stringify({ error: 'Erro interno do servidor.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
    }
    return harden(await env.ASSETS.fetch(request));
  },
};
