// Travão contra força bruta e abuso. Os contadores vivem na D1: o KV gratuito
// só aceita mil escritas por dia e cada gravação de dados gastava uma.

import { now } from './http.js';

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
    // limpeza preguiçosa: de vez em quando, leva o lixo à frente
    if (row.n % 25 === 0) {
      await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(t).run();
    }
  } catch (e) {
    return true;   // um contador em baixo não pode deitar o serviço abaixo
  }
  return true;
}
