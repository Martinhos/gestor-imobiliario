// Erros apanhados sozinhos abrem um pedido na mesma fila dos que as
// pessoas contam, agrupados por assinatura para nao encher o canal.

import { now } from './http.js';
import { notifyDev, errorEmbed } from '../notify.js';
import { medirRelato } from './medidas.js';

/* Quantas pessoas distintas apanharam esta assinatura.

   Duzentas ocorrências de uma pessoa e duzentas de duzentas pessoas contavam
   igual no `n`, e são problemas de gravidade muito diferente. A chave
   primária da tabela faz a distinção sozinha: a mesma pessoa a repetir o
   mesmo erro não acrescenta linha.
   Recebe: env — o ambiente do worker (D1 em env.DB); fp — a assinatura do
   erro (string); userId — o id de quem o apanhou (ou nada, quando não se
   sabe); t — o instante em milissegundos.
   Devolve: { total, novo } — quantas pessoas distintas já apanharam esta
   assinatura e se esta pessoa é nova nela; { total: null, novo: false } sem
   utilizador ou com a base em baixo. */
async function marcarPessoa(env, fp, userId, t) {
  if (!userId) return { total: null, novo: false };
  try {
    // o `changes` diz se esta pessoa é nova nesta assinatura, sem precisar de
    // guardar em lado nenhum quem já foi avisado
    const r = await env.DB.prepare(
      'INSERT OR IGNORE INTO ticket_users (fingerprint, user_id, first_at) VALUES (?, ?, ?)'
    ).bind(fp, userId, t).run();
    const novo = !!(r && r.meta && r.meta.changes);
    const c = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM ticket_users WHERE fingerprint = ?'
    ).bind(fp).first();
    return { total: (c && c.n) || 1, novo };
  } catch (e) {
    return { total: null, novo: false };   // a contagem é informação, não pode travar o relato
  }
}

/* A conta do sistema: o dono dos pedidos que nenhuma pessoa abriu — um erro
   do servidor, da infraestrutura, um relato do browser sem sessão.
   tickets.user_id é NOT NULL REFERENCES users(id), e pendurá-los na conta viva
   mais antiga fazia essa pessoa «ter» erros que nunca viu (e mudava de dono no
   dia em que ela se apagasse). Nasce apagada — não entra, não conta nas
   contas, não recebe correio —, com o nome que o back office mostra, e com um
   email sem ponto no domínio, que o registo recusa (ninguém o toma antes).
   A migração 0016 devolve-lhe os pedidos antigos. */
export const CONTA_SISTEMA = 'SISTEMA';

// Garante a linha da conta do sistema (cria-a na primeira vez).
// Recebe: env — o ambiente do worker (D1 em env.DB).
// Devolve: promessa do id da conta do sistema.
async function contaDoSistema(env) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO users (id, email, name, pass_hash, pass_salt, created_at, deleted_at)
     VALUES (?, 'sistema@invalido', 'Sem utilizador', '', '', 0, 1)`
  ).bind(CONTA_SISTEMA).run();
  return CONTA_SISTEMA;
}

// Os tokens de convite e da ligação de partilha nunca podem ficar num relato
// (as tabelas leem-se no back office e o Discord recebe o embed): um caminho
// /api/convite/<64 hex>, /api/ligar/<64 hex> ou um ?convite=<64 hex> perde o
// token e fica «…».
// Recebe: s — o texto (um caminho, uma mensagem, um detalhe; nada vale '').
// Devolve: o mesmo texto com cada token substituído por «…».
export function mascararTokens(s) {
  return String(s == null ? '' : s)
    .replace(/\/(convite|ligar)\/[a-f0-9]{64}/gi, '/$1/…')
    .replace(/([?&])(convite|ligar)=[a-f0-9]{64}/gi, '$1$2=…');
}

// Um erro apanhado sozinho abre um pedido na mesma fila dos que as pessoas
// contam. Erros repetidos somam-se ao pedido que já existe, em vez de abrirem
// um novo de cada vez. Tokens nos textos são mascarados antes de qualquer
// escrita (mascararTokens) — também na assinatura, para o mesmo erro com
// tokens diferentes não abrir um pedido por token.
// Recebe: env — o ambiente do worker; ctx — o contexto de execução (para as
// notificações); categoria — uma das CATEGORIAS ('user', 'client', 'server',
// 'infra', 'seguranca'); message — a mensagem do erro (corta a 2000);
// detail — o detalhe ou stack (corta a 4000); userId (opcional) — o id de
// quem o apanhou, se se souber; extra (opcional) — { versao, contexto }.
// Devolve: nada — grava ou engorda o pedido na D1 e avisa quem programa no
// Discord quando vale a pena.
export async function recordReport(env, ctx, categoria, message, detail, userId, extra) {
  const msg = mascararTokens(message).slice(0, 2000);
  const fp = categoria + ':' + msg.slice(0, 120);
  const t = now();
  const versao = extra && extra.versao != null ? String(extra.versao).slice(0, 20) : null;
  const contexto = extra && extra.contexto ? mascararTokens(extra.contexto).slice(0, 200) : '';
  /* Um registo estruturado por relato, para os Workers Logs. É o que fica a
     ver-se por pedido depois de se desligar a linha automática de invocação
     (wrangler.toml), que gravava o URL em bruto com os tokens lá dentro. Aqui
     vai tudo já mascarado, e como objeto e não como texto: fica pesquisável
     por campo no painel, e o Discord continua a receber o embed. */
  console.error({ relato: categoria, msg: msg.slice(0, 300), contexto, versao, quem: userId || null });
  medirRelato(env, categoria, fp);
  try {
    const ex = await env.DB.prepare('SELECT * FROM tickets WHERE fingerprint = ?').bind(fp).first();
    if (ex) {
      // um erro que volta depois de fechado reabre o pedido
      const estado = ex.status === 'concluido' ? 'criado' : ex.status;
      await env.DB.prepare(
        'UPDATE tickets SET n = n + 1, status = ?, updated_at = ?, versao = COALESCE(?, versao) WHERE id = ?'
      ).bind(estado, t, versao, ex.id).run();
      const pessoas = await marcarPessoa(env, fp, userId, t);
      /* Avisa-se nas primeiras vezes, quando volta depois de fechado, quando
         passou uma hora — e quando aparece alguém que ainda não o tinha
         apanhado. Um erro que passa de uma pessoa para várias mudou de
         gravidade, e isso vale um aviso mesmo que já se saiba dele. */
      const alguemNovo = pessoas.novo && pessoas.total > 1;
      if (ex.n < 3 || t - ex.updated_at > 3600000 || ex.status === 'concluido' || alguemNovo) {
        notifyDev(env, ctx, errorEmbed({
          id: ex.id, kind: categoria, message: ex.subject, detail: ex.body,
          user_id: ex.user_id, n: ex.n + 1, created_at: t,
          versao: versao || ex.versao, contexto, pessoas: pessoas.total,
        }));
      }
      return;
    }
    const id = crypto.randomUUID();
    // sem pessoa, o pedido é da conta do sistema — nunca de alguém que não o viu
    const dono = userId || (await contaDoSistema(env));
    const detalhe = mascararTokens(detail).slice(0, 4000);
    await env.DB.prepare(
      `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, fingerprint, n, versao, context, created_at, updated_at)
       VALUES (?, ?, 'problema', ?, ?, 'criado', ?, ?, 1, ?, ?, ?, ?)`
    ).bind(id, dono, msg.slice(0, 140), detalhe, categoria, fp, versao, contexto, t, t).run();
    const pessoas = await marcarPessoa(env, fp, userId, t);
    notifyDev(env, ctx, errorEmbed({
      id, kind: categoria, message: msg, detail: detalhe, user_id: userId,
      n: 1, created_at: t, versao, contexto, pessoas: pessoas.total,
    }));
  } catch (e) {
    // um relatório que falha não pode piorar o problema que estava a relatar
  }
}
