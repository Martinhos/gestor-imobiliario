/* O que o worker diz e pergunta ao Discord como bot: enviar uma mensagem, e
   saber os cargos que alguém tem agora num servidor — e só isso.

   Vive aqui, e não no discord.js, porque o notify.js precisa do envio para o
   resumo diário e para os avisos, e o discord.js precisa do notify.js para o
   /resumo e o /uso: um ciclo, que em módulos ES pode dar zona morta temporal
   em runtime e num Worker aparece como um 500 sem explicação. Pela mesma
   razão, a sessão de equipa (equipa.js, que o bot importa) pergunta os cargos
   por aqui e não pelo bot. Uma chamada HTTP não tem razão nenhuma para saber
   dos comandos. */

// Mensagem num canal usando o bot (permite botões, ao contrário do webhook).
// Recebe: env — as variáveis de ambiente (usa DISCORD_BOT_TOKEN); channelId —
// o id do canal de Discord; payload — o corpo da mensagem (content, embeds, components).
// Devolve: promessa de booleano — true se o Discord aceitou a mensagem.
export async function postAsBot(env, channelId, payload) {
  if (!env.DISCORD_BOT_TOKEN || !channelId) return false;
  try {
    const r = await fetch('https://discord.com/api/v10/channels/' + channelId + '/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

/* Os cargos que uma pessoa tem agora num servidor de Discord, perguntados
   com o token do bot. É a mesma pergunta para o /access (gravar exceções
   contra o cargo de agora, não contra o que viajou na mensagem) e para a
   sessão de equipa (tirar o cargo tem de tirar o back office). Com prazo:
   quem espera é um clique ou uma página.
   Recebe: env — as variáveis de ambiente (usa DISCORD_BOT_TOKEN); guildId —
   o id do servidor de Discord; userId — o id de Discord da pessoa.
   Devolve: promessa de { cargos } com a lista de ids de cargo; de
   { saiu: true } quando o Discord diz que a pessoa já não é membro do
   servidor; ou de null quando não deu para perguntar (sem token, sem
   servidor, sem rede, ou outra resposta qualquer). */
export async function cargosDoMembro(env, guildId, userId) {
  if (!env.DISCORD_BOT_TOKEN || !guildId || !userId) return null;
  const corta = typeof AbortController === 'function' ? new AbortController() : null;
  const prazo = corta ? setTimeout(() => { try { corta.abort(); } catch (e) {} }, 3000) : null;
  try {
    const r = await fetch('https://discord.com/api/v10/guilds/' + guildId + '/members/' + userId, {
      headers: { Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN },
      signal: corta ? corta.signal : undefined,
    });
    if (r.status === 404) {
      // 10007 é «Unknown Member»; um 404 do servidor (o bot saiu dele) não diz nada da pessoa
      const j = await r.json().catch(() => ({}));
      return j && j.code === 10007 ? { saiu: true } : null;
    }
    if (!r.ok) return null;
    const m = await r.json();
    return { cargos: Array.isArray(m && m.roles) ? m.roles : [] };
  } catch (e) {
    return null;
  } finally {
    if (prazo) clearTimeout(prazo);
  }
}
