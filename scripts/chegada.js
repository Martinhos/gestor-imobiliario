// Confirma que uma publicação chega a quem já tem a app instalada.
//
//   node scripts/chegada.js <ref> [<ref> …]   compara o que está aqui com o que
//                                             estava no primeiro <ref> que exista
//
// O deploy chama-o com a etiqueta «publicado» e, atrás dela, o HEAD^1: a
// etiqueta é a publicação anterior por desenho (o deploy move-a quando uma
// publicação responde), o HEAD^1 só enquanto ela ainda não existe.
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

/* Compara esta árvore (HEAD) com a publicação anterior: o primeiro candidato
   que o git conheça e que tenha o web/versao.json. Tem de ser a publicação
   anterior por desenho — o HEAD^1 só o era quando a promoção é um merge, e
   num avanço rápido é o penúltimo commit do dev (testes/chegada.test.js monta
   o caso num repositório a sério).
   Recebe: refs — os candidatos, por ordem de preferência (array de texto);
   git — função (...args) que corre o git e devolve o stdout (lança em erro);
   guardados — os caminhos que contam (ficheirosGuardados()); agora — o número
   da versão desta árvore.
   Devolve: {ref, ok, motivo} — ref é o candidato usado, ou null se nenhum servia. */
function verificar(refs, git, guardados, agora) {
  for (const ref of refs) {
    let antes;
    try {
      antes = Number(JSON.parse(git('show', ref + ':web/versao.json')).versao);
    } catch (e) {
      continue;   // um ref que não existe (a etiqueta, antes da primeira vez): o seguinte
    }
    const tocados = git('diff', '--name-only', ref, 'HEAD', '--', ...guardados)
      .split('\n').map((s) => s.trim()).filter(Boolean);
    return Object.assign({ ref }, decidir(tocados, antes, agora));
  }
  // primeira publicação, histórico raso, ou nenhum ref que exista: não há
  // com o que comparar, e travar aqui seria travar por não saber
  return { ref: null, ok: true, motivo: 'sem publicação anterior em ' + refs.join(' nem ') + ' — nada a comparar.' };
}

if (require.main === module) {
  const refs = process.argv.slice(2);
  if (!refs.length) {
    console.error('uso: node scripts/chegada.js <ref> [<ref> …]   (a publicação anterior; vale o primeiro que exista)');
    process.exit(2);
  }
  // o stderr do git fica calado: um candidato que não existe é o caso normal da primeira vez
  const git = (...args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const agora = Number(JSON.parse(fs.readFileSync(path.join(raiz, 'web', 'versao.json'), 'utf8')).versao);

  const r = verificar(refs, git, ficheirosGuardados(), agora);
  console.log((r.ok ? 'chega: ' : 'NÃO CHEGA: ') + (r.ref ? '(contra ' + r.ref + ') ' : '') + r.motivo);
  process.exit(r.ok ? 0 : 1);
}

module.exports = { ficheirosGuardados, decidir, verificar };
