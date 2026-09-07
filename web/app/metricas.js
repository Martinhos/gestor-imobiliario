/* ================= MÉTRICAS ================= */
/* O peso de um movimento numa vista — o único sítio onde se decide quanto de cada
   movimento conta. Por imóvel: a fração do imóvel (txW) vezes, com share e uma pessoa
   filtrada, a parte dela na divisão do movimento. De grupo: soma, pelos imóveis do
   grupo que estão na vista, da fração de cada imóvel e, com share, da parte da pessoa
   dentro desse imóvel (a mesma repartição que ownerBalances faz). Sem imóvel nem
   grupo: conta por inteiro só no âmbito todo, sem filtro de proprietário.
   Recebe: t — o movimento; pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio para o
   âmbito atual; share — pesar pela quota do proprietário filtrado (booleano).
   Devolve: número 0–1 — a fração do valor do movimento que conta nessa vista. */
function txWeight(t,pid,share){
  const oid=share&&ownerFilter&&!ownerIsGrp()?ownerFilter:null;
  if(t.propertyId){const w=txW(t,pid);return w*(oid?txOwnerFrac(t,oid):1)}
  if(t.groupId){
    return sum(pidProps(pid).map(p=>{const fp=txPropShare(t,p.id);if(!fp||!oid)return fp;
      const os=ownersOfProp(p);if(os.indexOf(oid)<0)return 0;
      const cP=Math.round(Math.abs(Number(t.amount)||0)*100*fp);if(!cP)return fp*shareOf(p,oid);
      return fp*txSplitCents(Object.assign({},t,{amount:cP/100}),p,os)[os.indexOf(oid)]/cP}));
  }
  return pid||ownerFilter?0:1;
}
/* uma amortização antecipada: pagamento de crédito que abate capital fora do plano
   Recebe: t — o movimento.
   Devolve: true se for uma amortização antecipada. */
const isAmort=t=>t.kind==='loan'&&t.payType==='amortizacao';
/* meses já decorridos do ano corrente — o mês de hoje conta por inteiro
   Devolve: número de 1 a 12. */
const mesAtual=()=>new Date().getMonth()+1;
/* fator que leva um valor do ano y a 12 meses: no ano corrente, 12 sobre os meses decorridos;
   nos anos passados (já completos) é 1
   Recebe: y — o ano (número ou texto).
   Devolve: o fator (número ≥ 1). */
const anualFator=y=>Number(y)===YEAR?12/mesAtual():1;
/* opts.share: com a vista filtrada por proprietário, cada imóvel entra pela quota-parte dele
   e cada movimento pela parte dela na divisão (txWeight). Prestações e amortizações
   antecipadas vêm separadas; o cashflow desconta as duas. O NOI vem também anualizado
   (noiAnual) — no ano corrente, ×12 sobre os meses decorridos — e é esse que alimenta o cap
   rate e a avaliação por rendimento. O yield bruto usa o mesmo conjunto em cima e em
   baixo: os imóveis com contrato ativo.
   Recebe: y — o ano (número, ex.: 2026); pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio
   para o âmbito atual; opts (opcional) — com opts.share, os valores entram pela quota-parte do
   proprietário filtrado.
   Devolve: objeto com os movimentos do ano que contam (t), os imóveis (props, rented), os totais
   (income, op, loan, amort, noi, noiAnual, cf, value, rentedValue, annualRent, purchase, debt,
   gain, gainOut) e os rácios (grossYield, cap, coc, ltv — NaN quando a base é zero). */
function metrics(y,pid,opts){
  const ps=pidProps(pid),share=!!(opts&&opts.share);
  const k=share?sh:()=>1;
  const f=x=>txWeight(x,pid,share);
  const t=db.transactions.filter(x=>String(x.date||'').startsWith(String(y))&&f(x)>0);
  const soma=cond=>sum(t.filter(cond).map(x=>x.amount*f(x)));
  const income=soma(x=>x.kind==='income'&&countsInTotals(x));
  const op=soma(x=>x.kind==='expense'&&countsInTotals(x));
  const loan=soma(x=>x.kind==='loan'&&!isAmort(x));
  const amort=soma(isAmort);
  const rented=ps.filter(p=>isRented(p)||activeContracts(p.id).length>0);
  const value=sum(ps.map(p=>p.value*k(p))),rentedValue=sum(rented.map(p=>p.value*k(p)));
  const annualRent=sum(rented.map(p=>rentOf(p)*12*k(p)));
  const purchase=sum(ps.map(p=>p.purchase*k(p)));
  const debt=sum(ps.map(p=>debtOf(p)*k(p)));
  const noi=income-op,noiAnual=noi*anualFator(y),cf=noi-loan-amort;
  /* Mais-valia potencial: valor de mercado menos o de aquisição. So entram os
     imoveis que tem os dois — sem aquisicao registada, a diferenca seria o
     valor inteiro e o total ficava inflacionado sem se dar por isso. */
  const gp=ps.filter(p=>p.value>0&&p.purchase>0);
  const gain=sum(gp.map(p=>(p.value-p.purchase)*k(p)));
  const gainOut=ps.length-gp.length;
  return{t,props:ps,rented,income,op,loan,amort,noi,noiAnual,cf,value,rentedValue,annualRent,purchase,debt,gain,gainOut,
    grossYield:rentedValue?annualRent/rentedValue:NaN,cap:value?noiAnual/value:NaN,
    coc:purchase?cf/purchase:NaN,ltv:value?debt/value:NaN};
}
/* a base anual das despesas para projetar: o último ano completo com despesas; sem
   nenhum, o ano corrente anualizado (o que há até hoje ×12 sobre os meses decorridos)
   Recebe: pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio para o âmbito atual.
   Devolve: {op, year, anualizado} — as despesas anuais (euros, na quota do proprietário
   filtrado), o ano de onde vêm e se foram anualizadas. */
function opBase(pid){
  const anos=[...new Set(db.transactions.map(t=>Number(String(t.date||'').slice(0,4))).filter(y=>y&&y<YEAR))].sort((a,b)=>b-a);
  for(const y of anos){const op=metrics(y,pid,{share:true}).op;if(op>0)return{op,year:y,anualizado:false}}
  return{op:metrics(YEAR,pid,{share:true}).op*anualFator(YEAR),year:YEAR,anualizado:true};
}
/* fração do movimento que cabe ao proprietário filtrado — só quando se pede share, o filtro é uma
   pessoa (não um grupo) e o movimento tem imóvel; nos restantes casos conta por inteiro
   Recebe: t — o movimento (objeto); share — se se quer a quota do proprietário filtrado (booleano).
   Devolve: número 0–1 — a fração do valor que cabe a esse proprietário; 1 nos restantes casos. */
/* total mensal (12 valores, jan–dez) dos movimentos do tipo kind no ano y, com o mesmo
   peso das métricas (txWeight). 'loan' são só as prestações; 'amort' as amortizações antecipadas.
   Recebe: y — o ano; pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio para o âmbito atual;
   kind — o tipo de movimento ('income', 'expense', 'loan' ou 'amort'); share (opcional) — pesar
   pela quota do proprietário filtrado.
   Devolve: array de 12 números (jan–dez) com o total de cada mês. */
const monthly=(y,pid,kind,share)=>[...Array(12)].map((_,i)=>{
  const mo=`${y}-${String(i+1).padStart(2,'0')}`;
  const doTipo=kind==='amort'?isAmort:kind==='loan'?(t=>t.kind==='loan'&&!isAmort(t)):(t=>t.kind===kind);
  return sum(db.transactions.filter(t=>String(t.date).startsWith(mo)&&doTipo(t)&&countsInTotals(t)).map(t=>t.amount*txWeight(t,pid,share)));
});
/* cat: se indicado, devolve as subcategorias dessa categoria
   Recebe: y — o ano; pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio para o âmbito atual;
   share — pesar pela quota do proprietário filtrado; cat (opcional) — uma categoria de despesa,
   para detalhar as suas subcategorias.
   Devolve: array de {label, value} ordenado do maior para o menor. */
function byCategory(y,pid,share,cat){
  const map={};
  db.transactions.filter(t=>t.kind==='expense'&&countsInTotals(t)&&String(t.date).startsWith(String(y))&&(!cat||(t.category||'Outros')===cat))
    .forEach(t=>{const w=txWeight(t,pid,share);if(!w)return;const k=cat?(t.sub||'Sem subcategoria'):(t.category||'Outros');map[k]=(map[k]||0)+t.amount*w});
  return Object.keys(map).map(k=>({label:k,value:map[k]})).sort((a,b)=>b.value-a.value);
}
