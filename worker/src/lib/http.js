// Peças de HTTP partilhadas por todas as rotas: respostas, leitura do corpo,
// validação de identificadores e os limites de tamanho.

export const MAX_BODY = 2 * 1024 * 1024;   // 2 MB por pedido
export const MAX_RECORD = 256 * 1024;      // 256 KB por registo guardado

// Versão dos termos e da política em vigor. Mudá-la faz a app pedir de novo
// a aceitação a toda a gente, na próxima vez que abrirem.
export const TERMS_VERSION = '2026-09-04';

// Categorias de tudo o que precisa de atenção. Um pedido contado por uma
// pessoa e um erro apanhado sozinho vivem na mesma fila.
export const CATEGORIAS = ['user', 'client', 'server', 'infra', 'seguranca'];

export const now = () => Date.now();

// Uma Response JSON com o charset certo; headers extra somam-se aos nossos.
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

// O erro no formato que a app espera: { error: mensagem }, com o status dado.
export function err(status, message) {
  return json({ error: message }, status);
}

// O corpo do pedido como objeto, ou null quando não é JSON ou passa de
// MAX_BODY — quem chama trata o null como pedido inválido, sem try/catch.
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

export const tooBig = (data) => {
  try { return JSON.stringify(data).length > MAX_RECORD; } catch (e) { return true; }
};

// Identificadores: só o que a app gera (uuid, ids curtos, nomes de tipo).
// Sem isto, um id com aspas ou < > escapava para o HTML de quem recebe a
// casa partilhada — era o caminho para roubar a sessão de outro utilizador.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const badId = (v) => !ID_RE.test(String(v == null ? '' : v));

// O corpo de um registo tem de ser um objeto simples, sem tentativas de
// poluir o protótipo, e o seu id nunca pode contradizer o id da linha.
export function cleanData(data, id) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  if (Object.prototype.hasOwnProperty.call(data, '__proto__')) delete data['__proto__'];
  delete data.constructor;
  delete data.prototype;
  if (id !== undefined && 'id' in data) data.id = id;   // o id manda é o da linha
  return data;
}

// forte: 8+ caracteres com maiúsculas, minúsculas, números e um símbolo
export function weakPassword(p) {
  p = String(p);
  return p.length < 8 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p);
}

export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'desconhecido';
