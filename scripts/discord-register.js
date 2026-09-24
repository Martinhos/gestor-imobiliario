// Regista os comandos do bot no Discord.
//
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... [DISCORD_GUILD_ID=...] \
//     node scripts/discord-register.js
//
// Com DISCORD_GUILD_ID, os comandos aparecem de imediato nesse servidor.
// Sem ele, ficam globais e podem demorar até uma hora a aparecer.

const APP = process.env.DISCORD_APP_ID;
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD = process.env.DISCORD_GUILD_ID;

if (!APP || !TOKEN) {
  console.error('Falta DISCORD_APP_ID ou DISCORD_BOT_TOKEN.');
  process.exit(1);
}

/* A lista vive em discord-comandos-lista.js, como dados, partilhada com o
   gerador da documentação: o que se regista é o que o /equipa/docs mostra. */
const { comandos } = require('./discord-comandos-lista.js');

// PUT da lista completa de comandos no endereço dado — o Discord substitui o
// que lá estava. Devolve { ok, status, texto } em vez de lançar, para quem
// chama poder tentar o registo global a seguir.
// Recebe: url — o endereço de registo (do servidor ou global).
// Devolve: promessa de { ok, status, texto } — se foi 2xx, o status HTTP e o
// corpo em texto cru; nunca lança.
const registar = (url) =>
  fetch(url, {
    method: 'PUT',
    headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(comandos),
  }).then(async (r) => ({ ok: r.ok, status: r.status, texto: await r.text() }));

const global = `https://discord.com/api/v10/applications/${APP}/commands`;

(async () => {
  /* Com dois bots (producao e dev), o erro classico e os secrets _DEV
     levarem os valores do outro. Antes de registar, diz-se QUEM somos:
     o nome da aplicacao denuncia a troca na hora. */
  const eu = await fetch('https://discord.com/api/v10/applications/@me', {
    headers: { Authorization: 'Bot ' + TOKEN },
  }).then((r) => r.json()).catch(() => null);
  if (eu && eu.name) {
    console.log('A registar como: "' + eu.name + '"' +
      (String(eu.id) === String(APP) ? '' : ' — ATENCAO: o token e de uma aplicacao DIFERENTE do DISCORD_APP_ID!'));
  }
  if (GUILD) {
    const r = await registar(`https://discord.com/api/v10/applications/${APP}/guilds/${GUILD}/commands`);
    if (r.ok) {
      console.log('Registados ' + comandos.length + ' comandos no servidor ' + GUILD + '.');
      return;
    }
    // 403 aqui quer dizer que o bot não foi convidado com o âmbito
    // applications.commands. Os comandos globais não dependem disso.
    console.warn('Não deu para registar no servidor (' + r.status + '): ' + r.texto);
    console.warn('A tentar registo global — convida o bot com o âmbito applications.commands ' +
      'para os comandos aparecerem de imediato.');
  }
  const g = await registar(global);
  if (!g.ok) {
    console.error('Falhou também o registo global (' + g.status + '): ' + g.texto);
    process.exit(1);
  }
  console.log('Registados ' + comandos.length + ' comandos globalmente. ' +
    'Podem demorar até uma hora a aparecer.');
})().catch((e) => { console.error(e); process.exit(1); });
