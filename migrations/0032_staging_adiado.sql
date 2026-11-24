-- Staging, Adiado e Produção no kanban da equipa (KAN-156 e KAN-157, as
-- decisões do Martinho, 2026-11-24): «Quando disser promove, só promoves o
-- que estiver na coluna para produção». Até aqui o Aceitar de Human Tests
-- levava o cartão a Concluído e o promove levava o dev inteiro ao main. Agora
-- o Aceitar tem duas saídas:
-- - Staging ('staging'): resolvido e testado, vai no próximo promove (o
--   scripts/promover.mjs leva só os commits destes cartões);
-- - Adiado ('adiado'): resolvido e testado, mas fica no dev; daqui vai a
--   Staging quando se quiser.
-- E Concluído passa a chamar-se Produção: é para onde o promove leva os
-- cartões de Staging depois do deploy de produção. O id fica 'concluido'
-- (está em qa_tickets.status, nos scripts e nas regras): só o nome muda. Os
-- cartões que já lá estão ficam — são o histórico.
--
-- As duas novas são fixas (fixa = 1: a automação usa-as, renomeiam-se mas
-- não se removem) e de fim (fim = 1: contam como feitas no progresso de um
-- épico, têm concluido_at, e num ticket de QA o resolved_at fica posto — o
-- gatilho kanban_qa_coluna da 0029 já lê o fim da tabela). Entram logo antes
-- de Produção; Produção e o que vinha depois dela (Para depois, e as que o
-- master tenha criado ali) descem duas casas. No quadro de sempre fica:
-- A fazer 1, Auto Tests 2, Human Tests 3, Staging 4, Adiado 5, Produção 6,
-- Para depois 7.
--
-- Corre uma vez, mas não estraga nada se correr de novo: as inserções são
-- OR IGNORE e o deslize só acontece enquanto o Adiado ainda não existe.

-- Staging no lugar de Produção (a mesma ordem, por agora)
INSERT OR IGNORE INTO kanban_colunas (id, nome, ordem, fim, fixa, created_at, updated_at)
  SELECT 'staging', 'Staging', ordem, 1, 1, 0, 0 FROM kanban_colunas WHERE id = 'concluido';

-- Produção e as de depois dela descem duas casas (a do Staging fica, e é ela a referência)
UPDATE kanban_colunas SET ordem = ordem + 2
 WHERE id <> 'staging'
   AND ordem >= (SELECT ordem FROM kanban_colunas WHERE id = 'staging')
   AND NOT EXISTS (SELECT 1 FROM kanban_colunas WHERE id = 'adiado');

-- Adiado logo a seguir ao Staging
INSERT OR IGNORE INTO kanban_colunas (id, nome, ordem, fim, fixa, created_at, updated_at)
  SELECT 'adiado', 'Adiado', ordem + 1, 1, 1, 0, 0 FROM kanban_colunas WHERE id = 'staging';

-- Concluído passa a Produção (o id fica)
UPDATE kanban_colunas SET nome = 'Produção' WHERE id = 'concluido';
