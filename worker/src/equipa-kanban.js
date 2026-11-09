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

   As rotas que isto chama são as /api/equipa/kanban (rotas/kanban.js). */

export const GUIAO_KANBAN = String.raw`/* ------------------------------ o estado ------------------------------ */

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

/* ------------------------------- filtros -------------------------------- */

// Os filtros vazios.
// Devolve: {q, tipo, etiqueta, responsavel, prioridade, pai}, tudo ''.
function kbSemFiltros() { return { q: '', tipo: '', etiqueta: '', responsavel: '', prioridade: '', pai: '' }; }
// Os filtros guardados na sessão do browser (um browser que não deixa guardar dá os vazios).
// Devolve: os filtros.
function kbLerFiltros() {
  var f = kbSemFiltros();
  try {
    var g = JSON.parse(sessionStorage.getItem('kb_filtros') || '{}');
    Object.keys(f).forEach(function (k) { if (g && typeof g[k] === 'string') f[k] = g[k].slice(0, 200); });
  } catch (e) { /* sem armazenamento: começa sem filtros */ }
  return f;
}
// Guarda os filtros na sessão do browser (calado quando não deixa).
// Devolve: nada.
function kbGuardarFiltros() {
  try { sessionStorage.setItem('kb_filtros', JSON.stringify(kbFiltros)); } catch (e) { /* fica só em memória */ }
}
// Quantos filtros estão ligados (a pesquisa conta como um).
// Recebe: f — os filtros.
// Devolve: o número.
function kbQuantosFiltros(f) {
  return Object.keys(kbSemFiltros()).filter(function (k) { return !!f[k]; }).length;
}
/* Um cartão passa os filtros? A pesquisa vai ao servidor (procura também na
   descrição) e chega aqui como o conjunto das chaves que achou; o resto
   filtra-se aqui, para o quadro ter sempre as colunas inteiras e o arrasto
   saber o lugar certo entre os cartões escondidos.
   Recebe: c — o cartão; f — os filtros; q — a pesquisa (null ou {chaves});
   euId — o id de quem está (para o «Os meus»).
   Devolve: true quando passa. */
function kbPassa(c, f, q, euId) {
  if (f.q && q && !q.chaves[c.chave]) return false;
  if (f.tipo && c.tipo !== f.tipo) return false;
  if (f.etiqueta && (c.etiquetas || []).indexOf(f.etiqueta) < 0) return false;
  if (f.responsavel) {
    var quem = f.responsavel === 'eu' ? euId : f.responsavel;
    if (!c.responsavel || c.responsavel.id !== quem) return false;
  }
  if (f.prioridade && String(c.prioridade) !== String(f.prioridade)) return false;
  if (f.pai && !(c.pai && c.pai.chave === f.pai)) return false;
  return true;
}
// Os cartões de uma coluna que os filtros deixam ver.
// Recebe: id — o id da coluna.
// Devolve: a lista.
function kbVisiveis(id) {
  var euId = kbEu().id;
  return kbDaColuna(id).filter(function (c) { return kbPassa(c, kbFiltros, kbQ, euId); });
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

/* Pinta a secção inteira: o cabeçalho (com «Colunas» só para o master e o
   «Novo cartão»), a barra dos filtros, o segmentado das colunas (no
   telemóvel) e o quadro com o sítio do cartão aberto.
   Devolve: nada — redesenha o #conteudo. */
function kbPintar() {
  var botoes = (kbEu().master ? '<button type="button" class="btn"' + comAcao('kbColunas') + '>' + ic('kbColunas') + 'Colunas</button>' : '') +
    '<button type="button" class="btn primary"' + comAcao('kbNovo', ['']) + '>' + ic('mais') + 'Novo cartão</button>';
  el('conteudo').innerHTML = '<div class="kb-cab">' + cabecalho('Kanban', KB_SUB, botoes) + '</div>' +
    '<div class="kb-filtros" id="kbFiltros">' + kbFiltrosHtml() + '</div>' +
    '<div class="kb-seg" id="kbSeg" role="group" aria-label="Colunas"></div>' +
    '<div class="kb-vista" id="kbVista"><div class="kb-quadro" id="kbQuadro"></div>' +
    '<div class="kb-painel-sitio" id="kbPainel"></div></div>';
  var q = el('kbQuadro');
  if (q && q.addEventListener) {
    q.addEventListener('scroll', kbAoRolar, { passive: true });
    q.addEventListener('touchstart', kbLargarAlvo, { passive: true });
  }
  kbColunaVista = 0;
  kbPintarQuadro(); kbPintarChips();
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

/* --------------------------- filtros (pintar) --------------------------- */

/* A barra dos filtros: a pesquisa, o «Filtros» que abre os chips no
   telemóvel, os chips e o resumo do que se vê.
   Devolve: o HTML. */
function kbFiltrosHtml() {
  return '<label class="procura kb-procura">' + ic('procurar') + '<input id="kbQ" type="search" placeholder="Pesquisar…" autocomplete="off" ' +
    'aria-label="Pesquisar por chave, título ou descrição" value="' + esc(kbFiltros.q) + '"' + ligarA('enter', 'kbPesquisar') + '></label>' +
    '<button type="button" class="chip kb-filtros-botao" id="kbFiltrosBotao" aria-controls="kbChips"' + comAcao('kbFiltrosAlternar') + '></button>' +
    '<div class="chips kb-chips" id="kbChips"></div><p class="sub n kb-resumo" id="kbResumo" role="status"></p>';
}
/* Pinta os chips, o botão «Filtros» e o resumo — sem tocar no campo da
   pesquisa, que pode estar a ser escrito.
   Devolve: nada. */
function kbPintarChips() {
  var f = kbFiltros, n = kbQuantosFiltros(f), chips = el('kbChips'), botao = el('kbFiltrosBotao'), resumo = el('kbResumo');
  if (!chips || !kbEstado) return;
  var escolha = function (campo, rotulo, valor) {
    return '<button type="button" class="chip' + (valor ? ' on' : '') + '" aria-haspopup="dialog"' + comAcao('kbEscolher', [campo]) + '>' +
      rotulo + (valor ? ': <b>' + esc(valor) + '</b>' : '') + ic('baixo', 'i-sm') + '</button>';
  };
  var quem = f.responsavel && f.responsavel !== 'eu' ? kbNomePessoa(f.responsavel) : '';
  chips.className = 'chips kb-chips' + (kbFiltrosAbertos ? '' : ' kb-fechado');
  chips.innerHTML = chip('Os meus', f.responsavel === 'eu', comAcao('kbOsMeus')) +
    escolha('tipo', 'Tipo', f.tipo ? KB_NOMES_TIPOS[f.tipo] || f.tipo : '') +
    escolha('etiqueta', 'Etiqueta', f.etiqueta) +
    escolha('responsavel', 'Responsável', quem) +
    escolha('prioridade', 'Prioridade', f.prioridade ? KB_PRIORIDADES[f.prioridade] || f.prioridade : '') +
    escolha('pai', 'Épico', f.pai) +
    (n ? '<button type="button" class="btn sm ghost kb-limpar"' + comAcao('kbLimparFiltros') + '>' + ic('fechar', 'i-sm') + 'Limpar filtros</button>' : '');
  if (botao) {
    botao.setAttribute('aria-expanded', kbFiltrosAbertos ? 'true' : 'false');
    botao.className = 'chip kb-filtros-botao' + (n ? ' on' : '');
    botao.innerHTML = ic('kbFiltro', 'i-sm') + 'Filtros' + (n ? ' <span class="n">' + n + '</span><span class="so-leitor"> ligados</span>' : '');
  }
  if (resumo) {
    var total = kbEstado.cartoes.length, vis = 0;
    kbEstado.colunas.forEach(function (c) { vis += kbVisiveis(c.id).length; });
    resumo.textContent = n ? (vis ? vis + ' de ' + kbConta(total, 'cartão', 'cartões') + ' com estes filtros.' : 'Nada com estes filtros.') : kbConta(total, 'cartão', 'cartões') + '.';
  }
}
/* Muda um filtro e repinta (o quadro já tem tudo: não vai ao servidor).
   Recebe: campo — tipo, etiqueta, responsavel, prioridade ou pai; valor — '' tira o filtro.
   Devolve: nada. */
function kbFiltrar(campo, valor) {
  if (!Object.prototype.hasOwnProperty.call(KB_FILTROS, campo)) return;
  kbFiltros[campo] = String(valor || '');
  kbGuardarFiltros();
  var d = el('dialogo');
  if (d && d.open && kbJanelaAberta) d.close();
  kbPintarQuadro(); kbPintarChips();
}
/* Procura no servidor (chave, título ou descrição) e mostra só o que achou.
   Recebe: texto — o que procurar ('' tira a pesquisa).
   Devolve: nada. */
function kbPesquisar(texto) {
  texto = String(texto || '').trim().slice(0, 200);
  clearTimeout(kbQTempo);
  if (texto === kbFiltros.q && (!texto || kbQ)) return;
  kbFiltros.q = texto; kbGuardarFiltros();
  var vez = ++kbVezQ;
  if (!texto) { kbQ = null; kbPintarQuadro(); kbPintarChips(); return; }
  var r = el('kbResumo');
  if (r) r.textContent = 'À procura…';
  pedir('/api/equipa/kanban?q=' + encodeURIComponent(texto)).then(function (j) {
    if (vez !== kbVezQ || kbFiltros.q !== texto) return;
    kbQ = kbChavesDe(j, texto);
    kbPintarQuadro(); kbPintarChips();
  }).catch(function (e) {
    if (vez === kbVezQ) { avisar(e.message || 'Não deu para pesquisar.', 'erro'); kbPintarChips(); }
  });
}
/* Tira todos os filtros e a pesquisa.
   Devolve: nada. */
function kbLimparFiltros() {
  kbFiltros = kbSemFiltros(); kbQ = null; kbVezQ++;
  kbGuardarFiltros();
  var i = el('kbQ');
  if (i) i.value = '';
  kbPintarQuadro(); kbPintarChips();
}
/* A janela de escolha de um filtro: «Todos» e as opções, cada uma um botão;
   a escolhida marcada com o visto e o aria-pressed.
   Recebe: campo — tipo, etiqueta, responsavel, prioridade ou pai.
   Devolve: nada — abre a janela. */
function kbEscolher(campo) {
  if (!kbEstado || !Object.prototype.hasOwnProperty.call(KB_FILTROS, campo)) return;
  var ops = [];
  if (campo === 'tipo') ops = KB_TIPOS.map(function (t) { return [t, KB_NOMES_TIPOS[t]]; });
  else if (campo === 'etiqueta') ops = kbEstado.etiquetas.map(function (t) { return [t, t]; });
  else if (campo === 'responsavel') ops = [['eu', 'Os meus']].concat(kbEstado.pessoas.map(function (p) { return [p.id, p.nome]; }));
  else if (campo === 'prioridade') ops = [1, 2, 3, 4, 5].map(function (p) { return [String(p), KB_PRIORIDADES[p]]; });
  else if (campo === 'pai') {
    ops = kbEstado.cartoes.filter(function (c) { return c.tipo === 'epico'; }).map(function (c) { return [c.chave, c.chave + ' · ' + c.titulo]; });
  }
  var atual = kbFiltros[campo];
  var opcao = function (valor, rotulo) {
    var on = String(valor) === String(atual);
    return '<button type="button" class="btn lista kb-opcao" aria-pressed="' + (on ? 'true' : 'false') + '"' + comAcao('kbFiltrar', [campo, valor]) + '>' +
      '<span class="flex1">' + esc(rotulo) + '</span>' + (on ? ic('kbVisto', 'i-sm') : '') + '</button>';
  };
  var vazio = { etiqueta: 'Ainda não há etiquetas nos cartões.', pai: 'Ainda não há épicos no quadro.', responsavel: 'Ainda não há ninguém para escolher.' };
  kbJanela('Filtrar por ' + KB_FILTROS[campo], '<div class="kb-opcoes">' + opcao('', campo === 'prioridade' || campo === 'etiqueta' ? 'Todas' : 'Todos') +
    (ops.length ? ops.map(function (o) { return opcao(o[0], o[1]); }).join('') : '<p class="sub">' + (vazio[campo] || 'Nada para escolher.') + '</p>') + '</div>',
    { foco: '.kb-opcao[aria-pressed="true"]' });
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

/* ------------------------------- arrastar -------------------------------- */
/* Com o rato arrasta-se o cartão inteiro; com o dedo, pela pega (só ela tem
   touch-action:none, e arrastar no resto do cartão continua a rolar). A
   partir de 6px o cartão levanta-se: sai do fluxo (fixo, à mesma largura)
   e segue o ponteiro por transform; no lugar de destino aparece o lugar
   tracejado da altura dele, e a coluna de destino acende. Perto das bordas
   o quadro rola de lado e a coluna rola na vertical. Largar move logo
   (otimista) e assenta o cartão do sítio onde se largou até ao novo; se o
   servidor recusar, volta. Esc e o pointercancel desfazem. No telemóvel
   arrasta-se só dentro da coluna à vista; mudar de coluna é pelo «Mover
   para…». */

/* Pousou o rato num cartão (ou o dedo na pega): fica à escuta do resto do
   gesto. O rato só prende o ponteiro quando o arrasto começa, para um
   clique simples continuar a abrir o cartão.
   Recebe: e — o PointerEvent do pointerdown.
   Devolve: nada. */
function kbPousar(e) {
  if (kbArr || (e.button != null && e.button > 0) || e.isPrimary === false) return;
  var t = e.target;
  if (!t || !t.closest) return;
  var pega = t.closest('.kb-pega'), no = t.closest('.kb-cartao');
  if (!no || !no.closest('#kbQuadro')) return;
  if (!pega && (e.pointerType !== 'mouse' || t.closest('.kb-mais'))) return;
  if (pega) e.preventDefault();
  kbArr = { no: no, chave: no.getAttribute('data-chave'), id: e.pointerId, pega: pega, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
    ativo: false, cancelado: false, lugar: null, chaveAlvo: '', colAlvo: null, raf: 0, vx: 0, vy: 0, lista: null };
  if (pega) { try { pega.setPointerCapture(e.pointerId); } catch (x) { /* sem captura, segue pelo documento */ } }
  document.addEventListener('pointermove', kbArrMove);
  document.addEventListener('pointerup', kbArrLargar);
  document.addEventListener('pointercancel', kbArrCancelar);
  window.addEventListener('keydown', kbArrTecla, true);
}
/* O ponteiro andou: passado o limiar, levanta o cartão; depois leva-o com ele.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada. */
function kbArrMove(e) {
  var a = kbArr;
  if (!a || a.cancelado || e.pointerId !== a.id) return;
  if (!a.no.isConnected) { kbArrCancelar(); return; }
  a.x = e.clientX; a.y = e.clientY;
  if (!a.ativo) {
    if (Math.abs(a.x - a.x0) < 6 && Math.abs(a.y - a.y0) < 6) return;
    kbArrComecar();
  }
  if (e.preventDefault) e.preventDefault();
  kbArrPintar();
  kbArrRolagem();
}
/* Levanta o cartão: deixa o lugar tracejado no sítio dele e passa-o a fixo,
   à mesma largura e no mesmo sítio, para o transform o levar.
   Devolve: nada. */
function kbArrComecar() {
  var a = kbArr, r = a.no.getBoundingClientRect();
  a.ativo = true;
  a.colOrigem = a.no.closest('.kb-col');
  a.lugar = document.createElement('div');
  a.lugar.className = 'kb-lugar';
  a.lugar.setAttribute('aria-hidden', 'true');
  a.lugar.style.height = Math.round(r.height) + 'px';
  a.no.parentNode.insertBefore(a.lugar, a.no);
  a.no.style.width = r.width + 'px';
  a.no.style.left = r.left + 'px';
  a.no.style.top = r.top + 'px';
  a.no.classList.add('kb-no-ar');
  var q = el('kbQuadro');
  if (q) q.classList.add('kb-a-arrastar');
  try { a.no.setPointerCapture(a.id); } catch (x) { /* segue pelo documento */ }
}
/* Leva o cartão com o ponteiro e mostra onde vai cair.
   Devolve: nada. */
function kbArrPintar() {
  var a = kbArr;
  if (!a || !a.ativo) return;
  a.no.style.transform = 'translate(' + Math.round(a.x - a.x0) + 'px,' + Math.round(a.y - a.y0) + 'px)';
  var alvo = kbArrAlvo(a.x, a.y);
  if (!alvo) return;
  var chave = alvo.lista.getAttribute('data-coluna') + '|' + (alvo.antes ? alvo.antes.getAttribute('data-chave') : '');
  if (chave === a.chaveAlvo) return;
  a.chaveAlvo = chave; a.lista = alvo.lista;
  if (alvo.antes) alvo.lista.insertBefore(a.lugar, alvo.antes); else alvo.lista.appendChild(a.lugar);
  var col = alvo.lista.closest('.kb-col');
  if (a.colAlvo !== col) {
    if (a.colAlvo) a.colAlvo.classList.remove('kb-alvo');
    a.colAlvo = col;
    if (col && col !== a.colOrigem) col.classList.add('kb-alvo');
  }
}
/* Onde vai cair o cartão com o ponteiro em (x, y): a coluna debaixo dele (a
   mais perto, dentro do que o quadro mostra; no telemóvel, sempre a da
   origem) e, nela, antes de que cartão — pelo meio de cada um.
   Recebe: x, y — o ponteiro (clientX, clientY).
   Devolve: {lista, antes} — antes é o cartão que fica a seguir (null no fim) —, ou null. */
function kbArrAlvo(x, y) {
  var a = kbArr, q = el('kbQuadro');
  if (!q) return null;
  var col = null;
  if (kbTelemovel()) col = a.colOrigem;
  else {
    var rq = q.getBoundingClientRect(), xx = Math.max(rq.left + 1, Math.min(rq.right - 1, x)), dist = Infinity;
    [].slice.call(q.querySelectorAll('.kb-col')).forEach(function (c) {
      var r = c.getBoundingClientRect();
      if (r.right < rq.left || r.left > rq.right) return;
      var d = xx < r.left ? r.left - xx : xx > r.right ? xx - r.right : 0;
      if (d < dist) { dist = d; col = c; }
    });
  }
  var lista = col && col.querySelector('.kb-col-lista');
  if (!lista) return null;
  var antes = null, cs = lista.querySelectorAll('.kb-cartao');
  for (var i = 0; i < cs.length; i++) {
    if (cs[i] === a.no) continue;
    var r2 = cs[i].getBoundingClientRect();
    if (y < r2.top + r2.height / 2) { antes = cs[i]; break; }
  }
  return { lista: lista, antes: antes };
}
/* Perto das bordas, o quadro rola de lado (no computador) e a coluna rola
   na vertical, mais depressa quanto mais perto.
   Devolve: nada — arranca ou pára o passo da auto-rolagem. */
function kbArrRolagem() {
  var a = kbArr, q = el('kbQuadro');
  if (!a || !a.ativo || !q) return;
  var zona = 56, v = function (p, lo, hi) {
    if (p < lo + zona) return -Math.ceil(16 * Math.min(1, (lo + zona - p) / zona));
    if (p > hi - zona) return Math.ceil(16 * Math.min(1, (p - (hi - zona)) / zona));
    return 0;
  };
  var rq = q.getBoundingClientRect();
  a.vx = kbTelemovel() ? 0 : v(a.x, rq.left, rq.right);
  var l = a.lista;
  if (l) { var rl = l.getBoundingClientRect(); a.vy = v(a.y, Math.max(rl.top, 0), Math.min(rl.bottom, window.innerHeight)); } else a.vy = 0;
  if ((a.vx || a.vy) && !a.raf) a.raf = requestAnimationFrame(kbArrPasso);
}
/* Um passo da auto-rolagem: rola e volta a procurar o destino debaixo do ponteiro.
   Devolve: nada. */
function kbArrPasso() {
  var a = kbArr, q = el('kbQuadro');
  if (!a) return;
  a.raf = 0;
  if (!a.ativo || !q) return;
  var mexeu = false;
  if (a.vx) { var x = q.scrollLeft; q.scrollLeft += a.vx; mexeu = q.scrollLeft !== x; }
  if (a.vy && a.lista) { var y = a.lista.scrollTop; a.lista.scrollTop += a.vy; mexeu = mexeu || a.lista.scrollTop !== y; }
  if (!mexeu) return;
  a.chaveAlvo = '';
  kbArrPintar();
  kbArrRolagem();
}
/* Tira os ouvintes, o lugar tracejado e a marca da coluna, e devolve o
   cartão ao fluxo (no sítio de onde saiu).
   Recebe: a — o estado do arrasto.
   Devolve: nada. */
function kbArrDesfazer(a) {
  if (a.raf) { cancelAnimationFrame(a.raf); a.raf = 0; }
  document.removeEventListener('pointermove', kbArrMove);
  document.removeEventListener('pointerup', kbArrLargar);
  document.removeEventListener('pointercancel', kbArrCancelar);
  window.removeEventListener('keydown', kbArrTecla, true);
  if (a.lugar && a.lugar.parentNode) a.lugar.parentNode.removeChild(a.lugar);
  if (a.colAlvo) a.colAlvo.classList.remove('kb-alvo');
  a.no.classList.remove('kb-no-ar');
  a.no.style.width = ''; a.no.style.left = ''; a.no.style.top = ''; a.no.style.transform = '';
  var q = el('kbQuadro');
  if (q) q.classList.remove('kb-a-arrastar');
  kbArr = null;
  if (a.ativo) kbArrAcabou = Date.now();
}
/* Largou: sem ter arrastado, era um clique (segue o seu caminho); arrastado,
   o cartão vai para o lugar tracejado. No mesmo lugar, só assenta de volta.
   Recebe: e — o PointerEvent do pointerup.
   Devolve: nada. */
function kbArrLargar(e) {
  var a = kbArr;
  if (!a || (e && e.pointerId !== a.id)) return;
  if (!a.ativo || a.cancelado) { kbArrDesfazer(a); return; }
  var lista = a.lugar.parentNode, coluna = lista && lista.getAttribute('data-coluna');
  var depois = kbIrmaoCartao(a.lugar, 'nextElementSibling', a.no), antes = kbIrmaoCartao(a.lugar, 'previousElementSibling', a.no);
  var rect = a.no.getBoundingClientRect();
  kbArrDesfazer(a);
  var c = kbCartao(a.chave);
  if (!c || !coluna) { kbPintarDepoisDoArrasto(); return; }
  var ordem = kbDaColuna(coluna).filter(function (x) { return x.chave !== a.chave; }).map(function (x) { return x.chave; });
  var indice = kbIndiceEntre(ordem, depois, antes);
  var agora = kbDaColuna(c.coluna_id).map(function (x) { return x.chave; }).indexOf(a.chave);
  if (coluna === c.coluna_id && indice === agora) { kbPintarDepoisDoArrasto(); kbAssentarChave(a.chave, rect); return; }
  kbPintarDepois = false;
  kbMover(a.chave, coluna, indice, rect);
}
// O repintar que ficou à espera do fim do arrasto (uma leitura que chegou a meio).
// Devolve: nada.
function kbPintarDepoisDoArrasto() {
  if (!kbPintarDepois) return;
  kbPintarDepois = false;
  kbPintarQuadro(); kbPintarChips();
}
/* O cartão vizinho do lugar tracejado (saltando o que está a ser arrastado).
   Recebe: no — o lugar; lado — 'nextElementSibling' ou 'previousElementSibling'; salta — o cartão no ar.
   Devolve: a chave do vizinho, ou ''. */
function kbIrmaoCartao(no, lado, salta) {
  for (var n = no[lado]; n; n = n[lado]) {
    if (n !== salta && n.classList && n.classList.contains('kb-cartao')) return n.getAttribute('data-chave') || '';
  }
  return '';
}
/* O indice que o servidor quer (a posição entre os cartões da coluna, sem
   o que se move), a partir dos vizinhos à vista do lugar onde se largou —
   com filtros, entre os vizinhos podem estar cartões escondidos, e é a
   ordem inteira que conta.
   Recebe: ordem — as chaves da coluna de destino, sem a do cartão; depois —
   a chave do cartão à vista a seguir ('' sem nenhum); antes — a do anterior.
   Devolve: o índice (0 = topo). */
function kbIndiceEntre(ordem, depois, antes) {
  var i = depois ? ordem.indexOf(depois) : -1;
  if (i > -1) return i;
  var j = antes ? ordem.indexOf(antes) : -1;
  if (j > -1) return j + 1;
  return depois ? 0 : ordem.length;
}
/* A ordem do quadro com um cartão movido: tira-o, muda-lhe a coluna e
   mete-o no indice da coluna de destino (maior do que o total, no fim).
   Recebe: cartoes — a lista do quadro; chave; coluna — o id de destino; indice.
   Devolve: a lista nova (a antiga fica como estava). */
function kbMoverLocal(cartoes, chave, coluna, indice) {
  var c = null, resto = [];
  cartoes.forEach(function (x) { if (x.chave === chave) c = x; else resto.push(x); });
  if (!c) return cartoes.slice();
  var novo = Object.assign({}, c, { coluna_id: coluna });
  var n = 0, pos = -1, ultimo = -1;
  for (var i = 0; i < resto.length; i++) {
    if (resto[i].coluna_id !== coluna) continue;
    if (n === indice) { pos = i; break; }
    n++; ultimo = i;
  }
  if (pos < 0) pos = ultimo > -1 ? ultimo + 1 : resto.length;
  resto.splice(pos, 0, novo);
  return resto;
}
/* Esc a meio de um arrasto desfaz-o (e não fecha nada por trás).
   Recebe: e — o KeyboardEvent.
   Devolve: nada. */
function kbArrTecla(e) {
  var a = kbArr;
  if (!a || e.key !== 'Escape') return;
  e.preventDefault(); e.stopPropagation();
  kbArrCancelar();
}
/* O browser tomou o gesto (pointercancel), ou o Esc: o cartão volta ao sítio, a assentar.
   Devolve: nada. */
function kbArrCancelar() {
  var a = kbArr;
  if (!a) return;
  var rect = a.ativo ? a.no.getBoundingClientRect() : null, chave = a.chave;
  kbArrDesfazer(a);
  kbPintarDepoisDoArrasto();
  if (rect) kbAssentarChave(chave, rect);
}

/* Assenta um cartão no sítio novo a partir de onde estava (FLIP): parte do
   retângulo antigo e desliza até ao novo com a --curva-entra. Com menos
   movimento, aparece logo no sítio.
   Recebe: no — o cartão (já no sítio novo); r0 — o retângulo de onde vem.
   Devolve: nada. */
function kbAssentar(no, r0) {
  if (!no || !r0 || kbReduzido() || !no.getBoundingClientRect) return;
  var r = no.getBoundingClientRect();
  if (!r.width) return;
  var dx = Math.round(r0.left - r.left), dy = Math.round(r0.top - r.top);
  if (!dx && !dy) return;
  no.classList.remove('kb-assenta');
  no.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  no.getBoundingClientRect();
  no.classList.add('kb-assenta');
  no.style.transform = '';
  setTimeout(function () { no.classList.remove('kb-assenta'); }, 400);
}
// Assenta o cartão desta chave, procurado no quadro.
// Recebe: chave; r0 — o retângulo de onde vem.
// Devolve: nada.
function kbAssentarChave(chave, r0) {
  var q = el('kbQuadro');
  kbAssentar(q && q.querySelector('.kb-cartao[data-chave="' + String(chave).replace(/[^\w-]/g, '') + '"]'), r0);
}

/* Move um cartão: logo no ecrã (otimista), depois no servidor; se ele
   recusar, o cartão volta para onde estava e o aviso diz porquê.
   Recebe: chave; coluna — o id de destino; indice — a posição nela (0 =
   topo, sem contar o próprio); r0 (opcional) — o retângulo de onde parte, para assentar.
   Devolve: nada. */
function kbMover(chave, coluna, indice, r0) {
  var c = kbCartao(chave);
  if (!c || !kbEstado) return;
  var origem = c.coluna_id, antes = kbEstado.cartoes;
  if (!r0) {
    var q = el('kbQuadro'), no = q && q.querySelector('.kb-cartao[data-chave="' + chave + '"]');
    r0 = no ? no.getBoundingClientRect() : null;
  }
  kbEstado.cartoes = kbMoverLocal(antes, chave, coluna, indice);
  kbPintarQuadro(); kbPintarChips();
  kbAssentarChave(chave, r0);
  kbEmVoo++;
  enviar(kbRota(chave, '/mover'), { coluna_id: coluna, indice: indice }).then(function () {
    kbEmVoo--;
    if (coluna !== origem) avisar(chave + ' passou para «' + kbNomeColuna(coluna) + '».');
    if (kbEmVoo === 0) kbRecarregar();
    if (kbAberto === chave) kbAbrir(chave, false);
  }, function (e) {
    kbEmVoo--;
    var q2 = el('kbQuadro'), no2 = q2 && q2.querySelector('.kb-cartao[data-chave="' + chave + '"]');
    var r1 = no2 ? no2.getBoundingClientRect() : null;
    if (kbEstado) kbEstado.cartoes = kbMoverLocal(kbEstado.cartoes, chave, origem, kbPosicaoEm(antes, chave, origem));
    kbPintarQuadro(); kbPintarChips();
    kbAssentarChave(chave, r1);
    avisar((e && e.message) || 'Não deu para mover o cartão.', 'erro');
    if (kbEmVoo === 0) kbRecarregar();
  });
}
// A posição de um cartão na sua coluna (sem contar com ele), numa lista do quadro.
// Recebe: cartoes — a lista; chave; coluna — o id da coluna.
// Devolve: o índice (0 = topo).
function kbPosicaoEm(cartoes, chave, coluna) {
  var i = cartoes.filter(function (x) { return x.coluna_id === coluna; }).map(function (x) { return x.chave; }).indexOf(chave);
  return i < 0 ? 0 : i;
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

/* -------------------------------- a janela ------------------------------- */

/* Uma janela do kanban no dialog#dialogo (a mesma do guião, com as mesmas
   regras): o título, o corpo e, com aoConfirmar, Cancelar e o botão da
   ação — que espera enquanto o servidor responde e, se ele recusar, deixa a
   janela aberta com o porquê; sem aoConfirmar é uma lista de escolhas, só
   com Fechar. Ao fechar, esvazia-se.
   Recebe: titulo — o título (texto); corpo — o HTML (seguro); opcoes
   (opcional) — {aoConfirmar: função que lê os campos e devolve false (fica,
   com os erros marcados) ou uma promessa; botao; perigo; texto (HTML
   seguro); foco: o seletor do que recebe o foco}.
   Devolve: nada — abre a janela. */
function kbJanela(titulo, corpo, opcoes) {
  var o = opcoes || {}, d = el('dialogo');
  if (!d) return;
  if (typeof formAberto !== 'undefined') formAberto = null;
  kbJanelaAberta = { aoConfirmar: o.aoConfirmar || null, botao: o.botao || 'Guardar', ocupado: false };
  d.innerHTML = '<div class="janela-corpo kb-janela"><h2 id="janelaTit">' + esc(titulo) + '</h2>' +
    (o.texto ? '<p class="janela-txt">' + o.texto + '</p>' : '') + corpo +
    '<p class="erro-txt" id="kbJanelaErro" role="alert"></p><div class="janela-botoes">' +
    (o.aoConfirmar
      ? '<button type="button" class="btn"' + comAcao('fecharDialogo') + '>Cancelar</button>' +
        '<button type="button" id="kbJanelaOk" class="btn ' + (o.perigo ? 'danger' : 'primary') + '"' + comAcao('kbConfirmar') + '>' + esc(kbJanelaAberta.botao) + '</button>'
      : '<button type="button" class="btn"' + comAcao('fecharDialogo') + '>Fechar</button>') + '</div></div>';
  d.returnValue = '';
  d.onclose = function () {
    if (d.open) return;
    kbJanelaAberta = null;
    d.innerHTML = '';
  };
  if (!d.open) d.showModal();
  var f = (o.foco && d.querySelector(o.foco)) || d.querySelector('input:not([type=radio]),textarea,input:checked') || d.querySelector('.kb-opcao');
  if (f && f.focus) f.focus();
}
/* Confirma a janela aberta: o aoConfirmar lê e confere os campos (false
   deixa-a aberta com os erros); com uma promessa, o botão espera e fecha no
   fim, ou mostra o erro do servidor ao lado do campo de que fala.
   Devolve: nada. */
function kbConfirmar() {
  var j = kbJanelaAberta;
  if (!j || j.ocupado || !j.aoConfirmar) return;
  var e0 = el('kbJanelaErro');
  if (e0) e0.textContent = '';
  var r = j.aoConfirmar();
  if (r === false) return;
  j.ocupado = true;
  kbJanelaOcupada(true);
  Promise.resolve(r).then(function () {
    if (kbJanelaAberta === j) el('dialogo').close();
  }, function (e) {
    if (kbJanelaAberta !== j) return;
    j.ocupado = false;
    kbJanelaOcupada(false);
    var msg = (e && e.message) || 'Não deu.', campo = e && e.campo;
    if (campo && el(campo + 'Erro')) marcarErro(campo, msg);
    else if (el('kbJanelaErro')) el('kbJanelaErro').textContent = msg;
  });
}
// O botão da janela enquanto o servidor responde: parado e a dizer que espera.
// Recebe: sim — true enquanto espera.
// Devolve: nada.
function kbJanelaOcupada(sim) {
  var b = el('kbJanelaOk');
  if (!b || !kbJanelaAberta) return;
  b.disabled = sim;
  b.textContent = sim ? 'À espera do servidor…' : kbJanelaAberta.botao;
}
// Fecha a janela, se uma ação dentro dela levar a outro sítio.
// Devolve: nada.
function kbFecharJanela() {
  var d = el('dialogo');
  if (d && d.open) d.close();
}

/* ------------------------- criar e editar um cartão ------------------------ */

/* Um grupo de escolhas (o tipo, a coluna, a prioridade, o responsável):
   rádios dentro de chips, num fieldset com a legenda — nunca o seletor nativo.
   Recebe: id — o id do grupo (o erro vai em id + 'Erro'); rotulo; obrigatorio;
   opcoes — [[valor, rotulo HTML seguro]…]; valor — o escolhido.
   Devolve: o HTML. */
function kbGrupoHtml(id, rotulo, obrigatorio, opcoes, valor) {
  return '<fieldset class="kb-grupo campo-bloco" id="' + id + '" aria-describedby="' + id + 'Erro"><legend class="rot">' + rotulo +
    (obrigatorio ? ' <span class="req">*</span>' : '') + '</legend><div class="chips">' +
    opcoes.map(function (o) {
      return '<label class="chip"><input type="radio" class="so-leitor" name="' + id + '" value="' + esc(o[0]) + '"' +
        (String(o[0]) === String(valor) ? ' checked' : '') + '>' + o[1] + '</label>';
    }).join('') + '</div><p class="erro-txt" id="' + id + 'Erro"></p></fieldset>';
}
/* Um campo de texto da janela: o rótulo (com o * vermelho quando é
   obrigatório), a ajuda, o campo e o sítio do erro ao lado dele.
   Recebe: id; rotulo; obrigatorio; tipo — 'text', 'date' ou 'area'; valor;
   ph — o placeholder («Opcional» ou «Ex: …»; '' nas datas); max; ajuda (opcional).
   Devolve: o HTML. */
function kbCampoHtml(id, rotulo, obrigatorio, tipo, valor, ph, max, ajuda) {
  var comum = ' id="' + id + '" class="campo" aria-describedby="' + id + 'Erro' + (ajuda ? ' ' + id + 'Ajuda' : '') + '"' +
    (max ? ' maxlength="' + max + '"' : '') + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (obrigatorio ? ' aria-required="true"' : '');
  var entrada = tipo === 'area'
    ? '<textarea' + comum + '>' + esc(valor) + '</textarea>'
    : '<input' + comum + ' type="' + tipo + '" autocomplete="off" value="' + esc(valor) + '"' + ligarA('enter', 'kbConfirmar') + '>';
  return '<div class="campo-bloco"><label class="rot" for="' + id + '">' + rotulo + (obrigatorio ? ' <span class="req">*</span>' : '') + '</label>' +
    (ajuda ? '<p class="sub" id="' + id + 'Ajuda">' + ajuda + '</p>' : '') + entrada + '<p class="erro-txt" id="' + id + 'Erro"></p></div>';
}
// O valor do rádio escolhido de um grupo.
// Recebe: nome — o name dos rádios.
// Devolve: o valor, ou ''.
function kbEscolhido(nome) {
  var r = document.querySelector('input[name="' + nome + '"]:checked');
  return r ? r.value : '';
}
/* As etiquetas escritas num campo, como o servidor as quer: separadas por
   vírgulas, em minúsculas, os espaços de dentro a hífen, sem repetidas.
   Recebe: texto — o que se escreveu.
   Devolve: {lista, erro} — erro '' quando estão boas. */
function kbEtiquetasDe(texto) {
  var lista = [];
  String(texto || '').split(',').forEach(function (t) {
    t = t.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && lista.indexOf(t) < 0) lista.push(t);
  });
  var longa = lista.filter(function (t) { return t.length > 40; })[0];
  if (longa) return { lista: lista, erro: 'Cada etiqueta tem até 40 caracteres («' + longa.slice(0, 20) + '…» tem ' + longa.length + ').' };
  if (lista.length > 20) return { lista: lista, erro: 'Até 20 etiquetas por cartão (tens ' + lista.length + ').' };
  return { lista: lista, erro: '' };
}
/* O campo de que fala uma recusa do servidor, para o erro ir para o lado
   dele (o servidor responde só com a frase).
   Recebe: msg — a frase do erro.
   Devolve: o id do campo do formulário, ou ''. */
function kbCampoDoErro(msg) {
  var m = String(msg || '');
  if (/t[íi]tulo/i.test(m)) return 'kbF-titulo';
  if (/\btipo\b/i.test(m)) return 'kbF-tipo';
  if (/\bpai\b|épico|epico|antepassado|subtarefa/i.test(m)) return 'kbF-pai';
  if (/etiqueta/i.test(m)) return 'kbF-etiquetas';
  if (/prazo|data/i.test(m)) return 'kbF-prazo';
  if (/prioridade/i.test(m)) return 'kbF-prioridade';
  if (/respons|pessoa/i.test(m)) return 'kbF-responsavel';
  if (/coluna/i.test(m)) return 'kbF-coluna';
  if (/descri/i.test(m)) return 'kbF-descricao';
  return '';
}
/* O formulário de criar e de editar um cartão: Tipo* e Título*, e o resto
   opcional (descrição, coluna — só ao criar —, prioridade, etiquetas,
   responsável, pai e prazo). Os erros vão para o lado do campo.
   Recebe: modo — 'criar' ou 'editar'; c — o cartão a editar (com a
   descrição; null ao criar); pre (opcional) — ao criar, {coluna_id, pai, tipo}.
   Devolve: nada — abre a janela. */
function kbFormCartao(modo, c, pre) {
  if (!kbEstado) return;
  var p = pre || {}, ed = modo === 'editar' && c;
  var v = ed ? {
    tipo: c.tipo, titulo: c.titulo, descricao: c.descricao || '', prioridade: String(c.prioridade || 3), etiquetas: (c.etiquetas || []).join(', '),
    responsavel: c.responsavel ? c.responsavel.id : '', pai: c.pai ? c.pai.chave : '', prazo: c.prazo || '', coluna: c.coluna_id,
  } : {
    tipo: KB_NOMES_TIPOS[p.tipo] ? p.tipo : 'tarefa', titulo: '', descricao: '', prioridade: '3', etiquetas: '', responsavel: '',
    pai: p.pai || '', prazo: '', coluna: kbColuna(p.coluna_id) ? p.coluna_id : (kbColuna('a-fazer') ? 'a-fazer' : (kbEstado.colunas[0] || {}).id),
  };
  var tipos = KB_TIPOS.map(function (t) { return [t, ic('kb' + maiuscula(t), 'i-sm kb-t-' + t) + KB_NOMES_TIPOS[t]]; });
  var prios = [1, 2, 3, 4, 5].map(function (n) { return [String(n), ic('kbP' + n, 'i-sm kb-p' + n) + KB_PRIORIDADES[n]]; });
  var pessoas = [['', 'Ninguém']].concat(kbEstado.pessoas.map(function (x) { return [x.id, esc(x.nome)]; }));
  var corpo = kbGrupoHtml('kbF-tipo', 'Tipo', true, tipos, v.tipo) +
    kbCampoHtml('kbF-titulo', 'Título', true, 'text', v.titulo, 'Ex: Corrigir o aviso da renda em atraso', 200) +
    (ed && c.descricaoOculta ? '' : kbCampoHtml('kbF-descricao', 'Descrição', false, 'area', v.descricao, 'Opcional', 20000)) +
    (ed ? '' : kbGrupoHtml('kbF-coluna', 'Coluna', false, kbEstado.colunas.map(function (x) { return [x.id, esc(x.nome)]; }), v.coluna)) +
    kbGrupoHtml('kbF-prioridade', 'Prioridade', false, prios, v.prioridade) +
    kbCampoHtml('kbF-etiquetas', 'Etiquetas', false, 'text', v.etiquetas, 'Ex: qa, design', 900, 'Separadas por vírgulas.') +
    kbGrupoHtml('kbF-responsavel', 'Responsável', false, pessoas, v.responsavel) +
    kbCampoHtml('kbF-pai', 'Pai', false, 'text', v.pai, 'Ex: KAN-12', 20, 'O épico de uma história ou tarefa, ou a tarefa de uma subtarefa.') +
    kbCampoHtml('kbF-prazo', 'Prazo', false, 'date', v.prazo, '', 0);
  kbJanela(ed ? 'Editar ' + c.chave : 'Novo cartão', corpo, {
    botao: ed ? 'Guardar' : 'Adicionar',
    foco: '#kbF-titulo',
    aoConfirmar: function () { return kbGuardarCartao(ed ? c : null, v); },
  });
}
/* Lê e confere o formulário do cartão e manda-o ao servidor: ao criar, tudo;
   ao editar, só o que mudou.
   Recebe: c — o cartão a editar (null ao criar); v — os valores com que a janela abriu.
   Devolve: false com erros marcados, ou a promessa do pedido (rejeita com o campo em e.campo). */
function kbGuardarCartao(c, v) {
  var tipo = kbEscolhido('kbF-tipo'), titulo = valorDe('kbF-titulo'), descricao = el('kbF-descricao') ? String(el('kbF-descricao').value || '').trim() : '';
  var prioridade = kbEscolhido('kbF-prioridade') || '3', responsavel = kbEscolhido('kbF-responsavel');
  var et = kbEtiquetasDe(valorDe('kbF-etiquetas')), paiTxt = valorDe('kbF-pai'), pai = paiTxt ? kbChave(paiTxt) : '', prazo = valorDe('kbF-prazo');
  var erros = {
    'kbF-tipo': tipo ? '' : 'Escolhe o tipo.',
    'kbF-titulo': titulo ? '' : 'Escreve um título.',
    'kbF-etiquetas': et.erro,
    'kbF-pai': paiTxt && !pai ? 'Escreve a chave do pai, como KAN-12.'
      : pai && tipo === 'epico' ? 'Um épico não tem pai: deixa o campo vazio.'
      : !pai && tipo === 'subtarefa' ? 'Uma subtarefa precisa de um pai: escreve a chave da tarefa.'
      : pai && c && pai === c.chave ? 'Um cartão não pode ser pai de si mesmo.' : '',
    'kbF-prazo': prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo) ? 'Escolhe um dia, ou deixa vazio.' : '',
  };
  var bom = true;
  Object.keys(erros).forEach(function (k) { marcarErro(k, erros[k]); if (erros[k]) bom = false; });
  if (!bom) {
    var primeiro = document.querySelector('#dialogo [aria-invalid="true"]');
    if (primeiro) { var foco = primeiro.querySelector ? primeiro.querySelector('input') || primeiro : primeiro; if (foco.focus) foco.focus(); }
    return false;
  }
  var corpo = {};
  if (!c) {
    corpo = { tipo: tipo, titulo: titulo, descricao: descricao, coluna_id: kbEscolhido('kbF-coluna') || v.coluna, prioridade: Number(prioridade), etiquetas: et.lista };
    if (responsavel) corpo.responsavel_id = responsavel;
    if (pai) corpo.pai = pai;
    if (prazo) corpo.prazo = prazo;
  } else {
    if (tipo !== v.tipo) corpo.tipo = tipo;
    if (titulo !== v.titulo) corpo.titulo = titulo;
    if (el('kbF-descricao') && descricao !== String(v.descricao || '').trim()) corpo.descricao = descricao;
    if (prioridade !== v.prioridade) corpo.prioridade = Number(prioridade);
    if (et.lista.join(',') !== kbEtiquetasDe(v.etiquetas).lista.join(',')) corpo.etiquetas = et.lista;
    if (responsavel !== v.responsavel) corpo.responsavel_id = responsavel || null;
    if (pai !== v.pai) corpo.pai = pai || null;
    if (prazo !== v.prazo) corpo.prazo = prazo || null;
    if (!Object.keys(corpo).length) { kbFecharJanela(); avisar('Nada mudou.'); return false; }
  }
  var pedido = c
    ? pedir(kbRota(c.chave), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    : enviar('/api/equipa/kanban/cartoes', corpo);
  return pedido.then(function (j) {
    var nova = j && j.cartao ? j.cartao.chave : '';
    avisar(c ? 'Cartão ' + c.chave + ' guardado.' : 'Cartão ' + (nova || 'novo') + ' adicionado' +
      (j && j.cartao && kbTelemovel() ? ' em «' + kbNomeColuna(j.cartao.coluna_id) + '».' : '.'));
    kbRecarregar();
    if (kbAberto && (c || corpo.pai === kbAberto)) kbAbrir(kbAberto, false);
  }, function (e) {
    var x = new Error((e && e.message) || 'Não deu para guardar.');
    x.campo = kbCampoDoErro(x.message);
    throw x;
  });
}
/* O «Novo cartão» e o «Adicionar cartão» de uma coluna.
   Recebe: coluna — o id da coluna onde fica ('' para A fazer).
   Devolve: nada — abre o formulário. */
function kbNovo(coluna) { kbFormCartao('criar', null, { coluna_id: coluna || '' }); }
/* O ponto de encaixe do + da barra de baixo e do «Novo cartão» de fora: vai
   ao Kanban se não estiver lá e abre o formulário de criar.
   Devolve: nada. */
function novoCartao() {
  if (el('kbQuadro') && kbEstado) { kbNovo(''); return; }
  kbAoCarregar = function () { kbNovo(''); };
  if (!el('kbEspera')) ir('kanban', '');
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

/* -------------------------------- colunas -------------------------------- */

/* «Colunas» (só o master): a lista das colunas com subir, descer, renomear,
   marcar de fim e remover, e o «Adicionar coluna». As fixas (as que a
   sincronização usa) renomeiam-se mas não se removem; uma com cartões
   também não — o servidor diz porquê, aqui na janela.
   Devolve: nada — abre a janela. */
function kbColunas() {
  if (!kbEstado || !kbEu().master) return;
  var cs = kbEstado.colunas, n = cs.length;
  var linhas = cs.map(function (c, i) {
    var total = kbDaColuna(c.id).length;
    return '<li class="kb-colm"><div class="kb-colm-txt"><span class="kb-colm-nome">' + esc(c.nome) + '</span>' +
      (c.fim ? badge('ok', 'De fim') : '') + (c.fixa ? badge('', 'Fixa') : '') + '<span class="sub n">' + kbConta(total, 'cartão', 'cartões') + '</span></div>' +
      '<div class="kb-colm-acoes">' +
      '<button type="button" class="btn sm ghost so-icone" aria-label="Subir ' + esc(c.nome) + '"' + (i === 0 ? ' disabled' : '') + comAcao('kbColunaOrdem', [c.id, -1]) + '>' + ic('voltar', 'i-sm kb-i-cima') + '</button>' +
      '<button type="button" class="btn sm ghost so-icone" aria-label="Descer ' + esc(c.nome) + '"' + (i === n - 1 ? ' disabled' : '') + comAcao('kbColunaOrdem', [c.id, 1]) + '>' + ic('voltar', 'i-sm kb-i-baixo') + '</button>' +
      '<button type="button" class="btn sm"' + comAcao('kbColunaRenomear', [c.id]) + '>Renomear</button>' +
      '<button type="button" class="btn sm"' + comAcao('kbColunaFim', [c.id]) + '>' + (c.fim ? 'Tirar de fim' : 'Marcar de fim') + '</button>' +
      (c.fixa ? '' : '<button type="button" class="btn sm ghost texto-perigo"' + comAcao('kbColunaRemover', [c.id]) + '>Remover</button>') + '</div></li>';
  }).join('');
  kbJanela('Colunas', '<p class="sub">As fixas são as que a sincronização usa: renomeiam-se, mas não se removem. O que chega a uma coluna de fim conta como feito.</p>' +
    '<ul class="kb-colms">' + linhas + '</ul><div><button type="button" class="btn sm"' + comAcao('kbColunaNova') + '>' + ic('mais', 'i-sm') + 'Adicionar coluna</button></div>');
}
/* Depois de mudar as colunas: relê o quadro, volta à lista das colunas e diz
   o que se fez. Quem fechou a janela entretanto não a vê abrir-se sozinha —
   só o renomear e o adicionar, que a fecharam ao confirmar, voltam à lista.
   Recebe: msg — a frase do aviso; reabrir (opcional) — true para voltar à lista mesmo com a janela fechada.
   Devolve: Promise. */
function kbDepoisDasColunas(msg, reabrir) {
  return kbRecarregar().then(function () {
    var d = el('dialogo');
    if (reabrir ? !(d && d.open) : (d && d.open && el('janelaTit') && el('janelaTit').textContent === 'Colunas')) kbColunas();
    avisar(msg);
  });
}
/* Um erro do servidor dito na janela das colunas (fica aberta).
   Recebe: e — o Error.
   Devolve: nada. */
function kbErroNasColunas(e) {
  var s = el('kbJanelaErro');
  if (s) s.textContent = (e && e.message) || 'Não deu.';
  else avisar((e && e.message) || 'Não deu.', 'erro');
}
/* Sobe ou desce uma coluna um lugar.
   Recebe: id; dir — -1 sobe, 1 desce.
   Devolve: nada. */
function kbColunaOrdem(id, dir) {
  var ids = kbEstado.colunas.map(function (c) { return c.id; }), i = ids.indexOf(id), j = i + Number(dir);
  if (i < 0 || j < 0 || j >= ids.length) return;
  ids[i] = ids[j]; ids[j] = id;
  enviar('/api/equipa/kanban/colunas/ordem', { ids: ids }).then(function () { return kbDepoisDasColunas('Ordem das colunas guardada.'); }).catch(kbErroNasColunas);
}
/* Marca ou tira uma coluna de fim.
   Recebe: id.
   Devolve: nada. */
function kbColunaFim(id) {
  var c = kbColuna(id);
  if (!c) return;
  pedir('/api/equipa/kanban/colunas/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fim: !c.fim }) })
    .then(function () { return kbDepoisDasColunas(c.fim ? '«' + c.nome + '» deixou de ser de fim.' : '«' + c.nome + '» passou a ser de fim.'); }).catch(kbErroNasColunas);
}
/* Remove uma coluna (o servidor recusa as fixas e as que têm cartões, e diz porquê).
   Recebe: id.
   Devolve: nada. */
function kbColunaRemover(id) {
  var c = kbColuna(id);
  pedir('/api/equipa/kanban/colunas/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function () { return kbDepoisDasColunas('Coluna «' + (c ? c.nome : id) + '» removida.'); }).catch(kbErroNasColunas);
}
/* Renomeia uma coluna.
   Recebe: id.
   Devolve: nada — abre a janela. */
function kbColunaRenomear(id) {
  var c = kbColuna(id);
  if (!c) return;
  kbJanela('Renomear «' + c.nome + '»', kbCampoHtml('kbF-coluna-nome', 'Nome', true, 'text', c.nome, 'Ex: Em revisão', 60), {
    foco: '#kbF-coluna-nome',
    aoConfirmar: function () {
      var nome = valorDe('kbF-coluna-nome');
      marcarErro('kbF-coluna-nome', nome ? '' : 'Escreve um nome.');
      if (!nome) return false;
      return pedir('/api/equipa/kanban/colunas/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome }) })
        .then(function () { setTimeout(function () { kbDepoisDasColunas('Coluna renomeada.', true); }, 0); });
    },
  });
}
/* Adiciona uma coluna (vai para o fim do quadro).
   Devolve: nada — abre a janela. */
function kbColunaNova() {
  kbJanela('Adicionar coluna', kbCampoHtml('kbF-coluna-nome', 'Nome', true, 'text', '', 'Ex: Em revisão', 60) +
    '<label class="kb-marcar"><input type="checkbox" id="kbF-coluna-fim"> Conta como feito (coluna de fim)</label>', {
    botao: 'Adicionar', foco: '#kbF-coluna-nome',
    aoConfirmar: function () {
      var nome = valorDe('kbF-coluna-nome'), fim = !!(el('kbF-coluna-fim') && el('kbF-coluna-fim').checked);
      marcarErro('kbF-coluna-nome', nome ? '' : 'Escreve um nome.');
      if (!nome) return false;
      return enviar('/api/equipa/kanban/colunas', { nome: nome, fim: fim })
        .then(function () { setTimeout(function () { kbDepoisDasColunas('Coluna «' + nome + '» adicionada.', true); }, 0); });
    },
  });
}

/* ------------------------------- as ações ------------------------------- */

/* Uma ação que pode vir de dentro da janela (o ⋯ de um cartão): fecha-a
   antes de seguir, a menos que a própria ação reabra a janela.
   Recebe: alvo — o elemento clicado.
   Devolve: nada. */
function kbSairDaJanela(alvo) {
  if (alvo && alvo.closest && alvo.closest('#dialogo')) kbFecharJanela();
}
// O clique que vem logo depois de um arrasto não abre nada.
// Devolve: true quando é esse clique.
function kbDepoisDeArrastar() { return Date.now() - kbArrAcabou < 400; }

ACOES.kbAbrir = function (d, alvo) { if (kbDepoisDeArrastar()) return; kbSairDaJanela(alvo); kbAbrir(d.arg, true); };
ACOES.kbFechar = function () { kbFechar(); };
ACOES.kbTentar = function (d) { verKanban(d.arg || ''); };
ACOES.kbMenuCartao = function (d) { if (!kbDepoisDeArrastar()) kbMenuCartao(d.arg); };
ACOES.kbMoverPara = function (d) { if (!kbDepoisDeArrastar()) kbMoverPara(d.arg); };
ACOES.kbMover = function (d) { kbFecharJanela(); kbMover(d.arg, d.arg2, Number(d.arg3) || 0); };
ACOES.kbEditar = function (d, alvo) { kbSairDaJanela(alvo); kbEditar(d.arg); };
ACOES.kbCopiar = function (d, alvo) { kbSairDaJanela(alvo); kbCopiar(d.arg); };
ACOES.kbRemover = function (d, alvo) { kbSairDaJanela(alvo); kbRemover(d.arg); };
ACOES.kbRepor = function (d) { kbRepor(d.arg); };
ACOES.kbNovo = function (d) { kbNovo(d.arg); };
ACOES.kbNovoSub = function (d) { kbNovoSub(d.arg); };
ACOES.kbConfirmar = function () { kbConfirmar(); };
ACOES.kbEscolher = function (d) { kbEscolher(d.arg); };
ACOES.kbFiltrar = function (d) { kbFiltrar(d.arg, d.arg2); };
ACOES.kbOsMeus = function () { kbFiltrar('responsavel', kbFiltros.responsavel === 'eu' ? '' : 'eu'); };
ACOES.kbLimparFiltros = function () { kbLimparFiltros(); };
ACOES.kbPesquisar = function (d, alvo) { kbPesquisar(alvo && alvo.value); };
ACOES.kbFiltrosAlternar = function () { kbFiltrosAbertos = !kbFiltrosAbertos; kbPintarChips(); kbMedirTopo(); };
ACOES.kbVerColuna = function (d) { kbVerColuna(d.arg); };
ACOES.kbColunas = function () { kbColunas(); };
ACOES.kbColunaNova = function () { kbColunaNova(); };
ACOES.kbColunaRenomear = function (d) { kbColunaRenomear(d.arg); };
ACOES.kbColunaOrdem = function (d) { kbColunaOrdem(d.arg, d.arg2); };
ACOES.kbColunaFim = function (d) { kbColunaFim(d.arg); };
ACOES.kbColunaRemover = function (d) { kbColunaRemover(d.arg); };
ACOES.kbComentar = function (d) { kbComentar(d.arg); };
ACOES.kbComentarioEditar = function (d) { kbComentarioEditar(d.arg); };
ACOES.kbComentarioRemover = function (d) { kbComentarioRemover(d.arg); };
ACOES.kbLigar = function (d) { kbLigar(d.arg); };
ACOES.kbLigacaoRemover = function (d) { kbLigacaoRemover(d.arg); };
ACOES.kbAnexar = function (d, alvo) { kbAnexar(d.arg, alvo); };
ACOES.kbAnexoRemover = function (d) { kbAnexoRemover(d.arg); };
ACOES.kbAbrirPedido = function (d) { kbAbrirPedido(d.arg); };

/* Os ouvintes do kanban, ao lado dos três do guião: o pousar do arrasto, a
   pesquisa enquanto se escreve, o Esc que fecha o cartão e o redimensionar
   que volta a medir o quadro. Cada um sai logo quando o kanban não está no ecrã. */
document.addEventListener('pointerdown', kbPousar);
document.addEventListener('input', function (e) {
  var t = e.target;
  if (!t || t.id !== 'kbQ') return;
  clearTimeout(kbQTempo);
  kbQTempo = setTimeout(function () { kbPesquisar(t.value); }, 300);
});
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

/* Os estilos do kanban, servidos em /equipa/kanban.css (público, como o
   estilos.css: são só regras). Vivem por cima do CSS_EQUIPA e usam os
   tokens dele (--card, --line, --accent, --rapido, --curva…) sem redeclarar
   o :root; todas as classes começam por kb-. A barra de baixo do back office
   ocupa --eq-barra em baixo, abaixo dos 900px: nada daqui fica por baixo
   dela. Os estados (o cartão aberto, a coluna de destino, a coluna escolhida
   no segmentado, o cartão no ar) dizem-se também na cor da frente — contorno
   e letra —, porque o Samsung escurece os fundos à força. Os :hover vivem
   atrás de (hover:hover) and (pointer:fine). */
export const CSS_KANBAN = `/* ---- a barra dos filtros ---- */
.kb-filtros{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center}
.kb-procura{flex:1 1 260px;max-width:420px}
.kb-filtros-botao{display:none}
.kb-chips{flex:1 1 420px}
.kb-chips .chip b{font-weight:650}
.kb-chips .chip .i{margin-right:-4px}
.kb-resumo{flex:1 0 100%}

/* ---- o segmentado das colunas (só no telemóvel) ---- */
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

/* ---- o arrasto: o cartão no ar, o lugar tracejado e o assentar ---- */
.kb-a-arrastar,.kb-a-arrastar .kb-cartao{cursor:grabbing}
.kb-cartao.kb-no-ar{position:fixed;z-index:70;margin:0;pointer-events:none;border-color:var(--accent);
  box-shadow:0 0 0 1px var(--accent),var(--shadow);will-change:transform}
.kb-lugar{flex:none;border:2px dashed var(--accent);border-radius:12px;background:var(--accent-soft)}
.kb-cartao.kb-assenta{transition:transform var(--medio) var(--curva-entra)}

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

/* ---- a janela (formulários, escolhas, colunas) ---- */
.kb-janela{max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain}
.kb-janela .lbl{margin-top:4px}
.kb-grupo{border:0;margin:0;padding:0;min-width:0}
.kb-grupo legend{padding:0;margin-bottom:6px}
.kb-grupo .chip .i{width:16px;height:16px}
.kb-opcoes{display:flex;flex-direction:column;gap:6px}
.kb-opcao[aria-pressed="true"]{border-color:var(--accent);color:var(--accent-text);background:var(--accent-soft)}
.kb-opcao .i{color:var(--accent)}
.kb-colms{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px}
.kb-colm{display:flex;flex-direction:column;gap:8px;padding:10px 12px}
.kb-colm+.kb-colm{border-top:1px solid var(--line)}
.kb-colm-txt{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
.kb-colm-nome{font-weight:650}
.kb-colm-acoes{display:flex;flex-wrap:wrap;gap:6px}
.kb-i-cima{transform:rotate(90deg)}
.kb-i-baixo{transform:rotate(-90deg)}
.kb-marcar{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;cursor:pointer}
.kb-marcar input{width:20px;height:20px;accent-color:var(--accent)}

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
  .kb-a-arrastar .kb-cartao:hover{border-color:var(--line)}
  .kb-pega{display:none}
}

/* ---- entre 900 e 1199: o cartão aberto por cima do quadro, à direita ---- */
@media(max-width:1199px){
  .kb-painel-sitio{position:fixed;top:0;right:0;bottom:var(--eq-barra, 0px);z-index:40;width:min(460px,100vw);flex:none}
  .kb-painel{height:100%;max-height:none;border-radius:0;border-width:0 0 0 1px;box-shadow:var(--shadow)}
}

/* ---- o telemóvel: uma coluna de cada vez, o segmentado e a folha inteira ---- */
@media(max-width:899px){
  .kb-procura{flex:1 1 160px;max-width:none}
  .kb-cab .cab .sub{display:none}
  .kb-cab .cab-acoes .btn.primary{display:none}
  .kb-filtros-botao{display:inline-flex}
  .kb-chips{flex:1 0 100%}
  .kb-chips.kb-fechado{display:none}
  .kb-resumo{display:none}
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
  .kb-cartao.kb-assenta{transition:none}
}
`;
