// Peças de HTTP partilhadas por todas as rotas: respostas, leitura do corpo,
// validação de identificadores e os limites de tamanho.

export const MAX_BODY = 2 * 1024 * 1024;   // 2 MB por pedido
export const MAX_RECORD = 256 * 1024;      // 256 KB por registo guardado

// Versão dos termos e da política em vigor. Mudá-la faz a app pedir de novo
// a aceitação a toda a gente, na próxima vez que abrirem.
export const TERMS_VERSION = '2026-09-09';

// Categorias de tudo o que precisa de atenção. Um pedido contado por uma
// pessoa e um erro apanhado sozinho vivem na mesma fila.
export const CATEGORIAS = ['user', 'client', 'server', 'infra', 'seguranca'];

// O instante de agora, com um nome só para todo o worker.
// Devolve: milissegundos de época (número).
export const now = () => Date.now();

/* A CSP de um anexo servido pelo GET /api/files/:id. É conteúdo de terceiros
   (quem o carregou pode ser um comproprietário ou um colaborador) servido na
   origem da app: com `sandbox` corre numa origem opaca, sem scripts nem
   formulários, mesmo aberto por navegação direta — e o resto é a CSP geral
   apertada (nada de fora, nenhum script). O index.js deixa passar este valor
   exato pelo harden() (PODE_APERTAR), e nenhum outro. */
export const CSP_ANEXO = "default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; " +
  "frame-ancestors 'none'; base-uri 'none'; form-action 'none'; sandbox";

/* A CSP das páginas que o próprio worker escreve: a landing, os documentos
   legais, os docs, o back office e a entrada de teste. É a CSP geral do
   index.js sem os sha256 da app nem o da folha do Google — nenhuma destas
   páginas traz script em linha nem desenha o botão de entrada com Google, por
   isso nenhum dos três aqui é preciso —, e mais nada diferente: nenhuma das
   duas tem 'unsafe-inline', e
   estas páginas não trazem script nem folha escritos no HTML, nem on…= nem
   atributo de estilo. O JavaScript e o CSS vêm de ficheiros da mesma origem,
   servidos pelo worker (paginas-recursos.js). O index.js deixa passar este
   valor exato pelo harden() (PODE_APERTAR): é apertar a geral, não
   afrouxá-la. */
export const CSP_ESTRITA = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' https://accounts.google.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "connect-src 'self' https://accounts.google.com",
  "frame-src https://accounts.google.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// Quantas casas uma lista vinda do cliente pode ter (convites, pedidos,
// colaboradores, partilha numa conexão) — o mesmo tecto do /api/sync.
const MAX_CASAS = 200;

// Uma Response JSON com o charset certo; headers extra somam-se aos nossos.
// Recebe: data — o que vai no corpo (qualquer valor serializável em JSON);
// status (opcional) — o código HTTP, 200 por omissão; headers (opcional) —
// cabeçalhos extra a somar aos nossos.
// Devolve: uma Response JSON com charset utf-8 e esse status.
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

// O erro no formato que a app espera: { error: mensagem }, com o status dado.
// Recebe: status — o código HTTP do erro; message — a mensagem que a app mostra.
// Devolve: uma Response JSON { error: mensagem } com esse status.
export function err(status, message) {
  return json({ error: message }, status);
}

// O corpo do pedido como objeto, ou null quando não é JSON ou passa de
// MAX_BODY — quem chama trata o null como pedido inválido, sem try/catch.
// Recebe: request — o pedido HTTP (Request) cujo corpo se quer ler.
// Devolve: o corpo interpretado como JSON (normalmente um objeto), ou null
// quando não é JSON válido ou passa de MAX_BODY.
export async function body(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return null;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Um registo grande de mais para guardar: o JSON dele passa de MAX_RECORD caracteres.
// Recebe: data — o registo (qualquer valor).
// Devolve: true quando é grande de mais, ou quando nem se deixa passar a JSON.
export const tooBig = (data) => {
  try { return JSON.stringify(data).length > MAX_RECORD; } catch (e) { return true; }
};

// Identificadores: só o que a app gera (uuid, ids curtos, nomes de tipo).
// Sem isto, um id com aspas ou < > escapava para o HTML de quem recebe a
// casa partilhada — era o caminho para roubar a sessão de outro utilizador.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
// Um id que não tem a forma do ID_RE — e que por isso se recusa.
// Recebe: v — o id (qualquer valor; null e undefined contam como vazio).
// Devolve: true quando NÃO tem a forma de um id da app.
export const badId = (v) => !ID_RE.test(String(v == null ? '' : v));

// Lê e valida uma lista de ids de casas vinda do cliente: até MAX_CASAS,
// cada um com a forma de badId, sem repetidos. É a mesma porta para todas as
// listas de casas — sem ela, uma lista de 100 mil ids era 100 mil consultas.
// Recebe: v — o que veio no corpo (devia ser um array de ids); vazia
// (opcional) — true quando a lista vazia é válida (partilhar nenhuma casa).
// Devolve: array de ids únicos (strings), ou null quando não é uma lista válida.
export function idsDeCasas(v, vazia) {
  if (!Array.isArray(v) || v.length > MAX_CASAS || (!v.length && !vazia)) return null;
  const out = [];
  for (const x of v) {
    if (badId(x)) return null;
    if (!out.includes(String(x))) out.push(String(x));
  }
  return out;
}

// O corpo de um registo tem de ser um objeto simples, sem tentativas de
// poluir o protótipo, sem chaves de trabalho (prefixo '_', que são metadados
// do servidor — vindas de fora seriam autoria forjada no sino dos outros),
// e o seu id nunca pode contradizer o id da linha.
// Recebe: data — o corpo do registo (tem de ser um objeto simples, não array);
// id (opcional) — o id da linha, que se impõe a um data.id divergente.
// Devolve: o próprio objeto já limpo, ou null quando não é um objeto simples.
export function cleanData(data, id) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  if (Object.prototype.hasOwnProperty.call(data, '__proto__')) delete data['__proto__'];
  delete data.constructor;
  delete data.prototype;
  for (const k of Object.keys(data)) if (k.startsWith('_')) delete data[k];
  if (id !== undefined && 'id' in data) data.id = id;   // o id manda é o da linha
  return data;
}

// forte: 8+ caracteres com maiúsculas, minúsculas, números e um símbolo
// Recebe: p — a palavra-passe a avaliar (é convertida a string).
// Devolve: true se for fraca (falha algum dos requisitos), false se serve.
export function weakPassword(p) {
  p = String(p);
  return p.length < 8 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p);
}

// O IP de quem pede, como a Cloudflare o diz (CF-Connecting-IP).
// Recebe: request — o pedido (Request).
// Devolve: o IP (texto), ou 'desconhecido' quando o cabeçalho não vem (fora da Cloudflare).
export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'desconhecido';
