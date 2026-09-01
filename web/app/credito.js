/* ================= CRÉDITO ================= */
function rateAt(l,m){
  l=normLoan(l);
  const vr=(Number(l.euribor)||0)+(Number(l.spread)||0);
  if(l.type==='variavel')return vr;
  if(l.type==='mista')return m<Math.round((Number(l.fixedYears)||0)*12)?(Number(l.rate)||0):vr;
  return Number(l.rate)||0;
}
/* prestações já registadas deste crédito (amortizações antecipadas não contam):
   encurtam o prazo restante e avançam a fase da taxa nas mistas */
function loanPaidN(l){
  if(!l||!l.id||!db||!db.transactions)return 0;
  return db.transactions.filter(t=>t.kind==='loan'&&t.loanId===l.id&&t.payType!=='amortizacao').length;
}
function amort(l,maxMonths){
  const ofs=Number(l._paidOfs)||0;
  const paid=Math.max(0,loanPaidN(l)+ofs);
  l=normLoan(l);
  const n=Math.max(1,Math.round((Number(l.years)||0)*12)-paid);
  let bal=Number(l.outstanding)||0,pay=null,last=null,ti=0,ts=0;
  const rows=[];
  for(let k=0;k<n;k++){
    const r=rateAt(l,paid+k),i=r/100/12;
    if(pay===null||r!==last){const rem=n-k;pay=i>0?bal*i/(1-Math.pow(1+i,-rem)):bal/rem;last=r}
    const int=bal*i,st=(l.stampTax===false?0:int*stampPct()),cap=Math.min(bal,pay-int);
    bal=Math.max(0,bal-cap);ti+=int;ts+=st;
    rows.push({m:k+1,rate:r,pay,int,st,cap,bal});
    if(bal<=0||(maxMonths&&rows.length>=maxMonths))break;
  }
  return {rows,totInt:ti,totStamp:ts,n};
}
function loanCalc(l){
  const a=amort(l,1),r=a.rows[0]||{pay:0,int:0,st:0,cap:0};
  return {base:r.pay,interest:r.int,stamp:r.st,principal:r.cap,total:r.pay+r.st,rate:rateAt(l,0),n:a.n};
}
const loanCost=l=>{const a=amort(l);return a.totInt+a.totStamp};
function rateLabel(l){
  if(l.type==='fixa')return `fixa ${dec(l.rate)}%`;
  if(l.type==='variavel')return `Euribor ${l.index} ${dec(l.euribor)}% + ${dec(l.spread)}% = ${dec(rateAt(l,0))}%`;
  return `${dec(l.rate)}% durante ${dec(l.fixedYears)} anos, depois ${dec((Number(l.euribor)||0)+(Number(l.spread)||0))}%`;
}
