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
const cut = (s, n) => { const t = String(s == null ? '' : s); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

// Só quem estiver na lista pode mexer. Sem lista, qualquer pessoa com acesso
// ao servidor de Discord pode — é o dono que decide ao configurar.
function autorizado(env, i) {
  const lista = String(env.DISCORD_ADMINS || '').split(/[,\s]+/).filter(Boolean);
  if (!lista.length) return true;
  const uid = (i.member && i.member.user && i.member.user.id) || (i.user && i.user.id);
  return lista.indexOf(uid) > -1;
}

function ticketEmbedFull(t) {
  return {
    title: (t.kind === 'problema' ? '🐞 ' : '💡 ') + cut(t.subject, 90),
    description: cut(t.body, 1500),
    color: t.status === 'concluido' ? 0x9aa7a1 : (t.kind === 'problema' ? 0xb94a48 : 0x2f7d5b),
    fields: [
      { name: 'Estado', value: ESTADOS[t.status] || t.status, inline: true },
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

async function cmdPedidos(env, opts) {
  const estado = (opts.estado || '').trim();
  const sql = estado
    ? 'SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC LIMIT 10'
    : "SELECT * FROM tickets WHERE status <> 'concluido' ORDER BY created_at DESC LIMIT 10";
  const st = env.DB.prepare(sql);
  const rows = (await (estado ? st.bind(estado) : st).all()).results;
  if (!rows.length) return reply(estado ? 'Nenhum pedido em “' + estado + '”.' : '✅ Nenhum pedido por tratar.');
  return reply('', rows.map(function (t) {
    return {
      title: (t.kind === 'problema' ? '🐞 ' : '💡 ') + cut(t.subject, 90),
      description: cut(t.body, 300),
      color: t.kind === 'problema' ? 0xb94a48 : 0x2f7d5b,
      footer: { text: ESTADOS[t.status] + ' · ' + t.id.slice(0, 8) + ' · ' + t.user_id },
    };
  }));
}

async function cmdPedido(env, opts) {
  const t = await acharTicket(env, opts.id);
  if (!t) return reply('Não encontrei nenhum pedido com esse id.');
  return { type: MSG, data: { embeds: [ticketEmbedFull(t)], components: ticketButtons(t.id) } };
}

async function cmdResponder(env, opts) {
  const t = await mudarEstado(env, opts.id, 'resolucao', opts.texto);
  if (!t) return reply('Não encontrei nenhum pedido com esse id.');
  return reply('✏️ Respondido e marcado como **em resolução**. A pessoa vê a resposta na app.',
    [ticketEmbedFull(t)]);
}

async function cmdFechar(env, opts) {
  const t = await mudarEstado(env, opts.id, 'concluido', opts.texto);
  if (!t) return reply('Não encontrei nenhum pedido com esse id.');
  return reply('✅ Concluído.', [ticketEmbedFull(t)]);
}

async function cmdErros(env, opts) {
  const horas = Math.min(Math.max(Number(opts.horas || 24), 1), 720);
  const desde = Date.now() - horas * 3600000;
  const rows = (await env.DB.prepare(
    'SELECT * FROM reports WHERE updated_at > ? ORDER BY n DESC, updated_at DESC LIMIT 10'
  ).bind(desde).all()).results;
  if (!rows.length) return reply('✅ Sem erros nas últimas ' + horas + ' horas.');
  return reply('Erros das últimas ' + horas + ' horas:', rows.map(function (r) {
    return {
      title: '⚠️ ' + cut(r.message, 90) + (r.n > 1 ? '  ×' + r.n : ''),
      description: '```' + cut(r.detail || '—', 500) + '```',
      color: 0xd6a34a,
      footer: { text: (r.kind === 'servidor' ? 'servidor' : 'app') + ' · ' + (r.user_id || 'sem sessão') },
    };
  }));
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

  if (!autorizado(env, i)) return json(reply('Não tens permissão para usar este bot.'));

  // botões
  if (i.type === 3) {
    const [, acao, id] = String(i.data.custom_id || '').split(':');
    const estado = acao === 'fim' ? 'concluido' : 'resolucao';
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
    try {
      if (nome === 'pedidos') return json(await cmdPedidos(env, opts));
      if (nome === 'pedido') return json(await cmdPedido(env, opts));
      if (nome === 'responder') return json(await cmdResponder(env, opts));
      if (nome === 'fechar') return json(await cmdFechar(env, opts));
      if (nome === 'erros') return json(await cmdErros(env, opts));
      if (nome === 'uso') return json(await cmdUso(env));
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
