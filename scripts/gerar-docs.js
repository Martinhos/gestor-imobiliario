// A documentação sai do próprio código.
//
// Para quem chega de novo ao projeto: cada ficheiro abre com um comentário
// que explica o que é, e as funções têm o seu comentário por cima. Este
// guião junta tudo por FUNCIONALIDADE (não por pasta): o cabeçalho de cada
// ficheiro, a assinatura de cada função com a documentação adjacente, os
// comandos do Discord com quem os pode correr, as regras de design
// (docs/design.md), o diário das decisões (docs/decisoes.md) e as
// armadilhas conhecidas (docs/armadilhas.md).
// Escreve worker/src/docs-gerados.js, que o worker
// serve em /equipa/docs — com gaveta de navegação e pesquisa.
//
// O resultado NÃO vai no repositório (.gitignore): era um diff de centenas de
// KB a cada corrida dos testes, e a cópia versionada nunca foi a autoridade.
// Gera-se onde é lido — o wrangler não arranca sem ele: no deploy (a página
// nunca fica atrás do código), no `npm install`/`npm ci` (o prepare do
// package.json), no `npm run dev` (o predev) e no teste dos docs, antes de o ler.
//
//   node scripts/gerar-docs.js

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const raiz = new URL('../', import.meta.url);
const exigir = createRequire(import.meta.url);
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
    ficheiros: ['worker/src/rotas/sync.js', 'worker/src/rotas/estado.js', 'worker/src/lib/escritas.js', 'web/cloud/nucleo.js',
      'web/app/dados.js', 'web/app/espera.js', 'web/app/arranque.js', 'web/app/copias.js'] },
  { id: 'partilha', titulo: 'Casas, partilha e ligações',
    ficheiros: ['worker/src/rotas/casas.js', 'worker/src/rotas/conexoes.js', 'worker/src/lib/acesso.js',
      'worker/src/lib/permissoes.js', 'worker/src/rotas/colaboradores.js', 'web/app/acessos.js',
      'web/cloud/colaboradores.js',
      'web/cloud/partilha.js', 'web/cloud/utilizadores.js', 'web/app/saldos.js', 'web/app/splitwise.js'] },
  { id: 'servicos', titulo: 'A app em serviços',
    ficheiros: ['web/app/servicos.js', 'worker/src/lib/servicos.js'] },
  { id: 'imoveis', titulo: 'Imóveis, contratos e pessoas',
    ficheiros: ['web/app/registos.js', 'web/app/lista-imoveis.js', 'web/app/imovel.js', 'web/app/lista-contratos.js', 'web/app/contrato.js', 'web/app/contrato-pdf.js',
      'web/app/lista-pessoas.js', 'web/app/pessoas.js', 'web/app/lista-colaboradores.js', 'web/app/avaliacao.js', 'web/app/prazos.js',
      'web/app/visitas.js', 'web/app/calendario.js'] },
  { id: 'movimentos', titulo: 'Movimentos e seleção em massa',
    ficheiros: ['web/app/tipos.js', 'web/app/lista-movimentos.js', 'web/app/movimento.js', 'web/app/planeados.js', 'web/cloud/selecao.js',
      'web/cloud/selecao-listas.js'] },
  { id: 'creditos', titulo: 'Créditos à habitação',
    ficheiros: ['web/app/credito.js', 'web/app/creditos.js'] },
  { id: 'notif', titulo: 'Notificações e sino',
    ficheiros: ['web/app/notificacoes.js'] },
  { id: 'vistas', titulo: 'Métricas, gráficos e filtros',
    ficheiros: ['web/app/metricas.js', 'web/app/graficos.js', 'web/app/lista.js', 'web/app/continuidade.js', 'web/app/ambito.js', 'web/app/vistas.js',
      'web/app/painel-geral.js', 'web/app/projecoes.js', 'web/cloud/painel.js', 'web/cloud/filtros.js'] },
  { id: 'ui', titulo: 'Componentes e navegação',
    ficheiros: ['web/app/componentes.js', 'web/app/navegacao.js', 'web/app/formato.js', 'web/app/icones.js', 'web/app/tema.js',
      'web/app/definicoes.js', 'web/cloud/guia.js', 'web/cloud/novidades.js',
      'web/avisos.js', 'web/legal.js', 'web/app/eventos.js', 'web/app/estilos-calculados.js'] },
  { id: 'pedidos', titulo: 'Pedidos de ajuda e erros',
    ficheiros: ['worker/src/rotas/tickets.js', 'worker/src/rotas/relatos.js',
      'worker/src/lib/relatos.js', 'worker/src/lib/medidas.js', 'worker/src/notify.js', 'web/cloud/ajuda.js'] },
  { id: 'correio', titulo: 'Correio (Resend e Email Routing)',
    ficheiros: ['worker/src/lib/correio.js', 'worker/src/lib/enderecos.js'] },
  { id: 'discord', titulo: 'Discord (bot e papéis)',
    ficheiros: ['worker/src/discord.js', 'worker/src/lib/papeis.js', 'worker/src/lib/bot.js', 'worker/src/acessos.js', 'scripts/discord-register.js',
      'scripts/discord-comandos-lista.js', 'scripts/discord-comandos.js'] },
  { id: 'equipa', titulo: 'Back office (/equipa)',
    ficheiros: ['worker/src/equipa.js', 'worker/src/equipa-api.js', 'worker/src/equipa-vista.js',
      'worker/src/equipa-guiao.js', 'worker/src/docs-vista.js'] },
  { id: 'teste', titulo: 'Ambiente de teste (/test)',
    ficheiros: ['worker/src/teste.js'] },
  { id: 'limites', titulo: 'Travões contra abuso',
    ficheiros: ['worker/src/lib/limites.js'] },
  { id: 'anexos', titulo: 'Anexos e ficheiros',
    ficheiros: ['worker/src/files.js', 'worker/src/rotas/anexos.js', 'web/cloud/anexos.js', 'web/app/anexos.js'] },
  { id: 'fisco', titulo: 'Declaração e IRS',
    ficheiros: ['web/app/irs.js', 'web/app/fisco.js'] },
  { id: 'infra', titulo: 'Infraestrutura',
    ficheiros: ['worker/src/index.js', 'worker/src/api.js', 'worker/src/landing.js',
      'worker/src/legal-vista.js', 'worker/src/paginas-recursos.js',
      'worker/src/salvaguarda.js', 'worker/src/lib/http.js', 'worker/src/lib/auditoria.js',
      'worker/src/lib/identidade.js',
      'web/sw.js', 'scripts/gerar-docs.js', 'scripts/make-icons.js', 'scripts/restaurar.js', 'scripts/versao.js',
      'scripts/capturas.js', 'scripts/chegada.js', 'scripts/entrega.js'] },
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
   são detalhe de implementação, não interface. As formas são as que o código
   escreve: function (com export e async), const x = (…) e const x = function
   (com export ou sem), window./CW. x = function, e a de um parâmetro sem
   parênteses, const x = y => — que a base usa às dezenas (formato.js) e que,
   por não estar aqui, escapava à regra dos comentários sem ninguém dar por
   isso; o mesmo às export const x = (…) do worker. */
const FORMAS = [
  /^(?:export )?(?:async )?function (\w+)\s*\(/,
  /^(?:export )?const (\w+)\s*=\s*(?:async )?\(/,
  /^(?:export )?const (\w+)\s*=\s*(?:async )?function\s*\(/,
  /^(?:window\.|CW\.)(\w+)\s*=\s*(?:async )?function\s*\(/,
];
// a de um parâmetro sem parênteses, à parte: não há «)» onde a assinatura acabe
const FORMA_SEM_PARENTESES = /^(?:export )?const (\w+)\s*=\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/;

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
    const semParenteses = nome ? null : l.match(FORMA_SEM_PARENTESES);
    if (semParenteses) nome = semParenteses[1];
    if (!nome) continue;

    // a assinatura: até fechar o parêntese (algumas destructuram por várias linhas);
    // na forma sem parênteses é o nome e o parâmetro, escritos como as outras
    let ass = l;
    if (semParenteses) ass = nome + ' (' + semParenteses[2] + ')';
    else {
      for (let j = i + 1; j < linhas.length && j < i + 4 && !ass.includes(')'); j++) ass += ' ' + linhas[j].trim();
      ass = ass.slice(0, ass.indexOf(')') + 1)
        .replace(/^(export |window\.|CW\.)/, '').replace(/^const /, '').replace(/\s*=\s*(async )?(function\s*)?/, ' ')
        .replace(/\s+/g, ' ').trim();
    }

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

/* Os comandos do bot, lidos como DADOS do módulo que o registo também usa
   (scripts/discord-comandos-lista.js): nome, descrição e opções, na forma que
   o Discord recebe — sem expressões regulares sobre código, portanto a forma
   de escrever uma opção (numa linha ou em várias, por que ordem) não conta.
   O «o que acontece a seguir» vem do docs/comandos.md, mantido à mão: um
   comando registado sem secção lá rebenta o build. */
const TIPOS_DISCORD = { TEXTO: 'texto', INTEIRO: 'número', BOOLEANO: 'sim/não', UTILIZADOR: 'utilizador' };

// os comandos do bot, lidos da lista partilhada com o registo (o bloco acima explica como)
// Devolve: array de {nome, descricao, opcoes} por comando registado; cada opção
// traz {nome, tipo, obrigatoria, descricao, escolhas}.
function comandosDoDiscord() {
  const { comandos, TIPOS } = exigir('./discord-comandos-lista.js');
  // o número do Discord (3, 4…) → o nome que os docs mostram
  const nomeDoTipo = Object.fromEntries(Object.entries(TIPOS).map(([k, n]) => [n, TIPOS_DISCORD[k] || k.toLowerCase()]));
  return comandos.map((c) => ({
    nome: c.name,
    descricao: c.description,
    opcoes: (c.options || []).map((o) => ({
      nome: o.name,
      tipo: nomeDoTipo[o.type] || String(o.type),
      obrigatoria: o.required === true,
      descricao: o.description,
      escolhas: (o.choices || []).map((e) => e.name),
    })),
  }));
}

// o «o que acontece» de cada comando, do docs/comandos.md (secções por ## )
// Devolve: mapa {nomeDoComando: texto da secção}.
function guiaDosComandos() {
  const md = ler('docs/comandos.md').replace(/\r\n/g, '\n');
  const guia = {};
  for (const p of md.split(/\n## /).slice(1)) {
    const [titulo, ...resto] = p.split('\n');
    guia[titulo.trim()] = resto.join('\n').trim();
  }
  return guia;
}

// o mapa PERMISSOES de worker/src/lib/papeis.js, lido do próprio código: comando → papéis que o podem correr
// Devolve: mapa {comando: [papéis]}; array vazio quer dizer só o master.
function permissoes() {
  const src = ler('worker/src/lib/papeis.js');
  const bloco = (src.match(/export const PERMISSOES = \{([\s\S]*?)\};/) || [])[1] || '';
  const mapa = {};
  const re = /(\w+): \[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(bloco))) {
    mapa[m[1]] = m[2].split(',').map((x) => x.replace(/['\s]/g, '')).filter(Boolean);
  }
  return mapa;
}

// um markdown mantido à mão (as regras de design, o diário, as armadilhas), partido
// por «## »: cada secção vira uma entrada sem assinatura, que a vista pinta pelo nome
// Recebe: caminho — o ficheiro .md, relativo à raiz do repositório (texto).
// Devolve: array de {nome, assinatura: '', doc}, uma entrada por secção do markdown.
function seccoesMd(caminho) {
  const md = ler(caminho).replace(/\r\n/g, '\n');
  const partes = md.split(/\n## /).slice(1);
  return partes.map((p) => {
    const [titulo, ...resto] = p.split('\n');
    return { nome: titulo.trim(), assinatura: '', doc: resto.join('\n').trim() };
  });
}

// o primeiro parágrafo de um markdown depois do título: o que o ficheiro é
// Recebe: caminho — o ficheiro .md, relativo à raiz do repositório (texto).
// Devolve: esse parágrafo numa linha só (texto); '' se não houver.
function abertura(caminho) {
  const blocos = ler(caminho).replace(/\r\n/g, '\n').split(/\n\s*\n/)
    .map((b) => b.trim()).filter((b) => b && !b.startsWith('#'));
  return (blocos[0] || '').replace(/\s*\n\s*/g, ' ');
}

/* Os markdowns mantidos à mão, um capítulo cada: as regras de design vivas,
   o diário das decisões (datado) e as armadilhas. Cada «## » é uma entrada, e
   o texto do capítulo é a abertura do próprio ficheiro. Eram as regras e o
   diário num ficheiro só, e o capítulo servia os dois como se fossem regras. */
const MARKDOWNS = [
  { id: 'design', titulo: 'Regras de design', ficheiro: 'docs/design.md' },
  { id: 'decisoes', titulo: 'Diário de decisões', ficheiro: 'docs/decisoes.md' },
  { id: 'armadilhas', titulo: 'Armadilhas conhecidas', ficheiro: 'docs/armadilhas.md' },
];

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
for (const m of MARKDOWNS) {
  capitulos.push({
    id: m.id, titulo: m.titulo,
    itens: [{ nome: m.ficheiro, texto: abertura(m.ficheiro), funcoes: seccoesMd(m.ficheiro) }],
  });
}

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
/* E o sentido contrário: uma secção do docs/comandos.md que não é de nenhum
   comando registado nunca chega à página — é texto escrito onde não é lido.
   Foi o que aconteceu ao cartão dos serviços de uma conta, no back office:
   estava aqui, e foi viver para «A app em serviços», no design.md. */
const semComando = Object.keys(guia).filter((t) => !DOCS.comandos.some((c) => c.nome === t));
if (semComando.length) {
  console.error('Secções do docs/comandos.md que não são de nenhum comando registado (ninguém as lê: leva-as para onde são servidas): ' + semComando.join(', '));
  process.exit(1);
}

writeFileSync(new URL('worker/src/docs-gerados.js', raiz),
  '// GERADO por scripts/gerar-docs.js — não editar à mão nem pôr no git; gera-se no deploy, no npm install e no npm run dev.\n' +
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
