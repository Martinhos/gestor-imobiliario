/* Selecionar vários movimentos e tratá-los de uma vez.
   ---------------------------------------------------
   O toque longo num movimento passa a entrar em modo de seleção, com esse já
   marcado. As opções de um movimento sozinho passam para um kebab na própria
   linha — ficam a um toque em vez de a um toque longo, que ninguém adivinha.

   Em seleção há três níveis de marca: cada movimento, cada mês, e um global.
   O global e o do mês acompanham o scroll, senão a meio de uma lista de
   duzentos movimentos deixa de haver como marcar tudo sem voltar ao topo.

   Este ficheiro transforma o HTML que o vTransactions devolve, em vez de o
   reescrever. É o mesmo caminho que o painel.js já usava para os cartões da
   vista geral: a vista continua a ser de quem a escreveu, e isto acrescenta. */

'use strict';

CW.selMode = false;
var selIds = {};                      // ids marcados, como conjunto

var selN = function () { return Object.keys(selIds).length; };
var selTem = function (id) { return !!selIds[id]; };

/* ------------------------------------------------------------- entrar e sair */

// Entra em modo de seleção — opcionalmente já com um movimento marcado — e repinta a vista com as caixas.
// Recebe: id (opcional) — o id do movimento a marcar logo à entrada.
// Devolve: nada — redesenha a vista.
CW.selEntrar = function (id) {
  CW.selMode = true;
  selIds = {};
  if (id) selIds[id] = 1;
  render();
};

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
  if (selIds[id]) delete selIds[id]; else selIds[id] = 1;
  selPintar();
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
  ids.forEach(function (id) { if (todos) delete selIds[id]; else selIds[id] = 1; });
  selPintar();
};

// como o selMes, mas para todas as linhas visíveis: tudo marcado limpa, senão marca o que falta
// Recebe: ev (opcional) — o evento do toque, para lhe travar a propagação.
// Devolve: nada — repinta só as marcas.
CW.selTodos = function (ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var ids = selIdsVisiveis();
  var todos = ids.length && ids.every(selTem);
  ids.forEach(function (id) { if (todos) delete selIds[id]; else selIds[id] = 1; });
  selPintar();
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
    var c = e.querySelector('.selbox');
    if (c) c.innerHTML = caixa(on);
  });
  [].slice.call(document.querySelectorAll('#view [data-mes-box]')).forEach(function (e) {
    var ids = selIdsDoMes(e.getAttribute('data-mes-box'));
    e.innerHTML = caixa(ids.length > 0 && ids.every(selTem), ids.some(selTem));
  });
  var g = document.getElementById('selGlobal');
  if (g) {
    var ids = selIdsVisiveis();
    g.innerHTML = caixa(ids.length > 0 && ids.every(selTem), ids.some(selTem));
  }
  var n = document.getElementById('selConta');
  if (n) n.textContent = selN() ? selN() + (selN() === 1 ? ' movimento' : ' movimentos') : 'nenhum movimento';
  patchHdrSel();
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

   Agora substitui-se o ponto de extensão da linha (vistas.js:txLinhaExtra) e
   o do mês (vistas.js:txMesExtra). O que aparece no ecrã é exatamente o
   mesmo. */

var _txLinhaExtra = txLinhaExtra;
txLinhaExtra = function (t, mes) {
  var x = _txLinhaExtra(t, mes) || {};
  var id = t.id;
  x.attrs = (x.attrs || '') + ' data-tx="' + esc(id) + '" data-mes="' + esc(mes || '') + '"';
  if (CW.selMode) {
    // a caixa entra à esquerda e o toque na linha passa a marcar
    x.caixa = (x.caixa || '') + '<span class="selbox">' + caixa(selTem(id)) + '</span>';
    x.onclick = 'CW.selToggle(\'' + jsq(id) + '\',event)';
    x.attrs += ' data-toca="vista"';
    if (selTem(id)) x.cls = ((x.cls || '') + ' sel-on').trim();
  } else {
    /* Fora da seleção, um kebab com o que o toque longo dava. O toque longo
       continua a existir, mas passa a entrar em seleção — e sem o kebab as
       opções de um movimento sozinho ficavam sem porta nenhuma. */
    x.acoes = (x.acoes || '') +
      '<button type="button" class="iconbtn opcoes txkebab" aria-label="Opções"' +
      ' data-toca="camada" onclick="event.stopPropagation();CW.txOpcoes(\'' + jsq(id) + '\')">' + ic('dots', 18) + '</button>';
  }
  return x;
};

var _txMesExtra = txMesExtra;
txMesExtra = function (mes) {
  var x = _txMesExtra(mes) || {};
  if (!CW.selMode || !mes) return x;
  x.cls = ((x.cls || '') + ' sel-mes').trim();
  /* SEM style aqui: o título já leva um no template (vistas.js) e, com dois,
     o parser fica com o primeiro — o meu — e o display:flex morria. O cursor
     vai na folha, com o resto da regra .sel-mes. */
  x.attrs = (x.attrs || '') + ' data-toca="vista" onclick="CW.selMes(\'' + jsq(mes) + '\',event)"';
  x.caixa = (x.caixa || '') +
    '<span class="selbox mes" data-mes-box="' + esc(mes) + '" data-toca="vista" onclick="CW.selMes(\'' + jsq(mes) + '\',event)"></span>';
  return x;
};

/* ------------------------------------------------ a vista, com as barras */

var _vTransactions_sel = vTransactions;
vTransactions = function () {
  var html = _vTransactions_sel();
  /* sem linhas não há nada para marcar — e sair daqui evita ficar com a barra
     de seleção viva por cima de um ecrã vazio */
  if (!txLinhasPintadas) { CW.selMode = false; return html; }
  if (!CW.selMode) return html;

  // a barra global fica colada ao topo, para se poder marcar tudo a meio da lista
  /* As ações descem para onde está o polegar: quem acabou de marcar linhas
     a meio da lista não tem de subir ao canto do ecrã. A barra de baixo
     substitui a de atalhos enquanto a seleção durar; o cabeçalho mantém o
     caminho antigo para quem já o conhece. */
  var fundo =
    '<div class="sel-fundo">' +
      '<button type="button" class="btn" data-toca="modo" onclick="CW.selSair()">' + ic('x', 15) + ' Cancelar</button>' +
      '<span style="flex:1"></span>' +
      '<button type="button" class="btn" data-toca="camada" onclick="CW.selEditar()">' + ic('pen', 15) + ' Editar</button>' +
      '<button type="button" class="btn danger" data-toca="dados" data-risco="destroi" onclick="CW.selApagar()">' + ic('trash', 15) + ' Eliminar</button>' +
    '</div>';
  var barra =
    '<div class="sel-bar">' +
      '<span class="selbox" id="selGlobal" data-toca="vista" onclick="CW.selTodos(event)">' + caixa(false) + '</span>' +
      '<span style="flex:1;min-width:0;cursor:pointer" data-toca="vista" onclick="CW.selTodos(event)"><b id="selConta">nenhum movimento</b>' +
      '<span class="small" style="display:block">toca para marcar ou desmarcar tudo</span></span>' +
    '</div>';
  return barra + html + fundo;
};

/* ------------------------------------------ o toque longo e o kebab da linha */

// O kebab da linha: as opções de um movimento sozinho, mais a porta de entrada na seleção.
// Recebe: id — o id do movimento da linha.
// Devolve: nada — abre a folha de opções (lpShow); se o id não existir, não faz nada.
CW.txOpcoes = function (id) {
  var t = (db.transactions || []).find(function (x) { return x.id === id; });
  if (!t) return;
  lpShow(t.label, [
    { label: 'Editar movimento', icon: 'pen', act: function () { txModal(id); } },
    { label: 'Selecionar vários', icon: 'check', act: function () { CW.selEntrar(id); } },
    { label: 'Apagar movimento', icon: 'trash', act: function () { delTx(id); } },
  ]);
};

// nos movimentos o toque longo entra em seleção; no resto continua como estava
var _lpMenu_sel = lpMenu;
lpMenu = function (v) {
  var a = String(v || '').split(':');
  if (a[0] === 'tx' && tab === 'transactions') return CW.selEntrar(a[1]);
  return _lpMenu_sel(v);
};

/* ------------------------------------------------------- o botão do cabeçalho */

/* Veste o botão do cabeçalho para a seleção: passa a "⋯" (as ações da
   seleção), acende quando há marcas, e ganha um X ao lado para sair. Fora
   da seleção só remove o X — o render normal repõe o resto.
   Devolve: nada — mexe diretamente no botão do cabeçalho, no DOM. */
function patchHdrSel() {
  var hb = document.getElementById('hdrFilt');
  if (!hb) return;
  var x = document.getElementById('selFechar');
  if (!CW.selMode || tab !== 'transactions') {
    if (x) x.remove();
    return;
  }
  hb.style.display = '';
  hb.innerHTML = ic('dots', 18);
  hb.title = 'O que fazer com a seleção';
  hb.classList.toggle('primary', selN() > 0);
  if (!x) {
    x = document.createElement('button');
    x.id = 'selFechar';
    x.className = 'btn';
    x.style.cssText = 'flex:0 0 auto;margin-left:7px';
    x.title = 'Sair da seleção';
    x.setAttribute('data-toca', 'modo');
    x.setAttribute('onclick', 'CW.selSair()');
    x.innerHTML = ic('x', 18);
    hb.parentNode.insertBefore(x, hb.nextSibling);
  }
}

var _hdrFiltToggle_sel = hdrFiltToggle;
hdrFiltToggle = function () {
  if (CW.selMode && tab === 'transactions') return CW.selAcoes();
  return _hdrFiltToggle_sel();
};

// o menu do "⋯" do cabeçalho: editar ou eliminar a seleção (avisa se nada estiver marcado)
// Devolve: nada — abre a folha de opções (lpShow), ou um toast se nada estiver marcado.
CW.selAcoes = function () {
  var n = selN();
  if (!n) return toast('Marca pelo menos um movimento.');
  lpShow(n + (n === 1 ? ' movimento marcado' : ' movimentos marcados'), [
    { label: 'Editar seleção', icon: 'pen', act: function () { CW.selEditar(); } },
    { label: 'Eliminar seleção', icon: 'trash', act: function () { CW.selApagar(); } },
  ]);
};

/* --------------------------------------------------------- editar em massa */

/* Abre a janela de edição em massa: categoria, subcategoria e etiquetas.
   Só se aplica o que for preenchido — o resto de cada movimento fica como
   está, e as etiquetas só se acrescentam. O Aplicar é o selGravar.
   Devolve: nada — abre o modal de edição em massa (ou nada, sem marcas). */
CW.selEditar = function () {
  var ids = Object.keys(selIds);
  if (!ids.length) return;
  var tree = allCats('');
  var cats = [{ v: '', label: '— não mexer —' }].concat(
    Object.keys(tree).map(function (c) { return { v: c, label: c }; })
  );
  var tags = (db.settings.tags || []);

  openModal('Editar ' + ids.length + (ids.length === 1 ? ' movimento' : ' movimentos'),
    '<div class="form">' +
      '<div class="hint">Só se altera o que preencheres. O resto de cada movimento fica como está.</div>' +
      '<label>Categoria' + sel('selCat', '', cats, 'CW.selCatMudou', 'rascunho') + '</label>' +
      '<div id="selSubBox"><label>Subcategoria' +
        sel('selSub', '', [{ v: '', label: '— não mexer —' }], '', 'rascunho') + '</label></div>' +
      (tags.length
        ? '<div><div class="flabel">Etiquetas</div>' +
          '<div class="chips" id="selTags">' + tags.map(function (g) {
            return '<button type="button" class="tag grey" data-tag="' + esc(g) +
              '" data-toca="nada" onclick="CW.selTagToggle(this)">' + esc(g) + '</button>';
          }).join('') + '</div>' +
          '<div class="hint" style="margin-top:7px">As que marcares são <b>acrescentadas</b>. ' +
          'Nenhuma etiqueta é removida.</div></div>'
        : '') +
    '</div>',
    '<button class="btn" data-toca="camada" onclick="closeAllModals()">Cancelar</button>' +
    '<button class="btn primary" data-toca="dados" onclick="CW.selGravar()">Aplicar</button>');
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

// liga/desliga uma etiqueta na edição em massa (o estado vive na classe do próprio botão)
// Recebe: b — o próprio botão da etiqueta (elemento do DOM).
// Devolve: nada — alterna a classe .on do botão.
CW.selTagToggle = function (b) {
  b.classList.toggle('on');
};

/* Aplica a edição em massa aos movimentos marcados e grava na base. Uma
   categoria nova sem subcategoria escolhida limpa a antiga — ficava a
   apontar para a árvore errada. Etiquetas só entram, nunca saem. No fim
   fecha tudo e sai da seleção.
   Devolve: nada — grava, fecha os modais e sai da seleção (ou avisa por
   toast se nada foi preenchido). */
CW.selGravar = function () {
  var ids = Object.keys(selIds);
  var cat = val('selCat'), sub = val('selSub');
  var tags = [].slice.call(document.querySelectorAll('#selTags .tag.on'))
    .map(function (b) { return b.getAttribute('data-tag'); });
  if (!cat && !sub && !tags.length) return toast('Não escolheste nada para alterar.');

  var n = 0;
  (db.transactions || []).forEach(function (t) {
    if (!selIds[t.id]) return;
    if (cat) { t.category = cat; if (!sub) t.sub = ''; }   // categoria nova, subcategoria antiga não serve
    if (sub) t.sub = sub;
    if (tags.length) {
      t.tags = (t.tags || []).slice();
      tags.forEach(function (g) { if (t.tags.indexOf(g) < 0) t.tags.push(g); });
    }
    n++;
  });
  save(); closeAllModals(); CW.selSair();
  toast(n + (n === 1 ? ' movimento alterado.' : ' movimentos alterados.'));
};

/* Elimina os movimentos marcados: a confirmação diz quanto somam, e à saída
   fica um "Anular" de seis segundos (comDesfazer) — a cópia é tirada antes
   do corte e volta inteira se o anular for clicado.
   Devolve: nada — se for confirmado, grava e sai da seleção. */
CW.selApagar = function () {
  var ids = Object.keys(selIds);
  if (!ids.length) return;
  var total = sum(ids.map(function (id) {
    var t = (db.transactions || []).find(function (x) { return x.id === id; });
    return t ? t.amount || 0 : 0;
  }));
  confirmModal('Eliminar ' + ids.length + (ids.length === 1 ? ' movimento' : ' movimentos'),
    'Somam ' + euro2(total) + '.',
    function () {
      var copia = JSON.parse(JSON.stringify((db.transactions || []).filter(function (t) { return selIds[t.id]; })));
      db.transactions = (db.transactions || []).filter(function (t) { return !selIds[t.id]; });
      save(); buildNav(); CW.selSair();
      comDesfazer(ids.length + (ids.length === 1 ? ' movimento eliminado.' : ' movimentos eliminados.'), function () {
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
  if (!CW.selMode && !(CW.selL && CW.selL.tipo)) {
    var f = document.querySelector('.sel-fundo');
    if (f) f.remove();
  }
  if (CW.selMode) selPintar();
  return r;
};

var cssSelecao = document.createElement('style');
cssSelecao.textContent =
  // a caixa de marcar, desenhada e não <input>: um checkbox do sistema
  // destoava de tudo o resto e não aceita o tamanho que aqui é preciso
  '.selbox{flex:0 0 auto;display:inline-flex;align-items:center;padding:10px 12px 10px 2px;cursor:pointer}' +
  '.selck{width:22px;height:22px;border-radius:7px;border:1.8px solid var(--line2);' +
    'display:grid;place-items:center;color:transparent;background:var(--field)}' +
  '.selck.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}' +
  '.selck.meio{border-color:var(--accent)}' +
  '.selck.meio i{width:10px;height:2.5px;border-radius:2px;background:var(--accent);display:block}' +
  '.txrow.sel-on{border-color:var(--accent);background:var(--tint)}' +
  // o mês e o global acompanham o scroll: sem isso, a meio de uma lista longa
  // deixava de haver como marcar tudo sem voltar ao topo
  '.sel-bar{position:sticky;top:calc(57px + var(--inset-top));z-index:26;display:flex;align-items:center;' +
    'gap:2px;background:var(--bg);padding:10px 0;margin:-4px 0 6px;box-shadow:0 8px 10px -10px rgba(0,0,0,.3)}' +
  '.section-title.sel-mes{position:sticky;top:calc(114px + var(--inset-top));z-index:25;background:var(--bg);' +
    'align-items:center;padding:7px 0;margin-top:14px;cursor:pointer}' +
  '.section-title.sel-mes .selbox{padding-right:9px}' +
  // o kebab de cada linha, discreto até se lhe tocar
  '.txkebab{margin:0 0 0 4px}' +
  '.sel-fundo{position:fixed;left:0;right:0;bottom:0;z-index:45;display:flex;gap:8px;align-items:center;' +
    'background:var(--card);border-top:1px solid var(--line);' +
    'padding:8px calc(10px + var(--inset-right)) calc(8px + var(--inset-bottom)) calc(10px + var(--inset-left))}' +
  'body.sel-on .tabbar{display:none!important}' +
  'body.sel-on .wrap{padding-bottom:calc(120px + var(--inset-bottom))}' +
  '.txkebab:hover{color:var(--ink);background:var(--chip)}';
document.head.appendChild(cssSelecao);
