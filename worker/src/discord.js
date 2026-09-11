// Bot do Discord, alojado no próprio worker: o Discord envia as interações
// por HTTP e nós respondemos. Duas vistas — quem programa trata dos pedidos
// e dos erros, quem opera vê o consumo da infraestrutura.

import { dailyReport, usageFields } from './notify.js';
import { lerAcessos, guardarAcessos, origemDoAcesso, excecoesDoMenu } from './acessos.js';
import {
  PAPEIS, PODEM_TUDO, SO_MASTER, PERMISSOES, CATS_DO_PAPEL,
  comoLista, nomeDoPapel, cor, catsDe, papeisDe, papel,
} from './lib/papeis.js';
import { postAsBot } from './lib/bot.js';
/* Os papéis e o envio pelo bot vivem em lib/, porque são lidos de mais do que
   um lado (o back office, o notify.js, o gerador de docs) e daqui faziam
   ciclos de importação. Saem na mesma por aqui, para quem já os importava
   do bot — os testes, sobretudo. */
export {
  PAPEIS, PODEM_TUDO, SO_MASTER, PERMISSOES, CATS_DO_PAPEL, catsDe, papeisDe, papel,
} from './lib/papeis.js';
export { postAsBot } from './lib/bot.js';

const PONG = { type: 1 };
const MSG = 4;            // responder com mensagem
const ADIADO = 5;         // «estou a tratar disso» — a resposta vem a seguir
const UPDATE = 7;         // substituir a mensagem do botão

// Converte uma string hexadecimal (chave pública, assinatura) nos bytes correspondentes.
// Recebe: s — string hexadecimal, dois dígitos por byte, sem prefixo.
// Devolve: Uint8Array com os bytes correspondentes.
const hex = (s) => {
  const a = new Uint8Array(s.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16);
  return a;
};

// A assinatura Ed25519 do Discord é a única autenticação deste endpoint.
// Recebe: env — variáveis de ambiente (usa DISCORD_PUBLIC_KEY, em hexadecimal);
// sig — a assinatura Ed25519 em hexadecimal (cabeçalho X-Signature-Ed25519);
// ts — o timestamp em segundos (cabeçalho X-Signature-Timestamp); raw — o corpo
// do pedido tal e qual chegou, em texto.
// Devolve: promessa de booleano — true se a assinatura é válida e recente.
export async function verifySignature(env, sig, ts, raw) {
  if (!env.DISCORD_PUBLIC_KEY || !sig || !ts) return false;
  /* A assinatura prova que foi o Discord a escrever — mas um pedido antigo
     capturado continuava válido para sempre. O timestamp está dentro do que
     se assina, por isso rejeitar os velhos fecha o replay sem custo. Dez
     minutos de margem cobrem qualquer relógio torto. */
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 600) return false;
  const data = new TextEncoder().encode(ts + raw);
  for (const alg of ['Ed25519', 'NODE-ED25519']) {
    try {
      const key = await crypto.subtle.importKey('raw', hex(env.DISCORD_PUBLIC_KEY), { name: alg }, false, ['verify']);
      if (await crypto.subtle.verify({ name: alg }, key, hex(sig), data)) return true;
    } catch (e) { /* tenta o algoritmo seguinte */ }
  }
  return false;
}

// Resposta efémera: só quem correu o comando a vê.
// Recebe: content (opcional) — o texto da mensagem; embeds (opcional) — lista de embeds do Discord.
// Devolve: o objeto de interação (type 4, flags 64) pronto a ir na Response.
const reply = (content, embeds) => ({
  type: MSG,
  data: { content: content || '', embeds: embeds || [], flags: 64 },   // 64 = só quem escreveu vê
});
/* Uma resposta que demora mais do que o Discord espera.

   O Discord corta a interação aos 3 segundos, e há comandos que não cabem lá:
   o /uso faz seis consultas à base, lista as cópias no R2 e ainda pergunta o
   consumo à API da Cloudflare. Passou dos 3s e o Discord respondeu «o
   aplicativo não respondeu» — que é o que ele diz quando ninguém lhe responde.

   Adiar é o caminho previsto para isto: responde-se já um «estou a tratar
   disso» (type 5), e a resposta verdadeira escreve-se depois POR CIMA dessa
   mensagem, pelo webhook da própria interação — que não precisa de token de
   bot, porque o token da interação é a credencial.

   O trabalho corre no ctx.waitUntil: sem isso o worker podia ser desligado
   assim que devolvesse a resposta imediata.
   Recebe: ctx — o contexto de execução do worker; i — a interação (traz o
   application_id e o token); trabalho — função que devolve a resposta final
   (o mesmo formato do reply).
   Devolve: a resposta imediata a mandar ao Discord. */
function adiar(ctx, i, trabalho) {
  const url = 'https://discord.com/api/v10/webhooks/' +
    i.application_id + '/' + i.token + '/messages/@original';
  const escrever = (corpo) => fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  }).catch(() => {});
  const feito = Promise.resolve().then(trabalho)
    .then((r) => escrever((r && r.data) || { content: 'Feito.' }))
    .catch((e) => escrever({ content: 'Correu mal: ' + cut((e && e.message) || e, 300) }));
  if (ctx && ctx.waitUntil) ctx.waitUntil(feito);
  // as flags vêm daqui: depois de adiada, a mensagem não pode mudar de efémera
  return { type: ADIADO, data: { flags: 64 } };
}

// Resposta à vista de todos no canal, com botões opcionais.
// Recebe: content (opcional) — o texto; embeds (opcional) — lista de embeds;
// components (opcional) — as action rows com botões ou menus.
// Devolve: o objeto de interação (type 4, sem flags) pronto a ir na Response.
const publico = (content, embeds, components) => ({
  type: MSG,
  data: { content: content || '', embeds: embeds || [], components: components || [] },
});

const ESTADOS = { criado: 'Recebido', resolucao: 'Em resolução', concluido: 'Concluído' };

// De onde veio o que precisa de atenção. Um pedido contado por uma pessoa e um
// erro apanhado sozinho vivem na mesma fila, separados pela categoria.
const CATS = {
  user: 'contado por alguém',
  client: 'erro na app',
  server: 'erro no servidor',
  infra: 'infraestrutura',
  seguranca: 'segurança',
};
const ICONE = { user: '💬 ', client: '🐞 ', server: '🔥 ', infra: '📊 ', seguranca: '🔒 ' };
const COR = { user: 0x2f7d5b, client: 0xd6a34a, server: 0xb94a48, infra: 0x7aa9d6, seguranca: 0x8a7bb8 };
// Corta o texto a n caracteres, com reticências — o Discord recusa campos longos.
// Recebe: s — o texto (qualquer valor; null e undefined viram ''); n — o comprimento máximo em caracteres.
// Devolve: string com n caracteres no máximo, terminada em '…' quando cortada.
const cut = (s, n) => { const t = String(s == null ? '' : s); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/* O papel é a regra; as exceções por pessoa são o remendo. Passar `acessos`
   é opcional de propósito: sem elas, isto continua a ser a função pura que
   os testes usam, e o comportamento é o do papel.
   Recebe: pap — um papel (string) ou lista de papéis; comando — o nome do
   comando (ex.: 'pedidos'); acessos (opcional) — as exceções { mais, menos }
   da pessoa, lidas do KV.
   Devolve: booleano — true se a pessoa pode correr o comando. */
export function podeCorrer(pap, comando, acessos) {
  const papeis = comoLista(pap);
  if (!papeis.length) return false;
  if (SO_MASTER.indexOf(comando) > -1) return papeis.indexOf('master') > -1;
  const origem = origemDoAcesso(papeis, comando, acessos, { PERMISSOES, PODEM_TUDO, SO_MASTER });
  return origem === 'papel' || origem === 'dado';
}

// Os comandos que esta pessoa pode correr, para o /comandos e para as recusas.
// Recebe: pap — um papel (string) ou lista de papéis; acessos (opcional) — as
// exceções { mais, menos } da pessoa.
// Devolve: lista com os nomes dos comandos que pode correr.
export function comandosDe(pap, acessos) {
  return Object.keys(PERMISSOES).filter((c) => podeCorrer(pap, c, acessos));
}

// O embed completo de um pedido: estado, categoria, de quem veio e a resposta
// já dada. Fica cinzento quando concluído.
// Recebe: t — a linha do pedido tal como sai da tabela tickets (id, subject,
// body, status, category, user_id, created_at, e versao/context/reply se houver).
// Devolve: o objeto embed do Discord, pronto a ir numa resposta.
function ticketEmbedFull(t) {
  return {
    title: (t.kind === 'problema' ? '🐞 ' : '💡 ') + cut(t.subject, 90),
    description: cut(t.body, 1500),
    color: t.status === 'concluido' ? 0x9aa7a1 : (t.kind === 'problema' ? 0xb94a48 : 0x2f7d5b),
    fields: [
      { name: 'Estado', value: ESTADOS[t.status] || t.status, inline: true },
      { name: 'Categoria', value: CATS[t.category] || t.category || 'user', inline: true },
      { name: 'De', value: cut(t.user_id, 40), inline: true },
      { name: 'Aberto em', value: new Date(t.created_at).toISOString().slice(0, 16).replace('T', ' '), inline: true },
    ].concat(
      t.versao ? [{ name: 'Versão da app', value: 'v' + t.versao, inline: true }] : [],
      t.context ? [{ name: 'Onde', value: cut(t.context, 200), inline: true }] : [],
      t.reply ? [{ name: 'Resposta enviada', value: cut(t.reply, 900) }] : []
    ),
    footer: { text: 'id ' + t.id },
  };
}

// Os botões "Em resolução" e "Concluir" que acompanham um pedido; o id viaja
// no custom_id, para o clique saber de que pedido é.
// Recebe: id — o id do pedido (string), que segue dentro do custom_id.
// Devolve: lista com uma action row de dois botões, para o campo components.
export function ticketButtons(id) {
  return [{
    type: 1,
    components: [
      { type: 2, style: 1, label: 'Em resolução', custom_id: 'tk:res:' + id },
      { type: 2, style: 3, label: 'Concluir', custom_id: 'tk:fim:' + id },
    ],
  }];
}

// Procura um pedido pelo id inteiro ou por um prefixo — as listas só mostram
// os primeiros 8 caracteres, e escrevê-los chega.
// Recebe: env — dá acesso à base (env.DB); ref — o id do pedido, inteiro ou só o prefixo.
// Devolve: promessa da linha do pedido, ou null se não houver correspondência.
async function acharTicket(env, ref) {
  const r = String(ref || '').trim();
  if (!r) return null;
  return env.DB.prepare('SELECT * FROM tickets WHERE id = ? OR id LIKE ? LIMIT 1').bind(r, r + '%').first();
}

/* Também por aqui se escreve no fio e no rasto: uma resposta dada pelo
   Discord que só mexesse na coluna reply ficava invisível no back office,
   e ninguém sabia que caminho a escreveu.
   Recebe: env — acesso à base e ao correio; ref — o id do pedido, inteiro ou
   prefixo; estado — o novo estado ('resolucao' ou 'concluido'); resposta
   (opcional) — o texto a escrever no fio e a enviar por email; quem (opcional)
   — quem mexeu, como { id, nome, papel }.
   Devolve: promessa do pedido já com o estado (e a resposta) novos, ou null
   se o pedido não existir. */
async function mudarEstado(env, ref, estado, resposta, quem) {
  const t = await acharTicket(env, ref);
  if (!t) return null;
  const agora = Date.now();
  const ops = [];
  if (resposta) {
    ops.push(env.DB.prepare(
      'INSERT INTO ticket_msgs (id, ticket_id, tipo, texto, autor, nome, papel, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), t.id, 'resposta', resposta,
      (quem && quem.id) || 'discord', (quem && quem.nome) || 'bot', (quem && quem.papel) || '', agora));
  }
  ops.push(env.DB.prepare(
    'UPDATE tickets SET status = ?, reply = COALESCE(?, reply), updated_at = ? WHERE id = ?'
  ).bind(estado, resposta || null, agora, t.id));
  await env.DB.batch(ops);
  const { auditar } = await import('./lib/auditoria.js');
  await auditar(env,
    { discordId: (quem && quem.id) || 'discord', nome: (quem && quem.nome) || '', papeis: [(quem && quem.papel) || 'bot'] },
    'pedido.' + (estado === 'concluido' ? 'fechar' : resposta ? 'responder' : 'estado'),
    t.id, resposta ? String(resposta).slice(0, 120) : estado);
  // responder pelo Discord também avisa a pessoa por email (só pedidos de gente)
  if (resposta && t.category === 'user') {
    const dono = await env.DB.prepare('SELECT email FROM users WHERE id = ? AND deleted_at IS NULL')
      .bind(t.user_id).first();
    if (dono && dono.email) {
      const { emailRespostaPedido } = await import('./lib/correio.js');
      await emailRespostaPedido(env, dono.email, t.subject, resposta, t.id);
    }
  }
  return Object.assign({}, t, { status: estado, reply: resposta || t.reply });
}

/* ------------------------------ comandos ------------------------------ */

/* /pedidos: até dez pedidos, do mais recente para trás, sempre dentro das
   categorias que o papel vê. Sem filtros mostra o que está por tratar; aceita
   estado e categoria — e pedir uma categoria vedada é dito, não escondido.
   Recebe: env — acesso à base; opts — as opções do comando (estado e categoria,
   ambos opcionais, como strings); pap — um papel (string) ou lista de papéis
   de quem chamou.
   Devolve: promessa da resposta efémera do Discord — os embeds da lista, o
   aviso de que não há nada, ou a recusa da categoria vedada. */
async function cmdPedidos(env, opts, pap) {
  const estado = (opts.estado || '').trim();
  const permitidas = catsDe(pap);
  let cat = (opts.categoria || '').trim();
  // pedir uma categoria que o papel não vê não devolve vazio às escondidas
  if (cat && permitidas.indexOf(cat) < 0) {
    return reply('O papel **' + nomeDoPapel(pap) + '** não vê pedidos de *' + (CATS[cat] || cat) + '*.');
  }
  const onde = [], vals = [];
  if (estado) { onde.push('status = ?'); vals.push(estado); } else onde.push("status <> 'concluido'");
  if (cat) { onde.push('category = ?'); vals.push(cat); }
  else {
    // sem categoria pedida, mostra-se o que o papel vê (para o admin, tudo)
    onde.push('category IN (' + permitidas.map(() => '?').join(',') + ')');
    vals.push(...permitidas);
  }
  const st = env.DB.prepare(
    'SELECT * FROM tickets WHERE ' + onde.join(' AND ') + ' ORDER BY n DESC, created_at DESC LIMIT 10'
  );
  const rows = (await (vals.length ? st.bind(...vals) : st).all()).results;
  if (!rows.length) {
    return reply('✅ Nada' + (cat ? ' em ' + CATS[cat] : '') +
      (estado ? ' com esse estado' : ' por tratar') + '.');
  }
  return reply('', rows.map(function (t) {
    return {
      title: (ICONE[t.category] || '🐞 ') + cut(t.subject, 90) + (t.n > 1 ? '  ×' + t.n : ''),
      description: cut(t.body, 300),
      color: COR[t.category] || 0xb94a48,
      footer: { text: (CATS[t.category] || t.category) + ' · ' + ESTADOS[t.status] + ' · ' + t.id.slice(0, 8) },
    };
  }));
}

/* Quem escreveu, e o que se sabe dele.

   O aviso que chega ao canal traz o nome; o /pedido, aberto mais tarde,
   trazia só o id. Quem faz suporte estava a responder a uma pessoa de quem
   não sabia nada — nem o plano, nem há quanto tempo era utilizador, nem se
   já tinha escrito antes.
   Recebe: env — acesso à base; userId — o id do utilizador na app.
   Devolve: promessa de { u, casas, registos, antes, erros } com a conta e as
   contagens; { desconhecido: true } se a conta já não existe; null sem id ou
   se a consulta falhar. */
async function fichaDe(env, userId) {
  if (!userId) return null;
  try {
    const u = await env.DB.prepare(
      `SELECT id, name, email, created_at, deleted_at, terms_version FROM users WHERE id = ?`
    ).bind(userId).first();
    if (!u) return { desconhecido: true };
    const q = async (sql) => ((await env.DB.prepare(sql).bind(userId).first()) || {}).n || 0;
    const casas = await q('SELECT COUNT(*) AS n FROM houses WHERE owner_id = ? AND deleted = 0');
    const registos = await q(
      'SELECT COUNT(*) AS n FROM records r JOIN houses h ON h.id = r.house_id WHERE h.owner_id = ? AND r.deleted = 0'
    );
    const antes = await q("SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND category = 'user'");
    const erros = await q("SELECT COUNT(*) AS n FROM ticket_users WHERE user_id = ?");
    return { u, casas, registos, antes, erros };
  } catch (e) {
    return null;   // saber menos é melhor do que não abrir o pedido
  }
}

// A ficha de quem escreveu, como campo de embed: plano, antiguidade, casas, e
// os avisos que mudam a resposta. Devolve null quando não há ficha.
// Recebe: f — a ficha vinda de fichaDe (objeto, ou null).
// Devolve: o campo de embed { name, value, inline }, ou null quando não há ficha.
function campoDaFicha(f) {
  if (!f) return null;
  if (f.desconhecido) return { name: 'Quem escreveu', value: 'conta já não existe', inline: false };
  const u = f.u;
  const dias = Math.max(0, Math.round((Date.now() - u.created_at) / 86400000));
  const linhas = [
    '**' + (u.name || 'sem nome') + '** · `' + u.id + '`',
    u.email,
    'Na app há ' + (dias < 1 ? 'menos de um dia' : dias + ' dias'),
    f.casas + ' casas · ' + f.registos + ' registos',
  ];
  // o que faz a diferença ao responder: já escreveu antes? tem apanhado erros?
  if (f.antes > 1) linhas.push('⚠️ já escreveu ' + (f.antes - 1) + ' vez' + (f.antes - 1 === 1 ? '' : 'es') + ' antes');
  if (f.erros) linhas.push('⚠️ apanhou ' + f.erros + ' erro' + (f.erros === 1 ? '' : 's') + ' distinto' + (f.erros === 1 ? '' : 's'));
  if (u.deleted_at) linhas.push('🔴 conta apagada');
  if (!u.terms_version) linhas.push('não aceitou os termos');
  return { name: 'Quem escreveu', value: linhas.join('\n'), inline: false };
}

// /pedido: abre um pedido pelo id, com a ficha de quem escreveu no lugar do
// campo "De" e os botões de mudar o estado.
// Recebe: env — acesso à base; opts — as opções do comando (id — o id do
// pedido, inteiro ou prefixo); pap — um papel (string) ou lista de papéis.
// Devolve: promessa da resposta do Discord com o embed e os botões, ou a recusa.
async function cmdPedido(env, opts, pap) {
  const g = await guardaDoPedido(env, opts.id, pap);
  if (g.erro) return g.erro;
  const embed = ticketEmbedFull(g.t);
  const ficha = campoDaFicha(await fichaDe(env, g.t.user_id));
  if (ficha) embed.fields = [ficha].concat(embed.fields.filter((c) => c.name !== 'De'));
  return { type: MSG, data: { embeds: [embed], components: ticketButtons(g.t.id) } };
}

// /responder: escreve a resposta no pedido e marca-o em resolução; se for um
// pedido de gente, a pessoa recebe a resposta por email e na app.
// Recebe: env — acesso à base e ao correio; opts — as opções (id — o id ou
// prefixo do pedido; texto — a resposta a dar); pap — um papel ou lista de
// papéis; quem — quem responde, como { id, nome, papel }.
// Devolve: promessa da resposta efémera com o pedido atualizado, ou a recusa.
async function cmdResponder(env, opts, pap, quem) {
  const g = await guardaDoPedido(env, opts.id, pap);
  if (g.erro) return g.erro;
  const t = await mudarEstado(env, g.t.id, 'resolucao', opts.texto, quem);
  return reply('✏️ Respondido e marcado como **em resolução**. A pessoa vê a resposta na app.',
    [ticketEmbedFull(t)]);
}

// /fechar: dá o pedido por concluído, com resposta final se vier texto.
// Recebe: env — acesso à base e ao correio; opts — as opções (id — o id ou
// prefixo do pedido; texto (opcional) — a resposta final); pap — um papel ou
// lista de papéis; quem — quem fecha, como { id, nome, papel }.
// Devolve: promessa da resposta efémera "Concluído" com o pedido, ou a recusa.
async function cmdFechar(env, opts, pap, quem) {
  const g = await guardaDoPedido(env, opts.id, pap);
  if (g.erro) return g.erro;
  const t = await mudarEstado(env, g.t.id, 'concluido', opts.texto, quem);
  return reply('✅ Concluído.', [ticketEmbedFull(t)]);
}

// Os erros apanhados sozinhos vivem em `tickets` desde a migração 0008, com
// a categoria a dizer de onde vieram. A tabela `reports` ficou para trás.
// Recebe: env — acesso à base; opts — as opções (horas (opcional) — a janela
// para trás, de 1 a 720; 24 por omissão).
// Devolve: promessa da resposta efémera com até dez embeds de erros, ou o
// aviso de que não há nenhuns.
async function cmdErros(env, opts) {
  const horas = Math.min(Math.max(Number(opts.horas || 24), 1), 720);
  const desde = Date.now() - horas * 3600000;
  /* Ordenado por quantas pessoas apanharam, e só depois por quantas vezes.
     Um erro que toca em cinco pessoas uma vez cada vale mais atenção do que
     um que toca numa pessoa cinquenta vezes. */
  const rows = (await env.DB.prepare(
    `SELECT t.*,
            (SELECT COUNT(*) FROM ticket_users u WHERE u.fingerprint = t.fingerprint) AS pessoas
       FROM tickets t
      WHERE t.category IN ('client', 'server') AND t.updated_at > ?
      ORDER BY pessoas DESC, t.n DESC, t.updated_at DESC LIMIT 10`
  ).bind(desde).all()).results;
  if (!rows.length) return reply('✅ Sem erros nas últimas ' + horas + ' horas.');
  const desdeQuando = (t) => {
    const h = Math.round((Date.now() - t) / 3600000);
    return h < 1 ? 'agora mesmo' : h < 48 ? 'há ' + h + 'h' : 'há ' + Math.round(h / 24) + ' dias';
  };
  return reply('Erros das últimas ' + horas + ' horas, do que toca em mais gente para o que toca em menos:',
    rows.map(function (r) {
      const varios = r.pessoas > 1;
      return {
        title: (varios ? '🔴 ' : '⚠️ ') + cut(r.subject, 88) +
          (r.n > 1 ? '  ×' + r.n : '') + (varios ? '  · ' + r.pessoas + ' pessoas' : ''),
        description: '```' + cut(r.body || '—', 400) + '```',
        color: r.status === 'concluido' ? 0x2f7d5b : (varios ? 0xb94a48 : 0xd6a34a),
        footer: {
          text: [
            r.category === 'server' ? 'servidor' : 'app',
            r.versao ? 'v' + r.versao : null,
            r.context || null,
            'primeira vez ' + desdeQuando(r.created_at),
            ESTADOS[r.status] || r.status,
            cut(r.id, 8),
          ].filter(Boolean).join(' · '),
        },
      };
    }));
}

// Ver as cópias que existem, ou forçar uma agora — antes de uma migração
// arriscada, por exemplo, em vez de esperar pelas 09:00.
// Recebe: env — acesso à base e ao R2; opts — as opções (agora (opcional) —
// quando verdadeiro, força já uma cópia em vez de listar).
// Devolve: promessa da resposta efémera — a lista das cópias, o resultado da
// cópia feita, ou o erro.
async function cmdCopias(env, opts) {
  const s = await import('./salvaguarda.js');
  if (opts.agora) {
    const r = await s.copiar(env);
    if (r.erro) return reply('🔴 Não deu: ' + cut(r.erro, 400));
    return reply('🟢 Cópia feita: `' + r.chave + '` · ' + r.linhas + ' registos de ' +
      r.tabelas + ' tabelas · ' + s.kb(r.bytes) + ' · ' + r.ms + ' ms' +
      (r.podadas ? ' · ' + r.podadas + ' antigas apagadas' : '') +
      (r.modo === 'memoria' ? '\n(escrita em memória: o fluxo não passou)' : ''));
  }
  const copias = await s.listar(env);
  if (!copias.length) return reply('🔴 Nenhuma cópia no R2. Corre `/copias agora:Sim`.');
  const total = copias.reduce((a, o) => a + o.size, 0);
  return reply('', [{
    title: '💾 Cópias da base no R2',
    color: 0x2f7d5b,
    description: copias.slice(0, 15).map((o) =>
      '`' + s.diaDaChave(o.key) + '` · ' + s.kb(o.size)).join('\n'),
    fields: [
      { name: 'Total', value: copias.length + ' cópias, ' + s.kb(total), inline: true },
      { name: 'Retenção', value: s.DIAS + ' dias + dia 1 de cada mês', inline: true },
      { name: 'Time Travel da D1', value: s.TIME_TRAVEL_DIAS + ' dias (plano gratuito)', inline: true },
    ],
  }]);
}

// Um pedido só se lê e se responde de dentro do papel a que pertence.
// Recebe: pap — um papel (string) ou lista de papéis; categoria — a categoria
// do pedido ('user' quando vier vazia).
// Devolve: booleano — true se o papel vê essa categoria.
function podeVer(pap, categoria) {
  return catsDe(pap).indexOf(categoria || 'user') > -1;
}

/* A guarda comum dos comandos que mexem num pedido: acha-o e confirma que o
   papel o pode ver. Devolve { t } com o pedido, ou { erro } com a recusa já
   pronta a devolver ao Discord.
   Recebe: env — acesso à base; id — o id do pedido, inteiro ou prefixo; pap —
   um papel (string) ou lista de papéis de quem chamou.
   Devolve: promessa de { t } com o pedido, ou { erro } com a recusa efémera. */
async function guardaDoPedido(env, id, pap) {
  const t = await acharTicket(env, id);
  if (!t) return { erro: reply('Não encontrei nenhum pedido com esse id.') };
  if (!podeVer(pap, t.category)) {
    return { erro: reply('Esse pedido é de *' + (CATS[t.category] || t.category) +
      '*, fora do papel **' + pap + '**.') };
  }
  return { t };
}

const DESCRICAO = {
  pedidos: 'lista o que está por tratar',
  pedido: 'abre um pedido pelo id',
  responder: 'responde a quem escreveu, sem fechar',
  fechar: 'responde e dá por concluído',
  erros: 'erros da app e do servidor nas últimas horas',
  uso: 'consumo da infraestrutura agora',
  copias: 'cópias da base no R2, ou forçar uma',
  resumo: 'envia o resumo diário para o canal de administração',
  entrar: 'abre a ferramenta de suporte no browser',
  comandos: 'esta lista',
  access: 'quem pode o quê',
};

// /comandos: o que esta pessoa pode correr, com a nota do que lhe foi dado
// por exceção e as categorias de pedidos que vê.
// Recebe: pap — um papel (string) ou lista de papéis; acessos — as exceções
// { mais, menos } da pessoa.
// Devolve: a resposta efémera com a lista de comandos e as categorias que vê.
function cmdComandos(pap, acessos) {
  const desc = DESCRICAO;
  const meus = comandosDe(pap, acessos);
  return reply('', [{
    title: 'O que podes fazer · papel ' + nomeDoPapel(pap),
    color: cor(pap),
    description: meus.map(function (c) {
      const o = origemDoAcesso(pap, c, acessos, { PERMISSOES, PODEM_TUDO, SO_MASTER });
      return '`/' + c + '`' + (o === 'dado' ? ' *(dado a ti)*' : '') + ' — ' + desc[c];
    }).join('\n'),
    fields: [{
      name: 'Pedidos que vês',
      value: catsDe(pap).map((c) => (ICONE[c] || '') + (CATS[c] || c)).join('\n') || 'nenhum',
    }],
  }]);
}

/* /docs: a mesma entrada do /entrar, mas a aterrar na documentação — um
   comando, zero passos intermédios. O bilhete é igual ao do /entrar (cinco
   minutos, uma utilização) e o destino vem de uma lista fechada.
   Recebe: env — as variáveis de ambiente (a base do bilhete e o nome do
   ambiente); i — a interação do Discord (traz quem chamou); papeis — a lista
   de papéis, do mais alto para o mais baixo.
   Devolve: promessa da resposta efémera com a ligação de uso único para os docs. */
async function cmdDocs(env, i, papeis) {
  const u = (i.member && i.member.user) || i.user || {};
  const { criarBilhete } = await import('./equipa.js');
  const b = await criarBilhete(env, {
    discordId: u.id,
    nome: u.global_name || u.username || u.id,
    papel: papeis[0],
    papeis,
  });
  const base = env.ENV_NAME ? 'https://dev.rendorium.com' : 'https://app.rendorium.com';
  return reply('📚 A documentação da casa — gerada do próprio código a cada deploy:\n' +
    base + '/equipa/entrar?t=' + b.token + '&depois=docs\n\n' +
    'A ligação vale ' + Math.round(b.expiraEm / 60) + ' minutos e uma utilização; entra e aterra logo nos docs.');
}

/* Uma ligação de uso único para a ferramenta de equipa.

   A resposta é sempre privada (flags 64): a ligação vale por uma sessão, e
   um canal partilhado não é sítio para ela. O endereço sai do próprio pedido,
   por isso o bot de dev dá uma ligação para o dev e o de produção para
   produção, sem ninguém ter de configurar nada.
   Recebe: env — as variáveis de ambiente (a base do bilhete e o nome do
   ambiente); i — a interação do Discord (traz quem chamou); papeis — a lista
   de papéis, do mais alto para o mais baixo; request — o pedido HTTP recebido
   (hoje fica por usar: o domínio sai de env.ENV_NAME).
   Devolve: promessa da resposta efémera com a ligação de uso único e o aviso
   para não a partilhar. */
async function cmdEntrar(env, i, papeis, request) {
  const u = (i.member && i.member.user) || i.user || {};
  const pap = nomeDoPapel(papeis);
  const { criarBilhete } = await import('./equipa.js');
  const b = await criarBilhete(env, {
    discordId: u.id,
    nome: u.global_name || u.username || u.id,
    papel: papeis[0],   // o principal, para mostrar
    papeis,             // todos, para decidir o que se vê
  });
  /* O origin do pedido é o endpoint das interações — que continua a ser o
     workers.dev antigo, e continua a funcionar. Mas a ligação que se dá às
     pessoas leva o domínio verdadeiro do ambiente que responde. */
  const base = env.ENV_NAME ? 'https://dev.rendorium.com' : 'https://app.rendorium.com';
  const minutos = Math.round(b.expiraEm / 60);
  return reply(
    '🔑 A tua ligação, válida ' + minutos + ' minutos e para uma só utilização:\n' +
    base + '/equipa/entrar?t=' + b.token + '\n\n' +
    'Entras como **' + pap + '**. Não a partilhes: quem a abrir entra em teu nome.'
  );
}

/* Uma ligação para o ambiente de TESTE — nunca para produção. O bot de dev
   aponta a si próprio; o de produção (quem responde ao Discord depois da
   promoção) aponta ao dev, porque o /t/entrar de produção nem existe.
   Abrir a ligação lava as contas de teste e entra numa fresca.
   Recebe: env — as variáveis de ambiente; i — a interação do Discord (traz
   quem chamou); opts — as opções (dados, extra e limpar (opcionais) —
   bandeiras; email (opcional) — para onde passa a ir o correio de teste);
   request — o pedido HTTP recebido (hoje fica por usar).
   Devolve: promessa da resposta efémera com a ligação de teste e as notas do
   que abri-la faz. */
async function cmdTest(env, i, opts, request) {
  const { ligacaoTeste } = await import('./teste.js');
  const base = 'https://dev.rendorium.com';   // o teste vive sempre aqui
  const u = (i.member && i.member.user) || i.user || {};
  const lig = await ligacaoTeste(env, base, !!opts.dados, !!opts.extra, u.id, !!opts.limpar, opts.email);
  return reply('🧪 O teu ambiente de teste (a ligação vale 10 minutos):\n' + lig + '\n\n' +
    (opts.limpar
      ? 'Abri-la APAGA as tuas contas de teste e começa numa lavada.'
      : opts.extra
        ? 'Abri-la cria uma conta de teste EXTRA, sem tocar nas existentes.'
        : 'Abri-la retoma a tua conta de teste mais recente, com os dados intactos — ou cria a primeira.') +
    (opts.dados ? ' Vem com dados de exemplo.' : '') +
    '\nAs contas ficam de um dia para o outro; troca-las no seletor do topo da app.' +
    (opts.email ? '\n📬 O correio das tuas contas de teste passa a ir para ' + opts.email + '.'
                : '\nO correio vai para o email que registares com /test email:… (até lá, test@rendorium.com).'));
}

/* Quem pode o quê, com as caixas na própria mensagem.

   O papel continua a mandar: o que vem dele já vem marcado, e desmarcá-lo é
   o que tira o comando a esta pessoa e só a ela. O que se guarda é a
   diferença para o cargo, nunca a lista marcada — assim, mudar o cargo de
   alguém no Discord continua a mudar-lhe os acessos.

   O /access não aparece no menu: quem decide quem pode o quê tem de ser um
   só, e um controlo de acessos que se pode dar a si próprio não controla
   nada. */

// Os comandos que se gerem aqui. Os do master ficam de fora de propósito.
// Devolve: lista com os nomes dos comandos geríveis (todos menos os só do master).
const GERIVEIS = () => Object.keys(PERMISSOES).filter((c) => SO_MASTER.indexOf(c) < 0);

const MARCA = {
  papel: '✅ *(do cargo)*',
  dado: '➕ **dado a esta pessoa**',
  retirado: '➖ **retirado**',
  nao: '·',
};
const DE_ONDE = { papel: 'do cargo · ', dado: 'dado a esta pessoa · ', retirado: 'retirado · ', nao: '' };

/* Os componentes do /access: um menu de escolha múltipla com o estado de cada
   comando gerível (o que vem do cargo já vem marcado) e o botão de repor tudo
   ao cargo.
   Recebe: alvoId — o id de Discord da pessoa alvo; papeis — a lista de papéis
   dela; acessos — as exceções { mais, menos } dela.
   Devolve: lista de duas action rows — o menu e o botão de repor. */
function menuAcesso(alvoId, papeis, acessos) {
  const regras = { PERMISSOES, PODEM_TUDO, SO_MASTER };
  // o alvo e os papéis dele viajam no botão: a interação de um menu não
  // traz o membro consigo, ao contrário da do comando
  const chave = alvoId + ':' + papeis.join(',');
  const opcoes = GERIVEIS().map(function (c) {
    const o = origemDoAcesso(papeis, c, acessos, regras);
    return {
      label: '/' + c,
      value: c,
      description: cut(DE_ONDE[o] + (DESCRICAO[c] || ''), 100),
      default: o === 'papel' || o === 'dado',
    };
  });
  return [
    {
      type: 1,
      components: [{
        type: 3,
        custom_id: 'ac:' + chave,
        placeholder: 'Marca o que esta pessoa pode correr',
        min_values: 0,
        max_values: opcoes.length,
        options: opcoes,
      }],
    },
    {
      type: 1,
      components: [{ type: 2, style: 2, label: 'Repor tudo ao cargo', custom_id: 'acz:' + chave }],
    },
  ];
}

/* A mensagem inteira: o menu é o que se mexe, o embed é o que explica.

   O menu sozinho mostra o que está ligado mas não de onde vem, e essa é a
   parte que interessa a quem gere — daí os dois juntos.
   Recebe: alvoId — o id de Discord da pessoa alvo; papeis — a lista de papéis
   dela; acessos — as exceções { mais, menos } dela.
   Devolve: { embeds, components } prontos para a mensagem — components vazio
   quando o alvo não tem papel ou é master. */
function vistaAcesso(alvoId, papeis, acessos) {
  const regras = { PERMISSOES, PODEM_TUDO, SO_MASTER };
  const eMaster = papeis.indexOf('master') > -1;
  const linhas = Object.keys(PERMISSOES).map(function (c) {
    return MARCA[origemDoAcesso(papeis, c, acessos, regras)] + '  `/' + c + '` — ' + (DESCRICAO[c] || '');
  });
  const excecoes = acessos.mais.length + acessos.menos.length;

  const embed = {
    title: 'Quem pode o quê',
    description: '<@' + alvoId + '>\n\n' + linhas.join('\n'),
    color: cor(papeis),
    fields: [
      { name: 'Papel', value: papeis.length ? papeis.join(' + ') : 'nenhum — não entra no bot', inline: true },
      { name: 'Exceções ao cargo', value: String(excecoes || 'nenhuma'), inline: true },
    ],
    footer: {
      text: !papeis.length
        ? 'Sem cargo no servidor não há nada a gerir: dá-lhe primeiro um cargo.'
        : eMaster
          ? 'O master não perde acessos por exceção: um engano trancava-o fora.'
          : 'Desmarca o que vem do cargo para lho tirares só a esta pessoa.',
    },
  };

  // sem papel não há nada para mexer; ao master não se tira nada
  const componentes = (!papeis.length || eMaster) ? [] : menuAcesso(alvoId, papeis, acessos);
  return { embeds: [embed], components: componentes };
}

// /access: mostra quem pode o quê para a pessoa escolhida, com o menu para
// dar e tirar comandos. Só o master cá chega.
// Recebe: env — acesso às listas de papéis e aos acessos guardados; i — a
// interação do Discord (usa data.resolved para os cargos do alvo); opts — as
// opções (utilizador — o id de Discord da pessoa escolhida).
// Devolve: promessa da resposta efémera com a vista de acessos, ou o pedido
// para escolher a pessoa.
async function cmdAccess(env, i, opts) {
  const alvo = opts.utilizador;
  if (!alvo) return reply('Escolhe a pessoa.');
  const res = (i.data && i.data.resolved) || {};
  const membro = (res.members && res.members[alvo]) || {};
  const papeis = papeisDe(env, { member: { user: { id: alvo }, roles: membro.roles || [] } });
  const acessos = await lerAcessos(env, alvo);
  return { type: MSG, data: Object.assign({ flags: 64 }, vistaAcesso(alvo, papeis, acessos)) };
}

/* Os cargos do alvo, perguntados ao Discord no momento de gravar.

   Os que viajaram na mensagem podem estar velhos — o cargo pode ter mudado
   entre abrir o menu e mexer nele — e gravar exceções contra um cargo velho
   dava exceções erradas. Se a pergunta não der, vale o que veio na mensagem:
   é melhor do que recusar o clique.
   Recebe: env — as variáveis de ambiente (usa DISCORD_BOT_TOKEN); i — a
   interação (usa guild_id); alvoId — o id de Discord do alvo; guardados — a
   lista de papéis que viajou na mensagem, para valer se a pergunta falhar.
   Devolve: promessa da lista de papéis fresca do Discord, ou `guardados`. */
async function papeisDoAlvo(env, i, alvoId, guardados) {
  if (env.DISCORD_BOT_TOKEN && i.guild_id) {
    try {
      const r = await fetch(
        'https://discord.com/api/v10/guilds/' + i.guild_id + '/members/' + alvoId,
        { headers: { Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN } }
      );
      if (r.ok) {
        const m = await r.json();
        return papeisDe(env, { member: { user: { id: alvoId }, roles: m.roles || [] } });
      }
    } catch (e) { /* fica o que veio na mensagem */ }
  }
  return guardados;
}

/* Trata os cliques na mensagem do /access: o botão repõe tudo ao cargo, o
   menu grava a diferença entre o que ficou marcado e o que o cargo dá.
   Escreve na base, deixa rasto na auditoria, e substitui a mensagem pela
   vista nova.
   Recebe: env — acesso aos acessos guardados e à auditoria; i — a interação
   do menu ou do botão; meus — a lista de papéis de quem clicou; cid — o
   custom_id ('ac:' ou 'acz:' seguido do id do alvo e dos papéis dele).
   Devolve: promessa da resposta UPDATE com a vista nova, ou a recusa/aviso
   efémero. */
async function acessoInteracao(env, i, meus, cid) {
  if (!podeCorrer(meus, 'access')) return reply('O **/access** é só do master.');

  const partes = cid.split(':');
  const alvoId = partes[1];
  const papeis = await papeisDoAlvo(env, i, alvoId, (partes[2] || '').split(',').filter(Boolean));
  if (!papeis.length) return reply('Essa pessoa já não tem cargo nenhum no servidor.');

  let acessos, resumo;
  if (partes[0] === 'acz') {
    acessos = await guardarAcessos(env, alvoId, { mais: [], menos: [] });
    resumo = 'repôs tudo ao cargo';
  } else {
    const regras = { PERMISSOES, PODEM_TUDO, SO_MASTER };
    const doCargo = (c) => origemDoAcesso(papeis, c, { mais: [], menos: [] }, regras) === 'papel';
    const d = excecoesDoMenu((i.data && i.data.values) || [], GERIVEIS(), doCargo);
    acessos = await guardarAcessos(env, alvoId, d);
    resumo = 'dado: ' + (d.mais.join(',') || '—') + ' · retirado: ' + (d.menos.join(',') || '—');
  }
  /* Quem pode o quê é a decisão mais sensível do bot: muda sem rasto e
     ninguém reconstrói quem abriu que porta a quem. */
  const { auditar } = await import('./lib/auditoria.js');
  await auditar(env, quemFala(i, meus), 'acesso.mudar', alvoId, resumo);
  return { type: UPDATE, data: vistaAcesso(alvoId, papeis, acessos) };
}

// /uso: o consumo da infraestrutura neste momento, num embed.
// Recebe: env — as variáveis de ambiente, que o usageFields usa para perguntar o consumo.
// Devolve: promessa da resposta efémera com o embed do consumo.
async function cmdUso(env) {
  const fields = await usageFields(env);
  return reply('', [{
    title: '📊 Consumo agora',
    color: 0x2f7d5b,
    fields,
    timestamp: new Date().toISOString(),
  }]);
}

// /resumo: envia já o resumo diário para o canal de administração, sem
// esperar pela hora marcada.
// Recebe: env — as variáveis de ambiente; ctx — o contexto de execução do
// worker, que segue para o dailyReport.
// Devolve: promessa da resposta efémera a confirmar o envio.
async function cmdResumo(env, ctx) {
  await dailyReport(env, ctx);
  return reply('Resumo enviado para o canal de administração.');
}

// Quem está a falar, para o fio e para o rasto.
// Recebe: i — a interação do Discord; pap — um papel (string) ou lista de papéis.
// Devolve: { id, nome, papel } de quem está a falar, com o papel por extenso.
function quemFala(i, pap) {
  const u = (i.member && i.member.user) || i.user || {};
  return { id: u.id, nome: u.global_name || u.username || u.id, papel: nomeDoPapel(pap) };
}

/* ---------------------------- encaminhamento ---------------------------- */

/* A porta de entrada de todas as interações do Discord: verifica a assinatura,
   responde ao ping, e encaminha botões, menus e comandos — cada um atrás da
   pergunta "este papel pode?". Devolve sempre a Response JSON que o Discord
   espera; um erro num comando vira mensagem, não um 500.
   Recebe: request — o pedido HTTP vindo do Discord (assinatura nos cabeçalhos,
   interação no corpo); env — as variáveis de ambiente; ctx — o contexto de
   execução do worker.
   Devolve: promessa de Response — JSON para o Discord, ou 401/400 quando a
   assinatura ou o corpo não prestam. */
export async function handleInteraction(request, env, ctx) {
  const raw = await request.text();
  const ok = await verifySignature(
    env,
    request.headers.get('X-Signature-Ed25519'),
    request.headers.get('X-Signature-Timestamp'),
    raw
  );
  if (!ok) return new Response('assinatura inválida', { status: 401 });

  let i;
  try { i = JSON.parse(raw); } catch (e) { return new Response('json inválido', { status: 400 }); }
  const json = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

  if (i.type === 1) return json(PONG);

  const papeis = papeisDe(env, i);
  if (!papeis.length) return json(reply('Não tens permissão para usar este bot.'));
  const pap = papeis;
  const quemSou = (i.member && i.member.user && i.member.user.id) || (i.user && i.user.id);
  const meusAcessos = await lerAcessos(env, quemSou);

  // botões e menus
  if (i.type === 3) {
    const cid = String(i.data.custom_id || '');
    // o menu do /access e o seu botão de repor
    if (cid.indexOf('ac:') === 0 || cid.indexOf('acz:') === 0) {
      return json(await acessoInteracao(env, i, papeis, cid));
    }
    const [, acao, id] = cid.split(':');
    const estado = acao === 'fim' ? 'concluido' : 'resolucao';
    const antes = await env.DB.prepare('SELECT category FROM tickets WHERE id = ?').bind(id).first();
    if (antes && !podeVer(pap, antes.category)) {
      return json(reply('Esse pedido é de *' + (CATS[antes.category] || antes.category) + '*, fora do papel **' + nomeDoPapel(pap) + '**.'));
    }
    const t = await mudarEstado(env, id, estado, null, quemFala(i, pap));
    if (!t) return json(reply('Esse pedido já não existe.'));
    return json({
      type: UPDATE,
      data: { embeds: [ticketEmbedFull(t)], components: t.status === 'concluido' ? [] : ticketButtons(t.id) },
    });
  }

  // comandos
  if (i.type === 2) {
    const nome = i.data.name;
    const opts = {};
    (i.data.options || []).forEach(function (o) { opts[o.name] = o.value; });
    // A recusa diz o que se pode fazer em vez de só dizer que não: quem
    // recebe um "não tens permissão" seco vai perguntar a alguém.
    if (!podeCorrer(pap, nome, meusAcessos)) {
      const meus = comandosDe(pap, meusAcessos);
      return json(reply('**/' + nome + '** não é para ti — tu és **' + nomeDoPapel(pap) + '**.\n' +
        (meus.length ? 'Podes correr: ' + meus.map((c) => '`/' + c + '`').join(', ') + '.'
                     : 'Não tens nenhum comando disponível.')));
    }
    try {
      if (nome === 'comandos') return json(cmdComandos(pap, meusAcessos));
      if (nome === 'access') return json(await cmdAccess(env, i, opts));
      if (nome === 'entrar') return json(await cmdEntrar(env, i, papeis, request));
      if (nome === 'test') return json(await cmdTest(env, i, opts, request));
      if (nome === 'docs') return json(await cmdDocs(env, i, papeis));
      if (nome === 'pedidos') return json(await cmdPedidos(env, opts, pap));
      if (nome === 'pedido') return json(await cmdPedido(env, opts, pap));
      if (nome === 'responder') return json(await cmdResponder(env, opts, pap, quemFala(i, pap)));
      if (nome === 'fechar') return json(await cmdFechar(env, opts, pap, quemFala(i, pap)));
      if (nome === 'erros') return json(await cmdErros(env, opts));
      if (nome === 'uso') return json(adiar(ctx, i, () => cmdUso(env)));
      if (nome === 'copias') return json(adiar(ctx, i, () => cmdCopias(env, opts)));
      if (nome === 'resumo') return json(adiar(ctx, i, () => cmdResumo(env, ctx)));
    } catch (e) {
      return json(reply('Correu mal: ' + cut(e.message, 300)));
    }
    /* O Discord regista os comandos para o bot todo, mas quem lhes responde
       é o worker de cada ambiente. Um comando novo registado antes de ser
       promovido aparece na lista e cai aqui — e "comando desconhecido" manda
       procurar no registo, que é o sítio errado. */
    return json(reply('**/' + nome + '** existe no Discord mas este servidor ainda não o conhece.\n' +
      'Costuma querer dizer que o comando foi registado antes de o código ser publicado aqui' +
      (env.ENV_NAME ? ' (ambiente **' + env.ENV_NAME + '**)' : ' (produção)') + '.'));
  }

  return json(PONG);
}
