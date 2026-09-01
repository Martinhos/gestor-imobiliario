-- Anexos no R2: a tabela guarda quem carregou e a que casa pertence, que é
-- o que decide quem os pode ver. O conteúdo vive no bucket, com o id à chave.
CREATE TABLE IF NOT EXISTS files (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL REFERENCES users(id),
  house_id   TEXT,                       -- nulo enquanto não for guardado numa casa
  name       TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL DEFAULT '',
  size       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_house ON files (house_id);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files (owner_id);

-- Tudo o que precisa de atenção passa a ser um pedido, com categoria:
--   user      · contado por uma pessoa (problema ou sugestão)
--   client    · erro apanhado no browser
--   server    · erro apanhado no worker
--   infra     · limites e infraestrutura (quotas, cron, deploys)
--   seguranca · tentativas de abuso e eventos de segurança
ALTER TABLE tickets ADD COLUMN category TEXT NOT NULL DEFAULT 'user';
ALTER TABLE tickets ADD COLUMN fingerprint TEXT;   -- agrupa erros repetidos
ALTER TABLE tickets ADD COLUMN n INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_tickets_cat ON tickets (category, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_fp ON tickets (fingerprint) WHERE fingerprint IS NOT NULL;

-- Erros já registados passam a pedidos, para não se perder o histórico.
INSERT OR IGNORE INTO tickets (id, user_id, kind, subject, body, status, category, fingerprint, n, created_at, updated_at)
SELECT r.id,
       COALESCE(r.user_id, (SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1)),
       'problema',
       SUBSTR(r.message, 1, 140),
       COALESCE(r.detail, ''),
       'criado',
       CASE WHEN r.kind = 'servidor' THEN 'server' ELSE 'client' END,
       r.fingerprint, r.n, r.created_at, r.updated_at
  FROM reports r
 WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)
    OR EXISTS (SELECT 1 FROM users WHERE deleted_at IS NULL);

DROP TABLE IF EXISTS reports;
