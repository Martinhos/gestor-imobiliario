/* ================= MÉTRICAS ================= */
/* opts.share: com a vista filtrada por proprietário, cada imóvel entra pela quota-parte dele
   Recebe: y — o ano (número, ex.: 2026); pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio
   para o âmbito atual; opts (opcional) — com opts.share, os valores entram pela quota-parte do
   proprietário filtrado.
   Devolve: objeto com os movimentos do ano (t), os imóveis (props, rented), os totais (income,
   op, loan, noi, cf, value, rentedValue, annualRent, purchase, debt, gain, gainOut) e os rácios
   (grossYield, cap, coc, ltv — NaN quando a base é zero). */
function metrics(y,pid,opts){
  const ps=pidProps(pid);
  const k=(opts&&opts.share)?sh:()=>1;
  const ids={};ps.forEach(p=>ids[p.id]=k(p));
  const inM=x=>x.propertyId?ids[x.propertyId]!==undefined:(x.groupId?txProps(x).some(p=>ids[p.id]!==undefined):!pid&&!ownerFilter);
  const wM=x=>x.groupId?sum(txProps(x).filter(p=>ids[p.id]!==undefined).map(p=>txPropShare(x,p.id))):1;
  const t=db.transactions.filter(x=>String(x.date||'').startsWith(String(y))&&inM(x));
  const f=x=>txShare(x,opts&&opts.share)*wM(x);
  const income=sum(t.filter(x=>x.kind==='income'&&countsInTotals(x)).map(x=>x.amount*f(x)));
  const op=sum(t.filter(x=>x.kind==='expense'&&countsInTotals(x)).map(x=>x.amount*f(x)));
  const loan=sum(t.filter(x=>x.kind==='loan').map(x=>x.amount*f(x)));
  const rented=ps.filter(isRented);
  const value=sum(ps.map(p=>p.value*k(p))),rentedValue=sum(rented.map(p=>p.value*k(p)));
  const annualRent=sum(ps.map(p=>rentOf(p)*12*k(p)));
  const purchase=sum(ps.map(p=>p.purchase*k(p)));
  const debt=sum(ps.map(p=>debtOf(p)*k(p)));
  const noi=income-op,cf=noi-loan;
  /* Mais-valia potencial: valor de mercado menos o de aquisição. So entram os
     imoveis que tem os dois — sem aquisicao registada, a diferenca seria o
     valor inteiro e o total ficava inflacionado sem se dar por isso. */
  const gp=ps.filter(p=>p.value>0&&p.purchase>0);
  const gain=sum(gp.map(p=>(p.value-p.purchase)*k(p)));
  const gainOut=ps.length-gp.length;
  return{t,props:ps,rented,income,op,loan,noi,cf,value,rentedValue,annualRent,purchase,debt,gain,gainOut,
    grossYield:rentedValue?annualRent/rentedValue:NaN,cap:value?noi/value:NaN,
    coc:purchase?cf/purchase:NaN,ltv:value?debt/value:NaN};
}
/* fração do movimento que cabe ao proprietário filtrado — só quando se pede share, o filtro é uma
   pessoa (não um grupo) e o movimento tem imóvel; nos restantes casos conta por inteiro
   Recebe: t — o movimento (objeto); share — se se quer a quota do proprietário filtrado (booleano).
   Devolve: número 0–1 — a fração do valor que cabe a esse proprietário; 1 nos restantes casos. */
const txShare=(t,share)=>share&&ownerFilter&&!ownerIsGrp()&&t.propertyId?txOwnerFrac(t,ownerFilter):1;
/* total mensal (12 valores, jan–dez) dos movimentos do tipo kind no ano y, pesado pelo
   imóvel ou âmbito atual (txW) e, com share, pela quota do proprietário filtrado
   Recebe: y — o ano; pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio para o âmbito atual;
   kind — o tipo de movimento ('income', 'expense' ou 'loan'); share (opcional) — pesar pela
   quota do proprietário filtrado.
   Devolve: array de 12 números (jan–dez) com o total de cada mês. */
const monthly=(y,pid,kind,share)=>[...Array(12)].map((_,i)=>{
  const mo=`${y}-${String(i+1).padStart(2,'0')}`;
  return sum(db.transactions.filter(t=>String(t.date).startsWith(mo)&&t.kind===kind&&countsInTotals(t)).map(t=>t.amount*txShare(t,share)*txW(t,pid)));
});
/* cat: se indicado, devolve as subcategorias dessa categoria
   Recebe: y — o ano; pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio para o âmbito atual;
   share — pesar pela quota do proprietário filtrado; cat (opcional) — uma categoria de despesa,
   para detalhar as suas subcategorias.
   Devolve: array de {label, value} ordenado do maior para o menor. */
function byCategory(y,pid,share,cat){
  const map={};
  db.transactions.filter(t=>t.kind==='expense'&&countsInTotals(t)&&String(t.date).startsWith(String(y))&&(!cat||(t.category||'Outros')===cat))
    .forEach(t=>{const w=txW(t,pid);if(!w)return;const k=cat?(t.sub||'Sem subcategoria'):(t.category||'Outros');map[k]=(map[k]||0)+t.amount*txShare(t,share)*w});
  return Object.keys(map).map(k=>({label:k,value:map[k]})).sort((a,b)=>b.value-a.value);
}
