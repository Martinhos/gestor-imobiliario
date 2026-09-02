-- O portal de equipa vira back office: ganha poderes de escrita sobre contas
-- e pedidos. Tudo o que escreve passa a deixar rasto — a auditoria vem na
-- mesma migração que os poderes, de propósito: não há um dia em que um
-- existiu sem a outra.

-- Quem fez o quê, sobre quem, e porquê. Só se escreve e lê: não há UPDATE
-- nem DELETE em lado nenhum do código, e é copiada para o R2 com o resto.
CREATE TABLE IF NOT EXISTS audit_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      INTEGER NOT NULL,
  quem    TEXT NOT NULL,                 -- id de Discord de quem agiu
  nome    TEXT NOT NULL DEFAULT '',
  papel   TEXT NOT NULL DEFAULT '',
  acao    TEXT NOT NULL,                 -- conta.plano, pedido.responder, ...
  alvo    TEXT,                          -- id da conta ou do pedido
  detalhe TEXT                           -- o que mudou, e o motivo
);
CREATE INDEX IF NOT EXISTS idx_audit_at   ON audit_log (at);
CREATE INDEX IF NOT EXISTS idx_audit_alvo ON audit_log (alvo, at);

-- O fio de um pedido. Até aqui um pedido tinha UMA resposta (a coluna reply):
-- responder segunda vez apagava a primeira e a pessoa perdia a conversa.
-- A coluna reply fica — a app do utilizador lê-a — mas passa a ser só a
-- última resposta; o fio inteiro vive aqui, com as notas internas que a
-- pessoa nunca vê.
CREATE TABLE IF NOT EXISTS ticket_msgs (
  id        TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  tipo      TEXT NOT NULL,               -- resposta (a pessoa vê) | nota (só a equipa)
  texto     TEXT NOT NULL,
  autor     TEXT NOT NULL,               -- id de Discord
  nome      TEXT NOT NULL DEFAULT '',
  papel     TEXT NOT NULL DEFAULT '',
  at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs ON ticket_msgs (ticket_id, at);

-- Quem está a tratar de um pedido, para dois não responderem ao mesmo sem
-- saberem um do outro.
ALTER TABLE tickets ADD COLUMN assignee TEXT;
ALTER TABLE tickets ADD COLUMN assignee_nome TEXT;

-- Conta suspensa: não entra, nada se apaga. É o estado que faltava entre
-- ativa e apagada — apagar é irreversível e o suporte não tinha travão
-- nenhum para uma conta abusiva ou comprometida.
ALTER TABLE users ADD COLUMN suspended_at INTEGER;

-- Respostas-tipo para as perguntas que se repetem.
CREATE TABLE IF NOT EXISTS reply_templates (
  id     TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto  TEXT NOT NULL,
  autor  TEXT NOT NULL,
  at     INTEGER NOT NULL
);

-- Batimento das operações agendadas e histórico das cópias. Se o cron morrer
-- de todo, nada dava por isso — o único sinal era o resumo diário não
-- aparecer no Discord. Cada execução deixa aqui uma linha, e a ausência de
-- linhas novas é o alarme.
CREATE TABLE IF NOT EXISTS op_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  op      TEXT NOT NULL,                 -- copia | vigia | resumo
  at      INTEGER NOT NULL,
  ok      INTEGER NOT NULL DEFAULT 1,
  detalhe TEXT                           -- JSON com o resultado (linhas, bytes, ms...)
);
CREATE INDEX IF NOT EXISTS idx_op_log ON op_log (op, at);
