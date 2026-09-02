// A conta de quem esta ligado: dados, termos, palavra-passe, sessoes e apagar.
import { hashPassword, verifyPassword, createSession, destroySession,
  sessionCookie } from '../auth.js';
import { weakPassword } from '../lib/http.js';

export async function rotasConta(c) {
  const { env, request, ctx, path, method, seg, me, json, err, body, now, rateLimit, canAccessHouse, participantsOf, preserveOwnership, connectionForUser, badId, cleanData, tooBig, clientIp, TERMS_VERSION, purgeAccount } = c;

  if (path === '/api/me' && method === 'GET') {
    return json({
      id: me.id, email: me.email, name: me.name,
      plan: me.plan || 'free',
      terms: me.terms_version || null,
      termsCurrent: TERMS_VERSION,
      fimDemo: await (await import('../lib/planos.js')).fimDemo(env),
    });
  }

  // Aceitar os termos em vigor. Recusar apaga a conta — está explicado no
  // ecrã que faz o pedido, e exige a mesma confirmação escrita.
  if (path === '/api/me/terms' && method === 'POST') {
    const b = await body(request);
    if (b && b.accept === true) {
      await env.DB.prepare('UPDATE users SET terms_version = ?, terms_at = ? WHERE id = ?')
        .bind(TERMS_VERSION, now(), me.id)
        .run();
      return json({ ok: true, terms: TERMS_VERSION });
    }
    if (b && b.accept === false) {
      if (String(b.confirm || '').trim().toUpperCase() !== 'APAGAR') {
        return err(400, 'Escreve APAGAR para confirmar que queres apagar a conta.');
      }
      await purgeAccount(env, me.id);
      await destroySession(env, me.token);
      return json({ ok: true, deleted: true }, 200, { 'Set-Cookie': sessionCookie('', true) });
    }
    return err(400, 'Corpo inválido.');
  }

  // Mudar a palavra-passe (ou definir uma, numa conta que entra com Google).
  // Todas as outras sessões caem: é a forma de expulsar quem tenha roubado
  // um token, já que a sessão continua válida por 30 dias.
  if (path === '/api/me/password' && method === 'POST') {
    const b = await body(request);
    if (!b || !b.next) return err(400, 'Falta a nova palavra-passe.');
    if (weakPassword(b.next)) {
      return err(400, 'A palavra-passe precisa de pelo menos 8 caracteres, com maiúsculas, minúsculas, números e um símbolo.');
    }
    const full = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(me.id).first();
    if (full.pass_hash) {
      if (!(await rateLimit(env, 'pw:' + me.id, 10, 900))) return err(429, 'Demasiadas tentativas. Espera uns minutos.');
      if (!b.current || !(await verifyPassword(String(b.current), full.pass_salt, full.pass_hash))) {
        return err(401, 'A palavra-passe atual está errada.');
      }
    }
    const { hash, salt } = await hashPassword(String(b.next));
    const epoch = (full.sess_epoch || 0) + 1;
    await env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, sess_epoch = ? WHERE id = ?')
      .bind(hash, salt, epoch, me.id)
      .run();
    // este aparelho continua com sessão; os outros ficam de fora
    const token = await createSession(env, me.id, epoch);
    return json({ ok: true, token }, 200, { 'Set-Cookie': sessionCookie(token) });
  }

  // Terminar a sessão em todos os outros aparelhos.
  if (path === '/api/me/sessions' && method === 'DELETE') {
    const full = await env.DB.prepare('SELECT sess_epoch FROM users WHERE id = ?').bind(me.id).first();
    const epoch = ((full && full.sess_epoch) || 0) + 1;
    await env.DB.prepare('UPDATE users SET sess_epoch = ? WHERE id = ?').bind(epoch, me.id).run();
    const token = await createSession(env, me.id, epoch);
    return json({ ok: true, token }, 200, { 'Set-Cookie': sessionCookie(token) });
  }

  // Apagar a conta: os dados próprios desaparecem e a identidade fica como
  // "[deleted]", para as referências noutras contas continuarem a fazer
  // sentido sem revelar quem era.
  if (path === '/api/me' && method === 'DELETE') {
    const b = await body(request);
    if (!b || String(b.confirm || '').trim().toUpperCase() !== 'APAGAR') {
      return err(400, 'Escreve APAGAR para confirmar.');
    }
    const full = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(me.id).first();
    // quem tem palavra-passe confirma com ela; contas Google confirmam so com a palavra
    if (full && full.pass_hash) {
      if (!b.password || !(await verifyPassword(String(b.password), full.pass_salt, full.pass_hash))) {
        return err(401, 'Palavra-passe errada.');
      }
    }
    await purgeAccount(env, me.id);
    await destroySession(env, me.token);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', true) });
  }
}
