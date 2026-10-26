-- Passar o controlo de uma casa precisa do sim de todos os comproprietários
-- dela (a decisão do Martinho, 2026-10-26), não só do de quem recebe. Quem
-- tem de aceitar conta-se no momento: os participantes da casa
-- (acesso.js:participantsOf) menos quem pediu — quem recebe incluído. Cada
-- casa do lote passa quando todos os dela aceitarem; uma recusa faz cair essa
-- casa. As rotas vivem em worker/src/rotas/casas.js (rotasTransferencias).
--
-- approvals é o JSON dos ids que já aceitaram esta casa. Escreve-se por cima
-- do que se leu (UPDATE … WHERE approvals = <o lido>), como as aprovações das
-- propostas de quotas: dois sins ao mesmo tempo não se perdem — o segundo
-- relê e junta-se. rejected_by é quem recusou (a linha fica 'rejected').
--
-- O trigger house_transfers_decidida da 0021 fica: uma decisão não volta
-- atrás, e a passagem e uma recusa ao mesmo tempo não ganham as duas.

ALTER TABLE house_transfers ADD COLUMN approvals TEXT NOT NULL DEFAULT '[]';
ALTER TABLE house_transfers ADD COLUMN rejected_by TEXT;
