// Avisos para o Discord: um canal para quem programa (pedidos e erros) e
// outro para quem opera (consumo da infraestrutura). Sem webhook configurado,
// tudo isto não faz nada — a app funciona à mesma.

/* Os tectos do plano gratuito que a vigia e o /uso medem. Cada chave tem de
   sair medida do cloudflareUsage, e há um teste que o confere: um tecto
   declarado e nunca medido fazia o resumo parecer completo sem o ser — o KV
   esteve assim, e é o mais apertado (mil escritas por dia: cada entrada na
   app, cada /entrar e cada exceção de acesso gasta uma).
   O D1 e os Workers contam as últimas 24 horas; o KV conta o dia UTC, que é
   quando o tecto dele volta a zero; o R2 conta o espaço ocupado agora (os
   dois buckets somados, porque o tecto é da conta; 10 GB contados em 10⁹
   bytes, o lado prudente) e as operações de classe A desde o dia 1 do mês,
   que é a janela em que o plano as limita. */
export const LIMITS = {
  'D1 · linhas lidas': 5000000,
  'D1 · linhas escritas': 100000,
  'Workers · pedidos': 100000,
  'KV · leituras': 100000,
  'KV · escritas': 1000,
  'R2 · armazenamento': 10e9,
  'R2 · operações de classe A (mês)': 1000000,
};
// Os que se medem em bytes: leem-se em GB, não em dígitos.
const EM_BYTES = ['R2 · armazenamento'];
// R2: as operações de classe B e as gratuitas. Classe A é o resto, de
// propósito — uma operação nova da Cloudflare conta no tecto mais apertado
// até alguém a arrumar aqui.
const R2_CLASSE_B = ['HeadBucket', 'HeadObject', 'GetObject', 'UsageSummary', 'GetBucketEncryption',
  'GetBucketLocation', 'GetBucketCors', 'GetBucketLifecycleConfiguration'];
const R2_GRATIS = ['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload'];

// Um valor medido como se lê: os bytes em GB, com a vírgula portuguesa; o resto em número inteiro.
// Recebe: k — o nome do tecto (uma chave de LIMITS); v — o valor (número).
// Devolve: o texto do valor.
function medida(k, v) {
  if (EM_BYTES.indexOf(k) > -1) return (v / 1e9).toFixed(2).replace('.', ',') + ' GB';
  return v.toLocaleString('pt-PT');
}

// POST de JSON para um webhook. Devolve true/false e nunca lança:
// um Discord em baixo não pode partir o resto do pedido.
// Recebe: url — o endereço do webhook (string; vazia ou em falta dá logo false);
// payload — o objeto a serializar em JSON no corpo.
// Devolve: Promise de true/false — true quando o Discord aceitou.
async function post(url, payload) {
  if (!url) return false;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

// Corta a n caracteres com reticências — o Discord recusa embeds com campos longos demais.
// Recebe: s — o texto (qualquer valor; null e undefined viram ''); n — o tamanho máximo (número).
// Devolve: string com n caracteres no máximo, com … no fim quando cortou.
const cut = (s, n) => {
  const t = String(s == null ? '' : s);
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

// Com bot configurado, a mensagem leva botões para resolver o pedido sem sair
// do Discord; sem ele, vai pelo webhook, sem botões.
// Recebe: env — o ambiente do worker (segredos e configuração); ctx — o contexto
// do pedido, para o waitUntil (pode vir nulo); embed — o embed do Discord (objeto);
// components (opcional) — os botões a juntar à mensagem; canal — o id do canal do
// Discord para o bot; webhook — o URL do webhook de recurso; reserva (opcional) —
// função a chamar quando nem o bot nem o webhook entregam.
// Devolve: Promise de true/false — se o aviso chegou por algum caminho.
function avisar(env, ctx, embed, components, canal, webhook, reserva) {
  // fora da produção, o aviso vai marcado para não se confundir
  if (env.ENV_NAME) {
    embed = Object.assign({}, embed, { title: '[' + env.ENV_NAME + '] ' + embed.title });
  }
  const p = (async () => {
    if (env.DISCORD_BOT_TOKEN && canal) {
      const { postAsBot } = await import('./lib/bot.js');
      if (await postAsBot(env, canal, { embeds: [embed], components: components || [] })) return true;
    }
    if (webhook && await post(webhook, { embeds: [embed] })) return true;
    // um canal por configurar não pode calar o aviso: cai para o de quem
    // programa, que é o que existe desde o princípio
    return reserva ? reserva() : false;
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(p);
  return p;
}

// Erros da app e do servidor, infraestrutura, segurança: quem constrói.
// Recebe: env — o ambiente do worker; ctx — o contexto do pedido (pode vir nulo);
// embed — o embed do Discord (objeto); components (opcional) — os botões.
// Devolve: Promise de true/false — se o aviso chegou.
export function notifyDev(env, ctx, embed, components) {
  return avisar(env, ctx, embed, components, env.DISCORD_DEV_CHANNEL, env.DISCORD_DEV_WEBHOOK);
}

// Pedidos contados por pessoas: quem fala com quem usa. Sem canal de suporte
// configurado, vão para onde iam antes.
// Recebe: env — o ambiente do worker; ctx — o contexto do pedido (pode vir nulo);
// embed — o embed do Discord (objeto); components (opcional) — os botões.
// Devolve: Promise de true/false — se o aviso chegou, ao suporte ou a quem programa.
export function notifySuporte(env, ctx, embed, components) {
  return avisar(env, ctx, embed, components,
    env.DISCORD_SUPORTE_CHANNEL, env.DISCORD_SUPORTE_WEBHOOK,
    () => avisar(env, null, embed, components, env.DISCORD_DEV_CHANNEL, env.DISCORD_DEV_WEBHOOK));
}

// O embed de um pedido novo (problema ou sugestão): assunto, corpo, quem o fez
// e o id do ticket no rodapé — é por esse id que os botões do bot o encontram.
// Recebe: t — o ticket (objeto com id, kind — 'problema' ou 'sugestao' —, subject,
// body, context e created_at em milissegundos); user — quem o fez (objeto com id e name).
// Devolve: objeto embed do Discord, pronto para notifySuporte.
export function ticketEmbed(t, user) {
  return {
    title: (t.kind === 'problema' ? '🐞 Problema' : '💡 Sugestão') + ' · ' + cut(t.subject, 80),
    description: cut(t.body, 1200),
    color: t.kind === 'problema' ? 0xb94a48 : 0x2f7d5b,
    fields: [
      { name: 'De', value: cut((user.name || 'sem nome') + ' · ' + user.id, 100), inline: true },
      { name: 'Estado', value: 'criado', inline: true },
      { name: 'Contexto', value: cut(t.context || '—', 200), inline: false },
    ],
    footer: { text: 'ticket ' + t.id },
    timestamp: new Date(t.created_at).toISOString(),
  };
}

// O embed de um relato de erro (r vem da tabela de relatos, já agregado por mensagem:
// n é quantas vezes aconteceu, pessoas a quantos utilizadores diferentes).
// Recebe: r — o relato (objeto com id, kind — 'server' ou 'client' —, message, detail,
// user_id, versao, contexto, n, pessoas e created_at em milissegundos).
// Devolve: objeto embed do Discord, pronto para notifyDev.
export function errorEmbed(r) {
  /* Vermelho quando toca em mais do que uma pessoa. Um erro que só acontece a
     alguém pode esperar; um que acontece a vários é outra coisa, e a cor
     poupa a leitura do resto. */
  const varios = r.pessoas > 1;
  const campos = [
    { name: 'Quem', value: r.user_id || 'sem sessão', inline: true },
  ];
  if (r.pessoas) campos.push({ name: 'Pessoas', value: String(r.pessoas), inline: true });
  if (r.versao) campos.push({ name: 'Versão da app', value: String(r.versao), inline: true });
  if (r.contexto) campos.push({ name: 'Onde', value: cut(r.contexto, 100), inline: true });
  campos.push({ name: 'Detalhe', value: '```' + cut(r.detail || '—', 1000) + '```', inline: false });   // o campo aceita 1024
  return {
    title: (varios ? '🔴' : '⚠️') + ' Erro ' + (r.kind === 'server' ? 'no servidor' : 'na app') +
      (r.n > 1 ? ' (×' + r.n + ')' : '') + (varios ? ' · ' + r.pessoas + ' pessoas' : ''),
    description: '```\n' + cut(r.message, 900) + '\n```',
    color: varios ? 0xb94a48 : 0xd6a34a,
    fields: campos,
    footer: { text: 'report ' + r.id },
    timestamp: new Date(r.created_at).toISOString(),
  };
}

// Consumo do dia, contra os limites do plano gratuito. Os números da
// Cloudflare vêm da API de análise; se ela não responder, vai o que
// conseguimos contar por dentro, que chega para perceber a tendência.
// Os campos do consumo, partilhados pelo resumo diário e pelo comando /uso.
// Recebe: env — o ambiente do worker (DB, MAX_USERS e as credenciais da Cloudflare).
// Devolve: Promise com a lista de campos { name, value, inline } para um embed.
export async function usageFields(env) {
  // os valores vão por bind, como no resto do worker: no texto do SQL só vai SQL
  const q = async (sql, ...valores) => {
    try {
      const st = env.DB.prepare(sql);
      return (await (valores.length ? st.bind(...valores) : st).first()) || {};
    } catch (e) { return {}; }
  };
  const dia = Date.now() - 86400000;
  const contas = await q('SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL');
  const ativos = await q('SELECT COUNT(DISTINCT owner_id) AS n FROM houses WHERE updated_at > ?', dia);
  const casas = await q('SELECT COUNT(*) AS n FROM houses WHERE deleted = 0');
  const registos = await q('SELECT COUNT(*) AS n FROM records WHERE deleted = 0');
  const abertos = await q("SELECT COUNT(*) AS n FROM tickets WHERE status <> 'concluido'");
  const erros = await q(
    "SELECT COUNT(*) AS n FROM tickets WHERE category IN ('client', 'server') AND updated_at > ?", dia);

  const max = Number(env.MAX_USERS || 0);
  const pctContas = max ? Math.round(((contas.n || 0) / max) * 100) : null;
  const fields = [
    {
      name: 'Contas',
      value: (contas.n || 0) + (max ? ' / ' + max + '  (' + pctContas + '%)' : ''),
      inline: true,
    },
    { name: 'Ativos (24h)', value: String(ativos.n || 0), inline: true },
    { name: 'Casas · registos', value: (casas.n || 0) + ' · ' + (registos.n || 0), inline: true },
    { name: 'Pedidos abertos', value: String(abertos.n || 0), inline: true },
    { name: 'Erros (24h)', value: String(erros.n || 0), inline: true },
  ];

  // Sem isto, uma cópia que deixasse de correr passava despercebida até ao
  // dia em que fizesse falta.
  const { estado: estadoCopias } = await import('./salvaguarda.js');
  fields.push({ name: 'Cópias de segurança', value: (await estadoCopias(env)).texto, inline: false });

  const uso = await cloudflareUsage(env);
  if (uso) {
    Object.keys(LIMITS).forEach((k) => {
      const v = uso[k];
      // um tecto sem número diz que não o tem: calado, o resumo parecia completo
      if (v == null) {
        fields.push({ name: k, value: 'sem medida — a API de análise não devolveu esta parte', inline: false });
        return;
      }
      const pct = Math.round((v / LIMITS[k]) * 100);
      fields.push({
        name: k,
        value: medida(k, v) + ' / ' + medida(k, LIMITS[k]) +
          '  (' + pct + '%)' + (pct >= 90 ? '  🔴' : pct >= 70 ? '  ⚠️' : ''),
        inline: false,
      });
    });
  } else {
    fields.push({
      name: 'Consumo da Cloudflare',
      value: 'Indisponível. O token precisa da permissão *Account Analytics · Read*.',
      inline: false,
    });
  }
  // o «qual» ao lado do «quantas»: quando as linhas lidas sobem, é aqui que se vê onde
  const pesadas = await consultasPesadas(env);
  if (pesadas && pesadas.length) {
    fields.push({ name: 'D1 · consultas mais pesadas (24h)', value: textoDasConsultas(pesadas), inline: false });
  }
  return fields;
}

/* Vigia de hora a hora.

   O resumo diário avisa a 70% e 90%, mas uma vez por dia: um pico às 10:00
   só aparecia às 09:00 do dia seguinte, quando já não há nada a fazer. Isto
   olha de hora a hora e avisa quando um limite passa os 80%.

   Uma vez por dia por limite. Sem isso, um limite que fica em 85% durante a
   tarde toda mandava vinte e quatro avisos e ninguém voltava a ler nenhum.
   O travão é o mesmo rate_limits que já existe — um contador com prazo é
   exatamente o que aqui é preciso, e poupa uma tabela. */
export const LIMIAR_AVISO = 0.8;

// A vigia em si (a razão de ser está no comentário acima): compara o consumo com os
// tectos, avisa o canal de administração quando um passa o limiar — com @here a partir
// de 95% — e devolve quantos limites motivaram aviso, para o cron poder registar.
// Recebe: env — o ambiente do worker (canal e webhook de administração, credenciais
// da Cloudflare); ctx — o contexto do cron, para o waitUntil (pode vir nulo).
// Devolve: Promise de { avisados, limites?, motivo? } — quantos limites motivaram
// aviso e quais; motivo explica porque não houve avisos quando faltou canal ou dados.
export async function watchLimits(env, ctx) {
  const canal = env.DISCORD_ADMIN_CHANNEL, url = env.DISCORD_ADMIN_WEBHOOK;
  if (!canal && !url) return { avisados: 0, motivo: 'sem canal de administração' };

  const uso = await cloudflareUsage(env);
  if (!uso) return { avisados: 0, motivo: 'sem dados de consumo' };

  const { rateLimit } = await import('./lib/limites.js');
  const apertados = [];
  for (const k of Object.keys(LIMITS)) {
    const v = uso[k];
    if (v == null) continue;
    const fracao = v / LIMITS[k];
    if (fracao < LIMIAR_AVISO) continue;
    // rateLimit devolve true na primeira vez da janela: é o "ainda não avisei hoje"
    if (!(await rateLimit(env, 'aviso:' + k, 1, 86400))) continue;
    apertados.push({ nome: k, valor: v, tecto: LIMITS[k], pct: Math.round(fracao * 100) });
  }
  if (!apertados.length) return { avisados: 0 };

  const grave = apertados.some((a) => a.pct >= 95);
  const payload = {
    content: grave ? '@here' : '',
    embeds: [{
      title: (grave ? '🔴' : '⚠️') + ' Limite do plano gratuito a chegar ao fim',
      description: 'Passado o tecto, a Cloudflare recusa os pedidos — a app deixa de sincronizar.',
      color: grave ? 0xb94a48 : 0xd6a34a,
      fields: apertados.map((a) => ({
        name: a.nome,
        value: medida(a.nome, a.valor) + ' de ' + medida(a.nome, a.tecto) + '  (' + a.pct + '%)',
        inline: false,
      })),
      footer: { text: 'avisa-se uma vez por dia por limite' },
      timestamp: new Date().toISOString(),
    }],
  };
  const enviar = (async () => {
    if (env.DISCORD_BOT_TOKEN && canal) {
      const { postAsBot } = await import('./lib/bot.js');
      if (await postAsBot(env, canal, payload)) return true;
    }
    return post(url, payload);
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(enviar); else await enviar;
  return { avisados: apertados.length, limites: apertados.map((a) => a.nome) };
}

// O resumo diário: manda os campos de usageFields para o canal de administração, com a
// cor a acompanhar o pior sinal encontrado (🔴 acima de 90%, ⚠️ acima de 70%). Devolve
// true/false conforme chegou, ou null quando não há canal nem webhook configurados.
// Recebe: env — o ambiente do worker (canal e webhook de administração); ctx — o
// contexto do cron (aceite mas não usado: aqui espera-se com await).
// Devolve: Promise de true/false conforme chegou, ou null sem canal nem webhook.
export async function dailyReport(env, ctx) {
  const url = env.DISCORD_ADMIN_WEBHOOK;
  const canal = env.DISCORD_ADMIN_CHANNEL;
  if (!url && !canal) return null;   // nada configurado não é uma falha

  const fields = await usageFields(env);
  let cor = 0x2f7d5b;
  fields.forEach((f) => {
    if (/🔴/.test(f.value)) cor = 0xb94a48;
    else if (/⚠️/.test(f.value) && cor !== 0xb94a48) cor = 0xd6a34a;
  });
  const payload = {
    embeds: [{
      title: '📊 Rendorium · consumo diário',
      color: cor,
      fields,
      timestamp: new Date().toISOString(),
    }],
  };
  if (env.DISCORD_BOT_TOKEN && canal) {
    const { postAsBot } = await import('./lib/bot.js');
    if (await postAsBot(env, canal, payload)) return true;
  }
  return post(url, payload);   // diz se chegou: o batimento depende disto
}

// API de análise da Cloudflare (GraphQL), uma pergunta por conjunto de dados.
// Recebe: env — o ambiente do worker (CF_ANALYTICS_TOKEN e CF_ACCOUNT_ID).
// Devolve: Promise com os valores medidos por nome de tecto (as chaves de
// LIMITS) — só os que a API devolveu; ou null quando falta configuração ou
// não veio nada.
async function cloudflareUsage(env) {
  const token = env.CF_ANALYTICS_TOKEN, acc = env.CF_ACCOUNT_ID;
  if (!token || !acc) return null;
  const agora = new Date();
  const desde = new Date(agora.getTime() - 86400000).toISOString();
  const hoje = agora.toISOString().slice(0, 10);
  const mes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
  /* Com prazo. Isto é a API de outra gente, e um pedido sem fim pendurava o
     que estivesse à espera dele — foi o que fez o /uso passar dos três
     segundos que o Discord dá e responder «o aplicativo não respondeu». Sem
     resposta a tempo, o consumo fica de fora e o resto do quadro aparece na
     mesma: é melhor um número a menos do que quadro nenhum.
     E uma pergunta por conjunto, todas ao mesmo tempo: um campo que a
     Cloudflare mude num conjunto faz a resposta inteira vir com erro, e
     assim o KV ou o R2 a falhar não levam o D1, que é o tecto que deita a
     app abaixo. O que falhar aparece no /uso como «sem medida». */
  const pergunta = async (query, variaveis) => {
    const corta = typeof AbortController === 'function' ? new AbortController() : null;
    const prazo = corta ? setTimeout(() => { try { corta.abort(); } catch (e) {} }, 4000) : null;
    try {
      const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: Object.assign({ acc }, variaveis) }),
        signal: corta ? corta.signal : undefined,
      });
      const j = await r.json();
      return (j && j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0]) || null;
    } catch (e) {
      return null;   // sem resposta a tempo, ou resposta que não se entende
    } finally {
      if (prazo) clearTimeout(prazo);
    }
  };
  const [base, kv, r2ops, r2espaco] = await Promise.all([
    pergunta(`query($acc:String!,$desde:Time!){
    viewer{ accounts(filter:{accountTag:$acc}){
      d1AnalyticsAdaptiveGroups(limit:1000, filter:{datetime_geq:$desde}){
        sum{ readQueries writeQueries rowsRead rowsWritten } }
      workersInvocationsAdaptive(limit:1000, filter:{datetime_geq:$desde}){
        sum{ requests errors } }
    } } }`, { desde }),
    pergunta(`query($acc:String!,$hoje:Date!){
    viewer{ accounts(filter:{accountTag:$acc}){
      kvOperationsAdaptiveGroups(limit:1000, filter:{date_geq:$hoje}){
        sum{ requests } dimensions{ actionType } }
    } } }`, { hoje }),
    pergunta(`query($acc:String!,$mes:Time!){
    viewer{ accounts(filter:{accountTag:$acc}){
      r2OperationsAdaptiveGroups(limit:1000, filter:{datetime_geq:$mes}){
        sum{ requests } dimensions{ actionType } }
    } } }`, { mes }),
    pergunta(`query($acc:String!,$desde:Time!){
    viewer{ accounts(filter:{accountTag:$acc}){
      r2StorageAdaptiveGroups(limit:100, filter:{datetime_geq:$desde}){
        max{ payloadSize metadataSize } dimensions{ bucketName } }
    } } }`, { desde }),
  ]);
  const soma = (arr, valor) => (arr || []).reduce((t, x) => t + (valor(x) || 0), 0);
  const pedidos = (x) => x.sum && x.sum.requests;
  const tipo = (x) => String((x.dimensions && x.dimensions.actionType) || '');
  const out = {};
  if (base) {
    out['D1 · linhas lidas'] = soma(base.d1AnalyticsAdaptiveGroups, (x) => x.sum && x.sum.rowsRead);
    out['D1 · linhas escritas'] = soma(base.d1AnalyticsAdaptiveGroups, (x) => x.sum && x.sum.rowsWritten);
    out['Workers · pedidos'] = soma(base.workersInvocationsAdaptive, pedidos);
  }
  if (kv && Array.isArray(kv.kvOperationsAdaptiveGroups)) {
    const deTipo = (t) => soma(kv.kvOperationsAdaptiveGroups.filter((x) => tipo(x).toLowerCase() === t), pedidos);
    out['KV · leituras'] = deTipo('read');
    out['KV · escritas'] = deTipo('write');
  }
  if (r2ops && Array.isArray(r2ops.r2OperationsAdaptiveGroups)) {
    out['R2 · operações de classe A (mês)'] = soma(r2ops.r2OperationsAdaptiveGroups
      .filter((x) => R2_CLASSE_B.indexOf(tipo(x)) < 0 && R2_GRATIS.indexOf(tipo(x)) < 0), pedidos);
  }
  if (r2espaco && Array.isArray(r2espaco.r2StorageAdaptiveGroups)) {
    // o máximo de cada bucket na janela é o que ele ocupa agora; o tecto é da conta, somam-se
    out['R2 · armazenamento'] = soma(r2espaco.r2StorageAdaptiveGroups,
      (x) => x.max && ((x.max.payloadSize || 0) + (x.max.metadataSize || 0)));
  }
  return Object.keys(out).length ? out : null;
}

/* As consultas à D1 que mais linhas leram nas últimas 24 horas.
   O «quantas» já vinha (d1AnalyticsAdaptiveGroups, acima); isto é o «qual».
   Importa mais desde 2026-09-01: passar dos 5M de linhas lidas por dia já
   não é um aviso — as consultas passam a falhar até à meia-noite UTC, e a
   app fica em baixo. Quando a vigia toca, é aqui que se vê onde mexer.
   Pedido à parte, com prazo próprio: se o esquema deste conjunto mudar, o
   resumo perde esta secção e mais nada.
   Recebe: env — o ambiente do worker (CF_ANALYTICS_TOKEN e CF_ACCOUNT_ID).
   Devolve: Promise com lista de {consulta, linhas, vezes} das cinco mais
   pesadas, por ordem; ou null sem configuração ou sem resposta. */
export async function consultasPesadas(env) {
  const token = env.CF_ANALYTICS_TOKEN, acc = env.CF_ACCOUNT_ID;
  if (!token || !acc) return null;
  const desde = new Date(Date.now() - 86400000).toISOString();
  const query = `query($acc:String!,$desde:Time!){
    viewer{ accounts(filter:{accountTag:$acc}){
      d1QueriesAdaptiveGroups(limit:5, filter:{datetime_geq:$desde}, orderBy:[sum_rowsRead_DESC]){
        dimensions{ query } sum{ rowsRead } count } } } }`;
  const corta = typeof AbortController === 'function' ? new AbortController() : null;
  const prazo = corta ? setTimeout(() => { try { corta.abort(); } catch (e) {} }, 4000) : null;
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { acc, desde } }),
      signal: corta ? corta.signal : undefined,
    });
    const j = await r.json();
    const a = j && j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0];
    if (!a || !Array.isArray(a.d1QueriesAdaptiveGroups)) return null;
    return a.d1QueriesAdaptiveGroups.map((x) => ({
      consulta: (x.dimensions && x.dimensions.query) || '',
      linhas: (x.sum && x.sum.rowsRead) || 0,
      vezes: x.count || 0,
    }));
  } catch (e) {
    return null;
  } finally {
    if (prazo) clearTimeout(prazo);
  }
}

// A lista das consultas pesadas em texto, uma por linha, para o embed.
// Recebe: lista — o que consultasPesadas devolve ({consulta, linhas, vezes}).
// Devolve: texto com uma linha por consulta: linhas lidas, vezes, e a
// consulta cortada — os parâmetros não vêm (a D1 não os guarda), portanto
// não há valores de ninguém aqui.
export function textoDasConsultas(lista) {
  return (lista || []).map((c) => {
    const sql = String(c.consulta || '').replace(/\s+/g, ' ').trim();
    return '`' + Number(c.linhas || 0).toLocaleString('pt-PT') + '` · ' + (c.vezes || 0) + '× · ' +
      (sql.length > 70 ? sql.slice(0, 69) + '…' : sql);
  }).join('\n') || '—';
}
