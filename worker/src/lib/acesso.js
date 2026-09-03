// Quem pode ver e mexer em que casa, e o que acontece quando uma conta
// desaparece. E aqui que vive a regra de ouro: o me.id vem sempre da
// sessao, nunca do pedido.

import { now } from './http.js';

// O dono acede sempre; outro utilizador só se a casa estiver partilhada consigo
// numa conexão aceite.
export async function canAccessHouse(env, userId, houseId) {
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
export async function participantsOf(env, houseId) {
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
export function preserveOwnership(existingDataStr, incoming) {
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

export async function connectionForUser(env, connId, userId) {
  return env.DB.prepare(
    'SELECT * FROM connections WHERE id = ? AND (requester_id = ? OR target_id = ?)'
  )
    .bind(connId, userId, userId)
    .first();
}

// Apaga tudo o que e do utilizador e deixa a identidade como lapide, para as
// referencias noutras contas continuarem legiveis sem revelar quem era.
export async function purgeAccount(env, uid) {
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
}

// Guarda um erro e avisa quem programa. Erros repetidos agrupam-se, para o
// canal não encher com a mesma linha vezes sem conta.
