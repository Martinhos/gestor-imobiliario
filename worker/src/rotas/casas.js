// Casas, quotas, registos de cada casa e dados globais do utilizador.
import { linkFiles, regraDosAnexos } from '../files.js';
import { acessoACasa, regraDoRegisto, planeadoAGravar, apagarCasa } from '../lib/acesso.js';
import { fundirCasa, fraseRecusa } from '../lib/permissoes.js';

/* Rotas das casas e do que vive dentro delas: criar/atualizar e apagar uma
   casa, propor e confirmar a divisão de quotas entre comproprietários, e os
   put/del de registos da casa e de dados globais do utilizador. Escreve na
   D1; devolve a Response da rota que casar com o pedido, ou nada para o
   encaminhador tentar a seguinte.
   Recebe: c — o contexto partilhado montado pelo handleApi (env, request,
   path, method, seg, o utilizador em c.me e os ajudantes).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o encaminhador tentar a seguinte. */
export async function rotasCasas(c) {
  const { env, request, ctx, path, method, seg, me, json, err, body, now, rateLimit, canAccessHouse, participantsOf, preserveOwnership, connectionForUser, badId, cleanData, tooBig, clientIp, TERMS_VERSION, purgeAccount } = c;

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
      const access = await acessoACasa(env, me.id, houseId);
      if (!access.ok) return err(403, 'Sem acesso a esta casa.');
      let dados = b.data;
      if (access.collab) {
        // a mesma regra do /api/sync: só com house.edit, e só os campos que o cargo vê
        if (!access.collab.perms.has('house.edit')) return err(403, fraseRecusa('casa'));
        dados = fundirCasa(existing.data, b.data, access.collab.perms);
      }
      await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(preserveOwnership(existing.data, dados)), now(), houseId)
        .run();
      await linkFiles(env, houseId, dados, 'house', houseId, me.id, !!access.collab);
      return json({ ok: true });
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
    await linkFiles(env, houseId, b.data, 'house', houseId, me.id);
    return json({ ok: true });
  }

  if (seg[1] === 'houses' && seg.length === 3 && method === 'DELETE') {
    const houseId = seg[2];
    const house = await env.DB.prepare('SELECT owner_id FROM houses WHERE id = ? AND deleted = 0')
      .bind(houseId)
      .first();
    if (!house) return err(404, 'Casa não encontrada.');
    if (house.owner_id !== me.id) return err(403, 'Só o dono pode apagar a casa.');
    await apagarCasa(env, houseId, me.id);
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

  if (seg[1] === 'houses' && seg[3] === 'records' && seg.length === 6 && (method === 'PUT' || method === 'DELETE')) {
    const [, , houseId, , kind, recordId] = seg;
    if (badId(houseId) || badId(kind) || badId(recordId)) return err(400, 'Identificador inválido.');
    const access = await acessoACasa(env, me.id, houseId);
    if (!access.ok) return err(403, 'Sem acesso a esta casa.');
    // a mesma regra do /api/sync (kind com cargo, .add, só o que criou)
    const veredicto = await regraDoRegisto(env, me, access, houseId, kind, recordId, method === 'PUT');
    if (veredicto && veredicto.gone) return json({ ok: true, gone: true });
    if (veredicto) return err(veredicto.status, veredicto.error);
    if (method === 'PUT') {
      const b = await body(request);
      if (!b) return err(400, 'Corpo inválido.');
      b.data = cleanData(b.data, recordId);
      if (!b.data) return err(400, 'Corpo inválido.');
      if (tooBig(b.data)) return err(413, 'Registo demasiado grande.');
      // o planeado do dono confirmado por um colaborador: só next/until/muted mudam (a mesma regra do /api/sync)
      const dados = await planeadoAGravar(env, me, access, houseId, kind, recordId, b.data);
      // os anexos que a escrita junta: um colaborador só com file.add (a mesma regra do /api/sync)
      const anexos = await regraDosAnexos(env, access, houseId, kind, recordId, dados);
      if (anexos) return err(anexos.status, anexos.error);
      await env.DB.prepare(
        `INSERT INTO records (house_id, kind, id, data, updated_at, deleted, author, created_by)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT (house_id, kind, id)
         DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0,
           author = excluded.author, created_by = COALESCE(records.created_by, excluded.created_by)`
      )
        .bind(houseId, kind, recordId, JSON.stringify(dados), now(), me.id, me.id)
        .run();
      await linkFiles(env, houseId, dados, kind, recordId, me.id, !!access.collab);
      return json({ ok: true });
    }
    await env.DB.prepare(
      'UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ? AND kind = ? AND id = ?'
    )
      .bind(now(), houseId, kind, recordId)
      .run();
    return json({ ok: true });
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
}
