/* ================= COMPONENTES ================= */
/* menu de escolha próprio — substitui o <select> do sistema, que destoava */
window.__sel={};
function sel(id,value,options,onchange){
  window.__sel[id]={options:options,onchange:onchange||''};
  const cur=options.find(o=>!o.div&&String(o.v)===String(value))||options.find(o=>!o.div)||{v:'',label:'—'};
  return `<div class="sel" id="sel_${id}">
    <input type="hidden" id="${id}" value="${esc(value==null?'':value)}">
    <button type="button" class="selbtn" onclick="selOpen(event,'${id}')"><span id="lab_${id}">${esc(cur.label)}</span>${ic('chevD',16)}</button>
    <div class="selpop" id="pop_${id}">
      ${options.map((o,i)=>o.div?'<div class="sdiv"></div>':`<button type="button" class="selopt ${String(o.v)===String(value)?'on':''}" onclick="selPick(event,'${id}',${i})">
        <span>${esc(o.label)}</span>${String(o.v)===String(value)?ic('check',16):''}</button>`).join('')}
    </div></div>`;
}
/* grupos no fim do dropdown, separados por uma linha */
const gdiv=arr=>arr.length?[{div:true}].concat(arr):[];
const gOpts=kind=>grpsOf(kind).map(g=>({v:'g:'+g.id,label:'Grupo · '+g.name}));
/* fecha os menus abertos, excepto os que contêm "keep" (um menu de escolha dentro do menu de filtros
   não pode fechar o menu que o contém) */
function closePops(keep){
  const list=document.querySelectorAll('.selpop.on,.menupop.on');
  [].slice.call(list).forEach(x=>{if(!(keep&&x.contains(keep)))x.classList.remove('on')});
}
function selOpen(e,id){
  if(e)e.stopPropagation();
  const p=document.getElementById('pop_'+id),was=p&&p.classList.contains('on');
  closePops(p?p.parentNode:null);if(p&&!was)p.classList.add('on');
}
function selPick(e,id,i){
  if(e)e.stopPropagation();
  const cfg=window.__sel[id]||{options:[]},o=cfg.options[i];if(!o)return;
  const inp=document.getElementById(id);if(inp)inp.value=o.v;
  const lab=document.getElementById('lab_'+id);if(lab)lab.textContent=o.label;
  const pop=document.getElementById('pop_'+id);if(pop)pop.classList.remove('on');
  if(cfg.onchange&&window[cfg.onchange])window[cfg.onchange]();
}
/* menu de ações (⋯) */
function menu(id,items){
  return `<span class="menuwrap"><button type="button" class="iconbtn" onclick="menuOpen(event,'${id}')" aria-label="Mais">${ic('dots',20)}</button>
    <div class="menupop" id="menu_${id}">${items.map(it=>
      `<button type="button" class="${it.danger?'danger':''}" onclick="closePops();${it.act}">${ic(it.icon||'dots',17)} ${esc(it.label)}</button>`).join('')}</div></span>`;
}
function menuOpen(e,id){
  if(e)e.stopPropagation();
  const p=document.getElementById('menu_'+id),was=p&&p.classList.contains('on');
  closePops(p?p.parentNode:null);if(p&&!was)p.classList.add('on');
}
/* etiquetas removíveis */
function tagField(items,addLabel,addAct,removeAct,cls){
  return `<div class="tagbox">
    ${items.map(it=>`<span class="tag ${cls||''}">${esc(it.label)}
      <button type="button" onclick="${removeAct}('${jsq(it.id)}')" aria-label="Remover">${ic('x',13)}</button></span>`).join('')}
    <button type="button" class="tagadd" onclick="${addAct}">+ ${esc(addLabel)}</button></div>`;
}
/* secção que abre e fecha; o estado dura enquanto a janela estiver aberta */
let foldState={};
function fold(id,title,body,o){
  o=o||{};const open=foldState[id]===undefined?!!o.open:foldState[id];
  return `<div class="sect fold ${open?'open':''}" id="fold_${id}">
    <button type="button" class="fold-head" onclick="toggleFold('${id}')"><span class="ic">${ic(o.icon||'dots',17)}</span><b>${title}</b>
      ${o.summary?`<span class="fsum">${o.summary}</span>`:''}<span class="chev">${ic('chevD',16)}</span></button>
    <div class="fold-body">${body}</div></div>`;
}
function toggleFold(id){const el=document.getElementById('fold_'+id);if(!el)return;const on=!el.classList.contains('open');el.classList.toggle('open',on);foldState[id]=on}
/* bloco de ficheiros reutilizável */
function fileBlock(label,list,inputId,onPick,delFn,opts){
  opts=opts||{};
  const photos=opts.photos;
  return `<div>${label?`<div class="flabel">${esc(label)}</div>`:''}
    ${list.length?(photos?
      `<div class="list" style="gap:8px">${list.map((f,i)=>`<div class="prow">
         <div class="pth pcover" id="th_${f.id}" onclick="openMeta('${f.id}')">${i===0?'<span class="capa">capa</span>':''}</div>
         <input class="pnm" id="fn_${f.id}" value="${esc(f.name)}" placeholder="Nome da foto" autocomplete="off" oninput="livePhotoName('${f.id}',this.value)">
         ${opts.move?`<button type="button" class="pgrab" aria-label="Arrastar para reordenar" onpointerdown="photoDrag(event,this,${i})">${ic('grip',16)}</button>`:''}
         <button type="button" class="btn sm danger" style="flex:0 0 auto" onclick="${delFn}('${f.id}')">${ic('trash',14)}</button></div>`).join('')}</div>`
      :`<div class="list" style="gap:8px;margin-bottom:9px">${list.map(f=>`
        <div class="card" style="padding:10px 12px"><div class="row-between" style="align-items:center">
          <div style="min-width:0;cursor:pointer" onclick="openMeta('${f.id}')">
            <div style="font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</div>
            <div class="small">${kb(f.size)}${f.added?' · '+f.added:''}</div></div>
          <button type="button" class="btn sm danger" onclick="${delFn}('${f.id}')">${ic('trash',14)}</button>
        </div></div>`).join('')}</div>`):''}
    <input type="file" id="${inputId}" multiple ${photos?'accept="image/*"':''} style="display:none" onchange="${onPick}(this${opts.arg?",'"+opts.arg+"'":''})">
    <button type="button" class="btn sm" style="margin-top:9px" onclick="document.getElementById('${inputId}').click()">${ic(photos?'photo':'clip',14)} ${opts.addLabel||(photos?'Adicionar fotos':'Adicionar ficheiro')}</button>
    ${opts.hint?`<div class="hint" style="margin-top:8px">${opts.hint}</div>`:''}</div>`;
}
function openMeta(fid){openFileMeta(allFileMetas().concat(pendingMetas()).find(f=>f.id===fid))}
/* mostra as miniaturas depois do HTML entrar no DOM. "root" limita a procura (a lista de imóveis
   e a janela aberta por cima usam os mesmos ids). */
/* miniatura pequena de uma foto: usa a guardada (tn_), ou cria-a uma vez a partir do original */
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
function paintThumbs(list,root){
  root=root||(modalTop()?modalTop().el:document);
  (list||[]).forEach(f=>{
    const box=root.querySelector('[id="th_'+f.id+'"]');if(!box)return;
    thumbSrc(f.id)
      .then(src=>{if(src&&box){const o=box.querySelector('img');if(o)o.remove();box.insertAdjacentHTML('afterbegin',`<img src="${src}" alt="">`)}}).catch(()=>{});
  });
}
function livePhotoName(id,v){const f=(window.pForm&&pForm.photos||[]).find(x=>x.id===id);if(f)f.name=v}

/* ================= MODAL =================
   Janelas empilhadas: abrir uma segunda janela não fecha a primeira — fica por baixo,
   escurecida e inerte, e volta quando a de cima fecha. Só a janela de cima mantém os
   ids (os da de baixo passam para data-mid), por isso getElementById continua a apontar
   para o formulário que está a ser editado. */
let modalStack=[];
const modalTop=()=>modalStack[modalStack.length-1]||null;
const modalBodyEl=()=>{const t=modalTop();return t?t.el.querySelector('.body'):null};
Object.defineProperty(window,'onSave',{configurable:true,
  get(){const t=modalTop();return t?t.onSave:null},
  set(v){const t=modalTop();if(t)t.onSave=v}});
function modalLayer(){
  const m=document.createElement('div');m.className='modal open';
  m.innerHTML=`<div class="bg" onclick="closeModal()"></div><div class="sheet">
    <div class="head"><h2 id="modalTitle"></h2><div class="spacer"></div><span id="modalMenu"></span>
      <button class="iconbtn" onclick="closeModal()" aria-label="Fechar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="body" id="modalBody"></div><div class="foot" id="modalFoot"></div></div>`;
  return m;
}
function demote(el){
  [].slice.call(el.querySelectorAll('[id]')).forEach(x=>{x.setAttribute('data-mid',x.id);x.removeAttribute('id')});
  el.classList.add('under');el.setAttribute('aria-hidden','true');try{el.inert=true}catch(e){}
}
function promote(el){
  [].slice.call(el.querySelectorAll('[data-mid]')).forEach(x=>{x.id=x.getAttribute('data-mid');x.removeAttribute('data-mid')});
  el.classList.remove('under');el.removeAttribute('aria-hidden');try{el.inert=false}catch(e){}
}
function fillModal(el,title,body,foot,menuHtml){
  el.querySelector('.head h2').textContent=title;
  el.querySelector('.body').innerHTML=body;
  el.querySelector('.head span').innerHTML=menuHtml||'';
  el.querySelector('.foot').innerHTML=foot||`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="onSave&&onSave()">Guardar</button>`;
}
/* o botão “voltar” do Android fecha primeiro o que estiver aberto (janela ou menu).
   Uma única sentinela no histórico enquanto houver camadas: voltar fecha a de cima
   e volta a armar a sentinela se ainda restarem; sem nada aberto, sai da app. */
let _histOn=false;
function pushHist(){if(_histOn)return;try{history.pushState({gi:1},'');_histOn=true}catch(e){}}
window.addEventListener('popstate',()=>{
  _histOn=false;
  closePops();
  const drawer=document.body.classList.contains('open');
  if(drawer||modalStack.length){
    if(drawer)closeDrawer(true);else closeModal(true);
    if(document.body.classList.contains('open')||modalStack.length)pushHist();
  }else{
    try{history.back()}catch(e){}
  }
});
function openModal(title,body,foot,menuHtml){
  closePops();
  const top=modalTop();if(top)demote(top.el);
  const el=modalLayer();document.body.appendChild(el);
  const L={el,title,onSave:null};modalStack.push(L);lockPage();pushHist();
  fillModal(el,title,body,foot,menuHtml);
  el.querySelector('.body').scrollTop=0;
  return L;
}
/* substitui o conteúdo da janela de cima (sem empilhar) */
function setModal(title,body,foot,menuHtml){
  const t=modalTop();if(!t)return openModal(title,body,foot,menuHtml);
  closePops();t.title=title;t.onSave=null;fillModal(t.el,title,body,foot,menuHtml);return t;
}
function closeModal(fromPop){
  closePops();
  const L=modalStack.pop();lockPage();if(!L)return;
  L.el.remove();
  const top=modalTop();if(top)promote(top.el);
}
function closeAllModals(){while(modalStack.length)closeModal()}
const val=id=>{const e=document.getElementById(id);return e?e.value:''};
const chk=id=>{const e=document.getElementById(id);return e?!!e.checked:false};
function confirmModal(title,text,cb){
  openModal(title,`<div class="hint" style="font-size:14px">${text}</div>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="_ok()">Confirmar</button>`);
  window._ok=()=>{closeModal();cb()};
}
/* escolher de uma lista, no estilo da app */
function pickModal(title,options,onPick,extra){
  openModal(title,`<div class="form">
    ${options.length?`<div class="list" style="gap:7px">${options.map((o,i)=>
      `<button type="button" class="card tap" style="padding:12px 14px;display:flex;align-items:center;gap:11px" onclick="_pick(${i})">
        ${o.icon?`<span class="ic" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);flex:0 0 34px">${ic(o.icon,18)}</span>`:o.avatar?`<span class="avatar">${esc(initials(o.label))}</span>`:''}
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
  _lpT=setTimeout(()=>{_lpFired=true;_lpAt=Date.now();try{navigator.vibrate&&navigator.vibrate(12)}catch(x){}lpMenu(v)},480);
},true);
document.addEventListener('pointermove',e=>{if(_lpT&&(Math.abs(e.clientX-_lpX)>12||Math.abs(e.clientY-_lpY)>12)){clearTimeout(_lpT);_lpT=null}},true);
['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,()=>{clearTimeout(_lpT);_lpT=null},true));
document.addEventListener('click',e=>{if(_lpFired){_lpFired=false;if(Date.now()-_lpAt<700){e.stopPropagation();e.preventDefault()}}},true);
document.addEventListener('contextmenu',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-lp]'))e.preventDefault()});
window.addEventListener('scroll',()=>{const b=document.getElementById('toTop');if(b)b.classList.toggle('on',window.scrollY>420)},{passive:true});
function lpShow(title,opts){
  closeAllModals();
  pickModal(title||'Opções',opts.map((o,i)=>({v:i,label:o.label,sub:o.sub||'',icon:o.icon})),o=>{closeAllModals();opts[o.v].act()});
}
function lpMenu(v){
  const a=String(v||'').split(':'),k=a[0],id=a[1];
  if(k==='prop'){const p=prop(id);if(!p)return;
    const opts=[{label:'Editar imóvel',icon:'building',act:()=>propModal(id)}];
    if(p.use==='investimento')opts.push({label:'Novo contrato',icon:'contract',act:()=>ctModal(null,id)});
    opts.push({label:'Registar despesa',icon:'dn',act:()=>txModal(null,'expense',id)});
    if(liveLoans(p).length)opts.push({label:'Pagamento de crédito',icon:'bank',act:()=>txModal(null,'loan',id)},{label:'Amortização',icon:'trend',act:()=>amortModal(id)});
    opts.push({label:'Apagar imóvel',icon:'trash',act:()=>delProp(id)});
    return lpShow(p.name,opts);}
  if(k==='tx'){const t=db.transactions.find(x=>x.id===id);if(!t)return;
    return lpShow(t.label,[{label:'Editar movimento',icon:'swap',act:()=>txModal(id)},{label:'Apagar movimento',icon:'trash',act:()=>delTx(id)}]);}
  if(k==='ct'){const c=contract(id);if(!c)return;
    const opts=[{label:'Editar contrato',icon:'contract',act:()=>ctModal(id)}];
    if(isActive(c))opts.push({label:'Registar renda',icon:'up',act:()=>txModal(null,'income',c.propertyId,null,id)});
    opts.push({label:'Gerar contrato em PDF',icon:'pen',act:()=>generateContractPdf(id)});
    opts.push(isActive(c)?{label:'Terminar contrato',icon:'x',act:()=>endContract(id)}:{label:'Reativar contrato',icon:'check',act:()=>reactivateContract(id)});
    opts.push({label:'Apagar contrato',icon:'trash',act:()=>delContract(id)});
    return lpShow(ctName(c),opts);}
  if(k==='per'){const kind=a[1],pid=a[2],list=kind==='owner'?db.owners:db.tenants,pp=list.find(x=>x.id===pid);if(!pp)return;
    return lpShow(pp.name,[{label:'Editar ficha',icon:'users',act:()=>personModal(kind,pid)},{label:'Apagar',icon:'trash',act:()=>delPerson(kind,pid)}]);}
  if(k==='rec'){const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
    const opts=[];
    if(r.next&&r.next<=today())opts.push({label:'Confirmar',icon:'check',act:()=>quickConfirmRec(id)});
    opts.push({label:r.muted?'Reativar avisos':'Silenciar',icon:'clock',act:()=>skipRec(id)},
      {label:'Editar',icon:'swap',act:()=>editRec(id)},{label:'Apagar',icon:'trash',act:()=>delRec(id)});
    return lpShow(r.name,opts);}
  if(k==='tpl'){const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
    return lpShow(x.name,[{label:'Usar modelo',icon:'plus',act:()=>newFromTemplate(id)},{label:'Editar',icon:'file',act:()=>editTpl(id)},{label:'Apagar',icon:'trash',act:()=>delTpl(id)}]);}
  if(k==='mort'){const pid=a[1],lid=a[2],p=prop(pid),l=findLoan(p,lid);if(!l)return;
    const opts=[{label:'Editar hipoteca',icon:'bank',act:()=>mortModal(pid,lid)}];
    if(Number(l.outstanding)>0)opts.push({label:'Pagamento de crédito',icon:'bank',act:()=>txModal(null,'loan',pid,null,null,{loanId:lid})},{label:'Amortização',icon:'trend',act:()=>amortModal(pid,lid)});
    opts.push({label:'Apagar hipoteca',icon:'trash',act:()=>delMortFrom(pid,lid)});
    return lpShow(loanName(l),opts);}
}
