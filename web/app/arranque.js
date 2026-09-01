/* ================= EXEMPLO ================= */
function seed(){
  const o1=normPerson({name:'Maria Costa',phone:'913 000 001',email:'maria@exemplo.pt',nif:'210000001',gender:'f',marital:'Casado(a)',nationality:'Portuguesa'});
  const o2=normPerson({name:'Pedro Costa',phone:'913 000 002',email:'pedro@exemplo.pt',nif:'210000002',gender:'m',marital:'Casado(a)',nationality:'Portuguesa'});
  db.owners=[o1,o2];
  const p1=uid(),p2=uid(),p3=uid();
  const r=n=>({id:uid(),name:n});
  const q1=r('Quarto 1'),q2=r('Quarto 2'),q3=r('Quarto 3'),q4=r('Quarto 4');
  const l1=normLoan({name:'Aquisição',bank:'Millennium',outstanding:152000,years:28,type:'variavel',euribor:2.1,spread:1.0,index:'6m',start:`${YEAR-6}-05-01`,taeg:3.4,mtic:238500});
  const l1b=normLoan({name:'Obras',bank:'Millennium',outstanding:18000,years:8,type:'fixa',rate:4.2,start:`${YEAR-2}-03-01`,taeg:4.6,mtic:22400});
  const l3=normLoan({name:'Aquisição',bank:'CGD',outstanding:98000,years:15,type:'fixa',rate:3.1,start:`${YEAR-9}-01-15`});
  db.properties=[
    normProp({id:p1,name:'T2 Lisboa',address:'Campo de Ourique',use:'investimento',rentalMode:'inteiro',
      value:280000,purchase:225000,ownerIds:[o1.id,o2.id],ownerShares:{[o1.id]:60,[o2.id]:40},loans:[l1,l1b],
      parish:'freguesia e concelho de Lisboa',registry:'15937',matrix:'4651',
      licence:'Alvará de Utilização n.º 26/2013',energyCert:'SCE395442330',energyClass:'D',energyValid:`${YEAR+10}-02-06`,
      listing:'T2 remodelado em Campo de Ourique, 78 m², cozinha equipada, muita luz natural. Perto de transportes e comércio.'}),
    normProp({id:p2,name:'T3 Coimbra',address:'Solum',use:'investimento',rentalMode:'quartos',rooms:[q1,q2,q3,q4],
      value:210000,purchase:168000,ownerIds:[o1.id],notes:'Caldeira revista em junho. *Rever o esquentador* antes do inverno.'}),
    normProp({id:p3,name:'Casa de família',address:'Sintra',use:'proprio',value:340000,purchase:290000,ownerIds:[o1.id,o2.id],loans:[l3]})
  ];
  const t1=normPerson({name:'Ana Rodrigues',phone:'912 000 001',email:'ana@exemplo.pt',nif:'220000001',gender:'f',marital:'Solteiro(a)'});
  const t2=normPerson({name:'Bruno Silva',phone:'912 000 002',gender:'m'});
  const t3=normPerson({name:'Carla Matos',phone:'912 000 003',gender:'f'});
  const t4=normPerson({name:'Diogo Faria',gender:'m'});
  const t5=normPerson({name:'Eva Nunes',gender:'f'});
  db.tenants=[t1,t2,t3,t4,t5];
  const c1=normContract({propertyId:p1,tenantIds:[t1.id],rent:1250,taxRate:25,deposit:2500,payDay:8,
    start:`${YEAR-1}-09-01`,increase:2.5,iban:'PT50 0033 0000 4567 8901 2345 6',
    ownerEmail:o1.email,ownerPhone:o1.phone,tenantEmail:t1.email,tenantPhone:t1.phone,
    inventory:[{id:uid(),name:'Sofá de 3 lugares',qty:1,state:'novo'},{id:uid(),name:'Cadeiras de sala',qty:4,state:'usado'},
               {id:uid(),name:'Máquina de lavar roupa',qty:1,state:'usado'}],
    keys:[{id:uid(),name:'Chaves de casa',qty:2},{id:uid(),name:'Chave do correio',qty:1}]});
  const c2=normContract({propertyId:p2,roomId:q1.id,tenantIds:[t2.id],rent:350,taxRate:25,deposit:350,payDay:1,start:`${YEAR}-09-01`});
  const c3=normContract({propertyId:p2,roomId:q2.id,tenantIds:[t3.id],rent:350,taxRate:25,deposit:350,payDay:1,start:`${YEAR}-09-01`});
  const c4=normContract({propertyId:p2,roomId:q3.id,tenantIds:[t4.id,t5.id],rent:430,taxRate:25,deposit:430,payDay:1,
    start:`${YEAR}-07-01`,notes:'Casal, quarto com casa de banho privativa',
    ownerEmail:o1.email,ownerPhone:o1.phone,tenantPhone:'912 000 004'});
  db.contracts=[c1,c2,c3,c4];
  db.transactions=[];
  const k1=loanCalc(l1),k1b=loanCalc(l1b),k3=loanCalc(l3);
  for(let m=1;m<=8;m++){
    const d=n=>`${YEAR}-${String(m).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
    db.transactions.push(
      normTx({kind:'income',label:'Renda T2 Lisboa',amount:1250,date:d(8),propertyId:p1,contractId:c1.id,paidBy:o1.id,category:'Rendas',sub:'Renda mensal'}),
      normTx({kind:'expense',label:'Quota do condomínio',amount:55,date:d(8),propertyId:p1,category:'Condomínio',sub:'Quota mensal',tags:['Recorrente'],paidBy:m%2?o1.id:o2.id}),
      normTx({kind:'loan',label:'Prestação aquisição · T2 Lisboa',amount:Math.round(k1.total*100)/100,date:d(10),propertyId:p1,loanId:l1.id,
        interest:Math.round(k1.interest*100)/100,stamp:Math.round(k1.stamp*100)/100,principal:Math.round(k1.principal*100)/100,paidBy:o1.id}),
      normTx({kind:'loan',label:'Prestação obras · T2 Lisboa',amount:Math.round(k1b.total*100)/100,date:d(10),propertyId:p1,loanId:l1b.id,paidBy:o2.id,
        interest:Math.round(k1b.interest*100)/100,stamp:Math.round(k1b.stamp*100)/100,principal:Math.round(k1b.principal*100)/100}),
      normTx({kind:'loan',label:'Prestação casa de família',amount:Math.round(k3.total*100)/100,date:d(10),propertyId:p3,loanId:l3.id,
        interest:Math.round(k3.interest*100)/100,stamp:Math.round(k3.stamp*100)/100,principal:Math.round(k3.principal*100)/100})
    );
    if(m>=7)db.transactions.push(normTx({kind:'income',label:'Renda Quarto 3',amount:430,date:d(1),propertyId:p2,contractId:c4.id}));
  }
  db.transactions.push(
    normTx({kind:'expense',label:'IMI '+YEAR,amount:435,date:`${YEAR}-04-28`,propertyId:p1,category:'Impostos',sub:'IMI',tags:['Dedutível'],paidBy:o1.id}),
    normTx({kind:'expense',label:'IMI '+YEAR,amount:540,date:`${YEAR}-04-28`,propertyId:p3,category:'Impostos',sub:'IMI'}),
    normTx({kind:'expense',label:'Seguro multirriscos',amount:96,date:`${YEAR}-02-11`,propertyId:p1,category:'Seguros',sub:'Multirriscos'}),
    normTx({kind:'expense',label:'Pintura da sala',amount:780,date:`${YEAR}-03-02`,propertyId:p1,category:'Obras e benfeitorias',sub:'Pintura',paidBy:o2.id,
      notes:'Orçamento do Sr. Manuel, duas demãos. Ficou combinado repetir daqui a 5 anos.'}),
    normTx({kind:'expense',label:'Reparação da caldeira',amount:245,date:`${YEAR}-06-14`,propertyId:p2,category:'Manutenção e reparações',sub:'Caldeira / AVAC',tags:['Urgente']}),
    normTx({kind:'expense',label:'Certificado energético',amount:130,date:`${YEAR}-07-20`,propertyId:p2,category:'Serviços profissionais',sub:'Certificado energético'}),
    normTx({kind:'owed',label:'Empréstimo para a entrada',amount:15000,date:`${YEAR-6}-05-02`,propertyId:p1,creditor:'Pai',paidBy:o1.id,
      category:'Empréstimos recebidos',sub:'Família',notes:'Combinado devolver _sem juros_, à medida que houver folga.'}),
    normTx({kind:'repay',label:'Devolução ao pai',amount:2000,date:`${YEAR}-01-15`,propertyId:p1,creditor:'Pai',paidBy:o2.id,
      category:'Dívidas a terceiros',sub:'Reembolso de empréstimo'}),
    normTx({kind:'expense',label:'Substituição do esquentador',amount:640,date:`${YEAR}-05-09`,propertyId:p1,category:'Manutenção e reparações',sub:'Caldeira / AVAC',paidBy:o1.id,
      split:{mode:'amount',parts:{[o1.id]:400,[o2.id]:240}},notes:'Dividido por valor: a Maria fica com a parte do termostato.'})
  );
  db.templates=[normTpl({name:'Quota do condomínio',tx:{kind:'expense',label:'Quota do condomínio',amount:55,propertyId:p1,category:'Condomínio',sub:'Quota mensal',tags:['Recorrente'],split:{mode:'equal',parts:{}}}})];
  db.recurring=[normRec({name:'Prestação aquisição · T2 Lisboa',every:'month',next:addDays(today(),3),
      tx:{kind:'loan',label:'Prestação aquisição · T2 Lisboa',amount:Math.round(k1.total*100)/100,propertyId:p1,loanId:l1.id,paidBy:o1.id,split:{mode:'equal',parts:{}}}})];
  syncAllContractRecs();syncAllLoanRecs();
  save();buildNav();render();toast('Dados de exemplo carregados.');
}

/* ================= ARRANQUE ================= */
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
document.addEventListener('click',()=>closePops());
/* o teclado tapava as caixas de texto no fundo do ecrã */
const typing=t=>!!t&&((/^(INPUT|TEXTAREA)$/.test(t.tagName||'')&&!/^(date|month|time|checkbox|file)$/.test(t.type||''))||t.isContentEditable);
/* o seletor de data é uma janela do sistema: ao escolher, larga o foco para o ecrã voltar ao sítio */
document.addEventListener('change',e=>{const t=e.target;if(t&&t.tagName==='INPUT'&&/^(date|month|time)$/.test(t.type||'')){try{t.blur()}catch(x){}
  [].slice.call(document.querySelectorAll('.sheet.kb')).forEach(x=>x.classList.remove('kb'))}});
const topSheet=()=>{const t=modalTop();return t?t.el.querySelector('.sheet'):null};
document.addEventListener('focusin',e=>{
  const t=e.target;
  if(!typing(t))return;
  const s2=topSheet();if(s2)s2.classList.add('kb');
  setTimeout(()=>{try{t.scrollIntoView({block:'center',behavior:'smooth'})}catch(err){}},260);
});
document.addEventListener('focusout',()=>{
  setTimeout(()=>{
    if(typing(document.activeElement))return;
    [].slice.call(document.querySelectorAll('.sheet.kb')).forEach(x=>x.classList.remove('kb'));
  },120);
});
syncAllContractRecs();syncAllLoanRecs();save();scheduleReminders();
fitInsets();applyTheme();buildNav();render();cleanFiles();migrateInline();
(function(){const n=recLate().length,p=recActive().length;if(n)setTimeout(()=>toast(n===1?'Atenção: há 1 movimento em atraso por confirmar.':'Atenção: há '+n+' movimentos em atraso por confirmar.'),600);
  else if(p)setTimeout(()=>toast(p===1?'Há 1 movimento por confirmar.':'Há '+p+' movimentos por confirmar.'),600)})();
try{window.addEventListener('resize',fitInsets)}catch(e){}
