-- As quotas com data e os comproprietários sem conta (auditoria ao IRS,
-- D08 e D29; KAN-126). Uma proposta de divisão passa a dizer, além das
-- percentagens entre as contas:
--
-- fora  — os comproprietários sem conta na app, em JSON: '[{"id","nome",
--         "quota"}]' com a quota em % da casa inteira (0 < quota < 100, a
--         soma abaixo de 100), '[]' para «não há outros» (o «Só eu») ou
--         'null' para «por confirmar». NULL na coluna: a proposta não mexe
--         neles (fica o comproprietariosFora que a casa tem).
-- desde — 'AAAA-MM-DD', o primeiro dia em que as quotas novas valem. NULL:
--         o dia em que a proposta se aplica (o último sim), e os de fora que
--         estavam por confirmar ficam confirmados também para trás.
--
-- Ao aplicar, o estado que acaba vai para o quotasHist do JSON da casa com
-- ate = a véspera do desde (worker/src/lib/acesso.js:aplicarQuotas); a
-- Declaração de cada ano usa as quotas de cada data
-- (web/app/saldos.js:quotasFiscais). As casas não se migram: sem histórico,
-- as quotas de hoje valem para todas as datas, como até aqui, e o histórico
-- nasce na próxima mudança (uma proposta aceite, uma saída, uma conta
-- apagada).
--
-- As propostas pendentes de antes desta migração ficam com fora e desde a
-- NULL: aplicam-se como antes, com as quotas novas a partir do dia do último
-- sim. As rotas vivem em worker/src/rotas/casas.js (a proposta) e o estado
-- não as manda a quem só colabora.

ALTER TABLE share_proposals ADD COLUMN fora TEXT;
ALTER TABLE share_proposals ADD COLUMN desde TEXT;
