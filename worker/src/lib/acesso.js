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
// O criador muda numa só situação: uma transferência aceite
// (rotas/casas.js:rotasTransferencias, migração 0021), que grava o owner_id
// novo pelo gravarCasa como as outras escritas da casa.

import { now } from './http.js';
import { normalizarPerms, permDoKind, podeAddKind, fraseRecusa, fundirPlaneado, planeadoTermina } from './permissoes.js';

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

// Os convites de colaborador por usar de um dono que deixam de incluir uma
// casa (apagada, ou transferida a outra pessoa): a casa sai da lista, e um
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
// revogado). Os anexos ficam presos à
// casa por agora: a app deixa desfazer o apagar, e o desfazer volta a gravar
// a casa e os registos com os mesmos anexos; a varredura do cron diário
// leva-os da D1 e do R2 passado o prazo (files.js:varrerAnexos).
// Recebe: env — o ambiente do worker (a base D1); houseId — o id da casa;
// ownerId — o dono (já verificado por quem chama).
// Devolve: promessa de nada — o efeito é o lote de escritas na base.
export async function apagarCasa(env, houseId, ownerId) {
  const t = now();
  const casa = await env.DB.prepare('SELECT rev FROM houses WHERE id = ?').bind(houseId).first();
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
  stmts.push(...(await convitesSemCasa(env, houseId, ownerId, t)));
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

// As quotas pedidas por omissão para «Continuar como comproprietário»: a
// minha (a de quem transfere) dividida a meias com quem recebe — somada à
// que ele já tivesse —, e as dos outros como estão. Sem quotas guardadas,
// parto de partes iguais entre os participantes de agora.
// Recebe: shares — o ownerShares guardado na casa (pode faltar); deId — quem
// transfere; paraId — quem recebe; parts — os participantes de agora (o
// criador primeiro).
// Devolve: o { id: percentagem } a somar exatamente 100 (2 casas decimais).
export function quotasAMeias(shares, deId, paraId, parts) {
  const todos = [...new Set([...(parts || []), deId])];
  const base = redistribuirQuotas(shares, '', todos)
    || Object.fromEntries(todos.map((u) => [u, 100 / todos.length]));
  const minha = Number(base[deId] || 0);
  const out = { ...base };
  out[deId] = minha / 2;
  out[paraId] = Number(out[paraId] || 0) + minha / 2;
  return redistribuirQuotas(out, '', Object.keys(out)) || { [deId]: 50, [paraId]: 50 };
}

// As quotas de uma casa quando a transferência é aceite. Sem «ficar», a
// quota de quem transfere vai para quem recebe (somada à que ele já tinha) e
// quem transfere sai; com «ficar», valem as do pedido. Em ambos, só ficam os
// que continuam participantes: a quota de quem perdeu o acesso pelo caminho
// (um comproprietário que só via a casa pela ligação a quem transferiu) vai
// para os que ficam, na proporção (redistribuirQuotas).
// Recebe: shares — o ownerShares guardado na casa (pode faltar); deId — quem
// transfere; paraId — quem recebe; ficar — se quem transfere fica
// comproprietário; pedidas — as quotas do pedido (com ficar); ficam — os
// participantes depois de aceitar.
// Devolve: o ownerShares novo ({ id: percentagem }) ou null (partes iguais).
export function quotasDaTransferencia(shares, deId, paraId, ficar, pedidas, ficam) {
  let base;
  if (ficar) base = pedidas && typeof pedidas === 'object' && !Array.isArray(pedidas) ? { ...pedidas } : null;
  else if (shares && typeof shares === 'object' && !Array.isArray(shares)) {
    base = { ...shares };
    const minha = Number(base[deId]);
    const temMinha = base[deId] !== null && base[deId] !== '' && isFinite(minha) && minha >= 0;
    if (temMinha) base[paraId] = (Number(base[paraId]) || 0) + minha;
    delete base[deId];
  }
  return redistribuirQuotas(base, ficar ? '' : deId, ficam);
}

// O aviso de que alguém saiu de uma casa, para um destinatário: uma linha de
// house_events com o nome da casa e o de quem saiu escritos no momento (o
// aviso lê-se igual depois de mudarem). O /api/state manda-os em departures.
// As transferências (rotas/casas.js) escrevem por aqui os avisos delas.
// Recebe: env — o ambiente do worker (a base D1); para — o id do
// destinatário; kind — 'colab.sair' (vai ao dono), 'casa.sair' (vai a cada
// participante que fica) ou um dos da transferência ('transf.pedido',
// 'transf.aceite', 'transf.recusada', 'transf.cancelada', 'casa.novo_dono',
// 'casa.sem_acesso', 'colab.removido'); houseId, houseName — a casa, com o
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
// antes e o lote é tudo ou nada.
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
    for (const row of foreign) {
      const h = await env.DB.prepare('SELECT data, rev FROM houses WHERE id = ?').bind(row.house_id).first();
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
        stmts.push(gravarCasa(env, row.house_id, h.rev, { data: JSON.stringify(data) }, now()));
      }
    }

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
      // condição depende); os avisos que recebeu e os que deu a outros
      env.DB.prepare('DELETE FROM house_exits WHERE user_id = ?1 OR house_id IN (SELECT id FROM houses WHERE owner_id = ?1)').bind(uid),
      env.DB.prepare('DELETE FROM house_events WHERE user_id = ?1 OR actor_id = ?1').bind(uid),
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
      // lápide: a identidade some, as referências ficam legíveis
      env.DB.prepare(
        `UPDATE users SET name = '[deleted]', email = 'apagado-' || id || '@invalido.local',
           pass_hash = '', pass_salt = '', google_sub = NULL, apple_sub = NULL, deleted_at = ?
         WHERE id = ?`
      ).bind(now(), uid)
    );
    // e as miniaturas deles (a chave de worker/src/files.js:chavesNoR2, escrita
    // aqui para não criar o ciclo de importações que o apagarDoR2 evita)
    await apagarDoR2(env, anexos.flatMap((id) => [id, 'tn/' + id]));
    await env.DB.batch(stmts);
}
