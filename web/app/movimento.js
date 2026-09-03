/* ================= MOVIMENTO ================= */
let tForm={};
/* preset: valores iniciais (vindos dos filtros ou de um botão "Pagar") */
function txModal(id,kind,propId,_x,ctId,preset){
  foldState={};
  tForm=id?normTx(JSON.parse(JSON.stringify(db.transactions.find(x=>x.id===id)))):
    normTx(Object.assign({kind:kind||'income',date:today(),amount:'',propertyId:propId||(db.properties.length===1?db.properties[0].id:null),contractId:ctId||null,split:null},preset||{}));
  if(tForm.contractId&&!tForm.propertyId){const c=contract(tForm.contractId);if(c)tForm.propertyId=c.propertyId}
  tForm._edit=!!id;
  if(!id&&tForm.amount){tForm._aA=tForm.amount}
  prefill();
  const m=id?menu('tx',[{label:'Apagar movimento',icon:'trash',danger:true,act:`delTx('${id}')`}]):'';
  openModal((id?'Editar ':txNewWord(tForm.kind))+txTypeName(tForm.kind),txBody(),null,m);
  tForm._saver=()=>{
    collectTx();
    if(!tForm.label.trim())return falhaCampo('t_label','Escreve uma descrição.');
    if(!(tForm.amount>0))return falhaCampo('t_amount','Indica um montante.');
    if(tForm.kind==='settle'){
      if(!tForm.propertyId)return toast('Um acerto é sempre de um imóvel.');
      if(!tForm.paidBy||!tForm.toId)return toast('Indica quem paga e quem recebe.');
      if(tForm.paidBy===tForm.toId)return toast('Quem paga e quem recebe têm de ser pessoas diferentes.');
    }
    const se=splitError();if(se)return toast(se);
    const pe=psplitError();if(pe)return toast(pe);
    if(tForm.kind==='loan'&&tForm.loanId&&tForm.principal!=null){
      const lV=findLoan(prop(tForm.propertyId),tForm.loanId);
      if(tForm.payType!=='amortizacao'){
        if(Number(tForm.interest)<0||Number(tForm.stamp)<0||Number(tForm.principal)<0)return toast('Juros e selo ultrapassam o montante: baixa os juros na tabela da distribuição.');
        const s=r2(Number(tForm.interest||0)+Number(tForm.stamp||0)+Number(tForm.principal||0));
        if(Math.abs(s-tForm.amount)>0.011)return toast('Juros, selo e capital têm de somar o montante ('+euro2(tForm.amount)+').');
      }
      if(lV){const av=loanAvail(tForm,lV);
        if(Number(tForm.principal)>av+0.011)return toast('Só faltam '+euro2(av)+' pagar nesta hipoteca — não podes amortizar mais do que isso.');
        if(!tForm._edit&&!(Number(lV.outstanding)>0))return toast('Esta hipoteca já está paga: não é possível associar novos pagamentos.');}
    }
    if(tForm._recId||tForm._recNew){   /* recorrência: só ela muda; não cria movimentos */
      const every=val('t_every')||'month',recEnd=val('t_recEnd')||'';let until=val('t_until')||'';if(until&&until<tForm.date)until='';
      if(tForm._recNew){db.recurring=db.recurring||[];db.recurring.push(normRec({name:tForm.label,every,next:tForm.date,until,end:recEnd,tx:txSnapshot(tForm)}))}
      else{const r=(db.recurring||[]).find(x=>x.id===tForm._recId);if(r){r.tx=txSnapshot(tForm);r.name=tForm.label;r.every=every;r.next=tForm.date;r.until=until;r.end=recEnd}}
      save();closeModal();buildNav();render();toast(tForm._recNew?'Movimento recorrente criado.':'Movimento recorrente atualizado.');return;
    }
    if(tForm._tplId||tForm._tplNew){
      const name=val('t_tplName').trim()||tForm.label,also=!!tForm._alsoTx;
      if(tForm._tplNew){db.templates=db.templates||[];db.templates.push(normTpl({name,tx:txSnapshot(tForm)}))}
      else{const x=(db.templates||[]).find(y=>y.id===tForm._tplId);if(x){x.name=name;x.tx=txSnapshot(tForm)}}
      if(also){const tx=normTx(txSnapshot(tForm));tx.date=tForm.date||today();if(tx.kind==='loan')applyLoan(tx);db.transactions.push(tx)}
      save();closeModal();buildNav();render();toast(tForm._tplNew?(also?'Modelo criado e movimento registado.':'Modelo criado.'):'Modelo atualizado.');return;
    }
    /* sincronizar com a hipoteca: ao editar, repõe-se primeiro o capital do registo antigo;
       depois aplica-se a distribuição atual (criação ou edição) */
    if(id){
      const old=db.transactions.find(x=>x.id===tForm.id);
      if(old&&old.kind==='loan'&&old.principal){
        const l0=findLoan(prop(old.propertyId),old.loanId);
        if(l0)l0.outstanding=Math.round((l0.outstanding+old.principal)*100)/100;
      }
    }
    if(tForm.kind==='loan')applyLoan(tForm);
    const recId=tForm._recConfirm;
    Object.keys(tForm).forEach(k=>{if(k[0]==='_')delete tForm[k]});
    const i=db.transactions.findIndex(x=>x.id===tForm.id);
    if(i<0)db.transactions.push(tForm);else db.transactions[i]=tForm;
    if(recId){const r=(db.recurring||[]).find(x=>x.id===recId);if(r)recAdvance(r)}
    save();closeModal();buildNav();render();refreshDetail();toast(recId?'Movimento confirmado.':'Movimento guardado.');
  };
  onSave=tForm._saver;
}
function prefill(){
  const p=prop(tForm.propertyId);
  const ows=p?ownersOfProp(p):(tForm.groupId?txGroupOwners(tForm).map(o=>o.id):db.owners.map(o=>o.id));
  if(tForm.paidBy&&ows.indexOf(tForm.paidBy)<0)tForm.paidBy=null;
  if(tForm.toId&&ows.indexOf(tForm.toId)<0)tForm.toId=null;
  if(tForm.kind==='settle'&&!tForm.label)tForm.label='Transferência entre proprietários';
  /* imóvel com um só proprietário: os movimentos dele ficam com esse proprietário por defeito */
  if(p&&!tForm.paidBy&&tForm.kind!=='settle'){const os=ownersOfProp(p);if(os.length===1)tForm.paidBy=os[0]}
  /* a hipoteca fica associada mesmo que o montante já esteja escrito — só a sugestão de valores é que é saltada */
  if(tForm.kind==='loan'&&p&&!tForm._edit){
    const ls=liveLoans(p);
    if((!tForm.loanId||!findLoan(p,tForm.loanId))&&ls.length)tForm.loanId=ls[0].id;
  }
  if(tForm.amount)return;
  const set=(a,l)=>{tForm.amount=Math.round(a*100)/100;tForm._aA=tForm.amount;if(!tForm.label){tForm.label=l;tForm._aL=l}};
  if(tForm.kind==='income'&&p){
    const c=tForm.contractId?contract(tForm.contractId):null;
    if(c)set(c.rent,'Renda '+ctName(c));
    else{const ac=activeContracts(p.id);if(ac.length===1)set(ac[0].rent,'Renda '+ctName(ac[0]))}
  }
  if(tForm.kind==='loan'&&p){
    const l=tForm.loanId?findLoan(p,tForm.loanId):null;
    if(l)set(loanCalc(l).total,'Prestação '+(l.name?l.name+' · ':'')+p.name);
  }
}
function keepTyped(){collectTx();if(tForm.label===tForm._aL)tForm.label='';if(tForm.amount===tForm._aA)tForm.amount=''}
const SPLIT_MODES=[['equal','Partes iguais','o mesmo para cada proprietário'],['quota','Quotas do imóvel','pela quota-parte de cada um'],['pct','Quotas a definir','em partes: quem tem 2 paga o dobro de quem tem 1 (2 e 1 → 2/3 e 1/3)'],['percent','Percentagem','percentagem de cada um; devem somar 100'],['amount','Valor certo','montante de cada um; têm de somar o total'],['adjust','Ajuste','quem tem valor paga só esse; o resto divide-se em partes iguais pelos outros']];
function txBody(){
  const t=tForm,p=prop(t.propertyId),acs=t.propertyId?activeContracts(t.propertyId):[];
  const lns=liveLoans(p);
  const curLoan=t.kind==='loan'&&t.loanId?findLoan(p,t.loanId):null;
  const lnOpts=lns.map(l=>({v:l.id,label:loanName(l)+' · '+euro(l.outstanding)}))
    .concat(curLoan&&!(Number(curLoan.outstanding)>0)?[{v:curLoan.id,label:loanName(curLoan)+' · liquidada'}]:[]);
  /* sem imóvel, a despesa pode na mesma ser paga por alguém; num grupo, pelos donos dos imóveis do grupo */
  const ows=(p?ownersOfProp(p).map(owner):(t.groupId?txGroupOwners(t):db.owners.map(o=>o.id).map(owner))).filter(Boolean);
  const cs=catsFor(t.kind)||{},subs=(cs[t.category]||[]).slice();
  if(t.sub&&subs.indexOf(t.sub)<0)subs.unshift(t.sub);
  const catKeys=Object.keys(cs);if(t.category&&catKeys.indexOf(t.category)<0)catKeys.unshift(t.category);
  const credit=t.kind==='owed'||t.kind==='repay',settle=t.kind==='settle';
  const owOpts=[{v:'',label:'Todos os proprietários'}].concat(ows.map(o=>({v:o.id,label:o.name})));
  const cred=creditorBalances(t.propertyId||null).find(r=>r.creditor===(t.creditor||'').trim());
  const catSum=[t.category,t.sub].filter(Boolean).join(' / ')+((t.tags||[]).length?(t.category?' · ':'')+t.tags.length+' etiqueta'+(t.tags.length===1?'':'s'):'');
  return `<div class="form">
    ${(t._tplId||t._tplNew)?`<label>Nome do modelo<input id="t_tplName" value="${esc(t._tplName||'')}" placeholder="Ex.: Renda mensal T2" autocomplete="off"></label>`:''}
    ${credit?`<div class="seg c2">${[['owed','users','Recebida','alguém me emprestou'],['repay','down','Paga','devolvo a essa pessoa']].map(([k,i,l,sb])=>`<button type="button" class="opt ${t.kind===k?'on':''}" onclick="setKind('${k}')"><span class="ic">${ic(i,18)}</span><b>${l}</b><small>${sb}</small></button>`).join('')}</div>`:''}
    <label>Descrição <span class="req">*</span><input id="t_label" value="${esc(t.label)}" placeholder="${t.kind==='income'?'Renda de agosto':t.kind==='loan'?'Prestação de agosto':t.kind==='owed'?'Empréstimo para obras':t.kind==='repay'?'Devolução de parte do empréstimo':t.kind==='settle'?'Acerto entre proprietários':'Condomínio'}" autocomplete="off"></label>
    <div class="row">
      <label>Montante (€) <span class="req">*</span><div style="display:flex;gap:7px;align-items:center">
        <input id="t_amount" type="text" inputmode="decimal" style="flex:1;min-width:0" value="${t.amount||''}" placeholder="900" oninput="tForm.amount=num(this.value);refreshLoanHint();refreshSplit();amtResetSync()">
        <button type="button" class="btn sm primary" id="amt_reset" style="flex:0 0 auto;padding:9px 12px;display:${calcLoanTotal()!=null&&Math.abs((num(t.amount)||0)-calcLoanTotal())>0.011?'':'none'}" title="Repor a prestação calculada" onclick="onAmtReset()">Repor</button></div></label>
      ${(t._recId||t._recNew)?'<span></span>':`<label>Data<input id="t_date" type="date" value="${esc(t.date)}"></label>`}</div>
    <label>Imóvel${sel('t_prop',t.propertyId||(t.groupId?'g:'+t.groupId:''),[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p2=>({v:p2.id,label:p2.name}))).concat(gdiv(gOpts('prop'))),'onPropChange')}</label>
    ${t.kind==='income'&&acs.length?`<label>Contrato${sel('t_ct',t.contractId||'',[{v:'',label:'Todos os contratos'}].concat(acs.map(c=>({v:c.id,label:ctName(c)}))),'onCtChange')}</label>`:''}
    ${t.kind==='loan'&&lnOpts.length?`<label>Hipoteca${sel('t_loan',t.loanId||'',lnOpts,'onLoanChange')}</label>`:''}
    ${credit?`<label>${t.kind==='owed'?'De quem recebo':'A quem pago'}<input id="t_creditor" value="${esc(t.creditor||'')}" placeholder="Pai, amigo, empreiteiro…" autocomplete="off" list="creditorList" oninput="refreshCredHint()">
        <datalist id="creditorList">${knownCreditors().map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>
      <div class="hint" id="credHint">${credHint()}</div>`:''}
    ${settle?(ows.length>1?`<div class="row">
        <label>Quem paga${sel('t_paid',t.paidBy||'',owOpts)}</label>
        <label>Quem recebe${sel('t_to',t.toId||'',owOpts)}</label></div>
      <div class="hint">Transferência entre proprietários deste imóvel: acerta as contas entre donos e não conta como receita nem despesa.</div>`
      :`<div class="hint">Escolhe um imóvel com pelo menos dois proprietários.</div>`)
    :(ows.length?`<label>${isIn(t.kind)?'Recebido por':'Pago por'}${sel('t_paid',t.paidBy||'',owOpts)}</label>`:'')}
    <div id="loanHint">${loanHint()}</div>
    ${settle?'':fold('cat','Categoria e etiquetas',`<div class="${subs.length||t.category?'row':''}">
      <label>Categoria${sel('t_cat',t.category,[{v:'',label:'— sem categoria —'}].concat(catKeys.map(c=>({v:c,label:c}))).concat([{v:'__new__',label:'+ Criar categoria…'}]),'onCatChange')}</label>
      ${subs.length||t.category?`<label>Subcategoria${sel('t_sub',t.sub,[{v:'',label:'— indiferente —'}].concat(subs.map(x=>({v:x,label:x}))).concat([{v:'__new__',label:'+ Criar subcategoria…'}]),'onSubChange')}</label>`:''}</div>
      <div><div class="flabel">Etiquetas</div>${tagField((t.tags||[]).map(g=>({id:g,label:g})),'Adicionar','addTxTag()','delTxTag','grey')}</div>`,
      {icon:'tag',open:!!(t.category||(t.tags||[]).length),summary:catSum||'sem categoria'})}
    ${(!settle&&t.groupId&&txProps(t).length>1)?psplitSect():''}
    ${(!settle&&!credit&&ows.length>1)?splitSect(ows):''}
    ${credit&&ows.length>1?`<div class="hint">Dívidas a terceiros não entram nas contas entre proprietários: ficam com quem as recebe ou paga.</div>`:''}
    ${(t._recId||t._recNew)?recSect():''}
    ${richEditor('Comentários','t_notes',t.notes)}</div>`;
}
function credHint(){
  const t=tForm,name=(t.creditor||'').trim();
  if(!name)return t.kind==='owed'?'Não precisa de ficha: escreve o nome. Estas dívidas ficam fora da conta de exploração do imóvel.':'Escreve a quem estás a devolver o dinheiro.';
  const r=creditorBalances(t.propertyId||null).find(x=>x.creditor===name);
  if(!r)return t.kind==='owed'?'Primeira dívida a '+esc(name)+'.':'Não há dívida registada a '+esc(name)+' neste imóvel.';
  return `Recebido de ${esc(name)}: ${euro2(r.received)} · devolvido ${euro2(r.repaid)} · <b>${r.due>0.005?'em dívida '+euro2(r.due):'liquidado'}</b>`;
}
function refreshCredHint(){const e=document.getElementById('credHint');if(e){tForm.creditor=val('t_creditor');e.innerHTML=credHint()}}
/* divisão entre proprietários: quotas, percentagem, valor certo ou ajuste */
function splitSect(ows){
  const t=tForm,sp=t.split||{mode:'quota',parts:{}},mode=sp.mode||'quota',parts=sp.parts||{};
  const lab=(SPLIT_MODES.find(m=>m[0]===mode)||[])[1]||'';
  return fold('split','Divisão entre proprietários',`
    <label>Como se divide${sel('t_split',mode,SPLIT_MODES.map(m=>({v:m[0],label:m[1]})),'onSplitSel')}</label>
    ${(mode==='quota'||mode==='equal')?'':`<div class="form" style="gap:7px">${ows.map(o=>`<div class="ownrow"><span class="avatar" style="width:30px;height:30px;font-size:11px;flex:0 0 30px">${esc(initials(o.name))}</span>
      <span class="nm">${esc(o.name)}</span>
      <input id="t_sp_${o.id}" type="text" inputmode="decimal" style="width:84px;flex:0 0 84px" value="${parts[o.id]!=null&&parts[o.id]!==''?dec(parts[o.id]):''}" placeholder="${mode==='adjust'?'—':'0'}" oninput="refreshSplit()">
      <span class="pc">${mode==='pct'?'partes':mode==='percent'?'%':'€'}</span></div>`).join('')}</div>`}
    <div class="hint" id="splitHint">${splitHint(ows)}</div>`,{icon:'split',summary:lab});
}
function splitHint(ows){
  const t=tForm,p=prop(t.propertyId);if(!p)return '';
  const mode=(t.split||{}).mode||'quota',total=Math.abs(Number(t.amount)||0);
  const intro=(t.paidBy?'':'Só entra nas contas entre proprietários se indicares quem pagou ou recebeu. ')+((SPLIT_MODES.find(m=>m[0]===mode)||[])[2]||'')+'.';
  if(!total)return intro;
  const os=ows.map(o=>o.id),c=txSplitCents(t,p,os);
  let warn='';
  if(mode==='amount'){const s2=sum(os.map(o=>Number(((t.split||{}).parts||{})[o])||0)),d=Math.round((total-s2)*100)/100;
    if(Math.abs(d)>0.005)warn=`<b class="neg">${d>0?'Faltam '+euro2(d):'Passa '+euro2(-d)}</b> · `}
  if(mode==='percent'){const s2=sum(os.map(o=>Number(((t.split||{}).parts||{})[o])||0));
    if(Math.abs(s2-100)>0.01)warn=`<b class="neg">Somam ${dec(Math.round(s2*100)/100)}%</b> · `}
  if(mode==='adjust'){const s2=sum(os.map(o=>Number(((t.split||{}).parts||{})[o])||0));
    if(s2>total+0.005)warn=`<b class="neg">Os ajustes passam o total</b> · `}
  return warn+intro+'<br>'+ows.map((o,i)=>`${esc(o.name.split(' ')[0])} <b>${euro2(c[i]/100)}</b>`).join(' · ');
}
function splitError(){
  const t=tForm,p=prop(t.propertyId),mode=(t.split||{}).mode;
  if(!p||!mode||mode==='quota'||mode==='equal')return '';
  const os=ownersOfProp(p),parts=(t.split||{}).parts||{},total=Math.abs(Number(t.amount)||0);
  const s2=sum(os.map(o=>Number(parts[o])||0));
  if(mode==='amount'&&Math.abs(s2-total)>0.005)return 'Os valores da divisão têm de somar '+euro2(total)+'.';
  if(mode==='adjust'&&s2>total+0.005)return 'Os ajustes não podem passar o total.';
  if(mode==='pct'&&!(s2>0))return 'Indica pelo menos uma quota.';
  if(mode==='percent'&&Math.abs(s2-100)>0.01)return 'As percentagens têm de somar 100 (somam '+dec(Math.round(s2*100)/100)+').';
  return '';
}
function collectSplit(){
  const t=tForm,mode=(t.split||{}).mode;
  if(document.getElementById('t_split'))t.split=Object.assign({},t.split||{},{mode:val('t_split')||'quota'});
  const m2=(t.split||{}).mode;
  if(!m2||m2==='quota'){t.split=null;return}
  if(m2==='equal'){t.split={mode:'equal',parts:{}};return}
  const p=prop(t.propertyId),parts={};
  const os=p?ownersOfProp(p):(t.groupId?txGroupOwners(t).map(o=>o.id):db.owners.map(o=>o.id));
  os.forEach(o=>{const e=document.getElementById('t_sp_'+o);if(e&&String(e.value).trim()!=='')parts[o]=num(e.value)});
  t.split={mode,parts};
}
/* divisão do valor pelos imóveis do grupo */
const PSPLIT_MODES=[['equal','Partes iguais','o mesmo para cada imóvel'],['value','Pelo valor de mercado','proporcional ao valor atual'],['purchase','Pelo valor de aquisição','proporcional ao que custou'],['pct','Quotas a definir','em partes: 2 e 1 → 2/3 e 1/3'],['percent','Percentagem','de cada imóvel; devem somar 100'],['amount','Valor certo','montante de cada imóvel; têm de somar o total'],['adjust','Ajuste','quem tem valor fica só com esse; o resto em partes iguais']];
function psplitSect(){
  const t=tForm,ps=txProps(t),sp=t.psplit||{mode:'equal',parts:{}},mode=sp.mode||'equal',parts=sp.parts||{};
  const lab=(PSPLIT_MODES.find(m=>m[0]===mode)||[])[1]||'';
  return fold('psplit','Divisão entre imóveis',`
    <label>Como se divide${sel('t_psplit',mode,PSPLIT_MODES.map(m=>({v:m[0],label:m[1]})),'onPsplitSel')}</label>
    ${['equal','value','purchase'].indexOf(mode)>-1?'':`<div class="form" style="gap:7px">${ps.map(p=>`<div class="ownrow"><span class="avatar" style="width:30px;height:30px;font-size:11px;flex:0 0 30px">${ic('building',15)}</span>
      <span class="nm">${esc(p.name)}</span>
      <input id="t_pp_${p.id}" type="text" inputmode="decimal" style="width:84px;flex:0 0 84px" value="${parts[p.id]!=null&&parts[p.id]!==''?dec(parts[p.id]):''}" placeholder="${mode==='adjust'?'—':'0'}" oninput="refreshPsplit()">
      <span class="pc">${mode==='pct'?'partes':mode==='percent'?'%':'€'}</span></div>`).join('')}</div>`}
    <div class="hint" id="psplitHint">${psplitHint()}</div>`,{icon:'building',open:true,summary:lab});
}
function psplitHint(){
  const t=tForm,ps=txProps(t);if(ps.length<2)return '';
  const mode=(t.psplit||{}).mode||'equal',total=Math.abs(Number(t.amount)||0);
  const intro=((PSPLIT_MODES.find(m=>m[0]===mode)||[])[2]||'')+'.';
  if(!total)return intro;
  const c=psplitCents(t,ps,Math.round(total*100));
  let warn='';
  const s2=sum(ps.map(p=>Number(((t.psplit||{}).parts||{})[p.id])||0));
  if(mode==='amount'){const d=Math.round((total-s2)*100)/100;if(Math.abs(d)>0.005)warn=`<b class="neg">${d>0?'Faltam '+euro2(d):'Passa '+euro2(-d)}</b> · `}
  if(mode==='percent'&&Math.abs(s2-100)>0.01)warn=`<b class="neg">Somam ${dec(Math.round(s2*100)/100)}%</b> · `;
  if(mode==='adjust'&&s2>total+0.005)warn=`<b class="neg">Os ajustes passam o total</b> · `;
  return warn+intro+'<br>'+ps.map((p,i)=>`${esc(p.name)} <b>${euro2(c[i]/100)}</b>`).join(' · ');
}
function psplitError(){
  const t=tForm;if(!t.groupId)return '';
  const ps=txProps(t),mode=(t.psplit||{}).mode;
  if(ps.length<2||!mode||['equal','value','purchase'].indexOf(mode)>-1)return '';
  const parts=(t.psplit||{}).parts||{},total=Math.abs(Number(t.amount)||0);
  const s2=sum(ps.map(p=>Number(parts[p.id])||0));
  if(mode==='amount'&&Math.abs(s2-total)>0.005)return 'Os valores por imóvel têm de somar '+euro2(total)+'.';
  if(mode==='adjust'&&s2>total+0.005)return 'Os ajustes por imóvel não podem passar o total.';
  if(mode==='pct'&&!(s2>0))return 'Indica pelo menos uma quota de imóvel.';
  if(mode==='percent'&&Math.abs(s2-100)>0.01)return 'As percentagens por imóvel têm de somar 100 (somam '+dec(Math.round(s2*100)/100)+').';
  return '';
}
function collectPsplit(){
  const t=tForm;
  if(!t.groupId){t.psplit=null;return}
  if(document.getElementById('t_psplit'))t.psplit=Object.assign({},t.psplit||{},{mode:val('t_psplit')||'equal'});
  const mode=(t.psplit||{}).mode||'equal',parts={};
  txProps(t).forEach(p=>{const e=document.getElementById('t_pp_'+p.id);if(e&&String(e.value).trim()!=='')parts[p.id]=num(e.value)});
  t.psplit={mode,parts};
}
function onPsplitSel(){collectTx();tForm.psplit={mode:val('t_psplit')||'equal',parts:(tForm.psplit||{}).parts||{}};repaintTx()}
function refreshPsplit(){collectPsplit();const e=document.getElementById('psplitHint');if(e)e.innerHTML=psplitHint()}
function setSplitMode(m){collectTx();tForm.split=m==='quota'?null:{mode:m,parts:(tForm.split||{}).parts||{}};repaintTx()}
function onSplitSel(){setSplitMode(val('t_split')||'quota')}
function refreshSplit(){
  collectSplit();
  const e=document.getElementById('splitHint');if(!e)return;
  e.innerHTML=splitHint(ownersOfProp(prop(tForm.propertyId)||{}).map(owner).filter(Boolean));
}
function loanHint(){
  const t=tForm,p=prop(t.propertyId),l=t.loanId?findLoan(p,t.loanId):null;
  if(t.kind!=='loan')return'';
  if(!l)return `<div class="hint">Nenhuma hipoteca associada. Podes registar o pagamento na mesma, ou criar a hipoteca em Finanças → Créditos.</div>`;
  const avail=loanAvail(t,l);
  const c=loanCalc(Object.assign({},l,{outstanding:avail},t._edit?{_paidOfs:-1}:{})),rate=l.stampTax===false?0:stampPct();
  const fr=amortFeeRate(l,t.date),amort=t.payType==='amortizacao';
  const amt=num(t.amount)||(amort?0:c.total);
  const seg=`<div style="margin-bottom:10px"><div class="flabel">Tipo de pagamento</div>
    <div class="seg c2">
      <button type="button" class="opt ${!amort?'on':''}" onclick="setPayType('prestacao')"><span class="ic">${ic('bank',18)}</span><b>Prestação</b><small>juros, selo e capital</small></button>
      <button type="button" class="opt ${amort?'on':''}" onclick="setPayType('amortizacao')"><span class="ic">${ic('trend',18)}</span><b>Amortização</b><small>capital e comissão</small></button></div></div>`;
  if(amort){
    /* amortização antecipada: sem juros nem selo — só capital e a comissão definida na hipoteca */
    const cap=r2(amt/(1+fr)),fee=r2(amt-cap);
    t.interest=0;t.stamp=0;t.principal=cap;t.fee=fee;
    return seg+`<div class="card" style="background:var(--tint);padding:13px">
      <div class="stat" style="padding-top:0;align-items:center"><span>Abate ao capital</span><b class="pos" id="lh_cap">${euro2(cap)}</b></div>
      <div class="stat" style="border:0;align-items:center"><span>Comissão de amortização (${dec(r2(fr*100))}%)</span><b class="neg" id="lh_fee">${euro2(fee)}</b></div>
      <div class="hint" id="loanLeft">${cap>avail+0.011?`<b class="neg">Só faltam ${euro2(avail)} pagar — não podes amortizar mais do que isso.</b>`:`Ficam ${euro(Math.max(0,avail-Math.min(cap,avail)))} em dívida.`}</div></div>`;
  }
  /* prestação normal: juros editáveis, selo derivado, capital é o resto — sem comissão */
  const manual=t._splitTouched||t._edit;
  let int=manual&&t.interest!=null?Number(t.interest):r2(c.interest);
  let st=r2(int*rate),cap;
  if(manual&&t.principal!=null)cap=Number(t.principal);
  else cap=r2(amt-int-st);
  t.interest=int;t.stamp=st;t.principal=cap;t.fee=0;
  return seg+`<div class="card" style="background:var(--tint);padding:13px">
    <div class="row-between" style="align-items:center;margin-bottom:2px"><span class="small"><b>Distribuição do montante</b></span>
      <button class="btn sm" id="lh_reset" style="flex:0 0 auto;padding:6px 9px;display:${t._splitTouched?'':'none'}" onclick="onLoanReset()" title="Repor a prestação calculada na hipoteca">${ic('clock',14)} Repor</button></div>
    <div class="stat" style="align-items:center"><span>Juros (€)</span>
      <input class="statin" id="t_int" type="text" inputmode="decimal" value="${dec(int.toFixed(2))}" oninput="onLoanSplit('int')"></div>
    <div class="stat" style="align-items:center"><span>Imposto do selo (${dec(db.settings.stampPct??4)}%)</span><b id="lh_stamp">${euro2(st)}</b></div>
    <div class="stat" style="border:0;align-items:center"><span>Abate ao capital (€)</span>
      <input class="statin pos" id="t_cap" type="text" inputmode="decimal" value="${dec(Math.max(0,cap).toFixed(2))}" oninput="onLoanSplit('cap')"></div>
    <div class="hint" id="loanLeft">${loanLeftTxt(l,int,st,cap,0,amt,avail)}</div></div>`;
}
function loanLeftTxt(l,int,st,cap,fee,amt,avail){
  const sum=r2(int+st+cap+(fee||0));
  if(cap>avail+0.011)return `<b class="neg">Só faltam ${euro2(avail)} pagar — não podes amortizar mais do que isso.</b>`;
  if(cap<-0.005||fee<-0.005||int<-0.005||Math.abs(sum-amt)>0.011)return `<b class="neg">A soma da distribuição dá ${euro2(r2(int+st+Math.max(0,cap)+Math.max(0,fee||0)))}, mas o montante é ${euro2(amt)}.</b>`;
  return `Ficam ${euro(Math.max(0,avail-Math.min(cap,avail)))} em dívida.`;
}
function setPayType(v){
  const t=tForm;if(t.payType===v)return;
  t.payType=v;
  delete t.interest;delete t.stamp;delete t.principal;delete t.fee;delete t._splitTouched;
  refreshLoanHint();
}
/* prestação calculada na hipoteca para o movimento atual (null se não for uma prestação) */
function calcLoanTotal(){
  const t=tForm;if(!t||t.kind!=='loan'||t.payType==='amortizacao'||!t.loanId)return null;
  const p=prop(t.propertyId),l=p?findLoan(p,t.loanId):null;if(!l)return null;
  return r2(loanCalc(Object.assign({},l,{outstanding:loanAvail(t,l)},t._edit?{_paidOfs:-1}:{})).total);
}
function amtResetSync(){
  const b=document.getElementById('amt_reset');if(!b)return;
  const c=calcLoanTotal();
  b.style.display=(c!=null&&Math.abs((num(val('t_amount'))||0)-c)>0.011)?'':'none';
}
function onAmtReset(){
  const c=calcLoanTotal();if(c==null)return;
  tForm.amount=c;tForm._aA=c;
  const e=document.getElementById('t_amount');if(e)e.value=dec(c.toFixed(2));
  refreshLoanHint();refreshSplit();amtResetSync();
}
function onLoanReset(){
  const t=tForm,l=t.loanId?findLoan(prop(t.propertyId),t.loanId):null;
  delete t.interest;delete t.stamp;delete t.principal;delete t.fee;delete t._splitTouched;
  /* repor também o montante para a prestação calculada na hipoteca */
  if(l){const c=loanCalc(Object.assign({},l,{outstanding:loanAvail(t,l)},t._edit?{_paidOfs:-1}:{}));
    t.amount=r2(c.total);t._aA=t.amount;
    const e=document.getElementById('t_amount');if(e)e.value=dec(t.amount.toFixed(2));}
  refreshLoanHint();
}
/* editar juros ou capital numa prestação: o total mantém-se no montante e o selo deriva dos juros */
function onLoanSplit(w){
  const t=tForm,amt=num(val('t_amount'))||0;
  const l=t.loanId?findLoan(prop(t.propertyId),t.loanId):null;if(!l)return;
  const avail=loanAvail(t,l),rate=l.stampTax===false?0:stampPct();
  let int,st,cap;
  const put=(id,v)=>{const e=document.getElementById(id);if(e&&document.activeElement!==e)e.value=dec(v.toFixed(2))};
  if(w==='cap'){
    cap=num(val('t_cap'));
    const i0=Math.max(0,(amt-cap)/(1+rate));st=r2(i0*rate);int=r2(amt-cap-st);
    if(int<0){int=0;st=r2(Math.max(0,amt-cap))}
    put('t_int',int);
  }else{
    int=num(val('t_int'));st=r2(int*rate);cap=r2(amt-int-st);
    put('t_cap',Math.max(0,cap));
  }
  t.interest=int;t.stamp=st;t.principal=cap;t.fee=0;t._splitTouched=true;
  const rb=document.getElementById('lh_reset');if(rb)rb.style.display='';
  const e2=document.getElementById('lh_stamp');if(e2)e2.textContent=euro2(st);
  const e=document.getElementById('loanLeft');if(e)e.innerHTML=loanLeftTxt(l,int,st,cap,0,amt,avail);
}
function refreshLoanHint(){const e=document.getElementById('loanHint');if(e)e.innerHTML=loanHint();amtResetSync()}
function repaintTx(){const b=modalBodyEl();if(b)b.innerHTML=txBody()}
function setKind(k){keepTyped();
  if(treeKey(tForm.kind)!==treeKey(k)){tForm.category='';tForm.sub=''}
  tForm.kind=k;if(k!=='settle'&&tForm.label==='Transferência entre proprietários')tForm.label='';prefill();repaintTx();
  const h=modalTop()&&modalTop().el.querySelector('.head h2');if(h&&!tForm._recId&&!tForm._recNew&&!tForm._tplId&&!tForm._tplNew)h.textContent=(tForm._edit?'Editar ':txNewWord(k))+txTypeName(k)}
function onPropChange(){keepTyped();
  const v=val('t_prop')||'';
  tForm.groupId=String(v).startsWith('g:')?v.slice(2):null;
  tForm.propertyId=tForm.groupId?null:(v||null);
  tForm.contractId=null;tForm.loanId=null;tForm.split=null;
  delete tForm.interest;delete tForm.stamp;delete tForm.principal;
  tForm.psplit=tForm.groupId?{mode:'equal',parts:{}}:null;
  prefill();repaintTx()}
function onCtChange(){keepTyped();tForm.contractId=val('t_ct')||null;prefill();repaintTx()}
function onLoanChange(){keepTyped();tForm.loanId=val('t_loan')||null;delete tForm.interest;delete tForm.stamp;delete tForm.principal;prefill();repaintTx()}
function onCatChange(){
  collectTx();
  const v=val('t_cat');
  if(v==='__new__'){repaintTx();return promptModal('Nova categoria','Nome','',nm=>{
    const tr=catsFor(tForm.kind);if(tr&&!tr[nm])tr[nm]=[];
    save();tForm.category=nm;tForm.sub='';repaintTx();
    toast('Categoria criada.');
  })}
  tForm.category=v;tForm.sub='';repaintTx();
}
function onSubChange(){
  collectTx();
  const v=val('t_sub');
  if(v==='__new__'){repaintTx();return promptModal('Nova subcategoria','Nome','',nm=>{
    const tr=catsFor(tForm.kind)||{},l=tr[tForm.category]||(tr[tForm.category]=[]);
    if(l.indexOf(nm)<0)l.push(nm);
    save();tForm.sub=nm;repaintTx();
    toast('Subcategoria criada.');
  })}
  tForm.sub=v;
}
function collectTx(){
  const t=tForm;
  t.label=val('t_label');t.amount=num(val('t_amount'));t.date=val('t_date')||today();
  if(document.getElementById('t_prop')){const v=val('t_prop')||'';t.groupId=String(v).startsWith('g:')?v.slice(2):null;t.propertyId=t.groupId?null:(v||null)}
  if(document.getElementById('t_notes'))t.notes=richVal('t_notes');
  if(document.getElementById('t_loan'))t.loanId=val('t_loan')||null;
  if(t.kind==='loan'&&t.loanId){
    const l2=findLoan(prop(t.propertyId),t.loanId);
    if(l2&&t.payType==='amortizacao'){const fr=amortFeeRate(l2,t.date);t.principal=r2(t.amount/(1+fr));t.fee=r2(t.amount-t.principal);t.interest=0;t.stamp=0}
    else if(document.getElementById('t_int')){const sr=l2&&l2.stampTax===false?0:stampPct();
      t.interest=num(val('t_int'));t.principal=num(val('t_cap'));t.stamp=r2(t.interest*sr);t.fee=0;
      /* o resto vai para o capital para a soma bater certa ao cêntimo */
      const d=r2(t.amount-t.interest-t.stamp-t.principal);if(Math.abs(d)<=0.011&&d!==0)t.principal=r2(t.principal+d)}
  }
  if(document.getElementById('t_paid'))t.paidBy=val('t_paid')||null;
  if(document.getElementById('t_to'))t.toId=val('t_to')||null;
  if(t.kind!=='settle')t.toId=null;
  if(document.getElementById('t_creditor'))t.creditor=val('t_creditor');
  collectSplit();collectPsplit();
  if(document.getElementById('t_cat')){const v=val('t_cat');if(v!=='__new__')t.category=v}
  if(document.getElementById('t_sub')){const v=val('t_sub');if(v!=='__new__')t.sub=v}
  if(document.getElementById('t_ct'))t.contractId=val('t_ct')||null;
  if(document.getElementById('t_every'))t._every=val('t_every')||'';
  if(document.getElementById('t_tplName'))t._tplName=val('t_tplName');
  if(document.getElementById('t_until'))t._until=val('t_until')||'';
  if(document.getElementById('t_next'))t._next=val('t_next')||'';
  if(document.getElementById('t_recEnd'))t._recEnd=val('t_recEnd')||'';
}
function addTxTag(){
  collectTx();
  const free=(db.settings.tags||[]).filter(g=>(tForm.tags||[]).indexOf(g)<0);
  pickModal('Escolher etiqueta',free.map(g=>({v:g,label:g})),
    g=>{tForm.tags.push(g.v);closeModal();repaintTx()},
    `<button type="button" class="btn" style="width:100%;justify-content:center" onclick="newTagFromTx()">${ic('plus',15)} Criar etiqueta nova</button>
     <div class="hint" style="margin-top:8px">Podes gerir a lista em Definições → Etiquetas.</div>`);
}
function newTagFromTx(){
  closeModal();
  promptModal('Nova etiqueta','Nome','',nm=>{
    const l=db.settings.tags||(db.settings.tags=[]);
    if(l.indexOf(nm)<0)l.push(nm);
    if((tForm.tags||[]).indexOf(nm)<0)tForm.tags.push(nm);
    save();repaintTx();
    toast('Etiqueta criada e aplicada.');
  });
}
function delTxTag(g){collectTx();tForm.tags=(tForm.tags||[]).filter(x=>x!==g);repaintTx()}
function applyLoan(t){
  const p=prop(t.propertyId),l=t.loanId?findLoan(p,t.loanId):null;if(!l)return;
  /* amortização: capital + comissão da hipoteca; prestação: juros + selo + capital (sem comissão) */
  let int=Number(t.interest),st=Number(t.stamp),cap=Number(t.principal),fee=Number(t.fee||0);
  if(t.payType==='amortizacao'){
    const fr=amortFeeRate(l,t.date);
    if(!(isFinite(cap)&&isFinite(fee)&&cap>=0&&fee>=0&&Math.abs(cap+fee-t.amount)<=0.011)){cap=r2(t.amount/(1+fr));fee=r2(t.amount-cap)}
    int=0;st=0;
  }else if(!(isFinite(int)&&isFinite(st)&&isFinite(cap)&&int>=0&&st>=0&&cap>=0&&Math.abs(int+st+cap+(fee>0?fee:0)-t.amount)<=0.011)){
    const c=loanCalc(l);int=c.interest;st=c.stamp;fee=0;cap=Math.max(0,t.amount-int-st);
  }
  cap=Math.max(0,Math.min(l.outstanding,cap));
  t.interest=r2(int);t.stamp=r2(st);t.principal=r2(cap);t.fee=r2(fee);
  l.outstanding=Math.max(0,r2(l.outstanding-cap));
  /* recorrência automática desta hipoteca: acompanha a nova prestação e desaparece quando o crédito acaba */
  const ar=loanRecOf(l);
  if(ar){if(!(l.outstanding>0))db.recurring=db.recurring.filter(x=>x.id!==ar.id);
    else ar.tx.amount=Math.round(loanCalc(l).total*100)/100}
}
function delTx(id){
  /* sem confirmação, com Anular: é a eliminação mais frequente da app, e a
     pergunta constante ensinava o dedo a confirmar sem ler */
  const t=db.transactions.find(x=>x.id===id);if(!t)return;
  const copia=JSON.parse(JSON.stringify(t));
  if(t.kind==='loan'&&t.principal&&t.loanId){
    const l=findLoan(prop(t.propertyId),t.loanId);
    if(l){l.outstanding=Math.round((l.outstanding+t.principal)*100)/100;syncLoanRec(prop(t.propertyId),l)}
  }
  db.transactions=db.transactions.filter(x=>x.id!==id);save();closeAllModals();render();
  comDesfazer('Movimento apagado.',()=>{
    db.transactions.push(copia);
    if(copia.kind==='loan'&&copia.principal&&copia.loanId){
      const l=findLoan(prop(copia.propertyId),copia.loanId);
      if(l){l.outstanding=Math.round((l.outstanding-copia.principal)*100)/100;syncLoanRec(prop(copia.propertyId),l)}
    }
  });
}
function yearRows(l){
  const a=amort(l),yrs=[];let ai=0,as=0,ac=0,bal=l.outstanding,yr=YEAR;
  a.rows.forEach((r,i)=>{ai+=r.int;as+=r.st;ac+=r.cap;bal=r.bal;
    if((i+1)%12===0||i===a.rows.length-1){yrs.push({yr:yr++,int:ai,st:as,cap:ac,bal,rate:r.rate});ai=as=ac=0}});
  return {yrs,totInt:a.totInt,totStamp:a.totStamp};
}
let amortPid=null,amortLid='';
function amortModal(pid,lid){
  const p=prop(pid),ls=liveLoans(p);if(!ls.length)return;
  amortPid=pid;amortLid=lid===undefined?(ls.length===1?ls[0].id:''):lid;
  const opts=(ls.length>1?[{v:'',label:'Todas as hipotecas'}]:[]).concat(ls.map(l=>({v:l.id,label:loanName(l)})));
  let body='';
  if(amortLid){
    const l=findLoan(p,amortLid),r=yearRows(l);
    body=`${cLine([{name:'Em dívida',values:r.yrs.map(y=>y.bal),color:'#d6a34a'}],r.yrs.map(y=>String(y.yr)),{h:180,marks:decadeMarks(r.yrs[0]?r.yrs[0].yr:YEAR,r.yrs.length)})}
      <div class="tablewrap"><table class="table"><thead><tr><th>Ano</th><th>Taxa</th><th>Capital</th><th>Juros</th><th>Selo</th><th>Em dívida</th></tr></thead>
      <tbody>${r.yrs.map(y=>`<tr><td><b>${y.yr}</b></td><td>${dec(y.rate)}%</td><td>${euro(y.cap)}</td><td class="neg">${euro(y.int)}</td><td class="amber">${euro(y.st)}</td><td>${euro(y.bal)}</td></tr>`).join('')}</tbody></table></div>
      <div class="hint">Juros ${euro(r.totInt)} + imposto do selo ${euro(r.totStamp)} = <b>${euro(r.totInt+r.totStamp)}</b>.</div>`;
  }else{
    const per=ls.map(l=>({l,r:yearRows(l)}));
    const nY=Math.max(...per.map(x=>x.r.yrs.length));
    const totals=[...Array(nY)].map((_,i)=>sum(per.map(x=>x.r.yrs[i]?x.r.yrs[i].bal:0)));
    body=`${cLine(per.map((x,i)=>({name:loanName(x.l),values:[...Array(nY)].map((_,k)=>x.r.yrs[k]?x.r.yrs[k].bal:0),color:PAL[i%PAL.length]}))
        .concat([{name:'Total',values:totals,color:'#d6a34a'}]),[...Array(nY)].map((_,i)=>String(YEAR+i)),{h:200,marks:decadeMarks(YEAR,nY)})}
      <div class="tablewrap"><table class="table"><thead><tr><th>Hipoteca</th><th>Em dívida</th><th>Prestação</th><th>Juros até ao fim</th><th>Selo</th></tr></thead>
      <tbody>${per.map(x=>`<tr><td><b>${esc(loanName(x.l))}</b><div class="small">${RATE[x.l.type]} · ${x.l.years} anos</div></td>
        <td>${euro(x.l.outstanding)}</td><td>${euro2(loanCalc(x.l).total)}</td><td class="neg">${euro(x.r.totInt)}</td><td class="amber">${euro(x.r.totStamp)}</td></tr>`).join('')}
        <tr><td><b>Total</b></td><td><b>${euro(debtOf(p))}</b></td><td><b>${euro2(payOf(p))}</b></td>
          <td class="neg"><b>${euro(sum(per.map(x=>x.r.totInt)))}</b></td><td class="amber"><b>${euro(sum(per.map(x=>x.r.totStamp)))}</b></td></tr>
      </tbody></table></div>`;
  }
  (lid===undefined?openModal:setModal)('Amortização · '+p.name,`<div class="form">
    ${ls.length>1?`<label>Ver${sel('amSel',amortLid,opts,'onAmortSel')}</label>`:''}
    ${body}</div>`,`<button class="btn" onclick="closeModal()">Fechar</button>`);
}
function onAmortSel(){amortModal(amortPid,val('amSel'))}
