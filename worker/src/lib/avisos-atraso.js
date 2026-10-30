/* Os avisos por email dos movimentos planeados em atraso (o ticket de QA
   7f28f7bb, com as decisões do Martinho de 2026-10-29).
   ------------------------------------------------------------------------
   No cron de hora a hora (index.js, depois da vigia), a partir das 9h em
   Lisboa (horaDosAvisos), o resumoDosAtrasos procura os planeados em atraso
   — a regra da app, web/app/planeados.js:recIsLate, com o «hoje» em Lisboa —
   e manda a cada pessoa UM email com os que ela pode ver, mas só nos dias em
   que algum é novo para ela, e no máximo um email por pessoa por dia. Cada
   atraso vai num email uma única vez: a tabela avisos_atraso (migração 0026)
   guarda os que já foram, e só os grava quando o Resend aceitou o email —
   sem RESEND_API_KEY, ou com o Resend a recusar, a hora seguinte tenta outra
   vez.

   O plano gratuito da Cloudflare limita as consultas à D1 e os subpedidos
   por invocação (50). Por isso o número de consultas de uma execução é FIXO:
   cinco para saber quem vê o quê (os planeados das casas, as partilhas, os
   grupos, os cargos e os «Sem imóvel»), três para as pessoas (as contas, os
   serviços e o que já foi), uma para a poda — mais uma escrita por email
   enviado, e no máximo MAX_EMAILS_POR_EXECUCAO emails; quem fica de fora vai
   na hora seguinte. As listas de ids vão num só parâmetro em JSON
   (json_each), e não em IN (?, ?, …), que tem o teto dos 100 parâmetros.
   Na prova com 1576 casas, a versão que chamava o participantsOf por casa
   fazia ~4700 consultas e a D1 recusava-as.

   Quem recebe os de uma casa: os participantes (a mesma regra do
   lib/acesso.js:participantsOf — o dono, os comproprietários por partilha
   aceite e os membros dos grupos partilhados vivos que não saíram dela)
   todos; os colaboradores da casa pelo cargo — com «Ver planeados»
   (rec.view) todos, só com «Ver contratos» (contract.view) as rendas dos
   contratos (os planeados com tx.contractId), sem nenhuma das duas nada.
   Quem é participante nunca é tratado como colaborador (a precedência do
   acessoACasa). Um planeado «Sem imóvel» (user_records) só vai para a conta
   dona dele. De cada pessoa: os avisos ligados (users.avisos_email), o
   serviço dos Planeados ligado (user_services), a conta viva e, em
   produção, sem as contas de teste.

   Nunca lança: o cron não pode cair por causa disto. */

import { SAIU_DA_CASA } from './acesso.js';
import { normalizarPerms } from './permissoes.js';
import { fechoDesligados } from './servicos.js';
import { emailAtrasos } from './correio.js';

// O kind dos planeados, em records e em user_records (web/cloud/nucleo.js:listaDe).
const KIND_PLANEADO = 'rec';
// O nome que se lê para um planeado sem casa.
export const SEM_IMOVEL = 'Sem imóvel';
// Quanto tempo vive uma linha de avisos_atraso: depois disto, sai.
const VIDA_DO_AVISO_MS = 400 * 86400000;
// Quantos emails sai numa execução, no máximo: os outros ficam para a hora seguinte.
export const MAX_EMAILS_POR_EXECUCAO = 20;
// A partir de que hora de Lisboa se mandam os avisos.
const HORA_DOS_AVISOS = 9;
// O sentido do dinheiro de cada tipo de movimento (web/app/tipos.js:KIND, flow).
const FLUXO = { income: 'in', owed: 'in', expense: 'out', loan: 'out', repay: 'out', settle: 'none' };
// Quanto se espera entre dois emails do resumo (o Resend aceita poucos por segundo).
const PAUSA_ENTRE_EMAILS_MS = 600;
// Uma data AAAA-MM-DD, a forma do next e do until dos planeados.
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
// O next de um registo em SQL, sem a consulta cair num JSON torto (o
// json_extract lança com ele).
// Recebe: col — a coluna com o JSON do registo ('r.data', 'data').
// Devolve: a expressão SQL do next (NULL num JSON torto).
function nextSql(col) {
  return `CASE WHEN json_valid(${col}) THEN json_extract(${col}, '$.next') END`;
}

/* As partes da data e da hora em Lisboa de um instante.
   Recebe: agora (opcional) — ms de época (Date.now() por omissão).
   Devolve: { year, month, day, hour } em texto, com dois algarismos. */
function emLisboa(agora) {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(agora == null ? Date.now() : agora));
  const out = {};
  for (const p of partes) out[p.type] = p.value;
  return out;
}

/* O dia de hoje em Lisboa, que é o «hoje» da app (web/app/formato.js:today
   corre no telemóvel de quem usa): a regra não pode depender da hora UTC a
   que o cron corre.
   Recebe: agora (opcional) — ms de época (Date.now() por omissão).
   Devolve: 'AAAA-MM-DD'. */
export function hojeEmLisboa(agora) {
  const l = emLisboa(agora);
  return l.year + '-' + l.month + '-' + l.day;
}

/* Já é hora de mandar os avisos? A partir das 9h em Lisboa, com a mudança
   da hora contada (no verão às 08:00 UTC, no inverno às 09:00 UTC).
   Recebe: agora (opcional) — ms de época (Date.now() por omissão).
   Devolve: true a partir das 9h em Lisboa (até à meia-noite). */
export function horaDosAvisos(agora) {
  return Number(emLisboa(agora).hour) >= HORA_DOS_AVISOS;
}

/* A regra do atraso da app (web/app/planeados.js:recIsLate, mais o «!muted»
   do recActive): por confirmar, não silenciado, e já passou o último dia da
   janela (o until, ou o next sem janela). Um next que não é uma data não
   está em atraso — não há dia que o email possa dizer.
   Recebe: rec — o planeado (o JSON do registo, interpretado); hoje — 'AAAA-MM-DD'.
   Devolve: true quando está em atraso. */
export function emAtraso(rec, hoje) {
  if (!rec || typeof rec !== 'object' || rec.muted) return false;
  const next = typeof rec.next === 'string' ? rec.next : '';
  if (!DATA_ISO.test(next)) return false;
  return next <= hoje && String(rec.until || next) < hoje;
}

/* O que o email diz de um planeado em atraso: a descrição (o rótulo do
   movimento, o nome do planeado, ou a categoria), a data em que devia ter
   acontecido (o next), o montante e o sentido do dinheiro.
   Recebe: rec — o planeado (objeto); casa — o nome a mostrar da casa;
   casaId — o id da casa ('' para um «Sem imóvel»), que agrupa no email.
   Devolve: { casa, casaId, descricao, data, montante, fluxo }. */
function linhaDoAtraso(rec, casa, casaId) {
  const tx = (rec && typeof rec.tx === 'object' && rec.tx) || {};
  const descricao = String(tx.label || '').trim() || String(rec.name || '').trim() ||
    String(tx.category || '').trim() || 'Movimento planeado';
  const fluxo = Object.prototype.hasOwnProperty.call(FLUXO, tx.kind) ? FLUXO[tx.kind] : 'none';
  return { casa, casaId, descricao, data: rec.next, montante: Math.abs(Number(tx.amount) || 0), fluxo };
}

/* Um JSON da base interpretado, sem lançar.
   Recebe: texto — o JSON guardado.
   Devolve: o objeto, ou null quando não é um objeto. */
function lerJson(texto) {
  try { const o = JSON.parse(texto); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
}

/* As linhas de uma consulta, numa só ida à base.
   Recebe: env — o ambiente (DB); sql — a consulta; args — os valores dos «?».
   Devolve: promessa das linhas (array). */
async function linhas(env, sql, ...args) {
  return (await env.DB.prepare(sql).bind(...args).all()).results || [];
}

/* Os planeados em atraso que cada pessoa pode ver, sem olhar ainda para as
   preferências: das casas vivas aos participantes e aos colaboradores pelo
   cargo, e os «Sem imóvel» à conta dona. Cinco consultas, sejam quantas
   forem as casas: os planeados (com o dono e o nome da casa), e depois as
   partilhas, os grupos e os cargos de TODAS as casas com atrasos de uma vez
   (os ids num só parâmetro, json_each), e os «Sem imóvel». Quem vê a mesma
   casa por dois caminhos (partilha e grupo, ou um cargo que também é
   participante) recebe cada atraso uma vez só.
   Recebe: env — o ambiente (DB); hoje — 'AAAA-MM-DD'.
   Devolve: promessa de um Map userId → Map chave → { casaId, recId, data,
   linha } (a chave é casaId + recId + data; a linha a de linhaDoAtraso). */
export async function atrasosPorPessoa(env, hoje) {
  const porPessoa = new Map();
  const juntar = (uid, casaId, rec, nomeDaCasa) => {
    if (!uid) return;
    if (!porPessoa.has(uid)) porPessoa.set(uid, new Map());
    const chave = casaId + '\u0000' + rec.id + '\u0000' + rec.next;
    porPessoa.get(uid).set(chave, { casaId, recId: rec.id, data: rec.next, linha: linhaDoAtraso(rec, nomeDaCasa, casaId) });
  };

  // 1. os planeados das casas vivas (o next em SQL só poupa o que não pode estar em atraso)
  const casas = new Map();   // houseId → { nome, dono, recs: [], participantes: Set, cargos: Map }
  for (const row of await linhas(env,
    `SELECT r.house_id, r.id, r.data, h.owner_id, h.data AS casa
       FROM records r JOIN houses h ON h.id = r.house_id AND h.deleted = 0
      WHERE r.kind = ? AND r.deleted = 0 AND ${nextSql('r.data')} <= ?`, KIND_PLANEADO, hoje)) {
    const rec = lerJson(row.data);
    if (!emAtraso(rec, hoje)) continue;
    rec.id = row.id;   // a chave da base manda: é ela que identifica o planeado
    if (!casas.has(row.house_id)) {
      const c = lerJson(row.casa) || {};
      casas.set(row.house_id, {
        nome: String(c.name || '').trim() || 'Imóvel sem nome',
        recs: [], participantes: new Set([row.owner_id]), cargos: new Map(),
      });
    }
    casas.get(row.house_id).recs.push(rec);
  }

  if (casas.size) {
    const ids = JSON.stringify([...casas.keys()]);
    // 2. as partilhas aceites: a ponta da ligação que não é quem partilhou (participantsOf)
    for (const s of await linhas(env,
      `SELECT s.house_id, s.owner_id, c.requester_id, c.target_id
         FROM shares s JOIN connections c ON c.id = s.connection_id
        WHERE c.status = 'accepted' AND s.house_id IN (SELECT value FROM json_each(?))`, ids)) {
      casas.get(s.house_id).participantes.add(s.requester_id === s.owner_id ? s.target_id : s.requester_id);
    }
    // 3. os membros dos grupos partilhados vivos que as contêm, menos quem saiu da casa
    for (const m of await linhas(env,
      `SELECT gh.house_id, m.user_id FROM shared_group_houses gh
         JOIN shared_groups g ON g.id = gh.group_id AND g.deleted = 0
         JOIN shared_group_members m ON m.group_id = gh.group_id
        WHERE gh.house_id IN (SELECT value FROM json_each(?)) AND ${SAIU_DA_CASA}`, ids)) {
      casas.get(m.house_id).participantes.add(m.user_id);
    }
    /* 4. os colaboradores, com o cargo que o dono lhes deu (como o
       casasDeColaborador: cargo vivo, casa viva, cargo do dono da casa). Um
       cargo com duas linhas na mesma casa (dois cargos do mesmo dono) vê o
       que um deles deixa ver: juntam-se as permissões */
    for (const c of await linhas(env,
      `SELECT ch.house_id, c.user_id, r.perms
         FROM collaborators c
         JOIN collaborator_houses ch ON ch.collaborator_id = c.id
         JOIN roles r ON r.id = c.role_id
         JOIN houses h ON h.id = ch.house_id
        WHERE r.deleted = 0 AND h.deleted = 0 AND h.owner_id = c.owner_id
          AND ch.house_id IN (SELECT value FROM json_each(?))`, ids)) {
      const perms = normalizarPerms(lerJson(c.perms) || []);
      const cargos = casas.get(c.house_id).cargos;
      const antes = cargos.get(c.user_id) || { tudo: false, contratos: false };
      cargos.set(c.user_id, {
        tudo: antes.tudo || perms.includes('rec.view'),
        contratos: antes.contratos || perms.includes('contract.view'),
      });
    }
    for (const [houseId, casa] of casas) {
      for (const uid of casa.participantes) casa.recs.forEach((rec) => juntar(uid, houseId, rec, casa.nome));
      for (const [uid, ver] of casa.cargos) {
        if (casa.participantes.has(uid)) continue;   // a precedência: participante ganha ao cargo
        casa.recs.forEach((rec) => {
          const deContrato = !!(rec.tx && typeof rec.tx === 'object' && rec.tx.contractId);
          if (ver.tudo || (ver.contratos && deContrato)) juntar(uid, houseId, rec, casa.nome);
        });
      }
    }
  }

  // 5. os «Sem imóvel»: só a conta dona deles
  for (const row of await linhas(env,
    `SELECT user_id, id, data FROM user_records
      WHERE kind = ? AND deleted = 0 AND ${nextSql('data')} <= ?`, KIND_PLANEADO, hoje)) {
    const rec = lerJson(row.data);
    if (!emAtraso(rec, hoje)) continue;
    rec.id = row.id;
    juntar(row.user_id, '', rec, SEM_IMOVEL);
  }
  return porPessoa;
}

/* Das pessoas com atrasos, as que recebem email: conta viva com o email
   confirmado (migração 0027: um email por confirmar pode ser de outra pessoa,
   ou nem existir), os avisos ligados, o serviço dos Planeados ligado (o fecho conta: sem os
   Movimentos não há Planeados) e, em produção (sem ENV_NAME), sem as contas
   de teste — fora de produção entram, e o enviarEmail desvia o correio delas
   para o dev que as criou. Duas consultas, com os ids num só parâmetro.
   Recebe: env — o ambiente (DB, ENV_NAME); ids — os ids das pessoas.
   Devolve: promessa de um Map userId → email, só com quem recebe. */
async function destinatarios(env, ids) {
  const out = new Map();
  if (!ids.length) return out;
  const lista = JSON.stringify(ids);
  const contas = await linhas(env,
    `SELECT id, email, test_owner FROM users
      WHERE deleted_at IS NULL AND avisos_email = 1 AND email_verified_at IS NOT NULL
        AND id IN (SELECT value FROM json_each(?))`, lista);
  const desligados = new Map();
  for (const s of await linhas(env,
    'SELECT user_id, service FROM user_services WHERE enabled = 0 AND user_id IN (SELECT value FROM json_each(?))', lista)) {
    if (!desligados.has(s.user_id)) desligados.set(s.user_id, []);
    desligados.get(s.user_id).push(s.service);
  }
  for (const u of contas) {
    if (!u.email) continue;
    if (!env.ENV_NAME && u.test_owner) continue;
    if (fechoDesligados(desligados.get(u.id) || []).includes('recurring')) continue;
    out.set(u.id, String(u.email));
  }
  return out;
}

/* A ordem do email: as casas pelo nome (o «Sem imóvel» no fim; duas casas
   com o mesmo nome ficam cada uma no seu grupo), e em cada casa do atraso
   mais antigo para o mais recente.
   Recebe: a, b — duas linhas de linhaDoAtraso.
   Devolve: o número da comparação. */
function ordemDoEmail(a, b) {
  const sa = a.casaId === '' ? 1 : 0, sb = b.casaId === '' ? 1 : 0;
  if (sa !== sb) return sa - sb;
  return a.casa.localeCompare(b.casa, 'pt') || a.casaId.localeCompare(b.casaId) ||
    String(a.data).localeCompare(String(b.data)) ||
    a.descricao.localeCompare(b.descricao, 'pt');
}

/* Um passo do cron de hora a hora: encontra os atrasos, manda o resumo a
   quem tem algum novo e ainda não recebeu nenhum hoje (dia de Lisboa), no
   máximo MAX_EMAILS_POR_EXECUCAO pessoas — as outras ficam para a hora
   seguinte —, grava os novos de quem o Resend aceitou (um INSERT por email)
   e poda as linhas com mais de 400 dias. Uma pessoa que falha não trava as
   outras. Entre dois emails espera um pouco: o Resend aceita poucos pedidos
   por segundo, e um 429 era um email perdido até à hora seguinte. Não olha
   à hora: quem chama decide (horaDosAvisos). Nunca lança.
   Recebe: env — o ambiente do worker; agora (opcional) — ms de época
   (Date.now() por omissão), que dá o «hoje» em Lisboa e a hora gravada;
   opcoes (opcional) — { pausa: ms entre dois emails (PAUSA_ENTRE_EMAILS_MS
   por omissão) }.
   Devolve: promessa de { ok, pessoas, enviados, restantes, detalhe } —
   pessoas é a quantas se tentou mandar, enviados quantos emails o Resend
   aceitou, restantes quantas ficaram para a hora seguinte, e detalhe a
   linha do op_log; ok é falso quando alguma coisa falhou (o motivo vai no
   detalhe). Sem RESEND_API_KEY não é uma falha: nada se envia nem se grava,
   e o detalhe di-lo. */
export async function resumoDosAtrasos(env, agora, opcoes) {
  const t = agora == null ? Date.now() : agora;
  const pausa = opcoes && opcoes.pausa != null ? opcoes.pausa : PAUSA_ENTRE_EMAILS_MS;
  let pessoas = 0, enviados = 0, restantes = 0, semChave = false;
  const falhas = [];
  try {
    const hoje = hojeEmLisboa(t);
    const porPessoa = await atrasosPorPessoa(env, hoje);
    const quem = await destinatarios(env, [...porPessoa.keys()]);
    // o que já foi num email a estas pessoas, e quem já recebeu um hoje
    const ja = new Set();
    const ultimo = new Map();
    if (quem.size) {
      for (const r of await linhas(env,
        'SELECT user_id, casa, rec_id, data, enviado FROM avisos_atraso WHERE user_id IN (SELECT value FROM json_each(?))',
        JSON.stringify([...quem.keys()]))) {
        ja.add(r.user_id + '\u0000' + r.casa + '\u0000' + r.rec_id + '\u0000' + r.data);
        if (!(ultimo.get(r.user_id) >= r.enviado)) ultimo.set(r.user_id, r.enviado);
      }
    }
    const fila = [];
    for (const [uid, email] of [...quem].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
      if (ultimo.has(uid) && hojeEmLisboa(ultimo.get(uid)) === hoje) continue;   // um por dia
      const atrasos = [...porPessoa.get(uid).values()];
      const foi = (a) => ja.has(uid + '\u0000' + a.casaId + '\u0000' + a.recId + '\u0000' + a.data);
      const novos = atrasos.filter((a) => !foi(a));
      if (novos.length) fila.push({ uid, email, novos, continuam: atrasos.filter(foi) });
    }
    restantes = Math.max(0, fila.length - MAX_EMAILS_POR_EXECUCAO);
    for (const p of fila.slice(0, MAX_EMAILS_POR_EXECUCAO)) {
      try {
        if (pessoas++ && pausa > 0) await new Promise((fim) => setTimeout(fim, pausa));
        const r = await emailAtrasos(env, p.email,
          p.novos.map((a) => a.linha).sort(ordemDoEmail), p.continuam.map((a) => a.linha).sort(ordemDoEmail));
        if (!r.enviado) {
          if (r.motivo === 'sem RESEND_API_KEY') semChave = true;
          else falhas.push(r.motivo || 'não enviado');
          continue;
        }
        enviados++;
        // os novos numa escrita só, sejam quantos forem (as linhas num parâmetro em JSON)
        await env.DB.prepare(
          `INSERT OR IGNORE INTO avisos_atraso (user_id, casa, rec_id, data, enviado)
           SELECT ?1, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?2
             FROM json_each(?3)`
        ).bind(p.uid, t, JSON.stringify(p.novos.map((a) => [a.casaId, a.recId, a.data]))).run();
      } catch (e) {
        falhas.push(String((e && e.message) || e));
      }
    }
    await env.DB.prepare('DELETE FROM avisos_atraso WHERE enviado < ?').bind(t - VIDA_DO_AVISO_MS).run();
  } catch (e) {
    falhas.push(String((e && e.message) || e));
  }
  const ok = !falhas.length;
  const detalhe = pessoas + (pessoas === 1 ? ' pessoa, ' : ' pessoas, ') +
    enviados + (enviados === 1 ? ' email enviado' : ' emails enviados') +
    (restantes ? ', ' + restantes + ' para a próxima hora' : '') +
    (semChave ? ' (sem RESEND_API_KEY)' : '') +
    (ok ? '' : '; ' + falhas.length + (falhas.length === 1 ? ' falha: ' : ' falhas: ') + falhas[0]);
  return { ok, pessoas, enviados, restantes, detalhe };
}
