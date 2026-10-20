/* Selecionar vários movimentos e tratá-los de uma vez.
   ---------------------------------------------------
   O toque longo num movimento passa a entrar em modo de seleção, com esse já
   marcado; o «Selecionar vários» do cabeçalho entra sem nada marcado; e na
   tabela do ecrã largo as caixas estão sempre à vista, e marcar uma entra.
   As opções de um movimento sozinho (Editar, Apagar) estão na ficha.

   O aspeto e a sensação são os das Casas (cloud/selecao-listas.js): as
   caixas entram a desvanecer (estilos.css:.sel-entra), a caixa de tudo e a
   contagem tomam o lugar do título, a linha marcada leva o realce dos
   cartões (.sel-on-card), e a barra do fundo é a deles — × Cancelar, a
   contagem ao meio e as ações, que aqui são as dos Movimentos. Há dois
   níveis de marca: cada movimento e tudo o que está à vista. A caixa de tudo
   vive no cabeçalho, que acompanha o scroll: a meio de uma lista de duzentos
   movimentos continua a haver como marcar tudo sem voltar ao topo.

   Um movimento de vários imóveis (um lote, guardado como uma parte por
   imóvel) é uma linha só, e marca-se, edita-se e elimina-se inteiro: as
   partes todas que estão na base, pelo lote.id, e nunca as de outro lote.

   Este ficheiro transforma o HTML que o vTransactions devolve, em vez de o
   reescrever. É o mesmo caminho que o painel.js já usava para os cartões da
   vista geral: a vista continua a ser de quem a escreveu, e isto acrescenta. */

'use strict';

CW.selMode = false;
/* Os ids marcados, como conjunto. Um movimento de vários imóveis (um lote) é
   uma linha só na lista e as partes dele (uma por imóvel, com o mesmo
   lote.id) marcam-se e desmarcam-se juntas: estão TODAS aqui. Assim a linha
   do lote fica marcada seja qual for a parte que a representa com os filtros
   de agora (o data-tx é o da primeira parte que passou), e a marca nunca
   apanha partes de outro lote. */
var selIds = {};

// quantos movimentos estão marcados, como a lista os mostra: um lote conta uma vez
var selN = function () { return selContar(); };
var selTem = function (id) { return !!selIds[id]; };

/* O lote de um movimento, como chave de texto.
   Recebe: t — o movimento (objeto da base).
   Devolve: o lote.id em texto, ou null num movimento que não é parte de um lote. */
function selLoteDe(t) {
  var l = t && t.lote;
  return l && l.id != null && l.id !== '' ? String(l.id) : null;
}

/* Quantos movimentos estão marcados: os soltos um a um, e cada lote uma vez,
   tenha as partes que tiver. Um id que já não está na base (apagado noutro
   aparelho enquanto se marcava) não conta: não há nada que editar nem apagar.
   Devolve: o número (inteiro). */
function selContar() {
  var porId = {}, vistos = {};
  (db.transactions || []).forEach(function (t) { porId[t.id] = t; });
  Object.keys(selIds).forEach(function (id) {
    if (!porId[id]) return;
    var k = selLoteDe(porId[id]);
    vistos[k !== null ? 'lote:' + k : 'tx:' + id] = 1;
  });
  return Object.keys(vistos).length;
}

/* Marca ou desmarca linhas: cada id leva consigo as partes todas do lote dele
   que estão na base (pelo lote.id); um movimento que não é de lote vai sozinho.
   O índice faz-se uma vez por chamada — marcar tudo pede-o por cada linha.
   Recebe: ids — os ids das linhas (o data-tx de cada uma); on — true para
   marcar, false para desmarcar.
   Devolve: nada — só mexe no estado (selIds). */
function selMarcar(ids, on) {
  var porId = {}, porLote = {};
  (db.transactions || []).forEach(function (t) {
    porId[t.id] = t;
    var k = selLoteDe(t);
    if (k !== null) (porLote[k] = porLote[k] || []).push(t.id);
  });
  ids.forEach(function (id) {
    var k = selLoteDe(porId[id]);
    (k !== null ? porLote[k] : [id]).forEach(function (x) {
      if (on) selIds[x] = 1; else delete selIds[x];
    });
  });
}

/* ------------------------------------------------------------- entrar e sair */

// a seleção acabou de começar: as caixas que o render a seguir põe entram a desvanecer
// (selCaixasEntram), como as das Casas (selecao-listas.js:selLEntrou)
var selEntrou = false;

/* Entra em modo de seleção — opcionalmente já com um movimento marcado — e
   repinta a vista com as caixas. Já em seleção, o toque longo marca ou
   desmarca, como o toque (o das Casas: selecao-listas.js:CW.selLTocar): antes
   entrava de novo e deitava fora o que estava marcado.
   Recebe: id (opcional) — o id do movimento a marcar logo à entrada; ev
   (opcional) — o evento do toque na caixa de uma linha da tabela, para não
   abrir também a ficha.
   Devolve: nada — redesenha a vista (ou, já em seleção, só as marcas). */
CW.selEntrar = function (id, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  if (CW.selMode && id) return CW.selToggle(id);
  CW.selMode = true;
  selIds = {};
  if (id) selMarcar([id], true);   // a linha de um lote entra com o lote inteiro
  selEntrou = true;
  render();
};

/* A caixa de tudo, no cabeçalho da tabela, fora da seleção: entra com tudo o
   que está à vista marcado.
   Recebe: ev (opcional) — o evento do toque.
   Devolve: nada — redesenha a vista. */
CW.selEntrarTodos = function (ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var ids = selIdsVisiveis();
  CW.selMode = true;
  selIds = {};
  selMarcar(ids, true);
  selEntrou = true;
  render();
};

/* A lista é uma tabela com as caixas sempre à vista (o ecrã largo,
   D-Movimentos)? Lê-se da mesma largura da folha (estilos.css:.mov-linha).
   Devolve: true no ecrã largo; false no telemóvel e no intermédio. */
function selNaTabela() {
  try { return !!(window.matchMedia && window.matchMedia('(min-width:1100px)').matches); } catch (e) { return false; }
}

/* Na tabela, a seleção é o que as caixas marcam: desmarcar a última termina-a,
   como numa lista de correio. No telemóvel fica, à espera do toque seguinte.
   Devolve: nada — sai da seleção (e repinta) quando é o caso. */
function selSairSeVazio() {
  if (CW.selMode && !selN() && selNaTabela()) CW.selSair();
}

/* limpa o estado sem repintar: para quem já vai repintar por outra razão
   Devolve: nada — só limpa o estado da seleção. */
CW.selReset = function () {
  CW.selMode = false;
  selIds = {};
};
// sai da seleção e repinta; o par do selReset, para quando ninguém mais vai repintar
// Devolve: nada — redesenha a vista.
CW.selSair = function () {
  CW.selMode = false;
  selIds = {};
  render();
};

/* Marcar e desmarcar sem redesenhar a vista toda: numa lista longa, um
   render() por cada toque numa caixa dava um salto a cada marca.
   Recebe: id — o id do movimento a marcar ou desmarcar; ev (opcional) — o
   evento do toque, para lhe travar a propagação.
   Devolve: nada — repinta só as marcas. */
CW.selToggle = function (id, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  selMarcar([id], !selIds[id]);
  selPintar();
  selSairSeVazio();
};

// marca ou desmarca todas as linhas visíveis: tudo marcado limpa, senão marca o que falta
// Recebe: ev (opcional) — o evento do toque, para lhe travar a propagação.
// Devolve: nada — repinta só as marcas.
CW.selTodos = function (ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var ids = selIdsVisiveis();
  var todos = ids.length && ids.every(selTem);
  selMarcar(ids, !todos);
  selPintar();
  selSairSeVazio();
};

// os ids de todos os movimentos que a vista mostra neste momento (já com os filtros aplicados)
// Devolve: array com os ids (strings) das linhas visíveis, lidos do DOM.
function selIdsVisiveis() {
  return [].slice.call(document.querySelectorAll('#view .txrow[data-tx]'))
    .map(function (e) { return e.getAttribute('data-tx'); });
}

/* A lista viva (vistas.js:pintarListaTx) refaz linhas sem passar pelo render,
   e uma linha refeita nasce sem a marca que tinha. Fica exposto para ela o
   poder repor — é a mesma função que o render já chamava no fim. */
// Recebe: nada.
// Devolve: nada — repinta as marcas no DOM que estiver no ecra.
CW.selPintar = function () { selPintar(); };
// Repõe as marcas e as contagens a partir do estado, sem redesenhar a vista.
// A linha marcada leva o realce dos cartões das Casas (.sel-on-card).
// Devolve: nada — mexe diretamente no DOM (caixas, contagem e cabeçalho).
function selPintar() {
  [].slice.call(document.querySelectorAll('#view .txrow[data-tx]')).forEach(function (e) {
    var on = selTem(e.getAttribute('data-tx'));
    e.classList.toggle('sel-on-card', on);
    if (e.setAttribute) e.setAttribute('aria-pressed', on ? 'true' : 'false');
    var c = e.querySelector('.selbox');
    if (c) c.innerHTML = caixa(on);
  });
  patchHdrSel();
}

/* A caixa de tudo e a contagem: no cabeçalho do telemóvel (patchHdrSel), na
   coluna das caixas da tabela ([data-sel-tudo]) e na barra das ações (a
   contagem ao meio, a soma por baixo dela e o «Apagar N»). Os textos são os
   das Casas (selecao-listas.js:selLPintar): «2 selecionados», e sem nada
   «toca nos movimentos». Cheia com tudo o que está à vista marcado, a meio
   com parte. Sem nada marcado, as ações ficam paradas.
   Devolve: nada — mexe no #selGlobal, no #selConta, nas caixas de tudo e na
   barra, se lá estiverem. */
function selCabPintar() {
  var ids = selIdsVisiveis(), todos = ids.length > 0 && ids.every(selTem), algum = ids.some(selTem), n = selN();
  var g = document.getElementById('selGlobal');
  if (g) {
    g.innerHTML = caixa(todos, algum);
    if (g.setAttribute) g.setAttribute('aria-checked', todos ? 'true' : algum ? 'mixed' : 'false');
  }
  [].slice.call(document.querySelectorAll('#view [data-sel-tudo]')).forEach(function (e) {
    e.innerHTML = caixa(CW.selMode && todos, CW.selMode && algum);
    if (e.setAttribute) e.setAttribute('aria-checked', CW.selMode && todos ? 'true' : CW.selMode && algum ? 'mixed' : 'false');
  });
  var c = document.getElementById('selConta');
  if (c) c.textContent = n ? n + (n === 1 ? ' movimento' : ' movimentos') : 'nenhum movimento';
  var bn = document.getElementById('selFundoN');
  if (bn) bn.textContent = n ? n + (n === 1 ? ' selecionado' : ' selecionados') : 'toca nos movimentos';
  // o «· » de antes vem da folha, no ecrã largo, onde a soma vai na mesma linha
  var bs = document.getElementById('selFundoSoma');
  if (bs) bs.textContent = n ? 'somam ' + selSomaTexto() : '';
  var ba = document.getElementById('selFundoApagar');
  if (ba) ba.textContent = n ? 'Apagar ' + n : 'Apagar';
  [].slice.call(document.querySelectorAll('.sel-fundo [data-precisa]')).forEach(function (b) {
    if (n) b.removeAttribute('disabled'); else b.setAttribute('disabled', '');
  });
}

/* Quanto somam os movimentos marcados, com o sinal do dinheiro: o que entra
   soma, o que sai subtrai, e um acerto entre proprietários não conta. De um
   lote, as partes todas (selAlvos) — o total que se escreveu.
   Devolve: o valor em texto, com o sinal («+425,00 €», «−1 016,00 €»). */
function selSomaTexto() {
  var s = 0;
  selAlvos().txs.forEach(function (t) {
    var v = Math.round((Number(t.amount) || 0) * 100);
    if (isIn(t.kind)) s += v; else if (isOut(t.kind)) s -= v;
  });
  return (s > 0 ? '+' : '') + euro2(s / 100);
}

// o HTML da caixa de marcar: cheia, vazia, ou a meio (parcial) com um traço
// Recebe: marcada — true para a caixa cheia; parcial (opcional) — true para o traço a meio quando não está tudo marcado.
// Devolve: string de HTML da caixa, pronta a inserir com innerHTML.
function caixa(marcada, parcial) {
  if (marcada) {
    return '<span class="selck on">' + ic('check', 13) + '</span>';
  }
  return '<span class="selck' + (parcial ? ' meio' : '') + '">' + (parcial ? '<i></i>' : '') + '</span>';
}

/* ------------------------------------------------ a vista, com as caixas */

/* A decoração das linhas é GERADA com a vista, e não colada em cima dela.

   Até aqui este ficheiro pegava no HTML já pronto dos Movimentos, metia-o num
   <div> avulso, punha data-tx, data-mes, a caixa de marcar e o kebab em cada
   linha, e serializava tudo de volta. Medido com 500 movimentos: 42 dos 58 ms
   de cada repintura, dentro e fora do modo de seleção — 72% do custo, para um
   trabalho que a vista podia ter feito de uma vez enquanto se escrevia a si
   própria. E enquanto fosse assim, nenhuma repintura parcial podia ser
   segura: uma linha repintada sozinha nascia sem nada disto.

   Agora substitui-se o ponto de extensão da linha (lista-movimentos.js:txLinhaExtra).
   O título do mês já não leva nada: as caixas por mês saíram com o modelo
   das Casas, que marca cartão a cartão ou tudo.

   Fora da seleção a caixa também lá está, com a classe .fora: a folha só a
   mostra na tabela do ecrã largo (D-Movimentos), onde as caixas estão sempre
   à vista e marcar uma é a porta da seleção. No telemóvel fica escondida, e a
   porta é o toque longo ou o «Selecionar vários» do cabeçalho (patchHdrSel).
   O kebab de cada linha saiu com o canvas: o Editar e o Apagar de um
   movimento sozinho estão na ficha, que é o que tocar na linha abre. */

var _txLinhaExtra = txLinhaExtra;
txLinhaExtra = function (t, mes) {
  var x = _txLinhaExtra(t, mes) || {};
  /* a linha de um lote chega com o id da primeira parte que passou no filtro:
     é esse o data-tx, e marcá-la marca o lote inteiro (selMarcar) */
  var id = t.id;
  x.attrs = (x.attrs || '') + ' data-tx="' + esc(id) + '"';
  if (CW.selMode) {
    // a caixa entra à esquerda e o toque na linha passa a marcar
    x.caixa = (x.caixa || '') + '<span class="selbox" aria-hidden="true">' + caixa(selTem(id)) + '</span>';
    x.onclick = 'CW.selToggle(\'' + jsq(id) + '\',event)';
    x.attrs += ' data-toca="vista" aria-pressed="' + (selTem(id) ? 'true' : 'false') + '"';
    if (selTem(id)) x.cls = ((x.cls || '') + ' sel-on-card').trim();
  } else {
    x.caixa = (x.caixa || '') + '<span class="selbox fora" role="checkbox" aria-checked="false" aria-label="Selecionar «' +
      esc(t.label || 'movimento') + '»" data-toca="modo" data-click="CW.selEntrar(\'' + jsq(id) + '\',event)">' + caixa(false) + '</span>';
  }
  return x;
};

/* ------------------------------------------------ a vista, com as barras */

/* A caixa de tudo na coluna das caixas da tabela (lista-movimentos.js:txCabTabela):
   em seleção marca ou desmarca tudo o que está à vista; fora dela entra na
   seleção com tudo marcado. A selCabPintar acerta-a a cada marca.
   Devolve: o HTML da caixa (texto). */
function selCaixaTudoHtml() {
  return CW.selMode
    ? '<span class="selbox mov-cab-caixa" data-sel-tudo role="checkbox" aria-checked="false" aria-label="Marcar todos os movimentos à vista" data-toca="vista" data-click="CW.selTodos(event)">' + caixa(false) + '</span>'
    : '<span class="selbox mov-cab-caixa" data-sel-tudo role="checkbox" aria-checked="false" aria-label="Selecionar todos os movimentos à vista" data-toca="modo" data-click="CW.selEntrarTodos(event)">' + caixa(false) + '</span>';
}

/* Um botão das ações da barra, com o ícone e dois rótulos: o curto, que o
   telemóvel mostra por baixo do ícone («Categoria»), e o longo, que o ecrã
   largo mostra ao lado dele («Mudar categoria»). A folha esconde um dos dois
   (estilos.css:.sel-rot-curto, .sel-rot-longo), e o nome acessível é o que se
   lê. Sem rótulo longo, o curto serve nos dois.
   Recebe: o — {cls, ic, curto, longo, click, toca, risco, id} — a classe extra,
   o ícone (icones.js), os rótulos, o data-click, o data-toca, o data-risco e o
   id do rótulo (para o «Apagar N», que a selCabPintar enche).
   Devolve: o HTML do botão (texto). */
function selBotaoHtml(o) {
  var rot = o.longo
    ? '<span class="sel-rot-curto">' + o.curto + '</span><span class="sel-rot-longo">' + o.longo + '</span>'
    : '<span' + (o.id ? ' id="' + o.id + '"' : '') + '>' + o.curto + '</span>';
  return '<button type="button" class="btn sel-acao' + (o.cls ? ' ' + o.cls : '') + '" data-precisa data-toca="' + o.toca + '"' +
    (o.risco ? ' data-risco="' + o.risco + '"' : '') + ' data-click="' + o.click + '">' + ic(o.ic, 18) + rot + '</button>';
}

/* A barra das ações da seleção, a das Casas (selecao-listas.js:selLBarraHtml):
   × Cancelar, a contagem ao meio («2 selecionados», com o quanto somam por
   baixo) e as ações — aqui as dos Movimentos: Mudar categoria, Adicionar
   etiquetas (com etiquetas definidas), Editar (as duas de uma vez) e Apagar
   N, paradas sem nada marcado (data-precisa). No telemóvel são duas linhas,
   como na prévia que o Martinho escolheu: em cima o Cancelar e a contagem, em
   baixo os botões lado a lado, cada um com o ícone por cima de um rótulo
   curto — a 375px cabem quatro sem régua. A partir de 901px é a barra
   azul-noite das Casas e do canvas, numa linha só, com os rótulos por
   extenso e sem o Editar, que os outros dois já repartem. A folha mostra as
   peças de cada um (estilos.css:.sel-fundo.mov-sel). A contagem, a soma e o
   número do «Apagar» enche-os a selCabPintar.
   Recebe: etiquetas — true com etiquetas definidas (o «Adicionar etiquetas»).
   Devolve: o HTML de dentro da barra (texto). */
function selBarraHtml(etiquetas) {
  return '<button type="button" class="btn sel-fim" data-toca="modo" data-click="CW.selSair()">' + ic('x', 15) + ' Cancelar</button>' +
    '<p class="sel-info"><b id="selFundoN">toca nos movimentos</b><span id="selFundoSoma" class="small"></span></p>' +
    '<div class="sel-acoes">' +
      selBotaoHtml({ cls: 'sel-largo', ic: 'layers', curto: 'Categoria', longo: 'Mudar categoria', toca: 'camada', click: 'CW.selEditar(\'cat\')' }) +
      (etiquetas ? selBotaoHtml({ cls: 'sel-largo', ic: 'tag', curto: 'Etiquetas', longo: 'Adicionar etiquetas', toca: 'camada', click: 'CW.selEditar(\'tags\')' }) : '') +
      selBotaoHtml({ cls: 'sel-estreito', ic: 'pen', curto: 'Editar', toca: 'camada', click: 'CW.selEditar()' }) +
      selBotaoHtml({ cls: 'danger', ic: 'trash', curto: 'Apagar', id: 'selFundoApagar', toca: 'dados', risco: 'destroi', click: 'CW.selApagar()' }) +
    '</div>';
}

/* Põe a barra no fundo, como as Casas a põem (selecao-listas.js:selLDecorar):
   um nó do body, e não da vista — fica de render para render (a selCabPintar
   só lhe acerta os números), e não anda com o #view quando ele desliza. Só
   se refaz quando as etiquetas aparecem ou somem, que é o que lhe muda os
   botões; uma barra de outra lista sai. Fora da seleção dos Movimentos tira a
   sua (a das Casas é de quem a pôs).
   Devolve: nada — mexe no body. */
function selBarraPor() {
  var f = document.querySelector('.sel-fundo');
  if (!CW.selMode || tab !== 'transactions') {
    if (f && f.classList.contains('mov-sel')) f.remove();
    return;
  }
  var etiquetas = (db.settings && db.settings.tags || []).length > 0;
  if (f && (!f.classList.contains('mov-sel') || f.getAttribute('data-etiquetas') !== String(etiquetas))) { f.remove(); f = null; }
  if (f) return;
  f = document.createElement('div');
  f.className = 'sel-fundo mov-sel';
  f.setAttribute('role', 'toolbar');
  f.setAttribute('aria-label', 'Seleção');
  f.setAttribute('data-etiquetas', String(etiquetas));
  f.innerHTML = selBarraHtml(etiquetas);
  document.body.appendChild(f);
}

var _vTransactions_sel = vTransactions;
vTransactions = function () {
  var html = _vTransactions_sel().replace('<span class="mov-cab-caixa"></span>', selCaixaTudoHtml());
  /* sem linhas não há nada para marcar — e sair daqui evita ficar com a barra
     de seleção viva por cima de um ecrã vazio */
  if (!txLinhasPintadas) CW.selMode = false;
  /* A caixa de tudo e a contagem vivem no cabeçalho do telemóvel
     (patchHdrSel), no lugar do título, e na coluna das caixas da tabela:
     numa barra por cima da lista empurravam-na ~64px para baixo ao entrar, e
     puxavam-na ao sair. As ações vão na barra do fundo (selBarraPor). */
  return html;
};

/* ------------------------------------------------------ o toque longo */

// nos movimentos o toque longo entra em seleção; no resto continua como estava
var _lpMenu_sel = lpMenu;
lpMenu = function (v) {
  var a = String(v || '').split(':');
  if (a[0] === 'tx' && tab === 'transactions') return CW.selEntrar(a[1]);
  return _lpMenu_sel(v);
};

/* ------------------------------------------------------- o botão do cabeçalho */

/* Veste o cabeçalho dos Movimentos. O botão do cabeçalho é o «Selecionar
   vários» do canvas (M-Movimentos) — os filtros abrem-se no botão ao lado da
   pesquisa (lista-movimentos.js:txBarraHtml) —, e some sem linhas para
   marcar e na tabela do ecrã largo, onde as caixas já estão à vista (a
   folha: estilos.css:.mov-hdr-sel). Em seleção, como nas Casas
   (selecao-listas.js:selLCabNovo), o título dá lugar à caixa de tudo e à
   contagem (#selCab — a CSS esconde o título com o body.sel-on), colados ao
   topo como o cabeçalho, para se poder marcar tudo a meio da lista; e a
   folha esconde o botão (estilos.css:body.sel-on #hdrFilt.mov-hdr-sel): a
   barra do fundo já tem o Cancelar e as ações. O «⋯» que ele era em seleção
   saiu, com o menu que abria. Noutro separador devolve o botão aos filtros —
   o render normal repõe o funil —, e nos Imóveis, nos Contratos e nos
   Planeados o cloud/selecao-listas.js veste-o a seguir com o seu «Selecionar
   vários» (selecao-listas.js:selLCabecalho, que embrulha esta). O ícone é a
   caixa com o visto (ic('caixaVisto'), o ☑), em todo o lado.
   Devolve: nada — mexe diretamente no cabeçalho, no DOM. */
function patchHdrSel() {
  var hb = document.getElementById('hdrFilt');
  if (!hb) return;
  var cab = document.getElementById('selCab');
  if (!hb.getAttribute('data-titulo')) hb.setAttribute('data-titulo', hb.title || 'Filtros e parâmetros');
  if (tab !== 'transactions') {
    if (cab) cab.remove();
    if (hb.classList.contains('mov-hdr-sel')) {
      hb.classList.remove('mov-hdr-sel');
      hb.title = hb.getAttribute('data-titulo');
      hb.removeAttribute('aria-label');
    }
    return;
  }
  hb.classList.add('mov-hdr-sel');
  hb.style.display = txLinhasPintadas ? '' : 'none';
  hb.innerHTML = ic('caixaVisto', 18);
  hb.title = 'Selecionar vários';
  hb.setAttribute('aria-label', 'Selecionar vários');
  hb.classList.remove('primary');
  if (!CW.selMode) {
    if (cab) cab.remove();
    return;
  }
  var tit = document.getElementById('pageTitle');
  if (!cab && tit && tit.parentNode) {
    cab = document.createElement('div');
    cab.id = 'selCab';
    cab.className = 'sel-cab';
    cab.innerHTML =
      '<span class="selbox" id="selGlobal" role="checkbox" tabindex="0" aria-checked="false" aria-label="Marcar todos os movimentos à vista" data-toca="vista" data-click="CW.selTodos(event)">' + caixa(false) + '</span>' +
      '<span class="u-fx-1 u-minw-0 u-cur-pointer" data-toca="vista" data-click="CW.selTodos(event)"><b id="selConta">nenhum movimento</b>' +
      '<span class="small u-d-block">toca para marcar tudo</span></span>';
    tit.parentNode.insertBefore(cab, tit);
  }
  selCabPintar();
}

/* O cabeçalho repinta-se também pelo caminho curto da lista
   (lista-movimentos.js:refrescarMovimentos), que repõe o funil sem passar pelo
   render: fica exposto para ele.
   Devolve: nada — veste o cabeçalho (patchHdrSel). */
CW.selCabecalho = function () { patchHdrSel(); };

// Nos Movimentos o botão do cabeçalho é da seleção, como nas Casas
// (selecao-listas.js:hdrFiltToggle): fora dela entra («Selecionar vários»),
// dentro sai — em seleção a folha esconde-o, e a barra do fundo tem o
// Cancelar. No resto continua a abrir os filtros.
// Devolve: nada.
var _hdrFiltToggle_sel = hdrFiltToggle;
hdrFiltToggle = function () {
  if (tab === 'transactions') return CW.selMode ? CW.selSair() : CW.selEntrar();
  return _hdrFiltToggle_sel();
};

/* --------------------------------------------------------- editar em massa */

/* Abre a janela de edição em massa: categoria, subcategoria e etiquetas.
   Só se aplica o que for preenchido — o resto de cada movimento fica como
   está, e as etiquetas só se acrescentam. O Aplicar é o selGravar.
   Recebe: parte (opcional) — 'cat' só a categoria e a subcategoria, 'tags' só
   as etiquetas; sem ela, tudo.
   Devolve: nada — abre o modal de edição em massa (ou nada, sem marcas). */
CW.selEditar = function (parte) {
  var n = selN();
  if (!n) return;
  var tree = allCats('');
  var cats = [{ v: '', label: '— não mexer —' }].concat(
    Object.keys(tree).map(function (c) { return { v: c, label: c }; })
  );
  var tags = (db.settings.tags || []);
  /* a barra do ecrã largo abre só uma das partes (o «Mudar categoria» e o
     «Adicionar etiquetas» do canvas); o «Editar» do telemóvel, as duas */
  var comCat = parte !== 'tags', comTags = parte !== 'cat' && tags.length;
  var quantos = n + (n === 1 ? ' movimento' : ' movimentos');

  openModal(parte === 'cat' ? 'Mudar a categoria de ' + quantos : parte === 'tags' ? 'Adicionar etiquetas a ' + quantos : 'Editar ' + quantos,
    '<div class="form">' +
      (parte ? '' : '<div class="hint">Só se altera o que preencheres. O resto de cada movimento fica como está.</div>') +
      (comCat
        /* a função, e não o nome: o selPick resolve um nome pelo funcaoDaApp,
           que só conhece nomes de topo — «CW.selCatMudou» não o é, e a
           subcategoria nunca acompanhava a categoria */
        ? '<label>Categoria' + sel('selCat', '', cats, CW.selCatMudou, 'rascunho') + '</label>' +
          '<div id="selSubBox"><label>Subcategoria' +
            sel('selSub', '', [{ v: '', label: '— não mexer —' }], '', 'rascunho') + '</label></div>'
        : '') +
      (comTags
        ? '<div><div class="flabel" id="selTagsL">Etiquetas</div>' +
          '<div class="chips-fila" id="selTags" role="group" aria-labelledby="selTagsL">' + tags.map(function (g) {
            return '<button type="button" class="chip" aria-pressed="false" data-tag="' + esc(g) +
              '" data-toca="nada" data-click="CW.selTagToggle(this)">' + esc(g) + '</button>';
          }).join('') + '</div>' +
          '<div class="hint u-mt-7px">As que marcares são <b>acrescentadas</b>. ' +
          'Nenhuma etiqueta é removida.</div></div>'
        : '') +
      (parte === 'tags' && !tags.length ? '<div class="hint">Ainda não tens etiquetas: cria-as em Definições → Categorias, etiquetas e IRS.</div>' : '') +
    '</div>',
    '<button class="btn" data-toca="camada" data-click="closeAllModals()">Cancelar</button>' +
    '<button class="btn primary" data-toca="dados" data-click="CW.selGravar()">Aplicar</button>');
};

// ao mudar a categoria na edição em massa, refaz o menu de subcategorias com as dessa categoria
// Devolve: nada — refaz o menu de subcategorias no DOM.
CW.selCatMudou = function () {
  var c = val('selCat'), tree = allCats('');
  var subs = c && tree[c] ? tree[c] : [];
  var box = document.getElementById('selSubBox');
  if (!box) return;
  box.innerHTML = '<label>Subcategoria' + sel('selSub', '',
    [{ v: '', label: '— não mexer —' }].concat(subs.map(function (x) { return { v: x, label: x }; })), '', 'rascunho') + '</label>';
};

// liga/desliga uma etiqueta na edição em massa (o estado vive na classe do próprio chip)
// Recebe: b — o próprio chip da etiqueta (elemento do DOM).
// Devolve: nada — alterna a classe .on e o aria-pressed do chip.
CW.selTagToggle = function (b) {
  var on = !b.classList.contains('on');
  b.classList.toggle('on', on);
  if (b.setAttribute) b.setAttribute('aria-pressed', on ? 'true' : 'false');
};

/* O que as ações da seleção tocam: os movimentos marcados e, de cada lote
   marcado, as partes todas que estão na base, pelo lote.id — também as que
   tenham chegado depois de se marcar. Um lote incompleto nesta base (menos
   partes do que o lote.n, porque há imóveis dele que não vês) fica de fora
   inteiro: mexer só nas partes que se veem partia-o, e só quem vê os imóveis
   todos o altera, como na ficha.
   Devolve: {txs, n, fora} — os movimentos a tocar (os objetos da base), quantos
   movimentos são para quem os vê (um lote conta um) e quantos lotes ficaram de
   fora. */
function selAlvos() {
  var L = db.transactions || [], marcados = {}, partes = {};
  L.forEach(function (t) {
    var k = selLoteDe(t);
    if (k === null) return;
    partes[k] = (partes[k] || 0) + 1;
    if (selIds[t.id]) marcados[k] = 1;
  });
  var txs = [], contados = {}, fora = {};
  L.forEach(function (t) {
    var k = selLoteDe(t);
    if (k === null) {
      if (selIds[t.id]) { txs.push(t); contados['tx:' + t.id] = 1; }
      return;
    }
    if (!marcados[k]) return;
    if (partes[k] < (Number(t.lote.n) || 0)) { fora[k] = 1; return; }
    txs.push(t); contados['lote:' + k] = 1;
  });
  return { txs: txs, n: Object.keys(contados).length, fora: Object.keys(fora).length };
}

/* A frase dos lotes que as ações da seleção deixaram de fora.
   Recebe: k — quantos lotes ficaram de fora (selAlvos).
   Devolve: o texto; '' quando não ficou nenhum. */
function selForaFrase(k) {
  if (!k) return '';
  return (k === 1 ? 'Um movimento dividido ficou de fora' : k + ' movimentos divididos ficaram de fora') +
    ': tem partes em imóveis que não vês, e só quem os vê a todos o altera.';
}

/* Aplica a edição em massa aos movimentos marcados e grava na base. Uma
   categoria nova sem subcategoria escolhida limpa a antiga — ficava a
   apontar para a árvore errada. Etiquetas só entram, nunca saem. Um lote
   marcado muda em todas as partes (selAlvos), e conta como um movimento. No
   fim fecha tudo e sai da seleção.
   Devolve: nada — grava, fecha os modais e sai da seleção (ou avisa por
   toast se nada foi preenchido). */
CW.selGravar = function () {
  var cat = val('selCat'), sub = val('selSub');
  var tags = [].slice.call(document.querySelectorAll('#selTags .on'))
    .map(function (b) { return b.getAttribute('data-tag'); });
  if (!cat && !sub && !tags.length) return toast('Não escolheste nada para alterar.');

  var alvo = selAlvos(), n = alvo.n;
  alvo.txs.forEach(function (t) {
    if (cat) { t.category = cat; if (!sub) t.sub = ''; }   // categoria nova, subcategoria antiga não serve
    if (sub) t.sub = sub;
    if (tags.length) {
      t.tags = (t.tags || []).slice();
      tags.forEach(function (g) { if (t.tags.indexOf(g) < 0) t.tags.push(g); });
    }
  });
  if (alvo.txs.length) save();
  closeAllModals(); CW.selSair();
  toast(((n ? n + (n === 1 ? ' movimento alterado.' : ' movimentos alterados.') : '') + ' ' + selForaFrase(alvo.fora)).trim());
};

/* Apaga os movimentos marcados: a confirmação diz quantos são e quanto
   somam — de um lote, o total das partes todas, que saem juntas —, e à saída
   fica um "Anular" de seis segundos (comDesfazer) — a cópia é tirada antes
   do corte e volta inteira se o anular for clicado. A soma é a da barra
   (selSomaTexto), com o sinal do dinheiro: somava os valores sem sinal, e
   uma receita de 1 250 € com uma despesa de 55 € dava «+1 195,00 €» na barra
   e «1 305,00 €» na janela, no momento de apagar. O verbo é o da barra e o
   do canvas: Apagar, do menu ao aviso.
   Devolve: nada — se for confirmado, grava e sai da seleção. */
CW.selApagar = function () {
  if (!selN()) return;
  var alvo = selAlvos();
  if (!alvo.txs.length) return toast(selForaFrase(alvo.fora));
  confirmModal('Apagar ' + alvo.n + (alvo.n === 1 ? ' movimento' : ' movimentos'),
    'Somam ' + selSomaTexto() + '.' + (alvo.fora ? ' ' + selForaFrase(alvo.fora) : ''),
    function () {
      /* outra vez aqui: entre a pergunta e o sim pode ter chegado uma parte */
      var agora = selAlvos(), sai = {};
      agora.txs.forEach(function (t) { sai[t.id] = 1; });
      var copia = JSON.parse(JSON.stringify(agora.txs));
      db.transactions = (db.transactions || []).filter(function (t) { return !sai[t.id]; });
      save(); buildNav(); CW.selSair();
      comDesfazer(agora.n + (agora.n === 1 ? ' movimento apagado.' : ' movimentos apagados.'), function () {
        db.transactions = (db.transactions || []).concat(copia);
      });
    });
};

/* ---------------------------------------------------------------- o resto */

// sair dos movimentos sai da seleção: uma seleção invisível é uma armadilha
var _go_sel = go;
go = function (t) {
  if (CW.selMode && t !== 'transactions') { CW.selMode = false; selIds = {}; }
  return _go_sel(t);
};

var _render_sel = render;
render = function () {
  /* mudar de ecrã sai da seleção: a barra do fundo ficava viva num ecrã
     onde as ações dela já não faziam sentido nenhum */
  if (CW.selMode && tab !== 'transactions') CW.selReset();
  var r = _render_sel.apply(this, arguments);
  patchHdrSel();
  document.body.classList.toggle('sel-on', !!CW.selMode);
  // a barra dos Movimentos tem duas linhas no telemóvel: a folha abre-lhe espaço (estilos.css:body.sel-mov)
  document.body.classList.toggle('sel-mov', !!CW.selMode);
  selBarraPor();
  if (CW.selMode) selPintar();
  selCaixasEntram();
  return r;
};

/* ------------------------------------------- as caixas a entrar e a sair */

/* Entrar na seleção é como nas Casas (selecao-listas.js:selLDecorar): as
   caixas das linhas aparecem a desvanecer, no --medio e com a curva de quem
   chega (estilos.css:.sel-entra, a animação da folha), a caixa de tudo e a
   contagem entram no cabeçalho da mesma maneira (estilos.css:.sel-cab), e a
   barra do fundo chega de uma vez, como a delas. Sair também é o das Casas:
   o render seguinte já não tem caixas, e elas vão-se sem animar.

   Só ao ENTRAR (selEntrou): marcar uma linha (selPintar), a lista viva
   (lista-movimentos.js:pintarListaTx) e a sincronização de fundo (um render
   sem mudar de modo) não voltam a animar — a classe só se põe aqui. Na
   tabela do ecrã largo as caixas já se viam antes de entrar: só mudam de
   marca, e não desvanecem. Com menos movimento pedido, a regra da folha
   (prefers-reduced-motion) desliga a animação, e as caixas estão lá logo.
   A classe sai quando a animação acaba: uma linha que a lista viva muda de
   sítio é reinserida, e uma animação de CSS recomeça num nó reinserido.
   Devolve: nada — mexe nas caixas que o render acabou de pôr. */
function selCaixasEntram() {
  var entrou = selEntrou;
  selEntrou = false;
  if (!entrou || !CW.selMode || tab !== 'transactions' || selNaTabela()) return;
  [].slice.call(document.querySelectorAll('#view .txrow[data-tx]>.selbox')).forEach(function (b) {
    b.classList.add('sel-entra');
    b.addEventListener('animationend', function () { b.classList.remove('sel-entra'); }, { once: true });
  });
}

/* A folha da seleção (a caixa de marcar, as barras do topo e do fundo, o
   kebab da linha) era feita aqui, num elemento de folha criado por JavaScript
   e pendurado na cabeça do documento. Isso é CSS em linha, que a CSP sem
   'unsafe-inline' recusa tal como recusa um atributo de estilo, por isso as
   regras passaram para o web/estilos.css, na secção «g12-novidades» das
   classes dos módulos — tal e qual, pela mesma ordem e com os mesmos
   comentários. */
