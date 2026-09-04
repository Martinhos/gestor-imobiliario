// A documentação sai do próprio código.
//
// Cada ficheiro deste projeto abre com um comentário que explica o que ele
// é e porquê — a documentação já está escrita, só está espalhada. Este
// guião junta-a: percorre as fontes, extrai o comentário de abertura de
// cada uma, apanha os comandos do Discord e quem os pode correr, e escreve
// worker/src/docs-gerados.js — que o worker serve em /equipa/docs.
//
// Corre no deploy (a página nunca fica atrás do código) e o resultado vai
// no repositório, para o wrangler local e os testes terem sempre o módulo.
//
//   node scripts/gerar-docs.js

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8');

/* O comentário de abertura de um ficheiro, limpo de sintaxe: o bloco
   inicial nos .js, as linhas -- nos .sql, as linhas # nos .yml. */
function cabecalho(src, tipo) {
  if (tipo === 'sql' || tipo === 'yml') {
    const marca = tipo === 'sql' ? '--' : '#';
    const linhas = [];
    for (const l of src.split('\n')) {
      const t = l.trim();
      if (t.startsWith(marca)) linhas.push(t.slice(marca.length).replace(/^ /, ''));
      else if (t === '' && linhas.length) linhas.push('');
      else if (t === '' || (tipo === 'yml' && /^name:/.test(t))) continue;
      else break;
    }
    return linhas.join('\n').trim();
  }
  const bloco = src.match(/^\s*\/\*([\s\S]*?)\*\//);
  if (bloco) {
    return bloco[1].split('\n')
      .map((l) => l.replace(/^\s*\*? ?/, ''))
      .join('\n')
      .replace(/^-{3,}\s*$/gm, '')
      .trim();
  }
  const linhas = [];
  for (const l of src.split('\n')) {
    const t = l.trim();
    if (t.startsWith('//')) linhas.push(t.replace(/^\/\/ ?/, ''));
    else if (t === '' && linhas.length) linhas.push('');
    else if (t === '') continue;
    else break;
  }
  return linhas.join('\n').trim();
}

function capitulo(titulo, nota, pasta, filtro, tipo) {
  const itens = readdirSync(new URL(pasta, raiz))
    .filter((f) => filtro.test(f))
    .sort()
    .map((f) => ({ nome: f, texto: cabecalho(ler(pasta + f), tipo || 'js') }))
    .filter((x) => x.texto);
  return { titulo, nota, itens };
}

/* Os comandos do bot, lidos do registo: as entradas de topo do array
   `comandos` vivem com dois espaços de indentação — as opções, mais fundo.
   Se a formatação mudar, o teste dos docs rebenta e avisa. */
function comandosDoDiscord() {
  const src = ler('scripts/discord-register.js');
  const dentro = src.slice(src.indexOf('const comandos = ['));
  const achados = [];
  const re = /\n  (?:Object\.assign\()?\{\s*\n?\s*name: '([a-z-]+)',\s*\n?\s*description: '([^']+)'/g;
  let m;
  while ((m = re.exec(dentro))) achados.push({ nome: m[1], descricao: m[2] });
  return achados;
}

/* Quem pode correr o quê, lido das PERMISSOES do worker. */
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

const quem = permissoes();
const DOCS = {
  geradoEm: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'local',
  comandos: comandosDoDiscord().map((c) => ({
    ...c,
    quem: c.nome in quem
      ? (quem[c.nome].length ? quem[c.nome].join(', ') + ' (e master)' : 'só o master')
      : 'todos os papéis',
  })),
  capitulos: [
    capitulo('O worker', 'O servidor: API, Discord, correio, landing e o ambiente de teste.',
      'worker/src/', /\.js$/),
    capitulo('As bibliotecas do worker', 'As peças partilhadas: acesso, auditoria, correio, planos.',
      'worker/src/lib/', /\.js$/),
    capitulo('As rotas da API', 'Cada grupo de rotas com sessão, um ficheiro.',
      'worker/src/rotas/', /\.js$/),
    capitulo('O cliente — nuvem', 'Sessão, sincronização, filtros e ajuda.',
      'web/cloud/', /\.js$/),
    capitulo('O cliente — aplicação', 'Os ecrãs e componentes da app em si.',
      'web/app/', /\.js$/),
    capitulo('As migrações', 'A história do esquema da base, uma decisão de cada vez.',
      'migrations/', /\.sql$/, 'sql'),
    capitulo('Os workflows', 'O que o CI faz por nós: testes, deploy, comandos, limpeza.',
      '.github/workflows/', /\.yml$/, 'yml'),
  ],
};

writeFileSync(new URL('worker/src/docs-gerados.js', raiz),
  '// GERADO por scripts/gerar-docs.js — não editar à mão; corre no deploy.\n' +
  'export const DOCS = ' + JSON.stringify(DOCS, null, 1) + ';\n');

const total = DOCS.capitulos.reduce((n, c) => n + c.itens.length, 0);
console.log('docs: ' + total + ' ficheiros documentados, ' + DOCS.comandos.length + ' comandos.');
if (total < 20 || DOCS.comandos.length < 8) {
  console.error('Poucos: ou o código perdeu os cabeçalhos, ou o extrator partiu.');
  process.exit(1);
}
