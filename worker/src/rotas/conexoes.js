// Ligações entre utilizadores e escolha das casas partilhadas.
import { json, err, body, now, idsDeCasas } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import {
  connectionForUser, limparSaida, participantsOf, participantesDeCasas, estadoDasQuotas, redistribuirQuotas,
  fecharQuotasHoje, fecharQuotasNaEntrada, gravarCasa, comCasaFresca, casaMudou, avisoDeSaida, nomesDeContas,
  SAIU_DA_CASA,
} from '../lib/acesso.js';
import { servicosDesligados, colabDesligado, FRASE_DESLIGADO } from '../lib/servicos.js';
import { passarSeTodosAceitaram } from './casas.js';

/* Os donos (participantes) de cada casa, ANTES de uma mudança que pode tirar
   alguém delas: cortar uma ligação, deixar de partilhar uma casa nela, tirar
   uma casa de um grupo, apagar um grupo, sair dele ou ser removido. É o que
   fecharQuotasDeQuemSaiu compara com os de depois.
   Recebe: env — o ambiente do worker; casas — os ids das casas.
   Devolve: promessa do Map casa → [ids dos participantes] (casas apagadas não vêm). */
export function donosAntes(env, casas) {
  return participantesDeCasas(env, [...new Set(casas || [])]);
}

/* Depois de uma mudança nas partilhas ou nos grupos, fecha o período das
   quotas de cada casa que perdeu donos, como sair do imóvel o faz
   (rotas/casas.js:sairDaCasaUmaVez) e a purga de uma conta
   (acesso.js:purgeAccount): o estado de antes vai para o quotasHist com
   ate = ontem, em Lisboa (acesso.js:fecharQuotasHoje); a quota de quem saiu
   passa aos que ficam na proporção das deles (redistribuirQuotas); o
   ownerIds fica com os que ficam; e a proposta pendente cai (já não bate com
   os participantes). Sem isto, a Declaração de quem ficou dava-lhe a casa
   inteira desde 1 de janeiro, e a de quem saiu esquecia os meses em que a
   teve. Uma casa que ninguém perdeu (quem saiu ainda a tem por outra
   ligação, ou por um grupo) não se toca. Uma casa ilegível não se reescreve.
   Cada casa grava-se por cima da revisão lida e repete quando outra escrita
   passou à frente (acesso.js:comCasaFresca); à terceira recusa fica como
   estava — as partilhas já mudaram, e as quotas acertam-se numa proposta.
   Os participantes e as casas leem-se de uma vez para todas (uma ligação
   pode levar muitas casas): uma consulta por casa só para gravar, e para
   reler numa repetição. No mesmo lote, o período que acaba leva os nomes
   de quem saiu e, dito quem fez a mudança, cada um que fica (menos ele)
   recebe um aviso 'casa.sair' por quem saiu (D6, N021). Sem quem, não há
   avisos: um grupo apagado avisava quem o apagou de cada membro em cada casa.
   Recebe: env — o ambiente do worker; antes — o Map de donosAntes; agora
   (opcional) — ms de época (o «hoje» de Lisboa sai dele); quem (opcional) —
   quem fez a mudança ({id}): com ele, os avisos a quem fica.
   Devolve: promessa dos ids das casas em que o período fechou. */
export async function fecharQuotasDeQuemSaiu(env, antes, agora, quem) {
  const ids = [...antes.keys()];
  if (!ids.length) return [];
  const depois = await participantesDeCasas(env, ids);
  const perdeu = (hid, ficam) => !!ficam && (antes.get(hid) || []).some((u) => !ficam.includes(u));
  const tocadas = ids.filter((hid) => perdeu(hid, depois.get(hid)));
  if (!tocadas.length) return [];
  const linhas = new Map((await env.DB.prepare(
    'SELECT id, data, rev FROM houses WHERE deleted = 0 AND id IN (SELECT value FROM json_each(?1))'
  ).bind(JSON.stringify(tocadas)).all()).results.map((r) => [r.id, r]));
  const fechadas = [];
  for (const hid of tocadas) {
    // a primeira passagem usa o que já se leu; uma repetição relê a casa e os participantes
    let lida = { row: linhas.get(hid), ficam: depois.get(hid) };
    try {
      const fechou = await comCasaFresca(async () => {
        const l = lida || {
          row: await env.DB.prepare('SELECT id, data, rev FROM houses WHERE id = ? AND deleted = 0').bind(hid).first(),
          ficam: await participantsOf(env, hid),
        };
        lida = null;
        return fecharQuotasDeUmaCasa(env, hid, antes.get(hid) || [], l.row, l.ficam, agora, quem);
      });
      if (fechou) fechadas.push(hid);
    } catch (e) { if (!casaMudou(e)) throw e; }
  }
  return fechadas;
}

/* Uma passagem do fecho das quotas de uma casa (fecharQuotasDeQuemSaiu, que
   a repete quando outra escrita mudou a casa): com a casa e os participantes
   de agora, grava num lote a casa, o fim da proposta e os avisos a quem fica.
   Recebe: env; hid — a casa; eram — os participantes de antes; row — a
   linha da casa ({data, rev}, ou null se já não existe); ficam — os
   participantes de agora (ou null); agora (opcional) — ms de época; quem
   (opcional) — quem fez a mudança ({id}): sem ele, nenhum aviso; com ele,
   todos os que ficam menos ele.
   Devolve: promessa de true quando gravou, false quando não havia nada a fazer. */
async function fecharQuotasDeUmaCasa(env, hid, eram, row, ficam, agora, quem) {
  if (!row || !ficam || !eram.some((u) => !ficam.includes(u))) return false;
  let data = null;
  try { data = JSON.parse(row.data); } catch (e) {}
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const saem = eram.filter((u) => !ficam.includes(u));
  const nomes = await nomesDeContas(env, saem);
  const antes = estadoDasQuotas(data, eram);
  const quotas = redistribuirQuotas(data.ownerShares, '', ficam);
  if (quotas) data.ownerShares = quotas; else delete data.ownerShares;
  data.ownerIds = ficam;
  fecharQuotasHoje(data, antes, ficam, agora, nomes);
  const t = now();
  const avisar = quem ? ficam.filter((u) => u !== quem.id) : [];
  await env.DB.batch([
    gravarCasa(env, hid, row.rev, { data: JSON.stringify(data) }, t),
    env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(hid),
    ...saem.flatMap((s) => avisar.map((u) => avisoDeSaida(env, u, 'casa.sair', hid, String(data.name || ''), { id: s, name: nomes[s] || '' }, t))),
  ]);
  return true;
}

/* Depois de uma mudança que pode dar uma casa a mais alguém (partilhá-la
   numa ligação, aceitar alguém num grupo, adicionar casas a um grupo, um
   pedido de partilha aceite — grupos.js, colaboradores.js), fecha o período das quotas de cada casa
   que ganhou donos, na véspera (acesso.js:fecharQuotasNaEntrada, N018): o
   «antes» fica com os donos de então, e quem entrou não era dono nesses dias
   até a proposta seguinte dizer desde quando («desde sempre» tira o
   período). A proposta pendente cai: não tem quem entrou. Uma casa ilegível
   não se reescreve; à terceira recusa seguida fica como estava. Os
   participantes de depois e as casas leem-se de uma vez para todas (ou vêm
   já lidos de quem chama); uma repetição relê só a casa que mudou.
   Recebe: env — o ambiente do worker; antes — o Map de donosAntes, lido
   antes da mudança; agora (opcional) — ms de época; lido (opcional) —
   { depois, linhas }: o Map dos participantes de agora e o das linhas das
   casas (id → {data, rev}), quando quem chama já os tem.
   Devolve: promessa dos ids das casas em que o período fechou. */
export async function fecharQuotasDeQuemEntrou(env, antes, agora, lido) {
  const ids = [...antes.keys()];
  if (!ids.length) return [];
  const depois = (lido && lido.depois) || await participantesDeCasas(env, ids);
  const ganhou = ids.filter((hid) => (depois.get(hid) || []).some((u) => !(antes.get(hid) || []).includes(u)));
  if (!ganhou.length) return [];
  const linhas = (lido && lido.linhas) || new Map((await env.DB.prepare(
    'SELECT id, data, rev FROM houses WHERE deleted = 0 AND id IN (SELECT value FROM json_each(?1))'
  ).bind(JSON.stringify(ganhou)).all()).results.map((r) => [r.id, r]));
  const fechadas = [];
  for (const hid of ganhou) {
    // a primeira passagem usa o que já se leu; uma repetição relê a casa e os participantes
    let l = { row: linhas.get(hid), agoraSao: depois.get(hid) };
    try {
      const fechou = await comCasaFresca(async () => {
        const v = l || {
          row: await env.DB.prepare('SELECT data, rev FROM houses WHERE id = ? AND deleted = 0').bind(hid).first(),
          agoraSao: await participantsOf(env, hid),
        };
        l = null;
        if (!v.row || !v.agoraSao) return false;
        let data = null;
        try { data = JSON.parse(v.row.data); } catch (e) {}
        if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
        const mudou = fecharQuotasNaEntrada(data, antes.get(hid) || [], v.agoraSao, agora);
        await env.DB.batch([
          ...(mudou ? [gravarCasa(env, hid, v.row.rev, { data: JSON.stringify(data) }, now())] : []),
          env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(hid),
        ]);
        return mudou;
      });
      if (fechou) fechadas.push(hid);
    } catch (e) { if (!casaMudou(e)) throw e; }
  }
  return fechadas;
}

/* Os participantes de casas minhas, sem voltar a ler as casas (quem chama
   já as leu e viu que são minhas e vivas): eu, as pontas das partilhas em
   ligações aceites e os membros dos grupos vivos que não saíram delas — as
   portas de acesso.js:participantesDeCasas, sem a linha da casa.
   Recebe: env — o ambiente do worker; eu — o meu id; ids — as casas.
   Devolve: promessa do Map casa → [ids dos participantes] (eu primeiro). */
async function participantesDasMinhas(env, eu, ids) {
  const out = new Map();
  if (!ids.length) return out;
  ids.forEach((h) => out.set(h, [eu]));
  (await env.DB.prepare(
    `SELECT s.house_id, CASE WHEN c.requester_id = s.owner_id THEN c.target_id ELSE c.requester_id END AS user_id
       FROM shares s JOIN connections c ON c.id = s.connection_id
      WHERE c.status = 'accepted' AND s.house_id IN (SELECT value FROM json_each(?1))
     UNION
     SELECT gh.house_id, m.user_id FROM shared_group_houses gh
       JOIN shared_groups g ON g.id = gh.group_id AND g.deleted = 0
       JOIN shared_group_members m ON m.group_id = gh.group_id
      WHERE gh.house_id IN (SELECT value FROM json_each(?1)) AND ${SAIU_DA_CASA}`
  ).bind(JSON.stringify([...new Set(ids)])).all()).results.forEach((r) => {
    const l = out.get(r.house_id);
    if (l && !l.includes(r.user_id)) l.push(r.user_id);
  });
  return out;
}

/* Os pedidos pendentes para transferir o controlo de uma destas casas depois de
   alguém deixar de ser comproprietário delas (cortar uma ligação leva as
   partilhas dela; deixar de partilhar uma casa numa ligação também): os que
   deixaram de valer porque quem recebe já não é comproprietário ficam
   cancelados, sem aviso; os que ficaram com o sim de todos os que restam
   passam já; os outros — quem recebe chega à casa por outra ligação ou por
   um grupo, e ainda falta alguém — ficam (rotas/casas.js:passarSeTodosAceitaram).
   Recebe: env — o ambiente do worker; casas — os ids das casas que tinham
   partilha na ligação.
   Devolve: promessa de nada — o efeito são as linhas decididas. */
async function pedidosSemComproprietario(env, casas) {
  if (casas.length) await passarSeTodosAceitaram(env, casas);
}

/* Rotas das conexões: convidar outro utilizador pelo id curto, aceitar o
   convite, cortar a ligação (leva as partilhas com ela; os pedidos
   pendentes para transferir o controlo dessas casas acertam-se:
   pedidosSemComproprietario) e escolher que casas minhas ficam
   partilhadas nessa conexão (as que deixam de estar acertam-se da mesma
   maneira). Nos dois casos, as casas que alguém perde fecham o período das
   quotas como sair delas, com um aviso a quem fica (fecharQuotasDeQuemSaiu);
   e as que alguém ganha fecham-no na véspera da entrada
   (fecharQuotasDeQuemEntrou, N018). Todas escrevem: com os
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
    // um pedido para transferir o controlo de uma casa cai se quem recebe deixar
    // de ser comproprietário dela, e passa se só faltava o sim de quem saiu
    // (rotas/casas.js:rotasTransferencias): as casas com partilha nesta
    // ligação leem-se antes de ela sair
    const casas = (await env.DB.prepare('SELECT house_id FROM shares WHERE connection_id = ?').bind(conn.id).all())
      .results.map((r) => r.house_id);
    // e os donos delas, para o período das quotas fechar onde alguém saiu
    const donos = await donosAntes(env, casas);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM shares WHERE connection_id = ?').bind(conn.id),
      env.DB.prepare('DELETE FROM connections WHERE id = ?').bind(conn.id),
    ]);
    await fecharQuotasDeQuemSaiu(env, donos, undefined, me);
    await pedidosSemComproprietario(env, casas);
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
    // antes de transferir o controlo — casas.js:aceitarCasaUmaVez): essas ficam,
    // continuam a dar a casa ao outro, e eu não as vejo na lista, que é só
    // das minhas casas. Os dados e a revisão vêm na mesma leitura: são o que
    // o fecho das quotas de quem entra grava (fecharQuotasDeQuemEntrou)
    const minhas = new Set(), herdadas = new Set(), linhas = new Map();
    for (let i = 0; i < Math.max(houseIds.length, 1); i += 50) {
      const parte = houseIds.slice(i, i + 50);
      const pedidas = parte.length ? `id IN (${parte.map(() => '?').join(',')})` : '0';
      const minhasPartilhas = i === 0 ? ' OR id IN (SELECT house_id FROM shares WHERE connection_id = ? AND owner_id = ?)' : '';
      const rows = (await env.DB.prepare(
        `SELECT id, owner_id, data, rev FROM houses WHERE deleted = 0 AND (${pedidas}${minhasPartilhas})`
      ).bind(...parte, ...(i === 0 ? [conn.id, me.id] : [])).all()).results;
      rows.forEach((r) => {
        if (r.owner_id === me.id) { if (parte.includes(r.id)) { minhas.add(r.id); linhas.set(r.id, r); } }
        else herdadas.add(r.id);
      });
    }
    const alheia = houseIds.find((h) => !minhas.has(h));
    if (alheia) return err(403, `A casa ${alheia} não é tua.`);
    // as minhas casas partilhadas aqui antes: as que saírem acertam os pedidos de as passar
    const antes = (await env.DB.prepare('SELECT house_id FROM shares WHERE connection_id = ? AND owner_id = ?')
      .bind(conn.id, me.id).all()).results.map((r) => r.house_id).filter((h) => !herdadas.has(h));
    // e os donos das que saem, para o período das quotas fechar onde alguém as
    // perde; e os das que entram, para fechar onde alguém as ganha (N018)
    const saem = antes.filter((h) => !houseIds.includes(h));
    const donos = await donosAntes(env, saem);
    const novas = houseIds.filter((h) => !antes.includes(h));
    const donosDasNovas = await participantesDasMinhas(env, me.id, novas);
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
    await fecharQuotasDeQuemSaiu(env, donos, undefined, me);
    await fecharQuotasDeQuemEntrou(env, donosDasNovas, undefined,
      { depois: await participantesDasMinhas(env, me.id, novas), linhas });
    await pedidosSemComproprietario(env, saem);
    return json({ ok: true });
  }
}
