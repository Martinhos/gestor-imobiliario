/* O rasto das pessoas
   -------------------
   Com o «Aceitar» (a faixa da montra, a pergunta da app ou a linha das
   Definições), cada toque na app e na montra fica guardado debaixo de um
   pseudónimo — o pid, 'P-' + 6 caracteres aleatórios, nunca derivado do id
   da conta —, para o back office seguir uma pessoa sem lhe ver o nome. Só o
   ONDE (ecrã, janela, um descritor do elemento, a posição em permilagem),
   nunca O QUÊ: os campos de texto cortam-se aos tamanhos do contrato e os
   tipos e campos desconhecidos deitam-se fora.

   Um só consentimento para a montra e para a app, e a última escolha ganha.
   O aparelho guarda-o em dois cookies HttpOnly que só este ficheiro escreve
   e lê: rd_escolha (sim.<ms> | nao.<ms>, a escolha e a hora dela; o valor
   antigo sem hora lê-se como hora 0) e, só com sim, rd_vis (o id do
   aparelho, que aponta para um pid em rasto_visitantes). A conta guarda-o em
   users.rasto_escolha, com a hora em rasto_escolha_at; quando a app abre, a
   mais recente das duas passa para a outra (sincronizarEscolha). Recusar
   apaga logo o que se guardou: o pid do aparelho e, com sessão, o da conta,
   com os eventos (apagarAoRecusar). Em produção (sem ENV_NAME) e nos três
   hosts dela os cookies levam Domain=rendorium.com, para a montra
   (rendorium.com) e a app (app.rendorium.com) partilharem a escolha; em
   qualquer outro sítio ficam só nesse host — um cookie do dev nunca chega à
   produção, e o wrangler dev, que reescreve o host do pedido para o da
   primeira rota, não os põe no domínio de produção.

   Ao entrar (criar conta, palavra-passe, Google, a ligação do /test) com um
   aparelho que disse sim, o visitante liga-se à conta: o pid dele passa a
   ser dela, ou, se ela já tinha um, os eventos juntam-se ao dela
   (ligarAoEntrar). Uma falha aqui nunca parte uma entrada.

   Os eventos vivem 90 dias (podarRasto, no cron diário) e saem com a conta
   (apagarRastoDaConta, no lote do lib/acesso.js:purgeAccount). Quem os vê no
   back office decide-o podeVerRasto: master e admin todas as pessoas; o
   suporte só quem lhe escreveu um pedido. As contas de teste ficam de fora em
   produção. */

import { now, clientIp } from './http.js';
import { rateLimit } from './limites.js';
import { catsDe, comoLista } from './papeis.js';

// Quantos dias vive um evento (a poda) e quantos se aceitam num lote.
export const DIAS_DO_RASTO = 90;
export const MAX_EVENTOS = 50;
// O corpo de um lote: 50 eventos cortados aos tamanhos cabem folgados aqui.
const MAX_CORPO = 64 * 1024;
// O cookie dura 180 dias: o consentimento pergunta-se de novo ao fim deles.
const MAX_AGE = 180 * 86400;
const DIA = 86400000;

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PID_RE = /^P-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const SESSAO_RE = /^s-[a-z0-9]{10}$/;

export const TIPOS = ['toque', 'ecra', 'janela-abre', 'janela-fecha', 'guardar', 'erro-campo', 'erro', 'pagina', 'secao'];
export const SINAIS = ['em-vao', 'repetido', 'vai-e-volta', 'desistencia', 'erro-campo'];

// Os únicos hosts em que os cookies levam Domain (os de produção).
const HOSTS_DE_PRODUCAO = ['rendorium.com', 'www.rendorium.com', 'app.rendorium.com'];

/* ------------------------------ os cookies ------------------------------ */

/* O Domain dos cookies do rasto: o domínio raiz só em produção a sério (sem
   ENV_NAME, como o resto da casa a distingue) E num dos três hosts dela. Não
   chega o host: o wrangler dev reescreve-o para app.rendorium.com (a primeira
   rota do wrangler.toml), e um browser em 127.0.0.1 recusava o cookie.
   Recebe: host — o hostname do pedido (url.hostname); env — o ambiente do worker.
   Devolve: 'rendorium.com', ou null (cookie só deste host). */
export function dominioDoCookie(host, env) {
  if (!env || env.ENV_NAME) return null;
  return HOSTS_DE_PRODUCAO.indexOf(String(host || '').toLowerCase()) > -1 ? 'rendorium.com' : null;
}

/* O Set-Cookie de um dos dois cookies do rasto: HttpOnly, Secure,
   SameSite=Lax, Path=/, 180 dias — ou Max-Age=0 para o apagar —, e o Domain
   só em produção (dominioDoCookie).
   Recebe: nome — 'rd_escolha' ou 'rd_vis'; valor — o valor ('' apaga); host
   — o hostname do pedido; env — o ambiente do worker.
   Devolve: o valor do cabeçalho Set-Cookie (texto). */
export function cookieDoRasto(nome, valor, host, env) {
  const partes = [nome + '=' + (valor || ''), 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax',
    'Max-Age=' + (valor ? MAX_AGE : 0)];
  const d = dominioDoCookie(host, env);
  if (d) partes.push('Domain=' + d);
  return partes.join('; ');
}

/* O valor do rd_escolha: a escolha e a hora dela, «sim.1761720000000».
   Recebe: escolha — 'sim' ou 'nao'; hora — ms de época.
   Devolve: o valor (texto). */
export const valorDaEscolha = (escolha, hora) => escolha + '.' + Math.max(0, Math.round(Number(hora) || 0));

/* O que os cookies do pedido dizem: a escolha do aparelho, a hora dela
   (0 no valor antigo, sem hora) e o id do aparelho, cada um só com a forma
   certa (o resto conta como ausente).
   Recebe: request — o pedido.
   Devolve: { escolha: 'sim'|'nao'|null, hora: número, vid: string|null }. */
export function lerCookiesDoRasto(request) {
  const c = (request && request.headers && request.headers.get('Cookie')) || '';
  const e = /(?:^|;)\s*rd_escolha=(sim|nao)(?:\.(\d{1,15}))?\s*(?=;|$)/.exec(c);
  const v = /(?:^|;)\s*rd_vis=([a-f0-9]{32})\s*(?=;|$)/.exec(c);
  return { escolha: e ? e[1] : null, hora: e && e[2] ? Number(e[2]) : 0, vid: v ? v[1] : null };
}

/* -------------------------- os ids aleatórios --------------------------- */

// Um pseudónimo novo: 'P-' + 6 caracteres do ALFABETO, do crypto, sem viés
// (os bytes acima do último múltiplo de 31 deitam-se fora).
// Devolve: o pid (texto).
export function novoPid() {
  let s = '';
  while (s.length < 6) {
    for (const b of crypto.getRandomValues(new Uint8Array(12))) {
      if (b < 248 && s.length < 6) s += ALFABETO[b % ALFABETO.length];
    }
  }
  return 'P-' + s;
}

// Um id de aparelho novo: 32 hexadecimais do crypto.
// Devolve: o vid (texto).
export function novoVid() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------- pids, aparelhos, contas ---------------------- */

/* O pid de uma conta, criado à primeira quando se pede. Um INSERT OR IGNORE
   e a releitura: duas criações ao mesmo tempo para a mesma conta acabam no
   mesmo pid (o user_id é UNIQUE), e um pid que por acaso já exista tenta-se
   com outro.
   Recebe: env — o ambiente do worker (env.DB); uid — o id da conta; criar —
   true para o criar quando não há.
   Devolve: promessa do pid, ou de null (sem pid e sem criar). */
export async function pidDaConta(env, uid, criar) {
  const ler = () => env.DB.prepare('SELECT pid FROM rasto_ids WHERE user_id = ?').bind(uid).first();
  const r = await ler();
  if (r) return r.pid;
  if (!criar) return null;
  for (let i = 0; i < 4; i++) {
    await env.DB.prepare('INSERT OR IGNORE INTO rasto_ids (pid, user_id, criado) VALUES (?, ?, ?)')
      .bind(novoPid(), uid, now()).run();
    const r2 = await ler();
    if (r2) return r2.pid;
  }
  return null;
}

/* O pid para onde um aparelho aponta. Com criar, um vid que a base não
   conhece (um aparelho novo, ou um cookie de antes de uma poda) ganha aqui um
   pid anónimo novo — o aparelho disse sim e não voltou atrás. O pid novo vai
   num INSERT simples: um pid repetido falha e tenta-se outro, em vez de se
   colar ao de outra pessoa.
   Recebe: env — o ambiente do worker; vid — o id do aparelho (já validado);
   criar — true para o criar quando a base não o conhece.
   Devolve: promessa do pid (texto), ou de null (desconhecido sem criar, ou
   não se conseguiu criar). */
export async function pidDoVisitante(env, vid, criar) {
  const ler = () => env.DB.prepare('SELECT pid FROM rasto_visitantes WHERE vid = ?').bind(vid).first();
  const r = await ler();
  if (r) return r.pid;
  if (!criar) return null;
  for (let i = 0; i < 3; i++) {
    try {
      const pid = novoPid(), t = now();
      await env.DB.batch([
        env.DB.prepare('INSERT INTO rasto_ids (pid, user_id, criado) VALUES (?, NULL, ?)').bind(pid, t),
        // dois pedidos ao mesmo tempo: o segundo não cria outro aparelho
        env.DB.prepare('INSERT OR IGNORE INTO rasto_visitantes (vid, pid, criado) VALUES (?, ?, ?)').bind(vid, pid, t),
      ]);
      const r2 = await ler();
      if (r2) return r2.pid;
    } catch (e) { /* pid repetido: outro */ }
  }
  return null;
}

/* Liga um aparelho a uma conta (o contrato: «se a conta não tem pid, o pid do
   visitante passa a ser dela; se já tem, os eventos do pid do visitante
   passam para o da conta e o vid aponta para o da conta»). Três casos à
   parte: um aparelho que a base não conhece passa a apontar para o pid da
   conta; um aparelho que já é de OUTRA conta (um computador partilhado) passa
   a apontar para esta, e os eventos ficam com a outra; e uma conta que disse
   «não» não junta nada.
   Recebe: env — o ambiente do worker; uid — o id da conta; vid — o id do
   aparelho (já validado).
   Devolve: promessa do pid da conta depois de ligar, ou de null quando não
   ligou (a conta não existe ou disse não). */
export async function ligarVisitante(env, uid, vid) {
  const conta = await env.DB.prepare(
    'SELECT u.rasto_escolha AS escolha, i.pid AS pid FROM users u LEFT JOIN rasto_ids i ON i.user_id = u.id WHERE u.id = ?'
  ).bind(uid).first();
  if (!conta || conta.escolha === 'nao') return null;
  const v = await env.DB.prepare(
    'SELECT v.pid AS pid, i.user_id AS dono, i.pid AS existe FROM rasto_visitantes v LEFT JOIN rasto_ids i ON i.pid = v.pid WHERE v.vid = ?'
  ).bind(vid).first();
  if (v && v.dono === uid) return v.pid;   // já ligado
  if (!v || v.dono) {
    // aparelho desconhecido, ou de outra conta: aponta para o desta; os eventos ficam onde estão
    const pid = conta.pid || await pidDaConta(env, uid, true);
    if (!pid) return null;
    await env.DB.prepare(
      'INSERT INTO rasto_visitantes (vid, pid, criado) VALUES (?, ?, ?) ON CONFLICT (vid) DO UPDATE SET pid = excluded.pid'
    ).bind(vid, pid, now()).run();
    return pid;
  }
  // um visitante anónimo
  if (!conta.pid && v.existe) {
    try {
      const r = await env.DB.prepare('UPDATE rasto_ids SET user_id = ? WHERE pid = ? AND user_id IS NULL')
        .bind(uid, v.pid).run();
      if (r && r.meta && r.meta.changes === 1) return v.pid;
    } catch (e) { /* a conta ganhou um pid entretanto: junta-se abaixo */ }
  }
  const pid = conta.pid || await pidDaConta(env, uid, true);
  if (!pid || pid === v.pid) return pid;
  await env.DB.batch([
    env.DB.prepare('UPDATE rasto_eventos SET pid = ? WHERE pid = ?').bind(pid, v.pid),
    env.DB.prepare('UPDATE rasto_visitantes SET pid = ? WHERE pid = ?').bind(pid, v.pid),
    env.DB.prepare('DELETE FROM rasto_ids WHERE pid = ? AND user_id IS NULL').bind(v.pid),
  ]);
  return pid;
}

/* A ligação visitante→conta numa entrada (rotas/auth.js e a ligação do
   /test): só com o aparelho em sim e um rd_vis. Nunca lança — o rasto não é
   motivo para uma entrada falhar.
   Recebe: env — o ambiente do worker; request — o pedido da entrada (os
   cookies); uid — o id da conta que entrou.
   Devolve: promessa do pid ligado, ou de null (nada a ligar, ou falhou). */
export async function ligarAoEntrar(env, request, uid) {
  try {
    const { escolha, vid } = lerCookiesDoRasto(request);
    if (escolha !== 'sim' || !vid || !uid) return null;
    return await ligarVisitante(env, uid, vid);
  } catch (e) {
    console.error('rasto: ligar ao entrar', e && e.message);
    return null;
  }
}

/* A escolha guardada na conta, com a hora dela.
   Recebe: env — o ambiente do worker; uid — o id da conta.
   Devolve: promessa de { escolha: 'sim'|'nao'|null, hora: número (0 sem hora) }. */
export async function escolhaDaConta(env, uid) {
  const r = await env.DB.prepare('SELECT rasto_escolha, rasto_escolha_at FROM users WHERE id = ?').bind(uid).first();
  const escolha = r && (r.rasto_escolha === 'sim' || r.rasto_escolha === 'nao') ? r.rasto_escolha : null;
  return { escolha, hora: escolha ? Number(r.rasto_escolha_at) || 0 : 0 };
}

// Guarda a escolha na conta, com a hora.
// Recebe: env — o ambiente do worker; uid — o id da conta; escolha — 'sim'
// ou 'nao'; hora (opcional) — ms de época (agora por omissão).
// Devolve: promessa do run.
export function guardarEscolhaDaConta(env, uid, escolha, hora) {
  return env.DB.prepare('UPDATE users SET rasto_escolha = ?, rasto_escolha_at = ? WHERE id = ?')
    .bind(escolha, hora || now(), uid).run();
}

/* Recusar apaga logo (a emenda do Martinho, rev 3): o pid para onde o
   aparelho aponta, com os eventos e os aparelhos dele, e, com sessão, o pid
   da conta da mesma maneira (apagarRastoDaConta). A ligação visitante→conta
   cai com eles: o pid era a ligação. Numa ida só; a conta primeiro, porque as
   do aparelho leem os rasto_visitantes, que saem por último.
   Recebe: env — o ambiente do worker; vid (opcional) — o id do aparelho;
   uid (opcional) — o id da conta com sessão.
   Devolve: promessa do batch (ou de null, sem nada a apagar). */
export async function apagarAoRecusar(env, vid, uid) {
  const stmts = uid ? apagarRastoDaConta(env, uid) : [];
  if (vid) {
    const doAparelho = '(SELECT pid FROM rasto_visitantes WHERE vid = ?)';
    stmts.push(
      env.DB.prepare('DELETE FROM rasto_eventos WHERE pid IN ' + doAparelho).bind(vid),
      env.DB.prepare('DELETE FROM rasto_ids WHERE pid IN ' + doAparelho).bind(vid),
      env.DB.prepare('DELETE FROM rasto_visitantes WHERE pid IN ' + doAparelho).bind(vid),
    );
  }
  return stmts.length ? env.DB.batch(stmts) : null;
}

/* Os Set-Cookie de uma escolha neste aparelho: o rd_escolha com a hora e,
   com sim, o rd_vis; com não, o rd_vis apaga-se.
   Recebe: env — o ambiente do worker; host — o hostname do pedido; escolha —
   'sim' ou 'nao'; hora — ms de época; vid (opcional) — o id do aparelho, com sim.
   Devolve: a lista dos Set-Cookie. */
export function cookiesDaEscolha(env, host, escolha, hora, vid) {
  const out = [cookieDoRasto('rd_escolha', valorDaEscolha(escolha, hora), host, env)];
  if (escolha !== 'sim') out.push(cookieDoRasto('rd_vis', '', host, env));
  else if (vid) out.push(cookieDoRasto('rd_vis', vid, host, env));
  return out;
}

/* Aplica uma escolha feita agora neste aparelho (o /consentimento e o POST
   /api/rasto/escolha): com sessão, guarda-a na conta com a mesma hora do
   cookie; com sim, garante o aparelho (o rd_vis que já tinha, ou um novo) —
   ligado à conta quando há sessão, a um pid anónimo quando não há —; com
   não, apaga logo o que se guardou (apagarAoRecusar) e o rd_vis.
   Recebe: env — o ambiente do worker; request — o pedido (os cookies); host
   — o hostname (o Domain dos cookies); escolha — 'sim' ou 'nao'; uid
   (opcional) — o id da conta com sessão.
   Devolve: promessa da lista dos Set-Cookie a pôr na resposta. */
export async function aplicarEscolha(env, request, host, escolha, uid) {
  const hora = now();
  const aparelho = lerCookiesDoRasto(request);
  if (uid) await guardarEscolhaDaConta(env, uid, escolha, hora);
  if (escolha !== 'sim') {
    await apagarAoRecusar(env, aparelho.vid, uid);
    return cookiesDaEscolha(env, host, escolha, hora);
  }
  const vid = aparelho.vid || novoVid();
  const pid = uid ? await ligarVisitante(env, uid, vid) : await pidDoVisitante(env, vid, true);
  return cookiesDaEscolha(env, host, escolha, hora, pid ? vid : null);
}

/* A última escolha ganha (a emenda do Martinho, rev 3), quando a app abre
   (GET /api/rasto/escolha): compara a hora do rd_escolha deste aparelho com
   a da conta, e a mais recente passa para o outro lado. Ganha o aparelho:
   a conta fica com a escolha e a hora dele (com sim liga-se o aparelho; com
   não apaga-se o rasto da conta). Ganha a conta (ou empata): o aparelho fica
   com a dela (com sim, um rd_vis ligado à conta; com não, apaga-se o rasto
   do aparelho). Uma conta sem escolha perde sempre para um aparelho com
   escolha; um cookie antigo, sem hora, perde para uma conta com escolha.
   Recebe: env — o ambiente do worker; request — o pedido (os cookies); host
   — o hostname do pedido; uid — o id da conta com sessão.
   Devolve: promessa de { escolha: 'sim'|'nao'|null, cookies: [Set-Cookie] }. */
export async function sincronizarEscolha(env, request, host, uid) {
  const conta = await escolhaDaConta(env, uid);
  const ap = lerCookiesDoRasto(request);
  if (!conta.escolha && !ap.escolha) return { escolha: null, cookies: [] };
  if (ap.escolha && (!conta.escolha || ap.hora > conta.hora)) {
    if (ap.escolha !== conta.escolha || ap.hora !== conta.hora) {
      await guardarEscolhaDaConta(env, uid, ap.escolha, ap.hora || now());
    }
    if (ap.escolha === 'nao') await apagarAoRecusar(env, ap.vid, uid);
    else if (ap.vid) await ligarVisitante(env, uid, ap.vid);
    return { escolha: ap.escolha, cookies: [] };
  }
  if (ap.escolha === conta.escolha) {
    // as duas iguais: com sim, o aparelho fica ligado à conta (já o estava, quase sempre)
    if (conta.escolha === 'sim' && ap.vid) await ligarVisitante(env, uid, ap.vid);
    return { escolha: conta.escolha, cookies: [] };
  }
  if (conta.escolha === 'nao') {
    await apagarAoRecusar(env, ap.vid, null);
    return { escolha: 'nao', cookies: cookiesDaEscolha(env, host, 'nao', conta.hora) };
  }
  const vid = ap.vid || novoVid();
  const pid = await ligarVisitante(env, uid, vid);
  return { escolha: 'sim', cookies: cookiesDaEscolha(env, host, 'sim', conta.hora, pid ? vid : null) };
}

/* ------------------------------- a recolha ------------------------------ */

/* Um campo de texto de um evento: só texto, sem caracteres de controlo,
   cortado a n; vazio conta como ausente.
   Recebe: v — o valor vindo do cliente; n — o máximo de caracteres.
   Devolve: o texto, ou null. */
function texto(v, n) {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
  return s || null;
}

// Um inteiro dentro de [min, max]; o resto conta como ausente.
// Recebe: v — o valor vindo do cliente; min; max.
// Devolve: o inteiro (arredondado), ou null.
function inteiro(v, min, max) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n < min || n > max ? null : n;
}

/* Um caminho sem a query nem o fragmento: uma ligação com ?entrar=<token> ou
   ?repor=<token> nunca pode ficar no rasto.
   Recebe: s — o texto (já cortado) ou null.
   Devolve: o texto até ao primeiro ? (e, fora do #secção do início, até ao
   primeiro #), ou null. */
function soCaminho(s) {
  if (!s) return s;
  let out = s.split('?')[0];
  if (out.indexOf('#') > 0) out = out.split('#')[0];
  return out || null;
}

/* O descritor de uma ligação (o que vem depois de «a:»), sem nenhum valor
   (a emenda rev 3): o host só quando o cliente o mandou (não é o da página),
   e só o hostname — sem esquema, utilizador, palavra-passe nem porta —; o
   caminho; e da query só as CHAVES («?criar&ver»), cortado tudo depois do
   «=» de cada par. Sem o fragmento, tirando uma âncora da própria página
   («#planos»). Um mailto:, tel: ou outro esquema sem «//» fica só o esquema.
   Recebe: s — o texto depois de «a:» (já cortado a 80 com o resto do alvo).
   Devolve: o descritor limpo (texto, pode ficar vazio). */
export function descritorDeLigacao(s) {
  let x = String(s || '');
  if (x.startsWith('#')) return '#' + x.slice(1).replace(/[^\w-]/g, '');
  x = x.split('#')[0];
  const esquema = /^([a-z][a-z0-9+.-]*):(\/\/)?/i.exec(x);
  if (esquema && !esquema[2]) return esquema[1].toLowerCase() + ':';
  if (esquema) x = x.slice(esquema[0].length);
  else if (x.startsWith('//')) x = x.slice(2);
  const q = x.indexOf('?');
  let base = q < 0 ? x : x.slice(0, q);
  const query = q < 0 ? '' : x.slice(q + 1);
  if (!base.startsWith('/')) {
    const i = base.indexOf('/');
    const host = (i < 0 ? base : base.slice(0, i)).replace(/^.*@/, '').replace(/:\d*$/, '')
      .toLowerCase().replace(/[^a-z0-9.-]/g, '');
    base = host + (i < 0 ? '' : base.slice(i));
  }
  const chaves = query.split('&').map((p) => p.split('=')[0]).filter(Boolean);
  return base + (chaves.length ? '?' + chaves.join('&') : '');
}

/* Um evento vindo do cliente, limpo: só os campos do contrato, cada um
   cortado ao tamanho dele, o tipo e o sinal só dos conhecidos. A hora fora de
   [agora − 2 dias, agora + 10 min] passa a ser a do servidor.
   Recebe: e — o evento (qualquer valor); agora — ms de época.
   Devolve: o evento limpo, ou null quando não é um evento (sem tipo conhecido). */
export function limparEvento(e, agora) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  if (TIPOS.indexOf(e.tipo) < 0) return null;
  const t = inteiro(e.t, agora - 2 * DIA, agora + 600000);
  let alvo = texto(e.alvo, 80);
  if (alvo && alvo.startsWith('a:')) alvo = 'a:' + descritorDeLigacao(alvo.slice(2));
  const ecra = texto(e.ecra, 40);
  return {
    at: t == null ? agora : t,
    tipo: e.tipo,
    ecra: ecra && ecra.startsWith('#') ? ecra : soCaminho(ecra),
    janela: texto(e.janela, 40),
    alvo,
    x: inteiro(e.x, 0, 1000),
    y: inteiro(e.y, 0, 1000),
    vw: inteiro(e.vw, 0, 100000),
    vh: inteiro(e.vh, 0, 100000),
    sinal: SINAIS.indexOf(e.sinal) > -1 ? e.sinal : null,
  };
}

/* Um lote vindo do cliente, limpo: a sessão com a forma do contrato e até
   MAX_EVENTOS eventos (os de mais deitam-se fora, como os que não são
   eventos).
   Recebe: b — o corpo já interpretado (qualquer valor); agora (opcional) — ms de época.
   Devolve: { sessao, eventos } com pelo menos um evento, ou null. */
export function limparLote(b, agora) {
  if (!b || typeof b !== 'object' || !SESSAO_RE.test(String(b.sessao || ''))) return null;
  if (!Array.isArray(b.eventos)) return null;
  const t = agora || now();
  const eventos = b.eventos.slice(0, MAX_EVENTOS).map((e) => limparEvento(e, t)).filter(Boolean);
  return eventos.length ? { sessao: b.sessao, eventos } : null;
}

/* O corpo de um lote, lido com teto (MAX_CORPO) e interpretado: o sendBeacon
   manda-o como texto, sem Content-Type de JSON.
   Recebe: request — o pedido.
   Devolve: promessa do lote limpo (limparLote), ou de null. */
export async function lerLote(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_CORPO) return null;
  let b = null;
  try {
    const t = await request.text();
    if (t.length > MAX_CORPO) return null;
    b = JSON.parse(t);
  } catch (e) { return null; }
  return limparLote(b);
}

/* Guarda um lote limpo, numa ida só à base (um batch de ≤ MAX_EVENTOS).
   Recebe: env — o ambiente do worker; pid — o pseudónimo; origem — 'app' ou
   'montra'; lote — o de limparLote.
   Devolve: promessa de quantos eventos se guardaram. */
export async function guardarLote(env, pid, origem, lote) {
  const ev = lote.eventos.slice(0, MAX_EVENTOS);
  await env.DB.batch(ev.map((e) => env.DB.prepare(
    `INSERT INTO rasto_eventos (pid, sessao, at, origem, tipo, ecra, janela, alvo, x, y, vw, vh, sinal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(pid, lote.sessao, e.at, origem, e.tipo, e.ecra, e.janela, e.alvo, e.x, e.y, e.vw, e.vh, e.sinal)));
  return ev.length;
}

/* O travão do rasto (o contrato: 'rasto:' + (pid || ip), 120 em 10 min).
   Recebe: env — o ambiente do worker; quem — o pid, ou o IP quando ainda
   não há pid.
   Devolve: promessa de true (cabe) ou false (acima: não se guarda nada). */
export const travao = (env, quem) => rateLimit(env, 'rasto:' + quem, 120, 600);

/* Recolhe um lote já lido: passa pelo travão do pid e guarda-o. Quem chama
   lê o lote antes (lerLote), para um lote inválido não gastar o travão.
   Recebe: env — o ambiente do worker; lote — o de lerLote; pid — o
   pseudónimo; origem — 'app' ou 'montra'.
   Devolve: promessa de quantos eventos se guardaram (0 quando recusou). */
export async function recolher(env, lote, pid, origem) {
  if (!lote || !pid) return 0;
  if (!(await travao(env, pid))) return 0;
  return guardarLote(env, pid, origem, lote);
}

// A resposta de toda a recolha: 204, sempre — o cliente nunca reage.
// Devolve: a Response.
export const semConteudo = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

/* Um pedido que vem de outro site (Origin presente e diferente da do
   pedido): não muda escolhas nem guarda eventos.
   Recebe: request — o pedido; url — o URL dele.
   Devolve: true quando vem de fora. */
export function deFora(request, url) {
  const o = request.headers.get('Origin');
  return !!o && o !== url.origin;
}

/* ------------------------- as rotas sem sessão -------------------------- */

/* O caminho de regresso do /consentimento: só um caminho relativo que
   comece por «/» e não por «//» nem «/\» (que os browsers leem como outro
   site), sem espaços nem barras invertidas, até 300 caracteres; o resto é «/».
   Recebe: v — o valor vindo do formulário.
   Devolve: o caminho (texto). */
export function caminhoDeVolta(v) {
  const s = String(v == null ? '' : v);
  if (s.length > 300 || !/^\/(?![/\\])[^\s\\]*$/.test(s)) return '/';
  return s;
}

/* POST /consentimento (qualquer host, antes do reencaminhamento da raiz): o
   formulário da faixa da montra, sem JS. Põe os cookies da escolha, guarda-a
   na conta se houver sessão, e volta (303) ao caminho de onde veio. Um
   pedido de outro site ou com uma escolha desconhecida volta sem mudar nada.
   Recebe: env — o ambiente do worker; request — o pedido (form urlencoded
   escolha=sim|nao&volta=<caminho>); url — o URL dele.
   Devolve: promessa da Response 303. */
export async function rotaConsentimento(env, request, url) {
  let volta = '/';
  const cookies = [];
  try {
    const len = Number(request.headers.get('Content-Length') || 0);
    const t = len > 4096 ? '' : (await request.text()).slice(0, 4096);
    const f = new URLSearchParams(t);
    volta = caminhoDeVolta(f.get('volta'));
    const escolha = f.get('escolha');
    // um sim pode criar um aparelho e um pid: o travão do IP antes, como na recolha
    const cabe = escolha === 'nao' || (escolha === 'sim' && (await travao(env, clientIp(request))));
    if (cabe && !deFora(request, url)) {
      const { getSessionUser } = await import('../auth.js');
      let me = null;
      try { me = await getSessionUser(env, request); } catch (e) { me = null; }
      cookies.push(...(await aplicarEscolha(env, request, url.hostname, escolha, me && me.id)));
    }
  } catch (e) {
    console.error('rasto: consentimento', e && e.message);
  }
  const r = new Response(null, { status: 303, headers: { Location: volta, 'Cache-Control': 'no-store' } });
  cookies.forEach((c) => r.headers.append('Set-Cookie', c));
  return r;
}

/* POST /rasto (qualquer host, antes do reencaminhamento): o sendBeacon da
   montra. Só com rd_escolha=sim e um rd_vis com a forma certa; guarda com
   origem 'montra'. 204 sempre, também quando recusa.
   Recebe: env — o ambiente do worker; request — o pedido (o lote em JSON);
   url — o URL dele.
   Devolve: promessa da Response 204. */
export async function rotaRastoDaMontra(env, request, url) {
  try {
    const { escolha, vid } = lerCookiesDoRasto(request);
    if (escolha !== 'sim' || !vid || deFora(request, url)) return semConteudo();
    const lote = await lerLote(request);
    if (!lote) return semConteudo();
    let pid = await pidDoVisitante(env, vid, false);
    // um aparelho que a base não conhece cria linhas: passa antes pelo travão do IP
    if (!pid && (await travao(env, clientIp(request)))) pid = await pidDoVisitante(env, vid, true);
    await recolher(env, lote, pid, 'montra');
  } catch (e) {
    console.error('rasto: montra', e && e.message);
  }
  return semConteudo();
}

/* ------------------------------ a limpeza ------------------------------- */

/* A poda do cron diário: os eventos com mais de DIAS_DO_RASTO dias, os pids
   anónimos (sem conta) dessa idade que ficaram sem eventos, e os aparelhos
   que apontavam para eles — um aparelho que volte a seguir ganha um pid
   anónimo novo (pidDoVisitante). Numa ida só. Nunca lança.
   Recebe: env — o ambiente do worker; agora (opcional) — ms de época.
   Devolve: promessa de { ok, eventos, pids } (ok false quando a base falhou). */
export async function podarRasto(env, agora) {
  const limite = (agora || now()) - DIAS_DO_RASTO * DIA;
  try {
    const [e, i] = await env.DB.batch([
      env.DB.prepare('DELETE FROM rasto_eventos WHERE at < ?').bind(limite),
      env.DB.prepare(
        `DELETE FROM rasto_ids WHERE user_id IS NULL AND criado < ?
           AND NOT EXISTS (SELECT 1 FROM rasto_eventos e WHERE e.pid = rasto_ids.pid)`
      ).bind(limite),
      env.DB.prepare('DELETE FROM rasto_visitantes WHERE NOT EXISTS (SELECT 1 FROM rasto_ids i WHERE i.pid = rasto_visitantes.pid)'),
    ]);
    const n = (r) => (r && r.meta && r.meta.changes) || 0;
    return { ok: true, eventos: n(e), pids: n(i) };
  } catch (err) {
    console.error('rasto: poda', err && err.message);
    return { ok: false, eventos: 0, pids: 0, erro: String((err && err.message) || err).slice(0, 200) };
  }
}

/* O que sai com a conta, para o lote do lib/acesso.js:purgeAccount (tudo ou
   nada com o resto): os eventos e os aparelhos do pid dela, e o pid.
   Recebe: env — o ambiente do worker; uid — o id da conta a apagar.
   Devolve: a lista de statements preparados (por esta ordem). */
export function apagarRastoDaConta(env, uid) {
  return [
    env.DB.prepare('DELETE FROM rasto_eventos WHERE pid IN (SELECT pid FROM rasto_ids WHERE user_id = ?)').bind(uid),
    env.DB.prepare('DELETE FROM rasto_visitantes WHERE pid IN (SELECT pid FROM rasto_ids WHERE user_id = ?)').bind(uid),
    env.DB.prepare('DELETE FROM rasto_ids WHERE user_id = ?').bind(uid),
  ];
}

/* --------------------------- o back office ------------------------------ */

// Uma conta de teste, em SQL sobre o alias u de users: com dono de teste
// (test_owner, migração 0012) ou com um email da casa (lib/correio.js:dominioDaCasa).
const E_DE_TESTE = "COALESCE((u.test_owner IS NOT NULL OR lower(u.email) LIKE '%@rendorium.com' " +
  "OR lower(u.email) LIKE '%.rendorium.com'), 0)";

/* O filtro das contas de teste: em produção (sem ENV_NAME) ficam de fora;
   fora dela entram (e vão marcadas com teste: true). Os pids sem conta entram
   sempre. Sobre os aliases i (rasto_ids) e u (users).
   Recebe: env — o ambiente do worker.
   Devolve: o pedaço de SQL a juntar ao WHERE ('' fora de produção). */
export function semContasDeTeste(env) {
  return env.ENV_NAME ? '' : ' AND (i.user_id IS NULL OR NOT ' + E_DE_TESTE + ')';
}

// Os dias de uma lista do back office: 7, 30 ou 90; o resto é 30.
// Recebe: v — o valor do parâmetro ?dias.
// Devolve: o número de dias.
export function diasDe(v) {
  const n = Number(v);
  return n === 7 || n === 90 ? n : 30;
}

// Quem vê todas as pessoas do rasto: o master e o admin.
// Recebe: eu — a sessão de equipa (papeis ou papel).
// Devolve: true/false.
export function veTodoORasto(eu) {
  const p = comoLista((eu && (eu.papeis || eu.papel)) || []);
  return p.indexOf('master') > -1 || p.indexOf('admin') > -1;
}

/* Quem pode ver o rasto de um pid (a emenda do Martinho, 2026-10-29): master
   e admin veem todas as pessoas; o suporte vê só o pid de uma conta que tem
   um pedido numa categoria que o papel dele vê (tickets.user_id,
   lib/papeis.js:catsDe); os outros papéis não veem. Não diz se o pid existe.
   Recebe: env — o ambiente do worker; eu — a sessão de equipa; pid — o pseudónimo.
   Devolve: promessa de true/false. */
export async function podeVerRasto(env, eu, pid) {
  if (!eu) return false;
  if (veTodoORasto(eu)) return true;
  const papeis = comoLista(eu.papeis || eu.papel);
  if (papeis.indexOf('suporte') < 0 || !PID_RE.test(String(pid || ''))) return false;
  const cats = catsDe(papeis);
  if (!cats.length) return false;
  const r = await env.DB.prepare(
    `SELECT 1 AS ok FROM rasto_ids i JOIN tickets t ON t.user_id = i.user_id
      WHERE i.pid = ? AND t.category IN (${cats.map(() => '?').join(',')}) LIMIT 1`
  ).bind(pid, ...cats).first();
  return !!r;
}

/* O pid de uma conta para o back office, sem o criar: null quando não tem,
   ou quando é uma conta de teste em produção.
   Recebe: env — o ambiente do worker; uid — o id da conta.
   Devolve: promessa do pid ou de null. */
export async function pidParaEquipa(env, uid) {
  const r = await env.DB.prepare(
    'SELECT i.pid AS pid FROM rasto_ids i LEFT JOIN users u ON u.id = i.user_id WHERE i.user_id = ?' + semContasDeTeste(env)
  ).bind(uid).first();
  return r ? r.pid : null;
}

// Os cinco sinais, contados numa consulta (as colunas s0…s4) — a mesma ordem de SINAIS.
const SOMA_SINAIS = SINAIS.map((s, k) => "SUM(e.sinal = '" + s + "') AS s" + k).join(', ');

// As colunas s0…s4 de uma linha num objeto { 'em-vao': n, … }.
// Recebe: r — a linha da consulta.
// Devolve: o objeto dos sinais.
const sinaisDe = (r) => {
  const o = {};
  SINAIS.forEach((s, k) => { o[s] = Number(r['s' + k]) || 0; });
  return o;
};

/* A lista das pessoas do rasto nos últimos `dias`: por pid, a última vez, as
   sessões, os eventos, as origens e os sinais — sem nome nem email —, da mais
   recente para a mais antiga, até 200.
   Recebe: env — o ambiente do worker; dias — 7, 30 ou 90.
   Devolve: promessa de [{ pid, conta, teste, ultimo, sessoes, eventos, origens, sinais }]. */
export async function pessoasDoRasto(env, dias) {
  const rows = (await env.DB.prepare(
    `SELECT e.pid AS pid, i.user_id AS user_id, ${E_DE_TESTE} AS teste,
            MAX(e.at) AS ultimo, COUNT(DISTINCT e.sessao) AS sessoes, COUNT(*) AS eventos,
            SUM(e.origem = 'app') AS n_app, SUM(e.origem = 'montra') AS n_montra, ${SOMA_SINAIS}
       FROM rasto_eventos e
       JOIN rasto_ids i ON i.pid = e.pid
       LEFT JOIN users u ON u.id = i.user_id
      WHERE e.at >= ?${semContasDeTeste(env)}
      GROUP BY e.pid
      ORDER BY ultimo DESC
      LIMIT 200`
  ).bind(now() - dias * DIA).all()).results;
  return rows.map((r) => ({
    pid: r.pid,
    conta: !!r.user_id,
    teste: !!r.user_id && !!r.teste,
    ultimo: r.ultimo,
    sessoes: r.sessoes,
    eventos: r.eventos,
    origens: [r.n_app ? 'app' : null, r.n_montra ? 'montra' : null].filter(Boolean),
    sinais: sinaisDe(r),
  }));
}

/* A linha do tempo de uma pessoa: os últimos 3000 eventos, por sessão — as
   sessões da mais recente para a mais antiga, os eventos de cada uma pela
   ordem em que aconteceram.
   Recebe: env — o ambiente do worker; pid — o pseudónimo (já validado).
   Devolve: promessa de { pid, userId, teste, sessoes: [{ sessao, inicio, fim,
   origens, eventos }] }, ou de null quando o pid não existe (ou é de uma
   conta de teste em produção). */
export async function pessoaDoRasto(env, pid) {
  const p = await env.DB.prepare(
    `SELECT i.pid AS pid, i.user_id AS user_id, ${E_DE_TESTE} AS teste
       FROM rasto_ids i LEFT JOIN users u ON u.id = i.user_id WHERE i.pid = ?${semContasDeTeste(env)}`
  ).bind(pid).first();
  if (!p) return null;
  const evs = (await env.DB.prepare(
    `SELECT sessao, at, origem, tipo, ecra, janela, alvo, x, y, vw, vh, sinal FROM rasto_eventos
      WHERE pid = ? ORDER BY at DESC, id DESC LIMIT 3000`
  ).bind(pid).all()).results;
  const porSessao = new Map();
  for (let k = evs.length - 1; k >= 0; k--) {
    const e = evs[k];
    let s = porSessao.get(e.sessao);
    if (!s) { s = { sessao: e.sessao, inicio: e.at, fim: e.at, origens: [], eventos: [] }; porSessao.set(e.sessao, s); }
    s.fim = Math.max(s.fim, e.at);
    s.inicio = Math.min(s.inicio, e.at);
    if (s.origens.indexOf(e.origem) < 0) s.origens.push(e.origem);
    s.eventos.push({ at: e.at, origem: e.origem, tipo: e.tipo, ecra: e.ecra, janela: e.janela, alvo: e.alvo,
      x: e.x, y: e.y, vw: e.vw, vh: e.vh, sinal: e.sinal });
  }
  const sessoes = [...porSessao.values()].sort((a, b) => b.fim - a.fim);
  return { pid: p.pid, userId: p.user_id || null, teste: !!p.user_id && !!p.teste, sessoes };
}

/* O resumo por ecrã: onde as pessoas tropeçam. Por (ecrã, alvo), os sinais
   dos últimos `dias`, quantos ao todo e quantas pessoas — só as linhas com
   sinais, da que tem mais para a que tem menos, até 100.
   Recebe: env — o ambiente do worker; dias — 7, 30 ou 90.
   Devolve: promessa de [{ ecra, alvo, sinais, total, pessoas }]. */
export async function resumoDoRasto(env, dias) {
  const rows = (await env.DB.prepare(
    `SELECT e.ecra AS ecra, e.alvo AS alvo, ${SOMA_SINAIS}, COUNT(*) AS total, COUNT(DISTINCT e.pid) AS pessoas
       FROM rasto_eventos e
       JOIN rasto_ids i ON i.pid = e.pid
       LEFT JOIN users u ON u.id = i.user_id
      WHERE e.sinal IN (${SINAIS.map(() => '?').join(',')}) AND e.at >= ?${semContasDeTeste(env)}
      GROUP BY e.ecra, e.alvo
      ORDER BY total DESC
      LIMIT 100`
  ).bind(...SINAIS, now() - dias * DIA).all()).results;
  return rows.map((r) => ({ ecra: r.ecra, alvo: r.alvo, sinais: sinaisDe(r), total: r.total, pessoas: r.pessoas }));
}
