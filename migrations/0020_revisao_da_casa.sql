-- A revisão de cada casa: duas escritas ao mesmo tempo não se esmagam.
-- Os dados da casa (houses.data, com as quotas ownerShares e ownerIds) são
-- um JSON que se lê, se muda e se grava inteiro. Dois pedidos que o leiam
-- ao mesmo tempo — dois comproprietários a sair, duas aprovações da mesma
-- proposta, uma gravação da ficha a meio de uma saída — gravavam cada um a
-- sua conta, e a segunda apagava a primeira sem ninguém saber.
--
-- Cada escrita da app numa casa leva uma revisão nova (rev, um id ao acaso)
-- e diz sobre que revisão escreveu (rev_base, a que leu). O trigger recusa a
-- escrita quando a casa já não está nessa revisão: o lote inteiro em que ia
-- desfaz-se (a D1 corre cada lote como uma transação), e quem escreve relê a
-- casa, refaz as contas e tenta outra vez (worker/src/lib/acesso.js:
-- comCasaFresca). Um id ao acaso, e não um número que sobe: duas escritas
-- sobre a mesma revisão escreviam o mesmo número seguinte.
--
-- Uma atualização que não mexe em rev (uma correção à mão na consola) não é
-- verificada nem muda a revisão. As da app mudam-na sempre: o
-- testes/revisao-da-casa.test.js confere que todas as escritas de houses no
-- worker passam por acesso.js:gravarCasa.

ALTER TABLE houses ADD COLUMN rev TEXT NOT NULL DEFAULT '';
ALTER TABLE houses ADD COLUMN rev_base TEXT;

CREATE TRIGGER IF NOT EXISTS houses_revisao
BEFORE UPDATE ON houses
FOR EACH ROW WHEN NEW.rev IS NOT OLD.rev AND NEW.rev_base IS NOT OLD.rev
BEGIN
  SELECT RAISE(ABORT, 'casa-mudou');
END;
