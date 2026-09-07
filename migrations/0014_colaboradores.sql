-- Colaboradores com cargos, convites de uso único e a ligação de partilha.
-- Um cargo é uma lista de permissões (JSON) criada por um dono; um
-- colaborador é uma pessoa com um cargo numa lista explícita de casas desse
-- dono. Colaborador nunca é comproprietário: não entra em shares, não conta
-- nas quotas e vê só o que o cargo deixa.
--
-- Os convites e a ligação de partilha guardam SÓ o SHA-256 do token — o token
-- em claro vive apenas no URL devolvido na criação. Uma cópia da base não dá
-- ligações válidas. O consumo do convite é um UPDATE condicional (used_at IS
-- NULL AND revoked_at IS NULL AND expires_at >= agora) que exige uma linha
-- alterada: dois cliques ao mesmo tempo, só um entra.
--
-- records.created_by é o criador e nunca muda (author continua a ser o último
-- a escrever — é o que o sino usa). files.record_kind/record_id dizem a que
-- registo pertence cada anexo, para os cargos saberem se o podem ver.

CREATE TABLE IF NOT EXISTS roles (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  perms      TEXT NOT NULL,                 -- JSON: ["tx.view","tx.add",...]
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_roles_owner ON roles (owner_id);

CREATE TABLE IF NOT EXISTS collaborators (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  role_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (owner_id, user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_collab_user ON collaborators (user_id);

CREATE TABLE IF NOT EXISTS collaborator_houses (
  collaborator_id TEXT NOT NULL,
  house_id        TEXT NOT NULL,
  PRIMARY KEY (collaborator_id, house_id)
);
CREATE INDEX IF NOT EXISTS idx_collab_houses_house ON collaborator_houses (house_id);

CREATE TABLE IF NOT EXISTS collab_invites (
  token_hash TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL,
  role_id    TEXT NOT NULL,
  house_ids  TEXT NOT NULL,                 -- JSON: ["id","id"]
  label      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  used_by    TEXT,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_invites_owner ON collab_invites (owner_id, created_at);

CREATE TABLE IF NOT EXISTS share_links (
  owner_id   TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  uses       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS share_requests (
  id         TEXT PRIMARY KEY,
  from_user  TEXT NOT NULL,                 -- quem abriu a ligação e pede
  to_user    TEXT NOT NULL,                 -- o dono da ligação, que aceita
  house_id   TEXT NOT NULL,                 -- casa de from_user
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  UNIQUE (from_user, to_user, house_id)
);
CREATE INDEX IF NOT EXISTS idx_share_req_to ON share_requests (to_user, status);

ALTER TABLE records ADD COLUMN created_by TEXT;
ALTER TABLE files ADD COLUMN record_kind TEXT;    -- 'contract'|'tx'|'rec'|'visit'|'tenant'|'house.photos'|'house.loans'
ALTER TABLE files ADD COLUMN record_id TEXT;
