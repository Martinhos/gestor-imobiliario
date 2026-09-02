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

const TEXTO = 3, INTEIRO = 4, BOOLEANO = 5, UTILIZADOR = 6;

/* Quem vê cada comando.
   O Discord não conhece os nossos papéis, só as permissões dele. O que se
   pode fazer daqui é esconder por omissão o que é de operação — quem não
   gere o servidor deixa de ver /uso, /resumo e /copias. Para afinar por
   cargo (dar /erros aos devs, /pedidos ao suporte), é no servidor:
   Definições do servidor → Integrações → o bot → Permissões dos comandos.
   O bot valida sempre o papel outra vez, mesmo que alguém veja o comando. */
const GERIR_SERVIDOR = '32';   // MANAGE_GUILD
const soOperacao = { default_member_permissions: GERIR_SERVIDOR };

const comandos = [
  {
    name: 'pedidos',
    description: 'Pedidos de ajuda por tratar',
    options: [
      {
        type: TEXTO, name: 'categoria', description: 'De onde veio', required: false,
        choices: [
          { name: 'contado por alguém', value: 'user' },
          { name: 'erro na app', value: 'client' },
          { name: 'erro no servidor', value: 'server' },
          { name: 'infraestrutura', value: 'infra' },
          { name: 'segurança', value: 'seguranca' },
        ],
      },
      {
        type: TEXTO, name: 'estado', description: 'Filtrar por estado', required: false,
        choices: [
          { name: 'recebidos', value: 'criado' },
          { name: 'em resolução', value: 'resolucao' },
          { name: 'concluídos', value: 'concluido' },
        ],
      },
    ],
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
  Object.assign({ name: 'uso', description: 'Consumo da infraestrutura agora' }, soOperacao),
  { name: 'comandos', description: 'O que podes fazer com o teu papel' },
  { name: 'entrar', description: 'Abrir a ferramenta de suporte no browser' },
  Object.assign({
    name: 'access',
    description: 'Quem pode que comandos (só o master)',
    // uma opção só: o que se muda, muda-se nas caixas da própria resposta
    options: [
      { type: UTILIZADOR, name: 'utilizador', description: 'De quem', required: true },
    ],
  }, soOperacao),
  Object.assign({
    name: 'copias',
    description: 'Cópias da base de dados no R2',
    options: [{
      type: BOOLEANO, name: 'agora', description: 'Fazer uma cópia já', required: false,
    }],
  }, soOperacao),
  Object.assign({ name: 'resumo', description: 'Enviar o resumo diário para o canal de administração' }, soOperacao),
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
