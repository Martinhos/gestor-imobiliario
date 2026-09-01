// Erros apanhados sozinhos abrem um pedido na mesma fila dos que as
// pessoas contam, agrupados por assinatura para nao encher o canal.

import { now } from './http.js';
import { notifyDev, errorEmbed } from '../notify.js';

// Um erro apanhado sozinho abre um pedido na mesma fila dos que as pessoas
// contam. Erros repetidos somam-se ao pedido que já existe, em vez de abrirem
// um novo de cada vez.
export async function recordReport(env, ctx, categoria, message, detail, userId) {
  const msg = String(message || '').slice(0, 2000);
  const fp = categoria + ':' + msg.slice(0, 120);
  const t = now();
  try {
    const ex = await env.DB.prepare('SELECT * FROM tickets WHERE fingerprint = ?').bind(fp).first();
    if (ex) {
      // um erro que volta depois de fechado reabre o pedido
      const estado = ex.status === 'concluido' ? 'criado' : ex.status;
      await env.DB.prepare('UPDATE tickets SET n = n + 1, status = ?, updated_at = ? WHERE id = ?')
        .bind(estado, t, ex.id).run();
      if (ex.n < 3 || t - ex.updated_at > 3600000 || ex.status === 'concluido') {
        notifyDev(env, ctx, errorEmbed({
          id: ex.id, kind: categoria, message: ex.subject, detail: ex.body,
          user_id: ex.user_id, n: ex.n + 1, created_at: t,
        }));
      }
      return;
    }
    const id = crypto.randomUUID();
    const dono = userId || (await env.DB.prepare(
      'SELECT id FROM users WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1'
    ).first() || {}).id;
    if (!dono) return;   // sem contas ainda, não há onde pendurar o pedido
    const detalhe = String(detail || '').slice(0, 4000);
    await env.DB.prepare(
      `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, fingerprint, n, created_at, updated_at)
       VALUES (?, ?, 'problema', ?, ?, 'criado', ?, ?, 1, ?, ?)`
    ).bind(id, dono, msg.slice(0, 140), detalhe, categoria, fp, t, t).run();
    notifyDev(env, ctx, errorEmbed({
      id, kind: categoria, message: msg, detail: detalhe, user_id: userId, n: 1, created_at: t,
    }));
  } catch (e) {
    // um relatório que falha não pode piorar o problema que estava a relatar
  }
}
