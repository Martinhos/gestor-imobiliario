/* ================= PESSOAS (inquilinos e proprietários) ================= */
let perForm={},perKind='tenant',perAfter=null;
/* Abre a ficha de pessoa (kind 'owner' ou 'tenant'); sem id cria uma nova.
   after, se vier, é chamado com o id da ficha depois de guardar, em vez do
   fecho normal — é assim que o contrato cria um inquilino sem perder o fluxo.
   Quem não é dono de imóvel nenhum só cria fichas presas a um imóvel onde
   pode «Adicionar inquilinos» (senão a ficha ficava privada e nunca chegava
   ao dono): com um só, fica esse; com vários, escolhe-se primeiro.
   Recebe: kind — 'owner' ou 'tenant', diz que lista se usa; id (opcional) —
   id da ficha a editar, sem ele cria uma nova; after (opcional) — função
   chamada com o id da ficha depois de guardar; houseId (opcional) — o imóvel
   a que a ficha nova fica presa.
   Devolve: nada — abre o modal da ficha (ou, antes, a escolha do imóvel). */
function personModal(kind,id,after,houseId){
  if(kind==='tenant'&&!id&&!houseId&&souSoColaborador()){
    const cs=casasComo('tenant.add');
    if(!cs.length)return toast(fraseSemPerm('tenant.add'));
    if(cs.length>1)return pickModal('Inquilino de que imóvel?',cs.map(p=>({v:p.id,label:p.name||p.address||'imóvel',sub:p._sharedFrom?'de '+p._sharedFrom:''})),
      o=>{closeModal();personModal(kind,null,after,o.v)});
    houseId=cs[0].id;
  }
  foldState={};
  perKind=kind;perAfter=after||null;
  const listOf=kind==='owner'?db.owners:db.tenants,orig=id?listOf.find(x=>x.id===id):null;
  perForm=normPerson(orig?JSON.parse(JSON.stringify(orig)):null);
  if(!orig&&houseId&&kind==='tenant')perForm.houseId=houseId;
  const word=kind==='owner'?'proprietário':'inquilino';
  /* a ficha de um inquilino de um imóvel onde só colaboro abre em leitura sem «Adicionar inquilinos» */
  const soLer=kind==='tenant'&&!!orig&&!podeEditarInquilino(orig);
  const m=id&&!soLer?menu('per',[{label:'Apagar '+word,icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delPerson('${kind}','${id}')`}]):'';
  openModal((id?(soLer?'':'Editar '):'Novo ')+(soLer?'Ficha de '+word:word),personBody(),null,m);
  if(soLer)return modalSoLeitura('Ficha de um imóvel onde colaboras — só de leitura.');
  onSave=()=>{
    collectPerson();
    if(!perForm.name.trim())return toast('Escreve o nome.');
    if(perKind==='tenant'){const recusa=motivoRecusa(casaDoInquilino(orig||perForm),'tenant.add',orig);if(recusa)return toast(recusa)}
    const list=perKind==='owner'?db.owners:db.tenants;
    const i=list.findIndex(x=>x.id===perForm.id);
    if(i<0)list.push(perForm);else list[i]=perForm;
    save();
    const cb=perAfter,nid=perForm.id;perAfter=null;
    if(cb){cb(nid);return}
    closeModal();render();toast('Ficha guardada.');
  };
}
// HTML do formulário da ficha, montado a partir de perForm. Proprietários
// não têm a secção de documentos nem as notas.
// Devolve: string com o HTML do formulário da ficha.
function personBody(){
  const t=perForm;
  return `<div class="form">
    <label>Nome completo<input id="pe_name" value="${esc(t.name)}" placeholder="Ana Rodrigues" autocomplete="off"></label>
    <div class="row">
      <label>Telemóvel<input id="pe_phone" value="${esc(t.phone)}" placeholder="Opcional" autocomplete="off"></label>
      <label>Email<input id="pe_mail" value="${esc(t.email)}" placeholder="Opcional" autocomplete="off"></label></div>
    ${fold('ident','Identificação',`
    <div class="row">
      <label>Género${sel('pe_gender',t.gender,GENDER.map(g=>({v:g[0],label:g[1]})),'','rascunho')}</label>
      <label>Estado civil${sel('pe_marital',t.marital,MARITAL.map(x=>({v:x,label:x||'—'})),'','rascunho')}</label></div>
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
// Copia os campos do modal para perForm. Chamar antes de repintar ou de
// mexer nos documentos, senão perde-se o que o utilizador escreveu.
// Devolve: nada — só atualiza o objeto perForm.
function collectPerson(){
  const t=perForm;
  t.name=val('pe_name');t.phone=val('pe_phone');t.email=val('pe_mail');
  t.gender=val('pe_gender');t.marital=val('pe_marital');t.nationality=val('pe_nat');
  t.birth=val('pe_birth');t.cc=val('pe_cc');t.ccValid=val('pe_ccv');
  t.nif=val('pe_nif');t.taxAddress=val('pe_addr');
  if(document.getElementById('pe_notes'))t.notes=val('pe_notes');
  (t.files||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
}
// Recebe os ficheiros do input de documentos: o conteúdo vai para o IndexedDB
// (takeFiles) e os metadados juntam-se a perForm.files. Assíncrono — repinta no fim.
// Recebe: input — o elemento <input type="file"> com os ficheiros escolhidos.
// Devolve: nada — repinta quando os ficheiros acabarem de entrar.
function personAddFiles(input){
  collectPerson();
  takeFiles(input).then(ms=>{perForm.files=(perForm.files||[]).concat(ms);
    repaintPerson();
    if(ms.length)toast('Documento adicionado.')});
}
// Repinta o corpo do modal a partir de perForm (sem recolher os campos antes).
// Devolve: nada — redesenha o corpo do modal.
function repaintPerson(){const b=modalBodyEl();if(b)b.innerHTML=personBody()}
// Tira um documento da ficha e apaga logo o conteúdo do IndexedDB — sem desfazer.
// Recebe: fid — id do documento a remover.
// Devolve: nada — repinta o formulário.
function delPersonFile(fid){collectPerson();perForm.files=(perForm.files||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});repaintPerson()}
/* Apaga a ficha, com confirmação: a pessoa sai da lista e o seu id é tirado
   dos imóveis (proprietário) ou contratos (inquilino), que se mantêm. Os
   documentos saem já do IndexedDB — aqui não há desfazer.
   Recebe: kind — 'owner' ou 'tenant', diz em que lista procurar; id — id da
   ficha a apagar.
   Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista. */
function delPerson(kind,id){
  const list=kind==='owner'?db.owners:db.tenants;
  const p=list.find(x=>x.id===id),word=kind==='owner'?'proprietário':'inquilino';
  if(!p)return;
  if(kind==='tenant'){const recusa=motivoRecusa(casaDoInquilino(p),'tenant.add',p,true);if(recusa)return toast(recusa)}
  const used=kind==='owner'?propsOf(id).length:contractsOfTenant(id).length;
  confirmModal('Apagar '+word,`Apagar “${esc(p.name)}”?${used?` Sai de ${used} ${kind==='owner'?'imóvel(is)':'contrato(s)'}, que se mantêm.`:''}`,()=>{
    (p.files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    if(kind==='owner'){db.owners=db.owners.filter(x=>x.id!==id);db.properties.forEach(x=>{x.ownerIds=(x.ownerIds||[]).filter(o=>o!==id)});if(ownerFilter===id)ownerFilter=''}
    else{db.tenants=db.tenants.filter(x=>x.id!==id);db.contracts.forEach(c=>{c.tenantIds=(c.tenantIds||[]).filter(t=>t!==id)})}
    save();closeAllModals();render();toast('Ficha apagada.');
  });
}
