/* O histórico do consumo (KAN-144): as amostras que a vigia de hora a hora
   grava na tabela consumo_amostras (migrations/0031_consumo_amostras.sql) e a
   série que a Operação do back office desenha quando se toca num valor.

   Uma amostra por hora, todas as medidas num só INSERT (o json_each de um
   texto JSON, um bind só); cada fonte falha sozinha — uma tabela da D1 em
   baixo tira esse número, a Cloudflare sem resposta tira os tectos, e a vigia
   nunca cai por isto. O que tiver mais de 400 dias apaga-se na mesma vigia.

   O passado só se reconstrói onde a D1 o diz com honestidade: as contas,
   pelo users.created_at e pelo deleted_at (uma conta apagada fica na tabela,
   com a hora em que se apagou). As casas e os registos não têm data de
   criação na D1 (houses e records só guardam o updated_at, e um apagado só
   o deleted), os ativos e os erros dependem de updated_at que já mudaram, e
   os tectos da Cloudflare não ficam guardados em lado nenhum — começam no
   deploy, e o gráfico diz «Sem dados antes de <dia>» em vez de inventar. */

import { LIMITS, contagensDaBase, contarNaBase, cloudflareUsage } from '../notify.js';

const HORA = 3600000, DIA = 86400000;
// quanto tempo vive uma amostra: um ano e mais um pouco, para o 1a ter sempre o ano inteiro
export const RETENCAO_MS = 400 * DIA;

/* As medidas com histórico: o id (o da tabela e da rota), o nome que se lê,
   o campo do resumo (notify.js:usageFields) a que pertencem, de onde vêm
   (d1: CONTAGENS do notify.js; cf: o cloudflareUsage, com o tecto em LIMITS)
   e como se junta um intervalo do gráfico — o fim (o valor no fim do
   intervalo, para o que se conta agora) ou o pico (o máximo, para os tectos:
   o que importa é se passou perto). */
export const MEDIDAS = {
  contas: { nome: 'Contas', campo: 'Contas', fonte: 'd1', agrega: 'fim' },
  ativos: { nome: 'Ativos nas últimas 24 h', campo: 'Ativos (24h)', fonte: 'd1', agrega: 'fim' },
  casas: { nome: 'Casas', campo: 'Casas', fonte: 'd1', agrega: 'fim' },
  registos: { nome: 'Registos', campo: 'Registos', fonte: 'd1', agrega: 'fim' },
  pedidos: { nome: 'Pedidos abertos', campo: 'Pedidos abertos', fonte: 'd1', agrega: 'fim' },
  erros: { nome: 'Erros nas 24 h', campo: 'Erros (24h)', fonte: 'd1', agrega: 'fim' },
  'd1-lidas': { nome: 'D1 · linhas lidas', campo: 'D1 · linhas lidas', fonte: 'cf', agrega: 'pico' },
  'd1-escritas': { nome: 'D1 · linhas escritas', campo: 'D1 · linhas escritas', fonte: 'cf', agrega: 'pico' },
  'workers-pedidos': { nome: 'Workers · pedidos', campo: 'Workers · pedidos', fonte: 'cf', agrega: 'pico' },
  'kv-leituras': { nome: 'KV · leituras', campo: 'KV · leituras', fonte: 'cf', agrega: 'pico' },
  'kv-escritas': { nome: 'KV · escritas', campo: 'KV · escritas', fonte: 'cf', agrega: 'pico' },
  'r2-espaco': { nome: 'R2 · armazenamento', campo: 'R2 · armazenamento', fonte: 'cf', agrega: 'pico', unidade: 'bytes' },
  'r2-classe-a': { nome: 'R2 · operações de classe A (mês)', campo: 'R2 · operações de classe A (mês)', fonte: 'cf', agrega: 'pico' },
};

/* Os horizontes do gráfico: quanto tempo para trás e de quanto em quanto
   se junta (1d e 7d por hora, 14d por 6 h, 1m e 3m por dia, 1a por semana),
   para o gráfico ter umas dezenas de pontos e não milhares. Os intervalos
   contam-se em UTC; a semana começa à segunda-feira (origem: segunda,
   5 de janeiro de 1970). */
export const HORIZONTES = {
  '1d': { ms: DIA, passo: HORA },
  '7d': { ms: 7 * DIA, passo: HORA },
  '14d': { ms: 14 * DIA, passo: 6 * HORA },
  '1m': { ms: 30 * DIA, passo: DIA },
  '3m': { ms: 91 * DIA, passo: DIA },
  '1a': { ms: 365 * DIA, passo: 7 * DIA, origem: 4 * DIA },
};

/* Os campos do resumo que têm série, com o id da medida: o painel da
   Operação manda-o ao guião, que liga cada quadrado e cada tecto ao seu
   gráfico (o «Casas · registos» do resumo parte-se em dois no guião).
   Devolve: { nome do campo: id da medida }. */
export function medidasDosCampos() {
  const out = {};
  for (const id of Object.keys(MEDIDAS)) out[MEDIDAS[id].campo] = id;
  return out;
}

/* O INSERT em lote: as linhas num texto JSON ([[medida, at, valor], …]),
   desfeitas pelo json_each numa só instrução e num só bind (a D1 limita os
   binds por instrução; um ano de dias passava-os).
   Recebe: env (DB); linhas — a lista; substituir — true repõe a amostra que
   já houver na mesma hora (a vigia), false guarda a que lá está (o passado).
   Devolve: Promise de quantas linhas se mandaram. */
async function inserirEmLote(env, linhas, substituir) {
  if (!linhas.length) return 0;
  await env.DB.prepare(
    'INSERT OR ' + (substituir ? 'REPLACE' : 'IGNORE') + ' INTO consumo_amostras (medida, at, valor) ' +
    "SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]') FROM json_each(?)"
  ).bind(JSON.stringify(linhas)).run();
  return linhas.length;
}

/* A amostra desta hora: os números da D1 e os tectos da Cloudflare que
   vieram com número, à hora certa (a vigia corre aos :00; uma segunda volta
   na mesma hora repõe a amostra, não a duplica).
   Recebe: env (DB); uso — o cloudflareUsage já pedido (ou null); agora — o instante (ms).
   Devolve: Promise de quantas medidas se gravaram. */
export async function gravarAmostra(env, uso, agora) {
  const t = Math.floor(agora / HORA) * HORA;
  const c = await contagensDaBase(env, agora);
  const linhas = [];
  for (const id of Object.keys(MEDIDAS)) {
    const m = MEDIDAS[id];
    const v = m.fonte === 'd1' ? c[id] : (uso ? uso[m.nome] : null);
    if (v != null && isFinite(v)) linhas.push([id, t, Number(v)]);
  }
  return inserirEmLote(env, linhas, true);
}

/* Apaga as amostras com mais de RETENCAO_MS, medida a medida pela chave
   (medida, at): a vigia corre de hora a hora, e um varrimento da tabela
   inteira a cada hora gastava as leituras que a vigia existe para poupar.
   Recebe: env (DB); agora — o instante (ms).
   Devolve: Promise de quantas linhas saíram. */
export async function limparAmostras(env, agora) {
  const ids = Object.keys(MEDIDAS);
  const r = await env.DB.prepare(
    'DELETE FROM consumo_amostras WHERE medida IN (' + ids.map(() => '?').join(', ') + ') AND at < ?'
  ).bind(...ids, agora - RETENCAO_MS).run();
  return (r && r.meta && r.meta.changes) || 0;
}

/* Falta reconstruir o passado das contas? Sim quando ainda não há amostra
   das contas, ou quando a mais antiga é mais nova do que o dia a seguir à
   primeira conta (ou do que o começo da retenção, se a primeira conta for
   mais velha). Depois do passado feito, a mais antiga cai nesse dia e isto
   passa a não — sem marca à parte.
   Recebe: env (DB); agora — o instante (ms).
   Devolve: Promise de true/false. */
export async function precisaDoPassado(env, agora) {
  const a = await env.DB.prepare("SELECT MIN(at) AS a FROM consumo_amostras WHERE medida = 'contas'").first();
  const u = await env.DB.prepare('SELECT MIN(created_at) AS c FROM users').first();
  if (!u || u.c == null) return false;
  const desde = Math.max(Number(u.c), agora - RETENCAO_MS);
  return !a || a.a == null || Number(a.a) > desde + DIA;
}

/* O passado das contas, dia a dia: quantas existiam no fim de cada dia UTC
   (criadas até lá, menos as apagadas até lá), desde a primeira conta (ou
   desde o começo da retenção) até ontem. Duas consultas agrupadas por dia e
   um INSERT em lote, que guarda a amostra da vigia quando cai no mesmo
   instante (meia-noite UTC).
   Recebe: env (DB); agora — o instante (ms).
   Devolve: Promise de quantos dias se mandaram. */
export async function preencherPassado(env, agora) {
  const criadas = (await env.DB.prepare(
    'SELECT CAST(created_at / 86400000 AS INTEGER) AS d, COUNT(*) AS n FROM users GROUP BY d ORDER BY d').all()).results || [];
  const apagadas = (await env.DB.prepare(
    'SELECT CAST(deleted_at / 86400000 AS INTEGER) AS d, COUNT(*) AS n FROM users WHERE deleted_at IS NOT NULL GROUP BY d').all()).results || [];
  if (!criadas.length) return 0;
  const menos = {};
  apagadas.forEach((r) => { menos[r.d] = Number(r.n); });
  const mais = {};
  criadas.forEach((r) => { mais[r.d] = Number(r.n); });
  const hoje = Math.floor(agora / DIA), corte = agora - RETENCAO_MS;
  const linhas = [];
  let n = 0;
  // as apagadas antes da primeira criada não existem (deleted_at > created_at), mas somam-se na mesma
  const primeiro = Math.min(Number(criadas[0].d), ...apagadas.map((r) => Number(r.d)));
  for (let d = primeiro; d < hoje; d++) {
    n += (mais[d] || 0) - (menos[d] || 0);
    const t = (d + 1) * DIA;
    if (t >= corte) linhas.push(['contas', t, Math.max(0, n)]);
  }
  return inserirEmLote(env, linhas, false);
}

/* Tudo o que a vigia faz pelo histórico, cada parte no seu try: a amostra,
   a limpeza e, quando falta, o passado das contas. Nunca lança.
   Recebe: env (DB); uso — o cloudflareUsage já pedido (ou null); agora — o instante (ms).
   Devolve: Promise de { gravadas, apagadas, passado, erros: [texto…] }. */
export async function amostraDaVigia(env, uso, agora) {
  const out = { gravadas: 0, apagadas: 0, passado: 0, erros: [] };
  const falhou = (onde, e) => out.erros.push(onde + ': ' + String((e && e.message) || e).slice(0, 160));
  try { out.gravadas = await gravarAmostra(env, uso, agora); } catch (e) { falhou('amostra', e); }
  try { out.apagadas = await limparAmostras(env, agora); } catch (e) { falhou('limpeza', e); }
  try {
    if (await precisaDoPassado(env, agora)) out.passado = await preencherPassado(env, agora);
  } catch (e) { falhou('passado', e); }
  return out;
}

/* O valor de agora de uma medida, ao vivo: a contagem da D1, ou o número
   da Cloudflare (que só vem com o token de análise).
   Recebe: env; medida — o id em MEDIDAS; agora — o instante (ms).
   Devolve: Promise do número, ou null quando não há. */
export async function valorAgora(env, medida, agora) {
  const m = MEDIDAS[medida];
  if (!m) return null;
  if (m.fonte === 'd1') return contarNaBase(env, medida, agora);
  const uso = await cloudflareUsage(env);
  const v = uso ? uso[m.nome] : null;
  return v != null && isFinite(v) ? Number(v) : null;
}

/* A série de uma medida num horizonte: as amostras juntas por intervalo
   (o fim ou o pico, como a medida diz), o valor de agora no fim, o instante
   da amostra mais antiga (para o «Sem dados antes de») e o tecto, quando há.
   Recebe: env (DB, MAX_USERS e as credenciais da Cloudflare); medida — o id
   em MEDIDAS; horizonte — a chave em HORIZONTES; agora — o instante (ms).
   Devolve: Promise de { medida, nome, horizonte, inicio, fim, passo, agrega,
   unidade, tecto, desde, pontos: [{t, v, vivo?}] } — t é o começo do
   intervalo (nunca antes do início), e o último ponto, vivo, é o de agora. */
export async function serieDe(env, medida, horizonte, agora) {
  const m = MEDIDAS[medida], h = HORIZONTES[horizonte];
  const inicio = agora - h.ms, origem = h.origem || 0;
  const juntar = m.agrega === 'pico'
    ? 'SELECT CAST((at - ?) / ? AS INTEGER) AS b, MAX(valor) AS v FROM consumo_amostras ' +
      'WHERE medida = ? AND at >= ? AND at <= ? GROUP BY b ORDER BY b'
    // o fim: a coluna solta ao lado do MAX(at) é, no SQLite, a da linha desse máximo
    : 'SELECT CAST((at - ?) / ? AS INTEGER) AS b, MAX(at) AS ultimo, valor AS v FROM consumo_amostras ' +
      'WHERE medida = ? AND at >= ? AND at <= ? GROUP BY b ORDER BY b';
  const linhas = (await env.DB.prepare(juntar).bind(origem, h.passo, medida, inicio, agora).all()).results || [];
  const pontos = linhas.map((r) => ({ t: Math.max(inicio, Number(r.b) * h.passo + origem), v: Number(r.v) }));
  const d = await env.DB.prepare('SELECT MIN(at) AS a FROM consumo_amostras WHERE medida = ?').bind(medida).first();
  const vivo = await valorAgora(env, medida, agora);
  if (vivo != null) pontos.push({ t: agora, v: vivo, vivo: true });
  let tecto = null;
  if (m.fonte === 'cf') tecto = LIMITS[m.nome];
  else if (medida === 'contas' && Number(env.MAX_USERS) > 0) tecto = Number(env.MAX_USERS);
  return {
    medida, nome: m.nome, horizonte, inicio, fim: agora, passo: h.passo, agrega: m.agrega,
    unidade: m.unidade || null, tecto, desde: d && d.a != null ? Number(d.a) : null, pontos,
  };
}
