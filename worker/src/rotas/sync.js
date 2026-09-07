// Sincronizacao em lote das alteracoes pendentes do cliente.
import { linkFiles } from '../files.js';
import { modoDemo, podeCriar } from '../lib/planos.js';

/* Rota do POST /api/sync: aplica as operações pendentes do cliente (put/del
   de casas, registos e dados globais) uma a uma, com validação e controlo de
   acesso por operação — uma falha não trava as seguintes. Escreve na D1 e
   devolve a Response; noutros caminhos não devolve nada, para o encaminhador
   tentar a rota seguinte.
   Recebe: c — o contexto partilhado montado pelo handleApi (env, request,
   path, method, o utilizador em c.me e os ajudantes).
   Devolve: a Response do POST /api/sync — JSON { results } com o resultado
   por operação, pela mesma ordem, ou o erro que couber; nada (undefined)
   noutros caminhos. */
export async function rotasSync(c) {
  const { env, request, ctx, path, method, seg, me, json, err, body, now, rateLimit, canAccessHouse, participantsOf, preserveOwnership, connectionForUser, badId, cleanData, tooBig, clientIp, TERMS_VERSION, purgeAccount } = c;

  // Sincronização em lote: o cliente envia todas as alterações pendentes de
  // uma vez. Cada operação é validada individualmente; a resposta devolve o
  // resultado por operação, pela mesma ordem.
  if (path === '/api/sync' && method === 'POST') {
    const b = await body(request);
    const ops = Array.isArray(b && b.ops) ? b.ops : null;
    if (!ops) return err(400, 'Corpo inválido — envia { ops: [...] }.');
    if (ops.length > 200) return err(400, 'Máximo de 200 operações por pedido.');
    // travão à quota diária de escritas da base: uma conta não pode gastá-la sozinha
    if (!(await rateLimit(env, 'w:' + me.id, 60, 900))) {
      return err(429, 'Demasiadas gravações seguidas. Espera um pouco — os dados não se perdem.');
    }
    /* Os limites do plano aplicam-se à CRIAÇÃO: uma linha nova de imóvel,
       contrato ou planeado. Atualizar, apagar e reativar o que já existe
       passa sempre — os termos prometem que nada do que existe fica
       inacessível. Em modo de demonstração não há limites nenhuns. */
    const demo = await modoDemo(env);
    let nImoveis = null;
    const imoveisDe = async () => {
      if (nImoveis == null) {
        nImoveis = ((await env.DB.prepare(
          'SELECT COUNT(*) AS n FROM houses WHERE owner_id = ? AND deleted = 0'
        ).bind(me.id).first()) || {}).n || 0;
      }
      return nImoveis;
    };
    const accessCache = new Map();
    const access = async (hid) => {
      if (!accessCache.has(hid)) accessCache.set(hid, (await canAccessHouse(env, me.id, hid)).ok);
      return accessCache.get(hid);
    };
    const results = [];
    for (const op of ops) {
      try {
        if (op.op !== 'put' && op.op !== 'del') { results.push({ ok: false, status: 400 }); continue; }
        const put = op.op === 'put';
        if (op.scope !== 'user' && badId(op.houseId)) { results.push({ ok: false, status: 400 }); continue; }
        if (op.scope !== 'house' && (badId(op.kind) || badId(op.id))) { results.push({ ok: false, status: 400 }); continue; }
        if (put) {
          const rowId = op.scope === 'house' ? String(op.houseId) : String(op.id);
          op.data = cleanData(op.data, rowId);
          if (!op.data) { results.push({ ok: false, status: 400 }); continue; }
          if (tooBig(op.data)) { results.push({ ok: false, status: 413 }); continue; }
        }
        if (op.scope === 'house') {
          const houseId = String(op.houseId || '');
          const existing = await env.DB.prepare('SELECT owner_id, deleted, data FROM houses WHERE id = ?')
            .bind(houseId).first();
          if (put) {
            if (existing && !existing.deleted) {
              if (!(await access(houseId))) { results.push({ ok: false, status: 403 }); continue; }
              await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
                .bind(JSON.stringify(preserveOwnership(existing.data, op.data)), now(), houseId).run();
            } else if (existing) {
              if (existing.owner_id !== me.id) { results.push({ ok: false, status: 403 }); continue; }
              await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ?, deleted = 0 WHERE id = ?')
                .bind(JSON.stringify(preserveOwnership('', op.data)), now(), houseId).run();
              accessCache.set(houseId, true);
            } else {
              if (!demo) {
                const nao = podeCriar(me.plan, 'imovel', await imoveisDe());
                if (nao) { results.push({ ok: false, status: 402, error: nao }); continue; }
              }
              await env.DB.prepare('INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)')
                .bind(houseId, me.id, JSON.stringify(preserveOwnership('', op.data)), now()).run();
              if (nImoveis != null) nImoveis++;
              accessCache.set(houseId, true);
            }
            await linkFiles(env, houseId, op.data);
          } else {
            if (!existing || existing.deleted) { results.push({ ok: true, gone: true }); continue; }
            if (existing.owner_id !== me.id) { results.push({ ok: false, status: 403 }); continue; }
            await env.DB.batch([
              env.DB.prepare('UPDATE houses SET deleted = 1, updated_at = ? WHERE id = ?').bind(now(), houseId),
              env.DB.prepare('UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ?').bind(now(), houseId),
              env.DB.prepare('DELETE FROM shares WHERE house_id = ?').bind(houseId),
              env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(houseId),
            ]);
            accessCache.delete(houseId);
          }
          results.push({ ok: true });
        } else if (op.scope === 'record') {
          const houseId = String(op.houseId || '');
          if (!(await access(houseId))) {
            // ao apagar, uma casa inacessível conta como "já não existe"
            results.push(put ? { ok: false, status: 403 } : { ok: true, gone: true });
            continue;
          }
          if (put) {
            const tipo = String(op.kind);
            if (!demo && (tipo === 'contract' || tipo === 'rec')) {
              const ja = await env.DB.prepare(
                'SELECT deleted FROM records WHERE house_id = ? AND kind = ? AND id = ?'
              ).bind(houseId, tipo, String(op.id)).first();
              if (!ja) {   // só a criação é travada; o que existe edita-se sempre
                const nao = podeCriar(me.plan, tipo, 0);
                if (nao) { results.push({ ok: false, status: 402, error: nao }); continue; }
              }
            }
            await env.DB.prepare(
              `INSERT INTO records (house_id, kind, id, data, updated_at, deleted, author)
               VALUES (?, ?, ?, ?, ?, 0, ?)
               ON CONFLICT (house_id, kind, id)
               DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0, author = excluded.author`
            ).bind(houseId, String(op.kind), String(op.id), JSON.stringify(op.data), now(), me.id).run();
            await linkFiles(env, houseId, op.data);
          } else {
            await env.DB.prepare(
              'UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ? AND kind = ? AND id = ?'
            ).bind(now(), houseId, String(op.kind), String(op.id)).run();
          }
          results.push({ ok: true });
        } else if (op.scope === 'user') {
          if (put) {
            await env.DB.prepare(
              `INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted)
               VALUES (?, ?, ?, ?, ?, 0)
               ON CONFLICT (user_id, kind, id)
               DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`
            ).bind(me.id, String(op.kind), String(op.id), JSON.stringify(op.data), now()).run();
          } else {
            await env.DB.prepare(
              'UPDATE user_records SET deleted = 1, updated_at = ? WHERE user_id = ? AND kind = ? AND id = ?'
            ).bind(now(), me.id, String(op.kind), String(op.id)).run();
          }
          results.push({ ok: true });
        } else {
          results.push({ ok: false, status: 400 });
        }
      } catch (e) {
        console.error('sync op failed', e);
        results.push({ ok: false, status: 500 });
      }
    }
    return json({ results });
  }
}
