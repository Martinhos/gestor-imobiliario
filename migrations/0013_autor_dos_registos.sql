-- Quem mexeu em quê, nas casas partilhadas. Cada escrita num registo passa
-- a guardar o autor (o utilizador da sessão que a fez): é o que permite ao
-- centro de notificações dizer «a Maria registou uma renda no T2» em vez
-- de um mudo «algo mudou». NULL nos registos antigos — sem autor conhecido,
-- não se inventa.
ALTER TABLE records ADD COLUMN author TEXT;
