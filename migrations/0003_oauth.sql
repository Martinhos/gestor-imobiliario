-- Entrada com Google / Apple: liga a conta ao "sub" do fornecedor.
-- Contas criadas por OAuth ficam com pass_hash/pass_salt vazios.

ALTER TABLE users ADD COLUMN google_sub TEXT;
ALTER TABLE users ADD COLUMN apple_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users (google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple  ON users (apple_sub)  WHERE apple_sub  IS NOT NULL;
