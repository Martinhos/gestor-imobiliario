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
   pode fazer passar pela outra.

   A exceção é só do dev, e só numa direção (entrarPelaSessaoDeTeste): lá, a
   sessão de uma conta de teste abre uma sessão de equipa NOVA, em nome de
   quem pediu a ligação do /test e com os cargos que o Discord lhe dá nesse
   momento. A sessão de teste não serve de sessão de equipa — a API do back
   office continua a pedir o cookie da equipa. */

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
// As páginas do back office que a sessão de teste do dev abre, e para onde se volta depois
// de entrar: o próprio endereço, sempre um destes (entrarPelaSessaoDeTeste).
const PAGINAS_DO_TESTE = ['/equipa', '/equipa/', '/equipa/docs'];
// Quantos servidores do bot se perguntam, no máximo, pelos cargos de quem vem do /test.
const TETO_SERVIDORES = 5;

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

/* Uma sessão de equipa nova no KV, com a forma de sempre — a mesma pela
   ligação do /entrar e pela sessão de teste do dev, para o resto (o
   getEquipa, os papéis revistos, o sair, a pílula do QA) não saber por onde
   se entrou. Os papéis contam como verificados agora: quem chama acabou de
   os ter do Discord.
   Recebe: env — o ambiente do worker (usa env.SESSIONS); quem — {discordId,
   nome, papel, papeis?, guildId?} (o payload do bilhete, ou o que
   entrarPelaSessaoDeTeste montou).
   Devolve: promessa do token da sessão (64 hexadecimais), já gravada por
   SESSAO_TTL. */
async function guardarSessao(env, quem) {
  const sessao = novoToken();
  const agora = Date.now();
  await env.SESSIONS.put('equipa:' + sessao, JSON.stringify({
    discordId: quem.discordId, nome: quem.nome, papel: quem.papel,
    papeis: quem.papeis || [quem.papel], desde: agora,
    guildId: quem.guildId || null, verificadoEm: agora,
  }), { expirationTtl: SESSAO_TTL });
  return sessao;
}

/* Os servidores de Discord onde está o bot deste worker, perguntados com o
   token dele. A ligação do /test não diz em que servidor foi pedida, e os
   cargos só se perguntam a um servidor de cada vez (lib/bot.js:cargosDoMembro).
   Os cargos que contam são os das listas deste worker (lib/papeis.js), que
   são as do servidor onde o bot dele vive — o mesmo onde se corre o /entrar.
   Com prazo, como as outras perguntas ao Discord: quem espera é uma página.
   Recebe: env — o ambiente do worker (usa DISCORD_BOT_TOKEN).
   Devolve: promessa da lista de ids de servidor (até TETO_SERVIDORES, pela
   ordem do Discord), vazia sem token, sem rede ou com outra resposta. */
async function servidoresDoBot(env) {
  if (!env.DISCORD_BOT_TOKEN) return [];
  const corta = typeof AbortController === 'function' ? new AbortController() : null;
  const prazo = corta ? setTimeout(() => { try { corta.abort(); } catch (e) {} }, 3000) : null;
  try {
    const r = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN },
      signal: corta ? corta.signal : undefined,
    });
    if (!r.ok) return [];
    const l = await r.json();
    return (Array.isArray(l) ? l : []).map((g) => String((g && g.id) || ''))
      .filter((id) => /^\d{1,20}$/.test(id)).slice(0, TETO_SERVIDORES);
  } catch (e) {
    return [];
  } finally {
    if (prazo) clearTimeout(prazo);
  }
}

/* Os papéis de equipa que uma pessoa tem agora, pelo mesmo caminho do
   reverPapeis (lib/bot.js:cargosDoMembro e lib/papeis.js:papeisDe), no
   primeiro servidor do bot onde é membro com algum papel. Os servidores
   perguntam-se ao mesmo tempo; quem não é membro, ou um servidor que não
   responde, não conta.
   Recebe: env — o ambiente do worker; discordId — o id de Discord da pessoa.
   Devolve: promessa de {guildId, papeis} (papeis do mais alto para o mais
   baixo, nunca vazio), ou de null sem papel, sem servidor ou sem resposta. */
async function papeisNosServidores(env, discordId) {
  const servidores = await servidoresDoBot(env);
  const respostas = await Promise.all(servidores.map((g) => cargosDoMembro(env, g, discordId)));
  for (let i = 0; i < servidores.length; i++) {
    const c = respostas[i];
    if (!c || c.saiu) continue;
    const papeis = papeisDe(env, { member: { user: { id: discordId }, roles: c.cargos } });
    if (papeis.length) return { guildId: servidores[i], papeis };
  }
  return null;
}

/* No dev, o back office abre com a sessão de teste (decisão do Martinho,
   2026-11-09, ticket de QA 68c59ce4): quem entrou na app por uma ligação do
   /test e abre o /equipa sem sessão de equipa entra em nome da pessoa do
   Discord que pediu essa ligação (users.test_owner,
   teste.js:discordDaSessaoDeTeste), com os cargos que o Discord lhe dá
   agora (papeisNosServidores). Abre-se uma sessão de equipa normal
   (guardarSessao), fica na auditoria como entrada — com a conta de teste por
   alvo e a dizer de onde veio — e volta-se ao mesmo endereço com o cookie
   da equipa. Daí para a frente é uma sessão como as do /entrar.

   Só abre:
   · com o ENV_NAME 'dev' — a produção e o percurso saem na primeira linha,
     sem ler nada;
   · num GET de uma das PAGINAS_DO_TESTE: navegar, nunca a API (que continua
     a pedir o cookie da equipa), e o regresso é sempre o próprio endereço,
     de uma lista fechada, sem a query — nenhum redirecionamento livre;
   · sem Sec-Fetch-Site de outro site: o cookie da sessão de teste é
     SameSite=Lax e iria numa navegação vinda de fora. A sessão nova seria
     sempre da própria pessoa, e o cookie só ficava no browser dela, mas
     nenhuma página de fora tem de poder abrir sessões de equipa em nome de
     ninguém. A pílula (mesma origem) e o endereço escrito à mão passam;
   · sem a marca de quem saiu (teste.js:saiuDaEquipa): «Sair» fica fora até
     um /test novo ou um /entrar, que a tiram (decisão do Martinho,
     2026-11-09);
   · com a sessão de uma conta de teste com dono, e um papel de equipa
     confirmado pelo Discord neste pedido;
   · com o rasto escrito: sem a linha da auditoria, a sessão apaga-se.
   Qualquer falha (a base, o KV, o Discord) fica na página de entrada de
   sempre, nunca num 500.
   Recebe: env — o ambiente do worker; request — o pedido (o cookie da sessão
   de teste e o Sec-Fetch-Site); url — o URL dele.
   Devolve: promessa da Response 303 com o Set-Cookie da equipa, ou de null —
   e aí quem chama mostra a página de entrada. */
export async function entrarPelaSessaoDeTeste(env, request, url) {
  if (env.ENV_NAME !== 'dev') return null;
  if (request.method !== 'GET' || PAGINAS_DO_TESTE.indexOf(url.pathname) < 0) return null;
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'none') return null;
  try {
    const { discordDaSessaoDeTeste, saiuDaEquipa } = await import('./teste.js');
    if (saiuDaEquipa(request)) return null;
    const dono = await discordDaSessaoDeTeste(env, request);
    if (!dono) return null;
    const achados = await papeisNosServidores(env, dono.id);
    if (!achados) return null;
    const quem = {
      discordId: dono.id, nome: dono.nome || dono.id,
      papel: achados.papeis[0], papeis: achados.papeis, guildId: achados.guildId,
    };
    const sessao = await guardarSessao(env, quem);
    if (!(await auditar(env, quem, 'equipa.entrar', dono.conta, 'pela sessão de teste do dev, sem o /entrar'))) {
      await env.SESSIONS.delete('equipa:' + sessao);
      return null;
    }
    return new Response(null, {
      status: 303,
      headers: { Location: url.pathname, 'Set-Cookie': cookieDaEquipa(sessao), 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('equipa pela sessão de teste', e && e.message);
    return null;
  }
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
    // os papéis do bilhete vieram do Discord há menos de cinco minutos
    const sessao = await guardarSessao(env, b);

    const cabecalhos = new Headers({
      Location: depois === 'docs' ? '/equipa/docs' : '/equipa',
      'Set-Cookie': cookieDaEquipa(sessao),
      'Cache-Control': 'no-store',
      // o endereço tinha um bilhete: não o deixar seguir para lado nenhum
      'Referrer-Policy': 'no-referrer',
    });
    // no dev, entrar pelo Discord também tira a marca de quem tinha saído (teste.js:cookieSaiuDaEquipa)
    if (env.ENV_NAME === 'dev') {
      const { saiuDaEquipa, cookieSaiuDaEquipa } = await import('./teste.js');
      if (saiuDaEquipa(request)) cabecalhos.append('Set-Cookie', cookieSaiuDaEquipa(true));
    }
    // 303 e não 302: depois de um POST, o que se segue é um GET
    return new Response(null, { status: 303, headers: cabecalhos });
  }

  if (path === '/api/equipa/eu' && method === 'GET') {
    const e = await getEquipa(env, request);
    if (!e) return err(401, 'Sem sessão de equipa.');
    return json({ discordId: e.discordId, nome: e.nome, papel: e.papel, desde: e.desde });
  }

  if (path === '/api/equipa/sair' && method === 'POST') {
    const e = await getEquipa(env, request);
    if (e) await env.SESSIONS.delete('equipa:' + e.token);
    const cabecalhos = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': cookieDaEquipa('', true),
    });
    // no dev, sair fica fora até um /test novo: sem a marca, o recarregar voltava a entrar pela sessão de teste
    if (env.ENV_NAME === 'dev') {
      const { cookieSaiuDaEquipa } = await import('./teste.js');
      cabecalhos.append('Set-Cookie', cookieSaiuDaEquipa());
    }
    return new Response(JSON.stringify({ ok: true }), { headers: cabecalhos });
  }

  return null;
}
