// Autenticação: hash de palavras-passe (PBKDF2 via WebCrypto) e sessões em KV.

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 dias
const PBKDF2_ITERATIONS = 100000;

const enc = new TextEncoder();

function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

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

export async function verifyPassword(password, saltB64, expectedHashB64) {
  const { hash } = await hashPassword(password, saltB64);
  if (hash.length !== expectedHashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHashB64.charCodeAt(i);
  return diff === 0;
}

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

export async function createSession(env, userId) {
  const token = randomToken();
  await env.SESSIONS.put(`sess:${token}`, JSON.stringify({ userId }), { expirationTtl: SESSION_TTL });
  return token;
}

export async function destroySession(env, token) {
  if (token) await env.SESSIONS.delete(`sess:${token}`);
}

export function sessionCookie(token, expire = false) {
  const maxAge = expire ? 0 : SESSION_TTL;
  return `gi_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function readSessionToken(request) {
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)gi_session=([a-f0-9]+)/);
  return m ? m[1] : null;
}

export async function getSessionUser(env, request) {
  const token = readSessionToken(request);
  if (!token) return null;
  const raw = await env.SESSIONS.get(`sess:${token}`);
  if (!raw) return null;
  const { userId } = JSON.parse(raw);
  const user = await env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(userId).first();
  if (!user) return null;
  return { ...user, token };
}
