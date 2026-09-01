/* ================= MODELOS E RECORRÊNCIAS ================= */
const EVERY={once:'uma só vez',week:'semanal',month:'mensal',quarter:'trimestral',year:'anual'};
function nextDate(iso,every){
  const d=new Date((iso||today())+'T00:00:00');if(isNaN(d))return today();
  if(every==='week'){d.setDate(d.getDate()+7)}
  else{const day=d.getDate(),m=every==='year'?12:every==='quarter'?3:1;d.setDate(1);d.setMonth(d.getMonth()+m);
    const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last))}
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
/* a renda de cada contrato ativo vive como movimento recorrente, criado e mantido pela app */
function ctRecOf(c){return (db.recurring||[]).find(r=>r.auto&&r.tx&&r.tx.contractId===c.id)}
function dayInMonth(y,m,d){const last=new Date(y,m+1,0).getDate();return `${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`}
function syncContractRec(c){
  const r=ctRecOf(c),want=isActive(c)&&c.rent>0&&c.autoRec!==false;
  if(!want){if(r)db.recurring=db.recurring.filter(x=>x.id!==r.id);return}
  const from=Math.max(1,Math.min(31,c.payDay||1)),to=Math.max(from,Math.min(31,c.payDayTo||from));
  const inc=catsIn(),cat='Rendas' in inc?'Rendas':'',sub=cat&&(inc[cat]||[]).indexOf('Renda mensal')>-1?'Renda mensal':'';
  const tx={kind:'income',label:'Renda '+ctName(c),amount:c.rent,propertyId:c.propertyId,contractId:c.id,category:cat,sub,split:null};
  /* rendas antecipadas: a primeira ocorrência só aparece depois desses meses */
  let minNext='';
  if(c.start&&c.advance>0){const d=new Date(c.start+'T00:00:00');let y2=d.getFullYear(),m2=d.getMonth()+c.advance;y2+=Math.floor(m2/12);m2%=12;minNext=dayInMonth(y2,m2,from)}
  if(r){Object.assign(r.tx,tx);r.name='Renda '+ctName(c);r.end=c.end||'';
    /* se os dias da janela mudarem no contrato, a janela acompanha (mantendo o mês em curso) */
    if(r.next){const d=new Date(r.next+'T00:00:00');r.next=dayInMonth(d.getFullYear(),d.getMonth(),from);r.until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
    if(minNext&&r.next<minNext){const d=new Date(minNext+'T00:00:00');r.next=minNext;r.until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
    return}
  /* primeira janela: este mês se ainda não passou; senão o mês que vem; nunca antes do início do contrato */
  const t=new Date(today()+'T00:00:00');let y=t.getFullYear(),m=t.getMonth();
  if(today()>dayInMonth(y,m,to)){m++;if(m>11){m=0;y++}}
  let next=dayInMonth(y,m,from),until=to>from?dayInMonth(y,m,to):'';
  if(c.start&&next<c.start){const d=new Date(c.start+'T00:00:00');let y2=d.getFullYear(),m2=d.getMonth();
    if(c.start>dayInMonth(y2,m2,to)){m2++;if(m2>11){m2=0;y2++}}
    next=dayInMonth(y2,m2,from);until=to>from?dayInMonth(y2,m2,to):'';}
  if(minNext&&next<minNext){const d=new Date(minNext+'T00:00:00');next=minNext;until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
  db.recurring=db.recurring||[];
  db.recurring.push(normRec({auto:true,name:'Renda '+ctName(c),every:'month',next,until,end:c.end||'',tx}));
}
function syncAllContractRecs(){
  (db.recurring||[]).slice().forEach(r=>{if(r.auto&&!(r.tx||{}).loanId&&(!r.tx.contractId||!db.contracts.some(c=>c.id===r.tx.contractId)))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
  db.contracts.forEach(syncContractRec);
}
/* ---- prestações das hipotecas: recorrência automática, tal como as rendas dos contratos ---- */
function loanRecOf(l){return (db.recurring||[]).find(r=>r.auto&&r.tx&&r.tx.loanId===l.id)}
function syncLoanRec(p,l){
  const r=loanRecOf(l);
  /* se o utilizador já tem uma recorrência manual para esta hipoteca, não se duplica */
  const manual=(db.recurring||[]).some(x=>!x.auto&&x.tx&&x.tx.loanId===l.id);
  const want=l.outstanding>0&&l.autoRec!==false&&!manual;
  if(!want){if(r)db.recurring=db.recurring.filter(x=>x.id!==r.id);return}
  const day=(()=>{const d=l.start?Number(l.start.slice(8,10)):0;return Math.max(1,Math.min(28,d||1))})();
  const name='Prestação '+(l.name?l.name+' · ':'')+p.name;
  const out=cats(),cat='Crédito à habitação' in out?'Crédito à habitação':'',sub=cat&&(out[cat]||[]).indexOf('Prestação mensal')>-1?'Prestação mensal':'';
  const tx={kind:'loan',payType:'prestacao',label:name,amount:Math.round(loanCalc(l).total*100)/100,propertyId:p.id,loanId:l.id,category:cat,sub,split:null};
  if(r){Object.assign(r.tx,tx);r.name=name;
    if(r.next){const d=new Date(r.next+'T00:00:00');r.next=dayInMonth(d.getFullYear(),d.getMonth(),day)}
    return}
  const t=new Date(today()+'T00:00:00');let y=t.getFullYear(),m=t.getMonth();
  if(today()>dayInMonth(y,m,day)){m++;if(m>11){m=0;y++}}
  db.recurring=db.recurring||[];
  db.recurring.push(normRec({auto:true,name,every:'month',next:dayInMonth(y,m,day),tx}));
}
function syncAllLoanRecs(){
  const live=id=>db.properties.some(p=>(p.loans||[]).some(l=>l.id===id));
  (db.recurring||[]).slice().forEach(r=>{if(r.auto&&(r.tx||{}).loanId&&!live(r.tx.loanId))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
  db.properties.forEach(p=>(p.loans||[]).forEach(l=>syncLoanRec(p,l)));
}
/* recorrências vencidas (a data prevista já passou ou é hoje) */
function recPending(){const t=today();return (db.recurring||[]).filter(r=>r.next&&r.next<=t)}
/* silenciada: continua por confirmar em Planeados, mas não avisa nem conta no menu */
function recActive(){return recPending().filter(r=>!r.muted)}
/* em atraso: passou o último dia da janela sem confirmação */
const recIsLate=r=>!!(r.next&&r.next<=today()&&(r.until||r.next)<today());
function recLate(){return recActive().filter(recIsLate)}
function recAdvance(r){
  r.muted=false;
  if(r.every==='once'){db.recurring=db.recurring.filter(x=>x.id!==r.id);return}
  const gap=r.until&&r.until>r.next?Math.round((new Date(r.until+'T00:00:00')-new Date(r.next+'T00:00:00'))/864e5):0;
  r.next=nextDate(r.next,r.every);r.until=gap?addDays(r.next,gap):'';
  if(r.end&&r.next>r.end){db.recurring=db.recurring.filter(x=>x.id!==r.id);toast('“'+r.name+'” chegou ao fim: deixa de se repetir.')}
}
function recTx(r,date){return normTx(Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:date||r.next,label:r.tx.label||r.name}))}
/* confirmar sem abrir: cria o movimento na data prevista e passa à seguinte */
function quickConfirmRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const t=recTx(r);if(t.kind==='loan')applyLoan(t);
  db.transactions.push(t);recAdvance(r);save();buildNav();render();toast('Movimento confirmado.');
}
function skipRec(id){const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;r.muted=!r.muted;save();buildNav();render();toast(r.muted?'Silenciada: fica em Planeados à espera de confirmação, sem avisos.':'Volta a avisar.')}
/* abrir para rever antes de confirmar */
function confirmRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  txModal(null,r.tx.kind,r.tx.propertyId,null,r.tx.contractId,Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:r.next,label:r.tx.label||r.name}));
  tForm._recConfirm=id;const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Confirmar movimento';
}
function editRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  txModal(null,r.tx.kind,r.tx.propertyId,null,r.tx.contractId,Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:r.next,label:r.tx.label||r.name}));
  tForm._recId=id;tForm._every=r.every;tForm._recEnd=r.end||'';tForm._until=r.until||'';
  const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Editar movimento recorrente';
  foldState.rec=true;repaintTx();
}
function newRec(){
  newTxPick(k=>{txModal(null,k,null);tForm._recNew=true;tForm._every='month';
    const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Novo movimento recorrente';foldState.rec=true;repaintTx()});
}
function newTpl(){
  newTxPick(k=>{txModal(null,k,null);tForm._tplNew=true;
    const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Novo modelo';repaintTx()});
}
function editTpl(id){
  const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
  txModal(null,x.tx.kind,x.tx.propertyId,null,x.tx.contractId,JSON.parse(JSON.stringify(x.tx)));
  tForm._tplId=id;tForm._tplName=x.name;
  const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Editar modelo';repaintTx();
}
function delRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const isLoan=r.auto&&(r.tx||{}).loanId;
  confirmModal('Apagar movimento recorrente',r.auto?(isLoan?`Esta é a prestação de uma hipoteca. Apagar deixa de a pedir todos os meses (podes voltar a ligá-la na hipoteca).`:`Este é a renda de um contrato. Apagar deixa de a pedir todos os meses (podes voltar a ligá-la guardando o contrato de novo).`):`Deixar de repetir “${esc(r.name)}”? Os movimentos já criados ficam.`,()=>{
    if(r.auto){const c=contract((r.tx||{}).contractId);if(c)c.autoRec=false;
      if(isLoan)db.properties.forEach(p=>(p.loans||[]).forEach(l=>{if(l.id===r.tx.loanId)l.autoRec=false}))}
    db.recurring=db.recurring.filter(x=>x.id!==id);save();closeAllModals();buildNav();render();toast('Movimento recorrente apagado.');
  });
}
function delTpl(id){
  const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
  confirmModal('Apagar modelo',`Apagar o modelo “${esc(x.name)}”?`,()=>{db.templates=db.templates.filter(y=>y.id!==id);save();closeAllModals();render();toast('Modelo apagado.')});
}
function applyTemplate(x){
  if(!x)return;
  const keep={id:tForm.id,date:tForm.date,_edit:tForm._edit,_saver:tForm._saver,_recId:tForm._recId,_recNew:tForm._recNew,_every:tForm._every,_recEnd:tForm._recEnd,_until:tForm._until,_tplId:tForm._tplId,_tplNew:tForm._tplNew,_tplName:tForm._tplName};
  tForm=normTx(Object.assign({},JSON.parse(JSON.stringify(x.tx))));Object.assign(tForm,keep);
  if(tForm.amount)tForm._aA=tForm.amount;
  repaintTx();toast('Modelo aplicado.');
}
function newFromTemplate(id){const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;closeAllModals();txModal(null,x.tx.kind,x.tx.propertyId,null,x.tx.contractId,JSON.parse(JSON.stringify(x.tx)))}
/* cartão dos movimentos em atraso / por confirmar */
let pendAll=false;
function pendingCard(all){
  pendAll=!!all;   // para o colapso se redesenhar com a mesma lista
  const pend=all?recPending():recActive();
  if(!pend.length)return '';
  const row=(r)=>{const late=recIsLate(r);return `<div class="card tap pend ${late?'late':''}" style="padding:11px 13px" onclick="confirmRec('${r.id}')">
    <div class="row-between" style="align-items:center">
      <div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</b>
        <span class="small">${esc(r.next)}${r.until&&r.until!==r.next?' – '+esc(r.until):''}${EVERY[r.every]?' · '+esc(EVERY[r.every]):''}${r.muted?' · silenciada':late?' · <b class="neg">em atraso</b>':''} · ${(KIND[r.tx.kind]||{}).short}${r.tx.propertyId?' · '+esc(propName(r.tx.propertyId)):''}</span></div>
      <b style="flex:0 0 auto">${r.tx.amount?euro2(r.tx.amount):''}</b></div>
    <div class="toolbar" style="margin:9px 0 0">
        <button class="btn sm primary" onclick="${stop}quickConfirmRec('${r.id}')">${ic('check',14)} Confirmar</button>
        <button class="btn sm" onclick="${stop}skipRec('${r.id}')">${r.muted?'Reativar':'Silenciar'}</button></div></div>`};
  const nl=pend.filter(recIsLate).length,open=!pendShut();
  return `<div class="card" id="pendCard" style="margin-bottom:14px">
    <div class="row-between tap" style="align-items:center;cursor:pointer;margin:-16px;padding:16px" onclick="pendToggle()">
      <div style="min-width:0"><div class="title">Movimentos por confirmar</div>
        <div class="small">${pend.length} à espera${nl?' · <b class="neg">'+nl+' em atraso</b>':''} · ${euro(sum(pend.map(r=>r.tx.amount||0)))}${open?'':' · toca para ver'}</div></div>
      <span style="flex:0 0 auto;display:inline-flex;transform:rotate(${open?'90':'-90'}deg);transition:transform .15s">${ic('chev',20)}</span></div>
    ${open?`<div class="list" style="gap:8px;margin-top:12px">${pend.map(row).join('')}</div>
    <div class="hint" style="margin-top:9px">Confirmar regista o movimento e agenda o seguinte. Silenciar deixa-o à espera, sem avisos.</div>`:''}</div>`;
}
/* Fechado por omissão, e a escolha fica no aparelho.

   A vista geral existe para se ver o património de relance. Com a lista
   aberta, quatro movimentos por confirmar ocupavam 600 dos 900px de um
   ecrã de computador — e o telemóvel inteiro — antes de aparecer um único
   indicador. O que é preciso saber (quantos esperam, quantos em atraso)
   cabe no cabeçalho; a lista abre-se com um toque de quem a quer.

   Guarda-se '0' explícito quando se abre, para distinguir "nunca mexeu"
   de "quis aberto". */
const PEND_LS='gi_pend_shut';
function pendShut(){try{return localStorage.getItem(PEND_LS)!=='0'}catch(e){return true}}
function pendToggle(){
  try{localStorage.setItem(PEND_LS,pendShut()?'0':'1')}catch(e){}
  const e=document.getElementById('pendCard');
  if(!e)return render();
  e.outerHTML=pendingCard(pendAll);
}
/* página das recorrências e modelos */
function vRecurring(){
  const K='lrec',s=lf(K);
  const hit=(name,tx)=>lfHit(K,[name,tx.label,tx.category,tx.sub,tx.creditor,propName(tx.propertyId),String(tx.amount||''),(tx.tags||[]).join(' '),tx.notes].join(' '));
  const base=r=>((!s.k||r.tx.kind===s.k)&&(!s.p||r.tx.propertyId===s.p)&&hit(r.name,r.tx));
  const rc=(db.recurring||[]).filter(r=>{
    if(!base(r))return false;
    if(s.st==='pend'&&!(r.next&&r.next<=today()&&!r.muted))return false;
    if(s.st==='ok'&&!(r.next&&r.next>today()))return false;
    if(s.st==='muted'&&!r.muted)return false;
    if(s.st==='auto'&&!r.auto)return false;
    if(s.st==='manual'&&r.auto)return false;
    return true;
  }).sort((a,b)=>String(a.next).localeCompare(String(b.next)));
  const rcS=lfSort(K,rc,{nome:r=>r.name,valor:r=>r.tx.amount||0,data:r=>r.next||''});
  const tp=lfSort(K,(db.templates||[]).filter(x=>(!s.k||x.tx.kind===s.k)&&(!s.p||x.tx.propertyId===s.p)&&(!s.st||s.st==='manual')&&hit(x.name,x.tx)),
    {nome:x=>x.name,valor:x=>x.tx.amount||0,data:()=>0});
  const kinds=[{v:'',label:'Todos os tipos'},{v:'income',label:'Receitas'},{v:'expense',label:'Despesas'},{v:'loan',label:'Pagamentos de crédito'},{v:'owed',label:'Dívidas recebidas'},{v:'repay',label:'Pagamentos de dívida'}];
  const head=lfBar(K,[lfSel(K,'k',kinds),lfSel(K,'p',lfPropOpts()),
      lfSel(K,'st',[{v:'',label:'Todos os estados'},{v:'pend',label:'Por confirmar'},{v:'ok',label:'Em dia'},{v:'muted',label:'Silenciados'},{v:'auto',label:'Automáticos (contratos e hipotecas)'},{v:'manual',label:'Criados à mão'}])],
      rc.length+tp.length,
      {defLabel:'Ordenar pela próxima data',opts:[{v:'data',label:'Ordenar por data'},{v:'valor',label:'Ordenar por valor'},{v:'nome',label:'Ordenar por nome'}]})
    +fab([{label:'Novo mov. recorrente',icon:'clock',act:'newRec()'},{label:'Novo modelo',icon:'file',act:'newTpl()'}]);
  const recs=rcS.length?`<div class="list" style="gap:8px">${rcS.map(r=>{const late=recIsLate(r),pend=r.next<=today();return `<div class="card tap ${pend?'pend':''} ${late?'late':''}" data-lp="rec:${esc(r.id)}" onclick="editRec('${jsq(r.id)}')">
      <div class="row-between" style="align-items:center">
        <div style="min-width:0"><div class="title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</div>
          <div class="small">${r.auto?'<span class="badge grey" style="margin-right:4px">'+((r.tx||{}).loanId?'da hipoteca':'do contrato')+'</span>':''}${esc(EVERY[r.every]||r.every)} · ${esc(r.next)}${r.until&&r.until!==r.next?' – '+esc(r.until):''} · ${pend?(r.muted?'silenciada · por confirmar':late?'<b class="neg">em atraso</b>':'<b class="amber">por confirmar</b>'):'em dia'}${r.end?' · termina '+esc(r.end):''}</div>
          <div class="small">${(KIND[r.tx.kind]||{}).short}${r.tx.propertyId?' · '+esc(propName(r.tx.propertyId)):''}${r.tx.category?' · '+esc(r.tx.category):''}</div></div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
          <b style="font-size:16px">${r.tx.amount?euro2(r.tx.amount):'—'}</b>${kebab('rec:'+r.id)}</div></div></div>`}).join('')}</div>`
    :`<div class="empty" style="padding:24px"><b>${lfCount('lrec')?'Nada neste filtro':'Sem movimentos recorrentes'}</b>${lfCount('lrec')?'':'Repete-se sozinho e pede confirmação todos os meses. As rendas e as prestações criam um sem tu fazeres nada.'}</div>`;
  const tpls=tp.length?`<div class="list" style="gap:8px">${tp.map(x=>`<div class="card tap" data-lp="tpl:${esc(x.id)}" onclick="editTpl('${jsq(x.id)}')">
      <div class="row-between" style="align-items:center">
        <div style="min-width:0"><div class="title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name)}</div>
          <div class="small">${(KIND[x.tx.kind]||{}).short}${x.tx.propertyId?' · '+esc(propName(x.tx.propertyId)):''}${x.tx.category?' · '+esc(x.tx.category):''}</div></div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
          <b style="font-size:16px">${x.tx.amount?euro2(x.tx.amount):'—'}</b>${kebab('tpl:'+x.id)}</div></div></div>`).join('')}</div>`
    :`<div class="empty" style="padding:24px"><b>${lfCount('lrec')?'Nada neste filtro':'Sem modelos'}</b>${lfCount('lrec')?'':'Um modelo é um movimento guardado para copiar à mão quando precisares.'}</div>`;
  return head+pendingCard(true)+`<div class="section-title">Movimentos recorrentes</div>${recs}<div class="section-title" style="margin-top:18px">Modelos</div>${tpls}`;
}
/* secção do formulário: guardar como modelo e repetir */
function recSect(){
  const t=tForm,every=t._every||'month';
  const body=`
    <label>Repetir${sel('t_every',every,Object.keys(EVERY).map(k=>({v:k,label:EVERY[k]})))}</label>
    <div class="row">
      <label>Entre<input id="t_date" type="date" value="${esc(t.date)}"></label>
      <label>e<input id="t_until" type="date" value="${t._until||''}"></label></div>
    <label>Até (deixa de se repetir; opcional)<input id="t_recEnd" type="date" value="${t._recEnd||''}"></label>
    <div class="hint">Entra por confirmar no primeiro dia; passado o segundo sem confirmares, fica em atraso.</div>`;
  return fold('rec','Datas e repetição',body,{icon:'clock',open:true,summary:EVERY[every]});
}
