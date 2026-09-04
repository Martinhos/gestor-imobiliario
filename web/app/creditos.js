/* ================= CRÉDITOS (todas as hipotecas) =================
   Devolve: o HTML da vista de créditos — barra de filtros, KPIs e a lista de
   hipotecas em cartões. */
function vCredits(){
  const K='lcred',s=lf(K);
  const rows=[];
  scope().forEach(p=>loansOf(p).forEach(l=>rows.push({p,l})));
  const live=rows.filter(x=>Number(x.l.outstanding)>0);
  const shown=lfSort(K,rows.filter(({p,l})=>{
    if(s.p&&p.id!==s.p)return false;
    if(s.st==='on'&&!(Number(l.outstanding)>0))return false;
    if(s.st==='off'&&Number(l.outstanding)>0)return false;
    return lfHit(K,[loanName(l),l.name,l.bank,p.name,RATE[l.type],String(l.outstanding)].join(' '));
  }),{divida:x=>x.l.outstanding,prestacao:x=>Number(x.l.outstanding)>0?loanCalc(x.l).total:0,nome:x=>loanName(x.l),imovel:x=>x.p.name});
  const tot=sum(live.map(x=>x.l.outstanding)),pay=sum(live.map(x=>loanCalc(x.l).total));
  const head=lfBar(K,[lfSel(K,'p',lfPropOpts()),
      lfSel(K,'st',[{v:'',label:'Ativas e liquidadas'},{v:'on',label:'Ativas'},{v:'off',label:'Liquidadas'}])],shown.length,
      {opts:[{v:'divida',label:'Ordenar por dívida'},{v:'prestacao',label:'Ordenar por prestação'},{v:'nome',label:'Ordenar por nome'},{v:'imovel',label:'Ordenar por imóvel'}]})
    +fab([{label:'Nova hipoteca',act:'newMort()'}]);
  const kpis=`<div class="grid" style="margin-bottom:14px">
    ${kpi('Em dívida',euro(tot),'amber',live.length+(live.length===1?' hipoteca ativa':' hipotecas ativas'))}
    ${kpi('Prestações',euro2(pay),'neg','por mês, no total')}
    ${kpi('Juros até ao fim',euro(sum(live.map(x=>{const a=amort(x.l);return a.totInt+a.totStamp}))),'neg','com imposto do selo')}</div>`;
  if(!rows.length)return head+`<div class="empty"><b>Sem hipotecas</b>Uma hipoteca está sempre associada a um imóvel. Cria a primeira aqui ou na ficha do imóvel.</div>`;
  if(!shown.length)return head+kpis+`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`;
  const mortCard=({p,l})=>{const live2=Number(l.outstanding)>0,c=live2?loanCalc(l):null;
    return `<div class="card tap" data-lp="mort:${esc(p.id)}:${esc(l.id)}" onclick="mortModal('${jsq(p.id)}','${jsq(l.id)}')">
      <div class="row-between"><div style="min-width:0"><div class="title">${esc(loanName(l))} ${live2?'':'<span class="badge grey">liquidada</span>'}</div>
        <div class="small">${esc(p.name)} · ${RATE[l.type]} · ${rateLabel(l)}${(l.files||[]).length?' · '+l.files.length+' doc.':''}</div></div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
          <div style="text-align:right"><b>${euro(l.outstanding)}</b>${live2?`<div class="small">${euro2(c.total)}/mês</div>`:''}</div>
          ${kebab('mort:'+p.id+':'+l.id)}</div></div></div>`};
  const act=shown.filter(x=>Number(x.l.outstanding)>0),paid=shown.filter(x=>!(Number(x.l.outstanding)>0));
  const list=(act.length?`<div class="list">${act.map(mortCard).join('')}</div>`:'')
    +(paid.length?`<div class="section-title" style="margin-top:${act.length?18:0}px">Créditos antigos já pagos</div>
      <div class="list">${paid.map(mortCard).join('')}</div>
      <div class="hint" style="margin-top:10px">Se editares um pagamento e a dívida voltar a subir, o crédito volta para a lista de cima.</div>`:'');
  return head+kpis+list+`<div class="hint" style="margin-top:12px">Também podes geri-las na ficha de cada imóvel.</div>`;
}
/* nova hipoteca: escolhe-se primeiro o imóvel (uma hipoteca tem sempre um)
   Devolve: nada — abre o seletor de imóvel e depois o modal da hipoteca nova
   (ou um toast, quando ainda não há imóveis). */
function newMort(){
  if(!db.properties.length)return toast('Cria primeiro um imóvel.');
  pickModal('Hipoteca de que imóvel?',db.properties.map(p=>({v:p.id,label:p.name,sub:loansOf(p).length?loansOf(p).length+' hipoteca(s)':'sem hipotecas',icon:'building'})),
    o=>{closeAllModals();
      pForm=normProp(JSON.parse(JSON.stringify(prop(o.v))));
      const l=normLoan({name:pForm.loans.length?'':'Aquisição'});
      pForm.loans.push(l);
      mortOpen(l.id,true);
    });
}
/* editar uma hipoteca num modal próprio, gravando no imóvel
   Recebe: pid — o id do imóvel; lid — o id da hipoteca dentro dele.
   Devolve: nada — carrega o imóvel em pForm e abre o modal. */
function mortModal(pid,lid){
  pForm=normProp(JSON.parse(JSON.stringify(prop(pid))));
  mortOpen(lid,false);
}
/* Abre o modal da hipoteca `lid` do imóvel já carregado em pForm (newMort e
   mortModal tratam disso primeiro). Liga o repaint ao mortBody, põe o menu de
   apagar quando é edição, e define o onSave: numa hipoteca nova sem capital
   em dívida recusa; senão grava o imóvel inteiro na db, sincroniza os
   movimentos planeados das prestações e fecha.
   Recebe: lid — o id da hipoteca dentro de pForm; isNew — verdadeiro quando
   acabou de ser criada pelo newMort.
   Devolve: nada — abre o modal e deixa o onSave armado. */
function mortOpen(lid,isNew){
  foldState={};
  _propPaint=()=>mortBody(lid);
  const m=!isNew?menu('mort',[{label:'Apagar hipoteca',icon:'trash',danger:true,act:`delMort('${lid}')`}]):'';
  openModal(isNew?'Nova hipoteca':'Editar hipoteca',mortBody(lid),null,m);
  onSave=()=>{collectProp();
    const l=findLoan(pForm,lid);
    if(l&&!(l.outstanding>0)&&isNew)return toast('Indica o capital em dívida.');
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i>-1)db.properties[i]=pForm;
    syncAllLoanRecs();save();closeModal();render();toast('Hipoteca guardada.')};
}
// O corpo do modal: o formulário da hipoteca `lid` dentro de pForm — o mesmo
// loanSect da ficha do imóvel. É também a função de repaint do modal.
// Recebe: lid — o id da hipoteca dentro de pForm.
// Devolve: o HTML do formulário, ou um aviso se a hipoteca já não existir.
function mortBody(lid){
  const i=(pForm.loans||[]).findIndex(x=>x.id===lid),l=pForm.loans[i];
  if(!l)return '<div class="hint">Hipoteca não encontrada.</div>';
  return `<div class="form">
    <div class="hint" style="margin:-2px 0 0">Imóvel: <b>${esc(pForm.name)}</b></div>
    ${loanSect(l,i)}</div>`;
}
// Apagar a partir da lista, onde ainda não há pForm: carrega o imóvel e delega no delMort.
// Recebe: pid — o id do imóvel; lid — o id da hipoteca.
// Devolve: nada — o delMort trata da confirmação e do resto.
function delMortFrom(pid,lid){pForm=normProp(JSON.parse(JSON.stringify(prop(pid))));delMort(lid)}
/* Apagar a hipoteca `lid` de pForm, com confirmação. As prestações já
   registadas não se apagam — só lhes tira o loanId, e o aviso diz quantas
   ficam assim. Limpa também os anexos dela do IndexedDB antes de gravar o
   imóvel e repintar.
   Recebe: lid — o id da hipoteca dentro de pForm.
   Devolve: nada — pede confirmação e, com o sim, grava, fecha e repinta. */
function delMort(lid){
  const l=findLoan(pForm,lid),used=db.transactions.filter(t=>t.loanId===lid).length;
  confirmModal('Apagar hipoteca',`Apagar “${esc(loanName(l))}”?${used?` ${used} prestação(ões) ficam sem hipoteca associada.`:''}`,()=>{
    db.transactions.forEach(t=>{if(t.loanId===lid)t.loanId=null});
    ((l||{}).files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    pForm.loans=pForm.loans.filter(x=>x.id!==lid);
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i>-1)db.properties[i]=pForm;
    syncAllLoanRecs();save();closeAllModals();render();toast('Hipoteca apagada.');
  });
}
