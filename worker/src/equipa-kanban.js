import { GUIAO_KB_FILTROS, CSS_KB_FILTROS } from './equipa-kanban-filtros.js';
import { GUIAO_KB_ARRASTO, CSS_KB_ARRASTO } from './equipa-kanban-arrasto.js';
import { GUIAO_KB_JANELA, CSS_KB_JANELA } from './equipa-kanban-janela.js';

/* O kanban da equipa no back office (/equipa#kanban): o quadro, o arrastar,
   o cartão aberto, os filtros e as colunas.
   ---------------------------------------------------------------------
   Vive aqui como texto, como o guião principal (equipa-guiao.js), e o worker
   serve-o em /equipa/kanban.js — só a quem tem sessão de equipa — e o CSS
   em /equipa/kanban.css (paginas-recursos.js). A página só os pede fora de
   produção: o kanban existe só no dev.

   É um script clássico que corre DEPOIS do guião e ANTES do
   DOMContentLoaded: usa os globais dele (DADOS, eu, el, esc, ligarA,
   comAcao, ic, ICONES, pedir, enviar, avisar, vazioHtml, esperaHtml, falha,
   cabecalho, marcarErro, ir, ACOES…) e acrescenta-lhes o que é seu — os
   nomes de topo começam por kb ou kanban, menos os dois pontos de encaixe
   que o guião chama: verKanban(resto) e novoCartao(). Só function e var,
   que são os que ficam em window num script clássico.

   As mesmas regras do guião: é um String.raw (nem crases nem cifrão com
   chaveta cá dentro; as quebras escrevem-se \n); a página vai com a
   CSP_ESTRITA, por isso nada de atributos de evento nem de estilo no HTML
   que se monta — os cliques vão por data-acao para a tabela ACOES (as
   ações daqui começam por kb), e o que mexe durante o arrasto mexe por
   CSSOM (el.style.transform), que a CSP deixa. Nada de alert, prompt,
   confirm nem do seletor nativo: o que pede valores abre a janela
   (dialog#dialogo), e as escolhas são chips ou listas de botões.

   As rotas que isto chama são as /api/equipa/kanban (rotas/kanban.js).

   O guião vive em quatro ficheiros, cada um com o seu pedaço e os estilos
   dele: este (o estado, o quadro, o segmentado do telemóvel, o cartão aberto
   e o que se faz no cartão), equipa-kanban-filtros.js (os filtros, a
   ordenação, o cabeçalho e o formulário do cartão), equipa-kanban-arrasto.js
   (o arrasto e o mover) e equipa-kanban-janela.js (a janela e as colunas).
   O GUIAO_KANBAN e o CSS_KANBAN juntam-nos por esta ordem; como é um só
   script clássico, as funções de um pedaço veem as dos outros. */

// o pedaço daqui do guião
const GUIAO_KB_QUADRO = String.raw`/* ------------------------------ o estado ------------------------------ */

// o quadro que veio do servidor: {colunas, cartoes, etiquetas, pessoas, eu}; null antes da primeira leitura
var kbEstado = null;
// a pesquisa: null sem ela; senão {texto, chaves: {'KAN-7': true, …}} com o que o servidor achou
var kbQ = null;
// os filtros, guardados na sessão do browser (q, tipo, etiqueta, responsavel, prioridade, pai)
var kbFiltros = kbLerFiltros();
// a chave do cartão aberto ('' sem nenhum) e o detalhe dele
var kbAberto = '', kbDetalhe = null;
// a vez de cada leitura: uma resposta atrasada não pinta por cima de uma mais nova
var kbVez = 0, kbVezCartao = 0, kbVezQ = 0;
// quantos movimentos esperam pelo servidor: enquanto houver, uma leitura de fundo não repinta
var kbEmVoo = 0;
// o arrasto em curso (kbPousar) e quando acabou o último, para engolir o clique que se segue
var kbArr = null, kbArrAcabou = 0;
// um repintar pedido a meio de um arrasto, feito quando ele acaba
var kbPintarDepois = false;
// a janela do kanban aberta: {aoConfirmar, botao, ocupado}
var kbJanelaAberta = null;
// no telemóvel: a coluna à vista (índice) e se os chips dos filtros estão abertos
var kbColunaVista = 0, kbFiltrosAbertos = false;
// os temporizadores da pesquisa enquanto se escreve e da rolagem de lado
var kbQTempo = 0, kbRolaTempo = 0;
// o deslize que o segmentado do telemóvel pediu ({i, x}), até chegar ou um dedo pousar no quadro; null sem nenhum
var kbAlvoSeg = null;
// o que fazer quando o quadro acabar de carregar (o novoCartao de fora do Kanban)
var kbAoCarregar = null;

var KB_TIPOS = ['epico', 'historia', 'tarefa', 'subtarefa', 'erro'];
var KB_NOMES_TIPOS = { epico: 'Épico', historia: 'História', tarefa: 'Tarefa', subtarefa: 'Subtarefa', erro: 'Erro' };
var KB_PRIORIDADES = { 1: 'Mais alta', 2: 'Alta', 3: 'Média', 4: 'Baixa', 5: 'Mais baixa' };
var KB_LIGACOES = { bloqueia: 'Bloqueia', bloqueado: 'É bloqueado por', relaciona: 'Relaciona-se com' };
var KB_FILTROS = { tipo: 'tipo', etiqueta: 'etiqueta', responsavel: 'responsável', prioridade: 'prioridade', pai: 'épico' };
// os estados de um ticket de QA e de um pedido, como a origem os diz (lib/kanban.js)
var KB_ESTADOS_ORIGEM = { aberto: 'Aberto', em_resolucao: 'Em resolução', resolvido: 'Resolvido', removido: 'Removido', reposto: 'Reposto',
  aceite: 'Aceite', resolucao: 'Em resolução', proposta: 'Resposta proposta', concluido: 'Concluído' };
var KB_SUB ='As tarefas da equipa: o que há para fazer, o que se testa e o que ficou feito.';

/* Os desenhos novos, em traço de 1.8 como os outros: o tipo de cada cartão,
   a prioridade, e as peças do cartão (pega, ações, comentários, anexos,
   ligações, bloqueado). */
ICONES.kbEpico = '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7z"/>';
ICONES.kbHistoria = '<path d="M7 4h10v16l-5-4-5 4z"/>';
ICONES.kbTarefa = '<path d="M5 5h14v14H5zM9 12l2 2 4-4"/>';
ICONES.kbSubtarefa = '<path d="M4 4h8v8H4zM8 12v4a2 2 0 0 0 2 2h4M14 14h6v6h-6z"/>';
ICONES.kbErro = '<path d="M8 10h8v6a4 4 0 0 1-8 0zM9 10V8a3 3 0 0 1 6 0v2M4 13h4M16 13h4M5 19l3-2M19 19l-3-2M5 7l3 2M19 7l-3 2"/>';
ICONES.kbP1 = '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>';
ICONES.kbP2 = '<path d="M6 15l6-6 6 6"/>';
ICONES.kbP3 = '<path d="M5 9h14M5 15h14"/>';
ICONES.kbP4 = '<path d="M6 9l6 6 6-6"/>';
ICONES.kbP5 = '<path d="M6 5l6 6 6-6M6 11l6 6 6-6"/>';
ICONES.kbPega = '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>';
ICONES.kbMais = '<path d="M5 12h.01M12 12h.01M19 12h.01"/>';
ICONES.kbComentario = '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 20 12z"/>';
ICONES.kbAnexo = '<path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>';
ICONES.kbLigacao = '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>';
ICONES.kbBloqueado = '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8"/>';
ICONES.kbCopiar = '<path d="M9 9h11v11H9zM5 15H4V4h11v1"/>';
ICONES.kbEditar = '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>';
ICONES.kbFiltro = '<path d="M4 6h16M7 12h10M10 18h4"/>';
ICONES.kbColunas = '<path d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z"/>';
ICONES.kbVisto = '<path d="M5 12l5 5 9-10"/>';
ICONES.kbPrazo = '<path d="M5 5h14v15H5zM5 10h14M9 3v4M15 3v4"/>';

/* ------------------------------ peças soltas ----------------------------- */

// Quem pediu ao sistema menos movimento.
// Devolve: true quando o prefers-reduced-motion pede menos.
function kbReduzido() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
// O quadro do telemóvel: uma coluna de cada vez (abaixo dos 900px).
// Devolve: true abaixo dos 900px.
function kbTelemovel() {
  return typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches;
}
// Uma contagem dita como se diz: 1 cartão, 3 cartões (nunca «cartão(s)»).
// Recebe: n — o número; um — a palavra no singular; varios — no plural.
// Devolve: o texto.
function kbConta(n, um, varios) {
  n = Number(n) || 0;
  return n === 1 ? '1 ' + um : n + ' ' + varios;
}
// Um dia AAAA-MM-DD à portuguesa: 2026-11-09 → 09/11/2026 (o texto tal e qual se não for um dia).
// Recebe: s — o dia.
// Devolve: o texto.
function kbDia(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || '');
}
// O dia de hoje no fuso de quem vê, em AAAA-MM-DD (nunca pelo toISOString, que é UTC).
// Devolve: o texto.
function kbHoje() {
  var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
// Uma chave de cartão escrita de qualquer maneira (KAN-7, kan-7, 7) na forma certa.
// Recebe: t — o texto.
// Devolve: 'KAN-7', ou '' quando não é uma chave.
function kbChave(t) {
  var m = /^\s*(?:kan-)?(\d{1,7})\s*$/i.exec(String(t == null ? '' : t));
  return m ? 'KAN-' + Number(m[1]) : '';
}
// O caminho da API de um cartão.
// Recebe: chave — a chave (KAN-7); resto (opcional) — o que vem a seguir (/mover…).
// Devolve: o caminho.
function kbRota(chave, resto) {
  return '/api/equipa/kanban/cartoes/' + encodeURIComponent(chave) + (resto || '');
}
// Quem está, como o quadro o diz (o eu do GET), ou pela sessão antes da primeira leitura.
// Devolve: {id, nome, master}.
function kbEu() {
  if (kbEstado && kbEstado.eu) return kbEstado.eu;
  return { id: eu.discordId, nome: eu.nome, master: !!eu.master };
}
// Uma coluna do quadro pelo id.
// Recebe: id — o id da coluna.
// Devolve: a coluna, ou null.
function kbColuna(id) {
  var cs = (kbEstado && kbEstado.colunas) || [];
  for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
  return null;
}
// O nome de uma coluna (o id, se já não existir).
// Recebe: id — o id da coluna.
// Devolve: o texto (por escapar).
function kbNomeColuna(id) { var c = kbColuna(id); return c ? c.nome : String(id || ''); }
// O nome de uma pessoa pelo id (o próprio texto, se não a conhecer).
// Recebe: id — o id do Discord, 'claude' ou 'automatico'.
// Devolve: o texto (por escapar).
function kbNomePessoa(id) {
  var ps = (kbEstado && kbEstado.pessoas) || [];
  for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i].nome;
  if (id === 'automatico') return 'Sincronização';
  return String(id || '');
}
// Um cartão do quadro pela chave.
// Recebe: chave — KAN-N.
// Devolve: o cartão (CartaoCurto), ou null.
function kbCartao(chave) {
  var cs = (kbEstado && kbEstado.cartoes) || [];
  for (var i = 0; i < cs.length; i++) if (cs[i].chave === chave) return cs[i];
  return null;
}
// Os cartões de uma coluna, todos, pela ordem do quadro.
// Recebe: id — o id da coluna.
// Devolve: a lista.
function kbDaColuna(id) {
  return ((kbEstado && kbEstado.cartoes) || []).filter(function (c) { return c.coluna_id === id; });
}

/* ---------------------------- o quadro (pintar) -------------------------- */

/* Abre o Kanban — o ponto de encaixe que o guião chama ao chegar à secção
   (ir('kanban', resto)). Lê o quadro; com uma chave no resto abre o cartão
   por cima dele (#kanban/KAN-77). Com o quadro já no ecrã, relê-o sem o
   apagar.
   Recebe: resto — '' ou a chave de um cartão.
   Devolve: nada — pinta o quadro quando o servidor responde. */
function verKanban(resto) {
  var chave = kbChave(resto), vez = ++kbVez, ja = !!(el('kbQuadro') && kbEstado);
  if (!ja) {
    kbAberto = ''; kbDetalhe = null;
    el('conteudo').innerHTML = '<div class="kb-cab">' + cabecalho('Kanban', KB_SUB) + '</div><div id="kbEspera">' + esperaHtml('A ler o quadro.') + '</div>';
  }
  kbLer().then(function (r) {
    if (vez !== kbVez || !(el('kbQuadro') || el('kbEspera'))) return;
    kbEstado = r.estado; kbQ = r.q;
    if (el('kbQuadro')) { kbPintarQuadro(); kbPintarChips(); } else kbPintar();
    if (chave) { if (chave !== kbAberto || !kbDetalhe) kbAbrir(chave, true); }
    else if (kbAberto) kbFechar();
    var depois = kbAoCarregar; kbAoCarregar = null;
    if (depois) depois();
  }).catch(function (e) {
    if (vez !== kbVez) return;
    if (el('kbQuadro')) avisar(e.message || 'Não deu para ler o quadro.', 'erro');
    else if (el('kbEspera')) falha(e, 'kbTentar', [chave]);
  });
}
/* Lê o quadro inteiro e, com pesquisa, o que ela acha (dois pedidos ao mesmo
   tempo; o quadro vem sempre sem filtros).
   Devolve: Promise de {estado, q}. */
function kbLer() {
  var texto = kbFiltros.q;
  return Promise.all([
    pedir('/api/equipa/kanban'),
    texto ? pedir('/api/equipa/kanban?q=' + encodeURIComponent(texto)) : null,
  ]).then(function (rs) {
    return { estado: kbNormalizar(rs[0]), q: texto && rs[1] ? kbChavesDe(rs[1], texto) : null };
  });
}
// O quadro como vem do servidor, com as listas garantidas.
// Recebe: j — a resposta do GET.
// Devolve: {colunas, cartoes, etiquetas, pessoas, eu}.
function kbNormalizar(j) {
  return {
    colunas: (j.colunas || []).slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); }),
    cartoes: j.cartoes || [], etiquetas: j.etiquetas || [], pessoas: j.pessoas || [],
    eu: j.eu || { id: eu.discordId, nome: eu.nome, master: !!eu.master },
  };
}
// As chaves que a pesquisa achou, num conjunto.
// Recebe: j — a resposta do GET com q; texto — o que se procurou.
// Devolve: {texto, chaves}.
function kbChavesDe(j, texto) {
  var chaves = {};
  (j.cartoes || []).forEach(function (c) { chaves[c.chave] = true; });
  return { texto: texto, chaves: chaves };
}
/* Relê o quadro calado (depois de uma mudança), sem apagar o que está no
   ecrã; não pinta enquanto houver movimentos à espera do servidor.
   Devolve: Promise (resolve quando pintou, ou quando já não havia nada a pintar). */
function kbRecarregar() {
  var vez = ++kbVez;
  return kbLer().then(function (r) {
    if (vez !== kbVez || kbEmVoo > 0 || !el('kbQuadro')) return;
    kbEstado = r.estado; kbQ = r.q;
    kbPintarQuadro(); kbPintarChips();
  }).catch(function (e) {
    if (vez === kbVez && el('kbQuadro')) avisar(e.message || 'Não deu para ler o quadro.', 'erro');
  });
}

/* Pinta as colunas e o segmentado, guardando o que se perdia ao trocar o
   HTML: a rolagem de lado do quadro, a de cada coluna e o foco. A meio de um
   arrasto não mexe (pinta quando ele acaba).
   Devolve: nada. */
function kbPintarQuadro() {
  var q = el('kbQuadro');
  if (!q || !kbEstado) return;
  if (kbArr) { kbPintarDepois = true; return; }
  var x = q.scrollLeft, tops = {};
  [].slice.call(q.querySelectorAll('.kb-col-lista')).forEach(function (l) { tops[l.getAttribute('data-coluna')] = l.scrollTop; });
  var foco = document.activeElement, chaveFoco = null;
  if (foco && foco.getAttribute && q.contains(foco) && foco.getAttribute('data-acao')) {
    chaveFoco = '[data-acao="' + foco.getAttribute('data-acao') + '"][data-arg="' + String(foco.getAttribute('data-arg') || '').replace(/["\\]/g, '') + '"]';
  }
  q.innerHTML = kbEstado.colunas.map(kbColunaHtml).join('') ||
    vazioHtml('O quadro não tem colunas.', kbEu().master ? 'Adiciona a primeira em «Colunas».' : 'Pede ao master para adicionar as colunas.');
  q.scrollLeft = x;
  [].slice.call(q.querySelectorAll('.kb-col-lista')).forEach(function (l) {
    var t = tops[l.getAttribute('data-coluna')];
    if (t) l.scrollTop = t;
  });
  if (chaveFoco) { var f = q.querySelector(chaveFoco); if (f && f.focus) f.focus({ preventScroll: true }); }
  kbPintarSeg();
  kbMedirTopo();
}
/* Uma coluna: o nome e a contagem (com filtros, «3 de 10»), os cartões que
   os filtros deixam ver — ou o vazio honesto — e o «Adicionar cartão».
   Recebe: c — a coluna ({id, nome, fim, total}).
   Devolve: o HTML. */
function kbColunaHtml(c) {
  var todos = kbDaColuna(c.id), vis = kbVisiveis(c.id), filtrado = kbQuantosFiltros(kbFiltros) > 0;
  var n = filtrado ? vis.length + ' de ' + todos.length : String(todos.length);
  var vazio = vis.length ? '' : '<p class="kb-col-vazio">' + (todos.length ? 'Nada com estes filtros.' : 'Nenhum cartão.') + '</p>';
  return '<section class="kb-col' + (c.fim ? ' kb-col-fim' : '') + '" data-coluna="' + esc(c.id) + '" aria-labelledby="kbCol-' + esc(c.id) + '">' +
    '<header class="kb-col-cab"><h2 class="kb-col-nome" id="kbCol-' + esc(c.id) + '">' + esc(c.nome) + '</h2>' +
    '<span class="kb-col-n n"><span class="so-leitor">, </span>' + n + '<span class="so-leitor"> ' + (todos.length === 1 && !filtrado ? 'cartão' : 'cartões') + '</span></span>' +
    (c.fim ? '<span class="kb-col-marca" title="Coluna de fim: o que chega aqui conta como feito">' + ic('kbVisto', 'i-sm') + '<span class="so-leitor">coluna de fim</span></span>' : '') + '</header>' +
    '<div class="kb-col-lista" data-coluna="' + esc(c.id) + '">' + vis.map(kbCartaoHtml).join('') + vazio + '</div>' +
    '<div class="kb-col-pe"><button type="button" class="btn sm ghost kb-col-mais"' + comAcao('kbNovo', [c.id]) + '>' +
    ic('mais', 'i-sm') + 'Adicionar cartão<span class="so-leitor"> em ' + esc(c.nome) + '</span></button></div></section>';
}
// O ícone do tipo de um cartão, com o nome para o leitor de ecrã.
// Recebe: tipo — epico, historia, tarefa, subtarefa ou erro.
// Devolve: o HTML.
function kbTipoHtml(tipo) {
  var t = KB_NOMES_TIPOS[tipo] ? tipo : 'tarefa';
  return '<span class="kb-tipo kb-t-' + t + '" title="' + KB_NOMES_TIPOS[t] + '">' + ic('kb' + maiuscula(t), 'i-sm') +
    '<span class="so-leitor">' + KB_NOMES_TIPOS[t] + '</span></span>';
}
// O ícone da prioridade, na cor dela e com o nome para o leitor de ecrã.
// Recebe: p — de 1 (mais alta) a 5 (mais baixa).
// Devolve: o HTML.
function kbPrioridadeHtml(p) {
  p = KB_PRIORIDADES[p] ? Number(p) : 3;
  return '<span class="kb-prio kb-p' + p + '" title="Prioridade ' + KB_PRIORIDADES[p].toLowerCase() + '">' + ic('kbP' + p, 'i-sm') +
    '<span class="so-leitor">Prioridade ' + KB_PRIORIDADES[p].toLowerCase() + '</span></span>';
}
/* Um cartão no quadro. O botão do título abre-o e, pelo ::after, cobre o
   cartão inteiro; a pega (arrastar no dedo, ou «Mover para…» com um toque)
   e o ⋯ (as ações) ficam por cima dele, como irmãos — nunca um botão dentro
   de outro. O resto (etiquetas, épico, progresso, contadores, responsável)
   é para ler.
   Recebe: c — o cartão (CartaoCurto).
   Devolve: o HTML. */
function kbCartaoHtml(c) {
  var marcas = '';
  if (c.pai) {
    marcas += '<span class="kb-pai' + (c.pai.tipo === 'epico' ? ' kb-pai-epico' : '') + '" title="' + esc(c.pai.chave + ' · ' + c.pai.titulo) + '">' +
      (c.pai.tipo === 'epico' ? ic('kbEpico', 'i-sm') : '') + '<span class="so-leitor">' + (c.pai.tipo === 'epico' ? 'Épico: ' : 'Pertence a ') + '</span>' +
      esc(c.pai.tipo === 'epico' ? c.pai.titulo : c.pai.chave) + '</span>';
  }
  marcas += (c.etiquetas || []).map(function (t) { return '<span class="kb-etq">' + esc(t) + '</span>'; }).join('');
  var pe = '';
  if (c.bloqueado) pe += '<span class="kb-bloq-selo">' + ic('kbBloqueado', 'i-sm') + 'Bloqueado</span>';
  var st = c.subtarefas || { total: 0, feitas: 0 };
  if (st.total) {
    pe += '<span class="kb-cont kb-prog" title="' + esc(st.feitas + ' de ' + kbConta(st.total, 'subtarefa feita', 'subtarefas feitas')) + '">' +
      '<progress class="kb-barra" max="' + st.total + '" value="' + st.feitas + '"></progress><span class="n">' + st.feitas + '/' + st.total + '</span>' +
      '<span class="so-leitor"> subtarefas feitas</span></span>';
  }
  if (c.prazo) {
    var fim = kbColuna(c.coluna_id), passou = !(fim && fim.fim) && c.prazo < kbHoje();
    pe += '<span class="kb-cont kb-prazo' + (passou ? ' kb-atrasado' : '') + '">' + ic('kbPrazo', 'i-sm') +
      '<span class="so-leitor">' + (passou ? 'Prazo passado: ' : 'Prazo: ') + '</span><span class="n">' + esc(kbDia(c.prazo).slice(0, 5)) + '</span></span>';
  }
  if (c.comentarios) pe += '<span class="kb-cont" title="' + kbConta(c.comentarios, 'comentário', 'comentários') + '">' + ic('kbComentario', 'i-sm') +
    '<span class="n">' + esc(c.comentarios) + '</span><span class="so-leitor"> ' + (c.comentarios === 1 ? 'comentário' : 'comentários') + '</span></span>';
  if (c.anexos) pe += '<span class="kb-cont" title="' + kbConta(c.anexos, 'anexo', 'anexos') + '">' + ic('kbAnexo', 'i-sm') +
    '<span class="n">' + esc(c.anexos) + '</span><span class="so-leitor"> ' + (c.anexos === 1 ? 'anexo' : 'anexos') + '</span></span>';
  if (c.responsavel) pe += '<span class="kb-avatar" title="' + esc(c.responsavel.nome) + '">' + esc(iniciais(c.responsavel.nome)) +
    '<span class="so-leitor">, responsável: ' + esc(c.responsavel.nome) + '</span></span>';
  return '<article class="kb-cartao' + (c.bloqueado ? ' kb-bloq' : '') + (c.chave === kbAberto ? ' kb-aberto' : '') + '" data-chave="' + esc(c.chave) + '">' +
    '<div class="kb-c-topo">' + kbTipoHtml(c.tipo) + '<span class="kb-chave n">' + esc(c.chave) + '</span>' + kbPrioridadeHtml(c.prioridade) +
    '<button type="button" class="kb-pega" aria-label="Mover ' + esc(c.chave) + '"' + comAcao('kbMoverPara', [c.chave]) + '>' + ic('kbPega') + '</button>' +
    '<button type="button" class="kb-mais" aria-label="Ações de ' + esc(c.chave) + '" aria-haspopup="dialog"' + comAcao('kbMenuCartao', [c.chave]) + '>' + ic('kbMais') + '</button></div>' +
    '<p class="kb-c-tit"><button type="button" class="kb-abrir"' + (c.chave === kbAberto ? ' aria-current="true"' : '') + comAcao('kbAbrir', [c.chave]) + '>' +
    '<span class="so-leitor">' + esc(c.chave) + ': </span>' + esc(c.titulo) + '</button></p>' +
    (marcas ? '<div class="kb-c-marcas">' + marcas + '</div>' : '') +
    (pe ? '<div class="kb-c-pe">' + pe + '</div>' : '') + '</article>';
}

/* -------------------------- o telemóvel: as colunas ------------------------ */

/* O segmentado do telemóvel: uma pílula por coluna, com a contagem; a
   escolhida na cor da frente (contorno e letra), não só no fundo.
   Devolve: nada — redesenha o #kbSeg. */
function kbPintarSeg() {
  var s = el('kbSeg');
  if (!s || !kbEstado) return;
  var n = kbEstado.colunas.length;
  if (kbColunaVista >= n) kbColunaVista = Math.max(0, n - 1);
  s.innerHTML = kbEstado.colunas.map(function (c, i) {
    return '<button type="button" class="kb-seg-op"' + (i === kbColunaVista ? ' aria-current="true"' : '') + comAcao('kbVerColuna', [i]) + '>' +
      esc(c.nome) + ' <span class="n kb-seg-n">' + kbVisiveis(c.id).length + '</span></button>';
  }).join('');
}
/* Leva o quadro do telemóvel à coluna i (desliza; de uma vez com menos movimento).
   Recebe: i — o índice da coluna.
   Devolve: nada. */
function kbVerColuna(i) {
  var q = el('kbQuadro'), cols = q ? q.querySelectorAll('.kb-col') : [];
  i = Math.max(0, Math.min(cols.length - 1, Number(i) || 0));
  if (!cols[i]) return;
  kbColunaVista = i;
  kbMarcarSeg();
  var x = cols[i].offsetLeft - cols[0].offsetLeft;
  if (q.scrollTo) q.scrollTo({ left: x, behavior: kbReduzido() ? 'auto' : 'smooth' });
  else q.scrollLeft = x;
  /* um deslizar que ainda assentava (o snap de um gesto anterior) pode
     cortar o scrollTo a meio: passado o tempo do deslize, se não chegou,
     vai de uma vez; até lá, a rolagem não muda a pílula escolhida. Um dedo
     que pouse no quadro entretanto manda ele (kbLargarAlvo). */
  var alvo = { i: i, x: x };
  kbAlvoSeg = alvo;
  setTimeout(function () {
    if (kbAlvoSeg !== alvo) return;
    kbAlvoSeg = null;
    if (el('kbQuadro') === q && Math.abs(q.scrollLeft - x) > 2) q.scrollLeft = x;
  }, 700);
}
// O dedo pousou no quadro: o deslize pedido pelo segmentado deixa de mandar.
// Devolve: nada.
function kbLargarAlvo() { kbAlvoSeg = null; }
/* Acerta a pílula escolhida do segmentado e trá-la à vista, rolando só o segmentado.
   Devolve: nada. */
function kbMarcarSeg() {
  var s = el('kbSeg');
  if (!s) return;
  var ops = s.querySelectorAll('.kb-seg-op');
  for (var i = 0; i < ops.length; i++) {
    if (i === kbColunaVista) ops[i].setAttribute('aria-current', 'true'); else ops[i].removeAttribute('aria-current');
  }
  var o = ops[kbColunaVista];
  if (o && s.scrollWidth > s.clientWidth) {
    var x = o.offsetLeft - ops[0].offsetLeft;
    if (x < s.scrollLeft || x + o.offsetWidth > s.scrollLeft + s.clientWidth) s.scrollLeft = Math.max(0, x - 16);
  }
}
/* O quadro rolou de lado (o dedo a deslizar, no telemóvel): quando pára,
   a coluna que ficou à vista passa a ser a escolhida no segmentado.
   Devolve: nada. */
function kbAoRolar() {
  clearTimeout(kbRolaTempo);
  kbRolaTempo = setTimeout(function () {
    var q = el('kbQuadro');
    if (!q || !kbTelemovel() || kbAlvoSeg) return;
    var cols = q.querySelectorAll('.kb-col');
    if (cols.length < 2) return;
    var passo = cols[1].offsetLeft - cols[0].offsetLeft;
    var i = passo > 0 ? Math.round(q.scrollLeft / passo) : 0;
    if (i !== kbColunaVista) { kbColunaVista = Math.max(0, Math.min(cols.length - 1, i)); kbMarcarSeg(); }
  }, 90);
}
/* Mede onde começa o quadro, para as colunas ocuparem o resto do ecrã (cada
   uma rola por dentro, e o quadro rola de lado sem a página).
   Devolve: nada — acerta a variável --kb-topo do #kbVista. */
function kbMedirTopo() {
  var v = el('kbVista');
  if (!v || !v.getBoundingClientRect || !v.style) return;
  var topo = v.getBoundingClientRect().top + (window.scrollY || 0);
  v.style.setProperty('--kb-topo', Math.max(0, Math.round(topo)) + 'px');
}

/* «Mover para…»: o caminho do teclado e do leitor de ecrã (e do telemóvel,
   para mudar de coluna). Outra coluna põe o cartão no topo dela; na mesma,
   sobe, desce, vai ao topo ou ao fim.
   Recebe: chave.
   Devolve: nada — abre a janela. */
function kbMoverPara(chave) {
  var c = kbCartao(chave);
  if (!c) return;
  var ordem = kbDaColuna(c.coluna_id).map(function (x) { return x.chave; }), i = ordem.indexOf(chave), n = ordem.length;
  var linha = function (rotulo, coluna, indice) {
    return '<button type="button" class="btn lista kb-opcao"' + comAcao('kbMover', [chave, coluna, indice]) + '>' + rotulo + '</button>';
  };
  var outras = kbEstado.colunas.filter(function (x) { return x.id !== c.coluna_id; }).map(function (x) {
    return linha('<span class="flex1">' + esc(x.nome) + '</span><span class="sub n">' + kbDaColuna(x.id).length + '</span>', x.id, 0);
  }).join('');
  var aqui = (i > 0 ? linha('Para o topo', c.coluna_id, 0) + (i > 1 ? linha('Subir um lugar', c.coluna_id, i - 1) : '') : '') +
    (i < n - 1 ? (i < n - 2 ? linha('Descer um lugar', c.coluna_id, i + 1) : '') + linha('Para o fim', c.coluna_id, n - 1) : '');
  kbJanela('Mover ' + chave, '<p class="sub">Está em <b>' + esc(kbNomeColuna(c.coluna_id)) + '</b>, ' + (i + 1) + '.º de ' + n + '.</p>' +
    (outras ? '<p class="lbl">Para a coluna</p><div class="kb-opcoes">' + outras + '</div>' : '') +
    (aqui ? '<p class="lbl">Nesta coluna</p><div class="kb-opcoes">' + aqui + '</div>' : ''), { foco: '.kb-opcao' });
}

/* ------------------------------ o cartão aberto ---------------------------- */

/* Abre um cartão (tocar num cartão é lê-lo): ao lado do quadro no
   computador, a folha inteira no telemóvel; o endereço passa a
   #kanban/KAN-N. Com o cartão já aberto, relê-o sem mexer no foco.
   Recebe: chave; foco — true para levar o foco ao título (abrir), false ao reler.
   Devolve: nada. */
function kbAbrir(chave, foco) {
  chave = kbChave(chave);
  if (!chave || !el('kbPainel')) return;
  var novo = chave !== kbAberto || !kbDetalhe, vez = ++kbVezCartao, sitio = el('kbPainel');
  if (novo) {
    var entra = !kbAberto;
    kbAberto = chave; kbDetalhe = null;
    kbMarcarAberto();
    sitio.innerHTML = '<section class="kb-painel card' + (entra ? ' kb-entra' : '') + '" aria-label="Cartão ' + esc(chave) + '">' + kbPainelCabHtml(null, chave) +
      esperaHtml('A abrir ' + esc(chave) + '.') + '</section>';
    el('kbVista').classList.add('kb-com-painel');
    if (typeof marcarEndereco === 'function') marcarEndereco('kanban', chave);
    document.title = chave + ' · Kanban · Rendorium Equipa';
    var x = sitio.querySelector('.kb-p-fechar');
    if (foco !== false && x && x.focus) x.focus({ preventScroll: true });
  }
  pedir(kbRota(chave)).then(function (d) {
    if (vez !== kbVezCartao || kbAberto !== chave || !el('kbPainel')) return;
    kbDetalhe = d;
    var p = el('kbPainel').querySelector('.kb-painel'), topo = p ? p.scrollTop : 0;
    // a entrada animou-se com a espera: o conteúdo troca-a no sítio, sem entrar outra vez
    el('kbPainel').innerHTML = kbPainelHtml(d, false);
    var p2 = el('kbPainel').querySelector('.kb-painel');
    if (p2 && !novo) p2.scrollTop = topo;
    var t = el('kbPainelTit');
    if (novo && foco !== false && t && t.focus) t.focus({ preventScroll: true });
  }).catch(function (e) {
    if (vez !== kbVezCartao || kbAberto !== chave || !el('kbPainel')) return;
    el('kbPainel').innerHTML = '<section class="kb-painel card" aria-label="Cartão ' + esc(chave) + '">' + kbPainelCabHtml(null, chave) +
      '<div class="kb-p-corpo">' + vazioHtml(e && e.status === 404 ? 'O cartão ' + esc(chave) + ' não existe.' : 'Não deu para abrir o cartão.',
        esc(e && e.status === 404 ? 'Pode ter sido removido.' : (e && e.message) || ''),
        e && e.status === 404 ? '' : '<button type="button" class="btn sm"' + comAcao('kbAbrir', [chave]) + '>Tentar outra vez</button>') + '</div></section>';
  });
}
// Marca no quadro o cartão aberto (contorno na cor da frente e aria-current).
// Devolve: nada.
function kbMarcarAberto() {
  var q = el('kbQuadro');
  if (!q) return;
  [].slice.call(q.querySelectorAll('.kb-cartao')).forEach(function (n) {
    var on = n.getAttribute('data-chave') === kbAberto, b = n.querySelector('.kb-abrir');
    n.classList.toggle('kb-aberto', on);
    if (b) { if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
  });
}
/* Fecha o cartão: o painel sai (a folha desce um pouco e apaga-se), o
   endereço volta a #kanban e o foco volta ao cartão no quadro.
   Devolve: nada. */
function kbFechar() {
  var chave = kbAberto, sitio = el('kbPainel'), p = sitio && sitio.querySelector('.kb-painel');
  kbAberto = ''; kbDetalhe = null; kbVezCartao++;
  kbMarcarAberto();
  if (typeof marcarEndereco === 'function') marcarEndereco('kanban', '');
  document.title = 'Kanban · Rendorium Equipa';
  var limpar = function () {
    if (kbAberto || !el('kbPainel')) return;
    el('kbPainel').innerHTML = '';
    if (el('kbVista')) el('kbVista').classList.remove('kb-com-painel');
  };
  if (p && !kbReduzido()) { p.classList.remove('kb-entra'); p.classList.add('kb-sai'); setTimeout(limpar, 160); } else limpar();
  var q = el('kbQuadro'), b = q && q.querySelector('.kb-cartao[data-chave="' + chave + '"] .kb-abrir');
  if (b && b.focus) b.focus({ preventScroll: true });
}
/* O cimo do painel: fechar, o tipo e a chave.
   Recebe: c — o cartão (null enquanto espera); chave.
   Devolve: o HTML. */
function kbPainelCabHtml(c, chave) {
  return '<div class="kb-p-cab"><span class="kb-p-chave">' + (c ? kbTipoHtml(c.tipo) + '<span>' + esc(KB_NOMES_TIPOS[c.tipo] || c.tipo) + '</span> · ' : '') +
    '<span class="n">' + esc(chave) + '</span></span>' +
    '<button type="button" class="btn sm ghost so-icone kb-p-fechar" aria-label="Fechar o cartão"' + comAcao('kbFechar') + '>' + ic('fechar') + '</button></div>';
}
/* O cartão aberto inteiro: o título, as ações («Editar» à parte), os
   campos, a descrição, a origem, as subtarefas, as ligações, os anexos, os
   comentários e o histórico.
   Recebe: d — a resposta do GET do cartão; entra — true para a entrada animada.
   Devolve: o HTML. */
function kbPainelHtml(d, entra) {
  var c = d.cartao || {}, chave = c.chave, master = kbEu().master;
  var acoes = '<div class="kb-p-acoes"><button type="button" class="btn sm"' + comAcao('kbEditar', [chave]) + '>' + ic('kbEditar', 'i-sm') + 'Editar</button>' +
    '<button type="button" class="btn sm"' + comAcao('kbMoverPara', [chave]) + '>Mover para…</button>' +
    '<button type="button" class="btn sm"' + comAcao('kbCopiar', [chave]) + '>' + ic('kbCopiar', 'i-sm') + 'Copiar a ligação</button>' +
    (master ? '<button type="button" class="btn sm ghost texto-perigo"' + comAcao('kbRemover', [chave]) + '>Remover</button>' : '') + '</div>';
  return '<section class="kb-painel card' + (entra ? ' kb-entra' : '') + '" aria-labelledby="kbPainelTit">' + kbPainelCabHtml(c, chave) +
    '<div class="kb-p-corpo"><h2 class="kb-p-tit" id="kbPainelTit" tabindex="-1">' + esc(c.titulo) + '</h2>' + acoes +
    kbCamposHtml(c) +
    (c.descricaoOculta ? '<div class="kb-p-sec"><h3 class="lbl">Descrição</h3><p class="sub kb-oculta">O texto deste pedido só se mostra a quem vê os pedidos.</p></div>'
      : c.descricao ? '<div class="kb-p-sec"><h3 class="lbl">Descrição</h3><p class="kb-texto">' + esc(c.descricao) + '</p></div>' : '') +
    kbOrigemHtml(d.origem) + kbSubtarefasHtml(c, d.subtarefas || []) + kbLigacoesHtml(chave, d.ligacoes || []) +
    kbAnexosHtml(chave, d.anexos || []) + kbComentariosHtml(chave, d.comentarios || []) + kbHistoricoHtml(d.historico || []) + '</div></section>';
}
/* Os campos do cartão aberto, em linhas rótulo/valor; uma linha sem valor não aparece.
   Recebe: c — o cartão.
   Devolve: o HTML. */
function kbCamposHtml(c) {
  var linhas = [];
  var linha = function (rot, html) { if (html) linhas.push('<div class="kb-kv"><dt>' + rot + '</dt><dd>' + html + '</dd></div>'); };
  var col = kbColuna(c.coluna_id);
  linha('Coluna', esc(kbNomeColuna(c.coluna_id)) + (col && col.fim ? ' ' + badge('ok', 'Feito') : ''));
  var pr = KB_PRIORIDADES[c.prioridade] ? Number(c.prioridade) : 3;
  linha('Prioridade', '<span class="kb-prio kb-p' + pr + '">' + ic('kbP' + pr, 'i-sm') + '</span><span class="kb-prio-txt">' + KB_PRIORIDADES[pr] + '</span>');
  linha('Responsável', c.responsavel ? esc(c.responsavel.nome) : '<span class="sub">Ninguém</span>');
  linha('Relator', c.relator ? esc(c.relator.nome || c.relator.id) : '');
  linha('Etiquetas', (c.etiquetas || []).map(function (t) { return '<span class="kb-etq">' + esc(t) + '</span>'; }).join(' '));
  linha(c.pai && c.pai.tipo === 'epico' ? 'Épico' : 'Pai', c.pai ? '<button type="button" class="ligacao"' + comAcao('kbAbrir', [c.pai.chave]) + '>' +
    esc(c.pai.chave) + ' · ' + esc(c.pai.titulo) + '</button>' : '');
  if (c.prazo) {
    var passou = !(col && col.fim) && c.prazo < kbHoje();
    linha('Prazo', esc(kbDia(c.prazo)) + (passou ? ' ' + badge('dg', 'Passou') : ''));
  }
  if (c.bloqueado) linha('Estado', badge('dg', ic('kbBloqueado', 'i-sm') + 'Bloqueado'));
  linha('Criado', c.created_at ? data(c.created_at) : '');
  linha('Atualizado', c.updated_at && c.updated_at !== c.created_at ? data(c.updated_at) : '');
  linha('Concluído', c.concluido_at ? data(c.concluido_at) : '');
  return '<dl class="kb-campos">' + linhas.join('') + '</dl>';
}
/* De onde veio o cartão: um ticket de QA (com o texto dele) ou um pedido de
   ajuda (que abre na secção Pedidos, para quem a vê). Um pedido da produção
   (trazido pela sincronização, sem ticket na base do dev: existe false) diz-se
   assim, com o #curto, e abre no back office da produção, noutro separador.
   Recebe: o — a origem ({tipo, id, estado, resumo, existe}) ou null.
   Devolve: o HTML ('' sem origem). */
function kbOrigemHtml(o) {
  if (!o) return '';
  var qa = o.tipo === 'qa', vePedidos = (eu.cats || []).indexOf('user') > -1, daProducao = !qa && o.existe === false;
  var abrir = '';
  if (!qa && o.id && vePedidos) {
    abrir = daProducao
      ? '<a class="btn sm" href="https://rendorium.com/equipa#pedidos/' + esc(encodeURIComponent(o.id)) + '" target="_blank" rel="noopener">Abrir no back office da produção</a>'
      : '<button type="button" class="btn sm"' + comAcao('kbAbrirPedido', [o.id]) + '>Abrir o pedido</button>';
  }
  return '<div class="kb-p-sec kb-origem"><h3 class="lbl">Origem</h3><p class="kb-origem-tit">' +
    badge('ac', qa ? 'Ticket de QA' : daProducao ? 'Pedido da produção #' + esc(curto(o.id)) : 'Pedido de ajuda') +
    (o.estado ? ' ' + badge('', esc(KB_ESTADOS_ORIGEM[o.estado] || o.estado)) : '') + '</p>' +
    (o.resumo ? '<p class="kb-texto' + (qa ? ' kb-texto-qa' : '') + '">' + esc(o.resumo) + '</p>' : '') + abrir + '</div>';
}
/* As subtarefas (ou, num épico, os cartões dele), com o progresso e o «Adicionar».
   Recebe: c — o cartão; subs — os filhos (CartaoCurto).
   Devolve: o HTML ('' numa subtarefa, que não tem filhos). */
function kbSubtarefasHtml(c, subs) {
  if (c.tipo === 'subtarefa') return '';
  var epico = c.tipo === 'epico';
  var feitas = subs.filter(function (s) { var k = kbColuna(s.coluna_id); return k && k.fim; }).length;
  return '<div class="kb-p-sec"><h3 class="lbl">' + (epico ? 'Neste épico' : 'Subtarefas') +
    (subs.length ? ' <span class="n">' + feitas + '/' + subs.length + '</span>' : '') + '</h3>' +
    (subs.length ? '<progress class="kb-barra kb-barra-larga" max="' + subs.length + '" value="' + feitas + '" aria-label="' + feitas + ' de ' + subs.length + ' feitas"></progress>' +
      '<ul class="kb-lista">' + subs.map(function (s) {
        var k = kbColuna(s.coluna_id);
        return '<li><button type="button" class="kb-linha"' + comAcao('kbAbrir', [s.chave]) + '>' + kbTipoHtml(s.tipo) +
          '<span class="kb-chave n">' + esc(s.chave) + '</span><span class="kb-linha-tit">' + esc(s.titulo) + '</span>' +
          badge(k && k.fim ? 'ok' : '', esc(kbNomeColuna(s.coluna_id))) + '</button></li>';
      }).join('') + '</ul>' : '<p class="sub">' + (epico ? 'Ainda não há cartões neste épico.' : 'Sem subtarefas.') + '</p>') +
    '<button type="button" class="btn sm"' + comAcao('kbNovoSub', [c.chave]) + '>' + ic('mais', 'i-sm') + (epico ? 'Adicionar ao épico' : 'Adicionar subtarefa') + '</button></div>';
}
/* As ligações a outros cartões: o que bloqueia, o que o bloqueia e o que se
   relaciona, com Remover em cada uma e o «Adicionar ligação».
   Recebe: chave; ls — as ligações ({id, tipo, cartao}).
   Devolve: o HTML. */
function kbLigacoesHtml(chave, ls) {
  return '<div class="kb-p-sec"><h3 class="lbl">Ligações</h3>' +
    (ls.length ? '<ul class="kb-lista">' + ls.map(function (l) {
      var o = l.cartao || {};
      return '<li class="kb-ligacao"><span class="kb-lig-tipo sub">' + esc(KB_LIGACOES[l.tipo] || l.tipo) + '</span>' +
        '<button type="button" class="kb-linha"' + comAcao('kbAbrir', [o.chave]) + '>' + kbTipoHtml(o.tipo) + '<span class="kb-chave n">' + esc(o.chave) +
        '</span><span class="kb-linha-tit">' + esc(o.titulo) + '</span></button>' +
        '<button type="button" class="btn sm ghost so-icone" aria-label="Remover a ligação com ' + esc(o.chave) + '"' + comAcao('kbLigacaoRemover', [l.id]) + '>' +
        ic('fechar', 'i-sm') + '</button></li>';
    }).join('') + '</ul>' : '<p class="sub">Sem ligações.</p>') +
    '<button type="button" class="btn sm"' + comAcao('kbLigar', [chave]) + '>' + ic('kbLigacao', 'i-sm') + 'Adicionar ligação</button></div>';
}
/* Os anexos: as miniaturas das imagens (tocar abre a imagem), Remover em
   cada uma e o «Adicionar imagem» (um campo de ficheiro escondido dentro do botão).
   Recebe: chave; as — os anexos ({id, nome, url}).
   Devolve: o HTML. */
function kbAnexosHtml(chave, as) {
  var bom = function (u) { return /^\/api\/equipa\/kanban\/anexos\/[\w-]+$/.test(String(u || '')); };
  return '<div class="kb-p-sec"><h3 class="lbl">Anexos</h3>' +
    (as.length ? '<ul class="kb-anexos">' + as.map(function (a) {
      return '<li class="kb-anexo">' + (bom(a.url) ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener" class="kb-anexo-img" title="' + esc(a.nome) + '">' +
        '<img src="' + esc(a.url) + '" alt="' + esc(a.nome || 'Imagem') + '" loading="lazy" width="96" height="96"></a>' : '') +
        '<button type="button" class="btn sm ghost so-icone kb-anexo-x" aria-label="Remover ' + esc(a.nome || 'a imagem') + '"' + comAcao('kbAnexoRemover', [a.id]) + '>' +
        ic('fechar', 'i-sm') + '</button></li>';
    }).join('') + '</ul>' : '<p class="sub">Sem anexos.</p>') +
    '<label class="btn sm kb-anexar">' + ic('kbAnexo', 'i-sm') + 'Adicionar imagem' +
    '<input type="file" accept="image/png,image/jpeg,image/webp" class="so-leitor" id="kbAnexoCampo"' + ligarA('mudar', 'kbAnexar', [chave]) + '></label>' +
    '<p class="sub n" id="kbAnexoEstado" role="status"></p></div>';
}
/* Os comentários (os teus com Editar e Remover) e a caixa de comentar.
   Recebe: chave; cs — os comentários ({id, autor, texto, created_at, updated_at, meu}).
   Devolve: o HTML. */
function kbComentariosHtml(chave, cs) {
  return '<div class="kb-p-sec"><h3 class="lbl">Comentários' + (cs.length ? ' <span class="n">' + cs.length + '</span>' : '') + '</h3>' +
    cs.map(function (x) {
      return '<div class="ms kb-coment"><p class="ms-quem">' + esc((x.autor && x.autor.nome) || 'Alguém') + ' · ' + data(x.created_at) +
        (x.updated_at && x.updated_at !== x.created_at ? ' · editado' : '') + '</p><p class="ms-texto">' + esc(x.texto) + '</p>' +
        (x.meu ? '<div class="kb-coment-acoes"><button type="button" class="btn sm ghost"' + comAcao('kbComentarioEditar', [x.id]) + '>Editar</button>' +
          '<button type="button" class="btn sm ghost texto-perigo"' + comAcao('kbComentarioRemover', [x.id]) + '>Remover</button></div>' : '') + '</div>';
    }).join('') +
    '<div class="campo-bloco"><label class="so-leitor" for="kbComentario">Comentário novo</label>' +
    '<textarea id="kbComentario" class="campo kb-comentar" maxlength="8000" placeholder="Ex: Testado no Samsung, o aviso já aparece." aria-describedby="kbComentarioErro"></textarea>' +
    '<p class="erro-txt" id="kbComentarioErro"></p></div>' +
    '<div><button type="button" class="btn sm primary"' + comAcao('kbComentar', [chave]) + '>Comentar</button></div></div>';
}
/* O histórico: quem, quando e o que mudou, em frases, do mais recente para o
   mais antigo, numa dobra fechada à partida.
   Recebe: hs — as linhas ({at, autor, campo, antes, depois}).
   Devolve: o HTML ('' sem histórico). */
function kbHistoricoHtml(hs) {
  if (!hs.length) return '';
  var l = hs.slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  return '<details class="kb-p-sec kb-hist"><summary><span class="lbl">Histórico</span> <span class="sub n">' + kbConta(l.length, 'mudança', 'mudanças') +
    '</span><span class="st-seta">' + ic('baixo', 'i-sm') + '</span></summary><ol class="kb-hist-lista">' + l.map(function (h) {
      return '<li><span class="kb-hist-frase">' + kbFrase(h) + '</span><span class="sub n">' + esc((h.autor && h.autor.nome) || 'Alguém') + ' · ' + data(h.at) + '</span></li>';
    }).join('') + '</ol></details>';
}
/* Uma linha do histórico dita numa frase: «Moveu de A fazer para Auto Tests»,
   «Mudou a prioridade de Média para Alta».
   Recebe: h — a linha ({campo, antes, depois}).
   Devolve: o HTML (seguro). */
function kbFrase(h) {
  var a = h.antes == null ? '' : String(h.antes), d = h.depois == null ? '' : String(h.depois);
  var q = function (t) { return '«' + esc(t) + '»'; };
  var lista = function (t) { return t ? t.split(',').map(function (x) { return x.trim(); }).filter(Boolean).join(', ') : ''; };
  switch (h.campo) {
    case 'criado': return 'Criou o cartão' + (d ? ' em ' + esc(kbNomeColuna(d)) : '');
    case 'coluna': return 'Moveu de ' + esc(kbNomeColuna(a)) + ' para ' + esc(kbNomeColuna(d));
    case 'titulo': return 'Mudou o título de ' + q(a) + ' para ' + q(d);
    case 'descricao': return d ? (a ? 'Editou a descrição' : 'Adicionou a descrição') : 'Removeu a descrição';
    case 'tipo': return 'Mudou o tipo de ' + esc(KB_NOMES_TIPOS[a] || a) + ' para ' + esc(KB_NOMES_TIPOS[d] || d);
    case 'prioridade': return 'Mudou a prioridade de ' + esc(KB_PRIORIDADES[a] || a) + ' para ' + esc(KB_PRIORIDADES[d] || d);
    case 'etiquetas': return !d ? 'Removeu as etiquetas' : !a ? 'Adicionou as etiquetas ' + esc(lista(d)) : 'Mudou as etiquetas de ' + esc(lista(a)) + ' para ' + esc(lista(d));
    case 'responsavel': return d ? 'Atribuiu a ' + esc(kbNomePessoa(d)) : 'Removeu o responsável' + (a ? ' (' + esc(kbNomePessoa(a)) + ')' : '');
    case 'pai': return d ? 'Ligou ao pai ' + esc(d) : 'Removeu o pai' + (a ? ' ' + esc(a) : '');
    case 'prazo': return d ? 'Mudou o prazo para ' + esc(kbDia(d)) : 'Removeu o prazo';
    case 'ligacao': return (d ? 'Adicionou a ligação: ' : 'Removeu a ligação: ') + esc(kbLigacaoEmTexto(d || a));
    case 'anexo': return d ? 'Adicionou o anexo ' + q(d) : 'Removeu o anexo ' + q(a);
    case 'origem': return 'A origem passou de ' + esc(a || '—') + ' a ' + esc(d || '—');
    case 'removido': return 'Removeu o cartão';
    case 'reposto': return 'Repôs o cartão';
    default: return 'Mudou ' + esc(h.campo || 'o cartão') + (d ? ' para ' + q(d) : '');
  }
}

// Uma ligação do histórico ('bloqueia KAN-5') dita por extenso: «bloqueia KAN-5», «é bloqueado por KAN-5».
// Recebe: t — o texto gravado (o tipo e a chave).
// Devolve: o texto (por escapar).
function kbLigacaoEmTexto(t) {
  var m = /^(bloqueia|bloqueado|relaciona)\s+(.+)$/.exec(String(t || ''));
  return m ? KB_LIGACOES[m[1]].toLowerCase() + ' ' + m[2] : String(t || '');
}

/* ------------------------- o que se faz no cartão ------------------------ */

/* O ⋯ de um cartão no quadro: as ações dele numa lista.
   Recebe: chave.
   Devolve: nada — abre a janela. */
function kbMenuCartao(chave) {
  var c = kbCartao(chave);
  if (!c) return;
  var op = function (acao, rotulo, classe) {
    return '<button type="button" class="btn lista kb-opcao' + (classe ? ' ' + classe : '') + '"' + comAcao(acao, [chave]) + '>' + rotulo + '</button>';
  };
  kbJanela(chave + ' · ' + c.titulo, '<div class="kb-opcoes">' + op('kbAbrir', 'Abrir o cartão') + op('kbMoverPara', 'Mover para…') +
    op('kbEditar', 'Editar') + op('kbCopiar', 'Copiar a ligação') + (kbEu().master ? op('kbRemover', 'Remover', 'texto-perigo') : '') + '</div>', { foco: '.kb-opcao' });
}
/* Abre o formulário de editar o cartão (com a descrição, que só o detalhe traz).
   Recebe: chave.
   Devolve: nada. */
function kbEditar(chave) {
  if (kbDetalhe && kbDetalhe.cartao && kbDetalhe.cartao.chave === chave) { kbFormCartao('editar', kbDetalhe.cartao); return; }
  pedir(kbRota(chave)).then(function (d) { kbFormCartao('editar', d.cartao); })
    .catch(function (e) { avisar(e.message || 'Não deu para abrir o cartão.', 'erro'); });
}
/* «Adicionar subtarefa» (ou, num épico, um cartão para ele).
   Recebe: chave — o pai.
   Devolve: nada — abre o formulário com o pai escrito. */
function kbNovoSub(chave) {
  var pai = (kbDetalhe && kbDetalhe.cartao && kbDetalhe.cartao.chave === chave) ? kbDetalhe.cartao : kbCartao(chave);
  kbFormCartao('criar', null, { pai: chave, tipo: pai && pai.tipo === 'epico' ? 'tarefa' : 'subtarefa', coluna_id: 'a-fazer' });
}
/* Copia a ligação do cartão (/equipa#kanban/KAN-N) e diz se deu.
   Recebe: chave.
   Devolve: nada. */
function kbCopiar(chave) {
  var url = location.origin + '/equipa#kanban/' + chave;
  if (!navigator.clipboard || !navigator.clipboard.writeText) { avisar('Este browser não deixa copiar: ' + url, 'erro'); return; }
  navigator.clipboard.writeText(url).then(function () { avisar('Ligação de ' + chave + ' copiada.'); },
    function () { avisar('Não deu para copiar: ' + url, 'erro'); });
}
/* Remove um cartão (só o master): sai logo do quadro, e o aviso traz o Anular.
   Recebe: chave.
   Devolve: nada. */
function kbRemover(chave) {
  if (!kbEu().master) return;
  pedir(kbRota(chave), { method: 'DELETE' }).then(function () {
    if (kbAberto === chave) kbFechar();
    if (kbEstado) kbEstado.cartoes = kbEstado.cartoes.filter(function (c) { return c.chave !== chave; });
    kbPintarQuadro(); kbPintarChips();
    kbAvisarComAnular('Cartão ' + chave + ' removido.', chave);
    kbRecarregar();
  }).catch(function (e) { avisar(e.message || 'Não deu para remover.', 'erro'); });
}
/* O aviso de baixo com o Anular (o avisar do guião só tem o fechar).
   Recebe: texto; chave — o cartão a repor.
   Devolve: nada. */
function kbAvisarComAnular(texto, chave) {
  var a = el('aviso');
  if (!a) { avisar(texto); return; }
  var n = typeof avisoN === 'number' ? ++avisoN : 0;
  a.className = 'eq-toast on';
  a.innerHTML = '<span class="eq-toast-txt">' + esc(texto) + '</span><button type="button" class="kb-anular"' + comAcao('kbRepor', [chave]) + '>Anular</button>' +
    '<button type="button" class="eq-toast-x" aria-label="Fechar o aviso"' + comAcao('fecharAviso') + '>' + ic('fechar', 'i-sm') + '</button>';
  setTimeout(function () { if (typeof avisoN !== 'number' || n === avisoN) a.className = 'eq-toast'; }, 10000);
}
/* O Anular de um cartão removido.
   Recebe: chave.
   Devolve: nada. */
function kbRepor(chave) {
  var a = el('aviso');
  if (a) a.className = 'eq-toast';
  enviar(kbRota(chave, '/repor')).then(function () { avisar('Cartão ' + chave + ' reposto.'); kbRecarregar(); })
    .catch(function (e) { avisar(e.message || 'Não deu para repor.', 'erro'); });
}
/* Abre o pedido de onde veio o cartão, na secção Pedidos (a lista e, ao
   lado, o pedido: o ir do guião pinta a lista e só depois o verPedido, para
   uma resposta não tapar a outra).
   Recebe: id — o id do pedido.
   Devolve: nada. */
function kbAbrirPedido(id) {
  if (id) ir('pedidos', String(id));
}
/* Comenta no cartão aberto.
   Recebe: chave.
   Devolve: nada. */
function kbComentar(chave) {
  var t = el('kbComentario'), texto = t ? String(t.value || '').trim() : '';
  if (!texto) { marcarErro('kbComentario', 'Escreve o comentário.'); if (t && t.focus) t.focus(); return; }
  marcarErro('kbComentario', '');
  enviar(kbRota(chave, '/comentarios'), { texto: texto }).then(function () {
    avisar('Comentário adicionado.');
    if (kbAberto === chave) kbAbrir(chave, false);
    kbRecarregar();
  }).catch(function (e) { marcarErro('kbComentario', e.message || 'Não deu para comentar.'); });
}
// Um comentário do cartão aberto pelo id.
// Recebe: id.
// Devolve: o comentário, ou null.
function kbComentario(id) {
  var cs = (kbDetalhe && kbDetalhe.comentarios) || [];
  for (var i = 0; i < cs.length; i++) if (String(cs[i].id) === String(id)) return cs[i];
  return null;
}
/* Edita um comentário teu.
   Recebe: id — o id do comentário.
   Devolve: nada — abre a janela. */
function kbComentarioEditar(id) {
  var x = kbComentario(id), chave = kbAberto;
  if (!x) return;
  kbJanela('Editar o comentário', kbCampoHtml('kbF-comentario', 'Comentário', true, 'area', x.texto, '', 8000), {
    foco: '#kbF-comentario',
    aoConfirmar: function () {
      var t = el('kbF-comentario'), texto = t ? String(t.value || '').trim() : '';
      if (!texto) { marcarErro('kbF-comentario', 'Escreve o comentário.'); return false; }
      return pedir('/api/equipa/kanban/comentarios/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: texto }) })
        .then(function () { avisar('Comentário guardado.'); if (kbAberto === chave) kbAbrir(chave, false); });
    },
  });
}
/* Remove um comentário teu (não volta: pergunta antes, na janela).
   Recebe: id — o id do comentário.
   Devolve: nada. */
function kbComentarioRemover(id) {
  var chave = kbAberto;
  kbJanela('Remover o comentário?', '', {
    texto: 'O comentário sai do cartão e não volta.', botao: 'Remover', perigo: true,
    aoConfirmar: function () {
      return pedir('/api/equipa/kanban/comentarios/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () { avisar('Comentário removido.'); if (kbAberto === chave) kbAbrir(chave, false); kbRecarregar(); });
    },
  });
}
/* Adiciona uma ligação a outro cartão: o tipo e a chave dele.
   Recebe: chave — o cartão aberto.
   Devolve: nada — abre a janela. */
function kbLigar(chave) {
  var tipos = Object.keys(KB_LIGACOES).map(function (t) { return [t, KB_LIGACOES[t]]; });
  kbJanela('Adicionar ligação a ' + chave, kbGrupoHtml('kbF-ligtipo', 'Este cartão', true, tipos, 'relaciona') +
    kbCampoHtml('kbF-ligchave', 'Outro cartão', true, 'text', '', 'Ex: KAN-12', 20), {
    botao: 'Adicionar', foco: '#kbF-ligchave',
    aoConfirmar: function () {
      var tipo = kbEscolhido('kbF-ligtipo'), txt = valorDe('kbF-ligchave'), outra = kbChave(txt);
      var erro = !txt ? 'Escreve a chave do outro cartão.' : !outra ? 'Escreve a chave como KAN-12.' : outra === chave ? 'Um cartão não se liga a si mesmo.' : '';
      marcarErro('kbF-ligchave', erro);
      if (erro) return false;
      return enviar(kbRota(chave, '/ligacoes'), { tipo: tipo || 'relaciona', chave: outra }).then(function () {
        avisar('Ligação adicionada.');
        if (kbAberto === chave) kbAbrir(chave, false);
        kbRecarregar();
      }, function (e) { var x = new Error(e.message || 'Não deu.'); x.campo = 'kbF-ligchave'; throw x; });
    },
  });
}
/* Remove uma ligação (pequena e refaz-se num instante: sem pergunta).
   Recebe: id — o id da ligação.
   Devolve: nada. */
function kbLigacaoRemover(id) {
  var chave = kbAberto;
  pedir('/api/equipa/kanban/ligacoes/' + encodeURIComponent(id), { method: 'DELETE' }).then(function () {
    avisar('Ligação removida.');
    if (kbAberto === chave) kbAbrir(chave, false);
    kbRecarregar();
  }).catch(function (e) { avisar(e.message || 'Não deu para remover a ligação.', 'erro'); });
}
/* Envia a imagem escolhida como anexo do cartão (PNG, JPEG ou WebP, até 5 MB).
   Recebe: chave; campo — o input type=file.
   Devolve: nada. */
function kbAnexar(chave, campo) {
  var f = campo && campo.files && campo.files[0], estado = el('kbAnexoEstado');
  if (!f) return;
  var diz = function (t) { if (estado) estado.textContent = t; };
  if (!/^image\/(png|jpeg|webp)$/.test(f.type || '')) { diz(''); avisar('Só imagens PNG, JPEG ou WebP.', 'erro'); campo.value = ''; return; }
  if (f.size > 5 * 1024 * 1024) { diz(''); avisar('A imagem tem mais de 5 MB.', 'erro'); campo.value = ''; return; }
  diz('A enviar ' + f.name + '…');
  pedir(kbRota(chave, '/anexos'), { method: 'PUT', headers: { 'Content-Type': f.type, 'X-Nome': encodeURIComponent(f.name) }, body: f }).then(function () {
    avisar('Imagem adicionada.');
    if (kbAberto === chave) kbAbrir(chave, false);
    kbRecarregar();
  }).catch(function (e) { diz(''); avisar(e.message || 'Não deu para enviar a imagem.', 'erro'); if (campo) campo.value = ''; });
}
/* Remove um anexo (não volta: pergunta antes, na janela).
   Recebe: id — o id do anexo.
   Devolve: nada. */
function kbAnexoRemover(id) {
  var chave = kbAberto;
  kbJanela('Remover a imagem?', '', {
    texto: 'A imagem sai do cartão e não volta.', botao: 'Remover', perigo: true,
    aoConfirmar: function () {
      return pedir('/api/equipa/kanban/anexos/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () { avisar('Imagem removida.'); if (kbAberto === chave) kbAbrir(chave, false); kbRecarregar(); });
    },
  });
}

/* -------------------- as ações do quadro e do cartão -------------------- */

ACOES.kbAbrir = function (d, alvo) { if (kbDepoisDeArrastar()) return; kbSairDaJanela(alvo); kbAbrir(d.arg, true); };
ACOES.kbFechar = function () { kbFechar(); };
ACOES.kbTentar = function (d) { verKanban(d.arg || ''); };
ACOES.kbMenuCartao = function (d) { if (!kbDepoisDeArrastar()) kbMenuCartao(d.arg); };
ACOES.kbMoverPara = function (d) { if (!kbDepoisDeArrastar()) kbMoverPara(d.arg); };
ACOES.kbEditar = function (d, alvo) { kbSairDaJanela(alvo); kbEditar(d.arg); };
ACOES.kbCopiar = function (d, alvo) { kbSairDaJanela(alvo); kbCopiar(d.arg); };
ACOES.kbRemover = function (d, alvo) { kbSairDaJanela(alvo); kbRemover(d.arg); };
ACOES.kbRepor = function (d) { kbRepor(d.arg); };
ACOES.kbNovoSub = function (d) { kbNovoSub(d.arg); };
ACOES.kbVerColuna = function (d) { kbVerColuna(d.arg); };
ACOES.kbComentar = function (d) { kbComentar(d.arg); };
ACOES.kbComentarioEditar = function (d) { kbComentarioEditar(d.arg); };
ACOES.kbComentarioRemover = function (d) { kbComentarioRemover(d.arg); };
ACOES.kbLigar = function (d) { kbLigar(d.arg); };
ACOES.kbLigacaoRemover = function (d) { kbLigacaoRemover(d.arg); };
ACOES.kbAnexar = function (d, alvo) { kbAnexar(d.arg, alvo); };
ACOES.kbAnexoRemover = function (d) { kbAnexoRemover(d.arg); };
ACOES.kbAbrirPedido = function (d) { kbAbrirPedido(d.arg); };

/* Os ouvintes do quadro, ao lado dos três do guião: o Esc que fecha o cartão
   e o redimensionar que volta a medir o quadro. Cada um sai logo quando o
   kanban não está no ecrã. Os do arrasto e da pesquisa vivem nos módulos deles. */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' || !kbAberto || kbArr || !el('kbPainel')) return;
  var d = el('dialogo'), a = document.activeElement;
  if (d && d.open) return;
  // um comentário a meio não se perde com o Esc: o primeiro só sai do campo
  if (a && a.id === 'kbComentario' && String(a.value || '').trim()) { a.blur(); return; }
  kbFechar();
});
window.addEventListener('resize', function () { if (el('kbVista')) kbMedirTopo(); });
`;

// o guião inteiro, como o /equipa/kanban.js o serve: os quatro pedaços por ordem
export const GUIAO_KANBAN = GUIAO_KB_QUADRO + GUIAO_KB_FILTROS + GUIAO_KB_ARRASTO + GUIAO_KB_JANELA;

/* Os estilos do kanban, servidos em /equipa/kanban.css (público, como o
   estilos.css: são só regras). Vivem por cima do CSS_EQUIPA e usam os
   tokens dele (--card, --line, --accent, --rapido, --curva…) sem redeclarar
   o :root; todas as classes começam por kb-. A barra de baixo do back office
   ocupa --eq-barra em baixo, abaixo dos 900px: nada daqui fica por baixo
   dela. Os estados (o cartão aberto, a coluna de destino, a coluna escolhida
   no segmentado, o cartão no ar) dizem-se também na cor da frente — contorno
   e letra —, porque o Samsung escurece os fundos à força. Os :hover vivem
   atrás de (hover:hover) and (pointer:fine). */
const CSS_KB_QUADRO = `/* ---- o segmentado das colunas (só no telemóvel) ---- */
.kb-seg{display:none}

/* ---- o quadro: as colunas lado a lado, a rolagem de lado é dele ---- */
.kb-vista{display:flex;gap:16px;align-items:flex-start;min-width:0}
.kb-quadro{position:relative;flex:1 1 auto;min-width:0;display:flex;gap:12px;align-items:flex-start;overflow-x:auto;overflow-y:hidden;
  overscroll-behavior-x:contain;padding:2px 2px 10px;scrollbar-width:thin}
.kb-col{flex:0 0 288px;display:flex;flex-direction:column;min-width:0;background:var(--chip);border:1px solid var(--line);border-radius:16px;
  max-height:calc(100vh - var(--kb-topo, 260px) - 28px);max-height:calc(100dvh - var(--kb-topo, 260px) - 28px);min-height:220px;
  transition:border-color var(--rapido) var(--curva),background-color var(--rapido) var(--curva)}
.kb-col.kb-alvo{border-color:var(--accent);background:var(--accent-soft);box-shadow:0 0 0 1px var(--accent)}
.kb-col-cab{display:flex;align-items:center;gap:8px;padding:12px 14px 8px}
.kb-col-nome{font-family:var(--letra);font-size:13px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-col-n{min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:var(--card);border:1px solid var(--line);color:var(--muted);
  font-size:12px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
.kb-col-marca{display:inline-flex;color:var(--in);margin-left:auto}
.kb-col-lista{flex:1 1 auto;min-height:48px;overflow-y:auto;overscroll-behavior-y:contain;padding:2px 8px 6px;display:flex;flex-direction:column;gap:8px}
.kb-col-vazio{color:var(--faint);font-size:13px;padding:14px 8px;text-align:center;border:1px dashed var(--line2);border-radius:12px}
.kb-col-lista:has(.kb-lugar) .kb-col-vazio{display:none}
.kb-col-pe{padding:4px 8px 8px}
.kb-col-mais{width:100%;justify-content:flex-start;color:var(--muted)}

/* ---- o cartão ---- */
.kb-cartao{position:relative;display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px;background:var(--card);border:1px solid var(--line);
  border-radius:12px;box-shadow:0 1px 2px color-mix(in srgb,var(--ink) 8%,transparent);user-select:none;-webkit-user-select:none;cursor:grab;
  transition:border-color var(--rapido) var(--curva),box-shadow var(--rapido) var(--curva)}
.kb-cartao.kb-aberto{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.kb-cartao.kb-bloq{box-shadow:inset 3px 0 0 var(--danger)}
.kb-cartao.kb-bloq.kb-aberto{box-shadow:inset 3px 0 0 var(--danger),0 0 0 1px var(--accent)}
.kb-c-topo{display:flex;align-items:center;gap:6px;min-height:28px}
.kb-tipo{display:inline-flex;flex:none}
.kb-t-epico{color:var(--warn)}
.kb-t-historia{color:var(--in)}
.kb-t-tarefa{color:var(--accent)}
.kb-t-subtarefa{color:var(--accent-text)}
.kb-t-erro{color:var(--danger)}
.kb-chave{font-size:12.5px;font-weight:600;color:var(--muted);letter-spacing:.01em}
.kb-prio{display:inline-flex;margin-left:auto}
.kb-p1{color:var(--danger)}
.kb-p2{color:var(--warn)}
.kb-p3{color:var(--faint)}
.kb-p4{color:var(--accent)}
.kb-p5{color:var(--accent-text)}
.kb-pega,.kb-mais{position:relative;z-index:2;flex:none;display:inline-flex;align-items:center;justify-content:center;width:32px;height:28px;
  margin:-4px -6px -4px 0;padding:0;border:0;border-radius:8px;background:transparent;color:var(--faint);cursor:pointer}
.kb-pega{touch-action:none;cursor:grab}
.kb-pega .i,.kb-mais .i{stroke-width:2.8}
.kb-pega:focus-visible,.kb-mais:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.kb-pega:active,.kb-mais:active{background:var(--press);color:var(--ink)}
.kb-c-tit{margin:0;font-size:14.5px;font-weight:550;line-height:1.35;overflow-wrap:anywhere}
.kb-abrir{all:unset;display:inline;cursor:pointer;color:var(--ink)}
.kb-abrir::after{content:'';position:absolute;inset:0;z-index:1;border-radius:12px}
.kb-abrir:focus-visible::after{outline:2px solid var(--accent);outline-offset:2px}
.kb-c-marcas{display:flex;flex-wrap:wrap;gap:4px}
.kb-etq{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:11.5px;font-weight:600;background:var(--chip);
  color:var(--muted);border:1px solid var(--line);white-space:nowrap}
.kb-pai{display:inline-flex;align-items:center;gap:4px;height:20px;max-width:100%;padding:0 7px;border-radius:6px;font-size:11.5px;font-weight:650;
  background:var(--tint);color:var(--muted);border:1px solid var(--line2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-pai-epico{background:var(--warn-soft);color:var(--warn);border-color:color-mix(in srgb,var(--warn) 40%,transparent)}
.kb-pai .i{width:13px;height:13px}
.kb-c-pe{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;color:var(--muted);font-size:12.5px}
.kb-cont{display:inline-flex;align-items:center;gap:4px}
.kb-cont .i{width:15px;height:15px}
.kb-prazo.kb-atrasado{color:var(--danger);font-weight:650}
.kb-bloq-selo{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 6px;border-radius:6px;background:var(--danger-soft);color:var(--danger);
  border:1px solid currentColor;font-size:11.5px;font-weight:650}
.kb-bloq-selo .i{width:13px;height:13px}
.kb-barra{width:44px;height:6px;border:0;border-radius:3px;background:var(--line);overflow:hidden;-webkit-appearance:none;appearance:none;color:var(--in)}
.kb-barra::-webkit-progress-bar{background:var(--line);border-radius:3px}
.kb-barra::-webkit-progress-value{background:var(--in);border-radius:3px}
.kb-barra::-moz-progress-bar{background:var(--in);border-radius:3px}
.kb-barra-larga{width:100%;height:8px}
.kb-avatar{margin-left:auto;width:26px;height:26px;border-radius:50%;background:var(--accent-soft);color:var(--accent-text);border:1px solid var(--accent);
  display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex:none}

/* ---- o cartão aberto: ao lado no computador, a folha inteira no telemóvel ---- */
.kb-painel-sitio:empty{display:none}
.kb-painel-sitio{flex:0 0 420px;min-width:0;position:sticky;top:16px}
.kb-painel{display:flex;flex-direction:column;overflow:auto;overscroll-behavior:contain;
  max-height:calc(100vh - var(--kb-topo, 260px) - 28px);max-height:calc(100dvh - var(--kb-topo, 260px) - 28px);min-height:320px}
.kb-painel.kb-entra{animation:kbPainelEntra var(--medio) var(--curva-entra) both}
.kb-painel.kb-sai{animation:kbPainelSai var(--rapido) var(--curva) both;pointer-events:none}
@keyframes kbPainelEntra{from{opacity:0;transform:translateX(16px)}}
@keyframes kbPainelSai{to{opacity:0;transform:translateX(12px)}}
@keyframes kbAparece{from{opacity:0}}
@keyframes kbSome{to{opacity:0}}
.kb-p-cab{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:8px;padding:10px 10px 10px 18px;background:var(--card);border-bottom:1px solid var(--line)}
.kb-p-chave{flex:1;min-width:0;display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;font-weight:600}
.kb-p-corpo{padding:16px 18px 22px;display:flex;flex-direction:column;gap:16px}
.kb-p-tit{font-size:21px;overflow-wrap:anywhere}
.kb-p-tit:focus{outline:0}
.kb-p-tit:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:4px}
.kb-p-acoes{display:flex;flex-wrap:wrap;gap:8px}
.kb-campos{margin:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;padding:2px 14px}
.kb-kv{display:flex;gap:12px;padding:9px 0;border-top:1px solid var(--line);font-size:14px;align-items:baseline}
.kb-kv:first-child{border-top:0}
.kb-kv dt{flex:0 0 108px;color:var(--muted)}
.kb-kv dd{flex:1;min-width:0;margin:0;overflow-wrap:anywhere;display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center}
.kb-kv .kb-prio{margin:0;gap:6px;align-items:center}
.kb-prio-txt{color:var(--ink)}
.kb-p-sec{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.kb-p-sec>h3{display:flex;gap:8px;align-items:baseline}
.kb-p-sec>div,.kb-p-sec>ul,.kb-p-sec>progress{align-self:stretch}
.kb-p-sec>div:last-child{align-self:flex-start}
.kb-texto{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14.5px}
.kb-texto-qa{padding:12px 14px;border-radius:12px;background:var(--chip);font-size:14px}
.kb-origem-tit{display:flex;flex-wrap:wrap;gap:6px}
.kb-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.kb-lista>li+li{border-top:1px solid var(--line)}
.kb-linha{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:8px 12px;border:0;background:transparent;color:var(--ink);
  text-align:left;font-size:14px;cursor:pointer}
.kb-linha:focus-visible{outline-offset:-2px}
.kb-linha-tit{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-ligacao{display:flex;align-items:center;gap:4px;padding-left:12px}
.kb-ligacao .kb-linha{padding-left:4px}
.kb-lig-tipo{flex:none;max-width:110px}
.kb-anexos{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px}
.kb-anexo{position:relative}
.kb-anexo-img{display:block;width:96px;height:96px;border-radius:12px;overflow:hidden;border:1px solid var(--line2);background:var(--chip)}
.kb-anexo-img img{display:block;width:100%;height:100%;object-fit:cover}
.kb-anexo-img:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.kb-anexo-x{position:absolute;top:-10px;right:-10px;background:var(--card);border:1px solid var(--line2);border-radius:999px}
.kb-anexar{position:relative}
.kb-anexar:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}
.kb-coment{align-self:stretch}
.kb-coment-acoes{display:flex;gap:4px;margin:-4px 0 -6px -10px}
.kb-comentar{min-height:84px}
.kb-hist{align-self:stretch}
.kb-hist>summary{display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;list-style:none;border-top:1px solid var(--line);padding-top:6px}
.kb-hist>summary::-webkit-details-marker{display:none}
.kb-hist>summary .st-seta{margin-left:auto;transform:rotate(-90deg);color:var(--muted)}
.kb-hist[open]>summary .st-seta{transform:none}
.kb-hist-lista{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}
.kb-hist-lista li{display:flex;flex-direction:column;gap:2px;padding-left:12px;border-left:2px solid var(--line2);font-size:14px}

/* ---- o Anular no aviso de baixo ---- */
.kb-anular{flex:none;min-height:36px;padding:0 12px;border:1px solid currentColor;border-radius:10px;background:transparent;color:inherit;
  font-weight:650;font-size:14px;cursor:pointer}
.kb-anular:focus-visible{outline:2px solid currentColor;outline-offset:2px}

/* ---- só com rato: o que reage a passar por cima ---- */
@media(hover:hover) and (pointer:fine){
  .kb-cartao:hover{border-color:var(--line2)}
  .kb-cartao.kb-aberto:hover{border-color:var(--accent)}
  .kb-pega:hover,.kb-mais:hover{background:var(--tint);color:var(--ink)}
  .kb-linha:hover{background:var(--tint)}
  .kb-anular:hover{background:color-mix(in srgb,currentColor 12%,transparent)}
  .kb-hist>summary:hover .lbl{color:var(--ink)}
  .kb-pega{display:none}
}

/* ---- entre 900 e 1199: o cartão aberto por cima do quadro, à direita ---- */
@media(max-width:1199px){
  .kb-painel-sitio{position:fixed;top:0;right:0;bottom:var(--eq-barra, 0px);z-index:40;width:min(460px,100vw);flex:none}
  .kb-painel{height:100%;max-height:none;border-radius:0;border-width:0 0 0 1px;box-shadow:var(--shadow)}
}

/* ---- o telemóvel: uma coluna de cada vez, o segmentado e a folha inteira ---- */
@media(max-width:899px){
  .kb-seg{display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 -16px;padding:2px 16px}
  .kb-seg::-webkit-scrollbar{display:none}
  .kb-seg-op{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line2);
    background:var(--card);color:var(--muted);font-size:14px;font-weight:550;white-space:nowrap;cursor:pointer;
    transition:background-color var(--rapido) var(--curva),border-color var(--rapido) var(--curva),color var(--rapido) var(--curva)}
  .kb-seg-op[aria-current="true"]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-text);font-weight:650;
    box-shadow:0 0 0 1px var(--accent)}
  .kb-seg-n{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--chip);border:1px solid currentColor;font-size:12px;
    display:inline-flex;align-items:center;justify-content:center}
  .kb-quadro{gap:16px;scroll-snap-type:x mandatory;margin:0 -16px;padding:2px 16px 10px;scroll-padding:0 16px;scrollbar-width:none}
  .kb-quadro::-webkit-scrollbar{display:none}
  .kb-col{flex:0 0 100%;scroll-snap-align:start;scroll-snap-stop:always;
    height:calc(100vh - var(--kb-topo, 300px) - var(--eq-barra, 0px) - 18px);height:calc(100dvh - var(--kb-topo, 300px) - var(--eq-barra, 0px) - 18px);
    max-height:none;min-height:340px}
  .kb-painel-sitio{left:0;width:auto;top:0;bottom:var(--eq-barra, 0px)}
  .kb-painel{border-width:0;box-shadow:none}
  .kb-painel.kb-entra{animation-name:kbFolhaEntra}
  .kb-painel.kb-sai{animation-name:kbFolhaSai}
  .kb-p-cab{padding:calc(6px + env(safe-area-inset-top)) 6px 6px 16px}
  .kb-p-corpo{padding:14px 16px 24px}
  .kb-kv dt{flex-basis:96px}
}
@keyframes kbFolhaEntra{from{opacity:0;transform:translateY(24px)}}
@keyframes kbFolhaSai{to{opacity:0;transform:translateY(16px)}}

/* o dedo precisa de 44px */
@media(pointer:coarse){
  .kb-pega,.kb-mais{width:44px;height:44px;margin:-10px -8px -10px 0}
  .kb-col-mais{min-height:44px}
  .kb-anexo-x{width:44px;height:44px}
}
/* menos movimento: o painel só aparece e desaparece, sem deslizar; o cartão
   assenta de uma vez */
@media(prefers-reduced-motion:reduce){
  .kb-painel.kb-entra{animation-name:kbAparece}
  .kb-painel.kb-sai{animation-name:kbSome}
}
`;

// o CSS inteiro, como o /equipa/kanban.css o serve: o do quadro primeiro, e os pedaços por cima
export const CSS_KANBAN = CSS_KB_QUADRO + CSS_KB_FILTROS + CSS_KB_ARRASTO + CSS_KB_JANELA;
