-- A decisão sobre os pedidos das pessoas, e a resposta proposta.
--
-- Um pedido que alguém escreve na Ajuda da app (category 'user') só se
-- implementa depois de alguém da equipa o aceitar no back office: o Claude
-- (scripts/ticket.mjs, a skill ticket) só pega nos aceites. Recusar fecha o
-- pedido com uma justificação, que a pessoa recebe como resposta. Quem aceita
-- pode aceitar com alterações (accepted_changes, só a equipa as vê): é o que
-- se implementa, e manda mais do que o texto do pedido. Fica quem
-- decidiu e quando, como na tomada (assignee), e o rasto vai também para o
-- audit_log. Os erros que a app e o servidor apanham sozinhos não passam por
-- aqui.
--
-- Depois de implementar, o Claude não responde à pessoa: escreve a resposta
-- proposta (draft_reply), que o back office mete na caixa de responder. Uma
-- pessoa da equipa lê-a, altera-a se for preciso, e envia — e só então a
-- pessoa a recebe (na app e por email) e o pedido fecha. Enviar uma resposta
-- larga a proposta.
--
-- Só se acrescentam colunas, sem valor por omissão: nenhum pedido existente
-- fica aceite, recusado ou com proposta sem ninguém o ter feito.
ALTER TABLE tickets ADD COLUMN accepted_at INTEGER;
ALTER TABLE tickets ADD COLUMN accepted_by TEXT;       -- id de Discord de quem aceitou
ALTER TABLE tickets ADD COLUMN accepted_by_nome TEXT;
ALTER TABLE tickets ADD COLUMN accepted_changes TEXT;  -- as alterações de quem aceitou (opcional)
ALTER TABLE tickets ADD COLUMN refused_at INTEGER;
ALTER TABLE tickets ADD COLUMN refused_by TEXT;        -- id de Discord de quem recusou
ALTER TABLE tickets ADD COLUMN refused_by_nome TEXT;
ALTER TABLE tickets ADD COLUMN draft_reply TEXT;       -- a resposta proposta, por enviar
ALTER TABLE tickets ADD COLUMN draft_at INTEGER;
