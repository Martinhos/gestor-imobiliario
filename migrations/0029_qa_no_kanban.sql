-- Os tickets de QA com as colunas do kanban (pedido do Martinho, 2026-11-10:
-- «Quero que os tickets qa estejam sincronizados com o Kanban. As mesmas
-- colunas»). Até aqui um ticket tinha três estados (aberto, em_resolucao,
-- resolvido) e o cartão só o seguia; mover o cartão à mão não mexia no
-- ticket. Agora o ticket está sempre na coluna do seu cartão:
-- qa_tickets.status passa a guardar o id da coluna (a-fazer, auto-tests,
-- human-tests, concluido, para-depois, ou uma coluna nova do master).
--
-- Os dois sentidos:
-- - do kanban para o ticket, o gatilho de baixo: qualquer movimento do
--   cartão (o arrasto e o Mover para do back office, o scripts/kanban.mjs
--   mover, a sincronização) copia a coluna para o ticket, e o resolved_at
--   acompanha (posto ao chegar a Human Tests ou a uma coluna de fim, tirado
--   ao sair delas);
-- - do ticket para o kanban, worker/src/lib/kanban.js:passosDaSincronizacao,
--   que leva o cartão para a coluna que o ticket tomou (e cria-o, se o ticket
--   ainda não tinha) — chamada pelas rotas (worker/src/rotas/qa.js) e pelo
--   scripts/qa.mjs.
--
-- Os tickets de antes do kanban não têm cartão: ficam na coluna que o estado
-- antigo diz (aberto → A fazer, em resolução → Auto Tests, resolvido →
-- Concluído) e ganham o cartão quando mudarem de coluna. Os que têm cartão
-- ficam na coluna dele.
--
-- O DEFAULT 'aberto' da coluna status fica (o SQLite não o muda sem refazer a
-- tabela): quem cria um ticket escreve sempre a coluna.

UPDATE qa_tickets SET status = COALESCE(
  (SELECT k.coluna_id FROM kanban_cartoes k
    WHERE k.origem_tipo = 'qa' AND k.origem_id = qa_tickets.id AND k.removed_at IS NULL
    ORDER BY k.numero LIMIT 1),
  CASE status WHEN 'aberto' THEN 'a-fazer' WHEN 'em_resolucao' THEN 'auto-tests' WHEN 'resolvido' THEN 'concluido' ELSE status END
);

-- origem_estado dos cartões de QA passa a ser a coluna que o ticket tem
UPDATE kanban_cartoes SET origem_estado = coluna_id WHERE origem_tipo = 'qa';

-- O cartão de um ticket de QA moveu-se (ou voltou de removido): o ticket vai
-- com ele. Só cartões vivos; um cartão removido deixa o ticket onde está.
CREATE TRIGGER IF NOT EXISTS kanban_qa_coluna
AFTER UPDATE OF coluna_id, removed_at ON kanban_cartoes
FOR EACH ROW WHEN NEW.origem_tipo = 'qa' AND NEW.removed_at IS NULL
  AND (NEW.coluna_id IS NOT OLD.coluna_id OR OLD.removed_at IS NOT NULL)
BEGIN
  UPDATE qa_tickets SET
    status = NEW.coluna_id,
    resolved_at = CASE WHEN NEW.coluna_id = 'human-tests' OR NEW.coluna_id IN (SELECT id FROM kanban_colunas WHERE fim = 1)
      THEN COALESCE(resolved_at, NEW.updated_at) ELSE NULL END,
    updated_at = MAX(updated_at, COALESCE(NEW.updated_at, 0))
  WHERE id = NEW.origem_id AND status IS NOT NEW.coluna_id;
  UPDATE kanban_cartoes SET origem_estado = NEW.coluna_id
  WHERE id = NEW.id AND origem_estado IS NOT NEW.coluna_id;
END;

-- Um cartão de QA que nasce já ligado a um ticket (a sincronização cria-o na
-- coluna do ticket; um cartão ligado à mão também conta): o ticket fica na
-- coluna dele.
CREATE TRIGGER IF NOT EXISTS kanban_qa_nasce
AFTER INSERT ON kanban_cartoes
FOR EACH ROW WHEN NEW.origem_tipo = 'qa' AND NEW.removed_at IS NULL
BEGIN
  UPDATE qa_tickets SET
    status = NEW.coluna_id,
    resolved_at = CASE WHEN NEW.coluna_id = 'human-tests' OR NEW.coluna_id IN (SELECT id FROM kanban_colunas WHERE fim = 1)
      THEN COALESCE(resolved_at, NEW.updated_at) ELSE NULL END,
    updated_at = MAX(updated_at, COALESCE(NEW.updated_at, 0))
  WHERE id = NEW.origem_id AND status IS NOT NEW.coluna_id;
END;
