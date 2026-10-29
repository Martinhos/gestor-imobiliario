-- O rasto das pessoas (a decisão do Martinho, 2026-10-29): com o «Aceitar»
-- da faixa da montra ou da pergunta da app, cada toque na app e na montra
-- fica guardado debaixo de um pseudónimo, para o back office seguir uma
-- pessoa sem lhe ver o nome. Guarda-se ONDE (o ecrã, a janela, o descritor
-- do elemento, a posição em permilagem), nunca O QUÊ (textos, valores, ids
-- de registos). O servidor é worker/src/lib/rasto.js.
--
-- rasto_ids: o pseudónimo (pid, 'P-' + 6 caracteres aleatórios, nunca
-- derivado do id da conta). user_id fica NULL enquanto é só um visitante da
-- montra; ao criar conta ou entrar com esse aparelho, passa a ser da conta
-- (ou os eventos dele juntam-se ao pid que a conta já tinha).
--
-- rasto_visitantes: o aparelho (vid, 32 hexadecimais aleatórios, no cookie
-- HttpOnly rd_vis) aponta para um pid.
--
-- rasto_eventos: cada toque, ecrã, janela, guardar e erro, com o lote
-- (sessao, uma por carregamento da página) e a origem ('app' ou 'montra').
-- Vivem 90 dias (a poda no cron diário) e saem com a conta.
--
-- Sem REFERENCES users de propósito, como os qa_tickets: o apagar da conta
-- (lib/acesso.js:purgeAccount) tira as linhas por si, e um pid sem conta é
-- normal (um visitante da montra).
--
-- users.rasto_escolha: 'sim' | 'nao' | NULL (ainda não escolheu), com a hora
-- em rasto_escolha_at. Só se acrescentam colunas, sem valor por omissão:
-- ninguém fica a dizer sim sem o ter dito.

CREATE TABLE IF NOT EXISTS rasto_ids (
  pid     TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,              -- NULL: só um visitante da montra
  criado  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rasto_visitantes (
  vid    TEXT PRIMARY KEY,          -- o cookie rd_vis
  pid    TEXT NOT NULL,
  criado INTEGER NOT NULL
);
-- o juntar e o apagar procuram os aparelhos pelo pid
CREATE INDEX IF NOT EXISTS rasto_visitantes_pid ON rasto_visitantes (pid);

CREATE TABLE IF NOT EXISTS rasto_eventos (
  id     INTEGER PRIMARY KEY,
  pid    TEXT NOT NULL,
  sessao TEXT NOT NULL,             -- 's-' + 10 [a-z0-9], uma por carregamento
  at     INTEGER NOT NULL,          -- ms de época
  origem TEXT NOT NULL,             -- app | montra
  tipo   TEXT NOT NULL,             -- toque, ecra, janela-abre, janela-fecha, guardar, erro-campo, erro, pagina, secao
  ecra   TEXT,                      -- até 40
  janela TEXT,                      -- até 40
  alvo   TEXT,                      -- até 80: um descritor, nunca texto da página
  x      INTEGER,                   -- permilagem da janela (0–1000)
  y      INTEGER,
  vw     INTEGER,                   -- px da janela
  vh     INTEGER,
  sinal  TEXT                       -- NULL, em-vao, repetido, vai-e-volta, desistencia, erro-campo
);
CREATE INDEX IF NOT EXISTS rasto_eventos_pid_at ON rasto_eventos (pid, at);
CREATE INDEX IF NOT EXISTS rasto_eventos_at ON rasto_eventos (at);
CREATE INDEX IF NOT EXISTS rasto_eventos_sinal_at ON rasto_eventos (sinal, at);

ALTER TABLE users ADD COLUMN rasto_escolha TEXT;      -- sim | nao | NULL
ALTER TABLE users ADD COLUMN rasto_escolha_at INTEGER;
