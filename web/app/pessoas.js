/* ================= PESSOAS (inquilinos e proprietários) ================= */
let perForm={},perKind='tenant',perAfter=null;
function personModal(kind,id,after){
  foldState={};
  perKind=kind;perAfter=after||null;
  const listOf=kind==='owner'?db.owners:db.tenants;
  perForm=normPerson(id?JSON.parse(JSON.stringify(listOf.find(x=>x.id===id))):null);
  const word=kind==='owner'?'proprietário':'inquilino';
  const m=id?menu('per',[{label:'Apagar '+word,icon:'trash',danger:true,act:`delPerson('${kind}','${id}')`}]):'';
  openModal((id?'Editar ':'Novo ')+word,personBody(),null,m);
  onSave=()=>{
    collectPerson();
    if(!perForm.name.trim())return toast('Escreve o nome.');
    const list=perKind==='owner'?db.owners:db.tenants;
    const i=list.findIndex(x=>x.id===perForm.id);
    if(i<0)list.push(perForm);else list[i]=perForm;
    save();
    const cb=perAfter,nid=perForm.id;perAfter=null;
    if(cb){cb(nid);return}
    closeModal();render();toast('Ficha guardada.');
  };
}
function personBody(){
  const t=perForm;
  return `<div class="form">
    <label>Nome completo<input id="pe_name" value="${esc(t.name)}" placeholder="Ana Rodrigues" autocomplete="off"></label>
    <div class="row">
      <label>Telemóvel<input id="pe_phone" value="${esc(t.phone)}" placeholder="Opcional" autocomplete="off"></label>
      <label>Email<input id="pe_mail" value="${esc(t.email)}" placeholder="Opcional" autocomplete="off"></label></div>
    ${fold('ident','Identificação',`
    <div class="row">
      <label>Género${sel('pe_gender',t.gender,GENDER.map(g=>({v:g[0],label:g[1]})))}</label>
      <label>Estado civil${sel('pe_marital',t.marital,MARITAL.map(x=>({v:x,label:x||'—'})))}</label></div>
    <div class="row">
      <label>Nacionalidade<input id="pe_nat" value="${esc(t.nationality)}" placeholder="Portuguesa" autocomplete="off"></label>
      <label>Data de nascimento<input id="pe_birth" type="date" value="${t.birth||''}"></label></div>
    <div class="row">
      <label>N.º do Cartão de Cidadão<input id="pe_cc" value="${esc(t.cc)}" placeholder="00000000 0 ZZ0" autocomplete="off"></label>
      <label>Validade do CC<input id="pe_ccv" type="date" value="${t.ccValid||''}"></label></div>
    <label>NIF<input id="pe_nif" value="${esc(t.nif)}" placeholder="Opcional" inputmode="numeric"></label>
    <label>Morada fiscal<textarea id="pe_addr" style="min-height:66px" placeholder="Rua, número, código postal, localidade">${esc(t.taxAddress)}</textarea></label>
    <div class="hint">Usado na identificação das partes no contrato em PDF.</div>`,
      {icon:'contract',summary:[t.nif?'NIF '+fmtNIF(t.nif):'',t.cc?'CC':''].filter(Boolean).join(' · ')||'para o contrato'})}
    ${perKind==='owner'?'':fold('docs','Documentos',
      fileBlock('',t.files||[],'pe_filein','personAddFiles','delPersonFile',{hint:'Cartão de cidadão, contrato de trabalho, comprovativo de morada, recibos de vencimento.'}),
      {icon:'clip',open:!!(t.files||[]).length,summary:(t.files||[]).length?t.files.length+' doc.':''})
      +`<label>Notas<textarea id="pe_notes" placeholder="Fiador, referências, observações…">${esc(t.notes)}</textarea></label>`}</div>`;
}
function collectPerson(){
  const t=perForm;
  t.name=val('pe_name');t.phone=val('pe_phone');t.email=val('pe_mail');
  t.gender=val('pe_gender');t.marital=val('pe_marital');t.nationality=val('pe_nat');
  t.birth=val('pe_birth');t.cc=val('pe_cc');t.ccValid=val('pe_ccv');
  t.nif=val('pe_nif');t.taxAddress=val('pe_addr');
  if(document.getElementById('pe_notes'))t.notes=val('pe_notes');
  (t.files||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
}
function personAddFiles(input){
  collectPerson();
  takeFiles(input).then(ms=>{perForm.files=(perForm.files||[]).concat(ms);
    repaintPerson();
    if(ms.length)toast('Documento adicionado.')});
}
function repaintPerson(){const b=modalBodyEl();if(b)b.innerHTML=personBody()}
function delPersonFile(fid){collectPerson();perForm.files=(perForm.files||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});repaintPerson()}
function delPerson(kind,id){
  const list=kind==='owner'?db.owners:db.tenants;
  const p=list.find(x=>x.id===id),word=kind==='owner'?'proprietário':'inquilino';
  const used=kind==='owner'?propsOf(id).length:contractsOfTenant(id).length;
  confirmModal('Apagar '+word,`Apagar “${esc(p.name)}”?${used?` Sai de ${used} ${kind==='owner'?'imóvel(is)':'contrato(s)'}, que se mantêm.`:''}`,()=>{
    (p.files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    if(kind==='owner'){db.owners=db.owners.filter(x=>x.id!==id);db.properties.forEach(x=>{x.ownerIds=(x.ownerIds||[]).filter(o=>o!==id)});if(ownerFilter===id)ownerFilter=''}
    else{db.tenants=db.tenants.filter(x=>x.id!==id);db.contracts.forEach(c=>{c.tenantIds=(c.tenantIds||[]).filter(t=>t!==id)})}
    save();closeAllModals();render();toast('Ficha apagada.');
  });
}
