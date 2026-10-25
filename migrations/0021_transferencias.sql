-- Transferir a propriedade de casas a outra pessoa.
-- O criador de uma casa pede a transferência dela (de uma ou de várias, num
-- lote) a um proprietário ligado a si; quem recebe aceita ou recusa, e até lá
-- quem pediu pode cancelar. Nada muda antes de aceitar. As rotas vivem em
-- worker/src/rotas/casas.js (POST /api/transfers, DELETE /api/transfers/:lote,
-- POST …/reject e …/accept).
--
-- Uma linha por casa: o lote junta as casas de um mesmo pedido. ficar = 1 é
-- o «Continuar como comproprietário» (quem pediu fica com a casa por uma
-- partilha na ligação entre os dois, e as quotas do pedido entram ao
-- aceitar); ficar = 0, quem pediu sai de vez e a quota dele passa a quem
-- recebe. shares é o JSON { userId: percentagem } das quotas pedidas para
-- essa casa (só com ficar).
--
-- Uma só transferência pendente por casa (o índice único parcial): dois
-- pedidos ao mesmo tempo não passam os dois. Uma decisão (aceite, recusada,
-- cancelada) não volta atrás: o trigger recusa mudar o estado de uma linha
-- que já não está pendente, e o lote em que ia desfaz-se — é assim que um
-- aceitar e um cancelar ao mesmo tempo não ganham os dois.

CREATE TABLE IF NOT EXISTS house_transfers (
  id         TEXT PRIMARY KEY,
  lote       TEXT NOT NULL,
  house_id   TEXT NOT NULL,
  from_user  TEXT NOT NULL,              -- quem pede (o criador da casa)
  to_user    TEXT NOT NULL,              -- quem recebe
  ficar      INTEGER NOT NULL DEFAULT 0,
  shares     TEXT,                       -- JSON { userId: pct }, só com ficar
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected | cancelled
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_house_transfers_pendente ON house_transfers (house_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_house_transfers_lote ON house_transfers (lote);
CREATE INDEX IF NOT EXISTS idx_house_transfers_to ON house_transfers (to_user, status);
CREATE INDEX IF NOT EXISTS idx_house_transfers_from ON house_transfers (from_user, status);

CREATE TRIGGER IF NOT EXISTS house_transfers_decidida
BEFORE UPDATE OF status ON house_transfers
FOR EACH ROW WHEN OLD.status <> 'pending' AND NEW.status IS NOT OLD.status
BEGIN
  SELECT RAISE(ABORT, 'transf-decidida');
END;
