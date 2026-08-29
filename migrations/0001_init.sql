-- Esquema inicial: utilizadores, conexões entre utilizadores, partilha de casas
-- e armazenamento dos dados da app (casas + registos por casa + dados globais
-- do utilizador). Os dados de domínio guardam-se como JSON por registo — o
-- worker valida a propriedade/partilha e o cliente mantém a lógica de negócio.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,             -- id curto, partilhável com outros utilizadores
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL DEFAULT '',
  pass_hash  TEXT NOT NULL,                -- PBKDF2-SHA256, base64
  pass_salt  TEXT NOT NULL,                -- base64
  created_at INTEGER NOT NULL
);

-- Conexão entre dois utilizadores. Criada quando um utilizador adiciona o id
-- do outro; fica 'pending' até o outro aceitar.
CREATE TABLE IF NOT EXISTS connections (
  id           TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id),
  target_id    TEXT NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted
  created_at   INTEGER NOT NULL,
  UNIQUE (requester_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections (target_id);

-- Casas que cada utilizador escolheu partilhar numa conexão concreta.
CREATE TABLE IF NOT EXISTS shares (
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  owner_id      TEXT NOT NULL REFERENCES users(id),
  house_id      TEXT NOT NULL,
  PRIMARY KEY (connection_id, house_id)
);
CREATE INDEX IF NOT EXISTS idx_shares_house ON shares (house_id);

CREATE TABLE IF NOT EXISTS houses (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL REFERENCES users(id),
  data       TEXT NOT NULL,                -- JSON da casa (nome, morada, ...)
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_houses_owner ON houses (owner_id);

-- Registos ligados a uma casa (inquilinos, contratos, movimentos, despesas...).
CREATE TABLE IF NOT EXISTS records (
  house_id   TEXT NOT NULL,
  kind       TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,                -- JSON do registo
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (house_id, kind, id)
);

-- Dados do utilizador não ligados a nenhuma casa (definições, categorias...).
CREATE TABLE IF NOT EXISTS user_records (
  user_id    TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, id)
);
