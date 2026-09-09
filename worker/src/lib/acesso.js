// Quem pode ver e mexer em que casa, e o que acontece quando uma conta
// desaparece. E aqui que vive a regra de ouro: o me.id vem sempre da
// sessao, nunca do pedido.
//
// Três graus de acesso, por esta precedência: dono > comproprietário >
// colaborador. canAccessHouse/participantsOf continuam a significar SÓ dono
// + comproprietários (é o que conta nas quotas e nas propostas); acessoACasa
// junta o colaborador com o seu cargo, e é o que as escritas e os anexos
// consultam. Um colaborador nunca entra em participants.

import { now } from './http.js';
import { normalizarPerms, permDoKind, podeAddKind, fraseRecusa, fundirPlaneado, planeadoTermina } from './permissoes.js';

// O dono acede sempre; outro utilizador só se a casa estiver partilhada consigo
// numa conexão aceite.
// Recebe: env — o ambiente do worker (a base D1); userId — o id do
// utilizador, vindo da sessão; houseId — o id da casa.
// Devolve: promessa de { ok, owner } — ok diz se pode entrar, owner se é o
// dono; casa inexistente ou apagada dá { ok: false }.
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
// Recebe: env — o ambiente do worker (a base D1); houseId — o id da casa.
// Devolve: promessa da lista de ids de utilizadores (o dono primeiro, sem
// repetidos), ou de null se a casa não existir.
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

// O acesso completo de um utilizador a uma casa, com o grau: dono,
// comproprietário (share numa conexão aceite) ou colaborador (cargo do dono
// numa lista de casas). Por esta precedência — quem é participante nunca é
// tratado como colaborador, mesmo que tenha um cargo por engano.
// Recebe: env — o ambiente do worker (a base D1); userId — o id do
// utilizador, vindo da sessão; houseId — o id da casa.
// Devolve: promessa de { ok, owner, coowner, collab, ownerId } — collab é
// { roleId, roleName, perms: Set } quando o acesso é por cargo e null nos
// outros casos; casa inexistente, apagada ou sem acesso dá ok: false.
export async function acessoACasa(env, userId, houseId) {
  const nada = { ok: false, owner: false, coowner: false, collab: null, ownerId: null };
  const house = await env.DB.prepare('SELECT owner_id FROM houses WHERE id = ? AND deleted = 0')
    .bind(houseId)
    .first();
  if (!house) return nada;
  const base = { ok: true, owner: false, coowner: false, collab: null, ownerId: house.owner_id };
  if (house.owner_id === userId) return { ...base, owner: true };
  const shared = await env.DB.prepare(
    `SELECT 1 FROM shares s
       JOIN connections c ON c.id = s.connection_id
      WHERE s.house_id = ? AND c.status = 'accepted'
        AND (c.requester_id = ? OR c.target_id = ?)
        AND s.owner_id <> ?`
  )
    .bind(houseId, userId, userId, userId)
    .first();
  if (shared) return { ...base, coowner: true };
  const cargo = await env.DB.prepare(
    `SELECT r.id, r.name, r.perms
       FROM collaborators c
       JOIN collaborator_houses ch ON ch.collaborator_id = c.id
       JOIN roles r ON r.id = c.role_id
      WHERE c.user_id = ? AND ch.house_id = ? AND c.owner_id = ? AND r.deleted = 0`
  )
    .bind(userId, houseId, house.owner_id)
    .first();
  if (!cargo) return { ...nada, ownerId: house.owner_id };
  let perms = [];
  try { perms = JSON.parse(cargo.perms); } catch (e) {}
  return {
    ...base,
    collab: { roleId: cargo.id, roleName: cargo.name, perms: new Set(normalizarPerms(perms)) },
  };
}

// A pergunta única das escritas: com este acesso, pode fazer isto? Dono e
// comproprietário podem tudo; um colaborador só o que o cargo diz.
// Recebe: acesso — o objeto de acessoACasa; perm — a permissão ('tx.add', ...).
// Devolve: true se pode.
export function podeNaCasa(acesso, perm) {
  if (!acesso || !acesso.ok) return false;
  if (acesso.owner || acesso.coowner) return true;
  return !!(acesso.collab && acesso.collab.perms.has(perm));
}

// Todas as casas onde este utilizador tem um cargo, numa só consulta. Não
// tira as casas onde também é participante — quem chama aplica a
// precedência (o /api/state fá-lo).
// Recebe: env — o ambiente do worker (a base D1); userId — o id do
// utilizador, vindo da sessão.
// Devolve: promessa de um Map houseId → { perms: Set, roleId, roleName, ownerId }.
export async function casasDeColaborador(env, userId) {
  const rows = (
    await env.DB.prepare(
      `SELECT ch.house_id, c.id AS collab_id, c.owner_id, r.id AS role_id, r.name AS role_name, r.perms
         FROM collaborators c
         JOIN collaborator_houses ch ON ch.collaborator_id = c.id
         JOIN roles r ON r.id = c.role_id
         JOIN houses h ON h.id = ch.house_id
        WHERE c.user_id = ? AND r.deleted = 0 AND h.deleted = 0 AND h.owner_id = c.owner_id`
    )
      .bind(userId)
      .all()
  ).results;
  const out = new Map();
  rows.forEach((r) => {
    let perms = [];
    try { perms = JSON.parse(r.perms); } catch (e) {}
    out.set(r.house_id, {
      id: r.collab_id,   // a linha de colaborador: e por ela que o proprio «sai» do imovel
      perms: new Set(normalizarPerms(perms)),
      roleId: r.role_id,
      roleName: r.role_name,
      ownerId: r.owner_id,
    });
  });
  return out;
}

// A regra única de escrita num registo de casa, partilhada pelo /api/sync e
// pelas rotas PUT/DELETE de casas.js: acesso à casa; para colaboradores, o
// kind tem de ter cargo, o cargo tem de ter o .add, e editar/apagar só o que
// o próprio criou; e criar contrato/planeado obedece ao plano do dono.
// A exceção a «só o que criou»: confirmar um planeado com rec.add. rec.add é
// «Adicionar e confirmar planeados», e confirmar é um put do planeado do
// dono (avança o next; silenciar mexe em muted) — sem isto o contabilista
// via o cartão «por confirmar» e levava 403 ao tocar-lhe. O put passa, mas
// quem grava é planeadoAGravar/fundirPlaneado: só next, until e muted entram.
// E confirmar um planeado que termina («uma só vez», ou o next seguinte
// passa o fim) é apagá-lo no cliente — esse del passa também
// (planeadoTermina); noutro caso apagar o de outrem continua 403. Um
// planeado já apagado não se confirma nem se ressuscita por esta exceção.
// Os anexos que a escrita junta têm regra própria (regraDosAnexos, files.js).
// Recebe: env — o ambiente do worker; me — o utilizador com sessão; acesso —
// o objeto de acessoACasa; houseId, kind, recordId — a linha; put — true a
// gravar, false a apagar.
// Devolve: promessa de null quando pode, { gone: true } quando não há nada a
// apagar, ou { status, error } com o 403 e a frase para o cliente.
export async function regraDoRegisto(env, me, acesso, houseId, kind, recordId, put) {
  if (!acesso.ok) return put ? { status: 403, error: fraseRecusa('acesso') } : { gone: true };
  const row = await env.DB.prepare(
    'SELECT deleted, created_by, data FROM records WHERE house_id = ? AND kind = ? AND id = ?'
  ).bind(houseId, kind, recordId).first();
  if (acesso.collab) {
    const perms = acesso.collab.perms;
    if (!permDoKind(kind)) return { status: 403, error: fraseRecusa('kind') };
    if (!podeAddKind(perms, kind)) return { status: 403, error: fraseRecusa('add', kind) };
    if (row && row.created_by !== me.id) {
      // confirmar um planeado vivo: o put passa (fundido depois); o del só se ele termina
      let dados = null;
      if (!put) { try { dados = JSON.parse(row.data); } catch (e) {} }
      const confirmar = kind === 'rec' && !row.deleted && (put || planeadoTermina(dados));
      if (!confirmar) return { status: 403, error: fraseRecusa('proprio') };
    }
  }
  if (!put) return row ? null : { gone: true };
  return null;
}

// O que se grava quando um colaborador escreve um planeado: se o planeado
// existe e não é dele, o que vem funde-se sobre o guardado (fundirPlaneado —
// só next, until e muted mudam); o seu próprio, ou um novo, grava-se como
// veio. Donos e comproprietários gravam sempre o que mandam. Corre depois de
// regraDoRegisto dizer que sim e antes de regraDosAnexos, do UPSERT e do
// linkFiles, para os três olharem para o que fica mesmo na base.
// Recebe: env — o ambiente do worker; me — o utilizador com sessão; acesso —
// o objeto de acessoACasa; houseId, kind, recordId — a linha; data — o
// registo que o cliente mandou (já passado por cleanData).
// Devolve: promessa do objeto a gravar — o próprio data, ou o planeado fundido.
export async function planeadoAGravar(env, me, acesso, houseId, kind, recordId, data) {
  if (!acesso.collab || kind !== 'rec') return data;
  const row = await env.DB.prepare(
    'SELECT created_by, data FROM records WHERE house_id = ? AND kind = ? AND id = ?'
  ).bind(houseId, kind, recordId).first();
  if (!row || row.created_by === me.id) return data;
  return fundirPlaneado(row.data, data);
}

// Apagar uma casa, com tudo o que lhe está preso: os registos ficam marcados
// (lápide), as partilhas, propostas, atribuições de colaboradores e pedidos
// de partilha desaparecem, e os convites por usar deixam de a incluir (um
// convite que ficasse sem casas fica revogado).
// Recebe: env — o ambiente do worker (a base D1); houseId — o id da casa;
// ownerId — o dono (já verificado por quem chama).
// Devolve: promessa de nada — o efeito é o lote de escritas na base.
export async function apagarCasa(env, houseId, ownerId) {
  const t = now();
  const stmts = [
    env.DB.prepare('UPDATE houses SET deleted = 1, updated_at = ? WHERE id = ?').bind(t, houseId),
    env.DB.prepare('UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ?').bind(t, houseId),
    env.DB.prepare('DELETE FROM shares WHERE house_id = ?').bind(houseId),
    env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(houseId),
    env.DB.prepare('DELETE FROM collaborator_houses WHERE house_id = ?').bind(houseId),
    env.DB.prepare(
      'DELETE FROM collaborators WHERE owner_id = ? AND id NOT IN (SELECT collaborator_id FROM collaborator_houses)'
    ).bind(ownerId),
    env.DB.prepare('DELETE FROM share_requests WHERE house_id = ?').bind(houseId),
  ];
  const convites = (
    await env.DB.prepare(
      'SELECT token_hash, house_ids FROM collab_invites WHERE owner_id = ? AND used_at IS NULL AND revoked_at IS NULL'
    ).bind(ownerId).all()
  ).results;
  convites.forEach((i) => {
    let ids = [];
    try { ids = JSON.parse(i.house_ids); } catch (e) {}
    if (!Array.isArray(ids) || !ids.includes(houseId)) return;
    const resto = ids.filter((x) => x !== houseId);
    stmts.push(resto.length
      ? env.DB.prepare('UPDATE collab_invites SET house_ids = ? WHERE token_hash = ?').bind(JSON.stringify(resto), i.token_hash)
      : env.DB.prepare('UPDATE collab_invites SET revoked_at = ? WHERE token_hash = ?').bind(t, i.token_hash));
  });
  await env.DB.batch(stmts);
}

// As quotas (ownerIds/ownerShares) são geridas pelo servidor através das
// propostas de divisão: um cliente a gravar a casa nunca as pode alterar.
// Recebe: existingDataStr — o JSON da casa como está na base, em texto (pode
// nem ser JSON válido); incoming — o objeto da casa que o cliente mandou,
// alterado no próprio sítio.
// Devolve: o mesmo incoming, com ownerShares/ownerIds repostos do que havia
// (ou sem eles, quando não havia).
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

// A conexão com este id em que o utilizador participa (convidou ou foi
// convidado), ou nada — a procura serve logo de verificação de acesso.
// Recebe: env — o ambiente do worker (a base D1); connId — o id da conexão;
// userId — o id do utilizador, vindo da sessão.
// Devolve: promessa da linha completa da tabela connections, ou de null
// quando não existe ou não é dele.
export async function connectionForUser(env, connId, userId) {
  return env.DB.prepare(
    'SELECT * FROM connections WHERE id = ? AND (requester_id = ? OR target_id = ?)'
  )
    .bind(connId, userId, userId)
    .first();
}

// Apaga tudo o que e do utilizador e deixa a identidade como lapide, para as
// referencias noutras contas continuarem legiveis sem revelar quem era.
// Recebe: env — o ambiente do worker (a base D1); uid — o id da conta a apagar.
// Devolve: nada — o efeito é o lote de escritas na base, lápide incluída.
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
      env.DB.prepare('DELETE FROM collaborator_houses WHERE house_id IN (SELECT id FROM houses WHERE owner_id = ?)').bind(uid),
      env.DB.prepare('DELETE FROM houses WHERE owner_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM user_records WHERE user_id = ?').bind(uid),
      // ligações a outras pessoas
      env.DB.prepare('DELETE FROM shares WHERE owner_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM share_proposals WHERE proposed_by = ?').bind(uid),
      env.DB.prepare('DELETE FROM shares WHERE connection_id IN (SELECT id FROM connections WHERE requester_id = ?1 OR target_id = ?1)').bind(uid),
      env.DB.prepare('DELETE FROM connections WHERE requester_id = ?1 OR target_id = ?1').bind(uid),
      // colaboradores: os cargos que deu, os que tinha, os convites e a ligação
      env.DB.prepare('DELETE FROM collaborator_houses WHERE collaborator_id IN (SELECT id FROM collaborators WHERE owner_id = ?1 OR user_id = ?1)').bind(uid),
      env.DB.prepare('DELETE FROM collaborators WHERE owner_id = ?1 OR user_id = ?1').bind(uid),
      env.DB.prepare('DELETE FROM roles WHERE owner_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM collab_invites WHERE owner_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM share_links WHERE owner_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM share_requests WHERE from_user = ?1 OR to_user = ?1').bind(uid),
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
