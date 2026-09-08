/* ================= COMPONENTES ================= */
/* menu de escolha próprio — substitui o <select> do sistema, que destoava */
window.__sel={};
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
   (opcional) — o nome de uma função global a chamar quando se escolhe; toca
   (opcional) — a família das opções: 'vista' num filtro, 'rascunho' num
   formulário, 'dados' se a escolha grava logo.
   Devolve: string de HTML do menu, pronta a inserir com innerHTML. */
function sel(id,value,options,onchange,toca){
  window.__sel[id]={options:options,onchange:onchange||''};
  const cur=options.find(o=>!o.div&&String(o.v)===String(value))||options.find(o=>!o.div)||{v:'',label:'—'};
  return `<div class="sel" id="sel_${id}">
    <input type="hidden" id="${id}" value="${esc(value==null?'':value)}">
    <button type="button" class="selbtn" data-toca="camada" onclick="selOpen(event,'${id}')"><span id="lab_${id}">${esc(cur.label)}</span>${ic('chevD',16)}</button>
    <div class="selpop" id="pop_${id}">
      ${options.map((o,i)=>o.div?'<div class="sdiv"></div>':`<button type="button" class="selopt ${String(o.v)===String(value)?'on':''}"${toca?` data-toca="${toca}"`:''} onclick="selPick(event,'${id}',${i})">
        <span>${esc(o.label)}</span>${String(o.v)===String(value)?ic('check',16):''}</button>`).join('')}
    </div></div>`;
}
/* grupos no fim do dropdown, separados por uma linha */
const gdiv=arr=>arr.length?[{div:true}].concat(arr):[];
const gOpts=kind=>grpsOf(kind).map(g=>({v:'g:'+g.id,label:'Grupo · '+g.name}));
/* fecha os menus abertos, excepto os que contêm "keep" (um menu de escolha dentro do menu de filtros
   não pode fechar o menu que o contém)
   Recebe: keep (opcional) — um elemento do DOM; os menus que o contenham ficam abertos.
   Devolve: nada — tira a classe .on aos menus abertos. */
function closePops(keep){
  const list=document.querySelectorAll('.selpop.on,.menupop.on');
  [].slice.call(list).forEach(x=>{if(!(keep&&x.contains(keep)))x.classList.remove('on')});
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
// Recebe: e — o evento do clique (trava-lhe a propagação; pode vir null); id — o id dado ao sel().
// Devolve: nada — alterna a classe .on do dropdown no DOM.
function selOpen(e,id){
  if(e)e.stopPropagation();
  const p=document.getElementById('pop_'+id),was=p&&p.classList.contains('on');
  closePops(p?p.parentNode:null);
  if(p&&!was){p.classList.add('on');ajustarPop(p);}
}
/* Escolha de uma opção: escreve o valor no input escondido, troca o rótulo do
   botão, fecha o menu e chama o onchange registado (pelo nome, em window) —
   é por aí que os formulários reagem à mudança.
   Recebe: e — o evento do clique (pode vir null); id — o id dado ao sel();
   i — o índice da opção escolhida em window.__sel[id].options.
   Devolve: nada — atualiza o input e o rótulo no DOM e chama o onchange. */
function selPick(e,id,i){
  if(e)e.stopPropagation();
  const cfg=window.__sel[id]||{options:[]},o=cfg.options[i];if(!o)return;
  const inp=document.getElementById(id);if(inp)inp.value=o.v;
  const lab=document.getElementById('lab_'+id);if(lab)lab.textContent=o.label;
  const pop=document.getElementById('pop_'+id);if(pop)pop.classList.remove('on');
  if(cfg.onchange&&window[cfg.onchange])window[cfg.onchange]();
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
  return `<span class="menuwrap"><button type="button" class="iconbtn opcoes" data-toca="camada" onclick="menuOpen(event,'${id}')" aria-label="Opções">${ic('dots',18)}</button>
    <div class="menupop" id="menu_${id}">${items.map(it=>
      `<button type="button" class="${it.danger?'danger':''}"${it.toca?` data-toca="${it.toca}"`:''}${it.risco==='destroi'?' data-risco="destroi"':''} onclick="closePops();${it.act}">${ic(it.icon||'dots',17)} ${esc(it.label)}</button>`).join('')}</div></span>`;
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
      <button type="button" data-toca="rascunho" onclick="${removeAct}('${jsq(it.id)}')" aria-label="Remover">${ic('x',13)}</button></span>`).join('')}
    <button type="button" class="tagadd" data-toca="${tocaAdd||'rascunho'}" onclick="${addAct}">+ ${esc(addLabel)}</button></div>`;
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
  return `<div class="sect fold ${open?'open':''}" id="fold_${id}">
    <button type="button" class="fold-head" data-toca="nada" onclick="toggleFold('${id}')"><span class="ic">${ic(o.icon||'dots',17)}</span><b>${title}</b>
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
      `<div class="list" style="gap:8px">${list.map((f,i)=>`<div class="prow">
         <div class="pth pcover" id="th_${f.id}" onclick="openMeta('${f.id}')">${i===0?'<span class="capa">capa</span>':''}</div>
         <input class="pnm" id="fn_${f.id}" value="${esc(f.name)}" placeholder="Nome da foto" autocomplete="off" oninput="livePhotoName('${f.id}',this.value)">
         ${opts.move?`<button type="button" class="pgrab" aria-label="Arrastar para reordenar" onpointerdown="photoDrag(event,this,${i})">${ic('grip',16)}</button>`:''}
         <button type="button" class="btn sm danger" aria-label="Apagar a fotografia" style="flex:0 0 auto;min-width:40px;min-height:40px;margin-left:8px" onclick="delFileConfirm('${delFn}','${f.id}','fotografia')">${ic('trash',14)}</button></div>`).join('')}</div>`
      :`<div class="list" style="gap:8px;margin-bottom:9px">${list.map(f=>`
        <div class="card" style="padding:10px 12px"><div class="row-between" style="align-items:center">
          <div style="min-width:0;cursor:pointer" onclick="openMeta('${f.id}')">
            <div style="font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</div>
            <div class="small">${kb(f.size)}${f.added?' · '+f.added:''}</div></div>
          <button type="button" class="btn sm danger" aria-label="Apagar o ficheiro" style="min-width:40px;min-height:40px" onclick="delFileConfirm('${delFn}','${f.id}','ficheiro')">${ic('trash',14)}</button>
        </div></div>`).join('')}</div>`):''}
    <input type="file" id="${inputId}" multiple ${photos?'accept="image/*"':''} style="display:none" onchange="${onPick}(this${opts.arg?",'"+opts.arg+"'":''})">
    <button type="button" class="btn sm" style="margin-top:9px" onclick="document.getElementById('${inputId}').click()">${ic(photos?'photo':'clip',14)} ${opts.addLabel||(photos?'Adicionar fotos':'Adicionar ficheiro')}</button>
    ${opts.hint?`<div class="hint" style="margin-top:8px">${opts.hint}</div>`:''}</div>`;
}
/* A confirmação que faltava: o apagar ficava a 8px do puxador de arrastar,
   ambos pequenos, e o toque falhado destruía o ficheiro no ato — do
   IndexedDB, sem undo. Agora pergunta, e diz o que se perde.
   Recebe: fn — o nome (em window) da função que apaga; fid — o id do ficheiro,
   passado a essa função; tipo — 'fotografia' ou 'ficheiro', para o texto da pergunta.
   Devolve: nada — abre a janela de confirmação; só se apaga depois do sim. */
function delFileConfirm(fn,fid,tipo){
  const foto=tipo==='fotografia';
  confirmModal(foto?'Apagar a fotografia':'Apagar o ficheiro',
    (foto?'A fotografia':'O ficheiro')+' desaparece já daqui e do armazenamento. Não há como desfazer.',
    ()=>{const f=window[fn];if(typeof f==='function')f(fid)});
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
  if(thumbCache[id])return Promise.resolve(thumbCache[id]);
  return idbGet('tn_'+id).then(tb=>{
    if(tb){thumbCache[id]=URL.createObjectURL(tb);return thumbCache[id]}
    return idbGet(id).then(b=>{
      if(!b)return null;
      return makeThumb(b).then(tb2=>{
        if(tb2)idbPut('tn_'+id,tb2).catch(()=>{});
        thumbCache[id]=URL.createObjectURL(tb2||b);return thumbCache[id];
      }).catch(()=>{thumbCache[id]=URL.createObjectURL(b);return thumbCache[id]});
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
  m.innerHTML=`<div class="bg" data-toca="camada" onclick="closeModal('fundo')"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
    <div class="head"><h2 id="modalTitle"></h2><div class="spacer"></div><span id="modalMenu"></span>
      <button class="iconbtn" data-toca="camada" onclick="closeModal('x')" aria-label="Fechar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
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
// Preenche uma janela já criada: título, corpo, menu do cabeçalho e rodapé —
// por omissão, Cancelar + Guardar (que chama o onSave da janela de cima).
// Recebe: el — o elemento da janela (vindo do modalLayer); title — o texto do título;
// body — HTML do corpo; foot (opcional) — HTML do rodapé (por omissão Cancelar+Guardar);
// menuHtml (opcional) — HTML para o menu do cabeçalho.
// Devolve: nada — preenche a janela no DOM.
function fillModal(el,title,body,foot,menuHtml){
  el.querySelector('.head h2').textContent=title;
  el.querySelector('.body').innerHTML=body;
  if(typeof tornarFocavel==='function')tornarFocavel(el.querySelector('.body'));
  el.querySelector('.head span').innerHTML=menuHtml||'';
  el.querySelector('.foot').innerHTML=foot||`<button class="btn" data-toca="camada" onclick="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" onclick="onSave&&onSave()">Guardar</button>`;
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
   a null — quem chama define-o. */
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
      `<div class="hint" style="font-size:14px">Tens alterações por guardar nesta janela. Se saíres, perdem-se.</div>`,
      `<button class="btn" onclick="closeModal()">Continuar a editar</button>
       <button class="btn danger" onclick="_sairSemGuardar()">Sair sem guardar</button>`);
    return;
  }
  const M=modalStack.pop();lockPage();if(!M)return;
  M.el.remove();
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
const val=id=>{const e=document.getElementById(id);return e?e.value:''};
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
  openModal(title,`<div class="hint" style="font-size:14px">${text}</div>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn ${verbo?'danger':'primary'}" onclick="_ok()">${verbo||'Confirmar'}</button>`);
  window._ok=()=>{closeModal();cb()};
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
    ${options.length?`<div class="list" style="gap:7px">${options.map((o,i)=>
      `<button type="button" class="card tap" style="padding:12px 14px;display:flex;align-items:center;gap:11px" onclick="_pick(${i})">
        ${o.icon?`<span class="ic" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:${o.icon==='trash'?'var(--danger-soft)':'var(--accent-soft)'};color:${o.icon==='trash'?'var(--danger)':'var(--accent)'};flex:0 0 34px">${ic(o.icon,18)}</span>`:o.avatar?`<span class="avatar">${esc(initials(o.label))}</span>`:''}
        <span style="flex:1;min-width:0;text-align:left"><b style="display:block;font-size:14px">${esc(o.label)}</b>
        ${o.sub?`<span class="small">${esc(o.sub)}</span>`:''}</span></button>`).join('')}</div>`
      :`<div class="hint">Não há nada para escolher.</div>`}
    ${extra||''}</div>`,`<button class="btn" onclick="closeModal()">Voltar</button>`);
  window._pick=i=>onPick(options[i]);
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
window.addEventListener('scroll',()=>{const b=document.getElementById('toTop');if(b)b.classList.toggle('on',window.scrollY>420)},{passive:true});
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
   "prop:abc") e mostra as ações que fazem sentido para esse cartão — imóvel,
   movimento, contrato, pessoa, recorrente, modelo ou hipoteca. A seleção em
   massa (cloud/selecao.js) embrulha-o para tratar dos movimentos à maneira dela.
   Cada ação passa primeiro por pode()/podeEditar(): num imóvel onde só
   colaboro, só aparece o que o cargo permite (e editar/apagar só o que eu
   próprio adicionei); um cargo que só vê fica com «Ver …» ou com o toast do
   lpShow.
   Recebe: v — o valor do data-lp do cartão, no formato "tipo:id" (pessoas e
   hipotecas levam dois ids: "per:owner:<id>" ou "per:tenant:<id>", e
   "mort:<idImovel>:<idHipoteca>").
   Devolve: nada — abre a folha de opções (ou não faz nada, se o alvo já não existir). */
function lpMenu(v){
  const a=String(v||'').split(':'),k=a[0],id=a[1];
  if(k==='prop'){const p=prop(id);if(!p)return;
    const opts=[pode(id,'house.edit')?{label:'Editar imóvel',icon:'building',act:()=>propModal(id)}:{label:'Ver imóvel',icon:'building',act:()=>propView(id)}];
    if(p.use==='investimento'&&pode(id,'contract.add'))opts.push({label:'Novo contrato',icon:'contract',act:()=>ctModal(null,id)});
    if(pode(id,'tx.add'))opts.push({label:'Registar despesa',icon:'dn',act:()=>txModal(null,'expense',id)});
    /* pagar crédito abate capital à hipoteca, que vive na ficha do imóvel: pede também «Editar a ficha» (motivoCredito) */
    if(liveLoans(p).length&&!motivoCredito(id))opts.push({label:'Pagamento de crédito',icon:'bank',act:()=>txModal(null,'loan',id)},{label:'Amortização',icon:'trend',act:()=>amortModal(id)});
    if(souCriador(id))opts.push({label:'Apagar imóvel',icon:'trash',act:()=>delProp(id)});
    return lpShow(p.name,opts);}
  if(k==='tx'){const t=db.transactions.find(x=>x.id===id);if(!t)return;
    const ok=podeEditar(t.propertyId,'tx.add',t);
    return lpShow(t.label,[{label:ok?'Editar movimento':'Ver movimento',icon:'swap',act:()=>txModal(id)}].concat(ok?[{label:'Apagar movimento',icon:'trash',act:()=>delTx(id)}]:[]));}
  if(k==='ct'){const c=contract(id);if(!c)return;
    const ok=podeEditar(c.propertyId,'contract.add',c);
    const opts=[{label:ok?'Editar contrato':'Ver contrato',icon:'contract',act:()=>ctModal(id)}];
    if(isActive(c)&&pode(c.propertyId,'tx.add'))opts.push({label:'Registar renda',icon:'up',act:()=>txModal(null,'income',c.propertyId,null,id)});
    opts.push({label:'Gerar contrato em PDF',icon:'pen',act:()=>generateContractPdf(id)});
    if(ok)opts.push(isActive(c)?{label:'Terminar contrato',icon:'x',act:()=>endContract(id)}:{label:'Reativar contrato',icon:'check',act:()=>reactivateContract(id)},
      {label:'Apagar contrato',icon:'trash',act:()=>delContract(id)});
    return lpShow(ctName(c),opts);}
  if(k==='per'){const kind=a[1],pid=a[2],list=kind==='owner'?db.owners:db.tenants,pp=list.find(x=>x.id===pid);if(!pp)return;
    const ok=kind==='owner'||podeEditarInquilino(pp);
    return lpShow(pp.name,[{label:ok?'Editar ficha':'Ver ficha',icon:'users',act:()=>personModal(kind,pid)}].concat(ok?[{label:'Apagar',icon:'trash',act:()=>delPerson(kind,pid)}]:[]));}
  if(k==='rec'){const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
    /* com rec.add confirmo e silencio qualquer planeado (o servidor só lhe funde next, until e muted);
       editar os campos e apagar é só o que eu criei — o alheio que termina ao confirmar apaga-se
       pelo Confirmar, não por aqui */
    const hid=(r.tx||{}).propertyId,conf=podeEditar(hid,'rec.add',r,'confirmar'),edita=podeEditar(hid,'rec.add',r),opts=[];
    if(r.next&&r.next<=today()&&!recusaConfirmar(r))opts.push({label:'Confirmar',icon:'check',act:()=>quickConfirmRec(id)});
    if(conf)opts.push({label:r.muted?'Reativar avisos':'Silenciar',icon:'clock',act:()=>skipRec(id)});
    if(edita)opts.push({label:'Editar',icon:'swap',act:()=>editRec(id)},{label:'Apagar',icon:'trash',act:()=>delRec(id)});
    return lpShow(r.name,opts);}
  if(k==='tpl'){const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
    return lpShow(x.name,[{label:'Usar modelo',icon:'plus',act:()=>newFromTemplate(id)},{label:'Editar',icon:'file',act:()=>editTpl(id)},{label:'Apagar',icon:'trash',act:()=>delTpl(id)}]);}
  if(k==='mort'){const pid=a[1],lid=a[2],p=prop(pid),l=findLoan(p,lid);if(!l)return;
    const opts=pode(pid,'house.edit')?[{label:'Editar hipoteca',icon:'bank',act:()=>mortModal(pid,lid)}]:[];
    if(Number(l.outstanding)>0&&!motivoCredito(pid))opts.push({label:'Pagamento de crédito',icon:'bank',act:()=>txModal(null,'loan',pid,null,null,{loanId:lid})},{label:'Amortização',icon:'trend',act:()=>amortModal(pid,lid)});
    if(pode(pid,'house.edit'))opts.push({label:'Apagar hipoteca',icon:'trash',act:()=>delMortFrom(pid,lid)});
    return lpShow(loanName(l),opts);}
}
/* Põe a janela de cima em modo só de leitura: desativa os campos e os botões
   do corpo (as dobras continuam a abrir) e troca o rodapé por «Fechar». É o
   que uma ficha de inquilino, um movimento ou um contrato de um imóvel onde
   só colaboro mostram quando o cargo não deixa alterar. A camada fica
   marcada (soLeitura), para o que repinta o corpo a partir de um div
   clicável (as miniaturas do contrato) saber que não deve.
   Recebe: msg (opcional) — um hint a pôr no topo do corpo, a dizer porquê.
   Devolve: nada — mexe na janela de cima. */
function modalSoLeitura(msg){
  const t=modalTop();if(!t)return;
  t.onSave=null;t.soLeitura=true;
  const b=t.el.querySelector('.body');
  if(b){
    [].slice.call(b.querySelectorAll('input,textarea,select,button:not(.fold-head)')).forEach(e=>{e.disabled=true});
    if(msg)b.insertAdjacentHTML('afterbegin',`<div class="hint" style="margin-bottom:12px">${msg}</div>`);
  }
  const f=t.el.querySelector('.foot');if(f)f.innerHTML=`<button class="btn" onclick="closeModal()">Fechar</button>`;
  t.snap=modalSnap(t.el);t.tocado=false;   /* nada por guardar: fechar nunca pergunta */
}
