// Worker do Gestor Imobiliário: /api/* vai para a API (D1 + KV);
// tudo o resto é servido pelos assets estáticos (a PWA em web/).

import { handleApi, recordReport } from './api.js';
import { dailyReport } from './notify.js';

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

function harden(res) {
  const out = new Response(res.body, res);
  Object.keys(SECURITY_HEADERS).forEach((k) => out.headers.set(k, SECURITY_HEADERS[k]));
  return out;
}

export default {
  // resumo diário do consumo para o canal de administração
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dailyReport(env, ctx));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Interações do bot do Discord. A autenticação é a assinatura Ed25519
    // que o Discord envia — não há sessão nem cookies aqui.
    if (url.pathname === '/api/discord' && request.method === 'POST') {
      const { handleInteraction } = await import('./discord.js');
      return handleInteraction(request, env, ctx);
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
        ctx.waitUntil(recordReport(env, ctx, 'servidor', e && e.message,
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
