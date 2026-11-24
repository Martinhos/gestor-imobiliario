-- O histórico do consumo (KAN-144, ticket de QA 578aa979). A Operação do
-- back office mostrava só a fotografia do momento; cada valor do consumo
-- passa a abrir um gráfico da evolução, e para isso guarda-se uma amostra
-- por hora.
--
-- medida — o id da medida (worker/src/lib/consumo-serie.js:MEDIDAS): os
--          números da D1 (contas, ativos, casas, registos, pedidos, erros)
--          e os tectos da Cloudflare com número (d1-lidas, d1-escritas,
--          workers-pedidos, kv-leituras, kv-escritas, r2-espaco, r2-classe-a).
-- at     — o instante da amostra, em ms: a hora certa da vigia de hora a
--          hora, ou o fim de um dia UTC no passado reconstruído das contas.
-- valor  — o número medido (as linhas, os pedidos, os bytes).
--
-- Quem escreve é a vigia de hora a hora (worker/src/index.js:scheduled), um
-- INSERT em lote por hora; quem apaga é a mesma vigia, o que passar dos 400
-- dias. A chave (medida, at) serve as duas leituras — a série de uma medida
-- num intervalo e a limpeza por medida —, por isso não há outro índice.
-- Com rowid, como todas as outras: a cópia diária pagina pelo rowid
-- (worker/src/salvaguarda.js:copiar), e uma tabela WITHOUT ROWID partia-a.

CREATE TABLE IF NOT EXISTS consumo_amostras (
  medida TEXT NOT NULL,
  at     INTEGER NOT NULL,
  valor  REAL NOT NULL,
  PRIMARY KEY (medida, at)
);
