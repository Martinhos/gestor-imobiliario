// Casas, quotas, registos de cada casa e dados globais do utilizador — e a
// passagem do controlo de casas a um comproprietário (rotasTransferencias).
import { json, err, body, now, badId, idsDeCasas } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import {
  participantsOf, acessoACasa, redistribuirQuotas, avisoDeSaida,
  gravarCasa, comCasaFresca, casaMudou, FRASE_CASA_MUDOU,
  convitesSemCasa, SAIU_DA_CASA,
} from '../lib/acesso.js';
import { normalizarPerms } from '../lib/permissoes.js';
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
   ao mesmo tempo, num lote só: as partilhas que lhe dão a casa nas ligações
   em que está (as que ele dá a outros, herdadas de quando a controlava,
   ficam); a saída em house_exits se a casa lhe chega por um grupo (continua
   no grupo, e as outras casas do grupo continuam dele); um cargo que tivesse
   nela por baixo (sem isto, a precedência devolvia-lhe a casa como
   colaborador); e um pedido pendente para ele passar a controlá-la, que cai
   (já não é comproprietário). A quota dele vai para os que ficam, na proporção das deles
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
    // só as partilhas que ME dão a casa (owner_id <> eu): uma que eu dou a
    // outro nesta casa — herdada de quando a controlava e passei o controlo
    // (partilhasDoNovoCriador) — continua a dar-lha
    env.DB.prepare(
      `DELETE FROM shares WHERE house_id = ?1 AND owner_id <> ?2
         AND connection_id IN (SELECT id FROM connections WHERE requester_id = ?2 OR target_id = ?2)`
    ).bind(houseId, me.id),
    // um pedido para eu passar a controlar esta casa já não vale: deixo de ser comproprietário
    env.DB.prepare(
      "UPDATE house_transfers SET status = 'cancelled', decided_at = ? WHERE house_id = ? AND to_user = ? AND status = 'pending'"
    ).bind(t, houseId, me.id),
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

/* ===================== Passar o controlo de uma casa =====================
   O criador de uma ou várias casas pede para passar o controlo delas a um
   comproprietário (migração 0021, house_transfers: uma linha por casa, o
   lote junta as do mesmo pedido). A casa continua a ser de todos: aceitar
   muda só quem a controla na app (houses.owner_id) e o que for preciso para
   que os participantes, as quotas, os grupos, os anexos e o acesso de cada
   um fiquem iguais — quem pediu passa a comproprietário, quem recebe a
   criador. Nada muda antes de quem recebe aceitar; até lá, quem pediu
   cancela e quem recebe recusa. As colunas ficar e shares da 0021 ficam sem
   uso (grava-se ficar = 0 e shares = NULL). */

const FRASE_SO_CRIADOR = 'Só quem criou o imóvel o pode transferir.';
const FRASE_CASA = 'Casa não encontrada.';
const FRASE_JA_PENDENTE = 'Este imóvel já tem uma transferência pendente.';
const FRASE_NAO_COMPROPRIETARIO = 'Só podes passar o imóvel a um comproprietário dele.';
const FRASE_NAO_PENDENTE = 'Esta transferência já não está pendente.';
const FRASE_CORPO_TRANSF = 'Corpo inválido — envia { houseIds: [...], toUserId }.';
const FRASE_JA_NAO_E_DONO = 'Quem pediu já não é o dono deste imóvel.';
const FRASE_JA_NAO_COMPROPRIETARIO = 'Já não és comproprietário deste imóvel.';
const FRASE_SEM_CAMINHO = 'Não foi possível manter quem pediu como comproprietário deste imóvel.';
const FRASE_FALHOU = 'Não foi possível aceitar este imóvel. Tenta outra vez.';

// Se um erro é a recusa do trigger house_transfers_decidida: a linha já não
// estava pendente (outro pedido decidiu-a entretanto).
// Recebe: e — o erro apanhado.
// Devolve: true quando é essa recusa.
function transfDecidida(e) {
  return /transf-decidida/.test(String((e && (e.message || e)) || ''));
}

// As ligações aceites de um utilizador, pelo outro lado.
// Recebe: env — o ambiente do worker; userId — o utilizador.
// Devolve: promessa de um Map id do outro → id da ligação.
async function ligacoesDe(env, userId) {
  const out = new Map();
  (await env.DB.prepare(
    "SELECT id, requester_id, target_id FROM connections WHERE status = 'accepted' AND (requester_id = ?1 OR target_id = ?1)"
  ).bind(userId).all()).results.forEach((c) => out.set(c.requester_id === userId ? c.target_id : c.requester_id, c.id));
  return out;
}

// O nome de uma casa a partir do JSON guardado (estragado dá '').
// Recebe: texto — o houses.data.
// Devolve: o nome.
function nomeDoJSON(texto) {
  try { const d = JSON.parse(texto); return d && typeof d === 'object' ? String(d.name || '') : ''; } catch (e) { return ''; }
}

/* Pedir para passar o controlo (POST /api/transfers): as casas têm de
   existir e ser minhas, quem recebe tem de ser comproprietário de todas
   (acesso.js:participantsOf, e não eu), e nenhuma pode ter outro pedido
   pendente. Uma linha por casa num lote, e um aviso 'transf.pedido' por casa
   para quem recebe — tudo num lote só. ficar e shares, se vierem, ignoram-se.
   Recebe: env — o ambiente do worker; me — quem pede (da sessão); b — o
   corpo { houseIds, toUserId }.
   Devolve: promessa da Response { ok, lote } ou do erro do contrato. */
async function pedirTransferencia(env, me, b) {
  const houseIds = b && typeof b === 'object' ? idsDeCasas(b.houseIds) : null;
  const toUserId = b && typeof b.toUserId === 'string' ? b.toUserId : '';
  if (!houseIds || badId(toUserId)) return err(400, FRASE_CORPO_TRANSF);

  // as casas: vivas e minhas (uma de outra pessoa a que tenho acesso é 403;
  // uma que não existe ou que não vejo, 404)
  const casas = new Map();
  for (let i = 0; i < houseIds.length; i += 50) {
    const parte = houseIds.slice(i, i + 50);
    const rows = (await env.DB.prepare(
      `SELECT id, owner_id, data FROM houses WHERE deleted = 0 AND id IN (${parte.map(() => '?').join(',')})`
    ).bind(...parte).all()).results;
    rows.forEach((r) => casas.set(r.id, r));
  }
  for (const hid of houseIds) {
    const h = casas.get(hid);
    if (!h) return err(404, FRASE_CASA);
    if (h.owner_id !== me.id) {
      return (await acessoACasa(env, me.id, hid)).ok ? err(403, FRASE_SO_CRIADOR) : err(404, FRASE_CASA);
    }
  }

  // quem recebe já é comproprietário de cada uma (pela ligação ou por um grupo)
  if (toUserId === me.id) return err(400, FRASE_NAO_COMPROPRIETARIO);
  for (const hid of houseIds) {
    const parts = (await participantsOf(env, hid)) || [];
    if (!parts.includes(toUserId)) return err(400, FRASE_NAO_COMPROPRIETARIO);
  }

  const pendentes = [];
  for (let i = 0; i < houseIds.length; i += 50) {
    const parte = houseIds.slice(i, i + 50);
    const rows = (await env.DB.prepare(
      `SELECT house_id FROM house_transfers WHERE status = 'pending' AND house_id IN (${parte.map(() => '?').join(',')})`
    ).bind(...parte).all()).results;
    pendentes.push(...rows);
  }
  if (pendentes.length) return err(409, FRASE_JA_PENDENTE);

  const lote = crypto.randomUUID();
  const t = now();
  const stmts = [];
  houseIds.forEach((hid) => {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO house_transfers (id, lote, house_id, from_user, to_user, ficar, shares, status, created_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL, 'pending', ?)`
      ).bind(crypto.randomUUID(), lote, hid, me.id, toUserId, t),
      avisoDeSaida(env, toUserId, 'transf.pedido', hid, nomeDoJSON(casas.get(hid).data), me, t),
    );
  });
  // dois pedidos ao mesmo tempo para a mesma casa: o índice único parcial
  // deixa passar só o primeiro, e o lote do segundo desfaz-se inteiro
  try { await env.DB.batch(stmts); }
  catch (e) { if (/UNIQUE/i.test(String(e && e.message))) return err(409, FRASE_JA_PENDENTE); throw e; }
  await auditar(env, quemSou(me), 'transf.pedir', toUserId, houseIds.join(','));
  return json({ ok: true, lote });
}

/* Cancelar (quem pediu) ou recusar (quem recebe) as casas ainda pendentes
   de um lote: cada uma fica decidida e o outro lado recebe um aviso por
   casa. Tudo num lote; se uma casa foi decidida entretanto (o trigger
   house_transfers_decidida desfaz o lote), relê e tenta outra vez.
   Recebe: env — o ambiente do worker; me — quem decide (da sessão); lote —
   o lote; lado — 'from_user' (cancelar) ou 'to_user' (recusar).
   Devolve: promessa da Response { ok } ou do 404 sem nada pendente. */
async function fecharLote(env, me, lote, lado) {
  const cancelar = lado === 'from_user';
  const status = cancelar ? 'cancelled' : 'rejected';
  const kind = cancelar ? 'transf.cancelada' : 'transf.recusada';
  for (let vez = 1; ; vez++) {
    const rows = (await env.DB.prepare(
      `SELECT t.id, t.house_id, t.from_user, t.to_user, h.data FROM house_transfers t
         LEFT JOIN houses h ON h.id = t.house_id
        WHERE t.lote = ? AND t.${lado} = ? AND t.status = 'pending'`
    ).bind(lote, me.id).all()).results;
    if (!rows.length) return err(404, FRASE_NAO_PENDENTE);
    const t = now();
    const stmts = [];
    rows.forEach((r) => stmts.push(
      env.DB.prepare('UPDATE house_transfers SET status = ?, decided_at = ? WHERE id = ?').bind(status, t, r.id),
      avisoDeSaida(env, cancelar ? r.to_user : r.from_user, kind, r.house_id, nomeDoJSON(r.data), me, t),
    ));
    try { await env.DB.batch(stmts); }
    catch (e) { if (transfDecidida(e) && vez < 3) continue; if (transfDecidida(e)) return err(409, FRASE_NAO_PENDENTE); throw e; }
    await auditar(env, quemSou(me), cancelar ? 'transf.cancelar' : 'transf.recusar', lote, rows.map((r) => r.house_id).join(','));
    return json({ ok: true });
  }
}

/* As partilhas de uma casa quando o controlo passa de A para B, para que
   cada um continue a chegar-lhe. Uma partilha numa ligação dá a casa à
   ponta que não é o owner_id dela (acesso.js:COMPROPRIETARIO_SQL), seja quem
   for o criador; por isso só três coisas mudam:
   - a partilha que dava a casa a B na ligação A–B passa a ser de B: agora
     dá-a a A (e B pode deixar de a partilhar com A, nas partilhas dele);
   - a partilha que dava a casa a um terceiro X fora de uma ligação de B
     muda-se para a ligação B–X, se a houver, já de B: X chega pelo mesmo
     grau e B passa a geri-la; sem ligação B–X, fica onde está, de quem a
     deu (a ligação dessa pessoa a X continua a dar-lha — PUT das partilhas
     em conexoes.js já não a apaga);
   - se A não chegar à casa por caminho nenhum (sem grupo e sem partilha que
     lha dê), ganha uma: na ligação A–B, de B; sem ela, numa ligação de A a
     outro participante que ainda não tenha esta casa. Sem nenhuma, null.
   Recebe: env — o ambiente do worker; hid — a casa; A — quem pediu; B —
   quem recebe; parts — os participantes de agora.
   Devolve: promessa da lista de instruções preparadas, ou de null quando A
   ficaria sem caminho. */
async function partilhasDoNovoCriador(env, hid, A, B, parts) {
  const rows = (await env.DB.prepare(
    `SELECT s.connection_id, s.owner_id, c.requester_id, c.target_id FROM shares s
       JOIN connections c ON c.id = s.connection_id
      WHERE c.status = 'accepted' AND s.house_id = ?`
  ).bind(hid).all()).results;
  const deB = await ligacoesDe(env, B);
  const stmts = [];
  const ocupadas = new Set(rows.map((r) => r.connection_id));  // ligações onde a casa já tem a sua linha
  let aChega = false;
  rows.forEach((r) => {
    const da = r.requester_id === r.owner_id ? r.target_id : r.requester_id;
    if (da === A) { aChega = true; return; }
    if (da === B) {
      if (r.owner_id !== A) return;  // herdada de um criador anterior: fica, sem efeito
      stmts.push(env.DB.prepare('UPDATE shares SET owner_id = ? WHERE connection_id = ? AND house_id = ?')
        .bind(B, r.connection_id, hid));
      aChega = true;
      return;
    }
    const lig = deB.get(da);
    if (r.owner_id === B || !lig || lig === r.connection_id) return;
    stmts.push(
      env.DB.prepare('DELETE FROM shares WHERE connection_id = ? AND house_id = ?').bind(r.connection_id, hid),
      env.DB.prepare('INSERT OR REPLACE INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)').bind(lig, B, hid),
    );
    ocupadas.delete(r.connection_id);
    ocupadas.add(lig);
  });
  if (aChega) return stmts;
  const porGrupo = await env.DB.prepare(
    `SELECT 1 AS um FROM shared_group_houses gh
       JOIN shared_groups g ON g.id = gh.group_id AND g.deleted = 0
       JOIN shared_group_members m ON m.group_id = gh.group_id
      WHERE gh.house_id = ? AND m.user_id = ? AND ${SAIU_DA_CASA} LIMIT 1`
  ).bind(hid, A).first();
  if (porGrupo) return stmts;
  const deA = await ligacoesDe(env, A);
  const quem = [B, ...parts.filter((u) => u !== A && u !== B)].find((u) => deA.has(u) && !ocupadas.has(deA.get(u)));
  if (!quem) return null;
  stmts.push(env.DB.prepare('INSERT INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)').bind(deA.get(quem), quem, hid));
  return stmts;
}

/* Os colaboradores de A numa casa passam para a equipa de B com o mesmo
   cargo: o cargo de A copia-se para os de B — ou reutiliza-se um de B com o
   mesmo nome e as mesmas permissões —, cada colaborador fica com uma linha
   de B com esse cargo (a que já tivesse, ou nova) e o cargo de B nessa casa;
   as linhas de A deixam de ter esta casa e as que fiquem sem casas saem. Nas
   outras casas de A, nada muda. Um cargo de B nesta casa que já lá
   estivesse (de quando a controlou antes) sai: o acesso fica o de agora.
   Recebe: env — o ambiente do worker; hid — a casa; A — quem pediu; B —
   quem recebe; t — o instante.
   Devolve: promessa de { stmts, movidos } — as instruções, para o lote, e os
   ids dos colaboradores movidos. */
async function colaboradoresDoNovoCriador(env, hid, A, B, t) {
  const rows = (await env.DB.prepare(
    `SELECT c.user_id, c.role_id, r.name, r.perms FROM collaborators c
       JOIN collaborator_houses ch ON ch.collaborator_id = c.id
       JOIN roles r ON r.id = c.role_id
      WHERE ch.house_id = ? AND c.owner_id = ? AND r.deleted = 0
      ORDER BY c.created_at, c.user_id`
  ).bind(hid, A).all()).results.filter((r) => r.user_id !== B && r.user_id !== A);
  const stmts = [
    env.DB.prepare(
      'DELETE FROM collaborator_houses WHERE house_id = ? AND collaborator_id IN (SELECT id FROM collaborators WHERE owner_id = ?)'
    ).bind(hid, B),
  ];
  // as permissões como lista canónica em texto: duas listas iguais dão o mesmo texto
  const chave = (perms) => { let p = []; try { p = JSON.parse(perms); } catch (e) {} return JSON.stringify(normalizarPerms(p)); };
  const cargosDeB = (await env.DB.prepare('SELECT id, name, perms FROM roles WHERE owner_id = ? AND deleted = 0 ORDER BY created_at, id')
    .bind(B).all()).results;
  const cargoEmB = new Map();  // cargo de A → cargo de B
  const linhaEmB = new Map();  // pessoa|cargo de B → linha de colaborador de B
  const movidos = [];
  for (const r of rows) {
    let rb = cargoEmB.get(r.role_id);
    if (!rb) {
      const perms = chave(r.perms);
      const igual = cargosDeB.find((x) => x.name === r.name && chave(x.perms) === perms);
      if (igual) rb = igual.id;
      else {
        rb = crypto.randomUUID();
        stmts.push(env.DB.prepare(
          'INSERT INTO roles (id, owner_id, name, perms, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)'
        ).bind(rb, B, r.name, perms, t, t));
        cargosDeB.push({ id: rb, name: r.name, perms });
      }
      cargoEmB.set(r.role_id, rb);
    }
    const k = r.user_id + '|' + rb;
    let lb = linhaEmB.get(k);
    if (!lb) {
      const ja = await env.DB.prepare('SELECT id FROM collaborators WHERE owner_id = ? AND user_id = ? AND role_id = ?')
        .bind(B, r.user_id, rb).first();
      lb = ja ? ja.id : crypto.randomUUID();
      if (!ja) {
        stmts.push(env.DB.prepare('INSERT INTO collaborators (id, owner_id, user_id, role_id, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(lb, B, r.user_id, rb, t));
      }
      linhaEmB.set(k, lb);
    }
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO collaborator_houses (collaborator_id, house_id) VALUES (?, ?)').bind(lb, hid));
    if (!movidos.includes(r.user_id)) movidos.push(r.user_id);
  }
  stmts.push(
    env.DB.prepare(
      'DELETE FROM collaborator_houses WHERE house_id = ? AND collaborator_id IN (SELECT id FROM collaborators WHERE owner_id = ?)'
    ).bind(hid, A),
    env.DB.prepare(
      'DELETE FROM collaborators WHERE owner_id IN (?, ?) AND id NOT IN (SELECT collaborator_id FROM collaborator_houses)'
    ).bind(A, B),
  );
  return { stmts, movidos };
}

/* Uma passagem do aceitar de UMA casa (aceitarCasa repete-a quando outra
   escrita mudou a casa). Se o pedido já não vale — a casa foi apagada, quem
   pediu já não a criou, ou eu já não sou comproprietário — a linha fica
   cancelada e diz-se porquê. Senão, num lote só, com a casa à frente
   (gravarCasa por cima da revisão lida, só com o ownerId: o JSON — as
   quotas, ownerIds — fica como está) e a decisão logo a seguir (o trigger
   recusa uma linha já decidida):
   - o criador passa a ser quem recebe;
   - as partilhas acertam-se para todos continuarem a chegar à casa
     (partilhasDoNovoCriador);
   - os grupos ficam com a casa e com os mesmos membros; added_by passa a
     ser quem recebe (o dono da casa: regravar o conjunto de quem pediu, ou
     ele sair do grupo, já não a leva);
   - os colaboradores de quem pediu nessa casa passam para a equipa de quem
     recebe com o mesmo cargo (colaboradoresDoNovoCriador), com um aviso
     'colab.novo_dono' a cada um (menos os que também são participantes,
     que levam o 'casa.novo_dono'); os convites por usar de quem pediu
     deixam de a incluir e os pedidos de partilha dele com ela caem;
   - ficam como estão: as quotas e ownerIds, a proposta de quotas pendente,
     os anexos (files.owner_id), os registos e as saídas (house_exits);
   - avisos: 'transf.aceite' a quem pediu, 'casa.novo_dono' a cada
     participante (menos os dois).
   Recebe: env — o ambiente do worker; me — quem recebe (da sessão); row — a
   linha de house_transfers (pendente quando se leu).
   Devolve: promessa de { ok: true, movidos } ou de { error }. */
async function aceitarCasaUmaVez(env, me, row) {
  const A = row.from_user, B = me.id, hid = row.house_id;
  const invalido = async (error) => {
    await env.DB.prepare("UPDATE house_transfers SET status = 'cancelled', decided_at = ? WHERE id = ?").bind(now(), row.id).run();
    return { error };
  };
  const h = await env.DB.prepare('SELECT owner_id, data, rev, deleted FROM houses WHERE id = ?').bind(hid).first();
  if (!h || h.deleted) return invalido(FRASE_CASA);
  if (h.owner_id !== A) return invalido(FRASE_JA_NAO_E_DONO);
  const parts = (await participantsOf(env, hid)) || [A];
  if (!parts.includes(B)) return invalido(FRASE_JA_NAO_COMPROPRIETARIO);

  const partilhas = await partilhasDoNovoCriador(env, hid, A, B, parts);
  if (!partilhas) return invalido(FRASE_SEM_CAMINHO);
  const t = now();
  const colabs = await colaboradoresDoNovoCriador(env, hid, A, B, t);
  const nome = nomeDoJSON(h.data);

  const stmts = [
    gravarCasa(env, hid, h.rev, { ownerId: B }, t),
    env.DB.prepare("UPDATE house_transfers SET status = 'accepted', decided_at = ? WHERE id = ?").bind(t, row.id),
    ...partilhas,
    env.DB.prepare('UPDATE shared_group_houses SET added_by = ? WHERE house_id = ?').bind(B, hid),
    ...colabs.stmts,
    ...(await convitesSemCasa(env, hid, A, t)),
    env.DB.prepare("DELETE FROM share_requests WHERE house_id = ? AND from_user = ? AND status = 'pending'").bind(hid, A),
    avisoDeSaida(env, A, 'transf.aceite', hid, nome, me, t),
  ];
  parts.filter((u) => u !== A && u !== B).forEach((u) => stmts.push(avisoDeSaida(env, u, 'casa.novo_dono', hid, nome, me, t)));
  colabs.movidos.filter((u) => !parts.includes(u)).forEach((u) => stmts.push(avisoDeSaida(env, u, 'colab.novo_dono', hid, nome, me, t)));
  await env.DB.batch(stmts);
  return { ok: true, movidos: colabs.movidos };
}

/* Aceitar UMA casa de um lote, com as repetições e as falhas contadas: uma
   casa que falhe não desfaz as outras (cada uma tem o seu lote).
   Recebe: env — o ambiente do worker; me — quem recebe; row — a linha.
   Devolve: promessa de { ok: true, ... } ou de { error } com a frase. */
async function aceitarCasa(env, me, row) {
  try { return await comCasaFresca(() => aceitarCasaUmaVez(env, me, row)); }
  catch (e) {
    if (casaMudou(e)) return { error: FRASE_CASA_MUDOU };
    if (transfDecidida(e)) return { error: FRASE_NAO_PENDENTE };
    console.error('transferência: aceitar ' + row.house_id + ': ' + (e && e.stack || e));
    return { error: FRASE_FALHOU };
  }
}

/* Os pedidos pendentes de um utilizador, para o /api/state: os que lhe
   fizeram (incoming) e os que ele fez (outgoing), uma entrada por lote, com
   as casas (id e nome). ficar é sempre false e shares sempre null (o
   contrato mantém os campos).
   Recebe: env — o ambiente do worker; userId — o utilizador.
   Devolve: promessa de { incoming: [...], outgoing: [...] }. */
export async function listarTransferencias(env, userId) {
  const rows = (await env.DB.prepare(
    `SELECT t.lote, t.house_id, t.from_user, t.to_user, t.created_at,
            uf.name AS from_name, ut.name AS to_name, h.data
       FROM house_transfers t
       JOIN users uf ON uf.id = t.from_user
       JOIN users ut ON ut.id = t.to_user
       LEFT JOIN houses h ON h.id = t.house_id
      WHERE t.status = 'pending' AND (t.from_user = ?1 OR t.to_user = ?1)
      ORDER BY t.created_at, t.house_id`
  ).bind(userId).all()).results;
  const lotes = new Map();
  rows.forEach((r) => {
    let l = lotes.get(r.lote);
    if (!l) {
      const recebo = r.to_user === userId;
      l = { lote: r.lote, houses: [], ficar: false, shares: null, at: r.created_at };
      if (recebo) l.from = { id: r.from_user, name: r.from_name };
      else l.to = { id: r.to_user, name: r.to_name };
      l.recebo = recebo;
      lotes.set(r.lote, l);
    }
    l.houses.push({ id: r.house_id, name: nomeDoJSON(r.data) });
  });
  const out = { incoming: [], outgoing: [] };
  lotes.forEach((l) => {
    const { recebo, ...resto } = l;
    (recebo ? out.incoming : out.outgoing).push(resto);
  });
  return out;
}

/* Rotas da passagem do controlo: pedir (POST /api/transfers), cancelar
   (DELETE /api/transfers/:lote, quem pediu), recusar e aceitar
   (POST …/:lote/reject e …/:lote/accept, quem recebe). Pedir e aceitar são
   dos Imóveis: sem eles nesta conta, o 403 do serviço; cancelar e recusar
   passam sempre (desistir não fica preso a um serviço). Todas gastam o
   contador das escritas.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   method, seg e o utilizador em c.me).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o encaminhador tentar a seguinte. */
export async function rotasTransferencias(c) {
  const { env, request, method, seg, me } = c;
  if (seg[1] !== 'transfers') return;
  const pedir = seg.length === 2 && method === 'POST';
  const cancelar = seg.length === 3 && method === 'DELETE';
  const decidir = seg.length === 4 && method === 'POST' && (seg[3] === 'accept' || seg[3] === 'reject');
  if (!pedir && !cancelar && !decidir) return;
  if (!pedir && badId(seg[2])) return err(400, 'Identificador inválido.');
  if (!(await rateLimit(env, 'w:' + me.id, 60, 900))) return err(429, FRASE_RITMO);

  if (pedir) {
    if (casaDesligada(await servicosDesligados(env, me.id))) return err(403, FRASE_DESLIGADO('properties'));
    return pedirTransferencia(env, me, await body(request));
  }
  const lote = seg[2];
  if (cancelar) return fecharLote(env, me, lote, 'from_user');
  if (seg[3] === 'reject') return fecharLote(env, me, lote, 'to_user');

  // aceitar: casa a casa, pela ordem do pedido
  const rows = (await env.DB.prepare(
    "SELECT * FROM house_transfers WHERE lote = ? AND to_user = ? AND status = 'pending' ORDER BY created_at, house_id"
  ).bind(lote, me.id).all()).results;
  if (!rows.length) return err(404, FRASE_NAO_PENDENTE);
  if (casaDesligada(await servicosDesligados(env, me.id))) return err(403, FRASE_DESLIGADO('properties'));
  const aceites = [], falhadas = [];
  for (const row of rows) {
    const r = await aceitarCasa(env, me, row);
    if (r.error) { falhadas.push({ houseId: row.house_id, error: r.error }); continue; }
    aceites.push(row.house_id);
    await auditar(env, quemSou(me), 'transf.aceitar', row.house_id,
      row.from_user + (r.movidos.length ? ' · colaboradores ' + r.movidos.join(',') : ''));
  }
  return json({ ok: true, aceites, falhadas });
}
