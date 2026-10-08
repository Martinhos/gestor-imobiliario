/* A escrita de uma operação — uma casa, um registo de casa ou um dado global
   do utilizador —, num sítio só. O POST /api/sync é um ciclo sobre ela e as
   rotas REST de rotas/casas.js são um adaptador de uma operação.

   Existiam duas cópias, linha a linha: a recusa por serviço desligado, o
   acesso com o grau, a fusão da ficha e do planeado para um colaborador, a
   regra dos anexos, o UPSERT e o linkFiles. Cada regra nova tinha de entrar
   nos dois — e no dia em que um ficasse para trás, o teste que exercita o
   REST passava e o cliente, que usa o sync, ficava com o comportamento
   errado. Agora uma regra de escrita entra aqui, e vale para os dois. */

import { linkFiles, regraDosAnexos } from '../files.js';
import { acessoACasa, regraDoRegisto, planeadoAGravar, apagarCasa, preserveOwnership } from './acesso.js';
import { fundirCasa, fraseRecusa } from './permissoes.js';
import {
  servicosDesligados, kindsDesligados, userKindsDesligados, casaDesligada, servicoDoKind, FRASE_DESLIGADO,
} from './servicos.js';
import { badId, cleanData, tooBig, now } from './http.js';

// O que as escritas de um pedido partilham: os serviços desligados desta
// conta, lidos UMA vez (com o fecho dos que os requerem), e o acesso a cada
// casa, resolvido uma vez com o grau (dono, comproprietário ou colaborador).
// Recebe: env — o ambiente do worker; me — o utilizador com sessão.
// Devolve: promessa do contexto a passar a aplicarOp.
export async function prepararEscritas(env, me) {
  const desligados = await servicosDesligados(env, me.id);
  return {
    env,
    me,
    kindsOff: kindsDesligados(desligados),
    userKindsOff: userKindsDesligados(desligados),
    semCasas: casaDesligada(desligados),
    acessos: new Map(),
  };
}

// O acesso a uma casa, com a cache do contexto.
// Recebe: e — o contexto de prepararEscritas; houseId — o id da casa.
// Devolve: promessa do objeto de acessoACasa.
async function acessoDe(e, houseId) {
  if (!e.acessos.has(houseId)) e.acessos.set(houseId, await acessoACasa(e.env, e.me.id, houseId));
  return e.acessos.get(houseId);
}

// A recusa de uma operação de um serviço desligado nesta conta. O `servico`
// diz ao cliente QUAL — é o que a distingue do 403 de permissão
// (web/cloud/nucleo.js:servicoRecusado).
// Recebe: id — o id do serviço.
// Devolve: o resultado { ok: false, status: 403, error, servico }.
function desligado(id) {
  return { ok: false, status: 403, error: FRASE_DESLIGADO(id), servico: id };
}

// A dona de um imóvel: criar, gravar a ficha (um colaborador só com
// house.edit, e fundida com o que está na base — o cliente dele não tem
// hipotecas nem valor, e gravar por cima apagava o que o dono escreveu),
// ressuscitar (só o dono: é o «desfazer» da app), apagar (só o dono).
// Recebe: e — o contexto; houseId — o id da casa; put — true a gravar,
// false a apagar; data — a ficha já limpa (só no put).
// Devolve: promessa do resultado da operação.
async function escreverCasa(e, houseId, put, data) {
  const { env, me } = e;
  if (e.semCasas) return desligado('properties');
  const existing = await env.DB.prepare('SELECT owner_id, deleted, data FROM houses WHERE id = ?')
    .bind(houseId).first();
  if (!put) {
    if (!existing || existing.deleted) return { ok: true, gone: true };
    if (existing.owner_id !== me.id) return { ok: false, status: 403 };
    await apagarCasa(env, houseId, me.id);
    e.acessos.delete(houseId);
    return { ok: true };
  }
  if (existing && !existing.deleted) {
    const a = await acessoDe(e, houseId);
    if (!a.ok) return { ok: false, status: 403, error: fraseRecusa('acesso') };
    let dados = data;
    if (a.collab) {
      if (!a.collab.perms.has('house.edit')) return { ok: false, status: 403, error: fraseRecusa('casa') };
      dados = fundirCasa(existing.data, data, a.collab.perms);
    }
    await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(preserveOwnership(existing.data, dados)), now(), houseId).run();
    await linkFiles(env, houseId, dados, 'house', houseId, me.id, !!a.collab);
    return { ok: true };
  }
  if (existing) {
    if (existing.owner_id !== me.id) return { ok: false, status: 403 };
    await env.DB.prepare('UPDATE houses SET data = ?, updated_at = ?, deleted = 0 WHERE id = ?')
      .bind(JSON.stringify(preserveOwnership('', data)), now(), houseId).run();
  } else {
    await env.DB.prepare('INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)')
      .bind(houseId, me.id, JSON.stringify(preserveOwnership('', data)), now()).run();
  }
  e.acessos.set(houseId, { ok: true, owner: true, coowner: false, collab: null, ownerId: me.id });
  await linkFiles(env, houseId, data, 'house', houseId, me.id);
  return { ok: true };
}

// Um registo de uma casa. Com o kind num serviço desligado (a frase é a
// desse serviço), ou sem Imóveis, não entra nem sai — nem se olha para a
// casa. Depois, a regra única (regraDoRegisto); ao apagar, uma casa
// inacessível conta como «já não existe». A gravar, o planeado do dono
// confirmado por um colaborador só muda next/until/muted (planeadoAGravar), e
// os anexos que a escrita junta têm regra própria (regraDosAnexos).
// Recebe: e — o contexto; houseId, kind, rid — a linha; put — true a gravar,
// false a apagar; data — o registo já limpo (só no put).
// Devolve: promessa do resultado da operação.
async function escreverRegisto(e, houseId, kind, rid, put, data) {
  const { env, me } = e;
  if (e.kindsOff.has(kind)) return desligado(servicoDoKind(kind));
  if (e.semCasas) return desligado('properties');
  const a = await acessoDe(e, houseId);
  const veredicto = await regraDoRegisto(env, me, a, houseId, kind, rid, put);
  if (veredicto) {
    return veredicto.gone ? { ok: true, gone: true } : { ok: false, status: veredicto.status, error: veredicto.error };
  }
  if (!put) {
    await env.DB.prepare('UPDATE records SET deleted = 1, updated_at = ? WHERE house_id = ? AND kind = ? AND id = ?')
      .bind(now(), houseId, kind, rid).run();
    return { ok: true };
  }
  const dados = await planeadoAGravar(env, me, a, houseId, kind, rid, data);
  const anexos = await regraDosAnexos(env, a, houseId, kind, rid, dados);
  if (anexos) return { ok: false, status: anexos.status, error: anexos.error };
  // author é o último a escrever (o sino usa-o); created_by é o criador e
  // nunca muda — é o que decide «só o que criou»
  await env.DB.prepare(
    `INSERT INTO records (house_id, kind, id, data, updated_at, deleted, author, created_by)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT (house_id, kind, id)
     DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0,
       author = excluded.author, created_by = COALESCE(records.created_by, excluded.created_by)`
  ).bind(houseId, kind, rid, JSON.stringify(dados), now(), me.id, me.id).run();
  await linkFiles(env, houseId, dados, kind, rid, me.id, !!a.collab);
  return { ok: true };
}

// Um dado global do utilizador (user_records): só dele, sem casa; um kind de
// um serviço desligado não entra nem sai.
// Recebe: e — o contexto; kind, id — a linha; put — true a gravar, false a
// apagar; data — o registo já limpo (só no put).
// Devolve: promessa do resultado da operação.
async function escreverGlobal(e, kind, id, put, data) {
  const { env, me } = e;
  if (e.userKindsOff.has(kind)) return desligado(servicoDoKind(kind, 'user'));
  if (put) {
    await env.DB.prepare(
      `INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT (user_id, kind, id)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`
    ).bind(me.id, kind, id, JSON.stringify(data), now()).run();
  } else {
    await env.DB.prepare('UPDATE user_records SET deleted = 1, updated_at = ? WHERE user_id = ? AND kind = ? AND id = ?')
      .bind(now(), me.id, kind, id).run();
  }
  return { ok: true };
}

/* Aplica uma operação { op: 'put'|'del', scope: 'house'|'record'|'user',
   houseId, kind, id, data }: valida-a sozinha (ids pela forma de badId, o
   corpo por cleanData — o id da linha manda — e tooBig) e escreve-a com as
   regras do seu âmbito. Uma exceção sobe: o sync apanha-a por operação, o
   REST deixa-a chegar ao index.js.
   Recebe: e — o contexto de prepararEscritas; op — a operação (o data é
   limpo no próprio sítio).
   Devolve: promessa de { ok: true }, { ok: true, gone: true } (apagar o que
   já não existe), ou { ok: false, status, error?, servico? } — a mesma forma
   que o /api/sync devolve por operação. */
export async function aplicarOp(e, op) {
  if (!op || (op.op !== 'put' && op.op !== 'del')) return { ok: false, status: 400 };
  const put = op.op === 'put';
  if (op.scope !== 'user' && badId(op.houseId)) return { ok: false, status: 400 };
  if (op.scope !== 'house' && (badId(op.kind) || badId(op.id))) return { ok: false, status: 400 };
  if (put) {
    op.data = cleanData(op.data, op.scope === 'house' ? String(op.houseId) : String(op.id));
    if (!op.data) return { ok: false, status: 400 };
    if (tooBig(op.data)) return { ok: false, status: 413 };
  }
  if (op.scope === 'house') return escreverCasa(e, String(op.houseId), put, op.data);
  if (op.scope === 'record') return escreverRegisto(e, String(op.houseId), String(op.kind), String(op.id), put, op.data);
  if (op.scope === 'user') return escreverGlobal(e, String(op.kind), String(op.id), put, op.data);
  return { ok: false, status: 400 };
}
