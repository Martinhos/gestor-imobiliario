/* ================= SALDOS ENTRE PROPRIETÁRIOS =================
   Cada movimento com "pago por" fica a crédito de quem pagou, e o custo divide-se
   pelos proprietários do imóvel — em partes iguais, pelas quotas, ou pela divisão
   escolhida no próprio movimento. Receber uma renda é o inverso: quem recebeu
   passa a dever aos outros. Movimentos sem pagador indicado não entram nestas
   contas — de outra forma inventavam-se dívidas. Aqui estão as quotas, a divisão
   de um movimento pelos donos e pelos imóveis de um grupo, os saldos
   (ownerBalances), o plano de transferências que os acerta (settlePlan) e a
   janela «Como se chega aos saldos» (balancesDetail). */
/* Os proprietários de um imóvel que têm ficha.
   Recebe: p — o imóvel (objeto).
   Devolve: os ids dos proprietários do imóvel que têm ficha (array de strings). */
function ownersOfProp(p){return (p.ownerIds||[]).filter(id=>owner(id))}
/* quota-parte de cada proprietário (fração). Sem percentagens definidas: partes iguais.
   Recebe: p — o imóvel (objeto; aguenta null).
   Devolve: objeto {idDoDono: fração 0–1}; vazio se o imóvel não tiver donos com ficha. */
function sharesOf(p){
  const os=ownersOfProp(p||{}),out={};if(!os.length)return out;
  const raw=(p&&p.ownerShares)||{};
  const has=o=>raw[o]!==undefined&&raw[o]!==null&&raw[o]!==''&&isFinite(Number(raw[o]))&&Number(raw[o])>=0;
  const given=os.filter(has),blank=os.filter(o=>!has(o));
  if(!given.length){os.forEach(o=>{out[o]=1/os.length});return out}
  const sumG=sum(given.map(o=>Number(raw[o])));
  /* quem não tem percentagem fica com o que falta até 100%, em partes iguais */
  const rest=blank.length?Math.max(0,100-sumG):0,tot=sumG+rest;
  if(!(tot>0)){os.forEach(o=>{out[o]=0});return out}
  os.forEach(o=>{out[o]=has(o)?Number(raw[o])/tot:(blank.length?rest/blank.length/tot:0)});
  return out;
}
// quota-parte (fração 0–1) do proprietário oid no imóvel p; 0 se não for dono.
// Recebe: p — o imóvel (objeto); oid — o id do proprietário.
// Devolve: a fração 0–1 desse dono; 0 se não for dono.
const shareOf=(p,oid)=>{const s=sharesOf(p);return s[oid]===undefined?0:s[oid]};
/* O imóvel tem percentagens escritas para algum dono.
   Recebe: p — o imóvel (aguenta null).
   Devolve: true/false. */
const hasShares=p=>Object.keys((p&&p.ownerShares)||{}).length>0;
/* fator a aplicar aos valores de um imóvel quando a vista está filtrada por proprietário
   Recebe: p — o imóvel (aguenta null).
   Devolve: a quota do dono filtrado (0–1); 1 sem filtro, com um grupo no filtro, ou
   sem imóvel. */
const sh=p=>(ownerFilter&&!ownerIsGrp()&&p)?shareOf(p,ownerFilter):1;
/* A quota do dono filtrado, em percentagem, para pôr ao lado de um valor.
   Recebe: p — o imóvel.
   Devolve: o texto, ex.: «50%»; '' sem filtro de proprietário. */
const shareText=p=>ownerFilter?pct(sh(p),0):'';
/* divide um total inteiro (cêntimos) pelas quotas, somando exatamente o total
   Recebe: total — o valor a dividir (inteiro, em cêntimos); shares — a fração de cada um (array de números).
   Devolve: array de inteiros (cêntimos), pela mesma ordem de shares, cuja soma dá exatamente o total. */
function splitShares(total,shares){
  const raw=shares.map(x=>total*x),out=raw.map(x=>Math.trunc(x));
  let rem=total-out.reduce((a,b)=>a+b,0);
  const idx=raw.map((x,i)=>({i,f:Math.abs(x-out[i])})).sort((a,b)=>b.f-a.f);
  const step=rem>0?1:-1;
  for(let k=0;k<Math.abs(rem)&&idx.length;k++)out[idx[k%idx.length].i]+=step;
  return out;
}
/* quanto cabe a cada dono (cêntimos, positivos) num movimento, conforme o modo de divisão:
   equal (partes iguais), quota (quota-parte), pct/percent (pesos ou percentagens próprias),
   amount (valores certos) ou adjust (um extra por cima da parte igual: ao total tira-se a
   soma dos ajustes, o resto divide-se em partes iguais por todos e cada um soma o seu)
   Recebe: t — o movimento (objeto; usa t.amount e t.split); p — o imóvel (objeto; pode ser null
   e, sem quotas, a divisão cai em partes iguais); os — os ids dos donos (array de strings).
   Devolve: array de cêntimos (inteiros, positivos) por dono, pela ordem de os. */
function txSplitCents(t,p,os){
  const total=Math.abs(Math.round((Number(t.amount)||0)*100));
  const shares=sharesOf(p),fr=os.map(o=>shares[o]||0);
  const sp=t.split||{},parts=sp.parts||{},get=o=>Math.max(0,Number(parts[o])||0);
  const eq=os.map(()=>1/os.length);
  if(sp.mode==='equal')return splitShares(total,eq);
  if(sp.mode==='pct'||sp.mode==='percent'){const w=os.map(get),tw=sum(w);return splitShares(total,tw>0?w.map(x=>x/tw):eq)}
  if(sp.mode==='amount'){
    const c=os.map(o=>Math.round(get(o)*100));let rem=total-sum(c);
    if(rem<0){const k=total/Math.max(1,sum(c));return c.map(x=>Math.round(x*k))}
    const rest=splitShares(Math.max(0,rem),eq);return c.map((x,i)=>x+rest[i]);
  }
  if(sp.mode==='adjust'){
    /* o ajuste é um extra por cima da parte igual: tira-se ao total a soma dos ajustes,
       o que sobra divide-se em partes iguais por todos e cada um soma o seu
       (15 € com A=5: 10/2=5 → A 10, B 5). Em branco vale 0; negativos contam 0.
       Se os ajustes passarem o total (o formulário recusa, mas dados antigos podem
       trazê-lo), reparte-se o total na proporção dos ajustes para a soma bater certo. */
    const adj=os.map(o=>Math.round(get(o)*100)),ta=sum(adj),rem=total-ta;
    if(rem<0)return splitShares(total,adj.map(x=>x/ta));
    const rest=splitShares(rem,eq);return adj.map((x,i)=>x+rest[i]);
  }
  return splitShares(total,sum(fr)>0?fr:eq);
}
/* fração de um movimento que cabe a um dono (para a vista filtrada por proprietário)
   Recebe: t — o movimento (objeto); oid — o id do proprietário.
   Devolve: a fração 0–1 do valor do movimento que cabe a esse dono; 0 se não for dono do imóvel. */
function txOwnerFrac(t,oid){
  const p=prop(t.propertyId);if(!p)return 0;
  const os=ownersOfProp(p);if(os.indexOf(oid)<0)return 0;
  if(!t.split||!t.split.mode)return shareOf(p,oid);
  const total=Math.abs(Math.round((Number(t.amount)||0)*100));if(!total)return shareOf(p,oid);
  return txSplitCents(t,p,os)[os.indexOf(oid)]/total;
}
/* O modo de divisão de um movimento pelos donos, em palavras.
   Recebe: t — o movimento.
   Devolve: o texto ('em partes iguais', 'por ajuste'…); '' sem divisão escolhida. */
const splitLabel=t=>({equal:'em partes iguais',pct:'por quotas a definir',percent:'por percentagem',amount:'por valor',adjust:'por ajuste'})[(t.split||{}).mode]||'';
/* imóveis abrangidos por um movimento (o próprio, ou os do grupo)
   Recebe: t — o movimento (objeto; usa t.propertyId ou t.groupId).
   Devolve: os imóveis abrangidos (array de objetos); vazio se não apontar a nenhum. */
function txProps(t){
  if(t.propertyId){const p=prop(t.propertyId);return p?[p]:[]}
  if(t.groupId){const g=grp(t.groupId);return g?g.ids.map(prop).filter(Boolean):[]}
  return [];
}
/* divide o total (cêntimos) pelos imóveis do grupo, conforme o modo escolhido; em
   'adjust' o valor de cada imóvel é um extra por cima da parte igual, como entre donos
   Recebe: t — o movimento (objeto; usa t.psplit); ps — os imóveis do grupo (array de objetos);
   total — o valor a dividir (inteiro, em cêntimos).
   Devolve: array de cêntimos (inteiros) por imóvel, pela ordem de ps. */
function psplitCents(t,ps,total){
  const sp=t.psplit||{},parts=sp.parts||{},get=p=>Math.max(0,Number(parts[p.id])||0);
  const eq=ps.map(()=>1/ps.length);
  const by=f=>{const w=ps.map(f),tw=sum(w);return splitShares(total,tw>0?w.map(x=>x/tw):eq)};
  if(sp.mode==='value')return by(p=>Number(p.value)||0);
  if(sp.mode==='purchase')return by(p=>Number(p.purchase)||0);
  if(sp.mode==='pct')return by(get);
  if(sp.mode==='percent')return by(get);
  if(sp.mode==='amount'){const c=ps.map(p=>Math.round(get(p)*100));let rem=total-sum(c);
    if(rem<0){const k=total/Math.max(1,sum(c));return c.map(x=>Math.round(x*k))}
    const rest=splitShares(Math.max(0,rem),eq);return c.map((x,i)=>x+rest[i]);}
  if(sp.mode==='adjust'){/* extra por cima da parte igual — a mesma regra do txSplitCents */
    const adj=ps.map(p=>Math.round(get(p)*100)),ta=sum(adj),rem=total-ta;
    if(rem<0)return splitShares(total,adj.map(x=>x/ta));
    const rest=splitShares(rem,eq);return adj.map((x,i)=>x+rest[i]);}
  return splitShares(total,eq);
}
/* fração de um movimento que cabe a um imóvel
   Recebe: t — o movimento (objeto); pid — o id do imóvel.
   Devolve: a fração 0–1 do valor do movimento que cabe a esse imóvel. */
function txPropShare(t,pid){
  if(t.propertyId)return t.propertyId===pid?1:0;
  if(!t.groupId)return 0;
  const ps=txProps(t),i=ps.findIndex(p=>p.id===pid);if(i<0)return 0;
  const total=Math.abs(Math.round((Number(t.amount)||0)*100));
  if(!total)return 1/ps.length;
  return psplitCents(t,ps,total)[i]/total;
}
/* peso do movimento numa vista: por imóvel (pid) ou no âmbito atual
   Recebe: t — o movimento (objeto); pid (opcional) — o id de um imóvel ou 'g:ID' de um grupo;
   vazio vale o âmbito atual.
   Devolve: número 0–1 — a fração do valor do movimento que conta nessa vista. */
function txW(t,pid){
  if(String(pid||'').startsWith('g:'))return sum(pidProps(pid).map(p=>txW(t,p.id)));
  if(pid)return txPropShare(t,pid);
  if(t.propertyId)return inScope(t.propertyId)?1:0;
  if(t.groupId)return sum(txProps(t).filter(p=>inScope(p.id)).map(p=>txPropShare(t,p.id)));
  return ownerFilter?0:1;
}
/* donos (fichas) dos imóveis do grupo de um movimento, sem repetir
   Recebe: t — o movimento (objeto).
   Devolve: as fichas dos proprietários (array de objetos), sem repetidos. */
function txGroupOwners(t){
  const ids=[];txProps(t).forEach(p=>ownersOfProp(p).forEach(o=>{if(ids.indexOf(o)<0)ids.push(o)}));
  return ids.map(owner).filter(Boolean);
}
/* O modo de divisão de um movimento de grupo pelos imóveis, em palavras.
   Recebe: t — o movimento.
   Devolve: o texto ('pelo valor de mercado'…); '' sem divisão escolhida. */
const psplitLabel=t=>({equal:'em partes iguais',value:'pelo valor de mercado',purchase:'pelo valor de aquisição',pct:'por quotas a definir',percent:'por percentagem',amount:'por valor certo',adjust:'por ajuste'})[(t.psplit||{}).mode]||'';
/* o que entra nas contas entre donos: receitas, despesas e prestações com pessoa indicada.
   Dívidas a terceiros (recebidas ou pagas) ficam de fora — são de quem as contraiu.
   Recebe: t — o movimento.
   Devolve: true se conta nas contas entre donos. */
const countsBetweenOwners=t=>!!t.paidBy&&(t.kind==='income'||t.kind==='expense'||t.kind==='loan');
/* efeito de cada movimento nos saldos (cêntimos por dono), para se poder conferir
   Recebe: pid (opcional) — o id de um imóvel ou 'g:ID' de um grupo; vazio vale o âmbito atual.
   Devolve: array de {t, p, os, eff}, ordenado por data — o movimento, o imóvel (ou só
   {name:…} nos movimentos de grupo/globais), os ids dos donos e o efeito em cêntimos por dono. */
function balanceLines(pid){
  /* as contas entre proprietários são dos proprietários: um imóvel onde só colaboro fica de fora */
  const props=pidProps(pid).filter(p=>souDono(p.id)),out=[];
  props.forEach(p=>{
    const os=ownersOfProp(p).slice().sort();
    /* os acertos deste imóvel contam sempre — com um só dono, ou entre quem não é dono dele:
       uma dívida de grupo paga por quem não é dono do imóvel salda-se com um acerto aqui */
    db.transactions.filter(t=>t.propertyId===p.id&&t.kind==='settle').forEach(t=>{
      const v=Math.round((Number(t.amount)||0)*100),eff={};os.forEach(o=>eff[o]=0);
      const add=(o,x)=>{if(!o)return;eff[o]=(eff[o]||0)+x};
      add(t.paidBy,v);add(t.toId,-v);
      out.push({t,p,os:Object.keys(eff).sort(),eff});
    });
    if(os.length<2)return;
    db.transactions.filter(t=>t.propertyId===p.id&&countsBetweenOwners(t)&&os.indexOf(t.paidBy)>-1).forEach(t=>{
      const eff={};os.forEach(o=>eff[o]=0);
      const sign=isIn(t.kind)?-1:1,total=Math.abs(Math.round((Number(t.amount)||0)*100));eff[t.paidBy]+=total*sign;txSplitCents(t,p,os).forEach((part,i)=>{eff[os[i]]-=part*sign});
      out.push({t,p,os,eff});
    });
  });
  db.transactions.filter(t=>!t.propertyId&&(t.groupId?countsBetweenOwners(t)&&txProps(t).some(p2=>props.some(p3=>p3.id===p2.id)):(countsBetweenOwners(t)||t.kind==='settle')&&!pid&&!ownerFilter)).forEach(t=>{
    const sign=isIn(t.kind)?-1:1,total=Math.abs(Math.round((Number(t.amount)||0)*100));
    const eff={},add=(o,v)=>{eff[o]=(eff[o]||0)+v};
    if(t.kind==='settle'){   /* acerto das dívidas globais (sem imóvel nem grupo): quem paga sobe, quem recebe desce */
      add(t.paidBy,total);add(t.toId,-total);
    }else if(t.groupId){
      txProps(t).filter(p2=>props.some(p3=>p3.id===p2.id)).forEach(p2=>{
        const cP=Math.round(total*txPropShare(t,p2.id)),os2=ownersOfProp(p2).slice().sort();
        if(!os2.length||!cP)return;
        add(t.paidBy,cP*sign);
        txSplitCents(Object.assign({},t,{amount:cP/100}),p2,os2).forEach((part,i)=>add(os2[i],-part*sign));
      });
    }else{
      const os2=donosGlobais().map(o=>o.id).sort();if(!os2.length)return;
      add(t.paidBy,total*sign);
      txSplitCents(t,null,os2).forEach((part,i)=>add(os2[i],-part*sign));
    }
    if(Object.keys(eff).length)out.push({t,p:{name:t.groupId?('Grupo '+((grp(t.groupId)||{}).name||'')):'todos os imóveis'},os:Object.keys(eff).sort(),eff});
  });
  return out.sort((a,b)=>String(a.t.date).localeCompare(String(b.t.date)));
}
let _detailPid=null;
// se o modal "Como se chega aos saldos" estiver por cima, reabre-o para refletir dados frescos.
// Devolve: nada — fecha e reabre o modal quando é ele que está por cima.
function refreshDetail(){const t=modalTop();if(t&&t.title==='Como se chega aos saldos'){closeModal();balancesDetail(_detailPid)}}
/* abre o modal "Como se chega aos saldos": cada movimento que conta, o efeito em
   cêntimos por dono e o saldo acumulado até aí. pid limita a um imóvel (vazio =
   âmbito atual). Tocar num movimento abre-o para editar; sem movimentos, só avisa.
   Recebe: pid (opcional) — o id de um imóvel; vazio vale o âmbito atual.
   Devolve: nada — abre o modal (ou mostra só um toast se não houver movimentos). */
function balancesDetail(pid){
  _detailPid=pid||null;
  const lines=balanceLines(pid);
  const ids=[];lines.forEach(l=>l.os.forEach(o=>{if(ids.indexOf(o)<0)ids.push(o)}));
  if(!lines.length)return toast('Ainda não há movimentos que contem para as contas.');
  const nm=o=>esc(((owner(o)||{}).name||'?').split(' ')[0]);
  const run={};ids.forEach(o=>run[o]=0);
  openModal('Como se chega aos saldos',`<div class="form">
    <div class="hint">Quem paga fica a crédito; quem recebe fica a dever a parte dos outros. Positivo: a receber. Negativo: a pagar.</div>
    <div class="list u-g-7px">${lines.map(l=>{ids.forEach(o=>run[o]+=(l.eff[o]||0));return `<div class="card tap u-p-10px-12px" data-click="txView('${jsq(l.t.id)}')">
      <div class="row-between"><b class="u-minw-0 u-ov-hidden u-to-ellipsis u-ws-nowrap">${esc(l.t.label)}</b><span class="small u-fx-0-0-auto">${dPT(l.t.date)}</span></div>
      <div class="small">${l.t.kind==='settle'?nm(l.t.paidBy)+' → '+nm(l.t.toId):(KIND[l.t.kind]||{}).short+' · '+(isIn(l.t.kind)?'recebeu ':'pagou ')+nm(l.t.paidBy)+(splitLabel(l.t)?' · '+splitLabel(l.t):' · quotas')}${!pid?' · '+esc(l.p.name):''} · <b>${euro2(l.t.amount)}</b></div>
      <div class="chips u-mt-6px">${ids.map(o=>`<span class="badge grey">${nm(o)} <b class="${l.eff[o]>0?'pos':l.eff[o]<0?'neg':''}">${l.eff[o]?(l.eff[o]>0?'+':'−')+euro2(Math.abs(l.eff[o])/100):'—'}</b> · saldo ${euro2(run[o]/100)}</span>`).join('')}</div></div>`}).join('')}</div>
    <div class="hint">"Saldo" é o acumulado até esse movimento: positivo a receber, negativo a pagar. Toca num movimento para o editar.</div></div>`,
    `<button class="btn" data-click="closeModal()">Fechar</button>`);
}
/* saldos entre comproprietários, em euros por dono: quem pagou fica a crédito e a
   parte de cada um sai das quotas ou da divisão escolhida no movimento; as
   transferências acertam contas diretamente. pid limita a um imóvel ou grupo; sem
   pid vale o âmbito atual. Positivo é a receber, negativo a pagar.
   Recebe: pid (opcional) — o id de um imóvel ou 'g:ID' de um grupo; vazio vale o âmbito atual.
   Devolve: objeto {idDoDono: saldo em euros} — positivo a receber, negativo a pagar. */
function ownerBalances(pid){
  /* as contas entre proprietários são dos proprietários: um imóvel onde só colaboro fica de fora */
  const props=pidProps(pid).filter(p=>souDono(p.id)),cents={};
  props.forEach(p=>{
    const os=ownersOfProp(p).slice().sort();
    /* os acertos deste imóvel contam sempre — com um só dono, ou entre quem não é dono dele
       (uma dívida de grupo paga por quem não é dono do imóvel salda-se com um acerto aqui) */
    db.transactions.filter(t=>t.propertyId===p.id&&t.kind==='settle').forEach(t=>{
      const v=Math.round((Number(t.amount)||0)*100);
      const add=(o,x)=>{if(!o)return;if(cents[o]===undefined)cents[o]=0;cents[o]+=x};
      add(t.paidBy,v);add(t.toId,-v);
    });
    if(os.length<2)return;
    os.forEach(o=>{if(cents[o]===undefined)cents[o]=0});
    db.transactions.filter(t=>countsBetweenOwners(t)&&t.propertyId===p.id&&os.indexOf(t.paidBy)>-1).forEach(t=>{
      const sign=isIn(t.kind)?-1:1,total=Math.abs(Math.round((Number(t.amount)||0)*100));
      cents[t.paidBy]+=total*sign;
      txSplitCents(t,p,os).forEach((part,i)=>{cents[os[i]]-=part*sign});
    });
  });
  /* sem imóvel: divide-se por todos os proprietários (e os acertos globais saldam-se aqui);
     com grupo: pelos donos de cada imóvel do grupo */
  db.transactions.filter(t=>!t.propertyId&&(countsBetweenOwners(t)||(t.kind==='settle'&&!t.groupId))).forEach(t=>{
    const sign=isIn(t.kind)?-1:1,total=Math.abs(Math.round((Number(t.amount)||0)*100));
    const add=(o,v)=>{if(cents[o]===undefined)cents[o]=0;cents[o]+=v};
    if(t.kind==='settle'){
      if(!pid&&!ownerFilter){add(t.paidBy,total);add(t.toId,-total)}
    }else if(t.groupId){
      txProps(t).filter(p2=>props.some(p3=>p3.id===p2.id)).forEach(p2=>{
        const cP=Math.round(total*txPropShare(t,p2.id)),os=ownersOfProp(p2).slice().sort();
        if(!os.length||!cP)return;
        add(t.paidBy,cP*sign);
        txSplitCents(Object.assign({},t,{amount:cP/100}),p2,os).forEach((part,i)=>add(os[i],-part*sign));
      });
    }else if(!pid&&!ownerFilter){
      const os=donosGlobais().map(o=>o.id).sort();if(!os.length)return;
      add(t.paidBy,total*sign);
      txSplitCents(t,null,os).forEach((part,i)=>add(os[i],-part*sign));
    }
  });
  const bal={};Object.keys(cents).forEach(k=>{bal[k]=cents[k]/100});
  return bal;
}
/* menor número de transferências que zera os saldos
   Recebe: bal — os saldos por dono em euros (objeto {id: valor}, como o de ownerBalances).
   Devolve: array de {from, to, amount} — quem paga, quem recebe e quanto (euros, 2 casas). */
function settlePlan(bal){
  const cred=[],deb=[];
  Object.keys(bal).forEach(k=>{const v=bal[k];
    if(v>0.005)cred.push({id:k,v:v});else if(v<-0.005)deb.push({id:k,v:-v})});
  cred.sort((a,b)=>b.v-a.v);deb.sort((a,b)=>b.v-a.v);
  const out=[];let i=0,j=0;
  while(i<deb.length&&j<cred.length){
    const x=Math.min(deb[i].v,cred[j].v);
    if(x>0.005)out.push({from:deb[i].id,to:cred[j].id,amount:Math.round(x*100)/100});
    deb[i].v-=x;cred[j].v-=x;
    if(deb[i].v<=0.005)i++;
    if(cred[j].v<=0.005)j++;
  }
  return out;
}
/* O que está por acertar: a soma dos saldos a receber.
   Recebe: bal — os saldos por dono, em euros (o de ownerBalances).
   Devolve: euros (número). */
const debtTotal=bal=>sum(Object.keys(bal).map(k=>bal[k]>0?bal[k]:0));
/* O que está por acertar entre os donos de um imóvel.
   Recebe: pid — o id do imóvel (ou 'g:ID' de um grupo).
   Devolve: euros (número). */
const propDebt=pid=>debtTotal(ownerBalances(pid));
