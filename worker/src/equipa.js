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

const BILHETE_TTL = 300;          // 5 minutos para usar a ligação
const SESSAO_TTL = 8 * 3600;      // 8 horas de sessão, um dia de trabalho
export const COOKIE = 'gi_equipa';

function novoToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Um bilhete de uso único, criado a pedido do bot. Guarda quem é e que papel
   tinha no momento — o papel volta a ser verificado quando a sessão é usada,
   mas isto deixa o registo do que se passou.

   Vive na base e não no KV, ao contrário da sessão que dele nasce. É a
   única coisa aqui que se escreve num sítio e se lê noutro: o bot é
   atendido perto do Discord e o clique perto de quem clica. O KV leva algum
   tempo a concordar consigo próprio entre regiões, e nesse intervalo uma
   ligação acabada de criar não existe para quem a abre. */
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
  }), agora, agora + BILHETE_TTL * 1000).run();

  // as que já não servem a ninguém não têm de ficar cá para sempre
  await env.DB.prepare('DELETE FROM team_links WHERE expires_at < ?')
    .bind(agora - 24 * 3600 * 1000).run();

  return { token: t, expiraEm: BILHETE_TTL };
}

/* O que uma ligação é, sem lhe mexer. Mostrar não é usar: a página de
   entrada precisa de saber a quem pertence, e não pode gastá-la só por
   alguém — ou alguma coisa — a ter aberto. */
export async function verBilhete(env, t) {
  const r = await env.DB.prepare('SELECT * FROM team_links WHERE token = ?').bind(t).first();
  if (!r) return { estado: 'nao-existe' };
  if (r.used_at) return { estado: 'usada' };
  if (r.expires_at < Date.now()) return { estado: 'expirou' };
  return { estado: 'boa', quem: JSON.parse(r.payload) };
}

/* Gastar a ligação. Numa só instrução de propósito: com ler-e-depois-apagar,
   dois pedidos ao mesmo tempo liam ambos a mesma ligação por usar e entravam
   os dois. Assim, quem marcar a linha primeiro é o único que entra. */
async function usarBilhete(env, t) {
  const agora = Date.now();
  const r = await env.DB.prepare(
    'UPDATE team_links SET used_at = ? WHERE token = ? AND used_at IS NULL AND expires_at >= ?'
  ).bind(agora, t, agora).run();
  if (!r.meta || r.meta.changes !== 1) return null;
  const linha = await env.DB.prepare('SELECT payload FROM team_links WHERE token = ?').bind(t).first();
  return linha ? JSON.parse(linha.payload) : null;
}

export function cookieDaEquipa(token, expirar = false) {
  const maxAge = expirar ? 0 : SESSAO_TTL;
  return COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;
}

function lerCookie(request, nome) {
  const c = request.headers.get('Cookie') || '';
  const m = new RegExp('(?:^|;\\s*)' + nome + '=([a-f0-9]{64})(?:;|$)').exec(c);
  return m ? m[1] : null;
}

/* Quem está a usar a ferramenta de equipa, ou null.
   Só lê o cookie da equipa: uma sessão de cliente nunca dá acesso a isto. */
export async function getEquipa(env, request) {
  const t = lerCookie(request, COOKIE);
  if (!t) return null;
  try {
    const raw = await env.SESSIONS.get('equipa:' + t);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return { token: t, ...s };
  } catch (e) {
    return null;
  }
}

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
    await env.SESSIONS.put('equipa:' + sessao, JSON.stringify({
      discordId: b.discordId, nome: b.nome, papel: b.papel,
      papeis: b.papeis || [b.papel], desde: Date.now(),
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
