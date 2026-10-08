/* Sessões de quem trabalha no serviço.
   ------------------------------------
   Entra-se a partir do Discord e mais lado nenhum. Quem faz suporte corre
   /entrar no servidor, o bot responde com uma ligação de uso único, e essa
   ligação cria a sessão. Não há botão de "entrar com Discord" no ecrã de
   quem usa a app, nem sequer uma página onde tentar.

   Porquê assim e não por OAuth: a interação do Discord já traz quem é
   (i.member.user.id) e que cargos tem (i.member.roles), assinada com a
   chave do Discord. Um OAuth pediria à pessoa uma autorização para saber o
   que o bot já sabe, e obrigaria a expor um endereço de entrada.

   A sessão de equipa é deliberadamente separada da de quem usa a app: outro
   cookie, outro espaço no KV, outra função de leitura. Nenhuma das duas se
   pode fazer passar pela outra. */

import { json, err } from './lib/http.js';
import { auditar } from './lib/auditoria.js';
import { papeisDe } from './lib/papeis.js';
import { cargosDoMembro } from './lib/bot.js';

const BILHETE_TTL = 300;          // 5 minutos para usar a ligação
const SESSAO_TTL = 8 * 3600;      // 8 horas de sessão, um dia de trabalho
const INTERVALO_PAPEIS = 15 * 60 * 1000;    // de quanto em quanto se voltam a perguntar os cargos
const GRAVAR_VERIFICACAO = 60 * 60 * 1000;  // e de quanto em quanto isso se escreve no KV, se nada mudou
// As verificações que este isolate já fez, token → quando: poupam o KV (ver reverPapeis).
const verificadas = new Map();
export const COOKIE = 'gi_equipa';

// 32 bytes de aleatório criptográfico em hexadecimal (64 caracteres):
// serve de bilhete e de token de sessão.
// Devolve: o token (string de 64 caracteres hexadecimais).
function novoToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Um bilhete de uso único, criado a pedido do bot. Guarda quem é, que papéis
   tinha no momento e em que servidor de Discord correu o comando: os papéis
   voltam a ser perguntados a esse servidor enquanto a sessão dura (ver
   getEquipa), e isto deixa o registo do que se passou.

   Vive na base e não no KV, ao contrário da sessão que dele nasce. É a
   única coisa aqui que se escreve num sítio e se lê noutro: o bot é
   atendido perto do Discord e o clique perto de quem clica. O KV leva algum
   tempo a concordar consigo próprio entre regiões, e nesse intervalo uma
   ligação acabada de criar não existe para quem a abre.
   Recebe: env — o ambiente do worker (usa env.DB); quem — {discordId, nome,
   papel, papeis?, guildId?}, vindo do bot (guildId é o servidor onde o
   comando foi corrido).
   Devolve: {token, expiraEm} — o token do bilhete e a validade em segundos. */
export async function criarBilhete(env, quem) {
  const t = novoToken();
  const agora = Date.now();
  await env.DB.prepare(
    'INSERT INTO team_links (token, payload, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(t, JSON.stringify({
    discordId: quem.discordId,
    nome: quem.nome,
    papel: quem.papel,
    papeis: quem.papeis || [quem.papel],   // dois cargos somam, como no bot
    guildId: quem.guildId || null,
  }), agora, agora + BILHETE_TTL * 1000).run();

  // as que já não servem a ninguém não têm de ficar cá para sempre
  await env.DB.prepare('DELETE FROM team_links WHERE expires_at < ?')
    .bind(agora - 24 * 3600 * 1000).run();

  return { token: t, expiraEm: BILHETE_TTL };
}

/* O que uma ligação é, sem lhe mexer. Mostrar não é usar: a página de
   entrada precisa de saber a quem pertence, e não pode gastá-la só por
   alguém — ou alguma coisa — a ter aberto.
   Recebe: env — o ambiente do worker (usa env.DB); t — o token do bilhete (64 hex).
   Devolve: {estado: 'nao-existe' | 'usada' | 'expirou'}, ou {estado: 'boa', quem} com o payload do bilhete. */
export async function verBilhete(env, t) {
  const r = await env.DB.prepare('SELECT * FROM team_links WHERE token = ?').bind(t).first();
  if (!r) return { estado: 'nao-existe' };
  if (r.used_at) return { estado: 'usada' };
  if (r.expires_at < Date.now()) return { estado: 'expirou' };
  return { estado: 'boa', quem: JSON.parse(r.payload) };
}

/* Gastar a ligação. Numa só instrução de propósito: com ler-e-depois-apagar,
   dois pedidos ao mesmo tempo liam ambos a mesma ligação por usar e entravam
   os dois. Assim, quem marcar a linha primeiro é o único que entra.
   Recebe: env — o ambiente do worker (usa env.DB); t — o token do bilhete (64 hex).
   Devolve: o payload do bilhete ({discordId, nome, papel, papeis}) para quem o gastou;
   null se já estava usada, expirou ou não existe. */
async function usarBilhete(env, t) {
  const agora = Date.now();
  const r = await env.DB.prepare(
    'UPDATE team_links SET used_at = ? WHERE token = ? AND used_at IS NULL AND expires_at >= ?'
  ).bind(agora, t, agora).run();
  if (!r.meta || r.meta.changes !== 1) return null;
  const linha = await env.DB.prepare('SELECT payload FROM team_links WHERE token = ?').bind(t).first();
  return linha ? JSON.parse(linha.payload) : null;
}

// A linha Set-Cookie da sessão de equipa. Com expirar=true sai com
// Max-Age=0, que é como se apaga um cookie HttpOnly.
// Recebe: token — o token da sessão de equipa (ou '' para apagar); expirar (opcional) — true para o apagar.
// Devolve: a linha Set-Cookie completa (string).
export function cookieDaEquipa(token, expirar = false) {
  const maxAge = expirar ? 0 : SESSAO_TTL;
  return COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;
}

// O valor do cookie `nome`, mas só se tiver a forma de um token nosso
// (64 hex) — qualquer outra coisa vale null e nem chega a tocar no KV.
// Recebe: request — o pedido (Request); nome — o nome do cookie a procurar.
// Devolve: o valor do cookie (string de 64 hex) ou null.
function lerCookie(request, nome) {
  const c = request.headers.get('Cookie') || '';
  const m = new RegExp('(?:^|;\\s*)' + nome + '=([a-f0-9]{64})(?:;|$)').exec(c);
  return m ? m[1] : null;
}

/* Quem está a usar a ferramenta de equipa, ou null.
   Só lê o cookie da equipa: uma sessão de cliente nunca dá acesso a isto.

   Os papéis não ficam os da entrada durante as oito horas. Passado
   INTERVALO_PAPEIS desde a última verificação, voltam a ser perguntados ao
   Discord, com o token do bot, no servidor onde o /entrar foi corrido: tirar
   o cargo a alguém — que é como se gerem os acessos — tira-lhe o back office
   no pedido seguinte a esse intervalo, e quem saiu do servidor também sai
   daqui. Um Discord que não responde não tranca a equipa fora: vale o que se
   sabia, e volta-se a perguntar um minuto depois. Uma sessão sem servidor
   guardado (das de antes disto) ou um worker sem token do bot não têm a quem
   perguntar, e valem até expirar.
   Recebe: env — o ambiente do worker (usa env.SESSIONS; para a verificação,
   DISCORD_BOT_TOKEN, as listas DISCORD_* e env.DB para o rasto); request — o
   pedido, de onde sai o cookie.
   Devolve: promessa da sessão {token, discordId, nome, papel, papeis, desde,
   guildId, verificadoEm}, ou de null. */
export async function getEquipa(env, request) {
  const t = lerCookie(request, COOKIE);
  if (!t) return null;
  let s;
  try {
    const raw = await env.SESSIONS.get('equipa:' + t);
    if (!raw) return null;
    s = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  const visto = Math.max(s.verificadoEm || s.desde || 0, verificadas.get(t) || 0);
  if (Date.now() - visto >= INTERVALO_PAPEIS) {
    s = await reverPapeis(env, t, s);
    if (!s) return null;
  }
  return { token: t, ...s };
}

/* Pergunta ao Discord os cargos de quem tem esta sessão, e decide o que ela
   vale agora (a razão está no getEquipa).

   O custo conta, porque o KV dá mil escritas por dia e é o tecto mais
   apertado do plano: a verificação fica lembrada neste isolate (verificadas)
   e só se escreve no KV quando os papéis mudam ou uma vez por hora — uma
   equipa de cinco num dia inteiro são umas quarenta escritas. Ao Discord
   vai uma pergunta por sessão a cada INTERVALO_PAPEIS.
   Recebe: env — o ambiente do worker; token — o token da sessão; s — a
   sessão, tal como está no KV.
   Devolve: promessa da sessão com os papéis de agora (a mesma, se não houve
   a quem perguntar ou o Discord não respondeu), ou de null quando a pessoa
   ficou sem papel — e aí a sessão já foi apagada e o rasto escrito. */
async function reverPapeis(env, token, s) {
  const agora = Date.now();
  if (verificadas.size > 500) verificadas.clear();   // um teto, para o mapa não crescer sem fim
  const c = await cargosDoMembro(env, s.guildId, s.discordId);
  if (!c) {
    // sem a quem perguntar, ou sem resposta: vale o que se sabia, e tenta-se daqui a um minuto
    verificadas.set(token, agora - INTERVALO_PAPEIS + 60000);
    return s;
  }
  const antes = s.papeis || [s.papel];
  const papeis = c.saiu ? [] : papeisDe(env, { member: { user: { id: s.discordId }, roles: c.cargos } });
  if (!papeis.length) {
    verificadas.delete(token);
    await env.SESSIONS.delete('equipa:' + token);
    await auditar(env, { discordId: s.discordId, nome: s.nome, papeis: antes }, 'equipa.sair', null,
      c.saiu ? 'saiu do servidor de Discord: sessão terminada' : 'ficou sem cargo no Discord: sessão terminada');
    return null;
  }
  verificadas.set(token, agora);
  const nova = Object.assign({}, s, { papeis, papel: papeis[0] });
  const mudou = antes.join(',') !== papeis.join(',');
  if (mudou || agora - (s.verificadoEm || s.desde || 0) >= GRAVAR_VERIFICACAO) {
    nova.verificadoEm = agora;
    const resta = Math.floor(((s.desde || agora) + SESSAO_TTL * 1000 - agora) / 1000);
    if (resta >= 60) await env.SESSIONS.put('equipa:' + token, JSON.stringify(nova), { expirationTtl: resta });
  }
  if (mudou) {
    await auditar(env, { discordId: s.discordId, nome: s.nome, papeis }, 'equipa.papeis', null,
      antes.join(' + ') + ' → ' + papeis.join(' + '));
  }
  return nova;
}

/* As rotas de entrar e sair da ferramenta de equipa. Devolve a Response, ou
   null quando o pedido não é daqui e o worker deve seguir para as outras
   rotas. O que a ferramenta faz por dentro vive no equipa-api.js — aqui é
   só a porta.
   Recebe: c — o contexto do pedido ({env, request, path, method, url}).
   Devolve: a Response, ou null quando o pedido deve seguir para as outras rotas. */
export async function rotasEquipa(c) {
  const { env, request, path, method, url } = c;

  /* Abrir a ligação mostra uma página com um botão; não entra logo.

     Abrir era o que entrava, e isso fazia de um GET uma coisa destrutiva.
     Quem carregava a ligação primeiro ficava com ela — e quem carrega
     primeiro não é a pessoa: é o desdobrador de links do Discord, ou o
     cliente a preparar a pré-visualização, ou o browser a adiantar-se. A
     pessoa chegava a uma ligação já gasta por outra coisa qualquer.

     Um GET não muda nada; carregar no botão é que muda. Nada disso
     carrega em botões. */
  if (path === '/equipa/entrar' && method === 'GET') {
    const t = url.searchParams.get('t') || '';
    if (!/^[a-f0-9]{64}$/.test(t)) return err(400, 'Ligação inválida.');
    // onde aterrar depois de entrar — lista fechada, nunca um URL livre
    const depois = url.searchParams.get('depois') === 'docs' ? 'docs' : '';
    const { paginaEntrada } = await import('./equipa-vista.js');
    return paginaEntrada(t, await verBilhete(env, t), depois);
  }

  /* Aqui é que se entra mesmo. */
  if (path === '/equipa/entrar' && method === 'POST') {
    let t = '', depois = '';
    try {
      const f = await request.formData();
      t = String(f.get('t') || '');
      depois = String(f.get('depois') || '') === 'docs' ? 'docs' : '';
    } catch (e) { /* sem formulário */ }
    if (!/^[a-f0-9]{64}$/.test(t)) return err(400, 'Ligação inválida.');

    const b = await usarBilhete(env, t);
    if (!b) {
      const { paginaEntrada } = await import('./equipa-vista.js');
      return paginaEntrada(t, await verBilhete(env, t));
    }
    // cada entrada na ferramenta fica registada: é a porta dos dados pessoais
    await auditar(env, { discordId: b.discordId, nome: b.nome, papeis: b.papeis || [b.papel] },
      'equipa.entrar', null, null);
    const sessao = novoToken();
    const agora = Date.now();
    await env.SESSIONS.put('equipa:' + sessao, JSON.stringify({
      discordId: b.discordId, nome: b.nome, papel: b.papel,
      papeis: b.papeis || [b.papel], desde: agora,
      // os papéis do bilhete vieram do Discord há menos de cinco minutos
      guildId: b.guildId || null, verificadoEm: agora,
    }), { expirationTtl: SESSAO_TTL });

    return new Response(null, {
      // 303 e não 302: depois de um POST, o que se segue é um GET
      status: 303,
      headers: {
        Location: depois === 'docs' ? '/equipa/docs' : '/equipa',
        'Set-Cookie': cookieDaEquipa(sessao),
        'Cache-Control': 'no-store',
        // o endereço tinha um bilhete: não o deixar seguir para lado nenhum
        'Referrer-Policy': 'no-referrer',
      },
    });
  }

  if (path === '/api/equipa/eu' && method === 'GET') {
    const e = await getEquipa(env, request);
    if (!e) return err(401, 'Sem sessão de equipa.');
    return json({ discordId: e.discordId, nome: e.nome, papel: e.papel, desde: e.desde });
  }

  if (path === '/api/equipa/sair' && method === 'POST') {
    const e = await getEquipa(env, request);
    if (e) await env.SESSIONS.delete('equipa:' + e.token);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': cookieDaEquipa('', true),
      },
    });
  }

  return null;
}
