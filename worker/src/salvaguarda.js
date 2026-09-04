// Cópia da base de dados para fora da base de dados.
//
// O Time Travel da D1 repõe a base num instante do passado, mas no plano
// gratuito só guarda 7 dias — e vive dentro da própria base: não serve de
// nada se a base for apagada, se a conta se perder, ou se um erro só der
// pela falta de dados duas semanas depois. Daí uma cópia diária no R2, que é
// outro serviço, com outro ciclo de vida.
//
// Formato: NDJSON comprimido. Uma linha por registo, `{"t":tabela,"r":{...}}`,
// precedida de um cabeçalho com a data e as tabelas incluídas. É um formato
// que se lê com o olho e se restaura com um ciclo — ver scripts/restaurar.js.

import { now } from './lib/http.js';

export const PREFIXO = 'copias/';
export const DIAS = 14;         // cópias diárias mantidas
export const MESES = 12;        // e a do dia 1 de cada mês, durante um ano
const PAGINA = 500;             // registos por consulta

// A retenção do Time Travel no plano gratuito da Cloudflare. Está aqui para
// aparecer no resumo diário: é a diferença entre "temos 7 dias" e o que
// julgávamos ter.
export const TIME_TRAVEL_DIAS = 7;

// Tabelas que não vale a pena copiar: contadores efémeros que se refazem
// sozinhos, e o que é interno do SQLite ou da D1.
const FORA = /^(rate_limits|sqlite_|_cf_|d1_)/;
const NOME_OK = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const dia = (t) => new Date(t).toISOString().slice(0, 10);
export const chaveDoDia = (t) => PREFIXO + dia(t) + '.ndjson.gz';
export const diaDaChave = (k) => {
  const m = /(\d{4}-\d{2}-\d{2})\.ndjson\.gz$/.exec(String(k));
  return m ? m[1] : null;
};

// Que cópias já não são precisas. Mantém-se as dos últimos DIAS dias e, para
// trás disso, só a do dia 1 de cada mês durante MESES meses. Função pura de
// propósito: a decisão de apagar é a que mais interessa poder testar.
// Recebe: chaves — as chaves R2 das cópias (copias/AAAA-MM-DD.ndjson.gz);
// agora — o instante atual, em milissegundos de época; dias (opcional) —
// quantos dias de cópias diárias manter; meses (opcional) — por quantos
// meses guardar a do dia 1.
// Devolve: a lista das chaves a apagar (o que não se reconhece fica).
export function aPodar(chaves, agora, dias = DIAS, meses = MESES) {
  const limiteDiario = agora - dias * 86400000;
  const limiteMensal = agora - meses * 31 * 86400000;
  return chaves.filter((k) => {
    const d = diaDaChave(k);
    if (!d) return false;             // o que não reconhecemos não se apaga
    const t = Date.parse(d + 'T00:00:00Z');
    if (Number.isNaN(t)) return false;
    if (t >= limiteDiario) return false;
    if (d.slice(8) === '01' && t >= limiteMensal) return false;
    return true;
  });
}

// As tabelas da base, descobertas em vez de escritas à mão: uma tabela nova
// numa migração passa a ser copiada sem ninguém se lembrar dela.
// Recebe: env — o ambiente do worker (a base D1).
// Devolve: promessa da lista de nomes das tabelas a copiar, por ordem
// alfabética.
export async function tabelasDaBase(env) {
  const r = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
  ).all();
  return (r.results || [])
    .map((x) => x.name)
    .filter((n) => NOME_OK.test(n) && !FORA.test(n));
}

// Lê a base por páginas e vai entregando linhas NDJSON. Nunca tem a base
// toda em memória — o worker tem 128 MB e a base pode ir até 500.
// Recebe: env — o ambiente do worker (a base D1); tabelas — os nomes das
// tabelas a copiar; conta — o objeto { linhas, t } onde se vai somando o que
// já foi escrito.
// Devolve: um ReadableStream de bytes — o cabeçalho primeiro, depois uma
// linha NDJSON por registo.
function fluxo(env, tabelas, conta) {
  const enc = new TextEncoder();
  let ti = 0, salto = 0, cabecalho = false;
  return new ReadableStream({
    async pull(c) {
      if (!cabecalho) {
        cabecalho = true;
        c.enqueue(enc.encode(JSON.stringify({
          _: 'gestor-imobiliario', versao: 1, data: new Date(conta.t).toISOString(), tabelas,
        }) + '\n'));
        return;
      }
      if (ti >= tabelas.length) { c.close(); return; }
      const t = tabelas[ti];
      const r = await env.DB.prepare(
        'SELECT * FROM "' + t + '" LIMIT ? OFFSET ?'
      ).bind(PAGINA, salto).all();
      const linhas = r.results || [];
      if (linhas.length < PAGINA) { ti++; salto = 0; } else { salto += PAGINA; }
      if (!linhas.length) { c.enqueue(enc.encode('')); return; }
      conta.linhas += linhas.length;
      c.enqueue(enc.encode(
        linhas.map((linha) => JSON.stringify({ t, r: linha })).join('\n') + '\n'
      ));
    },
  });
}

// Faz a cópia do dia e poda as que já não são precisas. Devolve o que
// aconteceu, para o resumo diário poder dizer se correu bem.
// Recebe: env — o ambiente do worker (a base D1 e o bucket FILES).
// Devolve: promessa de { chave, tabelas, linhas, modo, bytes, podadas, ms }
// quando corre, ou { erro } sem bucket ou com a base grande de mais.
export async function copiar(env) {
  if (!env.FILES) return { erro: 'Sem bucket R2 ligado.' };
  const t = now();
  const conta = { linhas: 0, t };
  const tabelas = await tabelasDaBase(env);
  const chave = chaveDoDia(t);
  const opcoes = {
    httpMetadata: { contentType: 'application/x-ndjson', contentEncoding: 'gzip' },
    customMetadata: { tabelas: String(tabelas.length), versao: '1' },
  };
  const gz = () => fluxo(env, tabelas, conta).pipeThrough(new CompressionStream('gzip'));

  // O caminho normal escreve em fluxo, sem nunca ter a base toda em memória.
  // A documentação do R2 não promete aceitar um fluxo de tamanho desconhecido,
  // e uma cópia de segurança não é sítio para apostas: se falhar, junta-se
  // tudo e escreve-se de uma vez. Só nesse caminho é que o tamanho importa.
  let modo = 'fluxo';
  try {
    await env.FILES.put(chave, gz(), opcoes);
  } catch (e) {
    modo = 'memoria';
    conta.linhas = 0;
    const buf = await new Response(gz()).arrayBuffer();
    if (buf.byteLength > 60 * 1024 * 1024) {
      return { erro: 'A base já não cabe em memória e o fluxo falhou: ' + String(e && e.message) };
    }
    await env.FILES.put(chave, buf, opcoes);
  }

  // o tamanho só se sabe depois de escrito, porque vai comprimido
  const meta = await env.FILES.head(chave);
  const podadas = await podar(env, t);
  return {
    chave, tabelas: tabelas.length, linhas: conta.linhas, modo,
    bytes: (meta && meta.size) || 0, podadas, ms: now() - t,
  };
}

// Apaga do R2 as cópias que o aPodar marcar e devolve quantas foram.
// Recebe: env — o ambiente do worker (o bucket FILES); agora (opcional) — o
// instante de referência, em milissegundos de época (por omissão, este).
// Devolve: promessa do número de cópias apagadas.
export async function podar(env, agora = now()) {
  const todas = await listar(env);
  const fora = aPodar(todas.map((o) => o.key), agora);
  for (const k of fora) await env.FILES.delete(k);
  return fora.length;
}

// Todas as cópias no R2, como {key, size, uploaded}, da mais recente para a
// mais antiga. Segue a paginação até ao fim: é sobre esta lista que se poda.
// Recebe: env — o ambiente do worker (o bucket FILES).
// Devolve: promessa da lista de { key, size, uploaded }, da mais recente
// para a mais antiga.
export async function listar(env) {
  const out = [];
  let cursor;
  do {
    const r = await env.FILES.list({ prefix: PREFIXO, cursor });
    (r.objects || []).forEach((o) => out.push({ key: o.key, size: o.size, uploaded: o.uploaded }));
    cursor = r.truncated ? r.cursor : null;
  } while (cursor);
  return out.sort((a, b) => (a.key < b.key ? 1 : -1));   // mais recente primeiro
}

// Resumo para o canal de administração: uma cópia que deixou de acontecer só
// se dá por falta quando é precisa, por isso é preciso dizê-lo todos os dias.
// Recebe: env — o ambiente do worker (o bucket FILES).
// Devolve: promessa de { copias, idade, bytes, ultima, texto } — ou
// { vazio, texto } sem cópias, ou { erro, texto } quando a leitura falha.
// O texto vai sempre pronto para o canal.
export async function estado(env) {
  try {
    const copias = await listar(env);
    if (!copias.length) return { vazio: true, texto: '🔴 Nenhuma cópia no R2.' };
    const ultima = copias[0];
    const d = diaDaChave(ultima.key);
    const idade = Math.floor((now() - Date.parse(d + 'T00:00:00Z')) / 86400000);
    const total = copias.reduce((s, o) => s + o.size, 0);
    const sinal = idade <= 1 ? '🟢' : idade <= 3 ? '⚠️' : '🔴';
    return {
      copias: copias.length, idade, bytes: total, ultima: d,
      texto: sinal + ' ' + d + ' (' + kb(ultima.size) + ') · ' + copias.length +
        ' cópias, ' + kb(total) + ' · Time Travel ' + TIME_TRAVEL_DIAS + ' dias',
    };
  } catch (e) {
    return { erro: String((e && e.message) || e), texto: '🔴 Não deu para ler as cópias.' };
  }
}

// Bytes em texto de gente: "512 KB", "3,2 MB" — com a vírgula portuguesa.
// Recebe: n — o número de bytes.
// Devolve: o texto legível; o que não for positivo dá "0 KB".
export function kb(n) {
  if (!(n > 0)) return '0 KB';
  if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
  return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
}
