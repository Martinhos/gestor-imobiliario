-- Permite invalidar todas as sessões de um utilizador de uma vez: cada sessão
-- guarda a "época" em que nasceu e deixa de valer quando a época do utilizador
-- avança (mudança de palavra-passe ou "terminar sessão nos outros aparelhos").

ALTER TABLE users ADD COLUMN sess_epoch INTEGER NOT NULL DEFAULT 0;
