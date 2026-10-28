// Tickets de QA do ambiente de desenvolvimento: quem testa a app escreve-os
// no próprio ecrã (web/cloud/qa.js) e o Claude lê-os com scripts/qa.mjs.
// Em produção (sem env.ENV_NAME) nenhuma destas rotas existe.
//
// Vivem na tabela qa_tickets (migrations/0023_qa_tickets.sql), à parte dos
// pedidos de ajuda: não são suporte, não vão ao Discord. Todas as contas do
// dev veem e mexem em todos os tickets (a decisão do Martinho, 2026-10-28) —
// o user_id é só quem o escreveu. A captura de ecrã vive no R2 em qa/<id>.
import { json, err, body, badId, now, CSP_ANEXO } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';

// As gravidades que um ticket pode ter; qualquer outra coisa fica sem nenhuma.
const GRAVIDADES = ['bloqueia', 'incomoda', 'detalhe'];
// A descrição, depois de aparada, tem de 1 a MAX_TEXTO caracteres.
const MAX_TEXTO = 4000;
// O contexto guarda-se em JSON até 16 KB (em bytes de UTF-8).
const MAX_CONTEXTO = 16 * 1024;
// A captura de ecrã até 3 MB — o cliente já a encolhe antes de subir.
const MAX_IMAGEM = 3 * 1024 * 1024;
// Quantos tickets um GET devolve, no máximo.
const TETO_LISTA = 200;
// Quanto tempo um ticket removido espera pelo Anular antes de se apagar de vez.
const GUARDA_REMOVIDO = 24 * 3600 * 1000;
// Quantos removidos se apagam de cada passagem (o resto fica para a seguinte).
const LOTE_LIMPEZA = 50;
// Tickets novos por pessoa e por hora.
const TETO_HORA = 30;

// Os tipos de imagem aceites, cada um com a assinatura dos primeiros bytes.
const TIPOS_IMAGEM = ['image/png', 'image/jpeg', 'image/webp'];

/* A resposta ao ticket que não existe, que foi removido ou cujo id nem tem
   forma de id — os três respondem igual.
   Recebe: nada.
   Devolve: a Response 404 «Ticket não encontrado.». */
function naoExiste() {
  return err(404, 'Ticket não encontrado.');
}

/* Rotas dos tickets de QA (/api/qa…), só fora de produção. Sem
   env.ENV_NAME respondem 404 antes de lerem o corpo, como se não existissem.
   POST /api/qa cria; GET /api/qa lista; DELETE /api/qa/:id remove (brando,
   para o Anular); POST …/repor desfaz a remoção; POST …/reabrir volta a pôr
   um resolvido nos abertos; PUT e GET …/imagem gravam e servem a captura.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   ctx, path, method, seg e o utilizador em c.me).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o encaminhador tentar a seguinte. */
export async function rotasQa(c) {
  const { env, request, method, seg, me } = c;
  if (seg[1] !== 'qa') return;
  if (!env.ENV_NAME) return err(404, 'Rota desconhecida.');

  if (seg.length === 2) {
    if (method === 'POST') return criarTicket(env, request, me);
    if (method === 'GET') return listarTickets(env);
    return err(404, 'Rota desconhecida.');
  }

  const id = seg[2];
  if (badId(id) || seg.length > 4) return naoExiste();

  if (seg.length === 3 && method === 'DELETE') return removerTicket(env, id);
  if (seg[3] === 'repor' && method === 'POST') return reporTicket(env, id);
  if (seg[3] === 'reabrir' && method === 'POST') return reabrirTicket(env, id);
  if (seg[3] === 'imagem' && method === 'PUT') return gravarImagem(env, request, id);
  if (seg[3] === 'imagem' && method === 'GET') return servirImagem(env, id);
  return err(404, 'Rota desconhecida.');
}

/* POST /api/qa: grava um ticket novo de quem tem a sessão. A descrição é
   aparada e tem de ter de 1 a 4000 caracteres; uma gravidade fora das três
   fica nula; o contexto, se for um objeto, guarda-se em JSON cortado aos
   16 KB (contextoParaGuardar). Trava aos 30 por hora por pessoa e leva de
   passagem os removidos há mais de 24 h.
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES);
   request — o pedido, com o corpo {body, severity?, context}; me — o
   utilizador com sessão.
   Devolve: promessa da Response — 201 {ok, id}, 400 sem descrição ou com
   descrição longa de mais, 429 com o travão. */
async function criarTicket(env, request, me) {
  if (!(await rateLimit(env, 'qa:' + me.id, TETO_HORA, 3600))) {
    return err(429, 'Já enviaste muitos tickets seguidos. Espera um pouco.');
  }
  const b = await body(request);
  const texto = b && typeof b.body === 'string' ? b.body.trim() : '';
  if (!texto) return err(400, 'Escreve o que viste.');
  if (texto.length > MAX_TEXTO) {
    return err(400, 'A descrição passa dos ' + MAX_TEXTO + ' caracteres. Encurta-a.');
  }
  const gravidade = GRAVIDADES.includes(b.severity) ? b.severity : null;
  const contexto = contextoParaGuardar(b.context);
  const discord = await discordDoAutor(env, me);
  await limparRemovidos(env);
  const id = crypto.randomUUID(), t = now();
  await env.DB.prepare(
    `INSERT INTO qa_tickets (id, user_id, discord_id, discord_nome, body, severity, context, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'aberto', ?, ?)`
  ).bind(id, me.id, discord.id, discord.nome, texto, gravidade, contexto, t, t).run();
  return json({ ok: true, id }, 201);
}

/* A conta do Discord por trás de uma conta de teste: quem pediu a ligação
   do /test (users.test_owner, o id de Discord) e o nome que essa ligação
   trouxe (no KV, teste.js:chaveNomeDev). É ela o autor do ticket, e não a
   conta de teste, que o /test limpar apaga. Uma conta normal não tem.
   Recebe: env — o ambiente do worker (D1 em env.DB, KV em env.SESSIONS);
   me — o utilizador com sessão.
   Devolve: promessa de {id, nome} — os dois null numa conta que não é de
   teste; o nome null quando a ligação não o trouxe. */
async function discordDoAutor(env, me) {
  const r = await env.DB.prepare('SELECT test_owner FROM users WHERE id = ?').bind(me.id).first();
  const id = r && r.test_owner ? String(r.test_owner) : null;
  if (!id) return { id: null, nome: null };
  let nome = null;
  try {
    const { chaveNomeDev } = await import('../teste.js');
    nome = (await env.SESSIONS.get(chaveNomeDev(id))) || null;
  } catch (e) { nome = null; }
  return { id, nome };
}

/* O contexto de um ticket pronto a gravar: o objeto em JSON até 16 KB.
   Quando não cabe, corta primeiro o rasto pelos passos mais antigos (o rasto
   cresce pelo fim: web/cloud/nucleo.js empurra o novo e larga o primeiro) e,
   se mesmo sem rasto não couber, larga as chaves de topo maiores até caber.
   Um contexto cortado leva cortado: true, para quem o lê saber que falta
   algo — nunca se inventa o que lá não vinha.
   Recebe: v — o context do corpo do pedido (devia ser um objeto simples).
   Devolve: o JSON (texto) a gravar, ou null quando não veio um objeto (ou
   quando nem se deixa medir: um objeto aninhado sem fim rebenta o
   JSON.stringify, e isso não pode deitar abaixo o ticket). */
export function contextoParaGuardar(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  try {
    return cortarContexto({ ...v });
  } catch (e) {
    return null;
  }
}

/* O corte de contextoParaGuardar, sobre uma cópia rasa do objeto (a de quem
   chamou não muda).
   Recebe: o — a cópia do contexto, que este corte altera.
   Devolve: o JSON (texto) com até 16 KB. */
function cortarContexto(o) {
  let s = JSON.stringify(o);
  if (bytes(s) <= MAX_CONTEXTO) return s;
  o.cortado = true;
  if (Array.isArray(o.rasto)) {
    // os passos que cabem, do mais recente para trás, no espaço que sobra
    const livre = MAX_CONTEXTO - bytes(JSON.stringify({ ...o, rasto: [] }));
    const fica = [];
    let usado = 0;
    for (let i = o.rasto.length - 1; i >= 0; i--) {
      const n = bytes(JSON.stringify(o.rasto[i] === undefined ? null : o.rasto[i])) + 1;
      if (usado + n > livre) break;
      usado += n;
      fica.push(o.rasto[i]);
    }
    o.rasto = fica.reverse();
    s = JSON.stringify(o);
    if (bytes(s) <= MAX_CONTEXTO) return s;
    delete o.rasto;
  }
  // sem rasto e ainda grande: saem as chaves maiores, uma a uma. O tamanho
  // vai-se descontando (a chave, o valor, as aspas, os dois pontos e a
  // vírgula) e só se volta a medir o todo quando a conta diz que já cabe —
  // um objeto com milhares de chaves não pode custar milhares de medições.
  let total = bytes(JSON.stringify(o));
  const chaves = Object.keys(o).filter((k) => k !== 'cortado')
    .map((k) => ({ k, n: bytes(JSON.stringify(o[k]) || '') + bytes(JSON.stringify(k)) + 2 }))
    .sort((a, z) => z.n - a.n);
  for (const { k, n } of chaves) {
    delete o[k];
    total -= n;
    if (total > MAX_CONTEXTO) continue;
    s = JSON.stringify(o);
    if (bytes(s) <= MAX_CONTEXTO) return s;
    total = bytes(s);
  }
  return JSON.stringify({ cortado: true });
}

/* Quantos bytes um texto ocupa em UTF-8 — é assim que se mede o teto.
   Recebe: s — o texto.
   Devolve: o número de bytes. */
function bytes(s) {
  return new TextEncoder().encode(s).length;
}

/* GET /api/qa: os tickets de toda a gente, sem os removidos — os abertos
   primeiro (os mais recentes à frente), depois os resolvidos (os resolvidos
   há menos tempo à frente), até 200. Cada um com o contexto já como objeto,
   imagem como sim/não e o autor (id, nome e email). Leva de passagem os
   removidos há mais de 24 h.
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES).
   Devolve: promessa da Response {tickets: [...]}. */
async function listarTickets(env) {
  await limparRemovidos(env);
  const rows = (
    await env.DB.prepare(
      `SELECT q.id, q.body, q.severity, q.context, q.image_key, q.status, q.resolution,
              q.resolved_at, q.created_at, q.updated_at, q.user_id, q.discord_id, q.discord_nome, u.name, u.email
         FROM qa_tickets q LEFT JOIN users u ON u.id = q.user_id
        WHERE q.removed_at IS NULL
        ORDER BY CASE WHEN q.status = 'aberto' THEN 0 ELSE 1 END,
                 CASE WHEN q.status = 'aberto' THEN q.created_at ELSE COALESCE(q.resolved_at, q.updated_at) END DESC,
                 q.created_at DESC
        LIMIT ?`
    ).bind(TETO_LISTA).all()
  ).results;
  return json({ tickets: rows.map(ticketParaFora) });
}

/* Uma linha de qa_tickets (com o nome e o email do autor) na forma que a
   app e o scripts/qa.mjs leem.
   Recebe: r — a linha do SELECT de listarTickets.
   Devolve: o ticket {id, body, severity, context (objeto ou null), imagem
   (bool), status, resolution, resolved_at, created_at, updated_at, autor}.
   O autor leva discord: {id, nome} quando o ticket veio de uma conta de
   teste (a conta do Discord que pediu o /test), e null nas outras. */
function ticketParaFora(r) {
  let contexto = null;
  try { contexto = r.context ? JSON.parse(r.context) : null; } catch (e) { contexto = null; }
  return {
    id: r.id,
    body: r.body,
    severity: r.severity || null,
    context: contexto,
    imagem: !!r.image_key,
    status: r.status,
    resolution: r.resolution || null,
    resolved_at: r.resolved_at || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    autor: {
      id: r.user_id, nome: r.name || '', email: r.email || '',
      discord: r.discord_id ? { id: r.discord_id, nome: r.discord_nome || '' } : null,
    },
  };
}

/* Apaga de vez os tickets removidos há mais de 24 h, com a captura de cada
   um no R2 — primeiro o R2, depois a linha: se o R2 falhar, a linha fica e a
   próxima passagem tenta de novo. Corre de passagem no POST e no GET; uma
   falha aqui nunca deita abaixo o pedido que a trouxe.
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES).
   Devolve: promessa de quantos tickets saíram (0 também quando falha). */
async function limparRemovidos(env) {
  try {
    const limite = now() - GUARDA_REMOVIDO;
    const velhos = (
      await env.DB.prepare(
        `SELECT id, image_key FROM qa_tickets
          WHERE removed_at IS NOT NULL AND removed_at < ? LIMIT ?`
      ).bind(limite, LOTE_LIMPEZA).all()
    ).results;
    if (!velhos.length) return 0;
    const chaves = velhos.map((r) => r.image_key).filter(Boolean);
    if (chaves.length) await env.FILES.delete(chaves);
    const ids = velhos.map((r) => r.id);
    // os ? são um por id; os valores vão todos pelo bind
    const r = await env.DB.prepare(
      `DELETE FROM qa_tickets WHERE removed_at < ? AND id IN (${ids.map(() => '?').join(', ')})`
    ).bind(limite, ...ids).run();
    return (r && r.meta && r.meta.changes) || 0;
  } catch (e) {
    return 0;
  }
}

/* DELETE /api/qa/:id: remoção branda — fica com removed_at, sai da lista e
   espera 24 h pelo Anular (reporTicket) antes de se apagar de vez.
   Recebe: env — o ambiente do worker (D1 em env.DB); id — o id do ticket.
   Devolve: promessa da Response {ok}, ou 404 se não existe ou já foi removido. */
async function removerTicket(env, id) {
  const t = now();
  const r = await env.DB.prepare(
    'UPDATE qa_tickets SET removed_at = ?, updated_at = ? WHERE id = ? AND removed_at IS NULL'
  ).bind(t, t, id).run();
  if (!r.meta.changes) return naoExiste();
  return json({ ok: true });
}

/* POST /api/qa/:id/repor: o Anular de uma remoção — o ticket volta à lista
   como estava. Um removido há mais de 24 h já não volta (é como se tivesse
   sido apagado, mesmo que a limpeza ainda não tenha passado); um que nunca
   foi removido responde ok sem mudar nada.
   Recebe: env — o ambiente do worker (D1 em env.DB); id — o id do ticket.
   Devolve: promessa da Response {ok}, ou 404 se não existe. */
async function reporTicket(env, id) {
  const t = now();
  const r = await env.DB.prepare(
    `UPDATE qa_tickets SET removed_at = NULL, updated_at = ?
      WHERE id = ? AND (removed_at IS NULL OR removed_at >= ?)`
  ).bind(t, id, t - GUARDA_REMOVIDO).run();
  if (!r.meta.changes) return naoExiste();
  return json({ ok: true });
}

/* POST /api/qa/:id/reabrir: um resolvido volta aos abertos. A resolution
   fica — o próximo a pegar no ticket vê o que já se tentou (a app mostra-a
   como «Resolução anterior»); só o resolved_at sai.
   Recebe: env — o ambiente do worker (D1 em env.DB); id — o id do ticket.
   Devolve: promessa da Response {ok}, ou 404 se não existe ou foi removido. */
async function reabrirTicket(env, id) {
  const r = await env.DB.prepare(
    `UPDATE qa_tickets SET status = 'aberto', resolved_at = NULL, updated_at = ?
      WHERE id = ? AND removed_at IS NULL`
  ).bind(now(), id).run();
  if (!r.meta.changes) return naoExiste();
  return json({ ok: true });
}

/* PUT /api/qa/:id/imagem: a captura de ecrã de um ticket, com o corpo em
   bytes. Só PNG, JPEG ou WebP — pelo Content-Type e pelos próprios bytes
   (tipoDaImagem), para nunca se servir outra coisa com cara de imagem — e
   até 3 MB. Grava no R2 em qa/<id> (uma segunda substitui a primeira) e só
   depois marca o image_key na linha.
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES);
   request — o pedido, com os bytes no corpo; id — o id do ticket.
   Devolve: promessa da Response {ok}, ou 404 (ticket), 415 (tipo), 413
   (tamanho) ou 400 (vazia). */
async function gravarImagem(env, request, id) {
  const linha = await env.DB.prepare('SELECT id FROM qa_tickets WHERE id = ? AND removed_at IS NULL').bind(id).first();
  if (!linha) return naoExiste();
  const dito = String(request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!TIPOS_IMAGEM.includes(dito)) return err(415, 'A captura tem de ser uma imagem PNG, JPEG ou WebP.');
  const tamanhoDito = Number(request.headers.get('Content-Length') || 0);
  if (tamanhoDito > MAX_IMAGEM) return err(413, 'A captura é grande de mais (máx. 3 MB).');
  const corpo = await lerAte(request, MAX_IMAGEM);
  if (!corpo) return err(413, 'A captura é grande de mais (máx. 3 MB).');
  if (!corpo.byteLength) return err(400, 'A captura chegou vazia.');
  const tipo = tipoDaImagem(corpo);
  if (!tipo) return err(415, 'A captura tem de ser uma imagem PNG, JPEG ou WebP.');
  const chave = 'qa/' + id;
  await env.FILES.put(chave, corpo, { httpMetadata: { contentType: tipo } });
  await env.DB.prepare('UPDATE qa_tickets SET image_key = ?, updated_at = ? WHERE id = ?')
    .bind(chave, now(), id).run();
  return json({ ok: true });
}

/* Lê o corpo de um pedido até um teto, aos bocados, e desiste logo que o
   passa — um corpo sem Content-Length (ou com um que mente) não chega a
   encher a memória do worker.
   Recebe: request — o pedido; teto — o máximo de bytes.
   Devolve: promessa dos bytes (Uint8Array, vazio sem corpo), ou null quando
   passam do teto. */
async function lerAte(request, teto) {
  if (!request.body) return new Uint8Array(0);
  const leitor = request.body.getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > teto) {
      try { await leitor.cancel(); } catch (e) { /* já fechado */ }
      return null;
    }
    partes.push(value);
  }
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.byteLength; }
  return out;
}

/* GET /api/qa/:id/imagem: os bytes da captura, com o tipo lido dos próprios
   bytes, sem cache (private, no-store) e na caixa de areia dos anexos
   (CSP_ANEXO, nosniff).
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES); id —
   o id do ticket.
   Devolve: promessa da Response com a imagem, ou 404 sem ticket ou sem imagem. */
async function servirImagem(env, id) {
  const linha = await env.DB.prepare(
    'SELECT image_key FROM qa_tickets WHERE id = ? AND removed_at IS NULL'
  ).bind(id).first();
  if (!linha || !linha.image_key) return err(404, 'Este ticket não tem captura.');
  const obj = await env.FILES.get(linha.image_key);
  if (!obj) return err(404, 'Este ticket não tem captura.');
  const corpo = new Uint8Array(await new Response(obj.body).arrayBuffer());
  return new Response(corpo, {
    headers: {
      'Content-Type': tipoDaImagem(corpo) || 'application/octet-stream',
      'Content-Length': String(corpo.byteLength),
      'Cache-Control': 'private, no-store',
      // o index.js deixa passar este valor exato pelo harden (PODE_APERTAR)
      'Content-Security-Policy': CSP_ANEXO,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/* O tipo de uma imagem pelos primeiros bytes (a assinatura), sem confiar no
   que o pedido diz: PNG (89 50 4E 47 0D 0A 1A 0A), JPEG (FF D8 FF) ou WebP
   (RIFF….WEBP).
   Recebe: b — os bytes (Uint8Array).
   Devolve: 'image/png', 'image/jpeg' ou 'image/webp', ou null se não for
   nenhuma delas. */
export function tipoDaImagem(b) {
  const tem = (bs, de) => bs.every((x, i) => b[(de || 0) + i] === x);
  if (b.length >= 8 && tem([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (b.length >= 3 && tem([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (b.length >= 12 && tem([0x52, 0x49, 0x46, 0x46]) && tem([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}
