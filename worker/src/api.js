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

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function err(status, message) {
  return json({ error: message }, status);
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

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

async function connectionForUser(env, connId, userId) {
  return env.DB.prepare(
    'SELECT * FROM connections WHERE id = ? AND (requester_id = ? OR target_id = ?)'
  )
    .bind(connId, userId, userId)
    .first();
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const seg = path.split('/').filter(Boolean); // ['api', ...]

  // ---- Autenticação (sem sessão) -----------------------------------------

  if (path === '/api/auth/register' && method === 'POST') {
    const b = await body(request);
    if (!b || !b.email || !b.password) return err(400, 'Email e palavra-passe são obrigatórios.');
    if (String(b.password).length < 8) return err(400, 'A palavra-passe precisa de pelo menos 8 caracteres.');
    const email = String(b.email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(400, 'Email inválido.');
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return err(409, 'Já existe uma conta com este email.');
    const { hash, salt } = await hashPassword(String(b.password));
    let id = newUserId();
    // colisão de id curto é improvável mas barata de evitar
    while (await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first()) id = newUserId();
    await env.DB.prepare(
      'INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(id, email, String(b.name || '').trim(), hash, salt, now())
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
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user || !(await verifyPassword(String(b.password), user.pass_salt, user.pass_hash))) {
      return err(401, 'Email ou palavra-passe errados.');
    }
    const token = await createSession(env, user.id);
    return json({ id: user.id, email: user.email, name: user.name, token }, 200, {
      'Set-Cookie': sessionCookie(token),
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
    return json({ id: me.id, email: me.email, name: me.name });
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
    let records = [];
    if (houseIds.length) {
      const placeholders = houseIds.map(() => '?').join(',');
      records = (
        await env.DB.prepare(
          `SELECT house_id, kind, id, data, updated_at FROM records
            WHERE deleted = 0 AND house_id IN (${placeholders})`
        )
          .bind(...houseIds)
          .all()
      ).results;
    }

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

    return json({
      me: { id: me.id, email: me.email, name: me.name },
      houses: houses.map((h) => ({
        id: h.id,
        ownerId: h.owner_id,
        ownerName: h.owner_name,
        mine: h.owner_id === me.id,
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
        return {
          id: c.id,
          status: c.status,
          incoming: !iAmRequester && c.status === 'pending',
          peer: {
            id: iAmRequester ? c.target_id : c.requester_id,
            name: iAmRequester ? c.target_name : c.requester_name,
            email: iAmRequester ? c.target_email : c.requester_email,
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
    if (ops.length > 500) return err(400, 'Máximo de 500 operações por pedido.');
    const accessCache = new Map();
    const access = async (hid) => {
      if (!accessCache.has(hid)) accessCache.set(hid, (await canAccessHouse(env, me.id, hid)).ok);
      return accessCache.get(hid);
    };
    const results = [];
    for (const op of ops) {
      try {
        const put = op.op === 'put';
        if (put && typeof op.data !== 'object') { results.push({ ok: false, status: 400 }); continue; }
        if (op.scope === 'house') {
          const houseId = String(op.houseId || '');
          const existing = await env.DB.prepare('SELECT owner_id, deleted FROM houses WHERE id = ?')
            .bind(houseId).first();
          if (put) {
            if (existing && !existing.deleted) {
              if (!(await access(houseId))) { results.push({ ok: false, status: 403 }); continue; }
              await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
                .bind(JSON.stringify(op.data), now(), houseId).run();
            } else if (existing) {
              if (existing.owner_id !== me.id) { results.push({ ok: false, status: 403 }); continue; }
              await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ?, deleted = 0 WHERE id = ?')
                .bind(JSON.stringify(op.data), now(), houseId).run();
              accessCache.set(houseId, true);
            } else {
              await env.DB.prepare('INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)')
                .bind(houseId, me.id, JSON.stringify(op.data), now()).run();
              accessCache.set(houseId, true);
            }
          } else {
            if (!existing || existing.deleted) { results.push({ ok: true, gone: true }); continue; }
            if (existing.owner_id !== me.id) { results.push({ ok: false, status: 403 }); continue; }
            await env.DB.batch([
              env.DB.prepare('UPDATE houses SET deleted = 1, updated_at = ? WHERE id = ?').bind(now(), houseId),
              env.DB.prepare('UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ?').bind(now(), houseId),
              env.DB.prepare('DELETE FROM shares WHERE house_id = ?').bind(houseId),
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

  // ---- Casas --------------------------------------------------------------

  if (seg[1] === 'houses' && seg.length === 3 && method === 'PUT') {
    const houseId = seg[2];
    const b = await body(request);
    if (!b || typeof b.data !== 'object') return err(400, 'Corpo inválido.');
    const existing = await env.DB.prepare('SELECT owner_id, deleted FROM houses WHERE id = ?')
      .bind(houseId)
      .first();
    if (existing && !existing.deleted) {
      const access = await canAccessHouse(env, me.id, houseId);
      if (!access.ok) return err(403, 'Sem acesso a esta casa.');
      await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(b.data), now(), houseId)
        .run();
    } else if (existing && existing.deleted) {
      if (existing.owner_id !== me.id) return err(403, 'Sem acesso a esta casa.');
      await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ?, deleted = 0 WHERE id = ?')
        .bind(JSON.stringify(b.data), now(), houseId)
        .run();
    } else {
      await env.DB.prepare(
        'INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)'
      )
        .bind(houseId, me.id, JSON.stringify(b.data), now())
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
    ]);
    return json({ ok: true });
  }

  // ---- Registos de uma casa ----------------------------------------------

  if (seg[1] === 'houses' && seg[3] === 'records' && seg.length === 6) {
    const [, , houseId, , kind, recordId] = seg;
    const access = await canAccessHouse(env, me.id, houseId);
    if (!access.ok) return err(403, 'Sem acesso a esta casa.');
    if (method === 'PUT') {
      const b = await body(request);
      if (!b || typeof b.data !== 'object') return err(400, 'Corpo inválido.');
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
    if (method === 'PUT') {
      const b = await body(request);
      if (!b || typeof b.data !== 'object') return err(400, 'Corpo inválido.');
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
    const peer = await env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(peerId).first();
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
