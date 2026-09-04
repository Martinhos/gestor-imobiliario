// O estado completo que este utilizador pode ver, numa so leitura.

// Rota do GET /api/state: junta numa só resposta tudo o que este utilizador
// pode ver — casas, registos, dados globais, conexões, perfis e propostas.
// Só lê da base; noutros caminhos não devolve nada.
export async function rotasEstado(c) {
  const { env, request, ctx, path, method, seg, me, json, err, body, now, rateLimit, canAccessHouse, participantsOf, preserveOwnership, connectionForUser, badId, cleanData, tooBig, clientIp, TERMS_VERSION, purgeAccount } = c;

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
}
