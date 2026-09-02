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
   mas isto deixa o registo do que se passou. */
export async function criarBilhete(env, quem) {
  const t = novoToken();
  await env.SESSIONS.put('bilhete:' + t, JSON.stringify({
    discordId: quem.discordId,
    nome: quem.nome,
    papel: quem.papel,
    criado: Date.now(),
  }), { expirationTtl: BILHETE_TTL });
  return { token: t, expiraEm: BILHETE_TTL };
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

  /* Trocar o bilhete por uma sessão. É uma navegação, não um pedido de API:
     responde-se com um redirecionamento para a ferramenta, já com o cookie
     posto — e o token sai do endereço, para não ficar no histórico nem no
     referer. */
  if (path === '/equipa/entrar' && method === 'GET') {
    const t = url.searchParams.get('t') || '';
    if (!/^[a-f0-9]{64}$/.test(t)) return err(400, 'Ligação inválida.');
    const raw = await env.SESSIONS.get('bilhete:' + t);
    if (!raw) return err(410, 'Esta ligação já foi usada ou expirou. Corre /entrar outra vez no Discord.');
    await env.SESSIONS.delete('bilhete:' + t);   // uso único, sem margem

    const b = JSON.parse(raw);
    const sessao = novoToken();
    await env.SESSIONS.put('equipa:' + sessao, JSON.stringify({
      discordId: b.discordId, nome: b.nome, papel: b.papel, desde: Date.now(),
    }), { expirationTtl: SESSAO_TTL });

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/equipa',
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
