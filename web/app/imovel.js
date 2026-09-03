/* ================= IMÓVEL ================= */
let pForm={};
function propModal(id){
  foldState={};_propPaint=null;
  pForm=normProp(id?JSON.parse(JSON.stringify(prop(id))):null);
  const m=id?menu('prop',[{label:'Apagar imóvel',icon:'trash',danger:true,act:`delProp('${id}')`}]):'';
  openModal(id?'Editar imóvel':'Novo imóvel',propBody(),null,m);
  paintThumbs(pForm.photos);
  onSave=()=>{
    collectProp();
    if(!pForm.name.trim())return falhaCampo('p_name','Dá um nome ao imóvel.');
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i<0)db.properties.push(pForm);else db.properties[i]=pForm;
    save();closeModal();render();toast(id?'Imóvel atualizado.':'Imóvel adicionado.');
  };
}
function propBody(){
  const p=pForm,ls=p.loans||[];
  const owners=(p.ownerIds||[]).map(owner).filter(Boolean);
  const shares=sharesOf(p),custom=hasShares(p);
  const sumSh=sum(owners.map(o=>Number((p.ownerShares||{})[o.id])||0));
  return `<div class="form">
    <label>Nome <span class="req">*</span><input id="p_name" value="${esc(p.name)}" placeholder="T2 Lisboa" autocomplete="off"></label>
    <label>Morada<input id="p_addr" value="${esc(p.address)}" placeholder="Opcional" autocomplete="off"></label>
    <div><div class="flabel">Proprietários e quota-parte</div>
      <div class="form" style="gap:7px">
        ${owners.map(o=>`<div class="ownrow"><span class="avatar" style="width:30px;height:30px;font-size:11px;flex:0 0 30px">${esc(initials(o.name))}</span>
          <span class="nm">${esc(o.name)}</span>
          <input id="p_share_${o.id}" type="text" inputmode="decimal" value="${(p.ownerShares||{})[o.id]!=null?dec(p.ownerShares[o.id]):''}" placeholder="${dec(Math.round(shares[o.id]*1000)/10)}" oninput="liveShares()">
          <span class="pc">%</span>
          <button type="button" class="btn sm danger" onclick="delPropOwner('${o.id}')">${ic('x',13)}</button></div>`).join('')}
        <button type="button" class="tagadd" style="justify-self:start" onclick="addPropOwner()">+ Adicionar proprietário</button></div>
      <div class="hint" id="shareHint" style="margin-top:7px">${shareHint(owners,custom,sumSh)}</div></div>
    <div><div class="flabel">Destino do imóvel</div>
      <div class="seg c2">${[['investimento','key','Arrendamento','para render'],['proprio','home','Uso próprio','vivo cá']]
        .map(([k,i,lb,s])=>`<button type="button" class="opt ${p.use===k?'on':''}" onclick="setUse('${k}')"><span class="ic">${ic(i,18)}</span><b>${lb}</b><small>${s}</small></button>`).join('')}</div></div>
    ${p.use==='investimento'?`
      <div><div class="flabel">Tipo de arrendamento</div>
        <div class="seg c2">${[['inteiro','building','Imóvel inteiro','um contrato só'],['quartos','door','Por quartos','um contrato por quarto']]
          .map(([k,i,lb,s])=>`<button type="button" class="opt ${p.rentalMode===k?'on':''}" onclick="setMode('${k}')"><span class="ic">${ic(i,18)}</span><b>${lb}</b><small>${s}</small></button>`).join('')}</div></div>
      ${p.rentalMode==='quartos'?`<div><div class="flabel">Quartos</div>
        <div class="form" style="gap:8px">${(p.rooms||[]).map(r=>`<div class="roomrow">
          <input id="p_room_${r.id}" value="${esc(r.name)}" placeholder="Quarto" autocomplete="off">
          <button type="button" class="btn sm danger" onclick="delRoom('${r.id}')">${ic('trash',14)}</button></div>`).join('')}
          <button type="button" class="btn sm" onclick="addRoom()">${ic('plus',14)} Adicionar quarto</button></div></div>`:''}`:''}
    <div class="row">
      <label>Valor de mercado (€)<input id="p_value" type="text" inputmode="decimal" value="${p.value||''}" placeholder="180000"></label>
      <label>Valor de aquisição (€)<input id="p_purchase" type="text" inputmode="decimal" value="${p.purchase||''}" placeholder="150000"></label></div>
    ${fold('photos','Fotos',fileBlock('',p.photos||[],'p_photoin','propAddPhotos','delPropPhoto',{photos:true,move:1,hint:'A primeira foto é a capa do imóvel. Arrasta pelo puxador para reordenar.'}),{icon:'photo',open:!!(p.photos||[]).length,summary:(p.photos||[]).length?p.photos.length+' foto'+(p.photos.length===1?'':'s'):'nenhuma'})}
    ${fold('reg','Dados registais',`
      <div class="row">
        <label>Freguesia<input id="p_freguesia" value="${esc(p.freguesia||p.parish||'')}" placeholder="Soure"></label>
        <label>Concelho<input id="p_concelho" value="${esc(p.concelho||'')}" placeholder="Soure"></label></div>
      <div class="row3">
        <label>Fração autónoma<input id="p_fraction" value="${esc(p.fraction||'')}" placeholder="A"></label>
        <label>Andar<input id="p_floor" value="${esc(p.floor||'')}" placeholder="2.º"></label>
        <label>Descrição predial n.º<input id="p_registry" value="${esc(p.registry)}" placeholder="15937"></label></div>
      <div class="row3">
        <label>Rua<input id="p_street" value="${esc(p.street||'')}" placeholder="Rua Central"></label>
        <label>Número da porta<input id="p_doorNumber" value="${esc(p.doorNumber||'')}" placeholder="12"></label>
        <label>Código postal<input id="p_postalCode" value="${esc(p.postalCode||'')}" placeholder="3130-000"></label></div>
      <label>Localidade<input id="p_locality" value="${esc(p.locality||'')}" placeholder="Soure"></label>
      <div class="row">
        <label>Artigo matricial<input id="p_matrix" value="${esc(p.matrix)}" placeholder="4651"></label>
        <label>Licença de utilização<input id="p_licence" value="${esc(p.licence)}" placeholder="Alvará n.º 26/2013"></label></div>
      <div class="row3">
        <label>Certificado energético<input id="p_energyCert" value="${esc(p.energyCert)}" placeholder="SCE395442330"></label>
        <label>Classe<input id="p_energyClass" value="${esc(p.energyClass)}" placeholder="D"></label>
        <label>Válido até<input id="p_energyValid" type="date" value="${p.energyValid||''}"></label></div>
      <div class="hint">Usados nas cláusulas do contrato em PDF. Deixa em branco o que não se aplicar — as frases correspondentes são omitidas.</div>`,
      {icon:'contract',summary:[p.freguesia||p.parish,p.registry?'n.º '+p.registry:''].filter(Boolean).join(' · ')||'para o contrato'})}
    ${fold('loans','Hipotecas',`
        ${ls.map((l,i)=>loanSect(l,i)).join('')}
        ${ls.length>1?`<div class="card" style="background:var(--tint);padding:12px">
          <div class="stat" style="padding-top:0;border:0"><span>Total das prestações</span><b style="font-size:16px">${euro2(payOf(p))}/mês</b></div>
          <div class="hint">${euro(debtOf(p))} em dívida no total.</div></div>`:''}
        <button type="button" class="addbox" onclick="addLoan()">
          <span class="ic">${ic('bank',20)}</span>
          <span><b>${ls.length?'Adicionar outra hipoteca':'Adicionar hipoteca'}</b><small>${ls.length?'crédito para obras, consolidação, segunda hipoteca…':'crédito à aquisição ou outro'}</small></span>
          <span class="plus">${ic('plus',18)}</span></button>
      ${ls.length?`<div class="hint">Um imóvel pode ter várias hipotecas em simultâneo. Todas contam para a dívida e para o LTV.</div>`:''}`,
      {icon:'bank',open:!!ls.length,summary:ls.length?(ls.length+(ls.length===1?' hipoteca · ':' hipotecas · ')+euro2(payOf(p))+'/mês'):'nenhuma'})}
    ${fold('text','Anúncio',`<label>Descrição para anúncios<textarea id="p_listing" placeholder="Texto para publicar em portais e redes sociais…">${esc(p.listing||'')}</textarea></label>`,
      {icon:'file',open:!!p.listing,summary:p.listing?'com texto':''})}
    <div class="hint">A renda, as datas e os inquilinos ficam no contrato, não aqui.</div>
    ${richEditor('Comentários dos proprietários','p_notes',p.notes)}</div>`;
}
function loanSect(l,i){
  return `<div class="sect">
    <div class="sect-head"><span class="ic">${ic('bank',18)}</span><b>${esc(l.name||'Hipoteca '+(i+1))}</b><span class="spacer"></span>
      <button type="button" class="btn sm danger" onclick="delLoan('${l.id}')">${ic('trash',14)}</button></div>
    <div class="row">
      <label>Finalidade<input id="l_name_${l.id}" value="${esc(l.name)}" placeholder="Aquisição" autocomplete="off" oninput="liveLoan('${l.id}')"></label>
      <label>Banco<input id="l_bank_${l.id}" value="${esc(l.bank)}" placeholder="Millennium" autocomplete="off"></label></div>
    <div class="row3">
      <label>Capital em dívida (€)<input id="l_out_${l.id}" type="text" inputmode="decimal" value="${l.outstanding||''}" placeholder="150000" oninput="liveLoan('${l.id}')"></label>
      <label>Prazo (anos)<input id="l_years_${l.id}" type="text" inputmode="numeric" value="${l.years||''}" placeholder="30" oninput="liveLoan('${l.id}')"></label>
      <label>Início<input id="l_start_${l.id}" type="date" value="${l.start||''}"></label></div>
    <div><div class="flabel">Tipo de taxa</div>
      <div class="seg c3">${[['fixa','lock','Fixa','não muda'],['mista','split','Mista','fixa e depois variável'],['variavel','wave','Variável','Euribor + spread']]
        .map(([k,ico,lb,sb])=>`<button type="button" class="opt ${l.type===k?'on':''}" onclick="setLType('${l.id}','${k}')"><span class="ic">${ic(ico,18)}</span><b>${lb}</b><small>${sb}</small></button>`).join('')}</div></div>
    ${l.type==='fixa'?`<div class="row">
      <label>Taxa anual TAN (%)<input id="l_rate_${l.id}" type="text" inputmode="decimal" value="${l.rate?dec(l.rate):''}" placeholder="3,2" oninput="liveLoan('${l.id}')"></label>
      <label>Comissão de amortização (%)<input id="l_ffix_${l.id}" type="text" inputmode="decimal" value="${l.amortFeeFix!=null?dec(l.amortFeeFix):''}" placeholder="2"></label></div>`:''}
    ${l.type==='mista'?`<div class="row">
        <label>Anos com taxa fixa<input id="l_fy_${l.id}" type="text" inputmode="numeric" value="${l.fixedYears||''}" placeholder="5" oninput="liveLoan('${l.id}')"></label>
        <label>Taxa fixa (%)<input id="l_rate_${l.id}" type="text" inputmode="decimal" value="${l.rate?dec(l.rate):''}" placeholder="3,1" oninput="liveLoan('${l.id}')"></label></div>`:''}
    ${l.type!=='fixa'?`<div class="row3">
      <label>Indexante${sel('l_index_'+l.id,l.index,['3m','6m','12m'].map(x=>({v:x,label:'Euribor '+x})),'liveLoanAll')}</label>
      <label>Indexante (%)<input id="l_eur_${l.id}" type="text" inputmode="decimal" value="${l.euribor?dec(l.euribor):''}" placeholder="2,1" oninput="liveLoan('${l.id}')"></label>
      <label>Spread (%)<input id="l_spr_${l.id}" type="text" inputmode="decimal" value="${l.spread?dec(l.spread):''}" placeholder="1,0" oninput="liveLoan('${l.id}')"></label></div>
    <div class="row">
      ${l.type==='mista'?`<label>Comissão amort. — fase fixa (%)<input id="l_ffix_${l.id}" type="text" inputmode="decimal" value="${l.amortFeeFix!=null?dec(l.amortFeeFix):''}" placeholder="2"></label>`:''}
      <label>Comissão amort. — taxa variável (%)<input id="l_fvar_${l.id}" type="text" inputmode="decimal" value="${l.amortFeeVar!=null?dec(l.amortFeeVar):''}" placeholder="0,5"></label></div>`:''}
    <label class="check"><input type="checkbox" id="l_stamp_${l.id}" ${l.stampTax?'checked':''} onchange="toggleStamp('${l.id}')">
      Pagar imposto do selo sobre os juros (${dec(db.settings.stampPct??4)}%)</label>
    <div class="hint" style="margin-top:-4px">Créditos mais antigos podem não o ter. Desliga se a tua prestação não o inclui.</div>
    <div class="card" style="background:var(--tint)" id="loanBox_${l.id}">${loanBox(l)}</div>
    ${fileBlock('FINE e outros documentos',l.files||[],'l_filein_'+l.id,'loanAddFiles','delLoanFile',
      {arg:l.id,addLabel:'Anexar documento',hint:'Ficha de Informação Normalizada Europeia, escritura, plano de amortização, cartas do banco.'})}
    <label class="check"><input type="checkbox" id="l_autorec_${l.id}" ${l.autoRec!==false?'checked':''}> Criar movimento recorrente da prestação</label>
    <div class="hint" style="margin-top:-4px">Todos os meses a app pede para confirmar a prestação em Planeados, já com a hipoteca associada.</div>
    </div>`;
}
function collectProp(){
  const p=pForm,has=id=>!!document.getElementById(id);
  if(has('p_name'))p.name=val('p_name');
  if(has('p_addr'))p.address=val('p_addr');
  if(has('p_value'))p.value=num(val('p_value'));
  if(has('p_purchase'))p.purchase=num(val('p_purchase'));
  ['parish','freguesia','concelho','fraction','floor','street','doorNumber','postalCode','locality','registry','matrix','licence','energyCert','energyClass','energyValid'].forEach(k=>{
    const e=document.getElementById('p_'+k);if(e)p[k]=e.value});
  if(document.getElementById('p_notes'))p.notes=richVal('p_notes');
  if(has('p_listing'))p.listing=val('p_listing');
  (p.rooms||[]).forEach(r=>{const e=document.getElementById('p_room_'+r.id);if(e)r.name=e.value});
  (p.photos||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
  const shr={};(p.ownerIds||[]).forEach(oid=>{const e=document.getElementById('p_share_'+oid);
    if(e&&String(e.value).trim()!==''){const v=num(e.value);if(v>=0)shr[oid]=v}else if(!e&&p.ownerShares&&p.ownerShares[oid]!=null&&p.ownerShares[oid]>=0)shr[oid]=p.ownerShares[oid]});
  p.ownerShares=shr;
  (p.loans||[]).forEach(l=>{
    const g=k=>document.getElementById('l_'+k+'_'+l.id);
    if(g('stamp'))l.stampTax=chk('l_stamp_'+l.id);
    if(g('autorec'))l.autoRec=chk('l_autorec_'+l.id);
    (l.files||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
    if(g('name'))l.name=val('l_name_'+l.id);
    if(g('bank'))l.bank=val('l_bank_'+l.id);
    if(g('out'))l.outstanding=num(val('l_out_'+l.id));
    if(g('years'))l.years=num(val('l_years_'+l.id))||30;
    if(g('start'))l.start=val('l_start_'+l.id);
    if(g('rate'))l.rate=num(val('l_rate_'+l.id));
    if(g('eur'))l.euribor=num(val('l_eur_'+l.id));
    if(g('spr'))l.spread=num(val('l_spr_'+l.id));
    if(g('fy'))l.fixedYears=num(val('l_fy_'+l.id))||5;
    if(g('index'))l.index=val('l_index_'+l.id);
    if(g('ffix'))l.amortFeeFix=Math.max(0,num(val('l_ffix_'+l.id)));
    if(g('fvar'))l.amortFeeVar=Math.max(0,num(val('l_fvar_'+l.id)));
  });
}
function shareHint(owners,custom,sumSh){
  if(!owners.length)return 'Sem proprietários. Podes filtrar a visão geral por proprietário e as contas entre donos dividem-se pela quota-parte.';
  if(!custom)return owners.length>1?`Partes iguais (${dec(Math.round(1000/owners.length)/10)}% cada). Escreve as percentagens para uma divisão diferente.`:'Proprietário único.';
  const sh2=sharesOf(pForm),parts=owners.map(o=>`${esc(o.name.split(' ')[0])} ${pct(sh2[o.id],0)}`).join(' · ');
  if(Math.abs(sumSh-100)<0.01)return `Soma 100%. ${parts}`;
  return (sumSh<100?`Quem não tem percentagem fica com o restante. `:`Soma ${dec(Math.round(sumSh*100)/100)}%, normalizado. `)+parts;
}
function liveShares(){
  collectProp();
  const owners=(pForm.ownerIds||[]).map(owner).filter(Boolean);
  const e=document.getElementById('shareHint');
  if(e)e.innerHTML=shareHint(owners,hasShares(pForm),sum(owners.map(o=>Number((pForm.ownerShares||{})[o.id])||0)));
}
let _propPaint=null;
function repaintProp(){const b=modalBodyEl();if(!b)return;b.innerHTML=(_propPaint||propBody)();paintThumbs(pForm.photos)}
function setUse(u){collectProp();pForm.use=u;repaintProp()}
function setMode(m){
  collectProp();pForm.rentalMode=m;
  if(m==='quartos'&&!(pForm.rooms||[]).length)pForm.rooms=[{id:uid(),name:'Quarto 1'},{id:uid(),name:'Quarto 2'}];
  repaintProp();
}
function addRoom(){collectProp();pForm.rooms.push({id:uid(),name:'Quarto '+(pForm.rooms.length+1)});repaintProp()}
function delRoom(rid){
  collectProp();
  const used=db.contracts.some(c=>c.roomId===rid);
  pForm.rooms=pForm.rooms.filter(r=>r.id!==rid);
  if(used){db.contracts.forEach(c=>{if(c.roomId===rid)c.roomId=null});toast('O contrato desse quarto ficou sem quarto associado.')}
  repaintProp();
}
function addLoan(){
  collectProp();
  pForm.loans.push(normLoan({name:pForm.loans.length?'':'Aquisição'}));
  repaintProp();
}
function delLoan(lid){
  collectProp();
  const l=findLoan(pForm,lid),used=db.transactions.filter(t=>t.loanId===lid).length;
  const drop=()=>{
    ((findLoan(pForm,lid)||{}).files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    pForm.loans=pForm.loans.filter(x=>x.id!==lid);
  };
  if(!used)return confirmModal('Apagar hipoteca',`Apagar “${esc(loanName(l))}”? Não tem prestações registadas.`,()=>{drop();repaintProp();toast('Hipoteca apagada.')});
  confirmModal('Apagar hipoteca',`Há ${used} prestação(ões) registada(s) em “${esc(loanName(l))}”. Os movimentos ficam, mas deixam de estar ligados a esta hipoteca.`,()=>{
    db.transactions.forEach(t=>{if(t.loanId===lid)t.loanId=null});
    drop();repaintProp();
    toast('Hipoteca apagada.');
  });
}
function loanAddFiles(input,lid){
  collectProp();
  takeFiles(input).then(ms=>{
    const l=findLoan(pForm,lid);if(!l)return;
    l.files=(l.files||[]).concat(ms);repaintProp();
    if(ms.length)toast(ms.length===1?'Documento anexado.':ms.length+' documentos anexados.');
  });
}
function delLoanFile(fid){
  collectProp();
  (pForm.loans||[]).forEach(l=>{l.files=(l.files||[]).filter(f=>f.id!==fid)});
  idbDel(fid).catch(()=>{});repaintProp();
}
function toggleStamp(lid){collectProp();const l=findLoan(pForm,lid);if(l)l.stampTax=chk('l_stamp_'+lid);liveLoan(lid)}
function setLType(lid,t){collectProp();const l=findLoan(pForm,lid);if(l)l.type=t;repaintProp()}
function liveLoan(lid){
  collectProp();
  if(lid){const b=document.getElementById('loanBox_'+lid);if(b)b.innerHTML=loanBox(findLoan(pForm,lid))}
  else liveLoanAll();
}
function liveLoanAll(){collectProp();(pForm.loans||[]).forEach(l=>{
  const b=document.getElementById('loanBox_'+l.id);if(b)b.innerHTML=loanBox(l)})}
function loanBox(l){
  if(!l)return '';
  if(!l.outstanding||!l.years)return `<div class="hint">Falta o capital em dívida e o prazo.</div>`;
  const c=loanCalc(l),a=amort(l);
  let extra='';
  if(l.type==='mista'){const k=Math.round((Number(l.fixedYears)||0)*12),r=a.rows[k];
    if(r)extra=`<div class="stat"><span>Prestação a partir do ano ${dec(l.fixedYears)}</span><b>${euro2(r.pay+r.st)}</b></div>`}
  return `<div class="stat" style="padding-top:0"><span>Prestação mensal</span><b style="font-size:16px">${euro2(c.total)}</b></div>
    <div class="stat"><span>Capital</span><b>${euro2(c.principal)}</b></div>
    <div class="stat"><span>Juros</span><b>${euro2(c.interest)}</b></div>
    ${l.stampTax?`<div class="stat"><span>Imposto do selo (${dec(db.settings.stampPct??4)}% dos juros)</span><b>${euro2(c.stamp)}</b></div>`:''}${extra}
    <div class="stat" style="border:0"><span>Custo total do crédito</span><b class="neg">${euro(a.totInt+a.totStamp)}</b></div>
    <div class="hint">${rateLabel(l)} · ${c.n} prestações</div>`;
}
function propAddPhotos(input){
  collectProp();
  takeFiles(input).then(ms=>{pForm.photos=(pForm.photos||[]).concat(ms);repaintProp();
    if(ms.length)toast(ms.length===1?'Foto adicionada.':ms.length+' fotos adicionadas.')});
}
/* arrastar as fotos para a posição pretendida (rato e dedo) */
let _pd=null;
function photoDrag(e,h,idx){
  e.preventDefault();e.stopPropagation();
  const row=h.closest('.prow');if(!row)return;
  const list=row.parentNode,rows=[...list.querySelectorAll('.prow')];
  idx=rows.indexOf(row);
  const step=(rows.length>1&&rows[1].offsetTop-rows[0].offsetTop)||row.offsetHeight+8||60;
  _pd={idx,to:idx,row,rows,step,y0:e.clientY};
  row.classList.add('drag');
  try{h.setPointerCapture(e.pointerId)}catch(x){}
  /* com o ponteiro capturado, tudo chega ao próprio puxador */
  h.onpointermove=photoDragMove;
  const done=()=>{h.onpointermove=h.onpointerup=h.onpointercancel=null;
    document.removeEventListener('pointermove',photoDragMove);document.removeEventListener('pointerup',done);document.removeEventListener('pointercancel',done);
    photoDragEnd()};
  h.onpointerup=h.onpointercancel=done;
  /* rede de segurança para ambientes onde a captura não redirige os eventos */
  document.addEventListener('pointermove',photoDragMove);
  document.addEventListener('pointerup',done);
  document.addEventListener('pointercancel',done);
}
function photoDragMove(e){
  if(!_pd)return;
  e.preventDefault();
  const dy=e.clientY-_pd.y0;
  _pd.row.style.transform=`translateY(${dy}px)`;
  const to=Math.max(0,Math.min(_pd.rows.length-1,_pd.idx+Math.round(dy/_pd.step)));
  if(to!==_pd.to){_pd.to=to;
    _pd.rows.forEach((r,i)=>{if(r===_pd.row)return;
      let sh=0;
      if(_pd.idx<to&&i>_pd.idx&&i<=to)sh=-_pd.step;
      else if(_pd.idx>to&&i>=to&&i<_pd.idx)sh=_pd.step;
      r.style.transform=sh?`translateY(${sh}px)`:'';});
  }
}
function photoDragEnd(){
  if(!_pd)return;
  const {idx,to,row,rows}=_pd;
  rows.forEach(r=>{r.style.transform='';r.classList.remove('drag')});
  _pd=null;
  if(to===idx)return;
  collectProp();
  const a=pForm.photos,x=a.splice(idx,1)[0];a.splice(to,0,x);
  /* move só a linha no DOM: repintar tudo recarregava as miniaturas e demorava */
  const list=row.parentNode,ref=rows[to];
  if(to>idx)list.insertBefore(row,ref.nextSibling);else list.insertBefore(row,ref);
  list.querySelectorAll('.capa').forEach(x2=>x2.remove());
  const first=list.querySelector('.prow .pth');
  if(first)first.insertAdjacentHTML('afterbegin','<span class="capa">capa</span>');
}
function delPropPhoto(fid){collectProp();pForm.photos=(pForm.photos||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});idbDel('tn_'+fid).catch(()=>{});repaintProp()}
function addPropOwner(){
  collectProp();
  const free=db.owners.filter(o=>(pForm.ownerIds||[]).indexOf(o.id)<0);
  pickModal('Escolher proprietário',free.map(o=>({v:o.id,label:o.name,sub:[o.phone,o.email].filter(Boolean).join(' · '),avatar:true})),
    o=>{pForm.ownerIds.push(o.v);closeModal();repaintProp()},
    `<button type="button" class="btn" style="width:100%;justify-content:center" onclick="newOwnerFromProp()">${ic('plus',15)} Criar proprietário novo</button>`);
}
function delPropOwner(oid){collectProp();pForm.ownerIds=(pForm.ownerIds||[]).filter(x=>x!==oid);if(pForm.ownerShares)delete pForm.ownerShares[oid];repaintProp()}
function newOwnerFromProp(){
  closeModal();   /* fecha a lista de escolha; a ficha nova abre por cima do imóvel */
  personModal('owner',null,nid=>{if(pForm.ownerIds.indexOf(nid)<0)pForm.ownerIds.push(nid);closeModal();render();repaintProp();toast('Proprietário criado.')});
}
function propSaver(){
  return ()=>{collectProp();
    if(!pForm.name.trim())return toast('Dá um nome ao imóvel.');
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i<0)db.properties.push(pForm);else db.properties[i]=pForm;
    syncAllLoanRecs();save();closeModal();render();toast('Imóvel guardado.')};
}
function delProp(id){
  const p=prop(id),n=contractsOf(id).length;
  confirmModal('Apagar imóvel',`Apagar “${esc(p.name)}”${n?`, os seus ${n} contratos`:''} e todos os movimentos associados?`,()=>{
    /* a cópia primeiro, os blobs só quando o Anular expirar: uma cascata
       destas confirmada por hábito era irrecuperável */
    const copia={p:JSON.parse(JSON.stringify(p)),
      cts:JSON.parse(JSON.stringify(db.contracts.filter(x=>x.propertyId===id))),
      txs:JSON.parse(JSON.stringify(db.transactions.filter(x=>x.propertyId===id)))};
    db.properties=db.properties.filter(x=>x.id!==id);if(dashProp===id)dashProp='';if(txProp===id)txProp='';
    db.contracts=db.contracts.filter(x=>x.propertyId!==id);
    db.transactions=db.transactions.filter(x=>x.propertyId!==id);
    save();closeAllModals();render();
    comDesfazer('Imóvel apagado.',()=>{
      db.properties.push(copia.p);
      db.contracts=db.contracts.concat(copia.cts);
      db.transactions=db.transactions.concat(copia.txs);
    },()=>{
      (copia.p.photos||[]).forEach(f=>{idbDel(f.id).catch(()=>{});idbDel('tn_'+f.id).catch(()=>{})});
      (copia.p.loans||[]).forEach(l=>(l.files||[]).forEach(f=>idbDel(f.id).catch(()=>{})));
    });
  });
}
