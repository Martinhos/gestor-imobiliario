/* Dá as capturas do percurso a ler a um modelo, e pede-lhe um juízo.
   ------------------------------------------------------------------
     node testes/ui/avaliar.js            avalia o que está em relatorio/
     node testes/ui/avaliar.js --exigente falha o processo em problemas graves

   Porquê um modelo e não mais asserções: a estabilidade cabe numa regra
   ("nada transborda"), a qualidade não. Se a hierarquia se lê, se um número
   negativo se percebe à primeira, se o texto de um botão diz o que o botão
   faz — isso é juízo, e é aí que um modelo acrescenta o que um teste não
   consegue.

   O que ele diz NÃO passa a ser um teste que falha por gosto. Por omissão
   escreve um parecer e devolve 0; só com --exigente é que problemas graves
   falham o processo. Um interface não deve ficar refém da opinião de uma
   máquina num dia mau.

   Sem ANTHROPIC_API_KEY, não faz nada e devolve 0 — para o CI de quem não
   tenha chave continuar verde. */

const fs = require('fs');
const path = require('path');

const SAIDA = path.join(__dirname, 'relatorio');
const CHAVE = process.env.ANTHROPIC_API_KEY;
const EXIGENTE = process.argv.includes('--exigente');
const MODELO = process.env.MODELO_AVALIACAO || 'claude-sonnet-5';

if (!CHAVE) {
  console.log('Sem ANTHROPIC_API_KEY — avaliação por modelo ignorada.');
  console.log('(os invariantes do percorrer.js correm à mesma e são esses que travam o CI)');
  process.exit(0);
}
if (!fs.existsSync(path.join(SAIDA, 'resumo.json'))) {
  console.error('Não há relatório. Corre primeiro: node testes/ui/percorrer.js');
  process.exit(1);
}

const resumo = JSON.parse(fs.readFileSync(path.join(SAIDA, 'resumo.json'), 'utf8'));

/* Uma imagem por estado seria caro e repetitivo. Escolhem-se os estados que
   mais dizem sobre o interface, num ecrã de cada — o telemóvel é onde aperta. */
const ESCOLHA = [
  'telemovel__vista-dashboard',
  'telemovel__vista-properties',
  'telemovel__vista-transactions',
  'telemovel__modal-movimento',
  'telemovel__menu-no-fundo-do-modal',
  'telemovel__novidades',
  'telemovel-deitado__vista-dashboard',
  'computador__vista-dashboard',
  'computador__vista-contracts',
  'computador__modal-imovel',
];

const RUBRICA = `És um avaliador de interfaces. Vais ver capturas de uma app de
gestão de imóveis, em português de Portugal, para senhorios com dezenas de casas.

Avalia SÓ o que se vê. Não inventes o que possa estar fora do enquadramento.

Para cada captura, considera:
- Hierarquia: percebe-se o que é mais importante sem ler tudo?
- Densidade: há informação a mais ou espaço desperdiçado?
- Números: percebe-se à primeira o que é receita e o que é despesa? Um valor
  negativo lê-se como negativo?
- Texto: os rótulos dizem o que a coisa faz? Há jargão desnecessário? Há erros
  de português ou texto cortado a meio?
- Alinhamento e ritmo: há coisas desalinhadas, margens inconsistentes,
  elementos colados às bordas?
- Contraste: lê-se tudo confortavelmente?
- Toque: os botões parecem fáceis de acertar num telemóvel?

Responde em português de Portugal, em Markdown, com esta forma exata:

## Veredito
Uma frase. Depois, numa linha à parte: **Nota: N/10**

## Problemas graves
Coisas que impedem alguém de usar ou de perceber. Se não houver, escreve "Nenhum."
Cada um numa linha, com o nome da captura entre parênteses.

## A melhorar
No máximo seis, por ordem de importância, cada um numa linha com a captura.

## O que está bem
No máximo quatro.

Sê concreto e exigente. "Podia estar melhor" não serve; diz o quê e onde.
Não elogies por elogiar — quem lê isto quer saber o que corrigir.`;

async function avaliar() {
  const imagens = ESCOLHA
    .map((n) => ({ nome: n, ficheiro: path.join(SAIDA, n + '.png') }))
    .filter((x) => fs.existsSync(x.ficheiro));

  if (!imagens.length) {
    console.error('Nenhuma das capturas escolhidas existe em ' + SAIDA);
    process.exit(1);
  }

  const conteudo = [];
  imagens.forEach((im) => {
    conteudo.push({ type: 'text', text: 'Captura: ' + im.nome });
    conteudo.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: fs.readFileSync(im.ficheiro).toString('base64') },
    });
  });
  conteudo.push({
    type: 'text',
    text: 'Medidas do percurso (para contexto, não para repetires):\n' +
      JSON.stringify({ estados: resumo.estados, falhas: resumo.falhas.length }, null, 1),
  });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': CHAVE,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 2000,
      system: RUBRICA,
      messages: [{ role: 'user', content: conteudo }],
    }),
  });

  if (!r.ok) {
    console.error('A API respondeu ' + r.status + ': ' + (await r.text()).slice(0, 300));
    process.exit(1);
  }
  const j = await r.json();
  const texto = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');

  const destino = path.join(SAIDA, 'avaliacao.md');
  fs.writeFileSync(destino,
    '# Avaliação do interface\n\n' +
    '_' + imagens.length + ' capturas · modelo ' + MODELO + '_\n\n' + texto + '\n');
  console.log(texto);
  console.log('\nescrito em ' + path.relative(process.cwd(), destino));

  const nota = Number((texto.match(/Nota:\s*(\d+(?:[.,]\d+)?)\s*\/\s*10/i) || [])[1]);
  const graves = /##\s*Problemas graves\s*\n+(?!Nenhum)/i.test(texto);
  if (EXIGENTE && (graves || (nota && nota < 6))) {
    console.error('\n--exigente: há problemas graves ou a nota é menor que 6.');
    process.exit(1);
  }
}

avaliar().catch((e) => { console.error(e); process.exit(1); });
