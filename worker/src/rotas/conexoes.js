// Ligações entre utilizadores e escolha das casas partilhadas.
import { json, err, body, now, idsDeCasas } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { connectionForUser } from '../lib/acesso.js';
import { servicosDesligados, colabDesligado, FRASE_DESLIGADO } from '../lib/servicos.js';

/* Rotas das conexões: convidar outro utilizador pelo id curto, aceitar o
   convite, cortar a ligação (leva as partilhas com ela) e escolher que casas
   minhas ficam partilhadas nessa conexão. Todas escrevem: com os
   Colaboradores desligados nesta conta (lib/servicos.js — o que inclui os
   Imóveis desligados, por fecho) levam 403 com a frase do serviço, à
   entrada. Devolve a Response da rota que casar com o pedido, ou nada.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   path, method, seg e o utilizador em c.me).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o encaminhador tentar a seguinte. */
export async function rotasConexoes(c) {
  const { env, request, path, method, seg, me } = c;

  // só os caminhos deste ficheiro; os serviços desligados desta conta
  // leem-se UMA vez por pedido e valem para todas as rotas abaixo
  if (seg[1] !== 'connections') return;
  if (colabDesligado(await servicosDesligados(env, me.id))) return err(403, FRASE_DESLIGADO('colaboradores'));

  // ---- Conexões e partilha ------------------------------------------------

  if (path === '/api/connections' && method === 'POST') {
    // o id curto é enumerável: sem travão, uma conta varria ids e colhia nomes
    if (!(await rateLimit(env, 'conn:' + me.id, 10, 3600))) {
      return err(429, 'Demasiados convites seguidos. Espera uma hora e tenta de novo.');
    }
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
    // a mesma porta das outras listas de casas (até 200, ids válidos, sem
    // repetidos) — e aqui a lista vazia vale: deixar de partilhar tudo
    const houseIds = idsDeCasas(b && b.houseIds, true);
    if (!houseIds) return err(400, 'Corpo inválido — envia { houseIds: [...] }, com até 200 imóveis.');
    // só posso partilhar casas minhas: uma consulta por cada 50, não uma por casa
    const minhas = new Set();
    for (let i = 0; i < houseIds.length; i += 50) {
      const parte = houseIds.slice(i, i + 50);
      const rows = (await env.DB.prepare(
        `SELECT id FROM houses WHERE owner_id = ? AND deleted = 0 AND id IN (${parte.map(() => '?').join(',')})`
      ).bind(me.id, ...parte).all()).results;
      rows.forEach((r) => minhas.add(r.id));
    }
    const alheia = houseIds.find((h) => !minhas.has(h));
    if (alheia) return err(403, `A casa ${alheia} não é tua.`);
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
}
