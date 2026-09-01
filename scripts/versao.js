// Escreve web/versao.json a partir de web/avisos.js.
//
//   node scripts/versao.js          gera o ficheiro
//   node scripts/versao.js --check  confirma que está em dia (para o CI)
//
// O ficheiro é o que a app vai buscar para saber se está atrasada. Tem de
// sair de avisos.js e não ser escrito à mão: uma versão que não bate certo
// com as novidades faria a app recarregar-se em ciclo.

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const fonte = path.join(raiz, 'web', 'avisos.js');
const destino = path.join(raiz, 'web', 'versao.json');

const dados = require(fonte);
const conteudo = JSON.stringify({
  versao: dados.VERSAO,
  minima: dados.VERSAO_MINIMA,
  data: dados.AVISOS[0].data,
}, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const atual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : '';
  if (atual !== conteudo) {
    console.error('web/versao.json está desatualizado. Corre: node scripts/versao.js');
    console.error('esperado:\n' + conteudo);
    process.exit(1);
  }
  console.log('versao.json em dia (versão ' + dados.VERSAO + ')');
  process.exit(0);
}

fs.writeFileSync(destino, conteudo);
console.log('web/versao.json escrito — versão ' + dados.VERSAO +
  ', mínima ' + dados.VERSAO_MINIMA);
