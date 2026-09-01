/* ================= MÉTRICAS ================= */
/* opts.share: com a vista filtrada por proprietário, cada imóvel entra pela quota-parte dele */
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
  return{t,props:ps,rented,income,op,loan,noi,cf,value,rentedValue,annualRent,purchase,debt,
    grossYield:rentedValue?annualRent/rentedValue:NaN,cap:value?noi/value:NaN,
    coc:purchase?cf/purchase:NaN,ltv:value?debt/value:NaN};
}
const txShare=(t,share)=>share&&ownerFilter&&!ownerIsGrp()&&t.propertyId?txOwnerFrac(t,ownerFilter):1;
const monthly=(y,pid,kind,share)=>[...Array(12)].map((_,i)=>{
  const mo=`${y}-${String(i+1).padStart(2,'0')}`;
  return sum(db.transactions.filter(t=>String(t.date).startsWith(mo)&&t.kind===kind&&countsInTotals(t)).map(t=>t.amount*txShare(t,share)*txW(t,pid)));
});
/* cat: se indicado, devolve as subcategorias dessa categoria */
function byCategory(y,pid,share,cat){
  const map={};
  db.transactions.filter(t=>t.kind==='expense'&&countsInTotals(t)&&String(t.date).startsWith(String(y))&&(!cat||(t.category||'Outros')===cat))
    .forEach(t=>{const w=txW(t,pid);if(!w)return;const k=cat?(t.sub||'Sem subcategoria'):(t.category||'Outros');map[k]=(map[k]||0)+t.amount*txShare(t,share)*w});
  return Object.keys(map).map(k=>({label:k,value:map[k]})).sort((a,b)=>b.value-a.value);
}
