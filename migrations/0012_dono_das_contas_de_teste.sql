-- Cada conta de teste sabe que dev a criou: e o que permite ao seletor do
-- ambiente de dev mostrar a cada um so as suas, e ao /test lavar so as de
-- quem pediu. NULL para toda a gente normal - a coluna nao muda nada fora
-- do ambiente de teste.
ALTER TABLE users ADD COLUMN test_owner TEXT;
CREATE INDEX IF NOT EXISTS idx_users_test_owner ON users (test_owner) WHERE test_owner IS NOT NULL;
