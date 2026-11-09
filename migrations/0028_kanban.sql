-- O kanban da equipa (a decisão do Martinho, 2026-11-09): o board onde
-- vivem todas as tarefas, no lugar do board KAN do Jira, com as mesmas
-- chaves (KAN-N). Vive SÓ no dev: as rotas (worker/src/rotas/kanban.js)
-- respondem 404 sem env.ENV_NAME, por isso estas tabelas ficam vazias na
-- base de produção. O back office do dev mostra-o (a secção Kanban) e o
-- Claude lê-o e escreve-o com scripts/kanban.mjs.
--
-- Os tickets de QA novos e os pedidos aceites criam o seu cartão sozinhos, e
-- movem-no quando mudam de estado (worker/src/lib/kanban.js, a regra única
-- que o worker e os scripts usam): origem_tipo ('qa' | 'pedido') e
-- origem_id dizem de onde veio, origem_estado o último estado da origem que
-- se viu — um cartão só se move sozinho quando esse estado MUDA, e mover um
-- cartão à mão nunca mexe no ticket.
--
-- Nada aqui tem chave estrangeira para users nem para tickets: os autores
-- são pessoas da equipa pelo Discord (ou 'claude', ou 'automatico'), e os
-- cartões sobrevivem à limpeza do dev (.github/workflows/limpar-dev.yml) e
-- ao ticket de onde vieram.

-- As colunas do quadro, pela ordem. As quatro com fixa = 1 são as que a
-- sincronização automática usa (a-fazer, auto-tests, human-tests,
-- concluido): renomeiam-se, mas não se removem. fim = 1 conta como feito
-- (o progresso de um épico, o concluido_at).
CREATE TABLE IF NOT EXISTS kanban_colunas (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  ordem      INTEGER NOT NULL,
  fim        INTEGER NOT NULL DEFAULT 0,
  fixa       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO kanban_colunas (id, nome, ordem, fim, fixa, created_at, updated_at) VALUES
  ('a-fazer', 'A fazer', 1, 0, 1, 0, 0),
  ('auto-tests', 'Auto Tests', 2, 0, 1, 0, 0),
  ('human-tests', 'Human Tests', 3, 0, 1, 0, 0),
  ('concluido', 'Concluído', 4, 1, 1, 0, 0),
  ('para-depois', 'Para depois', 5, 0, 0, 0, 0);

-- O número do último cartão (o N de KAN-N). Um contador, e não o MAX dos
-- cartões, para um número nunca se repetir depois de um cartão apagado de
-- vez. Quem cria sobe-o para MAX(ultimo, maior número que exista) + 1.
-- Começa em 78, a última chave do board KAN do Jira quando o kanban nasceu:
-- entre o deploy e a importação (scripts/kanban.mjs importar-jira) um ticket
-- de QA já cria o seu cartão, e com o contador a zero ficava com uma chave
-- que a importação ainda ia trazer (KAN-4, KAN-5…). Assim a numeração
-- continua a do Jira, a partir do KAN-79.
CREATE TABLE IF NOT EXISTS kanban_contador (
  id     INTEGER PRIMARY KEY CHECK (id = 1),
  ultimo INTEGER NOT NULL
);
INSERT OR IGNORE INTO kanban_contador (id, ultimo) VALUES (1, 78);

-- Os cartões. tipo: epico | historia | tarefa | subtarefa | erro.
-- prioridade: 1 Mais alta, 2 Alta, 3 Média, 4 Baixa, 5 Mais baixa.
-- posicao: a ordem dentro da coluna (a menor em cima), real para se poder
-- meter um cartão entre dois sem renumerar os outros. pai_id: o épico de
-- uma história ou tarefa, ou a tarefa de uma subtarefa. prazo: AAAA-MM-DD.
-- responsavel_id / relator_id: o id do Discord, ou 'claude'.
-- Remover é brando (removed_at), para o Anular.
CREATE TABLE IF NOT EXISTS kanban_cartoes (
  id               TEXT PRIMARY KEY,
  numero           INTEGER NOT NULL UNIQUE,
  tipo             TEXT NOT NULL DEFAULT 'tarefa',
  titulo           TEXT NOT NULL,
  descricao        TEXT NOT NULL DEFAULT '',
  coluna_id        TEXT NOT NULL,
  posicao          REAL NOT NULL DEFAULT 0,
  prioridade       INTEGER NOT NULL DEFAULT 3,
  responsavel_id   TEXT,
  responsavel_nome TEXT,
  relator_id       TEXT NOT NULL,
  relator_nome     TEXT NOT NULL DEFAULT '',
  pai_id           TEXT,
  prazo            TEXT,
  origem_tipo      TEXT,
  origem_id        TEXT,
  origem_estado    TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  concluido_at     INTEGER,
  removed_at       INTEGER,
  removed_by       TEXT
);
CREATE INDEX IF NOT EXISTS idx_kanban_cartoes_quadro ON kanban_cartoes (removed_at, coluna_id, posicao);
CREATE INDEX IF NOT EXISTS idx_kanban_cartoes_pai ON kanban_cartoes (pai_id);
-- um ticket tem um cartão só: é isto que torna a sincronização idempotente
CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_cartoes_origem ON kanban_cartoes (origem_tipo, origem_id)
  WHERE origem_tipo IS NOT NULL;

-- As etiquetas de cada cartão (texto livre, minúsculas, sem espaços).
CREATE TABLE IF NOT EXISTS kanban_etiquetas (
  cartao_id TEXT NOT NULL,
  etiqueta  TEXT NOT NULL,
  PRIMARY KEY (cartao_id, etiqueta)
);
CREATE INDEX IF NOT EXISTS idx_kanban_etiquetas_nome ON kanban_etiquetas (etiqueta);

-- Os comentários. Editar e remover só os próprios; remover é brando.
CREATE TABLE IF NOT EXISTS kanban_comentarios (
  id         TEXT PRIMARY KEY,
  cartao_id  TEXT NOT NULL,
  autor_id   TEXT NOT NULL,
  autor_nome TEXT NOT NULL DEFAULT '',
  texto      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  removed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_kanban_comentarios_cartao ON kanban_comentarios (cartao_id, created_at);

-- O histórico de cada cartão: cada mudança, quem, quando, de quê para quê.
-- campo: criado | coluna | titulo | descricao | tipo | prioridade |
-- etiquetas | responsavel | pai | prazo | ligacao | anexo | origem |
-- removido | reposto. antes e depois em texto (ids de coluna, chaves KAN-N,
-- listas separadas por vírgula).
CREATE TABLE IF NOT EXISTS kanban_historico (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cartao_id  TEXT NOT NULL,
  at         INTEGER NOT NULL,
  autor_id   TEXT NOT NULL,
  autor_nome TEXT NOT NULL DEFAULT '',
  campo      TEXT NOT NULL,
  antes      TEXT,
  depois     TEXT
);
CREATE INDEX IF NOT EXISTS idx_kanban_historico_cartao ON kanban_historico (cartao_id, at);

-- As ligações entre cartões: tipo 'bloqueia' (de_id bloqueia para_id; do
-- outro lado lê-se «é bloqueado por») ou 'relaciona' (simétrica, guardada
-- uma vez).
CREATE TABLE IF NOT EXISTS kanban_ligacoes (
  id         TEXT PRIMARY KEY,
  de_id      TEXT NOT NULL,
  para_id    TEXT NOT NULL,
  tipo       TEXT NOT NULL,
  autor_id   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (de_id, para_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_kanban_ligacoes_para ON kanban_ligacoes (para_id);

-- Os anexos de imagem: o ficheiro no R2 em kanban/<cartao_id>/<id>.
CREATE TABLE IF NOT EXISTS kanban_anexos (
  id         TEXT PRIMARY KEY,
  cartao_id  TEXT NOT NULL,
  chave      TEXT NOT NULL,
  nome       TEXT NOT NULL DEFAULT '',
  tipo       TEXT NOT NULL,
  tamanho    INTEGER NOT NULL,
  autor_id   TEXT NOT NULL,
  autor_nome TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kanban_anexos_cartao ON kanban_anexos (cartao_id);
