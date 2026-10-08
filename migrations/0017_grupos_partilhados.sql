-- Grupos partilhados de imóveis.
-- Um grupo partilhado é um conjunto de casas com membros. Quem está no grupo
-- é comproprietário (participante) de todas as casas do grupo, com tudo o que
-- isso já significa para uma casa partilhada por ligação: vê e edita
-- contratos, movimentos e pessoas, entra nas quotas e nas propostas. A regra
-- vive em worker/src/lib/acesso.js («membro de um grupo vivo que contém a
-- casa, e não é o dono dela ⇒ comproprietário»); as rotas em
-- worker/src/rotas/grupos.js.
--
-- Cada membro põe no grupo casas SUAS (added_by é quem a pôs, que é o dono
-- dela); o dono do grupo tira qualquer casa, e o dono de uma casa tira a sua.
-- Sair do grupo, ou ser removido, leva as casas que essa pessoa pôs. O dono
-- do grupo tem linha em shared_group_members como os outros e não sai: apaga
-- o grupo (deleted = 1), e com ele saem os membros, as casas e a ligação — as
-- casas em si ficam de quem são.
--
-- A ligação de convite é multi-uso, com prazo de 7 dias; por ela pede-se para
-- entrar, e o dono aceita ou recusa cada pedido (migração 0018,
-- shared_group_requests) — uma ligação enviada à pessoa errada não dá acesso
-- a nada. O dono vê quem entrou e pode remover, rodar ou desativar. Como nos convites e na ligação de
-- partilha (0014), guarda-se SÓ o SHA-256 do token: o token em claro vive
-- apenas no URL devolvido na criação, e uma cópia da base não dá ligações
-- válidas.

CREATE TABLE IF NOT EXISTS shared_groups (
  id         TEXT PRIMARY KEY,                -- uuid, vem do cliente como o das casas
  owner_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_shared_groups_owner ON shared_groups (owner_id);

CREATE TABLE IF NOT EXISTS shared_group_members (
  group_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  joined_at  INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_group_members_user ON shared_group_members (user_id);

CREATE TABLE IF NOT EXISTS shared_group_houses (
  group_id   TEXT NOT NULL,
  house_id   TEXT NOT NULL,
  added_by   TEXT NOT NULL,                   -- o membro que a pôs (o dono da casa)
  added_at   INTEGER NOT NULL,
  PRIMARY KEY (group_id, house_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_group_houses_house ON shared_group_houses (house_id);

CREATE TABLE IF NOT EXISTS shared_group_links (
  group_id   TEXT PRIMARY KEY,                -- uma ligação por grupo; rodar substitui-a
  token_hash TEXT NOT NULL UNIQUE,            -- só o SHA-256 do token
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  uses       INTEGER NOT NULL DEFAULT 0
);
