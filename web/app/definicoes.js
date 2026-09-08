/* ================= DADOS ================= */
// Devolve: o HTML (texto) da subpágina "Dados": importação do Splitwise,
// cópias de segurança e o botão de recomeçar.
function vImport(){
  return `${card('Importar do Splitwise','Despesas partilhadas de uma casa',`
    <div class="hint">No Splitwise: abre o grupo → <b>Export as spreadsheet</b> → guarda o CSV.</div>
    <div class="toolbar" style="margin:14px 0 0">
      <input type="file" id="swFile" style="display:none" onchange="swPick(this)">
      <button class="btn primary" data-toca="camada" onclick="swPasteBox()">Colar o texto do CSV</button>
      <button class="btn" data-toca="camada" onclick="document.getElementById('swFile').click()">Escolher ficheiro</button></div>
    <div class="hint" style="margin-top:11px">Se o botão de escolher ficheiro não abrir nada, estás a ver a app fora do telemóvel — usa a opção de colar o texto.</div>
    ${db.transactions.some(t=>t.batch)?`<div class="divider"></div><button class="btn sm danger" data-toca="dados" data-risco="destroi" onclick="undoImport()">Anular a última importação</button>`:''}`)}
  <div style="height:14px"></div>
  ${card('Guardar ficheiros','',`
    <div class="toolbar" style="margin:0">
      <button class="btn" data-toca="nada" onclick="exportarSoMeu(driveSave)">Guardar cópia</button>
      <button class="btn" data-toca="camada" onclick="driveOpen()">Abrir cópia</button>
      <button class="btn" data-toca="nada" onclick="exportarSoMeu(downloadCsv)">Exportar CSV</button>
      <button class="btn" data-toca="camada" onclick="bkPasteBox()">Colar cópia</button></div>
    ${casasDeColaboracao().length?'<div class="hint" style="margin-top:11px">As cópias levam só o que é teu — os imóveis onde colaboras ficam de fora.</div>':''}`)}
  <div style="height:14px"></div>
  ${card('Recomeçar','Apaga tudo o que está guardado neste dispositivo',`<button class="btn danger" data-toca="dados" data-risco="destroi" onclick="wipe()">Apagar todos os dados</button>`)}
  <div class="hint" style="text-align:center;margin-top:18px">Fotos e documentos ficam no dispositivo e não entram na cópia em JSON.</div>`;
}

/* Corre uma exportação (cópia de segurança, CSV) sobre a base só com o que é
   meu: os imóveis onde colaboro e os registos deles ficam de fora. As funções
   de copias.js leem a db global no momento da chamada, por isso troca-se a
   base durante a chamada e repõe-se logo a seguir — sem imóveis de
   colaboração, corre tal e qual.
   Recebe: fn — a função de exportar (sem argumentos), ex.: driveSave ou downloadCsv.
   Devolve: nada — o que fn devolver é ignorado. */
function exportarSoMeu(fn){
  if(!casasDeColaboracao().length)return void fn();
  const real=db;db=dbSoMeu();
  try{fn()}finally{db=real}
}

/* ================= DEFINIÇÕES ================= */
// Recebe: title — o título da linha; sub — a linha pequena por baixo; icon — o
// nome do ícone (para ic); page — a chave da subpágina a abrir com goSet
// ('defaults', 'cats', 'tags', 'groups', 'filtros' ou 'dados').
// Devolve: o HTML (texto) de uma linha de navegação das Definições.
const navRow=(title,sub,icon,page)=>`<div class="card tap" data-toca="ecra" onclick="goSet('${page}')" style="display:flex;align-items:center;gap:13px">
  <span class="avatar">${ic(icon,18)}</span>
  <span style="flex:1;min-width:0"><b style="display:block">${esc(title)}</b><span class="small">${esc(sub)}</span></span>
  <span style="color:var(--muted);transform:rotate(180deg)">${ic('chev',18)}</span></div>`;
/* Voltar, colado ao topo: nos documentos longos (termos, política) o botão
   dizia "Definições" e desaparecia com o scroll — a meio de 300 linhas não
   havia porta de saída à vista. O do fundo já dizia Voltar; agora dizem o
   mesmo e um deles está sempre presente. */
const backRow=`<div class="toolbar" style="position:sticky;top:calc(57px + var(--inset-top));z-index:20;background:var(--bg);padding:8px 0;margin:-6px 0 6px">
  <button class="btn" data-toca="ecra" onclick="goSet('')">${ic('chev',15)} Voltar</button></div>`;

// Subpágina "Valores por omissão": crescimento das rendas, inflação, horizonte,
// yield de avaliação e imposto do selo. Cada campo grava logo ao sair (setSet).
// Devolve: o HTML (texto) da subpágina.
function vDefaults(){
  const s=db.settings;
  return `${card('Projeções','Como rendas e despesas evoluem nos gráficos de futuro',`
    <div class="row3">
      <label>Aumento anual das rendas (%)<input type="text" inputmode="decimal" value="${dec(s.growth)}" onchange="setSet('growth',num(this.value))"></label>
      <label>Inflação das despesas (%)<input type="text" inputmode="decimal" value="${dec(s.inflation)}" onchange="setSet('inflation',num(this.value))"></label>
      <label>Horizonte (anos)<input type="text" inputmode="numeric" value="${s.years}" onchange="setSet('years',Math.min(30,Math.max(1,num(this.value))))"></label></div>`)}
  <div style="height:14px"></div>
  ${card('Avaliação','Usado ao avaliar os imóveis pelo rendimento',`
    <label>Yield exigido na avaliação (%)<input type="text" inputmode="decimal" value="${dec(s.capTarget)}" onchange="capTargetSet(this.value)"></label>
    <div class="hint">O resultado anual de cada imóvel dividido por este yield dá o valor por rendimento. Tem de ser maior que zero; em branco volta aos 5 %.</div>`)}
  <div style="height:14px"></div>
  ${card('Crédito à habitação','Usado nas prestações e nos planos das hipotecas',`
    <label>Imposto do selo sobre juros (%)<input type="text" inputmode="decimal" value="${dec(s.stampPct??4)}" onchange="setSet('stampPct',Math.max(0,num(this.value)))"></label>
    <div class="hint">Percentagem cobrada sobre os juros de cada prestação. Em Portugal é 4%. As hipotecas com o imposto do selo desligado não são afetadas.</div>`)}`;
}
/* Vista principal das Definições: com setPage preenchido devolve a subpágina
   respetiva (com o Voltar colado ao topo); sem ele, o menu — tema, linhas de
   navegação com contagens e o cartão "Sobre".
   Devolve: o HTML (texto) do menu ou da subpágina ativa. */
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
        .map(([k,i,l,sb])=>`<button type="button" class="opt ${t===k?'on':''}" data-toca="dados" onclick="setTheme('${k}')"><span class="ic">${ic(i,18)}</span><b>${l}</b>${sb?`<small>${sb}</small>`:''}</button>`).join('')}</div>`)}
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
/* Cartão editável de uma árvore de categorias (tk: 'cats' ou 'catsIn'):
   renomear escrevendo no próprio nome, apagar, tirar dos totais (botão €)
   e gerir subcategorias em chips. O crachá diz quantos movimentos a usam.
   Recebe: tk — a árvore: 'cats' (pagamentos) ou 'catsIn' (receitas); title — o
   título do cartão (pode ir vazio, dentro das dobras); sub — o subtítulo.
   Devolve: o HTML (texto) do cartão. */
function catTree(tk,title,sub){
  const cs=db.settings[tk]||{},txs=treeTx(tk);
  return card(title,sub,`
    <div class="list" style="gap:9px">${Object.keys(cs).map(k=>`
      <div class="card" style="padding:12px 13px">
        <div class="row-between" style="align-items:center">
          <input value="${esc(k)}" onchange="renameCat('${tk}','${jsq(k)}',this.value)" style="font-weight:650;border:0;padding:4px 0;background:transparent">
          <div style="display:flex;gap:5px;flex:0 0 auto">
            <span class="badge grey">${txs.filter(t=>t.category===k).length}</span>
            <button class="btn sm ${db.settings.exclude[excKey(tk,k)]?'danger':''}" title="Contar (ou não) nos totais" data-toca="dados" onclick="toggleExc('${tk}','${jsq(k)}')">€</button>
            <button class="btn sm danger" data-toca="dados" data-risco="destroi" onclick="delCat('${tk}','${jsq(k)}')">${ic('trash',14)}</button></div></div>
        ${db.settings.exclude[excKey(tk,k)]?'<div class="small" style="margin-top:2px"><b class="neg">Fora dos totais</b> — os movimentos ficam na lista mas não somam.</div>':''}
        <div class="chips">${(cs[k]||[]).map(sb=>{const off=db.settings.exclude[excKey(tk,k,sb)]||db.settings.exclude[excKey(tk,k)];return `<span class="tag grey" style="${off?'opacity:.55':''}">
          <span data-toca="camada" onclick="renameSub('${tk}','${jsq(k)}','${jsq(sb)}')" style="cursor:pointer;${off?'text-decoration:line-through':''}" title="Mudar o nome">${esc(sb)}</span>
          <button type="button" data-toca="dados" onclick="toggleExc('${tk}','${jsq(k)}','${jsq(sb)}')" title="Contar (ou não) nos totais" style="font-weight:800;font-size:11px">€</button>
          <button type="button" data-toca="dados" data-risco="destroi" onclick="delSub('${tk}','${jsq(k)}','${jsq(sb)}')">${ic('x',13)}</button></span>`}).join('')}
          <button type="button" class="tagadd" data-toca="camada" onclick="addSub('${tk}','${jsq(k)}')">+ subcategoria</button></div>
      </div>`).join('')}</div>
    <div class="toolbar" style="margin:13px 0 0"><button class="btn primary" data-toca="camada" onclick="addCat('${tk}')">${ic('plus',15)} Nova categoria</button></div>`);
}
// Subpágina "Tipos de movimento": as duas árvores (receitas e pagamentos) em
// dobras, mais o botão de repor as listas de origem.
// Devolve: o HTML (texto) da subpágina.
function vCats(){
  const n=tk=>Object.keys(db.settings[tk]||{}).length+' categorias';
  return `<div class="form">
    ${fold('catsIn','Receitas',catTree('catsIn','','Rendas, reembolsos e dinheiro recebido de terceiros'),{icon:'up',open:true,summary:n('catsIn')})}
    ${fold('cats','Pagamentos',catTree('cats','','Despesas, prestações e dívidas pagas a terceiros'),{icon:'dn',summary:n('cats')})}</div>`
    +`<div class="toolbar" style="margin:13px 0 0"><button class="btn" data-toca="dados" data-risco="destroi" onclick="resetCats()">Repor as de origem</button></div>
  <div class="hint" style="margin-top:14px">O número é quantos movimentos usam a categoria. Apagá-la não apaga movimentos — ficam sem categoria. O botão € tira-a dos totais, sem sair da lista.</div>`;
}
// Subpágina "Etiquetas": cada uma com o número de movimentos que a usam,
// botão de apagar e botão de criar nova.
// Devolve: o HTML (texto) da subpágina.
function vTags(){
  const tg=db.settings.tags||[];
  const usage=g=>db.transactions.filter(t=>(t.tags||[]).indexOf(g)>-1).length;
  return `${card('Etiquetas','Marcas livres para cruzares com qualquer categoria',
    tg.length?`<div class="list" style="gap:8px">${tg.map(g=>`
      <div class="card" style="padding:11px 13px;display:flex;align-items:center;gap:11px">
        <span class="tag grey" style="padding:5px 11px">${esc(g)}</span>
        <span class="spacer"></span>
        <span class="small">${usage(g)} movimento${usage(g)===1?'':'s'}</span>
        <button class="btn sm danger" data-toca="dados" data-risco="destroi" onclick="delTag('${jsq(g)}')">${ic('trash',14)}</button></div>`).join('')}</div>`
    :`<div class="hint"></div>`)}
  <div class="toolbar" style="margin:13px 0 0"><button class="btn primary" data-toca="camada" onclick="addTag()">${ic('plus',15)} Nova etiqueta</button></div>`;
}
/* ===== grupos ===== */
const GKIND={prop:{label:'Imóveis',icon:'building',one:'imóvel'},owner:{label:'Proprietários',icon:'crown',one:'proprietário'},contract:{label:'Contratos',icon:'contract',one:'contrato'}};
// Nome legível de um membro de grupo a partir do tipo e do id; '' se já não existir.
// Recebe: kind — o tipo do grupo: 'prop', 'owner' ou 'contract'; id — o id do membro.
// Devolve: o nome (texto); '' se o membro já não existir.
function gMemberName(kind,id){
  if(kind==='prop')return propName(id);
  if(kind==='owner')return (owner(id)||{}).name||'';
  const c=contract(id);return c?ctName(c):'';
}
// Subpágina "Grupos": uma secção por tipo (imóveis, proprietários, contratos),
// cada grupo com os membros em resumo; tocar num abre o modal de edição.
// Devolve: o HTML (texto) da subpágina.
function vGroups(){
  const secs=['prop','owner','contract'].map(kind=>{
    const gs=grpsOf(kind);
    return `<div class="section-title">${GKIND[kind].label}</div>
      ${gs.length?`<div class="list">${gs.map(g=>`<div class="card tap" data-toca="camada" onclick="groupModal('${kind}','${g.id}')">
        <div class="row-between" style="align-items:center">
          <div style="display:flex;gap:11px;align-items:center;min-width:0"><span class="avatar">${ic(GKIND[kind].icon,17)}</span>
            <div style="min-width:0"><div class="title">${esc(g.name)}</div>
            <div class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.ids.length} ${g.ids.length===1?GKIND[kind].one:GKIND[kind].label.toLowerCase()} · ${esc(g.ids.map(id=>gMemberName(kind,id)).filter(Boolean).join(', '))||'sem membros'}</div></div></div>
          <span style="color:var(--muted);transform:rotate(180deg);flex:0 0 auto">${ic('chev',17)}</span></div></div>`).join('')}</div>`
      :`<div class="hint">Ainda não há grupos de ${GKIND[kind].label.toLowerCase()}.</div>`}
      <div class="toolbar" style="margin:11px 0 0"><button class="btn sm" data-toca="camada" onclick="groupModal('${kind}')">${ic('plus',14)} Novo grupo de ${GKIND[kind].label.toLowerCase()}</button></div>`;
  }).join('');
  return secs+`<div class="hint" style="margin-top:16px">Servem de filtro em toda a app. Um movimento atribuído a um grupo de imóveis divide-se por eles.</div>`;
}
let gForm=null;
/* Abre o modal de criar (só kind) ou editar (com id) um grupo. Trabalha numa
   cópia (gForm) — nada é gravado até Guardar, que exige nome e pelo menos um
   membro antes de escrever em db.groups.
   Recebe: kind — o tipo do grupo: 'prop', 'owner' ou 'contract'; id (opcional)
   — o id do grupo a editar; sem ele cria um novo.
   Devolve: nada — abre o modal. */
function groupModal(kind,id){
  gForm=normGroup(id?JSON.parse(JSON.stringify(grp(id))):{kind});
  const m=id?menu('grp',[{label:'Apagar grupo',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delGroup('${id}')`}]):'';
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
// Corpo do modal do grupo, gerado a partir de gForm: nome e membros em chips.
// Devolve: o HTML (texto) do corpo do modal.
function groupBody(){
  const g=gForm,tags=g.ids.map(id=>({id,label:gMemberName(g.kind,id)||'?'}));
  return `<div class="form">
    <label>Nome do grupo<input id="g_name" value="${esc(g.name)}" placeholder="${g.kind==='prop'?'Casas de Lisboa':g.kind==='owner'?'Família':'Contratos T2'}" autocomplete="off"></label>
    <div><div class="flabel">${GKIND[g.kind].label} no grupo</div>${tagField(tags,'Adicionar','addGroupMember()','delGroupMember')}</div>
    ${g.kind==='prop'?`<div class="hint">Um movimento atribuído a este grupo divide-se pelos imóveis (em partes iguais, pelo valor, por percentagens…).</div>`:''}</div>`;
}
// Redesenha o corpo do modal do grupo depois de mexer nos membros, sem o fechar.
// Devolve: nada — redesenha o corpo do modal.
function repaintGroup(){const b=modalBodyEl();if(b)b.innerHTML=groupBody()}
/* Seletor com os candidatos que ainda não estão no grupo (imóveis,
   proprietários ou contratos, conforme o tipo). Recolhe primeiro o nome já
   escrito para gForm, para o repinte não o perder.
   Devolve: nada — ao escolher, junta o membro a gForm e repinta o modal. */
function addGroupMember(){
  gForm.name=val('g_name');
  const g=gForm;
  let cands=[];
  if(g.kind==='prop')cands=db.properties.filter(p=>g.ids.indexOf(p.id)<0).map(p=>({v:p.id,label:p.name,icon:'building'}));
  else if(g.kind==='owner')cands=db.owners.filter(o=>g.ids.indexOf(o.id)<0).map(o=>({v:o.id,label:o.name,avatar:true}));
  else cands=db.contracts.filter(c=>g.ids.indexOf(c.id)<0).map(c=>({v:c.id,label:ctName(c),sub:propName(c.propertyId),icon:'contract'}));
  pickModal('Adicionar ao grupo',cands,o=>{g.ids.push(o.v);closeModal();repaintGroup()});
}
// Tira um membro do grupo em edição (só em gForm) e repinta; recolhe antes o nome escrito.
// Recebe: id — o id do membro a tirar.
// Devolve: nada — atualiza gForm e repinta o corpo do modal.
function delGroupMember(id){gForm.name=val('g_name');gForm.ids=gForm.ids.filter(x=>x!==id);repaintGroup()}
/* Apaga o grupo depois de confirmar com o impacto: os movimentos atribuídos
   ficam sem grupo (voltam a contar para todos) e os filtros ativos que
   apontavam para ele são limpos. Grava e repinta.
   Recebe: id — o id do grupo a apagar.
   Devolve: nada — abre a confirmação; só ao confirmar apaga e grava. */
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
/* Modal genérico de um só campo de texto. Enter equivale a Guardar; o cb só é
   chamado se sobrar texto depois do trim. Foca o campo ao abrir.
   Recebe: title — o título do modal; label — o rótulo do campo; value — o
   texto inicial (pode vir null); cb — a função chamada com o texto (já com
   trim) quando se guarda com algo escrito.
   Devolve: nada — abre o modal. */
function promptModal(title,label,value,cb){
  openModal(title,`<div class="form"><label>${esc(label)}<input id="pm_v" value="${esc(value||'')}" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();_pm()}"></label></div>`,
    `<button class="btn" data-toca="camada" onclick="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" onclick="_pm()">Guardar</button>`);
  window._pm=()=>{const v=val('pm_v').trim();closeModal();if(v)cb(v)};
  setTimeout(()=>{const e=document.getElementById('pm_v');if(e)e.focus()},50);
}
// Pede o nome e cria uma categoria vazia na árvore tk; grava e repinta.
// Recebe: tk — a árvore: 'cats' (pagamentos) ou 'catsIn' (receitas).
// Devolve: nada — abre o prompt; só ao guardar cria e grava.
function addCat(tk){promptModal('Nova categoria','Nome',null,v=>{const cs=db.settings[tk]||(db.settings[tk]={});if(!cs[v])cs[v]=[];save();render();toast('Categoria criada.')})}
/* Renomeia uma categoria mantendo a ordem (reconstrói o objeto) e atualiza os
   movimentos dessa árvore que a usavam. Nome vazio ou igual só repinta.
   Recebe: tk — a árvore: 'cats' ou 'catsIn'; oldName — o nome atual;
   newName — o nome novo, tal como vem do campo (é-lhe feito trim).
   Devolve: nada — grava e repinta. */
function renameCat(tk,oldName,newName){
  newName=String(newName||'').trim();
  if(!newName||newName===oldName)return render();
  const cs=db.settings[tk]||{},out={};
  Object.keys(cs).forEach(k=>{out[k===oldName?newName:k]=cs[k]});
  db.settings[tk]=out;
  treeTx(tk).forEach(t=>{if(t.category===oldName)t.category=newName});
  save();render();toast('Categoria renomeada.');
}
// Apaga a categoria depois de confirmar com o impacto: os movimentos que a
// usavam ficam sem categoria nem subcategoria (não se apagam).
// Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria.
// Devolve: nada — abre a confirmação; só ao confirmar apaga e grava.
function delCat(tk,k){
  const used=treeTx(tk).filter(t=>t.category===k).length;
  confirmModal('Apagar categoria',`Apagar “${esc(k)}”?${used?` ${used} movimento(s) ficam sem categoria.`:''}`,()=>{
    delete db.settings[tk][k];
    treeTx(tk).forEach(t=>{if(t.category===k){t.category='';t.sub=''}});
    save();render();toast('Categoria apagada.');
  });
}
// Pede o nome e junta uma subcategoria à categoria k (ignora repetidas); grava e repinta.
// Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria.
// Devolve: nada — abre o prompt; só ao guardar cria e grava.
function addSub(tk,k){promptModal('Nova subcategoria','Nome',null,v=>{
  const cs=db.settings[tk]||(db.settings[tk]={}),l=cs[k]||(cs[k]=[]);
  if(l.indexOf(v)<0)l.push(v);save();render();toast('Subcategoria criada.')})}
/* Muda o nome de uma subcategoria via prompt: atualiza a lista, os movimentos
   que a usavam e migra a marca de exclusão dos totais para o nome novo.
   Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria;
   old — o nome atual da subcategoria.
   Devolve: nada — abre o prompt; só ao guardar renomeia e grava. */
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
// Apaga a subcategoria depois de confirmar com o impacto: sai da lista e dos
// movimentos que a usavam (ficam só sem subcategoria).
// Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria;
// sb — o nome da subcategoria.
// Devolve: nada — abre a confirmação; só ao confirmar apaga e grava.
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
// Repõe as duas árvores nas listas de origem, após confirmação; os movimentos
// mantêm o texto de categoria que já tinham.
// Devolve: nada — abre a confirmação; só ao confirmar repõe e grava.
function resetCats(){
  confirmModal('Repor categorias','Volta às listas de origem (receitas e pagamentos). As categorias que criaste desaparecem; os movimentos mantêm o texto.',()=>{
    db.settings.cats=JSON.parse(JSON.stringify(CATS0));db.settings.catsIn=JSON.parse(JSON.stringify(CATS_IN0));save();render();toast('Categorias repostas.');
  });
}
// Pede o nome e cria uma etiqueta (ignora repetidas); grava e repinta.
// Devolve: nada — abre o prompt; só ao guardar cria e grava.
function addTag(){promptModal('Nova etiqueta','Nome',null,v=>{
  const l=db.settings.tags||(db.settings.tags=[]);
  if(l.indexOf(v)<0)l.push(v);save();render();toast('Etiqueta criada.')})}
// Apaga a etiqueta depois de confirmar com o impacto: sai das definições e de
// todos os movimentos que a tinham.
// Recebe: g — o nome da etiqueta.
// Devolve: nada — abre a confirmação; só ao confirmar apaga e grava.
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

// A lista de filtros comuns guardada nas definições ([] enquanto não houver).
// Devolve: o array de filtros de db.settings.filters ([] novo se ainda não houver).
function filtrosComuns(){return db.settings.filters||[]}

// Subpágina "Filtros comuns": cada filtro com o resumo das escolhas (tocar
// abre o modal de edição), botão de apagar e botão de criar novo.
// Devolve: o HTML (texto) da subpágina.
function vFiltrosComuns(){
  const list=filtrosComuns();
  return card('Filtros comuns','Aplicam-se no funil de cada vista',`
    ${list.length?`<div class="list" style="gap:8px">${list.map(f=>`
      <div class="card" style="padding:11px 13px"><div class="row-between" style="align-items:center">
        <div style="min-width:0;cursor:pointer" data-toca="camada" onclick="fcModal('${jsq(f.id)}')">
          <b style="font-size:14px">${esc(f.name)}</b>
          <div class="small">${esc(fcResumo(f)||'sem escolhas — aplica-lo limpa os filtros')}</div></div>
        <button type="button" class="btn sm danger" aria-label="Apagar" style="min-width:40px;min-height:40px" data-toca="dados" data-risco="destroi" onclick="delFiltroComum('${jsq(f.id)}')">${ic('trash',14)}</button>
      </div></div>`).join('')}</div>`
      :'<div class="hint">Ainda não tens nenhum. Um filtro comum guarda um conjunto de escolhas — imóvel, proprietário, tipo, categoria, datas — para aplicares num toque.</div>'}
    <div class="toolbar" style="margin:13px 0 0"><button class="btn primary" data-toca="camada" onclick="fcModal()">${ic('plus',15)} Novo filtro comum</button></div>`);
}

// Resumo das escolhas de um filtro numa linha, separadas por «·»;
// devolve '' quando o filtro não fixa nada.
// Recebe: f — o filtro comum (objeto {kind,prop,owner,cat,sub,de,ate,…}).
// Devolve: o resumo em texto; '' se o filtro não fixar nada.
function fcResumo(f){
  const p=[];
  if(f.kind)p.push(nomeDoTipo(f.kind));
  if(f.prop){const pr=prop(f.prop);p.push(pr?pr.name:f.prop)}
  if(f.owner){const o=db.owners.find(x=>x.id===f.owner);p.push(o?o.name:f.owner)}
  if(f.cat)p.push(f.cat);
  if(f.sub)p.push(f.sub);
  if(f.de||f.ate)p.push(f.de&&f.ate?f.de+' → '+f.ate:f.de?'desde '+f.de:'até '+f.ate);
  return p.join(' · ');
}

let fcForm=null;
// Abre o modal de criar (sem id) ou editar um filtro comum; trabalha numa
// cópia (fcForm) — nada é gravado até fcGuardar.
// Recebe: id (opcional) — o id do filtro a editar; sem ele cria um novo.
// Devolve: nada — abre o modal.
function fcModal(id){
  const f=filtrosComuns().find(x=>x.id===id);
  fcForm=f?JSON.parse(JSON.stringify(f)):{id:uid(),name:'',kind:'',prop:'',owner:'',cat:'',sub:'',de:'',ate:''};
  openModal(f?'Editar filtro comum':'Novo filtro comum',fcCorpo(),
    `<button class="btn" data-toca="camada" onclick="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" onclick="fcGuardar()">Guardar</button>`);
}
/* Corpo do modal do filtro: nome, tipo, imóvel, proprietário, categoria,
   subcategoria e datas. As categorias dependem do tipo escolhido (as dívidas
   usam a árvore das despesas), daí mudar o tipo repintar o formulário.
   Devolve: o HTML (texto) do corpo do modal, gerado a partir de fcForm. */
function fcCorpo(){
  const kinds=[{v:'',label:'Todos os tipos'},{v:'income',label:'Receitas'},{v:'expense',label:'Despesas'},{v:'loan',label:'Pagamentos de crédito'},{v:'debt',label:'Dívidas'}];
  const props=[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:p.name})));
  const owners=[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name})));
  const tree=allCats(fcForm.kind==='debt'?'expense':fcForm.kind);
  const catOpts=[{v:'',label:'Todas as categorias'}].concat(Object.keys(tree).map(c=>({v:c,label:c})));
  const subs=fcForm.cat?(tree[fcForm.cat]||[]):[];
  return `<div class="form">
    <label>Nome <span class="req">*</span><input id="fc_name" value="${esc(fcForm.name)}" placeholder="T2 Lisboa · rendas" autocomplete="off" oninput="fcColher(1)"></label>
    <div class="row"><label>Tipo${sel('fc_kind',fcForm.kind,kinds,'fcColher','rascunho')}</label>
      <label>Imóvel${sel('fc_prop',fcForm.prop,props,'fcColher','rascunho')}</label></div>
    <div class="row"><label>Proprietário${sel('fc_owner',fcForm.owner,owners,'fcColher','rascunho')}</label>
      <label>Categoria${sel('fc_cat',fcForm.cat,catOpts,'fcColher','rascunho')}</label></div>
    ${subs.length?`<label>Subcategoria${sel('fc_sub',fcForm.sub,[{v:'',label:'Todas'}].concat(subs.map(x=>({v:x,label:x}))),'fcColher','rascunho')}</label>`:''}
    <div class="row lado-a-lado"><label>De<input id="fc_de" type="date" value="${fcForm.de||''}" onchange="fcColher()"></label>
      <label>Até<input id="fc_ate" type="date" value="${fcForm.ate||''}" onchange="fcColher()"></label></div>
    <div class="hint">Deixa em branco o que não quiseres fixar. Cada vista aplica só o que lhe diz respeito.</div>
  </div>`;
}
/* soFormulario: escrever no nome não repinta (perdia o foco a cada tecla);
   mudar tipo ou categoria repinta, porque as opções seguintes dependem
   Recebe: soFormulario (opcional) — verdadeiro quando a chamada vem de
   escrever no nome: colhe sem repintar.
   Devolve: nada — copia os campos do modal para fcForm (e repinta o corpo
   se o tipo ou a categoria mudarem). */
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
// Guarda o filtro do modal: colhe o formulário, exige nome, substitui (ou
// acrescenta) em db.settings.filters e fecha com um toast.
// Devolve: nada — grava nas definições e fecha o modal (ou avisa se faltar o nome).
function fcGuardar(){
  fcColher();
  if(!String(fcForm.name||'').trim())return falhaCampo('fc_name','Dá um nome ao filtro.');
  db.settings.filters=filtrosComuns().filter(x=>x.id!==fcForm.id).concat([fcForm]);
  save();closeModal();render();toast('Filtro comum guardado.');
}
// Apaga um filtro comum sem pedir confirmação — o toast traz Desfazer,
// que repõe a cópia guardada.
// Recebe: id — o id do filtro a apagar.
// Devolve: nada — apaga, grava e mostra o toast com Desfazer.
function delFiltroComum(id){
  const f=filtrosComuns().find(x=>x.id===id);if(!f)return;
  const copia=JSON.parse(JSON.stringify(f));
  db.settings.filters=filtrosComuns().filter(x=>x.id!==id);
  save();render();
  comDesfazer('Filtro comum apagado.',()=>{db.settings.filters=(db.settings.filters||[]).concat([copia])});
}

/* O aplicador: cada vista pega no que lhe diz respeito.
   Recebe: id — o id do filtro comum a aplicar.
   Devolve: nada — muda os filtros da vista ativa e repinta. */
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
// Selector "aplicar um filtro comum" para meter num funil de filtros; devolve
// '' enquanto não houver filtros. fn é o onchange (por omissão onFcAplicar).
// Recebe: fn (opcional) — o nome (texto) da função global a chamar no onchange;
// por omissão 'onFcAplicar'.
// Devolve: o HTML (texto) do seletor; '' enquanto não houver filtros.
function fcSelector(fn){
  const list=filtrosComuns();
  if(!list.length)return '';
  return `<label>Filtro comum${sel('fcAplicar','',[{v:'',label:'— aplicar um filtro comum —'}].concat(list.map(f=>({v:f.id,label:f.name}))),fn||'onFcAplicar','vista')}</label>`;
}
// onchange do selector: aplica o filtro escolhido (a opção vazia não faz nada).
// Devolve: nada — aplica o filtro escolhido na vista ativa.
function onFcAplicar(){const v=val('fcAplicar');if(v)aplicarFiltroComum(v)}
