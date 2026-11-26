-- Os modelos de dados do Lab (KAN-167, ticket de QA #DE9657BC, as decisões
-- do Martinho, 2026-11-26): no dev, quem testa carrega na conta de teste em
-- que está um cenário pronto (os modelos de base, escritos em código em
-- web/app/modelos-cenarios.js) ou a cópia de uma conta que gravou antes
-- («Guardar como modelo novo»), e pode renomear, ordenar e remover os seus.
-- As rotas são worker/src/rotas/modelos.js, só fora de produção (404 sem
-- ENV_NAME), e substituir os dados só numa conta de teste.
--
-- Os modelos são de cada pessoa, e a pessoa é quem está por trás das contas
-- de teste: dono é 'discord:<id>' — o dono assinado na ligação do /test
-- (users.test_owner) numa conta de teste, ou a pessoa da equipa no back
-- office —, para sobreviverem a trocar de conta de teste e ao /test limpar;
-- 'conta:<id>' numa conta sem pessoa do Discord (uma conta normal do dev, ou
-- de teste sem dono). Sem REFERENCES users, como os qa_tickets: a conta pode
-- ir-se e o modelo fica.
--
-- tipo 'cenario': cenario é o id de um cenário do código, e os dados nascem
-- ao carregar, com as datas relativas a hoje; nome NULL é o nome do código.
-- tipo 'dados': a conta gravada, com as datas tal como estavam — dados é o
-- JSON das entidades ({conta, entidades: [{scope, houseId?, kind?, id?,
-- data}]}, a forma do /api/sync) ou NULL quando é grande e vive no R2, na
-- chave dados_r2 (modelos/<id>). resumo é o JSON das contagens que a lista
-- mostra (imóveis, contratos, pessoas, movimentos, planeados).
--
-- origem: 'base' (os do código, que nascem a cada pessoa na primeira vez
-- que abre a lista, um por cenário: o índice único), 'ticket' (o que o
-- Claude cria para quem escreveu um ticket, com scripts/modelos.mjs; ticket
-- guarda a chave KAN-N ou o id do ticket) ou 'pessoa' (gravado da conta).
-- ordem é a ordem personalizada (o arrasto); remover é brando (removido_em,
-- para o Anular) e, passadas 24 h, a linha apaga-se de passagem pelas rotas.
--
-- Só aditiva: uma tabela nova e os índices. Na produção a tabela fica vazia
-- (as rotas não existem lá).

CREATE TABLE IF NOT EXISTS qa_modelos (
  id            TEXT PRIMARY KEY,
  dono          TEXT NOT NULL,                     -- 'discord:<id>' | 'conta:<id>'
  nome          TEXT,                              -- NULL num cenário: o nome do código
  ordem         REAL NOT NULL DEFAULT 0,
  tipo          TEXT NOT NULL,                     -- 'cenario' | 'dados'
  cenario       TEXT,                              -- o id do cenário (tipo 'cenario')
  dados         TEXT,                              -- JSON (tipo 'dados'), ou NULL quando vai no R2
  dados_r2      TEXT,                              -- modelos/<id> no R2, só quando é grande
  resumo        TEXT,                              -- JSON das contagens
  origem        TEXT NOT NULL DEFAULT 'pessoa',    -- 'base' | 'ticket' | 'pessoa'
  ticket        TEXT,                              -- KAN-N ou o id do ticket (origem 'ticket')
  criado_em     INTEGER NOT NULL,
  atualizado_em INTEGER NOT NULL,
  removido_em   INTEGER
);

-- a lista de uma pessoa, pela ordem personalizada
CREATE INDEX IF NOT EXISTS idx_qa_modelos_dono ON qa_modelos (dono, ordem);
-- os de base nascem uma vez por pessoa e por cenário (semear repetido não duplica)
CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_modelos_base ON qa_modelos (dono, cenario) WHERE origem = 'base';
