-- Os serviços da app ligados ou desligados por utilizador. Cada separador da
-- barra lateral (menos as Definições, que são a base) é um serviço; o
-- suporte, no back office, pode desligar um serviço a uma conta. Ausência de
-- linha = ligado. Desligar escreve também os serviços que dependem do
-- desligado (worker/src/lib/servicos.js:fechoDesligados), para a lista que o
-- cliente recebe em GET /api/state ser inteira. Nada se apaga: os registos
-- de um serviço desligado ficam na base e voltam a sair quando se liga.

CREATE TABLE IF NOT EXISTS user_services (
  user_id    TEXT NOT NULL,
  service    TEXT NOT NULL,                 -- id do catálogo: 'contracts', 'transactions', …
  enabled    INTEGER NOT NULL DEFAULT 1,    -- 0 = desligado
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',      -- quem mexeu no back office
  PRIMARY KEY (user_id, service)
);
