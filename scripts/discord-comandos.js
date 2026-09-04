// Pergunta ao Discord que comandos tem registados, no servidor e globais.
//
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... [DISCORD_GUILD_ID=...] \
//     node scripts/discord-comandos.js
//
// Serve para responder a "o comando não aparece" com um facto em vez de um
// palpite: ou está registado e é a aplicação que não o mostra, ou nunca lá
// chegou. São problemas diferentes.

const APP = process.env.DISCORD_APP_ID;
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD = process.env.DISCORD_GUILD_ID;

if (!APP || !TOKEN) {
  console.error('Falta DISCORD_APP_ID ou DISCORD_BOT_TOKEN.');
  process.exit(1);
}

// GET à API do Discord com o token do bot. Devolve {ok, estado, corpo} com
// o corpo em texto cru — em erro é isso mesmo que se quer mostrar.
const pedir = (url) =>
  fetch(url, { headers: { Authorization: 'Bot ' + TOKEN } })
    .then(async (r) => ({ ok: r.ok, estado: r.status, corpo: await r.text() }));

// Imprime a lista de comandos de uma resposta do pedir e devolve os nomes,
// para se poderem comparar servidor e globais. Em erro diz o que veio e devolve [].
function mostrar(titulo, r) {
  console.log('\n' + titulo);
  if (!r.ok) {
    console.log('  não deu (' + r.estado + '): ' + r.corpo.slice(0, 200));
    return [];
  }
  let lista;
  try { lista = JSON.parse(r.corpo); } catch (e) { console.log('  resposta ilegível'); return []; }
  if (!lista.length) { console.log('  nenhum'); return []; }
  lista.forEach((c) => {
    const perm = c.default_member_permissions;
    console.log('  /' + String(c.name).padEnd(12) +
      (perm ? 'permissões ' + perm : 'visível a todos') +
      '   ' + String(c.description || '').slice(0, 46));
  });
  return lista.map((c) => c.name);
}

(async () => {
  const base = 'https://discord.com/api/v10/applications/' + APP;

  let noServidor = [];
  if (GUILD) {
    noServidor = mostrar('No servidor ' + GUILD + ' (aparecem de imediato):',
      await pedir(base + '/guilds/' + GUILD + '/commands'));
  } else {
    console.log('\nSem DISCORD_GUILD_ID definido: não dá para ver os do servidor.');
  }

  const globais = mostrar('Globais (podem demorar até uma hora a aparecer):',
    await pedir(base + '/commands'));

  /* Um comando que só existe globalmente pode ainda não ter chegado ao
     cliente; um que exista no servidor devia aparecer logo. A diferença é o
     que diz se vale a pena esperar ou se há alguma coisa errada. */
  const soGlobal = globais.filter((n) => noServidor.indexOf(n) < 0);
  if (soGlobal.length) {
    console.log('\nSó globais, e por isso possivelmente ainda por aparecer: ' + soGlobal.join(', '));
  }
  if (!noServidor.length && !globais.length) {
    console.log('\nO bot não tem comandos registados em lado nenhum.');
  }
})().catch((e) => { console.error(e); process.exit(1); });
