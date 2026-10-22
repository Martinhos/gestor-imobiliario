-- Sair de um imóvel que não criei, e o aviso a quem fica.
-- Um colaborador ou um comproprietário que apaga da sua lista um imóvel de
-- outra pessoa sai dele: perde as permissões nesse imóvel (e só nesse), e
-- quem fica recebe um aviso. As rotas vivem em worker/src/rotas/casas.js
-- (DELETE /api/houses/:id/participacao) e worker/src/rotas/colaboradores.js
-- (o «Deixar de colaborar», que também avisa o dono).
--
-- house_exits: um comproprietário que chegou à casa por um grupo partilhado
-- não tem uma linha só dele (é membro do grupo, e o grupo tem a casa). Para
-- sair só dessa casa e ficar no grupo, guarda-se aqui a saída: a pertença ao
-- grupo deixa de lhe dar essa casa (worker/src/lib/acesso.js). A linha sai
-- quando o criador voltar a partilhar a casa com essa pessoa (por ligação,
-- por pedido aceite, ou ao pô-la num grupo de que ela é membro), quando a
-- casa é apagada, ou com a conta.
--
-- house_events: um aviso por destinatário. kind 'colab.sair' (um colaborador
-- deixou de colaborar; vai só ao dono) ou 'casa.sair' (um comproprietário
-- saiu; vai a todos os que ficam). O nome da casa e o de quem saiu ficam
-- escritos no momento, para o aviso se ler mesmo depois de mudarem. O
-- /api/state manda os dos últimos 90 dias; os mais velhos podem ser varridos.

CREATE TABLE IF NOT EXISTS house_exits (
  house_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,      -- quem saiu
  created_at INTEGER NOT NULL,
  PRIMARY KEY (house_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_house_exits_user ON house_exits (user_id);

CREATE TABLE IF NOT EXISTS house_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,      -- o destinatário
  kind       TEXT NOT NULL,      -- colab.sair | casa.sair
  house_id   TEXT NOT NULL,
  house_name TEXT NOT NULL DEFAULT '',
  actor_id   TEXT NOT NULL,      -- quem saiu
  actor_name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_house_events_user ON house_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_house_events_house ON house_events (house_id);
