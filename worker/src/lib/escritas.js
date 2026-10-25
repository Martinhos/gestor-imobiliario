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
import {
  acessoACasa, regraDoRegisto, planeadoAGravar, apagarCasa, preserveOwnership,
  gravarCasa, comCasaFresca, casaMudou, FRASE_CASA_MUDOU,
} from './acesso.js';
import { fundirCasa, fundirCasaComBase, fusaoIguais, fusaoObjeto, fraseRecusa } from './permissoes.js';
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

// A dona de um imóvel: criar, gravar a ficha, ressuscitar (só o dono: é o
// «desfazer» da app), apagar (só o dono). Gravar uma ficha que já existe é
// sempre uma fusão com o que está na base (permissoes.js:fundirCasaComBase):
// com a base que o cliente leu, só entra o que ele mudou; sem ela, nada sai
// das listas com ids. Um colaborador (só com house.edit) passa ainda pelo
// fundirCasa — o cliente dele não tem hipotecas nem valor, e o que o cargo
// não vê nem entra nem sai.
// Recebe: e — o contexto; houseId — o id da casa; put — true a gravar,
// false a apagar; data — a ficha já limpa (só no put); base (opcional) — os
// campos da versão que o cliente leu que ele mudou, já limpos.
// Devolve: promessa do resultado da operação.
async function escreverCasa(e, houseId, put, data, base) {
  if (e.semCasas) return desligado('properties');
  // lê e grava por cima da revisão lida (acesso.js:gravarCasa); outra escrita
  // a meio repete tudo (a fusão incluída), e à terceira desiste com um 409
  // que não mexeu em nada
  try { return await comCasaFresca(() => escreverCasaUmaVez(e, houseId, put, data, base)); }
  catch (erro) { if (casaMudou(erro)) return { ok: false, status: 409, error: FRASE_CASA_MUDOU }; throw erro; }
}

// Uma passagem de escreverCasa: lê a casa (com a revisão), funde e grava. Uma
// fusão que deixa a casa como estava não grava (não gasta a escrita nem muda
// a revisão), mas volta a prender os anexos.
// Recebe: e, houseId, put, data, base — os de escreverCasa.
// Devolve: promessa do resultado da operação.
async function escreverCasaUmaVez(e, houseId, put, data, base) {
  const { env, me } = e;
  const existing = await env.DB.prepare('SELECT owner_id, deleted, data, rev FROM houses WHERE id = ?')
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
    if (a.collab && !a.collab.perms.has('house.edit')) return { ok: false, status: 403, error: fraseRecusa('casa') };
    let dados = fundirCasaComBase(existing.data, data, base);
    if (a.collab) dados = fundirCasa(existing.data, dados, a.collab.perms);
    dados = preserveOwnership(existing.data, dados);
    if (!fusaoIguais(dados, lerCasa(existing.data))) {
      await gravarCasa(env, houseId, existing.rev, { data: JSON.stringify(dados) }, now()).run();
    }
    await linkFiles(env, houseId, dados, 'house', houseId, me.id, !!a.collab);
    return { ok: true };
  }
  if (existing) {
    if (existing.owner_id !== me.id) return { ok: false, status: 403 };
    await gravarCasa(env, houseId, existing.rev, { data: JSON.stringify(preserveOwnership('', data)), deleted: 0 }, now()).run();
  } else {
    await env.DB.prepare('INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)')
      .bind(houseId, me.id, JSON.stringify(preserveOwnership('', data)), now()).run();
  }
  e.acessos.set(houseId, { ok: true, owner: true, coowner: false, collab: null, ownerId: me.id });
  await linkFiles(env, houseId, data, 'house', houseId, me.id);
  return { ok: true };
}

// O JSON de uma casa (ou de um registo) lido da base, para comparar.
// Recebe: s — o texto da coluna data.
// Devolve: o objeto, ou null quando não se lê.
function lerCasa(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

// Um registo de uma casa. Com o kind num serviço desligado (a frase é a
// desse serviço), ou sem Imóveis, não entra nem sai — nem se olha para a
// casa. Depois, a regra única (regraDoRegisto); ao apagar, uma casa
// inacessível conta como «já não existe». A gravar, funde com o que está na
// base como a casa (gravarRegisto), e o planeado do dono confirmado por um
// colaborador continua a só mudar next/until/muted (planeadoAGravar, por
// cima da fusão).
// Recebe: e — o contexto; houseId, kind, rid — a linha; put — true a gravar,
// false a apagar; data — o registo já limpo (só no put); base (opcional) —
// os campos da versão que o cliente leu que ele mudou, já limpos.
// Devolve: promessa do resultado da operação.
async function escreverRegisto(e, houseId, kind, rid, put, data, base) {
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
  const chave = [houseId, kind, rid];
  return gravarRegisto(env, {
    ler: () => env.DB.prepare('SELECT data, deleted FROM records WHERE house_id = ? AND kind = ? AND id = ?').bind(...chave),
    // author é o último a escrever (o sino usa-o); created_by é o criador e
    // nunca muda — é o que decide «só o que criou»
    atualizar: (texto, t, row) => env.DB.prepare(
      `UPDATE records SET data = ?, updated_at = ?, deleted = 0, author = ?, created_by = COALESCE(created_by, ?)
       WHERE house_id = ? AND kind = ? AND id = ? AND data IS ? AND deleted IS ?`
    ).bind(texto, t, me.id, me.id, ...chave, row.data, row.deleted),
    inserir: (texto, t) => env.DB.prepare(
      `INSERT INTO records (house_id, kind, id, data, updated_at, deleted, author, created_by)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?) ON CONFLICT (house_id, kind, id) DO NOTHING`
    ).bind(...chave, texto, t, me.id, me.id),
  }, data, base, async (dados) => {
    // o planeado de outrem que um colaborador confirma: só next/until/muted
    // entram, por cima do que a fusão deu
    dados = await planeadoAGravar(env, me, a, houseId, kind, rid, dados);
    const anexos = await regraDosAnexos(env, a, houseId, kind, rid, dados);
    if (anexos) return { recusa: { ok: false, status: anexos.status, error: anexos.error } };
    return { dados };
  }, (dados) => linkFiles(env, houseId, dados, kind, rid, me.id, !!a.collab));
}

/* Grava um registo (de uma casa ou da conta) fundido com o que está na base,
   como a casa: com a base que o cliente leu, só entra o que ele mudou; sem
   ela, os campos que chegam ganham e nada sai (permissoes.js:fundirCasaComBase).
   Um registo apagado (a lápide) ou novo grava-se como chega — criar e
   ressuscitar não fundem. Uma fusão que deixa o registo como estava não grava
   (nem muda o autor). A escrita só pega se o registo ainda for o que se leu
   (o data e o deleted na condição do UPDATE; o INSERT de um novo não pisa um
   que entretanto apareceu): outra escrita a meio faz repetir a leitura e a
   fusão, e à terceira desiste com o 409 da casa, sem mexer em nada.
   Recebe: env; sql — {ler(), atualizar(texto, t, row), inserir(texto, t)}:
   as instruções preparadas da linha (a leitura do data e do deleted, o
   UPDATE condicionado ao que se leu, o INSERT que não pisa); data — o que
   chega; base — os campos da base, ou undefined; ajustar — async (dados) =>
   {dados} ou {recusa}: o que as regras do âmbito fazem ao fundido; depois —
   async (dados): o que corre depois de gravar, ou de ver que não havia nada
   a gravar.
   Devolve: promessa do resultado da operação. */
async function gravarRegisto(env, sql, data, base, ajustar, depois) {
  for (let vez = 1; vez <= 3; vez++) {
    const row = await sql.ler().first();
    const vivo = !!row && !row.deleted;
    const r = await ajustar(vivo ? fundirCasaComBase(row.data, data, base) : data);
    if (r.recusa) return r.recusa;
    if (vivo && fusaoIguais(r.dados, lerCasa(row.data))) {
      await depois(r.dados);
      return { ok: true };
    }
    const texto = JSON.stringify(r.dados), t = now();
    const feito = await (row ? sql.atualizar(texto, t, row) : sql.inserir(texto, t)).run();
    if (feito && feito.meta && feito.meta.changes) {
      await depois(r.dados);
      return { ok: true };
    }
  }
  return { ok: false, status: 409, error: FRASE_CASA_MUDOU };
}

// Um dado global do utilizador (user_records): só dele, sem casa; um kind de
// um serviço desligado não entra nem sai. A gravar, funde como um registo de
// casa (gravarRegisto): dois aparelhos da mesma conta não se esmagam.
// Recebe: e — o contexto; kind, id — a linha; put — true a gravar, false a
// apagar; data — o registo já limpo (só no put); base (opcional) — os campos
// da versão que o cliente leu que ele mudou, já limpos.
// Devolve: promessa do resultado da operação.
async function escreverGlobal(e, kind, id, put, data, base) {
  const { env, me } = e;
  if (e.userKindsOff.has(kind)) return desligado(servicoDoKind(kind, 'user'));
  if (!put) {
    await env.DB.prepare('UPDATE user_records SET deleted = 1, updated_at = ? WHERE user_id = ? AND kind = ? AND id = ?')
      .bind(now(), me.id, kind, id).run();
    return { ok: true };
  }
  const chave = [me.id, kind, id];
  return gravarRegisto(env, {
    ler: () => env.DB.prepare('SELECT data, deleted FROM user_records WHERE user_id = ? AND kind = ? AND id = ?').bind(...chave),
    atualizar: (texto, t, row) => env.DB.prepare(
      `UPDATE user_records SET data = ?, updated_at = ?, deleted = 0
       WHERE user_id = ? AND kind = ? AND id = ? AND data IS ? AND deleted IS ?`
    ).bind(texto, t, ...chave, row.data, row.deleted),
    inserir: (texto, t) => env.DB.prepare(
      `INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT (user_id, kind, id) DO NOTHING`
    ).bind(...chave, texto, t),
  }, data, base, async (dados) => ({ dados }), async () => {});
}

/* Aplica uma operação { op: 'put'|'del', scope: 'house'|'record'|'user',
   houseId, kind, id, data, base? }: valida-a sozinha (ids pela forma de
   badId, o corpo e a base por cleanData — o id da linha manda — e tooBig) e
   escreve-a com as regras do seu âmbito. A base vale nos três âmbitos: a
   casa (escreverCasa) e os registos (gravarRegisto) fundem com ela. Uma
   exceção sobe: o sync apanha-a por operação, o REST deixa-a chegar ao
   index.js.
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
  // a base: um objeto (os campos que o cliente mudou, como os leu), limpo
  // como o data; sem ela, ou com null, a fusão é a de sem base
  let base;
  if (put && op.base != null) {
    if (!fusaoObjeto(op.base)) return { ok: false, status: 400 };
    base = cleanData(op.base);
    if (tooBig(base)) return { ok: false, status: 413 };
  }
  if (op.scope === 'house') return escreverCasa(e, String(op.houseId), put, op.data, base);
  if (op.scope === 'record') return escreverRegisto(e, String(op.houseId), String(op.kind), String(op.id), put, op.data, base);
  if (op.scope === 'user') return escreverGlobal(e, String(op.kind), String(op.id), put, op.data, base);
  return { ok: false, status: 400 };
}
