// Worker do Gestor Imobiliário: /api/* vai para a API (D1 + KV);
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
      if (!diario) {
        try { await watchLimits(env, ctx); } catch (e) {
          await recordReport(env, ctx, 'infra', 'Vigia dos limites falhou',
            String((e && e.stack) || (e && e.message) || e).slice(0, 800));
        }
        return;
      }
      try {
        const r = await copiar(env);
        if (r.erro) await recordReport(env, ctx, 'infra', 'Cópia de segurança falhou', r.erro);
      } catch (e) {
        await recordReport(env, ctx, 'infra', 'Cópia de segurança falhou',
          String((e && e.stack) || (e && e.message) || e).slice(0, 800));
      }
      await dailyReport(env, ctx);
    })());
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
