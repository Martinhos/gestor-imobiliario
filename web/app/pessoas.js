/* ================= PESSOAS (inquilinos e proprietários) ================= */
let perForm={},perKind='tenant',perAfter=null;
/* Posso mesmo alterar a ficha desta pessoa?

   Num inquilino é a regra de sempre: quem o adicionou, ou o dono. Num
   proprietário é outra coisa — o db.owners é reconstruído a partir dos
   perfis do servidor a cada sincronização, e só o meu perfil é exportado.
   Editar a ficha de outro proprietário COM conta gravava localmente e
   desaparecia no pull seguinte; um proprietário sem conta é um registo meu
   como outro qualquer.
   Recebe: kind — 'tenant' ou 'owner'; p — a pessoa.
   Devolve: true se o «Editar» deve existir. */
function personEditavel(kind,p){
  if(!p)return false;
  if(kind==='tenant')return podeEditarInquilino(p);
  return !p._userId||!!(window.CW&&CW.user&&CW.user.id===p.id);
}
/* O corpo da ficha de uma pessoa: o que se sabe sobre ela, para ler.

   Um inquilino e um proprietário partilham o formulário, mas lêem-se por
   razões diferentes: de um inquilino quer-se o contacto, onde mora, desde
   quando e até quando; de um proprietário, a quota-parte e se estamos em dia.

   As guardas dizem o kind ANTES da permissão, e não é estilo: pode(null,perm)
   devolve sempre true, e num proprietário não há casa nenhuma — uma guarda
   escrita só como pode(casa,'tenant.view') não guardava nada.
   Recebe: kind — 'tenant' ou 'owner'; id — o id da pessoa.
   Devolve: o HTML do corpo, ou vazio se a pessoa já não existir. */
function personFicha(kind,id){
  const lista=kind==='owner'?db.owners:db.tenants;
  const p=(lista||[]).find(x=>x.id===id);if(!p)return '';
  const casa=kind==='tenant'?casaDoInquilino(p):null;
  const verPessoa=kind==='owner'||pode(casa,'tenant.view');
  const cts=kind==='tenant'?contractsOfTenant(p.id):[];
  const ativos=cts.filter(isActive),futuros=cts.filter(c=>ctEstado(c)==='futuro'),findos=cts.filter(c=>ctEstado(c)==='terminado');
  const casas=kind==='owner'?propsOf(p.id):[];
  const ident=verPessoa?[p.nif?'NIF '+esc(fmtNIF(p.nif)):'',
    p.cc?'CC '+esc(fmtCC(p.cc))+(p.ccValid?(pzDias(p.ccValid)<0?' · caducou a '+esc(p.ccValid):' · válido até '+esc(p.ccValid)):''):'',
    p.nationality&&p.nationality!=='Portuguesa'?esc(p.nationality):''].filter(Boolean).join('<br>'):'';
  /* a quota-parte só na minha casa: o servidor apaga as quotas de uma casa de
     colaboração, e o sharesOf reparte por igual quando não há percentagens —
     mostrá-la ali era publicar um número inventado */
  const minhas=casas.filter(x=>souDono(x.id));
  const renda=sum(minhas.filter(x=>pode(x.id,'contract.view')).map(x=>rentOf(x)*shareOf(x,p.id)));
  const saldo=kind==='owner'&&!ownerFilter?ownerBalances(null)[p.id]:undefined;
  const vazia=!p.phone&&!p.email&&!ident&&!p.taxAddress&&!(p.files||[]).length&&
    !(kind==='tenant'?cts.length:casas.length);
  return ficha([
    kind==='tenant'&&p._sharedFrom?{tipo:'nota',valor:'Ficha de <b>'+esc(p._sharedFrom)+'</b>.'}:null,
    kind==='tenant'&&!verPessoa?{tipo:'nota',valor:'O teu cargo mostra só o nome desta pessoa.'}:null,
    verPessoa&&p.phone?{rotulo:'Telemóvel',valor:esc(fmtPhone(p.phone))}:null,
    verPessoa&&p.email?{rotulo:'Email',valor:esc(p.email)}:null,
    kind==='tenant'&&ativos.length?{tipo:'bloco',rotulo:'Mora em',
      valor:ativos.map(c=>esc(ctLabel(c))+' · '+euro(c.rent)+'/mês'+(c.start?' · desde '+esc(c.start):'')+(c.end?' · até '+esc(c.end):'')).join('<br>')}:null,
    kind==='owner'&&casas.length?{tipo:'bloco',rotulo:'Imóveis e quota-parte',
      valor:casas.map(x=>esc(x.name||x.address||'imóvel')+(souDono(x.id)?' · '+pct(shareOf(x,p.id),0):'')).join('<br>')}:null,
    /* o saldo só sem filtro de proprietário ligado: com ele, o ownerBalances
       ignora os movimentos sem imóvel e devolvia meia verdade */
    saldo!==undefined?{rotulo:'Contas entre proprietários',
      valor:Math.abs(saldo)<0.01?'em dia':(saldo>0?'a receber '+euro2(saldo):'a pagar '+euro2(-saldo))}:null,
    renda>0?{rotulo:'Renda mensal que lhe toca',valor:euro(renda)}:null,
    ident?{tipo:'bloco',rotulo:'Identificação',valor:ident}:null,
    verPessoa&&p.taxAddress?{tipo:'bloco',rotulo:'Morada fiscal',valor:esc(p.taxAddress).replace(/\n/g,'<br>')}:null,
    /* «Vai morar em», e não «Contratos anteriores» a dizer «terminou a
       2031-01-01» — uma data no futuro dada como o dia em que acabou */
    kind==='tenant'&&futuros.length?{tipo:'bloco',rotulo:'Vai morar em',
      valor:futuros.map(c=>esc(ctLabel(c))+' · '+euro(c.rent)+'/mês'+(c.start?' · a partir de '+esc(c.start):'')).join('<br>')}:null,
    kind==='tenant'&&findos.length?{tipo:'bloco',rotulo:'Contratos anteriores',
      valor:findos.map(c=>esc(ctLabel(c))+' · '+euro(c.rent)+'/mês'+(c.end?' · terminou a '+esc(c.end):'')).join('<br>')}:null,
    /* os anexos de um inquilino pedem tenant.view E file.view no servidor:
       listar os nomes sem ambas dava linhas que rebentam ao toque */
    kind==='tenant'&&verPessoa&&pode(casa,'file.view')&&(p.files||[]).length?{tipo:'bloco',rotulo:'Documentos',
      valor:(p.files||[]).map(f=>`<span role="button" tabindex="0" data-toca="camada" style="cursor:pointer;text-decoration:underline" onclick="openMeta('${jsq(f.id)}')">${esc(f.name||'ficheiro')}</span>`).join('<br>')}:null,
    kind==='tenant'&&verPessoa&&String(p.notes||'').trim()?{tipo:'bloco',rotulo:'Notas',valor:rich(p.notes)}:null,
    /* a frase segue quem MANDA na ficha, e não o tipo: um proprietário sem
       conta é um registo meu como outro qualquer, e mandá-lo esperar por
       «quem tem a conta» era mandá-lo esperar por ninguém */
    vazia?{tipo:'nota',valor:'Esta ficha só tem o nome. '+(personEditavel(kind,p)
      ?'Toca em «Editar» para juntar contacto e identificação.'
      :'O perfil é mantido por quem tem a conta.')}:null,
  ]);
}
/* A ficha de uma pessoa: o que tocar num inquilino ou num proprietário abre.

   Um proprietário com conta não tem «Editar», e não é uma limitação de
   feitio: o db.owners é reconstruído a partir dos perfis do servidor a cada
   sincronização, e só o meu perfil é exportado — editar a ficha de outro
   gravava localmente e desaparecia na sincronização seguinte. No meu próprio
   perfil, o «Editar» vai ao editProfile da nuvem, que é quem sabe guardar.
   Recebe: kind — 'tenant' ou 'owner'; id — o id da pessoa.
   Devolve: nada — abre a janela. */
function personView(kind,id){
  const lista=kind==='owner'?db.owners:db.tenants;
  const p=(lista||[]).find(x=>x.id===id);if(!p)return;
  const euSou=kind==='owner'&&window.CW&&CW.user&&CW.user.id===p.id;
  const ok=personEditavel(kind,p);
  const act=euSou&&window.CW&&CW.editProfile?'CW.editProfile()':`personModal('${jsq(kind)}','${jsq(id)}')`;
  abrirFicha({
    titulo:()=>{const x=(kind==='owner'?db.owners:db.tenants||[]).find(y=>y.id===id);return x?x.name:'Ficha'},
    corpo:()=>personFicha(kind,id),
    menu:()=>{
      const it=[];
      if(kind==='tenant'){
        const c=contractsOfTenant(id).filter(ctVivo)[0];   // o em vigor, ou o que ainda não começou
        if(c&&pode(c.propertyId,'contract.view'))it.push({label:'Ver contrato',icon:'contract',toca:'camada',act:`ctView('${jsq(c.id)}')`});
      }
      /* apagar um proprietário com conta não é apagar um registo meu: é
         mexer numa pessoa que o servidor volta a mandar no pull seguinte */
      if(ok)it.push({label:kind==='owner'?'Apagar proprietário':'Apagar inquilino',
        icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delPerson('${jsq(kind)}','${jsq(id)}')`});
      return it.length?menu('fichaPer',it):'';
    },
    editar:ok?{rotulo:'Editar',act:act}:null,
  });
}
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
  /* Quem não pode alterar a ficha de um inquilino recebe a FICHA de leitura,
     e não este formulário com os campos apagados. */
  const _p=id?((kind==='owner'?db.owners:db.tenants)||[]).find(x=>x.id===id):null;
  if(kind==='tenant'&&_p&&!podeEditarInquilino(_p))return personView(kind,id);
  perKind=kind;perAfter=after||null;
  const listOf=kind==='owner'?db.owners:db.tenants,orig=id?listOf.find(x=>x.id===id):null;
  perForm=normPerson(orig?JSON.parse(JSON.stringify(orig)):null);
  if(!orig&&houseId&&kind==='tenant')perForm.houseId=houseId;
  const word=kind==='owner'?'proprietário':'inquilino';
  const m=id?menu('per',[{label:'Apagar '+word,icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delPerson('${kind}','${id}')`}]):'';
  openModal((id?'Editar ':'Novo ')+word,personBody(),null,m);
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
