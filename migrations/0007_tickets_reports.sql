-- Pedidos de ajuda e sugestões dos utilizadores, e relatórios automáticos de
-- erros. Ambos alimentam o canal de dev no Discord.

CREATE TABLE IF NOT EXISTS tickets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,                        -- problema | sugestao
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'criado',       -- criado | resolucao | concluido
  reply      TEXT,                                 -- resposta visível ao utilizador
  context    TEXT,                                 -- página, versão, aparelho
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  kind       TEXT NOT NULL,                        -- cliente | servidor
  message    TEXT NOT NULL,
  detail     TEXT,
  fingerprint TEXT,                                -- para agrupar repetições
  n          INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_fp ON reports (fingerprint);
CREATE INDEX IF NOT EXISTS idx_reports_when ON reports (created_at);
