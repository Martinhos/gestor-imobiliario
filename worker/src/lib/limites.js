// Travão contra força bruta e abuso. Os contadores vivem na D1: o KV gratuito
// só aceita mil escritas por dia e cada gravação de dados gastava uma.
//
// Um limite atingido abre (ou engorda) um ticket de segurança na fila do back
// office: uma força bruta, um script descontrolado ou um limite baixo de mais
// para quem usa a app deixam rasto. Nenhum se trata sem alguém da equipa
// escrever a resolução proposta (equipa-api.js, ação aceitar).

import { now } from './http.js';
import { medirRelato } from './medidas.js';
import { notifyDev, limiteEmbed } from '../notify.js';

// o dono dos tickets sem conta (o mesmo id de lib/relatos.js:CONTA_SISTEMA;
// este ficheiro não importa o relatos.js, que tem a sua própria cadência)
const SISTEMA = 'SISTEMA';

/* O que cada travão conta, por extenso, e de quem é a chave: 'conta' (o id
   de uma conta, que vai como dono do ticket), 'ip' (o endereço) ou
   'visitante' (o pseudónimo do rasto, ou o IP enquanto não o há). As frases
   são curtas de propósito: a mensagem do ticket (e a assinatura, os primeiros
   120 caracteres) leva ainda o id da conta ou o IP inteiros.
   Ficam de fora (fora: true) o aviso:, que é a deduplicação dos avisos dos
   tetos da Cloudflare (um por dia, não é abuso de ninguém; hoje já não passa
   por aqui, vai pelo notify.js:avisoDeHoje, mas se voltar não relata), e as chaves dos
   relatos de erro (rp:, rpa:): um relato a abrir um relato fazia um ciclo.
   Um prefixo que não esteja aqui também relata, com a chave crua. */
export const LIMITES = {
  'login:': { o: 'tentativas de entrada', quem: 'ip' },
  'auth:': { o: 'registos, Google e recuperações de conta', quem: 'ip' },
  'acct:': { o: 'tentativas de entrada numa conta', quem: 'conta' },
  'pw:': { o: 'mudanças de palavra-passe', quem: 'conta' },
  'verif:': { o: 'reenvios do email de confirmação', quem: 'conta' },
  'w:': { o: 'gravações de dados', quem: 'conta' },
  'conv:': { o: 'convites de colaborador abertos', quem: 'ip' },
  'lig:': { o: 'ligações de partilha abertas', quem: 'ip' },
  'invc:': { o: 'convites de colaborador criados', quem: 'conta' },
  'invp:': { o: 'convites de colaborador aceites', quem: 'conta' },
  'ligc:': { o: 'ligações de partilha criadas', quem: 'conta' },
  'ligp:': { o: 'pedidos por ligação de partilha', quem: 'conta' },
  'grp:': { o: 'ligações de grupo abertas', quem: 'ip' },
  'grpe:': { o: 'pedidos para entrar num grupo', quem: 'conta' },
  'grpc:': { o: 'grupos criados', quem: 'conta' },
  'grpl:': { o: 'ligações de grupo criadas', quem: 'conta' },
  'conn:': { o: 'convites entre contas', quem: 'conta' },
  'up:': { o: 'anexos carregados', quem: 'conta' },
  'tn:': { o: 'miniaturas geradas', quem: 'conta' },
  'tk:': { o: 'pedidos de ajuda', quem: 'conta' },
  'qa:': { o: 'tickets de QA', quem: 'conta' },
  'rasto:': { o: 'lotes do rasto', quem: 'visitante' },
  'aviso:': { o: 'avisos dos tetos da Cloudflare', quem: 'nenhum', fora: true },
  'rp:': { o: 'relatos de erro da app', quem: 'conta', fora: true },
  'rpa:': { o: 'relatos de erro sem sessão', quem: 'ip', fora: true },
};

/* O ticket que um limite atingido abre: a mensagem, estável por limite e por
   quem (é ela que junta as repetições no mesmo ticket), e o id da conta,
   quando a chave é de uma. A chave de um ticket de QA escrito no back office
   é 'qa:equipa:<id do Discord>', que não é conta nenhuma.
   Recebe: key — a chave do contador (ex.: 'login:' + ip).
   Devolve: { mensagem, userId } (userId null sem conta), ou null quando a
   chave fica de fora (LIMITES, fora: true). */
export function relatoDoLimite(key) {
  const k = String(key == null ? '' : key);
  const i = k.indexOf(':');
  const prefixo = i < 0 ? '' : k.slice(0, i + 1);
  const l = Object.prototype.hasOwnProperty.call(LIMITES, prefixo) ? LIMITES[prefixo] : null;
  if (!l) return { mensagem: 'Limite atingido: chave ' + k, userId: null };
  if (l.fora) return null;
  const resto = k.slice(prefixo.length);
  let quem, userId = null;
  if (l.quem === 'conta' && resto.startsWith('equipa:')) quem = 'equipa ' + resto.slice(7);
  else if (l.quem === 'conta') { quem = 'conta ' + resto; userId = resto || null; }
  else if (l.quem === 'ip') quem = 'IP ' + resto;
  else quem = (/[.:]/.test(resto) ? 'IP ' : 'pseudónimo ') + resto;
  return { mensagem: 'Limite atingido: ' + l.o + ' · ' + quem, userId };
}

const HORA_DE_LISBOA = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/* Uma janela em segundos como se diz: 900 → «15 min», 3600 → «1 h».
   Recebe: s — a janela em segundos.
   Devolve: o texto. */
function janelaLegivel(s) {
  const n = Number(s) || 0;
  if (n >= 3600 && n % 3600 === 0) return n / 3600 + ' h';
  if (n >= 60 && n % 60 === 0) return n / 60 + ' min';
  return n + ' s';
}

/* O detalhe do ticket: a chave, o limite, a janela e a hora (de Lisboa).
   Recebe: key — a chave; limit — o máximo na janela; windowSec — a janela em
   segundos; t — o instante da recusa (ms); fim — quando a janela acaba (ms).
   Devolve: o texto, várias linhas. */
export function detalheDoLimite(key, limit, windowSec, t, fim) {
  return [
    'Chave: ' + key,
    'Limite: ' + limit + ' em ' + janelaLegivel(windowSec) + ', a contar do primeiro pedido',
    'Janela: até ' + HORA_DE_LISBOA.format(new Date(fim)) + ' (hora de Lisboa)',
    'Hora: ' + HORA_DE_LISBOA.format(new Date(t)) + ' (hora de Lisboa), a primeira recusa',
    '',
    'Cada janela em que o limite volta a ser atingido soma uma vez a este ticket; as recusas seguintes dentro da mesma janela não se contam (nem gastam escritas).',
    'Nada se faz sem a resolução proposta de alguém da equipa (Decidir, no back office).',
  ].join('\n');
}

// quanto o 429 espera, no máximo, pelo aviso no Discord (só ao abrir ou reabrir um ticket)
export const ESPERA_DO_AVISO_MS = 2000;

/* Avisa quem programa no Discord de um ticket de segurança aberto ou
   reaberto. Sem ctx (o rateLimit não o recebe) não há waitUntil, e um pedido
   por esperar morre com a resposta: por isso espera-se, mas nunca mais do que
   ESPERA_DO_AVISO_MS — um Discord lento não segura o 429. Nunca lança.
   Recebe: env — o ambiente do worker (canal ou webhook de quem programa);
   embed — o de limiteEmbed.
   Devolve: promessa de nada — o aviso seguiu, falhou ou demorou de mais. */
async function avisarDoLimite(env, embed) {
  let relogio;
  try {
    await Promise.race([
      Promise.resolve(notifyDev(env, null, embed)).catch(() => false),
      new Promise((pronto) => { relogio = setTimeout(pronto, ESPERA_DO_AVISO_MS); }),
    ]);
  } catch (e) { /* um aviso que falha não muda o 429 */ }
  clearTimeout(relogio);
}

/* Abre (ou engorda) o ticket de segurança de um limite atingido, na mesma
   tabela e com a mesma assinatura dos erros (lib/relatos.js:recordReport:
   categoria + ':' + os primeiros 120 caracteres da mensagem). Não passa pelo
   recordReport, que mede, avisa e junta pessoas de outra maneira (a cadência
   dos erros): um limite já só relata uma vez por janela.
   Um ticket que já existe soma uma vez, numa só escrita; se estava concluído
   reabre e larga a decisão antiga (a resolução proposta ou o arquivo), para
   se decidir de novo: o que se decidiu da outra vez já foi feito, ou era um
   falso alarme. Sem conta, o dono é a conta do sistema (CONTA_SISTEMA de
   lib/relatos.js, criada aqui se ainda não existir, como lá). Abrir e
   reabrir avisam quem programa no Discord (avisarDoLimite); somar a um
   aberto não avisa — o ticket já está na fila. Nunca lança.
   Recebe: env — o ambiente do worker (D1 em env.DB); key — a chave; limit,
   windowSec — o limite e a janela; t — o instante da recusa (ms); fim —
   quando a janela acaba (ms).
   Devolve: promessa de nada — o ticket fica gravado (ou não, se a base falhar). */
async function relatarLimite(env, key, limit, windowSec, t, fim) {
  const r = relatoDoLimite(key);
  if (!r) return;
  const msg = r.mensagem.slice(0, 2000);
  const fp = 'seguranca:' + msg.slice(0, 120);
  const detalhe = detalheDoLimite(key, limit, windowSec, t, fim);
  console.error({ relato: 'seguranca', msg: msg.slice(0, 300), quem: r.userId });
  medirRelato(env, 'seguranca', fp);
  let aviso = null;
  try {
    const antes = await env.DB.prepare('SELECT id, status, n FROM tickets WHERE fingerprint = ?').bind(fp).first();
    if (antes) {
      // num UPDATE, o lado direito lê os valores de antes: o CASE vê o estado antigo em todas as colunas
      const largar = (c) => c + " = CASE WHEN status = 'concluido' THEN NULL ELSE " + c + ' END';
      await env.DB.prepare(
        'UPDATE tickets SET n = n + 1, updated_at = ?, ' +
        ['accepted_at', 'accepted_by', 'accepted_by_nome', 'accepted_changes', 'refused_at', 'refused_by', 'refused_by_nome'].map(largar).join(', ') +
        ", status = CASE WHEN status = 'concluido' THEN 'criado' ELSE status END WHERE id = ?"
      ).bind(t, antes.id).run();
      if (antes.status === 'concluido') aviso = { id: antes.id, n: (Number(antes.n) || 0) + 1, reaberto: true };
    } else {
      if (!r.userId) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO users (id, email, name, pass_hash, pass_salt, created_at, deleted_at)
           VALUES (?, 'sistema@invalido', 'Sem utilizador', '', '', 0, 1)`
        ).bind(SISTEMA).run();
      }
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO tickets (id, user_id, kind, subject, body, status, category, fingerprint, n, context, created_at, updated_at)
         VALUES (?, ?, 'problema', ?, ?, 'criado', 'seguranca', ?, 1, '', ?, ?)`
      ).bind(id, r.userId || SISTEMA, msg.slice(0, 140), detalhe, fp, t, t).run();
      aviso = { id, n: 1, reaberto: false };
    }
    // quem bateu no limite conta nas pessoas do ticket, como nos erros
    if (r.userId) {
      await env.DB.prepare('INSERT OR IGNORE INTO ticket_users (fingerprint, user_id, first_at) VALUES (?, ?, ?)')
        .bind(fp, r.userId, t).run();
    }
  } catch (e) { /* um relato que falha não muda o 429 */ }
  if (aviso) {
    await avisarDoLimite(env, limiteEmbed(Object.assign(aviso, { message: msg, detail: detalhe, user_id: r.userId, created_at: t })));
  }
}

/* Conta mais um acontecimento na chave e diz se ainda cabe: true deixa
   passar, false é para responder 429. A janela é fixa — windowSec segundos a
   contar do primeiro acontecimento — e cada chamada que passa gasta uma
   escrita na D1.
   A primeira recusa de cada janela leva o contador de limit a limit + 1
   (uma escrita a mais, condicionada a n = limit: de dois pedidos ao mesmo
   tempo só um a ganha) e abre o ticket de segurança (relatarLimite). As
   recusas seguintes na mesma janela não escrevem nada: uma força bruta não
   pode virar uma escrita na D1 por pedido. As chaves que ficam de fora
   (LIMITES, fora: true) recusam como sempre, sem escrever.
   Se a base falhar, deixa passar: um contador em baixo não pode deitar o
   serviço abaixo. Um relato que falha não muda a resposta.
   Recebe: env — o ambiente do worker (D1 em env.DB); key — a chave do
   contador (ex.: 'login:' + ip); limit — o máximo de acontecimentos na
   janela; windowSec — a janela em segundos, a contar do primeiro.
   Devolve: true se ainda cabe (ou se a base falhou), false quando o limite
   foi atingido — é para responder 429. */
export async function rateLimit(env, key, limit, windowSec) {
  const t = now();
  let row;
  try {
    row = await env.DB.prepare('SELECT n, expires_at FROM rate_limits WHERE k = ?').bind(key).first();
    if (!row || row.expires_at < t) {
      await env.DB.prepare(
        `INSERT INTO rate_limits (k, n, expires_at) VALUES (?, 1, ?)
         ON CONFLICT (k) DO UPDATE SET n = 1, expires_at = excluded.expires_at`
      ).bind(key, t + windowSec * 1000).run();
      return true;
    }
    if (row.n < limit) {
      await env.DB.prepare('UPDATE rate_limits SET n = n + 1 WHERE k = ?').bind(key).run();
      return true;
    }
  } catch (e) {
    return true;   // um contador em baixo não pode deitar o serviço abaixo
  }
  // acima do limite: só a primeira recusa da janela relata
  if (Number(row.n) === Number(limit) && relatoDoLimite(key)) {
    try {
      const r = await env.DB.prepare('UPDATE rate_limits SET n = n + 1 WHERE k = ? AND n = ?').bind(key, limit).run();
      if (r && r.meta && r.meta.changes === 1) await relatarLimite(env, key, limit, windowSec, t, row.expires_at);
    } catch (e) { /* o 429 fica: o relato é informação, não decide a resposta */ }
  }
  return false;
}

/* Leva o lixo à frente: apaga os contadores cuja janela já acabou. Corre na
   vigia de hora a hora (index.js). Vivia dentro do rateLimit, «de vez em
   quando» — quando o contador era múltiplo de 25 —, mas o contador nunca
   passa do limite, e com limites até 25 (as chaves por IP da entrada, uma
   linha por endereço que tentou uma vez) o ramo nunca corria.
   Recebe: env — o ambiente do worker (D1 em env.DB); agora (opcional) — o
   instante de referência em milissegundos (por omissão, agora).
   Devolve: promessa de quantas linhas saíram (0 se a base falhar — limpar
   nunca pode travar a vigia). */
export async function limparLimites(env, agora) {
  try {
    const r = await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(agora || now()).run();
    return (r && r.meta && r.meta.changes) || 0;
  } catch (e) {
    return 0;
  }
}
