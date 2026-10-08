// Travão contra força bruta e abuso. Os contadores vivem na D1: o KV gratuito
// só aceita mil escritas por dia e cada gravação de dados gastava uma.

import { now } from './http.js';

/* Conta mais um acontecimento na chave e diz se ainda cabe: true deixa
   passar, false é para responder 429. A janela é fixa — windowSec segundos a
   contar do primeiro acontecimento — e cada chamada gasta uma escrita na D1.
   Se a base falhar, deixa passar: um contador em baixo não pode deitar o
   serviço abaixo.
   Recebe: env — o ambiente do worker (D1 em env.DB); key — a chave do
   contador (ex.: 'login:' + ip); limit — o máximo de acontecimentos na
   janela; windowSec — a janela em segundos, a contar do primeiro.
   Devolve: true se ainda cabe (ou se a base falhou), false quando o limite
   foi atingido — é para responder 429. */
export async function rateLimit(env, key, limit, windowSec) {
  const t = now();
  try {
    const row = await env.DB.prepare('SELECT n, expires_at FROM rate_limits WHERE k = ?').bind(key).first();
    if (!row || row.expires_at < t) {
      await env.DB.prepare(
        `INSERT INTO rate_limits (k, n, expires_at) VALUES (?, 1, ?)
         ON CONFLICT (k) DO UPDATE SET n = 1, expires_at = excluded.expires_at`
      ).bind(key, t + windowSec * 1000).run();
      return true;
    }
    if (row.n >= limit) return false;
    await env.DB.prepare('UPDATE rate_limits SET n = n + 1 WHERE k = ?').bind(key).run();
  } catch (e) {
    return true;   // um contador em baixo não pode deitar o serviço abaixo
  }
  return true;
}

/* Leva o lixo à frente: apaga os contadores cuja janela já acabou. Corre na
   vigia de hora a hora (index.js). Vivia dentro do rateLimit, «de vez em
   quando» — quando o contador era múltiplo de 25 —, mas o contador nunca
   passa do limite, e com limites até 25 (as chaves por IP da entrada, uma
   linha por endereço que tentou uma vez) o ramo nunca corria.
   Recebe: env — o ambiente do worker (D1 em env.DB); agora (opcional) — o
   instante de referência em milissegundos (por omissão, agora).
   Devolve: promessa de quantas linhas saíram (0 se a base falhar — limpar
   nunca pode travar a vigia). */
export async function limparLimites(env, agora) {
  try {
    const r = await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(agora || now()).run();
    return (r && r.meta && r.meta.changes) || 0;
  } catch (e) {
    return 0;
  }
}
