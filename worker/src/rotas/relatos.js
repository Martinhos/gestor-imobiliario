// Erros apanhados no browser de quem usa a app.
//
// Corre antes da verificação de sessão de propósito. O ecrã de entrada é onde
// um erro custa mais — quem não consegue entrar não tem como contar o que se
// passou — e era exatamente aí que os relatos se perdiam, porque o cliente só
// os enviava depois de haver sessão. Com sessão o relato fica em nome de quem
// o viu; sem ela fica anónimo, limitado por endereço.

import { json, err, body, clientIp } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { getSessionUser } from '../auth.js';
import { recordReport } from '../lib/relatos.js';

/* O user-agent inteiro não cabe num embed e ninguém o lê. O que interessa é
   qual o browser e o sistema — que é o que separa "está partido" de "está
   partido no browser da Samsung".
   Recebe: ua — a string User-Agent tal como o browser a envia (pode faltar).
   Devolve: um resumo curto 'browser versão · sistema' (ex.: 'Chrome 128 · Android 14'), ou '' sem user-agent. */
function navegador(ua) {
  const t = String(ua || '');
  if (!t) return '';
  const browser =
    /SamsungBrowser\/([\d.]+)/.exec(t) ? 'Samsung Internet ' + RegExp.$1 :
    /Edg\/([\d.]+)/.exec(t) ? 'Edge ' + RegExp.$1 :
    /OPR\/([\d.]+)/.exec(t) ? 'Opera ' + RegExp.$1 :
    /Firefox\/([\d.]+)/.exec(t) ? 'Firefox ' + RegExp.$1 :
    /CriOS\/([\d.]+)/.exec(t) ? 'Chrome iOS ' + RegExp.$1 :
    /Chrome\/([\d.]+)/.exec(t) ? 'Chrome ' + RegExp.$1 :
    /Version\/([\d.]+).*Safari/.exec(t) ? 'Safari ' + RegExp.$1 : 'browser desconhecido';
  const sistema =
    /Android[ /]([\d.]+)/.exec(t) ? 'Android ' + RegExp.$1 :
    /iPhone OS ([\d_]+)/.exec(t) ? 'iOS ' + RegExp.$1.replace(/_/g, '.') :
    /iPad|iPhone/.test(t) ? 'iOS' :
    /Windows NT ([\d.]+)/.exec(t) ? 'Windows' :
    /Mac OS X/.test(t) ? 'macOS' :
    /Linux/.test(t) ? 'Linux' : '';
  return [browser.split(' ').slice(0, 2).join(' '), sistema].filter(Boolean).join(' · ');
}

/* Os robôs que correm o JavaScript das páginas — o Googlebot à cabeça —
   apanham scripts de versões diferentes, ou nem os apanham todos, e a app
   rebenta-lhes no arranque com erros que nenhuma pessoa vê. Os tokens vão
   um a um: um /bot/ solto apanhava os telemóveis da Cubot. */
const ROBOS = new RegExp([
  'Googlebot', 'Google-InspectionTool', 'GoogleOther', 'Google-Read-Aloud', 'Google-Extended',
  'AdsBot-Google', 'Mediapartners-Google', 'Storebot-Google', 'APIs-Google', 'FeedFetcher-Google',
  'bingbot', 'BingPreview', 'YandexBot', 'Baiduspider', 'DuckDuckBot', 'Applebot', 'PetalBot',
  'facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'Slackbot', 'Discordbot', 'TelegramBot',
  'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'Bytespider', 'GPTBot', 'ClaudeBot',
  'PerplexityBot', 'Chrome-Lighthouse',
].join('|'), 'i');

/* Um relato vem de um robô quando o user-agent (o do cabeçalho ou o que o
   browser mandou no corpo) é de um, ou quando a stack passa pelo wrsParams —
   o renderizador do Google, que nem sempre se apresenta como Googlebot.
   Recebe: request — o pedido; b — o corpo já lido ({message, detail, agente}).
   Devolve: true se o relato é de um robô, false se é de uma pessoa. */
export function deRobo(request, b) {
  const ua = String(request.headers.get('User-Agent') || '') + ' ' + String((b && b.agente) || '');
  if (ROBOS.test(ua)) return true;
  return /wrsParams/.test(String((b && b.message) || '') + ' ' + String((b && b.detail) || ''));
}

/* Rota do POST /api/reports: guarda um relato de erro vindo do browser,
   assinado pela sessão quando existe, anónimo e com tecto mais baixo quando
   não. Acima do tecto responde ok na mesma, para o cliente não insistir; a
   um robô também, sem gravar nem gastar o tecto. Devolve null noutros caminhos.
   Recebe: c — o contexto do pedido: {env, request, ctx, path, method}.
   Devolve: uma Promise — a Response JSON ({ok:true}, ou erro 400 com corpo inválido) quando trata o pedido; null nos outros caminhos. */
export async function rotasRelatos(c) {
  const { env, request, ctx, path, method } = c;
  if (path !== '/api/reports' || method !== 'POST') return null;

  const b = await body(request);
  // o que um robô apanha não é um defeito que alguém veja: não vai à fila
  if (deRobo(request, b)) return json({ ok: true });

  // quem já tem sessão assina o relato; quem não tem fica pelo endereço
  const me = await getSessionUser(env, request).catch(() => null);
  const chave = me ? 'rp:' + me.id : 'rpa:' + clientIp(request);
  const tecto = me ? 20 : 5;
  // um cliente em ciclo de erro não pode encher a fila: passado o tecto a
  // resposta continua a ser ok, para o browser não tentar outra vez
  if (!(await rateLimit(env, chave, tecto, 3600))) return json({ ok: true });

  if (!b || !b.message) return err(400, 'Corpo inválido.');

  const detalhe = String(b.detail || '').slice(0, 3900) +
    (me ? '' : '\n\n(sem sessão iniciada)');
  await recordReport(env, ctx, 'client', b.message, detalhe, me ? me.id : null, {
    versao: b.versao,
    contexto: [b.ecra ? 'ecrã ' + b.ecra : '', navegador(b.agente)].filter(Boolean).join(' · '),
  });
  return json({ ok: true });
}
