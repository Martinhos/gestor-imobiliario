// Registo, entrada, saída e entrada com Google. Corre antes da sessão.
import { newUserId, createSession, destroySession, sessionCookie, tokensDoPedido, randomToken, sha256hex,
  palavraNova, conferePalavra, gastarComoUmaConta, tokenNoCorpo } from '../auth.js';
import { verifyIdToken } from '../oauth.js';
import { json, err, body, now, clientIp, weakPassword, TERMS_VERSION } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';

// Quanto vale uma ligação de reposição da palavra-passe: 1 hora, uma vez.
const REPOR_VALIDADE = 3600 * 1000;

/* Trata as rotas /api/auth/*: registo, entrada (email e Google), reposição de
   palavra-passe, configuração pública e saída. Recebe o contexto partilhado do
   worker; devolve uma Response quando a rota é dele e undefined para o pedido
   seguir para as rotas com sessão. Os POST (menos o logout) têm limite por IP.
   Nenhuma resposta leva o token da sessão no corpo em produção: vai no
   cookie HttpOnly (tokenNoCorpo, auth.js).
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   path, method; aqui ainda sem `me`, porque corre antes da sessão).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o pedido seguir para as rotas com sessão. */
export async function rotasAuth(c) {
  const { env, request, path, method } = c;

  // ---- Autenticação (sem sessão) -----------------------------------------

  // registo, entrada e entrada com Google: limitados por IP
  if (path.startsWith('/api/auth/') && method === 'POST' && !path.endsWith('/logout')) {
    const ip = clientIp(request);
    const isLogin = path.endsWith('/login');
    if (!(await rateLimit(env, (isLogin ? 'login:' : 'auth:') + ip, isLogin ? 10 : 5, 900))) {
      return err(429, 'Demasiadas tentativas. Espera uns minutos e tenta de novo.');
    }
  }

  if (path === '/api/auth/register' && method === 'POST') {
    const b = await body(request);
    if (!b || !b.email || !b.password) return err(400, 'Email e palavra-passe são obrigatórios.');
    if (b.terms !== TERMS_VERSION) {
      return err(400, 'Tens de aceitar os termos e a política de privacidade.');
    }
    // enquanto o serviço vive do plano gratuito, o número de contas é limitado
    const max = Number(env.MAX_USERS || 0);
    if (max > 0) {
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL').first();
      if ((c && c.n) >= max) {
        return err(503, 'A app atingiu o limite de contas desta fase. Tenta mais tarde ou pede acesso.');
      }
    }
    if (weakPassword(b.password)) {
      return err(400, 'A palavra-passe precisa de pelo menos 8 caracteres, com maiúsculas, minúsculas, números e um símbolo.');
    }
    const email = String(b.email).trim().toLowerCase();
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(400, 'Email inválido.');
    {
      // os endereços da casa não são de ninguém: contas @rendorium.com só
      // as de teste, e essas nascem pela porta própria (/test)
      const { dominioDaCasa } = await import('../lib/correio.js');
      if (dominioDaCasa(email)) return err(400, 'Os endereços @rendorium.com são da casa — usa o teu email pessoal.');
    }
    if (String(b.name || '').length > 120) return err(400, 'Nome demasiado longo.');
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return err(409, 'Já existe uma conta com este email.');
    const { hash, salt, v } = await palavraNova(env, String(b.password));
    let id = newUserId();
    // colisão de id curto é improvável mas barata de evitar
    while (await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first()) id = newUserId();
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, pass_hash, pass_salt, pass_v, created_at, terms_version, terms_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, email, String(b.name || '').trim(), hash, salt, v, now(), TERMS_VERSION, now())
      .run();
    const token = await createSession(env, id);
    return json({ id, email, name: String(b.name || '').trim(), ...tokenNoCorpo(env, request, token) }, 201, {
      'Set-Cookie': sessionCookie(token),
    });
  }

  /* Esqueci-me da palavra-passe. Duas rotas: pedir (manda o email com a
     ligação) e confirmar (troca a palavra-passe). A resposta do pedido é
     sempre a mesma, exista a conta ou não — enumerar emails registados é
     um presente que não se dá. A ligação vale 1 hora e uma só utilização,
     e serve também a quem entrou sempre pela Google e quer uma palavra-
     passe: é o mesmo gesto. O token vive na D1 (password_resets, migração
     0016), só o hash dele, como os convites: no KV, que é eventualmente
     consistente, nascia no ponto de presença de quem pediu e era lido no de
     quem abre o email — noutro aparelho, noutra rede —, e a primeira abertura
     dava «já foi usada ou expirou», que era falso (a lição da 0010). */
  if (path === '/api/auth/repor' && method === 'POST') {
    const b = await body(request);
    const email = String((b && b.email) || '').trim().toLowerCase();
    const sempre = json({ ok: true, msg: 'Se esse email tiver conta, enviámos uma ligação para repor a palavra-passe.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sempre;
    const u = await env.DB.prepare('SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL').bind(email).first();
    if (u) {
      const t = randomToken();
      const agora = now();
      await env.DB.batch([
        // as ligações que já expiraram vão de caminho
        env.DB.prepare('DELETE FROM password_resets WHERE expires_at < ?').bind(agora),
        env.DB.prepare('INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
          .bind(await sha256hex(t), u.id, agora, agora + REPOR_VALIDADE),
      ]);
      const { emailReporPassword } = await import('../lib/correio.js');
      const ligacao = new URL(request.url).origin + '/?repor=' + t;
      const r = await emailReporPassword(env, u.email, ligacao);
      if (!r.enviado) console.error('repor: email não enviado —', r.motivo);
    }
    return sempre;
  }

  if (path === '/api/auth/repor/confirmar' && method === 'POST') {
    const b = await body(request);
    const t = String((b && b.t) || '');
    const pass = String((b && b.password) || '');
    if (!/^[a-f0-9]{64}$/.test(t)) return err(400, 'Essa ligação não é válida.');
    if (weakPassword(pass)) return err(400, 'A palavra-passe precisa de 8+ caracteres com maiúscula, minúscula, número e símbolo.');
    // uso único e atómico: um UPDATE condicional que tem de mudar uma linha —
    // dois cliques ao mesmo tempo, só um troca a palavra-passe
    const h = await sha256hex(t);
    const agora = now();
    const gasto = await env.DB.prepare(
      'UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at >= ?'
    ).bind(agora, h, agora).run();
    const linha = gasto.meta && gasto.meta.changes === 1
      ? await env.DB.prepare('SELECT user_id FROM password_resets WHERE token_hash = ?').bind(h).first()
      : null;
    if (!linha) return err(410, 'Essa ligação já foi usada ou expirou. Pede outra no ecrã de entrada.');
    const { hash, salt, v } = await palavraNova(env, pass);
    // trocar a palavra-passe termina as sessões todas (se foi um estranho a
    // pedir a troca, as sessões dele morrem aqui) e as outras ligações por usar
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE users SET pass_hash = ?, pass_salt = ?, pass_v = ?, sess_epoch = COALESCE(sess_epoch, 0) + 1 WHERE id = ?'
      ).bind(hash, salt, v, linha.user_id),
      env.DB.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL').bind(agora, linha.user_id),
    ]);
    return json({ ok: true });
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const b = await body(request);
    if (!b || !b.email || !b.password) return err(400, 'Email e palavra-passe são obrigatórios.');
    const email = String(b.email).trim().toLowerCase();
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').bind(email).first();
    // tentativas por conta, não só por IP (força bruta a partir de vários IP)
    if (user && !(await rateLimit(env, 'acct:' + user.id, 30, 900))) {
      return err(429, 'Demasiadas tentativas nesta conta. Espera uns minutos.');
    }
    if (user && !user.pass_hash) return err(401, 'Esta conta entra com Google — usa esse botão.');
    if (!user) {
      // gasta o mesmo tempo de uma palavra-passe errada numa conta real: sem
      // isto, a diferença de resposta dizia a um atacante que emails existem
      await gastarComoUmaConta(env, String(b.password));
      return err(401, 'Email ou palavra-passe errados.');
    }
    const conf = await conferePalavra(env, String(b.password), user);
    if (!conf.ok) return err(401, 'Email ou palavra-passe errados.');
    /* Depois da password certa, de propósito: dizer "suspensa" a quem não
       provou ser o dono era contar a estranhos o estado da conta. */
    if (user.suspended_at) {
      return err(403, 'Esta conta está suspensa.');
    }
    // um hash sem pimenta refaz-se agora que se sabe a palavra-passe (fica pass_v 2)
    if (conf.refazer) {
      try {
        const n = await palavraNova(env, String(b.password));
        await env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, pass_v = ? WHERE id = ?')
          .bind(n.hash, n.salt, n.v, user.id).run();
      } catch (e) { /* fica para a próxima entrada: entrar não depende disto */ }
    }
    const token = await createSession(env, user.id, user.sess_epoch || 0);
    return json({ id: user.id, email: user.email, name: user.name, ...tokenNoCorpo(env, request, token) }, 200, {
      'Set-Cookie': sessionCookie(token),
    });
  }

  // Que fornecedores de entrada social estão configurados (ids públicos).
  if (path === '/api/auth/config' && method === 'GET') {
    // o ambiente vai junto: é o que permite à app esconder o que só faz
    // sentido em desenvolvimento, como carregar dados de exemplo
    return json({ google: env.GOOGLE_CLIENT_ID || null, ambiente: env.ENV_NAME || 'producao' });
  }

  // Entrada com Google: o cliente envia o ID token do fornecedor;
  // verificamos a assinatura e criamos/ligamos a conta pelo email.
  if (path === '/api/auth/google' && method === 'POST') {
    const provider = 'google';
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) return err(400, 'Entrada com Google não está configurada.');
    const b = await body(request);
    const token = b && (b.credential || b.id_token);
    if (!token) return err(400, 'Falta o token do fornecedor.');
    let payload;
    try {
      payload = await verifyIdToken(provider, token, clientId);
    } catch (e) {
      return err(401, 'Token rejeitado: ' + e.message);
    }
    const col = 'google_sub';
    const email = String(payload.email || '').trim().toLowerCase();
    {
      const { dominioDaCasa } = await import('../lib/correio.js');
      if (dominioDaCasa(email)) return err(400, 'Os endereços @rendorium.com são da casa — entra com o teu email pessoal.');
    }
    let user = await env.DB.prepare(`SELECT * FROM users WHERE ${col} = ? AND deleted_at IS NULL`)
      .bind(payload.sub)
      .first();
    if (!user && email) {
      user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').bind(email).first();
      if (user) await env.DB.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).bind(payload.sub, user.id).run();
    }
    if (!user) {
      if (!email) return err(400, 'O fornecedor não devolveu um email.');
      const name = String((b && b.name) || payload.name || '').trim();
      let id = newUserId();
      while (await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first()) id = newUserId();
      await env.DB.prepare(
        `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, ${col}) VALUES (?, ?, ?, '', '', ?, ?)`
      )
        .bind(id, email, name, now(), payload.sub)
        .run();
      user = { id, email, name };
    }
    if (user.suspended_at) {
      return err(403, 'Esta conta está suspensa.');
    }
    const token2 = await createSession(env, user.id, user.sess_epoch || 0);
    return json({ id: user.id, email: user.email, name: user.name, ...tokenNoCorpo(env, request, token2) }, 200, {
      'Set-Cookie': sessionCookie(token2),
    });
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    /* As contas de teste são persistentes: sair fecha a sessão e mais nada.
       No dia seguinte, a ligação nova do /test retoma a conta com os dados
       intactos — apagar é só com a opção limpar, de propósito. */
    // o Bearer e o cookie: um aparelho da versão anterior pode trazer os dois, diferentes
    for (const t of tokensDoPedido(request)) await destroySession(env, t);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', true) });
  }
}
