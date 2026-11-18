// Cria a versão das regras do IRS de um ano novo dos rendimentos.
//
//   node scripts/nova-versao-irs.js 2027
//
// Uma versão por ano (web/app/irs-AAAA.js, lida pelo irs.js). Este guião copia
// a mais recente para o ano pedido com o ano trocado, as datas da AT passadas
// para o ano certo, o modelo do Anexo F marcado como provisório, as novidades
// trocadas por uma frase verdadeira («ainda sem novidades confirmadas») e a
// data da revisão e o IAS em branco (são do ano, e ninguém os conferiu), e
// regista o ficheiro onde a app e os testes o procuram: o index.html, a SHELL
// do sw.js, o MODULOS e a BASE do arnês e o MAPA dos docs. As taxas, os
// quadros e os passos ficam os do ano anterior até alguém os confirmar com as
// fontes — o fim do guião diz o quê e onde. Não apaga nem reescreve versões
// que já existem.
//
// Só mudam as datas que são do ano dos rendimentos (a entrega e o 15 de
// fevereiro). As outras são da lei e copiam-se como estão: o `desde` e o
// `celebradoAte` das isenções (o PAA só até 31/08/2026), os regimes da
// duração, os intervalos da portaria do n.º 23 (`limiteRendaAlta.portaria`),
// o `ateAno` do ex-alojamento local. E os passos não podem ter anos escritos
// (dizem {ano} e {ate}): se a versão de onde se copia os tiver, o guião pára.

const fs = require('fs');
const path = require('path');

/* Os anos que já têm versão, do mais antigo ao mais recente.
   Recebe: raiz — a raiz do repositório.
   Devolve: array de números. */
function anosExistentes(raiz) {
  return fs.readdirSync(path.join(raiz, 'web', 'app')).map((n) => /^irs-(\d{4})\.js$/.exec(n))
    .filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
}

/* Troca uma vez, e rebenta se não houver o que trocar: um guião que copia sem
   mudar o ano deixava uma versão com o nome de um ano e as regras de outro.
   Recebe: texto; procura — a expressão; por — o texto ou a função de troca; o que — para o erro.
   Devolve: o texto trocado. */
function trocar(texto, procura, por, oque) {
  if (!procura.test(texto)) throw new Error('nova-versao-irs: não encontrei ' + oque);
  return texto.replace(procura, por);
}

/* Os anos escritos nos passos do guia de uma versão. Os passos dizem {ano} e
   {ate}, para a cópia não arrastar o ano de onde veio.
   Recebe: texto — o irs-AAAA.js.
   Devolve: array com os anos (texto) encontrados nos passos; vazio se não há. */
function anosNosPassos(texto) {
  const i = texto.indexOf('passos:[');
  if (i < 0) return [];
  return texto.slice(i).match(/\b(?:19|20)\d{2}\b/g) || [];
}

/* O texto da versão nova a partir da anterior: o cabeçalho, o ano, a entrega e
   a comunicação de fevereiro passadas para o ano novo, o modelo provisório, as
   novidades por confirmar, e a data da revisão e o IAS em branco. O resto
   (as datas da lei incluídas) fica igual.
   Recebe: texto — o irs-<de>.js; de — o ano da anterior; para — o ano novo.
   Devolve: o texto do irs-<para>.js; rebenta se os passos tiverem anos escritos. */
function textoNovo(texto, de, para) {
  const anos = anosNosPassos(texto);
  if (anos.length) throw new Error('nova-versao-irs: os passos do irs-' + de + '.js escrevem anos (' + anos.join(', ') + '): troca-os por {ano} ou por uma frase sem ano antes de copiar');
  const d = para - de, mv = (s) => (Number(s.slice(0, 4)) + d) + s.slice(4);
  let t = trocar(texto, /^\/\*[\s\S]*?\*\/\r?\n/, `/* ================= IRS ${para} =================
   As regras dos rendimentos de ${para}: a declaração que se entrega em ${para + 1}.
   O formato é o do irs-2025.js.

   Nasceu de uma cópia da versão de ${de} (scripts/nova-versao-irs.js). Até
   alguém a rever com a Lei do Orçamento do Estado para ${para}, a portaria que
   aprova o Modelo 3 destes rendimentos e o ofício-circulado da AT, as taxas,
   os quadros e os passos são os de ${de} — e o modelo é provisório. A data da
   revisão (revisto) e o IAS (ias) ficam em branco até alguém os confirmar.
   Quem a rever escreve aqui as fontes, com a data, como nas versões
   anteriores. */
`, 'o cabeçalho');
  t = trocar(t, new RegExp('ano:' + de + ','), 'ano:' + para + ',', 'o ano');
  t = trocar(t, /\brevisto:'(?:\d{4}-\d{2}-\d{2})?'/, "revisto:''", 'a data da revisão');
  t = trocar(t, /\bias:(?:\d+(?:\.\d+)?|null)/, 'ias:null', 'o IAS');
  t = trocar(t, /entrega:\{de:'(\d{4}-\d{2}-\d{2})',ate:'(\d{4}-\d{2}-\d{2})'\}/, (m, a, b) => `entrega:{de:'${mv(a)}',ate:'${mv(b)}'}`, 'a entrega');
  t = trocar(t, /comunicacaoDuracao:'(\d{4}-\d{2}-\d{2})'/, (m, a) => `comunicacaoDuracao:'${mv(a)}'`, 'a comunicação de fevereiro');
  t = trocar(t, /modelo:\{oficial:(?:true|false),\s*texto:'[^']*'\}/, `modelo:{oficial:false,
    texto:'Ainda não há Anexo F aprovado para os rendimentos de ${para} — a portaria costuma sair entre fevereiro e março do ano da entrega. Até lá esta página segue os quadros do modelo de ${de}.'}`, 'o modelo');
  t = trocar(t, /novidades:\[[\s\S]*?\],\r?\n {2}passos:/, `novidades:[
    'Ainda sem novidades confirmadas para ${para}: valem as regras de ${de} até o Orçamento do Estado e a portaria do Modelo 3 dizerem outra coisa.'],
  passos:`, 'as novidades');
  return t;
}

/* Acrescenta o ano novo a seguir ao último em cada lista onde as versões se
   registam. Cada lista tem de mudar o número certo de vezes.
   Recebe: raiz — a raiz do repositório; ult — o último ano com versão; para — o ano novo.
   Devolve: nada — escreve os quatro ficheiros. */
function registar(raiz, ult, para) {
  const muda = (rel, de, por, vezes) => {
    const f = path.join(raiz, rel), txt = fs.readFileSync(f, 'utf8');
    const n = txt.split(de).length - 1;
    if (n !== vezes) throw new Error('nova-versao-irs: ' + rel + ' tem ' + n + ' vezes «' + de + '», esperava ' + vezes);
    fs.writeFileSync(f, txt.split(de).join(por), 'utf8');
  };
  const tag = (a) => '<script src="app/irs-' + a + '.js"></script>';
  const fim = /\r\n/.test(fs.readFileSync(path.join(raiz, 'web', 'index.html'), 'utf8')) ? '\r\n' : '\n';
  muda('web/index.html', tag(ult), tag(ult) + fim + tag(para), 1);
  muda('web/sw.js', "'irs-" + ult + "',", "'irs-" + ult + "', 'irs-" + para + "',", 1);
  muda('testes/arnes.js', "'irs-" + ult + "',", "'irs-" + ult + "', 'irs-" + para + "',", 2);
  muda('scripts/gerar-docs.js', "'web/app/irs-" + ult + ".js',", "'web/app/irs-" + ult + ".js', 'web/app/irs-" + para + ".js',", 1);
}

/* Cria a versão de um ano: confere que é um ano novo, escreve o ficheiro e
   regista-o.
   Recebe: raiz — a raiz do repositório; para — o ano dos rendimentos novo.
   Devolve: {de, ficheiro} — o ano de onde se copiou e o caminho criado. */
function criarVersao(raiz, para) {
  const anos = anosExistentes(raiz), ult = anos[anos.length - 1];
  if (!Number.isInteger(para) || para < 2000 || para > 2200) throw new Error('nova-versao-irs: o ano tem de ser um número, ex.: 2027');
  if (anos.includes(para)) throw new Error('nova-versao-irs: já existe web/app/irs-' + para + '.js');
  if (!(para > ult)) throw new Error('nova-versao-irs: só se cria um ano depois do último (' + ult + ')');
  const de = ult, ficheiro = path.join(raiz, 'web', 'app', 'irs-' + para + '.js');
  const novo = textoNovo(fs.readFileSync(path.join(raiz, 'web', 'app', 'irs-' + de + '.js'), 'utf8'), de, para);
  registar(raiz, ult, para);
  fs.writeFileSync(ficheiro, novo, 'utf8');
  return { de, ficheiro };
}

module.exports = { anosExistentes, anosNosPassos, textoNovo, criarVersao };

if (require.main === module) {
  const para = Number(process.argv[2]);
  try {
    const r = criarVersao(path.join(__dirname, '..'), para);
    console.log('Criada ' + path.relative(path.join(__dirname, '..'), r.ficheiro) + ' a partir da de ' + r.de + ', e registada no index.html, no sw.js, no arnês e no MAPA.');
    console.log('\nAntes de publicar, rever com as fontes (e escrevê-las no cabeçalho, com a data):');
    console.log('  1. A Lei do Orçamento do Estado para ' + para + ' e os decretos do ano: o art. 72.º do CIRS (taxas e reduções),');
    console.log('     o art. 41.º (gastos), o art. 45.º-C do EBF (rendas moderadas, até 2029) e os limites — mudar `taxas`');
    console.log('     (com os n.os 23 e 24 do art. 72.º: `limiteRendaAlta`, com a portaria dos limites em `portaria`, e');
    console.log('     `bonusRendaMenor`) e as `isencoes` (6D: PAA, RSAA e programas municipais — os códigos, as condições');
    console.log('     `desde`/`celebradoAte`/`ateAno`/`pede`/`pedeIhru` e o prazo do IHRU; 6F e 6H), e o `englobamento` (os');
    console.log('     escalões do art. 68.º e a solidariedade do 68.º-A, que o OE muda quase todos os anos).');
    console.log('  2. A portaria que aprova o Modelo 3 dos rendimentos de ' + para + ' (fev/mar de ' + (para + 1) + ') e o ofício-circulado da AT:');
    console.log('     quadros, colunas e códigos (`quadros`, `colunas`, `colunasNomes`, `naturezas`, `naturezasTexto`, `quadro5`,');
    console.log('     `quadro10` — os regimes e os motivos; `quadro43` — as colunas, as naturezas e os motivos do DHD, com o');
    console.log('     `taxas.dhd`; `anexoJ` — o quadro e o código dos imóveis fora de Portugal; `quadros.campos` — o primeiro campo');
    console.log('     de cada quadro de linhas). Quando sair: `modelo.oficial = true` e o texto.');
    console.log('     E os `beneficios` (6A, 6B, 6C): o `vigenteAte` do 6C (o OE prorrogou-o?), a vigência do 6B (EBF 59.º-I) e a');
    console.log('     doutrina do 6A (a PIV da AT em vigor sobre a data de compra).');
    console.log('  3. O IAS de ' + para + ' (`ias`, a portaria do IAS sai em dezembro/janeiro) e, no fim, `revisto` com a data da revisão.');
    console.log('  4. As `novidades`: trocar a frase provisória pelo que mudou, em frases para quem declara.');
    console.log('  5. Os `passos`: os factos com número (escalões, limites) e o que o modelo novo mudou — sem anos escritos.');
    console.log('  6. node --test testes/irs-anos.test.js testes/irs-versoes-quadros.test.js, a bateria inteira e uma entrada nas');
    console.log('     novidades da app (web/avisos.js).');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
