/* Colaboradores com cargos, convites de uso único e a ligação de partilha.
   -----------------------------------------------------------------------
   Um dono define cargos (listas de permissões), convida pessoas por uma
   ligação de uso único que fixa o cargo e as casas, e gere quem tem o quê.
   A ligação de partilha é permanente e faz o inverso: quem a abre pede para
   partilhar casas SUAS com o dono da ligação, que aceita ou recusa — nada
   entra sem a confirmação humana que a partilha por código sempre teve.

   Regras de segurança que este ficheiro cumpre (scratchpad de segurança):
   - guarda-se só o SHA-256 dos tokens; o token em claro vive no URL da
     criação e em mais lado nenhum;
   - GET mostra, POST age: as pré-visualizações (rotasPreVisualizacao) correm
     sem sessão e não escrevem nada; consumir um convite e pedir partilha
     exigem sessão e POST JSON (o Origin do index.js recusa outros sítios);
   - respostas uniformes: um convite inexistente, usado, expirado, revogado
     ou de dono apagado/suspenso dá o mesmo 404 com a mesma frase;
   - consumo atómico do convite (UPDATE condicional, meta.changes === 1);
   - tectos e rate limits por IP, por conta e por dono; auditoria em tudo. */

import { randomToken } from '../auth.js';
import { auditar } from '../lib/auditoria.js';
import { normalizarPerms } from '../lib/permissoes.js';
import { canAccessHouse } from '../lib/acesso.js';

const CONVITE_DIAS = 7;
const MAX_CONVITES_PENDENTES = 20;
const MAX_PEDIDOS_POR_DONO = 20;
const MAX_PEDIDOS_POR_DIA = 5;
const MAX_NOME_CARGO = 40;
const MAX_LABEL = 60;
const TOKEN_RE = /^[a-f0-9]{64}$/;
const ERRO_CONVITE = 'Essa ligação já foi usada, expirou, ou não existe. Pede outra a quem te convidou.';
const ERRO_LIGACAO = 'Esta ligação não serve.';

// O SHA-256 de um texto, em hexadecimal — é o que fica na base em vez do token.
// Recebe: s — o texto (o token em claro).
// Devolve: promessa da string hexadecimal (64 caracteres).
async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// A identidade com que um utilizador da app assina a auditoria.
// Recebe: me — o utilizador com sessão.
// Devolve: o objeto que auditar() espera ({ discordId, nome, papeis }).
function quemSou(me) {
  return { discordId: me.id, nome: me.name || '', papeis: ['utilizador'] };
}

// O nome de uma casa a partir do JSON guardado, sem rebentar com JSON mau.
// Recebe: dataStr — o texto da coluna houses.data.
// Devolve: o nome (string, pode ser vazia).
function nomeDaCasa(dataStr) {
  try { const d = JSON.parse(dataStr); return String((d && d.name) || ''); } catch (e) { return ''; }
}

// Corre uma consulta com IN ({IN}) em blocos de 50, por causa do limite de
// parâmetros da D1.
// Recebe: env — o ambiente do worker; ids — os valores a meter no IN; sql —
// a consulta com o marcador {IN}; extra (opcional) — parâmetros a passar
// antes dos ids.
// Devolve: promessa do array de linhas, todas as fatias juntas.
async function emBlocos(env, ids, sql, extra = []) {
  let out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const parte = ids.slice(i, i + 50);
    const ph = parte.map(() => '?').join(',');
    out = out.concat((await env.DB.prepare(sql.replace('{IN}', ph)).bind(...extra, ...parte).all()).results);
  }
  return out;
}

// Os nomes das casas vivas de um dono, por id.
// Recebe: env — o ambiente do worker; ownerId — o dono; ids — os ids das casas.
// Devolve: promessa de um Map id → nome (só as que existem, não apagadas, desse dono).
async function nomesDasCasas(env, ownerId, ids) {
  const out = new Map();
  if (!ids.length) return out;
  const rows = await emBlocos(env, ids,
    'SELECT id, data FROM houses WHERE owner_id = ? AND deleted = 0 AND id IN ({IN})', [ownerId]);
  rows.forEach((h) => out.set(h.id, nomeDaCasa(h.data)));
  return out;
}

// Os cargos de um dono, com quantas pessoas têm cada um.
// Recebe: env — o ambiente do worker; ownerId — o dono.
// Devolve: promessa do array [{ id, name, perms, n }] (perms já normalizadas).
export async function listarCargos(env, ownerId) {
  const rows = (
    await env.DB.prepare(
      `SELECT r.id, r.name, r.perms,
              (SELECT COUNT(*) FROM collaborators c WHERE c.role_id = r.id) AS n
         FROM roles r WHERE r.owner_id = ? AND r.deleted = 0 ORDER BY r.created_at`
    ).bind(ownerId).all()
  ).results;
  return rows.map((r) => {
    let perms = [];
    try { perms = JSON.parse(r.perms); } catch (e) {}
    return { id: r.id, name: r.name, perms: normalizarPerms(perms), n: r.n || 0 };
  });
}

// Os colaboradores de um dono, cada um com o cargo e as casas.
// Recebe: env — o ambiente do worker; ownerId — o dono.
// Devolve: promessa do array [{ id, userId, name, roleId, roleName, houses: [{ id, name }] }].
export async function listarColaboradores(env, ownerId) {
  const rows = (
    await env.DB.prepare(
      `SELECT c.id, c.user_id, u.name, c.role_id, r.name AS role_name
         FROM collaborators c
         JOIN users u ON u.id = c.user_id
         JOIN roles r ON r.id = c.role_id
        WHERE c.owner_id = ? ORDER BY u.name, r.name`
    ).bind(ownerId).all()
  ).results;
  if (!rows.length) return [];
  const casas = await emBlocos(env, rows.map((r) => r.id),
    `SELECT ch.collaborator_id, ch.house_id, h.data FROM collaborator_houses ch
       JOIN houses h ON h.id = ch.house_id
      WHERE h.deleted = 0 AND ch.collaborator_id IN ({IN})`);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    roleId: r.role_id,
    roleName: r.role_name,
    houses: casas.filter((x) => x.collaborator_id === r.id).map((x) => ({ id: x.house_id, name: nomeDaCasa(x.data) })),
  }));
}

// Os convites por usar de um dono — sem o token: só o prefixo do hash serve
// de id para revogar.
// Recebe: env — o ambiente do worker; ownerId — o dono.
// Devolve: promessa do array [{ id, label, roleId, roleName, houses: [{ id, name }], createdAt, expiresAt }].
export async function listarConvites(env, ownerId) {
  const rows = (
    await env.DB.prepare(
      `SELECT i.token_hash, i.label, i.role_id, i.house_ids, i.created_at, i.expires_at, r.name AS role_name
         FROM collab_invites i LEFT JOIN roles r ON r.id = i.role_id
        WHERE i.owner_id = ? AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at >= ?
        ORDER BY i.created_at DESC`
    ).bind(ownerId, Date.now()).all()
  ).results;
  const todas = new Set();
  const parsed = rows.map((r) => {
    let ids = [];
    try { ids = JSON.parse(r.house_ids); } catch (e) {}
    if (!Array.isArray(ids)) ids = [];
    ids.forEach((h) => todas.add(String(h)));
    return { r, ids };
  });
  const nomes = await nomesDasCasas(env, ownerId, [...todas]);
  return parsed.map(({ r, ids }) => ({
    id: r.token_hash.slice(0, 12),
    label: r.label || '',
    roleId: r.role_id,
    roleName: r.role_name || '',
    houses: ids.filter((h) => nomes.has(h)).map((h) => ({ id: h, name: nomes.get(h) })),
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));
}

// O estado da ligação de partilha de um dono, sem o URL (o URL só sai na
// criação; o cliente guarda-o).
// Recebe: env — o ambiente do worker; ownerId — o dono.
// Devolve: promessa de { ativo, uses, createdAt } (createdAt null sem ligação).
export async function estadoDaLigacao(env, ownerId) {
  const l = await env.DB.prepare('SELECT created_at, revoked_at, uses FROM share_links WHERE owner_id = ?')
    .bind(ownerId).first();
  if (!l) return { ativo: false, uses: 0, createdAt: null };
  return { ativo: !l.revoked_at, uses: l.uses || 0, createdAt: l.created_at };
}

// Os pedidos de partilha pendentes em que este utilizador participa: os que
// lhe chegaram (para aceitar/recusar) e os que enviou (para cancelar).
// Recebe: env — o ambiente do worker; userId — o utilizador.
// Devolve: promessa de { incoming: [{ id, fromId, fromName, houseId, houseName, createdAt }],
// outgoing: [{ id, toId, toName, houseId, houseName, createdAt }] }.
export async function pedidosDePartilha(env, userId) {
  const rows = (
    await env.DB.prepare(
      `SELECT p.id, p.from_user, p.to_user, p.house_id, p.created_at,
              uf.name AS from_name, ut.name AS to_name, h.data AS house_data
         FROM share_requests p
         JOIN users uf ON uf.id = p.from_user
         JOIN users ut ON ut.id = p.to_user
         JOIN houses h ON h.id = p.house_id AND h.deleted = 0
        WHERE p.status = 'pending' AND (p.to_user = ?1 OR p.from_user = ?1)
        ORDER BY p.created_at DESC`
    ).bind(userId).all()
  ).results;
  const incoming = [], outgoing = [];
  rows.forEach((p) => {
    const base = { id: p.id, houseId: p.house_id, houseName: nomeDaCasa(p.house_data), createdAt: p.created_at };
    if (p.to_user === userId) incoming.push({ ...base, fromId: p.from_user, fromName: p.from_name });
    else outgoing.push({ ...base, toId: p.to_user, toName: p.to_name });
  });
  return { incoming, outgoing };
}

// Resolve um token de convite numa linha VÁLIDA — ou em nada, sem dizer
// porquê: inexistente, usado, expirado, revogado, cargo apagado, dono apagado
// ou suspenso são todos o mesmo null. As casas devolvidas são só as que
// ainda existem e ainda são do dono.
// Recebe: env — o ambiente do worker; token — o token em claro (64 hex).
// Devolve: promessa de { hash, row, perms, houses: [{ id, name }] } ou de null.
async function convitePorToken(env, token) {
  if (!TOKEN_RE.test(token)) return null;
  const hash = await sha256hex(token);
  const row = await env.DB.prepare(
    `SELECT i.*, u.name AS owner_name, u.deleted_at, u.suspended_at,
            r.name AS role_name, r.perms AS role_perms, r.deleted AS role_deleted
       FROM collab_invites i
       JOIN users u ON u.id = i.owner_id
       LEFT JOIN roles r ON r.id = i.role_id
      WHERE i.token_hash = ?`
  ).bind(hash).first();
  if (!row || row.used_at || row.revoked_at || row.expires_at < Date.now()) return null;
  if (row.deleted_at || row.suspended_at || !row.role_name || row.role_deleted) return null;
  let ids = [];
  try { ids = JSON.parse(row.house_ids); } catch (e) {}
  if (!Array.isArray(ids)) ids = [];
  const nomes = await nomesDasCasas(env, row.owner_id, ids.map(String));
  const houses = ids.filter((h) => nomes.has(h)).map((h) => ({ id: h, name: nomes.get(h) }));
  if (!houses.length) return null;
  let perms = [];
  try { perms = JSON.parse(row.role_perms); } catch (e) {}
  return { hash, row, perms: normalizarPerms(perms), houses };
}

// Resolve um token da ligação de partilha no seu dono — ou em nada, sem dizer
// porquê (inexistente, revogada, dono apagado ou suspenso).
// Recebe: env — o ambiente do worker; token — o token em claro (64 hex).
// Devolve: promessa de { ownerId, ownerName } ou de null.
async function ligacaoPorToken(env, token) {
  if (!TOKEN_RE.test(token)) return null;
  const hash = await sha256hex(token);
  const row = await env.DB.prepare(
    `SELECT l.owner_id, u.name, u.deleted_at, u.suspended_at
       FROM share_links l JOIN users u ON u.id = l.owner_id
      WHERE l.token_hash = ? AND l.revoked_at IS NULL`
  ).bind(hash).first();
  if (!row || row.deleted_at || row.suspended_at) return null;
  return { ownerId: row.owner_id, ownerName: row.name };
}

// Lê e valida uma lista de ids de casas vinda do cliente.
// Recebe: v — o que veio no corpo (devia ser um array de ids); badId — o
// validador de identificadores do contexto.
// Devolve: array de ids únicos (strings), ou null quando não é uma lista
// válida e não vazia.
function idsDeCasas(v, badId) {
  if (!Array.isArray(v) || !v.length || v.length > 200) return null;
  const out = [];
  for (const x of v) {
    if (badId(x)) return null;
    if (!out.includes(String(x))) out.push(String(x));
  }
  return out;
}

/* As pré-visualizações, SEM sessão: o que uma ligação é, antes de a pessoa
   entrar ou criar conta. Nunca escrevem nada — abrir não é usar — e nunca
   revelam mais do que o nome do dono e o que o convite dá. Limitadas por
   IP, para ninguém varrer tokens.
   Recebe: c — o contexto do pedido (env, request, path, method, seg e os
   ajudantes json/err/rateLimit/clientIp; ainda sem me).
   Devolve: a Response nos GET /api/convite/:token e /api/ligar/:token; nada
   (undefined) noutros caminhos, para o encaminhador seguir. */
export async function rotasPreVisualizacao(c) {
  const { env, request, method, seg, json, err, rateLimit, clientIp } = c;
  if (method !== 'GET' || seg.length !== 3) return;

  if (seg[1] === 'convite') {
    if (!(await rateLimit(env, 'conv:' + clientIp(request), 30, 900))) {
      return err(429, 'Demasiadas tentativas. Espera uns minutos.');
    }
    const v = await convitePorToken(env, seg[2]);
    if (!v) return err(404, ERRO_CONVITE);
    return json({
      ownerName: v.row.owner_name,
      roleName: v.row.role_name,
      perms: v.perms,
      houses: v.houses.map((h) => ({ name: h.name })),
      expiresAt: v.row.expires_at,
    }, 200, { 'Referrer-Policy': 'no-referrer' });
  }

  if (seg[1] === 'ligar') {
    if (!(await rateLimit(env, 'lig:' + clientIp(request), 30, 900))) {
      return err(429, 'Demasiadas tentativas. Espera uns minutos.');
    }
    const l = await ligacaoPorToken(env, seg[2]);
    if (!l) return err(404, ERRO_LIGACAO);
    return json({ ownerName: l.ownerName }, 200, { 'Referrer-Policy': 'no-referrer' });
  }
}

/* As rotas com sessão: cargos, convites (criar, listar, revogar, aceitar),
   colaboradores (listar, mudar, remover/sair), a ligação de partilha (ver,
   criar/rodar, revogar) e os pedidos que chegam por ela (pedir, aceitar,
   recusar, cancelar). Cada uma verifica que quem age é quem pode — o dono
   dos cargos e das casas, o destinatário do pedido, o próprio colaborador.
   Recebe: c — o contexto partilhado montado pelo handleApi (env, request,
   url, path, method, seg, o utilizador em c.me e os ajudantes).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o encaminhador tentar a seguinte. */
export async function rotasColaboradores(c) {
  const { env, request, url, path, method, seg, me, json, err, body, now, rateLimit, badId } = c;
  const eu = quemSou(me);

  // ---- Cargos (só os meus) -----------------------------------------------

  if (path === '/api/roles' && method === 'GET') {
    return json({ roles: await listarCargos(env, me.id) });
  }

  if (seg[1] === 'roles' && seg.length === 3 && (method === 'PUT' || method === 'DELETE')) {
    const id = seg[2];
    if (badId(id)) return err(400, 'Identificador inválido.');
    const existe = await env.DB.prepare('SELECT owner_id, deleted FROM roles WHERE id = ?').bind(id).first();
    if (existe && existe.owner_id !== me.id) return err(404, 'Cargo não encontrado.');

    if (method === 'PUT') {
      const b = await body(request);
      const name = String((b && b.name) || '').trim();
      if (!name || name.length > MAX_NOME_CARGO) {
        return err(400, 'Dá um nome ao cargo (até ' + MAX_NOME_CARGO + ' caracteres).');
      }
      const perms = normalizarPerms(b && b.perms);
      if (!perms.length) return err(400, 'Escolhe pelo menos uma permissão.');
      await env.DB.prepare(
        `INSERT INTO roles (id, owner_id, name, perms, created_at, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, perms = excluded.perms,
           updated_at = excluded.updated_at, deleted = 0`
      ).bind(id, me.id, name, JSON.stringify(perms), now(), now()).run();
      await auditar(env, eu, 'colab.cargo', id, (existe && !existe.deleted ? 'alterado' : 'criado') + ' · ' + name + ' · ' + perms.join(' '));
      return json({ ok: true, role: { id, name, perms } }, existe && !existe.deleted ? 200 : 201);
    }

    if (!existe || existe.deleted) return err(404, 'Cargo não encontrado.');
    const emUso = await env.DB.prepare('SELECT COUNT(*) AS n FROM collaborators WHERE role_id = ?').bind(id).first();
    const n = (emUso && emUso.n) || 0;
    if (n > 0) {
      return err(409, 'Este cargo está atribuído a ' + n + (n === 1 ? ' pessoa' : ' pessoas') + ' — troca-lhes o cargo primeiro.');
    }
    await env.DB.batch([
      env.DB.prepare('UPDATE roles SET deleted = 1, updated_at = ? WHERE id = ?').bind(now(), id),
      // um convite por usar com este cargo já não dá nada: fica revogado
      env.DB.prepare('UPDATE collab_invites SET revoked_at = ? WHERE role_id = ? AND used_at IS NULL AND revoked_at IS NULL').bind(now(), id),
    ]);
    await auditar(env, eu, 'colab.cargo', id, 'apagado');
    return json({ ok: true });
  }

  // ---- Convites de uso único (só o dono das casas) -------------------------

  if (path === '/api/collab-invites' && method === 'GET') {
    return json({ invites: await listarConvites(env, me.id) });
  }

  if (path === '/api/collab-invites' && method === 'POST') {
    if (!(await rateLimit(env, 'invc:' + me.id, 10, 3600))) {
      return err(429, 'Demasiados convites seguidos. Espera uma hora.');
    }
    const b = await body(request);
    if (!b) return err(400, 'Corpo inválido.');
    const roleId = String(b.roleId || '');
    if (badId(roleId)) return err(400, 'Identificador inválido.');
    const role = await env.DB.prepare('SELECT name FROM roles WHERE id = ? AND owner_id = ? AND deleted = 0')
      .bind(roleId, me.id).first();
    if (!role) return err(404, 'Cargo não encontrado.');
    const houseIds = idsDeCasas(b.houseIds, badId);
    if (!houseIds) return err(400, 'Escolhe pelo menos um imóvel.');
    const nomes = await nomesDasCasas(env, me.id, houseIds);
    if (houseIds.some((h) => !nomes.has(h))) return err(403, 'Só podes convidar para imóveis teus.');
    const label = String(b.label || '').trim().slice(0, MAX_LABEL);
    const pendentes = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM collab_invites WHERE owner_id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at >= ?'
    ).bind(me.id, now()).first();
    if (((pendentes && pendentes.n) || 0) >= MAX_CONVITES_PENDENTES) {
      return err(429, 'Tens ' + MAX_CONVITES_PENDENTES + ' convites por usar — revoga algum antes de criar outro.');
    }
    const token = randomToken();
    const hash = await sha256hex(token);
    const t = now();
    const expiresAt = t + CONVITE_DIAS * 86400000;
    await env.DB.prepare(
      `INSERT INTO collab_invites (token_hash, owner_id, role_id, house_ids, label, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(hash, me.id, roleId, JSON.stringify(houseIds), label, t, expiresAt).run();
    await auditar(env, eu, 'colab.convite.criar', houseIds.join(','), role.name + ' · ' + hash.slice(0, 12));
    return json({
      id: hash.slice(0, 12),
      token,
      url: url.origin + '/?convite=' + token,
      expiresAt,
    }, 201, { 'Referrer-Policy': 'no-referrer' });
  }

  if (seg[1] === 'collab-invites' && seg.length === 3 && method === 'DELETE') {
    const id = seg[2];
    if (!/^[a-f0-9]{12}$/.test(id)) return err(400, 'Identificador inválido.');
    const r = await env.DB.prepare(
      `UPDATE collab_invites SET revoked_at = ?
        WHERE owner_id = ? AND substr(token_hash, 1, 12) = ? AND used_at IS NULL AND revoked_at IS NULL`
    ).bind(now(), me.id, id).run();
    if (!r.meta || r.meta.changes < 1) return err(404, 'Convite não encontrado.');
    await auditar(env, eu, 'colab.convite.revogar', null, id);
    return json({ ok: true });
  }

  if (seg[1] === 'convite' && seg.length === 4 && seg[3] === 'aceitar' && method === 'POST') {
    if (!(await rateLimit(env, 'invp:' + me.id, 10, 3600))) {
      return err(429, 'Demasiadas tentativas. Espera uma hora.');
    }
    const v = await convitePorToken(env, seg[2]);
    if (!v) return err(404, ERRO_CONVITE);
    if (v.row.owner_id === me.id) return err(400, 'A ligação é tua — envia-a a quem vai colaborar.');
    // onde já sou dono ou comproprietário, o cargo não se aplica
    const entram = [], saltadas = [];
    for (const h of v.houses) {
      if ((await canAccessHouse(env, me.id, h.id)).ok) saltadas.push(h); else entram.push(h);
    }
    // gastar a ligação: uma instrução só, para dois cliques ao mesmo tempo
    // não entrarem os dois
    const t = now();
    const gasto = await env.DB.prepare(
      `UPDATE collab_invites SET used_at = ?, used_by = ?
        WHERE token_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at >= ?`
    ).bind(t, me.id, v.hash, t).run();
    if (!gasto.meta || gasto.meta.changes !== 1) return err(404, ERRO_CONVITE);

    if (entram.length) {
      const owner = v.row.owner_id, roleId = v.row.role_id;
      let collab = await env.DB.prepare(
        'SELECT id FROM collaborators WHERE owner_id = ? AND user_id = ? AND role_id = ?'
      ).bind(owner, me.id, roleId).first();
      const stmts = [];
      if (!collab) {
        collab = { id: crypto.randomUUID() };
        stmts.push(env.DB.prepare(
          'INSERT INTO collaborators (id, owner_id, user_id, role_id, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(collab.id, owner, me.id, roleId, t));
      }
      for (const h of entram) {
        // um cargo por casa: o novo substitui o que lá estivesse
        stmts.push(env.DB.prepare(
          `DELETE FROM collaborator_houses WHERE house_id = ?
            AND collaborator_id IN (SELECT id FROM collaborators WHERE owner_id = ? AND user_id = ?)`
        ).bind(h.id, owner, me.id));
        stmts.push(env.DB.prepare(
          'INSERT OR IGNORE INTO collaborator_houses (collaborator_id, house_id) VALUES (?, ?)'
        ).bind(collab.id, h.id));
      }
      stmts.push(env.DB.prepare(
        `DELETE FROM collaborators WHERE owner_id = ? AND user_id = ?
          AND id NOT IN (SELECT collaborator_id FROM collaborator_houses)`
      ).bind(owner, me.id));
      await env.DB.batch(stmts);
    }
    await auditar(env, eu, 'colab.entrar', v.row.owner_id,
      v.row.role_name + ' · ' + entram.map((h) => h.id).join(',') + ' · ' + v.hash.slice(0, 12));
    return json({
      ownerId: v.row.owner_id,
      ownerName: v.row.owner_name,
      roleName: v.row.role_name,
      houses: entram,
      saltadas: saltadas.map((h) => ({ name: h.name })),
    }, 200, { 'Referrer-Policy': 'no-referrer' });
  }

  // ---- Colaboradores ------------------------------------------------------

  if (path === '/api/collaborators' && method === 'GET') {
    return json({ collaborators: await listarColaboradores(env, me.id) });
  }

  if (seg[1] === 'collaborators' && seg.length === 3 && (method === 'PUT' || method === 'DELETE')) {
    const id = seg[2];
    if (badId(id)) return err(400, 'Identificador inválido.');
    const row = await env.DB.prepare('SELECT * FROM collaborators WHERE id = ?').bind(id).first();
    if (!row || (row.owner_id !== me.id && row.user_id !== me.id)) return err(404, 'Colaborador não encontrado.');

    if (method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM collaborator_houses WHERE collaborator_id = ?').bind(id),
        env.DB.prepare('DELETE FROM collaborators WHERE id = ?').bind(id),
      ]);
      if (row.owner_id === me.id) await auditar(env, eu, 'colab.remover', row.user_id, id);
      else await auditar(env, eu, 'colab.sair', row.owner_id, id);
      return json({ ok: true });
    }

    if (row.owner_id !== me.id) return err(403, 'Só quem criou o imóvel gere colaboradores.');
    const b = await body(request);
    if (!b) return err(400, 'Corpo inválido.');
    const stmts = [];
    let atual = row.id;
    if (b.roleId !== undefined && String(b.roleId) !== row.role_id) {
      const roleId = String(b.roleId || '');
      if (badId(roleId)) return err(400, 'Identificador inválido.');
      const role = await env.DB.prepare('SELECT id FROM roles WHERE id = ? AND owner_id = ? AND deleted = 0')
        .bind(roleId, me.id).first();
      if (!role) return err(404, 'Cargo não encontrado.');
      // já há uma linha desta pessoa com o cargo novo? junta-se a ela
      const outra = await env.DB.prepare(
        'SELECT id FROM collaborators WHERE owner_id = ? AND user_id = ? AND role_id = ?'
      ).bind(me.id, row.user_id, roleId).first();
      if (outra) {
        stmts.push(env.DB.prepare(
          `INSERT OR IGNORE INTO collaborator_houses (collaborator_id, house_id)
           SELECT ?, house_id FROM collaborator_houses WHERE collaborator_id = ?`
        ).bind(outra.id, row.id));
        stmts.push(env.DB.prepare('DELETE FROM collaborator_houses WHERE collaborator_id = ?').bind(row.id));
        stmts.push(env.DB.prepare('DELETE FROM collaborators WHERE id = ?').bind(row.id));
        atual = outra.id;
      } else {
        stmts.push(env.DB.prepare('UPDATE collaborators SET role_id = ? WHERE id = ?').bind(roleId, row.id));
      }
    }
    if (b.houseIds !== undefined) {
      const houseIds = idsDeCasas(b.houseIds, badId);
      if (!houseIds) return err(400, 'Escolhe pelo menos um imóvel — ou remove o colaborador.');
      const nomes = await nomesDasCasas(env, me.id, houseIds);
      if (houseIds.some((h) => !nomes.has(h))) return err(403, 'Só podes dar acesso a imóveis teus.');
      stmts.push(env.DB.prepare('DELETE FROM collaborator_houses WHERE collaborator_id = ?').bind(atual));
      for (const h of houseIds) {
        stmts.push(env.DB.prepare(
          `DELETE FROM collaborator_houses WHERE house_id = ?
            AND collaborator_id IN (SELECT id FROM collaborators WHERE owner_id = ? AND user_id = ?)`
        ).bind(h, me.id, row.user_id));
        stmts.push(env.DB.prepare(
          'INSERT OR IGNORE INTO collaborator_houses (collaborator_id, house_id) VALUES (?, ?)'
        ).bind(atual, h));
      }
    }
    stmts.push(env.DB.prepare(
      `DELETE FROM collaborators WHERE owner_id = ? AND user_id = ?
        AND id NOT IN (SELECT collaborator_id FROM collaborator_houses)`
    ).bind(me.id, row.user_id));
    await env.DB.batch(stmts);
    await auditar(env, eu, 'colab.cargo', row.user_id,
      (b.roleId !== undefined ? 'cargo ' + b.roleId : '') + (b.houseIds !== undefined ? ' casas ' + b.houseIds.length : ''));
    return json({ ok: true, id: atual });
  }

  // ---- A ligação de partilha (permanente, do dono) --------------------------

  if (path === '/api/share-link' && method === 'GET') {
    return json(await estadoDaLigacao(env, me.id));
  }

  if (path === '/api/share-link' && method === 'POST') {
    if (!(await rateLimit(env, 'ligc:' + me.id, 5, 3600))) {
      return err(429, 'Demasiadas ligações seguidas. Espera uma hora.');
    }
    const havia = await env.DB.prepare('SELECT revoked_at FROM share_links WHERE owner_id = ?').bind(me.id).first();
    const token = randomToken();
    const hash = await sha256hex(token);
    await env.DB.prepare(
      `INSERT INTO share_links (owner_id, token_hash, created_at, revoked_at, uses) VALUES (?, ?, ?, NULL, 0)
       ON CONFLICT (owner_id) DO UPDATE SET token_hash = excluded.token_hash,
         created_at = excluded.created_at, revoked_at = NULL, uses = 0`
    ).bind(me.id, hash, now()).run();
    const rodou = havia && !havia.revoked_at;
    await auditar(env, eu, rodou ? 'partilha.link.rodar' : 'partilha.link.criar', me.id, hash.slice(0, 12));
    return json({ url: url.origin + '/?ligar=' + token }, rodou ? 200 : 201, { 'Referrer-Policy': 'no-referrer' });
  }

  if (path === '/api/share-link' && method === 'DELETE') {
    const r = await env.DB.prepare('UPDATE share_links SET revoked_at = ? WHERE owner_id = ? AND revoked_at IS NULL')
      .bind(now(), me.id).run();
    if (r.meta && r.meta.changes > 0) await auditar(env, eu, 'partilha.link.revogar', me.id, null);
    return json({ ok: true });
  }

  if (seg[1] === 'ligar' && seg.length === 4 && seg[3] === 'pedir' && method === 'POST') {
    if (!(await rateLimit(env, 'ligp:' + me.id, 10, 3600))) {
      return err(429, 'Demasiados pedidos seguidos. Espera uma hora.');
    }
    const l = await ligacaoPorToken(env, seg[2]);
    if (!l) return err(404, ERRO_LIGACAO);
    if (l.ownerId === me.id) return err(400, 'A ligação é tua.');
    const b = await body(request);
    const houseIds = b && idsDeCasas(b.houseIds, badId);
    if (!houseIds) return err(400, 'Escolhe pelo menos um imóvel.');
    const nomes = await nomesDasCasas(env, me.id, houseIds);
    if (houseIds.some((h) => !nomes.has(h))) return err(403, 'Só podes partilhar imóveis teus.');
    // onde o dono da ligação já é participante não há nada a pedir
    const pedir = [], saltadas = [];
    for (const h of houseIds) {
      const item = { id: h, name: nomes.get(h) };
      if ((await canAccessHouse(env, l.ownerId, h)).ok) saltadas.push(item); else pedir.push(item);
    }
    if (pedir.length) {
      // tectos estruturais, além do rate limit: não ser canal de spam
      const t = now();
      const doDono = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM share_requests WHERE to_user = ? AND status = 'pending'"
      ).bind(l.ownerId).first();
      if (((doDono && doDono.n) || 0) + pedir.length > MAX_PEDIDOS_POR_DONO) {
        return err(429, 'Esta pessoa já tem demasiados pedidos por responder. Tenta mais tarde.');
      }
      const meus = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM share_requests WHERE from_user = ? AND created_at >= ?'
      ).bind(me.id, t - 86400000).first();
      if (((meus && meus.n) || 0) + pedir.length > MAX_PEDIDOS_POR_DIA) {
        return err(429, 'Já enviaste ' + MAX_PEDIDOS_POR_DIA + ' pedidos de partilha hoje — tenta amanhã.');
      }
      const stmts = pedir.map((h) => env.DB.prepare(
        `INSERT INTO share_requests (id, from_user, to_user, house_id, status, created_at, decided_at)
         VALUES (?, ?, ?, ?, 'pending', ?, NULL)
         ON CONFLICT (from_user, to_user, house_id) DO UPDATE SET
           status = 'pending', created_at = excluded.created_at, decided_at = NULL
         WHERE share_requests.status = 'rejected'`
      ).bind(crypto.randomUUID(), me.id, l.ownerId, h.id, t));
      stmts.push(env.DB.prepare('UPDATE share_links SET uses = uses + 1 WHERE owner_id = ?').bind(l.ownerId));
      await env.DB.batch(stmts);
      await auditar(env, eu, 'partilha.pedido.criar', l.ownerId, pedir.map((h) => h.id).join(','));
    }
    return json({ pedidos: pedir.length, saltadas }, 200, { 'Referrer-Policy': 'no-referrer' });
  }

  if (seg[1] === 'share-requests' && seg.length >= 3) {
    const id = seg[2];
    if (badId(id)) return err(400, 'Identificador inválido.');
    const p = await env.DB.prepare('SELECT * FROM share_requests WHERE id = ?').bind(id).first();
    if (!p || (p.to_user !== me.id && p.from_user !== me.id)) return err(404, 'Pedido não encontrado.');
    if (p.status !== 'pending') return err(409, 'Este pedido já foi respondido.');

    if (seg.length === 3 && method === 'DELETE') {
      if (p.from_user !== me.id) return err(403, 'Só quem pediu pode cancelar.');
      await env.DB.prepare('DELETE FROM share_requests WHERE id = ?').bind(id).run();
      await auditar(env, eu, 'partilha.pedido.cancelar', p.to_user, p.house_id);
      return json({ ok: true });
    }

    if (seg.length === 4 && method === 'POST' && (seg[3] === 'accept' || seg[3] === 'reject')) {
      if (p.to_user !== me.id) return err(403, 'Só quem recebeu o pedido pode responder.');
      if (seg[3] === 'reject') {
        await env.DB.prepare("UPDATE share_requests SET status = 'rejected', decided_at = ? WHERE id = ?")
          .bind(now(), id).run();
        await auditar(env, eu, 'partilha.pedido.recusar', p.from_user, p.house_id);
        return json({ ok: true });
      }
      // aceitar: a casa tem de continuar a ser de quem pediu
      const house = await env.DB.prepare('SELECT owner_id FROM houses WHERE id = ? AND deleted = 0')
        .bind(p.house_id).first();
      if (!house || house.owner_id !== p.from_user) {
        await env.DB.prepare("UPDATE share_requests SET status = 'rejected', decided_at = ? WHERE id = ?")
          .bind(now(), id).run();
        return err(404, 'Esse imóvel já não existe.');
      }
      /* a semântica de «partilhar casa» de sempre: uma conexão aceite entre
         os dois e a casa dentro dela — o dono da ligação passa a
         comproprietário */
      let conn = await env.DB.prepare(
        `SELECT id, status FROM connections
          WHERE (requester_id = ?1 AND target_id = ?2) OR (requester_id = ?2 AND target_id = ?1)`
      ).bind(p.from_user, p.to_user).first();
      const stmts = [];
      if (!conn) {
        conn = { id: crypto.randomUUID() };
        stmts.push(env.DB.prepare(
          "INSERT INTO connections (id, requester_id, target_id, status, created_at) VALUES (?, ?, ?, 'accepted', ?)"
        ).bind(conn.id, p.from_user, p.to_user, now()));
      } else if (conn.status !== 'accepted') {
        stmts.push(env.DB.prepare("UPDATE connections SET status = 'accepted' WHERE id = ?").bind(conn.id));
      }
      stmts.push(env.DB.prepare(
        'INSERT OR IGNORE INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)'
      ).bind(conn.id, p.from_user, p.house_id));
      stmts.push(env.DB.prepare("UPDATE share_requests SET status = 'accepted', decided_at = ? WHERE id = ?")
        .bind(now(), id));
      await env.DB.batch(stmts);
      await auditar(env, eu, 'partilha.pedido.aceitar', p.from_user, p.house_id);
      return json({ ok: true, connectionId: conn.id, houseId: p.house_id });
    }
  }
}
