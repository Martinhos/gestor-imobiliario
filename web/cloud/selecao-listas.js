/* Selecionar vários — imóveis, contratos, planeados e modelos.
   ----------------------------------------
   Nos imóveis, nos contratos, nos planeados e nos modelos o toque longo
   seleciona vários, como nos movimentos: entra na seleção com o tocado já
   marcado (CW.selLEntrar). Apagar em massa faz sentido aí — e apagar um
   imóvel arrasta os contratos e movimentos dele, por isso a confirmação diz
   os números e o Anular repõe tudo. As opções de um só ficam no ⋯ da ficha
   (e na folha do lpMenu, com o «Selecionar vários»).

   Nos Planeados há dois tipos no mesmo separador, os planeados ('rec') e os
   modelos ('tpl'), e seleciona-se um OU outro: entrar com um tipo esquece o
   outro, e os cartões do outro ficam atenuados (CW.selLOutro). A barra de
   baixo tem, nos planeados, Silenciar ou Reativar além do Apagar. As regras de
   cada planeado — quem pode, o que um automático arrasta — são as de
   planeados.js (recMudarVarios, recApagarVarios), as mesmas do skipRec e do
   delRec.

   A porta à vista é o «Selecionar vários» do cabeçalho, a caixa com o visto
   (ic('caixaVisto'), o ☑), como nos Movimentos (selLCabecalho). Em seleção,
   o toque longo marca, como o toque.

   Vive no âmbito global, como os outros ficheiros da camada, com o
   comentário de interface em cada função: dentro de um IIFE, nem o gerador
   dos docs nem a CI as viam. A caixa de marcar é a de selecao.js. */
'use strict';

var TABS_SEL = { prop: 'properties', ct: 'contracts', rec: 'recurring', tpl: 'recurring' };   // o tipo do cartão → o separador onde há seleção
// os tipos dos Planeados: a barra deles (selLBarraHtml, estilos.css:.sel-l-plan) e a porta da seleção na própria folha das opções (planeados.js:lpPortaSelecao)
var SEL_PLAN = { rec: 1, tpl: 1 };

CW.selL = { tipo: null, ids: {} };
// a seleção acabou de começar: as caixas postas a seguir entram a desvanecer (selLDecorar)
var selLEntrou = false;

// Entra na seleção de vários cartões de um tipo, com o tocado já marcado.
// Num separador com dois tipos (os Planeados) esquece o que estava marcado do outro.
// Recebe: tipo — 'prop', 'ct', 'rec' ou 'tpl'; id (opcional) — o id do cartão tocado.
// Devolve: nada — marca e repinta (ou nada, fora do separador desse tipo).
CW.selLEntrar = function (tipo, id) {
  if (tab !== TABS_SEL[tipo]) return;
  CW.selL = { tipo: tipo, ids: {} };
  if (id) CW.selL.ids[id] = 1;
  selLEntrou = true;
  render();
};
// Sai da seleção de vários.
// Devolve: nada — esquece o que estava marcado e repinta.
CW.selLSair = function () { CW.selL = { tipo: null, ids: {} }; render(); };
// Marca ou desmarca um cartão.
// Recebe: id — o id do cartão.
// Devolve: nada — repinta as caixas e a contagem.
CW.selLToggle = function (id) {
  if (CW.selL.ids[id]) delete CW.selL.ids[id]; else CW.selL.ids[id] = 1;
  selLPintar();
};

// Quantos cartões estão marcados.
// Devolve: o número.
function selLN() { return Object.keys(CW.selL.ids).length; }

/* O toque longo, redirecionado de vez: os movimentos, os imóveis, os
   contratos, os planeados e os modelos entram em seleção com o tocado já
   marcado — o mesmo gesto em toda a app. Já em seleção, marca ou desmarca,
   como o toque (CW.selLTocar). O resto não faz nada — as opções de um só
   vivem no ⋯ da ficha (nos planeados, planeados.js:recView; nos modelos,
   planeados.js:tplView).
   Recebe: v — o data-lp tocado ('tx:<id>', 'prop:<id>', 'rec:<id>', …).
   Devolve: nada — entra em seleção, ou marca. */
window.lpLongo = function (v) {
  var a = String(v || '').split(':');
  if (a[0] === 'tx' && tab === 'transactions' && CW.selEntrar) return CW.selEntrar(a[1]);
  if (!TABS_SEL[a[0]]) return;
  if (CW.selL.tipo && tab === TABS_SEL[a[0]]) return CW.selLTocar(a[0], a[1]);
  return CW.selLEntrar(a[0], a[1]);
};

/* Um cartão tocado (ou segurado) em seleção: o do tipo em seleção marca ou
   desmarca; o do outro tipo do mesmo separador vai ao CW.selLOutro.
   Recebe: tipo — o tipo do cartão; id — o id dele.
   Devolve: nada. */
CW.selLTocar = function (tipo, id) {
  if (!CW.selL.tipo) return;
  if (tipo === CW.selL.tipo) return CW.selLToggle(id);
  return CW.selLOutro(tipo, id);
};

/* Tocar num cartão do outro tipo, em seleção (um modelo enquanto se marcam
   planeados, ou o contrário): ou um ou outro, nunca os dois. Sem nada
   marcado, a seleção passa a esse tipo com ele marcado; com marcas, diz
   porquê e não as deita fora.
   Recebe: tipo — o tipo do cartão tocado; id — o id dele.
   Devolve: nada — muda de tipo, ou avisa. */
CW.selLOutro = function (tipo, id) {
  if (!CW.selL.tipo || tipo === CW.selL.tipo) return;
  if (!selLN()) return CW.selLEntrar(tipo, id);
  var este = (SEL_NOMES[CW.selL.tipo] || [])[1] || 'registos', outro = (SEL_NOMES[tipo] || [])[1] || 'registos';
  toast('Seleciona ' + este + ' ou ' + outro + ', não os dois: desmarca os ' + este + ' para escolheres ' + outro + '.');
};

/* Os tipos dos cartões que se selecionam num separador (o TABS_SEL ao
   contrário): um nos Imóveis e nos Contratos, dois nos Planeados.
   Recebe: t — o separador ('properties', 'contracts', 'recurring', …).
   Devolve: array de tipos, vazio onde não há seleção de vários. */
function selLTiposDe(t) {
  var ts = [];
  for (var k in TABS_SEL) if (TABS_SEL[k] === t) ts.push(k);
  return ts;
}

/* O tipo de seleção de um separador: em seleção, o que está; fora dela, o
   primeiro com cartões à vista (nos Planeados, os planeados; sem eles, os
   modelos) — é com esse que o «Selecionar vários» do cabeçalho entra.
   Recebe: t — o separador.
   Devolve: 'prop', 'ct', 'rec', 'tpl', ou null onde não há seleção de vários. */
function selLTipoDe(t) {
  var ts = selLTiposDe(t);
  if (!ts.length) return null;
  if (CW.selL.tipo && ts.indexOf(CW.selL.tipo) > -1) return CW.selL.tipo;
  if (ts.length > 1) for (var i = 0; i < ts.length; i++) if (document.querySelector('#view [data-lp^="' + ts[i] + ':"]')) return ts[i];
  return ts[0];
}

/* Há cartões à vista que se possam marcar neste separador?
   Recebe: t — o separador.
   Devolve: true se há algum cartão de um dos tipos dele no #view. */
function selLHaCartoes(t) {
  return selLTiposDe(t).some(function (k) { return !!document.querySelector('#view [data-lp^="' + k + ':"]'); });
}

// o nome dos cartões de cada tipo, no singular e no plural, para a contagem do cabeçalho
var SEL_NOMES = { prop: ['imóvel', 'imóveis'], ct: ['contrato', 'contratos'], rec: ['planeado', 'planeados'], tpl: ['modelo', 'modelos'] };

/* O cabeçalho dos Imóveis, dos Contratos e dos Planeados segue o dos
   Movimentos (cloud/selecao.js:patchHdrSel). Fora da seleção, o botão do
   cabeçalho é o «Selecionar vários», com a mesma caixa com o visto (o ☑) e o
   mesmo nome — os filtros abrem-se no funil ao lado da pesquisa
   (vistas.js:lfCabeca) —, e some sem cartões à vista, que não há o que
   marcar. Nos Planeados a base não pinta o botão (vistas.js:LF_COM_CABECALHO
   não os tem): quem o mostra é esta função, que corre depois. Em seleção, o título dá lugar à caixa de
   tudo e à contagem (#selLCab, a .sel-cab dos Movimentos), e a folha esconde
   o botão (estilos.css:body.sel-on #hdrFilt.lst-hdr-sel): a barra de baixo já
   tem o Cancelar e o Apagar. Noutro separador devolve o botão a quem o pinta
   (vistas.js:pintarBotaoFiltros e o cloud/painel.js:patchHdr). Corre depois
   deles: no fim do patchHdrSel, que o render da seleção chama e o caminho
   curto das listas também (CW.selCabecalho).
   Devolve: nada — mexe no cabeçalho, no DOM. */
function selLCabecalho() {
  var hb = document.getElementById('hdrFilt');
  if (!hb) return;
  var tipo = selLTipoDe(tab);
  var cab = document.getElementById('selLCab');
  if (cab && (!tipo || CW.selL.tipo !== tipo)) cab.remove();
  if (tipo && CW.selL.tipo === tipo) selLCabNovo(tipo);
  if (!tipo) {
    if (hb.classList.contains('lst-hdr-sel')) {
      hb.classList.remove('lst-hdr-sel');
      hb.title = hb.getAttribute('data-titulo') || 'Filtros e parâmetros';
      hb.removeAttribute('aria-label');
    }
    return;
  }
  hb.classList.add('lst-hdr-sel');
  hb.classList.remove('primary');
  hb.removeAttribute('aria-expanded');
  hb.innerHTML = ic('caixaVisto', 18);
  hb.title = 'Selecionar vários';
  hb.setAttribute('aria-label', 'Selecionar vários');
  hb.style.display = selLHaCartoes(tab) ? '' : 'none';
}

/* Põe no lugar do título, em seleção, a caixa de tudo e a contagem — a
   .sel-cab dos Movimentos, com um id seu. Já posta, só a repinta (o nome da
   caixa de tudo acompanha o tipo: selLPintar).
   Recebe: tipo — 'prop', 'ct', 'rec' ou 'tpl'.
   Devolve: nada — mexe no cabeçalho, no DOM. */
function selLCabNovo(tipo) {
  var tit = document.getElementById('pageTitle');
  if (!document.getElementById('selLCab') && tit && tit.parentNode) {
    var cab = document.createElement('div');
    cab.id = 'selLCab';
    cab.className = 'sel-cab lst-sel-cab';
    cab.innerHTML =
      '<span class="selbox" id="selLTudo" role="checkbox" tabindex="0" aria-checked="false" aria-label="Marcar todos os ' + SEL_NOMES[tipo][1] + ' à vista" data-toca="vista" data-click="CW.selLTodos(event)">' + caixa(false) + '</span>' +
      '<span class="u-fx-1 u-minw-0 u-cur-pointer" data-toca="vista" data-click="CW.selLTodos(event)"><b id="selLCabConta"></b>' +
      '<span class="small u-d-block">toca para marcar tudo</span></span>';
    tit.parentNode.insertBefore(cab, tit);
  }
  selLPintar();
}

/* A caixa de tudo do cabeçalho: marca os cartões todos à vista (os que os
   filtros deixam) ou, com todos marcados, desmarca-os.
   Recebe: ev (opcional) — o evento do toque, que não segue para baixo.
   Devolve: nada — marca e repinta as caixas e a contagem. */
CW.selLTodos = function (ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var ids = selLCartoes().map(function (c) { return c.getAttribute('data-lp').split(':')[1]; });
  var todos = ids.length && ids.every(function (id) { return CW.selL.ids[id]; });
  ids.forEach(function (id) { if (todos) delete CW.selL.ids[id]; else CW.selL.ids[id] = 1; });
  selLPintar();
};

/* o «Selecionar vários» das listas veste-se onde o dos Movimentos se veste:
   no fim do patchHdrSel, que corre depois de cada render e pelo caminho curto */
var _patchHdrSel_sl = patchHdrSel;
patchHdrSel = function () {
  _patchHdrSel_sl();
  selLCabecalho();
};

// Nos Imóveis, nos Contratos e nos Planeados o botão do cabeçalho é da
// seleção: fora dela entra, sem nada marcado (o toque a seguir marca; nos
// Planeados, com os planeados — ou os modelos, sem planeados à vista); dentro,
// sai. No resto continua a fazer o que fazia.
// Devolve: nada.
var _hdrFiltToggle_sl = hdrFiltToggle;
hdrFiltToggle = function () {
  var tipo = selLTipoDe(tab);
  if (tipo) return CW.selL.tipo ? CW.selLSair() : CW.selLEntrar(tipo);
  return _hdrFiltToggle_sl();
};

/* depois de cada render, decora os cartões e põe a barra de baixo */
var _render_sl = render;
render = function () {
  var r = _render_sl.apply(this, arguments);
  var ativo = CW.selL.tipo && tab === TABS_SEL[CW.selL.tipo];
  if (CW.selL.tipo && !ativo) CW.selL = { tipo: null, ids: {} };   // mudou de ecrã: sai
  var algum = !!ativo || (CW.selMode && tab === 'transactions');
  document.body.classList.toggle('sel-on', algum);
  // a seleção destas listas tem a caixa de tudo no cabeçalho também no ecrã largo (estilos.css:.lst-sel-cab)
  document.body.classList.toggle('lst-sel', !!ativo);
  if (!algum) {
    var f = document.querySelector('.sel-fundo');
    if (f) f.remove();
  }
  if (ativo) selLDecorar();
  return r;
};

// Os cartões do tipo em seleção que estão na vista.
// Devolve: array de elementos com data-lp «<tipo>:<id>».
function selLCartoes() {
  return [].slice.call(document.querySelectorAll('#view [data-lp^="' + CW.selL.tipo + ':"]'));
}

// Põe a caixa em cada cartão do tipo em seleção (um toque passa a marcar —
// e ao entrar as caixas desvanecem: selLEntrou), atenua os do outro tipo do
// mesmo separador (CW.selLOutro) e põe a barra de baixo, a do tipo
// (selLBarraHtml): mudar de tipo troca-a.
// Devolve: nada — mexe no DOM já desenhado.
function selLDecorar() {
  var tipo = CW.selL.tipo;
  selLCartoes().forEach(function (c) {
    var id = c.getAttribute('data-lp').split(':')[1];
    if (!c.querySelector('.selbox')) {
      var b = document.createElement('span');
      b.className = 'selbox' + (selLEntrou ? ' sel-entra' : '');
      b.setAttribute('data-selbox', id);
      b.setAttribute('aria-hidden', 'true');   // o estado diz-se no cartão (aria-pressed, selLPintar)
      var alvo = c.querySelector('.row-between') || c;
      alvo.insertBefore(b, alvo.firstChild);
    }
    c.setAttribute('data-toca', 'vista');
    c.setAttribute('data-click', 'CW.selLToggle(\'' + jsqBruto(id) + '\')');
  });
  selLTiposDe(tab).forEach(function (k) {
    if (k === tipo) return;
    [].slice.call(document.querySelectorAll('#view [data-lp^="' + k + ':"]')).forEach(function (c) {
      var id = c.getAttribute('data-lp').split(':')[1];
      c.classList.add('sel-fora');
      c.setAttribute('data-toca', 'vista');
      c.setAttribute('data-click', 'CW.selLOutro(\'' + k + '\',\'' + jsqBruto(id) + '\')');
    });
  });
  selLEntrou = false;
  var f = document.querySelector('.sel-fundo');
  if (f && f.getAttribute('data-sel-tipo') !== tipo) { f.remove(); f = null; }
  if (!f) {
    f = document.createElement('div');
    f.className = 'sel-fundo' + (SEL_PLAN[tipo] ? ' sel-l-plan' : '');
    f.setAttribute('data-sel-tipo', tipo);
    // a mesma barra dos movimentos (estilos.css:.sel-fundo): no ecrã largo, azul-noite a flutuar no fundo
    f.setAttribute('role', 'toolbar');
    f.setAttribute('aria-label', 'Seleção');
    f.innerHTML = selLBarraHtml(tipo);
    document.body.appendChild(f);
  }
  selLPintar();
}

/* O que vai na barra de baixo de cada tipo. Imóveis e contratos: Cancelar,
   a contagem e Apagar. Planeados: o Cancelar (só o × no telemóvel estreito,
   com o nome por extenso), a razão de não haver Silenciar nem Reativar
   quando os marcados estão misturados (#selLPorque, que o leitor de ecrã
   ouve), o Silenciar ou o Reativar (#selLMudo, que o selLPintar acerta) e o
   Apagar; os modelos, sem o silêncio, que não têm. A contagem dos planeados
   vive no cabeçalho, e na barra só no ecrã largo (estilos.css:.sel-l-plan).
   Recebe: tipo — 'prop', 'ct', 'rec' ou 'tpl'.
   Devolve: o HTML de dentro da barra (texto). */
function selLBarraHtml(tipo) {
  var apagar = '<button type="button" class="btn danger" data-toca="dados" data-risco="destroi" data-click="CW.selLApagar()">' + ic('trash', 15) + ' Apagar</button>';
  if (!SEL_PLAN[tipo]) {
    return '<button type="button" class="btn" data-toca="modo" data-click="CW.selLSair()">' + ic('x', 15) + ' Cancelar</button>' +
      '<b id="selLConta" class="u-fx-1 u-ta-center"></b>' + apagar;
  }
  return '<button type="button" class="btn sel-l-cancelar" aria-label="Cancelar a seleção" data-toca="modo" data-click="CW.selLSair()">' + ic('x', 15) + '<span class="sel-l-txt">Cancelar</span></button>' +
    '<p class="sel-l-info"><b id="selLConta"></b><span id="selLPorque" class="small" aria-live="polite"></span></p>' +
    (tipo === 'rec' ? '<button type="button" class="btn" id="selLMudo" hidden data-toca="dados" data-click="CW.selLMudo()"></button>' : '') +
    apagar;
}

// Pinta as caixas (a de selecao.js), a caixa de tudo do cabeçalho e as
// contagens conforme o que está marcado.
// Devolve: nada — mexe no DOM já desenhado.
function selLPintar() {
  var ids = [];
  selLCartoes().forEach(function (c) {
    var id = c.getAttribute('data-lp').split(':')[1];
    ids.push(id);
    var b = c.querySelector('[data-selbox]');
    if (b) b.innerHTML = caixa(!!CW.selL.ids[id]);
    c.classList.toggle('sel-on-card', !!CW.selL.ids[id]);
    // o leitor de ecrã ouve marcado ou não, no próprio cartão (um botão: tornarFocavel)
    if (c.setAttribute) c.setAttribute('aria-pressed', CW.selL.ids[id] ? 'true' : 'false');
  });
  var n = selLN(), conta = document.getElementById('selLConta');
  if (conta) conta.textContent = n ? n + ' selecionado' + (n === 1 ? '' : 's') : 'toca nos cartões';
  var marcados = ids.filter(function (id) { return CW.selL.ids[id]; }).length;
  var todos = ids.length > 0 && marcados === ids.length, algum = marcados > 0;
  var g = document.getElementById('selLTudo');
  var nomes = SEL_NOMES[CW.selL.tipo] || ['registo', 'registos'];
  if (g) {
    g.innerHTML = caixa(todos, algum);
    g.setAttribute('aria-checked', todos ? 'true' : algum ? 'mixed' : 'false');
    g.setAttribute('aria-label', 'Marcar todos os ' + nomes[1] + ' à vista');
  }
  var cc = document.getElementById('selLCabConta');
  if (cc) cc.textContent = n ? n + ' ' + nomes[n === 1 ? 0 : 1] : 'nenhum ' + nomes[0];
  if (CW.selL.tipo === 'rec') selLPintarMudo();
}

/* O Silenciar ou o Reativar da barra dos planeados, conforme os marcados
   (planeados.js:recMudoDaSelecao): todos ativos, Silenciar; todos
   silenciados, Reativar; misturados, nenhum, e a razão dita ao lado; sem
   nada marcado, nenhum e calado.
   Devolve: nada — mexe na barra já posta. */
function selLPintarMudo() {
  var mudo = document.getElementById('selLMudo'), pq = document.getElementById('selLPorque');
  var modo = typeof recMudoDaSelecao === 'function' ? recMudoDaSelecao(Object.keys(CW.selL.ids)) : '';
  if (mudo) {
    mudo.hidden = modo !== 'silenciar' && modo !== 'reativar';
    mudo.innerHTML = modo === 'reativar' ? ic('bell', 15) + ' Reativar' : ic('clock', 15) + ' Silenciar';
  }
  if (pq) pq.textContent = modo === 'misto' ? 'Ativos e silenciados: escolhe só uns para silenciar ou reativar.' : '';
}

/* Silencia ou reativa os planeados marcados, de uma vez, com o Anular: as
   regras de quem pode são as do skipRec (planeados.js:recMudarVarios); os
   que não posso ficam como estão, e o aviso conta-os.
   Devolve: nada — grava, sai da seleção e oferece o Anular (ou avisa). */
CW.selLMudo = function () {
  if (CW.selL.tipo !== 'rec' || typeof recMudarVarios !== 'function') return;
  var ids = Object.keys(CW.selL.ids), modo = recMudoDaSelecao(ids);
  if (!modo) return toast('Não está nada selecionado.');
  if (modo === 'misto') return toast('Há ativos e silenciados: escolhe só uns para silenciar ou reativar.');
  var r = recMudarVarios(ids, modo === 'silenciar');
  if (!r.feitos.length) return toast(r.recusa);
  save(); CW.selLSair(); buildNav();
  var n = r.feitos.length, um = n === 1;
  var msg = n + (um ? ' planeado ' : ' planeados ') + (modo === 'silenciar'
    ? (um ? 'silenciado: fica' : 'silenciados: ficam') + ' à espera de confirmação, sem avisos.'
    : (um ? 'reativado: volta' : 'reativados: voltam') + ' a avisar.');
  comDesfazer(msg + selLFora(r.fora), function () { recMudoRepor(r.antes); });
};

/* Os que ficaram de fora de uma ação em massa por falta de permissão, numa
   frase para o fim do aviso.
   Recebe: n — quantos.
   Devolve: ' 1 ficou de fora: sem permissão.' (texto), ou '' com zero. */
function selLFora(n) {
  return n ? ' ' + n + (n === 1 ? ' ficou' : ' ficaram') + ' de fora: sem permissão.' : '';
}

/* O que vai junto com os imóveis apagados, dito com os números e o plural
   certo: «Vão junto 2 contratos e 5 movimentos.», «Vai junto 1 contrato.»,
   ou «Sem contratos nem movimentos ligados.».
   Recebe: nc — quantos contratos; nt — quantos movimentos.
   Devolve: a frase (texto). */
function selLVaoJunto(nc, nt) {
  var partes = [];
  if (nc) partes.push(nc + (nc === 1 ? ' contrato' : ' contratos'));
  if (nt) partes.push(nt + (nt === 1 ? ' movimento' : ' movimentos'));
  if (!partes.length) return 'Sem contratos nem movimentos ligados.';
  return (nc + nt === 1 ? 'Vai junto ' : 'Vão junto ') + partes.join(' e ') + '.';
}

/* Apagar em massa, com os números à vista e o Anular por baixo: um imóvel
   arrasta os contratos e os movimentos dele; um contrato deixa os movimentos,
   só desligados.
   Devolve: nada — pede confirmação; só depois apaga e oferece o Anular. */
CW.selLApagar = function () {
  var ids = Object.keys(CW.selL.ids);
  if (!ids.length) return toast('Não está nada selecionado.');
  var tipo = CW.selL.tipo;
  if (tipo === 'rec') return selLApagarPlaneados(ids);
  if (tipo === 'tpl') return selLApagarModelos(ids);

  if (tipo === 'prop') {
    var cts = db.contracts.filter(function (c) { return ids.indexOf(c.propertyId) > -1; });
    var txs = db.transactions.filter(function (t) { return ids.indexOf(t.propertyId) > -1; });
    confirmModal('Apagar ' + ids.length + (ids.length === 1 ? ' imóvel' : ' imóveis'),
      selLVaoJunto(cts.length, txs.length),
      function () {
        var copia = {
          ps: JSON.parse(JSON.stringify(db.properties.filter(function (p) { return ids.indexOf(p.id) > -1; }))),
          cts: JSON.parse(JSON.stringify(cts)),
          txs: JSON.parse(JSON.stringify(txs)),
        };
        db.properties = db.properties.filter(function (p) { return ids.indexOf(p.id) < 0; });
        db.contracts = db.contracts.filter(function (c) { return ids.indexOf(c.propertyId) < 0; });
        db.transactions = db.transactions.filter(function (t) { return ids.indexOf(t.propertyId) < 0; });
        if (ids.indexOf(dashProp) > -1) dashProp = '';
        if (ids.indexOf(txProp) > -1) txProp = '';
        save(); CW.selLSair(); buildNav();
        comDesfazer(ids.length + (ids.length === 1 ? ' imóvel apagado.' : ' imóveis apagados.'), function () {
          db.properties = db.properties.concat(copia.ps);
          db.contracts = db.contracts.concat(copia.cts);
          db.transactions = db.transactions.concat(copia.txs);
        }, function () {
          copia.ps.forEach(function (p) {
            (p.photos || []).forEach(function (f) { idbDel(f.id).catch(function () {}); idbDel('tn_' + f.id).catch(function () {}); });
            (p.loans || []).forEach(function (l) { (l.files || []).forEach(function (f) { idbDel(f.id).catch(function () {}); }); });
          });
        });
      });
    return;
  }

  // contratos: os movimentos ficam, só se desligam
  var recs = (db.recurring || []).filter(function (r) { return r.auto && r.tx && ids.indexOf(r.tx.contractId) > -1; });
  confirmModal('Apagar ' + ids.length + (ids.length === 1 ? ' contrato' : ' contratos'),
    'Os movimentos ficam, mas deixam de estar ligados a eles.',
    function () {
      var copia = {
        cs: JSON.parse(JSON.stringify(db.contracts.filter(function (c) { return ids.indexOf(c.id) > -1; }))),
        recs: JSON.parse(JSON.stringify(recs)),
        ligados: db.transactions.filter(function (t) { return ids.indexOf(t.contractId) > -1; })
          .map(function (t) { return { id: t.id, ct: t.contractId }; }),
      };
      db.contracts = db.contracts.filter(function (c) { return ids.indexOf(c.id) < 0; });
      db.recurring = (db.recurring || []).filter(function (r) { return !(r.auto && r.tx && ids.indexOf(r.tx.contractId) > -1); });
      db.transactions.forEach(function (t) { if (ids.indexOf(t.contractId) > -1) t.contractId = null; });
      save(); CW.selLSair(); buildNav();
      comDesfazer(ids.length + (ids.length === 1 ? ' contrato apagado.' : ' contratos apagados.'), function () {
        db.contracts = db.contracts.concat(copia.cs);
        db.recurring = (db.recurring || []).concat(copia.recs);
        copia.ligados.forEach(function (x) {
          var t = db.transactions.find(function (y) { return y.id === x.id; });
          if (t) t.contractId = x.ct;
        });
      }, function () {
        copia.cs.forEach(function (c) { (c.files || []).forEach(function (f) { idbDel(f.id).catch(function () {}); }); });
      });
    });
};

/* Apagar vários planeados: a confirmação diz o que os automáticos arrastam e
   quantos ficam de fora (planeados.js:recApagarFrase); apaga com as regras
   do delRec (planeados.js:recApagarVarios) e o Anular repõe tudo, os autoRec
   e os valores da ficha do imóvel incluídos (recRepor). Sem nenhum que possa
   apagar, diz porquê e não pergunta nada.
   Recebe: ids — os ids marcados (array).
   Devolve: nada — pede confirmação; só depois apaga e oferece o Anular. */
function selLApagarPlaneados(ids) {
  if (typeof recApagarVarios !== 'function') return;
  var pode = recPodeApagar(ids);
  if (!pode.ok.length) return toast(pode.recusa || 'Não está nada selecionado.');
  var n = pode.ok.length;
  confirmModal('Apagar ' + n + (n === 1 ? ' planeado' : ' planeados'), recApagarFrase(ids), function () {
    var r = recApagarVarios(ids);
    if (!r.feitos.length) return toast(r.recusa);
    save(); CW.selLSair(); buildNav();
    var k = r.feitos.length;
    comDesfazer(k + (k === 1 ? ' planeado apagado.' : ' planeados apagados.') + selLFora(r.fora), function () {
      r.desfaz.slice().reverse().forEach(function (d) { recRepor(d); });
    });
  });
}

/* Apagar vários modelos, como o delTpl a cada um (planeados.js:tplApagarVarios):
   os movimentos criados a partir deles ficam. Com o Anular.
   Recebe: ids — os ids marcados (array).
   Devolve: nada — pede confirmação; só depois apaga e oferece o Anular. */
function selLApagarModelos(ids) {
  if (typeof tplApagarVarios !== 'function') return;
  var n = ids.length;
  confirmModal('Apagar ' + n + (n === 1 ? ' modelo' : ' modelos'),
    'Os movimentos criados a partir ' + (n === 1 ? 'dele' : 'deles') + ' ficam.', function () {
      var copia = tplApagarVarios(ids);
      save(); CW.selLSair(); buildNav();
      comDesfazer(copia.length + (copia.length === 1 ? ' modelo apagado.' : ' modelos apagados.'), function () {
        var ha = {};
        (db.templates || []).forEach(function (x) { ha[x.id] = 1; });
        db.templates = (db.templates || []).concat(copia.filter(function (x) { return !ha[x.id]; }));
      });
    });
}

// a folha das opções de um cartão (lpMenu) ganha a mesma porta que os
// movimentos já tinham (os planeados e os modelos têm-na na própria folha:
// planeados.js:lpPortaSelecao). O toque longo já não a abre — entra direto na
// seleção (window.lpLongo) —, mas a porta fica onde a folha se abrir
var _lpMenu_sl = lpMenu;
lpMenu = function (v) {
  var a = String(v || '').split(':');
  if (TABS_SEL[a[0]] && !SEL_PLAN[a[0]] && tab === TABS_SEL[a[0]] && !CW.selL.tipo) {
    // injeta "Selecionar vários" nas opções do kebab: mesma lista, mais uma
    var tipo = a[0], id = a[1];
    var r = _lpMenu_sl(v);
    setTimeout(function () {
      var m = document.querySelector('.modal.open .body .list');
      if (!m || m.querySelector('[data-sel-varios]')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card tap sel-varios';
      btn.setAttribute('data-sel-varios', '1');
      btn.setAttribute('data-toca', 'modo');
      btn.innerHTML = '<span class="ic u-w-34px u-h-34px u-br-10px u-d-grid u-pi-center u-bg-v-accent-soft u-c-v-accent u-fx-0-0-34px">' + ic('caixaVisto', 18) + '</span>' +
        '<span class="u-fx-1 u-minw-0 u-ta-left"><b class="u-d-block u-fs-14px">Selecionar vários</b></span>';
      btn.onclick = function () { closeAllModals(); CW.selLEntrar(tipo, id); };
      m.insertBefore(btn, m.children[1] || null);
    }, 60);
    return r;
  }
  var res = _lpMenu_sl(v);
  if (SEL_PLAN[a[0]]) selLPortaNoFim();
  return res;
};

/* O «Selecionar vários» da folha de um planeado ou de um modelo
   (planeados.js:lpPortaSelecao) fica no FIM da folha: a nuvem acrescenta
   opções por baixo depois de a folha abrir (cloud/painel.js:menuOption — o
   «Recusar desta vez»), e ele ficava a meio. Corre logo a seguir, que tudo
   isso é síncrono.
   Devolve: nada — muda o botão de sítio, na folha aberta (ou nada sem ela). */
function selLPortaNoFim() {
  var ms = document.querySelectorAll('.modal.open');
  var m = ms.length ? ms[ms.length - 1] : null;
  var lista = m && m.querySelector('.body .list');
  if (!lista) return;
  [].slice.call(lista.children).forEach(function (b) {
    var t = b.querySelector && b.querySelector('b');
    if (t && t.textContent === 'Selecionar vários' && b !== lista.lastElementChild) lista.appendChild(b);
  });
}

/* A folha dos cartões marcados era feita aqui, num elemento de folha criado
   por JavaScript e pendurado na cabeça do documento. Isso é CSS em linha, que
   a CSP sem 'unsafe-inline' recusa tal como recusa um atributo de estilo, por
   isso as duas regras passaram para o web/estilos.css, na secção
   «g12-novidades» das classes dos módulos — tal e qual. */
