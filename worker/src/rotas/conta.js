// A conta de quem está ligado: dados, termos, palavra-passe, sessões e apagar.
import { createSession, destroySession, sessionCookie, palavraNova, conferePalavra, tokenNoCorpo } from '../auth.js';
import { json, err, body, now, weakPassword, TERMS_VERSION } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { purgeAccount } from '../lib/acesso.js';

/* As rotas da própria conta: /api/me (ver e apagar), os termos, a
   palavra-passe e as sessões. Tudo aqui chega já autenticado — o `me` vem no
   contexto. O que mexe em credenciais sobe o sess_epoch, que é o que deita
   abaixo as sessões dos outros aparelhos, e põe um cookie novo para este
   continuar dentro (o token só vai no corpo fora de produção, a pedido —
   tokenNoCorpo, auth.js). Sem rota que sirva não devolve nada, e o worker segue.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   path, method e o utilizador em c.me).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o encaminhador tentar a seguinte. */
export async function rotasConta(c) {
  const { env, request, path, method, me } = c;

  if (path === '/api/me' && method === 'GET') {
    return json({
      id: me.id, email: me.email, name: me.name,
      terms: me.terms_version || null,
      termsCurrent: TERMS_VERSION,
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
      if (!b.current || !(await conferePalavra(env, String(b.current), full)).ok) {
        return err(401, 'A palavra-passe atual está errada.');
      }
    }
    const { hash, salt, v } = await palavraNova(env, String(b.next));
    const epoch = (full.sess_epoch || 0) + 1;
    await env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, pass_v = ?, sess_epoch = ? WHERE id = ?')
      .bind(hash, salt, v, epoch, me.id)
      .run();
    // este aparelho continua com sessão (o cookie novo); os outros ficam de fora
    const token = await createSession(env, me.id, epoch);
    return json({ ok: true, ...tokenNoCorpo(env, request, token) }, 200, { 'Set-Cookie': sessionCookie(token) });
  }

  // Terminar a sessão em todos os outros aparelhos.
  if (path === '/api/me/sessions' && method === 'DELETE') {
    const full = await env.DB.prepare('SELECT sess_epoch FROM users WHERE id = ?').bind(me.id).first();
    const epoch = ((full && full.sess_epoch) || 0) + 1;
    await env.DB.prepare('UPDATE users SET sess_epoch = ? WHERE id = ?').bind(epoch, me.id).run();
    const token = await createSession(env, me.id, epoch);
    return json({ ok: true, ...tokenNoCorpo(env, request, token) }, 200, { 'Set-Cookie': sessionCookie(token) });
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
    // uma conta de teste nao tem palavra-passe que se conheca: no ambiente
    // de teste, apaga-se sem ela
    const eDeTeste = env.ENV_NAME && /@teste\.rendorium\.com$/i.test(me.email || '');
    if (full && full.pass_hash && !eDeTeste) {
      if (!b.password || !(await conferePalavra(env, String(b.password), full)).ok) {
        return err(401, 'Palavra-passe errada.');
      }
    }
    /* uma conta de teste com dono não deixa quem testa no ecrã de login:
       apagada esta, entra-se logo na irmã — ou numa acabada de criar */
    let proxima = null;
    if (env.ENV_NAME && /@teste\.rendorium\.com$/i.test(me.email || '')) {
      try {
        const eu2 = await env.DB.prepare('SELECT test_owner FROM users WHERE id = ?').bind(me.id).first();
        if (eu2 && eu2.test_owner) {
          const { proximaContaDeTeste } = await import('../teste.js');
          await purgeAccount(env, me.id);
          await destroySession(env, me.token);
          proxima = await proximaContaDeTeste(env, eu2.test_owner);
          return json({ ok: true, proxima }, 200, { 'Set-Cookie': sessionCookie(proxima.token) });
        }
      } catch (e) { /* sem próxima, segue o caminho normal */ }
    }
    await purgeAccount(env, me.id);
    await destroySession(env, me.token);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', true) });
  }
}
