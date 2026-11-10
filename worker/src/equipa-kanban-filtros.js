/* O kanban da equipa: os filtros, a ordenação, o cabeçalho da secção e o
   formulário de criar e editar um cartão (equipa-kanban.js junta-o ao resto).
   ---------------------------------------------------------------------
   Um pedaço do mesmo guião: as mesmas regras do topo do equipa-kanban.js
   (String.raw sem crases nem cifrão com chaveta; nada de on…= nem style= no
   HTML; nomes de topo kb…, só function e var). Corre como parte de um único
   script clássico, por isso as funções daqui e as dos outros pedaços veem-se
   umas às outras. */

export const GUIAO_KB_FILTROS = String.raw`/* ------------------------------- filtros -------------------------------- */

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
/* Os cartões de uma coluna que se veem: os que os filtros deixam, pela ordem
   escolhida para a coluna (a do quadro, sem nenhuma). O quadro pinta por ele.
   Recebe: id — o id da coluna.
   Devolve: a lista. */
function kbVisiveis(id) {
  var euId = kbEu().id;
  return kbOrdenarLista(kbDaColuna(id).filter(function (c) { return kbPassa(c, kbFiltros, kbQ, euId); }), kbOrdemDe(id));
}
// Quantos filtros acendem o funil: os ligados sem a pesquisa, que está à vista ao lado dele.
// Recebe: f — os filtros.
// Devolve: o número.
function kbNFunil(f) { return kbQuantosFiltros(f) - (f.q ? 1 : 0); }
// Quantos cartões do quadro os filtros deixam ver, em todas as colunas.
// Devolve: o número.
function kbContarVisiveis() {
  var n = 0;
  if (kbEstado) kbEstado.colunas.forEach(function (c) { n += kbVisiveis(c.id).length; });
  return n;
}

/* ------------------------------ a ordenação ------------------------------ */

/* As ordens de uma coluna, além da do quadro (a de arrastar, a de omissão):
   chave → [o nome, o que quer dizer a ascendente, o que quer dizer a
   descendente]. Num prazo, os cartões sem prazo ficam sempre no fim. */
var KB_ORDENS = {
  prioridade: ['Prioridade', 'A mais alta primeiro', 'A mais baixa primeiro'],
  titulo: ['Título', 'De A a Z', 'De Z a A'],
  criacao: ['Criação', 'Os mais antigos primeiro', 'Os mais recentes primeiro'],
  alteracao: ['Última alteração', 'Os mais antigos primeiro', 'Os mais recentes primeiro'],
  prazo: ['Prazo', 'O mais próximo primeiro', 'O mais distante primeiro'],
};
// a ordem de cada coluna neste aparelho: {id da coluna: 'chave:asc' ou 'chave:desc'}; sem ela, a do quadro
var kbOrdens = kbLerOrdens();

// Uma ordem guardada é das que existem? ('prioridade:asc', 'prazo:desc'…)
// Recebe: v — o texto guardado.
// Devolve: true quando é.
function kbOrdemValida(v) {
  var m = /^(\w+):(asc|desc)$/.exec(String(v || ''));
  return !!(m && Object.prototype.hasOwnProperty.call(KB_ORDENS, m[1]));
}
/* As ordens guardadas no aparelho (localStorage kb_ordem); um browser que não
   deixa ler, ou um valor estragado, dá a ordem do quadro em todas.
   Devolve: {id da coluna: 'chave:dir'}. */
function kbLerOrdens() {
  var o = {};
  try {
    var g = JSON.parse(localStorage.getItem('kb_ordem') || '{}');
    if (g && typeof g === 'object') Object.keys(g).forEach(function (k) { if (kbOrdemValida(g[k])) o[k] = g[k]; });
  } catch (e) { /* sem armazenamento: a ordem do quadro */ }
  return o;
}
// Guarda as ordens no aparelho (calado quando não deixa: ficam só em memória).
// Devolve: nada.
function kbGuardarOrdens() {
  try { localStorage.setItem('kb_ordem', JSON.stringify(kbOrdens)); } catch (e) { /* fica só em memória */ }
}
// A ordem escolhida para uma coluna.
// Recebe: id — o id da coluna.
// Devolve: {chave, dir} ou null na ordem do quadro.
function kbOrdemDe(id) {
  var v = kbOrdens[id];
  if (!kbOrdemValida(v)) return null;
  var p = v.split(':');
  return { chave: p[0], dir: p[1] };
}
// Um instante do servidor (milissegundos, ou um texto de data) em número, para comparar.
// Recebe: v — o valor (número, texto ou nada).
// Devolve: o número (0 sem data).
function kbInstante(v) {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  var n = Number(v);
  if (!isNaN(n)) return n;
  var t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}
/* Ordena os cartões de uma coluna por uma ordem; os empates ficam pela ordem
   do quadro, e no prazo os sem prazo vão sempre para o fim.
   Recebe: lista — os cartões, pela ordem do quadro; ordem — {chave, dir} ou null.
   Devolve: uma lista nova (a mesma lista, sem ordem). */
function kbOrdenarLista(lista, ordem) {
  if (!ordem || !Object.prototype.hasOwnProperty.call(KB_ORDENS, ordem.chave)) return lista;
  var k = ordem.chave, s = ordem.dir === 'desc' ? -1 : 1;
  var valor = function (c) {
    if (k === 'prioridade') return KB_PRIORIDADES[c.prioridade] ? Number(c.prioridade) : 3;
    if (k === 'titulo') return String(c.titulo || '');
    if (k === 'criacao') return kbInstante(c.created_at);
    if (k === 'alteracao') return kbInstante(c.updated_at || c.created_at);
    return /^\d{4}-\d{2}-\d{2}/.test(String(c.prazo || '')) ? String(c.prazo).slice(0, 10) : null;
  };
  return lista.map(function (c, i) { return { c: c, i: i, v: valor(c) }; }).sort(function (a, b) {
    if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
    var d = k === 'titulo' ? a.v.localeCompare(b.v, 'pt', { sensitivity: 'base', numeric: true }) : a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
    return d * s || a.i - b.i;
  }).map(function (x) { return x.c; });
}
/* A coluna mostra-se na ordem do quadro (a que o arrasto muda)? Com outra
   ordem escolhida, o arrasto não reordena dentro dela (equipa-kanban-arrasto.js
   pergunta aqui); mudar de coluna continua.
   Recebe: id — o id da coluna.
   Devolve: true na ordem do quadro. */
function kbOrdemManual(id) { return !kbOrdemDe(id); }
/* O que o cabeçalho de uma coluna leva no fim (o quadro chama-o em
   kbColunaHtml): o botão de ordenar. Ordenada, diz por quê na cor da frente
   (letra e contorno), com o sentido no title e no nome para o leitor.
   Recebe: c — a coluna ({id, nome, fim}).
   Devolve: o HTML. */
function kbColunaCabAcoes(c) {
  if (!c) return '';
  var o = kbOrdemDe(c.id), nome = esc(c.nome);
  var diz = o ? 'Ordenada por ' + KB_ORDENS[o.chave][0].toLowerCase() + ', ' + KB_ORDENS[o.chave][o.dir === 'desc' ? 2 : 1].toLowerCase() : '';
  return '<button type="button" class="kb-ord' + (o ? ' kb-ord-on' : '') + '" aria-haspopup="dialog"' +
    (o ? ' title="' + esc(diz) + '" aria-label="' + esc(diz) + '. Mudar a ordem de ' + nome + '"' : ' title="Ordenar" aria-label="Ordenar ' + nome + '"') +
    comAcao('kbOrdenar', [c.id]) + '>' + ic('kbOrdenar', 'i-sm') +
    (o ? '<span class="kb-ord-txt" aria-hidden="true">' + esc(KB_ORDENS[o.chave][0]) + '</span>' : '') + '</button>';
}
// o sentido escolhido na janela de ordenar: fica ao trocar de critério e ao passar pela ordem do quadro
var kbOrdSentido = 'asc';

/* A escolha da ordem de uma coluna, numa janela do kanban: dois seletores
   (kbSelHtml), o «Critério» — a ordem do quadro ou uma das KB_ORDENS — e o
   «Sentido», com os dois rótulos do critério (escondido na ordem do quadro).
   Mudar qualquer um aplica logo e a janela fica aberta.
   Recebe: id — o id da coluna.
   Devolve: nada — abre a janela. */
function kbOrdenar(id) {
  var c = kbColuna(id);
  if (!c) return;
  var o = kbOrdemDe(id);
  if (o) kbOrdSentido = o.dir;
  var criterios = [['', 'A ordem do quadro (a de arrastar)']].concat(Object.keys(KB_ORDENS).map(function (k) { return [k, KB_ORDENS[k][0]]; }));
  var corpo = '<p class="sub">A ordem fica neste aparelho. Com outra que não a do quadro, arrastar continua a mudar o cartão de coluna, mas não o muda de lugar dentro desta.</p>' +
    '<div class="kb-ord-campos"><div class="kb-fp-campo"><span class="rot" id="kbOrdCrit-rot">Critério</span>' +
    kbSelHtml('kbOrdCrit', { opcoes: criterios, valor: o ? o.chave : '', rotuloId: 'kbOrdCrit-rot', filtro: true, aoMudar: function (v) {
      kbOrdenarEm(id, v ? v + ':' + kbOrdSentido : '');
      kbOrdSentidoPintar(id);
    } }) + '</div>' +
    '<div class="kb-fp-campo kb-ord-sentido" id="kbOrdSentidoCampo"' + (o ? '' : ' hidden') + '>' + kbOrdSentidoHtml(id) + '</div></div>';
  kbJanela('Ordenar «' + c.nome + '»', corpo, { foco: '#kbOrdCrit' });
}
/* O campo «Sentido» da janela de ordenar: o nome e o seletor com os dois
   rótulos do critério da coluna (os da primeira ordem, na do quadro, que o
   esconde). Mudar aplica logo, com o mesmo critério.
   Recebe: id — o id da coluna.
   Devolve: o HTML. */
function kbOrdSentidoHtml(id) {
  var o = kbOrdemDe(id), k = o ? o.chave : Object.keys(KB_ORDENS)[0];
  return '<span class="rot" id="kbOrdSentido-rot">Sentido</span>' +
    kbSelHtml('kbOrdSentido', { opcoes: [['asc', KB_ORDENS[k][1]], ['desc', KB_ORDENS[k][2]]], valor: kbOrdSentido, rotuloId: 'kbOrdSentido-rot', aoMudar: function (v) {
      kbOrdSentido = v === 'desc' ? 'desc' : 'asc';
      var agora = kbOrdemDe(id);
      if (agora) kbOrdenarEm(id, agora.chave + ':' + kbOrdSentido);
    } });
}
/* Volta a pintar o «Sentido» na janela aberta depois de mudar o critério:
   os rótulos do critério novo, ou escondido na ordem do quadro.
   Recebe: id — o id da coluna.
   Devolve: nada. */
function kbOrdSentidoPintar(id) {
  var campo = el('kbOrdSentidoCampo');
  if (!campo) return;
  campo.innerHTML = kbOrdSentidoHtml(id);
  campo.hidden = !kbOrdemDe(id);
}
/* Escolhe a ordem de uma coluna, guarda-a no aparelho e repinta o quadro por
   trás da janela, que fica aberta.
   Recebe: id — o id da coluna; valor — 'chave:dir', ou '' para a do quadro.
   Devolve: nada. */
function kbOrdenarEm(id, valor) {
  if (kbOrdemValida(valor)) kbOrdens[id] = valor; else delete kbOrdens[id];
  kbGuardarOrdens();
  kbPintarQuadro();
}

/* Pinta a secção inteira: o cabeçalho (com «Colunas» só para o master e o
   «Novo cartão»), a barra dos filtros com o painel, o segmentado das colunas
   (no telemóvel) e o quadro com o sítio do cartão aberto. O painel começa
   fechado, como o da app.
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
  kbColunaVista = 0; kbFiltrosAbertos = false; kbFpUltimo = ''; kbSelAberto = '';
  kbPintarQuadro(); kbPintarChips();
}
/* --------------------------- filtros (pintar) --------------------------- */

// o HTML do corpo do painel dos filtros que está no ecrã (só se repinta quando muda)
var kbFpUltimo = '';
// o temporizador da saída do painel
var kbFpTempo = 0;

/* A barra dos filtros, como a da app: a pesquisa sempre à vista e o funil
   que abre o painel por baixo, com o número dos filtros ligados; e, com
   filtros, a linha do que se vê com o «Limpar filtros».
   Devolve: o HTML. */
function kbFiltrosHtml() {
  return '<div class="kb-fbarra-sitio"><div class="kb-fbarra">' +
    '<label class="procura kb-procura">' + ic('procurar') + '<input id="kbQ" type="search" placeholder="Pesquisar…" autocomplete="off" enterkeyhint="search" ' +
    'aria-label="Pesquisar por chave, título ou descrição" value="' + esc(kbFiltros.q) + '"' + ligarA('enter', 'kbPesquisar') + '></label>' +
    '<button type="button" class="btn so-icone kb-funil" id="kbFunil" aria-expanded="false" aria-controls="kbFPainel" aria-label="Filtros"' + comAcao('kbFiltrosAlternar') + '>' +
    ic('kbFiltro') + '<span class="kb-funil-n" id="kbFunilN" aria-hidden="true"></span></button></div>' +
    '<div class="kb-fpainel" id="kbFPainel" role="region" aria-labelledby="kbFTit" hidden></div></div>' +
    '<div class="kb-resumo-linha" id="kbResumoLinha" hidden><p class="sub n kb-resumo" id="kbResumo" role="status"></p>' +
    '<button type="button" class="btn sm ghost kb-limpar"' + comAcao('kbLimparFiltros') + '>' + ic('fechar', 'i-sm') + 'Limpar filtros</button></div>';
}
/* O corpo do painel dos filtros (o da app): «Filtros» com o Limpar (com
   alguma coisa para limpar, a pesquisa incluída) e o Fechar, quantos cartões
   passam, e os campos numa grelha de duas colunas, cada um com o nome por
   cima e um seletor que aplica logo. «Os meus» e «Responsável» mexem no
   mesmo filtro.
   Devolve: o HTML. */
function kbFPainelHtml() {
  var f = kbFiltros, total = kbEstado.cartoes.length, algum = kbQuantosFiltros(f) > 0;
  var etiquetas = kbEstado.etiquetas.map(function (t) { return [t, t]; });
  if (f.etiqueta && kbEstado.etiquetas.indexOf(f.etiqueta) < 0) etiquetas.push([f.etiqueta, f.etiqueta]);
  var epicos = kbEstado.cartoes.filter(function (c) { return c.tipo === 'epico'; }).map(function (c) { return [c.chave, c.chave + ' · ' + c.titulo]; });
  if (f.pai && !epicos.some(function (e) { return e[0] === f.pai; })) epicos.push([f.pai, f.pai]);
  var pessoas = kbEstado.pessoas.map(function (p) { return [p.id, p.nome]; });
  if (f.responsavel && f.responsavel !== 'eu' && !pessoas.some(function (p) { return p[0] === f.responsavel; })) pessoas.push([f.responsavel, kbNomePessoa(f.responsavel)]);
  var campo = function (chave, filtro, rotulo, opcoes, valor, nada) {
    var id = 'kbFS-' + chave;
    return '<div class="kb-fp-campo"><span class="rot" id="' + id + '-rot">' + rotulo + '</span>' +
      kbSelHtml(id, { opcoes: opcoes, valor: valor, rotuloId: id + '-rot', filtro: true, nada: nada, aoMudar: function (v) {
        // «Todos» no «Os meus» só tira o filtro quando era o dele: uma pessoa escolhida no Responsável fica
        if (chave !== 'meus' || v || kbFiltros.responsavel === 'eu') kbFiltrar(filtro, v);
      } }) + '</div>';
  };
  return '<div class="kb-fp-cab"><h2 class="kb-fp-tit" id="kbFTit">Filtros</h2>' +
    (algum ? '<button type="button" class="btn sm ghost kb-fp-limpar"' + comAcao('kbLimparFiltros') + '>Limpar</button>' : '') +
    '<button type="button" class="btn sm"' + comAcao('kbFiltrosFechar') + '>Fechar</button></div>' +
    '<p class="sub n kb-fp-n">Aplicam-se ao mexer · ' + (algum ? kbContarVisiveis() + ' de ' : '') + kbConta(total, 'cartão', 'cartões') + '</p>' +
    '<div class="kb-fp-grelha">' +
    campo('meus', 'responsavel', 'Os meus', [['', 'Todos'], ['eu', 'Só os meus']], f.responsavel === 'eu' ? 'eu' : '') +
    campo('tipo', 'tipo', 'Tipo', [['', 'Todos']].concat(KB_TIPOS.map(function (t) { return [t, KB_NOMES_TIPOS[t]]; })), f.tipo) +
    campo('etiqueta', 'etiqueta', 'Etiqueta', [['', 'Todas']].concat(etiquetas), f.etiqueta, 'Ainda não há etiquetas nos cartões.') +
    campo('responsavel', 'responsavel', 'Responsável', [['', 'Todos'], ['eu', 'Eu (os meus)']].concat(pessoas), f.responsavel, 'Ainda não há ninguém para escolher.') +
    campo('prioridade', 'prioridade', 'Prioridade', [['', 'Todas']].concat([1, 2, 3, 4, 5].map(function (p) { return [String(p), KB_PRIORIDADES[p]]; })), f.prioridade) +
    campo('pai', 'pai', 'Épico', [['', 'Todos']].concat(epicos), f.pai, 'Ainda não há épicos no quadro.') + '</div>';
}
/* Pinta o funil (o número, o aceso, o aria-expanded), o corpo do painel
   quando está aberto (só se mudou, para não fechar uma lista aberta nem
   perder o foco) e a linha do que se vê — sem tocar no campo da pesquisa,
   que pode estar a ser escrito. O nome vem de quando eram chips: o quadro
   chama-o depois de cada leitura.
   Devolve: nada. */
function kbPintarChips() {
  var f = kbFiltros, n = kbNFunil(f), todos = kbQuantosFiltros(f), funil = el('kbFunil');
  if (!funil || !kbEstado) return;
  funil.className = 'btn so-icone kb-funil' + (n ? ' kb-funil-on' : '');
  funil.setAttribute('aria-expanded', kbFiltrosAbertos ? 'true' : 'false');
  funil.setAttribute('aria-label', n ? 'Filtros: ' + n + (n === 1 ? ' ligado' : ' ligados') : 'Filtros');
  var conta = el('kbFunilN');
  if (conta) conta.textContent = n ? String(n) : '';
  var p = el('kbFPainel');
  if (p && kbFiltrosAbertos) {
    var html = kbFPainelHtml();
    if (html !== kbFpUltimo) {
      var a = document.activeElement, foco = a && a.id && p.contains(a) ? a.id : '';
      if (kbSelAberto && el(kbSelAberto + '-sel') && p.contains(el(kbSelAberto + '-sel'))) kbSelAberto = '';
      p.innerHTML = html; kbFpUltimo = html;
      if (foco && el(foco) && el(foco).focus) el(foco).focus({ preventScroll: true });
    }
  }
  var linha = el('kbResumoLinha'), resumo = el('kbResumo');
  if (linha && resumo) {
    var vis = kbContarVisiveis(), total = kbEstado.cartoes.length;
    linha.hidden = !todos;
    resumo.textContent = !todos ? '' : vis ? vis + ' de ' + kbConta(total, 'cartão', 'cartões') + ' com estes filtros.' : 'Nada com estes filtros.';
  }
  kbMedirTopo();
}
/* Abre o painel dos filtros por baixo da barra, a entrar como os menus
   (equipa-kanban-filtros.js:CSS_KB_FILTROS, .kb-entra); o foco fica no funil.
   Devolve: nada. */
function kbFiltrosAbrir() {
  var p = el('kbFPainel');
  if (!p) return;
  kbFiltrosAbertos = true; clearTimeout(kbFpTempo);
  p.hidden = false;
  p.classList.remove('kb-sai', 'kb-entra');
  void p.offsetWidth;
  p.classList.add('kb-entra');
  kbFpUltimo = '';
  kbPintarChips();
}
/* Fecha o painel dos filtros: sai mais depressa do que entrou e só então se
   esconde (reabrir a meio da saída retoma-o).
   Recebe: devolver — true para o foco voltar ao funil (o Fechar, o Esc).
   Devolve: nada. */
function kbFiltrosFechar(devolver) {
  var p = el('kbFPainel'), funil = el('kbFunil');
  if (kbSelAberto && p && el(kbSelAberto + '-sel') && p.contains(el(kbSelAberto + '-sel'))) kbSelFechar(false);
  kbFiltrosAbertos = false;
  kbPintarChips();
  if (devolver && funil && funil.focus) funil.focus();
  if (!p || p.hidden) return;
  p.classList.remove('kb-entra');
  p.classList.add('kb-sai');
  clearTimeout(kbFpTempo);
  kbFpTempo = setTimeout(function () { p.classList.remove('kb-sai'); if (!kbFiltrosAbertos) p.hidden = true; }, 160);
}
/* Muda um filtro e repinta (o quadro já tem tudo: não vai ao servidor).
   Recebe: campo — tipo, etiqueta, responsavel, prioridade ou pai; valor — '' tira o filtro.
   Devolve: nada. */
function kbFiltrar(campo, valor) {
  if (!Object.prototype.hasOwnProperty.call(KB_FILTROS, campo)) return;
  kbFiltros[campo] = String(valor || '');
  kbGuardarFiltros();
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
  var r = el('kbResumo'), linha = el('kbResumoLinha');
  if (r) r.textContent = 'À procura…';
  if (linha) linha.hidden = false;
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

/* ------------------------------- o seletor ------------------------------- */

/* O seletor do kanban, o «dropdown» da app (componentes.js:sel), feito aqui
   sem o <select>: um botão que abre por baixo uma lista de botões (por cima,
   quando não cabe), com o escolhido na cor da frente e o visto. Serve os
   filtros (uma escolha, aplica logo) e as etiquetas do formulário (várias
   escolhas, à vista em selos com o ×, e a «Nova etiqueta» no fim). Um só
   aberto de cada vez; fora dele, fecha; Enter e Espaço abrem, as setas
   andam, Esc fecha e devolve o foco ao botão. A lista leva data-gesto: a
   folha da janela não arranca dela. */

// os seletores no ecrã: id → {opcoes: [[valor, rótulo]…], valor (texto; uma lista nos de várias), multi, vazio, um, varios, nada, nova, rotuloId, descrito, filtro, aoMudar}
var kbSels = {};
// o id do seletor com a lista aberta ('' sem nenhum)
var kbSelAberto = '';

/* O HTML de um seletor, e regista-o (as ações acham-no pelo id).
   Recebe: id — o id do botão (as peças ficam em id-sel, id-lista, id-ops,
   id-txt e id-selos); o — {opcoes, valor, multi, vazio: o texto sem escolha,
   um/varios: a palavra da contagem, nada: a frase de uma lista vazia, nova:
   o rótulo de «Nova …», rotuloId: o id do nome por cima, descrito: o id do
   erro, filtro: true para se acender com uma escolha, aoMudar(valor, id)}.
   Devolve: o HTML. */
function kbSelHtml(id, o) {
  o.valor = o.multi ? (o.valor || []).slice() : String(o.valor == null ? '' : o.valor);
  o.novaAberta = false;
  kbSels[id] = o;
  return '<div class="kb-sel' + kbSelClasse(o) + '" id="' + id + '-sel">' +
    '<button type="button" class="kb-sel-botao" id="' + id + '" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + '-ops"' +
    (o.rotuloId ? ' aria-labelledby="' + o.rotuloId + ' ' + id + '-txt"' : '') + (o.descrito ? ' aria-describedby="' + o.descrito + '"' : '') +
    comAcao('kbSelAbrir', [id]) + '><span class="kb-sel-txt" id="' + id + '-txt">' + esc(kbSelTexto(o)) + '</span>' + ic('baixo', 'i-sm') + '</button>' +
    '<div class="kb-sel-lista" id="' + id + '-lista" data-gesto hidden>' + kbSelListaHtml(id) + '</div></div>' +
    (o.multi ? '<div class="kb-selos" id="' + id + '-selos">' + kbSelosHtml(id) + '</div>' : '');
}
// A classe do seletor: aceso (letra e contorno na cor da frente) quando é um filtro com uma escolha.
// Recebe: o — o seletor.
// Devolve: ' kb-sel-on' ou ''.
function kbSelClasse(o) { return o.filtro && !o.multi && o.valor !== '' ? ' kb-sel-on' : ''; }
// Se um valor está escolhido.
// Recebe: o — o seletor; v — o valor.
// Devolve: true quando está.
function kbSelTem(o, v) { return o.multi ? o.valor.indexOf(String(v)) > -1 : String(o.valor) === String(v); }
// O que o botão diz: o rótulo do escolhido, ou nos de várias quantas estão («2 etiquetas»).
// Recebe: o — o seletor.
// Devolve: o texto.
function kbSelTexto(o) {
  if (o.multi) return o.valor.length ? kbConta(o.valor.length, o.um || 'escolhida', o.varios || 'escolhidas') : (o.vazio || 'Escolher');
  for (var i = 0; i < o.opcoes.length; i++) if (String(o.opcoes[i][0]) === String(o.valor)) return o.opcoes[i][1];
  return o.vazio || (o.opcoes[0] ? o.opcoes[0][1] : 'Escolher');
}
/* O valor depois de escolher uma opção: num de uma escolha, ela; num de
   várias, a lista com ela acrescentada, ou sem ela se já lá estava.
   Recebe: o — o seletor; v — o valor da opção.
   Devolve: o valor novo (texto, ou uma lista nova). */
function kbSelValorNovo(o, v) {
  v = String(v);
  if (!o.multi) return v;
  return o.valor.indexOf(v) > -1 ? o.valor.filter(function (x) { return x !== v; }) : o.valor.concat([v]);
}
// O valor de um seletor no ecrã ('' ou [] sem ele).
// Recebe: id — o id do seletor.
// Devolve: o texto, ou a lista nos de várias.
function kbSelValor(id) {
  var o = kbSels[id];
  return o ? (o.multi ? o.valor.slice() : o.valor) : '';
}
/* O que vai dentro da lista: a listbox com as opções (o visto na escolhida),
   a frase de uma lista vazia e, com nova, a linha e «Nova …» — ou, aberto,
   o campo do nome com o erro ao lado e Cancelar e Adicionar.
   Recebe: id — o id do seletor.
   Devolve: o HTML. */
function kbSelListaHtml(id) {
  var o = kbSels[id];
  var ops = o.opcoes.map(function (op, i) {
    return '<button type="button" role="option" class="kb-sel-op" id="' + id + '-op' + i + '" aria-selected="' + (kbSelTem(o, op[0]) ? 'true' : 'false') + '"' +
      comAcao('kbSelEscolher', [id, i]) + '><span class="kb-sel-op-txt">' + esc(op[1]) + '</span>' + ic('kbVisto', 'i-sm kb-sel-visto') + '</button>';
  }).join('');
  var nada = o.nada && o.opcoes.length < (o.multi ? 1 : 2) ? '<p class="kb-sel-nada">' + esc(o.nada) + '</p>' : '';
  var nova = !o.nova ? '' : '<div class="kb-sel-div" aria-hidden="true"></div>' + (o.novaAberta
    ? '<div class="kb-sel-novo"><label class="rot" for="' + id + '-novo">' + esc(o.nova) + '</label>' +
      '<input id="' + id + '-novo" class="campo" type="text" maxlength="60" autocomplete="off" autocapitalize="none" enterkeyhint="done" placeholder="Ex: pagamentos" aria-describedby="' + id + '-novoErro"' + ligarA('enter', 'kbSelNovaOk', [id]) + '>' +
      '<p class="erro-txt" id="' + id + '-novoErro"></p><div class="kb-sel-novo-bt">' +
      '<button type="button" class="btn sm ghost"' + comAcao('kbSelNovaCancelar', [id]) + '>Cancelar</button>' +
      '<button type="button" class="btn sm primary"' + comAcao('kbSelNovaOk', [id]) + '>Adicionar</button></div></div>'
    : '<button type="button" class="kb-sel-op kb-sel-nova" id="' + id + '-nova"' + comAcao('kbSelNova', [id]) + '>' + ic('mais', 'i-sm') + '<span class="kb-sel-op-txt">' + esc(o.nova) + '</span></button>');
  return '<div role="listbox" id="' + id + '-ops"' + (o.multi ? ' aria-multiselectable="true"' : '') + (o.rotuloId ? ' aria-labelledby="' + o.rotuloId + '"' : '') + '>' + ops + '</div>' + nada + nova;
}
// Os escolhidos de um seletor de várias, em selos com o × que os remove.
// Recebe: id — o id do seletor.
// Devolve: o HTML ('' sem nenhum).
function kbSelosHtml(id) {
  var o = kbSels[id];
  return o.valor.map(function (v) {
    return '<span class="kb-selo"><span class="kb-selo-txt">' + esc(v) + '</span><button type="button" class="kb-selo-x" aria-label="Remover «' + esc(v) + '»"' +
      comAcao('kbSelTirar', [id, v]) + '>' + ic('fechar', 'i-sm') + '</button></span>';
  }).join('');
}
// Volta a pintar um seletor no ecrã com o valor que tem (o botão, a lista e os selos), sem o fechar.
// Recebe: id — o id do seletor.
// Devolve: nada.
function kbSelRepintar(id) {
  var o = kbSels[id];
  if (!o) return;
  var t = el(id + '-txt'), c = el(id + '-sel'), l = el(id + '-lista'), s = el(id + '-selos');
  if (t) t.textContent = kbSelTexto(o);
  if (c) c.className = 'kb-sel' + kbSelClasse(o);
  if (l) { l.innerHTML = kbSelListaHtml(id); if (kbSelAberto === id) kbSelAjustar(id); }
  if (s) s.innerHTML = kbSelosHtml(id);
}
/* Abre a lista de um seletor (ou fecha-a, se já estava aberta), fechando a
   que estiver aberta. Aberta pelo teclado (o Enter e o Espaço chegam como
   um clique com detail 0), o foco entra na escolhida.
   Recebe: id — o id do seletor; evento (opcional) — o clique.
   Devolve: nada. */
function kbSelAbrir(id, evento) {
  var l = el(id + '-lista'), b = el(id);
  if (!l || !b) return;
  var era = kbSelAberto === id && !l.hidden;
  kbSelFechar(false);
  if (era) return;
  l.hidden = false;
  b.setAttribute('aria-expanded', 'true');
  kbSelAberto = id;
  kbSelAjustar(id);
  if (evento && evento.detail === 0) kbSelFocar(id, 'escolhida');
}
/* Fecha a lista aberta (o campo da «Nova …» a meio volta a ser a linha).
   Recebe: devolver — true para o foco voltar ao botão (o Esc, uma escolha pelo teclado).
   Devolve: nada. */
function kbSelFechar(devolver) {
  var id = kbSelAberto;
  kbSelAberto = '';
  if (!id) return;
  var o = kbSels[id], l = el(id + '-lista'), b = el(id);
  if (o && o.novaAberta) { o.novaAberta = false; if (l) l.innerHTML = kbSelListaHtml(id); }
  if (l) { l.hidden = true; l.classList.remove('kb-sel-cima'); l.style.maxHeight = ''; }
  if (b) { b.setAttribute('aria-expanded', 'false'); if (devolver && b.focus) b.focus(); }
}
/* Para que lado abre a lista e a que altura encolhe para caber: por baixo,
   a menos que não caiba e por cima haja mais espaço; nunca abaixo de 96px.
   Recebe: botao — o retângulo do botão ({top, bottom}); limite — {top,
   bottom} do espaço que se vê; quer — a altura da lista.
   Devolve: {cima: true para abrir por cima, max: a altura máxima (0 quando cabe)}. */
function kbSelLado(botao, limite, quer) {
  var abaixo = limite.bottom - botao.bottom - 8, acima = botao.top - limite.top - 8;
  var cima = quer > abaixo && acima > abaixo, espaco = cima ? acima : abaixo;
  return { cima: cima, max: quer > espaco ? Math.max(96, Math.floor(espaco)) : 0 };
}
/* Mede o espaço que a lista tem (o ecrã, cada antepassado que corta — o
   corpo da janela que rola — e, fora da janela, a barra de baixo) e põe-na
   do lado em que cabe, encolhida se for preciso: nunca sai cortada.
   Recebe: id — o id do seletor.
   Devolve: nada. */
function kbSelAjustar(id) {
  var l = el(id + '-lista'), b = el(id);
  if (!l || !b || !l.getBoundingClientRect) return;
  l.classList.remove('kb-sel-cima'); l.style.maxHeight = '';
  var lim = { top: 0, bottom: window.innerHeight };
  for (var a = l.parentElement; a && a !== document.body; a = a.parentElement) {
    var cs = getComputedStyle(a);
    if (/hidden|auto|scroll|clip/.test(cs.overflowX + ' ' + cs.overflowY)) {
      var r = a.getBoundingClientRect();
      lim.top = Math.max(lim.top, r.top); lim.bottom = Math.min(lim.bottom, r.bottom);
    }
  }
  var barra = l.closest('dialog') ? null : document.querySelector('.eq-barra');
  if (barra && getComputedStyle(barra).display !== 'none') lim.bottom = Math.min(lim.bottom, barra.getBoundingClientRect().top);
  var d = kbSelLado(b.getBoundingClientRect(), lim, l.offsetHeight);
  if (d.cima) l.classList.add('kb-sel-cima');
  if (d.max) l.style.maxHeight = d.max + 'px';
}
// As opções de uma lista onde o foco anda (as escolhas e a «Nova …»).
// Recebe: id — o id do seletor.
// Devolve: a lista dos botões.
function kbSelBotoes(id) {
  var l = el(id + '-lista');
  return l ? [].slice.call(l.querySelectorAll('.kb-sel-op')) : [];
}
/* Leva o foco a uma opção de uma lista aberta, à vista dentro dela (sem
   rolar a página nem o corpo da janela).
   Recebe: id — o id do seletor; qual — 'escolhida', 'primeira', 'ultima' ou o próprio botão.
   Devolve: nada. */
function kbSelFocar(id, qual) {
  var bs = kbSelBotoes(id), l = el(id + '-lista');
  if (!bs.length || !l) return;
  var alvo = typeof qual === 'object' ? qual : qual === 'ultima' ? bs[bs.length - 1] : qual === 'primeira' ? bs[0]
    : bs.filter(function (x) { return x.getAttribute('aria-selected') === 'true'; })[0] || bs[0];
  try { alvo.focus({ preventScroll: true }); } catch (e) { /* um browser antigo foca e rola */ }
  var t = alvo.offsetTop, f = t + alvo.offsetHeight;
  if (t < l.scrollTop) l.scrollTop = t;
  else if (f > l.scrollTop + l.clientHeight) l.scrollTop = f - l.clientHeight;
}
/* A opção seguinte para uma tecla: as setas andam uma e param nas pontas, o
   Home e o End vão às pontas; sem opção (-1), a seta para baixo começa na
   primeira e a para cima na última.
   Recebe: i — o índice atual (-1 sem nenhum); n — quantas há; tecla — o e.key.
   Devolve: o índice novo (-1 sem opções). */
function kbSelIndice(i, n, tecla) {
  if (n < 1) return -1;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return n - 1;
  if (tecla === 'ArrowDown') return i < 0 ? 0 : Math.min(i + 1, n - 1);
  if (tecla === 'ArrowUp') return i < 0 ? n - 1 : Math.max(i - 1, 0);
  return i;
}
/* Escolhe uma opção: num de uma escolha fecha a lista e aplica; num de
   várias marca ou desmarca e a lista fica aberta, com o foco onde estava.
   Recebe: id — o id do seletor; i — o índice da opção; evento (opcional) — o clique.
   Devolve: nada. */
function kbSelEscolher(id, i, evento) {
  var o = kbSels[id], op = o && o.opcoes[Number(i)];
  if (!op) return;
  var teclado = !!(evento && evento.detail === 0);
  o.valor = kbSelValorNovo(o, op[0]);
  if (o.multi) {
    kbSelRepintar(id);
    var b = el(id + '-op' + i);
    if (b) kbSelFocar(id, b);
  } else { kbSelFechar(false); kbSelRepintar(id); }
  if (o.aoMudar) o.aoMudar(o.multi ? o.valor.slice() : o.valor, id);
  if (!o.multi && teclado && el(id) && el(id).focus) el(id).focus();
}
/* Remove um escolhido de um seletor de várias (o × do selo).
   Recebe: id — o id do seletor; v — o valor.
   Devolve: nada. */
function kbSelTirar(id, v) {
  var o = kbSels[id];
  if (!o || !o.multi) return;
  o.valor = o.valor.filter(function (x) { return x !== String(v); });
  kbSelRepintar(id);
  if (o.aoMudar) o.aoMudar(o.valor.slice(), id);
  if (el(id) && el(id).focus) el(id).focus();
}
/* A «Nova …» do fim da lista abre ali o campo do nome (nunca o prompt).
   Recebe: id — o id do seletor.
   Devolve: nada. */
function kbSelNova(id) {
  var o = kbSels[id];
  if (!o || !o.nova) return;
  o.novaAberta = true;
  kbSelRepintar(id);
  var i = el(id + '-novo'), l = el(id + '-lista');
  if (i && i.focus) { try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } }
  // o campo e os botões ficam no fim da lista: à vista inteiros, sem rolar o corpo da janela
  if (l) l.scrollTop = l.scrollHeight;
}
/* Cancela o nome de uma «Nova …»: volta a linha, com o foco nela.
   Recebe: id — o id do seletor.
   Devolve: nada. */
function kbSelNovaCancelar(id) {
  var o = kbSels[id];
  if (!o) return;
  o.novaAberta = false;
  kbSelRepintar(id);
  var b = el(id + '-nova');
  if (b && b.focus) b.focus();
}
/* Uma etiqueta nova como o servidor a quer: minúsculas, os espaços de dentro
   a hífen, até 40 caracteres (as regras de kbEtiquetasDe).
   Recebe: texto — o que se escreveu.
   Devolve: {nome, erro} — erro '' quando está boa. */
function kbEtiquetaNova(texto) {
  var t = String(texto || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!t) return { nome: '', erro: 'Escreve o nome da etiqueta.' };
  if (t.length > 40) return { nome: t, erro: 'Até 40 caracteres (esta tem ' + t.length + ').' };
  return { nome: t, erro: '' };
}
/* Adiciona o nome escrito na «Nova …»: entra na lista, fica escolhido e a
   lista fecha; um nome que não serve deixa o erro ao lado do campo.
   Recebe: id — o id do seletor.
   Devolve: nada. */
function kbSelNovaOk(id) {
  var o = kbSels[id], i = el(id + '-novo');
  if (!o || !i) return;
  var r = kbEtiquetaNova(i.value);
  if (r.erro) { marcarErro(id + '-novo', r.erro); if (i.focus) i.focus(); return; }
  if (!o.opcoes.some(function (op) { return op[0] === r.nome; })) o.opcoes.push([r.nome, r.nome]);
  if (o.multi) { if (o.valor.indexOf(r.nome) < 0) o.valor = o.valor.concat([r.nome]); } else o.valor = r.nome;
  o.novaAberta = false;
  kbSelFechar(true);
  kbSelRepintar(id);
  if (o.aoMudar) o.aoMudar(o.multi ? o.valor.slice() : o.valor, id);
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
/* As etiquetas de um cartão como o servidor as quer: em minúsculas, os
   espaços de dentro a hífen, sem repetidas, até 40 caracteres cada e 20 por
   cartão (worker/src/rotas/kanban.js:etiquetasValidas).
   Recebe: texto — a lista escolhida no seletor, ou um texto separado por vírgulas.
   Devolve: {lista, erro} — erro '' quando estão boas. */
function kbEtiquetasDe(texto) {
  var lista = [];
  (Array.isArray(texto) ? texto : String(texto || '').split(',')).forEach(function (t) {
    t = String(t == null ? '' : t).trim().toLowerCase().replace(/\s+/g, '-');
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
/* O campo das etiquetas do formulário: o seletor de várias com as etiquetas
   que já há no quadro (e as do cartão), as escolhidas em selos com o ×, e no
   fim da lista a «Nova etiqueta», como a «Nova categoria» dos movimentos da
   app; o erro vai ao lado (kbF-etiquetasErro).
   Recebe: escolhidas — as etiquetas com que abre (lista).
   Devolve: o HTML. */
function kbEtiquetasCampoHtml(escolhidas) {
  var todas = kbEstado.etiquetas.slice();
  (escolhidas || []).forEach(function (t) { if (todas.indexOf(t) < 0) todas.push(t); });
  return '<div class="campo-bloco kb-etq-campo"><span class="rot" id="kbF-etiquetasRot">Etiquetas</span>' +
    kbSelHtml('kbF-etiquetas', {
      multi: true, opcoes: todas.map(function (t) { return [t, t]; }), valor: escolhidas || [], vazio: 'Escolher etiquetas', um: 'etiqueta', varios: 'etiquetas',
      nada: 'Ainda não há etiquetas: adiciona a primeira.', nova: 'Nova etiqueta', rotuloId: 'kbF-etiquetasRot', descrito: 'kbF-etiquetasErro',
      aoMudar: function () { marcarErro('kbF-etiquetas', ''); },
    }) + '<p class="erro-txt" id="kbF-etiquetasErro"></p></div>';
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
    tipo: c.tipo, titulo: c.titulo, descricao: c.descricao || '', prioridade: String(c.prioridade || 3), etiquetas: (c.etiquetas || []).slice(),
    responsavel: c.responsavel ? c.responsavel.id : '', pai: c.pai ? c.pai.chave : '', prazo: c.prazo || '', coluna: c.coluna_id,
  } : {
    tipo: KB_NOMES_TIPOS[p.tipo] ? p.tipo : 'tarefa', titulo: '', descricao: '', prioridade: '3', etiquetas: [], responsavel: '',
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
    kbEtiquetasCampoHtml(v.etiquetas) +
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
  var et = kbEtiquetasDe(kbSelValor('kbF-etiquetas')), paiTxt = valorDe('kbF-pai'), pai = paiTxt ? kbChave(paiTxt) : '', prazo = valorDe('kbF-prazo');
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

/* ----------------- as ações dos filtros e do formulário ----------------- */

ACOES.kbNovo = function (d) { kbNovo(d.arg); };
ACOES.kbLimparFiltros = function () { kbLimparFiltros(); };
ACOES.kbPesquisar = function (d, alvo) { kbPesquisar(alvo && alvo.value); };
ACOES.kbFiltrosAlternar = function () { if (kbFiltrosAbertos) kbFiltrosFechar(false); else kbFiltrosAbrir(); };
ACOES.kbFiltrosFechar = function () { kbFiltrosFechar(true); };
ACOES.kbSelAbrir = function (d, alvo, e) { kbSelAbrir(d.arg, e); };
ACOES.kbSelEscolher = function (d, alvo, e) { kbSelEscolher(d.arg, d.arg2, e); };
ACOES.kbSelTirar = function (d) { kbSelTirar(d.arg, d.arg2); };
ACOES.kbSelNova = function (d) { kbSelNova(d.arg); };
ACOES.kbSelNovaOk = function (d) { kbSelNovaOk(d.arg); };
ACOES.kbSelNovaCancelar = function (d) { kbSelNovaCancelar(d.arg); };
ACOES.kbOrdenar = function (d) { if (!kbDepoisDeArrastar()) kbOrdenar(d.arg); };

ICONES.kbOrdenar = '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>';

/* O teclado do seletor e do painel, antes de todos os outros (na captura):
   o Esc fecha a lista aberta (sem fechar a janela nem o cartão por baixo) e
   devolve o foco ao botão, ou fecha o painel dos filtros e volta ao funil;
   no botão, as setas abrem e levam à escolhida (o Home e o End às pontas);
   numa opção, andam pelas outras; o Tab sai da lista e fecha-a. */
document.addEventListener('keydown', function (e) {
  var t = e.target, k = e.key;
  if (k === 'Escape') {
    var dentro = t && t.closest ? t.closest('#kbFiltros') : null;
    if (kbSelAberto) { e.preventDefault(); e.stopPropagation(); kbSelFechar(true); }
    else if (kbFiltrosAbertos && dentro) { e.preventDefault(); e.stopPropagation(); kbFiltrosFechar(true); }
    return;
  }
  var caixa = t && t.closest ? t.closest('.kb-sel') : null;
  if (!caixa) return;
  var id = caixa.id.replace(/-sel$/, '');
  if (k === 'Tab') { if (kbSelAberto === id) kbSelFechar(t.id !== id); return; }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(k) < 0 || t.tagName === 'INPUT') return;
  e.preventDefault();
  if (t.id === id) {
    if (kbSelAberto !== id) kbSelAbrir(id, null);
    kbSelFocar(id, k === 'Home' ? 'primeira' : k === 'End' ? 'ultima' : 'escolhida');
    return;
  }
  var bs = kbSelBotoes(id), j = kbSelIndice(bs.indexOf(t), bs.length, k);
  if (bs[j]) kbSelFocar(id, bs[j]);
}, true);
/* Um toque ou clique fora da lista aberta fecha-a; fora do painel dos
   filtros (e do funil, e de uma janela), fecha o painel. Na captura, antes
   da ação do que se tocou, que segue o seu caminho. */
document.addEventListener('click', function (e) {
  var t = e.target, perto = t && t.closest ? t : null;
  if (kbSelAberto) {
    var c = el(kbSelAberto + '-sel');
    if (!c || !perto || !c.contains(perto)) kbSelFechar(false);
  }
  if (kbFiltrosAbertos && el('kbFPainel') && (!perto || !perto.closest('#kbFPainel,#kbFunil,#dialogo'))) kbFiltrosFechar(false);
}, true);

// a pesquisa enquanto se escreve (só o campo #kbQ)
document.addEventListener('input', function (e) {
  var t = e.target;
  if (!t || t.id !== 'kbQ') return;
  clearTimeout(kbQTempo);
  kbQTempo = setTimeout(function () { kbPesquisar(t.value); }, 300);
});
`;

// os estilos deste pedaço (o CSS_KANBAN do equipa-kanban.js junta-os pela ordem certa)
export const CSS_KB_FILTROS = `/* ---- a barra dos filtros, como a da app: a pesquisa e o funil, com o painel por baixo ---- */
.kb-filtros{position:relative;z-index:20;display:flex;flex-direction:column;gap:10px}
.kb-fbarra-sitio{position:relative;max-width:640px}
.kb-fbarra{display:flex;align-items:center;gap:8px}
.kb-procura{flex:1 1 auto;min-width:0}
.kb-funil{position:relative;flex:none}
.kb-funil.kb-funil-on,.kb-funil[aria-expanded="true"]{border-color:var(--accent);color:var(--accent-text)}
.kb-funil.kb-funil-on{background:var(--accent-soft)}
.kb-funil-n{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--accent);
  color:var(--accent-ink);font-size:11px;font-weight:700;line-height:18px;text-align:center;font-variant-numeric:tabular-nums}
.kb-funil-n:empty{display:none}
/* o painel: da família dos menus, preso ao funil (a origem do movimento é o canto dele) */
.kb-fpainel{position:absolute;top:calc(100% + 6px);right:0;width:min(560px,100%);box-sizing:border-box;padding:14px 16px 16px;
  background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);transform-origin:top right}
.kb-fpainel.kb-entra{animation:kbFpEntra var(--medio) var(--curva-entra)}
.kb-fpainel.kb-sai{animation:kbFpSai var(--rapido) var(--curva) forwards;pointer-events:none}
.kb-fp-cab{display:flex;align-items:center;gap:8px}
.kb-fp-tit{flex:1;margin:0;font-size:20px}
.kb-fp-limpar{color:var(--accent-text)}
.kb-fp-n{margin:2px 0 14px;font-size:13px;font-variant-numeric:tabular-nums}
.kb-fp-grelha{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}
.kb-fp-campo{display:flex;flex-direction:column;gap:6px;min-width:0}
.kb-resumo-linha{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px}
.kb-resumo-linha[hidden]{display:none}
.kb-resumo{margin:0;font-size:13px}

/* ---- o seletor (o «dropdown» da app): um botão e uma lista de botões ---- */
.kb-sel{position:relative;min-width:0}
.kb-sel-botao{width:100%;display:flex;align-items:center;gap:8px;min-height:46px;padding:0 12px;border:1px solid var(--line2);border-radius:12px;
  background:var(--field);color:var(--ink);font:inherit;font-size:15px;text-align:left;cursor:pointer;
  transition:border-color var(--rapido) var(--curva),background-color var(--rapido) var(--curva)}
.kb-sel-txt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-sel-botao .i{flex:none;color:var(--faint);transition:transform var(--rapido) var(--curva)}
.kb-sel-botao[aria-expanded="true"]{border-color:var(--accent)}
.kb-sel-botao[aria-expanded="true"] .i{transform:rotate(180deg)}
.kb-sel-botao:active{background:var(--press)}
.kb-sel-botao:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.kb-sel-botao[aria-invalid="true"]{border:2px solid var(--danger)}
/* um filtro ligado: letra e contorno na cor da frente, não só o fundo (o Samsung escurece os fundos à força) */
.kb-sel-on .kb-sel-botao{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-text);font-weight:650}
.kb-sel-on .kb-sel-botao .i{color:var(--accent-text)}
.kb-sel-lista{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:30;box-sizing:border-box;max-height:280px;overflow:auto;
  overscroll-behavior:contain;padding:6px;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);
  transform-origin:top center;animation:kbSelEntra var(--rapido) var(--curva)}
.kb-sel-lista.kb-sel-cima{top:auto;bottom:calc(100% + 4px);transform-origin:bottom center}
.kb-sel-op{width:100%;display:flex;align-items:center;gap:8px;min-height:44px;padding:8px 10px;border:1px solid transparent;border-radius:10px;
  background:transparent;color:var(--ink);font:inherit;font-size:15px;text-align:left;cursor:pointer}
.kb-sel-op-txt{flex:1;min-width:0;overflow-wrap:anywhere;line-height:1.3}
.kb-sel-visto{flex:none;color:var(--accent)}
.kb-sel-op[aria-selected="false"] .kb-sel-visto{visibility:hidden}
.kb-sel-op[aria-selected="true"]{color:var(--accent-text);border-color:var(--accent);background:var(--accent-soft);font-weight:650}
.kb-sel-op:active{background:var(--press)}
.kb-sel-op:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.kb-sel-nova{color:var(--accent-text);font-weight:650}
.kb-sel-nova .i{flex:none}
.kb-sel-div{height:1px;margin:5px 6px;background:var(--line)}
.kb-sel-nada{margin:0;padding:8px 10px;font-size:13px;color:var(--muted)}
.kb-sel-novo{display:flex;flex-direction:column;gap:6px;padding:4px}
.kb-sel-novo-bt{display:flex;justify-content:flex-end;gap:6px}
.kb-selos{display:flex;flex-wrap:wrap;gap:6px}
.kb-selos:empty{display:none}
.kb-selo{display:inline-flex;align-items:center;max-width:100%;min-height:32px;padding:0 2px 0 10px;border-radius:999px;border:1px solid var(--line2);
  background:var(--chip);color:var(--ink);font-size:13px;font-weight:600}
.kb-selo-txt{min-width:0;overflow-wrap:anywhere}
.kb-selo-x{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:0;border-radius:999px;
  background:transparent;color:var(--muted);cursor:pointer}
.kb-selo-x:active{background:var(--press)}
.kb-selo-x:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}

/* ---- a ordem de uma coluna: o botão no cabeçalho dela e a escolha na janela ---- */
.kb-ord{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:28px;height:28px;padding:0 6px;
  margin-left:auto;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:650;cursor:pointer}
.kb-col-marca~.kb-ord{margin-left:0}
.kb-ord.kb-ord-on{color:var(--accent-text);border-color:var(--accent);background:var(--accent-soft)}
.kb-ord:active{background:var(--press)}
.kb-ord:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.kb-ord-txt{white-space:nowrap}
.kb-ord-campos{display:flex;flex-direction:column;gap:12px;margin-top:12px}
.kb-ord-sentido[hidden]{display:none}

@media(hover:hover) and (pointer:fine){
  .kb-sel-botao:hover{border-color:var(--faint)}
  .kb-sel-on .kb-sel-botao:hover{border-color:var(--accent)}
  .kb-sel-op:hover{background:var(--chip)}
  .kb-sel-op[aria-selected="true"]:hover{background:var(--accent-soft)}
  .kb-selo-x:hover{background:var(--tint);color:var(--ink)}
  .kb-ord:hover{background:var(--tint);color:var(--ink)}
  .kb-ord.kb-ord-on:hover{background:var(--accent-soft);color:var(--accent-text)}
}
/* no dedo, os alvos pequenos crescem até 44px sem mudar o desenho */
@media(pointer:coarse){
  .kb-selo-x::after{content:'';position:absolute;inset:-7px}
  .kb-ord::after{content:'';position:absolute;inset:-8px}
}

/* ---- os grupos de escolhas do formulário (rádios em chips) ---- */
.kb-grupo{border:0;margin:0;padding:0;min-width:0}
.kb-grupo legend{padding:0;margin-bottom:6px}
.kb-grupo .chip .i{width:16px;height:16px}

/* ---- o movimento: o painel entra como os menus e sai mais depressa; a lista quase não se nota ---- */
@keyframes kbFpEntra{from{opacity:0;transform:translateY(-6px) scale(.98)}}
@keyframes kbFpSai{to{opacity:0;transform:translateY(-6px) scale(.98)}}
@keyframes kbSelEntra{from{opacity:0;transform:scale(.96)}}
@keyframes kbFpAparece{from{opacity:0}}
@keyframes kbFpSome{to{opacity:0}}
@media(prefers-reduced-motion:reduce){
  .kb-fpainel.kb-entra,.kb-sel-lista{animation-name:kbFpAparece}
  .kb-fpainel.kb-sai{animation-name:kbFpSome}
  .kb-sel-botao .i{transition:none}
}

/* ---- o telemóvel: o título e as Colunas na mesma linha; o painel na largura toda ---- */
@media(max-width:899px){
  .kb-cab .cab{flex-wrap:nowrap;align-items:flex-start}
  .kb-cab .cab-txt{flex:1 1 auto}
  .kb-cab .cab h1{line-height:44px}
  .kb-cab .cab .sub{display:none}
  .kb-cab .cab-acoes{flex:none;flex-wrap:nowrap}
  .kb-cab .cab-acoes .btn.primary{display:none}
  .kb-fbarra-sitio{max-width:none}
  .kb-fpainel{left:0;width:auto}
}
`;
