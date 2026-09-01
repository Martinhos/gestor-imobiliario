/* ================= CONTRATO ================= */
let cForm={};
function ctModal(id,pid){
  foldState={};
  if(!db.properties.length)return toast('Cria primeiro um imóvel.');
  const rentables=db.properties.filter(p=>p.use==='investimento');
  if(!id&&!rentables.length)return toast('Nenhum imóvel de arrendamento. Muda o uso na ficha do imóvel para criar contratos.');
  cForm=normContract(id?JSON.parse(JSON.stringify(contract(id))):{propertyId:(pid&&(prop(pid)||{}).use==='investimento'?pid:rentables[0].id),start:today()});
  if(!id)fillOwnerContact();
  const m=id?menu('ct',[
    {label:'Gerar contrato em PDF',icon:'pen',act:`generateContractPdf('${id}')`},
    isActive(cForm)?{label:'Terminar contrato',icon:'x',act:`endContract('${id}')`}:{label:'Reativar contrato',icon:'check',act:`reactivateContract('${id}')`},
    {label:'Apagar contrato',icon:'trash',danger:true,act:`delContract('${id}')`}]):'';
  openModal(id?'Editar contrato':'Novo contrato',ctBody(),null,m);
  const p=prop(cForm.propertyId);if(p)paintThumbs(p.photos);
  onSave=ctSaver();
}
function ctSaver(){
  return ()=>{
    collectCt();
    if(!cForm.propertyId)return toast('Escolhe o imóvel.');
    if(!(cForm.rent>0))return toast('Indica a renda mensal.');
    if(!cForm.tenantIds.length)return toast('Escolhe pelo menos um inquilino.');
    const i=db.contracts.findIndex(x=>x.id===cForm.id);
    if(i<0)db.contracts.push(cForm);else db.contracts[i]=cForm;
    syncContractRec(cForm);
    save();closeModal();buildNav();render();toast('Contrato guardado.');
  };
}
function ctBody(){
  const c=cForm,p=prop(c.propertyId),rooms=(p&&p.rentalMode==='quartos')?(p.rooms||[]):[];
  const taken=db.contracts.filter(x=>x.id!==c.id&&x.propertyId===c.propertyId&&isActive(x)).map(x=>x.roomId);
  const tags=ctTenants(c).map(t=>({id:t.id,label:t.name}));
  const inv=c.inventory||[];
  const nSum=(c.keys||[]).length?sum(c.keys.map(k=>k.qty))+' chaves':'';
  return `<div class="form">
    <label>Nome do contrato<input id="c_name" value="${esc(c.name||'')}" placeholder="${esc(ctPick(c)||'Ex.: Ana · T2 Lisboa')}" autocomplete="off"></label>
    <div class="hint" style="margin-top:-6px">É por este nome que o contrato aparece nos movimentos e nas listas. Sem nome, usa-se o dos inquilinos.</div>
    <label>Imóvel${sel('c_prop',c.propertyId,db.properties.filter(x=>x.use==='investimento'||x.id===c.propertyId).map(x=>({v:x.id,label:x.name})),'onCtProp')}</label>
    ${rooms.length?`<label>Quarto${sel('c_room',c.roomId||'',[{v:'',label:'— sem quarto —'}].concat(rooms.map(r=>({v:r.id,label:r.name+(taken.indexOf(r.id)>-1?' (já arrendado)':'')}))))}</label>`
     :(p&&p.use==='investimento'?`<div class="hint">Este imóvel está definido como arrendado por inteiro. Para arrendar por quartos, muda isso na ficha do imóvel.</div>`:'')}
    <div><div class="flabel">Inquilinos</div>${tagField(tags,'Adicionar','addCtTenant()','delCtTenant')}</div>
    <div class="row">
      <label>Renda mensal (€)<input id="c_rent" type="text" inputmode="decimal" value="${c.rent||''}" placeholder="450" oninput="liveNet()"></label>
      <label>Imposto sobre a renda (%)<input id="c_tax" type="text" inputmode="decimal" value="${c.taxRate?dec(c.taxRate):''}" placeholder="25" oninput="liveNet()"></label></div>
    <div class="card" style="background:var(--tint);padding:12px" id="netBox">${netBox()}</div>
    ${fold('terms','Prazo, caução e pagamento',`
    <div class="row">
      <label>Início<input id="c_start" type="date" value="${c.start||''}"></label>
      <label>Fim<input id="c_end" type="date" value="${c.end||''}"></label></div>
    <div class="row3">
      <label>Renda entre o dia<input id="c_day" type="text" inputmode="numeric" value="${c.payDay||''}" placeholder="1"></label>
      <label>e o dia<input id="c_dayTo" type="text" inputmode="numeric" value="${c.payDayTo||''}" placeholder="8"></label>
      <label>Aumento anual (%)<input id="c_inc" type="text" inputmode="decimal" value="${c.increase==null?'':dec(c.increase)}" placeholder="${dec(db.settings.growth)}"></label></div>
    <div class="row"><label>Caução (€)<input id="c_dep" type="text" inputmode="decimal" value="${c.deposit||''}" placeholder="Opcional"></label>
      <label>Rendas antecipadas (meses)<input id="c_adv" type="text" inputmode="numeric" value="${c.advance||''}" placeholder="0"></label></div>
    <div class="hint" style="margin-top:-6px">A renda cria um movimento recorrente todos os meses. Com rendas antecipadas, arranca depois dos meses pagos à cabeça.</div>
    <label>IBAN para pagamento das rendas<input id="c_iban" value="${esc(c.iban)}" placeholder="PT50 0000 0000 0000 0000 0000 0" autocomplete="off"></label>`,
      {icon:'contract',open:!c.id||!db.contracts.some(x=>x.id===c.id),summary:[c.start?'de '+c.start:'',c.end?'a '+c.end:'',c.deposit?'caução '+euro(c.deposit):''].filter(Boolean).join(' ')})}
    ${fold('contacts','Contactos',contactSect('owner',c,p)+contactSect('tenant',c,p),{icon:'users',summary:[c.ownerPhone||c.ownerEmail?'senhorio':'',c.tenantPhone||c.tenantEmail?'inquilino':''].filter(Boolean).join(' · ')})}
    ${fold('inv','Inventário',`
      ${inv.length?`<div class="form" style="gap:7px">
        <label class="check" style="margin-bottom:2px"><input type="checkbox" id="inv_all" onchange="invToggleAll()"> Selecionar todos</label>
        ${inv.map(it=>`<div class="invrow">
          <input type="checkbox" class="i-c" id="invc_${it.id}">
          <input class="i-n" id="invn_${it.id}" value="${esc(it.name)}" placeholder="Artigo">
          <input class="i-q" id="invq_${it.id}" type="text" inputmode="numeric" value="${it.qty}" placeholder="1">
          <span class="i-s">${sel('invs_'+it.id,it.state,[{v:'novo',label:'Novo'},{v:'usado',label:'Usado'}])}</span>
          <button type="button" class="btn sm danger" onclick="delInv('${it.id}')">${ic('trash',14)}</button></div>`).join('')}
        <div class="toolbar" style="margin:4px 0 0"><button type="button" class="btn sm danger" onclick="delInvSelected()">Remover selecionados</button></div>
      </div>`:`<div class="hint"></div>`}
      <div class="toolbar" style="margin:0">
        <button type="button" class="btn sm" onclick="addInv()">${ic('plus',14)} Adicionar artigo</button>
        <button type="button" class="btn sm" onclick="addInvBulk()">Adicionar vários</button></div>`,
      {icon:'box',summary:inv.length?inv.length+' artigos':''})}
    ${fold('photos','Registo fotográfico',`
      ${(p&&(p.photos||[]).length)?`
        <div class="hint" style="margin:-4px 0 0">Escolhe quais das fotos do imóvel entram neste contrato.</div>
        <div class="thumbs">${p.photos.map(f=>{const on=(c.photoIds||[]).indexOf(f.id)>-1;
          return `<div class="thumb" style="${on?'border-color:var(--accent);border-width:2px':'opacity:.55'}" onclick="togCtPhoto('${f.id}')">
            <div id="th_${f.id}" style="height:76px;background:var(--chip)"></div>
            <div class="nm">${on?'✓ ':''}${esc(f.name||'sem nome')}</div></div>`}).join('')}</div>
        <div class="toolbar" style="margin:11px 0 0">
          <button type="button" class="btn sm" onclick="allCtPhotos(1)">Selecionar todas</button>
          <button type="button" class="btn sm" onclick="allCtPhotos(0)">Nenhuma</button></div>`
        :`<div class="hint">Este imóvel ainda não tem fotos. Adiciona-as na ficha do imóvel.</div>`}`,
      {icon:'photo',summary:`${(c.photoIds||[]).length} de ${(p&&p.photos||[]).length}`})}
    ${fold('keys','Chaves entregues',`
      ${(c.keys||[]).length?`<div class="form" style="gap:7px">
        <label class="check" style="margin-bottom:2px"><input type="checkbox" id="key_all" onchange="keyToggleAll()"> Selecionar todos</label>
        ${c.keys.map(k=>`<div class="invrow" style="grid-template-columns:auto 1fr 62px auto">
          <input type="checkbox" id="keyc_${k.id}">
          <input class="i-n" id="keyn_${k.id}" value="${esc(k.name)}" placeholder="Chave de casa">
          <input class="i-q" id="keyq_${k.id}" type="text" inputmode="numeric" value="${k.qty}" placeholder="1">
          <button type="button" class="btn sm danger" onclick="delKey('${k.id}')">${ic('trash',14)}</button></div>`).join('')}
        <div class="toolbar" style="margin:4px 0 0"><button type="button" class="btn sm danger" onclick="delKeySelected()">Remover selecionadas</button></div>
      </div>`:`<div class="hint"></div>`}
      <div class="toolbar" style="margin:0">
        <button type="button" class="btn sm" onclick="addKey()">${ic('plus',14)} Adicionar tipo de chave</button>
        <button type="button" class="btn sm" onclick="addKeyBulk()">Adicionar várias</button></div>`,
      {icon:'key',summary:nSum})}
    ${fold('files','Anexos',fileBlock('',c.files||[],'c_filein','ctAddFiles','ctDelFile',{hint:'PDF do contrato assinado, recibos, comunicações. Ficam no dispositivo e não entram na cópia em JSON.'}),
      {icon:'clip',summary:(c.files||[]).length?c.files.length+' anexo'+(c.files.length===1?'':'s'):''})}
    <label class="check"><input type="checkbox" id="c_active" ${c.active!==false?'checked':''}> Contrato em vigor</label>
    <label class="check"><input type="checkbox" id="c_autorec" ${c.autoRec!==false?'checked':''}> Criar movimento recorrente da renda</label>
    <div class="hint" style="margin-top:-4px">Todos os meses a app pede para confirmar a renda em Planeados.</div>
    ${richEditor('Notas','c_notes',c.notes)}
  </div>`;
}
function netBox(){
  const r=num(val('c_rent'))||cForm.rent,tx=num(val('c_tax'))||cForm.taxRate||0;
  if(!r)return `<div class="hint">Falta a renda.</div>`;
  const imposto=r*tx/100;
  return `<div class="stat" style="padding-top:0"><span>Renda bruta</span><b>${euro2(r)}</b></div>
    <div class="stat"><span>Imposto (${dec(tx)}%)</span><b class="neg">−${euro2(imposto)}</b></div>
    <div class="stat" style="border:0"><span>Renda líquida</span><b class="pos" style="font-size:16px">${euro2(r-imposto)}</b></div>
    <div class="hint">${euro(( r-imposto)*12)} por ano, se a renda se mantiver.</div>`;
}
function liveNet(){const b=document.getElementById('netBox');if(b)b.innerHTML=netBox()}
function collectCt(){
  const c=cForm;
  if(document.getElementById('c_prop'))c.propertyId=val('c_prop')||null;
  if(document.getElementById('c_autorec'))c.autoRec=chk('c_autorec');
  c.roomId=document.getElementById('c_room')?(val('c_room')||null):null;
  c.name=val('c_name');c.rent=num(val('c_rent'));c.taxRate=num(val('c_tax'));c.iban=val('c_iban');
  if(document.getElementById('c_omail'))c.ownerEmail=val('c_omail');
  if(document.getElementById('c_ophone'))c.ownerPhone=val('c_ophone');
  if(document.getElementById('c_tmail'))c.tenantEmail=val('c_tmail');
  if(document.getElementById('c_tphone'))c.tenantPhone=val('c_tphone');
  c.deposit=num(val('c_dep'));c.start=val('c_start');c.end=val('c_end');
  c.payDay=Math.max(0,Math.min(31,Math.round(num(val('c_day')))))||null;
  c.payDayTo=Math.max(0,Math.min(31,Math.round(num(val('c_dayTo')))))||null;
  c.advance=Math.max(0,Math.min(36,Math.round(num(val('c_adv')))))||0;
  if(c.payDay&&c.payDayTo&&c.payDayTo<c.payDay)c.payDayTo=c.payDay;
  const i=val('c_inc');c.increase=String(i).trim()===''?null:num(i);
  if(document.getElementById('c_notes'))c.notes=richVal('c_notes');c.active=chk('c_active');
  (c.inventory||[]).forEach(it=>{
    const n=document.getElementById('invn_'+it.id);if(n)it.name=n.value;
    const q=document.getElementById('invq_'+it.id);if(q)it.qty=Math.max(1,Math.round(num(q.value))||1);
    const s=document.getElementById('invs_'+it.id);if(s)it.state=s.value;
  });
  (c.files||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
  (c.keys||[]).forEach(k=>{
    const nEl=document.getElementById('keyn_'+k.id);if(nEl)k.name=nEl.value;
    const q=document.getElementById('keyq_'+k.id);if(q)k.qty=Math.max(1,Math.round(num(q.value))||1);
  });
  if(document.getElementById('c_ocid'))c.ownerContactId=val('c_ocid')||'';
  if(document.getElementById('c_tcid'))c.tenantContactId=val('c_tcid')||'';
}
function repaintCt(){const b=modalBodyEl();if(!b)return;b.innerHTML=ctBody();
  const p=prop(cForm.propertyId);if(p)paintThumbs(p.photos)}

/* contacto: escolher de uma pessoa conhecida, ou escrever outro */
function contactSect(kind,c,p){
  const owners=kind==='owner';
  const gente=owners?ownersOfProp(p||{}).map(owner).filter(Boolean):ctTenants(c);
  const cur=owners?c.ownerContactId:c.tenantContactId;
  const opts=gente.map(g=>({v:g.id,label:g.name+(g.phone?' · '+fmtPhone(g.phone):'')})).concat([{v:'',label:'Outro contacto (escrever)'}]);
  const chosen=cur?gente.find(g=>g.id===cur):null;
  return `<div class="sect">
    <div class="sect-head"><span class="ic">${ic(owners?'crown':'users',18)}</span><b>Contacto do ${owners?'senhorio':'inquilino'}</b></div>
    <div class="hint" style="margin:-4px 0 0">${owners?'O que o inquilino usa para vos contactar.':'Ponto de contacto deste contrato.'}</div>
    ${gente.length?`<label>Usar o contacto de${sel(owners?'c_ocid':'c_tcid',cur||'',opts,owners?'onOwnerContact':'onTenantContact')}</label>`:''}
    ${chosen?`<div class="stat" style="border:0;padding:4px 0"><span>${esc(chosen.name)}</span>
        <b>${esc([chosen.phone?fmtPhone(chosen.phone):'',chosen.email].filter(Boolean).join(' · ')||'sem contacto na ficha')}</b></div>`
      :`<div class="row">
        <label>Email<input id="${owners?'c_omail':'c_tmail'}" value="${esc(owners?c.ownerEmail:c.tenantEmail)}" placeholder="nome@exemplo.pt" autocomplete="off"></label>
        <label>Telemóvel<input id="${owners?'c_ophone':'c_tphone'}" value="${esc(owners?c.ownerPhone:c.tenantPhone)}" placeholder="+351 912 000 000" autocomplete="off"></label></div>`}
  </div>`;
}
function onOwnerContact(){
  collectCt();cForm.ownerContactId=val('c_ocid')||'';
  const g=cForm.ownerContactId?owner(cForm.ownerContactId):null;
  if(g){cForm.ownerEmail=g.email||'';cForm.ownerPhone=g.phone||''}
  repaintCt();
}
function onTenantContact(){
  collectCt();cForm.tenantContactId=val('c_tcid')||'';
  const g=cForm.tenantContactId?tenant(cForm.tenantContactId):null;
  if(g){cForm.tenantEmail=g.email||'';cForm.tenantPhone=g.phone||''}
  repaintCt();
}
function togCtPhoto(fid){
  collectCt();
  const l=cForm.photoIds||(cForm.photoIds=[]),i=l.indexOf(fid);
  if(i>-1)l.splice(i,1);else l.push(fid);
  repaintCt();
}
function allCtPhotos(on){
  collectCt();
  const p=prop(cForm.propertyId);
  cForm.photoIds=on?(p&&p.photos||[]).map(f=>f.id):[];
  repaintCt();
}
function addKey(){collectCt();cForm.keys.push({id:uid(),name:'',qty:1});repaintCt()}
function delKey(kid){collectCt();cForm.keys=cForm.keys.filter(k=>k.id!==kid);repaintCt()}
function keyToggleAll(){const on=chk('key_all');(cForm.keys||[]).forEach(k=>{const e=document.getElementById('keyc_'+k.id);if(e)e.checked=on})}
function delKeySelected(){
  collectCt();
  const s2=(cForm.keys||[]).filter(k=>chk('keyc_'+k.id));
  if(!s2.length)return toast('Não há chaves selecionadas.');
  const ids={};s2.forEach(k=>ids[k.id]=1);
  cForm.keys=cForm.keys.filter(k=>!ids[k.id]);repaintCt();toast(s2.length+' removidas.');
}
function addKeyBulk(){
  collectCt();
  openModal('Adicionar várias chaves',`<div class="form">
    <div class="hint">Uma por linha, com a quantidade: <b>Chave de casa; 2</b></div>
    <textarea id="keybulk" style="min-height:130px;font:13px/1.6 ui-monospace,Menlo,monospace" placeholder="Chave de casa; 2&#10;Chave do correio; 1&#10;Comando do portão"></textarea></div>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="doKeyBulk()">Adicionar</button>`);
}
function doKeyBulk(){
  let added=0;
  String(val('keybulk')||'').split('\n').map(x=>x.trim()).filter(Boolean).forEach(line=>{
    const p2=line.split(/[;|\t]/).map(x=>x.trim());
    if(p2[0]){cForm.keys.push({id:uid(),name:p2[0],qty:Math.max(1,Math.round(num(p2[1]))||1)});added++}
  });
  closeModal();repaintCt();toast(added?'Chaves adicionadas.':'Nada para adicionar.');
}
/* puxa o contacto do primeiro proprietário, se ainda estiver vazio */
function fillOwnerContact(){
  const p=prop(cForm.propertyId);if(!p)return;
  const o=ownersOfProp(p).map(owner).filter(Boolean)[0];if(!o)return;
  if(!cForm.ownerEmail)cForm.ownerEmail=o.email||'';
  if(!cForm.ownerPhone)cForm.ownerPhone=o.phone||'';
}
function fillTenantContact(tid){
  const t=tenant(tid);if(!t)return;
  if(!cForm.tenantEmail)cForm.tenantEmail=t.email||'';
  if(!cForm.tenantPhone)cForm.tenantPhone=t.phone||'';
}
function onCtProp(){collectCt();cForm.propertyId=val('c_prop');cForm.roomId=null;fillOwnerContact();repaintCt()}
function addCtTenant(){
  collectCt();
  const free=db.tenants.filter(t=>(cForm.tenantIds||[]).indexOf(t.id)<0);
  pickModal('Escolher inquilino',free.map(t=>({v:t.id,label:t.name,sub:[t.phone,t.email].filter(Boolean).join(' · '),avatar:true})),
    t=>{cForm.tenantIds.push(t.v);fillTenantContact(t.v);closeModal();repaintCt()},
    `<button type="button" class="btn" style="width:100%;justify-content:center" onclick="newTenantFromCt()">${ic('plus',15)} Criar inquilino novo</button>`);
}
function delCtTenant(tid){collectCt();cForm.tenantIds=(cForm.tenantIds||[]).filter(x=>x!==tid);repaintCt()}
function newTenantFromCt(){
  closeModal();
  personModal('tenant',null,nid=>{
    if(cForm.tenantIds.indexOf(nid)<0)cForm.tenantIds.push(nid);
    fillTenantContact(nid);
    closeModal();render();repaintCt();
    toast('Inquilino criado e adicionado ao contrato.');
  });
}
function addInv(){collectCt();cForm.inventory.push({id:uid(),name:'',qty:1,state:'usado'});repaintCt()}
function delInv(iid){collectCt();cForm.inventory=cForm.inventory.filter(i=>i.id!==iid);repaintCt()}
function invToggleAll(){
  const on=chk('inv_all');
  (cForm.inventory||[]).forEach(i=>{const e=document.getElementById('invc_'+i.id);if(e)e.checked=on});
}
function delInvSelected(){
  collectCt();
  const sel2=(cForm.inventory||[]).filter(i=>chk('invc_'+i.id));
  if(!sel2.length)return toast('Não há artigos selecionados.');
  const ids={};sel2.forEach(i=>ids[i.id]=1);
  cForm.inventory=cForm.inventory.filter(i=>!ids[i.id]);
  repaintCt();toast(sel2.length+' artigos removidos.');
}
function addInvBulk(){
  collectCt();
  openModal('Adicionar vários artigos',`<div class="form">
    <div class="hint">Um artigo por linha. Podes indicar quantidade e estado: <b>Cadeira; 4; usado</b></div>
    <textarea id="invbulk" style="min-height:150px;font:13px/1.6 ui-monospace,Menlo,monospace" placeholder="Sofá; 1; novo&#10;Cadeira; 4; usado&#10;Frigorífico"></textarea></div>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="doInvBulk()">Adicionar</button>`);
}
function doInvBulk(){
  const lines=String(val('invbulk')||'').split('\n').map(x=>x.trim()).filter(Boolean);
  let added=0;
  lines.forEach(line=>{
    const parts=line.split(/[;|\t]/).map(x=>x.trim());
    if(!parts[0])return;
    cForm.inventory.push({id:uid(),name:parts[0],qty:Math.max(1,Math.round(num(parts[1]))||1),
      state:/nov/i.test(parts[2]||'')?'novo':'usado'});
    added++;
  });
  closeModal();repaintCt();
  toast(added?added+' artigos adicionados.':'Nada para adicionar.');
}
function ctAddFiles(input){
  collectCt();
  takeFiles(input).then(ms=>{cForm.files=(cForm.files||[]).concat(ms);repaintCt();
    if(ms.length)toast(ms.length===1?'Anexo adicionado.':ms.length+' anexos adicionados.')});
}
function ctDelFile(fid){collectCt();cForm.files=(cForm.files||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});repaintCt()}
function endContract(id){
  const c=contract(id);
  confirmModal('Terminar contrato',`Marcar o contrato de ${esc(ctNames(c))} como terminado? Deixa de contar para as rendas e projeções.`,()=>{
    c.active=false;if(!c.end)c.end=today();syncContractRec(c);save();closeAllModals();buildNav();render();toast('Contrato terminado.');
  });
}
function reactivateContract(id){
  const c=contract(id);
  confirmModal('Reativar contrato',`Voltar a pôr o contrato de ${esc(ctNames(c))} ativo? Volta a contar para as rendas e projeções.`,()=>{
    c.active=true;c.end='';syncContractRec(c);save();closeAllModals();buildNav();render();toast('Contrato reativado.');
  });
}
function delContract(id){
  const c=contract(id);
  confirmModal('Apagar contrato',`Apagar o contrato de ${esc(ctNames(c))}? Os movimentos ficam, mas deixam de estar ligados a ele.`,()=>{
    (c.files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    db.contracts=db.contracts.filter(x=>x.id!==id);
    db.recurring=(db.recurring||[]).filter(r=>!(r.auto&&r.tx&&r.tx.contractId===id));
    db.transactions.forEach(t=>{if(t.contractId===id)t.contractId=null});
    save();closeAllModals();buildNav();render();toast('Contrato apagado.');
  });
}
