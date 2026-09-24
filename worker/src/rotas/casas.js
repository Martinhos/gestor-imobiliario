// Casas, quotas, registos de cada casa e dados globais do utilizador.
import { json, err, body, now, badId } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { participantsOf } from '../lib/acesso.js';
import { servicosDesligados, casaDesligada, FRASE_DESLIGADO } from '../lib/servicos.js';
import { prepararEscritas, aplicarOp } from '../lib/escritas.js';

// A frase do travão das escritas — a mesma do /api/sync, que gasta o mesmo contador.
const FRASE_RITMO = 'Demasiadas gravações seguidas. Espera um pouco — os dados não se perdem.';

// A operação do /api/sync que uma rota REST de escrita é, ou nada.
// Recebe: seg — os segmentos do caminho; method — o método HTTP.
// Devolve: { op, scope, houseId?, kind?, id? } ou null quando a rota não é
// uma escrita (as propostas, por exemplo).
function operacaoREST(seg, method) {
  const op = method === 'PUT' ? 'put' : method === 'DELETE' ? 'del' : null;
  if (!op) return null;
  if (seg[1] === 'houses' && seg.length === 3) return { op, scope: 'house', houseId: seg[2] };
  if (seg[1] === 'houses' && seg[3] === 'records' && seg.length === 6) {
    return { op, scope: 'record', houseId: seg[2], kind: seg[4], id: seg[5] };
  }
  if (seg[1] === 'user-records' && seg.length === 4) return { op, scope: 'user', kind: seg[2], id: seg[3] };
  return null;
}

// O resultado de aplicarOp em resposta REST, com as frases que estas rotas
// sempre deram quando a operação não traz uma.
// Recebe: op — a operação; r — o resultado de aplicarOp.
// Devolve: a Response.
function respostaREST(op, r) {
  if (r.ok && r.gone) return op.scope === 'house' ? err(404, 'Casa não encontrada.') : json({ ok: true, gone: true });
  if (r.ok) return json({ ok: true });
  if (r.error) return err(r.status, r.error);
  if (r.status === 400) return err(400, 'Corpo inválido.');
  if (r.status === 413) return err(413, 'Registo demasiado grande.');
  return err(r.status, op.scope === 'house' && op.op === 'del' ? 'Só o dono pode apagar a casa.' : 'Sem acesso a esta casa.');
}

/* Rotas das casas e do que vive dentro delas: criar/atualizar e apagar uma
   casa, propor e confirmar a divisão de quotas entre comproprietários, e os
   put/del de registos da casa e de dados globais do utilizador. Cada escrita
   é uma operação do /api/sync (operacaoREST), escrita pela mesma aplicarOp
   (lib/escritas.js) e travada pelo mesmo contador: o serviço desligado, o
   acesso com o grau, a fusão do colaborador e a regra dos anexos são os do
   sync, sem cópia. As quotas vivem só aqui, e sem Imóveis nesta conta
   (lib/servicos.js) são 403 com a frase do serviço. Escreve na D1.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   method, seg e o utilizador em c.me).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o encaminhador tentar a seguinte. */
export async function rotasCasas(c) {
  const { env, request, method, seg, me } = c;

  // só os caminhos deste ficheiro
  if (seg[1] !== 'houses' && seg[1] !== 'user-records') return;

  // ---- Escritas: a casa, os registos dela, os dados globais ---------------

  const op = operacaoREST(seg, method);
  if (op) {
    if ([op.houseId, op.kind, op.id].some((v) => v !== undefined && badId(v))) {
      return err(400, 'Identificador inválido.');
    }
    if (!(await rateLimit(env, 'w:' + me.id, 60, 900))) return err(429, FRASE_RITMO);
    if (op.op === 'put') {
      const b = await body(request);
      if (!b) return err(400, 'Corpo inválido.');
      op.data = b.data;
    }
    return respostaREST(op, await aplicarOp(await prepararEscritas(env, me), op));
  }

  // ---- Divisão de percentagens (com confirmação dos comproprietários) -----

  if (seg[1] === 'houses' && seg[3] === 'proposal' && method === 'POST') {
    const houseId = seg[2];
    // as quotas são da casa: sem Imóveis não se propõe, aceita nem recusa
    if (casaDesligada(await servicosDesligados(env, me.id))) return err(403, FRASE_DESLIGADO('properties'));
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
      // uma proposta com JSON estragado não se aplica nem derruba a rota: pede-se outra
      let aprovadas = null, quotas = null;
      try { aprovadas = JSON.parse(row.approvals); quotas = JSON.parse(row.shares); } catch (e) {}
      if (!Array.isArray(aprovadas) || !quotas || typeof quotas !== 'object') {
        return err(409, 'Esta proposta está ilegível — faz uma nova.');
      }
      const approvals = new Set(aprovadas);
      approvals.add(me.id);
      if (parts.every((u) => approvals.has(u))) {
        const house = await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(houseId).first();
        let data = {};
        try { data = JSON.parse(house.data); } catch (e) {}
        data.ownerShares = quotas;
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
}
