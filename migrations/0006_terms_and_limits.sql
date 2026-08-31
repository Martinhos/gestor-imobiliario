-- Aceitação dos termos (guardada por versão, para se poder pedir de novo
-- quando mudarem) e plano de subscrição da conta.
ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN terms_at INTEGER;
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';

-- Contadores de limite de utilização. Estavam em KV, que no plano gratuito
-- só permite mil escritas por dia — cada gravação de dados gastava uma.
-- Aqui cabem cem vezes mais.
CREATE TABLE IF NOT EXISTS rate_limits (
  k          TEXT PRIMARY KEY,
  n          INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_expires ON rate_limits (expires_at);
