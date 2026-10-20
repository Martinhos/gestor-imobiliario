/* Selecionar vários movimentos e tratá-los de uma vez.
   ---------------------------------------------------
   O toque longo num movimento passa a entrar em modo de seleção, com esse já
   marcado; o «Selecionar vários» do cabeçalho entra sem nada marcado; e na
   tabela do ecrã largo as caixas estão sempre à vista, e marcar uma entra.
   As opções de um movimento sozinho (Editar, Apagar) estão na ficha.

   Em seleção há três níveis de marca: cada movimento, cada mês, e um global.
   O global e o do mês acompanham o scroll, senão a meio de uma lista de
   duzentos movimentos deixa de haver como marcar tudo sem voltar ao topo.

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
   O índice faz-se uma vez por chamada — marcar um mês ou tudo pede-o por cada
   linha.
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

// Entra em modo de seleção — opcionalmente já com um movimento marcado — e repinta a vista com as caixas.
// Recebe: id (opcional) — o id do movimento a marcar logo à entrada; ev (opcional) — o evento do
// toque na caixa de uma linha da tabela, para não abrir também a ficha.
// Devolve: nada — redesenha a vista.
CW.selEntrar = function (id, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  CW.selMode = true;
  selIds = {};
  if (id) selMarcar([id], true);   // a linha de um lote entra com o lote inteiro
  render();
};

/* A caixa de um mês, na tabela do ecrã largo, fora da seleção: entra já com
   esse mês marcado. As linhas leem-se do ecrã antes de repintar.
   Recebe: mo — o mês em "AAAA-MM"; ev (opcional) — o evento do toque.
   Devolve: nada — redesenha a vista. */
CW.selEntrarMes = function (mo, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var ids = selIdsDoMes(mo);
  CW.selMode = true;
  selIds = {};
  selMarcar(ids, true);
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

/* Marca ou desmarca um mês inteiro: se já estava todo marcado, limpa-o;
   senão marca o que faltar. Só conta o que está visível (filtros incluídos).
   Recebe: mo — o mês em "AAAA-MM"; ev (opcional) — o evento do toque, para lhe
   travar a propagação.
   Devolve: nada — repinta só as marcas. */
CW.selMes = function (mo, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var ids = selIdsDoMes(mo);
  var todos = ids.length && ids.every(selTem);
  selMarcar(ids, !todos);
  selPintar();
  selSairSeVazio();
};

// como o selMes, mas para todas as linhas visíveis: tudo marcado limpa, senão marca o que falta
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
// os ids visíveis de um mês ("AAAA-MM"), lidos das próprias linhas no DOM
// Recebe: mo — o mês em "AAAA-MM".
// Devolve: array com os ids (strings) das linhas visíveis desse mês.
function selIdsDoMes(mo) {
  return [].slice.call(document.querySelectorAll('#view .txrow[data-mes="' + mo + '"]'))
    .map(function (e) { return e.getAttribute('data-tx'); });
}

/* A lista viva (vistas.js:pintarListaTx) refaz linhas sem passar pelo render,
   e uma linha refeita nasce sem a marca que tinha. Fica exposto para ela o
   poder repor — é a mesma função que o render já chamava no fim. */
// Recebe: nada.
// Devolve: nada — repinta as marcas no DOM que estiver no ecra.
CW.selPintar = function () { selPintar(); };
// Repõe as marcas e as contagens a partir do estado, sem redesenhar a vista.
// Devolve: nada — mexe diretamente no DOM (caixas, contagem e cabeçalho).
function selPintar() {
  [].slice.call(document.querySelectorAll('#view .txrow[data-tx]')).forEach(function (e) {
    var on = selTem(e.getAttribute('data-tx'));
    e.classList.toggle('sel-on', on);
    if (e.setAttribute) e.setAttribute('aria-pressed', on ? 'true' : 'false');
    var c = e.querySelector('.selbox');
    if (c) c.innerHTML = caixa(on);
  });
  [].slice.call(document.querySelectorAll('#view [data-mes-box]')).forEach(function (e) {
    var ids = selIdsDoMes(e.getAttribute('data-mes-box'));
    var todos = ids.length > 0 && ids.every(selTem), algum = ids.some(selTem);
    e.innerHTML = caixa(todos, algum);
    if (e.setAttribute) e.setAttribute('aria-checked', todos ? 'true' : algum ? 'mixed' : 'false');
  });
  patchHdrSel();
}

/* A caixa de tudo e a contagem: no cabeçalho do telemóvel (patchHdrSel), na
   coluna das caixas da tabela ([data-sel-tudo]) e na barra das ações (a
   contagem, a soma e o «Apagar N»). Cheia com tudo o que está à vista
   marcado, a meio com parte. Sem nada marcado, as ações ficam paradas.
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
  if (bn) bn.textContent = n ? n + (n === 1 ? ' selecionado' : ' selecionados') : 'Nenhum selecionado';
  var bs = document.getElementById('selFundoSoma');
  if (bs) bs.textContent = n ? '· somam ' + selSomaTexto() : '· marca nas caixas';
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

   Agora substitui-se o ponto de extensão da linha (lista-movimentos.js:txLinhaExtra)
   e o do mês (lista-movimentos.js:txMesExtra).

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
  x.attrs = (x.attrs || '') + ' data-tx="' + esc(id) + '" data-mes="' + esc(mes || '') + '"';
  if (CW.selMode) {
    // a caixa entra à esquerda e o toque na linha passa a marcar
    x.caixa = (x.caixa || '') + '<span class="selbox" aria-hidden="true">' + caixa(selTem(id)) + '</span>';
    x.onclick = 'CW.selToggle(\'' + jsq(id) + '\',event)';
    x.attrs += ' data-toca="vista" aria-pressed="' + (selTem(id) ? 'true' : 'false') + '"';
    if (selTem(id)) x.cls = ((x.cls || '') + ' sel-on').trim();
  } else {
    x.caixa = (x.caixa || '') + '<span class="selbox fora" role="checkbox" aria-checked="false" aria-label="Selecionar «' +
      esc(t.label || 'movimento') + '»" data-toca="modo" data-click="CW.selEntrar(\'' + jsq(id) + '\',event)">' + caixa(false) + '</span>';
  }
  return x;
};

var _txMesExtra = txMesExtra;
txMesExtra = function (mes) {
  var x = _txMesExtra(mes) || {};
  if (!mes) return x;
  if (!CW.selMode) {
    /* a caixa do mês na tabela: entra na seleção com o mês marcado */
    x.caixa = (x.caixa || '') + '<span class="selbox mes fora" role="checkbox" aria-checked="false" aria-label="Selecionar ' +
      esc(mesPt(mes)) + '" data-toca="modo" data-click="CW.selEntrarMes(\'' + jsq(mes) + '\',event)">' + caixa(false) + '</span>';
    return x;
  }
  x.cls = ((x.cls || '') + ' sel-mes').trim();
  /* SEM style aqui: o título já leva um no template (vistas.js) e, com dois,
     o parser fica com o primeiro — o meu — e o display:flex morria. O cursor
     vai na folha, com o resto da regra .sel-mes. */
  x.attrs = (x.attrs || '') + ' data-toca="vista" data-click="CW.selMes(\'' + jsq(mes) + '\',event)"';
  x.caixa = (x.caixa || '') +
    '<span class="selbox mes" data-mes-box="' + esc(mes) + '" role="checkbox" aria-checked="false" aria-label="Marcar ' + esc(mesPt(mes)) +
    '" data-toca="vista" data-click="CW.selMes(\'' + jsq(mes) + '\',event)"></span>';
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

/* A barra das ações da seleção. No telemóvel desce para onde está o polegar —
   Cancelar, Editar e Apagar —, no lugar da barra de baixo; no ecrã largo é a
   barra do canvas (D-Movimentos), azul-noite: quantos estão marcados e quanto
   somam, «Mudar categoria», «Adicionar etiquetas» (com etiquetas definidas),
   «Apagar N» e o × que termina. Flutua no fundo, e não entre os totais e a
   tabela, onde o canvas a desenhou: aí empurrava a tabela ~56px ao primeiro
   visto, e a regra é que nada por cima da lista a empurre. A folha mostra as
   peças de cada um (estilos.css:.sel-fundo). A contagem, a soma e o número do
   «Apagar» enche-os a selCabPintar.
   Devolve: o HTML da barra (texto). */
function selBarraHtml() {
  var etiquetas = (db.settings && db.settings.tags || []).length;
  return '<div class="sel-fundo mov-sel" role="toolbar" aria-label="Seleção">' +
      '<p class="sel-info"><b id="selFundoN">Nenhum selecionado</b> <span id="selFundoSoma"></span></p>' +
      '<button type="button" class="btn sel-fim" aria-label="Cancelar a seleção" data-toca="modo" data-click="CW.selSair()">' + ic('x', 16) + '<span class="sel-fim-txt">Cancelar</span></button>' +
      '<span class="sel-espaco"></span>' +
      '<button type="button" class="btn sel-largo" data-precisa data-toca="camada" data-click="CW.selEditar(\'cat\')">Mudar categoria</button>' +
      (etiquetas ? '<button type="button" class="btn sel-largo" data-precisa data-toca="camada" data-click="CW.selEditar(\'tags\')">Adicionar etiquetas</button>' : '') +
      '<button type="button" class="btn sel-estreito" data-precisa data-toca="camada" data-click="CW.selEditar()">' + ic('pen', 15) + ' Editar</button>' +
      '<button type="button" class="btn danger" data-precisa data-toca="dados" data-risco="destroi" data-click="CW.selApagar()">' + ic('trash', 15) + '<span id="selFundoApagar">Apagar</span></button>' +
    '</div>';
}

var _vTransactions_sel = vTransactions;
vTransactions = function () {
  var html = _vTransactions_sel().replace('<span class="mov-cab-caixa"></span>', selCaixaTudoHtml());
  /* sem linhas não há nada para marcar — e sair daqui evita ficar com a barra
     de seleção viva por cima de um ecrã vazio */
  if (!txLinhasPintadas) { CW.selMode = false; return html; }
  if (!CW.selMode) return html;
  /* A caixa de tudo e a contagem vivem no cabeçalho do telemóvel
     (patchHdrSel), no lugar do título, e na coluna das caixas da tabela:
     numa barra por cima da lista empurravam-na ~64px para baixo ao entrar, e
     puxavam-na ao sair. As ações vão na barra do fundo. */
  return html + selBarraHtml();
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

/* Veste o cabeçalho dos Movimentos. Fora da seleção, o botão do cabeçalho é
   o «Selecionar vários» do canvas (M-Movimentos) — os filtros abrem-se no
   botão ao lado da pesquisa (lista-movimentos.js:txBarraHtml) —, e some sem
   linhas para marcar e na tabela do ecrã largo, onde as caixas já estão à
   vista (a folha: estilos.css:.mov-hdr-sel). Em seleção, o título dá lugar à
   caixa de tudo e à contagem (#selCab — a CSS esconde o título com o
   body.sel-on), colados ao topo como o cabeçalho, para se poder marcar tudo a
   meio da lista. O botão passa a "⋯" (as ações da seleção, CW.selAcoes), mas
   a folha esconde-o em seleção (estilos.css:body.sel-on #hdrFilt.mov-hdr-sel):
   a barra do fundo já tem o Cancelar, o Editar e o Apagar, e o «⋯» e o X que
   havia ao lado dele repetiam-nos. Noutro separador devolve o botão aos
   filtros — o render normal repõe o funil —, e nos Imóveis, nos Contratos e
   nos Planeados o cloud/selecao-listas.js veste-o a seguir com o seu
   «Selecionar vários» (selecao-listas.js:selLCabecalho, que embrulha esta).
   O ícone é a caixa com o visto (ic('caixaVisto'), o ☑), em todo o lado.
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
  if (!CW.selMode) {
    if (cab) cab.remove();
    hb.style.display = txLinhasPintadas ? '' : 'none';
    hb.innerHTML = ic('caixaVisto', 18);
    hb.title = 'Selecionar vários';
    hb.setAttribute('aria-label', 'Selecionar vários');
    hb.classList.remove('primary');
    return;
  }
  var tit = document.getElementById('pageTitle');
  if (!cab && tit && tit.parentNode) {
    cab = document.createElement('div');
    cab.id = 'selCab';
    cab.className = 'sel-cab';
    cab.innerHTML =
      '<span class="selbox" id="selGlobal" role="checkbox" aria-checked="false" aria-label="Marcar todos os movimentos à vista" data-toca="vista" data-click="CW.selTodos(event)">' + caixa(false) + '</span>' +
      '<span class="u-fx-1 u-minw-0 u-cur-pointer" data-toca="vista" data-click="CW.selTodos(event)"><b id="selConta">nenhum movimento</b>' +
      '<span class="small u-d-block">toca para marcar tudo</span></span>';
    tit.parentNode.insertBefore(cab, tit);
  }
  selCabPintar();
  hb.style.display = '';
  hb.innerHTML = ic('dots', 18);
  hb.title = 'O que fazer com a seleção';
  hb.setAttribute('aria-label', 'O que fazer com a seleção');
  /* sem o .primary: no cabeçalho do telemóvel o botão não tem fundo, e o
     texto do primário (branco) desaparecia; sem marcas, as ações avisam */
  hb.classList.remove('primary');
}

/* O cabeçalho repinta-se também pelo caminho curto da lista
   (lista-movimentos.js:refrescarMovimentos), que repõe o funil sem passar pelo
   render: fica exposto para ele.
   Devolve: nada — veste o cabeçalho (patchHdrSel). */
CW.selCabecalho = function () { patchHdrSel(); };

// Nos Movimentos o botão do cabeçalho é da seleção: fora dela entra («Selecionar
// vários»), dentro abre as ações. No resto continua a abrir os filtros.
// Devolve: nada.
var _hdrFiltToggle_sel = hdrFiltToggle;
hdrFiltToggle = function () {
  if (tab === 'transactions') return CW.selMode ? CW.selAcoes() : CW.selEntrar();
  return _hdrFiltToggle_sel();
};

/* O menu das ações da seleção: editar ou apagar o que está marcado (avisa
   se nada estiver marcado). O «⋯» do cabeçalho que o abria esconde-se em
   seleção (estilos.css:body.sel-on #hdrFilt.mov-hdr-sel), porque a barra do
   fundo já tem o Editar e o Apagar; o hdrFiltToggle continua a chamá-lo.
   Devolve: nada — abre a folha de opções (lpShow), ou um toast se nada estiver marcado. */
CW.selAcoes = function () {
  var n = selN();
  if (!n) return toast('Marca pelo menos um movimento.');
  lpShow(n + (n === 1 ? ' movimento marcado' : ' movimentos marcados'), [
    { label: 'Editar seleção', icon: 'pen', act: function () { CW.selEditar(); } },
    { label: 'Apagar seleção', icon: 'trash', act: function () { CW.selApagar(); } },
  ]);
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
  var antes = selAntesDoDeslize();
  var r = _render_sel.apply(this, arguments);
  patchHdrSel();
  document.body.classList.toggle('sel-on', !!CW.selMode);
  if (!CW.selMode && !(CW.selL && CW.selL.tipo)) {
    var f = document.querySelector('.sel-fundo');
    if (f) f.remove();
  }
  if (CW.selMode) selPintar();
  selDepoisDoDeslize(antes);
  return r;
};

/* ------------------------------------------- o deslize de entrar e sair */

/* Entrar na seleção repinta a vista, e o título de cada mês ganha a caixa
   à esquerda. O «set 2026» SALTAVA da esquerda para o meio de um fotograma
   para o outro, as caixas apareciam já feitas e o texto de cada linha dava
   um pulo para a direita. Agora o nome do mês desliza do sítio onde estava
   até ao meio, o corpo das linhas abre espaço a deslizar e as caixas (e a
   barra de cima, que leva a caixa de tudo) aparecem a desvanecer. Ao sair,
   o caminho inverso: o nome volta à esquerda, os corpos voltam ao sítio e
   as caixas que saíram desvanecem no lugar onde estavam, a acompanhar a
   linha ou o título de que eram.

   É o FLIP do continuidade.js, feito para estas peças, que não têm data-fk
   porque não são linhas: mede-se antes do render, repinta-se, e numa
   microtarefa — depois dos outros embrulhos do render e antes de o browser
   pintar — põe-se cada peça de volta no sítio antigo com um transform e
   deixa-se ir. Só transform e opacity, pela API de animações: no fim não
   fica nada no style de ninguém, nem no do título do mês, que em seleção é
   sticky; e uma repintura a meio deita fora os nós com as animações dentro.
   Como se mede o que está no ecrã, e não onde as peças deviam estar, sair a
   meio de uma entrada continua de onde o nome ia, em vez de saltar.

   Os tempos são os da continuidade (continuidade.js:aplicarContinuidade):
   o nome atravessa mais de cem pixeis e as linhas à volta dele deslizam com
   o --lento e a --curva-entra no mesmo render — com outro tempo, o título e
   as linhas chegavam cada um à sua hora. As caixas desvanecem no --medio.

   Só na MUDANÇA de modo (selModoPintado): marcar uma linha (selPintar), a
   lista viva (pintarListaTx) e a sincronização de fundo (um render sem
   mudar de modo) não voltam a animar. Com menos movimento pedido, nada. */

// o modo que a última pintura dos Movimentos mostrou: é a mudança dele que anima, e não cada render
var selModoPintado = false;
// as caixas que saíram e ainda desvanecem na camada de saída, para a mudança seguinte as levar já
var selFantasmas = [];

/* As caixas estão à vista fora da seleção — a tabela do ecrã largo, onde as
   .fora se mostram? Aí entrar e sair não as faz aparecer nem desaparecer: só
   mudam de marca, e não há nada a desvanecer.
   Devolve: true se alguma caixa .fora tem tamanho no ecrã. */
function selForaAVista() {
  return [].slice.call(document.querySelectorAll('#view .selbox.fora')).some(function (e) {
    var r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/* O corpo de uma linha: o que fica à direita da caixa e é empurrado por ela.
   Recebe: e — a linha (.txrow).
   Devolve: o elemento .txcorpo (lista-movimentos.js:txLinhaHtml), ou null. */
function selCorpo(e) {
  return e && e.querySelector ? e.querySelector('.txcorpo') : null;
}

/* Está mesmo no ecrã (o porPerto dá um ecrã de folga, e aqui não se quer):
   um título que estava lá em cima, fora da vista, e passa a colar-se ao topo
   não atravessa o ecrã para lá chegar. Com a janela sem altura tudo conta,
   como no porPerto.
   Recebe: r — um retângulo do getBoundingClientRect.
   Devolve: true se o retângulo toca na janela. */
function selNoEcra(r) {
  if (!r || (!r.width && !r.height)) return false;
  var h = window.innerHeight || 0;
  return !h || (r.bottom > 0 && r.top < h);
}

/* A opacidade a que uma peça está a ser pintada agora — a meio de um
   desvanecer é menos de 1, e quem sai parte daí.
   Recebe: e — o elemento.
   Devolve: um número de 0 a 1 (1 se não se souber). */
function selOpacidade(e) {
  try {
    var o = parseFloat(getComputedStyle(e).opacity);
    return isNaN(o) ? 1 : o;
  } catch (x) { return 1; }
}

/* Onde estão, antes do render, as peças que a mudança de modo mexe: o nome
   de cada mês (e o título dele, que pode subir ou descer), o corpo de cada
   linha e — se se está a sair — as caixas, que vão deixar de existir. Em coordenadas do documento, como o continuidade.js:ondeEsta,
   para um scroll entre medir e aplicar não virar deslocamento.
   Devolve: {meses, corpos, caixas} — meses e corpos por chave (o mês, o id
   da linha), caixas uma lista de {el, x, y, w, h, op, dono}. */
function selMedirDeslize() {
  var sy = window.pageYOffset || 0, m = { meses: {}, corpos: {}, caixas: [], tabela: !selModoPintado && selForaAVista() };
  // a caixa que sai, com o dono que ela acompanha
  var guardar = function (el, dono) {
    var r = el.getBoundingClientRect();
    if (selNoEcra(r)) m.caixas.push({ el: el, x: r.left, y: r.top + sy, w: r.width, h: r.height, op: selOpacidade(el), dono: dono });
  };
  [].slice.call(document.querySelectorAll('#view [data-mes-nome]')).forEach(function (e) {
    var k = e.getAttribute('data-mes-nome'), t = e.parentNode, rt = t.getBoundingClientRect(), rn = e.getBoundingClientRect();
    m.meses[k] = { x: rn.left, y: rn.top + rn.height / 2 + sy, vis: selNoEcra(rt) };
    var cx = selModoPintado && t.querySelector('[data-mes-box]');
    if (cx) guardar(cx, 'mes:' + k);
  });
  [].slice.call(document.querySelectorAll('#view .txrow[data-tx]')).forEach(function (e) {
    var id = e.getAttribute('data-tx'), c = selCorpo(e);
    if (c) m.corpos[id] = { x: c.getBoundingClientRect().left, y: e.getBoundingClientRect().top + sy };
    var cx = selModoPintado && e.querySelector('.selbox');
    if (cx) guardar(cx, 'tx:' + id);
  });
  return m;
}

/* Põe uma caixa que o render deitou fora de volta no ecrã, onde estava, e
   deixa-a desvanecer — a ir com a linha ou o título de que era, que estão a
   deslizar para o sítio novo. É o mesmo nó (não um clone), na camada de
   saída do continuidade.js, sem ids e surdo ao toque.
   Recebe: c — {el, x, y, w, h, op} do selMedirDeslize; dy — quanto o dono
   se moveu (px, 0 se não se move); o — {dur, curva, durF}, os tempos.
   Devolve: nada — o nó sai do documento quando acaba de desvanecer. */
function selFantasma(c, dy, o) {
  var e = c.el;
  if (!e || !e.animate || e.isConnected) return;
  semIds(e);
  e.style.position = 'fixed'; e.style.left = c.x + 'px'; e.style.top = (c.y - (window.pageYOffset || 0)) + 'px';
  e.style.width = c.w + 'px'; e.style.height = c.h + 'px'; e.style.margin = '0';
  e.style.boxSizing = 'border-box'; e.style.pointerEvents = 'none';
  camadaDeSaida().appendChild(e);
  selFantasmas.push(e);
  if (dy) e.animate([{ transform: 'none' }, { transform: 'translateY(' + dy + 'px)' }], { duration: o.dur, easing: o.curva, fill: 'forwards' });
  var an = e.animate([{ opacity: c.op }, { opacity: 0 }],
    { duration: o.durF, easing: tokenTexto('--curva-sai', 'cubic-bezier(.4,0,1,1)'), fill: 'forwards' });
  var fora = function () { try { e.remove(); } catch (x) {} };
  an.onfinish = fora;
  /* rede: num separador escondido a animação não corre e o onfinish nunca
     chega — a caixa ficava por cima do ecrã */
  setTimeout(fora, o.durF + 600);
}

/* Depois do render, numa microtarefa: cada peça volta ao sítio onde estava
   e desliza para o novo; ao entrar, as caixas e a barra aparecem; ao sair,
   as que saíram desvanecem (selFantasma). A caixa de tudo, no cabeçalho,
   entra com a animação da folha (estilos.css:.sel-cab).
   Recebe: antes — o selMedirDeslize de antes do render; entra — true ao
   entrar na seleção, false ao sair.
   Devolve: nada — só anima o que está à vista (continuidade.js:porPerto). */
function selAplicarDeslize(antes, entra) {
  if (!antes) return;
  var sy = window.pageYOffset || 0;
  var o = { dur: msDoToken('--lento', 340), curva: tokenTexto('--curva-entra', 'cubic-bezier(0,0,.2,1)'), durF: msDoToken('--medio', 200) };
  // quanto desceu (ou subiu) cada dono de caixa, para a caixa que sai ir com ele
  var mexeu = {};
  [].slice.call(document.querySelectorAll('#view [data-mes-nome]')).forEach(function (e) {
    var k = e.getAttribute('data-mes-nome'), a = antes.meses[k], t = e.parentNode;
    if (!a || !e.animate) return;
    var rt = t.getBoundingClientRect(), rn = e.getBoundingClientRect();
    if (!porPerto(rt)) return;
    /* a altura é a do NOME, e não a do topo do título: em seleção o título é
       mais alto (a caixa, o padding do sticky), e alinhado pelo topo o fundo
       dele tapava o cimo da primeira linha nos primeiros fotogramas */
    var dx = a.x - rn.left, dy = a.y - (rn.top + rn.height / 2 + sy);
    if (Math.abs(dx) >= 1) e.animate([{ transform: 'translateX(' + dx + 'px)' }, { transform: 'none' }], { duration: o.dur, easing: o.curva });
    /* o título acompanha as linhas, que o render já faz deslizar — só se se
       via antes e se vê agora (selNoEcra) */
    if (!a.vis || !selNoEcra(rt)) return;
    mexeu['mes:' + k] = 0;
    if (Math.abs(dy) >= 1 && t.animate) {
      t.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: o.dur, easing: o.curva });
      mexeu['mes:' + k] = -dy;
    }
  });
  [].slice.call(document.querySelectorAll('#view .txrow[data-tx]')).forEach(function (e) {
    var id = e.getAttribute('data-tx'), a = antes.corpos[id], c = selCorpo(e);
    if (!a || !c || !c.animate) return;
    var r = e.getBoundingClientRect();
    if (!porPerto(r)) return;
    // a linha em si é da continuidade (data-fk); aqui só o corpo, de lado
    mexeu['tx:' + id] = r.top + sy - a.y;
    var dx = a.x - c.getBoundingClientRect().left;
    if (Math.abs(dx) >= 1) {
      c.animate([{ transform: 'translateX(' + dx + 'px)' }, { transform: 'none' }], { duration: o.dur, easing: o.curva });
      /* o quadrado do ícone (lista-movimentos.js:txLinhaHtml) está entre a
         caixa e o corpo, e é empurrado o mesmo: desliza com ele, senão saltava */
      var ic = e.querySelector('.ic');
      if (ic && ic.animate) ic.animate([{ transform: 'translateX(' + dx + 'px)' }, { transform: 'none' }], { duration: o.dur, easing: o.curva });
    }
  });
  if (entra) {
    /* na tabela as caixas já se viam: só mudam de marca, não aparecem */
    if (antes.tabela) return;
    [].slice.call(document.querySelectorAll('#view .selbox')).forEach(function (e) {
      if (!e.animate || !porPerto(e.getBoundingClientRect())) return;
      e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: o.durF, easing: o.curva });
    });
    return;
  }
  /* ao sair na tabela as caixas ficam (as .fora): nenhuma desaparece */
  if (selForaAVista()) return;
  antes.caixas.forEach(function (c) {
    /* uma caixa cujo dono desapareceu (apagado) ou foi para longe sai sem
       fantasma: o que o dono tinha, a continuidade já o desvanece */
    if (!(c.dono in mexeu)) return;
    selFantasma(c, mexeu[c.dono], o);
  });
}

/* Antes do render: se o modo que se vai pintar não é o que está no ecrã,
   mede as peças. Só nos Movimentos e só nessa mudança — nas outras
   repinturas não mede nada, e assim também não anima nada.
   Devolve: o selMedirDeslize, ou null quando não há mudança a mostrar. */
function selAntesDoDeslize() {
  if (tab !== 'transactions' || !!CW.selMode === selModoPintado || semMovimento()) return null;
  try { return selMedirDeslize(); } catch (e) { return null; }
}

/* Depois do render: grava o modo que ficou no ecrã e, se mudou mesmo (o
   vTransactions sai da seleção sozinho numa lista vazia), anima a mudança
   numa microtarefa — a mesma janela do render (vistas.js:render), depois de
   todos os embrulhos e antes de o browser pintar.
   Recebe: antes — o que o selAntesDoDeslize mediu (ou null).
   Devolve: nada. */
function selDepoisDoDeslize(antes) {
  var agora = !!CW.selMode && tab === 'transactions', mudou = agora !== selModoPintado;
  selModoPintado = agora;
  if (!mudou || !antes || tab !== 'transactions') return;
  // uma mudança nova leva já as caixas da anterior, que ainda desvaneciam
  selFantasmas.splice(0).forEach(function (e) { try { e.remove(); } catch (x) {} });
  Promise.resolve().then(function () {
    try { selAplicarDeslize(antes, agora); } catch (e) { /* animar nunca parte a vista */ }
  });
}

/* A folha da seleção (a caixa de marcar, as barras do topo e do fundo, o
   kebab da linha) era feita aqui, num elemento de folha criado por JavaScript
   e pendurado na cabeça do documento. Isso é CSS em linha, que a CSP sem
   'unsafe-inline' recusa tal como recusa um atributo de estilo, por isso as
   regras passaram para o web/estilos.css, na secção «g12-novidades» das
   classes dos módulos — tal e qual, pela mesma ordem e com os mesmos
   comentários. */
