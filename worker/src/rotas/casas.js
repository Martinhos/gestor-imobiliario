// Casas, quotas, registos de cada casa e dados globais do utilizador.
import { json, err, body, now, badId } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import {
  participantsOf, acessoACasa, redistribuirQuotas, avisoDeSaida,
  gravarCasa, comCasaFresca, casaMudou, FRASE_CASA_MUDOU,
} from '../lib/acesso.js';
import { servicosDesligados, casaDesligada, colabDesligado, FRASE_DESLIGADO } from '../lib/servicos.js';
import { prepararEscritas, aplicarOp } from '../lib/escritas.js';
import { auditar } from '../lib/auditoria.js';

// A frase do travão das escritas — a mesma do /api/sync, que gasta o mesmo contador.
const FRASE_RITMO = 'Demasiadas gravações seguidas. Espera um pouco — os dados não se perdem.';

// A identidade com que um utilizador da app assina a auditoria.
// Recebe: me — o utilizador com sessão.
// Devolve: o objeto que auditar() espera ({ discordId, nome, papeis }).
function quemSou(me) {
  return { discordId: me.id, nome: me.name || '', papeis: ['utilizador'] };
}

// As linhas de colaborador de quem sai que deixam de ter casas desse dono
// (a pessoa deixou de colaborar com ele de todo). A mesma limpeza das
// rotas de colaboradores.js.
// Recebe: env — o ambiente do worker; userId — quem sai; ownerId — o dono.
// Devolve: a instrução preparada, para o lote.
function colabOrfaos(env, userId, ownerId) {
  return env.DB.prepare(
    `DELETE FROM collaborators WHERE user_id = ? AND owner_id = ?
      AND id NOT IN (SELECT collaborator_id FROM collaborator_houses)`
  ).bind(userId, ownerId);
}

// O cargo de quem sai nesta casa, em todas as linhas de colaborador dele com
// este dono (um cargo por casa, mas uma linha por cargo).
// Recebe: env — o ambiente do worker; houseId — a casa; userId — quem sai;
// ownerId — o dono.
// Devolve: a instrução preparada, para o lote.
function semCargoNaCasa(env, houseId, userId, ownerId) {
  return env.DB.prepare(
    `DELETE FROM collaborator_houses WHERE house_id = ?
      AND collaborator_id IN (SELECT id FROM collaborators WHERE user_id = ? AND owner_id = ?)`
  ).bind(houseId, userId, ownerId);
}

/* Um colaborador sai de UMA casa: o cargo dele nela desaparece (de qualquer
   linha de colaborador sua com este dono), as linhas que fiquem sem casas
   saem, e o dono recebe um aviso 'colab.sair'. As outras casas do mesmo
   dono ficam como estavam. Tudo num lote; a auditoria depois.
   Recebe: env — o ambiente do worker; me — quem sai (da sessão); houseId —
   a casa; ownerId — o dono; houseName — o nome, lido antes de escrever.
   Devolve: promessa da Response { ok, como: 'colaborador' }. */
async function sairComoColaborador(env, me, houseId, ownerId, houseName) {
  const t = now();
  await env.DB.batch([
    semCargoNaCasa(env, houseId, me.id, ownerId),
    colabOrfaos(env, me.id, ownerId),
    avisoDeSaida(env, ownerId, 'colab.sair', houseId, houseName, me, t),
  ]);
  await auditar(env, quemSou(me), 'colab.sair', ownerId, houseId);
  return json({ ok: true, como: 'colaborador' });
}

/* Um comproprietário que não criou a casa sai dela, por todos os caminhos
   ao mesmo tempo, num lote só: as partilhas da casa nas ligações em que
   está; a saída em house_exits se a casa lhe chega por um grupo (continua no
   grupo, e as outras casas do grupo continuam dele); um cargo que tivesse
   nela por baixo (sem isto, a precedência devolvia-lhe a casa como
   colaborador). A quota dele vai para os que ficam, na proporção das deles
   (redistribuirQuotas), ownerIds fica com os que ficam, a proposta pendente
   apaga-se (já não bate com os participantes), e cada um dos que ficam
   recebe um aviso 'casa.sair'. Os saldos e o IRS seguem as quotas novas.
   Uma casa com o JSON estragado não se reescreve (perdia-se o resto dela):
   a pessoa sai na mesma, e as quotas ficam por acertar numa proposta.
   Duas saídas ao mesmo tempo (ou uma gravação da ficha a meio) não se
   esmagam: a casa grava-se por cima da revisão lida (acesso.js:gravarCasa),
   e quem chegar em segundo relê tudo — os participantes e as quotas já sem
   o primeiro — e refaz as contas (acesso.js:comCasaFresca).
   Recebe: env — o ambiente do worker; me — quem sai (da sessão); houseId —
   a casa; ownerId — o criador.
   Devolve: promessa da Response { ok, como: 'comproprietario', ownerShares },
   ou o 409 de FRASE_CASA_MUDOU à terceira recusa seguida. */
async function sairComoComproprietario(env, me, houseId, ownerId) {
  let r;
  try { r = await comCasaFresca(() => sairDaCasaUmaVez(env, me, houseId, ownerId)); }
  catch (e) { if (casaMudou(e)) return err(409, FRASE_CASA_MUDOU); throw e; }
  await auditar(env, quemSou(me), 'casa.sair', houseId,
    ownerId + (r.porGrupo ? ' · grupo' : '') + ' · ' + (r.quotas ? JSON.stringify(r.quotas) : 'partes iguais'));
  return json({ ok: true, como: 'comproprietario', ownerShares: r.quotas });
}

/* Uma passagem da saída do comproprietário (sairComoComproprietario, que a
   repete quando outra escrita mudou a casa): lê a casa e os participantes,
   conta as quotas e grava tudo num lote.
   Recebe: env, me, houseId, ownerId — os de sairComoComproprietario.
   Devolve: promessa de { quotas, porGrupo } — o ownerShares novo (ou null)
   e se a casa chegava por um grupo. */
async function sairDaCasaUmaVez(env, me, houseId, ownerId) {
  // o nome e as quotas leem-se ANTES de qualquer escrita: o aviso leva o nome
  const casa = await lerCasa(env, houseId);
  const parts = (await participantsOf(env, houseId)) || [ownerId];
  const ficam = parts.filter((u) => u !== me.id);
  const porGrupo = await env.DB.prepare(
    `SELECT 1 AS um FROM shared_group_houses gh
       JOIN shared_groups g ON g.id = gh.group_id AND g.deleted = 0
       JOIN shared_group_members m ON m.group_id = gh.group_id
      WHERE gh.house_id = ? AND m.user_id = ? LIMIT 1`
  ).bind(houseId, me.id).first();
  const data = casa.data;
  const quotas = data ? redistribuirQuotas(data.ownerShares, me.id, ficam) : null;
  if (data) {
    if (quotas) data.ownerShares = quotas; else delete data.ownerShares;
    data.ownerIds = ficam;
  }
  const t = now();
  const stmts = [
    env.DB.prepare(
      `DELETE FROM shares WHERE house_id = ?1
         AND connection_id IN (SELECT id FROM connections WHERE requester_id = ?2 OR target_id = ?2)`
    ).bind(houseId, me.id),
  ];
  if (porGrupo) {
    stmts.push(env.DB.prepare('INSERT OR REPLACE INTO house_exits (house_id, user_id, created_at) VALUES (?, ?, ?)')
      .bind(houseId, me.id, t));
  }
  stmts.push(
    semCargoNaCasa(env, houseId, me.id, ownerId),
    colabOrfaos(env, me.id, ownerId),
    env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(houseId),
  );
  // a casa primeiro: se outra escrita a mudou, a recusa desfaz o lote inteiro
  if (data) stmts.unshift(gravarCasa(env, houseId, casa.rev, { data: JSON.stringify(data) }, t));
  ficam.forEach((u) => stmts.push(avisoDeSaida(env, u, 'casa.sair', houseId, casa.name, me, t)));
  await env.DB.batch(stmts);
  return { quotas, porGrupo: !!porGrupo };
}

/* Uma passagem do aceitar de uma proposta de divisão (a rota repete-a
   quando outra escrita passou à frente): relê a proposta e os participantes,
   junta a minha aprovação e, com todos, aplica as quotas à casa. Duas
   aprovações ao mesmo tempo não se perdem: a aprovação só se grava se a
   proposta ainda estiver como se leu, e a casa por cima da revisão lida
   (acesso.js:gravarCasa) — senão, a recusa 'casa-mudou' faz repetir.
   Recebe: env — o ambiente do worker; me — quem aprova (da sessão);
   houseId — a casa.
   Devolve: promessa da Response { ok, applied }, o 404 sem proposta ou o
   409 de uma proposta ilegível. */
async function aceitarPropostaUmaVez(env, me, houseId) {
  const parts = (await participantsOf(env, houseId)) || [];
  const row = await env.DB.prepare('SELECT * FROM share_proposals WHERE house_id = ?').bind(houseId).first();
  if (!row) return err(404, 'Não há nenhuma proposta pendente para esta casa.');
  // uma proposta com JSON estragado não se aplica nem derruba a rota: pede-se outra
  let aprovadas = null, quotas = null;
  try { aprovadas = JSON.parse(row.approvals); quotas = JSON.parse(row.shares); } catch (e) {}
  if (!Array.isArray(aprovadas) || !quotas || typeof quotas !== 'object') {
    return err(409, 'Esta proposta está ilegível — faz uma nova.');
  }
  const approvals = new Set(aprovadas);
  approvals.add(me.id);
  if (parts.every((u) => approvals.has(u))) {
    const casa = await lerCasa(env, houseId);
    const data = casa.data || {};
    data.ownerShares = quotas;
    data.ownerIds = parts;
    await env.DB.batch([
      gravarCasa(env, houseId, casa.rev, { data: JSON.stringify(data) }, now()),
      env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ? AND created_at = ?').bind(houseId, row.created_at),
    ]);
    return json({ ok: true, applied: true });
  }
  const r = await env.DB.prepare(
    'UPDATE share_proposals SET approvals = ? WHERE house_id = ? AND approvals = ? AND created_at = ?'
  ).bind(JSON.stringify([...approvals]), houseId, row.approvals, row.created_at).run();
  // outra aprovação (ou outra proposta) chegou entre ler e gravar: relê
  if (!r.meta || !r.meta.changes) throw new Error('casa-mudou: a proposta mudou entretanto');
  return json({ ok: true, applied: false });
}

/* Os dados de uma casa, para quem vai escrever por cima deles: o JSON lido
   (null quando não se lê ou não é um objeto), o nome e a revisão.
   Recebe: env — o ambiente do worker; houseId — a casa.
   Devolve: promessa de { data, name, rev }. */
async function lerCasa(env, houseId) {
  const row = await env.DB.prepare('SELECT data, rev FROM houses WHERE id = ?').bind(houseId).first();
  let data = null;
  try { data = JSON.parse(row.data); } catch (e) {}
  const legivel = !!data && typeof data === 'object' && !Array.isArray(data);
  return { data: legivel ? data : null, name: legivel ? String(data.name || '') : '', rev: row ? row.rev : '' };
}

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
   (lib/servicos.js) são 403 com a frase do serviço. E sair de uma casa que
   não criei (DELETE …/participacao): o colaborador perde o cargo nela, o
   comproprietário a compropriedade, com a quota dividida pelos que ficam.
   Escreve na D1.
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
      // a base que o cliente leu, como no /api/sync: a casa e os registos
      // fundem com ela (escritas.js:escreverCasa, escritas.js:gravarRegisto)
      if (b.base !== undefined) op.base = b.base;
    }
    return respostaREST(op, await aplicarOp(await prepararEscritas(env, me), op));
  }

  // ---- Sair de uma casa que não criei (DELETE …/participacao) -------------
  // Apagar da minha lista um imóvel de outra pessoa é sair dele: perco as
  // permissões nessa casa (e só nessa), e quem fica é avisado. O criador
  // não sai (apaga a casa); quem não tem acesso leva o 404 de uma casa que
  // não existe. Sem Imóveis nesta conta é o 403 das quotas; o colaborador
  // sem Colaboradores, o 403 das outras escritas desse serviço.

  if (seg[1] === 'houses' && seg.length === 4 && seg[3] === 'participacao' && method === 'DELETE') {
    const houseId = seg[2];
    if (badId(houseId)) return err(400, 'Identificador inválido.');
    if (!(await rateLimit(env, 'w:' + me.id, 60, 900))) return err(429, FRASE_RITMO);
    const desligados = await servicosDesligados(env, me.id);
    if (casaDesligada(desligados)) return err(403, FRASE_DESLIGADO('properties'));
    const acesso = await acessoACasa(env, me.id, houseId);
    if (!acesso.ok) return err(404, 'Casa não encontrada.');
    if (acesso.owner) return err(400, 'Criaste este imóvel: para o tirar da tua lista, apaga-o.');
    if (acesso.collab && colabDesligado(desligados)) return err(403, FRASE_DESLIGADO('colaboradores'));
    if (acesso.coowner) return sairComoComproprietario(env, me, houseId, acesso.ownerId);
    // o colaborador não mexe na casa: só o nome, para o aviso
    return sairComoColaborador(env, me, houseId, acesso.ownerId, (await lerCasa(env, houseId)).name);
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
      try { return await comCasaFresca(() => aceitarPropostaUmaVez(env, me, houseId)); }
      catch (e) { if (casaMudou(e)) return err(409, FRASE_CASA_MUDOU); throw e; }
    }

    if (seg[4] === 'reject' && seg.length === 5) {
      await env.DB.prepare('DELETE FROM share_proposals WHERE house_id = ?').bind(houseId).run();
      return json({ ok: true });
    }
  }
}
