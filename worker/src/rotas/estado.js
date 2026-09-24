// O estado completo que este utilizador pode ver, numa so leitura.
//
// Três graus de acesso saem daqui com formas diferentes: as casas de que sou
// dono ou comproprietário vêm inteiras, cada uma com os seus colaboradores
// em leitura (`collaborators: [{ id, userId, name, roleName }]` — é assim que
// um comproprietário fica a saber quem vê os movimentos, embora só o dono
// os gira); as casas onde tenho um cargo vêm despidas ao que o cargo deixa
// (projetarCasa/projetarRegisto) e com o cargo em `collab`; e o perfil
// completo de alguém só sai para quem é comproprietário de uma casa comum —
// uma ligação aceite sem casa comum, um dono de colaboração ou um
// colaborador levam data: null.
//
// Por cima disto, os serviços desligados da conta (lib/servicos.js): a lista
// sai em `servicos.desligados`, os registos dos kinds desligados e os
// user_records dos userKinds desligados ficam na base e não saem, sem
// Imóveis não saem casas nem registos, e sem Colaboradores as tabelas de
// cargos, convites, ligação, pedidos e conexões vêm vazias.

import { casasDeColaborador } from '../lib/acesso.js';
import { kindsVisiveis, projetarCasa, projetarRegisto } from '../lib/permissoes.js';
import {
  servicosDesligados, kindsDesligados, userKindsDesligados, casaDesligada, colabDesligado,
} from '../lib/servicos.js';
import { recordReport } from '../lib/relatos.js';
import { sha256hex } from '../auth.js';
import {
  listarCargos, listarColaboradores, listarConvites, estadoDaLigacao, pedidosDePartilha,
} from './colaboradores.js';

// O If-None-Match do pedido traz este selo? Aceita uma lista separada por
// vírgulas e o W/ que a Cloudflare põe num ETag quando comprime a resposta.
// Recebe: cabecalho — o If-None-Match (ou null); selo — o ETag da resposta.
// Devolve: true quando o cliente já tem esta resposta.
function seloIgual(cabecalho, selo) {
  if (!cabecalho) return false;
  return cabecalho.split(',').some((s) => s.trim().replace(/^W\//, '') === selo);
}

/* Rota do GET /api/state: junta numa só resposta tudo o que este utilizador
   pode ver — casas (próprias, partilhadas e de colaboração), registos, dados
   globais, conexões, perfis, propostas, e o que geriu como dono (cargos,
   colaboradores, convites, ligação e pedidos de partilha). Só lê da base.

   A resposta leva um ETag, que é o SHA-256 da própria resposta: com o
   If-None-Match igual responde 304 sem corpo, e o cliente não volta a
   aplicar o que já tem. Por ser o hash do que se ia mandar, o 304 nunca sai
   quando a resposta completa seria diferente — mas as linhas lidas na D1 são
   as mesmas (um selo mais barato teria de saber de todas as escritas que
   mudam o estado de alguém, incluindo as do back office).

   Uma linha com JSON estragado (um restauro a meio, uma edição à mão) sai da
   resposta em vez de a derrubar — a casa estragada leva os registos dela —
   e fica num relato para quem programa, com a linha.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   ctx, path, method e o utilizador em c.me).
   Devolve: a Response JSON com o estado completo (me, profiles, proposals,
   houses, records, userRecords, connections, people, roles, collaborators,
   invites, shareLink, shareRequests, servicos) e o ETag, ou o 304 sem corpo,
   no GET /api/state; nada (undefined) noutros caminhos. */
export async function rotasEstado(c) {
  const { env, request, ctx, path, method, me } = c;

  // Estado completo visível por este utilizador: casas próprias + partilhadas
  // comigo, registos dessas casas, dados globais e conexões.
  if (path === '/api/state' && method === 'GET') {
    /* os serviços desligados desta conta, lidos UMA vez por pedido (com o
       fecho dos que os requerem): decidem o que fica de fora mais abaixo.
       Uma conta sem linhas em user_services dá [] e recebe tudo como sempre. */
    const desligados = await servicosDesligados(env, me.id);
    const kindsOff = kindsDesligados(desligados);
    const userKindsOff = userKindsDesligados(desligados);
    const semCasas = casaDesligada(desligados);
    const semColab = colabDesligado(desligados);

    /* o JSON de cada linha lê-se uma vez, aqui à entrada: uma linha estragada
       fica em `estragadas` (vai num relato no fim) e sai da lista */
    const estragadas = [];
    const lerJSON = (texto, onde) => {
      try { return JSON.parse(texto); } catch (e) { estragadas.push(onde); return undefined; }
    };
    const legiveis = (linhas, onde) => linhas.filter((x) => (x.dados = lerJSON(x.data, onde(x))) !== undefined);
    const ondeCasa = (h) => 'houses ' + h.id;
    const ondeRegisto = (r) => 'records ' + r.house_id + '/' + r.kind + '/' + r.id;

    const houses = legiveis((
      await env.DB.prepare(
        `SELECT h.id, h.owner_id, h.data, h.updated_at, u.name AS owner_name
           FROM houses h JOIN users u ON u.id = h.owner_id
          WHERE h.deleted = 0 AND (
            h.owner_id = ?1
            OR h.id IN (
              SELECT s.house_id FROM shares s
                JOIN connections c ON c.id = s.connection_id
               WHERE c.status = 'accepted'
                 AND (c.requester_id = ?1 OR c.target_id = ?1)
                 AND s.owner_id <> ?1
            )
          )`
      )
        .bind(me.id)
        .all()
    ).results, ondeCasa);

    /* sem os Imóveis nesta conta, as casas não vão — e nada do que delas se
       deriva vai também: os registos, as propostas de quotas e os perfis
       completos dos comproprietários (a ficha inteira é só para quem partilha
       comigo uma casa que eu VEJO) */
    const houseIds = semCasas ? [] : houses.map((h) => h.id);
    // a D1 limita o número de parâmetros por consulta: em blocos, muitas casas
    // partilhadas deixam de conseguir partir a página de quem as recebe
    const chunk = (arr, n) => {
      const out = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };
    const inChunks = async (ids, sql) => {
      let out = [];
      for (const part of chunk(ids, 50)) {
        const ph = part.map(() => '?').join(',');
        out = out.concat((await env.DB.prepare(sql.replace('{IN}', ph)).bind(...part).all()).results);
      }
      return out;
    };

    /* casas onde tenho um cargo — menos as onde já sou participante, que
       vêm inteiras por cima (precedência: dono > comproprietário > colaborador) */
    const colab = await casasDeColaborador(env, me.id);
    houseIds.forEach((id) => colab.delete(id));
    const colabIds = [...colab.keys()];
    const colabHouses = colabIds.length
      ? legiveis(await inChunks(colabIds,
          `SELECT h.id, h.owner_id, h.data, h.updated_at, u.name AS owner_name
             FROM houses h JOIN users u ON u.id = h.owner_id
            WHERE h.deleted = 0 AND h.id IN ({IN})`), ondeCasa)
      : [];
    const allIds = houseIds.concat(colabHouses.map((h) => h.id));

    let records = houseIds.length
      ? legiveis(await inChunks(houseIds,
          `SELECT house_id, kind, id, data, updated_at, author, created_by FROM records
            WHERE deleted = 0 AND house_id IN ({IN})`), ondeRegisto)
      : [];
    /* nas casas de colaboração só se vão buscar os kinds que o cargo vê —
       agrupadas pela mesma lista de kinds, uma consulta por grupo — e cada
       registo passa pela projeção (um inquilino só de contrato fica em
       {id, name}); a projeção fica em `proj` para o mapeamento final */
    const porKinds = new Map();
    colabHouses.forEach((h) => {
      const ks = kindsVisiveis(colab.get(h.id).perms);
      if (!ks.length) return;
      const chave = ks.join(',');
      if (!porKinds.has(chave)) porKinds.set(chave, { ks, ids: [] });
      porKinds.get(chave).ids.push(h.id);
    });
    for (const { ks, ids } of porKinds.values()) {
      const lista = ks.map((k) => "'" + k + "'").join(',');   // constantes de KIND_PERM, não input
      const rows = await inChunks(ids,
        `SELECT house_id, kind, id, data, updated_at, author, created_by FROM records
          WHERE deleted = 0 AND kind IN (${lista}) AND house_id IN ({IN})`);
      rows.forEach((r) => {
        const d = lerJSON(r.data, ondeRegisto(r));
        if (d === undefined) return;
        const proj = projetarRegisto(r.kind, d, colab.get(r.house_id).perms);
        if (proj) records.push(Object.assign(r, { proj }));
      });
    }
    /* o que é de um serviço desligado fica na base e não sai: sem Imóveis
       nenhum registo (vivem todos numa casa); senão, os kinds desligados.
       Filtra-se aqui, antes dos nomes, para não se ir buscar gente só por
       causa de um movimento que não vai */
    records = semCasas ? [] : records.filter((r) => !kindsOff.has(r.kind));

    const userRecords = legiveis((
      await env.DB.prepare(
        'SELECT kind, id, data, updated_at FROM user_records WHERE user_id = ? AND deleted = 0'
      )
        .bind(me.id)
        .all()
    ).results, (r) => 'user_records ' + r.kind + '/' + r.id);

    const connections = (
      await env.DB.prepare(
        `SELECT c.id, c.requester_id, c.target_id, c.status, c.created_at,
                ur.name AS requester_name, ut.name AS target_name,
                ur.email AS requester_email, ut.email AS target_email
           FROM connections c
           JOIN users ur ON ur.id = c.requester_id
           JOIN users ut ON ut.id = c.target_id
          WHERE c.requester_id = ?1 OR c.target_id = ?1`
      )
        .bind(me.id)
        .all()
    ).results;

    const shares = (
      await env.DB.prepare(
        `SELECT s.connection_id, s.owner_id, s.house_id FROM shares s
          WHERE s.connection_id IN (
            SELECT id FROM connections WHERE requester_id = ?1 OR target_id = ?1
          )`
      )
        .bind(me.id)
        .all()
    ).results;

    // comproprietários por casa (dono primeiro) — também nas casas de
    // colaboração, onde são os participantes REAIS: eu nunca entro
    const houseParts = {};
    houses.forEach((h) => { houseParts[h.id] = [h.owner_id]; });
    colabHouses.forEach((h) => { houseParts[h.id] = [h.owner_id]; });
    if (allIds.length) {
      const rows = await inChunks(allIds,
        `SELECT s.house_id, s.owner_id, c.requester_id, c.target_id
           FROM shares s JOIN connections c ON c.id = s.connection_id
          WHERE c.status = 'accepted' AND s.house_id IN ({IN})`);
      rows.forEach((r) => {
        const other = r.requester_id === r.owner_id ? r.target_id : r.requester_id;
        const list = houseParts[r.house_id];
        if (list && !list.includes(other)) list.push(other);
      });
    }

    /* Ficha pessoal completa SÓ para quem partilha comigo uma casa em
       compropriedade. Uma ligação aceite sem casa comum, o dono de uma casa
       onde só tenho um cargo, ou um colaborador meu, ficam pelo nome: o
       perfil tem NIF, CC e morada fiscal, e nada disso é preciso para se
       saber quem é. */
    const userIdSet = new Set([me.id]);
    houseIds.forEach((hid) => (houseParts[hid] || []).forEach((u) => userIdSet.add(u)));
    // toda a gente cujo nome o cliente pode precisar: participantes das
    // casas de colaboração, pares de conexões (aceites ou não), colaboradores
    // das casas onde sou participante, autores e referidos nos movimentos
    const soNome = new Set();
    colabHouses.forEach((h) => (houseParts[h.id] || []).forEach((u) => soNome.add(u)));
    connections.forEach((c) => { soNome.add(c.requester_id); soNome.add(c.target_id); });
    const cargoDe = new Map();   // userId → nome do cargo, para `people`
    const colabPorCasa = {};     // houseId → [{ id, userId, roleName }], para as casas onde sou participante
    if (houseIds.length) {
      const rows = await inChunks(houseIds,
        `SELECT c.id, c.user_id, ch.house_id, r.name AS role_name
           FROM collaborators c
           JOIN collaborator_houses ch ON ch.collaborator_id = c.id
           JOIN roles r ON r.id = c.role_id
          WHERE r.deleted = 0 AND ch.house_id IN ({IN})`);
      rows.forEach((r) => {
        soNome.add(r.user_id);
        if (!cargoDe.has(r.user_id)) cargoDe.set(r.user_id, r.role_name);
        (colabPorCasa[r.house_id] = colabPorCasa[r.house_id] || []).push({ id: r.id, userId: r.user_id, roleName: r.role_name });
      });
    }

    // ids apenas referidos em movimentos das casas visíveis (quem pagou ou
    // recebeu, incluindo contas já apagadas) e quem escreveu cada registo:
    // entram só com o nome, para as referências continuarem legíveis —
    // "[deleted]" quando a conta se foi.
    records.forEach((r) => {
      [r.author, r.created_by].forEach((u) => { if (u) soNome.add(u); });
      const d = r.proj || r.dados;
      if (d && typeof d === 'object') [d.paidBy, d.toId].forEach((u) => { if (u) soNome.add(u); });
    });

    const uidArr = [...new Set([...userIdSet, ...soNome])];
    const userRows = await inChunks(uidArr, 'SELECT id, name FROM users WHERE id IN ({IN})');
    const fullArr = [...userIdSet];
    const profRecs = await inChunks(fullArr,
      `SELECT user_id, data FROM user_records
        WHERE kind = 'profile' AND id = 'main' AND deleted = 0 AND user_id IN ({IN})`);
    const profByUser = {};
    profRecs.forEach((r) => { try { profByUser[r.user_id] = JSON.parse(r.data); } catch (e) {} });
    const profiles = userRows.map((u) => ({
      userId: u.id,
      name: u.name,
      data: userIdSet.has(u.id) ? profByUser[u.id] || null : null,
    }));
    const people = userRows.map((u) => (cargoDe.has(u.id) && !userIdSet.has(u.id)
      ? { id: u.id, name: u.name, kind: 'collab', roleName: cargoDe.get(u.id) }
      : { id: u.id, name: u.name, kind: 'owner' }));
    const nomeDe = new Map(userRows.map((u) => [u.id, u.name]));
    // os colaboradores de uma casa minha ou partilhada comigo, em leitura
    // (nenhuns quando os Colaboradores estão desligados nesta conta)
    const colaboradoresDe = (hid) => (semColab ? [] : colabPorCasa[hid] || []).map((x) => ({
      id: x.id, userId: x.userId, name: nomeDe.get(x.userId) || '', roleName: x.roleName,
    }));

    // propostas de divisão pendentes nas casas visíveis
    let proposals = [];
    if (houseIds.length) {
      proposals = (await inChunks(houseIds,
        `SELECT p.house_id, p.proposed_by, p.shares, p.approvals, p.created_at, u.name AS proposer_name
           FROM share_proposals p JOIN users u ON u.id = p.proposed_by
          WHERE p.house_id IN ({IN})`)).map((p) => {
        const onde = 'share_proposals ' + p.house_id;
        const shares = lerJSON(p.shares, onde);
        const approvals = shares === undefined ? undefined : lerJSON(p.approvals, onde);
        if (shares === undefined || approvals === undefined) return null;
        return {
          houseId: p.house_id,
          proposedBy: p.proposed_by,
          proposedByName: p.proposer_name,
          shares,
          approvals,
          createdAt: p.created_at,
        };
      }).filter(Boolean);
    }

    // o que geri como dono (vazio para quem não tem nada): cargos,
    // colaboradores, convites por usar, a ligação e os pedidos de partilha —
    // e vazio de propósito quando os Colaboradores estão desligados
    const [roles, collaborators, invites, shareLink, shareRequests] = semColab
      ? [[], [], [], null, { incoming: [], outgoing: [] }]
      : await Promise.all([
        listarCargos(env, me.id),
        listarColaboradores(env, me.id),
        listarConvites(env, me.id),
        estadoDaLigacao(env, me.id),
        pedidosDePartilha(env, me.id),
      ]);

    const estado = {
      me: { id: me.id, email: me.email, name: me.name },
      servicos: { desligados },
      profiles,
      people,
      proposals,
      houses: semCasas ? [] : houses.map((h) => ({
        id: h.id,
        ownerId: h.owner_id,
        ownerName: h.owner_name,
        mine: h.owner_id === me.id,
        participants: houseParts[h.id] || [h.owner_id],
        collaborators: colaboradoresDe(h.id),
        updatedAt: h.updated_at,
        data: h.dados,
      })).concat(colabHouses.map((h) => {
        const cg = colab.get(h.id);
        return {
          id: h.id,
          ownerId: h.owner_id,
          ownerName: h.owner_name,
          mine: false,
          participants: houseParts[h.id] || [h.owner_id],
          collab: { id: cg.id, roleId: cg.roleId, roleName: cg.roleName, perms: [...cg.perms] },
          updatedAt: h.updated_at,
          data: projetarCasa(h.dados, cg.perms),
        };
      })),
      records: records.map((r) => ({
        houseId: r.house_id,
        kind: r.kind,
        id: r.id,
        updatedAt: r.updated_at,
        author: r.author || null,
        createdBy: r.created_by || null,
        data: r.proj || r.dados,
      })),
      roles,
      collaborators,
      invites,
      shareLink,
      shareRequests,
      userRecords: userRecords.filter((r) => !userKindsOff.has(r.kind)).map((r) => ({
        kind: r.kind,
        id: r.id,
        updatedAt: r.updated_at,
        data: r.dados,
      })),
      connections: semColab ? [] : connections.map((c) => {
        const iAmRequester = c.requester_id === me.id;
        // quem convida revela o seu email a quem recebe; o contrário só
        // acontece depois de o convite ser aceite
        const showEmail = c.status === 'accepted' || !iAmRequester;
        return {
          id: c.id,
          status: c.status,
          incoming: !iAmRequester && c.status === 'pending',
          peer: {
            id: iAmRequester ? c.target_id : c.requester_id,
            name: iAmRequester ? c.target_name : c.requester_name,
            email: showEmail ? (iAmRequester ? c.target_email : c.requester_email) : null,
          },
          myShares: shares.filter((s) => s.connection_id === c.id && s.owner_id === me.id).map((s) => s.house_id),
          peerShares: shares.filter((s) => s.connection_id === c.id && s.owner_id !== me.id).map((s) => s.house_id),
        };
      }),
    };

    // as linhas estragadas: um relato por assinatura, com a lista (a pessoa
    // não tem como saber qual dos seus registos é — quem programa fica a saber)
    if (estragadas.length) {
      const relato = recordReport(env, ctx, 'server', 'Linhas com JSON estragado no /api/state',
        estragadas.slice(0, 30).join('\n'), me.id);
      if (ctx && ctx.waitUntil) ctx.waitUntil(relato); else await relato;
    }

    // o selo é o hash do que se ia mandar: igual ao que o cliente tem, 304 sem corpo
    const corpo = JSON.stringify(estado);
    const selo = '"' + (await sha256hex(corpo)).slice(0, 32) + '"';
    if (seloIgual(request.headers.get('If-None-Match'), selo)) {
      return new Response(null, { status: 304, headers: { ETag: selo } });
    }
    return new Response(corpo, { headers: { 'Content-Type': 'application/json; charset=utf-8', ETag: selo } });
  }
}
