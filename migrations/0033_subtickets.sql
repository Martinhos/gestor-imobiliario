-- Os subtickets do kanban da equipa (KAN-162, as decisões do Martinho,
-- 2026-11-25): «Um ticket do kanban que tenha várias coisas para testar deve
-- abrir vários subtickets. Devem ficar com o número do ticket pai com "-X" no
-- final.» Um subticket é uma coisa diferente a testar, com os seus passos: um
-- cartão próprio, do tipo Subtarefa, debaixo do pai (pai_id), com a chave
-- KAN-N-X, que se aceita ou comenta à parte; o pai segue os subtickets
-- (worker/src/lib/kanban.js:passosDoPaiSegue). Quem os cria é o
-- scripts/kanban.mjs (resolver com --teste repetido, e partir).
--
-- O modelo:
-- - sub guarda o X (1, 2, 3… por pai, sem se repetir: um subticket removido
--   guarda o seu); NULL num cartão de sempre. É por esta coluna que se sabe
--   que um cartão é um subticket.
-- - o numero (NOT NULL UNIQUE desde a 0028) de um subticket é o do pai e o X
--   num inteiro negativo, -(N × 1000 + X) (lib/kanban.js:numeroDoSubticket):
--   nunca bate numa chave KAN-N (positiva), não sobe o contador (que vai pelo
--   MAX(numero)), e o chaveDe e o numeroDaChave servem os dois.
--
-- Só aditiva: uma coluna nova e um índice, nada se apaga nem muda de nome (o
-- dev tem os cartões da equipa). Na produção as tabelas do kanban existem
-- (a 0028 cria-as em todas as bases) mas ficam vazias: a coluna entra na
-- mesma, sem efeito.

ALTER TABLE kanban_cartoes ADD COLUMN sub INTEGER;

-- um X só uma vez por pai (também entre os removidos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_cartoes_sub ON kanban_cartoes (pai_id, sub) WHERE sub IS NOT NULL;
