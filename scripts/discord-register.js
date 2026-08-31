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

const TEXTO = 3, INTEIRO = 4;

const comandos = [
  {
    name: 'pedidos',
    description: 'Pedidos de ajuda por tratar',
    options: [{
      type: TEXTO, name: 'estado', description: 'Filtrar por estado', required: false,
      choices: [
        { name: 'recebidos', value: 'criado' },
        { name: 'em resolução', value: 'resolucao' },
        { name: 'concluídos', value: 'concluido' },
      ],
    }],
  },
  {
    name: 'pedido',
    description: 'Ver um pedido e agir sobre ele',
    options: [{ type: TEXTO, name: 'id', description: 'Id do pedido (bastam os primeiros caracteres)', required: true }],
  },
  {
    name: 'responder',
    description: 'Responder e marcar como em resolução',
    options: [
      { type: TEXTO, name: 'id', description: 'Id do pedido', required: true },
      { type: TEXTO, name: 'texto', description: 'Resposta que a pessoa vai ler na app', required: true },
    ],
  },
  {
    name: 'fechar',
    description: 'Marcar um pedido como concluído',
    options: [
      { type: TEXTO, name: 'id', description: 'Id do pedido', required: true },
      { type: TEXTO, name: 'texto', description: 'Resposta final (opcional)', required: false },
    ],
  },
  {
    name: 'erros',
    description: 'Erros recentes da aplicação',
    options: [{ type: INTEIRO, name: 'horas', description: 'Janela em horas (24 por omissão)', required: false }],
  },
  { name: 'uso', description: 'Consumo da infraestrutura agora' },
  { name: 'resumo', description: 'Enviar o resumo diário para o canal de administração' },
];

const registar = (url) =>
  fetch(url, {
    method: 'PUT',
    headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(comandos),
  }).then(async (r) => ({ ok: r.ok, status: r.status, texto: await r.text() }));

const global = `https://discord.com/api/v10/applications/${APP}/commands`;

(async () => {
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
