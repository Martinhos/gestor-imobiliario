/* ================= CRÉDITO ================= */
// Recebe: l — o crédito (passa pelo normLoan); m — o mês do crédito, contado do início e a começar no 0.
// Devolve: número — a taxa anual em percentagem que vigora nesse mês: a fixa,
// a Euribor+spread nas variáveis, ou a fase certa nas mistas.
function rateAt(l,m){
  l=normLoan(l);
  const vr=(Number(l.euribor)||0)+(Number(l.spread)||0);
  if(l.type==='variavel')return vr;
  if(l.type==='mista')return m<Math.round((Number(l.fixedYears)||0)*12)?(Number(l.rate)||0):vr;
  return Number(l.rate)||0;
}
/* prestações já registadas deste crédito (amortizações antecipadas não contam):
   encurtam o prazo restante e avançam a fase da taxa nas mistas
   Recebe: l — o crédito, com id.
   Devolve: número inteiro — quantas prestações deste crédito já estão nos
   movimentos; 0 sem crédito ou sem dados. */
function loanPaidN(l){
  if(!l||!l.id||!db||!db.transactions)return 0;
  return db.transactions.filter(t=>t.kind==='loan'&&t.loanId===l.id&&t.payType!=='amortizacao').length;
}
/* O mês do crédito (a contar do 0) em que se está: as prestações registadas
   nos movimentos — a app só sabe o que está registado. É a única conta que
   alimenta o prazo restante, a fase da taxa nas mistas e a comissão de
   amortização — para não discordarem.
   Recebe: l — o crédito (pode trazer _paidOfs, um acerto ao número de
   registadas, como −1 ao editar uma prestação).
   Devolve: número inteiro ≥ 0. */
function loanMes(l){
  const ofs=Number((l||{})._paidOfs)||0;
  return Math.max(0,loanPaidN(l)+ofs);
}
/* Prestações que faltam entre o início do crédito e o primeiro movimento já
   registado nele (ou hoje): uma por mês, no dia do início (máx. 28), com a
   distribuição do plano simulada para a frente a partir do capital em dívida
   gravado — que é o da data de início: cada uma abate o seu capital, como se
   fosse confirmada uma a uma. A prestação é a anuidade sobre o prazo que
   resta (o prazo menos as registadas e as já simuladas) e a taxa a da fase
   em que se vai (as registadas contam antes destas). O saldo corre exato e o
   capital de cada linha é a diferença dos saldos arredondados, por isso
   Σcapital = dívida antes − saldo final, ao cêntimo. Pára em `ate`, no mês
   da primeira registada, quando o prazo acaba ou quando o saldo chega a 0
   (crédito liquidado: a última linha leva o resto). Só calcula; não mexe em nada.
   Recebe: l — o crédito (id, start, outstanding, years, taxa…); txs — onde
   procurar os movimentos já registados (db.transactions); hoje — AAAA-MM-DD;
   ate (opcional) — data exclusiva a partir da qual a recorrência automática
   trata (r.next): daí em diante não se gera nada.
   Devolve: [{date,m,rate,amount,interest,stamp,principal,bal}] por ordem
   (m a começar em 1, rate em %, o resto em euros; bal é o saldo depois dessa
   prestação); [] quando não há nada a inserir. */
function loanPrestacoesEmFalta(l,txs,hoje,ate){
  l=normLoan(l);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(l.start||'')||!(Number(l.outstanding)>0)||!(Number(l.years)>0))return [];
  const mine=(txs||[]).filter(t=>t.kind==='loan'&&t.loanId===l.id);
  const N=Math.max(1,Math.round(Number(l.years)*12)),pagas=mine.filter(t=>t.payType!=='amortizacao').length;
  const cabem=N-pagas;
  if(cabem<=0)return [];
  const day=Math.max(1,Math.min(28,Number(l.start.slice(8,10))||1));
  const primeira=mine.map(t=>t.date||'').filter(Boolean).sort()[0]||'',limMes=primeira?primeira.slice(0,7):'';
  let y=Number(l.start.slice(0,4)),m=Number(l.start.slice(5,7))-1;
  const datas=[];
  for(;;){
    const d=dayInMonth(y,m,day);
    /* a que vence hoje ainda está por pagar: nunca entra aqui */
    if(d>=hoje||(ate&&d>=ate)||(limMes&&d.slice(0,7)>=limMes)||datas.length>=cabem)break;
    datas.push(d);m++;if(m>11){m=0;y++}
  }
  const sr=l.stampTax===false?0:stampPct();
  let bal=Number(l.outstanding),balR=r2(bal),pay=null,last=null;
  const out=[];
  for(let k=0;k<datas.length&&balR>0;k++){
    const r=rateAt(l,pagas+k),i=r/100/12;
    if(pay===null||r!==last){const rem=N-pagas-k;pay=i>0?bal*i/(1-Math.pow(1+i,-rem)):bal/rem;last=r}
    const int=bal*i,cap=Math.min(bal,pay-int);
    bal=Math.max(0,bal-cap);
    const b2=r2(bal),interest=r2(int),stamp=r2(interest*sr),principal=r2(balR-b2);
    balR=b2;
    out.push({date:datas[k],m:k+1,rate:r,interest,stamp,principal,amount:r2(interest+stamp+principal),bal:b2});
  }
  return out;
}
/* A tabela de amortização do que falta pagar, mês a mês: devolve
   {rows,totInt,totStamp,n,esgotado}, cada linha com taxa, prestação, juro,
   selo, capital e saldo. Desconta as prestações já pagas (loanMes: as
   registadas — encurtam o prazo e avançam a fase da taxa nas mistas) e
   recalcula a prestação sempre que a taxa muda. Com maxMonths pára cedo —
   os totais ficam só até aí. Se as pagas esgotam o prazo e ainda há dívida,
   fica um mês (n=1) e esgotado avisa: o prazo ou as registadas estão errados.
   Recebe: l — o crédito; maxMonths (opcional) — número máximo de linhas a calcular.
   Devolve: {rows,totInt,totStamp,n,esgotado} — linhas {m,rate,pay,int,st,cap,bal}
   (m a começar em 1, a taxa em %, o resto em euros), os totais de juro e selo
   até onde calculou, n o total de meses por pagar e esgotado verdadeiro quando
   as pagas já cobrem o prazo inteiro. */
function amort(l,maxMonths){
  const paid=loanMes(l);
  l=normLoan(l);
  const N=Math.round((Number(l.years)||0)*12),esgotado=N-paid<=0&&Number(l.outstanding)>0;
  const n=Math.max(1,N-paid);
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
  return {rows,totInt:ti,totStamp:ts,n,esgotado};
}
// A prestação deste mês, pronta a mostrar: a primeira linha da amortização,
// como {base,interest,stamp,principal,total,rate,n,esgotado} — o total já
// leva o selo e a taxa é a que vigora neste mês (não a do mês 0).
// Recebe: l — o crédito.
// Devolve: {base,interest,stamp,principal,total,rate,n,esgotado} — valores em
// euros, a rate em %, n os meses por pagar e esgotado como em amort.
function loanCalc(l){
  const a=amort(l,1),r=a.rows[0]||{pay:0,int:0,st:0,cap:0};
  return {base:r.pay,interest:r.int,stamp:r.st,principal:r.cap,total:r.pay+r.st,rate:r.rate!=null?r.rate:rateAt(l,0),n:a.n,esgotado:a.esgotado};
}
const loanCost=l=>{const a=amort(l);return a.totInt+a.totStamp};
// A taxa em palavras, para as listas: "fixa X%", a Euribor com o spread e a
// soma, ou as duas fases da mista.
// Recebe: l — o crédito.
// Devolve: string com a taxa por extenso, conforme o tipo.
function rateLabel(l){
  if(l.type==='fixa')return `fixa ${dec(l.rate)}%`;
  if(l.type==='variavel')return `Euribor ${l.index} ${dec(l.euribor)}% + ${dec(l.spread)}% = ${dec(rateAt(l,0))}%`;
  return `${dec(l.rate)}% durante ${dec(l.fixedYears)} anos, depois ${dec((Number(l.euribor)||0)+(Number(l.spread)||0))}%`;
}
