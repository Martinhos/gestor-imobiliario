/* Selecionar vários — imóveis, contratos, inquilinos, visitas, planeados, modelos e grupos.
   ----------------------------------------
   Nos imóveis, nos contratos, nos inquilinos, nas visitas, nos planeados,
   nos modelos e nos grupos o toque longo seleciona vários, como nos movimentos: entra na
   seleção com o tocado já marcado (CW.selLEntrar). Apagar em massa faz
   sentido aí — e apagar um imóvel arrasta os contratos e movimentos dele, por
   isso a confirmação diz os números e o Anular repõe tudo. Dos imóveis que
   não criei (colaborados ou partilhados comigo) apagar é sair, no servidor e
   sem Anular, na mesma confirmação (selLApagarImoveis). Com a transferência
   disponível, a barra dos imóveis tem também o Transferir, que abre a folha
   de transferir com os que criei (CW.selLTransferir). As opções de um só
   ficam no ⋯ da ficha (e na folha do lpMenu, com o «Selecionar vários»).

   Os inquilinos apagam-se aos vários com as regras do pessoas.js:delPerson
   (quem não posso apagar não se marca: selLRecusa); as visitas marcam-se
   como realizadas ou como falta, todas de uma vez, ou apagam-se, com as
   regras do visitas.js:visEstado e do visitas.js:visApaga. Os Proprietários e
   os Colaboradores não têm seleção. O data-lp dos inquilinos é o das pessoas,
   «per:tenant:<id>» — o id lê-se pelo começo de cada tipo (selLPrefixo).

   Nos Planeados há dois tipos no mesmo separador, os planeados ('rec') e os
   modelos ('tpl'), e seleciona-se um OU outro: entrar com um tipo esquece o
   outro, e os cartões do outro ficam atenuados (CW.selLOutro). A barra de
   baixo tem, nos planeados, Silenciar ou Reativar além do Apagar. As regras de
   cada planeado — quem pode, o que um automático arrasta — são as de
   planeados.js (recMudarVarios, recApagarVarios), as mesmas do skipRec e do
   delRec.

   Nos Grupos ('grp', data-lp «grp:<id>») marcam-se só os do tipo à vista
   (definicoes.js:grpTipo — trocar o tipo sai da seleção), privados e
   partilhados juntos; os pedidos que fiz para entrar não são grupos e não se
   marcam. A barra só tem o Apagar: os privados apagam-se como o delGroup, com
   o Anular; os partilhados meus apagam-se no servidor e dos dos outros saio
   (selLApagarGrupos). Os botões de dentro dos cartões (Partilhar, Aceitar,
   Copiar…) ficam inertes em seleção (data-sel-inerte): o toque marca.

   A porta à vista é o «Selecionar vários» do cabeçalho, a caixa com o visto
   (ic('caixaVisto'), o ☑), como nos Movimentos (selLCabecalho). Em seleção,
   o toque longo marca, como o toque.

   Vive no âmbito global, como os outros ficheiros da camada, com o
   comentário de interface em cada função: dentro de um IIFE, nem o gerador
   dos docs nem a CI as viam. A caixa de marcar é a de selecao.js. */
'use strict';

// o tipo do cartão → o separador onde há seleção ('ten' são os inquilinos, 'vis' as visitas)
var TABS_SEL = { prop: 'properties', ct: 'contracts', ten: 'tenants', vis: 'visits', rec: 'recurring', tpl: 'recurring', grp: 'groups' };
// os tipos dos Planeados: a porta da seleção na própria folha das opções (planeados.js:lpPortaSelecao)
var SEL_PLAN = { rec: 1, tpl: 1 };
// os tipos com mais ações na barra que o Apagar: a contagem e a razão por cima, as ações por baixo (selLBarraHtml, estilos.css:.sel-l-duas)
var SEL_ACOES = { rec: 1, vis: 1 };
// o começo do data-lp de cada tipo, quando não é «<tipo>:» — os inquilinos usam o das pessoas (lista-pessoas.js:personCard)
var SEL_PREFIXO = { ten: 'per:tenant:' };

CW.selL = { tipo: null, ids: {} };
// a seleção acabou de começar: as caixas postas a seguir entram a desvanecer (selLDecorar)
var selLEntrou = false;

/* O começo do data-lp dos cartões de um tipo: «prop:», «vis:», e nos
   inquilinos «per:tenant:» (os proprietários, «per:owner:», ficam de fora).
   Recebe: tipo — 'prop', 'ct', 'ten', 'vis', 'rec' ou 'tpl'.
   Devolve: o prefixo (texto). */
function selLPrefixo(tipo) { return SEL_PREFIXO[tipo] || tipo + ':'; }

/* O id de um cartão do tipo em seleção, lido pela forma do data-lp dele.
   Recebe: c — o elemento com data-lp; tipo (opcional) — o tipo (o em seleção, por omissão).
   Devolve: o id (texto). */
function selLIdDe(c, tipo) {
  return String(c.getAttribute('data-lp') || '').slice(selLPrefixo(tipo || CW.selL.tipo).length);
}

/* O tipo de seleção e o id de um data-lp, se for de um cartão que se
   seleciona: 'per:tenant:t1' dá {tipo:'ten', id:'t1'}; 'per:owner:o1', nada.
   Recebe: v — o data-lp.
   Devolve: {tipo, id}, ou null. */
function selLDoLp(v) {
  var s = String(v || '');
  for (var t in TABS_SEL) {
    var p = selLPrefixo(t);
    if (s.indexOf(p) === 0 && s.length > p.length) return { tipo: t, id: s.slice(p.length) };
  }
  return null;
}

/* Porque é que um cartão não se pode marcar: um inquilino que não posso
   apagar (as regras do pessoas.js:delPerson — personApagavel e a permissão
   de adicionar inquilinos na casa dele; e nunca o meu perfil, como o embrulho
   de cloud/utilizadores.js:delPerson); uma visita que não posso alterar nem
   apagar; um grupo de outro tipo que não o à vista. Os outros tipos
   marcam-se todos: as regras de cada um vêm na ação.
   Recebe: tipo — o tipo do cartão; id — o id dele.
   Devolve: a frase da recusa (texto), ou '' quando se marca. */
function selLRecusa(tipo, id) {
  if (tipo === 'ten') {
    var p = (db.tenants || []).find(function (x) { return x.id === id; });
    if (!p) return '';
    if (window.CW && CW.user && CW.user.id === id) return 'Este perfil és tu — podes editá-lo, não apagá-lo.';
    var casa = casaDoInquilino(p), recusa = motivoRecusa(casa, 'tenant.add', p, true);
    if (recusa) return recusa;
    if (typeof personApagavel === 'function' && !personApagavel('tenant', p)) return 'Não podes apagar esta ficha.';
    return '';
  }
  if (tipo === 'vis') {
    var v = (db.visits || []).find(function (x) { return x.id === id; });
    return v ? motivoRecusa(v.propertyId, 'visit.add', v, true) || motivoRecusa(v.propertyId, 'visit.add', v) : '';
  }
  if (tipo === 'grp') {
    // só os do tipo à vista: a seleção nunca mistura imóveis, proprietários e contratos
    var g = (db.groups || []).find(function (x) { return x.id === id; });
    return g && typeof grpTipo !== 'undefined' && g.kind !== grpTipo ? 'Este grupo é de outro tipo: troca o tipo à vista para o escolheres.' : '';
  }
  return '';
}

// Entra na seleção de vários cartões de um tipo, com o tocado já marcado.
// Num separador com dois tipos (os Planeados) esquece o que estava marcado do outro.
// Um cartão que não se marca (selLRecusa) entra sem marca, e o aviso diz porquê.
// Recebe: tipo — 'prop', 'ct', 'ten', 'vis', 'rec' ou 'tpl'; id (opcional) — o id do cartão tocado.
// Devolve: nada — marca e repinta (ou nada, fora do separador desse tipo).
CW.selLEntrar = function (tipo, id) {
  if (tab !== TABS_SEL[tipo]) return;
  CW.selL = { tipo: tipo, ids: {} };
  var recusa = id ? selLRecusa(tipo, id) : '';
  if (id && !recusa) CW.selL.ids[id] = 1;
  selLEntrou = true;
  render();
  if (recusa) toast(recusa);
};
// Sai da seleção de vários.
// Devolve: nada — esquece o que estava marcado e repinta.
CW.selLSair = function () { CW.selL = { tipo: null, ids: {} }; render(); };
// Marca ou desmarca um cartão; o que não se marca (selLRecusa) diz porquê.
// Recebe: id — o id do cartão.
// Devolve: nada — repinta as caixas e a contagem (ou avisa).
CW.selLToggle = function (id) {
  if (!CW.selL.ids[id]) {
    var recusa = selLRecusa(CW.selL.tipo, id);
    if (recusa) return toast(recusa);
  }
  if (CW.selL.ids[id]) delete CW.selL.ids[id]; else CW.selL.ids[id] = 1;
  selLPintar();
};

// Quantos cartões estão marcados.
// Devolve: o número.
function selLN() { return Object.keys(CW.selL.ids).length; }

/* O toque longo, redirecionado de vez: os movimentos, os imóveis, os
   contratos, os inquilinos, as visitas, os planeados, os modelos e os grupos
   entram em seleção com o tocado já marcado — o mesmo gesto em toda a app. Já em
   seleção, marca ou desmarca, como o toque (CW.selLTocar). O resto (os
   proprietários, as visitas da Visão geral) não faz nada — as opções de um só
   vivem no ⋯ da ficha (nos planeados, planeados.js:recView; nos modelos,
   planeados.js:tplView; nas pessoas, pessoas.js:personView; nas visitas,
   visitas.js:visView).
   Recebe: v — o data-lp tocado ('tx:<id>', 'prop:<id>', 'per:tenant:<id>', 'vis:<id>', …).
   Devolve: nada — entra em seleção, ou marca. */
window.lpLongo = function (v) {
  var a = String(v || '').split(':');
  if (a[0] === 'tx' && tab === 'transactions' && CW.selEntrar) return CW.selEntrar(a[1]);
  var s = selLDoLp(v);
  if (!s) return;
  if (CW.selL.tipo && tab === TABS_SEL[s.tipo]) return CW.selLTocar(s.tipo, s.id);
  return CW.selLEntrar(s.tipo, s.id);
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
  if (ts.length > 1) for (var i = 0; i < ts.length; i++) if (document.querySelector('#view [data-lp^="' + selLPrefixo(ts[i]) + '"]')) return ts[i];
  return ts[0];
}

/* Há cartões à vista que se possam marcar neste separador?
   Recebe: t — o separador.
   Devolve: true se há algum cartão de um dos tipos dele no #view. */
function selLHaCartoes(t) {
  return selLTiposDe(t).some(function (k) { return !!document.querySelector('#view [data-lp^="' + selLPrefixo(k) + '"]'); });
}

/* o nome dos cartões de cada tipo, no singular e no plural, para as
   contagens — e 'f' nos femininos («nenhuma visita», «2 selecionadas»,
   «Marcar todas as visitas à vista») */
var SEL_NOMES = { prop: ['imóvel', 'imóveis'], ct: ['contrato', 'contratos'], ten: ['inquilino', 'inquilinos'], vis: ['visita', 'visitas', 'f'],
  rec: ['planeado', 'planeados'], tpl: ['modelo', 'modelos'], grp: ['grupo', 'grupos'] };

/* As palavras das contagens de um tipo, com o género certo.
   Recebe: tipo — o tipo em seleção.
   Devolve: {um, varios, nenhum, sel, todos, toca} — «visita», «visitas»,
   «nenhuma visita», «selecionada» (a juntar o «s»), «todas as visitas» e o
   «toca nas visitas» da barra vazia (nas Casas, «toca nos cartões»). */
function selLPalavras(tipo) {
  var n = SEL_NOMES[tipo] || ['registo', 'registos'], f = n[2] === 'f';
  return { um: n[0], varios: n[1], nenhum: (f ? 'nenhuma ' : 'nenhum ') + n[0], sel: f ? 'selecionada' : 'selecionado',
    todos: (f ? 'todas as ' : 'todos os ') + n[1], toca: tipo === 'ten' || tipo === 'vis' ? (f ? 'toca nas ' : 'toca nos ') + n[1] : 'toca nos cartões' };
}

/* O cabeçalho dos Imóveis, dos Contratos, dos Inquilinos, das Visitas e
   dos Planeados segue o dos
   Movimentos (cloud/selecao.js:patchHdrSel). Fora da seleção, o botão do
   cabeçalho é o «Selecionar vários», com a mesma caixa com o visto (o ☑) e o
   mesmo nome — os filtros abrem-se no funil ao lado da pesquisa
   (vistas.js:lfCabeca) —, e some sem cartões à vista, que não há o que
   marcar. Nos Inquilinos, nas Visitas e nos Planeados a base não pinta o
   botão (vistas.js:LF_COM_CABECALHO não os tem): quem o mostra é esta função, que corre depois. Em seleção, o título dá lugar à caixa de
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
      '<span class="selbox" id="selLTudo" role="checkbox" tabindex="0" aria-checked="false" aria-label="Marcar ' + selLPalavras(tipo).todos + ' à vista" data-toca="vista" data-click="CW.selLTodos(event)">' + caixa(false) + '</span>' +
      '<span class="u-fx-1 u-minw-0 u-cur-pointer" data-toca="vista" data-click="CW.selLTodos(event)"><b id="selLCabConta"></b>' +
      '<span class="small u-d-block">toca para marcar tudo</span></span>';
    tit.parentNode.insertBefore(cab, tit);
  }
  selLPintar();
}

/* A caixa de tudo do cabeçalho: marca os cartões todos à vista (os que os
   filtros deixam, e só os que se marcam: selLMarcaveis) ou, com todos
   marcados, desmarca-os.
   Recebe: ev (opcional) — o evento do toque, que não segue para baixo.
   Devolve: nada — marca e repinta as caixas e a contagem. */
CW.selLTodos = function (ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var ids = selLMarcaveis().map(function (c) { return selLIdDe(c); });
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

// Nos Imóveis, nos Contratos, nos Inquilinos, nas Visitas e nos Planeados
// o botão do cabeçalho é da
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
// Devolve: array de elementos com o data-lp do tipo («prop:<id>», «per:tenant:<id>»…).
function selLCartoes() {
  return [].slice.call(document.querySelectorAll('#view [data-lp^="' + selLPrefixo(CW.selL.tipo) + '"]'));
}

// Os cartões à vista que se podem marcar: os do tipo, menos os que o
// selLDecorar deixou de fora (selLRecusa, guardada no próprio nó em _selLFora).
// Devolve: array de elementos.
function selLMarcaveis() {
  return selLCartoes().filter(function (c) { return !c._selLFora; });
}

// Põe a caixa em cada cartão do tipo em seleção (um toque passa a marcar —
// e ao entrar as caixas desvanecem: selLEntrou), atenua os do outro tipo do
// mesmo separador (CW.selLOutro) e os que não se marcam (selLRecusa: sem
// caixa, e o toque diz porquê), e põe a barra de baixo, a do tipo
// (selLBarraHtml): mudar de tipo troca-a.
// Devolve: nada — mexe no DOM já desenhado.
function selLDecorar() {
  var tipo = CW.selL.tipo;
  selLCartoes().forEach(function (c) {
    var id = selLIdDe(c, tipo), recusa = selLRecusa(tipo, id);
    c._selLFora = recusa;
    if (recusa) {
      delete CW.selL.ids[id];
      c.classList.add('sel-fora');
      c.setAttribute('aria-disabled', 'true');
    } else if (!c.querySelector('.selbox')) {
      var b = document.createElement('span');
      b.className = 'selbox' + (selLEntrou ? ' sel-entra' : '');
      b.setAttribute('data-selbox', id);
      b.setAttribute('aria-hidden', 'true');   // o estado diz-se no cartão (aria-pressed, selLPintar)
      // nos grupos, no canto de cima, antes do nome (a .grp-cab)
      var alvo = c.querySelector('.row-between') || c.querySelector('.grp-cab') || c;
      alvo.insertBefore(b, alvo.firstChild);
    }
    // os botões de dentro do cartão que não são da seleção (os dos grupos) ficam
    // fora do toque, do teclado e do leitor de ecrã: o toque cai no cartão e marca
    if (c.querySelectorAll) [].slice.call(c.querySelectorAll('[data-sel-inerte]')).forEach(function (x) { x.setAttribute('inert', ''); });
    c.setAttribute('data-toca', 'vista');
    c.setAttribute('data-click', 'CW.selLToggle(\'' + jsqBruto(id) + '\')');
  });
  selLTiposDe(tab).forEach(function (k) {
    if (k === tipo) return;
    [].slice.call(document.querySelectorAll('#view [data-lp^="' + selLPrefixo(k) + '"]')).forEach(function (c) {
      var id = selLIdDe(c, k);
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
    f.className = 'sel-fundo' + (selLComAcoes(tipo) ? ' sel-l-duas' : '');
    f.setAttribute('data-sel-tipo', tipo);
    // a mesma barra dos movimentos (estilos.css:.sel-fundo): no ecrã largo, azul-noite a flutuar no fundo
    f.setAttribute('role', 'toolbar');
    f.setAttribute('aria-label', 'Seleção');
    f.innerHTML = selLBarraHtml(tipo);
    document.body.appendChild(f);
  }
  selLPintar();
}

/* O que vai na barra de baixo de cada tipo — a das Casas: × Cancelar, a
   contagem ao meio e as ações. Imóveis, contratos, inquilinos e modelos: só
   o Apagar, numa linha. Os planeados e as visitas têm mais ações (SEL_ACOES):
   a contagem leva por baixo a razão de uma ação estar fora (#selLPorque, que
   o leitor de ecrã ouve), e as ações vão para uma segunda linha no telemóvel
   (a .sel-l-quebra; estilos.css:.sel-l-duas) — numa só não cabiam a 375px.
   Nos planeados, o Silenciar ou o Reativar (#selLMudo, que o selLPintarMudo
   acerta); nas visitas, o Realizada e o Falta (selLPintarVisitas). Nos
   imóveis, com a transferência disponível (selLComAcoes), o Transferir
   (#selLTransferir, que o selLPintarTransferir acerta). As ações
   com data-sel-l-precisa desligam-se sem nada marcado (selLPintar).
   Recebe: tipo — 'prop', 'ct', 'ten', 'vis', 'rec' ou 'tpl'.
   Devolve: o HTML de dentro da barra (texto). */
function selLBarraHtml(tipo) {
  var cancelar = '<button type="button" class="btn" data-toca="modo" data-click="CW.selLSair()">' + ic('x', 15) + ' Cancelar</button>';
  var apagar = '<button type="button" class="btn danger" data-sel-l-precisa data-toca="dados" data-risco="destroi" data-click="CW.selLApagar()">' + ic('trash', 15) + ' Apagar</button>';
  if (!selLComAcoes(tipo)) return cancelar + '<b id="selLConta" class="u-fx-1 u-ta-center"></b>' + apagar;
  var acoes = tipo === 'rec'
    ? '<button type="button" class="btn" id="selLMudo" hidden data-toca="dados" data-click="CW.selLMudo()"></button>'
    : tipo === 'prop'
    ? '<button type="button" class="btn" id="selLTransferir" data-sel-l-precisa data-toca="camada" data-click="CW.selLTransferir()">' + ic('swap', 15) + ' Transferir</button>'
    : '<button type="button" class="btn" id="selLRealizada" data-sel-l-precisa data-toca="dados" data-click="CW.selLVisEstado(\'realizada\')">' + ic('check', 15) + ' Realizada</button>' +
      '<button type="button" class="btn" id="selLFalta" data-sel-l-precisa data-toca="dados" data-click="CW.selLVisEstado(\'faltou\')">' + ic('x', 15) + ' Falta</button>';
  return cancelar +
    '<p class="sel-l-info"><b id="selLConta"></b><span id="selLPorque" class="small" aria-live="polite"></span></p>' +
    '<i class="sel-l-quebra" aria-hidden="true"></i>' + acoes + apagar;
}

// Pinta as caixas (a de selecao.js), a caixa de tudo do cabeçalho, as
// contagens conforme o que está marcado e as ações que precisam de marcas.
// Devolve: nada — mexe no DOM já desenhado.
function selLPintar() {
  var ids = [];
  selLCartoes().forEach(function (c) {
    if (c._selLFora) return;   // sem caixa: não se marca (selLDecorar)
    var id = selLIdDe(c);
    ids.push(id);
    var b = c.querySelector('[data-selbox]');
    if (b) b.innerHTML = caixa(!!CW.selL.ids[id]);
    c.classList.toggle('sel-on-card', !!CW.selL.ids[id]);
    // o leitor de ecrã ouve marcado ou não, no próprio cartão (um botão: tornarFocavel)
    if (c.setAttribute) c.setAttribute('aria-pressed', CW.selL.ids[id] ? 'true' : 'false');
  });
  var n = selLN(), conta = document.getElementById('selLConta'), pal = selLPalavras(CW.selL.tipo);
  if (conta) conta.textContent = n ? n + ' ' + pal.sel + (n === 1 ? '' : 's') : pal.toca;
  var marcados = ids.filter(function (id) { return CW.selL.ids[id]; }).length;
  var todos = ids.length > 0 && marcados === ids.length, algum = marcados > 0;
  var g = document.getElementById('selLTudo');
  if (g) {
    g.innerHTML = caixa(todos, algum);
    g.setAttribute('aria-checked', todos ? 'true' : algum ? 'mixed' : 'false');
    g.setAttribute('aria-label', 'Marcar ' + pal.todos + ' à vista');
  }
  var cc = document.getElementById('selLCabConta');
  if (cc) cc.textContent = n ? n + ' ' + (n === 1 ? pal.um : pal.varios) : pal.nenhum;
  [].slice.call(document.querySelectorAll('.sel-fundo [data-sel-l-precisa]')).forEach(function (b) { b.disabled = !n; });
  if (CW.selL.tipo === 'rec') selLPintarMudo();
  if (CW.selL.tipo === 'vis') selLPintarVisitas();
  if (CW.selL.tipo === 'prop') selLPintarTransferir();
}

/* Se a barra de um tipo tem mais ações do que o Apagar — e por isso a
   contagem com a razão por cima e as ações por baixo (estilos.css:.sel-l-duas):
   os planeados e as visitas sempre (SEL_ACOES); os imóveis quando a
   transferência existe aqui (imovel.js:imvTrfDisponivel — com sessão e um
   servidor que já sabe dela).
   Recebe: tipo — o tipo em seleção.
   Devolve: true ou false. */
function selLComAcoes(tipo) {
  if (SEL_ACOES[tipo]) return true;
  return tipo === 'prop' && servicoLigado('properties') && imvTrfDisponivel();
}

/* Dos imóveis marcados, os que posso transferir (os que criei, sem um
   pedido pendente — imovel.js:imvPossoTransferir) e quantos ficam de fora.
   Recebe: ids — os ids marcados (array).
   Devolve: {vao, fora} — arrays de ids. */
function selLTransferiveis(ids) {
  var vao = [], fora = [];
  ids.forEach(function (id) { (servicoLigado('properties') && imvPossoTransferir(id) ? vao : fora).push(id); });
  return { vao: vao, fora: fora };
}

/* O Transferir da barra dos imóveis, conforme os marcados
   (selLTransferiveis): ligado com pelo menos um que posso transferir; a
   razão dita ao lado da contagem quando algum fica de fora («1 fica de fora
   da transferência: não o criaste ou já tem um pedido pendente.»), ou
   quando nenhum vai.
   Devolve: nada — mexe na barra já posta. */
function selLPintarTransferir() {
  var b = document.getElementById('selLTransferir'), pq = document.getElementById('selLPorque');
  var ids = Object.keys(CW.selL.ids), r = selLTransferiveis(ids);
  if (b) b.disabled = !r.vao.length;
  if (!pq) return;
  if (!ids.length || !r.fora.length) { pq.textContent = ''; return; }
  pq.textContent = !r.vao.length ? 'Só transferes os que criaste e não têm um pedido pendente.'
    : r.fora.length + (r.fora.length === 1 ? ' fica de fora da transferência.' : ' ficam de fora da transferência.');
}

/* Transferir os imóveis marcados: abre a folha de transferir com eles
   (imovel.js:imvTransferir, que deixa de fora — e diz — os que não criei e
   os que já têm um pedido pendente). Com o pedido feito, sai da seleção.
   Devolve: nada. */
CW.selLTransferir = function () {
  var ids = Object.keys(CW.selL.ids);
  if (!ids.length) return toast('Não está nada selecionado.');
  if (servicoLigado('properties')) imvTransferir(ids, function () { CW.selLSair(); });
};

/* Se as visitas marcadas se podem marcar como realizadas ou como falta: só
   quando são todas agendadas e as posso alterar (as regras do
   visitas.js:visEstado, motivoRecusa).
   Recebe: ids — os ids marcados (array).
   Devolve: {pode, porque} — pode é true ou false; porque, a razão de não
   poder ('' sem nada marcado). */
function selLVisPode(ids) {
  var vs = ids.map(function (id) { return (db.visits || []).find(function (x) { return x.id === id; }); }).filter(Boolean);
  if (!vs.length) return { pode: false, porque: '' };
  if (vs.some(function (v) { return v.estado !== 'agendada'; })) return { pode: false, porque: 'Só as agendadas se marcam como realizadas ou falta.' };
  for (var i = 0; i < vs.length; i++) {
    var recusa = motivoRecusa(vs[i].propertyId, 'visit.add', vs[i]);
    if (recusa) return { pode: false, porque: recusa };
  }
  return { pode: true, porque: '' };
}

/* O Realizada e o Falta da barra das visitas, conforme as marcadas
   (selLVisPode): desligados com alguma que não esteja agendada ou que eu não
   possa alterar, e a razão dita ao lado da contagem — como o Silenciar dos
   planeados (selLPintarMudo).
   Devolve: nada — mexe na barra já posta. */
function selLPintarVisitas() {
  var r = selLVisPode(Object.keys(CW.selL.ids)), pq = document.getElementById('selLPorque');
  ['selLRealizada', 'selLFalta'].forEach(function (k) {
    var b = document.getElementById(k);
    if (b) b.disabled = !r.pode;
  });
  if (pq) pq.textContent = r.porque;
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
   arrasta os contratos e os movimentos dele (e dos que não criei saio:
   selLApagarImoveis); um contrato deixa os movimentos, só desligados.
   Devolve: nada — pede confirmação; só depois apaga e oferece o Anular. */
CW.selLApagar = function () {
  var ids = Object.keys(CW.selL.ids);
  if (!ids.length) return toast('Não está nada selecionado.');
  var tipo = CW.selL.tipo;
  if (tipo === 'rec') return selLApagarPlaneados(ids);
  if (tipo === 'tpl') return selLApagarModelos(ids);
  if (tipo === 'ten') return selLApagarInquilinos(ids);
  if (tipo === 'vis') return selLApagarVisitas(ids);
  if (tipo === 'grp') return selLApagarGrupos(ids);
  if (tipo === 'prop') return selLApagarImoveis(ids);

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

/* O que sair de vários imóveis que não criei faz, numa frase só (com um,
   é a da ficha: imovel.js:imvFraseSaida): as permissões são retiradas, saem
   da lista, o registado fica; nos de compropriedade a quota vai para os
   restantes e os saldos e o IRS passam a contar com as quotas novas; não se
   desfaz, e como se volta.
   Recebe: ps — os imóveis (objetos de db.properties), dois ou mais.
   Devolve: a frase (HTML, com os nomes escapados). */
function selLSaidaFrase(ps) {
  var nomes = listaE(ps.map(function (p) { return '<b>' + esc(p.name || 'Sem nome') + '</b>'; }));
  var co = ps.filter(function (p) { return souDono(p.id); }), col = ps.length - co.length;
  var f = 'Sais de ' + nomes + ': as tuas permissões neles são retiradas e saem da tua lista. O que lá registaste fica.';
  if (co.length) {
    f += ' ' + (co.length === 1 ? 'Em <b>' + esc(co[0].name || 'Sem nome') + '</b>, de que és comproprietário,' : 'Nos ' + co.length + ' de que és comproprietário,') +
      ' a tua quota é dividida pelos restantes na proporção das quotas deles, e os saldos e o IRS passam a contar com as quotas novas, também nos movimentos já registados.';
  }
  return f + ' Não se desfaz: para voltares a um deles, ' + (co.length && col ? 'o dono tem de te enviar um convite novo ou voltar a partilhá-lo contigo.'
    : co.length ? 'quem o criou tem de voltar a partilhá-lo contigo.' : 'pede ao dono um convite novo.');
}

/* O que apagar os imóveis marcados vai fazer, numa confirmação só, como a
   dos grupos (selLGruposFrase): o título começa sempre por «Apagar» — é o
   nome da ação, e o botão fica o vermelho de sempre —, «Apagar 2 imóveis»
   só com os meus ou só com os de outros, «Apagar 1 imóvel e sair de 2» com
   os dois; a frase diz o que vai junto com os meus (selLVaoJunto), o que
   sair dos outros faz (imovel.js:imvFraseSaida com um, selLSaidaFrase com
   vários) e, com os dois, que o Anular só repõe os meus.
   Recebe: meus, outros — os imóveis (objetos de db.properties) que criei e
   os que não criei; nc, nt — quantos contratos e movimentos vão com os meus.
   Devolve: {titulo, frase} (texto; a frase é HTML, com os nomes escapados). */
function selLImoveisFrase(meus, outros, nc, nt) {
  var m = meus.length, o = outros.length, mix = m && o;
  var imoveis = function (n) { return n + (n === 1 ? ' imóvel' : ' imóveis'); };
  var titulo = mix ? 'Apagar ' + imoveis(m) + ' e sair de ' + o : 'Apagar ' + imoveis(m || o);
  var partes = [];
  if (m) {
    partes.push(!mix ? selLVaoJunto(nc, nt)
      : (m === 1 ? 'O teu <b>' + esc(meus[0].name || 'Sem nome') + '</b> é apagado.' : 'Os ' + m + ' teus são apagados.') + ' ' + selLVaoJunto(nc, nt));
  }
  if (o) partes.push(o === 1 && typeof imvFraseSaida === 'function' ? imvFraseSaida(outros[0]) : selLSaidaFrase(outros));
  var frase = partes.join(' ');
  if (mix) frase += ' O Anular só repõe ' + (m === 1 ? 'o teu.' : 'os teus.');
  return { titulo: titulo, frase: frase };
}

/* Apaga os imóveis meus da lista, na base local, com o que vai junto: os
   contratos e os movimentos deles. Grava e devolve o que o Anular precisa.
   Recebe: ids — os ids dos imóveis; cts, txs — os contratos e os movimentos deles.
   Devolve: {repor, liquidar} — repor devolve tudo à base; liquidar apaga as
   fotos e os documentos do IndexedDB (quando o Anular expira). */
function selLApagarImoveisLocal(ids, cts, txs) {
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
  save();
  return {
    repor: function () {
      db.properties = db.properties.concat(copia.ps);
      db.contracts = db.contracts.concat(copia.cts);
      db.transactions = db.transactions.concat(copia.txs);
    },
    liquidar: function () {
      copia.ps.forEach(function (p) {
        (p.photos || []).forEach(function (f) { idbDel(f.id).catch(function () {}); idbDel('tn_' + f.id).catch(function () {}); });
        (p.loans || []).forEach(function (l) { (l.files || []).forEach(function (f) { idbDel(f.id).catch(function () {}); }); });
      });
    },
  };
}

/* Apagar os imóveis marcados, depois de UMA confirmação (selLImoveisFrase):
   os que criei apagam-se na base, com os contratos e os movimentos, e com o
   Anular; dos que não criei (colaborados ou partilhados comigo) saio no
   servidor (cloud/partilha.js:CW.sairDaCasa), o que não se desfaz. Os
   pedidos vão todos; um que falhe não trava os outros, e o aviso, um só,
   espera pelas respostas e diz o que ficou como estava e porquê
   (selLImoveisAviso). Com saídas feitas, o estado volta a ler-se. Só com os
   meus, é o de sempre: apaga e oferece o Anular logo.
   Recebe: ids — os ids marcados (array).
   Devolve: nada — pede confirmação; só depois apaga, sai e avisa. */
function selLApagarImoveis(ids) {
  var ps = ids.map(function (id) { return db.properties.find(function (p) { return p.id === id; }); }).filter(Boolean);
  if (!ps.length) return toast('Não está nada selecionado.');
  var meus = ps.filter(function (p) { return souCriador(p.id); }), outros = ps.filter(function (p) { return !souCriador(p.id); });
  var mids = meus.map(function (p) { return p.id; });
  var cts = db.contracts.filter(function (c) { return mids.indexOf(c.propertyId) > -1; });
  var txs = db.transactions.filter(function (t) { return mids.indexOf(t.propertyId) > -1; });
  var q = selLImoveisFrase(meus, outros, cts.length, txs.length);
  confirmModal(q.titulo, q.frase, function () {
    var local = meus.length ? selLApagarImoveisLocal(mids, cts, txs) : null;
    CW.selLSair(); buildNav();
    if (!outros.length) return comDesfazer(selLImoveisAviso(meus.length, 0, []), local.repor, local.liquidar);
    var nos = outros.map(function (p) {
      var feito = typeof CW.sairDaCasa === 'function' ? CW.sairDaCasa(p.id) : Promise.reject(new Error('sem ligação ao servidor'));
      return feito.then(function () { return { p: p, ok: true }; }, function (e) { return { p: p, ok: false, erro: (e && e.message) || 'sem resposta do servidor' }; });
    });
    Promise.all(nos).then(function (rs) {
      var ok = rs.filter(function (r) { return r.ok; }), falhas = rs.filter(function (r) { return !r.ok; });
      ok.forEach(function (r) { if (dashProp === r.p.id) dashProp = ''; if (txProp === r.p.id) txProp = ''; });
      var msg = selLImoveisAviso(meus.length, ok.length, falhas);
      if (local) comDesfazer(msg, local.repor, local.liquidar);
      else toast(msg, falhas.length ? { ms: 6000 } : undefined);
      if (!ok.length) return;
      return Promise.resolve(pullNow(true)).catch(function () {}).then(function () { render(); });
    });
  });
}

/* O aviso do fim do apagar dos imóveis: quantos se apagaram, de quantos saí
   e, quando o servidor recusou alguma saída, quais ficaram como estavam e
   porquê (a razão da primeira).
   Recebe: apagados — quantos se apagaram; saidas — de quantos saí; falhas —
   [{p, erro}] das saídas que o servidor recusou.
   Devolve: o texto do aviso. */
function selLImoveisAviso(apagados, saidas, falhas) {
  var partes = [];
  if (apagados) partes.push(apagados + (apagados === 1 ? ' imóvel apagado.' : ' imóveis apagados.'));
  if (saidas) partes.push('Saíste de ' + saidas + (saidas === 1 ? ' imóvel.' : ' imóveis.'));
  if (falhas.length) {
    var nomes = falhas.map(function (f) { return '«' + (f.p.name || 'Sem nome') + '»'; }).join(', ');
    var porque = String(falhas[0].erro).replace(/\.?\s*$/, '.');
    partes.push(nomes + (falhas.length === 1 ? ' ficou como estava: ' : ' ficaram como estavam: ') + porque);
  }
  return partes.join(' ');
}

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

/* Os marcados que a ação pode levar, e a recusa do primeiro que não pode
   (selLRecusa — quem já não existe também fica de fora, calado).
   Recebe: lista — o array do db (db.tenants, db.visits); tipo — 'ten' ou 'vis'; ids — os marcados.
   Devolve: {ok, fora, recusa} — os registos que se podem levar, quantos ficaram de fora, e porquê. */
function selLQuemPode(lista, tipo, ids) {
  var ok = [], fora = 0, recusa = '';
  ids.forEach(function (id) {
    var x = (lista || []).find(function (y) { return y.id === id; });
    if (!x) return;
    var r = selLRecusa(tipo, id);
    if (r) { fora++; if (!recusa) recusa = r; } else ok.push(x);
  });
  return { ok: ok, fora: fora, recusa: recusa };
}

/* Apagar vários inquilinos, com as regras do pessoas.js:delPerson a cada um
   (selLRecusa): a ficha sai da lista e o id sai dos contratos, que ficam.
   Ao contrário do delPerson, há Anular — repõe as fichas e o lugar de cada
   uma nos contratos —, e por isso os documentos só saem do IndexedDB quando
   o Anular expira. A confirmação diz quantos contratos ficam sem eles (só
   com os Contratos ligados nesta conta: desligados, o id sai deles na mesma,
   mas a pergunta não os nomeia).
   Recebe: ids — os ids marcados (array).
   Devolve: nada — pede confirmação; só depois apaga e oferece o Anular. */
function selLApagarInquilinos(ids) {
  var q = selLQuemPode(db.tenants, 'ten', ids);
  if (!q.ok.length) return toast(q.recusa || 'Não está nada selecionado.');
  var oids = q.ok.map(function (p) { return p.id; }), n = oids.length;
  var tem = function (c) { return (c.tenantIds || []).some(function (t) { return oids.indexOf(t) > -1; }); };
  var comCt = servicoLigado('contracts'), nc = comCt ? db.contracts.filter(tem).length : 0;
  // como o delPerson: o nome de quem sai, quando é um só
  var quem = n === 1 ? 'Apagar “' + esc(q.ok[0].name || '(sem nome)') + '”? ' : '';
  var frase = !comCt ? '' : nc ? (n === 1 ? 'Sai de ' : 'Saem de ') + nc + (nc === 1 ? ' contrato, que se mantém.' : ' contratos, que se mantêm.') : 'Sem contratos ligados.';
  confirmModal('Apagar ' + n + (n === 1 ? ' inquilino' : ' inquilinos'), ((quem + frase).trim() || 'As fichas saem da lista.') + selLFora(q.fora), function () {
    var copia = {
      ts: JSON.parse(JSON.stringify(q.ok)),
      ligados: db.contracts.filter(tem).map(function (c) { return { id: c.id, ids: (c.tenantIds || []).slice() }; }),
    };
    db.tenants = db.tenants.filter(function (t) { return oids.indexOf(t.id) < 0; });
    db.contracts.forEach(function (c) { if (tem(c)) c.tenantIds = c.tenantIds.filter(function (t) { return oids.indexOf(t) < 0; }); });
    save(); CW.selLSair(); buildNav();
    comDesfazer(n + (n === 1 ? ' inquilino apagado.' : ' inquilinos apagados.') + selLFora(q.fora), function () {
      var ha = {};
      db.tenants.forEach(function (t) { ha[t.id] = 1; });
      db.tenants = db.tenants.concat(copia.ts.filter(function (t) { return !ha[t.id]; }));
      // cada um volta ao seu lugar no contrato, sem desfazer o que entretanto lá entrou
      copia.ligados.forEach(function (x) {
        var c = db.contracts.find(function (y) { return y.id === x.id; });
        if (!c) return;
        c.tenantIds = c.tenantIds || [];
        x.ids.forEach(function (t, i) { if (c.tenantIds.indexOf(t) < 0) c.tenantIds.splice(Math.min(i, c.tenantIds.length), 0, t); });
      });
    }, function () {
      copia.ts.forEach(function (p) { (p.files || []).forEach(function (f) { idbDel(f.id).catch(function () {}); }); });
    });
  });
}

/* Apagar várias visitas, com as regras do visitas.js:visApaga a cada uma
   (selLRecusa) e o Anular que as repõe. Pergunta antes, como os outros
   apagar da barra: são várias de uma vez.
   Recebe: ids — os ids marcados (array).
   Devolve: nada — pede confirmação; só depois apaga e oferece o Anular. */
function selLApagarVisitas(ids) {
  var q = selLQuemPode(db.visits, 'vis', ids);
  if (!q.ok.length) return toast(q.recusa || 'Não está nada selecionado.');
  var vids = q.ok.map(function (v) { return v.id; }), n = vids.length;
  confirmModal('Apagar ' + n + (n === 1 ? ' visita' : ' visitas'),
    (n === 1 ? 'Sai da lista e da Agenda.' : 'Saem da lista e da Agenda.') + selLFora(q.fora), function () {
      var copia = JSON.parse(JSON.stringify(q.ok));
      db.visits = (db.visits || []).filter(function (v) { return vids.indexOf(v.id) < 0; });
      save(); CW.selLSair(); buildNav();
      comDesfazer(n + (n === 1 ? ' visita apagada.' : ' visitas apagadas.') + selLFora(q.fora), function () {
        var ha = {};
        (db.visits || []).forEach(function (v) { ha[v.id] = 1; });
        db.visits = (db.visits || []).concat(copia.filter(function (v) { return !ha[v.id]; }));
      });
    });
}

/* O que apagar os grupos marcados vai fazer, dito antes, numa confirmação só:
   o título («Apagar 2 grupos», «Sair de 1 grupo», «Apagar 1 grupo e sair de
   1») e a frase — os privados saem da lista e os membros ficam; o que acontece
   aos movimentos (definicoes.js:gruposMovimentosFrase); os partilhados meus
   desaparecem para todos; dos dos outros saio; e o que o Anular repõe (só os
   privados — os partilhados mudam no servidor e não se desfazem).
   Recebe: priv, meus, outros — os grupos (objetos de db.groups) de cada lado.
   Devolve: {titulo, frase} (texto; a frase é HTML, com os nomes escapados). */
function selLGruposFrase(priv, meus, outros) {
  var p = priv.length, m = meus.length, o = outros.length, a = p + m, mix = p && (m || o);
  var nome = function (g) { return '«' + esc(g.name || 'Sem nome') + '»'; };
  var grupos = function (n) { return n + (n === 1 ? ' grupo' : ' grupos'); };
  var titulo = a && o ? 'Apagar ' + grupos(a) + ' e sair de ' + o : a ? 'Apagar ' + grupos(a) : 'Sair de ' + grupos(o);
  var partes = [];
  if (p) {
    var kind = priv[0].kind, membros = (GKIND[kind] || GKIND.prop).label.toLowerCase();
    partes.push((p === 1 ? 'O grupo' + (mix ? ' privado ' : ' ') + nome(priv[0]) + ' sai' : 'Os ' + p + (mix ? ' grupos privados saem' : ' grupos saem')) +
      ' da lista; os ' + membros + ' ficam como estão.');
  }
  if (m) partes.push((m === 1 ? 'O partilhado teu ' + nome(meus[0]) + ' desaparece' : 'Os ' + m + ' partilhados teus desaparecem') +
    ' para todos os membros, que deixam de ver os imóveis uns dos outros por ' + (m === 1 ? 'ele' : 'eles') + '. Os imóveis e os registos ficam com quem os criou.');
  if (o) partes.push('Sais de ' + (o === 1 ? nome(outros[0]) + ', de ' + esc(outros[0]._donoNome || 'outra pessoa') : o + ' partilhados de outras pessoas') +
    ': deixas de ver os imóveis ' + (o === 1 ? 'dele' : 'deles') + ', e os que lá adicionaste são removidos.');
  var frase = partes.join(' ') + gruposMovimentosFrase(priv.concat(meus, outros).map(function (g) { return g.id; }));
  if (mix) frase += ' O Anular só repõe ' + (p === 1 ? 'o privado' : 'os privados') + ': ' + (m + o === 1 ? 'o partilhado não se desfaz.' : 'os partilhados não se desfazem.');
  else if (m || o) frase += m + o === 1 ? ' Não se desfaz.' : ' Não se desfazem.';
  return { titulo: titulo, frase: frase };
}

/* Apagar os grupos marcados, depois de UMA confirmação (selLGruposFrase):
   os privados como o delGroup (definicoes.js:gruposApagarLocal), na hora e
   com o Anular; os partilhados meus apagam-se no servidor
   (grupos.js:grupoApagarNoServidor) e dos dos outros saio
   (grupos.js:grupoSairNoServidor), sem a confirmação de cada um outra vez.
   Os pedidos ao servidor vão todos; um que falhe não trava os outros, e o
   aviso do fim diz o que ficou como estava e porquê. O aviso é um só, depois
   das respostas: com privados, é o do Anular.
   Recebe: ids — os ids marcados (array).
   Devolve: nada — pede confirmação; só depois apaga, sai e avisa. */
function selLApagarGrupos(ids) {
  var gs = ids.map(function (id) { return (db.groups || []).find(function (x) { return x.id === id; }); }).filter(Boolean);
  if (!gs.length) return toast('Não está nada selecionado.');
  var partilhado = function (g) { return !!g._partilhado && typeof grupoApagarNoServidor === 'function'; };
  var priv = gs.filter(function (g) { return !partilhado(g); });
  var meus = gs.filter(function (g) { return partilhado(g) && g._meu; });
  var outros = gs.filter(function (g) { return partilhado(g) && !g._meu; });
  var q = selLGruposFrase(priv, meus, outros);
  confirmModal(q.titulo, q.frase, function () {
    var copia = priv.length ? gruposApagarLocal(priv.map(function (g) { return g.id; })) : null;
    save(); CW.selLSair(); buildNav();
    var nos = meus.concat(outros).map(function (g) {
      var feito = g._meu ? grupoApagarNoServidor(g.id) : grupoSairNoServidor(g.id);
      return feito.then(function () { return { g: g, ok: true }; }, function (e) { return { g: g, ok: false, erro: (e && e.message) || 'sem resposta do servidor' }; });
    });
    Promise.all(nos).then(function (rs) {
      var ok = rs.filter(function (r) { return r.ok; }), falhas = rs.filter(function (r) { return !r.ok; });
      var apagados = priv.length + ok.filter(function (r) { return r.g._meu; }).length, saidas = ok.length - (apagados - priv.length);
      var msg = selLGruposAviso(apagados, saidas, falhas);
      if (copia) comDesfazer(msg, function () { gruposReporLocal(copia); });
      else toast(msg, falhas.length ? { ms: 6000 } : undefined);
      if (!ok.length) return;
      return Promise.resolve(pullNow(true)).catch(function () {}).then(function () { render(); });
    });
  });
}

/* O aviso do fim do apagar dos grupos: quantos se apagaram, de quantos saí e,
   quando o servidor recusou algum, quais ficaram como estavam e porquê (a
   razão do primeiro).
   Recebe: apagados — quantos se apagaram; saidas — de quantos saí; falhas —
   [{g, erro}] dos que o servidor recusou.
   Devolve: o texto do aviso. */
function selLGruposAviso(apagados, saidas, falhas) {
  var partes = [];
  if (apagados) partes.push(apagados + (apagados === 1 ? ' grupo apagado.' : ' grupos apagados.'));
  if (saidas) partes.push('Saíste de ' + saidas + (saidas === 1 ? ' grupo.' : ' grupos.'));
  if (falhas.length) {
    var nomes = falhas.map(function (f) { return '«' + (f.g.name || 'Sem nome') + '»'; }).join(', ');
    var porque = String(falhas[0].erro).replace(/\.?\s*$/, '.');
    partes.push(nomes + (falhas.length === 1 ? ' ficou como estava: ' : ' ficaram como estavam: ') + porque);
  }
  return partes.join(' ');
}

/* Marca as visitas marcadas como realizadas ou como falta, de uma vez, com o
   Anular que devolve a cada uma o estado que tinha — como o visitas.js:visEstado
   a cada uma. Só com todas agendadas e as que posso alterar (selLVisPode):
   senão diz porquê e não muda nada.
   Recebe: estado — 'realizada' ou 'faltou'.
   Devolve: nada — grava, sai da seleção e oferece o Anular (ou avisa). */
CW.selLVisEstado = function (estado) {
  if (CW.selL.tipo !== 'vis' || (estado !== 'realizada' && estado !== 'faltou')) return;
  var ids = Object.keys(CW.selL.ids), r = selLVisPode(ids);
  if (!ids.length) return toast('Não está nada selecionado.');
  if (!r.pode) return toast(r.porque);
  var antes = [];
  ids.forEach(function (id) {
    var v = (db.visits || []).find(function (x) { return x.id === id; });
    if (v) { antes.push({ id: id, estado: v.estado }); v.estado = estado; }
  });
  save(); CW.selLSair(); buildNav();
  var n = antes.length, um = n === 1;
  var msg = estado === 'realizada'
    ? n + (um ? ' visita marcada como realizada' : ' visitas marcadas como realizadas') + ' — preenche o desfecho quando souberes.'
    : n + (um ? ' visita marcada como falta.' : ' visitas marcadas como falta.');
  comDesfazer(msg, function () {
    antes.forEach(function (x) {
      var v = (db.visits || []).find(function (y) { return y.id === x.id; });
      if (v) v.estado = x.estado;
    });
  });
};

// a folha das opções de um cartão (lpMenu) ganha a mesma porta que os
// movimentos já tinham (os planeados e os modelos têm-na na própria folha:
// planeados.js:lpPortaSelecao). O toque longo já não a abre — entra direto na
// seleção (window.lpLongo) —, mas a porta fica onde a folha se abrir
var _lpMenu_sl = lpMenu;
lpMenu = function (v) {
  var a = String(v || '').split(':'), s = selLDoLp(v);
  if (s && !SEL_PLAN[s.tipo] && tab === TABS_SEL[s.tipo] && !CW.selL.tipo) {
    // injeta "Selecionar vários" nas opções do kebab: mesma lista, mais uma
    var tipo = s.tipo, id = s.id;
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
