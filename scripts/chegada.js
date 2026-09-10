// Confirma que uma publicação chega a quem já tem a app instalada.
//
//   node scripts/chegada.js <ref>   compara o que está aqui com o que estava em <ref>
//
// A cache offline chama-se pela VERSÃO da app (web/sw.js). Publicar sem subir a
// versão é publicar para ninguém: quem tem a app instalada continua a ser
// servido da cache que já tem, e a app nunca lhe pergunta nada, porque o
// /versao.json responde o mesmo número.
//
// E há coisa pior do que não chegar, que é chegar a meio. Com a versão na
// mesma, o `caches.open(CACHE)` do install do worker novo abre a MESMA cache
// que o worker antigo está a usar, e o `addAll` sobrepõe-lhe as entradas por
// baixo. Uma página que começou a carregar com os ficheiros velhos passa a
// receber os novos a meio do carregamento. É a avaria da v31, pela porta do
// lado.
//
// O sw.js protege-se disso sozinho (não enche uma cache que já tem conteúdo),
// mas isso deixa a publicação sem efeito nenhum, em silêncio. Este passo é o
// que a recusa antes de sair.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');

/* Os ficheiros cuja mudança precisa de uma versão nova para chegar a alguém:
   os que a cache offline guarda, mais o próprio service worker. Saem da lista
   SHELL do web/sw.js, e não de uma segunda lista escrita à mão aqui — uma
   segunda lista era mais uma coisa para ficar para trás.
   Recebe: fonte (opcional) — o texto do sw.js, para os testes; sem ela lê o
   ficheiro do disco.
   Devolve: array de caminhos relativos à raiz do repositório, sem repetições. */
function ficheirosGuardados(fonte) {
  const sw = fonte || fs.readFileSync(path.join(raiz, 'web', 'sw.js'), 'utf8');
  const lista = (nome) => {
    const m = new RegExp('const ' + nome + ' = \\[([\\s\\S]*?)\\]').exec(sw);
    if (!m) throw new Error('não encontrei a lista ' + nome + ' em web/sw.js');
    return m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  };
  const caminhos = lista('SHELL')
    .concat(lista('APP').map((n) => '/app/' + n + '.js'))
    .concat(lista('NUVEM').map((n) => '/cloud/' + n + '.js'))
    .map((p) => (p === '/' ? '/index.html' : p))   // a raiz é servida pelo index.html
    .map((p) => 'web' + p)
    .concat(['web/sw.js']);                        // o worker manda na cache, logo conta
  return Array.from(new Set(caminhos));
}

/* A decisão, sem git nem ficheiros pelo meio — é isto que os testes exercitam.
   Recebe: tocados — caminhos que mudaram, já filtrados aos que a cache guarda;
   antes, agora — números de versão da publicação anterior e desta.
   Devolve: {ok, motivo} — ok false trava a publicação. */
function decidir(tocados, antes, agora) {
  if (agora < antes) {
    return { ok: false, motivo: 'a versão DESCEU, de ' + antes + ' para ' + agora + '.' };
  }
  if (!tocados.length) {
    return { ok: true, motivo: 'nada do que a cache guarda mudou desde a publicação anterior.' };
  }
  if (agora > antes) {
    return { ok: true, motivo: tocados.length + ' ficheiro(s) da cache mudaram, e a versão sobe de ' +
      antes + ' para ' + agora + '.' };
  }
  return {
    ok: false,
    motivo: 'mudaram ' + tocados.length + ' ficheiro(s) que a cache offline guarda, e a versão ' +
      'continua na ' + agora + '. Quem tem a app instalada não recebe nada disto — a cache tem o ' +
      'nome da versão, e a app pergunta pelo número.\n\n' +
      tocados.map((f) => '  · ' + f).join('\n') +
      '\n\nAcrescenta uma entrada em web/avisos.js e corre: node scripts/versao.js',
  };
}

if (require.main === module) {
  const ref = process.argv[2];
  if (!ref) {
    console.error('uso: node scripts/chegada.js <ref>   (ref = a publicação anterior)');
    process.exit(2);
  }
  const git = (...args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8' });
  const versaoEm = (texto) => Number(JSON.parse(texto).versao);

  let antes;
  try {
    antes = versaoEm(git('show', ref + ':web/versao.json'));
  } catch (e) {
    // primeira publicação, histórico raso, ou um ref que não existe: não há
    // com o que comparar, e travar aqui seria travar por não saber
    console.log('sem publicação anterior em ' + ref + ' — nada a comparar.');
    process.exit(0);
  }
  const agora = versaoEm(fs.readFileSync(path.join(raiz, 'web', 'versao.json'), 'utf8'));

  const tocados = git('diff', '--name-only', ref, 'HEAD', '--', ...ficheirosGuardados())
    .split('\n').map((s) => s.trim()).filter(Boolean);

  const r = decidir(tocados, antes, agora);
  console.log((r.ok ? 'chega: ' : 'NÃO CHEGA: ') + r.motivo);
  process.exit(r.ok ? 0 : 1);
}

module.exports = { ficheirosGuardados, decidir };
