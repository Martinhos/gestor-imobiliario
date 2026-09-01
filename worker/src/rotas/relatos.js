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
   partido no browser da Samsung". */
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

export async function rotasRelatos(c) {
  const { env, request, ctx, path, method } = c;
  if (path !== '/api/reports' || method !== 'POST') return null;

  // quem já tem sessão assina o relato; quem não tem fica pelo endereço
  const me = await getSessionUser(env, request).catch(() => null);
  const chave = me ? 'rp:' + me.id : 'rpa:' + clientIp(request);
  const tecto = me ? 20 : 5;
  // um cliente em ciclo de erro não pode encher a fila: passado o tecto a
  // resposta continua a ser ok, para o browser não tentar outra vez
  if (!(await rateLimit(env, chave, tecto, 3600))) return json({ ok: true });

  const b = await body(request);
  if (!b || !b.message) return err(400, 'Corpo inválido.');

  const detalhe = String(b.detail || '').slice(0, 3900) +
    (me ? '' : '\n\n(sem sessão iniciada)');
  await recordReport(env, ctx, 'client', b.message, detalhe, me ? me.id : null, {
    versao: b.versao,
    contexto: [b.ecra ? 'ecrã ' + b.ecra : '', navegador(b.agente)].filter(Boolean).join(' · '),
  });
  return json({ ok: true });
}
