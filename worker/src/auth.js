// Autenticação: hash de palavras-passe (PBKDF2 via WebCrypto) e sessões em KV.

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 dias
const PBKDF2_ITERATIONS = 100000;

const enc = new TextEncoder();

// Bytes (ArrayBuffer ou typed array) para base64, para guardar hash e salt como texto.
function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// Inverso de toB64: base64 para Uint8Array.
function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/* Deriva o hash PBKDF2-SHA256 (100 mil iterações) da palavra-passe. Sem
   saltB64 gera um salt novo (registo); com ele reusa-o (verificação).
   Devolve { hash, salt } ambos em base64, prontos a guardar. */
export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return { hash: toB64(bits), salt: toB64(salt.buffer ? salt : salt) };
}

// Confere a palavra-passe contra o hash guardado, comparando em tempo
// constante para não se poder medir por tempos onde a comparação falhou.
export async function verifyPassword(password, saltB64, expectedHashB64) {
  const { hash } = await hashPassword(password, saltB64);
  if (hash.length !== expectedHashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHashB64.charCodeAt(i);
  return diff === 0;
}

// Token aleatório em hexadecimal (32 bytes por omissão → 64 caracteres, o formato que TOKEN_RE exige).
function randomToken(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Id curto e legível para partilhar com outros utilizadores (sem 0/O/1/I).
export function newUserId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = crypto.getRandomValues(new Uint8Array(8));
  return [...buf].map((b) => alphabet[b % alphabet.length]).join('');
}

// Cria uma sessão em KV (expira ao fim de 30 dias) e devolve o token. O epoch
// gravado é o que permite revogar todas as sessões do utilizador de uma vez.
export async function createSession(env, userId, epoch = 0) {
  const token = randomToken();
  await env.SESSIONS.put(`sess:${token}`, JSON.stringify({ userId, epoch }), { expirationTtl: SESSION_TTL });
  return token;
}

// Apaga a sessão do KV (logout). Tolera token vazio ou já expirado.
export async function destroySession(env, token) {
  if (token) await env.SESSIONS.delete(`sess:${token}`);
}

// Valor do Set-Cookie da sessão (HttpOnly, Secure, SameSite=Lax); com
// expire=true devolve a variante que apaga o cookie, para o logout.
export function sessionCookie(token, expire = false) {
  const maxAge = expire ? 0 : SESSION_TTL;
  return `gi_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

const TOKEN_RE = /^[a-f0-9]{64}$/;

// Extrai o token do pedido: primeiro o cabeçalho Bearer, senão o cookie
// gi_session. Só aceita 64 hexadecimais; tudo o resto devolve null.
export function readSessionToken(request) {
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    return TOKEN_RE.test(t) ? t : null;   // nada de chaves KV arbitrárias
  }
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)gi_session=([a-f0-9]{64})/);
  return m ? m[1] : null;
}

/* Resolve o pedido num utilizador autenticado: token → sessão em KV → linha
   em users na D1. Devolve null se faltar qualquer elo, se a conta estiver
   apagada ou suspensa, ou se o sess_epoch já rodou (sessões revogadas);
   caso contrário devolve o utilizador com o token anexado. */
export async function getSessionUser(env, request) {
  const token = readSessionToken(request);
  if (!token) return null;
  const raw = await env.SESSIONS.get(`sess:${token}`);
  if (!raw) return null;
  const { userId, epoch } = JSON.parse(raw);
  // contas apagadas ou suspensas deixam de ter sessão válida, mesmo com o
  // token na mão (suspender também sobe o sess_epoch, mas isto é a rede)
  const user = await env.DB.prepare(
    'SELECT id, email, name, sess_epoch, plan, terms_version FROM users WHERE id = ? AND deleted_at IS NULL AND suspended_at IS NULL'
  )
    .bind(userId)
    .first();
  if (!user) return null;
  // sessões de antes da última revogação deixam de valer
  if ((user.sess_epoch || 0) !== (epoch || 0)) return null;
  return { ...user, token };
}
