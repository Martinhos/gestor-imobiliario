// Quem pode ver e mexer em que casa, e o que acontece quando uma conta
// desaparece. E aqui que vive a regra de ouro: o me.id vem sempre da
// sessao, nunca do pedido.
//
// Três graus de acesso, por esta precedência: dono > comproprietário >
// colaborador. canAccessHouse/participantsOf continuam a significar SÓ dono
// + comproprietários (é o que conta nas quotas e nas propostas); acessoACasa
// junta o colaborador com o seu cargo, e é o que as escritas e os anexos
// consultam. Um colaborador nunca entra em participants.
//
// Comproprietário é quem tem a casa partilhada consigo numa conexão aceite
// OU quem é membro de um grupo partilhado vivo que a contém (migração 0017,
// rotas/grupos.js) — e não é o dono dela. As duas portas dão o mesmo grau,
// e um membro que também tenha um cargo é comproprietário (a precedência).
//
// Quem não criou a casa pode sair dela (DELETE /api/houses/:id/participacao,
// rotas/casas.js). Pela ligação, a partilha sai; por um grupo, fica uma
// linha em house_exits (migração 0019) e a pertença ao grupo deixa de lhe
// dar ESSA casa — continua no grupo e nas outras. Cada consulta que dá casas
// por grupo leva o SAIU_DA_CASA; a linha sai quando o criador volta a
// partilhar a casa com essa pessoa.
//
// O criador muda numa só situação: um pedido para transferir o controlo a um
// comproprietário, aceite por todos os comproprietários da casa
// (rotas/casas.js:rotasTransferencias, migrações 0021 e 0022), que grava o
// owner_id novo pelo gravarCasa como as outras escritas
// da casa. Os participantes ficam os mesmos: uma partilha dá a casa à ponta
// da ligação que não é o owner_id DELA, seja quem for o criador — por isso
// pode haver partilhas de quem já não é o criador (herdadas), que continuam
// a dar a casa a quem davam.

import { now } from './http.js';
import { normalizarPerms, permDoKind, podeAddKind, fraseRecusa, fundirPlaneado, planeadoTermina } from './permissoes.js';
import { apagarRastoDaConta } from './rasto.js';

/* A condição que tira de uma consulta por grupo quem saiu da casa: com gh a
   linha de shared_group_houses e m a de shared_group_members. É a mesma em
   todas as consultas que dão casas por grupo (aqui, rotas/estado.js e
   rotas/grupos.js) — sem ela num sítio, a casa voltava a quem saiu por esse. */
export const SAIU_DA_CASA =
  'NOT EXISTS (SELECT 1 FROM house_exits x WHERE x.house_id = gh.house_id AND x.user_id = m.user_id)';

/* A pergunta da compropriedade sem o dono, numa consulta só: a casa (?1)
   está partilhada com este utilizador (?2) numa conexão aceite, ou ele é
   membro de um grupo partilhado vivo que a contém (e não saiu dela). Quem
   chama já pôs o dono de parte — e uma casa do próprio num grupo seu não o
   torna comproprietário de si mesmo porque o dono responde antes. */
const COMPROPRIETARIO_SQL = `
  SELECT 1 FROM shares s
    JOIN connections c ON c.id = s.connection_id
   WHERE s.house_id = ?1 AND c.status = 'accepted'
     AND (c.requester_id = ?2 OR c.target_id = ?2) AND s.owner_id <> ?2
  UNION ALL
  SELECT 1 FROM shared_group_houses gh
    JOIN shared_groups g ON g.id = gh.group_id AND g.deleted = 0
    JOIN shared_group_members m ON m.group_id = gh.group_id
   WHERE gh.house_id = ?1 AND m.user_id = ?2 AND ${SAIU_DA_CASA}
   LIMIT 1`;

// Os membros dos grupos partilhados vivos que contêm a casa, pela ordem em
// que entraram, menos os que saíram dela (um membro de dois grupos com a
// mesma casa vem duas vezes: quem chama tira os repetidos).
const MEMBROS_DA_CASA_SQL = `
  SELECT m.user_id FROM shared_group_houses gh
    JOIN shared_groups g ON g.id = gh.group_id AND g.deleted = 0
    JOIN shared_group_members m ON m.group_id = gh.group_id
   WHERE gh.house_id = ? AND ${SAIU_DA_CASA}
   ORDER BY m.joined_at, m.user_id`;

// Apaga objetos do R2 em listas de até mil chaves, o máximo que o delete
// aceita. Vive aqui e não em files.js — que também o usa, na varredura —
// para o purgeAccount não criar um ciclo de importações.
// Recebe: env — o ambiente do worker (R2 em env.FILES); ids — as chaves a apagar.
// Devolve: nada — a promessa resolve quando saíram todas.
export async function apagarDoR2(env, ids) {
  for (let i = 0; i < ids.length; i += 1000) await env.FILES.delete(ids.slice(i, i + 1000));
}

// O dono acede sempre; outro utilizador só se for comproprietário — a casa
// partilhada consigo numa conexão aceite, ou membro de um grupo partilhado
// vivo que a contém.
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
  const shared = await env.DB.prepare(COMPROPRIETARIO_SQL).bind(houseId, userId).first();
  return { ok: !!shared, owner: false };
}

// Comproprietários de uma casa: o dono, depois todos os utilizadores com quem
// a casa está partilhada através de conexões aceites, depois os membros dos
// grupos partilhados vivos que a contêm — sem repetidos.
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
  const membros = (await env.DB.prepare(MEMBROS_DA_CASA_SQL).bind(houseId).all()).results;
  membros.forEach((m) => { if (!parts.includes(m.user_id)) parts.push(m.user_id); });
  return parts;
}

/* Os participantes de várias casas numa consulta só — as mesmas três portas
   de participantsOf (o dono, as partilhas em ligações aceites e os membros
   dos grupos vivos que não saíram), sem a ordem dela. É o que a purga de uma
   conta usa para fechar o período das quotas de cada casa sem gastar três
   consultas por casa.
   Recebe: env — o ambiente do worker (a base D1); ids — os ids das casas.
   Devolve: promessa de um Map id da casa → lista de ids (sem repetidos);
   uma casa apagada ou inexistente não vem. */
export async function participantesDeCasas(env, ids) {
  const out = new Map();
  if (!ids.length) return out;
  const rows = (await env.DB.prepare(
    `SELECT h.id AS house_id, h.owner_id AS user_id FROM houses h
      WHERE h.deleted = 0 AND h.id IN (SELECT value FROM json_each(?1))
     UNION
     SELECT s.house_id, CASE WHEN c.requester_id = s.owner_id THEN c.target_id ELSE c.requester_id END
       FROM shares s JOIN connections c ON c.id = s.connection_id
       JOIN houses h ON h.id = s.house_id AND h.deleted = 0
      WHERE c.status = 'accepted' AND s.house_id IN (SELECT value FROM json_each(?1))
     UNION
     SELECT gh.house_id, m.user_id FROM shared_group_houses gh
       JOIN shared_groups g ON g.id = gh.group_id AND g.deleted = 0
       JOIN shared_group_members m ON m.group_id = gh.group_id
       JOIN houses h ON h.id = gh.house_id AND h.deleted = 0
      WHERE gh.house_id IN (SELECT value FROM json_each(?1)) AND ${SAIU_DA_CASA}`
  ).bind(JSON.stringify([...new Set(ids)])).all()).results;
  rows.forEach((r) => {
    if (!out.has(r.house_id)) out.set(r.house_id, []);
    const l = out.get(r.house_id);
    if (!l.includes(r.user_id)) l.push(r.user_id);
  });
  return out;
}

// O acesso completo de um utilizador a uma casa, com o grau: dono,
// comproprietário (share numa conexão aceite, ou membro de um grupo
// partilhado vivo com a casa) ou colaborador (cargo do dono numa lista de
// casas). Por esta precedência — quem é participante nunca é tratado como
// colaborador, mesmo que tenha um cargo por engano.
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
  const shared = await env.DB.prepare(COMPROPRIETARIO_SQL).bind(houseId, userId).first();
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

/* A compropriedade de várias casas numa consulta só: as mesmas duas portas
   do COMPROPRIETARIO_SQL, com as casas numa lista JSON (?1) em vez de uma. */
const COMPROPRIETARIO_EM_LOTE_SQL = `
  SELECT s.house_id FROM shares s
    JOIN connections c ON c.id = s.connection_id
   WHERE s.house_id IN (SELECT value FROM json_each(?1)) AND c.status = 'accepted'
     AND (c.requester_id = ?2 OR c.target_id = ?2) AND s.owner_id <> ?2
  UNION
  SELECT gh.house_id FROM shared_group_houses gh
    JOIN shared_groups g ON g.id = gh.group_id AND g.deleted = 0
    JOIN shared_group_members m ON m.group_id = gh.group_id
   WHERE gh.house_id IN (SELECT value FROM json_each(?1)) AND m.user_id = ?2 AND ${SAIU_DA_CASA}`;

/* O acesso a várias casas de uma vez, com o grau e as mesmas regras de
   acessoACasa — é o que o /api/sync usa para um pedido com muitas
   operações gastar as mesmas consultas que um com uma (lib/escritas.js:
   aplicarOps). As linhas das casas já vêm lidas; daqui saem no máximo duas
   consultas: a compropriedade das que não são minhas, e o cargo das que
   sobram.
   Recebe: env — o ambiente do worker (a base D1); userId — o id do
   utilizador, vindo da sessão; houseIds — os ids das casas; linhas — Map
   id → linha de houses ({owner_id, deleted}) ou null quando não existe.
   Devolve: promessa de um Map id → o objeto de acessoACasa. */
export async function acessosACasas(env, userId, houseIds, linhas) {
  const out = new Map();
  const nada = { ok: false, owner: false, coowner: false, collab: null, ownerId: null };
  const base = (h) => ({ ok: true, owner: false, coowner: false, collab: null, ownerId: h.owner_id });
  const outros = [];
  houseIds.forEach((id) => {
    const h = linhas.get(id);
    if (!h || h.deleted) out.set(id, nada);
    else if (h.owner_id === userId) out.set(id, { ...base(h), owner: true });
    else outros.push(id);
  });
  if (!outros.length) return out;
  const co = new Set((await env.DB.prepare(COMPROPRIETARIO_EM_LOTE_SQL)
    .bind(JSON.stringify(outros), userId).all()).results.map((r) => r.house_id));
  const resto = outros.filter((id) => !co.has(id));
  co.forEach((id) => out.set(id, { ...base(linhas.get(id)), coowner: true }));
  if (!resto.length) return out;
  const cargos = (await env.DB.prepare(
    `SELECT ch.house_id, r.id, r.name, r.perms
       FROM collaborators c
       JOIN collaborator_houses ch ON ch.collaborator_id = c.id
       JOIN roles r ON r.id = c.role_id
       JOIN houses h ON h.id = ch.house_id
      WHERE c.user_id = ?1 AND ch.house_id IN (SELECT value FROM json_each(?2))
        AND c.owner_id = h.owner_id AND r.deleted = 0`
  ).bind(userId, JSON.stringify(resto)).all()).results;
  resto.forEach((id) => {
    const cargo = cargos.find((r) => r.house_id === id);
    if (!cargo) { out.set(id, { ...nada, ownerId: linhas.get(id).owner_id }); return; }
    let perms = [];
    try { perms = JSON.parse(cargo.perms); } catch (e) {}
    out.set(id, {
      ...base(linhas.get(id)),
      collab: { roleId: cargo.id, roleName: cargo.name, perms: new Set(normalizarPerms(perms)) },
    });
  });
  return out;
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
// quem grava é planeadoAGravar/fundirPlaneado: só next, until, muted e desde entram.
// E confirmar um planeado que termina («uma só vez», ou o next seguinte
// passa o fim) é apagá-lo no cliente — esse del passa também
// (planeadoTermina); noutro caso apagar o de outrem continua 403. Um
// planeado já apagado não se confirma nem se ressuscita por esta exceção.
// Os anexos que a escrita junta têm regra própria (escritas.js:recusaDosAnexos).
// Não lê a base: a linha do registo vem lida por quem chama (o /api/sync lê
// as de um pedido inteiro numa consulta, escritas.js:lerLinhas).
// Recebe: me — o utilizador com sessão; acesso — o objeto de acessoACasa;
// kind — o kind do registo; row — a linha de records ({deleted, created_by,
// data}) ou null quando não existe; put — true a gravar, false a apagar.
// Devolve: null quando pode, { gone: true } quando não há nada a apagar, ou
// { status, error } com o 403 e a frase para o cliente.
export function regraDoRegisto(me, acesso, kind, row, put) {
  if (!acesso.ok) return put ? { status: 403, error: fraseRecusa('acesso') } : { gone: true };
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
// só next, until, muted e desde mudam); o seu próprio, ou um novo, grava-se como
// veio. Donos e comproprietários gravam sempre o que mandam. Corre depois de
// regraDoRegisto dizer que sim e antes da regra dos anexos, da escrita e do
// linkFiles, para os três olharem para o que fica mesmo na base. Como
// regraDoRegisto, recebe a linha já lida.
// Recebe: me — o utilizador com sessão; acesso — o objeto de acessoACasa;
// kind — o kind do registo; row — a linha de records ({created_by, data}) ou
// null; data — o registo que o cliente mandou (já passado por cleanData).
// Devolve: o objeto a gravar — o próprio data, ou o planeado fundido.
export function planeadoAGravar(me, acesso, kind, row, data) {
  if (!acesso.collab || kind !== 'rec') return data;
  if (!row || row.created_by === me.id) return data;
  return fundirPlaneado(row.data, data);
}

// Os convites de colaborador por usar de um dono que deixam de incluir uma
// casa (apagada, ou cujo controlo passou a outra pessoa): a casa sai da lista, e um
// convite que ficasse sem casas fica revogado.
// Recebe: env — o ambiente do worker (a base D1); houseId — a casa; ownerId
// — o dono dos convites; t — o instante.
// Devolve: promessa da lista de instruções preparadas, para o lote de quem chama.
export async function convitesSemCasa(env, houseId, ownerId, t) {
  const convites = (
    await env.DB.prepare(
      'SELECT token_hash, house_ids FROM collab_invites WHERE owner_id = ? AND used_at IS NULL AND revoked_at IS NULL'
    ).bind(ownerId).all()
  ).results;
  const stmts = [];
  convites.forEach((i) => {
    let ids = [];
    try { ids = JSON.parse(i.house_ids); } catch (e) {}
    if (!Array.isArray(ids) || !ids.includes(houseId)) return;
    const resto = ids.filter((x) => x !== houseId);
    stmts.push(resto.length
      ? env.DB.prepare('UPDATE collab_invites SET house_ids = ? WHERE token_hash = ?').bind(JSON.stringify(resto), i.token_hash)
      : env.DB.prepare('UPDATE collab_invites SET revoked_at = ? WHERE token_hash = ?').bind(t, i.token_hash));
  });
  return stmts;
}

// Apagar uma casa, com tudo o que lhe está preso: os registos ficam marcados
// (lápide), as partilhas, propostas, atribuições de colaboradores, pedidos
// de partilha, a presença em grupos partilhados e as saídas de quem dela
// saiu por um grupo (house_exits) desaparecem, uma transferência pendente
// fica cancelada, e os convites
// por usar deixam de a incluir (um convite que ficasse sem casas fica
// revogado). Cada comproprietário que a perde fica com um aviso
// 'casa.apagada' (N067): a casa e as rendas dela saem também da Declaração
// dele, e sem o aviso nada lho dizia. Os anexos ficam presos à
// casa por agora: a app deixa desfazer o apagar, e o desfazer volta a gravar
// a casa e os registos com os mesmos anexos; a varredura do cron diário
// leva-os da D1 e do R2 passado o prazo (files.js:varrerAnexos).
// Recebe: env — o ambiente do worker (a base D1); houseId — o id da casa;
// ownerId — o dono (já verificado por quem chama).
// Devolve: promessa de nada — o efeito é o lote de escritas na base.
export async function apagarCasa(env, houseId, ownerId) {
  const t = now();
  const casa = await env.DB.prepare('SELECT rev, data FROM houses WHERE id = ?').bind(houseId).first();
  // os outros donos perdem a casa com ela: cada um fica com um aviso
  // 'casa.apagada' (N067), lidos antes de as partilhas saírem
  const outros = ((await participantsOf(env, houseId)) || []).filter((u) => u !== ownerId);
  const avisos = outros.length
    ? await avisosAosOutros(env, outros, 'casa.apagada', houseId, nomeDaCasaGuardada(casa && casa.data), ownerId, t)
    : [];
  const stmts = [
    gravarCasa(env, houseId, casa ? casa.rev : '', { deleted: 1 }, t),
    env.DB.prepare('UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ?').bind(t, houseId),
    env.DB.prepare('DELETE FROM shares WHERE house_id = ?').bind(houseId),
    env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(houseId),
    env.DB.prepare('DELETE FROM collaborator_houses WHERE house_id = ?').bind(houseId),
    env.DB.prepare(
      'DELETE FROM collaborators WHERE owner_id = ? AND id NOT IN (SELECT collaborator_id FROM collaborator_houses)'
    ).bind(ownerId),
    env.DB.prepare('DELETE FROM share_requests WHERE house_id = ?').bind(houseId),
    env.DB.prepare('DELETE FROM shared_group_houses WHERE house_id = ?').bind(houseId),
    env.DB.prepare('DELETE FROM house_exits WHERE house_id = ?').bind(houseId),
    env.DB.prepare("UPDATE house_transfers SET status = 'cancelled', decided_at = ? WHERE house_id = ? AND status = 'pending'")
      .bind(t, houseId),
  ];
  stmts.push(...(await convitesSemCasa(env, houseId, ownerId, t)), ...avisos);
  await env.DB.batch(stmts);
}

/* O nome de uma casa a partir do JSON guardado (estragado ou vazio dá '').
   Recebe: texto — o houses.data.
   Devolve: o nome (texto). */
function nomeDaCasaGuardada(texto) {
  try { const d = JSON.parse(texto); return d && typeof d === 'object' ? String(d.name || '') : ''; } catch (e) { return ''; }
}

/* Os nomes de algumas contas, numa consulta só, como estão agora (antes de
   uma purga os mudar para a lápide).
   Recebe: env — o ambiente do worker (a base D1); ids — os ids das contas.
   Devolve: promessa de {id: nome} — uma conta que não existe não vem. */
export async function nomesDeContas(env, ids) {
  const out = {};
  const lista = [...new Set((ids || []).filter((x) => typeof x === 'string' && x))];
  if (!lista.length) return out;
  (await env.DB.prepare('SELECT id, name FROM users WHERE id IN (SELECT value FROM json_each(?1))')
    .bind(JSON.stringify(lista)).all()).results.forEach((u) => { out[u.id] = String(u.name || ''); });
  return out;
}

/* Os avisos de uma casa aos outros donos (house_events, o departures do
   /api/state), com o nome de quem age lido agora.
   Recebe: env — o ambiente do worker; para — os ids dos destinatários; kind
   — o tipo do aviso (avisoDeSaida); houseId, houseName — a casa; quemId — o
   id de quem saiu ou apagou; t — o instante.
   Devolve: promessa da lista de instruções preparadas, para o lote de quem chama. */
async function avisosAosOutros(env, para, kind, houseId, houseName, quemId, t) {
  const nomes = await nomesDeContas(env, [quemId]);
  const quem = { id: quemId, name: nomes[quemId] || '' };
  return [...new Set(para)].map((u) => avisoDeSaida(env, u, kind, houseId, houseName, quem, t));
}

// Os campos da casa que só o servidor escreve: os donos e as quotas entre as
// contas, os comproprietários sem conta (D08) e o histórico das quotas com a
// data em que cada estado acabou (D29). Mudam pelas propostas de divisão, ao
// sair de uma casa e ao apagar uma conta — nunca por um cliente a gravar a
// ficha.
export const CAMPOS_DAS_QUOTAS = ['ownerShares', 'ownerIds', 'comproprietariosFora', 'quotasHist'];

// As quotas (ownerIds/ownerShares, comproprietariosFora e quotasHist) são
// geridas pelo servidor através das propostas de divisão: um cliente a gravar
// uma casa que já existe nunca as pode alterar. Numa casa sem linha anterior
// (criação, ou ressurreição de uma apagada — existingDataStr '') não há outro
// dono a proteger, e os comproprietários sem conta e o histórico das quotas
// que o cliente traz são factos da casa (N139: o que se escreveu sem conta,
// ou numa cópia reposta): entram, validados (quotasDaCriacao). Os donos e as
// percentagens entre as contas nunca entram.
// Recebe: existingDataStr — o JSON da casa como está na base, em texto (pode
// nem ser JSON válido; '' numa casa nova); incoming — o objeto da casa que o
// cliente mandou, alterado no próprio sítio; donoId (opcional) — quem cria a
// casa: sem ele, o quotasHist de uma casa nova não entra (os períodos
// precisam de um dono com conta).
// Devolve: o mesmo incoming, com os CAMPOS_DAS_QUOTAS repostos do que havia
// (ou, numa casa nova, só com os de fora e o histórico validados).
export function preserveOwnership(existingDataStr, incoming, donoId) {
  const novos = existingDataStr === '' ? quotasDaCriacao(incoming, donoId) : {};
  CAMPOS_DAS_QUOTAS.forEach((k) => { delete incoming[k]; });
  Object.keys(novos).forEach((k) => { incoming[k] = novos[k]; });
  try {
    const ex = JSON.parse(existingDataStr);
    if (ex && typeof ex === 'object') {
      CAMPOS_DAS_QUOTAS.forEach((k) => { if (ex[k] !== undefined) incoming[k] = ex[k]; });
    }
  } catch (e) {}
  return incoming;
}

// Quantos períodos do histórico das quotas uma casa nova pode trazer.
const MAX_PERIODOS_NA_CRIACAO = 200;

/* Os comproprietários sem conta e o histórico das quotas que uma casa nova
   traz do cliente, validados (N139): os de fora pelo validarFora (os ids que
   não servem nascem aqui; uma lista que não passa cai, e a casa fica «por
   confirmar»); cada período do histórico com uma data real até hoje (em
   Lisboa), os de fora dele validados da mesma maneira (um que não passa fica
   por confirmar), um só por dia e por ordem, até 200 — e, numa casa acabada
   de criar, com uma conta só: a de quem a cria, sem percentagens (os donos
   fichas de um aparelho sem conta não são contas).
   Recebe: incoming — a casa que o cliente mandou (não muda); donoId
   (opcional) — quem a cria; sem ele, o histórico não entra.
   Devolve: { comproprietariosFora?, quotasHist? } — só o que entra. */
export function quotasDaCriacao(incoming, donoId) {
  const out = {};
  const c = incoming && typeof incoming === 'object' ? incoming : {};
  const idNovo = () => crypto.randomUUID();
  if (c.comproprietariosFora !== undefined) {
    const f = validarFora(c.comproprietariosFora, idNovo);
    if (!f.erro) out.comproprietariosFora = f.fora;
  }
  if (typeof donoId === 'string' && donoId && Array.isArray(c.quotasHist)) {
    const hoje = diaEmLisboa(), dias = new Set(), hist = [];
    for (const e of c.quotasHist.slice(0, MAX_PERIODOS_NA_CRIACAO)) {
      const ate = e && typeof e === 'object' ? diaValido(e.ate) : '';
      if (!ate || ate >= hoje || dias.has(ate)) continue;
      dias.add(ate);
      const f = e.fora === undefined ? { fora: null } : validarFora(e.fora, idNovo);
      hist.push({ ate, ownerIds: [donoId], ownerShares: {}, fora: f.erro ? null : f.fora });
    }
    hist.sort((x, y) => (x.ate < y.ate ? -1 : x.ate > y.ate ? 1 : 0));
    if (hist.length) out.quotasHist = hist;
  }
  return out;
}

/* ===================== As quotas com data (D08, D29, D93) =====================
   A quota de cada um muda com uma data: a proposta aceite diz desde quando
   (share_proposals.desde, migração 0030), e sair de uma casa ou apagar uma
   conta mudam-na a partir de hoje (em Lisboa, o «hoje» da app). O estado que
   acaba vai para o quotasHist da casa com ate = a véspera desse dia:
   [{ate, ownerIds, ownerShares, fora}], por ordem de ate — o que valia até
   esse dia, inclusive —, com duas marcas opcionais: nomes ({id: nome} de quem
   saiu no fim do período, fecharQuotasHoje) e entrada ([ids] de quem entrou
   no dia seguinte, fecharQuotasNaEntrada, N018). Entrar também fecha o
   período: quem entra não era dono nos dias de antes até uma proposta dizer
   desde quando (com «desde sempre», DESDE_SEMPRE, o período sai). O de hoje é o ownerShares/ownerIds/comproprietariosFora
   da própria casa. A Declaração de cada ano usa o estado de cada data
   (web/app/saldos.js:quotasFiscais, o espelho no cliente).
   O ownerShares continua relativo entre as contas (soma 100, como nos
   Saldos); o comproprietariosFora — null (por confirmar), [] (não há outros)
   ou [{id, nome, quota}] — é a parte da casa de quem não tem conta, em % da
   casa inteira. A quota fiscal de cada conta é ownerShares × (100 − soma de
   fora) / 100. */

/* O dia de uma data AAAA-MM-DD real (2026-02-30 não é), ou nada.
   Recebe: v — o valor (texto vindo do cliente, ou qualquer outro).
   Devolve: o próprio 'AAAA-MM-DD', ou '' quando não é uma data de 1900 em diante. */
export function diaValido(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof v === 'string' ? v : '');
  if (!m) return '';
  const y = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  const d = new Date(Date.UTC(y, mes - 1, dia));
  if (y < 1900 || d.getUTCFullYear() !== y || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return '';
  return v;
}

/* O dia anterior a uma data, sem fuso (aritmética em UTC).
   Recebe: iso — 'AAAA-MM-DD'.
   Devolve: 'AAAA-MM-DD' da véspera, ou '' quando iso não é uma data. */
export function vesperaDe(iso) {
  if (!diaValido(iso)) return '';
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) - 1));
  return d.toISOString().slice(0, 10);
}

/* O dia de hoje em Lisboa, que é o «hoje» da app (web/app/formato.js:today
   corre no telemóvel de quem usa): é o dia em que uma saída ou uma conta
   apagada mudam as quotas. A mesma conta de lib/avisos-atraso.js:hojeEmLisboa,
   escrita aqui porque esse ficheiro importa este.
   Recebe: agora (opcional) — ms de época (now() por omissão).
   Devolve: 'AAAA-MM-DD'. */
export function diaEmLisboa(agora) {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(agora == null ? now() : agora));
  const o = {};
  for (const p of partes) o[p.type] = p.value;
  return o.year + '-' + o.month + '-' + o.day;
}

// Uma percentagem guardada que conta: um número finito e ≥ 0.
// Recebe: v — o valor guardado.
// Devolve: true quando conta.
function quotaConta(v) {
  return v !== undefined && v !== null && v !== '' && isFinite(Number(v)) && Number(v) >= 0;
}

/* As frações das contas de um estado das quotas, com a mesma regra do
   web/app/saldos.js:sharesOf (quem não tem percentagem fica com o que falta
   até 100, em partes iguais; sem nenhuma, partes iguais) — sem olhar para as
   fichas, que o servidor não tem.
   Recebe: ids — os donos (contas); raw — o ownerShares ({id: percentagem}).
   Devolve: {id: fração 0–1}; vazio sem donos. */
export function fracoesDasQuotas(ids, raw) {
  const os = [...new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === 'string' && x) : [])];
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  if (!os.length) return out;
  const tem = (o) => Object.prototype.hasOwnProperty.call(r, o) && quotaConta(r[o]);
  const dados = os.filter(tem), vazios = os.filter((o) => !tem(o));
  if (!dados.length) { os.forEach((o) => { out[o] = 1 / os.length; }); return out; }
  const somaD = dados.reduce((n, o) => n + Number(r[o]), 0);
  const resto = vazios.length ? Math.max(0, 100 - somaD) : 0, tot = somaD + resto;
  if (!(tot > 0)) { os.forEach((o) => { out[o] = 0; }); return out; }
  os.forEach((o) => { out[o] = tem(o) ? Number(r[o]) / tot : resto / vazios.length / tot; });
  return out;
}

/* Os comproprietários sem conta guardados numa casa, limpos: só os que têm
   nome e quota entre 0 e 100 (exclusive).
   Recebe: v — o comproprietariosFora guardado (null, [] ou a lista).
   Devolve: null (por confirmar, ou ilegível) ou a lista [{id, nome, quota}]. */
function foraGuardados(v) {
  if (!Array.isArray(v)) return null;
  return v.filter((f) => f && typeof f === 'object' && typeof f.nome === 'string' && f.nome.trim()
    && isFinite(Number(f.quota)) && Number(f.quota) > 0 && Number(f.quota) < 100)
    .map((f) => ({ id: typeof f.id === 'string' ? f.id : '', nome: f.nome, quota: Number(f.quota) }));
}

/* O estado das quotas de uma casa, como vai para o quotasHist: os donos
   (as contas que a casa tem), as percentagens só deles e os de fora.
   Recebe: data — o JSON da casa (objeto); donos (opcional) — os
   participantes de agora (acesso.js:participantsOf); sem eles, o
   data.ownerIds.
   Devolve: { ownerIds, ownerShares, fora } — cópias, sem referências ao data. */
export function estadoDasQuotas(data, donos) {
  const d = data && typeof data === 'object' ? data : {};
  const ids = [...new Set((Array.isArray(donos) ? donos : Array.isArray(d.ownerIds) ? d.ownerIds : [])
    .filter((x) => typeof x === 'string' && x))];
  const raw = d.ownerShares && typeof d.ownerShares === 'object' ? d.ownerShares : {};
  const ownerShares = {};
  ids.forEach((u) => { if (Object.prototype.hasOwnProperty.call(raw, u) && quotaConta(raw[u])) ownerShares[u] = Number(raw[u]); });
  return { ownerIds: ids, ownerShares, fora: foraGuardados(d.comproprietariosFora) };
}

/* Dois estados das quotas dão a mesma Declaração: as mesmas frações de cada
   conta (fracoesDasQuotas) e os mesmos de fora (nome e quota). «Por
   confirmar» (null) e «não há outros» ([]) contam como iguais: confirmar
   «Só eu» não muda o imposto de ninguém, e não abre um período novo.
   Recebe: a, b — dois estados ({ownerIds, ownerShares, fora}).
   Devolve: true quando são iguais. */
export function quotasIguais(a, b) {
  const fa = fracoesDasQuotas(a && a.ownerIds, a && a.ownerShares);
  const fb = fracoesDasQuotas(b && b.ownerIds, b && b.ownerShares);
  const ids = [...new Set([...Object.keys(fa), ...Object.keys(fb)])];
  if (ids.some((u) => Math.abs((fa[u] || 0) - (fb[u] || 0)) > 1e-9)) return false;
  const canon = (x) => (foraGuardados(x && x.fora) || [])
    .map((f) => f.nome.trim() + '|' + Math.round(f.quota * 100)).sort().join(';');
  return canon(a) === canon(b);
}

/* O quotasHist de uma casa quando as quotas mudam de «antes» para «novo» a
   partir do dia desde. O estado que valia na véspera acaba nesse dia:
   - se desde vem depois do fim do último período guardado, «antes» (o de
     hoje) entra no fim com ate = véspera(desde) — se for mesmo diferente do
     novo;
   - se desde cai dentro de um período já guardado (uma correção da data, ou
     uma mudança com efeitos para trás, aceite por todos), esse período passa
     a acabar na véspera e os seguintes saem: de desde em diante vale o novo.
   No fim, dois períodos seguidos iguais juntam-se, e um último igual ao novo
   sai (o novo já vale nesses dias). Puro: não mexe no que recebe.
   Recebe: hist — o quotasHist guardado (lixo conta como []); antes — o
   estado de hoje (estadoDasQuotas); novo — o estado que fica; desde —
   'AAAA-MM-DD', o primeiro dia do novo.
   Devolve: a lista nova, por ordem de ate. */
export function quotasComHistorico(hist, antes, novo, desde) {
  const lista = periodosGuardados(hist);
  const ate = vesperaDe(desde);
  if (!ate) return lista;
  const i = lista.findIndex((e) => e.ate >= ate);
  let out;
  if (i === -1) {
    if (quotasIguais(antes, novo)) return lista;
    out = lista.concat([{ ate, ownerIds: antes.ownerIds, ownerShares: antes.ownerShares, fora: antes.fora }]);
  } else {
    out = lista.slice(0, i + 1);
    // encurtado, o período já não acaba no dia em que alguém entrou: a data
    // é a da mudança, e um «desde sempre» já não o tira (aplicarQuotas)
    if (out[i].ate !== ate) delete out[i].entrada;
    out[i].ate = ate;
  }
  return juntarPeriodos(out, novo);
}

/* Os períodos guardados de um quotasHist, válidos e por ordem de ate, em
   cópias rasas (as marcas entrada e nomes vão com eles).
   Recebe: hist — o quotasHist guardado (lixo conta como []).
   Devolve: a lista nova. */
function periodosGuardados(hist) {
  return (Array.isArray(hist) ? hist : [])
    .filter((e) => e && typeof e === 'object' && diaValido(e.ate))
    .map((e) => ({ ...e }))
    .sort((x, y) => (x.ate < y.ate ? -1 : x.ate > y.ate ? 1 : 0));
}

/* O fim comum de quem mexe no histórico: dois períodos seguidos iguais
   juntam-se (o primeiro sai, o segundo cobre os dois — os nomes de quem saiu
   no fim do primeiro passam para ele), e um último igual ao estado novo sai
   (o novo já vale nesses dias).
   Recebe: out — a lista por ordem de ate (pode mudar); novo — o estado que fica.
   Devolve: a lista junta. */
function juntarPeriodos(out, novo) {
  const juntos = [];
  out.forEach((e, k) => {
    if (k < out.length - 1 && quotasIguais(e, out[k + 1])) {
      if (e.nomes && typeof e.nomes === 'object') out[k + 1].nomes = { ...e.nomes, ...(out[k + 1].nomes || {}) };
      return;
    }
    juntos.push(e);
  });
  if (juntos.length && quotasIguais(juntos[juntos.length - 1], novo)) juntos.pop();
  return juntos;
}

/* As percentagens de uma proposta, acertadas (D93): cada uma a 2 casas
   decimais e a soma exatamente 100 — o que falta (ou sobra) do
   arredondamento vai para a última, como o cliente a escreve (33,33 × 3 dá
   33,33/33,33/33,34). Só se acerta o que é arredondamento: cada percentagem
   pode estar a 0,05 pontos da certa (33,3 × 3 passa); 50/49,6 não passa.
   Se a última ficasse negativa, o acerto vai para a maior.
   Recebe: shares — {id: percentagem}, pela ordem em que vieram.
   Devolve: { quotas } com o ownerShares acertado, ou { erro } com a frase. */
export function acertarQuotas(shares) {
  const ids = Object.keys(shares || {});
  if (!ids.length) return { erro: 'Corpo inválido — envia { shares: { utilizador: percentagem } }.' };
  const cent = [];
  for (const k of ids) {
    const v = Number(shares[k]);
    if (shares[k] === null || shares[k] === '' || !isFinite(v) || v < 0) return { erro: 'Percentagens inválidas.' };
    cent.push(Math.round(v * 100));
  }
  const falta = 10000 - cent.reduce((n, v) => n + v, 0);
  if (Math.abs(falta) > 5 * ids.length) return { erro: 'As percentagens têm de somar 100.' };
  let k = ids.length - 1;
  if (cent[k] + falta < 0) cent.forEach((v, j) => { if (v > cent[k]) k = j; });
  cent[k] += falta;
  const quotas = {};
  ids.forEach((u, j) => { quotas[u] = cent[j] / 100; });
  return { quotas };
}

// Quantos comproprietários sem conta uma casa pode ter, e o tamanho do nome.
const MAX_FORA = 20, MAX_NOME_FORA = 80;

/* Os comproprietários sem conta de uma proposta (D08), validados: cada um
   com nome e quota em % da casa inteira (0 < quota < 100, a 2 casas), a soma
   abaixo de 100 (as contas ficam sempre com alguma coisa). O id vem do
   cliente (seguro) ou nasce aqui. null é «por confirmar»; [] é «não há
   outros» (o «Só eu»).
   Recebe: v — o fora que veio no corpo; idNovo — função que dá um id novo.
   Devolve: { fora } (null ou a lista [{id, nome, quota}]) ou { erro }. */
export function validarFora(v, idNovo) {
  if (v === null) return { fora: null };
  if (!Array.isArray(v) || v.length > MAX_FORA) return { erro: 'Os comproprietários de fora vêm numa lista (até ' + MAX_FORA + ').' };
  const fora = [], vistos = new Set();
  let soma = 0;
  for (const f of v) {
    const nome = f && typeof f.nome === 'string' ? f.nome.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_NOME_FORA) : '';
    const q = f ? Math.round(Number(f.quota) * 100) / 100 : NaN;
    if (!nome || !isFinite(q) || q <= 0 || q >= 100) {
      return { erro: 'Cada comproprietário de fora precisa de um nome e de uma quota entre 0 e 100.' };
    }
    let id = f && typeof f.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(f.id) ? f.id : '';
    if (!id || vistos.has(id)) id = idNovo();
    vistos.add(id);
    soma += Math.round(q * 100);
    fora.push({ id, nome, quota: q });
  }
  if (soma >= 10000) return { erro: 'As quotas dos comproprietários de fora têm de somar menos de 100.' };
  return { fora };
}

/* O «desde» de uma proposta cujas quotas valem também para trás: a pessoa
   respondeu «Desde sempre (já era assim)» — na primeira confirmação dos de
   fora, ou quando o dono que acabou de entrar na app já era dono (N018,
   N019). Vai no corpo da proposta e fica em share_proposals.desde. */
export const DESDE_SEMPRE = 'sempre';

/* Aplica um estado novo das quotas a uma casa, com o período que acaba a ir
   para o quotasHist: as percentagens entre as contas, os donos e — quando
   vem — os de fora. É o que a proposta aceite (e a de um dono só) faz.
   Sem data, as quotas novas valem a partir de hoje; e os de fora que
   estavam por confirmar (null) passam a ser os confirmados também para
   trás, nos períodos em que estavam por confirmar: confirmar quem mais é
   dono não é uma mudança, é dizer o que já era (o irmão que herdou a meias
   em 2020 não entrou na casa no dia em que a Ana o escreveu). Com data,
   vale a data: o que estava por confirmar até à véspera fica assim.
   Com desde 'sempre' (DESDE_SEMPRE — «já era assim», a escolha da primeira
   resposta e de quem acabou de entrar, N018/N019) as quotas novas valem
   também para trás: o estado de hoje não fica guardado (era um engano, ou
   uma divisão que não se sabia); os períodos fechados só porque alguém que
   agora é dono entrou na app (a marca entrada, fecharQuotasNaEntrada) saem —
   quem entrou já era dono —; e os de fora por confirmar passam a ser os
   confirmados, como sem data. As mudanças guardadas antes disso (uma saída,
   uma proposta com data) ficam.
   Recebe: data — o JSON da casa (objeto, alterado no sítio); parts — os
   participantes de agora; quotas — o ownerShares novo; fora — a lista nova,
   null, ou undefined para ficar como está; desde — 'AAAA-MM-DD', o primeiro
   dia das quotas novas, 'sempre', ou null (sem data: hoje, em Lisboa).
   Devolve: o mesmo data. */
export function aplicarQuotas(data, parts, quotas, fora, desde) {
  if (desde === DESDE_SEMPRE) {
    const lista = periodosGuardados(data.quotasHist)
      .filter((e) => !(Array.isArray(e.entrada) && e.entrada.some((u) => parts.includes(u))))
      .map((e) => (Array.isArray(fora) && foraGuardados(e.fora) === null ? { ...e, fora } : e));
    data.ownerShares = quotas;
    data.ownerIds = parts;
    if (fora !== undefined) data.comproprietariosFora = fora;
    data.quotasHist = juntarPeriodos(lista, estadoDasQuotas(data, parts));
    if (!data.quotasHist.length) delete data.quotasHist;
    return data;
  }
  const antes = estadoDasQuotas(data, parts);
  if (!desde && Array.isArray(fora)) {
    if (antes.fora === null) antes.fora = fora;
    if (Array.isArray(data.quotasHist)) {
      data.quotasHist = data.quotasHist.map((e) => (e && typeof e === 'object' && foraGuardados(e.fora) === null ? { ...e, fora } : e));
    }
  }
  data.ownerShares = quotas;
  data.ownerIds = parts;
  if (fora !== undefined) data.comproprietariosFora = fora;
  data.quotasHist = quotasComHistorico(data.quotasHist, antes, estadoDasQuotas(data, parts), desde || diaEmLisboa());
  if (!data.quotasHist.length) delete data.quotasHist;
  return data;
}

// A frase de quando outra escrita passou à frente vezes seguidas: o pedido
// não fez nada, e tentar outra vez resolve.
export const FRASE_CASA_MUDOU = 'Outra pessoa mexeu neste imóvel ao mesmo tempo. Tenta outra vez.';

// Uma escrita da app numa casa (migração 0020): grava as colunas pedidas com
// uma revisão nova, por cima da revisão que se leu. Se entretanto outra
// escrita mudou a casa, o trigger houses_revisao recusa esta e o lote
// inteiro em que vai desfaz-se — quem chama relê e tenta outra vez
// (comCasaFresca). Todas as escritas de houses no worker passam por aqui.
// Recebe: env — o ambiente do worker (a base D1); houseId — a casa; revLida
// — a rev que se leu junto com os dados ('' numa casa ainda sem revisão);
// campos — { data?, deleted?, ownerId? } (data já em texto; ownerId é o
// criador novo de uma transferência aceite); t — o instante.
// Devolve: a instrução preparada, para correr sozinha ou entrar num lote.
export function gravarCasa(env, houseId, revLida, campos, t) {
  const sets = [], args = [];
  if (campos.data !== undefined) { sets.push('data = ?'); args.push(campos.data); }
  if (campos.deleted !== undefined) { sets.push('deleted = ?'); args.push(campos.deleted); }
  if (campos.ownerId !== undefined) { sets.push('owner_id = ?'); args.push(campos.ownerId); }
  return env.DB.prepare(
    `UPDATE houses SET ${sets.join(', ')}, updated_at = ?, rev = ?, rev_base = ? WHERE id = ?`
  ).bind(...args, t, crypto.randomUUID(), revLida == null ? '' : revLida, houseId);
}

// Se um erro é a recusa do trigger houses_revisao (outra escrita mudou a
// casa depois de esta a ler).
// Recebe: e — o erro apanhado.
// Devolve: true quando é essa recusa.
export function casaMudou(e) {
  return /casa-mudou/.test(String((e && (e.message || e)) || ''));
}

// Corre uma escrita que lê uma casa e a grava com gravarCasa, e repete-a
// do princípio (a leitura incluída) quando outra escrita passou à frente.
// Às três recusas seguidas desiste e deixa sair o erro: quem chama responde
// com FRASE_CASA_MUDOU (409).
// Recebe: fazer — função assíncrona sem argumentos que lê, conta e grava;
// vezes — quantas tentativas (3 por omissão).
// Devolve: promessa do que fazer devolver.
export async function comCasaFresca(fazer, vezes = 3) {
  for (let i = 1; ; i++) {
    try { return await fazer(); }
    catch (e) { if (!casaMudou(e) || i >= vezes) throw e; }
  }
}

// A quota de quem sai de uma casa, dividida pelos que ficam na proporção das
// quotas deles. Só contam os que ficam e têm valor guardado; cada quota nova
// arredonda a 2 casas e a soma dá exatamente 100 — o resto do arredondamento
// vai para a maior. Sem quotas guardadas, ou com os que ficam a somar 0, não
// há proporção a seguir: null, que no cliente é «partes iguais».
// Recebe: shares — o ownerShares guardado na casa (pode faltar ou vir
// estragado); saiId — o id de quem sai; ficam — os ids dos participantes
// que continuam.
// Devolve: o ownerShares novo ({ id: percentagem }) ou null.
export function redistribuirQuotas(shares, saiId, ficam) {
  if (!shares || typeof shares !== 'object' || Array.isArray(shares)) return null;
  const temValor = (u) => Object.prototype.hasOwnProperty.call(shares, u) && shares[u] !== null
    && shares[u] !== '' && isFinite(Number(shares[u])) && Number(shares[u]) >= 0;
  const ids = [...new Set(ficam || [])].filter((u) => u !== saiId && temValor(u));
  const soma = ids.reduce((n, u) => n + Number(shares[u]), 0);
  if (!(soma > 0)) return null;
  // em centésimas de ponto, inteiras: a soma acerta-se sem erro de vírgula
  const cent = ids.map((u) => Math.round((Number(shares[u]) / soma) * 10000));
  let maior = 0;
  cent.forEach((v, i) => { if (v > cent[maior]) maior = i; });
  cent[maior] += 10000 - cent.reduce((n, v) => n + v, 0);
  const out = {};
  ids.forEach((u, i) => { out[u] = cent[i] / 100; });
  return out;
}

/* Quem sai de uma casa (ou apaga a conta) muda as quotas a partir de hoje:
   o estado de antes vai para o quotasHist com ate = ontem (em Lisboa). O
   data já tem as quotas novas; antes é o que tinha antes de mudar.
   O período que acaba ontem leva os nomes de quem saiu (nomes: {id: nome},
   lidos antes da saída): depois de sair, e sobretudo de apagar a conta, a
   pessoa já não está nas fichas de ninguém, e o aviso da Declaração de quem
   fica diz quem foi (N021).
   Recebe: data — o JSON da casa (objeto, alterado no sítio), já com as
   quotas de quem fica; antes — estadoDasQuotas de antes da mudança; ficam —
   os participantes que continuam; agora (opcional) — ms de época; nomes
   (opcional) — {id: nome} de quem sai.
   Devolve: o mesmo data. */
export function fecharQuotasHoje(data, antes, ficam, agora, nomes) {
  const hoje = diaEmLisboa(agora);
  data.quotasHist = quotasComHistorico(data.quotasHist, antes, estadoDasQuotas(data, ficam), hoje);
  const saiu = Object.keys(nomes || {}).filter((u) => !ficam.includes(u) && (antes.ownerIds || []).includes(u));
  const fim = data.quotasHist.find((e) => e.ate === vesperaDe(hoje));
  if (fim && saiu.length) {
    const n = { ...(fim.nomes && typeof fim.nomes === 'object' ? fim.nomes : {}) };
    saiu.forEach((u) => { n[u] = String(nomes[u] || '').slice(0, 80); });
    fim.nomes = n;
  }
  if (!data.quotasHist.length) delete data.quotasHist;
  return data;
}

/* Quem entra numa casa (uma partilha numa ligação, e as outras portas que
   chamem isto) fecha o período das quotas na véspera, como as saídas (N018):
   o estado de antes fica com os donos de então e as quotas de então, e quem
   entrou fica fora dele — com 0 % nesses dias — até uma proposta dizer desde
   quando é dono («desde sempre» tira o período: aplicarQuotas). O período
   leva a marca entrada: [ids] com quem entrou no dia seguinte. Uma entrada
   que não muda a Declaração de ninguém (quem entra fica com 0 %, as quotas
   já escritas) não abre período; se o período de ontem já estava fechado
   hoje por outra entrada, quem entra agora junta-se à marca dele (fechado
   por uma saída ou uma proposta, fica como está).
   Recebe: data — o JSON da casa (objeto, alterado no sítio); eram — os
   participantes antes; depois — os de agora; agora (opcional) — ms de época.
   Devolve: true quando o histórico mudou. */
export function fecharQuotasNaEntrada(data, eram, depois, agora) {
  const novos = [...new Set((depois || []).filter((u) => typeof u === 'string' && u && !(eram || []).includes(u)))];
  if (!novos.length || !(eram || []).length) return false;
  const ontem = vesperaDe(diaEmLisboa(agora));
  const lista = periodosGuardados(data.quotasHist);
  const ultimo = lista[lista.length - 1];
  if (ultimo && ultimo.ate >= ontem) {
    if (!Array.isArray(ultimo.entrada)) return false;
    const junta = novos.filter((u) => !ultimo.entrada.includes(u) && !(ultimo.ownerIds || []).includes(u));
    if (!junta.length) return false;
    ultimo.entrada = ultimo.entrada.concat(junta);
    data.quotasHist = lista;
    return true;
  }
  const antes = estadoDasQuotas(data, eram);
  if (quotasIguais(antes, estadoDasQuotas(data, depois))) return false;
  data.quotasHist = lista.concat([{ ate: ontem, ownerIds: antes.ownerIds, ownerShares: antes.ownerShares, fora: antes.fora, entrada: novos }]);
  return true;
}

// O aviso de que alguém saiu de uma casa, para um destinatário: uma linha de
// house_events com o nome da casa e o de quem saiu escritos no momento (o
// aviso lê-se igual depois de mudarem). O /api/state manda-os em departures.
// As transferências (rotas/casas.js) escrevem por aqui os avisos delas.
// Recebe: env — o ambiente do worker (a base D1); para — o id do
// destinatário; kind — 'colab.sair' (vai ao dono), 'casa.sair' (vai a cada
// participante que fica: saiu, ou a ligação, a partilha ou o grupo deixaram
// de lha dar), 'casa.sair_conta' (um comproprietário apagou a conta; vai a
// cada um que fica), 'casa.apagada' e 'casa.apagada_conta' (o criador apagou
// a casa, ou a conta com ela; vão a cada comproprietário), ou um dos da
// passagem do controlo ('transf.pedido',
// 'transf.aceite', 'transf.recusada', 'transf.cancelada', 'casa.novo_dono',
// 'colab.novo_dono'); houseId, houseName — a casa, com o
// nome lido ANTES de qualquer escrita; quem — quem age ({ id, name }); t — o instante.
// Devolve: a instrução preparada, para entrar no lote de quem chama.
export function avisoDeSaida(env, para, kind, houseId, houseName, quem, t) {
  return env.DB.prepare(
    `INSERT INTO house_events (id, user_id, kind, house_id, house_name, actor_id, actor_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), para, kind, houseId, String(houseName || ''), quem.id, String(quem.name || ''), t);
}

// A saída de alguém de uma casa desfeita: o criador voltou a partilhá-la com
// essa pessoa (pela ligação, ou num pedido de partilha aceite) e a casa volta
// a chegar-lhe também pelos grupos. Pôr a casa num grupo limpa a saída de
// todos os membros dele, numa consulta própria (rotas/grupos.js).
// Recebe: env — o ambiente do worker (a base D1); houseId — a casa; userId —
// quem tinha saído.
// Devolve: a instrução preparada, para entrar no lote de quem chama.
export function limparSaida(env, houseId, userId) {
  return env.DB.prepare('DELETE FROM house_exits WHERE house_id = ? AND user_id = ?').bind(houseId, userId);
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

/* Os anexos que saem com uma conta: os das casas dela (quem quer que os
   tenha carregado — a casa desaparece com os registos) e os que ela carregou
   e não estão numa casa viva de outra pessoa (soltos, ou numa casa apagada).
   Os que carregou para a casa de outro ficam lá: pertencem à casa, como os
   registos que lá escreveu, e passam a ser do dono dessa casa (ANEXO_DE_OUTRO). */
const ANEXO_QUE_SAI = `house_id IN (SELECT id FROM houses WHERE owner_id = ?1)
   OR (owner_id = ?1 AND (house_id IS NULL
       OR house_id NOT IN (SELECT id FROM houses WHERE deleted = 0 AND owner_id <> ?1)))`;
const ANEXO_DE_OUTRO = 'owner_id = ?1 AND house_id IN (SELECT id FROM houses WHERE deleted = 0 AND owner_id <> ?1)';

// Apaga tudo o que é do utilizador — anexos incluídos, na D1 e no R2 — e
// deixa a identidade como lápide, para as referências noutras contas
// continuarem legíveis sem revelar quem era. Os objetos do R2 saem antes do
// lote da D1: se o lote falhar, a conta fica, as linhas dos anexos apontam
// para nada (o GET dá 404) e apagar outra vez acaba o trabalho; ao contrário,
// ficavam no R2 documentos que já ninguém sabia que existiam.
// Recebe: env — o ambiente do worker (a base D1 e o R2); uid — o id da conta a apagar.
// Devolve: nada — o efeito é o lote de escritas na base, lápide incluída.
export async function purgeAccount(env, uid) {
  // as quotas das casas dos outros leem-se e gravam-se: se outra escrita
  // mudar uma delas a meio, o lote desfaz-se e a purga corre outra vez
  return comCasaFresca(() => purgarConta(env, uid));
}

// Uma passagem da purga de uma conta (purgeAccount, que a repete quando uma
// casa dos outros mudou entretanto). Correr duas vezes é seguro: o R2 sai
// antes e o lote é tudo ou nada. Nas casas dos outros de que era dona, a
// quota dela passa aos que ficam como numa saída (redistribuirQuotas, com o
// período fechado ontem) e cada um que fica recebe um aviso
// 'casa.sair_conta'; nas casas dela, que saem com a conta, cada
// comproprietário recebe um 'casa.apagada_conta' (D6, N021, N067, N136). Os
// avisos levam o id e não o nome dela, e o nome que as saídas de antes
// deixaram nos períodos das quotas (nomes) sai também: a identidade vai com
// a conta, e as referências ficam legíveis pela lápide.
// Recebe: env — o ambiente do worker (a base D1 e o R2); uid — o id da conta a apagar.
// Devolve: nada — o efeito é o lote de escritas na base, lápide incluída.
async function purgarConta(env, uid) {
    // casas de outros onde este utilizador constava como comproprietário —
    // por uma conexão aceite ou por um grupo partilhado vivo
    const foreign = (
      await env.DB.prepare(
        `SELECT DISTINCT s.house_id FROM shares s
           JOIN connections c ON c.id = s.connection_id
          WHERE (c.requester_id = ?1 OR c.target_id = ?1) AND s.owner_id <> ?1
         UNION
         SELECT gh.house_id FROM shared_group_houses gh
           JOIN shared_groups g ON g.id = gh.group_id AND g.deleted = 0
           JOIN shared_group_members m ON m.group_id = gh.group_id
           JOIN houses h ON h.id = gh.house_id
          WHERE m.user_id = ?1 AND h.owner_id <> ?1 AND ${SAIU_DA_CASA}`
      )
        .bind(uid)
        .all()
    ).results;

    const stmts = [];
    // os avisos a quem fica, que entram no fim do lote: a limpeza dos
    // house_events desta conta corre antes e não os leva. Sem o nome dela —
    // a identidade sai com a conta, como nas outras referências (a lápide)
    const avisos = [];
    const t = now();
    const quemSai = { id: uid, name: '' };
    // as casas dos outros a regravar, uma escrita por casa (duas no mesmo
    // lote chocavam na revisão): id → { data, rev }
    const escrever = new Map();
    // os donos de cada uma antes de a conta sair (numa consulta só): o
    // período das quotas que acaba hoje leva-os a todos (D29)
    const donosDe = await participantesDeCasas(env, foreign.map((r) => r.house_id));
    for (const row of foreign) {
      const h = await env.DB.prepare('SELECT data, rev FROM houses WHERE id = ?').bind(row.house_id).first();
      if (!h) continue;
      let data;
      try { data = JSON.parse(h.data); } catch (e) { continue; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
      const donos = donosDe.get(row.house_id) || [];
      if (!donos.includes(uid)) {
        // já não era dono desta (uma partilha numa ligação por aceitar): só
        // os restos dela saem, sem período nem aviso (não contavam)
        let mexeu = false;
        if (data.ownerShares && data.ownerShares[uid] !== undefined) { delete data.ownerShares[uid]; mexeu = true; }
        if (Array.isArray(data.ownerIds) && data.ownerIds.includes(uid)) { data.ownerIds = data.ownerIds.filter((x) => x !== uid); mexeu = true; }
        if (mexeu) escrever.set(row.house_id, { data, rev: h.rev });
        continue;
      }
      const ficam = donos.filter((x) => x !== uid);
      const antes = estadoDasQuotas(data, donos);
      // a quota de quem apaga a conta passa aos que ficam, na proporção das
      // deles, como numa saída (redistribuirQuotas, N136): só apagá-la deixava
      // as dos outros a somar menos de 100
      const quotas = redistribuirQuotas(data.ownerShares, uid, ficam);
      if (quotas) data.ownerShares = quotas; else delete data.ownerShares;
      data.ownerIds = ficam;
      // a partir de hoje: até ontem, a Declaração de cada um continua com as quotas de antes
      fecharQuotasHoje(data, antes, ficam);
      escrever.set(row.house_id, { data, rev: h.rev });
      // e cada um que fica é avisado (N021, D6): sem isto, nada lhe dizia que a quota mudou
      ficam.forEach((u) => avisos.push(avisoDeSaida(env, u, 'casa.sair_conta', row.house_id, String(data.name || ''), quemSai, t)));
    }
    // o nome dela nos períodos das quotas das casas dos outros (as saídas de
    // antes, fecharQuotasHoje) também sai: fica o id, como nas outras referências
    const comNome = (await env.DB.prepare(
      `SELECT id, data, rev FROM houses WHERE deleted = 0 AND owner_id <> ?1 AND instr(data, '"nomes"') > 0 AND instr(data, ?2) > 0`
    ).bind(uid, JSON.stringify(uid)).all()).results;
    for (const h of comNome) {
      let v = escrever.get(h.id);
      if (!v) {
        let data = null;
        try { data = JSON.parse(h.data); } catch (e) {}
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
        v = { data, rev: h.rev, soNomes: true };
      }
      let tirou = false;
      (Array.isArray(v.data.quotasHist) ? v.data.quotasHist : []).forEach((e) => {
        if (e && e.nomes && typeof e.nomes === 'object' && Object.prototype.hasOwnProperty.call(e.nomes, uid)) {
          delete e.nomes[uid];
          if (!Object.keys(e.nomes).length) delete e.nomes;
          tirou = true;
        }
      });
      if (tirou || !v.soNomes) escrever.set(h.id, v);
    }
    escrever.forEach((v, hid) => stmts.push(gravarCasa(env, hid, v.rev, { data: JSON.stringify(v.data) }, t)));
    // as casas desta conta saem com ela: cada comproprietário fica com o
    // aviso 'casa.apagada_conta' (N067), lido antes de as partilhas saírem
    const minhas = (await env.DB.prepare('SELECT id, data FROM houses WHERE owner_id = ? AND deleted = 0').bind(uid).all()).results;
    const donosDasMinhas = await participantesDeCasas(env, minhas.map((h) => h.id));
    minhas.forEach((h) => {
      (donosDasMinhas.get(h.id) || []).filter((u) => u !== uid)
        .forEach((u) => avisos.push(avisoDeSaida(env, u, 'casa.apagada_conta', h.id, nomeDaCasaGuardada(h.data), quemSai, t)));
    });

    // os anexos: primeiro os que ficam (passam para o dono da casa onde
    // estão), depois os que saem — antes das casas, de que a condição depende
    const anexos = (await env.DB.prepare(`SELECT id FROM files WHERE ${ANEXO_QUE_SAI}`).bind(uid).all())
      .results.map((r) => r.id);
    stmts.push(
      env.DB.prepare(
        `UPDATE files SET owner_id = (SELECT h.owner_id FROM houses h WHERE h.id = files.house_id) WHERE ${ANEXO_DE_OUTRO}`
      ).bind(uid),
      env.DB.prepare(`DELETE FROM files WHERE ${ANEXO_QUE_SAI}`).bind(uid),
    );

    stmts.push(
      // grupos partilhados: os de que é dono vão inteiros (membros, casas,
      // ligação e os pedidos para entrar); nos dos outros saem a sua linha de
      // membro, os pedidos que fez e as casas que lá pôs — antes das casas,
      // de que a última condição depende
      env.DB.prepare('DELETE FROM shared_group_members WHERE group_id IN (SELECT id FROM shared_groups WHERE owner_id = ?)').bind(uid),
      env.DB.prepare('DELETE FROM shared_group_houses WHERE group_id IN (SELECT id FROM shared_groups WHERE owner_id = ?)').bind(uid),
      env.DB.prepare('DELETE FROM shared_group_links WHERE group_id IN (SELECT id FROM shared_groups WHERE owner_id = ?)').bind(uid),
      env.DB.prepare('DELETE FROM shared_group_requests WHERE group_id IN (SELECT id FROM shared_groups WHERE owner_id = ?)').bind(uid),
      env.DB.prepare('DELETE FROM shared_groups WHERE owner_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM shared_group_members WHERE user_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM shared_group_requests WHERE user_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM shared_group_houses WHERE added_by = ?1 OR house_id IN (SELECT id FROM houses WHERE owner_id = ?1)').bind(uid),
      // as saídas: as dela e as das casas dela (antes das casas, de que a
      // condição depende); os avisos que recebeu saem, e os que deu a outros
      // ficam com eles sem o nome dela (D6: quem fica não perde o aviso de
      // que ela saiu ou apagou uma casa; a identidade sai, como na lápide)
      env.DB.prepare('DELETE FROM house_exits WHERE user_id = ?1 OR house_id IN (SELECT id FROM houses WHERE owner_id = ?1)').bind(uid),
      env.DB.prepare('DELETE FROM house_events WHERE user_id = ?1').bind(uid),
      env.DB.prepare("UPDATE house_events SET actor_name = '' WHERE actor_id = ?1").bind(uid),
      // as transferências que pediu e as que lhe pediram, decididas ou não
      env.DB.prepare('DELETE FROM house_transfers WHERE from_user = ?1 OR to_user = ?1').bind(uid),
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
      // o rasto das pessoas (lib/rasto.js): os eventos, os aparelhos e o pseudónimo
      ...apagarRastoDaConta(env, uid),
      // os atrasos que já foram num email a esta conta (lib/avisos-atraso.js)
      env.DB.prepare('DELETE FROM avisos_atraso WHERE user_id = ?').bind(uid),
      // as ligações por email que ainda houver: a da confirmação guarda o
      // endereço (migração 0027), e a da palavra-passe já não serve a ninguém
      env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(uid),
      env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(uid),
      // lápide: a identidade some, as referências ficam legíveis
      env.DB.prepare(
        `UPDATE users SET name = '[deleted]', email = 'apagado-' || id || '@invalido.local',
           pass_hash = '', pass_salt = '', google_sub = NULL, apple_sub = NULL,
           rasto_escolha = NULL, rasto_escolha_at = NULL, deleted_at = ?
         WHERE id = ?`
      ).bind(now(), uid),
      // os avisos a quem fica (e a quem perde as casas dela), depois da
      // limpeza dos house_events desta conta, que os levaria
      ...avisos
    );
    // e as miniaturas deles (a chave de worker/src/files.js:chavesNoR2, escrita
    // aqui para não criar o ciclo de importações que o apagarDoR2 evita)
    await apagarDoR2(env, anexos.flatMap((id) => [id, 'tn/' + id]));
    await env.DB.batch(stmts);
}
