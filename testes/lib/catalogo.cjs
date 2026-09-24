// O catálogo dos serviços, lido do próprio ficheiro do cliente
// (web/app/servicos.js): cada manifesto com id, nome, ficheiros, kinds,
// userKinds, casa, colab, requer e usa. É a mesma lista que a app usa — não há
// uma cópia aqui para apodrecer.
//
// Leem-no o arnês (testes/arnes.js, um módulo) e o percurso
// (testes/ui/percorrer.js, CommonJS). Era a mesma expressão escrita nos dois
// sítios; um .cjs é o que os dois carregam sem truques.
'use strict';

const fs = require('fs');
const path = require('path');

/* Lê a lista SERVICOS do web/app/servicos.js, tal como a app a declara.
   Devolve: o array de manifestos, pela ordem do menu; rebenta com o nome do
   ficheiro se a declaração mudar de forma. */
function lerCatalogo() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'app', 'servicos.js'), 'utf8');
  const m = src.match(/const SERVICOS=(\[[\s\S]*?\n\]);/);
  if (!m) throw new Error('web/app/servicos.js sem «const SERVICOS=[…];»');
  return new Function('return ' + m[1])();
}

module.exports = { lerCatalogo };
