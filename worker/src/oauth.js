// Verificação de ID tokens (JWT RS256) do Google e da Apple, sem dependências:
// vai buscar as chaves públicas (JWKS) do fornecedor, valida a assinatura com
// WebCrypto e confere emissor, audiência e validade.

const JWKS_URL = {
  google: 'https://www.googleapis.com/oauth2/v3/certs',
  apple: 'https://appleid.apple.com/auth/keys',
};
const ISSUERS = {
  google: ['https://accounts.google.com', 'accounts.google.com'],
  apple: ['https://appleid.apple.com'],
};

let jwksCache = {};

// base64url → bytes: repõe o padding e os carateres +/ do base64 clássico antes do atob.
function b64uToBytes(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

// descodifica um segmento base64url do JWT (cabeçalho ou payload) para objeto
function b64uToJSON(s) {
  return JSON.parse(new TextDecoder().decode(b64uToBytes(s)));
}

// A chave pública do fornecedor com aquele kid. Cache de uma hora, renovada também
// quando o kid não aparece — é assim que uma rotação de chaves passa sem se dar por ela.
async function getKey(provider, kid) {
  let entry = jwksCache[provider];
  if (!entry || Date.now() - entry.at > 3600e3 || !entry.keys.some((k) => k.kid === kid)) {
    const res = await fetch(JWKS_URL[provider]);
    if (!res.ok) throw new Error('não foi possível obter as chaves do fornecedor');
    entry = { at: Date.now(), keys: (await res.json()).keys || [] };
    jwksCache[provider] = entry;
  }
  return entry.keys.find((k) => k.kid === kid) || null;
}

/* Valida um ID token de ponta a ponta: assinatura RS256 contra as chaves públicas do
   fornecedor ('google' ou 'apple'), emissor, audiência (o client id da app), validade
   e email confirmado. Devolve o payload quando tudo bate certo; qualquer falha lança
   Error com a razão — quem chama decide o que mostrar. Vai à rede buscar as chaves
   quando a cache não chega. */
export async function verifyIdToken(provider, token, audience) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('token malformado');
  const header = b64uToJSON(parts[0]);
  const payload = b64uToJSON(parts[1]);
  if (header.alg !== 'RS256') throw new Error('algoritmo inesperado');

  const jwk = await getKey(provider, header.kid);
  if (!jwk) throw new Error('chave desconhecida');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64uToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );
  if (!ok) throw new Error('assinatura inválida');

  if (!ISSUERS[provider].includes(payload.iss)) throw new Error('emissor inválido');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audience || !aud.includes(audience)) throw new Error('audiência inválida');
  // a expiração é obrigatória: um token sem exp seria eterno
  if (!payload.exp || payload.exp * 1000 < Date.now() - 60e3) throw new Error('token expirado');
  if (payload.iat && payload.iat * 1000 > Date.now() + 300e3) throw new Error('token do futuro');
  // sem email confirmado, qualquer pessoa poderia reclamar o email de outra
  if (payload.email && payload.email_verified !== true) throw new Error('email não confirmado no fornecedor');
  return payload;
}
