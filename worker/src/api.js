// API REST do Gestor Imobiliário.
//
// Modelo de dados: cada utilizador é dono das suas casas; os registos
// (inquilinos, contratos, movimentos, ...) pertencem a uma casa. Um utilizador
// pode ligar-se a outro através do id curto e, dentro dessa conexão, cada um
// escolhe que casas partilha. Casas partilhadas são visíveis e editáveis pelo
// outro utilizador; apagar a casa ou gerir a partilha é só do dono.

import {
  hashPassword,
  verifyPassword,
  newUserId,
  createSession,
  destroySession,
  sessionCookie,
  readSessionToken,
  getSessionUser,
} from './auth.js';
import { verifyIdToken } from './oauth.js';
import { notifyDev, ticketEmbed, errorEmbed } from './notify.js';

// forte: 8+ caracteres com maiúsculas, minúsculas, números e um símbolo
function weakPassword(p) {
  p = String(p);
  return p.length < 8 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function err(status, message) {
  return json({ error: message }, status);
}

const MAX_BODY = 2 * 1024 * 1024;   // 2 MB por pedido
const MAX_RECORD = 256 * 1024;      // 256 KB por registo guardado

// Versão dos termos e da política em vigor. Mudá-la faz a app pedir de novo
// a aceitação a toda a gente, na próxima vez que abrirem.
const TERMS_VERSION = '2026-08-31';

async function body(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return null;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const tooBig = (data) => {
  try { return JSON.stringify(data).length > MAX_RECORD; } catch (e) { return true; }
};

// Identificadores: só o que a app gera (uuid, ids curtos, nomes de tipo).
// Sem isto, um id com aspas ou < > escapava para o HTML de quem recebe a
// casa partilhada — era o caminho para roubar a sessão de outro utilizador.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const badId = (v) => !ID_RE.test(String(v == null ? '' : v));

// O corpo de um registo tem de ser um objeto simples, sem tentativas de
// poluir o protótipo, e o seu id nunca pode contradizer o id da linha.
function cleanData(data, id) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  if (Object.prototype.hasOwnProperty.call(data, '__proto__')) delete data['__proto__'];
  delete data.constructor;
  delete data.prototype;
  if (id !== undefined && 'id' in data) data.id = id;   // o id manda é o da linha
  return data;
}

// Travão simples contra força bruta e abuso. Os contadores vivem na D1: o KV
// gratuito só aceita mil escritas por dia e cada gravação de dados gastava uma.
async function rateLimit(env, key, limit, windowSec) {
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

const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'desconhecido';

const now = () => Date.now();

// O dono acede sempre; outro utilizador só se a casa estiver partilhada consigo
// numa conexão aceite.
async function canAccessHouse(env, userId, houseId) {
  const house = await env.DB.prepare('SELECT owner_id FROM houses WHERE id = ? AND deleted = 0')
    .bind(houseId)
    .first();
  if (!house) return { ok: false };
  if (house.owner_id === userId) return { ok: true, owner: true };
  const shared = await env.DB.prepare(
    `SELECT 1 FROM shares s
       JOIN connections c ON c.id = s.connection_id
      WHERE s.house_id = ? AND c.status = 'accepted'
        AND (c.requester_id = ? OR c.target_id = ?)
        AND s.owner_id <> ?`
  )
    .bind(houseId, userId, userId, userId)
    .first();
  return { ok: !!shared, owner: false };
}

// Comproprietários de uma casa: o dono + todos os utilizadores com quem a
// casa está partilhada através de conexões aceites.
async function participantsOf(env, houseId) {
  const house = await env.DB.prepare('SELECT owner_id FROM houses WHERE id = ? AND deleted = 0')
    .bind(houseId)
    .first();
  if (!house) return null;
  const rows = (
    await env.DB.prepare(
      `SELECT s.owner_id, c.requester_id, c.target_id
         FROM shares s JOIN connections c ON c.id = s.connection_id
        WHERE c.status = 'accepted' AND s.house_id = ?`
    )
      .bind(houseId)
      .all()
  ).results;
  const parts = [house.owner_id];
  rows.forEach((r) => {
    const other = r.requester_id === r.owner_id ? r.target_id : r.requester_id;
    if (!parts.includes(other)) parts.push(other);
  });
  return parts;
}

// As quotas (ownerIds/ownerShares) são geridas pelo servidor através das
// propostas de divisão: um cliente a gravar a casa nunca as pode alterar.
function preserveOwnership(existingDataStr, incoming) {
  // sem casa anterior (criação, ou ressurreição de uma apagada) as quotas
  // partem do zero: só o caminho das propostas as pode escrever
  delete incoming.ownerShares;
  delete incoming.ownerIds;
  try {
    const ex = JSON.parse(existingDataStr);
    if (ex && typeof ex === 'object') {
      if (ex.ownerShares !== undefined) incoming.ownerShares = ex.ownerShares;
      if (ex.ownerIds !== undefined) incoming.ownerIds = ex.ownerIds;
    }
  } catch (e) {}
  return incoming;
}

async function connectionForUser(env, connId, userId) {
  return env.DB.prepare(
    'SELECT * FROM connections WHERE id = ? AND (requester_id = ? OR target_id = ?)'
  )
    .bind(connId, userId, userId)
    .first();
}

// Apaga tudo o que e do utilizador e deixa a identidade como lapide, para as
// referencias noutras contas continuarem legiveis sem revelar quem era.
async function purgeAccount(env, uid) {
    // casas de outros onde este utilizador constava como comproprietário
    const foreign = (
      await env.DB.prepare(
        `SELECT DISTINCT s.house_id FROM shares s
           JOIN connections c ON c.id = s.connection_id
          WHERE (c.requester_id = ?1 OR c.target_id = ?1) AND s.owner_id <> ?1`
      )
        .bind(uid)
        .all()
    ).results;

    const stmts = [];
    for (const row of foreign) {
      const h = await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(row.house_id).first();
      if (!h) continue;
      let data;
      try { data = JSON.parse(h.data); } catch (e) { continue; }
      let touched = false;
      if (data.ownerShares && data.ownerShares[uid] !== undefined) { delete data.ownerShares[uid]; touched = true; }
      if (Array.isArray(data.ownerIds) && data.ownerIds.includes(uid)) {
        data.ownerIds = data.ownerIds.filter((x) => x !== uid);
        touched = true;
      }
      if (touched) {
        stmts.push(env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(data), now(), row.house_id));
      }
    }

    stmts.push(
      // dados próprios
      env.DB.prepare('DELETE FROM records WHERE house_id IN (SELECT id FROM houses WHERE owner_id = ?)').bind(uid),
      env.DB.prepare('DELETE FROM shares WHERE house_id IN (SELECT id FROM houses WHERE owner_id = ?)').bind(uid),
      env.DB.prepare('DELETE FROM share_proposals WHERE house_id IN (SELECT id FROM houses WHERE owner_id = ?)').bind(uid),
      env.DB.prepare('DELETE FROM houses WHERE owner_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM user_records WHERE user_id = ?').bind(uid),
      // ligações a outras pessoas
      env.DB.prepare('DELETE FROM shares WHERE owner_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM share_proposals WHERE proposed_by = ?').bind(uid),
      env.DB.prepare('DELETE FROM shares WHERE connection_id IN (SELECT id FROM connections WHERE requester_id = ?1 OR target_id = ?1)').bind(uid),
      env.DB.prepare('DELETE FROM connections WHERE requester_id = ?1 OR target_id = ?1').bind(uid),
      // lápide: a identidade some, as referências ficam legíveis
      env.DB.prepare(
        `UPDATE users SET name = '[deleted]', email = 'apagado-' || id || '@invalido.local',
           pass_hash = '', pass_salt = '', google_sub = NULL, apple_sub = NULL, deleted_at = ?
         WHERE id = ?`
      ).bind(now(), uid)
    );
    await env.DB.batch(stmts);
  await env.DB.batch(stmts);
}

// Guarda um erro e avisa quem programa. Erros repetidos agrupam-se, para o
// canal não encher com a mesma linha vezes sem conta.
export async function recordReport(env, ctx, kind, message, detail, userId) {
  const msg = String(message || '').slice(0, 2000);
  const fp = kind + ':' + msg.slice(0, 120);
  const t = now();
  try {
    const ex = await env.DB.prepare('SELECT * FROM reports WHERE fingerprint = ?').bind(fp).first();
    if (ex) {
      await env.DB.prepare('UPDATE reports SET n = n + 1, updated_at = ? WHERE id = ?').bind(t, ex.id).run();
      // só volta a avisar de hora a hora, e sempre nas primeiras vezes
      if (ex.n < 3 || t - ex.updated_at > 3600000) {
        notifyDev(env, ctx, errorEmbed({ ...ex, n: ex.n + 1, created_at: t }));
      }
      return;
    }
    const id = crypto.randomUUID();
    const row = {
      id, user_id: userId || null, kind, message: msg,
      detail: String(detail || '').slice(0, 2000), n: 1, created_at: t,
    };
    await env.DB.prepare(
      `INSERT INTO reports (id, user_id, kind, message, detail, fingerprint, n, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(id, row.user_id, kind, msg, row.detail, fp, t, t).run();
    notifyDev(env, ctx, errorEmbed(row));
  } catch (e) {
    // um relatório que falha não pode piorar o problema que estava a relatar
  }
}

export async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const seg = path.split('/').filter(Boolean); // ['api', ...]

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
    if (String(b.name || '').length > 120) return err(400, 'Nome demasiado longo.');
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return err(409, 'Já existe uma conta com este email.');
    const { hash, salt } = await hashPassword(String(b.password));
    let id = newUserId();
    // colisão de id curto é improvável mas barata de evitar
    while (await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first()) id = newUserId();
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, email, String(b.name || '').trim(), hash, salt, now(), TERMS_VERSION, now())
      .run();
    const token = await createSession(env, id);
    return json({ id, email, name: String(b.name || '').trim(), token }, 201, {
      'Set-Cookie': sessionCookie(token),
    });
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
      // gasta o mesmo tempo de um utilizador real: sem isto, a diferença de
      // resposta dizia a um atacante que emails existem
      await hashPassword(String(b.password));
      return err(401, 'Email ou palavra-passe errados.');
    }
    if (!(await verifyPassword(String(b.password), user.pass_salt, user.pass_hash))) {
      return err(401, 'Email ou palavra-passe errados.');
    }
    const token = await createSession(env, user.id, user.sess_epoch || 0);
    return json({ id: user.id, email: user.email, name: user.name, token }, 200, {
      'Set-Cookie': sessionCookie(token),
    });
  }

  // Que fornecedores de entrada social estão configurados (ids públicos).
  if (path === '/api/auth/config' && method === 'GET') {
    return json({ google: env.GOOGLE_CLIENT_ID || null });
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
    const token2 = await createSession(env, user.id, user.sess_epoch || 0);
    return json({ id: user.id, email: user.email, name: user.name, token: token2 }, 200, {
      'Set-Cookie': sessionCookie(token2),
    });
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    await destroySession(env, readSessionToken(request));
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', true) });
  }

  // ---- Tudo o resto exige sessão -----------------------------------------

  const me = await getSessionUser(env, request);
  if (!me) return err(401, 'Sessão inválida — inicia sessão de novo.');

  if (path === '/api/me' && method === 'GET') {
    return json({
      id: me.id, email: me.email, name: me.name,
      plan: me.plan || 'free',
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

  // Estado completo visível por este utilizador: casas próprias + partilhadas
  // comigo, registos dessas casas, dados globais e conexões.
  if (path === '/api/state' && method === 'GET') {
    const houses = (
      await env.DB.prepare(
        `SELECT h.id, h.owner_id, h.data, h.updated_at, u.name AS owner_name
           FROM houses h JOIN users u ON u.id = h.owner_id
          WHERE h.deleted = 0 AND (
            h.owner_id = ?1
            OR h.id IN (
              SELECT s.house_id FROM shares s
                JOIN connections c ON c.id = s.connection_id
               WHERE c.status = 'accepted'
                 AND (c.requester_id = ?1 OR c.target_id = ?1)
                 AND s.owner_id <> ?1
            )
          )`
      )
        .bind(me.id)
        .all()
    ).results;

    const houseIds = houses.map((h) => h.id);
    // a D1 limita o número de parâmetros por consulta: em blocos, muitas casas
    // partilhadas deixam de conseguir partir a página de quem as recebe
    const chunk = (arr, n) => {
      const out = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };
    const inChunks = async (ids, sql) => {
      let out = [];
      for (const part of chunk(ids, 50)) {
        const ph = part.map(() => '?').join(',');
        out = out.concat((await env.DB.prepare(sql.replace('{IN}', ph)).bind(...part).all()).results);
      }
      return out;
    };

    const records = houseIds.length
      ? await inChunks(houseIds,
          `SELECT house_id, kind, id, data, updated_at FROM records
            WHERE deleted = 0 AND house_id IN ({IN})`)
      : [];

    const userRecords = (
      await env.DB.prepare(
        'SELECT kind, id, data, updated_at FROM user_records WHERE user_id = ? AND deleted = 0'
      )
        .bind(me.id)
        .all()
    ).results;

    const connections = (
      await env.DB.prepare(
        `SELECT c.id, c.requester_id, c.target_id, c.status, c.created_at,
                ur.name AS requester_name, ut.name AS target_name,
                ur.email AS requester_email, ut.email AS target_email
           FROM connections c
           JOIN users ur ON ur.id = c.requester_id
           JOIN users ut ON ut.id = c.target_id
          WHERE c.requester_id = ?1 OR c.target_id = ?1`
      )
        .bind(me.id)
        .all()
    ).results;

    const shares = (
      await env.DB.prepare(
        `SELECT s.connection_id, s.owner_id, s.house_id FROM shares s
          WHERE s.connection_id IN (
            SELECT id FROM connections WHERE requester_id = ?1 OR target_id = ?1
          )`
      )
        .bind(me.id)
        .all()
    ).results;

    // comproprietários por casa (dono primeiro)
    const houseParts = {};
    houses.forEach((h) => { houseParts[h.id] = [h.owner_id]; });
    if (houseIds.length) {
      const rows = await inChunks(houseIds,
        `SELECT s.house_id, s.owner_id, c.requester_id, c.target_id
           FROM shares s JOIN connections c ON c.id = s.connection_id
          WHERE c.status = 'accepted' AND s.house_id IN ({IN})`);
      rows.forEach((r) => {
        const other = r.requester_id === r.owner_id ? r.target_id : r.requester_id;
        const list = houseParts[r.house_id];
        if (list && !list.includes(other)) list.push(other);
      });
    }

    // Ficha pessoal completa só para quem já é comproprietário ou aceitou a
    // ligação: um convite pendente não dá acesso aos dados de ninguém.
    const userIdSet = new Set([me.id]);
    Object.keys(houseParts).forEach((hid) => houseParts[hid].forEach((u) => userIdSet.add(u)));
    connections
      .filter((c) => c.status === 'accepted')
      .forEach((c) => { userIdSet.add(c.requester_id); userIdSet.add(c.target_id); });
    // os convites pendentes entram só com o nome, para se saber quem é
    const pendingPeers = new Set();
    connections
      .filter((c) => c.status !== 'accepted')
      .forEach((c) => { pendingPeers.add(c.requester_id); pendingPeers.add(c.target_id); });

    // ids apenas referidos em movimentos das casas visíveis (quem pagou ou
    // recebeu, incluindo contas já apagadas): entram só com o nome, para as
    // referências continuarem legíveis — "[deleted]" quando a conta se foi.
    const referenced = new Set();
    records.forEach((r) => {
      try {
        const d = JSON.parse(r.data);
        [d.paidBy, d.toId].forEach((u) => { if (u && !userIdSet.has(u)) referenced.add(u); });
      } catch (e) {}
    });

    const uidArr = [...new Set([...userIdSet, ...pendingPeers, ...referenced])];
    const userRows = await inChunks(uidArr, 'SELECT id, name FROM users WHERE id IN ({IN})');
    const fullArr = [...userIdSet];
    const profRecs = await inChunks(fullArr,
      `SELECT user_id, data FROM user_records
        WHERE kind = 'profile' AND id = 'main' AND deleted = 0 AND user_id IN ({IN})`);
    const profByUser = {};
    profRecs.forEach((r) => { try { profByUser[r.user_id] = JSON.parse(r.data); } catch (e) {} });
    const profiles = userRows.map((u) => ({
      userId: u.id,
      name: u.name,
      data: userIdSet.has(u.id) ? profByUser[u.id] || null : null,
    }));

    // propostas de divisão pendentes nas casas visíveis
    let proposals = [];
    if (houseIds.length) {
      proposals = (await inChunks(houseIds,
        `SELECT p.house_id, p.proposed_by, p.shares, p.approvals, p.created_at, u.name AS proposer_name
           FROM share_proposals p JOIN users u ON u.id = p.proposed_by
          WHERE p.house_id IN ({IN})`)).map((p) => ({
        houseId: p.house_id,
        proposedBy: p.proposed_by,
        proposedByName: p.proposer_name,
        shares: JSON.parse(p.shares),
        approvals: JSON.parse(p.approvals),
        createdAt: p.created_at,
      }));
    }

    return json({
      me: { id: me.id, email: me.email, name: me.name },
      profiles,
      proposals,
      houses: houses.map((h) => ({
        id: h.id,
        ownerId: h.owner_id,
        ownerName: h.owner_name,
        mine: h.owner_id === me.id,
        participants: houseParts[h.id] || [h.owner_id],
        updatedAt: h.updated_at,
        data: JSON.parse(h.data),
      })),
      records: records.map((r) => ({
        houseId: r.house_id,
        kind: r.kind,
        id: r.id,
        updatedAt: r.updated_at,
        data: JSON.parse(r.data),
      })),
      userRecords: userRecords.map((r) => ({
        kind: r.kind,
        id: r.id,
        updatedAt: r.updated_at,
        data: JSON.parse(r.data),
      })),
      connections: connections.map((c) => {
        const iAmRequester = c.requester_id === me.id;
        // quem convida revela o seu email a quem recebe; o contrário só
        // acontece depois de o convite ser aceite
        const showEmail = c.status === 'accepted' || !iAmRequester;
        return {
          id: c.id,
          status: c.status,
          incoming: !iAmRequester && c.status === 'pending',
          peer: {
            id: iAmRequester ? c.target_id : c.requester_id,
            name: iAmRequester ? c.target_name : c.requester_name,
            email: showEmail ? (iAmRequester ? c.target_email : c.requester_email) : null,
          },
          myShares: shares.filter((s) => s.connection_id === c.id && s.owner_id === me.id).map((s) => s.house_id),
          peerShares: shares.filter((s) => s.connection_id === c.id && s.owner_id !== me.id).map((s) => s.house_id),
        };
      }),
    });
  }

  // Sincronização em lote: o cliente envia todas as alterações pendentes de
  // uma vez. Cada operação é validada individualmente; a resposta devolve o
  // resultado por operação, pela mesma ordem.
  if (path === '/api/sync' && method === 'POST') {
    const b = await body(request);
    const ops = Array.isArray(b && b.ops) ? b.ops : null;
    if (!ops) return err(400, 'Corpo inválido — envia { ops: [...] }.');
    if (ops.length > 200) return err(400, 'Máximo de 200 operações por pedido.');
    // travão à quota diária de escritas da base: uma conta não pode gastá-la sozinha
    if (!(await rateLimit(env, 'w:' + me.id, 60, 900))) {
      return err(429, 'Demasiadas gravações seguidas. Espera um pouco — os dados não se perdem.');
    }
    const accessCache = new Map();
    const access = async (hid) => {
      if (!accessCache.has(hid)) accessCache.set(hid, (await canAccessHouse(env, me.id, hid)).ok);
      return accessCache.get(hid);
    };
    const results = [];
    for (const op of ops) {
      try {
        if (op.op !== 'put' && op.op !== 'del') { results.push({ ok: false, status: 400 }); continue; }
        const put = op.op === 'put';
        if (op.scope !== 'user' && badId(op.houseId)) { results.push({ ok: false, status: 400 }); continue; }
        if (op.scope !== 'house' && (badId(op.kind) || badId(op.id))) { results.push({ ok: false, status: 400 }); continue; }
        if (put) {
          const rowId = op.scope === 'house' ? String(op.houseId) : String(op.id);
          op.data = cleanData(op.data, rowId);
          if (!op.data) { results.push({ ok: false, status: 400 }); continue; }
          if (tooBig(op.data)) { results.push({ ok: false, status: 413 }); continue; }
        }
        if (op.scope === 'house') {
          const houseId = String(op.houseId || '');
          const existing = await env.DB.prepare('SELECT owner_id, deleted, data FROM houses WHERE id = ?')
            .bind(houseId).first();
          if (put) {
            if (existing && !existing.deleted) {
              if (!(await access(houseId))) { results.push({ ok: false, status: 403 }); continue; }
              await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
                .bind(JSON.stringify(preserveOwnership(existing.data, op.data)), now(), houseId).run();
            } else if (existing) {
              if (existing.owner_id !== me.id) { results.push({ ok: false, status: 403 }); continue; }
              await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ?, deleted = 0 WHERE id = ?')
                .bind(JSON.stringify(preserveOwnership('', op.data)), now(), houseId).run();
              accessCache.set(houseId, true);
            } else {
              await env.DB.prepare('INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)')
                .bind(houseId, me.id, JSON.stringify(preserveOwnership('', op.data)), now()).run();
              accessCache.set(houseId, true);
            }
          } else {
            if (!existing || existing.deleted) { results.push({ ok: true, gone: true }); continue; }
            if (existing.owner_id !== me.id) { results.push({ ok: false, status: 403 }); continue; }
            await env.DB.batch([
              env.DB.prepare('UPDATE houses SET deleted = 1, updated_at = ? WHERE id = ?').bind(now(), houseId),
              env.DB.prepare('UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ?').bind(now(), houseId),
              env.DB.prepare('DELETE FROM shares WHERE house_id = ?').bind(houseId),
              env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(houseId),
            ]);
            accessCache.delete(houseId);
          }
          results.push({ ok: true });
        } else if (op.scope === 'record') {
          const houseId = String(op.houseId || '');
          if (!(await access(houseId))) {
            // ao apagar, uma casa inacessível conta como "já não existe"
            results.push(put ? { ok: false, status: 403 } : { ok: true, gone: true });
            continue;
          }
          if (put) {
            await env.DB.prepare(
              `INSERT INTO records (house_id, kind, id, data, updated_at, deleted)
               VALUES (?, ?, ?, ?, ?, 0)
               ON CONFLICT (house_id, kind, id)
               DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`
            ).bind(houseId, String(op.kind), String(op.id), JSON.stringify(op.data), now()).run();
          } else {
            await env.DB.prepare(
              'UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ? AND kind = ? AND id = ?'
            ).bind(now(), houseId, String(op.kind), String(op.id)).run();
          }
          results.push({ ok: true });
        } else if (op.scope === 'user') {
          if (put) {
            await env.DB.prepare(
              `INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted)
               VALUES (?, ?, ?, ?, ?, 0)
               ON CONFLICT (user_id, kind, id)
               DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`
            ).bind(me.id, String(op.kind), String(op.id), JSON.stringify(op.data), now()).run();
          } else {
            await env.DB.prepare(
              'UPDATE user_records SET deleted = 1, updated_at = ? WHERE user_id = ? AND kind = ? AND id = ?'
            ).bind(now(), me.id, String(op.kind), String(op.id)).run();
          }
          results.push({ ok: true });
        } else {
          results.push({ ok: false, status: 400 });
        }
      } catch (e) {
        console.error('sync op failed', e);
        results.push({ ok: false, status: 500 });
      }
    }
    return json({ results });
  }

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
      `INSERT INTO tickets (id, user_id, kind, subject, body, status, context, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'criado', ?, ?, ?)`
    ).bind(id, me.id, kind, subject, text, row.context, t, t).run();
    const { ticketButtons } = await import('./discord.js');
    notifyDev(env, ctx, ticketEmbed(row, me), ticketButtons(id));
    return json({ ok: true, id }, 201);
  }

  if (path === '/api/tickets' && method === 'GET') {
    const rows = (
      await env.DB.prepare(
        `SELECT id, kind, subject, body, status, reply, created_at, updated_at
           FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
      ).bind(me.id).all()
    ).results;
    return json({ tickets: rows });
  }

  // erros apanhados no browser de quem usa a app
  if (path === '/api/reports' && method === 'POST') {
    if (!(await rateLimit(env, 'rp:' + me.id, 20, 3600))) return json({ ok: true });
    const b = await body(request);
    if (!b || !b.message) return err(400, 'Corpo inválido.');
    await recordReport(env, ctx, 'cliente', b.message, b.detail, me.id);
    return json({ ok: true });
  }

  // ---- Casas --------------------------------------------------------------

  if (seg[1] === 'houses' && seg.length === 3 && method === 'PUT') {
    const houseId = seg[2];
    if (badId(houseId)) return err(400, 'Identificador inválido.');
    const b = await body(request);
    if (!b) return err(400, 'Corpo inválido.');
    b.data = cleanData(b.data, houseId);
    if (!b.data) return err(400, 'Corpo inválido.');
    if (tooBig(b.data)) return err(413, 'Registo demasiado grande.');
    const existing = await env.DB.prepare('SELECT owner_id, deleted, data FROM houses WHERE id = ?')
      .bind(houseId)
      .first();
    if (existing && !existing.deleted) {
      const access = await canAccessHouse(env, me.id, houseId);
      if (!access.ok) return err(403, 'Sem acesso a esta casa.');
      await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(preserveOwnership(existing.data, b.data)), now(), houseId)
        .run();
    } else if (existing && existing.deleted) {
      if (existing.owner_id !== me.id) return err(403, 'Sem acesso a esta casa.');
      await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ?, deleted = 0 WHERE id = ?')
        .bind(JSON.stringify(preserveOwnership('', b.data)), now(), houseId)
        .run();
    } else {
      await env.DB.prepare(
        'INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)'
      )
        .bind(houseId, me.id, JSON.stringify(preserveOwnership('', b.data)), now())
        .run();
    }
    return json({ ok: true });
  }

  if (seg[1] === 'houses' && seg.length === 3 && method === 'DELETE') {
    const houseId = seg[2];
    const house = await env.DB.prepare('SELECT owner_id FROM houses WHERE id = ? AND deleted = 0')
      .bind(houseId)
      .first();
    if (!house) return err(404, 'Casa não encontrada.');
    if (house.owner_id !== me.id) return err(403, 'Só o dono pode apagar a casa.');
    await env.DB.batch([
      env.DB.prepare('UPDATE houses SET deleted = 1, updated_at = ? WHERE id = ?').bind(now(), houseId),
      env.DB.prepare('UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ?').bind(now(), houseId),
      env.DB.prepare('DELETE FROM shares WHERE house_id = ?').bind(houseId),
      env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(houseId),
    ]);
    return json({ ok: true });
  }

  // ---- Divisão de percentagens (com confirmação dos comproprietários) -----

  if (seg[1] === 'houses' && seg[3] === 'proposal' && method === 'POST') {
    const houseId = seg[2];
    const parts = await participantsOf(env, houseId);
    if (!parts || !parts.includes(me.id)) return err(403, 'Sem acesso a esta casa.');

    if (seg.length === 4) {
      if (parts.length < 2) return err(400, 'A casa não está partilhada — és o único proprietário.');
      const b = await body(request);
      const shares = b && typeof b.shares === 'object' && b.shares ? b.shares : null;
      if (!shares) return err(400, 'Corpo inválido — envia { shares: { utilizador: percentagem } }.');
      const keys = Object.keys(shares);
      if (!keys.length || keys.some((k) => !parts.includes(k))) {
        return err(400, 'A divisão só pode incluir os comproprietários da casa.');
      }
      let total = 0;
      for (const k of keys) {
        const v = Number(shares[k]);
        if (!isFinite(v) || v < 0) return err(400, 'Percentagens inválidas.');
        total += v;
      }
      if (Math.abs(total - 100) > 0.5) return err(400, 'As percentagens têm de somar 100.');
      await env.DB.prepare(
        `INSERT INTO share_proposals (house_id, proposed_by, shares, approvals, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (house_id) DO UPDATE SET proposed_by = excluded.proposed_by,
           shares = excluded.shares, approvals = excluded.approvals, created_at = excluded.created_at`
      )
        .bind(houseId, me.id, JSON.stringify(shares), JSON.stringify([me.id]), now())
        .run();
      return json({ ok: true, applied: false }, 201);
    }

    const row = await env.DB.prepare('SELECT * FROM share_proposals WHERE house_id = ?')
      .bind(houseId)
      .first();
    if (!row) return err(404, 'Não há nenhuma proposta pendente para esta casa.');

    if (seg[4] === 'accept' && seg.length === 5) {
      const approvals = new Set(JSON.parse(row.approvals));
      approvals.add(me.id);
      if (parts.every((u) => approvals.has(u))) {
        const house = await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(houseId).first();
        let data = {};
        try { data = JSON.parse(house.data); } catch (e) {}
        data.ownerShares = JSON.parse(row.shares);
        data.ownerIds = parts;
        await env.DB.batch([
          env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
            .bind(JSON.stringify(data), now(), houseId),
          env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(houseId),
        ]);
        return json({ ok: true, applied: true });
      }
      await env.DB.prepare('UPDATE share_proposals SET approvals = ? WHERE house_id = ?')
        .bind(JSON.stringify([...approvals]), houseId)
        .run();
      return json({ ok: true, applied: false });
    }

    if (seg[4] === 'reject' && seg.length === 5) {
      await env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(houseId).run();
      return json({ ok: true });
    }
  }

  // ---- Registos de uma casa ----------------------------------------------

  if (seg[1] === 'houses' && seg[3] === 'records' && seg.length === 6) {
    const [, , houseId, , kind, recordId] = seg;
    if (badId(houseId) || badId(kind) || badId(recordId)) return err(400, 'Identificador inválido.');
    const access = await canAccessHouse(env, me.id, houseId);
    if (!access.ok) return err(403, 'Sem acesso a esta casa.');
    if (method === 'PUT') {
      const b = await body(request);
      if (!b) return err(400, 'Corpo inválido.');
      b.data = cleanData(b.data, recordId);
      if (!b.data) return err(400, 'Corpo inválido.');
      if (tooBig(b.data)) return err(413, 'Registo demasiado grande.');
      await env.DB.prepare(
        `INSERT INTO records (house_id, kind, id, data, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT (house_id, kind, id)
         DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`
      )
        .bind(houseId, kind, recordId, JSON.stringify(b.data), now())
        .run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare(
        'UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ? AND kind = ? AND id = ?'
      )
        .bind(now(), houseId, kind, recordId)
        .run();
      return json({ ok: true });
    }
  }

  // ---- Dados globais do utilizador ---------------------------------------

  if (seg[1] === 'user-records' && seg.length === 4) {
    const [, , kind, recordId] = seg;
    if (badId(kind) || badId(recordId)) return err(400, 'Identificador inválido.');
    if (method === 'PUT') {
      const b = await body(request);
      if (!b) return err(400, 'Corpo inválido.');
      b.data = cleanData(b.data, recordId);
      if (!b.data) return err(400, 'Corpo inválido.');
      if (tooBig(b.data)) return err(413, 'Registo demasiado grande.');
      await env.DB.prepare(
        `INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT (user_id, kind, id)
         DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`
      )
        .bind(me.id, kind, recordId, JSON.stringify(b.data), now())
        .run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare(
        'UPDATE user_records SET deleted = 1, updated_at = ? WHERE user_id = ? AND kind = ? AND id = ?'
      )
        .bind(now(), me.id, kind, recordId)
        .run();
      return json({ ok: true });
    }
  }

  // ---- Conexões e partilha ------------------------------------------------

  if (path === '/api/connections' && method === 'POST') {
    const b = await body(request);
    const peerId = String((b && b.peerId) || '').trim().toUpperCase();
    if (!peerId) return err(400, 'Indica o id do outro utilizador.');
    if (peerId === me.id) return err(400, 'Não te podes ligar a ti próprio.');
    const peer = await env.DB.prepare('SELECT id, name FROM users WHERE id = ? AND deleted_at IS NULL')
      .bind(peerId)
      .first();
    if (!peer) return err(404, 'Não existe nenhum utilizador com esse id.');
    const dup = await env.DB.prepare(
      `SELECT id FROM connections
        WHERE (requester_id = ?1 AND target_id = ?2) OR (requester_id = ?2 AND target_id = ?1)`
    )
      .bind(me.id, peerId)
      .first();
    if (dup) return err(409, 'Já existe uma conexão com esse utilizador.');
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO connections (id, requester_id, target_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
    )
      .bind(id, me.id, peerId, now())
      .run();
    return json({ id, status: 'pending', peer: { id: peer.id, name: peer.name } }, 201);
  }

  if (seg[1] === 'connections' && seg.length === 4 && seg[3] === 'accept' && method === 'POST') {
    const conn = await connectionForUser(env, seg[2], me.id);
    if (!conn) return err(404, 'Conexão não encontrada.');
    if (conn.target_id !== me.id) return err(403, 'Só o utilizador convidado pode aceitar.');
    await env.DB.prepare("UPDATE connections SET status = 'accepted' WHERE id = ?").bind(conn.id).run();
    return json({ ok: true });
  }

  if (seg[1] === 'connections' && seg.length === 3 && method === 'DELETE') {
    const conn = await connectionForUser(env, seg[2], me.id);
    if (!conn) return err(404, 'Conexão não encontrada.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM shares WHERE connection_id = ?').bind(conn.id),
      env.DB.prepare('DELETE FROM connections WHERE id = ?').bind(conn.id),
    ]);
    return json({ ok: true });
  }

  if (seg[1] === 'connections' && seg.length === 4 && seg[3] === 'shares' && method === 'PUT') {
    const conn = await connectionForUser(env, seg[2], me.id);
    if (!conn) return err(404, 'Conexão não encontrada.');
    if (conn.status !== 'accepted') return err(400, 'A conexão ainda não foi aceite.');
    const b = await body(request);
    const houseIds = Array.isArray(b && b.houseIds) ? b.houseIds.map(String) : null;
    if (!houseIds) return err(400, 'Corpo inválido — envia { houseIds: [...] }.');
    // só posso partilhar casas minhas
    for (const hid of houseIds) {
      const h = await env.DB.prepare('SELECT owner_id FROM houses WHERE id = ? AND deleted = 0')
        .bind(hid)
        .first();
      if (!h || h.owner_id !== me.id) return err(403, `A casa ${hid} não é tua.`);
    }
    const stmts = [
      env.DB.prepare('DELETE FROM shares WHERE connection_id = ? AND owner_id = ?').bind(conn.id, me.id),
    ];
    for (const hid of houseIds) {
      stmts.push(
        env.DB.prepare('INSERT INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)').bind(
          conn.id,
          me.id,
          hid
        )
      );
    }
    await env.DB.batch(stmts);
    return json({ ok: true });
  }

  return err(404, 'Rota desconhecida.');
}
