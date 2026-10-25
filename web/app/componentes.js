/* ================= COMPONENTES ================= */
/* menu de escolha próprio — substitui o <select> do sistema, que destoava */
window.__sel={};
/* O que o botão «Confirmar» (ou o verbo) da janela aberta pelo confirmModal
   faz: fecha a janela e corre o cb dela. Cada confirmModal troca-o, e o botão
   chama _ok(). É um var de topo para estar na lista dos nomes da app
   (eventos.js), que fecha no arranque: um window._ok posto dentro da função
   era recusado pelas ações. */
var _ok=null;
/* O que uma opção da janela aberta pelo pickModal faz: _pick(i) entrega a
   opção i ao onPick dessa janela. Cada pickModal troca-o; var de topo pela
   mesma razão do _ok. */
var _pick=null;
/* Gera o HTML de um menu de escolha. `id` fica num input escondido, de onde
   val(id) lê o valor; `options` é [{v,label}] (ou {div:true} para uma linha
   separadora); `onchange` é o NOME de uma função global, chamada quando se
   escolhe. Regista as opções em window.__sel para o selPick as encontrar.

   O `toca` é a família das OPÇÕES (docs/design.md), e tem de vir de quem cria
   o menu: daqui não há como sabê-la. A mesma opção, com o mesmo aspeto, ora
   muda o que se vê — um filtro —, ora mexe no formulário que se está a
   preencher, ora grava. Era a última fábrica da app a montar pontos de
   interação sem saber para que servem, e a razão de 16 pontos ficarem fora das
   verificações sempre que um destes menus estava aberto.
   Recebe: id — identificador único do campo (o valor escolhido fica no input
   escondido com este id, de onde val(id) o lê); value — o valor pré-selecionado
   (comparado como string; pode vir null ou vazio); options — lista [{v,label}]
   das opções, com {div:true} no lugar de uma linha separadora; onchange
   (opcional) — a função a chamar quando se escolhe, ou o nome de uma função
   de topo da app (o selPick resolve-o pelo funcaoDaApp; um handler feito na
   hora, como o dos filtros do lfSel, vai como função); toca
   (opcional) — a família das opções: 'vista' num filtro, 'rascunho' num
   formulário, 'dados' se a escolha grava logo.
   Devolve: string de HTML do menu, pronta a inserir com innerHTML. */
function sel(id,value,options,onchange,toca){
  window.__sel[id]={options:options,onchange:onchange||''};
  const cur=options.find(o=>!o.div&&String(o.v)===String(value))||options.find(o=>!o.div)||{v:'',label:'—'};
  /* O leitor de ecrã tem de saber o que isto é: o botão abre uma lista de
     escolha (aria-haspopup, aria-expanded, que o selOpen e o closePops
     acertam), a lista é uma listbox e cada opção diz se é a escolhida. As
     setas, o Home, o End e o Escape são do selTecla. O rótulo: um <label> à
     volta do sel() rotula o botão, que é o primeiro elemento rotulável lá
     dentro (o input escondido não conta). */
  const e=esc(id);
  return `<div class="sel" id="sel_${e}">
    <input type="hidden" id="${e}" value="${esc(value==null?'':value)}">
    <button type="button" class="selbtn" id="selb_${e}" aria-haspopup="listbox" aria-expanded="false" aria-controls="pop_${e}" data-toca="camada" data-click="selOpen(event,'${jsq(id)}')"><span id="lab_${e}">${esc(cur.label)}</span>${ic('chevD',16)}</button>
    <div class="selpop" id="pop_${e}" role="listbox">
      ${options.map((o,i)=>{if(o.div)return '<div class="sdiv" aria-hidden="true"></div>';const sim=String(o.v)===String(value);
        return `<button type="button" class="selopt ${sim?'on':''}" role="option" aria-selected="${sim}" data-i="${i}"${toca?` data-toca="${toca}"`:''} data-click="selPick(event,'${jsq(id)}',${i})">
        <span>${esc(o.label)}</span>${sim?ic('check',16):''}</button>`}).join('')}
    </div></div>`;
}
/* grupos no fim do dropdown, separados por uma linha
   Recebe: arr — as opções dos grupos (array).
   Devolve: as opções com o separador à frente; vazio sem grupos. */
const gdiv=arr=>arr.length?[{div:true}].concat(arr):[];
/* As opções de um sel() para os grupos de um tipo, com o valor 'g:ID'.
   Recebe: kind — o tipo dos grupos ('prop', 'owner'…).
   Devolve: array de {v, label}. */
const gOpts=kind=>grpsOf(kind).map(g=>({v:'g:'+g.id,label:'Grupo · '+g.name}));
/* fecha os menus abertos, excepto os que contêm "keep" (um menu de escolha dentro do menu de filtros
   não pode fechar o menu que o contém)
   Recebe: keep (opcional) — um elemento do DOM; os menus que o contenham ficam abertos.
   Devolve: nada — tira a classe .on aos menus abertos (e acerta o aria-expanded dos sel() e dos ⋯). */
function closePops(keep){
  const list=document.querySelectorAll('.selpop.on,.menupop.on');
  [].slice.call(list).forEach(x=>{
    if(keep&&x.contains(keep))return;
    x.classList.remove('on');
    if(x.id&&x.id.indexOf('pop_')===0)selAberto(x.id.slice(4),false);   // o botão do sel() diz que fechou
    else if(x.classList.contains('menupop'))menuExpandido(x,false);      // e o do ⋯ também
  });
}
/* Onde cabe um menu que abre a partir de um botão.

   Decisão separada da medição de propósito: é geometria pura, e é a parte
   que se pode testar sem um browser. Devolve o lado e, quando não couber
   inteiro, a altura a que tem de encolher.

   `quer` é a altura que o menu já tem com o tecto do CSS aplicado. Só se
   encolhe, nunca se cresce: deixar um menu de 16 categorias crescer até ao
   espaço disponível dava-lhe 488px e tomava conta do ecrã.

   Recebe: botao — o retângulo do botão ({top,bottom} em px do ecrã, tipicamente
   um getBoundingClientRect()); limite — {top,bottom} do espaço utilizável;
   quer — a altura (px) que o menu tem com o tecto do CSS aplicado; folga
   (opcional) — margem em px a deixar nas pontas (10 por omissão).
   Devolve: objeto {lado,maxHeight} — lado é 'cima' ou 'baixo'; maxHeight é a
   altura (px, nunca abaixo de 60) a que o menu tem de encolher, ou null quando
   cabe inteiro. */
function posicaoPop(botao, limite, quer, folga){
  folga = folga == null ? 10 : folga;
  const abaixo = limite.bottom - botao.bottom - folga;
  const acima = botao.top - limite.top - folga;
  /* só se vira para cima se lá couber melhor: um menu virado para cima que
     também não cabe é mais confuso do que um virado para baixo */
  const paraCima = quer > abaixo && acima > abaixo;
  const espaco = paraCima ? acima : abaixo;
  return {
    lado: paraCima ? 'cima' : 'baixo',
    /* nunca abaixo de 60px: um menu de dois pixeis não é um menu, e a essa
       altura é melhor deixar transbordar do que fingir que cabe */
    maxHeight: quer > espaco ? Math.max(60, Math.floor(espaco)) : null,
  };
}

/* Mede o que rodeia o menu e aplica o que o posicaoPop decidir.

   Sem isto, um menu perto do fundo abria para baixo e ficava cortado pelo
   corpo do modal — medido: 70% de um dropdown de 16 categorias fora de
   vista, sem qualquer sinal de que faltava ali alguma coisa. O limite é o
   primeiro antepassado que corta (o corpo do modal, normalmente), ou o ecrã
   quando não há nenhum.

   Os menus dentro dos painéis de filtro têm tratamento próprio em
   cloud/filtros.js, que os solta para position:fixed — esses não passam por
   aqui com o mesmo efeito, e não há conflito porque esse corre depois.

   Recebe: p — o elemento do menu (.selpop ou .menupop) a posicionar; com null
   não faz nada.
   Devolve: nada — escreve top/bottom/maxHeight nos estilos inline do menu. */
function ajustarPop(p){
  if(!p)return;
  const btn=p.parentNode.querySelector('.selbtn,.iconbtn')||p.previousElementSibling;
  if(!btn)return;
  /* repor antes de medir: uma medição feita sobre o ajuste anterior herda-o */
  p.style.top='';p.style.bottom='';p.style.maxHeight='';
  /* O espaço é o que TODOS os antepassados que cortam deixam ver, e não só o
     primeiro: um grupo de formulário que corta (o .sect de cantos redondos)
     pode estar meio rolado para fora do corpo do modal, e medir só por ele
     abria o menu para cima por cima do corpo (6px cortados no telemóvel
     deitado). */
  let limite={top:0,bottom:window.innerHeight};
  for(let a=p.parentElement;a&&a!==document.body;a=a.parentElement){
    const cs=getComputedStyle(a);
    if(/hidden|auto|scroll/.test(cs.overflow+cs.overflowX+cs.overflowY)){
      const r=a.getBoundingClientRect();
      limite={top:Math.max(limite.top,r.top),bottom:Math.min(limite.bottom,r.bottom)};
    }
  }
  /* offsetHeight e não getBoundingClientRect().height: o menu entra com um
     scale(.96) (index.html:.selpop.on) e o rect vem afetado pelo transform —
     media-se 4% a menos e a decisão de virar para cima saía errada à tangente.
     O offsetHeight é a caixa de maquetização, que o transform não toca. */
  const d=posicaoPop(btn.getBoundingClientRect(),limite,p.offsetHeight);
  if(d.lado==='cima'){p.style.top='auto';p.style.bottom='calc(100% + 5px)';}
  if(d.maxHeight)p.style.maxHeight=d.maxHeight+'px';
}

// Abre o dropdown de um sel() — ou fecha-o, se já estava aberto. Fecha os
// outros menus primeiro e deixa o ajustarPop virá-lo ou encolhê-lo para caber.
// Aberto pelo teclado (o Enter e o espaço num botão chegam como um clique com
// detail 0), o foco entra logo na opção escolhida.
// Recebe: e — o evento do clique (trava-lhe a propagação; pode vir null); id — o id dado ao sel().
// Devolve: nada — alterna a classe .on do dropdown e o aria-expanded do botão.
function selOpen(e,id){
  if(e)e.stopPropagation();
  const p=document.getElementById('pop_'+id),was=p&&p.classList.contains('on');
  closePops(p?p.parentNode:null);
  if(p&&!was){p.classList.add('on');ajustarPop(p);selAberto(id,true);if(e&&e.detail===0)selFocarEscolhida(p);}
}
/* O botão de um sel() diz se a lista dele está aberta (aria-expanded).
   Recebe: id — o id dado ao sel(); aberto — true se a lista ficou aberta.
   Devolve: nada — escreve o aria-expanded no botão selb_<id>, se existir. */
function selAberto(id,aberto){const b=document.getElementById('selb_'+id);if(b)b.setAttribute('aria-expanded',aberto?'true':'false')}
/* Leva o foco à opção escolhida de uma lista aberta (à primeira, se nenhuma o está).
   Recebe: pop — o elemento .selpop.
   Devolve: nada — foca uma das opções. */
function selFocarEscolhida(pop){
  const opts=[].slice.call(pop.querySelectorAll('.selopt'));
  const o=opts.find(x=>x.getAttribute('aria-selected')==='true')||opts[0];
  /* sem deixar o foco rolar a página: o menu já foi medido e posto (ajustarPop),
     e o focus() simples rolava o corpo do modal (o scroll-padding-bottom dele)
     por baixo do menu, que ficava 6px fora do corpo. A opção vem à vista só
     dentro da caixa do próprio menu. */
  try{
    if(o){
      o.focus({preventScroll:true});
      const t=o.offsetTop,b=t+o.offsetHeight;
      if(t<pop.scrollTop)pop.scrollTop=t;
      else if(b>pop.scrollTop+pop.clientHeight)pop.scrollTop=b-pop.clientHeight;
    }
  }catch(x){}
}
/* A opção seguinte numa lista de n, para uma tecla: as setas andam uma e param
   nas pontas (uma lista de escolha não dá a volta), Home e End vão às pontas.
   Sem opção atual (-1), a seta para baixo começa na primeira e a para cima na
   última.
   Recebe: i — o índice atual (-1 sem nenhum); n — quantas opções há; tecla — o e.key.
   Devolve: o índice novo (o mesmo i para outra tecla; -1 sem opções). */
function selIndiceSeguinte(i,n,tecla){
  if(n<1)return -1;
  if(tecla==='Home')return 0;
  if(tecla==='End')return n-1;
  if(tecla==='ArrowDown')return i<0?0:Math.min(i+1,n-1);
  if(tecla==='ArrowUp')return i<0?n-1:Math.max(i-1,0);
  return i;
}
/* O teclado de um sel(), chamado pelo ouvinte de teclas do arranque antes de
   tudo o resto. No botão, as setas (e o Home e o End) abrem a lista e levam o
   foco à opção escolhida; numa opção, andam pelas outras; o Escape com a lista
   aberta fecha-a e devolve o foco ao botão — e é engolido, para não fechar
   também a janela por baixo. O Enter e o espaço são dos próprios botões.
   Um Escape que não é de uma lista aberta passa ao menuEscape: com um menu ⋯
   aberto, fecha-o, e a janela por baixo fica.
   Recebe: e — o evento keydown.
   Devolve: true se a tecla era do sel() ou de um menu ⋯ e foi tratada; false para seguir. */
function selTecla(e){
  const t=e&&e.target;if(!t||typeof t.closest!=='function')return menuEscape(e);
  const caixa=t.closest('.sel');if(!caixa)return menuEscape(e);
  const pop=caixa.querySelector('.selpop'),btn=caixa.querySelector('.selbtn');
  if(!pop||!btn||!pop.id)return menuEscape(e);
  const k=e.key,aberto=pop.classList.contains('on');
  if(k==='Escape'){
    // a lista do sel() fechada: o Escape pode ser de um menu ⋯ aberto à volta dela
    if(!aberto)return menuEscape(e);
    if(e.preventDefault)e.preventDefault();
    closePops();try{btn.focus()}catch(x){}
    return true;
  }
  if(['ArrowDown','ArrowUp','Home','End'].indexOf(k)<0)return false;
  if(e.preventDefault)e.preventDefault();   // as setas num botão rolavam a página
  if(t===btn||!aberto){
    if(!aberto)selOpen(null,pop.id.slice(4));
    selFocarEscolhida(pop);
    return true;
  }
  const opts=[].slice.call(pop.querySelectorAll('.selopt'));
  const o=opts[selIndiceSeguinte(opts.indexOf(t),opts.length,k)];
  try{if(o)o.focus()}catch(x){}
  return true;
}
/* Escolha de uma opção: escreve o valor no input escondido, troca o rótulo do
   botão, marca a opção como a escolhida (aria-selected), fecha o menu e chama
   o onchange registado (pelo nome, em window) — é por aí que os formulários
   reagem à mudança. Escolhida pelo teclado, o foco volta ao botão.
   Recebe: e — o evento do clique (pode vir null); id — o id dado ao sel();
   i — o índice da opção escolhida em window.__sel[id].options.
   Devolve: nada — atualiza o input, o rótulo e as opções no DOM e chama o onchange. */
function selPick(e,id,i){
  if(e)e.stopPropagation();
  const cfg=window.__sel[id]||{options:[]},o=cfg.options[i];if(!o)return;
  const inp=document.getElementById(id);if(inp)inp.value=o.v;
  const lab=document.getElementById('lab_'+id);if(lab)lab.textContent=o.label;
  const pop=document.getElementById('pop_'+id);
  if(pop){
    pop.classList.remove('on');
    [].slice.call(pop.querySelectorAll('.selopt')).forEach(b=>b.setAttribute('aria-selected',b.getAttribute('data-i')===String(i)?'true':'false'));
  }
  selAberto(id,false);
  if(e&&e.detail===0){const b=document.getElementById('selb_'+id);try{if(b)b.focus()}catch(x){}}
  /* o onchange é uma função, ou o nome de uma função da app, resolvido pelo
     funcaoDaApp (eventos.js): um nome do browser ou uma nativa rebenta */
  const f=typeof cfg.onchange==='function'?cfg.onchange:(cfg.onchange&&typeof funcaoDaApp==='function'?funcaoDaApp(cfg.onchange,true):null);
  if(f)f();
}
/* menu de ações (⋯)

   A família de cada opção vem de QUEM CHAMA, e não daqui: uma fábrica que
   inventasse a família mentiria, porque o mesmo menu serve opções que abrem
   uma janela, opções que gravam e opções que destroem. Era este o buraco que
   deixava os pontos mais perigosos da app — apagar um imóvel, um contrato,
   uma hipoteca, um cargo — sem maneira de se declararem.

   E não se deriva do `danger`, que só quer dizer «pinta de vermelho»: o
   «Recusar desta vez» é vermelho e não destrói nada.
   Recebe: id — sufixo único do menu (o pop fica em menu_<id>); items — lista de
   {label,act,icon,danger,toca,risco}: act é o código inline do onclick, icon
   (opcional) o nome do ícone, danger (opcional) pinta a opção de vermelho,
   toca é a família do ponto (docs/design.md) e risco='destroi' marca o que
   apaga alguma coisa.
   Devolve: string de HTML do botão ⋯ com o menu, pronta a inserir com innerHTML. */
function menu(id,items){
  return `<span class="menuwrap"><button type="button" class="iconbtn opcoes" data-toca="camada" data-click="menuOpen(event,'${jsq(id)}')" aria-label="Opções" aria-expanded="false">${ic('dots',18)}</button>
    <div class="menupop" id="menu_${esc(id)}">${items.map(it=>
      `<button type="button" class="${it.danger?'danger':''}"${it.toca?` data-toca="${it.toca}"`:''}${it.risco==='destroi'?' data-risco="destroi"':''} data-click="closePops();${it.act}">${ic(it.icon||'dots',17)} ${esc(it.label)}</button>`).join('')}</div></span>`;
}
// Abre/fecha o menu de ações (⋯) criado por menu(), com o mesmo ajuste de posição dos sel().
// O botão diz se o menu está aberto (aria-expanded); fechar passa pelo closePops, que o repõe.
// Recebe: e — o evento do clique (pode vir null); id — o id dado ao menu() (abre menu_<id>).
// Devolve: nada — alterna a classe .on do menu no DOM.
function menuOpen(e,id){
  if(e)e.stopPropagation();
  const p=document.getElementById('menu_'+id),was=p&&p.classList.contains('on');
  closePops(p?p.parentNode:null);if(p&&!was){p.classList.add('on');menuExpandido(p,true);ajustarPop(p);};
}
/* O botão que abre um menu ⋯: o do menuOpen ao lado dele, no mesmo
   .menuwrap — o do menu() e os feitos à mão (o «Partilhar» da Avaliação).
   Recebe: p — o .menupop.
   Devolve: o botão, ou null. */
function menuBotao(p){
  const w=p&&p.parentNode;
  return w&&typeof w.querySelector==='function'?w.querySelector('[data-click^="menuOpen("]'):null;
}
/* Diz ao leitor de ecrã se o menu está aberto, no botão que o abre.
   Recebe: p — o .menupop; aberto — true/false.
   Devolve: nada. */
function menuExpandido(p,aberto){
  const b=menuBotao(p);if(b)b.setAttribute('aria-expanded',aberto?'true':'false');
}
/* O Escape com um menu ⋯ aberto fecha o menu, e não a janela por baixo dele:
   o foco volta ao botão que o abriu e a tecla é engolida (o selTecla, a quem
   o arranque pergunta primeiro, chama-o quando a tecla não é de um sel()).
   Recebe: e — o evento keydown.
   Devolve: true se havia um menu aberto e fechou; false para seguir. */
function menuEscape(e){
  if(!e||e.key!=='Escape')return false;
  const abertos=[].slice.call(document.querySelectorAll('.menupop.on'));
  if(!abertos.length)return false;
  const b=menuBotao(abertos[abertos.length-1]);
  if(e.preventDefault)e.preventDefault();
  closePops();
  try{if(b)b.focus()}catch(x){}
  return true;
}
/* etiquetas removíveis
   Recebe: items — lista de {id,label} das etiquetas a mostrar; addLabel — o texto
   do botão de adicionar; addAct — o código inline do onclick desse botão;
   removeAct — o nome de uma função global, chamada com o id da etiqueta a remover;
   cls (opcional) — classe CSS extra para cada etiqueta; tocaAdd (opcional) — a
   família do botão de acrescentar, porque nem sempre é a mesma: aqui mexe no
   rascunho, no contrato abre um pickModal para escolher o inquilino.
   Devolve: string de HTML da caixa de etiquetas, pronta a inserir com innerHTML. */
function tagField(items,addLabel,addAct,removeAct,cls,tocaAdd){
  return `<div class="tagbox">
    ${items.map(it=>`<span class="tag ${cls||''}">${esc(it.label)}
      <button type="button" data-toca="rascunho" data-click="${removeAct}('${jsq(it.id)}')" aria-label="Remover">${ic('x',13)}</button></span>`).join('')}
    <button type="button" class="tagadd" data-toca="${tocaAdd||'rascunho'}" data-click="${addAct}">+ ${esc(addLabel)}</button></div>`;
}
/* secção que abre e fecha; o estado dura enquanto a janela estiver aberta */
let foldState={};
/* Devolve o HTML de uma secção dobrável. `o.open` é só o estado inicial:
   depois manda o foldState, para a dobra sobreviver aos re-renders.
   `o.summary` aparece no cabeçalho, visível mesmo com a secção fechada.
   Recebe: id — identificador da secção (o elemento fica em fold_<id> e é a chave
   no foldState); title — HTML do título do cabeçalho; body — HTML do conteúdo;
   o (opcional) — {open,icon,summary}: estado inicial, nome do ícone e resumo.
   Devolve: string de HTML da secção dobrável, pronta a inserir com innerHTML. */
function fold(id,title,body,o){
  o=o||{};const open=foldState[id]===undefined?!!o.open:foldState[id];
  return `<div class="sect fold ${open?'open':''}" id="fold_${esc(id)}">
    <button type="button" class="fold-head" data-toca="nada" data-click="toggleFold('${jsq(id)}')"><span class="ic">${ic(o.icon||'dots',17)}</span><b>${title}</b>
      ${o.summary?`<span class="fsum">${o.summary}</span>`:''}<span class="chev">${ic('chevD',16)}</span></button>
    <div class="fold-body">${body}</div></div>`;
}
// abre ou fecha a secção no DOM e guarda o estado, para o próximo render o respeitar
// Recebe: id — o id dado ao fold() (procura o elemento fold_<id>).
// Devolve: nada — alterna a classe .open no DOM e guarda o estado em foldState.
function toggleFold(id){
  const el=document.getElementById('fold_'+id);if(!el)return;
  const on=!el.classList.contains('open');
  el.classList.toggle('open',on);foldState[id]=on;
  /* marca de quem abriu agora, para o conteúdo entrar (index.html:.fold.entra).
     Fica lá: um re-render deita o nó fora e o próximo nasce sem ela — que é o
     que faz a dobra já aberta não voltar a piscar. */
  if(on)el.classList.add('entra');
  if(on)ajustarCaixas(el);   // as caixas de texto lá dentro mediam 0 enquanto estava fechada
}
// o browser cresce as caixas de texto sozinho (field-sizing do CSS)? Então o ajustarCaixas não faz nada.
const caixaSozinha=typeof CSS!=='undefined'&&!!CSS.supports&&CSS.supports('field-sizing','content');
/* As caixas de texto crescem com o que lá está escrito, em vez de ficarem nos
   90px com uma barra de deslizar. O CSS faz isto sozinho onde houver
   field-sizing (estilos.css:textarea); onde não houver (Firefox, Safari
   antigo), mede-se aqui: altura a zero, e fica a do conteúdo mais as bordas.
   Uma caixa escondida (dobra fechada) mede 0 e fica como está; a dobra pede
   outra medida ao abrir (toggleFold).
   Recebe: raiz (opcional) — onde procurar as caixas (o documento por omissão),
   ou a própria caixa.
   Devolve: nada — muda o style.height das caixas visíveis. */
function ajustarCaixas(raiz){
  if(caixaSozinha)return;
  raiz=raiz||document;
  const caixas=raiz.tagName==='TEXTAREA'?[raiz]:[].slice.call(raiz.querySelectorAll('textarea'));
  caixas.forEach(t=>{
    if(!t.offsetParent)return;
    const cs=getComputedStyle(t),bordas=parseFloat(cs.borderTopWidth)+parseFloat(cs.borderBottomWidth);
    t.style.height='auto';
    t.style.height=(t.scrollHeight+bordas)+'px';
  });
}
/* Os ficheiros escolhidos no <input type="file"> do fileBlock, entregues a
   quem os pediu. Era o onchange em linha «${onPick}(this)» (com o argumento
   extra, «${onPick}(this,'arg')»), que a gramática das ações não escreve: o
   nome da função vinha de um ${…} no lugar do nome.
   O nome vem de uma ação, que pode ser injetada: resolve-se pelo funcaoDaApp
   (eventos.js), que só devolve funções da app — como no delFileConfirm.
   Recebe: input — o <input type="file"> onde se escolheram os ficheiros (o
   this da ação); fn — o nome da função da app que os recebe; arg — o
   argumento extra do fileBlock (opts.arg), ou vazio quando não há nenhum: a
   ação escreve-o sempre, porque um ${…} entre argumentos não passa na
   gramática, e é aqui que o vazio volta a querer dizer «sem argumento».
   Devolve: nada — chama a função da app com (input), ou com (input, arg)
   quando o argumento extra existe; rebenta se o nome não é de uma função da
   app (o alert, o fetch…), e não faz nada se o nome não existir. */
function escolherFicheirosDoBloco(input,fn,arg){
  const f=typeof funcaoDaApp==='function'?funcaoDaApp(fn,true):null;
  if(!f)return;
  if(arg)f(input,arg);else f(input);
}
/* Abre o seletor de ficheiros do fileBlock: o botão «Adicionar…» passa o
   clique ao <input type="file"> escondido. Era o onclick em linha
   «document.getElementById('…').click()», que a gramática das ações não
   escreve: o document não é um nome da app.
   Recebe: id — o id do input escondido do bloco.
   Devolve: nada — clica no input. */
function abrirSeletorFicheiros(id){
  document.getElementById(id).click();
}
/* bloco de ficheiros reutilizável
   Recebe: label — título por cima da lista (vazio para não mostrar); list — lista
   de metadados {id,name,size,added} dos ficheiros já anexados; inputId — id do
   <input type=file> escondido; onPick — nome de uma função global chamada quando
   se escolhem ficheiros (recebe o input e, se opts.arg existir, esse argumento);
   delFn — nome de uma função global que apaga pelo id (só corre depois da
   confirmação); opts (opcional) — {photos,move,arg,addLabel,hint}: modo
   fotografias com miniaturas, puxador de reordenação, argumento extra do onPick,
   rótulo do botão de adicionar e nota por baixo.
   Devolve: string de HTML do bloco, pronta a inserir com innerHTML. */
function fileBlock(label,list,inputId,onPick,delFn,opts){
  opts=opts||{};
  const photos=opts.photos;
  return `<div>${label?`<div class="flabel">${esc(label)}</div>`:''}
    ${list.length?(photos?
      `<div class="list u-g-8px">${list.map((f,i)=>`<div class="prow">
         <div class="pth pcover" id="th_${esc(f.id)}" data-click="openMeta('${jsq(f.id)}',true)">${i===0?'<span class="capa">capa</span>':''}</div>
         <input class="pnm" id="fn_${esc(f.id)}" value="${esc(f.name)}" placeholder="Ex: Sala de estar" aria-label="Nome da fotografia (opcional)" autocomplete="off" data-input="livePhotoName('${jsq(f.id)}',this.value)">
         ${opts.move?`<button type="button" class="pgrab" aria-label="Arrastar para reordenar" data-pointerdown="photoDrag(event,this,${i})">${ic('grip',16)}</button>`:''}
         <button type="button" class="btn sm danger u-fx-0-0-auto u-minw-40px u-minh-40px u-ml-8px" aria-label="Apagar a fotografia" data-click="delFileConfirm('${jsq(delFn)}','${jsq(f.id)}','fotografia')">${ic('trash',14)}</button></div>`).join('')}</div>`
      :`<div class="list u-g-8px u-mb-9px">${list.map(f=>`
        <div class="card u-p-10px-12px"><div class="row-between u-ai-center">
          <div class="u-minw-0 u-cur-pointer" data-click="openMeta('${jsq(f.id)}')">
            <div class="u-fw-600 u-fs-13p5px u-ov-hidden u-to-ellipsis u-ws-nowrap">${esc(f.name)}</div>
            <div class="small">${kb(f.size)}${f.added?' · '+dPT(f.added):''}</div></div>
          <button type="button" class="btn sm danger u-minw-40px u-minh-40px" aria-label="Apagar o ficheiro" data-click="delFileConfirm('${jsq(delFn)}','${jsq(f.id)}','ficheiro')">${ic('trash',14)}</button>
        </div></div>`).join('')}</div>`):''}
    <input type="file" id="${esc(inputId)}" multiple ${photos?'accept="image/*"':''} class="u-d-none" data-change="escolherFicheirosDoBloco(this,'${jsq(onPick)}','${jsq(opts.arg||'')}')">
    <button type="button" class="btn sm u-mt-9px" data-click="abrirSeletorFicheiros('${jsq(inputId)}')">${ic(photos?'photo':'clip',14)} ${opts.addLabel||(photos?'Adicionar fotos':'Adicionar ficheiro')}</button>
    ${opts.hint?`<div class="hint u-mt-8px">${opts.hint}</div>`:''}</div>`;
}
/* A confirmação que faltava: o apagar ficava a 8px do puxador de arrastar,
   ambos pequenos, e o toque falhado destruía o ficheiro no ato — do
   IndexedDB, sem undo. Agora pergunta, e diz o que se perde.
   O nome vem de uma ação, que pode ser injetada: resolve-se pelo funcaoDaApp
   (eventos.js), que só devolve funções da app.
   Recebe: fn — o nome da função da app que apaga; fid — o id do ficheiro,
   passado a essa função; tipo — 'fotografia' ou 'ficheiro', para o texto da pergunta.
   Devolve: nada — abre a janela de confirmação; só se apaga depois do sim;
   rebenta logo, sem perguntar, se o nome não é de uma função da app (o alert,
   o fetch…). */
function delFileConfirm(fn,fid,tipo){
  const daApp=nome=>typeof funcaoDaApp==='function'?funcaoDaApp(nome,true):null;
  daApp(fn);
  const foto=tipo==='fotografia';
  confirmModal(foto?'Apagar a fotografia':'Apagar o ficheiro',
    (foto?'A fotografia':'O ficheiro')+' desaparece já daqui e do armazenamento. Não há como desfazer.',
    ()=>{const f=daApp(fn);if(f)f(fid)});
}
// Abre a ficha do ficheiro `fid` (nome, tamanho, pré-visualização), procurando-o
// entre os metadados já guardados e os pendentes do formulário aberto. Uma
// foto de um imóvel abre no carrossel das fotos dele (anexos.js:fotoCarrossel).
// Recebe: fid — o id do ficheiro cuja ficha se abre; doFormulario (opcional) —
// verdadeiro quando vem das fotos do formulário do imóvel (o fileBlock): o
// carrossel segue a ordem de lá, com as fotos ainda por gravar.
// Devolve: nada — abre a janela com a ficha do ficheiro.
function openMeta(fid,doFormulario){openFileMeta(allFileMetas().concat(pendingMetas()).find(f=>f.id===fid),!!doFormulario)}
/* mostra as miniaturas depois do HTML entrar no DOM. "root" limita a procura (a lista de imóveis
   e a janela aberta por cima usam os mesmos ids). */
/* As miniaturas em memória são sempre as de 220px (makeThumb), nunca o
   original: uma foto de câmara de 12 MP descodificada são uns 48 MB, e dez
   delas em caixas de 64×52 punham o telemóvel a arrastar-se a cada repinte
   e a cada letra escrita no nome. Até a miniatura existir, a caixa fica com
   o marcador de sempre (o fundo --chip da .pth, como as que ainda vêm do
   IndexedDB). Fazem-se no máximo MINIATURAS_A_PAR de cada vez — dez fotos
   escolhidas juntas eram dez descodificações inteiras ao mesmo tempo —, e um
   pedido que já está a caminho serve quem pedir a mesma foto entretanto (o
   takeFiles começa-a, o repaintProp pede-a logo a seguir). */
const MINIATURAS_A_PAR=2;
/* Um original que o browser não consegue encolher (um SVG, um formato que o
   createImageBitmap não lê) só vai para a caixa se for leve; senão fica o
   marcador. */
const MINIATURA_ORIGINAL_MAX=1048576;
const _miniaturaPedida={},_filaMiniaturas=[];
let _miniaturasAFazer=0;
/* Corre um trabalho na fila das miniaturas, com no máximo MINIATURAS_A_PAR
   ao mesmo tempo.
   Recebe: fazer — função que devolve uma promessa (o makeThumb de um blob).
   Devolve: promessa do que o trabalho devolver. */
function naFilaDasMiniaturas(fazer){
  return new Promise((res,rej)=>{
    const vez=()=>{
      _miniaturasAFazer++;
      let p;try{p=Promise.resolve(fazer())}catch(e){p=Promise.reject(e)}
      const fim=()=>{_miniaturasAFazer--;const seg=_filaMiniaturas.shift();if(seg)seg()};
      p.then(v=>{fim();res(v)},e=>{fim();rej(e)});
    };
    if(_miniaturasAFazer<MINIATURAS_A_PAR)vez();else _filaMiniaturas.push(vez);
  });
}
/* Uma miniatura pedida uma vez só: quem a pedir enquanto ela se faz recebe a
   mesma promessa.
   Recebe: id — o id da foto; fazer — função que devolve a promessa do URL.
   Devolve: promessa do object URL da miniatura (ou null). */
function pedirMiniatura(id,fazer){
  if(_miniaturaPedida[id])return _miniaturaPedida[id];
  const p=fazer().then(u=>{delete _miniaturaPedida[id];return u},e=>{delete _miniaturaPedida[id];throw e});
  _miniaturaPedida[id]=p;
  return p;
}
/* Faz a miniatura de 220px de um blob (na fila), guarda-a no IndexedDB como
   tn_<id> e em memória. Se o browser não a conseguir fazer, só um original
   leve (MINIATURA_ORIGINAL_MAX) vai para a caixa.
   Recebe: id — o id da foto; blob — o original.
   Devolve: promessa do object URL guardado, ou null (fica o marcador). */
function miniaturaDoBlob(id,blob){
  return naFilaDasMiniaturas(()=>makeThumb(blob)).then(tb=>{
    if(!tb)throw new Error('sem miniatura');
    idbPut('tn_'+id,tb).catch(()=>{});
    return guardarMiniatura(id,URL.createObjectURL(tb));
  }).catch(()=>blob&&blob.size<=MINIATURA_ORIGINAL_MAX?guardarMiniatura(id,URL.createObjectURL(blob)):null);
}
/* Começa a miniatura de uma foto acabada de escolher (anexos.js:takeFiles),
   a partir do ficheiro que já está na mão.
   Recebe: id — o id da foto; blob — o ficheiro escolhido.
   Devolve: promessa do object URL da miniatura, ou null. */
function fazerMiniatura(id,blob){return pedirMiniatura(id,()=>miniaturaDoBlob(id,blob))}
/* miniatura pequena de uma foto: usa a que está em memória, a guardada (tn_),
   ou cria-a uma vez a partir do original (miniaturaDoBlob).
   Recebe: id — o id da foto (chave do blob no IndexedDB; a miniatura vive em tn_<id>).
   Devolve: Promise que resolve para um object URL da miniatura, ou null quando
   o blob não existe (ou não dá miniatura e é pesado). */
function thumbSrc(id){
  /* o thumbCache tem teto (anexos.js:guardarMiniatura): usar uma marca-a como recente */
  if(thumbCache[id]){usarMiniatura(id);return Promise.resolve(thumbCache[id])}
  return pedirMiniatura(id,()=>idbGet('tn_'+id).then(tb=>{
    if(tb)return guardarMiniatura(id,URL.createObjectURL(tb));
    return idbGet(id).then(b=>b?miniaturaDoBlob(id,b):null);
  }));
}
/* Encolhe uma imagem para miniatura (lado maior ≤ 220px) e devolve uma Promise
   com o blob JPEG. Nunca amplia; rejeita se o blob não for imagem legível.
   Recebe: blob — a imagem original (Blob), tal como vive no IndexedDB.
   Devolve: Promise que resolve para um Blob JPEG da miniatura (lado maior ≤ 220px);
   rejeita se o blob não for uma imagem legível. */
function makeThumb(blob){
  return createImageBitmap(blob).then(bm=>{
    const k=Math.min(1,220/Math.max(bm.width,bm.height));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(bm.width*k));c.height=Math.max(1,Math.round(bm.height*k));
    c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
    try{bm.close()}catch(e){}
    return new Promise(r=>c.toBlob(r,'image/jpeg',.78));
  });
}
/* Pinta as miniaturas depois do HTML entrar no DOM: para cada ficheiro da
   lista resolve a miniatura (thumbSrc) e mete o <img> na caixa th_<id>.
   `root` limita a procura — por omissão à janela de cima, porque a lista
   por baixo usa os mesmos ids.
   Recebe: list — lista de metadados {id,…} das fotos a pintar (pode vir vazia ou
   null); root (opcional) — o elemento onde procurar as caixas th_<id> (por
   omissão, a janela de cima; sem janela, o documento).
   Devolve: nada — insere os <img> nas caixas à medida que as miniaturas chegam. */
function paintThumbs(list,root){
  root=root||(modalTop()?modalTop().el:document);
  (list||[]).forEach(f=>{
    const box=root.querySelector('[id="th_'+f.id+'"]');if(!box)return;
    thumbSrc(f.id)
      .then(src=>{if(src&&box){const o=box.querySelector('img');if(o)o.remove();box.insertAdjacentHTML('afterbegin',`<img src="${src}" alt="">`)}}).catch(()=>{});
  });
}
// guarda o nome da foto no pForm à medida que se escreve, para não se perder num repinte
// Recebe: id — o id da foto em pForm.photos; v — o nome tal como está escrito no campo.
// Devolve: nada — atualiza o name da foto em memória.
function livePhotoName(id,v){const f=(window.pForm&&pForm.photos||[]).find(x=>x.id===id);if(f)f.name=v}

/* ================= O TECLADO DO TELEMÓVEL E O CAMPO COM O FOCO =================
   O teclado sobe por cima da página e pode tapar o campo onde se vai
   escrever. Antes, cada foco num campo punha o .kb na folha (300px de folga
   no fundo do corpo, o que refazia o layout dela) e, 260ms depois, centrava
   o campo com scroll suave — mesmo um campo à vista: o nome de uma foto
   fugia de baixo do dedo a meio do toque longo para selecionar texto.
   Agora o campo só se mexe se o teclado (ou a borda do corpo da janela) o
   tapa, medido pela janela visível (visualViewport), e de uma vez, sem
   scroll suave por baixo do dedo; a folga .kb só entra quando o corpo não
   tem para onde rolar sem ela. Espera-se o teclado assentar: o resize da
   janela visível (alisado), ou KB_ESPERA sem resize nenhum (o teclado já
   estava aberto, ou não há teclado). Vale para todos os campos (o focusin
   do arranque.js). */
const KB_ESPERA=300;
// a folga (px) entre o campo e a borda do que se vê, para não ficar colado ao teclado
const KB_FOLGA=12;
let _kbEspera=null;
/* O retângulo do que se vê de um campo: a janela visível (sem o teclado)
   e, dentro de uma janela, o corpo dela.
   Recebe: corpo — o .body da janela (ou null fora de uma janela); vv — o
   window.visualViewport (ou null).
   Devolve: {top, bottom} em px do ecrã. */
function kbAreaVisivel(corpo,vv){
  let top=vv?(vv.offsetTop||0):0,bottom=vv?top+vv.height:(window.innerHeight||0);
  if(corpo&&typeof corpo.getBoundingClientRect==='function'){
    const r=corpo.getBoundingClientRect();
    top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);
  }
  return {top,bottom};
}
/* O campo está à vista (com a folga), ou o teclado/a borda tapa-o?
   Recebe: r — o getBoundingClientRect do campo; area — de kbAreaVisivel.
   Devolve: true se está todo à vista. */
function kbCampoAVista(r,area){
  return r.top>=area.top+KB_FOLGA&&r.bottom<=area.bottom-KB_FOLGA;
}
/* Traz o campo com o foco para a vista, só se estiver tapado: centra-o no
   que se vê do corpo da janela, de uma vez; a folga .kb só entra se o
   corpo não chega lá sem ela. Fora de uma janela, o scrollIntoView de
   sempre, sem suave.
   Recebe: t — o campo (já com o foco).
   Devolve: true se mexeu no scroll, false se o campo já estava à vista (ou
   perdeu o foco entretanto). */
function campoAVista(t){
  if(!t||typeof t.getBoundingClientRect!=='function'||document.activeElement!==t)return false;
  const vv=window.visualViewport||null;
  const s=typeof t.closest==='function'?t.closest('.sheet'):null;
  const corpo=s&&typeof s.querySelector==='function'?s.querySelector('.body'):null;
  const dentro=!!(corpo&&typeof corpo.contains==='function'&&corpo.contains(t));
  const area=kbAreaVisivel(dentro?corpo:null,vv),r=t.getBoundingClientRect();
  if(kbCampoAVista(r,area))return false;
  if(!dentro){try{t.scrollIntoView({block:'center'})}catch(e){}return true}
  const quer=Math.round((r.top+r.bottom)/2-(area.top+area.bottom)/2);
  if(quer>0&&corpo.scrollHeight-corpo.clientHeight-corpo.scrollTop<quer)s.classList.add('kb');
  corpo.scrollTop+=quer;
  return true;
}
/* O foco entrou num campo de escrever: espera o teclado assentar e traz o
   campo para a vista se ele o tapar (campoAVista). Um foco novo esquece o
   anterior; o ouvinte do resize sai ao fim de um segundo e pouco.
   Recebe: t — o campo que ganhou o foco.
   Devolve: nada. */
function campoAVistaQuandoAssentar(t){
  if(_kbEspera)_kbEspera.parar();
  const vv=window.visualViewport||null;
  const e={tm:0,fim:0,parar(){clearTimeout(e.tm);clearTimeout(e.fim);if(vv&&vv.removeEventListener)vv.removeEventListener('resize',mexeu);if(_kbEspera===e)_kbEspera=null}};
  const ver=()=>{if(_kbEspera===e)campoAVista(t)};
  // o teclado anima: o resize chega várias vezes, e só o último conta
  const mexeu=()=>{clearTimeout(e.tm);e.tm=setTimeout(ver,80)};
  if(vv&&vv.addEventListener)vv.addEventListener('resize',mexeu);
  e.tm=setTimeout(ver,KB_ESPERA);
  e.fim=setTimeout(()=>e.parar(),KB_ESPERA+900);
  _kbEspera=e;
}

/* ================= MODAL =================
   Janelas empilhadas: abrir uma segunda janela não fecha a primeira — fica por baixo,
   escurecida e inerte, e volta quando a de cima fecha. Só a janela de cima mantém os
   ids (os da de baixo passam para data-mid), por isso getElementById continua a apontar
   para o formulário que está a ser editado. */
let modalStack=[];
// a janela de cima da pilha, ou null se não há nenhuma aberta
// Devolve: a camada de cima ({el,title,onSave,snap,tocado,gatilho}), ou null sem janelas.
const modalTop=()=>modalStack[modalStack.length-1]||null;
// o elemento .body da janela de cima — onde as vistas repintam o conteúdo (null sem janela)
// Devolve: o elemento .body da janela de cima, ou null se não houver janela aberta.
const modalBodyEl=()=>{const t=modalTop();return t?t.el.querySelector('.body'):null};
Object.defineProperty(window,'onSave',{configurable:true,
  get(){const t=modalTop();return t?t.onSave:null},
  set(v){const t=modalTop();if(t)t.onSave=v}});
// Constrói e devolve o esqueleto DOM de uma janela vazia (véu, cabeçalho com X,
// corpo e rodapé) — quem chama pendura-o no body e preenche-o com o fillModal.
// Devolve: o elemento DOM da janela (div.modal.open), ainda por pendurar no documento.
function modalLayer(){
  const m=document.createElement('div');m.className='modal open';
  m.innerHTML=`<div class="bg" data-toca="camada" data-click="closeModal('fundo')"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
    <div class="head"><h2 id="modalTitle"></h2><div class="spacer"></div><span id="modalMenu"></span>
      <button class="iconbtn" data-toca="camada" data-click="closeModal('x')" aria-label="Fechar">${ic('x')}</button></div>
    <div class="body" id="modalBody"></div><div class="foot" id="modalFoot"></div></div>`;
  /* o arrasto da folha para baixo (folhaPousar) trava o scroll do browser
     aqui, e não no documento — e só enquanto a folha se pode agarrar pelo
     corpo (folhaOuvirToque): no resto do tempo os toques não esperam por ele */
  const corpo=m.querySelector('.body');
  if(corpo)corpo.addEventListener('scroll',()=>folhaOuvirToque(m),{passive:true});
  folhaOuvirToque(m);
  return m;
}
/* O que está escrito na janela, numa string comparável. É o suficiente para
   saber se fechar deita fora trabalho de alguém.
   Recebe: el — o elemento da janela cujos campos se leem.
   Devolve: string com os valores de todos os campos (checkboxes como 1/0),
   separados por um carácter de controlo — duas iguais quer dizer nada mudou. */
function modalSnap(el){
  return [].slice.call(el.querySelectorAll('input,select,textarea'))
    .map(x=>x.type==='checkbox'||x.type==='radio'?(x.checked?'1':'0'):String(x.value||''))
    .join('\x1f');
}
/* Manda uma janela para baixo da pilha: os ids passam a data-mid (para o
   getElementById só ver a de cima), e a janela fica escurecida e inerte.
   Recebe: el — o elemento da janela a mandar para baixo.
   Devolve: nada — troca os ids por data-mid e deixa a janela escurecida e inerte. */
function demote(el){
  [].slice.call(el.querySelectorAll('[id]')).forEach(x=>{x.setAttribute('data-mid',x.id);x.removeAttribute('id')});
  el.classList.add('under');el.setAttribute('aria-hidden','true');try{el.inert=true}catch(e){}
}
// o inverso do demote: devolve os ids à janela e torna-a de novo utilizável quando a de cima fecha
// Recebe: el — o elemento da janela a repor.
// Devolve: nada — repõe os ids nos elementos e torna a janela utilizável.
function promote(el){
  [].slice.call(el.querySelectorAll('[data-mid]')).forEach(x=>{x.id=x.getAttribute('data-mid');x.removeAttribute('data-mid')});
  el.classList.remove('under');el.removeAttribute('aria-hidden');try{el.inert=false}catch(e){}
}
/* As etiquetas que se tiram de todo o HTML que entra numa janela, por mais
   nenhuma razão senão defesa em profundidade: uma ação declarada chega às
   funções que recebem HTML (openModal, fillModal, confirmModal, pickModal), e
   quem conseguisse injetar HTML tinha nelas uma porta. Um <iframe srcdoc>
   corre qualquer script desta origem com acesso ao parent e ao armazenamento,
   e a CSP não o trava — o srcdoc herda-a e o script-src 'self' aceita os
   ficheiros da app; um http-equiv=refresh e um <base> navegam ou mudam o
   destino de todas as ligações; um object e um embed correm conteúdo. Nenhuma
   janela da app põe qualquer uma delas de propósito (procurado em web/), por
   isso tirá-las não muda nada do que se vê — e fecha a porta. A primeira
   defesa continua a ser o escape (formato.js:esc, formato.js:jsq). */
const ETIQUETAS_QUE_CORREM=/<\/?(?:iframe|meta|base|object|embed)\b[^>]*>/gi;
/* Tira de um HTML as etiquetas de cima.
   Recebe: h — o HTML (nulo vale vazio).
   Devolve: o mesmo HTML sem essas etiquetas. */
function semEtiquetasQueCorrem(h){return String(h==null?'':h).replace(ETIQUETAS_QUE_CORREM,'')}
/* Marca os campos de data vazios com data-vazio, para o Safari do iPhone lhes
   escrever «dd/mm/aaaa» (estilos.css, dentro de @supports
   (-webkit-touch-callout:none)). Um <input type="date"> ignora o placeholder:
   o Chrome e o Android escrevem o formato sozinhos, o iPhone deixa o campo em
   branco. Corre depois de cada corpo posto no DOM (fillModal, render, os
   repintes dos formulários) e a cada input/change num campo de data
   (eventos.js:ligarDatasVazias), que é o que tira a marca quando se escolhe
   uma data e a repõe quando se apaga.
   Recebe: raiz — o elemento onde procurar os campos, ou o próprio campo de
   data; com null não faz nada.
   Devolve: nada — põe ou tira o atributo data-vazio em cada campo de data
   (e só neles: o que não é um campo de data com atributos fica como está). */
function marcarDatasVazias(raiz){
  if(!raiz)return;
  const marca=e=>{if(!e||e.type!=='date'||typeof e.setAttribute!=='function')return;
    if(e.value)e.removeAttribute('data-vazio');else e.setAttribute('data-vazio','')};
  if(raiz.tagName==='INPUT'){marca(raiz);return}
  if(typeof raiz.querySelectorAll!=='function')return;
  [].slice.call(raiz.querySelectorAll('input[type=date]')).forEach(marca);
}
// Preenche uma janela já criada: título, corpo, menu do cabeçalho e rodapé —
// por omissão, Cancelar + Guardar (que chama o onSave da janela de cima).
// Recebe: el — o elemento da janela (vindo do modalLayer); title — o texto do título;
// body — HTML do corpo; foot (opcional) — HTML do rodapé (por omissão Cancelar+Guardar;
// SEM_RODAPE para uma janela que só se fecha no X, como a folha «Criar»);
// menuHtml (opcional) — HTML para o menu do cabeçalho.
// Devolve: nada — preenche a janela no DOM.
function fillModal(el,title,body,foot,menuHtml){
  el.querySelector('.head h2').textContent=title;
  el.querySelector('.body').innerHTML=semEtiquetasQueCorrem(body);
  if(typeof tornarFocavel==='function')tornarFocavel(el.querySelector('.body'));
  marcarDatasVazias(el.querySelector('.body'));
  el.querySelector('.head span').innerHTML=semEtiquetasQueCorrem(menuHtml||'');
  const pe=el.querySelector('.foot');
  pe.innerHTML=foot===SEM_RODAPE?'':semEtiquetasQueCorrem(foot||`<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="onSave&&onSave()">Guardar</button>`);
  if(pe.classList)pe.classList.toggle('u-d-none',foot===SEM_RODAPE);
}
/* O rodapé de uma janela que não tem botões em baixo: escolhe-se no corpo e
   fecha-se no X (a folha «Criar», navegacao.js:abrirAdicionar). Uma marca, e
   não '': uma string vazia continua a querer dizer «o rodapé de omissão». */
const SEM_RODAPE='\u0000sem-rodape';

/* ================= A FICHA DE LEITURA =================
   Tocar num registo LÊ; editar é um passo deliberado.

   Antes, tocar abria o formulário: quarenta campos num contrato, vinte e um
   num imóvel, e o «Apagar» encostado ao título de uma janela que ninguém
   tinha pedido para abrir. Quem só queria saber quando acaba o contrato tinha
   de o procurar dentro de um formulário.

   Havia uma ficha só no código — propView, para quem colabora num imóvel sem
   poder editar. Isto é a generalização dela: um molde só, para não nascerem
   sete desenhos de ficha como tinham nascido três desenhos de porta. */

/* O corpo de uma ficha, a partir das linhas que lhe der quem a escreve.

   Uma linha sem valor não aparece — uma ficha mostra o que se sabe, e um
   rótulo com um traço à frente é ruído a fingir que é informação.
   Recebe: linhas — [{rotulo, valor, tipo}], com o valor já escrito e escapado
   por quem chama (é ele que sabe se é dinheiro, data ou nome). O tipo é
   'stat' (uma linha rótulo/valor, o normal), 'bloco' (o rótulo por cima e o
   valor por baixo, para texto comprido ou várias linhas) ou 'nota' (só texto,
   sem rótulo). Aceita nulos e falsos no meio, para quem monta a lista poder
   escrever condições sem filtrar antes.
   Devolve: o HTML do corpo da ficha. */
function ficha(linhas){
  const html=(linhas||[]).filter(Boolean).map(function(l){
    const v=(l.valor==null?'':String(l.valor)).trim();
    if(!v)return '';
    if(l.tipo==='nota')return `<div class="hint">${v}</div>`;
    if(l.tipo==='bloco')return `<div><div class="flabel">${esc(l.rotulo||'')}</div><div class="small">${v}</div></div>`;
    return `<div class="stat"><span>${esc(l.rotulo||'')}</span><b>${v}</b></div>`;
  }).join('');
  return `<div class="form">${html}</div>`;
}

/* O rodapé de uma ficha: fechar, e editar quando se pode.

   O «Editar» é primário porque é o que se quer a seguir a ler; e quando não
   se pode editar não há botão nenhum a prometê-lo.
   Recebe: o descritor da ficha (o mesmo de abrirFicha).
   Devolve: o HTML do rodapé. */
function fichaRodape(o){
  return `<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>`+
    (o.editar?`<button type="button" class="btn primary" data-toca="camada" data-click="${o.editar.act}">${esc(o.editar.rotulo||'Editar')}</button>`:'');
}

/* Abre a ficha de leitura de um registo.

   O corpo e o título são FUNÇÕES, e não texto: quem guarda por cima da ficha
   (o formulário abre-se em cima dela) deixa-a a dizer o que já não é verdade.
   Assim a ficha volta a ler a base sozinha — ver, editar, e voltar ao que se
   estava a ver, já mudado.
   Recebe: o — {titulo, corpo, menu (opcional), editar (opcional) com
   {rotulo, act}, depois (opcional)}, onde titulo, corpo e menu podem ser texto
   ou função, e depois é chamada com o corpo já no ecrã — é onde se pintam as
   coisas que o HTML sozinho não traz, como as miniaturas das fotos.
   Devolve: a camada aberta. */
function abrirFicha(o){
  const t=x=>(typeof x==='function'?x():x)||'';
  const L=openModal(t(o.titulo),t(o.corpo),fichaRodape(o),t(o.menu));
  if(L)L.ficha=o;                  // é o que marca a camada como ficha, para o refrescarFichas a repintar
  if(o.depois)try{o.depois()}catch(e){}
  return L;
}

/* Repinta as fichas abertas, para não ficarem a dizer o que já não é verdade.

   Corre no fim de cada render, que é o sinal que a app já dá quando alguma
   coisa mudou: guardar um formulário aberto por cima de uma ficha deixava-a
   com os valores de antes por baixo.
   Devolve: nada. */
function refrescarFichas(){
  if(typeof modalStack==='undefined')return;
  const t=x=>(typeof x==='function'?x():x)||'';
  modalStack.forEach(function(L){
    if(!L||!L.ficha)return;
    let corpo='';
    /* o registo pode ter sido apagado por baixo da ficha; quem apaga já fecha
       a janela, e aqui basta não repintar por cima do que está a sair */
    try{corpo=t(L.ficha.corpo)}catch(e){return}
    if(!corpo)return;
    fillModal(L.el,t(L.ficha.titulo),corpo,fichaRodape(L.ficha),t(L.ficha.menu));
    if(L.ficha.depois)try{L.ficha.depois()}catch(e){}
  });
}

/* o botão “voltar” do Android fecha primeiro o que estiver aberto (janela ou menu).
   Uma única sentinela no histórico enquanto houver camadas: voltar fecha a de cima
   e volta a armar a sentinela se ainda restarem; sem nada aberto, sai da app. */
let _histOn=false;
// Arma a sentinela no histórico (uma só de cada vez, via _histOn) para o
// "voltar" do Android cair no popstate abaixo em vez de sair da app.
// Devolve: nada — empurra a entrada sentinela para o history.
function pushHist(){if(_histOn)return;try{history.pushState({gi:1},'');_histOn=true}catch(e){}}
window.addEventListener('popstate',()=>{
  _histOn=false;
  closePops();
  const drawer=document.body.classList.contains('open');
  if(drawer||modalStack.length){
    if(drawer)closeDrawer(true);else closeModal('voltar');
    if(document.body.classList.contains('open')||modalStack.length)pushHist();
  }else if(typeof setPage!=='undefined'&&setPage){
    /* dentro de uma subpágina de Definições, voltar sobe a Definições — o
       sistema e o botão no ecrã deixam de se contradizer */
    setPage='';render();try{window.scrollTo(0,0)}catch(e){}
  }else{
    try{history.back()}catch(e){}
  }
});
/* Abre uma janela nova por cima do que houver: a anterior desce na pilha
   (demote), o scroll da página tranca e a sentinela do "voltar" arma-se.
   Tira também um retrato do formulário (snap), para o closeModal saber se
   há alterações por deitar fora. Devolve a camada, com onSave a null —
   quem chama define-o depois.
   Recebe: title — o texto do título; body — HTML do corpo; foot (opcional) —
   HTML do rodapé (por omissão Cancelar+Guardar); menuHtml (opcional) — HTML do
   menu do cabeçalho.
   Devolve: a camada criada ({el,title,onSave,snap,tocado,gatilho}), com onSave
   a null — quem chama define-o, e pode pôr-lhe um aoFechar, que o closeModal
   corre quando ela sai. */
function openModal(title,body,foot,menuHtml){
  closePops();
  const top=modalTop();if(top)demote(top.el);
  const el=modalLayer();document.body.appendChild(el);
  const L={el,title,onSave:null,gatilho:document.activeElement,tocado:false};modalStack.push(L);lockPage();pushHist();
  fillModal(el,title,body,foot,menuHtml);
  el.querySelector('.body').scrollTop=0;
  L.snap=modalSnap(el);           // o que a janela tinha ao abrir
  /* só conta como "mexido" o que vier de um dedo ou de um teclado a sério
     (isTrusted): os valores automáticos que a app preenche depois de abrir
     — a renda sugerida, o email da conta — não são trabalho de ninguém, e
     perguntavam "queres sair?" a quem nunca tocou em nada */
  el.addEventListener('input',e=>{if(e.isTrusted)L.tocado=true},true);
  el.addEventListener('change',e=>{if(e.isTrusted)L.tocado=true},true);
  focarModal(el);                  // o foco entra na janela, não fica atrás do véu
  avisoAcimaDoRodape();            // um aviso ainda no ecrã sobe, para não tapar o rodapé
  avisoQuandoAssentar();           // e outra vez quando a folha parar de deslizar
  return L;
}
// leva o foco para dentro da janela, para o teclado e os leitores de ecrã não ficarem atrás do véu
// Recebe: el — o elemento da janela cujo .sheet recebe o foco.
// Devolve: nada — move o foco para dentro da janela.
function focarModal(el){try{el.querySelector('.sheet').focus()}catch(e){}}
/* substitui o conteúdo da janela de cima (sem empilhar)
   Recebe: title — o texto do título; body — HTML do corpo; foot (opcional) —
   HTML do rodapé (por omissão Cancelar+Guardar); menuHtml (opcional) — HTML do
   menu do cabeçalho.
   Devolve: a camada de cima já com o conteúdo novo — ou a que o openModal
   criar, se não houver nenhuma aberta. */
function setModal(title,body,foot,menuHtml){
  const t=modalTop();if(!t)return openModal(title,body,foot,menuHtml);
  closePops();t.title=title;t.onSave=null;fillModal(t.el,title,body,foot,menuHtml);
  t.snap=modalSnap(t.el);   // conteúdo novo, base de comparação nova
  t.tocado=false;
  return t;
}
/* Fechar por um caminho de abandono (toque no fundo, X, Escape, voltar,
   arrastar a folha para baixo) com alterações por guardar pergunta primeiro. Foi um dos achados mais
   sérios da auditoria de UX: um dedo mal posto no véu escurecido deitava
   fora um contrato meio-preenchido, sem uma palavra. Guardar e Cancelar
   continuam a fechar sem perguntar — são decisões, não acidentes.
   (Sob automação, navigator.webdriver salta a pergunta: o percurso de
   testes não tem dedos mal postos.) */
let _forcaFecho=false;
/* Tira uma janela do ecrã com a saída desenhada (index.html:.modal.sai).
   Troca .open por .sai — as consultas a .modal.open deixam de a ver no
   mesmo instante — e remove o nó quando a animação acabar. Os ids saem já:
   o promote devolve os da janela de baixo, e duas janelas com #modalBody
   durante 200ms davam um getElementById errado. A rede do setTimeout é a
   de sempre: num separador escondido a animação não corre e o
   animationend nunca chega.
   Recebe: el — o elemento .modal a tirar do ecrã.
   Devolve: nada — anima a saída e remove o nó do documento no fim. */
function fecharComSaida(el){
  if(typeof semIds==='function')semIds(el);
  if(typeof semMovimento==='function'&&semMovimento()){el.remove();return}
  el.classList.remove('open');el.classList.add('sai');
  el.setAttribute('aria-hidden','true');try{el.inert=true}catch(e){}
  let feito=false;
  const fora=()=>{if(feito)return;feito=true;try{el.remove()}catch(x){}};
  const s=el.querySelector('.sheet');
  if(s)s.addEventListener('animationend',fora,{once:true});
  setTimeout(fora,(typeof msDoToken==='function'?msDoToken('--medio',200):200)+120);
}
/* Fecha a janela de cima. `origem` diz por onde se saiu ('fundo', 'x',
   'esc', 'voltar', 'arrasto' — a folha largada em baixo, folhaFecha): esses
   caminhos de abandono, com alterações por guardar, abrem primeiro a
   pergunta "Sair sem guardar?". Sem origem (Guardar, Cancelar), fecha sem
   perguntar — são decisões, não acidentes.
   Recebe: origem (opcional) — string com o caminho de saída ('fundo', 'x',
   'esc', 'voltar', 'arrasto'); presente, e havendo alterações, abre
   primeiro a pergunta.
   Devolve: nada — tira a janela da pilha e repõe a de baixo (ou o foco no gatilho). */
function closeModal(origem){
  closePops();
  const L=modalTop();
  if(L&&!_forcaFecho&&typeof origem==='string'&&L.tocado&&L.snap!=null&&modalSnap(L.el)!==L.snap&&!navigator.webdriver){
    /* a pergunta veste o tema da app, não o do browser. Abrir a pergunta
       por cima também rearma o histórico (openModal→pushHist), por isso o
       "voltar" que trouxe até aqui fica tratado sozinho. */
    /* o caminho seguro é o primário (o canvas, M-Visita): quem carregou no X
       por engano continua com um toque; sair é a escolha deliberada */
    openModal('Sair sem guardar?',
      `<div class="hint u-fs-14px">Tens alterações por guardar nesta janela. Se saíres agora, perdes estas alterações.</div>`,
      `<button class="btn" data-click="_sairSemGuardar()">Sair sem guardar</button>
       <button class="btn primary" data-click="closeModal()">Continuar a editar</button>`);
    return;
  }
  const M=modalStack.pop();lockPage();if(!M)return;
  /* o que a camada prendeu enquanto esteve aberta (o object URL de uma imagem,
     anexos.js:openFileMeta) solta-se com ela */
  if(typeof M.aoFechar==='function')try{M.aoFechar()}catch(e){}
  /* sem janela nenhuma não há formulário: os anexos pendentes deixam de ser
     poupados (anexos.js:esquecerPendentes) */
  if(!modalStack.length)esquecerPendentes();
  fecharComSaida(M.el);
  avisoAcimaDoRodape();            // sem rodapé por baixo, o aviso volta ao sítio
  avisoQuandoAssentar();
  const top=modalTop();
  if(top){promote(top.el);focarModal(top.el)}
  else{try{M.gatilho&&M.gatilho.focus&&M.gatilho.focus()}catch(e){}}
}
// resposta ao "Sair sem guardar": fecha a pergunta e a janela por baixo, sem voltar a perguntar
// Devolve: nada — fecha as duas janelas.
function _sairSemGuardar(){
  _forcaFecho=true;
  try{closeModal();closeModal()}finally{_forcaFecho=false}   // a pergunta e a janela por baixo
}
// despeja a pilha inteira de janelas (closeModal sem origem: fecha sem perguntar)
// Devolve: nada — fecha todas as janelas da pilha.
function closeAllModals(){while(modalStack.length)closeModal()}
/* O valor de um campo do formulário, pelo id.
   Recebe: id — o id do campo.
   Devolve: o valor (texto); '' se o campo não existir. */
const val=id=>{const e=document.getElementById(id);return e?e.value:''};
/* A caixa de marcar está marcada?
   Recebe: id — o id da caixa.
   Devolve: true/false; false se não existir. */
const chk=id=>{const e=document.getElementById(id);return e?!!e.checked:false};
/* O botão diz o verbo da ação e veste-se de perigo quando destrói: um
   "Confirmar" primário igual ao Guardar convidava ao reflexo justamente
   onde não há undo.
   Recebe: title — o título da pergunta (a começar por Apagar/Remover/Eliminar/
   Terminar, o botão fica vermelho e usa esse verbo); text — HTML com a
   explicação do que se perde; cb — função corrida só se a pessoa confirmar.
   Devolve: nada — abre a janela de confirmação. */
function confirmModal(title,text,cb){
  const verbo=(/^(Apagar|Remover|Eliminar|Terminar)\b/.exec(title)||[])[1];
  openModal(title,`<div class="hint u-fs-14px">${text}</div>`,
    `<button class="btn" data-click="closeModal()">Cancelar</button><button class="btn ${verbo?'danger':'primary'}" data-click="_ok()">${verbo||'Confirmar'}</button>`);
  _ok=()=>{closeModal();cb()};
}
/* Desfazer em vez de (ou além de) confirmar. A confirmação trava o engano
   de quem lê; o Anular salva o engano de quem confirmou por hábito. O
   apagado sai já do ecrã e dos cálculos — só a ressurreição fica à mão,
   seis segundos. `aoExpirar` liquida o que não se pode desfazer (blobs no
   IndexedDB) só quando a janela fecha sem cliques. */
let _desfazer=null;
/* Toast com "Anular" durante seis segundos. `restaurar` repõe os dados (a
   gravação e o repinte vêm por acréscimo) se o anular for clicado;
   `aoExpirar` corre quando o prazo passa sem clique — ou quando outro
   desfazer atropela este — e é aí que se liquida o que não volta.
   Recebe: msg — o texto do toast; restaurar — função que repõe os dados quando
   o Anular é clicado; aoExpirar (opcional) — função corrida quando o prazo
   passa sem clique, ou quando outro desfazer atropela este.
   Devolve: nada — mostra o toast e arma o prazo de seis segundos.
   O prazo é o dos 6400ms desde o apagar (o toast sai aos 6000, e os 400 de
   folga apanham o toque do último instante). Com o dedo pousado no toast
   (avisoPousar) o prazo espera: o «Anular» não pode ficar à vista depois de
   o que não volta já ter sido liquidado. Se o dedo o devolve ao sítio, o
   toast ganha o tempo que esteve seguro e o prazo anda com ele (o `segura`
   recebe esse acréscimo); se o afasta, o prazo é o de sempre — fechar o
   cartão não anula nem antecipa nada. */
function comDesfazer(msg,restaurar,aoExpirar){
  if(_desfazer&&_desfazer.expira)_desfazer.expira();   // o anterior liquida-se
  const eu={expira:aoExpirar||null,fim:Date.now()+6400,preso:false,h:0};_desfazer=eu;
  // o prazo chegou: liquida, a não ser que o dedo esteja no toast ou que o fim tenha andado
  const vence=()=>{
    if(_desfazer!==eu||eu.preso)return;
    const falta=eu.fim-Date.now();
    if(falta>0){clearTimeout(eu.h);eu.h=setTimeout(vence,falta);return}
    _desfazer=null;if(eu.expira)eu.expira();
  };
  toast(msg,{rotulo:'Anular',ms:6000,fn(){
    if(_desfazer===eu)_desfazer=null;
    restaurar();save();try{buildNav()}catch(e){}render();toast('Anulado.');
  },segura(sim,mais){
    if(sim){eu.preso=true;return}
    eu.preso=false;eu.fim+=mais||0;clearTimeout(eu.h);vence();
  }});
  eu.h=setTimeout(vence,6400);
}

/* O erro diz-se no próprio campo: o contorno vermelho e, por baixo dele, a
   frase que diz o que fazer (o canvas de 2026-10 — só o aviso em baixo
   obrigava a procurar qual era o campo). O toast continua: é ele que o leitor
   de ecrã anuncia (role=status) e o que se vê quando o teclado tapa o campo;
   o campo leva aria-invalid e aria-describedby a apontar a frase, para quem
   lá chega pelo Tab a ouvir. Tudo se larga à primeira tecla.
   Recebe: id — o id do campo com o problema; msg — a frase do erro.
   Devolve: nada — escreve o erro junto do campo, mostra o toast e leva o campo ao ecrã. */
function falhaCampo(id,msg){
  toast(msg);
  const e=document.getElementById(id);if(!e)return;
  e.classList.add('err');
  /* um nó sem a API de inserção (o DOM mínimo dos testes) fica com o realce */
  if(typeof e.insertAdjacentElement!=='function'){e.addEventListener('input',()=>e.classList.remove('err'),{once:true});return}
  const ancora=(typeof e.closest==='function'&&e.closest('.sel'))||e,idErro=id+'-erro';
  const antes=document.getElementById(idErro);if(antes)antes.remove();
  const p=document.createElement('p');p.className='erro-campo';p.id=idErro;p.textContent=msg;
  ancora.insertAdjacentElement('afterend',p);
  e.setAttribute('aria-invalid','true');e.setAttribute('aria-describedby',idErro);
  try{e.scrollIntoView({block:'center'})}catch(x){}
  try{e.focus({preventScroll:true})}catch(x){}
  const larga=()=>{e.classList.remove('err');e.removeAttribute('aria-invalid');e.removeAttribute('aria-describedby');p.remove()};
  e.addEventListener('input',larga,{once:true});
}
/* escolher de uma lista, no estilo da app
   Recebe: title — o texto do título; options — lista de opções {label,sub,icon,
   avatar,nome,…} (sub, icon e avatar são opcionais; nome, quando o label leva
   mais do que o nome — « (eu)» —, dá as iniciais do avatar; a opção inteira
   volta no onPick);
   onPick — função chamada com a opção escolhida; extra (opcional) — HTML
   acrescentado por baixo da lista.
   Devolve: nada — abre a janela de escolha. */
function pickModal(title,options,onPick,extra){
  openModal(title,`<div class="form">
    ${options.length?`<div class="list u-g-7px">${options.map((o,i)=>
      `<button type="button" class="card tap u-p-12px-14px u-d-flex u-ai-center u-g-11px" data-click="_pick(${i})">
        ${o.icon?`<span class="ic u-w-34px u-h-34px u-br-10px u-d-grid u-pi-center u-fx-0-0-34px ${o.icon==='trash'?'comp-pick-ic-destroi':'comp-pick-ic-normal'}">${ic(o.icon,18)}</span>`:o.avatar?`<span class="avatar">${esc(initials(o.nome||o.label))}</span>`:''}
        <span class="u-fx-1 u-minw-0 u-ta-left"><b class="u-d-block u-fs-14px">${esc(o.label)}</b>
        ${o.sub?`<span class="small">${esc(o.sub)}</span>`:''}</span></button>`).join('')}</div>`
      :`<div class="hint">Não há nada para escolher.</div>`}
    ${extra||''}</div>`,`<button class="btn" data-click="closeModal()">Voltar</button>`);
  _pick=i=>onPick(options[i]);
}

/* ================= PRESSIONAR E SEGURAR: opções do cartão ================= */
let _lpT=null,_lpX=0,_lpY=0,_lpFired=false,_lpAt=0;
document.addEventListener('pointerdown',e=>{
  _lpFired=false;   /* gesto novo: nada de engolir o toque que vem aí */
  const c=e.target&&e.target.closest?e.target.closest('[data-lp]'):null;
  clearTimeout(_lpT);if(!c)return;
  _lpX=e.clientX;_lpY=e.clientY;
  const v=c.getAttribute('data-lp');
  /* A espera vê-se encher. O estado premido foi feito para um toque, que dura
     um instante; num toque longo ficava meio segundo uma laje cinzenta parada
     e depois saltava para a cor da seleção — lia-se como um erro, e não como
     «estou a registar que estás a segurar». Agora a cor vai subindo ao longo
     dos mesmos 480ms, e a seleção é a conclusão daquilo e não um salto. */
  c.classList.add('lp-espera');
  _lpT=setTimeout(()=>{_lpFired=true;_lpAt=Date.now();try{navigator.vibrate&&navigator.vibrate(12)}catch(x){}(window.lpLongo||lpMenu)(v)},480);
},true);
document.addEventListener('pointermove',e=>{if(_lpT&&(Math.abs(e.clientX-_lpX)>12||Math.abs(e.clientY-_lpY)>12)){clearTimeout(_lpT);_lpT=null;lpLimpaEspera()}},true);
['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,()=>{clearTimeout(_lpT);_lpT=null;lpLimpaEspera()},true));
/* Tira a marca da espera a quem a tiver. Passa por todos de propósito: o nó
   pode ter sido substituído por uma repintura a meio do gesto, e nesse caso o
   que ficou no ecrã é outro.
   Devolve: nada — tira a classe .lp-espera do documento. */
function lpLimpaEspera(){
  try{[].slice.call(document.querySelectorAll('.lp-espera')).forEach(e=>e.classList.remove('lp-espera'))}catch(e){}
}
document.addEventListener('click',e=>{if(_lpFired){_lpFired=false;if(Date.now()-_lpAt<700){e.stopPropagation();e.preventDefault()}}},true);
document.addEventListener('contextmenu',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-lp]'))e.preventDefault()});
/* O mesmo ouvinte serve o botão do topo e a risca do cabeçalho: body.rolada
   é o que acende o border-bottom (index.html:body.rolada) — no topo da
   página não há conteúdo por baixo dele para separar. */
window.addEventListener('scroll',()=>{const b=document.getElementById('toTop');if(b)b.classList.toggle('on',window.scrollY>420);
  document.body.classList.toggle('rolada',window.scrollY>8)},{passive:true});
/* A folha de opções do toque longo: fecha o que estiver aberto e mostra a
   lista num pickModal. Cada opção é {label, icon, act} — o act corre depois
   de fechar tudo. Os rótulos destrutivos (Apagar/Remover/…) pintam-se de
   vermelho aqui mesmo, já com o HTML no DOM.
   Recebe: title — o título da folha ('Opções' quando vazio); opts — lista de
   {label, icon, act, sub}: act é a função corrida depois de fechar tudo, sub
   (opcional) a linha pequena por baixo do rótulo.
   Devolve: nada — abre o pickModal com as opções. */
function lpShow(title,opts){
  closeAllModals();
  /* um cargo que só vê não tem ações: diz-se, em vez de abrir uma folha vazia */
  if(!opts.length)return toast('Só podes ver este registo — o teu cargo não permite alterá-lo.');
  pickModal(title||'Opções',opts.map((o,i)=>({v:i,label:o.label,sub:o.sub||'',icon:o.icon})),o=>{closeAllModals();opts[o.v].act()});
  // o rótulo do que destrói fica vermelho também aqui, não só no menu do modal
  [].slice.call(document.querySelectorAll('.modal.open .card.tap b')).forEach(b=>{
    if(/^(Apagar|Remover|Eliminar|Terminar)/.test(b.textContent))b.style.color='var(--danger)';
  });
}
/* O menu por omissão do toque longo: descodifica o data-lp ("tipo:id", ex.
   "prop:abc") e entrega-o ao serviço que registou esse prefixo
   (servicos.js:lpDe) — imóveis, movimentos, contratos, pessoas, visitas,
   planeados, modelos ou hipotecas. Um prefixo de um serviço desligado nesta
   conta não abre nada. A seleção em massa (cloud/selecao.js) embrulha-o para
   tratar dos movimentos à maneira dela. Cada handler passa as ações por
   pode()/podeEditar(): num imóvel onde só colaboro, só aparece o que o cargo
   permite (e editar/apagar só o que eu próprio adicionei); um cargo que só
   vê fica com o toast do lpShow.
   Recebe: v — o valor do data-lp do cartão, no formato "tipo:id" (pessoas e
   hipotecas levam dois ids: "per:owner:<id>" ou "per:tenant:<id>", e
   "mort:<idImovel>:<idHipoteca>").
   Devolve: nada — abre a folha de opções (ou não faz nada, se o alvo já não
   existir ou o serviço estiver desligado). */
function lpMenu(v){
  const a=String(v||'').split(':'),f=lpDe(a[0]);
  if(!f)return;
  return f(a);
}

/* ================= AVISO =================
   O aviso do fundo do ecrã (toast), com o botão opcional que faz o Anular, e a
   medição que o põe acima do rodapé da janela que estiver aberta. */
/* op: {rotulo, fn, ms} poe um botao no toast — e a peca que faz o Anular
   possivel. Sem op, comporta-se exatamente como sempre.
   Recebe: m — a mensagem a mostrar (texto); op (opcional) — {rotulo, fn, ms}: o texto do botão,
   o que ele faz ao ser tocado e quanto tempo o aviso fica no ecrã (ms; 2800 por omissão).
   Devolve: nada — mostra o aviso no fundo do ecrã.
   Um aviso com botão arrasta-se para baixo com o dedo (avisoPousar): leva a
   classe .arrasta, guarda o op em t._op e a hora a que sai em t._fim, para o
   arrasto pausar e retomar o prazo. O op pode trazer segura(sim, mais) — o
   comDesfazer usa-o para o prazo dele esperar pelo dedo. Um aviso novo a
   meio de um arrasto ganha: o arrasto acaba ali (avisoInterromper). */
function toast(m,op){const t=document.getElementById('toast');
  avisoInterromper(t);
  t.textContent=m;
  const comBotao=!!(op&&op.rotulo&&op.fn);
  if(comBotao){const b=document.createElement('button');b.type='button';b.className='toastbtn';
    /* o clique que o browser dá a seguir a um arrasto não é um toque no Anular */
    b.textContent=op.rotulo;b.onclick=()=>{if(Date.now()<_avisoEngole){_avisoEngole=0;return}
      clearTimeout(t._h);t.classList.remove('on');op.fn()};t.appendChild(b)}
  t._op=comBotao?op:null;
  t.classList.toggle('arrasta',comBotao);
  avisoAcimaDoRodape();
  t.classList.add('on');clearTimeout(t._h);
  const ms=(op&&op.ms)||2800;t._fim=Date.now()+ms;
  t._h=setTimeout(()=>t.classList.remove('on'),ms)}

/* ---- O aviso afasta-se com o dedo ----
   O cartão do «Anular» tapa o fundo do ecrã seis segundos, e às vezes é
   precisamente o que está por trás que se quer ver. Puxa-se para baixo:
   só o eixo vertical, para cima resiste (avisoElastico). Largar passada
   metade da altura dele, ou com um sacudir para baixo, fecha-o a deslizar
   para fora — o apagado continua apagado, e o comDesfazer liquida no prazo
   de sempre. Largar antes disso devolve-o ao sítio. Enquanto o dedo está
   nele o prazo do aviso para; ao voltar, retoma (com um mínimo para se ler).
   Só o dedo e a caneta (AVISO_PONTEIROS): com o rato, arrastar é selecionar
   texto, e no computador o aviso não tapa o que tapa num telemóvel. Sem
   movimento (prefers-reduced-motion) não segue o dedo: desvanece um pouco
   quando largar já fecha, e fecha sem animar. */
// quem arrasta o aviso: o dedo e a caneta; o rato fica de fora
const AVISO_PONTEIROS=['touch','pen'];
// a velocidade (px/ms, para baixo) que conta como sacudir — a do arrasto entre separadores
const AVISO_SACODIR=.4;
// devolvido ao sítio, o aviso fica pelo menos isto (ms): o que estava a acabar não some ao voltar
const AVISO_RETOMA_MS=1500;
let _avisoArr=null,_avisoEngole=0;
/* O dedo pousou: se foi num aviso com botão, à vista, o prazo dele para e
   fica-se à escuta do arrasto. Pegar no aviso a meio do regresso apanha-o
   onde ele está, sem salto.
   Recebe: e — o PointerEvent do pointerdown (ouvido no documento).
   Devolve: nada — liga os ouvintes do documento. */
function avisoPousar(e){
  if(_avisoArr||!e||e.button>0||e.isPrimary===false||AVISO_PONTEIROS.indexOf(e.pointerType)<0)return;
  const t=e.target&&typeof e.target.closest==='function'?e.target.closest('#toast'):null;
  if(!t||!t._op||!t.classList.contains('on')||!t.classList.contains('arrasta'))return;
  const agora=Date.now();
  const a={id:e.pointerId,t,op:t._op,x0:e.clientX,y0:e.clientY,base:0,dy:0,desl:0,vy:0,ya:e.clientY,ta:avisoHora(e),
    ativo:false,mexe:!semMovimento(),h:1,topo:0,resto:Math.max(0,(t._fim||agora)-agora),fimAntes:t._fim||agora};
  if(t._anim){
    // a meio do regresso: fica onde a animação o tinha
    try{const m=/matrix\(([^)]*)\)/.exec(getComputedStyle(t).transform||'');
      if(m)a.base=parseFloat(m[1].split(',')[5])||0}catch(x){}
    const an=t._anim;t._anim=null;try{an.cancel()}catch(x){}
    t.classList.add('arrastar');
    a.desl=a.dy=a.base;
    if(a.base)t.style.transform='translateX(-50%) translateY('+a.base+'px)';
  }
  _avisoArr=a;
  clearTimeout(t._h);
  if(a.op.segura)a.op.segura(true);
  document.addEventListener('pointermove',avisoArrastoMove);
  document.addEventListener('pointerup',avisoArrastoFim);
  document.addEventListener('pointercancel',avisoArrastoFim);
}
/* O dedo andou: na vertical, passados os 10px de decidir, o aviso segue-o;
   para o lado, o gesto não é dele (fica parado até o dedo sair).
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada — mexe no transform do #toast. */
function avisoArrastoMove(e){
  const a=_avisoArr;if(!a||e.pointerId!==a.id||a.deLado)return;
  const t=a.t;
  let dy=e.clientY-a.y0;const dx=e.clientX-a.x0;
  if(!a.ativo){
    if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){a.deLado=true;return}
    if(Math.abs(dy)<10)return;
    a.ativo=true;
    const r=t.getBoundingClientRect?t.getBoundingClientRect():null;
    a.h=(r&&r.height)||t.offsetHeight||1;a.topo=((r&&r.top)||0)-a.base;
    // a folga de decidir não conta: o aviso arranca colado ao dedo, sem salto
    a.y0+=dy<0?-10:10;dy=e.clientY-a.y0;
    try{t.setPointerCapture(a.id)}catch(x){}
    t.classList.add('arrastar');
  }
  const agora=avisoHora(e),dt=agora-a.ta;
  // a velocidade dos últimos instantes, alisada: é ela que diz se o gesto foi um sacudir
  if(dt>0)a.vy=.6*((e.clientY-a.ya)/dt)+.4*a.vy;
  a.ya=e.clientY;a.ta=agora;
  a.dy=a.base+dy;
  a.desl=a.dy>=0?a.dy:avisoElastico(a.dy,a.h);
  if(a.mexe)t.style.transform='translateX(-50%) translateY('+a.desl+'px)';
  t.classList.toggle('pronto',avisoFechaAoLargar(a,agora));
}
/* Para cima, o aviso resiste: anda cada vez menos quanto mais se puxa, e
   nunca passa de metade da altura dele (a curva do sepElastico).
   Recebe: dy — px que o dedo andou (negativo, para cima); h — a altura do aviso.
   Devolve: px a que o aviso fica (com o sinal de dy). */
function avisoElastico(dy,h){
  const a=Math.abs(dy),l=h||1;
  return Math.sign(dy)*(1-1/(a*.55/l+1))*l*.5;
}
/* Largar agora fecha o aviso? Passada metade da altura dele, ou a descer
   depressa. Uma velocidade de há mais de 100ms já não é um sacudir: o dedo
   parou antes de sair.
   Recebe: a — o arrasto em curso; agora — a hora do evento (avisoHora).
   Devolve: true/false. */
function avisoFechaAoLargar(a,agora){
  const vy=agora-a.ta>100?0:a.vy;
  return a.dy>a.h/2||(a.dy>0&&vy>AVISO_SACODIR);
}
/* A hora de um evento do dedo, para a velocidade: a do próprio evento (em
   alta resolução, a de quando o dedo lá esteve), e não a de quando o código
   corre — os movimentos chegam às vezes aos pares no mesmo milissegundo, e
   pelo relógio da página um par desses parecia um sacudir.
   Recebe: e — o PointerEvent (pode não trazer timeStamp, como nos testes).
   Devolve: ms (número), sempre no mesmo relógio para o mesmo gesto. */
function avisoHora(e){
  return e&&typeof e.timeStamp==='number'&&e.timeStamp>0?e.timeStamp:Date.now();
}
/* Tira os ouvintes do documento e esquece o arrasto.
   Devolve: nada. */
function avisoArrastoLargar(){
  document.removeEventListener('pointermove',avisoArrastoMove);
  document.removeEventListener('pointerup',avisoArrastoFim);
  document.removeEventListener('pointercancel',avisoArrastoFim);
  _avisoArr=null;
}
/* O dedo saiu: fecha o aviso, se o gesto chegou para isso, ou devolve-o ao
   sítio e retoma o prazo. Um pointercancel nunca fecha. Depois de um
   arrasto, o clique que o browser dispara engole-se (o Anular não carrega).
   Recebe: e — o PointerEvent do pointerup ou do pointercancel.
   Devolve: nada. */
function avisoArrastoFim(e){
  const a=_avisoArr;if(!a||(e&&e.pointerId!==a.id))return;
  avisoArrastoLargar();
  // um toque (ou um dedo que foi para o lado): o aviso fica, ou acaba de voltar se o dedo o apanhou a meio
  if(!a.ativo){avisoVoltaAoSitio(a);return avisoRetoma(a)}
  // se não vier clique nenhum, o próximo toque é a sério
  _avisoEngole=Date.now()+350;
  if(e&&e.type!=='pointercancel'&&avisoFechaAoLargar(a,avisoHora(e)))return avisoSaiPorBaixo(a);
  avisoVoltaAoSitio(a);avisoRetoma(a);
}
/* O aviso sai pelo fundo, a partir de onde o dedo o deixou: a mesma
   direção por onde entrou. Por baixo da animação ele já está fechado (sem
   .on, sem toque), para nada piscar no fim. O prazo do desfazer é o de
   sempre: segura(false) sem acréscimo.
   Recebe: a — o arrasto que acabou.
   Devolve: nada. */
function avisoSaiPorBaixo(a){
  const t=a.t,de='translateX(-50%) translateY('+a.desl+'px)';
  clearTimeout(t._h);t._fim=0;
  t.classList.remove('pronto');t.style.transform='';t.classList.remove('on');
  if(a.op.segura)a.op.segura(false,0);
  if(!a.mexe||typeof t.animate!=='function')return avisoAssentar(t);
  // até sair do ecrã, e nunca para trás de onde o dedo o largou
  const fora=Math.max(a.desl,(window.innerHeight||0)-a.topo),dur=msDoToken('--medio',200);
  const an=t.animate([{transform:de,opacity:1},{transform:'translateX(-50%) translateY('+Math.round(fora)+'px)',opacity:0}],
    {duration:dur,easing:tokenTexto('--curva','cubic-bezier(.22,1,.36,1)')});
  avisoQuandoAcabar(t,an,dur);
}
/* O aviso volta ao sítio, a partir de onde o dedo o deixou (--medio,
   --curva-entra). Sem movimento, ou sem deslocação, só assenta.
   Recebe: a — o arrasto que acabou.
   Devolve: nada. */
function avisoVoltaAoSitio(a){
  const t=a.t,de='translateX(-50%) translateY('+a.desl+'px)';
  t.classList.remove('pronto');t.style.transform='';
  if(!a.mexe||!a.desl||typeof t.animate!=='function')return avisoAssentar(t);
  const dur=msDoToken('--medio',200);
  const an=t.animate([{transform:de},{transform:'translateX(-50%)'}],
    {duration:dur,easing:tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)')});
  avisoQuandoAcabar(t,an,dur);
}
/* Guarda a animação do aviso (para um dedo ou um aviso novo a poderem
   interromper) e, no fim dela, devolve-lhe as transições de sempre.
   Recebe: t — o #toast; an — a Animation; dur — a duração dela (ms).
   Devolve: nada. */
function avisoQuandoAcabar(t,an,dur){
  t._anim=an;
  const fim=()=>{if(t._anim!==an)return;t._anim=null;avisoAssentar(t)};
  an.onfinish=fim;
  // a rede de sempre: num separador escondido o onfinish não chega
  setTimeout(fim,dur+120);
}
/* Tira a classe do arrasto sem disparar as transições: o estilo de agora
   calcula-se primeiro, com elas desligadas, e só depois elas voltam.
   Recebe: t — o #toast.
   Devolve: nada. */
function avisoAssentar(t){
  try{void getComputedStyle(t).opacity}catch(x){}
  t.classList.remove('arrastar');t.classList.remove('pronto');
}
/* O prazo do aviso volta a contar, com o que faltava (pelo menos
   AVISO_RETOMA_MS), e o op fica a saber quanto tempo ele ganhou.
   Recebe: a — o arrasto que acabou com o aviso à vista.
   Devolve: nada. */
function avisoRetoma(a){
  const t=a.t;
  if(!t.classList.contains('on')||t._op!==a.op)return;
  const resto=Math.max(a.resto,AVISO_RETOMA_MS);
  t._fim=Date.now()+resto;clearTimeout(t._h);
  t._h=setTimeout(()=>t.classList.remove('on'),resto);
  if(a.op.segura)a.op.segura(false,Math.max(0,t._fim-a.fimAntes));
}
/* Um aviso novo chegou: o arrasto ou a animação do anterior acabam aqui, e
   o op dele deixa de esperar pelo dedo (o prazo dele é o de sempre). As
   transições voltam já, sem assentar primeiro: o aviso novo regressa ao
   sítio pela transição do .on, a partir de onde o dedo o tinha.
   Recebe: t — o #toast (pode faltar).
   Devolve: nada. */
function avisoInterromper(t){
  if(!t)return;
  const a=_avisoArr;
  if(a&&a.t===t){avisoArrastoLargar();if(a.op.segura)a.op.segura(false,0)}
  if(t._anim){const an=t._anim;t._anim=null;try{an.cancel()}catch(x){}}
  if(a||(t.classList&&t.classList.contains('arrastar'))){
    t.style.transform='';t.classList.remove('arrastar');t.classList.remove('pronto');
  }
}
document.addEventListener('pointerdown',avisoPousar);

/* Põe o aviso acima do rodapé da janela que estiver aberta.

   O aviso mora a 22px do fundo, que é exatamente onde o rodapé de um modal
   está: caía em cima de «Guardar» e «Cancelar» — os botões que se está
   precisamente a pedir à pessoa para carregar.

   Corre nas duas ordens, e a segunda foi a que faltou à primeira tentativa:
   o aviso a aparecer com uma janela já aberta, e a janela a abrir com um
   aviso ainda no ecrã — o aviso fica quase três segundos, e nesses segundos
   abre-se uma janela por cima. Por isso é chamada também do openModal e do
   closeModal, e não só daqui.

   A altura é medida e não adivinhada (há rodapés de duas linhas), e é a do
   rodapé mais alto de todas as janelas abertas: com janelas empilhadas, a de
   cima é a última.
   Devolve: nada — escreve a variável --acima no aviso. */
function avisoAcimaDoRodape(){
  const t=document.getElementById('toast');
  if(!t||!t.style||!t.style.setProperty)return;
  /* Mede-se até ao TOPO do rodapé, e não a altura dele. No telemóvel a folha
     encosta ao fundo e dá no mesmo; no computador a janela está ao meio do
     ecrã, e subir só a altura do rodapé deixava o aviso a tapá-lo à mesma —
     foi o que a cena nova apanhou, com 21px de sobreposição. */
  const H=window.innerHeight||0;
  let acima=0;
  [].slice.call(document.querySelectorAll('.modal.open .foot')).forEach(function(pes){
    const r=pes.getBoundingClientRect();
    if(r.height)acima=Math.max(acima,H-r.top);
  });
  /* Sem rodapé por cima, a barra de baixo do telemóvel: o aviso a 22px do
     fundo tapava o Casas, o + e o Dinheiro durante segundos. Só quando ela
     está à vista (no computador, com a gaveta aberta ou em seleção é
     display:none e o rect vem vazio). Aqui sem os 12px de folga de baixo: o
     aviso fica à distância de sempre (os 22px do fundo), contada do topo da
     barra em vez do fundo do ecrã. Em seleção a barra de baixo some e fica a
     das ações (.sel-fundo, a das listas e a dos Movimentos, que no telemóvel
     tem duas linhas): o aviso sobe acima dela da mesma maneira. */
  if(!acima){
    const sf=document.querySelector('.sel-fundo'),rs=sf&&sf.getBoundingClientRect?sf.getBoundingClientRect():null;
    if(rs&&rs.height&&rs.top<H)acima=H-rs.top-12;
  }
  if(!acima){
    const barra=document.getElementById('tabbar'),r=barra&&barra.getBoundingClientRect?barra.getBoundingClientRect():null;
    if(r&&r.height&&r.top<H)acima=H-r.top-12;
  }
  t.style.setProperty('--acima',acima>0?Math.ceil(acima+12)+'px':'0px');
}
/* Mede outra vez quando a folha tiver assentado.

   Uma janela não está no sítio no instante em que abre: no telemóvel entra a
   deslizar de baixo, e medida aí o rodapé ainda está fora do ecrã — o aviso
   concluía que não havia rodapé nenhum por cima de quem subir.

   Cheguei a medir sem transform (offsetTop) para não esperar por nada, e
   estava errado do outro lado: no computador a janela está centrada POR um
   transform, e ignorá-lo punha o rodapé onde ele nunca esteve. O rect é a
   única medida verdadeira nos dois sítios — só tem de ser lida depois de a
   folha parar.
   Devolve: nada — remede daqui a um pouco mais do que dura a entrada. */
function avisoQuandoAssentar(){
  setTimeout(avisoAcimaDoRodape,msDoToken('--medio',200)+120);
}

/* ================= A FOLHA ARRASTA-SE PARA BAIXO =================
   Abaixo dos 520px uma janela é uma folha encostada em baixo, com a barra
   por cima do cabeçalho (estilos.css:.sheet::before) — e a barra promete o
   gesto que o sistema ensina: puxar para baixo fecha. Arrasta-se a janela de
   cima da pilha, com o dedo ou a caneta (AVISO_PONTEIROS: com o rato,
   arrastar é selecionar texto, e no computador a janela está ao meio do
   ecrã, sem barra).
   Agarra-se pelo cabeçalho (o .head, e a barra, que é da própria .sheet)
   sempre; pelo corpo só com ele no topo do scroll e o gesto a começar para
   baixo — a subir, ou com o corpo a meio, é o scroll de sempre (folhaZona).
   Nunca arranca de um campo, de um toque longo, nem de quem já tem o seu
   gesto (FOLHA_NAO_ARRANCA, e o que rola de lado).
   A folha segue o dedo e o véu aclara à proporção (folhaVeu); para cima
   resiste (folhaElastico). Largar passada metade da altura dela, ou com um
   sacudir para baixo — a regra do aviso, avisoFechaAoLargar —, fecha pelo
   closeModal('arrasto'): num formulário com alterações pergunta «Sair sem
   guardar?» como o X, e ficando, a folha volta ao sítio. A saída continua
   de onde o dedo a deixou (folhaFecha). Sem movimento pedido não segue o
   dedo: desvanece quando largar já fecha, e fecha sem animar. */
// a altura (px) que mede a resistência para cima: a folha nunca sobe mais de metade dela
const FOLHA_RESISTE=48;
// o que nunca agarra a folha: os campos, o toque longo, quem tem gesto próprio e as listas abertas
const FOLHA_NAO_ARRANCA='input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-lp],[data-pointerdown],'+
  '.chartbox[data-lido],.pago-por,[role="slider"],.selpop,.menupop';
let _folhaArr=null,_folhaEngole=0;
/* A janela mostra a barra? A mesma condição do CSS (estilos.css:.sheet::before,
   dentro de @media(max-width:520px)), lida pelo matchMedia.
   Devolve: true/false. */
function folhaComBarra(){
  try{return !!(window.matchMedia&&window.matchMedia('(max-width:520px)').matches)}catch(e){return false}
}
/* Por onde o dedo pegou na folha: pelo cabeçalho (o .head, ou a barra — que
   é a própria .sheet), ou pelo corpo no topo do scroll. Fora disso — o
   rodapé, um campo, um toque longo, quem tem gesto próprio, o que rola de
   lado, ou o corpo (ou uma caixa dentro dele) já rolado — não pega.
   Recebe: alvo — o elemento onde o dedo pousou; s — a .sheet da janela de cima.
   Devolve: 'cab', 'corpo' ou '' (não pega). */
function folhaZona(alvo,s){
  if(!alvo||!s||typeof alvo.closest!=='function'||typeof s.querySelector!=='function')return '';
  if(alvo.closest(FOLHA_NAO_ARRANCA))return '';
  const cab=s.querySelector('.head'),corpo=s.querySelector('.body');
  const zona=alvo===s||(cab&&cab.contains(alvo))?'cab':(corpo&&corpo.contains(alvo)?'corpo':'');
  if(!zona)return '';
  for(let el=alvo;el&&el!==s;el=el.parentElement){
    if(zona==='corpo'&&el.scrollTop>0)return '';
    if(typeof sepRolaDeLado==='function'&&sepRolaDeLado(el))return '';
  }
  return zona;
}
/* Para cima, a folha resiste: anda cada vez menos quanto mais se puxa, e
   nunca sobe mais de metade de FOLHA_RESISTE (a curva do avisoElastico). Uma
   folha encostada em baixo que subisse o que o dedo sobe descolava do fundo
   do ecrã.
   Recebe: dy — px que o dedo andou (negativo, para cima).
   Devolve: px a que a folha fica (com o sinal de dy). */
function folhaElastico(dy){return avisoElastico(dy,FOLHA_RESISTE)}
/* O véu por trás da folha aclara à medida que ela desce: inteiro no sítio,
   nada com a folha uma altura dela abaixo. Sem movimento, fica inteiro.
   Recebe: a — o arrasto ({desl, h, mexe}).
   Devolve: a opacidade do véu, de 0 a 1. */
function folhaVeu(a){
  if(!a||!a.mexe)return 1;
  return Math.max(0,Math.min(1,1-a.desl/(a.h||1)));
}
/* Onde a folha está agora, na vertical, contando com a animação que a
   estiver a levar (a entrada, ou o regresso ao sítio).
   Recebe: s — a .sheet.
   Devolve: px (0 no sítio). */
function folhaDeslocada(s){
  try{const m=/matrix\(([^)]*)\)/.exec(getComputedStyle(s).transform||'');
    return m?(parseFloat(m[1].split(',')[5])||0):0}catch(e){return 0}
}
/* Para o regresso da folha (e do véu) onde ele estiver.
   Recebe: s — a .sheet.
   Devolve: nada. */
function folhaPara(s){
  const an=s._folhaAnim,veu=s._folhaVeuAnim;s._folhaAnim=null;s._folhaVeuAnim=null;
  try{if(an)an.cancel()}catch(e){}
  try{if(veu)veu.cancel()}catch(e){}
}
/* O dedo pousou: se foi na janela de cima, por onde ela se agarra (folhaZona),
   e a janela mostra a barra, fica-se à escuta do arrasto. Pegar na folha a
   meio do regresso apanha-a onde ela está, sem salto.
   Recebe: e — o PointerEvent do pointerdown (ouvido no documento).
   Devolve: nada — liga os ouvintes do documento. */
function folhaPousar(e){
  if(_folhaArr||!e||e.button>0||e.isPrimary===false||AVISO_PONTEIROS.indexOf(e.pointerType)<0)return;
  if(!folhaComBarra())return;
  const L=modalTop(),el=L&&L.el;
  if(!el||typeof el.querySelector!=='function'||!el.classList.contains('open')||el.classList.contains('under'))return;
  const s=el.querySelector('.sheet'),alvo=e.target;
  if(!s||!alvo||typeof s.contains!=='function'||!s.contains(alvo))return;
  const zona=folhaZona(alvo,s);if(!zona)return;
  const a={id:e.pointerId,L,el,s,bg:el.querySelector('.bg'),zona,x0:e.clientX,y0:e.clientY,base:0,dy:0,desl:0,vy:0,
    ya:e.clientY,ta:avisoHora(e),ativo:false,mexe:!semMovimento(),h:1};
  if(s._folhaAnim){
    // a meio do regresso: fica onde a animação a tinha
    a.base=folhaDeslocada(s);folhaPara(s);
    const r=s.getBoundingClientRect();a.h=(r&&r.height)||s.offsetHeight||1;
    a.desl=a.dy=a.base;
    if(a.base){s.style.transform='translateY('+a.base+'px)';if(a.bg)a.bg.style.opacity=String(folhaVeu(a))}
  }
  _folhaArr=a;
  document.addEventListener('pointermove',folhaArrastoMove);
  document.addEventListener('pointerup',folhaArrastoFim);
  document.addEventListener('pointercancel',folhaArrastoFim);
}
/* O dedo andou: passados os 10px de decidir, na vertical, a folha segue-o;
   para o lado, ou a subir pelo corpo, o gesto não é dela (é o scroll). A
   folga de decidir não conta: a folha arranca colada ao dedo, sem salto.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada — mexe no transform da .sheet e na opacidade do véu. */
function folhaArrastoMove(e){
  const a=_folhaArr;if(!a||e.pointerId!==a.id)return;
  // abriu-se outra janela por cima, ou esta fechou por outro caminho: o gesto acaba aqui
  if(modalTop()!==a.L)return folhaDesiste(a);
  let dy=e.clientY-a.y0;const dx=e.clientX-a.x0;
  if(!a.ativo){
    if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy))return folhaDesiste(a);
    if(Math.abs(dy)<10)return;
    if(a.zona==='corpo'&&dy<0)return folhaDesiste(a);
    a.ativo=true;
    a.y0+=dy<0?-10:10;dy=e.clientY-a.y0;
    const r=a.s.getBoundingClientRect();a.h=(r&&r.height)||a.s.offsetHeight||1;
    // apanhada a meio da entrada: parte de onde a animação a tinha
    if(!a.base&&a.mexe)a.base=folhaDeslocada(a.s);
    a.el.classList.add('arrastou');a.s.classList.add('arrastar');
    try{a.s.setPointerCapture(a.id)}catch(x){}
    closePops();
  }
  const agora=avisoHora(e),dt=agora-a.ta;
  // a velocidade dos últimos instantes, alisada: é ela que diz se o gesto foi um sacudir
  if(dt>0)a.vy=.6*((e.clientY-a.ya)/dt)+.4*a.vy;
  a.ya=e.clientY;a.ta=agora;
  a.dy=a.base+dy;
  a.desl=a.dy>=0?a.dy:folhaElastico(a.dy);
  if(a.mexe){
    a.s.style.transform='translateY('+a.desl+'px)';
    if(a.bg)a.bg.style.opacity=String(folhaVeu(a));
  }
  a.s.classList.toggle('pronto',avisoFechaAoLargar(a,agora));
}
/* O browser não pode rolar o que a folha está a levar: um toque que agarrou
   pelo cabeçalho, ou pelo corpo a descer, trava o scroll (preventDefault).
   Sem isto, o browser tomava o gesto para si e mandava um pointercancel a
   meio. Um gesto a subir pelo corpo não se trava — é o scroll —, nem o de
   dois dedos.
   Recebe: e — o TouchEvent do touchmove (ouvido na .modal, modalLayer).
   Devolve: nada. */
function folhaToqueMove(e){
  const a=_folhaArr;if(!a||!e||e.cancelable===false)return;
  const t=e.touches&&e.touches.length===1?e.touches[0]:null;if(!t)return;
  if(!a.ativo&&a.zona!=='cab'){
    const dy=t.clientY-a.y0,dx=t.clientX-a.x0;
    if(dy<0||dy<Math.abs(dx))return;
  }
  e.preventDefault();
}
/* Um touchmove com passive:false faz cada toque na zona dele esperar pela
   thread principal antes de o browser rolar — e com fotos a descodificar,
   ou um repinte a meio, selecionar o nome de uma foto ou rolar o formulário
   ficava preso a isso. Por isso a .modal só o ouve quando a folha se pode
   agarrar pelo corpo: com a barra (até 520px) e o corpo no topo do scroll.
   Com o corpo rolado o corpo não agarra (folhaZona), e o cabeçalho e a barra
   não precisam dele: têm touch-action:none (estilos.css, as regiões da folha
   arrastável e das fotos rápidas). Corre ao abrir a janela e a cada scroll
   do corpo, e só mexe no ouvinte quando a resposta muda.
   Recebe: m — a .modal (do modalLayer).
   Devolve: true se fica a ouvir, false se não. */
function folhaOuvirToque(m){
  if(!m||typeof m.addEventListener!=='function')return false;
  const corpo=typeof m.querySelector==='function'?m.querySelector('.body'):null;
  const quer=folhaComBarra()&&!(corpo&&corpo.scrollTop>0);
  if(quer!==!!m._ouveToque){
    m._ouveToque=quer;
    if(quer)m.addEventListener('touchmove',folhaToqueMove,{passive:false});
    else m.removeEventListener('touchmove',folhaToqueMove,{passive:false});
  }
  return quer;
}
/* Tira os ouvintes do documento e esquece o arrasto.
   Devolve: nada. */
function folhaArrastoLargar(){
  document.removeEventListener('pointermove',folhaArrastoMove);
  document.removeEventListener('pointerup',folhaArrastoFim);
  document.removeEventListener('pointercancel',folhaArrastoFim);
  _folhaArr=null;
}
/* O gesto deixou de ser da folha (foi para o lado, subiu pelo corpo, ou a
   janela deixou de ser a de cima): larga-o e, se a folha tinha saído do
   sítio e ainda está aberta, devolve-a.
   Recebe: a — o arrasto.
   Devolve: nada. */
function folhaDesiste(a){
  folhaArrastoLargar();
  if(modalStack.indexOf(a.L)<0)return;
  if(a.ativo||a.base)folhaVoltaAoSitio(a);
}
/* O dedo saiu: fecha a janela, se o gesto chegou para isso, ou devolve a
   folha ao sítio. Um pointercancel nunca fecha. Depois de um arrasto, o
   clique que o browser dispara engole-se (não carrega no X nem no que
   estiver por baixo).
   Recebe: e — o PointerEvent do pointerup ou do pointercancel.
   Devolve: nada. */
function folhaArrastoFim(e){
  const a=_folhaArr;if(!a||(e&&e.pointerId!==a.id))return;
  if(modalTop()!==a.L)return folhaDesiste(a);
  folhaArrastoLargar();
  if(!a.ativo){if(a.base)folhaVoltaAoSitio(a);return}
  _folhaEngole=Date.now()+350;
  if(e&&e.type!=='pointercancel'&&avisoFechaAoLargar(a,avisoHora(e)))return folhaFecha(a);
  folhaVoltaAoSitio(a);
}
/* Fecha a janela largada em baixo, pelo closeModal('arrasto'). A saída
   (.sai, fecharComSaida) parte do transform que o dedo deixou — o
   folhaDesce só declara o fim —, e a .arrastada troca-lhe a curva pela
   --curva: o largar continua a velocidade do dedo (estilos.css, a região da
   folha arrastável). Se a janela ficou (a pergunta «Sair sem guardar?»
   abriu por cima), a folha volta ao sítio, por baixo dela.
   Recebe: a — o arrasto que acabou.
   Devolve: nada. */
function folhaFecha(a){
  a.s.classList.remove('arrastar');a.s.classList.remove('pronto');
  if(a.mexe)a.el.classList.add('arrastada');
  closeModal('arrasto');
  if(modalStack.indexOf(a.L)<0)return;
  a.el.classList.remove('arrastada');
  folhaVoltaAoSitio(a);
}
/* A folha volta ao sítio, a partir de onde o dedo a deixou (--medio,
   --curva-entra, como o aviso), e o véu escurece outra vez com ela. Sem
   movimento, ou sem deslocação, só assenta.
   Recebe: a — o arrasto.
   Devolve: nada. */
function folhaVoltaAoSitio(a){
  const s=a.s,bg=a.bg,de='translateY('+a.desl+'px)',veu=folhaVeu(a);
  s.classList.remove('arrastar');s.classList.remove('pronto');
  s.style.transform='';if(bg)bg.style.opacity='';
  if(!a.mexe||!a.desl||typeof s.animate!=='function')return;
  const dur=msDoToken('--medio',200),curva=tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)');
  const an=s.animate([{transform:de},{transform:'none'}],{duration:dur,easing:curva});
  s._folhaAnim=an;
  if(bg&&typeof bg.animate==='function')s._folhaVeuAnim=bg.animate([{opacity:veu},{opacity:1}],{duration:dur,easing:curva});
  const fim=()=>{if(s._folhaAnim!==an)return;s._folhaAnim=null;s._folhaVeuAnim=null};
  an.onfinish=fim;
  // a rede de sempre: num separador escondido o onfinish não chega
  setTimeout(fim,dur+120);
}
document.addEventListener('pointerdown',folhaPousar);
// o clique que o browser dá a seguir a um arrasto da folha não é um toque
document.addEventListener('click',e=>{
  if(!_folhaEngole)return;
  const engole=Date.now()<_folhaEngole;_folhaEngole=0;
  if(engole){e.stopPropagation();e.preventDefault()}
},true);
