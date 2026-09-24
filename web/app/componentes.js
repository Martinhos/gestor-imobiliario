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
   Devolve: nada — tira a classe .on aos menus abertos (e acerta o aria-expanded dos sel()). */
function closePops(keep){
  const list=document.querySelectorAll('.selpop.on,.menupop.on');
  [].slice.call(list).forEach(x=>{
    if(keep&&x.contains(keep))return;
    x.classList.remove('on');
    if(x.id&&x.id.indexOf('pop_')===0)selAberto(x.id.slice(4),false);   // o botão do sel() diz que fechou
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
  let limite={top:0,bottom:window.innerHeight};
  for(let a=p.parentElement;a&&a!==document.body;a=a.parentElement){
    const cs=getComputedStyle(a);
    if(/hidden|auto|scroll/.test(cs.overflow+cs.overflowX+cs.overflowY)){
      const r=a.getBoundingClientRect();
      limite={top:Math.max(0,r.top),bottom:Math.min(window.innerHeight,r.bottom)};
      break;
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
  try{if(o)o.focus()}catch(x){}
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
   Recebe: e — o evento keydown.
   Devolve: true se a tecla era do sel() e foi tratada; false para seguir. */
function selTecla(e){
  const t=e&&e.target;if(!t||typeof t.closest!=='function')return false;
  const caixa=t.closest('.sel');if(!caixa)return false;
  const pop=caixa.querySelector('.selpop'),btn=caixa.querySelector('.selbtn');
  if(!pop||!btn||!pop.id)return false;
  const k=e.key,aberto=pop.classList.contains('on');
  if(k==='Escape'){
    if(!aberto)return false;
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
  return `<span class="menuwrap"><button type="button" class="iconbtn opcoes" data-toca="camada" data-click="menuOpen(event,'${jsq(id)}')" aria-label="Opções">${ic('dots',18)}</button>
    <div class="menupop" id="menu_${esc(id)}">${items.map(it=>
      `<button type="button" class="${it.danger?'danger':''}"${it.toca?` data-toca="${it.toca}"`:''}${it.risco==='destroi'?' data-risco="destroi"':''} data-click="closePops();${it.act}">${ic(it.icon||'dots',17)} ${esc(it.label)}</button>`).join('')}</div></span>`;
}
// Abre/fecha o menu de ações (⋯) criado por menu(), com o mesmo ajuste de posição dos sel().
// Recebe: e — o evento do clique (pode vir null); id — o id dado ao menu() (abre menu_<id>).
// Devolve: nada — alterna a classe .on do menu no DOM.
function menuOpen(e,id){
  if(e)e.stopPropagation();
  const p=document.getElementById('menu_'+id),was=p&&p.classList.contains('on');
  closePops(p?p.parentNode:null);if(p&&!was){p.classList.add('on');ajustarPop(p);};
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
         <div class="pth pcover" id="th_${esc(f.id)}" data-click="openMeta('${jsq(f.id)}')">${i===0?'<span class="capa">capa</span>':''}</div>
         <input class="pnm" id="fn_${esc(f.id)}" value="${esc(f.name)}" placeholder="Nome da foto" autocomplete="off" data-input="livePhotoName('${jsq(f.id)}',this.value)">
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
// entre os metadados já guardados e os pendentes do formulário aberto.
// Recebe: fid — o id do ficheiro cuja ficha se abre.
// Devolve: nada — abre a janela com a ficha do ficheiro.
function openMeta(fid){openFileMeta(allFileMetas().concat(pendingMetas()).find(f=>f.id===fid))}
/* mostra as miniaturas depois do HTML entrar no DOM. "root" limita a procura (a lista de imóveis
   e a janela aberta por cima usam os mesmos ids). */
/* miniatura pequena de uma foto: usa a guardada (tn_), ou cria-a uma vez a partir do original.
   Recebe: id — o id da foto (chave do blob no IndexedDB; a miniatura vive em tn_<id>).
   Devolve: Promise que resolve para um object URL da miniatura (ou do original,
   se a miniatura não se conseguir criar), ou null quando o blob não existe. */
function thumbSrc(id){
  /* o thumbCache tem teto (anexos.js:guardarMiniatura): usar uma marca-a como recente */
  if(thumbCache[id]){usarMiniatura(id);return Promise.resolve(thumbCache[id])}
  return idbGet('tn_'+id).then(tb=>{
    if(tb)return guardarMiniatura(id,URL.createObjectURL(tb));
    return idbGet(id).then(b=>{
      if(!b)return null;
      return makeThumb(b).then(tb2=>{
        if(tb2)idbPut('tn_'+id,tb2).catch(()=>{});
        return guardarMiniatura(id,URL.createObjectURL(tb2||b));
      }).catch(()=>guardarMiniatura(id,URL.createObjectURL(b)));
    });
  });
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
      <button class="iconbtn" data-toca="camada" data-click="closeModal('x')" aria-label="Fechar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="body" id="modalBody"></div><div class="foot" id="modalFoot"></div></div>`;
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
// Preenche uma janela já criada: título, corpo, menu do cabeçalho e rodapé —
// por omissão, Cancelar + Guardar (que chama o onSave da janela de cima).
// Recebe: el — o elemento da janela (vindo do modalLayer); title — o texto do título;
// body — HTML do corpo; foot (opcional) — HTML do rodapé (por omissão Cancelar+Guardar);
// menuHtml (opcional) — HTML para o menu do cabeçalho.
// Devolve: nada — preenche a janela no DOM.
function fillModal(el,title,body,foot,menuHtml){
  el.querySelector('.head h2').textContent=title;
  el.querySelector('.body').innerHTML=semEtiquetasQueCorrem(body);
  if(typeof tornarFocavel==='function')tornarFocavel(el.querySelector('.body'));
  el.querySelector('.head span').innerHTML=semEtiquetasQueCorrem(menuHtml||'');
  el.querySelector('.foot').innerHTML=semEtiquetasQueCorrem(foot||`<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="onSave&&onSave()">Guardar</button>`);
}

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
/* Fechar por um caminho de abandono (toque no fundo, X, Escape, voltar)
   com alterações por guardar pergunta primeiro. Foi um dos achados mais
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
   'voltar'…): esses caminhos de abandono, com alterações por guardar,
   abrem primeiro a pergunta "Sair sem guardar?". Sem origem (Guardar,
   Cancelar), fecha sem perguntar — são decisões, não acidentes.
   Recebe: origem (opcional) — string com o caminho de saída ('fundo', 'x',
   'voltar'…); presente, e havendo alterações, abre primeiro a pergunta.
   Devolve: nada — tira a janela da pilha e repõe a de baixo (ou o foco no gatilho). */
function closeModal(origem){
  closePops();
  const L=modalTop();
  if(L&&!_forcaFecho&&typeof origem==='string'&&L.tocado&&L.snap!=null&&modalSnap(L.el)!==L.snap&&!navigator.webdriver){
    /* a pergunta veste o tema da app, não o do browser. Abrir a pergunta
       por cima também rearma o histórico (openModal→pushHist), por isso o
       "voltar" que trouxe até aqui fica tratado sozinho. */
    openModal('Sair sem guardar?',
      `<div class="hint u-fs-14px">Tens alterações por guardar nesta janela. Se saíres, perdem-se.</div>`,
      `<button class="btn" data-click="closeModal()">Continuar a editar</button>
       <button class="btn danger" data-click="_sairSemGuardar()">Sair sem guardar</button>`);
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
   Devolve: nada — mostra o toast e arma o prazo de seis segundos. */
function comDesfazer(msg,restaurar,aoExpirar){
  if(_desfazer&&_desfazer.expira)_desfazer.expira();   // o anterior liquida-se
  const eu={expira:aoExpirar||null};_desfazer=eu;
  toast(msg,{rotulo:'Anular',ms:6000,fn(){
    if(_desfazer===eu)_desfazer=null;
    restaurar();save();try{buildNav()}catch(e){}render();toast('Anulado.');
  }});
  setTimeout(()=>{if(_desfazer===eu){_desfazer=null;if(eu.expira)eu.expira()}},6400);
}

/* O toast diz o que falta; isto aponta o campo — realça-o, leva-o ao ecrã
   e larga o realce à primeira tecla.
   Recebe: id — o id do campo com o problema; msg — o texto do toast.
   Devolve: nada — mostra o toast e realça o campo no ecrã. */
function falhaCampo(id,msg){
  toast(msg);
  const e=document.getElementById(id);if(!e)return;
  e.classList.add('err');
  try{e.scrollIntoView({block:'center'})}catch(x){}
  try{e.focus({preventScroll:true})}catch(x){}
  e.addEventListener('input',()=>e.classList.remove('err'),{once:true});
}
/* escolher de uma lista, no estilo da app
   Recebe: title — o texto do título; options — lista de opções {label,sub,icon,
   avatar,…} (sub, icon e avatar são opcionais; a opção inteira volta no onPick);
   onPick — função chamada com a opção escolhida; extra (opcional) — HTML
   acrescentado por baixo da lista.
   Devolve: nada — abre a janela de escolha. */
function pickModal(title,options,onPick,extra){
  openModal(title,`<div class="form">
    ${options.length?`<div class="list u-g-7px">${options.map((o,i)=>
      `<button type="button" class="card tap u-p-12px-14px u-d-flex u-ai-center u-g-11px" data-click="_pick(${i})">
        ${o.icon?`<span class="ic u-w-34px u-h-34px u-br-10px u-d-grid u-pi-center u-fx-0-0-34px ${o.icon==='trash'?'comp-pick-ic-destroi':'comp-pick-ic-normal'}">${ic(o.icon,18)}</span>`:o.avatar?`<span class="avatar">${esc(initials(o.label))}</span>`:''}
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
   Devolve: nada — mostra o aviso no fundo do ecrã. */
function toast(m,op){const t=document.getElementById('toast');
  t.textContent=m;
  if(op&&op.rotulo&&op.fn){const b=document.createElement('button');b.type='button';b.className='toastbtn';
    b.textContent=op.rotulo;b.onclick=()=>{clearTimeout(t._h);t.classList.remove('on');op.fn()};t.appendChild(b)}
  avisoAcimaDoRodape();
  t.classList.add('on');clearTimeout(t._h);
  t._h=setTimeout(()=>t.classList.remove('on'),(op&&op.ms)||2800)}

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
