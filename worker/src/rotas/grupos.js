/* Grupos partilhados de imóveis.
   -------------------------------
   Um grupo partilhado é um conjunto de casas com membros: quem está no grupo
   é comproprietário (participante) de todas as casas do grupo — vê e edita
   contratos, movimentos e pessoas, entra nas quotas e nas propostas, como
   numa casa partilhada por ligação. Cada membro pode pôr no grupo casas SUAS
   (só as que criou); o dono do grupo tira qualquer casa, e o dono de uma casa
   tira a sua. Sair do grupo, ou ser removido pelo dono, leva as casas que
   essa pessoa pôs. O dono não sai do grupo: apaga-o, e com ele saem os
   membros, as casas, a ligação e os pedidos — as casas em si ficam de quem
   são. Um grupo de outrem chega ao cliente como um grupo de imóveis marcado
   _partilhado (web/cloud/grupos.js).

   O dono aceita cada entrada. Cria uma ligação de convite multi-uso com
   prazo de 7 dias, mas abri-la não mete ninguém no grupo: quem entra por ela
   fica com um PEDIDO pendente (shared_group_requests, migração 0018), e só
   passa a membro — a ver e a escrever nas casas — quando o dono o aceitar.
   Uma ligação partilhada no sítio errado deixa assim de dar acesso a quem a
   apanhar. Enquanto espera, quem pediu não é membro de nada: não vê o grupo
   em sharedGroups, não vê as casas, e a resposta de entrar dá-lhe os nomes
   delas mas nunca os ids. O dono vê os pendentes (sharedGroups[].pedidos e
   sharedGroupRequests.incoming), aceita ou recusa; quem pediu cancela o seu.
   Um recusado pode pedir outra vez pela ligação (o pedido reabre), e o dono
   pode rodar ou desativar a ligação e remover quem entrou.

   As rotas vivem aqui; a regra de acesso (um membro de um grupo vivo que
   contém a casa é comproprietário dela, e um membro que também tenha um cargo
   é comproprietário) vive em lib/acesso.js; o estado (as casas por grupo, os
   membros em participants, a lista sharedGroups e os pedidos em
   sharedGroupRequests) sai em rotas/estado.js pela listarGrupos e pela
   pedidosDeGrupo daqui. As tabelas são as das migrações 0017 e 0018.

   Regras de segurança que este ficheiro cumpre (as de colaboradores.js):
   - guarda-se só o SHA-256 do token da ligação; o token em claro vive no URL
     da criação e em mais lado nenhum (a auditoria leva o prefixo do hash);
   - GET mostra, POST age: a pré-visualização (rotasPreVisualizacaoGrupo)
     corre sem sessão e não escreve nada; entrar exige sessão e POST (o
     Origin do index.js recusa outros sítios);
   - respostas uniformes: uma ligação inexistente, expirada, revogada, de
     grupo apagado ou de dono apagado/suspenso dá o mesmo 404 com a mesma
     frase; um grupo que não existe, apagado, de outro (nas rotas do dono) ou
     em que não sou membro dá o mesmo 404 «Grupo não encontrado.» — aceitar
     e recusar um pedido também, a quem não é o dono;
   - o me.id vem sempre da sessão; os ids pela forma de badId; as listas de
     casas por idsDeCasas; as casas que um membro põe têm de ser dele e vivas;
   - tetos e rate limits por IP, por conta e por grupo (os pedidos pendentes);
     auditoria em cada escrita;
   - com o serviço Colaboradores desligado nesta conta (lib/servicos.js),
     tudo o que não é GET aqui é 403 com a frase do serviço, à entrada — mas o
     acesso às casas por grupo mantém-se, como nas partilhas por ligação. */

import { randomToken, sha256hex } from '../auth.js';
import { auditar } from '../lib/auditoria.js';
import { recordReport } from '../lib/relatos.js';
import { json, err, body, now, badId, clientIp, idsDeCasas } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { servicosDesligados, colabDesligado, FRASE_DESLIGADO } from '../lib/servicos.js';

// Os primeiros segmentos dos caminhos deste ficheiro (o resto passa adiante
// sem se ler nada).
const CAMINHOS_GRUPOS = ['shared-groups', 'grupo'];

const LIGACAO_DIAS = 7;
const MAX_NOME = 60;
const TOKEN_RE = /^[a-f0-9]{64}$/;
const ERRO_LIGACAO = 'Esta ligação não serve.';
const ERRO_GRUPO = 'Grupo não encontrado.';
const ERRO_ID = 'Identificador inválido.';
const ERRO_PEDIDO = 'Pedido não encontrado.';
// quantos pedidos por responder um grupo aguenta: a ligação não é um canal
// para encher de pedidos a caixa do dono
const MAX_PEDIDOS_POR_GRUPO = 20;

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

// Quais destas casas existem, vivas, e são deste dono.
// Recebe: env — o ambiente do worker; ownerId — o dono; ids — os ids das casas.
// Devolve: promessa de um Set com os ids que passam.
async function casasVivasDe(env, ownerId, ids) {
  const out = new Set();
  if (!ids.length) return out;
  const rows = await emBlocos(env, ids,
    'SELECT id FROM houses WHERE owner_id = ? AND deleted = 0 AND id IN ({IN})', [ownerId]);
  rows.forEach((h) => out.add(h.id));
  return out;
}

// A linha de membro de um utilizador num grupo, ou nada.
// Recebe: env — o ambiente do worker; groupId — o grupo; userId — o utilizador.
// Devolve: promessa da linha (verdadeira) ou de null.
function souMembro(env, groupId, userId) {
  return env.DB.prepare('SELECT 1 AS um FROM shared_group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, userId).first();
}

// As casas vivas de um grupo, pela ordem em que entraram.
// Recebe: env — o ambiente do worker; groupId — o grupo.
// Devolve: promessa do array [{ id, name, ownerId }].
async function casasDoGrupo(env, groupId) {
  const rows = (
    await env.DB.prepare(
      `SELECT gh.house_id, h.owner_id, h.data FROM shared_group_houses gh
         JOIN houses h ON h.id = gh.house_id
        WHERE gh.group_id = ? AND h.deleted = 0
        ORDER BY gh.added_at, gh.house_id`
    ).bind(groupId).all()
  ).results;
  return rows.map((r) => ({ id: r.house_id, name: nomeDaCasa(r.data), ownerId: r.owner_id }));
}

// Quantos membros tem um grupo (o dono conta).
// Recebe: env — o ambiente do worker; groupId — o grupo.
// Devolve: promessa do número.
async function contarMembros(env, groupId) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM shared_group_members WHERE group_id = ?')
    .bind(groupId).first();
  return (r && r.n) || 0;
}

// Resolve um token de ligação de grupo num grupo VÁLIDO — ou em nada, sem
// dizer porquê: inexistente, expirado, revogado, grupo apagado, dono apagado
// ou suspenso são todos o mesmo null.
// Recebe: env — o ambiente do worker; token — o token em claro (64 hex).
// Devolve: promessa de { id, name, ownerId, ownerName, hash } ou de null.
async function grupoPorToken(env, token) {
  if (!TOKEN_RE.test(token)) return null;
  const hash = await sha256hex(token);
  const row = await env.DB.prepare(
    `SELECT g.id, g.name, g.owner_id, g.deleted, u.name AS owner_name, u.deleted_at, u.suspended_at,
            l.expires_at, l.revoked_at
       FROM shared_group_links l
       JOIN shared_groups g ON g.id = l.group_id
       JOIN users u ON u.id = g.owner_id
      WHERE l.token_hash = ?`
  ).bind(hash).first();
  if (!row || row.revoked_at || row.expires_at < now() || row.deleted) return null;
  if (row.deleted_at || row.suspended_at) return null;
  return { id: row.id, name: row.name, ownerId: row.owner_id, ownerName: row.owner_name, hash };
}

// Os grupos partilhados vivos de que um utilizador é membro — os seus e os
// dos outros —, cada um com os membros, as casas vivas e, nos seus, o estado
// da ligação (nunca o URL: só sai na criação) e os pedidos para entrar por
// responder. É o que o /api/state manda em sharedGroups. Cinco consultas no
// máximo, em blocos, sejam quantos forem os grupos.
// Recebe: env — o ambiente do worker; userId — o utilizador, vindo da sessão.
// Devolve: promessa do array [{ id, name, ownerId, ownerName, mine,
// members: [{ id, name }], houses: [{ id, name, ownerId }], link, pedidos }]
// — link é { ativo, expiresAt, uses } nos meus (ativo: false e expiresAt:
// null sem ligação) e null nos dos outros; pedidos é [{ userId, name,
// createdAt }] dos pendentes, pela ordem em que chegaram, nos meus, e [] nos
// dos outros (só o dono decide quem entra).
export async function listarGrupos(env, userId) {
  const grupos = (
    await env.DB.prepare(
      `SELECT g.id, g.name, g.owner_id, u.name AS owner_name
         FROM shared_groups g
         JOIN shared_group_members m ON m.group_id = g.id
         JOIN users u ON u.id = g.owner_id
        WHERE g.deleted = 0 AND m.user_id = ?
        ORDER BY g.created_at, g.id`
    ).bind(userId).all()
  ).results;
  if (!grupos.length) return [];
  const ids = grupos.map((g) => g.id);
  const membros = await emBlocos(env, ids,
    `SELECT m.group_id, m.user_id, u.name FROM shared_group_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.group_id IN ({IN}) ORDER BY m.joined_at, m.user_id`);
  const casas = await emBlocos(env, ids,
    `SELECT gh.group_id, gh.house_id, h.owner_id, h.data FROM shared_group_houses gh
       JOIN houses h ON h.id = gh.house_id
      WHERE h.deleted = 0 AND gh.group_id IN ({IN}) ORDER BY gh.added_at, gh.house_id`);
  const meus = grupos.filter((g) => g.owner_id === userId).map((g) => g.id);
  const ligacoes = meus.length
    ? await emBlocos(env, meus, 'SELECT group_id, expires_at, revoked_at, uses FROM shared_group_links WHERE group_id IN ({IN})')
    : [];
  const pedidos = meus.length
    ? await emBlocos(env, meus,
      `SELECT r.group_id, r.user_id, r.created_at, u.name FROM shared_group_requests r
         JOIN users u ON u.id = r.user_id
        WHERE r.status = 'pending' AND r.group_id IN ({IN}) ORDER BY r.created_at, r.user_id`)
    : [];
  const t = now();
  return grupos.map((g) => {
    const mine = g.owner_id === userId;
    let link = null;
    if (mine) {
      const l = ligacoes.find((x) => x.group_id === g.id);
      link = l
        ? { ativo: !l.revoked_at && l.expires_at >= t, expiresAt: l.expires_at, uses: l.uses || 0 }
        : { ativo: false, expiresAt: null, uses: 0 };
    }
    return {
      id: g.id,
      name: g.name,
      ownerId: g.owner_id,
      ownerName: g.owner_name,
      mine,
      members: membros.filter((m) => m.group_id === g.id).map((m) => ({ id: m.user_id, name: m.name })),
      houses: casas.filter((h) => h.group_id === g.id).map((h) => ({ id: h.house_id, name: nomeDaCasa(h.data), ownerId: h.owner_id })),
      link,
      pedidos: mine
        ? pedidos.filter((p) => p.group_id === g.id).map((p) => ({ userId: p.user_id, name: p.name, createdAt: p.created_at }))
        : [],
    };
  });
}

// Os pedidos para entrar num grupo, por responder, em que este utilizador
// participa: os que chegaram aos grupos de que é dono (para aceitar ou
// recusar) e os que ele fez (para cancelar). Só grupos vivos. É o que o
// /api/state manda em sharedGroupRequests. Uma consulta, com cada metade
// pelo seu índice (os grupos pelo dono, os pedidos por quem pediu).
// Recebe: env — o ambiente do worker; userId — o utilizador, vindo da sessão.
// Devolve: promessa de { incoming: [{ groupId, groupName, userId, name,
// createdAt }], outgoing: [{ groupId, groupName, ownerName, createdAt }] },
// cada lista pela ordem em que os pedidos chegaram.
export async function pedidosDeGrupo(env, userId) {
  // a coluna nome é a de quem pediu nos que chegaram, e a do dono do grupo
  // nos que fiz — é o nome que cada lado precisa de ver (os AS explícitos
  // são o que o ORDER BY de uma UNION aceita)
  const rows = (
    await env.DB.prepare(
      `SELECT 1 AS chegou, r.group_id AS group_id, g.name AS group_name, r.user_id AS user_id,
              u.name AS nome, r.created_at AS created_at
         FROM shared_groups g
         JOIN shared_group_requests r ON r.group_id = g.id AND r.status = 'pending'
         JOIN users u ON u.id = r.user_id
        WHERE g.owner_id = ?1 AND g.deleted = 0
       UNION ALL
       SELECT 0 AS chegou, r.group_id AS group_id, g.name AS group_name, r.user_id AS user_id,
              u.name AS nome, r.created_at AS created_at
         FROM shared_group_requests r
         JOIN shared_groups g ON g.id = r.group_id AND g.deleted = 0
         JOIN users u ON u.id = g.owner_id
        WHERE r.user_id = ?1 AND r.status = 'pending' AND g.owner_id <> ?1
       ORDER BY created_at, group_id, user_id`
    ).bind(userId).all()
  ).results;
  const incoming = [], outgoing = [];
  rows.forEach((r) => {
    if (r.chegou) {
      incoming.push({ groupId: r.group_id, groupName: r.group_name, userId: r.user_id, name: r.nome, createdAt: r.created_at });
    } else {
      outgoing.push({ groupId: r.group_id, groupName: r.group_name, ownerName: r.nome, createdAt: r.created_at });
    }
  });
  return { incoming, outgoing };
}

/* A pré-visualização de uma ligação de grupo, SEM sessão: o que ela é antes
   de a pessoa entrar ou criar conta — o nome do grupo, o dono, os nomes das
   casas e quantos membros tem. Nunca escreve nada (abrir não é entrar) e não
   revela mais do que isso. Limitada por IP, para ninguém varrer tokens. Uma
   exceção lá dentro (a D1 a falhar a meio) não sobe ao index.js — o relato
   dele levaria o caminho, e o caminho é o token: fica o mesmo 404 uniforme e
   um relato com o caminho mascarado.
   Recebe: c — o contexto do pedido (env, request, ctx, method e seg; ainda
   sem me).
   Devolve: a Response no GET /api/grupo/:token; nada (undefined) noutros
   caminhos, para o encaminhador seguir. */
export async function rotasPreVisualizacaoGrupo(c) {
  const { env, request, ctx, method, seg } = c;
  if (method !== 'GET' || seg.length !== 3 || seg[1] !== 'grupo') return;

  try {
    if (!(await rateLimit(env, 'grp:' + clientIp(request), 30, 900))) {
      return err(429, 'Demasiadas tentativas. Espera uns minutos.');
    }
    const g = await grupoPorToken(env, seg[2]);
    if (!g) return err(404, ERRO_LIGACAO);
    const houses = await casasDoGrupo(env, g.id);
    const members = await contarMembros(env, g.id);
    return json({
      name: g.name,
      ownerName: g.ownerName,
      houses: houses.map((h) => ({ name: h.name })),
      members,
    }, 200, { 'Referrer-Policy': 'no-referrer' });
  } catch (e) {
    console.error('pré-visualização do grupo', e && e.message);
    const relato = recordReport(env, ctx, 'server', e && e.message,
      'GET /api/grupo/…\n' + String((e && e.stack) || '').slice(0, 800));
    if (ctx && ctx.waitUntil) ctx.waitUntil(relato);
    return err(404, ERRO_LIGACAO);
  }
}

/* As rotas com sessão dos grupos partilhados: criar e renomear (PUT), apagar
   (DELETE), a ligação de convite (criar/rodar e revogar), pedir para entrar
   por ela, os pedidos (o dono aceita ou recusa, quem pediu cancela), as
   casas que cada membro põe (PUT substitui o SEU conjunto), tirar uma casa,
   e sair ou remover um membro. Cada uma verifica que quem age é quem pode: o
   dono do grupo, o dono da casa, o próprio membro, quem pediu. Com os
   Colaboradores desligados nesta conta, tudo o que não é GET leva 403 com a
   frase do serviço antes de chegar a qualquer rota.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   url, path, method, seg e o utilizador em c.me).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o encaminhador tentar a seguinte. */
export async function rotasGrupos(c) {
  const { env, request, url, method, seg, me } = c;

  // só os caminhos deste ficheiro; os serviços desligados desta conta
  // leem-se UMA vez por pedido — e só quando há uma escrita a guardar
  if (!CAMINHOS_GRUPOS.includes(seg[1])) return;
  if (method !== 'GET' && colabDesligado(await servicosDesligados(env, me.id))) {
    return err(403, FRASE_DESLIGADO('colaboradores'));
  }
  const eu = quemSou(me);

  // ---- Pedir para entrar por uma ligação (POST /api/grupo/:token/entrar) ----

  if (seg[1] === 'grupo') {
    if (seg.length !== 4 || seg[3] !== 'entrar' || method !== 'POST') return;
    if (!(await rateLimit(env, 'grpe:' + me.id, 10, 3600))) {
      return err(429, 'Demasiadas tentativas. Espera uma hora.');
    }
    const g = await grupoPorToken(env, seg[2]);
    if (!g) return err(404, ERRO_LIGACAO);
    if (g.ownerId === me.id) return err(400, 'O grupo é teu.');
    // o que a pessoa vê do grupo, seja qual for o desfecho: os nomes das
    // casas, nunca os ids — quem ainda não é membro não tem nada a fazer com eles
    const houses = (await casasDoGrupo(env, g.id)).map((h) => ({ name: h.name }));
    // A resposta de entrar, com o que se junta ao grupo.
    // Recebe: extra — { jaEstava, pedido, jaPedido? }; status — o código HTTP.
    // Devolve: a Response JSON, sem Referer para o sítio seguinte.
    const resposta = (extra, status) => json(Object.assign({ id: g.id, name: g.name, ownerName: g.ownerName, houses }, extra),
      status, { 'Referrer-Policy': 'no-referrer' });
    if (await souMembro(env, g.id, me.id)) return resposta({ jaEstava: true, pedido: false }, 200);
    const havia = await env.DB.prepare('SELECT status FROM shared_group_requests WHERE group_id = ? AND user_id = ?')
      .bind(g.id, me.id).first();
    // já à espera: o mesmo pedido, sem gastar outro uso da ligação
    if (havia && havia.status === 'pending') return resposta({ jaEstava: false, pedido: true, jaPedido: true }, 200);
    // o tecto conta-se antes de escrever, para a recusa não deixar rasto
    const pendentes = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM shared_group_requests WHERE group_id = ? AND status = 'pending'"
    ).bind(g.id).first();
    if (((pendentes && pendentes.n) || 0) >= MAX_PEDIDOS_POR_GRUPO) {
      return err(429, 'Este grupo já tem demasiados pedidos por responder. Tenta mais tarde.');
    }
    /* um pedido novo, ou o antigo reaberto (recusado, ou aceite de quem
       entretanto saiu ou foi removido): só um pendente fica como está — e se
       um pedido da mesma pessoa, ao mesmo tempo, chegou aqui primeiro, este
       não conta outro uso nem deixa outro rasto */
    const r = await env.DB.prepare(
      `INSERT INTO shared_group_requests (group_id, user_id, status, created_at, decided_at)
       VALUES (?, ?, 'pending', ?, NULL)
       ON CONFLICT (group_id, user_id) DO UPDATE SET
         status = 'pending', created_at = excluded.created_at, decided_at = NULL
       WHERE shared_group_requests.status <> 'pending'`
    ).bind(g.id, me.id, now()).run();
    if (!(r.meta && r.meta.changes > 0)) return resposta({ jaEstava: false, pedido: true, jaPedido: true }, 200);
    await env.DB.prepare('UPDATE shared_group_links SET uses = uses + 1 WHERE group_id = ?').bind(g.id).run();
    await auditar(env, eu, 'grupo.pedido.criar', g.id, g.ownerId + ' · ' + g.hash.slice(0, 12) + (havia ? ' · reaberto' : ''));
    return resposta({ jaEstava: false, pedido: true }, 201);
  }

  // ---- /api/shared-groups/:id… ------------------------------------------

  if (seg.length < 3 || seg.length > 6) return;
  const id = seg[2];
  if (badId(id)) return err(400, ERRO_ID);
  const g = await env.DB.prepare('SELECT id, owner_id, name, deleted FROM shared_groups WHERE id = ?').bind(id).first();

  // criar (o id vem do cliente, um uuid como o das casas) ou renomear — só o dono
  if (seg.length === 3 && method === 'PUT') {
    if (!(await rateLimit(env, 'grpc:' + me.id, 20, 3600))) {
      return err(429, 'Demasiados grupos seguidos. Espera uma hora.');
    }
    const b = await body(request);
    const name = String((b && b.name) || '').trim();
    if (!name || name.length > MAX_NOME) {
      return err(400, 'Dá um nome ao grupo (até ' + MAX_NOME + ' caracteres).');
    }
    if (g && (g.deleted || g.owner_id !== me.id)) return err(404, ERRO_GRUPO);
    const t = now();
    if (!g) {
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO shared_groups (id, owner_id, name, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0)'
        ).bind(id, me.id, name, t, t),
        // o dono tem linha de membro como os outros
        env.DB.prepare('INSERT OR IGNORE INTO shared_group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)')
          .bind(id, me.id, t),
      ]);
      await auditar(env, eu, 'grupo.criar', id, name);
      return json({ ok: true, id, name }, 201);
    }
    await env.DB.prepare('UPDATE shared_groups SET name = ?, updated_at = ? WHERE id = ?').bind(name, t, id).run();
    await auditar(env, eu, 'grupo.renomear', id, name);
    return json({ ok: true, id, name });
  }

  // apagar — só o dono: saem os membros, as casas, a ligação e os pedidos;
  // as casas em si ficam
  if (seg.length === 3 && method === 'DELETE') {
    if (!g || g.deleted || g.owner_id !== me.id) return err(404, ERRO_GRUPO);
    await env.DB.batch([
      env.DB.prepare('UPDATE shared_groups SET deleted = 1, updated_at = ? WHERE id = ?').bind(now(), id),
      env.DB.prepare('DELETE FROM shared_group_members WHERE group_id = ?').bind(id),
      env.DB.prepare('DELETE FROM shared_group_houses WHERE group_id = ?').bind(id),
      env.DB.prepare('DELETE FROM shared_group_links WHERE group_id = ?').bind(id),
      env.DB.prepare('DELETE FROM shared_group_requests WHERE group_id = ?').bind(id),
    ]);
    await auditar(env, eu, 'grupo.apagar', id, g.name);
    return json({ ok: true });
  }

  // ---- Cancelar o MEU pedido para entrar (DELETE …/requests/:uid) ---------
  // antes da guarda de membro: quem pede ainda não é membro. Só o próprio
  // cancela; o dono recusa pela rota dele. Um grupo que não existe ou um
  // pedido que já não está pendente dão o mesmo 404.

  if (seg.length === 5 && seg[3] === 'requests' && method === 'DELETE') {
    const uid = seg[4];
    if (badId(uid)) return err(400, ERRO_ID);
    if (uid !== me.id) return err(403, 'Só quem pediu pode cancelar o pedido.');
    const r = await env.DB.prepare(
      "DELETE FROM shared_group_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'"
    ).bind(id, me.id).run();
    if (!(r.meta && r.meta.changes > 0)) return err(404, ERRO_PEDIDO);
    await auditar(env, eu, 'grupo.pedido.cancelar', id, g ? g.owner_id : null);
    return json({ ok: true });
  }

  // daqui para baixo o grupo tem de estar vivo e eu tenho de ser membro — um
  // não-membro (quem só pediu para entrar incluído) leva o mesmo 404 de um
  // grupo que não existe
  if (!g || g.deleted || !(await souMembro(env, id, me.id))) return err(404, ERRO_GRUPO);
  const dono = g.owner_id === me.id;

  // ---- Os pedidos para entrar: o dono aceita ou recusa ----------------------
  // POST …/requests/:uid/accept | reject. Só o dono decide — a um membro, o
  // mesmo 404 de um grupo que não existe. Cada escrita só pega se o pedido
  // ainda estiver pendente (um cancelamento ao mesmo tempo ganha): aceitar
  // mete o membro e marca o pedido no mesmo lote, tudo ou nada.

  if (seg.length === 6 && seg[3] === 'requests' && method === 'POST' && (seg[5] === 'accept' || seg[5] === 'reject')) {
    if (!dono) return err(404, ERRO_GRUPO);
    const uid = seg[4];
    if (badId(uid)) return err(400, ERRO_ID);
    const t = now();
    // A decisão do dono sobre o pedido, só se ainda estiver pendente.
    // Recebe: status — 'accepted' ou 'rejected'.
    // Devolve: a instrução preparada (corre-se sozinha ou num lote).
    const marcar = (status) => env.DB.prepare(
      "UPDATE shared_group_requests SET status = ?, decided_at = ? WHERE group_id = ? AND user_id = ? AND status = 'pending'"
    ).bind(status, t, id, uid);
    if (seg[5] === 'reject') {
      const r = await marcar('rejected').run();
      if (!(r.meta && r.meta.changes > 0)) return err(404, ERRO_PEDIDO);
      await auditar(env, eu, 'grupo.pedido.recusar', uid, id);
      return json({ ok: true });
    }
    const [, marcado] = await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO shared_group_members (group_id, user_id, joined_at)
         SELECT ?1, ?2, ?3 WHERE EXISTS (
           SELECT 1 FROM shared_group_requests WHERE group_id = ?1 AND user_id = ?2 AND status = 'pending')`
      ).bind(id, uid, t),
      marcar('accepted'),
    ]);
    if (!(marcado && marcado.meta && marcado.meta.changes > 0)) return err(404, ERRO_PEDIDO);
    await auditar(env, eu, 'grupo.pedido.aceitar', uid, id);
    return json({ ok: true });
  }

  // ---- A ligação de convite (só o dono) ------------------------------------

  if (seg.length === 4 && seg[3] === 'link' && method === 'POST') {
    if (!dono) return err(404, ERRO_GRUPO);
    if (!(await rateLimit(env, 'grpl:' + me.id, 10, 3600))) {
      return err(429, 'Demasiadas ligações seguidas. Espera uma hora.');
    }
    const t = now();
    const havia = await env.DB.prepare('SELECT expires_at, revoked_at FROM shared_group_links WHERE group_id = ?')
      .bind(id).first();
    const token = randomToken();
    const hash = await sha256hex(token);
    const expiresAt = t + LIGACAO_DIAS * 86400000;
    // criar ou rodar: um token novo, a contagem de usos do zero, o prazo de novo
    await env.DB.prepare(
      `INSERT INTO shared_group_links (group_id, token_hash, created_at, expires_at, revoked_at, uses)
       VALUES (?, ?, ?, ?, NULL, 0)
       ON CONFLICT (group_id) DO UPDATE SET token_hash = excluded.token_hash,
         created_at = excluded.created_at, expires_at = excluded.expires_at, revoked_at = NULL, uses = 0`
    ).bind(id, hash, t, expiresAt).run();
    const rodou = !!(havia && !havia.revoked_at && havia.expires_at >= t);
    await auditar(env, eu, rodou ? 'grupo.ligacao.rodar' : 'grupo.ligacao.criar', id, hash.slice(0, 12));
    return json({ url: url.origin + '/?grupo=' + token, expiresAt }, rodou ? 200 : 201, { 'Referrer-Policy': 'no-referrer' });
  }

  if (seg.length === 4 && seg[3] === 'link' && method === 'DELETE') {
    if (!dono) return err(404, ERRO_GRUPO);
    const r = await env.DB.prepare('UPDATE shared_group_links SET revoked_at = ? WHERE group_id = ? AND revoked_at IS NULL')
      .bind(now(), id).run();
    if (r.meta && r.meta.changes > 0) await auditar(env, eu, 'grupo.ligacao.revogar', id, null);
    return json({ ok: true });
  }

  // ---- As casas do grupo ---------------------------------------------------

  // o MEU conjunto de casas no grupo, substituído: só casas minhas e vivas
  if (seg.length === 4 && seg[3] === 'houses' && method === 'PUT') {
    const b = await body(request);
    // a mesma porta das outras listas de casas — e aqui a lista vazia vale:
    // tirar do grupo tudo o que era meu
    const houseIds = idsDeCasas(b && b.houseIds, true);
    if (!houseIds) return err(400, 'Corpo inválido — envia { houseIds: [...] }, com até 200 imóveis.');
    const minhas = await casasVivasDe(env, me.id, houseIds);
    if (houseIds.some((h) => !minhas.has(h))) return err(403, 'Só podes adicionar ao grupo imóveis teus.');
    // as que já lá estavam guardam a data em que entraram (é a ordem da lista)
    const antes = new Map((
      await env.DB.prepare('SELECT house_id, added_at FROM shared_group_houses WHERE group_id = ? AND added_by = ?')
        .bind(id, me.id).all()
    ).results.map((r) => [r.house_id, r.added_at]));
    const t = now();
    const stmts = [env.DB.prepare('DELETE FROM shared_group_houses WHERE group_id = ? AND added_by = ?').bind(id, me.id)];
    for (const h of houseIds) {
      stmts.push(env.DB.prepare(
        'INSERT OR REPLACE INTO shared_group_houses (group_id, house_id, added_by, added_at) VALUES (?, ?, ?, ?)'
      ).bind(id, h, me.id, antes.get(h) || t));
    }
    await env.DB.batch(stmts);
    await auditar(env, eu, 'grupo.imoveis', id, houseIds.join(','));
    return json({ ok: true });
  }

  // tirar uma casa — o dono do grupo, ou o dono da casa
  if (seg.length === 5 && seg[3] === 'houses' && method === 'DELETE') {
    const hid = seg[4];
    if (badId(hid)) return err(400, ERRO_ID);
    const row = await env.DB.prepare(
      `SELECT gh.added_by, h.owner_id FROM shared_group_houses gh
         LEFT JOIN houses h ON h.id = gh.house_id
        WHERE gh.group_id = ? AND gh.house_id = ?`
    ).bind(id, hid).first();
    if (!row) return err(404, 'Esse imóvel não está no grupo.');
    // o dono da casa é o da linha da casa; sem linha (uma casa que já se foi
    // de todo), quem a pôs
    const donoDaCasa = (row.owner_id || row.added_by) === me.id;
    if (!dono && !donoDaCasa) return err(403, 'Só o dono do grupo ou o dono do imóvel o podem remover.');
    await env.DB.prepare('DELETE FROM shared_group_houses WHERE group_id = ? AND house_id = ?').bind(id, hid).run();
    await auditar(env, eu, 'grupo.remover-imovel', id, hid);
    return json({ ok: true });
  }

  // ---- Os membros: sair, ou o dono remover ---------------------------------

  if (seg.length === 5 && seg[3] === 'members' && method === 'DELETE') {
    const uid = seg[4];
    if (badId(uid)) return err(400, ERRO_ID);
    const sair = uid === me.id;
    if (sair && dono) return err(400, 'O dono não sai do grupo — apaga-o.');
    if (!sair && !dono) return err(403, 'Só o dono do grupo remove membros.');
    if (!sair && !(await souMembro(env, id, uid))) return err(404, 'Essa pessoa não está no grupo.');
    // sair ou ser removido leva as casas que essa pessoa pôs
    await env.DB.batch([
      env.DB.prepare('DELETE FROM shared_group_members WHERE group_id = ? AND user_id = ?').bind(id, uid),
      env.DB.prepare('DELETE FROM shared_group_houses WHERE group_id = ? AND added_by = ?').bind(id, uid),
    ]);
    if (sair) await auditar(env, eu, 'grupo.sair', id, g.owner_id);
    else await auditar(env, eu, 'grupo.remover', uid, id);
    return json({ ok: true });
  }
}
