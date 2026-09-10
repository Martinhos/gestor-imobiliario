/* O envio de uma mensagem pelo bot do Discord — e só isso.

   Vive aqui, e não no discord.js, porque o notify.js precisa dele para o
   resumo diário e para os avisos, e o discord.js precisa do notify.js para o
   /resumo e o /uso: um ciclo, que em módulos ES pode dar zona morta temporal
   em runtime e num Worker aparece como um 500 sem explicação. Uma chamada
   HTTP não tem razão nenhuma para saber dos comandos. */

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
