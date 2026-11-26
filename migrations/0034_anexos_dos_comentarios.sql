-- Os anexos dos tickets e das respostas na pílula «Tickets» (KAN-165, o
-- pedido do Martinho, 2026-11-26): «Devo poder anexar imagens ou documentos
-- aos tickets no pill. Responder a tickets com imagens ou ficheiros.»
--
-- Um anexo da pílula é um anexo do cartão do ticket no kanban
-- (kanban_anexos, da 0028): os mesmos tipos, lidos dos bytes, o mesmo teto e
-- o mesmo sítio no R2 (kanban/<cartao_id>/<anexo_id>), e o kanban e o
-- scripts/kanban.mjs veem-nos sem mais nada. O que faltava era saber de que
-- resposta vem um anexo: comentario_id é o id do comentário
-- (kanban_comentarios) a que o anexo pertence, ou NULL num anexo do próprio
-- cartão (os do «Novo ticket» e os que o kanban sempre teve).
--
-- Só aditiva: uma coluna nova e um índice, nada se apaga nem muda de nome (o
-- dev tem os cartões da equipa). Na produção as tabelas do kanban existem
-- (a 0028 cria-as em todas as bases) mas ficam vazias: a coluna entra na
-- mesma, sem efeito.

ALTER TABLE kanban_anexos ADD COLUMN comentario_id TEXT;

-- os anexos de um comentário, pela ordem em que chegaram
CREATE INDEX IF NOT EXISTS idx_kanban_anexos_comentario ON kanban_anexos (comentario_id) WHERE comentario_id IS NOT NULL;
