-- Tickets de QA do ambiente de desenvolvimento (a decisão do Martinho,
-- 2026-10-28): quem testa a app no dev escreve o que viu no próprio ecrã
-- (web/cloud/qa.js), e o Claude lê-os mais tarde com scripts/qa.mjs quando
-- lhe pedem «resolve os tickets de QA». Vivem à parte dos pedidos de ajuda
-- (tickets): não são suporte, não vão ao Discord e em produção não existem —
-- as rotas (worker/src/rotas/qa.js) respondem 404 sem env.ENV_NAME, por isso
-- a tabela fica vazia na base de produção.
--
-- Todas as contas do dev veem e mexem em todos os tickets; user_id é só quem
-- o escreveu, e de propósito sem REFERENCES users: os tickets sobrevivem à
-- conta (uma conta apagada fica anónima) e à limpeza do dev
-- (.github/workflows/limpar-dev.yml apaga os users e deixa os qa_tickets),
-- e a app mostra «Conta apagada» no lugar do autor. Numa conta de teste o
-- autor é a conta do Discord que pediu a ligação do /test: discord_id e
-- discord_nome guardam-se ao criar, porque o /test limpar apaga as contas de
-- teste e o ticket tem de continuar a dizer quem o escreveu. severity é bloqueia | incomoda | detalhe, ou NULL sem
-- gravidade. context é o JSON do ecrã de onde veio (separador, ficha, versão,
-- janela, tema, rasto…), com teto de 16 KB. image_key é a chave da captura
-- de ecrã no R2 (qa/<id>), NULL sem imagem.
--
-- Resolvido não desaparece: status passa a 'resolvido' com a resolution e o
-- resolved_at, e reabrir volta a 'aberto' guardando a resolution (o próximo
-- a pegar no ticket vê o que já se tentou). Remover é brando — removed_at,
-- para o Anular da app — e uma linha removida há mais de 24 h apaga-se de
-- vez, com a imagem, de passagem pelas rotas.

CREATE TABLE IF NOT EXISTS qa_tickets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  discord_id  TEXT,                           -- numa conta de teste: o dev que pediu o /test (users.test_owner)
  discord_nome TEXT,                          -- e o nome dele no Discord, guardado ao criar
  body        TEXT NOT NULL,
  severity    TEXT,                           -- bloqueia | incomoda | detalhe | NULL
  context     TEXT,                           -- JSON, até 16 KB
  image_key   TEXT,                           -- qa/<id> no R2, NULL sem imagem
  status      TEXT NOT NULL DEFAULT 'aberto', -- aberto | resolvido
  resolution  TEXT,
  resolved_at INTEGER,
  removed_at  INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qa_tickets_lista ON qa_tickets (removed_at, status, created_at);
