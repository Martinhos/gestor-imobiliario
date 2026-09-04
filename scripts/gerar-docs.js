// A documentação sai do próprio código.
//
// Para quem chega de novo ao projeto: cada ficheiro abre com um comentário
// que explica o que é, e as funções têm o seu comentário por cima. Este
// guião junta tudo por FUNCIONALIDADE (não por pasta): o cabeçalho de cada
// ficheiro, a assinatura de cada função com a documentação adjacente, os
// comandos do Discord com quem os pode correr, e as armadilhas conhecidas
// (docs/armadilhas.md). Escreve worker/src/docs-gerados.js, que o worker
// serve em /equipa/docs — com gaveta de navegação e pesquisa.
//
// Corre no deploy (a página nunca fica atrás do código) e o resultado vai
// no repositório, para o wrangler local e os testes terem sempre o módulo.
//
//   node scripts/gerar-docs.js

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
// lê um ficheiro do repositório (caminho relativo à raiz) como UTF-8
// Recebe: p — caminho do ficheiro relativo à raiz do repositório (texto).
// Devolve: o conteúdo do ficheiro (texto UTF-8).
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8');

/* ------------------- o mapa das funcionalidades --------------------------
   Um ficheiro novo que não esteja aqui cai em «Outros» — e o teste dos
   docs rebenta quando «Outros» engorda, para o mapa não apodrecer. */
const MAPA = [
  { id: 'auth', titulo: 'Autenticação e conta',
    ficheiros: ['worker/src/auth.js', 'worker/src/oauth.js', 'worker/src/rotas/auth.js',
      'worker/src/rotas/conta.js', 'web/cloud/entrada.js'] },
  { id: 'sync', titulo: 'Sincronização e estado',
    ficheiros: ['worker/src/rotas/sync.js', 'worker/src/rotas/estado.js', 'web/cloud/nucleo.js',
      'web/app/dados.js', 'web/app/arranque.js', 'web/app/copias.js'] },
  { id: 'partilha', titulo: 'Casas, partilha e ligações',
    ficheiros: ['worker/src/rotas/casas.js', 'worker/src/rotas/conexoes.js', 'worker/src/lib/acesso.js',
      'web/cloud/partilha.js', 'web/cloud/utilizadores.js', 'web/app/splitwise.js'] },
  { id: 'imoveis', titulo: 'Imóveis, contratos e pessoas',
    ficheiros: ['web/app/imovel.js', 'web/app/contrato.js', 'web/app/contrato-pdf.js',
      'web/app/pessoas.js', 'web/app/avaliacao.js', 'web/app/prazos.js'] },
  { id: 'movimentos', titulo: 'Movimentos e seleção em massa',
    ficheiros: ['web/app/movimento.js', 'web/app/planeados.js', 'web/cloud/selecao.js',
      'web/cloud/selecao-listas.js'] },
  { id: 'creditos', titulo: 'Créditos à habitação',
    ficheiros: ['web/app/credito.js', 'web/app/creditos.js'] },
  { id: 'vistas', titulo: 'Métricas, gráficos e filtros',
    ficheiros: ['web/app/metricas.js', 'web/app/graficos.js', 'web/app/vistas.js',
      'web/cloud/painel.js', 'web/cloud/filtros.js'] },
  { id: 'ui', titulo: 'Componentes e navegação',
    ficheiros: ['web/app/componentes.js', 'web/app/navegacao.js', 'web/app/auxiliares.js',
      'web/app/definicoes.js', 'web/cloud/guia.js', 'web/cloud/novidades.js',
      'web/avisos.js', 'web/legal.js'] },
  { id: 'pedidos', titulo: 'Pedidos de ajuda e erros',
    ficheiros: ['worker/src/rotas/tickets.js', 'worker/src/rotas/relatos.js',
      'worker/src/lib/relatos.js', 'worker/src/notify.js', 'web/cloud/ajuda.js'] },
  { id: 'correio', titulo: 'Correio (Resend e Email Routing)',
    ficheiros: ['worker/src/lib/correio.js', 'worker/src/lib/enderecos.js'] },
  { id: 'discord', titulo: 'Discord (bot e papéis)',
    ficheiros: ['worker/src/discord.js', 'worker/src/acessos.js', 'scripts/discord-register.js',
      'scripts/discord-comandos.js'] },
  { id: 'equipa', titulo: 'Back office (/equipa)',
    ficheiros: ['worker/src/equipa.js', 'worker/src/equipa-api.js', 'worker/src/equipa-vista.js',
      'worker/src/docs-vista.js'] },
  { id: 'teste', titulo: 'Ambiente de teste (/test)',
    ficheiros: ['worker/src/teste.js'] },
  { id: 'planos', titulo: 'Limites e fim da demonstração',
    ficheiros: ['worker/src/lib/planos.js', 'worker/src/lib/limites.js'] },
  { id: 'anexos', titulo: 'Anexos e ficheiros',
    ficheiros: ['worker/src/files.js', 'worker/src/rotas/anexos.js', 'web/cloud/anexos.js', 'web/app/anexos.js'] },
  { id: 'infra', titulo: 'Infraestrutura',
    ficheiros: ['worker/src/index.js', 'worker/src/api.js', 'worker/src/landing.js',
      'worker/src/salvaguarda.js', 'worker/src/lib/http.js', 'worker/src/lib/auditoria.js',
      'web/sw.js', 'scripts/gerar-docs.js', 'scripts/make-icons.js', 'scripts/restaurar.js', 'scripts/versao.js'] },
];

/* ------------------------- extração ------------------------------------- */

// tira a decoração dos banners (===== TÍTULO =====) e a sintaxe de comentário
// Recebe: texto — o interior de um comentário (texto, pode ter várias linhas).
// Devolve: o texto limpo (sem asteriscos, decoração nem linhas em branco a mais).
function limpa(texto) {
  return texto.split('\n')
    .map((l) => l.replace(/^\s*\*? ?/, '').replace(/[=\-]{4,}/g, '').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// o comentário de abertura de um ficheiro (bloco /* */ ou série de //)
// Recebe: src — o código-fonte completo do ficheiro (texto).
// Devolve: o texto desse comentário, limpo; '' se não houver.
function cabecalho(src) {
  const bloco = src.match(/^\s*\/\*([\s\S]*?)\*\//);
  if (bloco) {
    const t = limpa(bloco[1]);
    // um banner sozinho (uma palavra em maiúsculas) não é documentação
    if (t && !/^[A-ZÁÉÍÓÚÇÀÂÊÔ ]{3,30}$/.test(t)) return t;
  }
  const linhas = [];
  for (const l of src.split('\n')) {
    const t = l.trim();
    if (t.startsWith('//')) linhas.push(t.replace(/^\/\/ ?/, ''));
    else if (t === '' && linhas.length) linhas.push('');
    else if (t === '' || t.startsWith('/*')) continue;
    else break;
  }
  return limpa(linhas.join('\n'));
}

/* As funções de um ficheiro: assinatura + o comentário imediatamente acima.
   Só as de topo (sem indentação, mais CW./window.) — as closures internas
   são detalhe de implementação, não interface. */
const FORMAS = [
  /^(?:export )?(?:async )?function (\w+)\s*\(/,
  /^const (\w+)\s*=\s*(?:async )?\(/,
  /^const (\w+)\s*=\s*(?:async )?function\s*\(/,
  /^(?:window\.|CW\.)(\w+)\s*=\s*(?:async )?function\s*\(/,
];

// percorre o ficheiro linha a linha e devolve [{nome, assinatura, doc}] por cada
// função de topo que case com uma das FORMAS; doc é o comentário adjacente acima
// Recebe: src — o código-fonte completo do ficheiro (texto).
// Devolve: array de {nome, assinatura, doc}, um por função de topo.
function funcoesDe(src) {
  const linhas = src.split('\n');
  const out = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    let nome = null;
    for (const re of FORMAS) {
      const m = l.match(re);
      if (m) { nome = m[1]; break; }
    }
    if (!nome) continue;

    // a assinatura: até fechar o parêntese (algumas destructuram por várias linhas)
    let ass = l;
    for (let j = i + 1; j < linhas.length && j < i + 4 && !ass.includes(')'); j++) ass += ' ' + linhas[j].trim();
    ass = ass.slice(0, ass.indexOf(')') + 1)
      .replace(/^(export |window\.|CW\.)/, '').replace(/^const /, '').replace(/\s*=\s*(async )?(function\s*)?/, ' ')
      .replace(/\s+/g, ' ').trim();

    // o comentário acima: um bloco /* */ ou linhas // contíguas
    let doc = '';
    if (i > 0 && linhas[i - 1].trim().endsWith('*/')) {
      for (let j = i - 1; j >= 0 && j > i - 40; j--) {
        if (/^\s*\/\*/.test(linhas[j])) {
          doc = limpa(linhas.slice(j, i).join('\n').replace(/\/\*|\*\//g, ''));
          break;
        }
      }
    } else {
      const seq = [];
      for (let j = i - 1; j >= 0 && linhas[j].trim().startsWith('//'); j--) {
        seq.unshift(linhas[j].trim().replace(/^\/\/ ?/, ''));
      }
      doc = limpa(seq.join('\n'));
    }
    out.push({ nome, assinatura: ass, doc });
  }
  return out;
}

// tudo o que os docs mostram de um ficheiro: o caminho, o cabeçalho e as funções
// Recebe: caminho — caminho do ficheiro relativo à raiz do repositório (texto).
// Devolve: {nome, texto, funcoes} — o caminho, o cabeçalho limpo e as funções extraídas.
function ficheiro(caminho) {
  const src = ler(caminho);
  return { nome: caminho, texto: cabecalho(src), funcoes: funcoesDe(src) };
}

/* Os comandos do bot, lidos do registo — nome, descrição E OPÇÕES, com um
   varrimento por profundidade de chavetas (não depende da formatação). O
   «o que acontece a seguir» vem do docs/comandos.md, mantido à mão: um
   comando registado sem secção lá rebenta o build. */
const TIPOS_DISCORD = { TEXTO: 'texto', INTEIRO: 'número', BOOLEANO: 'sim/não', UTILIZADOR: 'utilizador' };

// os comandos do bot, lidos do registo (o bloco acima explica como)
// Devolve: array de {nome, descricao, opcoes} por comando registado; cada opção
// traz {nome, tipo, obrigatoria, descricao, escolhas}.
function comandosDoDiscord() {
  const src = ler('scripts/discord-register.js');
  const ini = src.indexOf('[', src.indexOf('const comandos = ['));
  // separa as entradas de topo do array pela profundidade
  const entradas = [];
  let depth = 0, atual = '';
  for (let i = ini + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === ']' && depth === 0) break;
    if ('[{('.includes(ch)) depth++;
    if (']})'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { entradas.push(atual); atual = ''; continue; }
    atual += ch;
  }
  if (atual.trim()) entradas.push(atual);

  return entradas.map((e) => {
    const nome = (e.match(/name: '([a-z-]+)'/) || [])[1];
    const descricao = (e.match(/description: '([^']+)'/) || [])[1];
    if (!nome) return null;
    // as opções: pedaços entre marcadores «type:» dentro do bloco options
    const opcoes = [];
    const soOpts = e.slice(e.indexOf('options:'));
    const marcas = [...soOpts.matchAll(/type: \w+/g)].map((m) => m.index);
    marcas.forEach((pos, j) => {
      const pedaco = soOpts.slice(pos, marcas[j + 1] || soOpts.length);
      const o = pedaco.match(/type: (\w+), name: '(\w+)', description: '([^']+)'(?:, required: (true|false))?/);
      if (!o) return;
      opcoes.push({
        nome: o[2],
        tipo: TIPOS_DISCORD[o[1]] || o[1].toLowerCase(),
        obrigatoria: o[4] === 'true',
        descricao: o[3],
        escolhas: [...pedaco.matchAll(/\{ name: '([^']+)', value: '[^']+' \}/g)].map((m) => m[1]),
      });
    });
    return { nome, descricao, opcoes };
  }).filter(Boolean);
}

// o «o que acontece» de cada comando, do docs/comandos.md (secções por ## )
// Devolve: mapa {nomeDoComando: texto da secção}.
function guiaDosComandos() {
  const md = ler('docs/comandos.md');
  const guia = {};
  for (const p of md.split(/\n## /).slice(1)) {
    const [titulo, ...resto] = p.split('\n');
    guia[titulo.trim()] = resto.join('\n').trim();
  }
  return guia;
}

// o mapa PERMISSOES de worker/src/discord.js, lido do próprio código: comando → papéis que o podem correr
// Devolve: mapa {comando: [papéis]}; array vazio quer dizer só o master.
function permissoes() {
  const src = ler('worker/src/discord.js');
  const bloco = (src.match(/export const PERMISSOES = \{([\s\S]*?)\};/) || [])[1] || '';
  const mapa = {};
  const re = /(\w+): \[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(bloco))) {
    mapa[m[1]] = m[2].split(',').map((x) => x.replace(/['\s]/g, '')).filter(Boolean);
  }
  return mapa;
}

// as armadilhas: um markdown mantido à mão, secções por «## »
// Devolve: array de {nome, assinatura: '', doc}, uma entrada por secção do markdown.
function armadilhas() {
  const md = ler('docs/armadilhas.md');
  const partes = md.split(/\n## /).slice(1);
  return partes.map((p) => {
    const [titulo, ...resto] = p.split('\n');
    return { nome: titulo.trim(), assinatura: '', doc: resto.join('\n').trim() };
  });
}

/* ------------------------- montagem ------------------------------------- */

// varre as pastas de código e devolve todos os .js (menos o gerado),
// para se saber o que ainda não está arrumado no MAPA
// Devolve: array de caminhos relativos à raiz (texto), sem o docs-gerados.js.
function todosOsFicheiros() {
  const lista = [];
  const varre = (pasta, ext) => readdirSync(new URL(pasta, raiz))
    .filter((f) => f.endsWith(ext)).forEach((f) => lista.push(pasta + f));
  varre('worker/src/', '.js'); varre('worker/src/lib/', '.js'); varre('worker/src/rotas/', '.js');
  varre('web/', '.js'); varre('web/app/', '.js'); varre('web/cloud/', '.js');
  varre('scripts/', '.js');
  return lista.filter((f) => !f.endsWith('docs-gerados.js'));
}

const mapeados = new Set(MAPA.flatMap((c) => c.ficheiros));
const soltos = todosOsFicheiros().filter((f) => !mapeados.has(f) && existsSync(new URL(f, raiz)));

const quem = permissoes();
const capitulos = MAPA.map((c) => ({
  id: c.id,
  titulo: c.titulo,
  itens: c.ficheiros.filter((f) => existsSync(new URL(f, raiz))).map(ficheiro),
}));
if (soltos.length) {
  capitulos.push({ id: 'outros', titulo: 'Outros (por arrumar no mapa)', itens: soltos.map(ficheiro) });
}
capitulos.push({
  id: 'migracoes', titulo: 'Migrações da base',
  itens: readdirSync(new URL('migrations/', raiz)).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => {
      const src = ler('migrations/' + f);
      const texto = src.split('\n').filter((l) => l.startsWith('--'))
        .map((l) => l.replace(/^-- ?/, '')).join('\n').trim();
      return { nome: 'migrations/' + f, texto, funcoes: [] };
    }),
});
capitulos.push({
  id: 'armadilhas', titulo: 'Armadilhas conhecidas',
  itens: [{ nome: 'docs/armadilhas.md', texto: 'Coisas que já morderam alguém neste projeto. Cada uma custou uma tarde; ler isto custa cinco minutos.', funcoes: armadilhas() }],
});

const guia = guiaDosComandos();
const DOCS = {
  geradoEm: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'local',
  comandos: comandosDoDiscord().map((c) => ({
    ...c,
    quem: c.nome in quem
      ? (quem[c.nome].length ? quem[c.nome].join(', ') + ' (e master)' : 'só o master')
      : 'todos os papéis',
    oQueFaz: guia[c.nome] || '',
  })),
  capitulos,
};

const semGuia = DOCS.comandos.filter((c) => !c.oQueFaz).map((c) => c.nome);
if (semGuia.length) {
  console.error('Comandos sem secção no docs/comandos.md (escreve o que acontece): ' + semGuia.join(', '));
  process.exit(1);
}

writeFileSync(new URL('worker/src/docs-gerados.js', raiz),
  '// GERADO por scripts/gerar-docs.js — não editar à mão; corre no deploy.\n' +
  'export const DOCS = ' + JSON.stringify(DOCS) + ';\n');

const totalF = capitulos.reduce((n, c) => n + c.itens.length, 0);
const totalFn = capitulos.reduce((n, c) => n + c.itens.reduce((m, i) => m + (i.funcoes || []).length, 0), 0);
const semDoc = capitulos.flatMap((c) => c.itens.flatMap((i) =>
  (i.funcoes || []).filter((f) => !f.doc && f.assinatura).map((f) => i.nome + ' :: ' + f.nome)));
console.log('docs: ' + totalF + ' ficheiros, ' + totalFn + ' funções, ' + DOCS.comandos.length +
  ' comandos, ' + soltos.length + ' por arrumar, ' + semDoc.length + ' sem comentário.');
/* A regra da casa: não há funções sem comentário — e o comentário é um
   guia de interface: «Recebe:» quando a função tem parâmetros, «Devolve:»
   sempre. Uma função nova que falhe isto rebenta aqui, com o nome à vista. */
const semInterface = capitulos.flatMap((c) => c.itens.flatMap((i) =>
  (i.funcoes || []).filter((f) => {
    if (!f.assinatura || !f.doc) return false;
    const params = (f.assinatura.match(/\(([^)]*)\)/) || [])[1] || '';
    // um IIFE (const X = (function(){…})()) não tem parâmetros para receber
    const precisaRecebe = params.trim() !== '' && !params.trim().startsWith('function');
    return (precisaRecebe && !/recebe:/i.test(f.doc)) || !/devolve:/i.test(f.doc);
  }).map((f) => i.nome + ' :: ' + f.nome)));
console.log(semInterface.length + ' sem guia de interface (Recebe/Devolve).');
if (semInterface.length) {
  console.error('Sem guia de interface:\n  ' + semInterface.slice(0, 30).join('\n  ') +
    (semInterface.length > 30 ? '\n  … e mais ' + (semInterface.length - 30) : ''));
  process.exit(1);
}
if (semDoc.length) {
  console.error('Funções sem comentário (comenta-as antes de seguir):\n  ' + semDoc.join('\n  '));
  process.exit(1);
}
if (totalF < 40 || totalFn < 200 || DOCS.comandos.length < 8) {
  console.error('Poucos: ou o código perdeu os cabeçalhos, ou o extrator partiu.');
  process.exit(1);
}
if (soltos.length > 4) {
  console.error('O mapa das funcionalidades está a apodrecer: arruma os soltos no MAPA — ' + soltos.join(', '));
  process.exit(1);
}
