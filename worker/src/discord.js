// Bot do Discord, alojado no próprio worker: o Discord envia as interações
// por HTTP e nós respondemos. Duas vistas — quem programa trata dos pedidos
// e dos erros, quem opera vê o consumo da infraestrutura.

import { dailyReport, usageFields } from './notify.js';

const PONG = { type: 1 };
const MSG = 4;            // responder com mensagem
const UPDATE = 7;         // substituir a mensagem do botão

const hex = (s) => {
  const a = new Uint8Array(s.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16);
  return a;
};

// A assinatura Ed25519 do Discord é a única autenticação deste endpoint.
export async function verifySignature(env, sig, ts, raw) {
  if (!env.DISCORD_PUBLIC_KEY || !sig || !ts) return false;
  const data = new TextEncoder().encode(ts + raw);
  for (const alg of ['Ed25519', 'NODE-ED25519']) {
    try {
      const key = await crypto.subtle.importKey('raw', hex(env.DISCORD_PUBLIC_KEY), { name: alg }, false, ['verify']);
      if (await crypto.subtle.verify({ name: alg }, key, hex(sig), data)) return true;
    } catch (e) { /* tenta o algoritmo seguinte */ }
  }
  return false;
}

const reply = (content, embeds) => ({
  type: MSG,
  data: { content: content || '', embeds: embeds || [], flags: 64 },   // 64 = só quem escreveu vê
});
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
const cut = (s, n) => { const t = String(s == null ? '' : s); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/* Papéis
   ------
   admin      opera o serviço: consumo, cópias, e tudo o que os outros veem
   dev        constrói: erros da app e do servidor, infraestrutura, segurança
   suporte    fala com quem usa: só os pedidos contados por pessoas

   dev e suporte são irmãos — nenhum manda no outro — e ambos ficam abaixo de
   admin. Cada lista aceita ids de pessoa ou ids de cargo do Discord: com
   cargos, entra e sai gente sem mexer nos segredos. */
export const PAPEIS = ['admin', 'dev', 'suporte'];

// O que cada papel pode correr. O admin não aparece nas listas porque pode tudo.
export const PERMISSOES = {
  pedidos: ['dev', 'suporte'],
  pedido: ['dev', 'suporte'],
  responder: ['dev', 'suporte'],
  fechar: ['dev', 'suporte'],
  erros: ['dev'],
  uso: [],
  resumo: [],
  copias: [],
  comandos: ['dev', 'suporte'],
};

// As categorias de pedido que cada papel vê. O suporte não precisa de ver
// rastreios de erro para responder a quem escreveu — e não deve.
export const CATS_DO_PAPEL = {
  admin: ['user', 'client', 'server', 'infra', 'seguranca'],
  dev: ['client', 'server', 'infra', 'seguranca'],
  suporte: ['user'],
};

const lista = (v) => String(v || '').split(/[,\s]+/).filter(Boolean);

function pertence(env, i, chave) {
  const l = lista(env[chave]);
  if (!l.length) return false;
  const uid = (i.member && i.member.user && i.member.user.id) || (i.user && i.user.id);
  const cargos = (i.member && i.member.roles) || [];
  return l.indexOf(uid) > -1 || cargos.some((r) => l.indexOf(r) > -1);
}

// Sem nenhuma lista configurada, quem tiver acesso ao servidor de Discord é
// admin — é o dono que decide, ao configurar.
export function papel(env, i) {
  const configurado = ['DISCORD_ADMINS', 'DISCORD_DEVS', 'DISCORD_SUPORTE']
    .some((k) => lista(env[k]).length);
  if (!configurado) return 'admin';
  if (pertence(env, i, 'DISCORD_ADMINS')) return 'admin';
  if (pertence(env, i, 'DISCORD_DEVS')) return 'dev';
  if (pertence(env, i, 'DISCORD_SUPORTE')) return 'suporte';
  return null;
}

export function podeCorrer(pap, comando) {
  if (!pap) return false;
  if (pap === 'admin') return true;
  return (PERMISSOES[comando] || []).indexOf(pap) > -1;
}

// Os comandos que este papel pode correr, para o /comandos e para as recusas.
export function comandosDe(pap) {
  return Object.keys(PERMISSOES).filter((c) => podeCorrer(pap, c));
}

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
    ].concat(t.reply ? [{ name: 'Resposta enviada', value: cut(t.reply, 900) }] : []),
    footer: { text: 'id ' + t.id },
  };
}

export function ticketButtons(id) {
  return [{
    type: 1,
    components: [
      { type: 2, style: 1, label: 'Em resolução', custom_id: 'tk:res:' + id },
      { type: 2, style: 3, label: 'Concluir', custom_id: 'tk:fim:' + id },
    ],
  }];
}

async function acharTicket(env, ref) {
  const r = String(ref || '').trim();
  if (!r) return null;
  return env.DB.prepare('SELECT * FROM tickets WHERE id = ? OR id LIKE ? LIMIT 1').bind(r, r + '%').first();
}

async function mudarEstado(env, ref, estado, resposta) {
  const t = await acharTicket(env, ref);
  if (!t) return null;
  await env.DB.prepare(
    'UPDATE tickets SET status = ?, reply = COALESCE(?, reply), updated_at = ? WHERE id = ?'
  ).bind(estado, resposta || null, Date.now(), t.id).run();
  return Object.assign({}, t, { status: estado, reply: resposta || t.reply });
}

/* ------------------------------ comandos ------------------------------ */

async function cmdPedidos(env, opts, pap) {
  const estado = (opts.estado || '').trim();
  const permitidas = CATS_DO_PAPEL[pap] || [];
  let cat = (opts.categoria || '').trim();
  // pedir uma categoria que o papel não vê não devolve vazio às escondidas
  if (cat && permitidas.indexOf(cat) < 0) {
    return reply('O papel **' + pap + '** não vê pedidos de *' + (CATS[cat] || cat) + '*.');
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

async function cmdPedido(env, opts, pap) {
  const g = await guardaDoPedido(env, opts.id, pap);
  if (g.erro) return g.erro;
  return { type: MSG, data: { embeds: [ticketEmbedFull(g.t)], components: ticketButtons(g.t.id) } };
}

async function cmdResponder(env, opts, pap) {
  const g = await guardaDoPedido(env, opts.id, pap);
  if (g.erro) return g.erro;
  const t = await mudarEstado(env, g.t.id, 'resolucao', opts.texto);
  return reply('✏️ Respondido e marcado como **em resolução**. A pessoa vê a resposta na app.',
    [ticketEmbedFull(t)]);
}

async function cmdFechar(env, opts, pap) {
  const g = await guardaDoPedido(env, opts.id, pap);
  if (g.erro) return g.erro;
  const t = await mudarEstado(env, g.t.id, 'concluido', opts.texto);
  return reply('✅ Concluído.', [ticketEmbedFull(t)]);
}

// Os erros apanhados sozinhos vivem em `tickets` desde a migração 0008, com
// a categoria a dizer de onde vieram. A tabela `reports` ficou para trás.
async function cmdErros(env, opts) {
  const horas = Math.min(Math.max(Number(opts.horas || 24), 1), 720);
  const desde = Date.now() - horas * 3600000;
  const rows = (await env.DB.prepare(
    `SELECT * FROM tickets WHERE category IN ('client', 'server') AND updated_at > ?
      ORDER BY n DESC, updated_at DESC LIMIT 10`
  ).bind(desde).all()).results;
  if (!rows.length) return reply('✅ Sem erros nas últimas ' + horas + ' horas.');
  return reply('Erros das últimas ' + horas + ' horas:', rows.map(function (r) {
    return {
      title: '⚠️ ' + cut(r.subject, 90) + (r.n > 1 ? '  ×' + r.n : ''),
      description: '```' + cut(r.body || '—', 500) + '```',
      color: r.status === 'concluido' ? 0x2f7d5b : 0xd6a34a,
      footer: {
        text: (r.category === 'server' ? 'servidor' : 'app') + ' · ' +
          (ESTADOS[r.status] || r.status) + ' · ' + cut(r.id, 8),
      },
    };
  }));
}

// Ver as cópias que existem, ou forçar uma agora — antes de uma migração
// arriscada, por exemplo, em vez de esperar pelas 09:00.
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
function podeVer(pap, categoria) {
  return (CATS_DO_PAPEL[pap] || []).indexOf(categoria || 'user') > -1;
}

async function guardaDoPedido(env, id, pap) {
  const t = await acharTicket(env, id);
  if (!t) return { erro: reply('Não encontrei nenhum pedido com esse id.') };
  if (!podeVer(pap, t.category)) {
    return { erro: reply('Esse pedido é de *' + (CATS[t.category] || t.category) +
      '*, fora do papel **' + pap + '**.') };
  }
  return { t };
}

function cmdComandos(pap) {
  const desc = {
    pedidos: 'lista o que está por tratar',
    pedido: 'abre um pedido pelo id',
    responder: 'responde a quem escreveu, sem fechar',
    fechar: 'responde e dá por concluído',
    erros: 'erros da app e do servidor nas últimas horas',
    uso: 'consumo da infraestrutura agora',
    copias: 'cópias da base no R2, ou forçar uma',
    resumo: 'envia o resumo diário para o canal de administração',
    comandos: 'esta lista',
  };
  const meus = comandosDe(pap);
  return reply('', [{
    title: 'O que podes fazer · papel **' + pap + '**',
    color: pap === 'admin' ? 0x8a7bb8 : pap === 'dev' ? 0xd6a34a : 0x2f7d5b,
    description: meus.map((c) => '`/' + c + '` — ' + desc[c]).join('\n'),
    fields: [{
      name: 'Pedidos que vês',
      value: (CATS_DO_PAPEL[pap] || []).map((c) => (ICONE[c] || '') + (CATS[c] || c)).join('\n'),
    }],
  }]);
}

async function cmdUso(env) {
  const fields = await usageFields(env);
  return reply('', [{
    title: '📊 Consumo agora',
    color: 0x2f7d5b,
    fields,
    timestamp: new Date().toISOString(),
  }]);
}

async function cmdResumo(env, ctx) {
  await dailyReport(env, ctx);
  return reply('Resumo enviado para o canal de administração.');
}

/* ---------------------------- encaminhamento ---------------------------- */

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

  const pap = papel(env, i);
  if (!pap) return json(reply('Não tens permissão para usar este bot.'));

  // botões
  if (i.type === 3) {
    const [, acao, id] = String(i.data.custom_id || '').split(':');
    const estado = acao === 'fim' ? 'concluido' : 'resolucao';
    const antes = await env.DB.prepare('SELECT category FROM tickets WHERE id = ?').bind(id).first();
    if (antes && !podeVer(pap, antes.category)) {
      return json(reply('Esse pedido é de *' + (CATS[antes.category] || antes.category) + '*, fora do papel **' + pap + '**.'));
    }
    const t = await mudarEstado(env, id, estado);
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
    if (!podeCorrer(pap, nome)) {
      return json(reply('**/' + nome + '** é de outro papel — tu és **' + pap + '**.\n' +
        'Podes correr: ' + comandosDe(pap).map((c) => '`/' + c + '`').join(', ') + '.'));
    }
    try {
      if (nome === 'comandos') return json(cmdComandos(pap));
      if (nome === 'pedidos') return json(await cmdPedidos(env, opts, pap));
      if (nome === 'pedido') return json(await cmdPedido(env, opts, pap));
      if (nome === 'responder') return json(await cmdResponder(env, opts, pap));
      if (nome === 'fechar') return json(await cmdFechar(env, opts, pap));
      if (nome === 'erros') return json(await cmdErros(env, opts));
      if (nome === 'uso') return json(await cmdUso(env));
      if (nome === 'copias') return json(await cmdCopias(env, opts));
      if (nome === 'resumo') return json(await cmdResumo(env, ctx));
    } catch (e) {
      return json(reply('Correu mal: ' + cut(e.message, 300)));
    }
    return json(reply('Comando desconhecido.'));
  }

  return json(PONG);
}

// Mensagem num canal usando o bot (permite botões, ao contrário do webhook).
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
