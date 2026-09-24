-- Correções da avaliação de 2026-09-14 (servidor: API, dados e segurança).
-- Só se acrescenta: uma tabela, uma coluna com valor por omissão, índices, e
-- a correção do dono de pedidos antigos. Nenhuma tabela com dados é recriada.

-- A reposição da palavra-passe sai do KV para a D1. O KV é eventualmente
-- consistente — a lição da 0010: o token nascia num ponto de presença e era
-- lido noutro (o telemóvel de quem abre o email), e a primeira abertura dava
-- «já foi usada ou expirou», que era falso. Como nos convites (0014), fica só
-- o SHA-256 do token; o consumo é um UPDATE condicional (used_at IS NULL AND
-- expires_at >= agora) que exige uma linha alterada.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets (expires_at);

-- A versão do hash da palavra-passe: 1 = PBKDF2 da palavra-passe; 2 = PBKDF2
-- do HMAC-SHA256(PASS_PEPPER, palavra-passe). Sem o segredo no worker tudo
-- fica a 1, como antes; com ele, as novas nascem a 2 e as antigas refazem-se
-- na entrada seguinte (worker/src/auth.js:conferePalavra).
ALTER TABLE users ADD COLUMN pass_v INTEGER NOT NULL DEFAULT 1;

-- Índices das consultas quentes. Contar quem tem um cargo (a cada /api/state
-- de um dono, e ao apagar um cargo) varria a tabela inteira dos
-- colaboradores; os pedidos de uma pessoa escolhiam o índice da categoria e
-- varriam os pedidos de toda a gente.
CREATE INDEX IF NOT EXISTS idx_collab_role ON collaborators (role_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_cat ON tickets (user_id, category, created_at);

-- Os erros sem pessoa. tickets.user_id é NOT NULL REFERENCES users(id), e um
-- erro do servidor, da infraestrutura ou de um relato anónimo ficava na conta
-- viva mais antiga — que passava a «ter» erros que nunca viu. Em vez de
-- recriar a tabela dos pedidos (a D1 não tira um NOT NULL de outra forma, e
-- é uma tabela com dados), há uma conta do sistema: apagada desde que nasce
-- (não entra, não conta nas contas, não recebe correio) e com o nome que o
-- back office mostra. O worker cria-a quando é precisa
-- (worker/src/lib/relatos.js:CONTA_SISTEMA); aqui só se cria se houver
-- pedidos antigos para lhe devolver. Devolvem-se os que nunca tiveram pessoa:
-- os do servidor e da infraestrutura (nenhum sítio os abre com utilizador) e
-- os relatos do browser que chegaram sem sessão — o rotas/relatos.js marca-os
-- no corpo, e o corpo é o da primeira ocorrência, a que escolheu o dono.
INSERT OR IGNORE INTO users (id, email, name, pass_hash, pass_salt, created_at, deleted_at)
SELECT 'SISTEMA', 'sistema@invalido', 'Sem utilizador', '', '', 0, 1
 WHERE EXISTS (SELECT 1 FROM tickets
                WHERE category IN ('server', 'infra')
                   OR (category = 'client' AND body LIKE '%(sem sessão iniciada)%'));
UPDATE tickets SET user_id = 'SISTEMA'
 WHERE (category IN ('server', 'infra') OR (category = 'client' AND body LIKE '%(sem sessão iniciada)%'))
   AND EXISTS (SELECT 1 FROM users WHERE id = 'SISTEMA');
