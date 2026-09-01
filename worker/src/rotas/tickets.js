// Pedidos de ajuda e erros comunicados pela app.
import { notifyDev, ticketEmbed } from '../notify.js';
import { recordReport } from '../lib/relatos.js';

export async function rotasTickets(c) {
  const { env, request, ctx, path, method, seg, me, json, err, body, now, rateLimit, canAccessHouse, participantsOf, preserveOwnership, connectionForUser, badId, cleanData, tooBig, clientIp, TERMS_VERSION, purgeAccount } = c;

  // ---- Pedidos de ajuda e relatórios de erro ------------------------------

  if (path === '/api/tickets' && method === 'POST') {
    if (!(await rateLimit(env, 'tk:' + me.id, 10, 3600))) {
      return err(429, 'Já enviaste vários pedidos seguidos. Espera um pouco.');
    }
    const b = await body(request);
    const kind = b && b.kind === 'sugestao' ? 'sugestao' : 'problema';
    const subject = String((b && b.subject) || '').trim().slice(0, 140);
    const text = String((b && b.body) || '').trim().slice(0, 4000);
    if (!subject || !text) return err(400, 'Escreve um assunto e a descrição.');
    const id = crypto.randomUUID(), t = now();
    const row = {
      id, kind, subject, body: text, status: 'criado', created_at: t,
      context: String((b && b.context) || '').slice(0, 300),
    };
    await env.DB.prepare(
      `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, context, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'criado', 'user', ?, ?, ?)`
    ).bind(id, me.id, kind, subject, text, row.context, t, t).run();
    const { ticketButtons } = await import('../discord.js');
    notifyDev(env, ctx, ticketEmbed(row, me), ticketButtons(id));
    return json({ ok: true, id }, 201);
  }

  if (path === '/api/tickets' && method === 'GET') {
    // a pessoa vê o que contou, não os erros que a app registou por ela
    const rows = (
      await env.DB.prepare(
        `SELECT id, kind, subject, body, status, reply, created_at, updated_at
           FROM tickets WHERE user_id = ? AND category = 'user'
          ORDER BY created_at DESC LIMIT 50`
      ).bind(me.id).all()
    ).results;
    return json({ tickets: rows });
  }

  // erros apanhados no browser de quem usa a app
  if (path === '/api/reports' && method === 'POST') {
    if (!(await rateLimit(env, 'rp:' + me.id, 20, 3600))) return json({ ok: true });
    const b = await body(request);
    if (!b || !b.message) return err(400, 'Corpo inválido.');
    await recordReport(env, ctx, 'client', b.message, b.detail, me.id);
    return json({ ok: true });
  }
}
