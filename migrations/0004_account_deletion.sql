-- Eliminação de conta ao estilo do Reddit: a linha do utilizador fica como
-- lápide anónima ("[deleted]") para que as referências noutros dados — quem
-- pagou um movimento numa casa partilhada, por exemplo — continuem legíveis
-- sem revelar quem era. Todos os dados próprios são apagados.

ALTER TABLE users ADD COLUMN deleted_at INTEGER;
