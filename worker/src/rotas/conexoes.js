// Ligações entre utilizadores e escolha das casas partilhadas.
import { json, err, body, now, idsDeCasas } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { connectionForUser, limparSaida, participantsOf } from '../lib/acesso.js';
import { servicosDesligados, colabDesligado, FRASE_DESLIGADO } from '../lib/servicos.js';

/* Os pedidos pendentes para passar o controlo de uma destas casas a uma
   destas pessoas que deixaram de valer porque quem recebe já não é
   comproprietário (cortar uma ligação leva as partilhas dela): ficam
   cancelados, sem aviso. Os que ainda valem — quem recebe chega à casa por
   outra ligação ou por um grupo — ficam.
   Recebe: env — o ambiente do worker; casas — os ids das casas que tinham
   partilha na ligação; pessoas — as duas pontas dela.
   Devolve: promessa de nada — o efeito são as linhas canceladas. */
async function pedidosSemComproprietario(env, casas, pessoas) {
  for (let i = 0; i < casas.length; i += 50) {
    const parte = casas.slice(i, i + 50);
    const rows = (await env.DB.prepare(
      `SELECT id, house_id, to_user FROM house_transfers
        WHERE status = 'pending' AND to_user IN (?, ?) AND house_id IN (${parte.map(() => '?').join(',')})`
    ).bind(...pessoas, ...parte).all()).results;
    for (const r of rows) {
      const parts = await participantsOf(env, r.house_id);
      if (parts && parts.includes(r.to_user)) continue;
      await env.DB.prepare("UPDATE house_transfers SET status = 'cancelled', decided_at = ? WHERE id = ? AND status = 'pending'")
        .bind(now(), r.id).run();
    }
  }
}

/* Rotas das conexões: convidar outro utilizador pelo id curto, aceitar o
   convite, cortar a ligação (leva as partilhas com ela, e os pedidos
   pendentes para passar o controlo de uma casa a quem por ela deixou de ser
   comproprietário ficam cancelados) e escolher que casas
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
    // um pedido para passar o controlo de uma casa só cai se quem recebe
    // deixar de ser comproprietário dela (rotas/casas.js:rotasTransferencias):
    // as casas com partilha nesta ligação leem-se antes de ela sair
    const casas = (await env.DB.prepare('SELECT house_id FROM shares WHERE connection_id = ?').bind(conn.id).all())
      .results.map((r) => r.house_id);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM shares WHERE connection_id = ?').bind(conn.id),
      env.DB.prepare('DELETE FROM connections WHERE id = ?').bind(conn.id),
    ]);
    await pedidosSemComproprietario(env, casas, [conn.requester_id, conn.target_id]);
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
    // só posso partilhar casas minhas: uma consulta por cada 50, não uma por
    // casa. A primeira traz também as casas das minhas partilhas nesta
    // ligação que já são de outra pessoa (herdadas de quando as controlava,
    // antes de passar o controlo — casas.js:aceitarCasaUmaVez): essas ficam,
    // continuam a dar a casa ao outro, e eu não as vejo na lista, que é só
    // das minhas casas
    const minhas = new Set(), herdadas = new Set();
    for (let i = 0; i < Math.max(houseIds.length, 1); i += 50) {
      const parte = houseIds.slice(i, i + 50);
      const pedidas = parte.length ? `id IN (${parte.map(() => '?').join(',')})` : '0';
      const minhasPartilhas = i === 0 ? ' OR id IN (SELECT house_id FROM shares WHERE connection_id = ? AND owner_id = ?)' : '';
      const rows = (await env.DB.prepare(
        `SELECT id, owner_id FROM houses WHERE deleted = 0 AND (${pedidas}${minhasPartilhas})`
      ).bind(...parte, ...(i === 0 ? [conn.id, me.id] : [])).all()).results;
      rows.forEach((r) => {
        if (r.owner_id === me.id) { if (parte.includes(r.id)) minhas.add(r.id); }
        else herdadas.add(r.id);
      });
    }
    const alheia = houseIds.find((h) => !minhas.has(h));
    if (alheia) return err(403, `A casa ${alheia} não é tua.`);
    // as minhas partilhas nesta ligação regravam-se, e as herdadas voltam
    // tal e qual no mesmo lote
    const stmts = [
      env.DB.prepare('DELETE FROM shares WHERE connection_id = ? AND owner_id = ?').bind(conn.id, me.id),
      ...[...herdadas].map((hid) =>
        env.DB.prepare('INSERT OR IGNORE INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)').bind(conn.id, me.id, hid)),
    ];
    // partilhar de novo com quem tinha saído da casa desfaz a saída dele: a
    // casa volta-lhe também pelos grupos (lib/acesso.js:limparSaida)
    const par = conn.requester_id === me.id ? conn.target_id : conn.requester_id;
    for (const hid of houseIds) {
      // OR REPLACE: a linha desta casa nesta ligação pode ser uma herdada do
      // criador anterior (dava-ma a mim); passa a ser minha e a dá-la ao outro
      stmts.push(
        env.DB.prepare('INSERT OR REPLACE INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)').bind(
          conn.id,
          me.id,
          hid
        ),
        limparSaida(env, hid, par)
      );
    }
    await env.DB.batch(stmts);
    return json({ ok: true });
  }
}
