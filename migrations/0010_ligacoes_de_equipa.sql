-- Ligações de uso único para a ferramenta de equipa.
--
-- Estavam no KV, e foi o sítio errado. O KV só fica consistente entre
-- regiões ao fim de algum tempo: a ligação era escrita no ponto de presença
-- que atende o Discord e lida no de quem clica, que quase nunca é o mesmo.
-- Uma ligação acabada de criar aparecia como inexistente, e o erro que se
-- via era "já foi usada ou expirou" — que era falso nas duas metades.
--
-- Na base a leitura vê sempre a escrita. E o uso único passa a fazer-se numa
-- só instrução (UPDATE ... WHERE used_at IS NULL), em vez de ler-e-depois-
-- apagar: se dois pedidos chegarem ao mesmo tempo, só um altera a linha.
CREATE TABLE IF NOT EXISTS team_links (
  token      TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_team_links_expires ON team_links(expires_at);
