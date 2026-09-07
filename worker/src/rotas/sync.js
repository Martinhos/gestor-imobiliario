// Sincronizacao em lote das alteracoes pendentes do cliente.
import { linkFiles, regraDosAnexos } from '../files.js';
import { modoDemo, podeCriar } from '../lib/planos.js';
import { acessoACasa, planoDosDonos, regraDoRegisto, apagarCasa } from '../lib/acesso.js';
import { fundirCasa, fraseRecusa } from '../lib/permissoes.js';

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
    /* o acesso a cada casa resolve-se uma vez por pedido, com o grau
       (dono, comproprietário ou colaborador com cargo): é o que decide
       registo a registo o que passa */
    const accessCache = new Map();
    const access = async (hid) => {
      if (!accessCache.has(hid)) accessCache.set(hid, await acessoACasa(env, me.id, hid));
      return accessCache.get(hid);
    };
    const planoDe = planoDosDonos(env, me);
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
              const a = await access(houseId);
              if (!a.ok) { results.push({ ok: false, status: 403, error: fraseRecusa('acesso') }); continue; }
              let dados = op.data;
              if (a.collab) {
                /* um colaborador só toca na ficha com house.edit, e mesmo
                   assim só nos campos que o cargo lhe deixa ver: o cliente
                   dele não tem hipotecas nem valor, e gravar por cima
                   apagava o que o dono escreveu */
                if (!a.collab.perms.has('house.edit')) {
                  results.push({ ok: false, status: 403, error: fraseRecusa('casa') }); continue;
                }
                dados = fundirCasa(existing.data, op.data, a.collab.perms);
              }
              await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
                .bind(JSON.stringify(preserveOwnership(existing.data, dados)), now(), houseId).run();
              await linkFiles(env, houseId, dados, 'house', houseId, me.id);
            } else if (existing) {
              if (existing.owner_id !== me.id) { results.push({ ok: false, status: 403 }); continue; }
              await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ?, deleted = 0 WHERE id = ?')
                .bind(JSON.stringify(preserveOwnership('', op.data)), now(), houseId).run();
              accessCache.set(houseId, { ok: true, owner: true, coowner: false, collab: null, ownerId: me.id });
              await linkFiles(env, houseId, op.data, 'house', houseId, me.id);
            } else {
              if (!demo) {
                const nao = podeCriar(me.plan, 'imovel', await imoveisDe());
                if (nao) { results.push({ ok: false, status: 402, error: nao }); continue; }
              }
              await env.DB.prepare('INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)')
                .bind(houseId, me.id, JSON.stringify(preserveOwnership('', op.data)), now()).run();
              if (nImoveis != null) nImoveis++;
              accessCache.set(houseId, { ok: true, owner: true, coowner: false, collab: null, ownerId: me.id });
              await linkFiles(env, houseId, op.data, 'house', houseId, me.id);
            }
          } else {
            if (!existing || existing.deleted) { results.push({ ok: true, gone: true }); continue; }
            if (existing.owner_id !== me.id) { results.push({ ok: false, status: 403 }); continue; }
            await apagarCasa(env, houseId, me.id);
            accessCache.delete(houseId);
          }
          results.push({ ok: true });
        } else if (op.scope === 'record') {
          const houseId = String(op.houseId || '');
          const tipo = String(op.kind), rid = String(op.id);
          const a = await access(houseId);
          // ao apagar, uma casa inacessível conta como "já não existe"
          const veredicto = await regraDoRegisto(env, me, a, houseId, tipo, rid, put, demo, planoDe);
          if (veredicto) {
            results.push(veredicto.gone ? { ok: true, gone: true }
              : { ok: false, status: veredicto.status, error: veredicto.error });
            continue;
          }
          if (put) {
            // os anexos que a escrita junta têm regra própria: um colaborador
            // só os junta com file.add (o que já estava preso ao registo não conta)
            const anexos = await regraDosAnexos(env, a, houseId, tipo, rid, op.data);
            if (anexos) { results.push({ ok: false, status: anexos.status, error: anexos.error }); continue; }
            // author é o último a escrever (o sino usa-o); created_by é o
            // criador e nunca muda — é o que decide «só o que criou»
            await env.DB.prepare(
              `INSERT INTO records (house_id, kind, id, data, updated_at, deleted, author, created_by)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?)
               ON CONFLICT (house_id, kind, id)
               DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0,
                 author = excluded.author, created_by = COALESCE(records.created_by, excluded.created_by)`
            ).bind(houseId, tipo, rid, JSON.stringify(op.data), now(), me.id, me.id).run();
            await linkFiles(env, houseId, op.data, tipo, rid, me.id);
          } else {
            await env.DB.prepare(
              'UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ? AND kind = ? AND id = ?'
            ).bind(now(), houseId, tipo, rid).run();
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
