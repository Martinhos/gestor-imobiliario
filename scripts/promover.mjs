// O «promove» só do que está em Staging (KAN-156, as decisões do Martinho a
// 2026-11-24: «Quando disser promove, só promoves o que estiver na coluna
// para produção»). Até aqui o promove levava o dev inteiro ao main num PR com
// merge commit; agora leva só os commits dos cartões que o Martinho aceitou
// para produção (o Aceitar do quadro › «Enviar para produção» põe-nos em
// Staging; «Adiar a produção» deixa-os em Adiado, no dev). Cada commit diz os
// KAN-N na mensagem, e é por eles que se sabe de que cartões é.
//
//   node scripts/promover.mjs plano [--json] [--local]
//   node scripts/promover.mjs ramo [--levar <sha>[,<sha>…]] [--deixar <sha>[,<sha>…]] [--nome promover/AAAA-MM-DD] [--pasta <dir>] [--local]
//   node scripts/promover.mjs fechar [--seco] [--local]
//
// plano só lê: faz o git fetch, lê o quadro do dev (scripts/kanban.mjs:
// lerQuadro; com --local, a base isolada) e os commits do origin/dev que não
// estão no origin/main — nem por antepassado, nem por cópia: o trailer
// «(cherry picked from commit …)» de um promove anterior, ou o mesmo patch
// (`git cherry`) —, pela ordem do dev, e separa-os (planoDoPromove):
// - a levar: todos os cartões que cita estão em Staging (ou já em Produção);
// - a deixar: nenhum em Staging (Adiado, Human Tests, A fazer…);
// - mistos: um em Staging e outro que não está — pergunta-se ao Martinho;
// - sem cartão: nenhum KAN-N (documentação, CI, dependências) — pergunta-se;
// - só em Produção: os cartões já estão em Produção, mas o commit não está no
//   main (os do tempo em que o Aceitar levava a Concluído) — pergunta-se;
// - de cartões que não estão no quadro (removidos, ou uma chave mal escrita) — pergunta-se.
// E diz o que pode correr mal: um commit a levar que mexe nos mesmos
// ficheiros de um que fica antes dele (pode depender dele; no web/avisos.js
// o cherry-pick quase de certeza não aplica), uma migração que fica atrás de
// outra que vai, a VERSAO_MINIMA, e os cartões em Staging sem commits.
//
// ramo cria o ramo promover/AAAA-MM-DD (o dia de Lisboa; --nome muda-o) a
// partir do origin/main, num git worktree à parte (os.tmpdir()/
// rendorium-promover/<ramo>, ou --pasta: a cópia de trabalho do repositório
// não se mexe), e faz `git cherry-pick -x` de cada commit a levar, pela ordem
// do dev. Recusa enquanto houver uma pergunta por responder: cada misto,
// sem cartão, só em Produção ou de cartão desconhecido tem de vir em --levar
// ou em --deixar (o sha, ou o começo dele com 7 ou mais algarismos), que é a
// resposta do Martinho. Pára no primeiro conflito sem o resolver (`git
// cherry-pick --abort`: o ramo fica com os que aplicaram), e diz o commit, os
// ficheiros e os commits que ficam e lhes mexem. O único conflito que se
// resolve sozinho é o do web/versao.json, que não se escreve à mão: gera-se
// do web/avisos.js com o scripts/versao.js. Um commit que fica vazio (já
// estava no main) salta-se e diz-se. No fim corre o scripts/versao.js
// (e faz um commit se o versao.json mudou), confere-o com --check e confere a
// versão e a VERSAO_MINIMA do ramo contra as do main e do dev, e lista as
// migrações novas. Nunca faz push nem abre o PR: isso é o passo do promove,
// com o Martinho (a skill promove).
//
// fechar, depois do deploy de produção verde, leva a Produção (o id
// concluido) os cartões de Staging cujos commits estão todos na etiqueta
// publicado — que o deploy de produção só move depois de a produção
// responder —, por antepassado ou por cópia (ticket.mjs:naEtiqueta), pelo
// scripts/kanban.mjs mover. Um cartão em Staging sem commits vai também (não
// havia código a levar). --seco só diz o que faria.
//
// Os limites: só lê o kanban (o fechar move cartões no kanban do dev, que é
// onde ele vive, e nunca na produção: o kanban.mjs recusa-a); no git só faz
// fetch, lê, e cria e mexe em ramos promover/* num worktree; nunca faz push,
// nunca toca no main nem no dev locais, nunca resolve um conflito às cegas.
// Com PROMOVER_VERBOSO=1, cada chamada ao git e ao node é escrita no stderr.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { lerQuadro, principal as kanban, ErroKanban } from './kanban.mjs';
import { numeroDaChave } from '../worker/src/lib/kanban.js';
import { naEtiqueta, ErroTicket } from './ticket.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const COMANDOS = ['plano', 'ramo', 'fechar'];
// as colunas que contam (os ids do contrato da 0032)
export const STAGING = 'staging';
export const PRODUCAO = 'concluido';
// os refs remotos do promove
export const MAIN = 'origin/main';
export const DEV = 'origin/dev';
// o ficheiro que se gera (nunca à mão) e o que se compara
export const VERSAO_JSON = 'web/versao.json';
export const AVISOS = 'web/avisos.js';
// quantos commits do dev o fechar lê para achar os de cada cartão
const TETO_HISTORIA = 3000;
// o maior intervalo que «KAN-150 a KAN-154» pode abrir
const TETO_INTERVALO = 40;

export const USO = [
  'Uso:',
  '  node scripts/promover.mjs plano [--json] [--local]',
  '  node scripts/promover.mjs ramo [--levar <sha>[,<sha>…]] [--deixar <sha>[,<sha>…]] [--nome promover/AAAA-MM-DD] [--pasta <dir>] [--local]',
  '  node scripts/promover.mjs fechar [--seco] [--local]',
  '',
  'O quadro é o do dev (gestor-imobiliario-dev); --local lê a base isolada (KANBAN_PERSIST muda a pasta).',
  'Nunca faz push nem abre o PR: o promove faz-se com o Martinho (a skill promove).',
].join('\n');

// O erro que a linha de comandos mostra sem pilha: a mensagem chega para agir.
export class ErroPromover extends Error {
  /* Recebe: mensagem — o que correu mal, em português, já com o que fazer;
     codigo (opcional) — o código de saída (1 por omissão, 2 nos argumentos).
     Devolve: o erro, com .codigo. */
  constructor(mensagem, codigo = 1) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/* ------------------------- textos pequenos ------------------------------ */

/* «1 commit», «3 commits»: o plural certo.
   Recebe: n — a contagem; um — a forma singular; varios — a forma plural.
   Devolve: o texto com o número. */
function conta(n, um, varios) {
  return n + ' ' + (n === 1 ? um : varios);
}

/* Os 7 primeiros algarismos de um sha.
   Recebe: sha — o sha.
   Devolve: o sha curto. */
function curto(sha) {
  return String(sha || '').slice(0, 7);
}

/* O dia de hoje em Lisboa, AAAA-MM-DD (o nome do ramo).
   Recebe: agora (opcional) — o instante (Date); o de agora por omissão.
   Devolve: o texto. */
export function hojeEmLisboa(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

/* ------------------------- argumentos ----------------------------------- */

const OPCOES = {
  plano: { sinais: ['--json', '--local'], valores: [] },
  ramo: { sinais: ['--local'], valores: ['--levar', '--deixar', '--nome', '--pasta'] },
  fechar: { sinais: ['--seco', '--local'], valores: [] },
};

/* Uma lista de shas dada numa opção («abc1234,def5678»): cada um com 7 a 40
   algarismos hexadecimais, em minúsculas.
   Recebe: texto — o valor da opção; opcao — o nome dela, para a mensagem.
   Devolve: os shas (array); lança ErroPromover (código 2) se algum não servir. */
export function confereShas(texto, opcao) {
  const lista = String(texto == null ? '' : texto).split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!lista.length) throw new ErroPromover('O ' + opcao + ' precisa de pelo menos um sha.', 2);
  const maus = lista.filter((s) => !/^[0-9a-f]{7,40}$/.test(s));
  if (maus.length) throw new ErroPromover('No ' + opcao + ', não são shas (7 a 40 algarismos hexadecimais): ' + maus.join(', ') + '.', 2);
  return [...new Set(lista)];
}

/* Lê a linha de comandos, aceitando «--levar x» e «--levar=x». Recusa o que
   não conhece em vez de o ignorar.
   Recebe: argv — os argumentos depois do script (array de texto).
   Devolve: { comando, json, local, seco, levar, deixar, nome, pasta }; lança
   ErroPromover (código 2) com a razão e o uso. */
export function lerArgumentos(argv) {
  const lista = Array.isArray(argv) ? argv.slice() : [];
  const comando = lista.shift();
  const falha = (porque) => { throw new ErroPromover(porque + '\n\n' + USO, 2); };
  if (!comando) falha('Falta o comando.');
  if (!COMANDOS.includes(comando)) falha('Não conheço o comando «' + comando + '».');
  const { sinais, valores } = OPCOES[comando];
  const r = { comando, json: false, local: false, seco: false, levar: [], deixar: [], nome: null, pasta: null };
  const dados = {};
  for (let i = 0; i < lista.length; i++) {
    const a = String(lista[i]);
    if (!a.startsWith('--')) falha('Não sei o que fazer com «' + a + '».');
    const igual = a.indexOf('=');
    const nome = igual > 0 ? a.slice(0, igual) : a;
    if (sinais.includes(nome)) {
      if (igual > 0) falha('A opção ' + nome + ' não leva valor.');
      r[nome.slice(2)] = true;
    } else if (valores.includes(nome)) {
      let v;
      if (igual > 0) v = a.slice(igual + 1);
      else {
        v = lista[++i];
        if (v === undefined || String(v).startsWith('--')) falha('A opção ' + nome + ' precisa de um valor.');
      }
      if (Object.prototype.hasOwnProperty.call(dados, nome)) falha('A opção ' + nome + ' vem duas vezes (junta os shas com vírgulas).');
      dados[nome] = String(v);
    } else falha('O comando ' + comando + ' não aceita a opção ' + nome + '.');
  }
  try {
    if (dados['--levar'] != null) r.levar = confereShas(dados['--levar'], '--levar');
    if (dados['--deixar'] != null) r.deixar = confereShas(dados['--deixar'], '--deixar');
  } catch (e) {
    falha(e.message);
  }
  const nos2 = r.levar.filter((s) => r.deixar.some((x) => x.startsWith(s) || s.startsWith(x)));
  if (nos2.length) falha('O mesmo commit não pode ir em --levar e em --deixar: ' + nos2.join(', ') + '.');
  if (dados['--nome'] != null) {
    r.nome = dados['--nome'].trim();
    if (!/^promover\/[A-Za-z0-9._-]{1,60}$/.test(r.nome) || /\.\.|\.lock$|^promover\/[.-]/.test(r.nome)) falha('O --nome tem de ser promover/<algo> (letras, algarismos, pontos, hífenes), como promover/2026-11-24.');
  }
  if (dados['--pasta'] != null) {
    r.pasta = dados['--pasta'].trim();
    if (!r.pasta) falha('O --pasta precisa de uma pasta.');
  }
  return r;
}

/* ------------------------- os cartões de cada commit -------------------- */

/* Os KAN-N que a mensagem de um commit cita: os soltos (KAN-155) e os
   intervalos («KAN-150 a KAN-154», «KAN-145..154», «KAN-150 até 152»,
   «KAN-150–154»), até TETO_INTERVALO de cada vez.
   Recebe: texto — a mensagem inteira (assunto e corpo).
   Devolve: os números, sem repetidos, por ordem. */
export function chavesDaMensagem(texto) {
  const t = String(texto == null ? '' : texto);
  const nums = new Set();
  // «a» e «até» com espaços à volta (o \b do JavaScript não conhece o «é»)
  const intervalo = /\bKAN-(\d{1,9})(?:\s*(?:\.\.\.?|–|—)\s*|\s+(?:a|até)\s+)(?:KAN-)?(\d{1,9})\b/gi;
  let m;
  while ((m = intervalo.exec(t))) {
    const de = Number(m[1]), ate = Number(m[2]);
    if (ate > de && ate - de <= TETO_INTERVALO) for (let n = de; n <= ate; n++) nums.add(n);
  }
  for (const s of t.matchAll(/\bKAN-(\d{1,9})\b/gi)) nums.add(Number(s[1]));
  return [...nums].filter((n) => n > 0).sort((a, b) => a - b);
}

/* O que um commit é para o promove, pelas colunas dos cartões que cita.
   Recebe: chaves — os números (chavesDaMensagem); porNumero — Map N → cartão
   ({coluna_id}) do quadro (só os não removidos).
   Devolve: { categoria: 'levar' | 'deixar' | 'misto' | 'sem-cartao' |
   'producao' | 'desconhecido', staging, producao, outros, desconhecidos }
   (as quatro listas são as chaves 'KAN-N', e outros leva a coluna:
   [{chave, coluna}]). */
export function categoriaDoCommit(chaves, porNumero) {
  const staging = [], producao = [], outros = [], desconhecidos = [];
  chaves.forEach((n) => {
    const k = porNumero.get(n), chave = 'KAN-' + n;
    if (!k) desconhecidos.push(chave);
    else if (k.coluna_id === STAGING) staging.push(chave);
    else if (k.coluna_id === PRODUCAO) producao.push(chave);
    else outros.push({ chave, coluna: k.coluna_id });
  });
  let categoria;
  if (!chaves.length) categoria = 'sem-cartao';
  else if (staging.length) categoria = outros.length || desconhecidos.length ? 'misto' : 'levar';
  else if (outros.length) categoria = 'deixar';
  else if (desconhecidos.length) categoria = 'desconhecido';
  else categoria = 'producao';
  return { categoria, staging, producao, outros, desconhecidos };
}

// as categorias que pedem uma resposta do Martinho antes do ramo
export const PERGUNTAS = ['misto', 'sem-cartao', 'producao', 'desconhecido'];

/* Se um sha dado numa opção é este commit (o inteiro, ou o começo dele).
   Recebe: dado — o sha da opção; sha — o do commit (40).
   Devolve: true ou false. */
function eOCommit(dado, sha) {
  return String(sha).toLowerCase().startsWith(String(dado).toLowerCase());
}

/* O plano do promove, sem git nem rede: cada commit do dev que falta no main
   com a categoria (categoriaDoCommit) e a decisão (as --levar e --deixar
   mandam sobre a categoria), o que fica por perguntar, os riscos (um commit
   a levar que mexe nos mesmos ficheiros de um que fica antes dele; o
   web/avisos.js à parte, onde o conflito é quase certo; uma migração que fica
   atrás de outra que vai) e os cartões de Staging sem commits (sem os
   subtickets KAN-N-X, que vão com os commits do pai: KAN-162).
   Recebe: commits — os do dev que faltam no main, pela ordem do dev ([{sha,
   assunto, mensagem, ficheiros}]); quadro — { colunas, cartoes } (lerQuadro);
   decisoes (opcional) — { levar: [sha], deixar: [sha] }.
   Devolve: { commits: [{sha, assunto, ficheiros, chaves, categoria, …,
   decisao: 'levar' | 'deixar' | null, decidido: bool}], levar, deixar,
   perguntas, riscos: [texto], semCommits: [cartão], staging: [cartão],
   semStaging: bool, decisoesSemCommit: [sha] }. */
export function planoDoPromove(commits, quadro, decisoes = {}) {
  const levarDado = decisoes.levar || [], deixarDado = decisoes.deixar || [];
  const cartoes = (quadro && quadro.cartoes) || [];
  const porNumero = new Map(cartoes.map((k) => [Number(k.numero), k]));
  const semStaging = !((quadro && quadro.colunas) || []).some((c) => c.id === STAGING);
  const lista = commits.map((c) => {
    const chaves = chavesDaMensagem(c.mensagem);
    const cat = categoriaDoCommit(chaves, porNumero);
    const forcaLevar = levarDado.some((s) => eOCommit(s, c.sha));
    const forcaDeixar = deixarDado.some((s) => eOCommit(s, c.sha));
    let decisao = forcaLevar ? 'levar' : forcaDeixar ? 'deixar' : cat.categoria === 'levar' ? 'levar' : cat.categoria === 'deixar' ? 'deixar' : null;
    return Object.assign({ sha: c.sha, assunto: c.assunto, ficheiros: c.ficheiros || [], chaves: chaves.map((n) => 'KAN-' + n) }, cat,
      { decisao, decidido: forcaLevar || forcaDeixar });
  });
  const decisoesSemCommit = levarDado.concat(deixarDado).filter((s) => !lista.some((c) => eOCommit(s, c.sha)));
  const levar = lista.filter((c) => c.decisao === 'levar');
  const deixar = lista.filter((c) => c.decisao === 'deixar');
  const perguntas = lista.filter((c) => c.decisao == null);
  const riscos = [];
  lista.forEach((c, i) => {
    if (c.decisao !== 'levar') return;
    lista.slice(0, i).filter((x) => x.decisao !== 'levar').forEach((x) => {
      const comuns = c.ficheiros.filter((f) => f !== VERSAO_JSON && x.ficheiros.includes(f));
      if (!comuns.length) return;
      const avisos = comuns.includes(AVISOS);
      const outros = comuns.filter((f) => f !== AVISOS);
      if (avisos) riscos.push(curto(c.sha) + ' vai e ' + curto(x.sha) + ' fica antes dele, e os dois mexem no ' + AVISOS + ' (as novidades de cada versão): o cherry-pick quase de certeza dá conflito ali.');
      if (outros.length) riscos.push(curto(c.sha) + ' vai e ' + curto(x.sha) + ' fica antes dele, e os dois mexem em ' + outros.slice(0, 6).join(', ') + (outros.length > 6 ? '…' : '') + ': pode depender dele.');
    });
  });
  const migracoesDe = (cs) => cs.flatMap((c) => c.ficheiros.filter((f) => /^migrations\/\d{4}_.+\.sql$/.test(f)).map((f) => ({ f, sha: c.sha })));
  const vao = migracoesDe(levar), ficam = migracoesDe(lista.filter((c) => c.decisao !== 'levar'));
  ficam.forEach((m) => {
    const depois = vao.filter((v) => v.f > m.f);
    if (depois.length) riscos.push('A migração ' + m.f + ' (' + curto(m.sha) + ') fica e a ' + depois.map((v) => v.f).join(', ') + ' vai: quando a que fica for, corre depois de uma com número maior.');
  });
  const staging = cartoes.filter((k) => k.coluna_id === STAGING);
  const citados = new Set(lista.flatMap((c) => c.chaves));
  // um subticket (KAN-N-X) não tem commits seus: vai com os do pai, que o segue (KAN-162)
  const semCommits = staging.filter((k) => k.sub == null && !citados.has(k.chave));
  return { commits: lista, levar, deixar, perguntas, riscos, semCommits, staging, semStaging, decisoesSemCommit };
}

/* ------------------------- o texto do plano ----------------------------- */

const NOMES_DAS_CATEGORIAS = {
  levar: 'a levar', deixar: 'a deixar', misto: 'misto', 'sem-cartao': 'sem cartão', producao: 'só em Produção', desconhecido: 'cartão que não está no quadro',
};

/* Um commit numa linha, com os cartões e as colunas deles.
   Recebe: c — o commit do plano; nomeDaColuna — função id → nome.
   Devolve: o texto. */
function linhaDoCommit(c, nomeDaColuna) {
  const partes = [];
  if (c.staging.length) partes.push(c.staging.join(', ') + ' em ' + nomeDaColuna(STAGING));
  if (c.producao.length) partes.push(c.producao.join(', ') + ' em ' + nomeDaColuna(PRODUCAO));
  c.outros.forEach((o) => partes.push(o.chave + ' em ' + nomeDaColuna(o.coluna)));
  if (c.desconhecidos.length) partes.push(c.desconhecidos.join(', ') + ' fora do quadro');
  return curto(c.sha) + ' ' + c.assunto + (partes.length ? ' [' + partes.join('; ') + ']' : ' [sem KAN-N]') + (c.decidido ? ' (decidido: ' + c.decisao + ')' : '');
}

/* O texto do plano, para o Martinho e para quem promove: o que vai, o que
   fica, o que se pergunta (com o comando que leva a resposta), os riscos e os
   cartões de Staging sem commits.
   Recebe: p — o plano (planoDoPromove); contexto — { alvo (onde está o
   quadro), main, dev (os sha das pontas), colunas, jaNoMain (quantos commits
   do dev já estão no main por cópia), merges (quantos merges no intervalo) }.
   Devolve: o texto. */
export function textoDoPlano(p, contexto) {
  const nomeDaColuna = (id) => ((contexto.colunas || []).find((c) => c.id === id) || { nome: id }).nome;
  const L = ['Promove: ' + conta(p.commits.length, 'commit', 'commits') + ' do ' + DEV + ' (' + curto(contexto.dev) + ') que faltam no ' + MAIN + ' (' + curto(contexto.main) + ')'
    + (contexto.jaNoMain ? '; ' + conta(contexto.jaNoMain, 'já lá está por cherry-pick', 'já lá estão por cherry-pick') + ', e não contam' : '')
    + (contexto.merges ? '; ' + conta(contexto.merges, 'merge não se leva', 'merges não se levam') + ' (o cherry-pick leva os commits de dentro)' : '')
    + '. O quadro é o ' + (contexto.alvo === 'local' ? 'da base isolada (--local)' : 'do dev') + '.'];
  if (p.semStaging) L.push('A coluna Staging ainda não existe neste quadro (chega com a migração 0032, no deploy do dev): nada está em Staging, e nada vai.');
  L.push('', '## A levar (' + p.levar.length + ')');
  if (!p.levar.length) L.push('  (nenhum)');
  p.levar.forEach((c) => L.push('  ' + linhaDoCommit(c, nomeDaColuna)));
  L.push('', '## A deixar no dev (' + p.deixar.length + ')');
  if (!p.deixar.length) L.push('  (nenhum)');
  p.deixar.forEach((c) => L.push('  ' + linhaDoCommit(c, nomeDaColuna)));
  L.push('', '## Por perguntar ao Martinho (' + p.perguntas.length + ')');
  if (!p.perguntas.length) L.push('  (nenhum)');
  PERGUNTAS.forEach((cat) => {
    const deles = p.perguntas.filter((c) => c.categoria === cat);
    if (!deles.length) return;
    L.push('  ' + NOMES_DAS_CATEGORIAS[cat] + ' (' + deles.length + '):');
    deles.forEach((c) => L.push('    ' + linhaDoCommit(c, nomeDaColuna)));
  });
  if (p.perguntas.length) {
    L.push('  A resposta entra no ramo: --levar <sha>,<sha> (vai) e --deixar <sha>,<sha> (fica no dev).');
  }
  if (p.riscos.length) {
    L.push('', '## Riscos (' + p.riscos.length + ')');
    p.riscos.forEach((r) => L.push('  - ' + r));
  }
  if (p.semCommits.length) {
    L.push('', '## Em Staging sem commits no dev por levar (' + p.semCommits.length + ')');
    p.semCommits.forEach((k) => L.push('  ' + k.chave + ' — ' + k.titulo + ' (o fechar leva-o a ' + nomeDaColuna(PRODUCAO) + '; se tinha código, está já no main, ou o commit não diz o KAN-N)'));
  }
  if (p.decisoesSemCommit.length) L.push('', 'Atenção: estes shas das decisões não são de nenhum commit por levar: ' + p.decisoesSemCommit.join(', ') + '.');
  L.push('');
  if (p.perguntas.length) L.push('BLOQUEIA: ' + conta(p.perguntas.length, 'commit por decidir', 'commits por decidir') + ' (acima). O ramo recusa até cada um vir em --levar ou em --deixar.');
  else if (!p.levar.length) L.push('Nada a promover: nenhum commit vai.');
  else L.push('Pronto para o ramo: node scripts/promover.mjs ramo' + decisoesDitas(p) + ' (' + conta(p.levar.length, 'commit', 'commits') + ').');
  return L.join('\n');
}

/* As decisões já dadas, como se escrevem no comando do ramo.
   Recebe: p — o plano.
   Devolve: ' --levar a,b --deixar c', ou ''. */
function decisoesDitas(p) {
  const l = p.commits.filter((c) => c.decidido && c.decisao === 'levar').map((c) => curto(c.sha));
  const d = p.commits.filter((c) => c.decidido && c.decisao === 'deixar').map((c) => curto(c.sha));
  return (l.length ? ' --levar ' + l.join(',') : '') + (d.length ? ' --deixar ' + d.join(',') : '');
}

/* O plano em JSON (o --json).
   Recebe: p — o plano; contexto — como em textoDoPlano.
   Devolve: o objeto. */
export function planoParaJson(p, contexto) {
  const c = (x) => ({ sha: x.sha, assunto: x.assunto, chaves: x.chaves, categoria: x.categoria, decisao: x.decisao, staging: x.staging, producao: x.producao, outros: x.outros, desconhecidos: x.desconhecidos, ficheiros: x.ficheiros });
  return {
    main: contexto.main, dev: contexto.dev, alvo: contexto.alvo, jaNoMain: contexto.jaNoMain || 0, merges: contexto.merges || 0, semStaging: p.semStaging,
    levar: p.levar.map(c), deixar: p.deixar.map(c), perguntas: p.perguntas.map(c), riscos: p.riscos,
    semCommits: p.semCommits.map((k) => ({ chave: k.chave, titulo: k.titulo })), bloqueia: p.perguntas.length > 0,
  };
}

/* ------------------------- o git ---------------------------------------- */

/* Mostra a chamada no stderr, com PROMOVER_VERBOSO=1.
   Recebe: programa — 'git' ou 'node'; args — os argumentos; cwd — a pasta.
   Devolve: nada. */
function mostraChamada(programa, args, cwd) {
  if (process.env.PROMOVER_VERBOSO === '1') process.stderr.write('[promover] ' + programa + ' ' + args.join(' ') + (cwd && cwd !== RAIZ ? ' (em ' + cwd + ')' : '') + '\n');
}

/* Corre um programa sem shell.
   Recebe: programa — 'git' ou o node; args; cwd — a pasta; env (opcional) — variáveis a juntar.
   Devolve: { status, stdout, stderr }; lança ErroPromover se não correr. */
function corre(programa, args, cwd, env) {
  mostraChamada(programa === process.execPath ? 'node' : programa, args, cwd);
  const r = spawnSync(programa, args, {
    cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 300000, windowsHide: true,
    env: Object.assign({}, process.env, { GIT_EDITOR: 'true', GIT_TERMINAL_PROMPT: '0' }, env || {}),
  });
  if (r.error) throw new ErroPromover(r.error.code === 'ENOENT' ? 'Não encontro o ' + programa + ' no PATH.' : 'O ' + programa + ' não correu: ' + r.error.message);
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/* As dependências de fora, com as verdadeiras por omissão: os testes trocam
   a raiz (um repositório temporário), o quadro e o mover.
   Recebe: deps — { raiz, git (args, cwd) → {status, stdout, stderr}, node
   (args, cwd), quadro (local) → {colunas, cartoes}, mover (chave, coluna,
   local) → {codigo, out, err}, hoje () → 'AAAA-MM-DD', tmp () → pasta }.
   Devolve: as dependências completas. */
function dependencias(deps = {}) {
  const raiz = deps.raiz || RAIZ;
  return {
    raiz,
    git: deps.git || ((args, cwd) => corre('git', args, cwd || raiz)),
    node: deps.node || ((args, cwd) => corre(process.execPath, args, cwd || raiz)),
    quadro: deps.quadro || ((local) => lerQuadro(local)),
    mover: deps.mover || ((chave, coluna, local) => {
      let out = '', err = '';
      const codigo = kanban(['mover', chave, coluna].concat(local ? ['--local'] : []), undefined, { out: (t) => { out += t; }, err: (t) => { err += t; } });
      return { codigo, out, err };
    }),
    hoje: deps.hoje || (() => hojeEmLisboa()),
    tmp: deps.tmp || (() => path.join(os.tmpdir(), 'rendorium-promover')),
  };
}

/* Corre o git e lança se falhar.
   Recebe: d — as dependências; args; cwd (opcional); oQue — o que se tentava, para a mensagem.
   Devolve: o stdout. */
function gitOk(d, args, cwd, oQue) {
  const r = d.git(args, cwd);
  if (r.status !== 0) throw new ErroPromover('O git falhou a ' + oQue + ': ' + (String(r.stderr || r.stdout).trim().split(/\r?\n/).slice(0, 3).join(' ') || 'sem mensagem'));
  return r.stdout;
}

/* O sha inteiro de um ref, ou null.
   Recebe: d; ref; cwd (opcional).
   Devolve: o sha de 40, ou null. */
function shaDe(d, ref, cwd) {
  const r = d.git(['rev-parse', '--verify', '--quiet', ref + '^{commit}'], cwd);
  const t = String(r.stdout || '').trim().toLowerCase();
  return r.status === 0 && /^[0-9a-f]{40}$/.test(t) ? t : null;
}

/* Lê a saída do git log com --format=%x1e%H%x1f%P%x1f%B%x1f e --name-only.
   Recebe: texto — a saída.
   Devolve: [{sha, pais, mensagem, assunto, ficheiros}]. */
export function commitsDoLog(texto) {
  return String(texto || '').split('\x1e').slice(1).map((bloco) => {
    const [sha, pais, mensagem, resto] = bloco.split('\x1f');
    const msg = String(mensagem || '').replace(/\r\n/g, '\n').trim();
    return {
      sha: String(sha).trim().toLowerCase(), pais: String(pais || '').trim().split(/\s+/).filter(Boolean), mensagem: msg,
      assunto: msg.split('\n')[0], ficheiros: String(resto || '').split(/\r?\n/).map((f) => f.trim()).filter(Boolean),
    };
  });
}

/* Os shas que a mensagem de cada commit diz ter copiado (o trailer do
   `git cherry-pick -x`).
   Recebe: texto — as mensagens.
   Devolve: o Set dos shas de 40. */
export function copiadosDe(texto) {
  return new Set([...String(texto || '').matchAll(/\(cherry picked from commit ([0-9a-f]{40})\)/gi)].map((m) => m[1].toLowerCase()));
}

/* Os commits do dev que faltam no main: os de origin/main..origin/dev, pela
   ordem do dev, sem os merges (contam-se) e sem os que o main já tem por
   cópia — o trailer de um cherry-pick -x nos commits do main que o dev não
   tem, ou o mesmo patch (`git cherry`).
   Recebe: d — as dependências.
   Devolve: { main, dev, commits, jaNoMain, merges }. */
function commitsPorLevar(d) {
  gitOk(d, ['fetch', 'origin', '--tags', '--force', '--prune', '--quiet'], null, 'buscar o origin (git fetch)');
  const main = shaDe(d, MAIN), dev = shaDe(d, DEV);
  if (!main || !dev) throw new ErroPromover('Não encontro o ' + (!main ? MAIN : DEV) + ' depois do git fetch.');
  const todos = commitsDoLog(gitOk(d, ['log', '--topo-order', '--reverse', '--name-only', '--format=%x1e%H%x1f%P%x1f%B%x1f', MAIN + '..' + DEV], null, 'ler os commits do dev'));
  const merges = todos.filter((c) => c.pais.length > 1).length;
  const copiados = copiadosDe(gitOk(d, ['log', '--format=%B', DEV + '..' + MAIN], null, 'ler os cherry-picks do main'));
  const cherry = gitOk(d, ['cherry', MAIN, DEV], null, 'comparar os patches (git cherry)');
  const iguais = new Set([...cherry.matchAll(/^-\s+([0-9a-f]{40})/gmi)].map((m) => m[1].toLowerCase()));
  const simples = todos.filter((c) => c.pais.length <= 1);
  const commits = simples.filter((c) => !copiados.has(c.sha) && !iguais.has(c.sha));
  return { main, dev, commits, jaNoMain: simples.length - commits.length, merges };
}

/* O quadro, com o que falta dito: sem as tabelas, um erro que diz porquê.
   Recebe: d — as dependências; local — true para a base isolada.
   Devolve: { colunas, cartoes }. */
function quadroDe(d, local) {
  try {
    return d.quadro(local);
  } catch (e) {
    if (e instanceof ErroKanban || e instanceof ErroTicket) throw new ErroPromover('Não consegui ler o quadro: ' + e.message);
    throw e;
  }
}

/* ------------------------- os comandos ---------------------------------- */

/* plano: só lê, e diz o que o promove levaria.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: { texto, codigo } (0 sempre que leu; o BLOQUEIA vai no texto). */
function cmdPlano(o, d) {
  const g = commitsPorLevar(d);
  const quadro = quadroDe(d, o.local);
  const p = planoDoPromove(g.commits, quadro);
  const contexto = { alvo: o.local ? 'local' : 'dev', main: g.main, dev: g.dev, colunas: quadro.colunas, jaNoMain: g.jaNoMain, merges: g.merges };
  return { texto: o.json ? JSON.stringify(planoParaJson(p, contexto), null, 2) : textoDoPlano(p, contexto), codigo: 0 };
}

/* A versão e a VERSAO_MINIMA de um web/avisos.js, sem o correr no processo:
   num contexto à parte do vm (o ficheiro só declara dados).
   Recebe: src — o texto do web/avisos.js.
   Devolve: { versao, minima }, ou null se não se ler. */
export function versaoDoAvisos(src) {
  try {
    const caixa = { module: { exports: {} } };
    vm.runInNewContext(String(src) + '\n;globalThis.__v = { versao: VERSAO, minima: VERSAO_MINIMA };', caixa, { timeout: 2000 });
    const v = caixa.__v;
    return v && Number.isFinite(Number(v.versao)) && Number.isFinite(Number(v.minima)) ? { versao: Number(v.versao), minima: Number(v.minima) } : null;
  } catch (e) {
    return null;
  }
}

/* A versão de um ref, pelo web/avisos.js dele.
   Recebe: d; ref; cwd (opcional).
   Devolve: { versao, minima }, ou null. */
function versaoDe(d, ref, cwd) {
  const r = d.git(['show', ref + ':' + AVISOS], cwd);
  return r.status === 0 ? versaoDoAvisos(r.stdout) : null;
}

/* O que dizer da versão do ramo: tem de subir (ou ficar, sem mudanças na
   web), a mínima nunca acima da versão, e uma mínima que sobe diz-se (as
   apps abaixo dela são obrigadas a atualizar).
   Recebe: v — { main, dev, ramo } ({versao, minima} ou null); mudouWeb — se o ramo mexe em web/.
   Devolve: { erros: [texto], avisos: [texto] }. */
export function confereVersoes(v, mudouWeb) {
  const erros = [], avisos = [];
  if (!v.ramo) { erros.push('Não consegui ler a versão do ' + AVISOS + ' do ramo.'); return { erros, avisos }; }
  if (v.ramo.minima > v.ramo.versao) erros.push('A VERSAO_MINIMA do ramo (' + v.ramo.minima + ') passa da versão (' + v.ramo.versao + '): a app ficava a pedir uma versão que não existe.');
  if (v.main && v.ramo.versao < v.main.versao) erros.push('A versão desce: o main está na ' + v.main.versao + ' e o ramo fica na ' + v.ramo.versao + '.');
  if (v.main && v.ramo.versao === v.main.versao && mudouWeb) avisos.push('A versão não sobe (' + v.ramo.versao + ') e o ramo mexe na web/: a app instalada não vê que há novidades.');
  if (v.main && v.ramo.minima > v.main.minima) avisos.push('A VERSAO_MINIMA sobe de ' + v.main.minima + ' para ' + v.ramo.minima + ': as apps abaixo dela são obrigadas a atualizar (diz-se no promove).');
  if (v.dev && v.ramo.minima !== v.dev.minima) avisos.push('A VERSAO_MINIMA do ramo (' + v.ramo.minima + ') não é a do dev (' + v.dev.minima + '): confere que é a certa para o que vai.');
  return { erros, avisos };
}

/* Os ficheiros com conflito na pasta (o git diff --diff-filter=U).
   Recebe: d; cwd.
   Devolve: os caminhos. */
function emConflito(d, cwd) {
  const r = d.git(['diff', '--name-only', '--diff-filter=U'], cwd);
  return String(r.stdout || '').split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
}

/* Gera o web/versao.json na pasta (o scripts/versao.js dela).
   Recebe: d; cwd.
   Devolve: nada; lança ErroPromover se falhar. */
function gerarVersao(d, cwd) {
  const r = d.node(['scripts/versao.js'], cwd);
  if (r.status !== 0) throw new ErroPromover('O scripts/versao.js falhou no ramo: ' + String(r.stderr || r.stdout).trim().split(/\r?\n/)[0]);
}

/* Faz o cherry-pick -x de um commit e diz como correu: aplicado, vazio (já
   estava lá: salta-se), aplicado com o web/versao.json gerado (o único
   conflito que se resolve sozinho), ou em conflito (aborta-se, sem resolver).
   Recebe: d; cwd — a pasta do ramo; sha.
   Devolve: { estado: 'ok' | 'vazio' | 'versao' | 'conflito', ficheiros?, novo? }. */
function cherryPick(d, cwd, sha) {
  const r = d.git(['cherry-pick', '-x', sha], cwd);
  if (r.status === 0) return { estado: 'ok', novo: shaDe(d, 'HEAD', cwd) };
  const texto = String(r.stdout) + '\n' + String(r.stderr);
  const ficheiros = emConflito(d, cwd);
  if (!ficheiros.length && /cherry-pick is now empty|nothing to commit|allow-empty/i.test(texto)) {
    d.git(['cherry-pick', '--skip'], cwd);
    return { estado: 'vazio' };
  }
  if (ficheiros.length === 1 && ficheiros[0] === VERSAO_JSON) {
    gerarVersao(d, cwd);
    gitOk(d, ['add', VERSAO_JSON], cwd, 'juntar o ' + VERSAO_JSON + ' gerado');
    const c = d.git(['-c', 'core.editor=true', 'cherry-pick', '--continue'], cwd);
    if (c.status === 0) return { estado: 'versao', novo: shaDe(d, 'HEAD', cwd) };
  }
  d.git(['cherry-pick', '--abort'], cwd);
  return { estado: 'conflito', ficheiros: ficheiros.length ? ficheiros : ['(o git não disse quais: ' + texto.trim().split(/\r?\n/)[0] + ')'] };
}

/* ramo: o ramo promover/AAAA-MM-DD num worktree, com os commits a levar por
   cherry-pick -x, pela ordem do dev; pára no primeiro conflito. Recusa com
   perguntas por responder, sem nada a levar, com o ramo ou a pasta a existir.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: { texto, codigo } (1 num conflito ou num erro de versão). */
function cmdRamo(o, d) {
  const g = commitsPorLevar(d);
  const quadro = quadroDe(d, o.local);
  const p = planoDoPromove(g.commits, quadro, { levar: o.levar, deixar: o.deixar });
  if (p.decisoesSemCommit.length) throw new ErroPromover('Estes shas das decisões não são de nenhum commit por levar (vê o plano): ' + p.decisoesSemCommit.join(', ') + '.');
  if (p.perguntas.length) {
    const contexto = { alvo: o.local ? 'local' : 'dev', main: g.main, dev: g.dev, colunas: quadro.colunas, jaNoMain: g.jaNoMain, merges: g.merges };
    throw new ErroPromover('Não criei o ramo: há ' + conta(p.perguntas.length, 'commit por decidir', 'commits por decidir') + '. Pergunta ao Martinho e repete com --levar/--deixar.\n\n' + textoDoPlano(p, contexto));
  }
  if (!p.levar.length) throw new ErroPromover('Não criei o ramo: nenhum commit vai (nada em Staging com commits por levar).');
  const nome = o.nome || 'promover/' + d.hoje();
  if (shaDe(d, 'refs/heads/' + nome) || shaDe(d, 'refs/remotes/origin/' + nome)) {
    throw new ErroPromover('O ramo ' + nome + ' já existe: dá outro com --nome (promover/' + d.hoje() + '-2), ou remove o antigo (git worktree remove <pasta>; git branch -D ' + nome + ').');
  }
  const pasta = path.resolve(o.pasta || path.join(d.tmp(), nome.replace(/\//g, '-')));
  if (existsSync(pasta) && readdirSync(pasta).length) throw new ErroPromover('A pasta ' + pasta + ' já existe e não está vazia: dá outra com --pasta.');
  mkdirSync(path.dirname(pasta), { recursive: true });
  gitOk(d, ['worktree', 'add', '--no-track', '-b', nome, pasta, MAIN], null, 'criar o worktree do ramo');
  const L = ['Ramo ' + nome + ' a partir do ' + MAIN + ' (' + curto(g.main) + '), em ' + pasta + '.'];
  const feitos = [];
  for (const c of p.levar) {
    const r = cherryPick(d, pasta, c.sha);
    if (r.estado === 'conflito') {
      const quem = p.commits.filter((x) => x.decisao !== 'levar' && x.ficheiros.some((f) => r.ficheiros.includes(f)));
      L.push(...feitos);
      L.push('', 'PAROU no ' + curto(c.sha) + ' «' + c.assunto + '»: o cherry-pick dá conflito em ' + r.ficheiros.join(', ') + '. Não resolvi nada (cherry-pick --abort): o ramo fica com ' + conta(feitos.length, 'commit', 'commits') + '.');
      if (quem.length) L.push('Mexem nesses ficheiros e ficam no dev: ' + quem.map((x) => curto(x.sha) + ' «' + x.assunto + '» (' + (x.chaves.join(', ') || 'sem KAN-N') + ')').join('; ') + '. O ' + curto(c.sha) + ' pode depender deles.');
      L.push('Pergunta ao Martinho: levar também o que ele pede (--levar), deixar este (--deixar ' + curto(c.sha) + '), ou resolver o conflito à mão com ele. Para recomeçar: git worktree remove --force "' + pasta + '" e git branch -D ' + nome + '.');
      return { texto: L.join('\n'), codigo: 1 };
    }
    feitos.push('  ' + curto(c.sha) + ' → ' + (r.estado === 'vazio' ? 'vazio, já estava no main (saltado)' : curto(r.novo) + (r.estado === 'versao' ? ' (o ' + VERSAO_JSON + ' gerado do ' + AVISOS + ')' : '')) + ' «' + c.assunto + '»');
  }
  L.push(...feitos);
  // o versao.json do fim: gerado do avisos.js do ramo, e conferido
  gerarVersao(d, pasta);
  const mudou = d.git(['status', '--porcelain', '--', VERSAO_JSON], pasta);
  if (String(mudou.stdout).trim()) {
    gitOk(d, ['add', VERSAO_JSON], pasta, 'juntar o ' + VERSAO_JSON);
    gitOk(d, ['commit', '-m', 'Promover: o ' + VERSAO_JSON + ' do ramo, gerado do ' + AVISOS], pasta, 'gravar o ' + VERSAO_JSON);
    L.push('  + um commit com o ' + VERSAO_JSON + ' gerado do ' + AVISOS + ' do ramo.');
  }
  const check = d.node(['scripts/versao.js', '--check'], pasta);
  const v = { main: versaoDe(d, MAIN), dev: versaoDe(d, DEV), ramo: versaoDe(d, 'HEAD', pasta) };
  const mudouWeb = String(d.git(['diff', '--name-only', MAIN, 'HEAD', '--', 'web/'], pasta).stdout).trim() !== '';
  const cv = confereVersoes(v, mudouWeb);
  if (check.status !== 0) cv.erros.push('O scripts/versao.js --check falha no ramo: ' + String(check.stderr || check.stdout).trim().split(/\r?\n/)[0]);
  const migracoes = String(d.git(['diff', '--name-only', '--diff-filter=A', MAIN, 'HEAD', '--', 'migrations/'], pasta).stdout).split(/\r?\n/).filter(Boolean);
  L.push('', 'Versão: main ' + (v.main ? v.main.versao + ' (mínima ' + v.main.minima + ')' : '?') + ' → ramo ' + (v.ramo ? v.ramo.versao + ' (mínima ' + v.ramo.minima + ')' : '?')
    + '; o dev está na ' + (v.dev ? v.dev.versao + ' (mínima ' + v.dev.minima + ')' : '?') + '.');
  L.push('Migrações novas no ramo: ' + (migracoes.length ? migracoes.join(', ') : 'nenhuma') + '.');
  cv.avisos.forEach((a) => L.push('Aviso: ' + a));
  p.riscos.forEach((r) => L.push('Risco do plano: ' + r));
  if (cv.erros.length) {
    cv.erros.forEach((e) => L.push('ERRO: ' + e));
    L.push('O ramo não está pronto: corrige com o Martinho antes do push.');
    return { texto: L.join('\n'), codigo: 1 };
  }
  L.push('', 'Pronto. Os passos seguintes são do promove, com o Martinho (a skill promove):',
    '  git -C "' + pasta + '" push -u origin ' + nome,
    '  gh pr create --base main --head ' + nome + ' --title "Promover ' + nome.slice('promover/'.length) + '" (merge commit; a ruleset do main pede os checks verdes)',
    '  depois do deploy de produção verde: node scripts/promover.mjs fechar',
    '  e no fim: git worktree remove "' + pasta + '"');
  return { texto: L.join('\n'), codigo: 0 };
}

/* fechar: leva a Produção os cartões de Staging cujos commits estão todos na
   etiqueta publicado (por antepassado ou por cópia), e os de Staging sem
   commits. Os outros ficam, e diz-se o que lhes falta. Um subticket
   (KAN-N-X, KAN-162) julga-se pelos commits do pai e vai antes dele.
   Recebe: o — as opções lidas; d — as dependências.
   Devolve: { texto, codigo } (1 se algum mover falhou). */
function cmdFechar(o, d) {
  gitOk(d, ['fetch', 'origin', '--tags', '--force', '--prune', '--quiet'], null, 'buscar o origin e as etiquetas (git fetch)');
  const etiqueta = shaDe(d, 'refs/tags/publicado');
  if (!etiqueta) throw new ErroPromover('A etiqueta publicado não existe: a produção ainda não foi marcada por nenhum deploy. Não mexi em nenhum cartão.');
  const quadro = quadroDe(d, o.local);
  const nomeDaColuna = (id) => ((quadro.colunas || []).find((c) => c.id === id) || { nome: id }).nome;
  const staging = quadro.cartoes.filter((k) => k.coluna_id === STAGING);
  if (!staging.length) return { texto: 'Não há cartões em ' + nomeDaColuna(STAGING) + ': nada a fechar.', codigo: 0 };
  const historia = commitsDoLog(gitOk(d, ['log', '--no-merges', '-n', String(TETO_HISTORIA), '--format=%x1e%H%x1f%P%x1f%B%x1f', DEV], null, 'ler os commits do dev'));
  const git = (args) => d.git(args);
  const L = ['Fechar o promove: a etiqueta publicado está em ' + curto(etiqueta) + '; ' + conta(staging.length, 'cartão', 'cartões') + ' em ' + nomeDaColuna(STAGING) + '.'];
  const vao = [], ficam = [];
  // os subtickets (KAN-N-X) primeiro, julgados pelos commits do pai: se o pai fosse antes, o primeiro
  // subticket a mover-se trazia-o de volta a Staging (o pai segue os subtickets: lib/kanban.js:passosDoPaiSegue)
  staging.sort((x, y) => (x.sub == null ? 1 : 0) - (y.sub == null ? 1 : 0));
  staging.forEach((k) => {
    const n = k.sub != null && k.pai ? numeroDaChave(k.pai.chave) : Number(k.numero);
    const deles = historia.filter((c) => chavesDaMensagem(c.mensagem).includes(n));
    const falta = deles.filter((c) => !naEtiqueta(git, c.sha, etiqueta).publicado);
    if (falta.length) ficam.push({ k, falta });
    else vao.push({ k, deles });
  });
  let falhou = 0;
  vao.forEach(({ k, deles }) => {
    const como = deles.length ? conta(deles.length, 'commit', 'commits') + ' em produção (' + deles.map((c) => curto(c.sha)).join(', ') + ')' : 'sem commits no dev';
    if (o.seco) { L.push('  iria: ' + k.chave + ' → ' + nomeDaColuna(PRODUCAO) + ' — ' + como + '.'); return; }
    const r = d.mover(k.chave, PRODUCAO, o.local);
    if (r.codigo === 0) L.push('  ' + k.chave + ' → ' + nomeDaColuna(PRODUCAO) + ' — ' + como + '.');
    else { falhou++; L.push('  ' + k.chave + ' NÃO mudou: ' + String(r.err || r.out).trim()); }
  });
  ficam.forEach(({ k, falta }) => L.push('  ' + k.chave + ' fica em ' + nomeDaColuna(STAGING) + ': ainda não estão em produção ' + falta.map((c) => curto(c.sha) + ' «' + c.assunto + '»').join(', ') + '.'));
  if (o.seco) L.push('(--seco: não mexi em nenhum cartão.)');
  const pedidos = vao.filter(({ k }) => k.origem && k.origem.tipo === 'pedido');
  if (pedidos.length && !o.seco) L.push('Os pedidos destes cartões fecham-se pela skill ticket (ticket.mjs propor --prod): ' + pedidos.map(({ k }) => k.chave).join(', ') + '.');
  return { texto: L.join('\n'), codigo: falhou ? 1 : 0 };
}

/* Corre a linha de comandos e devolve o código de saída; os erros conhecidos
   saem numa linha clara no stderr, sem pilha.
   Recebe: argv — os argumentos depois do script; deps (opcional) — as
   dependências a trocar (dependencias), para os testes; saida (opcional) —
   { out, err }, onde escrever.
   Devolve: o código de saída (0 bem, 1 falhou ou parou, 2 argumentos). */
export function principal(argv, deps, saida) {
  const out = (saida && saida.out) || ((t) => process.stdout.write(t));
  const err = (saida && saida.err) || ((t) => process.stderr.write(t));
  try {
    const o = lerArgumentos(argv);
    const d = dependencias(deps);
    const r = { plano: cmdPlano, ramo: cmdRamo, fechar: cmdFechar }[o.comando](o, d);
    (r.codigo ? err : out)((r.codigo ? 'promover: ' : '') + r.texto + '\n');
    return r.codigo;
  } catch (e) {
    if (e instanceof ErroPromover || e instanceof ErroKanban || e instanceof ErroTicket) {
      err('promover: ' + e.message + '\n');
      return e.codigo || 1;
    }
    err('promover: falha inesperada: ' + (e && e.stack || e) + '\n');
    return 1;
  }
}

/* O caminho verdadeiro de um ficheiro, para comparar: o Windows chega a dar o
   mesmo sítio com nomes curtos (MARTIN~1) ou com outras maiúsculas.
   Recebe: p — o caminho.
   Devolve: o caminho resolvido, em minúsculas. */
function caminhoReal(p) {
  try { return realpathSync.native(p).toLowerCase(); } catch (e) { return path.resolve(p).toLowerCase(); }
}

// só corre a linha de comandos quando é o ponto de entrada (os testes importam as funções)
if (process.argv[1] && caminhoReal(process.argv[1]) === caminhoReal(fileURLToPath(import.meta.url))) {
  process.exitCode = principal(process.argv.slice(2));
}
