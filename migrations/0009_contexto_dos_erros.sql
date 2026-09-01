-- Contexto dos erros, para se poder decidir o que corrigir primeiro.
--
-- Até agora um erro repetido só somava no contador `n`. Duzentas ocorrências
-- da mesma pessoa e duzentas de duzentas pessoas contavam igual — e são
-- problemas de gravidade muito diferente.

-- Quem apanhou cada erro. Uma linha por pessoa e por assinatura: o índice
-- único faz com que a mesma pessoa a repetir o mesmo erro não conte duas
-- vezes, e é o que permite responder a "quantas pessoas?".
CREATE TABLE IF NOT EXISTS ticket_users (
  fingerprint TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  first_at    INTEGER NOT NULL,
  PRIMARY KEY (fingerprint, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_users_fp ON ticket_users (fingerprint);

-- Em que versão da app aconteceu. Sem isto, um relato de quem ainda não
-- atualizou parece um bug da versão em vigor.
ALTER TABLE tickets ADD COLUMN versao TEXT;
