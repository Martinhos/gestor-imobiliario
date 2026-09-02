/* ================= DADOS ================= */
function vImport(){
  return `${card('Importar do Splitwise','Despesas partilhadas de uma casa',`
    <div class="hint">No Splitwise: abre o grupo → <b>Export as spreadsheet</b> → guarda o CSV.</div>
    <div class="toolbar" style="margin:14px 0 0">
      <input type="file" id="swFile" style="display:none" onchange="swPick(this)">
      <button class="btn primary" onclick="swPasteBox()">Colar o texto do CSV</button>
      <button class="btn" onclick="document.getElementById('swFile').click()">Escolher ficheiro</button></div>
    <div class="hint" style="margin-top:11px">Se o botão de escolher ficheiro não abrir nada, estás a ver a app fora do telemóvel — usa a opção de colar o texto.</div>
    ${db.transactions.some(t=>t.batch)?`<div class="divider"></div><button class="btn sm danger" onclick="undoImport()">Anular a última importação</button>`:''}`)}
  <div style="height:14px"></div>
  ${card('Guardar ficheiros','',`
    <div class="toolbar" style="margin:0">
      <button class="btn" onclick="driveSave()">Guardar cópia</button>
      <button class="btn" onclick="driveOpen()">Abrir cópia</button>
      <button class="btn" onclick="downloadCsv()">Exportar CSV</button>
      <button class="btn" onclick="bkPasteBox()">Colar cópia</button></div>`)}
  <div style="height:14px"></div>
  ${card('Recomeçar','Apaga tudo o que está guardado neste dispositivo',`<button class="btn danger" onclick="wipe()">Apagar todos os dados</button>`)}
  <div class="hint" style="text-align:center;margin-top:18px">Fotos e documentos ficam no dispositivo e não entram na cópia em JSON.</div>`;
}

/* ================= DEFINIÇÕES ================= */
const navRow=(title,sub,icon,page)=>`<div class="card tap" onclick="goSet('${page}')" style="display:flex;align-items:center;gap:13px">
  <span class="avatar">${ic(icon,18)}</span>
  <span style="flex:1;min-width:0"><b style="display:block">${esc(title)}</b><span class="small">${esc(sub)}</span></span>
  <span style="color:var(--muted);transform:rotate(180deg)">${ic('chev',18)}</span></div>`;
/* Voltar, colado ao topo: nos documentos longos (termos, política) o botão
   dizia "Definições" e desaparecia com o scroll — a meio de 300 linhas não
   havia porta de saída à vista. O do fundo já dizia Voltar; agora dizem o
   mesmo e um deles está sempre presente. */
const backRow=`<div class="toolbar" style="position:sticky;top:calc(57px + var(--inset-top));z-index:20;background:var(--bg);padding:8px 0;margin:-6px 0 6px">
  <button class="btn" onclick="goSet('')">${ic('chev',15)} Voltar</button></div>`;

function vDefaults(){
  const s=db.settings;
  return `${card('Projeções','Como rendas e despesas evoluem nos gráficos de futuro',`
    <div class="row3">
      <label>Aumento anual das rendas (%)<input type="text" inputmode="decimal" value="${dec(s.growth)}" onchange="setSet('growth',num(this.value))"></label>
      <label>Inflação das despesas (%)<input type="text" inputmode="decimal" value="${dec(s.inflation)}" onchange="setSet('inflation',num(this.value))"></label>
      <label>Horizonte (anos)<input type="text" inputmode="numeric" value="${s.years}" onchange="setSet('years',Math.min(30,Math.max(1,num(this.value))))"></label></div>`)}
  <div style="height:14px"></div>
  ${card('Avaliação','Usado ao avaliar os imóveis pelo rendimento',`
    <label>Yield exigido na avaliação (%)<input type="text" inputmode="decimal" value="${dec(s.capTarget)}" onchange="setSet('capTarget',num(this.value)||5)"></label>`)}
  <div style="height:14px"></div>
  ${card('Crédito à habitação','Usado nas prestações e nos planos das hipotecas',`
    <label>Imposto do selo sobre juros (%)<input type="text" inputmode="decimal" value="${dec(s.stampPct??4)}" onchange="setSet('stampPct',Math.max(0,num(this.value)))"></label>
    <div class="hint">Percentagem cobrada sobre os juros de cada prestação. Em Portugal é 4%. As hipotecas com o imposto do selo desligado não são afetadas.</div>`)}`;
}
function vSettings(){
  const t=db.settings.theme,s=db.settings,cs=cats();
  if(setPage==='defaults')return backRow+vDefaults();
  if(setPage==='cats')return backRow+vCats();
  if(setPage==='tags')return backRow+vTags();
  if(setPage==='groups')return backRow+vGroups();
  if(setPage==='filtros')return backRow+vFiltrosComuns();
  if(setPage==='dados')return backRow+vImport();
  return `${card('Tema','Como a app se apresenta',`<div class="seg c3">
      ${[['auto','auto','Automático','segue o telemóvel'],['light','sun','Claro',''],['dark','moon','Escuro','']]
        .map(([k,i,l,sb])=>`<button type="button" class="opt ${t===k?'on':''}" onclick="setTheme('${k}')"><span class="ic">${ic(i,18)}</span><b>${l}</b>${sb?`<small>${sb}</small>`:''}</button>`).join('')}</div>`)}
  <div style="height:14px"></div>
  ${navRow('Valores por omissão','Projeções, avaliação e imposto do selo','trend','defaults')}
  <div style="height:14px"></div>
  ${navRow('Tipos de movimento',(Object.keys(cs).length+Object.keys(catsIn()).length)+' categorias · '+sum(Object.keys(cs).map(k=>cs[k].length).concat(Object.keys(catsIn()).map(k=>catsIn()[k].length)))+' subtipos','swap','cats')}
  <div style="height:14px"></div>
  ${navRow('Etiquetas',(s.tags||[]).length+' etiquetas','tag','tags')}
  <div style="height:14px"></div>
  ${navRow('Grupos',(db.groups||[]).length+' grupos','users','groups')}
  <div style="height:14px"></div>
  ${navRow('Filtros comuns',(db.settings.filters||[]).length+' filtros','filter','filtros')}
  <div style="height:14px"></div>
  ${navRow('Dados','Splitwise, Google Drive e cópias de segurança','down','dados')}
  <div style="height:14px"></div>
  ${card('Sobre','',`<div class="stat"><span>Versão</span><b>22</b></div>
    <div class="stat"><span>Imóveis · contratos</span><b>${db.properties.length} · ${db.contracts.length}</b></div>
    <div class="stat"><span>Inquilinos · proprietários</span><b>${db.tenants.length} · ${db.owners.length}</b></div>
    <div class="stat" style="border:0"><span>Movimentos</span><b>${db.transactions.length}</b></div>`)}`;
}
/* cada árvore serve um grupo de tipos: receitas (rendas, dívidas recebidas) ou pagamentos (despesas, prestações, dívidas pagas) */
const treeTx=tk=>db.transactions.filter(t=>treeKey(t.kind)===tk);
function catTree(tk,title,sub){
  const cs=db.settings[tk]||{},txs=treeTx(tk);
  return card(title,sub,`
    <div class="list" style="gap:9px">${Object.keys(cs).map(k=>`
      <div class="card" style="padding:12px 13px">
        <div class="row-between" style="align-items:center">
          <input value="${esc(k)}" onchange="renameCat('${tk}','${jsq(k)}',this.value)" style="font-weight:650;border:0;padding:4px 0;background:transparent">
          <div style="display:flex;gap:5px;flex:0 0 auto">
            <span class="badge grey">${txs.filter(t=>t.category===k).length}</span>
            <button class="btn sm ${db.settings.exclude[excKey(tk,k)]?'danger':''}" title="Contar (ou não) nos totais" onclick="toggleExc('${tk}','${jsq(k)}')">€</button>
            <button class="btn sm danger" onclick="delCat('${tk}','${jsq(k)}')">${ic('trash',14)}</button></div></div>
        ${db.settings.exclude[excKey(tk,k)]?'<div class="small" style="margin-top:2px"><b class="neg">Fora dos totais</b> — os movimentos ficam na lista mas não somam.</div>':''}
        <div class="chips">${(cs[k]||[]).map(sb=>{const off=db.settings.exclude[excKey(tk,k,sb)]||db.settings.exclude[excKey(tk,k)];return `<span class="tag grey" style="${off?'opacity:.55':''}">
          <span onclick="renameSub('${tk}','${jsq(k)}','${jsq(sb)}')" style="cursor:pointer;${off?'text-decoration:line-through':''}" title="Mudar o nome">${esc(sb)}</span>
          <button type="button" onclick="toggleExc('${tk}','${jsq(k)}','${jsq(sb)}')" title="Contar (ou não) nos totais" style="font-weight:800;font-size:11px">€</button>
          <button type="button" onclick="delSub('${tk}','${jsq(k)}','${jsq(sb)}')">${ic('x',13)}</button></span>`}).join('')}
          <button type="button" class="tagadd" onclick="addSub('${tk}','${jsq(k)}')">+ subcategoria</button></div>
      </div>`).join('')}</div>
    <div class="toolbar" style="margin:13px 0 0"><button class="btn primary" onclick="addCat('${tk}')">${ic('plus',15)} Nova categoria</button></div>`);
}
function vCats(){
  const n=tk=>Object.keys(db.settings[tk]||{}).length+' categorias';
  return `<div class="form">
    ${fold('catsIn','Receitas',catTree('catsIn','','Rendas, reembolsos e dinheiro recebido de terceiros'),{icon:'up',open:true,summary:n('catsIn')})}
    ${fold('cats','Pagamentos',catTree('cats','','Despesas, prestações e dívidas pagas a terceiros'),{icon:'dn',summary:n('cats')})}</div>`
    +`<div class="toolbar" style="margin:13px 0 0"><button class="btn" onclick="resetCats()">Repor as de origem</button></div>
  <div class="hint" style="margin-top:14px">O número é quantos movimentos usam a categoria. Apagá-la não apaga movimentos — ficam sem categoria. O botão € tira-a dos totais, sem sair da lista.</div>`;
}
function vTags(){
  const tg=db.settings.tags||[];
  const usage=g=>db.transactions.filter(t=>(t.tags||[]).indexOf(g)>-1).length;
  return `${card('Etiquetas','Marcas livres para cruzares com qualquer categoria',
    tg.length?`<div class="list" style="gap:8px">${tg.map(g=>`
      <div class="card" style="padding:11px 13px;display:flex;align-items:center;gap:11px">
        <span class="tag grey" style="padding:5px 11px">${esc(g)}</span>
        <span class="spacer"></span>
        <span class="small">${usage(g)} movimento${usage(g)===1?'':'s'}</span>
        <button class="btn sm danger" onclick="delTag('${jsq(g)}')">${ic('trash',14)}</button></div>`).join('')}</div>`
    :`<div class="hint"></div>`)}
  <div class="toolbar" style="margin:13px 0 0"><button class="btn primary" onclick="addTag()">${ic('plus',15)} Nova etiqueta</button></div>`;
}
/* ===== grupos ===== */
const GKIND={prop:{label:'Imóveis',icon:'building',one:'imóvel'},owner:{label:'Proprietários',icon:'crown',one:'proprietário'},contract:{label:'Contratos',icon:'contract',one:'contrato'}};
function gMemberName(kind,id){
  if(kind==='prop')return propName(id);
  if(kind==='owner')return (owner(id)||{}).name||'';
  const c=contract(id);return c?ctName(c):'';
}
function vGroups(){
  const secs=['prop','owner','contract'].map(kind=>{
    const gs=grpsOf(kind);
    return `<div class="section-title">${GKIND[kind].label}</div>
      ${gs.length?`<div class="list">${gs.map(g=>`<div class="card tap" onclick="groupModal('${kind}','${g.id}')">
        <div class="row-between" style="align-items:center">
          <div style="display:flex;gap:11px;align-items:center;min-width:0"><span class="avatar">${ic(GKIND[kind].icon,17)}</span>
            <div style="min-width:0"><div class="title">${esc(g.name)}</div>
            <div class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.ids.length} ${g.ids.length===1?GKIND[kind].one:GKIND[kind].label.toLowerCase()} · ${esc(g.ids.map(id=>gMemberName(kind,id)).filter(Boolean).join(', '))||'sem membros'}</div></div></div>
          <span style="color:var(--muted);transform:rotate(180deg);flex:0 0 auto">${ic('chev',17)}</span></div></div>`).join('')}</div>`
      :`<div class="hint">Ainda não há grupos de ${GKIND[kind].label.toLowerCase()}.</div>`}
      <div class="toolbar" style="margin:11px 0 0"><button class="btn sm" onclick="groupModal('${kind}')">${ic('plus',14)} Novo grupo de ${GKIND[kind].label.toLowerCase()}</button></div>`;
  }).join('');
  return secs+`<div class="hint" style="margin-top:16px">Servem de filtro em toda a app. Um movimento atribuído a um grupo de imóveis divide-se por eles.</div>`;
}
let gForm=null;
function groupModal(kind,id){
  gForm=normGroup(id?JSON.parse(JSON.stringify(grp(id))):{kind});
  const m=id?menu('grp',[{label:'Apagar grupo',icon:'trash',danger:true,act:`delGroup('${id}')`}]):'';
  openModal(id?'Editar grupo':'Novo grupo de '+GKIND[kind].label.toLowerCase(),groupBody(),null,m);
  onSave=()=>{
    gForm.name=val('g_name').trim();
    if(!gForm.name)return toast('Dá um nome ao grupo.');
    if(gForm.ids.length<1)return toast('Escolhe pelo menos um membro.');
    db.groups=db.groups||[];
    const i=db.groups.findIndex(x=>x.id===gForm.id);
    if(i<0)db.groups.push(gForm);else db.groups[i]=gForm;
    save();closeModal();render();toast('Grupo guardado.');
  };
}
function groupBody(){
  const g=gForm,tags=g.ids.map(id=>({id,label:gMemberName(g.kind,id)||'?'}));
  return `<div class="form">
    <label>Nome do grupo<input id="g_name" value="${esc(g.name)}" placeholder="${g.kind==='prop'?'Casas de Lisboa':g.kind==='owner'?'Família':'Contratos T2'}" autocomplete="off"></label>
    <div><div class="flabel">${GKIND[g.kind].label} no grupo</div>${tagField(tags,'Adicionar','addGroupMember()','delGroupMember')}</div>
    ${g.kind==='prop'?`<div class="hint">Um movimento atribuído a este grupo divide-se pelos imóveis (em partes iguais, pelo valor, por percentagens…).</div>`:''}</div>`;
}
function repaintGroup(){const b=modalBodyEl();if(b)b.innerHTML=groupBody()}
function addGroupMember(){
  gForm.name=val('g_name');
  const g=gForm;
  let cands=[];
  if(g.kind==='prop')cands=db.properties.filter(p=>g.ids.indexOf(p.id)<0).map(p=>({v:p.id,label:p.name,icon:'building'}));
  else if(g.kind==='owner')cands=db.owners.filter(o=>g.ids.indexOf(o.id)<0).map(o=>({v:o.id,label:o.name,avatar:true}));
  else cands=db.contracts.filter(c=>g.ids.indexOf(c.id)<0).map(c=>({v:c.id,label:ctName(c),sub:propName(c.propertyId),icon:'contract'}));
  pickModal('Adicionar ao grupo',cands,o=>{g.ids.push(o.v);closeModal();repaintGroup()});
}
function delGroupMember(id){gForm.name=val('g_name');gForm.ids=gForm.ids.filter(x=>x!==id);repaintGroup()}
function delGroup(id){
  const g=grp(id),used=db.transactions.filter(t=>t.groupId===id).length;
  confirmModal('Apagar grupo',`Apagar o grupo “${esc((g||{}).name||'')}”?${used?` ${used} movimento(s) ficam sem grupo (passam a contar para todos).`:''}`,()=>{
    db.transactions.forEach(t=>{if(t.groupId===id){t.groupId=null;t.psplit=null}});
    if(String(txProp).slice(2)===id)txProp='';
    if(String(ownerFilter).slice(2)===id)ownerFilter='';
    db.groups=(db.groups||[]).filter(x=>x.id!==id);
    save();closeAllModals();render();toast('Grupo apagado.');
  });
}
function promptModal(title,label,value,cb){
  openModal(title,`<div class="form"><label>${esc(label)}<input id="pm_v" value="${esc(value||'')}" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();_pm()}"></label></div>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="_pm()">Guardar</button>`);
  window._pm=()=>{const v=val('pm_v').trim();closeModal();if(v)cb(v)};
  setTimeout(()=>{const e=document.getElementById('pm_v');if(e)e.focus()},50);
}
function addCat(tk){promptModal('Nova categoria','Nome',null,v=>{const cs=db.settings[tk]||(db.settings[tk]={});if(!cs[v])cs[v]=[];save();render();toast('Categoria criada.')})}
function renameCat(tk,oldName,newName){
  newName=String(newName||'').trim();
  if(!newName||newName===oldName)return render();
  const cs=db.settings[tk]||{},out={};
  Object.keys(cs).forEach(k=>{out[k===oldName?newName:k]=cs[k]});
  db.settings[tk]=out;
  treeTx(tk).forEach(t=>{if(t.category===oldName)t.category=newName});
  save();render();toast('Categoria renomeada.');
}
function delCat(tk,k){
  const used=treeTx(tk).filter(t=>t.category===k).length;
  confirmModal('Apagar categoria',`Apagar “${esc(k)}”?${used?` ${used} movimento(s) ficam sem categoria.`:''}`,()=>{
    delete db.settings[tk][k];
    treeTx(tk).forEach(t=>{if(t.category===k){t.category='';t.sub=''}});
    save();render();toast('Categoria apagada.');
  });
}
function addSub(tk,k){promptModal('Nova subcategoria','Nome',null,v=>{
  const cs=db.settings[tk]||(db.settings[tk]={}),l=cs[k]||(cs[k]=[]);
  if(l.indexOf(v)<0)l.push(v);save();render();toast('Subcategoria criada.')})}
function renameSub(tk,k,old){
  promptModal('Mudar o nome da subcategoria','Nome',old,nn=>{
    nn=String(nn||'').trim();if(!nn||nn===old)return;
    const cs2=db.settings[tk]||{},l=cs2[k]||[];
    const i=l.indexOf(old);if(i>-1)l[i]=nn;
    treeTx(tk).forEach(t=>{if(t.category===k&&t.sub===old)t.sub=nn});
    const e=db.settings.exclude||{};if(e[excKey(tk,k,old)]){e[excKey(tk,k,nn)]=true;delete e[excKey(tk,k,old)]}
    save();render();toast('Subcategoria renomeada.');
  });
}
function delSub(tk,k,sb){
  /* apagar categoria e etiqueta confirmam com o impacto; a subcategoria
     executava logo — a mesma ação, na mesma página, ora protegia ora não */
  const usados=treeTx(tk).filter(t=>t.category===k&&t.sub===sb).length;
  confirmModal('Apagar subcategoria',`“${esc(sb)}” sai de ${k}${usados?` e de ${usados} movimento(s) que a usam`:''}.`,()=>{
    const cs=db.settings[tk]||{};cs[k]=(cs[k]||[]).filter(x=>x!==sb);
    treeTx(tk).forEach(t=>{if(t.category===k&&t.sub===sb)t.sub=''});
    save();render();toast('Subcategoria apagada.');
  });
}
function resetCats(){
  confirmModal('Repor categorias','Volta às listas de origem (receitas e pagamentos). As categorias que criaste desaparecem; os movimentos mantêm o texto.',()=>{
    db.settings.cats=JSON.parse(JSON.stringify(CATS0));db.settings.catsIn=JSON.parse(JSON.stringify(CATS_IN0));save();render();toast('Categorias repostas.');
  });
}
function addTag(){promptModal('Nova etiqueta','Nome',null,v=>{
  const l=db.settings.tags||(db.settings.tags=[]);
  if(l.indexOf(v)<0)l.push(v);save();render();toast('Etiqueta criada.')})}
function delTag(g){
  const used=db.transactions.filter(t=>(t.tags||[]).indexOf(g)>-1).length;
  confirmModal('Apagar etiqueta',`Apagar “${esc(g)}”?${used?` Sai de ${used} movimento(s).`:''}`,()=>{
    db.settings.tags=(db.settings.tags||[]).filter(x=>x!==g);
    db.transactions.forEach(t=>{t.tags=(t.tags||[]).filter(x=>x!==g)});
    save();render();toast('Etiqueta apagada.');
  });
}


/* ======================= FILTROS COMUNS =======================
   Um conjunto de escolhas com nome — "T2 Lisboa · rendas", "Só despesas do
   Manel" — definido uma vez e aplicado em qualquer vista que filtre. Cada
   vista aplica só o que lhe diz respeito: a visão geral usa o imóvel e o
   proprietário, os movimentos usam tudo. */

function filtrosComuns(){return db.settings.filters||[]}

function vFiltrosComuns(){
  const list=filtrosComuns();
  return card('Filtros comuns','Aplicam-se no funil de cada vista',`
    ${list.length?`<div class="list" style="gap:8px">${list.map(f=>`
      <div class="card" style="padding:11px 13px"><div class="row-between" style="align-items:center">
        <div style="min-width:0;cursor:pointer" onclick="fcModal('${jsq(f.id)}')">
          <b style="font-size:14px">${esc(f.name)}</b>
          <div class="small">${esc(fcResumo(f)||'sem escolhas — aplica-lo limpa os filtros')}</div></div>
        <button type="button" class="btn sm danger" aria-label="Apagar" style="min-width:40px;min-height:40px" onclick="delFiltroComum('${jsq(f.id)}')">${ic('trash',14)}</button>
      </div></div>`).join('')}</div>`
      :'<div class="hint">Ainda não tens nenhum. Um filtro comum guarda um conjunto de escolhas — imóvel, proprietário, tipo, categoria, datas — para aplicares num toque.</div>'}
    <div class="toolbar" style="margin:13px 0 0"><button class="btn primary" onclick="fcModal()">${ic('plus',15)} Novo filtro comum</button></div>`);
}

function fcResumo(f){
  const p=[];
  if(f.kind)p.push((KIND[f.kind]||{}).short||f.kind);
  if(f.prop){const pr=prop(f.prop);p.push(pr?pr.name:f.prop)}
  if(f.owner){const o=db.owners.find(x=>x.id===f.owner);p.push(o?o.name:f.owner)}
  if(f.cat)p.push(f.cat);
  if(f.sub)p.push(f.sub);
  if(f.de||f.ate)p.push(f.de&&f.ate?f.de+' → '+f.ate:f.de?'desde '+f.de:'até '+f.ate);
  return p.join(' · ');
}

let fcForm=null;
function fcModal(id){
  const f=filtrosComuns().find(x=>x.id===id);
  fcForm=f?JSON.parse(JSON.stringify(f)):{id:uid(),name:'',kind:'',prop:'',owner:'',cat:'',sub:'',de:'',ate:''};
  openModal(f?'Editar filtro comum':'Novo filtro comum',fcCorpo(),
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="fcGuardar()">Guardar</button>`);
}
function fcCorpo(){
  const kinds=[{v:'',label:'Todos os tipos'},{v:'income',label:'Receitas'},{v:'expense',label:'Despesas'},{v:'loan',label:'Pagamentos de crédito'},{v:'debt',label:'Dívidas'}];
  const props=[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:p.name})));
  const owners=[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name})));
  const tree=allCats(fcForm.kind==='debt'?'expense':fcForm.kind);
  const catOpts=[{v:'',label:'Todas as categorias'}].concat(Object.keys(tree).map(c=>({v:c,label:c})));
  const subs=fcForm.cat?(tree[fcForm.cat]||[]):[];
  return `<div class="form">
    <label>Nome <span class="req">*</span><input id="fc_name" value="${esc(fcForm.name)}" placeholder="T2 Lisboa · rendas" autocomplete="off" oninput="fcColher(1)"></label>
    <div class="row"><label>Tipo${sel('fc_kind',fcForm.kind,kinds,'fcColher')}</label>
      <label>Imóvel${sel('fc_prop',fcForm.prop,props,'fcColher')}</label></div>
    <div class="row"><label>Proprietário${sel('fc_owner',fcForm.owner,owners,'fcColher')}</label>
      <label>Categoria${sel('fc_cat',fcForm.cat,catOpts,'fcColher')}</label></div>
    ${subs.length?`<label>Subcategoria${sel('fc_sub',fcForm.sub,[{v:'',label:'Todas'}].concat(subs.map(x=>({v:x,label:x}))),'fcColher')}</label>`:''}
    <div class="row"><label>De<input id="fc_de" type="date" value="${fcForm.de||''}" onchange="fcColher()"></label>
      <label>Até<input id="fc_ate" type="date" value="${fcForm.ate||''}" onchange="fcColher()"></label></div>
    <div class="hint">Deixa em branco o que não quiseres fixar. Cada vista aplica só o que lhe diz respeito.</div>
  </div>`;
}
/* soFormulario: escrever no nome não repinta (perdia o foco a cada tecla);
   mudar tipo ou categoria repinta, porque as opções seguintes dependem */
function fcColher(soFormulario){
  fcForm.name=val('fc_name');
  const kindNovo=val('fc_kind')||'',catNova=val('fc_cat')||'';
  const repinta=!soFormulario&&(kindNovo!==fcForm.kind||catNova!==fcForm.cat);
  if(catNova!==fcForm.cat)fcForm.sub='';
  fcForm.kind=kindNovo;fcForm.cat=catNova;
  fcForm.prop=val('fc_prop')||'';fcForm.owner=val('fc_owner')||'';
  fcForm.sub=val('fc_sub')||fcForm.sub||'';fcForm.de=val('fc_de')||'';fcForm.ate=val('fc_ate')||'';
  if(repinta){const t=modalTop();if(t){const b=modalBodyEl();if(b)b.innerHTML=fcCorpo()}}
}
function fcGuardar(){
  fcColher();
  if(!String(fcForm.name||'').trim())return falhaCampo('fc_name','Dá um nome ao filtro.');
  db.settings.filters=filtrosComuns().filter(x=>x.id!==fcForm.id).concat([fcForm]);
  save();closeModal();render();toast('Filtro comum guardado.');
}
function delFiltroComum(id){
  const f=filtrosComuns().find(x=>x.id===id);if(!f)return;
  const copia=JSON.parse(JSON.stringify(f));
  db.settings.filters=filtrosComuns().filter(x=>x.id!==id);
  save();render();
  comDesfazer('Filtro comum apagado.',()=>{db.settings.filters=(db.settings.filters||[]).concat([copia])});
}

/* O aplicador: cada vista pega no que lhe diz respeito. */
function aplicarFiltroComum(id){
  const f=filtrosComuns().find(x=>x.id===id);if(!f)return;
  if(tab==='transactions'){
    txFilter=f.kind||'';txProp=f.prop||'';ownerFilter=f.owner||'';
    txCat=f.cat||'';txSub=f.sub||'';txDe=f.de||'';txAte=f.ate||'';
    txRerender();toast('Filtro «'+f.name+'» aplicado.');return;
  }
  // vistas de análise e listas: aplica-se o imóvel e o proprietário
  if(tab==='dashboard')dashProp=f.prop||'';
  if(tab==='projections')projProp=f.prop||'';
  if(tab==='reports')repProp=f.prop||'';
  ownerFilter=f.owner||'';
  if(typeof LFK!=='undefined'&&LFK[tab]&&f.owner!==undefined){lf(LFK[tab]).own=f.owner||''}
  render();toast('Filtro «'+f.name+'» aplicado — '+(f.cat||f.kind||f.de?'esta vista usa só o imóvel e o proprietário.':'feito.'));
}
function fcSelector(fn){
  const list=filtrosComuns();
  if(!list.length)return '';
  return `<label>Filtro comum${sel('fcAplicar','',[{v:'',label:'— aplicar um filtro comum —'}].concat(list.map(f=>({v:f.id,label:f.name}))),fn||'onFcAplicar')}</label>`;
}
function onFcAplicar(){const v=val('fcAplicar');if(v)aplicarFiltroComum(v)}
