// Autenticação: hash de palavras-passe (PBKDF2 via WebCrypto, com pimenta
// opcional) e sessões em KV.

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 dias

/* 100 mil iterações é o máximo que o PBKDF2 dos Workers aceita (o valor que
   a documentação da Cloudflare dá para o Web Crypto): acima disso o workerd
   recusa com «Pbkdf2 failed: iteration counts above <máximo> are not
   supported» — src/workerd/api/crypto/pbkdf2.c++ no repositório do workerd;
   a mesma frase, com o máximo como variável, está no binário local
   node_modules/@cloudflare/workerd-windows-64/bin/workerd.exe (1.20260828.1).
   A OWASP pede 600 mil para PBKDF2-HMAC-SHA256; o custo que falta compensa-se
   com a pimenta — com PASS_PEPPER, uma cópia da base (vai para o R2 todos os
   dias) não dá hashes que se ataquem offline sem o segredo do worker. */
const PBKDF2_ITERATIONS = 100000;

const enc = new TextEncoder();

// Bytes (ArrayBuffer ou typed array) para base64, para guardar hash e salt como texto.
// Recebe: buf — os bytes a converter (ArrayBuffer ou typed array).
// Devolve: esses bytes como string em base64.
function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// Inverso de toB64: base64 para Uint8Array.
// Recebe: b64 — string em base64.
// Devolve: os bytes descodificados, num Uint8Array.
function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// O que entra no PBKDF2: a palavra-passe em bytes, ou — com pimenta — o
// HMAC-SHA256(pimenta, palavra-passe), que só quem tem o segredo calcula.
// Recebe: password — a palavra-passe em claro; pimenta (opcional) — o
// segredo PASS_PEPPER.
// Devolve: promessa dos bytes a derivar (Uint8Array).
async function materialDaPalavra(password, pimenta) {
  if (!pimenta) return enc.encode(password);
  const k = await crypto.subtle.importKey('raw', enc.encode(pimenta), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(password)));
}

/* Deriva o hash PBKDF2-SHA256 (PBKDF2_ITERATIONS iterações) da palavra-passe.
   Sem saltB64 gera um salt novo (registo); com ele reusa-o (verificação). Com
   pimenta, o que entra no PBKDF2 é o HMAC da palavra-passe — é a versão 2
   (users.pass_v); sem ela, a versão 1, a de sempre.
   Recebe: password — a palavra-passe em claro; saltB64 (opcional) — o salt
   guardado, em base64, para reusar na verificação; pimenta (opcional) — o
   segredo PASS_PEPPER.
   Devolve: { hash, salt } ambos em base64, prontos a guardar. */
export async function hashPassword(password, saltB64, pimenta) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', await materialDaPalavra(password, pimenta), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return { hash: toB64(bits), salt: toB64(salt) };
}

// Confere a palavra-passe contra o hash guardado, comparando em tempo
// constante para não se poder medir por tempos onde a comparação falhou.
// Recebe: password — a palavra-passe em claro a testar; saltB64 — o salt
// guardado, em base64; expectedHashB64 — o hash guardado, em base64;
// pimenta (opcional) — o segredo PASS_PEPPER, para um hash da versão 2.
// Devolve: promessa de booleano — true se a palavra-passe corresponder.
export async function verifyPassword(password, saltB64, expectedHashB64, pimenta) {
  const esperado = String(expectedHashB64 || '');
  const { hash } = await hashPassword(password, saltB64, pimenta);
  if (hash.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}

// A palavra-passe nova como fica guardada: com PASS_PEPPER no worker vai com
// pimenta (pass_v 2); sem ele, como sempre (pass_v 1).
// Recebe: env — o ambiente do worker (PASS_PEPPER, opcional); password — a
// palavra-passe em claro.
// Devolve: promessa de { hash, salt, v } para pass_hash, pass_salt e pass_v.
export async function palavraNova(env, password) {
  const pimenta = String((env && env.PASS_PEPPER) || '');
  const { hash, salt } = await hashPassword(password, undefined, pimenta);
  return { hash, salt, v: pimenta ? 2 : 1 };
}

/* Confere a palavra-passe de uma conta: pela versão que a linha diz e, com a
   pimenta configurada, pela outra a seguir. Quem grava uma palavra-passe sem
   saber do pass_v (a ação do back office, as contas de teste) deixa um hash
   da versão 1 numa linha que pode dizer 2 — e essa pessoa não pode ficar à
   porta. Com pimenta, uma palavra-passe errada custa sempre dois PBKDF2, em
   qualquer conta; gastarComoUmaConta faz o mesmo quando o email não existe,
   para o tempo não dizer que contas há. Sem pimenta tenta-se só a versão 1:
   uma linha com um hash da versão 2 não entra até o segredo voltar.
   Recebe: env — o ambiente do worker (PASS_PEPPER, opcional); password — a
   palavra-passe em claro; user — a linha de users (pass_hash, pass_salt, pass_v).
   Devolve: promessa de { ok, refazer } — refazer diz que a linha deve ser
   regravada com palavraNova (fica na versão 2, com a pimenta). */
export async function conferePalavra(env, password, user) {
  const pimenta = String((env && env.PASS_PEPPER) || '');
  if (!user || !user.pass_hash) return { ok: false, refazer: false };
  const v2 = Number(user.pass_v) === 2;
  const provas = !pimenta ? [''] : v2 ? [pimenta, ''] : ['', pimenta];
  for (const p of provas) {
    if (await verifyPassword(password, user.pass_salt, user.pass_hash, p)) {
      return { ok: true, refazer: !!pimenta && !(v2 && p === pimenta) };
    }
  }
  return { ok: false, refazer: false };
}

// O custo de uma palavra-passe errada, para quando o email não existe: sem
// isto, a diferença no tempo de resposta dizia que emails têm conta.
// Recebe: env — o ambiente do worker (PASS_PEPPER, opcional); password — o
// que veio no pedido.
// Devolve: promessa de nada — só gasta o tempo.
export async function gastarComoUmaConta(env, password) {
  const pimenta = String((env && env.PASS_PEPPER) || '');
  await hashPassword(password);
  if (pimenta) await hashPassword(password, undefined, pimenta);
}

/* O token da sessão no corpo de uma resposta: só fora de produção
   (env.ENV_NAME) e só a quem o pede com X-Rendorium-Token: 1 — os fluxos de
   teste que vivem do Bearer. Em produção fica só o cookie HttpOnly: um token
   no corpo acabava no localStorage, onde qualquer script o lê, e o HttpOnly
   deixava de proteger alguma coisa. O Bearer continua a ser aceite
   (tokensDoPedido: o Bearer e, se já não servir, o cookie), para os
   clientes antigos.
   Recebe: env — o ambiente do worker; request — o pedido; token — o token da sessão.
   Devolve: { token } ou {} — para espalhar no JSON da resposta. */
export function tokenNoCorpo(env, request, token) {
  const pede = !!request && request.headers.get('X-Rendorium-Token') === '1';
  return env && env.ENV_NAME && pede ? { token } : {};
}

// O SHA-256 de um texto, em hexadecimal — o que fica na base em vez de um
// token (convites, ligação de partilha, reposição da palavra-passe).
// Recebe: s — o texto (o token em claro).
// Devolve: promessa da string hexadecimal (64 caracteres).
export async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', enc.encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Token aleatório em hexadecimal (32 bytes por omissão → 64 caracteres, o formato que TOKEN_RE exige).
// Serve às sessões e também aos convites e à ligação de partilha (colaboradores.js).
// Recebe: bytes (opcional) — quantos bytes aleatórios gerar; 32 por omissão.
// Devolve: string hexadecimal com o dobro dos caracteres (64 por omissão).
export function randomToken(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Id curto e legível para partilhar com outros utilizadores (sem 0/O/1/I).
// Devolve: string de 8 caracteres, maiúsculas e dígitos desse alfabeto.
export function newUserId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = crypto.getRandomValues(new Uint8Array(8));
  return [...buf].map((b) => alphabet[b % alphabet.length]).join('');
}

// Cria uma sessão em KV (expira ao fim de 30 dias) e devolve o token. O epoch
// gravado é o que permite revogar todas as sessões do utilizador de uma vez.
// Recebe: env — as bindings do worker (KV SESSIONS); userId — o id do dono da
// sessão; epoch (opcional) — o sess_epoch atual do utilizador (0 por omissão).
// Devolve: promessa do token da sessão — string de 64 caracteres hexadecimais.
export async function createSession(env, userId, epoch = 0) {
  const token = randomToken();
  await env.SESSIONS.put(`sess:${token}`, JSON.stringify({ userId, epoch }), { expirationTtl: SESSION_TTL });
  return token;
}

// Apaga a sessão do KV (logout). Tolera token vazio ou já expirado.
// Recebe: env — as bindings do worker (KV SESSIONS); token — o token da
// sessão a apagar (pode vir vazio ou null).
// Devolve: nada útil — a promessa resolve quando a sessão sai do KV.
export async function destroySession(env, token) {
  if (token) await env.SESSIONS.delete(`sess:${token}`);
}

// Valor do Set-Cookie da sessão (HttpOnly, Secure, SameSite=Lax); com
// expire=true devolve a variante que apaga o cookie, para o logout.
// Recebe: token — o token da sessão a pôr no cookie; expire (opcional) —
// true para a variante que apaga o cookie (Max-Age=0).
// Devolve: o valor do cabeçalho Set-Cookie, como string.
export function sessionCookie(token, expire = false) {
  const maxAge = expire ? 0 : SESSION_TTL;
  return `gi_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

const TOKEN_RE = /^[a-f0-9]{64}$/;

// Extrai o token do pedido: primeiro o cabeçalho Bearer, senão o cookie
// gi_session. Só aceita 64 hexadecimais; tudo o resto devolve null.
// Recebe: request — o Request recebido, de onde se leem os cabeçalhos.
// Devolve: o token (string de 64 hexadecimais) ou null.
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

// Os tokens que o pedido traz, pela ordem em que se tentam: o do Bearer e
// o do cookie gi_session (sem repetir), cada um com o formato certo. Sair
// fecha-os todos (rotas/auth.js), para não ficar viva no KV a sessão do
// cookie de um aparelho que ainda manda um Bearer antigo.
// Recebe: request — o Request recebido.
// Devolve: array de tokens (0, 1 ou 2).
export function tokensDoPedido(request) {
  const out = [];
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (TOKEN_RE.test(t)) out.push(t);
  }
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)gi_session=([a-f0-9]{64})/);
  if (m && !out.includes(m[1])) out.push(m[1]);
  return out;
}

/* Resolve o pedido num utilizador autenticado: token → sessão em KV → linha
   em users na D1. Tenta o Bearer e, se esse já não servir, o cookie: um
   aparelho com a versão anterior guarda o token no localStorage e manda-o
   em Bearer, e esse token cai quando a pessoa muda a palavra-passe ou sai
   dos outros aparelhos — a resposta já não traz o novo no corpo
   (tokenNoCorpo), mas o cookie novo chega, e é com ele que continua dentro.
   Recebe: env — as bindings do worker (KV SESSIONS e D1 DB); request — o
   Request recebido, de onde sai o token.
   Devolve: null se nenhum token levar a uma sessão válida (falta um elo, a
   conta está apagada ou suspensa, ou o sess_epoch já rodou — sessões
   revogadas); caso contrário devolve o utilizador (id, email, name,
   sess_epoch, terms_version) com o token que serviu anexado. */
export async function getSessionUser(env, request) {
  for (const token of tokensDoPedido(request)) {
    const u = await sessaoDe(env, token);
    if (u) return u;
  }
  return null;
}

// Um token → a sessão em KV → a linha em users.
// Recebe: env — as bindings do worker; token — um token com o formato certo.
// Devolve: promessa do utilizador com o token anexado, ou null.
async function sessaoDe(env, token) {
  const raw = await env.SESSIONS.get(`sess:${token}`);
  if (!raw) return null;
  // uma entrada estragada no KV é uma sessão inválida, não um 500
  let sessao = null;
  try { sessao = JSON.parse(raw); } catch (e) { return null; }
  const { userId, epoch } = sessao || {};
  if (!userId) return null;
  // contas apagadas ou suspensas deixam de ter sessão válida, mesmo com o
  // token na mão (suspender também sobe o sess_epoch, mas isto é a rede)
  const user = await env.DB.prepare(
    'SELECT id, email, name, sess_epoch, terms_version FROM users WHERE id = ? AND deleted_at IS NULL AND suspended_at IS NULL'
  )
    .bind(userId)
    .first();
  if (!user) return null;
  // sessões de antes da última revogação deixam de valer
  if ((user.sess_epoch || 0) !== (epoch || 0)) return null;
  return { ...user, token };
}
