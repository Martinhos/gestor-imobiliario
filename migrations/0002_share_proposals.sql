-- Propostas de divisão de percentagens de uma casa partilhada.
-- Uma proposta por casa; entra em vigor quando todos os comproprietários
-- (dono + utilizadores com quem a casa está partilhada) a aprovarem.

CREATE TABLE IF NOT EXISTS share_proposals (
  house_id    TEXT PRIMARY KEY,
  proposed_by TEXT NOT NULL REFERENCES users(id),
  shares      TEXT NOT NULL,   -- JSON { userId: percentagem }
  approvals   TEXT NOT NULL,   -- JSON [ userId, ... ]
  created_at  INTEGER NOT NULL
);
