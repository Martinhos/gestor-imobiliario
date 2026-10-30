-- A confirmação do email (o ticket de QA dec6f37e, com a decisão do
-- Martinho de 2026-10-29: «Entra durante 7 dias»). Uma conta nova com
-- palavra-passe recebe um email com uma ligação; funciona 7 dias sem a
-- abrir, com uma faixa a lembrar, e passados os 7 dias só lhe resta o ecrã
-- «Confirma o teu email» (worker/src/api.js:portaoDoEmail). O servidor é
-- worker/src/rotas/auth.js (confirmar, pedirConfirmacao) e
-- worker/src/rotas/conta.js (reenviar, o /api/me).
--
-- users.email_verified_at: ms de época em que o email ficou confirmado;
-- NULL é por confirmar. As contas que já existem contam como confirmadas
-- (com a data em que nasceram): nenhuma é apanhada de surpresa por um ecrã
-- que não pediu. As da Google nascem confirmadas (o fornecedor confirmou-o).
--
-- email_verifications: como password_resets (0016), só o SHA-256 do token,
-- na D1 e não no KV — o KV é eventualmente consistente, e a primeira
-- abertura noutro aparelho dava «já foi usada» (a lição da 0010). Leva o
-- email para que foi enviada: uma ligação de um endereço que já não é o da
-- conta não confirma o novo. Uso único com um UPDATE condicional
-- (used_at IS NULL AND expires_at >= agora) que tem de mudar uma linha.

ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications (user_id);
