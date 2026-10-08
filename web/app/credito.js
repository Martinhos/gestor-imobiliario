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
   distribuição do plano simulada para a frente a partir do capital da data de
   início (capitalDoInicio — o que se escreve no formulário): cada uma abate o
   seu capital, como se fosse confirmada uma a uma. A prestação é a anuidade sobre o prazo que
   resta (o prazo menos as registadas e as já simuladas) e a taxa a da fase
   em que se vai (as registadas contam antes destas). O saldo corre exato e o
   capital de cada linha é a diferença dos saldos arredondados, por isso
   Σcapital = dívida antes − saldo final, ao cêntimo. Pára em `ate`, no mês
   da primeira registada, quando o prazo acaba ou quando o saldo chega a 0
   (crédito liquidado: a última linha leva o resto). Um crédito sem capital
   em dívida (já liquidado) não tem nada a inserir. Só calcula; não mexe em nada.
   Recebe: l — o crédito (id, start, capitalInicio, years, taxa…); txs — onde
   procurar os movimentos já registados (db.transactions); hoje — AAAA-MM-DD;
   ate (opcional) — data exclusiva a partir da qual a recorrência automática
   trata (r.next): daí em diante não se gera nada.
   Devolve: [{date,m,rate,amount,interest,stamp,principal,bal}] por ordem
   (m a começar em 1, rate em %, o resto em euros; bal é o saldo depois dessa
   prestação); [] quando não há nada a inserir. */
function loanPrestacoesEmFalta(l,txs,hoje,ate){
  l=normLoan(l);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(l.start||'')||!(saldoEmDivida(l,txs)>0)||!(Number(l.years)>0))return [];
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
  let bal=capitalDoInicio(l,txs),balR=r2(bal),pay=null,last=null;
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
/* O custo do crédito até ao fim do plano: os juros mais o imposto do selo (amort).
   Recebe: l — a hipoteca.
   Devolve: euros (número). */
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

/* ---- o capital em dívida: derivado, e não guardado ----
   O capital que se escreve no formulário é o da DATA DE INÍCIO, e cada
   pagamento de crédito (prestação ou amortização) abate-lhe o seu capital —
   decisão do Martinho. Por isso o capital do início fica guardado na
   hipoteca (capitalInicio) e o capital em dívida (outstanding) é o que dele
   sobra depois dos pagamentos registados: saldoEmDivida. O outstanding
   gravado é só a cache dessa conta. Era estado mutável dentro da casa, que a
   nuvem sobe como uma entidade só (última escrita ganha a casa inteira): dois
   aparelhos a tocar na mesma casa — um regista a prestação, o outro guarda o
   imóvel aberto de antes — deixavam o movimento e perdiam o abate. Com a
   conta derivada, o capital volta certo no próximo acertarCreditos. */

/* O capital que os pagamentos desta hipoteca já abateram: a soma do capital
   (principal) dos pagamentos de crédito ligados a ela — prestações e
   amortizações; os que o delMort desligou (loanOff) já não estão ligados.
   Recebe: l — a hipoteca (com id); txs — os movimentos (db.transactions).
   Devolve: número em euros, arredondado ao cêntimo. */
function capitalAbatido(l,txs){
  if(!l||!l.id)return 0;
  let s=0;
  (txs||[]).forEach(t=>{if(t&&t.kind==='loan'&&t.loanId===l.id)s+=Number(t.principal)||0});
  return r2(s);
}
/* O capital da hipoteca à data de início. O gravado (capitalInicio), quando
   o há; numa hipoteca de antes de o campo existir, o que ela tinha implícito:
   o capital em dívida gravado mais o que os pagamentos já lhe tinham abatido
   — é assim que os dados antigos migram sem mudar o capital em dívida que se vê.
   Recebe: l — a hipoteca; txs — os movimentos.
   Devolve: número em euros, ≥ 0. */
function capitalDoInicio(l,txs){
  const v=(l||{}).capitalInicio;
  if(v!=null&&v!==''&&isFinite(Number(v)))return Math.max(0,Number(v));
  return Math.max(0,r2((Number((l||{}).outstanding)||0)+capitalAbatido(l,txs)));
}
/* O capital em dívida: o do início menos o que os pagamentos registados já
   abateram (nunca abaixo de zero). É a conta de que o outstanding gravado é a
   cache. Pura: não mexe na hipoteca nem nos movimentos.
   Recebe: l — a hipoteca; txs — os movimentos.
   Devolve: número em euros, ≥ 0, arredondado ao cêntimo. */
function saldoEmDivida(l,txs){return Math.max(0,r2(capitalDoInicio(l,txs)-capitalAbatido(l,txs)))}
/* Grava na hipoteca o capital do início, quando ainda não o tem (os dados de
   antes do campo). Tem de correr ANTES de mexer nos pagamentos dela: o
   implícito lê-se do capital em dívida gravado e dos pagamentos que o
   abateram, e só bate certo enquanto os dois ainda dizem o mesmo.
   Recebe: l — a hipoteca; txs — os movimentos.
   Devolve: nada — escreve l.capitalInicio se faltava. */
function fixarCapitalInicio(l,txs){
  if(!l)return;
  const v=l.capitalInicio;
  if(v==null||v===''||!isFinite(Number(v)))l.capitalInicio=capitalDoInicio(l,txs);
}
/* Volta a derivar o capital em dívida de uma hipoteca a partir do capital do
   início e dos pagamentos que estão agora na base (db.transactions). Corre
   depois de acrescentar, tirar ou mudar um pagamento dela.
   Recebe: l — a hipoteca.
   Devolve: nada — escreve l.outstanding. */
function acertarCapital(l){if(l)l.outstanding=saldoEmDivida(l,(db&&db.transactions)||[])}
/* Acerta todas as hipotecas de uma base: grava o capital do início onde falta
   (a migração dos dados antigos, sem mudar nenhum capital em dívida) e deriva
   o capital em dívida de cada uma. Corre depois de carregar a base, de
   aplicar o estado do servidor e de repor uma cópia: é o que devolve o abate
   que uma escrita cruzada da casa inteira tinha levado.
   Recebe: d — a base ({properties, transactions}); sem ela, a db.
   Devolve: quantas hipotecas mudaram de capital em dívida (número; 0 com a
   base já certa — quem chama só grava quando mudou alguma). */
function acertarCreditos(d){
  d=d||db;let n=0;
  const txs=(d&&d.transactions)||[];
  ((d&&d.properties)||[]).forEach(p=>(p.loans||[]).forEach(l=>{
    fixarCapitalInicio(l,txs);
    const s=saldoEmDivida(l,txs);
    if(s!==Number(l.outstanding)){l.outstanding=s;n++}
  }));
  return n;
}
/* O dia em que vence a primeira prestação à taxa variável de uma mista — o
   fim da fase fixa, pelo único relógio do crédito: as prestações registadas
   (loanMes, decisão do Martinho). É a mesma conta da caixa da simulação
   (imovel.js:loanBox) e do aviso dos prazos (prazos.js:prazosDe), para as
   duas não discordarem. A linha rows[0] do plano (amort) é a próxima por
   pagar: a da recorrência, quando se sabe (proxima); senão a deste mês — ou a
   do mês seguinte, quando a deste já está registada. A fase muda em rows[k],
   com k = meses da fase fixa − prestações registadas.
   Recebe: l — a hipoteca; txs — os movimentos; hoje — 'AAAA-MM-DD'; proxima
   (opcional) — a data da próxima prestação por confirmar (o next da recorrência).
   Devolve: 'AAAA-MM-DD'; '' quando não é mista ou a fase fixa já acabou. */
function fimDaFaseFixa(l,txs,hoje,proxima){
  if(!l||l.type!=='mista'||!/^\d{4}-\d{2}/.test(String(hoje||'')))return '';
  const pagas=(txs||[]).filter(t=>t.kind==='loan'&&t.loanId===l.id&&t.payType!=='amortizacao');
  const k=Math.round((Number(l.fixedYears)||0)*12)-Math.max(0,pagas.length+(Number(l._paidOfs)||0));
  if(k<=0)return '';
  const tem=/^\d{4}-\d{2}-\d{2}$/.test(String(proxima||'')),ref=tem?proxima:hoje;
  const jaEste=!tem&&pagas.some(t=>String(t.date||'').slice(0,7)===hoje.slice(0,7));
  const t0=Number(ref.slice(0,4))*12+Number(ref.slice(5,7))-1+k+(jaEste?1:0);
  const dia=tem?Number(proxima.slice(8,10)):Math.max(1,Math.min(28,Number(String(l.start||'').slice(8,10))||1));
  return dayInMonth(Math.floor(t0/12),t0%12,dia);
}
/* O movimento-modelo da prestação da hipoteca l do imóvel p — o que a
   recorrência automática guarda em r.tx (planeados.js:syncLoanRec) e o que as
   prestações inseridas em bloco copiam (creditos.js:inserirPrestacoesEmFalta):
   descrição, prestação atual, imóvel, hipoteca e categoria. Vive aqui, no
   motor do crédito, porque os dois serviços precisam dele e nenhum requer o outro.
   Recebe: p — o imóvel (objeto de db.properties); l — a hipoteca (objeto de p.loans).
   Devolve: o objeto do movimento (sem id nem data), pronto para normTx. */
function loanRecTx(p,l){
  const name='Prestação '+(l.name?l.name+' · ':'')+p.name;
  const out=cats(),cat='Crédito à habitação' in out?'Crédito à habitação':'',sub=cat&&(out[cat]||[]).indexOf('Prestação mensal')>-1?'Prestação mensal':'';
  return {kind:'loan',payType:'prestacao',label:name,amount:Math.round(loanCalc(l).total*100)/100,propertyId:p.id,loanId:l.id,category:cat,sub,split:null};
}

/* A base guardada no aparelho foi lida antes deste ficheiro (dados.js:
   let db=load()), quando o normalizarBase ainda não tinha o acertarCreditos:
   acerta-se aqui, uma vez, ao carregar. Os outros caminhos — um load() mais
   tarde, uma cópia reposta, o estado do servidor — já passam por ele. */
acertarCreditos(db);
