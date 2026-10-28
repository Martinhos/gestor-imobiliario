/* As sessões de teste, vistas do back office.
   ------------------------------------------
   Quem opera o dev (a Operação do /equipa: master e admin) vê as sessões
   abertas das contas de teste — cada browser ou aparelho onde uma ligação
   do /test foi aberta e ainda tem sessão —, agrupadas pela conta do Discord
   que as pediu, e pode terminá-las ou apagar as contas: uma sessão, uma
   conta, todas as de uma pessoa, ou todas.

   As sessões vivem no KV (sess:<token>), sem índice por conta: lê-se a lista
   das chaves e fica-se com as das contas de teste vivas cuja época bate
   (auth.js:getSessionUser recusa as outras). As sessões novas trazem nos
   metadados da chave a conta, a hora e o browser (auth.js:createSession);
   as de antes leem-se pelo valor, e a hora de abertura sai da validade.
   O token nunca sai daqui: o back office vê um id tirado dele (idDaSessao).

   Nada disto existe em produção: as rotas (equipa-api.js) dão 404 sem
   ENV_NAME, e aí nem há contas de teste. */

import { purgeAccount } from './lib/acesso.js';
import { sha256hex, SESSION_TTL } from './auth.js';
import { nomeDoDevNoDiscord } from './teste.js';

const DOMINIO_TESTE = '@teste.rendorium.com';
// quantas chaves do KV se leem, no máximo, numa listagem (o dev tem poucas)
const TETO_CHAVES = 5000;

/* O id de uma sessão para o back office: os primeiros 16 caracteres do
   sha-256 do token — chega para a distinguir e não serve para entrar.
   Recebe: token — o token da sessão (o que vem depois de sess:).
   Devolve: promessa do id (16 caracteres hexadecimais). */
export async function idDaSessao(token) {
  return (await sha256hex(String(token))).slice(0, 16);
}

/* As contas de teste vivas, por id.
   Recebe: env — o ambiente do worker (D1 em env.DB).
   Devolve: promessa de um Map id → {id, email, test_owner, sess_epoch, created_at}. */
async function contasDeTeste(env) {
  const r = (await env.DB.prepare(
    "SELECT id, email, test_owner, sess_epoch, created_at FROM users WHERE email LIKE '%' || ? AND deleted_at IS NULL"
  ).bind(DOMINIO_TESTE).all()).results || [];
  return new Map(r.map((c) => [c.id, c]));
}

/* As sessões abertas das contas de teste, lidas do KV: as chaves sess:, as
   que são de uma conta de teste viva e com a época certa.
   Recebe: env — o ambiente do worker (D1 e KV); contas — o Map de contasDeTeste.
   Devolve: promessa de uma lista de {id, token, conta, criada, expira,
   agente} — criada e expira em milissegundos (ou null se não se souber). */
async function lerSessoes(env, contas) {
  const fora = [];
  let cursor, lidas = 0;
  do {
    const pagina = await env.SESSIONS.list({ prefix: 'sess:', cursor, limit: 1000 });
    for (const k of pagina.keys || []) {
      if (++lidas > TETO_CHAVES) break;
      const token = k.name.slice(5);
      const meta = k.metadata || {};
      let conta = meta.u, epoca = meta.e;
      // as sessões de antes dos metadados: a conta e a época vêm do valor
      if (!conta || epoca === undefined) {
        try {
          const v = JSON.parse((await env.SESSIONS.get(k.name)) || 'null');
          conta = v && v.userId; epoca = v && v.epoch;
        } catch (e) { conta = null; }
      }
      const c = conta && contas.get(conta);
      if (!c || (c.sess_epoch || 0) !== (epoca || 0)) continue;
      const expira = k.expiration ? k.expiration * 1000 : null;
      fora.push({
        id: await idDaSessao(token), token, conta: c.id,
        criada: meta.t || (expira ? expira - SESSION_TTL * 1000 : null),
        expira, agente: meta.a || '',
      });
    }
    cursor = pagina.list_complete ? null : pagina.cursor;
  } while (cursor && lidas <= TETO_CHAVES);
  return fora;
}

/* As sessões de teste para o back office, agrupadas por quem as pediu no
   Discord e, dentro disso, por conta. As contas sem sessão aberta também
   vêm (para se poderem apagar), com a lista vazia.
   Recebe: env — o ambiente do worker (D1 e KV).
   Devolve: promessa de {sessoes, contas, donos: [{id, nome, contas: [{id,
   email, criada, sessoes: [{id, criada, expira, agente}]}]}]} — os donos
   com mais sessões primeiro; uma conta sem dono fica no dono id null. */
export async function sessoesDeTeste(env) {
  const contas = await contasDeTeste(env);
  const sessoes = await lerSessoes(env, contas);
  const porConta = new Map();
  for (const s of sessoes) {
    if (!porConta.has(s.conta)) porConta.set(s.conta, []);
    porConta.get(s.conta).push({ id: s.id, criada: s.criada, expira: s.expira, agente: s.agente });
  }
  const donos = new Map();
  for (const c of contas.values()) {
    const d = c.test_owner || null;
    if (!donos.has(d)) donos.set(d, { id: d, nome: '', contas: [] });
    const lista = (porConta.get(c.id) || []).sort((a, z) => (z.criada || 0) - (a.criada || 0));
    donos.get(d).contas.push({ id: c.id, email: c.email, criada: c.created_at, sessoes: lista });
  }
  for (const d of donos.values()) {
    if (d.id) {
      d.nome = await nomeDoDevNoDiscord(env, d.id);   // o da ligação, ou o que o bot diz
    }
    d.contas.sort((a, z) => z.sessoes.length - a.sessoes.length || (z.criada || 0) - (a.criada || 0));
  }
  const n = (d) => d.contas.reduce((s, c) => s + c.sessoes.length, 0);
  return {
    sessoes: sessoes.length,
    contas: contas.size,
    donos: [...donos.values()].sort((a, z) => n(z) - n(a) || String(a.nome || a.id || '').localeCompare(String(z.nome || z.id || ''))),
  };
}

/* As contas de teste que uma ação apanha.
   Recebe: env — o ambiente do worker; alvo — 'conta', 'dono' ou 'todas';
   id — o id da conta ou do dono (o id de Discord); ignorado em 'todas'.
   Devolve: promessa da lista dos ids das contas (vazia se o id não for de
   nenhuma conta de teste). */
async function contasDoAlvo(env, alvo, id) {
  let r;
  if (alvo === 'conta') {
    r = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND email LIKE '%' || ? AND deleted_at IS NULL").bind(String(id || ''), DOMINIO_TESTE).all();
  } else if (alvo === 'dono') {
    r = await env.DB.prepare("SELECT id FROM users WHERE test_owner = ? AND email LIKE '%' || ? AND deleted_at IS NULL").bind(String(id || ''), DOMINIO_TESTE).all();
  } else if (alvo === 'todas') {
    r = await env.DB.prepare("SELECT id FROM users WHERE email LIKE '%' || ? AND deleted_at IS NULL").bind(DOMINIO_TESTE).all();
  } else {
    return [];
  }
  return (r.results || []).map((x) => x.id);
}

/* Termina uma sessão de teste: apaga-a do KV. Só as das contas de teste —
   o id de uma sessão de uma conta normal não apanha nada.
   Recebe: env — o ambiente do worker (D1 e KV); id — o id da sessão (idDaSessao).
   Devolve: promessa de quantas sessões terminou (0 ou 1). */
export async function terminarSessao(env, id) {
  const alvo = String(id || '');
  if (!/^[a-f0-9]{16}$/.test(alvo)) return 0;
  const sessoes = await lerSessoes(env, await contasDeTeste(env));
  const s = sessoes.find((x) => x.id === alvo);
  if (!s) return 0;
  await env.SESSIONS.delete('sess:' + s.token);
  return 1;
}

/* Termina todas as sessões das contas de um alvo: sobe-lhes o sess_epoch
   (o que a suspensão faz), e todas as sessões delas deixam de valer na hora.
   As contas e os dados ficam: o próximo /test retoma-as.
   Recebe: env — o ambiente do worker; alvo — 'conta', 'dono' ou 'todas';
   id — o da conta ou do dono.
   Devolve: promessa de quantas contas foram apanhadas. */
export async function terminarSessoesDe(env, alvo, id) {
  const ids = await contasDoAlvo(env, alvo, id);
  for (const c of ids) {
    await env.DB.prepare('UPDATE users SET sess_epoch = COALESCE(sess_epoch, 0) + 1 WHERE id = ?').bind(c).run();
  }
  return ids.length;
}

/* Apaga as contas de teste de um alvo, com os dados e as sessões — o mesmo
   que o /test limpar faz às contas de quem o pede (lib/acesso.js:purgeAccount).
   Recebe: env — o ambiente do worker; alvo — 'conta', 'dono' ou 'todas';
   id — o da conta ou do dono.
   Devolve: promessa de quantas contas foram apagadas. */
export async function apagarContasDe(env, alvo, id) {
  const ids = await contasDoAlvo(env, alvo, id);
  let n = 0;
  for (const c of ids) {
    try { await purgeAccount(env, c); n++; } catch (e) { /* uma teimosa não trava as outras */ }
  }
  return n;
}
