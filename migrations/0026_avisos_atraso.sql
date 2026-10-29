-- Os avisos por email dos movimentos planeados em atraso (o ticket de QA
-- 7f28f7bb, com as decisões do Martinho de 2026-10-29): um resumo diário,
-- só nos dias em que algum planeado entrou em atraso, para os proprietários
-- da casa e os colaboradores que veem os contratos dela. O servidor é
-- worker/src/lib/avisos-atraso.js, chamado pelo cron diário.
--
-- users.avisos_email: 1 (por omissão) recebe os avisos, 0 desligou-os nas
-- Definições (GET/POST /api/conta/avisos).
--
-- avisos_atraso: cada atraso que já foi num email, por pessoa — é isto que
-- faz cada atraso ir uma vez só. casa é o id da casa, ou '' para um planeado
-- «Sem imóvel» (user_records). data é o next do planeado (AAAA-MM-DD):
-- confirmar avança o next, e um atraso novo da mesma recorrência é outra
-- linha. enviado é a hora (ms) a que o Resend aceitou o email; só se grava
-- nessa altura, e as linhas com mais de 400 dias saem no mesmo passo do cron.
--
-- Sem REFERENCES users de propósito, como as rasto_*: o apagar da conta
-- (lib/acesso.js:purgeAccount) tira as linhas dela por si.

ALTER TABLE users ADD COLUMN avisos_email INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS avisos_atraso (
  user_id TEXT NOT NULL,
  casa    TEXT NOT NULL,            -- id da casa, ou '' (Sem imóvel)
  rec_id  TEXT NOT NULL,
  data    TEXT NOT NULL,            -- o next do planeado, AAAA-MM-DD
  enviado INTEGER NOT NULL,         -- ms de época: quando o Resend aceitou
  PRIMARY KEY (user_id, casa, rec_id, data)
);
-- a poda dos 400 dias procura pela hora do envio
CREATE INDEX IF NOT EXISTS avisos_atraso_enviado ON avisos_atraso (enviado);
