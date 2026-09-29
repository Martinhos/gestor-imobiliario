-- Pedidos para entrar num grupo partilhado de imóveis.
-- O dono do grupo aceita cada entrada: quem abre a ligação de convite do
-- grupo (0017) já não passa a membro — fica com um pedido pendente, e só
-- entra (passa a comproprietário das casas do grupo) quando o dono o aceitar.
-- Uma ligação partilhada no sítio errado deixa de dar acesso a quem a
-- apanhar. Enquanto o pedido está pendente, quem pediu não vê nem escreve
-- nada nas casas do grupo, e a resposta de entrar não lhe dá os ids delas.
-- As rotas vivem em worker/src/rotas/grupos.js.
--
-- Um pedido por pessoa e grupo (a chave): pedir outra vez com o pedido
-- pendente não cria outro nem conta outro uso da ligação; um pedido recusado
-- (ou aceite, de quem entretanto saiu ou foi removido) reabre-se como
-- pendente. O dono aceita (status 'accepted', e a pessoa entra em
-- shared_group_members) ou recusa ('rejected'); quem pediu cancela o seu
-- pendente (a linha sai). Apagar o grupo, ou a conta de quem pediu ou do
-- dono, leva os pedidos. Um tecto de pendentes por grupo nas rotas.

CREATE TABLE IF NOT EXISTS shared_group_requests (
  group_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,                   -- quem pediu para entrar
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  created_at INTEGER NOT NULL,                -- quando pediu (ou reabriu o pedido)
  decided_at INTEGER,                         -- quando o dono aceitou ou recusou
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_group_requests_user ON shared_group_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_shared_group_requests_group ON shared_group_requests (group_id, status);
